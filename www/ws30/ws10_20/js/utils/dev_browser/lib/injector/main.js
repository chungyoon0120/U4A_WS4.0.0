/* 
*📦----------------------------------------------------------------------*
* Module       : main.js
* Creator      : SOCCERHS
* Created On   : 2026-04-01
* Description  : 개발 브라우저에 필요한 메인 리소스 주입
*----------------------------------------------------------------------*
*/

module.exports = async function () {
    "use strict";

    /****************************************************************************
     * 🌐 Global Variables
     ****************************************************************************/

    window.u4adevb = window.u4adevb || {};

    if (!u4adevb.util.checkIsU4A()) {
        console.warn("[injectScript - main.js] not a U4A environment");
        return;
    }

    // extension에서 u4a 에 파라미터 전송할 커스텀 이벤트 dom id
    const EXTENSION_WEB_ID = u4adevb.conf.extension.EXTENSION_WEB_ID;
    const EXTENSION_CONTENT_ID = u4adevb.conf.extension.EXTENSION_CONTENT_ID;
    const VIEW_NAME = 'U4A_WS';

    // Node.js로 데이터를 보내는 브릿지 함수 래핑
    u4adevb.onCallback = (oParams) => window.__u4aDevBrowserCallback && window.__u4aDevBrowserCallback(oParams);


    /****************************************************************************
     * 🔒 Private functions
     ****************************************************************************/

    /**
     * Extension에서 전송한 데이터를 수신 받기 위한 
     * I/F 수신 이벤트(onmessage)
     */
    function _extensionMessage(e) {

        let message = e.detail;

        console.log(`[ ${VIEW_NAME} ] - onMessage`, message);

        // 요청 Target이 내가 아니면 빠져나감(이건 로직이 샌것임.)
        if (message.target !== VIEW_NAME) {
            return;
        }

        let oSendParams = {
            PRCCD: "EXTENSION_ONMESSAGE",
            PARAM: message
        };

        u4adevb.onCallback(oSendParams);

    } // end of _extensionMessage


    /**
     * Extension에서 전송한 데이터를 수신 받기 위한 I/F 용 Dom 생성 후,
     * 수신 이벤트(onmessage) 등록
     */
    function _attachExtensionEvent() {

        let oExtWebDom = document.getElementById(EXTENSION_WEB_ID);
        if (!oExtWebDom) {
            oExtWebDom = document.createElement("div");
            oExtWebDom.id = EXTENSION_WEB_ID;
            oExtWebDom.style.display = "none";
            document.body.appendChild(oExtWebDom);
        }

        oExtWebDom.addEventListener("message", _extensionMessage);

    } // end of _attachExtensionEvent

    /**
     * 브라우저 타이틀에 DEV MODE Prefix 지정하기
     */
    function _setTitlePrefix() {

        // const PREFIX = `[ 🛠️ DEV MODE ] `;
        const PREFIX = `[ 🛠️ U4A Workspace - DEV MODE ] `;
        // const PREFIX = `[🧪 DEV - U4A Workspace] `;
        // const PREFIX = `[ 🚧 DEV ]`;

        // 1. 타이틀 변경 실행 함수
        const enforceTitle = () => {
            const currentTitle = document.title;

            // [Early Return] 타이틀이 비어있으면 처리하지 않음
            if (!currentTitle) {

                // 타이틀 변경 수행
                document.title = PREFIX;

                return;
            }

            // [Early Return] 이미 Prefix가 붙어있으면 종료
            if (currentTitle.startsWith(PREFIX)) {
                return;
            }

            // 타이틀 변경 수행
            document.title = PREFIX + currentTitle;
        };

        // 2. 옵저버 및 초기화 설정 함수
        const initObserver = () => {
            const titleElement = document.querySelector('title');

            // [Early Return] <title> 태그가 DOM에 없으면 관찰 불가하므로 종료
            if (!titleElement) {
                return;
            }

            // MutationObserver: 타이틀 태그의 내용 변경을 감지
            const observer = new MutationObserver(() => {
                enforceTitle();
            });

            observer.observe(titleElement, {
                childList: true,
                subtree: true,
                characterData: true
            });

            // 감시 시작 전 1회 강제 실행
            enforceTitle();
        };

        initObserver();

    } // end of _setTitlePrefix


    /**
     * 실제 이벤트 리스너 등록 로직
     */
    function _registerEventListeners() {

        window.addEventListener('click', async (e) => {

            console.log("**log: click");

            // Ctrl 키를 눌러야 동작함!!
            if (!e.ctrlKey) {
                return;
            }

            // SAP UI5 환경이 아니면 무시
            if (typeof sap === "undefined") return;
            if (!sap?.ui?.core?.Element?.closestTo) return;

            // 클릭된 DOM에서 가장 가까운 UI5 Control 찾기
            let oControl = sap.ui.core.Element.closestTo(e.target);
            if (!oControl) return;

            // OBJID 추출 (없으면 예외 탐색 실행)
            let sOBJID = oControl.data("OBJID") || u4adevb.util.excepFindControl(oControl);
            if (!sOBJID) return;

            // 선택한 UI가 속한 어플리케이션명 구하기
            let sAPPID = u4adevb.util.getAppIdFromUI(oControl, "ID");
            let sAPPSID = u4adevb.util.getAppIdFromUI(oControl, "SID");

            /**
             * UI에 등록된 이벤트 정보 구하기 (서버 이벤트, 클라이언트 이벤트)
             */
            let aEventInfos = [];

            let oEventInfo = u4adevb.util.getEventInfoFromUI(oControl);
            if (oEventInfo.RETCD === "S") {
                aEventInfos = oEventInfo.RDATA;
            }

            // 이벤트 정보가 있을 경우 클라이언트 이벤트 소스를 추출한다.
            if (aEventInfos.length) {

                let oUiInfo = {
                    APPSID: sAPPSID,
                    EVENT_INFOS: aEventInfos,
                };

                // UI에 등록된 이벤트의 클라이언트 이벤트 소스 추출하기
                let aClientEventInfo = await u4adevb.util.getClientScripts(oUiInfo);

                for (var oItem of aEventInfos) {
                    let oFindEvt = aClientEventInfo.find(e => e.CEVT === oItem.CEVT);
                    if (oFindEvt) {
                        oItem.CEVT_SCRIPT = oFindEvt.CEVT_SCRIPT;
                    }
                }

            }


            /**
             * UI에 등록된 커스텀 CSS 추출
             */
            let oUiInfo = {
                OBJID: sOBJID,
                APPSID: sAPPSID,
            };

            let sCustomCss = "";
            let oCustomCssResult = await u4adevb.util.getCustomCss(oUiInfo);
            if (oCustomCssResult.RETCD === "S") {

                let oRDATA = oCustomCssResult.RDATA;

                sCustomCss = oRDATA.styleClass;

            }

            // 액션 데이터 구성
            let oActionInfo = {
                EVTNM: "click",
                OBJID: sOBJID,
                APPID: sAPPID || "",
                APPSID: sAPPSID,
                EVENT_INFOS: aEventInfos,
                CUSTOM_CSS: sCustomCss || "",
                IS_CURR_APP: true
            };

            // Usage 영역 여부 체크
            let bIsInclude = u4adevb.util.isIncludeUsageArea(oControl);
            if (bIsInclude === true) {

                console.log("selected UI is inside a UsageArea");

                oActionInfo.IS_CURR_APP = false;
                // return;
            }

            // e.preventDefault(); // 기본 동작 차단

            let oSendParams = {
                PRCCD: "USER_ACTION",
                PARAM: oActionInfo
            };

            u4adevb.onCallback(oSendParams);

        }, true); // useCapture: true



        // F5 감지시, 사이드 패널을 접는다.
        window.addEventListener('beforeunload', function(){

            u4adevb.util.closeExtensionSidePanel();

        });


    } // end of _registerEventListeners


    /**
     * 테마 변경 이벤트
     */
    function _attachThemeChange() {
        sap.ui.getCore().attachThemeChanged(function (oEvent) {
            const sTargetTheme = oEvent.getParameter("theme");

            // 테마 판단 로직: 다크 테마면 라이트(sap_horizon)로, 아니면 다크(sap_horizon_dark)로 설정
            const sApplyTheme = sTargetTheme.endsWith("dark") ? "sap_horizon" : "sap_horizon_dark";

            // Extension에 테마 변경을 전달하는 공통 함수
            const fnNotifyExtension = () => {
                if (window.u4adevb && u4adevb.util) {
                    u4adevb.util.setExtensionApplyTheme(sApplyTheme);
                }
            };

            // 비동기 실행 (브라우저 유휴 시간 활용 또는 지연 실행)
            if (window.requestIdleCallback) {
                window.requestIdleCallback(fnNotifyExtension);
            } else {
                // requestIdleCallback 미지원 시 1초 뒤 실행 (기존 로직 유지)
                setTimeout(fnNotifyExtension, 1000);
            }
        });
    } // end of _attachThemeChange


    /**
     * UsageArea 감지 후 추가 및 삭제 시 APP의 계층구조 정보를 Extension에 전달한다.
     */
    function _observeUsageArea() {

        // // APP의 계층구조 정보를 Extension에 전달한다.
        // const sendAppHireInfo = () => {

        //     const aAppInfo = u4adevb.util.getAppHireachy();

        //     let oParams = {                
        //         APP_INFO: aAppInfo || []
        //     };

        //     let oSendParams = {
        //         target: "EXT_SIDE_VIEW",
        //         action: "SHOW_UI_INFO",
        //         payload: oParams
        //     };

        //     u4adevb.util.sendExtensionContentMessage(oSendParams);

        // }; // end of sendAppHireInfo


        // APP의 계층구조 정보를 Extension에 전달한다.
        const sendAppHireInfo = () => {

            const aAppInfo = u4adevb.util.getAppHireachy();

            let oParams = {                
                APP_INFO: aAppInfo || []
            };

            let oSendParams = {
                target: "EXT_SIDE_VIEW",
                action: "SHOW_APP_INFO",
                payload: oParams
            };

            u4adevb.util.sendExtensionContentMessage(oSendParams);

        }; // end of sendAppHireInfo



        /**
         * @function handleUsageAreaMutation
         * 추가와 삭제를 모두 감지하며, 메인 스레드 점유를 최소화한 로직
         */
        const handleUsageAreaMutation = (mutationsList) => {

            for (let i = 0; i < mutationsList.length; i++) {
                const mutation = mutationsList[i];

                // 1. childList 변화가 아니면 즉시 통과
                if (mutation.type !== 'childList') continue;

                // --- [A] 노드 추가 감지 로직 ---
                if (mutation.addedNodes.length > 0) {
                    mutation.addedNodes.forEach(node => {
                        if (node.nodeType !== 1 || !node.classList.contains("u4aMUsageArea")) return;

                        console.log("✨ [added] UsageArea found:", node.id);

                        // 여기에 추가 시 실행할 로직 작성 (예: 초기화, 스타일 수정 등)          
                        // 비동기 실행 (브라우저 유휴 시간 활용 또는 지연 실행)
                        if (window.requestIdleCallback) {
                            window.requestIdleCallback(sendAppHireInfo);
                        } else {
                            // requestIdleCallback 미지원 시 1초 뒤 실행 (기존 로직 유지)
                            setTimeout(sendAppHireInfo, 1000);
                        }

                        return;

                    });
                }

                // --- [B] 노드 삭제 감지 로직 ---
                if (mutation.removedNodes.length > 0) {
                    mutation.removedNodes.forEach(node => {
                        if (node.nodeType !== 1 || !node.classList.contains("u4aMUsageArea")) return;

                        console.log("🗑️ [removed] UsageArea removed:", node.id);

                        // 여기에 추가 시 실행할 로직 작성 (예: 초기화, 스타일 수정 등)          
                        // 비동기 실행 (브라우저 유휴 시간 활용 또는 지연 실행)
                        if (window.requestIdleCallback) {
                            window.requestIdleCallback(sendAppHireInfo);
                        } else {
                            // requestIdleCallback 미지원 시 1초 뒤 실행 (기존 로직 유지)
                            setTimeout(sendAppHireInfo, 1000);
                        }

                        return;
                    });
                }
            }
        }; // end of handleUsageAreaMutation

        // 상위 고정 요소 감시 (UI5가 리렌더링해도 변하지 않는 부모)
        const targetNode = document.body;
        const observer = new MutationObserver(handleUsageAreaMutation);

        observer.observe(targetNode, {
            childList: true, // 직계 자식 및 하위 노드 추가/삭제 감시
            subtree: true    // 하위 모든 깊이의 자손까지 포함
        });

    } // end of _observeUsageArea

    // ==============================================================================
    //  ▶️ Module Start !!
    // ==============================================================================

    // Extension에서 전송한 데이터를 수신 받기 위한 I/F 용 수신 이벤트(onmessage) 등록
    _attachExtensionEvent();

    // UI5 테마 변경 감지
    _attachThemeChange();

    // 이벤트 리스너 등록 로직
    _registerEventListeners();

    // 타이틀 부분에 DEV MODE Prefix 설정
    _setTitlePrefix();

    // UsageArea가 있을 경우 변화 감지
    _observeUsageArea();

};