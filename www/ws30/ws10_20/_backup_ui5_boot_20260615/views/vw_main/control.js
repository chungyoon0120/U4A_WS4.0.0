export async function getControl() {

    /******************************************************************************
     *  💖 LIBRARY LOAD 선언부
     ******************************************************************************/

    sap.ui.getCore().loadLibrary("sap.m");
    sap.ui.getCore().loadLibrary("sap.f");
    sap.ui.getCore().loadLibrary("sap.ui.layout");

    jQuery.sap.require("sap.m.MessageBox");

    /******************************************************************************
     *  💖 DATA / ATTRIBUTE 선언부
     ******************************************************************************/

    const
        oContr = {};
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

    // 이벤트 버스 객체
    oContr.attr.oEventBus = sap.ui.getCore().getEventBus();

    oContr.oModel = new sap.ui.model.json.JSONModel({



    });

    oContr.oModel.setSizeLimit(Infinity);


    oContr.fn.setBusy = function (sBusy) {
        oAPP.fn.setBusy(sBusy);
    };


    /*************************************************************
     * @function - 이벤트 버스의 onMessage
     *************************************************************/
    function _eventBusOnMessage(a, b, c) {

        debugger;

    } // end of _eventBusOnMessage


    /*************************************************************
     * @function - 이벤트 버스 등록하기
     *************************************************************/
    function _attachEventBus() {

        const oEventBus = sap.ui.getCore().getEventBus();

        // 이벤트 등록.
        oEventBus.subscribe(oContr.attr.VIEW_NAME, "onMessage", _eventBusOnMessage)


    } // end of _attachEventBus


    /*************************************************************
     * @function - 로그인 페이지를 로드한다.
     *************************************************************/
    async function _loadLoginPage() {

        let URL = require('url');

        let sLoginPath = URL.pathToFileURL(PATH.join(PATHINFO.WS10_20_ROOT, "Login", "Login.html")).href;

        let sFrameHtml = `<iframe src="${sLoginPath}" style="border:none;width:100%;height:100%;"></iframe>`;

        let oHTML = new sap.ui.core.HTML({
            content: sFrameHtml
        });

        oContr.ui.VBOX1.addItem(oHTML);

    }; // end of _loadLoginPage



    /******************************************************************************
     * 💖  PUBLIC EVENT FUNCTION 선언부 (로그인)
     ******************************************************************************/


    /*************************************************************
     * @function - 메시지 토스트 출력
     *************************************************************/
    oContr.fn.showMsgToast = function (sMsg) {
        sap.m.MessageToast.show(sMsg);
    };


    /*************************************************************
     * @function - 화면이 로드 될때 타는 이벤트
     *************************************************************/
    oContr.onViewReady = async function (IF_DATA) {

        // 창 타이틀/컨트롤(min·max·close) 및 maximize 아이콘 동기화는
        // 로그인 화면의 자체 HTML5 타이틀바(Login.js)에서 처리한다.

        // 이벤트 버스 등록하기
        _attachEventBus();

        // 초기 설정
        await oContr.fn.onInit(IF_DATA);

    }; // end of oContr.onViewReady


    /*************************************************************
    * @function - 초기 설정    
    *************************************************************/
    oContr.fn.onInit = async function (IF_DATA) {

        parent.CURRWIN.setOpacity(1.0);

        parent.CURRWIN.show();

        // 오류처리 할때 처리될 내용들....

        // 여기서 분기 처리..
        let oUserInfo = parent.getUserInfo();
        if (!oUserInfo) {

            _loadLoginPage();

            return;
        }

        // WS30 메인 페이지 로드하기
        oContr.fn.loadWS30MainPage();

    }; // end of oContr.fn.onInit


    /*************************************************************
    * @function - WS30 메인 페이지 로드하기   
    *************************************************************/
    oContr.fn.loadWS30MainPage = async function () {

        document.getElementById("content").style.display = "none";

        // oContr.ui.ROOT_PAGE.destroyContent();
        oContr.ui.APP.destroy();

        let oScript = document.createElement("script");
        oScript.src = "./js/library-preload.js";

        document.body.appendChild(oScript);

    }; // end of oContr.fn.loadWS30MainPage

    return oContr;

}
