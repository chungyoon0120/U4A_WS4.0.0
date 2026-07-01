'use strict';

const { app }         = require('electron');
const path            = require('path');
const MessageDatabase = require('./MessageDatabase');

/**
 * @class WsMsgClsService
 * @description 언어별 MessageDatabase 인스턴스를 캐시하고
 *              Main global 객체로 Renderer에 노출하는 서비스.
 *
 * [사용 패턴]
 *   Main    : global.WsMsgCls = new WsMsgClsService()
 *   Renderer: remote.getGlobal('WsMsgCls').getRow(langu, arbgb, msgnr)
 */
class WsMsgClsService {

    constructor() {

        /** @type {Map<string, MessageDatabase>} 언어코드 → DB 인스턴스 */
        this._cache = new Map();

    }

    // ─────────────────────────────────────────
    // Private
    // ─────────────────────────────────────────

    /**
     * 패키징 여부에 따라 www 루트 경로를 반환합니다.
     * @returns {string}
     */
    _resolveRootPath() {

        if (app.isPackaged) {
            return path.join(app.getPath('exe'), '..', 'resources', 'www');
        }

        // electron/lib/msg/WsMsgClsService.js → 루트/www
        return path.join(__dirname, '..', '..', '..', 'www');

    }

    /**
     * 언어별 MessageDatabase 인스턴스를 반환합니다. (없으면 신규 생성)
     * @param {string} langu
     * @returns {MessageDatabase | null}
     */
    _getInstance(langu) {

        if (this._cache.has(langu)) {
            return this._cache.get(langu);
        }

        const dbPath = path.join(
            this._resolveRootPath(),
            'MSG', 'WS_COMMON', langu, 'MESSAGE_CLASS.db'
        );

        try {

            const inst = new MessageDatabase(dbPath);
            this._cache.set(langu, inst);
            return inst;

        } catch (error) {

            console.error(`[WsMsgClsService] DB 오픈 실패 (LANGU: ${langu}, PATH: ${dbPath})`, error);
            return null;

        }

    }

    // ─────────────────────────────────────────
    // Public  ←  Renderer에서 remote.getGlobal로 호출하는 인터페이스
    // ─────────────────────────────────────────

    /**
     * 메시지 클래스 행을 동기 조회합니다.
     *
     * @param {string} langu - 언어코드 (예: 'KO', 'EN')
     * @param {string} arbgb - 메시지 클래스 ID
     * @param {string} msgnr - 메시지 번호
     * @returns {{ TEXT: string, LTEXT: string } | null}
     */
    getRow(langu, arbgb, msgnr) {

        const inst = this._getInstance(langu);
        if (!inst) return null;

        return inst.getMessageClassRow(arbgb, msgnr);

    }

    /**
     * 메시지 텍스트로 키(ARBGB, MSGNR)를 역조회합니다.
     * - 특정 언어 DB 에서 TEXT 완전일치로 (클래스, 번호)를 되찾는다.
     * - 백엔드가 메시지 번호 없이 "구운 텍스트"만 내려준 경우, 그 텍스트를
     *   백엔드 언어로 역조회 → 키 확보 → 렌더러에서 워크스페이스 언어로 재현지화.
     *
     * @param {string} langu - 조회 대상 언어코드 (보통 백엔드 로그온 언어)
     * @param {string} text  - 찾을 메시지 텍스트(완전일치)
     * @returns {{ ARBGB: string, MSGNR: string } | null}
     */
    findKeyByText(langu, text) {

        const inst = this._getInstance(langu);
        if (!inst) return null;

        return inst.findByText(text);

    }

    /**
     * 특정 언어의 "파라미터(&) 포함 템플릿" 전체를 반환합니다.
     * - 백엔드가 &1.. 을 값으로 치환해 구운 텍스트를 렌더러가 템플릿 역매칭으로
     *   재현지화할 때 사용(완전일치 역조회로는 안 잡히는 케이스 보강).
     *
     * @param {string} langu - 조회 대상 언어코드(보통 백엔드 로그온 언어)
     * @returns {Array<{ ARBGB: string, MSGNR: string, TEXT: string }>}
     */
    getParamTemplates(langu) {

        const inst = this._getInstance(langu);
        if (!inst) return [];

        return inst.getParamTemplates();

    }

    /**
     * ★공통 역현지화(baked 텍스트 → 접속언어) — 앱복사/MIME/WS20 활성·저장 등 전 화면 단일출처.
     *   백엔드가 메시지번호 없이 "백엔드 로그온 언어로 구운 텍스트"만 showMessage/RTMSG 로 내려줄 때,
     *   그 텍스트를 백엔드 언어 DB 에서 역조회(완전일치→키, 파라미터는 템플릿 역매칭)해 키를 얻고,
     *   워크스페이스(접속) 언어로 재렌더한다. 못 찾으면 원문 그대로 반환(graceful).
     *
     * @param {string} sText   - 서버가 구워 내려준 표시 텍스트
     * @param {string} [beLangu] - 백엔드 로그온 언어(구운 언어). 모르면 falsy → 후보(EN/KO)로 시도.
     * @param {string} [wsLangu] - 워크스페이스(화면/접속) 언어. 없으면 원문 반환.
     * @returns {string} 접속언어 텍스트(또는 원문)
     */
    relocalize(sText, beLangu, wsLangu) {

        if (typeof sText !== 'string' || sText === '') return sText;
        const wsL = wsLangu || '';
        if (!wsL) return sText;

        // 후보 백엔드 언어(모르면 구워질 수 있는 언어 EN/KO 시도).
        const aCand = beLangu ? [beLangu] : ['EN', 'KO'];

        for (let c = 0; c < aCand.length; c++) {
            const beL = aCand[c];
            if (!beL || beL === wsL) continue;

            // 1) 완전일치(파라미터 없는 메시지).
            try {
                const oKey = this.findKeyByText(beL, sText);
                if (oKey && oKey.ARBGB) {
                    const oRow = this.getRow(wsL, oKey.ARBGB, oKey.MSGNR);
                    if (oRow && oRow.TEXT && oRow.TEXT.indexOf('&') === -1) return oRow.TEXT;
                }
            } catch (e) { /* 다음 후보 */ }

            // 2) 템플릿 역매칭(파라미터 있는 메시지).
            const sLoc = this._relocalizeByTemplate(sText, beL, wsL);
            if (sLoc != null) return sLoc;
        }

        return sText;
    }

    /** (Private) 파라미터(&) 템플릿 역매칭 — 리터럴 가장 긴 템플릿 우선. 못 찾으면 null. */
    _relocalizeByTemplate(sText, beLangu, wsLangu) {

        const _norm = (s) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
        const _esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const sNorm = _norm(sText);
        if (!sNorm) return null;

        let aTpl = [];
        try { aTpl = this.getParamTemplates(beLangu) || []; } catch (e) { aTpl = []; }

        let best = null, bestLit = -1;
        for (let t = 0; t < aTpl.length; t++) {
            const o = aTpl[t];
            if (!o || !o.TEXT) continue;
            const tpl = _norm(o.TEXT);
            const lit = tpl.replace(/&\d?/g, '').replace(/\s+/g, '').length;
            if (lit < 5) continue;              // 리터럴 너무 짧은 템플릿 = 오매칭 위험 → 제외

            const parts = [], order = [];
            let last = 0, n = 0, m; const re = /&(\d)?/g;
            while ((m = re.exec(tpl)) !== null) {
                parts.push(_esc(tpl.slice(last, m.index)));
                parts.push('(.*?)');
                n += 1;
                order.push(m[1] ? parseInt(m[1], 10) : n);
                last = m.index + m[0].length;
            }
            if (!order.length) continue;
            parts.push(_esc(tpl.slice(last)));

            let rx;
            try { rx = new RegExp('^' + parts.join('') + '$', 'i'); } catch (e) { continue; }
            const mm = sNorm.match(rx);
            if (mm && lit > bestLit) { bestLit = lit; best = { o: o, caps: mm.slice(1), order: order }; }
        }

        if (!best) return null;

        const p = ['', '', '', ''];
        for (let k = 0; k < best.order.length; k++) {
            const idx = best.order[k];
            if (idx >= 1 && idx <= 4) { p[idx - 1] = best.caps[k] || ''; }
        }

        const oRow = this.getRow(wsLangu, best.o.ARBGB, best.o.MSGNR);
        if (!oRow || !oRow.TEXT) return null;

        // 접속언어 템플릿의 &/&n 을 추출 파라미터로 치환.
        let seq = 0;
        return String(oRow.TEXT).replace(/&(\d)?/g, (mt, d) => {
            if (d) { const i = parseInt(d, 10); return (i >= 1 && i <= 4) ? p[i - 1] : ''; }
            return p[seq++] || '';
        });
    }

    /**
     * DB 연결을 닫고 캐시에서 제거합니다.
     * - langu 지정 시 : 해당 언어만 해제
     * - 생략 시       : 전체 해제 (app before-quit 시 호출)
     *
     * @param {string} [langu]
     */
    close(langu) {

        if (langu) {

            this._cache.get(langu)?.close();
            this._cache.delete(langu);

        } else {

            this._cache.forEach(inst => inst.close());
            this._cache.clear();

        }

    }

}

module.exports = WsMsgClsService;
