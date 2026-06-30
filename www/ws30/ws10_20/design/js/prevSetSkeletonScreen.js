/************************************************************************
 * Copyright 2020. INFOCG Inc. all rights reserved.
 * ----------------------------------------------------------------------
 * - file Name : prevSetSkeletonScreen.js
 * - file Desc : WS20 "특수 에디터 > 스켈레톤 화면 설정"(WMENU30_05) 팝업 (HTML5)
 * ----------------------------------------------------------------------
 * [컨버전 메모]
 *  원본(UI5): 본 파일이 sap.m.Dialog + sap.ui.layout.form.Form 으로 스켈레톤 설정
 *        다이얼로그를 구성했다(체크박스 2 + StepInput 1 + 설명/도움말 텍스트).
 *        진입 경로(유지): fnHmws.js fnWS20WMENU30_05 → oAPP.fn.prevSetSkeletonScreen()
 *        (uiPreviewArea.js:1195, HTML5 도 지연 로드) → .oppner 미정의면 getScript 로 본
 *        파일을 로드 후 oppner() 실행. 따라서 본 파일은 oppner 만 HTML5 로 교체한다.
 *
 *  HTML5: native <dialog class="u4a-dialog"> + 공통 컴포넌트(.u4a-check · .u4a-field /
 *        U4AUI.createField · .u4a-btn · U4AUI.confirm · makeDialogRecenter/Resizable /
 *        전역 헤더 드래그). DumpWrite(fnDumpWritePopupOpen.js) 팝업과 동일 컨벤션.
 *        ★ 공통 파일(shell.css/u4a-ui.js) 미수정 — 화면 스코프(.u4aSkel*) 주입 스타일만.
 *
 *  ★ 보존 로직(원본 1:1):
 *    · 초기값 = oAPP.DATA.APPDATA.T_SKLE 에서 OPT_IS_WAIT/OPT_USE_GLASS("X") ·
 *      OPT_GLASS_DENSITY(float) 복원. T_SKLE 없으면 false/false/0.
 *    · Apply: 282 확인 → YES 시 ls_opt(IS_WAIT/USE_GLASS="X"|""·GLASS_DENSITY:number) 구성 →
 *      oAPP.attr.ui.frame.contentWindow._get_skeleton_tag_info(ls_opt) (미리보기 iframe,
 *      현재 레이아웃 기준 스켈레톤 태그정보 산출) → oAPP.DATA.APPDATA.T_SKLE 갱신 →
 *      005(Job finished) 토스트 → oAPP.fn.setChangeFlag() → 닫기. (원본 lf_setSkeletonData)
 *    · Glass concentration 범위 0.0~100.0, step 0.1, 소숫점 1자리(원본 StepInput
 *      displayValuePrecision:1). 대기 모드/투명 사용 체크는 서로 독립(원본 동일).
 *  ★ 메시지: 전부 기존 키 소비(신규 문구 없음).
 *    B10 제목 · B11 대기 모드 효과 · B12 투명 사용 · B13 투명 농도 · B14 Apply · A39 Close,
 *    MSG_WS 287+288 설명 · 289~293 도움말 · 282 적용 확인 · 005 완료.
 *  ★ UI5 의존부 치환: sap.m.Dialog → <dialog>, parent.showMessage(KIND 30) 확인창은
 *    HTML5 미지원(ws_html5_shell.js 주석) → U4AUI.confirm. KIND 10 토스트는 그대로.
 ************************************************************************/

(function () {
    "use strict";

    var C_DLG_ID = "u4aSkeletonDlg";

    // ── 로컬 헬퍼(DumpWrite/WebSecurity 팝업과 동일 컨벤션) ──────────────────
    function _fa(s) { return '<i class="fa-solid fa-' + s + '"></i>'; }
    function _el(sTag, sClass, sText) {
        var o = document.createElement(sTag);
        if (sClass) { o.className = sClass; }
        if (typeof sText !== "undefined") { o.textContent = sText; }
        return o;
    }
    function _msg(sCls, sCode) {
        try { return oAPP.common.fnGetMsgClsText(sCls, sCode, "", "", "", "") || ""; }
        catch (e) { return ""; }
    }

    // Glass concentration 정규화 — 0.0~100.0, 소숫점 1자리(원본 step 0.1 / precision 1).
    function _clampDensity(v) {
        var n = parseFloat(v);
        if (!isFinite(n)) { n = 0; }
        if (n < 0) { n = 0; }
        if (n > 100) { n = 100; }
        return Math.round(n * 10) / 10;
    }
    function _fmt(n) { return _clampDensity(n).toFixed(1); }

    // 단일 캐시(빌드 1회 후 재사용 — 닫으면 공통이 DOM 제거, 다음 열기 때 재빌드).
    var oUI = null;

    function lf_close() {
        try { if (oUI && oUI.dlg && oUI.dlg.open) { oUI.dlg.close(); } } catch (e) { }
    }

    // ── 화면 출력 정보 구성(원본 lf_getSkeletonData) — T_SKLE → 초기값 ──
    function lf_loadData() {
        var bWait = false, bGlass = false, fDensity = 0;
        try {
            var aSkle = (oAPP.DATA && oAPP.DATA.APPDATA && oAPP.DATA.APPDATA.T_SKLE) || [];
            if (aSkle.length) {
                var l1 = aSkle.find(function (a) { return a.NAME === "OPT_IS_WAIT"; });
                if (l1 && l1.VALUE === "X") { bWait = true; }
                var l2 = aSkle.find(function (a) { return a.NAME === "OPT_USE_GLASS"; });
                if (l2 && l2.VALUE === "X") { bGlass = true; }
                var l3 = aSkle.find(function (a) { return a.NAME === "OPT_GLASS_DENSITY"; });
                if (l3) { fDensity = parseFloat(l3.VALUE); }
            }
        } catch (e) { console.error("[HTML5][WS20][Skeleton] T_SKLE 로드 오류:", e && e.message); }

        oUI.wait.checked = bWait;
        oUI.glass.checked = bGlass;
        oUI.density.input.value = _fmt(fDensity);
    }

    // ── Apply(원본 lf_setSkeletonData) — 확인 후 현재 미리보기 기준 스켈레톤 저장정보 구성 ──
    function lf_apply() {

        // 282  현재 미리보기 화면의 레이아웃 기준으로 Skeleton Screen을 설정 하시겠습니까?
        U4AUI.confirm({
            type: "C",
            title: _msg("/U4A/CL_WS_COMMON", "B10"),
            message: _msg("/U4A/MSG_WS", "282"),
            buttons: [
                { act: "YES", label: _msg("/U4A/CL_WS_COMMON", "B14"), emphasized: true }, // Apply setting
                { act: "NO", label: _msg("/U4A/CL_WS_COMMON", "A39") }                     // Close
            ],
            onClose: function (sAct) {
                if (sAct !== "YES") { return; }

                var ls_opt = {
                    OPT_IS_WAIT: oUI.wait.checked ? "X" : "",
                    OPT_USE_GLASS: oUI.glass.checked ? "X" : "",
                    OPT_GLASS_DENSITY: _clampDensity(oUI.density.input.value)
                };

                // 현재 출력된 미리보기 화면 기준 Skeleton Screen 저장 정보 구성(미리보기 iframe 함수 — 보존).
                try {
                    oAPP.DATA.APPDATA.T_SKLE =
                        oAPP.attr.ui.frame.contentWindow._get_skeleton_tag_info(ls_opt);
                } catch (e) {
                    console.error("[HTML5][WS20][Skeleton] _get_skeleton_tag_info 오류:", e && e.message);
                    return;
                }

                lf_close();

                // 005  Job finished. (KIND 10 토스트 — 공통 정중앙. DumpWrite 와 동일 경로)
                try { parent.showMessage(null, 10, "S", _msg("/U4A/MSG_WS", "005")); } catch (e) { }

                // 변경 flag 처리(원본 oAPP.fn.setChangeFlag).
                try { oAPP.fn.setChangeFlag(); } catch (e) { }
            }
        });
    }

    /************************************************************************
     * 다이얼로그 1회 생성(이후 재사용).
     ************************************************************************/
    function lf_build() {
        lf_ensureStyle();
        oUI = {};

        var oDlg = document.createElement("dialog");
        oDlg.id = C_DLG_ID;
        oDlg.className = "u4a-dialog u4aSkelDlg";

        // ── 헤더 — sliders 아이콘(메뉴 아이콘) + B10 제목 + 닫기 X ──
        var oHeader = _el("div", "u4a-dialog__header");
        oHeader.innerHTML = _fa("sliders") + "<span></span>";
        oHeader.querySelector("span").textContent = _msg("/U4A/CL_WS_COMMON", "B10");
        var oXBtn = _el("button", "u4a-btn-icon");
        oXBtn.type = "button";
        oXBtn.innerHTML = _fa("xmark");
        oXBtn.title = _msg("/U4A/CL_WS_COMMON", "A39");   // Close
        oXBtn.addEventListener("click", function () { lf_close(); });
        oHeader.appendChild(oXBtn);
        oDlg.appendChild(oHeader);

        // ── 본문 ──
        var oBody = _el("div", "u4a-dialog__body u4aSkelBody");

        // 설명(287 + 288).
        var sIntro = _msg("/U4A/MSG_WS", "287") + "\n" + _msg("/U4A/MSG_WS", "288");
        oBody.appendChild(_el("p", "u4aSkelIntro", sIntro));

        // 설정 카드.
        var oCard = _el("div", "u4aSkelCard");

        // 대기 모드 효과(B11) — OPT_IS_WAIT.
        var oWaitWrap = _el("label", "u4a-check u4aSkelRow");
        oUI.wait = document.createElement("input");
        oUI.wait.type = "checkbox";
        oWaitWrap.appendChild(oUI.wait);
        oWaitWrap.appendChild(_el("span", null, _msg("/U4A/CL_WS_COMMON", "B11")));
        oCard.appendChild(oWaitWrap);

        // 투명 사용(B12) — OPT_USE_GLASS.
        var oGlassWrap = _el("label", "u4a-check u4aSkelRow");
        oUI.glass = document.createElement("input");
        oUI.glass.type = "checkbox";
        oGlassWrap.appendChild(oUI.glass);
        oGlassWrap.appendChild(_el("span", null, _msg("/U4A/CL_WS_COMMON", "B12")));
        oCard.appendChild(oGlassWrap);

        // 투명 농도(B13) — OPT_GLASS_DENSITY. [−][입력칸][+] 스텝퍼(원본 StepInput).
        var oDensityRow = _el("div", "u4aSkelRow u4aSkelDensityRow");
        oDensityRow.appendChild(_el("span", "u4aSkelLabel", _msg("/U4A/CL_WS_COMMON", "B13")));

        var oStep = _el("div", "u4aSkelStep");
        var oMinus = _el("button", "u4a-btn-icon u4aSkelStepBtn");
        oMinus.type = "button";
        oMinus.innerHTML = _fa("minus");
        oUI.density = U4AUI.createField({
            id: "u4aSkelDensity",
            value: "0.0",
            inputClassName: "u4aSkelDensityInput",
            onChange: function (v) { oUI.density.input.value = _fmt(v); }
        });
        oUI.density.input.setAttribute("inputmode", "decimal");
        var oPlus = _el("button", "u4a-btn-icon u4aSkelStepBtn");
        oPlus.type = "button";
        oPlus.innerHTML = _fa("plus");
        oMinus.addEventListener("click", function () {
            oUI.density.input.value = _fmt(_clampDensity(oUI.density.input.value) - 0.1);
        });
        oPlus.addEventListener("click", function () {
            oUI.density.input.value = _fmt(_clampDensity(oUI.density.input.value) + 0.1);
        });
        oStep.appendChild(oMinus);
        oStep.appendChild(oUI.density.el);
        oStep.appendChild(oPlus);
        oDensityRow.appendChild(oStep);
        oCard.appendChild(oDensityRow);

        // 도움말(289~293).
        var sHelp = [
            _msg("/U4A/MSG_WS", "289"),
            _msg("/U4A/MSG_WS", "290"),
            _msg("/U4A/MSG_WS", "291"),
            _msg("/U4A/MSG_WS", "292"),
            _msg("/U4A/MSG_WS", "293")
        ].join("\n");
        oCard.appendChild(_el("p", "u4aSkelHelp", sHelp));

        oBody.appendChild(oCard);
        oDlg.appendChild(oBody);

        // ── 푸터 — [Apply 파랑] [Close Reject] ──
        var oFoot = _el("div", "u4a-dialog__footer u4aSkelFoot");
        oFoot.appendChild(_el("span", "u4aSkelFootSpacer"));
        var oApplyBtn = _el("button", "u4a-btn u4a-btn--emphasized u4aSkelIcoBtn");
        oApplyBtn.type = "button";
        oApplyBtn.innerHTML = _fa("check");
        oApplyBtn.title = _msg("/U4A/CL_WS_COMMON", "B14");   // Apply setting
        oApplyBtn.addEventListener("click", function () { lf_apply(); });
        var oCloseBtn = _el("button", "u4a-btn u4a-btn--negative u4aSkelIcoBtn");
        oCloseBtn.type = "button";
        oCloseBtn.innerHTML = _fa("xmark");
        oCloseBtn.title = _msg("/U4A/CL_WS_COMMON", "A39");   // Close
        oCloseBtn.addEventListener("click", function () { lf_close(); });
        oFoot.appendChild(oApplyBtn);
        oFoot.appendChild(oCloseBtn);
        oDlg.appendChild(oFoot);

        // ESC = 닫기(원본 Reject).
        oDlg.addEventListener("cancel", function (e) { e.preventDefault(); lf_close(); });

        if (window.U4AUI && U4AUI.makeDialogRecenter) { U4AUI.makeDialogRecenter(oDlg, oHeader); }
        if (window.U4AUI && U4AUI.makeDialogResizable) { U4AUI.makeDialogResizable(oDlg, { minW: 360, minH: 320 }); }

        document.body.appendChild(oDlg);
        oUI.dlg = oDlg;
    }

    /************************************************************************
     * 스켈레톤 설정 팝업 열기 — uiPreviewArea.js 가 .oppner 로 호출.
     *   닫을 때 DOM 제거(공통)되므로 매번 contains 가드로 새로 build.
     ************************************************************************/
    oAPP.fn.prevSetSkeletonScreen.oppner = function () {

        if (!oUI || !oUI.dlg || !document.body.contains(oUI.dlg)) { oUI = null; lf_build(); }

        if (oUI.dlg.open) { return; }

        // 초기값 구성(원본 attachBeforeOpen → lf_getSkeletonData).
        lf_loadData();

        try { oUI.dlg.showModal(); } catch (e) { }
    };

    /************************************************************************
     * 공통 스타일 1회 주입(테마 토큰 소비 — 공통 파일 미수정, 화면 스코프만).
     ************************************************************************/
    function lf_ensureStyle() {
        if (document.getElementById("u4aSkelStyle")) { return; }
        var oStyle = document.createElement("style");
        oStyle.id = "u4aSkelStyle";
        oStyle.textContent =
            ".u4aSkelDlg { width: min(94vw, 540px); max-height: 90vh; padding: 0; display: flex; flex-direction: column; }" +
            ".u4aSkelDlg .u4a-dialog__header { cursor: move; user-select: none; }" +
            ".u4aSkelDlg .u4a-dialog__header span { flex: 1 1 auto; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }" +
            ".u4aSkelBody { flex: 1 1 auto; min-height: 0; overflow: auto; display: flex; flex-direction: column; gap: 0.875rem; padding: 1rem; }" +
            // 설명.
            ".u4aSkelIntro { margin: 0; white-space: pre-line; font-size: 0.8125rem; line-height: 1.6; color: var(--text); }" +
            // 설정 카드.
            ".u4aSkelCard { display: flex; flex-direction: column; gap: 0.875rem; border: 0.0625rem solid var(--line); border-radius: var(--radius); background: var(--surface); padding: 0.875rem 1rem; }" +
            ".u4aSkelRow { margin: 0; }" +
            ".u4aSkelDensityRow { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; }" +
            ".u4aSkelLabel { font-weight: 600; color: var(--text); }" +
            // 농도 스텝퍼.
            ".u4aSkelStep { display: flex; align-items: center; gap: 0.375rem; }" +
            ".u4aSkelStep .u4a-field { width: 5rem; }" +
            ".u4aSkelStep .u4aSkelDensityInput { text-align: center; }" +
            ".u4aSkelStepBtn { flex: 0 0 auto; }" +
            // 도움말(좌측 accent 보더 + 옅은 틴트 — color-mix 미사용 토큰).
            ".u4aSkelHelp { margin: 0; white-space: pre-line; border-left: 0.25rem solid var(--accent); background: var(--hover-bg); border-radius: 0.5rem; padding: 0.625rem 0.75rem; font-size: 0.75rem; line-height: 1.55; color: var(--text-muted); }" +
            // 푸터.
            ".u4aSkelFoot { display: flex; gap: 0.5rem; align-items: center; }" +
            ".u4aSkelFootSpacer { flex: 1 1 auto; }" +
            ".u4aSkelIcoBtn { min-width: 2.5rem; justify-content: center; }";
        document.head.appendChild(oStyle);
    }

})();
