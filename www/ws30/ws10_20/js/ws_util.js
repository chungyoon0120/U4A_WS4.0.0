/**
 * @file ws_util.js
 * @description
 * WS 솔루션 공통 유틸리티 모듈.
 * Electron Renderer 프로세스에서 사용되며, 아래 기능들을 제공합니다.
 *
 *  - IndexDB       : 브라우저 내장 IndexedDB CRUD 헬퍼
 *  - MessageClassText  : SAP 다국어 메시지 조회 (레거시 래퍼)
 *  - MessageDatabase   : SQLite 기반 메시지 조회 (현행)
 *  - MONACO_EDITOR : Monaco Editor 테마 관리
 *  - EXE_BROWSER   : 브라우저 설치 경로 레지스트리 조회
 *  - QueryString   : URL QueryString ↔ Object 변환
 *  - Registry 유틸  : Windows 레지스트리 읽기/쓰기
 *  - FileSystem 유틸: fs-extra 기반 파일 I/O 래퍼
 *  - 기타 공통 유틸  : 테마, 창 배치, 메시지박스 등
 *
 * ⚠️  이 파일은 공통 UTIL이므로 로직 변경 시 반드시 검증 후 반영하십시오.
 */

"use strict";

/*==========================================================================
 * [Section 1] 의존성 모듈 로드
 *==========================================================================*/

const
    REMOTE   = require('@electron/remote'),
    FS       = require('fs-extra'),
    ZIPLIB   = require("zip-lib"),
    PATH     = REMOTE.require('path'),
    APP      = REMOTE.app,
    APPPATH  = APP.getAppPath(),
    PATHINFO = require(PATH.join(APPPATH, "ws30", "resources", "pathInfo.js")),
    REGEDIT  = require('regedit'),
    USERDATA = APP.getPath("userData");

// const SQLITE3 = require('sqlite3').verbose();
const BETTER_SQLITE3 = require('better-sqlite3');
const QS             = require('qs');

/*==========================================================================
 * [Section 2] regedit VBS 경로 설정 (외부 VBS 사용)
 *==========================================================================*/

const vbsDirectory = PATH.join(PATH.dirname(APP.getPath('exe')), 'resources/regedit/vbs');
REGEDIT.setExternalVBSLocation(vbsDirectory);

/*==========================================================================
 * [Section 3] 현재 Window / WebPreferences / USERINFO 초기화
 *==========================================================================*/

const CURRWIN  = REMOTE.getCurrentWindow();
const WEBCON   = CURRWIN.webContents;
const WEBPREF  = WEBCON.getWebPreferences();

var USERINFO = WEBPREF.USERINFO;

// 현재 문서의 QueryString에서 USERINFO를 추출하여 우선 적용
const oQueryParams = QS.parse(location.href, { ignoreQueryPrefix: true });

let oUserInfo = oQueryParams?.USERINFO || undefined;
if (oUserInfo) {
    USERINFO = oUserInfo;
}

process.USERINFO = USERINFO;

// process.USERINFO가 없으면 부모 프레임에서 가져옴
if (!process.USERINFO) {
    process.USERINFO = parent.getUserInfo && parent.getUserInfo();
}


/*==========================================================================
 * [Section 4] WSUTIL 메인 객체 정의
 *==========================================================================*/

const WSUTIL = {

    /*========================================================================
     * [Class] IndexDB
     * 브라우저 내장 IndexedDB에 대한 공통 CRUD 헬퍼 클래스.
     * 모든 메서드는 static이며, Promise를 반환합니다.
     * 리턴 구조: { RETCD: "S"|"E", PRCCD: "", RTMSG: "", RDATA: "" }
     *========================================================================*/
    IndexDB: class {

        /*--------------------------------------------------------------------
         * @method getResInfo
         * @description 공통 리턴 구조 객체를 생성하여 반환합니다.
         * @returns {{ RETCD: string, PRCCD: string, RTMSG: string, RDATA: string }}
         *--------------------------------------------------------------------*/
        static getResInfo() {
            return {
                RETCD: "",
                PRCCD: "",
                RTMSG: "",
                RDATA: "",
            };
        }

        /*--------------------------------------------------------------------
         * @method _resolveErrMsg (내부 헬퍼)
         * @description 에러 코드에 대응하는 한국어 메시지를 반환합니다.
         *              createIndexDB / insert 공통 switch-case 중복을 제거합니다.
         *
         * @param {string} sPrcCd  - 에러 처리 코드 (예: "E01", "E03")
         * @param {string} sContext - 호출 컨텍스트 ("create" | "insert")
         * @returns {string} 에러 메시지
         *--------------------------------------------------------------------*/
        static _resolveErrMsg(sPrcCd, sContext) {

            // createIndexDB, insert 공통 메시지
            const _oCommonMsgs = {
                "E01": "Parameter가 없습니다.",
                "E02": "Parameter 가 Object 타입이 아닙니다",
                "E03": "'DB_NAME' 파라미터가 없거나 String 타입이 아닙니다.",
                "E04": "'TABLE_NAME' 파라미터가 없거나 String 타입이 아닙니다",
            };

            // insert 전용 메시지
            const _oInsertMsgs = {
                "E05": "'DATA' 파라미터가 없거나 Array 타입이 아닙니다",
                "E06": "'KEY' 파라미터가 없거나 String 타입이 아닙니다",
            };

            // createIndexDB 전용 메시지
            const _oCreateMsgs = {
                "E05": "버전 파라미터는 숫자타입만 가능합니다.",
            };

            const _oContextMsgs = (sContext === "insert") ? _oInsertMsgs : _oCreateMsgs;

            return _oCommonMsgs[sPrcCd] || _oContextMsgs[sPrcCd] || "알 수 없는 오류입니다.";

        } // end of static _resolveErrMsg


        /*--------------------------------------------------------------------
         * @method createIndexDB
         * @description IndexedDB 데이터베이스 및 ObjectStore(테이블)를 생성합니다.
         *              ObjectStore가 존재하지 않으면 버전을 올려 재생성을 시도합니다.
         *
         * @param {Object} oParams
         * @param {string}  oParams.DB_NAME    - 데이터베이스 이름 (* 필수)
         * @param {string}  oParams.TABLE_NAME - ObjectStore 이름 (* 필수)
         * @param {number} [oParams.VER]       - 데이터베이스 버전 (옵션, 기본값: 1)
         * @returns {Promise<{ RETCD: string, RTMSG: string, RDATA: * }>}
         *--------------------------------------------------------------------*/
        static createIndexDB(oParams) {

            var that = this;

            return new Promise((resolve) => {

                let _oRES  = that.getResInfo();
                _oRES.RETCD = "E"; // 기본값 E로 시작

                // 파라미터 유효성 검사
                let _oCheckResult = that._checkCreateIndexDbParams(oParams);
                if (_oCheckResult.RETCD === "E") {

                    let _sErrMsg = that._resolveErrMsg(_oCheckResult.PRCCD, "create");

                    console.error(_sErrMsg);

                    _oRES.RETCD = "E";
                    _oRES.RTMSG = _sErrMsg;

                    return resolve(_oRES);
                }

                let _sDbName = oParams.DB_NAME;
                let _sTbName = oParams.TABLE_NAME;
                let _iVer    = oParams.VER || 1;

                let _oRequest = indexedDB.open(_sDbName, _iVer);

                // DB 오픈 성공 시: ObjectStore 존재 여부 확인
                _oRequest.onsuccess = async function (oEvent) {

                    const _oDatabase = _oRequest.result;

                    let _bIsExists = _oDatabase.objectStoreNames.contains(_sTbName);
                    if (!_bIsExists) {

                        // ObjectStore 미존재 시 버전을 올려 onupgradeneeded 재트리거
                        _oDatabase.close();

                        oParams.VER = _oDatabase.version + 1;

                        return resolve(await that.createIndexDB(oParams));
                    }

                    _oDatabase.close();

                    _oRES.RETCD = "S";
                    _oRES.RDATA = oEvent;

                    return resolve(_oRES);
                };

                // DB 버전 업그레이드 시: ObjectStore 생성
                _oRequest.onupgradeneeded = function () {

                    const _oDatabase = _oRequest.result;
                    _oDatabase.createObjectStore(_sTbName, { autoIncrement: true });

                };

                // DB 오픈 실패 시
                _oRequest.onerror = (error) => {

                    console.error(error);

                    _oRES.RETCD = "E";
                    _oRES.RTMSG = error?.target?.error?.toString() || "";

                    return resolve(_oRES);
                };

            });

        } // end of static createIndexDB


        /*--------------------------------------------------------------------
         * @method _checkCreateIndexDbParams (내부 유효성 검사)
         * @description createIndexDB 파라미터 타입 및 필수값을 검사합니다.
         *
         * @param {Object} oParams - createIndexDB 파라미터
         * @returns {{ RETCD: string, PRCCD: string }}
         *--------------------------------------------------------------------*/
        static _checkCreateIndexDbParams(oParams) {

            let _oRES = this.getResInfo();

            if (!oParams) {
                _oRES.RETCD = "E"; _oRES.PRCCD = "E01";
                return _oRES;
            }

            if (!oParams.constructor.toString().includes("Object")) {
                _oRES.RETCD = "E"; _oRES.PRCCD = "E02";
                return _oRES;
            }

            if (!oParams.DB_NAME || typeof oParams.DB_NAME !== "string") {
                _oRES.RETCD = "E"; _oRES.PRCCD = "E03";
                return _oRES;
            }

            if (!oParams.TABLE_NAME || typeof oParams.TABLE_NAME !== "string") {
                _oRES.RETCD = "E"; _oRES.PRCCD = "E04";
                return _oRES;
            }

            // VER는 옵션이지만, 전달된 경우 숫자 타입이어야 함
            if (oParams.VER && oParams.VER.constructor.name !== "Number") {
                _oRES.RETCD = "E"; _oRES.PRCCD = "E05";
                return _oRES;
            }

            _oRES.RETCD = "S";
            return _oRES;

        } // end of static _checkCreateIndexDbParams


        /*--------------------------------------------------------------------
         * @method insert
         * @description IndexedDB ObjectStore에 데이터를 삽입합니다.
         *
         * @param {Object} oParams
         * @param {string}   oParams.DB_NAME    - 데이터베이스 이름 (* 필수)
         * @param {string}   oParams.TABLE_NAME - ObjectStore 이름 (* 필수)
         * @param {Array}    oParams.DATA       - 삽입할 데이터 (* 필수)
         * @param {string}  [oParams.KEY]       - 키 값 (옵션)
         * @returns {Promise<{ RETCD: string, RTMSG: string, RDATA: * }>}
         *--------------------------------------------------------------------*/
        static insert(oParams) {

            var that = this;

            return new Promise(async (resolve) => {

                let _oRES  = that.getResInfo();
                _oRES.RETCD = "E"; // 기본값 E로 시작

                // 파라미터 유효성 검사
                let _oCheckResult = that._checkInsertParams(oParams);
                if (_oCheckResult.RETCD === "E") {

                    let _sErrMsg = that._resolveErrMsg(_oCheckResult.PRCCD, "insert");

                    console.error(_sErrMsg);

                    _oRES.RETCD = "E";
                    _oRES.RTMSG = _sErrMsg;

                    return resolve(_oRES);
                }

                let _sDbName      = oParams.DB_NAME;
                let _sTbName      = oParams.TABLE_NAME;
                let _sKey         = oParams.KEY;
                let _aInsertData  = oParams.DATA;

                // 데이터베이스 오픈
                let _oDbResult = await that._openDatabase(_sDbName);
                if (_oDbResult.RETCD === "E") {

                    console.error(_oDbResult.RTMSG);

                    _oRES.RETCD = "E";
                    _oRES.RTMSG = _oDbResult.RTMSG;

                    return resolve(_oRES);
                }

                let _oDatabase = _oDbResult.RDATA;

                try {

                    const _oTransaction = _oDatabase.transaction(_sTbName, 'readwrite');

                    // 트랜잭션 완료(성공)시 발생 - 실패 시에는 타지 않음
                    _oTransaction.oncomplete = function () {
                        _oDatabase.close();
                        return resolve(_oRES);
                    };

                    const _oStore = _oTransaction.objectStore(_sTbName);

                    // KEY가 있으면 key와 함께, 없으면 autoIncrement로 삽입
                    var _oREQ = _sKey
                        ? _oStore.add(_aInsertData, _sKey)
                        : _oStore.add(_aInsertData);

                    _oREQ.onsuccess = function (event) {
                        _oRES.RETCD = "S";
                        _oRES.RDATA = event.target.result || "";
                    };

                    _oREQ.onerror = function (event) {

                        _oDatabase.close();

                        _oRES.RETCD = "E";

                        let _sErrMsg = event?.target?.error?.toString
                            ? event.target.error.toString()
                            : "";

                        _oRES.RTMSG = _sErrMsg || "Insert Error!!";

                        return resolve(_oRES);
                    };

                } catch (error) {

                    _oDatabase.close();

                    _oRES.RETCD = "E";
                    _oRES.RTMSG = error ? error.toString() : "Insert Error!!";

                    return resolve(_oRES);
                }

            });

        } // end of static insert


        /*--------------------------------------------------------------------
         * @method _openDatabase (내부 헬퍼)
         * @description 이름으로 IndexedDB를 오픈하고 DB 인스턴스를 반환합니다.
         *
         * @param {string} _sDbName - 열 데이터베이스 이름
         * @returns {Promise<{ RETCD: string, RDATA?: IDBDatabase, RTMSG?: string }>}
         *--------------------------------------------------------------------*/
        static _openDatabase(_sDbName) {

            return new Promise((resolve) => {

                var oDb = indexedDB.open(_sDbName, 1);

                oDb.onsuccess = function () {
                    return resolve({ RETCD: "S", RDATA: oDb.result });
                };

                oDb.onerror = function (error) {
                    return resolve({ RETCD: "E", RTMSG: error });
                };

            });

        } // end of static _openDatabase


        /*--------------------------------------------------------------------
         * @method _checkInsertParams (내부 유효성 검사)
         * @description insert 파라미터 타입 및 필수값을 검사합니다.
         *
         * @param {Object} oParams - insert 파라미터
         * @returns {{ RETCD: string, PRCCD: string }}
         *--------------------------------------------------------------------*/
        static _checkInsertParams(oParams) {

            let _oRES = this.getResInfo();

            if (!oParams) {
                _oRES.RETCD = "E"; _oRES.PRCCD = "E01";
                return _oRES;
            }

            if (!oParams.constructor.toString().includes("Object")) {
                _oRES.RETCD = "E"; _oRES.PRCCD = "E02";
                return _oRES;
            }

            if (!oParams.DB_NAME || typeof oParams.DB_NAME !== "string") {
                _oRES.RETCD = "E"; _oRES.PRCCD = "E03";
                return _oRES;
            }

            if (!oParams.TABLE_NAME || typeof oParams.TABLE_NAME !== "string") {
                _oRES.RETCD = "E"; _oRES.PRCCD = "E04";
                return _oRES;
            }

            if (!oParams.DATA || !Array.isArray(oParams.DATA)) {
                _oRES.RETCD = "E"; _oRES.PRCCD = "E05";
                return _oRES;
            }

            // KEY는 옵션이지만, 전달된 경우 string 타입이어야 함
            if (oParams.KEY && typeof oParams.KEY !== "string") {
                _oRES.RETCD = "E"; _oRES.PRCCD = "E06";
                return _oRES;
            }

            _oRES.RETCD = "S";
            return _oRES;

        } // end of static _checkInsertParams

        // 미구현 메서드 (향후 구현 예정)
        static read()      { /* TODO */ }
        static readAll()   { /* TODO */ }
        static delete()    { /* TODO */ }
        static deleteAll() { /* TODO */ }

    },
    /************** end of Class (IndexDB) ***************/


    /*========================================================================
     * [Class] MessageClassText
     * 접속 언어별 다국어 메시지를 제공하는 클래스.
     * 내부적으로 WSUTIL.getWsMsgClsTxt 를 호출하여 SQLite에서 텍스트를 조회합니다.
     *========================================================================*/
    /**
     * @class MessageClassText
     */
    MessageClassText: class {

        /**
         * @constructor
         * @param {string} pSysID - 접속 시스템 ID (* 필수)
         * @param {string} pLangu - 접속 언어 키 (예: 'KO', 'EN') (* 필수)
         */
        constructor(pSysID, pLangu) {

            if (!pSysID) throw new Error("System ID is require!");
            if (!pLangu) throw new Error("Language is require!");

            this.SYSID = pSysID;
            this.LANGU = pLangu;

            // 로그인한 사용자의 언어 정보가 있으면 최우선 적용
            if (parent?.process?.USERINFO?.LANGU) {
                this.LANGU = parent.process.USERINFO.LANGU;
            }

        }

        /**
         * 메시지 클래스명과 번호로 텍스트를 조회합니다.
         * "&1", "&2" ... "&4" 치환 파라미터를 지원합니다.
         *
         * @param {string} sMsgCls - 메시지 클래스 명 (예: "ZMSG_WS_COMMON_001")
         * @param {string} sMsgNum - 메시지 번호 (예: "047")
         * @param {string} [p1]    - 치환 파라미터 1
         * @param {string} [p2]    - 치환 파라미터 2
         * @param {string} [p3]    - 치환 파라미터 3
         * @param {string} [p4]    - 치환 파라미터 4
         * @returns {string} 치환된 메시지 텍스트
         * @public
         */
        fnGetMsgClsText(sMsgCls, sMsgNum, p1, p2, p3, p4) {

            let sLangu = this.LANGU;
            return WSUTIL.getWsMsgClsTxt(sLangu, sMsgCls, sMsgNum, p1, p2, p3, p4);

        } // end of fnGetMsgClsText

    },
    /************** end of Class (MessageClassText) ***************/


    /*========================================================================
     * [Class] MessageDatabase
     * SQLite(better-sqlite3) 기반의 메시지 클래스 조회 클래스.
     * Prepared Statement 캐싱으로 성능을 최적화합니다.
     *========================================================================*/
    //#region SQLite 기반의 MessageClass

    /**
     * @class MessageDatabase
     */
    MessageDatabase: class {

        /**
         * @constructor
         * @param {string} dbFilePath - SQLite 데이터베이스 파일 경로
         */
        constructor(dbFilePath) {

            // better-sqlite3는 생성자에서 즉시 동기적으로 DB를 오픈합니다.
            this.db = new BETTER_SQLITE3(dbFilePath, { readonly: true });

            // 성능 최적화: SQL을 미리 컴파일(Prepare)하여 반복 호출 비용을 줄입니다.
            this.messageStmt = this.db.prepare(`
                SELECT 
                    ARBGB, 
                    MSGNR, 
                    TEXT, 
                    LTEXT 
                FROM MESSAGE_CLASS_TEXTS 
                WHERE ARBGB = ? 
                AND MSGNR = ?
            `);

        }

        /**
         * 특정 메시지 1건을 동기 방식으로 조회합니다.
         * 호출처에서 await를 쓸 필요가 없습니다.
         *
         * @param {string} arbgb - 메시지 클래스 ID
         * @param {string} msgnr - 메시지 번호
         * @returns {Object|null} 조회된 행 또는 null
         */
        getMessageClassRow(arbgb, msgnr) {

            try {

                const params = [
                    String(arbgb).trim(),
                    String(msgnr).trim().padStart(3, '0')
                ];

                // .get()은 즉시 결과를 동기적으로 리턴합니다.
                const row = this.messageStmt.get(...params);
                return row || null;

            } catch (error) {
                console.error("Database Error:", error);
                return null;
            }

        }

        /**
         * DB 연결을 명시적으로 닫습니다. (일반적으로는 불필요)
         */
        close() {
            if (this.db) {
                this.db.close();
            }
        }

    },
    //#endregion
    /************** end of Class (MessageDatabase) ***************/


    /*========================================================================
     * [Method] showMessageBox
     * SAP MessageBox를 TYPE 코드에 따라 표시합니다.
     *
     * @param {Object} sap     - SAP UI5 글로벌 객체
     * @param {Object} pOptions
     * @param {string}  pOptions.TYPE - 메시지 타입 "I"(info) | "S"(success) | "W"(warning) | "E"(error)
     * @param {string}  pOptions.MSG  - 표시할 메시지 텍스트
     * @param {*}       pOptions.*    - sap.m.MessageBox 옵션 (title, actions, onClose 등)
     *========================================================================*/
    showMessageBox: function (sap, pOptions) {

        if (!sap?.m?.MessageBox) {
            sap.ui.requireSync("sap/m/MessageBox");
        }

        let oDefaultOptions = {
            icon:             sap.m.MessageBox.Icon.NONE,
            title:            "",
            actions:          sap.m.MessageBox.Action.OK,
            emphasizedAction: sap.m.MessageBox.Action.OK,
            onClose:          null,
            styleClass:       "",
            initialFocus:     null,
            textDirection:    sap.ui.core.TextDirection.Inherit
        };

        let oOptions = Object.assign({}, oDefaultOptions, pOptions);
        let sType    = oOptions.TYPE || "I";

        switch (sType) {
            case "I": sap.m.MessageBox.information(oOptions.MSG || "", oOptions); break;
            case "S": sap.m.MessageBox.success(oOptions.MSG || "", oOptions);     break;
            case "W": sap.m.MessageBox.warning(oOptions.MSG || "", oOptions);     break;
            case "E": sap.m.MessageBox.error(oOptions.MSG || "", oOptions);       break;
            default:  sap.m.MessageBox.show(oOptions.MSG || "", oOptions);        break;
        }

    },
    // end of showMessageBox


    /*========================================================================
     * [Method] getThemeBackgroundColor
     * SAP 테마 이름에 대응하는 배경 색상 Hex 코드를 반환합니다.
     *
     * @param {string} sTheme - SAP 테마 키 (예: "sap_horizon_dark")
     * @returns {string} 배경색 Hex 코드
     *========================================================================*/
    getThemeBackgroundColor: function (sTheme) {

        const _oThemeColorMap = {
            "sap_belize_plus":   "#fafafa",
            "sap_horizon_dark":  "#12171c",
            "sap_horizon":       "#f5f6f7",
            "sap_belize":        "#fafafa",
            "sap_fiori_3":       "#f7f7f7",
            "sap_fiori_3_dark":  "#1c2228",
            // 현재 5종 테마 키(부트스트랩 데모 스킨 --sl-bg 와 일치) — 첫 페인트 흰색 깜빡임 방지.
            // (구 맵엔 sap_* 키만 있어 horizon_* 는 #ffffff 로 떨어져 흰 깜빡임 발생했음)
            "horizon_white":     "#ffffff",
            "horizon_dark":      "#161d26",
            "horizon_purple":    "#f6f2fe",
            "horizon_red":       "#fdf4f4",
            "horizon_green":     "#f1faf4",
            "horizon_xp":        "#ece9d8",
            "horizon_95":        "#c0c0c0",
            "horizon_7":         "#f0f0f0",
            "horizon_signature": "#eef2f7",
        };

        return _oThemeColorMap[sTheme] || "#ffffff";

    },
    // end of getThemeBackgroundColor


    /*========================================================================
     * [Method] getWsThemeAsync
     * 레지스트리에서 WS Global Theme 값을 읽어 반환합니다.
     *
     * @returns {Promise<string>} 테마 키 문자열
     *========================================================================*/
    getWsThemeAsync: function () {

        return new Promise(async (resolve) => {

            let oSettings           = this.getWsSettingsInfo();
            let sRegPath            = oSettings.regPaths;
            let sGlobalSettingPath  = sRegPath.globalSettings;

            let oRegList  = await this.getRegeditList([sGlobalSettingPath]);
            let oRetData  = oRegList.RTDATA;

            if (oRegList.RETCD == "E") {
                throw new Error(oRegList.RTMSG);
            }

            let oRegValues = oRetData[sGlobalSettingPath].values;
            let oRegTheme  = oRegValues.theme;
            let sTheme     = oSettings.defaultTheme;

            // 레지스트리에 저장된 테마가 있으면 우선 적용
            if (oRegTheme) {
                sTheme = oRegTheme.value;
            }

            resolve(sTheme);

        });

    },
    // end of getWsThemeAsync


    /*========================================================================
     * [Method] getWsLanguAsync
     * 레지스트리에서 WS Global Language 값을 읽어 반환합니다.
     *
     * @returns {Promise<string>} 언어 코드 (예: "EN", "KO")
     *========================================================================*/
    getWsLanguAsync: function () {

        return new Promise(async (resolve) => {

            let oSettings           = this.getWsSettingsInfo();
            let sRegPath            = oSettings.regPaths;
            let sGlobalSettingPath  = sRegPath.globalSettings;

            let oRegList = await this.getRegeditList([sGlobalSettingPath]);
            let oRetData = oRegList.RTDATA;

            if (oRegList.RETCD == "E") {
                throw new Error(oRegList.RTMSG);
            }

            let oGlobalSettingRegData = oRetData[sGlobalSettingPath];
            let oSettingValues        = oGlobalSettingRegData.values;

            let sLangu = "EN"; // 기본 언어

            if (oSettingValues.language) {
                sLangu = oSettingValues.language.value;
            }

            resolve(sLangu);

        });

    },
    // end of getWsLanguAsync


    /*========================================================================
     * [Method] setWsLanguAsync
     * WS Global Language를 레지스트리에 저장합니다.
     *
     * @param {string} sWsLangu - 저장할 언어 코드 (예: "KO")
     * @returns {Promise<void>}
     *========================================================================*/
    setWsLanguAsync: function (sWsLangu) {

        return new Promise(async (resolve) => {

            let oSettings          = this.getWsSettingsInfo();
            let sRegPath           = oSettings.regPaths;
            let sGlobalSettingPath = sRegPath.globalSettings;

            // 저장할 레지스트리 데이터 구성
            let oRegData = {};
            oRegData[sGlobalSettingPath] = {};
            oRegData[sGlobalSettingPath]["language"] = {
                value: sWsLangu,
                type:  "REG_SZ"
            };

            await this.putRegeditValue(oRegData);

            resolve();

        });

    },
    // end of setWsLanguAsync


    /*========================================================================
     * [Method] getGlobalSettingInfo
     * 레지스트리 GlobalSettings에서 특정 key 값을 조회합니다.
     *
     * @param {string} key - 조회할 레지스트리 키 이름
     * @returns {Promise<Object|undefined>} 키에 해당하는 값 객체 또는 undefined
     *========================================================================*/
    getGlobalSettingInfo: function (key) {

        return new Promise(async (resolve) => {

            let oSettings          = this.getWsSettingsInfo();
            let sRegPath           = oSettings.regPaths;
            let sGlobalSettingPath = sRegPath.globalSettings;

            let oRegList = await this.getRegeditList([sGlobalSettingPath]);
            let oRetData = oRegList.RTDATA;

            if (oRegList.RETCD == "E") {
                throw new Error(oRegList.RTMSG);
            }

            let oGlobalSettingRegData = oRetData[sGlobalSettingPath];
            let oSettingValues        = oGlobalSettingRegData.values;

            if (!oSettingValues[key]) {
                return resolve();
            }

            return resolve(oSettingValues[key]);

        });

    },


    /*========================================================================
     * [Method] saveGlobalSettingInfo
     * 레지스트리 GlobalSettings에 key/value 쌍을 저장합니다.
     *
     * @param {string} key   - 저장할 레지스트리 키 이름
     * @param {string} value - 저장할 값
     * @returns {Promise<{ RETCD: string, RTMSG?: string }>}
     *========================================================================*/
    saveGlobalSettingInfo: function (key, value) {

        return new Promise(async (resolve) => {

            let oSettings          = this.getWsSettingsInfo();
            let sRegPath           = oSettings.regPaths;
            let sGlobalSettingPath = sRegPath.globalSettings;

            // 저장할 레지스트리 데이터 구성
            let oRegData = {};
            oRegData[sGlobalSettingPath] = {};
            oRegData[sGlobalSettingPath][key] = {
                value: value,
                type:  "REG_SZ"
            };

            try {
                await this.putRegeditValue(oRegData);
            } catch (error) {
                resolve({
                    RETCD: "E",
                    RTMSG: error?.toString() || "Register Save Error!!"
                });
                return;
            }

            resolve({ RETCD: "S" });

        });

    },


    /**
     * [원본 - 레거시 주석 보존]
     * WS 3.0 전용 메시지 리턴 (JSON 파일 기반) - 현재는 SQLite 버전으로 대체됨.
     */
    // getWsMsgClsTxt: function (LANGU, ARBGB, MSGNR, p1, p2, p3, p4) { ... }
    // (생략 - ws_util.js 원본 주석 영역)


    /*========================================================================
     * [Method] getWsMsgClsTxt
     * SQLite DB에서 언어/클래스/번호 조건으로 메시지 텍스트를 조회합니다.
     * "&1"~"&4" 및 "&" 플레이스홀더를 p1~p4 파라미터로 순차 치환합니다.
     *
     * @since   2026-04-23
     * @param {string} LANGU  - 언어 키 (예: 'KO', 'EN')
     * @param {string} ARBGB  - 메시지 클래스 ID (Application Area)
     * @param {string} MSGNR  - 메시지 번호
     * @param {string} [p1]   - 치환 파라미터 1
     * @param {string} [p2]   - 치환 파라미터 2
     * @param {string} [p3]   - 치환 파라미터 3
     * @param {string} [p4]   - 치환 파라미터 4
     * @returns {string|undefined} 최종 치환된 메시지 텍스트
     *========================================================================*/
    // getWsMsgClsTxt: function (LANGU, ARBGB, MSGNR, p1, p2, p3, p4) {

    //     // 1. 사용자 언어 정보가 있으면 최우선 적용
    //     const sLangu = parent?.process?.USERINFO?.LANGU || LANGU;

    //     // 2. 패키징 여부에 따라 DB 루트 경로 결정
    //     let ROOT_PATH = APPPATH;
    //     if (APP.isPackaged) {
    //         ROOT_PATH = process.resourcesPath + "\\www";
    //     }

    //     const dbPath = `${ROOT_PATH}\\MSG\\WS_COMMON\\${sLangu}\\MESSAGE_CLASS.db`;

    //     // 3. SQLite 인스턴스 캐시 초기화 (언어별 1개 인스턴스 유지)
    //     this._oSqlite3 = this._oSqlite3 || {};

    //     try {

    //         if (!this._oSqlite3[sLangu]) {
    //             this._oSqlite3[sLangu] = new this.MessageDatabase(dbPath);
    //         }

    //     } catch (error) {

    //         var aConsoleMsg = [
    //             `[STACK]: ${new Error("메시지 클래스에 SQLITE 인스턴스 생성 중 오류 발생").stack}`,
    //             `=> WSUTIL.getWsMsgClsTxt`,
    //             `=> MessageDatabase`,
    //         ];

    //         console.error(aConsoleMsg.join("\r\n"), error);
    //         return;

    //     }

    //     const _sqlite3 = this._oSqlite3[sLangu];
    //     if (!_sqlite3) return;

    //     // 4. 메시지 조회
    //     try {
    //         var oFindTxt = _sqlite3.getMessageClassRow(ARBGB, MSGNR);
    //     } catch (error) {

    //         var aConsoleMsg = [
    //             `[STACK]: ${new Error("메시지 클래스에 SQLITE 인스턴스 생성 중 오류 발생").stack}`,
    //             `=> WSUTIL.getWsMsgClsTxt`,
    //             `=> _sqlite3.getMessageClassRow`,
    //         ];

    //         console.error(aConsoleMsg.join("\r\n"), error);
    //         return;
    //     }

    //     if (!oFindTxt) {
    //         // 메시지가 없으면 "클래스|번호" 형태로 반환
    //         return `${ARBGB}|${MSGNR}`;
    //     }

    //     // 5. "&1" ~ "&4" 순번 치환
    //     let sText = oFindTxt.TEXT;
    //     let aWithParam = [
    //         p1 == null ? "" : p1,
    //         p2 == null ? "" : p2,
    //         p3 == null ? "" : p3,
    //         p4 == null ? "" : p4,
    //     ];

    //     let iWithParamLenth = aWithParam.length;
    //     if (iWithParamLenth == 0) return sText;

    //     for (let i = 0; i < iWithParamLenth; i++) {
    //         let index      = i + 1;
    //         let sParamTxt  = aWithParam[i];
    //         let oRegExp    = new RegExp("&" + index, "g");
    //         sText = sText.replace(oRegExp, sParamTxt);
    //     }

    //     // "&숫자" 잔여 플레이스홀더 제거
    //     sText = sText.replace(new RegExp("&\\d+", "g"), "");

    //     // 6. "&" 잔여 플레이스홀더 순서대로 치환
    //     if (sText.includes("&")) {
    //         for (let i = 0; i < iWithParamLenth; i++) {
    //             let sParamTxt = aWithParam[i];
    //             sText = sText.replace(new RegExp("&", "i"), sParamTxt);
    //         }
    //     }

    //     sText = sText.replace(new RegExp("&", "g"), "");

    //     return sText;

    // },


    /*========================================================================
     * [Method] getWsMsgClsTxt
     * SQLite DB에서 언어/클래스/번호 조건으로 메시지 텍스트를 조회합니다.
     * "&1"~"&4" 및 "&" 플레이스홀더를 p1~p4 파라미터로 순차 치환합니다.
     *
     * @since   2026-04-23
     * @param {string} LANGU  - 언어 키 (예: 'KO', 'EN')
     * @param {string} ARBGB  - 메시지 클래스 ID (Application Area)
     * @param {string} MSGNR  - 메시지 번호
     * @param {string} [p1]   - 치환 파라미터 1
     * @param {string} [p2]   - 치환 파라미터 2
     * @param {string} [p3]   - 치환 파라미터 3
     * @param {string} [p4]   - 치환 파라미터 4
     * @returns {string|undefined} 최종 치환된 메시지 텍스트
     *========================================================================*/
    getWsMsgClsTxt: function (LANGU, ARBGB, MSGNR, p1, p2, p3, p4) {

        // 1. 사용자 언어 결정 (USERINFO 우선)
        const sLangu = parent?.process?.USERINFO?.LANGU || LANGU;

        // 2. Main 프로세스에 조회 위임
        let oFindTxt;
        try {

            oFindTxt = REMOTE.getGlobal('WsMsgCls').getRow(sLangu, ARBGB, MSGNR);

        } catch (error) {

            var aConsoleMsg = [
                `[STACK]: ${new Error("메시지 클래스 조회 중 오류 발생").stack}`,
                `=> WSUTIL.getWsMsgClsTxt`,
                `=> remote.getGlobal('WsMsgCls').getRow`,
            ];

            console.error(aConsoleMsg.join("\r\n"), error);
            return `${ARBGB}|${MSGNR}`;

        }

        // 3. 미등록 메시지 fallback
        if (!oFindTxt) {
            return `${ARBGB}|${MSGNR}`;
        }

        // 4. "&1" ~ "&4" 순번 치환
        let sText = oFindTxt.TEXT;
        let aWithParam = [
            p1 == null ? "" : p1,
            p2 == null ? "" : p2,
            p3 == null ? "" : p3,
            p4 == null ? "" : p4,
        ];

        let iWithParamLenth = aWithParam.length;
        if (iWithParamLenth == 0) return sText;

        for (let i = 0; i < iWithParamLenth; i++) {
            let index     = i + 1;
            let sParamTxt = aWithParam[i];
            let oRegExp   = new RegExp("&" + index, "g");
            sText = sText.replace(oRegExp, sParamTxt);
        }

        // "&숫자" 잔여 플레이스홀더 제거
        sText = sText.replace(new RegExp("&\\d+", "g"), "");

        // 5. "&" 잔여 플레이스홀더 순서대로 치환
        if (sText.includes("&")) {
            for (let i = 0; i < iWithParamLenth; i++) {
                let sParamTxt = aWithParam[i];
                sText = sText.replace(new RegExp("&", "i"), sParamTxt);
            }
        }

        sText = sText.replace(new RegExp("&", "g"), "");

        return sText;

    },

    closeAllMsgClsDb: function(){

        REMOTE.getGlobal('WsMsgCls').close();

    },

    /*========================================================================
     * [Method] getWsMsgClsModelData
     * 메시지 리스트를 기반으로 다국어 텍스트를 일괄 조회하여,
     * SAP JSONModel 바인딩에 최적화된 계층형 Object를 반환합니다.
     *
     * @param {Array<{ ARBGB: string, MSGNR: string }>} aMsgTxtList
     * @returns {{ RETCD: string, RTDATA?: Object }}
     * @example
     * // 입력:  [{ ARBGB: "ZMSG_WS_COMMON_001", MSGNR: "047" }]
     * // 출력:  { RETCD: "S", RTDATA: { "ZMSG_WS_COMMON_001": { "047": "텍스트" } } }
     *========================================================================*/
    getWsMsgClsModelData: function (aMsgTxtList) {

        // 1. 파라미터 유효성 검사
        if (!aMsgTxtList || !Array.isArray(aMsgTxtList) || aMsgTxtList.length === 0) {
            return { RETCD: "E", STCOD: "E000" };
        }

        // 2. 언어 키 결정: 사용자 언어 > 시스템 설정 언어
        let oSettingInfo = this.getWsSettingsInfo();
        let sWsLangu     = oSettingInfo.globalLanguage;

        if (parent?.process?.USERINFO?.LANGU) {
            sWsLangu = parent.process.USERINFO.LANGU;
        }

        let oLanguJsonData = {};

        // 3. 메시지 리스트 순회 및 데이터 가공
        for (const oMsgTxt of aMsgTxtList) {

            let sARBGB = oMsgTxt?.ARBGB || "";
            let sMSGNR = oMsgTxt?.MSGNR || "";

            if (!sARBGB || !sMSGNR) continue;

            try {
                var sText = this.getWsMsgClsTxt(sWsLangu, sARBGB, sMSGNR);
            } catch (error) {
                // 조회 오류 시 반복문 탈출 (데이터 정합성 보장)
                break;
            }

            // 4. 메시지 클래스별 그룹화
            if (!oLanguJsonData[sARBGB]) {
                oLanguJsonData[sARBGB] = {};
            }

            oLanguJsonData[sARBGB][sMSGNR] = sText;
        }

        return { RETCD: "S", RTDATA: oLanguJsonData };

    },


    // WS 3.0 전용 메시지 모델 정보 구조 (레거시, 현재 미사용)
    // getWsMsgModelData: function () { ... }


    /*========================================================================
     * [Method] getWsRegisterU4AIcons
     * SAP UI5 IconPool에 FontAwesome 아이콘을 등록합니다.
     *
     * @param {Object} sap - SAP UI5 글로벌 객체
     *========================================================================*/
    getWsRegisterU4AIcons: function (sap) {

        let oSettingInfo  = this.getWsSettingsInfo();
        let oU4AIconsInfo = oSettingInfo.U4A.icons;
        let oFwInfo       = oU4AIconsInfo.fontAwesome;
        let oFwCollNames  = oFwInfo.collectionNames;
        let oFwList       = oFwInfo.fontList;

        sap.ui.requireSync("sap/ui/core/IconPool");

        // 로컬 경로를 file:// 프로토콜로 변환 후 URI 인코딩
        let sUrlRoot = PATHINFO.U4AICON_ROOT;
        sUrlRoot     = sUrlRoot.replaceAll("\\", "/");
        sUrlRoot     = `file:///${sUrlRoot}`;
        sUrlRoot     = encodeURI(sUrlRoot);

        sap.ui.core.IconPool.registerFont({ collectionName: oFwCollNames.regular, fontFamily: oFwList.regular, fontURI: sUrlRoot, lazy: true });
        sap.ui.core.IconPool.registerFont({ collectionName: oFwCollNames.brands,  fontFamily: oFwList.brands,  fontURI: sUrlRoot, lazy: true });
        sap.ui.core.IconPool.registerFont({ collectionName: oFwCollNames.solid,   fontFamily: oFwList.solid,   fontURI: sUrlRoot, lazy: true });

    },


    /*========================================================================
     * [Method] parseArrayToTree
     * 평면(Array) 데이터를 Tree 구조로 변환하여 모델에 반영합니다.
     *
     * @param {Object} m - SAP Core Model 인스턴스
     * @param {string} p - Tree를 구성할 원본 Model Path (Deep은 [.] 점으로 구분)
     * @param {string} r - Child 필드명
     * @param {string} t - Parent 필드명
     * @param {string} z - 재구성할 Model Path 명
     * @example
     * parseArrayToTree(oModel, "WS20.MIMETREE", "CHILD", "PARENT", "MIMETREE");
     *========================================================================*/
    parseArrayToTree: function (m, p, r, t, z) {

        var lp = p.replace(/[.\[\]]/g, '/');
        lp = lp.replace(/(\/\/)/g, '/');

        z = z.replace(/[\/]/g, 'x');
        r = r.replace(/[\/]/g, 'x');
        t = t.replace(/[\/]/g, 'x');

        var lp2 = lp.substr(0, lp.lastIndexOf('/'));
        var tm  = m.getProperty('/' + lp);
        var tm2 = m.getProperty('/' + lp2);

        if (!tm || tm.length === 0) {
            tm2[z] = [];
            m.refresh();
            return;
        }

        var n = JSON.parse(JSON.stringify(tm)); // Deep copy

        for (var e, h, u, a = [], c = {}, o = 0, f = n.length; f > o; o++) {
            e = n[o];
            h = e[r];
            u = e[t] || 0;
            c[h] = c[h] || [];
            e[z] = c[h];
            0 != u ? (c[u] = c[u] || [], c[u].push(e)) : a.push(e);
        }

        tm2[z] = a;

    },
    // end of parseArrayToTree


    /*========================================================================
     * [Method] parseTreeToArray
     * Tree 구조(재귀 Child 배열)를 평면 Array로 변환합니다.
     *
     * @param {Array}  e        - Tree 구조로 된 Array
     * @param {string} sArrName - Child 배열 필드명
     * @returns {Array} 평면화된 Array
     * @example
     * parseTreeToArray(aUspTreeData, "USPTREE");
     *========================================================================*/
    parseTreeToArray: function (e, sArrName) {

        var a = [],
            t = function (e) {
                e.forEach((o) => {
                    o[sArrName] && (t(o[sArrName]), delete o[sArrName]);
                    a.push(o);
                });
            };

        t(JSON.parse(JSON.stringify(e))); // Deep copy 후 재귀 평면화
        return a;

    },
    // end of parseTreeToArray


    /*========================================================================
     * [Method] setBrowserOpacity
     * Electron BrowserWindow를 열 때 Opacity를 0 → 1로 점진적으로 높여
     * 자연스러운 페이드인 효과를 연출합니다.
     *
     * @param {BrowserWindow} oBrowserWindow - 대상 BrowserWindow 인스턴스
     * @param {Function} [fnFinish]          - Opacity 완료 후 콜백 (옵션)
     *========================================================================*/
    setBrowserOpacity: function (oBrowserWindow, fnFinish) {

        let iOpa = 0.0;
        let iInterval;

        iInterval = setInterval(() => {

            if (iOpa > 1) {

                // 최종 opacity 설정 완료 구간
                if (iInterval) {

                    clearInterval(iInterval);
                    iInterval = undefined;

                    if (oBrowserWindow.isDestroyed()) return;

                    // close()와 setOpacity()가 동시에 호출될 수 있으므로 try-catch 처리
                    try {
                        oBrowserWindow.setOpacity(1.0);
                        if (typeof fnFinish === "function") fnFinish();
                    } catch (error) {
                        if (typeof fnFinish === "function") fnFinish();
                    }

                }

                return;
            }

            iOpa += 0.02;

            if (oBrowserWindow.isDestroyed()) {
                clearInterval(iInterval);
                iInterval = undefined;
                return;
            }

            // 외부에서 close()가 호출될 수 있으므로 try-catch 처리
            try {
                oBrowserWindow.setOpacity(iOpa);
            } catch (error) {
                clearInterval(iInterval);
                iInterval = undefined;
            }

        }, 10);

    },
    // end of setBrowserOpacity


    // [레거시 - 이전 버전의 setParentCenterBounds, 참조용으로 주석 보존]
    // setParentCenterBounds: function (REMOTE, oChildWinow, oBrowserOptions) { ... }
    // setParentCenterBounds1: function (REMOTE, oChildWinow, oBrowserOptions) { ... }


    /*========================================================================
     * [Method] setParentCenterBounds
     * 자식 BrowserWindow를 부모 Window의 중앙에 배치합니다.
     * 멀티 모니터 환경 및 작업 영역 경계를 고려하여 위치를 조정합니다.
     *
     * @param {Object}        REMOTE         - @electron/remote 모듈
     * @param {BrowserWindow} oChildWinow    - 배치할 자식 윈도우 인스턴스
     * @param {Object}        oBrowserOptions - 자식 윈도우 브라우저 옵션 (현재 미사용)
     *========================================================================*/
    setParentCenterBounds: function (REMOTE, oChildWinow, oBrowserOptions) {

        // --- 1. 필수 인자 유효성 검사 ---
        if (!REMOTE || typeof REMOTE.getCurrentWindow !== 'function' || typeof REMOTE.require !== 'function') {
            console.error("setParentCenterBounds: 유효하지 않거나 불완전한 REMOTE 객체가 제공되었습니다. 작업을 중단합니다.");
            return;
        }

        if (!oChildWinow || typeof oChildWinow.getBounds !== 'function' || typeof oChildWinow.setBounds !== 'function') {
            console.error("setParentCenterBounds: 유효하지 않은 자식 윈도우(oChildWinow) 객체입니다. getBounds 및 setBounds 메소드를 가진 BrowserWindow 인스턴스여야 합니다. 작업을 중단합니다.");
            return;
        }

        const oMainWindow = REMOTE.getCurrentWindow();
        if (!oMainWindow || typeof oMainWindow.getPosition !== 'function' || typeof oMainWindow.getSize !== 'function') {
            console.error("setParentCenterBounds: 메인 윈도우(oMainWindow)가 유효하지 않거나 접근할 수 없습니다. 작업을 중단합니다.");
            return;
        }

        // --- 2. CURRWIN 전역변수 유효성 검사 ---
        if (!global.CURRWIN || typeof global.CURRWIN.getBounds !== 'function' || (typeof global.CURRWIN.isDestroyed === 'function' && global.CURRWIN.isDestroyed())) {
            console.error("setParentCenterBounds: 전역 CURRWIN이 유효한 BrowserWindow 인스턴스가 아니거나 파괴되었습니다. 작업을 중단합니다.");
            return;
        }

        const SCREEN = REMOTE.require("electron").screen;
        if (!SCREEN || typeof SCREEN.getDisplayMatching !== 'function') {
            console.error("setParentCenterBounds: Electron 'screen' 모듈에 접근할 수 없습니다. 작업을 중단합니다.");
            return;
        }

        // --- 3. 부모 창의 위치와 크기 가져오기 ---
        const [parentX, parentY]         = oMainWindow.getPosition();
        const [parentWidth, parentHeight] = oMainWindow.getSize();

        if (isNaN(parentX) || isNaN(parentY) || isNaN(parentWidth) || isNaN(parentHeight)) {
            console.error(`setParentCenterBounds: 유효하지 않은 부모 윈도우 경계가 감지되었습니다. X=${parentX}, Y=${parentY}, W=${parentWidth}, H=${parentHeight}. 작업을 중단합니다.`);
            return;
        }

        // --- 4. 현재 디스플레이 정보 가져오기 ---
        let displayA         = SCREEN.getDisplayMatching(global.CURRWIN.getBounds());
        let oCurrScreenBound = displayA?.bounds  || null;
        let displayAWorkArea = displayA?.workArea || null;

        // --- 5. 자식 창의 현재 위치/크기 가져오기 ---
        let oChildBounds = oChildWinow.getBounds();
        if (isNaN(oChildBounds.width) || isNaN(oChildBounds.height)) {
            console.error(`setParentCenterBounds: 유효하지 않은 초기 자식 윈도우 경계가 감지되었습니다. 너비=${oChildBounds.width}, 높이=${oChildBounds.height}. 작업을 중단합니다.`);
            return;
        }

        var childWidth  = oChildBounds.width;
        var childHeight = oChildBounds.height;

        // --- 6. 부모 창 중앙 위치 계산 ---
        let childX = Math.round(parentX + (parentWidth  - childWidth)  / 2);
        let childY = Math.round(parentY + (parentHeight - childHeight) / 2);

        let oBounds = {
            width:  childWidth,
            height: childHeight,
            x:      childX,
            y:      childY,
        };

        // --- 7. 작업 영역(모니터 경계) 안으로 클램핑 ---
        if (displayAWorkArea) {
            const { x: dX, y: dY, width: dW, height: dH } = displayAWorkArea;

            if (oBounds.x < dX)                    oBounds.x = dX;
            if (oBounds.y < dY)                    oBounds.y = dY;
            if (oBounds.x + oBounds.width  > dX + dW) {
                oBounds.x = dX + dW - oBounds.width;
                if (oBounds.x < dX) oBounds.x = dX;
            }
            if (oBounds.y + oBounds.height > dY + dH) {
                oBounds.y = dY + dH - oBounds.height;
                if (oBounds.y < dY) oBounds.y = dY;
            }
        }

        // --- 8. 부모 Y 값 기준 추가 조정 ---
        if (oBounds.y <= parentY) {
            oBounds.y = parentY;
        }

        // --- 9. 소수점 제거 (setBounds는 정수만 허용) ---
        oBounds.x      = Math.ceil(oBounds.x);
        oBounds.y      = Math.ceil(oBounds.y);
        oBounds.width  = Math.ceil(oBounds.width);
        oBounds.height = Math.ceil(oBounds.height);

        // --- 10. 최종 유효성 검사 후 setBounds 호출 ---
        const finalIsValidBounds =
            typeof oBounds.x      === 'number' && !isNaN(oBounds.x)      &&
            typeof oBounds.y      === 'number' && !isNaN(oBounds.y)      &&
            typeof oBounds.width  === 'number' && !isNaN(oBounds.width)  &&
            typeof oBounds.height === 'number' && !isNaN(oBounds.height);

        if (finalIsValidBounds) {
            try {
                // setBounds를 두 번 호출해야 정확한 위치가 적용되는 Electron 특성 대응
                oChildWinow.setBounds(oBounds);
                oChildWinow.setBounds(oBounds);
            } catch (e) {
                console.error(`setParentCenterBounds: setBounds 호출 중 오류 발생: ${e.message}`, e);
            }
        } else {
            console.error(`setParentCenterBounds: 최종 계산된 경계가 유효하지 않습니다. setBounds 호출을 중단합니다. 유효하지 않은 경계: ${JSON.stringify(oBounds)}`);
        }

    },


    /*========================================================================
     * [Method] getFileExtSvgIcons
     * App 설치 폴더 내 svg 폴더에서 확장자별 SVG 아이콘 목록을 비동기로 읽습니다.
     *
     * @returns {Promise<{ RETCD: string, RTDATA?: Array<{ EXTNM: string, ICONPATH: string }> }>}
     *========================================================================*/
    getFileExtSvgIcons: () => {

        return new Promise((resolve) => {

            var svgFolder = PATH.join(APP.getAppPath(), "svg");

            FS.readdir(svgFolder, { withFileTypes: false }, (err, aFiles) => {

                if (err) {
                    resolve({ RETCD: "E", RTMSG: err.toString() });
                    return;
                }

                let aFileExtInfo = aFiles.map((sFileFullName) => ({
                    EXTNM:    sFileFullName.split(".")[0],
                    ICONPATH: svgFolder + "\\" + sFileFullName
                }));

                resolve({ RETCD: "S", RTDATA: aFileExtInfo });

            });

        });

    },
    // end of getFileExtSvgIcons


    /*========================================================================
     * [Method] getSapIconPath
     * SAP 아이콘 이름으로 .gif 파일의 절대 경로를 반환합니다.
     *
     * @param {string} sIcon - 아이콘 이름 (확장자 제외)
     * @returns {string|undefined}
     *========================================================================*/
    getSapIconPath: function (sIcon) {

        if (sIcon == null) return;

        var sIconName = sIcon + ".gif";
        return PATH.join(APP.getAppPath(), "icons", sIconName);

    },


    /*========================================================================
     * [Method] getRandomKey
     * 지정한 길이의 랜덤 키 문자열(Base30)을 생성합니다.
     *
     * @param {number} [iLength=50] - 랜덤값 길이
     * @returns {string}
     *========================================================================*/
    getRandomKey: function (iLength) {

        const RANDOM = require("random-key");

        let iDefLength = iLength || 50;

        return RANDOM.generateBase30(iDefLength);

    },
    // end of getRandomKey


    /*========================================================================
     * [Method] getWsSettingsInfo
     * WS 설정 파일(JSON)을 동기적으로 읽어 Object로 반환합니다.
     *
     * @returns {Object} WS 설정 정보
     *========================================================================*/
    getWsSettingsInfo: function () {

        let sSetttingJsonData = FS.readFileSync(PATHINFO.WSSETTINGS, 'utf-8');
        let oSettings         = JSON.parse(sSetttingJsonData);

        return oSettings;

    },
    // end of getWsSettingsInfo


    /*========================================================================
     * [Method] setWsSettingsInfo
     * WS 설정 Object를 JSON 파일로 동기 저장합니다.
     *
     * @param {Object} oSettingInfo - 저장할 설정 Object
     *========================================================================*/
    setWsSettingsInfo: function (oSettingInfo) {

        var sSettingJson = JSON.stringify(oSettingInfo);
        FS.writeFileSync(PATHINFO.WSSETTINGS, sSettingJson);

    },


    /*========================================================================
     * [Method] getWsGlobalSettingInfoAsync
     * 레지스트리에서 WS Global Setting 전체 값 객체를 조회합니다.
     *
     * @returns {Promise<Object>} 레지스트리 GlobalSetting values 객체
     *========================================================================*/
    getWsGlobalSettingInfoAsync: function () {

        return new Promise(async (resolve) => {

            let oSettings          = this.getWsSettingsInfo();
            let sRegPath           = oSettings.regPaths;
            let sGlobalSettingPath = sRegPath.globalSettings;

            let oRegList = await this.getRegeditList([sGlobalSettingPath]);
            let oRetData = oRegList.RTDATA;

            if (oRegList.RETCD == "E") {
                throw new Error(oRegList.RTMSG);
            }

            let oGlobalSettingRegData = oRetData[sGlobalSettingPath];
            let oSettingValues        = oGlobalSettingRegData.values;

            resolve(oSettingValues);

        });

    },
    // end of getWsGlobalSettingInfoAsync


    /*========================================================================
     * [Method] checkWLOListAsync
     * 레지스트리에 저장된 WhiteList Object(WLO) 목록에서
     * REGTYP + CHGOBJ 조합이 존재하는지 확인합니다.
     *
     * @param {string} [SYSID=""]  - 접속 시스템 ID
     * @param {string} [REGTYP=""] - WLO 등록 타입
     * @param {string} [CHGOBJ=""] - WLO 변경 Object
     * @returns {Promise<boolean>}
     *========================================================================*/
    checkWLOListAsync: function (SYSID = "", REGTYP = "", CHGOBJ = "") {

        return new Promise(async (resolve) => {

            let aWLO = await this.getWsWLOListAsync(SYSID);

            if (!Array.isArray(aWLO)) {
                resolve(false);
                return;
            }

            let oFindWLO = aWLO.find((elem) => elem.REGTYP == REGTYP && elem.CHGOBJ == CHGOBJ);

            resolve(!!oFindWLO);

        });

    },
    // end of checkWLOListAsync


    /*========================================================================
     * [Method] getWsWLOListAsync
     * 레지스트리에서 특정 시스템의 WLO(WhiteList Object) 배열을 조회합니다.
     *
     * @param {string} [SYSID=""] - 접속 시스템 ID
     * @returns {Promise<Array>}   WLO Array (없거나 오류면 빈 배열)
     *========================================================================*/
    getWsWLOListAsync: function (SYSID = "") {

        return new Promise(async (resolve) => {

            let oSettings        = this.getWsSettingsInfo();
            let sRegPath         = oSettings.regPaths;
            let sWsSystemPath    = sRegPath.systems;

            let oRegData = await this.getRegeditAsync(sWsSystemPath, SYSID);
            if (oRegData.RETCD == "E") {
                resolve([]);
                return;
            }

            let oRegValues = oRegData.RTDATA.values;
            let oWLO       = oRegValues.T_REG_WLO;

            if (!oWLO) {
                resolve([]);
                return;
            }

            let sWLOJson = oWLO.value;

            try {
                var aWLO = JSON.parse(sWLOJson);
            } catch (error) {
                resolve([]);
                return;
            }

            if (!Array.isArray(aWLO) || aWLO.length == 0) {
                resolve([]);
                return;
            }

            resolve(aWLO);

        });

    },
    // end of getWsWLOListAsync


    /*========================================================================
     * [Section] 파일 시스템 유틸리티
     * FS(fs-extra) 기반의 비동기 파일 I/O 래퍼 메서드들.
     * 모두 Promise를 반환하며, { RETCD: "S"|"E", RTMSG, RTDATA } 구조를 사용합니다.
     *========================================================================*/

    /**
     * 전달받은 경로의 디렉토리 항목 목록을 비동기로 읽습니다.
     *
     * @param {string} sFolderPath - 읽을 폴더 경로
     * @returns {Promise<{ RETCD: string, RTMSG: string, RTDATA: string[] }>}
     */
    readDir: function (sFolderPath) {

        return new Promise(async (resolve) => {

            FS.readdir(sFolderPath, { withFileTypes: false }, (err, files) => {

                if (err) {
                    resolve({ RETCD: "E", RTMSG: err.toString(), RTDATA: "" });
                    return;
                }

                resolve({ RETCD: "S", RTMSG: "", RTDATA: files });

            });

        });

    },
    // end of readDir


    /**
     * 파일을 비동기로 읽어 UTF-8 텍스트로 반환합니다.
     *
     * @param {string} sFilePath - 읽을 파일의 경로
     * @returns {Promise<{ RETCD: string, RTMSG: string, RTDATA: string }>}
     */
    readFile: function (sFilePath) {

        return new Promise(async (resolve) => {

            FS.readFile(sFilePath, "utf-8", (err, data) => {

                if (err) {
                    resolve({ RETCD: "E", RTMSG: err.toString(), RTDATA: "" });
                    return;
                }

                resolve({ RETCD: "S", RTMSG: "", RTDATA: data });

            });

        });

    },
    // end of readFile


    /**
     * 폴더 및 파일 복사.
     * @deprecated 빌드 시 버그 있음!! 사용 금지!!
     *
     * @param {string} sSource  - 복사 원본 경로
     * @param {string} sTarget  - 복사 대상 경로
     * @param {Object} options  - fs-extra copy 옵션
     * @returns {Promise<{ RETCD: string, RTMSG: string, RTDATA: string }>}
     */
    fsCopy: function (sSource, sTarget, options) {

        return new Promise((resolve) => {

            FS.copy(sSource, sTarget, options)
                .then(function () {
                    resolve({ RETCD: "S", RTMSG: "", RTDATA: "" });
                })
                .catch(function (err) {
                    resolve({ RETCD: "E", RTMSG: err.toString(), RTDATA: "" });
                });

        });

    },
    // end of fsCopy


    /**
     * 파일을 비동기로 씁니다. (Node.js fs.writeFile 래퍼)
     *
     * @param {string|Buffer|URL} file   - 쓸 파일 경로
     * @param {*}                 data   - 쓸 데이터
     * @param {Object}            [options={}] - fs.writeFile 옵션
     * @returns {Promise<{ RETCD: string, RTMSG: string, RTDATA: string }>}
     */
    fsWriteFile: function (file, data, options = {}) {

        return new Promise(async (resolve) => {

            FS.writeFile(file, data, options, (err) => {

                if (err) {
                    resolve({ RETCD: "E", RTMSG: err.toString(), RTDATA: "" });
                    return;
                }

                resolve({ RETCD: "S", RTMSG: "", RTDATA: "" });

            });

        });

    },
    // end of fsWriteFile


    /**
     * 파일/디렉토리의 stat 정보를 비동기로 조회합니다.
     *
     * @param {string} sFilePath - 조회할 경로
     * @returns {Promise<{ RETCD: string, RTMSG: string, RTDATA: fs.Stats|string }>}
     */
    fsStat: function (sFilePath) {

        return new Promise(async (resolve) => {

            FS.stat(sFilePath, (err, stats) => {

                if (err) {
                    resolve({ RETCD: "E", RTMSG: err.toString(), RTDATA: "" });
                    return;
                }

                resolve({ RETCD: "S", RTMSG: "", RTDATA: stats });

            });

        });

    },
    // end of fsStat


    /**
     * 파일 또는 디렉토리를 비동기로 삭제합니다. (fs-extra remove 래퍼)
     *
     * @param {string} sRemovePath - 삭제할 경로
     * @returns {Promise<{ RETCD: string, RTMSG: string, RTDATA: string }>}
     */
    fsRemove: function (sRemovePath) {

        return new Promise(async (resolve) => {

            FS.remove(sRemovePath, (err) => {

                if (err) {
                    resolve({ RETCD: "E", RTMSG: err.toString(), RTDATA: "" });
                    return;
                }

                resolve({ RETCD: "S", RTMSG: "", RTDATA: "" });

            });

        });

    },
    // end of fsRemove


    /*========================================================================
     * [NEW] [Method] downloadResponseData
     * 응답 데이터를 파일로 다운로드합니다.
     *
     * 데이터 크기가 threshold(기본 500KB) 를 초과하면
     * userData/ws_downloads 폴더에 파일을 저장하고,
     * 저장된 파일을 탐색기에서 열어줍니다.
     *
     * 크기가 threshold 이하이면 별도 파일 없이 데이터를 그대로 반환합니다.
     *
     * @param {Object|Array|string} oData - 다운로드할 데이터
     * @param {Object} [oOptions]
     * @param {string}  [oOptions.filename]       - 저장 파일명 (확장자 포함, 기본: ws_data_타임스탬프.json)
     * @param {number}  [oOptions.threshold]      - 파일 저장 임계값(bytes). 기본: 512000 (500KB)
     * @param {string}  [oOptions.format]         - 'json' | 'text' (기본: 'json')
     * @param {boolean} [oOptions.forceDownload]  - true면 크기와 무관하게 항상 파일로 저장
     * @param {boolean} [oOptions.openFolder]     - true면 저장 후 탐색기로 폴더 오픈 (기본: true)
     * @returns {{
     *   RETCD: string,
     *   RTMSG: string,
     *   IS_FILE: boolean,
     *   FILEPATH?: string,
     *   RDATA?: *
     * }}
     *
     * @example
     * // 사용 예
     * let oResult = await WSUTIL.downloadResponseData(oLargeData, {
     *     filename: "report_2026.json",
     *     threshold: 100000
     * });
     * if (oResult.IS_FILE) {
     *     console.log("저장된 파일:", oResult.FILEPATH);
     * }
     *========================================================================*/
    downloadResponseData: function (oData, oOptions) {

        const _oOpts = Object.assign({
            filename:      "",
            threshold:     512000,   // 500KB
            format:        "json",
            forceDownload: false,
            openFolder:    true,
        }, oOptions || {});

        // 1. 직렬화
        let sContent = "";
        try {
            sContent = (_oOpts.format === "json")
                ? JSON.stringify(oData, null, 2)
                : String(oData);
        } catch (e) {
            return {
                RETCD:   "E",
                RTMSG:   "데이터 직렬화 중 오류가 발생했습니다: " + e.toString(),
                IS_FILE: false,
            };
        }

        const iByteSize = Buffer.byteLength(sContent, 'utf-8');

        // 2. 임계값 이하이고 강제 다운로드가 아니면 데이터를 그대로 반환
        if (!_oOpts.forceDownload && iByteSize < _oOpts.threshold) {
            return {
                RETCD:   "S",
                RTMSG:   "",
                IS_FILE: false,
                RDATA:   oData,
            };
        }

        // 3. 저장 폴더 준비
        const sDownloadFolder = PATH.join(USERDATA, "ws_downloads");

        try {
            if (!FS.existsSync(sDownloadFolder)) {
                FS.mkdirSync(sDownloadFolder, { recursive: true });
            }
        } catch (e) {
            return {
                RETCD:   "E",
                RTMSG:   "다운로드 폴더 생성 중 오류가 발생했습니다: " + e.toString(),
                IS_FILE: false,
            };
        }

        // 4. 파일명 결정 (타임스탬프 기반 기본 파일명)
        const _sExt      = (_oOpts.format === "json") ? ".json" : ".txt";
        const _sTimestamp = new Date().toISOString().replace(/[:.]/g, "-").replace("T", "_").slice(0, 19);
        const sFilename  = _oOpts.filename || `ws_data_${_sTimestamp}${_sExt}`;
        const sFilePath  = PATH.join(sDownloadFolder, sFilename);

        // 5. 파일 저장
        try {
            FS.writeFileSync(sFilePath, sContent, { encoding: "utf-8" });
        } catch (e) {
            return {
                RETCD:   "E",
                RTMSG:   "파일 저장 중 오류가 발생했습니다: " + e.toString(),
                IS_FILE: false,
            };
        }

        // 6. 탐색기에서 저장 파일 강조 표시
        if (_oOpts.openFolder) {
            try {
                const SHELL = REMOTE.require("electron").shell;
                SHELL.showItemInFolder(sFilePath);
            } catch (e) {
                // 탐색기 오픈 실패는 치명적이지 않으므로 경고만 출력
                console.warn("downloadResponseData: 탐색기 오픈 실패", e.toString());
            }
        }

        return {
            RETCD:    "S",
            RTMSG:    `파일이 저장되었습니다. (${(iByteSize / 1024).toFixed(1)} KB)`,
            IS_FILE:  true,
            FILEPATH: sFilePath,
        };

    },
    // end of downloadResponseData


    /*========================================================================
     * [Section] 레지스트리 유틸리티
     * Windows 레지스트리 읽기/쓰기 래퍼 메서드들.
     *========================================================================*/

    /**
     * 레지스트리 정보를 가져옵니다. (arguments 기반 Path 조합)
     * PATH.join 처럼 arguments로 경로 세그먼트를 전달합니다.
     *
     * @param {...string} arguments - 레지스트리 경로 세그먼트
     * @returns {Promise<{ RETCD: string, RTMSG: string, RTDATA: * }>}
     * @example
     * getRegeditAsync("HKCU\\Software", "MyApp", "Settings")
     */
    getRegeditAsync: function () {

        var aArgs     = arguments;
        var iArgLength = aArgs.length;

        return new Promise((resolve) => {

            if (iArgLength == 0) {
                resolve({ RETCD: "E", RTMSG: "", RTDATA: "" });
                return;
            }

            // arguments로 레지스트리 경로 조합
            let sRegPath = "";
            for (var i = 0; i < iArgLength; i++) {
                sRegPath += (i === iArgLength - 1) ? aArgs[i] : aArgs[i] + "\\";
            }

            REGEDIT.list([sRegPath], (err, result) => {

                if (err) {
                    resolve({ RETCD: "E", RTMSG: err.toString(), RTDATA: "" });
                    return;
                }

                resolve({ RETCD: "S", RTMSG: "", RTDATA: result[sRegPath] });

            });

        });

    },


    /**
     * 레지스트리 경로 배열에 대한 정보를 일괄 조회합니다.
     *
     * @param {string[]} aPaths - 조회할 레지스트리 경로 배열
     * @returns {Promise<{ RETCD: string, RTMSG: string, RTDATA: Object }>}
     */
    getRegeditList: function (aPaths) {

        return new Promise((resolve) => {

            REGEDIT.list(aPaths, (err, result) => {

                if (err) {
                    resolve({ RETCD: "E", RTMSG: err.toString(), RTDATA: "" });
                    return;
                }

                resolve({ RETCD: "S", RTMSG: "", RTDATA: result });

            });

        });

    },


    /**
     * 레지스트리에 값을 저장합니다.
     *
     * @param {Object} oRegData - regedit.putValue 형식의 데이터 Object
     * @returns {Promise<{ RETCD: string, RTMSG: string, RTDATA: string }>}
     */
    putRegeditValue: function (oRegData) {

        return new Promise((resolve) => {

            REGEDIT.putValue(oRegData, (err) => {

                if (err) {
                    resolve({ RETCD: "E", RTMSG: err.toString(), RTDATA: "" });
                    return;
                }

                resolve({ RETCD: "S", RTMSG: "", RTDATA: "" });

            });

        });

    },


    /*========================================================================
     * [Method] hexToRgb
     * HEX 색상 코드를 RGB 또는 RGBA 문자열로 변환합니다.
     *
     * @param {string} hex     - HEX 색상 코드 (예: "#ff5733")
     * @param {number} alpha   - 투명도 (0~1). 범위를 벗어나면 rgb() 반환
     * @returns {string} "rgb(r, g, b)" 또는 "rgba(r, g, b, a)"
     *========================================================================*/
    hexToRgb: function (hex, alpha) {

        let r = parseInt(hex.slice(1, 3), 16);
        let g = parseInt(hex.slice(3, 5), 16);
        let b = parseInt(hex.slice(5, 7), 16);

        if (0 <= alpha && alpha <= 1) {
            return `rgba(${r}, ${g}, ${b}, ${alpha})`;
        } else {
            return `rgb(${r}, ${g}, ${b})`;
        }

    },


    /*========================================================================
     * [Method] zipExtract
     * ZIP 압축 파일을 지정한 폴더로 압축 해제합니다.
     *
     * @param {string} sSourcePath      - ZIP 파일 경로
     * @param {string} sTargetFolderPath - 압축 해제 대상 폴더 경로
     * @returns {Promise<{ RETCD: string, RTMSG?: string }>}
     *========================================================================*/
    zipExtract: function (sSourcePath, sTargetFolderPath) {

        return new Promise((resolve) => {

            ZIPLIB.extract(sSourcePath, sTargetFolderPath)
                .then(function () {
                    resolve({ RETCD: "S" });
                }, function (err) {
                    resolve({ RETCD: "E", RTMSG: err.toString() });
                });

        });

    },


    /*========================================================================
     * [Method] setIconFavorite
     * SYSID별 아이콘 즐겨찾기 정보를 로컬 JSON 파일로 저장합니다.
     *
     * @param {string} SYSID     - 접속 서버의 SYSTEM ID
     * @param {Array}  aIconInfo - 저장할 아이콘 정보 배열
     * @throws {Error} 파일 저장 실패 시
     *========================================================================*/
    setIconFavorite: function (SYSID, aIconInfo) {

        let sIconFavFolderPath = PATHINFO.P13N_ICONFAV;
        let sIconFavFilePath   = PATH.join(sIconFavFolderPath, `${SYSID}.json`);

        try {

            // 파일이 없으면 빈 배열로 초기화
            if (!FS.existsSync(sIconFavFilePath)) {
                this.fsWriteFile(sIconFavFilePath, JSON.stringify([]));
            }

            this.fsWriteFile(sIconFavFilePath, JSON.stringify(aIconInfo));

        } catch (error) {
            let _sErrMsg = "[Icon Favorite save]: " + error.toString() + " \n\n ";
            console.log("아이콘 즐겨찾기 저장 오류", _sErrMsg);
            throw new Error(error);
        }

    },
    // end of setIconFavorite


    /*========================================================================
     * [Method] getIconFavorite
     * SYSID별 저장된 아이콘 즐겨찾기 목록을 반환합니다.
     *
     * @param {string} SYSID - 접속 서버의 SYSTEM ID
     * @returns {Array} 즐겨찾기 아이콘 배열 (없거나 오류면 빈 배열)
     *========================================================================*/
    getIconFavorite: function (SYSID) {

        let sIconFavFolderPath = PATHINFO.P13N_ICONFAV;
        let sIconFavFilePath   = PATH.join(sIconFavFolderPath, `${SYSID}.json`);

        if (!FS.existsSync(sIconFavFilePath)) return [];

        try {
            var sJsonData = FS.readFileSync(sIconFavFilePath, 'utf-8');
            var aFavIcon  = JSON.parse(sJsonData);
        } catch (error) {
            return [];
        }

        return aFavIcon;

    },
    // end of getIconFavorite


    /*========================================================================
     * [Method] getSysInfoIPC
     * IPC 통신으로 현재 시스템 접속 관련 정보를 가져옵니다.
     * PRCCD와 BROWSKEY가 필수입니다.
     *
     * @param {Object}  IF_DATA           - IPC 요청 데이터 Object
     * @param {string}  IF_DATA.PRCCD     - 처리 코드 (* 필수)
     * @param {string}  IF_DATA.BROWSKEY  - 브라우저 키 (* 필수)
     * @returns {Promise<Object|undefined>}
     *========================================================================*/
    getSysInfoIPC: function (IF_DATA) {

        return new Promise((resolve) => {

            // IF_DATA가 Object 타입인지 검사
            if (typeof IF_DATA !== "object") return resolve();

            if (!IF_DATA?.PRCCD)    return resolve();
            if (!IF_DATA?.BROWSKEY) return resolve();

            // 일회성 IPC 콜백: 응답 수신 후 리스너 즉시 해제
            let lf_ipc_callback = function (event, res) {
                IPCRENDERER.off(`if-get-sys-info-result-${IF_DATA.BROWSKEY}`, lf_ipc_callback);
                resolve(res);
            };

            let oIF_DATA = {};
            oIF_DATA.TO_CHID = `if-get-sys-info-result-${IF_DATA.BROWSKEY}`;
            Object.assign(oIF_DATA, IF_DATA);

            IPCRENDERER.send(`if-get-sys-info-${IF_DATA.BROWSKEY}`, oIF_DATA);
            IPCRENDERER.on(`if-get-sys-info-result-${IF_DATA.BROWSKEY}`, lf_ipc_callback);

        });

    },
    // end of getSysInfoIPC


    /*========================================================================
     * [Class] MONACO_EDITOR
     * USP Monaco Editor 테마(Standard/Custom) 관리 클래스.
     * 모든 메서드는 static이며, 파일 시스템 기반으로 동기 동작합니다.
     *========================================================================*/
    MONACO_EDITOR: class {

        /** 스탠다드 테마 루트 폴더 경로를 반환합니다. */
        static _getStandardThemeRootPath() {
            return PATH.join(APPPATH, "lib", "monaco", "themes");
        }

        /**
         * 사용자별 Custom 테마 루트 경로를 반환합니다.
         * SYSID 및 usp_main 하위에 저장됩니다.
         */
        static _getCustomThemeRootPath() {
            return PATH.join(PATHINFO.P13N_ROOT, "monaco", "theme", process.USERINFO.SYSID, "usp_main", "list");
        }

        /**
         * 스탠다드 테마 JSON 파일 목록을 반환합니다.
         * @returns {string[]} ".json" 파일명 배열 (없거나 오류면 빈 배열)
         */
        static getStandardThemeList() {

            let sPath = this._getStandardThemeRootPath();

            if (!FS.existsSync(sPath)) return [];

            try {

                var aThemes = FS.readdirSync(sPath);

                if (!Array.isArray(aThemes) || aThemes.length === 0) return [];

            } catch (error) {

                var aConsoleMsg = [
                    `[PATH]: www/ws10_20/js/ws_util.js`,
                    `=> MONACO_EDITOR.getStandardThemeList`,
                    `=> var aThemes = FS.readdirSync(sPath)`,
                    `=> try...catch error`,
                    `=> sStandardThemeRootPath: ${sPath}`,
                    `[STACK]: ${new Error("에디터의 스탠다드 테마 폴더의 하위 데이터 읽는 도중 문제 발생!!").stack}`,
                ];

                console.error(aConsoleMsg.join("\r\n"));
                return [];

            }

            return aThemes.filter(e => e && PATH.extname(e) === ".json");

        }

        /**
         * 사용자 Custom 테마 JSON 파일 목록을 반환합니다.
         * @returns {string[]} ".json" 파일명 배열 (없거나 오류면 빈 배열)
         */
        static getCustomThemeList() {

            let sPath = this._getCustomThemeRootPath();

            if (!FS.existsSync(sPath)) return [];

            try {

                var aThemes = FS.readdirSync(sPath);

                if (!Array.isArray(aThemes) || aThemes.length === 0) return [];

            } catch (error) {

                var aConsoleMsg = [
                    `[PATH]: www/ws10_20/js/ws_util.js`,
                    `=> MONACO_EDITOR.getCustomThemeList`,
                    `=> var aThemes = FS.readdirSync(sPath)`,
                    `=> try...catch error`,
                    `=> sCustomThemeRootPath: ${sPath}`,
                    `[STACK]: ${new Error(" 에디터의 Custom 테마 폴더의 하위 데이터 읽는 도중 문제 발생!!").stack}`,
                ];

                console.error(aConsoleMsg.join("\r\n"));
                return [];

            }

            return aThemes.filter(e => e && PATH.extname(e) === ".json");

        }

        /**
         * 테마 이름으로 스탠다드 테마 정보를 조회합니다. (내부 사용)
         * @param {string} sThemeName - 파일명 기준 테마 이름 (확장자 제외)
         * @returns {{ themeName: string, themeInfo: Object }|undefined}
         */
        static _getStandardThemeInfo(sThemeName) {

            if (!sThemeName) return;

            let sRootPath = this._getStandardThemeRootPath();
            if (!FS.existsSync(sRootPath)) return;

            let sThemeFilePath = PATH.join(sRootPath, sThemeName + ".json");
            if (!FS.existsSync(sThemeFilePath)) return;

            try {

                var sThemeInfo = FS.readFileSync(sThemeFilePath, { encoding: "utf-8" });
                var oThemeInfo = JSON.parse(sThemeInfo);

                return { themeName: sThemeName, themeInfo: oThemeInfo };

            } catch (error) {

                var aConsoleMsg = [
                    `[PATH]: www/ws10_20/js/ws_util.js`,
                    `=> MONACO_EDITOR._getStandardThemeInfo`,
                    `=> var sThemeInfo = FS.readFileSync(sThemeFilePath, { encoding: "utf-8" })`,
                    `=> try...catch error`,
                    `=> sThemeName: ${sThemeName}`,
                    `=> sThemeFilePath: ${sThemeFilePath}`,
                    `[STACK]: ${new Error("스탠다드 테마 정보 구하는 도중 문제 발생!").stack}`,
                ];

                console.error(aConsoleMsg.join("\r\n"));
                return;

            }

        }

        /**
         * 테마 이름으로 커스텀 테마 정보를 조회합니다. (내부 사용)
         * @param {string} sThemeName - 파일명 기준 테마 이름 (확장자 제외)
         * @returns {{ themeName: string, themeInfo: Object }|undefined}
         */
        static _getCustomThemeInfo(sThemeName) {

            if (!sThemeName) return;

            let sRootPath = this._getCustomThemeRootPath();
            if (!FS.existsSync(sRootPath)) return;

            let sThemeFilePath = PATH.join(sRootPath, sThemeName + ".json");
            if (!FS.existsSync(sThemeFilePath)) return;

            try {
                var sThemeInfo = FS.readFileSync(sThemeFilePath, { encoding: "utf-8" });
                var oThemeInfo = JSON.parse(sThemeInfo);
                return { themeName: sThemeName, themeInfo: oThemeInfo };
            } catch (error) {
                return;
            }

        }

        /**
         * 스탠다드 → 커스텀 순서로 테마 정보를 조회합니다.
         * @param {string} sThemeName - 테마 이름
         * @returns {{ themeName: string, themeInfo: Object }|undefined}
         */
        static getThemeInfo(sThemeName) {

            if (!sThemeName) return;

            return this._getStandardThemeInfo(sThemeName)
                || this._getCustomThemeInfo(sThemeName)
                || undefined;

        }

        /**
         * 경로로 JSON 파일 데이터를 읽어 Object로 반환합니다.
         * @param {string} sPath - JSON 파일 경로
         * @returns {Object|undefined}
         */
        static getJsonData(sPath) {

            if (!sPath || !FS.existsSync(sPath)) return;

            try {
                var sThemeInfo = FS.readFileSync(sPath, { encoding: "utf-8" });
                return JSON.parse(sThemeInfo);
            } catch (error) {
                return;
            }

        }

        /**
         * Monaco 테마 베이스 코드에 대응하는 다국어 텍스트를 반환합니다.
         * @param {string} sThemeBase - "vs" | "vs-dark"
         * @returns {string|undefined}
         */
        static getThemeBase(sThemeBase) {

            if (!sThemeBase) return;

            switch (sThemeBase) {
                case "vs":      return WSUTIL.getWsMsgClsTxt("", "ZMSG_WS_COMMON_001", "333");
                case "vs-dark": return WSUTIL.getWsMsgClsTxt("", "ZMSG_WS_COMMON_001", "334");
                default:        return;
            }

        }

        /**
         * Custom + Standard 테마를 합산하여 전체 테마 목록을 반환합니다.
         * Custom 테마가 먼저, Standard 테마가 뒤에 위치합니다.
         *
         * @returns {Array<{ name: string, groupName: string, themeBase: string }>}
         */
        static getThemeList() {

            let aThemeList = [];

            const _fnBuildThemeEntry = (sTheme, sGroupName, sRootPath) => {

                if (!sTheme) return null;

                let oParseInfo = PATH.parse(sTheme);
                let sThemeName = oParseInfo?.name || "";

                if (!sThemeName) return null;

                let oThemeInfo   = {};
                oThemeInfo.name  = sThemeName;
                oThemeInfo.groupName  = sGroupName;
                oThemeInfo.themeBase  = "";

                // JSON 파일을 읽어 themeBase 정보를 추가
                let oThemeJsonData = this.getJsonData(PATH.join(sRootPath, sTheme));
                if (oThemeJsonData) {
                    oThemeInfo.themeBase = this.getThemeBase(oThemeJsonData?.base) || "";
                }

                return oThemeInfo;

            };

            // Custom 테마 수집
            let sCustomThemeRootPath = this._getCustomThemeRootPath();
            let aCustomThemeList     = this.getCustomThemeList();

            for (var sTheme of aCustomThemeList) {
                let oEntry = _fnBuildThemeEntry(sTheme, "custom", sCustomThemeRootPath);
                if (oEntry) aThemeList.push(oEntry);
            }

            // Standard 테마 수집
            let sStandardThemeRootPath = this._getStandardThemeRootPath();
            let aStandardThemeList     = this.getStandardThemeList();

            for (var sStTheme of aStandardThemeList) {
                let oEntry = _fnBuildThemeEntry(sStTheme, "standard", sStandardThemeRootPath);
                if (oEntry) aThemeList.push(oEntry);
            }

            return aThemeList;

        }

        /**
         * Custom 테마를 JSON 파일로 저장합니다.
         *
         * @param {string} sFileName  - 저장할 파일명 (확장자 포함)
         * @param {Object} oThemeInfo - 저장할 테마 데이터 Object
         * @returns {boolean} 성공 여부
         */
        static saveCustomTheme(sFileName, oThemeInfo) {

            if (!sFileName || typeof sFileName !== "string") return false;
            if (!oThemeInfo || typeof oThemeInfo !== "object") return false;

            let sCustomThemePath = this._getCustomThemeRootPath();

            if (!FS.existsSync(sCustomThemePath)) {
                FS.mkdirSync(sCustomThemePath, { recursive: true });
            }

            try {
                FS.writeFileSync(
                    PATH.join(sCustomThemePath, sFileName),
                    JSON.stringify(oThemeInfo),
                    'utf-8'
                );
            } catch (error) {
                return false;
            }

            return true;

        }

    },
    /************** end of Class (MONACO_EDITOR) ***************/


    /*========================================================================
     * [Class] EXE_BROWSER
     * 브라우저 설치 경로를 레지스트리에서 조회하는 클래스.
     *========================================================================*/
    EXE_BROWSER: class {

        /**
         * WS 설정 파일에서 브라우저 정보 배열을 읽어 반환합니다.
         * @returns {Array|undefined}
         */
        static getBrowserInfo() {

            let oSettingsInfo = parent.getSettingsInfo();
            if (!oSettingsInfo) return;

            let aBrowsers = oSettingsInfo.aBrowserInfo;
            if (!aBrowsers) return;

            return aBrowsers;

        }

        /**
         * 각 브라우저의 레지스트리 경로를 확인하여 설치 경로(INSPATH)를 추가합니다.
         * HKCU → HKLM 순서로 레지스트리를 확인합니다.
         *
         * @returns {Promise<Array|undefined>} INSPATH가 추가된 브라우저 정보 배열
         */
        static async getBrowserInstallPath() {

            let aBrowsers = this.getBrowserInfo();
            if (!aBrowsers) return;

            for (var oBrows of aBrowsers) {

                let sRegPath  = oBrows.REGPATH;
                let sRegPath2 = oBrows.REGPATH2;

                if (!sRegPath || !sRegPath2) continue;

                let oBrowsInstResult = await WSUTIL.getRegeditList([sRegPath, sRegPath2]);
                if (oBrowsInstResult.RETCD === "E") continue;

                let oBrowsInstData = oBrowsInstResult.RTDATA;

                // 1순위: HKCU(Current User) 레지스트리에서 설치 경로 확인
                let oCheckHKCU = oBrowsInstData[sRegPath2];
                if (oCheckHKCU.exists) {
                    var oExePathObj = oCheckHKCU.values[""];
                    if (oExePathObj != null) {
                        oBrows.INSPATH = oExePathObj.value;
                        continue;
                    }
                }

                // 2순위: HKLM(Local Machine) 레지스트리에서 설치 경로 확인
                let oCheckHKLM = oBrowsInstData[sRegPath];
                if (oCheckHKLM.exists) {
                    var oExePathObj = oCheckHKLM.values[""];
                    if (oExePathObj != null) {
                        oBrows.INSPATH = oExePathObj.value;
                        continue;
                    }
                }

            }

            return aBrowsers;

        }

    },
    /************** end of Class (EXE_BROWSER) ***************/


    /*========================================================================
     * [Method] getStackTraceInfo
     * 현재 실행 지점의 Stack Trace 정보를 가공하여 문자열로 반환합니다.
     *
     * ⚠️ 주의사항
     *  1. stack 속성은 비표준이며 브라우저 엔진마다 출력 형식이 다를 수 있습니다.
     *  2. eval() 내에서 호출 시 스택이 정상적으로 잡히지 않을 수 있습니다.
     *  3. Error 객체 생성은 비용이 있으므로 빈번한 루프 내 사용을 지양하십시오.
     *
     * @param {string} [label="🔥 Trace Info"] - 스택 최상단에 표시할 커스텀 라벨
     * @param {string} [sMsg=""]              - Error 객체 생성 시 포함할 내부 메시지
     * @returns {string} 가공된 스택 트레이스 문자열
     *========================================================================*/
    getStackTraceInfo() {

        let aParams = arguments;

        let label = aParams[0] || "🔥 Trace Info";
        let sMsg  = aParams[1] || "";

        const stack = new Error(sMsg).stack;

        // stack 속성이 없는 환경(매우 오래된 브라우저) 대응
        if (!stack) return "";

        return stack.replace(/^Error/, label);

    },
    // end of getStackTraceInfo


    /*========================================================================
     * [Method] getCheckAlreadyOpenWindow
     * !! 현재 브라우저의 Child 기준 !!
     * 에디터 타입별로 이미 오픈된 팝업이 있는지 확인합니다.
     * 이미 열려 있으면 해당 창에 focus를 줍니다.
     *
     * @param {string} OBJTY - 오픈하려는 에디터의 타입 정보
     * @returns {{ ISOPEN: boolean, WINDOW?: BrowserWindow }}
     *  - ISOPEN: true면 동일 타입의 창이 이미 열려 있음
     *  - WINDOW: 열린 창의 BrowserWindow 인스턴스
     *========================================================================*/
    getCheckAlreadyOpenWindow(OBJTY) {

        let oCurrWin    = REMOTE.getCurrentWindow();
        let aChildWin   = oCurrWin.getChildWindows();
        let iChildWinCnt = aChildWin.length;
        let sObjType    = OBJTY;

        if (iChildWinCnt <= 0) {
            return { ISOPEN: false };
        }

        for (var i = 0; i < iChildWinCnt; i++) {

            var oWin = aChildWin[i];

            if (oWin.isDestroyed()) continue;

            try {

                const sBrowserUrl = oWin.getURL();
                const oWebPref    = WSUTIL.QueryString.parse(sBrowserUrl);
                const sType       = oWebPref.OBJTY;

                if (sObjType != sType) continue;

                oWin.focus();

                return { ISOPEN: true, WINDOW: oWin };

            } catch (error) {
                continue;
            }

        }

        return { ISOPEN: false };

    },


    /*========================================================================
     * [Class] QueryString
     * Object ↔ QueryString 변환 유틸리티 클래스.
     * Deep 구조(Object, Array) 지원 (qs 라이브러리 사용).
     *
     * @example
     * const url = WSUTIL.QueryString.build("https://test.com", { a: 1, USERINFO: { ID: "XX" } });
     * const obj = WSUTIL.QueryString.parse(url);
     *========================================================================*/
    QueryString: class {

        /**
         * Object를 QueryString으로 직렬화하여 URL에 붙입니다.
         * @param {string} url    - 기본 URL
         * @param {Object} [params={}] - QueryString으로 변환할 파라미터 Object
         * @returns {string} 완성된 URL
         */
        static build(url, params = {}) {
            const query = QS.stringify(params);
            if (!query) return url;
            return url + (url.includes('?') ? '&' : '?') + query;
        }

        /**
         * URL의 QueryString을 파싱하여 Object로 반환합니다.
         * @param {string} [url=''] - 파싱할 URL
         * @returns {Object} 파싱된 QueryString Object
         */
        static parse(url = '') {
            if (!url) return {};
            return QS.parse(new URL(url).search, { ignoreQueryPrefix: true });
        }

    }
    /************** end of Class (QueryString) ***************/

};


/*==========================================================================
 * [Section 5] 모듈 내보내기
 *==========================================================================*/

module.exports = WSUTIL;