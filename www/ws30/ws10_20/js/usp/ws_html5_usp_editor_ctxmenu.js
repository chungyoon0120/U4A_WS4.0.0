/************************************************************************
 * ws_html5_usp_editor_ctxmenu.js  (HTML5)  — WS30 USP 모나코 에디터 우클릭 컨텍스트 메뉴
 * ----------------------------------------------------------------------
 * 구 sap.m.Menu("uspCDECtxMenu") 다단계(중첩) 메뉴 → 공통 .u4a-menu 스킨(shell.css) 소비 +
 *  캐스케이딩 서브메뉴(플라이아웃)는 화면 스코프(.u4aWs30EditCtxMenu)로 자체 구현(공통 미수정).
 *
 *  [메뉴 구성 — 원본 1:1]  (.analy 04 §5.2/§5.3/§6.1/§6.2)
 *   · 소스 패턴 트리  : DEF_PATT + CUST_PATT JSON(평면 배열) → PKEY/CKEY 로 트리화(최대 4단계).
 *   · 추가 메뉴       : contextMenu/contextMenuInfo.js  →  Code Editor Designer ▸ Theme/Snippet Designer.
 *   (메뉴 정의/순서/구분선[ISSTART]/아이콘[ICON]/라벨[DESC] 보존. DESC 는 데이터/서버 메시지에서
 *    이미 해석된 값을 그대로 표시 — 임의 문구 생성 없음.)
 *
 *  [트리거]  monaco/index.js editor.onContextMenu → parent.oAPP.fn.onEditorContextMenu(oEvent, oParams)
 *   를 호출(보존). 본 모듈이 oAPP.fn.onEditorContextMenu 를 override(원본 ws_usp.js 의 UI5 sap.m.Menu
 *   버전 대체 — 로드 순서상 본 모듈이 뒤라 최종 정의). Monaco 기본 우클릭 메뉴는 index.js 가 끔(contextmenu:false).
 *   · oEvent.clientX/Y 는 iframe 내부 좌표 → iframe rect 로 부모 좌표 보정 후 메뉴 오픈.
 *
 *  [범위]  ★우선 "컨텍스트 메뉴 표시"까지만★. 클릭 동작은 다음 단계:
 *   · 소스 패턴 삽입(CKEY PAT../PTN.. → editor.executeEdits)  → 추후예정
 *   · Theme/Snippet Designer(MENU_MODULES/{CKEY}/index.js)  → 추후예정
 *   · Ctrl+우클릭 전체 패턴 팝업(fnSourcePatternPopupOpener) → 추후예정
 *   미구현 클릭은 console.warn(임의 UI 문구/토스트 금지 — 메시지 키 정책). 단계 핸들러는
 *   oAPP.usphtml.uspEditorCtxAction[CKEY] 에 등록(트리 ctx 의 uspCtxAction 패턴과 동일).
 ************************************************************************/

(function (window, $, oAPP) {
    "use strict";

    var APPCOMMON = oAPP.common;
    oAPP.fn = oAPP.fn || {};
    oAPP.usp = oAPP.usp || {};
    oAPP.usphtml = oAPP.usphtml || {};
    oAPP.usphtml.uspEditorCtxAction = oAPP.usphtml.uspEditorCtxAction || {};   // 단계 구현 핸들러 등록처

    var PATH, FS, PATHINFO;
    try {
        PATH = parent.PATH;
        FS = parent.FS;
        PATHINFO = parent.require(PATH.join(parent.APPPATH, "ws30", "resources", "pathInfo.js"));
    } catch (e) {
        console.error("[HTML5][WS30] editor ctx PATHINFO load error:", e);
    }

    function _esc(s) { return (oAPP.usphtml._esc ? oAPP.usphtml._esc(s) : String(s == null ? "" : s)); }

    // 공통 헤더(타이틀바) 하단 y — 팝업이 브라우저 타이틀바(클릭 불가 영역)를 덮지 않게 클램프(16번 §2.2).
    //   (u4a-ui.js 의 _topChromeBottom 은 비공개 → 동일 로직 인라인. 공통 미변경.)
    function _topChromeBottom() {
        try {
            var el = document.querySelector(".u4a-titlebar");
            if (el) {
                var r = el.getBoundingClientRect();
                if (r.height > 0 && r.top < window.innerHeight * 0.5) { return r.bottom; }
            }
        } catch (e) { }
        return 0;
    }

    /* ====================================================================
     * 아이콘 — 원본 ICON 은 sap-icon:// 또는 svg 파일 경로(패턴 HTML/JS 아이콘).
     *   HTML5: sap-icon 은 메뉴에 등장하는 것만 fa 로 매핑, 파일 경로는 <img>, 그 외/미지정은
     *   빈 자리(정렬용)만 둔다(라벨이 핵심 정보 — 미매핑 아이콘 때문에 메뉴를 깨뜨리지 않는다).
     * ==================================================================== */
    var SAP_FA = {
        "source-code": "file-code",
        "palette": "palette",
        "u4a-fw-solid/code": "code",
        "u4a-fw-solid/compass drafting": "compass-drafting"
    };
    function _iconHtml(sIcon) {
        if (!sIcon) { return '<i class="fa-solid u4aWs30EditCtxIcon"></i>'; }   // 빈 자리(정렬)
        var s = String(sIcon);
        if (s.indexOf("sap-icon://") === 0) {
            var sKey = s.slice("sap-icon://".length).toLowerCase();
            var sFa = SAP_FA[sKey];
            return sFa ? '<i class="fa-solid fa-' + sFa + ' u4aWs30EditCtxIcon"></i>'
                       : '<i class="fa-solid u4aWs30EditCtxIcon"></i>';
        }
        // 파일 경로(svg 등) → img
        return '<img class="u4aWs30EditCtxImg" src="' + _esc(s) + '" alt="">';
    }

    /* ====================================================================
     * 메뉴 데이터 — 구 fnModelBindingUspPattern (FS 패턴 JSON + contextMenuInfo) 의 데이터 부분만.
     *   UI5 모델/parseArrayToTree 의존 제거하고 평면 → 트리(PKEY/CKEY)만 자체 수행(배열 순서 보존).
     * ==================================================================== */
    function _readJson(sPath) {
        try {
            if (FS && sPath) {
                var a = JSON.parse(FS.readFileSync(sPath, "utf-8"));
                return Array.isArray(a) ? a : [];
            }
        } catch (e) {
            console.error("[HTML5][WS30] 패턴 JSON 로드 오류:", sPath, e);
        }
        return [];
    }

    // 추가 메뉴(구 _additionalUspCtxMenu) — contextMenuInfo.js 모듈을 require 해 메뉴 배열 획득.
    function _additionalMenu() {
        try {
            var sPath = PATH.join(PATHINFO.USP_ROOT, "contextMenu", "contextMenuInfo.js");
            var fn = parent.require(sPath);
            var a = (typeof fn === "function") ? fn() : [];
            return Array.isArray(a) ? a : [];
        } catch (e) {
            console.error("[HTML5][WS30] 추가 컨텍스트 메뉴 로드 오류:", e);
            return [];
        }
    }

    function _buildMenuData() {
        if (!PATHINFO) { return []; }
        var aDef = _readJson(PATHINFO.DEF_PATT);
        var aCust = _readJson(PATHINFO.CUST_PATT);
        var aMerge = [].concat(aDef, aCust);
        var aAdd = _additionalMenu();
        if (aAdd.length) { aMerge = aMerge.concat(aAdd); }

        // 평면 → 트리: CKEY 인덱싱 후 PKEY 로 부모에 매단다(순서 보존). 부모 없으면 루트.
        var oByKey = {}, aRoots = [];
        aMerge.forEach(function (o) { if (o && o.CKEY) { o._ch = []; oByKey[o.CKEY] = o; } });
        aMerge.forEach(function (o) {
            if (!o || !o.CKEY) { return; }
            var sPk = o.PKEY || "";
            if (sPk && oByKey[sPk]) { oByKey[sPk]._ch.push(o); }
            else { aRoots.push(o); }
        });
        return aRoots;
    }

    /* ====================================================================
     * 캐스케이딩(중첩) 메뉴 — 공통 .u4a-menu 패널을 레벨별로 띄운다.
     *   _panels[i] = i 레벨 패널(0=루트). 같은/얕은 레벨 항목에 hover 하면 그 아래(깊은) 패널을 닫는다
     *   (타이밍 없는 방식 — 플리커 없음). 바깥 클릭/ESC/스크롤/리사이즈에 전체 닫기(공통 패턴).
     * ==================================================================== */
    var _panels = [];

    function _closeAll() {
        _panels.forEach(function (p) { if (p && p.parentNode) { p.parentNode.removeChild(p); } });
        _panels = [];
        document.removeEventListener("mousedown", _onDocDown, true);
        document.removeEventListener("keydown", _onKey, true);
        window.removeEventListener("scroll", _closeAll, true);
        window.removeEventListener("resize", _closeAll, true);
    }
    function _closeFrom(iLevel) {
        for (var i = _panels.length - 1; i >= iLevel; i--) {
            var p = _panels[i];
            if (p && p.parentNode) { p.parentNode.removeChild(p); }
            _panels.splice(i, 1);
        }
    }
    function _onDocDown(ev) {
        for (var i = 0; i < _panels.length; i++) { if (_panels[i].contains(ev.target)) { return; } }
        _closeAll();
    }
    function _onKey(ev) { if (ev.key === "Escape") { _closeAll(); } }

    // 패널 1개 빌드(레벨 iDepth). 자식 있으면 caret + hover/click 으로 서브패널, 잎이면 click=디스패치.
    function _buildPanel(aItems, iDepth) {
        var oWrap = document.createElement("div");
        oWrap.className = "u4a-menu u4aWs30EditCtxMenu";
        oWrap.setAttribute("role", "menu");

        var bFirst = true;
        aItems.forEach(function (mi) {
            if (!mi) { return; }
            if (mi.ISSTART && !bFirst) {
                var oSep = document.createElement("div");
                oSep.className = "u4a-menu__sep";
                oWrap.appendChild(oSep);
            }
            var bHasCh = !!(mi._ch && mi._ch.length);
            var oItem = document.createElement("div");
            oItem.className = "u4a-menu__item" + (bHasCh ? " u4aWs30EditCtxHasSub" : "");
            oItem.setAttribute("role", "menuitem");
            oItem.innerHTML = _iconHtml(mi.ICON)
                + '<span class="u4a-menu__item-text"></span>'
                + (bHasCh ? '<i class="u4aWs30EditCtxCaret fa-solid fa-chevron-right"></i>' : '');
            oItem.querySelector(".u4a-menu__item-text").textContent = (mi.DESC || "");

            if (bHasCh) {
                oItem.addEventListener("mouseenter", function () { _closeFrom(iDepth + 1); _openSub(oItem, mi._ch, iDepth + 1); });
                oItem.addEventListener("click", function (e) { e.stopPropagation(); _closeFrom(iDepth + 1); _openSub(oItem, mi._ch, iDepth + 1); });
            } else {
                oItem.addEventListener("mouseenter", function () { _closeFrom(iDepth + 1); });
                oItem.addEventListener("click", function (e) { e.stopPropagation(); _closeAll(); _dispatch(mi); });
            }
            oWrap.appendChild(oItem);
            bFirst = false;
        });
        return oWrap;
    }

    // 패널 높이 제한(타이틀바~뷰포트 안) — 패턴이 많을 때 화면 밖으로 넘치지 않게.
    function _clampHeight(oWrap, iTop) {
        var iMax = window.innerHeight - iTop - 8;
        if (iMax < 80) { iMax = 80; }
        oWrap.style.maxHeight = iMax + "px";
        oWrap.style.overflowY = "auto";
    }

    // 루트 패널 — 커서 좌표에 배치(좌우/상하 클램프, 상단=타이틀바 아래).
    function _openRoot(aItems, iX, iY) {
        var oWrap = _buildPanel(aItems, 0);
        oWrap.style.visibility = "hidden";
        document.body.appendChild(oWrap);

        var iW = oWrap.offsetWidth, iH = oWrap.offsetHeight;
        var iVw = window.innerWidth, iVh = window.innerHeight;
        var iTop0 = _topChromeBottom() + 2;

        var iLeft = (iX + iW + 4 <= iVw) ? iX : (iX - iW);
        if (iLeft < 4) { iLeft = 4; }

        var iTop = (iY + iH + 4 <= iVh) ? iY : (iY - iH);
        if (iTop < iTop0) { iTop = iTop0; }
        if (iTop + iH + 4 > iVh) { iTop = Math.max(iTop0, iVh - iH - 4); }

        oWrap.style.left = iLeft + "px";
        oWrap.style.top = iTop + "px";
        _clampHeight(oWrap, iTop);
        oWrap.style.visibility = "";
        _panels.push(oWrap);
    }

    // 서브 패널 — 부모 항목 우측에 배치(오른쪽 공간 부족하면 좌측으로 플립).
    function _openSub(oAnchorItem, aItems, iDepth) {
        var oWrap = _buildPanel(aItems, iDepth);
        oWrap.style.visibility = "hidden";
        document.body.appendChild(oWrap);

        var r = oAnchorItem.getBoundingClientRect();
        var iW = oWrap.offsetWidth, iH = oWrap.offsetHeight;
        var iVw = window.innerWidth, iVh = window.innerHeight;
        var iTop0 = _topChromeBottom() + 2;

        var iLeft = (r.right + iW + 4 <= iVw) ? (r.right - 2) : (r.left - iW + 2);
        if (iLeft < 4) { iLeft = 4; }

        var iTop = r.top - 4;
        if (iTop < iTop0) { iTop = iTop0; }
        if (iTop + iH + 4 > iVh) { iTop = Math.max(iTop0, iVh - iH - 4); }

        oWrap.style.left = iLeft + "px";
        oWrap.style.top = iTop + "px";
        _clampHeight(oWrap, iTop);
        oWrap.style.visibility = "";
        _panels.push(oWrap);
    }

    function _openMenu(iX, iY) {
        _closeAll();
        var aData = _buildMenuData();
        if (!aData.length) {
            console.warn("[HTML5][WS30] 에디터 컨텍스트 메뉴: 표시할 항목 없음(패턴/추가 메뉴 로드 0)");
            return;
        }
        _openRoot(aData, iX, iY);
        document.addEventListener("mousedown", _onDocDown, true);
        document.addEventListener("keydown", _onKey, true);
        window.addEventListener("scroll", _closeAll, true);
        window.addEventListener("resize", _closeAll, true);
    }

    /* ====================================================================
     * 클릭 디스패치 — ★다음 단계★. 등록 핸들러 있으면 실행, 없으면 미구현 로그.
     * ==================================================================== */
    function _dispatch(mi) {
        try {
            var sCKEY = (mi && mi.CKEY) || "";
            var fn = oAPP.usphtml.uspEditorCtxAction[sCKEY];
            if (typeof fn === "function") { fn(mi); return; }
            // 소스 패턴 삽입(PAT*/PTN*) · Theme/Snippet Designer(M001_C*) — 다음 단계.
            console.warn("[HTML5][WS30] 에디터 컨텍스트 메뉴 미구현(다음 단계):", sCKEY, (mi && mi.DESC) || "");
        } catch (e) {
            console.error("[HTML5][WS30] 에디터 컨텍스트 메뉴 실행 오류:", e);
        }
    }

    /* ====================================================================
     * 트리거 — monaco/index.js 가 호출하는 oAPP.fn.onEditorContextMenu override.
     *   (원본 ws_usp.js 의 sap.m.Menu 버전을 대체. 로드 순서상 본 모듈이 뒤.)
     * ==================================================================== */
    oAPP.fn.onEditorContextMenu = function (oEvent, oParams) {
        try {
            if (!oEvent) { return; }

            // 추후 패턴 삽입 핸들러가 쓸 수 있게 현재 우클릭 에디터/모나코 정보 보관(구 oSelectedCtxInfo).
            oAPP.usp.oSelectedCtxInfo = {
                oEditor: oParams && oParams.oEditor,
                oMonaco: oParams && oParams.oMonaco,
                sPageId: oParams && oParams.sPageId
            };

            // Ctrl+우클릭 = 전체 소스 패턴 팝업(fnSourcePatternPopupOpener) — 다음 단계.
            if (oEvent.ctrlKey) {
                console.warn("[HTML5][WS30] 에디터 Ctrl+우클릭 전체 패턴 팝업 — 다음 단계");
                return;
            }

            // iframe 내부 좌표 → 부모 문서 좌표 보정(메뉴는 부모 body 에 그린다).
            var sPageId = (oParams && oParams.sPageId) || "";
            var sCls = (sPageId === "EDITPAGE1") ? "EDITOR_FRAME1"
                     : (sPageId === "EDITPAGE2") ? "EDITOR_FRAME2" : "";
            var iX = oEvent.clientX || 0, iY = oEvent.clientY || 0;
            if (sCls) {
                var ifr = document.querySelector("#uspEditorHost iframe." + sCls);
                if (ifr) {
                    var r = ifr.getBoundingClientRect();
                    iX = r.left + (oEvent.clientX || 0);
                    iY = r.top + (oEvent.clientY || 0);
                }
            }

            _openMenu(iX, iY);
        } catch (e) {
            console.error("[HTML5][WS30] onEditorContextMenu 오류:", e);
        }
    };

    // 화면 이탈/재렌더 시 잔여 메뉴 정리(안전망).
    oAPP.usphtml.closeUspEditorCtxMenu = _closeAll;

})(window, jQuery, oAPP);
