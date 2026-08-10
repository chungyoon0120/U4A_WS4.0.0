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

    // 라벨:값 한 줄(잘리면 공통 툴팁 — 16 §2.9a data-tip-trunc).
    function _infoRow(oParent, sLabel, sVal) {
        var oRow = H.el("div", "u4aBwpSyncInfoRow");
        var oLb = H.el("span", "u4aBwpSyncInfoLbl");
        oLb.textContent = sLabel || "";
        oLb.setAttribute("data-tip", sLabel || ""); oLb.setAttribute("data-tip-trunc", "");
        var oVal = H.el("span", "u4aBwpSyncInfoVal");
        var sTxt = (sVal === null || typeof sVal === "undefined") ? "" : String(sVal);
        oVal.textContent = sTxt;
        oVal.setAttribute("data-tip", sTxt); oVal.setAttribute("data-tip-trunc", "");
        oRow.appendChild(oLb); oRow.appendChild(oVal);
        oParent.appendChild(oRow);
    }

    // 추가속성(T_MPROP) 구성 — 원본 _setAdditBindData(synchronizionBind.js:118) 기반 + [개선 08-09 장군님 지시].
    //   ★원본은 MPROP 없거나 빈 값이면 exit(항목 미표시). 개선: 지정 여부와 무관하게 항목(라벨)을 '항상' 표시(값 없으면 빈 값).
    //     → 사용자가 그 속성에 어떤 추가속성 항목이 있는지 항상 인지. (노션 개선 아이디어 기록 후 적용)
    //   UA028(FLD02≠"X" 제외 → ITMCD 정렬) 을 MPROP split("|") 과 ★같은 인덱스로 짝(prop=FLD01, val=split[i]).
    function _buildTMprop(sMprop) {
        var a = [];
        var aUa = (oAPP.attr.T_9011 || []).filter(function (x) { return x.CATCD === "UA028"; });
        if (aUa.length === 0) { return a; }                                              // 항목 정의 자체가 없으면 표시 불가.
        aUa = aUa.filter(function (x) { return x.FLD02 !== "X"; });                       // 조회속성 제외.
        aUa.sort(function (x, y) { return x.ITMCD.localeCompare(y.ITMCD); });             // ITMCD 오름차순.
        var aSplit = (typeof sMprop === "string" && sMprop !== "") ? sMprop.split("|") : [];   // 지정 없으면 값 전부 빈 값.
        for (var i = 0; i < aUa.length; i++) {
            a.push({ ITMCD: aUa[i].ITMCD, prop: aUa[i].FLD01, val: (aSplit[i] != null ? aSplit[i] : "") });   // ★인덱스 짝(순서 틀리면 값 밀림).
        }
        return a;
    }

    // [S2] 상단 패널 — 선택 속성 4줄 + 추가속성 값. 원본 setModelData(87)/designView 패널부(967~1099).
    function _renderSyncPanel(oBody) {
        var s = oSync.S_ATTR || {};
        var oPanel = U4AUI.createPanel({ title: H.z("060") });   // 060 Selected UI Object Info(트위스티=원본 ▶ 대체).
        oBody.appendChild(oPanel.el);

        // 원본 HBOX1(wrap): [선택 속성 4줄] + [추가속성 값]을 가로로 나란히(좁으면 줄바꿈) — synchronizionBind.js:997/1077.
        var oGrid = H.el("div", "u4aBwpSyncPanelGrid");

        // 4줄: 190 UI Object ID / 191 Attribute ID / 192 Attribute Type / 193 Binding Field.
        var oInfo = H.el("div", "u4aBwpSyncInfo");
        _infoRow(oInfo, H.z("190"), s.OBJID);
        _infoRow(oInfo, H.z("191"), s.UIATT);
        _infoRow(oInfo, H.z("192"), s.UIADT);
        _infoRow(oInfo, H.z("193"), s.UIATV);
        oGrid.appendChild(oInfo);

        // 추가속성 값 목록(읽기전용) — 없으면 미표시(원본 _setAdditBindData exit).
        var aMprop = _buildTMprop(s.MPROP);
        if (aMprop.length > 0) {
            var oMp = H.el("div", "u4aBwpSyncInfo u4aBwpSyncMprop");
            aMprop.forEach(function (m) { _infoRow(oMp, m.prop, m.val); });
            oGrid.appendChild(oMp);
        }
        oPanel.body.appendChild(oGrid);
    }

    // [S3] 하단 후보 테이블 — 7컬럼 멀티선택 + 컬럼최적화. 원본 designView 테이블부(1106~1228).
    //   데이터 = oSync.aList(getSameAttrList). 멀티선택 = 체크박스 열(공통 makeDataTable 은 단일선택뿐).
    function _renderSyncList(oBody) {
        var oWrap = H.el("div", "u4aBwpSyncList");

        // 제목 061 Target Replace Properties.
        var oTitle = H.el("div", "u4aBwpSyncListTitle");
        oTitle.textContent = H.z("061");
        oWrap.appendChild(oTitle);

        // 툴바: [일괄적용 141 — S4까지 비활성] · Spacer · [컬럼최적화 161].
        var oBar = H.el("div", "u4aBwpTool u4aBwpSyncListTool");
        var oApply = _btn("check", H.z("141"), H.z("141"), "u4a-btn--emphasized", function () {   // 141 일괄적용.
            if (typeof oAPP.fn.onSetSyncAttr === "function") {
                try { oAPP.fn.onSetSyncAttr(); } catch (e) { console.error("[HTML5][bindWindow] onSetSyncAttr:", e && e.message); }
            }
        });
        oApply.setAttribute("data-bwp-sync-apply", "1");
        oBar.appendChild(oApply);
        oBar.appendChild(H.el("span", "u4aBwpToolSpacer"));
        oBar.appendChild(H.iconBtn("arrows-left-right-to-line", H.z("161"), function () {   // 161 컬럼최적화(auto layout 재계산).
            if (oSync.tbl) { oSync.tbl.refresh(); }
        }));
        oWrap.appendChild(oBar);

        // 테이블 호스트 + 공통 makeDataTable(비가상 — 후보 소수).
        var oHost = H.el("div", "u4aBwpSyncListHost");
        oWrap.appendChild(oHost);
        oBody.appendChild(oWrap);

        oSync.tbl = U4AUI.makeDataTable(oHost, {
            virtual: false, zebra: true,
            rowKey: function (r, i) { return r.OBJID + "|" + r.UIATK + "|" + i; },
            emptyText: H.z("312"),   // 312 No data Found.
            columns: [
                {
                    label: "", className: "u4aBwpSyncChkCol", align: "center",
                    cell: function (r) {
                        var cb = H.el("input", "u4aBwpSyncChk"); cb.type = "checkbox"; cb.checked = !!r._chk;
                        cb.addEventListener("click", function (e) { e.stopPropagation(); });     // 행 클릭 선택과 분리.
                        cb.addEventListener("change", function () { r._chk = cb.checked; _syncSetAllChkState(); });   // 개별 → 헤더 전체선택 동기화.
                        return cb;
                    }
                },
                { label: H.z("190"), key: "OBJID" },   // UI Object ID.
                { label: H.z("191"), key: "UIATT" },   // Attribute ID.
                { label: H.z("178"), key: "UIATV" },   // Value(=바인딩 필드).
                { label: H.z("194"), key: "UILIB" },   // UI Object Module.
                { label: H.z("195"), key: "UIOBK" },   // UI Object Key.
                { label: H.z("196"), key: "POBID" },   // Parent UI Object ID.
                { label: H.z("197"), key: "PUIOK" }    // Parent Object Module.
            ]
        });
        oSync.tbl.setRows(oSync.aList || []);
        _injectSyncSelectAll(oHost);   // 헤더 전체선택 체크박스 주입(원본 MultiToggle 대응). setRows 는 헤더 미갱신이라 1회 주입으로 유지.
    }

    // [S3] 헤더 첫 칸 전체선택 체크박스 주입 — 공통 makeDataTable 무수정(헤더 커스텀 셀 미지원) → 이 표 스코프 후처리.
    //   원본 sap.ui.table.Table selectionMode 기본값 MultiToggle 의 헤더 전체선택 대응(synchronizionBind.js:1107, selectionMode 미지정).
    function _injectSyncSelectAll(oHost) {
        var oTh = oHost && oHost.querySelector("thead th.u4aBwpSyncChkCol");
        if (!oTh) { oSync._allChk = null; return; }
        oTh.textContent = "";
        var oAll = H.el("input", "u4aBwpSyncChk u4aBwpSyncChkAll"); oAll.type = "checkbox";
        oAll.addEventListener("click", function (e) { e.stopPropagation(); });
        oAll.addEventListener("change", function () {
            (oSync.aList || []).forEach(function (r) { r._chk = oAll.checked; });   // 전 행 일괄 체크/해제.
            if (oSync.tbl) { oSync.tbl.setRows(oSync.aList || []); }                // body 재렌더(헤더 유지).
            oAll.indeterminate = false;
        });
        oTh.appendChild(oAll);
        oSync._allChk = oAll;
        _syncSetAllChkState();
    }

    // 개별 체크 상태 → 헤더 전체선택 동기화: 전부=체크 / 일부=중간표시 / 없음=해제.
    function _syncSetAllChkState() {
        var oAll = oSync._allChk;
        if (!oAll) { return; }
        var a = oSync.aList || [];
        var n = a.filter(function (r) { return r._chk === true; }).length;
        oAll.checked = (a.length > 0 && n === a.length);
        oAll.indeterminate = (n > 0 && n < a.length);
    }

    // 선택(체크)된 후보 수집 — 원본 _getSelectedData(synchronizionBind.js:184) 대응. S4 일괄적용이 소비.
    oAPP.fn.getSyncSelectedRows = function () {
        return (oSync.aList || []).filter(function (r) { return r._chk === true; });
    };

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
        tool.appendChild(_btn("chevron-left", H.z("189"), H.z("189"), "u4a-btn--emphasized", function () {   // 189 Back — WS20 뒤로가기와 동일 아이콘(원본 nav-back → HTML5 chevron-left, ws_html5_ws20.js:717)
            oAPP.fn.onSyncMoveDesignPage();
        }));
        // 140 동일속성 적용 팝업 호출(원본 onCallSyncBindPopup:659). ★열 때 자기 비활성(원본 666), 닫아도 재활성 안 함(화면 재진입 전까지).
        var oPopBtn = _btn("up-right-from-square", H.z("140"), H.z("140"), "u4a-btn--emphasized", function () {
            if (typeof oAPP.fn.onCallSyncBindPopup === "function") { oAPP.fn.onCallSyncBindPopup(oPopBtn); }
        });
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

        // 상단 패널(선택 속성 4줄 + 추가속성 값) — S2 / 하단 후보 테이블(7컬럼 멀티선택) — S3.
        _renderSyncPanel(body);
        _renderSyncList(body);

        oSync.page = page;

        // ── 가운데 영역 슬라이드 진입(forward) ──
        //   ★진입 busy off 는 슬라이드(0.26s) 완전 종료 콜백에서 — 원본 afterNavigate/onViewReady:430 = setBusyWS20Interaction(false)[sOption 없음].
        //     (슬라이드 도중 로딩을 미리 끄면 그 틈에 "동일속성 적용 팝업 호출" 등 버튼 연타가 들어와 화면 전환이 꼬여 백지 — 2026-08-10 장군님 발견.)
        //     WS20 미방송: 별창 로컬 busy off + 닫기(X)버튼 복원, WS20 busy(225)는 뒤로/적용완료까지 유지(2026-08-09 정정 유지).
        oAPP.fn.designSwapToPage(page, false, function () {
            oAPP.fn.setBusyWS20Interaction(false);
        });

        // ── 진입 부수효과(원본 designTree.js onSynchronizionBind:2656~2670 순서) ──
        oAPP.fn.setAdditBindButtonEnable(false);       // 2656 우측 바인딩 버튼 비활성.
        oAPP.fn.setLayoutCustomizingEditable(false);   // 2657 우측 기어 비활성.
        oAPP.attr.bSyncEqualityScreenActive = true;    // 2658 화면 활성 플래그.
        if (typeof oAPP.fn.clearSelectAdditBind === "function") { oAPP.fn.clearSelectAdditBind(); }   // 2662 추가속성 선택 초기화.
        if (typeof oAPP.fn.setAdditLayout === "function") { oAPP.fn.setAdditLayout(""); }             // 2666 중앙하단 addit 패널 비움.
        oAPP.fn.setViewEditable(false);                // 2670 메인(중앙하단 적용/좌측 갱신/좌측 기어) 비활성.
    };

    /************************************************************************
     * [S5] 140 "동일속성 적용 팝업 호출" — 원본 onCallSyncBindPopup(synchronizionBind.js:659).
     *   ★비모달 <dialog>.show()(원본 setModal(false)) — 뒤 디자인 트리 조작 가능.
     *   동일속성 화면(상단 패널 + 후보 테이블)을 다이얼로그에 렌더(같은 oSync 데이터 공유), 가운데는 트리로 복귀(moveDesignPage).
     *   busy: 진입 팝업 lock(WS20 미방송, 225 유지) → afterOpen off / 닫을 때 WS20 BUSY_OFF(225 해제, 원본 711).
     ************************************************************************/
    oAPP.fn.onCallSyncBindPopup = async function (oBtn) {
        // 원본 662 setBusyWS20Interaction(true)[sOption 없음] = 팝업 lock, WS20 미방송(225 유지).
        oAPP.fn.setBusy(true, { ISBROAD: true });
        if (oBtn) { oBtn.disabled = true; }   // 원본 666 self setEnabled(false) — 닫아도 재활성 안 함.
        try { if (document.activeElement) { document.activeElement.blur(); } } catch (e) { }

        var oDlg = document.createElement("dialog");
        oDlg.className = "u4a-dialog u4aBwpSyncDlg";

        // 헤더 — 제목 188 + 닫기 X(056).
        var oHead = H.el("div", "u4a-dialog__header");
        oHead.innerHTML = "<span></span>";
        oHead.querySelector("span").textContent = H.z("188");   // 188 Property 모두 바꾸기
        var oX = H.el("button", "u4a-btn-icon");
        oX.type = "button";
        oX.innerHTML = H.fa("xmark");
        oX.title = H.z("056");   // 056 닫기
        oX.addEventListener("click", function () { _closeSyncDialog(); });
        oHead.appendChild(oX);
        oDlg.appendChild(oHead);

        // 본문 — 상단 패널(S2) + 후보 테이블(S3), 같은 oSync 데이터로 재렌더(원본 VB_MAIN clone + 모델 공유).
        var oBody = H.el("div", "u4a-dialog__body u4aBwpSyncBody");
        oSync.body = oBody;
        oDlg.appendChild(oBody);
        _renderSyncPanel(oBody);
        _renderSyncList(oBody);

        // 푸터 — 닫기(003 취소).
        var oFoot = H.el("div", "u4a-dialog__footer");
        oFoot.appendChild(H.el("span", "u4aBwpToolSpacer"));
        var oCloseBtn = H.el("button", "u4a-btn u4a-btn--negative");
        oCloseBtn.type = "button";
        oCloseBtn.innerHTML = H.fa("xmark");
        oCloseBtn.title = H.z("003");   // 003 취소
        oCloseBtn.addEventListener("click", function () { _closeSyncDialog(); });
        oFoot.appendChild(oCloseBtn);
        oDlg.appendChild(oFoot);

        document.body.appendChild(oDlg);
        // 드래그/리사이즈(공통 — 원본 draggable:true/resizable:true).
        if (window.U4AUI) {
            if (U4AUI.makeDialogDraggable) { U4AUI.makeDialogDraggable(oDlg, oHead); }
            if (U4AUI.makeDialogResizable) { U4AUI.makeDialogResizable(oDlg); }
            if (U4AUI.makeDialogRecenter) { U4AUI.makeDialogRecenter(oDlg, oHead); }   // 헤더 더블클릭 → 화면 중앙 복귀(공통 표준 UX, 타 팝업 전부 소비 — S5 만 누락되어 이식).
        }

        // 원본 beforeOpen(685): setViewLayoutEditable(false)[좌/가운데/우 잠금] + 후보테이블 선택 해제.
        _setSyncViewLayout(false);
        _clearSyncListSelection();

        oSync.oDialog = oDlg;
        try { oDlg.show(); } catch (e) { try { oDlg.open = true; } catch (e2) { } }   // ★비모달(원본 setModal(false)).

        // afterOpen: 팝업 busy off(원본 694). WS20(225)는 유지.
        oAPP.fn.setBusy(false, { ISBROAD: true });

        // 가운데 트리로 복귀(원본 770 moveDesignPage).
        await oAPP.fn.moveDesignPage();
    };

    // [S5] 다이얼로그 닫기 — 원본 beforeClose(698) setViewLayoutEditable(true) / afterClose(711) destroy + WS20 BUSY_OFF(225 해제).
    function _closeSyncDialog() {
        var oDlg = oSync.oDialog;
        if (!oDlg) { return; }
        _setSyncViewLayout(true);   // 원본 beforeClose(698): 좌/가운데/우 잠금 해제.
        try { oDlg.close(); } catch (e) { }
        try { oDlg.remove(); } catch (e) { }
        oSync.oDialog = null;
        oAPP.fn.setBusyWS20Interaction(false, {});   // 원본 afterClose(711) broadToChild BUSY_OFF.
    }

    // [S5] 닫기 전용 절차를 외부(일괄적용 성공 경로 designArea.onSetSyncAttr)에서도 호출 가능하게 공개.
    //   원본은 UI5 Dialog.close() 가 beforeClose(잠금해제)+afterClose(destroy+BUSY_OFF)를 자동 발동하나,
    //   HTML5 <dialog> 는 자동 이벤트가 없어 성공 경로에서 이 절차를 명시 호출해야 X/취소 닫기와 동일해진다.
    oAPP.fn.closeSyncBindDialog = _closeSyncDialog;

    // [S5] 원본 setViewLayoutEditable(synchronizionBind.js:820) — 다이얼로그 열린 동안 좌/가운데/우 잠금.
    function _setSyncViewLayout(bLock) {
        if (oAPP.attr.editable !== true) { return; }   // 원본 823 IS_EDIT === "" 대응(편집 불가 화면이면 무동작).
        if (oAPP.fn.setViewEditable) { oAPP.fn.setViewEditable(bLock); }                     // 원본 829 메인(중앙하단 적용/좌 갱신/기어)
        if (oAPP.fn.designSetViewEditable) { oAPP.fn.designSetViewEditable(bLock); }         // 원본 833 디자인(가운데 트리 선택/링크)
        if (oAPP.fn.setAdditBindButtonEnable) { oAPP.fn.setAdditBindButtonEnable(bLock); }   // 원본 837 우측 추가속성 바인딩 버튼
        if (oAPP.fn.refreshAdditFieldsLock) { oAPP.fn.refreshAdditFieldsLock(); }            // 값 입력칸(중앙하단·우측) 잠금 반영 — 우측은 진입 시 재렌더 안 되므로 강제 재렌더.
        // 원본 839~841: 동일속성 모드면 우측 기어는 항상 잠금(false), 아니면 bLock 을 따름.
        if (oAPP.fn.setLayoutCustomizingEditable) {
            oAPP.fn.setLayoutCustomizingEditable(oAPP.attr.bSyncEqualityScreenActive === true ? false : bLock);
        }
    }

    // [S5] 후보 테이블 선택 초기화 — 원본 _clearSelectionPopupTable(synchronizionBind.js:348).
    function _clearSyncListSelection() {
        (oSync.aList || []).forEach(function (r) { r._chk = false; });
        if (oSync.tbl && typeof oSync.tbl.refresh === "function") { oSync.tbl.refresh(); }
        _syncSetAllChkState();   // 헤더 전체선택 체크박스도 해제 상태로 갱신 — 개별 행만 지우면 맨 위 전체선택이 직전(뒤 테이블) 상태로 남는다(원본 _clearSelectionPopupTable=테이블 전체 선택 해제, 헤더 포함).
    }

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
