/************************************************************************
 * fnFavIconPopupOpen.js  (HTML5) — WS20 속성 "아이콘 프로퍼티" ★(즐겨찾기) 값도움.
 *
 *   원본: design/js/callFavIconPopup.js (UI5 sap.m.ResponsivePopover + favIconPopup iframe).
 *   개편: 크롬(팝오버)만 공통 .u4a-dialog "모달"로 교체.
 *         데이터 로직(테마/폰트 링크/확장아이콘/IconPool content 해석)·iframe 커스텀
 *         이벤트 I/F·아이콘 폰트 렌더는 원본을 그대로 이식(큰 틀·로직 유지).
 *
 *   SSOT=.analy/16 (.u4a-dialog §2.x, showModal, 헤더 드래그/리센터/리사이즈 공통).
 *   - 색: 의미 토큰만(--surface/--line/--text/--text-muted/--state-info).
 *   - 문구: 메시지 키만(078/079/365/271/272/A39).
 *
 *   iframe 콘텐츠(design/favIconPopup/index.html·index.js)는 SAP 아이콘 폰트를 로드해
 *   즐겨찾기 아이콘을 렌더한다 → 임의 SAP 아이콘 정확 렌더를 위해 iframe 유지가 필수.
 ************************************************************************/
(function () {
    "use strict";

    //즐겨찾기 팝업 ↔ 즐겨찾기 리스트(iframe) I/F 커스텀 이벤트명(원본과 동일).
    const C_IF_FAV_ICON_EVT = "IF_FAV_ICON_EVT";

    const C_DLG_ID = "u4aFavIconDlg";

    //팝업 UI/컨텍스트 광역화.
    var loApp = { ui: {}, attr: {} };


    /* ── 소형 헬퍼 ───────────────────────────────────────────── */
    function _el(sTag, sCls) { var e = document.createElement(sTag); if (sCls) { e.className = sCls; } return e; }
    function _fa(sName) { return '<i class="fa-solid fa-' + sName + '"></i>'; }

    function _glangu() { try { return oAPP.oDesign.settings.GLANGU; } catch (e) { return ""; } }

    //ZMSG_WS_COMMON_001 메시지(078/079 등).
    function _wsCommon(sId, p1) {
        try { return parent.WSUTIL.getWsMsgClsTxt(_glangu(), "ZMSG_WS_COMMON_001", sId, p1 || "", "", "", ""); }
        catch (e) { return ""; }
    }
    //  /U4A/MSG_WS 메시지(271/272/365).
    function _msgWs(sId, p1) {
        try { return oAPP.common.fnGetMsgClsText("/U4A/MSG_WS", sId, p1 || "", "", "", ""); }
        catch (e) { return ""; }
    }
    //  /U4A/CL_WS_COMMON 메시지(A39 Close).
    function _clsWs(sId) {
        try { return oAPP.common.fnGetMsgClsText("/U4A/CL_WS_COMMON", sId, "", "", "", ""); }
        catch (e) { return ""; }
    }
    //공통 정중앙 토스트(원본 parent.showMessage(sap,...) → HTML5 는 첫 인자 null).
    function _toast(sType, sMsg) { try { parent.showMessage(null, 10, sType, sMsg); } catch (e) { } }


    /************************************************************************
     * [PUBLIC] 즐겨찾기 아이콘 값도움 모달 열기.
     *   @param {object}   is_attr  대상 속성 행(선택 아이콘을 UIATV 에 반영).
     *   @param {function} f_cb     아이콘 선택 콜백. f_cb(ICON_SRC).
     ************************************************************************/
    oAPP.fn.fnFavIconPopupOpen = function (is_attr, f_cb) {

        if (!is_attr) { return; }

        //접속 SYSID 별 즐겨찾기 아이콘 목록(로컬 JSON).
        var sSysId = "";
        try { sSysId = parent.getUserInfo().SYSID; } catch (e) { }

        var aFav = [];
        try { aFav = parent.WSUTIL.getIconFavorite(sSysId) || []; } catch (e) { aFav = []; }

        //즐겨찾기 항목이 없으면 안내(079 &1 does not exist / &1 = 078 Icon favorite list) 후 종료.
        if (aFav.length === 0) {
            var sNo = "";
            try {
                sNo = parent.WSUTIL.getWsMsgClsTxt(_glangu(), "ZMSG_WS_COMMON_001", "079", _wsCommon("078"), "", "", "");
            } catch (e) { sNo = _wsCommon("078"); }
            _toast("E", sNo);
            return;
        }

        //컨텍스트 광역화.
        loApp.attr.is_attr = is_attr;
        loApp.attr.f_cb = f_cb;
        loApp.attr.T_ICON = aFav;

        //이미 생성된 다이얼로그가 살아있으면 재사용.
        if (loApp.ui.dlg && document.body.contains(loApp.ui.dlg)) {
            if (loApp.ui.dlg.open) { return; }
            _loadFrame();
            _showModal();
            return;
        }

        _build();
        _loadFrame();
        _showModal();
    };


    /* ── 모달 open ──────────────────────────────────────────── */
    function _showModal() {
        try { loApp.ui.dlg.showModal(); } catch (e) { }
        //원본 afterOpen: 테마 변경 구독(팝업 열린 동안 iframe 테마 동기화).
        _attachTheme();
    }

    function _close() {
        //원본 afterClose: 테마 변경 구독 해제.
        _detachTheme();
        try { loApp.ui.dlg.close(); } catch (e) { }
    }


    /* ── 테마 변경 동기화(원본 sap.ui.getCore().attach/detachThemeChanged →
     *    HTML5 U4ATheme.onChange = window 'u4a-theme-changed' 이벤트) ── */
    function _onThemeChanged() {
        var _p = { ACTCD: "THEME_CHANGE" };
        try { _p.S_THEME = parent.getThemeInfo(); } catch (e) { _p.S_THEME = {}; }
        _sendToChild(_p);
    }

    function _attachTheme() {
        if (loApp.attr._themeBound) { return; }   //재오픈 중복 등록 방지.
        //테마 변경 이벤트는 셸(parent)에서 발생 — parent 우선, 로컬도 안전망으로 구독.
        try { if (parent && parent.addEventListener) { parent.addEventListener("u4a-theme-changed", _onThemeChanged); } } catch (e) { }
        try { window.addEventListener("u4a-theme-changed", _onThemeChanged); } catch (e) { }
        loApp.attr._themeBound = true;
    }

    function _detachTheme() {
        if (!loApp.attr._themeBound) { return; }
        try { if (parent && parent.removeEventListener) { parent.removeEventListener("u4a-theme-changed", _onThemeChanged); } } catch (e) { }
        try { window.removeEventListener("u4a-theme-changed", _onThemeChanged); } catch (e) { }
        loApp.attr._themeBound = false;
    }


    /************************************************************************
     * 다이얼로그 1회 생성(.u4a-dialog 공통 골격).
     ************************************************************************/
    function _build() {

        _ensureStyle();

        var oDlg = _el("dialog", "u4a-dialog u4aFavDlg");
        oDlg.id = C_DLG_ID;

        //── 헤더(078 Icon favorite list + 닫기 X) ──
        var oHead = _el("div", "u4a-dialog__header");
        oHead.innerHTML = _fa("star") + "<span></span>";
        oHead.querySelector("span").textContent = _wsCommon("078");

        var oX = _el("button", "u4a-btn-icon");
        oX.type = "button";
        oX.innerHTML = _fa("xmark");
        oX.title = _clsWs("A39");
        oX.addEventListener("click", _close);
        oHead.appendChild(oX);

        oDlg.appendChild(oHead);

        //── 바디(365 힌트 + 즐겨찾기 iframe) ──
        var oBody = _el("div", "u4a-dialog__body u4aFavBody");

        //365  Double-click the line in the icon list to add an icon.
        var oHint = _el("div", "u4aFavHint");
        oHint.innerHTML = _fa("circle-info") + "<span></span>";
        oHint.querySelector("span").textContent = _msgWs("365");
        oBody.appendChild(oHint);

        var oFrameWrap = _el("div", "u4aFavFrameWrap");
        var oFrame = document.createElement("iframe");
        oFrame.className = "u4aFavFrame";
        //iframe title 미부여 — 부여 시 콘텐츠 전체 hover 에 불필요한 네이티브 툴팁이 뜬다.
        oFrameWrap.appendChild(oFrame);
        oBody.appendChild(oFrameWrap);

        oDlg.appendChild(oBody);

        //── 푸터(닫기) ──
        var oFoot = _el("div", "u4a-dialog__footer");
        oFoot.appendChild(_el("span", "u4aFavFootSp"));

        var oClose = _el("button", "u4a-btn u4a-btn--negative");
        oClose.type = "button";
        oClose.innerHTML = _fa("xmark") + "<span></span>";
        oClose.querySelector("span").textContent = _clsWs("A39");
        oClose.addEventListener("click", _close);
        oFoot.appendChild(oClose);

        oDlg.appendChild(oFoot);

        //ESC(cancel) → 닫기.
        oDlg.addEventListener("cancel", function (e) { e.preventDefault(); _close(); });

        //iframe(child) → 부모 커스텀 이벤트 수신(호스트 = dialog). 원본 팝오버 DOM 수신과 동일.
        oDlg.addEventListener(C_IF_FAV_ICON_EVT, _onFavIconEvt);

        //공통 드래그/리센터 + 리사이즈.
        //  헤더 드래그·grip 리사이즈 모두 공통이 body.u4a-dragging 을 토글 →
        //  shell.css `body.u4a-dragging iframe{pointer-events:none}`(§4.3)로 iframe 위에서도 안 끊긴다.
        if (window.U4AUI && U4AUI.makeDialogRecenter) { U4AUI.makeDialogRecenter(oDlg, oHead); }
        if (window.U4AUI && U4AUI.makeDialogResizable) { U4AUI.makeDialogResizable(oDlg, { minW: 360, minH: 320 }); }

        document.body.appendChild(oDlg);

        loApp.ui.dlg = oDlg;
        loApp.ui.frame = oFrame;
    }


    /************************************************************************
     * 즐겨찾기 iframe 로드(원본 afterOpen iframe 생성 대응).
     *   onload 시 팝업(다이얼로그) DOM ID 를 child 에 매핑 → child 가 FRAME_LOADED
     *   를 fire → _setFavListData 로 초기 데이터 전송.
     ************************************************************************/
    function _loadFrame() {

        var oFrame = loApp.ui.frame;
        if (!oFrame) { return; }

        var sSrc = "";
        try { sSrc = parent.PATH.join(oAPP.oDesign.pathInfo.designRootPath, "favIconPopup", "index.html"); }
        catch (e) { sSrc = ""; }

        oFrame.onload = function () {
            try { this.contentWindow.PARENT_DOM_ID = loApp.ui.dlg.id; } catch (e) { }
        };

        //재사용 시에도 새로 로드(FRAME_LOADED → SET_INIT 재수행).
        oFrame.src = sSrc;
    }


    /************************************************************************
     * iframe I/F 수신(원본 lf_FavIconCustomEvent).
     ************************************************************************/
    function _onFavIconEvt(oEvent) {

        switch (oEvent && oEvent.detail && oEvent.detail.ACTCD) {

            case "FAV_ICON_LIST_FRAME_LOADED":
                //즐겨찾기 리스트 iframe 로드됨 → 초기 데이터 전송.
                _setFavListData();
                break;

            case "FAV_ICON_LIST_SEL_LINE":
                //아이콘 선택(더블클릭).
                _selLine(oEvent.detail);
                break;

            case "FAV_ICON_CLIP_TXT_COPY":
                //아이콘명 클립보드 복사.
                _copyText(oEvent.detail);
                break;

            case "BUSY_ON":
                //원본 lf_FavIconCustomEvent BUSY_ON: setBusy("X") + 단축키 잠금.
                try { parent.setBusy("X"); } catch (e) { }
                try { if (typeof oAPP.fn.setShortcutLock === "function") { oAPP.fn.setShortcutLock(true); } } catch (e) { }
                break;

            case "BUSY_OFF":
                //원본 lf_FavIconCustomEvent BUSY_OFF: 단축키 잠금 해제 + setBusy("").
                try { if (typeof oAPP.fn.setShortcutLock === "function") { oAPP.fn.setShortcutLock(false); } } catch (e) { }
                try { parent.setBusy(""); } catch (e) { }
                break;

            default:
                break;
        }
    }


    //child(iframe) 로 데이터 전송(원본 lf_sendDataToChild).
    function _sendToChild(oData) {
        var oFrame = loApp.ui.frame;
        if (!oFrame || !oFrame.contentDocument || !oFrame.contentDocument.body) { return; }
        oFrame.contentDocument.body.dispatchEvent(new CustomEvent(C_IF_FAV_ICON_EVT, { detail: oData }));
    }


    /************************************************************************
     * 초기 리스트 구성 전송(원본 lf_setFavListData).
     ************************************************************************/
    function _setFavListData() {

        var _p = {};
        _p.ACTCD = "SET_INIT_FAV_LIST";

        //UI5에 적용된 테마 정보.
        try { _p.S_THEME = parent.getThemeInfo(); } catch (e) { _p.S_THEME = {}; }

        //CSS 링크(폰트 로드용).
        _p.T_CSS = _setFavIconListCSSLink();

        //U4A extension 아이콘 폰트.
        _p.T_STYLE = _setExtensionIconList();

        //즐겨찾기 아이콘 리스트(content/fontFamily 해석 포함).
        _p.T_ICON_LIST = _setFavIconList();

        //화면 문구(검색 placeholder=294 / 결과없음=174) — 임의 문자열 금지, 메시지키만.
        _p.S_TXT = { search: _msgWs("294"), noResult: _msgWs("174") };

        _sendToChild(_p);
    }


    /************************************************************************
     * U4A extension Icon 항목 구성(원본 lf_setExtensionIconList).
     ************************************************************************/
    function _setExtensionIconList() {

        var out = [];

        var aUA053 = (oAPP.attr.S_CODE && oAPP.attr.S_CODE.UA053) || [];
        var list = aUA053.filter(function (it) { return it.FLD04 !== "X"; });

        if (list.length === 0) { return out; }

        var prePath = ""; try { prePath = parent.getHost(); } catch (e) { }

        for (var i = 0; i < list.length; i++) {
            var u = list[i];
            out.push({
                collectionName: u.FLD01,
                fontFamily: u.FLD02,
                //자격증명(sap-user/sap-password) URL 파라미터 미부착 — Electron 세션 쿠키로 인증.
                fontURI: "" + prePath + u.FLD03 + "/" + u.FLD02 + ".woff2"
            });
        }

        return out;
    }


    /************************************************************************
     * URL 앞부분 구성(원본 lf_setURLPrePath).
     ************************************************************************/
    function _setURLPrePath() {

        var host = ""; try { host = parent.getHost(); } catch (e) { }
        if (!host) { return ""; }

        var aUA025 = (oAPP.attr.S_CODE && oAPP.attr.S_CODE.UA025) || [];
        var s = aUA025.find(function (it) { return it.FLD01 === "APP" && it.FLD06 === "X"; });
        if (!s) { return ""; }

        var libPath = "" + (s.FLD04 || "") + (s.FLD05 || "");
        libPath = libPath.replace(/sap-ui-core.js/, "");

        return "" + host + libPath;
    }


    /************************************************************************
     * 즐겨찾기 아이콘 CSS Link 구성(원본 lf_setFavIconListCSSLink).
     ************************************************************************/
    function _setFavIconListCSSLink() {

        var links = [];

        var prePath = _setURLPrePath();

        var theme = "";
        try { theme = (parent.getThemeInfo() && parent.getThemeInfo().THEME) || ""; } catch (e) { }

        var aUA007 = (oAPP.attr.S_CODE && oAPP.attr.S_CODE.UA007) || [];

        //1.120.21 이후 패치의 경우 허용 가능 테마 필드값.
        var FLD03 = "";
        try { if (oAPP.common.checkWLOList("C", "UHAK900889") === true) { FLD03 = "X"; } } catch (e) { }

        //현재 테마가 미리보기 사용 가능 테마가 아니면 default 로 대체(원본 로직 1:1).
        if (aUA007.findIndex(function (it) { return it.FLD01 === theme && it.FLD03 === FLD03; }) === -1) {

            var defTheme = (aUA007.find(function (it) { return it.FLD02 === "X" && it.FLD03 === FLD03; }) || {}).FLD01 || "sap_horizon";
            theme = defTheme;

            var up = String(theme).toUpperCase();
            var kw = "SAP_";
            if (up.indexOf("DARK") !== -1) { kw = "DARK"; }

            theme = (aUA007.find(function (it) { return String(it.FLD01).toUpperCase().indexOf(kw) !== -1 && it.FLD03 === FLD03; }) || {}).FLD01 || defTheme;
        }

        //자격증명(sap-user/sap-password) URL 파라미터 미부착 — Electron 세션 쿠키로 인증.
        links.push({ id: "sap-ui-theme-sap.ui.core", href: prePath + "sap/ui/core/themes/" + theme + "/library.css" });
        links.push({ id: "sap-ui-theme-sap.ushell", href: prePath + "sap/ushell/themes/" + theme + "/library.css" });
        links.push({ id: "sap-ui-theme-sap.tnt", href: prePath + "sap/tnt/themes/" + theme + "/library.css" });

        return links;
    }


    /************************************************************************
     * 즐겨찾기 아이콘 리스트(content/fontFamily 해석)(원본 lf_setFavIconList).
     *   미리보기 iframe(oAPP.attr.ui.frame)의 UI5 IconPool 로 아이콘 content 를 해석.
     ************************************************************************/
    function _setFavIconList() {

        var out = [];

        var T = loApp.attr.T_ICON || [];
        if (T.length === 0) { return out; }

        //미리보기 iframe 의 IconPool(없으면 content 미해석 — 크래시 없이 진행).
        var IP = null;
        try { IP = oAPP.attr.ui.frame.contentWindow.sap.ui.core.IconPool; } catch (e) { IP = null; }

        //IconPool 미존재(미리보기/UI5 미로드) — 아이콘 glyph 가 빈 채로 렌더될 수 있어 실패를 드러낸다.
        if (!IP) { console.warn("[HTML5][WS20][favIcon] 미리보기 IconPool 미존재 — 아이콘 content 미해석(빈 glyph 가능)"); }

        for (var i = 0; i < T.length; i++) {

            var ic = T[i];

            var row = {
                ICON_NAME: ic.ICON_NAME,
                ICON_SRC: ic.ICON_SRC,
                fontFamily: "",
                content: ""
            };

            if (IP) {
                var info = null;
                try { info = IP.getIconInfo(row.ICON_SRC); } catch (e) { info = null; }
                if (info) {
                    row.fontFamily = info.fontFamily;
                    row.content = info.content;
                }
            }

            out.push(row);
        }

        return out;
    }


    /************************************************************************
     * 아이콘 선택 → 속성값 반영(원본 lf_selLine).
     ************************************************************************/
    function _selLine(oData) {

        if (!oData || !oData.sList || oData.sList.ICON_SRC == null) { return; }

        //콜백 없으면 종료.
        if (typeof loApp.attr.f_cb !== "function") { _close(); return; }

        //선택 아이콘 src 를 콜백으로 전달(속성값 반영은 호출측 책임).
        loApp.attr.f_cb(oData.sList.ICON_SRC);

        //팝업 종료.
        _close();

        //271  &1 has been selected.
        _toast("I", _msgWs("271", oData.sList.ICON_SRC));
    }


    /************************************************************************
     * 아이콘명 클립보드 복사(원본 lf_ClipBoardCopyText).
     ************************************************************************/
    function _copyText(oData) {

        if (!oData || !oData.sList || oData.sList.ICON_SRC == null) { return; }

        try { parent.setClipBoardTextCopy(oData.sList.ICON_SRC); } catch (e) { }

        //272  &1 has been copied.
        _toast("S", _msgWs("272", oData.sList.ICON_SRC));
    }


    /************************************************************************
     * 스코프 스타일 1회 주입(공통 .u4a-dialog 위에 크기/iframe/힌트만 덧댐).
     ************************************************************************/
    function _ensureStyle() {

        if (document.getElementById("u4aFavDlgStyle")) { return; }

        var css =
            ".u4aFavDlg { width: min(600px, 92vw); height: min(70vh, 640px); }" +
            ".u4aFavDlg .u4a-dialog__header { cursor: move; user-select: none; }" +
            ".u4aFavDlg .u4a-dialog__header span { flex: 1 1 auto; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }" +
            ".u4aFavDlg .u4a-dialog__body.u4aFavBody { display: flex; flex-direction: column; gap: 0.5rem; min-height: 0; padding: 0.5rem 0.75rem 0.75rem; }" +
            ".u4aFavHint { flex: 0 0 auto; display: flex; align-items: center; gap: 0.375rem; font-size: 0.8125rem; color: var(--text-muted); }" +
            ".u4aFavHint i { color: var(--state-info); }" +
            ".u4aFavFrameWrap { flex: 1 1 auto; min-height: 0; border: 1px solid var(--line); border-radius: 0.375rem; overflow: hidden; background: var(--surface); }" +
            ".u4aFavFrame { display: block; width: 100%; height: 100%; border: 0; }" +
            ".u4aFavFootSp { flex: 1 1 auto; }";

        var st = document.createElement("style");
        st.id = "u4aFavDlgStyle";
        st.textContent = css;
        document.head.appendChild(st);
    }

})();
