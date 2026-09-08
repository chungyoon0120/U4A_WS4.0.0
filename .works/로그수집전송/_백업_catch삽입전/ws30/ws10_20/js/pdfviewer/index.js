/****************************************************************************
 * U4A PDF 뷰어 호스트 본체 — pdf.js 코어로 모든 페이지를 캔버스에 렌더(세로 스크롤).
 *  · 부모(MIME 팝업) → postMessage({__u4apdf, hostId, cmd:"open", data:ArrayBuffer}) 로 PDF 수신.
 *  · 컨테이너 폭에 맞춰(fit-width) 렌더, 리사이즈 시 디바운스 재렌더(선명도 유지).
 *  · 통신: 호스트→부모 {evt:"ready"|"rendered"|"error"}.  (monaco 호스트와 동일 통신 컨셉)
 ****************************************************************************/
(function () {
    "use strict";

    var pdfjsLib = window.pdfjsLib || window["pdfjs-dist/build/pdf"];
    var HOSTID = window.__HOSTID || "U4APDF";
    var oWrap = document.getElementById("wrap");
    var oPages = document.getElementById("pages");
    var oMsg = document.getElementById("msg");

    function _toParent(o) {
        try { o = o || {}; o.__u4apdf = true; o.hostId = HOSTID; window.parent.postMessage(o, "*"); } catch (e) { }
    }
    function _showMsg(s) { if (oMsg) { oMsg.textContent = s || ""; oMsg.hidden = !s; } }

    if (!pdfjsLib) { _showMsg("PDF library not available"); _toParent({ evt: "error" }); return; }

    // 워커 경로 지정(코어와 같은 lib). 워커 실패 시 pdf.js 가 메인스레드 폴백(느려도 렌더됨).
    try { pdfjsLib.GlobalWorkerOptions.workerSrc = window.__PDF_WORKER; } catch (e) { }

    var _doc = null;          // 현재 PDFDocumentProxy
    var _token = 0;           // 렌더 취소 토큰(새 문서/리사이즈 시 이전 렌더 무효화)
    var _resizeTimer = null;

    // 현재 문서의 모든 페이지를 컨테이너 폭에 맞춰 캔버스로 렌더.
    function _render() {
        if (!_doc) { return; }
        var token = ++_token;
        oPages.textContent = "";
        _showMsg("");

        var cw = (oWrap.clientWidth || 600) - 20;   // 좌우 패딩 감안
        if (cw < 80) { cw = 80; }
        var dpr = window.devicePixelRatio || 1;
        var n = _doc.numPages;

        (function page(i) {
            if (i > n || token !== _token) { return; }
            _doc.getPage(i).then(function (pg) {
                if (token !== _token) { return; }
                var vp1 = pg.getViewport({ scale: 1 });
                var scale = cw / vp1.width;
                var vp = pg.getViewport({ scale: scale });

                var c = document.createElement("canvas");
                c.width = Math.floor(vp.width * dpr);
                c.height = Math.floor(vp.height * dpr);
                c.style.width = Math.floor(vp.width) + "px";
                c.style.height = Math.floor(vp.height) + "px";
                oPages.appendChild(c);

                var ctx = c.getContext("2d");
                var renderCtx = { canvasContext: ctx, viewport: vp };
                if (dpr !== 1) { renderCtx.transform = [dpr, 0, 0, dpr, 0, 0]; }
                pg.render(renderCtx).promise.then(function () {
                    if (token === _token) { page(i + 1); }
                }).catch(function () { _showMsg("PDF render error"); });
            }).catch(function () { _showMsg("PDF render error"); });
        })(1);
    }

    // ArrayBuffer → 문서 로드 → 렌더.
    function _open(ab) {
        _showMsg("Loading…");
        var oTask;
        try { oTask = pdfjsLib.getDocument({ data: new Uint8Array(ab) }); }
        catch (e) { _showMsg("Cannot open PDF"); _toParent({ evt: "error" }); return; }
        oTask.promise.then(function (doc) {
            _doc = doc;
            try { oWrap.scrollTop = 0; } catch (e) { }
            _render();
            _toParent({ evt: "rendered", pages: doc.numPages });
        }).catch(function () {
            _doc = null; oPages.textContent = ""; _showMsg("Cannot open PDF"); _toParent({ evt: "error" });
        });
    }

    // 부모 → 호스트 명령.
    window.addEventListener("message", function (ev) {
        var d = ev && ev.data;
        if (!d || d.__u4apdf !== true) { return; }
        if (d.hostId && d.hostId !== HOSTID) { return; }
        if (d.cmd === "open") { _open(d.data); }
        else if (d.cmd === "clear") { _doc = null; oPages.textContent = ""; _showMsg(""); }
    });

    // 컨테이너 리사이즈 → 디바운스 재렌더(폭 맞춤 선명도 유지).
    window.addEventListener("resize", function () {
        clearTimeout(_resizeTimer);
        _resizeTimer = setTimeout(_render, 150);
    });

    _toParent({ evt: "ready" });
})();
