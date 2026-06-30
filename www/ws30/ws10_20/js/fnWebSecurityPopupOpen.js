/************************************************************************
 * Copyright 2020. INFOCG Inc. all rights reserved.
 * ----------------------------------------------------------------------
 * - file Name : fnWebSecurityPopupOpen.js
 * - file Desc : WS20의 Web Security Settings Popup  (HTML5)
 * ----------------------------------------------------------------------
 * [컨버전 메모]
 *  원본: sap.m.Dialog(draggable/resizable 600×600) + customHeader([U4A] Web Security Management)
 *        + 2 패널: ① Access-Control-Allow-Origin(라디오 3 + External Host URL 입력)
 *                  ② X-Frame-Options(라디오 4 + White List sap.ui.table[SID/SRC] 멀티선택 Add/Del)
 *        + footer[Save(accept)/Delete(Negative)/Close(Reject)].
 *        데이터 = oAPP.DATA.APPDATA.S_WSO { ACA:{M01,M02,M03,EUL}, XFO:{M01..M04}, WHIT:[{KEY,SID,SRC}] },
 *        기본값 = S_WSO_DEF. /WS20/WEBSECU 모델 바인딩.
 *
 *  HTML5: native <dialog class="u4a-dialog"> + 공통 컴포넌트(U4AUI.createPanel · .u4a-check[radio] ·
 *        U4AUI.createField · .u4a-table 멀티선택[체크박스 열] · .u4a-btn · makeDialogRecenter/Resizable).
 *        ★ 공통 파일(shell.css/u4a-ui.js) 미수정 — 화면 스코프(.u4aWsec*) 주입 스타일만.
 *
 *  ★ 보존 로직(원본 1:1):
 *    · ACA 라디오(M01 Origin(*)미지정 / M02 현재호스트 / M03 특정호스트). EUL 입력 = 편집 && M03 일 때만.
 *    · XFO 라디오(M01 SameOrigin/ M02 Deny/ M03 Allow-From/ M04 None). White List 편집·Add/Del = 편집 && M03.
 *      XFO 가 M03 이 아니게 바뀌면 WHIT 비움(원본 동일).
 *    · Save: 확인(MSG_WS 010) → M03 이면 SID/SRC 빈 행 제거 → S_WSO 저장 + setAppChange + 저장토스트(002) + 닫기.
 *    · Delete: 확인(MSG_WS 003) → 폼을 기본값(S_WSO_DEF)으로 리셋(영속 X, 닫지 않음 — 원본 동일).
 *    · 저장 후 WS20 동기화(IS_CHAG 미러 + 속성행 변경배경 + 헤더) — DH001026 _isChangedRow=S_WSO≠S_WSO_DEF.
 *  ★ UI5 의존부 치환: sap.m.Dialog→<dialog>, JSONModel→로컬 oState, RadioButtonGroup→.u4a-check radio,
 *    sap.ui.table→.u4a-table, sap.m.Input→createField, EventBus publish→가드 호출(sap 스텁).
 ************************************************************************/

(function (window, $, oAPP) {
  "use strict";

  var APPCOMMON = oAPP.common;

  var C_DLG_ID = "u4aWsWebSecurityDlg";

  // ── 로컬 헬퍼(CSS/JS Link 팝업과 동일 컨벤션) ───────────────────────
  function _fa(s) { return '<i class="fa-solid fa-' + s + '"></i>'; }
  function _txt(sCls, sCode, p1) {
    try { return APPCOMMON.fnGetMsgClsText(sCls, sCode, p1 || "", "", "", ""); }
    catch (e) { return ""; }
  }
  function _wsCommon(sCode, p1) {
    try {
      var sLangu = "";
      try { sLangu = (parent.getUserInfo() || {}).LANGU || ""; } catch (e) { }
      return parent.WSUTIL.getWsMsgClsTxt(sLangu, "ZMSG_WS_COMMON_001", sCode, p1 || "") || "";
    } catch (e) { return ""; }
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
  function _isEdit() {
    try { var o = APPCOMMON.fnGetModelProperty("/WS20/APP"); return !!(o && o.IS_EDIT === "X"); }
    catch (e) { return false; }
  }
  function _msg(sType, sText) {
    if (!sText) { return; }
    try { parent.showMessage(null, 10, sType || "I", sText); } catch (e) { }
  }

  // S_WSO / S_WSO_DEF 보장(쓰기/리셋 전 가드).
  function _ensureData() {
    if (!oAPP.DATA) { oAPP.DATA = {}; }
    if (!oAPP.DATA.APPDATA) { oAPP.DATA.APPDATA = {}; }
    var A = oAPP.DATA.APPDATA;
    if (!A.S_WSO) { A.S_WSO = { ACA: { M01: "X", M02: "", M03: "", EUL: "" }, XFO: { M01: "X", M02: "", M03: "", M04: "" }, WHIT: [] }; }
    if (!A.S_WSO_DEF) { A.S_WSO_DEF = JSON.parse(JSON.stringify(A.S_WSO)); }
    return A;
  }

  // 열려 있는 동안만 참조하는 UI 핸들 + 현재 상태(원본 /WS20/WEBSECU 모델 대응).
  //   ※ 공통 정책상 .u4a-dialog 는 close 시 DOM 에서 제거되므로(u4a-ui.js 전역 close 위임,
  //     data-u4a-keep 미사용) 다음 열기 때 lf_build 로 재생성된다 — 상태 보존 싱글톤이 아님.
  var oUI = null;
  var oState = { aca: null, xfo: null, whit: [], bEdit: false };

  // ── WS20 변경 동기화(CSS/JS Link 팝업 lf_syncWs20Changed 와 동일 3종) ──
  function lf_syncWs20Changed() {
    try {
      var oInfo = parent.getAppInfo && parent.getAppInfo();
      if (oInfo) { oAPP.common.fnSetModelProperty("/WS20/APP/IS_CHAG", oInfo.IS_CHAG || ""); }
    } catch (e) { }
    try { if (oAPP.fn.fnRenderWs20AttrRows) { oAPP.fn.fnRenderWs20AttrRows(); } } catch (e) { }
    try { if (oAPP.fn.fnUpdateWs20AppHeader) { oAPP.fn.fnUpdateWs20AppHeader(); } } catch (e) { }
  }

  // 호출처 콜백(원본 EventBus publish). HTML5 sap 스텁이라 가드.
  function lf_publishCallback(sActcd, oData) {
    try {
      if (window.sap && sap.ui && sap.ui.getCore && sap.ui.getCore().getEventBus) {
        sap.ui.getCore().getEventBus().publish("WS20POPUP", "webSecurityPopupCallback", { ACTCD: sActcd, DATA: oData });
      }
    } catch (e) { }
  }

  function lf_close(bSkipCallback) {
    try { if (oUI && oUI.dlg && oUI.dlg.open) { oUI.dlg.close(); } } catch (e) { }
    if (!bSkipCallback) { lf_publishCallback("CANCEL", undefined); }
  }

  // ── 라디오 선택 인덱스 ↔ 모델(M01..) ─────────────────────────────────
  function lf_acaIdx() { var a = oState.aca || {}; return a.M03 === "X" ? 2 : (a.M02 === "X" ? 1 : 0); }
  function lf_xfoIdx() { var x = oState.xfo || {}; return x.M04 === "X" ? 3 : (x.M03 === "X" ? 2 : (x.M02 === "X" ? 1 : 0)); }
  function lf_setAca(iIdx) {
    var a = oState.aca; a.M01 = a.M02 = a.M03 = "";
    a[iIdx === 2 ? "M03" : (iIdx === 1 ? "M02" : "M01")] = "X";
  }
  function lf_setXfo(iIdx) {
    var x = oState.xfo; x.M01 = x.M02 = x.M03 = x.M04 = "";
    x[iIdx === 3 ? "M04" : (iIdx === 2 ? "M03" : (iIdx === 1 ? "M02" : "M01"))] = "X";
  }

  // ── 편집 가능 상태 동기화(원본 conditional editable) ──────────────────
  //   EUL = 편집 && ACA M03(특정 호스트). White List(편집/Add/Del) = 편집 && XFO M03(Allow-From).
  function lf_applyEnable() {
    var bEdit = oState.bEdit;
    var bAcaSpecific = bEdit && oState.aca.M03 === "X";
    var bXfoAllow = bEdit && oState.xfo.M03 === "X";

    // 라디오는 편집모드에서만.
    [].concat(oUI.acaRadios, oUI.xfoRadios).forEach(function (r) { if (r) { r.disabled = !bEdit; } });
    // EUL 입력.
    if (oUI.eulField) { oUI.eulField.setReadOnly(!bAcaSpecific); }
    // White List Add/Del.
    if (oUI.whitAddBtn) { oUI.whitAddBtn.disabled = !bXfoAllow; }
    if (oUI.whitDelBtn) { oUI.whitDelBtn.disabled = !bXfoAllow; }
  }

  // ── White List 그리드 렌더(USP 트리 패턴 — 헤더 sticky 가 스크롤러 안에서 행과 동일 폭 공유) ──
  function _cell(sMod, oChild) {
    var o = _el("div", "u4aWsecCell u4aWsecCell--" + sMod);
    if (oChild) { o.appendChild(oChild); }
    return o;
  }
  // 단순 제목 섹션(원본 sap.m.Panel headerText = 접이식 아님). createPanel(twisty) 대신 가벼운 제목+본문.
  function _section(sTitle) {
    var sec = _el("div", "u4aWsecSection");
    sec.appendChild(_el("div", "u4aWsecSecTitle", sTitle));
    var body = _el("div", "u4aWsecSecBody");
    sec.appendChild(body);
    return { el: sec, body: body };
  }
  function lf_renderWhit() {
    if (!oUI) { return; }
    var bEditCell = oState.bEdit && oState.xfo.M03 === "X";
    oUI.whitBody.innerHTML = "";

    if (!oState.whit.length) {
      var oEmpty = _el("div", "u4aWsecEmpty", _wsCommon("946"));   // 데이터 없음.
      oUI.whitBody.appendChild(oEmpty);
      lf_syncWhitHead();
      return;
    }

    oState.whit.forEach(function (oRow, i) {
      var oTr = _el("div", "u4aWsecRow");
      oTr.setAttribute("data-key", oRow.KEY);
      if (i % 2 === 1) { oTr.setAttribute("data-odd", "true"); }

      // 선택 체크박스(멀티선택 — 편집 && Allow-From 일 때만).
      var oChkCell = _cell("chk");
      if (bEditCell) {
        var oChk = document.createElement("input");
        oChk.type = "checkbox"; oChk.className = "u4aWsecRowChk";
        oChk.setAttribute("data-key", oRow.KEY);
        oChk.addEventListener("change", function () {
          oTr.setAttribute("aria-selected", oChk.checked ? "true" : "false");
          lf_syncWhitHead();
        });
        oChkCell.appendChild(oChk);
      }
      oTr.appendChild(oChkCell);

      // SID.
      var oSidF = U4AUI.createField({
        type: "text", value: oRow.SID || "", readOnly: !bEditCell, className: "u4aWsecCellField",
        onInput: function (v) { oRow.SID = v; }
      });
      oTr.appendChild(_cell("sid", oSidF.el));

      // Target Host URL(SRC).
      var oSrcF = U4AUI.createField({
        type: "text", value: oRow.SRC || "", readOnly: !bEditCell, className: "u4aWsecCellField",
        onInput: function (v) { oRow.SRC = v; }
      });
      oTr.appendChild(_cell("src", oSrcF.el));

      oUI.whitBody.appendChild(oTr);
    });

    lf_syncWhitHead();
  }

  function lf_syncWhitHead() {
    if (!oUI || !oUI.whitHeadChk) { return; }
    var aChk = oUI.whitBody.querySelectorAll(".u4aWsecRowChk");
    var iTotal = aChk.length, iSel = 0;
    aChk.forEach(function (c) { if (c.checked) { iSel++; } });
    oUI.whitHeadChk.checked = (iTotal > 0 && iSel === iTotal);
    oUI.whitHeadChk.indeterminate = (iSel > 0 && iSel < iTotal);
    oUI.whitHeadChk.disabled = (iTotal === 0);
  }

  // ── White List Add / Del ─────────────────────────────────────────────
  function lf_whitAdd() {
    oState.whit.push({ KEY: _randomKey(), SID: "", SRC: "" });
    lf_renderWhit();
    try {
      var aTr = oUI.whitBody.querySelectorAll(".u4aWsecRow[data-key]");
      var oLast = aTr[aTr.length - 1];
      var oInput = oLast && oLast.querySelector(".u4aWsecCell--sid input");
      if (oInput) { oInput.focus(); }
    } catch (e) { }
  }
  function lf_whitDelSel() {
    var aChk = oUI.whitBody.querySelectorAll(".u4aWsecRowChk");
    var oDel = {}, iCnt = 0;
    aChk.forEach(function (c) { if (c.checked) { oDel[c.getAttribute("data-key")] = true; iCnt++; } });
    if (iCnt === 0) { _msg("W", _wsCommon("240")); return; }   // 선택된 항목이 없습니다.
    oState.whit = oState.whit.filter(function (r) { return !oDel[r.KEY]; });
    lf_renderWhit();
  }

  // ── 저장(원본 ev_pressWebSecuritySave + CB) ──────────────────────────
  function lf_save() {
    if (!_isEdit()) { return; }
    var sMsg = _txt("/U4A/MSG_WS", "010");   // 저장하시겠습니까?
    try {
      parent.showMessage(null, 30, "I", sMsg, function (sAct) { if (sAct === "YES") { lf_doSave(); } });
    } catch (e) { lf_doSave(); }
  }
  // 변경표시 판정(_isChangedRow DH001026)은 JSON.stringify(S_WSO)===JSON.stringify(S_WSO_DEF) 바이트 비교다.
  // 폼이 기본값과 "논리적으로" 같으면(키 순서·WHIT KEY 등 구조 차 무시) S_WSO 를 DEF 의 복사본으로 대입해
  // 바이트 일치 → 변경표시 원복(원본 Save 가 모델=DEF 복사본을 통째로 넣던 것과 동일 효과).
  function _wsoCanon(o) {
    o = o || {};
    var a = o.ACA || {}, x = o.XFO || {}, w = Array.isArray(o.WHIT) ? o.WHIT : [];
    return JSON.stringify({
      ACA: { M01: a.M01 || "", M02: a.M02 || "", M03: a.M03 || "", EUL: a.EUL || "" },
      XFO: { M01: x.M01 || "", M02: x.M02 || "", M03: x.M03 || "", M04: x.M04 || "" },
      WHIT: w.map(function (r) { return { SID: r.SID || "", SRC: r.SRC || "" }; })
    });
  }
  function lf_doSave() {
    var A = _ensureData();

    // Allow-From(M03) 이면 SID/SRC 한쪽이라도 빈 White List 행 제거(원본 — 양쪽 채운 행만 보존).
    // M03 이 아니면 WHIT 비움 — invariant("XFO≠M03 ⇒ WHIT 없음") 저장 시 최종 방어(라디오 변경
    // 이벤트가 누락된 비정상 데이터로 열어 바로 저장해도 잔존 화이트리스트가 따라가지 않도록).
    var aWhit = oState.whit;
    if (oState.xfo.M03 === "X") {
      aWhit = aWhit.filter(function (r) { return (r.SID || "") !== "" && (r.SRC || "") !== ""; });
    } else {
      aWhit = [];
    }

    var oBuilt = {
      ACA: { M01: oState.aca.M01 || "", M02: oState.aca.M02 || "", M03: oState.aca.M03 || "", EUL: (oUI.eulField ? oUI.eulField.getValue() : (oState.aca.EUL || "")) },
      XFO: { M01: oState.xfo.M01 || "", M02: oState.xfo.M02 || "", M03: oState.xfo.M03 || "", M04: oState.xfo.M04 || "" },
      WHIT: aWhit.map(function (r) { return { SID: r.SID || "", SRC: r.SRC || "" }; })
    };

    // 기본값과 논리적으로 동일하면 DEF 복사본(바이트 일치) → 변경표시 원복. 아니면 빌드값 저장.
    A.S_WSO = (_wsoCanon(oBuilt) === _wsoCanon(A.S_WSO_DEF))
      ? JSON.parse(JSON.stringify(A.S_WSO_DEF))
      : oBuilt;

    try { parent.setAppChange("X"); } catch (e) { }
    lf_syncWs20Changed();

    lf_close(true);
    _msg("S", _txt("/U4A/MSG_WS", "002"));   // 저장 완료.
    lf_publishCallback("SAVE", A.S_WSO);
  }

  // ── 삭제 = 기본값 리셋(원본 ev_pressWebSecurityDel + CB) ──────────────
  function lf_delReset() {
    if (!_isEdit()) { return; }
    var sMsg = _txt("/U4A/MSG_WS", "003");   // 정말 삭제하시겠습니까?
    try {
      parent.showMessage(null, 30, "W", sMsg, function (sAct) { if (sAct === "YES") { lf_doReset(); } });
    } catch (e) { lf_doReset(); }
  }
  function lf_doReset() {
    var A = _ensureData();
    var oDef = JSON.parse(JSON.stringify(A.S_WSO_DEF || {}));
    lf_loadState(oDef);   // 폼만 기본값으로(영속 X — 원본 동일, 닫지 않음).
    lf_applyAll();
  }

  // ── oState 를 S_WSO(또는 기본값) 로 로드 ─────────────────────────────
  function lf_loadState(oData) {
    oData = oData || {};
    var a = oData.ACA || {}, x = oData.XFO || {}, w = Array.isArray(oData.WHIT) ? oData.WHIT : [];
    oState.aca = { M01: a.M01 || "", M02: a.M02 || "", M03: a.M03 || "", EUL: a.EUL || "" };
    oState.xfo = { M01: x.M01 || "", M02: x.M02 || "", M03: x.M03 || "", M04: x.M04 || "" };
    // 기본 선택 보정(아무것도 없으면 첫 항목).
    if (!oState.aca.M01 && !oState.aca.M02 && !oState.aca.M03) { oState.aca.M01 = "X"; }
    if (!oState.xfo.M01 && !oState.xfo.M02 && !oState.xfo.M03 && !oState.xfo.M04) { oState.xfo.M01 = "X"; }
    oState.whit = w.map(function (r) { return { KEY: _randomKey(), SID: r.SID || "", SRC: r.SRC || "" }; });
  }

  // ── 현재 oState 를 화면 전체에 반영 ──────────────────────────────────
  function lf_applyAll() {
    // 라디오 체크.
    var iAca = lf_acaIdx(); oUI.acaRadios.forEach(function (r, i) { if (r) { r.checked = (i === iAca); } });
    var iXfo = lf_xfoIdx(); oUI.xfoRadios.forEach(function (r, i) { if (r) { r.checked = (i === iXfo); } });
    // EUL 값.
    if (oUI.eulField) { oUI.eulField.setValue(oState.aca.EUL || ""); }
    lf_renderWhit();
    lf_applyEnable();
  }

  /************************************************************************
   * 다이얼로그 생성(매 열기마다 — close 시 공통 정책으로 DOM 제거되므로 재생성).
   ************************************************************************/
  function lf_build() {
    lf_ensureStyle();

    var oDlg = document.createElement("dialog");
    oDlg.id = C_DLG_ID;
    oDlg.className = "u4a-dialog u4aWsecDlg";

    // 헤더 — shield 아이콘 + "[U4A] Web Security Management" + 닫기 X.
    var oHeader = _el("div", "u4a-dialog__header");
    oHeader.innerHTML = _fa("shield-halved") + "<span></span>";
    oHeader.querySelector("span").textContent = "[U4A] " + _txt("/U4A/CL_WS_COMMON", "C86");
    var oXBtn = _el("button", "u4a-btn-icon");
    oXBtn.type = "button";
    oXBtn.innerHTML = _fa("xmark");
    oXBtn.title = _txt("/U4A/CL_WS_COMMON", "A39");   // Close
    oXBtn.addEventListener("click", function () { lf_close(); });
    oHeader.appendChild(oXBtn);
    oDlg.appendChild(oHeader);

    var oBody = _el("div", "u4a-dialog__body u4aWsecBody");

    // ── 섹션1: Access-Control-Allow-Origin ──
    var oAcaPanel = _section(_txt("/U4A/CL_WS_COMMON", "C89"));
    oUI = oUI || {};
    oUI.acaRadios = [];
    var oAcaGroup = _el("div", "u4aWsecRadioCol");
    [["C90"], ["C91"], ["C92"]].forEach(function (a, i) {
      var oLab = _el("label", "u4a-check");
      var oIn = document.createElement("input");
      oIn.type = "radio"; oIn.name = "u4aWsecAca";
      oIn.addEventListener("change", function () { if (oIn.checked) { lf_setAca(i); lf_applyEnable(); } });
      var oSp = _el("span", "", _txt("/U4A/CL_WS_COMMON", a[0]));
      oLab.appendChild(oIn); oLab.appendChild(oSp);
      oAcaGroup.appendChild(oLab);
      oUI.acaRadios.push(oIn);
    });
    oAcaPanel.body.appendChild(oAcaGroup);

    // External Host URL 행.
    var oEulRow = _el("div", "u4aWsecFieldRow");
    oEulRow.appendChild(_el("span", "u4aWsecFieldLbl", _txt("/U4A/CL_WS_COMMON", "C73")));   // External Host URL
    var oEulField = U4AUI.createField({ type: "text", value: "", className: "u4aWsecEul", onInput: function (v) { oState.aca.EUL = v; } });
    oEulRow.appendChild(oEulField.el);
    oAcaPanel.body.appendChild(oEulRow);
    oUI.eulField = oEulField;
    oBody.appendChild(oAcaPanel.el);

    // ── 섹션2: X-Frame-Options ──
    var oXfoPanel = _section(_txt("/U4A/CL_WS_COMMON", "C87"));
    oUI.xfoRadios = [];
    var oXfoGroup = _el("div", "u4aWsecRadioRow");
    [["C93"], ["C94"], ["C95"], ["C96"]].forEach(function (a, i) {
      var oLab = _el("label", "u4a-check");
      var oIn = document.createElement("input");
      oIn.type = "radio"; oIn.name = "u4aWsecXfo";
      oIn.addEventListener("change", function () {
        if (!oIn.checked) { return; }
        lf_setXfo(i);
        // Allow-From(M03) 이 아니게 바뀌면 White List 비움(원본).
        if (oState.xfo.M03 !== "X" && oState.whit.length) { oState.whit = []; }
        lf_renderWhit();
        lf_applyEnable();
      });
      var oSp = _el("span", "", _txt("/U4A/CL_WS_COMMON", a[0]));
      oLab.appendChild(oIn); oLab.appendChild(oSp);
      oXfoGroup.appendChild(oLab);
      oUI.xfoRadios.push(oIn);
    });
    oXfoPanel.body.appendChild(oXfoGroup);

    // White List 그룹(툴바 + 테이블을 한 박스로 — 버튼은 테이블에 종속).
    var oWhitGroup = _el("div", "u4aWsecWhitGroup");

    // White List 툴바([White List] ···· [Add][Del]).
    var oWhitBar = _el("div", "u4aWsecWhitBar");
    oWhitBar.appendChild(_el("span", "u4aWsecWhitLbl", _txt("/U4A/CL_WS_COMMON", "C97")));   // White List
    oWhitBar.appendChild(_el("span", "u4aWsecBarSpacer"));
    var oAddBtn = _el("button", "u4a-btn u4aWsecToolBtn u4aWsecAdd");
    oAddBtn.type = "button"; oAddBtn.innerHTML = _fa("file-circle-plus");
    oAddBtn.title = _txt("/U4A/CL_WS_COMMON", "C98");   // Add
    oAddBtn.addEventListener("click", function () { lf_whitAdd(); });
    var oDelBtn = _el("button", "u4a-btn u4aWsecToolBtn u4a-btn--negative");
    oDelBtn.type = "button"; oDelBtn.innerHTML = _fa("trash");
    oDelBtn.title = _txt("/U4A/CL_WS_COMMON", "A03");   // Delete
    oDelBtn.addEventListener("click", function () { lf_whitDelSel(); });
    oWhitBar.appendChild(oAddBtn); oWhitBar.appendChild(oDelBtn);
    oWhitGroup.appendChild(oWhitBar);
    oUI.whitAddBtn = oAddBtn; oUI.whitDelBtn = oDelBtn;

    // White List 그리드(USP 트리 패턴 — 헤더를 스크롤 컨테이너 "안"에 sticky 로 두어 헤더/행이
    //   동일 폭 컨텍스트(스크롤바 영향·box-sizing 동일)를 공유 → 컬럼 자동 정렬, JS 거터 보정 불필요).
    var oGrid = _el("div", "u4aWsecGrid");      // 고정 height 스크롤러(원본 sap.ui.table 영역).

    // 헤더(스크롤러 안 sticky — usp.css .u4aWs30TreeColHead 와 동일).
    var oHead = _el("div", "u4aWsecHead");
    var oHChkCell = _cell("chk");
    var oHeadChk = document.createElement("input");
    oHeadChk.type = "checkbox"; oHeadChk.className = "u4aWsecHeadChk";
    oHeadChk.addEventListener("change", function () {
      var b = oHeadChk.checked;
      oUI.whitBody.querySelectorAll(".u4aWsecRowChk").forEach(function (c) {
        c.checked = b; var tr = c.closest(".u4aWsecRow"); if (tr) { tr.setAttribute("aria-selected", b ? "true" : "false"); }
      });
      lf_syncWhitHead();
    });
    oHChkCell.appendChild(oHeadChk); oHead.appendChild(oHChkCell);
    oHead.appendChild(_cell("sid", _el("span", "", _txt("/U4A/CL_WS_COMMON", "D83"))));   // SID
    oHead.appendChild(_cell("src", _el("span", "", _txt("/U4A/CL_WS_COMMON", "C71"))));   // Target Host URL
    oGrid.appendChild(oHead);

    // 행 컨테이너(헤더의 형제 — 헤더는 sticky 라 클리어 대상에서 보존).
    var oList = _el("div", "u4aWsecList");
    oGrid.appendChild(oList);

    oWhitGroup.appendChild(oGrid);
    oXfoPanel.body.appendChild(oWhitGroup);
    oUI.whitBody = oList; oUI.whitHead = oHead; oUI.whitHeadChk = oHeadChk;
    oBody.appendChild(oXfoPanel.el);

    oDlg.appendChild(oBody);

    // 푸터 — [Save 파랑] [Delete 빨강] [Close Reject]. (Save/Delete 는 편집모드만)
    var oFoot = _el("div", "u4a-dialog__footer u4aWsecFoot");
    oFoot.appendChild(_el("span", "u4aWsecFootSpacer"));
    var oSaveBtn = _el("button", "u4a-btn u4a-btn--emphasized u4aWsecIcoBtn");
    oSaveBtn.type = "button"; oSaveBtn.innerHTML = _fa("check");   // 아이콘만(텍스트 제거 — Close 와 통일)
    oSaveBtn.title = _txt("/U4A/CL_WS_COMMON", "A64");   // Save
    oSaveBtn.addEventListener("click", function () { lf_save(); });
    var oDelFootBtn = _el("button", "u4a-btn u4a-btn--negative u4aWsecIcoBtn");
    oDelFootBtn.type = "button"; oDelFootBtn.innerHTML = _fa("trash");   // 아이콘만
    oDelFootBtn.title = _txt("/U4A/CL_WS_COMMON", "A03");   // Delete(기본값 리셋)
    oDelFootBtn.addEventListener("click", function () { lf_delReset(); });
    var oCloseBtn = _el("button", "u4a-btn u4a-btn--negative u4aWsecIcoBtn u4aWsecClose");
    oCloseBtn.type = "button"; oCloseBtn.innerHTML = _fa("xmark");
    oCloseBtn.title = _txt("/U4A/CL_WS_COMMON", "A39");   // Close
    oCloseBtn.addEventListener("click", function () { lf_close(); });
    oFoot.appendChild(oSaveBtn); oFoot.appendChild(oDelFootBtn); oFoot.appendChild(oCloseBtn);
    oDlg.appendChild(oFoot);
    oUI.saveBtn = oSaveBtn; oUI.delFootBtn = oDelFootBtn;

    oDlg.addEventListener("cancel", function (e) { e.preventDefault(); lf_close(); });

    if (window.U4AUI && U4AUI.makeDialogRecenter) { U4AUI.makeDialogRecenter(oDlg, oHeader); }
    if (window.U4AUI && U4AUI.makeDialogResizable) { U4AUI.makeDialogResizable(oDlg, { minW: 460, minH: 360 }); }

    document.body.appendChild(oDlg);

    oUI.dlg = oDlg;
    oUI.seq = 0;
  }

  /************************************************************************
   * Web Security Settings 팝업 열기(공개 진입점) — 이전 인스턴스가 DOM 에 없으면 재생성.
   ************************************************************************/
  oAPP.fn.fnWebSecurityPopupOpen = function () {

    _ensureData();

    if (!oUI || !oUI.dlg || !document.body.contains(oUI.dlg)) { oUI = null; lf_build(); }

    if (oUI.dlg.open) {
      try { oAPP.common.fnSetBusyLock(""); } catch (e) { }
      return;
    }

    oState.bEdit = _isEdit();

    // 현재 저장값(S_WSO) 로드 + 화면 반영.
    lf_loadState(JSON.parse(JSON.stringify(oAPP.DATA.APPDATA.S_WSO || {})));
    lf_applyAll();

    // 편집모드에서만 Save/Delete 노출(원본 visible=/WS20/APP/IS_EDIT).
    oUI.saveBtn.hidden = !oState.bEdit;
    oUI.delFootBtn.hidden = !oState.bEdit;

    try { oUI.dlg.showModal(); } catch (e) { }

    // busy 끄고 Lock 풀기(원본 afterOpen).
    try { oAPP.common.fnSetBusyLock(""); } catch (e) { }

  }; // end of oAPP.fn.fnWebSecurityPopupOpen

  /************************************************************************
   * 공통 스타일 1회 주입(테마 토큰 소비 — 공통 파일 미수정, 화면 스코프만).
   ************************************************************************/
  function lf_ensureStyle() {
    if (document.getElementById("u4aWsecStyle")) { return; }
    var oStyle = document.createElement("style");
    oStyle.id = "u4aWsecStyle";
    oStyle.textContent =
      ".u4aWsecDlg { width: min(94vw, 640px); height: min(88vh, 660px); padding: 0; display: flex; flex-direction: column; }" +
      ".u4aWsecDlg .u4a-dialog__header { cursor: move; user-select: none; }" +
      ".u4aWsecDlg .u4a-dialog__header span { flex: 1 1 auto; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }" +
      ".u4aWsecBody { flex: 1 1 auto; min-height: 0; overflow: auto; display: flex; flex-direction: column; gap: 1.25rem; padding: 0.875rem; }" +
      // 제목 섹션(원본 sap.m.Panel headerText = 접이식 아님) — 카드 크롬 없이 제목 + 본문 flat.
      ".u4aWsecSection { display: flex; flex-direction: column; }" +
      ".u4aWsecSecTitle { font-weight: 700; color: var(--text); padding-bottom: 0.5rem; margin-bottom: 0.875rem; border-bottom: 0.0625rem solid var(--line); }" +
      ".u4aWsecSecBody { display: flex; flex-direction: column; gap: 0.875rem; }" +
      // 라디오 배치(ACA=세로, XFO=가로 wrap).
      ".u4aWsecRadioCol { display: flex; flex-direction: column; gap: 0.625rem; }" +
      ".u4aWsecRadioRow { display: flex; flex-wrap: wrap; gap: 0.625rem 1.5rem; }" +
      ".u4aWsecRadioCol .u4a-check, .u4aWsecRadioRow .u4a-check { margin: 0; }" +
      // External Host URL 행.
      ".u4aWsecFieldRow { display: flex; align-items: center; gap: 0.75rem; }" +
      ".u4aWsecFieldLbl { flex: 0 0 auto; min-width: 9rem; color: var(--text-muted, var(--text)); }" +
      ".u4aWsecEul { flex: 1 1 auto; }" +
      // White List 그룹 — 툴바가 그리드 상단에 붙는 한 박스.
      ".u4aWsecWhitGroup { display: flex; flex-direction: column; }" +
      ".u4aWsecWhitBar { display: flex; align-items: center; gap: 0.5rem; padding: 0.375rem 0.5rem; border: 0.0625rem solid var(--line); border-bottom: 0; border-radius: var(--radius) var(--radius) 0 0; background: var(--surface); }" +
      ".u4aWsecWhitLbl { font-weight: 600; }" +
      ".u4aWsecBarSpacer { flex: 1 1 auto; }" +
      ".u4aWsecToolBtn { background: transparent; min-width: 2.25rem; padding: 0.4rem 0.6rem; justify-content: center; }" +
      ".u4aWsecToolBtn:hover { background: var(--hover-bg); }" +
      ".u4aWsecAdd { border-color: var(--accent); color: var(--accent); }" +
      // ── White List 그리드(USP 트리 패턴) — .u4aWsecGrid 자체가 고정 height 스크롤러.
      //   헤더(.u4aWsecHead)는 그 "안"에 sticky → 행과 동일 폭 컨텍스트 공유 → 컬럼 자동 정렬.
      //   ★ 원본 sap.ui.table 처럼 영역을 기본 height 로 고정 → 적으면 빈 공간, 많으면 이 안에서만 스크롤.
      ".u4aWsecGrid { height: 13rem; overflow-x: hidden; overflow-y: auto; border: 0.0625rem solid var(--line); border-top: 0; border-radius: 0 0 var(--radius) var(--radius); background: var(--surface); }" +
      ".u4aWsecHead { position: sticky; top: 0; z-index: 1; display: flex; align-items: center; height: var(--control-h, 2.5rem); box-sizing: border-box; border-bottom: 0.0625rem solid var(--line); background: var(--surface); font-weight: 600; color: var(--text-muted); }" +
      ".u4aWsecRow { display: flex; align-items: center; min-height: var(--row-h, 2.5rem); box-sizing: border-box; border-bottom: 0.0625rem solid var(--line); }" +
      ".u4aWsecRow:last-child { border-bottom: 0; }" +
      ".u4aWsecRow[aria-selected=\"true\"] { background: var(--selected-bg); }" +
      ".u4aWsecRow:hover { background: var(--hover-bg); }" +
      // 셀 — 헤더/바디 공통 flex-basis(컬럼 정렬 단일 출처).
      ".u4aWsecCell { box-sizing: border-box; display: flex; align-items: center; min-width: 0; padding: 0.25rem 0.5rem; }" +
      ".u4aWsecCell--chk { flex: 0 0 2.5rem; justify-content: center; padding-left: 0; padding-right: 0; }" +
      ".u4aWsecCell--sid { flex: 0 0 9rem; }" +
      ".u4aWsecCell--src { flex: 1 1 auto; }" +
      // ★ 헤더 라벨을 입력칸 텍스트 시작점에 정렬 — 입력칸 내부 패딩(.u4a-input 0.625rem)만큼
      //   헤더 라벨을 더 들여써야 헤더가 칸 위에 정확히 얹힌다(셀 0.5rem + 입력 0.625rem).
      ".u4aWsecHead .u4aWsecCell--sid, .u4aWsecHead .u4aWsecCell--src { padding-left: 1.125rem; }" +
      ".u4aWsecCell input[type=\"checkbox\"] { accent-color: var(--accent); margin: 0; }" +
      ".u4aWsecCellField { width: 100%; min-width: 0; }" +
      ".u4aWsecCellField .u4a-input { min-width: 0; }" +
      // 데이터 없음 — 헤더(2.5rem) 제외 잔여 영역 중앙(고정 13rem 내, 스크롤 안 생기게).
      ".u4aWsecEmpty { min-height: 10rem; display: flex; align-items: center; justify-content: center; color: var(--text-muted); }" +
      // 푸터.
      ".u4aWsecFoot { display: flex; gap: 0.5rem; align-items: center; }" +
      ".u4aWsecFootSpacer { flex: 1 1 auto; }" +
      ".u4aWsecFoot .u4a-btn[hidden] { display: none; }" +
      ".u4aWsecIcoBtn { min-width: 2.5rem; justify-content: center; }";
    document.head.appendChild(oStyle);
  }

})(window, $, oAPP);
