/**************************************************************************
 * changeAppPackagePopup.js  (HTML5)
 * ------------------------------------------------------------------------
 * [컨버전 메모]
 *  원본: sap.m.Dialog + sap.ui.layout.form.Form(JSONModel two-way binding)
 *        + customHeader Toolbar + footer Accept/Reject Button.
 *  HTML5: native <dialog class="u4a-dialog u4aPkgDlg"> + 공통 컴포넌트
 *        (.u4a-form__row/.u4a-input/.u4a-field/.u4a-label/.u4a-field__msg).
 *        형제 createApplicationPopup.js / fnAppCopyPopupOpen.js 와 동일 전략
 *        — "로직 보존, UI만 교체".
 *
 *  ★ 비즈니스 로직(초기조회 /package_change ACTCD=INIT, 입력점검 lf_chkValue,
 *    변경수행 ACTCD=CHNG_PACK)은 원본 그대로. UI5 의존부만 치환:
 *      · JSONModel two-way binding      → 간이 모델(_createModel) + DOM 동기(bind/refresh).
 *      · sap.ui.core.ValueState.Error   → data-vs="error" + .u4a-field__msg (.analy/15 §3.5).
 *      · sap.m.Input(valueHelpOnly)     → readOnly + vho 활성외관(.analy/15 §3.8).
 *      · sap.m.Input(description)        → 입력칸 우측 muted 부가설명 span(원본 description 재현).
 *      · parent.showMessage(sap, …)      → parent.showMessage(null, …) (HTML5 셸).
 *      · busy(dialog busy:true)          → 공통 top-layer parent.setBusy (.analy/16 §2.10).
 *      · Package F4 / CTS F4             → 공통 fnPackgSchpPopupOpener / fnCtsPopupOpener 위임.
 **************************************************************************/

(function () {
    "use strict";

    const C_BIND = "/bind";       // 모델 바인딩 루트(원본 l_bind)
    const APPCOMMON = oAPP.common;

    const _fa = (sName) => '<i class="fa-solid fa-' + sName + '"></i>';

    // 메시지 클래스 텍스트 헬퍼(원본 fnGetMsgClsText 6-인자 호출 그대로)
    function _txt(sCls, sCode, p1, p2, p3, p4) {
        try { return APPCOMMON.fnGetMsgClsText(sCls, sCode, p1 || "", p2 || "", p3 || "", p4 || ""); }
        catch (e) { return ""; }
    }

    // 오류 필드 자동 포커스 — blur/change/click '도중' 동기 focus() 는 진행 중 포커스 이동에 밀릴 수 있어
    //   다음 매크로태스크로 미룬다(Chromium93). 포커스가 붙어야 .u4a-form__row:focus-within 로
    //   value-state 메시지(.u4a-field__msg)가 노출된다(.analy/15 §3.5). (createApplicationPopup 과 동일)
    function _refocus(oEl) {
        if (!oEl || typeof oEl.focus !== "function") { return; }
        setTimeout(function () { try { oEl.focus(); } catch (e) { } }, 0);
    }

    function _el(sTag, sClass, sText) {
        const o = document.createElement(sTag);
        if (sClass) { o.className = sClass; }
        if (typeof sText !== "undefined") { o.textContent = sText; }
        return o;
    }

    /************************************************************************
     * 서버가 "백엔드 로그온 언어로 구운" showMessage/RTMSG 텍스트(E229 Local package…,
     *   CTS 193/213/305/209 등)를 접속(워크스페이스/로그인) 언어로 재현지화.
     *   ─ 공통 단일출처 WsMsgCls.relocalize(.analy/17 §5) 위임. 실패 시 원문(graceful).
     *   ─ ws_events.js(WS20 활성/저장)의 _ws20RelocalizeBaked 와 동일 로직.
     ************************************************************************/
    function _relocalizeBaked(sText) {
        try {
            const wsL = (parent.getUserInfo() || {}).LANGU || "";                 // 접속(로그인) 언어
            const beL = (parent.getServerInfo && parent.getServerInfo()) ? (parent.getServerInfo().LANGU || "") : ""; // 백엔드 로그온 언어
            if (!wsL || (beL && beL === wsL)) { return sText; }
            const WC = (parent.REMOTE && parent.REMOTE.getGlobal) ? parent.REMOTE.getGlobal("WsMsgCls") : null;
            return (WC && WC.relocalize) ? WC.relocalize(sText, beL, wsL) : sText;
        } catch (e) { return sText; }
    }

    /************************************************************************
     * eval(SCRIPT) 동안만 parent.showMessage 를 재현지화로 감싼다(반환값=복원용).
     *   eval 은 인라인 유지 — 서버 SCRIPT 가 참조하는 지역 oModel·모듈 lf_RequestNoF4help 스코프 보존.
     *   서버 SCRIPT 의 parent.showMessage(sap, KIND, TYPE, "<baked텍스트>", …) 가 접속언어로 출력된다.
     ************************************************************************/
    function _beginRelocalizeSM() {
        const oOrig = parent.showMessage;
        parent.showMessage = function (oUI5, kind, type, sMsg, fnCb) {
            return oOrig.call(parent, oUI5, kind, type, _relocalizeBaked(sMsg), fnCb);
        };
        return oOrig;
    }

    /************************************************************************
     * 공통 스타일 1회 주입 (테마 토큰 소비 — 하드코딩 색 없음)
     ************************************************************************/
    function _ensureStyle() {
        if (document.getElementById("u4aPkgStyle")) { return; }
        const oStyle = document.createElement("style");
        oStyle.id = "u4aPkgStyle";
        oStyle.textContent = `
        .u4aPkgDlg { width: min(92vw, 560px); padding: 0; display: flex; flex-direction: column; }
        .u4aPkgDlg .u4a-dialog__header { cursor: move; user-select: none; }
        .u4aPkgDlg .u4a-dialog__header span { flex: 1 1 auto; }
        /* 원본 ResponsiveGridLayout(라벨-상단 스택 + 전폭 필드) 재현 — 공통 .u4a-form__row 기본(라벨 위/필드 아래)을
           그대로 소비(별도 라벨-왼쪽 그리드 override 를 두지 않는다).
           ★ 바디는 flex 세로 스택 — 공통 .u4a-dialog__body(flex:1) 라 리사이즈로 커지는데, grid 로 두면 남는
              세로 공간에 행이 분산(stretch)돼 벌어진다. flex-column 은 행을 위에서부터 쌓고 남는 공간은 아래로. */
        .u4aPkgBody { padding: 1.25rem 1.5rem 1.75rem; display: flex; flex-direction: column; gap: 1.1rem; }
        /* 폼은 편한 최대폭까지만(초대형 리사이즈에도 입력칸이 과도하게 늘어나지 않게 — 좌측 정렬). */
        .u4aPkgBody > .u4a-form__row { max-width: 44rem; }
        /* 컨트롤 = [입력칸] + [부가설명(원본 description)] 한 줄. */
        .u4aPkgCtrl { display: flex; align-items: center; gap: 0.75rem; min-width: 0; }
        /* 입력 필드(New Package / Change Request)는 전폭. */
        .u4aPkgCtrl > .u4a-field { flex: 1 1 auto; min-width: 0; }
        /* 표시전용(App ID / Current Package): 값칸은 고정폭, 설명(description)은 이어서. */
        .u4aPkgCtrl > .u4a-input--display { flex: 0 0 15rem; min-width: 0; max-width: 55%; }
        /* 원본 sap.m.Input description — 값 우측 muted 텍스트(앱명/패키지설명/요청텍스트). 넘치면 말줄임 + 공통 툴팁. */
        .u4aPkgDesc { flex: 0 1 auto; min-width: 0; color: var(--text-muted); font-size: 0.8125rem;
                      overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .u4aPkgDesc:empty { display: none; }
        /* 값도움 전용(F4/valueHelpOnly) 입력 — readOnly 지만 활성(비-disabled)이면 편집가능 외관 유지
           (.analy/15 §3.8). 공통 readonly muted 룩(.u4a-input:read-only, (0,2,0))을 이기도록 특이도 상향. */
        .u4aPkgDlg .u4a-input.u4aPkgVho:read-only:not(:disabled) {
            background: var(--surface-raised); border-color: var(--divider); color: var(--text); cursor: pointer;
        }
        /* ★ ValueState.Error 테두리(빨강)는 어떤 테마의 활성-테두리 규칙보다 무조건 이긴다(.analy/15 §3.5.2). */
        .u4aPkgDlg .u4a-input[data-vs="error"] { border-color: var(--state-error) !important; }
        .u4aPkgFoot { display: flex; gap: 0.5rem; align-items: center; justify-content: flex-end; }
        `;
        document.head.appendChild(oStyle);
    }

    /************************************************************************
     * 간이 모델 (구 sap.ui.model.json.JSONModel two-way binding 대체)
     *  - getProperty/setProperty/setData: 원본 호출부 그대로.
     *  - bind(fn): 모델→DOM 반영 함수 등록. setProperty/setData/refresh 시 일괄 재적용.
     ************************************************************************/
    function _createModel() {
        let data = {};
        const aBind = [];
        function _resolve(sPath) {
            const aParts = sPath.split("/").filter(Boolean);
            let oObj = data;
            for (let i = 0; i < aParts.length - 1; i++) {
                if (oObj[aParts[i]] == null) { oObj[aParts[i]] = {}; }
                oObj = oObj[aParts[i]];
            }
            return { parent: oObj, key: aParts[aParts.length - 1] };
        }
        return {
            get oData() { return data; },
            // bMerge=true → 기존 데이터에 병합(1단계 중첩까지). 서버 SCRIPT 의 UI5 JSONModel
            //   setData(oData, true) 계약 재현(예: CTS 오류 시 setData({bind:{edit01:true}}, true)
            //   로 edit01 만 갱신하고 나머지 bind/PRC_INFO 는 보존). 미지정 시 전체 교체(기존 동작).
            setData(d, bMerge) {
                if (bMerge && d && typeof d === "object") {
                    for (const k in d) {
                        if (!Object.prototype.hasOwnProperty.call(d, k)) { continue; }
                        if (data[k] && typeof data[k] === "object" && !Array.isArray(data[k]) &&
                            d[k] && typeof d[k] === "object" && !Array.isArray(d[k])) {
                            Object.assign(data[k], d[k]);
                        } else { data[k] = d[k]; }
                    }
                } else { data = d || {}; }
                this.refresh();
            },
            getProperty(sPath) {
                if (!sPath || sPath === "/") { return data; }
                const aParts = sPath.split("/").filter(Boolean);
                let oObj = data;
                for (let i = 0; i < aParts.length; i++) {
                    if (oObj == null) { return undefined; }
                    oObj = oObj[aParts[i]];
                }
                return oObj;
            },
            setProperty(sPath, vVal) { const r = _resolve(sPath); r.parent[r.key] = vVal; this.refresh(); },
            bind(fn) { aBind.push(fn); },
            refresh() { for (let i = 0; i < aBind.length; i++) { try { aBind[i](); } catch (e) { } } }
        };
    }

    // label + control 슬롯 row. 반환: {row, label, control, msg}
    //   라벨은 원본 sap.m.Label 처럼 콜론(:) 접미(필수는 공통 .u4a-label--required::after 로 별표).
    function _row(sLabel, bRequired) {
        const oRow = _el("div", "u4a-form__row u4aPkgRow");
        const sTxt = sLabel ? (sLabel + ":") : "";
        const oLabel = _el("label", "u4a-label" + (bRequired ? " u4a-label--required" : ""), sTxt);
        oRow.appendChild(oLabel);
        const oCtrl = _el("div", "u4aPkgCtrl");
        oRow.appendChild(oCtrl);
        const oMsg = _el("div", "u4a-field__msg");
        oRow.appendChild(oMsg);
        return { row: oRow, label: oLabel, control: oCtrl, msg: oMsg };
    }

    /************************************************************************
     * 입력/표시 필드 빌드. cfg:
     *   valPath/descPath/statPath/stxtPath/editPath, display, readOnly(vho),
     *   clear, clearAlso[], upper, vh(fn), onChange(fn)
     ************************************************************************/
    function _buildInput(oModel, oRow, cfg) {
        const bClear = cfg.clear === true;
        const bVh = typeof cfg.vh === "function";

        let oInput, oWrap = null, oClearBtn = null, oVhBtn = null;

        if (bClear || bVh) {
            oWrap = _el("div", "u4a-field");
            oWrap.setAttribute("data-trail", (bClear && bVh) ? "2" : "1");
            oInput = _el("input", "u4a-input u4a-field__input");
            oWrap.appendChild(oInput);
            if (bClear) {
                oClearBtn = _el("button", "u4a-field__clear");
                oClearBtn.type = "button"; oClearBtn.tabIndex = -1;
                oClearBtn.title = "Clear"; oClearBtn.innerHTML = _fa("xmark");
                oWrap.appendChild(oClearBtn);
            }
            if (bVh) {
                oVhBtn = _el("button", "u4a-field__vh");
                oVhBtn.type = "button";
                oVhBtn.innerHTML = _fa("magnifying-glass");
                oVhBtn.addEventListener("click", function () { cfg.vh(oModel, oInput); });
                oWrap.appendChild(oVhBtn);
            }
            oRow.control.appendChild(oWrap);
        } else {
            oInput = _el("input", "u4a-input");
            oRow.control.appendChild(oInput);
        }

        // 원본 description(값 우측 muted 텍스트) 재현 — 넘치면 말줄임 + 공통 툴팁(data-tip-trunc).
        let oDesc = null;
        if (cfg.descPath) {
            oDesc = _el("span", "u4aPkgDesc");
            oDesc.setAttribute("data-tip-trunc", "");
            oRow.control.appendChild(oDesc);
        }

        if (cfg.maxLength) { oInput.maxLength = cfg.maxLength; }
        if (cfg.readOnly) {
            oInput.readOnly = true;
            // 값도움 전용(valueHelpOnly/F4) — readOnly 로 타이핑만 막고 활성 외관 유지(vho 클래스).
            if (bVh) { oInput.classList.add("u4aPkgVho"); }
        }
        // 읽기 전용 표시 필드 — 편집 가능 필드와 구분되는 '잠긴' 톤(.u4a-input--display, shell.css).
        if (cfg.display) {
            oInput.classList.add("u4a-input--display");
            oInput.readOnly = true;
            oInput.tabIndex = -1;
        }

        // 이 필드의 value-state(오류) 즉시 해제 — 사용자가 값을 입력/선택/클리어하면 스테일 오류 제거.
        //   (최종 정합성은 저장 시 lf_chkValue 가 재검증 → 잘못된 값이면 그때 다시 표시.)
        function _clearOwnVs() {
            if (cfg.statPath && oModel.getProperty(cfg.statPath) === "Error") {
                oModel.setProperty(cfg.statPath, undefined);
                if (cfg.stxtPath) { oModel.setProperty(cfg.stxtPath, ""); }
            }
        }

        // 입력 변경 → 모델 반영 (+ 대문자 / 추가 onChange).
        oInput.addEventListener("change", function () {
            let v = oInput.value;
            if (cfg.upper) { v = v.toUpperCase(); oInput.value = v; }
            oModel.setProperty(cfg.valPath, v);
            if (typeof cfg.onChange === "function") { cfg.onChange(oModel, oInput); }
        });

        // 타이핑 즉시 value-state 해제(빨간 테두리/메시지가 계속 떠 있어 혼동되는 것 방지).
        oInput.addEventListener("input", _clearOwnVs);

        // 값도움 전용(읽기전용) 필드 — 활성 상태면 입력 영역 클릭만으로도 값도움 팝업을 연다(돋보기 버튼과 동일).
        if (bVh && cfg.readOnly) {
            oInput.addEventListener("click", function () { if (!oInput.disabled) { cfg.vh(oModel, oInput); } });
        }

        // clear 토글(값 있을 때만 노출) — 공통 U4AUI.attachClear.
        if (oClearBtn && window.U4AUI && U4AUI.attachClear) {
            U4AUI.attachClear(oInput, oClearBtn, function () {
                oModel.setProperty(cfg.valPath, "");
                if (Array.isArray(cfg.clearAlso)) {
                    cfg.clearAlso.forEach(function (sPath) { oModel.setProperty(sPath, ""); });
                }
                _clearOwnVs();
                if (typeof cfg.onChange === "function") { cfg.onChange(oModel, oInput); }
            });
        }

        // 모델 → DOM 반영.
        oModel.bind(function () {
            const v = oModel.getProperty(cfg.valPath);
            if (document.activeElement !== oInput) { oInput.value = (v == null ? "" : v); }

            // editable (원본 edit01) — 비활성 시 F4 버튼도 잠금.
            let bEdit = true;
            if (cfg.editPath) { bEdit = oModel.getProperty(cfg.editPath) !== false; }
            oInput.disabled = !bEdit;
            if (oVhBtn) { oVhBtn.disabled = !bEdit; }
            if (cfg.readOnly) { oInput.readOnly = true; }
            if (bVh && cfg.readOnly) { oInput.style.cursor = bEdit ? "pointer" : ""; }

            // 부가설명(description).
            if (oDesc) {
                const sDesc = oModel.getProperty(cfg.descPath) || "";
                oDesc.textContent = sDesc;
                oDesc.setAttribute("data-tip", sDesc);
            }

            // value state (원본 ValueState.Error / ValueStateText).
            const sStat = cfg.statPath ? oModel.getProperty(cfg.statPath) : null;
            if (sStat === "Error") { oInput.setAttribute("data-vs", "error"); }
            else { oInput.removeAttribute("data-vs"); }
            if (oRow.msg) { oRow.msg.textContent = cfg.stxtPath ? (oModel.getProperty(cfg.stxtPath) || "") : ""; }

            // clear filled 토글.
            if (oWrap) { oWrap.setAttribute("data-filled", (oInput.value && !oInput.disabled) ? "true" : "false"); }
        });

        return oInput;
    }

    /************************************************************************
     * application 의 package 변경 팝업 (구 oAPP.fn.changeAppPackagePopup)
     ************************************************************************/
    oAPP.fn.changeAppPackagePopup = function (APPID) {

        _ensureStyle();

        // 푸터 메시지가 있으면 닫는다.
        try { APPCOMMON.fnHideFloatingFooterMsg(); } catch (e) { }

        const oModel = _createModel();
        // 초기 빈 모델(조회 전) — value-state/설명 필드까지 확보.
        oModel.setData({
            bind: {
                APPID: APPID || "", APPNM: "", PACKG: "", OLDPN: "",
                NEWPK: "", NEWPN: "", CREQN: "", REQTX: "", edit01: true,
                NEWPK_vs: undefined, NEWPK_tx: "", CREQN_vs: undefined, CREQN_tx: ""
            },
            PRC_INFO: {}
        });

        const oUIobj = {};

        // ── 다이얼로그 골격 ─────────────────────────────────────────────
        const oDlg = document.createElement("dialog");
        oDlg.className = "u4a-dialog u4aPkgDlg";
        oUIobj.dlg = oDlg;

        // 헤더 — A93 Application Package Change. 아이콘은 메뉴(앱 패키지 변경)와 동일 인지(swap).
        const oHeader = _el("div", "u4a-dialog__header");
        oHeader.innerHTML = _fa("right-left") + '<span></span>';
        oHeader.querySelector("span").textContent = _txt("/U4A/CL_WS_COMMON", "A93");
        const oXBtn = _el("button", "u4a-btn-icon");
        oXBtn.type = "button"; oXBtn.setAttribute("data-act", "close");
        oXBtn.innerHTML = _fa("xmark");
        oXBtn.title = _txt("/U4A/CL_WS_COMMON", "A39"); // Close
        oXBtn.addEventListener("click", function () { lf_closePopup(oDlg); });
        oHeader.appendChild(oXBtn);
        oDlg.appendChild(oHeader);

        // 바디
        const oBody = _el("div", "u4a-dialog__body u4aPkgBody");
        oDlg.appendChild(oBody);

        // Web Application ID (A90) — 표시 전용. value=APPID, desc=APPNM.
        let oR = _row(_txt("/U4A/CL_WS_COMMON", "A90"), false);
        _buildInput(oModel, oR, { valPath: C_BIND + "/APPID", descPath: C_BIND + "/APPNM", display: true });
        oBody.appendChild(oR.row);

        // Current Package (A94) — 표시 전용. value=PACKG, desc=OLDPN.
        oR = _row(_txt("/U4A/CL_WS_COMMON", "A94"), false);
        _buildInput(oModel, oR, { valPath: C_BIND + "/PACKG", descPath: C_BIND + "/OLDPN", display: true });
        oBody.appendChild(oR.row);

        // New Package (A95, required) — 입력 + 대문자 + clear + Package F4. value=NEWPK, desc=NEWPN.
        oR = _row(_txt("/U4A/CL_WS_COMMON", "A95"), true);
        oUIobj.oInpNewPk = _buildInput(oModel, oR, {
            valPath: C_BIND + "/NEWPK", descPath: C_BIND + "/NEWPN",
            statPath: C_BIND + "/NEWPK_vs", stxtPath: C_BIND + "/NEWPK_tx",
            upper: true, clear: true, clearAlso: [C_BIND + "/NEWPN"], vh: lf_PackageF4help
        });
        oBody.appendChild(oR.row);

        // Change Request No. (A96, required) — 값도움 전용(CTS F4) + clear + 조건부 편집(edit01). value=CREQN, desc=REQTX.
        oR = _row(_txt("/U4A/CL_WS_COMMON", "A96"), true);
        oUIobj.oInpCreqn = _buildInput(oModel, oR, {
            valPath: C_BIND + "/CREQN", descPath: C_BIND + "/REQTX",
            statPath: C_BIND + "/CREQN_vs", stxtPath: C_BIND + "/CREQN_tx",
            editPath: C_BIND + "/edit01", upper: true, readOnly: true, clear: true,
            clearAlso: [C_BIND + "/REQTX"], vh: lf_RequestNoF4help
        });
        oBody.appendChild(oR.row);

        // ── 푸터 ────────────────────────────────────────────────────────
        const oFoot = _el("div", "u4a-dialog__footer u4aPkgFoot");
        oDlg.appendChild(oFoot);

        // A97 Change Package (확정) — 강조(파랑).
        const oOk = _el("button", "u4a-btn u4a-btn--emphasized");
        oOk.type = "button";
        oOk.innerHTML = _fa("check");
        oOk.title = _txt("/U4A/CL_WS_COMMON", "A97"); // Change Package
        oOk.addEventListener("click", function () { lf_changePackage(oModel, oUIobj); });
        oFoot.appendChild(oOk);

        // A39 Close — 원본 Reject 느낌(--negative).
        const oClose = _el("button", "u4a-btn u4a-btn--negative");
        oClose.type = "button";
        oClose.innerHTML = _fa("xmark");
        oClose.title = _txt("/U4A/CL_WS_COMMON", "A39"); // Close
        oClose.addEventListener("click", function () { lf_closePopup(oDlg); });
        oFoot.appendChild(oClose);

        // ESC → 닫기.
        oDlg.addEventListener("cancel", function (e) { e.preventDefault(); lf_closePopup(oDlg); });

        // 헤더 드래그 / 더블클릭 리센터 / grip 리사이즈 — 공통 U4AUI.
        if (window.U4AUI && U4AUI.makeDialogDraggable) { U4AUI.makeDialogDraggable(oDlg, oHeader); }
        if (window.U4AUI && U4AUI.makeDialogRecenter) { U4AUI.makeDialogRecenter(oDlg, oHeader); }
        if (window.U4AUI && U4AUI.makeDialogResizable) { U4AUI.makeDialogResizable(oDlg, { minW: 420, minH: 280 }); }

        document.body.appendChild(oDlg);
        oDlg.showModal();

        // 초기 데이터 조회 — 조회 동안 공통 top-layer busy 로 갓 띄운 다이얼로그를 덮는다(.analy/16 §2.10).
        parent.setBusy("X");
        lf_getInitData(APPID, oModel, oDlg);

    }; // end of oAPP.fn.changeAppPackagePopup

    /************************************************************************
     * dialog 종료 (구 lf_closePopup) — 원본은 취소 토스트 없이 닫기만.
     ************************************************************************/
    function lf_closePopup(oDlg) {
        if (!oDlg) { return; }
        try { oDlg.close(); } catch (e) { }
        try { oDlg.remove(); } catch (e) { }
    }

    /************************************************************************
     * 초기 데이터 조회 (구 lf_getInitData) — /package_change ACTCD=INIT
     ************************************************************************/
    function lf_getInitData(APPID, oModel, oDlg) {

        const oFormData = new FormData();
        oFormData.append("APPID", APPID);
        oFormData.append("ACTCD", "INIT");

        sendAjax(parent.getServerPath() + "/package_change", oFormData, function (param) {

            // 오류 — SCRIPT / MSGNO / RTMSG 순 처리(원본 동일). 어느 경로든 busy 해제 후 팝업 종료.
            if (param.RETCD === "E") {

                parent.setBusy("");

                if (typeof param.SCRIPT !== "undefined" && param.SCRIPT !== "") {
                    // 서버 SCRIPT 안전 eval — 전 코드베이스 공통 규약(createEventPopup/AppCopy 동일).
                    //   같은 클로저라 oModel·lf_RequestNoF4help 자연 도달, sap 참조는 전역 안전스텁이 흡수.
                    //   SCRIPT 의 showMessage 텍스트는 접속언어로 재현지화(_beginRelocalizeSM). 깨져도 RTMSG 폴백.
                    const _sm = _beginRelocalizeSM();
                    try { eval(param.SCRIPT); }                                   // eslint-disable-line no-eval
                    catch (e) {
                        console.error("[HTML5][package_change:INIT] SCRIPT 수행 실패:", e && e.message, param.SCRIPT);
                        if (param.RTMSG) { parent.showMessage(null, 20, "E", param.RTMSG); }
                    } finally { parent.showMessage = _sm; }
                    lf_closePopup(oDlg);
                    return;
                }

                if (typeof param.MSGNO !== "undefined") {
                    // MSGNO 는 클라 DB 에서 접속언어로 직접 조회 — 재현지화 불필요.
                    parent.showMessage(null, 20, "E",
                        parent.WSUTIL.getWsMsgClsTxt("", "ZMSG_WS_COMMON_001", param.MSGNO));
                    lf_closePopup(oDlg);
                    return;
                }

                // SCRIPT 없는 오류 RTMSG 도 접속언어로 재현지화.
                parent.showMessage(null, 20, "E", _relocalizeBaked(param.RTMSG));
                lf_closePopup(oDlg);
                return;
            }

            const l_bind = {};
            l_bind.APPID = param.PRC_INFO.APPID;    // application ID
            l_bind.APPNM = param.PRC_INFO.APPNM;    // application Desc.
            l_bind.PACKG = param.PRC_INFO.PACKG;    // Current Package
            l_bind.OLDPN = param.PRC_INFO.OLDPN;    // Current Package Desc.
            l_bind.NEWPK = param.PRC_INFO.NEWPK;    // New Package
            l_bind.NEWPN = param.PRC_INFO.NEWPN;    // New Package Desc.
            l_bind.CREQN = param.PRC_INFO.CREQN;    // Change Request No.
            l_bind.REQTX = param.PRC_INFO.REQTX;    // Change Request No. Desc.

            l_bind.edit01 = true;                   // Change Request No. editable.

            // value-state 초기화.
            lf_resetErrorField(l_bind);

            // 이미 전송요청이 있고(REQNR) 아직 미전송(TRANF="")이면 CTS 입력 잠금(원본 동일).
            if (param.PRC_INFO.REQNR !== "" && param.PRC_INFO.TRANF === "") {
                l_bind.edit01 = false;
            }

            oModel.setData({ bind: l_bind, PRC_INFO: param.PRC_INFO });

            parent.setBusy("");
        });
    }

    /************************************************************************
     * package 변경 처리 (구 lf_changePackage) — 입력점검 → 확인 → CHNG_PACK
     ************************************************************************/
    function lf_changePackage(oModel, oUIobj) {

        const l_bind = oModel.getProperty(C_BIND);

        // 입력값 점검 — 오류면 첫 오류 필드 포커스 후 중단(busy 켜기 전이라 포커스 안착).
        const oErrFocus = lf_chkValue(oModel, l_bind, oUIobj);
        if (oErrFocus) { _refocus(oErrFocus); return; }

        // 변경전 확인 팝업. 273 Package will be changed. Do you want to continue?
        parent.showMessage(null, 30, "I", _txt("/U4A/MSG_WS", "273"), function (oEvent) {

            if (oEvent !== "YES") { return; }

            parent.setBusy("X");

            // 서버 전송 구조 정보 — 화면 입력값 매핑(원본 동일).
            const l_PRC_INFO = oModel.getProperty("/PRC_INFO") || {};
            l_PRC_INFO.NEWPK = l_bind.NEWPK;    // New Package
            l_PRC_INFO.NEWPN = l_bind.NEWPN;    // New Package Desc.
            l_PRC_INFO.CREQN = l_bind.CREQN;    // Change Request No.
            l_PRC_INFO.REQTX = l_bind.REQTX;    // Change Request No. Desc.

            const oFormData = new FormData();
            oFormData.append("APPID", l_bind.APPID);
            oFormData.append("ACTCD", "CHNG_PACK");
            oFormData.append("PRC_INFO", JSON.stringify(l_PRC_INFO));

            sendAjax(parent.getServerPath() + "/package_change", oFormData, function (param) {

                // 오류 + SCRIPT — 서버가 케이스별 UI 동작(showMessage / CTS F4 재오픈 등)을 담아 보냄 → eval.
                //   같은 클로저라 oModel·lf_RequestNoF4help 자연 도달(원본 인라인 eval 과 동일 스코프), sap 참조는
                //   전역 안전스텁 흡수. CTS 오류(E193) SCRIPT 의 oModel.setData({bind:{edit01:true}},true) 는 간이
                //   모델 setData(d,bMerge) 병합으로 처리. SCRIPT 가 깨져도 서버 메시지는 보여준다(RTMSG 폴백).
                if (param.RETCD === "E" && (typeof param.SCRIPT !== "undefined" && param.SCRIPT !== "")) {
                    parent.setBusy("");
                    // SCRIPT 의 showMessage 텍스트(E229/E193/E305…)를 접속언어로 재현지화. 깨져도 RTMSG 폴백.
                    const _sm = _beginRelocalizeSM();
                    try { eval(param.SCRIPT); }                                   // eslint-disable-line no-eval
                    catch (e) {
                        console.error("[HTML5][package_change:CHNG_PACK] SCRIPT 수행 실패:", e && e.message, param.SCRIPT);
                        if (param.RTMSG) { parent.showMessage(null, 20, "E", param.RTMSG); }
                    } finally { parent.showMessage = _sm; }
                    return;
                }

                // 오류(SCRIPT 없음) — RTMSG 접속언어로 재현지화 후 표시.
                if (param.RETCD === "E") {
                    parent.setBusy("");
                    parent.showMessage(null, 20, "E", _relocalizeBaked(param.RTMSG));
                    return;
                }

                // 성공 — 공통 푸터 메시지 + 팝업 종료. (CHNG_PACK 성공은 PRC_INFO 없이 RTMSG 만 옴.)
                //   성공 메시지(S005 Job finished 등)도 접속언어로 재현지화.
                oAPP.common.fnShowFloatingFooterMsg("S", "WS10", _relocalizeBaked(param.RTMSG));
                lf_closePopup(oUIobj.dlg);
                parent.setBusy("");
            });
        });
    }

    /************************************************************************
     * 입력값 점검 (구 lf_chkValue) — 오류 시 첫 오류 필드 반환(없으면 undefined)
     ************************************************************************/
    function lf_chkValue(oModel, i_bind, oUIobj) {

        let oFocus = null;

        // value-state 초기화.
        lf_resetErrorField(i_bind);

        // 신규 PACKAGE 미입력.
        if (i_bind.NEWPK === "") {
            i_bind.NEWPK_vs = "Error";
            // 050 & is required. (A22 Package)
            i_bind.NEWPK_tx = _txt("/U4A/MSG_WS", "050", _txt("/U4A/CL_WS_COMMON", "A22"));
            if (!oFocus) { oFocus = oUIobj.oInpNewPk; }
        }

        // 로컬 package 입력 불가.
        if (i_bind.NEWPK === "$TMP") {
            i_bind.NEWPK_vs = "Error";
            // 229 Local package cannot be entered.
            i_bind.NEWPK_tx = _txt("/U4A/MSG_WS", "229");
            if (!oFocus) { oFocus = oUIobj.oInpNewPk; }
        }

        // 이전 package 와 동일.
        if (i_bind.NEWPK === i_bind.PACKG) {
            i_bind.NEWPK_vs = "Error";
            // 295 Entered the same package as the previous package.
            i_bind.NEWPK_tx = _txt("/U4A/MSG_WS", "295");
            if (!oFocus) { oFocus = oUIobj.oInpNewPk; }
        }

        // Change request No. 미입력.
        if (i_bind.CREQN === "") {
            i_bind.CREQN_vs = "Error";
            // 050 & is required. (A96 Change Request No.)
            i_bind.CREQN_tx = _txt("/U4A/MSG_WS", "050", _txt("/U4A/CL_WS_COMMON", "A96"));
            if (!oFocus) { oFocus = oUIobj.oInpCreqn; }
        }

        // 모델 반영 — 오류 노출 + (통과 시) 앞선 오류 테두리/메시지 확실히 해제(원본은 통과 시 미갱신).
        oModel.setProperty(C_BIND, i_bind);

        if (oFocus) { return oFocus; }
    }

    /************************************************************************
     * value-state 필드 초기화 (구 lf_resetErrorField)
     ************************************************************************/
    function lf_resetErrorField(i_bind) {
        i_bind.NEWPK_vs = undefined; i_bind.NEWPK_tx = "";
        i_bind.CREQN_vs = undefined; i_bind.CREQN_tx = "";
    }

    /************************************************************************
     * 특정 필드 value-state(오류) 즉시 해제 — F4 로 값 선택 시 스테일 오류 제거.
     ************************************************************************/
    function lf_clearVs(oModel, sStatPath, sStxtPath) {
        if (oModel.getProperty(sStatPath) === "Error") {
            oModel.setProperty(sStatPath, undefined);
            oModel.setProperty(sStxtPath, "");
        }
    }

    /************************************************************************
     * Package F4 help (구 lf_PackageF4help) — 원본 callF4HelpPopup("DEVCLASS") 의
     *   HTML5 대체 = 공통 fnF4SearchHelpOpen(= createApplicationPopup 오브젝트 F4 와 동일 경로).
     *   /f4serverData 백엔드 계약 동일이라 결과 행 셀키(DEVCLASS/CTEXT)도 그대로.
     *   ★ fnPackgSchpPopupOpener 는 UI5 design/js/callF4HelpPopup.js 를 로드해 HTML5 에서 크래시하므로 미사용.
     ************************************************************************/
    function lf_PackageF4help(oModel) {

        // 선택/더블클릭한 결과 행 → New Package(DEVCLASS) + 설명(CTEXT) 반영(원본 lf_callback 동일).
        function lf_callback(param) {
            if (!param) { return; }
            oModel.setProperty(C_BIND + "/NEWPK", param.DEVCLASS || "");
            oModel.setProperty(C_BIND + "/NEWPN", param.CTEXT || "");
            // 값 선택 완료 → 스테일 value-state 해제(저장 시 재검증).
            lf_clearVs(oModel, C_BIND + "/NEWPK_vs", C_BIND + "/NEWPK_tx");
        }

        function _openF4() {
            oAPP.fn.fnF4SearchHelpOpen({ shlpname: "DEVCLASS", onPick: lf_callback });
        }

        try {
            if (typeof oAPP.fn.fnF4SearchHelpOpen === "function") { _openF4(); return; }
            // 공통 F4 모듈(ws10_20/js/fnF4SearchHelpPopup) 미로드 시 지연 로드 후 오픈.
            lf_getScript("js/fnF4SearchHelpPopup", _openF4);
        } catch (e) {
            parent.showMessage(null, 20, "E", parent.WSUTIL.getWsMsgClsTxt("", "ZMSG_WS_COMMON_001", "950")); // Value help is not available.
        }
    }

    /************************************************************************
     * js 파일 지연 로드 (createApplicationPopup lf_getScript 동일 — F4 모듈 lazy load 용)
     ************************************************************************/
    function lf_getScript(fname, callbackFunc, bSync) {
        const xhttp = new XMLHttpRequest();
        xhttp.onreadystatechange = function () {
            if (this.readyState == 4 && this.status == 200) {
                eval(this.responseText);
                callbackFunc();
            }
        };
        xhttp.open("GET", fname + ".js", bSync === true ? false : true);
        xhttp.send();
    }

    /************************************************************************
     * Change Request No. F4 help (구 lf_RequestNoF4help) — 공통 fnCtsPopupOpener 위임.
     *   콜백 행: TRKORR(요청번호) / AS4TEXT(설명).
     ************************************************************************/
    function lf_RequestNoF4help(oModel) {
        try {
            oAPP.fn.fnCtsPopupOpener(function (param) {
                if (!param) { return; }
                oModel.setProperty(C_BIND + "/CREQN", param.TRKORR || "");
                oModel.setProperty(C_BIND + "/REQTX", param.AS4TEXT || "");
                // 요청번호 선택 완료 → 스테일 value-state 해제(저장 시 재검증).
                lf_clearVs(oModel, C_BIND + "/CREQN_vs", C_BIND + "/CREQN_tx");
            });
        } catch (e) {
            parent.showMessage(null, 20, "E", parent.WSUTIL.getWsMsgClsTxt("", "ZMSG_WS_COMMON_001", "950")); // Request value help is not available.
        }
    }

})();
