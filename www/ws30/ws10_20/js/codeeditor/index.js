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

    // 로드 완료 통지 — 부모는 이 시점에 setValue / focus 수행.
    _toParent({ evt: "ready" });

});
