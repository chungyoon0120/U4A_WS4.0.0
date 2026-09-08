/************************************************************************
 * Copyright 2020. INFOCG Inc. all rights reserved.
 * ----------------------------------------------------------------------
 * - file Name : fnCssJsLinkAddPopupOpen.js
 * - file Desc : Document의 CSS, JS Link Add Popup  (HTML5)
 * ----------------------------------------------------------------------
 * [컨버전 메모]
 *  원본: sap.m.Dialog(draggable/resizable 600×500) + customHeader(APPID/Change·Display/
 *        Active·Inactive + 닫기) + sap.ui.table.Table(멀티토글 선택) + extension OverflowToolbar
 *        [Add/Del/MIME Repository] + footer[Save(accept)/Cancel(decline)].
 *        컬럼 = Status(아이콘) / "{TYPE} Link MIME URL"(Input) / Exclude(Switch, 조건부).
 *        데이터 = oAPP.DATA.APPDATA.T_CSLK(CSS) / T_JSLK(JS)  각 {LKEY,URL,INACTIVE}.
 *
 *  HTML5: native <dialog class="u4a-dialog"> + 공통 컴포넌트
 *        (.u4a-table 멀티선택[체크박스 열] · U4AUI.createField[URL,value-state] ·
 *         .u4a-switch[Exclude] · .u4a-btn · makeDialogRecenter/Resizable · 전역 헤더드래그).
 *        ★ 이 테이블만 라인 멀티 선택(체크박스 열 + 헤더 전체선택) — 원본 SelectionMode.MultiToggle.
 *
 *  ★ 보존 로직(원본 그대로):
 *    · open: T_CSLK/T_JSLK → LISTDATA(KEY=randomKey, STATUS=2). 빈 목록도 표시.
 *    · Add: {KEY, STATUS:1(신규), URL:"", INACTIVE:""} 추가.
 *    · Del: 선택(체크) 라인 splice.
 *    · Save: URL 빈값 검증(빈값=value-state Error, MSG_WS 014) → 통과 시 T_* 갱신 + setAppChange('X')
 *           + (CSS) 디자인 미리보기 setCSSLink(비-Exclude URL, true) + 콜백 publish. 빈 목록=초기화 후 닫기.
 *    · Exclude(스위치): INACTIVE "X"/"". (패치 UHAK900822 또는 미패키징일 때만 컬럼 노출 — 원본 조건)
 *  ★ UI5 의존부 치환: sap.ui.table → 공통 .u4a-table, JSONModel → 로컬 aRows, sap.m.Input → createField,
 *    sap.m.Switch → .u4a-switch, EventBus publish → 가드 호출(HTML5 sap 스텁).
 ************************************************************************/

(function (window, $, oAPP) {
  "use strict";

  var APPCOMMON = oAPP.common;

  var C_DLG_ID = "u4aWsCssJsLinkAddDlg";

  var C_CSS = "CSS",
      C_JS = "JS";

  // ── 로컬 헬퍼(클라이언트 에디터와 동일 컨벤션) ───────────────────────
  function _fa(s) { return '<i class="fa-solid fa-' + s + '"></i>'; }
  function _txt(sCls, sCode, p1) {
    try { return APPCOMMON.fnGetMsgClsText(sCls, sCode, p1 || "", "", "", ""); }
    catch (e) { return ""; }
  }
  function _el(sTag, sClass, sText) {
    var o = document.createElement(sTag);
    if (sClass) { o.className = sClass; }
    if (typeof sText !== "undefined") { o.textContent = sText; }
    return o;
  }
  function _randomKey() {
    try { return parent.getRandomKey(10); } catch (e) { return "K" + Math.round(performance.now() * 1000) + "_" + (oUI ? oUI.seq++ : 0); }
  }
  // ZMSG_WS_COMMON_001 클래스 텍스트(원본 getWsMsgClsTxt). Workspace 언어 사용. p1=&1 치환값(선택).
  function _wsCommon(sCode, p1) {
    try {
      var sLangu = "";
      try { sLangu = (parent.getUserInfo() || {}).LANGU || ""; } catch (e) { }
      return parent.WSUTIL.getWsMsgClsTxt(sLangu, "ZMSG_WS_COMMON_001", sCode, p1 || "") || "";
    } catch (e) { return ""; }
  }

  // 현재 화면 편집모드(원본 /WS20/APP/IS_EDIT).
  function _isEdit() {
    try { var o = APPCOMMON.fnGetModelProperty("/WS20/APP"); return !!(o && o.IS_EDIT === "X"); }
    catch (e) { return false; }
  }
  function _appInfo() {
    try { return APPCOMMON.fnGetModelProperty("/WS20/APP") || {}; } catch (e) { return {}; }
  }

  // Exclude(비활성) 컬럼 노출 여부 — 원본: 패치 UHAK900822 보유 또는 미패키징.
  function _excludeVisible() {
    try { if (oAPP.common.checkWLOList && oAPP.common.checkWLOList("C", "UHAK900822") === true) { return true; } } catch (e) { }
    try { if (parent.APP && parent.APP.isPackaged === false) { return true; } } catch (e) { }
    return false;
  }

  // T_CSLK / T_JSLK 배열 보장.
  function _ensureLinkTable(sType) {
    if (!oAPP.DATA) { oAPP.DATA = {}; }
    if (!oAPP.DATA.APPDATA) { oAPP.DATA.APPDATA = {}; }
    var sKey = (sType === C_JS) ? "T_JSLK" : "T_CSLK";
    if (!Array.isArray(oAPP.DATA.APPDATA[sKey])) { oAPP.DATA.APPDATA[sKey] = []; }
    return oAPP.DATA.APPDATA[sKey];
  }

  /************************************************************************
   * 단일 인스턴스(원본 sap core 다이얼로그 1개 재사용) — 닫기=숨김(제거 X).
   ************************************************************************/
  var oUI = null;     // { dlg, headerTitle, addBtn, delBtn, mimeBtn, saveBtn, table, tbody, headChk, colTxtTh, seq }
  var oState = { type: C_CSS, rows: [] };   // rows = [{KEY, STATUS, URL, INACTIVE, LKEY, field}]

  // ── 팝업 닫기(숨김) + 콜백 ─────────────────────────────────────────
  function lf_close(bSkipCallback) {
    try { if (oUI && oUI.dlg && oUI.dlg.open) { oUI.dlg.close(); } } catch (e) { }
    if (!bSkipCallback) { lf_publishCallback("CANCEL", []); }
  }

  // 호출처 콜백(원본 EventBus publish("WS20POPUP","cssJsLinkAddPopupCallback")). HTML5 sap 스텁이라 가드.
  function lf_publishCallback(sActcd, aData) {
    try {
      if (window.sap && sap.ui && sap.ui.getCore && sap.ui.getCore().getEventBus) {
        sap.ui.getCore().getEventBus().publish("WS20POPUP", "cssJsLinkAddPopupCallback", {
          ACTCD: sActcd, TYPE: oState.type, T_DATA: aData || []
        });
      }
    } catch (e) { }
  }

  // 디자인 미리보기 반영(원본 setCSSLink) — W2 미리보기 프레임 미배선 시 null 가드.
  function lf_reflectCssPreview(aUrls) {
    try {
      var oPrev = oAPP.attr && oAPP.attr.ui && oAPP.attr.ui.frame && oAPP.attr.ui.frame.contentWindow;
      if (oPrev && typeof oPrev.setCSSLink === "function") { oPrev.setCSSLink(aUrls, true); }
    } catch (e) { console.error("[HTML5][cssLink] 미리보기 반영 오류:", e && e.message); }
  }

  // 저장/전체삭제로 변경분 발생 → WS20 동기화(클라이언트 에디터 lf_cb 와 동일 3종):
  //   ① getAppInfo().IS_CHAG 를 모델에 미러 — HTML5 에선 setAppInfo 가 byId("WSAPP") 가드로 모델 갱신을 스킵하므로 명시 동기.
  //   ② fnRenderWs20AttrRows — 속성 패널 행 재렌더(_isChangedRow 재평가 → CSS/JS Link Add 행 변경배경 동기화. ★링크 추가/전체삭제 둘 다).
  //   ③ fnUpdateWs20AppHeader — 상단 헤더 Active→Inactive.
  function lf_syncWs20Changed() {
    try {
      var oInfo = parent.getAppInfo && parent.getAppInfo();
      if (oInfo) { oAPP.common.fnSetModelProperty("/WS20/APP/IS_CHAG", oInfo.IS_CHAG || ""); }
    } catch (e) { }
    try { if (oAPP.fn.fnRenderWs20AttrRows) { oAPP.fn.fnRenderWs20AttrRows(); } } catch (e) { }
    try { if (oAPP.fn.fnUpdateWs20AppHeader) { oAPP.fn.fnUpdateWs20AppHeader(); } } catch (e) { }
  }

  // ── 테이블 본문 렌더(aRows 기준) ─────────────────────────────────────
  //   ※ 원본 Status 컬럼(신규/저장 아이콘)은 사용자 요청으로 제거(군더더기 — 체크박스 옆 작은 점처럼 보임).
  //     STATUS 값은 데이터에 남겨두되(향후 필요 시 복원 용이) 화면엔 표시하지 않는다.
  function lf_renderRows() {
    if (!oUI) { return; }
    var bEdit = _isEdit();
    var bExcl = _excludeVisible();
    oUI.tbody.innerHTML = "";

    if (!oState.rows.length) {
      var oTrEmpty = _el("tr", "u4a-table__nodata");
      var oTdEmpty = document.createElement("td");
      oTdEmpty.colSpan = bExcl ? 3 : 2;
      oTdEmpty.textContent = _wsCommon("946");   // 데이터 없음 (공통 .u4a-table__nodata — ServerList noData=946 동일)
      oTrEmpty.appendChild(oTdEmpty);
      oUI.tbody.appendChild(oTrEmpty);
      lf_syncHeadChk();
      return;
    }

    oState.rows.forEach(function (oRow, i) {
      var oTr = document.createElement("tr");
      oTr.setAttribute("data-key", oRow.KEY);
      if (i % 2 === 1) { oTr.setAttribute("data-odd", "true"); }

      // (1) 선택 체크박스(멀티선택) — 편집모드에서만.
      var oTdChk = _el("td", "u4aCslColChk");
      if (bEdit) {
        var oChk = document.createElement("input");
        oChk.type = "checkbox";
        oChk.className = "u4aCslRowChk";
        oChk.setAttribute("data-key", oRow.KEY);
        oChk.addEventListener("change", function () {
          oTr.setAttribute("aria-selected", oChk.checked ? "true" : "false");
          lf_syncHeadChk();
        });
        oTdChk.appendChild(oChk);
      }
      oTr.appendChild(oTdChk);

      // (2) URL 입력(공통 createField, value-state) — 편집모드만 편집 가능. (원본 sap.m.Input 처럼 clear 글리프 없음)
      var oTdUrl = _el("td", "u4aCslColUrl");
      var oField = U4AUI.createField({
        type: "text",
        value: oRow.URL || "",
        readOnly: !bEdit,
        className: "u4aCslUrlField",
        onInput: function (v) { oRow.URL = v; if (oField.setValueState) { oField.setValueState("none", ""); } }
      });
      oRow.field = oField;
      oTdUrl.appendChild(oField.el);
      oTr.appendChild(oTdUrl);

      // (4) Exclude 스위치(조건부 컬럼).
      if (bExcl) {
        var oTdExc = _el("td", "u4aCslColExc");
        var oSw = _el("label", "u4a-switch");
        var oSwIn = document.createElement("input");
        oSwIn.type = "checkbox";
        oSwIn.checked = (oRow.INACTIVE === "X");
        oSwIn.disabled = !bEdit;
        oSwIn.addEventListener("change", function () { oRow.INACTIVE = oSwIn.checked ? "X" : ""; });
        oSw.appendChild(oSwIn);
        oSw.appendChild(_el("span", "u4a-switch__slider"));
        oTdExc.appendChild(oSw);
        oTr.appendChild(oTdExc);
      }

      oUI.tbody.appendChild(oTr);
    });

    lf_syncHeadChk();
  }

  // 공통 토스트(셸 showMessage KIND 10) — _u4aToast 가 열린 최상위 모달 <dialog> 안(top-layer)에
  //   자동 배치하므로 모달 위/메인 위 모두 보인다. sType: S(성공)/W(경고)/E(오류)/I(정보).
  function lf_msg(sType, sText) {
    if (!sText) { return; }
    try { parent.showMessage(null, 10, sType || "I", sText); } catch (e) { }
  }

  // 헤더 전체선택 체크박스 상태 동기화(전체/부분/없음).
  function lf_syncHeadChk() {
    if (!oUI || !oUI.headChk) { return; }
    var aChk = oUI.tbody.querySelectorAll(".u4aCslRowChk");
    var iTotal = aChk.length, iSel = 0;
    aChk.forEach(function (c) { if (c.checked) { iSel++; } });
    oUI.headChk.checked = (iTotal > 0 && iSel === iTotal);
    oUI.headChk.indeterminate = (iSel > 0 && iSel < iTotal);
    oUI.headChk.disabled = (iTotal === 0);
  }

  // ── 툴바: Add / Del / MIME Repository ───────────────────────────────
  function lf_addRow() {
    oState.rows.push({ KEY: _randomKey(), STATUS: 1, URL: "", INACTIVE: "", LKEY: "" });
    lf_renderRows();
    // 새 행 URL 입력에 포커스.
    try {
      var aTr = oUI.tbody.querySelectorAll("tr[data-key]");
      var oLast = aTr[aTr.length - 1];
      var oInput = oLast && oLast.querySelector(".u4aCslUrlField input");
      if (oInput) { oInput.focus(); }
    } catch (e) { }
  }

  function lf_delSelected() {
    var aChk = oUI.tbody.querySelectorAll(".u4aCslRowChk");
    var oDel = {};
    var iCnt = 0;
    aChk.forEach(function (c) { if (c.checked) { oDel[c.getAttribute("data-key")] = true; iCnt++; } });
    if (iCnt === 0) { lf_msg("W", _wsCommon("240")); return; }   // 선택 없음 → "선택된 항목이 없습니다."(240).

    // 삭제 확인(632 "선택한 &1개의 라인을 삭제 하시겠습니까?" &1=건수) — Yes 일 때만 삭제.
    var sConfirm = _wsCommon("632", String(iCnt));
    try {
      parent.showMessage(null, 30, "W", sConfirm, function (sAct) {
        if (sAct !== "YES") { return; }
        oState.rows = oState.rows.filter(function (r) { return !oDel[r.KEY]; });
        lf_renderRows();
      });
    } catch (e) {
      // showMessage 불가 시 폴백 — 바로 삭제(원본 동작).
      oState.rows = oState.rows.filter(function (r) { return !oDel[r.KEY]; });
      lf_renderRows();
    }
  }

  // ── 저장(원본 fnCssLinkSave / fnJsLinkSave 1:1) ──────────────────────
  function lf_save() {
    if (!_isEdit()) { return; }

    var aTbl = _ensureLinkTable(oState.type);

    // 목록이 비면 초기화 후 닫기(원본).
    if (!oState.rows.length) {
      if (oState.type === C_JS) { oAPP.DATA.APPDATA.T_JSLK = []; }
      else { oAPP.DATA.APPDATA.T_CSLK = []; lf_reflectCssPreview([]); }
      try { parent.setAppChange("X"); } catch (e) { }
      lf_syncWs20Changed();   // IS_CHAG 미러 + 속성행 변경배경 + 헤더 Active→Inactive.
      lf_close(true);
      lf_msg("S", _txt("/U4A/MSG_WS", "002"));   // Saved success(전체삭제 저장 포함).
      lf_publishCallback("CANCEL", []);
      return;
    }

    // URL 빈값 검증.
    var sUrlType = _txt("/U4A/CL_WS_COMMON", (oState.type === C_JS) ? "B75" : "B74");   // (CSS|JS) Link URL
    var sErrTxt = _txt("/U4A/MSG_WS", "014", sUrlType);                                  // & is required entry value.
    var aSaveData = [], aUrls = [], bErr = false, oFirstErr = null;

    oState.rows.forEach(function (oRow, i) {
      var sUrl = (oRow.URL || "").trim();
      if (oRow.field && oRow.field.setValueState) { oRow.field.setValueState("none", ""); }

      if (sUrl === "") {
        bErr = true;
        if (oRow.field && oRow.field.setValueState) { oRow.field.setValueState("error", sErrTxt); }
        if (!oFirstErr) { oFirstErr = oRow.field; }
        return;
      }
      aSaveData.push({ LKEY: i + 1, URL: oRow.URL, INACTIVE: oRow.INACTIVE || "" });
      // CSS 미리보기엔 비-Exclude URL 만 수집(원본).
      if (oRow.INACTIVE !== "X") { aUrls.push(oRow.URL); }
    });

    if (bErr) {
      if (oFirstErr && oFirstErr.focus) { try { oFirstErr.focus(); } catch (e) { } }
      lf_msg("W", sErrTxt);   // 빨간 보더(value-state)와 함께 사유 안내(모달 위 토스트). MSG_WS 014 = & 는 필수 입력값.
      return;   // 다이얼로그 유지.
    }

    if (oState.type === C_JS) {
      oAPP.DATA.APPDATA.T_JSLK = aSaveData;
    } else {
      oAPP.DATA.APPDATA.T_CSLK = aSaveData;
      lf_reflectCssPreview(aUrls);
    }
    try { parent.setAppChange("X"); } catch (e) { }
    lf_syncWs20Changed();   // IS_CHAG 미러 + 속성행 변경배경 + 헤더 Active→Inactive.

    lf_close(true);
    lf_msg("S", _txt("/U4A/MSG_WS", "002"));   // Saved success(저장하였습니다) — 닫힌 뒤 메인 위 토스트.
    lf_publishCallback("SAVE", aSaveData);
  }

  // ── open 시 데이터 로드(원본 fnGetCssLinkData / fnGetJsLinkData) ──────
  function lf_loadData(sType) {
    var aTbl = _ensureLinkTable(sType);
    oState.rows = [];
    aTbl.forEach(function (o, i) {
      oState.rows.push({
        KEY: _randomKey(),
        STATUS: 2,                                  // 저장된 것.
        URL: (o && typeof o.URL === "string") ? o.URL : "",
        INACTIVE: (o && o.INACTIVE) ? o.INACTIVE : "",
        LKEY: (sType === C_JS) ? (i + 1) : (o && o.LKEY)
      });
    });
  }

  /************************************************************************
   * 다이얼로그 1회 생성(이후 재사용).
   ************************************************************************/
  function lf_build() {
    lf_ensureStyle();

    var oDlg = document.createElement("dialog");
    oDlg.id = C_DLG_ID;
    oDlg.className = "u4a-dialog u4aCslDlg";

    // 헤더 — link 아이콘 + "APPID  ·  Change/Display  ·  Active/Inactive" + 닫기 X.
    var oHeader = _el("div", "u4a-dialog__header");
    oHeader.innerHTML = _fa("link") + "<span></span>";
    var oHeaderTitle = oHeader.querySelector("span");
    var oXBtn = _el("button", "u4a-btn-icon");
    oXBtn.type = "button";
    oXBtn.innerHTML = _fa("xmark");
    oXBtn.title = _txt("/U4A/CL_WS_COMMON", "A39");   // Close
    oXBtn.addEventListener("click", function () { lf_close(); });
    oHeader.appendChild(oXBtn);
    oDlg.appendChild(oHeader);

    // 바디 — [툴바] + [공통 테이블].
    var oBody = _el("div", "u4a-dialog__body u4aCslBody");

    var oToolbar = _el("div", "u4aCslToolbar");
    // 아이콘 전용 + 의미색(아웃라인) — Add=accent 파랑(생성) / Del=negative 빨강(삭제) / MIME=중립. 이름은 툴팁.
    var oAddBtn = _el("button", "u4a-btn u4aCslToolBtn u4aCslIcoBtn u4aCslAdd");
    oAddBtn.type = "button";
    oAddBtn.innerHTML = _fa("file-circle-plus");   // 툴팁(title)은 open 마다 "{TYPE} Link Add" 로 갱신.
    oAddBtn.addEventListener("click", function () { lf_addRow(); });
    var oDelBtn = _el("button", "u4a-btn u4aCslToolBtn u4aCslIcoBtn u4a-btn--negative");
    oDelBtn.type = "button";
    oDelBtn.innerHTML = _fa("trash");
    oDelBtn.addEventListener("click", function () { lf_delSelected(); });
    var oMimeBtn = _el("button", "u4a-btn u4aCslToolBtn u4aCslMime");
    oMimeBtn.type = "button";
    oMimeBtn.innerHTML = _fa("image") + "<span></span>";
    oMimeBtn.querySelector("span").textContent = _txt("/U4A/CL_WS_COMMON", "A10");   // MIME Repository — 텍스트 유지(아이콘 전용은 Add/Del 만, 사용자 지시).
    oMimeBtn.addEventListener("click", function () { try { oAPP.fn.fnMimeWindowOpener(); } catch (e) { } });   // 별도창 판(롤백=fnMimeDialogOpener)
    oToolbar.appendChild(oAddBtn);
    oToolbar.appendChild(oDelBtn);
    oToolbar.appendChild(oMimeBtn);
    oBody.appendChild(oToolbar);

    // 공통 테이블(.u4a-table) — 헤더: [전체선택] [Status] [URL] [Exclude?].
    //   래퍼=공통 액자형(.u4a-table-wrap--boxed, AppF4/Insert 와 동일 외형). 행높이=공통 기본(--compact 안 씀).
    var oWrap = _el("div", "u4a-table-wrap u4a-table-wrap--boxed u4aCslTableWrap");
    oWrap.setAttribute("data-view", "table");
    var oTable = _el("table", "u4a-table u4aCslTable");

    var oThead = document.createElement("thead");
    var oThRow = document.createElement("tr");

    var oThChk = _el("th", "u4aCslColChk");
    var oHeadChk = document.createElement("input");
    oHeadChk.type = "checkbox";
    oHeadChk.className = "u4aCslHeadChk";
    oHeadChk.title = "";
    oHeadChk.addEventListener("change", function () {
      var b = oHeadChk.checked;
      oUI.tbody.querySelectorAll(".u4aCslRowChk").forEach(function (c) {
        c.checked = b;
        var tr = c.closest("tr");
        if (tr) { tr.setAttribute("aria-selected", b ? "true" : "false"); }
      });
      lf_syncHeadChk();
    });
    oThChk.appendChild(oHeadChk);
    oThRow.appendChild(oThChk);

    var oColTxtTh = _el("th", "u4aCslColUrl");   // "{TYPE} Link MIME URL" — open 마다 갱신.
    oThRow.appendChild(oColTxtTh);

    var oExcTh = null;
    if (_excludeVisible()) {
      // Exclude(제외처리 여부) — ZMSG_WS_COMMON_001/496(원본). CL_WS_COMMON B67 폴백.
      var sExc = _wsCommon("496");
      if (!sExc) { sExc = _txt("/U4A/CL_WS_COMMON", "B67"); }
      oExcTh = _el("th", "u4aCslColExc", sExc);
      oThRow.appendChild(oExcTh);
    }

    oThead.appendChild(oThRow);
    oTable.appendChild(oThead);

    var oTbody = document.createElement("tbody");
    oTable.appendChild(oTbody);
    oWrap.appendChild(oTable);
    oBody.appendChild(oWrap);
    oDlg.appendChild(oBody);

    // 푸터 — [Save 파랑(편집모드)] [Close Reject].
    var oFoot = _el("div", "u4a-dialog__footer u4aCslFoot");
    oFoot.appendChild(_el("span", "u4aCslFootSpacer"));
    var oSaveBtn = _el("button", "u4a-btn u4a-btn--emphasized u4aCslIcoBtn");
    oSaveBtn.type = "button";
    oSaveBtn.innerHTML = _fa("check");   // 아이콘만 (텍스트 라벨 제거)
    oSaveBtn.title = _txt("/U4A/CL_WS_COMMON", "A64");   // Save
    oSaveBtn.addEventListener("click", function () { lf_save(); });
    oFoot.appendChild(oSaveBtn);
    var oCloseBtn = _el("button", "u4a-btn u4a-btn--negative u4aCslIcoBtn");
    oCloseBtn.type = "button";
    oCloseBtn.innerHTML = _fa("xmark");
    oCloseBtn.title = _txt("/U4A/CL_WS_COMMON", "A39");   // Close
    oCloseBtn.addEventListener("click", function () { lf_close(); });
    oFoot.appendChild(oCloseBtn);
    oDlg.appendChild(oFoot);

    // ESC → 닫기.
    oDlg.addEventListener("cancel", function (e) { e.preventDefault(); lf_close(); });

    // 헤더 드래그(전역) / 더블클릭 리센터 / grip 리사이즈 — 전 팝업 공통.
    if (window.U4AUI && U4AUI.makeDialogRecenter) { U4AUI.makeDialogRecenter(oDlg, oHeader); }
    if (window.U4AUI && U4AUI.makeDialogResizable) { U4AUI.makeDialogResizable(oDlg, { minW: 460, minH: 320 }); }

    document.body.appendChild(oDlg);

    oUI = {
      dlg: oDlg, headerTitle: oHeaderTitle,
      addBtn: oAddBtn, delBtn: oDelBtn, mimeBtn: oMimeBtn, saveBtn: oSaveBtn,
      toolbar: oToolbar, table: oTable, tbody: oTbody, headChk: oHeadChk,
      colTxtTh: oColTxtTh, excTh: oExcTh, seq: 0
    };
  }

  /************************************************************************
   * CSS & JS Link Add 팝업 열기(공개 진입점) — 캐시 재사용.
   * @param {String} TYPE  "CSS" 또는 "JS"
   ************************************************************************/
  oAPP.fn.fnCssJsLinkAddPopupOpen = function (TYPE) {

    if (TYPE !== C_CSS && TYPE !== C_JS) {
      try { oAPP.common.fnSetBusyLock(""); } catch (e) { }
      return;
    }
    oState.type = TYPE;

    // 최초 1회 생성(DOM 에서 사라졌으면 재생성).
    if (!oUI || !document.body.contains(oUI.dlg)) { oUI = null; lf_build(); }

    // 이미 열려 있으면(중복 호출) busy 만 풀고 반환(원본).
    if (oUI.dlg.open) {
      try { oAPP.common.fnSetBusyLock(""); } catch (e) { }
      return;
    }

    var bEdit = _isEdit();

    // 헤더 제목 = 기능명만(CSS Link / JS Link). APPID·모드·상태는 이미 그 앱 안에서 연 모달이라
    //   뒤 메인 창 헤더와 전부 중복 → 생략(팝업 식별엔 기능명만 있으면 충분).
    var sLinkTxt = _txt("/U4A/CL_WS_COMMON", (TYPE === C_JS) ? "D50" : "D49");   // JS Link / CSS Link
    oUI.headerTitle.textContent = sLinkTxt;

    // 컬럼 헤더 = "MIME URL" 만 (팝업 제목이 이미 CSS/JS Link 라 접두 중복 제거).
    oUI.colTxtTh.textContent = _txt("/U4A/CL_WS_COMMON", "D51");   // MIME URL

    // 툴바 버튼 = 아이콘 전용(텍스트 제거) → "{TYPE} Link Add/Del" 는 툴팁으로(발견성 유지).
    var sAdd = _txt("/U4A/CL_WS_COMMON", "C98");   // Add
    var sDel = _txt("/U4A/CL_WS_COMMON", "D52");   // Del
    oUI.addBtn.title = (sLinkTxt + " " + sAdd).trim();
    oUI.delBtn.title = (sLinkTxt + " " + sDel).trim();

    // 편집모드 — 툴바/Save 노출(원본 visible=/WS20/APP/IS_EDIT).
    oUI.toolbar.hidden = !bEdit;
    oUI.saveBtn.hidden = !bEdit;

    // 데이터 로드 + 렌더.
    lf_loadData(TYPE);
    lf_renderRows();

    try { oUI.dlg.showModal(); } catch (e) { }

    // busy 끄고 Lock 풀기(원본 afterOpen).
    try { oAPP.common.fnSetBusyLock(""); } catch (e) { }

  }; // end of oAPP.fn.fnCssJsLinkAddPopupOpen

  /************************************************************************
   * 공통 스타일 1회 주입(테마 토큰 소비 — 하드코딩 색 없음).
   ************************************************************************/
  function lf_ensureStyle() {
    if (document.getElementById("u4aCslStyle")) { return; }
    var oStyle = document.createElement("style");
    oStyle.id = "u4aCslStyle";
    oStyle.textContent =
      ".u4aCslDlg { width: min(94vw, 760px); height: min(86vh, 560px); padding: 0; display: flex; flex-direction: column; }" +
      ".u4aCslDlg .u4a-dialog__header { cursor: move; user-select: none; }" +
      ".u4aCslDlg .u4a-dialog__header span { flex: 1 1 auto; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }" +
      // 바디 = 툴바 + 테이블 세로 스택. min-height:0 으로 테이블이 줄며 스크롤.
      ".u4aCslBody { flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; gap: 0.5rem; padding: 0.75rem; }" +
      ".u4aCslToolbar { flex: 0 0 auto; display: flex; flex-wrap: wrap; gap: 0.5rem; }" +
      ".u4aCslToolbar[hidden] { display: none; }" +
      // 툴바 버튼 = 아웃라인 + 의미색. 색/보더는 의미 클래스가 소유(--negative 빨강이 덮이지 않게 ToolBtn 은 배경만).
      ".u4aCslToolBtn { background: transparent; }" +
      ".u4aCslToolBtn:hover { background: var(--hover-bg); }" +
      ".u4aCslAdd { border-color: var(--accent); color: var(--accent); }" +       // Create = 파랑(아웃라인)
      ".u4aCslMime { border-color: var(--divider); color: var(--text); }" +       // 보조 = 중립

      // 테이블 래퍼 외형(border/radius/bg/scroll)은 공통 .u4a-table-wrap--boxed 가 담당. 여기선 배치만.
      ".u4aCslTableWrap { flex: 1 1 auto; }" +
      // 선택 체크박스 컬럼 = 컴팩트 가운데. URL 컬럼이 남은 폭 흡수.
      ".u4aCslColChk { width: 2.5rem; text-align: center; }" +
      ".u4aCslColExc { width: 7rem; text-align: center; }" +
      ".u4aCslColUrl { width: auto; }" +
      ".u4aCslColChk input, .u4aCslColExc .u4a-switch { vertical-align: middle; }" +
      ".u4aCslColChk input { accent-color: var(--accent); margin: 0; }" +
      // 방어 — 이 테이블 셀엔 의사요소 장식(점/프리픽스) 없음(예기치 않은 ::before/::after 글리프 차단).
      ".u4aCslTable td::before, .u4aCslTable td::after { content: none !important; }" +
      ".u4aCslUrlField { width: 100%; }" +
      ".u4aCslFoot { display: flex; gap: 0.5rem; align-items: center; }" +
      ".u4aCslFootSpacer { flex: 1 1 auto; }" +
      ".u4aCslFoot .u4a-btn[hidden] { display: none; }" +
      ".u4aCslIcoBtn { min-width: 2.5rem; justify-content: center; }";
    document.head.appendChild(oStyle);
  }

})(window, $, oAPP);
