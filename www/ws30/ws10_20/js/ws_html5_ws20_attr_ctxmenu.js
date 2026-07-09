/************************************************************************
 * ws_html5_ws20_attr_ctxmenu.js  (HTML5) — WS20 속성(Properties) 영역 우클릭 컨텍스트 메뉴
 * ----------------------------------------------------------------------
 * 구 design/js/callAttrContextMenu.js (sap.m.Menu) → 공통 .u4a-menu 스킨(shell.css) 소비.
 *   ★ 메뉴 정의/순서/구분선(startsSection)/표시(vis01~vis06) 규칙을 원본 1:1 이식.
 *     - 정의/순서/아이콘/메시지키       : 구 callAttrContextMenu()
 *     - 표시 규칙(호출 셀 AT01~AT04 × 속성 상태) : 구 attrSetContextMenu()
 *     - 선택 분기                        : 구 attrCtxtMenuItemPress()
 *
 *   - 트리거 : #ws20AttrRows 의 .u4aWs20AttrRow 우클릭. 어느 셀에서 눌렀는지(data-ctx-key)
 *              로 AT01(라벨)/AT02(값)/AT03(바인딩아이콘)/AT04(클라이언트이벤트아이콘) 결정
 *              (구 l_ui.data("CONTEXT_MENU")). 편집모드(IS_EDIT)·비ROOT 에서만.
 *   - 닫기   : 바깥 mousedown / ESC / 스크롤 / 리사이즈(USP ctxmenu 공통 패턴).
 *   - 동작   : M01 WAIT on/off · M02 Unbind · M03 동일속성 동기화 · M04 클라이언트이벤트 해제 ·
 *              M05 단축키 등록 · M06 UI Attribute 개인화 = 완전 동작(attrSetUnbindProp/attrUnbindAggr/
 *              attrDelClientEvent/fnWs20AttrChange/fnSameAttrSyncPopupOpen/fnEventShortcutRegOpen/
 *              fnAttrPresetSettingsOpen 재사용/온디맨드 로드).
 *              (M05 = 구 eventShortcutReg + keybindingPopup → fnEventShortcutRegOpen.js 로 이식.)
 ************************************************************************/

(function (window, $, oAPP) {
    "use strict";

    var APPCOMMON = oAPP.common;
    oAPP.fn = oAPP.fn || {};

    /* ── 메시지 헬퍼 (원본 클래스 단일 출처. 영문 폴백/사전 금지 — 미조회 시 코드 반환) ── */
    function _msgC(sNum) {   // /U4A/CL_WS_COMMON (A42~A45)
        try {
            var s = APPCOMMON.fnGetMsgClsText("/U4A/CL_WS_COMMON", sNum);
            if (s != null && s !== "" && s.indexOf("|") === -1) { return s; }
        } catch (e) { }
        return sNum;
    }
    function _msgM(sNum) {   // /U4A/MSG_WS (263/264/005)
        try {
            var s = APPCOMMON.fnGetMsgClsText("/U4A/MSG_WS", sNum);
            if (s != null && s !== "" && s.indexOf("|") === -1) { return s; }
        } catch (e) { }
        return sNum;
    }
    function _msgW(sNr) {    // ZMSG_WS_COMMON_001 (805/627)
        try {
            var s = parent.WSUTIL.getWsMsgClsTxt("", "ZMSG_WS_COMMON_001", sNr);
            if (s && s.indexOf("|") === -1) { return s; }
        } catch (e) { }
        return sNr;
    }
    function _fa(sName) { return '<i class="fa-solid fa-' + sName + '"></i>'; }

    // ACTION CODE(UNDO/이력 예외) — oAPP.oDesign.CS_ACTCD (없으면 undefined 안전).
    function _actcd(sName) {
        try { return oAPP.oDesign && oAPP.oDesign.CS_ACTCD ? oAPP.oDesign.CS_ACTCD[sName] : undefined; }
        catch (e) { return undefined; }
    }

    // 미변환 별창(M03/M05/M06) 임시 안내 — 구 attrPresetPopup 토글 버튼과 동일.
    //   TODO(i18n): "아직 작업중입니다" 임시 하드코딩 → 각 별창(callSetSameAttrPopup /
    //   eventShortcutReg / attrPresetPopup settings) HTML5 변환 시 실제 오픈 로직으로 교체.
    function _todoToast() {
        try { parent.showMessage(null, 10, "I", "아직 작업중입니다"); } catch (e) { }
    }

    /************************************************************************
     * 표시 규칙 — 구 attrSetContextMenu(oMenu, is_attr, sKey).
     *   반환: null  = 메뉴 표시 안함(원본이 true 반환하던 경우와 동일)
     *         { UIATT, vis:{vis01..vis06} } = 표시할 메뉴 상태
     ************************************************************************/
    function _computeMenu(is_attr, sKey) {

        var vis = { vis01: false, vis02: false, vis03: false, vis04: false, vis05: false, vis06: false };

        switch (sKey) {

            case "AT01":
                //ui attribute text(라벨)에서 호출 — 이벤트(UIATY="2")+편집가능(edit) 에서만.
                if (is_attr.UIATY !== "2") { return null; }
                if (is_attr.edit !== true) { return null; }
                //WAIT MODE ON/OFF + 단축키 등록 활성.
                vis.vis01 = true;
                vis.vis05 = true;
                break;

            case "AT02":
                //프로퍼티/이벤트/애그리게이션 입력란에서 호출.
                if (is_attr.UIATY !== "1" && is_attr.UIATY !== "2" && is_attr.UIATY !== "3") { return null; }

                //이벤트 — 동일속성 동기화 + 단축키 등록 활성. (원본 20250615 개선)
                if (is_attr.UIATY === "2") {
                    vis.vis03 = true;
                    vis.vis05 = true;
                }

                if (is_attr.UIATY === "1" && is_attr.ISBND === "") {
                    //프로퍼티 && 미바인딩 — 동일속성 동기화, 편집가능하면 개인화 팝업.
                    vis.vis03 = true;
                    if (is_attr.edit === true) { vis.vis06 = true; }
                } else if (is_attr.UIATY === "1" && is_attr.ISBND === "X") {
                    //프로퍼티 && 바인딩됨 — unbind.
                    vis.vis02 = true;
                } else if (is_attr.UIATY === "3" && is_attr.ISBND === "X") {
                    //애그리게이션 && 바인딩됨 — unbind.
                    vis.vis02 = true;
                }
                break;

            case "AT03":
                //바인딩 아이콘(서버이벤트 아이콘) — 원본은 항상 메뉴 표시 안함.
                return null;

            case "AT04":
                //클라이언트 이벤트(document help) 아이콘 — 프로퍼티/이벤트에서만.
                if (is_attr.UIATY !== "1" && is_attr.UIATY !== "2") { return null; }

                var l_OBJTY = (is_attr.UIATK === "AT000011858") ? "HM" : "JS";

                var aCevt = [];
                try { aCevt = oAPP.DATA.APPDATA.T_CEVT || []; } catch (e) { aCevt = []; }
                var l_index = aCevt.findIndex(function (a) {
                    return a.OBJID === is_attr.OBJID + is_attr.UIASN && a.OBJTY === l_OBJTY;
                });
                //설정된 클라이언트 이벤트가 없으면 메뉴 표시 안함.
                if (l_index === -1) { return null; }

                vis.vis04 = true;
                break;

            default:
                return null;
        }

        return { UIATT: is_attr.UIATT || "", vis: vis };
    }

    /************************************************************************
     * 메뉴 정의 — 구 callAttrContextMenu()의 아이템 순서/키/아이콘/메시지 1:1.
     *   M00 은 선택한 attr 명(비활성 헤더). M05 는 WLO(UHAK901289) 서버만.
     ************************************************************************/
    function _defItems(oRes) {
        var vis = oRes.vis;
        var aItems = [
            { KEY: "M00", FA: "bars",           TXT: oRes.UIATT,   VISIBLE: true,      ENABLED: false },   // sap-icon://menu2
            { KEY: "M01", FA: "clock",          TXT: _msgC("A42"), VISIBLE: vis.vis01, ENABLED: true },    // sap-icon://lateness
            { KEY: "M02", FA: "link-slash",     TXT: _msgC("A43"), VISIBLE: vis.vis02, ENABLED: true },    // sap-icon://disconnected
            { KEY: "M03", FA: "paste",          TXT: _msgC("A44"), VISIBLE: vis.vis03, ENABLED: true },    // sap-icon://paste
            { KEY: "M04", FA: "trash",          TXT: _msgC("A45"), VISIBLE: vis.vis04, ENABLED: true }     // sap-icon://delete
        ];

        //M05 단축키 등록 — WLO(UHAK901289) 패치 서버에서만 노출(원본 checkWLOList).
        var bShortcut = false;
        try { bShortcut = APPCOMMON.checkWLOList("C", "UHAK901289") === true; } catch (e) { }
        if (bShortcut) {
            aItems.push({ KEY: "M05", FA: "keyboard", TXT: _msgW("805"), VISIBLE: vis.vis05, ENABLED: true });   // sap-icon://keyboard-and-mouse
        }

        //M06 개인화 팝업.
        aItems.push({ KEY: "M06", FA: "user", TXT: _msgW("627"), VISIBLE: vis.vis06, ENABLED: true });   // sap-icon://account

        return aItems;
    }

    /************************************************************************
     * 메뉴 오픈/닫기 (공통 .u4a-menu) — USP ctxmenu 와 동일 패턴.
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

    function _openMenu(iX, iY, is_attr, oRes) {
        _closeMenu();

        var aItems = _defItems(oRes);

        var oWrap = document.createElement("div");
        oWrap.className = "u4a-menu";
        oWrap.setAttribute("role", "menu");

        var bAny = false;   // 이미 렌더된 항목 존재(첫 항목 앞엔 구분선 없음)
        aItems.forEach(function (mi) {
            if (!mi.VISIBLE) { return; }
            //원본은 모든 아이템 startsSection:true — 각 항목 앞에 구분선(첫 항목 제외).
            if (bAny) {
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
                oItem.addEventListener("click", function () { _closeMenu(); _dispatch(mi.KEY, is_attr); });
            }
            oWrap.appendChild(oItem);
            bAny = true;
        });

        //화면 밖으로 넘치지 않게 위치 확정(먼저 숨겨 측정).
        oWrap.style.visibility = "hidden";
        document.body.appendChild(oWrap);
        var iW = oWrap.offsetWidth, iH = oWrap.offsetHeight;
        var iVw = window.innerWidth, iVh = window.innerHeight;

        var iLeft = (iX + iW + 4 <= iVw) ? iX : (iX - iW);
        if (iLeft < 4) { iLeft = 4; }

        var iTop;
        if (iY + iH + 4 <= iVh) { iTop = iY; } else { iTop = iY - iH; }
        if (iTop < 4) { iTop = 4; }
        if (iTop + iH + 4 > iVh) { iTop = Math.max(4, iVh - iH - 4); }

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
     * 선택 분기 — 구 attrCtxtMenuItemPress(oUi, key).
     ************************************************************************/
    function _dispatch(sKey, is_attr) {
        try {
            switch (sKey) {
                case "M01": _waitOnOff(is_attr); break;              //서버이벤트 WAIT on/off
                case "M02": _unbind(is_attr); break;                 //unbind
                case "M03": _openSameAttrSync(is_attr); break;       //동일속성 동기화
                case "M04": _removeClientEvent(is_attr); break;      //클라이언트 이벤트 해제
                case "M06": _openPresetSettings(is_attr); break;     //UI Attribute 개인화 팝업
                case "M05": _openEventShortcutReg(is_attr); break;   //단축키 등록
                default:
                    break;
            }
        } catch (e) {
            console.error("[HTML5][WS20][attr] 컨텍스트 메뉴 실행 오류:", sKey, e);
        }
    }

    /* ── M03 동일 속성 동기화 — 구 callSetSameAttrPopup(design/js) ──
     *   인앱 다이얼로그 fnSameAttrSyncPopupOpen 온디맨드 로드 후 호출. */
    function _openSameAttrSync(is_attr) {
        var fn = function () {
            if (typeof oAPP.fn.fnSameAttrSyncPopupOpen === "function") { oAPP.fn.fnSameAttrSyncPopupOpen(is_attr); }
            else { console.warn("[HTML5][WS20][attr] fnSameAttrSyncPopupOpen 미로드"); _todoToast(); }
        };
        try { oAPP.loadJs("fnSameAttrSyncPopupOpen", fn); }
        catch (e) {
            console.error("[HTML5][WS20][attr] fnSameAttrSyncPopupOpen 로드 실패:", e && e.message);
            fn();
        }
    }

    /* ── M05 단축키 등록 — 구 eventShortcutReg + keybindingPopup(원본 attrContextMenu/utils) ──
     *   인앱 다이얼로그 fnEventShortcutRegOpen 온디맨드 로드 후 호출(M03 과 동일 패턴). */
    function _openEventShortcutReg(is_attr) {
        var fn = function () {
            if (typeof oAPP.fn.fnEventShortcutRegOpen === "function") { oAPP.fn.fnEventShortcutRegOpen(is_attr); }
            else { console.warn("[HTML5][WS20][attr] fnEventShortcutRegOpen 미로드"); _todoToast(); }
        };
        try { oAPP.loadJs("fnEventShortcutRegOpen", fn); }
        catch (e) {
            console.error("[HTML5][WS20][attr] fnEventShortcutRegOpen 로드 실패:", e && e.message);
            fn();
        }
    }

    /* ── M06 UI Attribute 개인화 — 구 _callP13nAttrPopup(settings/index.js) ──
     *   인앱 다이얼로그 fnAttrPresetSettingsOpen 온디맨드 로드 후 호출. */
    function _openPresetSettings(is_attr) {
        //[개발/디버깅] 매번 재로드(loadJs=$.ajax cache:false)해 파일 수정이 앱 재시작 없이 바로 반영되게 한다.
        //  파일 IIFE 는 함수 재정의뿐(전역 리스너 없음)이라 재-eval 안전. 원인 확정 후 캐시 가드 복원 고려.
        try { oAPP.loadJs("fnAttrPresetSettingsOpen", function () { oAPP.fn.fnAttrPresetSettingsOpen(is_attr); }); }
        catch (e) {
            console.error("[HTML5][WS20][attr] fnAttrPresetSettingsOpen 로드 실패:", e && e.message);
            if (typeof oAPP.fn.fnAttrPresetSettingsOpen === "function") { oAPP.fn.fnAttrPresetSettingsOpen(is_attr); }
        }
    }

    /* ── M01 이벤트 WAIT ON/OFF — 구 attrContextMenuWaitOnOff ── */
    function _waitOnOff(is_attr) {
        //ISWIT 토글(X↔"") 후 변경 후속 처리.
        is_attr.ISWIT = (is_attr.ISWIT === "X") ? "" : "X";
        oAPP.fn.fnWs20AttrChange(is_attr, "");
    }

    //unbind 프리미티브(attrSetUnbindProp/attrUnbindAggr/attrUnbindTree)는 온디맨드
    //  fnBindPopupOpen.js 에 정의 — _buildIconCell 과 동일하게 없으면 먼저 로드 후 실행.
    function _withBindModule(fn) {
        if (typeof oAPP.fn.attrSetUnbindProp === "function") { fn(); return; }
        try { oAPP.loadJs("fnBindPopupOpen", fn); }
        catch (e) { console.error("[HTML5][WS20][attr] fnBindPopupOpen 로드 실패:", e && e.message); }
    }

    /* ── M02 프로퍼티/애그리게이션 unbind — 구 attrContextMenuUnbind ── */
    function _unbind(is_attr) {
        //263 Do you want to continue unbind?
        _confirm(_msgM("263"), function () {
            _withBindModule(function () {
                if (typeof oAPP.fn.attrSetUnbindProp !== "function") {
                    console.warn("[HTML5][WS20][attr] unbind 미가용(fnBindPopupOpen 미로드)");
                    _todoToast();
                    return;
                }
                if (is_attr.UIATY === "1") {
                    //프로퍼티 — sap.ui.core.HTML content 는 UNDO 스킵 ACTCD.
                    if (is_attr.UIATK === "AT000011858") {
                        var cd = _actcd("UNBIND_TREE_KEY");
                        if (cd !== undefined) { is_attr.ACTCD = cd; }
                    }
                    oAPP.fn.attrSetUnbindProp(is_attr);   //내부에서 fnWs20AttrChange(busy/재렌더/undo)
                    _doneToast();
                    return;
                }
                if (is_attr.UIATY === "3") {
                    //애그리게이션 — 라이브 미리보기 인스턴스일 때만 실제 해제.
                    var oPrev = oAPP.attr.prev && oAPP.attr.prev[is_attr.OBJID];
                    if (oPrev && typeof oPrev.getMetadata === "function" && typeof oAPP.fn.attrUnbindAggr === "function") {
                        try { oAPP.fn.attrUnbindAggr(oPrev, is_attr.UIATT, is_attr.UIATV); }
                        catch (e) { console.error("[HTML5][WS20][attr] attrUnbindAggr:", e && e.message); }
                    }
                    var cd2 = _actcd("UNBIND_AGGR");
                    if (cd2 !== undefined) { is_attr.ACTCD = cd2; }
                    oAPP.fn.attrSetUnbindProp(is_attr);
                    if (typeof oAPP.fn.attrUnbindTree === "function") { oAPP.fn.attrUnbindTree(is_attr); }   //Tree/TreeTable parent·child 예외
                    _doneToast();
                }
            });
        });
    }

    /* ── M04 클라이언트 이벤트 해제 — 구 attrContextMenuRemoveClientEvent ──
     *   삭제 프리미티브 attrDelClientEvent 는 ws_html5_ws20_attr.js 에 이식 완료(항상 로드).
     *   (안전망) 미정의면 임시 안내 — 정상 경로에선 도달하지 않음. */
    function _removeClientEvent(is_attr) {
        if (typeof oAPP.fn.attrDelClientEvent !== "function") {
            console.warn("[HTML5][WS20][attr] attrDelClientEvent 미로드(예외):", is_attr && is_attr.UIATT);
            _todoToast();
            return;
        }
        //264 Remove Event Javascript source?
        _confirm(_msgM("264"), function () {
            var l_OBJTY = "JS";
            if (is_attr.UIATK === "AT000011858") {
                l_OBJTY = "HM";
                is_attr.UIATV = "";   //프로퍼티 초기화
            }
            //★ UNDO: T_CEVT 삭제 "전" 에 스냅샷 1회. 삭제 후(=fnWs20AttrChange 내부) push 하면
            //  스냅샷이 이미 지워진 T_CEVT 를 담아 UNDO 로 이벤트 소스가 복원되지 않는다.
            //  → 여기서 먼저 push 하고, fnWs20AttrChange 는 bSkipUndo=true 로 재-push 방지(M03 과 동일 패턴).
            try { if (typeof oAPP.fn.fnWs20PushUndo === "function") { oAPP.fn.fnWs20PushUndo(); } }
            catch (e) { console.warn("[HTML5][WS20][attr] undo push skip:", e && e.message); }

            try { oAPP.fn.attrDelClientEvent(is_attr, l_OBJTY); }
            catch (e) { console.error("[HTML5][WS20][attr] attrDelClientEvent:", e && e.message); }

            is_attr.ADDSC = "";   //js 설정됨 flag 제거
            var cd = _actcd("DEL_CLIENT_EVENT");
            if (cd !== undefined) { is_attr.ACTCD = cd; }

            oAPP.fn.fnWs20AttrChange(is_attr, "", true);   //bSkipUndo — 위에서 1회 push 함
            _doneToast();
        });
    }

    //005 Job finished.
    function _doneToast() {
        try { parent.showMessage(null, 10, "I", _msgM("005")); } catch (e) { }
    }

    //확인 팝업(YES/NO) — 바인딩 팝업과 동일하게 공통 U4AUI.confirm 우선.
    function _confirm(sMsg, fnYes) {
        if (window.U4AUI && U4AUI.confirm) {
            U4AUI.confirm({ type: "C", message: sMsg, onClose: function (act) { if (act === "YES") { fnYes(); } } });
        } else {
            try { parent.showMessage(null, 30, "I", sMsg, function (p) { if (p === "YES") { fnYes(); } }); }
            catch (e) { }
        }
    }

    /************************************************************************
     * 트리거 — #ws20AttrRows 의 속성 행 우클릭(위임 1개). 다른 화면 간섭 없음(가드).
     *   구 attrBeforeContextMenu: 편집모드 아님/ROOT/키 없음 → 메뉴 미표시.
     ************************************************************************/
    document.addEventListener("contextmenu", function (ev) {
        var oRow = (ev.target && ev.target.closest) ? ev.target.closest(".u4aWs20AttrRow") : null;
        if (!oRow || !oRow.closest("#ws20AttrRows")) { return; }

        //편집모드 아니면 메뉴 없음(원본 IS_EDIT !== true → exit).
        var bEdit = false;
        try { bEdit = oAPP.attr.oModel.oData.IS_EDIT === true; } catch (e) { }
        if (!bEdit) { return; }

        var is_attr = oRow.__attrData;
        if (!is_attr) { return; }

        //ROOT(APP 문서)에서 호출한 경우 메뉴 없음(원본 2299).
        if (is_attr.OBJID === "ROOT") { return; }

        //어느 셀에서 눌렀는지 → AT01~AT04 (구 l_ui.data("CONTEXT_MENU")).
        var oCell = ev.target.closest ? ev.target.closest("[data-ctx-key]") : null;
        var sKey = oCell ? oCell.getAttribute("data-ctx-key") : null;
        if (!sKey) { return; }

        //표시 규칙 판정 — null 이면 메뉴 없음(원본 attrSetContextMenu === true).
        var oRes = _computeMenu(is_attr, sKey);
        if (!oRes) { return; }

        ev.preventDefault();
        ev.stopPropagation();
        _openMenu(ev.clientX, ev.clientY, is_attr, oRes);
    }, false);

    //화면 이탈/재렌더 시 잔여 메뉴 정리(안전망).
    oAPP.fn.closeWs20AttrCtxMenu = _closeMenu;

})(window, jQuery, oAPP);
