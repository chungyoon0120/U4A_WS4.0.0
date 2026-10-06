'use strict';

const BETTER_SQLITE3 = require('better-sqlite3');

/**
 * @class MessageDatabase
 * @description better-sqlite3 기반 메시지 클래스 단건 조회 래퍼.
 *              Main 프로세스 전용 (Native Node 모듈).
 */
class MessageDatabase {

    /**
     * @constructor
     * @param {string} dbFilePath - SQLite 데이터베이스 파일 경로
     */
    constructor(dbFilePath) {

        this.db = new BETTER_SQLITE3(dbFilePath, { readonly: true });

        this.messageStmt = this.db.prepare(`
            SELECT
                ARBGB,
                MSGNR,
                TEXT,
                LTEXT
            FROM MESSAGE_CLASS_TEXTS
            WHERE ARBGB = ?
            AND   MSGNR = ?
        `);

        // 역조회(텍스트 → 키). 백엔드가 메시지 번호 없이 "구운 텍스트"만 내려줄 때,
        // 그 텍스트로 (ARBGB, MSGNR) 를 되찾아 워크스페이스 언어로 재현지화하기 위함.
        // (TEXT 완전일치 — 파라미터(&1..) 치환 전 메시지에만 유효. 동일 텍스트 다건이면 첫 행.)
        this.findByTextStmt = this.db.prepare(`
            SELECT
                ARBGB,
                MSGNR
            FROM MESSAGE_CLASS_TEXTS
            WHERE TEXT = ?
            LIMIT 1
        `);

        // 파라미터(&) 포함 템플릿 전체. 백엔드가 &1..을 값으로 치환해 구운 텍스트는
        // 완전일치 역조회가 실패하므로, 렌더러가 이 템플릿들을 정규식화해 "& 자리만
        // 와일드카드"로 역매칭 → 파라미터 추출 → 워크스페이스 언어로 재구성한다.
        this.paramTemplateStmt = this.db.prepare(`
            SELECT
                ARBGB,
                MSGNR,
                TEXT
            FROM MESSAGE_CLASS_TEXTS
            WHERE INSTR(TEXT, '&') > 0
        `);

    }

    /**
     * 특정 메시지 1건을 동기 방식으로 조회합니다.
     *
     * @param {string} arbgb - 메시지 클래스 ID
     * @param {string} msgnr - 메시지 번호
     * @returns {{ ARBGB: string, MSGNR: string, TEXT: string, LTEXT: string } | null}
     */
    getMessageClassRow(arbgb, msgnr) {

        try {

            return this.messageStmt.get(
                String(arbgb).trim(),
                String(msgnr).trim().padStart(3, '0')
            ) || null;

        } catch (error) {
            console.error('[MessageDatabase] getMessageClassRow error:', error);
            return null;
        }

    }

    /**
     * 메시지 텍스트로 키(ARBGB, MSGNR)를 역조회합니다.
     * - 백엔드가 메시지 번호 없이 텍스트만 구워 내려준 응답을 재현지화할 때 사용.
     *
     * @param {string} text - 찾을 메시지 텍스트(완전일치)
     * @returns {{ ARBGB: string, MSGNR: string } | null}
     */
    findByText(text) {

        if (typeof text !== 'string' || text === '') { return null; }

        try {
            return this.findByTextStmt.get(text) || null;
        } catch (error) {
            console.error('[MessageDatabase] findByText error:', error);
            return null;
        }

    }

    /**
     * 파라미터(&) 포함 메시지 템플릿을 전부 반환합니다.
     * - 렌더러가 "& 자리 와일드카드" 역매칭으로 파라미터 baked 메시지를 재현지화할 때 사용.
     *
     * @returns {Array<{ ARBGB: string, MSGNR: string, TEXT: string }>}
     */
    getParamTemplates() {

        try {
            return this.paramTemplateStmt.all();
        } catch (error) {
            console.error('[MessageDatabase] getParamTemplates error:', error);
            return [];
        }

    }

    /**
     * DB 연결을 명시적으로 닫습니다.
     */
    close() {
        this.db?.close();
    }

}

module.exports = MessageDatabase;
