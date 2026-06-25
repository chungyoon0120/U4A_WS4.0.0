/************************************************************************
 * Copyright 2020. INFOCG Inc. all rights reserved.
 * ----------------------------------------------------------------------
 * - file Name : fnSelectBrowserPopupOpen.js
 * - file Desc : 기본 브라우저 설정 팝업 (HTML5)
 * ----------------------------------------------------------------------
 * [컨버전 메모]
 *  원본: sap.m.Dialog + (VBox items="{/DEFBR}") Panel/Toolbar + RadioButton(기본
 *        브라우저, group="defaultBrowserRbg") + CheckBox(앱모드/APP_MODE) two-way 바인딩,
 *        footer Accept/Reject Button.
 *  HTML5: native <dialog class="u4a-dialog"> + 공통 컴포넌트. 로직 보존, UI만 교체:
 *    · 모델 적재(fnBrowserStateModelRefresh)·기본브라우저 비교(fnOnP13nExeDefaultBrowser)·
 *      P13N 저장(ev_selectBrowserSave 파일 write)은 원본 그대로(이미 sap 무관·HTML5-safe).
 *    · sap.m.RadioButton/CheckBox/two-way binding → <input type=radio|checkbox> + 모델 직접 동기.
 *    · 라디오 select 시 전체 APP_MODE=false(원본 동작)·비설치 비활성·DEV_BROWSER 숨김 동일.
 ************************************************************************/

(function (window, $, oAPP) {
    "use strict";

    const APPCOMMON = oAPP.common;
    const C_DLG_ID = "u4aSelBrwsDlg";

    var oSelUI = null; // { dlg, rows:[{data, radio, appChk, head, appWrap}] }

    function _txt(sCls, sCode, p1, p2, p3, p4) {
        try { return APPCOMMON.fnGetMsgClsText(sCls, sCode, p1 || "", p2 || "", p3 || "", p4 || ""); }
        catch (e) { return ""; }
    }
    function _wsTxt(nr) {
        try {
            var lg = (parent.getUserInfo() || {}).LANGU || "";
            var s = parent.WSUTIL.getWsMsgClsTxt(lg, "ZMSG_WS_COMMON_001", nr);
            if (s && s.indexOf("|") === -1) { return s; }
        } catch (e) { }
        return "";
    }
    function _el(sTag, sClass, sText) {
        var e = document.createElement(sTag);
        if (sClass) { e.className = sClass; }
        if (typeof sText !== "undefined") { e.textContent = sText; }
        return e;
    }
    var _fa = function (s) { return '<i class="fa-solid fa-' + s + '"></i>'; };

    // NAME → 브랜드 아이콘(FontAwesome brands). 구 sap-icon://u4a-fw-brands/Chrome|Edge 대체.
    function _brandIco(sName) {
        switch (sName) {
            case "CHROME": return '<i class="fa-brands fa-chrome"></i>';
            case "MSEDGE": return '<i class="fa-brands fa-edge"></i>';
            default: return _fa("globe");
        }
    }

    function _ensureStyle() {
        if (document.getElementById("u4aSelBrwsStyle")) { return; }
        var o = document.createElement("style");
        o.id = "u4aSelBrwsStyle";
        o.textContent = ""
            + ".u4aSelBrwsDlg{width:min(92vw,420px);padding:0;display:flex;flex-direction:column;}"
            + ".u4aSelBrwsDlg .u4a-dialog__header{cursor:move;user-select:none;}"
            + ".u4aSelBrwsDlg .u4a-dialog__header span{flex:1 1 auto;}"
            + ".u4aSelBrwsBody{padding:.5rem 0;}"
            + ".u4aSelBrwsItem{padding:.625rem 0;}"
            + ".u4aSelBrwsItem + .u4aSelBrwsItem{border-top:.0625rem solid var(--line);}"
            + ".u4aSelBrwsHead{display:flex;align-items:center;gap:.75rem;padding:.375rem 1.25rem;cursor:pointer;}"
            + ".u4aSelBrwsHead.is-disabled{cursor:default;opacity:var(--disabled-opacity);}"
            + ".u4aSelBrwsHead input[type=radio]{width:1.15rem;height:1.15rem;accent-color:var(--accent);cursor:inherit;margin:0;flex:0 0 auto;}"
            + ".u4aSelBrwsBrand{width:1.5rem;text-align:center;font-size:1.2rem;color:var(--text);flex:0 0 auto;}"
            + ".u4aSelBrwsName{font-weight:600;color:var(--text);}"
            + ".u4aSelBrwsApp{display:flex;align-items:center;gap:.5rem;padding:.5rem 1.25rem .25rem 3.4rem;color:var(--text);cursor:pointer;}"
            + ".u4aSelBrwsApp input[type=checkbox]{width:1rem;height:1rem;accent-color:var(--accent);cursor:inherit;margin:0;flex:0 0 auto;}"
            + ".u4aSelBrwsApp.is-disabled{opacity:var(--disabled-opacity);cursor:default;}"
            + ".u4aSelBrwsFoot{display:flex;gap:.5rem;justify-content:flex-end;}";
        document.head.appendChild(o);
    }

    /************************************************************************
     * 기본 브라우저 설정 팝업 Open
     ************************************************************************/
    oAPP.fn.fnSelectBrowserPopupOpen = async function () {

        // busy 는 메뉴 핸들러(fnHmws)가 클릭 즉시 켠다(loadJs 지연까지 커버). 여기선 끝나거나 오류 시 해제만 담당.
        try {

        // 브라우저 설치 유무 등 상태 정보 모델(/DEFBR) 갱신 (원본 그대로 — HTML5-safe).
        await oAPP.fn.fnBrowserStateModelRefresh();

        var aDEFBR = APPCOMMON.fnGetModelProperty("/DEFBR") || [];

        _ensureStyle();

        // 이미 떠 있으면 제거 후 재생성(모델이 갱신되었을 수 있으므로 새로 그린다).
        var oOld = document.getElementById(C_DLG_ID);
        if (oOld) { try { oOld.close(); } catch (e) { } oOld.remove(); }

        var oDlg = document.createElement("dialog");
        oDlg.id = C_DLG_ID;
        oDlg.className = "u4a-dialog u4aSelBrwsDlg";

        // ── 헤더 (구 internet-browser 아이콘 + C99 Select Default Browser) ──
        var oHeader = _el("div", "u4a-dialog__header");
        oHeader.innerHTML = _fa("globe") + "<span></span>";
        oHeader.querySelector("span").textContent = _txt("/U4A/CL_WS_COMMON", "C99");
        var oX = _el("button", "u4a-btn-icon");
        oX.type = "button";
        oX.setAttribute("data-act", "close");
        oX.innerHTML = _fa("xmark");
        oX.title = _txt("/U4A/CL_WS_COMMON", "A39");
        oX.addEventListener("click", _close);
        oHeader.appendChild(oX);
        oDlg.appendChild(oHeader);

        // ── 바디 (브라우저 목록) ──
        var oBody = _el("div", "u4a-dialog__body u4aSelBrwsBody");
        oDlg.appendChild(oBody);

        var sAppModeTxt = _wsTxt("281"); // 앱모드 활성 (ZMSG_WS_COMMON_001 281)

        oSelUI = { dlg: oDlg, rows: [] };

        aDEFBR.forEach(function (oDef, iIdx) {

            // 개발 브라우저(DEV_BROWSER) 항목은 숨긴다(원본 visible formatter).
            if (oDef.NAME === "DEV_BROWSER") { return; }

            var oItem = _el("div", "u4aSelBrwsItem");

            // 헤더(라디오 + 브랜드 아이콘 + 이름) — 클릭 시 기본 브라우저로 선택.
            var oHead = _el("div", "u4aSelBrwsHead");
            var oRadio = document.createElement("input");
            oRadio.type = "radio";
            oRadio.name = "u4aSelBrwsRbg"; // 구 groupName: defaultBrowserRbg
            var oBrand = _el("span", "u4aSelBrwsBrand");
            oBrand.innerHTML = _brandIco(oDef.NAME);
            var oName = _el("span", "u4aSelBrwsName", oDef.DESC || oDef.NAME);
            oHead.appendChild(oRadio);
            oHead.appendChild(oBrand);
            oHead.appendChild(oName);
            oItem.appendChild(oHead);

            // 앱 모드 사용 체크박스(APP_MODE) — 설치 + 기본선택일 때만 활성.
            var oAppWrap = _el("label", "u4aSelBrwsApp");
            var oAppChk = document.createElement("input");
            oAppChk.type = "checkbox";
            oAppWrap.appendChild(oAppChk);
            oAppWrap.appendChild(_el("span", null, sAppModeTxt));
            oItem.appendChild(oAppWrap);

            oBody.appendChild(oItem);

            var oRow = { data: oDef, radio: oRadio, appChk: oAppChk, head: oHead, appWrap: oAppWrap };
            oSelUI.rows.push(oRow);

            // 기본 브라우저 선택(라디오 / 헤더 클릭) — 비설치면 무시.
            function _selectDefault() {
                if (oDef.ENABLED === false) { return; }
                oSelUI.rows.forEach(function (r) {
                    r.data.SELECTED = (r === oRow);
                    // 원본 라디오 select: 기본 브라우저 변경 시 전체 APP_MODE 초기화.
                    r.data.APP_MODE = false;
                });
                _persist();
                _syncUI();
            }
            oRadio.addEventListener("change", _selectDefault);
            oHead.addEventListener("click", function (e) {
                if (e.target === oRadio) { return; } // 라디오는 자체 change 로 처리
                _selectDefault();
            });

            // 앱 모드 토글.
            oAppChk.addEventListener("change", function () {
                if (oDef.ENABLED === false || oDef.SELECTED === false) { return; }
                oDef.APP_MODE = oAppChk.checked;
                _persist();
            });
        });

        // ── 푸터 (저장 / 닫기) ──
        var oFoot = _el("div", "u4a-dialog__footer u4aSelBrwsFoot");
        var oSave = _el("button", "u4a-btn u4a-btn--emphasized");
        oSave.type = "button";
        oSave.innerHTML = _fa("check");   // 아이콘만 (텍스트 라벨 제거)
        oSave.title = _txt("/U4A/CL_WS_COMMON", "A40"); // Confirm/확인
        oSave.addEventListener("click", oAPP.events.ev_selectBrowserSave);
        oFoot.appendChild(oSave);

        var oClose = _el("button", "u4a-btn u4a-btn--negative");
        oClose.type = "button";
        oClose.innerHTML = _fa("xmark");   // X 아이콘만 (텍스트 라벨 제거)
        oClose.title = _txt("/U4A/CL_WS_COMMON", "A39"); // Close
        oClose.addEventListener("click", oAPP.events.ev_selectBrowserClose);
        oFoot.appendChild(oClose);
        oDlg.appendChild(oFoot);

        oDlg.addEventListener("cancel", function (e) { e.preventDefault(); _close(); });
        // 헤더 드래그(화면 밖/상단 공통헤더 침범 방지) — 공통 유틸.
        if (window.U4AUI && U4AUI.makeDialogDraggable) { U4AUI.makeDialogDraggable(oDlg, oHeader); }

        document.body.appendChild(oDlg);
        _syncUI();
        oDlg.showModal();

        } finally {
            // 다이얼로그가 떴거나 도중 오류가 나도 busy 는 반드시 해제(showModal 직후/예외 시 즉시).
            oAPP.common.fnSetBusyLock("");
        }

    }; // end of oAPP.fn.fnSelectBrowserPopupOpen

    // 모델값 → DOM 상태 동기(체크/활성). 구 RadioButton/CheckBox enabled formatter 이식.
    function _syncUI() {
        if (!oSelUI) { return; }
        oSelUI.rows.forEach(function (r) {
            var bEnabled = (r.data.ENABLED !== false);
            var bSelected = (r.data.SELECTED === true);

            // 라디오: 설치된 경우만 활성, 비설치면 선택 해제.
            r.radio.disabled = !bEnabled;
            r.radio.checked = bEnabled && bSelected;
            r.head.classList.toggle("is-disabled", !bEnabled);

            // 앱 모드: 설치 + 기본선택일 때만 활성. 그 외엔 비활성 + 해제.
            var bAppEnabled = bEnabled && bSelected;
            if (!bAppEnabled) { r.data.APP_MODE = false; }
            r.appChk.disabled = !bAppEnabled;
            r.appChk.checked = (r.data.APP_MODE === true);
            r.appWrap.classList.toggle("is-disabled", !bAppEnabled);
        });
    }

    // 현재 행 데이터 → 모델 반영(원본 setProperty("/DEFBR")).
    function _persist() {
        if (!oSelUI) { return; }
        var a = oSelUI.rows.map(function (r) { return r.data; });
        // DEV_BROWSER 등 화면에 없는 항목도 모델에 보존되어야 하므로, 기존 배열을 갱신한다.
        var aModel = APPCOMMON.fnGetModelProperty("/DEFBR") || [];
        aModel.forEach(function (oDef) {
            var oFound = a.find(function (x) { return x.NAME === oDef.NAME; });
            if (oFound) { oDef.SELECTED = oFound.SELECTED; oDef.APP_MODE = oFound.APP_MODE; }
        });
        APPCOMMON.fnSetModelProperty("/DEFBR", aModel);
    }

    function _close() {
        var oDlg = document.getElementById(C_DLG_ID);
        if (!oDlg) { return; }
        try { oDlg.close(); } catch (e) { }
        try { oDlg.remove(); } catch (e) { }
    }
    // 헤더 드래그는 공통 U4AUI.makeDialogDraggable 사용(화면 밖/상단 헤더 클램프). 로컬 _attachDrag 제거.

    /************************************************************************
     * 기본 브라우저 저장 이벤트 (원본 로직 보존 — P13N json 에 DEFBR 기록)
     ************************************************************************/
    oAPP.events.ev_selectBrowserSave = function () {

        try {
            // 개인화 폴더 생성 및 로그인 사용자별 개인화 Object 만들기
            oAPP.fn.fnOnP13nFolderCreate();

            var FS = parent.FS,
                oServerInfo = parent.getServerInfo(),
                sSysID = oServerInfo.SYSID,
                sP13nPath = parent.getPath("P13N"),
                sP13nJsonData = FS.readFileSync(sP13nPath, "utf-8"),
                oP13nData = JSON.parse(sP13nJsonData);

            oP13nData[sSysID].DEFBR = APPCOMMON.fnGetModelProperty("/DEFBR");

            FS.writeFileSync(sP13nPath, JSON.stringify(oP13nData));

        } catch (e) {
            if (typeof console !== "undefined") { console.error("[WS] 기본 브라우저 저장 실패:", e); }
            return; // 저장 실패 시 팝업 유지
        }

        _close();

    }; // end of oAPP.events.ev_selectBrowserSave

    /************************************************************************
     * 기본 브라우저 선택 팝업 닫기
     ************************************************************************/
    oAPP.events.ev_selectBrowserClose = function () {
        _close();
    }; // end of oAPP.events.ev_selectBrowserClose

})(window, $, oAPP);
