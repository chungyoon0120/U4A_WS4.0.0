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
