/****************************************************************************
 * 범용 Monaco 코드 에디터 호스트 본체 (index.js)
 * --------------------------------------------------------------------------
 * USP 호스트(js/usp/monaco/index.js)와 동일한 로드 시퀀스:
 *   require.config({paths:{vs}}) → require(['vs/editor/editor.main']) →
 *   monaco.editor.create(#content) → 부모에 ready 통지.
 * 단, USP 전용 상태/스니펫/테마콤보/parent.sap 의존은 모두 제거(독립 모듈).
 * (전역 oAPP / MONACO_VS_ROOT_PATH / _toParent 는 index.html 인라인 스크립트가 정의)
 ****************************************************************************/

// vs 모듈 경로(절대) 설정 — USP 호스트와 동일.
window.require.config({
    paths: {
        vs: MONACO_VS_ROOT_PATH
    }
});

window.require(["vs/editor/editor.main"], function () {

    // 단일 에디터 인스턴스 생성(#content). 분할/스니펫/테마콤보 없음 — 인앱 팝업용 경량.
    window.editor = monaco.editor.create(document.getElementById("content"), {
        value: "",
        language: oAPP.attr.LANG,
        readOnly: oAPP.attr.READONLY,
        theme: oAPP.attr.THEME,         // 빌트인 테마(vs / vs-dark)만 사용 → defineTheme 불필요
        automaticLayout: true,          // 컨테이너(다이얼로그) 리사이즈 자동 대응
        glyphMargin: false,
        minimap: { enabled: true },     // 우측 코드 미니맵(소스 맵) 표시
        fontSize: 14,
        mouseWheelZoom: true,           // Ctrl(⌘)+마우스휠 = 폰트 크기 확대/축소(빌트인)
        tabCompletion: "on",
        formatOnPaste: false,
        formatOnType: false,
        wordWrap: "off",                // 가로 스크롤 유지
        scrollbar: {
            verticalScrollbarSize: 7,
            horizontalScrollbarSize: 7,
            alwaysConsumeMouseWheel: false
        }
    });

    // 내용 변경 통지(외부 setValue 로 인한 변경은 제외) — 부모가 미저장 표시 등에 사용 가능.
    editor.onDidChangeModelContent(function () {
        if (editor._u4aExternal === true) { editor._u4aExternal = false; return; }
        _toParent({ evt: "change" });
    });

    // 폰트 줌(%) 보고 — Ctrl+휠 줌 시 fontInfo.fontSize 가 베이스(14) 대비 변한다.
    //   부모(팝업)가 푸터 줌 버튼에 "NNN%" 상시 표시. (숫자라 i18n 키 불필요)
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
    _reportZoom();

    // Shift+F1 = Pretty Print(포맷). ★에디터 한정★ — Monaco 키바인딩이라 에디터에 포커스가
    //   있을 때만 발화하고 iframe 경계 안에서 처리되어 부모(워크스페이스 단축키)로 새지 않는다.
    editor.addCommand(monaco.KeyMod.Shift | monaco.KeyCode.F1, function () {
        try { editor.getAction("editor.action.formatDocument").run(); } catch (e) { }
    });

    // Ctrl/⌘+S = 저장(팝업 하단 ✓ 기능). ★에디터 한정★ — Monaco 가 Ctrl+S 를 가로채
    //   브라우저 기본동작/전파를 막으므로, iframe 밖(WS20 화면)의 Ctrl+S 단축키와 충돌하지 않는다.
    //   실제 저장 로직(T_CEVT/setAppChange/콜백)은 부모에 있으므로 postMessage 로 위임한다.
    var _KEY_S = (monaco.KeyCode.KeyS != null) ? monaco.KeyCode.KeyS : monaco.KeyCode.KEY_S;
    editor.addCommand(monaco.KeyMod.CtrlCmd | _KEY_S, function () {
        _toParent({ evt: "save" });
    });

    // Ctrl/⌘+0 = 폰트 줌 원복(Ctrl+휠 확대/축소 되돌리기). Monaco 내장 액션 사용.
    var _KEY_0 = (monaco.KeyCode.Digit0 != null) ? monaco.KeyCode.Digit0 : monaco.KeyCode.KEY_0;
    editor.addCommand(monaco.KeyMod.CtrlCmd | _KEY_0, function () {
        try { editor.getAction("editor.action.fontZoomReset").run(); } catch (e) { }
    });

    // ESC = 부모에 "닫기 요청" 위임(인앱 에디터 팝업 편의 — 부모가 변경분 확인 후 닫는다).
    //   ★ Monaco 자체 이벤트 editor.onKeyDown 사용 — iframe DOM 이벤트 전파/포커스 변수에 의존하지
    //     않고 에디터 포커스 시 키를 확실히 잡는다(raw window keydown 은 Monaco 가 가로채 안 잡혔음).
    //   ★ 위젯(자동완성/찾기/파라미터힌트/컨텍스트메뉴/이름변경)이 열려 있으면 ESC 는 그 위젯을 닫는
    //     데 써야 하므로 esc 를 보내지 않고 양보(Monaco 가 위젯을 닫음). 위젯이 없을 때만 닫기 요청.
    //   호스트는 generic 이라 'esc' 를 안 쓰는 소비처는 무시.
    function _overlayOpen() {
        try {
            // ★ 단순 존재(querySelector)로 판단하면 안 된다 — Monaco 는 rename-box 등 일부 위젯을
            //   DOM 에 미리 만들어 두고 display:none 으로 숨긴다(항상 매치→esc 가 영영 안 나감 버그).
            //   실제로 '보이는'(display≠none && visibility≠hidden) 위젯이 있을 때만 열린 것으로 본다.
            var els = document.querySelectorAll(
                ".monaco-editor .suggest-widget.visible," +
                ".monaco-editor .find-widget.visible," +
                ".monaco-editor .parameter-hints-widget.visible," +
                ".monaco-editor .rename-box," +
                ".context-view .monaco-menu"
            );
            for (var i = 0; i < els.length; i++) {
                var cs = getComputedStyle(els[i]);
                if (cs.display !== "none" && cs.visibility !== "hidden") { return true; }
            }
            return false;
        } catch (e) { return false; }
    }
    editor.onKeyDown(function (e) {
        if (e.keyCode !== monaco.KeyCode.Escape) { return; }
        if (_overlayOpen()) { return; }   // 위젯 닫기 우선 — esc 전송 보류(Monaco 가 처리).
        _toParent({ evt: "esc" });
    });

    // 로드 완료 통지 — 부모는 이 시점에 setValue / focus 수행.
    _toParent({ evt: "ready" });

});
