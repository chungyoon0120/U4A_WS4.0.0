/************************************************************************
 * Copyright 2020. INFOCG Inc. all rights reserved.
 * ----------------------------------------------------------------------
 * - file Name : fnDumpWritePopupOpen.js
 * - file Desc : WS20 ROOT 속성 "Enable Dump Write"(DH001091) Popup (HTML5)
 * ----------------------------------------------------------------------
 * [컨버전 메모]
 *  원본: uiAttributeArea.js attrCallPopup case "DH001091"
 *        → dialogViewer({htmlContent: design/html/documents/<GLANGU>/dumpWritePopup/index.html}, {
 *            title: ZMSG_WS_COMMON_001 492(덤프 이력 기록),
 *            actions:[ OK(Accept, visible:IS_EDIT, text 232 Apply), CANCEL(Reject, 003/056) ] }).
 *        index.html 은 단일 스위치(#dumpSwitch) — IF_DATA.UIATV("X"/"") 를 반영/갱신하며,
 *        switch.disabled = (IF_DATA.edit !== true). 설명 텍스트는 KO/EN 문서에 하드코딩(폴더=GLANGU).
 *        Apply 콜백: is_attr.UIATV = IF_DATA.UIATV || "" → attrChangeProc(is_attr,…) + updateBindPopupDesignData().
 *
 *  HTML5: native <dialog class="u4a-dialog"> + 공통 컴포넌트(.u4a-switch · .u4a-btn ·
 *        makeDialogRecenter/Resizable · 전역 헤더 드래그). 데이터는 별도 모델이 아니라
 *        WS20 속성 행(is_attr) 자체의 UIATV 라, 여는 쪽이 해당 행을 넘겨준다.
 *        ★ 공통 파일(shell.css/u4a-ui.js) 미수정 — 화면 스코프(.u4aDump*) 주입 스타일만.
 *
 *  ★ 보존 로직(원본 1:1):
 *    · 스위치 초기값 = is_attr.UIATV === "X". 스위치 활성 = (is_attr.edit === true).
 *    · Apply 노출 = IS_EDIT(/WS20/APP). 비편집(조회)이면 Apply 숨김 + 스위치 비활성(보기 전용).
 *    · Apply 시: is_attr.UIATV = 스위치 ? "X" : "" → fnWs20AttrChange(is_attr,"INPUT")
 *      (원본 attrChangeProc 대응: 변경표시/라인스타일/수집/재렌더 + undo 스냅샷 통합).
 *    · Cancel/Close: 변경 폐기(원본 ACTCD CANCEL — 아무 것도 반영 안 함).
 *  ★ 설명 텍스트: 원본 doc(KO/EN index.html) 의 하드코딩 문구를 1:1 보존(메시지 클래스 키 아님).
 *    워크스페이스 언어(getUserInfo().LANGU, 원본 GLANGU)로 KO/EN 선택. → i18n 키화 필요 항목으로 보고.
 *  ★ UI5 의존부 치환: dialogViewer/iframe → <dialog>, IF_DATA postMessage → 직접 행 참조,
 *    updateBindPopupDesignData(바인딩 팝업 디자인 갱신) → W4+ 가드(미수행).
 ************************************************************************/

(function (window, $, oAPP) {
  "use strict";

  var APPCOMMON = oAPP.common;

  var C_DLG_ID = "u4aDumpWriteDlg";

  // ── 로컬 헬퍼(WebSecurity/CSS·JS Link 팝업과 동일 컨벤션) ────────────────
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
  function _isKo() {
    try { return ((parent.getUserInfo && parent.getUserInfo().LANGU) || "EN") === "KO"; }
    catch (e) { return false; }
  }

  // ── 설명 텍스트 번들(원본 design/html/documents/<KO|EN>/dumpWritePopup/index.html 1:1) ──
  //   ★ 원본 doc 하드코딩 문구 — 메시지 클래스 키 아님. i18n 키화 대상으로 보고.
  var TXT = {
    KO: {
      h1: "ST22 덤프 이력 기록 옵션",
      sub: "서버 이벤트 수행 중 발생한 ABAP 덤프에 대해, 덤프 이력을 ST22(Transaction ST22)에 남길지 여부를 옵션으로 제어합니다.",
      descTitle: "기능 설명",
      desc: "해당 기능을 활성화 하여 서버 이벤트 수행 중 덤프가 발생할 경우, 브라우저 화면에 덤프 내용을 출력하는 것과 동시에 ST22(Transaction ST22)에서 덤프 내용을 확인할 수 있습니다.",
      offTitle: "옵션 비활성화 시",
      offBody: "서버 이벤트 수행 중 덤프 발생 시, 브라우저 화면에만 덤프 내용이 출력되며 ST22에는 덤프 이력이 기록되지 않습니다.",
      onTitle: "옵션 활성화 시",
      onBody: "브라우저 화면 출력은 기존과 동일하게 유지되며 동시에 ST22에서도 덤프 이력을 조회할 수 있습니다.",
      fig1: "Figure 1. 옵션 활성화 시 ABAP ST22 덤프 확인 화면",
      fig2: "Figure 2. U4A 실행 화면 덤프 출력",
      footTitle: "ST22 덤프 이력 기록 사용",
      footDesc: "서버 이벤트 수행 중 덤프 발생 시 ST22 이력 기록 여부 설정"
    },
    EN: {
      h1: "ST22 Dump History Recording Option",
      sub: "For ABAP dumps that occur during server event execution, you can control via an option whether the dump history is recorded in ST22 (Transaction ST22).",
      descTitle: "Function Description",
      desc: "When this feature is enabled and a dump occurs during server event execution, the dump details are displayed on the browser screen and the dump details can also be checked in ST22 (Transaction ST22).",
      offTitle: "When the option is disabled",
      offBody: "If a dump occurs during server event execution, the dump details are displayed only on the browser screen and no dump history is recorded in ST22.",
      onTitle: "When the option is enabled",
      onBody: "the browser screen output remains the same as before, and at the same time, the dump history can be viewed in ST22.",
      fig1: "Figure 1. ABAP ST22 Dump Screen with the Option Enabled",
      fig2: "Figure 2. Dump Output Displayed on the U4A Execution Screen",
      footTitle: "Enable ST22 Dump History Logging",
      footDesc: "Set whether to log dumps to ST22 during server event execution"
    }
  };
  function _txt() { return _isKo() ? TXT.KO : TXT.EN; }

  // 단일 캐시 + 현재 컨텍스트(여는 쪽이 넘긴 WS20 속성 행).
  var oUI = null;
  var oCtx = { attr: null };

  // 닫기 = close() 만. DOM 제거는 공통(u4a-ui.js _installGlobalDialogClose)이 .u4a-dialog 전역으로 처리,
  //   다음 열기는 아래 진입부의 contains 가드가 새로 build(기본 상태로).
  function lf_close() {
    try { if (oUI && oUI.dlg && oUI.dlg.open) { oUI.dlg.close(); } } catch (e) { }
  }

  // ── Apply(원본 OK 액션 콜백) — 스위치 값을 속성 행에 반영 후 변경 흐름 수행 ──
  function lf_apply() {
    // 편집 모드에서만(원본 OK visible=IS_EDIT). 방어적으로 한 번 더 검사.
    if (!_isEdit() || !oCtx.attr) { lf_close(); return; }

    // is_attr.UIATV = 스위치 ? "X" : ""  (원본 IF_DATA.UIATV || "")
    oCtx.attr.UIATV = (oUI.sw && oUI.sw.checked) ? "X" : "";

    // 원본 attrChangeProc(is_attr,…) 대응 — HTML5 통합 변경 처리(변경표시/수집/재렌더/undo).
    try { oAPP.fn.fnWs20AttrChange(oCtx.attr, "INPUT"); }
    catch (e) { console.error("[HTML5][WS20][DumpWrite] attr 변경 처리 오류:", e && e.message); }

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
    oDlg.className = "u4a-dialog u4aDumpDlg";

    // ── 헤더 — bug 아이콘 + "덤프 이력 기록"(492) + 닫기 X ──
    var oHeader = _el("div", "u4a-dialog__header");
    oHeader.innerHTML = _fa("bug") + "<span></span>";
    oHeader.querySelector("span").textContent = _wsTxt("492");   // 덤프 이력 기록
    var oXBtn = _el("button", "u4a-btn-icon");
    oXBtn.type = "button";
    oXBtn.innerHTML = _fa("xmark");
    oXBtn.title = _wsTxt("056") || _wsTxt("003");   // close / Cancel
    oXBtn.addEventListener("click", function () { lf_close(); });
    oHeader.appendChild(oXBtn);
    oDlg.appendChild(oHeader);

    // ── 본문 ──
    var oBody = _el("div", "u4a-dialog__body u4aDumpBody");

    // 제목 영역(원본 <header> h1 + sub).
    oUI = oUI || {};
    oUI.h1 = _el("h1", "u4aDumpH1");
    oUI.sub = _el("div", "u4aDumpSub");
    oBody.appendChild(oUI.h1);
    oBody.appendChild(oUI.sub);

    // 기능 설명 카드(원본 <section class="card">).
    var oCard = _el("div", "u4aDumpCard");
    oUI.descTitle = _el("h2", "u4aDumpCardTitle");
    oCard.appendChild(oUI.descTitle);
    oUI.desc = _el("p", "u4aDumpP");
    oCard.appendChild(oUI.desc);

    // note: 옵션 비활성화 시.
    var oNoteOff = _el("div", "u4aDumpNote");
    oUI.offTitle = _el("b", "u4aDumpNoteTitle");
    oUI.offBody = _el("div", "u4aDumpNoteBody");
    oNoteOff.appendChild(oUI.offTitle);
    oNoteOff.appendChild(oUI.offBody);
    oCard.appendChild(oNoteOff);

    // note: 옵션 활성화 시.
    var oNoteOn = _el("div", "u4aDumpNote");
    oUI.onTitle = _el("b", "u4aDumpNoteTitle");
    oUI.onBody = _el("div", "u4aDumpNoteBody");
    oNoteOn.appendChild(oUI.onTitle);
    oNoteOn.appendChild(oUI.onBody);
    oCard.appendChild(oNoteOn);

    // 이미지 그리드(원본 <div class="image-grid"> — ST22/실행화면 캡처 2장. base64 → images/dumpWrite/ 추출).
    var oGrid = _el("div", "u4aDumpImgGrid");
    var aImg = [
      { src: "images/dumpWrite/st22_dump_screen.png", capKey: "fig1cap" },
      { src: "images/dumpWrite/u4a_execution_dump.png", capKey: "fig2cap" }
    ];
    aImg.forEach(function (o) {
      var oFig = _el("figure", "u4aDumpFig");
      var oImg = document.createElement("img");
      oImg.className = "u4aDumpImg";
      oImg.src = o.src;
      oImg.loading = "lazy";
      var oCap = _el("figcaption", "u4aDumpFigCap");
      oFig.appendChild(oImg);
      oFig.appendChild(oCap);
      oGrid.appendChild(oFig);
      oUI[o.capKey] = oCap;
      oUI[o.capKey + "Img"] = oImg;
    });
    oCard.appendChild(oGrid);

    oBody.appendChild(oCard);

    // ── 사용 토글 행(원본 <footer class="footer-bar"> — 제목/설명 + 스위치) ──
    var oToggleBar = _el("div", "u4aDumpToggleBar");
    var oToggleTexts = _el("div", "u4aDumpToggleTexts");
    oUI.footTitle = _el("div", "u4aDumpToggleTitle");
    oUI.footDesc = _el("div", "u4aDumpToggleDesc");
    oToggleTexts.appendChild(oUI.footTitle);
    oToggleTexts.appendChild(oUI.footDesc);
    oToggleBar.appendChild(oToggleTexts);

    // 공통 스위치(.u4a-switch — CSS/JS Link 팝업 Exclude 스위치와 동일).
    var oSwitch = _el("label", "u4a-switch u4aDumpSwitch");
    var oSwIn = document.createElement("input");
    oSwIn.type = "checkbox";
    oSwitch.appendChild(oSwIn);
    oSwitch.appendChild(_el("span", "u4a-switch__slider"));
    oToggleBar.appendChild(oSwitch);
    oUI.sw = oSwIn;

    oDlg.appendChild(oBody);

    // 토글 바는 스크롤 본문 밖 하단 고정(원본 <footer class="footer-bar"> — 본문이 길어도
    //   항상 보여 현재 설정 상태를 확인 가능. 조회 모드에서도 스위치는 노출, disabled 만).
    oDlg.appendChild(oToggleBar);

    // ── 푸터 — [Apply 파랑(편집시만)] [Close Reject] ──
    var oFoot = _el("div", "u4a-dialog__footer u4aDumpFoot");
    oFoot.appendChild(_el("span", "u4aDumpFootSpacer"));
    var oApplyBtn = _el("button", "u4a-btn u4a-btn--emphasized u4aDumpIcoBtn");
    oApplyBtn.type = "button";
    oApplyBtn.innerHTML = _fa("check");
    oApplyBtn.title = _wsTxt("232");   // Apply
    oApplyBtn.addEventListener("click", function () { lf_apply(); });
    var oCloseBtn = _el("button", "u4a-btn u4a-btn--negative u4aDumpIcoBtn");
    oCloseBtn.type = "button";
    oCloseBtn.innerHTML = _fa("xmark");
    oCloseBtn.title = _wsTxt("056") || _wsTxt("003");   // close / Cancel
    oCloseBtn.addEventListener("click", function () { lf_close(); });
    oFoot.appendChild(oApplyBtn);
    oFoot.appendChild(oCloseBtn);
    oDlg.appendChild(oFoot);
    oUI.applyBtn = oApplyBtn;

    // ESC = 닫기(원본 Reject).
    oDlg.addEventListener("cancel", function (e) { e.preventDefault(); lf_close(); });

    if (window.U4AUI && U4AUI.makeDialogRecenter) { U4AUI.makeDialogRecenter(oDlg, oHeader); }
    if (window.U4AUI && U4AUI.makeDialogResizable) { U4AUI.makeDialogResizable(oDlg, { minW: 420, minH: 360 }); }

    document.body.appendChild(oDlg);
    oUI.dlg = oDlg;
  }

  // 현재 언어 텍스트를 화면에 채운다(열 때마다 — 언어/테마 변경 대응).
  function lf_fillText() {
    var t = _txt();
    oUI.h1.textContent = t.h1;
    oUI.sub.textContent = t.sub;
    oUI.descTitle.textContent = t.descTitle;
    oUI.desc.textContent = t.desc;
    oUI.offTitle.textContent = t.offTitle;
    oUI.offBody.textContent = t.offBody;
    oUI.onTitle.textContent = t.onTitle;
    oUI.onBody.textContent = t.onBody;
    if (oUI.fig1cap) { oUI.fig1cap.textContent = t.fig1; oUI.fig1capImg.alt = t.fig1; }
    if (oUI.fig2cap) { oUI.fig2cap.textContent = t.fig2; oUI.fig2capImg.alt = t.fig2; }
    oUI.footTitle.textContent = t.footTitle;
    oUI.footDesc.textContent = t.footDesc;
    // 헤더/버튼 타이틀도 재적용(언어 변경 대응).
    try { oUI.dlg.querySelector(".u4a-dialog__header span").textContent = _wsTxt("492"); } catch (e) { }
    if (oUI.applyBtn) { oUI.applyBtn.title = _wsTxt("232"); }
  }

  /************************************************************************
   * Enable Dump Write 팝업 열기(공개 진입점) — 닫을 때 DOM 제거하므로 매번 새로 build.
   *   @param {object} sAttr - WS20 ROOT 속성 행(is_attr). UIATV("X"/"")·edit 보유.
   ************************************************************************/
  oAPP.fn.fnDumpWritePopupOpen = function (sAttr) {

    if (!oUI || !oUI.dlg || !document.body.contains(oUI.dlg)) { oUI = null; lf_build(); }

    if (oUI.dlg.open) {
      try { oAPP.common.fnSetBusyLock(""); } catch (e) { }
      return;
    }

    oCtx.attr = sAttr || null;

    // 언어 텍스트 채우기.
    lf_fillText();

    // 스위치 초기값/활성(원본: checked=UIATV==="X", disabled=edit!==true).
    var bEditRow = !!(sAttr && sAttr.edit === true);
    oUI.sw.checked = !!(sAttr && sAttr.UIATV === "X");
    oUI.sw.disabled = !bEditRow;

    // Apply 노출(원본 OK visible=/WS20/APP/IS_EDIT). 조회 모드면 보기 전용.
    oUI.applyBtn.hidden = !_isEdit();

    try { oUI.dlg.showModal(); } catch (e) { }

    // busy 끄고 Lock 풀기(원본 afterOpen).
    try { oAPP.common.fnSetBusyLock(""); } catch (e) { }

  }; // end of oAPP.fn.fnDumpWritePopupOpen

  /************************************************************************
   * 공통 스타일 1회 주입(테마 토큰 소비 — 공통 파일 미수정, 화면 스코프만).
   ************************************************************************/
  function lf_ensureStyle() {
    if (document.getElementById("u4aDumpStyle")) { return; }
    var oStyle = document.createElement("style");
    oStyle.id = "u4aDumpStyle";
    oStyle.textContent =
      ".u4aDumpDlg { width: min(94vw, 680px); height: min(90vh, 740px); padding: 0; display: flex; flex-direction: column; }" +
      ".u4aDumpDlg .u4a-dialog__header { cursor: move; user-select: none; }" +
      ".u4aDumpDlg .u4a-dialog__header span { flex: 1 1 auto; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }" +
      ".u4aDumpBody { flex: 1 1 auto; min-height: 0; overflow: auto; display: flex; flex-direction: column; gap: 0.875rem; padding: 1rem; }" +
      // 제목 영역.
      ".u4aDumpH1 { margin: 0; font-size: 1.125rem; font-weight: 700; color: var(--text); }" +
      ".u4aDumpSub { font-size: 0.8125rem; line-height: 1.6; color: var(--text-muted); }" +
      // 기능 설명 카드.
      ".u4aDumpCard { display: flex; flex-direction: column; gap: 0.625rem; border: 0.0625rem solid var(--line); border-radius: var(--radius); background: var(--surface); padding: 0.875rem; }" +
      ".u4aDumpCardTitle { margin: 0; font-size: 0.9375rem; font-weight: 700; color: var(--text); }" +
      ".u4aDumpP { margin: 0; font-size: 0.8125rem; line-height: 1.65; color: var(--text); }" +
      // note(원본 좌측 accent 보더 + 옅은 틴트 — color-mix 미사용, 토큰 var(--hover-bg)).
      ".u4aDumpNote { border-left: 0.25rem solid var(--accent); background: var(--hover-bg); border-radius: 0.5rem; padding: 0.625rem 0.75rem; font-size: 0.8125rem; line-height: 1.6; color: var(--text); }" +
      ".u4aDumpNoteTitle { display: block; margin-bottom: 0.25rem; color: var(--text); }" +
      ".u4aDumpNoteBody { color: var(--text-muted); }" +
      // 이미지 그리드(원본 .image-grid — 좁은 폭=1열, 넓으면 2열).
      ".u4aDumpImgGrid { display: grid; grid-template-columns: 1fr; gap: 0.75rem; margin-top: 0.25rem; }" +
      "@media (min-width: 34rem) { .u4aDumpImgGrid { grid-template-columns: 1fr 1fr; } }" +
      ".u4aDumpFig { margin: 0; }" +
      ".u4aDumpImg { display: block; width: 100%; border: 0.0625rem solid var(--line); border-radius: 0.5rem; }" +
      ".u4aDumpFigCap { margin-top: 0.375rem; font-size: 0.6875rem; line-height: 1.4; color: var(--text-muted); }" +
      // 사용 토글 행 — 스크롤 본문 밖 하단 고정(원본 footer-bar).
      ".u4aDumpToggleBar { flex: 0 0 auto; display: flex; align-items: center; gap: 0.75rem; margin: 0 1rem 0.5rem 1rem; border: 0.0625rem solid var(--line); border-radius: var(--radius); background: var(--surface); padding: 0.75rem 0.875rem; }" +
      ".u4aDumpToggleTexts { flex: 1 1 auto; min-width: 0; }" +
      ".u4aDumpToggleTitle { font-weight: 700; color: var(--text); }" +
      ".u4aDumpToggleDesc { font-size: 0.75rem; color: var(--text-muted); margin-top: 0.125rem; }" +
      ".u4aDumpSwitch { flex: 0 0 auto; }" +
      // 조회 모드(disabled) — 상태색(ON/OFF)은 유지하되 옅게 dim + 기본 커서로 읽기전용 표시.
      ".u4aDumpSwitch input:disabled + .u4a-switch__slider { opacity: 0.6; cursor: default; }" +
      // 푸터.
      ".u4aDumpFoot { display: flex; gap: 0.5rem; align-items: center; }" +
      ".u4aDumpFootSpacer { flex: 1 1 auto; }" +
      ".u4aDumpFoot .u4a-btn[hidden] { display: none; }" +
      ".u4aDumpIcoBtn { min-width: 2.5rem; justify-content: center; }";
    document.head.appendChild(oStyle);
  }

})(window, $, oAPP);
