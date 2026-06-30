/****************************************************************************
 * 버전 관리 전용 Monaco "diff" 호스트 본체 (versionMng/host/index.js)
 * --------------------------------------------------------------------------
 *  index.html 인라인 스크립트가 정의한 전역(oAPP / MONACO_VS_ROOT_PATH / _toParent)을 소비.
 *  원본 Popup/monaco/index.js 의 핵심(createDiffEditor + createDiffNavigator + 읽기전용 +
 *  Ctrl+휠 폰트 줌)만 1:1 이관하고, 원본의 대량 주석 실험코드(return 뒤 미실행부)는 제거한다.
 ****************************************************************************/

window.require.config({
    paths: {
        vs: MONACO_VS_ROOT_PATH
    }
});

window.require(["vs/editor/editor.main"], function () {

    var DEFAULT_FONT_SIZE = 16;

    // 좌우 분할 비교 에디터(원본 createDiffEditor 옵션 1:1).
    window.editor = monaco.editor.createDiffEditor(document.getElementById("content"), {
        theme: oAPP.attr.THEME,           // 빌트인 vs / vs-dark (BGCOL 휘도로 부모가 결정해 전달)
        fontSize: DEFAULT_FONT_SIZE,
        enableSplitViewResizing: true,
        renderSideBySide: true,
        automaticLayout: true,            // 창/스플리터 리사이즈 자동 대응
        readOnly: true,
        mouseWheelZoom: true,             // Ctrl(⌘)+휠 = 폰트 확대/축소 (Monaco 내장, editorPopup 공통 패턴)
        scrollbar: {
            verticalScrollbarSize: 7,
            horizontalScrollbarSize: 7,
            alwaysConsumeMouseWheel: false
        }
    });

    // 변경 위치 네비게이터(원본 createDiffNavigator) — 부모의 ▲/▼ 버튼이 next/previous 호출.
    window.diffNavigator = monaco.editor.createDiffNavigator(window.editor, {
        followsCaret: true,
        ignoreCharChanges: false,
        alwaysRevealFirst: true
    });

    // 좌/우 모두 입력 막기(원본 동일 — 버전 비교는 읽기 전용).
    var oOrig = window.editor.getOriginalEditor();
    var oModf = window.editor.getModifiedEditor();
    try { oOrig.updateOptions({ readOnly: true }); } catch (e) { }
    try { oModf.updateOptions({ readOnly: true }); } catch (e) { }

    /***********************************************************************
     * 폰트 확대/축소 — ★Monaco 내장(EditorZoom) 사용 (editorPopup 호스트와 동일한 공통 패턴/국룰).
     *   - Ctrl(⌘)+휠 : 생성옵션 mouseWheelZoom:true 가 처리(자체 wheel 핸들러 불필요).
     *   - Ctrl+'='/'-' : 내장 fontZoomIn/Out 액션의 기본 키바인딩.
     *   - Ctrl+0 : 내장 reset 키바인딩은 Numpad0 뿐이라 Digit0 를 양 에디터에 추가.
     *   - 툴바 줌 버튼(부모 cmd) : 동일한 내장 액션을 호출.
     *   EditorZoom 은 전역이라 한쪽 에디터에서 실행해도 양쪽 폰트가 같이 바뀐다.
     *   현재 배율(%)은 fontInfo.fontSize/베이스로 계산해 부모에 통지(툴바 표시용).
     ***********************************************************************/
    var C_BASE_FONT = DEFAULT_FONT_SIZE;
    function _runZoom(sAct) {
        try { var a = oModf.getAction(sAct) || oOrig.getAction(sAct); if (a) { a.run(); } } catch (e) { }
    }
    // 부모(versionMngFrame)의 줌 버튼이 호출(index.html cmd 핸들러 → 이 전역) — 내장 액션 위임.
    window._vmFont = {
        zoomIn: function () { _runZoom("editor.action.fontZoomIn"); },
        zoomOut: function () { _runZoom("editor.action.fontZoomOut"); },
        zoomReset: function () { _runZoom("editor.action.fontZoomReset"); }
    };

    function _reportZoom() {
        try {
            var fs = oModf.getOption(monaco.editor.EditorOption.fontInfo).fontSize;
            _toParent({ evt: "zoom", pct: Math.round((fs / C_BASE_FONT) * 100) });
        } catch (e) { }
    }
    // 폰트(줌) 변경 시마다 % 재통지 — Ctrl+휠/키/버튼 모두 fontInfo 변경을 거친다.
    function _watchFont(oEd) {
        try {
            oEd.onDidChangeConfiguration(function (e) {
                try { if (e.hasChanged(monaco.editor.EditorOption.fontInfo)) { _reportZoom(); } }
                catch (e2) { _reportZoom(); }
            });
        } catch (e) { }
    }
    _watchFont(oOrig); _watchFont(oModf);

    // Ctrl/⌘+0 = 폰트 줌 원복(내장 reset 은 Numpad0 만 바인딩 → Digit0 보강). 양 에디터에 등록.
    var _KEY_0 = (monaco.KeyCode.Digit0 != null) ? monaco.KeyCode.Digit0 : monaco.KeyCode.KEY_0;
    function _bindReset(oEd) {
        try { oEd.addCommand(monaco.KeyMod.CtrlCmd | _KEY_0, function () { _runZoom("editor.action.fontZoomReset"); }); } catch (e) { }
    }
    _bindReset(oOrig); _bindReset(oModf);

    // 로드 완료 통지 + 초기 배율(100%) 통지 — 부모가 이 시점에 setCompareData 전송 / 툴바 % 표시.
    _toParent({ evt: "ready" });
    _reportZoom();

});
