/************************************************************************
 * ws_html5_ws20_prev.js  (HTML5)
 * ----------------------------------------------------------------------
 * [HTML5 컨버전 메모 — W2 단계: WS20 중앙 "미리보기(Preview)" 영역]
 *  핵심 전략(KEEP-UI5): 미리보기 iframe 내부(design/preview/)는 "사용자가
 *  만드는 대상 앱"을 UI5 로 실제 렌더링하므로 그대로 유지(무수정).
 *  변환 대상은 IDE 쪽 호스트(iframe 삽입 + Preview 툴바)뿐이다.
 *
 *  본 파일은 library-preload.js 의 로드 목록에서 ws_html5_ws20_attr.js
 *  "보다 뒤"(가장 마지막) 에 위치한다.
 *
 *  ────────────────────────────────────────────────────────────────────
 *  [원본 흐름 — 실측]
 *  ────────────────────────────────────────────────────────────────────
 *   1) 호스트 UI (design/js/uiPreviewArea.js 3행~ oAPP.fn.uiPreviewArea):
 *        sap.ui.core.HTML 로 <iframe id='prevHTML' name='prevHTML'> 삽입 +
 *        툴바(Title A67 "Preview" / Avatar(단축키 잠금 표시: isShortcutLock
 *        defineProperty) / refresh 버튼(B17): oSlid.setValue(1) +
 *        frame.contentWindow.setPreviewZoom(1) — reload 는 하지 않음 /
 *        Slider(0.1~2, step 0.1, 기본 1): change → setPreviewZoom(value) /
 *        Switch(C23 Full Screen): oAPP.fn.prevFullScreen(state) —
 *        좌(tree)/우(attr) 패널 size 0 축소·복원 / ?(B39 Help): U4A HELP
 *        DOCUMENT 팝업(UHAK901369) 또는 callTooltipsPopup("prevTooltip","E22")).
 *   2) 로드 (uiPreviewArea.js 139행~ oAPP.fn.loadPreviewFrame):
 *        【실측】 현재 원본은 145~179행에서
 *          - 이미 로드됨(contentWindow._loaded===true):
 *              setUiLoadLibraries(getUi5Libraries()) → drawPreview().then(
 *              → oLTree1 1행(=ROOT) fireCellClick = ROOT 재선택)
 *          - 미로드: oFrame.src = PATH.join(designRootPath,"preview","index.html")
 *            로 "항상 로컬 파일" 로드 후 oAPP.attr.ui.frame 보관, return;
 *        ⚠️ 183행 이후의 서버모드 form POST(getPrevHTML, LIBPATH/LIBPATH_U4A/
 *        UI6/AM5/LIBRARY/THEME 파라메터)는 무조건 return(179행) "뒤"에 있어
 *        도달 불가(데드코드)다. 즉 현행 원본의 실분기는 "로컬 로드 단일 경로"
 *        이며, UI5 SDK 는 iframe 내부(index.js 1351행)가
 *        parent.oAPP.fn.getBootStrapUrl()(서버 LIBPATH, T_9011/UA025) 로
 *        <script id="sap-ui-bootstrap"> 를 동적 주입하여 서버에서 받아온다.
 *        → 새 폴더에 UI5 SDK 사본이 없어도 서버 로그인(dev) 환경이면 동작.
 *   3) iframe 내부(design/preview/index.js — KEEP, 무수정):
 *        로컬 index.html 로드 → loadUi5BootstrapScript(getBootStrapUrl/
 *        getUi5Libraries/APPDATA.S_0010.UITHM/S_CODE.UA025) → core.attachInit
 *        → window._loaded=true → await drawPreview() → 트리 1행(ROOT)
 *        fireCellClick → (호스트) 선택 흐름 → busy 해제.
 *        drawPreview 는 parent.oAPP.fn.callDesignContextMenu(이 함수는 원본도
 *        uiDesignArea.js 988~998행에서 getScript 로 "지연 로드")와
 *        oDesign.pathInfo.setOnAfterRender(node require) 에 의존.
 *   4) 트리 선택 → 미리보기 동기화 (uiDesignArea.js designTreeItemPress 3510행):
 *        frame.contentWindow.oWS.sMark.fn_removeMark() →
 *        (UHAK900681 || !isPackaged) redrawUIScript(zTREE) →
 *        await refreshPreview(is_tree) →
 *        (UHAK900788 미적용시) closePopup() → await selPreviewUI(OBJID).
 *
 *  ────────────────────────────────────────────────────────────────────
 *  [본 파일의 구성]
 *  ────────────────────────────────────────────────────────────────────
 *   (1) oAPP.oDesign/pathInfo/광역변수 부트스트랩 (원본 main.js 6~84행 해당분)
 *   (2) 원본 1:1 이식 — main()/uiDesignArea/uiAttributeArea "내부 정의" 중
 *       미리보기(iframe)가 parent.oAPP.fn.* 으로 참조하는 순수 데이터 함수
 *       (getScript/getUIAttrFuncName/getUiInstanceDOM/crtStru0010/0014/
 *        getAttrChangedData/getRandomKey/getTreeData/getMousePosition/
 *        removeCollectPopup/setModelBind/setAggrBind/getParentAggrBind/
 *        chkBindPath). 전부 "원본 우선, 없으면 이식본" typeof 가드.
 *   (3) 미리보기 모듈 지연 로드 — design/js/uiPreviewArea.js 를 원본 방식
 *       (getScript)으로 WS20 진입 후 로드. 【실측】 해당 파일 최상위는 함수
 *       "정의"만 있고 즉시실행 UI5 코드가 없어 HTML5 호스트에서 로드 안전.
 *       (loadPreviewFrame/getUi5Libraries/getBootStrapUrl/previewUIsetProp/
 *        prevSkipProp/setHTMLContentProp/prevParseOTRValue/setPropDoqu/
 *        prevDrawExceptionUi 등 원본 그대로 확보 = 1:1 보존)
 *       로드 직후 UI5 전용 2개(uiPreviewArea 호스트 렌더러 / prevFullScreen)만
 *       HTML5 구현으로 재-override 한다.
 *       ⚠️ library-preload(부팅) 에는 추가하지 않는다(전례: uiDesignArea 부팅
 *       preload 시 앱 크래시).
 *   (4) HTML5 호스트 렌더러 — #ws20DesignPreview 본문에 iframe 삽입(흰 배경),
 *       W1 placeholder 라벨 제거, #ws20PrevHeader 의 ⟳/슬라이더/스위치/? 를
 *       원본 핸들러 의미 그대로 연결(+Avatar 대응 잠금 아이콘/isShortcutLock
 *       defineProperty 1:1).
 *   (5) oLTree1 스텁 보강 — iframe 의 drawPreview 완료 후
 *       parent.oAPP.attr.ui.oLTree1.getRows()[0]→fireCellClick(ROOT 선택) 를
 *       HTML5 의 fnWs20TreeSelectRow/fnWs20SelectUI 로 매핑.
 *   (6) 미리보기 로드 트리거 — 트리/LIB 데이터 로드 완료 시점(APPDATA 가 새로
 *       구성되어 트리가 렌더되는 시점 = 원본 getAppData 588행 위치)에
 *       loadPreviewFrame() 호출 + busy 관리(실패/타임아웃 안전장치).
 *   (7) 트리 선택 ↔ 미리보기 연동 — fnWs20SelectUI 후처리로 원본
 *       designTreeItemPress 의 미리보기측 호출(fn_removeMark/redrawUIScript/
 *       refreshPreview/closePopup/selPreviewUI)을 순서 그대로 가드 연결.
 *       역방향(미리보기 클릭 → 트리 선택)은 iframe 이 호출하는
 *       oAPP.fn.setSelectTreeItem 을 fnWs20SelectUI 로 매핑.
 *
 *  서버 없는 헤드리스: servNm/APPID 없으면 데이터 파이프라인이 미리보기
 *  로드를 트리거하지 않음 → iframe 은 빈 패널(흰 배경)로 유지, 크래시 없음.
 *  비-UI 로직(서버 호출/데이터 가공)은 본 파일에서 일절 변경하지 않는다.
 ************************************************************************/

(function (window, $, oAPP) {
    "use strict";

    var APPCOMMON = oAPP.common;

    /************************************************************************
     * 메시지 텍스트 안전 조회 (모델 미초기화/미로그인 폴백) — W1~W4 패턴.
     ************************************************************************/
    // 언어 = 서버 메시지 클래스 단일 출처(원본 동일). 내부 영문 폴백 보관 금지(2026-06-16 지시).
    function _msg(sNum) {
        try {
            var s = APPCOMMON.fnGetMsgClsText("/U4A/CL_WS_COMMON", sNum);
            if (s != null && s !== "" && s.indexOf("|") === -1) { return s; }
        } catch (e) { }
        return sNum;
    }

    /* ********************************************************************
     * (1) oAPP.oDesign / pathInfo / 광역변수 부트스트랩
     *     원본 design/js/main.js 6~84행(oAPP.fn.main 내부)의 해당 구간을
     *     동일 값으로 구성. (이미 구성돼 있으면 보존 — W4 _ensureODesign 과
     *     동일 패턴 + 미리보기에 필요한 항목 추가)
     * ******************************************************************** */
    function _ensureDesignGlobals() {

        // 미리보기/팝업 광역변수 (원본 main.js 6~29행 — 이미 있으면 보존)
        if (typeof oAPP.attr.prev === "undefined") { oAPP.attr.prev = {}; }        //미리보기 정보
        if (typeof oAPP.attr.popup === "undefined") { oAPP.attr.popup = []; }      //팝업 정보
        if (typeof oAPP.attr.prevCSS === "undefined") { oAPP.attr.prevCSS = []; }  //css 적용건 수집 array
        if (typeof oAPP.attr.chkProp === "undefined") { oAPP.attr.chkProp = {}; }  //프로퍼티 점검 항목
        if (typeof oAPP.attr.DnDRandKey === "undefined") { oAPP.attr.DnDRandKey = ""; } //D&D용 랜덤키
        if (typeof oAPP.attr.POSIT === "undefined") { oAPP.attr.POSIT = 0; }

        // [HTML5 가드] 미리보기 iframe 의 setUiContextMenu(preview/index.js — 수정금지)가
        // 우클릭 시 parent.oAPP.attr.ui.designMenu.close() / oAttrMenu.close() 를
        // "무가드"로 호출한다. 원본은 uiDesignArea/uiAttributeArea(UI5)가 생성하던
        // sap.m.Menu 인스턴스 — HTML5 미변환 동안 no-op 스텁으로 크래시(Critical) 방지.
        oAPP.attr.ui = oAPP.attr.ui || {};
        if (!oAPP.attr.ui.designMenu) { oAPP.attr.ui.designMenu = { close: function () { } }; }
        if (!oAPP.attr.ui.oAttrMenu) { oAPP.attr.ui.oAttrMenu = { close: function () { } }; }

        try {
            oAPP.oDesign = oAPP.oDesign || {};
            oAPP.oDesign.types = oAPP.oDesign.types || {};

            //busy dialog option 파라메터 구조. (원본 main.js 39행)
            if (!oAPP.oDesign.types.TY_BUSY_OPTION) {
                oAPP.oDesign.types.TY_BUSY_OPTION = { TITLE: "", DESC: "" };
            }

            //design 에서 사용하는 function 수집 object. (원본 main.js 46행)
            //  ※ uiPreviewArea.js 1571행이 oAPP.oDesign.fn.prevRemoveUiObject 를
            //    정의하므로 모듈 로드 전 반드시 존재해야 한다.
            oAPP.oDesign.fn = oAPP.oDesign.fn || {};

            oAPP.oDesign.settings = oAPP.oDesign.settings || {};

            //WS 3.0에 설정한 언어정보. (원본 main.js 55행)
            if (!oAPP.oDesign.settings.GLANGU) {
                oAPP.oDesign.settings.GLANGU = parent.getUserInfo().LANGU;
            }

            oAPP.oDesign.pathInfo = oAPP.oDesign.pathInfo || {};

            //design root path 정보 구성. (원본 main.js 59행)
            if (!oAPP.oDesign.pathInfo.designRootPath) {
                oAPP.oDesign.pathInfo.designRootPath =
                    parent.PATH.join(parent.getPath("WS10_20_ROOT"), "design");
            }

            //onAfterRender 처리 module path 정보. (원본 main.js 62행 —
            // iframe 의 drawPreview 가 u4aRootParent.require(...)로 참조)
            if (!oAPP.oDesign.pathInfo.setOnAfterRender) {
                oAPP.oDesign.pathInfo.setOnAfterRender = parent.PATH.join(
                    oAPP.oDesign.pathInfo.designRootPath, "js", "previewRender", "setOnAfterRender.js");
            }

            //WS20 <=> 바인딩 팝업 BROADCAST 통신 모듈 PATH. (원본 main.js 66행 —
            // iframe 의 attachThemeChanged 가 참조)
            if (!oAPP.oDesign.pathInfo.bindPopupBroadCast) {
                oAPP.oDesign.pathInfo.bindPopupBroadCast = parent.PATH.join(
                    oAPP.oDesign.pathInfo.designRootPath, "bindPopupHandler", "broadcastChannelBindPopup.js");
            }

            //UNDO, REDO 처리 모듈 JS 구성. (원본 main.js 71행)
            if (!oAPP.oDesign.pathInfo.undoRedo) {
                oAPP.oDesign.pathInfo.undoRedo = parent.PATH.join(
                    oAPP.oDesign.pathInfo.designRootPath, "undoRedo", "undoRedo.js");
            }
        } catch (e) {
            // parent API 미가용(헤드리스) — skip. (미리보기 로드도 트리거되지 않음)
        }
    }
    _ensureDesignGlobals();

    /* ********************************************************************
     * (2) 원본 1:1 이식 — 미리보기 iframe 이 parent.oAPP.fn.* 으로 참조하는
     *     순수 데이터 함수. (원본 우선, 없으면 이식본 — typeof 가드)
     * ******************************************************************** */

    //js 파일 load (원본 main.js 288행 1:1 — main() 내부 정의라 이식)
    if (typeof oAPP.fn.getScript !== "function") {
        oAPP.fn.getScript = function (fname, callbackFunc, bSync) {
            var xhttp = new XMLHttpRequest();
            xhttp.onreadystatechange = function () {
                if (this.readyState == 4 && this.status == 200) {

                    // 1. 상대경로(oLoadFile.URL)를 절대경로로 변환
                    var absoluteURL = new URL(fname + ".js", window.location.href).href;

                    // 2. 변환된 절대경로를 sourceURL에 적용
                    var sSourceURL = "\n//# sourceURL=" + absoluteURL;

                    // 3. 실행 (기존 로직 동일)
                    eval(this.responseText + sSourceURL);

                    callbackFunc();
                }
            };

            var l_async = true;
            if (bSync === true) {
                l_async = false;
            }

            xhttp.open("GET", fname + ".js", l_async);
            xhttp.send();

        };  //js 파일 load
    }

    //UI의 attribute(property, event, aggregation, assosication)에 해당하는 펑션 이름 얻기.
    //(원본 main.js 185행 1:1 — iframe parsePropertyValue/previewUIsetProp 참조)
    if (typeof oAPP.fn.getUIAttrFuncName !== "function") {
        oAPP.fn.getUIAttrFuncName = function (UIOBJ, UIATY, UIATT, param) {

            var l_meta = UIOBJ.getMetadata(),
                l_getfunc = "";

            switch (UIATY) {

                case "1":
                    //property
                    l_getfunc = "getProperty";
                    break;

                case "2":
                    //event
                    l_getfunc = "getEvent";
                    break;

                case "3":
                    //aggregation
                    l_getfunc = "getAggregation";
                    break;

                case "4":
                    //assosication
                    l_getfunc = "getAssociation";
                    break;

                default:
                    return;
            }

            try {
                return l_meta[l_getfunc](UIATT)[param];
            } catch (e) {

            }

        };  //UI의 attribute에 해당하는 펑션 이름 얻기.
    }

    //UI DOM을 기준으로 UI instance 정보 얻기. (원본 main.js 1285행 1:1)
    if (typeof oAPP.fn.getUiInstanceDOM !== "function") {
        oAPP.fn.getUiInstanceDOM = function (oDom, oCore) {

            //DOM 정보가 존재하지 않는경우 exit.
            if (typeof oDom === "undefined") { return; }

            //DOM id로부터 UI정보 검색.
            var l_ui = oCore.byId(oDom.id);

            //UI를 찾은경우 해당 UI정보 return
            if (typeof l_ui !== "undefined") {
                return l_ui;
            }

            //UI정보를 찾지못한 경우 상위 부모를 탐색하며 UI instance정보 검색.
            return oAPP.fn.getUiInstanceDOM(oDom.parentElement, oCore);

        };  //UI DOM을 기준으로 UI instance 정보 얻기.
    }

    //10번 정보 구조 생성. (원본 main.js 129행 1:1 — getAttrChangedData 의존)
    if (typeof oAPP.fn.crtStru0010 !== "function") {
        oAPP.fn.crtStru0010 = function () {
            return {
                "APPID": "", "APPNM": "", "APPVR": "", "LANGU": "", "APPTY": "", "CODPG": "", "ACTST": "",
                "PACKG": "", "CLSID": "", "LCKFL": "", "PGMID": "", "OBJTY": "", "AUTHG": "", "UITHM": "",
                "ISWIT": "", "WITTY": "", "TUCTY": "", "SHCUT": "", "BDCOR": "", "USERT": "", "USESK": "", "STFTP": "",
                "USEZM": "", "INTFT": "", "DMPWT": "", "ERUSR": "", "ERDAT": "", "ERTIM": "", "AEUSR": "", "AEDAT": "", "AETIM": ""
            };

        };  //10번 정보 구조 생성.
    }

    //14번 정보 구조 생성. (원본 main.js 148행 1:1 — iframe DnD insert 참조)
    if (typeof oAPP.fn.crtStru0014 !== "function") {
        oAPP.fn.crtStru0014 = function () {

            return {
                "APPID": "", "GUINR": "", "OBJID": "", "POSIT": "", "POBID": "", "UIOBK": "", "PUIOK": "",
                "ISAGR": "", "AGRID": "", "ISDFT": "", "OBDEC": "", "AGTYP": "", "UIATK": "", "UIATT": "",
                "UIASN": "", "UIATY": "", "UIADT": "", "UIADS": "", "VALKY": "", "ISLST": "", "ISMLB": "",
                "TOOLB": "", "UIFND": "", "PUIATK": "", "UILIB": "", "ISEXT": "", "TGLIB": "", "DEL_UOK": "",
                "DEL_POK": "", "ISECP": ""
            };

        };  //14번 정보 구조 생성.
    }

    //attribute의 변경된건 수집 처리. (원본 main.js 1165행 1:1 —
    // iframe drawPreview 재호출시(2번째 이후) 참조)
    if (typeof oAPP.fn.getAttrChangedData !== "function") {
        oAPP.fn.getAttrChangedData = function () {

            //document인경우 ZTU4A0010 테이블에 존재하는 필드 여부 확인.
            function lf_chkDocAttr(OBJID, is_0015, is_0010) {
                //ROOT(DOCUMENT) 인경우 하위 로직 수행.
                if (OBJID !== "ROOT") { return; }

                //UI5 Document 속성 정보 검색.
                var ls_ua003 = oAPP.DATA.LIB.T_9011.find(a => a.CATCD === "UA003" && a.ITMCD === is_0015.UIATK);

                //UI5 Document 속성 정보를 찾지 못한 경우 EXIT.
                if (!ls_ua003) { return; }

                if (typeof is_0010[ls_ua003.FLD08] === "undefined") {
                    return true;
                }

            } //document인경우 ZTU4A0010 테이블에 존재하는 필드 여부 확인.

            //UI에 구성한 attr 정보 수집 처리.
            var lt_0015 = [];

            //ROOT(DOCUMENT) 정보 저장건 구성을 위한 ZTU4A0010구조 생성
            var ls_0010 = oAPP.fn.crtStru0010();

            //생성한 UI를 기준으로 ATTRIBUTE 수집건 취합.
            for (var i in oAPP.attr.prev) {

                //attribute 수집건이 존재하지 않는경우 skip.
                if (oAPP.attr.prev[i]._T_0015.length === 0) { continue; }

                //attribute 수집건을 기준으로 ZYU4A0015 정보 구성.
                for (var j = 0, l2 = oAPP.attr.prev[i]._T_0015.length; j < l2; j++) {

                    //ROOT의 경우 ZTU4A0010 테이블 기준의 필드만 저장 가능.
                    if (lf_chkDocAttr(i, oAPP.attr.prev[i]._T_0015[j], ls_0010) === true) {
                        continue;
                    }

                    //ZSU4A0015 구조 생성.
                    var ls_0015 = oAPP.fn.crtStru0015();

                    //수집건을 생성한 구조에 옮김.
                    oAPP.fn.moveCorresponding(oAPP.attr.prev[i]._T_0015[j], ls_0015);

                    //저장 데이터 구성 시 단축키 등록정보가 존재하는 경우
                    //object 정보를 JSON string화 하는 로직. (원본 1222행)
                    if (Object.keys(ls_0015.SHCUT).length > 0) {
                        ls_0015.SHCUT = JSON.stringify(ls_0015.SHCUT);
                    }

                    //RETURN 처리 결과에 수집.
                    lt_0015.push(ls_0015);

                }

            }

            //수집된 정보 return 처리.
            return lt_0015;

        };  //attribute의 변경된건 수집 처리.
    }

    // ── 저장 payload 빌더 (구 design/js/main.js getSaveData/parseTree2Tab/setUIPOSIT) ──
    //   design/js/main.js 가 이 렌더러에 정의되지 않아 getSaveData 미정의 → 저장 실패.
    //   sap-free 라 HTML5 포트로 가드 이식(이미 있으면 스킵).

    // tree(zTREE 재귀) → flat tab 변환. (원본 main.js 270행 1:1, $.each → 평순회)
    if (typeof oAPP.fn.parseTree2Tab !== "function") {
        oAPP.fn.parseTree2Tab = function (e) {
            var a = [];
            var t = function (arr) {
                if (!arr) { return; }
                for (var k = 0; k < arr.length; k++) {
                    var o = arr[k];
                    if (o.zTREE) { t(o.zTREE); delete o.zTREE; }
                    a.push(o);
                }
            };
            t(JSON.parse(JSON.stringify(e || [])));
            return a;
        };
    }

    // 순번(POSIT) 재귀 재정의. (원본 main.js 1079행 1:1)
    if (typeof oAPP.fn.setUIPOSIT !== "function") {
        oAPP.fn.setUIPOSIT = function (it_tree) {
            if (!it_tree || it_tree.length === 0) { return; }
            for (var i = 0, l = it_tree.length; i < l; i++) {
                oAPP.attr.POSIT += 1;
                it_tree[i].POSIT = oAPP.attr.POSIT;
            }
            for (var i2 = 0, l2 = it_tree.length; i2 < l2; i2++) {
                oAPP.fn.setUIPOSIT(it_tree[i2].zTREE);
            }
        };
    }

    // UI 저장 정보 구성. (원본 main.js 1106행 1:1 — 일부 널가드 추가)
    if (typeof oAPP.fn.getSaveData !== "function") {
        oAPP.fn.getSaveData = function () {

            oAPP.attr.POSIT = 0;
            //UI POSITION 재매핑
            oAPP.fn.setUIPOSIT(oAPP.attr.oModel.oData.zTREE);
            oAPP.attr.POSIT = 0;

            //design tree → ZY04A0014 (POSITION 정렬)
            var lt_0014 = oAPP.fn.parseTree2Tab(oAPP.attr.oModel.oData.zTREE);
            lt_0014.sort(function (a, b) { return a.POSIT - b.POSIT; });

            //어플리케이션 정보 구조 + 상태정보 매핑
            var ls_0010 = oAPP.fn.crtStru0010();
            oAPP.fn.moveCorresponding(oAPP.attr.appInfo || {}, ls_0010);

            //ROOT(DOCUMENT) 입력정보를 ZTU4A0010 필드에 매핑
            var aRoot = (oAPP.attr.prev && oAPP.attr.prev.ROOT && oAPP.attr.prev.ROOT._T_0015) || [];
            for (var i = 0, l = aRoot.length; i < l; i++) {
                var ls_ua003 = oAPP.DATA.LIB.T_9011.find(function (a) { return a.CATCD === "UA003" && a.ITMCD === aRoot[i].UIATK; });
                if (ls_ua003) { ls_0010[ls_ua003.FLD08] = aRoot[i].UIATV; }
            }

            //UI attr 변경분 수집
            var lt_0015 = oAPP.fn.getAttrChangedData();

            var oA = oAPP.DATA.APPDATA || {};
            return {
                "TU4A0010": ls_0010,
                "YU4A0014": lt_0014,
                "YU4A0015": lt_0015,
                "T_EDIT": oA.T_EDIT,
                "S_ERHTML": oA.S_ERHTML,
                "T_CEVT": oA.T_CEVT,
                "T_JSLK": oA.T_JSLK,
                "T_CSLK": oA.T_CSLK,
                "T_DESC": oA.T_DESC,
                "S_WSO": oA.S_WSO,
                "T_SKLE": oA.T_SKLE
            };
        };
    }

    // random key 생성. (원본 main.js 1755행 1:1 — iframe GF_getRandomKey 참조)
    if (typeof oAPP.fn.getRandomKey !== "function") {
        oAPP.fn.getRandomKey = function () {

            return new Date().getTime() + window.crypto.getRandomValues(new Uint32Array(1)).toString();

        };  // random key 생성.
    }

    //tree 정보에서 UI명에 해당하는건 검색. (원본 uiDesignArea.js 1897행 1:1 —
    // iframe 10개소 + W4 _findTreeNode 폴백이 참조)
    if (typeof oAPP.fn.getTreeData !== "function") {
        oAPP.fn.getTreeData = function (OBJID, is_tree) {
            //최초 호출상태인경우.
            if (typeof is_tree === "undefined") {
                //ROOT를 매핑.
                is_tree = oAPP.attr.oModel.oData.zTREE[0];
            }

            //[HTML5 가드] 트리 미구성(헤드리스) 시 skip.
            if (typeof is_tree === "undefined" || is_tree === null) { return; }

            //현재 TREE가 검색대상건인경우 해당 TREE정보 RETURN.
            if (is_tree.OBJID === OBJID) {
                return is_tree;
            }

            //child가 존재하지 않는경우 exit.
            if (!is_tree.zTREE || is_tree.zTREE.length === 0) { return; }

            //현재 TREE가 검색대상이 아닌경우 CHILD를 탐색하며 OBJID에 해당하는 TREE정보 검색.
            for (var i = 0, l = is_tree.zTREE.length; i < l; i++) {

                var ls_tree = oAPP.fn.getTreeData(OBJID, is_tree.zTREE[i]);
                if (typeof ls_tree !== "undefined") {
                    return ls_tree;
                }

            }

        };  //tree 정보에서 UI명에 해당하는건 검색.
    }

    //이벤트 발생시 마우스의 x, y 좌표 값 얻기. (원본 main.js 1568행 1:1 —
    // callDesignContextMenu 의 itemSelected 핸들러가 참조)
    if (typeof oAPP.fn.getMousePosition !== "function") {
        oAPP.fn.getMousePosition = function () {

            var l_x, l_y;

            //미리보기에서 이벤트가 발생한 경우.
            if (oAPP.attr.ui.frame && oAPP.attr.ui.frame.contentWindow && oAPP.attr.ui.frame.contentWindow.event) {
                //iframe의 위치 정보 얻기.
                var l_rect1 = oAPP.attr.ui.frame.getBoundingClientRect();

                //미리보기에서 발생한 이벤트 좌표 + iframe의 좌표값 계산.
                l_x = oAPP.attr.ui.frame.contentWindow.event.clientX + l_rect1.x;
                l_y = oAPP.attr.ui.frame.contentWindow.event.clientY + l_rect1.y;

            } else if (window.event) {
                //그외 영역에서 이벤트가 발생한경우.
                l_x = window.event.clientX;
                l_y = window.event.clientY;

            }

            //x, y 좌표값 return.
            return { x: l_x, y: l_y };

        };  //이벤트 발생시 마우스의 x, y 좌표 값 얻기.
    }

    //팝업 수집건 제거 처리. (원본 uiDesignArea.js 1332행 1:1 —
    // iframe refreshPreview/redrawUIScript 가 참조)
    if (typeof oAPP.fn.removeCollectPopup !== "function") {
        oAPP.fn.removeCollectPopup = function (OBJID) {

            //팝업 수집건이 존재하지 않는경우 exit.
            if (oAPP.attr.popup.length === 0) { return; }

            //팝업 수집건에 입력 OBJID에 해당하는건 검색.
            var l_indx = oAPP.attr.popup.findIndex(a => a._OBJID === OBJID);

            //찾지못한 경우 EXIT.
            if (l_indx === -1) { return; }

            //찾은경우 해당 라인 제거 처리.
            oAPP.attr.popup.splice(l_indx, 1);

        };  //팝업 수집건 제거 처리.
    }

    //부모 path로부터 파생된 child path 여부 확인. (원본 uiAttributeArea.js 7701행 1:1)
    if (typeof oAPP.fn.chkBindPath !== "function") {
        oAPP.fn.chkBindPath = function (parent, child) {
            //부모 path를 -로 분리.
            if (typeof parent === "undefined" || parent === "") { return; }
            if (typeof child === "undefined" || child === "") { return; }

            var l_sp1 = parent.split("-");

            //CHILD path를 -로 분리.
            var l_sp2 = child.split("-");

            //부모 path 부분만 남김.
            l_sp2.splice(l_sp1.length);

            //부모 path로부터 파생된 child path인경우.
            if (parent === l_sp2.join("-")) {
                //부모 path로부터 파생됨 flag return
                return true;
            }

        };  //부모 path로부터 파생된 child path 여부 확인.
    }

    //UI에 바인딩처리된경우 부모 UI에 해당 정보 매핑. (원본 uiAttributeArea.js 7521행 1:1 —
    // iframe createUIInstance 가 참조)
    if (typeof oAPP.fn.setModelBind !== "function") {
        oAPP.fn.setModelBind = function (oUi) {

            //부모 model 바인딩 정보에 해당 UI 매핑 처리 function.
            function lf_getParentAggrModel(UIATV, EMBED_AGGR, parent) {

                if (!parent) { return; }

                //대상 Aggregation에 N건 바인딩 처리가 안된경우 상위 부모 탐색.
                if (!parent._MODEL[EMBED_AGGR]) {

                    var l_name = parent.getMetadata()._sClassName;

                    //부모가 sap.ui.table.Column인경우 sap.ui.table.Table(TreeTable)의
                    //row Aggregation에 N건 바인딩 처리됐는지 여부 판단.
                    if (l_name === "sap.ui.table.Column") {

                        //ui table(tree table의 columns에 바인딩처리가 안된경우.)
                        if (!parent?.__PARENT?._MODEL["coloums"]) {
                            return lf_getParentAggrModel(UIATV, "rows", parent?.__PARENT);
                        }

                    }

                    if (l_name === "sap.ui.table.RowAction" && !parent._MODEL["items"]) {
                        //부모가 sap.ui.table.RowAction 인경우 items에 바인딩 처리가 안됐다면.
                        //그 상위 부모인 table(tree table)의 rows aggregation에 N건 바인딩 처리 됐는지 여부 판단
                        return lf_getParentAggrModel(UIATV, "rows", parent.__PARENT);

                    }

                    if ((l_name === "sap.ui.table.Table" || l_name === "sap.ui.table.TreeTable") &&
                        (EMBED_AGGR === "rowActionTemplate" || EMBED_AGGR === "rowSettingsTemplate")) {

                        //부모가 table, tree table이면서 현재 UI가 rowActionTemplate, rowSettingsTemplate에 존재하는경우.
                        //rows rows aggregation에 N건 바인딩 처리 됐는지 여부 판단.
                        return lf_getParentAggrModel(UIATV, "rows", parent);

                    }

                    return lf_getParentAggrModel(UIATV, parent._EMBED_AGGR, parent.__PARENT);
                }

                //대상 Aggregation에 N건 바인딩 Path가 다른경우 상위 부모 탐색.
                if (oAPP.fn.chkBindPath(parent._MODEL[EMBED_AGGR], UIATV) !== true) {
                    return lf_getParentAggrModel(UIATV, parent._EMBED_AGGR, parent.__PARENT);
                }

                //model 정보 수집된건이 없는경우.
                if (!parent._BIND_AGGR[EMBED_AGGR]) {
                    //구조 생성.
                    parent._BIND_AGGR[EMBED_AGGR] = [];
                }

                //이미 model정보가 수집되어있는경우 exit.
                if (parent._BIND_AGGR[EMBED_AGGR].findIndex(a => a === oUi) !== -1) {
                    return true;
                }

                //현재 UI 수집처리.
                parent._BIND_AGGR[EMBED_AGGR].push(oUi);
                return true;

            } //부모 model 바인딩 정보에 해당 UI 매핑 처리 function.

            //현재 UI의 property에 바인딩된 정보 얻기.
            var lt_0015 = oUi._T_0015.filter(a => a.ISBND === "X" && a.UIATV !== "");

            //바인딩된 정보가 존재하지 않는경우 exit.
            if (lt_0015.length === 0) { return; }

            //바인딩된 정보를 기준으로 부모를 탐색하며 N건 바인딩 여부 확인.
            for (var i = 0, l = lt_0015.length; i < l; i++) {

                //N건 바인딩 처리되어 parent에 현재 UI를 추가한 경우 exit.
                if (lf_getParentAggrModel(lt_0015[i].UIATV, oUi._EMBED_AGGR, oUi.__PARENT) === true) {
                    return;
                }

            }

        };  //UI에 바인딩처리된경우 부모 UI에 해당 정보 매핑.
    }

    //Aggregation에 N건 모델 바인딩 처리시 모델정보 ui에 매핑 처리. (원본 uiAttributeArea.js 7611행 1:1)
    if (typeof oAPP.fn.setAggrBind !== "function") {
        oAPP.fn.setAggrBind = function (oUI, UIATT, UIATV) {

            //모델명, 바인딩 OTAB명이 입력된 경우.
            if (UIATT && UIATV) {
                oUI._MODEL[UIATT] = UIATV;
                return;
            }

            if (oUI._T_0015.length === 0) { return; }

            //Aggregation에 바인딩처리된 정보 얻기.
            var lt_0015 = oUI._T_0015.filter(a => a.UIATY === "3" && a.ISBND === "X" && a.UIATV !== "");

            if (lt_0015.length === 0) { return; }

            for (var i = 0, l = lt_0015.length; i < l; i++) {

                oUI._MODEL[lt_0015[i].UIATT] = lt_0015[i].UIATV;

            }

        };  //Aggregation에 N건 모델 바인딩 처리시 모델정보 ui에 매핑 처리.
    }

    //대상 UI로부터 부모를 탐색하며 n건 바인딩 값 얻기. (원본 uiAttributeArea.js 7638행 1:1)
    if (typeof oAPP.fn.getParentAggrBind !== "function") {
        oAPP.fn.getParentAggrBind = function (oUI, UIATT) {

            if (!oUI) { return; }
            if (!oUI?.getMetadata) { return; }

            if (!oUI._MODEL[UIATT]) {

                var l_meta = oUI.getMetadata();

                //sap.ui.table.Column의 template Aggregation에서 부모를 탐색하는경우.
                if (typeof l_meta !== "undefined" &&
                    l_meta._sClassName === "sap.ui.table.Column" &&
                    typeof oUI.__PARENT !== "undefined" &&
                    UIATT === "template") {

                    l_meta = oUI.__PARENT.getMetadata();

                    //sap.ui.table.Column의 상위 부모가 sap.ui.table.Table이라면.
                    if (typeof l_meta !== "undefined" &&
                        l_meta._sClassName === "sap.ui.table.Table" ||
                        l_meta._sClassName === "sap.ui.table.TreeTable") {

                        //상위 부모의 columns에 바인딩 처리안된경우 rows aggregation으로 판단.
                        if (typeof oUI.__PARENT._MODEL["columns"] === "undefined") {
                            //rows에 바인딩 처리됐는지 확인.
                            return oAPP.fn.getParentAggrBind(oUI.__PARENT, "rows");
                        }

                    }

                }

                if (l_meta && (l_meta._sClassName === "sap.ui.table.RowAction" || l_meta._sClassName === "sap.ui.table.RowSettings")) {

                    l_meta = oUI.__PARENT.getMetadata();

                    if (typeof l_meta !== "undefined" &&
                        l_meta._sClassName === "sap.ui.table.Table" ||
                        l_meta._sClassName === "sap.ui.table.TreeTable") {

                        //rows에 바인딩 처리됐는지 확인.
                        return oAPP.fn.getParentAggrBind(oUI.__PARENT, "rows");

                    }

                }

                return oAPP.fn.getParentAggrBind(oUI.__PARENT, oUI._EMBED_AGGR);
            }

            //모델에 n건 바인딩이 구성된 경우.
            if (oUI._MODEL[UIATT] !== "") {
                return oUI._MODEL[UIATT];
            }

            return oAPP.fn.getParentAggrBind(oUI.__PARENT, oUI._EMBED_AGGR);

        };  //대상 UI로부터 부모를 탐색하며 n건 바인딩 값 얻기.
    }

    /* ********************************************************************
     * (2-b) HTML5 가드 대체 — UI5 의존이라 1:1 이식이 불가한 함수.
     *       (원본 우선 — 이미 정의돼 있으면 덮어쓰지 않음)
     * ******************************************************************** */

    //디자인 area의 잠금/잠금해제 처리. (원본 main.js 890행 — oCore.lock/unlock(UI5)
    // → HTML5: fnSetBusyLock + setShortcutLock 으로 동일 의미.
    // iframe 의 window.onerror/unhandledrejection 핸들러가 참조하므로 필수)
    if (typeof oAPP.fn.designAreaLockUnlock !== "function") {
        oAPP.fn.designAreaLockUnlock = function (bLock) {

            //잠금 flag 처리된경우.
            if (bLock) {
                //단축키도 같이 잠금 처리. (원본 1:1)
                try { oAPP.fn.setShortcutLock && oAPP.fn.setShortcutLock(true); } catch (e) { }

                //화면 잠금 처리. (구 oAPP.attr.oCore.lock())
                try { oAPP.common.fnSetBusyLock("X"); } catch (e) { }

                return;
            }

            //잠금 flag가 없는경우 잠금 해제 처리. (구 oAPP.attr.oCore.unlock())
            try { oAPP.common.fnSetBusyLock(""); } catch (e) { }

            //단축키도 같이 잠금 햐제 처리.
            try { oAPP.fn.setShortcutLock && oAPP.fn.setShortcutLock(false); } catch (e) { }

        };  //디자인 area의 잠금/잠금해제 처리.
    }

    //tree item 선택 처리. (원본 uiDesignArea.js 2172행 setSelectTreeItem —
    // TreeTable 펼침 경로 계산(UI5) 의존 → HTML5: fnWs20SelectUI("ROOT") 매핑.
    // iframe 의 setUIClickEvent(미리보기 UI 클릭 → 트리 선택)가 참조)
    if (typeof oAPP.fn.setSelectTreeItem !== "function") {
        oAPP.fn.setSelectTreeItem = function (OBJID, UIATK, TYPE) {

            //OBJID가 존재하지 않는경우 EXIT. (원본 2307행 의미 보존)
            if (typeof OBJID === "undefined" || OBJID === null || OBJID === "") {
                return Promise.resolve();
            }

            if (typeof oAPP.fn.fnWs20SelectUI === "function") {
                //HTML5 선택 흐름(busy/잠금/속성영역/미리보기 동기화 포함 —
                // 문서 8.1 11단계. 원본 시그니처(OBJID, UIATK, TYPE) 전달 보존).
                return Promise.resolve(oAPP.fn.fnWs20SelectUI(OBJID, { UIATK: UIATK, TYPE: TYPE }));
            }

            console.warn("[HTML5][WS20][prev] setSelectTreeItem: fnWs20SelectUI 미존재 — skip:", OBJID);
            return Promise.resolve();

        };  //tree item 선택 처리.
    }

    //D&D / 드롭 인서트 — 미리보기 iframe 의 DnD 이벤트가 참조(상호작용 시점).
    //원본(uiDesignArea.js)은 UI5 TreeTable DnD 의존 → W2 에선 안전 가드만.
    if (typeof oAPP.fn.designTreeDragStart !== "function") {
        oAPP.fn.designTreeDragStart = function () {
            console.warn("[HTML5][WS20][prev] designTreeDragStart 미변환(W3+ 예정) — skip.");
        };
    }
    if (typeof oAPP.fn.designDragEnd !== "function") {
        oAPP.fn.designDragEnd = function () {
            console.warn("[HTML5][WS20][prev] designDragEnd 미변환(W3+ 예정) — skip.");
        };
    }
    if (typeof oAPP.fn.UIDrop !== "function") {
        oAPP.fn.UIDrop = function () {
            console.warn("[HTML5][WS20][prev] UIDrop 미변환(W3+ 예정) — drop 무시.");
            //원본 의미: true return 시 호출처(iframe attachDrop)가 하위 로직 skip.
            try { parent.setBusy && parent.setBusy(""); } catch (e) { }
            return true;
        };
    }
    //enableDesignContextMenu/contextMenu* 는 design/js/callDesignContextMenu.js
    //지연 로드시 원본이 정의됨. 로드 실패 대비 최소 가드만.
    if (typeof oAPP.fn.enableDesignContextMenu !== "function") {
        oAPP.fn.enableDesignContextMenu = function () {
            console.warn("[HTML5][WS20][prev] enableDesignContextMenu 미로드 — skip.");
        };
    }

    /* ********************************************************************
     * (4) HTML5 호스트 렌더러 — 구 oAPP.fn.uiPreviewArea (uiPreviewArea.js 3행~)
     *     #ws20DesignPreview 본문에 iframe 삽입 + #ws20PrevHeader 컨트롤 연결.
     * ******************************************************************** */

    // W1 헤더의 가드 리스너(console.warn)를 제거하기 위해 노드 교체 후 반환.
    function _replaceWithClone(oEl) {
        if (!oEl || !oEl.parentNode) { return oEl; }
        var oClone = oEl.cloneNode(true);
        oEl.parentNode.replaceChild(oClone, oEl);
        return oClone;
    }

    function _getFrameWin() {
        var oFrame = oAPP.attr.ui && oAPP.attr.ui.frame;
        if (!oFrame) { oFrame = document.getElementById("prevHTML"); }
        return (oFrame && oFrame.contentWindow) || null;
    }

    /************************************************************************
     * [HTML5] 미리보기 iframe 에 포커스가 가도 WS20 단축키가 동작하도록 keydown 포워딩
     * ---------------------------------------------------------------------
     *  미리보기 iframe 에 포커스가 있으면 keydown 이 iframe 문서로만 들어가, 메인 문서에
     *  걸린 단축키 리스너(shortcut.js: add → document)가 못 받아 Ctrl+S/F1/F3/F8 등이 안 먹는다.
     *  → iframe 문서 keydown 을 가로채, "WS20 에 등록된 단축키 조합"이면 iframe 기본동작/전파를
     *  막고 메인 document 로 합성 keydown 을 재발송한다(shortcut.js 가 e.keyCode 로 판별하므로
     *  생성자로 안 들어가는 keyCode/which 를 강제 주입). WS20 단축키가 아니면 그대로 iframe 에 맡김.
     *  iframe (re)load 마다 호출(문서가 새로 생기므로 __u4aScFwd 플래그로 중복만 방지).
     ************************************************************************/
    function _attachPreviewShortcutForward(oFrame) {

        var oDoc = null;
        try { oDoc = oFrame.contentDocument || (oFrame.contentWindow && oFrame.contentWindow.document); }
        catch (e) { return; }              // cross-origin(이론상 없음, file://) → 포기
        if (!oDoc || oDoc.__u4aScFwd) { return; }
        oDoc.__u4aScFwd = true;

        function _sig(sKey, bCtrl, bShift, bAlt) {
            return String(sKey).toUpperCase() + "|" + (bCtrl ? 1 : 0) + (bShift ? 1 : 0) + (bAlt ? 1 : 0);
        }
        function _sigFromKeyStr(s) {
            var c = false, sh = false, a = false, k = "";
            String(s).toUpperCase().split("+").forEach(function (x) {
                x = x.trim();
                if (x === "CTRL" || x === "META" || x === "CMD") { c = true; }
                else if (x === "SHIFT") { sh = true; }
                else if (x === "ALT") { a = true; }
                else if (x) { k = x; }
            });
            return _sig(k, c, sh, a);
        }

        // 메인에 등록된 WS20 단축키 KEY → 시그니처 셋 (iframe 로드당 1회)
        var oSet = {};
        try {
            (oAPP.common.getShortCutList("WS20") || []).forEach(function (it) {
                if (it && it.KEY) { oSet[_sigFromKeyStr(it.KEY)] = 1; }
            });
        } catch (e) { }

        oDoc.addEventListener("keydown", function (e) {
            var k = e.key || "";
            if (!k || k === "Control" || k === "Shift" || k === "Alt" || k === "Meta") { return; }
            var sig = _sig(k.length === 1 ? k.toUpperCase() : k, (e.ctrlKey || e.metaKey), e.shiftKey, e.altKey);
            if (!oSet[sig]) { return; }     // WS20 단축키 아님 → iframe 에 맡김

            // iframe 기본동작(브라우저 Ctrl+S 등)·전파 차단.
            e.preventDefault();
            e.stopPropagation();
            if (e.repeat === true) { return; }   // 키 꾹 누름 — 재발송 안 함(핸들러도 e.repeat 가드)

            try {
                var ev = new KeyboardEvent("keydown", {
                    key: e.key, code: e.code, bubbles: true, cancelable: true,
                    ctrlKey: e.ctrlKey, shiftKey: e.shiftKey, altKey: e.altKey, metaKey: e.metaKey, repeat: e.repeat
                });
                Object.defineProperty(ev, "keyCode", { get: function () { return e.keyCode; } });
                Object.defineProperty(ev, "which", { get: function () { return e.which || e.keyCode; } });
                document.dispatchEvent(ev);
            } catch (err) {
                console.warn("[HTML5][WS20][prev] shortcut forward 실패:", err && err.message);
            }
        }, true);   // capture — iframe 앱보다 먼저 가로채기
    }

    //가운데 페이지(미리보기 영역) 구성 — HTML5.
    function _ws20RenderPreviewHost() {

        var oPanel = document.getElementById("ws20DesignPreview");
        if (!oPanel) {
            console.warn("[HTML5][WS20][prev] #ws20DesignPreview 미존재 — 셸 미렌더.");
            return;
        }

        var oBody = oPanel.querySelector(".u4aWs20PanelBody");
        if (!oBody) { return; }

        // 이미 구성됨 — 재진입시 skip (iframe 상태 유지).
        if (document.getElementById("prevHTML")) { return; }

        // W1 placeholder 라벨("미리보기 — W2 예정") 제거.
        var oLbl = oBody.querySelector(".u4aWs20PanelLabel");
        if (oLbl) { oLbl.remove(); }

        //미리보기 영역 구성. (원본 uiPreviewArea.js 6~9행의 HTML content 1:1 —
        // wrapper div + iframe. 흰 배경 유지(미리보기 앱 영역))
        var oWrap = document.createElement("div");
        oWrap.className = "u4aWs20PrevFrameWrap";
        oWrap.style.width = "100%";
        oWrap.style.height = "100%";
        oWrap.style.overflow = "hidden";

        var oFrame = document.createElement("iframe");
        oFrame.id = "prevHTML";
        oFrame.name = "prevHTML";
        oFrame.style.width = "100%";
        oFrame.style.height = "100%";
        oFrame.setAttribute("frameborder", "0");
        oFrame.setAttribute("framespacing", "0");
        oFrame.setAttribute("marginheight", "0");
        oFrame.setAttribute("marginwidth", "0");

        oWrap.appendChild(oFrame);
        oBody.appendChild(oWrap);

        // [HTML5] 미리보기 iframe 에 포커스가 가도 WS20 단축키가 동작하도록 keydown 포워딩 부착.
        //   src 설정/리로드로 load 가 날 때마다(=문서 새로 생길 때마다) 재부착.
        oFrame.addEventListener("load", function () {
            try { _attachPreviewShortcutForward(oFrame); } catch (e) { }
        });
        // 이미 로드된 상태(load 이벤트를 놓친 경우)도 즉시 시도.
        try { _attachPreviewShortcutForward(oFrame); } catch (e) { }

        /* ── 헤더(#ws20PrevHeader) 컨트롤 연결 ───────────────────────── */

        var oHdr = document.getElementById("ws20PrevHeader");
        if (oHdr) {

            //타이틀 — 원본 sap.m.Title text = A67(Preview).
            var oTit = oHdr.querySelector(".u4aWs20PanelHdrTitle");
            if (oTit) { oTit.textContent = _msg("A67", "Preview"); }

            //Avatar(단축키 잠금 상태 표시 아이콘) — 원본 uiPreviewArea.js 25~42행.
            // sap.m.Avatar(sap-icon://locked, visible:false) → 🔒 span.
            if (!document.getElementById("ws20PrevLockIcon")) {
                var oLock = document.createElement("span");
                oLock.id = "ws20PrevLockIcon";
                oLock.className = "u4aWs20PrevLockIcon";
                oLock.title = "Shortcut Locked";
                oLock.innerHTML = '<i class="fa-solid fa-lock"></i>';
                oLock.style.display = "none"; //원본 visible:false
                if (oTit && oTit.parentNode) {
                    oTit.parentNode.insertBefore(oLock, oTit.nextSibling);
                }

                //단축키 잠금 상태를 표현하기 위한 defineProperty (원본 33~42행 1:1).
                try {
                    let _value = oAPP.attr.isShortcutLock;
                    Object.defineProperty(oAPP.attr, 'isShortcutLock', {
                        configurable: true,
                        get() {
                            return _value;
                        },
                        set(newVal) {
                            _value = newVal;
                            //구 _oAvatar.setVisible(newVal)
                            oLock.style.display = newVal ? "" : "none";
                        }
                    });
                } catch (e) {
                    console.warn("[HTML5][WS20][prev] isShortcutLock defineProperty skip:", e && e.message);
                }
            }

            //미리보기 확대 축소 비율 조절 slider. (원본 58행: min 0.1, max 2, step 0.1, value 1)
            var oSlid = document.getElementById("ws20PrevZoomSlider");
            if (oSlid) {
                oSlid = _replaceWithClone(oSlid);
                oSlid.min = "0.1";
                oSlid.max = "2";
                oSlid.step = "0.1";
                oSlid.value = "1";
                oSlid.disabled = false; //W1 비활성(자리만) 해제
                oSlid.title = "Zoom";

                //slider변경 이벤트 (원본 62행 attachChange 1:1 의미 — 놓는 시점)
                oSlid.addEventListener("change", function () {
                    var oWin = _getFrameWin();
                    if (!oWin || typeof oWin.setPreviewZoom !== "function") {
                        console.warn("[HTML5][WS20][prev] setPreviewZoom 미가용(미리보기 미로드).");
                        return;
                    }
                    try {
                        oWin.setPreviewZoom(parseFloat(this.value));
                    } catch (e) {
                        console.warn("[HTML5][WS20][prev] setPreviewZoom 오류:", e && e.message);
                    }
                });
            }

            //B17 Reset — 미리보기 확대 축소 초기화. (원본 48~55행: 슬라이더 1 리셋 +
            // setPreviewZoom(1). ※ reload 는 하지 않음)
            var oBtnRefresh = document.getElementById("ws20PrevRefreshBtn");
            if (oBtnRefresh) {
                oBtnRefresh = _replaceWithClone(oBtnRefresh);
                oBtnRefresh.title = _msg("B17", "Reset");
                oBtnRefresh.addEventListener("click", function () {
                    if (oSlid) { oSlid.value = "1"; } //구 oSlid.setValue(1)
                    var oWin = _getFrameWin();
                    if (!oWin || typeof oWin.setPreviewZoom !== "function") {
                        console.warn("[HTML5][WS20][prev] setPreviewZoom 미가용(미리보기 미로드).");
                        return;
                    }
                    try {
                        oWin.setPreviewZoom(1);
                    } catch (e) {
                        console.warn("[HTML5][WS20][prev] setPreviewZoom 오류:", e && e.message);
                    }
                });
            }

            //C23 Full Screen — 미리보기 전체화면 스위치(원본 sap.m.Switch change → prevFullScreen).
            //  공통 .u4a-switch(label>input[checkbox]+span.slider) 소비 — ServerList 사운드 설정과 동일.
            //  ★ textContent 로 "OFF/ON" 글자를 넣으면 스위치의 input/slider 가 지워지므로 절대 금지.
            //    체크박스 change(checked)로 상태를 읽는다.
            var oTgl = document.getElementById("ws20PrevOffToggle");
            if (oTgl) {
                oTgl = _replaceWithClone(oTgl);   // 기존 리스너 제거(내부 input/slider 는 복제로 보존)
                oTgl.title = _msg("C23", "Full Screen");
                var oTglIn = oTgl.querySelector('input[type="checkbox"]');
                if (oTglIn) {
                    oTglIn.addEventListener("change", function () {
                        try {
                            oAPP.fn.prevFullScreen(this.checked);
                        } catch (e) {
                            console.warn("[HTML5][WS20][prev] prevFullScreen 오류:", e && e.message);
                        }
                    });
                }
            }

            //B39 Help — 도움말 버튼. (원본 82~127행 구조 보존 — 가드)
            var oBtnHelp = document.getElementById("ws20PrevHelpBtn");
            if (oBtnHelp) {
                oBtnHelp = _replaceWithClone(oBtnHelp);
                oBtnHelp.title = _msg("B39", "Help");
                oBtnHelp.addEventListener("click", function () {

                    var l_ui = this;

                    try {
                        //U4A HELP DOCUMENT 통합 (원본 102~106행: UHAK901369 +
                        // fnU4AHelpDocuPopupOpener({startMenuId:"000273"}))
                        if (oAPP.common.checkWLOList("C", "UHAK901369") === true &&
                            typeof oAPP.fn.fnU4AHelpDocuPopupOpener === "function") {
                            parent.setBusy("X"); //원본 90행
                            oAPP.fn.fnU4AHelpDocuPopupOpener({ startMenuId: "000273" });
                            return;
                        }
                    } catch (e) {
                        console.warn("[HTML5][WS20][prev] U4A HELP 팝업 오류:", e && e.message);
                        try { parent.setBusy && parent.setBusy(""); } catch (e2) { }
                    }

                    //attribute 도움말 팝업 (원본 112~124행 — callTooltipsPopup 은
                    // sap.m 팝업(UI5)이라 HTML5 호스트 미지원 → 존재시에만 호출 가드)
                    if (typeof oAPP.fn.callTooltipsPopup !== "undefined") {
                        try {
                            parent.setBusy("X");
                            oAPP.fn.callTooltipsPopup(l_ui, "prevTooltip", "E22");
                        } catch (e) {
                            console.warn("[HTML5][WS20][prev] callTooltipsPopup 오류(UI5 의존 — 미변환):", e && e.message);
                            try { parent.setBusy && parent.setBusy(""); } catch (e2) { }
                        }
                        return;
                    }

                    console.warn("[HTML5][WS20][prev] 도움말 팝업 미변환(UI5 의존) — skip.");

                });
            }

        } //end of 헤더 컨트롤 연결.

    } //가운데 페이지(미리보기 영역) 구성 — HTML5.

    //[OVERRIDE] 구 oAPP.fn.uiPreviewArea(oMPage) — 인자(oMPage: sap.m.Page)는
    //HTML5 셸에서 불필요(컨테이너 #ws20DesignPreview 고정)라 무시.
    oAPP.fn.uiPreviewArea = function (oMPage) {
        _ws20RenderPreviewHost();
    };

    /* ********************************************************************
     * 미리보기 전체화면 처리 — HTML5. (원본 uiPreviewArea.js 1429행 prevFullScreen:
     *   true  → tree/attr 영역 size 0px / minSize 0 / resizable false
     *   false → tree 25%/300 / attr 30%/300 / resizable true)
     * HTML5 3분할(flex)에선 좌/우 패널과 리사이저 바를 숨김/복원으로 동일 효과.
     * ******************************************************************** */
    function _ws20PrevFullScreen(bState) {

        var oTree = document.getElementById("ws20DesignTree");
        var oAttr = document.getElementById("ws20DesignAttr");
        var oSplit = document.getElementById("ws20DesignSplit");

        if (!oTree || !oAttr || !oSplit) { return; }

        var aBars = oSplit.querySelectorAll(".u4aWs20Resizer");

        //미리보기 전체화면을 설정한 경우.
        if (bState === true) {
            //design tree 영역 최소화. (구 size 0px / minSize 0 / resizable false)
            oTree.style.display = "none";

            //attr 영역 최소화.
            oAttr.style.display = "none";

            //리사이저 바 숨김. (구 resizable false)
            for (var i = 0; i < aBars.length; i++) { aBars[i].style.display = "none"; }

            return;
        }

        //default 복원. (구 tree 25%/300, attr 30%/300, resizable true)
        oTree.style.display = "";
        oTree.style.flex = "0 0 25%";
        oTree.style.minWidth = "300px";

        oAttr.style.display = "";
        oAttr.style.flex = "0 0 30%";
        oAttr.style.minWidth = "300px";

        for (var j = 0; j < aBars.length; j++) { aBars[j].style.display = ""; }

    } //미리보기 전체화면 처리 — HTML5.

    oAPP.fn.prevFullScreen = _ws20PrevFullScreen;

    /* ********************************************************************
     * (3) 미리보기 모듈(design/js/uiPreviewArea.js) 지연 로드.
     *     원본 main.js 1937행(getScript("design/js/uiPreviewArea", ...)) 과
     *     동일한 "지연 로드" 방식. 로드 후 UI5 전용 2개만 HTML5 로 재-override.
     *     callDesignContextMenu.js 도 원본 방식(uiDesignArea.js 988~998행)으로
     *     같이 로드(iframe drawPreview 1863행이 직접 참조).
     * ******************************************************************** */
    var _bPrevModuleLoaded = false;
    var _bPrevModuleLoading = false;
    var _aPrevModuleWaiters = [];

    oAPP.fn.fnWs20EnsurePreviewModule = function (fnDone) {

        fnDone = (typeof fnDone === "function") ? fnDone : function () { };

        if (_bPrevModuleLoaded) { fnDone(); return; }

        _aPrevModuleWaiters.push(fnDone);

        if (_bPrevModuleLoading) { return; }
        _bPrevModuleLoading = true;

        // 모듈이 참조/정의하는 광역(oAPP.oDesign.fn 등) 보장.
        _ensureDesignGlobals();

        function lf_finish() {
            _bPrevModuleLoaded = true;
            _bPrevModuleLoading = false;

            // 로드된 원본 중 UI5 전용 2개만 HTML5 구현으로 재-override.
            //  · uiPreviewArea : sap.ui.core.HTML/sap.m 툴바 → HTML5 호스트 렌더러
            //  · prevFullScreen: SplitterLayoutData(UI5) → flex 패널 숨김/복원
            //  (loadPreviewFrame/getUi5Libraries/getBootStrapUrl/previewUIsetProp
            //   등 나머지는 전부 "원본 그대로" 사용 = 1:1 보존)
            oAPP.fn.uiPreviewArea = function (oMPage) { _ws20RenderPreviewHost(); };
            oAPP.fn.prevFullScreen = _ws20PrevFullScreen;

            var aW = _aPrevModuleWaiters.splice(0);
            for (var i = 0; i < aW.length; i++) {
                try { aW[i](); } catch (e) { }
            }
        }

        function lf_loadContextMenu() {
            //context menu ui 생성 function이 존재하는경우. (원본 uiDesignArea.js 988행)
            if (typeof oAPP.fn.callDesignContextMenu !== "undefined" &&
                oAPP.fn.callDesignContextMenu.__ws20Guard !== true) {
                lf_finish();
                return;
            }
            //context menu ui 생성 function이 존재하지 않는경우 script 호출. (993행)
            //※ callDesignContextMenu.js 는 this.sap(=미리보기 iframe 의 UI5)으로
            //  UI 를 생성하므로 호스트에 UI5 가 없어도 "정의" 자체는 안전.
            try {
                oAPP.fn.getScript("design/js/callDesignContextMenu", function () {
                    lf_finish();
                });
            } catch (e) {
                console.warn("[HTML5][WS20][prev] callDesignContextMenu 로드 실패:", e && e.message);
                lf_finish();
            }
        }

        //ui preview area 모듈 로드. (원본 main.js 1937행 방식)
        //【실측】design/js/uiPreviewArea.js 최상위는 함수 정의만 존재(즉시실행
        //  UI5 코드 없음 / oAPP.oDesign.fn 참조 1건 → 위에서 보장).
        try {
            oAPP.fn.getScript("design/js/uiPreviewArea", function () {
                lf_loadContextMenu();
            });
        } catch (e) {
            console.warn("[HTML5][WS20][prev] uiPreviewArea 모듈 로드 실패(미리보기 비활성):", e && e.message);
            _bPrevModuleLoading = false;
            _aPrevModuleWaiters.splice(0); //로드 실패 — 대기 콜백 폐기(미리보기 skip)
        }

    }; // end of fnWs20EnsurePreviewModule

    /* ********************************************************************
     * (5) oLTree1 스텁 보강 — iframe(drawPreview 완료 후, index.js 2541행)과
     *     원본 loadPreviewFrame(_loaded 분기, uiPreviewArea.js 157~167행)이
     *     수행하는 "트리 1행(ROOT) fireCellClick" 을 HTML5 선택 흐름으로 매핑.
     *     원본 cellClick 핸들러(uiDesignArea.js 26~75행)의 HTML5 대응은
     *     fnWs20TreeSelectRow(W3) 이다.
     * ******************************************************************** */
    function _ws20PatchTreeStub() {

        oAPP.attr.ui = oAPP.attr.ui || {};

        var oTree = oAPP.attr.ui.oLTree1;
        if (!oTree) {
            //W3 트리 파일의 uiDesignArea 미수행(이론상 없음) — 최소 스텁 생성.
            oTree = oAPP.attr.ui.oLTree1 = { __html5: true };
        }

        if (oTree.__ws20PrevPatched === true) { return; }
        oTree.__ws20PrevPatched = true;

        //원본: oLTree1.getRows()[0].getBindingContext() = 첫 행(ROOT) 컨텍스트.
        oTree.getRows = function () {
            try {
                var aTree = oAPP.attr.oModel && oAPP.attr.oModel.oData && oAPP.attr.oModel.oData.zTREE;
                if (!Array.isArray(aTree) || !aTree[0]) { return []; }

                var oNode = aTree[0];

                //sap.ui.model.Context 호환 최소 구현
                //(원본 cellClick 핸들러는 getProperty() 무인자 호출로 노드 전체를 얻음)
                var oCtxt = {
                    getProperty: function (sPath) {
                        if (typeof sPath === "undefined" || sPath === "" || sPath === "/") {
                            return oNode;
                        }
                        return oNode[sPath];
                    },
                    getObject: function () { return oNode; }
                };

                return [{
                    getBindingContext: function () { return oCtxt; }
                }];
            } catch (e) {
                return [];
            }
        };

        //원본: fireCellClick({rowBindingContext:ctx}) → cellClick 핸들러
        //      → setSelectTreeItem(ROOT) (= HTML5 fnWs20TreeSelectRow).
        oTree.fireCellClick = function (oParam) {
            try {
                var oCtxt = oParam && oParam.rowBindingContext;
                var oNode = (oCtxt && typeof oCtxt.getProperty === "function") ? oCtxt.getProperty() : null;
                if (!oNode) { return; }

                var oP;
                if (typeof oAPP.fn.fnWs20TreeSelectRow === "function") {
                    oP = oAPP.fn.fnWs20TreeSelectRow(oNode);
                } else if (typeof oAPP.fn.fnWs20SelectUI === "function") {
                    oP = oAPP.fn.fnWs20SelectUI(oNode.OBJID);
                }

                Promise.resolve(oP).catch(function (e) {
                    console.warn("[HTML5][WS20][prev] fireCellClick 선택 오류:", e && e.message);
                }).finally(function () {
                    //미리보기 로드 완료 시점 — busy 안전 해제. (원본 의미:
                    // 미리보기 구성 완료 → ROOT 선택 완료 시점에 busy 가 풀림)
                    _ws20ReleasePrevBusy();
                });
            } catch (e) {
                console.warn("[HTML5][WS20][prev] fireCellClick 오류:", e && e.message);
                _ws20ReleasePrevBusy();
            }
        };

    } // end of _ws20PatchTreeStub

    /* ********************************************************************
     * (6) 미리보기 로드 트리거 + busy 안전장치.
     *     원본 위치: main.js getAppData 콜백 588행 — 트리 데이터 구성/렌더가
     *     끝난 직후 oAPP.fn.loadPreviewFrame() 호출.
     *     HTML5: fnLoadWs20TreeData(데이터 파이프라인)가 APPDATA 를 새로 구성해
     *     트리를 렌더하는 시점(fnRenderDesignTree)에 1회/APPDATA 단위로 호출.
     * ******************************************************************** */

    var _iPrevBusyWatchdog = null;
    var _bPrevBusyOn = false;

    function _ws20ReleasePrevBusy() {
        //미리보기 로드(부팅) 종료 — 속성 패널 스탠드인 생성 차단 해제.
        //(성공시: prev 에 실제 UI 인스턴스가 채워져 있어 스탠드인은 더이상 생성되지 않음 /
        // 실패시: 헤드리스와 동일하게 스탠드인 모드로 복귀 — 속성 패널 정상 동작)
        oAPP.attr.__ws20PrevBooting = false;
        if (_iPrevBusyWatchdog) {
            clearTimeout(_iPrevBusyWatchdog);
            _iPrevBusyWatchdog = null;
        }
        if (!_bPrevBusyOn) { return; }
        _bPrevBusyOn = false;
        try { oAPP.common.fnSetBusyLock(""); } catch (e) { }
    }

    function _ws20EngagePrevBusy() {
        _bPrevBusyOn = true;
        try { oAPP.common.fnSetBusyLock("X"); } catch (e) { }

        //안전장치 — 미리보기 로드 실패(UI5 bootstrap 실패/서버 단절 등)시에도
        //busy 가 풀리도록 watchdog. (원본엔 없음 — W2 명세의 안전장치)
        if (_iPrevBusyWatchdog) { clearTimeout(_iPrevBusyWatchdog); }
        _iPrevBusyWatchdog = setTimeout(function () {
            console.warn("[HTML5][WS20][prev] 미리보기 로드 60s 초과 — busy 안전 해제(미리보기는 백그라운드 계속).");
            _ws20ReleasePrevBusy();
        }, 60000);
    }

    //[PUBLIC] 미리보기 로드 — 원본 loadPreviewFrame 호출부(getAppData 588행) 대응.
    oAPP.fn.fnWs20LoadPreview = function () {

        /* ----------------------------------------------------------------
         * [사전조건 가드] preview iframe(start→loadUi5BootstrapScript)이
         * 즉시 참조하는 의존을 미리 보장한다. 미보장 시 iframe 내부에서
         * uiPreviewArea.js:378(getBootStrapUrl → LIB.T_9011.find) 등이
         * TypeError 로 죽어 미리보기가 빈 화면이 된다.
         * ---------------------------------------------------------------- */

        // (a) appInfo — 원본 main.js 746행(oAPP.attr.appInfo = parent.getAppInfo()) 1:1.
        try {
            if (!oAPP.attr.appInfo || !oAPP.attr.appInfo.APPID) {
                var _oAppInfo = parent.getAppInfo();
                if (_oAppInfo) { oAPP.attr.appInfo = _oAppInfo; }
            }
        } catch (e) { }

        if (!oAPP.attr.appInfo || !oAPP.attr.appInfo.APPID) {
            console.warn("[HTML5][WS20][prev] appInfo(APPID) 미준비 — 미리보기 로드 skip.");
            return;
        }

        // (b) LIB(T_9011 — getBootStrapUrl/getUI5ResourceRoot 가 즉시 참조).
        //     미준비면 LIB 로더 완료 후 1회 재시도. (로더 실패 시 skip — 크래시 금지)
        var bLibReady = !!(oAPP.DATA && oAPP.DATA.LIB && Array.isArray(oAPP.DATA.LIB.T_9011) && oAPP.DATA.LIB.T_9011.length > 0);
        if (!bLibReady) {

            if (oAPP.attr.__ws20PrevLibRetry === true) {
                console.warn("[HTML5][WS20][prev] LIB(T_9011) 미준비(로드 실패/서버 미연결) — 미리보기 로드 skip.");
                return;
            }
            oAPP.attr.__ws20PrevLibRetry = true;

            if (typeof oAPP.fn.fnLoadWs20LibData === "function") {
                console.warn("[HTML5][WS20][prev] LIB 미준비 — LIB 로드 후 미리보기 재시도.");
                try {
                    oAPP.fn.fnLoadWs20LibData(function () {
                        try { oAPP.fn.fnWs20LoadPreview(); } catch (e) { }
                    });
                } catch (e) {
                    console.warn("[HTML5][WS20][prev] LIB 로드 실패 — 미리보기 skip:", e && e.message);
                }
                return;
            }

            console.warn("[HTML5][WS20][prev] LIB 로더 미존재 — 미리보기 로드 skip.");
            return;
        }
        oAPP.attr.__ws20PrevLibRetry = false;

        /* ===== [임시 진단] 미리보기 UI5 부트스트랩 입력값 덤프 =====
         * 'sap is not defined'(iframe bootstrap 실패) 원인 추적용.
         * 실서버에서 한 번 확인 후 제거 예정. */
        try {
            var _diag = {
                bootStrapUrl: (typeof oAPP.fn.getBootStrapUrl === "function") ? (function () { try { return oAPP.fn.getBootStrapUrl(); } catch (e) { return "ERR:" + e.message; } })() : "(fn 없음)",
                ui5Libs: (typeof oAPP.fn.getUi5Libraries === "function") ? (function () { try { return oAPP.fn.getUi5Libraries(true); } catch (e) { return "ERR:" + e.message; } })() : "(fn 없음)",
                theme: (oAPP.DATA && oAPP.DATA.APPDATA && oAPP.DATA.APPDATA.S_0010) ? oAPP.DATA.APPDATA.S_0010.UITHM : "(S_0010 없음)",
                appId: oAPP.attr.appInfo && oAPP.attr.appInfo.APPID,
                packg: oAPP.attr.appInfo && oAPP.attr.appInfo.PACKG,
                ua025Cnt: (oAPP.attr.S_CODE && Array.isArray(oAPP.attr.S_CODE.UA025)) ? oAPP.attr.S_CODE.UA025.length : "(UA025 없음)",
                t9011Cnt: (oAPP.DATA && oAPP.DATA.LIB && Array.isArray(oAPP.DATA.LIB.T_9011)) ? oAPP.DATA.LIB.T_9011.length : "(T_9011 없음)"
            };
            console.warn("===== [WS20 PREVIEW DIAG] =====\n" + JSON.stringify(_diag, null, 2) + "\n===============================");
        } catch (e) {
            console.warn("[WS20 PREVIEW DIAG] dump 실패:", e && e.message);
        }
        /* ===== [임시 진단] 끝 ===== */

        // 호스트(iframe/툴바) 미구성시 구성. (재진입 안전 — idempotent)
        try { _ws20RenderPreviewHost(); } catch (e) { }

        // iframe 컨테이너가 없으면(셸 미렌더) skip.
        if (!document.getElementById("prevHTML")) {
            console.warn("[HTML5][WS20][prev] #prevHTML 미존재 — 미리보기 로드 skip.");
            return;
        }

        //세션 랜덤키 얻기. (원본 getAppData 592행 — iframe DnD 가 참조)
        try {
            if (!oAPP.attr.DnDRandKey) {
                oAPP.attr.DnDRandKey = parent.getSSID();
            }
        } catch (e) { }

        // ROOT 선택 매핑 스텁 보강.
        _ws20PatchTreeStub();

        /* ----------------------------------------------------------------
         * ★ [원본 1:1 정합 — 자식 UI 미표시 버그 수정]
         * 원본 의미: 1차 drawPreview 시점에 oAPP.attr.prev 는 반드시 "빈 객체".
         * (원본 main.js 6행에서 {} 로 생성, 이후 미리보기 iframe 의
         *  createUIInstance 만 prev 를 채움. 속성 영역은 미리보기 구성 "후"에만
         *  prev 를 참조.)
         * iframe 의 drawPreview(preview/index.js 1842행)는 prev 가 비어있지
         * 않으면 "재그리기" 분기로 판단하여
         *   APPDATA.T_0015 = parent.oAPP.fn.getAttrChangedData()
         * 로 T_0015 전체를 prev 수집본으로 "교체"한다. 속성 패널(W4)의
         * 스탠드인이 미리보기 로드 전에 prev 에 들어있으면 T_0015 가 해당
         * OBJID 행만 남아 자식 UI 의 임베드(UIATY="6")·프로퍼티 행이 전부
         * 소실 → "흰 화면 + 자식 UI 미표시" 조용한 실패가 된다.
         *
         * ※ 오염의 근원이던 "트리 렌더 직후 ROOT 자동선택"은 문서 정합 재정렬로
         *   제거됨(기본 선택은 문서 6.2 — 미리보기 로드 완료 후 fireCellClick
         *   경로로만 수행). 아래 purge/booting 차단은 그 외 경로(미리보기 로드
         *   전 사용자 트리 클릭 등)에 대한 안전망으로 유지한다.
         * → 미리보기 로드 직전: 스탠드인(__ws20Standin) 전부 제거.
         * → 로드중(__ws20PrevBooting): 속성 패널이 스탠드인을 prev 에 재생성하지
         *   않도록 차단(transient). 완료/실패시 _ws20ReleasePrevBusy 에서 해제.
         * ---------------------------------------------------------------- */
        oAPP.attr.__ws20PrevBooting = true;
        // busy 를 "여기서 동기로" 인수(+watchdog) — 데이터 finally 가 끄지 않도록 하고
        // (모듈 로드/iframe 이 비동기라) 모든 후속 경로에서 watchdog 안전망이 작동하게 한다.
        // (성공: fireCellClick → release / 실패: 아래 경로들 / 60s: watchdog → release)
        _ws20EngagePrevBusy();
        try {
            for (var _k in oAPP.attr.prev) {
                if (oAPP.attr.prev[_k] && oAPP.attr.prev[_k].__ws20Standin === true) {
                    delete oAPP.attr.prev[_k];
                }
            }
        } catch (e) { }

        // 모듈(원본 uiPreviewArea.js + callDesignContextMenu.js) 확보 후 로드.
        oAPP.fn.fnWs20EnsurePreviewModule(function () {

            if (typeof oAPP.fn.loadPreviewFrame !== "function") {
                console.warn("[HTML5][WS20][prev] loadPreviewFrame 미존재(모듈 로드 실패) — skip.");
                //부팅 차단 해제 + busy 해제(스탠드인 모드 복귀 — 속성 패널 정상 동작 유지).
                _ws20ReleasePrevBusy();
                return;
            }

            // busy — 미리보기 구성 완료(ROOT fireCellClick)까지 잠금. (원본 의미)
            _ws20EngagePrevBusy();

            // iframe 로드 실패 안전장치.
            try {
                var oFrame = document.getElementById("prevHTML");
                if (oFrame && oFrame.__ws20ErrHooked !== true) {
                    oFrame.__ws20ErrHooked = true;
                    oFrame.addEventListener("error", function () {
                        console.warn("[HTML5][WS20][prev] 미리보기 iframe 로드 오류 — busy 해제.");
                        _ws20ReleasePrevBusy();
                    });
                }
            } catch (e) { }

            //미리보기 화면 구성. (원본 getAppData 588행 1:1 — 원본 loadPreviewFrame:
            // _loaded 면 setUiLoadLibraries+drawPreview→ROOT 재선택 /
            // 미로드면 src=design/preview/index.html(로컬) 후 iframe 내부가 진행)
            try {
                oAPP.fn.loadPreviewFrame();
            } catch (e) {
                console.warn("[HTML5][WS20][prev] loadPreviewFrame 오류 — busy 해제:", e && e.message);
                _ws20ReleasePrevBusy();
            }

        });

    }; // end of oAPP.fn.fnWs20LoadPreview

    /************************************************************************
     * [정리 — 문서 정합] (구) "트리 렌더 시점 감지" 미리보기 로드 트리거는 제거됨.
     *   문서 5장 14단계 그대로, getAppData(fnLoadWs20TreeData [ws_html5_ws20_data.js])
     *   의 후처리 마지막(원본 main.js 588행 위치)에서 oAPP.fn.fnWs20LoadPreview()
     *   를 직접 호출한다. (원본도 getAppData 마다 loadPreviewFrame 호출)
     ************************************************************************/

    /************************************************************************
     * [OVERRIDE] WS20 셸 렌더 — 셸(W1)+트리(W3)+속성(W4) 렌더 후
     *   미리보기 호스트(iframe+툴바 연결) 렌더. (구 placeholder 라벨 대체)
     ************************************************************************/
    var _fnRenderWs20Shell_super = oAPP.fn.fnRenderWs20Shell;

    oAPP.fn.fnRenderWs20Shell = function () {

        // W1 셸 + W3 트리 + W4 속성 렌더 위임.
        if (typeof _fnRenderWs20Shell_super === "function") {
            _fnRenderWs20Shell_super();
        }

        // 중앙 미리보기 호스트 렌더 (구 uiPreviewArea(oDesignPreview)).
        try {
            oAPP.fn.uiPreviewArea();
        } catch (e) {
            console.warn("[HTML5][WS20][prev] fnRenderWs20Shell→uiPreviewArea error:", e && e.message);
        }

    }; // end of [OVERRIDE] fnRenderWs20Shell

    /* ********************************************************************
     * [정리 — 문서 정합] (구) fnWs20SelectUI 후처리 래퍼(미리보기 동기화)는 제거됨.
     *   트리 선택 ↔ 미리보기 동기화는 문서 8장 순서 그대로 W4
     *   (ws_html5_ws20_attr.js)의 fnWs20SelectUI(=setSelectTreeItem 11단계) /
     *   fnWs20DesignTreeItemPress(=designTreeItemPress 8단계)가 수행한다:
     *     … → fn_removeMark → ClearDropEffect → setUIInfo → updateAttrList
     *     → redrawUIScript(조건) → refreshPreview → (구버전) closePopup
     *     → 스크롤보정 → selectBindingPopupOBJID → setAttrFocus
     *     → selPreviewUI(마지막).
     *   (iframe 함수는 전부 frame/contentWindow/_loaded 가드 경유)
     * ******************************************************************** */

})(window, (window.jQuery || window.$), oAPP);
