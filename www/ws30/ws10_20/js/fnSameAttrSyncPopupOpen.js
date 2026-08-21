/************************************************************************
 * fnSameAttrSyncPopupOpen.js  (HTML5) — WS20 속성 컨텍스트 메뉴 M03 "동일 속성 동기화"
 * ----------------------------------------------------------------------
 * 원본: design/js/callSetSameAttrPopup.js  oAPP.fn.callSetSameAttrPopup(is_attr)
 *   · design 트리 전체를 훑어 "선택 속성과 이름/유형/데이터타입이 동일한" 다른 UI 들을 수집
 *     (setSameAttrData) → 팝업 상단에 선택 속성 정보(OBJID/UIATT/UIADT/Change value), 하단에
 *     대상 목록 테이블(멀티선택) 표시 → 확인 시 선택 라인들에 입력값 일괄 동기화(lf_setSyncAttr).
 *
 * HTML5: native <dialog class="u4a-dialog"> + 공통 컴포넌트만 소비
 *   (U4AUI.createPanel[상단 정보=접이식 패널, 원본 sap.m.Panel expandable] · createField/createSelect ·
 *    .u4a-table 멀티선택[체크박스열+전체선택] + 컬럼 정렬/필터 메뉴[U4AUI.openColumnMenu, 원본 6컬럼
 *    sortProperty/filterProperty] · .u4a-compact[원본 sapUiSizeCompact 밀도] · .u4a-form__row ·
 *    makeDialogRecenter/Resizable · 전역 헤더드래그 · showMessage top-layer 토스트). 공통 파일 미수정.
 *   ★ 멀티선택 테이블 선례 = fnCssJsLinkAddPopupOpen.js(SelectionMode.MultiToggle 대응). SSOT=.analy/16 §3.x(table)/§2.10(top-layer).
 *
 * ★ 보존 로직(원본 1:1):
 *   · 수집 setSameAttrData: zTREE[0].zTREE 재귀. 선택 UI(OBJID) 제외, prev[OBJID]._T_0015 의 기존
 *     변경건 우선(바인딩 ISBND="X" 은 skip) → 없으면 라이브러리 T_0023(UIOBK·UIATT·UIATY·UIADT,
 *     ISDEP!="X") 매칭 시 DEFVL 로 라인 구성. _1(직접입력 AGGR)은 UIATY 치환.
 *   · Change value 컨트롤 = 원본 lf_setBindVal 분기: 이벤트(UIATY=2)/ISLST=X → Select(DDLB),
 *     그 외 → Input(+ 아이콘·컬러 F4). 입력 변경 시 chkValidProp → 불가값은 DEFVL 로 되돌림(원본 setInputVal).
 *     ※ 값은 로컬(oState.value)에서만 편집 — 확인 전까지 실제 모델(is_attr) 미변경(원본 oMdl 분리 모델과 동일).
 *   · 확인 lf_setSyncAttr: 선택 라인별 prev[OBJID]._T_0015 갱신/생성(DEFVL=삭제, 공백+DEFVL존재=ISSPACE,
 *     ISBND=X skip) + previewUIsetProp, 이어서 is_attr.UIATV 반영 + (이벤트면 T_DDLB 복사) →
 *     소스 커밋/속성패널 refresh = fnWs20AttrChange(is_attr,"",true). 성공 토스트 005.
 *     ┌ 원본 소스 커밋: attrChange(is_attr, "", false, true)  ← A-Z 추적으로 4인자 확정:
 *     │   (is_attr, uityp="", bSkipRefresh=false, bForceUpdate=true). 본체 attrChange→attrChgAttrVal
 *     │   (소스를 _ensurePrev(OBJID)._T_0015 에 커밋) + attrChangeProc(스타일/F4/편집/미리보기 +
 *     │   bForceUpdate ? oModel.refresh(true))까지 HTML5 fnWs20AttrChange 가 인라인 재현(원본 1764/1909행).
 *     │   bForceUpdate(전체 재바인딩)=HTML5 fnRenderWs20AttrRows(속성행 전체 재렌더), bSkipRefresh=false=refresh 수행.
 *     └ 원본 후처리 selPreviewUI/designRefershModel(트리)/updateBindPopupDesignData(별창 브로드캐스트)는
 *       W2 미리보기·UI5 트리바인딩·분리창 전용 → HTML5 attr 변경 공통(fnWs20AttrChange)이 "모든" attr
 *       변경에서 일괄 생략(트리는 attr값을 안 그림). ∴ M03 만의 누락이 아니라 기존 공통 동작과 동일.
 *   · 대상 없음=055(W), 선택 없음=268(E), 취소/닫기=001(I), 성공=005(S). 메시지키만(임의문구 금지).
 *   · UNDO: 변경 "직전" fnWs20PushUndo 1회 → 대상+소스 전체가 한 번의 undo 로 복원(트리 편집과 동일 스택).
 *     (fnWs20AttrChange 는 bSkipUndo=true 로 재-push 방지 — 이중 스냅샷/반쪽 복원 회피.)
 * ★ UI5 의존부 치환: sap.m.Dialog→<dialog>, sap.ui.table→.u4a-table, JSONModel→로컬 oState,
 *   sap.m.Input/Select→createField/createSelect, ColorPicker→fnColorPickerOpen(행과 동일).
 *   원본 bindPopupBroadCast BUSY_ON(별창 잠금)은 인앱 다이얼로그라 미적용(형제창 없음, [[broadcast-busy-pair]]).
 ************************************************************************/

(function (window, $, oAPP) {
    "use strict";

    var APPCOMMON = oAPP.common;

    var C_DLG_ID = "u4aWsSameAttrDlg";

    // 대상 목록 컬럼 — 원본 sap.ui.table.Column 6개(모두 sortProperty+filterProperty 보유)와 1:1.
    //   key=바인딩 필드, msg=/U4A/CL_WS_COMMON 헤더 라벨키. 정렬/필터=공통 openColumnMenu(§16 6.2).
    var C_COLS = [
        { key: "OBJID", msg: "A84" },   // UI Object ID
        { key: "UIATV", msg: "A53" },   // Value
        { key: "UILIB", msg: "A85" },   // UI Object Module
        { key: "UIOBK", msg: "A86" },   // UI Object Key
        { key: "POBID", msg: "A87" },   // Parent UI Object ID
        { key: "PUIOK", msg: "A88" }    // Parent Object Module
    ];

    /* ── 헬퍼 ───────────────────────────────────────────────────────── */
    function _fa(s) { return '<i class="fa-solid fa-' + s + '"></i>'; }
    function _el(tag, cls, txt) {
        var o = document.createElement(tag);
        if (cls) { o.className = cls; }
        if (typeof txt !== "undefined") { o.textContent = txt; }
        return o;
    }
    // /U4A/CL_WS_COMMON (A80/A84/A81/A82/A83/A53/A85/A86/A87/A88/A40/A41/A39).
    function _msgC(sNum) {
        try {
            var s = APPCOMMON.fnGetMsgClsText("/U4A/CL_WS_COMMON", sNum);
            if (s != null && s !== "" && s.indexOf("|") === -1) { return s; }
        } catch (e) { }
        return sNum;
    }
    // /U4A/MSG_WS (055/268/001/005).
    function _msgM(sNum) {
        try {
            var s = APPCOMMON.fnGetMsgClsText("/U4A/MSG_WS", sNum);
            if (s != null && s !== "" && s.indexOf("|") === -1) { return s; }
        } catch (e) { }
        return sNum;
    }
    // ZMSG_WS_COMMON_001 (060/061) — Workspace 언어.
    function _wsC(sNr) {
        try {
            var L = (parent.getUserInfo && parent.getUserInfo().LANGU) || "";
            var s = parent.WSUTIL.getWsMsgClsTxt(L, "ZMSG_WS_COMMON_001", sNr);
            if (s && s.indexOf("|") === -1) { return s; }
        } catch (e) { }
        return sNr;
    }
    // 토스트/메시지 — 공통 showMessage(KIND 10=토스트). 모달 top-layer 안에 자동 배치.
    function _toast(sType, sText) {
        if (!sText) { return; }
        try { parent.showMessage(null, 10, sType || "I", sText); } catch (e) { }
    }
    function _isEdit() {
        try { return oAPP.attr.oModel.oData.IS_EDIT === true; } catch (e) { return false; }
    }
    // 미리보기 반영(W2 미변환/미로드면 no-op) — 원본 previewUIsetProp 1:1.
    function _preview(sAttr) {
        if (typeof oAPP.fn.previewUIsetProp === "function") {
            try { oAPP.fn.previewUIsetProp(sAttr); } catch (e) { console.error("[HTML5][WS20][sameAttr] previewUIsetProp:", e && e.message); }
        }
    }

    /* ── 단일 인스턴스 + 컨텍스트 ─────────────────────────────────────── */
    var oUI = null;   // { dlg, infoBox, valRow, valWrap, tbody, headChk, footConfirm, footCancel }
    var oState = null; // { attr, list, ddlb, islst, defvl, value, field, select }

    /* ── 닫기 ──────────────────────────────────────────────────────────
     *   bSkipMsg=true 면 취소 안내(001) 생략(확인 성공 경로). 원본 lf_close 1:1. */
    function lf_close(bSkipMsg) {
        try { if (window.U4AUI && U4AUI.closeColumnMenu) { U4AUI.closeColumnMenu(); } } catch (e) { }
        try { if (oUI && oUI.dlg && oUI.dlg.open) { oUI.dlg.close(); } } catch (e) { }
        if (bSkipMsg === true) { return; }
        //001 Cancel operation
        _toast("I", _msgM("001"));
    }

    /************************************************************************
     * 동일 ATTRIBUTE 항목 구성 — 원본 setSameAttrData(it_tree, T_LIST) 1:1.
     *   HTML5 안전가드: prev[OBJID] / prev[OBJID]._T_0015 미생성 노드는 빈 배열 취급(throw 회피).
     ************************************************************************/
    function _collectSameAttr(is_attr, it_tree, T_LIST) {

        if (!it_tree || it_tree.length === 0) { return; }

        for (var i = 0, l = it_tree.length; i < l; i++) {

            //선택한 UI 와 동일 UI 는 수집 skip, 하위만 탐색.
            if (it_tree[i].OBJID === is_attr.OBJID) {
                _collectSameAttr(is_attr, it_tree[i].zTREE, T_LIST);
                continue;
            }

            var ls_list = {};

            //ATTRIBUTE 변경건 수집정보(prev._T_0015)에서 동일 속성 우선 검색.
            var oPrev = oAPP.attr.prev ? oAPP.attr.prev[it_tree[i].OBJID] : null;
            var a15 = (oPrev && Array.isArray(oPrev._T_0015)) ? oPrev._T_0015 : [];

            if (a15.length !== 0) {
                var ls_attr = a15.find(function (a) {
                    return a.UIATT === is_attr.UIATT && a.UIATY === is_attr.UIATY && a.UIADT === is_attr.UIADT;
                });

                if (ls_attr) {
                    //바인딩 처리건은 해당 UI skip, 하위만 탐색.
                    if (ls_attr.ISBND === "X") {
                        _collectSameAttr(is_attr, it_tree[i].zTREE, T_LIST);
                        continue;
                    }

                    ls_list = oAPP.fn.crtStru0015();
                    oAPP.fn.moveCorresponding(ls_attr, ls_list);
                    ls_list.UILIB = it_tree[i].UILIB;
                    ls_list.POBID = it_tree[i].POBID;
                    ls_list.PUIOK = it_tree[i].PUIOK;
                    T_LIST.push(ls_list);

                    _collectSameAttr(is_attr, it_tree[i].zTREE, T_LIST);
                    continue;
                }
            }

            //DEFAULT PROPERTY TYPE (직접입력 AGGREGATION[_1] 은 "3" 으로 검색).
            var l_UIATY = is_attr.UIATY;
            if (is_attr.UIATK.indexOf("_1") !== -1) { l_UIATY = "3"; }

            //LIBRARY 에서 해당 ATTRIBUTE 존재 여부 검색.
            var ls_0023 = oAPP.DATA.LIB.T_0023.find(function (a) {
                return a.UIOBK === it_tree[i].UIOBK && a.UIATT === is_attr.UIATT &&
                    a.UIATY === l_UIATY && a.ISDEP !== "X" && a.UIADT === is_attr.UIADT;
            });

            if (!ls_0023) {
                _collectSameAttr(is_attr, it_tree[i].zTREE, T_LIST);
                continue;
            }

            ls_list = oAPP.fn.crtStru0015();
            oAPP.fn.moveCorresponding(ls_0023, ls_list);

            ls_list.APPID = oAPP.attr.appInfo.APPID;
            ls_list.GUINR = oAPP.attr.appInfo.GUINR;

            if (is_attr.UIATK.indexOf("_1") !== -1) {
                ls_list.UIATK = ls_list.UIATK + "_1";
                ls_list.UIATY = "1";
            }

            ls_list.OBJID = it_tree[i].OBJID;

            var ls_0022 = oAPP.DATA.LIB.T_0022.find(function (a) { return a.UIOBK === it_tree[i].UIOBK; });

            ls_list.UIATV = ls_0023.DEFVL;                       //대상 프로퍼티 DEFAULT 값
            ls_list.UILIK = ls_0022 ? ls_0022.UILIK : "";        //UI Library Internal Key
            ls_list.UILIB = it_tree[i].UILIB;                    //LIBRARY 명
            ls_list.UIOBK = it_tree[i].UIOBK;                    //UI OBJECT KEY
            ls_list.POBID = it_tree[i].POBID;                    //부모 UI OBJECT ID
            ls_list.PUIOK = it_tree[i].PUIOK;                    //부모 UI OBJECT KEY
            T_LIST.push(ls_list);

            _collectSameAttr(is_attr, it_tree[i].zTREE, T_LIST);
        }
    }

    /************************************************************************
     * Change value 컨트롤 구성(원본 lf_setBindVal 값 컨트롤 분기) — 로컬 편집 전용.
     *   반환: DOM element. oState.field/oState.select 에 참조 저장(검증 표시/값 읽기).
     ************************************************************************/
    async function _buildValueControl(is_attr) {
        oState.field = null;
        oState.select = null;

        var l_UIATK = is_attr.UIATK;
        var l_UIATY = is_attr.UIATY;
        if (is_attr.UIATK.indexOf("_1") !== -1) { l_UIATK = is_attr.UIATK.replace("_1", ""); l_UIATY = "3"; }

        var ls_0023 = oAPP.DATA.LIB.T_0023.find(function (a) { return a.UIATK === l_UIATK && a.UIATY === l_UIATY; });

        var _ISLST = ls_0023 ? ls_0023.ISLST : "";
        oState.defvl = ls_0023 ? ls_0023.DEFVL : "";
        oState.islst = _ISLST;
        var aDDLB = null;

        //DDLB(enum) 구성 필요건.
        if (ls_0023 && ls_0023.ISLST === "X" && ls_0023.VALKY !== "") {
            aDDLB = oAPP.fn.attrSetDDLBList(ls_0023.VALKY, is_attr.UIATY);
            if (Array.isArray(aDDLB)) { aDDLB = aDDLB.slice(); aDDLB.splice(0, 0, { KEY: "", TEXT: "" }); }
        }

        //이벤트 라인 — 서버이벤트 DDLB(펼치기 없이 즉시 로드, 원본 getServerEventList).
        if (is_attr.UIATY === "2") {
            _ISLST = "X";
            oState.islst = "X";
            try {
                var aEvt = await oAPP.fn.getServerEventList(null, true);
                aDDLB = Array.isArray(aEvt) ? aEvt.slice() : [];
            } catch (e) {
                console.error("[HTML5][WS20][sameAttr] getServerEventList:", e && e.message);
                aDDLB = [{ KEY: "", TEXT: "" }];
            }
        }
        oState.ddlb = aDDLB;

        // (A) DDLB → 공통 Select.
        if (_ISLST === "X" && window.U4AUI && U4AUI.createSelect) {
            var aItems = [], bFound = false, sVal = oState.value != null ? oState.value : "";
            (aDDLB || []).forEach(function (d) {
                if (d.KEY === sVal) { bFound = true; }
                aItems.push({ value: d.KEY != null ? d.KEY : "", text: d.TEXT != null ? d.TEXT : "" });
            });
            if (!bFound) { aItems.unshift({ value: sVal, text: sVal }); }
            var SEL = U4AUI.createSelect(aItems, sVal, function (v) { oState.value = v; });
            oState.select = SEL;
            return SEL;
        }

        // (B) 일반 입력(+ 아이콘·컬러 F4) → 공통 createField.
        var bShowF4 = false;
        try {
            bShowF4 = (typeof oAPP.fn.attrIsIconProp === "function" && oAPP.fn.attrIsIconProp(is_attr) === true) ||
                (typeof oAPP.fn.attrIsColorProp === "function" && oAPP.fn.attrIsColorProp(is_attr) === true);
        } catch (e) { }

        var oFld = U4AUI.createField({
            type: "text",
            value: oState.value != null ? oState.value : "",
            readOnly: false,
            clear: true,
            onClear: function () { oState.value = ""; _onChangeValue(); },
            onChange: function (v) { oState.value = v; _onChangeValue(); },
            f4: bShowF4 ? function (oAnchor) { _callInputF4Help(is_attr, oAnchor); } : null,
            f4IconHtml: '<i class="fa-regular fa-clone"></i>',
            f4Disabled: false
        });
        oState.field = oFld;
        return oFld.el;
    }

    /* ── 입력값 변경(원본 setInputVal) — 불가값이면 DEFVL 로 되돌림(비-DDLB) ── */
    function _onChangeValue() {
        var is_attr = oState.attr;

        //숫자형은 숫자로 정규화.
        if (is_attr.UIATY === "1" && (is_attr.UIADT === "int" || is_attr.UIADT === "float")) {
            oState.value = String(Number(oState.value));
        }

        var ls_0015 = oAPP.fn.crtStru0015();
        oAPP.fn.moveCorresponding(is_attr, ls_0015);
        ls_0015.UIATV = oState.value;

        //정합성 점검 — chkValidProp(미리보기 frame[W2] 부재 시 예외 가능 → 가드, best-effort).
        var bValid = true;
        try {
            if (typeof oAPP.fn.chkValidProp === "function") { bValid = oAPP.fn.chkValidProp(ls_0015) !== false; }
        } catch (e) {
            console.error("[HTML5][WS20][sameAttr] chkValidProp 예외(통과 처리):", e && e.message);
        }

        //불가값 + DDLB 아닌 경우 → default 값으로 되돌림(원본 동일).
        if (!bValid && oState.islst !== "X") {
            oState.value = oState.defvl;
            if (oState.field && oState.field.input) { oState.field.input.value = oState.defvl != null ? oState.defvl : ""; }
        }
    }

    /* ── 입력 F4(원본 callInputF4Help) — 컬러/아이콘. 로컬 값에만 반영(모델 미변경) ── */
    function _callInputF4Help(is_attr, oAnchor) {
        //컬러 프로퍼티 → 컬러 피커(행과 동일 fnColorPickerOpen).
        var bColor = false;
        try { bColor = (typeof oAPP.fn.attrIsColorProp === "function" && oAPP.fn.attrIsColorProp(is_attr) === true); } catch (e) { }
        if (bColor) {
            var fnDone = function (sHex) {
                oState.value = sHex || "";
                if (oState.field && oState.field.input) { oState.field.input.value = oState.value; }
                _onChangeValue();
            };
            if (oAPP.fn.fnColorPickerOpen) { oAPP.fn.fnColorPickerOpen(oAnchor, oState.value, fnDone); }
            else { oAPP.loadJs("fnColorPickerPopover", function () { if (oAPP.fn.fnColorPickerOpen) { oAPP.fn.fnColorPickerOpen(oAnchor, oState.value, fnDone); } }); }
            return;
        }
        //아이콘 프로퍼티 → 콜백형 아이콘 선택기는 HTML5 미변환(fnIconListPopupOpener 는 콜백 없는 외부창).
        //  임의 대체 금지(원본에 없는 행위 방지) — 행의 미변환 F4 와 동일하게 경고만.
        console.warn("[W4+ 예정] 동일속성 동기화 아이콘 F4(callIconListPopup) 미변환:", is_attr.UIATT);
    }

    /************************************************************************
     * 확인 — 원본 lf_setSyncAttr 1:1. 선택 라인들에 입력값 일괄 동기화.
     ************************************************************************/
    function lf_setSyncAttr() {
        var is_attr = oState.attr;

        //확인 직전 텍스트 필드 최신값 확정(blur change 미발화 대비) → 검증 경유.
        if (oState.field && oState.field.input && oState.field.input.value !== oState.value) {
            oState.value = oState.field.input.value;
            _onChangeValue();
        }

        //선택 라인 인덱스 수집(oState.selected=원본 __idx 맵 — 정렬/필터로 숨은 선택도 포함).
        var aSel = Object.keys(oState.selected).map(function (k) { return parseInt(k, 10); });

        //선택 라인 없음 → 268(E), 유지.
        if (aSel.length === 0) {
            //268 Selected line does not exists.
            _toast("E", _msgM("268"));
            return;
        }

        try { parent.setBusy && parent.setBusy("X"); } catch (e) { }
        try { oAPP.fn.setShortcutLock && oAPP.fn.setShortcutLock(true); } catch (e) { }

        //★ UNDO 정확성(필수): fnWs20PushUndo 의 스냅샷(_snapshot)은 "그 시점 oAPP.attr.prev 에
        //  이미 존재하는 OBJID 키"의 _T_0015 만 담고, 되돌리기(_restoreSnap)는 그 담긴 키만 복원한다.
        //  동기화 대상(선택 안 된 타겟)·소스가 아직 prev 에 없으면(lazy 미생성) 스냅샷에서 빠지고,
        //  이후 동기화가 새로 만든 값은 UNDO 시 "지울 키"에 없어 그대로 남는다(= 복원 안 됨).
        //  → 스냅샷 "직전"에 소스+대상 OBJID 의 prev._T_0015 를 먼저 ensure 해, 변경 직전(빈/기존)
        //    상태가 스냅샷에 캡처되게 한다. 그러면 UNDO 가 그 키를 원상(빈/기존)으로 정확히 되돌린다.
        function _ensurePrev15(sObjid) {
            if (!sObjid) { return; }
            oAPP.attr.prev = oAPP.attr.prev || {};
            oAPP.attr.prev[sObjid] = oAPP.attr.prev[sObjid] || {};
            if (!Array.isArray(oAPP.attr.prev[sObjid]._T_0015)) { oAPP.attr.prev[sObjid]._T_0015 = []; }
        }
        _ensurePrev15(is_attr.OBJID);
        for (var iP = 0; iP < aSel.length; iP++) {
            var oPreLine = oState.list[aSel[iP]];
            if (oPreLine) { _ensurePrev15(oPreLine.OBJID); }
        }

        //★ UNDO: 대상+소스 전체를 한 단위로 — 변경 "직전" 상태를 1회만 적재.
        // [BR59-4] 되돌리기 대상 = 값이 바뀌는 그 UI 와 그 속성 줄(원본 CL_CHANGE_ATTR 2278 기준).
        try { if (typeof oAPP.fn.fnWs20PushUndo === "function") { oAPP.fn.fnWs20PushUndo(is_attr && is_attr.OBJID ? { OBJID: is_attr.OBJID, UIATK: is_attr.UIATK || "" } : undefined); } }
        catch (e) { console.warn("[HTML5][WS20][sameAttr] undo push skip:", e && e.message); }

        try {
            var l_UIATV = oState.value;

            for (var i = 0, l = aSel.length; i < l; i++) {
                var ls_line = oState.list[aSel[i]];
                if (!ls_line) { continue; }

                var l_UIATK = ls_line.UIATK;
                var l_UIATY = ls_line.UIATY;
                if (is_attr.UIATK.indexOf("_1") !== -1) { l_UIATK = is_attr.UIATK.replace("_1", ""); l_UIATY = "3"; }

                var ls_0023 = oAPP.DATA.LIB.T_0023.find(function (a) { return a.UIATK === l_UIATK && a.UIATY === l_UIATY; });
                if (!ls_0023) { continue; }

                //대상 UI 의 prev._T_0015 보장(HTML5 lazy 생성 가드).
                oAPP.attr.prev = oAPP.attr.prev || {};
                oAPP.attr.prev[ls_line.OBJID] = oAPP.attr.prev[ls_line.OBJID] || {};
                var aTgt = oAPP.attr.prev[ls_line.OBJID]._T_0015 = oAPP.attr.prev[ls_line.OBJID]._T_0015 || [];

                var _pos = aTgt.findIndex(function (a) { return a.UIATK === ls_line.UIATK && a.UIATY === ls_line.UIATY; });
                var ls_0015 = aTgt[_pos];

                //기존 수집건 존재.
                if (ls_0015) {
                    //바인딩건 skip.
                    if (ls_0015.ISBND === "X") { continue; }

                    //입력값이 default → 수집건 제거 + 미리보기 반영.
                    if (ls_0023.DEFVL === l_UIATV) {
                        aTgt.splice(_pos, 1);
                        //★ 미리보기를 "기본값(DEFVL)" 으로 리셋. 원본은 splice 한 옛 값 라인을 그대로
                        //  previewUIsetProp 에 넘겨(setter 가 옛 값 재적용) 미리보기가 기본값으로 안
                        //  돌아가던 것 → ls_0015(이미 배열서 제거돼 안전)의 UIATV 를 DEFVL 로 바꿔 넘긴다.
                        //  (소스 BUTTON 은 is_attr.UIATV=Default 로 이미 리셋되나, 동기화 타겟이 옛 값에
                        //   남던 비대칭 증상 수정.)
                        ls_0015.UIATV = ls_0023.DEFVL;
                        _preview(ls_0015);
                        continue;
                    }

                    ls_0015.UIATV = l_UIATV;
                    //공백값 + default 존재 → 공백입력 flag.
                    if (ls_0015.UIATV === "" && ls_0023.DEFVL !== "") { ls_0015.ISSPACE = "X"; }
                    _preview(ls_0015);
                    continue;
                }

                //입력값 == default → 신규 수집 skip.
                if (ls_0023.DEFVL === l_UIATV) { continue; }

                //신규 라인 생성.
                var ls_new = oAPP.fn.crtStru0015();
                oAPP.fn.moveCorresponding(ls_line, ls_new);
                ls_new.UIATV = l_UIATV;
                if (ls_new.UIATV === "" && ls_0023.DEFVL !== "") { ls_new.ISSPACE = "X"; }
                aTgt.push(ls_new);
                _preview(ls_new);
            }

            //소스 속성 값 반영.
            is_attr.UIATV = l_UIATV;

            //이벤트건 — 구성한 서버이벤트 DDLB 를 소스에도 반영(원본 동일).
            if (is_attr.UIATY === "2" && Array.isArray(oState.ddlb)) {
                is_attr.T_DDLB = JSON.parse(JSON.stringify(oState.ddlb));
            }

            //소스 커밋 + 속성패널 refresh(undo 재-push 금지 = bSkipUndo true).
            oAPP.fn.fnWs20AttrChange(is_attr, "", true);
        } catch (e) {
            console.error("[HTML5][WS20][sameAttr] 동기화 처리 오류:", e && e.message, e);
        } finally {
            try { oAPP.fn.setShortcutLock && oAPP.fn.setShortcutLock(false); } catch (e) { }
            try { parent.setBusy && parent.setBusy(""); } catch (e) { }
        }

        //닫기(취소 안내 생략) → 성공 토스트.
        lf_close(true);
        //005 Job finished.
        _toast("S", _msgM("005"));
    }

    /* ── 컬럼 정렬/필터 (원본 sap.ui.table sortProperty/filterProperty → §16 6.2 서버리스트 패턴) ──
     *   원본 배열(oState.list)은 보존, 화면 뷰만 필터→정렬로 파생(비파괴). 선택은 원본 인덱스(__idx)로 유지. */
    function _cellText(k, row) { var v = row ? row[k] : ""; return v == null ? "" : String(v); }
    function _deriveView() {
        var arr = oState.list.slice();
        var aKeys = Object.keys(oState.colFilters).filter(function (k) { return oState.colFilters[k]; });
        if (aKeys.length) {
            arr = arr.filter(function (row) {
                return aKeys.every(function (k) { return _cellText(k, row).toLowerCase().indexOf(oState.colFilters[k]) !== -1; });
            });
        }
        if (oState.sortKey) {
            var d = oState.sortDir === "desc" ? -1 : 1;
            arr.sort(function (a, b) {
                return _cellText(oState.sortKey, a).localeCompare(_cellText(oState.sortKey, b), undefined, { numeric: true }) * d;
            });
        }
        return arr;
    }
    // 공통 컬럼 메뉴 컨트롤러(상태=oState — 모듈 전역이라 열 때마다 최신 oState 참조).
    var _colCtl = {
        getFilter: function (k) { return oState.colFilters[k] || ""; },
        setFilter: function (k, v) { if (v) { oState.colFilters[k] = v; } else { delete oState.colFilters[k]; } },
        getSort: function () { return oState.sortKey ? { key: oState.sortKey, dir: oState.sortDir } : null; },
        setSort: function (k, d) { oState.sortKey = k; oState.sortDir = d; },
        rerender: function () { _renderList(); }
    };
    function _openColMenu(c, th) {
        if (window.U4AUI && U4AUI.openColumnMenu) {
            //showModal 다이얼로그(top-layer) 안에 메뉴를 붙여야 모달 위로 뜬다.
            U4AUI.openColumnMenu(c, th, _colCtl, {
                container: oUI.dlg,
                labels: { filter: _msgC("A68"), asc: _wsC("810"), desc: _wsC("811"), clear: _msgC("A69") }
            });
        }
    }

    // 헤더 행(체크박스 전체선택 + 데이터 컬럼) — 정렬/필터 표시자 갱신 위해 매 렌더 재구성.
    function _renderHead() {
        var oTr = oUI.theadRow;
        oTr.innerHTML = "";

        //전체선택 체크박스 th(선택 컬럼은 정렬/필터 없음 — 원본 selection 컬럼과 동일).
        var oThChk = _el("th", "u4aSaColChk");
        var oHeadChk = document.createElement("input");
        oHeadChk.type = "checkbox";
        oHeadChk.className = "u4aSaHeadChk";
        oHeadChk.addEventListener("change", function () {
            var b = oHeadChk.checked;
            oUI.tbody.querySelectorAll(".u4aSaRowChk").forEach(function (c) {
                c.checked = b;
                var idx = parseInt(c.getAttribute("data-idx"), 10);
                if (b) { oState.selected[idx] = true; } else { delete oState.selected[idx]; }
                var tr = c.closest("tr");
                if (tr) { tr.setAttribute("aria-selected", b ? "true" : "false"); }
            });
            _syncHeadChk();
        });
        oThChk.appendChild(oHeadChk);
        oTr.appendChild(oThChk);
        oUI.headChk = oHeadChk;

        //데이터 컬럼 th — 정렬/필터 메뉴(원본 sortProperty/filterProperty).
        C_COLS.forEach(function (c) { oTr.appendChild(_buildTh(c)); });
    }
    function _buildTh(c) {
        var th = document.createElement("th");
        var inner = _el("div", "u4a-th__inner");
        inner.appendChild(_el("span", "u4a-th__label", _msgC(c.msg)));
        var bSorted = oState.sortKey === c.key, bFiltered = !!oState.colFilters[c.key];
        if (bSorted || bFiltered) {
            var ind = _el("span", "u4a-th__ind");
            if (bSorted) { ind.innerHTML += _fa(oState.sortDir === "desc" ? "arrow-down" : "arrow-up"); }
            if (bFiltered) { ind.innerHTML += _fa("filter"); }
            inner.appendChild(ind);
        }
        th.appendChild(inner);
        th.classList.add("u4a-th--menu");
        th.addEventListener("click", function (e) { e.stopPropagation(); _openColMenu(c, th); });
        return th;
    }

    /************************************************************************
     * 대상 목록 테이블 렌더(멀티선택 + 정렬/필터 파생 뷰). 선택=oState.selected(원본 __idx 기준).
     ************************************************************************/
    function _renderList() {
        if (!oUI || !oUI.tbody) { return; }
        _renderHead();

        var oTbody = oUI.tbody;
        oTbody.innerHTML = "";

        var aView = _deriveView();

        if (!aView.length) {
            var oTrE = _el("tr", "u4a-table__nodata");
            var oTdE = document.createElement("td");
            oTdE.colSpan = C_COLS.length + 1;
            oTdE.textContent = _wsC("946");   // 데이터 없음(공통)
            oTrE.appendChild(oTdE);
            oTbody.appendChild(oTrE);
            _syncHeadChk();
            return;
        }

        aView.forEach(function (o, iView) {
            var iIdx = o.__idx;               // 원본 인덱스(선택키 — 정렬/필터에도 불변)
            var bSel = !!oState.selected[iIdx];

            var oTr = document.createElement("tr");
            oTr.setAttribute("data-idx", String(iIdx));
            if (iView % 2 === 1) { oTr.setAttribute("data-odd", "true"); }
            if (bSel) { oTr.setAttribute("aria-selected", "true"); }

            //(1) 선택 체크박스.
            var oTdChk = _el("td", "u4aSaColChk");
            var oChk = document.createElement("input");
            oChk.type = "checkbox";
            oChk.className = "u4aSaRowChk";
            oChk.setAttribute("data-idx", String(iIdx));
            oChk.checked = bSel;
            oChk.addEventListener("change", function () {
                if (oChk.checked) { oState.selected[iIdx] = true; } else { delete oState.selected[iIdx]; }
                oTr.setAttribute("aria-selected", oChk.checked ? "true" : "false");
                _syncHeadChk();
            });
            oTdChk.appendChild(oChk);
            oTr.appendChild(oTdChk);

            //(2)~(7) 데이터 셀(선택·복사 가능 표면).
            C_COLS.forEach(function (c) {
                var v = o[c.key];
                var oTd = _el("td", "u4a-selectable", v != null ? String(v) : "");
                oTd.title = v != null ? String(v) : "";
                oTr.appendChild(oTd);
            });

            //행 클릭(체크박스 외) → 선택 토글(편의, 원본 selectionBehavior:"Row").
            oTr.addEventListener("click", function (ev) {
                if (ev.target && ev.target.closest && ev.target.closest(".u4aSaColChk")) { return; }
                oChk.checked = !oChk.checked;
                if (oChk.checked) { oState.selected[iIdx] = true; } else { delete oState.selected[iIdx]; }
                oTr.setAttribute("aria-selected", oChk.checked ? "true" : "false");
                _syncHeadChk();
            });

            oTbody.appendChild(oTr);
        });

        _syncHeadChk();
    }

    //헤더 전체선택 상태 동기화(현재 보이는 행 기준).
    function _syncHeadChk() {
        if (!oUI || !oUI.headChk) { return; }
        var aChk = oUI.tbody.querySelectorAll(".u4aSaRowChk");
        var iTotal = aChk.length, iSel = 0;
        aChk.forEach(function (c) { if (c.checked) { iSel++; } });
        oUI.headChk.checked = (iTotal > 0 && iSel === iTotal);
        oUI.headChk.indeterminate = (iSel > 0 && iSel < iTotal);
        oUI.headChk.disabled = (iTotal === 0);
    }

    /************************************************************************
     * 다이얼로그 1회 생성(이후 재사용).
     ************************************************************************/
    function lf_build() {
        lf_ensureStyle();

        var oDlg = document.createElement("dialog");
        oDlg.id = C_DLG_ID;
        //u4a-compact = 원본 addStyleClass("sapUiSizeCompact") 밀도(하위 컨트롤·행높이 축소, rowHeight:30 대응).
        oDlg.className = "u4a-dialog u4aSaDlg u4a-compact";

        // 헤더 — paste 아이콘 + 제목(A80 Property replace all) + 닫기 X.
        var oHeader = _el("div", "u4a-dialog__header");
        oHeader.innerHTML = _fa("paste") + "<span></span>";
        oHeader.querySelector("span").textContent = _msgC("A80");
        var oXBtn = _el("button", "u4a-btn-icon");
        oXBtn.type = "button";
        oXBtn.innerHTML = _fa("xmark");
        oXBtn.title = _msgC("A39");   // Close
        oXBtn.addEventListener("click", function () { lf_close(); });
        oHeader.appendChild(oXBtn);
        oDlg.appendChild(oHeader);

        // 바디 — [선택 UI 정보] + [대상 목록 테이블].
        var oBody = _el("div", "u4a-dialog__body u4aSaBody");

        // (1) Selected UI Object Info — 원본 sap.m.Panel(expandable:true, expanded:true) →
        //     공통 접이식 패널 U4AUI.createPanel(F4 팝업 '검색조건'과 동일 선례). 트위스티=펼침표시.
        var oPanel = (window.U4AUI && U4AUI.createPanel)
            ? U4AUI.createPanel({ title: _wsC("060") })   // Selected UI Object Info
            : null;
        var oInfoBody = oPanel ? oPanel.body : _el("div", "u4aSaInfoFallback");
        if (oPanel) { oPanel.el.classList.add("u4aSaInfoPanel"); }
        oUI.infoPanel = oPanel;

        // 정보 4행: UI Object ID / Attribute ID / Attribute Type / Change value.
        function _infoRow(sLabel) {
            var oRow = _el("div", "u4a-form__row u4aSaRow");
            var oLbl = _el("div", "u4a-label u4aSaLbl", sLabel);
            oRow.appendChild(oLbl);
            var oVal = _el("div", "u4aSaVal");
            oRow.appendChild(oVal);
            oInfoBody.appendChild(oRow);
            return oVal;
        }
        oUI.valObjid = _infoRow(_msgC("A84"));   // UI Object ID
        oUI.valObjid.classList.add("u4a-selectable");
        oUI.valUiatt = _infoRow(_msgC("A81"));   // Attribute ID
        oUI.valUiatt.classList.add("u4a-selectable");
        oUI.valUiadt = _infoRow(_msgC("A82"));   // Attribute Type
        oUI.valUiadt.classList.add("u4a-selectable");
        oUI.valRow = _el("div", "u4a-form__row u4aSaRow u4aSaValRow");
        oUI.valRow.appendChild(_el("div", "u4a-label u4aSaLbl", _msgC("A83")));   // Change value
        oUI.valWrap = _el("div", "u4aSaCtl");
        oUI.valRow.appendChild(oUI.valWrap);
        oInfoBody.appendChild(oUI.valRow);

        oBody.appendChild(oPanel ? oPanel.el : oInfoBody);

        // (2) Target Replace Properties.
        var oList = _el("section", "u4aSaList");
        var oListH = _el("div", "u4aSaSecHead");
        oListH.textContent = "▶ " + _wsC("061");   // Target Replace Properties
        oList.appendChild(oListH);

        var oWrap = _el("div", "u4a-table-wrap u4a-table-wrap--boxed u4aSaTableWrap");
        oWrap.setAttribute("data-view", "table");
        var oTable = _el("table", "u4a-table u4aSaTable");

        //헤더 행은 비워두고 _renderHead 가 매 렌더 재구성(정렬/필터 표시자 갱신).
        var oThead = document.createElement("thead");
        oUI.theadRow = document.createElement("tr");
        oThead.appendChild(oUI.theadRow);
        oTable.appendChild(oThead);
        var oTbody = document.createElement("tbody");
        oTable.appendChild(oTbody);
        oWrap.appendChild(oTable);
        oList.appendChild(oWrap);
        oBody.appendChild(oList);

        oDlg.appendChild(oBody);

        // 푸터 — [확인 A40 파랑] [취소 A41 빨강] : 원본처럼 아이콘+텍스트.
        var oFoot = _el("div", "u4a-dialog__footer u4aSaFoot");
        oFoot.appendChild(_el("span", "u4aSaFootSpacer"));
        var oConfirm = _el("button", "u4a-btn u4a-btn--emphasized u4aSaBtn");
        oConfirm.type = "button";
        oConfirm.innerHTML = _fa("check") + "<span></span>";
        oConfirm.querySelector("span").textContent = _msgC("A40");   // Confirm
        oConfirm.addEventListener("click", function () { lf_setSyncAttr(); });
        var oCancel = _el("button", "u4a-btn u4a-btn--negative u4aSaBtn");
        oCancel.type = "button";
        oCancel.innerHTML = _fa("xmark") + "<span></span>";
        oCancel.querySelector("span").textContent = _msgC("A41");   // Cancel
        oCancel.addEventListener("click", function () { lf_close(); });
        oFoot.appendChild(oConfirm);
        oFoot.appendChild(oCancel);
        oDlg.appendChild(oFoot);

        // ESC → 취소.
        oDlg.addEventListener("cancel", function (e) { e.preventDefault(); lf_close(); });

        if (window.U4AUI && U4AUI.makeDialogRecenter) { U4AUI.makeDialogRecenter(oDlg, oHeader); }
        if (window.U4AUI && U4AUI.makeDialogResizable) { U4AUI.makeDialogResizable(oDlg, { minW: 520, minH: 380 }); }

        document.body.appendChild(oDlg);

        oUI.dlg = oDlg;
        oUI.tbody = oTbody;
        //oUI.headChk / oUI.theadRow 는 _renderHead 가 매 렌더 채운다.
    }

    /************************************************************************
     * 공개 진입점 — M03(동일 속성 동기화) 다이얼로그 열기.
     *   @param {object} is_attr - WS20 속성 행(선택 속성).
     ************************************************************************/
    oAPP.fn.fnSameAttrSyncPopupOpen = async function (is_attr) {

        if (!is_attr) { try { oAPP.common.fnSetBusyLock(""); } catch (e) { } return; }

        //대상 수집 — 트리 전체에서 동일 속성 검색.
        var lt_list = [];
        try {
            var aRoot = oAPP.attr.oModel.oData.zTREE;
            if (aRoot && aRoot[0]) { _collectSameAttr(is_attr, aRoot[0].zTREE, lt_list); }
        } catch (e) {
            console.error("[HTML5][WS20][sameAttr] 대상 수집 오류:", e && e.message, e);
        }

        //동일 속성 없음 → 055(W) + 잠금 해제(원본 동일).
        if (lt_list.length === 0) {
            //055 Processing does not exist.
            _toast("W", _msgM("055"));
            try { oAPP.fn.setShortcutLock && oAPP.fn.setShortcutLock(false); } catch (e) { }
            try { parent.setBusy && parent.setBusy(""); } catch (e) { }
            try { oAPP.common.fnSetBusyLock(""); } catch (e) { }
            return;
        }

        //다이얼로그 최초 생성(DOM 이탈 시 재생성).
        if (!oUI || !oUI.dlg || !document.body.contains(oUI.dlg)) { oUI = {}; lf_build(); }
        if (oUI.dlg.open) { try { oAPP.common.fnSetBusyLock(""); } catch (e) { } return; }

        //원본 인덱스 태깅(__idx) — 정렬/필터로 뷰 순서가 바뀌어도 선택을 원본 기준으로 유지.
        lt_list.forEach(function (o, i) { o.__idx = i; });

        //상태 초기화.
        oState = {
            attr: is_attr,
            list: lt_list,
            value: is_attr.UIATV != null ? is_attr.UIATV : "",
            ddlb: null, islst: "", defvl: "", field: null, select: null,
            sortKey: null, sortDir: null, colFilters: {}, selected: {}   // 정렬/필터/선택(원본 __idx 맵)
        };

        //선택 UI 정보 채우기.
        oUI.valObjid.textContent = is_attr.OBJID != null ? is_attr.OBJID : "";
        oUI.valUiatt.textContent = is_attr.UIATT != null ? is_attr.UIATT : "";
        oUI.valUiadt.textContent = is_attr.UIADT != null ? is_attr.UIADT : "";

        //Change value 컨트롤 구성(이벤트건은 서버이벤트 로드 await).
        oUI.valWrap.innerHTML = "";
        var oCtl = await _buildValueControl(is_attr);
        oCtl.classList.add("u4aSaCtlEl");
        oUI.valWrap.appendChild(oCtl);

        //대상 목록 렌더.
        _renderList();

        try { oUI.dlg.showModal(); } catch (e) { }

        //단축키 잠금 해제 + busy off(원본 afterOpen/lf_setBindVal 말미).
        try { oAPP.fn.setShortcutLock && oAPP.fn.setShortcutLock(false); } catch (e) { }
        try { parent.setBusy && parent.setBusy(""); } catch (e) { }
        try { oAPP.common.fnSetBusyLock(""); } catch (e) { }
    };

    /************************************************************************
     * 공통 스타일 1회 주입(테마 토큰만 — 하드코딩 색 없음).
     ************************************************************************/
    function lf_ensureStyle() {
        if (document.getElementById("u4aSaStyle")) { return; }
        var oStyle = document.createElement("style");
        oStyle.id = "u4aSaStyle";
        oStyle.textContent =
            ".u4aSaDlg { width: min(94vw, 860px); height: min(88vh, 620px); padding: 0; display: flex; flex-direction: column; }" +
            ".u4aSaDlg .u4a-dialog__header { cursor: move; user-select: none; }" +
            ".u4aSaDlg .u4a-dialog__header span { flex: 1 1 auto; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }" +
            // 바디 = 정보 섹션 + 목록 섹션 세로 스택. 목록이 남은 높이 흡수.
            ".u4aSaBody { flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; gap: 0.75rem; padding: 0.75rem; }" +
            ".u4aSaSecHead { font-weight: 600; color: var(--text); margin-bottom: 0.375rem; }" +
            // 정보 = 공통 접이식 패널(원본 sap.m.Panel expandable). 패널은 남은높이 흡수 금지(내용만).
            ".u4aSaInfoPanel { flex: 0 0 auto; }" +
            ".u4aSaInfoPanel .u4a-panel__body { display: flex; flex-direction: column; gap: 0.25rem; }" +
            ".u4aSaInfoFallback { flex: 0 0 auto; display: flex; flex-direction: column; gap: 0.25rem; }" +
            // 정보 행 — 라벨:값 2열 그리드(라벨 폭 고정).
            ".u4aSaRow { display: grid; grid-template-columns: minmax(9rem, 14rem) 1fr; align-items: center; gap: 0.5rem; position: relative; }" +
            ".u4aSaLbl { font-weight: 600; }" +
            ".u4aSaVal { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--text); }" +
            ".u4aSaValRow { align-items: start; }" +
            ".u4aSaCtl { min-width: 0; }" +
            ".u4aSaCtlEl { width: 100%; }" +
            // 목록 섹션 — 테이블이 남은 높이 흡수 + 스크롤.
            ".u4aSaList { flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; }" +
            ".u4aSaTableWrap { flex: 1 1 auto; }" +
            ".u4aSaColChk { width: 2.5rem; text-align: center; }" +
            ".u4aSaColChk input { accent-color: var(--accent); margin: 0; vertical-align: middle; }" +
            // 원본 sap.ui.table 은 컬럼 width 미지정 = 콘텐츠 기반(고정 균등분할 아님). 공통 .u4a-table 는
            //   table-layout:fixed(균등)라 긴 한글 헤더가 좁은 컬럼에서 …로 잘린다 → 이 표만 auto 로 되돌려
            //   컬럼이 라벨/값 폭에 맞춰지고(잘림 없음), 넘치면 boxed 래퍼가 가로 스크롤(원본과 동일 거동).
            ".u4aSaTable { table-layout: auto; }" +
            ".u4aSaTable th, .u4aSaTable td { white-space: nowrap; }" +
            // 헤더 라벨은 축약(…) 하지 말고 전체 표시 — 컬럼이 라벨 폭까지 늘어난다.
            ".u4aSaTable th .u4a-th__label { overflow: visible; text-overflow: clip; }" +
            ".u4aSaTable td::before, .u4aSaTable td::after { content: none !important; }" +
            // 푸터 — 아이콘+텍스트(원본 확인/취소).
            ".u4aSaFoot { display: flex; gap: 0.5rem; align-items: center; }" +
            ".u4aSaFootSpacer { flex: 1 1 auto; }" +
            ".u4aSaBtn { display: inline-flex; align-items: center; gap: 0.375rem; }";
        document.head.appendChild(oStyle);
    }

})(window, jQuery, oAPP);
