/*************************************************************
 * vw_main / view.js  (HTML5)
 *
 * [컨버전 메모]
 *  원본: sap.m.App > sap.m.Page > (CustomHeader: sap.m.Bar[Image,Title,Button x3]) + sap.m.VBox
 *  HTML5: <div.u4aFrame> > <header.u4aFrameHeader>(img+title+win buttons) + <div.u4aFrameBody>
 *  - getView()/getControl() 및 onViewReady 계약은 유지하여 index.js 와 호환.
 *  - 창 제어(min/max/close)는 parent.CURRWIN(Electron) 그대로 호출.
 *************************************************************/

export async function getView() {

    /*************************************************************
     * 📝 컨트롤러 로드
     *************************************************************/
    const oRes = await import("./control.js");
    const oContr = await oRes.getControl();

    /************************************************************************
     * 💖 화면 그리기 (DOM)
     ************************************************************************/

    // 루트 프레임 (구 sap.m.App + Page)
    const ROOT = document.createElement("div");
    ROOT.className = "u4aFrame";

    /* ===== 헤더(타이틀바) 시작 (구 CustomHeader: sap.m.Bar) ===== */
    const HEADER = document.createElement("header");
    HEADER.className = "u4aFrameHeader u4aWsBrowserDraggable";

    // 로고 (구 sap.m.Image)
    const LOGO = document.createElement("img");
    LOGO.className = "u4aFrameLogo";
    LOGO.src = parent.PATHINFO.WS_LOGO;
    LOGO.setAttribute("draggable", "false");
    HEADER.appendChild(LOGO);

    // 타이틀 (구 sap.m.Title)
    const TITLE1 = document.createElement("span");
    TITLE1.className = "u4aFrameTitle";
    TITLE1.textContent = "";
    HEADER.appendChild(TITLE1);
    oContr.ui.WINDOW_TITLE = TITLE1;

    // 우측 윈도우 버튼 영역
    const WINBTNS = document.createElement("div");
    WINBTNS.className = "u4aFrameWinBtns";

    // 최소화 (구 BUTTON1: sap-icon://less)
    const LESS_BTN = document.createElement("button");
    LESS_BTN.className = "u4aFrameWinBtn min";
    LESS_BTN.title = "Minimize";
    LESS_BTN.innerHTML = '<i class="fa-solid fa-window-minimize"></i>';
    LESS_BTN.addEventListener("click", function () {
        parent.CURRWIN.minimize();
    });
    WINBTNS.appendChild(LESS_BTN);
    oContr.ui.LESS_BTN = LESS_BTN;

    // 최대화/복원 (구 BUTTON2 "maxWinBtn": sap-icon://header)
    const MAX_WIN_BTN = document.createElement("button");
    MAX_WIN_BTN.id = "maxWinBtn";
    MAX_WIN_BTN.className = "u4aFrameWinBtn max";
    MAX_WIN_BTN.title = "Maximize";
    MAX_WIN_BTN.innerHTML = '<i class="fa-solid fa-window-maximize"></i>';
    MAX_WIN_BTN.addEventListener("click", function () {

        let bIsMax = parent.CURRWIN.isMaximized();

        if (bIsMax) {
            parent.CURRWIN.unmaximize();
            return;
        }

        parent.CURRWIN.maximize();

    });
    WINBTNS.appendChild(MAX_WIN_BTN);
    oContr.ui.MAX_WIN_BTN = MAX_WIN_BTN;

    // 닫기 (구 BUTTON3 "mainWinClose": sap-icon://decline)
    const CLOSE_BTN = document.createElement("button");
    CLOSE_BTN.id = "mainWinClose";
    CLOSE_BTN.className = "u4aFrameWinBtn close";
    CLOSE_BTN.title = "Close";
    CLOSE_BTN.innerHTML = '<i class="fa-solid fa-xmark"></i>';
    CLOSE_BTN.addEventListener("click", function () {
        oAPP.attr.isPressWindowClose = "X";
        parent.CURRWIN.close();
    });
    WINBTNS.appendChild(CLOSE_BTN);
    oContr.ui.CLOSE_BTN = CLOSE_BTN;

    HEADER.appendChild(WINBTNS);
    ROOT.appendChild(HEADER);
    /* ===== 헤더 끝 ===== */

    // 콘텐츠 바디 (구 sap.m.VBox)
    const BODY = document.createElement("div");
    BODY.className = "u4aFrameBody";
    ROOT.appendChild(BODY);

    oContr.ui.ROOT_PAGE = ROOT;
    oContr.ui.HEADER = HEADER;   // 창 크롬 헤더 (로그인 표시 시 숨김 처리)
    oContr.ui.VBOX1 = BODY;   // 로그인 iframe / WS 페이지가 채워지는 영역
    oContr.ui.APP = ROOT;
    oContr.root = ROOT;

    /*************************************************************
     * @function - #content 에 마운트 (구 APP.placeAt("content"))
     *************************************************************/
    oContr.mount = function (oContentDom) {
        oContentDom.appendChild(ROOT);
    };

    return oContr;

}
