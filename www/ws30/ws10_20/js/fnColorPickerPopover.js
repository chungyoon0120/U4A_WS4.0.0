/************************************************************************
 * Copyright 2020. INFOCG Inc. all rights reserved.
 * ----------------------------------------------------------------------
 * - file Name : fnColorPickerPopover.js
 * - file Desc : 공통 컬러 피커 팝오버 (HTML5) — 원본 sap.ui.unified.ColorPickerPopover 대체
 * ----------------------------------------------------------------------
 * [컨버전 메모]
 *  원본: uiAttributeArea.js attrCallValueHelpColor(oUi, is_attr)
 *        → jQuery.sap.require("sap.ui.unified.ColorPickerPopover")
 *        → new ColorPickerPopover().openBy(oUi) / setColorString(현재값)
 *        → attachChange: is_attr.UIATV = oEvent.getParameter("hex") → attrChange(is_attr,"INPUT").
 *        주 호출처: 컬러 관련 프로퍼티(attrIsColorProp)·Body Background Color(DH001109)의 F4 값도움.
 *
 *  HTML5: sap 의존 제거. 앵커(F4 클릭한 input) 기준 position:fixed 팝오버 — 색상 스펙트럼(SV) +
 *        Hue/Alpha 슬라이더 + R/G/B/Hex/A 입력 + OK/Cancel. OK 시 #rrggbb(원본 hex param 동일)를
 *        콜백으로 전달(여는 쪽이 UIATV 반영 + 변경처리). 공통 파일(u4a-ui.js/shell.css) 미수정 —
 *        화면 스코프(.u4aCp*) 주입 스타일만(테마 토큰 소비, 색 영역은 실제 색 인라인).
 *
 *  재사용: oAPP.fn.fnColorPickerOpen(oAnchorEl, sInitColor, fnConfirm).
 *    @param {HTMLElement} oAnchorEl   - 위치 기준 DOM(보통 input). 없으면 화면 중앙.
 *    @param {string}      sInitColor  - 초기 색(#rrggbb / "" ). 빈값이면 #ffffff.
 *    @param {function}    fnConfirm   - OK 시 fnConfirm("#rrggbb") 호출.
 *
 *  ※ 앵커 오버레이 공통 규칙(anchored-overlay): resize/scroll(capture) 시 재배치,
 *    바깥 클릭·ESC = 취소(닫기). 한 번에 하나만 열림(재호출 시 기존 것 닫고 새로).
 ************************************************************************/

(function (window, $, oAPP) {
  "use strict";

  var C_POP_ID = "u4aColorPickerPop";

  // ── 색 변환 헬퍼 ──────────────────────────────────────────────────────
  function _clamp(n, lo, hi) { n = Number(n); if (!isFinite(n)) { n = lo; } return Math.max(lo, Math.min(hi, n)); }
  function _h2(n) { n = _clamp(Math.round(n), 0, 255); return ("0" + n.toString(16)).slice(-2); }

  function hsv2rgb(h, s, v) {
    var c = v * s;
    var x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    var m = v - c;
    var r = 0, g = 0, b = 0;
    if (h < 60) { r = c; g = x; b = 0; }
    else if (h < 120) { r = x; g = c; b = 0; }
    else if (h < 180) { r = 0; g = c; b = x; }
    else if (h < 240) { r = 0; g = x; b = c; }
    else if (h < 300) { r = x; g = 0; b = c; }
    else { r = c; g = 0; b = x; }
    return { r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 };
  }
  function rgb2hsv(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    var max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    var h = 0;
    if (d !== 0) {
      if (max === r) { h = ((g - b) / d) % 6; }
      else if (max === g) { h = (b - r) / d + 2; }
      else { h = (r - g) / d + 4; }
      h *= 60; if (h < 0) { h += 360; }
    }
    return { h: h, s: max === 0 ? 0 : d / max, v: max };
  }
  function hex2rgb(sHex) {
    sHex = (sHex || "").toString().replace(/^#/, "").trim();
    if (sHex.length === 3) { sHex = sHex.split("").map(function (c) { return c + c; }).join(""); }
    if (!/^[0-9a-fA-F]{6}$/.test(sHex)) { return null; }
    return { r: parseInt(sHex.substr(0, 2), 16), g: parseInt(sHex.substr(2, 2), 16), b: parseInt(sHex.substr(4, 2), 16) };
  }
  function rgb2hex(r, g, b) { return "#" + _h2(r) + _h2(g) + _h2(b); }

  // ── 상태/캐시 ─────────────────────────────────────────────────────────
  var oUI = null;                 // DOM 캐시
  var oState = { h: 0, s: 0, v: 1, a: 1 };
  var fnOnConfirm = null;
  var oAnchorCur = null;

  function _el(sTag, sClass) { var o = document.createElement(sTag); if (sClass) { o.className = sClass; } return o; }
  function _fa(s) { return '<i class="fa-solid fa-' + s + '"></i>'; }
  function _wsTxt(sCode) {
    try {
      var L = (parent.getUserInfo && parent.getUserInfo().LANGU) || "";
      return parent.WSUTIL.getWsMsgClsTxt(L, "ZMSG_WS_COMMON_001", sCode, "") || "";
    } catch (e) { return ""; }
  }

  // 닫기(취소) — DOM 은 남기고 숨김 + 리스너 해제.
  function lf_close() {
    if (oUI && oUI.pop) { oUI.pop.style.display = "none"; }
    document.removeEventListener("mousedown", lf_outside, true);
    window.removeEventListener("resize", lf_reposition);
    window.removeEventListener("scroll", lf_reposition, true);
    document.removeEventListener("keydown", lf_keydown, true);
    fnOnConfirm = null; oAnchorCur = null;
  }

  function lf_outside(e) {
    if (!oUI || !oUI.pop) { return; }
    if (oUI.pop.contains(e.target)) { return; }
    // 앵커(또는 그 값도움 버튼) 재클릭은 토글 — 그대로 닫기.
    lf_close();
  }
  function lf_keydown(e) {
    if (e.key === "Escape") { e.preventDefault(); lf_close(); }
    else if (e.key === "Enter") {
      // 입력칸 안에서 Enter 는 적용(OK) 으로.
      e.preventDefault(); lf_confirm();
    }
  }

  // ── 위치 계산(앵커 기준) ──────────────────────────────────────────────
  function lf_reposition() {
    if (!oUI || !oUI.pop || oUI.pop.style.display === "none") { return; }
    var pop = oUI.pop;
    var pw = pop.offsetWidth, ph = pop.offsetHeight;
    var vw = window.innerWidth, vh = window.innerHeight, M = 6;
    var x, y;
    if (oAnchorCur && oAnchorCur.getBoundingClientRect) {
      var r = oAnchorCur.getBoundingClientRect();
      x = r.left;
      y = r.bottom + 4;
      if (x + pw > vw - M) { x = r.right - pw; }     // 우측 넘으면 오른쪽 정렬
      if (x < M) { x = M; }
      if (y + ph > vh - M) { y = r.top - ph - 4; }    // 아래 넘으면 위로
      if (y < M) { y = M; }
    } else {
      x = (vw - pw) / 2; y = (vh - ph) / 2;
    }
    pop.style.left = Math.round(x) + "px";
    pop.style.top = Math.round(y) + "px";
  }

  // ── 드래그 헬퍼(영역 내 비율 0~1 반환) ─────────────────────────────────
  function lf_drag(oArea, fnMove) {
    function _calc(ev) {
      var r = oArea.getBoundingClientRect();
      var px = ev.touches ? ev.touches[0].clientX : ev.clientX;
      var py = ev.touches ? ev.touches[0].clientY : ev.clientY;
      var fx = r.width ? (px - r.left) / r.width : 0;
      var fy = r.height ? (py - r.top) / r.height : 0;
      fnMove(_clamp(fx, 0, 1), _clamp(fy, 0, 1));
    }
    function _down(ev) {
      ev.preventDefault();
      _calc(ev);
      function _mv(e) { _calc(e); }
      function _up() { document.removeEventListener("mousemove", _mv); document.removeEventListener("mouseup", _up); }
      document.addEventListener("mousemove", _mv);
      document.addEventListener("mouseup", _up);
    }
    oArea.addEventListener("mousedown", _down);
  }

  // ── 빌드(1회) ─────────────────────────────────────────────────────────
  function lf_build() {
    lf_ensureStyle();

    var pop = _el("div", "u4aCpPop");
    pop.id = C_POP_ID;

    // 색상 스펙트럼(SV) — 배경은 hue 색 위에 white→투명(가로) + 투명→black(세로).
    var sv = _el("div", "u4aCpSv");
    var svWhite = _el("div", "u4aCpSvWhite");
    var svBlack = _el("div", "u4aCpSvBlack");
    var svPin = _el("div", "u4aCpSvPin");
    sv.appendChild(svWhite); sv.appendChild(svBlack); sv.appendChild(svPin);
    pop.appendChild(sv);

    // Hue 슬라이더.
    var hue = _el("div", "u4aCpHue");
    var huePin = _el("div", "u4aCpSlPin");
    hue.appendChild(huePin);
    pop.appendChild(hue);

    // Alpha 슬라이더(체커보드 + 현재색 그라디언트).
    var alpha = _el("div", "u4aCpAlpha");
    var alphaGrad = _el("div", "u4aCpAlphaGrad");
    var alphaPin = _el("div", "u4aCpSlPin");
    alpha.appendChild(alphaGrad); alpha.appendChild(alphaPin);
    pop.appendChild(alpha);

    // 미리보기 + 입력행(R G B Hex A).
    var rowIn = _el("div", "u4aCpInputs");
    var prev = _el("div", "u4aCpPreview");
    rowIn.appendChild(prev);

    function _numCell(sLabel) {
      var wrap = _el("div", "u4aCpNum");
      var inp = document.createElement("input");
      inp.type = "text"; inp.className = "u4aCpNumInp"; inp.inputMode = "numeric";
      var lab = _el("div", "u4aCpNumLab"); lab.textContent = sLabel;
      wrap.appendChild(inp); wrap.appendChild(lab);
      return { wrap: wrap, inp: inp };
    }
    var cR = _numCell("R"), cG = _numCell("G"), cB = _numCell("B");
    var hexWrap = _el("div", "u4aCpHexCell");
    var hexInp = document.createElement("input");
    hexInp.type = "text"; hexInp.className = "u4aCpHexInp"; hexInp.maxLength = 7;
    var hexLab = _el("div", "u4aCpNumLab"); hexLab.textContent = "Hex";
    hexWrap.appendChild(hexInp); hexWrap.appendChild(hexLab);
    var cA = _numCell("A");

    rowIn.appendChild(cR.wrap); rowIn.appendChild(cG.wrap); rowIn.appendChild(cB.wrap);
    rowIn.appendChild(hexWrap); rowIn.appendChild(cA.wrap);
    pop.appendChild(rowIn);

    // 푸터 — OK / Cancel.
    var foot = _el("div", "u4aCpFoot");
    var okBtn = _el("button", "u4a-btn u4a-btn--emphasized u4aCpBtn");
    okBtn.type = "button"; okBtn.innerHTML = _fa("check");
    okBtn.title = _wsTxt("232") || "OK";
    var cancelBtn = _el("button", "u4a-btn u4a-btn--negative u4aCpBtn");
    cancelBtn.type = "button"; cancelBtn.innerHTML = _fa("xmark");
    cancelBtn.title = _wsTxt("003") || "Cancel";
    foot.appendChild(_el("span", "u4aCpFootSp"));
    foot.appendChild(okBtn); foot.appendChild(cancelBtn);
    pop.appendChild(foot);

    document.body.appendChild(pop);

    oUI = {
      pop: pop, sv: sv, svWhite: svWhite, svBlack: svBlack, svPin: svPin,
      hue: hue, huePin: huePin, alpha: alpha, alphaGrad: alphaGrad, alphaPin: alphaPin,
      prev: prev, cR: cR.inp, cG: cG.inp, cB: cB.inp, hex: hexInp, cA: cA.inp,
      okBtn: okBtn, cancelBtn: cancelBtn
    };

    // 상호작용 배선.
    lf_drag(sv, function (fx, fy) { oState.s = fx; oState.v = 1 - fy; lf_renderFromState(true); });
    lf_drag(hue, function (fx) { oState.h = fx * 360; lf_renderFromState(true); });
    lf_drag(alpha, function (fx) { oState.a = fx; lf_renderFromState(true); });

    // 숫자 입력(R/G/B/A) — 변경 시 역산.
    function _onRgbInput() {
      var r = _clamp(oUI.cR.value, 0, 255), g = _clamp(oUI.cG.value, 0, 255), b = _clamp(oUI.cB.value, 0, 255);
      var hsv = rgb2hsv(r, g, b);
      oState.h = hsv.h; oState.s = hsv.s; oState.v = hsv.v;
      lf_renderFromState(false);   // 입력칸 자체는 다시 덮어쓰지 않게 일부 보존
      lf_syncInputs(true);
    }
    oUI.cR.addEventListener("input", _onRgbInput);
    oUI.cG.addEventListener("input", _onRgbInput);
    oUI.cB.addEventListener("input", _onRgbInput);
    oUI.cA.addEventListener("input", function () { oState.a = _clamp(oUI.cA.value, 0, 1); lf_renderFromState(true); });
    oUI.hex.addEventListener("input", function () {
      var rgb = hex2rgb(oUI.hex.value);
      if (!rgb) { return; }
      var hsv = rgb2hsv(rgb.r, rgb.g, rgb.b);
      oState.h = hsv.h; oState.s = hsv.s; oState.v = hsv.v;
      lf_renderFromState(false);
      lf_syncInputs(false);   // hex 입력 중엔 hex 칸 보존
    });

    okBtn.addEventListener("click", lf_confirm);
    cancelBtn.addEventListener("click", lf_close);
  }

  // 현재 oState 로 화면(스펙트럼/슬라이더/미리보기/입력) 갱신.
  //   bSyncAll: 입력칸까지 전부 갱신(드래그/슬라이더). false 면 입력칸은 lf_syncInputs 가 따로.
  function lf_renderFromState(bSyncAll) {
    var hueRgb = hsv2rgb(oState.h, 1, 1);
    oUI.sv.style.background = "rgb(" + Math.round(hueRgb.r) + "," + Math.round(hueRgb.g) + "," + Math.round(hueRgb.b) + ")";
    oUI.svPin.style.left = (oState.s * 100) + "%";
    oUI.svPin.style.top = ((1 - oState.v) * 100) + "%";
    oUI.huePin.style.left = (oState.h / 360 * 100) + "%";
    oUI.alphaPin.style.left = (oState.a * 100) + "%";

    var rgb = hsv2rgb(oState.h, oState.s, oState.v);
    var sRgb = "rgb(" + Math.round(rgb.r) + "," + Math.round(rgb.g) + "," + Math.round(rgb.b) + ")";
    oUI.alphaGrad.style.background = "linear-gradient(to right, rgba(" +
      Math.round(rgb.r) + "," + Math.round(rgb.g) + "," + Math.round(rgb.b) + ",0), " + sRgb + ")";
    oUI.svPin.style.background = sRgb;
    oUI.prev.style.background = "rgba(" + Math.round(rgb.r) + "," + Math.round(rgb.g) + "," + Math.round(rgb.b) + "," + oState.a + ")";

    if (bSyncAll) { lf_syncInputs(true); }
  }

  // 입력칸 동기화. bHex: hex 칸도 갱신할지(true=드래그/슬라이더, false=hex 타이핑 중 보존).
  function lf_syncInputs(bHex) {
    var rgb = hsv2rgb(oState.h, oState.s, oState.v);
    if (document.activeElement !== oUI.cR) { oUI.cR.value = Math.round(rgb.r); }
    if (document.activeElement !== oUI.cG) { oUI.cG.value = Math.round(rgb.g); }
    if (document.activeElement !== oUI.cB) { oUI.cB.value = Math.round(rgb.b); }
    if (document.activeElement !== oUI.cA) { oUI.cA.value = Math.round(oState.a * 100) / 100; }
    if (bHex && document.activeElement !== oUI.hex) { oUI.hex.value = rgb2hex(rgb.r, rgb.g, rgb.b); }
  }

  // OK — #rrggbb 콜백(원본 getParameter("hex") 동일, alpha 미반영).
  function lf_confirm() {
    var rgb = hsv2rgb(oState.h, oState.s, oState.v);
    var sHex = rgb2hex(rgb.r, rgb.g, rgb.b);
    var fn = fnOnConfirm;
    lf_close();
    if (typeof fn === "function") { try { fn(sHex); } catch (e) { console.error("[HTML5][ColorPicker] confirm cb 오류:", e && e.message); } }
  }

  /************************************************************************
   * 공개 진입점 — 컬러 피커 팝오버 열기.
   ************************************************************************/
  oAPP.fn.fnColorPickerOpen = function (oAnchorEl, sInitColor, fnConfirm) {
    if (!oUI || !oUI.pop || !document.body.contains(oUI.pop)) { oUI = null; lf_build(); }

    fnOnConfirm = (typeof fnConfirm === "function") ? fnConfirm : null;
    oAnchorCur = oAnchorEl || null;

    // 초기색 → 상태.
    var rgb = hex2rgb(sInitColor) || { r: 255, g: 255, b: 255 };
    var hsv = rgb2hsv(rgb.r, rgb.g, rgb.b);
    oState.h = hsv.h; oState.s = hsv.s; oState.v = hsv.v; oState.a = 1;

    lf_renderFromState(true);

    oUI.pop.style.display = "flex";
    // 화면 밖에서 한 번 그려 크기 확보 후 위치 계산.
    oUI.pop.style.left = "-9999px"; oUI.pop.style.top = "-9999px";
    lf_reposition();

    // 리스너(앵커 오버레이 공통 규칙).
    setTimeout(function () { document.addEventListener("mousedown", lf_outside, true); }, 0);
    window.addEventListener("resize", lf_reposition);
    window.addEventListener("scroll", lf_reposition, true);
    document.addEventListener("keydown", lf_keydown, true);
  };

  /************************************************************************
   * 스타일 1회 주입(테마 토큰 — 컨테이너/버튼. 색 영역은 실제 색 인라인).
   ************************************************************************/
  function lf_ensureStyle() {
    if (document.getElementById("u4aCpStyle")) { return; }
    var st = document.createElement("style");
    st.id = "u4aCpStyle";
    st.textContent =
      ".u4aCpPop{position:fixed;z-index:11000;width:15rem;box-sizing:border-box;" +
      "padding:0.625rem;background:var(--surface-raised,#1b2128);border:0.0625rem solid var(--line,#33414f);" +
      "border-radius:var(--radius,0.5rem);box-shadow:var(--popover-shadow,0 12px 36px rgba(0,0,0,.5));" +
      "flex-direction:column;gap:0.5rem;font-size:0.75rem;color:var(--text,#fff);display:none}" +
      // 스펙트럼.
      ".u4aCpSv{position:relative;width:100%;height:8.5rem;border-radius:0.375rem;overflow:hidden;" +
      "cursor:crosshair;border:0.0625rem solid var(--line,#33414f)}" +
      ".u4aCpSvWhite{position:absolute;inset:0;background:linear-gradient(to right,#fff,rgba(255,255,255,0))}" +
      ".u4aCpSvBlack{position:absolute;inset:0;background:linear-gradient(to top,#000,rgba(0,0,0,0))}" +
      ".u4aCpSvPin{position:absolute;width:0.75rem;height:0.75rem;border-radius:50%;transform:translate(-50%,-50%);" +
      "border:0.125rem solid #fff;box-shadow:0 0 0 0.0625rem rgba(0,0,0,.5);pointer-events:none}" +
      // 슬라이더 공통.
      ".u4aCpHue,.u4aCpAlpha{position:relative;width:100%;height:0.875rem;border-radius:0.4375rem;cursor:pointer;" +
      "border:0.0625rem solid var(--line,#33414f)}" +
      ".u4aCpHue{background:linear-gradient(to right,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)}" +
      ".u4aCpAlpha{background-image:linear-gradient(45deg,#888 25%,transparent 25%),linear-gradient(-45deg,#888 25%,transparent 25%)," +
      "linear-gradient(45deg,transparent 75%,#888 75%),linear-gradient(-45deg,transparent 75%,#888 75%);" +
      "background-size:0.5rem 0.5rem;background-position:0 0,0 0.25rem,0.25rem -0.25rem,-0.25rem 0}" +
      ".u4aCpAlphaGrad{position:absolute;inset:0;border-radius:0.375rem}" +
      ".u4aCpSlPin{position:absolute;top:50%;width:0.875rem;height:0.875rem;border-radius:50%;transform:translate(-50%,-50%);" +
      "background:#fff;border:0.125rem solid #fff;box-shadow:0 0 0 0.0625rem rgba(0,0,0,.6);pointer-events:none}" +
      // 입력행.
      ".u4aCpInputs{display:flex;align-items:flex-start;gap:0.25rem}" +
      ".u4aCpPreview{flex:0 0 auto;width:1.75rem;height:2.25rem;border-radius:0.375rem;border:0.0625rem solid var(--line,#33414f);" +
      "background-image:linear-gradient(45deg,#888 25%,transparent 25%),linear-gradient(-45deg,#888 25%,transparent 25%);" +
      "background-size:0.5rem 0.5rem}" +
      ".u4aCpNum,.u4aCpHexCell{display:flex;flex-direction:column;align-items:center;gap:0.125rem;min-width:0}" +
      ".u4aCpNum{flex:1 1 0}" +
      ".u4aCpHexCell{flex:1.6 1 0}" +
      ".u4aCpNumInp,.u4aCpHexInp{width:100%;box-sizing:border-box;text-align:center;padding:0.25rem 0.125rem;" +
      "background:var(--surface,#11161c);color:var(--text,#fff);border:0.0625rem solid var(--line,#33414f);" +
      "border-radius:0.25rem;font-size:0.75rem;font-family:inherit}" +
      ".u4aCpNumInp:focus,.u4aCpHexInp:focus{outline:none;border-color:var(--accent,#3b82f6)}" +
      ".u4aCpNumLab{font-size:0.625rem;color:var(--text-muted,#9aa3ad)}" +
      // 푸터.
      ".u4aCpFoot{display:flex;align-items:center;gap:0.375rem;margin-top:0.125rem}" +
      ".u4aCpFootSp{flex:1 1 auto}" +
      ".u4aCpBtn{min-width:2.25rem;justify-content:center}";
    document.head.appendChild(st);
  }

})(window, $, oAPP);
