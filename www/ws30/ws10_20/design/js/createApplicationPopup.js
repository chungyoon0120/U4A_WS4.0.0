/**************************************************************************
 * createApplicationPopup.js  (HTML5)
 * ------------------------------------------------------------------------
 * [컨버전 메모]
 *  원본: sap.m.Dialog > IconTabHeader(General/DataSet/WebDynpro) + NavContainer
 *        + sap.ui.layout.form.Form + JSONModel(two-way binding) + footer Toolbar.
 *  HTML5: native <dialog class="u4a-dialog u4aCapDlg"> + 공통 컴포넌트
 *        (.u4a-form/.u4a-input/.u4a-field/.u4a-label/.u4a-field__msg + U4AUI.createSelect).
 *
 *  ★ "로직 보존, UI만 교체" 전략 (Login/WS20 과 동일):
 *   - 입력 점검(lf_chkValue)·패키지 점검(lf_chkPackage)·생성(lf_createAppData)·
 *     dataset 파라메터(lf_setDatasetParam)·기본값(lf_setDefaultVal*) 등 비즈니스 로직은
 *     거의 원본 그대로 — UI5 의존부만 치환:
 *       · JSONModel two-way binding → 간이 모델(getProperty/setProperty/bind/refresh) + DOM 동기.
 *       · sap.ui.getCore().lock()/unlock() → 제거(BusyDialog 가 시각 잠금 담당).
 *       · parent.showMessage(sap, ...) → parent.showMessage(null, ...) (resources/index.js showMessage 가 HTML5).
 *       · sap.m.* 컨트롤 → DOM + shell.css 컴포넌트.
 *   - 값도움(REQNR CTS / OBJECT NAME F4)·DataSet 필드리스트·WebDynpro 변환 탭은
 *     원본 호출부(oAPP.fn.callF4HelpPopup / fnCtsPopupOpener / _DATASET / conversionWebdynpro)를
 *     그대로 위임(별도 팝업 = 별도 작업 단위). 가드로 메인 생성 흐름은 깨지지 않게 한다.
 **************************************************************************/

(function () {
    "use strict";

    // DATASET 검색조건 LAYOUT 미리보기 이미지 경로(원본 유지).
    const DATASET_IMG_PREFIX = parent.PATH.join(parent.REMOTE.app.getAppPath(), "ws30", "ws10_20", "design", "image", "DATASET");
    const LAYOUT_IMG = ["COL1.jpg", "COL2.jpg", "COL3.jpg", "COL4.jpg"];

    const APPCOMMON = oAPP.common;

    // 메시지 클래스 텍스트 헬퍼 (원본 fnGetMsgClsText 6-인자 호출 그대로)
    function _txt(sCls, sCode, p1, p2, p3, p4) {
        try { return APPCOMMON.fnGetMsgClsText(sCls, sCode, p1 || "", p2 || "", p3 || "", p4 || ""); }
        catch (e) { return ""; }
    }
    const _fa = (sName) => '<i class="fa-solid fa-' + sName + '"></i>';


    /************************************************************************
     * 공통 스타일 1회 주입 (테마 토큰 소비 — 하드코딩 색 없음)
     ************************************************************************/
    function _ensureStyle() {
        if (document.getElementById("u4aCapStyle")) { return; }
        const oStyle = document.createElement("style");
        oStyle.id = "u4aCapStyle";
        oStyle.textContent = `
        .u4aCapDlg { width: min(72vw, 1080px); height: min(82vh, 720px); padding: 0; display: flex; flex-direction: column; }
        .u4aCapDlg .u4a-dialog__header { cursor: move; user-select: none; }
        .u4aCapDlg .u4a-dialog__header span { flex: 1 1 auto; }
        /* 닫기 X 스타일은 공통 .u4a-btn-icon(+data-act=close hover 빨강)으로 통일 — 개별 .u4aCapX 스타일 제거 */
        .u4aCapTabs { display: flex; gap: 0.25rem; padding: 0 1rem; border-bottom: 0.0625rem solid var(--line);
                      background: var(--surface); flex: 0 0 auto; }
        .u4aCapTab { appearance: none; border: 0; background: transparent; color: var(--text-muted);
                     font: inherit; font-weight: 600; padding: 0.625rem 0.875rem; cursor: pointer;
                     border-bottom: 0.125rem solid transparent; margin-bottom: -0.0625rem; white-space: nowrap; }
        .u4aCapTab:hover:not(:disabled) { color: var(--text); }
        .u4aCapTab[aria-selected="true"] { color: var(--accent); border-bottom-color: var(--accent); }
        .u4aCapTab:disabled { color: var(--disabled-text); opacity: var(--disabled-opacity); cursor: default; }
        .u4aCapBody { flex: 1 1 auto; overflow: auto; padding: 1.25rem 1.25rem 1.75rem; }
        .u4aCapPage[hidden] { display: none; }
        .u4aCapGrid { display: grid; grid-template-columns: 1fr; gap: 1rem 1.5rem; }
        .u4aCapGrid.u4aCap2col { grid-template-columns: 1fr 1fr; }
        @media (max-width: 720px) { .u4aCapGrid.u4aCap2col { grid-template-columns: 1fr; } }
        /* 2단 그리드의 각 컬럼(Dataset 좌/우) — 내부 행 간격을 General 단일그리드(row-gap 1rem)와 동일하게.
           (이게 없으면 컬럼 안 행들이 gap 없이 붙어 빽빽하게 보임) */
        .u4aCapCol { display: flex; flex-direction: column; gap: 1rem; min-width: 0; }
        .u4aCapRow { position: relative; display: flex; flex-direction: column; gap: 0.3125rem; }
        .u4aCapRow .u4a-field__msg { white-space: nowrap; }
        .u4aCapDesc { font-size: 0.8125rem; color: var(--text-muted); margin-top: 0.125rem; min-height: 1em; }
        /* 셀렉트(콤보) 에러 상태 — 입력 .u4a-input[data-vs=error] 와 동일하게 빨강 테두리.
           (.u4aCapDlg 스코프로 다이얼로그 필드 위계 규칙(.u4a-dialog .u4a-combo)을 이김) */
        .u4aCapDlg .u4aCapErr { border-color: var(--state-error); }
        .u4aCapRadios { display: flex; flex-wrap: wrap; gap: 0.5rem 1.25rem; align-items: center; min-height: 2.25rem; }
        .u4aCapRadio { display: inline-flex; align-items: center; gap: 0.375rem; cursor: pointer; color: var(--text); }
        .u4aCapRadio input { accent-color: var(--accent); width: 1rem; height: 1rem; cursor: pointer; }
        .u4aCapImg { width: 100%; height: 250px; object-fit: contain; background: var(--surface-raised);
                     border: 0.0625rem solid var(--line); border-radius: var(--radius-sm); }
        .u4aCapFoot { display: flex; gap: 0.5rem; align-items: center; }
        .u4aCapFoot .u4aCapSpacer { flex: 1 1 auto; }
        .u4aCapFoot .u4aCapSep { width: 0.0625rem; height: 1.5rem; background: var(--line); margin: 0 0.25rem; }
        `;
        // ※ 영역별 색 위계(헤더/푸터 chrome ▸ 바디 well ▸ 필드 pop + 상단 accent 띠)는
        //    공통 .u4a-dialog (shell.css) 로 통일 — 이 팝업만의 개별 스타일을 두지 않는다.
        document.head.appendChild(oStyle);
    }


    /************************************************************************
     * 간이 모델 (구 sap.ui.model.json.JSONModel 의 two-way binding 대체)
     *  - getProperty/setProperty/setData: 원본 호출부 그대로 동작.
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
            setData(d) { data = d || {}; this.refresh(); },
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
            setProperty(sPath, vVal) {
                const r = _resolve(sPath);
                r.parent[r.key] = vVal;
                this.refresh();
            },
            bind(fn) { aBind.push(fn); },
            refresh() { for (let i = 0; i < aBind.length; i++) { try { aBind[i](); } catch (e) { } } }
        };
    }


    /************************************************************************
     * DOM 빌드 헬퍼
     ************************************************************************/
    function _el(sTag, sClass, sText) {
        const o = document.createElement(sTag);
        if (sClass) { o.className = sClass; }
        if (typeof sText !== "undefined") { o.textContent = sText; }
        return o;
    }

    // label + control 슬롯 row. 반환: {row, control(붙일 컨테이너), msg(value state 텍스트)}
    function _row(sLabel, bRequired) {
        const oRow = _el("div", "u4a-form__row u4aCapRow");
        const oLabel = _el("label", "u4a-label" + (bRequired ? " u4a-label--required" : ""), sLabel);
        oRow.appendChild(oLabel);
        const oCtrl = _el("div", "u4aCapControl");
        oRow.appendChild(oCtrl);
        const oMsg = _el("div", "u4a-field__msg");
        oRow.appendChild(oMsg);
        return { row: oRow, label: oLabel, control: oCtrl, msg: oMsg };
    }

    // 일반 입력(+ 선택적 clear / value-help). cfg:
    //   {valPath, statPath, stxtPath, editPath, requPath, maxLength, upper, clear, vh(fn), readOnly}
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
                // clear(X) 글리프는 전 화면 공통(ws10/WS10/Login/WS20 = fa-xmark)과 동일하게 — 텍스트 "×" 금지.
                oClearBtn = _el("button", "u4a-field__clear");
                oClearBtn.type = "button";
                oClearBtn.title = "Clear";
                oClearBtn.tabIndex = -1;
                oClearBtn.innerHTML = _fa("xmark");
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

        if (cfg.maxLength) { oInput.maxLength = cfg.maxLength; }
        if (cfg.readOnly) { oInput.readOnly = true; }
        // 읽기 전용 표시 필드 — 편집 가능 필드와 구분되게 '잠긴' 톤(.u4a-input--display, shell.css).
        if (cfg.display) {
            oInput.classList.add("u4a-input--display");
            oInput.readOnly = true;
            oInput.tabIndex = -1;
        }

        // 입력 변경 → 모델 반영 (+ 대문자/추가 onChange)
        oInput.addEventListener("change", function () {
            let v = oInput.value;
            if (cfg.upper) { v = v.toUpperCase(); oInput.value = v; }
            oModel.setProperty(cfg.valPath, v);
            if (typeof cfg.onChange === "function") { cfg.onChange(oModel); }
        });

        // 입력 중(live) 부수효과 — 예: 패키지 수정 즉시 Request No 비활성(blur 까지 안 기다림).
        if (typeof cfg.onInput === "function") {
            oInput.addEventListener("input", function () { cfg.onInput(oModel, oInput); });
        }

        // 값도움 전용(읽기전용) 필드 — 활성 상태면 입력 영역 클릭만으로도 값도움 팝업을 연다(돋보기 버튼과 동일).
        if (bVh && cfg.readOnly) {
            oInput.addEventListener("click", function () {
                if (!oInput.disabled) { cfg.vh(oModel, oInput); }
            });
        }

        // clear 토글 (값 있을 때만 노출) — 공통 U4AUI.attachClear
        if (oClearBtn && window.U4AUI && U4AUI.attachClear) {
            U4AUI.attachClear(oInput, oClearBtn, function () {
                oModel.setProperty(cfg.valPath, "");
                // 연동 필드(예: Request No X → Request Desc)도 같이 비운다.
                if (Array.isArray(cfg.clearAlso)) {
                    cfg.clearAlso.forEach(function (sPath) { oModel.setProperty(sPath, ""); });
                }
                // 값 지움도 "변경"이다 — 예: 패키지 X 로 지우면 onChange(lf_packageChangeEvent)가
                //   돌아 Request No 가 비활성/초기화된다(타이핑 change 와 동일 경로).
                if (typeof cfg.onChange === "function") { cfg.onChange(oModel); }
            });
        }

        // 모델 → DOM 반영
        oModel.bind(function () {
            const v = oModel.getProperty(cfg.valPath);
            if (document.activeElement !== oInput) { oInput.value = (v == null ? "" : v); }

            // editable
            let bEdit = true;
            if (cfg.editPath) { bEdit = oModel.getProperty(cfg.editPath) !== false; }
            oInput.disabled = !bEdit;
            // 필드가 비활성(입력 불가)이면 값도움(F4) 버튼도 비활성 — 클릭 차단.
            if (oVhBtn) { oVhBtn.disabled = !bEdit; }
            // 값도움 전용 필드는 직접 타이핑 불가(읽기전용) — clear/F4 로만.
            if (cfg.readOnly) { oInput.readOnly = true; }
            // 값도움 전용 읽기필드: 활성일 때 입력 클릭으로 열 수 있음을 알리는 포인터 커서.
            if (bVh && cfg.readOnly) { oInput.style.cursor = bEdit ? "pointer" : ""; }

            // required (label 별표)
            if (cfg.requPath) {
                oRow.label.classList.toggle("u4a-label--required", oModel.getProperty(cfg.requPath) === true);
            }

            // value state
            const sStat = cfg.statPath ? oModel.getProperty(cfg.statPath) : null;
            if (sStat === "Error") { oInput.setAttribute("data-vs", "error"); }
            else { oInput.removeAttribute("data-vs"); }
            if (oRow.msg) { oRow.msg.textContent = cfg.stxtPath ? (oModel.getProperty(cfg.stxtPath) || "") : ""; }

            // clear filled 토글
            if (oWrap) {
                oWrap.setAttribute("data-filled", (oInput.value && !oInput.disabled) ? "true" : "false");
            }
        });

        return oInput;
    }

    // 커스텀 셀렉트(U4AUI.createSelect). cfg: {keyPath, items, enabledPath, onChange}
    function _buildSelect(oModel, oRow, cfg) {
        const aItems = (cfg.items || []).map(function (it) { return { value: it.KEY, text: it.TEXT }; });
        const oSel = U4AUI.createSelect(aItems, oModel.getProperty(cfg.keyPath), function (v) {
            oModel.setProperty(cfg.keyPath, v);
            if (typeof cfg.onChange === "function") { cfg.onChange(oModel); }
        });
        oRow.control.appendChild(oSel);

        oModel.bind(function () {
            oSel.value = oModel.getProperty(cfg.keyPath);
            if (cfg.enabledPath) {
                const bEn = oModel.getProperty(cfg.enabledPath) !== false;
                oSel.setAttribute("aria-disabled", bEn ? "false" : "true");
                oSel.style.pointerEvents = bEn ? "" : "none";
                oSel.tabIndex = bEn ? 0 : -1;
            }
            const sStat = cfg.statPath ? oModel.getProperty(cfg.statPath) : null;
            if (oRow.msg) { oRow.msg.textContent = cfg.stxtPath ? (oModel.getProperty(cfg.stxtPath) || "") : ""; }
            oSel.classList.toggle("u4aCapErr", sStat === "Error");
        });
        return oSel;
    }


    /************************************************************************
     * application 생성시 추가 입력정보 팝업 (구 oAPP.fn.createApplicationPopup)
     ************************************************************************/
    oAPP.fn.createApplicationPopup = async function (appid) {

        _ensureStyle();

        const oUIobj = { gen: {}, dataset: {}, UAWD: {}, path: {} };

        // 웹딘 -> U4A 컨버전 path (원본 유지).
        oUIobj.path.UAWD = parent.PATH.join(parent.getPath("WS10_20_ROOT"), "design",
            "createApplication", "conversionWebdynpro", "main", "view.js");

        const oModel = _createModel();

        // ★ 기본값(+ DDLB 항목 T_LANGU/T_CODPG/T_UITHM/T_APPTY)을 먼저 모델에 채운다.
        //   _buildSelect 가 빌드 시점에 oModel.oData.T_* 를 항목으로 읽으므로, 페이지 빌드
        //   "전"에 setData 가 끝나 있어야 셀렉트가 비지 않는다(구 UI5 aggregation 바인딩 대체).
        lf_setDefaultVal(oModel);

        // ── 다이얼로그 골격 ─────────────────────────────────────────────
        const oDlg = document.createElement("dialog");
        oDlg.className = "u4a-dialog u4aCapDlg";
        oUIobj.oCreateDialog = oDlg;

        // B05  Create Option
        const sTitle = _txt("/U4A/CL_WS_COMMON", "B05") + " : " + appid;

        const oHeader = _el("div", "u4a-dialog__header");
        oHeader.setAttribute("data-type", "I");
        // 헤더 아이콘은 메인 툴바 Create 버튼(WS10.js appCreateBtn: fa-file)과 동일하게 — 사용자 인지 통일.
        oHeader.innerHTML = _fa("file") + '<span></span>';
        oHeader.querySelector("span").textContent = sTitle;
        // 닫기 X — 다른 다이얼로그(Change Layout/Insert)와 동일하게 공통 .u4a-btn-icon + data-act="close".
        //   (.u4aCapX 는 드래그 제외용 JS 훅으로만 유지, 스타일은 공통 컴포넌트가 담당)
        const oXBtn = _el("button", "u4a-btn-icon u4aCapX");
        oXBtn.type = "button";
        oXBtn.setAttribute("data-act", "close");
        oXBtn.innerHTML = _fa("xmark");
        oXBtn.title = _txt("/U4A/CL_WS_COMMON", "A39"); // Close
        oXBtn.addEventListener("click", function () { lf_closeDialog(oDlg); });
        oHeader.appendChild(oXBtn);
        oDlg.appendChild(oHeader);

        // 탭바
        const oTabs = _el("div", "u4aCapTabs");
        oDlg.appendChild(oTabs);

        // 바디 (탭 페이지 컨테이너)
        const oBody = _el("div", "u4a-dialog__body u4aCapBody");
        oDlg.appendChild(oBody);

        // 푸터
        const oFoot = _el("div", "u4a-dialog__footer u4aCapFoot");
        oDlg.appendChild(oFoot);

        // ── 탭 정의 ────────────────────────────────────────────────────
        const sUserInfo = parent.getUserInfo();

        // 웹딘 컨버전 플러그인 설치 서버에서만 UAWD 탭 활성.
        let bUawdEnabled = false;
        if (sUserInfo.META && sUserInfo.META.T_PLIST &&
            sUserInfo.META.T_PLIST.find && sUserInfo.META.T_PLIST.find(function (it) { return it === "U4A_CVT_WDR"; })) {
            bUawdEnabled = true;
        }

        const aTabDef = [
            { key: "K01", text: parent.WSUTIL.getWsMsgClsTxt("", "ZMSG_WS_COMMON_001", "947"), enabled: true }, // General
            { key: "K02", text: _txt("/U4A/CL_WS_COMMON", "B26"), enabled: true }, // Data Set
            { key: "UAWD", text: parent.WSUTIL.getWsMsgClsTxt("", "ZMSG_WS_COMMON_001", "457"), enabled: bUawdEnabled } // Web Dynpro Conversion
        ];

        const oPages = {};       // key → page DOM
        const oTabBtns = {};     // key → tab button DOM

        function _selectTab(sKey) {
            if (oTabBtns[sKey] && oTabBtns[sKey].disabled) { return; }
            oModel.setProperty("/selHKey", sKey);
            Object.keys(oPages).forEach(function (k) {
                oPages[k].hidden = (k !== sKey);
                if (oTabBtns[k]) { oTabBtns[k].setAttribute("aria-selected", k === sKey ? "true" : "false"); }
            });
            // UAWD 탭은 최초 선택 시 lazy 로드.
            if (sKey === "UAWD" && !oUIobj.UAWD._loaded) { _loadUawdTab(); }
        }

        aTabDef.forEach(function (t) {
            const oBtn = _el("button", "u4aCapTab", t.text);
            oBtn.type = "button";
            oBtn.setAttribute("aria-selected", "false");
            if (!t.enabled) { oBtn.disabled = true; }
            oBtn.addEventListener("click", function () { _selectTab(t.key); });
            oTabs.appendChild(oBtn);
            oTabBtns[t.key] = oBtn;
        });

        // ── 페이지: General / DataSet ──────────────────────────────────
        oPages.K01 = lf_createGenUI(oModel, oUIobj);
        oPages.K02 = lf_createDatasetUI(oModel, oUIobj);
        oPages.UAWD = _el("div", "u4aCapPage");
        oPages.UAWD.hidden = true;
        oBody.append(oPages.K01, oPages.K02, oPages.UAWD);

        // WebDynpro 변환 탭 lazy 로드 (원본 동적 import 위임).
        async function _loadUawdTab() {
            oUIobj.UAWD._loaded = true;
            try {
                const oView = await import(oUIobj.path.UAWD);
                oUIobj.UAWD.oContr = await oView.createView({ APPID: appid, PRCCD: "CREATE_APP" });
                const oRoot = oUIobj.UAWD.oContr.ui && oUIobj.UAWD.oContr.ui.ROOT;
                if (oRoot) { oPages.UAWD.appendChild(oRoot); }
            } catch (e) {
                if (typeof console !== "undefined") { console.warn("[createApp] UAWD load error", e); }
                oPages.UAWD.appendChild(_el("div", "u4aCapDesc",
                    "Web Dynpro Conversion view를 불러오지 못했습니다. (" + (e && e.message) + ")"));
            }
        }

        // ── 푸터 버튼 ──────────────────────────────────────────────────
        oFoot.appendChild(_el("span", "u4aCapSpacer"));

        // B06 Local Object / B07 Create Local Application
        const oLocal = _el("button", "u4a-btn");
        oLocal.type = "button";
        oLocal.innerHTML = _fa("desktop") + '<span></span>';
        oLocal.querySelector("span").textContent = _txt("/U4A/CL_WS_COMMON", "B06");
        oLocal.title = _txt("/U4A/CL_WS_COMMON", "B07");
        oLocal.addEventListener("click", function () { lf_createApplication(oModel, oUIobj, appid, true); });
        oFoot.appendChild(oLocal);

        oFoot.appendChild(_el("span", "u4aCapSep"));

        // A01 Create / B08 Create Application
        const oCreate = _el("button", "u4a-btn u4a-btn--emphasized");
        oCreate.type = "button";
        oCreate.innerHTML = _fa("check") + '<span></span>';
        oCreate.querySelector("span").textContent = _txt("/U4A/CL_WS_COMMON", "A01");
        oCreate.title = _txt("/U4A/CL_WS_COMMON", "B08");
        oCreate.addEventListener("click", function () { lf_createApplication(oModel, oUIobj, appid, false); });
        oFoot.appendChild(oCreate);

        // A39 Close — 원본 UI5 Reject 느낌(빨강 텍스트/아이콘 + 옅은 호버 틴트, --negative).
        const oClose = _el("button", "u4a-btn u4a-btn--negative");
        oClose.type = "button";
        oClose.innerHTML = _fa("xmark") + '<span></span>';
        oClose.querySelector("span").textContent = _txt("/U4A/CL_WS_COMMON", "A39");
        oClose.title = _txt("/U4A/CL_WS_COMMON", "A39");
        oClose.addEventListener("click", function () { lf_closeDialog(oDlg); });
        oFoot.appendChild(oClose);

        // ── 최초 렌더(K01) — 모델→DOM 동기 ─────────────────────────────
        _selectTab("K01");

        // ESC → 닫기(취소 메시지).
        oDlg.addEventListener("cancel", function (e) { e.preventDefault(); lf_closeDialog(oDlg); });

        // 헤더 드래그(화면 밖/상단 공통헤더 침범 방지) / 더블클릭 리센터 / grip 리사이즈 — 공통 U4AUI.
        if (window.U4AUI && U4AUI.makeDialogDraggable) { U4AUI.makeDialogDraggable(oDlg, oHeader); }
        if (window.U4AUI && U4AUI.makeDialogRecenter) { U4AUI.makeDialogRecenter(oDlg, oHeader); }
        if (window.U4AUI && U4AUI.makeDialogResizable) { U4AUI.makeDialogResizable(oDlg, { minW: 480, minH: 360 }); }

        document.body.appendChild(oDlg);
        oDlg.showModal();

    }; // end of oAPP.fn.createApplicationPopup


    // 헤더 드래그는 공통 U4AUI.makeDialogDraggable 사용(화면 밖/상단 헤더 클램프). 로컬 _attachDrag 제거.


    /************************************************************************
     * application 일반 정보 UI 영역 (구 lf_createGenUI)
     ************************************************************************/
    function lf_createGenUI(oModel, oUIobj) {

        const oPage = _el("div", "u4aCapPage");
        const oGrid = _el("div", "u4aCapGrid");
        oPage.appendChild(oGrid);

        // APP Description (A91)
        let oR = _row(_txt("/U4A/CL_WS_COMMON", "A91"), true);
        oUIobj.gen.oInpDesc = _buildInput(oModel, oR, {
            valPath: "/CREATE/APPNM", statPath: "/CREATE/APPNM_stat", stxtPath: "/CREATE/APPNM_stxt",
            maxLength: 40, clear: true
        });
        oGrid.appendChild(oR.row);

        // Language Key (A98) — ComboBox → createSelect
        oR = _row(_txt("/U4A/CL_WS_COMMON", "A98"), true);
        oUIobj.gen.oInpLang = _buildSelect(oModel, oR, {
            keyPath: "/CREATE/LANGU", items: oModel.oData.T_LANGU,
            statPath: "/CREATE/LANGU_stat", stxtPath: "/CREATE/LANGU_stxt"
        });
        oGrid.appendChild(oR.row);

        // Character Format (A99)
        oR = _row(_txt("/U4A/CL_WS_COMMON", "A99"), false);
        oUIobj.gen.oSelFormat = _buildSelect(oModel, oR, {
            keyPath: "/CREATE/CODPG", items: oModel.oData.T_CODPG,
            statPath: "/CREATE/CODPG_stat", stxtPath: "/CREATE/CODPG_stxt"
        });
        oGrid.appendChild(oR.row);

        // UI5 UI Theme (B01)
        oR = _row(_txt("/U4A/CL_WS_COMMON", "B01"), false);
        oUIobj.gen.oSelTheme = _buildSelect(oModel, oR, {
            keyPath: "/CREATE/UITHM", items: oModel.oData.T_UITHM,
            statPath: "/CREATE/UITHM_stat", stxtPath: "/CREATE/UITHM_stxt"
        });
        oGrid.appendChild(oR.row);

        // Web Application Type (B02)
        oR = _row(_txt("/U4A/CL_WS_COMMON", "B02"), false);
        oUIobj.gen.oSelType = _buildSelect(oModel, oR, {
            keyPath: "/CREATE/APPTY", items: oModel.oData.T_APPTY, enabledPath: "/CREATE/APPTY_edit"
        });
        oGrid.appendChild(oR.row);

        // Package (A22)
        oR = _row(_txt("/U4A/CL_WS_COMMON", "A22"), true);
        oUIobj.gen.oInpPack = _buildInput(oModel, oR, {
            valPath: "/CREATE/PACKG", statPath: "/CREATE/PACKG_stat", stxtPath: "/CREATE/PACKG_stxt",
            editPath: "/CREATE/PACKG_edit", maxLength: 30, upper: true, clear: true,
            onChange: lf_packageChangeEvent, onInput: lf_packageLiveReset
        });
        oGrid.appendChild(oR.row);

        // Request No (B03) — value help only (CTS F4)
        oR = _row(_txt("/U4A/CL_WS_COMMON", "B03"), false);
        oUIobj.gen.oInpReqNo = _buildInput(oModel, oR, {
            valPath: "/CREATE/REQNR", statPath: "/CREATE/REQNR_stat", stxtPath: "/CREATE/REQNR_stxt",
            editPath: "/CREATE/REQNR_edit", requPath: "/CREATE/REQNR_requ", maxLength: 20,
            readOnly: true, clear: true, clearAlso: ["/CREATE/REQTX"], vh: lf_RequestF4help
        });
        oGrid.appendChild(oR.row);

        // Request Desc (B04) — 읽기 전용(Request No 선택 시 자동 채움). 편집 가능 필드와 '잠긴 톤'으로 구분.
        oR = _row(_txt("/U4A/CL_WS_COMMON", "B04"), false);
        oUIobj.gen.oInpReqTx = _buildInput(oModel, oR, { valPath: "/CREATE/REQTX", display: true });
        oGrid.appendChild(oR.row);

        return oPage;
    }


    /************************************************************************
     * application dataset 정보 UI 영역 (구 lf_createDatasetUI)
     ************************************************************************/
    function lf_createDatasetUI(oModel, oUIobj) {

        const oPage = _el("div", "u4aCapPage");
        const oGrid = _el("div", "u4aCapGrid u4aCap2col");
        oPage.appendChild(oGrid);

        // ── 좌측 컨테이너 ──────────────────────────────────────────────
        const oLeft = _el("div", "u4aCapCol");
        oGrid.appendChild(oLeft);

        // Object Type radio (B27): Database View(B28) / Transparent Table(B29)
        let oR = _row(_txt("/U4A/CL_WS_COMMON", "B27"), false);
        const oRadios = _el("div", "u4aCapRadios");
        const aObjType = [
            { txt: _txt("/U4A/CL_WS_COMMON", "B28"), prop: "RB01" },
            { txt: _txt("/U4A/CL_WS_COMMON", "B29"), prop: "RB02" }
        ];
        const aObjRb = [];
        aObjType.forEach(function (o, idx) {
            const oLab = _el("label", "u4aCapRadio");
            const oRb = _el("input");
            oRb.type = "radio";
            oRb.name = "u4aCapObjType";
            oRb.addEventListener("change", function () {
                oModel.setProperty("/DATASET/RB01", idx === 0);
                oModel.setProperty("/DATASET/RB02", idx === 1);
                lf_setObjectNameDesc(oModel); // object name desc 갱신
            });
            aObjRb.push(oRb);
            oLab.append(oRb, _el("span", null, o.txt));
            oRadios.appendChild(oLab);
        });
        oR.control.appendChild(oRadios);
        oModel.bind(function () {
            aObjRb[0].checked = oModel.getProperty("/DATASET/RB01") === true;
            aObjRb[1].checked = oModel.getProperty("/DATASET/RB02") === true;
        });
        oLeft.appendChild(oR.row);

        // Object Name (OBJNM 라벨은 모델 바인딩) — view/table 입력 + F4
        oR = _row("", true);
        oModel.bind(function () { oR.label.textContent = oModel.getProperty("/DATASET/OBJNM") || ""; });
        oUIobj.dataset.oInp1 = _buildInput(oModel, oR, {
            valPath: "/DATASET/TABNM", statPath: "/DATASET/TABNM_stat", stxtPath: "/DATASET/TABNM_stxt",
            maxLength: 16, upper: true, clear: true, vh: lf_ObjNameF4Help
        });
        // view(table) desc
        const oObjDesc = _el("div", "u4aCapDesc");
        oModel.bind(function () { oObjDesc.textContent = oModel.getProperty("/DATASET/TABTX") || ""; });
        oR.row.appendChild(oObjDesc);
        oLeft.appendChild(oR.row);

        // APP Description (A91)
        oR = _row(_txt("/U4A/CL_WS_COMMON", "A91"), true);
        oUIobj.dataset.oInpDesc = _buildInput(oModel, oR, {
            valPath: "/DATASET/APPNM", statPath: "/DATASET/APPNM_stat", stxtPath: "/DATASET/APPNM_stxt",
            maxLength: 40, clear: true
        });
        oLeft.appendChild(oR.row);

        // Language Key (A98)
        oR = _row(_txt("/U4A/CL_WS_COMMON", "A98"), true);
        oUIobj.dataset.oInpLang = _buildSelect(oModel, oR, {
            keyPath: "/DATASET/LANGU", items: oModel.oData.T_LANGU,
            statPath: "/DATASET/LANGU_stat", stxtPath: "/DATASET/LANGU_stxt"
        });
        oLeft.appendChild(oR.row);

        // Character Format (A99)
        oR = _row(_txt("/U4A/CL_WS_COMMON", "A99"), false);
        oUIobj.dataset.oSelFormat = _buildSelect(oModel, oR, {
            keyPath: "/DATASET/CODPG", items: oModel.oData.T_CODPG,
            statPath: "/DATASET/CODPG_stat", stxtPath: "/DATASET/CODPG_stxt"
        });
        oLeft.appendChild(oR.row);

        // UI5 UI Theme (B01) — 변경 시 미리보기 이미지 갱신
        oR = _row(_txt("/U4A/CL_WS_COMMON", "B01"), false);
        oUIobj.dataset.oSelTheme = _buildSelect(oModel, oR, {
            keyPath: "/DATASET/UITHM", items: oModel.oData.T_UITHM,
            statPath: "/DATASET/UITHM_stat", stxtPath: "/DATASET/UITHM_stxt",
            onChange: lf_setSearchLayoutImage
        });
        oLeft.appendChild(oR.row);

        // Package (A22)
        oR = _row(_txt("/U4A/CL_WS_COMMON", "A22"), true);
        oUIobj.dataset.oInpPack = _buildInput(oModel, oR, {
            valPath: "/DATASET/PACKG", statPath: "/DATASET/PACKG_stat", stxtPath: "/DATASET/PACKG_stxt",
            editPath: "/DATASET/PACKG_edit", maxLength: 30, upper: true, clear: true,
            onChange: lf_packageChangeEvent, onInput: lf_packageLiveReset
        });
        oLeft.appendChild(oR.row);

        // Request No (B03)
        oR = _row(_txt("/U4A/CL_WS_COMMON", "B03"), false);
        oUIobj.dataset.oInpReqNo = _buildInput(oModel, oR, {
            valPath: "/DATASET/REQNR", statPath: "/DATASET/REQNR_stat", stxtPath: "/DATASET/REQNR_stxt",
            editPath: "/DATASET/REQNR_edit", requPath: "/DATASET/REQNR_requ", maxLength: 20,
            readOnly: true, clear: true, clearAlso: ["/DATASET/REQTX"], vh: lf_RequestF4help
        });
        oLeft.appendChild(oR.row);

        // Request Desc (B04) — 읽기 전용(General 탭과 동일하게 '잠긴 톤'으로 구분)
        oR = _row(_txt("/U4A/CL_WS_COMMON", "B04"), false);
        oUIobj.dataset.oInpReqTx = _buildInput(oModel, oR, { valPath: "/DATASET/REQTX", display: true });
        oLeft.appendChild(oR.row);

        // ── 우측 컨테이너: Search Layout ───────────────────────────────
        const oRight = _el("div", "u4aCapCol");
        oGrid.appendChild(oRight);

        // Search Layout radio (E09): One/Two/Three/Four columns (E12~E15)
        oR = _row(_txt("/U4A/CL_WS_COMMON", "E09"), false);
        const oScRadios = _el("div", "u4aCapRadios");
        const aScTxt = [
            _txt("/U4A/CL_WS_COMMON", "E12"), _txt("/U4A/CL_WS_COMMON", "E13"),
            _txt("/U4A/CL_WS_COMMON", "E14"), _txt("/U4A/CL_WS_COMMON", "E15")
        ];
        const aScRb = [];
        aScTxt.forEach(function (sTxt, idx) {
            const oLab = _el("label", "u4aCapRadio");
            const oRb = _el("input");
            oRb.type = "radio";
            oRb.name = "u4aCapSearchLayout";
            oRb.addEventListener("change", function () {
                oModel.setProperty("/DATASET/SCCNT", idx);
                lf_setSearchLayoutImage(oModel);
            });
            aScRb.push(oRb);
            oLab.append(oRb, _el("span", null, sTxt));
            oScRadios.appendChild(oLab);
        });
        oR.control.appendChild(oScRadios);
        oModel.bind(function () {
            const i = oModel.getProperty("/DATASET/SCCNT") || 0;
            aScRb.forEach(function (rb, idx) { rb.checked = (idx === i); });
        });
        oRight.appendChild(oR.row);

        // 미리보기 이미지
        const oImgRow = _el("div", "u4a-form__row u4aCapRow");
        const oImg = _el("img", "u4aCapImg");
        oModel.bind(function () { oImg.src = oModel.getProperty("/DATASET/imgsrc") || ""; });
        oImgRow.appendChild(oImg);
        oRight.appendChild(oImgRow);

        return oPage;
    }


    /************************************************************************
     * 점검 로직 (원본 유지)
     ************************************************************************/
    // standard package 입력 여부 점검.
    function lf_chkPackageStandard(is_appl) {
        if (is_appl.PACKG !== "" &&
            is_appl.PACKG !== "$TMP" &&
            is_appl.PACKG.substr(0, 1) !== "Y" &&
            is_appl.PACKG.substr(0, 1) !== "Z") {
            is_appl.PACKG_stat = "Error";
            // 275 Standard package cannot be entered.
            is_appl.PACKG_stxt = _txt("/U4A/MSG_WS", "275");
            return true;
        }
    }

    // application 생성전 입력값 점검.
    function lf_chkValue(oModel, oUIobj) {

        let l_stru = "";
        const l_selHKey = oModel.getProperty("/selHKey");
        let oFocusUI, ls_ui;

        switch (l_selHKey) {
            case "K01": l_stru = "/CREATE"; ls_ui = oUIobj["gen"]; break;
            case "K02": l_stru = "/DATASET"; ls_ui = oUIobj["dataset"]; break;
            default: return;
        }

        const ls_appl = oModel.getProperty(l_stru);

        // valueState 바인딩 필드 초기화.
        lf_resetValueStateField(ls_appl);

        let l_err = false;

        // dataset의 table명을 입력하지 않은경우.
        if (l_selHKey === "K02" && ls_appl.TABNM === "") {
            ls_appl.TABNM_stat = "Error";
            ls_appl.TABNM_stxt = _txt("/U4A/MSG_WS", "014", _txt("/U4A/CL_WS_COMMON", "A33"));
            l_err = true;
            oFocusUI = ls_ui.oInp1;
        }

        // Web Application Name 미입력 (K01).
        if (ls_appl.APPNM === "" && l_selHKey === "K01") {
            ls_appl.APPNM_stat = "Error";
            ls_appl.APPNM_stxt = _txt("/U4A/MSG_WS", "014", _txt("/U4A/CL_WS_COMMON", "A33"));
            l_err = true;
            if (!oFocusUI) { oFocusUI = ls_ui.oInpDesc; }
        }

        // language 미입력.
        if (ls_appl.LANGU === "") {
            ls_appl.LANGU_stat = "Error";
            ls_appl.LANGU_stxt = _txt("/U4A/MSG_WS", "014", _txt("/U4A/CL_WS_COMMON", "A98"));
            l_err = true;
            if (!oFocusUI) { oFocusUI = ls_ui.oInpLang; }
        }

        // Package 미입력.
        if (ls_appl.PACKG === "") {
            ls_appl.PACKG_stat = "Error";
            ls_appl.PACKG_stxt = _txt("/U4A/MSG_WS", "014", _txt("/U4A/CL_WS_COMMON", "A22"));
            l_err = true;
            if (!oFocusUI) { oFocusUI = ls_ui.oInpPack; }
        }

        // Y, Z 이외 패키지명.
        if (lf_chkPackageStandard(ls_appl) === true) {
            l_err = true;
            if (!oFocusUI) { oFocusUI = ls_ui.oInpPack; }
        }

        // 개발 패키지인데 CTS 미입력.
        if (ls_appl.PACKG !== "$TMP" && ls_appl.PACKG !== "" && ls_appl.REQNR === "") {
            ls_appl.REQNR_stat = "Error";
            // 277 If not a local object, Request No. is required entry value.
            ls_appl.REQNR_stxt = _txt("/U4A/MSG_WS", "277");
            l_err = true;
            if (!oFocusUI) { oFocusUI = ls_ui.oInpReqNo; }
        }

        if (l_err === true) {
            oModel.setProperty(l_stru, ls_appl);
            // 274 Check input value.
            parent.showMessage(null, 20, "E", _txt("/U4A/MSG_WS", "274"), function () {
                if (oFocusUI && oFocusUI.focus) { oFocusUI.focus(); }
            });
            return l_err;
        }

        oModel.setProperty(l_stru, ls_appl);
    }

    // 입력 package 점검 function.
    function lf_chkPackage(oModel, is_create) {

        // busy dialog open.
        parent.setBusy("X");

        const oFormData = new FormData();
        oFormData.append("PACKG", is_create.PACKG);

        sendAjax(parent.getServerPath() + "/chkPackage", oFormData, function (ret) {

            parent.setBusy("");

            const ls_stru = lf_getStruName(oModel);
            if (!ls_stru) { return; }

            // 잘못된 PACKAGE — 필드 인라인 에러로만 표시.
            //   [UX 통일] 구 원본은 인라인(PACKG_stxt) + 모달 팝업(showMessage)을 둘 다 띄워,
            //   같은 '패키지 입력 오류'인데 표준/미입력(인라인만)과 달리 이 케이스만 팝업이 떠
            //   일관성이 깨졌다. → 폼의 다른 필드 검증과 동일하게 인라인만 남기고 팝업 제거.
            //   (메시지 내용 ret.ERMSG 는 인라인에 그대로 표시 → 정보 손실 없음)
            if (ret.ERFLG === "X") {
                is_create.PACKG_stat = "Error";
                is_create.PACKG_stxt = ret.ERMSG;
                oModel.setProperty(ls_stru, is_create);
                return;
            }

            // 점검 중 오류 — 동일하게 인라인 에러로만 표시(팝업 제거).
            if (ret.ERFLG === "E") {
                is_create.PACKG_stat = "Error";
                is_create.PACKG_stxt = ret.ERMSG;
                oModel.setProperty(ls_stru, is_create);
                return;
            }

            // 로컬 PACKAGE.
            if (ret.ISLOCAL === "X") {
                is_create.REQNR_edit = false;
                is_create.REQNR_requ = false;
                is_create.REQNR = "";
                is_create.REQTX = "";
            } else if (ret.ISLOCAL === "") {
                is_create.REQNR_edit = true;
                is_create.REQNR_requ = true;
            }

            oModel.setProperty(ls_stru, is_create);

        }, "", true, "POST", function () { /* 오류 시 별도 처리 없음 */ });
    }

    // package 입력값 변경 이벤트.
    function lf_packageChangeEvent(oModel) {

        const ls_stru = lf_getStruName(oModel);
        if (!ls_stru) { return; }

        const l_create = oModel.getProperty(ls_stru);

        lf_resetValueStateField(l_create);

        l_create.REQNR_edit = false;
        l_create.REQNR_requ = false;

        if (l_create.PACKG === "") {
            // 패키지를 비우면 Request No 값/설명도 비운다(비활성 필드에 잔값 방지).
            l_create.REQNR = "";
            l_create.REQTX = "";
            oModel.setProperty(ls_stru, l_create);
            return;
        }

        l_create.PACKG = l_create.PACKG.toUpperCase();

        // 로컬 패키지.
        if (l_create.PACKG === "$TMP") {
            l_create.REQNR = "";
            l_create.REQTX = "";
            oModel.setProperty(ls_stru, l_create);
            return;
        }

        // standard package.
        if (lf_chkPackageStandard(l_create) === true) {
            oModel.setProperty(ls_stru, l_create);
            return;
        }

        // Y,Z 패키지 정합성 점검(서버).
        lf_chkPackage(oModel, l_create);
    }

    // 패키지 입력 중(live) — Request No 즉시 비활성 + 초기화. (정합성 재검은 blur 의 lf_packageChangeEvent)
    //   이미 비활성+빈값이면 skip 해 키 입력마다 불필요한 refresh 를 막는다.
    function lf_packageLiveReset(oModel, oInput) {
        const ls_stru = lf_getStruName(oModel);
        if (!ls_stru) { return; }
        const l_create = oModel.getProperty(ls_stru);
        // 모델 PACKG 를 현재 입력값과 동기 — clear(X)/타이핑 시 모델-DOM 불일치로
        //   refresh 가 패키지 입력을 옛 값으로 되돌리는 것을 막는다.
        if (oInput) { l_create.PACKG = oInput.value || ""; }
        if (l_create.REQNR_edit === false && !l_create.REQNR && !l_create.REQTX) { return; }
        l_create.REQNR_edit = false;
        l_create.REQNR_requ = false;
        l_create.REQNR = "";
        l_create.REQTX = "";
        oModel.setProperty(ls_stru, l_create);
    }

    // valueState 바인딩 필드 초기화.
    function lf_resetValueStateField(cs_appl) {
        cs_appl.APPNM_stat = null;
        cs_appl.LANGU_stat = null;
        cs_appl.CODPG_stat = null;
        cs_appl.UITHM_stat = null;
        cs_appl.PACKG_stat = null;
        cs_appl.REQNR_stat = null;
        cs_appl.APPNM_stxt = null;
        cs_appl.LANGU_stxt = null;
        cs_appl.CODPG_stxt = null;
        cs_appl.UITHM_stxt = null;
        cs_appl.PACKG_stxt = null;
        cs_appl.REQNR_stxt = null;
        if (cs_appl.itemKey === "K02") {
            cs_appl.TABNM_stat = null;
            cs_appl.TABNM_stxt = null;
        }
    }


    /************************************************************************
     * 기본값 설정 (원본 유지)
     ************************************************************************/
    function lf_setDefaultVal(oModel) {

        const ls_appl = lf_setDefaultValGeneral();
        const ls_dataset = lf_setDefaultValDataset();

        const l_userInfo = parent.getUserInfo();

        // Language Key DDLB
        const T_LANGU = [];
        for (let i = 0, l = l_userInfo.META.T_LANGU.length; i < l; i++) {
            T_LANGU.push({ KEY: l_userInfo.META.T_LANGU[i].SPRAS, TEXT: l_userInfo.META.T_LANGU[i].SPTXT });
        }

        // Character Format DDLB
        const T_CODPG = [{ KEY: "utf-8", TEXT: "utf-8" }, { KEY: "EUC-KR", TEXT: "EUC-KR" }];

        // UI5 UI Theme DDLB
        const T_UITHM = [];
        for (let i = 0, l = l_userInfo.META.T_REG_THEME.length; i < l; i++) {
            T_UITHM.push({ KEY: l_userInfo.META.T_REG_THEME[i].THEME, TEXT: l_userInfo.META.T_REG_THEME[i].THEME });
        }

        // Web Application Type DDLB
        const T_APPTY = [];
        for (let i = 0, l = l_userInfo.META.T_APPTY.length; i < l; i++) {
            T_APPTY.push({ KEY: l_userInfo.META.T_APPTY[i].KEY, TEXT: l_userInfo.META.T_APPTY[i].TEXT });
        }

        oModel.setData({
            "selHKey": "K01",
            "CREATE": ls_appl,
            "DATASET": ls_dataset,
            "T_LANGU": T_LANGU,
            "T_CODPG": T_CODPG,
            "T_UITHM": T_UITHM,
            "T_APPTY": T_APPTY
        });
    }

    // General 초기값.
    function lf_setDefaultValGeneral() {
        const ls_appl = {};
        ls_appl.itemKey = "K01";
        ls_appl.APPNM = "";

        const ls_userInfo = parent.getUserInfo();
        ls_appl.LANGU = "E";
        if (ls_userInfo && ls_userInfo.META.LANGU) { ls_appl.LANGU = ls_userInfo.META.LANGU; }

        ls_appl.CODPG = "utf-8";
        ls_appl.UITHM = "sap_horizon";
        const ls_theme = ls_userInfo.META.T_REG_THEME.find(function (a) { return a.ISDEF === "X"; });
        if (ls_theme) { ls_appl.UITHM = ls_theme.THEME; }

        ls_appl.APPTY = "M";
        ls_appl.APPTY_edit = true;

        ls_appl.PACKG = "";
        ls_appl.PACKG_edit = true;
        if (parent.getIsTrial()) { ls_appl.PACKG = "$TMP"; ls_appl.PACKG_edit = false; }

        ls_appl.REQNR = "";
        ls_appl.REQTX = "";
        ls_appl.REQNR_edit = false;
        ls_appl.REQNR_requ = false;

        lf_resetValueStateField(ls_appl);
        return ls_appl;
    }

    // dataset 초기값.
    function lf_setDefaultValDataset() {
        const ls_appl = {};
        ls_appl.itemKey = "K02";
        ls_appl.APPNM = "";

        const ls_userInfo = parent.getUserInfo();
        ls_appl.LANGU = "E";
        if (ls_userInfo && ls_userInfo.META.LANGU) { ls_appl.LANGU = ls_userInfo.META.LANGU; }

        ls_appl.CODPG = "utf-8";
        ls_appl.UITHM = "sap_horizon";
        const ls_theme = ls_userInfo.META.T_REG_THEME.find(function (a) { return a.ISDEF === "X"; });
        if (ls_theme) { ls_appl.UITHM = ls_theme.THEME; }

        ls_appl.APPTY = "M";

        ls_appl.PACKG = "";
        ls_appl.PACKG_edit = true;
        if (parent.getIsTrial()) { ls_appl.PACKG = "$TMP"; ls_appl.PACKG_edit = false; }

        ls_appl.REQNR = "";
        ls_appl.REQTX = "";
        ls_appl.REQNR_edit = false;
        ls_appl.REQNR_requ = false;

        ls_appl.RB01 = true;   // Database View
        ls_appl.RB02 = false;  // Transparent Table
        ls_appl.TABNM = "";
        ls_appl.TABTX = "";
        ls_appl.FLIST = "";
        ls_appl.SCCNT = 0;
        ls_appl.imgsrc = DATASET_IMG_PREFIX + "/" + ls_appl.UITHM + "/" + LAYOUT_IMG[0];
        ls_appl.OBJNM = _txt("/U4A/CL_WS_COMMON", "B28"); // Database View

        lf_resetValueStateField(ls_appl);
        return ls_appl;
    }


    /************************************************************************
     * dialog 종료 처리 (구 lf_closeDialog)
     ************************************************************************/
    function lf_closeDialog(oDlg, bSkipMsg) {
        try { oDlg.close(); } catch (e) { }
        try { oDlg.remove(); } catch (e) { }
        if (bSkipMsg === true) { return; }
        // 001 Cancel operation
        parent.showMessage(null, 10, "I", _txt("/U4A/MSG_WS", "001"));
    }


    /************************************************************************
     * dataset 파라메터 추가 처리 (원본 유지)
     ************************************************************************/
    function lf_setDatasetParam(oModel, oForm) {

        if (oModel.getProperty("/selHKey") !== "K02") { return; }

        const l_dataset = oModel.getProperty("/DATASET");
        if (l_dataset.TABNM === "") { return; }

        const l_param = {};
        l_param.TABNM = l_dataset.TABNM;
        l_param.FLIST = l_dataset.FLIST;
        l_param.SCCNT = l_dataset.SCCNT + 1;

        switch (true) {
            case l_dataset.RB01: l_param.TABTY = "V"; break;
            case l_dataset.RB02: l_param.TABTY = "T"; break;
            default: break;
        }

        oForm.append("DATASET", JSON.stringify(l_param));

        let l_fileName = "databaseview_layo01.json";
        if (oAPP.common.checkWLOList("C", "UHAK900630") === true) {
            l_fileName = "databaseview_layo02.json";
        }

        const l_layo = parent.require(parent.PATH.join(parent.REMOTE.app.getAppPath(),
            "ws30", "ws10_20", "design", "template", "dataset", l_fileName));
        if (!l_layo) { return; }

        oForm.append("DATASET_LAYO", JSON.stringify(l_layo));
    }


    /************************************************************************
     * application 생성처리를 위한 서버 호출 (구 lf_createAppData)
     ************************************************************************/
    function lf_createAppData(oModel, oUIobj, appid) {

        parent.setBusy("X");

        const ls_stru = lf_getStruName(oModel);
        if (!ls_stru) { return; }

        const l_create = oModel.getProperty(ls_stru);
        const l_appdata = {};
        l_appdata.APPID = appid;
        l_appdata.APPNM = l_create.APPNM;
        l_appdata.LANGU = l_create.LANGU;
        l_appdata.APPTY = l_create.APPTY;
        l_appdata.CODPG = l_create.CODPG;
        l_appdata.UITHM = l_create.UITHM;
        l_appdata.PACKG = l_create.PACKG;
        l_appdata.REQNR = l_create.REQNR;

        let l_path = "/createAppData";
        if (l_appdata.APPTY === "U") { l_path = "/USP_CREATEAPPDATA"; }

        const oFormData = new FormData();
        oFormData.append("APPDATA", JSON.stringify(l_appdata));

        lf_setDatasetParam(oModel, oFormData);

        sendAjax(parent.getServerPath() + l_path, oFormData, function (ret) {

            parent.setBusy("");

            // 생성중 오류.
            if (ret.RETCD === "E") {
                parent.showMessage(null, 20, "E", ret.RTMSG);
                parent.setBusy("");
                return;
            }

            // 생성 성공 → editor 화면으로 이동.
            onAppCrAndChgMode(appid);

            // dialog 종료(취소 메시지 skip).
            lf_closeDialog(oUIobj.oCreateDialog, true);

        }, "", true, "POST", function () { /* 오류 시 별도 처리 없음 */ });
    }


    /************************************************************************
     * 어플리케이션 생성 처리 (구 lf_createApplication)
     ************************************************************************/
    async function lf_createApplication(oModel, oUIobj, appid, bIsLocal) {

        parent.setBusy("X");

        // WEBDYNPRO → U4A 컨버전 생성.
        if (oModel.oData.selHKey === "UAWD") {
            const _sParam = {};
            _sParam.ACTCD = "CREATE_APP";
            _sParam.APPID = appid;
            _sParam.ISLOCAL = bIsLocal;
            _sParam.oUIobj = oUIobj;
            try {
                const _oCEvt = new CustomEvent("conversionWebdynpro", { detail: _sParam });
                oUIobj.UAWD.oContr.onEvt.dispatchEvent(_oCEvt);
            } catch (e) {
                parent.setBusy("");
                parent.showMessage(null, 20, "E", parent.WSUTIL.getWsMsgClsTxt("", "ZMSG_WS_COMMON_001", "948")); // Web Dynpro Conversion is not available.
            }
            return;
        }

        const l_stru = lf_getStruName(oModel);
        if (!l_stru) { parent.setBusy(""); return; }

        const l_create = oModel.getProperty(l_stru);
        if (!l_create) { parent.setBusy(""); return; }

        // 로컬로 생성.
        if (bIsLocal === true) {
            l_create.PACKG = "$TMP";
            l_create.REQNR_edit = false;
            l_create.REQNR_requ = false;
            l_create.REQNR = "";
            l_create.REQTX = "";
            oModel.setProperty(l_stru, l_create);
        }

        // 입력값 점검.
        if (lf_chkValue(oModel, oUIobj) === true) {
            parent.setBusy("");
            return;
        }

        parent.setBusy("");

        // DataSet: VIEW(TABLE)명을 입력했다면 검색필드 선택 팝업 호출.
        if (oModel.getProperty("/selHKey") === "K02") {

            if (typeof oAPP.fn._DATASET === "undefined") {
                oAPP.fn._DATASET = parent.require(parent.PATH.join(parent.REMOTE.app.getAppPath(),
                    "ws30", "ws10_20", "design", "js", "callDataSetFieldListPopop.js"));
            }

            const ls_return = await oAPP.fn._DATASET.callDataSetFieldListPopop(oModel.getProperty("/DATASET"), oAPP);

            if (ls_return.RETCD === "C") {
                parent.showMessage(null, 10, "I", ls_return.RTMSG);
                return;
            }

            if (ls_return.RETCD === "E") {
                oModel.setProperty("/DATASET/TABNM_stat", "Error");
                oModel.setProperty("/DATASET/TABNM_stxt", ls_return.RTMSG);
                parent.showMessage(null, 20, "E", ls_return.RTMSG, function () {
                    if (oUIobj.dataset.oInp1 && oUIobj.dataset.oInp1.focus) { oUIobj.dataset.oInp1.focus(); }
                });
                return;
            }

            oModel.setProperty("/DATASET/FLIST", ls_return.FLIST || "");

            if (l_create.APPNM === "") {
                oModel.setProperty("/DATASET/APPNM", ls_return.TDESC);
            }
        }

        // 생성 확인 팝업. 276 Create &1 application?
        parent.showMessage(null, 30, "I", _txt("/U4A/MSG_WS", "276", appid), function (param) {
            if (param !== "YES") { return; }
            lf_createAppData(oModel, oUIobj, appid);
        });
    }


    /************************************************************************
     * 값도움 / 보조 (원본 호출부 위임 — 별도 팝업)
     ************************************************************************/
    // object name f4 help 이벤트.
    function lf_ObjNameF4Help(oModel, oUi) {

        function lf_callback(param) {
            if (!param) { return; }
            oModel.setProperty("/DATASET/TABNM", param[l_fldnm]);
            oModel.setProperty("/DATASET/TABTX", param["DDTEXT"]);
            if (oModel.getProperty("/DATASET/APPNM") === "" && param["DDTEXT"] && param["DDTEXT"] !== "") {
                oModel.setProperty("/DATASET/APPNM", param["DDTEXT"]);
            }
        }

        const ls_data = oModel.getProperty("/DATASET");
        let l_f4help = "";
        let l_fldnm = "";

        switch (true) {
            case ls_data.RB01: l_f4help = "SGENCLP_SRC_DB_VIEW"; l_fldnm = "VIEWNAME"; break;
            case ls_data.RB02: l_f4help = "SGENCLP_SRC_TAB"; l_fldnm = "TABNAME"; break;
        }

        try {
            if (typeof oAPP.fn.callF4HelpPopup !== "undefined") {
                oAPP.fn.callF4HelpPopup(l_f4help, l_f4help, [], [], lf_callback);
                return true;
            }
            lf_getScript("design/js/callF4HelpPopup", function () {
                oAPP.fn.callF4HelpPopup(l_f4help, l_f4help, [], [], lf_callback);
            });
        } catch (e) {
            parent.showMessage(null, 20, "E", parent.WSUTIL.getWsMsgClsTxt("", "ZMSG_WS_COMMON_001", "949")); // Value help is not available.
        }
    }

    // CTS 번호 F4 HELP.
    function lf_RequestF4help(oModel) {
        try {
            oAPP.fn.fnCtsPopupOpener(function (param) {
                const ls_stru = lf_getStruName(oModel);
                if (!ls_stru) { return; }
                oModel.setProperty(ls_stru + "/REQNR", param.TRKORR);
                oModel.setProperty(ls_stru + "/REQTX", param.AS4TEXT);
            });
        } catch (e) {
            parent.showMessage(null, 20, "E", parent.WSUTIL.getWsMsgClsTxt("", "ZMSG_WS_COMMON_001", "950")); // Request value help is not available.
        }
    }

    // js 파일 load (원본 유지 — callF4HelpPopup lazy load 용).
    function lf_getScript(fname, callbackFunc, bSync) {
        const xhttp = new XMLHttpRequest();
        xhttp.onreadystatechange = function () {
            if (this.readyState == 4 && this.status == 200) {
                eval(this.responseText);
                callbackFunc();
            }
        };
        let l_async = true;
        if (bSync === true) { l_async = false; }
        xhttp.open("GET", fname + ".js", l_async);
        xhttp.send();
    }

    // 라디오 버튼 선택에 따른 이미지 변경.
    function lf_setSearchLayoutImage(oModel) {
        const l_SCCNT = oModel.getProperty("/DATASET/SCCNT");
        const l_them = oModel.getProperty("/DATASET/UITHM");
        let l_imgsrc = "";
        switch (l_SCCNT) {
            case 0: l_imgsrc = DATASET_IMG_PREFIX + "/" + l_them + "/" + LAYOUT_IMG[0]; break;
            case 1: l_imgsrc = DATASET_IMG_PREFIX + "/" + l_them + "/" + LAYOUT_IMG[1]; break;
            case 2: l_imgsrc = DATASET_IMG_PREFIX + "/" + l_them + "/" + LAYOUT_IMG[2]; break;
            case 3: l_imgsrc = DATASET_IMG_PREFIX + "/" + l_them + "/" + LAYOUT_IMG[3]; break;
        }
        oModel.setProperty("/DATASET/imgsrc", l_imgsrc);
    }

    // icon header 선택건에 따른 모델 구조명.
    function lf_getStruName(oModel) {
        switch (oModel.getProperty("/selHKey")) {
            case "K01": return "/CREATE";
            case "K02": return "/DATASET";
            default: return;
        }
    }

    // Object Type radio 선택에 따른 object name desc.
    function lf_setObjectNameDesc(oModel) {
        const ls_appl = oModel.getProperty("/DATASET");
        switch (true) {
            case ls_appl.RB01: oModel.setProperty("/DATASET/OBJNM", _txt("/U4A/CL_WS_COMMON", "B28")); break;
            case ls_appl.RB02: oModel.setProperty("/DATASET/OBJNM", _txt("/U4A/CL_WS_COMMON", "B29")); break;
        }
    }

})();
