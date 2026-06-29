/************************************************************************
 * Copyright 2020. INFOCG Inc. all rights reserved.
 * ----------------------------------------------------------------------
 * - file Name : fnInitPreScreenPopupOpen.js
 * - file Desc : WS20 ROOT 속성 "Use init pre-screen event"(DH001106) Popup (HTML5)
 * ----------------------------------------------------------------------
 * [컨버전 메모]
 *  원본: uiAttributeArea.js attrDocumentProc case "DH001106"
 *        → import("design/documents/callInitPreScreenPopup/index.js")(is_attr)
 *        → dialogViewer({control: VBox[ Title(254) + Switch ]}, {
 *            title:"Use init pre-screen event",
 *            actions:[ OK(Accept, visible:IS_EDIT, text 232 Apply), CANCEL(Reject, 003/056) ] }).
 *        ★ 본문은 "254(init pre-screen event 사용여부 설정.) 텍스트 + 스위치" 한 줄뿐.
 *          (구 node module 판은 doc HTML 을 iframe 으로 띄웠으나 현행 import 대상 index.js 는 단순 토글.
 *           원본 도움말 문서/이미지는 헤더 help-doc 버튼(showHelpDocButton, 별도 viewer 시스템) 소관 —
 *           본문에 인라인하지 않는다.)
 *        Switch.state = (is_attr.UIATV === "X"), Switch.enabled = IS_EDIT.
 *        Apply 콜백: setInitPreScreen → is_attr.UIATV = state ? "X" : ""
 *                    → attrChangeProc(is_attr,…) + updateBindPopupDesignData().
 *
 *  HTML5: native <dialog class="u4a-dialog"> + 공통 컴포넌트(.u4a-switch · .u4a-btn ·
 *        makeDialogRecenter/Resizable · 전역 헤더 드래그). Enable Dump Write 팝업
 *        (fnDumpWritePopupOpen.js)과 동일 컨벤션 — 데이터는 WS20 속성 행(is_attr) 자체의
 *        UIATV 라, 여는 쪽이 해당 행을 넘겨준다.
 *        ★ 공통 파일(shell.css/u4a-ui.js) 미수정 — 화면 스코프(.u4aIps*) 주입 스타일만.
 *
 *  ★ 보존 로직(원본 1:1):
 *    · 스위치 초기값 = is_attr.UIATV === "X". 스위치 활성 = (is_attr.edit === true).
 *    · Apply 노출 = IS_EDIT(/WS20/APP). 비편집(조회)이면 Apply 숨김 + 스위치 비활성(보기 전용).
 *    · Apply 시: is_attr.UIATV = 스위치 ? "X" : "" → fnWs20AttrChange(is_attr,"INPUT")
 *      (원본 attrChangeProc 대응: 변경표시/라인스타일/수집/재렌더 + undo 스냅샷 통합).
 *    · Cancel/Close: 변경 폐기(원본 ACTCD CANCEL — 아무 것도 반영 안 함).
 *  ★ 텍스트: 헤더 제목/본문 라벨(254)/버튼은 메시지 클래스 키(워크스페이스 언어). 하드코딩 영문 없음.
 *  ★ UI5 의존부 치환: dialogViewer → <dialog>, JSONModel → 직접 행 참조,
 *    updateBindPopupDesignData(바인딩 팝업 디자인 갱신) → W4+ 가드(미수행).
 *    (원본 헤더 help-doc 버튼 = 별도 viewer 시스템 — HTML5 미변환, 본 팝업 범위 밖.)
 ************************************************************************/

(function (window, $, oAPP) {
  "use strict";

  var APPCOMMON = oAPP.common;

  var C_DLG_ID = "u4aInitPreScreenDlg";

  // 원본 callInitPreScreenPopup/index.js 의 dialogViewer u4aHelpDocMenuID.
  var C_HELP_MENU_ID = "000230";

  // ── 로컬 헬퍼(DumpWrite/WebSecurity 팝업과 동일 컨벤션) ────────────────
  function _fa(s) { return '<i class="fa-solid fa-' + s + '"></i>'; }
  function _wsTxt(sCode, p1) {
    // 공통 메시지(ZMSG_WS_COMMON_001) — 워크스페이스 언어 기준(원본 동일).
    try {
      var L = (parent.getUserInfo && parent.getUserInfo().LANGU) || "";
      return parent.WSUTIL.getWsMsgClsTxt(L, "ZMSG_WS_COMMON_001", sCode, p1 || "") || "";
    } catch (e) { return ""; }
  }
  function _el(sTag, sClass, sText) {
    var o = document.createElement(sTag);
    if (sClass) { o.className = sClass; }
    if (typeof sText !== "undefined") { o.textContent = sText; }
    return o;
  }
  function _isEdit() {
    try { var o = APPCOMMON.fnGetModelProperty("/WS20/APP"); return !!(o && o.IS_EDIT === "X"); }
    catch (e) { return false; }
  }

  // 단일 캐시 + 현재 컨텍스트(여는 쪽이 넘긴 WS20 속성 행).
  var oUI = null;
  var oCtx = { attr: null };

  // 닫기 = close() 만. DOM 제거는 공통(u4a-ui.js _installGlobalDialogClose)이 .u4a-dialog 전역으로 처리.
  function lf_close() {
    try { if (oUI && oUI.dlg && oUI.dlg.open) { oUI.dlg.close(); } } catch (e) { }
  }

  // ── Apply(원본 OK 액션 콜백 setInitPreScreen) — 스위치 값을 속성 행에 반영 후 변경 흐름 수행 ──
  function lf_apply() {
    // 편집 모드에서만(원본 OK visible=IS_EDIT). 방어적으로 한 번 더 검사.
    if (!_isEdit() || !oCtx.attr) { lf_close(); return; }

    // is_attr.UIATV = 스위치 ? "X" : ""  (원본 oModel.INTFT_STATE ? "X" : "")
    oCtx.attr.UIATV = (oUI.sw && oUI.sw.checked) ? "X" : "";

    // 원본 attrChangeProc(is_attr,…) 대응 — HTML5 통합 변경 처리(변경표시/수집/재렌더/undo).
    try { oAPP.fn.fnWs20AttrChange(oCtx.attr, "INPUT"); }
    catch (e) { console.error("[HTML5][WS20][InitPreScreen] attr 변경 처리 오류:", e && e.message); }

    // (원본 updateBindPopupDesignData: 바인딩 팝업 디자인 영역 갱신 — W4+ 미변환)
    if (typeof oAPP.fn.updateBindPopupDesignData === "function") {
      try { oAPP.fn.updateBindPopupDesignData(); } catch (e) { }
    }

    lf_close();

    // 저장 완료 토스트 — CSS/JS Link·WebSecurity 팝업과 동일 재사용(MSG_WS 002 Saved success,
    //   공통 KIND 10 토스트=화면 정중앙). 닫힌 뒤 메인 위에 표시.
    try {
      parent.showMessage(null, 10, "S", APPCOMMON.fnGetMsgClsText("/U4A/MSG_WS", "002", "", "", "", ""));
    } catch (e) { }
  }

  /************************************************************************
   * 다이얼로그 1회 생성(이후 재사용).
   ************************************************************************/
  function lf_build() {
    lf_ensureStyle();

    var oDlg = document.createElement("dialog");
    oDlg.id = C_DLG_ID;
    oDlg.className = "u4a-dialog u4aIpsDlg";

    // ── 헤더 — 제목 + [U4A 도움말 문서 버튼] + 닫기 X ──
    var oHeader = _el("div", "u4a-dialog__header");
    oHeader.innerHTML = "<span></span>";

    // U4A HELP DOCUMENT 버튼(원본 helpViewer.js setHelpDocButton 1:1).
    //   · 패치 적용(checkWLOList "C"/UHAK901369) 시에만 노출.
    //   · 클릭 → 이미 완비된 fnU4AHelpDocuPopupOpener({startMenuId}) 재사용
    //     (트리 도움말 startMenuId:000272 / 미리보기 000273 과 동일 패턴).
    try {
      if (oAPP.common && oAPP.common.checkWLOList &&
          oAPP.common.checkWLOList("C", "UHAK901369") === true &&
          typeof oAPP.fn.fnU4AHelpDocuPopupOpener === "function") {
        var oHelpBtn = _el("button", "u4a-btn-icon u4aIpsHelpBtn");
        oHelpBtn.type = "button";
        oHelpBtn.innerHTML = _fa("book-open-reader");
        // B44  U4A Help Document
        oHelpBtn.title = APPCOMMON.fnGetMsgClsText("/U4A/CL_WS_COMMON", "B44") || "U4A Help Document";
        oHelpBtn.addEventListener("click", function () {
          try { oAPP.fn.fnU4AHelpDocuPopupOpener({ startMenuId: C_HELP_MENU_ID }); }
          catch (e) { console.error("[HTML5][WS20][InitPreScreen] 도움말 문서 호출 오류:", e && e.message); }
        });
        oHeader.appendChild(oHelpBtn);
      }
    } catch (e) { }

    var oXBtn = _el("button", "u4a-btn-icon");
    oXBtn.type = "button";
    oXBtn.innerHTML = _fa("xmark");
    oXBtn.title = _wsTxt("056") || _wsTxt("003");   // close / Cancel
    oXBtn.addEventListener("click", function () { lf_close(); });
    oHeader.appendChild(oXBtn);
    oDlg.appendChild(oHeader);

    // ── 본문 — 원본 VBox[ Title(254) + Switch ] 1:1 ──
    var oBody = _el("div", "u4a-dialog__body u4aIpsBody");

    oUI = oUI || {};

    // 254  init pre-screen event 사용여부 설정.
    oUI.label = _el("div", "u4aIpsLabel");
    oBody.appendChild(oUI.label);

    // 공통 스위치(.u4a-switch — DumpWrite/CSS·JS Link 팝업과 동일).
    var oSwitch = _el("label", "u4a-switch u4aIpsSwitch");
    var oSwIn = document.createElement("input");
    oSwIn.type = "checkbox";
    oSwitch.appendChild(oSwIn);
    oSwitch.appendChild(_el("span", "u4a-switch__slider"));
    oBody.appendChild(oSwitch);
    oUI.sw = oSwIn;

    oDlg.appendChild(oBody);

    // ── 푸터 — [Apply 파랑(편집시만)] [Close Reject] ──
    var oFoot = _el("div", "u4a-dialog__footer u4aIpsFoot");
    oFoot.appendChild(_el("span", "u4aIpsFootSpacer"));
    var oApplyBtn = _el("button", "u4a-btn u4a-btn--emphasized u4aIpsIcoBtn");
    oApplyBtn.type = "button";
    oApplyBtn.innerHTML = _fa("check");
    oApplyBtn.title = _wsTxt("232");   // Apply / 적용
    oApplyBtn.addEventListener("click", function () { lf_apply(); });
    var oCloseBtn = _el("button", "u4a-btn u4a-btn--negative u4aIpsIcoBtn");
    oCloseBtn.type = "button";
    oCloseBtn.innerHTML = _fa("xmark");
    oCloseBtn.title = _wsTxt("003") || _wsTxt("056");   // Cancel / 취소
    oCloseBtn.addEventListener("click", function () { lf_close(); });
    oFoot.appendChild(oApplyBtn);
    oFoot.appendChild(oCloseBtn);
    oDlg.appendChild(oFoot);
    oUI.applyBtn = oApplyBtn;

    // ESC = 닫기(원본 Reject).
    oDlg.addEventListener("cancel", function (e) { e.preventDefault(); lf_close(); });

    if (window.U4AUI && U4AUI.makeDialogRecenter) { U4AUI.makeDialogRecenter(oDlg, oHeader); }
    if (window.U4AUI && U4AUI.makeDialogResizable) { U4AUI.makeDialogResizable(oDlg, { minW: 360, minH: 200 }); }

    document.body.appendChild(oDlg);
    oUI.dlg = oDlg;
  }

  // 현재 언어 텍스트를 화면에 채운다(열 때마다 — 언어 변경 대응).
  function lf_fillText(sAttr) {
    // 헤더 제목 = 속성 라벨(UIATT, 워크스페이스 언어). (원본 dialogViewer title 대응)
    var sTitle = (sAttr && sAttr.UIATT) || "Use init pre-screen event";
    try { oUI.dlg.querySelector(".u4a-dialog__header span").textContent = sTitle; } catch (e) { }

    // 254  init pre-screen event 사용여부 설정.
    oUI.label.textContent = _wsTxt("254");

    // 버튼 툴팁(언어 변경 대응).
    if (oUI.applyBtn) { oUI.applyBtn.title = _wsTxt("232"); }
  }

  /************************************************************************
   * Use init pre-screen event 팝업 열기(공개 진입점).
   *   @param {object} sAttr - WS20 ROOT 속성 행(is_attr). UIATV("X"/"")·edit 보유.
   ************************************************************************/
  oAPP.fn.fnInitPreScreenPopupOpen = function (sAttr) {

    if (!oUI || !oUI.dlg || !document.body.contains(oUI.dlg)) { oUI = null; lf_build(); }

    if (oUI.dlg.open) {
      try { oAPP.common.fnSetBusyLock(""); } catch (e) { }
      return;
    }

    oCtx.attr = sAttr || null;

    // 언어 텍스트 채우기.
    lf_fillText(sAttr);

    // 스위치 초기값/활성(원본: state=UIATV==="X", enabled=edit===true).
    var bEditRow = !!(sAttr && sAttr.edit === true);
    oUI.sw.checked = !!(sAttr && sAttr.UIATV === "X");
    oUI.sw.disabled = !bEditRow;

    // Apply 노출(원본 OK visible=/WS20/APP/IS_EDIT). 조회 모드면 보기 전용.
    oUI.applyBtn.hidden = !_isEdit();

    try { oUI.dlg.showModal(); } catch (e) { }

    // busy 끄고 Lock 풀기(원본 afterOpen).
    try { oAPP.common.fnSetBusyLock(""); } catch (e) { }

  }; // end of oAPP.fn.fnInitPreScreenPopupOpen

  /************************************************************************
   * 공통 스타일 1회 주입(테마 토큰 소비 — 공통 파일 미수정, 화면 스코프만).
   ************************************************************************/
  function lf_ensureStyle() {
    if (document.getElementById("u4aIpsStyle")) { return; }
    var oStyle = document.createElement("style");
    oStyle.id = "u4aIpsStyle";
    oStyle.textContent =
      ".u4aIpsDlg { width: min(94vw, 440px); padding: 0; display: flex; flex-direction: column; }" +
      ".u4aIpsDlg .u4a-dialog__header { cursor: move; user-select: none; }" +
      ".u4aIpsDlg .u4a-dialog__header span { flex: 1 1 auto; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }" +
      // U4A 도움말 문서 버튼 — 강조색(원본 type:Emphasized 대응).
      ".u4aIpsHelpBtn { color: var(--accent); }" +
      // 본문 — 라벨 + 스위치 세로 배치(원본 VBox).
      ".u4aIpsBody { display: flex; flex-direction: column; align-items: flex-start; gap: 0.875rem; padding: 1.25rem 1rem; }" +
      ".u4aIpsLabel { font-size: 0.9375rem; font-weight: 700; line-height: 1.5; color: var(--text); }" +
      ".u4aIpsSwitch { flex: 0 0 auto; }" +
      // 조회 모드(disabled) — 상태색 유지하되 옅게 dim + 기본 커서로 읽기전용 표시.
      ".u4aIpsSwitch input:disabled + .u4a-switch__slider { opacity: 0.6; cursor: default; }" +
      // 푸터.
      ".u4aIpsFoot { display: flex; gap: 0.5rem; align-items: center; }" +
      ".u4aIpsFootSpacer { flex: 1 1 auto; }" +
      ".u4aIpsFoot .u4a-btn[hidden] { display: none; }" +
      ".u4aIpsIcoBtn { min-width: 2.5rem; justify-content: center; }";
    document.head.appendChild(oStyle);
  }

})(window, $, oAPP);
