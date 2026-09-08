/************************************************************************
 * uiMovePosition.js  (UI move Position 메뉴 선택시 팝업 UI)
 * ----------------------------------------------------------------------
 * [컨버전 메모]
 *  원본: sap.ui.getCore().loadLibrary("sap.m") + sap.m.Dialog(+Grid/Label/
 *        StepInput/Slider/Button) + JSONModel two-way binding.
 *        → 미리보기 영역 우클릭("위치 이동")은 이 파일을 메인 창에서 실행하는데,
 *          메인 창 sap 은 호환 스텁이라 loadLibrary 가 없어 예외로 화면이 잠겼다(BR18).
 *  HTML5: native <dialog class="u4a-dialog"> + 공통 컴포넌트.
 *        모양·로직은 트리 우클릭 위치이동 팝업(ws_html5_ws20_edit.js _moveUIPosition)과
 *        완전히 동일하게 통일 — 헤더(이동 아이콘+타이틀+닫기X) / 바디(숫자입력 "/ N"
 *        + 슬라이더) / 푸터(공통 --emphasized ✓ · --negative ✗) / 드래그·리센터·리사이즈.
 *
 *  ★ 보존(원본 그대로): 함수 시그니처/콜백 계약 1:1
 *    · oAPP.fn.uiMovePosition(is_parent, OBJID, pos, max, f_callBack, i_x, i_y)
 *    · pos = 현재 1-based 위치, max = 형제 수.
 *    · 확인 → f_callBack(대상 0-based index). 호출측 lf_callback 이 이미 HTML5 로
 *      동작하는 oAPP.fn.contextMenuUiMove(undefined, pos) 로 실제 이동을 수행(undo/미리보기 포함).
 *    · 취소(헤더 X · 푸터 ✗ · ESC) → 001 "Cancel operation" 안내 + setShortcutLock(false).
 *
 *  ★ UI5 의존부 치환/정리:
 *    · sap.ui.getCore().loadLibrary / sap.m.*  → DOM + shell.css 공통 컴포넌트
 *    · designMoveMark(미리보기 위치 프리뷰 하이라이트) → UI5 전용(uiDesignArea.js)이라
 *      HTML5 런타임엔 미로드 → 호출 제거(트리 위치이동 팝업도 미사용, 확정시 이동만 수행).
 *    · parent.showMessage(sap,…)  → parent.showMessage(null,…)
 *    · i_x/i_y 좌표 지정 오픈  → 공통 showModal 중앙 배치 + 드래그/리센터(트리판과 동일).
 ************************************************************************/

// UI move Position 메뉴 선택시 팝업 UI.
oAPP.fn.uiMovePosition = function (is_parent, OBJID, pos, max, f_callBack, i_x, i_y) {

  var APPCOMMON = oAPP.common;

  // 메시지 클래스 텍스트(공통) — 안전 가드.
  function _msg(sCode, sFallback) {
    try {
      var s = APPCOMMON.fnGetMsgClsText("/U4A/CL_WS_COMMON", sCode, "", "", "", "");
      return (s === "" || typeof s === "undefined") ? (sFallback || sCode) : s;
    } catch (e) { return sFallback || sCode; }
  }
  function _msgWs(sCode, sFallback) {
    try {
      var s = APPCOMMON.fnGetMsgClsText("/U4A/MSG_WS", sCode, "", "", "", "");
      return (s === "" || typeof s === "undefined") ? (sFallback || sCode) : s;
    } catch (e) { return sFallback || sCode; }
  }
  function _esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c];
    });
  }

  // 형제 수/현재 위치(1-based) 방어.
  var nTot = parseInt(max, 10);
  if (!(nTot >= 1)) { nTot = 1; }
  var iCur = parseInt(pos, 10) - 1;
  if (!(iCur >= 0)) { iCur = 0; }
  if (iCur > nTot - 1) { iCur = nTot - 1; }

  // ── 다이얼로그 골격(트리 위치이동 팝업과 동일 통일) ──────────────────
  var oDlg = document.createElement("dialog");
  oDlg.className = "u4a-dialog";
  oDlg.style.cssText = "width:min(92vw,360px);padding:0;display:flex;flex-direction:column";
  oDlg.innerHTML =
    '<div class="u4a-dialog__header">' +
    '  <i class="fa-solid fa-up-down-left-right" aria-hidden="true"></i><span>' + _esc(_msg("A57", "Move Position") + " - " + OBJID) + '</span>' +
    '  <button type="button" class="u4a-btn-icon" data-act="cancel" aria-label="Close" title="' + _esc(_msg("A39", "Close")) + '"><i class="fa-solid fa-xmark"></i></button>' +
    '</div>' +
    '<div class="u4a-dialog__body" style="flex:1 1 auto;display:flex;flex-direction:column;gap:1rem;padding:1.25rem 1.5rem;overflow:visible">' +
    '  <div style="display:flex;align-items:baseline;justify-content:center;gap:0.4rem">' +
    '    <input type="number" class="u4a-input u4aWs20MovePos" style="width:4.5rem;font-size:1.6rem;font-weight:700;text-align:center;flex:0 0 auto" min="1" max="' + nTot + '" value="' + (iCur + 1) + '">' +
    '    <span style="color:var(--text-muted);font-size:1rem">/ ' + nTot + '</span>' +
    '  </div>' +
    '  <div style="display:flex;align-items:center;gap:0.75rem;width:100%">' +
    '    <span style="color:var(--text-muted);font-size:0.8rem;flex:0 0 auto">1</span>' +
    '    <input type="range" class="u4aWs20MovePosRange" style="flex:1 1 auto;min-width:0;accent-color:var(--accent);cursor:pointer" min="1" max="' + nTot + '" value="' + (iCur + 1) + '">' +
    '    <span style="color:var(--text-muted);font-size:0.8rem;flex:0 0 auto">' + nTot + '</span>' +
    '  </div>' +
    '</div>' +
    '<div class="u4a-dialog__footer">' +
    '  <button type="button" class="u4a-btn u4a-btn--emphasized" data-act="ok" title="' + _esc(_msg("A40", "Confirm")) + '"><i class="fa-solid fa-check"></i></button>' +
    '  <button type="button" class="u4a-btn u4a-btn--negative" data-act="cancel" title="' + _esc(_msg("A39", "Close")) + '"><i class="fa-solid fa-xmark"></i></button>' +
    '</div>';

  var oInp = oDlg.querySelector(".u4aWs20MovePos");
  var oRange = oDlg.querySelector(".u4aWs20MovePosRange");

  function lf_clamp(v) { v = parseInt(v, 10); if (!(v >= 1)) { v = 1; } if (v > nTot) { v = nTot; } return v; }

  // 이동 가능 위치 + 이동 대상(자기) + 대상 위치를 디자인 트리에 미리 강조(원본 designMoveMark 1:1 이식).
  //  원본 함수는 UI5 uiDesignArea.js 정의라 HTML5 미로드 → 동일 로직을 여기서 재현
  //  (트리 노드 highlight + fnRenderDesignTree 재렌더). iPos1 = 대상 1-based 위치. bReset=true 면 강조 제거.
  //  ※ 원본의 대상 라인 자동 스크롤(designSetScrollPosOBJID)은 HTML5 공개 함수가 없어 제외(강조 색만 재현).
  function lf_moveMark(iPos1, bReset) {
    if (!is_parent || !is_parent.zTREE) { return; }
    for (var i = 0, l = is_parent.zTREE.length; i < l; i++) {
      var nd = is_parent.zTREE[i];
      if (bReset === true) { nd.highlight = "None"; continue; }
      nd.highlight = "Indication04";                             // 이동 가능 위치
      if (nd.OBJID === OBJID) { nd.highlight = "Indication08"; }  // 이동 대상(자기)
      if (i + 1 === iPos1) { nd.highlight = "Indication02"; }     // 대상 위치
    }
    try { if (typeof oAPP.fn.fnRenderDesignTree === "function") { oAPP.fn.fnRenderDesignTree(); } } catch (e) { }
    // 원본 designSetScrollPosOBJID: 대상 위치 줄이 화면 밖이면 그 줄로 스크롤(초기화 때는 안 함).
    if (bReset !== true) {
      var oTgt = is_parent.zTREE[iPos1 - 1];
      try { if (oTgt && typeof oAPP.fn.fnWs20ScrollTreeToOBJID === "function") { oAPP.fn.fnWs20ScrollTreeToOBJID(oTgt.OBJID); } } catch (e) { }
    }
  }

  // 팝업 종료(원본 lf_close: 미리강조 제거 + setShortcutLock(false) + 닫기).
  function lf_close() {
    lf_moveMark(1, true);   // 원본 designMoveMark(reset) — 미리강조 원복
    try { oAPP.fn.setShortcutLock(false); } catch (e) { }
    try { oDlg.close(); } catch (e) { }
    try { oDlg.remove(); } catch (e) { }
  }

  // 취소(헤더 X · 푸터 ✗ · ESC) — 원본 동작: 001 "Cancel operation" 안내.
  function lf_cancel() {
    lf_close();
    //001	Cancel operation
    try { parent.showMessage(null, 10, "I", _msgWs("001", "Cancel operation")); } catch (e) { }
  }

  // 확인 — 대상 위치(0-based)로 콜백. 실제 이동은 호출측(콜백→contextMenuUiMove 위임 래퍼→
  //  fnWs20MoveUIToIndex)이 수행하며 트리 위치이동과 동일한 동기 이동이다.
  //  ★ 이동이 동기(즉시)라 연타 틈이 없어 트리 위치이동 팝업처럼 별도 부모 busy 를 걸지 않는다.
  //    (걸면 동일 위치 확정 등 no-op 경로에서 해제 짝이 없어 오히려 화면이 잠긴다. 이동 중 짧은 잠금은
  //     이동 끝 updateBindPopupDesignData 왕복이 자체적으로 걸었다 푼다.)
  function lf_ok() {
    var v = lf_clamp(oInp.value);
    var iTarget = v - 1;
    lf_close();
    try { if (typeof f_callBack === "function") { f_callBack(iTarget); } }
    catch (e) { console.error("[HTML5][uiMovePosition] callback 수행 실패:", e && e.message); }
  }

  // 확인 버튼.
  oDlg.querySelector('[data-act="ok"]').addEventListener("click", lf_ok);

  // 값 표시(숫자칸↔슬라이더 위치)는 실시간(input)으로 동기화하되,
  //  트리 다시 그리기(미리강조)는 마우스를 놓는 순간(change)에만 → 슬라이더 끌 때 매번 트리를 다시
  //  그리지 않아 버벅임 방지. change: 슬라이더=놓는 순간, 숫자칸=포커스 떠날 때/Enter.
  oRange.addEventListener("input", function () { oInp.value = String(lf_clamp(oRange.value)); });
  oInp.addEventListener("input", function () { oRange.value = String(lf_clamp(oInp.value)); });
  oRange.addEventListener("change", function () { lf_moveMark(lf_clamp(oRange.value)); });
  oInp.addEventListener("change", function () { lf_moveMark(lf_clamp(oInp.value)); });

  // 헤더 X + 푸터 ✗ 둘 다 data-act="cancel" → 취소.
  oDlg.querySelectorAll('[data-act="cancel"]').forEach(function (b) { b.addEventListener("click", lf_cancel); });
  oDlg.addEventListener("cancel", function (e) { e.preventDefault(); lf_cancel(); });

  // 숫자 input Enter → 확인 버튼으로 포커스 이동(원본 attachBrowserEvent keydown 13 → oBtn1.focus() 1:1).
  //  (즉시 확정 아님 — 원본대로 포커스만 이동 후 사용자가 확인 버튼에서 다시 확정.)
  oInp.addEventListener("keydown", function (e) {
    if (e.key !== "Enter") { return; }
    e.preventDefault();
    try { oDlg.querySelector('[data-act="ok"]').focus(); } catch (e2) { }
  });

  document.body.appendChild(oDlg);

  // 공통 UX 3종(헤더드래그는 전역 위임 자동) — 리센터/리사이즈.
  var oHeader = oDlg.querySelector(".u4a-dialog__header");
  try { if (window.U4AUI && U4AUI.makeDialogRecenter) { U4AUI.makeDialogRecenter(oDlg, oHeader); } } catch (e) { }
  try { if (window.U4AUI && U4AUI.makeDialogResizable) { U4AUI.makeDialogResizable(oDlg, { minW: 280, minH: 160 }); } } catch (e) { }

  // 메뉴 선택 시 켠 잠금(단축키+로딩표시)을 확실히 푸는 공통 종료 정리.
  //  ★ 어떤 종료 분기(오픈 실패·예외 포함)에서도 반드시 도달해야 화면 잠금이 남지 않는다
  //    (callDesignContextMenu 15~17행이 parent.setBusy("X")/setShortcutLock(true) 로 켠 상태).
  function lf_releaseLocks() {
    try { oAPP.fn.setShortcutLock(false); } catch (e) { }
    try { parent.setBusy(""); } catch (e) { }
  }

  // 팝업 호출(구 oDlg.open()) — 오픈 성공을 확인한 뒤에만 정상 진행.
  //  showModal 이 실패(이미 열림/비부착 등)하거나, 위 생성·배선 중 예외가 나면 잠금이 남지 않게
  //  정리 후 오류를 표면화(조용한 catch 금지)하고 중단한다.
  var bOpened = false;
  try {
    oDlg.showModal();
    bOpened = true;
  } catch (e) {
    console.error("[HTML5][uiMovePosition] 팝업 열기 실패:", e && e.message);
  }

  // 오픈 실패 — DOM 잔여 제거 + 잠금 해제 후 중단(화면 잠김 방지).
  if (!bOpened) {
    try { oDlg.remove(); } catch (e) { }
    lf_releaseLocks();
    return;
  }

  // 호출 후(구 attachAfterOpen): 잠금 해제 + 입력칸 포커스/선택.
  //  ★ 팝업이 완전히 뜬 뒤 여기서 로딩표시를 꺼야 팝업 클릭이 먹힌다(안 끄면 덮개가 팝업 위에 남음).
  lf_releaseLocks();
  lf_moveMark(iCur + 1);   // 원본 attachAfterOpen: 현재 위치 기준 초기 미리강조.
  setTimeout(function () { try { oInp.focus(); oInp.select(); } catch (e) { } }, 0);

};  // UI move Position 메뉴 선택시 팝업 UI.
