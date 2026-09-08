/**
 * @since   2026-06-12 01:36:51
 * @version v3.6.4-3
 * @author  PES
 * @description
 * 선택 효과 프리셋과 시스템별 매핑 정보를 SQLite DB로 관리한다.
 *
 */
(function (global) {
    "use strict";

    const MAP_TABLE = "WS_SELECTION_EFFECT_MAP";
    const DETAIL_TABLE = "WS_SELECTION_EFFECT_DETAIL";
    const MSG = {
        DEFAULT_PRESET_BLOCKED: ["ZMSG_WS_COMMON_001", "854"],
        DEFAULT_PRESET_UPDATE_BLOCKED: ["ZMSG_WS_COMMON_001", "854"],
        DEFAULT_PRESET_DELETE_BLOCKED: ["ZMSG_WS_COMMON_001", "854"],
        PRESET_NOT_FOUND: ["ZMSG_WS_COMMON_001", "906"],
        CUSTOM_KEY_FAILED: ["ZMSG_WS_COMMON_001", "902"]
    };

    const EFFECT_TYPES = [
        { EFFTY: "SELECT", TEXT: "UI 선택 스타일" },
        { EFFTY: "CONTEXT", TEXT: "Context menu 효과" }
    ];

    const DEFAULT_PRESETS = [
        {
            SELKY: "DEF_SELECT_BLUE",
            SELTX: "밝은 UI 선택 스타일",
            EFFTY: "SELECT",
            BORDER_R: 0,
            BORDER_G: 120,
            BORDER_B: 255,
            BORDER_A: 100,
            BORDER_NEON: "",
            FILL_R: 0,
            FILL_G: 120,
            FILL_B: 255,
            FILL_A: 8,
            STRIPE_R: 0,
            STRIPE_G: 120,
            STRIPE_B: 255,
            STRIPE_A: 0,
            STRIPE_ANGLE: 45,
            STRIPE_GAP: 32,
            STRIPE_WIDTH: 8
        },
        {
            SELKY: "DEF_SELECT_NEON",
            SELTX: "굵은 네온사인",
            EFFTY: "SELECT",
            BORDER_R: 0,
            BORDER_G: 188,
            BORDER_B: 255,
            BORDER_A: 100,
            BORDER_NEON: "X",
            FILL_R: 14,
            FILL_G: 53,
            FILL_B: 73,
            FILL_A: 68,
            STRIPE_R: 0,
            STRIPE_G: 188,
            STRIPE_B: 255,
            STRIPE_A: 0,
            STRIPE_ANGLE: 45,
            STRIPE_GAP: 40,
            STRIPE_WIDTH: 8
        },
        {
            SELKY: "DEF_SELECT_STRIPE",
            SELTX: "네온 사선",
            EFFTY: "SELECT",
            BORDER_R: 0,
            BORDER_G: 188,
            BORDER_B: 255,
            BORDER_A: 100,
            BORDER_NEON: "X",
            FILL_R: 14,
            FILL_G: 53,
            FILL_B: 73,
            FILL_A: 72,
            STRIPE_R: 74,
            STRIPE_G: 119,
            STRIPE_B: 143,
            STRIPE_A: 68,
            STRIPE_ANGLE: 45,
            STRIPE_GAP: 64,
            STRIPE_WIDTH: 18
        },
        {
            SELKY: "DEF_CONTEXT_BLUE",
            SELTX: "Context 기본 효과",
            EFFTY: "CONTEXT",
            BORDER_R: 0,
            BORDER_G: 132,
            BORDER_B: 255,
            BORDER_A: 100,
            BORDER_NEON: "",
            FILL_R: 0,
            FILL_G: 132,
            FILL_B: 255,
            FILL_A: 16,
            STRIPE_R: 0,
            STRIPE_G: 132,
            STRIPE_B: 255,
            STRIPE_A: 0,
            STRIPE_ANGLE: 45,
            STRIPE_GAP: 32,
            STRIPE_WIDTH: 8
        },
        {
            SELKY: "DEF_CONTEXT_NEON",
            SELTX: "Context 네온 효과",
            EFFTY: "CONTEXT",
            BORDER_R: 0,
            BORDER_G: 220,
            BORDER_B: 185,
            BORDER_A: 100,
            BORDER_NEON: "X",
            FILL_R: 0,
            FILL_G: 115,
            FILL_B: 96,
            FILL_A: 28,
            STRIPE_R: 0,
            STRIPE_G: 220,
            STRIPE_B: 185,
            STRIPE_A: 0,
            STRIPE_ANGLE: 45,
            STRIPE_GAP: 32,
            STRIPE_WIDTH: 8
        }
    ];
    const TEST_PRESET_PATTERNS = [
        { EFFTY: "SELECT", SELKY: "TST_SELECT_*" },
        { EFFTY: "CONTEXT", SELKY: "TST_CONTEXT_*" }
    ];

    let oDb;
    let sDbPath;

    function msgText(cls, no) {

        const oAPP = global.OptionPopupUtil?.getApp?.();
        const aParams = Array.prototype.slice.call(arguments, 2);

        if (!cls || !no) {
            return "";
        }

        if (typeof global.OptionPopupUtil?.getMsgClsText === "function") {
            return global.OptionPopupUtil.getMsgClsText(
                cls,
                no,
                aParams[0] || "",
                aParams[1] || "",
                aParams[2] || "",
                aParams[3] || ""
            );
        }

        const sMissingText = cls && no ? `${cls} ${no}` : "";

        if (typeof oAPP?.common?.fnGetMsgClsText !== "function") {
            return sMissingText;
        }

        try {
            return oAPP.common.fnGetMsgClsText(
                cls,
                no,
                aParams[0] || "",
                aParams[1] || "",
                aParams[2] || "",
                aParams[3] || ""
            ) || sMissingText;
        } catch (error) {
            return sMissingText;
        }

    }

    function text(key) {

        const aMsg = MSG[key];

        if (!aMsg) {
            return key || "";
        }

        return msgText.apply(null, aMsg);

    }

    function getDb() {

        if (oDb) {
            return oDb;
        }

        const oUtil = global.OptionPopupUtil;
        const oPath = oUtil.getPath();
        const oFs = oUtil.getFs();
        const sFolder = oPath.join(oUtil.getP13nRoot(), "selectionEffect");

        if (oFs.existsSync(sFolder) === false) {
            oFs.mkdirSync(sFolder, { recursive: true });
        }

        sDbPath = oPath.join(sFolder, "SELECTION_EFFECT.db");

        const Database = oUtil.requireModule("better-sqlite3");
        oDb = new Database(sDbPath);

        createTables();
        seedDefaultPresets();
        removeTestPresets();

        return oDb;

    }

    function createTables() {

        oDb.exec(`
            CREATE TABLE IF NOT EXISTS ${MAP_TABLE} (
                SYSID TEXT NOT NULL,
                EFFTY TEXT NOT NULL,
                SELKY TEXT NOT NULL,
                PRIMARY KEY (SYSID, EFFTY)
            );

            CREATE TABLE IF NOT EXISTS ${DETAIL_TABLE} (
                SELKY TEXT NOT NULL PRIMARY KEY,
                SELTX TEXT NOT NULL,
                EFFTY TEXT NOT NULL,
                IS_DEFAULT TEXT DEFAULT '',
                BORDER_R INTEGER DEFAULT 0,
                BORDER_G INTEGER DEFAULT 0,
                BORDER_B INTEGER DEFAULT 0,
                BORDER_A INTEGER DEFAULT 100,
                BORDER_NEON TEXT DEFAULT '',
                FILL_R INTEGER DEFAULT 0,
                FILL_G INTEGER DEFAULT 0,
                FILL_B INTEGER DEFAULT 0,
                FILL_A INTEGER DEFAULT 0,
                STRIPE_R INTEGER DEFAULT 0,
                STRIPE_G INTEGER DEFAULT 0,
                STRIPE_B INTEGER DEFAULT 0,
                STRIPE_A INTEGER DEFAULT 0,
                STRIPE_ANGLE INTEGER DEFAULT 45,
                STRIPE_GAP INTEGER DEFAULT 32,
                STRIPE_WIDTH INTEGER DEFAULT 8,
                CRTDT TEXT DEFAULT '',
                CHGDT TEXT DEFAULT ''
            );
        `);

        const oVersion = oDb.prepare("PRAGMA user_version").get();

        if ((oVersion?.user_version || 0) < 1) {
            oDb.exec("PRAGMA user_version = 1");
        }

    }

    function now() {

        const oDate = new Date();
        const pad = function (value) {
            return String(value).padStart(2, "0");
        };

        return String(oDate.getFullYear()) +
            pad(oDate.getMonth() + 1) +
            pad(oDate.getDate()) +
            pad(oDate.getHours()) +
            pad(oDate.getMinutes()) +
            pad(oDate.getSeconds());

    }

    function seedDefaultPresets() {

        const sNow = now();
        const oStmt = oDb.prepare(`
            INSERT OR IGNORE INTO ${DETAIL_TABLE} (
                SELKY, SELTX, EFFTY, IS_DEFAULT,
                BORDER_R, BORDER_G, BORDER_B, BORDER_A, BORDER_NEON,
                FILL_R, FILL_G, FILL_B, FILL_A,
                STRIPE_R, STRIPE_G, STRIPE_B, STRIPE_A,
                STRIPE_ANGLE, STRIPE_GAP, STRIPE_WIDTH,
                CRTDT, CHGDT
            ) VALUES (
                @SELKY, @SELTX, @EFFTY, 'X',
                @BORDER_R, @BORDER_G, @BORDER_B, @BORDER_A, @BORDER_NEON,
                @FILL_R, @FILL_G, @FILL_B, @FILL_A,
                @STRIPE_R, @STRIPE_G, @STRIPE_B, @STRIPE_A,
                @STRIPE_ANGLE, @STRIPE_GAP, @STRIPE_WIDTH,
                @CRTDT, @CHGDT
            )
        `);

        const oTx = oDb.transaction(function () {
            DEFAULT_PRESETS.forEach(function (preset) {
                oStmt.run(Object.assign({ CRTDT: sNow, CHGDT: sNow }, preset));
            });
        });

        oTx();

    }

    function removeTestPresets() {

        const oDefaultStmt = oDb.prepare(`
            SELECT SELKY
              FROM ${DETAIL_TABLE}
             WHERE EFFTY = ?
               AND IS_DEFAULT = 'X'
             ORDER BY CRTDT, SELKY
             LIMIT 1
        `);
        const oUpdateMapStmt = oDb.prepare(`
            UPDATE ${MAP_TABLE}
               SET SELKY = ?
             WHERE EFFTY = ?
               AND SELKY GLOB ?
        `);
        const oDeleteMapStmt = oDb.prepare(`
            DELETE FROM ${MAP_TABLE}
             WHERE EFFTY = ?
               AND SELKY GLOB ?
        `);
        const oDeleteDetailStmt = oDb.prepare(`
            DELETE FROM ${DETAIL_TABLE}
             WHERE EFFTY = ?
               AND SELKY GLOB ?
        `);

        const oTx = oDb.transaction(function () {
            TEST_PRESET_PATTERNS.forEach(function (rule) {

                const oDefault = oDefaultStmt.get(rule.EFFTY);

                if (oDefault) {
                    oUpdateMapStmt.run(oDefault.SELKY, rule.EFFTY, rule.SELKY);
                } else {
                    oDeleteMapStmt.run(rule.EFFTY, rule.SELKY);
                }

                oDeleteDetailStmt.run(rule.EFFTY, rule.SELKY);

            });
        });

        oTx();

    }

    function getEffectTypes() {

        getDb();
        return EFFECT_TYPES.slice();

    }

    function getPresets(effty) {

        return getDb().prepare(`
            SELECT *
              FROM ${DETAIL_TABLE}
             WHERE EFFTY = ?
             ORDER BY CASE WHEN IS_DEFAULT = 'X' THEN 0 ELSE 1 END, CRTDT, SELTX
        `).all(effty);

    }

    function getPreset(selky) {

        return getDb().prepare(`
            SELECT *
              FROM ${DETAIL_TABLE}
             WHERE SELKY = ?
        `).get(selky);

    }

    function getDefaultPreset(effty) {

        return getDb().prepare(`
            SELECT *
              FROM ${DETAIL_TABLE}
             WHERE EFFTY = ?
               AND IS_DEFAULT = 'X'
             ORDER BY CRTDT, SELKY
             LIMIT 1
        `).get(effty);

    }

    function getMapping(sysid, effty) {

        return getDb().prepare(`
            SELECT *
              FROM ${MAP_TABLE}
             WHERE SYSID = ?
               AND EFFTY = ?
        `).get(sysid, effty);

    }

    function saveMapping(sysid, effty, selky) {

        return getDb().prepare(`
            INSERT INTO ${MAP_TABLE} (SYSID, EFFTY, SELKY)
            VALUES (?, ?, ?)
            ON CONFLICT(SYSID, EFFTY) DO UPDATE SET
                SELKY = excluded.SELKY
        `).run(sysid, effty, selky);

    }

    function normalizeDetail(detail) {

        const oResult = {};
        const aFields = [
            "BORDER_R", "BORDER_G", "BORDER_B", "BORDER_A",
            "FILL_R", "FILL_G", "FILL_B", "FILL_A",
            "STRIPE_R", "STRIPE_G", "STRIPE_B", "STRIPE_A",
            "STRIPE_ANGLE", "STRIPE_GAP", "STRIPE_WIDTH"
        ];

        aFields.forEach(function (field) {
            oResult[field] = Number(detail[field]) || 0;
        });

        oResult.BORDER_NEON = detail.BORDER_NEON === "X" || detail.BORDER_NEON === true ? "X" : "";

        return oResult;

    }

    function makeCustomKey(effty) {

        const oCrypto = global.OptionPopupUtil.requireModule("crypto");

        for (let i = 0; i < 20; i += 1) {

            const sKey = `USR_${effty}_${Date.now()}_${oCrypto.randomBytes(3).toString("hex").toUpperCase()}`;

            if (!getPreset(sKey)) {
                return sKey;
            }

        }

        throw new Error(text("CUSTOM_KEY_FAILED"));

    }

    function saveCustomPresetAndMapping(sysid, effty, seltx, detail) {

        const oDetail = normalizeDetail(detail);
        const sNow = now();
        const sSelky = makeCustomKey(effty);

        const oTx = getDb().transaction(function () {

            getDb().prepare(`
                INSERT INTO ${DETAIL_TABLE} (
                    SELKY, SELTX, EFFTY, IS_DEFAULT,
                    BORDER_R, BORDER_G, BORDER_B, BORDER_A, BORDER_NEON,
                    FILL_R, FILL_G, FILL_B, FILL_A,
                    STRIPE_R, STRIPE_G, STRIPE_B, STRIPE_A,
                    STRIPE_ANGLE, STRIPE_GAP, STRIPE_WIDTH,
                    CRTDT, CHGDT
                ) VALUES (
                    @SELKY, @SELTX, @EFFTY, '',
                    @BORDER_R, @BORDER_G, @BORDER_B, @BORDER_A, @BORDER_NEON,
                    @FILL_R, @FILL_G, @FILL_B, @FILL_A,
                    @STRIPE_R, @STRIPE_G, @STRIPE_B, @STRIPE_A,
                    @STRIPE_ANGLE, @STRIPE_GAP, @STRIPE_WIDTH,
                    @CRTDT, @CHGDT
                )
            `).run(Object.assign({}, oDetail, {
                SELKY: sSelky,
                SELTX: seltx,
                EFFTY: effty,
                CRTDT: sNow,
                CHGDT: sNow
            }));

            saveMapping(sysid, effty, sSelky);

        });

        oTx();

        return getPreset(sSelky);

    }

    function updateUserPresetAndMapping(sysid, effty, selky, detail) {

        const oPreset = getPreset(selky);

        if (!oPreset) {
            throw new Error(text("PRESET_NOT_FOUND"));
        }

        if (oPreset.IS_DEFAULT === "X" || oPreset.IS_DEFAULT === true) {
            throw new Error(text("DEFAULT_PRESET_UPDATE_BLOCKED"));
        }

        const oDetail = normalizeDetail(detail);
        const sNow = now();

        const oTx = getDb().transaction(function () {

            getDb().prepare(`
                UPDATE ${DETAIL_TABLE}
                   SET BORDER_R = @BORDER_R,
                       BORDER_G = @BORDER_G,
                       BORDER_B = @BORDER_B,
                       BORDER_A = @BORDER_A,
                       BORDER_NEON = @BORDER_NEON,
                       FILL_R = @FILL_R,
                       FILL_G = @FILL_G,
                       FILL_B = @FILL_B,
                       FILL_A = @FILL_A,
                       STRIPE_R = @STRIPE_R,
                       STRIPE_G = @STRIPE_G,
                       STRIPE_B = @STRIPE_B,
                       STRIPE_A = @STRIPE_A,
                       STRIPE_ANGLE = @STRIPE_ANGLE,
                       STRIPE_GAP = @STRIPE_GAP,
                       STRIPE_WIDTH = @STRIPE_WIDTH,
                       CHGDT = @CHGDT
                 WHERE SELKY = @SELKY
                   AND IFNULL(IS_DEFAULT, '') <> 'X'
            `).run(Object.assign({}, oDetail, {
                SELKY: selky,
                CHGDT: sNow
            }));

            saveMapping(sysid, effty, selky);

        });

        oTx();

        return getPreset(selky);

    }

    function renameUserPreset(selky, seltx) {

        const oPreset = getPreset(selky);

        if (!oPreset) {
            throw new Error(text("PRESET_NOT_FOUND"));
        }

        if (oPreset.IS_DEFAULT === "X" || oPreset.IS_DEFAULT === true) {
            throw new Error(text("DEFAULT_PRESET_UPDATE_BLOCKED"));
        }

        getDb().prepare(`
            UPDATE ${DETAIL_TABLE}
               SET SELTX = ?,
                   CHGDT = ?
             WHERE SELKY = ?
               AND IFNULL(IS_DEFAULT, '') <> 'X'
        `).run(seltx, now(), selky);

        return getPreset(selky);

    }

    function deletePresetAndUseDefault(sysid, effty, selky) {

        const oPreset = getPreset(selky);

        if (!oPreset) {
            return getDefaultPreset(effty);
        }

        if (oPreset.IS_DEFAULT === "X" || oPreset.IS_DEFAULT === true) {
            throw new Error(text("DEFAULT_PRESET_DELETE_BLOCKED"));
        }

        const oDefault = getDefaultPreset(effty);

        const oTx = getDb().transaction(function () {

            getDb().prepare(`DELETE FROM ${DETAIL_TABLE} WHERE SELKY = ?`).run(selky);

            if (oDefault) {
                getDb().prepare(`
                    UPDATE ${MAP_TABLE}
                       SET SELKY = ?
                     WHERE EFFTY = ?
                       AND SELKY = ?
                `).run(oDefault.SELKY, effty, selky);

                saveMapping(sysid, effty, oDefault.SELKY);

            } else {
                getDb().prepare(`DELETE FROM ${MAP_TABLE} WHERE EFFTY = ? AND SELKY = ?`).run(effty, selky);
            }

        });

        oTx();

        return oDefault;

    }

    function close() {

        if (!oDb) {
            return;
        }

        oDb.close();
        oDb = null;

    }

    global.OptionPopupDB = {
        MAP_TABLE,
        DETAIL_TABLE,
        getDb,
        getDbPath: function () {
            getDb();
            return sDbPath;
        },
        getEffectTypes,
        getPresets,
        getPreset,
        getDefaultPreset,
        getMapping,
        saveMapping,
        saveCustomPresetAndMapping,
        updateUserPresetAndMapping,
        renameUserPreset,
        deletePresetAndUseDefault,
        close
    };

})(window);
