/************************************************************************
 * fnTextSearchShortcut.js  (UI5 → HTML5 변환)
 * ----------------------------------------------------------------------
 * Window Text Search 단축키 배선 — Ctrl+Shift+F → 별도 창 찾기 팝업.
 *   원본 getShortCutList(ws_common.js)의 "Ctrl+Shift+F" KEY fn 은
 *     sap.ui.getCore().isLocked() + oAPP.fn.fnTextSearchPopupOpener() (UI5) → HTML5 에선 sap 부적합.
 *   WS20 F3 / USP 키와 동일 패턴([[html5-shortcut-override-getshortcutlist]])으로 이 KEY 의 fn 만
 *   교체: 동일 opener(fnTextSearchPopupOpener)를 직접 호출(별도 창 = 같은 프레임 간섭 회피, 원본 의도).
 *   WS10/WS20/WS30 세 리스트 모두 같은 KEY 라 sPgNo 무관 적용. 헤더 돋보기 버튼은 ws10_html.js 가 같은 opener 호출.
 *   원본 가드 보존: event.repeat(꾹 누름 중복 방지) + 중앙 네비 가드 fnShortCutExeAvaliableCheck.
 ************************************************************************/
(function (window, $, oAPP) {
    "use strict";

    function _openTextSearch() {
        try { oAPP.fn.fnTextSearchPopupOpener(); }
        catch (e) { console.error("[HTML5] text search open", e); }
    }

    if (typeof oAPP.common.getShortCutList === "function") {
        var _superScList = oAPP.common.getShortCutList;
        oAPP.common.getShortCutList = function (sPgNo) {
            var aList = (typeof _superScList === "function") ? _superScList(sPgNo) : [];
            if (!Array.isArray(aList)) { return aList; }
            aList.forEach(function (o) {
                if (o && o.KEY === "Ctrl+Shift+F") {
                    o.fn = function (e) {
                        try { e.stopImmediatePropagation(); } catch (_e) { }
                        if (e && e.repeat === true) { return; }                     // [[shortcut-key-repeat-guard]]
                        var r = ""; try { r = oAPP.common.fnShortCutExeAvaliableCheck(); } catch (_e) { }
                        if (r === "X") { return; }                                  // [[nav-inflight-lock-fnNaviLock]]
                        _openTextSearch();
                    };
                }
            });
            return aList;
        };
    }

})(window, $, oAPP);
