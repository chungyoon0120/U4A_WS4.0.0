/************************************************************************
 * Copyright 2020. INFOCG Inc. all rights reserved.
 * ----------------------------------------------------------------------
 * - file Name : ws_html5_client_editor.js
 * - file Desc : Client Event(JavaScript/HTML) Editor Popup  (HTML5)
 * ----------------------------------------------------------------------
 * [컨버전 메모]
 *  원본: js/fnClientEditorPopupOpen.js — sap.m.Dialog(draggable/resizable 50%×500px)
 *        + customHeader Toolbar(syntax 아이콘 + "{TITLE} -- {OBJID}" + 닫기)
 *        + content: sap.ui.codeeditor.CodeEditor(ACE, solarized_dark)
 *        + footer: Pretty Print(C25) / Save(accept) / Delete(delete) / Close(decline)
 *          — Save/Delete/Pretty 는 /WS20/APP/IS_EDIT 바인딩(편집모드에서만 노출).
 *        데이터는 oAPP.DATA.APPDATA.T_CEVT(OBJID/OBJTY/DATA) upsert/splice.
 *
 *  HTML5: native <dialog class="u4a-dialog"> + 공통 컴포넌트(.u4a-btn / .u4a-btn-icon /
 *        makeDialogRecenter / makeDialogResizable / 전역 헤더드래그) +
 *        코드 에디터는 **.analy 00번 §6 표준**(sap.ui.codeeditor 미사용 → Monaco iframe)에
 *        따라 **별도 범용 Monaco 호스트**(js/codeeditor/index.html, USP 호스트와 분리)를 임베드.
 *
 *  ★ 보존 로직(원본 그대로):
 *    · TITLE/TYPE 결정(JS=B61 javascript / HM=B62 html)
 *    · afterOpen 데이터 로드(T_CEVT 에서 OBJID 매칭 → 에디터 값)
 *    · Save: 빈값=해당 라인 splice(없으면 무시) / 값=upsert, setAppChange + 저장토스트(002)
 *      + 콜백(param "X"=스크립트 존재 / ""=없음)
 *    · Delete: 에디터 내용만 비움(실제 삭제는 Save 시점, 원본 ev_pressClientEditorDel 동일)
 *    · Pretty Print: 에디터 포맷 실행
 *  ★ UI5 의존부 치환:
 *    · sap.ui.codeeditor.CodeEditor → 범용 Monaco 호스트 iframe(postMessage 프로토콜)
 *    · JSONModel 바인딩            → 로컬 상태 + 직접 DOM/iframe 동기
 *    · parent.showMessage(sap,…)   → parent.showMessage(null,…)
 *    · IS_EDIT 모델 바인딩          → /WS20/APP IS_EDIT 직접 조회
 ************************************************************************/

(function (window, $, oAPP) {
  "use strict";

  var APPCOMMON = oAPP.common;

  // 호스트(iframe) 통신 채널 식별자 — 다른 에디터와 충돌 방지용 고정 HOSTID.
  var C_DLG_ID = "u4aWsClientEditorDlg",
      C_HOSTID = "U4ACLIED",
      C_JS = "JS",
      C_HTML = "HM";

  // ── 로컬 헬퍼(자기완결 — createEventPopup 과 동일 컨벤션) ─────────────
  function _fa(s) { return '<i class="fa-solid fa-' + s + '"></i>'; }
  function _txt(sCls, sCode, p1, p2, p3, p4) {
    try { return APPCOMMON.fnGetMsgClsText(sCls, sCode, p1 || "", p2 || "", p3 || "", p4 || ""); }
    catch (e) { return ""; }
  }
  function _el(sTag, sClass, sText) {
    var o = document.createElement(sTag);
    if (sClass) { o.className = sClass; }
    if (typeof sText !== "undefined") { o.textContent = sText; }
    return o;
  }

  // 현재 화면 편집모드 여부(원본 /WS20/APP/IS_EDIT 바인딩 대응).
  function _isEdit() {
    try { var o = APPCOMMON.fnGetModelProperty("/WS20/APP"); return !!(o && o.IS_EDIT === "X"); }
    catch (e) { return false; }
  }

  // 셸 테마(다크/라이트)에 맞춰 Monaco 빌트인 테마 선택 — body 배경 휘도로 판정(토큰 비결합).
  function _editorTheme() {
    try {
      var c = getComputedStyle(document.body).backgroundColor || "";
      var m = c.match(/(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
      if (!m) { return "vs-dark"; }
      var lum = 0.299 * (+m[1]) + 0.587 * (+m[2]) + 0.114 * (+m[3]);
      return lum < 128 ? "vs-dark" : "vs";
    } catch (e) { return "vs-dark"; }
  }

  // T_CEVT 배열 보장(쓰기 전 가드).
  function _ensureCevt() {
    if (!oAPP.DATA) { oAPP.DATA = {}; }
    if (!oAPP.DATA.APPDATA) { oAPP.DATA.APPDATA = {}; }
    if (!Array.isArray(oAPP.DATA.APPDATA.T_CEVT)) { oAPP.DATA.APPDATA.T_CEVT = []; }
    return oAPP.DATA.APPDATA.T_CEVT;
  }

  /************************************************************************
   * 단일 인스턴스(원본 UI5 동일) — 다이얼로그+Monaco 호스트를 1회 생성 후 재사용한다.
   * ----------------------------------------------------------------------
   *  ★ 안정성: 열 때마다 iframe+Monaco 를 새로 만들고 파기하면(구 변환) Monaco 의 워커/모듈
   *    그래프가 매번 churn 되어 반복 open/close 시 렌더러가 행 걸린다. 원본은 sap core 에
   *    다이얼로그 1개만 만들고 재오픈했다 → 여기서도 캐시(oUI)를 두고 재사용한다.
   *    열기 = 값/언어/readonly 갱신 + showModal, 닫기 = close()(숨김, 제거 X).
   *  · 버튼/메시지/테마 핸들러는 closure 가 아니라 가변 상태(oState)를 읽어 재사용에 견딘다.
   *  · 영속 리스너(message/u4a-theme-changed)는 다이얼로그 수명과 같아 1회만 등록(누적 없음).
   ************************************************************************/

  // 단일 캐시(생성 후 세션 동안 유지) + 현재 open 의 가변 상태.
  var oUI = null;            // { dlg, frame, headerTitle, prettyBtn, saveBtn, delBtn, ready }
  var oState = { sObjTy: C_JS, sObjId: "", sLang: "javascript", bEdit: false, fnCallback: null };
  var iWatch = null;         // 최초 로드 busy 워치독.

  // busy/단축키 잠금(최초 로드 동안만 — 재사용 open 은 즉시라 불필요).
  var bBusy = false;
  function lf_busyOn() {
    if (bBusy) { return; }
    bBusy = true;
    try { parent.setBusy("X"); } catch (e) { }
    try { oAPP.fn.setShortcutLock(true); } catch (e) { }
  }
  function lf_busyOff() {
    if (!bBusy) { return; }
    bBusy = false;
    try { parent.setBusy(""); } catch (e) { }
    try { oAPP.fn.setShortcutLock(false); } catch (e) { }
  }

  // 호스트(iframe)로 명령 전송.
  function lf_toHost(oMsg) {
    try {
      oMsg = oMsg || {};
      oMsg.__u4ace = true;
      oMsg.hostId = C_HOSTID;
      if (oUI && oUI.frame && oUI.frame.contentWindow) { oUI.frame.contentWindow.postMessage(oMsg, "*"); }
    } catch (e) { }
  }

  // 현재 스크립트 값(T_CEVT 에서 OBJID/OBJTY 매칭) — 상태는 oState 에서 읽는다.
  function lf_getScriptData() {
    try {
      var a = _ensureCevt();
      var o = a.find(function (x) { return x && x.OBJID === oState.sObjId && x.OBJTY === oState.sObjTy; });
      return (o && typeof o.DATA === "string") ? o.DATA : "";
    } catch (e) { return ""; }
  }

  function lf_readEditor() {
    try { return oUI.frame.contentWindow.editor.getValue(); } catch (e) { return null; }
  }

  function lf_toastSaved() {
    // 002 Saved success
    try { parent.showMessage(null, 10, "S", _txt("/U4A/MSG_WS", "002")); } catch (e) { }
  }

  // 저장(원본 ev_pressClientEditorSave 1:1) — 상태는 oState 에서 읽는다.
  function lf_save() {
    var sVal = lf_readEditor();
    if (sVal === null) { return; }   // 에디터 미준비.

    var aCevt = _ensureCevt();
    var iIdx = aCevt.findIndex(function (x) { return x && x.OBJID === oState.sObjId && x.OBJTY === oState.sObjTy; });

    if (sVal === "") {
      // 입력값 없음 — 기존 라인 있으면 삭제.
      if (iIdx >= 0) {
        aCevt.splice(iIdx, 1);
        try { parent.setAppChange("X"); } catch (e) { }
      }
      lf_toastSaved();
      if (typeof oState.fnCallback === "function") { try { oState.fnCallback(""); } catch (e) { } }
      return;
    }

    // 입력값 있음 — upsert.
    if (iIdx >= 0) {
      aCevt[iIdx].DATA = sVal;
      aCevt[iIdx].OBJTY = oState.sObjTy;
    } else {
      aCevt.push({ OBJID: oState.sObjId, OBJTY: oState.sObjTy, DATA: sVal });
    }
    try { parent.setAppChange("X"); } catch (e) { }
    lf_toastSaved();
    if (typeof oState.fnCallback === "function") { try { oState.fnCallback("X"); } catch (e) { } }
  }

  // 삭제(원본 ev_pressClientEditorDel) — 에디터 내용만 비움.
  function lf_clear() { lf_toHost({ cmd: "setValue", value: "" }); }

  // 팝업 닫기 — ★제거하지 않고 숨기기만★(재사용). busy 해제. 리스너/iframe 은 유지.
  function lf_close() {
    try { clearTimeout(iWatch); } catch (e) { }
    lf_busyOff();
    try { if (oUI && oUI.dlg && oUI.dlg.open) { oUI.dlg.close(); } } catch (e) { }
  }

  // 현재 oState 를 에디터에 반영(언어/readonly/값/포커스).
  function lf_applyContent() {
    lf_toHost({ cmd: "setLanguage", language: oState.sLang });
    lf_toHost({ cmd: "setReadOnly", readOnly: !oState.bEdit });
    lf_toHost({ cmd: "setValue", value: lf_getScriptData() });
    if (oState.bEdit) { lf_toHost({ cmd: "focus" }); }
  }

  // 푸터 줌 표시/원복 버튼 갱신 — "NNN%" 상시 표시(숫자라 i18n 키 불필요).
  function lf_setZoom(pct) {
    if (!oUI || !oUI.zoomBtn) { return; }
    var n = (typeof pct === "number" && isFinite(pct)) ? pct : 100;
    var oSpan = oUI.zoomBtn.querySelector("span");
    if (oSpan) { oSpan.textContent = n + "%"; }
    oUI.zoomBtn.title = n + "% (Ctrl+0)";
  }

  // 호스트 → 팝업 메시지(ready/change/save/zoom). 자기 HOSTID 만.
  function lf_onMessage(oEvent) {
    var d = oEvent && oEvent.data;
    if (!d || d.__u4ace !== true || d.hostId !== C_HOSTID) { return; }
    if (d.evt === "ready") {
      if (oUI) { oUI.ready = true; }
      try { clearTimeout(iWatch); } catch (e) { }
      lf_applyContent();   // 최초 로드 완료 → 현재 oState 기준 값/포커스 주입.
      lf_busyOff();
      return;
    }
    if (d.evt === "zoom") { lf_setZoom(d.pct); return; }
    if (d.evt === "save") {
      // 에디터 한정 Ctrl+S → 저장(✓) 위임. 편집모드일 때만(표시모드는 ✓ 자체가 숨김 = 저장 불가).
      if (oState.bEdit) { lf_save(); }
      return;
    }
  }

  // ── 라이브 테마 변경 → Monaco 테마 동기화 ─────────────────────────
  //   다이얼로그(.u4a-dialog)는 토큰 CSS 라 자동 재테마되지만, Monaco 는 생성 시 테마를 한 번만
  //   받으므로 다른 곳에서 테마를 바꿔도 에디터만 안 바뀌던 문제. U4ATheme.apply 가 발행하는
  //   'u4a-theme-changed'(detail.name)를 구독해 setTheme 전송.
  //   ★ 테마 CSS 는 비동기 로드라 이벤트 시점의 body 휘도는 부정확 → 테마 '이름'으로 판정
  //     (이름이 dark 로 끝나면 vs-dark, 아니면 vs).
  //   ★ 정책 주의: 이 에디터는 개인화 설정이 없어 워크스페이스 테마를 '추종한다'(O).
  //     반면 WS30 USP 코드 에디터는 사용자가 테마 콤보로 고른 개인화 설정이 있어
  //     테마를 추종하지 않는다(X, 의도적 — ws_fn_ipc.js fnIpcMain_if_p13n_themeChange 주석).
  //     근거: .analy/12_테마_컨버전_전략.md §5.3. 새 에디터 추가 시 개인화 유무로 정책 결정.
  function lf_monacoThemeOf(sName) {
    return (typeof sName === "string" && /dark$/i.test(sName)) ? "vs-dark" : "vs";
  }
  function lf_onThemeChange(oEvt) {
    var sName = (oEvt && oEvt.detail && oEvt.detail.name) || "";
    lf_toHost({ cmd: "setTheme", theme: lf_monacoThemeOf(sName) });
  }

  /************************************************************************
   * 다이얼로그 + Monaco 호스트 1회 생성(이후 재사용). oState 가 현재 값을 보유한 상태에서 호출.
   ************************************************************************/
  function lf_build() {

    lf_ensureStyle();

    var oDlg = document.createElement("dialog");
    oDlg.id = C_DLG_ID;
    oDlg.className = "u4a-dialog u4aCliEdDlg";

    // 헤더 — syntax(code) 아이콘 + "{TITLE} -- {OBJID}" + 닫기(X). 제목은 open 마다 갱신.
    var oHeader = _el("div", "u4a-dialog__header");
    oHeader.setAttribute("data-type", "I");
    oHeader.innerHTML = _fa("code") + "<span></span>";
    var oHeaderTitle = oHeader.querySelector("span");

    var oXBtn = _el("button", "u4a-btn-icon");
    oXBtn.type = "button";
    oXBtn.setAttribute("data-act", "close");
    oXBtn.innerHTML = _fa("xmark");
    oXBtn.title = _txt("/U4A/CL_WS_COMMON", "A39");   // Close
    oXBtn.addEventListener("click", function () { lf_close(); });
    oHeader.appendChild(oXBtn);
    oDlg.appendChild(oHeader);

    // 바디 — Monaco 호스트 iframe(1회 로드).
    var oBody = _el("div", "u4a-dialog__body u4aCliEdBody");
    var oFrame = document.createElement("iframe");
    oFrame.className = "u4aCliEdFrame";
    oFrame.setAttribute("frameborder", "0");
    var oQuery = encodeURIComponent(JSON.stringify({
      HOSTID: C_HOSTID,
      LANG: oState.sLang,
      THEME: _editorTheme(),
      READONLY: !oState.bEdit
    }));
    // iframe src — USP 호스트와 동일하게 PATHINFO(JS_ROOT) 기준 절대경로로 구성(베이스 태그/문서 URL 차이에 견고).
    var sHostSrc;
    try {
      var _PATH = parent.PATH;
      var _PATHINFO = parent.require(_PATH.join(parent.APPPATH, "ws30", "resources", "pathInfo.js"));
      sHostSrc = _PATH.join(_PATHINFO.JS_ROOT, "codeeditor", "index.html");
    } catch (e) {
      sHostSrc = "./js/codeeditor/index.html";   // 폴백(상대 — 문서 base 가 ws10_20/index.html 일 때).
    }
    oFrame.src = sHostSrc + "?PARAMS=" + oQuery;
    oBody.appendChild(oFrame);
    oDlg.appendChild(oBody);

    // 푸터 — 원본(UI5) 1:1: 왼쪽 "꾸밈정렬"(아이콘+텍스트) ···· 오른쪽 [Save 파랑][Delete 빨강][Close Reject](아이콘만).
    //   원본 버튼 타입 매핑: Pretty=아이콘+텍스트(투명) / Save=Emphasized(파랑 채움) / Delete=Negative(빨강 채움) / Close=Reject(옅은 빨강).
    //   편집모드 가시성(hidden)은 open 마다 갱신(여기선 생성만).
    var oFoot = _el("div", "u4a-dialog__footer u4aCliEdFoot");

    var oPrettyBtn = _el("button", "u4a-btn u4aCliEdPretty");
    oPrettyBtn.type = "button";
    oPrettyBtn.innerHTML = _fa("wand-magic-sparkles") + "<span></span>";
    oPrettyBtn.querySelector("span").textContent = _txt("/U4A/CL_WS_COMMON", "C25");   // Pretty Print(꾸밈정렬)
    oPrettyBtn.title = _txt("/U4A/CL_WS_COMMON", "C25") + " (Shift+F1)";   // 단축키 안내(에디터 한정)
    oPrettyBtn.addEventListener("click", function () { lf_toHost({ cmd: "format" }); });
    oFoot.appendChild(oPrettyBtn);

    // 줌 표시/원복 — "NNN%" 상시 표시(처음부터 보여 발견성 확보). 클릭=폰트 줌 원복(Ctrl+0 동일).
    //   편집/표시 모드 무관(읽기 중에도 줌 가능)이라 hidden 토글 안 함.
    var oZoomBtn = _el("button", "u4a-btn u4aCliEdPretty u4aCliEdZoom");
    oZoomBtn.type = "button";
    oZoomBtn.innerHTML = _fa("magnifying-glass") + "<span>100%</span>";
    oZoomBtn.addEventListener("click", function () { lf_toHost({ cmd: "fontZoomReset" }); });
    oFoot.appendChild(oZoomBtn);

    oFoot.appendChild(_el("span", "u4aCliEdFootSpacer"));

    var oSaveBtn = _el("button", "u4a-btn u4a-btn--emphasized u4aCliEdIcoBtn");
    oSaveBtn.type = "button";
    oSaveBtn.innerHTML = _fa("check");
    oSaveBtn.title = _txt("/U4A/CL_WS_COMMON", "A64") + " (Ctrl+S)";   // Save + 단축키 안내(에디터 한정)
    oSaveBtn.addEventListener("click", function () { lf_save(); });
    oFoot.appendChild(oSaveBtn);

    var oDelBtn = _el("button", "u4a-btn u4aCliEdIcoBtn u4aCliEdDel");
    oDelBtn.type = "button";
    oDelBtn.innerHTML = _fa("trash");
    oDelBtn.title = _txt("/U4A/CL_WS_COMMON", "A03");   // Delete
    oDelBtn.addEventListener("click", function () { lf_clear(); });
    oFoot.appendChild(oDelBtn);

    var oCloseBtn = _el("button", "u4a-btn u4a-btn--negative u4aCliEdIcoBtn u4aCliEdClose");
    oCloseBtn.type = "button";
    oCloseBtn.innerHTML = _fa("xmark");
    oCloseBtn.title = _txt("/U4A/CL_WS_COMMON", "A39");   // Close
    oCloseBtn.addEventListener("click", function () { lf_close(); });
    oFoot.appendChild(oCloseBtn);

    oDlg.appendChild(oFoot);

    // ESC → 닫기(숨김).
    oDlg.addEventListener("cancel", function (e) { e.preventDefault(); lf_close(); });

    // 헤더 드래그(전역 위임) / 더블클릭 리센터 / 우하단 grip 리사이즈 — 전 팝업 공통.
    if (window.U4AUI && U4AUI.makeDialogRecenter) { U4AUI.makeDialogRecenter(oDlg, oHeader); }
    if (window.U4AUI && U4AUI.makeDialogResizable) { U4AUI.makeDialogResizable(oDlg, { minW: 420, minH: 280 }); }

    document.body.appendChild(oDlg);

    // 영속 리스너 — 다이얼로그가 세션 동안 살아있으므로 1회만 등록(누적 없음).
    window.addEventListener("message", lf_onMessage);
    //  발행 window 가 WS20 프레임/셸 중 어디일지 확정적이지 않아 둘 다 구독(file:// 동일 출처).
    try { window.addEventListener("u4a-theme-changed", lf_onThemeChange); } catch (e) { }
    try { if (window.parent) { window.parent.addEventListener("u4a-theme-changed", lf_onThemeChange); } } catch (e) { }

    oUI = {
      dlg: oDlg, frame: oFrame, headerTitle: oHeaderTitle,
      prettyBtn: oPrettyBtn, saveBtn: oSaveBtn, delBtn: oDelBtn, zoomBtn: oZoomBtn, ready: false
    };
  }

  /************************************************************************
   * 클라이언트 이벤트 에디터 팝업 열기(공개 진입점) — 캐시 재사용.
   * **********************************************************************
   * @param {String}   sObjTy    "JS"(=C_JS) 또는 "HM"(=C_HTML)
   * @param {String}   sObjId    클라이언트 스크립트 ID(= OBJID + UIASN)
   * @param {Function} fnCallback 저장/삭제 후 콜백. param "X"=스크립트 존재 / ""=없음
   ************************************************************************/
  oAPP.fn.fnClientJsEditorPopup = function (sObjTy, sObjId, fnCallback) {

    sObjTy = sObjTy || C_JS;
    sObjId = sObjId || "";

    var bEdit = _isEdit();

    // TYPE 별 타이틀/언어(원본 switch).
    var sTitle, sLang;
    if (sObjTy === C_HTML) {
      sTitle = _txt("/U4A/CL_WS_COMMON", "B62");   // HTML Editor
      sLang = "html";
    } else {
      sObjTy = C_JS;
      sTitle = _txt("/U4A/CL_WS_COMMON", "B61");   // Javascript Editor
      sLang = "javascript";
    }

    // 현재 open 상태 갱신(핸들러들이 여기서 읽음).
    oState.sObjTy = sObjTy;
    oState.sObjId = sObjId;
    oState.sLang = sLang;
    oState.bEdit = bEdit;
    oState.fnCallback = fnCallback;

    // 최초 1회만 생성(혹시 DOM 에서 사라졌으면 재생성).
    if (!oUI || !document.body.contains(oUI.dlg)) {
      oUI = null;
      lf_build();
    }

    // 헤더 제목 / 편집모드 버튼 가시성 갱신.
    oUI.headerTitle.textContent = sTitle + " -- " + sObjId;
    oUI.prettyBtn.hidden = !bEdit;
    oUI.saveBtn.hidden = !bEdit;
    oUI.delBtn.hidden = !bEdit;

    if (oUI.ready) {
      // 재사용 — 즉시 언어/readonly/값 반영(로드 없음 → busy 불필요, 플래시 없음).
      lf_applyContent();
    } else {
      // 최초 로드 — ready 메시지에서 반영. 로드 동안 busy + 워치독(영구 busy 방지).
      lf_busyOn();
      try { clearTimeout(iWatch); } catch (e) { }
      iWatch = setTimeout(lf_busyOff, 8000);
    }

    if (!oUI.dlg.open) { try { oUI.dlg.showModal(); } catch (e) { } }

  }; // end of oAPP.fn.fnClientJsEditorPopup


  /************************************************************************
   * 공통 스타일 1회 주입(테마 토큰 소비 — 하드코딩 색 없음).
   ************************************************************************/
  function lf_ensureStyle() {
    if (document.getElementById("u4aCliEdStyle")) { return; }
    var oStyle = document.createElement("style");
    oStyle.id = "u4aCliEdStyle";
    oStyle.textContent =
      // 넉넉한 기본 크기 + 리사이즈(공통 grip). 세로 flex 로 바디(에디터)가 늘어 푸터 하단 고정.
      ".u4aCliEdDlg { width: min(92vw, 880px); height: min(86vh, 620px); padding: 0; display: flex; flex-direction: column; }" +
      ".u4aCliEdDlg .u4a-dialog__header { cursor: move; user-select: none; }" +
      ".u4aCliEdDlg .u4a-dialog__header span { flex: 1 1 auto; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }" +
      // 바디 = 에디터 iframe 풀필(패딩 0). min-height:0 으로 flex 자식이 줄어들 수 있게.
      ".u4aCliEdBody { flex: 1 1 auto; min-height: 0; padding: 0; display: flex; }" +
      ".u4aCliEdFrame { flex: 1 1 auto; width: 100%; height: 100%; border: 0; display: block; background: var(--app-bg); }" +
      ".u4aCliEdFoot { display: flex; gap: 0.5rem; align-items: center; }" +
      // 왼쪽(꾸밈정렬) / 오른쪽(아이콘 3개) 그룹 분리 — 스페이서가 가운데를 흡수.
      ".u4aCliEdFootSpacer { flex: 1 1 auto; }" +
      ".u4aCliEdFoot .u4a-btn[hidden] { display: none; }" +
      // 꾸밈정렬 = 텍스트 전용(투명 버튼, 원본 sap.m.Button 기본 톤).
      ".u4aCliEdPretty { background: transparent; border-color: transparent; color: var(--sl-fg); }" +
      ".u4aCliEdPretty:hover { background: var(--sl-surface-2); }" +
      // 줌 표시/원복 버튼 — Pretty 와 동일 투명 톤 + 숫자 폭 안정(tabular).
      ".u4aCliEdZoom { font-variant-numeric: tabular-nums; gap: 0.375rem; }" +
      // 아이콘 전용 결정 버튼 = 정사각 컴팩트(텍스트 패딩 제거).
      ".u4aCliEdIcoBtn { min-width: 2.25rem; padding: 0.4rem 0.6rem; justify-content: center; }" +
      // Delete = Negative(빨강 채움) — 원본 sap Negative. 색 단일 출처 = --error 토큰(하드코딩 없음).
      ".u4aCliEdDel { background: var(--error); border-color: var(--error); color: #fff; }" +
      ".u4aCliEdDel:hover { background: var(--error); border-color: var(--error); color: #fff; filter: brightness(0.92); }";
    document.head.appendChild(oStyle);
  }

})(window, $, oAPP);
