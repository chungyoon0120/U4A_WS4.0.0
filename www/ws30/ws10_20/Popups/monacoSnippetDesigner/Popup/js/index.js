/************************************************************************
 * monacoSnippetDesigner/Popup/js/index.js  (HTML5)
 * ----------------------------------------------------------------------
 *  Monaco 스니펫 디자이너 — 콘텐츠 로직. 원본 UI5(view.js/control.js)의 기능을
 *  공통 자산(U4AUI.*: createPanel/createField/wireSplitter/confirm, .u4a-table/.u4a-busy)
 *  으로 1:1 이식. 스니펫 코드 에디터는 공통 Monaco 호스트(js/codeeditor) 재사용.
 *
 *  [불변 계약 — .analy 04 §10.4 / §6.4]
 *   · 저장: P13N_ROOT/monaco/snippet/list.json(메타 [{_key,snippet_name,snippet_desc,snippet_langu}])
 *           + {_key} 파일(코드 본문 순수 텍스트). FS 직접 I/O(서버 API 아님).
 *   · 저장·삭제 후 IPC(if-browser-interconnection / PRCCD:MONACO_SNIPPET_CHANGE) 방송 →
 *           열린 모든 USP 본편집기 자동완성 스니펫 갱신(js/usp/monaco 가 동일 파일 소비).
 *   · 언어 목록: javascript / css / html (원본 하드코딩).
 ************************************************************************/

(function () {
    "use strict";

    /* ==================================================================
     * 1. Electron / Util 컨텍스트
     * ================================================================== */
    const REMOTE = require("@electron/remote"),
        PATH = REMOTE.require("path"),
        FS = REMOTE.require("fs"),
        APP = REMOTE.app,
        APPPATH = APP.getAppPath(),
        PATHINFO = require(PATH.join(APPPATH, "ws30", "resources", "pathInfo.js")),
        WSUTIL = require(PATHINFO.WSUTIL),
        IPCRENDERER = require("electron").ipcRenderer,
        CURRWIN = REMOTE.getCurrentWindow();

    const oQueryParams = WSUTIL.QueryString.parse(location.href);
    const USERINFO = oQueryParams.USERINFO || {},
        LANGU = USERINFO.LANGU || "",
        SYSID = USERINFO.SYSID || "";

    // 공통 Monaco 호스트(js/codeeditor)가 GRAND_FATHER(=최상위 창)에서 lib 경로를 해석한다 →
    //   최상위 창(이 문서)에 PATH/APPPATH 노출(안 하면 호스트가 monaco lib 경로를 못 찾음).
    window.PATH = PATH;
    window.APPPATH = APPPATH;

    /* ==================================================================
     * 2. 경로 / 상수 / 상태
     * ================================================================== */
    // P13N 스니펫 루트(원본 control.js MONACO_EDITOR_SNIPPET_P13N_ROOT 와 동일).
    const SNIPPET_ROOT = PATH.join(PATHINFO.P13N_ROOT, "monaco", "snippet");
    const SNIPPET_LIST_JSON = PATH.join(SNIPPET_ROOT, "list.json");

    // 공통 Monaco 호스트 채널.
    const HOSTID = "SNIPPET_CODE";

    // 언어 목록(원본 TY_SNIPPET_LANGU_DDLB: ""(미선택) + js/css/html).
    //   빈 항목("")은 원본 DDLB 의 공백 선택지 — 필수 검증(M349)의 "미선택" 상태를 재현.
    const LANGU_ITEMS = [
        { value: "", text: "" },
        { value: "javascript", text: "JavaScript" },
        { value: "css", text: "CSS" },
        { value: "html", text: "HTML" }
    ];

    const oState = {
        list: [],          // [{_key, snippet_langu, snippet_name, snippet_desc, _isnew?}]
        cur: null,         // 편집중 {_key, snippet_*, snippet_code, _isnew, _ischg}
        isBusy: false,
        editorReady: false,
        monacoTheme: "vs-dark"
    };

    // UI refs
    let oLanguField, oNameField, oDescField, oListPanel, oInfoPanel;
    let oBtnNew, oBtnDel, oBtnSave, oBtnCancel;

    /* ==================================================================
     * 3. 공통 유틸(메시지 / 토스트 / busy / 오류)
     * ================================================================== */
    // 워크스페이스 메시지(ZMSG_WS_COMMON_001). p1 = &1 치환.
    function wsMsg(sNo, sFallback, p1) {
        const sP1 = (p1 == null) ? "" : String(p1);
        try {
            const s = WSUTIL.getWsMsgClsTxt(LANGU, "ZMSG_WS_COMMON_001", sNo, sP1);
            if (s && s.trim()) { return s; }
        } catch (e) { console.error("[스니펫디자이너] 메시지 조회 실패:", sNo, e); }
        return (sFallback || sNo).replace(/&1/g, sP1);
    }

    // 공통 토스트(.u4a-toast) — 화면 정중앙·싱글톤·3초.
    let _toastTimer = null;
    function _toast(sMsg) {
        if (!sMsg) { return; }
        let oT = document.getElementById("snipToast");
        if (!oT) {
            oT = document.createElement("div");
            oT.id = "snipToast";
            oT.className = "u4a-toast";
            oT.setAttribute("role", "alert");
            document.body.appendChild(oT);
        }
        oT.textContent = sMsg;
        oT.setAttribute("data-show", "true");
        clearTimeout(_toastTimer);
        _toastTimer = setTimeout(function () { try { oT.setAttribute("data-show", "false"); } catch (e) { } }, 3000);
    }

    // busy(top-layer <dialog>) 제어.
    function fn_setBusy(bIsBusy) {
        oState.isBusy = !!bIsBusy;
        const oBusy = document.getElementById("snipBusy");
        if (!oBusy) { return; }
        try {
            if (bIsBusy) { if (!oBusy.open) { oBusy.showModal(); } }
            else { if (oBusy.open) { oBusy.close(); } }
        } catch (e) { console.error("[스니펫디자이너] busy 토글 오류:", e); }
    }

    // 오류 모달(공통 U4AUI.confirm) — 저장/삭제 실패 등. 단추는 OK 하나.
    function showErr(sMsg, sTitle) {
        try { U4AUI.confirm({ type: "E", title: sTitle || "", message: sMsg, buttons: [{ act: "OK", label: "OK", emphasized: true }] }); }
        catch (e) { console.error("[스니펫디자이너] 오류 모달 실패:", e, sMsg); }
    }

    // 랜덤키(원본 getRandomKey — A-Za-z0-9, 30자).
    function getRandomKey(iLen) {
        let sResult = "";
        const sChars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
        for (let i = 0; i < iLen; i++) { sResult += sChars.charAt(Math.floor(Math.random() * sChars.length)); }
        return sResult;
    }

    // 언어 → Monaco language id.
    function _monacoLang(sLangu) {
        return sLangu ? sLangu : "plaintext";
    }

    // BGCOL 명도로 빌트인 Monaco 테마(vs / vs-dark) 결정.
    function _computeMonacoTheme() {
        const sBg = oQueryParams.BGCOL || "";
        const m = /^#?([0-9a-fA-F]{6})$/.exec(String(sBg).trim());
        if (m) {
            const n = parseInt(m[1], 16);
            const lum = 0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255);
            return lum < 128 ? "vs-dark" : "vs";
        }
        return "vs-dark";
    }

    /* ==================================================================
     * 4. 데이터 계층 (P13N FS I/O) — 원본 control.js 1:1
     * ================================================================== */
    // list.json → [{_key, snippet_langu, snippet_name, snippet_desc}]
    function _readList() {
        try {
            if (!FS.existsSync(SNIPPET_LIST_JSON)) { return []; }
            const a = JSON.parse(FS.readFileSync(SNIPPET_LIST_JSON, "utf-8"));
            if (!Array.isArray(a)) { return []; }
            return a.map(function (o) {
                return {
                    _key: o && o._key || "",
                    snippet_langu: o && o.snippet_langu || "",
                    snippet_name: o && o.snippet_name || "",
                    snippet_desc: o && o.snippet_desc || ""
                };
            }).filter(function (o) { return o._key; });
        } catch (e) {
            console.error("[스니펫디자이너] list.json 로드 오류:", e);
            return [];
        }
    }

    // {_key} 코드 파일 읽기.
    function _readCode(sKey) {
        try {
            const sFile = PATH.join(SNIPPET_ROOT, sKey);
            if (!FS.existsSync(sFile)) { return ""; }
            return FS.readFileSync(sFile, "utf-8");
        } catch (e) {
            console.error("[스니펫디자이너] 코드 파일 로드 오류:", sKey, e);
            return "";
        }
    }

    // list.json 저장(메타만: _key/name/desc/langu).
    function _writeList(aList) {
        try {
            if (!FS.existsSync(SNIPPET_ROOT)) { FS.mkdirSync(SNIPPET_ROOT, { recursive: true }); }
            const aSave = (aList || []).map(function (o) {
                return { _key: o._key, snippet_name: o.snippet_name, snippet_desc: o.snippet_desc, snippet_langu: o.snippet_langu };
            });
            FS.writeFileSync(SNIPPET_LIST_JSON, JSON.stringify(aSave), "utf-8");
            return { RETCD: "S" };
        } catch (e) {
            console.error("[스니펫디자이너] list.json 저장 오류:", e);
            return { RETCD: "E" };
        }
    }

    // {_key} 코드 파일 저장.
    function _writeCode(sKey, sCode) {
        try {
            if (!FS.existsSync(SNIPPET_ROOT)) { FS.mkdirSync(SNIPPET_ROOT, { recursive: true }); }
            FS.writeFileSync(PATH.join(SNIPPET_ROOT, sKey), sCode == null ? "" : String(sCode), "utf-8");
            return { RETCD: "S" };
        } catch (e) {
            console.error("[스니펫디자이너] 코드 파일 저장 오류:", sKey, e);
            return { RETCD: "E" };
        }
    }

    // {_key} 코드 파일 삭제.
    function _removeCode(sKey) {
        try {
            const sFile = PATH.join(SNIPPET_ROOT, sKey);
            if (FS.existsSync(sFile)) { FS.unlinkSync(sFile); }
        } catch (e) { console.error("[스니펫디자이너] 코드 파일 삭제 오류:", sKey, e); }
    }

    // 통합 저장(원본 _saveP13nSnippetData): 신규건 제외한 목록에 update/unshift → 목록 + 코드 저장.
    function _saveData(oSaveData) {
        // 저장 대상 목록 = 현재 목록에서 미저장 신규건 제외.
        const aBase = oState.list.filter(function (o) { return !o._isnew; }).map(function (o) {
            return { _key: o._key, snippet_langu: o.snippet_langu, snippet_name: o.snippet_name, snippet_desc: o.snippet_desc };
        });
        const oFound = aBase.find(function (e) { return e._key === oSaveData._key; });
        if (oFound) {
            oFound.snippet_name = oSaveData.snippet_name;
            oFound.snippet_desc = oSaveData.snippet_desc;
            oFound.snippet_langu = oSaveData.snippet_langu;
        } else {
            aBase.unshift({ _key: oSaveData._key, snippet_langu: oSaveData.snippet_langu, snippet_name: oSaveData.snippet_name, snippet_desc: oSaveData.snippet_desc });
        }
        let oRes = _writeList(aBase);
        if (oRes.RETCD === "E") { return oRes; }
        oRes = _writeCode(oSaveData._key, oSaveData.snippet_code);
        return oRes;
    }

    // 저장·삭제 후 방송(불변 계약).
    function _broadcastChange() {
        try { IPCRENDERER.send("if-browser-interconnection", { PRCCD: "MONACO_SNIPPET_CHANGE" }); }
        catch (e) { console.error("[스니펫디자이너] snippet_change 방송 오류:", e); }
    }

    /* ==================================================================
     * 5. 공통 Monaco 호스트 통신 (js/codeeditor)
     * ================================================================== */
    function _toHost(oMsg) {
        try {
            const oFrame = document.getElementById("snipEditor");
            if (!oFrame || !oFrame.contentWindow) { return; }
            oMsg = oMsg || {};
            oMsg.__u4ace = true;
            oMsg.hostId = HOSTID;
            oFrame.contentWindow.postMessage(oMsg, "*");
        } catch (e) { console.error("[스니펫디자이너] 호스트 송신 오류:", e); }
    }

    // 현재 에디터 값(동일 출처 직접 접근).
    function _readEditorValue() {
        try {
            const oFrame = document.getElementById("snipEditor");
            if (oFrame && oFrame.contentWindow && oFrame.contentWindow.editor) {
                return oFrame.contentWindow.editor.getValue();
            }
        } catch (e) { console.error("[스니펫디자이너] 에디터 값 읽기 오류:", e); }
        return "";
    }

    // 현재 편집 상태를 에디터에 반영(언어/읽기전용/값).
    function _applyEditorState() {
        if (!oState.editorReady) { return; }
        if (oState.cur) {
            _toHost({ cmd: "setLanguage", language: _monacoLang(oState.cur.snippet_langu) });
            _toHost({ cmd: "setReadOnly", readOnly: false });
            _toHost({ cmd: "setValue", value: oState.cur.snippet_code || "" });
        } else {
            _toHost({ cmd: "setValue", value: "" });
            _toHost({ cmd: "setReadOnly", readOnly: true });
        }
    }

    // 호스트 → 부모 통지 수신.
    window.addEventListener("message", function (oEvent) {
        const d = oEvent && oEvent.data;
        if (!d || d.__u4ace !== true || d.hostId !== HOSTID) { return; }
        switch (d.evt) {
            case "ready":
                oState.editorReady = true;
                _applyEditorState();
                return;
            case "change":
                // 외부 주입(setValue) 이 아닌 사용자 편집 → 변경 표시.
                if (oState.cur) { oState.cur._ischg = true; _syncActionButtons(); }
                return;
            case "save":
                // 에디터 Ctrl+S → 저장(편집 화면일 때만).
                if (oState.cur) { saveSnippet(); }
                return;
            default:
                return;
        }
    });

    /* ==================================================================
     * 6. 화면 표시 토글 / 액션 버튼 상태
     * ================================================================== */
    function _showEmpty() {
        const oE = document.getElementById("snipEmpty");
        const oEd = document.getElementById("snipEdit");
        if (oE) { oE.hidden = false; }
        if (oEd) { oEd.hidden = true; }
        _syncActionButtons();
    }

    function _showEdit() {
        const oE = document.getElementById("snipEmpty");
        const oEd = document.getElementById("snipEdit");
        if (oE) { oE.hidden = true; }
        if (oEd) { oEd.hidden = false; }
        // 숨김→표시 전환 후 Monaco 레이아웃 재계산(자동레이아웃 보조).
        _toHost({ cmd: "layout" });
        _syncActionButtons();
    }

    function _syncActionButtons() {
        const bCur = !!oState.cur;
        const bDirty = bCur && (oState.cur._isnew || oState.cur._ischg);
        if (oBtnDel) { oBtnDel.disabled = !bCur; }
        if (oBtnSave) { oBtnSave.disabled = !bDirty; }
        if (oBtnCancel) { oBtnCancel.disabled = !bCur; }
    }

    /* ==================================================================
     * 7. 리스트 렌더 / 선택
     * ================================================================== */
    function renderList() {
        const oHost = document.getElementById("snipTableHost");
        if (!oHost) { return; }

        if (!oState.list.length) {
            oHost.innerHTML = "";
            const oEmpty = document.createElement("div");
            oEmpty.className = "u4aSnipListEmpty";
            oEmpty.textContent = wsMsg("946", "No data");
            oHost.appendChild(oEmpty);
            return;
        }

        const oTbl = document.createElement("table");
        oTbl.className = "u4a-table u4aSnipTable";

        const oThead = document.createElement("thead");
        const oHr = document.createElement("tr");
        const oThName = document.createElement("th"); oThName.textContent = wsMsg("363", "Snippet Name");
        const oThLangu = document.createElement("th"); oThLangu.textContent = wsMsg("001", "Language");
        oHr.appendChild(oThName); oHr.appendChild(oThLangu);
        oThead.appendChild(oHr);
        oTbl.appendChild(oThead);

        const oTbody = document.createElement("tbody");
        oState.list.forEach(function (rec) {
            const oTr = document.createElement("tr");
            oTr.dataset.key = rec._key;
            if (oState.cur && oState.cur._key === rec._key) { oTr.classList.add("is-selected"); }
            if (rec._isnew) { oTr.classList.add("is-new"); }
            // 설명은 잘릴 수 있어 행 툴팁으로(공통 툴팁 — 잘릴 때만 노출).
            if (rec.snippet_desc) { oTr.setAttribute("data-tip", rec.snippet_desc); }

            const oTdName = document.createElement("td");
            oTdName.className = "u4aSnipTable__name";
            oTdName.textContent = rec.snippet_name || (rec._isnew ? wsMsg("361", "New") : "");

            const oTdLangu = document.createElement("td");
            oTdLangu.className = "u4aSnipTable__langu";
            oTdLangu.textContent = rec.snippet_langu || "";

            oTr.appendChild(oTdName);
            oTr.appendChild(oTdLangu);
            oTr.addEventListener("click", function () { onRowClick(rec._key); });
            oTbody.appendChild(oTr);
        });
        oTbl.appendChild(oTbody);

        oHost.innerHTML = "";
        oHost.appendChild(oTbl);
    }

    function _markSelectedRow(sKey) {
        const oHost = document.getElementById("snipTableHost");
        if (!oHost) { return; }
        const aTr = oHost.querySelectorAll("tr[data-key]");
        Array.prototype.forEach.call(aTr, function (tr) {
            tr.classList.toggle("is-selected", tr.dataset.key === sKey);
        });
    }

    // 미저장 신규건 제거.
    function _dropUnsavedNew() {
        oState.list = oState.list.filter(function (o) { return !o._isnew; });
    }

    // 변경/신규 미저장 가드 후 콜백. (원본 M354/M355·M356 확인창)
    function _guardDirtyThen(cb) {
        if (!oState.cur) { cb(true); return; }
        if (oState.cur._isnew) {
            U4AUI.confirm({
                type: "C",
                title: wsMsg("361", "New"),
                message: wsMsg("355", "There is unsaved new data.") + "\n" + wsMsg("356", "Discard the new item and continue?"),
                onClose: function (a) { if (a === "YES") { _dropUnsavedNew(); cb(true); } else { cb(false); } }
            });
            return;
        }
        if (oState.cur._ischg) {
            U4AUI.confirm({
                type: "C",
                message: wsMsg("354", "Discard changes and continue?"),
                onClose: function (a) { cb(a === "YES"); }
            });
            return;
        }
        cb(true);
    }

    function onRowClick(sKey) {
        if (oState.cur && oState.cur._key === sKey) { return; }   // 이미 선택
        _guardDirtyThen(function (bProceed) {
            if (!bProceed) { return; }
            _loadIntoEdit(sKey);
        });
    }

    // 선택 스니펫을 편집 폼/에디터에 로드.
    function _loadIntoEdit(sKey) {
        const rec = oState.list.find(function (o) { return o._key === sKey; });
        if (!rec) { return; }

        const sCode = rec._isnew ? "" : _readCode(rec._key);

        oState.cur = {
            _key: rec._key,
            snippet_langu: rec.snippet_langu || "",
            snippet_name: rec.snippet_name || "",
            snippet_desc: rec.snippet_desc || "",
            snippet_code: sCode,
            _isnew: !!rec._isnew,
            _ischg: false
        };

        // 폼 반영
        try { oLanguField.setValue(oState.cur.snippet_langu); } catch (e) { }
        try { oNameField.setValue(oState.cur.snippet_name); } catch (e) { }
        try { oDescField.setValue(oState.cur.snippet_desc); } catch (e) { }
        _clearValueStates();

        _showEdit();
        _markSelectedRow(sKey);
        _applyEditorState();
        _syncActionButtons();
    }

    function _clearValueStates() {
        try { oLanguField.setValueState("none"); } catch (e) { }
        try { oNameField.setValueState("none"); } catch (e) { }
    }

    /* ==================================================================
     * 8. 액션 : 신규 / 삭제 / 저장 / 취소
     * ================================================================== */
    function newSnippet() {
        // 이미 미저장 신규건이 있으면 차단(원본 M353).
        if (oState.list.some(function (o) { return o._isnew; })) { _toast(wsMsg("353", "An unsaved new item already exists.")); return; }
        _guardDirtyThen(function (bProceed) {
            if (!bProceed) { return; }
            const sKey = getRandomKey(30);
            oState.list.unshift({ _key: sKey, snippet_langu: "", snippet_name: "", snippet_desc: "", _isnew: true });
            renderList();
            _loadIntoEdit(sKey);
            setTimeout(function () { try { oNameField.focus(); } catch (e) { } }, 0);
        });
    }

    function deleteSnippet() {
        if (!oState.cur) { _toast(wsMsg("359", "Select a snippet from the list.")); return; }
        const sKey = oState.cur._key;
        const bWasNew = !!oState.cur._isnew;
        U4AUI.confirm({
            type: "C",
            title: wsMsg("029", "Delete"),
            message: wsMsg("080", "Delete this item?"),
            onClose: function (a) {
                if (a !== "YES") { return; }
                fn_setBusy(true);
                try {
                    // 목록에서 제거.
                    oState.list = oState.list.filter(function (o) { return o._key !== sKey; });

                    if (!bWasNew) {
                        const oRes = _writeList(oState.list);
                        if (oRes.RETCD === "E") {
                            fn_setBusy(false);
                            showErr(wsMsg("357", "Failed to update personalization file after delete.") + "\n" + wsMsg("228", ""));
                            return;
                        }
                        _removeCode(sKey);
                    }

                    oState.cur = null;
                    renderList();
                    _showEmpty();
                    if (!bWasNew) { _broadcastChange(); }
                } finally {
                    fn_setBusy(false);
                }
            }
        });
    }

    function saveSnippet() {
        if (!oState.cur) { return; }
        // 유효성 우선(validate-first).
        if (_checkSave().RETCD === "E") { return; }

        fn_setBusy(true);
        try {
            const oSaveData = {
                _key: oState.cur._key,
                snippet_langu: oState.cur.snippet_langu,
                snippet_name: oState.cur.snippet_name,
                snippet_desc: oState.cur.snippet_desc,
                snippet_code: _readEditorValue()
            };

            const oRes = _saveData(oSaveData);
            if (oRes.RETCD === "E") {
                fn_setBusy(false);
                showErr(wsMsg("367", "A problem occurred while saving the snippet.") + "\n" + wsMsg("228", ""));
                return;
            }

            // 상태/목록 갱신.
            oState.cur._isnew = false;
            oState.cur._ischg = false;
            oState.cur.snippet_code = oSaveData.snippet_code;

            const rec = oState.list.find(function (o) { return o._key === oSaveData._key; });
            if (rec) {
                rec.snippet_langu = oSaveData.snippet_langu;
                rec.snippet_name = oSaveData.snippet_name;
                rec.snippet_desc = oSaveData.snippet_desc;
                delete rec._isnew;
            }

            renderList();
            _markSelectedRow(oSaveData._key);
            _syncActionButtons();
            _toast(wsMsg("366", "Saved."));
            _broadcastChange();
        } finally {
            fn_setBusy(false);
        }
    }

    function cancelSnippet() {
        if (!oState.cur) { _showEmpty(); return; }
        const _finish = function () {
            if (oState.cur && oState.cur._isnew) { _dropUnsavedNew(); }
            oState.cur = null;
            renderList();
            _showEmpty();
        };
        if (oState.cur._ischg || oState.cur._isnew) {
            U4AUI.confirm({ type: "C", message: wsMsg("354", "Discard changes and continue?"), onClose: function (a) { if (a === "YES") { _finish(); } } });
        } else {
            _finish();
        }
    }

    // 저장 전 필수값/정합성(원본 _checkSaveSnippetData).
    function _checkSave() {
        _clearValueStates();

        const sLangu = (oLanguField.getValue() || "");
        const sName = (oNameField.getValue() || "");
        const sDesc = (oDescField.getValue() || "");
        const sCode = _readEditorValue();

        // 현재 폼값을 편집 상태에 동기화.
        oState.cur.snippet_langu = sLangu;
        oState.cur.snippet_name = sName;
        oState.cur.snippet_desc = sDesc;

        if (!sLangu) {
            oLanguField.setValueState("error", wsMsg("349", "Language is required."));
            _toast(wsMsg("349", "Language is required."));
            try { oLanguField.focus(); } catch (e) { }
            return { RETCD: "E" };
        }
        if (!sName) {
            oNameField.setValueState("error", wsMsg("350", "Snippet name is required."));
            _toast(wsMsg("350", "Snippet name is required."));
            try { oNameField.focus(); } catch (e) { }
            return { RETCD: "E" };
        }
        if (/\s/.test(sName)) {
            oNameField.setValueState("error", wsMsg("351", "Snippet name cannot contain spaces."));
            _toast(wsMsg("351", "Snippet name cannot contain spaces."));
            try { oNameField.focus(); } catch (e) { }
            return { RETCD: "E" };
        }
        if (!sCode) {
            _toast(wsMsg("352", "Enter snippet code."));
            _toHost({ cmd: "focus" });
            return { RETCD: "E" };
        }
        return { RETCD: "S" };
    }

    /* ==================================================================
     * 9. 입력 필드 change 핸들러
     * ================================================================== */
    function onLanguChange() {
        if (!oState.cur) { return; }
        oState.cur._ischg = true;
        const sLangu = oLanguField.getValue() || "";
        try { oLanguField.setValueState("none"); } catch (e) { }
        if (!sLangu) {
            try { oLanguField.setValueState("error", wsMsg("349", "Language is required.")); } catch (e) { }
            _toast(wsMsg("349", "Language is required."));
        } else {
            _toHost({ cmd: "setLanguage", language: _monacoLang(sLangu) });
        }
        _syncActionButtons();
    }

    function onNameChange() {
        if (!oState.cur) { return; }
        oState.cur._ischg = true;
        const sName = oNameField.getValue() || "";
        try { oNameField.setValueState("none"); } catch (e) { }
        if (/\s/.test(sName)) {
            try { oNameField.setValueState("error", wsMsg("351", "Snippet name cannot contain spaces.")); } catch (e) { }
            _toast(wsMsg("351", "Snippet name cannot contain spaces."));
        }
        _syncActionButtons();
    }

    function _markDirty() {
        if (!oState.cur) { return; }
        oState.cur._ischg = true;
        _syncActionButtons();
    }

    /* ==================================================================
     * 10. UI 빌드
     * ================================================================== */
    function _fieldBlock(sLabel, bRequired, oInputEl) {
        const oWrap = document.createElement("div");
        oWrap.className = "u4aSnipField";
        const oLbl = document.createElement("label");
        oLbl.className = "u4aSnipField__label";
        if (bRequired) { oLbl.setAttribute("data-required", "true"); }
        oLbl.textContent = sLabel;
        oWrap.appendChild(oLbl);
        oWrap.appendChild(oInputEl);
        return oWrap;
    }

    function _buildListPanel() {
        oListPanel = U4AUI.createPanel({ title: wsMsg("360", "Snippet List") });
        oListPanel.el.classList.add("u4aSnipListPanelCard");

        // 헤더 액션: 신규 / 삭제 (아이콘 + 툴팁).
        oBtnNew = document.createElement("button");
        oBtnNew.type = "button";
        oBtnNew.className = "u4a-btn u4a-btn--emphasized";
        oBtnNew.innerHTML = '<i class="fa-solid fa-plus"></i>';
        oBtnNew.setAttribute("data-tip", wsMsg("361", "New"));
        oBtnNew.addEventListener("click", newSnippet);

        oBtnDel = document.createElement("button");
        oBtnDel.type = "button";
        oBtnDel.className = "u4a-btn u4a-btn--negative";
        oBtnDel.innerHTML = '<i class="fa-solid fa-trash"></i>';
        oBtnDel.setAttribute("data-tip", wsMsg("029", "Delete"));
        oBtnDel.addEventListener("click", deleteSnippet);

        oListPanel.actions.appendChild(oBtnNew);
        oListPanel.actions.appendChild(oBtnDel);

        const oTableHost = document.createElement("div");
        oTableHost.id = "snipTableHost";
        oListPanel.body.appendChild(oTableHost);

        document.getElementById("snipListPanel").appendChild(oListPanel.el);
    }

    function _buildInfoPanel() {
        oInfoPanel = U4AUI.createPanel({ title: wsMsg("362", "Snippet Basic Info") });

        oLanguField = U4AUI.createField({ type: "select", items: LANGU_ITEMS, onChange: onLanguChange });
        oNameField = U4AUI.createField({ type: "text", maxLength: 100, clear: true, onChange: onNameChange, onInput: _markDirty });
        oDescField = U4AUI.createField({ type: "textarea", rows: 3, maxLength: 200, onInput: _markDirty });

        // 초기 미선택 상태.
        try { oLanguField.setValue(""); } catch (e) { }

        const oGrid = document.createElement("div");
        oGrid.className = "u4aSnipInfoGrid";
        oGrid.appendChild(_fieldBlock(wsMsg("001", "Language"), true, oLanguField.el));
        oGrid.appendChild(_fieldBlock(wsMsg("363", "Snippet Name"), true, oNameField.el));
        const oDescBlock = _fieldBlock(wsMsg("176", "Description"), false, oDescField.el);
        oDescBlock.classList.add("u4aSnipField--full");
        oGrid.appendChild(oDescBlock);

        oInfoPanel.body.appendChild(oGrid);
        document.getElementById("snipInfoPanel").appendChild(oInfoPanel.el);
    }

    function _buildEditorFrame() {
        oState.monacoTheme = _computeMonacoTheme();
        const oFrame = document.getElementById("snipEditor");
        if (!oFrame) { return; }
        const oParams = { HOSTID: HOSTID, LANG: "javascript", THEME: oState.monacoTheme, READONLY: true };
        // 공통 호스트(js/codeeditor)를 상대경로로 로드(?PARAMS 로 초기값 주입).
        oFrame.src = "../../../js/codeeditor/index.html?PARAMS=" + encodeURIComponent(JSON.stringify(oParams));
    }

    function _bindTitlebar() {
        // 로고
        const oLogo = document.getElementById("snipLogo");
        if (oLogo) {
            try { oLogo.src = encodeURI("file:///" + PATH.join(APPPATH, "img", "logo.png").replaceAll("\\", "/")); } catch (e) { }
        }
        // 제목
        const oTitle = document.getElementById("snipTitle");
        if (oTitle) { oTitle.textContent = wsMsg("343", document.title || "Snippet Designer"); }

        // 닫기
        const oClose = document.getElementById("snipWinClose");
        if (oClose) { oClose.addEventListener("click", fn_close); }

        // 최대화 토글 + 아이콘 동기.
        const oMax = document.getElementById("snipWinMax");
        if (oMax) {
            const _syncMaxIcon = function () {
                try {
                    const oI = oMax.querySelector("i");
                    if (oI) { oI.className = CURRWIN.isMaximized() ? "fa-solid fa-window-restore" : "fa-solid fa-window-maximize"; }
                } catch (e) { }
            };
            oMax.addEventListener("click", function () {
                try { if (CURRWIN.isMaximized()) { CURRWIN.unmaximize(); } else { CURRWIN.maximize(); } } catch (e) { }
            });
            try { CURRWIN.on("maximize", _syncMaxIcon); CURRWIN.on("unmaximize", _syncMaxIcon); } catch (e) { }
            _syncMaxIcon();
        }
    }

    function fn_close() {
        if (oState.isBusy) { return; }   // busy 중 닫기 차단
        try { U4AUI.closeWindow(CURRWIN); } catch (e) { console.error("[스니펫디자이너] 닫기 오류:", e); }
    }

    function _bindStaticTexts() {
        const oEmptyTitle = document.getElementById("snipEmptyTitle");
        if (oEmptyTitle) { oEmptyTitle.textContent = wsMsg("358", "No item selected!"); }
        const oEmptyDesc = document.getElementById("snipEmptyDesc");
        if (oEmptyDesc) { oEmptyDesc.textContent = wsMsg("359", "Select a snippet from the list."); }
        const oCodeTitle = document.getElementById("snipCodeTitle");
        if (oCodeTitle) { oCodeTitle.textContent = wsMsg("364", "Snippet Code"); }
        const oSaveTxt = document.getElementById("snipBtnSaveText");
        if (oSaveTxt) { oSaveTxt.textContent = wsMsg("365", "Save"); }
        const oCancelTxt = document.getElementById("snipBtnCancelText");
        if (oCancelTxt) { oCancelTxt.textContent = wsMsg("003", "Cancel"); }
    }

    function initUIBuild() {
        _bindTitlebar();
        _bindStaticTexts();
        _buildListPanel();
        _buildInfoPanel();
        _buildEditorFrame();

        // 저장/취소.
        oBtnSave = document.getElementById("snipBtnSave");
        oBtnCancel = document.getElementById("snipBtnCancel");
        oBtnSave.addEventListener("click", saveSnippet);
        oBtnCancel.addEventListener("click", cancelSnippet);

        // 좌|우 스플리터(공통).
        try { U4AUI.wireSplitter(document.getElementById("snipSplit"), { axis: "x" }); } catch (e) { console.error("[스니펫디자이너] 스플리터 배선 오류:", e); }

        // 초기 데이터 로드 + 렌더 + 빈상태.
        oState.list = _readList();
        renderList();
        _showEmpty();
    }

    /* ==================================================================
     * 11. 라이프사이클
     * ================================================================== */
    // opener 초기 데이터(scope/theme) — 없어도 동작(테마/타이틀은 쿼리로 이미 반영).
    IPCRENDERER.on("if-data", function (event, oData) {
        try { oState.scopeCode = (oData && oData.scopeCode) || ""; } catch (e) { }
    });

    document.addEventListener("DOMContentLoaded", function () {
        try {
            initUIBuild();

            // 준비 완료 → 창 노출(플래시 방지: opener show:false 로 열림).
            requestAnimationFrame(function () {
                try { CURRWIN.show(); } catch (e) { }
                document.body.classList.add("u4a-visible");
                fn_setBusy(false);
            });
        } catch (e) {
            console.error("[스니펫디자이너] 초기화 오류:", e);
            try { CURRWIN.show(); } catch (e2) { }
        }
    });

    // busy 중 닫기 차단.
    window.onbeforeunload = function () {
        if (oState.isBusy) { return false; }
    };

})();
