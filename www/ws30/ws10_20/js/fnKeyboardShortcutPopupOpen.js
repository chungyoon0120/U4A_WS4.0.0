/************************************************************************
 * Copyright 2020. INFOCG Inc. all rights reserved.
 * ----------------------------------------------------------------------
 * - file Name : fnKeyboardShortcutPopupOpen.js
 * - file Desc : 도움말 > "키보드 단축키 리스트"(WMENU50_04) Popup (HTML5)
 * ----------------------------------------------------------------------
 * [컨버전 메모]
 *  원본: ws_fn_03.js oAPP.fn.fnShowKeyboardShortcuts
 *        → sap.m.Dialog(contentWidth 800px, resizable/draggable) + sap.m.Table(sticky ColumnHeaders).
 *        3열 = 단축키(272) / 설명(176) / 미리보기(230).
 *        데이터 = oAPP.common.getShortCutList(현재화면)  → 항목 { KEY, DESC, CODE, fn, VISIBLE }.
 *          · VISIBLE !== false 필터 후 KEY 오름차순 정렬(원본 Sorter path:'KEY').
 *          · 미리보기 셀 = CODE(문자열)를 eval → sap.m.Button 을 그려 "그 단축키가 누르는 버튼" 을 보여줌.
 *        타이틀 = 253(Keyboard Shortcut List), 아이콘 = keyboard.
 *
 *  HTML5: native <dialog class="u4a-dialog"> + 공통 .u4a-table  (DumpWrite/WebSecurity 인앱 다이얼로그 컨벤션).
 *        ★ 공통 파일(shell.css/u4a-ui.js/tokens.css) 미수정 — 화면 스코프(.u4aKbd*) 주입 스타일만.
 *        · 미리보기: 원본 CODE 를 "그대로" 실행하되 전역 sap 을 "생성 인자 캡처 shim" 으로 가려
 *          {icon,text,tooltip,type} 만 뽑는다(텍스트/메시지키는 원본 그대로 oAPP.common.fnGetMsgClsText 로 해석).
 *          sap-icon:// → FontAwesome 매핑은 실제 HTML5 헤더 버튼 아이콘과 동일(validate=check-double,
 *          functional-location=diagram-project, activate=wand-magic-sparkles 등) → "화면에 실제 보이는 버튼" 과 일치.
 *        · 단축키 KEY 는 "+" 로 분해해 <kbd> 키캡 칩으로 표시(키보드 단축키 리스트 가독성).
 *        · 정렬/필터/타이틀/헤더 메시지키(253/272/176/230) 원본 1:1 보존. 데이터 없음 = 946(ZMSG_WS_COMMON_001).
 *        · 드래그(전역 자동)/더블클릭 리센터/리사이즈/닫기 시 DOM 제거(전역 자동)/ESC = 공통 처리.
 *
 *  ★ 원본 fn(단축키 실제 실행 핸들러)은 이 팝업과 무관 — 팝업은 "목록 표시" 전용(원본 동일).
 *    busy Lock 은 여는 핸들러(fnHmws fnWS10/WS20WMENU50_04)가 "X" 로 걸고, 팝업이 열리면 "" 로 푼다(원본 afterOpen).
 ************************************************************************/

(function (window, $, oAPP) {
    "use strict";

    var WSUTIL = parent.WSUTIL;

    var C_DLG_ID = "u4aKbdDlg";

    // sap-icon:// 이름(접두 제거 후) → FontAwesome(fa-solid) 아이콘. 실제 HTML5 헤더 버튼 매핑과 정합.
    var KBD_ICON = {
        "header": "expand",                       // F11 Fullscreen
        "search": "magnifying-glass",             // Text Search
        "sys-find": "binoculars",                 // Find (원본 헤더 Find = binoculars)
        "document": "file",                       // App Create
        "edit": "pen",                            // App Change
        "delete": "trash",                        // App Delete
        "copy": "copy",                           // App Copy
        "display": "eye",                         // Display
        "internet-browser": "globe",              // App Execution
        "learning-assistant": "graduation-cap",   // Example Open
        "desktop-mobile": "table-cells-large",    // Multi Preview (헤더 multiPrev)
        "validate": "check-double",               // Syntax Check (헤더 syntaxCheck)
        "nav-back": "arrow-left",                 // Back
        "activate": "wand-magic-sparkles",        // Activate (헤더 activate)
        "save": "floppy-disk",                    // Save
        "picture": "image",                       // MIME
        "developer-settings": "gears",            // Controller
        "functional-location": "diagram-project", // Runtime Class Navigator (헤더 runtime)
        "touch": "hand-pointer",                  // Add Server Event
        "indent": "indent",                       // Pretty Print
        "undo": "rotate-left",                    // Undo
        "redo": "rotate-right",                   // Redo
        "u4a-fw-brands/DEV": "flask",             // U4A Developer Browser (헤더 DEV_BROWSER)
        "u4a-fw-solid/Icons": "icons",            // Icon List
        "u4a-fw-solid/Keyboard": "keyboard"
    };

    // ── 로컬 헬퍼(DumpWrite/WebSecurity 팝업과 동일 컨벤션) ──
    function _langu() {
        // 원본 fnShowKeyboardShortcuts 와 동일 언어원(globalLanguage).
        try { return parent.require(parent.PATHINFO.WSSETTINGS).globalLanguage || ""; }
        catch (e) { return ""; }
    }
    function _wsTxt(sCode, p1) {
        try { return WSUTIL.getWsMsgClsTxt(_langu(), "ZMSG_WS_COMMON_001", sCode, p1 || "") || ""; }
        catch (e) { return ""; }
    }
    function _el(sTag, sClass) {
        var o = document.createElement(sTag);
        if (sClass) { o.className = sClass; }
        return o;
    }
    function _stripIcon(s) {
        // "sap-icon://xxx" → "xxx" (커스텀 폰트 "u4a-fw-solid/Icons" 는 경로째 유지).
        return String(s || "").replace(/^sap-icon:\/\//, "");
    }
    // 일부 CODE 의 text/tooltip 은 UI5 모델 바인딩 문자열 "{/WSLANGU/<클래스>/<코드>}" (원본은 JSONModel
    //   /WSLANGU 트리로 렌더 시 해석). shim 은 이를 리터럴로 잡으므로 여기서 메시지 클래스로 직접 치환한다.
    //   (아이콘 목록 047, Undo 247, Redo 248 — 원본 getShortCutList 확인.)
    function _resolveBinding(sVal) {
        if (!sVal || String(sVal).indexOf("{/WSLANGU/") === -1) { return sVal || ""; }
        return String(sVal).replace(/\{\/WSLANGU\/([^/{}]+)\/([^/{}]+)\}/g, function (m, sCls, sCode) {
            try { return WSUTIL.getWsMsgClsTxt(_langu(), sCls, sCode) || m; }
            catch (e) { return m; }
        });
    }

    // 닫기 = close() 만(DOM 제거는 공통 u4a-ui.js _installGlobalDialogClose 가 .u4a-dialog 전역 처리).
    function lf_close() {
        try {
            var oDlg = document.getElementById(C_DLG_ID);
            if (oDlg && oDlg.open) { oDlg.close(); }
        } catch (e) { }
    }

    /************************************************************************
     * 미리보기 추출 — 원본 CODE(문자열) 를 실행하되 sap 을 "캡처 shim" 으로 가려
     *   생성 인자({icon,text,tooltip,type})만 뽑는다. 실제 sap 은 이 함수 스코프에서만 가려짐.
     *   CODE 는 항상 `new sap.m.Button({...})` 형태(원본 38건 전부) — press 핸들러는 저장만 되고 호출 안 됨.
     *   text/tooltip 에 박힌 oAPP.common.fnGetMsgClsText(...) 호출은 실제로 실행되어 현지화 텍스트로 해석된다.
     ************************************************************************/
    function lf_extractPreview(sCode) {
        if (!sCode) { return null; }
        try {
            var _cap = null;
            // eslint-disable-next-line no-unused-vars
            var sap = {
                m: {
                    Button: function (o) {
                        _cap = o || {};
                        // 일부 CODE 의 press 핸들러가 oEvent.getSource().getIcon()/setIcon() 을 참조 → 안전 스텁 반환.
                        return {
                            setIcon: function () { },
                            getIcon: function () { return (o && o.icon) || ""; },
                            getSource: function () { return this; }
                        };
                    },
                    ButtonType: {
                        Default: "Default", Accept: "Accept", Reject: "Reject", Transparent: "Transparent",
                        Emphasized: "Emphasized", Attention: "Attention", Negative: "Negative", Ghost: "Ghost",
                        Up: "Up", Back: "Back", Unstyled: "Unstyled", Critical: "Critical",
                        Success: "Success", Neutral: "Neutral", Information: "Information"
                    }
                },
                ui: { core: { Icon: function (o) { return o; } } }
            };
            // eslint-disable-next-line no-eval
            eval(sCode);
            return _cap;
        } catch (e) {
            // 미리보기 실패는 치명적이지 않음 — 해당 셀만 빈칸.
            console.error("[HTML5][KbdShortcut] 미리보기 CODE 해석 오류:", e && e.message);
            return null;
        }
    }

    // 단축키 문자열 → <kbd> 키캡 칩(예: "Ctrl+Shift+F" → [Ctrl] + [Shift] + [F]).
    function lf_buildKbd(sKey) {
        var oWrap = _el("span", "u4aKbdKeys");
        var aParts = String(sKey || "").split("+");
        aParts.forEach(function (p, idx) {
            if (idx > 0) {
                var oPlus = _el("span", "u4aKbdPlus");
                oPlus.textContent = "+";
                oWrap.appendChild(oPlus);
            }
            var oKbd = document.createElement("kbd");
            oKbd.className = "u4aKbdKey";
            oKbd.textContent = p;
            oWrap.appendChild(oKbd);
        });
        return oWrap;
    }

    // 미리보기 셀 — 원본이 그리던 버튼을 HTML5 .u4a-btn(비상호작용, 시각용)으로 재현.
    function lf_buildPreview(sCode) {
        var oCap = lf_extractPreview(sCode);
        if (!oCap) { return null; }

        var sFa = KBD_ICON[_stripIcon(oCap.icon)] || null;
        var sText = _resolveBinding(oCap.text);   // 바인딩 "{/WSLANGU/...}" → 실제 메시지
        var sTip = _resolveBinding(oCap.tooltip);

        var oBtn = _el("span", "u4a-btn u4aKbdPrevBtn");
        if (oCap.type === "Reject" || oCap.type === "Negative") {
            oBtn.className += " u4a-btn--negative";
        }
        var sHtml = "";
        if (sFa) { sHtml += '<i class="fa-solid fa-' + sFa + '"></i>'; }
        if (sText) { sHtml += '<span class="u4aKbdPrevTxt"></span>'; }
        oBtn.innerHTML = sHtml;
        if (sText) { oBtn.querySelector(".u4aKbdPrevTxt").textContent = sText; }
        if (sTip) { oBtn.title = sTip; }
        // 아이콘/텍스트 둘 다 없으면(이례) 표시할 게 없어 null.
        return (sFa || sText) ? oBtn : null;
    }

    /************************************************************************
     * 키보드 단축키 리스트 팝업 열기(공개 진입점).
     *   닫을 때 DOM 이 제거되므로 매번 새로 build(현재 화면의 최신 단축키 상태 반영).
     ************************************************************************/
    oAPP.fn.fnKeyboardShortcutPopupOpen = function () {

        lf_ensureStyle();

        // 이미 떠 있으면(중복 진입) busy 만 풀고 종료.
        var oPrev = document.getElementById(C_DLG_ID);
        if (oPrev && oPrev.open) {
            try { oAPP.common.fnSetBusyLock(""); } catch (e) { }
            return;
        }
        if (oPrev && oPrev.parentNode) { oPrev.parentNode.removeChild(oPrev); }

        // 현재 실행 중인 화면 + 그 화면의 단축키 목록(원본과 동일 소스).
        var sCurrPage = parent.getCurrPage();
        var aList = (oAPP.common.getShortCutList(sCurrPage) || []).filter(function (e) {
            return e && e.VISIBLE !== false;
        });

        // KEY 오름차순 정렬(원본 Sorter path:'KEY').
        aList.sort(function (a, b) {
            var ka = (a && a.KEY) || "", kb = (b && b.KEY) || "";
            return ka < kb ? -1 : (ka > kb ? 1 : 0);
        });

        // ── 다이얼로그 ──
        var oDlg = document.createElement("dialog");
        oDlg.id = C_DLG_ID;
        oDlg.className = "u4a-dialog u4aKbdDlg";

        // 헤더(keyboard 아이콘 + 253 + 닫기 X).
        var sTitle = _wsTxt("253");
        var oHeader = _el("div", "u4a-dialog__header");
        oHeader.innerHTML = '<i class="fa-solid fa-keyboard"></i><span></span>';
        oHeader.querySelector("span").textContent = sTitle;
        var oX = _el("button", "u4a-btn-icon");
        oX.type = "button";
        oX.innerHTML = '<i class="fa-solid fa-xmark"></i>';
        oX.title = _wsTxt("056") || _wsTxt("003");   // Close / Cancel
        oX.addEventListener("click", lf_close);
        oHeader.appendChild(oX);
        oDlg.appendChild(oHeader);

        // 본문 — 공통 .u4a-table.
        var oBody = _el("div", "u4a-dialog__body u4aKbdBody");
        var oWrap = _el("div", "u4a-table-wrap u4aKbdWrap");
        var oTbl = _el("table", "u4a-table u4aKbdTbl");
        oTbl.innerHTML =
            '<colgroup>' +
            '<col class="u4aKbdCol--key">' +
            '<col class="u4aKbdCol--desc">' +
            '<col class="u4aKbdCol--prev">' +
            '</colgroup>';

        // thead(272 단축키 / 176 설명 / 230 미리보기).
        var sColKey = _wsTxt("272"), sColDesc = _wsTxt("176"), sColPrev = _wsTxt("230");
        var oThead = document.createElement("thead");
        var oHr = document.createElement("tr");
        [sColKey, sColDesc, sColPrev].forEach(function (sTxt) {
            var th = document.createElement("th");
            th.textContent = sTxt;
            oHr.appendChild(th);
        });
        oThead.appendChild(oHr);
        oTbl.appendChild(oThead);

        // tbody.
        var oTbody = document.createElement("tbody");
        if (aList.length === 0) {
            var trE = document.createElement("tr");
            trE.className = "u4a-table__nodata";
            var tdE = document.createElement("td");
            tdE.colSpan = 3;
            tdE.textContent = _wsTxt("946");   // 데이터가 없습니다
            trE.appendChild(tdE);
            oTbody.appendChild(trE);
        } else {
            aList.forEach(function (o, i) {
                var tr = document.createElement("tr");
                if (i % 2 === 1) { tr.setAttribute("data-odd", ""); }

                // 단축키 KEY → kbd 칩.
                var tdKey = document.createElement("td");
                tdKey.setAttribute("data-label", sColKey);
                tdKey.appendChild(lf_buildKbd(o.KEY || ""));
                tr.appendChild(tdKey);

                // 설명 DESC(getShortCutList 에서 이미 현지화된 문자열).
                var tdDesc = document.createElement("td");
                tdDesc.className = "u4aKbdDescCell";
                tdDesc.setAttribute("data-label", sColDesc);
                tdDesc.textContent = o.DESC || "";
                tr.appendChild(tdDesc);

                // 미리보기 CODE → .u4a-btn.
                var tdPrev = document.createElement("td");
                tdPrev.setAttribute("data-label", sColPrev);
                var oPrevBtn = lf_buildPreview(o.CODE);
                if (oPrevBtn) { tdPrev.appendChild(oPrevBtn); }
                tr.appendChild(tdPrev);

                oTbody.appendChild(tr);
            });
        }
        oTbl.appendChild(oTbody);
        oWrap.appendChild(oTbl);
        oBody.appendChild(oWrap);
        oDlg.appendChild(oBody);

        // 푸터 — 닫기(Reject 느낌, 아이콘만 — 원본 Negative decline).
        var oFoot = _el("div", "u4a-dialog__footer u4aKbdFoot");
        var oSpacer = _el("span", "u4aKbdFootSpacer");
        oFoot.appendChild(oSpacer);
        var oCloseBtn = _el("button", "u4a-btn u4a-btn--negative u4aKbdCloseBtn");
        oCloseBtn.type = "button";
        oCloseBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
        oCloseBtn.title = _wsTxt("056") || _wsTxt("003");
        oCloseBtn.addEventListener("click", lf_close);
        oFoot.appendChild(oCloseBtn);
        oDlg.appendChild(oFoot);

        // ESC = 닫기.
        oDlg.addEventListener("cancel", function (e) { e.preventDefault(); lf_close(); });

        // 더블클릭 리센터 + 리사이즈(드래그는 전역 자동).
        if (window.U4AUI && U4AUI.makeDialogRecenter) { U4AUI.makeDialogRecenter(oDlg, oHeader); }
        if (window.U4AUI && U4AUI.makeDialogResizable) { U4AUI.makeDialogResizable(oDlg, { minW: 460, minH: 320 }); }

        document.body.appendChild(oDlg);

        try { oDlg.showModal(); } catch (e) { }

        // busy 끄고 Lock 풀기(원본 afterOpen).
        try { oAPP.common.fnSetBusyLock(""); } catch (e) { }

    }; // end of oAPP.fn.fnKeyboardShortcutPopupOpen

    /************************************************************************
     * 공통 스타일 1회 주입(테마 토큰 소비 — 공통 파일 미수정, 화면 스코프만).
     ************************************************************************/
    function lf_ensureStyle() {
        if (document.getElementById("u4aKbdStyle")) { return; }
        var oStyle = document.createElement("style");
        oStyle.id = "u4aKbdStyle";
        oStyle.textContent =
            ".u4aKbdDlg { width: min(94vw, 760px); height: min(86vh, 640px); padding: 0; display: flex; flex-direction: column; }" +
            ".u4aKbdDlg .u4a-dialog__header { cursor: move; user-select: none; }" +
            ".u4aKbdDlg .u4a-dialog__header span { flex: 1 1 auto; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }" +
            // 본문은 스크롤 안 함(패딩만) — 스크롤러는 테이블 래퍼 하나로 통일(스티키 헤더가 표 상단에 밀착).
            ".u4aKbdBody { flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; overflow: hidden; padding: 0.75rem 1rem; }" +
            ".u4aKbdWrap { flex: 1 1 auto; min-height: 0; overflow: auto; }" +
            // 컬럼 폭 — 단축키/미리보기는 내용 폭(1% + nowrap 축소 트릭), 설명이 나머지(100%)를 흡수.
            //   → 미리보기 버튼 라벨이 절대 잘리지 않음(점점점 X). 공통 .u4a-table 는 table-layout:auto.
            ".u4aKbdTbl { table-layout: auto; }" +
            ".u4aKbdCol--key { width: 1%; }" +
            ".u4aKbdCol--prev { width: 1%; }" +
            ".u4aKbdTbl tbody td, .u4aKbdTbl thead th { vertical-align: middle; white-space: nowrap; overflow: visible; text-overflow: clip; }" +
            // 설명 셀만 줄바꿈 허용(긴 설명이 미리보기/단축키 폭을 밀어내지 않게 나머지 폭 흡수).
            ".u4aKbdDescCell { white-space: normal; word-break: break-word; width: 100%; }" +
            // 단축키 kbd 키캡 칩.
            ".u4aKbdKeys { display: inline-flex; align-items: center; gap: 0.25rem; flex-wrap: wrap; }" +
            ".u4aKbdKey { display: inline-flex; align-items: center; justify-content: center; min-width: 1.5rem; height: 1.5rem; padding: 0 0.4rem; font-family: inherit; font-size: 0.75rem; font-weight: 600; line-height: 1; color: var(--text); background: var(--surface); border: 0.0625rem solid var(--divider); border-bottom-width: 0.1875rem; border-radius: 0.375rem; }" +
            ".u4aKbdPlus { color: var(--text-muted); font-size: 0.75rem; }" +
            // 미리보기 버튼 — 실제 버튼 모양(비상호작용, 시각용). 라벨 전체 표시(줄임 없음, 단일행).
            ".u4aKbdPrevBtn { pointer-events: none; cursor: default; white-space: nowrap; }" +
            ".u4aKbdPrevBtn .u4aKbdPrevTxt { white-space: nowrap; }" +
            // 푸터.
            ".u4aKbdFoot { display: flex; gap: 0.5rem; align-items: center; }" +
            ".u4aKbdFootSpacer { flex: 1 1 auto; }" +
            ".u4aKbdCloseBtn { min-width: 2.5rem; justify-content: center; }";
        document.head.appendChild(oStyle);
    }

})(window, $, oAPP);
