/**************************************************************************
 * ws_fn_03.js
 **************************************************************************/

(function (window, $, oAPP) {
    "use strict";

    var PATH = parent.PATH,
        APP = parent.APP,
        REMOTE = parent.REMOTE,
        REMOTEMAIN = parent.REMOTEMAIN,
        APPCOMMON = oAPP.common,
        PATHINFO = parent.PATHINFO,
        CURRWIN = REMOTE.getCurrentWindow(),
        SESSKEY = parent.getSessionKey(),
        BROWSKEY = parent.getBrowserKey(),
        IPCMAIN = REMOTE.require('electron').ipcMain,

        WSUTIL = parent.WSUTIL,
        SETTINGS = parent.require(PATHINFO.WSSETTINGS),
        WS_LANGU = SETTINGS.globalLanguage;

    /************************************************************************
     * 설정된 세션 타임아웃 시간 체크
     * **********************************************************************/
    oAPP.fn.fnSessionTimeoutCheck = function () {

        setTimeout(() => {

            // 브라우저의 세션 키
            var sSessionKey = parent.getSessionKey();

            // 설정된 세션 timeout 시간 도래 여부를 체크하기 위한 워커 생성
            oAPP.attr._oWorker = new Worker('./js/workers/u4aWsClientSessionWorker.js');

            // Session Time Worker onmessage 이벤트
            oAPP.attr._oWorker.onmessage = oAPP.fn.fnSessionTimeWorkerOnMessage;

            // 이벤트를 받으면 세션 타임을 초기화 한다.
            parent.IPCMAIN.on('if-session-time', oAPP.fn.fnIpcMain_if_session_time);

            // 로딩할때 세션 타임 시작을 전체 브라우저에 알린다.
            parent.IPCRENDERER.send("if-session-time", sSessionKey);

        }, 0);

    }; // end of oAPP.fn.fnSessionTimeoutCheck

    /************************************************************************
     * Session Time Worker onmessage 이벤트
     * **********************************************************************/
    oAPP.fn.fnSessionTimeWorkerOnMessage = function (e) {

        if (e.data != "X") {
            return;
        }

        // 워커 종료
        if (oAPP.attr._oWorker) {
            oAPP.attr._oWorker.terminate();
            delete oAPP.attr._oWorker;
        }

        // 서버 세션 워커 종료
        if (oAPP.attr._oServerWorker) {
            oAPP.attr._oServerWorker.terminate();
            delete oAPP.attr._oServerWorker;
        }

        // IPC MAIN 이벤트의 세션 타임 관련 이벤트 해제        
        parent.IPCMAIN.off('if-session-time', oAPP.fn.fnIpcMain_if_session_time);

        // Logout 버튼으로 Logout을 시도 했다는 Flag      
        oAPP.attr.isBrowserCloseLogoutMsgOpen = "X";

        let sTitle = oAPP.common.fnGetMsgClsText("/U4A/CL_WS_COMMON", "D85"), // Session Timeout
            sDesc = oAPP.common.fnGetMsgClsText("/U4A/MSG_WS", "349"), // Please Try Login Again!
            sIllustType = "tnt-SessionExpired",
            sIllustSize = "Dialog"; // [HTML5] sap 제거 — 구 enum 값=문자열(ws_common.js §2798 동일 컨벤션)

        oAPP.fn.fnShowIllustMsgDialog(sTitle, sDesc, sIllustType, sIllustSize, fnSessionTimeOutDialogOk);

    }; // end of oAPP.fn.fnSessionTimeWorkerOnMessage

    /************************************************************************
     * 클릭 & 키보드 이벤트 발생 시 세션 타임 초기화 시킨다.
     * **********************************************************************/
    oAPP.fn.fnWindowClickEventListener = function () {

        zconsole.log("윈도우 클릭했다!!");

        var sSessionKey = parent.getSessionKey();

        // 로딩할때 세션 타임 시작을 전체 브라우저에 알린다.
        parent.IPCRENDERER.send("if-session-time", sSessionKey);

    }; // end of oAPP.fn.fnWindowClickEventListener  

    /************************************************************************
     * UI COPY
     ************************************************************************
     * @param {String}  sFromKey
     * - 복사하는 영역
     * 
     * @param {Array}   aTarget
     * - 붙이기 가능한 영역
     * 
     * @param {Object}  ODATA
     * - 저장하려는 데이터
     ************************************************************************/
    oAPP.fn.setCopyData = function (sFromKey, aTarget, ODATA) {

        var FS = parent.FS,
            sClipboardJsonPath = parent.getPath("CLIPBOARD"),
            bIsExists = FS.existsSync(sClipboardJsonPath);

        // Clipboard.json 파일이 없다면 생성
        if (!bIsExists) {
            FS.writeFileSync(sClipboardJsonPath, JSON.stringify({}));
        }

        var oCopiedData = JSON.parse(FS.readFileSync(sClipboardJsonPath, 'utf-8'));

        // 이미 저장된 키가 있으면 지우고 시작한다.
        if (oCopiedData[sFromKey]) {
            delete oCopiedData[sFromKey];
        }

        // UI Copy 정보 기본 구조
        var oCopyData = {
            OBJTY: "",
            FROM: sFromKey, // 복사한 영역
            TARGET: aTarget || [], // 복사한 UI가 붙여넣기 할 수 있는 영역 리스트
            DATA: ODATA // 복사한 UI 정보
        }

        oCopiedData[sFromKey] = oCopyData;

        FS.writeFileSync(sClipboardJsonPath, JSON.stringify(oCopiedData));

        // Clipboard Copy Success!
        var sMsg = APPCOMMON.fnGetMsgClsText("/U4A/MSG_WS", "303");

        parent.showMessage(sap, 10, 'S', sMsg);

    }; // end of oAPP.fn.setCopyData

    /************************************************************************
     * Copy 한 UI 정보 구하기
     ************************************************************************
     * @param {String}  sTarget
     * - 붙여 넣을 영역 
     * 
     * @return {Array} 
     * - 붙여 넣을 영역에 해당하는 Copy 데이터들 수집하여 리턴
     ************************************************************************/
    oAPP.fn.getCopyData = function (sTarget) {

        var FS = parent.FS,
            sClipboardJsonPath = parent.getPath("CLIPBOARD"),
            bIsExists = FS.existsSync(sClipboardJsonPath);

        // clipboard.json 파일이 없으면 리턴..
        if (!bIsExists) {
            return [];
        }

        var oCopiedData = JSON.parse(FS.readFileSync(sClipboardJsonPath, 'utf-8'));

        var aKeys = [];

        for (var i in oCopiedData) {

            var sKeynm = i,
                oKeyData = oCopiedData[sKeynm];

            if (oKeyData == null) {
                continue;
            }

            if (sKeynm.startsWith("U4AWS") == false) {
                continue;
            }

            var aTargetData = oKeyData.TARGET;

            // Target 데이터가 Array 타입이 아니면 continue..
            if (Array.isArray(aTargetData) == false) {
                continue;
            }

            if (!aTargetData.find(TARGET => TARGET == sTarget)) {
                continue;
            }

            aKeys.push(oKeyData);

        }

        return aKeys;

    }; // end of oAPP.fn.getCopyData

    /************************************************************************
     * 해당 영역에 기 저장된 UI 정보가 있는지 확인하는 function
     ************************************************************************
     * @param {String}  sAreaKey
     * - 영역 구분 키
     * 
     * @return {Boolean} 
     * - true  : 해당 영역에 저장된 UI 정보가 있을 경우.
     * - false : 해당 영역에 저장된 UI 정보가 없을 경우.
     ************************************************************************/
    oAPP.fn.isExistsCopyData = function (sAreaKey) {

        var aCopyData = oAPP.fn.getCopyData(sAreaKey);

        if (aCopyData.length <= 0) {
            return false;
        }

        return true;

    }; // end of oAPP.fn.isExistsCopyData    

    /************************************************************************
     * ws의 설정 정보를 구한다.
     ************************************************************************/
    oAPP.fn.getSettingsInfo = function () {

        // Browser Window option
        var sSettingsJsonPath = PATHINFO.WSSETTINGS,

            // JSON 파일 형식의 Setting 정보를 읽는다..
            oSettings = parent.require(sSettingsJsonPath);
        if (!oSettings) {
            return;
        }

        return oSettings;

    }; // end of oAPP.fn.getSettingsInfo

    /************************************************************************
     * UI5로 만든 Window Menu를 닫는다.
     ************************************************************************/
    oAPP.fn.fnWindowMenuClose = function () {

        var $oWMenu = $(".u4aWsWindowMenu"),
            iMenuLength = $oWMenu.length;

        if (iMenuLength <= 0) {
            return;
        }

        for (var i = 0; i < iMenuLength; i++) {

            var oMenu = $oWMenu[i],
                sId = oMenu.id;

            var oMenuUI = sap.ui.getCore().byId(sId);
            if (oMenuUI == null) {
                continue;
            }

            if (oMenuUI instanceof sap.ui.unified.Menu == false) {
                continue;
            }

            oMenuUI.close();

        }

    }; // end of  oAPP.fn.fnWindowMenuClose

    /************************************************************************
     * U4A R&D 여부
     ************************************************************************/
    oAPP.fn.fnIsStaff = function () {

        var oUserInfo = parent.getUserInfo(),
            sUserId = oUserInfo.ID.toUpperCase();

        switch (sUserId) {
            case "YSHONG":
            case "SHHONG":
            case "PES":
            case "SOCCERHS":
                return true;
            default:
                return false;
        }

    }; // end of oAPP.fn.fnIsStaff

    /************************************************************************
     * 현재 화면에 Open 된 Dialog가 있는지 여부 확인
     ************************************************************************/
    oAPP.fn.fnCheckIsDialogOpen = function () {

        // [HTML5] UI5 다이얼로그(.sapMDialogOpen)뿐 아니라 HTML5 native <dialog open> 도 본다.
        //   변환 후 팝업/메시지박스/확인창/값도움/busy 가 전부 <dialog> 라, UI5 셀렉터만 보면
        //   HTML5 모달이 떠 있어도 "안 떠 있음"으로 오판 → 단축키/프로세스 가드가 무력화된다.
        if (document.querySelector(".sapMDialogOpen, dialog[open]")) {
            return true;
        }

        return false;

    }; // end of oAPP.fn.fnCheckIsDialogOpen

    /************************************************************************
     * SAP Icon Image 경로를 주는 펑션
     ************************************************************************/
    oAPP.fn.fnGetSapIconPath = function (sIcon) {

        if (sIcon == null) {
            return;
        }

        var sIconName = sIcon + ".gif";

        return PATH.join(APP.getAppPath(), "icons", sIconName);

    }; // end of oAPP.fn.fnGetSapIconPath

    /************************************************************************
     * WS20의 Change or Display 모드에 따른 UI 보이기 숨기기 bindProperty function
     ************************************************************************/
    oAPP.fn.fnUiVisibleBinding = function (bIsDispMode) {

        if (bIsDispMode == null) {
            return false;
        }

        var bIsDisp = (bIsDispMode == "X" ? true : false);

        return bIsDisp;

    }; // end of oAPP.fn.fnCssLinkAddPopupUiVisibleBinding     

    /************************************************************************
     * BIND 대상 모델 정보를 구한다.
     ************************************************************************/
    oAPP.fn.fnGetBindAttrData = function () {

        return new Promise(function (resolve, reject) {

            var sServerUrl = parent.getServerPath() + '/getBindAttrData',
                oAppInfo = parent.getAppInfo(),
                oFormData = new FormData();

            oFormData.append("CLSNM", oAppInfo.CLSID);

            sendAjax(sServerUrl, oFormData, function (oRes) {

                parent.setBusy('');

                resolve(oRes);

            });

        });

    }; // end of oAPP.fn.fnGetBindAttrData

    
    /************************************************************************
     * Mutation에서 Dialog 감지 예외 대상이 있는지 체크
     ************************************************************************/
    function _checkMutationExpDialog(){

        var aOpendDialog = $(".sapMDialogOpen");
        if(aOpendDialog.length === 0){
            return false;
        }

        let iOpendCount = aOpendDialog.length;
        for(var i = 0; i < iOpendCount; i++){

            let oDialogDom = aOpendDialog[i];
            if(!oDialogDom){
                continue;
            }

            let sDialogId = oDialogDom.id;
            let oDialog = sap.ui.getCore().byId(sDialogId);
            if(!oDialog){
                continue;
            }

            // Dialog에 Mutation 감지 예외 대상인지 확인
            let isExp = oDialog.data("MUTATION_EXCEP");
            if(isExp === "X"){                
                return true;
            }

        }
        
        return false;

    } // end of _checkMutationExpDialog

    /************************************************************************
     * Dialog의 Dom 정보를 감시한다.
     ************************************************************************
     * - 화면에 자식 윈도우 창이 여러개 떠있을 경우,
     *   메시지 팝업, Dialog 등이 화면에 떠있으면
     *   자식 윈도우에 가려져서 사용자가 인지를 못하므로
     *   Dialog가 뜨는걸 감지해서 자식 윈도우를 비활성화 했다가
     *   Dialog가 닫히면 자식 윈도우를 활성화 시키는 목적으로 만들어짐
     ************************************************************************/
    function _setDialogObserver() {

        // sap-ui-static 영역만 감지한다.
        var oSapUiStatic = document.getElementById("sap-ui-static");
        if (oSapUiStatic == null) {
            return;
        }

        // 감시자 인스턴스 만들기
        var observer = new MutationObserver(function (mutations) {
         
            // Dialog 중 감지 예외 대상인것 찾기
            let bIsExp = _checkMutationExpDialog();
            if(bIsExp === true){
                return;
            }

            // Open 된 Dialog가 없으면 숨겼던 child window 전체를 보여준다.
            var $oOpendDialog = $(".sapMDialogOpen");
            if (!$oOpendDialog.length) {

                oAPP.fn.fnChildWindowShow(true); // [ws_fn_02.js]
                return;
            }

            // // Dialog 중 감지 예외 대상인것 찾기
            // let bIsExp = _checkMutationExpDialog();
            // if(bIsExp === true){
            //     return;
            // }

            // Dialog 가 Open 되면 child window 전체를 숨긴다.
            oAPP.fn.fnChildWindowShow(false); // [ws_fn_02.js]

        });


        // 감지할 대상 DOM의 하위가 변화될때 감지하라는 옵션
        var config = {
            childList: true,
        };

        // // 감지할 대상 DOM의 하위가 변화될때 감지하라는 옵션
        // var config = {
        //     attributes: true,
        //     childList             : true,
        //     subtree               : true,
        //     attributeOldValue     : true,
        //     characterData         : true,
        //     characterDataOldValue : true,
        // };

        observer.observe(oSapUiStatic, config);

    }

    /************************************************************************
     * Dom 정보의 변화를 감지
     ************************************************************************/
    oAPP.fn.fnSetMutationObserver = function () {

        // Dialog 감시
        _setDialogObserver();
        

    }; // end of oAPP.fn.fnSetMutationObserver

    /************************************************************************
     * Illustration Pool에 TNT Theme를 등록한다.
     ************************************************************************/
    oAPP.fn.fnRegisterIllustrationPool = () => {

        jQuery.sap.require("sap.m.IllustrationPool");

        let oTntSet = {
            setFamily: "tnt",
            setURI: sap.ui.require.toUrl("sap/tnt/themes/base/illustrations")
        };

        let oPool = sap.m.IllustrationPool;

        // register tnt illustration set
        oPool.registerIllustrationSet(oTntSet, false);

    }; // end of oAPP.fn.fnRegisterIllustrationPool

    /************************************************************************
     * U4A icon 등록
     ************************************************************************/
    oAPP.fn.fnRegisterU4AIcons = () => {        

        parent.WSUTIL.getWsRegisterU4AIcons(sap);

    }; // end of oAPP.fn.fnRegisterU4AIcons

    oAPP.fn.fnRegisterSAPIcons = () => {

        jQuery.sap.require("sap.ui.core.IconPool");

        // Tnt Icons
        var oIconSet1 = {
            collectionName: "SAP-icons-TNT",
            fontFamily: "SAP-icons-TNT",
            fontURI: sap.ui.require.toUrl("sap/tnt/themes/base/fonts"),
            lazy: true
        };

        var oIconPool = sap.ui.core.IconPool;
        oIconPool.registerFont(oIconSet1);

        // BusinessSuite Icons
        var oIconSet2 = {
            collectionName: "BusinessSuiteInAppSymbols",
            fontFamily: "BusinessSuiteInAppSymbols",
            fontURI: sap.ui.require.toUrl("sap/ushell/themes/base/fonts"),
            lazy: true
        };

        oIconPool.registerFont(oIconSet2);

    };

    /************************************************************************
     * Illustration Message Dialog
     ************************************************************************
     * @param {String}  sTitle
     * - 메시지 제목
     * 
     * @param {String}   sDesc
     * - 메시지 내용
     * 
     * @param {String}  sIllustType
     * - illustration Type (sapui5 library 참조) 
     * 
     * @param {Function}  fnCallback
     * - 메시지 Dialog에서 확인 버튼 눌렀을때 콜백 펑션
     ************************************************************************/
    oAPP.fn.fnShowIllustMsgDialog = (sTitle, sDesc, sIllustType, sIllustSize, fnCallback) => {

        // [HTML5] 구 sap.m.IllustratedMessage + sap.m.Button + sap.m.Dialog → 네이티브 <dialog>.
        //   WS20 HTML5 빌드엔 실제 UI5 가 없고 sap 은 스텁(ws_html5_shell.js)이라 sap.m.* 생성자가
        //   존재하지 않아 `new sap.m.Button` 이 "is not a constructor" 로 크래시했다(세션 타임아웃/Trial 경로).
        //   → sap 의존을 전부 제거하고 동일 UX(중앙 일러스트 카드 + 확인)로 재현한다.
        //   진행/대기 카드(§16 2.3 fnIllustMsgDialogOpen)와 같은 테마 토큰·백드롭 컨벤션을 소비하되,
        //   여긴 '확인 버튼 + 콜백'이 필요한 경고 모달이라 푸터 버튼을 둔다(§2.1 헤더/푸터 규칙의 예외).
        //   sIllustSize(구 UI5 크기 enum)는 HTML5 에선 미사용(시그니처만 유지 — 호출부 무변경).
        var sDlgId = "illustMsgDialog";

        // illustType(구 UI5 tnt-*) → ① 삽화 SVG 파일(www/svg, <img> 로드) ② 폴백 FA 아이콘.
        //   ★ SVG 삽화가 이 모달의 UX 앵커 — §16 2.3 규칙: <img> 로 로드(인라인 금지, SVG 내부
        //     <style> 전역 누수 방지), 배경 투명(다크에서 흰블록 방지), 호스트 문서
        //     (www/ws30/ws10_20/) 기준 ../../svg/ 로 해석. 삽화 파일이 아직 없거나 로드 실패하면
        //     폴백 FA 아이콘(톤다운)으로 자동 대체 — 파일이 들어오는 즉시 그대로 표시된다.
        //   ※ 삽화 에셋 배치 위치: www/svg/session-expired.svg (세션만료) / www/svg/trial-lock.svg (Trial).
        function _artFile(sType) {
            switch (sType) {
                case "tnt-SessionExpired": return "session-expired.svg";
                case "tnt-Lock": return "trial-lock.svg";
                default: return "";
            }
        }
        function _icon(sType) {
            switch (sType) {
                case "tnt-SessionExpired": return "fa-hourglass-half";
                case "tnt-Lock": return "fa-lock";
                case "tnt-NoData":
                case "tnt-NoEntries": return "fa-inbox";
                default: return "fa-circle-info";
            }
        }

        // 삽화 SVG 절대 URL(§16 2.3 — new URL(rel, location.href)). 매핑 없으면 "".
        var sArtUrl = "";
        var sArtFile = _artFile(sIllustType);
        if (sArtFile) {
            var sRel = "../../svg/" + sArtFile;
            sArtUrl = sRel;
            try { sArtUrl = new URL(sRel, window.location.href).href; } catch (e) { }
        }

        // 스타일 1회 주입(§16 2.3 컨벤션 — 카드/텍스트는 테마 토큰, 백드롭은 옅은 중립).
        if (!document.getElementById("u4aWsSessStyle")) {
            var st = document.createElement("style");
            st.id = "u4aWsSessStyle";
            st.textContent =
                ".u4aWsSessDlg{border:0;padding:0;background:transparent;overflow:visible;" +
                "min-width:0;max-width:none;width:fit-content;box-shadow:none;border-radius:0}" +
                ".u4aWsSessDlg::backdrop{background:rgba(15,18,28,.32);backdrop-filter:blur(1.5px)}" +
                ".u4aWsSessCard{display:flex;flex-direction:column;align-items:center;gap:.5rem;" +
                "padding:1.7rem 2.2rem 1.45rem;text-align:center;min-width:18rem;max-width:24rem;" +
                "background:var(--surface-raised,#1b2128);color:var(--text,#fff);" +
                "border:1px solid var(--line,#33414f);border-radius:16px;" +
                "box-shadow:var(--popover-shadow,0 18px 50px rgba(0,0,0,.55));" +
                "animation:u4aWsSessIn .18s ease both}" +
                // 삽화 슬롯(UX 앵커) — 실제 SVG 삽화 <img> 가 오면 채우고, 없/실패 시 폴백 아이콘.
                ".u4aWsSessArt{width:8.5rem;height:8.5rem;display:flex;align-items:center;" +
                "justify-content:center;margin-bottom:.2rem}" +
                ".u4aWsSessArtImg{max-width:100%;max-height:100%;display:block}" +
                ".u4aWsSessArtFb{font-size:3rem;line-height:1;color:var(--text-muted,#9aa3ad)}" +
                ".u4aWsSessTitle{font-weight:700;font-size:1.06rem;letter-spacing:.2px}" +
                ".u4aWsSessTitle:empty{display:none}" +
                ".u4aWsSessDesc{font-size:.8125rem;color:var(--text-muted,#9aa3ad);line-height:1.5;" +
                "white-space:pre-line;min-height:1.1em}" +
                ".u4aWsSessFoot{margin-top:.75rem;display:flex;justify-content:center}" +
                ".u4aWsSessOk{min-width:5.5rem}" +
                "@keyframes u4aWsSessIn{from{opacity:0;transform:translateY(6px) scale(.97)}to{opacity:1;transform:none}}" +
                "@media(prefers-reduced-motion:reduce){.u4aWsSessCard{animation:none}}";
            document.head.appendChild(st);
        }

        // 삽화 적용 — 기본은 폴백 아이콘 표시(깨진 이미지 깜빡임 방지), SVG 로드 성공 시 스왑.
        //   삽화 파일이 없거나 404 여도 안전하게 폴백. 재진입 갱신에도 사용.
        function _applyArt(oNode) {
            var oImg = oNode.querySelector(".u4aWsSessArtImg");
            var oFb = oNode.querySelector(".u4aWsSessArtFb");
            oFb.className = "u4aWsSessArtFb fa-solid " + _icon(sIllustType);
            oFb.style.display = "";
            oImg.style.display = "none";
            oImg.onload = null; oImg.onerror = null;
            if (sArtUrl) {
                oImg.onload = function () { oImg.style.display = ""; oFb.style.display = "none"; };
                oImg.onerror = function () { oImg.style.display = "none"; oFb.style.display = ""; };
                oImg.src = sArtUrl;
            } else {
                oImg.removeAttribute("src");
            }
        }

        // 이미 존재하면: 닫혀있을 때만 내용 갱신 후 재오픈(원본 동일), 열려있으면 무시(중복 방지).
        var oExist = document.getElementById(sDlgId);
        if (oExist) {
            if (!oExist.open) {
                _applyArt(oExist);
                oExist.querySelector(".u4aWsSessTitle").textContent = sTitle || "";
                oExist.querySelector(".u4aWsSessDesc").textContent = sDesc || "";
                try { oExist.showModal(); } catch (e) { }
            }
            return;
        }

        // 확인 버튼 라벨(A40 Confirm, 없으면 OK). 색은 공통 u4a-btn--emphasized(=테마 accent) 소비
        //   — 하드코딩 금지(테마마다 주요색 다름). 확인=주요 액션이라 emphasized 가 규약상 맞다.
        var sOk = "OK";
        try { sOk = oAPP.common.fnGetMsgClsText("/U4A/CL_WS_COMMON", "A40") || "OK"; } catch (e) { }

        var oDlg = document.createElement("dialog");
        oDlg.id = sDlgId;
        oDlg.className = "u4aWsSessDlg";
        oDlg.innerHTML =
            '<div class="u4aWsSessCard">' +
            '<div class="u4aWsSessArt">' +
            '<img class="u4aWsSessArtImg" alt="" aria-hidden="true"/>' +
            '<i class="u4aWsSessArtFb fa-solid" aria-hidden="true"></i>' +
            '</div>' +
            '<div class="u4aWsSessTitle"></div>' +
            '<div class="u4aWsSessDesc"></div>' +
            '<div class="u4aWsSessFoot">' +
            '<button type="button" class="u4a-btn u4a-btn--emphasized u4aWsSessOk"></button>' +
            '</div></div>';
        _applyArt(oDlg);
        oDlg.querySelector(".u4aWsSessTitle").textContent = sTitle || "";
        oDlg.querySelector(".u4aWsSessDesc").textContent = sDesc || "";
        oDlg.querySelector(".u4aWsSessOk").textContent = sOk;

        // ESC 로 닫히지 않게(원본 escapeHandler 빈 함수).
        oDlg.addEventListener("cancel", function (e) { e.preventDefault(); });

        // 확인 → 닫고 제거(원본 afterClose destroy) 후 콜백.
        oDlg.querySelector(".u4aWsSessOk").addEventListener("click", function () {
            try { oDlg.close(); } catch (e) { }
            try { if (oDlg.parentNode) { oDlg.parentNode.removeChild(oDlg); } } catch (e) { }
            if (typeof fnCallback === "function") { fnCallback(); }
        });

        document.body.appendChild(oDlg);
        try { oDlg.showModal(); } catch (e) { }

    }; // end of oAPP.fn.fnShowIllustMsgDialog

    /****************************************************************************
     * Trial Version을 체크 하여 맞으면 메시지를 출력 후 기능 동작을 못하게 한다.
     ****************************************************************************
     * @return {Boolean}  bIsTrial
     * - Trial Version 여부 Flag
     ****************************************************************************/
    oAPP.fn.fnOnCheckIsTrial = () => {

        var bIsTrial = parent.getIsTrial();

        if (!bIsTrial) {
            return bIsTrial;
        }

        var sTitle = APPCOMMON.fnGetMsgClsText("/U4A/CL_WS_COMMON", "C85"), // Trial Version
            sDesc = APPCOMMON.fnGetMsgClsText("/U4A/MSG_WS", "311"), // Does not Support in this Trial Version.
            sIllustType = "tnt-Lock",
            sIllustSize = "Spot"; // [HTML5] sap 제거 — 구 enum 값=문자열

        oAPP.fn.fnShowIllustMsgDialog(sTitle, sDesc, sIllustType, sIllustSize);

        return bIsTrial;

    }; // end of oAPP.fn.fnOnCheckIsTrial

    // oAPP.fn.fnMovePageWs20(sAppID, "D", true);

    /************************************************************************
     * Example용 WS20 페이지로 이동
     ************************************************************************
     * @param {String} sAppID
     * - WS20 페이지로 이동할 어플리케이션 ID
     *          
     ************************************************************************/
    oAPP.fn.fnExamMoveToPageWs20 = (sAppID) => {

        var oAppInput = sap.ui.getCore().byId("AppNmInput"),
            oDispModeBtn = sap.ui.getCore().byId("displayBtn");

        if (!oAppInput && !oDispModeBtn) {
            return;
        }

        var sAppID = sAppID.toUpperCase();

        oAppInput.setValue(sAppID);

        oDispModeBtn.firePress();

        // Example로 실행 했다는 플래그
        oAPP.attr.isExam = "X";

    }; // end of oAPP.fn.fnExamMoveToPageWs20

    /************************************************************************
     * [WS20 SIDEMENU] Split Position Change
     ************************************************************************/
    oAPP.fn.fnWs20SideMENUITEM_10 = (oEvent) => {

        oAPP.fn.callDesignLayoutChangePopupOpener();

    }; // end of oAPP.fn.fnWs20SideMENUITEM_10

    /************************************************************************
     * [WS20 SIDEMENU] 접속 서버 정보 Popover
     ************************************************************************/
    oAPP.fn.fnWs20SideFIXITM_10 = (oEvent) => {

        let aPopovers = sap.m.InstanceManager.getOpenPopovers();        

        for(const oPop of aPopovers){

            if(typeof oPop.data === "function"){

                let sPop = oPop.data("oServerInfoPopup");
                if(sPop === "X"){
                    oPop.destroy();
                    break;
                }

            }            

        }

        var oSelectedItem = oEvent.getParameter("item");

        var oServerInfoPopup = new sap.m.ResponsivePopover({
            resizable: true,
            contentWidth: "350px",
            placement: sap.m.PlacementType.Auto,
            beforeOpen: function(){

                // // busy 끄고 Lock 풀기
                // oAPP.common.fnSetBusyLock("");

            },
            afterOpen: function(){

                // // busy 끄고 Lock 풀기
                // oAPP.common.fnSetBusyLock("");

                oServerInfoPopup.focus();

            },

            afterClose: function(){

                oServerInfoPopup.destroy();

            },
            customHeader: new sap.m.Toolbar({
                content: [
                    new sap.ui.core.Icon({
                        src: "sap-icon://it-system",

                    }).addStyleClass("sapUiTinyMarginBegin"),

                    new sap.m.Title({
                        text: APPCOMMON.fnGetMsgClsText("/U4A/CL_WS_COMMON", "C42") // Server Information
                    })
                ]
            }),

            content: [

                new sap.ui.layout.form.Form({
                    // width: "300px",
                    editable: true,

                    layout: new sap.ui.layout.form.ResponsiveGridLayout({
                        // labelSpanS: 4,
                        // labelSpanM: 4,
                        // labelSpanL: 4,
                        labelSpanS: 5,
                        labelSpanM: 4,
                        labelSpanL: 4,
                        columnsM: 1,
                        columnsL: 2
                    }), // end of layout

                    formContainers: [

                        new sap.ui.layout.form.FormContainer({
                            formElements: [

                                /*****************************
                                 * WS Version
                                 *****************************/
                                new sap.ui.layout.form.FormElement({
                                    label: new sap.m.Label({
                                        design: sap.m.LabelDesign.Bold,
                                        text: APPCOMMON.fnGetMsgClsText("/U4A/CL_WS_COMMON", "C43") // WS Version
                                    }), // end of label

                                    fields: [
                                        new sap.m.Text({
                                            // text: "{/USERINFO/WSVER}"
                                            text: "{/SERVERINFO/WSVER}"
                                        })
                                    ] // end of fields

                                }), // end of sap.ui.layout.form.FormElement

                                /*****************************
                                 * Patch Level
                                 *****************************/
                                new sap.ui.layout.form.FormElement({
                                    label: new sap.m.Label({
                                        design: sap.m.LabelDesign.Bold,
                                        text: APPCOMMON.fnGetMsgClsText("/U4A/CL_WS_COMMON", "E26") // Patch Level                                        
                                    }), // end of label

                                    fields: [
                                        new sap.m.Text({
                                            // text: "{/USERINFO/WSPATCH_LEVEL}"
                                            text: "{/SERVERINFO/WSPATCH_LEVEL}"
                                        })
                                    ] // end of fields

                                }).bindProperty("visible", {
                                    parts: [
                                        // "/USERINFO/WSPATCH_LEVEL"
                                        "/SERVERINFO/WSPATCH_LEVEL"
                                    ],
                                    formatter: function () {

                                        return true;
                                        // return APP.isPackaged;

                                    }
                                }), // end of sap.ui.layout.form.FormElement

                                /*****************************
                                 * Server Version
                                 *****************************/
                                new sap.ui.layout.form.FormElement({
                                    label: new sap.m.Label({
                                        design: sap.m.LabelDesign.Bold,
                                        text: WSUTIL.getWsMsgClsTxt(WS_LANGU, "ZMSG_WS_COMMON_001", "285") // Server Version, 
                                    }), // end of label

                                    fields: [
                                        new sap.m.Text().bindProperty("text", {
                                            parts: [
                                                "/METADATA/S_WSVER/SVRVER",
                                                "/METADATA/S_WSVER/WSSVER"
                                            ],
                                            formatter: function(SVRVER, WSSVER){
                                                
                                                if(!SVRVER || !WSSVER){
                                                    return;
                                                }

                                                return `${SVRVER} ( ${WSSVER} )`;

                                            }
                                        })
                                    ] // end of fields

                                }).bindProperty("visible", {
                                    parts: [
                                        "/METADATA/S_WSVER"
                                    ],
                                    formatter: function (S_WSVER) {

                                        if(!S_WSVER){
                                            return false;
                                        }

                                        return true;                                        

                                    }
                                }), // end of sap.ui.layout.form.FormElement

                                /*****************************
                                 * Client
                                 *****************************/
                                new sap.ui.layout.form.FormElement({
                                    label: new sap.m.Label({
                                        design: sap.m.LabelDesign.Bold,
                                        text: WSUTIL.getWsMsgClsTxt(WS_LANGU, "ZMSG_WS_COMMON_001", "063") // Client, 
                                        // APPCOMMON.fnGetMsgClsText("/U4A/CL_WS_COMMON", "C44") // Client
                                    }), // end of label

                                    fields: [
                                        new sap.m.Text({
                                            // text: "{/USERINFO/CLIENT}"
                                            text: "{/SERVERINFO/CLIENT}"
                                        })
                                    ] // end of fields

                                }), // end of sap.ui.layout.form.FormElement

                                /*****************************
                                 * System ID
                                 *****************************/
                                new sap.ui.layout.form.FormElement({
                                    label: new sap.m.Label({
                                        design: sap.m.LabelDesign.Bold,
                                        text: APPCOMMON.fnGetMsgClsText("/U4A/CL_WS_COMMON", "C45") // System ID
                                    }), // end of label

                                    fields: [
                                        new sap.m.Text({
                                            // text: "{/USERINFO/SYSID}"
                                            text: "{/SERVERINFO/SYSID}"
                                        })
                                    ] // end of fields

                                }), // end of sap.ui.layout.form.FormElement

                                /*****************************
                                 * USER
                                 *****************************/
                                new sap.ui.layout.form.FormElement({
                                    label: new sap.m.Label({
                                        design: sap.m.LabelDesign.Bold,
                                        text: APPCOMMON.fnGetMsgClsText("/U4A/CL_WS_COMMON", "C46"), // USER
                                    }), // end of label

                                    fields: [
                                        new sap.m.Text().bindProperty("text", "/USERINFO/ID", function (sId) {

                                            if (typeof sId !== "string") {
                                                return "";
                                            }

                                            return sId.toUpperCase();

                                        })
                                    ] // end of fields

                                }), // end of sap.ui.layout.form.FormElement

                                /*****************************
                                 * Language
                                 *****************************/
                                new sap.ui.layout.form.FormElement({
                                    label: new sap.m.Label({
                                        design: sap.m.LabelDesign.Bold,
                                        text: APPCOMMON.fnGetMsgClsText("/U4A/CL_WS_COMMON", "C47") // Language
                                    }), // end of label

                                    fields: [
                                        new sap.m.Text({
                                            // text: "{/USERINFO/LANGU}"
                                            text: "{/SERVERINFO/LANGU}"
                                        })
                                    ] // end of fields

                                }), // end of sap.ui.layout.form.FormElement

                                /*****************************
                                 * Host
                                 *****************************/
                                new sap.ui.layout.form.FormElement({
                                    label: new sap.m.Label({
                                        design: sap.m.LabelDesign.Bold,
                                        text: APPCOMMON.fnGetMsgClsText("/U4A/CL_WS_COMMON", "C48") // Host
                                    }), // end of label

                                    fields: [
                                        new sap.m.Text().bindProperty("text", {
                                            parts: [
                                                "/SERVERINFO/SERVER_INFO"
                                            ],
                                            formatter: (SERVERINFO) => {

                                                if (!SERVERINFO) {
                                                    return;
                                                }

                                                return SERVERINFO.host;

                                            }
                                        })
                                    ] // end of fields

                                }), // end of sap.ui.layout.form.FormElement

                            ]

                        })

                    ] // end of formContainers

                }) // end of sap.ui.layout.form.Form

            ]

        }); // end of popover

        oServerInfoPopup.data("oServerInfoPopup", "X");

        // oAPP.attr.oServerInfoPopup = oServerInfoPopup;


        // oServerInfoPopup.bindElement("/USERINFO");

        oServerInfoPopup.setInitialFocus(oServerInfoPopup);

        oServerInfoPopup.openBy(oSelectedItem);

    }; // end of oAPP.fn.fnWs20SideFIXITM_10


    /************************************************************************
     * [WS10] Keyboard Shortcut List
     ************************************************************************/
    oAPP.fn.fnShowKeyboardShortcuts = function(){

        // 현재 실행 중인 화면의 정보를 구한다
        let sCurrPage = parent.getCurrPage();

        // 현재 실행중인 화면의 단축키 정보를 구한다.
        let aShortcutList = oAPP.common.getShortCutList(sCurrPage);

        let oDialog = new sap.m.Dialog({
            contentWidth: "800px",
            resizable: true,
            draggable: true,
            afterOpen: function(){

                // busy 키고 Lock 걸기
                oAPP.common.fnSetBusyLock("");

            },            
            afterClose: function(){
                oDialog.destroy();
            },
            buttons: [
                new sap.m.Button({
                    type: "Negative",
                    icon: "sap-icon://decline",
                    press: function(){
                        oDialog.close();
                    }
                })
            ]    
        }).addStyleClass("sapUiSizeCompact");

        let oToolbar1 = new sap.m.Toolbar();
        oDialog.setCustomHeader(oToolbar1);

        let oIcon1 = new sap.ui.core.Icon({
            src: "sap-icon://u4a-fw-solid/Keyboard"
        });
        oToolbar1.addContent(oIcon1);

        let oTitle1 = new sap.m.Title({
            text: WSUTIL.getWsMsgClsTxt(WS_LANGU, "ZMSG_WS_COMMON_001", "253"), // Keyboard Shortcut List
        });
        oToolbar1.addContent(oTitle1);

        oToolbar1.addContent(new sap.m.ToolbarSpacer());
        
        let oButton1 = new sap.m.Button({
            type: "Negative",
            icon: "sap-icon://decline",
            press: function(){
                oDialog.close();
            }
        });
        oToolbar1.addContent(oButton1);

        let oTable1 = new sap.m.Table({
            sticky: [
                "ColumnHeaders"
            ],
            columns: [
                new sap.m.Column({
                    header: new sap.m.Label({
                        design: "Bold",
                        text: WSUTIL.getWsMsgClsTxt(WS_LANGU, "ZMSG_WS_COMMON_001", "272"), // Keyboard Shortcut
                    })
                }),
                new sap.m.Column({
                    header: new sap.m.Label({
                        design: "Bold",
                        text: WSUTIL.getWsMsgClsTxt(WS_LANGU, "ZMSG_WS_COMMON_001", "176"), // Description
                    })
                }),
                new sap.m.Column({
                    header: new sap.m.Label({
                        design: "Bold",
                        text: WSUTIL.getWsMsgClsTxt(WS_LANGU, "ZMSG_WS_COMMON_001", "230"), // Preview
                    })
                }),
            ],
            items: {
                path: "/T_LIST",
                template: new sap.m.ColumnListItem({
                    cells: [
                        new sap.m.Text({
                            text: "{KEY}"
                        }),
                        new sap.m.Text({
                            text: "{DESC}"
                        }),
                        // new sap.m.Image({
                        //     src: "{IMG_SRC}"
                        // })
                        new sap.m.HBox({
                            customData: [
                                new sap.ui.core.CustomData()
                                .bindProperty("value", "CODE", function(sCode){

                                    let oParentUI = this.getParent && this.getParent();
                                    if(!oParentUI){
                                        return;
                                    }

                                    if(oParentUI.destroyItems){
                                        oParentUI.destroyItems();
                                    }

                                    if(!sCode){
                                        return;
                                    }

                                    try {
                                        
                                        var oUI = eval(sCode);

                                    } catch (error) {                                        
                                        return;
                                    }

                                    if(!oParentUI.addItem){
                                        return;
                                    }

                                    oParentUI.addItem(oUI);

                                })

                            ]
                        })
                    ]
                })
            }
        });

        oDialog.addContent(oTable1);

        aShortcutList = aShortcutList.filter(e => e.VISIBLE !== false);

        let oJsonModel = new sap.ui.model.json.JSONModel({
            T_LIST: aShortcutList,
            WSLANGU: sap.ui.getCore().getModel().getProperty("/WSLANGU")
        });
        
        oDialog.setModel(oJsonModel);

        // 키 기준으로 오름차순 정렬
        let oSorter = new sap.ui.model.Sorter({
            path: 'KEY', 
            descending: false, 
        });

        // manual sorting
        oTable1.getBinding("items").sort(oSorter);

        oDialog.open();

    } // end of oAPP.fn.showKeyboardShortcuts

})(window, $, oAPP);