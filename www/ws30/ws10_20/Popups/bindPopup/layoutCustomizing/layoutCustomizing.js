/****************************************************************************
 * Binding Popup(대형 별창) "화면 커스터마이징"(Screen Customizing) — HTML5
 * --------------------------------------------------------------------------
 *  원본: index.js(원작자 v3.6.4-3 추가) — 3영역(바인딩 필드/DESIGN TREE/추가 속성)을 사용자가
 *        표시·숨김 토글. CS_BIND_LAYOUT_AREA(MODEL/DESIGN/ADDIT), BIND_LAYOUT 모델 visible 바인딩,
 *        createBindLayoutCustomizingButton(957) + openBindLayoutCustomizingPopup(스위치 리스트) +
 *        applyBindLayoutCustomizing(활성 영역만 splitter 재구성, 폭 재분배) + localStorage 영속.
 *  HTML5: frameless 3분할 셸(.u4aBwpLeft/Center/Right + #bwpSplit1/#bwpSplit3)에 매핑.
 *         팝업 = 공통 <dialog class="u4a-dialog"> + .u4a-switch + .u4a-btn(전역 드래그/닫기 자동).
 *
 *  ★ 불변 규칙(원본 1:1):
 *   · 기본값 = 3영역 모두 표시(getBindLayoutDefaultState MODEL/DESIGN/ADDIT=true).
 *   · ADDIT 단독 금지 — ADDIT 켤 때 MODEL/DESIGN 둘 다 꺼져있으면 MODEL 강제 ON(965/966).
 *   · 최소 1개 영역(958). 활성 0이면 기본값 복귀.
 *   · 영속 = localStorage `U4A_BIND_POPUP_LAYOUT_${browserkey}`(원본 parent 기준 저장과 동일 스코프).
 *   · 활성 수별 창 최소폭 1:360 / 2:650 / 3:900(원본 CS_BIND_LAYOUT_MIN_WIDTH).
 *  ★ 메시지(WS4 DB 존재 확인됨): 957 화면 커스터마이징 · 958 최소1개 · 959 표시 · 960 숨김 ·
 *    193 바인딩 필드 · 961 모델 필드 목록 · 962 DESIGN TREE · 963 UI 드롭 대상 · 964 추가 속성 ·
 *    965/966 안내 · 232 적용 · 056 닫기.
 ****************************************************************************/
(function () {
    "use strict";

    var oAPP = window.oAPP;
    if (!oAPP || !oAPP.H) { return; }

    var H = oAPP.H;

    // 활성 수별 창 최소폭 / 기본폭(원본 CS_BIND_LAYOUT_MIN_WIDTH / CS_BIND_LAYOUT_WIDTH).
    var CS_MIN_WIDTH = { 1: 360, 2: 650, 3: 900 };
    var CS_WIDTH = { 1: 560, 2: 900, 3: 1280 };

    /* ── 상태(정규화/영속) ─────────────────────────────────────────────────── */
    function _default() { return { MODEL: true, DESIGN: true, ADDIT: true }; }

    function _count(o) {
        return (o.MODEL === true ? 1 : 0) + (o.DESIGN === true ? 1 : 0) + (o.ADDIT === true ? 1 : 0);
    }

    // 원본 normalizeBindLayoutState 1:1 — 불리언 보정 + ADDIT 단독 금지 + 활성0 기본복귀.
    function _normalize(o) {
        var d = _default(), r = {};
        r.MODEL = (typeof o?.MODEL === "boolean") ? o.MODEL : d.MODEL;
        r.DESIGN = (typeof o?.DESIGN === "boolean") ? o.DESIGN : d.DESIGN;
        r.ADDIT = (typeof o?.ADDIT === "boolean") ? o.ADDIT : d.ADDIT;
        if (r.ADDIT === true && r.MODEL !== true && r.DESIGN !== true) { r.MODEL = true; }
        if (_count(r) === 0) { r = d; }
        return r;
    }

    function _storeKey() {
        var k = oAPP.attr.browserkey || oAPP.attr.SSID || "default";
        return "U4A_BIND_POPUP_LAYOUT_" + k;
    }
    function _load() {
        try {
            var s = localStorage.getItem(_storeKey());
            if (!s) { return _default(); }
            return _normalize(JSON.parse(s));
        } catch (e) { return _default(); }
    }
    function _save(o) {
        try { localStorage.setItem(_storeKey(), JSON.stringify(_normalize(o))); } catch (e) { }
    }

    /* ── 영역/바 DOM ───────────────────────────────────────────────────────── */
    function _els() {
        return {
            left: document.getElementById("bwpLeftPane"),
            center: document.getElementById("bwpCenterPane"),
            right: document.getElementById("bwpRightPane"),
            s1: document.getElementById("bwpSplit1"),   // 좌|중
            s3: document.getElementById("bwpSplit3")    // 중|우
        };
    }

    // 활성 수별 창 크기 반영(원본 applyBindLayoutMinimumWidth 1:1).
    //   최소폭 = CS_MIN_WIDTH[count], 기본폭 = max(최소폭, CS_WIDTH[count]).
    //   bResizeWindow=true(활성 수 변경/최초 적용)면 창을 기본폭으로 강제 리사이즈, 아니면 최소폭 미만일 때만 보정.
    //   최대화/전체화면이면 최소폭만 설정하고 크기조작 skip.
    function _applyMinSize(iCount, bResizeWindow) {
        try {
            var win = oAPP.REMOTE && oAPP.REMOTE.getCurrentWindow && oAPP.REMOTE.getCurrentWindow();
            if (!win || (win.isDestroyed && win.isDestroyed())) { return; }
            var minW = CS_MIN_WIDTH[iCount] || CS_MIN_WIDTH[3];
            var iWidth = Math.max(minW, CS_WIDTH[iCount] || minW);
            var minH = 650;
            if (win.getMinimumSize) { var m = win.getMinimumSize(); if (Array.isArray(m) && m[1] > 0) { minH = m[1]; } }
            if (win.setMinimumSize) { win.setMinimumSize(minW, minH); }
            if (win.isMaximized && win.isMaximized()) { return; }
            if (win.isFullScreen && win.isFullScreen()) { return; }
            if (typeof win.getSize !== "function" || typeof win.setSize !== "function") { return; }
            var s = win.getSize();
            if (!Array.isArray(s)) { return; }
            if (bResizeWindow === true) { win.setSize(iWidth, s[1]); return; }
            if (s[0] < minW) { win.setSize(minW, s[1]); }
        } catch (e) { }
    }

    /************************************************************************
     * 레이아웃 적용 — 원본 applyBindLayoutCustomizing 1:1(활성 영역만 표시 + 폭 재분배).
     *   @param bSave  true면 localStorage 영속(팝업 Apply). 부트 초기적용은 false.
     ************************************************************************/
    oAPP.fn.applyBindLayout = function (bSave) {
        var st = _normalize(oAPP.attr.bindLayout || _load());
        oAPP.attr.bindLayout = st;

        var e = _els();
        if (e.left) { e.left.style.display = st.MODEL ? "" : "none"; }
        if (e.center) { e.center.style.display = st.DESIGN ? "" : "none"; }
        if (e.right) { e.right.style.display = st.ADDIT ? "" : "none"; }

        // 스플리터 바 — 양쪽 이웃이 모두 활성일 때만. 중앙(DESIGN) 숨김 시 s3가 좌|우 구분선 역할.
        if (e.s1) { e.s1.style.display = (st.MODEL && st.DESIGN) ? "" : "none"; }
        if (e.s3) { e.s3.style.display = (st.ADDIT && (st.DESIGN || st.MODEL)) ? "" : "none"; }

        // 채움 대상 — DESIGN(중앙) 활성이면 기본(center flex). 중앙 숨김 시 마지막 활성이 채운다.
        [e.left, e.center, e.right].forEach(function (p) { if (p) { p.classList.remove("u4aBwpFill"); } });
        if (!st.DESIGN) {
            var fill = st.ADDIT ? e.right : e.left;
            if (fill) { fill.classList.add("u4aBwpFill"); }
        }

        // 영속 저장(원본 saveBindLayoutState) — Apply 시 localStorage 에 저장 → 다음 창 오픈 때 복원.
        if (bSave === true) { _save(st); }

        // 창 크기 반영(원본) — 활성 수가 바뀌거나 최초 적용이면 프리셋 폭으로 리사이즈, 아니면 최소폭만.
        var iCount = _count(st);
        var iPrev = oAPP.attr.iBindLayoutActiveCount;
        _applyMinSize(iCount, (typeof iPrev === "undefined" || iPrev !== iCount));
        oAPP.attr.iBindLayoutActiveCount = iCount;

        // 패널 표시/숨김으로 폭 구성이 바뀌었으니 공통 재클램프(드래그로 px 고정된 패널이 넘치지 않게).
        try { if (window.U4AUI && U4AUI.reclampSplitters) { U4AUI.reclampSplitters(); } } catch (e) { }
        // 레이아웃 변경 후 표시 중인 트리 컬럼 재적합(원본 refreshBindLayoutTables — 마지막 컬럼이 잔여폭 흡수).
        try { if (typeof oAPP.fn.refitBindTables === "function") { oAPP.fn.refitBindTables(); } } catch (e) { }

        // MODEL(좌측) 영역 활성 시 좌측 트리 전체 펼침 — 원본 applyBindLayoutCustomizing 의
        //   `if(oState.MODEL) scheduleExpandModelFieldTree()`(index.js:2410) 1:1.
        if (st.MODEL && typeof oAPP.fn.expandModelFieldTree === "function") {
            try { oAPP.fn.expandModelFieldTree(); } catch (e) { }
        }
    };

    // 부트 초기 상태 로드 + 적용(frame.js _bootApp 에서 호출) — 저장된 영역 표시상태 복원(원본 loadBindLayoutState).
    oAPP.fn.initBindLayout = function () {
        oAPP.attr.bindLayout = _load();
        oAPP.fn.applyBindLayout(false);
    };

    /* ── 화면 커스터마이징 팝업 ─────────────────────────────────────────────── */

    // 영역 메타(원본 aLayoutOption) — 제목/설명/아이콘.
    function _areaMeta() {
        return [
            { key: "MODEL", title: H.z("193"), desc: H.z("961"), fa: "table" },       // 바인딩 필드 / 모델 필드 목록
            { key: "DESIGN", title: H.z("962"), desc: H.z("963"), fa: "sitemap" },    // DESIGN TREE / UI 드롭 대상
            { key: "ADDIT", title: H.z("964"), desc: H.z("965"), fa: "rectangle-list" } // 추가 속성 / 함께 표시
        ];
    }

    oAPP.fn.openLayoutCustomizingPopup = function () {
        // 편집 불가(조회 모드)면 열지 않음 — 원본 enabled="{/edit_layout_customizing}".
        if (oAPP.attr.editable === false) { return; }

        var oExist = document.getElementById("bwpLcDlg");
        if (oExist) { try { oExist.close(); oExist.remove(); } catch (e) { } }

        var work = _normalize(oAPP.attr.bindLayout || _load());   // 현재/저장 상태 기준 작업본(Apply 전까지 미반영)
        var aMeta = _areaMeta();
        var oRows = {};   // key → {sw, status}

        var oDlg = document.createElement("dialog");
        oDlg.id = "bwpLcDlg";
        oDlg.className = "u4a-dialog u4aBwpLcDlg";

        // 헤더 — 톱니 아이콘 + 957 + 닫기 X.
        var oHead = H.el("div", "u4a-dialog__header");
        oHead.innerHTML = H.fa("gear") + "<span></span>";
        oHead.querySelector("span").textContent = H.z("957");
        // 198 Help(원본 헤더 도움말) — 도움말 문서(U4A_HELP_DOC_OPEN 브로드캐스트)는 통신 단계(Stage6)에서 배선.
        var oHelp = H.el("button", "u4a-btn-icon");
        oHelp.type = "button";
        oHelp.innerHTML = H.fa("circle-question");
        oHelp.title = H.z("198");
        oHelp.addEventListener("click", function () {
            // [B4] 레이아웃 커스터마이징 다이얼로그 도움말 문서 "000281"(원본 index.js:3121). 영역별 라우팅.
            if (typeof oAPP.fn.onHelp === "function") { try { oAPP.fn.onHelp("000281"); } catch (e) { console.error("[HTML5][bindWindow] onHelp:", e && e.message); } }
        });
        oHead.appendChild(oHelp);

        var oX = H.el("button", "u4a-btn-icon");
        oX.type = "button";
        oX.innerHTML = H.fa("xmark");
        oX.title = H.z("056");
        oX.addEventListener("click", function () { _close(); });
        oHead.appendChild(oX);
        oDlg.appendChild(oHead);

        // 본문 — 영역 3행(아이콘 + 제목/상태/설명 + 스위치) + 안내 스트립.
        var oBody = H.el("div", "u4a-dialog__body u4aBwpLcBody");
        var oList = H.el("div", "u4aBwpLcList");

        aMeta.forEach(function (m) {
            var oRow = H.el("div", "u4aBwpLcRow");

            var oIco = H.el("span", "u4aBwpLcIco");
            oIco.innerHTML = H.fa(m.fa);
            oRow.appendChild(oIco);

            var oTexts = H.el("div", "u4aBwpLcTexts");
            var oTitleWrap = H.el("div", "u4aBwpLcTitleWrap");
            oTitleWrap.appendChild(H.el("span", "u4aBwpLcTitle", m.title));
            var oStat = H.el("span", "u4aBwpLcStat");
            oTitleWrap.appendChild(oStat);
            oTexts.appendChild(oTitleWrap);
            oTexts.appendChild(H.el("span", "u4aBwpLcDesc", m.desc));
            oRow.appendChild(oTexts);

            // 공통 스위치.
            var oSw = H.el("label", "u4a-switch u4aBwpLcSwitch");
            var oIn = document.createElement("input");
            oIn.type = "checkbox";
            oIn.checked = (work[m.key] === true);
            oSw.appendChild(oIn);
            oSw.appendChild(H.el("span", "u4a-switch__slider"));
            oRow.appendChild(oSw);

            oIn.addEventListener("change", function () { _onToggle(m.key, oIn.checked); });

            oRows[m.key] = { sw: oIn, status: oStat };
            oList.appendChild(oRow);
        });

        oBody.appendChild(oList);

        // 안내 스트립(966) — 정보.
        var oNotice = H.el("div", "u4aBwpLcNotice");
        oNotice.innerHTML = H.fa("circle-info");
        oNotice.appendChild(document.createTextNode(" " + H.z("966")));
        oBody.appendChild(oNotice);

        oDlg.appendChild(oBody);

        // 푸터 — [적용(232) 파랑] [닫기(056)].
        var oFoot = H.el("div", "u4a-dialog__footer u4aBwpLcFoot");
        oFoot.appendChild(H.el("span", "u4aBwpToolSpacer"));
        var oApply = H.el("button", "u4a-btn u4a-btn--emphasized");
        oApply.type = "button";
        oApply.innerHTML = H.fa("check");
        oApply.title = H.z("232");
        oApply.addEventListener("click", _apply);
        var oCloseBtn = H.el("button", "u4a-btn u4a-btn--negative");
        oCloseBtn.type = "button";
        oCloseBtn.innerHTML = H.fa("xmark");
        oCloseBtn.title = H.z("056");
        oCloseBtn.addEventListener("click", function () { _close(); });
        oFoot.appendChild(oApply);
        oFoot.appendChild(oCloseBtn);
        oDlg.appendChild(oFoot);

        document.body.appendChild(oDlg);
        _syncStatus();
        // showModal 미지원 등 예외 시 비모달 노출로 대체(이미 append 됐으므로 재append 불필요).
        try { oDlg.showModal(); } catch (e) { try { if (oDlg.show) { oDlg.show(); } else { oDlg.open = true; } } catch (e2) { } }

        // 스위치 상호 보정(원본 fnMakeAreaItem change 1:1).
        function _onToggle(sKey, bOn) {
            if (sKey === "ADDIT") {
                if (bOn === true && work.MODEL !== true && work.DESIGN !== true) {
                    work.MODEL = true;   // ADDIT 단독 금지 → MODEL 강제 ON.
                }
            } else if (bOn === false && work.ADDIT === true) {
                // MODEL/DESIGN 끄는데 ADDIT 켜져있으면 나머지 하나 강제 ON.
                if (sKey === "MODEL" && work.DESIGN !== true) { work.DESIGN = true; }
                if (sKey === "DESIGN" && work.MODEL !== true) { work.MODEL = true; }
            }
            work[sKey] = bOn;
            _syncStatus();
        }

        // 스위치/상태배지 동기화.
        function _syncStatus() {
            aMeta.forEach(function (m) {
                var r = oRows[m.key];
                var bOn = work[m.key] === true;
                if (r.sw.checked !== bOn) { r.sw.checked = bOn; }
                r.status.textContent = bOn ? H.z("959") : H.z("960");   // 표시 / 숨김
                r.status.classList.toggle("u4aBwpLcStat--on", bOn);
            });
        }

        function _apply() {
            if (_count(work) === 0) {
                oAPP.fn.toast(H.z("958"));   // 최소 1개 영역을 선택하세요.
                return;
            }
            oAPP.attr.bindLayout = _normalize(work);
            oAPP.fn.applyBindLayout(true);
            _close();
        }

        function _close() {
            try { oDlg.close(); } catch (e) { }
            try { oDlg.remove(); } catch (e) { }
        }
    };

})();
