// 오류코드 접두: UBSY / 다음 번호: 004
/************************************************************************
 * U4A Workspace — 공통 busy (window.U4ABusy)  · 짝 = u4a-busy.css
 * ----------------------------------------------------------------------
 * [2026-09-15, 장군님 지시] busy 도 하나의 UI — 공통 화면 리소스(theme/) 전용 파일로 옮기고,
 *   화면 시작 때 가장 먼저 로드한다(ws10_20/index.html <head> 맨 앞, jQuery 보다 앞).
 *   옮겨온 곳 = resources/index.js 의 setDomBusy 본체 + ws10_20/index.html 의 <dialog>.
 *
 *   · U4ABusy.show() / U4ABusy.hide()
 *   · busy 화면(<dialog>)은 처음 show() 때 스스로 만들어 <body> 끝에 붙인다.
 *     로드되자마자 만들지 않는 이유: <head> 에서 로드되는 순간엔 <body> 가 아직 없다.
 *     busy 를 켜는 호출은 전부 <body> 가 생긴 뒤에 온다.
 *   · id·class 는 옛 이름 그대로(u4aWsBusyIndicator · u4aWsBusyTitle · u4aWsBusyText) —
 *     카드 제목·문구 넣는 곳(ws_html5_shell.js), 로그인 남은 초 표시(Login.js),
 *     로그의 busy 상태 확인(ws_html5_logger.js)이 이 id 로 찾는다.
 *   · 켜고 끄는 동작은 옛 setDomBusy 그대로(showModal · ESC 막기 · showModal 실패 시 display flex).
 *   · 기존 호출 이름 setDomBusy(resources/index.js)는 그대로 두고 여기로 넘긴다.
 *   · U4AUI 아래에 두지 않는다 — u4a-ui.js 가 global.U4AUI 를 새 객체로 통째로 대입해 지워진다.
 ************************************************************************/
(function (global) {
    "use strict";

    var BUSY_ID = "u4aWsBusyIndicator";

    // 오류 흔적 — 로그 함수(U4ALOG)는 이 파일보다 늦게 로드되므로 부르는 시점에 있으면 쓰고, 없으면 console.
    function _caught(sCode, sWhere, e) {
        if (typeof global.U4ALOG !== "undefined" && global.U4ALOG && global.U4ALOG.caught) {
            global.U4ALOG.caught(e);
            return;
        }
        console.error("[" + sCode + "] " + sWhere + " -", e && e.message);
    }

    // busy <dialog> 를 만들어 <body> 에 붙인다(구 ws10_20/index.html 마크업과 같은 구조).
    function _create() {

        var oBody = document.body;
        if (!oBody) {
            console.error("[UBSY-001] U4ABusy.show: document.body not ready - busy dialog not created, busy not shown");
            return null;
        }

        var oDlg = document.createElement("dialog");
        oDlg.id = BUSY_ID;
        oDlg.className = "u4aWsBusyIndicator";
        oDlg.innerHTML =
            '<div class="u4aWsBusyCard">' +
                '<div class="u4aWsSpinner"></div>' +
                '<div class="u4aWsBusyTitle" id="u4aWsBusyTitle"></div>' +
                '<div class="u4aWsBusyText" id="u4aWsBusyText"></div>' +
            '</div>';

        oBody.appendChild(oDlg);

        return oDlg;
    }

    function show() {

        var oBusyDom = document.getElementById(BUSY_ID) || _create();
        if (!oBusyDom) {
            return;
        }

        // busy 요소가 <dialog> 면 showModal() 로 띄운다 — 모달 팝업(showModal)도 top-layer 라
        //   일반 <div>(z-index 무한대라도) busy 는 그 뒤로 가려 안 보인다. busy 도 모달이어야
        //   어떤 모달 팝업 위에도 보인다. <dialog> 가 아니면(다른 창) display 토글.
        var bIsDialog = (typeof oBusyDom.showModal === "function");

        if (bIsDialog) {
            if (!oBusyDom.__escGuard) {
                oBusyDom.__escGuard = true;
                // busy 중 ESC 로 닫히지 않게(닫혀도 작업은 계속되지만 시각 잠금 유지).
                oBusyDom.addEventListener("cancel", function (e) { e.preventDefault(); });
            }
            if (!oBusyDom.open) {
                try { oBusyDom.showModal(); } catch (e) { _caught("UBSY-002", "U4ABusy.show: showModal failed", e); oBusyDom.style.display = "flex"; }
            }
        } else {
            oBusyDom.style.display = "flex"; // 카드 중앙정렬 (스크림 flex center)
        }

    }

    function hide() {

        // 한 번도 안 켰으면 요소가 없다 — 끌 것이 없는 정상 상태라 로그를 남기지 않는다.
        var oBusyDom = document.getElementById(BUSY_ID);
        if (!oBusyDom) {
            return;
        }

        if (typeof oBusyDom.showModal === "function") {
            if (oBusyDom.open) { try { oBusyDom.close(); } catch (e) { _caught("UBSY-003", "U4ABusy.hide: close failed", e); } }
        } else {
            oBusyDom.style.display = "none";
        }

    }

    global.U4ABusy = { show: show, hide: hide };

})(window);
