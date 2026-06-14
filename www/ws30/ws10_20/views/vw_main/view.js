export async function getView() {

    /*************************************************************
     * 📝 컨트롤러 로드
     *************************************************************/

    let sControlPath = "./control.js";

    const oRes = await import(sControlPath);
    const oContr = await oRes.getControl();

    /************************************************************************
     * 💖 화면 그리기
     ************************************************************************/

    let APP = new sap.m.App({
        autoFocus: false,
    });

    /**
     * 헤더 미사용 — 로그인 화면(Login.js)이 자체 HTML5 타이틀바(u4a-titlebar)로
     * 로고/타이틀/min·max·close 및 maximize 아이콘 동기화를 모두 처리한다.
     * 과거 UI5 CUSTOMHEADER1 과 중복되어 타이틀바가 두 개로 보이던 문제 제거.
     */
    let ROOT_PAGE = new sap.m.Page({
        showHeader: false
    });

    oContr.ui.ROOT_PAGE = ROOT_PAGE;

    let VBOX1 = new sap.m.VBox({
        width: "100%",
        height: "100%",
        renderType: "Bare"
    });
    ROOT_PAGE.addContent(VBOX1);

    oContr.ui.VBOX1 = VBOX1;

    APP.addPage(ROOT_PAGE);

    oContr.ui.APP = APP;

    return oContr;

}