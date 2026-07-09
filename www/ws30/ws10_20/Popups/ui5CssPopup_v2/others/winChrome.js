/****************************************************************************
 * ui5CssPopup_v2/others/winChrome.js
 * --------------------------------------------------------------------------
 *  "다른 CSS 가이드" 새창(M1~M4/index.html) 공통 frameless 크롬(.u4a-titlebar).
 *   openNewBrowserOthers 가 titleBarStyle:hidden + closable:false + query THEME/BGCOL/TITLE 로 띄운 창에
 *   공통 헤더(로고/제목/최대화/닫기 — ★minimize 제외, 디테일 새창과 동일)를 입힌다.
 *   (browser-window-common-ux / .analy/16 §2.6 · §2.6.1)
 *
 *  · 이 스크립트는 각 M/index.html <head> 에서 로드(파서 블로킹) → boot-bg/테마 동기 적용(흰 플래시 방지)
 *    + 공통 CSS 주입. 타이틀바 삽입/배선/표시는 DOMContentLoaded 이후(본문 존재) + 공통 자산 로드 후.
 *  · M1/M2(iframe 호스트 #detail_frame)·M3/M4(정적 가이드 HTML) 공통 — 본문을 옮기지 않고
 *    타이틀바를 position:fixed 로 얹고 body padding-top(동적 실측)으로 본문을 밀어 겹침 방지.
 *  · shell.css 전역 user-select:none 이 정적 문서 텍스트 선택을 막으므로, 콘텐츠(타이틀바 제외)만 복원.
 *  · 경로는 문서(others/M{n}/index.html) 기준: theme=../../../../theme, lib=../../../../../../lib.
 ****************************************************************************/
(function () {
    try {
        var q = new URLSearchParams(location.search);
        var docEl = document.documentElement;

        // 흰 플래시 방지(첫 페인트 전 동기)
        docEl.setAttribute("data-u4a-win", "X");
        var sBg = q.get("BGCOL"); if (sBg) { docEl.style.setProperty("--boot-bg", sBg); }
        var sTitle = q.get("TITLE"); if (sTitle) { document.title = sTitle; }

        var THEME_DIR = "../../../../theme";
        var LIB = "../../../../../../lib";
        var head = document.getElementsByTagName("head")[0];

        function _css(h) { var l = document.createElement("link"); l.rel = "stylesheet"; l.href = h; head.appendChild(l); }
        _css(THEME_DIR + "/tokens.css");
        _css(THEME_DIR + "/shell.css");
        _css(THEME_DIR + "/bootstrap-skin.css");
        _css(LIB + "/fontawesome/7.2.0/css/all.min.css");

        // 레이아웃/타이틀바 CSS (본문 안 옮김: 타이틀바 fixed + body padding-top 동적).
        var st = document.createElement("style");
        st.textContent =
            'html[data-u4a-win="X"], html[data-u4a-win="X"] body{height:100%;}' +
            'html[data-u4a-win="X"] body{margin:0;box-sizing:border-box;overflow:auto;background:var(--boot-bg,var(--app-bg));}' +
            '#u4aOtherTitlebar{position:fixed;top:0;left:0;right:0;z-index:2147483000;}' +
            'html[data-u4a-win="X"] #detail_frame{position:fixed;top:var(--u4a-win-hd,48px);left:0;right:0;bottom:0;width:auto;height:auto;border:0;}' +
            // 정적 가이드 문서(M3/M4) 텍스트 선택 복원 — shell.css 전역 user-select:none 상쇄(타이틀바 제외).
            'html[data-u4a-win="X"] body > *:not(#u4aOtherTitlebar){-webkit-user-select:text;user-select:text;}';
        head.appendChild(st);

        function _js(s, cb) { var el = document.createElement("script"); el.src = s; el.onload = cb || null; head.appendChild(el); }

        // 크롬 배선(1회) — 정상경로(u4a-ui onload) / 안전망(window load) 어느 쪽이든 최초 1회만.
        window._u4aOtherInitChrome = function () {
            if (window.__u4aOtherChromeDone) { return; }
            window.__u4aOtherChromeDone = true;
            try {
                var REMOTE = require('@electron/remote');
                var CURRWIN = REMOTE.getCurrentWindow();
                var PATH = REMOTE.require('path');
                var APPPATH = REMOTE.app.getAppPath();

                try { CURRWIN.setMenu(null); } catch (e) { }
                try { if (window.U4AUI && U4AUI.initWindowFocusState) { U4AUI.initWindowFocusState(); } } catch (e) { }

                // 타이틀바 구성 — 로고 / 제목 / 최대화 / 닫기 (minimize 없음)
                var hd = document.createElement("header");
                hd.className = "u4a-titlebar";
                hd.id = "u4aOtherTitlebar";

                var logo = document.createElement("img");
                logo.className = "u4a-titlebar__logo"; logo.alt = "U4A";
                try { logo.src = encodeURI("file:///" + PATH.join(APPPATH, "img", "logo.png").replace(/\\/g, "/")); } catch (e) { }

                var tit = document.createElement("span");
                tit.className = "u4a-titlebar__title"; tit.textContent = document.title || "";

                var sp = document.createElement("div");
                sp.className = "u4a-titlebar__spacer";

                var btnMax = document.createElement("button");
                btnMax.type = "button"; btnMax.className = "u4a-winbtn"; btnMax.title = "Maximize";
                btnMax.innerHTML = '<i class="fa-solid fa-window-maximize"></i>';

                var btnClose = document.createElement("button");
                btnClose.type = "button"; btnClose.className = "u4a-winbtn u4a-winbtn--close"; btnClose.title = "Close";
                btnClose.setAttribute("data-action", "close");
                btnClose.innerHTML = '<i class="fa-solid fa-xmark"></i>';

                hd.appendChild(logo); hd.appendChild(tit); hd.appendChild(sp); hd.appendChild(btnMax); hd.appendChild(btnClose);
                document.body.insertBefore(hd, document.body.firstChild);

                // 타이틀바 높이만큼 본문 밀기(동적 실측 + 리사이즈 재적용)
                function _applyPad() {
                    var h = hd.offsetHeight || 48;
                    docEl.style.setProperty("--u4a-win-hd", h + "px");
                    document.body.style.paddingTop = h + "px";
                }
                _applyPad();
                window.addEventListener("resize", _applyPad);

                // 최대화/복원 토글 + 아이콘 스왑
                function _syncMax() {
                    var i = btnMax.querySelector("i");
                    if (!i) { return; }
                    var m = false; try { m = CURRWIN.isMaximized(); } catch (e) { }
                    i.className = m ? "fa-solid fa-window-restore" : "fa-solid fa-window-maximize";
                }
                btnMax.addEventListener("click", function () { try { CURRWIN.isMaximized() ? CURRWIN.unmaximize() : CURRWIN.maximize(); } catch (e) { } });
                try { CURRWIN.on("maximize", _syncMax); CURRWIN.on("unmaximize", _syncMax); } catch (e) { }
                _syncMax();

                // 닫기 — closable:false 라 직접 close 불가 → 공통 U4AUI.closeWindow(폴백 setClosable+close)
                btnClose.addEventListener("click", function () {
                    if (window.U4AUI && U4AUI.closeWindow) { U4AUI.closeWindow(CURRWIN); }
                    else { try { CURRWIN.setClosable(true); CURRWIN.close(); } catch (e) { } }
                });

                // 스타일/배선 끝났으니 표시(흰 플래시 없음)
                try { CURRWIN.show(); } catch (e) { }
            } catch (e) {
                console.error("[ui5CssPopup others win] 크롬 배선 오류:", e && e.message);
                try { require('@electron/remote').getCurrentWindow().show(); } catch (e2) { }
            }
        };

        function _afterAssets() {
            _js(THEME_DIR + "/theme-api.js", function () {
                try { var th = q.get("THEME"); if (th && window.U4ATheme) { U4ATheme.apply(U4ATheme.normalize ? U4ATheme.normalize(th) : th); } } catch (e) { }
                _js(THEME_DIR + "/u4a-ui.js", function () { window._u4aOtherInitChrome(); });
            });
        }

        if (document.readyState === "loading") { document.addEventListener("DOMContentLoaded", _afterAssets); }
        else { _afterAssets(); }

        // 안전망: 공통 자산 로드 실패로 정상 배선이 안 됐어도 여기서 크롬 배선 → ★닫기 반드시 보장★
        //   (closable:false 인데 배선 안 되면 영구 잠금). require(remote)만 있으면 동작, U4AUI 는 선택적.
        //   실제 load 이벤트 기반(타이머 아님). 1회 가드로 정상경로와 중복돼도 안전.
        window.addEventListener("load", function () {
            try { window._u4aOtherInitChrome(); }
            catch (e) { try { require('@electron/remote').getCurrentWindow().show(); } catch (e2) { } }
        });
    } catch (e) { }
})();
