/********************************************************************
 *📝 CONTROL.JS
    내역 : 웹딘 컨버전 내부 로직 영역
********************************************************************/
export async function createControl(oParam){

    /********************************************************************
     *📝 constant 선언부
    ********************************************************************/

    //프로세스 코드 항목.
    const CS_PRCCD = {
        CREATE_APP      : "CREATE_APP",     //APP 생성.
        CREATE_WIZARD   : "CREATE_WIZARD"   //위자드.
    };

    //위자드 템플릿 팜업 sid.
    const C_TMPL_WZD_DLG_ID = "u4aWsTmplWzdDlg";

    //웹딘 컨버전 관련 구조.
    const TY_UAWD = {
        APPID       : "",     //U4A APP ID.
        COMP_NAME   : "",     //WEBDYN 컴포넌트명.
        COMP_DESC   : "",     //WEBDYN 컴포넌트 DESC.
        PACKG       : "",     //U4A 생성 패키지명.
        REQNR       : "",     //U4A 생성시 CTS명.        
        REQTX       : "",     //U4A 생성시 CTS DESC.
        REQNR_REQ   : false,  //REQNR 필수 여부.
    };

    //RETURN 처리 구조
    const TY_RES = {
        RETCD : "",
        RTMSG : ""
    };

    //VIEW 선택 구조.
    const TY_VLIST = {
        VIEW_NAME : "", //WEBDYN VIEW 명.
        VIEW_DESC : ""  //WEBDYN VIEW DESC.
    };


    //화면 활성/비활성 관련 구조.
    const TY_VIS = {
        PACKG         : false,  //U4A 생성 패키지명.
        REQNR         : false,  //U4A 생성시 CTS명.
        REQTX         : false,  //U4A 생성시 CTS DESC.
        VLIST         : false,  //VIEW 선택 TABLE
        CREATE_WIZARD : false   //위자드 생성 툴바 영역.
    };


    //화면 오류 표현 구조.
    const TY_VALST = {
        COMP_NAME : undefined,
        PACKG     : undefined,
        REQNR     : undefined
    };

    //화면 오류 표현 구조.
    const TY_VALTX = {
        COMP_NAME : "",
        PACKG     : "",        
        REQNR     : ""
    };


    //화면 EDIT/DISP 관련 구조.
    const TY_EDIT = {
        REQNR : false,  //U4A 생성시 CTS명.
    };


    /********************************************************************
     *📝 DATA / ATTRIBUTE 선언부
    ********************************************************************/
    var oContr = {};
        oContr.ui = {};
        oContr.fn = {};
        oContr.attr = {};
        
        oContr.path = {};



    //바인딩 추가 속성 정보 모델.
    oContr.oModel = new sap.ui.model.json.JSONModel({
        S_UAWD   : {...TY_UAWD},
        S_VIS    : {...TY_VIS},
        S_EDIT   : {...TY_EDIT},
        S_VALST  : {...TY_VALST},
        S_VALTX  : {...TY_VALTX},
        T_VLIST  : []
    });
    

    /********************************************************************
     *📝 CUSTOM EVENT.
    ********************************************************************/
    oContr.onEvt = new EventTarget();


    /********************************************************************
     *📝 VIEW READY.
    ********************************************************************/
    oContr.onViewReady = async function(oEvent){
        
        //default 비활성 처리.
        //(패키지, CTS번호, CTS DESC, VIEW LIST)
        var _sVis = {...TY_VIS};

        switch (oParam?.PRCCD) {
            case CS_PRCCD.CREATE_APP:
                //어플리케이션 생성.

                //패키지 입력란 활성.
                _sVis.PACKG = true;

                //CTS 번호 입력란 활성.
                _sVis.REQNR = true;

                //CTS DESC 입력란 활성.
                _sVis.REQTX = true;

                break;

            case CS_PRCCD.CREATE_WIZARD:
                //위자드 생성.

                //VIEW LIST 활성.
                _sVis.VLIST = true;

                //생성 TOOLBAR 활성화.
                _sVis.CREATE_WIZARD = true;
                
                break;

            default:
            //정해진 프로세스코드가 전달되지 않은경우 크리티컬 오류 처리.
                
        }

        
        //ui 갱신 대기 module path.
        oContr.path.UIUpdated = parent.PATH.join(parent.getPath("WS10_20_ROOT"), "design", 
            "util", "UIUpdated.js");

        //f4 help 팝업 module path.
        oContr.path.callF4HelpPopup = parent.PATH.join(parent.getPath("WS10_20_ROOT"), "design", 
            "js", "callF4HelpPopup.js");


        //화면 활성 여부.
        oContr.oModel.oData.S_VIS = _sVis;

        //어플리케이션 ID.
        oContr.oModel.oData.S_UAWD.APPID     = oParam.APPID;

        var _oPromise = undefined;

        try {
            const _oMudule = await import(oContr.path.UIUpdated);

            _oPromise = _oMudule.UIUpdated();

        } catch (e) {
        
        }

        
        oContr.oModel.refresh(true);

        //화면 갱신 대기 처리.
        await _oPromise;


        parent.setBusy("");

    };




    /********************************************************************
     *📝 VIEW EXIT.
    ********************************************************************/
    oContr.onViewExit = async function(oEvent){

    };



    /********************************************************************
     *📝 WEB DYNPRO 컴포넌트명 변경 이벤트.
    ********************************************************************/
    oContr.fn.onChangeWebdynComp = async function (oEvent) {

        parent.setBusy("X");

        //결과 테이블 sort, filter 초기화.
        oContr.fn.resetUiTableFilterSort(oContr.ui.VLIST);

        var _oUi = oEvent?.oSource;

        var _WD_COMP_NAME = oEvent.getParameter("value");
        
        //오류 표현 필드 초기화.
        oContr.oModel.oData.S_VALST.COMP_NAME = undefined;
        oContr.oModel.oData.S_VALTX.COMP_NAME = "";

        //웹딘 DESC 초기화.
        oContr.oModel.oData.S_UAWD.COMP_DESC = "";

        //view 리스트 초기화.
        oContr.oModel.oData.T_VLIST = [];

        //웹딘 컴포넌트명 입력건이 존재하지 않는경우 EXIT.
        if(_WD_COMP_NAME === ""){
            oContr.oModel.refresh();

            sap.ui.getCore().unlock();

            parent.setBusy("");
            return;
        }

        //WEB DYNPRO 컴포넌트정보 검색.
        var _sRes = await oContr.fn.getWebDynCompData();

        if(_sRes.RETCD === "E"){
            
            if(_sRes?.SCRIPT){
                eval(_sRes.SCRIPT);

                //WEB DYNPRO 컴포넌트 DESC 초기화.
                oContr.oModel.oData.S_UAWD.COMP_DESC = "";

                oContr.oModel.refresh(true);

                //wait off 처리.
                parent.setBusy("");

                return;
            }

            //오류 표현 필드처리.
            oContr.oModel.oData.S_VALST.COMP_NAME = "Error";
            oContr.oModel.oData.S_VALTX.COMP_NAME = _sRes.RTMSG;

            //WEB DYNPRO 컴포넌트 DESC 초기화.
            oContr.oModel.oData.S_UAWD.COMP_DESC = "";

            oContr.oModel.refresh(true);
           

            parent.setBusy("");

            //오류  메시지 출력.
            parent.showMessage(sap, 20, "E", _sRes.RTMSG, function(){
                _oUi?.focus?.();
            });           

            return;

        }

        //WEB DYNPRO 컴포넌트명 값 세팅.
        oContr.oModel.oData.S_UAWD.COMP_NAME = _sRes.COMP_NAME;

        //WEB DYNPRO 컴포넌트 DESC 값 세팅.
        oContr.oModel.oData.S_UAWD.COMP_DESC = _sRes.COMP_DESC;

        //view 리스트 정보 매핑.
        oContr.oModel.oData.T_VLIST = _sRes?.T_VLIST || [];

        //잠금 해제 처리.
        sap.ui.getCore().unlock();

        oContr.oModel.refresh(true);        

        parent.setBusy("");


    };


    /********************************************************************
     *📝 패키지 변경 에벤트.
    ********************************************************************/
    oContr.fn.onChangePackage = async function (oEvent) {

        parent.setBusy("X");

        var _oUi = oEvent?.oSource;
        
        //오류 표현 필드 초기화.
        oContr.oModel.oData.S_VALST.PACKG = undefined;
        oContr.oModel.oData.S_VALTX.PACKG = "";

        var _PACKG = oEvent.getParameter("value");

        //패키지 입력건이 존재하지 않는경우 EXIT.
        if(_PACKG === ""){
            oContr.oModel.refresh();

            sap.ui.getCore().unlock();

            parent.setBusy("");
            return;
        }


        //패키지 입력건 점검.
        var _sRes = await oContr.fn.checkPackage();

        if(_sRes.RETCD === "E"){

            //오류 표현 필드 초기화.
            oContr.oModel.oData.S_VALST.PACKG = "Error";
            oContr.oModel.oData.S_VALTX.PACKG = _sRes.RTMSG;

            oContr.oModel.refresh(true);

            parent.setBusy("");

            //오류  메시지 출력.
            parent.showMessage(sap, 20, "E", _sRes.RTMSG, function(){
                _oUi?.focus?.();
            });           

            return;

        }

        //default REQNR 입력필드 비활성.
        oContr.oModel.oData.S_EDIT.REQNR     = false;
        oContr.oModel.oData.S_UAWD.REQNR_REQ = false;

        //입력한 패키지가 로컬 패키지가 아닌 경우.
        if(oContr.oModel.oData.S_UAWD.PACKG !== "$TMP"){
            //REQNR 입력필드 활성.
            oContr.oModel.oData.S_EDIT.REQNR = true;

            //REQNR 필수 처리.
            oContr.oModel.oData.S_UAWD.REQNR_REQ = true;

        }

        //잠금 해제 처리.
        sap.ui.getCore().unlock();

        oContr.oModel.refresh(true);

        parent.setBusy("");

        
    };



    /********************************************************************
     *📝 webdyn 컴포넌트 f4 help.
    ********************************************************************/
    oContr.fn.onValueHelpWDCompName = async function(oEvent){

        parent.setBusy("X");

        //F4 HELP CALLBACK FUNCTION.
        async function _callback(sRes){

            parent.setBusy("X");
            
            //오류 표현 필드 초기화.
            oContr.oModel.oData.S_VALST.COMP_NAME = undefined;
            oContr.oModel.oData.S_VALTX.COMP_NAME = "";

            //view 리스트 초기화.
            oContr.oModel.oData.T_VLIST = [];

            //WD 컴포넌트명.
            oContr.oModel.oData.S_UAWD.COMP_NAME = sRes.COMPONENT_NAME;

            //WD 컴포넌트 desc.
            oContr.oModel.oData.S_UAWD.COMP_DESC = sRes.DESCRIPTION;
            

            //웹딘 위자드에서 호출된 경우.
            if(oParam.PRCCD === "CREATE_WIZARD"){

                //WEB DYNPRO 컴포넌트정보 검색.
                var _sRes = await oContr.fn.getWebDynCompData();

                if(_sRes.RETCD === "E"){

                    if(_sRes?.SCRIPT){
                        eval(_sRes?.SCRIPT);

                        //WEB DYNPRO 컴포넌트 DESC 초기화.
                        oContr.oModel.oData.S_UAWD.COMP_DESC = "";

                        oContr.oModel.refresh(true);

                        //wait off 처리.
                        parent.setBusy("");

                        return;
                    }

                    //오류 표현 필드 처리.
                    oContr.oModel.oData.S_VALST.COMP_NAME = "Error";
                    oContr.oModel.oData.S_VALTX.COMP_NAME = _sRes.RTMSG;

                    //WEB DYNPRO 컴포넌트 DESC 초기화.
                    oContr.oModel.oData.S_UAWD.COMP_DESC = "";

                    oContr.oModel.refresh(true);

                    parent.setBusy("");

                    //오류  메시지 출력.
                    parent.showMessage(sap, 20, "E", _sRes.RTMSG);           

                    return;

                }

                //WEB DYNPRO 컴포넌트명 값 세팅.
                oContr.oModel.oData.S_UAWD.COMP_NAME = _sRes.COMP_NAME;

                //WEB DYNPRO 컴포넌트 DESC 값 세팅.
                oContr.oModel.oData.S_UAWD.COMP_DESC = _sRes.COMP_DESC;

                //view 리스트 정보 매핑.
                oContr.oModel.oData.T_VLIST = _sRes?.T_VLIST || [];

            }

            
            oContr.oModel.refresh(true);


            parent.setBusy("");


        }


        //f4 help팝업을 load한경우.
        if(typeof oAPP.fn.callF4HelpPopup !== "undefined"){
            //f4 help 팝업 호출.
            // oAPP.fn.callF4HelpPopup("WD_COMPONENT", "WD_COMPONENT", [], [], _callback);
            oAPP.fn.callF4HelpPopup("YYUAWDH0010", "YYUAWDH0010", [], [], _callback);

            return;
        }

        var _sRes = await fetch(oContr.path.callF4HelpPopup);

        var _source = await _sRes.text();

        eval(_source);

        //f4 help 팝업 function load 이후 팝업 호출.
        // oAPP.fn.callF4HelpPopup("WD_COMPONENT", "WD_COMPONENT", [], [], _callback);
        oAPP.fn.callF4HelpPopup("YYUAWDH0010", "YYUAWDH0010", [], [], _callback);

    };




    /********************************************************************
     *📝 package f4 help.
    ********************************************************************/
    oContr.fn.onValueHelpPackage = async function(oEvent){

        parent.setBusy("X");

        //F4 HELP CALLBACK FUNCTION.
        function _callback(sRes){

            //패키지명.
            oContr.oModel.oData.S_UAWD.PACKG = sRes.DEVCLASS;

            //CTS 번호 입력 비활성 처리.
            oContr.oModel.oData.S_EDIT.REQNR     = false;
            oContr.oModel.oData.S_UAWD.REQNR_REQ = false;

            //로컬 패키지를 입력한 경우.
            if(oContr.oModel.oData.S_UAWD.PACKG === "$TMP"){

                //CTS 번호 초기화.
                oContr.oModel.oData.S_UAWD.REQNR = "";
                oContr.oModel.refresh(true);

                return;
            }

            //CTS 번호 입력 활성화.
            oContr.oModel.oData.S_EDIT.REQNR     = true;

            //CTS 번호 필수 입력 처리.
            oContr.oModel.oData.S_UAWD.REQNR_REQ = true;

            oContr.oModel.refresh(true);
            

        }


        //f4 help팝업을 load한경우.
        if(typeof oAPP.fn.callF4HelpPopup !== "undefined"){
            //f4 help 팝업 호출.
            oAPP.fn.callF4HelpPopup("DEVCLASS", "DEVCLASS", [], [], _callback);

            return;
        }

        var _sRes = await fetch(oContr.path.callF4HelpPopup);

        var _source = await _sRes.text();

        eval(_source);

        //f4 help 팝업 function load 이후 팝업 호출.
        oAPP.fn.callF4HelpPopup("DEVCLASS", "DEVCLASS", [], [], _callback);

    };




    /********************************************************************
     *📝 Request No F4 HELP 이벤트.
    ********************************************************************/
    oContr.fn.onValueHelpReqNumber = function(){

        //Request No 팝업 호출.
        oAPP.fn.fnCtsPopupOpener(function(param){
            
            oContr.oModel.oData.S_UAWD.REQNR = param.TRKORR;
            oContr.oModel.oData.S_UAWD.REQTX = param.AS4TEXT;

            oContr.oModel.oData.S_VALST.REQNR = undefined;
            oContr.oModel.oData.S_VALTX.REQNR = "";

            oContr.oModel.refresh(true);
        
        });

    };




    /********************************************************************
     *📝 웹딘 컨버전 생성 버튼 이벤트.
    ********************************************************************/
    oContr.fn.onCreateWebdynConvUI = function(oEvent){

        switch (oParam.PRCCD) {
            case CS_PRCCD.CREATE_APP:
                //어플리케이션 생성.
                break;

            case CS_PRCCD.CREATE_WIZARD:
                //위자드 - WEBDYN UI 컨버전
                oContr.fn.convWebdynUI();
                break;
        
            default:
                break;
        }

    };




    /********************************************************************
     *📝 테이블 sort, filter 초기화.
    ********************************************************************/
    oContr.fn.resetUiTableFilterSort = function(oTable) {

      if (typeof oTable === "undefined") { return; }

      //table 바인딩 sort 해제 처리.
      oTable.sort();

      //table의 컬럼 정보 얻기.
      var _aCol = oTable.getColumns();

      for (var i = 0, l = _aCol.length; i < l; i++) {

        var _oCol = _aCol[i];

        //필터 초기화.
        oTable.filter(_oCol);

        //sort 초기화.
        _oCol.setSorted(false);
      }

    };




    /********************************************************************
     *📝 view list 테이블 더블클릭 이벤트.
    ********************************************************************/
    oContr.fn.onDblClickViewTable = function(oEvent){

        parent.setBusy("X");
        
        //이벤트 발생 UI 정보 얻기.
        var _oUi = oAPP.fn.getUiInstanceDOM(oEvent.target, sap.ui.getCore());

        //UI정보를 얻지 못한 경우 exit.
        if(!_oUi){
            parent.setBusy("");
            return;
        }
        
        //바인딩정보 얻기.
        var _oCtxt = _oUi.getBindingContext();

        //바인딩 정보를 얻지 못한 경우 exit.
        if(!_oCtxt){
            parent.setBusy("");
            return;
        }

        var _oBind = oContr.ui.VLIST.getBinding("rows");

        if(!_oBind){
            parent.setBusy("");
            return;
        }
        
        var _aContext = _oBind.getContexts();

        var _pos = _aContext.findIndex( item => item === _oCtxt);

        if(_pos === -1){
            parent.setBusy("");
            return;
        }

        oContr.ui.VLIST.setSelectedIndex(_pos);

        //위자드 - WEBDYN UI 컨버전
        oContr.fn.convWebdynUI();

    };





    /********************************************************************
     *📝 CUSTOM EVENT.
    ********************************************************************/
    oContr.onEvt.addEventListener("conversionWebdynpro", (oEvent)=>{ 

        switch (oEvent?.detail?.ACTCD) {
            case "CREATE_APP":
                //어플리케이션 생성.
                oContr.fn.createApp(oEvent.detail);
                
                break;

            case "WIZARD_CONV":
                //위자드 - WEBDYN UI 컨버전
                oContr.fn.convWebdynUI();
                break;

            default:
                //정해진 액션코드가 전달되지 않은경우 크리티컬 오류 처리.
                
        }

    });




    /********************************************************************
     *📝 위자드 - WEBDYN UI 컨버전 전 입력값 점검.
    ********************************************************************/
    oContr.fn.checkWizardConvData = function(){

        var _sRes = {...TY_RES};

        var _sUAWD = oContr.oModel.oData.S_UAWD;

        var _sVALST = {...TY_VALST};
        var _sVALTX = {...TY_VALTX};

        //오류 필드 초기화.
        oContr.oModel.oData.S_VALST = _sVALST;
        oContr.oModel.oData.S_VALTX = _sVALTX;

        //웹딘 컴포넌트명이 존재하지 않는경우.
        if(_sUAWD.COMP_NAME === ""){

            _sRes.RETCD = "E";
            
            //274	Check input value.
            _sRes.RTMSG = oAPP.common.fnGetMsgClsText("/U4A/MSG_WS", "274", "", "", "", ""); 

            //Web Dynpro Component Name 오류 표현.
            _sVALST.COMP_NAME = "Error";

            //447	Web Dynpro Component Name is required.
            _sVALTX.COMP_NAME = parent.WSUTIL.getWsMsgClsTxt("", "ZMSG_WS_COMMON_001", "447");

        }

        //입력값 점검 오류건 존재시 EXIT.
        if(_sRes.RETCD === "E"){
            return _sRes;
        }


        //선택한 라인의 view 정보 매핑.
        var _aVList = oContr.fn.getSelectedViewData();

        //선택한 라인이 존재하지 않는 경우 오류 메시지 처리.
        if(_aVList.length === 0){

            _sRes.RETCD = "E";
            
            //448	Select the View list to convert
            _sRes.RTMSG = parent.WSUTIL.getWsMsgClsTxt("", "ZMSG_WS_COMMON_001", "448");

        }

        return _sRes;

    };


    /********************************************************************
     *📝 위자드 - WEBDYN UI 컨버전
    ********************************************************************/
    oContr.fn.convWebdynUI = async function(){

        parent.setBusy("X");


        //웹딘 컨버전 전 입력값 점검.
        var _sRes = oContr.fn.checkWizardConvData();
        
        if(_sRes.RETCD === "E"){

            //오류  메시지 출력.
            parent.showMessage(sap, 20, "E", _sRes.RTMSG);

            oContr.oModel.refresh(true);

            parent.setBusy("");

            return;

        }        


        //컨버전 처리 전 확인팝업 호출.
        var _res = await new Promise((resolve) => {

            //449	Do you want to proceed with the conversion for the selected view?
            parent.showMessage(sap, 30, "I", parent.WSUTIL.getWsMsgClsTxt("", "ZMSG_WS_COMMON_001", "449"), function(param){
                return resolve(param);
            });

            parent.setBusy("");

        });

        if(_res !== "YES"){
            return;
        }


        parent.setBusy("X"); 


        var _oFormData = new FormData();


        var _sAppData = {};

        //Web Dynpro Component Name.
        _sAppData.COMP_NAME = oContr.oModel.oData.S_UAWD.COMP_NAME;

        //U4A APP ID.
        _sAppData.APPID     = oContr.oModel.oData.S_UAWD.APPID;

        //선택한 라인의 view 정보 매핑.
        _sAppData.T_VLIST   = oContr.fn.getSelectedViewData();
        
        
        _oFormData.append("APPDATA", JSON.stringify(_sAppData));


        //웹딘 컨버전 작업 처리 진행.
        var _sRet = await new Promise((resolve) => {

            sendAjax(parent.getServerPath() + "/u4a_cvt_wdr/convWebdynUI", _oFormData, function(sRet){
                return resolve(sRet);

            },"", true, "POST", function(e){
                //A communication error has occurred. 
                //Please check your network status and contact the U4A Solution Team if the issue persists.
                return resolve({RETCD:"E", RTMSG: parent.WSUTIL.getWsMsgClsTxt("", "ZMSG_WS_COMMON_001", "391")});

            });

        });


        //WEBDYN 컨버전 처리중 오류가 발생한 경우.
        if(_sRet.RETCD === "E"){

            if(_sRet?.SCRIPT){
                eval(_sRet?.SCRIPT);

                //wait off 처리.
                parent.setBusy("");

                return;
            }

            //오류 메시지 출력.
            parent.showMessage(sap, 20, "E", _sRet.RTMSG);

            //wait off 처리.
            parent.setBusy("");

            return;
        }


        //컨버전 처리된 UI 정보를 TREE로 변환 처리.
        var _aConvUIData = oAPP.fn.setTreeData(_sRet.T_0014, "POBID", "OBJID", "zTREE");

        //최상위 UI 정보 얻기.
        //(N개의 VIEW를 선택하는 경우 VBOX를 최상위로 설정하기에 최상위는 언제나 1개만 존재함)
        var _sConvUIData = _aConvUIData[0];


        //구성한 ui 계층 정보에 attr 정보 추가 처리.
        oContr.fn.setUiAttrData(_sConvUIData, _sRet.T_0015);


        //선택한 라인의 tree 정보 얻기.
        var _sDesignUI = oAPP.fn.designGetSelectedTreeItem();


        //이벤트 발생 x, y 좌표값 얻기.
        var _sPos = oAPP.fn.getMousePosition();


        //대상 UI의 추가될 aggregation 정보 얻기.
        var _sRes = await oAPP.fn.aggrSelectPopupOpener(_sConvUIData, _sDesignUI, _sPos);
        
        if(_sRes.RETCD === "E"){

            //default 메시지 유형(messageToast)
            var _KIND = 10;

            //aggregation 선택 건이 존재하지 않는 return code를 받은경우.
            if(_sRes.RCODE === "02"){
                //messageBox로 처리.
                _KIND = 20;
            }

            //편집 모드인 경우.
            parent.showMessage(sap, _KIND, "I", _sRes.RTMSG);

            //단축키 잠금 해제처리.
            oAPP.fn.setShortcutLock(false);
                
            parent.setBusy("");

            return;

        }


        //선택한 라인에 컨버전 처리된 UI를 추가.
        oAPP.fn.designAddTreeData(_sConvUIData, _sDesignUI, _sRes.sAggr);


        //위자드 템플릿 팝업 UI 정보 얻기.
        var _oWizardPopup = sap.ui.getCore().byId(C_TMPL_WZD_DLG_ID);

        //팝업이 호출되어 있지 않는경우 exit.
        //(팝업정보를 얻지 못한 경우도 exit)
        if(_oWizardPopup?.isOpen?.() !== true){
            return;
        }

        //팝업 종료 처리.
        _oWizardPopup.close();


    };




    /********************************************************************
     *📝 ui에 해당하는 attr 정보 구성.
    ********************************************************************/
    oContr.fn.setUiAttrData = function(sDesignUI, aT_0015){

        sDesignUI._T_0015 = aT_0015.filter( item => item.OBJID === sDesignUI.OBJID ) || [];

        if(sDesignUI.zTREE.length === 0){
            return;
        }

        for (let i = 0, l = sDesignUI.zTREE.length; i < l; i++) {

            var _sDesignUI = sDesignUI.zTREE[i];

            oContr.fn.setUiAttrData(_sDesignUI, aT_0015);
            
        }

    };




    /********************************************************************
     *📝 선택한 라인의 view 정보 얻기.
    ********************************************************************/
    oContr.fn.getSelectedViewData = function(){

        var _aVLIST = [];

        //table의 선택한 라인 정보 얻기.
        var _aIndx = oContr.ui.VLIST.getSelectedIndices();

        if(_aIndx.length === 0){
            return _aVLIST;
        }

        var _oBind = oContr.ui.VLIST.getBinding("rows");
        

        //선택한 라인에 해당하는 
        for (let i = 0, l = _aIndx.length; i < l; i++) {

            var _indx = _oBind.aIndices[_aIndx[i]];            

            var _sVList = oContr.oModel.oData.T_VLIST[_indx];

            _aVLIST.push(_sVList.VIEW_NAME);
            
        }

        return _aVLIST;

    };



    /********************************************************************
     *📝 패키지 입력값 점검.
    ********************************************************************/
    oContr.fn.checkPackage = function(){

        return new Promise((resolve) => {

            var _sRes = {...TY_RES};
            
            var _sUAWD = oContr.oModel.oData.S_UAWD;

            //패키지를 입력하지 않은경우.
            if(_sUAWD.PACKG === ""){
                return resolve(_sRes);
            }

            _sUAWD.PACKG = _sUAWD.PACKG.toUpperCase();

            //로컬 패키지를 입력한 경우.
            if(_sUAWD.PACKG === "$TMP"){
                return resolve(_sRes);
            }

            //Y, Z 로 시작하는 패키지인지 점검.
            if("YZ".indexOf(_sUAWD.PACKG.substring(0,1)) === -1){
                _sRes.RETCD = "E";
                //275	Standard package cannot be entered.
                _sRes.RTMSG = oAPP.common.fnGetMsgClsText("/U4A/MSG_WS", "275", "", "", "", "");
                return resolve(_sRes);
            }


            var _oFormData = new FormData();
            _oFormData.append("PACKG", _sUAWD.PACKG);

            sendAjax(parent.getServerPath() + "/chkPackage", _oFormData, function(sRet){

                //잘못된 PACKAGE를 입력한 경우.
                if(sRet.ERFLG === "X"){
                    _sRes.RETCD = "E";
                    _sRes.RTMSG = sRet.ERMSG;
                    return resolve(_sRes);
                }


                //패키지 입력건 점검 중 오류가 발생한 경우.
                if(sRet.ERFLG === "E"){
                    _sRes.RETCD = "E";
                    _sRes.RTMSG = sRet.ERMSG;
                    return resolve(_sRes);
                    
                }

                return resolve(_sRes);

            },"", true, "POST", function(e){
                
                return resolve({RETCD:"E", RTMSG: parent.WSUTIL.getWsMsgClsTxt("", "ZMSG_WS_COMMON_001", "391")});

            });

        });

    };



    /********************************************************************
     *📝 WEB DYNPRO 컴포넌트정보 검색.
    ********************************************************************/
    oContr.fn.getWebDynCompData = function(){

        return new Promise((resolve) => {

            var _sRes = {...TY_RES};

            //컴포넌트명.
            _sRes.COMP_NAME = oContr.oModel.oData.S_UAWD.COMP_NAME;

            //WEB DYNPRO 컴포넌트 DESC 필드.
            _sRes.COMP_DESC = "";

            
            //WEB DYNPRO 컴포넌트명을 입력하지 않은경우.
            if(_sRes.COMP_NAME === ""){
                return resolve(_sRes);
            }

            //컴포넌트명 대문자 변환.
            _sRes.COMP_NAME = _sRes.COMP_NAME.toUpperCase();

            
            var _oFormData = new FormData();

            //WEBDYN 컴포넌트명 입력.
            _oFormData.append("WD_COMP_NAME", _sRes.COMP_NAME);

            sendAjax(parent.getServerPath() + "/u4a_cvt_wdr/getWebDynCompData", _oFormData, function(sRes){

                return resolve(sRes);

            },"", true, "POST", function(e){
                
                return resolve({RETCD:"E", RTMSG: parent.WSUTIL.getWsMsgClsTxt("", "ZMSG_WS_COMMON_001", "391")});

            });

        });

    };


    /********************************************************************
     *📝 어플리케이션 생성전 입력값 점검.
    ********************************************************************/
    oContr.fn.checkAppData = function(sParmas){

        return new Promise(async (resolve) => {

            var _sRes = {...TY_RES};

            var _sAppData = {};
            
            var _sUAWD = oContr.oModel.oData.S_UAWD;

            var _sVALST = {...TY_VALST};
            var _sVALTX = {...TY_VALTX};

            //오류 필드 초기화.
            oContr.oModel.oData.S_VALST = _sVALST;
            oContr.oModel.oData.S_VALTX = _sVALTX;

            //웹딘 컴포넌트명이 존재하지 않는경우.
            if(_sUAWD.COMP_NAME === ""){

                _sRes.RETCD = "E";
                
                //274	Check input value.
                _sRes.RTMSG = oAPP.common.fnGetMsgClsText("/U4A/MSG_WS", "274", "", "", "", ""); 

                //Web Dynpro Component Name 오류 표현.
                _sVALST.COMP_NAME = "Error";

                //447	Web Dynpro Component Name is required.
                _sVALTX.COMP_NAME = parent.WSUTIL.getWsMsgClsTxt("", "ZMSG_WS_COMMON_001", "447");


            }

            //패키지 명이 입력되지 않은경우.
            if(_sUAWD.PACKG === ""){

                _sRes.RETCD = "E";
                
                //274	Check input value.
                _sRes.RTMSG = oAPP.common.fnGetMsgClsText("/U4A/MSG_WS", "274", "", "", "", ""); 

                _sVALST.PACKG = "Error";

                //451	Package is required.
                _sVALTX.PACKG = parent.WSUTIL.getWsMsgClsTxt("", "ZMSG_WS_COMMON_001", "451");

            }


            //Y, Z 로 시작하는 패키지인지 점검.
            if(_sUAWD.PACKG !== "$TMP" && "YZ".indexOf(_sUAWD.PACKG.substring(0,1)) === -1){
                _sRes.RETCD = "E";

                //274	Check input value.
                _sRes.RTMSG = oAPP.common.fnGetMsgClsText("/U4A/MSG_WS", "274", "", "", "", ""); 

                _sVALST.PACKG = "Error";

                //275	Standard package cannot be entered.
                _sVALTX.PACKG = oAPP.common.fnGetMsgClsText("/U4A/MSG_WS", "275", "", "", "", "");
                
            }


            //로컬 패키지가 아닌경우 REQNR를 입력하지 않은경우.
            if(_sUAWD.PACKG !== "$TMP" && _sUAWD.REQNR === ""){

                _sRes.RETCD = "E";
                
                //274	Check input value.
                _sRes.RTMSG = oAPP.common.fnGetMsgClsText("/U4A/MSG_WS", "274", "", "", "", ""); 

                _sVALST.REQNR = "Error";

                //450	CTS 번호는 필수로 입력되야 합니다.
                _sVALTX.REQNR = parent.WSUTIL.getWsMsgClsTxt("", "ZMSG_WS_COMMON_001", "450");

            }

            //입력값 점검 오류건이 존재하는경우.
            if(_sRes.RETCD === "E"){
                return resolve(_sRes);
            }


            //U4A APP ID
            _sAppData.APPID = _sUAWD.APPID;

            //Web Dynpro Component Name.
            _sAppData.COMP_NAME = _sUAWD.COMP_NAME;

            //Package
            _sAppData.PACKG = _sUAWD.PACKG;

            _sAppData.REQNR = "";

            //Request/Task
            if(_sUAWD.REQNR !== ""){
                _sAppData.REQNR = _sUAWD.REQNR;
            }
            

            var _oFormData = new FormData();

            _oFormData.append("APPDATA",  JSON.stringify(_sAppData));

            //서버에서 입력한 값 점검.
            sendAjax(parent.getServerPath() + "/u4a_cvt_wdr/checkAppData", _oFormData, function(sRet){
                
                resolve(sRet);

            },"", true, "POST", function(e){
                                
                return resolve({RETCD:"E", RTMSG: parent.WSUTIL.getWsMsgClsTxt("", "ZMSG_WS_COMMON_001", "391")});

            });

        });

    };




    /********************************************************************
     *📝 어플리케이션 생성 처리.
    ********************************************************************/
    oContr.fn.createApp = async function(sParmas){
        
        parent.setBusy("X");


        var _sUAWD = oContr.oModel.oData.S_UAWD;

        //로컬로 생성하는 경우.
        if(sParmas?.ISLOCAL === true){
            _sUAWD.PACKG = "$TMP";
            _sUAWD.REQNR = "";
            oContr.oModel.oData.S_EDIT.REQNR = false;
        }

        
        //어플리케이션 생성전 입력값 점검.
        var _sRes = await oContr.fn.checkAppData();

        if(_sRes.RETCD === "E"){

            if(_sRes?.SCRIPT){
                eval(_sRes?.SCRIPT);

                oContr.oModel.refresh(true);
                
                //wait off 처리.
                parent.setBusy("");

                parent.setBusy("");

                return;
            }

            //오류  메시지 출력.
            parent.showMessage(sap, 20, "E", _sRes.RTMSG);

            oContr.oModel.refresh(true);

            parent.setBusy("");

            parent.setBusy("");

            return;

        }
        
        
        oContr.oModel.refresh(true);


        //생성전 확인팝업 호출.
        var _res = await new Promise((resolve) => {

            //276	Create &1 application?
            parent.showMessage(sap, 30, "I", oAPP.common.fnGetMsgClsText("/U4A/MSG_WS", "276", sParmas?.APPID, "", "", ""), function(param){
                return resolve(param);
            });

            parent.setBusy("");

            parent.setBusy("");

        });
        

        if(_res !== "YES"){
            return;
        }


        parent.setBusy("X");        


        //화면 바인딩 정보 매핑.
        var _sAppData = {};

        //Web Application ID
        _sAppData.APPID     = _sUAWD?.APPID;

        //Web Dynpro Component Name.
        _sAppData.COMP_NAME = _sUAWD.COMP_NAME;

        //Package
        _sAppData.PACKG     = _sUAWD.PACKG;

        //Request/Task
        _sAppData.REQNR     = _sUAWD.REQNR;


        var _oFormData = new FormData();

        _oFormData.append("APPDATA", JSON.stringify(_sAppData));


        //APP 생성 처리.
        var _sRet = await new Promise((resolve) => {

            sendAjax(parent.getServerPath() + "/u4a_cvt_wdr/createAppData", _oFormData, function(sRet){
                return resolve(sRet);
            },"", true, "POST", function(e){
                //A communication error has occurred. 
                //Please check your network status and contact the U4A Solution Team if the issue persists.
                return resolve({RETCD:"E", RTMSG: parent.WSUTIL.getWsMsgClsTxt("", "ZMSG_WS_COMMON_001", "391")});

            });

        });

        //application 생성중 오류가 발생한 경우.
        if(_sRet.RETCD === "E"){

            if(_sRet?.SCRIPT){
                eval(_sRet?.SCRIPT);
                
                //wait off 처리.
                parent.setBusy("");

                parent.setBusy("");

                return;
            }

            //오류 메시지 출력.
            parent.showMessage(sap, 20, "E", _sRet.RTMSG);

            //wait off 처리.
            parent.setBusy("");

            return;
        }

        //busy dialog close.
        parent.setBusy("");


        //생성 처리 성공 이후 work space UI editor 화면으로 이동 처리.
        onAppCrAndChgMode(sParmas?.APPID);


        sParmas.oUIobj.oCreateDialog.close();
        sParmas.oUIobj.oCreateDialog.destroy();


    };

    return oContr;


};