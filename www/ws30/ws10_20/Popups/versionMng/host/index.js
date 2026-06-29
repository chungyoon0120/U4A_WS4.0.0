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
    try { window.editor.getOriginalEditor().updateOptions({ readOnly: true }); } catch (e) { }
    try { window.editor.getModifiedEditor().updateOptions({ readOnly: true }); } catch (e) { }

    /***********************************************************************
     * Ctrl + 마우스휠 = 폰트 크기 확대/축소(원본 _waitForEditorDomNode 휠 핸들러 이관).
     *   두 에디터(원본/수정) DOM 에 각각 휠 리스너를 달아 동시에 폰트를 조절한다.
     ***********************************************************************/
    var MIN_FONT_SIZE = 10, MAX_FONT_SIZE = 50, iCurFont = DEFAULT_FONT_SIZE;

    function _bindWheelZoom(oEditor) {
        var oDom = oEditor.getDomNode();
        if (!oDom) { return false; }
        oDom.addEventListener("wheel", function (e) {
            if (!e.ctrlKey) { return; }
            if (e.deltaY < 0 && iCurFont < MAX_FONT_SIZE) { iCurFont++; }
            else if (e.deltaY > 0 && iCurFont > MIN_FONT_SIZE) { iCurFont--; }
            try { window.editor.getOriginalEditor().updateOptions({ fontSize: iCurFont }); } catch (e2) { }
            try { window.editor.getModifiedEditor().updateOptions({ fontSize: iCurFont }); } catch (e2) { }
        }, { passive: true });
        return true;
    }

    // DiffEditor 의 내부 에디터 DOM 은 약간 늦게 생성될 수 있어, 준비될 때까지 폴링(원본 _waitForEditorDomNode).
    (function _waitDom() {
        var iLeft = _bindWheelZoom(window.editor.getOriginalEditor());
        var iRight = _bindWheelZoom(window.editor.getModifiedEditor());
        if (iLeft && iRight) { return; }
        setTimeout(_waitDom, 50);
    })();

    // 로드 완료 통지 — 부모(versionMngFrame)가 이 시점에 setCompareData 전송.
    _toParent({ evt: "ready" });

});
