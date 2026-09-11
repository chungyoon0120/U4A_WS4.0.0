/* 
*📦----------------------------------------------------------------------*
* Module       : util.js
* Creator      : SOCCERHS
* Created On   : 2026-04-01
* Description  : 개발 브라우저에 필요한 유틸리티 리소스 주입
*----------------------------------------------------------------------*
*/

module.exports = async function () {
    "use strict";

    /****************************************************************************
     * 🌐 Global Variables
     ****************************************************************************/
    window.u4adevb = window.u4adevb || {};
    window.u4adevb.util = window.u4adevb.util || {};

    let oUtil = {};

    /**
     * @class ServerEventHighlighter
     * @description U4A 컨트롤 분석, 시각화 및 데이터 추출 통합 클래스
     */
    class ServerEventHighlighter {

        static _backupMap = new Map();
        static _keyword = "oU4A.f_UIattachEvent";
        static _props = ["outline", "outlineOffset", "backgroundColor", "boxShadow", "zIndex", "cursor", "boxSizing"];

        // 서버 이벤트 및 페이지 ID 추출을 위한 정규식 (고정 패턴)
        static _evtRegex = /oU4A\.f_UIattachEvent\(.*?,.*?,.*?,.*?,'(.*?)',.*?,.*?'(EV_.*?)'/;

        /**
         * 강조 효과 적용 (기존 로직 유지 + 데이터 분석 통합)
         */
        static apply(sKeyword = this._keyword) {
            const oRegistry = sap.ui.core.Element.registry.all();
            let iCount = 0;

            for (let sId in oRegistry) {
                const oControl = oRegistry[sId];

                // 1. 분석 수행 (서버 이벤트가 있는지 확인)
                const aEvents = this._analyzeControl(oControl, sKeyword);
                if (aEvents.length === 0) continue;

                const oDom = oControl.getDomRef();
                if (!oDom || oDom.style.outline.includes("dashed")) continue;

                // 2. 스타일 백업 및 강조
                this._backupAndHighlight(oDom, sId, aEvents[0].serverEvent);
                iCount++;
            }

            console.log(`[U4A] highlighted ${iCount} elements`);
        }

        /**
         * 분석 데이터 목록 획득 (Electron 전송용)
         */
        static getList(sKeyword = this._keyword) {

            const oRegistry = sap.ui.core.Element.registry.all();
            const aTotalResults = [];

            for (let sId in oRegistry) {
                const oControl = oRegistry[sId];

                // Usage Area에 포함된 UI는 대상
                if (this._isIncludeUsageArea(oControl) === true) {
                    continue;
                }

                const aEvents = this._analyzeControl(oControl, sKeyword);

                if (aEvents.length > 0) {
                    aTotalResults.push(...aEvents);
                }
            }

            return aTotalResults;
        }

        /**
         * [Helper] 선택된 컨트롤이 개발 툴 자체 UI(Usage Area)인지 확인
         * (Usage Area 내부의 클릭은 무시하기 위함)
         */
        static _isIncludeUsageArea(oControl) {

            if (!oControl) return;
            if (typeof oControl?.getDomRef !== "function") return;

            let oControlDom = oControl.getDomRef();
            if (!oControlDom) return;

            // ".u4aMUsageArea" 클래스를 가진 영역 내부에 있는지 체크
            const aUsageAreaNodes = Array.from(document.querySelectorAll(".u4aMUsageArea"));
            return aUsageAreaNodes.some(areaDom => areaDom.contains(oControlDom));

        }

        /**
         * @private
         * 컨트롤 인스턴스를 분석하여 U4A 이벤트 정보를 배열로 반환
         */
        static _analyzeControl(oCtrl, sKw) {

            const mEvt = oCtrl.mEventRegistry;
            if (!mEvt) return [];

            const aFound = [];
            const sUiType = oCtrl.getMetadata().getName();

            Object.keys(mEvt).forEach(sEventName => {

                const aHandlers = mEvt[sEventName];

                aHandlers.forEach(oHandler => {

                    const sFuncStr = oHandler.fFunction ? oHandler.fFunction.toString() : "";
                    if (!sFuncStr.includes(sKw)) return;

                    const aMatch = sFuncStr.match(this._evtRegex);

                    aFound.push({
                        // uiId: oCtrl.getId(),
                        // uiType: sUiType,
                        CEVENT_NAME: sEventName,
                        SEVENT_NAME: aMatch ? aMatch[2] : "",
                        OBJID: aMatch ? aMatch[1] : "",
                    });

                });

            });

            return aFound;
        }


        /**
         * @private
         * 기존 스타일 백업 및 강조 로직 통합
         */
        static _backupAndHighlight(oDom, sId, sEvtName) {

            // 백업
            const oBackup = { title: oDom.getAttribute("title") };
            this._props.forEach(p => oBackup[p] = oDom.style[p]);
            this._backupMap.set(sId, oBackup);

            // 강조 적용
            Object.assign(oDom.style, {
                boxSizing: "border-box",
                outline: "3px dashed #eb4d4b",
                outlineOffset: "2px",
                backgroundColor: "rgba(235, 77, 75, 0.2)",
                boxShadow: "0 0 0 4px rgba(235, 77, 75, 0.3)",
                zIndex: "99999",
                cursor: "help"
            });

            oDom.setAttribute("title", `[${sEvtName}] Control ID: ${sId}`);
        }

        /**
         * 강조 효과 제거 (기존 동일)
         */
        static clear() {

            this._backupMap.forEach((oBackup, sId) => {
                const oControl = sap.ui.getCore().byId(sId);
                const oDom = oControl?.getDomRef();
                if (!oDom) return;

                this._props.forEach(p => oDom.style[p] = oBackup[p]);
                oBackup.title ? oDom.setAttribute("title", oBackup.title) : oDom.removeAttribute("title");
            });

            this._backupMap.clear();

        }
    }

    /**
     * 서버 이벤트가 등록되어 있는 UI 표시 클래스
     */
    oUtil.ServerEventHighlighter = ServerEventHighlighter;

    /**
     * [Helper] OBJID가 속한 어플리케이션 이름 찾기
     */
    oUtil.getAppIdFromUI = function (oUI, sType = 'ID') {

        // 1. DOM 참조 확인 (공통)
        const oUIDom = oUI?.getDomRef?.();
        if (!oUIDom) return;

        // 2. 상위 부모 중 .u4aMUsageArea 탐색 (공통)
        const oUsageAreaDom = oUIDom.closest(".u4aMUsageArea");

        // 3. Usage Area에 속하는 경우 처리
        if (oUsageAreaDom) {
            // data-appid
            // const oUsageArea = sap.ui.getCore().byId(oUsageAreaDom.id);
            // // const sAppId = oUsageArea?._APPID;
            // const sAppSID = oUsageArea?._APPSID;

            const sAppSID = oUsageAreaDom.getAttribute("data-appsid");

            if (!sAppSID) return;

            // Usage Area 내부 로직도 필요시 분기 (현재는 둘 다 _APPID 반환)
            return sType === 'ID' ? sAppSID.split('|')[0] : sAppSID;
        }

        // 4. Main Application 영역인 경우
        const sAppSID = window?.LoU4A?.attr?.appSid;
        if (!sAppSID) return;

        /**
         * sType에 따른 결과 반환 (확장 지점)
         * 'ID'  : 'YLCY_TEST2100|006...' -> 'YLCY_TEST2100'
         * 'SID' : 'YLCY_TEST2100|006...' (그대로 반환)
         */
        return sType === 'ID' ? sAppSID.split('|')[0] : sAppSID;

    };


    /**
     * [Helper] 선택된 컨트롤이 개발 툴 자체 UI(Usage Area)인지 확인
     * (Usage Area 내부의 클릭은 무시하기 위함)
     */
    oUtil.isIncludeUsageArea = function (oControl) {

        if (!oControl) return;

        if (typeof oControl?.getDomRef !== "function") return;

        let oControlDom = oControl.getDomRef();
        if (!oControlDom) return;

        // ".u4aMUsageArea" 클래스를 가진 영역 내부에 있는지 체크
        const aUsageAreaNodes = Array.from(document.querySelectorAll(".u4aMUsageArea"));

        return aUsageAreaNodes.some(areaDom => areaDom.contains(oControlDom));

    }; // end of oUtil.isIncludeUsageArea


    /**
     * 실행 화면의 어플리케이션 계층 구조 정보 구하기
     */
    oUtil.getAppHireachy = function () {

        const aTree = [];

        // 1. 최상위(Root) APPID 추출
        const sFullId = window?.LoU4A?.attr?.appSid;

        if (!sFullId) return aTree;

        const rootAppId = sFullId.split('|')[0];

        // 2. 메인 루트 아이템 생성 (PKEY는 빈 값)
        aTree.push({
            PKEY: "",
            CKEY: rootAppId,
            APPID: rootAppId
        });

        // 3. 모든 .u4aMUsageArea 요소 추출
        const areaElements = Array.from(document.querySelectorAll(".u4aMUsageArea"));
        areaElements.forEach(dom => {

            // 현재 요소의 APPID 추출
            const oUI = sap.ui.getCore().byId(dom.id);
            if (!oUI) return;

            const currentAppId = oUI?._APPID || "";
            if (!currentAppId) {
                return;
            }

            // 4. 부모 APPID 결정
            // 내 상위에 다른 .u4aMUsageArea가 있는지 확인
            const parentDom = dom.parentElement.closest(".u4aMUsageArea");
            let parentAppId = "";

            if (parentDom) {
                // 상위 Usage 영역이 있으면 그 영역의 APPID를 PKEY로 사용
                const oParentUI = sap.ui.getCore().byId(parentDom.id);
                parentAppId = oParentUI ? oParentUI._APPID : rootAppId;
            } else {
                // 상위에 아무것도 없으면 메인 루트가 부모
                parentAppId = rootAppId;
            }

            // 5. 결과 배열에 푸시
            aTree.push({
                PKEY: parentAppId,
                CKEY: currentAppId,
                APPID: currentAppId
            });

        });

        return aTree;

    }; // end of oUtil.getAppHireachy


    /**
     * UI의 이벤트 함수를 String으로 변환 후, 
     * 해당 문자열에서, 'oU4A.f_UIattachEvent' 키워드에서 사용한 파라미터 Arguments 추출
     */
    oUtil.extractUIEventScriptArgs = function (codeStr) {

        // 1. f_UIattachEvent( ... ) 내부의 내용만 캡처
        const match = codeStr.match(/f_UIattachEvent\s*\(([\s\S]*)\)/);
        if (!match) return [];

        const argsContent = match[1];
        const args = [];

        // 2. 콤마(,)를 기준으로 나누되, 따옴표 내부에 있는 콤마는 무시하는 정규식
        // 이 정규식은 문자열('...'), 함수호출(...), 혹은 일반 텍스트를 구분합니다.
        const argRegex = /'([^']*)'|([^,]+)/g;
        let part;

        while ((part = argRegex.exec(argsContent)) !== null) {
            // part[1]은 따옴표 내부 값, part[2]는 따옴표가 없는 일반 값
            let value = (part[1] !== undefined ? part[1] : part[2]).trim();

            // 빈 문자열이거나 null/undefined 계열 처리
            args.push(value);
        }

        return args;

    }; // end of oUtil.extractUIEventScriptArgs


    /**
     * UI 인스턴스로 Event 정보 추출하기
     */
    oUtil.getEventInfoFromUI = function (oUI) {

        if (!oUI) {
            return { RETCD: "E", STCOD: "E001", MSGTX: "UI 인스턴스 파라미터 누락!" };
        }

        let oEventRegi = oUI.mEventRegistry;

        // UI에 등록된 이벤트명 추출
        let aRegistryEventNames = Object.keys(oEventRegi);
        if (!aRegistryEventNames.length) {
            return { RETCD: "E", STCOD: "E002", MSGTX: "등록된 이벤트가 없습니다." };
        }

        let oMeta = oUI.getMetadata();
        if (!oMeta) {
            return { RETCD: "E", STCOD: "E003", MSGTX: "메타 정보가 없습니다." };
        }

        let oEventAllInfo = oMeta.getAllEvents();
        if (!oEventAllInfo) {
            return { RETCD: "E", STCOD: "E004", MSGTX: "메타의 이벤트 정보가 없습니다." };
        }

        let aMetaEventAllInfo = Object.keys(oEventAllInfo);
        if (!aMetaEventAllInfo.length) {
            return { RETCD: "E", STCOD: "E005", MSGTX: "메타의 이벤트 정보가 없습니다." };
        }

        /**
         * UI에 등록된 이벤트 중, 메타 정보에 있는 이벤트만 추출
         */
        let aRegistryEvent = [];

        for (const sEventName of aRegistryEventNames) {

            let sFindEventName = aMetaEventAllInfo.find(eventName => eventName === sEventName);
            if (!sFindEventName) {
                continue;
            }

            aRegistryEvent.push(sFindEventName);

        }

        if (!aRegistryEvent.length) {
            return { RETCD: "S", RDATA: aRegistryEvent };
        }

        let aRegistEvents = [];

        /**
         * 추출된 이벤트에서 서버 이벤트, 클라이언트 이벤트 정보를 추출한다.
         */
        for (const sEventName of aRegistryEvent) {

            let aEventList = oEventRegi[sEventName];

            if (!aEventList.length) {
                continue;
            }

            /**
             * 이벤트 중에서, 내가 등록한 이벤트만 추출
             */
            for (const oEventInfo of aEventList) {

                let fEventFunction = oEventInfo.fFunction;
                if (typeof fEventFunction !== "function") {
                    continue;
                }

                /**
                 * 이벤트 함수에서 특정 키워드가 존재하는지 확인
                 */
                let sEventString = String(fEventFunction);

                let aEventScriptArgs = oUtil.extractUIEventScriptArgs(sEventString);
                if (!aEventScriptArgs.length) {
                    continue;
                }

                // 서버 이벤트명
                let sServerEventName = aEventScriptArgs[6] || "";

                // 클라이언트 이벤트 함수명
                let sClientEvent = aEventScriptArgs[7] || "";

                // 클라이언트 이벤트 존재 유무                
                let bisExistsCEVT = (sClientEvent === "" || sClientEvent === "null" ? false : true);

                aRegistEvents.push({

                    // // UI가 속한 APP의 ID 정보
                    // APPID: oUtil.getAppIdFromUI(oUI, "ID") || "",

                    // // UI가 속한 APP의 SID 정보
                    // APPSID: oUtil.getAppIdFromUI(oUI, "SID") || "",

                    // 이벤트명
                    EVTNM: sEventName,

                    // 클라이언트 이벤트 존재 유무                    
                    IS_EXISTS_CEVT: bisExistsCEVT,

                    // 클라이언트 이벤트명
                    CEVT: sClientEvent,

                    // 서버 이벤트명
                    SEVT: sServerEventName

                });

            }

        }

        return { RETCD: "S", RDATA: aRegistEvents };

    }; // end of oUtil.getEventInfoFromUI


    /**
     * [Helper] 컨트롤에서 OBJID를 찾지 못했을 때 예외 처리 로직
     * 1. 활성 요소(Active Element) 확인
     * 2. 부모 요소(Parent)를 최대 5단계까지 거슬러 올라가며 확인
     */
    oUtil.excepFindControl = function (oControl) {

        if (!oControl) return null;

        // 안전하게 OBJID 데이터를 꺼내는 내부 함수
        const _getObjId = (oTarget) => {
            if (oTarget && typeof oTarget.data === "function") {
                return oTarget.data("OBJID") || null;
            }
            return null;
        };

        // // 1차: 현재 포커스 된 요소 확인
        // const oActiveElement = sap.ui.core.Element.getActiveElement();
        // const sActiveId = _getObjId(oActiveElement);

        // if (sActiveId) {                    
        //     return sActiveId;
        // }

        // 2차: 부모 요소 탐색 (Max 5 Depth)
        let oCurrent = oControl;
        for (let i = 0; i < 5; i++) {
            oCurrent = oCurrent.getParent();

            if (!oCurrent) break; // 부모가 없으면 종료

            const sParentId = _getObjId(oCurrent);
            if (sParentId) {
                return sParentId;
            }
        }

        return null;

    }; // end of oUtil.excepFindControl


    /**
     * [Helper] UI에 등록된 이벤트의 클라이언트 이벤트 소스 추출하기
     */
    oUtil.getClientScripts = async function (oUiInfo) {

        const { promise, resolve } = Promise.withResolvers();

        let sAPPSID = oUiInfo.APPSID;        // UI가 속한 APP의 SID 정보
        let aEventInfo = oUiInfo.EVENT_INFOS;   // UI에 등록된 이벤트 목록

        // Event Bus 통신 및 콜백을 받기위한 채널 및 이벤트 아이디 정보
        let sChannelId = u4adevb.conf.userAgent; // DEV Browser UserAgent        
        let sEventId = `${sAPPSID}-message`;
        let sEventId_cb = sEventId + "_cb";

        let evalScript = `
        (function(){
            "use strict";
            
            function getScripts(aCEVT) {

                let aScriptResult = [];
                if(!aCEVT || Array.isArray(aCEVT) === false || aCEVT.length === 0){
                    return aScriptResult;
                }

                for(var oItem of aCEVT){

                    let sCEVT = oItem?.CEVT;
                    if(!sCEVT){                
                        continue;
                    }

                    let sErrCode = "E999";
                    try {
                        
                        sErrCode = "E001";                
                        if(typeof eval(sCEVT) !== 'function'){
                            continue;
                        }

                        sErrCode = "E002";
                        let sScript = eval(sCEVT + ".toString()");

                        oItem.CEVT_SCRIPT = sScript;

                        aScriptResult.push(oItem);

                    } catch (error) {

                        let sErrMsg = "[DEV_BROWSER-" + sErrCode + "]" + "클라이언트 스크립트 구하는중 오류 발생!";
                        console.error(sErrMsg, error);
                        continue;

                    }           

                }

                return aScriptResult;
                
            }
            
            let aCEVT = ${JSON.stringify(aEventInfo)};

            let aResult = getScripts(aCEVT);

            let sChannelId = "${sChannelId}";
            let sEventId = "${sEventId_cb}";

            let _oEventBus = sap.ui.getCore().getEventBus();
                _oEventBus.publish(sChannelId, sEventId, aResult);

        })();
        `;

        // 이벤트 버스를 이용해서 전달할 파라미터
        let message = {
            prccd: "evalScript",
            payload: {
                evalScript: evalScript,
            }
        };

        let _oEventBus = sap.ui.getCore().getEventBus();

        // 이벤트 버스로 전송 후 콜백 받을 이벤트
        _oEventBus.subscribeOnce(sChannelId, sEventId_cb, (channelId, eventId, message) => {
            resolve(message);
        });

        _oEventBus.publish(sChannelId, sEventId, message);

        return await promise;

    }; // end of oUtil.getClientScripts


    /**
     * [Helper] Custom Css 정보 추출
     */
    oUtil.getCustomCss = async function (oUiInfo) {

        const { promise, resolve } = Promise.withResolvers();

        let sOBJID = oUiInfo.OBJID;        // UI의 OBJID
        let sAPPSID = oUiInfo.APPSID;       // UI가 속한 APP의 SID 정보        

        // Event Bus 통신 및 콜백을 받기위한 채널 및 이벤트 아이디 정보
        let sChannelId = u4adevb.conf.userAgent; // DEV Browser UserAgent        
        let sEventId = `${sAPPSID}-message`;
        let sEventId_cb = sEventId + "_cb";

        let sEvalScript = `
            (function(){
                "use strict";
                
                const oRES = {
                    RETCD: "E",
                    STCOD: "",
                    RTMSG: "",
                    RDATA: {
                        styleClass: ""
                    }
                };
                
                const sOBJID = "${sOBJID}";		

                let sErrCode = "";
                try{
                    
                    sErrCode = "E001";
                    let sStyleClass = eval(sOBJID + ".data('styleClass')");

                    oRES.RETCD ="S";
                    oRES.RDATA.styleClass = sStyleClass;

                } catch (error){    

                    let sErrMsg = "[DEV_BROWSER-" + sErrCode + "]" + " 커스텀 CSS 구하는중 오류 발생!";		

                    oRES.RETCD ="E";
                    oRES.STCOD = sErrCode;
                    oRES.RTMSG = sErrMsg;
                    
                    console.error(sErrMsg, error);
                    
                }		
                
                let sChannelId = "${sChannelId}";
                let sEventId   = "${sEventId_cb}";
                
                let _oEventBus = sap.ui.getCore().getEventBus();
                    _oEventBus.publish(sChannelId, sEventId, oRES);	

            })();
        `;

        // 이벤트 버스를 이용해서 전달할 파라미터
        let message = {
            prccd: "evalScript",
            payload: {
                evalScript: sEvalScript,
            }
        };

        let _oEventBus = sap.ui.getCore().getEventBus();

        // 이벤트 버스로 전송 후 콜백 받을 이벤트
        _oEventBus.subscribeOnce(sChannelId, sEventId_cb, (channelId, eventId, message) => {
            resolve(message);
        });

        _oEventBus.publish(sChannelId, sEventId, message);

        return await promise;

    };

    /**
     * [Helper] U4A 환경인지 여부 체크
     */
    oUtil.checkIsU4A = function () {
        return !!document.getElementById("U4A_HIDDEN_AREA");
    };

    /**
     * @function showBrowserMessage
     * @description sap.m.MessageToast 스타일의 브라우저 알림 함수
     * @param {string} sMessage - 출력할 메시지 (개행 문자 \n 지원)
     * @param {object} mOptions - 옵션 객체 { type: 'S'|'E'|'W'|'I', duration: number }
     */
    // oUtil.showBrowserMessage = function(sMessage, mOptions) {

    //     // 1. 기본값 설정 (Early Return 패턴 및 파라미터 핸들링)
    //     const sId = 'u4a-browser-status-bar';
    //     const mDefaultConfig = {
    //         type: 'I',        // 기본 타입: Info
    //         duration: 3000    // 기본 노출 시간: 3초
    //     };

    //     // 옵션이 없거나 객체가 아닐 경우를 대비한 병합
    //     const oConfig = Object.assign({}, mDefaultConfig, mOptions);

    //     // 2. 기존 메시지 제거 (중복 방지)
    //     const oExistingMsg = document.getElementById(sId);
    //     if (oExistingMsg) {
    //         oExistingMsg.remove();
    //     }

    //     // 3. 타입별 테마 설정
    //     const mThemes = {
    //         'S': { bg: '#2e7d32', icon: '✅', label: 'SUCCESS' },
    //         'E': { bg: '#c62828', icon: '🚫', label: 'ERROR' },
    //         'W': { bg: '#f9a825', icon: '⚠️', label: 'WARNING' },
    //         'I': { bg: '#1565c0', icon: 'ℹ️', label: 'INFO' }
    //     };
    //     const oTheme = mThemes[oConfig.type.toUpperCase()] || mThemes['I'];

    //     // 4. 엘리먼트 생성 및 개행 문자 적용
    //     const oDiv = document.createElement('div');
    //     oDiv.id = sId;
    //     oDiv.innerHTML = `
    //         <div style="display: flex; align-items: center; justify-content: center; gap: 10px;">
    //             <span style="font-size: 20px;">${oTheme.icon}</span>
    //             <span style="white-space: pre-wrap; word-break: break-all;">[${oTheme.label}] ${decodeURIComponent(sMessage)}</span>
    //         </div>
    //     `;

    //     // 5. 스타일 적용
    //     Object.assign(oDiv.style, {
    //         position: 'fixed',
    //         top: '0',
    //         left: '0',
    //         width: '100%',
    //         height: 'auto',
    //         minHeight: '50px',
    //         backgroundColor: oTheme.bg,
    //         color: '#ffffff',
    //         display: 'flex',
    //         alignItems: 'center',
    //         justifyContent: 'center',
    //         zIndex: '2147483647',
    //         fontWeight: '600',
    //         fontSize: '15px',
    //         boxShadow: '0 3px 6px rgba(0,0,0,0.2)',
    //         fontFamily: "'Segoe UI', Roboto, sans-serif",
    //         padding: '10px 20px',
    //         boxSizing: 'border-box',
    //         transition: 'all 0.4s cubic-bezier(0.23, 1, 0.32, 1)',
    //         opacity: '0',
    //         transform: 'translateY(-10px)',
    //         whiteSpace: 'pre-wrap' // 컨테이너 차원에서도 개행 허용
    //     });

    //     // 6. DOM 추가 및 애니메이션 효과
    //     document.documentElement.appendChild(oDiv);

    //     requestAnimationFrame(() => {
    //         oDiv.style.opacity = '1';
    //         oDiv.style.transform = 'translateY(0)';
    //     });

    //     // 7. 지정된 duration 후 자동 제거
    //     setTimeout(() => {
    //         if (!oDiv.parentElement) return;

    //         oDiv.style.opacity = '0';
    //         oDiv.style.transform = 'translateY(-20px)';

    //         setTimeout(() => oDiv.remove(), 400);
    //     }, oConfig.duration);
    // };


    /**
     * @function showBrowserMessage
     * @description Glassmorphism 디자인이 적용된 중앙 알림창
     */
    oUtil.showBrowserMessage = function (sMessage, mOptions) {
        const sId = 'u4a-modern-toast';
        const mDefaultConfig = { type: 'I', duration: 3500 };
        const oConfig = Object.assign({}, mDefaultConfig, mOptions);

        // 1. 기존 메시지 스택 처리 (살짝 위로 밀어내거나 제거)
        const oExistingMsg = document.getElementById(sId);
        if (oExistingMsg) { oExistingMsg.remove(); }

        // 2. 프리미엄 컬러 팔레트 (Semi-transparent)
        const mThemes = {
            'S': { bg: 'rgba(39, 174, 96, 0.85)', glow: '#2ecc71', icon: 'check_circle' },
            'E': { bg: 'rgba(192, 57, 43, 0.85)', glow: '#e74c3c', icon: 'error' },
            'W': { bg: 'rgba(243, 156, 18, 0.85)', glow: '#f1c40f', icon: 'warning' },
            'I': { bg: 'rgba(41, 128, 185, 0.85)', glow: '#3498db', icon: 'info' }
        };
        const oTheme = mThemes[oConfig.type.toUpperCase()] || mThemes['I'];

        // 3. 엘리먼트 생성
        const oDiv = document.createElement('div');
        oDiv.id = sId;

        // Google Material Icons 폰트 사용 가정 (없어도 유니코드 아이콘으로 대체 가능)
        // <div style="font-size: 32px; margin-bottom: 12px; filter: drop-shadow(0 0 8px ${oTheme.glow});">                  
        // </div>
        oDiv.innerHTML = `                
                <div style="font-size: 16px; font-weight: 500; letter-spacing: -0.5px; line-height: 1.5;">
                    ${decodeURIComponent(sMessage)}
                </div>                
            `;

        // 4. 스타일링: Glassmorphism & Flex
        // Object.assign(oDiv.style, {
        //     position: 'fixed',
        //     top: '50%',
        //     left: '50%',
        //     transform: 'translate(-50%, -50%) scale(0.8)',
        //     minWidth: '320px',
        //     padding: '25px 40px',
        //     backgroundColor: oTheme.bg,
        //     backdropFilter: 'blur(12px)', // 유리 효과 핵심
        //     webkitBackdropFilter: 'blur(12px)',
        //     color: '#ffffff',
        //     borderRadius: '24px',
        //     boxShadow: `0 20px 40px rgba(0,0,0,0.4), inset 0 0 0 1px rgba(255,255,255,0.2)`,
        //     display: 'flex',
        //     flexDirection: 'column',
        //     alignItems: 'center',
        //     justifyContent: 'center',
        //     zIndex: '2147483647',
        //     textAlign: 'center',
        //     opacity: '0',
        //     transition: 'all 0.5s cubic-bezier(0.19, 1, 0.22, 1)',
        //     fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif"
        // });
        // Object.assign(oDiv.style, {
        //     position: 'fixed',
        //     top: '50%',
        //     left: '50%',
        //     transform: 'translate(-50%, -50%) scale(0.8)',

        //     // [수정] 반응형 핵심 속성
        //     minWidth: '320px',
        //     maxWidth: '85vw',           // 모바일이나 좁은 창에서도 안전하게 85% 제한
        //     wordBreak: 'break-word',    // 단어 단위 개행 시도, 안되면 끊음            
        //     whiteSpace: 'pre-wrap',
        //     padding: '20px 30px',
        //     backgroundColor: oTheme.bg,
        //     backdropFilter: 'blur(12px)',
        //     webkitBackdropFilter: 'blur(12px)',
        //     color: '#ffffff',
        //     borderRadius: '20px',       // 너무 크면 텍스트가 많을 때 어색해서 살짝 줄임
        //     boxShadow: `0 20px 40px rgba(0,0,0,0.4), inset 0 0 0 1px rgba(255,255,255,0.2)`,
        //     display: 'flex',
        //     flexDirection: 'column',
        //     alignItems: 'center',
        //     justifyContent: 'center',
        //     zIndex: '2147483647',
        //     textAlign: 'center',
        //     opacity: '0',
        //     transition: 'all 0.5s cubic-bezier(0.19, 1, 0.22, 1)',
        //     fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif"
        // });
        
        // 4. 스타일링: Glassmorphism & Flex
        Object.assign(oDiv.style, {
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%) scale(0.8)',
            minWidth: '320px',
            
            // [수정] 텍스트가 많아질 경우를 대비해 패딩을 여기에 설정
            padding: '25px 20px', 

            backgroundColor: oTheme.bg,
            backdropFilter: 'blur(12px)',
            webkitBackdropFilter: 'blur(12px)',
            color: '#ffffff',
            borderRadius: '24px',
            boxShadow: `0 20px 40px rgba(0,0,0,0.4), inset 0 0 0 1px rgba(255,255,255,0.2)`,
            display: 'flex',
            flexDirection: 'column',
            
            // [수정] Flexbox 중앙 정렬 유지
            alignItems: 'center',
            justifyContent: 'center',
            
            zIndex: '2147483647',
            
            // [수정] 부모 요소에도 text-align 설정
            textAlign: 'center', 
            
            opacity: '0',
            transition: 'all 0.5s cubic-bezier(0.19, 1, 0.22, 1)',
            fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif"
        });

        document.body.appendChild(oDiv);

        // 5. 애니메이션 및 프로그레스 바 실행
        requestAnimationFrame(() => {
            oDiv.style.opacity = '1';
            oDiv.style.transform = 'translate(-50%, -50%) scale(1)';
        });

        // 6. 부드러운 퇴장
        setTimeout(() => {
            if (!oDiv.parentElement) return;
            oDiv.style.opacity = '0';
            oDiv.style.transform = 'translate(-50%, -45%) scale(0.95)';
            setTimeout(() => oDiv.remove(), 500);
        }, oConfig.duration);
    };


    /**
     * [Helper] Extension Content 영역에 메시지 전송
     */
    oUtil.sendExtensionContentMessage = function (message) {

        let oExtContDom = document.getElementById(u4adevb.conf.extension.EXTENSION_CONTENT_ID);
        if (!oExtContDom) {
            return;
        }

        let oEvt = new CustomEvent("message", { detail: message });

        oExtContDom.dispatchEvent(oEvt);

    };

    /** [Helper] 랜덤값 추출 */
    oUtil.getRandomChar = function (length = 8) {

        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        let result = '';

        for (let i = 0; i < length; i++) {
            // 문자셋 안에서 랜덤하게 한 글자씩 선택
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }

        return result;
    };

    /**
     * [Helper] 브라우저 영역에 Busy Dialog 실행
     */
    oUtil.openBusyDialog = function (oOptions) {

        if (oUtil._busydialog) {
            oUtil._busydialog.close();
            oUtil._busydialog = undefined;
        }
        oUtil._busydialog = new sap.m.BusyDialog(oOptions);
        oUtil._busydialog.open();

    };

    /**
     * [Helper] 브라우저 영역에 Busy Dialog 종료
     */
    oUtil.closeBusyDialog = function () {

        if (typeof oUtil._busydialog === "undefined") {
            return;
        }

        oUtil._busydialog.close();

        oUtil._busydialog = undefined;

    };

    /**
     *  [Helper] Extension 영역에 테마 변경하기
     */
    oUtil.setExtensionApplyTheme = function (sThemeName) {

        var oSendParams = {
            target: "EXT_SIDE_VIEW",
            action: "APPLY_THEME",
            payload: {
                themeName: sThemeName
            }
        };

        oUtil.sendExtensionContentMessage(oSendParams);

    };

    oUtil.closeExtensionSidePanel = function(){

        let oSendParams = {
            target: "EXT_BACK",
            action: "CLOSE_EXTENSION",
            payload: {

            }
        };

        oUtil.sendExtensionContentMessage(oSendParams);

    };


    u4adevb.util = oUtil;

};