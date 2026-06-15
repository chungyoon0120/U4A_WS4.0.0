/************************************************************************
 * ws_html5_ws20_data.js  (HTML5)
 * ----------------------------------------------------------------------
 * [HTML5 컨버전 메모 — W3.5 단계: WS20 좌측 "UI 트리" 데이터 파이프라인]
 *  W3(ws_html5_ws20_tree.js)에서 /zTREE 를 <ul>/<li> 재귀 트리로 렌더하는 로직은
 *  이미 완성되었으나, /zTREE 자체가 비어있다. 본 파일은 서버에서 앱 구조
 *  (T_0014 평면 테이블 등)를 받아 /zTREE(중첩 트리)로 변환해 트리를 채우는
 *  "데이터 파이프라인"을 연결한다.
 *
 *  본 파일은 library-preload.js 의 로드 목록에서 ws_html5_ws20_tree.js "보다 뒤"
 *  (가장 마지막) 에 위치한다.
 *
 *  ────────────────────────────────────────────────────────────────────
 *  [원본 데이터 흐름 — design/js/main.js 의 oAPP.fn.getAppData (421행~)]
 *  ────────────────────────────────────────────────────────────────────
 *   원본은 sendAjax(servNm + "/getAppData", oFormData, cb, "X", true, "GET", errCb) 로
 *   서버에서 param.APPDATA(T_0014/T_0015/T_CEVT 등)를 받아:
 *     1) T_0014/T_0015/T_CEVT 가공 루프(447~505행)
 *     2) oAPP.DATA.APPDATA = param.APPDATA;
 *     3) oAPP.attr.oModel.oData.TREE = oAPP.DATA.APPDATA.T_0014;
 *     4) oAPP.attr.oModel.oData.IS_EDIT = (appInfo.IS_EDIT === "" ? false : true);
 *     5) oAPP.fn.setTreeJson(oModel,"TREE","OBJID","POBID","zTREE");  ← 평면→중첩
 *     6) 데코레이터 4종: setTreeDnDEnable / setTreeChkBoxEnable /
 *                        setTreeUiIcon / designSetActionIcon
 *   본 파일은 위 (1)~(6) "데이터 로직"을 원본 그대로 복제하고, 마지막에
 *   oAPP.attr.oModel.refresh() 로 HTML5 트리(fnRenderDesignTree)를 재렌더한다.
 *
 *  ────────────────────────────────────────────────────────────────────
 *  [데코레이터의 UI5(sap.*) 의존 여부 — 실측 결과]
 *  ────────────────────────────────────────────────────────────────────
 *   · setTreeDnDEnable    (uiDesignArea.js 1831) : 순수 데이터(drag/drop_enable 플래그). UI5 無.
 *   · setTreeChkBoxEnable (uiDesignArea.js 1759) : 순수 데이터(chk/chk_visible 플래그). UI5 無.
 *   · designSetActionIcon (uiDesignArea.js 1860) : 순수 데이터(visible_add/delete 플래그). UI5 無.
 *   · setTreeUiIcon       (uiDesignArea.js 1645) : sap.* 직접 호출 없음. 단,
 *        - setTreeAggrIcon(1535): "sap-icon://..." 문자열만 세팅(UI5 객체 생성 아님).
 *        - fnGetSapIconPath(ws_fn_03.js 323): PATH.join(APP.getAppPath(),"icons",x+".gif")
 *          → 순수 경로 문자열 생성. UI5 의존 아님.
 *        - 그러나 oAPP.DATA.LIB.T_0022.find(...) 를 참조 → "라이브러리 데이터(getLibData)"
 *          의존. 라이브러리 데이터는 본 단계(W3.5) 범위 밖이라 미로딩일 수 있어
 *          TypeError 위험이 있음. → setTreeUiIcon 은 try/catch 가드(데이터 채우기는
 *          살리고, 아이콘 데코만 skip + console.warn).
 *   결론: 4종 모두 UI5(sap.*) "호출"은 없다. UI 렌더링 의존은 없으며, setTreeUiIcon 만
 *         라이브러리 데이터(LIB.T_0022) 의존으로 가드가 필요하다. 나머지도 일관성/안전을
 *         위해 동일하게 try/catch 가드한다(루트 노드 미존재 등 방어).
 ************************************************************************/

(function (window, $, oAPP) {
    "use strict";

    /************************************************************************
     * [원본 보존] setTreeJson / setTreeData (구 design/js/main.js 342/394행).
     * ---------------------------------------------------------------------
     *  원본은 이 두 함수를 oAPP.fn.main() "내부"에서 정의한다. HTML5 셸은 main()
     *  을 호출하지 않으므로(범위 밖 — UI5 렌더링 포함) 정의가 누락된다.
     *  두 함수는 순수 데이터 변환(평면 → 중첩)으로 UI5 의존이 전혀 없으므로,
     *  원본 코드를 1:1 그대로 복제하여 oAPP.fn 에 정의한다.
     *  (이미 다른 경로로 정의되어 있으면 덮어쓰지 않음 — 원본 우선)
     ************************************************************************/

    //tree 구성 function. (원본 main.js 342행 1:1 복제)
    if (typeof oAPP.fn.setTreeJson !== "function") {
        oAPP.fn.setTreeJson = function (oModel, path, child, parent, treePath) {

            //"stru/table" 형식인경우 stru부분 발췌.
            var l_ppath = path.substr(0, path.lastIndexOf("/"));

            //원본 table 정보 얻기.
            var lt_org = oModel.getProperty("/" + path);

            //stru에 해당하는 정보 얻기.
            var tm2 = oModel.getProperty("/" + l_ppath);

            //원본 table 정보가 존재하지 않는경우.
            if (!lt_org || lt_org.length === 0) {
                //stru에 treePath이름으로 table 필드 생성.
                tm2[treePath] = [];

                //모델 갱신 처리 후 exit.
                oModel.refresh();
                return;

            }


            //tree data 구성.
            tm2[treePath] = oAPP.fn.setTreeData(lt_org, parent, child, treePath);

        };  //tree 구성 function.
    }

    //tree data 구성. (원본 main.js 394행 1:1 복제)
    if (typeof oAPP.fn.setTreeData !== "function") {
        oAPP.fn.setTreeData = function (it_data, parent, child, treePath) {

            var lt_copy = JSON.parse(JSON.stringify(it_data));

            for (var e, h, u, a = [], c = {}, o = 0, f = lt_copy.length; f > o; o++) {

                e = lt_copy[o];

                h = e[child];

                u = e[parent] || 0;

                c[h] = c[h] || [];

                e[treePath] = c[h];

                0 != u ? (c[u] = c[u] || [], c[u].push(e)) : a.push(e);
            }

            return a;

        };
    }

    /************************************************************************
     * 데코레이터 1종 안전 호출 — 트리 데이터 채우기는 살리고, 데코만 가드.
     *   원본 함수가 UI5/라이브러리 데이터 의존 등으로 throw 해도, /zTREE 자체는
     *   이미 구성된 상태이므로 트리는 정상 렌더되어야 한다.
     ************************************************************************/
    function _safeDecorate(sFnName, oRootNode) {
        var fn = oAPP.fn && oAPP.fn[sFnName];
        if (typeof fn !== "function") {
            console.warn("[HTML5][WS20][data] decorator not found (skip):", sFnName);
            return;
        }
        if (!oRootNode) {
            // 루트 노드 자체가 없으면(빈 트리) 데코레이터 호출 불가 — skip.
            return;
        }
        try {
            fn(oRootNode);
        } catch (e) {
            console.warn("[HTML5][WS20][data] decorator skip (라이브러리/미변환 의존):",
                sFnName, e && e.message);
        }
    }

    /************************************************************************
     * [PUBLIC] WS20 트리 데이터 로드 (구 design/js/main.js oAPP.fn.getAppData).
     *   서버에서 앱 구조(APPDATA)를 받아 /zTREE 로 변환 → HTML5 트리 재렌더.
     *   - 서버 응답이 없거나(헤드리스/비로그인) 실패해도 크래시 없이 빈 트리 유지.
     *   - 데이터 로직(T_0014/T_0015/T_CEVT 가공, setTreeJson, 데코레이터)은
     *     원본 1:1 보존. UI5 렌더링(미리보기/속성/UI5 인스턴스)은 호출하지 않음.
     ************************************************************************/
    oAPP.fn.fnLoadWs20TreeData = function () {

        // ── 사전 준비: servNm / APPID / appInfo (원본 main.fn / setUIAreaEditable 흐름) ──
        try {
            // path prefix(서버경로) — 원본 main.js 18행: oAPP.attr.servNm = parent.getServerPath();
            if (!oAPP.attr.servNm) {
                oAPP.attr.servNm = parent.getServerPath();
            }

            // APPLICATION 세부 정보 광역화 — 원본 setUIAreaEditable 746행과 동일.
            //  데코레이터(setTreeChkBoxEnable/designSetActionIcon)가 appInfo.IS_EDIT 를 참조.
            var oAppInfo = parent.getAppInfo();
            oAPP.attr.appInfo = oAppInfo || {};

            // 20번 페이지에 보여질 APPID (원본 fnMoveToWs20 641행과 동일).
            if (oAppInfo && oAppInfo.APPID) {
                oAPP.attr.APPID = oAppInfo.APPID;
            }
        } catch (e) {
            console.warn("[HTML5][WS20][data] appInfo/servNm 준비 실패(서버 미로그인 가능):", e && e.message);
        }

        // 서버 경로/APPID 가 없으면(헤드리스/비로그인) 서버 호출하지 않고 빈 트리 유지.
        if (!oAPP.attr.servNm || !oAPP.attr.APPID) {
            console.warn("[HTML5][WS20][data] servNm/APPID 없음 — 빈 트리 유지(서버 미로그인).");
            return;
        }

        // 시작 시 busy lock (원본 parent.setBusy("X") / designAreaLockUnlock 대체).
        try { oAPP.common.fnSetBusyLock("X"); } catch (e) { }

        // application명 서버전송 데이터 구성 — 원본 430~431행.
        var oFormData = new FormData();
        oFormData.append("APPID", oAPP.attr.APPID);

        // 서버 호출 (원본 434행 / 606행: bIsBusy="X", bIsAsync=true, meth="GET", fn_error).
        try {
            sendAjax(oAPP.attr.servNm + "/getAppData", oFormData, async function (param) {

                try {

                    // ================================================================
                    //  ↓↓↓ 원본 main.js getAppData 콜백 가공 로직(447~505행) 1:1 복제 ↓↓↓
                    // ================================================================

                    // 서버 응답 방어(헤드리스/오류 응답).
                    if (!param || !param.APPDATA || !param.APPDATA.T_0014) {
                        console.warn("[HTML5][WS20][data] APPDATA/T_0014 없음 — 빈 트리 유지.");
                        return;
                    }

                    for (var i = param.APPDATA.T_0014.length - 1; i >= 0; i--) {

                        let _s0014 = param.APPDATA.T_0014[i];

                        //StyleCSS, HTMLCode, ScriptCode UI가 존재하는경우.
                        if (_s0014.UIOBK === "UO99997" || _s0014.UIOBK === "UO99998" || _s0014.UIOBK === "UO99999") {
                            //해당 라인 삭제.
                            param.APPDATA.T_0014.splice(i, 1);
                            continue;
                        }


                        //20250107 PES -START.
                        //HTML UI가 존재하는경우, content 프로퍼티의 값이 있으나, editor에 값이 존재하지 않다면
                        //content 프로퍼티의 값을 제거 처리함.
                        if (_s0014.UIOBK === "UO00873") {

                            //HTML UI의 content 프로퍼티 입력건 존재 여부 확인.(바인딩 제외)
                            let _indx = param.APPDATA.T_0015.findIndex(item => item.OBJID === _s0014.OBJID && item.UIATK === "AT000011858" && item.ISBND === "");

                            //content 프로퍼티 입력건이 존재하지 않는경우 skip.
                            if (_indx === -1) {
                                continue;
                            }

                            //찾은 index의 content 프로퍼티 라인 정보 얻기.
                            let _s0015 = param.APPDATA.T_0015[_indx];

                            //프로퍼티 수집건은 존재하지만 editor에 HTML 입력건이 존재하지 않는경우 프로퍼티 수집건을 제거 처리.
                            //(HTML UI의 content 프로퍼티의 경우 미리보기 성격의 값이기 때문에, editor에 입력한 값이 없는경우 수집건을 제거 처리함.)
                            if (param.APPDATA.T_CEVT.findIndex(a => a.OBJTY === "HM" && a.OBJID === _s0015.OBJID + _s0015.UIASN) === -1) {
                                param.APPDATA.T_0015.splice(_indx, 1);
                            }

                        }
                        //20250107 PES -END.

                    }


                    /**
                     * @since   2025-12-31 03:44:32
                     * @version v3.5.7-4
                     * @author  PES
                     * @description
                     * 이전에 단축키 정보 등록건이 존재하는경우,
                     * 단축키등록된 JSON string 정보를 parse 하여 object화 로직 추가.
                     */
                    for (let _s0015 of param.APPDATA.T_0015) {
                        //이전 단축키 구성건이 존재하는경우.
                        if (typeof _s0015.SHCUT === "string" && _s0015.SHCUT !== "") {
                            //단축키 구성건 OBJECT화.
                            _s0015.SHCUT = JSON.parse(_s0015.SHCUT);

                            console.log("Shortcut Old Data Parsed Object:", _s0015.SHCUT);

                        }
                    }


                    oAPP.DATA = oAPP.DATA || {};
                    oAPP.DATA.APPDATA = param.APPDATA;

                    //application ui design, attribute 정보 매핑.
                    oAPP.attr.oModel.oData.TREE = oAPP.DATA.APPDATA.T_0014;

                    var l_edit = true;


                    //edit 불가능 상태인경우.
                    if (oAPP.attr.appInfo.IS_EDIT === "") {
                        l_edit = false;
                    }

                    //edit 가능여부 매핑.
                    oAPP.attr.oModel.oData.IS_EDIT = l_edit;

                    //tree 바인딩 정보 구성. (평면 T_0014 → 중첩 /zTREE)
                    oAPP.fn.setTreeJson(oAPP.attr.oModel, "TREE", "OBJID", "POBID", "zTREE");

                    // ================================================================
                    //  ↑↑↑ 원본 가공/변환 로직 끝 ↑↑↑
                    // ================================================================

                    // 변환된 /zTREE 루트 노드(ROOT = [0]) 얻기.
                    var oRoot = (oAPP.attr.oModel.oData.zTREE && oAPP.attr.oModel.oData.zTREE[0]) || null;

                    //tree drag & drop 처리 활성여부 처리. (원본 544행)
                    _safeDecorate("setTreeDnDEnable", oRoot);

                    //UI design tree영역 체크박스 활성여부 처리. (원본 547행)
                    _safeDecorate("setTreeChkBoxEnable", oRoot);

                    //UI design tree 영역 UI에 따른 ICON 세팅. (원본 550행, LIB.T_0022 의존 → 가드)
                    _safeDecorate("setTreeUiIcon", oRoot);

                    // [아이콘 보강] UI별 이미지 아이콘 — 원본 setTreeUiIcon 의 UICON 로직 이식.
                    //   uiDesignArea.js(UI5) 미로드 환경에서도 각 노드에 UICON/icon_visible 세팅
                    //   (T_0022.UICON → fnGetSapIconPath(...icons/x.gif)). 트리 렌더가 이 값을 표시.
                    try {
                        var _aT0022 = (oAPP.DATA.LIB && Array.isArray(oAPP.DATA.LIB.T_0022)) ? oAPP.DATA.LIB.T_0022 : [];
                        (function _ws20SetIc(aN) {
                            if (!Array.isArray(aN)) { return; }
                            for (var _i = 0; _i < aN.length; _i++) {
                                var _n = aN[_i];
                                if (!_n) { continue; }
                                if ((typeof _n.UICON === "undefined" || _n.UICON === "") && typeof oAPP.fn.fnGetSapIconPath === "function") {
                                    var _ls = _aT0022.find(function (a) { return a.UIOBK === _n.UIOBK; });
                                    if (_ls && _ls.UICON) { _n.UICON = oAPP.fn.fnGetSapIconPath(_ls.UICON); }
                                }
                                _n.icon_visible = !!(_n.UICON && _n.UICON !== "");
                                if (Array.isArray(_n.zTREE)) { _ws20SetIc(_n.zTREE); }
                            }
                        })(oAPP.attr.oModel.oData.zTREE);
                    } catch (e) { console.warn("[HTML5][WS20][data] tree icon set:", e && e.message); }

                    //UI design tree 영역의 action icon 활성여부 처리. (원본 553행)
                    _safeDecorate("designSetActionIcon", oRoot);

                    //design tree의 row action 활성여부 설정. (원본 556행 — 문서 5장 9단계.
                    // 원본 함수(uiDesignArea.js)는 UI5 의존이라 미로드시 skip)
                    _safeDecorate("designTreeSetRowAction", oRoot);

                    //ui attribute 변경 항목 필터 초기화. (원본 530~537행 changedDataFilter —
                    // 문서 5장 7단계. HTML5: 필터 상태/버튼 표시만 초기화)
                    try {
                        var _sFilt = oAPP.attr.oModel.oData.sAttrFilt;
                        if (_sFilt) { _sFilt.press = false; }
                        var _oFiltBtn = document.getElementById("ws20AttrShowChangedBtn");
                        if (_oFiltBtn) {
                            _oFiltBtn.classList.remove("pressed");
                            if (_sFilt && _sFilt.text) { _oFiltBtn.textContent = _sFilt.text; }
                        }
                    } catch (e) { }

                    //ui design tree 전체 접힘 후 2레벨까지 펼침. (원본 566~570행
                    // collapseAll + expandToLevel(2) — 문서 5장 10단계)
                    try {
                        if (typeof oAPP.fn.fnWs20TreeExpandToLevel === "function") {
                            oAPP.fn.fnWs20TreeExpandToLevel(2);
                        }
                    } catch (e) { }

                    //design tree 선택 처리 해제. (원본 574행 clearSelection — 문서 5장 11단계)
                    oAPP.attr.ws20SelectedObjid = null;

                    //attribute 선택 처리 해제. (원본 578행 oRTab1.removeSelections — 문서 5장 12단계)
                    try {
                        if (oAPP.attr.ui && oAPP.attr.ui.oRTab1 &&
                            typeof oAPP.attr.ui.oRTab1.removeSelections === "function") {
                            oAPP.attr.ui.oRTab1.removeSelections();
                        }
                    } catch (e) { }

                    //design 영역 invalidate 처리. (원본 582행 — 문서 5장 13단계.
                    // HTML5: 모델 refresh 훅(W3)이 fnRenderDesignTree 재렌더 수행)
                    try {
                        oAPP.attr.oModel.refresh();
                    } catch (e) {
                        // 모델 refresh 가 없거나 훅이 미연결인 경우 직접 렌더.
                        try { oAPP.fn.fnRenderDesignTree(); } catch (e2) { }
                    }

                    //미리보기 화면 구성. (원본 588행 loadPreviewFrame — 문서 5장 14단계:
                    // 반드시 "이 시점"에 호출. W2(ws_html5_ws20_prev.js)의 래퍼 경유)
                    try {
                        if (typeof oAPP.fn.fnWs20LoadPreview === "function") {
                            oAPP.fn.fnWs20LoadPreview();
                        }
                    } catch (e) {
                        console.warn("[HTML5][WS20][data] 미리보기 로드 호출 오류:", e && e.message);
                    }

                    //세션 랜덤키 얻기. (원본 592행 — 미리보기 DnD 가 참조)
                    try {
                        oAPP.attr.DnDRandKey = parent.getSSID();
                    } catch (e) { }

                } catch (e) {
                    console.warn("[HTML5][WS20][data] getAppData 처리 오류:", e && e.message);
                } finally {
                    // 완료 시 busy lock 해제 — 단, 가운데 미리보기(iframe)가 busy 를 인수
                    // (부팅 중: __ws20PrevBooting)했으면 끄지 않는다. 미리보기 성공/실패/watchdog
                    // 시점에 _ws20ReleasePrevBusy 가 최종 해제(사용자 요구: 미리보기까지 로드 성공 시 해제).
                    if (!oAPP.attr.__ws20PrevBooting) {
                        try { oAPP.common.fnSetBusyLock(""); } catch (e) { }
                    }
                }

            }, "X", true, "GET", function (e) {
                // 오류 발생 시(서버 미연결 등) busy 해제 + 빈 트리 유지.
                console.warn("[HTML5][WS20][data] getAppData 서버 호출 실패 — 빈 트리 유지.");
                try { oAPP.common.fnSetBusyLock(""); } catch (e2) { }
            });
        } catch (e) {
            // sendAjax 자체가 throw(헤드리스 환경 등) → busy 해제 + 빈 트리 유지.
            console.warn("[HTML5][WS20][data] sendAjax 호출 실패 — 빈 트리 유지:", e && e.message);
            try { oAPP.common.fnSetBusyLock(""); } catch (e2) { }
        }

    }; // end of oAPP.fn.fnLoadWs20TreeData

    /************************************************************************
     * [PUBLIC] UI 영역 편집여부 설정 — 원본 design/js/main.js setUIAreaEditable
     *   (743~868행) 의 1:1 의미 이식. (문서 4장 "조회/편집 화면 진입 흐름")
     *
     *   WS20 진입(fnMoveToWs20 / fnOnMoveToPage("WS20"))과 Display/Change 전환
     *   (fnSetAppDisplayMode / fnSetAppChangeMode)의 공통 시작점이다.
     *
     *   분기(문서 4.1 / 4.2 / 4.3):
     *    (4.1) IS_EDIT="" · IS_CHAG="" · APPDATA 존재 · isRefresh!=="X"
     *          → 서버 재조회 없이 Display 전환(트리 DnD/Chk/ActionIcon 재계산
     *            + 모델 refresh + busy 해제)
     *    (4.2) LIB 존재 → undo/redo 초기화 → getAppData(fnLoadWs20TreeData)
     *    (4.3) LIB 없음 → LIB 6테이블 조회(fnLoadWs20LibData: 내부에서 LIBNM
     *          매핑 + S_CODE 재구성 + UA035) → getAppData
     *
     *   UI5 의존부 대체(원본 라인 주석으로 명시):
     *    · setTreeDnDEnable/ChkBox/ActionIcon/RowAction → _safeDecorate (데이터 함수)
     *    · frame.contentWindow.removeDropConfig → frame/_loaded 가드 후 호출
     *    · prevStyleClassApply → uiPreviewArea.js 지연 로드 후에만 존재 — 가드
     *    · designRefershModel → oModel.refresh() (W3 훅이 트리 재렌더)
     ************************************************************************/
    oAPP.fn.setUIAreaEditable = function (isRefresh) {

        //APPLICATION의 세부 정보 광역화. (원본 746행)
        try {
            oAPP.attr.appInfo = parent.getAppInfo() || {};
        } catch (e) {
            oAPP.attr.appInfo = oAPP.attr.appInfo || {};
        }

        //20번 페이지에 보여질 APPID. (원본 fnMoveToWs20 641행)
        if (oAPP.attr.appInfo && oAPP.attr.appInfo.APPID) {
            oAPP.attr.APPID = oAPP.attr.appInfo.APPID;
        }

        oAPP.DATA = oAPP.DATA || {};

        //(4.1) 어플리케이션 정보가 출력된 상태에서 변경된 내용 없이 display로 전환된경우
        //(변경건 없이 EDIT -> DISP 로 전환되는경우 — 서버 재조회 없음. 원본 755~811행)
        if (oAPP.attr.appInfo.IS_EDIT === "" &&
            oAPP.attr.appInfo.IS_CHAG === "" &&
            typeof oAPP.DATA.APPDATA !== "undefined" &&
            isRefresh !== "X") {

            //display flag 설정. (원본 761행)
            oAPP.attr.oModel.oData.IS_EDIT = false;

            //undo, redo 이력 초기화 + 버튼 활성 여부 처리. (원본 764~767행 — node 모듈)
            try {
                var _oUndoRedo = parent.require(oAPP.oDesign.pathInfo.undoRedo);
                _oUndoRedo.clearHistory();
                _oUndoRedo.setUndoRedoButtonEnable();
            } catch (e) {
                console.warn("[HTML5][WS20][data] undo/redo 초기화 skip:", e && e.message);
            }

            var _oRoot = (oAPP.attr.oModel.oData.zTREE && oAPP.attr.oModel.oData.zTREE[0]) || null;

            //UI design tree영역 drag & drop 처리. (원본 770행)
            _safeDecorate("setTreeDnDEnable", _oRoot);

            //UI design tree영역 체크박스 활성여부 처리. (원본 773행)
            _safeDecorate("setTreeChkBoxEnable", _oRoot);

            //UI design tree 영역의 action icon 활성여부 처리. (원본 776행)
            _safeDecorate("designSetActionIcon", _oRoot);

            //미리보기 UI의 drop 제거 처리. (원본 779행 — frame 미로드시 skip)
            try {
                var _oWin = (oAPP.attr.ui && oAPP.attr.ui.frame && oAPP.attr.ui.frame.contentWindow) || null;
                if (_oWin && _oWin._loaded === true && typeof _oWin.removeDropConfig === "function") {
                    _oWin.removeDropConfig();
                }
            } catch (e) { }

            //css 미리보기 적용건 해제 처리. (원본 782행 — uiPreviewArea.js 지연 로드 전 skip)
            try {
                if (typeof oAPP.fn.prevStyleClassApply === "function") {
                    oAPP.fn.prevStyleClassApply([]);
                }
            } catch (e) { }

            //attribute 초기화버튼 비활성처리. (원본 785행)
            try {
                if (oAPP.attr.oModel.oData.uiinfo) {
                    oAPP.attr.oModel.oData.uiinfo.vis02 = false;
                }
            } catch (e) { }

            //design tree의 row action 활성여부 설정. (원본 788행 — UI5 미로드시 skip)
            _safeDecorate("designTreeSetRowAction", _oRoot);

            //attribute 라인 편집 비활성 처리. (원본 791~793행)
            try {
                var _aAttr = oAPP.attr.oModel.oData.T_ATTR || [];
                for (var _i = 0; _i < _aAttr.length; _i++) {
                    _aAttr[_i].edit = false;
                }
            } catch (e) { }

            //디자인 영역 모델 갱신(트리 재렌더 훅) 후 wait off 처리. (원본 802~807행)
            try { oAPP.attr.oModel.refresh(); } catch (e) { }
            try {
                if (typeof oAPP.fn.fnRenderWs20AttrPanel === "function") {
                    oAPP.fn.fnRenderWs20AttrPanel();
                }
            } catch (e) { }
            try { parent.setBusy(""); } catch (e) { }

            return;

        } //어플리케이션 정보가 출력된 상태에서 변경된 내용 없이 display로 전환된경우

        //(4.2) 라이브러리 정보가 로드된 경우. (원본 814~830행)
        //  [버그수정] 단순히 oAPP.DATA.LIB 에 키가 있는지(빈/부분 객체도 true)가 아니라,
        //  DDLB/속성이 실제로 소비하는 코드마스터(T_9011)·UI클래스(T_0022)가 채워졌는지로 판정.
        //  미충족이면 (4.3) 으로 떨어져 fnLoadWs20LibData 가 T_9011→S_CODE 를 로드 → 드롭다운 채워짐.
        var _bLibLoaded = false;
        try {
            var _oLib = oAPP.DATA.LIB;
            _bLibLoaded = !!(_oLib
                && Array.isArray(_oLib.T_9011) && _oLib.T_9011.length > 0
                && Array.isArray(_oLib.T_0022) && _oLib.T_0022.length > 0);
        } catch (e) { }

        if (_bLibLoaded) {

            //undo, redo 이력 초기화 + 버튼 활성 여부 처리. (원본 817~820행)
            try {
                var _oUndoRedo2 = parent.require(oAPP.oDesign.pathInfo.undoRedo);
                _oUndoRedo2.clearHistory();
                _oUndoRedo2.setUndoRedoButtonEnable();
            } catch (e) {
                console.warn("[HTML5][WS20][data] undo/redo 초기화 skip:", e && e.message);
            }

            //design 레이아웃 순서 설정. (원본 823행 setDesignLayout — UI5 splitter 의존,
            // HTML5 셸은 고정 3분할이라 원본 함수 존재시에만 호출)
            try {
                if (typeof oAPP.fn.setDesignLayout === "function") {
                    oAPP.fn.setDesignLayout();
                }
            } catch (e) { }

            //어플리케이션 정보 구성을 위한 서버 호출. (원본 826행 getAppData)
            oAPP.fn.fnLoadWs20TreeData();

            return;

        }

        //(4.3) 라이브러리 정보가 없는경우 — LIB 6테이블 조회 → S_CODE 재구성 → getAppData.
        //(원본 833~867행. fnLoadWs20LibData(W4) 내부에서 LIBNM 매핑/setCodeMasterData/
        // setCodeMasterDataUA035 까지 수행 후 콜백 호출 — 원본 getLibData 692~709행과 동일)
        if (typeof oAPP.fn.fnLoadWs20LibData === "function") {
            oAPP.fn.fnLoadWs20LibData(function () {
                oAPP.fn.fnLoadWs20TreeData();
            });
            return;
        }

        //LIB 로더 미존재(이론상 없음) — 트리 로드만 진행.
        console.warn("[HTML5][WS20][data] fnLoadWs20LibData 미존재 — LIB 없이 트리 로드.");
        oAPP.fn.fnLoadWs20TreeData();

    }; // end of oAPP.fn.setUIAreaEditable

})(window, (window.jQuery || window.$), oAPP);
