/************************************************************************
 * dataMonitor/Popup/js/index.js — 내부 데이터 모니터 별창 화면
 * ----------------------------------------------------------------------
 *  부모 창이 보내온 "바뀐 것 묶음"을 받아 화면에 쌓고,
 *  감시 시작·중지·지금 비교·범위 바꾸기를 부모 창에 알린다.
 *
 *  주고받는 길: BroadcastChannel "u4a-datamon_<브라우저키>" 하나로 양방향
 *      (기존 별창들이 쓰는 방식과 동일 — Popups/bindPopup/frame.js:431 참고)
 *
 *  ★ 사진 자체는 안 받는다. 부모가 비교까지 마치고 "달라진 자리"만 보낸다.
 *    (사진은 48만자라 창끼리 넘기면 무겁다 — 2026-09-09 실측)
 *
 *  오류코드 접두: DMWN / 다음 번호: 017
 *    (001 = 첫 페인트 테마 적용 실패, index.html 인라인에서 사용)
 ************************************************************************/

(function () {
    "use strict";

    /* ==================================================================
     * 1. Electron / 창 컨텍스트
     * ================================================================== */
    var REMOTE = require("@electron/remote"),
        PATH = REMOTE.require("path"),
        APP = REMOTE.app,
        APPPATH = APP.getAppPath(),
        CURRWIN = REMOTE.getCurrentWindow();

    var oQuery = new URLSearchParams(location.search);
    var BROWSKEY = oQuery.get("browserkey") || "";
    var CH_NAME = "u4a-datamon_" + BROWSKEY;

    //화면에 쌓아 둘 줄 최대 개수. 넘으면 오래된 것부터 지운다(창이 무거워지지 않게).
    var C_MAX_ROW = 2000;


    var _sView = "list";        //지금 보고 있는 뷰("list" | "tree")
    var _oSnap = null;          //트리 뷰가 그릴 스냅샷(부모가 보낸 것)
    var _oChgMap = {};          //바뀐 자리 목록 { 경로: {종류,이전,새값,시각} }
    var _oChgParent = {};       //바뀐 자리의 윗 경로들 { 경로: {바뀜:n, 생김:n} } — 종류별로 길을 열어 두려고
    var _oTree = null;          //공통 컴럼 트리 손잡이
    var _oTreeCfg = null;       //공통 컴럼 트리에 넘긴 설정(안내 문구를 나중에 바꾸려고 들고 있는다)
    var _iSnapTimer = 0;        //바뀐 것이 연달아 올 때 데이터 다시 받기를 잠깐 모아 두는 손잡이
    var _sTreeKind = "";        //트리 뷰 종류 걸러내기 ("" 전체 / "변경" / "추가") — 리스트 뷰와 같은 목록
    var _sTreeSearch = "";      //트리 뷰 — 이름 찾기(값은 안 본다)
    var _oExpand = {};          //트리 뷰 펼침 상태 { 경로: true/false }
    var _oClosedOnce = {};      //한 번이라도 접은 적 있는 자리 { 경로: true } — 그 아래는 저절로 펼치지 않는다
    var _sKindFilter = "";   //종류 걸러내기에서 고른 값("" 이면 전체)
    var _sJumpPath = "";        //리스트 뷰에서 path 를 눌러 트리 뷰로 갈 자리(데이터가 오면 그때 간다)
    var _oTreeKindSel = null;   //트리 뷰 종류 고르기 — 점프할 때 되돌리려고 들고 있는다
    var _oChannel = null;
    var _bOn = false;
    var _iCount = 0;

    /* ── 3.0 ↔ 4.0 비교 뷰 (2026-09-11) ──────────────────────────────
     *  설계 = .works/데이터모니터/01_버전간_데이터비교_설계.md
     *  1단계 = 좌 3.0 / 우 4.0 을 같은 모양으로 놓고 보기 + 다른 것만 걸러 보기.
     */
    var C_PORT = 9999;          //3.0 이 보내 올 자리(장군님 지정 2026-09-11)
    var _oSrv = null;           //열어 둔 자리 손잡이(창 닫을 때 닫는다)
    var _oCmpLeft = null;       //3.0 이 보낸 데이터 구조
    var _sCmpLeftTime = "";     //3.0 것이 들어온 시각
    var _oCmpRight = null;      //4.0 이 지금 들고 있는 데이터 구조
    var _sCmpRightTime = "";    //4.0 것을 담은 시각
    var _oCmpDiff = {};         //양쪽이 어긋난 자리 { path: "다름" | "3.0만" | "4.0만" }
    var _iCmpDiffN = 0;         //어긋난 자리 개수(세면서 상한을 본다)
    var _aCmpDiffTop = [];      //어긋난 자리 중 **꼭대기만** 모은 목록(이동용). 자손까지 넣으면 하나씩 못 넘긴다
    var _iCmpAt = -1;           //그 목록에서 지금 몇 번째에 서 있나
    var _oCmpKindN = { "다름": 0, "3.0만": 0, "4.0만": 0 };   //종류별 개수
    var _bCmpCut = false;       //너무 많아 도중에 끊었나
    var _oCmpDiffUp = {};       //어긋난 자리로 가는 윗자리들 { path: true }
    var _bCmpDiffOnly = false;  //다른 것만 보기
    var _sCmpFindL = "";        //좌(3.0) 찾는 글자
    var _sCmpFindR = "";        //우(4.0) 찾는 글자

    //찾기 결과를 **미리 한 번만** 만들어 둔다(장군님 지적 2026-09-11).
    //  전에는 줄을 그릴 때마다 그 아래를 재귀로 훑었다. 그게 느려서 깊이를 6 으로 막아 뒀는데,
    //  그러면 더 깊은 자리는 아예 못 찾는다 — 모니터링 도구에서 있을 수 없는 제약이다.
    //  한 번만 전체를 훑어 표로 만들어 두면 **깊이 제한이 필요 없고** 그릴 때는 표만 보면 된다.
    var _oFindHitL = {}, _oFindUpL = {}, _iFindNL = 0;   //좌 — 걸린 자리 / 가는 길 / 걸린 개수
    var _oFindHitR = {}, _oFindUpR = {}, _iFindNR = 0;   //우
    //★ 펼침 상태는 **좌우가 따로** 간다(장군님 지적 2026-09-11).
    //  처음에 하나로 묶어 좌우가 같이 펼쳐지게 만들었는데, 시키지 않은 동작이었고
    //  애초에 좌우는 줄 순서도 개수도 달라 맞춰 봐야 소용이 없다. 한쪽을 펴면 그쪽만 펴진다.
    var _oCmpExpandL = {};      //좌(3.0) 펼침 상태
    var _oCmpExpandR = {};      //우(4.0) 펼침 상태
    var _oCmpClosedL = {};      //좌 - 한 번이라도 접은 적 있는 자리(그 아래는 저절로 안 펼친다)
    var _oCmpClosedR = {};      //우 - 위와 같음
    var _oTreeL = null;         //좌 트리 손잡이
    var _oTreeR = null;         //우 트리 손잡이
    var _bCmpWantRight = false; //부모에게 4.0 것을 달라고 해 둔 상태인가


    /* ==================================================================
     * 2. 화면 요소
     * ================================================================== */
    function $(sId) { return document.getElementById(sId); }

    var EL = {};

    function _cacheEl() {
        EL.list = $("dmList");
        EL.rows = $("dmRows");
        EL.filters = document.querySelectorAll(".u4aDmFilter");
        EL.tableWrap = $("dmTableWrap");
        EL.treeHost = $("dmTreeHost");
        EL.treeOnly = $("dmTreeOnly");
        EL.btnList = $("dmBtnList");
        EL.btnTree = $("dmBtnTree");
        EL.treeSearch = $("dmTreeSearch");
        EL.empty = $("dmEmpty");
        EL.state = $("dmState");
        EL.btnToggle = $("dmBtnToggle");
        EL.btnToggleText = $("dmBtnToggleText");
        EL.btnNow = $("dmBtnNow");
        EL.btnClear = $("dmBtnClear");
        EL.watchOnly = $("dmWatchOnly");
        EL.scopeOnly = $("dmScopeOnly");
        EL.chkCode = $("dmChkCode");
        EL.chkLib = $("dmChkLib");
        EL.busy = $("dmBusy");

        //비교 뷰
        EL.btnCmp = $("dmBtnCmp");
        EL.cmpOnly = $("dmCmpOnly");
        EL.cmp = $("dmCmp");
        EL.cmpBar = $("dmCmpBar");
        EL.cmpLeftHost = $("dmCmpLeftHost");
        EL.cmpRightHost = $("dmCmpRightHost");
        EL.cmpLeftInfo = $("dmCmpLeftInfo");
        EL.cmpRightInfo = $("dmCmpRightInfo");
        EL.cmpInfo = $("dmCmpInfo");
        EL.btnCmpTake = $("dmBtnCmpTake");
        EL.chkDiffOnly = $("dmChkDiffOnly");
        EL.btnDiffPrev = $("dmBtnDiffPrev");
        EL.btnDiffNext = $("dmBtnDiffNext");
        EL.cmpAt = $("dmCmpAt");
        EL.btnCollapseAll = $("dmBtnCollapseAll");
        EL.cmpLeftSearch = $("dmCmpLeftSearch");
        EL.cmpRightSearch = $("dmCmpRightSearch");
    }


    /* ==================================================================
     * 3. 로딩 표시 (공통 top-layer)
     * ================================================================== */
    function _setBusy(bOn) {
        try {
            if (!EL.busy) { return; }
            if (bOn) { if (!EL.busy.open) { EL.busy.showModal(); } }
            else { if (EL.busy.open) { EL.busy.close(); } }
        } catch (e) {
            console.error("[DMWN-002] loading state switch failed:", e);
        }
    }


    /* ==================================================================
     * 4. 부모 창에 알리기 / 받기
     * ================================================================== */
    function _send(oMsg) {
        if (!_oChannel) {
            console.error("[DMWN-003] not connected to the parent window - cannot send signal:", oMsg && oMsg.PRCCD);
            return;
        }
        try { _oChannel.postMessage(oMsg); }
        catch (e) { console.error("[DMWN-003] send signal to parent window failed:", e); }
    }

    function _openChannel() {

        try {
            _oChannel = new BroadcastChannel(CH_NAME);
        } catch (e) {
            //부모와 못 이어지면 이 창은 아무것도 못 한다 — 조용히 두지 않고 드러낸다.
            console.error("[DMWN-003] could not open the channel to the parent window:", e);
            _oChannel = null;
            return;
        }

        _oChannel.onmessage = function (ev) {

            var oData = ev && ev.data;
            if (!oData || !oData.PRCCD) { return; }

            switch (oData.PRCCD) {

                case "DMON_BATCH":
                    //바뀐 것 묶음 한 건 도착.
                    _addBatch(oData.BATCH);
                    break;

                case "DMON_SNAPDATA":

                    //비교 뷰에서 [4.0 지금 담기] 로 부른 것 — "지금 이 순간"을 새로 뜬 것이다.
                    //  ★ 트리 뷰가 그릴 데이터(_oSnap)는 건드리지 않는다. 시점이 다르기 때문이다.
                    if (oData.NOW === true) {
                        _bCmpWantRight = false;
                        _oCmpRight = oData.SNAP || {};
                        _sCmpRightTime = _cmpNow();

                        //★ 새로 담았으면 펼침 기록을 비운다(좌측과 같은 이유).
                        _oCmpExpandR = {};
                        _oCmpClosedR = {};
                        _cmpRefresh();
                        break;
                    }

                    //트리 뷰가 그릴 데이터 도착(마지막으로 비교할 때 뜬 것 = 변경 목록과 같은 시점).
                    _oSnap = oData.SNAP || {};
                    _renderTree();
                    _runJump();          //리스트 뷰에서 path 를 눌러 온 것이면 그 자리로 간다
                    break;

                case "DMON_STATE":
                    //부모가 알려주는 지금 상태(켜짐 여부).
                    _setState(oData.ON === true);
                    break;

                default:
                    break;
            }
        };
    }


    /* ==================================================================
     * 5. 화면 그리기
     * ================================================================== */

    function _setState(bOn) {

        _bOn = bOn;

        if (EL.state) {
            EL.state.textContent = bOn ? "감시 켜짐" : "감시 꺼짐";
            EL.state.classList.toggle("u4aDmState--on", bOn);
        }

        if (EL.btnToggleText) { EL.btnToggleText.textContent = bOn ? "감시 중지" : "감시 시작"; }

        if (EL.btnToggle) {
            var oIcon = EL.btnToggle.querySelector("i");
            if (oIcon) { oIcon.className = bOn ? "fa-solid fa-stop" : "fa-solid fa-play"; }
            EL.btnToggle.classList.toggle("u4a-btn--negative", bOn);
            EL.btnToggle.classList.toggle("u4a-btn--emphasized", !bOn);
        }
    }

    /**
     * 종류에 맞는 표시 만들기.
     */
    function _kindTag(sKind) {

        var oSpan = document.createElement("span");
        oSpan.className = "u4aDmKind " +
            (sKind === "추가" ? "u4aDmKind--add" : (sKind === "삭제" ? "u4aDmKind--del" : "u4aDmKind--chg"));
        oSpan.textContent = sKind;
        return oSpan;
    }

    /**
     * 바뀐 자리들을 표 맨 위에 줄로 넣는다.
     *   ★ 곁가지(시각·조작·걸린시간·접었다 펴기) 없이 바뀐 것만 (장군님 지시 2026-09-10).
     */
    function _addBatch(oBatch) {

        if (!oBatch || !oBatch.변경 || !EL.rows) { return; }

        //★ 없어진 자리는 화면에 안 띄운다(장군님 결정 2026-09-10).
        //  지워지면 그 줄이 사라지는 것으로 충분하다 — 리스트 뷰·트리 뷰 둘 다 같게 한다.
        //  단, 받아 둔 덩어리에는 그대로 반영해야 트리가 어긋나지 않으므로 아래 덮어쓰기에는 그대로 넘긴다.
        var aShow = [];
        for (var s = 0; s < oBatch.변경.length; s++) {
            if (oBatch.변경[s].종류 !== "삭제") { aShow.push(oBatch.변경[s]); }
        }

        //트리 뷰가 쓸 "바뀐 자리" 기록. 경로와 그 부모 경로들을 함께 남긴다.
        for (var m = 0; m < aShow.length; m++) {
            var oC = aShow[m];
            if (!oC.자리) { continue; }
            _oChgMap[oC.자리] = { 종류: oC.종류, 이전: oC.이전, 새값: oC.새값, 시각: oBatch.시각 };
            //윗 경로들 — 종류를 골라 봤을 때 그 종류로 가는 길만 열려야 한다.
            var sP = oC.자리;
            while (true) {
                var iDot = sP.lastIndexOf(".");
                var iBrk = sP.lastIndexOf("[");
                var iCut = Math.max(iDot, iBrk);
                if (iCut <= 0) { break; }
                sP = sP.slice(0, iCut);
                if (!_oChgParent[sP]) { _oChgParent[sP] = {}; }
                _oChgParent[sP][oC.종류] = (_oChgParent[sP][oC.종류] || 0) + 1;
            }
        }

        //띄울 것이 하나도 없으면(지운 것만 온 묶음) 화면은 그대로 두고 덮어쓰기만 한다.
        if (!aShow.length && oBatch.잘림 !== true) {
            _syncSnap(oBatch);
            return;
        }

        if (EL.empty) { EL.empty.hidden = true; }
        //★ 리스트 뷰일 때만 표를 보인다(장군님 지적 2026-09-11).
        //  뷰가 둘(리스트·트리)뿐이던 때 "트리가 아니면 보인다"로 적어 둔 것이 남아 있어,
        //  비교 뷰를 보고 있는데도 변경이 들어올 때마다 표가 도로 나왔다.
        if (EL.tableWrap) { EL.tableWrap.hidden = (_sView !== "list"); }

        //위에 넣을 것을 한 덩어리로 만들어 한 번에 붙인다(화면 그리기 부담 줄이기).
        var oFrag = document.createDocumentFragment();

        for (var i = 0; i < aShow.length; i++) {

            var oChg = aShow[i];
            var oTr = document.createElement("tr");

            //시각 — 언제 바뀜 것인지 한눈에 보이게 맨 앞에 둔다(장군님 지시 2026-09-10).
            var tdT = document.createElement("td");
            tdT.className = "u4aDmCell--time";
            tdT.textContent = oBatch.시각 || "";
            oTr.appendChild(tdT);

            var tdK = document.createElement("td");
            tdK.appendChild(_kindTag(oChg.종류 || "변경"));
            oTr.appendChild(tdK);

            var tdP = document.createElement("td");
            //누르면 트리 뷰의 그 자리로 간다(장군님 지시 2026-09-10).
            //  줄마다 처리기를 달지 않고 표 본문에 하나만 달아 둔다(줄이 2000개까지 쌓인다).
            tdP.className = "u4aDmCell--path u4aDmPathJump";
            tdP.setAttribute("data-jump", oChg.자리 || "");
            tdP.textContent = oChg.자리 || "";
            oTr.appendChild(tdP);

            var tdO = document.createElement("td");
            tdO.className = "u4aDmCell--old";
            tdO.textContent = (oChg.이전 == null ? "" : String(oChg.이전));
            oTr.appendChild(tdO);

            var tdN = document.createElement("td");
            tdN.className = "u4aDmCell--new";
            tdN.textContent = (oChg.새값 == null ? "" : String(oChg.새값));
            oTr.appendChild(tdN);

            oFrag.appendChild(oTr);
            _iCount++;
        }

        //바뀐 곳이 너무 많아 잘린 경우 그 사실을 한 줄로 알린다.
        if (oBatch.잘림 === true) {
            var oTrCut = document.createElement("tr");
            var tdCut = document.createElement("td");
            tdCut.colSpan = 5;
            tdCut.className = "u4aDmCut";
            tdCut.textContent = "바뀐 곳이 너무 많아 일부만 보여줍니다.";
            oTrCut.appendChild(tdCut);
            oFrag.appendChild(oTrCut);
            _iCount++;
        }

        //넣기 전에 걸러내기를 새 줄에도 적용한다(걸러내기 켜둔 채 쌓여도 맞게 보이게).
        var aWords = _filterWords();
        if (aWords.length) {
            var aNew = oFrag.children;
            for (var j = 0; j < aNew.length; j++) { _applyFilterToRow(aNew[j], aWords); }
        }

        //최근 것이 위로 오게 맨 앞에 넣는다.
        EL.rows.insertBefore(oFrag, EL.rows.firstChild);

        //너무 쌓이면 오래된 줄(아래쪽)부터 지운다.
        while (_iCount > C_MAX_ROW && EL.rows.lastElementChild) {
            EL.rows.removeChild(EL.rows.lastElementChild);
            _iCount--;
        }

        _syncSnap(oBatch);
    }

    /**
     * 받아 둔 덩어리에 이번에 바뀐 자리만 덮어쓴다(덩어리를 다시 통째로 받지 않는다).
     *   ★ 여기에는 지운 자리도 그대로 넘긴다 — 화면에는 안 띄우지만 덩어리에서는 빼야 맞다.
     */
    function _syncSnap(oBatch) {

        if (_oSnap) {
            if (oBatch.잘림 === true) {
                //바뀐 곳이 너무 많아 부모가 목록을 잘랐다 — 덮어쓰면 빠진 자리가 생기므로 이때만 통째로 다시 받는다.
                console.warn("[DMWN-008] too many changes - the list was truncated; refetching the whole tree data.");
                _askSnapSoon();
            } else if (oBatch.실값없음 === true) {
                //부모가 값을 못 넘겼다(창끼리 넘길 수 없는 종류) — 덮어쓸 값이 없으니 통째로 다시 받는다.
                console.warn("[DMWN-008] no changed values received - refetching the whole tree data.");
                _askSnapSoon();
            } else if (!_patchSnap(oBatch.변경)) {
                //덮어쓸 자리를 못 찾았다(길이 어긋남) — 조용히 두면 트리가 틀린 값을 계속 보여준다.
                _askSnapSoon();
            } else if (_sView === "tree") {
                _renderTree();
            }
        }
    }

    /* ==================================================================
     * 5-0. 받아 둔 덩어리에 바뀐 자리만 덮어쓰기
     *   부모가 각 줄에 담아 보낸 [조각](자리를 칸 이름으로 쪼갠 것)과
     *   [실값](줄여 놓지 않은 진짜 값)으로 그 자리만 갈아 끼운다.
     *   덩어리 전체(48만자)를 다시 받지 않으려는 것이다.
     *   ★ 한 자리라도 길을 못 찾으면 false 를 돌려준다 — 부르는 쪽이 통째로 다시 받는다.
     * ================================================================== */
    function _patchSnap(aChg) {

        if (!aChg || !aChg.length) { return true; }

        var bOk = true;

        for (var i = 0; i < aChg.length; i++) {

            var oC = aChg[i];
            var aSeg = oC.조각;

            if (!aSeg || aSeg.length < 2) {
                console.error("[DMWN-008] no way to patch the changed node:", oC.자리);
                bOk = false;
                continue;
            }

            //마지막 칸의 바로 위까지 내려간다.
            var oCur = _oSnap;
            var bLost = false;
            for (var d = 0; d < aSeg.length - 1; d++) {
                if (oCur === null || typeof oCur !== "object" || !(aSeg[d] in oCur)) { bLost = true; break; }
                oCur = oCur[aSeg[d]];
            }

            if (bLost || oCur === null || typeof oCur !== "object") {
                console.error("[DMWN-008] could not find the node to patch:", oC.자리);
                bOk = false;
                continue;
            }

            var sLast = aSeg[aSeg.length - 1];

            if (oC.종류 === "삭제") {
                if (Array.isArray(oCur) && String(Number(sLast)) === String(sLast)) {
                    //목록에서 없어지는 것은 언제나 뒤쪽이다 — 줄 수를 그 자리까지 줄인다(가운데가 비지 않게).
                    var iCut = Number(sLast);
                    if (oCur.length > iCut) { oCur.length = iCut; }
                } else {
                    delete oCur[sLast];
                }
                continue;
            }

            oCur[sLast] = oC.실값;
        }

        return bOk;
    }

    /* ==================================================================
     * 5-1. 걸러내기 (열 제목 아래 칸)
     *   글자를 넣으면 그 글자가 든 줄만 남는다(대소문자 구분 없음).
     *   줄을 지우는 게 아니라 감추기만 한다 — 칸을 비우면 다시 보인다.
     * ================================================================== */

    //지금 걸러내기 칸에 적힌 값들(열 순서대로).
    function _filterWords() {
        var a = [];
        if (EL.filters) {
            for (var i = 0; i < EL.filters.length; i++) {
                var el = EL.filters[i];
                var iCol = parseInt(el.getAttribute("data-col"), 10);
                var s = (el.value || "").trim().toLowerCase();
                if (s) { a.push({ col: iCol, word: s }); }
            }
        }
        //종류는 공통 드롭다운에서 고른 값을 따로 들고 있다(둘째 칸).
        if (_sKindFilter) { a.push({ col: 1, word: _sKindFilter.toLowerCase() }); }
        return a;
    }

    //줄 하나가 걸러내기에 남는지 보고 감추거나 보인다.
    function _applyFilterToRow(oTr, aWords) {

        //잘렸다는 안내 줄(칸이 하나만 있는 줄)은 걸러내기 대상이 아니다.
        var aTd = oTr.children;
        if (aTd.length < 5) { return; }

        var bShow = true;
        for (var i = 0; i < aWords.length; i++) {
            var td = aTd[aWords[i].col];
            var sTxt = td ? (td.textContent || "").toLowerCase() : "";
            if (sTxt.indexOf(aWords[i].word) === -1) { bShow = false; break; }
        }
        oTr.hidden = !bShow;
    }

    //지금 쌓인 줄 전부에 다시 적용.
    function _applyFilterAll() {
        if (!EL.rows) { return; }
        var aWords = _filterWords();
        var aTr = EL.rows.children;
        for (var i = 0; i < aTr.length; i++) { _applyFilterToRow(aTr[i], aWords); }
    }

    function _clearList() {

        if (!EL.rows) { return; }

        EL.rows.textContent = "";
        _iCount = 0;
        _oChgMap = {};
        _oChgParent = {};

        if (EL.tableWrap) { EL.tableWrap.hidden = true; }
        //리스트 뷰가 아닐 때는 안내 문구를 띄우지 않는다(트리 뷰·비교 뷰는 자기 문구가 따로 있다).
        if (EL.empty) { EL.empty.hidden = (_sView !== "list"); }
        if (_sView === "tree") { _askSnap(); }
    }


    /* ==================================================================
     * 5-2. 트리 뷰
     *   공통 컬럼 트리(U4AUI.makeColumnTree)를 그대로 소비한다 — 가상 스크롤,
     *   컬럼 폭 조절, 머리줄 고정, 셀 선택·복사가 공통에서 자동으로 붙는다.
     *   컬럼 = [이름] [종류] [이전] [현재 값] [시각]
     * ================================================================== */

    //값을 화면에 보여줄 만큼만 줄인다(부모의 것과 같은 규칙).
    var C_TREE_VAL_LEN = 300;

    function _treeVal(v) {
        if (v === null) { return "null"; }
        if (v === undefined) { return ""; }
        var t = typeof v;
        var sOut;
        if (t === "string") { sOut = v; }
        else if (t !== "object") { sOut = String(v); }
        else {
            try { sOut = JSON.stringify(v); }
            catch (e) { sOut = Array.isArray(v) ? ("[" + v.length + "]") : ("{" + Object.keys(v).length + "}"); }
        }
        return (sOut.length > C_TREE_VAL_LEN) ? (sOut.slice(0, C_TREE_VAL_LEN) + "…") : sOut;
    }

    //자식이 있는(펼칠 수 있는) 값인가.
    function _hasKids(v) {
        return (v !== null && typeof v === "object" && Object.keys(v).length > 0);
    }

    //경로 잇기 — 목록이면 [0], 아니면 .이름 (부모의 비교 경로와 같은 모양이어야 짝이 맞는다)
    function _joinPath(sParent, sKey, bArray) {
        if (!sParent) { return sKey; }
        return sParent + (bArray ? ("[" + sKey + "]") : ("." + sKey));
    }

    //노드 하나 만들기.
    //  걸림   = 자기 이름에 찾는 글자가 있다
    //  아래   = 윗자리가 걸려서 딸려 나온 것
    //  lvl    = 뿌리에서부터 몇 번째인가(0 = 뿌리)
    //           ★ 공통 트리는 토글할 때 level 을 0 으로 넘긴다(theme/u4a-ui.js 의 가상 트리 토글).
    //             그 값을 그대로 믿으면 깊은 자리도 "펼쳐진 것"으로 답해 화살표가 반대로 먹는다.
    //             그래서 깊이를 노드에 직접 달아 둔다.
    function _mkNode(sKey, vValue, sPath, bHit, bUnder, iLvl) {
        return { key: sKey, val: vValue, path: sPath, 걸림: !!bHit, 아래: !!bUnder, lvl: iLvl || 0 };
    }

    //이름에 찾는 글자가 있나.
    function _nameHit(vKey) {
        return String(vKey).toLowerCase().indexOf(_sTreeSearch) !== -1;
    }

    //그 노드(또는 그 아래 어딘가)가 지금 걸러내기에 남는가.
    function _treeKeep(oNode) {

        //종류 걸러내기 — 자기가 그 종류로 바뀌었거나, 아래에 그런 게 있으면 남긴다.
        if (_sTreeKind) {

            var oSelf = _oChgMap[oNode.path];
            var bSelf = !!oSelf && (oSelf.종류 === _sTreeKind);

            var oUnder = _oChgParent[oNode.path];
            var bUnder = !!oUnder && !!oUnder[_sTreeKind];

            if (!bSelf && !bUnder) { return false; }
        }

        //찾기 — ★ 이름만 본다(장군님 지시 2026-09-10). 값은 안 본다.
        //  · 자기 이름이 걸렸으면 남긴다
        //  · 윗자리가 걸려서 딸려 나온 것도 남긴다 → 걸린 자리 아래는 통째로 다 보인다
        //  · 둘 다 아니면, 아래 어딘가에 걸리는 이름이 있을 때만 길을 열어 준다
        if (_sTreeSearch) {
            if (!oNode.걸림 && !oNode.아래 && !_searchDeep(oNode.val, 0)) { return false; }
        }

        return true;
    }

    //찾는 이름이 이 아래 어딘가에 있나(깊이 제한을 둔다).
    function _searchDeep(vVal, iDepth) {
        iDepth = iDepth || 0;
        if (iDepth > 6) { return false; }
        if (!_hasKids(vVal)) { return false; }
        var aKeys = Object.keys(vVal);
        for (var i = 0; i < aKeys.length; i++) {
            if (_nameHit(aKeys[i])) { return true; }
            if (_searchDeep(vVal[aKeys[i]], iDepth + 1)) { return true; }
        }
        return false;
    }

    //자식 노드 목록.
    function _treeKids(oNode) {
        if (!_hasKids(oNode.val)) { return []; }
        var bArr = Array.isArray(oNode.val);
        var aKeys = Object.keys(oNode.val);
        var aOut = [];
        //윗자리가 걸렸으면(또는 이미 딸려 나온 것이면) 그 아래는 전부 딸려 나온다.
        var bUnder = !!_sTreeSearch && (oNode.걸림 || oNode.아래);
        for (var i = 0; i < aKeys.length; i++) {
            var k = aKeys[i];
            var bHit = !!_sTreeSearch && _nameHit(k);
            var oKid = _mkNode(k, oNode.val[k], _joinPath(oNode.path, k, bArr), bHit, bUnder, (oNode.lvl || 0) + 1);
            if (_treeKeep(oKid)) { aOut.push(oKid); }
        }
        return aOut;
    }

    /**
     * 트리 펼침 상태를 바꾼다.
     *   ★ 접으면 그 아래도 다 접는다 — 공통 트리의 표준 동작(다시 펴도 자손은 접힌 상태).
     *     펼침 상태를 화면이 들고 있는 경우 공통이 이 처리를 화면에 맡긴다(theme/u4a-ui.js 의 가상 트리 토글 주석).
     *     안 해 두면 접었다 펴는 순간 아래가 통째로 다시 펼쳐진다(장군님 지적 2026-09-10).
     */
    /**
     * ★★ 접으면 그 아래도 같이 접힌다 — 이 화면의 트리는 **전부 이 함수를 쓴다**.
     *
     *   왜 화면 쪽에 있나:
     *     공통 트리의 표준은 "접기 = 자손까지 접힘" 이 맞다. 다만 펼침 상태를 바깥에서 들고 있는
     *     방식으로 쓰면 공통이 그 처리를 쓰는 쪽에 넘긴다(공통 소스 주석에 그렇게 적혀 있다).
     *     이 화면은 데이터가 커서 그 방식을 쓰므로 여기서 처리한다.
     *
     *   ★ 트리를 하나 더 만들 때는 **이 함수를 그대로 쓴다. 새로 짜지 말 것.**
     *     (장군님 지적 2026-09-11 — 비교 뷰에 안 넣어 같은 지적을 두 번 받았다.)
     *
     *   @param {object} oExpand      펼침 상태 { path: true/false }
     *   @param {object} oClosedOnce  한 번이라도 접은 적 있는 자리 { path: true }
     */
    function _setExpandIn(oExpand, oClosedOnce, oNode, bOpen) {

        var sPath = (oNode && typeof oNode === "object") ? oNode.path : oNode;
        if (!sPath) {
            console.error("[DMWN-009] ERROR TREE_TOGGLE path is empty - expand state not stored");
            return;
        }

        oExpand[sPath] = !!bOpen;

        if (bOpen) { return; }

        //① 이 자리를 한 번 접었다고 적어 둔다.
        //   자손 전부에 "접힘"을 적는 방법도 되지만 이 화면 데이터에서는 2만 자리를 넘어
        //   한 번 누를 때마다 그만큼 쓰게 된다(느린 PC 에서 그대로 멎는다).
        //   그래서 윗자리 하나만 적고, 볼 때 조상 쪽으로 몇 단계만 거슬러 보며 판단한다.
        oClosedOnce[sPath] = true;

        //② 이미 적어 둔 자리 중 이 아래인 것도 같이 닫는다.
        //   자리 이름이 "윗자리." 또는 "윗자리[" 로 시작하면 그 아래다.
        var aKeys = Object.keys(oExpand);
        for (var i = 0; i < aKeys.length; i++) {
            var sK = aKeys[i];
            if (sK.length <= sPath.length || sK.indexOf(sPath) !== 0) { continue; }
            var sNext = sK.charAt(sPath.length);
            if (sNext === "." || sNext === "[") { oExpand[sK] = false; }
        }
    }

    /**
     * 윗자리 중에 한 번이라도 접은 적이 있는 자리가 있나(공용).
     *   있으면 그 아래는 아직 안 적어 둔 자리라도 저절로 펼치지 않는다.
     */
    function _ancestorClosedIn(oClosedOnce, sPath) {

        var sP = sPath;

        while (true) {
            var iDot = sP.lastIndexOf(".");
            var iBrk = sP.lastIndexOf("[");
            var iCut = (iDot > iBrk) ? iDot : iBrk;
            if (iCut <= 0) { return false; }
            sP = sP.slice(0, iCut);
            if (oClosedOnce[sP] === true) { return true; }
        }
    }

    /**
     * 잘린 글자에 마우스를 올리면 다 보여준다(공용).
     *   공통 툴팁은 표의 칸만 자동으로 잡아 주므로 트리 칸은 여기서 붙인다.
     */
    function _tipCells(oRow) {
        var aCell = oRow.querySelectorAll(".u4aColTreeTrail .u4aColTreeCell");
        for (var c = 0; c < aCell.length; c++) {
            var sTxt = (aCell[c].textContent || "").trim();
            if (!sTxt) { continue; }
            aCell[c].setAttribute("data-tip", sTxt);
            aCell[c].setAttribute("data-tip-trunc", "");
        }
    }

    /**
     * 이름 칸 아무 데나 눌러도 접었다 폈다 되게 한다(공용).
     *   ★ 가상 스크롤은 줄 요소를 다시 쓴다 — 처리기는 **요소당 한 번만** 붙이고, 지금 그 줄이
     *     무엇인지는 요소에 적어 둔 것을 읽는다. 그릴 때마다 붙이면 처리기가 쌓여, 한 번 눌러도
     *     접었다 폈다를 거듭해 제자리로 돌아온다.
     *
     *   @param {function} fnToggle  fnToggle(oNode, bOpen) — 실제로 접고 펴는 일
     *   @param {function} fnAfter   그 뒤에 다시 그리는 일
     */
    function _wireNameToggle(oRow, oNode, oExpand, fnToggle, fnAfter) {

        var oNameCell = oRow.querySelector(".u4aColTreeNameCell");
        if (!oNameCell) {
            if (_hasKids(oNode.val)) {
                console.error("[DMWN-008] ERROR TREE_NAME_CELL_MISSING path=" + oNode.path +
                    " - click-to-toggle on the name cell is dead for this row");
            }
            return;
        }

        oNameCell.__dmNode = _hasKids(oNode.val) ? oNode : null;
        oNameCell.__dmRow = oRow;
        oNameCell.__dmExpand = oExpand;
        oNameCell.__dmToggle = fnToggle;
        oNameCell.__dmAfter = fnAfter;
        oNameCell.classList.toggle("u4aDmTreeNameHit", _hasKids(oNode.val));

        if (oNameCell.__dmHooked === true) { return; }
        oNameCell.__dmHooked = true;

        oNameCell.addEventListener("click", function (ev) {

            //화살표를 직접 누른 것은 공통 트리가 이미 처리한다 - 여기서 또 뒤집으면 도로 닫힌다.
            if (ev.target && ev.target.closest && ev.target.closest(".u4a-tree__toggle")) { return; }

            var oNow = oNameCell.__dmNode;
            if (!oNow) { return; }

            var oMap = oNameCell.__dmExpand || {};
            var oRowNow = oNameCell.__dmRow;
            var bNow = Object.prototype.hasOwnProperty.call(oMap, oNow.path)
                ? oMap[oNow.path]
                : (!!oRowNow && oRowNow.getAttribute("aria-expanded") === "true");

            oNameCell.__dmToggle(oNow, !bNow);
            oNameCell.__dmAfter();
        });
    }


    function _setExpand(oNode, bOpen) {
        _setExpandIn(_oExpand, _oClosedOnce, oNode, bOpen);
    }

    function _ancestorClosed(sPath) {
        return _ancestorClosedIn(_oClosedOnce, sPath);
    }

    /* ==================================================================
     * 리스트 뷰 path 눌러 트리 뷰의 그 자리로 가기
     *   ─ 공통 트리에 "key 로 찾아 그 줄까지 스크롤" 기능이 있어 그것을 쓴다.
     *   ─ 가는 길(윗자리)을 펼쳐 두지 않으면 그 줄이 목록에 아예 없어 못 찾는다.
     *   ─ 걸러내기가 켜져 있으면 그 줄이 빠져 있을 수 있으므로 풀고 간다(장군님 결정 2026-09-10).
     * ================================================================== */

    /**
     * path 를 뿌리부터 한 단계씩 늘어나는 자리 목록으로 쪼갠다.
     *   ★ 뿌리 이름 자체에 점이 들어간다(oAPP.attr). 점으로 그냥 쪼개면 없는 자리가 나오므로
     *     뿌리는 가진 데이터의 키와 대조해서 자른다.
     *   @return {Array<string>|null}  [뿌리, ... , 자기 자신] / 모양이 안 맞으면 null
     */
    function _splitPath(sPath) {

        if (!_oSnap || !sPath) { return null; }

        //뿌리 = 이 path 가 그것으로 시작하는 키 중 가장 긴 것.
        var sRoot = "";
        var aRootKeys = Object.keys(_oSnap);
        for (var i = 0; i < aRootKeys.length; i++) {
            var k = aRootKeys[i];
            if (sPath === k ||
                (sPath.indexOf(k) === 0 && (sPath.charAt(k.length) === "." || sPath.charAt(k.length) === "["))) {
                if (k.length > sRoot.length) { sRoot = k; }
            }
        }
        if (!sRoot) { return null; }

        var aOut = [sRoot];
        var sRest = sPath.slice(sRoot.length);
        var sCur = sRoot;
        var iAt = 0;

        while (iAt < sRest.length) {

            var c = sRest.charAt(iAt);

            if (c === ".") {
                var iNext = iAt + 1;
                while (iNext < sRest.length && sRest.charAt(iNext) !== "." && sRest.charAt(iNext) !== "[") { iNext++; }
                sCur = sCur + sRest.slice(iAt, iNext);
                aOut.push(sCur);
                iAt = iNext;
            } else if (c === "[") {
                var iEnd = sRest.indexOf("]", iAt);
                if (iEnd < 0) { return null; }
                sCur = sCur + sRest.slice(iAt, iEnd + 1);
                aOut.push(sCur);
                iAt = iEnd + 1;
            } else {
                return null;
            }
        }

        return aOut;
    }

    /**
     * 가진 데이터에서 실제로 있는 가장 깊은 자리가 몇 번째인가.
     *   눌렀던 줄이 그 뒤에 지워졌을 수 있다 — 그때는 남아 있는 가장 가까운 윗자리로 간다.
     *   @return {number}  aPieces 안 위치 / 뿌리조차 없으면 -1
     */
    function _deepestExisting(aPieces) {

        if (!Object.prototype.hasOwnProperty.call(_oSnap, aPieces[0])) { return -1; }

        var v = _oSnap[aPieces[0]];
        var iOk = 0;

        for (var i = 1; i < aPieces.length; i++) {
            if (v === null || typeof v !== "object") { break; }
            var sPrev = aPieces[i - 1];
            var sSeg = aPieces[i].slice(sPrev.length);
            var sKey = (sSeg.charAt(0) === "[") ? sSeg.slice(1, -1) : sSeg.slice(1);
            if (!Object.prototype.hasOwnProperty.call(v, sKey)) { break; }
            v = v[sKey];
            iOk = i;
        }

        return iOk;
    }

    /**
     * 걸러내기를 푼다(점프 전에). 켜져 있으면 가려는 자리가 트리에 아예 없을 수 있다.
     */
    function _clearTreeFiltersForJump() {

        _sTreeKind = "";
        _sTreeSearch = "";

        //화면에 보이는 것도 같이 되돌린다.
        if (_oTreeKindSel) { _oTreeKindSel.value = ""; }
        if (EL.treeSearch && EL.treeSearch.value !== "") {
            EL.treeSearch.value = "";
            //지우기(X) 표시·펼침 상태 되돌리기를 원래 배선이 알아서 하도록 신호를 준다.
            try { EL.treeSearch.dispatchEvent(new Event("input", { bubbles: true })); }
            catch (e) { console.error("[DMWN-010] ERROR JUMP_CLEAR_SEARCH failed — search box may still filter the tree:", e); }
        }

        //가는 길을 새로 열 것이므로 펼침 상태는 비우고 시작한다.
        _oExpand = {};
        _oClosedOnce = {};
    }

    /**
     * 리스트 뷰에서 누른 path 로 간다. 데이터가 아직 없으면 올 때까지 미뤄 둔다.
     */
    function _jumpToPath(sPath) {

        if (!sPath) { return; }

        _sJumpPath = sPath;
        _clearTreeFiltersForJump();

        if (_sView !== "tree") { _setView("tree"); }   //여기서 데이터를 다시 달라고 한다

        //이미 가진 데이터가 있으면 기다리지 않고 바로 간다(길이 끊겨도 동작하게).
        if (_oSnap) { _renderTree(); _runJump(); }
    }

    /**
     * 예약해 둔 점프 실행.
     */
    function _runJump() {

        if (!_sJumpPath || !_oSnap) { return; }

        var sWant = _sJumpPath;
        _sJumpPath = "";

        var aP = _splitPath(sWant);
        if (!aP) {
            console.error("[DMWN-010] ERROR JUMP_PATH_UNPARSED path=" + sWant +
                " — cannot map this row to a tree node, tree view stays where it is");
            return;
        }

        var iOk = _deepestExisting(aP);
        if (iOk < 0) {
            console.warn("[DMWN-011] WARN JUMP_ROOT_GONE path=" + sWant +
                " — root no longer in snapshot, nothing to jump to");
            return;
        }

        //가는 길을 전부 펼친다(자기 자신은 안 펼쳐도 된다).
        for (var i = 0; i < iOk; i++) { _oExpand[aP[i]] = true; }
        _renderTree();

        var sTarget = aP[iOk];

        if (!_oTree || typeof _oTree.selectKey !== "function") {
            console.error("[DMWN-011] ERROR JUMP_NO_TREE path=" + sTarget +
                " — tree is not ready, cannot scroll to the node");
            return;
        }

        _oTree.selectKey(sTarget, true);

        if (sTarget !== sWant) {
            //그 뒤에 지워져서 끝까지 못 간 경우 — 남아 있는 가장 가까운 윗자리에 세운다.
            console.warn("[DMWN-011] WARN JUMP_PARTIAL want=" + sWant + " reached=" + sTarget +
                " — the deeper part is gone from the snapshot");
        }
    }

    //아무것도 안 남았을 때 보여줄 안내 문구 — 지금 걸러내기에 맞춰 바뀐다.
    function _emptyText() {
        if (_sTreeKind === "추가") { return "추가된 것이 없습니다."; }
        if (_sTreeKind) { return "변경된 것이 없습니다."; }
        if (_sTreeSearch) { return "찾는 것이 없습니다."; }
        return "볼 데이터가 없습니다.";
    }

    //안내 문구를 지금 걸러내기에 맞춘다.
    //  공통 트리는 만들 때 받은 문구를 그대로 쓰므로, 설정과 이미 떠 있는 글자를 둘 다 맞춘다.
    function _syncEmptyText() {
        var sTxt = _emptyText();
        if (_oTreeCfg) { _oTreeCfg.emptyText = sTxt; }
        if (!EL.treeHost) { return; }
        var oEmp = EL.treeHost.querySelector(".u4aColTreeEmpty");
        if (oEmp) { oEmp.textContent = sTxt; }
    }

    /**
     * 트리를 그린다(또는 다시 그린다).
     */
    function _renderTree() {

        if (!EL.treeHost) { return; }

        if (!(window.U4AUI && typeof U4AUI.makeColumnTree === "function")) {
            console.error("[DMWN-007] common column tree missing - cannot render the tree view.");
            return;
        }

        if (!_oSnap) { return; }

        //이미 만들어 뒀으면 다시 그리기만 한다(컬럼 구성은 그대로).
        if (_oTree && typeof _oTree.rerender === "function") {
            try { _syncEmptyText(); _oTree.rerender(false); return; }
            catch (e) { console.error("[DMWN-007] tree re-render failed:", e); _oTree = null; }
        }

        try {
            _oTreeCfg = {
                virtual: true,
                columns: [
                    { label: "이름", width: "22rem" },
                    { label: "종류", width: "6rem" },
                    { label: "이전", width: "12rem" },
                    { label: "현재 값", width: "18rem" },
                    { label: "시각", width: "8rem" }
                ],
                roots: function () {
                    var aOut = [];
                    var aKeys = Object.keys(_oSnap);
                    for (var i = 0; i < aKeys.length; i++) {
                        var oN = _mkNode(aKeys[i], _oSnap[aKeys[i]], aKeys[i],
                            (!!_sTreeSearch && _nameHit(aKeys[i])), false, 0);
                        if (_treeKeep(oN)) { aOut.push(oN); }
                    }
                    return aOut;
                },
                children: _treeKids,
                hasChildren: function (n) { return _hasKids(n.val); },
                key: function (n) { return n.path; },
                label: function (n) { return String(n.key); },

                //펼침 상태는 여기서 직접 들고 있는다(가상 트리는 바깥 펼침맵을 쓴다).
                isExpanded: function (n) {
                    if (Object.prototype.hasOwnProperty.call(_oExpand, n.path)) { return !!_oExpand[n.path]; }
                    //★ 윗자리를 한 번이라도 접었으면 그 아래는 저절로 펼치지 않는다(장군님 지적 2026-09-10).
                    if (_ancestorClosed(n.path)) { return false; }
                    //바뀐 것만 볼 때는 길을 열어 둔다 — 안 그러면 접힌 채라 아무것도 안 보인다.
                    //찾을 때 — 걸린 자리까지 가는 길도, 걸린 자리 아래도 전부 펼친다(장군님 지시 2026-09-10).
                    if (_sTreeSearch) { return true; }
                    if (_sTreeKind) { return true; }
                    //★ 넘겨받는 level 은 믿지 않는다 — 공통 트리가 화살표를 누를 때 0 으로 넘긴다
                    //  (theme/u4a-ui.js 의 가상 트리 토글). 그대로 믿으면 깊은 자리도 "펼쳐진 것"으로
                    //  답해 화살표가 반대로 먹는다. 노드에 달아 둔 깊이(lvl)를 본다.
                    return (n.lvl || 0) < 1;
                },
                onToggle: function (n, bOpen) { _setExpand(n, bOpen); },

                tip: function (n) { return n.path; },
                selectable: true,
                cell: function (n) {
                    var oChg = _oChgMap[n.path];
                    var oOut = { c2: "", c3: "", c4: "", c5: "" };

                    if (oChg) {
                        var oTag = document.createElement("span");
                        oTag.className = "u4aDmKind " +
                            (oChg.종류 === "추가" ? "u4aDmKind--add"
                                : (oChg.종류 === "삭제" ? "u4aDmKind--del" : "u4aDmKind--chg"));
                        oTag.textContent = oChg.종류;
                        oOut.c2 = oTag;
                        oOut.c3 = (oChg.이전 == null ? "" : String(oChg.이전));
                        oOut.c5 = oChg.시각 || "";
                    }

                    //현재 값.
                    //  · 보통 덩어리는 굳이 안 적는다(펼쳐서 자식으로 보면 되니까)
                    //  · ★ 이번에 바뀐 덩어리는 적는다 — 안 적으면 "추가" 만 뜨고
                    //    무엇이 생겼는지 알 수 없어 일일이 펼쳐 봐야 한다(장군님 지시 2026-09-10).
                    oOut.c4 = (_hasKids(n.val) && !oChg) ? "" : _treeVal(n.val);

                    return oOut;
                },
                rowHook: function (oRow, n) {

                    //바뀐 줄은 눈에 띄게.
                    if (_oChgMap[n.path]) { oRow.classList.add("u4aDmTreeChg"); }

                    //잘린 글자는 마우스를 올리면 다 보인다(리스트 뷰와 같게).
                    _tipCells(oRow);

                    //첫 칸(이름) 아무 데나 눌러도 접었다 폈다 된다.
                    //  ★ 배선은 공용 함수 하나로 — 트리를 더 만들 때 새로 짜지 말 것.
                    _wireNameToggle(oRow, n, _oExpand, _setExpand, _renderTree);
                },
                emptyText: _emptyText()
            };

            _oTree = U4AUI.makeColumnTree(EL.treeHost, _oTreeCfg);

            //★ 만들기만 하면 아직 아무것도 안 그린다 — 한 번 그려 줘야 줄이 나온다.
            if (_oTree && typeof _oTree.rerender === "function") { _oTree.rerender(false); }

        } catch (e) {
            console.error("[DMWN-007] tree view render failed:", e);
        }
    }

    /**
     * 부모에게 지금 데이터를 달라고 하고, 오면 트리를 그린다.
     */
    function _askSnap() {
        _send({ PRCCD: "DMON_SNAP" });
    }

    /**
     * 잠깐 모았다가 한 번만 데이터를 다시 받는다.
     *   한 번 조작에 바뀐 것이 여러 묶음으로 나눠 오기도 해서, 올 때마다 받으면 창끼리 큰 덩어리가 여러 번 오간다.
     *   예약해 둔 것은 다음 것이 오면 먼저 취소하고 다시 잡는다(겹치지 않게 — WP1 ②).
     */
    function _askSnapSoon() {
        if (_iSnapTimer) { clearTimeout(_iSnapTimer); }
        _iSnapTimer = setTimeout(function () {
            _iSnapTimer = 0;
            _askSnap();
        }, 150);
    }

    /**
     * 뷰 바꾸기.
     */
    function _setView(sView) {

        _sView = sView;

        var bTree = (sView === "tree");
        var bCmp = (sView === "cmp");
        var bList = (!bTree && !bCmp);

        if (EL.tableWrap) { EL.tableWrap.hidden = !bList || (_iCount === 0); }
        if (EL.treeHost) { EL.treeHost.hidden = !bTree; }
        if (EL.treeOnly) { EL.treeOnly.hidden = !bTree; }
        if (EL.cmp) { EL.cmp.hidden = !bCmp; }
        if (EL.cmpOnly) { EL.cmpOnly.hidden = !bCmp; }
        if (EL.empty) { EL.empty.hidden = !bList || (_iCount > 0); }

        //★ 그 뷰에서 안 쓰는 조작은 아예 안 보이게 한다(장군님 지적 2026-09-11).
        //  비교 뷰는 감시를 쓰지 않는다 — [감시 시작]·[지금 비교]·[기록 지우기]·감시 상태 글자를 숨긴다.
        //  감시 범위(공통코드·라이브러리)도 숨긴다: 비교 뷰에서 범위를 넓히면 4.0 쪽만 커져
        //  3.0 에 없는 자리가 전부 "다름" 으로 나와 비교가 못 쓰게 된다.
        if (EL.watchOnly) { EL.watchOnly.hidden = bCmp; }
        if (EL.scopeOnly) { EL.scopeOnly.hidden = bCmp; }
        if (EL.state) { EL.state.hidden = bCmp; }
        if (EL.cmpInfo) { EL.cmpInfo.hidden = !bCmp; }

        if (EL.btnList) { EL.btnList.classList.toggle("pressed", bList); }
        if (EL.btnTree) { EL.btnTree.classList.toggle("pressed", bTree); }
        if (EL.btnCmp) { EL.btnCmp.classList.toggle("pressed", bCmp); }

        //보지 않는 뷰의 데이터 다시 받기 예약은 취소한다(안 보는 것을 받아 올 필요 없다).
        if (!bTree && _iSnapTimer) { clearTimeout(_iSnapTimer); _iSnapTimer = 0; }

        if (bTree) { _askSnap(); }

        if (bCmp) {
            //비교 뷰로 들어오면 좌우 폭을 다시 맞추고(창이 그동안 바뀌었을 수 있다) 다시 그린다.
            try {
                if (window.U4AUI && U4AUI.wireSplitter && EL.cmp) { U4AUI.wireSplitter(EL.cmp, { axis: "x" }); }
            } catch (e) {
                console.error("[DMWN-016] ERROR COMPARE_SPLITTER_WIRE_FAILED - the divider cannot be dragged:", e);
            }
            _cmpRefresh();
        }
    }


    /* ==================================================================
     * 5-3. 3.0 <-> 4.0 비교 뷰 (2026-09-11 신규)
     *
     *  목적 (장군님 지시 2026-09-11):
     *    두 프로그램이 각각 관리하는 **데이터 구조가 같은지 다른지만** 본다.
     *    값이 같든 다르든 비교는 하되, 다른 자리는 걸러서 볼 수 있게 한다.
     *
     *  들어오는 길:
     *    3.0 은 실행 중인 화면에서 감지 코드를 그 자리에 돌려 데이터 구조를 한 벌 뜬 뒤,
     *    여기서 열어 둔 9999 로 보낸다. 3.0 쪽에는 파일을 만들지 않는다.
     *
     *  1단계 범위 — 좌우 출력 + 다른 것만 걸러 보기까지. 차이 강조색 손질·스크롤 맞물리기·
     *    짝짓기 규칙은 장군님이 화면을 보고 정하신 뒤에 얹는다.
     *
     *  설계 = .works/데이터모니터/01_버전간_데이터비교_설계.md
     * ================================================================== */

    function _cmpNow() {
        var d = new Date();
        function p2(n) { return (n < 10 ? "0" : "") + n; }
        return p2(d.getHours()) + ":" + p2(d.getMinutes()) + ":" + p2(d.getSeconds());
    }

    function _cmpSetInfo(sText) {
        if (EL.cmpInfo) { EL.cmpInfo.textContent = sText || ""; }
    }


    /* ---- 9999 열기 ----------------------------------------------------
     *
     *  ★ express 를 안 쓴다 (2026-09-11 실측으로 확인).
     *    이 앱의 Electron 이 들고 있는 Node 는 14 대인데, 프로젝트에 깔려 있는 express 는
     *    Node 18 이상만 받는다(자기 package.json 에 그렇게 적혀 있다). 실제로 부르면
     *    `Cannot find module 'node:events'` 로 즉시 터진다 — 붙여 넣는 방식이 달라서다.
     *    받을 것이 GET 하나 · POST 하나뿐이라 **Node 에 원래 들어 있는 http 로 그대로 연다.**
     *    설치할 것도 없고 버전에 매이지도 않는다.
     * ------------------------------------------------------------------- */

    //한 번에 받을 수 있는 최대 크기. 데이터 구조 한 벌 실측이 약 48만자라 넉넉히 잡는다.
    var C_MAX_BODY = 512 * 1024 * 1024;

    function _cmpSetCors(res) {
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type");
        res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    }

    function _cmpJson(res, iCode, oBody) {
        try {
            res.statusCode = iCode;
            res.setHeader("Content-Type", "application/json; charset=utf-8");
            res.end(JSON.stringify(oBody));
        } catch (e) {
            console.error("[DMWN-013] ERROR COMPARE_REPLY_FAILED - the sender gets no answer:", e);
        }
    }

    /**
     * 3.0 이 보낸 데이터 구조 받기.
     */
    function _cmpOnSnapshot(req, res) {

        var aChunk = [];
        var iSize = 0;
        var bDead = false;

        req.on("data", function (oChunk) {

            if (bDead) { return; }

            iSize += oChunk.length;

            if (iSize > C_MAX_BODY) {
                bDead = true;
                console.error("[DMWN-013] ERROR SNAPSHOT_FROM_3_0 too large size=" + iSize +
                    " limit=" + C_MAX_BODY + " - nothing was stored.");
                _cmpJson(res, 413, { OK: false, MSG: "too large" });
                try { req.destroy(); } catch (e) { /* 이미 끊긴 경우 */ }
                return;
            }

            aChunk.push(oChunk);
        });

        req.on("error", function (e) {
            if (bDead) { return; }
            bDead = true;
            console.error("[DMWN-013] ERROR SNAPSHOT_FROM_3_0 receive failed:", e);
        });

        req.on("end", function () {

            if (bDead) { return; }

            var sRaw = "";
            var oBody = null;

            try {
                sRaw = Buffer.concat(aChunk).toString("utf8");
            } catch (e) {
                console.error("[DMWN-013] ERROR SNAPSHOT_FROM_3_0 join failed size=" + iSize + ":", e);
                _cmpJson(res, 400, { OK: false, MSG: "join failed" });
                return;
            }

            try {
                oBody = JSON.parse(sRaw);
            } catch (e) {
                console.error("[DMWN-013] ERROR SNAPSHOT_FROM_3_0 parse failed size=" + sRaw.length + ":", e);
                _cmpJson(res, 400, { OK: false, MSG: "parse failed" });
                return;
            }

            var oSnap = oBody && oBody.SNAP;

            if (!oSnap || typeof oSnap !== "object") {
                console.error("[DMWN-013] ERROR SNAPSHOT_FROM_3_0 has no SNAP object - nothing to show. keys=" +
                    Object.keys(oBody || {}).join(","));
                _cmpJson(res, 400, { OK: false, MSG: "SNAP missing" });
                return;
            }

            _oCmpLeft = oSnap;
            _sCmpLeftTime = _cmpNow();

            //★ 새로 받았으면 펼침 기록을 비운다(장군님 지적 2026-09-11).
            //  안 비우면 예전에 펼쳐 둔 자리만 펼쳐진 채 나머지는 기본값이라 뒤섞여 보인다.
            //  비우면 언제 담아도 늘 같은 모양(뿌리만 펼침)으로 시작한다.
            _oCmpExpandL = {};
            _oCmpClosedL = {};

            console.log("[DMWN] INFO SNAPSHOT_FROM_3_0 received roots=" +
                Object.keys(oSnap).length + " size=" + sRaw.length);

            //받자마자 4.0 것도 새로 담아 나란히 놓는다.
            //  ★ 여기서 바로 다시 그리지 않는다 — 4.0 것이 도착하면 그때 한 번만 그린다.
            //    둘 다 그리면 한 번 보낼 때마다 비교가 두 번 돌아 콘솔에도 두 줄씩 쌓인다
            //    (장군님 지적 2026-09-11). 부모와 못 이어진 때만 왼쪽이라도 그려 둔다.
            _cmpAskRight();
            if (!_oChannel) { _cmpRefresh(); }

            _cmpJson(res, 200, { OK: true, ROOTS: Object.keys(oSnap).length });
        });
    }

    function _startServer() {

        if (_oSrv) { return; }

        var http = null;

        try {
            http = require("http");
        } catch (e) {
            console.error("[DMWN-012] ERROR HTTP_MODULE_LOAD_FAILED port=" + C_PORT +
                " - cannot receive data from 3.0:", e);
            _cmpSetInfo("9999 을 못 열었습니다");
            return;
        }

        try {

            _oSrv = http.createServer(function (req, res) {

                //3.0 은 다른 프로그램이라 보내는 쪽 출처가 우리와 다르다. 받기만 하므로 열어 둔다.
                _cmpSetCors(res);

                if (req.method === "OPTIONS") {
                    res.statusCode = 204;
                    res.end();
                    return;
                }

                var sUrl = (req.url || "").split("?")[0];

                //3.0 쪽에서 살아 있는지 확인용.
                if (req.method === "GET" && sUrl === "/ping") {
                    _cmpJson(res, 200, { OK: true, FROM: "4.0", PORT: C_PORT });
                    return;
                }

                if (req.method === "POST" && sUrl === "/snapshot") {
                    _cmpOnSnapshot(req, res);
                    return;
                }

                //3.0 쪽이 주소를 잘못 적으면 여기로 온다 - 조용히 두면 원인을 못 찾는다.
                console.error("[DMWN-013] ERROR COMPARE_UNKNOWN_REQUEST method=" + req.method +
                    " url=" + sUrl + " - nothing was stored.");
                _cmpJson(res, 404, { OK: false, MSG: "unknown path" });
            });

            _oSrv.on("error", function (e) {
                //이미 쓰는 자리이면 3.0 것이 영영 안 들어온다 - 반드시 드러낸다.
                console.error("[DMWN-014] ERROR COMPARE_PORT_LISTEN_FAILED port=" + C_PORT +
                    " code=" + (e && e.code) + " - data from 3.0 cannot arrive:", e);
                _cmpSetInfo("9999 을 못 열었습니다 (" + ((e && e.code) || "error") + ")");
                _oSrv = null;
            });

            _oSrv.listen(C_PORT, "127.0.0.1", function () {
                console.log("[DMWN] INFO COMPARE_PORT_OPEN port=" + C_PORT);
                _cmpSetInfo("9999 열림 - 3.0 에서 보내십시오");
            });

        } catch (e) {
            console.error("[DMWN-014] ERROR COMPARE_SERVER_START_FAILED port=" + C_PORT + ":", e);
            _cmpSetInfo("9999 을 못 열었습니다");
            _oSrv = null;
        }
    }

    function _stopServer() {
        if (!_oSrv) { return; }
        try { _oSrv.close(); }
        catch (e) { console.error("[DMWN-014] ERROR COMPARE_PORT_CLOSE_FAILED port=" + C_PORT + ":", e); }
        _oSrv = null;
    }


    /* ---- 4.0 것 담기 -------------------------------------------------- */

    function _cmpAskRight() {
        //★ "지금 이 순간"을 새로 떠 달라고 한다(DMON_SNAP 과 다르다 — 그쪽은 마지막 비교 시점 것을 준다).
        //  3.0 도 누를 때마다 지금을 뜨므로, 양쪽 시점이 맞아야 비교가 뜻이 있다.
        _bCmpWantRight = true;
        _send({ PRCCD: "DMON_SNAPNOW" });
    }


    /* ---- 어긋난 자리 찾기 --------------------------------------------- */

    //홑값 하나가 같은가. 덩어리는 자식에서 따로 따진다.
    function _cmpSameLeaf(a, b) {
        if (a === b) { return true; }
        //NaN 은 서로 달라 보이지만 같은 것으로 본다.
        if (typeof a === "number" && typeof b === "number" && isNaN(a) && isNaN(b)) { return true; }
        return false;
    }

    //한 번에 표시할 수 있는 어긋난 자리 최대 개수.
    //  한쪽에만 있는 덩어리가 크면 그 아래가 통째로 어긋난 자리가 된다 — 상한이 없으면
    //  느린 PC 에서 그대로 멎는다. 상한에 닿으면 끊고 화면에 끊었다고 적는다.
    var C_CMP_MAX = 20000;

    function _cmpOver() { return _iCmpDiffN >= C_CMP_MAX; }

    //어긋난 자리 하나 적기(개수도 같이 센다).
    function _cmpPut(sPath, sKind, bTop) {
        if (_oCmpDiff[sPath]) { return; }
        _oCmpDiff[sPath] = sKind;
        _iCmpDiffN++;
        if (_oCmpKindN[sKind] !== undefined) { _oCmpKindN[sKind]++; }
        //★ 이동 목록에는 **꼭대기만** 넣는다. 한쪽에만 있는 덩어리는 그 아래가 전부 어긋난 자리가 되는데,
        //  그것까지 넣으면 [다음 차이]를 수천 번 눌러야 다음 덩어리로 간다.
        if (bTop) { _aCmpDiffTop.push(sPath); }
        //★ 끊겼다고 따로 한 줄 더 찍지 않는다(장군님 지적 2026-09-11).
        //  비교가 끝날 때 남기는 줄에 cut=true 로 이미 들어 있다 — 같은 말을 두 번 남기지 않는다.
        //  게다가 그것은 오류가 아니라 "여기서 그만 셌다"는 표시다. 오류로 찍으니 붉은 줄이 쏟아졌다.
        if (_iCmpDiffN >= C_CMP_MAX) { _bCmpCut = true; }
    }

    /**
     * 한쪽에만 있는 자리 — **그 아래까지 전부** 같은 종류로 적는다.
     *   ★ 전에는 그 자리 하나만 적고 아래로 안 들어갔다(장군님 지적 2026-09-11).
     *     그래서 ① 하위 레벨이 비교에서 빠지고 ② [다른 것만] 을 켜면 윗자리만 남고
     *     펼쳐도 아래가 안 나왔다(화살표는 있는데 속이 비었다).
     */
    function _cmpMarkAll(v, sPath, sKind, iDepth, bTop) {

        if (_cmpOver()) { return; }

        _cmpPut(sPath, sKind, bTop === true);

        if (!v || typeof v !== "object") { return; }
        if (iDepth > 40) { return; }

        var bArr = Array.isArray(v);
        var aK = Object.keys(v);

        for (var i = 0; i < aK.length; i++) {
            if (_cmpOver()) { return; }
            _cmpMarkAll(v[aK[i]], _joinPath(sPath, aK[i], bArr), sKind, iDepth + 1, false);
        }
    }

    //어긋난 자리로 가는 윗자리를 전부 열어 둔다(걸러 볼 때 길이 막히지 않게).
    function _cmpMarkUp(sPath) {
        var i = sPath.length;
        while (i > 0) {
            var iDot = sPath.lastIndexOf(".", i - 1);
            var iBr = sPath.lastIndexOf("[", i - 1);
            var iCut = (iDot > iBr) ? iDot : iBr;
            if (iCut <= 0) { break; }
            var sUp = sPath.slice(0, iCut);
            if (_oCmpDiffUp[sUp]) { break; }   //이미 열어 둔 길이면 그만
            _oCmpDiffUp[sUp] = true;
            i = iCut;
        }
    }

    function _cmpWalk(vL, vR, sPath, iDepth) {

        if (_cmpOver()) { return; }
        if (iDepth > 40) { return; }

        var bLObj = (vL && typeof vL === "object");
        var bRObj = (vR && typeof vR === "object");

        //① 한쪽만 덩어리다 — 이 자리도 다르고, 덩어리 쪽 아래도 전부 다르다.
        if (bLObj !== bRObj) {
            _cmpMarkAll(bLObj ? vL : vR, sPath, "다름", iDepth, true);
            _cmpMarkUp(sPath);
            return;
        }

        //② 둘 다 홑값이다 — 값만 견준다.
        if (!bLObj) {
            if (!_cmpSameLeaf(vL, vR)) {
                _cmpPut(sPath, "다름", true);
                _cmpMarkUp(sPath);
            }
            return;
        }

        //③ 둘 다 덩어리다.
        var bLArr = Array.isArray(vL), bRArr = Array.isArray(vR);

        //   목록인지 아닌지가 서로 다르면 이 자리를 다름으로 적되, **아래는 계속 견준다**
        //   (그래야 어느 자리가 어떻게 다른지까지 보인다).
        if (bLArr !== bRArr) {
            _cmpPut(sPath, "다름", true);
            _cmpMarkUp(sPath);
        }

        var oSeen = {};
        var aK = Object.keys(vL).concat(Object.keys(vR));

        for (var i = 0; i < aK.length; i++) {

            if (_cmpOver()) { return; }

            var sK = aK[i];
            if (oSeen[sK]) { continue; }
            oSeen[sK] = true;

            var bInL = Object.prototype.hasOwnProperty.call(vL, sK);
            var bInR = Object.prototype.hasOwnProperty.call(vR, sK);
            var sSub = _joinPath(sPath, sK, bLArr);

            //★ 한쪽에만 있으면 **그 아래까지 전부** 적는다.
            if (bInL && !bInR) { _cmpMarkAll(vL[sK], sSub, "3.0만", iDepth + 1, true); _cmpMarkUp(sSub); continue; }
            if (!bInL && bInR) { _cmpMarkAll(vR[sK], sSub, "4.0만", iDepth + 1, true); _cmpMarkUp(sSub); continue; }

            _cmpWalk(vL[sK], vR[sK], sSub, iDepth + 1);
        }
    }

    function _cmpBuildDiff() {

        _oCmpDiff = {};
        _oCmpDiffUp = {};
        _iCmpDiffN = 0;
        _bCmpCut = false;
        _aCmpDiffTop = [];
        _iCmpAt = -1;
        _oCmpKindN = { "다름": 0, "3.0만": 0, "4.0만": 0 };

        if (!_oCmpLeft || !_oCmpRight) { return; }

        var t0 = (window.performance && performance.now) ? performance.now() : 0;

        var oSeen = {};
        var aK = Object.keys(_oCmpLeft).concat(Object.keys(_oCmpRight));

        for (var i = 0; i < aK.length; i++) {

            var sK = aK[i];
            if (oSeen[sK]) { continue; }
            oSeen[sK] = true;

            var bInL = Object.prototype.hasOwnProperty.call(_oCmpLeft, sK);
            var bInR = Object.prototype.hasOwnProperty.call(_oCmpRight, sK);

            if (bInL && !bInR) { _cmpMarkAll(_oCmpLeft[sK], sK, "3.0만", 0, true); continue; }
            if (!bInL && bInR) { _cmpMarkAll(_oCmpRight[sK], sK, "4.0만", 0, true); continue; }

            _cmpWalk(_oCmpLeft[sK], _oCmpRight[sK], sK, 0);
        }

        var t1 = (window.performance && performance.now) ? performance.now() : 0;
        console.log("[DMWN] INFO COMPARE_DONE diffs=" + _iCmpDiffN +
            " cut=" + _bCmpCut + " ms=" + Math.round(t1 - t0));
    }


    /* ---- 좌우 트리 그리기 --------------------------------------------- */

    /**
     * 이름순으로 늘어놓기 (장군님 지시 2026-09-11).
     *   좌우가 담은 순서가 서로 달라 같은 이름이 딴 높이에 있어 눈으로 맞대 보기 어려웠다.
     *   ★ 목록(Array)은 정렬하지 않는다 — 몇 번째인가가 곧 뜻이라 섞으면 안 된다.
     */
    function _cmpSortKeys(aKeys) {
        return aKeys.sort(function (a, b) {
            if (a === b) { return 0; }
            return (a < b) ? -1 : 1;
        });
    }

    //그 쪽에 걸어 둔 찾는 글자.
    function _cmpFindOf(bLeft) { return bLeft ? _sCmpFindL : _sCmpFindR; }

    function _cmpFindHitOf(bLeft) { return bLeft ? _oFindHitL : _oFindHitR; }
    function _cmpFindUpOf(bLeft) { return bLeft ? _oFindUpL : _oFindUpR; }
    function _cmpFindNOf(bLeft) { return bLeft ? _iFindNL : _iFindNR; }

    //값 하나를 찾기용 글자로 바꾼다.
    function _cmpValText(v) {
        if (v === null) { return "null"; }
        if (v === undefined || typeof v === "object") { return ""; }   //덩어리는 값이 없다 - 자식에서 본다
        return String(v).toLowerCase();
    }

    //이 자리가 걸리나 — **이름과 값을 모두** 본다.
    function _cmpHit1(vKey, vVal, sTxt) {
        if (String(vKey).toLowerCase().indexOf(sTxt) !== -1) { return true; }
        if (_cmpValText(vVal).indexOf(sTxt) !== -1) { return true; }
        return false;
    }

    /**
     * 한 쪽 데이터를 **처음부터 끝까지 한 번** 훑어 걸린 자리를 표로 만든다.
     *   ★ 깊이 제한 없음 — 담아 온 데이터 전부를 본다(담을 때 이미 상한이 걸려 있다).
     *   hit = 걸린 자리 / up = 그 자리로 가는 윗자리(펼쳐야 보이는 길)
     */
    function _cmpBuildFind(bLeft) {

        var oHit = {}, oUp = {}, iN = 0;
        var sTxt = _cmpFindOf(bLeft);
        var oSnap = bLeft ? _oCmpLeft : _oCmpRight;

        if (bLeft) { _oFindHitL = oHit; _oFindUpL = oUp; _iFindNL = 0; }
        else { _oFindHitR = oHit; _oFindUpR = oUp; _iFindNR = 0; }

        if (!sTxt || !oSnap) { return; }

        var t0 = (window.performance && performance.now) ? performance.now() : 0;

        //걸린 자리로 가는 길을 전부 열어 둔다.
        function _up(sPath) {
            var sP = sPath;
            while (true) {
                var iDot = sP.lastIndexOf(".");
                var iBrk = sP.lastIndexOf("[");
                var iCut = (iDot > iBrk) ? iDot : iBrk;
                if (iCut <= 0) { break; }
                sP = sP.slice(0, iCut);
                if (oUp[sP]) { break; }     //이미 열어 둔 길이면 그만
                oUp[sP] = true;
                if (_cmpIsRoot(sP)) { break; }
            }
        }

        function _walk(v, sPath) {
            if (!v || typeof v !== "object") { return; }
            var bArr = Array.isArray(v);
            var aKeys = Object.keys(v);
            for (var i = 0; i < aKeys.length; i++) {
                var sK = aKeys[i];
                var vC = v[sK];
                var sSub = _joinPath(sPath, sK, bArr);
                if (_cmpHit1(sK, vC, sTxt)) { oHit[sSub] = true; iN++; _up(sSub); }
                _walk(vC, sSub);
            }
        }

        var aRoot = Object.keys(oSnap);
        for (var r = 0; r < aRoot.length; r++) {
            if (_cmpHit1(aRoot[r], oSnap[aRoot[r]], sTxt)) { oHit[aRoot[r]] = true; iN++; }
            _walk(oSnap[aRoot[r]], aRoot[r]);
        }

        if (bLeft) { _iFindNL = iN; } else { _iFindNR = iN; }

        var t1 = (window.performance && performance.now) ? performance.now() : 0;
        console.log("[DMWN] INFO FIND_DONE side=" + (bLeft ? "3.0" : "4.0") +
            " hits=" + iN + " ms=" + Math.round(t1 - t0));
    }

    //걸린 윗자리가 있나 — 걸린 자리 아래는 통째로 보여 주기 위한 것.
    function _cmpFindUnder(sPath, oHit) {
        var sP = sPath;
        while (true) {
            var iDot = sP.lastIndexOf(".");
            var iBrk = sP.lastIndexOf("[");
            var iCut = (iDot > iBrk) ? iDot : iBrk;
            if (iCut <= 0) { return false; }
            sP = sP.slice(0, iCut);
            if (oHit[sP] === true) { return true; }
            if (_cmpIsRoot(sP)) { return oHit[sP] === true; }
        }
    }

    /**
     * 이 줄이 지금 걸러내기에 남는가.
     *   ① 다른 것만  ② 찾기 — 둘 다 켜면 둘 다 만족해야 남는다.
     */
    function _cmpKeep(oNode, bLeft) {

        if (_bCmpDiffOnly) {
            if (!_oCmpDiff[oNode.path] && !_oCmpDiffUp[oNode.path]) { return false; }
        }

        if (_cmpFindOf(bLeft)) {
            var oHit = _cmpFindHitOf(bLeft);
            var oUp = _cmpFindUpOf(bLeft);
            //걸린 자리 · 가는 길 · 걸린 자리 아래 — 셋 중 하나면 남긴다.
            if (!oHit[oNode.path] && !oUp[oNode.path] && !_cmpFindUnder(oNode.path, oHit)) { return false; }
        }

        return true;
    }

    function _cmpMkNode(sKey, vVal, sPath, iLvl) {
        return { key: sKey, val: vVal, path: sPath, lvl: iLvl || 0 };
    }

    function _cmpRoots(oSnap, bLeft) {
        var aOut = [];
        if (!oSnap) { return aOut; }
        var aKeys = _cmpSortKeys(Object.keys(oSnap));
        for (var i = 0; i < aKeys.length; i++) {
            var oN = _cmpMkNode(aKeys[i], oSnap[aKeys[i]], aKeys[i], 0);
            if (_cmpKeep(oN, bLeft)) { aOut.push(oN); }
        }
        return aOut;
    }

    function _cmpKids(oNode, bLeft) {

        var aOut = [];
        var v = oNode && oNode.val;
        if (!v || typeof v !== "object") { return aOut; }

        var bArr = Array.isArray(v);
        //목록은 순서가 곧 뜻이므로 그대로 두고, 묶음만 이름순으로 늘어놓는다.
        var aKeys = bArr ? Object.keys(v) : _cmpSortKeys(Object.keys(v));

        for (var i = 0; i < aKeys.length; i++) {
            var sPath = _joinPath(oNode.path, aKeys[i], bArr);
            var oN = _cmpMkNode(aKeys[i], v[aKeys[i]], sPath, (oNode.lvl || 0) + 1);
            if (_cmpKeep(oN, bLeft)) { aOut.push(oN); }
        }

        return aOut;
    }

    function _cmpEmptyText(bLeft) {
        if (bLeft && !_oCmpLeft) { return "3.0 에서 아직 보낸 것이 없습니다."; }
        if (!bLeft && !_oCmpRight) { return "4.0 지금 담기를 누르십시오."; }
        if (_cmpFindOf(bLeft)) { return "찾는 것이 없습니다."; }
        if (_bCmpDiffOnly) { return "다른 자리가 없습니다."; }
        return "볼 데이터가 없습니다.";
    }

    /**
     * 한쪽 트리 만들기.
     *   bLeft = true 면 3.0(좌), false 면 4.0(우).
     *   * 펼침 상태는 좌우가 **같은 것**을 본다 - 같은 자리를 함께 펼쳐야 맞대 볼 수 있다.
     */
    function _cmpMakeTree(bLeft) {

        var oHost = bLeft ? EL.cmpLeftHost : EL.cmpRightHost;
        if (!oHost) { return null; }

        if (!(window.U4AUI && typeof U4AUI.makeColumnTree === "function")) {
            console.error("[DMWN-015] ERROR COMMON_COLUMN_TREE_MISSING - compare view cannot be drawn.");
            return null;
        }

        var oCfg = {
            virtual: true,
            //★ 좌우로 반씩 나눠 쓰는 좁은 자리다. 두 칸 다 폭을 못 박으면 합이 자리보다 넓어져
            //  가로로 밀리고, 가운데 안내 문구까지 자리 밖으로 밀려 잘린다(장군님 지적 2026-09-11).
            //  그래서 [이름]만 폭을 두고 [값]은 **남는 자리를 채우게** 한다(공통이 주는 방식).
            fillLast: true,
            columns: [
                { label: "이름", width: "13rem" },
                { label: "값" }
            ],
            roots: function () { return _cmpRoots(bLeft ? _oCmpLeft : _oCmpRight, bLeft); },
            children: function (n) { return _cmpKids(n, bLeft); },
            hasChildren: function (n) {
                if (!_hasKids(n.val)) { return false; }
                //★ 걸러내기를 켜면 자식이 전부 빠질 수 있다 - 그때는 화살표를 내리지 않는다.
                //  안 그러면 펼침 화살표는 있는데 눌러도 아무것도 안 나온다(장군님 지적 2026-09-11).
                if (!_bCmpDiffOnly && !_cmpFindOf(bLeft)) { return true; }
                return _cmpKids(n, bLeft).length > 0;
            },
            key: function (n) { return n.path; },
            label: function (n) { return String(n.key); },
            isExpanded: function (n) {

                var oExp = _cmpExpandOf(bLeft);
                if (Object.prototype.hasOwnProperty.call(oExp, n.path)) { return !!oExp[n.path]; }

                //★ 윗자리를 한 번이라도 접었으면 그 아래는 저절로 펼치지 않는다(트리 뷰와 같은 동작).
                if (_ancestorClosedIn(_cmpClosedOf(bLeft), n.path)) { return false; }

                //★ 찾기 — **걸린 자리까지 길을 연다**(그 아래는 접어 둔다).
                //  [다른 것만] 보다 **먼저** 본다. 둘 다 켜져 있을 때 찾은 자리가 접힌 채로 남으면 안 된다.
                if (_cmpFindOf(bLeft)) { return _cmpFindUpOf(bLeft)[n.path] === true; }

                //★ [다른 것만] — **어긋난 것이 아래에 있는 자리까지만** 펼친다.
                //  어긋난 자리 자체는 안 펼친다. 좌우가 같은 어긋남 목록을 보므로 **양쪽이 똑같이** 펼쳐진다.
                if (_bCmpDiffOnly) { return _oCmpDiffUp[n.path] === true; }

                //★ 기본은 **전부 접힘**(장군님 지시 2026-09-11). 뿌리도 접는다.
                return false;
            },
            onToggle: function (n, bOpen) { _cmpToggle(bLeft, n, bOpen); },
            tip: function (n) { return n.path; },
            selectable: true,
            cell: function (n) {
                return { c2: _hasKids(n.val) ? "" : _treeVal(n.val) };
            },
            rowHook: function (oRow, n) {

                var sState = _oCmpDiff[n.path];
                //★ 가상 스크롤은 줄 요소를 다시 쓴다 - 안 붙일 때는 반드시 떼 준다.
                oRow.classList.toggle("u4aDmCmpDiff", sState === "다름");
                oRow.classList.toggle("u4aDmCmpOnlyHere", !!sState && sState !== "다름");

                //찾기에 걸린 줄은 눈에 띄게(어디가 걸렸는지 보여야 쓸모가 있다).
                oRow.classList.toggle("u4aDmCmpFound",
                    !!_cmpFindOf(bLeft) && _cmpFindHitOf(bLeft)[n.path] === true);

                //트리 뷰와 똑같이 — 잘린 글자 보여주기 + 이름 칸 아무 데나 눌러 접었다 폈다.
                //  ★ 누른 쪽 상태만 바꾸고 그 쪽만 다시 그린다.
                _tipCells(oRow);
                _wireNameToggle(
                    oRow, n,
                    _cmpExpandOf(bLeft),
                    function (oNode, bOpen) { _cmpToggle(bLeft, oNode, bOpen); },
                    function () { _cmpRerenderOne(bLeft); }
                );
            },
            emptyText: _cmpEmptyText(bLeft)
        };

        try {
            var oTree = U4AUI.makeColumnTree(oHost, oCfg);
            if (oTree && typeof oTree.rerender === "function") { oTree.rerender(false); }
            return oTree;
        } catch (e) {
            console.error("[DMWN-015] ERROR COMPARE_TREE_BUILD_FAILED side=" + (bLeft ? "3.0" : "4.0") + ":", e);
            return null;
        }
    }

    //쪽마다 자기 펼침 상태를 쓴다.
    function _cmpExpandOf(bLeft) { return bLeft ? _oCmpExpandL : _oCmpExpandR; }
    function _cmpClosedOf(bLeft) { return bLeft ? _oCmpClosedL : _oCmpClosedR; }

    /**
     * 비교 뷰 접기/펴기 — 트리 뷰와 **같은 공용 함수**를 쓴다(접으면 그 아래도 접힘).
     *   ★ 누른 쪽만 움직인다. 반대쪽은 건드리지 않는다.
     */
    function _cmpToggle(bLeft, oNode, bOpen) {
        _setExpandIn(_cmpExpandOf(bLeft), _cmpClosedOf(bLeft), oNode, bOpen);
    }

    //누른 쪽만 다시 그린다.
    /**
     * 한 쪽 트리만 새로 만든다(안내 문구가 바뀌므로 다시 만든다).
     *   어긋난 자리는 그대로라 다시 세지 않는다.
     */
    function _cmpRebuildOne(bLeft) {
        var oHost = bLeft ? EL.cmpLeftHost : EL.cmpRightHost;
        if (!oHost) { return; }
        _cmpBuildFind(bLeft);
        oHost.textContent = "";
        if (bLeft) { _oTreeL = _cmpMakeTree(true); }
        else { _oTreeR = _cmpMakeTree(false); }
    }

    /* ---- 어긋난 자리로 바로 가기 --------------------------------------
     *  어긋난 자리가 수천 곳인데 손으로 훑어 내려갈 방법이 없었다(장군님 지적 2026-09-11).
     *  [다음 차이]·[이전 차이] 로 한 곳씩 옮기고, **좌우를 같은 자리에 세운다.**
     * ------------------------------------------------------------------- */

    //그 자리가 뿌리인가(뿌리 이름 자체에 점이 들어 있어 그냥 쪼개면 없는 자리가 나온다).
    function _cmpIsRoot(sPath) {
        if (_oCmpLeft && Object.prototype.hasOwnProperty.call(_oCmpLeft, sPath)) { return true; }
        if (_oCmpRight && Object.prototype.hasOwnProperty.call(_oCmpRight, sPath)) { return true; }
        return false;
    }

    //그 자리로 가는 윗자리들. 뿌리까지만 올라간다.
    function _cmpAncestors(sPath) {
        var aOut = [];
        var sP = sPath;
        while (true) {
            var iDot = sP.lastIndexOf(".");
            var iBrk = sP.lastIndexOf("[");
            var iCut = (iDot > iBrk) ? iDot : iBrk;
            if (iCut <= 0) { break; }
            sP = sP.slice(0, iCut);
            aOut.push(sP);
            //★ 뿌리에 닿으면 멈춘다 — 더 올라가면 "oAPP" 처럼 실제로 없는 자리가 나온다.
            if (_cmpIsRoot(sP)) { break; }
        }
        return aOut;
    }

    function _cmpAtText() {
        if (!EL.cmpAt) { return; }
        EL.cmpAt.textContent = (_iCmpAt >= 0 && _aCmpDiffTop.length)
            ? ((_iCmpAt + 1) + " / " + _aCmpDiffTop.length)
            : "";
    }

    /**
     * 목록의 i 번째 어긋난 자리로 좌우를 같이 옮긴다.
     */
    function _cmpGoto(i) {

        if (!_aCmpDiffTop.length) {
            console.warn("[DMWN-017] WARN NO_DIFF_TO_JUMP - both sides must be captured first.");
            return;
        }

        //끝에서 넘어가면 처음으로(반대도 같게).
        if (i < 0) { i = _aCmpDiffTop.length - 1; }
        if (i >= _aCmpDiffTop.length) { i = 0; }

        _iCmpAt = i;

        var sPath = _aCmpDiffTop[i];
        var aUp = _cmpAncestors(sPath);

        //가는 길을 양쪽 다 펼친다 — 안 그러면 그 줄이 목록에 아예 없어 못 선다.
        for (var k = 0; k < aUp.length; k++) {
            _oCmpExpandL[aUp[k]] = true;
            _oCmpExpandR[aUp[k]] = true;
            delete _oCmpClosedL[aUp[k]];
            delete _oCmpClosedR[aUp[k]];
        }

        _cmpRebuildOne(true);
        _cmpRebuildOne(false);

        //좌우를 같은 자리에 세운다(한쪽에만 있는 자리면 그 쪽만 선다).
        try { if (_oTreeL) { _oTreeL.selectKey(sPath, true); } }
        catch (e) { console.error("[DMWN-017] ERROR JUMP_FAILED side=3.0 path=" + sPath + ":", e); }
        try { if (_oTreeR) { _oTreeR.selectKey(sPath, true); } }
        catch (e) { console.error("[DMWN-017] ERROR JUMP_FAILED side=4.0 path=" + sPath + ":", e); }

        _cmpAtText();
    }

    //양쪽 모두 접기.
    function _cmpCollapseAll() {
        _cmpResetExpand(true);
        _cmpResetExpand(false);
        _iCmpAt = -1;
        _cmpRebuildOne(true);
        _cmpRebuildOne(false);
        _cmpAtText();
    }

    /**
     * 걸러내기를 건드렸을 때 그 쪽 펼침 기록을 비운다(장군님 지적 2026-09-11).
     *   ★ 안 비우면 **손으로 접어 둔 자리가 그대로 접힌 채**라, 찾은 자리가 그 아래에 있으면 안 보인다.
     *     비우면 걸러내기 규칙(찾은 자리까지 펼침)이 그대로 먹고,
     *     그 뒤에 손으로 접고 펴는 것도 다시 기록되어 정상으로 먹는다.
     */
    function _cmpResetExpand(bLeft) {
        if (bLeft) { _oCmpExpandL = {}; _oCmpClosedL = {}; }
        else { _oCmpExpandR = {}; _oCmpClosedR = {}; }
    }

    function _cmpRerenderOne(bLeft) {
        var oTree = bLeft ? _oTreeL : _oTreeR;
        if (!oTree || typeof oTree.rerender !== "function") { return; }
        try { oTree.rerender(false); }
        catch (e) {
            console.error("[DMWN-015] ERROR COMPARE_TREE_RERENDER_FAILED side=" + (bLeft ? "3.0" : "4.0") + ":", e);
        }
    }

    /**
     * 비교 뷰 다시 만들기 - 어긋난 자리를 새로 세고 좌우를 다시 그린다.
     *   안내 문구가 바뀌므로 트리를 새로 만든다(공통 트리는 만들 때 문구를 받는다).
     */
    function _cmpRefresh() {

        if (!EL.cmp) { return; }

        _cmpBuildDiff();

        _cmpBuildFind(true);
        _cmpBuildFind(false);

        if (EL.cmpLeftHost) { EL.cmpLeftHost.textContent = ""; }
        if (EL.cmpRightHost) { EL.cmpRightHost.textContent = ""; }

        _oTreeL = _cmpMakeTree(true);
        _oTreeR = _cmpMakeTree(false);

        if (EL.cmpLeftInfo) {
            EL.cmpLeftInfo.textContent = _oCmpLeft
                ? ("받음 " + _sCmpLeftTime + " / 뿌리 " + Object.keys(_oCmpLeft).length + "개" +
                    (_sCmpFindL ? (" / 찾음 " + _iFindNL + "곳") : ""))
                : "아직 받은 것 없음";
        }
        if (EL.cmpRightInfo) {
            EL.cmpRightInfo.textContent = _oCmpRight
                ? ("담음 " + _sCmpRightTime + " / 뿌리 " + Object.keys(_oCmpRight).length + "개" +
                    (_sCmpFindR ? (" / 찾음 " + _iFindNR + "곳") : ""))
                : "아직 담은 것 없음";
        }

        _cmpAtText();

        if (_oCmpLeft && _oCmpRight) {
            _cmpSetInfo("다름 " + _oCmpKindN["다름"] +
                " · 3.0만 " + _oCmpKindN["3.0만"] +
                " · 4.0만 " + _oCmpKindN["4.0만"] +
                " (총 " + _iCmpDiffN + "곳" + (_bCmpCut ? ", 너무 많아 끊음" : "") + ")");
        } else if (_oSrv) {
            _cmpSetInfo("9999 열림 - 3.0 에서 보내십시오");
        }
    }


    /* ==================================================================
     * 6. 버튼 배선
     * ================================================================== */
    function _bindButtons() {

        //path 칸을 누르면 트리 뷰의 그 자리로 간다. 표 본문에 처리기 하나만 둔다(위임).
        if (EL.rows) {
            EL.rows.addEventListener("click", function (ev) {
                var oTd = ev.target && ev.target.closest ? ev.target.closest(".u4aDmPathJump") : null;
                if (!oTd) { return; }
                //글자를 끌어 블럭을 잡은 채 뗀 것은 누른 것으로 치지 않는다(값 복사 보존 — 공통 판정).
                if (window.U4AUI && U4AUI.isTextDragSelecting && U4AUI.isTextDragSelecting()) { return; }
                _jumpToPath(oTd.getAttribute("data-jump") || "");
            });
        }

        if (EL.btnToggle) {
            EL.btnToggle.addEventListener("click", function () {
                if (_bOn) { _send({ PRCCD: "DMON_STOP" }); }
                else {
                    _send({
                        PRCCD: "DMON_START",
                        SCODE: !!(EL.chkCode && EL.chkCode.checked),
                        LIB: !!(EL.chkLib && EL.chkLib.checked)
                    });
                }
            });
        }

        if (EL.btnNow) {
            EL.btnNow.addEventListener("click", function () { _send({ PRCCD: "DMON_NOW" }); });
        }

        if (EL.btnClear) {
            EL.btnClear.addEventListener("click", function () { _clearList(); });
        }

        function _onIncludeChange() {
            _send({
                PRCCD: "DMON_INCLUDE",
                SCODE: !!(EL.chkCode && EL.chkCode.checked),
                LIB: !!(EL.chkLib && EL.chkLib.checked)
            });
        }

        if (EL.chkCode) { EL.chkCode.addEventListener("change", _onIncludeChange); }
        if (EL.chkLib) { EL.chkLib.addEventListener("change", _onIncludeChange); }

        //걸러내기 칸 — 글자를 치는 즉시 적용.
        if (EL.filters) {
            for (var i = 0; i < EL.filters.length; i++) {
                EL.filters[i].addEventListener("input", _applyFilterAll);
                EL.filters[i].addEventListener("change", _applyFilterAll);
            }
        }

        //뷰 전환 — 리스트 뷰 / 트리 뷰 / 비교 뷰.
        if (EL.btnList) { EL.btnList.addEventListener("click", function () { _setView("list"); }); }
        if (EL.btnTree) { EL.btnTree.addEventListener("click", function () { _setView("tree"); }); }
        if (EL.btnCmp) { EL.btnCmp.addEventListener("click", function () { _setView("cmp"); }); }

        //비교 뷰 — 4.0 것을 지금 담기.
        if (EL.btnCmpTake) {
            EL.btnCmpTake.addEventListener("click", function () { _cmpAskRight(); });
        }

        //비교 뷰 — 어긋난 자리로 바로 가기.
        if (EL.btnDiffNext) { EL.btnDiffNext.addEventListener("click", function () { _cmpGoto(_iCmpAt + 1); }); }
        if (EL.btnDiffPrev) { EL.btnDiffPrev.addEventListener("click", function () { _cmpGoto(_iCmpAt - 1); }); }
        if (EL.btnCollapseAll) { EL.btnCollapseAll.addEventListener("click", function () { _cmpCollapseAll(); }); }

        //F3 = 다음 차이 / Shift+F3 = 이전 차이 (비교 뷰를 보고 있을 때만).
        document.addEventListener("keydown", function (ev) {
            if (ev.key !== "F3" || _sView !== "cmp") { return; }
            ev.preventDefault();
            _cmpGoto(ev.shiftKey ? (_iCmpAt - 1) : (_iCmpAt + 1));
        });

        //비교 뷰 — 좌우 이름 찾기(그 쪽만 좁힌다).
        function _wireCmpFind(oInput, bLeft) {
            if (!oInput) { return; }
            function _apply() {
                var sTxt = (oInput.value || "").trim().toLowerCase();
                if (bLeft) { _sCmpFindL = sTxt; } else { _sCmpFindR = sTxt; }
                _cmpResetExpand(bLeft);
                _cmpRebuildOne(bLeft);
            }

            oInput.addEventListener("input", _apply);

            //★ Enter 를 치면 글자가 그대로여도 다시 건다(장군님 지시 2026-09-11).
            //  중간에 손으로 접어 둔 자리가 있어도 이때 다시 펼쳐진다.
            oInput.addEventListener("keydown", function (ev) {
                if (ev.key !== "Enter") { return; }
                ev.preventDefault();
                _apply();
            });
        }
        _wireCmpFind(EL.cmpLeftSearch, true);
        _wireCmpFind(EL.cmpRightSearch, false);

        //비교 뷰 — 다른 것만 보기.
        if (EL.chkDiffOnly) {
            EL.chkDiffOnly.addEventListener("change", function () {
                _bCmpDiffOnly = !!EL.chkDiffOnly.checked;
                //손으로 접어 둔 기록이 걸러내기를 막지 않게 양쪽 다 비운다.
                _cmpResetExpand(true);
                _cmpResetExpand(false);
                _cmpRefresh();
            });
        }

        //트리 뷰 — 전체 / 바뀐 것만.
        var oTreeFiltHost = $("dmTreeFiltHost");
        if (oTreeFiltHost) {
            if (!(window.U4AUI && typeof U4AUI.createSelect === "function")) {
                console.error("[DMWN-006] common dropdown missing - could not build the tree view filter.");
            } else {
                //★ 리스트 뷰의 종류 걸러내기와 **똑같은 목록**을 쓴다(장군님 지시 2026-09-10).
                //  두 뷰는 보는 방식만 다를 뿐 같은 데이터다 — 고를 것이 서로 다르면 안 된다.
                //  ※ 삭제는 두 뷰 모두 화면에 안 띄우므로 고를 것도 없다(장군님 결정 2026-09-10).
                var oTF = U4AUI.createSelect(
                    [
                        { value: "", text: "전체" },
                        { value: "변경", text: "변경" },
                        { value: "추가", text: "추가" }
                    ],
                    "",
                    function (sVal) { _sTreeKind = sVal || ""; _oExpand = {}; _oClosedOnce = {}; _renderTree(); }
                );
                _oTreeKindSel = oTF;
                oTF.classList.add("u4aDmKindSel");
                oTreeFiltHost.appendChild(oTF);
            }
        }

        //트리 뷰 — 이름 찾기(값은 안 본다).
        if (EL.treeSearch) {
            EL.treeSearch.addEventListener("input", function () {
                _sTreeSearch = (EL.treeSearch.value || "").trim().toLowerCase();
                _oExpand = {};
                _oClosedOnce = {};
                _renderTree();
            });
        }

        //종류 고르기 — 공통 드롭다운 소비.
        //  브라우저가 그리는 펌침 목록은 바탕이 하얀색으로 고정돼 어두운 테마에서 글자가 안 보인다.
        //  공통 드롭다운은 앱이 직접 그리므로 펌침 목록까지 테마가 먹는다.
        var oKindHost = $("dmKindHost");
        if (oKindHost) {
            if (!(window.U4AUI && typeof U4AUI.createSelect === "function")) {
                console.error("[DMWN-006] common dropdown missing - could not build the type selector.");
            } else {
                //없어짐은 화면에 안 띄우므로 고를 것도 없다(장군님 결정 2026-09-10).
                var aKind = [
                    { value: "", text: "전체" },
                    { value: "변경", text: "변경" },
                    { value: "추가", text: "추가" }
                ];
                var oKind = U4AUI.createSelect(aKind, "", function (sVal) {
                    _sKindFilter = sVal || "";
                    _applyFilterAll();
                });
                oKind.classList.add("u4aDmKindSel");
                oKindHost.appendChild(oKind);
            }
        }

        //글자 칸의 지우기(X) — 공통 붙이기 소비(값이 있을 때만 보임).
        //  공통이 없으면 조용히 넘어가지 않고 드러낸다(지우기가 안 먹는 상태로 보이면 헷짓).
        var aField = document.querySelectorAll(".u4aDmFilterField");
        if (aField.length) {
            if (!(window.U4AUI && typeof U4AUI.attachClear === "function")) {
                console.error("[DMWN-005] common clear handler missing - the X button in the filter box does nothing.");
            } else {
                for (var k = 0; k < aField.length; k++) {
                    var oInp = aField[k].querySelector("input");
                    var oX = aField[k].querySelector(".u4a-field__clear");
                    if (!oInp || !oX) { continue; }
                    //어느 칸을 지웠는지에 따라 다시 그릴 곳이 다르다 — 칸마다 따로 묶어 둔다.
                    (function (oThis) {
                        U4AUI.attachClear(oThis, oX, function () {
                            if (oThis === EL.treeSearch) {
                                _sTreeSearch = "";
                                _oExpand = {};
                                _oClosedOnce = {};
                                _renderTree();
                                return;
                            }
                            if (oThis === EL.cmpLeftSearch) { _sCmpFindL = ""; _cmpResetExpand(true); _cmpRebuildOne(true); return; }
                            if (oThis === EL.cmpRightSearch) { _sCmpFindR = ""; _cmpResetExpand(false); _cmpRebuildOne(false); return; }
                            _applyFilterAll();
                        });
                    })(oInp);
                }
            }
        }
    }


    /* ==================================================================
     * 7. 타이틀바 (공통 표준)
     * ================================================================== */
    function _bindTitlebar() {

        //로고
        var oLogo = $("dmLogo");
        if (oLogo) {
            try {
                oLogo.src = encodeURI("file:///" + PATH.join(APPPATH, "img", "logo.png").replaceAll("\\", "/"));
            } catch (e) {
                console.error("[DMWN-004] logo image path build failed:", e);
            }
        }

        //닫기 — 네이티브 닫기를 막아 뒀으므로 공통 닫기로만 닫힌다.
        var oClose = $("dmWinClose");
        if (oClose) {
            oClose.addEventListener("click", function () {
                //닫기 전에 부모 쪽 감시를 꺼 준다(창 없이 계속 도는 것 방지).
                _send({ PRCCD: "DMON_STOP" });
                try { U4AUI.closeWindow(CURRWIN); }
                catch (e) { console.error("[DMWN-002] window close failed:", e); }
            });
        }

        //최대화 토글 + 아이콘 맞추기
        var oMax = $("dmWinMax");
        if (oMax) {
            var _syncMaxIcon = function () {
                try {
                    var oI = oMax.querySelector("i");
                    if (oI) { oI.className = CURRWIN.isMaximized() ? "fa-solid fa-window-restore" : "fa-solid fa-window-maximize"; }
                } catch (e) {
                    console.error("[DMWN-002] maximize icon sync failed:", e);
                }
            };
            oMax.addEventListener("click", function () {
                try { if (CURRWIN.isMaximized()) { CURRWIN.unmaximize(); } else { CURRWIN.maximize(); } }
                catch (e) { console.error("[DMWN-002] maximize toggle failed:", e); }
            });
            try { CURRWIN.on("maximize", _syncMaxIcon); CURRWIN.on("unmaximize", _syncMaxIcon); }
            catch (e) { console.error("[DMWN-002] maximize state listener attach failed:", e); }
            _syncMaxIcon();
        }
    }


    /* ==================================================================
     * 8. 시작
     * ================================================================== */
    document.addEventListener("DOMContentLoaded", function () {

        _cacheEl();
        _setBusy(true);

        try {
            _bindTitlebar();
            _bindButtons();
            _openChannel();
            _setState(false);
            //3.0 이 보내 올 자리를 창이 뜰 때 같이 연다(장군님 지시 2026-09-11).
            _startServer();
        } catch (e) {
            console.error("[DMWN-002] screen ready failed:", e);
        }

        //창이 닫힐 때 부모 쪽 감시를 꺼 준다(모든 닫힘 경로를 덮는다).
        window.addEventListener("beforeunload", function () {
            _send({ PRCCD: "DMON_STOP" });
            _stopServer();
            try { if (_oChannel) { _oChannel.close(); } }
            catch (e) { console.error("[DMWN-003] closing the channel to the parent window failed:", e); }
        });

        //준비가 다 끝난 뒤에 창을 보이고 잠금을 푼다(WP1 — 중간에 미리 풀지 않는다).
        requestAnimationFrame(function () {
            try { CURRWIN.show(); }
            catch (e) { console.error("[DMWN-002] window show failed:", e); }
            document.body.classList.add("u4a-visible");
            _setBusy(false);
            //부모에게 준비 완료를 알려 지금 상태를 받아온다.
            _send({ PRCCD: "DMON_READY" });
        });
    });

})();
