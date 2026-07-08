/********************************************************************
 *📝 바인딩 추가속성 정보 구성.
********************************************************************/
export async function start(oArea, oTable){

    return new Promise(async (res) => {

        //바인딩 추가속성 정보 화면 구성.
        var _oContr = await designView(oArea, oTable);

        
        var _oPromise = _oContr.fn.uiUpdateComplate(oArea);

        oArea.invalidate();

        await _oPromise;
        

        //화면 구성 이후 View Start
        await _oContr.onViewReady();

        return res(_oContr);

    });

};



/********************************************************************
 *📝 바인딩 추가속성 정보 control 정보 구성.
********************************************************************/
function designControl(oArea){

    return new Promise(async (res) => {


        /******************************************************************
         *📝 DATA / ATTRIBUTE 선언부
        *******************************************************************/ 
        const 
            oContr         = {};
            oContr.ui      = {};
            oContr.ui.ROOT = undefined;
            oContr.fn      = {};

            oContr.types   = {};


            //추가속성 DDLB 구조.
            oContr.types.TY_DDLB = {
                KEY  : "",
                TEXT : ""
            };


            //바인딩 추가 속성 리스트 구조.
            oContr.types.TY_LIST = {
                ITMCD       : "",       //공통코드 ITEM CODE(UA028-ITMCD)
                prop        : "",       //속성명(UA028-FLD01)
                val         : "",       //입력(출력) 값.
                stat        : null,     //오류 표현 필드.
                statTxt     : "",       //오류 표현 TEXT.
                isFieldInfo : false,    //DISPLAY 필드 여부
                edit        : false,    //editable 바인딩 필드.
                inp_vis     : false,    //input 활성여부
                sel_vis     : false,    //select 활성여부
                txt_vis     : false,    //text 활성여부
                maxlen      : 0,        //입력필드 max length.
                _style      : "",       //오류 표현 css style 바인딩 필드.
                _error      : false,    //라인의 입력값 오류발생시 flag 처리 필드.
                _error_msg  : "",       //라인 입력값 오류 발생시 메시지.
                T_DDLB      : [],       //라인 별 DDLB 리스트

            };


            //바인딩 추가 속성 정보 모델.
            oContr.oModel = new sap.ui.model.json.JSONModel({
                T_MPROP  : []
            });


        /********************************************************************
         *📝 PRIVITE FUNCTION 선언부
        *******************************************************************/    

            /*************************************************************
             * @function - 추가속성 바인딩 활성여부 처리.
             *************************************************************/
            function _setAdditBindButtonEnable(bEnable){

                //default 추가속성 버튼 비활성.
                oContr.oModel.oData.edit_additbind = false;

                //workbench 화면이 편집상태가 아닌경우.
                if(oAPP.attr.oAppInfo.IS_EDIT !== "X"){
                    //활성 처리 하지 않음.
                    return;

                }

                //추가속성 버튼 활성 여부 처리.
                oContr.oModel.oData.edit_additbind = bEnable;
            }



        /*************************************************************
         * @FlowEvent - View Start 
         *************************************************************/
        oContr.onViewReady = async function(){

            return new Promise(async (res) => {

                //추가속성 정보 초기값 구성.
                oContr.fn.setAdditialListData();


                //default 화면 편집 불가능.
                oContr.oModel.oData.edit = false;

                //workbench 화면이 편집상태인경우.
                if(oAPP.attr.oAppInfo.IS_EDIT === "X"){
                    //화면 편집 가능 flag 처리.
                    oContr.oModel.oData.edit = true;
                }

                
                //추가속성 바인딩 활성여부 처리.
                _setAdditBindButtonEnable(true);

                
                oContr.oModel.refresh();


                return res();

            });           

        };


        /*************************************************************
         * @event - 바인딩 추가 속성 정보 멀티 적용.
         *************************************************************/
        oContr.fn.onMultiAdditionalBind = async function(oEvent){

            var _sOption = JSON.parse(JSON.stringify(oAPP.types.TY_BUSY_OPTION));

            //219	바인딩 팝업에서 추가 속성 바인딩 처리를 진행하고 있습니다.
            _sOption.DESC = oAPP.WSUTIL.getWsMsgClsTxt(oAPP.attr.GLANGU, "ZMSG_WS_COMMON_001", "219");


            oAPP.fn.setBusyWS20Interaction(true, _sOption);

            //20240827 PES -START.
            //기존 BUSY 처리시, BROADCAST로 WS20메인 화면 및 다른 팝업에 BUSY 요청 처리되어
            //WS20 메인 화면의 BUSY DIALOG를 호출할 수 없기에 주석 처리함.
            // oAPP.fn.setBusy(true);

            // var _sOption = JSON.parse(JSON.stringify(oAPP.types.TY_BUSY_OPTION));

            // //219	바인딩 팝업에서 추가 속성 바인딩 처리를 진행하고 있습니다.
            // _sOption.DESC = oAPP.WSUTIL.getWsMsgClsTxt(oAPP.attr.GLANGU, "ZMSG_WS_COMMON_001", "219");

            // //WS 3.0 DESIGN 영역에 BUSY ON 요청 처리.
            // parent.require("./wsDesignHandler/broadcastChannelBindPopup.js")("BUSY_ON", _sOption);
            //20240827 PES -END.

            var _oUi = oEvent.oSource;

            //바인딩 추가속성 정보 멀티 적용 가능 여부 점검.
            var _sRes = await parent.require("./bindAdditArea/checkMultiAdditBind.js")();

            //점검 오류가 발생한 경우.
            if(_sRes.RETCD === "E"){

                await oAPP.fn.showMessagePopoverOppener(_oUi, _sRes.T_RTMSG);
                
                // //WS 3.0 DESIGN 영역에 BUSY OFF 요청 처리.
                // parent.require("./wsDesignHandler/broadcastChannelBindPopup.js")("BUSY_OFF");

                // oAPP.fn.setBusy(false);

                oAPP.fn.setBusyWS20Interaction(false, {});
                
                return;

            }

            //DESIGN TREE의 체크박스 선택한 정보 얻기.
            var _aTree = oAPP.attr.oDesign.fn.getSelectedDesignTree();

            //166	&1건의 라인이 선택됐습니다.
            var _msg = oAPP.WSUTIL.getWsMsgClsTxt(oAPP.attr.GLANGU, "ZMSG_WS_COMMON_001", "166", _aTree.length);

            //089	바인딩 추가 속성 정보를 적용하시겠습니까?
            _msg += "\n" + oAPP.WSUTIL.getWsMsgClsTxt(oAPP.attr.GLANGU, "ZMSG_WS_COMMON_001", "089");


            
            let _actcd = await new Promise((resolve) => {

                sap.m.MessageBox.confirm(_msg, {
                    id: oAPP.attr.C_CONFIRM_POPUP, 
                    onClose: (actcd) => {

                        // oAPP.fn.setBusy(true);

                        //현재 팝업의 BUSY만 ON 처리.
                        //(다른 팝업은 BUSY ON 상태임.)
                        oAPP.fn.setBusyWS20Interaction(true);

                        document.activeElement.blur();

                        resolve(actcd);
                    }
                });

                // oAPP.fn.setBusy(false);

                // //현재 팝업에서 이벤트 발생시 다른 팝업의 BUSY ON 요청 처리.
                // //(다른 팝업에서 이벤트가 발생될 경우 WS20 화면의 BUSY를 먼저 종료 시키는 문제를 방지하기 위함)
                // oAPP.oMain.broadToChild.postMessage({PRCCD:"BUSY_ON"});

                //바인딩 팝업의 BUSY만 종료 처리.
                //(WS20과 다른 팝업은 BUSY 유지 처리.)
                oAPP.fn.setBusyWS20Interaction(false);

            });

            if (_actcd !== "OK") {

                // //WS 3.0 DESIGN 영역에 BUSY OFF 요청 처리.
                // parent.require("./wsDesignHandler/broadcastChannelBindPopup.js")("BUSY_OFF");

                // oAPP.fn.setBusy(false);

                oAPP.fn.setBusyWS20Interaction(false, {});

                return;
            }

            //바인딩 추가 속성 값 얻기.
            var _MPROP = oAPP.fn.setAdditBindData(oContr.oModel.oData.T_MPROP);


            //추가 속성 바인딩 멀티 적용.
            oAPP.attr.oDesign.fn.additionalBindMulti(_MPROP);


            oAPP.attr.oDesign.oModel.refresh(true);


            //tree table 컬럼길이 재조정 처리.
            oAPP.fn.setUiTableAutoResizeColumn(oAPP.attr.oDesign.ui.TREE);


            //090	바인딩 추가 속성 정보를 적용 했습니다.
            sap.m.MessageToast.show(oAPP.WSUTIL.getWsMsgClsTxt(oAPP.attr.GLANGU, "ZMSG_WS_COMMON_001", "090"), 
                {duration: 3000, at:"center center", my:"center center"});

            //해당 영역에서 BUSY OFF 처리하지 않음.
            //바인딩 팝업에서 WS20 디자인 영역에 데이터 전송 ->
            //WS20 디자인 영역에서 데이터 반영 ->
            //WS20 디자인 영역에서 BUSY OFF 요청으로 팝업의 BUSY가 종료됨.

        };


        /*************************************************************
         * @event - 입력필드 변경 이벤트.
         *************************************************************/
        oContr.fn.onChangeInput = function(oEvent){

            var _oUi = oEvent.oSource;

            //UI의 bindingContext에서 데이터 추출.
            var _sAddit = oAPP.fn.getUiContextData(_oUi);
            
            if(typeof _sAddit === "undefined"){
                return;
            }

            //추가속성 정보 conversion 입력필드 변경에 대한 처리.
            oContr.fn.convChangeInput(_sAddit);


        };


        /*************************************************************
         * @event - 입력필드 live change 이벤트.
         *************************************************************/
        oContr.fn.onLiveChangeInput = function(oEvent){

            var _oUi = oEvent.oSource;

            //UI의 bindingContext에서 데이터 추출.
            var _sAddit = oAPP.fn.getUiContextData(_oUi);
            
            if(typeof _sAddit === "undefined"){
                return;
            }

            //conversion 입력라인에 대한 광역 오류 정보 초기화 처리.
            oContr.fn.clearConvError(_sAddit);


        };

        /*************************************************************
         * @event - help 버튼 선택 이벤트.
         *************************************************************/
        oContr.fn.onHelp = async function(oEvent){

            /**
             * @since   2026-04-29 15:26:27
             * @version v3.6.2-0
             * @author  pes
             * @description
             * 도움말 HTML 정보를 U4A HELP DOCUMENT로 통합하게 됨에 따라
             * v3.6.0_00004 버전 이후 부터 U4A HELP DOCUMENT 팝업을 
             * 호출 하도록 로직 개선.
             */
            if(oAPP.common.checkWLOList("C", "UHAK901369") === true){

                oAPP.fn.setBusy(true, {ISBROAD:true});

                //바인딩 팝업 -> DESIGN 영역에 broadCast로 U4A HELP DOCUMENT 호출 요청.
                parent.require("./wsDesignHandler/broadcastChannelBindPopup.js")("U4A_HELP_DOC_OPEN", 
                    {opstion:{startMenuId:"000274"}});
                return;
            }
            
            //202	Bind Additional Attributes Area
            await parent.require("./utils/callTooltipsPopup.js")("bindAdditArea", "202");
            
        };


        /*************************************************************
         * @function - conversion 입력라인에 대한 광역 오류 정보 초기화 처리.
         *************************************************************/
        oContr.fn.clearConvError = function(sAddit){

            //conversion 입력 라인이 아닌경우 exit.
            if(sAddit.ITMCD !== "P06"){
                return;
            }
            
            //오류 표현 초기화.
            sAddit.stat       = null;
            sAddit.statTxt    = "";

            //conversion 라인의 오류 필드 초기화.
            sAddit._error     = false;

            //오류 메시지 초기화.
            sAddit._error_msg = "";
            
            oContr.oModel.refresh();

        };


        /*************************************************************
         * @function - 추가속성 정보 conversion 입력필드 변경에 대한 처리.
         *************************************************************/
        oContr.fn.convChangeInput = async function(sAddit){
            
            oAPP.fn.setBusy(true);

            //conversion 입력 라인이 아닌경우 exit.
            if(sAddit.ITMCD !== "P06"){
                oAPP.fn.setBusy(false);
                return;
            }

            //입력된 값이 존재하지 않는경우.
            if(sAddit.val === ""){

                oContr.oModel.refresh();

                oAPP.fn.setBusy(false);

                return;
            }
            
            //conversion명 대문자 변환 처리.
            oAPP.fn.setConvNameUpperCase(sAddit);
            

            //conversion 명 점검.
            var _sRes = await oAPP.fn.checkConversion(sAddit.val);

            if(_sRes.RETCD === "E"){
                
                //오류 표현 처리.
                sAddit.stat    = "Error";
                sAddit.statTxt = _sRes.RTMSG;

                //conversion 라인의 오류 flag 처리.
                sAddit._error      = true;
                sAddit._error_msg  = _sRes.RTMSG;
                
                oContr.oModel.refresh();

                oAPP.fn.setBusy(false);

                return;
            }

            oContr.oModel.refresh();

            oAPP.fn.setBusy(false);

        };


        /*************************************************************
         * @function - 추가속성 바인딩 정보 가능 여부점검.(ATTR 기준 점검)
         *************************************************************/
        oContr.fn.chkPossibleAdditBind = function(is_attr){

            let _sRes = {RETCD:"", RTMSG:""};

            //ATTRIBUTE 정보가 추가속성 바인딩 불가능.
            if(is_attr.DATYP !== "02"){

                _sRes.RETCD = "E";

                //148	Property 라인만 추가속성 정보를 적용할 수 있습니다.
                _sRes.RTMSG = oAPP.WSUTIL.getWsMsgClsTxt(oAPP.attr.GLANGU, "ZMSG_WS_COMMON_001", "148");

                return _sRes;
            }


            //프로퍼티가 아닌경우 추가속성 바인딩 불가능.
            if(is_attr.UIATY !== "1"){

                _sRes.RETCD = "E";
                //148	Property 라인만 추가속성 정보를 적용할 수 있습니다.
                _sRes.RTMSG = oAPP.WSUTIL.getWsMsgClsTxt(oAPP.attr.GLANGU, "ZMSG_WS_COMMON_001", "148");

                return _sRes;

            }


            //바인딩 처리가 안된경우 추가속성 바인딩 불가능.
            if(is_attr.UIATV === "" || is_attr.ISBND === ""){
                _sRes.RETCD = "E";

                //149	바인딩 정보가 존재하지 않아 추가속성 정보를 적용할 수 없습니다.
                _sRes.RTMSG = oAPP.WSUTIL.getWsMsgClsTxt(oAPP.attr.GLANGU, "ZMSG_WS_COMMON_001", "149");

                return _sRes;
            }

            
            //모델필드의 바인딩 추가 속성 정보 가능 여부 확인.
            _sRes = oContr.fn.chkModelFiendAdditData(is_attr.UIATV);

            if(_sRes.RETCD === "E"){
                return _sRes;
            }

            return _sRes;


        };


        /*************************************************************
         * @function - 모델필드의 바인딩 추가 속성 정보 가능 여부 확인.
         *************************************************************/
        oContr.fn.chkModelFiendAdditData = function(modelField){

            let _sRes = {RETCD:"", RTMSG:""};

            //바인딩 필드의 라인 정보 얻기.
            var _sField = oAPP.fn.getModelBindData(modelField, oAPP.attr.oModel.oData.zTREE);

            //필드 정보를 찾을 수 없는경우.
            if(typeof _sField === "undefined"){
                _sRes.RETCD = "E";

                //150	&1 필드가 모델 항목에 존재하지 않습니다.
                _sRes.RTMSG = oAPP.WSUTIL.getWsMsgClsTxt(oAPP.attr.GLANGU, "ZMSG_WS_COMMON_001", "150", modelField);

                return _sRes;

            }


            //일반 필드가 아닌경우 EXIT.
            if(_sField.KIND !== "E"){
                _sRes.RETCD = "E";
                //151	일반유형의 ABAP TYPE(CHAR, STRING, NUMC, DATE, TIME, INT, P)만 바인딩 추가 속성 정보를 적용할 수 있습니다.
                _sRes.RTMSG = oAPP.WSUTIL.getWsMsgClsTxt(oAPP.attr.GLANGU, "ZMSG_WS_COMMON_001", "151");

                return _sRes;

            }


            var _aMPROP = oContr.oModel.oData.T_MPROP;

            //Bind type
            var _sP04 = _aMPROP.find( item => item.ITMCD === "P04" );

            if(typeof _sP04 === "undefined"){

                _sRes.RETCD = "E";
                //092	Bind type 정보를 찾을 수 없습니다.
                _sRes.RTMSG = oAPP.WSUTIL.getWsMsgClsTxt(oAPP.attr.GLANGU, "ZMSG_WS_COMMON_001", "092");

                return _sRes;

            }


            //Bind type을 설정 했으나, 바인딩된 필드 타입이 P TYPE이 아닌경우.
            if(_sP04.val !== "" && _sField.TYPE_KIND !== "P"){

                _sRes.RETCD = "E";
                //093	Bind type은 ABAP TYPE이 P 유형만 가능합니다.
                _sRes.RTMSG = oAPP.WSUTIL.getWsMsgClsTxt(oAPP.attr.GLANGU, "ZMSG_WS_COMMON_001", "093");

                return _sRes;

            }


            //Reference Field name
            var _sP05 = _aMPROP.find( item => item.ITMCD === "P05" );

            if(typeof _sP05 === "undefined"){

                _sRes.RETCD = "E";
                //136	바인딩 추가 속성 정보 Reference Field name이 존재하지 않습니다.
                _sRes.RTMSG = oAPP.WSUTIL.getWsMsgClsTxt(oAPP.attr.GLANGU, "ZMSG_WS_COMMON_001", "136");

                return _sRes;

            }


            //참조 필드가 입력됐다면
            if(_sP05.val !== ""){

                //참조필드의 부모 path와 바인딩 필드의 부모 path가 다른경우.
                if(_sP05.val.substr(0, _sP05.val.lastIndexOf("-")) !== _sField.CHILD.substr(0, _sField.CHILD.lastIndexOf("-"))){
                    _sRes.RETCD = "E";

                    //152	바인딩 필드와 참조필드의 부모 모델 path가 다릅니다.
                    _sRes.RTMSG = oAPP.WSUTIL.getWsMsgClsTxt(oAPP.attr.GLANGU, "ZMSG_WS_COMMON_001", "152");

                    return _sRes;

                }
                //같은 path로 부터 파생된 UI인지 여부 확인.

            }


            //NOZERO.
            var _sP07 = _aMPROP.find( item => item.ITMCD === "P07" );

            if(typeof _sP07 === "undefined"){

                _sRes.RETCD = "E";
                //094	Nozero 정보를 찾을 수 없습니다.
                _sRes.RTMSG = oAPP.WSUTIL.getWsMsgClsTxt(oAPP.attr.GLANGU, "ZMSG_WS_COMMON_001", "094");

                return _sRes;

            }


            //nozero 불가능 항목.(C:char, g:string)
            var l_nozero = "Cg";

            //nozero가 입력됐으나, 바인딩된 필드가 허용 불가능 타입인경우..
            if(_sP07.val === "true" && l_nozero.indexOf(_sField.TYPE_KIND) !== -1 ){

                _sRes.RETCD = "E";
                //095	ABAP TYPE CHAR, STRING은 Nozero를 설정할 수 없습니다.
                _sRes.RTMSG = oAPP.WSUTIL.getWsMsgClsTxt(oAPP.attr.GLANGU, "ZMSG_WS_COMMON_001", "095");

                return _sRes;

            }


            //Is number format
            var _sP08 = _aMPROP.find( item => item.ITMCD === "P08" );

            if(typeof _sP08 === "undefined"){

                _sRes.RETCD = "E";
                //096	Is number format 정보를 찾을 수 없습니다.
                _sRes.RTMSG = oAPP.WSUTIL.getWsMsgClsTxt(oAPP.attr.GLANGU, "ZMSG_WS_COMMON_001", "096");

                return _sRes;

            }


            //number format 가능항목.(I:int, P: P TYPE)
            var l_numfmt = "IP";

            //numberformat가 입력됐으나, 바인딩된 필드가 허용 불가능 타입인경우..
            if(_sP08.val === "true" && l_numfmt.indexOf(_sField.TYPE_KIND) === -1 ){

                _sRes.RETCD = "E";
                //097	Is number format은 ABAP TYPE INT, P만 사용할 수 있습니다.
                _sRes.RTMSG = oAPP.WSUTIL.getWsMsgClsTxt(oAPP.attr.GLANGU, "ZMSG_WS_COMMON_001", "097");

                return _sRes;

            }

            return _sRes;

        };


        /*************************************************************
         * @function - 추가속성 정보 리스트 오류 초기화.
         *************************************************************/
        oContr.fn.resetErrorField = function(){

            var _aMPROP = oContr.oModel.oData.T_MPROP;

            //바인딩 추가속성 정보 오류 표현 필드 초기화.
            for (let i = 0, l = _aMPROP.length; i < l; i++) {

                var _sMPROP = _aMPROP[i];

                _sMPROP.stat    = null;
                _sMPROP.statTxt = "";
                _sMPROP._style  = "";
                
            }

        };



        /*************************************************************
         * @function - 참조 필드 DDLB 리스트 초기화.
         *************************************************************/
        oContr.fn.clearRefField = function(){

            var _aMPROP = oContr?.oModel?.oData?.T_MPROP;

            if(typeof _aMPROP === "undefined"){
                return;
            }

            if(_aMPROP.length === 0){
                return;
            }

            //Reference Field name 라인 정보 찾기.
            var _sP05 = _aMPROP.find( item => item.ITMCD === "P05");

            //해당 라인을 찾지 못한 경우 exit.
            if(typeof _sP05 === "undefined"){
                return;
            }

            //입력값 초기화.
            _sP05.val    = "";

            //참조 항목 필드 리스트 초기화.
            _sP05.T_DDLB = [];

            oContr.oModel.refresh();

        };


        /*************************************************************
         * @function - 참조 필드 DDLB 리스트 구성
         *************************************************************/
        oContr.fn.setRefFieldList = function(){
            
            //DESIGN TREE의 체크박스 선택건 얻기.
            var _aTree = oAPP.attr.oDesign.fn.getSelectedDesignTree();


            var _aField = [];

            //선택한 라인들중 같은 라인으로 파생됐는지 확인.
            for (let i = 0, l = _aTree.length; i < l; i++) {
                
                var _sTree = _aTree[i];

                //바인딩되지 않은 필드를 선택한 경우 SKIP.
                if(_sTree.UIATV === "" || _sTree.ISBND === ""){
                    continue;
                }

                //프로퍼티를 선택하지 않는 경우.
                if(_sTree.UIATY !== "1"){
                    //참조 필드 리스트 초기화.
                    //참조 필드 라인 선택건 초기화.
                    oContr.fn.clearRefField();

                    return;
                }


                //GT_OTAB-FLD01 형식의 정보에서 마지막 구분자 위치 얻기.
                var _pos = _sTree.UIATV.lastIndexOf("-");

                var _field = _sTree.UIATV.substr(0, _pos);

                //수집되지 않은 항목인 경우 수집 처리.
                if(_aField.indexOf(_field) === -1){
                    _aField.push(_field);
                }
                
            }


            //모델 tree의 라인 선택건 얻기.
            var _sMField = oAPP.fn.getSelectedModelLine();

            //선택된 라인이 존재하는경우.
            if(typeof _sMField !== "undefined"){

                //선택된 라인의 부모 정보 필드가 수집되지 않은 항목인경우 수집.
                if(_aField.indexOf(_sMField.PARENT) === -1){
                    _aField.push(_sMField.PARENT);
                }

            }


            //수집된 항목이 1건을 초과 하는경우
            //(같은 구조, TABLE로 파생된 바인딩 정보가 아닌경우)
            if(_aField.length > 1){

                //참조 필드 리스트 초기화.
                //참조 필드 라인 선택건 초기화.
                oContr.fn.clearRefField();

                return;

            }

            //바인딩한 필드 정보 검색.
            var _sField = oAPP.fn.getModelBindData(_aField[0], oAPP.attr.oModel.oData.zTREE);

            if(typeof _sField === "undefined"){
                //참조 필드 리스트 초기화.
                //참조 필드 라인 선택건 초기화.
                oContr.fn.clearRefField();
                return;
            }


            //구조(TAB) 안에 있는 필드 중 CUKY, UNIT 타입이 없으면 잠김.
            var _aFilt = _sField.zTREE.filter( item => item.DATATYPE === "CUKY" || item.DATATYPE === "UNIT");

            //해당 구조(TAB) 안에 CUKY, UNIT 타입이 없는경우.
            if(_aFilt.length === 0){
                //참조 필드 리스트 초기화.
                //참조 필드 라인 선택건 초기화.
                oContr.fn.clearRefField();
                return;
            }

            var _aMPROP = oContr?.oModel?.oData?.T_MPROP;

            if(typeof _aMPROP === "undefined"){
                return;
            }

            if(_aMPROP.length === 0){
                return;
            }

            //Reference Field name 라인 정보 찾기.
            var _sP05 = _aMPROP.find( item => item.ITMCD === "P05");

            //해당 라인을 찾지 못한 경우 exit.
            if(typeof _sP05 === "undefined"){
                return;
            }


            //참조 항목 필드 리스트 초기화.
            _sP05.T_DDLB = [];

            //공란 추가.
            _sP05.T_DDLB.push(JSON.parse(JSON.stringify(oContr.types.TY_DDLB)));

            for (let i = 0, l = _aFilt.length; i < l; i++) {
                
                var _sField = _aFilt[i];

                var _sDDLB = JSON.parse(JSON.stringify(oContr.types.TY_DDLB));

                _sDDLB.KEY  = _sField.CHILD;
                _sDDLB.TEXT = _sField.CHILD;

                _sP05.T_DDLB.push(_sDDLB);
                
            }


            //구성된 DDLB에 이전에 선택한 필드정보가 존재하지 않는경우 선택건 초기화 처리.
            if(_sP05.T_DDLB.findIndex( item => item.KEY === _sP05.val) === -1){
                //입력값 초기화.
                _sP05.val    = "";
            }

            oContr.oModel.refresh();


        };


        /*************************************************************
         * @function - UI 구성 완료후 call back 처리.
         *************************************************************/
        oContr.fn.uiUpdateComplate = function(oUI){

            return new Promise((res)=>{
                
                if(typeof oUI === "undefined" || oUI === null){
                    return res();
                }

                var _oDelegate = {
                    onAfterRendering:(oEvent)=>{

                        //onAfterRendering 이벤트 제거.
                        oUI.removeEventDelegate(_oDelegate);

                        //onAfterRendering 정보 초기화.
                        oUI.data("_onAfterRendering", null);

                        return res();

                    }
                };

                //onAfterRendering 추가.
                oUI.addEventDelegate(_oDelegate);
                
                //onAfterRendering 정보 매핑.
                oUI.data("_onAfterRendering", _oDelegate);

            });

        };


        /*******************************************************
        * @function - 추가속성 정보 출력 데이터구성.
        *******************************************************/  
        oContr.fn.setAdditialListData = function(){

            oContr.oModel.oData.T_MPROP = [];


            //boolean ddlb 리스트 구성.
            // var lt_bool = [JSON.parse(JSON.stringify(oContr.types.TY_DDLB))];
            var lt_bool = [];
            
            var _sBool = JSON.parse(JSON.stringify(oContr.types.TY_DDLB));
            
            _sBool.KEY = _sBool.TEXT =  "true";
            lt_bool.push(_sBool);

            var _sBool = JSON.parse(JSON.stringify(oContr.types.TY_DDLB));
            
            _sBool.KEY = _sBool.TEXT =  "false";
            lt_bool.push(_sBool);
            _sBool = null;



            //바인딩 추가속성 리스트 얻기.
            var lt_ua028 = oAPP.attr.T_9011.filter(a => a.CATCD === "UA028");

            //itmcd로 정렬 처리.
            lt_ua028.sort(function(a, b){

                return a.ITMCD.localeCompare(b.ITMCD);

            });


            //UI Attrubute bind property DDLB 구성.
            var lt_ua022 = oAPP.attr.T_9011.filter( item => item.CATCD === "UA022" && item.FLD03 === "X" );

            var lt_refList = [JSON.parse(JSON.stringify(oContr.types.TY_DDLB))];

            for (var i = 0, l = lt_ua022.length; i < l; i++) {
                var ls_ua022 = lt_ua022[i];
                
                lt_refList.push({
                    KEY : ls_ua022.FLD01,
                    TEXT: ls_ua022.FLD01
                });
                
            }


            for (var i = 0, l = lt_ua028.length; i < l; i++) {

                var ls_mprop = {};

                ls_mprop.ITMCD       = lt_ua028[i].ITMCD;
                ls_mprop.prop        = lt_ua028[i].FLD01;
                ls_mprop.val         = "";
                ls_mprop.stat        = "None";
                ls_mprop.statTxt     = "";
                ls_mprop.isFieldInfo = false;
    
                ls_mprop.edit        = false;
                ls_mprop.inp_vis     = false;
                ls_mprop.sel_vis     = false;
                ls_mprop.txt_vis     = false;
                ls_mprop._style      = "";

                switch (ls_mprop.ITMCD) {
                    case "P01": //Field name
                    case "P02": //Field path
                    case "P03": //type
                        ls_mprop.isFieldInfo = true;
                        break;

                    case "P04": //Bind type
                        ls_mprop.edit    = true;
                        ls_mprop.sel_vis = true;
                        ls_mprop.T_DDLB  = JSON.parse(JSON.stringify(lt_refList));
                        break;
                    
                    case "P05": //Reference Field name
                        ls_mprop.sel_vis = true;
                        
                        break;

                    case "P06": //Conversion Routine
                        
                        ls_mprop.maxlen  = 5;

                        ls_mprop.edit    = true;
                        ls_mprop.inp_vis = true;
                        
                        break;
                    
                    case "P07": //Nozero

                        ls_mprop.val     = "false";

                        ls_mprop.edit    = true;
                        ls_mprop.sel_vis = true;
                        ls_mprop.T_DDLB  = JSON.parse(JSON.stringify(lt_bool));
                        break;
                    
                    case "P08": //Is number format?

                        ls_mprop.val     = "false";

                        ls_mprop.edit    = true;
                        ls_mprop.sel_vis = true;
                        ls_mprop.T_DDLB  = JSON.parse(JSON.stringify(lt_bool));
                        break;

                    default:
                        break;
                }


                oContr.oModel.oData.T_MPROP.push(ls_mprop);

            }
        };


        /*******************************************************
        * @function - 추가속성 바인딩 버튼 활성처리.
        *******************************************************/  
        oContr.fn.setAdditBindButtonEnable = function(bEnable){

            //추가속성 바인딩 버튼 활성처리.
            _setAdditBindButtonEnable(bEnable);

            oContr.oModel.refresh();

        };


        /*******************************************************
        * @function - 화면 잠금 / 잠금해제 처리.
        *******************************************************/  
        oContr.fn.setViewEditable = function(bLock){


            //applicationdl 조회모드인경우 exit.
            if(oAPP.attr.oAppInfo.IS_EDIT === ""){
                return;
            }


            //추가속성 화면 입력 필드 잠금 / 잠금 해제 처리.
            oContr.oModel.oData.edit = bLock;


            //추가속성 바인딩 버튼 활성처리.
            _setAdditBindButtonEnable(bLock);

            oContr.oModel.refresh();


        };


        return res(oContr);
        
    });

}



/********************************************************************
 *📝 바인딩 추가속성 정보 화면 구성.
********************************************************************/
function designView(oArea, oTable){

    return new Promise(async (res)=>{

        //control 정보 구성.
        let oContr = await designControl(oArea);


        //098	추가 속성 바인딩
        var _txt1 = oAPP.WSUTIL.getWsMsgClsTxt(oAPP.attr.GLANGU, "ZMSG_WS_COMMON_001", "098");


        //161	컬럼최적화
        var _txt2 = oAPP.WSUTIL.getWsMsgClsTxt(oAPP.attr.GLANGU, "ZMSG_WS_COMMON_001", "161");

        //198	Help
        var _txt3 = oAPP.WSUTIL.getWsMsgClsTxt(oAPP.attr.GLANGU, "ZMSG_WS_COMMON_001", "198");

        //바인딩 추가속성 정보 table.
        var oTab = new sap.ui.table.Table({
            selectionMode: "None",
            selectionBehavior: "RowOnly",
            visibleRowCountMode: "Auto",
            width: "100%",
            visible: "{/resize}",
            rowHeight:30,
            layoutData: new sap.ui.layout.SplitterLayoutData()
        });
        oContr.ui.ROOT = oTab;

        //메인의 추가속성 정보 table 이름 마킹.
        //(우측 추가속성 정보 테이블)
        oContr.ui.ROOT.data("TAB_NAME", "MAIN_ADDIT");

        oContr.ui.ROOT.setModel(oContr.oModel);

        oContr.ui.ROOT.addExtension(
            new sap.m.OverflowToolbar({
                content:[
                    new sap.m.Button({
                        text:_txt1,     //098	추가 속성 바인딩
                        tooltip: _txt1, //098	추가 속성 바인딩
                        icon:"sap-icon://multiselect-all",
                        type:"Emphasized",
                        enabled: "{/edit_additbind}",
                        press: oContr.fn.onMultiAdditionalBind
                    }).addStyleClass("sapUiTinyMarginEnd"),

                    new sap.m.ToolbarSpacer(),

                    new sap.m.OverflowToolbarButton({
                        icon: "sap-icon://resize-horizontal",
                        text : _txt2,    //161	컬럼최적화
                        tooltip: _txt2,    //161	컬럼최적화
                        busyIndicatorDelay: 1,
                        press: function(){
                            //tree table 컬럼길이 재조정 처리.
                            oAPP.fn.setUiTableAutoResizeColumn(oContr.ui.ROOT);
                        }
                    }),
                    new sap.m.OverflowToolbarButton({
                        icon:"sap-icon://question-mark", 
                        text : _txt3,    //198	Help
                        tooltip: _txt3,    //198	Help
                        press: oContr.fn.onHelp
                    })

                ]
            })
        );


        var _oUtil = await import("../utils/setStyleClassUiTable.js");

        //tree table의 style class 처리.
        _oUtil.setStyleClassUiTable(oContr.ui.ROOT, "_style");


        //177	Property
        var l_txt = oAPP.WSUTIL.getWsMsgClsTxt(oAPP.attr.GLANGU, "ZMSG_WS_COMMON_001", "177");

        //추가바인딩 속성의 Property 컬럼.
        var oTabCol1 = new sap.ui.table.Column({
            autoResizable:true,
            label: new sap.m.Label({
                text: l_txt,
                tooltip: l_txt,
                design: "Bold"
            }),
            template: new sap.m.Text({
                text: "{prop}"
            })
        });
        oTab.addColumn(oTabCol1);
        
        //178	Value
        var l_txt = oAPP.WSUTIL.getWsMsgClsTxt(oAPP.attr.GLANGU, "ZMSG_WS_COMMON_001", "178");

        //추가바인딩 속성의 value 컬럼.
        var oTabCol2 = new sap.ui.table.Column({
            autoResizable:true,
            label: new sap.m.Label({
                text: l_txt,
                tooltip: l_txt,
                design: "Bold"
            }),
            template: new sap.m.Text({
                text: "{val}"
            })
        });
        oTab.addColumn(oTabCol2);

        var oTabCol2HBox1 = new sap.m.HBox({
            justifyContent: "Center",
            renderType: "Bare",
            direction: "Column"
        });
        oTabCol2.setTemplate(oTabCol2HBox1);

        //추가속성정보 TEXT.
        var oTabCol2Txt1 = new sap.m.Text({
            text: "{val}",
            visible: "{txt_vis}"
        });
        oTabCol2HBox1.addItem(oTabCol2Txt1);

        //추가속성정보 입력 필드.
        var oTabCol2Inp1 = new sap.m.Input({
            value: "{val}",
            visible: "{inp_vis}",
            editable: "{edit}",
            maxLength: "{maxlen}",
            valueState: "{stat}",
            valueStateText: "{statTxt}",
            enabled: "{/edit}",
            showClearIcon : true,
            change: oContr.fn.onChangeInput,
            liveChange: oContr.fn.onLiveChangeInput
        });
        oTabCol2HBox1.addItem(oTabCol2Inp1);


        //추가속성정보 DDLB 필드.
        var oTabCol2Sel1 = new sap.m.Select({
            selectedKey: "{val}",
            visible: "{sel_vis}",
            editable: "{edit}",
            valueState: "{stat}",
            valueStateText: "{statTxt}",
            enabled: "{/edit}"
        });
        oTabCol2HBox1.addItem(oTabCol2Sel1);

        //바인딩 추가속성 정보 DDLB 선택 이벤트.
        oTabCol2Sel1.attachChange(function (oEvent) {

            var _oUi = oEvent.oSource;

            //바인딩 추가속성 정보 DDLB 선택 이벤트.
            oAPP.fn.setAddtBindInfoDDLB(_oUi);

            // //바인딩 추가속성값 설정.
            // oAPP.fn.setMPROP();

        });

        //DDLB ITEM 바인딩 처리.
        oTabCol2Sel1.bindAggregation("items", {
            path: "T_DDLB",
            template: new sap.ui.core.Item({
                key: "{KEY}",
                text: "{TEXT}"
            }),
            templateShareable: true
        });

        //추가속성 정보 바인딩 처리.
        oTab.bindAggregation("rows", {
            path: "/T_MPROP",
            templateShareable: true,
            template: new sap.ui.table.Row()
        });

        

        var _oPromise = oContr.fn.uiUpdateComplate(oArea);

        oArea.addAggregation("content", oContr.ui.ROOT, true);

        oArea.invalidate();

        await _oPromise;



        return res(oContr);

    });

}



