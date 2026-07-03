/************************************************************************
 * fnAttrPresetSettingsOpen.js  (HTML5) — WS20 속성 컨텍스트 메뉴 M06 "UI Attribute 개인화"
 * ----------------------------------------------------------------------
 * 원본: design/attrPresetPopup/settings/index.js  export attrPresetPopup({sAttr})
 *       → dialogViewer(sap.m.HBox[ObjectStatus+값컨트롤], {title:627, actions:[OK(232,IS_EDIT)/CANCEL]}).
 *       한 개 속성의 현재 값을 "내 개인화 프리셋(기본값)"으로 SQLite 에 저장.
 *
 * HTML5: fnDumpWritePopupOpen 과 동일한 인앱 <dialog class="u4a-dialog"> + 공통 컴포넌트
 *        (U4AUI.createField/createSelect/.u4a-switch, makeDialogRecenter/Resizable). 공통 파일 미수정.
 *
 * ★ 보존 로직(원본 1:1):
 *   · clone = JSON deep copy(sParam.sAttr) — 편집은 clone 에서(원본 JSONModel /attr 복제).
 *   · 값 컨트롤 = 행과 동일 분기(inp_visb/sel_visb/chk_visb/btn_visb). 편집가능=IS_EDIT&&clone.edit.
 *   · 입력 변경 → _checkAttrValue(검증) + previewUIsetProp(미리보기, W2 미변환→가드).
 *   · Apply(OK, IS_EDIT 시만) = _checkAttrValue → _savePresetAttrData(SQLite upsert)
 *       → previewUIsetProp(원본값 복원) → 완료토스트(628) → 열린 list 창에 ATTR_CHANGE 브로드캐스트 → 닫기.
 *   · Cancel/Close = previewUIsetProp(원본값 복원) → 닫기(저장 안함).
 *   · 저장 DB = {P13N_ROOT}/UI_ATTR/UI_ATTR_PRESET.db (PK[LIBVER,SYSID,UNAME,UIATK]) — list 팝업과 동일.
 * ★ UI5 의존부 치환: dialogViewer→<dialog>, sap.m.*→공통 컴포넌트, previewUIsetProp→W2 가드.
 *   F4/컬러피커(값도움말)는 이 팝업에선 생략(개인화=값 입력, 필요시 W4+ 추가) — 행 입력칸에서 사용.
 ************************************************************************/

(function (window, $, oAPP) {
    "use strict";

    var APPCOMMON = oAPP.common;

    var C_DLG_ID = "u4aAttrPresetDlg";
    var C_ATTR_PRESET_POPUP = "ATTR_PRESET_POPUP";
    var TY_RES = { RETCD: "", RTMSG: "" };

    function _fa(s) { return '<i class="fa-solid fa-' + s + '"></i>'; }
    function _el(tag, cls, txt) {
        var o = document.createElement(tag);
        if (cls) { o.className = cls; }
        if (typeof txt !== "undefined") { o.textContent = txt; }
        return o;
    }
    // ZMSG_WS_COMMON_001 (원본이 쓰는 유일 클래스) — 워크스페이스 언어. 미조회 시 코드 반환.
    function _wsTxt(sCode, p1) {
        try {
            var L = (parent.getUserInfo && parent.getUserInfo().LANGU) || "";
            var s = parent.WSUTIL.getWsMsgClsTxt(L, "ZMSG_WS_COMMON_001", sCode, (p1 == null ? "" : p1));
            if (s && s.indexOf("|") === -1) { return s; }
        } catch (e) { }
        return sCode;
    }
    function _isEdit() {
        try { return oAPP.attr.oModel.oData.IS_EDIT === true; } catch (e) { return false; }
    }
    function _preview(sAttr) {
        //미리보기 반영(원본 previewUIsetProp) — W2 미변환이면 no-op.
        if (typeof oAPP.fn.previewUIsetProp === "function") {
            try { oAPP.fn.previewUIsetProp(sAttr); } catch (e) { console.error("[HTML5][WS20][preset] previewUIsetProp:", e && e.message); }
        }
    }

    // 단일 캐시 + 컨텍스트(여는 쪽이 넘긴 원본 행 + 편집용 clone).
    var oUI = null;
    var oCtx = { orig: null, clone: null };

    function lf_close() {
        try { if (oUI && oUI.dlg && oUI.dlg.open) { oUI.dlg.close(); } } catch (e) { }
    }

    /* ── 입력값 점검(원본 _checkAttrValue 1:1) ── */
    function _checkAttrValue(sAttr) {
        sAttr.valst = undefined;
        sAttr.valtx = undefined;
        var _sRes = { RETCD: "", RTMSG: "" };
        try {
            var _mod = parent.require(
                parent.PATH.join(oAPP.oDesign.pathInfo.designRootPath, "js", "checkAppData", "designTreeData.js"));
            var _err = _mod.checkPropertyValue(sAttr);
            if (_err && _err.RETCD === "E") { _sRes.RETCD = "E"; _sRes.RTMSG = _err.RTMSG; return _sRes; }
        } catch (e) { /* 점검 모듈 미로드 — skip */ }

        //chkValidProp 은 미리보기 frame(W2) 부재 시 UIADT 미보유 속성에서 예외가 날 수 있어 가드.
        //  (frame 없으면 원본도 undefined=판단보류 → 예외는 통과 처리, best-effort. 저장까지 막지 않는다.)
        try {
            if (typeof oAPP.fn.chkValidProp === "function" && oAPP.fn.chkValidProp(sAttr) === false) {
                _sRes.RETCD = "E";
                _sRes.RTMSG = _wsTxt("629");   //629 잘못된 값을 입력했습니다.
                return _sRes;
            }
        } catch (e) {
            console.error("[HTML5][WS20][preset] chkValidProp 예외(통과 처리):", e && e.message);
        }
        return _sRes;
    }

    // 값-상태(검증) — 공통 createField.setValueState 소비(빨간 테두리 상시 + .u4a-field__msg
    //   = circle-xmark 아이콘 + 틴트 박스, .u4a-form__row:focus-within 일때 노출 = UI5 valueStateText).
    //   오류 시 입력칸에 포커스를 줘 그 메시지 박스가 뜨게 한다(원본 동일).
    function lf_showValState(sRes) {
        var bErr = !!(sRes && sRes.RETCD === "E");
        if (oUI.field && oUI.field.setValueState) {
            oUI.field.setValueState(bErr ? "error" : "none", bErr ? (sRes.RTMSG || "") : "");
        }
        if (bErr && oUI.field && oUI.field.focus) { try { oUI.field.focus(); } catch (e) { } }
    }

    // sap-icon(UIATT_ICON) → FontAwesome (행 아이콘과 동일 계열). 미매핑은 아이콘 생략.
    function _uiattIconFa(sIcon) {
        var M = {
            "sap-icon://customize": "sliders",      //Properties
            "sap-icon://border": "bolt",            //Events
            "sap-icon://complete": "circle-check",  //Aggregation 0:1
            "sap-icon://color-fill": "fill-drip",   //Aggregation
            "sap-icon://dimension": "ruler-combined" //Aggregation 0:N
        };
        return (sIcon && M[sIcon]) || "";
    }

    // 입력 변경 공통(원본 _onChangeAttr) — 검증 후 미리보기 반영.
    function lf_onChange() {
        var _sRes = _checkAttrValue(oCtx.clone);
        lf_showValState(_sRes);
        if (_sRes.RETCD === "E") { return; }
        _preview(oCtx.clone);
    }

    /* ── 값 컨트롤 생성(행 _buildValueControl 분기와 동일하나 clone 편집 전용, 실모델 커밋 없음) ── */
    function lf_buildValueControl(sAttr) {
        var bEdit = _isEdit() && sAttr.edit === true;
        oUI.field = null;   // createField 객체(setValueState/focus 보유) — value-state 표시에 사용

        // (1) 텍스트 입력.
        if (sAttr.inp_visb === true && window.U4AUI && U4AUI.createField) {
            oUI.field = U4AUI.createField({
                type: "text",
                value: sAttr.UIATV != null ? sAttr.UIATV : "",
                readOnly: !bEdit,
                clear: bEdit,
                onClear: function () { sAttr.UIATV = ""; lf_onChange(); },
                onChange: function (v) { sAttr.UIATV = v; lf_onChange(); }
            });
            return oUI.field.el;
        }

        // (2) DDLB 콤보.
        if (sAttr.sel_visb === true && window.U4AUI && U4AUI.createSelect) {
            var aDDLB = Array.isArray(sAttr.T_DDLB) ? sAttr.T_DDLB : [];
            var sVal = sAttr.UIATV != null ? sAttr.UIATV : "";
            var aItems = [], bFound = false;
            for (var i = 0; i < aDDLB.length; i++) {
                if (aDDLB[i].KEY === sVal) { bFound = true; }
                aItems.push({ value: aDDLB[i].KEY != null ? aDDLB[i].KEY : "", text: aDDLB[i].TEXT != null ? aDDLB[i].TEXT : "" });
            }
            if (!bFound) { aItems.unshift({ value: sVal, text: sVal }); }
            var SEL = U4AUI.createSelect(aItems, sVal, function (v) {
                sAttr.UIATV = v; sAttr.comboval = v; lf_onChange();
            });
            if (!bEdit) { SEL.classList.add("is-disabled"); SEL.setAttribute("aria-disabled", "true"); SEL.tabIndex = -1; }
            return SEL;
        }

        // (3) 체크박스(boolean) — .u4a-switch. UIATV_c 토글 시 UIATV("X"/"") 동기(원본 1615행 매핑).
        if (sAttr.chk_visb === true) {
            var oSwitch = _el("label", "u4a-switch");
            var oIn = document.createElement("input");
            oIn.type = "checkbox";
            oIn.checked = (sAttr.UIATV_c === true);
            oIn.disabled = !bEdit;
            oIn.addEventListener("change", function () {
                sAttr.UIATV_c = oIn.checked;
                sAttr.UIATV = oIn.checked ? "X" : "";
                lf_onChange();
            });
            oSwitch.appendChild(oIn);
            oSwitch.appendChild(_el("span", "u4a-switch__slider"));
            return oSwitch;
        }

        // (4) 팝업 호출형 버튼 — 개인화 대상 아님(원본도 빈 press). 표시만.
        if (sAttr.btn_visb === true) {
            var BTN = _el("button", "u4a-btn");
            BTN.type = "button";
            BTN.disabled = true;
            BTN.textContent = sAttr.btn_text || sAttr.UIATT || "";
            return BTN;
        }

        // 폴백 — 읽기전용 값 표시.
        var RO = _el("div", "u4aPresetRoVal", sAttr.UIATV != null ? sAttr.UIATV : "");
        return RO;
    }

    /* ── 개인화 데이터 저장(원본 _savePresetAttrData 1:1 — Node/Electron, UI5 의존 없음) ── */
    async function _savePresetAttrData(sAttr) {
        var _sRes = { RETCD: "", RTMSG: "" };

        var _folderPath = parent.PATH.join(parent.PATHINFO.P13N_ROOT, "UI_ATTR");

        //폴더 없으면 생성.
        if (!parent.FS.existsSync(_folderPath)) {
            try { parent.FS.mkdirSync(_folderPath, { recursive: true }); }
            catch (error) {
                _sRes.RETCD = "E";
                //651 개인화 데이터 저장 폴더 생성에 실패했습니다.
                _sRes.RTMSG = _wsTxt("651") + "\n" + (error && error.message ? error.message : "");
                return _sRes;
            }
        }

        //SQLite3 처리 클래스 module import(코드베이스 표준 raw-path dynamic import).
        var _path = parent.PATH.join(oAPP.oDesign.pathInfo.designRootPath, "util", "sqliteManager.js");
        var _mod = await import(_path);
        var sqliteManager = _mod.default;

        var _dbPath = parent.PATH.join(_folderPath, "UI_ATTR_PRESET.db");
        var _sqlite = new sqliteManager(_dbPath);

        //테이블 생성(list 팝업과 동일 스키마).
        _sqlite.createTable({
            tableName: "UI_ATTR_PRESET",
            columns: [
                "LIBVER TEXT NOT NULL", "SYSID TEXT NOT NULL", "UNAME TEXT NOT NULL",
                "UIATK TEXT NOT NULL", "UIOBK TEXT NOT NULL", "UIATV TEXT", "UIATY TEXT"
            ],
            primaryKey: ["LIBVER", "SYSID", "UNAME", "UIATK"]
        });

        //스키마 버전(원본 PRAGMA user_version 1회 세팅).
        var _oVersion = _sqlite.query("PRAGMA user_version", [], { single: true });
        var _iVersion = (_oVersion && _oVersion.user_version) || 0;
        if (_iVersion < 1) { _sqlite.execute("PRAGMA user_version = 1"); }

        //upsert.
        _sqlite.upsertData({
            tableName: "UI_ATTR_PRESET",
            data: {
                LIBVER: oAPP.attr.metadata.METADATA.LIBVER,
                SYSID: oAPP.attr.metadata.USERINFO.SYSID,
                UNAME: oAPP.attr.metadata.USERINFO.UNAME,
                UIATK: sAttr.UIATK,
                UIOBK: sAttr.UIOBK,
                UIATV: sAttr.UIATV,
                UIATY: sAttr.UIATY
            }
        });

        return _sRes;
    }

    /* ── 저장 후 열린 list 팝업(별창)에 목록 새로고침 신호(원본 IPC 브로드캐스트 1:1) ── */
    function _broadcastAttrChange(sAttr) {
        try {
            var sSysID = parent.process.USERINFO.SYSID;
            var _if_name = "if-attrPresetPopup-" + sSysID;
            var _popupName = C_ATTR_PRESET_POPUP + "-" + sSysID;
            var _IF_DATA = { PRCCD: "ATTR_CHANGE", DATA: { UIATK: sAttr.UIATK, UIOBK: sAttr.UIOBK } };

            var _allWindows = parent.REMOTE.BrowserWindow.getAllWindows();
            for (var i = 0; i < _allWindows.length; i++) {
                var _w = _allWindows[i];
                var oWebPref = parent.WSUTIL.QueryString.parse(_w.getURL());
                if (oWebPref && oWebPref.OBJTY === _popupName) { _w.send(_if_name, _IF_DATA); }
            }
        } catch (e) { console.error("[HTML5][WS20][preset] ATTR_CHANGE 브로드캐스트 오류:", e && e.message); }
    }

    /* ── Apply(원본 OK 콜백) ──
     *   ★ 토스트는 반드시 다이얼로그(showModal=top-layer)를 "닫은 뒤" 표시한다.
     *     열린 채로 parent.showMessage 를 부르면 토스트가 모달 top-layer 뒤에 가려 안 보인다
     *     (busy 인디케이터와 동일 함정 — dumpWrite 도 close 후 toast). 결과를 변수에 담아
     *     finally 에서 close→toast 순으로 처리. 검증 오류만 인라인(value-state) 유지. */
    async function lf_apply() {
        if (!_isEdit() || !oCtx.clone) { lf_close(); return; }

        try { parent.setBusy && parent.setBusy("X"); } catch (e) { }
        try { oAPP.fn.setShortcutLock && oAPP.fn.setShortcutLock(true); } catch (e) { }

        var _okMsg = null, _errMsg = null;

        try {
            //저장 전 입력값 점검 — 오류는 공통 value-state(인라인 박스)로 표시하고 다이얼로그는 열어둔다(원본 동일).
            var _sRes = _checkAttrValue(oCtx.clone);
            if (_sRes.RETCD === "E") { lf_showValState(_sRes); return; }

            //개인화 데이터 저장.
            _sRes = await _savePresetAttrData(oCtx.clone);
            if (_sRes.RETCD === "E") { _errMsg = _sRes.RTMSG; return; }

            //미리보기 원본값 복원(원본 previewUIsetProp(sParam.sAttr)).
            _preview(oCtx.orig);

            //열린 list 팝업 새로고침.
            _broadcastAttrChange(oCtx.clone);

            //628 등록이 완료됐습니다.
            _okMsg = _wsTxt("628");
        } catch (e) {
            //조용한 실패 금지 — 실제 오류 메시지를 노출(원인 파악).
            console.error("[HTML5][WS20][preset] 개인화 저장 처리 오류:", e && e.message, e);
            _errMsg = (e && e.message) ? e.message : String(e);
        } finally {
            try { oAPP.fn.setShortcutLock && oAPP.fn.setShortcutLock(false); } catch (e) { }
            try { parent.setBusy && parent.setBusy(""); } catch (e) { }

            //close 먼저 → 그 다음 toast(모달 top-layer 가림 방지). 검증오류는 _ok/_err 둘 다 null → 열어둠.
            if (_okMsg) { lf_close(); try { parent.showMessage(null, 10, "S", _okMsg); } catch (e) { } }
            else if (_errMsg) { lf_close(); try { parent.showMessage(null, 20, "E", _errMsg); } catch (e) { } }
        }
    }

    /* ── Cancel/Close(원본 CANCEL 콜백) — 미리보기 원본 복원 후 닫기 ── */
    function lf_cancel() {
        _preview(oCtx.orig);
        lf_close();
    }

    /************************************************************************
     * 다이얼로그 골격 — 열 때마다 새로 build(닫을 때 공통 전역 close 가 DOM 제거).
     ************************************************************************/
    function lf_build() {
        lf_ensureStyle();

        var oDlg = document.createElement("dialog");
        oDlg.id = C_DLG_ID;
        oDlg.className = "u4a-dialog u4aPresetDlg";

        // ── 헤더 — user 아이콘 + 627(UI Attribute 개인화) + [U4A Help Document] + 닫기 X ──
        var oHeader = _el("div", "u4a-dialog__header");
        oHeader.innerHTML = _fa("user-gear") + "<span></span>";
        oHeader.querySelector("span").textContent = _wsTxt("627");

        // U4A Help Document 버튼 — 원본 dialogViewer showHelpDocButton:true / u4aHelpDocMenuID:"000278".
        //   원본 setHelpDocButton 과 동일: 패치(UHAK901369) 적용 서버에서만 노출, book-open-reader 아이콘.
        try {
            if (oAPP.common.checkWLOList("C", "UHAK901369") === true) {
                var oHelpBtn = _el("button", "u4a-btn-icon u4aPresetHelpBtn");
                oHelpBtn.type = "button";
                oHelpBtn.innerHTML = _fa("book-open-reader");
                oHelpBtn.title = "U4A Help Document";   // TODO(i18n): 원본도 $$msg 하드코딩(메시지 키화 필요)
                oHelpBtn.addEventListener("click", function () {
                    try { oAPP.fn.fnU4AHelpDocuPopupOpener({ startMenuId: "000278" }); }
                    catch (e) { console.error("[HTML5][WS20][preset] U4A Help Document 오픈 실패:", e && e.message); }
                });
                oHeader.appendChild(oHelpBtn);
            }
        } catch (e) { console.error("[HTML5][WS20][preset] help 버튼 구성 오류:", e && e.message); }

        var oXBtn = _el("button", "u4a-btn-icon");
        oXBtn.type = "button";
        oXBtn.innerHTML = _fa("xmark");
        oXBtn.title = _wsTxt("056") || _wsTxt("003");
        oXBtn.addEventListener("click", function () { lf_cancel(); });
        oHeader.appendChild(oXBtn);
        oDlg.appendChild(oHeader);

        // ── 본문 — 공통 폼 행(.u4a-form__row): [라벨(아이콘+텍스트, 필수시 *)] + [값 컨트롤(.u4a-field)].
        //   검증 메시지는 값 컨트롤의 .u4a-field__msg(공통)가 포커스시 자동 표시 → 별도 msg div 없음.
        var oBody = _el("div", "u4a-dialog__body u4aPresetBody");

        oUI.row = _el("div", "u4a-form__row u4aPresetRow");
        oUI.lbl = _el("div", "u4a-label u4aPresetLbl");   // 아이콘+텍스트, 클릭=설명 팝업
        oUI.row.appendChild(oUI.lbl);
        oBody.appendChild(oUI.row);

        oDlg.appendChild(oBody);

        // ── 푸터 — [적용(232, 편집시만) 파랑] [취소(003)/닫기(056) 빨강] : 원본처럼 아이콘+텍스트 ──
        var oFoot = _el("div", "u4a-dialog__footer u4aPresetFoot");
        oFoot.appendChild(_el("span", "u4aPresetFootSpacer"));
        oUI.applyBtn = _el("button", "u4a-btn u4a-btn--emphasized u4aPresetBtn");
        oUI.applyBtn.type = "button";
        oUI.applyBtn.innerHTML = _fa("check") + "<span></span>";
        oUI.applyBtn.querySelector("span").textContent = _wsTxt("232");   // 적용
        oUI.applyBtn.addEventListener("click", function () { lf_apply(); });
        oUI.closeBtn = _el("button", "u4a-btn u4a-btn--negative u4aPresetBtn");
        oUI.closeBtn.type = "button";
        oUI.closeBtn.innerHTML = _fa("xmark") + "<span></span>";
        oUI.closeBtn.addEventListener("click", function () { lf_cancel(); });
        oFoot.appendChild(oUI.applyBtn);
        oFoot.appendChild(oUI.closeBtn);
        oDlg.appendChild(oFoot);

        // ESC = 취소(원본 Reject).
        oDlg.addEventListener("cancel", function (e) { e.preventDefault(); lf_cancel(); });

        if (window.U4AUI && U4AUI.makeDialogRecenter) { U4AUI.makeDialogRecenter(oDlg, oHeader); }
        if (window.U4AUI && U4AUI.makeDialogResizable) { U4AUI.makeDialogResizable(oDlg, { minW: 360, minH: 220 }); }

        document.body.appendChild(oDlg);
        oUI.dlg = oDlg;
    }

    /************************************************************************
     * 공개 진입점 — M06(UI Attribute 개인화) 다이얼로그 열기.
     *   @param {object} sAttr - WS20 속성 행(is_attr). 편집가능·미바인딩 프로퍼티(vis06).
     ************************************************************************/
    oAPP.fn.fnAttrPresetSettingsOpen = function (sAttr) {

        if (!sAttr) { return; }

        if (!oUI || !oUI.dlg || !document.body.contains(oUI.dlg)) { oUI = {}; lf_build(); }
        if (oUI.dlg.open) { return; }

        //원본 + 편집용 clone(원본 JSONModel /attr 복제).
        oCtx.orig = sAttr;
        oCtx.clone = JSON.parse(JSON.stringify(sAttr));

        //라벨 = (구 ObjectStatus) UIATT_ICON + 속성명. 필수(icon0)면 * 표시. 클릭=설명 팝업.
        var sFa = _uiattIconFa(oCtx.clone.UIATT_ICON);
        oUI.lbl.innerHTML = (sFa ? '<i class="fa-solid fa-' + sFa + '"></i>' : "") + '<span class="u4aPresetLblTxt"></span>';
        oUI.lbl.querySelector(".u4aPresetLblTxt").textContent = oCtx.clone.UIATT || "";
        oUI.lbl.title = oCtx.clone.UIATT || "";
        oUI.lbl.classList.toggle("u4a-label--required", oCtx.clone.icon0_visb === true);
        oUI.lbl.onclick = function () {
            if (typeof oAPP.fn.callAttrDescPopup === "function") {
                try { oAPP.fn.callAttrDescPopup(oUI.lbl, oCtx.clone); } catch (e) { }
            }
        };

        //값 컨트롤(clone 기준) — 라벨 다음, 같은 .u4a-form__row 안에(공통 value-state 위치/포커스 규칙).
        var oOldCtl = oUI.row.querySelector(".u4aPresetCtl");
        if (oOldCtl) { oUI.row.removeChild(oOldCtl); }
        var oCtl = lf_buildValueControl(oCtx.clone);
        oCtl.classList.add("u4aPresetCtl");
        oUI.row.appendChild(oCtl);
        lf_showValState({ RETCD: "" });

        //취소 버튼 텍스트 = 편집이면 003(Cancel), 조회면 056(Close). (원본 _cancel 동일)
        var sCancel = _isEdit() ? (_wsTxt("003")) : (_wsTxt("056") || _wsTxt("003"));
        oUI.closeBtn.querySelector("span").textContent = sCancel;

        //Apply 노출 = IS_EDIT(원본 OK visible). 조회 모드면 보기 전용.
        oUI.applyBtn.hidden = !_isEdit();

        try { oUI.dlg.showModal(); } catch (e) { }
        try { oAPP.common.fnSetBusyLock(""); } catch (e) { }
    };

    /************************************************************************
     * 공통 스타일 1회 주입(테마 토큰 소비 — 공통 파일 미수정, 화면 스코프만).
     ************************************************************************/
    function lf_ensureStyle() {
        if (document.getElementById("u4aPresetStyle")) { return; }
        var oStyle = document.createElement("style");
        oStyle.id = "u4aPresetStyle";
        oStyle.textContent =
            ".u4aPresetDlg { width: min(94vw, 460px); padding: 0; display: flex; flex-direction: column; }" +
            ".u4aPresetDlg .u4a-dialog__header { cursor: move; user-select: none; }" +
            ".u4aPresetDlg .u4a-dialog__header span { flex: 1 1 auto; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }" +
            // U4A Help Document 버튼 — 원본 Emphasized(강조) 느낌으로 accent 색 부여.
            ".u4aPresetHelpBtn { color: var(--accent); }" +
            ".u4aPresetHelpBtn:hover { background: var(--hover-bg); }" +
            // 본문 — 아래에 value-state 메시지(.u4a-field__msg=absolute)가 뜰 공간 확보(padding-bottom).
            ".u4aPresetBody { flex: 1 1 auto; min-height: 0; overflow: visible; padding: 1rem 1rem 2.75rem; }" +
            ".u4aPresetRow { position: relative; }" +
            // 라벨 = 아이콘 + 텍스트(구 ObjectStatus), 클릭=설명 팝업(hover 밑줄).
            ".u4aPresetLbl { display: inline-flex; align-items: center; gap: 0.375rem; width: fit-content; max-width: 100%; cursor: pointer; }" +
            ".u4aPresetLbl > i { flex: 0 0 auto; color: var(--text-muted); font-size: 0.8125rem; }" +
            ".u4aPresetLblTxt { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }" +
            ".u4aPresetLbl:hover .u4aPresetLblTxt { text-decoration: underline; }" +
            // 값 컨트롤 = 행 폭 가득.
            ".u4aPresetRow > .u4aPresetCtl { width: 100%; margin-top: 0.25rem; }" +
            // 푸터 — 아이콘+텍스트 버튼(원본 적용/취소).
            ".u4aPresetFoot { display: flex; gap: 0.5rem; align-items: center; }" +
            ".u4aPresetFootSpacer { flex: 1 1 auto; }" +
            ".u4aPresetFoot .u4a-btn[hidden] { display: none; }" +
            ".u4aPresetBtn { display: inline-flex; align-items: center; gap: 0.375rem; }";
        document.head.appendChild(oStyle);
    }

})(window, $, oAPP);
