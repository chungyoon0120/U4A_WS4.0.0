/************************************************************************
 * ws_html5_ws20_attr.js  (HTML5)
 * ----------------------------------------------------------------------
 * [HTML5 컨버전 메모 — W4 단계: WS20 우측 "속성(Attribute) 패널"]
 *  WS20 비주얼 편집화면의 우측 속성 패널을
 *  SAP UI5(sap.f.DynamicPage + sap.m.Table, design/js/uiAttributeArea.js)
 *  → 순수 HTML5(DOM + CSS + 바닐라 JS) 로 재구현한다.
 *
 *  본 파일은 library-preload.js 의 로드 목록에서 ws_html5_ws20_data.js "보다 뒤"
 *  (가장 마지막) 에 위치한다.
 *
 *  ────────────────────────────────────────────────────────────────────
 *  [원본 데이터 흐름 — 실측]
 *  ────────────────────────────────────────────────────────────────────
 *   1) LIB 파이프라인 (design/js/main.js setUIAreaEditable 813~867행):
 *        lt_lib = [9011, 0020, 0022, 0023, 0024, 0027] (prefix ZTU4A 또는 /U4A/T)
 *        → 각 테이블별 oAPP.fn.getLibData(618행): sendAjax("/getLibData", GET) 페이징
 *          (tabnm/dbtot/dbcnt/fkey/skey) 로 oAPP.DATA.LIB[alias] 누적.
 *        → 전부 END 후: T_0022.LIBNM 매핑 → setCodeMasterData(T_9011→S_CODE)
 *          → setCodeMasterDataUA035 → getAppData() (HTML5: fnLoadWs20TreeData)
 *   2) 선택 흐름 (uiDesignArea.js setSelectTreeItem 2172행 → designTreeItemPress 3510행):
 *        busy/단축키잠금/BUSY_ON broadcast → setUIInfo(트리노드) → /uiinfo
 *        → updateAttrList(UIOBK, OBJID) (uiAttributeArea.js 7128행) → /T_ATTR
 *        (그 외 미리보기 갱신/selPreviewUI 등은 W2 범위 — 호출하지 않음)
 *   3) 속성 행(T_ATTR) 데이터 구조 (crtStru0015 + attrCreateAttrBindField):
 *        UIATK(속성키)/UIATT(라벨)/UIATV(값)/UIATY(1:Property 2:Event
 *        3:Aggregation 6:Embedded)/UIADT(type)/ISBND/ISLST/ISMLB/DEFVL …
 *        + 화면제어: edit/inp_visb/sel_visb/chk_visb/btn_visb/T_DDLB/UIATV_c/
 *          showF4/btn_text/btn_icon/btn_type/icon0~2_visb/src/color
 *   4) 값 변경: attrChange(1764행) → (로컬 모델만 반영) attrChgAttrVal(5330행)이
 *        oAPP.attr.prev[OBJID]._T_0015 에 수집. 서버 반영은 Save(getSaveData) 시점.
 *
 *  ────────────────────────────────────────────────────────────────────
 *  [UI5 의존이라 "가드"만 하는 것 (W2/W4+ 예정)]
 *  ────────────────────────────────────────────────────────────────────
 *   · 미리보기 반영(previewUIsetProp/selPreviewUI/redrawUIScript) — W2
 *   · 팝업류: CSS/JS Link Add, Web Security, F4 Help, 바인딩/이벤트 팝업,
 *     preset(개인화), 도움말, OBJID 변경(attrChnageOBJID) — W4+ (console.warn)
 *   · chkValidProp — 미리보기 frame 의 sap.ui.base.DataType 의존 → skip 가드.
 *   · setExcepAttr / attrSetAutoGrowingException / attrSetDropAbleException —
 *     UI 타입별 아이콘/잠금 예외(데이터성이지만 분량 큼) → 원본 함수가 정의되어
 *     있으면 호출, 없으면 skip (크래시 없음).
 *
 *  ────────────────────────────────────────────────────────────────────
 *  [oAPP.attr.prev 스탠드인]
 *  ────────────────────────────────────────────────────────────────────
 *   원본의 oAPP.attr.prev[OBJID]._T_0015 는 "미리보기(W2)" 가 UI 인스턴스를
 *   생성하면서 APPDATA.T_0015 행을 수집해 만든다. W2 미변환 상태에서는 prev 가
 *   비어 있으므로, 선택 시점에 APPDATA.T_0015 의 "동일 행 참조" 로 스탠드인을
 *   구성한다(복사 아님 — 원본 저장 흐름(getSaveData가 prev를 순회)과 동일 의미 유지).
 *
 *  서버 없는 헤드리스/비로그인 환경에서는 LIB/APPDATA 가 없어 속성 행이
 *  비어 보일 수 있다(정상). 모든 경로는 크래시 없이 skip 한다.
 ************************************************************************/

(function (window, $, oAPP) {
    "use strict";

    var APPCOMMON = oAPP.common;

    /************************************************************************
     * [원본 보존] 상수 — uiAttributeArea.js 3~16행 1:1.
     ************************************************************************/
    //ATTR 필수 입력 표현 아이콘.
    var C_ATTR_REQ_ICON = "sap-icon://favorite";

    //ATTR 필수 입력 표현 아이콘 색상.
    var C_ATTR_REQ_ICON_COLOR = "#c14646";

    //바인딩(서버이벤트) 색상 필드
    var C_ATTR_BIND_ICON_COLOR = "#dec066";

    //SELECT OPTION2(SELECT OPTION3) F4Help 삭제 아이콘 색상.
    var C_ATTR_SEL_OPT_F4_ICON_COLOR = "#fa6161";

    //즐겨찾기 아이콘 색상.
    var C_ATTR_FAV_ICON_COLOR = "#FFD700";

    /************************************************************************
     * 메시지 텍스트 안전 조회 (모델 미초기화/미로그인 폴백) — 기존 W1~W3 패턴.
     ************************************************************************/
    // 언어 = 서버 메시지 클래스 단일 출처(원본 동일). 내부 영문 폴백 보관 금지(2026-06-16 지시).
    //   미조회/("클래스|번호" 형태) 시 코드/번호 자체 반환.
    function _msg(sNum) {
        try {
            var s = APPCOMMON.fnGetMsgClsText("/U4A/CL_WS_COMMON", sNum);
            if (s != null && s !== "" && s.indexOf("|") === -1) { return s; }
        } catch (e) { }
        return sNum;
    }

    function _wsMsg(sNr) {
        try {
            var s = parent.WSUTIL.getWsMsgClsTxt("", "ZMSG_WS_COMMON_001", sNr);
            if (s && s.indexOf("|") === -1) { return s; }
        } catch (e) { }
        return sNr;
    }

    /************************************************************************
     * 원본 미변환(UI5 의존) 함수 안전 호출 — W3 트리 파일과 동일 패턴.
     ************************************************************************/
    function _safeCall(sFnName, aArgs, oThis) {
        var fn = oAPP.fn && oAPP.fn[sFnName];
        if (typeof fn !== "function") { return; }
        try {
            return fn.apply(oThis || oAPP.fn, aArgs || []);
        } catch (e) {
            console.warn("[HTML5][WS20][attr] call skip (미변환/데이터 미로딩):", sFnName, e && e.message);
        }
    }

    /************************************************************************
     * oAPP.oDesign 부트스트랩 — 원본 design/js/main.js 33~72행의 광역 OBJECT.
     *   원본은 oAPP.fn.main() 내부에서 구성하나, HTML5 셸은 main() 을 호출하지
     *   않으므로 동일 값으로 구성한다(이미 구성돼 있으면 보존).
     *   (attrSetLineStyle 의 GLANGU 참조, 트리 파일의 undoRedo 경로 참조용)
     ************************************************************************/
    function _ensureODesign() {
        try {
            oAPP.oDesign = oAPP.oDesign || {};
            oAPP.oDesign.types = oAPP.oDesign.types || {};

            //busy dialog option 파라메터 구조. (원본 main.js 39행)
            if (!oAPP.oDesign.types.TY_BUSY_OPTION) {
                oAPP.oDesign.types.TY_BUSY_OPTION = { TITLE: "", DESC: "" };
            }

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

            //UNDO, REDO 처리 모듈 JS 구성. (원본 main.js 71행)
            if (!oAPP.oDesign.pathInfo.undoRedo) {
                oAPP.oDesign.pathInfo.undoRedo =
                    parent.PATH.join(oAPP.oDesign.pathInfo.designRootPath, "undoRedo", "undoRedo.js");
            }
        } catch (e) {
            // parent API 미가용(헤드리스) — skip.
        }
    }
    _ensureODesign();

    /* ********************************************************************
     * ★ (1) 원본 1:1 포팅 — design/js/main.js (oAPP.fn.main 내부 정의분)
     *   HTML5 셸은 main() 을 호출하지 않아 아래 함수들이 런타임에 없다.
     *   순수 데이터 로직이므로 1:1 복제. (이미 정의돼 있으면 원본 우선)
     * ******************************************************************** */

    //15번 정보 구조 생성. (원본 main.js 162행 1:1)
    if (typeof oAPP.fn.crtStru0015 !== "function") {
        oAPP.fn.crtStru0015 = function () {

            return {
                "APPID": "", "GUINR": "", "OBJID": "", "UIATK": "", "UIATV": "", "ISBND": "", "UILIK": "",
                "UIOBK": "", "UIATT": "", "UIASN": "", "UIADT": "", "RVALU": "", "BPATH": "", "ADDSC": "",
                "UIATY": "", "ISMLB": "", "ISEMB": "", "DEL_LIB": "", "DEL_UOK": "", "DEL_ATT": "",
                "ISWIT": "", "ISSPACE": "", "FTYPE": "", "REFFD": "", "CONVR": "", "MPROP": "", "SHCUT": ""
            };

        };  //15번 정보 구조 생성.
    }

    //MOVE-CORRESPONDING (원본 main.js 228행 1:1)
    if (typeof oAPP.fn.moveCorresponding !== "function") {
        oAPP.fn.moveCorresponding = function (source, target) {

            for (var i in source) {
                if (typeof target[i] === "undefined") { continue; }
                target[i] = source[i];
            }

        };  //MOVE-CORRESPONDING
    }

    //UI에 해당하는 ATTRIBUTE(ZSU4A0015) 정보 구성 (원본 main.js 241행 1:1)
    if (typeof oAPP.fn.crtAttrInfo !== "function") {
        oAPP.fn.crtAttrInfo = function (UIOBK, OBJID) {

            var lt_0023 = oAPP.DATA.LIB.T_0023.filter(a => a.UIOBK === UIOBK && a.ISDEP !== "X");

            var lt_0015 = [], ls_0015 = {};

            for (var i = 0, l = lt_0023.length; i < l; i++) {
                ls_0015 = oAPP.fn.crtStru0015();

                //MOVE-CORRESPONDING
                oAPP.fn.moveCorresponding(lt_0023[i], ls_0015);

                ls_0015.APPID = oAPP.attr.appInfo.APPID;
                ls_0015.GUINR = oAPP.attr.appInfo.GUINR;
                ls_0015.UIOBK = UIOBK;
                ls_0015.OBJID = OBJID;
                lt_0015.push(ls_0015);
                ls_0015 = {};

            }

            return lt_0015;

        };  //UI에 해당하는 ATTRIBUTE(ZSU4A0015) 정보 구성
    }

    //코드마스터정보 코드별로 재구성 처리. (원본 main.js 1243행 1:1)
    if (typeof oAPP.fn.setCodeMasterData !== "function") {
        oAPP.fn.setCodeMasterData = function () {

            oAPP.attr.S_CODE = {};

            //코드마스터 데이터가 존재하지 않는경우 EXIT.
            if (oAPP.DATA.LIB.T_9011.length === 0) {
                return;
            }

            //코드마스터 전체 검색건을 코드별로 수집 처리.
            for (var i = 0, l = oAPP.DATA.LIB.T_9011.length; i < l; i++) {

                //해당 코드가 수집되지 않았다면 수집 ARRAY 구성.
                if (typeof oAPP.attr.S_CODE[oAPP.DATA.LIB.T_9011[i].CATCD] === "undefined") {
                    oAPP.attr.S_CODE[oAPP.DATA.LIB.T_9011[i].CATCD] = [];
                }

                //코드에 해당하는 데이터 수집 처리.
                oAPP.attr.S_CODE[oAPP.DATA.LIB.T_9011[i].CATCD].push(oAPP.DATA.LIB.T_9011[i]);

            }

        };  //코드마스터정보 코드별로 재구성 처리.
    }

    //UI 프로퍼티에 대한 Value 필수항목 대상 추가 정의. (원본 main.js 1271행 1:1)
    if (typeof oAPP.fn.setCodeMasterDataUA035 !== "function") {
        oAPP.fn.setCodeMasterDataUA035 = function () {

            oAPP.attr.S_CODE.UA035.push({ CATCD: "UA035", ITMCD: "CK90000001", FLD01: "SelectOption2", FLD02: "UO99992", FLD03: "value", FLD04: "EXT00001161", FLD05: "X" });
            oAPP.attr.S_CODE.UA035.push({ CATCD: "UA035", ITMCD: "CK90000002", FLD01: "Tree", FLD02: "UO00467", FLD03: "Parent", FLD04: "EXT00001190", FLD05: "X" });
            oAPP.attr.S_CODE.UA035.push({ CATCD: "UA035", ITMCD: "CK90000003", FLD01: "Tree", FLD02: "UO00467", FLD03: "Child", FLD04: "EXT00001191", FLD05: "X" });
            oAPP.attr.S_CODE.UA035.push({ CATCD: "UA035", ITMCD: "CK90000004", FLD01: "TreeTable", FLD02: "UO01142", FLD03: "Parent", FLD04: "EXT00001192", FLD05: "X" });
            oAPP.attr.S_CODE.UA035.push({ CATCD: "UA035", ITMCD: "CK90000005", FLD01: "TreeTable", FLD02: "UO01142", FLD03: "Child", FLD04: "EXT00001193", FLD05: "X" });
            oAPP.attr.S_CODE.UA035.push({ CATCD: "UA035", ITMCD: "CK90000006", FLD01: "SelectOption3", FLD02: "UO99984", FLD03: "value", FLD04: "EXT00002507", FLD05: "X" });

        };  //UI 프로퍼티에 대한 Value 필수항목 대상 추가 정의.
    }

    //화면에서 UI추가, 이동, 삭제 및 attr 변경시 변경 flag 처리. (원본 main.js 874행 1:1)
    if (typeof oAPP.fn.setChangeFlag !== "function") {
        oAPP.fn.setChangeFlag = function () {
            //초상위 부모의 application 정보 얻기(항상 최신 정보를 얻기위함).
            oAPP.attr.appInfo = parent.getAppInfo();

            //변경됨 flag 처리.
            oAPP.attr.appInfo.IS_CHAG = "X";

            //부모의 구조에 change 여부 업데이트 처리.
            parent.setAppInfo(oAPP.attr.appInfo);

            //[HTML5] 변경 즉시 모델/앱헤더 반영 → 상태표시 Active→Inactive (원본 UX)
            try { oAPP.common.fnSetModelProperty("/WS20/APP/IS_CHAG", "X"); } catch (e) { }
            try { if (oAPP.fn.fnUpdateWs20AppHeader) { oAPP.fn.fnUpdateWs20AppHeader(); } } catch (e) { }

        };  //화면에서 UI추가, 이동, 삭제 및 attr 변경시 변경 flag 처리.
    }

    //단축키 잠금 처리 기능. (원본 main.js 916행 1:1)
    //true = 잠금, false = 잠금 해제.
    if (typeof oAPP.fn.setShortcutLock !== "function") {
        oAPP.fn.setShortcutLock = function (bLock) {
            oAPP.attr.isShortcutLock = bLock || false;

        };  //단축키 잠금 처리 기능.
    }

    /* ********************************************************************
     * ★ (2) 원본 1:1 포팅 — design/js/uiAttributeArea.js (데이터성 함수)
     *   uiAttributeArea.js 는 UI5(sap.m.Table 등) 파일이라 HTML5 빌드에서
     *   로드하지 않는다. 아래 함수들은 "데이터 로직"만 있어 1:1 복제한다.
     * ******************************************************************** */

    //visible, editable등의 attribute 처리 전용 바인딩 필드 생성 처리. (원본 6229행 1:1)
    if (typeof oAPP.fn.attrCreateAttrBindField !== "function") {
        oAPP.fn.attrCreateAttrBindField = function (is_0015) {

            //아이콘 활성여부 필드.
            is_0015.icon0_visb = false;  //attribute 필수 입력 표현 아이콘 invisible.
            is_0015.icon1_visb = false;  //바인딩(서버이벤트) 아이콘 invisible
            is_0015.icon2_visb = false;  //help(클라이언트이벤트) 아이콘 invisible

            //아이콘 src 필드.
            is_0015.icon0_src = undefined;  //attribute 필수 입력 표현 아이콘 필드.
            is_0015.icon1_src = undefined;  //바인딩(서버이벤트) 아이콘 필드
            is_0015.icon2_src = undefined;  //help(클라이언트이벤트) 아이콘 필드

            //아이콘 색상 필드.
            is_0015.icon0_color = undefined;  //attribute 필수 입력 표현 아이콘 색상 필드.
            is_0015.icon1_color = undefined;  //바인딩(서버이벤트) 색상 필드
            is_0015.icon2_color = undefined;  //help(클라이언트이벤트) 색상 필드


            is_0015.icon1_ttip = undefined; //바인딩(서버이벤트) 아이콘 tooltip
            is_0015.icon2_ttip = undefined; //help(클라이언트이벤트) 아이콘 tooltip

            //edit 비활성 처리 여부 필드.
            is_0015.edit = false;

            //input의 F4 help 활성여부 필드.
            is_0015.showF4 = false;

            //input의 valueHelpOnly 바인딩 필드.
            is_0015.F4Only = false;

            //input(ddlb,checkbox) valueState 필드.
            is_0015.valst = undefined;

            //input(ddlb,checkbox) valueStateText 필드.
            is_0015.valtx = undefined;

            is_0015.btn_icon = undefined; //버튼 아이콘 필드.

            is_0015.UIATT_ICON = undefined; //attribute 아이콘.

            //attribute 표현 UI default 비활성처리 필드.
            is_0015.inp_visb = false; //input invisible
            is_0015.sel_visb = false; //DDLB invisible
            is_0015.chk_visb = false; //checkbox invisible
            is_0015.btn_visb = false; //버튼 invisible

            is_0015.dropEnable = false;

            //attr 영역의 버튼 text, 버튼 icon, 버튼 type에 관련된 바인딩 필드 추가.
            is_0015.btn_text = "";
            is_0015.btn_icon = undefined;
            is_0015.btn_type = undefined;

        };  //visible, editable등의 attribute 처리 전용 바인딩 필드 생성 처리.
    }

    //오류 필드 초기화 처리. (원본 6293행 1:1)
    if (typeof oAPP.fn.attrClearErrorField !== "function") {
        oAPP.fn.attrClearErrorField = function (bRefresh) {

            //[HTML5 가드] T_ATTR 미구성시 skip (원본은 항상 구성된 상태에서 호출됨)
            if (!oAPP.attr.oModel || !oAPP.attr.oModel.oData || !Array.isArray(oAPP.attr.oModel.oData.T_ATTR)) {
                return;
            }

            for (var i = 0, l = oAPP.attr.oModel.oData.T_ATTR.length; i < l; i++) {
                oAPP.attr.oModel.oData.T_ATTR[i].valst = undefined;
                oAPP.attr.oModel.oData.T_ATTR[i].valtx = undefined;
            }

            if (!bRefresh) { return; }

            oAPP.attr.oModel.refresh();

        };  //오류 필드 초기화 처리.
    }

    //attribute 항목의 DDLB 정보 구성. (원본 6540행 1:1)
    if (typeof oAPP.fn.attrSetDDLBList !== "function") {
        oAPP.fn.attrSetDDLBList = function (VALKY, UIATY, DEFVL) {
            var lt_ddlb = [],
                ls_ddlb = {};

            //attribute가 이벤트건인경우.
            if (UIATY === "2") {
                //서버이벤트 항목 return.
                return oAPP.attr.T_EVT;

            }

            //attribute가 프로퍼티건인경우 enum항목에서 검색.
            var lt_0024 = oAPP.DATA.LIB.T_0024.filter(a => a.VALKY === VALKY);

            //enum 항목에 존재하지 않는경우 return.
            if (lt_0024.length === 0) { return []; }

            //default value가 없는경우 ddlb에 빈라인 추가.
            if (DEFVL === "") {
                lt_ddlb.push({ KEY: "", TEXT: "" });
            }

            //검색한 enum항목을 기준으로 ddlb 항목 구성.
            for (var i = 0, l = lt_0024.length; i < l; i++) {
                ls_ddlb.KEY = lt_0024[i].VALUE;
                ls_ddlb.TEXT = lt_0024[i].VALUE;
                lt_ddlb.push(ls_ddlb);
                ls_ddlb = {};

            }

            //구성항 DDLB 항목 return
            return lt_ddlb;

        };  //attribute 항목의 DDLB 정보 구성.
    }

    /************************************************************************
     * 서버 이벤트 항목 검색 (원본 uiAttributeArea.js 7027행 getServerEventList 1:1).
     * ----------------------------------------------------------------------
     *  ★ 원본은 UI5 디자인영역(uiAttributeArea.js)에만 있고 HTML5 프레임엔 미로드.
     *    UI5 의존부가 없어(ajax + designAreaLockUnlock + parent.setBusy) 그대로 이식한다.
     *  컨트롤러 클래스(CLSID)의 서버 이벤트 메소드 목록을 받아 DDLB 형태
     *  [{KEY,TEXT,DESC}, ...](선두 빈 라인 포함)로 콜백/Promise 전달.
     *  bSkipUnLock=true → busy/lock 해제를 호출처에 위임(원본 동일).
     ************************************************************************/
    if (typeof oAPP.fn.getServerEventList !== "function") {
        oAPP.fn.getServerEventList = function (f_cb, bSkipUnLock) {

            return new Promise(function (resolve) {

                //서버이벤트 호출전 lock처리.
                oAPP.fn.designAreaLockUnlock(true);

                var lt_ddlb = [{ KEY: "", TEXT: "", DESC: "" }];

                //클래스명 서버 전송 데이터에 구성.
                var oFormData = new FormData();
                oFormData.append("CLSNM", oAPP.attr.appInfo.CLSID);

                //컨트롤러 클래스의 서버 이벤트 항목 정보 검색.
                sendAjax(oAPP.attr.servNm + "/getServerEventList", oFormData, function (param) {

                    //UNLOCK SKIP FLAG 처리시 BUSY OFF 처리 금지(원본 동일).
                    if (bSkipUnLock !== true) { parent.setBusy(""); }

                    //서버이벤트 호출후 lock처리.
                    oAPP.fn.designAreaLockUnlock(true);

                    if (param.RETCD !== "S") {
                        if (bSkipUnLock !== true) { oAPP.fn.designAreaLockUnlock(); }
                        resolve(lt_ddlb);
                        return;
                    }

                    var ls_evt_DDLB = {};
                    for (var i = 0, l = (param.EVTLT || []).length; i < l; i++) {
                        ls_evt_DDLB.KEY = ls_evt_DDLB.TEXT = param.EVTLT[i].EVTNM;
                        ls_evt_DDLB.DESC = param.EVTLT[i].DESC;
                        lt_ddlb.push(ls_evt_DDLB);
                        ls_evt_DDLB = {};
                    }

                    //callback function이 존재하지 않는경우 exit.
                    if (!f_cb) {
                        if (bSkipUnLock !== true) { oAPP.fn.designAreaLockUnlock(); }
                        resolve(lt_ddlb);
                        return;
                    }

                    //callback function 수행.
                    f_cb(lt_ddlb);

                    //unlock skip flag가 없는경우 Unlock처리.
                    if (bSkipUnLock !== true) { oAPP.fn.designAreaLockUnlock(); }

                    resolve(lt_ddlb);

                }, !bSkipUnLock ? "X" : "", true, "POST", function (e) {
                    //오류 발생시 lock 해제.
                    oAPP.fn.designAreaLockUnlock();
                    resolve(lt_ddlb);
                });

            });

        };  //서버 이벤트 항목 검색.
    }

    //attribute type에 따른 desc얻기. (원본 7408행 1:1)
    if (typeof oAPP.fn.attrUIATYDesc !== "function") {
        oAPP.fn.attrUIATYDesc = function (UIATY) {
            switch (UIATY) {
                case "1":
                    return "Properties";

                case "2":
                    return "Events";

                case "3":
                    return "Aggregations";

                case "4":
                    return "Associations";

                case "6":
                    return "Embedded Aggregations";

                default:
                    return "";
            }

        };  //attribute type에 따른 desc얻기.
    }

    //attribute 입력 가능 여부 설정. (원본 8067행 1:1)
    if (typeof oAPP.fn.setAttrEditable !== "function") {
        oAPP.fn.setAttrEditable = function (is_attr) {

            //default 입력 불가 처리.
            is_attr.edit = false;

            //편집 가능 상태가 아닌경우 exit.
            if (oAPP.attr.oModel.oData.IS_EDIT !== true) {
                return;
            }

            //Aggregation인경우 exit.
            if (is_attr.UIATY === "3") {
                return;
            }

            //Embed Aggregation인경우 exit.
            if (is_attr.UIATY === "6") {
                return;
            }

            //바인딩 처리가 된경우 exit.
            if (is_attr.ISBND === "X") {
                return;
            }

            //sap.ui.core.HTML UI의 content 프로퍼티인경우 exit.
            if (is_attr.UIATK === "AT000011858") {
                return;
            }


            //selectOption2의 F4HelpID, F4HelpReturnFIeld 프로퍼티인경우.
            if (is_attr.UIATK === "EXT00001188" ||   //SelectOption2의 F4HelpID
                is_attr.UIATK === "EXT00001189" ||   //SelectOption2의 F4HelpReturnFIeld
                is_attr.UIATK === "EXT00001161" ||   //SelectOption2의 value
                is_attr.UIATK === "EXT00002507") {   //SelectOption3의 value

                return;
            }


            //appcontainer의 AppID 프로퍼티인경우.
            if (is_attr.UIATK === "EXT00000030" || //AppID
                is_attr.UIATK === "EXT00000031") { //AppDescript
                return;
            }


            //sap.m.Tree, sap.ui.table.TreeTable의 parent, child 프로퍼티는 입력 불가 처리
            if (is_attr.UIATK === "EXT00001190" ||  //sap.m.Tree의 parent
                is_attr.UIATK === "EXT00001191" ||  //sap.m.Tree의 child
                is_attr.UIATK === "EXT00001192" ||  //sap.ui.table.TreeTable의 parent
                is_attr.UIATK === "EXT00001193") {  //sap.ui.table.TreeTable의 child
                return;

            }


            //default 입력 가능 처리.
            is_attr.edit = true;

        };  //attribute 입력 가능 여부 설정.
    }

    //프로퍼티가 아이콘관련 프로퍼티인지 여부 확인. (원본 5169행 1:1)
    if (typeof oAPP.fn.attrIsIconProp !== "function") {
        oAPP.fn.attrIsIconProp = function (is_attr) {

            //PROPERTY가 아닌경우, 바인딩처리된경우 EXIT.
            if (is_attr.UIATY !== "1") { return; }

            var l_UIATT = is_attr.UIATT.toUpperCase();

            //프로퍼티명에 ICON 관련 키워드가 포함안되는경우 exit.
            if (l_UIATT.indexOf("ICON") === -1 && l_UIATT.indexOf("IMAGE") === -1 && l_UIATT.indexOf("SRC") === -1) { return; }

            //type이 int, float, boolean유형은 처리 하지 않음.
            if (is_attr.UIADT === "int" || is_attr.UIADT === "float" || is_attr.UIADT === "boolean") { return; }

            //프로퍼티 타입이 width, height 관련 타입인경우 exit.
            if (is_attr.UIADT === "sap.ui.core.CSSSize") { return; }

            //프로퍼티 타입이 색상관련 타입인경우 exit.
            if (is_attr.UIADT === "sap.ui.core.CSSColor") { return; }

            //아이콘 미지원 항목관리에 해당하는 프로퍼티인경우 EXIT.
            if (oAPP.attr.S_CODE.UW07 && oAPP.attr.S_CODE.UW07.findIndex(a => a.FLD01 === is_attr.UIATK && a.FLD05 !== "X") !== -1) {
                return;
            }

            //라이브러리 DB 정보 확인.
            var _s0023 = oAPP.DATA.LIB.T_0023.find(item => item.UIATK === is_attr.UIATK);

            if (typeof _s0023 === "undefined") {
                return;
            }

            //ENUM 처리건인경우 EXIT.
            if (_s0023.ISLST === "X") {
                return;
            }

            //아이콘 관련 프로퍼티임 flag return.
            return true;

        };  //프로퍼티가 아이콘관련 프로퍼티인지 여부 확인.
    }

    //프로퍼티가 컬러관련 프로퍼티인지 여부 확인. (원본 5214행 1:1)
    if (typeof oAPP.fn.attrIsColorProp !== "function") {
        oAPP.fn.attrIsColorProp = function (is_attr) {

            //PROPERTY가 아닌경우, 바인딩처리된경우 EXIT.
            if (is_attr.UIATY !== "1") { return; }

            var l_UIATT = is_attr.UIATT.toUpperCase();

            //프로퍼티명에 컬러 관련 키워드가 포함안되는경우 exit.
            if (l_UIATT.indexOf("COLOR") === -1) { return; }

            //type이 int, float, boolean유형은 처리 하지 않음.
            if (is_attr.UIADT === "int" || is_attr.UIADT === "float" || is_attr.UIADT === "boolean") { return; }

            //프로퍼티 타입이 width, height 관련 타입인경우 exit.
            if (is_attr.UIADT === "sap.ui.core.CSSSize") { return; }

            //프로퍼티 타입이 아이콘 관련 타입인경우 exit.
            if (is_attr.UIADT === "sap.ui.core.URI") { return; }

            //컬러관련 프로퍼티임 flag return.
            return true;

        };  //프로퍼티가 컬러관련 프로퍼티인지 여부 확인.
    }

    //프로퍼티의 입력필드 f4 help 설정 여부. (원본 5242행 1:1 — S_CODE 미구성 가드만 추가)
    if (typeof oAPP.fn.attrSetShowValueHelp !== "function") {
        oAPP.fn.attrSetShowValueHelp = function (is_attr) {
            //deflaut f4 help 버튼 비활성 처리.
            is_attr.showF4 = false;

            //PROPERTY가 아닌경우, 바인딩처리된경우 EXIT.
            if (is_attr.UIATY !== "1" || is_attr.ISBND === "X") { return; }

            //DDLB 출력 대상 라인인경우 EXIT.
            if (is_attr.ISLST === "X") { return; }

            //DDLB가 설정된 경우 EXIT.
            if (typeof is_attr.T_DDLB !== "undefined" && is_attr.T_DDLB.length !== 0) { return; }

            //프로퍼티가 아이콘관련 프로퍼티인지 여부 확인.
            if (oAPP.fn.attrIsIconProp(is_attr) === true) {
                //f4 help 버튼 활성화.
                is_attr.showF4 = true;
                return;
            }

            //프로퍼티가 컬러관련 프로퍼티인지 여부 확인.
            if (oAPP.fn.attrIsColorProp(is_attr) === true) {
                //f4 help 버튼 활성화.
                is_attr.showF4 = true;
                return;
            }

            //select option3 UI의 F4HelpID, F4HelpReturnFIeld 프로퍼티인경우.
            if (is_attr.UIATK === "EXT00002534" || is_attr.UIATK === "EXT00002535") {
                //f4 help 버튼 활성화.
                is_attr.showF4 = true;
                return;
            }

            //ROOT의 ATTRIBUTE 변경시 VALUE HELP 처리 대상건 여부 로직.
            //[HTML5 가드] S_CODE.UA003 미구성(LIB 미로딩)시 skip.
            if (oAPP.attr.S_CODE && Array.isArray(oAPP.attr.S_CODE.UA003) &&
                oAPP.attr.S_CODE.UA003.findIndex(item => item.ITMCD === is_attr.UIATK && item.FLD04 === "X") !== -1) {
                //f4 help 버튼 활성화.
                is_attr.showF4 = true;
                return;
            }

            //styleClass 프로퍼티인경우 valueHelp 아이콘 활성화 처리.
            if (is_attr.UIATT === "styleClass") {
                //f4 help 버튼 활성화.
                is_attr.showF4 = true;
                return;
            }

        };  //프로퍼티의 입력필드 f4 help 설정 여부.
    }

    //attribute의 필수 입력 표현 처리. (원본 9483행 1:1 — S_CODE 미구성 가드만 추가)
    if (typeof oAPP.fn.attrSetRequireIcon !== "function") {
        oAPP.fn.attrSetRequireIcon = function (is_attr) {

            //[HTML5 가드] S_CODE 미구성(LIB 미로딩)시 skip.
            if (!oAPP.attr.S_CODE) { return; }

            //필수 입력 대상 attr 여부 확인.
            if (Array.isArray(oAPP.attr.S_CODE.UA035) &&
                oAPP.attr.S_CODE.UA035.findIndex(a => a.FLD04 === is_attr.UIATK && a.FLD05 === "X") !== -1) {
                //필수 입력 아이콘 활성화.
                is_attr.icon0_visb = true;
                is_attr.icon0_src = C_ATTR_REQ_ICON;
                is_attr.icon0_color = C_ATTR_REQ_ICON_COLOR;
                return;
            }


            //필수 입력 대상 이벤트 여부 확인.
            if (Array.isArray(oAPP.attr.S_CODE.UA038) &&
                oAPP.attr.S_CODE.UA038.findIndex(a => a.FLD04 === is_attr.UIATK && a.FLD05 === "X") !== -1) {
                //필수 입력 아이콘 활성화.
                is_attr.icon0_visb = true;
                is_attr.icon0_src = C_ATTR_REQ_ICON;
                is_attr.icon0_color = C_ATTR_REQ_ICON_COLOR;
                return;
            }

        };  //attribute의 필수 입력 표현 처리.
    }

    //attr 라인에 따른 style 처리. (원본 6580행 1:1 — WSUTIL 툴팁만 try/catch)
    if (typeof oAPP.fn.attrSetLineStyle !== "function") {
        oAPP.fn.attrSetLineStyle = function (is_attr) {

            //DOCUMENT의 ATTRIBUTE는 ICON 설정 불필요에 의해 EXIT 처리.
            if (is_attr.OBJID === "ROOT") { return; }

            //UI 타입에 따른 로직 분기.
            switch (is_attr.UIATY) {
                case "1": //프로퍼티
                    //바인딩 아이콘 처리

                    is_attr.icon1_src = "sap-icon://fallback";
                    is_attr.icon1_color = C_ATTR_BIND_ICON_COLOR;  //바인딩(서버이벤트) 색상 필드

                    //help 아이콘 처리.
                    is_attr.icon2_src = "sap-icon://sys-help";
                    is_attr.icon2_color = "#40baf3";  //help(클라이언트이벤트) 색상.

                    //프로퍼티 아이콘 처리.
                    is_attr.UIATT_ICON = "sap-icon://customize";

                    //프로퍼티에 바인딩 처리된건이 존재하는경우.
                    if (is_attr.UIATV !== "" && is_attr.ISBND === "X") {
                        is_attr.icon1_color = "yellow";  //바인딩(서버이벤트) 색상 필드
                    }

                    //appcontainer의 AppID 프로퍼티인경우.
                    if (is_attr.UIATK === "EXT00000030") {

                        //상세보기 아이콘 처리.
                        is_attr.icon1_src = "sap-icon://inspection";
                        is_attr.icon2_src = "sap-icon://delete";
                        return;

                    }

                    //appcontainer의 description 프로퍼티 icon 비활성 처리.
                    if (is_attr.UIATK === "EXT00000031") { //AppDescript

                        //상세보기 아이콘 처리.
                        is_attr.icon1_src = undefined;
                        is_attr.icon2_src = undefined;
                        is_attr.icon1_visb = false;
                        is_attr.icon2_visb = false;
                        return;

                    }

                    //3.5.6-16 버전 패치가 적용된 서버가 아닌경우.
                    if (oAPP.common.checkWLOList("C", "UHAK901253") !== true) {

                        //기존 로직의 width, height 프로퍼티 바인딩 불가 처리.
                        if (is_attr.UIATK === "EXT00000032" || is_attr.UIATK === "EXT00000033") {
                            //상세보기 아이콘 처리.
                            is_attr.icon1_src = undefined;
                            is_attr.icon2_src = undefined;
                            is_attr.icon1_visb = false;
                            is_attr.icon2_visb = false;
                            return;
                        }

                    }

                    //selectOption2의 F4HelpID, F4HelpReturnFIeld 프로퍼티인경우.
                    if (is_attr.UIATK === "EXT00001188" ||   //F4HelpID
                        is_attr.UIATK === "EXT00001189") {    //F4HelpReturnFIeld

                        //상세보기 아이콘 처리.
                        is_attr.icon1_src = "sap-icon://inspection";
                        is_attr.icon2_src = "sap-icon://delete";

                        //f4 help 제거 아이콘 색상.
                        is_attr.icon2_color = C_ATTR_SEL_OPT_F4_ICON_COLOR;

                        return;
                    }


                    //selectOption3의 F4HelpID, F4HelpReturnFIeld 프로퍼티인경우.
                    if (is_attr.UIATK === "EXT00002534" ||   //F4HelpID
                        is_attr.UIATK === "EXT00002535") {    //F4HelpReturnFIeld

                        //상세보기 아이콘 처리.
                        is_attr.icon2_src = "sap-icon://delete";

                        //valueHelpOnly 프로퍼티 true 처리.
                        is_attr.F4Only = true;

                        //f4 help 버튼 활성화.
                        is_attr.showF4 = true;

                        //f4 help 제거 아이콘 색상.
                        is_attr.icon2_color = C_ATTR_SEL_OPT_F4_ICON_COLOR;

                        return;
                    }


                    //TABLE의 autoGrowing 프로퍼티인경우.
                    if (is_attr.UIATK === "EXT00001347" ||   //sap.ui.table.Table autoGrowing
                        is_attr.UIATK === "EXT00001348" ||   //sap.m.Table autoGrowing
                        is_attr.UIATK === "EXT00001349") {    //sap.m.List autoGrowing

                        //상세보기 아이콘 처리.
                        is_attr.icon1_src = undefined;
                        is_attr.icon2_src = undefined;
                        is_attr.icon1_visb = false;
                        is_attr.icon2_visb = false;

                        return;
                    }

                    //useBackToTopButton 프로퍼티인경우.
                    if (is_attr.UIATK === "EXT00002374" ||   //sap.m.Page useBackToTopButton
                        is_attr.UIATK === "EXT00002378" ||   //sap.uxap.ObjectPageLayout useBackToTopButton
                        is_attr.UIATK === "EXT00002379") {    //sap.f.DynamicPage

                        //상세보기 아이콘 처리.
                        is_attr.icon1_src = undefined;
                        is_attr.icon2_src = undefined;
                        is_attr.icon1_visb = false;
                        is_attr.icon2_visb = false;

                        return;
                    }


                    //sap.ui.core.HTML UI의 content 프로퍼티인경우.
                    if (is_attr.UIATK === "AT000011858") {

                        //help 아이콘 -> 상세 아이콘 처리.
                        is_attr.icon2_src = "sap-icon://inspection";

                        //drop 가능 처리.
                        is_attr.dropEnable = true;

                        return;

                    }

                    //아이콘 사용 가능한 프로퍼티인경우. 신규 아이콘 처리 기능을 사용 가능한 경우.
                    if (oAPP.fn.attrIsIconProp(is_attr) && oAPP.common.checkWLOList("C", "UHAK900630")) {

                        is_attr.icon2_src = "sap-icon://favorite";

                        //아이콘 색상 처리.
                        is_attr.icon2_color = C_ATTR_FAV_ICON_COLOR;  //바인딩(서버이벤트) 색상 필드

                        //아이콘 비활성 처리.
                        is_attr.icon2_visb = false;

                        //아이콘 툴팁 구성.
                        //078   Icon favorite list
                        try {
                            is_attr.icon2_ttip = "🌟\n" + parent.WSUTIL.getWsMsgClsTxt(oAPP.oDesign.settings.GLANGU, "ZMSG_WS_COMMON_001", "078");
                        } catch (e) { }

                        //바인딩 처리가 안됐다면.
                        if (is_attr.ISBND === "") {
                            //아이콘 활성 처리.
                            is_attr.icon2_visb = true;
                        }

                    }

                    //drop 가능 처리.
                    is_attr.dropEnable = true;


                    break;

                case "2": //이벤트
                    //서버이벤트 아이콘 처리.
                    is_attr.icon1_src = "sap-icon://developer-settings";
                    is_attr.icon1_color = "#c9e088";  //바인딩(서버이벤트) 색상 필드


                    //서버 이벤트가 존재하는경우.
                    if (is_attr.UIATV !== "") {
                        is_attr.icon1_color = "blue";  //바인딩(서버이벤트) 색상 필드
                    }

                    //클라이언트이벤트 아이콘 처리.
                    is_attr.icon2_src = "sap-icon://syntax";
                    is_attr.icon2_color = "#acaba7";  //바인딩(클라이언트 이벤트) 색상 필드

                    //클라이언트 이벤트 검색.
                    var l_indx = oAPP.DATA.APPDATA.T_CEVT.findIndex(a => a.OBJID === is_attr.OBJID + is_attr.UIASN && a.OBJTY === "JS");

                    //클라이언트 이벤트가 존재하는경우.
                    if (l_indx !== -1) {
                        is_attr.icon2_color = "red";  //바인딩(클라이언트 이벤트) 색상 필드
                    }

                    //이벤트 아이콘 처리.
                    is_attr.UIATT_ICON = "sap-icon://border";

                    //이벤트에 WAIT OFF 기능을 사용한 경우.
                    if (is_attr.ISWIT === "X") {
                        //WAIT OFF 사용건 아이콘 처리.
                        is_attr.UIATT_ICON = "sap-icon://complete";

                    }

                    break;

                case "3": //Aggregation
                    //N개의 UI가 추가되는 Aggregation인경우
                    if (is_attr.ISMLB === "X") {
                        //바인딩 아이콘 처리
                        is_attr.icon1_src = "sap-icon://fallback";
                        is_attr.icon1_color = C_ATTR_BIND_ICON_COLOR;  //바인딩(서버이벤트) 색상 필드
                    }

                    //help 아이콘 처리.
                    is_attr.icon2_src = "sap-icon://warning2";

                    //직접 입력 가능한 Aggregation이 아닌경우 ICON 처리.
                    if (is_attr.ISSTR !== "X") {
                        is_attr.UIATT_ICON = "sap-icon://color-fill";
                    }

                    //Aggregation cardinality 0:N건인경우.
                    if (is_attr.ISMLB === "X") {
                        //N건 아이콘 처리.
                        is_attr.UIATT_ICON = "sap-icon://dimension";
                    }

                    //AGGREGATION에 바인딩 처리된건이 존재하는경우.
                    if (is_attr.UIATV !== "") {
                        is_attr.icon1_color = "green";  //바인딩(서버이벤트) 색상 필드
                    }

                    //drop 가능 처리.
                    is_attr.dropEnable = true;

                    break;

                default:
                    break;

            } //UI 타입에 따른 로직 분기.


            //UI Attribute 입력필드 표현 내용 설정건에 해당되는지 확인. (공통코드 UW11)
            const _sUW11 = oAPP.attr.S_CODE?.UW11?.find?.(item => item.FLD01 === is_attr.UIATK);
            if (_sUW11) {

                //attribute 표현 UI default 비활성처리 필드.
                is_attr.inp_visb = false; //input invisible
                is_attr.chk_visb = false; //checkbox invisible
                is_attr.btn_visb = false; //버튼 invisible
                is_attr.sel_visb = false; //DDLB invisible

                switch (_sUW11.FLD04) {
                    case "01":  //INPUT
                        is_attr.inp_visb = true;
                        break;

                    case "02":  //CHECKBOX
                        is_attr.chk_visb = true;
                        break;

                    case "03":  //BUTTON
                        is_attr.btn_visb = true;
                        break;

                    case "04":  //DDLB
                        is_attr.sel_visb = true;
                        break;

                    default:
                        break;
                }

                //f4 help 사용여부(input일때)
                is_attr.showF4 = _sUW11.FLD05 === "X" ? true : false;

                //버튼 text
                is_attr.btn_text = _sUW11.FLD06;

                //버튼 type
                is_attr.btn_type = _sUW11.FLD07 !== "" ? _sUW11.FLD07 : undefined;

                //버튼 icon
                is_attr.btn_icon = _sUW11.FLD08 !== "" ? _sUW11.FLD08 : undefined;

            }


            //UI Attribute 아이콘 표현 내용 설정건에 해당되는지 확인. (공통코드 UW12)
            const _sUW12 = oAPP.attr.S_CODE?.UW12?.find?.(item => item.FLD01 === is_attr.UIATK);

            if (_sUW12) {

                //바인딩(서버이벤트) 아이콘 사용여부에 따른 활성화 처리.
                is_attr.icon1_visb = _sUW12.FLD04 === "X" ? true : false;

                //바인딩(서버이벤트) 아이콘 설정값.
                is_attr.icon1_src = _sUW12.FLD05 !== "" ? _sUW12.FLD05 : undefined;

                //바인딩(서버이벤트) 아이콘 색상.
                is_attr.icon1_color = _sUW12.FLD06 !== "" ? _sUW12.FLD06 : undefined;

                //클라이언트이벤트(기타) 아이콘 사용여부에 따른 활성화 처리.
                is_attr.icon2_visb = _sUW12.FLD07 === "X" ? true : false;

                //클라이언트이벤트(기타) 아이콘 설정값.
                is_attr.icon2_src = _sUW12.FLD08 !== "" ? _sUW12.FLD08 : undefined;

                //클라이언트이벤트(기타) 아이콘 색상.
                is_attr.icon2_color = _sUW12.FLD09 !== "" ? _sUW12.FLD09 : undefined;

            }


        };  //attr 라인에 따른 style 처리.
    }

    //attribute 예외처리 — icon 처리. (원본 uiAttributeArea.js 7851행 1:1)
    //   ★ 맨 첫 줄에서 icon2_visb=false 로 help(클라이언트이벤트) 아이콘을 기본
    //   비활성화하고, 특정 속성(AppID/F4Help/이벤트/아이콘속성 등)에서만 다시 켠다.
    //   이 함수를 이식하지 않으면 모든 프로퍼티 행에 help "i" 아이콘이 떠버린다.
    //   (T_CEVT/WSUTIL 툴팁만 미로딩 대비 가드 추가, 나머지는 원본 1:1)
    if (typeof oAPP.fn.setExcepAttr !== "function") {
        oAPP.fn.setExcepAttr = function (is_attr, is_0023) {

            //default help(client event) 아이콘 비활성 처리.
            is_attr.icon2_visb = false;

            //appcontainer의 AppID 프로퍼티인경우.
            if (is_attr.UIATK === "EXT00000030") {

                //상세보기 아이콘 처리.
                is_attr.icon1_src = "sap-icon://inspection";
                is_attr.icon2_src = "sap-icon://delete";

                //아이콘 활성 처리.
                is_attr.icon2_visb = true;

                return;
            }

            //appcontainer의 description 프로퍼티 icon 비활성 처리.
            if (is_attr.UIATK === "EXT00000031") {  //AppDescript

                //상세보기 아이콘 처리.
                is_attr.icon1_src = undefined;
                is_attr.icon2_src = undefined;
                is_attr.icon1_visb = false;
                is_attr.icon2_visb = false;
                return;

            }

            //3.5.6-16 버전 패치가 적용된 서버가 아닌경우.
            if (oAPP.common.checkWLOList("C", "UHAK901253") !== true) {

                //기존 로직의 width, height 프로퍼티 바인딩 불가 처리.
                if (is_attr.UIATK === "EXT00000032" || is_attr.UIATK === "EXT00000033") {
                    //상세보기 아이콘 처리.
                    is_attr.icon1_src = undefined;
                    is_attr.icon2_src = undefined;
                    is_attr.icon1_visb = false;
                    is_attr.icon2_visb = false;
                    return;
                }

            }

            //selectOption2의 F4HelpID, F4HelpReturnFIeld 프로퍼티인경우.
            if (is_attr.UIATK === "EXT00001188" ||   //F4HelpID
                is_attr.UIATK === "EXT00001189") {    //F4HelpReturnFIeld

                //상세보기 아이콘 처리.
                is_attr.icon1_src = "sap-icon://inspection";
                is_attr.icon2_src = "sap-icon://delete";

                //아이콘 활성 처리.
                is_attr.icon2_visb = true;

                //f4 help 제거 아이콘 색상.
                is_attr.icon2_color = C_ATTR_SEL_OPT_F4_ICON_COLOR;

                return;
            }

            //selectOption3의 F4HelpID, F4HelpReturnFIeld 프로퍼티인경우.
            if (is_attr.UIATK === "EXT00002534" ||   //F4HelpID
                is_attr.UIATK === "EXT00002535") {    //F4HelpReturnFIeld

                //상세보기 아이콘 처리.
                is_attr.icon2_src = "sap-icon://delete";

                //아이콘 활성 처리.
                is_attr.icon2_visb = true;

                //valueHelpOnly 바인딩 필드 true 처리.
                is_attr.F4Only = true;

                //f4 help 제거 아이콘 색상.
                is_attr.icon2_color = C_ATTR_SEL_OPT_F4_ICON_COLOR;

                return;
            }

            //TABLE의 autoGrowing 프로퍼티인경우.
            if (is_attr.UIATK === "EXT00001347" ||   //sap.ui.table.Table autoGrowing
                is_attr.UIATK === "EXT00001348" ||   //sap.m.Table autoGrowing
                is_attr.UIATK === "EXT00001349") {    //sap.m.List autoGrowing

                //상세보기 아이콘 처리.
                is_attr.icon1_src = undefined;
                is_attr.icon2_src = undefined;
                is_attr.icon1_visb = false;
                is_attr.icon2_visb = false;
                return;
            }

            //useBackToTopButton 프로퍼티인경우.
            if (is_attr.UIATK === "EXT00002374" ||   //sap.m.Page useBackToTopButton
                is_attr.UIATK === "EXT00002378" ||   //sap.uxap.ObjectPageLayout useBackToTopButton
                is_attr.UIATK === "EXT00002379") {    //sap.f.DynamicPage

                //상세보기 아이콘 처리.
                is_attr.icon1_src = undefined;
                is_attr.icon2_src = undefined;
                is_attr.icon1_visb = false;
                is_attr.icon2_visb = false;
                return;
            }

            //sap.ui.core.HTML UI의 content 프로퍼티인경우.
            if (is_attr.UIATK === "AT000011858") {

                //help 아이콘 -> 상세 아이콘 처리.
                is_attr.icon2_src = "sap-icon://inspection";

                //아이콘 활성 처리.
                is_attr.icon2_visb = true;

                return;
            }

            //아이콘 사용 가능한 프로퍼티인경우. 신규 아이콘 기능을 사용 가능한 경우.
            if (oAPP.fn.attrIsIconProp(is_attr) && is_attr.ISBND === "" &&
                oAPP.common.checkWLOList("C", "UHAK900630")) {

                is_attr.icon2_src = "sap-icon://favorite";

                //아이콘 색상 처리.
                is_attr.icon2_color = C_ATTR_FAV_ICON_COLOR;

                //아이콘 활성 처리.
                is_attr.icon2_visb = true;

                //아이콘 툴팁 구성. (078 Icon favorite list)
                try {
                    is_attr.icon2_ttip = "🌟\n" + parent.WSUTIL.getWsMsgClsTxt(oAPP.oDesign.settings.GLANGU, "ZMSG_WS_COMMON_001", "078");
                } catch (e) { }

            }

            //bind 처리된건인경우.
            if (is_attr.ISBND === "X") {

                //바인딩 아이콘 처리
                is_attr.icon1_src = "sap-icon://complete";
                is_attr.icon1_color = "#66ff66";  //바인딩(서버이벤트) 색상 필드

                return;

            }

            //이벤트건인경우.
            if (is_attr.UIATY === "2") {

                //아이콘 활성 처리.
                is_attr.icon2_visb = true;

                //이벤트가 설정되어있다면 아이콘 색상 처리.
                if (is_attr.UIATV !== "") {
                    is_attr.icon1_color = "#66ff66";  //바인딩(서버이벤트) 색상 필드
                }

                //클라이언트 이벤트 존재여부 확인. ([HTML5] APPDATA/T_CEVT 미로딩 가드)
                var l_find = (oAPP.DATA.APPDATA && Array.isArray(oAPP.DATA.APPDATA.T_CEVT))
                    ? oAPP.DATA.APPDATA.T_CEVT.find(a => a.OBJID === is_attr.OBJID + is_attr.UIASN)
                    : undefined;

                if (typeof l_find !== "undefined") {

                    //클라이언트 이벤트 아이콘, 색상 처리.
                    is_attr.icon2_src = "sap-icon://syntax";
                    is_attr.icon2_color = "#66ff66";  //바인딩(서버이벤트) 색상 필드

                }

            }

        };  // attribute 예외처리
    }

    //sap.m.UploadCollection, sap.ui.unified.FileUploader UI의 uploadUrl 프로퍼티 예외처리. (원본 6949행 1:1)
    if (typeof oAPP.fn.attrUploadUrlException !== "function") {
        oAPP.fn.attrUploadUrlException = function (OBJID, UIOBK) {

            if (UIOBK !== "UO01180" && UIOBK !== "UO00469") { return; }

            var l_UIATK = "";
            switch (UIOBK) {
                case "UO00469": //sap.m.UploadCollection
                    l_UIATK = "AT000006316";
                    break;

                case "UO01180": //sap.ui.unified.FileUploader
                    l_UIATK = "AT000013501";
                    break;

                default:
                    return;

            }

            //uploadUrl 프로퍼티 수집건 존재여부 확인.
            //([HTML5] prev 미구성(미리보기 로드 전/중)에도 안전하도록 _ensurePrev 경유)
            var l_prev = _ensurePrev(OBJID);
            var ls_0015 = l_prev._T_0015.find(a => a.UIATK === l_UIATK);

            //수집건이 존재하는경우.
            if (ls_0015) {
                //바인딩 처리된경우 EXIT.
                if (ls_0015.UIATV !== "" && ls_0015.ISBND === "X") {
                    return;
                }

                //수집건은 존재하나 값이 존재하지 않는경우.
                if (ls_0015.UIATV === "") {
                    ls_0015.UIAT = "/zu4a_srs/" + oAPP.attr.appInfo.APPID.toLocaleLowerCase();
                    return;
                }

                //uploadUrl 프로퍼티의 값이 U4A에서 기본 세팅한 값이 아닌경우 EXIT.
                if (ls_0015.UIATV.indexOf("/zu4a_srs/") === -1) {
                    return;
                }

                // '/zu4a_srs/' + appliciaton id 조합 에서 /zu4a_srs/ 부분을 제외
                var l_appid = ls_0015.UIATV.replace(/\/zu4a_srs\//i, "").toUpperCase();

                //기존의 프로퍼티에 등록한 application id와 현재 application id가 다른경우.
                if (l_appid !== oAPP.attr.appInfo.APPID) {
                    //현재 application id로 매핑 처리.
                    ls_0015.UIAT = "/zu4a_srs/" + oAPP.attr.appInfo.APPID.toLocaleLowerCase();
                }

                return;
            }

            //uploadUrl property 정보 검색.
            var ls_0023 = oAPP.DATA.LIB.T_0023.find(a => a.UIATK === l_UIATK);

            ls_0015 = oAPP.fn.crtStru0015();

            oAPP.fn.moveCorresponding(ls_0023, ls_0015);

            var ls_0022 = oAPP.DATA.LIB.T_0022.find(a => a.UIOBK === UIOBK);

            ls_0015.APPID = oAPP.attr.appInfo.APPID;
            ls_0015.GUINR = oAPP.attr.appInfo.GUINR;
            ls_0015.OBJID = OBJID;
            ls_0015.UILIK = ls_0022.UILIK;
            ls_0015.UIATV = "/zu4a_srs/" + oAPP.attr.appInfo.APPID.toLocaleLowerCase();


            //uploadUrl 프로퍼티 수집 처리.
            l_prev._T_0015.push(ls_0015);


        };  //sap.m.UploadCollection, sap.ui.unified.FileUploader UI의 uploadUrl 프로퍼티 예외처리.
    }

    //Description 세팅. (원본 7726행 1:1)
    if (typeof oAPP.fn.setDesc !== "function") {
        oAPP.fn.setDesc = function (OBJID, desc) {

            var l_desc = oAPP.DATA.APPDATA.T_DESC.find(a => a.OBJID === OBJID);

            //존재하지 않는경우.
            if (typeof l_desc === "undefined") {
                //해당 OBJID에 따른 DESCRIPTION 생성 처리.
                l_desc = {};
                l_desc.OBJID = OBJID;
                oAPP.DATA.APPDATA.T_DESC.push(l_desc);

            }

            //DESCRIPTION 초기화.
            l_desc.DESCPT = [];


            //입력 DESCRIPTION의 글자수가 255자 이하인경우.
            if (desc.length <= 255) {
                //입력 DESCRIPTION 매핑 후 exit.
                l_desc.DESCPT = [{ LINE: desc }];
                return;
            }

            //255자가 넘는경우.
            var l_txt = desc,
                ls_stru = {};

            //255자리씩 끊으며 DESCPT에 수집 처리.
            while (l_txt !== "") {
                ls_stru.LINE = l_txt.substr(0, 255);
                l_desc.DESCPT.push(ls_stru);
                ls_stru = {};

                l_txt = l_txt.substr(255);

                if (l_txt === "") {
                    return;
                }

            }

        }; //Description 세팅.
    }

    //Description 검색. (원본 7792행 1:1)
    if (typeof oAPP.fn.getDesc !== "function") {
        oAPP.fn.getDesc = function (OBJID) {

            var l_desc = oAPP.DATA.APPDATA.T_DESC.find(a => a.OBJID === OBJID);

            if (typeof l_desc === "undefined") {
                return "";
            }

            var l_txt = "";

            for (var i = 0, l = l_desc.DESCPT.length; i < l; i++) {
                l_txt += l_desc.DESCPT[i].LINE;
            }

            return l_txt;

        }; //Description 검색.
    }

    //OTR 입력건인경우 ALIAS 대문자 변환 처리. (원본 5507행 1:1)
    if (typeof oAPP.fn.attrSetOTRAlias !== "function") {
        oAPP.fn.attrSetOTRAlias = function (is_attr) {

            //프로퍼티가 아닌경우 EXIT.
            if (is_attr.UIATY !== "1") { return; }

            //바인딩 처리된경우 EXIT.
            if (is_attr.ISBND === "X") { return; }

            //프로퍼티 입력값이 존재하지 않는경우 EXIT.
            if (is_attr.UIATV === "") { return; }

            //$OTR: 키워드로 시작하지 않는경우 EXIT.
            if (is_attr.UIATV.substr(0, 5) !== "$OTR:") { return; }

            //OTR 입력값 대문자 변환 처리.
            is_attr.UIATV = is_attr.UIATV.toUpperCase();


        };  //OTR 입력건인경우 ALIAS 대문자 변환 처리.
    }

    //입력값이 프로퍼티 유형에 맞는지 점검. (원본 5530행)
    //[HTML5 가드] 원본은 미리보기 frame 의 sap.ui.base.DataType(UI5)로 최종 검증한다.
    //  W2(미리보기) 미변환 상태에서는 frame 이 없으므로, frame 존재 시에만 원본과
    //  동일하게 검증하고, 없으면 undefined(판단 불가 → 입력 유지) 를 return 한다.
    if (typeof oAPP.fn.chkValidProp !== "function") {
        oAPP.fn.chkValidProp = function (is_attr) {

            //프로퍼티가 아닌경우, 바인딩 처리건인경우 EXIT.
            if (is_attr.UIATY !== "1" || is_attr.ISBND === "X") { return; }

            var l_val = is_attr.UIATV;

            var l_uiadt = is_attr.UIADT;

            //N건 입력이 가능한 프로퍼티 인경우.
            if (is_attr.ISMLB === "X") {
                //프로퍼티 TYPE에 []이 없다면 추가.
                if (l_uiadt.indexOf("[]") === -1) {
                    l_uiadt += "[]";
                }
            }


            switch (l_uiadt.toUpperCase()) {
                case "BOOLEAN":

                    //입력값이 true인경우.
                    if (is_attr.UIATV === "true") {
                        l_val = true;

                        //입력값이 false 이거나 값이 입력되지 않은경우.
                    } else if (is_attr.UIATV === "false" || is_attr.UIATV === "") {
                        l_val = false;

                    }

                    break;

                case "INT":
                    //int로 변환처리.
                    l_val = Number(is_attr.UIATV);

                    if (isNaN(l_val)) {
                        return false;
                    }
                    break;

                case "FLOAT":
                    //float로 변환 처리.
                    l_val = Number(is_attr.UIATV);

                    if (isNaN(l_val)) {
                        return false;
                    }

                    break;

            }

            //[HTML5 가드 — W2 예정] 미리보기 frame(sap.ui.base.DataType) 미존재시
            //원본의 최종 타입 검증(registEnumType/DataType.isValid/UA032 예외 function)은
            //수행 불가 → 판단 보류(undefined). frame 이 생기면 원본 로직 그대로 수행.
            var _oFrameWin = oAPP.attr.ui && oAPP.attr.ui.frame && oAPP.attr.ui.frame.contentWindow;
            if (!_oFrameWin || !_oFrameWin.sap) {
                return;
            }

            //미리보기의 UI TYPE을 ENUM 정보에 등록 처리. (원본 5590행)
            if (typeof _oFrameWin.registEnumType === "function") {
                _oFrameWin.registEnumType(l_uiadt);
            }

            var l_type = _oFrameWin.sap.ui.base.DataType.getType(l_uiadt);
            if (!l_type) { return; }

            //프로퍼티 입력값이 예외처리된건인지 확인. (원본 5602행)
            var ls_UA032 = oAPP.attr.S_CODE.UA032.find(a => a.FLD01 === is_attr.UIOBK &&
                a.FLD03 === is_attr.UIATT && a.FLD06 !== "X" && a.FLD07 !== "");

            //예외처리 function이 존재하는경우 예외처리 function 수행.
            if (ls_UA032) {
                l_val = _oFrameWin[ls_UA032.FLD07](l_val);
            }

            //입력값 가능여부 return. true: 가능, false: 불가능.
            return l_type.isValid(l_val);


        };  //입력값이 프로퍼티 유형에 맞는지 점검.
    }

    //property, event, Aggregation 입력값 처리. (원본 5330행 attrChgAttrVal 1:1)
    //  → 값 변경의 "로컬 모델 반영" 핵심. 서버 즉시 반영은 없음(Save 시 getSaveData 가
    //    oAPP.attr.prev[*]._T_0015 를 수집) — 원본과 동일하게 prev._T_0015 에만 수집.
    if (typeof oAPP.fn.attrChgAttrVal !== "function") {
        oAPP.fn.attrChgAttrVal = function (is_attr, uitp) {

            //[HTML5] prev 미구성(미리보기 로드 전/중)에도 안전하도록 _ensurePrev 경유.
            //(미리보기 구성 후에는 실제 UI 인스턴스(prev[OBJID])가 그대로 반환됨 — 원본 1:1)
            var l_prev = _ensurePrev(is_attr.OBJID);

            //ATTRIBUTE 수집처리.
            function lf_add_T_0015() {

                //수집건이 존재하는경우.
                if (l_indx !== -1) {
                    //해당 이벤트 매핑.
                    l_prev._T_0015[l_indx].UIATV = is_attr.UIATV;
                    l_prev._T_0015[l_indx].ISBND = is_attr.ISBND;
                    l_prev._T_0015[l_indx].MPROP = is_attr.MPROP;
                    l_prev._T_0015[l_indx].ADDSC = is_attr.ADDSC;
                    l_prev._T_0015[l_indx].ISWIT = is_attr.ISWIT;
                    l_prev._T_0015[l_indx].ISSPACE = is_attr.ISSPACE;

                    l_prev._T_0015[l_indx].SHCUT = is_attr.SHCUT;
                    return;
                }

                //수집건이 존재하지 않는경우 신규 라인 생성 처리.
                var ls_0015 = oAPP.fn.crtStru0015();

                //attr의 입력값 매핑.
                oAPP.fn.moveCorresponding(is_attr, ls_0015);

                //이벤트 입력건 수집 처리.
                ls_0015.APPID = oAPP.attr.appInfo.APPID;
                ls_0015.GUINR = oAPP.attr.appInfo.GUINR;

                var ls_0022 = oAPP.DATA.LIB.T_0022.find(a => a.UIOBK === is_attr.UIOBK);

                if (ls_0022) {
                    ls_0015.UILIK = ls_0022.UILIK;
                }

                l_prev._T_0015.push(ls_0015);

            } //ATTRIBUTE 수집처리.



            //COMBO BOX에 입력한 값이 존재하는경우, COMBO BOX의 선택건이 없다면.
            if (is_attr.comboval !== "" && is_attr.UIATV === "") {
                //COMBO BOX에 입력값 초기화.
                is_attr.comboval = "";
            }

            //기존 수집건 존재 여부 확인.
            var l_indx = l_prev._T_0015.findIndex(a => a.OBJID === is_attr.OBJID &&
                a.UIATT === is_attr.UIATT && a.UIATY === is_attr.UIATY);


            //이벤트인경우 값이 입력됐다면.
            if (is_attr.UIATY === "2" && is_attr.UIATV !== "") {
                //입력값 수집 처리.
                lf_add_T_0015();
                return;

            }

            //AGGREGATION인경우 값이 입력됐다면.
            if (is_attr.UIATY === "3" && is_attr.UIATV !== "") {
                //입력값 수집 처리.
                lf_add_T_0015();
                return;

            }


            //이벤트에 라인의 입력값이 존재하지 않는경우.
            if (is_attr.UIATY === "2" && is_attr.UIATV === "") {

                //클라이언트 이벤트 검색.
                var l_cevt = oAPP.DATA.APPDATA.T_CEVT.find(a => a.OBJID === is_attr.OBJID + is_attr.UIASN && a.OBJTY === "JS");

                //클라이언트 이벤트가 존재하는경우 이벤트 수집처리.
                if (l_cevt) {
                    //서버이벤트 공백처리만 함.
                    lf_add_T_0015();
                    return;
                }

                //수집건이 존재하지 않는경우 exit.
                if (l_indx === -1) { return; }

                //수집건존재, 서버이벤트, 클라이언트 이벤트가 없는경우 해당 라인 삭제 처리.
                l_prev._T_0015.splice(l_indx, 1);

                //단축키 등록 정보 초기화.
                is_attr.SHCUT = "";
                return;

            }


            //AGGREGATION인경우 입력값이 존재하지 않는경우 수집건 존재시.
            if (is_attr.UIATY === "3" && is_attr.UIATV === "" && l_indx !== -1) {
                //수집된 라인 삭제 처리.
                l_prev._T_0015.splice(l_indx, 1);
                return;
            }


            //checkbox에서 발생한 이벤트인경우.
            if (uitp === "CHECK") {
                //checkbox를 선택한경우 abap_true로, 선택하지 않은경우 abap_false 처리.
                is_attr.UIATV = is_attr.UIATV_c === true ? "X" : "";
            }


            var ls_0023 = undefined, l_dval = "", l_ISLST = "";

            //ROOT가 아닌경우, 직접 입력가능한 aggregation이 아닌경우 default 값 얻기.
            if (is_attr.OBJID !== "ROOT" && is_attr.UIATK.indexOf("_1") === -1) {
                ls_0023 = oAPP.DATA.LIB.T_0023.find(a => a.UIATK === is_attr.UIATK);

            }

            if (typeof ls_0023 !== "undefined") {
                l_dval = ls_0023.DEFVL;
                l_ISLST = ls_0023.ISLST;
            }


            //프로퍼티 입력건 정합성 점검.
            if (oAPP.fn.chkValidProp(is_attr) === false) {

                //DDLB로 표현되는건이 아닌경우.
                if (l_ISLST !== "X") {
                    //입력 불가능한 값인경우 default 값으로 변경 처리.
                    is_attr.UIATV = l_dval;
                }

            }

            //default 값과 동일한 경우 수집항목이 존재하지 않는경우 exit.
            if (l_dval === is_attr.UIATV && l_indx === -1) {
                return;
            }

            //default 값과 동일한 경우 수집항목이 존재하는경우 해당 라인 제거 후 exit.
            if (l_dval === is_attr.UIATV && l_indx !== -1) {
                var l_indx = l_prev._T_0015.splice(l_indx, 1);
                return;
            }

            //프로퍼티 type이 숫자 유형인경우.
            if (is_attr.UIATY === "1" && is_attr.ISBND === "" && is_attr.ISMLB === "" &&
                (is_attr.UIADT === "int" || is_attr.UIADT === "float")) {
                //입력값 숫자 유형으로 변경 처리.
                is_attr.UIATV = String(Number(is_attr.UIATV));
            }


            is_attr.ISSPACE = "";

            //입력값이 존재하지 않는경우, default 값과 다르다면.
            if (is_attr.UIATV === "" && l_dval !== is_attr.UIATV) {
                //SPACE 입력됨 FLAG 처리.
                is_attr.ISSPACE = "X";
            }


            //OTR 입력건인경우 ALIAS 대문자 변환 처리.
            oAPP.fn.attrSetOTRAlias(is_attr);


            //attr 입력건 수집 처리.
            lf_add_T_0015();


        }; //property, event, Aggregation 입력값 처리.
    }

    /* ********************************************************************
     * ★ (3) LIB 파이프라인 — 원본 main.js getLibData(618행)/setUIAreaEditable
     *        (813~867행) 의 데이터 로직 1:1 이식.
     * ******************************************************************** */

    /************************************************************************
     * 라이브러리 정보 검색 — 원본 oAPP.fn.getLibData(618행) 1:1.
     *   차이점(명시):
     *    · 전 테이블 로드 완료 시 원본은 oAPP.fn.getAppData() 를 직접 호출하나,
     *      HTML5 에선 호출처가 넘긴 fnDone(연속 처리: fnLoadWs20TreeData) 호출.
     *    · 오류 메시지 parent.showMessage(sap, ...) 는 UI5(sap) 의존 → try/catch
     *      가드(헤드리스에서 sap 미존재시 console.warn).
     *    · designAreaLockUnlock(UI5 oCore.lock) → fnSetBusyLock 가드 대체.
     ************************************************************************/
    function _ws20GetLibData(it_lib, is_tab, fnDone, dbtot, dbcnt, fkey, skey) {

        //다른 db 검색 실패 여부 확인.
        var l_err = it_lib.findIndex(a => a.ERROR === "X");

        //다른 db 검색이 실패 했다면 현재 db 검색도 중지 처리.
        if (l_err !== -1) {
            return;
        }

        var oFormData = new FormData();
        oFormData.append("tabnm", is_tab.tabnm);

        //db 총 검색건수 정보가 존재하는경우.
        if (typeof dbtot !== "undefined") {
            oFormData.append("dbtot", dbtot);
        }

        //db 검색한 건수 정보가 존재하는경우.
        if (typeof dbcnt !== "undefined") {
            oFormData.append("dbcnt", dbcnt);
        }

        //다음 검색대상 첫번째 key 정보가 존재하는경우.
        if (typeof fkey !== "undefined") {
            oFormData.append("fkey", fkey);
        }

        //다음 검색대상 두번째 key 정보가 존재하는경우.
        if (typeof skey !== "undefined") {
            oFormData.append("skey", skey);
        }

        //라이브러리가 로드되지 않은경우 라이브러리 정보 로드를 위한 서버 호출.
        //(원본과 동일: bIsBusy="X", async=true, GET)
        sendAjax(oAPP.attr.servNm + "/getLibData", oFormData, function (param) {

            //다른 db 검색 실패 여부 확인.
            var l_err = it_lib.findIndex(a => a.ERROR === "X");

            //다른 db 검색이 실패 했다면 현재 db 검색도 중지 처리.
            if (l_err !== -1) {
                return;
            }

            //DB 검색에 실패한 경우.
            if (!param || param.ERROR === "X") {

                is_tab.ERROR = "X";
                //281	Fail to Library load. (원본: parent.showMessage(sap, 20, "E", ...) — UI5 의존 가드)
                try {
                    parent.showMessage(sap, 20, "E",
                        oAPP.common.fnGetMsgClsText("/U4A/MSG_WS", "281", "", "", "", ""));
                } catch (e) {
                    console.warn("[HTML5][WS20][attr] Fail to Library load:", is_tab.tabnm);
                }
                return;
            }


            //최초 DB 정보 매핑건인경우.
            if (typeof oAPP.DATA.LIB[is_tab.alias] === "undefined") {
                oAPP.DATA.LIB[is_tab.alias] = param.T_DATA;

            } else {
                //추가 DB 정보가 존재하는경우 APPEND처리.
                oAPP.DATA.LIB[is_tab.alias] = oAPP.DATA.LIB[is_tab.alias].concat(param.T_DATA);

            }

            //해당 DB를 검색 완료한 경우.
            if (param.END === "X") {
                //완료됨 FLAG 처리.
                is_tab.END = param.END;
            }

            //db 검색이 완료되지 않은건 검색.
            var l_find = it_lib.findIndex(a => a.END === "");

            //모든 table이 load완료한 경우.
            if (l_find === -1) {

                //라이브러리 정보에 실제 라이브러리명 필드를 추가하여 매핑 처리(sap/m/Input -> sap.m.Input)
                for (var i = 0, l = oAPP.DATA.LIB.T_0022.length; i < l; i++) {
                    oAPP.DATA.LIB.T_0022[i].LIBNM = oAPP.DATA.LIB.T_0022[i].UIOMD.replace(/\//g, ".");
                }

                //코드마스터 정보 코드별로 재구성 처리.
                oAPP.fn.setCodeMasterData();

                //UI 프로퍼티에 대한 Value 필수항목 대상 추가 정의.
                oAPP.fn.setCodeMasterDataUA035();

                //어플리케이션 정보 구성을 위한 서버 호출.
                //(원본: oAPP.fn.getAppData() — HTML5: 연속 처리 콜백 호출)
                if (typeof fnDone === "function") { fnDone(); }
                return;
            }

            //해당 DB의 검색이 완료된경우 하위 로직 SKIP.
            if (param.END === "X") {
                return;
            }

            //다음 라이브러리 table 정보 검색.
            _ws20GetLibData(it_lib, is_tab, fnDone, param.dbtot, param.dbcnt, param.fkey, param.skey);

        }, "X", true, "GET", function (e) {

            //오류 발생시 lock 해제. (원본 designAreaLockUnlock — UI5 oCore 의존 → busy 가드)
            is_tab.ERROR = "X";
            console.warn("[HTML5][WS20][attr] getLibData 서버 호출 실패 — LIB 로드 skip:", is_tab.tabnm);
            try { oAPP.common.fnSetBusyLock(""); } catch (e2) { }

        }); //라이브러리가 로드되지 않은경우 라이브러리 정보 로드를 위한 서버 호출.

    } //라이브러리 정보 검색.

    /************************************************************************
     * [PUBLIC] WS20 LIB 데이터 로드 — 원본 setUIAreaEditable(813~867행) 의
     *   "라이브러리 로드" 부분 1:1. 완료(또는 skip) 시 fnDone 호출.
     *   - 이미 LIB 가 로드된 경우: 원본(814행 jQuery.isEmptyObject 체크)과 동일하게
     *     재로드 없이 즉시 fnDone.
     *   - 서버 미연결/비로그인: 크래시 없이 skip + fnDone (속성은 비어 보임 — 정상).
     ************************************************************************/
    oAPP.fn.fnLoadWs20LibData = function (fnDone) {

        fnDone = (typeof fnDone === "function") ? fnDone : function () { };

        oAPP.DATA = oAPP.DATA || {};

        //라이브러리 정보가 로드된 경우. (원본 814행)
        try {
            if ($ && $.isEmptyObject && oAPP.DATA.LIB && $.isEmptyObject(oAPP.DATA.LIB) !== true) {
                fnDone();
                return;
            }
        } catch (e) {
            if (oAPP.DATA.LIB && Object.keys(oAPP.DATA.LIB).length > 0) {
                fnDone();
                return;
            }
        }

        // 서버 경로 준비 (원본 main.js 18행).
        try {
            if (!oAPP.attr.servNm) {
                oAPP.attr.servNm = parent.getServerPath();
            }
        } catch (e) { }

        // 서버 경로가 없으면(헤드리스/비로그인) LIB 로드 skip — 크래시 금지.
        if (!oAPP.attr.servNm) {
            console.warn("[HTML5][WS20][attr] servNm 없음 — LIB 로드 skip(서버 미로그인). 속성 목록이 비어 보일 수 있음(정상).");
            fnDone();
            return;
        }

        //라이브러리 수집 object 초기화. (원본 837행)
        oAPP.DATA.LIB = {};

        //meta 정보 검색. (원본 840행)
        var l_meta = null;
        try { l_meta = parent.getMetadata(); } catch (e) { }

        //DEFAULT 라이브러리 TABLE 명 구성(ZTU4AXXXX)
        var l_tabPreFix = "ZTU4A";

        //해당 서버의 NAME SPACE가 적용된경우.
        if (l_meta && l_meta.IS_NAME_SPACE === "X") {
            // (/U4A/TXXXX) 형식의 라이브러리 테이블명 구성.
            l_tabPreFix = "/U4A/T";
        }

        //검색 대상 라이브러리 정보 구성. (원본 852~858행과 동일 테이블 목록)
        var lt_lib = [];
        lt_lib.push({ tabnm: l_tabPreFix + "9011", alias: "T_9011", END: "", ERROR: "" });
        lt_lib.push({ tabnm: l_tabPreFix + "0020", alias: "T_0020", END: "", ERROR: "" });
        lt_lib.push({ tabnm: l_tabPreFix + "0022", alias: "T_0022", END: "", ERROR: "" });
        lt_lib.push({ tabnm: l_tabPreFix + "0023", alias: "T_0023", END: "", ERROR: "" });
        lt_lib.push({ tabnm: l_tabPreFix + "0024", alias: "T_0024", END: "", ERROR: "" });
        lt_lib.push({ tabnm: l_tabPreFix + "0027", alias: "T_0027", END: "", ERROR: "" });

        //구성된 라이브러리 정보를 기준으로 검색. (원본 862~866행)
        try {
            for (var i = 0, l = lt_lib.length; i < l; i++) {
                //라이브러리 정보 검색.
                _ws20GetLibData(lt_lib, lt_lib[i], fnDone);

            }
        } catch (e) {
            // sendAjax 자체가 throw(헤드리스 환경 등) → skip + 연속 처리.
            console.warn("[HTML5][WS20][attr] getLibData 호출 실패 — LIB 로드 skip:", e && e.message);
            fnDone();
        }

    }; // end of oAPP.fn.fnLoadWs20LibData

    /* ********************************************************************
     * ★ (4) 선택 → 속성 데이터 구성 (원본 setUIInfo / updateAttrList /
     *        updateDOCAttrList 의 "데이터 로직" 이식)
     * ******************************************************************** */

    /************************************************************************
     * oAPP.attr.prev[OBJID] 스탠드인 구성.
     *   원본은 미리보기(W2)가 UI 인스턴스 생성시 prev[OBJID]._T_0015 를 구성.
     *   W2 미변환 상태에서는 APPDATA.T_0015 의 "동일 행 참조"로 구성한다.
     *   (복사 아님 — Save 시 getSaveData 가 prev 를 순회하는 원본 의미 유지)
     ************************************************************************/
    function _ensurePrev(OBJID) {

        oAPP.attr.prev = oAPP.attr.prev || {};

        if (oAPP.attr.prev[OBJID] && Array.isArray(oAPP.attr.prev[OBJID]._T_0015)) {
            return oAPP.attr.prev[OBJID];
        }

        var aT_0015 = [];
        try {
            if (oAPP.DATA && oAPP.DATA.APPDATA && Array.isArray(oAPP.DATA.APPDATA.T_0015)) {
                //해당 UI의 저장 속성 행(동일 객체 참조) 수집.
                aT_0015 = oAPP.DATA.APPDATA.T_0015.filter(a => a.OBJID === OBJID);
            }
        } catch (e) { }

        //★ [원본 1:1 정합 — 미리보기(W2) 연동 필수]
        //  원본의 oAPP.attr.prev 는 "미리보기 iframe(createUIInstance)" 만 채운다.
        //  미리보기 iframe 의 drawPreview(preview/index.js 1842행)는
        //  prev 가 비어있지 않으면 "재그리기" 분기로 판단하여
        //  APPDATA.T_0015 = getAttrChangedData() 로 T_0015 전체를 prev 수집본으로
        //  "교체"한다. 속성 패널의 스탠드인이 미리보기 1차 로드 전에 prev 에
        //  들어있으면(예: ROOT 자동선택) T_0015 가 해당 OBJID 행만 남도록 파괴되어
        //  모든 자식 UI 의 임베드(UIATY="6")/프로퍼티 행이 소실 → 자식 UI 가
        //  화면에 나타나지 않는다(조용한 실패).
        //  → 스탠드인은 __ws20Standin 마킹(미리보기 로드 직전 purge 대상)하고,
        //    미리보기 로드중(__ws20PrevBooting)에는 prev 에 저장하지 않는다(transient).
        //    (transient 의 _T_0015 행도 APPDATA.T_0015 의 "동일 객체 참조"이므로
        //     기존 행 값 변경은 그대로 반영된다.)
        if (oAPP.attr.__ws20PrevBooting === true) {
            return { _T_0015: aT_0015, __ws20Standin: true };
        }

        oAPP.attr.prev[OBJID] = oAPP.attr.prev[OBJID] || {};
        oAPP.attr.prev[OBJID]._T_0015 = aT_0015;
        oAPP.attr.prev[OBJID].__ws20Standin = true;

        return oAPP.attr.prev[OBJID];

    } // end of _ensurePrev

    /************************************************************************
     * [OVERRIDE] DOCUMENT 영역 ATTRIBUTE 갱신 — 원본 uiAttributeArea.js attrUpdateDocAttr(8318행) 1:1.
     *   액티브/저장 후 서버 SCRIPT(eval) 가 oAPP.fn.attrUpdateDocAttr([{UIATK,UIATV},...]) 로 호출한다
     *   (예: Request/Task DH001025 갱신). WS20 HTML5 빌드는 UI5 파일 uiAttributeArea.js 를 로드하지
     *   않으므로 데이터 함수인 이걸 여기에 포팅한다 — 없으면 SCRIPT eval 에서
     *   "attrUpdateDocAttr is not a function" → onError 크리티컬(액티브 시 실측).
     ************************************************************************/
    if (typeof oAPP.fn.attrUpdateDocAttr !== "function") {
        oAPP.fn.attrUpdateDocAttr = function (it_attr) {

            if (!Array.isArray(it_attr) || it_attr.length === 0) { return; }

            //ROOT 수집본(prev 스탠드인) — 안전 초기화.
            var lt_0015 = _ensurePrev("ROOT")._T_0015 || [];

            //갱신 대상건 기준으로 ROOT 수집 attribute 갱신.
            for (var i = 0, l = it_attr.length; i < l; i++) {

                switch (it_attr[i].UIATK) {
                    case "DH001020": oAPP.attr.appInfo.APPVR = it_attr[i].UIATV; break;   // Web Application Version
                    case "DH001025": oAPP.attr.appInfo.REQNR = it_attr[i].UIATV;          // Request/Task
                                     oAPP.attr.appInfo.REQNO = it_attr[i].UIATV; break;
                    case "DH001140": oAPP.attr.appInfo.AEUSR = it_attr[i].UIATV; break;   // Change User
                    case "DH001150": oAPP.attr.appInfo.AEDAT = it_attr[i].UIATV; break;   // Change Date
                    case "DH001160": oAPP.attr.appInfo.AETIM = it_attr[i].UIATV; break;   // Change Time
                }

                //기존 수집 항목 갱신.
                var ls_attr = lt_0015.find(a => a.UIATK === it_attr[i].UIATK);
                if (ls_attr) { ls_attr.UIATV = it_attr[i].UIATV; continue; }

                //코드마스터(UA003)에서 document attr 정보 얻기.
                var ls_ua003 = (oAPP.DATA && oAPP.DATA.LIB && Array.isArray(oAPP.DATA.LIB.T_9011))
                    ? oAPP.DATA.LIB.T_9011.find(a => a.CATCD === "UA003" && a.ITMCD === it_attr[i].UIATK) : null;
                if (!ls_ua003) { continue; }

                //신규 라인 생성.
                ls_attr = oAPP.fn.crtStru0015();
                ls_attr.APPID = oAPP.attr.appInfo.APPID;
                ls_attr.GUINR = oAPP.attr.appInfo.GUINR;
                ls_attr.OBJID = "ROOT";
                ls_attr.UIATK = it_attr[i].UIATK;
                ls_attr.UIATV = it_attr[i].UIATV;
                ls_attr.UIOBK = "ROOT";
                ls_attr.UIATT = ls_ua003.FLD01;
                ls_attr.UIASN = ls_attr.UIATT.toUpperCase().substr(0, 18);
                ls_attr.UIADT = "string";
                ls_attr.UIATY = "1";
                lt_0015.push(ls_attr);
            }

            //현재 선택 TREE 가 ROOT 가 아니면 표시 갱신 불필요.
            var oData = oAPP.attr.oModel && oAPP.attr.oModel.oData;
            if (!oData || !oData.uiinfo || oData.uiinfo.OBJID !== "ROOT") { return; }
            if (!Array.isArray(oData.T_ATTR)) { return; }

            //ATTRIBUTE 영역 출력값 갱신.
            for (var j = 0, m = it_attr.length; j < m; j++) {
                var ls_disp = oData.T_ATTR.find(a => a.UIATK === it_attr[j].UIATK);
                if (!ls_disp) { continue; }
                ls_disp.UIATV = it_attr[j].UIATV;
            }

            if (oAPP.attr.oModel.refresh) { oAPP.attr.oModel.refresh(); }

        }; // end of [OVERRIDE] oAPP.fn.attrUpdateDocAttr
    }

    /************************************************************************
     * UI Info 영역 정보 구성 — 원본 uiAttributeArea.js setUIInfo(7453행) 1:1.
     ************************************************************************/
    function _setUIInfo(is_tree) {

        var ls_uiinfo = {};

        //UI명.
        ls_uiinfo.OBJID_bf = ls_uiinfo.OBJID = is_tree.OBJID;

        //UI OBJECT KEY.
        ls_uiinfo.UIOBK = is_tree.UIOBK;


        //DOCUMENT, APP인경우 UI명 변경 불가 처리.
        ls_uiinfo.ENAB01 = true;
        if (is_tree.OBJID === "ROOT" || is_tree.OBJID === "APP") {
            ls_uiinfo.edit01 = false;
        }

        //UI에 해당하는 DESCRIPT 정보.
        try {
            ls_uiinfo.DESC = oAPP.fn.getDesc(is_tree.OBJID);
        } catch (e) {
            ls_uiinfo.DESC = "";
        }

        //UI5 library Reference정보 구성.
        ls_uiinfo.UILIB = is_tree.UILIB;

        //SelectOption2 인경우.
        if (is_tree.UIOBK === "UO99992") {
            ls_uiinfo.UILIB = "u4a.m.SelectOption2";
        }

        //SelectOption3 인경우.
        if (is_tree.UIOBK === "UO99984") {
            ls_uiinfo.UILIB = "u4a.m.SelectOption3";
        }

        //UI 대문자.
        ls_uiinfo.UIFND = is_tree.UIFND;

        ls_uiinfo.vis01 = false;  //UI Library & sample 비활성.

        ls_uiinfo.vis02 = false;  //attribute 초기화 비활성.

        ls_uiinfo.src = is_tree.UICON;  //아이콘 바인딩 필드.

        //DOCUMENT가 아닌경우(UI인경우)만 UI정보 검색.
        if (is_tree.OBJID !== "ROOT") {
            //UI Library & sample 활성.
            ls_uiinfo.vis01 = true;

            //attribute 초기화 활성.
            ls_uiinfo.vis02 = true;

        }

        //display상태인경우.
        if (oAPP.attr.oModel.oData.IS_EDIT === false) {
            //attribute 초기화 비활성.
            ls_uiinfo.vis02 = false;

        }

        oAPP.attr.oModel.oData.uiinfo = ls_uiinfo;

    } // end of _setUIInfo

    /************************************************************************
     * DOCUMENT(ROOT)에 대한 ATTR 정보 구성 — 원본 updateDOCAttrList(6308행)의
     *   데이터 로직 1:1 (UI5 부속: setAfterRendering/refresh/Sorter 제외).
     ************************************************************************/
    function _updateDOCAttrList(OBJID) {

        //코드마스터 기준 DDLB 정보 구성. (원본 lf_DDLB 1:1)
        function lf_DDLB(CATCD, USEFLD, KEY, TEXT) {

            //코드마스터 기준 DDLB 값 검색. (LIB 미로드 방어 — 없으면 빈 목록)
            var lt_9011 = (oAPP.DATA.LIB && Array.isArray(oAPP.DATA.LIB.T_9011)) ? oAPP.DATA.LIB.T_9011 : [];
            if (typeof USEFLD === "undefined") {
                var lt_ITM = lt_9011.filter(a => a.CATCD === CATCD);

            } else {
                var lt_ITM = lt_9011.filter(a => a.CATCD === CATCD && a[USEFLD] === "X");
            }

            var lt_ddlb = [],
                ls_ddlb = {};

            //코드마스터 항목 기준으로 ddlb 항목 구성.
            for (var i = 0, l = lt_ITM.length; i < l; i++) {

                ls_ddlb.KEY = lt_ITM[i][KEY];
                ls_ddlb.TEXT = lt_ITM[i][TEXT];
                lt_ddlb.push(ls_ddlb);
                ls_ddlb = {};

            }

            return lt_ddlb;

        } //코드마스터 기준 DDLB 정보 구성.



        //공통코드의 DOCUMENT 구성 정보 검색.
        var lt_ua003 = oAPP.DATA.LIB.T_9011.filter(a => a.CATCD === "UA003");

        //세팅된 DOCUMENT 정보 검색. (prev 스탠드인 — 상단 주석 참조)
        //([HTML5] 미리보기 로드중(transient)에도 안전하도록 _ensurePrev 경유)
        var lt_0015 = _ensurePrev(OBJID)._T_0015.filter(a => a.OBJID === OBJID);

        //코드마스터의 UI5 Document 속성 정보 기준으로 attributes 정보 구성.
        for (var i = 0, l = lt_ua003.length; i < l; i++) {

            //신규라인 생성.
            var ls_0015 = oAPP.fn.crtStru0015();

            //attribute 화면제어 필드 생성.
            oAPP.fn.attrCreateAttrBindField(ls_0015);

            //세팅된 DOCUMENT 정보 존재 여부 확인.
            var ls_temp = lt_0015.find(a => a.UIATK === lt_ua003[i].ITMCD);

            //수정불가 값에 따른 EDIT 가능여부 처리.
            if (lt_ua003[i].FLD06 === "") {
                ls_0015.edit = oAPP.attr.oModel.oData.IS_EDIT;
            }

            //f4 help 가능여부에 따른 f4 help 처리.
            if (lt_ua003[i].FLD04 === "X") {
                ls_0015.showF4 = true;
            }

            switch (lt_ua003[i].ITMCD) {
                case "DH001021":  //UI Theme
                    //DDLB visible 처리.
                    ls_0015.sel_visb = true;

                    var _isUsed = undefined;

                    //1.120.21 버전 이후 패치의 경우 허용 가능 테마 필드명 매핑.
                    if (oAPP.common.checkWLOList("C", "UHAK900889") === true) {
                        _isUsed = "FLD03";
                    }

                    //UI 테마 DDLB 구성.
                    ls_0015.T_DDLB = lf_DDLB("UA007", _isUsed, "FLD01", "FLD01");
                    break;

                case "DH001022":  //CSS Link Add
                case "DH001023":  //JS Link Add
                case "DH001026":  //Web Security Settings
                    //버튼 visible 처리.
                    ls_0015.btn_visb = true;
                    ls_0015.btn_icon = "sap-icon://popup-window";
                    ls_0015.btn_type = "Attention";
                    break;

                case "DH001105":  //Wait Type
                    //DDLB visible 처리.
                    ls_0015.sel_visb = true;
                    ls_0015.T_DDLB = lf_DDLB("UA034", "FLD03", "FLD01", "FLD02");

                    break;

                case "DH001107":  //Touch style
                    //DDLB visible 처리.
                    ls_0015.sel_visb = true;

                    //B20  Circle
                    //Touch style DDLB 항목 구성.
                    ls_0015.T_DDLB = [{ KEY: "", TEXT: "" },
                    { KEY: "circle_ripple", TEXT: _msg("B20", "Circle") }];

                    break;

                case "DH001109":  //Body Background Color
                    ls_0015.showF4 = true;
                    ls_0015.inp_visb = true;
                    break;

                case "DH001024":  //Init not Loding Waiting
                case "DH001101":  //Whether to use Router
                case "DH001102":  //Whether to use Skeleton Screen
                case "DH001103":  //Whether to use Mobile Zoom

                    ls_0015.chk_visb = true;
                    break;

                case "DH001025": //Request/Task
                    ls_0015.UIATV = oAPP.attr.appInfo.REQNO;
                    //기본 input visible 처리.
                    ls_0015.inp_visb = true;
                    break;

                case "DH001104": //Session stateful type
                    //DDLB visible 처리.
                    ls_0015.sel_visb = true;
                    ls_0015.T_DDLB = lf_DDLB("UA052", "FLD02", "ITMCD", "FLD01");
                    break;

                case "DH001106":
                    //Use init pre-screen event
                    //버튼 visible 처리.
                    ls_0015.btn_visb = true;
                    ls_0015.btn_icon = "sap-icon://popup-window";
                    ls_0015.btn_type = "Attention";

                    break;

                case "DH001091":  //Enable Dump Write
                    //버튼 visible 처리.
                    ls_0015.btn_visb = true;
                    ls_0015.btn_icon = "sap-icon://popup-window";
                    ls_0015.btn_type = "Attention";
                    break;

                default:
                    //기본 input visible 처리.
                    ls_0015.inp_visb = true;
                    break;
            }

            //존재하는건인경유.
            if (ls_temp) {
                oAPP.fn.moveCorresponding(ls_temp, ls_0015);

                //체크박스 처리 대상항목인경우.
                //DH001024 - Init not Loding Waiting
                //DH001101 - Whether to use Router
                //DH001102 - Whether to use Skeleton Screen
                //DH001103 - Whether to use Mobile Zoom
                if (lt_ua003[i].ITMCD === "DH001024" || lt_ua003[i].ITMCD === "DH001101" ||
                    lt_ua003[i].ITMCD === "DH001102" || lt_ua003[i].ITMCD === "DH001103") {
                    ls_0015.UIATV_c = false;
                    if (ls_0015.UIATV === "X") {

                        ls_0015.UIATV_c = true;

                    }

                }

                //Request/Task
                if (lt_ua003[i].ITMCD === "DH001025") {
                    ls_0015.UIATV = ls_0015.UIATV = oAPP.attr.appInfo.REQNO;

                }

                oAPP.attr.oModel.oData.T_ATTR.push(ls_0015);

                ls_0015 = {};
                continue;
            }

            ls_0015.APPID = oAPP.attr.appInfo.APPID;
            ls_0015.GUINR = oAPP.attr.appInfo.GUINR;
            ls_0015.UIATK = lt_ua003[i].ITMCD;
            ls_0015.UIATT = lt_ua003[i].FLD01;
            ls_0015.UIATY = "1";
            ls_0015.UIOBK = OBJID;
            ls_0015.OBJID = OBJID;
            ls_0015.UIADT = "string";
            ls_0015.UIASN = ls_0015.UIATT.toUpperCase();

            //Init not Loding Waiting 항목인경우.
            if (lt_ua003[i].ITMCD === "DH001024" || lt_ua003[i].ITMCD === "DH001101" || lt_ua003[i].ITMCD === "DH001102") {
                ls_0015.UIATV_c = false;
            }


            oAPP.attr.oModel.oData.T_ATTR.push(ls_0015);
            ls_0015 = {};

        } //코드마스터의 UI5 Document 속성 정보 기준으로 attributes 정보 구성.

        //(원본 6522~6532행: setAfterRendering/refresh(true)/setAttrModelSort — UI5 부속.
        // HTML5 에선 호출처(fnWs20SelectUI)에서 정렬 + DOM 렌더로 대체.)

    } // end of _updateDOCAttrList

    /************************************************************************
     * 선택한 UI에 해당하는 attribute 리스트 업데이트 — 원본 updateAttrList
     *   (7128행)의 데이터 로직 1:1 (UI5 부속 제외).
     *   행 구성의 출발점은 crtAttrInfo 와 동일한 T_0023 필터(+UIATY!=="4")이며,
     *   원본 7194행 그대로 보존한다.
     ************************************************************************/
    function _updateAttrList(UIOBK, OBJID) {

        //(원본 7139~7150행: changedDataFilter import/initButtonBind/clearDataFilter/
        // removeSelections — UI5/모듈 부속. HTML5 에선 필터 상태 초기화로 대체.)
        oAPP.attr.oModel.oData.sAttrFilt = {
            press: false,
            //490	변경 항목 보기
            text: _wsMsg("490", "Show Changed Items"),
            icon: "sap-icon://filter"
        };

        //객체 전환 시 필터가 해제되므로(press:false) Show Changed Items 버튼 시각도 모델과 동기화한다.
        var oFltBtn = document.getElementById("ws20AttrShowChangedBtn");
        if (oFltBtn) {
            oFltBtn.classList.remove("pressed");
            var oFltBtnTxt = oFltBtn.querySelector("span");
            if (oFltBtnTxt) { oFltBtnTxt.textContent = _wsMsg("490", "Show Changed Items"); }
            var oFltBtnIco = oFltBtn.querySelector("i");
            if (oFltBtnIco) { oFltBtnIco.className = "fa-solid fa-filter"; }
        }

        oAPP.attr.oModel.oData.T_ATTR = [];

        //DOCUMENT를 선택한 경우.
        if (OBJID === "ROOT") {

            //DOCUMENT ATTRIBUTE LIST 구성.
            _updateDOCAttrList(OBJID);

            return;

        }

        oAPP.attr.oModel.oData.T_ATTR = [];

        //(원본 7174~7187행: 서버이벤트 리스트는 DDLB 펼침 시점 검색으로 변경됨 — 동일)
        oAPP.attr.T_EVT = [];

        //file uploader UI의 uploaderUrl 프로퍼티 예외처리.
        oAPP.fn.attrUploadUrlException(OBJID, UIOBK);


        //UI에 해당하는 property, event, Aggregation 정보 얻기. (원본 7194행 1:1)
        var lt_0023 = oAPP.DATA.LIB.T_0023.filter(a => a.UIOBK === UIOBK && a.ISDEP !== "X" && a.UIATY !== "4");

        //얻은 정보 기준으로 attribute 항목 구성.
        for (var i = 0, l = lt_0023.length; i < l; i++) {

            var ls_0015 = oAPP.fn.crtStru0015();
            oAPP.fn.moveCorresponding(lt_0023[i], ls_0015);

            ls_0015.APPID = oAPP.attr.appInfo.APPID;
            ls_0015.GUINR = oAPP.attr.appInfo.GUINR;
            ls_0015.OBJID = OBJID;
            ls_0015.UIATV = lt_0023[i].DEFVL;

            ls_0015.comboval = "";

            //visible, editable등의 attribute 처리 전용 바인딩 필드 생성 처리.
            oAPP.fn.attrCreateAttrBindField(ls_0015);

            //아이콘 활성여부 처리.
            ls_0015.bind_visb = true;  //바인딩 아이콘 visible
            ls_0015.help_visb = true;  //help 아이콘 visible


            //input or DDLB 활성여부 처리.
            if (lt_0023[i].ISLST === "X" || ls_0015.UIATY === "2") {
                //DDLB출력건인경우 DDLB visible
                ls_0015.sel_visb = true;

                //DDLB 항목 구성.
                ls_0015.T_DDLB = oAPP.fn.attrSetDDLBList(lt_0023[i].VALKY, ls_0015.UIATY, lt_0023[i].DEFVL);

            } else if (lt_0023[i].ISLST === "") {
                //DDLB출력건이 아닌경우 input visible
                ls_0015.inp_visb = true;

            }

            //Aggregation이 아닌경우 입력필드 입력 가능 처리.
            oAPP.fn.setAttrEditable(ls_0015);

            //aggregation이 아닌경우 default 입력가능 처리.
            if (ls_0015.UIATY !== "3") {
                ls_0015.edit = true;
            }

            //DEFAULT 아이콘 활성 처리.
            ls_0015.icon1_visb = true;
            ls_0015.icon2_visb = true;


            oAPP.attr.oModel.oData.T_ATTR.push(ls_0015);

            //직접 입력 가능한 Aggregation이 아닌경우 skip.
            if (lt_0023[i].ISSTR !== "X") { continue; }

            //직접입력 가능한 Aggregation인경우 이전 구조 복사.
            ls_0015 = Object.assign({}, ls_0015);

            //직접입력 가능한 Aggregation 키 변경.
            ls_0015.UIATK = ls_0015.UIATK + "_1";
            ls_0015.UIATY = "1";

            ls_0015.edit = true;

            //바인딩 아이콘 처리
            ls_0015.icon1_src = "sap-icon://fallback";
            ls_0015.icon1_color = C_ATTR_BIND_ICON_COLOR;  //바인딩 색상 필드

            //help 아이콘 처리.
            ls_0015.icon2_src = "sap-icon://sys-help";
            ls_0015.icon2_color = "#40baf3";  //help 색상 필드

            //PROPERTY 아이콘 처리.
            ls_0015.UIATT_ICON = "sap-icon://customize";


            oAPP.attr.oModel.oData.T_ATTR.push(ls_0015);

        } //얻은 정보 기준으로 attribute 항목 구성.

        //embed Aggregation 정보 검색. (원본 7275행)
        if (OBJID !== "APP") {

            //[HTML5 가드] 원본은 미리보기(W2)가 만든 prev._T_0015 의 UIATY "6" 행을
            //참조한다. W2 미변환(스탠드인) 상태에선 해당 행이 없을 수 있으므로
            //존재할 때만 원본 로직 그대로 수행. (없으면 빈 행 추가를 피하기 위해 skip)
            var ls_embed = _ensurePrev(OBJID)._T_0015.find(a => a.OBJID === OBJID && a.UIATY === "6");

            if (ls_embed) {

                var ls_0015 = oAPP.fn.crtStru0015();
                oAPP.fn.moveCorresponding(ls_embed, ls_0015);

                //visible, editable등의 attribute 처리 전용 바인딩 필드 생성 처리.
                oAPP.fn.attrCreateAttrBindField(ls_0015);

                //checkbox visible
                ls_0015.chk_visb = true;

                //체크박스 선택 처리.
                ls_0015.UIATV_c = true;

                //편집 불가 처리.
                ls_0015.edit = false;

                //embed Aggregation 정보 추가.
                oAPP.attr.oModel.oData.T_ATTR.push(ls_0015);

            }

        }

        //대상 UI에 매핑되어있는 프로퍼티, 이벤트 항목에 대한건 ATTRIBUTE영역에 매핑. (원본 7299행 1:1)
        for (var i = 0, l = oAPP.attr.oModel.oData.T_ATTR.length; i < l; i++) {

            //대상 UI에 해당하는 입력건 검색.
            //([HTML5] 미리보기 로드중(transient)에도 안전하도록 _ensurePrev 경유)
            var ls_0015 = _ensurePrev(OBJID)._T_0015.find(a => a.UIATK === oAPP.attr.oModel.oData.T_ATTR[i].UIATK &&
                a.UIATY === oAPP.attr.oModel.oData.T_ATTR[i].UIATY);

            if (typeof ls_0015 === "undefined") { continue; }

            oAPP.fn.moveCorresponding(ls_0015, oAPP.attr.oModel.oData.T_ATTR[i]);

            //이벤트인경우 설정된 이벤트가 존재시.
            if (ls_0015.UIATY === "2" && ls_0015.UIATV !== "") {
                //서버이벤트 항목에 해당하는지 여부 확인.
                if (oAPP.attr.T_EVT.findIndex(a => a.KEY === ls_0015.UIATV) === -1) {
                    //서버이벤트 항목에 존재하지 않는 이벤트인경우 이벤트 강제 추가.
                    oAPP.attr.T_EVT.push({ KEY: ls_0015.UIATV, TEXT: ls_0015.UIATV, DESC: "" });

                }

            }

            //바인딩처리된경우 하위 로직 수행.
            if (ls_0015.ISBND !== "X") { continue; }

            //프로퍼티의 DDLB 항목에서 바인딩 처리한경우.
            if (oAPP.attr.oModel.oData.T_ATTR[i].UIATY === "1" && typeof oAPP.attr.oModel.oData.T_ATTR[i].T_DDLB !== "undefined") {
                //DDLB항목에 바인딩한 정보 추가.
                oAPP.attr.oModel.oData.T_ATTR[i].T_DDLB.push({ KEY: ls_0015.UIATV, TEXT: ls_0015.UIATV, ISBIND: "X" });
            }

        } //대상 UI에 매핑되어있는 프로퍼티, 이벤트 항목에 대한건 ATTRIBUTE영역에 매핑.


        //attr 입력 가능 여부 처리. (원본 7359행 1:1 — setExcepAttr 는 미정의시 skip)
        for (var i = 0, l = oAPP.attr.oModel.oData.T_ATTR.length; i < l; i++) {

            //F4 HELP 버튼 활성여부 처리.
            oAPP.fn.attrSetShowValueHelp(oAPP.attr.oModel.oData.T_ATTR[i]);

            //입력필드 입력 가능여부 처리.
            oAPP.fn.setAttrEditable(oAPP.attr.oModel.oData.T_ATTR[i]);

            //icon 처리. (원본 7368행 1:1 — setExcepAttr: help 아이콘 기본 비활성 + 예외 활성)
            oAPP.fn.setExcepAttr(oAPP.attr.oModel.oData.T_ATTR[i]);

            //필수 입력 ATTR의 필수 입력 표현 처리.
            oAPP.fn.attrSetRequireIcon(oAPP.attr.oModel.oData.T_ATTR[i]);

            //attr 라인에 따른 style 처리.
            oAPP.fn.attrSetLineStyle(oAPP.attr.oModel.oData.T_ATTR[i]);

        }

        //autoGrowing 프로퍼티 입력값 여부에 따른 attr 잠금처리. (원본 7379행 — 미정의시 skip)
        _safeCall("attrSetAutoGrowingException", []);

        //dropAble 프로퍼티 입력값 여부에 따른 attr 잠금처리. (원본 7382행 — 미정의시 skip)
        _safeCall("attrSetDropAbleException", []);

        //(원본 7385~7397행: setOnAfterRender/refresh(true)/setAttrModelSort(UI5 Sorter)
        // — HTML5 에선 호출처에서 정렬(UIATY→UIATK) + DOM 렌더로 대체.)

    } // end of _updateAttrList

    /************************************************************************
     * 속성 행 정렬 — 원본 setAttrModelSort(7435행)의 Sorter(UIATY asc, UIATK asc)
     *   를 단순 배열 정렬로 대체(그룹 헤더는 렌더 시 UIATY 변화 지점에 출력).
     ************************************************************************/
    function _sortAttrRows(aAttr) {
        aAttr.sort(function (a, b) {
            var k1 = (a.UIATY || "") < (b.UIATY || "") ? -1 : ((a.UIATY || "") > (b.UIATY || "") ? 1 : 0);
            if (k1 !== 0) { return k1; }
            return (a.UIATK || "") < (b.UIATK || "") ? -1 : ((a.UIATK || "") > (b.UIATK || "") ? 1 : 0);
        });
    }

    /************************************************************************
     * 트리 노드 검색 (OBJID) — 원본 getTreeData 우선, 없으면 /zTREE 재귀 탐색.
     ************************************************************************/
    function _findTreeNode(sObjid) {

        if (typeof oAPP.fn.getTreeData === "function") {
            try {
                var oFound = oAPP.fn.getTreeData(sObjid);
                if (oFound) { return oFound; }
            } catch (e) { }
        }

        function lf_find(aNodes) {
            if (!Array.isArray(aNodes)) { return null; }
            for (var i = 0; i < aNodes.length; i++) {
                var oN = aNodes[i];
                if (!oN) { continue; }
                if (oN.OBJID === sObjid) { return oN; }
                var oC = lf_find(oN.zTREE);
                if (oC) { return oC; }
            }
            return null;
        }

        try {
            return lf_find(oAPP.attr.oModel.oData.zTREE);
        } catch (e) {
            return null;
        }

    } // end of _findTreeNode

    /************************************************************************
     * 미리보기 frame window — 로드 완료(_loaded === true)시에만 반환.
     *   모든 iframe 함수 호출은 반드시 oAPP.attr.ui.frame.contentWindow 경유
     *   + frame/contentWindow/_loaded 가드. (호스트 bare 호출 금지)
     ************************************************************************/
    function _frameWin() {
        try {
            var oFrame = (oAPP.attr.ui && oAPP.attr.ui.frame) || document.getElementById("prevHTML");
            var oWin = (oFrame && oFrame.contentWindow) || null;
            if (!oWin || oWin._loaded !== true) { return null; }
            return oWin;
        } catch (e) {
            return null;
        }
    }

    /************************************************************************
     * 우 상단 attribute header 펼침/접힘 — 원본 attrHeaderExpanded(uiAttributeArea.js
     *   9470행, DynamicPage.setHeaderExpanded) 의 HTML5 대응.
     *   (문서 8.2 1단계 "Attribute header 펼침")
     ************************************************************************/
    function _attrHeaderExpanded(bExpand) {
        // 구현 변경: display 토글 → 스크롤(원본 DynamicPage 처럼 헤더가 스크롤로 접힘/펼침).
        //   펼침 = 맨 위로 스크롤(INFO 보임), 접힘 = STICKY 가 상단에 닿도록 스크롤(INFO 가림).
        var SCROLLER = document.getElementById("ws20AttrScroller");
        if (!SCROLLER) { return; }
        if (bExpand) {
            try { SCROLLER.scrollTop = 0; } catch (e) { }
            return;
        }
        var STICKY = document.getElementById("ws20AttrSticky");
        if (!STICKY) { return; }
        try {
            var d = STICKY.getBoundingClientRect().top - SCROLLER.getBoundingClientRect().top;
            SCROLLER.scrollTop = SCROLLER.scrollTop + d;
        } catch (e) { }
    }

    //drop 가능 css 제거 처리. (원본 design/js/main.js 1765행 ClearDropEffect 1:1 —
    // 순수 DOM 로직(UI5 無). 문서 8.2 3단계 "Drop 잔상 제거")
    if (typeof oAPP.fn.ClearDropEffect !== "function") {
        oAPP.fn.ClearDropEffect = function () {

            //focus된 dom focus 해제 처리.
            try { document.activeElement && document.activeElement.blur(); } catch (e) { }

            var l_dom = document.getElementsByClassName("sapUiDnDIndicator");
            if (l_dom === null || l_dom.length === 0) { return; }

            l_dom[0].setAttribute("style", "");
            l_dom[0].style.display = "none";

        };  //drop 가능 css 제거 처리.
    }

    //바인딩 팝업의 디자인 영역 UI선택 처리. (원본 uiDesignArea.js 3600행 1:1 —
    // 통신 모듈은 node require. 문서 8.1 9단계 "Binding Popup에 선택 OBJID 전달")
    if (typeof oAPP.fn.selectBindingPopupOBJID !== "function") {
        oAPP.fn.selectBindingPopupOBJID = function (is_tree) {

            try {
                //디자인상세화면(20화면) <-> BINDPOPUP 통신 모듈 PATH 구성.
                //(원본 getBindingPopupBroadcastModulePath(main.js 1874행)와 동일 경로 —
                // oDesign.pathInfo.bindPopupBroadCast 는 W2/W4 부트스트랩이 구성)
                var _channelPath = oAPP.oDesign.pathInfo.bindPopupBroadCast;

                //바인딩 팝업으로 다시 호출하여 알림 처리.
                parent.require(_channelPath)("DESIGN-TREE-SELECT-OBJID", is_tree.OBJID);
            } catch (e) {
                //바인딩 팝업 미사용/모듈 미가용(헤드리스) — skip.
            }

        };
    }

    //attribute 영역 선택처리. (원본 uiAttributeArea.js 8134행 setAttrFocus 의
    // HTML5 대응 — UIATK 라인 valueState(TYPE) 처리 + 스크롤/포커스.
    // 문서 8.1 10단계 "Attribute focus 처리")
    if (typeof oAPP.fn.setAttrFocus !== "function") {
        oAPP.fn.setAttrFocus = function (UIATK, TYPE) {

            //UI Attribute Internal Key가 입력안된경우 exit. (원본 1:1)
            if (typeof UIATK === "undefined") { return; }

            try {
                var aAttr = (oAPP.attr.oModel.oData && oAPP.attr.oModel.oData.T_ATTR) || [];
                var sAttr = aAttr.find(function (a) { return a.UIATK === UIATK; });

                //대상 라인을 찾지 못한 경우 exit. (원본 1:1)
                if (!sAttr) { return; }

                //default value state 처리(초기화 처리). (원본 1:1)
                sAttr.valst = undefined;
                sAttr.valtx = undefined;

                //type에 따른 value state 처리. (원본 1:1)
                switch (TYPE) {
                    case "E": sAttr.valst = "Error"; break;
                    case "S": sAttr.valst = "Success"; break;
                    default: break;
                }

                //행 재렌더 후 대상 라인 스크롤/포커스. (구 oRTab1 focus 대응)
                oAPP.fn.fnRenderWs20AttrRows();

                var oRow = document.querySelector(
                    '#ws20AttrRows .u4aWs20AttrRow[data-uiatk="' + UIATK + '"]');
                if (oRow) {
                    try { oRow.scrollIntoView({ block: "nearest" }); } catch (e) { }
                    var oInp = oRow.querySelector("input, select, textarea, button");
                    if (oInp) { try { oInp.focus(); } catch (e) { } }
                }
            } catch (e) { }

        };  //attribute 영역 선택처리.
    }

    /************************************************************************
     * 선택 대상 OBJID 까지 조상 노드 펼침 — 원본 setSelectTreeItem 의
     *   lf_getTreePath + lf_expand(2188~2302행) 의 HTML5 대응(사이드맵).
     *   (문서 8.1 3~5단계 "Tree path 검색 → 대상 path 기준 Tree 펼침")
     ************************************************************************/
    function _expandTreePathTo(OBJID) {
        try {
            oAPP.attr.ws20TreeExpanded = oAPP.attr.ws20TreeExpanded || {};
            var oMap = oAPP.attr.ws20TreeExpanded;

            function lf_path(aNodes) {
                if (!Array.isArray(aNodes)) { return false; }
                for (var i = 0; i < aNodes.length; i++) {
                    var oN = aNodes[i];
                    if (!oN) { continue; }
                    if (oN.OBJID === OBJID) { return true; }
                    if (lf_path(oN.zTREE)) {
                        //조상 노드 펼침. (원본 lf_expand 의 expand 의미)
                        oMap[oN.OBJID] = true;
                        return true;
                    }
                }
                return false;
            }

            lf_path(oAPP.attr.oModel.oData.zTREE);
        } catch (e) { }
    }

    /************************************************************************
     * Tree scroll 위치 보정 — 원본 desginSetFirstVisibleRow(uiDesignArea.js
     *   3572행) 의 HTML5 대응. (문서 8.1 8단계. block:"nearest" 는 원본의
     *   "보이는 영역에 있으면 이동하지 않음" 의미와 동일)
     ************************************************************************/
    function _scrollTreeRowIntoView(OBJID) {
        try {
            var oRow = document.querySelector(
                '#ws20DesignTree .u4aWs20TreeRow[data-objid="' + OBJID + '"]');
            if (oRow) { oRow.scrollIntoView({ block: "nearest" }); }
        } catch (e) { }
    }

    /************************************************************************
     * [PUBLIC] UI design tree 라인 선택 이벤트 — 원본 designTreeItemPress
     *   (uiDesignArea.js 3510행) 의 1:1 의미 이식. (문서 8.2 의 8단계 순서)
     *
     *   1. Attribute header 펼침            (3515행 attrHeaderExpanded)
     *   2. 이전 Preview 선택 표시 제거       (3519행 frame.contentWindow.oWS.sMark.fn_removeMark)
     *   3. Drop 잔상 제거                   (3523행 ClearDropEffect)
     *   4. UI Info 영역 갱신                (3527행 setUIInfo)
     *   5. Attribute 목록 갱신              (3531행 updateAttrList → HTML5 렌더)
     *   6. 필요 시 Preview UI 재생성        (3537~3539행 redrawUIScript — 1:1 조건)
     *   7. Preview 화면 갱신                (3543행 refreshPreview — await)
     *   8. 구버전 패치 기준 popup 강제 close (3551~3553행 closePopup)
     *
     *   ※ 미리보기측 호출은 전부 frame/contentWindow/_loaded 가드(_frameWin).
     *     selPreviewUI 는 여기가 아니라 setSelectTreeItem(fnWs20SelectUI)의
     *     "마지막"(문서 8.1 11단계)에서 호출한다.
     ************************************************************************/
    oAPP.fn.fnWs20DesignTreeItemPress = async function (oNode) {

        var oWin = _frameWin();

        //1. 우 상단 DynamicPage header 영역 펼침 처리. (원본 3515행)
        try { _attrHeaderExpanded(true); } catch (e) { }

        //2. 이전 선택한 UI의 선택 표현 CSS 제거 처리. (원본 3519행 — frame 가드)
        try {
            if (oWin && oWin.oWS && oWin.oWS.sMark &&
                typeof oWin.oWS.sMark.fn_removeMark === "function") {
                oWin.oWS.sMark.fn_removeMark();
            }
        } catch (e) {
            console.warn("[HTML5][WS20][attr] fn_removeMark 오류:", e && e.message);
        }

        //3. 20번 화면의 drop 잔상 제거 처리. (원본 3523행)
        try { oAPP.fn.ClearDropEffect(); } catch (e) { }

        //4. UI Info 영역 갱신 처리. (원본 3527행)
        _setUIInfo(oNode);

        //5. 선택한 ui에 해당하는 attr로 갱신 처리. (원본 3531행 updateAttrList)
        oAPP.attr.oModel.oData.T_ATTR = [];

        // LIB/APPDATA 미로딩(헤드리스/비로그인)시 — 속성은 비어 보임(정상), 크래시 금지.
        var bHasLib = !!(oAPP.DATA && oAPP.DATA.LIB &&
            Array.isArray(oAPP.DATA.LIB.T_0023) && Array.isArray(oAPP.DATA.LIB.T_9011));
        var bHasApp = !!(oAPP.DATA && oAPP.DATA.APPDATA);

        if (bHasLib && bHasApp) {

            // prev[OBJID] 스탠드인 구성 (미리보기 미로드/헤드리스 — 상단 주석 참조).
            _ensurePrev(oNode.OBJID);

            try {
                _updateAttrList(oNode.UIOBK, oNode.OBJID);
            } catch (e) {
                console.warn("[HTML5][WS20][attr] 속성 리스트 구성 오류:", e && e.message);
            }

        } else {
            console.warn("[HTML5][WS20][attr] LIB/APPDATA 미로딩 — 속성 목록 비움(서버 미로그인 정상).");
        }

        //정렬 + HTML5 속성 패널 렌더. (원본 updateAttrList 말미 7385~7397행
        // setOnAfterRender/refresh/setAttrModelSort 대응)
        _sortAttrRows(oAPP.attr.oModel.oData.T_ATTR);
        oAPP.fn.fnRenderWs20AttrPanel();

        //6. ui가 destroy 되어 사용할 수 없는 상태일경우 다시 생성 처리. (원본 3537~3539행 1:1 조건)
        try {
            if (oWin && typeof oWin.redrawUIScript === "function" &&
                (oAPP.common.checkWLOList("C", "UHAK900681") === true ||
                    parent.REMOTE.app.isPackaged === false)) {
                oWin.redrawUIScript(oAPP.attr.oModel.oData.zTREE);
            }
        } catch (e) {
            console.warn("[HTML5][WS20][attr] redrawUIScript 오류:", e && e.message);
        }

        //7. 미리보기 화면 갱신 처리. (원본 3543행)
        try {
            if (oWin && typeof oWin.refreshPreview === "function") {
                await oWin.refreshPreview(oNode);
            }
        } catch (e) {
            console.warn("[HTML5][WS20][attr] refreshPreview 오류:", e && e.message);
        }

        //8. 팝업 호출건 강제 종료 처리. (원본 3551~3553행 — 구버전 패치 기준 1:1 조건)
        try {
            if (oWin && typeof oWin.closePopup === "function" &&
                oAPP.common.checkWLOList("C", "UHAK900788") !== true) {
                oWin.closePopup();
            }
        } catch (e) {
            console.warn("[HTML5][WS20][attr] closePopup 오류:", e && e.message);
        }

    }; // end of oAPP.fn.fnWs20DesignTreeItemPress

    /************************************************************************
     * [PUBLIC] 트리에서 UI 선택 — 원본 setSelectTreeItem(uiDesignArea.js 2172행)
     *   의 1:1 의미 이식. (문서 8.1 의 11단계 순서)
     *
     *    1. Busy ON                          (2179행)
     *    2. Shortcut lock                    (2182행) + BUSY_ON broadcast (2185행)
     *    3. 선택 대상 OBJID 의 Tree path 검색 (lf_getTreePath)
     *    4. Tree filter 해제                  (HTML5 트리 필터 미구현 — 해당 없음)
     *    5. 대상 path 기준으로 Tree 펼침      (lf_expand → 사이드맵)
     *    6. 대상 row 선택                     (setSelectedIndex → 선택 표시 + 재렌더)
     *    7. Attribute 영역 갱신               (2382행 await designTreeItemPress)
     *    8. Tree scroll 위치 보정             (2387행 desginSetFirstVisibleRow)
     *    9. Binding Popup에 선택 OBJID 전달   (2392행 selectBindingPopupOBJID)
     *      → BUSY_OFF / 잠금해제 / busy off   (2396~2403행)
     *   10. Attribute focus 처리             (2407행 setAttrFocus)
     *   11. Preview UI 선택 표시 — 마지막     (frame.contentWindow.selPreviewUI)
     *
     *   oOpt.bSkipBusy     : 호출처(트리 행 클릭 핸들러)가 이미 busy/잠금 처리한 경우.
     *   oOpt.UIATK / TYPE  : 원본 setSelectTreeItem(OBJID, UIATK, TYPE) 대응.
     ************************************************************************/
    oAPP.fn.fnWs20SelectUI = async function (OBJID, oOpt) {

        oOpt = oOpt || {};

        //OBJID가 존재하지 않는경우 EXIT. (원본 2307행)
        if (typeof OBJID === "undefined" || OBJID === null || OBJID === "") {
            return;
        }

        //1~2. busy / 단축키 잠금 / 자식 윈도우 BUSY_ON. (원본 2179~2185행 — 가드)
        if (!oOpt.bSkipBusy) {
            try { parent.setBusy && parent.setBusy("X"); } catch (e) { }
            try { oAPP.fn.setShortcutLock && oAPP.fn.setShortcutLock(true); } catch (e) { }
            try {
                oAPP.attr.oMainBroad && oAPP.attr.oMainBroad.postMessage({ PRCCD: "BUSY_ON" });
            } catch (e) { }
        }

        var oNode = null;

        try {

            //3. 선택 대상 OBJID 의 Tree path 검색. (원본 lf_getTreePath — 미발견시 exit)
            oNode = _findTreeNode(OBJID);

            if (!oNode) {
                console.warn("[HTML5][WS20][attr] 선택 노드 미발견 — skip:", OBJID);
                return;
            }

            //4. Tree filter 해제. (원본 2354~2357행 — HTML5 트리는 필터 미구현, 해당 없음)

            //5. 대상 path 기준으로 Tree 펼침. (원본 lf_expand — 사이드맵 조상 펼침)
            _expandTreePathTo(OBJID);

            //6. 대상 row 선택. (원본 2378행 setSelectedIndex — HTML5: 선택 표시 + 재렌더)
            oAPP.attr.ws20SelectedObjid = OBJID;
            try {
                if (typeof oAPP.fn.fnRenderDesignTree === "function") {
                    oAPP.fn.fnRenderDesignTree();
                }
            } catch (e) { }

            //7. attr 영역 갱신 및 미리보기 화면 갱신. (원본 2382행 — 문서 8.2 의 8단계)
            await oAPP.fn.fnWs20DesignTreeItemPress(oNode);

            //8. design tree의 라인 이동(스크롤) 처리. (원본 2387행)
            _scrollTreeRowIntoView(OBJID);

            //9. 바인딩 팝업에 UI 라인 선택 처리. (원본 2392행)
            try { oAPP.fn.selectBindingPopupOBJID(oNode); } catch (e) { }

        } finally {

            // BUSY_OFF / 잠금 해제 / busy off. (원본 2396~2403행 — 가드)
            if (!oOpt.bSkipBusy) {
                try {
                    oAPP.attr.oMainBroad && oAPP.attr.oMainBroad.postMessage({ PRCCD: "BUSY_OFF" });
                } catch (e) { }
                try { oAPP.fn.setShortcutLock && oAPP.fn.setShortcutLock(false); } catch (e) { }
                try { parent.setBusy && parent.setBusy(""); } catch (e) { }
            }

        }

        //10. attribute 영역 선택처리. (원본 2407행 — busy 해제 "후" 수행, UIATK 입력시)
        try { oAPP.fn.setAttrFocus(oOpt.UIATK, oOpt.TYPE); } catch (e) { }

        //11. 미리보기 ui 선택 처리 — 반드시 마지막. (문서 8.1 11단계 —
        //    frame/contentWindow/_loaded 가드. 미리보기 미로드시 skip)
        try {
            var oWin = _frameWin();
            if (oWin && oNode && typeof oWin.selPreviewUI === "function") {
                await oWin.selPreviewUI(OBJID);
            }
        } catch (e) {
            console.warn("[HTML5][WS20][attr] selPreviewUI 오류:", e && e.message);
        }

    }; // end of oAPP.fn.fnWs20SelectUI

    /* ********************************************************************
     * ★ (5) 변경 항목 판정/필터 — 원본 changedDataMarker.js / changedDataFilter.js
     *        의 데이터 로직 이식(단순 필터).
     * ******************************************************************** */

    function _deepEqualJSON(a, b) {
        try { return JSON.stringify(a) === JSON.stringify(b); } catch (e) { return a === b; }
    }

    /************************************************************************
     * 행 1건의 "변경됨" 판정.
     *   비-ROOT: changedDataMarker.js 65~118행 로직(클라이언트 이벤트 존재 /
     *            T_0023.DEFVL 과 다른 값) 그대로.
     *   ROOT  : setRootChangedMarker 144~219행 로직(T_CSLK/T_JSLK/S_WSO,
     *            UA003.FLD03 기본값 비교) 그대로 (deepEqual 은 JSON 비교로 대체).
     ************************************************************************/
    function _isChangedRow(sAttr) {

        try {
            var bRoot = (oAPP.attr.oModel.oData.uiinfo && oAPP.attr.oModel.oData.uiinfo.OBJID === "ROOT");

            if (bRoot) {

                //예외 처리 비교 대상에 해당하는건 확인.
                switch (sAttr.UIATK) {
                    case "DH001022":    //CSS Link Add
                        //CSS 링크 등록건 존재시.
                        if (oAPP.DATA.APPDATA.T_CSLK.length > 0) { return true; }
                        break;

                    case "DH001023":    //JS Link Add
                        //JS 링크 등록건 존재시.
                        if (oAPP.DATA.APPDATA.T_JSLK.length > 0) { return true; }
                        break;

                    case "DH001026":    //Web Security Settings
                        //Web Security Settings 세팅값과 default 세팅값이 다른 경우.
                        if (_deepEqualJSON(oAPP.DATA.APPDATA.S_WSO, oAPP.DATA.APPDATA.S_WSO_DEF) === false) { return true; }
                        break;

                    default:
                        break;
                }

                //DOCUMENT 공통코드의 KEY에 해당하는 항목중 입력 가능 항목만 발췌.
                var _sUA003 = oAPP.attr.S_CODE && oAPP.attr.S_CODE.UA003 &&
                    oAPP.attr.S_CODE.UA003.find(item => item.ITMCD === sAttr.UIATK && item.FLD06 !== "X");

                if (!_sUA003) { return false; }

                //DEFAULT 값과 같은경우 SKIP.
                if (_sUA003.FLD03 === sAttr.UIATV) { return false; }

                //값을 변경한 경우.
                return true;

            }

            //클라이언트 이벤트 존재시
            if (sAttr.UIATY === "2" &&
                oAPP.DATA.APPDATA.T_CEVT.findIndex(a => a.OBJID === sAttr.OBJID + sAttr.UIASN && a.OBJTY === "JS") !== -1) {
                return true;
            }

            var _UIATK = sAttr.UIATK;

            //직접 입력 가능한 aggregation 여부 확인.
            if (_UIATK.endsWith("_1")) {
                //집접 입력 가능한 aggregation인경우 구분자 제거.
                _UIATK = _UIATK.slice(0, -2);
            }

            //대상 UI의 attr 정보 얻기.
            var _s0023 = oAPP.DATA.LIB.T_0023.find(item => item.UIATK === _UIATK);

            if (!_s0023) { return false; }

            //현재 라인의 값을 변경하지 않은경우 skip.
            if (_s0023.DEFVL === sAttr.UIATV) { return false; }

            //값을 변경한 경우.
            return true;

        } catch (e) {
            return false;
        }

    } // end of _isChangedRow

    /* ********************************************************************
     * ★ (6) 값 변경 핸들러 — 원본 attrChange(1764행)/attrChangeProc(1909행)의
     *        비-UI 로직 보존. 서버 즉시 반영 없음(원본도 로컬 모델 수집 →
     *        Save 시 getSaveData 가 서버 전송) — 동일.
     * ******************************************************************** */

    /************************************************************************
     * [PUBLIC] 속성 값 변경 처리.
     *   uityp: "INPUT" | "DDLB" | "CHECK" (원본과 동일 코드)
     *   원본 보존 항목:
     *     · attrClearErrorField (오류 필드 초기화)
     *     · setChangeFlag (변경 flag — parent.setAppInfo)
     *     · attrChgAttrVal (prev[OBJID]._T_0015 수집 — 로컬 모델 반영)
     *     · attrSetLineStyle / attrSetShowValueHelp / setAttrEditable
     *   가드(미수행 — 사유 명시):
     *     · attrDocumentProc(ROOT 테마/미리보기 적용 등) — W2 미리보기 의존.
     *     · undoRedo.saveActionHistoryData — design 모듈(parent.require) 시도 후 실패시 warn.
     *     · checkPropertyValue(designTreeData.js)/previewUIsetProp/selPreviewUI — W2/미변환.
     ************************************************************************/
    oAPP.fn.fnWs20AttrChange = function (sAttr, uityp) {

        try { parent.setBusy && parent.setBusy("X"); } catch (e) { }
        try { oAPP.fn.setShortcutLock(true); } catch (e) { }

        try {

            //오류 표현 필드 초기화 처리. (원본 1776행)
            oAPP.fn.attrClearErrorField();

            //(원본 1780행 attrDocumentProc: ROOT 의 테마/CSS 적용 등 "미리보기" 반영 —
            // W2 미변환 → 데이터 수집(attrChgAttrVal)만 수행하고 미리보기 반영은 skip)

            //UNDO HISTORY 추가 처리. (원본 1811행 — design 모듈 로드 가능시에만)
            try {
                parent.require(oAPP.oDesign.pathInfo.undoRedo).saveActionHistoryData("CHANGE_ATTR", [sAttr]);
            } catch (e) {
                console.warn("[HTML5][WS20][attr] undo history skip (모듈 미로드):", e && e.message);
            }

            //화면에서 UI추가, 이동, 삭제 및 attr 변경시 변경 flag 처리. (원본 attrChangeProc 1912행)
            //  주의: setChangeFlag 본체는 design/js/main.js 가 먼저 정의(IS_CHAG="X"+setAppInfo)하므로
            //  여기서 헤더/상태 갱신을 직접 호출해야 한다(원본은 sap 모델 바인딩이 자동 갱신했음).
            try {
                oAPP.fn.setChangeFlag();
            } catch (e) {
                console.warn("[HTML5][WS20][attr] setChangeFlag skip:", e && e.message);
            }
            // 변경 즉시 모델/앱헤더 반영 → 상태 Active→Inactive
            try { oAPP.common.fnSetModelProperty("/WS20/APP/IS_CHAG", "X"); } catch (e) { }
            try { if (oAPP.fn.fnUpdateWs20AppHeader) { oAPP.fn.fnUpdateWs20AppHeader(); } } catch (e) { }

            //(원본 1920행 checkPropertyValue(designTreeData.js): 입력값 점검 모듈 —
            // parent.require 로드 가능시에만 수행)
            try {
                var _oDesignChkModule = parent.require(
                    parent.PATH.join(oAPP.oDesign.pathInfo.designRootPath, "js", "checkAppData", "designTreeData.js"));

                var _aReuireError = _oDesignChkModule.checkPropertyValue(sAttr);

                //입력한 값에 오류가 존재하는경우. (원본 1923행)
                if (_aReuireError && _aReuireError.RETCD === "E") {

                    sAttr.valst = "Error";
                    sAttr.valtx = _aReuireError.RTMSG;

                    //기존 입력값을 DEFAULT 값으로 변경.
                    sAttr.UIATV = (oAPP.DATA.LIB.T_0023.find(a => a.UIATK === sAttr.UIATK) || {}).DEFVL || "";

                }
            } catch (e) {
                // 점검 모듈 미로드(헤드리스) — skip.
            }

            //attr 변경처리(로컬 모델 수집). (원본 1939행)
            try {
                oAPP.fn.attrChgAttrVal(sAttr, uityp);
            } catch (e) {
                console.warn("[HTML5][WS20][attr] attrChgAttrVal 오류:", e && e.message);
            }

            //DDLB 변경 라인 STYLE 처리. (원본 1944행)
            try { oAPP.fn.attrSetLineStyle(sAttr); } catch (e) { }

            //F4 HELP 버튼 활성여부 처리. (원본 1947행)
            try { oAPP.fn.attrSetShowValueHelp(sAttr); } catch (e) { }

            //입력필드 입력 가능여부 처리. (원본 1950행)
            try { oAPP.fn.setAttrEditable(sAttr); } catch (e) { }

            //(원본 1953행 previewUIsetProp + 1884행 selPreviewUI: 미리보기 반영 — W2 예정)
            if (typeof oAPP.fn.previewUIsetProp !== "function") {
                console.warn("[HTML5][WS20][attr] 미리보기 반영 skip (W2 예정):", sAttr.UIATT);
            } else {
                _safeCall("previewUIsetProp", [sAttr]);
            }

            //모델 갱신 처리. (원본 1959행 — HTML5: 속성 행 재렌더)
            oAPP.fn.fnRenderWs20AttrRows();

        } finally {
            try { oAPP.fn.setShortcutLock(false); } catch (e) { }
            try { parent.setBusy && parent.setBusy(""); } catch (e) { }
        }

    }; // end of oAPP.fn.fnWs20AttrChange

    /************************************************************************
     * 이벤트 생성 아이콘(녹색 developer-settings) 선택 — 서버이벤트 생성 팝업 호출.
     *   (원본 uiAttributeArea.js attrCallEventPopup 2057행 1:1. UI5 의존 없음.)
     *   조건: 이벤트행(UIATY="2") + 편집가능(edit) + 화면편집(IS_EDIT) + 비-Trial.
     *   createEventPopup(is_attr, attrCreateEventCallBack) — 생성 완료 시 콜백이
     *   해당 이벤트 attr 값으로 매핑하고 attr 변경 흐름을 수행한다.
     *   반환 true = 호출처(아이콘 핸들러)의 후속 분기 skip(원본 동일).
     ************************************************************************/
    if (typeof oAPP.fn.attrCallEventPopup !== "function") {
        oAPP.fn.attrCallEventPopup = function (is_attr) {

            //해당 라인이 이벤트 라인이 아닌경우 exit.
            if (is_attr.UIATY !== "2") { return; }

            //현재 이벤트 영역이 편집 불가능하다면 exit.
            if (is_attr.edit !== true) { return; }

            //화면이 편집상태가 아닌경우 exit.
            if (!_isEditMode()) { return; }

            //trial 버전인경우 서버이벤트 메소드 생성 금지 처리.
            if (oAPP.fn.fnOnCheckIsTrial()) { return; }

            //대상 function이 존재하는경우 호출 처리.
            if (typeof oAPP.fn.createEventPopup === "function") {
                oAPP.fn.createEventPopup(is_attr, oAPP.fn.attrCreateEventCallBack);
                return true;
            }

            //대상 function이 존재하지 않는경우 script 호출.
            oAPP.fn.getScript("design/js/createEventPopup", function () {
                oAPP.fn.createEventPopup(is_attr, oAPP.fn.attrCreateEventCallBack);
            });

            return true;

        };  //이벤트 생성 아이콘 선택.
    }

    /************************************************************************
     * 이벤트 생성 팝업 콜백 (원본 uiAttributeArea.js attrCreateEventCallBack 5302행).
     *   생성된 이벤트명을 해당 attr 값(UIATV/comboval)으로 매핑 후 attr 변경 흐름 수행.
     *   ※ 원본의 bindPopup BUSY_ON 브로드캐스트는 UI5 바인딩팝업 전용 — HTML5 skip.
     *     attr 변경(원본 attrChange)은 HTML5 fnWs20AttrChange 로 대체(끝에서 행 재렌더 →
     *     해당 이벤트 DDLB 가 새 이벤트명을 선택값으로 표시).
     ************************************************************************/
    if (typeof oAPP.fn.attrCreateEventCallBack !== "function") {
        oAPP.fn.attrCreateEventCallBack = function (is_attr, evtnm) {

            //입력한 이벤트명 매핑.
            is_attr.UIATV = evtnm;
            is_attr.comboval = evtnm;

            //attribute 입력건에 대한 변경 흐름(수집/스타일/재렌더).
            oAPP.fn.fnWs20AttrChange(is_attr, "DDLB");

        };  //이벤트 팝업 call back 이벤트.
    }

    /************************************************************************
     * Attribute 초기화 (원본 uiAttributeArea.js attrResetAttr 2096행).
     * ----------------------------------------------------------------------
     *  선택 UI 의 **직접 변경한 Property** 들을 전부 기본값(DEFVL)으로 되돌린다.
     *  · 확인 팝업(112+113, KIND 30 YES/NO) → YES 일 때만 수행.
     *  · 대상: UIATY="1"(프로퍼티) + ISBND≠"X"(바인딩 아님).
     *    - ISSTR(직접입력 aggregation): 값 있으면 "" 로 비움.
     *    - 그 외: 현재값≠DEFVL 이면 DEFVL 로. (이미 기본값이면 skip)
     *  · 값 반영은 수동 변경과 동일 경로(fnWs20AttrChange)로 — 수집(_T_0015)/변경표시/
     *    헤더·상태(Active→Inactive)/재렌더가 그대로 처리된다(원본 attrChangeProc+refresh 대응).
     *  ※ UI5 전용(undo getResetAttrParam·preview onAfterRendering·bindPopup broadcast)은
     *    HTML5 미해당이라 생략(undo 는 fnWs20AttrChange 가 변경건마다 자체 기록).
     ************************************************************************/
    if (typeof oAPP.fn.attrResetAttr !== "function") {
        oAPP.fn.attrResetAttr = function () {

            //편집 모드가 아니면 무시(버튼 vis02 가드와 별개 안전).
            if (!_isEditMode()) { return; }

            //112 Resets all properties to their default values. / 113 The registered value will be lost. Do you want to proceed?
            var sMsg = (oAPP.common.fnGetMsgClsText("/U4A/MSG_WS", "112", "", "", "", "") || "") + " \n " +
                (oAPP.common.fnGetMsgClsText("/U4A/MSG_WS", "113", "", "", "", "") || "");

            //초기화 전 확인 팝업(원본 showMessage KIND 30 → HTML5 동일 라우팅).
            parent.showMessage(null, 30, "I", sMsg, function (sAct) {

                //YES 가 아니면 종료.
                if (sAct !== "YES") { return; }

                try { parent.setBusy && parent.setBusy("X"); } catch (e) { }
                try { oAPP.fn.setShortcutLock(true); } catch (e) { }

                try {
                    var oData = (oAPP.attr.oModel && oAPP.attr.oModel.oData) || {};

                    //'Show Changed Items' 필터가 켜져 있으면 끈다 — 초기화하면 변경행이 사라져 빈 목록이 되므로.
                    if (oData.sAttrFilt && oData.sAttrFilt.press === true) {
                        oData.sAttrFilt.press = false;
                        var FLT = document.getElementById("ws20AttrShowChangedBtn");
                        if (FLT) { FLT.classList.remove("pressed"); FLT.setAttribute("aria-pressed", "false"); }
                    }

                    var aT0023 = (oAPP.DATA && oAPP.DATA.LIB && oAPP.DATA.LIB.T_0023) || [];
                    //순회 중 fnWs20AttrChange 가 재렌더해도 배열 구조는 불변이나, 안전하게 프로퍼티만 추려 복사본 순회.
                    var aProps = ((oData.T_ATTR) || []).filter(function (a) { return a && a.UIATY === "1" && a.ISBND !== "X"; });

                    for (var i = 0; i < aProps.length; i++) {
                        var _sAttr = aProps[i];

                        //직접 입력 가능한 attribute 는 AT...._1 형식 — _ 뒤 제거 후 원본 키로 조회.
                        var l_UIATK = _sAttr.UIATK;
                        if (l_UIATK.indexOf("_") !== -1) { l_UIATK = l_UIATK.substr(0, l_UIATK.indexOf("_")); }

                        var ls_0023 = aT0023.find(function (a) { return a.UIATK === l_UIATK; });
                        if (!ls_0023) { continue; }

                        var sDefault;
                        if (ls_0023.ISSTR === "X") {
                            //직접입력 aggregation — 값 있을 때만 "" 로 초기화.
                            if (_sAttr.UIATV === "") { continue; }
                            sDefault = "";
                        } else {
                            sDefault = (ls_0023.DEFVL == null) ? "" : ls_0023.DEFVL;
                            //이미 기본값이면 skip.
                            if (_sAttr.UIATV === sDefault) { continue; }
                        }

                        //값을 기본값으로 — 컨트롤 종류별 필드 동기화 후 동일 변경 경로 수행.
                        _sAttr.UIATV = sDefault;
                        _sAttr.comboval = sDefault;                 //combo
                        _sAttr.UIATV_c = (sDefault === "true");      //checkbox

                        var uityp = _sAttr.chk_visb ? "CHECK" : (_sAttr.sel_visb ? "DDLB" : "INPUT");
                        try { oAPP.fn.fnWs20AttrChange(_sAttr, uityp); }
                        catch (e) { console.error("[HTML5][WS20][attr] reset 변경 오류:", _sAttr.UIATT, e && e.message); }
                    }

                    //필터 끔 반영 + 변경표시 제거 확정(마지막 1회 재렌더 — fnWs20AttrChange 가 안 불린 경우 대비).
                    oAPP.fn.fnRenderWs20AttrRows();

                } catch (e) {
                    console.error("[HTML5][WS20][attr] Attribute Reset 오류:", e && e.message);
                } finally {
                    try { oAPP.fn.setShortcutLock(false); } catch (e) { }
                    try { parent.setBusy && parent.setBusy(""); } catch (e) { }
                }
            });

        };  //attribute 초기화 기능.
    }

    /* ********************************************************************
     * ★ (7) HTML5 렌더 — 우측 속성 패널 (구 sap.f.DynamicPage 구조)
     *        스크린샷 실측 스펙:
     *         [헤더: UI 아이콘 + UI명(흰색 굵게) + UILIB]
     *         [UI Object ID 라벨 + 점선밑줄 입력 + ⧉ 복사]
     *         [Description 라벨 + textarea]
     *         [∧ 접기 / 📌 핀 작은 버튼 줄]
     *         [툴바: (Reset) … Show Changed Items(파란 채움) ⋯ ?]
     *         ["Properties" 섹션 바]
     *         [속성 행들: 라벨 좌 / 값 우 (+40px 아이콘 ×2)]
     * ******************************************************************** */

    // sap-icon → 표시용 글리프 매핑 (원본 sap.ui.core.Icon 아이콘 폰트 대체)
    // sap-icon URI → FontAwesome(solid) 이름. (구: 유니코드 글리프 → 깨짐/이모지화. 원본 sap.ui.core.Icon
    //   의 의미를 유지하되 FA 아이콘으로 렌더한다 — 유니코드 사용 금지)
    var _ICON_FA = {
        "sap-icon://fallback": "link",                      // 바인딩(서버이벤트)
        "sap-icon://sys-help": "circle-question",           // help(클라이언트이벤트)
        "sap-icon://developer-settings": "screwdriver-wrench", // 서버이벤트
        "sap-icon://syntax": "code",                        // 클라이언트 이벤트
        "sap-icon://warning2": "triangle-exclamation",      // aggregation help
        "sap-icon://inspection": "magnifying-glass",        // 상세보기(바인딩됨)
        "sap-icon://delete": "trash",                       // 삭제
        "sap-icon://favorite": "star",                      // 즐겨찾기/필수
        "sap-icon://popup-window": "up-right-from-square",  // 팝업 호출형 버튼(CSS/JS Link 등)
        "sap-icon://customize": "sliders",                  // property
        "sap-icon://border": "square",                      // event
        "sap-icon://complete": "check",                     // event(wait off)
        "sap-icon://color-fill": "diamond",                 // aggregation 0:1
        "sap-icon://dimension": "diamond",                  // aggregation 0:N
        "sap-icon://value-help": "clone"                    // F4 값도움 — 원본 sap-icon://value-help(겹친 사각형) 모양에 가장 가까운 fa-clone 로 재현(사용자 피드백 2026-06-17)
    };
    // sap-icon → FontAwesome <i> 마크업. 못 찾으면 sFaFallback(기본 circle).
    function _iconHtml(sIcon, sFaFallback) {
        var sFa = (sIcon && _ICON_FA[sIcon]) || sFaFallback || "circle";
        return '<i class="fa-solid fa-' + sFa + '"></i>';
    }

    // 클립보드 복사 (원본 attrCopyText — UI5 무관 단순 동작 대체)
    function _copyText(sText) {
        try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(sText || "");
                return;
            }
        } catch (e) { }
        try {
            var TA = document.createElement("textarea");
            TA.value = sText || "";
            document.body.appendChild(TA);
            TA.select();
            document.execCommand("copy");
            TA.remove();
        } catch (e) { }
    }

    function _isEditMode() {
        try {
            return oAPP.attr.oModel.oData.IS_EDIT === true;
        } catch (e) { }
        return false;
    }

    /************************************************************************
     * 속성 패널 골격 1회 구성 (#ws20DesignAttr 내부).
     ************************************************************************/
    function _buildAttrSkeleton() {

        var oPane = document.getElementById("ws20DesignAttr");
        if (!oPane) { return null; }

        var oWrap = oPane.querySelector(".u4aWs20AttrWrap");
        if (oWrap) { return oWrap; }

        // 속성 툴바 반응형 오버플로 컨트롤러 (필터 토글로 버튼 폭이 바뀌면 reflow).
        var _attrTbOvf = null;

        oPane.innerHTML = "";

        oWrap = document.createElement("div");
        oWrap.className = "u4aWs20AttrWrap";

        /* ── (a) 헤더: [UI 아이콘] [UI명] … [UILIB] (구 DynamicPageTitle Toolbar) ── */
        var HDR = document.createElement("div");
        HDR.id = "ws20AttrHeader";
        HDR.className = "u4aWs20AttrHeader";

        var ICO = document.createElement("img");
        ICO.id = "ws20AttrHdrIcon";
        ICO.className = "u4aWs20AttrHdrIcon";
        ICO.alt = "";
        ICO.style.display = "none";
        ICO.onerror = function () { this.style.display = "none"; };
        HDR.appendChild(ICO);

        var TIT = document.createElement("span");
        TIT.id = "ws20AttrHdrTitle";
        TIT.className = "u4aWs20AttrHdrTitle";
        HDR.appendChild(TIT);

        var SPC = document.createElement("span");
        SPC.className = "u4aWs20AttrHdrSpacer";
        HDR.appendChild(SPC);

        //라이브러리명 text (구 oRLibText — 더블클릭시 복사. 원본 103행)
        var LIB = document.createElement("span");
        LIB.id = "ws20AttrHdrLib";
        LIB.className = "u4aWs20AttrHdrLib";
        LIB.title = _msg("B15", "UI5 library Reference");
        LIB.addEventListener("dblclick", function () {
            //라이브러리명 복사 처리. (원본 oRLibText dblclick)
            _copyText(LIB.textContent);
        });
        HDR.appendChild(LIB);

        //라이브러리 sample 버튼 (구 oRLibBtn2 — 팝업 호출형) [가드]
        var SMP = document.createElement("button");
        SMP.type = "button";
        SMP.id = "ws20AttrHdrSampleBtn";
        SMP.className = "u4aWs20AttrHdrBtn";
        SMP.title = _msg("B16", "UI Sample");
        SMP.innerHTML = '<i class="fa-solid fa-table-cells"></i>';
        SMP.style.display = "none";
        SMP.addEventListener("click", function () {
            console.warn("[W4+ 예정] UI Sample 팝업(attrCallUiSample) 미변환");
        });
        HDR.appendChild(SMP);

        oWrap.appendChild(HDR);

        // ── 스크롤 영역 (구 sap.f.DynamicPage 본문) ──────────────────────────
        //   제목(HDR)은 패널 상단 고정, 그 아래(INFO+툴바+행)를 "한 덩어리"로 스크롤한다.
        //   스크롤을 내리면 INFO(UI Object ID/Description)는 위로 사라지고, STICKY(셰브론+툴바)가
        //   상단(top:0)에 붙는다(원본 DynamicPage snap header). 올리면 INFO 가 다시 보인다.
        var SCROLLER = document.createElement("div");
        SCROLLER.id = "ws20AttrScroller";
        SCROLLER.className = "u4aWs20AttrScroller";
        oWrap.appendChild(SCROLLER);

        // 셰브론(접기/펼치기)+툴바를 함께 묶어 스크롤 시 상단 고정(sticky)할 컨테이너.
        var STICKY = document.createElement("div");
        STICKY.id = "ws20AttrSticky";
        STICKY.className = "u4aWs20AttrSticky";

        /* ── (b) UI Object ID / Description 입력 영역 (구 DynamicPageHeader Grid) ── */
        var INFO = document.createElement("div");
        INFO.id = "ws20AttrInfo";
        INFO.className = "u4aWs20AttrInfo";

        //A84 UI Object ID
        var LBL1 = document.createElement("div");
        LBL1.className = "u4aWs20AttrInfoLbl";
        LBL1.textContent = _msg("A84", "UI Object ID");
        INFO.appendChild(LBL1);

        var ROW1 = document.createElement("div");
        ROW1.className = "u4aWs20AttrInfoRow";

        //OBJID 입력필드 (점선 밑줄 스타일) — 공통 팩토리(U4AUI.createField), inputClassName 으로 인라인 스타일 유지.
        var oObjFld = window.U4AUI.createField({
            type: "text", id: "ws20AttrObjIdInp", inputClassName: "u4aWs20AttrInp", maxLength: 100,
            onChange: function () {
                //OBJID 변경건 처리 — 원본 attrChnageOBJID(트리/미리보기/모델 연쇄 변경, UI5 의존)
                console.warn("[W4+ 예정] UI Object ID 변경(attrChnageOBJID) 미변환 — 값 원복");
                try {
                    oObjFld.input.value = (oAPP.attr.oModel.oData.uiinfo && oAPP.attr.oModel.oData.uiinfo.OBJID) || "";
                } catch (e) { }
            }
        });
        var INP = oObjFld.input;   // 하위 호환(아래 Copy 버튼 등에서 참조)
        ROW1.appendChild(oObjFld.el);

        //A04 Copy — OBJID 복사 버튼. (원본 oRBtn0 press: attrCopyText)
        var CPY = document.createElement("button");
        CPY.type = "button";
        CPY.id = "ws20AttrObjIdCopyBtn";
        CPY.className = "u4aWs20AttrSmBtn";
        CPY.title = _msg("A04", "Copy");
        // 클립보드 복사 — F4 값도움(fa-clone, 겹친 사각형)과 구분되게 fa-copy(문서 복사) 사용(사용자 피드백 2026-06-17)
        CPY.innerHTML = '<i class="fa-solid fa-copy"></i>';
        CPY.addEventListener("click", function () {
            //라이브러리명 복사 처리. (원본과 동일: 입력 필드의 값 복사)
            _copyText(INP.value);
        });
        ROW1.appendChild(CPY);

        INFO.appendChild(ROW1);

        //A35 Description
        var LBL2 = document.createElement("div");
        LBL2.className = "u4aWs20AttrInfoLbl";
        LBL2.textContent = _msg("A35", "Description");
        INFO.appendChild(LBL2);

        //Description 입력 TextArea (원본 oRTAr1 rows:4) — 공통 팩토리(U4AUI.createField textarea).
        var oDescFld = window.U4AUI.createField({ type: "textarea", id: "ws20AttrDescTxa", inputClassName: "u4aWs20AttrTxa", rows: 4 });
        var TXA = oDescFld.input;   // 하위 호환(아래 change 핸들러에서 참조)
        TXA.addEventListener("change", function () {

            // busy 키고 (원본 Description 변경 이벤트 297행 보존)
            try { parent.setBusy && parent.setBusy("X"); } catch (e) { }

            try {
                var sObjid = (oAPP.attr.oModel.oData.uiinfo && oAPP.attr.oModel.oData.uiinfo.OBJID) || "";
                if (sObjid && oAPP.DATA && oAPP.DATA.APPDATA) {
                    //Description 등록처리. (원본 setDesc)
                    oAPP.fn.setDesc(sObjid, TXA.value);

                    //화면에서 UI추가, 이동, 삭제 및 attr 변경시 변경 flag 처리.
                    oAPP.fn.setChangeFlag();
                    // 변경 즉시 상태 Active→Inactive 반영
                    try { oAPP.common.fnSetModelProperty("/WS20/APP/IS_CHAG", "X"); } catch (e2) { }
                    try { if (oAPP.fn.fnUpdateWs20AppHeader) { oAPP.fn.fnUpdateWs20AppHeader(); } } catch (e2) { }

                    //모델 /uiinfo/DESC 동기화.
                    if (oAPP.attr.oModel.oData.uiinfo) {
                        oAPP.attr.oModel.oData.uiinfo.DESC = TXA.value;
                    }
                }
            } catch (e) {
                console.warn("[HTML5][WS20][attr] Description 변경 처리 오류:", e && e.message);
            }

            // busy off (원본 309행)
            try { parent.setBusy && parent.setBusy(""); } catch (e) { }

        });
        INFO.appendChild(oDescFld.el);

        SCROLLER.appendChild(INFO);

        /* ── (c) 접기(∧)/핀(📌) 작은 버튼 줄 (구 DynamicPage 헤더 접기/핀) ── */
        var CTL = document.createElement("div");
        CTL.className = "u4aWs20AttrInfoCtl";

        // 헤더(INFO) 접힘 여부 = INFO 하단이 스크롤 영역(SCROLLER) 상단 위로 가려졌는지.
        //   (STICKY 와 INFO 는 인접해 있어 STICKY.top 기준으로 보면 펼침 상태도 접힘으로 오판됨)
        function _attrHeaderCollapsed() {
            try {
                var rInfo = INFO.getBoundingClientRect();
                var rScr = SCROLLER.getBoundingClientRect();
                return rInfo.bottom <= rScr.top + 2;
            } catch (e) { return false; }
        }
        // 셰브론 아이콘 동기화: 펼침(INFO 보임)=∧, 접힘(스크롤로 가려짐)=∨.
        function _attrSyncChevron() {
            COL.innerHTML = _attrHeaderCollapsed()
                ? '<i class="fa-solid fa-chevron-down"></i>'
                : '<i class="fa-solid fa-chevron-up"></i>';
        }

        var COL = document.createElement("button");
        COL.type = "button";
        COL.id = "ws20AttrInfoCollapseBtn";
        COL.className = "u4aWs20AttrSmBtn";
        COL.title = "Expand/Collapse Header";
        COL.innerHTML = '<i class="fa-solid fa-chevron-up"></i>';
        // 클릭 = 스크롤로 접기/펼치기(원본 DynamicPage snap 토글). 펼침이면 INFO 가리도록 아래로,
        //   접힘이면 맨 위로(스무스). 스크롤 위치에 따라 셰브론 아이콘은 _attrSyncChevron 이 갱신.
        COL.addEventListener("click", function () {
            // 접힘 → 맨 위로(펼침). 펼침 → STICKY 가 SCROLLER 상단에 닿도록 스크롤(INFO 가림=접힘).
            var iTarget = 0;
            if (!_attrHeaderCollapsed()) {
                try {
                    var dTop = STICKY.getBoundingClientRect().top - SCROLLER.getBoundingClientRect().top;
                    iTarget = SCROLLER.scrollTop + dTop;
                } catch (e) { iTarget = SCROLLER.scrollTop + 200; }
            }
            try { SCROLLER.scrollTo({ top: iTarget, behavior: "smooth" }); }
            catch (e) { SCROLLER.scrollTop = iTarget; }
        });
        CTL.appendChild(COL);

        var PIN = document.createElement("button");
        PIN.type = "button";
        PIN.id = "ws20AttrInfoPinBtn";
        PIN.className = "u4aWs20AttrSmBtn";
        PIN.title = "Pin Header";
        PIN.innerHTML = '<i class="fa-solid fa-thumbtack"></i>';
        // 핀 = 헤더(INFO) 고정(원본 DynamicPageHeader pinnable). 누르면 INFO 를 스크롤 영역 밖
        //   (제목 HDR 다음 고정 영역)으로 옮겨 스크롤해도 항상 보이게, 다시 누르면 스크롤 영역으로
        //   복귀해 스크롤로 접히게 한다. 핀 상태에선 접기 셰브론(∧/∨)은 의미 없어 숨긴다.
        PIN.addEventListener("click", function () {
            var bPin = !PIN.classList.contains("pinned");
            PIN.classList.toggle("pinned", bPin);
            try {
                if (bPin) {
                    oWrap.insertBefore(INFO, SCROLLER);   // 고정 영역(HDR 다음)으로 → 항상 표시
                    COL.style.display = "none";
                } else {
                    SCROLLER.insertBefore(INFO, SCROLLER.firstChild); // 스크롤 영역 맨 위로 복귀
                    COL.style.display = "";
                    SCROLLER.scrollTop = 0;               // 펼친 상태로 되돌림
                    _attrSyncChevron();
                }
            } catch (e) {
                console.warn("[HTML5][WS20][attr] 헤더 핀 토글 오류:", e && e.message);
            }
        });
        CTL.appendChild(PIN);

        STICKY.appendChild(CTL);

        // 스크롤 시 셰브론 아이콘 갱신(∧/∨).
        SCROLLER.addEventListener("scroll", _attrSyncChevron, { passive: true });

        /* ── (d) 속성 툴바 (구 HeaderToolbar): Reset … Show Changed Items ⋯ ? ── */
        var TBR = document.createElement("div");
        TBR.id = "ws20AttrToolbar";
        TBR.className = "u4aWs20AttrToolbar";

        //B17 Reset — attribute 초기화 버튼 (vis02 시에만 표시). 변경 속성 전부 기본값 복원.
        var RST = document.createElement("button");
        RST.type = "button";
        RST.id = "ws20AttrResetBtn";
        RST.className = "u4aWs20AttrTbBtn reset";
        RST.title = _msg("B17", "Reset");
        //아이콘/텍스트 분리(필터 버튼과 동일 구조) — 좁아지면 ⋯ 로 접힘.
        RST.innerHTML = '<i class="fa-solid fa-rotate-left"></i><span>' + _msg("B17", "Reset") + '</span>';
        RST.style.display = "none";
        RST.addEventListener("click", function () {
            try { oAPP.fn.attrResetAttr(); }
            catch (e) { console.error("[HTML5][WS20][attr] Attribute Reset 호출 오류:", e && e.message); }
        });
        TBR.appendChild(RST);

        var TSP = document.createElement("span");
        TSP.className = "u4aWs20AttrTbSpacer";
        TBR.appendChild(TSP);

        //Show Changed Items 토글 (구 _oFiltBtn ToggleButton type:Emphasized)
        var FLT = document.createElement("button");
        FLT.type = "button";
        FLT.id = "ws20AttrShowChangedBtn";
        FLT.className = "u4aWs20AttrTbBtn emph";
        //815 변경된 항목만 필터링하여 표시...
        FLT.title = _wsMsg("815", "Show only changed Property/Event/Aggregation items.");
        //원본(ToggleButton)과 동일하게 깔때기(필터) 아이콘 + 텍스트. (아이콘/텍스트 분리 — 토글 시 텍스트만 교체)
        FLT.innerHTML = '<i class="fa-solid fa-filter"></i><span>' + _wsMsg("490", "Show Changed Items") + '</span>';
        FLT.addEventListener("click", function () {

            try { parent.setBusy && parent.setBusy("X"); } catch (e) { }
            try { oAPP.fn.setShortcutLock(true); } catch (e) { }

            try {
                var sFilt = oAPP.attr.oModel.oData.sAttrFilt ||
                    (oAPP.attr.oModel.oData.sAttrFilt = { press: false });

                sFilt.press = !sFilt.press;

                //필터 버튼 text, icon 변경 처리. (원본 setButtonState: 490/491) — 아이콘은 유지하고 텍스트만 교체.
                var oFltTxt = FLT.querySelector("span");
                var oFltIco = FLT.querySelector("i");
                if (oFltTxt) {
                    oFltTxt.textContent = sFilt.press
                        ? _wsMsg("491", "Show All Items")
                        : _wsMsg("490", "Show Changed Items");
                }
                //켜짐 = 필터 적용 중 → "필터 해제(전체 보기)" 의미의 아이콘으로 토글
                if (oFltIco) {
                    oFltIco.className = sFilt.press ? "fa-solid fa-filter-circle-xmark" : "fa-solid fa-filter";
                }
                FLT.classList.toggle("pressed", sFilt.press);

                //ui의 변경된 속성값 필터 처리 / 해제 (changedDataFilter 로직의 단순 필터).
                oAPP.fn.fnRenderWs20AttrRows();

                //토글로 버튼 텍스트(490↔491) 폭이 바뀌므로 오버플로 재계산.
                try { if (_attrTbOvf) { _attrTbOvf.reflow(); } } catch (e) { }
            } finally {
                try { oAPP.fn.setShortcutLock(false); } catch (e) { }
                try { parent.setBusy && parent.setBusy(""); } catch (e) { }
            }

        });
        TBR.appendChild(FLT);

        //UI Attribute Personalization List (구 _oPresetList — 원본 sap-icon://user-settings).
        //   ★ 사용자 요청: "이름이 보이는 버튼"으로 두고(아이콘+텍스트), 공간이 충분하면 버튼으로
        //     보이다가 영역이 작아질 때만 ⋯(오버플로)로 접힌다 — 다른 헤더(트리/트랜잭션 툴바)의
        //     U4AUI.attachOverflow 패턴과 동일(아래 attachOverflow 참조). ⋯ 는 상시 버튼이 아니라
        //     폭이 모자랄 때만 나타난다.
        //   클릭 시 attrPresetPopup(별도 Electron 창, sap 무관) 을 직접 연다.
        var PRE = document.createElement("button");
        PRE.type = "button";
        PRE.id = "ws20AttrPresetBtn";
        PRE.className = "u4aWs20AttrTbBtn";
        PRE.title = _wsMsg("652", "UI Attribute Personalization List");
        PRE.innerHTML = '<i class="fa-solid fa-user-gear"></i><span>' + _wsMsg("652", "UI Attribute Personalization List") + '</span>';
        PRE.addEventListener("click", function () {
            try {
                var sPath = parent.PATH.join(oAPP.oDesign.pathInfo.designRootPath, "attrPresetPopup", "index.js");
                parent.require(sPath)(parent.REMOTE, oAPP);
            } catch (e) {
                console.error("[HTML5][WS20] UI Attribute Personalization List 오픈 실패:", e);
            }
        });
        TBR.appendChild(PRE);

        //B39 Help — 도움말 버튼 [가드]
        var HLP = document.createElement("button");
        HLP.type = "button";
        HLP.id = "ws20AttrHelpBtn";
        HLP.className = "u4aWs20AttrTbBtn";
        HLP.title = _msg("B39", "Help");
        HLP.innerHTML = '<i class="fa-solid fa-circle-question"></i>';
        HLP.addEventListener("click", function () {
            console.warn("[W4+ 예정] Attribute Help 팝업(callTooltipsPopup/U4A Help) 미변환");
        });
        TBR.appendChild(HLP);

        //반응형 오버플로 — 폭이 충분하면 버튼으로, 좁아지면 ⋯ 메뉴로 접는다(사용자 요청).
        //   스페이서(.u4aWs20AttrTbSpacer)는 측정/숨김 제외(isSkip), 우측정렬이라 ⋯ auto-margin 끔.
        //   ⋯ 메뉴 라벨은 기본 btnLabel(span 텍스트 우선, 아이콘 버튼은 title 폴백)로 추출.
        try {
            if (window.U4AUI && window.U4AUI.attachOverflow) {
                _attrTbOvf = window.U4AUI.attachOverflow(TBR, {
                    btnClass: "u4aWs20AttrTbBtn",
                    noOvfAutoMargin: true,
                    isSkip: function (el) { return el.classList.contains("u4aWs20AttrTbSpacer"); }
                });
            }
        } catch (e) { console.warn("[HTML5][WS20][attr] toolbar overflow attach 실패:", e && e.message); }

        STICKY.appendChild(TBR);
        SCROLLER.appendChild(STICKY);

        // STICKY(셰브론+툴바) 실측 높이를 CSS 변수로 주입 → 그룹 헤더 sticky 가 그 아래에 붙는다.
        //   + 레이아웃 안정 후 오버플로 재계산(초기 0폭 측정으로 ⋯ 가 잘못 떠 있던 것 보정).
        function _attrSyncSticky() {
            try { oWrap.style.setProperty("--ws20-attr-stickyh", (STICKY.offsetHeight || 60) + "px"); } catch (e) { }
            try { if (_attrTbOvf) { _attrTbOvf.reflow(); } } catch (e) { }
        }
        try {
            requestAnimationFrame(function () { _attrSyncSticky(); _attrSyncChevron(); });
            setTimeout(_attrSyncSticky, 250);
        } catch (e) { _attrSyncSticky(); }

        /* ── (e) 속성 행 스크롤 영역 ──
         *   (구 정적 "Properties" 섹션 바는 제거 — 원본처럼 그룹 헤더(Properties/Events/
         *    Aggregations, sticky)만으로 구분. 섹션 바는 그룹 헤더와 "Properties" 중복이었음) */
        var ROWS = document.createElement("div");
        ROWS.id = "ws20AttrRows";
        ROWS.className = "u4aWs20AttrRows";
        SCROLLER.appendChild(ROWS);

        oPane.appendChild(oWrap);

        return oWrap;

    } // end of _buildAttrSkeleton

    /************************************************************************
     * 헤더/입력영역 갱신 (/uiinfo 반영).
     ************************************************************************/
    function _renderAttrHeader() {

        var oUiInfo = (oAPP.attr.oModel && oAPP.attr.oModel.oData && oAPP.attr.oModel.oData.uiinfo) || {};

        var ICO = document.getElementById("ws20AttrHdrIcon");
        if (ICO) {
            if (oUiInfo.src) {
                ICO.src = oUiInfo.src;
                ICO.style.display = "";
            } else {
                ICO.style.display = "none";
            }
        }

        var TIT = document.getElementById("ws20AttrHdrTitle");
        if (TIT) {
            TIT.textContent = oUiInfo.OBJID || "";
            TIT.title = oUiInfo.OBJID || "";
        }

        var LIB = document.getElementById("ws20AttrHdrLib");
        if (LIB) {
            //vis01: UI Library & sample 표시 여부 (ROOT 면 숨김 — 원본과 동일)
            LIB.textContent = oUiInfo.UILIB || "";
            LIB.style.display = (oUiInfo.vis01 === true) ? "" : "none";
        }

        var SMP = document.getElementById("ws20AttrHdrSampleBtn");
        if (SMP) {
            SMP.style.display = (oUiInfo.vis01 === true) ? "" : "none";
        }

        var INP = document.getElementById("ws20AttrObjIdInp");
        if (INP) {
            INP.value = oUiInfo.OBJID || "";
            INP.title = oUiInfo.OBJID || "";
            //edit01 === false (ROOT/APP) → 변경 불가. /IS_EDIT false → 비활성.
            INP.readOnly = (oUiInfo.edit01 === false);
            INP.disabled = !_isEditMode();
        }

        var TXA = document.getElementById("ws20AttrDescTxa");
        if (TXA) {
            TXA.value = oUiInfo.DESC || "";
            TXA.disabled = !_isEditMode();
        }

        var RST = document.getElementById("ws20AttrResetBtn");
        if (RST) {
            //vis02: attribute 초기화 표시 여부 (ROOT/display 모드 숨김 — 원본과 동일)
            RST.style.display = (oUiInfo.vis02 === true) ? "" : "none";
        }

    } // end of _renderAttrHeader

    /************************************************************************
     * 속성 행 1건의 "값 컨트롤" 생성 — 원본 행 템플릿(oRInp2/oRCmb1/oRChk1/oRBtn1)
     *   의 visible 플래그(inp_visb/sel_visb/chk_visb/btn_visb) 분기 그대로.
     ************************************************************************/
    function _buildValueControl(sAttr) {

        var BOX = document.createElement("div");
        // [공통 컴포넌트] shell.css .u4a-field (트레일링 아이콘 입력) 소비.
        // u4aWs20AttrValBox 는 WS20 전용 사이즈(--field-icon/--field-edge) 오버라이드용.
        BOX.className = "u4aWs20AttrValBox u4a-field";

        var bEnabled = _isEditMode();

        /* (1) 텍스트 input (구 sap.m.Input value:{UIATV} editable:{edit}
               showValueHelp:{showF4} showClearIcon:true) */
        if (sAttr.inp_visb === true) {

            // 공통 팩토리(U4AUI.createField) — clear(X)/F4/data-trail/대문자 없이 텍스트 입력 단일화.
            //   inputClassName 으로 인라인 스타일(.u4aWs20AttrInp val) 유지, className 으로 WS20 사이즈 박스.
            // 편집 가능 = Change 모드(bEnabled) && 이 속성 편집 허용(sAttr.edit). 그 외엔 비활성.
            //   ★ 비활성은 disabled(흐릿/opacity) 대신 readOnly 사용 — USP/공통과 동일(공통 .u4a-input:read-only
            //     = --app-bg 박스 + muted). Display 모드 값도 선택·복사 가능. clear/F4 는 편집 가능할 때만.
            var bFieldEdit = (bEnabled && sAttr.edit === true);
            var bHasClear = bFieldEdit;
            var oValFld = window.U4AUI.createField({
                type: "text",
                value: sAttr.UIATV != null ? sAttr.UIATV : "",
                readOnly: !bFieldEdit,
                className: "u4aWs20AttrValBox",
                inputClassName: "u4aWs20AttrInp val",
                clear: bHasClear,
                onClear: function () { sAttr.UIATV = ""; oAPP.fn.fnWs20AttrChange(sAttr, "INPUT"); },
                f4: (sAttr.showF4 === true) ? function () { console.warn("[W4+ 예정] F4 Value Help(attrCallValueHelp) 미변환:", sAttr.UIATT); } : null,
                f4IconHtml: '<i class="fa-regular fa-clone"></i>',   // F4=아웃라인 clone(복사버튼과 구분, 2026-06-17)
                f4Disabled: !bFieldEdit,
                onChange: function (v) { sAttr.UIATV = v; oAPP.fn.fnWs20AttrChange(sAttr, "INPUT"); }
            });
            oValFld.input.title = oValFld.input.value;
            if (sAttr.valst === "Error") { oValFld.input.classList.add("err"); oValFld.input.title = sAttr.valtx || oValFld.input.value; }
            return oValFld.el;
        }

        /* (2) DDLB (구 sap.m.ComboBox items:{T_DDLB} value:{comboval}/selectedKey)
               [공통 UX] ServerList/Login 과 동일한 U4AUI.createSelect 커스텀 드롭다운(.u4a-combo)
               사용 — 네이티브 <select> 금지(테마/펼침목록 통일). */
        if (sAttr.sel_visb === true) {

            var aDDLB = Array.isArray(sAttr.T_DDLB) ? sAttr.T_DDLB : [];
            var sVal = sAttr.UIATV != null ? sAttr.UIATV : "";
            var bDisabled = !bEnabled || (sAttr.edit !== true);

            // {value,text} 변환 (구 KEY/TEXT). 현재 값이 목록에 없으면 표시 보장용 선두 추가.
            var aItems = [];
            var bFound = false;
            for (var i = 0; i < aDDLB.length; i++) {
                if (aDDLB[i].KEY === sAttr.UIATV) { bFound = true; }
                aItems.push({
                    value: aDDLB[i].KEY != null ? aDDLB[i].KEY : "",
                    text: aDDLB[i].TEXT != null ? aDDLB[i].TEXT : ""
                });
            }
            if (!bFound) { aItems.unshift({ value: sVal, text: sVal }); }

            function _onPick(v) {
                sAttr.UIATV = v;
                sAttr.comboval = v;
                oAPP.fn.fnWs20AttrChange(sAttr, "DDLB");
            }

            // 이벤트 DDLB(UIATY="2")는 "펼치기 직전" 최신 서버이벤트 목록을 받아 채운다.
            //   (원본 uiAttributeArea.js oRSel1 combobox click 로직 — getServerEventList →
            //    T_DDLB 매핑 → open. 다른 창/이 화면 녹색아이콘으로 추가된 이벤트가 즉시 반영.)
            var oSelOpts = null;
            if (sAttr.UIATY === "2" && !bDisabled) {
                oSelOpts = {
                    onOpen: function (oCombo) {
                        // getServerEventList 가 반환하는 Promise 는 성공/실패/에러 전 경로에서
                        //   lt_ddlb 로 resolve 되므로 콜백 대신 반환 Promise 를 쓴다(미해결 방지).
                        return oAPP.fn.getServerEventList(null, false).then(function (aDdlb) {
                            aDdlb = aDdlb || [{ KEY: "", TEXT: "", DESC: "" }];
                            //서버이벤트 항목 매핑(원본 _sAttr.T_DDLB = _aEvent).
                            sAttr.T_DDLB = aDdlb;
                            var aNew = [], bHas = false;
                            for (var k = 0; k < aDdlb.length; k++) {
                                if (aDdlb[k].KEY === sAttr.UIATV) { bHas = true; }
                                aNew.push({
                                    value: aDdlb[k].KEY != null ? aDdlb[k].KEY : "",
                                    text: aDdlb[k].TEXT != null ? aDdlb[k].TEXT : ""
                                });
                            }
                            //현재 선택값이 목록에 없으면 표시 보장용 선두 추가(원본은 오류표시 — 여기선 값 유지).
                            if (!bHas && sAttr.UIATV) { aNew.unshift({ value: sAttr.UIATV, text: sAttr.UIATV }); }
                            oCombo.setItems(aNew);
                        }).catch(function (e) {
                            console.error("[HTML5][WS20][attr] 서버이벤트 목록 조회 실패:", e && e.message);
                        });
                    }
                };
            }

            if (window.U4AUI && typeof U4AUI.createSelect === "function") {
                var SEL = U4AUI.createSelect(aItems, sVal, _onPick, oSelOpts);
                SEL.classList.add("u4aWs20AttrCombo");
                if (bDisabled) { SEL.classList.add("is-disabled"); SEL.setAttribute("aria-disabled", "true"); SEL.tabIndex = -1; }
                BOX.appendChild(SEL);
                return BOX;
            }

            // (폴백) U4AUI 미로드 시에만 네이티브 select
            var SELN = document.createElement("select");
            SELN.className = "u4aWs20AttrSel";
            SELN.disabled = bDisabled;
            aItems.forEach(function (it) {
                var OPT = document.createElement("option");
                OPT.value = it.value; OPT.textContent = it.text;
                SELN.appendChild(OPT);
            });
            SELN.value = sVal;
            SELN.addEventListener("change", function () { _onPick(SELN.value); });
            BOX.appendChild(SELN);
            return BOX;
        }

        /* (3) 체크박스 (구 sap.m.CheckBox selected:{UIATV_c}) */
        if (sAttr.chk_visb === true) {

            var CHK = document.createElement("input");
            CHK.type = "checkbox";
            CHK.className = "u4aWs20AttrChk";
            CHK.checked = (sAttr.UIATV_c === true);
            CHK.disabled = !bEnabled || (sAttr.edit !== true);
            CHK.addEventListener("change", function () {
                //체크박스 변경 이벤트 (원본 oRChk1 select → attrChange(_sAttr,"CHECK"))
                sAttr.UIATV_c = CHK.checked;
                oAPP.fn.fnWs20AttrChange(sAttr, "CHECK");
            });
            BOX.appendChild(CHK);
            return BOX;
        }

        /* (4) 팝업 호출형 버튼 (구 sap.m.Button text:{btn_text} icon:{btn_icon}
               type:{btn_type} — Attention=노란 테두리. CSS Link Add 등) [가드] */
        if (sAttr.btn_visb === true) {

            var BTN = document.createElement("button");
            BTN.type = "button";
            BTN.className = "u4aWs20AttrPopBtn" +
                ((sAttr.btn_type === "Attention") ? " attention" : "");
            BTN.disabled = !bEnabled;

            BTN.innerHTML = _iconHtml(sAttr.btn_icon, "up-right-from-square");
            var sBtnTxt = sAttr.btn_text || sAttr.UIATT || "";
            if (sBtnTxt) {
                var SP = document.createElement("span");
                SP.textContent = sBtnTxt;
                SP.style.marginLeft = "4px";
                BTN.appendChild(SP);
            }
            BTN.title = sAttr.UIATT || "";

            BTN.addEventListener("click", function () {
                //팝업 호출형(CSS Link Add/JS Link Add/Web Security Settings 등) — W4+ 예정.
                console.warn("[W4+ 예정] 팝업 호출형 속성 버튼 미변환:", sAttr.UIATT, "(", sAttr.UIATK, ")");
            });

            BOX.appendChild(BTN);
            return BOX;
        }

        //표시 컨트롤이 없는 행(전부 invisible) — 빈 영역.
        return BOX;

    } // end of _buildValueControl

    /************************************************************************
     * 아이콘 셀(40px ×2 — 구 oRCol3/oRCol4) 1개 생성. 클릭은 W4+ 가드.
     ************************************************************************/
    function _buildIconCell(sAttr, iNo) {

        var CELL = document.createElement("div");
        CELL.className = "u4aWs20AttrRowIc";

        var bVisb = sAttr["icon" + iNo + "_visb"] === true;
        var sSrc = sAttr["icon" + iNo + "_src"];

        if (!bVisb || !sSrc) { return CELL; }

        var BTN = document.createElement("button");
        BTN.type = "button";
        BTN.className = "u4aWs20AttrIcBtn";
        BTN.innerHTML = _iconHtml(sSrc, "circle");
        BTN.title = sAttr["icon" + iNo + "_ttip"] || "";

        var sColor = sAttr["icon" + iNo + "_color"];
        if (sColor) { BTN.style.color = sColor; }

        BTN.addEventListener("click", function () {
            //이벤트 행(UIATY="2")의 icon1(녹색 developer-settings) = 서버이벤트 생성 팝업.
            //  (원본 attrIcon1Proc → attrCallEventPopup → createEventPopup 경로 중 이벤트 케이스.)
            if (sAttr.UIATY === "2" && iNo === 1) {
                try {
                    //원본 attrIcon1Proc 진입부: 오류 표현 필드 초기화 후 이벤트 팝업 호출.
                    if (typeof oAPP.fn.attrClearErrorField === "function") { oAPP.fn.attrClearErrorField(true); }
                    oAPP.fn.attrCallEventPopup(sAttr);
                } catch (e) { console.error("[HTML5][WS20][attr] 서버이벤트 생성 호출 오류:", e && e.message); }
                return;
            }
            //그 외(바인딩 팝업/F4/클라이언트이벤트<syntax> 등) 구 attrIcon1Proc/attrIcon2Proc — W4+ 예정.
            console.warn("[W4+ 예정] 속성 아이콘 동작 미변환:", sAttr.UIATT, "icon" + iNo, sSrc);
        });

        CELL.appendChild(BTN);
        return CELL;

    } // end of _buildIconCell

    /************************************************************************
     * [PUBLIC] 속성 행 목록 렌더 (그룹 헤더 + 행).
     *   Show Changed Items 토글(sAttrFilt.press) 시 변경 행만 표시
     *   (changedDataFilter 의 단순 필터 대체 — _isChangedRow 판정).
     ************************************************************************/
    oAPP.fn.fnRenderWs20AttrRows = function () {

        var ROWS = document.getElementById("ws20AttrRows");
        if (!ROWS) { return; }

        ROWS.innerHTML = "";

        var aAttr = (oAPP.attr.oModel && oAPP.attr.oModel.oData && oAPP.attr.oModel.oData.T_ATTR) || [];

        var sFilt = (oAPP.attr.oModel && oAPP.attr.oModel.oData && oAPP.attr.oModel.oData.sAttrFilt) || { press: false };

        // 빈 상태 메시지 헬퍼 — 구 sap 테이블 noData 대체.
        //   텍스트는 서버 메시지 클래스 단일 출처: ZMSG_WS_COMMON_001 번호 312
        //   ("데이터를 찾을 수 없습니다." / fnMimePopupOpen 에서도 쓰는 코드). 하드코딩 아님.
        function _attrEmpty() {
            var EMPTY = document.createElement("div");
            EMPTY.className = "u4aWs20AttrEmpty";
            EMPTY.textContent = _wsMsg("312");
            ROWS.appendChild(EMPTY);
        }

        //데이터 자체가 없을 때(미선택/LIB 미로딩) — "데이터 없음" 표시.
        if (aAttr.length === 0) {
            _attrEmpty();
            return;
        }

        var sPrevUIATY = null;
        var iRendered = 0;

        for (var i = 0, l = aAttr.length; i < l; i++) {

            var sAttr = aAttr[i];

            var bChanged = _isChangedRow(sAttr);

            //Show Changed Items 필터 — 변경 행만 표시.
            if (sFilt.press === true && bChanged !== true) { continue; }

            //그룹 헤더 (구 Sorter group: attrUIATYDesc)
            if (sAttr.UIATY !== sPrevUIATY) {
                sPrevUIATY = sAttr.UIATY;
                var sGrp = oAPP.fn.attrUIATYDesc(sAttr.UIATY);
                if (sGrp) {
                    var GH = document.createElement("div");
                    GH.className = "u4aWs20AttrGroupHdr";
                    GH.textContent = sGrp;
                    ROWS.appendChild(GH);
                }
            }

            var ROW = document.createElement("div");
            ROW.className = "u4aWs20AttrRow" + (bChanged ? " changeValue" : "");
            ROW.setAttribute("data-uiatk", sAttr.UIATK || "");
            ROW.setAttribute("data-uiaty", sAttr.UIATY || "");

            //── 라벨 셀 (구 oRObjStat1 + 필수 아이콘 oRIcon0) ──
            var LBL = document.createElement("div");
            LBL.className = "u4aWs20AttrRowLbl";
            LBL.title = sAttr.UIATT || "";

            if (sAttr.icon0_visb === true) {
                var REQ = document.createElement("span");
                REQ.className = "u4aWs20AttrReqIcon";
                REQ.innerHTML = _iconHtml(sAttr.icon0_src, "star");
                if (sAttr.icon0_color) { REQ.style.color = sAttr.icon0_color; }
                LBL.appendChild(REQ);
            }

            // 라벨 = <a>(링크) — "클릭하면 설명(도움말) 팝업"이라는 의미에 맞고, shell.css 의
            //   a:hover{text-decoration:underline} 를 그대로 타 hover 밑줄이 확실히 뜬다(span 보다 견고).
            //   href 는 두지 않아 네비게이션 없음(클릭은 LBL 셀 위임 핸들러가 처리).
            var LTX = document.createElement("a");
            LTX.className = "u4aWs20AttrLblTxt";
            LTX.textContent = sAttr.UIATT || "";
            LBL.appendChild(LTX);
            //라벨 셀 클릭 — 구 ObjectStatus press(설명글 팝업 callAttrDescPopup). 짧은 라벨의
            //  우측 여백까지 포함해 **라벨 셀 전체**를 클릭 영역으로(hover 밑줄 어포던스와 일치).
            //  팝업 앵커는 텍스트(LTX)로 두어 위치 정확. sAttr 는 var(함수 스코프)라 행별 캡처 IIFE.
            (function (oCell, oAnchor, oAttr) {
                oCell.addEventListener("click", function () {
                    try { oAPP.fn.callAttrDescPopup(oAnchor, oAttr); }
                    catch (e) { console.warn("[HTML5][WS20][attr] callAttrDescPopup 오류:", e && e.message); }
                });
            })(LBL, LTX, sAttr);

            ROW.appendChild(LBL);

            //── 값 셀 ──
            var VAL = document.createElement("div");
            VAL.className = "u4aWs20AttrRowVal";
            VAL.appendChild(_buildValueControl(sAttr));
            ROW.appendChild(VAL);

            //── 아이콘 셀 ×2 (구 40px 컬럼 — 바인딩/help) ──
            ROW.appendChild(_buildIconCell(sAttr, 1));
            ROW.appendChild(_buildIconCell(sAttr, 2));

            ROWS.appendChild(ROW);
            iRendered++;

        }

        // 필터(Show Changed Items) 적용 후 표시할 행이 0개일 때 — 빈 영역 대신 "데이터 없음" 안내.
        //   (변경된 항목 없음 = 일반 테이블 "데이터 없음" 과 동일 UX. 312 재사용)
        if (iRendered === 0) {
            _attrEmpty();
        }

    }; // end of oAPP.fn.fnRenderWs20AttrRows

    /************************************************************************
     * [PUBLIC] 속성 패널 전체 렌더 (골격 + 헤더 + 행).
     ************************************************************************/
    oAPP.fn.fnRenderWs20AttrPanel = function () {

        var oWrap = _buildAttrSkeleton();
        if (!oWrap) {
            // WS20 셸이 아직 안 그려졌으면 무시 (이후 진입 시 재호출됨)
            return;
        }

        _renderAttrHeader();
        oAPP.fn.fnRenderWs20AttrRows();

    }; // end of oAPP.fn.fnRenderWs20AttrPanel

    /************************************************************************
     * [PUBLIC] 속성 설명글 팝업 (구 design/js/callAttrDescPopup.js 1:1 이식)
     * ----------------------------------------------------------------------
     *  속성 라벨(구 sap.m.ObjectStatus) 클릭 → 해당 속성의 설명을 앵커형 팝업으로.
     *  · 설명 데이터: design/json/ATTR_DESC/{lang}/UI5_UI_DESCR.json (LIBNM+UIATT 매치)
     *  · 라이브러리명: T_0023/T_0022/T_0027 로 ATTR 의 소유 UI 라이브러리 역추적
     *    (상속 ISINH/EXT 예외 STYLECLASS·DRAGABLE·DROPABLE·DNDDROP 그대로 보존)
     *  · 제목: [TITLE1 = attrUIATYDesc(UIATY)] › [TITLE2 = UIATT (Type : UIADT)]
     *  · 본문: 원어(EN) 설명 + 세팅 언어가 EN 아니면 번역본 설명 (둘 다 read-only)
     *  UI 만 sap.m.ResponsivePopover → 순수 HTML5 팝오버로 대체, 데이터 로직은 동일.
     ************************************************************************/
    //description 원어(EN) — 원본 C_EN.
    var C_ATTR_DESC_EN = "EN";

    //ATTR DESC JSON 파일 경로 (원본 lf_getDescData 경로 구성).
    //  변환 셸이 미리 구한 designRootPath(.../ws30/ws10_20/design)를 우선 사용, 없으면 appPath 로 폴백.
    function _attrDescJsonPath(sLang) {
        try {
            var sRoot = oAPP.oDesign && oAPP.oDesign.pathInfo && oAPP.oDesign.pathInfo.designRootPath;
            if (sRoot) {
                return parent.PATH.join(sRoot, "json", "ATTR_DESC", sLang, "UI5_UI_DESCR.json");
            }
            return parent.PATH.join(parent.REMOTE.app.getAppPath(),
                "ws30", "ws10_20", "design", "json", "ATTR_DESC", sLang, "UI5_UI_DESCR.json");
        } catch (e) { return ""; }
    }

    //ATTR DESC JSON 에서 대상 DESC 검색 (원본 lf_getDescData 1:1).
    function _attrDescGetData(sLang, sLIBNM, sUIATT) {
        try {
            var l_path = _attrDescJsonPath(sLang);
            if (!l_path || parent.FS.existsSync(l_path) !== true) { return; }
            var l_json = parent.require(l_path);
            if (!l_json) { return; }
            return l_json.find(function (a) { return a.LIBNM === sLIBNM && a.UIATT === sUIATT; });
        } catch (e) { return; }
    }

    //라이브러리명 검색 (원본 lf_getLibraryName 1:1 — DB 미로딩 시 안전 가드).
    function _attrDescLibName(is_attr) {
        try {
            //ROOT는 ROOT의 OBJECT ID를 RETURN.
            if (is_attr.OBJID === "ROOT") { return is_attr.OBJID; }

            var LIB = oAPP.DATA && oAPP.DATA.LIB;
            if (!LIB || !Array.isArray(LIB.T_0023)) { return; }

            var l_UIATK = is_attr.UIATK;
            var l_UIATY = is_attr.UIATY;
            var l_UIOBK = is_attr.UIOBK;

            //직접 입력이 가능한 AGGREGATION 인 경우.
            if (l_UIATK.indexOf("_1") !== -1) {
                l_UIATK = l_UIATK.replace("_1", "");
                l_UIATY = "3";
            }

            //선택 ATTR 의 DB 정보 검색.
            var ls_0023 = LIB.T_0023.find(function (a) { return a.UIATK === l_UIATK; });
            if (!ls_0023) { return; }

            //Embedded Aggregations 인 경우.
            if (is_attr.UIATY === "6") {
                l_UIATY = "3";
                l_UIOBK = ls_0023.UIOBK;
            }

            //EXTENSION PROPERTY 예외 (styleClass / dragAble / dropAble / DnDDrop).
            if (ls_0023.UIASN === "STYLECLASS" && ls_0023.ISEXT === "X") { return "sap.ui.core.Control"; }
            if (ls_0023.UIASN === "DRAGABLE" && ls_0023.ISEXT === "X") { return "sap.m.NavContainer"; }
            if (ls_0023.UIASN === "DROPABLE" && ls_0023.ISEXT === "X") { return "sap.m.NavContainer"; }
            if (ls_0023.UIASN === "DNDDROP" && ls_0023.ISEXT === "X") { return "sap.m.NavContainer"; }

            //현재 UI 정보 검색.
            if (!Array.isArray(LIB.T_0022)) { return; }
            var ls_0022 = LIB.T_0022.find(function (a) { return a.UIOBK === l_UIOBK; });
            if (!ls_0022) { return; }

            //ATTR 정보가 자신 UI 것인 경우(상속 아님) — 자신 UI 라이브러리명 RETURN.
            if (ls_0023.ISINH === "") { return ls_0022.LIBNM; }

            //부모 UI 정보 얻기.
            if (!Array.isArray(LIB.T_0027)) { return; }
            var lt_parent = LIB.T_0027.filter(function (a) { return a.TGOBJ === l_UIOBK && a.TOBTY === "3"; });
            if (lt_parent.length === 0) { return; }

            //부모 UI 를 탐색하며 ATTR 의 주인 확인.
            var ls_0023t;
            for (var i = 0, l = lt_parent.length; i < l; i++) {
                var sSGOBJ = lt_parent[i].SGOBJ;
                ls_0023t = LIB.T_0023.find(function (a) {
                    return a.UIATT === is_attr.UIATT && a.UIOBK === sSGOBJ && a.UIATY === l_UIATY && a.ISINH === "";
                });
                if (ls_0023t) { break; }
            }
            if (!ls_0023t) { return; }

            var ls_0022p = LIB.T_0022.find(function (a) { return a.UIOBK === ls_0023t.UIOBK; });
            if (!ls_0022p) { return; }

            return ls_0022p.LIBNM;
        } catch (e) {
            console.warn("[HTML5][WS20][attr] 라이브러리명 탐색 오류:", e && e.message);
            return;
        }
    }

    //"설명 없음" 에러 — 원본: 196 &1 does not exist. (&1 = A35 Description). parent.showMessage 가드.
    function _attrDescErrNotExist() {
        try {
            parent.showMessage(sap, 10, "E",
                APPCOMMON.fnGetMsgClsText("/U4A/MSG_WS", "196",
                    APPCOMMON.fnGetMsgClsText("/U4A/CL_WS_COMMON", "A35", "", "", "", ""), "", "", ""));
        } catch (e) {
            console.warn("[HTML5][WS20][attr] 속성 설명 없음(196):", e && e.message);
        }
    }

    //설명 팝업 DOM 구성 + 앵커 위치 + 닫기(X/바깥클릭/ESC).
    function _attrDescBuildPopup(oAnchor, sTitle1, sTitle2, sLeft, sRight) {
        var oOld = document.getElementById("ws20AttrDescPop");
        if (oOld) { try { oOld.remove(); } catch (e) { } }

        var POP = document.createElement("div");
        POP.id = "ws20AttrDescPop";
        POP.className = "u4aWs20DescPop";

        //── 헤더: breadcrumb 제목(구 sap.m.Breadcrumbs) + 닫기 버튼 ──
        var HD = document.createElement("div");
        HD.className = "u4aWs20DescHd";

        var CRUMB = document.createElement("div");
        CRUMB.className = "u4aWs20DescCrumb";
        if (sTitle1) {
            var L1 = document.createElement("span");
            L1.className = "u4aWs20DescCrumbLink";
            L1.textContent = sTitle1;
            CRUMB.appendChild(L1);
            var SEP = document.createElement("span");
            SEP.className = "u4aWs20DescCrumbSep";
            SEP.textContent = ">";   // 구 separatorStyle:"GreaterThan"
            CRUMB.appendChild(SEP);
        }
        var L2 = document.createElement("span");
        L2.className = "u4aWs20DescCrumbCur";
        L2.textContent = sTitle2;
        CRUMB.appendChild(L2);
        HD.appendChild(CRUMB);

        var X = document.createElement("button");
        X.type = "button";
        X.className = "u4aWs20DescX";
        X.title = _msg("A39", "Close");
        X.innerHTML = '<i class="fa-solid fa-xmark"></i>';
        HD.appendChild(X);
        POP.appendChild(HD);

        //── 본문: 원어/번역 설명 textarea (구 read-only TextArea ×2) ──
        var BODY = document.createElement("div");
        BODY.className = "u4aWs20DescBody";
        if (sLeft !== "") {
            var TA1 = document.createElement("textarea");
            TA1.className = "u4aWs20DescArea";
            TA1.readOnly = true;
            TA1.value = sLeft;
            BODY.appendChild(TA1);
        }
        if (sRight !== "") {
            var TA2 = document.createElement("textarea");
            TA2.className = "u4aWs20DescArea";
            TA2.readOnly = true;
            TA2.value = sRight;
            BODY.appendChild(TA2);
        }
        POP.appendChild(BODY);

        document.body.appendChild(POP);

        //위치 — 속성 목록을 가리지 않도록 **속성 패널 왼쪽 바깥(미리보기 위)**에 띄우고, 클릭한 라벨과
        //  세로로 정렬한다. (구: 라벨 바로 아래라 아래 속성들을 가려 위→아래 연속 클릭이 불가했음.)
        //  ★ 한 번만 계산하면 창 전체화면 전환/리사이즈/스크롤 때 앵커(라벨)가 옮겨가 위치가 어긋난다 →
        //    _position() 으로 분리해 resize/scroll 마다 앵커 기준 재계산(UI5 ResponsivePopover 동일).
        function _position() {
            try {
                //앵커(라벨)가 사라졌으면(행 재렌더 등) 닫는다 — 엉뚱한 위치로 튀는 것 방지.
                if (!oAnchor || !document.body.contains(oAnchor)) { _close(); return; }

                var r = oAnchor.getBoundingClientRect();
                var oAttrPane = document.querySelector(".u4aWsDesignAttr");
                var rPane = oAttrPane ? oAttrPane.getBoundingClientRect() : null;

                var iLeft, iTop;
                if (rPane && (rPane.left - POP.offsetWidth - 8) >= 6) {
                    // 패널 왼쪽 바깥에 충분한 공간 → 거기에(목록 안 가림)
                    iLeft = rPane.left - POP.offsetWidth - 8;
                    iTop = r.top;                       // 클릭한 라벨과 세로 정렬
                } else {
                    // 폴백: 왼쪽 공간 부족 → 화면 왼쪽 가장자리(여전히 속성 목록은 거의 안 가림)
                    iLeft = 6;
                    iTop = r.top;
                }
                // 화면 안으로 클램프
                if (iLeft < 6) { iLeft = 6; }
                if (iTop + POP.offsetHeight > window.innerHeight - 6) {
                    iTop = Math.max(6, window.innerHeight - POP.offsetHeight - 6);
                }
                if (iTop < 6) { iTop = 6; }
                POP.style.left = iLeft + "px";
                POP.style.top = iTop + "px";
            } catch (e) { }
        }

        function _close() {
            document.removeEventListener("mousedown", _onOutside, true);
            document.removeEventListener("keydown", _onEsc, true);
            window.removeEventListener("resize", _position);
            window.removeEventListener("scroll", _position, true);
            try { POP.remove(); } catch (e) { }
        }
        function _onOutside(ev) {
            if (ev.target.closest && ev.target.closest("#ws20AttrDescPop")) { return; }
            _close();
        }
        function _onEsc(ev) { if (ev.key === "Escape") { ev.stopPropagation(); _close(); } }

        //초기 배치 + 창 리사이즈/스크롤 추적(전체화면 전환 시 위치 어긋남 방지). scroll 은 capture 로
        //  내부 스크롤러(.u4aWs20AttrScroller)까지 잡는다(스크롤 이벤트는 버블 안 하므로 capture 필요).
        _position();
        window.addEventListener("resize", _position);
        window.addEventListener("scroll", _position, true);

        X.addEventListener("click", _close);
        //여는 클릭의 잔여 이벤트가 즉시 닫지 않도록 다음 틱에 바깥클릭/ESC 리스너 부착(Find 팝업과 동일).
        //  미리보기(iframe) 클릭 닫기는 전역(u4a-ui.js _installIframeBlurClose)이 합성 mousedown 으로 처리.
        setTimeout(function () {
            document.addEventListener("mousedown", _onOutside, true);
            document.addEventListener("keydown", _onEsc, true);
        }, 0);
    }

    oAPP.fn.callAttrDescPopup = function (oUi, is_attr) {
        //openBy 대상 UI/속성정보 없으면 종료(원본 동일).
        if (!oUi || !is_attr) { return; }

        //대상 attribute 의 라이브러리명 탐색 — 못 찾으면 "설명 없음"(196).
        var l_LIBNM = _attrDescLibName(is_attr);
        if (!l_LIBNM) { _attrDescErrNotExist(); return; }

        //원어(EN) DESC 검색.
        var ls_desc1 = _attrDescGetData(C_ATTR_DESC_EN, l_LIBNM, is_attr.UIATT);
        var ls_desc2;

        //세팅 언어가 원어와 다르면 번역본 DESC 검색.
        var sGLangu = (oAPP.oDesign && oAPP.oDesign.settings && oAPP.oDesign.settings.GLANGU) || C_ATTR_DESC_EN;
        if (sGLangu !== C_ATTR_DESC_EN) {
            ls_desc2 = _attrDescGetData(sGLangu, l_LIBNM, is_attr.UIATT);
        }

        //두 언어 다 DESC 를 못 찾은 경우 — "설명 없음"(196).
        var sL = (ls_desc1 && ls_desc1.DESCR) ? ls_desc1.DESCR : "";
        var sR = (ls_desc2 && ls_desc2.DESCR) ? ls_desc2.DESCR : "";
        if (sL === "" && sR === "") { _attrDescErrNotExist(); return; }

        //제목 구성 — TITLE1 = 그룹명(Properties/Aggregations/Events/Associations), TITLE2 = UIATT (Type : UIADT).
        var sTitle1 = "";
        try { sTitle1 = oAPP.fn.attrUIATYDesc(is_attr.UIATY) || ""; } catch (e) { }
        var sTitle2 = is_attr.UIATT || "";
        if (is_attr.UIADT !== "" && is_attr.UIADT != null) {
            //A51 Type
            sTitle2 = sTitle2 + " (" + _msg("A51", "Type") + " : " + is_attr.UIADT + ")";
        }

        _attrDescBuildPopup(oUi, sTitle1, sTitle2, sL, sR);
    }; // end of oAPP.fn.callAttrDescPopup

    /* ====================================================================
     * (8) [OVERRIDE] oAPP.fn.uiAttributeArea
     *   원본(design/js/uiAttributeArea.js 38행~): sap.f.DynamicPage(oRPage)에
     *   타이틀/헤더/sap.m.Table 을 구성. → HTML5 에선 #ws20DesignAttr 컨테이너에
     *   속성 패널 골격을 렌더한다. (oRPage 인자는 무시 — 셸이 컨테이너 보유)
     * ==================================================================== */
    oAPP.fn.uiAttributeArea = function (oRPage) {

        //attr table 인스턴스 호환 더미 (원본 oAPP.attr.ui.oRTab1 사용처 크래시 방지).
        oAPP.attr.ui = oAPP.attr.ui || {};
        oAPP.attr.ui.oRTab1 = oAPP.attr.ui.oRTab1 || {
            __html5: true,
            removeSelections: function () { },
            getItems: function () { return []; },
            getBinding: function () { return null; }
        };

        try {
            oAPP.fn.fnRenderWs20AttrPanel();
        } catch (e) {
            console.warn("[HTML5][WS20][attr] uiAttributeArea render error:", e && e.message);
        }

    }; // end of [OVERRIDE] oAPP.fn.uiAttributeArea

    /************************************************************************
     * [OVERRIDE] WS20 셸 렌더 — 셸(W1)+트리(W3) 렌더 후 속성 패널 골격 렌더.
     ************************************************************************/
    var _fnRenderWs20Shell_super = oAPP.fn.fnRenderWs20Shell;

    oAPP.fn.fnRenderWs20Shell = function () {

        // W1 셸 + W3 트리 렌더 위임.
        if (typeof _fnRenderWs20Shell_super === "function") {
            _fnRenderWs20Shell_super();
        }

        // 우측 속성 패널 골격 렌더 (구 placeholder "속성 — W4 예정" 대체).
        try {
            oAPP.fn.uiAttributeArea(oAPP.attr.ui && oAPP.attr.ui.ws20 && oAPP.attr.ui.ws20.attr);
        } catch (e) {
            console.warn("[HTML5][WS20][attr] fnRenderWs20Shell→uiAttributeArea error:", e && e.message);
        }

    }; // end of [OVERRIDE] oAPP.fn.fnRenderWs20Shell

    /************************************************************************
     * [정리 — 문서 정합]
     *  · (구) fnLoadWs20TreeData 를 LIB 로드로 감싸는 override 는 제거됨.
     *    진입 분기는 문서 4장 그대로 oAPP.fn.setUIAreaEditable(ws_html5_ws20_data.js)
     *    이 수행한다: (4.2) LIB 有 → getAppData / (4.3) LIB 無 → fnLoadWs20LibData
     *    → getAppData. (fnLoadWs20LibData 는 본 파일 ★(3) 절에 유지)
     *
     *  · (구) 트리 렌더 직후 ROOT 자동선택 override 는 제거됨.
     *    ROOT/첫 라인 기본 선택은 문서 6.2 의 공식 경로로만 수행된다:
     *    loadPreviewFrame → 미리보기 로드 완료(drawPreview 후) →
     *    oLTree1.fireCellClick(트리 첫 라인) (preview/index.js 2541행 /
     *    uiPreviewArea.js 157~167행) → W2 의 oLTree1 스텁이
     *    fnWs20TreeSelectRow 로 매핑.
     *    (※ 미리보기 로드 "전"의 자동선택은 prev[OBJID] 스탠드인이 prev 를
     *       오염시켜 iframe drawPreview 의 재그리기 분기(T_0015 교체)를 유발
     *       — 자식 UI 미표시의 근원이었음)
     ************************************************************************/

})(window, (window.jQuery || window.$), oAPP);
