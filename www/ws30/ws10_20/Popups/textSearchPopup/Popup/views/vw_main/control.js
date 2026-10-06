export async function getControl() {

/******************************************************************************
 *  💖 LIBRARY LOAD 선언부
 ******************************************************************************/


/******************************************************************************
*  💖 DATA / ATTRIBUTE 선언부
******************************************************************************/
const
    REMOTE = parent.REMOTE,
    CURRWIN = REMOTE.getCurrentWindow(),
    PARWIN = CURRWIN.getParentWindow(),
    PARCON = PARWIN.webContents;

var gBeforeSearchText;    

const 
    oContr          = {};
    oContr.msg      = {};
    oContr.ui       = {};
    oContr.fn       = {};
    oContr.types    = {};
    oContr.attr     = {};


    oContr.oModel = new sap.ui.model.json.JSONModel({


    });

    oContr.oModel.setSizeLimit(Infinity);

/******************************************************************************
*  💖 PRIVATE FUNCTION 선언부
******************************************************************************/

    // 메시지 구성
    _getWsMsg();


    /*************************************************************
     * @function - XXXXXXX
     *************************************************************/

  


    /*************************************************************
     * @function - 공통 메시지 구성
     *************************************************************/
    function _getWsMsg() {

        // let sLANGU = parent.LANGU;
        // parent.WSUTIL.getWsMsgClsTxt(sLANGU, "ZMSG_WS_COMMON_001", "290"); // 다시 시도 하시거나, 문제가 지속될 경우 U4A 솔루션 팀에 문의 하세요.

        // oContr.msg.M001 = "선택된 버전 항목이 없습니다.";
        // oContr.msg.M002 = "하나의 어플리케이션만 선택하세요.";
        // oContr.msg.M003 = "다시 시도 하시거나, 문제가 지속될 경우 U4A 솔루션 팀에 문의 하세요.";
        // oContr.msg.M004 = "현재 버전은 선택할 수 없습니다.";

        
    } // end of _getWsMsg


/******************************************************************************
* 💖  PUBLIC EVENT FUNCTION 선언부
******************************************************************************/


    /*************************************************************
    * @flowEvent - 화면이 로드 될때 타는 이벤트
    *************************************************************/
    oContr.onViewReady = async function () {        

        oAPP.fn.setBusy("");

        CURRWIN.show();

        CURRWIN.focus();

        setTimeout(function(){
            oContr.ui.INPUT1.focus();
        }, 0);        

    }; // end of oContr.onViewReady


	/*************************************************************
	 * @function - Busy Indicator
	 *************************************************************/
	oContr.fn.setBusy = function (bIsbusy, oOptions) {

        let sIsBusy = (bIsbusy === true ? "X" : "");

		// oAPP.fn.setBusy(sIsBusy);
        
        // oAPP.fn.setBusyDialog(sIsBusy, oOptions);

	}; // end of oContr.fn.setBusy

    /*************************************************************
     * @function - 텍스트 검색
     *************************************************************/
    oContr.fn.onTextSearch = function(oEvent){        
       
        let oInput = oContr.ui.INPUT1;        

        // // 입력된 값이 없을경우
        // var sValue = oInput.getValue();

        var sValue = oEvent.getParameter("value");

        if (sValue === "") {

            // 현재 입력한 값을 글로벌에 저장
            gBeforeSearchText = sValue;

            oInput.setDescription("");

            PARCON.stopFindInPage("clearSelection");
           
            return;
        }

        var bIsFindNext = false;

        // 현재 입력한 텍스트가 이전에 검색한 텍스트와 다를경우 검색 옵션값 설정
        if (gBeforeSearchText != sValue) {
            bIsFindNext = true;
        }

        var oFindOptions = {
            forward: true,
            findNext: bIsFindNext
        };

        PARCON.findInPage(sValue, oFindOptions);

        // 현재 입력한 값을 글로벌에 저장
        gBeforeSearchText = sValue;

    }; // end of oContr.fn.onTextSearch


    /*************************************************************
     * @function - 텍스트 Input의 KeyDown 이벤트
     *************************************************************/    
    oContr.fn.onTextSearchKeyDown = function(oEvent){        

        // esc 키를 눌렀다면 검색창 닫기
        if (oEvent.keyCode === 27) {
            oContr.fn.fnTextSearchClose();
            return;
        }

        // Shift + Enter키 일 경우는 위로 검색
        if(oEvent.shiftKey === true){

            if(oEvent.keyCode === 13){
                oContr.ui.SEARCH_UP_BTN.firePress();
                return;
            }

        }

    }; // end of oContr.fn.onTextSearchKeyDown


    /*************************************************************
     * @function - 부모 페이지에서 입력한 텍스트와 일치한 텍스트가
     *             있을 경우 호출되는 이벤트
     *************************************************************/    
    oContr.fn.fnFoundInPage = function(event, result){

        let oInput = oContr.ui.INPUT1;

        let sFindTxtResult = `${result.activeMatchOrdinal} / ${result.matches}`;

        oInput.setDescription(sFindTxtResult);

    }; // end of oContr.fn.fnFoundInPage


    /*************************************************************
     * @function - 텍스트 검색 (이전 검색)
     *************************************************************/       
    oContr.fn.textSearchUp = function(){

        let oInput = oContr.ui.INPUT1;

        let sValue = oInput.getValue();
        if (sValue === "") {
            PARCON.stopFindInPage("clearSelection");
            oInput.setDescription("");
            return;
        }

        let oFindOptions = {
            forward: false,
            findNext: false,
        };

        PARCON.findInPage(sValue, oFindOptions);

    }; // end of oContr.fn.textSearchUp


    /*************************************************************
     * @function - 텍스트 검색 (이후 검색)
     *************************************************************/       
    oContr.fn.textSearchDown = function(){

        let oInput = oContr.ui.INPUT1;

        let sValue = oInput.getValue();
        if (sValue === "") {
            PARCON.stopFindInPage("clearSelection");
            oInput.setDescription("");
            return;
        }

        let oFindOptions = {
            forward: true,
            findNext: false,
        };

        PARCON.findInPage(sValue, oFindOptions);

    }; // end of oContr.fn.textSearchDown


    /*************************************************************
     * @function - 텍스트 검색 팝업 닫기
     *************************************************************/      
    oContr.fn.fnTextSearchClose = function(){
        
        // 검색된 텍스트에 블럭들을 제거한다.
        PARCON.stopFindInPage("clearSelection");

        // 검색 이벤트 핸들러를 제거한다.
        PARCON.off("found-in-page", oContr.fn.fnFoundInPage);

        // 부모창에 포커스를 준다.
        PARCON.focus();

        if (!CURRWIN.isDestroyed()) {

            try {
            
                // 검색창을 닫는다.
                CURRWIN.close();

            } catch (error) {
                if (typeof U4ALOG !== "undefined" && U4ALOG.caught) { U4ALOG.caught(error); }
                
            }
            

        }

    }; // end of oContr.fn.fnTextSearchClose


    // 텍스트 검색이 일치한 텍스트가 있을경우 호출되게 이벤트 걸기
    PARCON.on("found-in-page", oContr.fn.fnFoundInPage);

/********************************************************************
 *💨 EXPORT
 *********************************************************************/

    return oContr;

}