/************************************************************************
 * ws_html5_usp_ctxmenu.js  (HTML5)  — WS30 USP 소스 트리 우클릭 컨텍스트 메뉴
 * ----------------------------------------------------------------------
 * 구 sap.m.Menu(usptree.setContextMenu) → 공통 .u4a-menu 스킨(shell.css) 소비.
 *  ★ 메뉴 정의/순서/구분선(ISSTART)/표시(VISIBLE)/활성(ENABLED)을 원본 1:1 이식.
 *    - 정의/순서/아이콘/메시지키 : 구 fnGetUspTreeDefCtxMenuList (ws_usp.js)
 *    - 활성/표시 규칙(모드×루트/폴더/파일) : 구 ev_beforeOpenContextMenu
 *        + _ev_beforeOpenContextMenuDisplay / _ev_beforeOpenContextMenuChange
 *    - K11(New Window)/K12(Upload) 은 원본에서 VISIBLE:false → 항상 숨김(동작 그대로).
 *  - 트리거 : #uspTreeBody 의 .u4aWs30TreeRow 우클릭(contextmenu) → 커서 좌표에 오픈.
 *  - 닫기   : 바깥 mousedown / ESC / 스크롤 / 리사이즈(공통 outside-close 패턴).
 *  - 핸들러 : K1/K2 = 서브트리 펼침/접힘(완전 동작, 트리 모듈).
 *             K3~K10 = 작업단위별 단계 구현 → oAPP.usphtml.uspCtxAction[KEY] 에 등록.
 *             미등록(미구현) 키는 console.warn (임의 UI 문구/토스트 금지 — 메시지 키 정책).
 ************************************************************************/

(function (window, $, oAPP) {
    "use strict";

    var APPCOMMON = oAPP.common;
    oAPP.fn = oAPP.fn || {};
    oAPP.usp = oAPP.usp || {};
    oAPP.usphtml = oAPP.usphtml || {};
    oAPP.usphtml.uspCtxAction = oAPP.usphtml.uspCtxAction || {};   // 단계 구현 핸들러 등록처

    // 라벨 — 서버 메시지 클래스 단일 출처(/U4A/CL_WS_COMMON). 영문 사전/폴백 금지(미조회 시 코드 반환).
    function _msg(sNum) {
        try {
            var s = APPCOMMON.fnGetMsgClsText("/U4A/CL_WS_COMMON", sNum);
            if (s != null && s !== "" && s.indexOf("|") === -1) { return s; }
        } catch (e) { }
        return sNum;
    }
    function _fa(sName) { return '<i class="fa-solid fa-' + sName + '"></i>'; }
    function _isEdit() {
        var o = {};
        try { o = APPCOMMON.fnGetModelProperty("/WS30/APP") || {}; } catch (e) { }
        return o.IS_EDIT === "X";
    }

    /************************************************************************
     * 메뉴 정의 (구 fnGetUspTreeDefCtxMenuList — 순서/키/메시지/아이콘/구분선/표시 1:1)
     *   K1 Expand Subtree(C27) · K2 Collapse Subtree(C28) · K6 Test Service(D43) ·
     *   K11 New Window(A09,숨김) · K3 Create(A01) · K4 Delete(A03) · K7 Rename(D44) ·
     *   K8 Up(A55) · K9 Down(A56) · K10 Move Position(A57) · K12 Upload(D88,숨김) · K5 Download(B78)
     ************************************************************************/
    function _defMenu() {
        return [
            { KEY: "K1",  TXT: _msg("C27"), FA: "angles-down",        ISSTART: false, VISIBLE: true },
            { KEY: "K2",  TXT: _msg("C28"), FA: "angles-up",          ISSTART: false, VISIBLE: true },
            { KEY: "K6",  TXT: _msg("D43"), FA: "globe",              ISSTART: false, VISIBLE: true },
            { KEY: "K11", TXT: _msg("A09"), FA: "window-restore",     ISSTART: false, VISIBLE: false },
            { KEY: "K3",  TXT: _msg("A01"), FA: "plus",               ISSTART: true,  VISIBLE: true },
            { KEY: "K4",  TXT: _msg("A03"), FA: "trash",              ISSTART: false, VISIBLE: true },
            { KEY: "K7",  TXT: _msg("D44"), FA: "pen",                ISSTART: false, VISIBLE: true },
            { KEY: "K8",  TXT: _msg("A55"), FA: "chevron-up",         ISSTART: true,  VISIBLE: true },
            { KEY: "K9",  TXT: _msg("A56"), FA: "chevron-down",       ISSTART: false, VISIBLE: true },
            { KEY: "K10", TXT: _msg("A57"), FA: "up-down-left-right", ISSTART: false, VISIBLE: true },
            { KEY: "K12", TXT: _msg("D88"), FA: "upload",             ISSTART: true,  VISIBLE: false },
            { KEY: "K5",  TXT: _msg("B78"), FA: "download",           ISSTART: false, VISIBLE: true }
        ];
    }

    /************************************************************************
     * 활성(ENABLED) 규칙 — 구 ev_beforeOpenContextMenu (모드 × 루트/폴더/파일).
     *   Display(_Display) : K3/K4/K6/K7/K8/K9/K10/K11/K12 비활성. 파일만 K6/K11 활성.
     *   Change(_Change)   : 루트→K4/K6/K7/K8/K9/K10/K11 비활성 / 폴더→K6/K11 비활성 / 파일→K3/K12 비활성.
     ************************************************************************/
    // 형제 배열 + 그 안에서의 인덱스 (이동 가용성 판정용). _fnUspSiblings(셸) 과 동일 규칙:
    //   루트레벨=모델 최상위, 그 외=부모 노드의 USPTREE.
    function _siblingsAndIndex(oNode) {
        var aTree = [];
        try { aTree = APPCOMMON.fnGetModelProperty("/WS30/USPTREE") || []; } catch (e) { }
        var aSib = null;
        if (oNode.PUJKY === "" || oNode.PUJKY == null) {
            aSib = aTree;
        } else {
            (function rec(arr) {
                for (var i = 0; i < arr.length; i++) {
                    if (arr[i] && arr[i].OBJKY === oNode.PUJKY) { aSib = arr[i].USPTREE || []; return; }
                    if (arr[i] && Array.isArray(arr[i].USPTREE)) { rec(arr[i].USPTREE); }
                    if (aSib) { return; }
                }
            })(aTree);
        }
        if (!aSib) { aSib = []; }
        var idx = aSib.findIndex(function (n) { return n && n.OBJKY === oNode.OBJKY; });
        return { len: aSib.length, idx: idx };
    }

    function _applyEnable(aMenu, oNode) {
        var bRoot = (oNode.PUJKY === "" || oNode.PUJKY == null);
        var bFold = (oNode.ISFLD === "X");
        function set(sKey, b) {
            for (var i = 0; i < aMenu.length; i++) { if (aMenu[i].KEY === sKey) { aMenu[i].ENABLED = b; return; } }
        }
        for (var i = 0; i < aMenu.length; i++) { aMenu[i].ENABLED = true; }   // 기본 전부 활성

        if (!_isEdit()) {
            // ── Display 모드 ──
            ["K3", "K4", "K6", "K7", "K8", "K9", "K10", "K11", "K12"].forEach(function (k) { set(k, false); });
            if (!bRoot && !bFold) { set("K6", true); set("K11", true); }   // 파일(root아님&폴더아님)만
            return;
        }
        // ── Change 모드 ──
        if (bRoot) {
            ["K4", "K6", "K7", "K8", "K9", "K10", "K11"].forEach(function (k) { set(k, false); });
            return;
        }
        // 비루트 공통 — 형제 위치 기반 이동(Up/Down/Move) 가용성 (WS20 트리와 동일 UX):
        //   형제 1개=이동 전부 불가, 첫째=Up 불가, 막내=Down 불가. (원본 USP 엔 없던 개선)
        (function () {
            var si = _siblingsAndIndex(oNode);
            if (si.len <= 1) { set("K8", false); set("K9", false); set("K10", false); }
            else {
                if (si.idx === 0) { set("K8", false); }
                if (si.idx === si.len - 1) { set("K9", false); }
            }
        })();
        if (bFold) {
            ["K6", "K11"].forEach(function (k) { set(k, false); });
            return;
        }
        ["K3", "K12"].forEach(function (k) { set(k, false); });   // 파일
    }

    /************************************************************************
     * 메뉴 오픈/닫기 (공통 .u4a-menu)
     ************************************************************************/
    var _menuEl = null;

    function _closeMenu() {
        if (_menuEl && _menuEl.parentNode) { _menuEl.parentNode.removeChild(_menuEl); }
        _menuEl = null;
        document.removeEventListener("mousedown", _onDocDown, true);
        document.removeEventListener("keydown", _onKey, true);
        window.removeEventListener("scroll", _closeMenu, true);
        window.removeEventListener("resize", _closeMenu, true);
    }
    function _onDocDown(ev) { if (_menuEl && !_menuEl.contains(ev.target)) { _closeMenu(); } }
    function _onKey(ev) { if (ev.key === "Escape") { _closeMenu(); } }

    function _openMenu(iX, iY, oNode) {
        _closeMenu();

        var aMenu = _defMenu();
        _applyEnable(aMenu, oNode);

        var oWrap = document.createElement("div");
        oWrap.className = "u4a-menu";
        oWrap.setAttribute("role", "menu");

        var bAny = false;
        aMenu.forEach(function (mi) {
            if (!mi.VISIBLE) { return; }                       // K11/K12 등 숨김
            if (mi.ISSTART && bAny) {                           // 그룹 구분선(첫 항목 앞은 제외)
                var oSep = document.createElement("div");
                oSep.className = "u4a-menu__sep";
                oWrap.appendChild(oSep);
            }
            var oItem = document.createElement("div");
            oItem.className = "u4a-menu__item";
            oItem.setAttribute("role", "menuitem");
            if (mi.ENABLED === false) { oItem.setAttribute("aria-disabled", "true"); }
            oItem.innerHTML = _fa(mi.FA) + '<span class="u4a-menu__item-text"></span>';
            oItem.querySelector(".u4a-menu__item-text").textContent = mi.TXT;
            if (mi.ENABLED !== false) {
                oItem.addEventListener("click", function () { _closeMenu(); _dispatch(mi.KEY, oNode); });
            }
            oWrap.appendChild(oItem);
            bAny = true;
        });

        // 화면 밖으로 넘치지 않게 위치 확정(먼저 숨겨 측정).
        oWrap.style.visibility = "hidden";
        document.body.appendChild(oWrap);
        var iW = oWrap.offsetWidth, iH = oWrap.offsetHeight;
        var iVw = window.innerWidth, iVh = window.innerHeight;

        // 가로: 우측 공간 부족하면 커서 왼쪽으로
        var iLeft = (iX + iW + 4 <= iVw) ? iX : (iX - iW);
        if (iLeft < 4) { iLeft = 4; }

        // 세로: 아래 공간이 충분하면 커서 아래로(기본), 부족하면 커서 위쪽으로 펼친다(메뉴 하단=커서).
        //   화면 하단 근처에서 우클릭 시 메뉴가 잘리지 않고 위로 올라오게 — 표준 컨텍스트 메뉴 동작.
        var iTop;
        if (iY + iH + 4 <= iVh) { iTop = iY; }       // 아래로 펼침
        else { iTop = iY - iH; }                      // 위로 펼침
        if (iTop < 4) { iTop = 4; }
        if (iTop + iH + 4 > iVh) { iTop = Math.max(4, iVh - iH - 4); }   // 위/아래 모두 부족(작은 화면) 클램프

        oWrap.style.left = iLeft + "px";
        oWrap.style.top = iTop + "px";
        oWrap.style.visibility = "";
        _menuEl = oWrap;

        document.addEventListener("mousedown", _onDocDown, true);
        document.addEventListener("keydown", _onKey, true);
        window.addEventListener("scroll", _closeMenu, true);
        window.addEventListener("resize", _closeMenu, true);
    }

    /************************************************************************
     * 메뉴 클릭 디스패치 (구 ev_UspTreeCtxMenuClick)
     ************************************************************************/
    function _dispatch(sKey, oNode) {
        try {
            // K1/K2 — 트리 전용(서버 무관) 완전 동작.
            if (sKey === "K1") { if (oAPP.fn.fnUspTreeExpandSubtree) { oAPP.fn.fnUspTreeExpandSubtree(oNode); } return; }
            if (sKey === "K2") { if (oAPP.fn.fnUspTreeCollapseSubtree) { oAPP.fn.fnUspTreeCollapseSubtree(oNode); } return; }

            // K3~K10 — 작업단위별 핸들러(단계 구현). 등록 전이면 미구현 로그(임의 UI 문구 금지).
            var fnAct = oAPP.usphtml.uspCtxAction[sKey];
            if (typeof fnAct === "function") { fnAct(oNode); return; }
            console.warn("[HTML5][WS30] 컨텍스트 메뉴 미구현(다음 단계):", sKey);
        } catch (e) {
            console.error("[HTML5][WS30] 컨텍스트 메뉴 실행 오류:", sKey, e);
        }
    }

    /************************************************************************
     * 트리거 — #uspTreeBody 의 트리 행 우클릭(위임 1개). 다른 화면 간섭 없음(클래스 가드).
     ************************************************************************/
    document.addEventListener("contextmenu", function (ev) {
        var oRow = (ev.target && ev.target.closest) ? ev.target.closest(".u4aWs30TreeRow") : null;
        if (!oRow || !oRow.closest("#uspTreeBody")) { return; }
        var oNode = oRow.__uspNode;
        if (!oNode) { return; }
        ev.preventDefault();
        ev.stopPropagation();
        try { if (oAPP.fn.fnUspTreeCtxSelect) { oAPP.fn.fnUspTreeCtxSelect(oNode); } } catch (e) { }
        _openMenu(ev.clientX, ev.clientY, oNode);
    }, false);

    // 화면 이탈/재렌더 시 잔여 메뉴 정리(안전망).
    oAPP.usphtml.closeUspCtxMenu = _closeMenu;

    /************************************************************************
     * K3 Create — 신규 노드(파일/폴더) 생성
     *  변경분 있으면 fnConfirmBox → YES: 먼저 저장(AFPRC="C") → 콜백에서 팝업 오픈
     *  변경분 없으면 바로 fnCreateUspNodePopup 오픈
     ************************************************************************/
    oAPP.usphtml.uspCtxAction["K3"] = function (oNode) {
        if (!oNode) { return; }
        var IS_CHAG = (APPCOMMON.fnGetModelProperty("/WS30/APP") || {}).IS_CHAG;
        if (IS_CHAG === "X") {
            // 변경분 있음(119) — YES: 저장 후 생성팝업 / NO: 변경 버리고 바로 생성팝업 / CANCEL: 취소 (원본 _fnCreateUspAppChangeMsgCB)
            var sMsg = APPCOMMON.fnGetMsgClsText("/U4A/MSG_WS", "119");
            try { if (oAPP.fn.fnChildWindowShow) { oAPP.fn.fnChildWindowShow(false); } } catch (e) { }
            oAPP.common.fnConfirmBox("W", sMsg, function (act) {
                if (act === "YES") {
                    oAPP.fn.fnSaveUspWs30({ AFPRC: "C", _createNode: oNode });
                } else if (act === "NO") {
                    try { if (oAPP.fn.fnUspSaveCancel) { oAPP.fn.fnUspSaveCancel(); } } catch (e) { }
                    if (oAPP.fn.fnCreateUspNodePopup) { oAPP.fn.fnCreateUspNodePopup(oNode); }
                } else {
                    try { if (oAPP.fn.fnChildWindowShow) { oAPP.fn.fnChildWindowShow(true); } } catch (e) { }
                }
            }, [
                { act: "YES", label: "Yes", emphasized: true },
                { act: "NO",  label: "No" },
                { act: "CANCEL", label: "Cancel" }
            ]);
            return;
        }
        if (oAPP.fn.fnCreateUspNodePopup) { oAPP.fn.fnCreateUspNodePopup(oNode); }
    };

    /************************************************************************
     * K4 Delete — 노드(+자손) 삭제. confirm(msg 003) → /usp_page_del.
     *   (원본 fnDeleteUspNode 는 변경분 선저장 없이 바로 확인 — Create 와 달리 C 분기 없음)
     ************************************************************************/
    oAPP.usphtml.uspCtxAction["K4"] = function (oNode) {
        if (!oNode) { return; }
        // " [ 이름 ] " + "정말 삭제하시겠습니까?"(003)
        var sMsg = " [ " + (oNode.OBDEC || "") + " ] " + APPCOMMON.fnGetMsgClsText("/U4A/MSG_WS", "003");
        try { if (oAPP.fn.fnChildWindowShow) { oAPP.fn.fnChildWindowShow(false); } } catch (e) { }
        oAPP.common.fnConfirmBox("W", sMsg, function (act) {
            if (act === "YES") {
                if (oAPP.fn.fnDeleteUspNode) { oAPP.fn.fnDeleteUspNode(oNode); }
            } else {
                try { if (oAPP.fn.fnChildWindowShow) { oAPP.fn.fnChildWindowShow(true); } } catch (e) { }
            }
        }, [
            { act: "YES", label: "Yes", emphasized: true },
            { act: "NO",  label: "No" }
        ]);
    };

    /************************************************************************
     * K7 Rename — 이름 변경. 변경분 있으면 선저장(AFPRC="RN") 후 팝업 / 없으면 바로 팝업.
     ************************************************************************/
    oAPP.usphtml.uspCtxAction["K7"] = function (oNode) {
        if (!oNode) { return; }
        var IS_CHAG = (APPCOMMON.fnGetModelProperty("/WS30/APP") || {}).IS_CHAG;
        if (IS_CHAG === "X") {
            // 변경분 있음(119) — YES: 저장 후 Rename팝업 / NO: 변경 버리고 바로 Rename팝업 / CANCEL: 취소 (원본 _fnRenameUspAppChangeMsgCB)
            var sMsg = APPCOMMON.fnGetMsgClsText("/U4A/MSG_WS", "119");
            try { if (oAPP.fn.fnChildWindowShow) { oAPP.fn.fnChildWindowShow(false); } } catch (e) { }
            oAPP.common.fnConfirmBox("W", sMsg, function (act) {
                if (act === "YES") {
                    oAPP.fn.fnSaveUspWs30({ AFPRC: "RN", _renameNode: oNode });
                } else if (act === "NO") {
                    try { if (oAPP.fn.fnUspSaveCancel) { oAPP.fn.fnUspSaveCancel(); } } catch (e) { }
                    if (oAPP.fn.fnRenameUspNodePopup) { oAPP.fn.fnRenameUspNodePopup(oNode); }
                } else {
                    try { if (oAPP.fn.fnChildWindowShow) { oAPP.fn.fnChildWindowShow(true); } } catch (e) { }
                }
            }, [
                { act: "YES", label: "Yes", emphasized: true },
                { act: "NO",  label: "No" },
                { act: "CANCEL", label: "Cancel" }
            ]);
            return;
        }
        if (oAPP.fn.fnRenameUspNodePopup) { oAPP.fn.fnRenameUspNodePopup(oNode); }
    };

    /************************************************************************
     * K8 Up / K9 Down / K10 Move Position — 노드 이동(형제 순서 변경). 변경분 저장 불필요(클라 모델만).
     ************************************************************************/
    oAPP.usphtml.uspCtxAction["K8"] = function (oNode) {
        if (oNode && oAPP.fn.fnUspTreeNodeMoveUp) { oAPP.fn.fnUspTreeNodeMoveUp(oNode); }
    };
    oAPP.usphtml.uspCtxAction["K9"] = function (oNode) {
        if (oNode && oAPP.fn.fnUspTreeNodeMoveDown) { oAPP.fn.fnUspTreeNodeMoveDown(oNode); }
    };
    oAPP.usphtml.uspCtxAction["K10"] = function (oNode) {
        if (oNode && oAPP.fn.fnUspTreeNodeMovePosition) { oAPP.fn.fnUspTreeNodeMovePosition(oNode); }
    };

    /************************************************************************
     * K5 Download — 선택 노드 하위 파일을 zip 으로 묶어 다운로드(셸 fnDownloadUspFiles).
     ************************************************************************/
    oAPP.usphtml.uspCtxAction["K5"] = function (oNode) {
        if (oNode && oAPP.fn.fnDownloadUspFiles) { oAPP.fn.fnDownloadUspFiles(oNode); }
    };

    /************************************************************************
     * K6 Test Service — 선택 파일을 브라우저로 실행(셸 fnTestServiceUsp).
     ************************************************************************/
    oAPP.usphtml.uspCtxAction["K6"] = function (oNode) {
        if (oNode && oAPP.fn.fnTestServiceUsp) { oAPP.fn.fnTestServiceUsp(oNode); }
    };

})(window, jQuery, oAPP);
