/************************************************************************
 * Copyright 2020. INFOCG Inc. all rights reserved.
 * ----------------------------------------------------------------------
 * - file Name : fnImageCompressPopupOpen.js
 * - file Desc : WS20 속성 "imageCompressSettings"(파일 올리기 UI) 이미지 압축 설정 Popup (HTML5)
 * ----------------------------------------------------------------------
 * [컨버전 메모]
 *  원본: design/attributesArea/imageCompress.js (export default async function(sAttr))
 *        호출 경로 = 속성 값칸 버튼 press(uiAttributeArea.js 1523행 attrChange(_sAttr,"BUTTON"))
 *          → attrChange 1840행 attrChangeException.js
 *          → 코드마스터 UW13 에서 이 속성(FLD01)의 모듈 경로(FLD04+FLD05 = "./imageCompress.js") 를 얻어 import
 *          → default(sAttr) 실행.
 *        (실측 2026-08-31: UW13 에 파일올리기 2종 + 올린파일목록 1종 = 3줄 모두 같은 모듈 지정.)
 *
 *  원본 화면(imageCompress.js _getSettingUiInfo):
 *        sap.m.Panel(expandable/expanded)
 *          headerToolbar : Title(503) + Switch(state:/settings/enabled)
 *          content : GridList
 *            item1 : Label(504, design:Bold) + Switch(state:/settings/enabled)   ← 헤더 스위치와 같은 값
 *            item2 : Label(505, design:Bold) + Input(type Number, width 60px, value:/settings/quality,
 *                    valueState/valueStateText) + Slider(min 0.01 / max 1 / step 0.01,
 *                    showAdvancedTooltip · inputsAsTooltips)
 *        dialogViewer 옵션 : title 506 / width 30% / height 20% / draggable / resizable /
 *                    disableMaximize / showHelpDocButton(u4aHelpDocMenuID "000268")
 *        actions : OK(Accept, visible:IS_EDIT, text 232) / CANCEL(Reject, text 003 · 조회면 056)
 *
 *  ★ 보존 로직(원본 1:1):
 *    · 열 때 UIATV 를 JSON 으로 읽고, 없는 항목은 기본값(enabled=false / quality=0.5)으로 채움(원본 61~68행).
 *    · Apply : _checkSettingData 3분기(빈값 / 숫자아님 / 0.01~1 밖) → 오류면 입력칸 오류표시 +
 *      showMessage(20,"E") 후 중단(창 유지). 오류 문구는 원본이 메시지 클래스가 아닌 한글 문장을
 *      직접 들고 있어 그대로 사용한다(원본 213·227·241행). ★보고 사항.
 *    · 통과 시 quality 를 숫자로 변환(원본 158행) → 설정이 전부 기본값과 같으면 UIATV 를 비우고,
 *      하나라도 다르면 JSON 문자열로 저장(원본 162~178행).
 *    · 저장 후 창 닫기 → attrChangeProc(sAttr, undefined, false, true) → updateBindPopupDesignData()
 *      (원본 180~189행). HTML5 는 값 반영 공통 처리 fnWs20AttrChange 로 대응하며, 되돌리기 이력은
 *      버튼 누를 때 이미 쌓였으므로 생략(bSkipUndo)·전용 예외처리 갈래도 생략(bSkipAttrExc)한다.
 *    · Cancel/X/ESC : 아무것도 반영하지 않고 닫기(원본 ACTCD "CANCEL" 118~128행).
 *    · 조회(편집 불가) 상태 : Apply 숨김 + 스위치/입력칸/미는 막대 비활성 + 취소 글자가 "닫기"(056).
 *
 *  HTML5: native <dialog class="u4a-dialog"> + 공통 자산(U4AUI.createPanel · createField ·
 *        .u4a-switch · .u4a-btn · makeDialogRecenter/Resizable · 전역 헤더드래그).
 *        미는 막대는 공통 부품이 없어 브라우저 기본 막대 + 강조색으로 구성(ws_html5_ws20_edit.js
 *        "위치 이동" 창 전례와 동일 방식). 공통 파일 미수정 — 화면 스코프 주입 스타일만 사용.
 ************************************************************************/

(function (window, $, oAPP) {
    "use strict";

    var APPCOMMON = oAPP.common;

    var C_DLG_ID = "u4aImgCompDlg";

    // 원본 dialogViewer u4aHelpDocMenuID.
    var C_HELP_MENU_ID = "000268";

    // 원본 CS_DEFAULT — 이미지 압축 관련 기본 설정값.
    var C_DEFAULT = { enabled: false, quality: 0.5 };

    // 원본 C_MIN_QUALITY / C_MAX_QUALITY.
    var C_MIN_QUALITY = 0.01;
    var C_MAX_QUALITY = 1;

    // 원본 _checkSettingData 가 들고 있는 오류 문구(메시지 클래스 아님 — 원본 그대로).
    var C_ERR_QUALITY = "잘못된 값을 입력했습니다. 이미지 품질의 입력 허용값은 0.01 ~ 1 입니다.";

    // ── 로컬 헬퍼(다른 속성 팝업들과 동일 컨벤션) ──────────────────────
    function _fa(s) { return '<i class="fa-solid fa-' + s + '"></i>'; }
    function _wsTxt(sCode) {
        // 공통 메시지(ZMSG_WS_COMMON_001) — 워크스페이스 언어 기준(원본 동일).
        try {
            var L = (parent.getUserInfo && parent.getUserInfo().LANGU) || "";
            return parent.WSUTIL.getWsMsgClsTxt(L, "ZMSG_WS_COMMON_001", sCode, "") || "";
        } catch (e) { return ""; }
    }
    function _el(sTag, sClass, sText) {
        var o = document.createElement(sTag);
        if (sClass) { o.className = sClass; }
        if (typeof sText !== "undefined") { o.textContent = sText; }
        return o;
    }
    function _isEdit() {
        //원본 oAPP.attr.oModel.oData.IS_EDIT 대응(문서 편집 가능 여부).
        try { var o = APPCOMMON.fnGetModelProperty("/WS20/APP"); return !!(o && o.IS_EDIT === "X"); }
        catch (e) { return false; }
    }

    // 단일 캐시 + 현재 컨텍스트(여는 쪽이 넘긴 WS20 속성 행).
    var oUI = null;
    var oCtx = { attr: null, settings: null };

    // 닫기 = close() 만. DOM 제거는 공통(u4a-ui.js)이 .u4a-dialog 전역으로 처리.
    function lf_close() {
        try { if (oUI && oUI.dlg && oUI.dlg.open) { oUI.dlg.close(); } } catch (e) { }
    }

    /************************************************************************
     * 입력값 점검 — 원본 _checkSettingData(196~250행) 1:1.
     *   @returns {object} { RETCD:""|"E", RTMSG:"" }
     ************************************************************************/
    function lf_checkSettingData(sSetting) {

        var _sRes = { RETCD: "", RTMSG: "" };

        //input에 잘못된 값을 입력하여 데이터가 없는경우.
        if (sSetting.quality === "") {
            _sRes.RETCD = "E";
            _sRes.RTMSG = C_ERR_QUALITY;
            return _sRes;
        }

        //품질 입력값 숫자 형식으로 변환.
        var _quality = Number(sSetting.quality);

        //숫자 이외의 값을 입력한 경우.
        if (isNaN(_quality)) {
            _sRes.RETCD = "E";
            _sRes.RTMSG = C_ERR_QUALITY;
            return _sRes;
        }

        //0.01 ~ 1의 범위값을 벗어난 값을 입력한 경우.
        if (_quality < C_MIN_QUALITY || _quality > C_MAX_QUALITY) {
            _sRes.RETCD = "E";
            _sRes.RTMSG = C_ERR_QUALITY;
            return _sRes;
        }

        return _sRes;
    }

    /************************************************************************
     * Apply(원본 OK 액션 콜백 131~189행).
     ************************************************************************/
    function lf_apply() {

        //편집 가능할 때만(원본 OK visible=IS_EDIT). 방어적으로 한 번 더 검사.
        if (!_isEdit() || !oCtx.attr) { lf_close(); return; }

        //이미지 압축 설정값 얻기(원본 143행).
        var _sSetting = {
            enabled: !!(oUI.swBody && oUI.swBody.checked),
            quality: oUI.qty ? oUI.qty.getValue() : ""
        };

        //setting 입력값 점검(원본 147행).
        var _sRes = lf_checkSettingData(_sSetting);

        //입력값 점검 오류가 존재하는경우(원본 150~162행) — 오류표시 + 메시지 후 중단.
        if (_sRes.RETCD === "E") {
            try { oUI.qty.setValueState("error", _sRes.RTMSG); } catch (e) { }
            try { parent.showMessage(null, 20, "E", _sRes.RTMSG); } catch (e) { }
            try { oUI.qty.focus(); } catch (e) { }
            return;
        }

        //오류표시 해제(원본은 valueSt 를 통째로 초기화한 결과와 동일).
        try { oUI.qty.setValueState("none", ""); } catch (e) { }

        //품질 숫자유형으로 변경(원본 158행).
        _sSetting.quality = Number(_sSetting.quality);

        //기존 기본값과 비교하여 변경 여부 확인(원본 164~172행).
        var _changed = false;
        for (var key in _sSetting) {
            if (_sSetting[key] !== C_DEFAULT[key]) { _changed = true; break; }
        }

        //변경된 설정값이 없으면 UIATV 초기화, 있으면 JSON 문자열로 저장(원본 175~180행).
        if (_changed === false) {
            oCtx.attr.UIATV = "";
        } else {
            oCtx.attr.UIATV = JSON.stringify(_sSetting);
        }

        lf_close();

        //원본 attrChangeProc(sAttr, undefined, false, true) 대응 — HTML5 공통 값반영 처리.
        //  되돌리기 이력은 버튼 누를 때 이미 쌓였고(원본도 attrChange 진입부에서 1회),
        //  전용 예외처리 갈래는 다시 타지 않는다(원본 attrChangeProc 에는 그 갈래가 없다).
        try { oAPP.fn.fnWs20AttrChange(oCtx.attr, undefined, true, true, true); }
        catch (e) { console.error("[HTML5][WS20][ImageCompress] attr 변경 처리 오류:", e && e.message); }

        //바인딩 팝업의 디자인 영역 갱신처리(원본 188행).
        if (typeof oAPP.fn.updateBindPopupDesignData === "function") {
            try { oAPP.fn.updateBindPopupDesignData(); }
            catch (e) { console.error("[HTML5][WS20][ImageCompress] 바인딩 팝업 갱신 오류:", e && e.message); }
        }
    }

    /************************************************************************
     * 압축 켜기/끄기 스위치 2개(상자 머리줄 · 항목1) 값 맞추기 — 원본은 둘 다
     *   같은 모델 값(/settings/enabled)에 묶여 있어 한쪽을 바꾸면 다른 쪽도 따라간다.
     ************************************************************************/
    function lf_syncEnabled(bOn) {
        if (oUI.swHead) { oUI.swHead.checked = bOn; }
        if (oUI.swBody) { oUI.swBody.checked = bOn; }
    }

    /************************************************************************
     * 화질 숫자칸 ↔ 미는 막대 값 맞추기 — 원본은 둘 다 /settings/quality 에 묶여 있다.
     *   막대는 0.01~1 만 표현 가능하므로 범위 밖 입력은 막대에만 잘라 반영하고,
     *   숫자칸 값은 사용자가 넣은 그대로 둔다(원본 Slider 와 동일 — 점검은 Apply 에서).
     ************************************************************************/
    function lf_syncQualityToRange(sVal) {
        if (!oUI.rng) { return; }
        var n = Number(sVal);
        if (isNaN(n)) { return; }
        if (n < C_MIN_QUALITY) { n = C_MIN_QUALITY; }
        if (n > C_MAX_QUALITY) { n = C_MAX_QUALITY; }
        oUI.rng.value = String(n);
    }

    /************************************************************************
     * 다이얼로그 1회 생성(이후 재사용).
     ************************************************************************/
    function lf_build() {
        lf_ensureStyle();

        var oDlg = document.createElement("dialog");
        oDlg.id = C_DLG_ID;
        oDlg.className = "u4a-dialog u4aImgCompDlg";

        // ── 헤더 — 제목 + [U4A 도움말 문서 버튼] + 닫기 X ──
        var oHeader = _el("div", "u4a-dialog__header");
        oHeader.innerHTML = "<span></span>";

        //U4A HELP DOCUMENT 버튼(원본 dialogViewer showHelpDocButton) — 패치 적용 서버에서만 노출.
        try {
            if (oAPP.common && oAPP.common.checkWLOList &&
                oAPP.common.checkWLOList("C", "UHAK901369") === true &&
                typeof oAPP.fn.fnU4AHelpDocuPopupOpener === "function") {
                var oHelpBtn = _el("button", "u4a-btn-icon u4aImgCompHelpBtn");
                oHelpBtn.type = "button";
                oHelpBtn.innerHTML = _fa("book-open-reader");
                // B44  U4A Help Document
                oHelpBtn.title = APPCOMMON.fnGetMsgClsText("/U4A/CL_WS_COMMON", "B44") || "U4A Help Document";
                oHelpBtn.addEventListener("click", function () {
                    try { oAPP.fn.fnU4AHelpDocuPopupOpener({ startMenuId: C_HELP_MENU_ID }); }
                    catch (e) { console.error("[HTML5][WS20][ImageCompress] 도움말 문서 호출 오류:", e && e.message); }
                });
                oHeader.appendChild(oHelpBtn);
            }
        } catch (e) {
            console.error("[HTML5][WS20][ImageCompress] 도움말 버튼 구성 오류:", e && e.message);
        }

        var oXBtn = _el("button", "u4a-btn-icon");
        oXBtn.type = "button";
        oXBtn.innerHTML = _fa("xmark");
        oXBtn.title = _wsTxt("056") || _wsTxt("003");   // close / Cancel
        oXBtn.addEventListener("click", function () { lf_close(); });
        oHeader.appendChild(oXBtn);
        oDlg.appendChild(oHeader);

        // ── 본문 — 원본 Panel(머리줄 = 제목 + 스위치) + 항목 2개 ──
        var oBody = _el("div", "u4a-dialog__body u4aImgCompBody");

        oUI = oUI || {};

        var oPanel = U4AUI.createPanel({ title: "" });
        oPanel.el.classList.add("u4aImgCompPanel");
        oUI.panel = oPanel;

        //머리줄 스위치(원본 headerToolbar 의 Switch).
        var oSwHead = _el("label", "u4a-switch u4aImgCompSwitch");
        var oSwHeadIn = document.createElement("input");
        oSwHeadIn.type = "checkbox";
        oSwHead.appendChild(oSwHeadIn);
        oSwHead.appendChild(_el("span", "u4a-switch__slider"));
        //머리줄 스위치 클릭이 상자 접기/펴기로 번지지 않도록(상자 머리줄 클릭 = 접기).
        oSwHead.addEventListener("click", function (e) { e.stopPropagation(); });
        oSwHeadIn.addEventListener("change", function () { lf_syncEnabled(oSwHeadIn.checked); });
        oPanel.actions.appendChild(oSwHead);
        oUI.swHead = oSwHeadIn;

        //── 항목1 : 압축 사용 여부 라벨 + 스위치 ──
        var oItem1 = _el("div", "u4aImgCompItem");
        oUI.lblEnabled = _el("div", "u4aImgCompLabel");
        oItem1.appendChild(oUI.lblEnabled);

        var oSwBody = _el("label", "u4a-switch u4aImgCompSwitch");
        var oSwBodyIn = document.createElement("input");
        oSwBodyIn.type = "checkbox";
        oSwBody.appendChild(oSwBodyIn);
        oSwBody.appendChild(_el("span", "u4a-switch__slider"));
        oSwBodyIn.addEventListener("change", function () { lf_syncEnabled(oSwBodyIn.checked); });
        oItem1.appendChild(oSwBody);
        oUI.swBody = oSwBodyIn;
        oPanel.body.appendChild(oItem1);

        //── 항목2 : 화질 라벨 + 숫자칸 + 미는 막대 ──
        var oItem2 = _el("div", "u4aImgCompItem");
        oUI.lblQuality = _el("div", "u4aImgCompLabel");
        oItem2.appendChild(oUI.lblQuality);

        var oRow = _el("div", "u4aImgCompQtyRow");

        //화질 입력칸(원본 sap.m.Input type Number width 60px) — 공통 입력칸 사용.
        var oQty = U4AUI.createField({
            className: "u4aImgCompQtyField",
            onInput: function (v) { lf_syncQualityToRange(v); },
            onChange: function (v) { lf_syncQualityToRange(v); }
        });
        oRow.appendChild(oQty.el);
        oUI.qty = oQty;

        //미는 막대(원본 sap.m.Slider min 0.01 / max 1 / step 0.01).
        var oRng = document.createElement("input");
        oRng.type = "range";
        oRng.className = "u4aImgCompRange";
        oRng.min = String(C_MIN_QUALITY);
        oRng.max = String(C_MAX_QUALITY);
        oRng.step = "0.01";
        oRng.addEventListener("input", function () {
            try { oQty.setValue(oRng.value); } catch (e) { }
            //값을 고치면 오류표시 해제(원본도 재점검 전까지 오류표시가 남지 않는다).
            try { oQty.setValueState("none", ""); } catch (e) { }
        });
        oRow.appendChild(oRng);
        oUI.rng = oRng;

        oItem2.appendChild(oRow);
        oPanel.body.appendChild(oItem2);

        oBody.appendChild(oPanel.el);
        oDlg.appendChild(oBody);

        // ── 푸터 — [Apply 파랑(편집시만)] [Cancel/Close] ──
        var oFoot = _el("div", "u4a-dialog__footer u4aImgCompFoot");
        oFoot.appendChild(_el("span", "u4aImgCompFootSpacer"));

        var oApplyBtn = _el("button", "u4a-btn u4a-btn--emphasized u4aImgCompIcoBtn");
        oApplyBtn.type = "button";
        oApplyBtn.innerHTML = _fa("check");
        oApplyBtn.title = _wsTxt("232");   // Apply
        oApplyBtn.addEventListener("click", function () { lf_apply(); });

        var oCancelBtn = _el("button", "u4a-btn u4a-btn--negative u4aImgCompIcoBtn");
        oCancelBtn.type = "button";
        oCancelBtn.innerHTML = _fa("xmark");
        oCancelBtn.addEventListener("click", function () { lf_close(); });

        oFoot.appendChild(oApplyBtn);
        oFoot.appendChild(oCancelBtn);
        oDlg.appendChild(oFoot);
        oUI.applyBtn = oApplyBtn;
        oUI.cancelBtn = oCancelBtn;

        // ESC = 닫기(원본 Reject).
        oDlg.addEventListener("cancel", function (e) { e.preventDefault(); lf_close(); });

        if (window.U4AUI && U4AUI.makeDialogRecenter) { U4AUI.makeDialogRecenter(oDlg, oHeader); }
        if (window.U4AUI && U4AUI.makeDialogResizable) { U4AUI.makeDialogResizable(oDlg, { minW: 360, minH: 220 }); }

        document.body.appendChild(oDlg);
        oUI.dlg = oDlg;
    }

    /************************************************************************
     * 현재 언어 텍스트를 화면에 채운다(열 때마다 — 언어 변경 대응).
     ************************************************************************/
    function lf_fillText(bEdit) {
        // 506  Image Compression Settings
        try { oUI.dlg.querySelector(".u4a-dialog__header span").textContent = _wsTxt("506"); } catch (e) { }
        // 503  Image Compression Options
        try { oUI.panel.el.querySelector(".u4a-panel__title").textContent = _wsTxt("503"); } catch (e) { }
        // 504  Enable Image Compression
        oUI.lblEnabled.textContent = _wsTxt("504");
        // 505  Image Quality
        oUI.lblQuality.textContent = _wsTxt("505");
        // 232  Apply
        oUI.applyBtn.title = _wsTxt("232");
        //취소 버튼 — 원본은 조회(편집불가)면 003(Cancel) 대신 056(Close).
        oUI.cancelBtn.title = bEdit ? _wsTxt("003") : _wsTxt("056");
    }

    /************************************************************************
     * 이미지 압축 설정 팝업 열기(공개 진입점).
     *   @param {object} sAttr - WS20 속성 행(is_attr). UIATV 에 설정 JSON 을 보관한다.
     ************************************************************************/
    oAPP.fn.fnImageCompressPopupOpen = function (sAttr) {

        if (!oUI || !oUI.dlg || !document.body.contains(oUI.dlg)) { oUI = null; lf_build(); }

        if (oUI.dlg.open) { return; }

        oCtx.attr = sAttr || null;

        //UIATV값이 존재하는 경우 JSON으로 파싱, 존재하지 않는 경우 빈 객체로 초기화(원본 61행).
        var _sSetting;
        try { _sSetting = JSON.parse((sAttr && sAttr.UIATV) || "{}"); }
        catch (e) {
            console.error("[HTML5][WS20][ImageCompress] 저장된 설정값을 읽지 못했습니다(기본값 사용):", e && e.message);
            _sSetting = {};
        }

        //UI에 필요한 설정값이 존재하지 않는 경우 기본값으로 초기화(원본 64~68행).
        for (var key in C_DEFAULT) {
            if (_sSetting[key] === undefined) { _sSetting[key] = C_DEFAULT[key]; }
        }
        oCtx.settings = _sSetting;

        var bEdit = _isEdit();

        //언어 텍스트 채우기.
        lf_fillText(bEdit);

        //값 채우기.
        lf_syncEnabled(!!_sSetting.enabled);
        try { oUI.qty.setValue(String(_sSetting.quality)); } catch (e) { }
        try { oUI.qty.setValueState("none", ""); } catch (e) { }
        lf_syncQualityToRange(_sSetting.quality);

        //편집 가능 여부(원본 Switch/Input/Slider enabled·editable = IS_EDIT).
        oUI.swHead.disabled = !bEdit;
        oUI.swBody.disabled = !bEdit;
        oUI.rng.disabled = !bEdit;
        try { oUI.qty.input.disabled = !bEdit; } catch (e) { }

        //Apply 노출(원본 OK visible = IS_EDIT).
        oUI.applyBtn.hidden = !bEdit;

        try { oUI.dlg.showModal(); } catch (e) { }

    }; // end of oAPP.fn.fnImageCompressPopupOpen

    /************************************************************************
     * 공통 스타일 1회 주입(테마 토큰 소비 — 공통 파일 미수정, 화면 스코프만).
     ************************************************************************/
    function lf_ensureStyle() {
        if (document.getElementById("u4aImgCompStyle")) { return; }
        var oStyle = document.createElement("style");
        oStyle.id = "u4aImgCompStyle";
        oStyle.textContent =
            //원본 dialogViewer width 30% — 화면이 좁아도 읽히도록 최소폭을 함께 둔다(고정 px 금지).
            ".u4aImgCompDlg { width: min(94vw, max(30vw, 22rem)); min-height: 20vh; padding: 0;" +
            " display: flex; flex-direction: column; }" +
            ".u4aImgCompDlg .u4a-dialog__header { cursor: move; user-select: none; }" +
            ".u4aImgCompDlg .u4a-dialog__header span { flex: 1 1 auto; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }" +
            ".u4aImgCompHelpBtn { color: var(--accent); }" +
            ".u4aImgCompBody { padding: 0.75rem; overflow: auto; }" +
            //상자 머리줄 — 제목(왼쪽) + 스위치(오른쪽).
            ".u4aImgCompPanel .u4a-panel__actions { display: flex; align-items: center; }" +
            //항목 — 굵은 라벨 위, 조작부 아래(원본 VBox).
            ".u4aImgCompItem { display: flex; flex-direction: column; gap: 0.5rem; padding: 0.625rem 0.5rem; }" +
            ".u4aImgCompLabel { font-size: 0.875rem; font-weight: 700; color: var(--text); }" +
            ".u4aImgCompQtyRow { display: flex; align-items: center; gap: 0.75rem; }" +
            //화질 숫자칸 — 원본 60px 폭에 대응(좁은 칸), 나머지 폭은 미는 막대가 차지.
            ".u4aImgCompQtyField { flex: 0 0 auto; width: 4.5rem; }" +
            ".u4aImgCompRange { flex: 1 1 auto; min-width: 0; accent-color: var(--accent); cursor: pointer; }" +
            ".u4aImgCompRange:disabled { cursor: default; opacity: 0.6; }" +
            ".u4aImgCompSwitch input:disabled + .u4a-switch__slider { opacity: 0.6; cursor: default; }" +
            ".u4aImgCompFoot { display: flex; gap: 0.5rem; align-items: center; }" +
            ".u4aImgCompFootSpacer { flex: 1 1 auto; }" +
            ".u4aImgCompFoot .u4a-btn[hidden] { display: none; }" +
            ".u4aImgCompIcoBtn { min-width: 2.5rem; justify-content: center; }";
        document.head.appendChild(oStyle);
    }

})(window, $, oAPP);
