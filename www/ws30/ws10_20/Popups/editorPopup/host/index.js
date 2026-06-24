/****************************************************************************
 * 에디터 시리즈 전용 Monaco 호스트 본체 (editorPopup/host/index.js)
 * --------------------------------------------------------------------------
 *  index.html 인라인 스크립트가 정의한 전역(oAPP / MONACO_VS_ROOT_PATH / _toParent)을 소비.
 *  USP/클라이언트 호스트와 동일 로드 시퀀스이되 이 창 전용(별도 분리).
 ****************************************************************************/

window.require.config({
    paths: {
        vs: MONACO_VS_ROOT_PATH
    }
});

window.require(["vs/editor/editor.main"], function () {

    window.editor = monaco.editor.create(document.getElementById("content"), {
        value: "",
        language: oAPP.attr.LANG,
        readOnly: oAPP.attr.READONLY,
        theme: oAPP.attr.THEME,         // 빌트인 vs / vs-dark
        automaticLayout: true,          // 창 리사이즈 자동 대응
        glyphMargin: false,
        minimap: { enabled: true },
        fontSize: 14,
        mouseWheelZoom: true,           // Ctrl(⌘)+휠 = 폰트 확대/축소
        tabCompletion: "on",
        formatOnPaste: false,
        formatOnType: false,
        wordWrap: "on",                 // 원본 ACE setUseWrapMode(true) 대응
        scrollbar: {
            verticalScrollbarSize: 7,
            horizontalScrollbarSize: 7,
            alwaysConsumeMouseWheel: false
        }
    });

    // 내용 변경 통지(외부 setValue 로 인한 변경은 제외).
    editor.onDidChangeModelContent(function () {
        if (editor._u4aExternal === true) { editor._u4aExternal = false; return; }
        _toParent({ evt: "change" });
    });

    // 폰트 줌(%) 보고 — Ctrl+휠 줌 시 fontInfo.fontSize 가 베이스(14) 대비 변한다.
    //   부모(editorFrame)가 푸터 줌 버튼에 "NNN%" 표시 + 100%면 숨김. (숫자라 i18n 키 불필요)
    var C_BASE_FONT = 14;
    function _reportZoom() {
        try {
            var fs = editor.getOption(monaco.editor.EditorOption.fontInfo).fontSize;
            _toParent({ evt: "zoom", pct: Math.round((fs / C_BASE_FONT) * 100) });
        } catch (e) { }
    }
    editor.onDidChangeConfiguration(function (e) {
        try { if (e.hasChanged(monaco.editor.EditorOption.fontInfo)) { _reportZoom(); } }
        catch (e2) { _reportZoom(); }
    });
    _reportZoom();   // 초기값 통지.

    // Shift+F1 = Pretty Print(포맷). ★에디터 한정★ — iframe 경계 안에서 처리.
    editor.addCommand(monaco.KeyMod.Shift | monaco.KeyCode.F1, function () {
        try { editor.getAction("editor.action.formatDocument").run(); } catch (e) { }
    });

    // Ctrl/⌘+S = 저장(푸터 Save 위임). ★에디터 한정★ — Monaco 가 가로채 창/브라우저로 전파 안 됨.
    var _KEY_S = (monaco.KeyCode.KeyS != null) ? monaco.KeyCode.KeyS : monaco.KeyCode.KEY_S;
    editor.addCommand(monaco.KeyMod.CtrlCmd | _KEY_S, function () {
        _toParent({ evt: "save" });
    });

    // Ctrl/⌘+0 = 폰트 줌 원복(Ctrl+휠 확대/축소 되돌리기). Monaco 내장 액션 사용.
    var _KEY_0 = (monaco.KeyCode.Digit0 != null) ? monaco.KeyCode.Digit0 : monaco.KeyCode.KEY_0;
    editor.addCommand(monaco.KeyMod.CtrlCmd | _KEY_0, function () {
        try { editor.getAction("editor.action.fontZoomReset").run(); } catch (e) { }
    });

    // 로드 완료 통지 — 부모(editorFrame)가 이 시점에 setValue / find / focus 수행.
    _toParent({ evt: "ready" });

});
