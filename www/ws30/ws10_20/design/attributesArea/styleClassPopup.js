/* 
*📦----------------------------------------------------------------------*
* Module       : styleClassPopup.js
* Category     : Release / Workspace
* Role         : styleClass에 대한 html 화면 호출 및 styleClass 구성 처리.
*
* Creator      : pes
* Created On   : 2026-03-24
*
* Description  :
*  - 미리 정의된 UI5의 styleClass에 대한 html 화면 호출 및 styleClass 구성 처리.
*
*----------------------------------------------------------------------*
*/

export async function styleClassPopup(sParam){
                    
    //styleClass HTML PATH 구성.
    const _htmlPath = parent.PATH.join(oAPP.oDesign.pathInfo.designRootPath, "html", "documents", 
        "styleClassPopup", "index.html");

    //Help Viewer module load.
    const _viewerPath =  parent.PATH.join(oAPP.oDesign.pathInfo.designRootPath, "util", "helpViewer.js");

    //POPOVER IMPORT.
    const {popoverViewer} = await import(_viewerPath);

    //003  Cancel
    let _cancel = parent.WSUTIL.getWsMsgClsTxt("", "ZMSG_WS_COMMON_001", "003");

    //display 모드일경우 버튼 text를 close로 변경.
    if(oAPP.attr.oModel.oData.IS_EDIT === false){
        //056   close
        _cancel = parent.WSUTIL.getWsMsgClsTxt("", "ZMSG_WS_COMMON_001", "056");
    }

    //POPOVER 호출.
    let _oContr = popoverViewer({
        src:_htmlPath,
        
    }, {
        title:parent.WSUTIL.getWsMsgClsTxt("", "ZMSG_WS_COMMON_001", "626"),  //626	Using Predefined CSS
        width:"50%", 
        height:"50%", 
        resizable:false,
        IF_DATA : sParam.sAttr,
        fnCallback : (sRes)=>{

            parent.setBusy("X");

            //단축키 잠금 처리.
            oAPP.fn.setShortcutLock(true);


            if(sRes?.ACTCD === "CANCEL"){

                sRes.popover.close();

                //단축키 잠금 해제처리.
                oAPP.fn.setShortcutLock(false);

                parent.setBusy("");

                return;
            }


            //바인딩 처리된 경우 팝업 종료 후 EXIT.
            //(일반적으로 바인딩 처리된 경우 F4 HELP를 호출 할 수 없지만
            //예외 상황 발생에 대한 보호 로직 처리)
            if(sParam.sAttr.ISBND === "X"){

                sRes.popover.close();

                //단축키 잠금 해제처리.
                oAPP.fn.setShortcutLock(false);

                parent.setBusy("");

                return;

            }


            let _space = "";

            //기존 CSS 입력건 존재시 공백 추가.
            if(sParam.sAttr.UIATV !== ""){
                _space = " ";
            }

            //기존 CSS + " " + 전달받은 CSS 추가.
            sParam.sAttr.UIATV += _space + sRes.IF_DATA.styleClass;

            sRes.popover.close();

            /**
             * @since   2026-07-09 14:11:08
             * @version vNAN-NAN
             * @author  pes
             * @description
             * STYLE CLASS 적용 사항에 대해 ui attribute 변경 처리 및 미리보기 처리에 대해
             * 공통 함수로 변경 처리.
             */
            //attribute 입력건에 대한 미리보기, attr 라인 style 등에 대한 처리.
            // oAPP.fn.attrChangeProc(sParam.sAttr, undefined ,false, true);
            oAPP.fn.attrChange(sParam.sAttr, undefined ,false, true);


            //20240621 pes.
            //바인딩 팝업의 디자인 영역 갱신처리.
            oAPP.fn.updateBindPopupDesignData();
        }
    
    });


    _oContr.ui.ROOT.openBy(sParam.oUi);

    //단축키 잠금 해제처리.
    oAPP.fn.setShortcutLock(false);

    parent.setBusy("");
    
}

