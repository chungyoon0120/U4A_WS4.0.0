/*************************************************************
 * vw_main / control.js  (HTML5)
 *
 * [컨버전 메모]
 *  원본: sap.ui.model.json.JSONModel, sap.m.MessageToast, EventBus, sap.ui.core.HTML(iframe) 사용.
 *  HTML5: UI5 의존 제거.
 *   - 모델 → 단순 상태 객체(oContr.attr.oState)
 *   - MessageToast → 간이 토스트 DOM
 *   - sap.ui.core.HTML(iframe) → <iframe> 직접 생성
 *   - 창 maximize/unmaximize 이벤트로 최대화 버튼 표시 토글
 *  Electron/Node 연동(parent.CURRWIN, getUserInfo, PATH/PATHINFO, library-preload)은 그대로 유지.
 *************************************************************/

export async function getControl() {

    /******************************************************************************
     *  💖 DATA / ATTRIBUTE 선언부
     ******************************************************************************/

    const oContr = {};
    oContr.msg = {};
    oContr.ui = {};
    oContr.fn = {};
    oContr.types = {};
    oContr.attr = {};
    oContr.events = {};

    // I/F 파라미터 구조
    oContr.attr.IF_DATA = {};

    // 현재 뷰의 이름
    oContr.attr.VIEW_NAME = "main";

    // (구 JSONModel 대체) 단순 상태 객체
    oContr.attr.oState = {};


    /************************************************************************
     * 현재 브라우저의 이벤트 핸들러 (최대화/복원 시 버튼 표시 토글)
     ************************************************************************/
    function _attachCurrentWindowEvents() {

        let oMaxWinBtn = oContr.ui.MAX_WIN_BTN;

        parent.CURRWIN.on("maximize", () => {
            oMaxWinBtn.innerHTML = '<i class="fa-solid fa-window-restore"></i>';
            oMaxWinBtn.title = "Restore";
        });

        parent.CURRWIN.on("unmaximize", () => {
            oMaxWinBtn.innerHTML = '<i class="fa-solid fa-window-maximize"></i>';
            oMaxWinBtn.title = "Maximize";
        });

    } // end of _attachCurrentWindowEvents


    /*************************************************************
     * @function - Busy
     *************************************************************/
    oContr.fn.setBusy = function (sBusy) {
        oAPP.fn?.setBusy ? oAPP.fn.setBusy(sBusy) : setBusy(sBusy);
    };


    /*************************************************************
     * @function - 메시지 토스트 출력 (구 sap.m.MessageToast)
     *************************************************************/
    oContr.fn.showMsgToast = function (sMsg) {

        let oToast = document.createElement("div");
        oToast.className = "u4aWsToast";
        oToast.textContent = sMsg;
        oToast.style.cssText =
            "position:fixed;left:50%;bottom:48px;transform:translateX(-50%);" +
            "background:rgba(0,0,0,0.8);color:#fff;padding:8px 16px;border-radius:16px;" +
            "font-size:13px;z-index:99999;pointer-events:none;transition:opacity .4s;";

        document.body.appendChild(oToast);

        setTimeout(() => {
            oToast.style.opacity = "0";
            setTimeout(() => oToast.remove(), 400);
        }, 2500);

    };


    /*************************************************************
     * @function - 로그인 페이지를 로드한다. (구 sap.ui.core.HTML iframe)
     *************************************************************/
    function _loadLoginPage() {

        let URL = require('url');

        let sLoginPath = URL.pathToFileURL(PATH.join(PATHINFO.WS10_20_ROOT, "Login", "Login.html")).href;

        // [흰색 방지] 로그인 iframe 에도 설정 테마/배경색을 넘겨, 첫 페인트부터 테마 배경이 되게 한다
        //   (Login.html head 가 --boot-bg + U4ATheme.apply 로 동기 소비).
        try {
            var ti = parent.getThemeInfo && parent.getThemeInfo();
            if (ti) {
                var qp = new URLSearchParams();
                if (ti.THEME) { qp.set("THEME", ti.THEME); }
                if (ti.BGCOL) { qp.set("BGCOL", ti.BGCOL); }
                var qs = qp.toString();
                if (qs) { sLoginPath += (sLoginPath.indexOf("?") >= 0 ? "&" : "?") + qs; }
            }
        } catch (e) { /* noop */ }

        // ★ 창 드래그 근본 해결: 로그인은 iframe 안에 있어 자체 타이틀바를 그리면
        //   iframe 내부 -webkit-app-region:drag 가 창 리사이즈 후 죽는다(알려진 버그).
        //   → 로그인은 콘텐츠 전용으로 두고, 창 크롬(로고/제목/min·max·close/드래그)은
        //     "최상위 문서" 헤더(.u4aFrameHeader)가 담당한다. 따라서 헤더를 숨기지 않고
        //     표시하고 제목만 로그인용으로 바꾼다.
        if (oContr.ui.HEADER) {
            oContr.ui.HEADER.style.display = "";
        }
        if (oContr.ui.WINDOW_TITLE) {
            oContr.ui.WINDOW_TITLE.textContent = "U4A Workspace - Login";
        }

        let oIframe = document.createElement("iframe");
        oIframe.src = sLoginPath;
        oIframe.style.cssText = "border:none;width:100%;height:100%;display:block;";

        // iframe DOM 삽입으로 stale 된 드래그 영역을 강제 재계산(1px 리사이즈→원복).
        oIframe.addEventListener("load", function () {
            setTimeout(_kickHostDragRegion, 50);
        });

        oContr.ui.VBOX1.appendChild(oIframe);

    } // end of _loadLoginPage


    /*************************************************************
     * ★ 드래그 영역 재계산 (iframe 삽입/교체 후 stale 우회)
     * ----------------------------------------------------------
     *  증상: 로그인 iframe 삽입 후 최상위 헤더(.u4aFrameHeader)의 -webkit-app-region
     *        드래그가 안 먹다가, 창을 한번 최대화→복원하면 풀린다.
     *  원인: iframe DOM 변경으로 Electron 의 드래그 영역 캐시가 stale.
     *  해결: 창을 1px 살짝 키웠다 두 프레임 뒤 원복 → OS 에 '분리된 리사이즈'를 흘려
     *        드래그 영역을 강제 재계산(수동 최대화→복원과 동일 효과).
     *  (참고: u4a-ws-40 커밋 7e7f98d _kickHostDragRegion)
     *************************************************************/
    function _kickHostDragRegion() {
        try {
            let oWin = parent.CURRWIN;
            if (!oWin || oWin.isDestroyed()) { return; }
            if (oWin.isMaximized() || oWin.isFullScreen()) { return; }   // 이미 리사이즈 상태면 불필요
            let b = oWin.getBounds();
            oWin.setBounds({ x: b.x, y: b.y, width: b.width + 1, height: b.height + 1 });
            requestAnimationFrame(function () {
                requestAnimationFrame(function () {
                    try { if (!oWin.isDestroyed()) { oWin.setBounds(b); } } catch (_) { /* noop */ }
                });
            });
        } catch (_) { /* noop */ }
    } // end of _kickHostDragRegion


    /*************************************************************
     * @function - 화면이 로드 될때 타는 이벤트
     *************************************************************/
    oContr.onViewReady = async function (IF_DATA) {

        // 현재 브라우저의 이벤트 핸들러
        _attachCurrentWindowEvents();

        // 초기 설정
        await oContr.fn.onInit(IF_DATA);

    }; // end of oContr.onViewReady


    /*************************************************************
     * @function - 초기 설정
     *************************************************************/
    oContr.fn.onInit = async function (IF_DATA) {

        // [중요] 창을 먼저 보이게 한 뒤 컨텐츠를 로드한다(WS3.0 동작).
        //   프레임리스 창의 -webkit-app-region: drag 영역은 창이 표시된 상태에서
        //   컨텐츠(로그인 iframe 타이틀바)가 렌더되며 계산된다. 표시를 iframe 로드 뒤로
        //   미루면 최대화 상태에서 drag 영역이 등록되지 않아 헤더 드래그가 안 먹는다.
        //   (흰색 플래시는 --boot-bg 동기 캔버스로 이미 방지됨)
        parent.CURRWIN.setOpacity(1.0);
        parent.CURRWIN.show();

        // 로그인 여부 분기
        let oUserInfo = parent.getUserInfo();
        if (!oUserInfo) {

            oContr.ui.WINDOW_TITLE.textContent = "U4A Workspace - Login";

            _loadLoginPage();

            return;
        }

        // WS30 메인 페이지 로드하기
        oContr.fn.loadWS30MainPage();

    }; // end of oContr.fn.onInit


    /*************************************************************
     * @function - WS30 메인 페이지 로드하기 (구 APP.destroy → library-preload 주입)
     *************************************************************/
    oContr.fn.loadWS30MainPage = async function () {

        document.getElementById("content").style.display = "none";

        // 구 vw_main 프레임 제거
        if (oContr.root && oContr.root.parentNode) {
            oContr.root.parentNode.removeChild(oContr.root);
        }

        let oScript = document.createElement("script");
        oScript.src = "./js/library-preload.js";

        document.body.appendChild(oScript);

    }; // end of oContr.fn.loadWS30MainPage

    return oContr;

}
