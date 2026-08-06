/****************************************************************************
 * Binding Popup(대형 별창) 동일속성 바인딩 화면 — HTML5 (SPEC §5, 원본 uiModule/synchronizionBind.js)
 * --------------------------------------------------------------------------
 *  원본은 oDesign.ui.ROOT(NavContainer) 안에서 트리 페이지 ↔ 동일속성 Page 를 to()/moveDesignPage 로
 *  스왑한다. HTML5 는 NavContainer 가 없어, 가운데 디자인트리 영역(#bwpDesignArea)을
 *  designSwapToPage/moveDesignPage(designArea.js) 로 슬라이드 스왑(.analy 16 §9.2)한다.
 *
 *  ★ S1b 범위 = 화면 껍데기(툴바 3버튼) + 진입/뒤로 슬라이드 + 진입/복귀 부수효과 배선.
 *    - 상단 패널(선택 속성 4줄 + MPROP) = S2 / 하단 후보 테이블 = S3 / 일괄적용 = S4 / 비모달 = S5.
 *    - 140 "동일속성 적용 팝업 호출" 버튼은 S5 까지 비활성(자리만).
 *  ★ CJS(module.exports) 아님 — 별창 require 미지원이라 oAPP.fn 전역 노출로 이식.
 ****************************************************************************/
(function () {
    "use strict";

    var oAPP = window.oAPP;
    if (!oAPP || !oAPP.fn) { return; }

    var H = oAPP.H;   // 공유 UI 헬퍼(bindShared.js) — el/fa/iconBtn/z.

    // 동일속성 화면 상태(원본 oContr 대응) — S2/S3/S4 가 소비.
    var oSync = { page: null, body: null, S_ATTR: null, aList: null };
    oAPP.attr.oSync = oSync;

    // 텍스트+아이콘 툴바 버튼(공통 .u4a-btn) — 원본 sap.m.Button.
    function _btn(sFa, sText, sTip, sVariant, fn) {
        var b = H.el("button", "u4a-btn" + (sVariant ? " " + sVariant : ""));
        b.type = "button";
        if (sFa) { b.innerHTML = H.fa(sFa); }
        if (sText) { b.appendChild(document.createTextNode(sText)); }
        if (sTip) { b.title = sTip; b.setAttribute("aria-label", sTip); }
        if (typeof fn === "function") { b.addEventListener("click", fn); }
        return b;
    }

    /************************************************************************
     * [S1b §5.2] 동일속성 화면 진입 — 원본 start(4)+designView 툴바부(892) + onSynchronizionBind 부수효과.
     *   sTree = 선택한 바인딩 속성행(원본 is_attr = S_ATTR), aList = 동일속성 후보(getSameAttrList).
     ************************************************************************/
    oAPP.fn.openSyncBindScreen = function (sTree, aList) {
        oSync.S_ATTR = sTree;
        oSync.aList = aList;

        // ── 페이지 골격 ──
        var page = H.el("div", "u4aBwpSyncRoot");

        // 상단 툴바: [뒤로 189] · [동일속성 적용 팝업 호출 140 — S5까지 비활성] · Spacer · [도움말 198].
        var tool = H.el("div", "u4aBwpTool u4aBwpSyncTool");
        tool.appendChild(_btn("arrow-left", H.z("189"), H.z("189"), "u4a-btn--emphasized", function () {   // 189 Back
            oAPP.fn.onSyncMoveDesignPage();
        }));
        var oPopBtn = _btn("up-right-from-square", H.z("140"), H.z("140"), "u4a-btn--emphasized", null);    // 140 팝업 호출
        oPopBtn.disabled = true;   // S5 까지 비활성(원본 onCallSyncBindPopup 자리).
        oPopBtn.setAttribute("data-bwp-sync-popup", "1");
        tool.appendChild(oPopBtn);
        tool.appendChild(H.el("span", "u4aBwpToolSpacer"));
        tool.appendChild(H.iconBtn("circle-question", H.z("198"), function () {   // 198 Help
            // [B4] 동일속성 화면 도움말 문서 "000277"(원본 synchronizionBind.js:796). 영역별 라우팅.
            if (typeof oAPP.fn.onHelp === "function") { try { oAPP.fn.onHelp("000277"); } catch (e) { console.error("[HTML5][bindWindow] onHelp:", e && e.message); } }
        }));
        page.appendChild(tool);

        // 본문(상단 패널 = S2 / 하단 후보 테이블 = S3 이 이 컨테이너에 렌더).
        var body = H.el("div", "u4aBwpSyncBody");
        oSync.body = body;
        page.appendChild(body);

        oSync.page = page;

        // ── 가운데 영역 슬라이드 진입(forward) ──
        oAPP.fn.designSwapToPage(page, false);

        // ── 진입 부수효과(원본 designTree.js onSynchronizionBind:2656~2670 순서) ──
        oAPP.fn.setAdditBindButtonEnable(false);       // 2656 우측 바인딩 버튼 비활성.
        oAPP.fn.setLayoutCustomizingEditable(false);   // 2657 우측 기어 비활성.
        oAPP.attr.bSyncEqualityScreenActive = true;    // 2658 화면 활성 플래그.
        if (typeof oAPP.fn.clearSelectAdditBind === "function") { oAPP.fn.clearSelectAdditBind(); }   // 2662 추가속성 선택 초기화.
        if (typeof oAPP.fn.setAdditLayout === "function") { oAPP.fn.setAdditLayout(""); }             // 2666 중앙하단 addit 패널 비움.
        oAPP.fn.setViewEditable(false);                // 2670 메인(중앙하단 적용/좌측 갱신/좌측 기어) 비활성.

        // ── 진입 busy off(원본 onViewReady:430) — 렌더/슬라이드 안정 후(rAF 2틱, busy 페이드 조기해제 방지) ──
        requestAnimationFrame(function () {
            requestAnimationFrame(function () {
                oAPP.fn.setBusyWS20Interaction(false);
            });
        });
    };

    /************************************************************************
     * [S1b] 뒤로 — 원본 onMoveDesignPage(synchronizionBind.js:623).
     *   busy 채널 비대칭 그대로: ON = setBusy(true)(627) / OFF = setBusyWS20Interaction(false,{})(651).
     ************************************************************************/
    oAPP.fn.onSyncMoveDesignPage = async function () {
        if (typeof oAPP.fn.closeMessagePopover === "function") { oAPP.fn.closeMessagePopover(); }
        oAPP.fn.setBusy(true);
        if (document.activeElement && document.activeElement.blur) { document.activeElement.blur(); }

        // 디자인 트리로 슬라이드 복귀(원본 moveDesignPage) — teardown 포함.
        await oAPP.fn.moveDesignPage();

        // 복원 4종(§5.6 — 진입의 정확한 역).
        oAPP.fn.setAdditBindButtonEnable(true);
        oAPP.fn.setLayoutCustomizingEditable(true);
        oAPP.attr.bSyncEqualityScreenActive = false;
        oAPP.fn.setViewEditable(true);

        // busy off(원본 651 — WS20 채널).
        oAPP.fn.setBusyWS20Interaction(false, {});
    };

})();
