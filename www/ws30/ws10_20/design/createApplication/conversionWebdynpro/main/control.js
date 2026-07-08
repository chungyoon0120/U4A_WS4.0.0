/********************************************************************
 *📝 CONTROL.JS  (UI5 → HTML5)
 *   내역 : 웹딘(Web Dynpro) 컨버전 내부 로직 영역.
 *
 *   [컨버전 메모]
 *   - 원본: sap.ui.model.json.JSONModel(two-way) + sap.ui.getCore().lock/unlock.
 *     → HTML5: 플레인 상태(oData) + view.js 가 주입한 render()(oModel.refresh 대체) + parent.setBusy.
 *   - 서버 계약/엔드포인트/메시지 키는 원본 그대로 보존.
 *       /u4a_cvt_wdr/getWebDynCompData · /chkPackage · /u4a_cvt_wdr/checkAppData
 *       /u4a_cvt_wdr/createAppData · /u4a_cvt_wdr/convWebdynUI
 *   - F4: 원본 callF4HelpPopup(UI5) → 공통 HTML5 fnF4SearchHelpOpen(YYUAWDH0010 / DEVCLASS).
 *   - 값검증 표기: 프로젝트 표준(인라인 value-state + 오류필드 포커스, 중복 요약 모달 제거)로 통일
 *     (생성옵션 팝업 General/DataSet 탭과 동일 UX). 서버 SCRIPT eval 은 방어(guard-server-script-eval).
 *   - 인터페이스(createControl → oContr{ ui, fn, oData, onEvt, onViewReady }) 는 원본과 동일하게 유지
 *     (소비처 createApplicationPopup CREATE_APP + 위자드 CREATE_WIZARD 공용).
 ********************************************************************/
export async function createControl(oParam) {

    /********************************************************************
     *📝 constant 선언부
    ********************************************************************/
    const CS_PRCCD = {
        CREATE_APP: "CREATE_APP",       // APP 생성.
        CREATE_WIZARD: "CREATE_WIZARD"  // 위자드.
    };

    // 위자드 템플릿 팝업 sid(원본 유지 — 위자드 경로에서만 참조).
    const C_TMPL_WZD_DLG_ID = "u4aWsTmplWzdDlg";

    const TY_UAWD = { APPID: "", COMP_NAME: "", COMP_DESC: "", PACKG: "", REQNR: "", REQTX: "", REQNR_REQ: false };
    const TY_RES = { RETCD: "", RTMSG: "" };
    const TY_VIS = { PACKG: false, REQNR: false, REQTX: false, VLIST: false, CREATE_WIZARD: false };
    const TY_VALST = { COMP_NAME: undefined, PACKG: undefined, REQNR: undefined };
    const TY_VALTX = { COMP_NAME: "", PACKG: "", REQNR: "" };
    const TY_EDIT = { REQNR: false };


    /********************************************************************
     *📝 DATA / ATTRIBUTE 선언부
    ********************************************************************/
    const oContr = {};
    oContr.ui = {};
    oContr.fn = {};
    oContr.attr = {};
    oContr.path = {};

    // 플레인 상태(원본 JSONModel 대체). view.js render() 가 이 값을 DOM 에 반영.
    oContr.oData = {
        S_UAWD: { ...TY_UAWD },
        S_VIS: { ...TY_VIS },
        S_EDIT: { ...TY_EDIT },
        S_VALST: { ...TY_VALST },
        S_VALTX: { ...TY_VALTX },
        T_VLIST: [],
        _vlistSel: -1   // VIEW 리스트 선택 인덱스(위자드).
    };

    // 커스텀 이벤트(원본 유지 — 소비처가 conversionWebdynpro 를 dispatch).
    oContr.onEvt = new EventTarget();

    // 화면 동기(view.js 가 oContr.fn.render 주입). 상태 변경 후 호출(원본 oModel.refresh 대체).
    function _render() { if (typeof oContr.fn.render === "function") { try { oContr.fn.render(); } catch (e) { console.error("[UAWD] render", e); } } }

    // 서버 메시지 클라 언어 역현지화(생성옵션 팝업과 동일 정책 — 서버가 접속언어로 굽는 텍스트를 WS 언어로).
    function _reloc(sText) {
        try {
            if (!sText) { return sText; }
            const ws = (parent.getUserInfo() || {}).LANGU;
            const be = (parent.getServerInfo() || {}).LANGU;
            if (!ws || !be || ws === be) { return sText; }
            const cls = parent.REMOTE.getGlobal("WsMsgCls");
            return (cls && cls.relocalize) ? cls.relocalize(sText, be, ws) : sText;
        } catch (e) { return sText; }
    }

    // 서버 SCRIPT eval 방어(SCRIPT 는 sap 등 참조 다수 → 실패해도 앱 안 죽고 busy 는 호출부가 해제).
    function _evalServerScript(sScript) {
        if (!sScript) { return false; }
        try { eval(sScript); return true; }
        catch (e) { console.error("[UAWD] server SCRIPT eval failed", e); return false; }
    }
    oContr.fn._reloc = _reloc;


    /********************************************************************
     *📝 VIEW READY — PRCCD 별 화면 활성/비활성 초기화.
    ********************************************************************/
    oContr.onViewReady = async function () {

        const _sVis = { ...TY_VIS };

        switch (oParam && oParam.PRCCD) {
            case CS_PRCCD.CREATE_APP:
                // 어플리케이션 생성 — 패키지/CTS번호/CTS설명 입력란 활성.
                _sVis.PACKG = true;
                _sVis.REQNR = true;
                _sVis.REQTX = true;
                break;

            case CS_PRCCD.CREATE_WIZARD:
                // 위자드 — VIEW 선택 리스트 + 생성 툴바 활성.
                _sVis.VLIST = true;
                _sVis.CREATE_WIZARD = true;
                break;

            default:
                break;
        }

        // 공통 F4(fnF4SearchHelpPopup) 지연로드 경로(원본 callF4HelpPopup → HTML5 대체).
        oContr.path.callF4HelpPopup = parent.PATH.join(parent.getPath("WS10_20_ROOT"), "js", "fnF4SearchHelpPopup.js");

        oContr.oData.S_VIS = _sVis;
        oContr.oData.S_UAWD.APPID = oParam.APPID;

        _render();

        parent.setBusy("");
    };


    /********************************************************************
     *📝 VIEW EXIT.
    ********************************************************************/
    oContr.onViewExit = async function () { };


    /********************************************************************
     *📝 WEB DYNPRO 컴포넌트명 변경 이벤트.
    ********************************************************************/
    oContr.fn.onChangeWebdynComp = async function (sValue) {

        parent.setBusy("X");

        const D = oContr.oData;

        // 오류 표현 필드 / DESC / view 리스트 초기화.
        D.S_VALST.COMP_NAME = undefined;
        D.S_VALTX.COMP_NAME = "";
        D.S_UAWD.COMP_DESC = "";
        D.T_VLIST = [];
        D._vlistSel = -1;

        const _name = (sValue == null ? "" : String(sValue));
        D.S_UAWD.COMP_NAME = _name;

        // 컴포넌트명 미입력이면 EXIT.
        if (_name === "") { _render(); parent.setBusy(""); return; }

        // WEB DYNPRO 컴포넌트정보 검색.
        const _sRes = await oContr.fn.getWebDynCompData();

        if (_sRes.RETCD === "E") {

            if (_sRes.SCRIPT) {
                if (!_evalServerScript(_sRes.SCRIPT) && _sRes.RTMSG) { parent.showMessage(null, 20, "E", _reloc(_sRes.RTMSG)); }
                D.S_UAWD.COMP_DESC = "";
                _render();
                parent.setBusy("");
                return;
            }

            // [UX 통일] 인라인 value-state + 오류필드 포커스(중복 모달 제거).
            D.S_VALST.COMP_NAME = "Error";
            D.S_VALTX.COMP_NAME = _reloc(_sRes.RTMSG);
            D.S_UAWD.COMP_DESC = "";
            _render();
            parent.setBusy("");
            oContr.fn._focus("compField");
            return;
        }

        D.S_UAWD.COMP_NAME = _sRes.COMP_NAME;
        D.S_UAWD.COMP_DESC = _sRes.COMP_DESC;
        D.T_VLIST = _sRes.T_VLIST || [];
        D._vlistSel = -1;

        _render();
        parent.setBusy("");
    };


    /********************************************************************
     *📝 패키지 변경 이벤트.
    ********************************************************************/
    //   ★데이터세트/일반 탭 lf_packageChangeEvent 와 동일한 package↔CTS 연계 동작(그대로 이식).
    oContr.fn.onChangePackage = async function (sValue) {

        const D = oContr.oData;

        // 오류 필드 초기화(PACKG+REQNR — 레퍼런스 lf_packageChangeEvent 의 lf_resetValueStateField 사상.
        //   ★REQNR 도 리셋 안 하면 CTS 재활성 시 낡은 Error 가 유령처럼 재노출됨) + CTS 기본 비활성.
        D.S_VALST.PACKG = undefined;
        D.S_VALTX.PACKG = "";
        D.S_VALST.REQNR = undefined;
        D.S_VALTX.REQNR = "";
        D.S_EDIT.REQNR = false;
        D.S_UAWD.REQNR_REQ = false;

        const _p = (sValue == null ? "" : String(sValue)).toUpperCase();
        D.S_UAWD.PACKG = _p;

        // 패키지를 비우면 CTS 값/설명도 비운다(비활성 필드 잔값 방지).
        if (_p === "") {
            D.S_UAWD.REQNR = "";
            D.S_UAWD.REQTX = "";
            _render();
            return;
        }

        // 로컬($TMP) — CTS 불필요(값/설명 비움, 비활성 유지).
        if (_p === "$TMP") {
            D.S_UAWD.REQNR = "";
            D.S_UAWD.REQTX = "";
            _render();
            return;
        }

        // 정합성 점검(표준패키지 275=클라, Y/Z=서버 /chkPackage).
        parent.setBusy("X");
        const _sRes = await oContr.fn.checkPackage();
        parent.setBusy("");

        if (_sRes.RETCD === "E") {
            D.S_VALST.PACKG = "Error";
            D.S_VALTX.PACKG = _reloc(_sRes.RTMSG);
            _render();
            oContr.fn._focus("packField");
            return;
        }

        // 비로컬 정상 → CTS 활성 + 필수.
        D.S_EDIT.REQNR = true;
        D.S_UAWD.REQNR_REQ = true;
        _render();
    };


    /********************************************************************
     *📝 패키지 입력 중(live) — CTS 즉시 비활성 + 초기화 (데이터세트 lf_packageLiveReset 동일).
    ********************************************************************/
    oContr.fn.onPackageLiveReset = function (sValue) {
        const D = oContr.oData;
        D.S_UAWD.PACKG = (sValue == null ? "" : String(sValue));
        // 이미 CTS 비활성+빈값이면 skip(키 입력마다 불필요한 render 방지).
        if (D.S_EDIT.REQNR === false && !D.S_UAWD.REQNR && !D.S_UAWD.REQTX) { return; }
        D.S_EDIT.REQNR = false;
        D.S_UAWD.REQNR_REQ = false;
        D.S_UAWD.REQNR = "";
        D.S_UAWD.REQTX = "";
        _render();
    };


    /********************************************************************
     *📝 webdyn 컴포넌트 F4 help (원본 callF4HelpPopup YYUAWDH0010 → fnF4SearchHelpOpen).
    ********************************************************************/
    oContr.fn.onValueHelpWDCompName = async function () {

        const D = oContr.oData;

        async function _callback(row) {
            if (!row) { return; }

            parent.setBusy("X");

            D.S_VALST.COMP_NAME = undefined;
            D.S_VALTX.COMP_NAME = "";
            D.T_VLIST = [];
            D._vlistSel = -1;

            // 결과 셀 키 = FIELDNAME(대문자) — 원본 callback 의 COMPONENT_NAME/DESCRIPTION 동일.
            D.S_UAWD.COMP_NAME = row.COMPONENT_NAME || "";
            D.S_UAWD.COMP_DESC = row.DESCRIPTION || "";

            // 위자드에서 호출된 경우 컴포넌트 정보 재조회(원본 동일).
            if (oParam.PRCCD === CS_PRCCD.CREATE_WIZARD) {

                const _sRes = await oContr.fn.getWebDynCompData();

                if (_sRes.RETCD === "E") {
                    if (_sRes.SCRIPT) {
                        if (!_evalServerScript(_sRes.SCRIPT) && _sRes.RTMSG) { parent.showMessage(null, 20, "E", _reloc(_sRes.RTMSG)); }
                        D.S_UAWD.COMP_DESC = "";
                        _render();
                        parent.setBusy("");
                        return;
                    }
                    D.S_VALST.COMP_NAME = "Error";
                    D.S_VALTX.COMP_NAME = _reloc(_sRes.RTMSG);
                    D.S_UAWD.COMP_DESC = "";
                    _render();
                    parent.setBusy("");
                    oContr.fn._focus("compField");
                    return;
                }

                D.S_UAWD.COMP_NAME = _sRes.COMP_NAME;
                D.S_UAWD.COMP_DESC = _sRes.COMP_DESC;
                D.T_VLIST = _sRes.T_VLIST || [];
            }

            _render();
            parent.setBusy("");
        }

        parent.setBusy("X");
        await oContr.fn._ensureF4();
        parent.setBusy("");

        if (oAPP.fn && typeof oAPP.fn.fnF4SearchHelpOpen === "function") {
            oAPP.fn.fnF4SearchHelpOpen({ shlpname: "YYUAWDH0010", onPick: _callback });
            return;
        }
        // Value help is not available.
        parent.showMessage(null, 20, "E", parent.WSUTIL.getWsMsgClsTxt("", "ZMSG_WS_COMMON_001", "949"));
    };


    /********************************************************************
     *📝 package F4 help (원본 callF4HelpPopup DEVCLASS → fnF4SearchHelpOpen).
    ********************************************************************/
    oContr.fn.onValueHelpPackage = async function () {

        const D = oContr.oData;

        function _callback(row) {
            if (!row) { return; }

            D.S_UAWD.PACKG = row.DEVCLASS || "";

            // ★유효 패키지 선택 시 PACKG·REQNR 오류 필드 리셋(onChangePackage 와 동일 — 이전 오류 잔존 방지).
            D.S_VALST.PACKG = undefined;
            D.S_VALTX.PACKG = "";
            D.S_VALST.REQNR = undefined;
            D.S_VALTX.REQNR = "";
            D.S_EDIT.REQNR = false;
            D.S_UAWD.REQNR_REQ = false;

            // 로컬($TMP) 이면 CTS 값·설명 초기화 후 EXIT(onChangePackage 와 동일).
            if (D.S_UAWD.PACKG === "$TMP") {
                D.S_UAWD.REQNR = "";
                D.S_UAWD.REQTX = "";
                _render();
                return;
            }

            // CTS 활성 + 필수.
            D.S_EDIT.REQNR = true;
            D.S_UAWD.REQNR_REQ = true;
            _render();
        }

        parent.setBusy("X");
        await oContr.fn._ensureF4();
        parent.setBusy("");

        if (oAPP.fn && typeof oAPP.fn.fnF4SearchHelpOpen === "function") {
            oAPP.fn.fnF4SearchHelpOpen({ shlpname: "DEVCLASS", onPick: _callback });
            return;
        }
        parent.showMessage(null, 20, "E", parent.WSUTIL.getWsMsgClsTxt("", "ZMSG_WS_COMMON_001", "949"));
    };


    /********************************************************************
     *📝 Request No F4 HELP 이벤트 (공통 CTS 팝업 — 원본 유지).
    ********************************************************************/
    oContr.fn.onValueHelpReqNumber = function () {
        oAPP.fn.fnCtsPopupOpener(function (param) {
            const D = oContr.oData;
            D.S_UAWD.REQNR = param.TRKORR;
            D.S_UAWD.REQTX = param.AS4TEXT;
            D.S_VALST.REQNR = undefined;
            D.S_VALTX.REQNR = "";
            _render();
        });
    };


    /********************************************************************
     *📝 공통 F4(fnF4SearchHelpOpen) 지연 로드 보장.
    ********************************************************************/
    oContr.fn._ensureF4 = function () {
        return new Promise(function (resolve) {
            if (oAPP.fn && typeof oAPP.fn.fnF4SearchHelpOpen === "function") { return resolve(true); }
            const _x = new XMLHttpRequest();
            _x.onreadystatechange = function () {
                if (this.readyState === 4) {
                    if (this.status === 200) { try { eval(this.responseText); } catch (e) { console.error("[UAWD] F4 load", e); } }
                    resolve(!!(oAPP.fn && typeof oAPP.fn.fnF4SearchHelpOpen === "function"));
                }
            };
            _x.open("GET", oContr.path.callF4HelpPopup, true);
            _x.send();
        });
    };

    // 오류 필드 포커스(busy top-layer 트랩 회피 — 다음 틱).
    oContr.fn._focus = function (sKey) {
        const oF = oContr.ui[sKey];
        if (!oF || typeof oF.focus !== "function") { return; }
        setTimeout(function () { try { oF.focus(); } catch (e) { } }, 0);
    };


    /********************************************************************
     *📝 웹딘 컨버전 생성 버튼 이벤트(위자드 툴바 버튼).
    ********************************************************************/
    oContr.fn.onCreateWebdynConvUI = function () {
        if (oParam.PRCCD === CS_PRCCD.CREATE_WIZARD) { oContr.fn.convWebdynUI(); }
    };


    /********************************************************************
     *📝 테이블 sort/filter 초기화 — HTML5 테이블은 정렬/필터 UI 미제공(원본 sap.ui.table 대체) → no-op.
    ********************************************************************/
    oContr.fn.resetUiTableFilterSort = function () { };


    /********************************************************************
     *📝 view list 더블클릭(위자드) → 선택 후 컨버전.
    ********************************************************************/
    oContr.fn.onDblClickViewTable = function (iIdx) {
        oContr.oData._vlistSel = iIdx;
        _render();
        oContr.fn.convWebdynUI();
    };


    /********************************************************************
     *📝 CUSTOM EVENT — 소비처가 dispatch (CREATE_APP=생성 / WIZARD_CONV=위자드 컨버전).
    ********************************************************************/
    oContr.onEvt.addEventListener("conversionWebdynpro", function (oEvent) {
        const _act = oEvent && oEvent.detail && oEvent.detail.ACTCD;
        switch (_act) {
            case "CREATE_APP": oContr.fn.createApp(oEvent.detail); break;
            case "WIZARD_CONV": oContr.fn.convWebdynUI(); break;
            default: break;
        }
    });


    /********************************************************************
     *📝 위자드 컨버전 전 입력값 점검(인라인 value-state).
    ********************************************************************/
    oContr.fn.checkWizardConvData = function () {

        const _sRes = { ...TY_RES };
        const D = oContr.oData;

        // 오류 필드 초기화.
        D.S_VALST = { ...TY_VALST };
        D.S_VALTX = { ...TY_VALTX };

        // 웹딘 컴포넌트명 미입력.
        if (D.S_UAWD.COMP_NAME === "") {
            _sRes.RETCD = "E";
            D.S_VALST.COMP_NAME = "Error";
            // 447 Web Dynpro Component Name is required.
            D.S_VALTX.COMP_NAME = parent.WSUTIL.getWsMsgClsTxt("", "ZMSG_WS_COMMON_001", "447");
            return _sRes;
        }

        // 선택한 VIEW 미존재.
        if (oContr.fn.getSelectedViewData().length === 0) {
            _sRes.RETCD = "E";
            // 448 Select the View list to convert.
            _sRes.RTMSG = parent.WSUTIL.getWsMsgClsTxt("", "ZMSG_WS_COMMON_001", "448");
        }

        return _sRes;
    };


    /********************************************************************
     *📝 위자드 - WEBDYN UI 컨버전 (위자드 경로 전용).
     *   ※ 소비처(위자드)는 현재 "준비중" 스텁 상태 — 이 경로는 위자드 HTML5 배선 후 활성.
     *   서버 계약/흐름은 원본 유지, sap 참조만 제거·design 헬퍼는 존재 가드.
    ********************************************************************/
    oContr.fn.convWebdynUI = async function () {

        parent.setBusy("X");

        // 컨버전 전 입력값 점검.
        const _sRes = oContr.fn.checkWizardConvData();
        if (_sRes.RETCD === "E") {
            _render();
            parent.setBusy("");
            if (_sRes.RTMSG) { parent.showMessage(null, 20, "E", _reloc(_sRes.RTMSG)); }
            else { oContr.fn._focus("compField"); }
            return;
        }

        // 컨버전 확인 팝업 (449 Do you want to proceed with the conversion for the selected view?).
        const _res = await new Promise(function (resolve) {
            parent.showMessage(null, 30, "I", parent.WSUTIL.getWsMsgClsTxt("", "ZMSG_WS_COMMON_001", "449"), function (param) { resolve(param); });
            parent.setBusy("");
        });
        if (_res !== "YES") { return; }

        parent.setBusy("X");

        const _sAppData = {};
        _sAppData.COMP_NAME = oContr.oData.S_UAWD.COMP_NAME;
        _sAppData.APPID = oContr.oData.S_UAWD.APPID;
        _sAppData.T_VLIST = oContr.fn.getSelectedViewData();

        const _oFormData = new FormData();
        _oFormData.append("APPDATA", JSON.stringify(_sAppData));

        const _sRet = await new Promise(function (resolve) {
            sendAjax(parent.getServerPath() + "/u4a_cvt_wdr/convWebdynUI", _oFormData, function (sRet) {
                resolve(sRet);
            }, "", true, "POST", function () {
                resolve({ RETCD: "E", RTMSG: parent.WSUTIL.getWsMsgClsTxt("", "ZMSG_WS_COMMON_001", "391") });
            });
        });

        if (_sRet.RETCD === "E") {
            if (_sRet.SCRIPT) {
                if (!_evalServerScript(_sRet.SCRIPT) && _sRet.RTMSG) { parent.showMessage(null, 20, "E", _reloc(_sRet.RTMSG)); }
                parent.setBusy("");
                return;
            }
            parent.showMessage(null, 20, "E", _reloc(_sRet.RTMSG));
            parent.setBusy("");
            return;
        }

        try {
            // 컨버전 UI 정보를 TREE 로 변환 → attr 병합 → 디자인 선택 라인에 추가(design 헬퍼 존재 가드).
            const _aConvUIData = oAPP.fn.setTreeData(_sRet.T_0014, "POBID", "OBJID", "zTREE");
            const _sConvUIData = _aConvUIData[0];
            oContr.fn.setUiAttrData(_sConvUIData, _sRet.T_0015);

            const _sDesignUI = oAPP.fn.designGetSelectedTreeItem();
            const _sPos = oAPP.fn.getMousePosition();

            const _sAggr = await oAPP.fn.aggrSelectPopupOpener(_sConvUIData, _sDesignUI, _sPos);
            if (_sAggr.RETCD === "E") {
                const _KIND = (_sAggr.RCODE === "02") ? 20 : 10;
                parent.showMessage(null, _KIND, "I", _reloc(_sAggr.RTMSG));
                if (oAPP.fn.setShortcutLock) { oAPP.fn.setShortcutLock(false); }
                parent.setBusy("");
                return;
            }

            oAPP.fn.designAddTreeData(_sConvUIData, _sDesignUI, _sAggr.sAggr);
        } catch (e) {
            console.error("[UAWD] convWebdynUI design integration", e);
            parent.setBusy("");
            return;
        }

        parent.setBusy("");
    };


    /********************************************************************
     *📝 ui 에 해당하는 attr 정보 구성(재귀 — 원본 유지).
    ********************************************************************/
    oContr.fn.setUiAttrData = function (sDesignUI, aT_0015) {
        sDesignUI._T_0015 = aT_0015.filter(function (item) { return item.OBJID === sDesignUI.OBJID; }) || [];
        if (!sDesignUI.zTREE || sDesignUI.zTREE.length === 0) { return; }
        for (let i = 0, l = sDesignUI.zTREE.length; i < l; i++) {
            oContr.fn.setUiAttrData(sDesignUI.zTREE[i], aT_0015);
        }
    };


    /********************************************************************
     *📝 선택한 라인의 view 정보(위자드).
    ********************************************************************/
    oContr.fn.getSelectedViewData = function () {
        const D = oContr.oData;
        const _i = D._vlistSel;
        if (_i == null || _i < 0 || !D.T_VLIST[_i]) { return []; }
        return [D.T_VLIST[_i].VIEW_NAME];
    };


    /********************************************************************
     *📝 패키지 입력값 점검(원본 유지 — 275 + /chkPackage).
    ********************************************************************/
    oContr.fn.checkPackage = function () {
        return new Promise(function (resolve) {
            const _sRes = { ...TY_RES };
            const _sUAWD = oContr.oData.S_UAWD;

            if (_sUAWD.PACKG === "") { return resolve(_sRes); }

            _sUAWD.PACKG = _sUAWD.PACKG.toUpperCase();

            // 로컬 패키지.
            if (_sUAWD.PACKG === "$TMP") { return resolve(_sRes); }

            // Y, Z 이외 표준 패키지 금지.
            if ("YZ".indexOf(_sUAWD.PACKG.substring(0, 1)) === -1) {
                _sRes.RETCD = "E";
                // 275 Standard package cannot be entered.
                _sRes.RTMSG = oAPP.common.fnGetMsgClsText("/U4A/MSG_WS", "275", "", "", "", "");
                return resolve(_sRes);
            }

            const _oFormData = new FormData();
            _oFormData.append("PACKG", _sUAWD.PACKG);

            sendAjax(parent.getServerPath() + "/chkPackage", _oFormData, function (sRet) {
                if (sRet.ERFLG === "X") { _sRes.RETCD = "E"; _sRes.RTMSG = sRet.ERMSG; return resolve(_sRes); }
                if (sRet.ERFLG === "E") { _sRes.RETCD = "E"; _sRes.RTMSG = sRet.ERMSG; return resolve(_sRes); }
                return resolve(_sRes);
            }, "", true, "POST", function () {
                resolve({ RETCD: "E", RTMSG: parent.WSUTIL.getWsMsgClsTxt("", "ZMSG_WS_COMMON_001", "391") });
            });
        });
    };


    /********************************************************************
     *📝 WEB DYNPRO 컴포넌트정보 검색(원본 유지).
    ********************************************************************/
    oContr.fn.getWebDynCompData = function () {
        return new Promise(function (resolve) {
            const _sRes = { ...TY_RES };
            _sRes.COMP_NAME = oContr.oData.S_UAWD.COMP_NAME;
            _sRes.COMP_DESC = "";

            if (_sRes.COMP_NAME === "") { return resolve(_sRes); }

            _sRes.COMP_NAME = _sRes.COMP_NAME.toUpperCase();

            const _oFormData = new FormData();
            _oFormData.append("WD_COMP_NAME", _sRes.COMP_NAME);

            sendAjax(parent.getServerPath() + "/u4a_cvt_wdr/getWebDynCompData", _oFormData, function (sRes) {
                resolve(sRes);
            }, "", true, "POST", function () {
                resolve({ RETCD: "E", RTMSG: parent.WSUTIL.getWsMsgClsTxt("", "ZMSG_WS_COMMON_001", "391") });
            });
        });
    };


    /********************************************************************
     *📝 어플리케이션 생성전 입력값 점검(원본 유지 — 인라인 value-state).
    ********************************************************************/
    oContr.fn.checkAppData = function () {
        return new Promise(function (resolve) {

            const _sRes = { ...TY_RES };
            const D = oContr.oData;
            const _sUAWD = D.S_UAWD;

            // 오류 필드 초기화.
            D.S_VALST = { ...TY_VALST };
            D.S_VALTX = { ...TY_VALTX };

            // 웹딘 컴포넌트명 미입력.
            if (_sUAWD.COMP_NAME === "") {
                _sRes.RETCD = "E";
                D.S_VALST.COMP_NAME = "Error";
                // 447 Web Dynpro Component Name is required.
                D.S_VALTX.COMP_NAME = parent.WSUTIL.getWsMsgClsTxt("", "ZMSG_WS_COMMON_001", "447");
            }

            // 패키지 미입력.
            if (_sUAWD.PACKG === "") {
                _sRes.RETCD = "E";
                D.S_VALST.PACKG = "Error";
                // 451 Package is required.
                D.S_VALTX.PACKG = parent.WSUTIL.getWsMsgClsTxt("", "ZMSG_WS_COMMON_001", "451");
            }

            // Y, Z 이외 표준 패키지 금지.
            if (_sUAWD.PACKG !== "$TMP" && "YZ".indexOf(_sUAWD.PACKG.substring(0, 1)) === -1) {
                _sRes.RETCD = "E";
                D.S_VALST.PACKG = "Error";
                // 275 Standard package cannot be entered.
                D.S_VALTX.PACKG = oAPP.common.fnGetMsgClsText("/U4A/MSG_WS", "275", "", "", "", "");
            }

            // 로컬이 아닌데(그리고 패키지가 입력됐는데) CTS 미입력.
            //   ★데이터세트 lf_chkValue 와 동일하게 PACKG !== "" 가드 — 패키지 미입력 시엔 CTS 를 따로
            //   에러로 잡지 않는다(패키지 에러로 충분, 비활성 CTS 에 빨간줄 방지).
            if (_sUAWD.PACKG !== "$TMP" && _sUAWD.PACKG !== "" && _sUAWD.REQNR === "") {
                _sRes.RETCD = "E";
                D.S_VALST.REQNR = "Error";
                // 450 CTS 번호는 필수로 입력되어야 합니다.
                D.S_VALTX.REQNR = parent.WSUTIL.getWsMsgClsTxt("", "ZMSG_WS_COMMON_001", "450");
            }

            // 클라 점검 오류 → 인라인 표기만(중복 요약 모달 제거) 후 반환.
            if (_sRes.RETCD === "E") { return resolve(_sRes); }

            // 서버 점검.
            const _sAppData = {
                APPID: _sUAWD.APPID,
                COMP_NAME: _sUAWD.COMP_NAME,
                PACKG: _sUAWD.PACKG,
                REQNR: (_sUAWD.REQNR !== "") ? _sUAWD.REQNR : ""
            };
            const _oFormData = new FormData();
            _oFormData.append("APPDATA", JSON.stringify(_sAppData));

            sendAjax(parent.getServerPath() + "/u4a_cvt_wdr/checkAppData", _oFormData, function (sRet) {
                resolve(sRet);
            }, "", true, "POST", function () {
                resolve({ RETCD: "E", RTMSG: parent.WSUTIL.getWsMsgClsTxt("", "ZMSG_WS_COMMON_001", "391") });
            });
        });
    };


    /********************************************************************
     *📝 어플리케이션 생성 처리 (원본 createApp — 생성옵션 CREATE_APP 위임 경로).
     *   ★[표준] 로직 시작 = 입력값 점검부터. 통과해야 확인/서버생성.
    ********************************************************************/
    oContr.fn.createApp = async function (sParmas) {

        const D = oContr.oData;

        // 로컬 생성 — 패키지 $TMP 강제(점검 전 세팅).
        if (sParmas && sParmas.ISLOCAL === true) {
            D.S_UAWD.PACKG = "$TMP";
            D.S_UAWD.REQNR = "";
            D.S_EDIT.REQNR = false;
            D.S_UAWD.REQNR_REQ = false;
            _render();
        }

        // 입력값 점검(클라 + 서버). 서버콜 동안 busy.
        parent.setBusy("X");
        const _chk = await oContr.fn.checkAppData();
        parent.setBusy("");

        if (_chk.RETCD === "E") {
            if (_chk.SCRIPT) {
                if (!_evalServerScript(_chk.SCRIPT) && _chk.RTMSG) { parent.showMessage(null, 20, "E", _reloc(_chk.RTMSG)); }
                _render();
                return;
            }
            _render();
            // 첫 오류 필드 포커스.
            const _key = D.S_VALST.COMP_NAME === "Error" ? "compField"
                : D.S_VALST.PACKG === "Error" ? "packField"
                    : D.S_VALST.REQNR === "Error" ? "reqnrField" : null;
            if (_key) { oContr.fn._focus(_key); }
            // ★서버 전용 오류(클라 인라인 필드 없음) → RTMSG 를 모달로(원본 동일). 안 그러면 busy만 꺼지고 무피드백.
            else if (_chk.RTMSG) { parent.showMessage(null, 20, "E", _reloc(_chk.RTMSG)); }
            return;
        }

        // 생성 확인 (276 Create &1 application?).
        const _res = await new Promise(function (resolve) {
            parent.showMessage(null, 30, "I", oAPP.common.fnGetMsgClsText("/U4A/MSG_WS", "276", (sParmas && sParmas.APPID) || "", "", "", ""), function (param) { resolve(param); });
        });
        if (_res !== "YES") { return; }

        parent.setBusy("X");

        const _sAppData = {
            APPID: D.S_UAWD.APPID,
            COMP_NAME: D.S_UAWD.COMP_NAME,
            PACKG: D.S_UAWD.PACKG,
            REQNR: D.S_UAWD.REQNR
        };
        const _oFormData = new FormData();
        _oFormData.append("APPDATA", JSON.stringify(_sAppData));

        const _sRet = await new Promise(function (resolve) {
            sendAjax(parent.getServerPath() + "/u4a_cvt_wdr/createAppData", _oFormData, function (sRet) {
                resolve(sRet);
            }, "", true, "POST", function () {
                resolve({ RETCD: "E", RTMSG: parent.WSUTIL.getWsMsgClsTxt("", "ZMSG_WS_COMMON_001", "391") });
            });
        });

        parent.setBusy("");

        if (_sRet.RETCD === "E") {
            if (_sRet.SCRIPT) {
                if (!_evalServerScript(_sRet.SCRIPT) && _sRet.RTMSG) { parent.showMessage(null, 20, "E", _reloc(_sRet.RTMSG)); }
                return;
            }
            parent.showMessage(null, 20, "E", _reloc(_sRet.RTMSG));
            return;
        }

        // 성공 → 에디터 화면으로 이동 + 생성옵션 다이얼로그 종료(원본 동일 경로).
        try { onAppCrAndChgMode(sParmas && sParmas.APPID); } catch (e) { console.error("[UAWD] onAppCrAndChgMode", e); }

        try {
            const _dlg = sParmas && sParmas.oUIobj && sParmas.oUIobj.oCreateDialog;
            if (_dlg) { try { _dlg.close(); } catch (e) { } try { _dlg.remove(); } catch (e) { } }
        } catch (e) { }
    };


    return oContr;
}
