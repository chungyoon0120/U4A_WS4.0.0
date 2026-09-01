//AI와 통신을 통한 UI 생성 처리.
const C_TRANS_AI_DATA = "TRANS_AI_DATA";

//DESIGN TREE 영역에 DROP을 통한 UI 생성 처리.
const C_DESIGN_DROP = "DESIGN_DROP";

//DESIGN TREE 영역에서 붙여넣기를 통한 UI 생성 처리.
const C_DESIGN_PASTE = "DESIGN_PASTE";


//ROOT UI 인경우 대체 ROOT UI 매핑 정보.
const CS_ROOT = {
    ROOT_ID : "ROOT",
    ROOT_UI : "APP"
}


//전달받은 데이터의 최상위 UI 제거 정보.
const C_REMOVE_ROOT = {
    UILIB : "sap.m.App",
    AGRNM : "pages"
};

//처리결과 메시지 구조.
const TY_RET = {
    RETCD : "",
    RTMSG : "",
};


//WS10_20 공통 기능 인스턴스 객체.
let oAPP = undefined;

//ui5 라이브러리.
let sap = undefined;


/*********************************************************
 * @module - AI Library Data Parser
 * @description - AI로부터 전달받은 UI5 라이브러리 데이터를 파싱하여 UI를 생성하는 모듈.
 * @author - PES
 * @date - 2025-07-03
 * @params {sAiParams} - AI를 통해 전달받은 UI5 정보를 기반으로 UI를 생성하는 파라메터 객체.
 *  sAiParams.oAPP   - WS10_20 공통 기능 인스턴스 객체.
 *  sAiParams.ACTCD  - 액션 코드.
 *                   TRANS_AI_DATA : AI와 통신을 통한 UI 생성 처리.
 *                   DESIGN_DROP   : DESIGN TREE 영역에 DROP을 통한 UI 생성 처리.
 *                   DESIGN_PASTE  : DESIGN TREE 영역에서 붙여넣기를 통한 UI 생성 처리.
 * 
 *  sAiParams.OBJID  - AI를 통해 전달받은 UI를 추가하는 TARGET UI명(PAGE).
 *                     해당 파라메터는 OPTIONAL 파라메터. 전달받지 않는경우 선택한 라인의
 *                     UI명으로 설정 처리.
 *
 *  sAiParams.THEME_NAME - UI5 테마 이름.(예: sap_horizon_3)
 *  sAiParams.T_0014 - UI 정보
 *  sAiParams.T_0015 - UI의 attribute(property, event, aggregation) 정보
 * 
 ********************************************************/
module.exports = async function(sAiParams){

    console.log(`
************************************************************
*   [AI] parseAiLibraryData.js 
*   AI를 통한 UI 생성처리 
*   ACTCD : ${sAiParams?.ACTCD}
*   OBJID : ${sAiParams?.OBJID}
*   생성할 UI COUNT : ${sAiParams?.T_0014?.length}
*   생성할 ATTR COUNT : ${sAiParams?.T_0015?.length}
************************************************************`);

    //WS10_20 공통 기능 인스턴스 객체가 정의되지 않은 경우.
    if(typeof oAPP === "undefined"){
        //전달 받은 파라메터에서 oAPP를 가져옴.
        oAPP = sAiParams?.oAPP;

    }
    

    //UI5 라이브러리가 정의되지 않은 경우.
    if(typeof sap === "undefined"){
        //oAPP 인스턴스에서 UI5 라이브러리를 가져옴.
        sap = oAPP.oDesign.fn.getUI5RootInstance();
    }

    
    //현재 어플리케이션이 편집 모드가 아닌경우.
    if(oAPP.attr.appInfo.IS_EDIT === ""){
        
        var _sRes = {...TY_RET};

        _sRes.RETCD = "E";
        
        //419	AI 기반 UI 생성은 조회 상태에서 사용할 수 없습니다.
        _sRes.RTMSG = parent.WSUTIL.getWsMsgClsTxt("", "ZMSG_WS_COMMON_001", "419");

        //편집 모드인 경우.
        parent.showMessage(sap, 20, "I", _sRes.RTMSG);

        return _sRes;
        
    }

    
    //전달받은 파라메터에서 UI 정보만 발췌
    var _sAppData = {...TY_RET};

    _sAppData.RCODE  = "";

    //UNDO, HISTORY 구성을 위한 랜덤키 생성.
    _sAppData.RAND   = oAPP.fn.getRandomKey();

    //UI를 구성하기 위한 정보 발췌.
    _sAppData.T_0014 = sAiParams.T_0014;
    _sAppData.T_0015 = sAiParams.T_0015;

    //테마명.
    _sAppData.THEME_NAME = sAiParams?.THEME_NAME || "";
    
    _sAppData.sParent = undefined;


    //액션 코드에 따른 로직 분기.
    //DROP인경우 BUSY, 팝업 호출 여부를 확인하지 않음.
    switch (sAiParams.ACTCD) {
        case C_TRANS_AI_DATA:
            //AI와 통신을 통한 UI 생성 처리.
            
            //UI를 생성 가능한 상태인지 확인.
            _sAppData = chkValidState(_sAppData);
            
            break;
    
        default:
            break;
    }


    //점검 오류건이 존재하는경우.
    if(_sAppData.RETCD === "E"){

        var _sRes = {...TY_RET};

        _sRes.RETCD = _sAppData.RETCD;
        
        _sRes.RTMSG = _sAppData.RTMSG;

        //오류 메시지 출력.
        parent.showMessage(sap, 20, "I", _sRes.RTMSG);
        
        //단축키 잠금 해제처리.
        oAPP.fn.setShortcutLock(false);
            
        parent.setBusy("");


        return _sRes;

    }

    
    parent.setBusy("X");

    //단축키 잠금처리.
    oAPP.fn.setShortcutLock(true);

   
    //UI를 추가하는 TARGET UI명(PAGE)이 있는경우.
    if(sAiParams?.OBJID){
        //해당 UI명의 라인 정보 얻기.
        _sAppData.sParent = oAPP.fn.getTreeData(sAiParams.OBJID);
    }
    

    //UI를 추가하는 TARGET UI명(PAGE)이 없는경우.
    if(!_sAppData.sParent){
        //선택한 라인 정보 얻기. 
        _sAppData.sParent = oAPP.fn.designGetSelectedTreeItem();
    }
    
    
    console.log(`[AI] - 추가 대상 OBJID : ${_sAppData?.sParent?.OBJID}`);

    
    //aggregation 선택 팝업 및 확인 팝업 호출에 대한 로직 처리.
    _sAppData = await setAiDataParentAggr(_sAppData);

    //처리결과 오류건이 존재하는경우.
    if(_sAppData.RETCD === "E"){

        var _sRes = {...TY_RET};

        _sRes.RETCD = _sAppData.RETCD;
        
        _sRes.RTMSG = _sAppData.RTMSG;

        //default 메시지 유형(messageToast)
        var _KIND = 10;

        //aggregation 선택 건이 존재하지 않는 return code를 받은경우.
        if(_sAppData.RCODE === "02"){
            //messageBox로 처리.
            _KIND = 20;
        }

        //편집 모드인 경우.
        parent.showMessage(sap, _KIND, "I", _sRes.RTMSG);

        //단축키 잠금 해제처리.
        oAPP.fn.setShortcutLock(false);
            
        parent.setBusy("");

        return _sRes;

    }

    
    //구성한 UI, attribute 정보를 RETURN 처리.
    _sAppData = rebuildAppData(_sAppData);


    //ROOT, APP UI 정보 설정.
    _sAppData = setRootAppData(_sAppData);

    
    //구성한 UI, attribute 정보를 기준으로 design tree, 
    //attribute, 미리보기 영역의 UI 정보를 생성 하는 함수.
    _sAppData = await createAppData(_sAppData);


    // //처리 결과 반환.
    return {RETCD:_sAppData.RETCD, RTMSG: _sAppData.RTMSG};

};



/*********************************************************
 * @function - AI로 부터 전달받은 UI를 생성 가능 여부 점검.
 * @param {sAppData} - AI 처리 대상 Object.
 ********************************************************/
function chkValidState(sAppData){

    //UI를 생성 가능한 상태인지 확인.
    sAppData = chkUiCreateReadyState(sAppData);

    if(sAppData.RETCD === "E"){
        return sAppData;
    }


    //AI로 부터 전달받은 UI의 정합성 점검.
    sAppData = chkAiTransData(sAppData);

    if(sAppData.RETCD === "E"){
        return sAppData;
    }

    return sAppData;

}



/*********************************************************
 * @function - AI로 부터 전달받은 UI를 기준으로 추가 가능 정보 확인.
 * @param {sAppData} - AI 처리 대상 Object.
 *  sAiParams.T_0014 - AI로 부터 전달 받은 UI 정보
 *  sAiParams.T_0015 - AI로 부터 전달 받은 UI의 attribute(property, event, aggregation) 정보
 *  sAiParams.sParent - UI가 추가될 DESIGN 영역의 부모 라인 정보.
 ********************************************************/
async function setAiDataParentAggr(sAppData) {

    //AI로 부터 전달받은 UI의 ROOT UI를 얻음.
    var _sAIRoot = sAppData.T_0014.find( item => item.POBID === "");

    //현재 DESIGN TREE에서 선택한 UI가 ROOT 이면서, AI로 부터 전달받은 UI의 ROOT가 sap.m.App 라면(APP).
    if(sAppData.sParent.OBJID === CS_ROOT.ROOT_ID && _sAIRoot.OBJID === CS_ROOT.ROOT_UI){
        
        var _sMsgConfig = {};
    
        _sMsgConfig.state = "Information";

        //418	정보
        _sMsgConfig.title = parent.WSUTIL.getWsMsgClsTxt("", "ZMSG_WS_COMMON_001", "418");

        //default 메시지.
        //420	AI가 생성한 UI를 기준으로 화면을 다시 구성하시겠습니까?
        _sMsgConfig.msg = parent.WSUTIL.getWsMsgClsTxt("", "ZMSG_WS_COMMON_001", "420");

        //421	예
        //422	아니오
        //default 버튼.
        _sMsgConfig.T_BUTTON = [
            {ACTCD:"YES", text:parent.WSUTIL.getWsMsgClsTxt("", "ZMSG_WS_COMMON_001", "421")}, 
            {ACTCD:"CANCEL", text:parent.WSUTIL.getWsMsgClsTxt("", "ZMSG_WS_COMMON_001", "422")}
        ];

        //확인 팝업 호출.
        var _ret = await callMessagePopup(_sMsgConfig);

        //확인 팝업에서 취소한경우.
        if(typeof _ret === "undefined" || _ret === "CANCEL"){

            sAppData.RETCD = "E";

            //424	취소 했습니다.
            sAppData.RTMSG = parent.WSUTIL.getWsMsgClsTxt("", "ZMSG_WS_COMMON_001", "424");
            
            return sAppData;
        }

        parent.setBusy("X");

        
        //단축키 잠금처리.
        oAPP.fn.setShortcutLock(true);

        //APP 라인 정보 얻기.
        var _sAPP = oAPP.fn.getTreeData(CS_ROOT.ROOT_UI);

        //APP의 ATTR 변경건 이력 설정.
        var _sUndoHist = {
            ROOT : _sAPP.OBJID,
            PRCCD : "CHANGE_ATTR",
            RAND : sAppData.RAND,
            HIST : oAPP.attr.prev[_sAPP.OBJID]._T_0015
        };

        //UNDO 이력 추가.
        parent.require(oAPP.oDesign.pathInfo.undoRedo).saveActionHistoryData("AI_INSERT", _sUndoHist);


        var _sUndoHist = {
            ROOT : _sAPP.OBJID,
            PRCCD : "DEL",
            RAND : sAppData.RAND,
            HIST : _sAPP.zTREE
        };

        //UNDO 이력 추가.
        parent.require(oAPP.oDesign.pathInfo.undoRedo).saveActionHistoryData("AI_INSERT", _sUndoHist);


        //기존 DESIGN TREE의 APP에 수집된 ATTR 항목 병합 처리.
        for (let i = 0, l = oAPP.attr.prev.APP._T_0015.length; i < l; i++) {
            
            var _s0015 = oAPP.attr.prev.APP._T_0015[i];

            //AI로 부터 전달받은 ROOT의 ATTR에 수집 됐는지 확인
            var _found = sAppData.T_0015.findIndex( item => 
                item.OBJID === _sAIRoot.OBJID && 
                item.UIATT === _s0015.UIATT && 
                item.UIATY === _s0015.UIATY );

            //수집 됐다면 skip.
            if(_found !== -1){
                continue;
            }

            sAppData.T_0015.push(_s0015);
            
        }

        
        //대상 UI의 클라이언트 이벤트, desc 정보 수집건 정보 제거 처리.
        removeUiSubData(_sAPP.zTREE);


        //ROOT의 CHILD 정보 모두 제거 처리.
        sAppData.sParent.zTREE = [];

        
        //ai의 ROOT UI를 매핑.
        sAppData.sAiParent = _sAIRoot;

        return sAppData;

    }

    
    //선택한 라인이 ROOT 인경우.
    if(sAppData.sParent.OBJID === CS_ROOT.ROOT_ID){
        //APP로 대체 처리.
        sAppData.sParent = oAPP.fn.getTreeData(CS_ROOT.ROOT_UI);
    }

    
    //AI로 부터 전달받은 ROOT UI가 APP 인경우.
    var _isRemoved = removeRootAppAIData(sAppData);

    //최상위 UI가 제거된 경우.
    if(_isRemoved === true){
        //ROOT가 된 CHILD UI중 embed aggregation이 제거된 UI를 얻기.
        _sAIRoot = sAppData.T_0014.find( item => item.POBID === "" && item.UIATT === C_REMOVE_ROOT.AGRNM );
    }


    //대상 UI 검색.
    var _s0022 = oAPP.DATA.LIB.T_0022.find( item => item.LIBNM === _sAIRoot.UILIB );

    if(typeof _s0022 !== "undefined"){
        _sAIRoot.UIOBK = _s0022.UIOBK;
    }


    /**
     * @since   2026-08-14 19:22:08
     * @version vNAN-NAN
     * @author  pes
     * @description
     * oAPP.fn.chkAggrRelation 함수에서 추가 가능 aggregation 구성시,
     * 구성되지 않는 aggregation이 존재하는 경우, 오류 내용과 메시지를 같이 구성하도록
     * 내용이 변경되어 기존 로직 주석 처리.
     */
    // //입력 UI의 UI 가능 AGGREGATION 정보 얻기.
    // var _aT_AGGR = oAPP.fn.chkAggrRelation(sAppData.sParent.UIOBK, sAppData.sParent.OBJID, _sAIRoot.UIOBK);

    // //추가 가능한 aggregation 항목이 존재하지 않는경우.
    // if(_aT_AGGR.length === 0){

    //     sAppData.RETCD = "E";

    //     //RCODE 02 : 선택할 aggregation이 존재하지 않음
    //     sAppData.RCODE = "02";

    //     //425	선택 가능한 Aggregation이 존재하지 않습니다.
    //     sAppData.RTMSG = parent.WSUTIL.getWsMsgClsTxt("", "ZMSG_WS_COMMON_001", "425");
        
    //     return sAppData;

    // }

    const _sRes = oAPP.fn.chkAggrRelation(sAppData.sParent.UIOBK, sAppData.sParent.OBJID, _sAIRoot.UIOBK);
    if(_sRes.RETCD === "E"){

        sAppData.RETCD = _sRes.RETCD;

        //RCODE 02 : 선택할 aggregation이 존재하지 않음
        sAppData.RCODE = "02";

        //425	선택 가능한 Aggregation이 존재하지 않습니다.
        sAppData.RTMSG = _sRes.RTMSG;
        
        return sAppData;
    }

    
    var _sMsgConfig = {};
    
    _sMsgConfig.state = "Information";

    //418	정보
    _sMsgConfig.title = parent.WSUTIL.getWsMsgClsTxt("", "ZMSG_WS_COMMON_001", "418");


    //default 메시지.
    //423	AI가 생성한 UI 정보를 &1 영역에 추가하시겠습니까?
    _sMsgConfig.msg = parent.WSUTIL.getWsMsgClsTxt("", "ZMSG_WS_COMMON_001", "423", sAppData.sParent.OBJID);

    _sMsgConfig.width = "500px";

    
    //426	UI 초기화 후 적용
    //427	UI 유지 후 적용
    //003	취소
    _sMsgConfig.T_BUTTON = [
        {ACTCD:"YES", text:parent.WSUTIL.getWsMsgClsTxt("", "ZMSG_WS_COMMON_001", "426")}, 
        {ACTCD:"NO", text:parent.WSUTIL.getWsMsgClsTxt("", "ZMSG_WS_COMMON_001", "427")},
        {ACTCD:"CANCEL", text:parent.WSUTIL.getWsMsgClsTxt("", "ZMSG_WS_COMMON_001", "003")}
    ];


    
    //확인 팝업 호출.
    var _ret = await callMessagePopup(_sMsgConfig);

    if(typeof _ret === "undefined" || _ret === "CANCEL"){

        sAppData.RETCD = "E";

        //424	취소 했습니다.
        sAppData.RTMSG = parent.WSUTIL.getWsMsgClsTxt("", "ZMSG_WS_COMMON_001", "424");
        
        return sAppData;

    }


    //design TREE에서 선택한 라인이 APP 인경우, 
    //AI로 부터 전달받은 ROOT UI가 APP 라면.

    //AI로 부터 전달받은 ROOT를 제거 처리.

    //AGGREGATION 선택 팝업 호출.
    var _sResAggr = await getEmbeddedAggregation(_sAIRoot, sAppData.sParent);

    //AGGREGATION 선택 팝업에서 취소, 추가 가능한 AGGREGATION이 없는경우.
    if(_sResAggr.RETCD === "E"){

        sAppData.RETCD = _sResAggr.RETCD;
        
        sAppData.RTMSG = _sResAggr.RTMSG;
        
        return sAppData;

    }
    

    parent.setBusy("X");
        
    //단축키 잠금처리.
    oAPP.fn.setShortcutLock(true);

    

    var _sUndoHist = {
        ROOT : sAppData.sParent.OBJID,
        PRCCD : "DEL",
        RAND : sAppData.RAND,
        HIST : sAppData.sParent.zTREE
    };

    //UNDO 이력 추가.
    parent.require(oAPP.oDesign.pathInfo.undoRedo).saveActionHistoryData("AI_INSERT", _sUndoHist);



    //확인 팝업에서 YES를 선택 한 경우.
    if(_ret === "YES"){

        //대상 UI의 클라이언트 이벤트, desc 정보 수집건 정보 제거 처리.
        removeUiSubData(sAppData.sParent.zTREE.filter( item => item.UIATK === _sResAggr.sAggr.UIATK ));

        //선택한 aggregation의 child를 제거 처리.
        sAppData.sParent.zTREE = sAppData.sParent.zTREE.filter( item => item.UIATK !== _sResAggr.sAggr.UIATK );
    }


    //부모 UI 정보가 존재하지 않는건 검색.
    var _aT_0014 = sAppData.T_0014.filter( item => item.POBID === "" );


    for (let i = 0; i < _aT_0014.length; i++) {
        
        var _s0014 = _aT_0014[i];

        
        //embed aggregation 초기화 대상 UI가 아닌 경우 skip.
        if(_s0014.UIATT !== C_REMOVE_ROOT.AGRNM){
            continue;
        }

        //ai의 ROOT UI를 매핑.
        sAppData.sAiParent = _s0014;

        var _s0022 = oAPP.DATA.LIB.T_0022.find( item =>  item.LIBNM === _s0014.UILIB );

        //Aggregation 정보로부터 _s0014 및 _s0015 구조 구성
        var _s0015 = setRootEmbeddedAggregation(_s0014, _s0022, _sResAggr.sAggr);

        sAppData.T_0015.splice(0, 0, _s0015);
        
    }

    return sAppData;

    
}




/*********************************************************
 * @function - 대상 UI의 클라이언트 이벤트, desc 정보 수집건 정보 제거 처리.
 ********************************************************/
function removeUiSubData(aDesignTree){

    for (let i = 0; i < aDesignTree.length; i++) {
        
        var _sDesignTree = aDesignTree[i];

        //하위를 탐색하며, UI의 클라이언트 이벤트, desc 정보 수집건 정보 제거 처리.
        removeUiSubData(_sDesignTree.zTREE);


        //클라이언트 이벤트 및 sap.ui.core.HTML의 프로퍼티 입력건 제거 처리.
        oAPP.fn.delUiClientEvent(_sDesignTree);


        //Description 삭제.
        oAPP.fn.delDesc(_sDesignTree.OBJID);


        //팝업 수집건에서 해당 UI 제거 처리.
        oAPP.fn.removeCollectPopup(_sDesignTree.OBJID);
        
    }

}




/*********************************************************
 * @function - 최상위 UI 제거 처리.
 ********************************************************/
function removeRootAppAIData(sAppData){
    
    //최상위 라인 정보 얻기.
    var _indx = sAppData.T_0014.findIndex( item => item.POBID === "" );

    if(_indx === -1){
        return;
    }

    //최상위 UI 정보 얻기.
    let _s0014 = sAppData.T_0014[_indx];

    
    //전달받은 UI정보의 root가 sap.m.App가 아닌경우 exit.
    if(_s0014?.UILIB !== C_REMOVE_ROOT.UILIB){
        return;
    }

    //AI로 부터 입력받은 최상위 UI 제거 처리.
    sAppData.T_0014.splice(_indx, 1);

    //최상위 UI의 CHILD UI 정보 검색.
    var _aChild = sAppData.T_0014.filter( item => item.POBID === _s0014.OBJID );

    if(_aChild.length === 0){
        return;
    }

    //최상위 UI의 child UI의 부모 UI 정보 초기화.
    for (let i = 0, l = _aChild.length; i < l; i++) {

        var _sChild = _aChild[i];

        _sChild.POBID = "";

        //embed aggregation 제외 대상 UI이 아닌경우 skip.
        if(_sChild.UIATT !== C_REMOVE_ROOT.AGRNM){
            continue;
        }

        //child UI의 embed aggregation 라인 정보 얻기.
        var _indx = sAppData.T_0015.findIndex( item => item.OBJID === _sChild.OBJID && item.UIATY === "6" );

        if(_indx === -1){
            continue;
        }

        //embed aggregation 라인 제거.
        sAppData.T_0015.splice(_indx, 1);

    }


    return true;


}




/*********************************************************
 * @function - callMessagePopup
 * @description - 메시지 팝업 호출 함수.
 * @param {sMsgInfo} - 메시지 정보 객체
 *  sMsgInfo.title - 메시지 팝업 제목
 *  sMsgInfo.state - 메시지 팝업 상태(Error, Warring) * 
 *  sMsgInfo.msg   - 메시지 내용
 *  sMsgInfo.width - 팝업 width
 *  sMsgInfo.height - 팝업 height
 *  sMsgInfo.draggable - 팝업 drag 가능 여부
 *  sMsgInfo.T_BUTTON - 메시지 팝업에서 사용할 버튼 배열
 *    ACTCD - 버튼 액션 코드 🚩필수🚩
 *    text  - 버튼 텍스트    🚩필수🚩
 *    icon  - 버튼 아이콘
 *    type  - 버튼 타입 (Default, Accept, Reject 등)
 ********************************************************/
function callMessagePopup(sMsgInfo) {

    return new Promise((resolve) => {

        var _aBtn = [];

        for (let i = 0, l = sMsgInfo.T_BUTTON.length; i < l; i++) {

            var _sBtn = sMsgInfo.T_BUTTON[i];

            _aBtn.push(
                new sap.m.Button({
                    text : _sBtn.text || "",
                    icon : _sBtn.icon || undefined,
                    type : _sBtn.type || undefined,
                    press : function(){

                        //팝업 종료 처리.
                        _oDialog.close();

                        //선택한 버튼의 ACTION CODE를 RETURN 처리.
                        resolve(this.data("ACTCD"));
                    }
                }).data("ACTCD", _sBtn.ACTCD)
            );
            
        }

        
        //메시지 확인 팝업.
        var _oDialog = new sap.m.Dialog({
            title: sMsgInfo?.title || "",
            state: sMsgInfo?.state || undefined,
            type: "Message",
            contentWidth : sMsgInfo?.width || undefined,
            contentHeight : sMsgInfo?.height || undefined,
            draggable : sMsgInfo?.draggable || undefined,
            escapeHandler : function(oEvent){
                //esc키를 통해 aggregation 선택 팝업 종료 처리.
                oEvent.resolve();

                //메시지 팝업을 호출한 호출처에 결과 return.
                //(ACTION CODE를 전달 하지 않음)
                resolve();

            },

            afterOpen: function(){

                //단축키 잠금 해제처리.
                oAPP.fn.setShortcutLock(false);

                parent.setBusy("");


            },

            afterClose: function() {
                //팝업 닫힘 처리.
                _oDialog.destroy();

            },

            content : [
                //메시지 팝업의 TEXT 출력.
                new sap.m.FormattedText({
                    htmlText : sMsgInfo?.msg || ""
                })
            ],

            buttons:_aBtn


        }).addStyleClass("sapUiSizeCompact");


        _oDialog.open();


    });

} //callMessagePopup




/*********************************************************
 * @function - 대상 UI의 추가될 aggregation 정보 얻기.
 * @param {sSource} - 부모에 추가할 UI 라인 정보.
 * @param {sTarget} - UI가 추가될 부모 라인 정보
 ********************************************************/
function getEmbeddedAggregation(sSource, sTarget){

    return new Promise(async function (resolve) {

        //aggregation 선택 팝업이 로드되지 않은경우.
        if(typeof oAPP.fn.aggrSelectPopup === "undefined"){

            //UI 추가 팝업 정보가 존재하지 않는다면 JS 호출 후 팝업 호출.
            await new Promise(function(resJSLoad){

                oAPP.fn.getScript("design/js/aggrSelectPopup",function(){
                    resJSLoad();
                });

            });

        }


        //aggregation 선택 팝업 호출.
        oAPP.fn.aggrSelectPopup(sSource, sTarget, function(sAggr, sChild, sParent){
            
            parent.setBusy("X");

            //단축키 잠금 처리.
            oAPP.fn.setShortcutLock(true);

            let _sRes = JSON.parse(JSON.stringify(TY_RET));

            _sRes.sAggr   = sAggr;
            _sRes.sChild  = sChild;
            _sRes.sParent = sParent;
            
            resolve(_sRes);

        }, undefined, undefined, function(sRes){
            //취소시 전달받은 파라메터 정보 RETURN.
            resolve(sRes);

        });
        
    });

}




/*********************************************************
 * @function - chkAiTransData
 * @description - AI로 부터 전달받은 UI의 정합성 점검.
 * @param {sAppData} - UI 정보 객체
 *  sAppData.RETCD - AI에서 UI 구성시 처리한 결과 코드.("E" - 오류)
 *  sAppData.RTMSG - AI에서 UI 구성시 처리한 결과 메시지(오류 발생시 메시지).
 *  sAppData.T_0014 - UI 정보
 *  sAppData.T_0015 - UI의 attribute(property, event, aggregation) 정보
 * @returns {boolean} - 정합성 검사 결과(true: 정합성 있음 , false: 정합성 없음)
 ********************************************************/
function chkAiTransData(sAppData) {

    
    //최상위 ROOT UI 존재 여부 확인.
    let _indx = sAppData.T_0014.findIndex( item => item.POBID === "" );

    //날라온 데이터의 ROOT를 봤더니 POBID가 있으면 오류.
    if(_indx === -1){

        sAppData.RETCD = "E";

        //430	AI가 생성한 UI 정보에 Root UI가 포함되어 있지 않습니다.
        sAppData.RTMSG = parent.WSUTIL.getWsMsgClsTxt("", "ZMSG_WS_COMMON_001", "430");

        return sAppData; //정합성 검사 결과 반환.

    }

    return sAppData; //정합성 검사 결과 반환.

}




/*********************************************************
 * @function - chkUiCreateReadyState
 * @description - UI를 구성할 수 있는 상태인지 확인하는 함수.
 *                BUSY 상태인지, 팝업이 열려있는지 등을 확인.
 * @returns {void}
 ********************************************************/
function chkUiCreateReadyState(sAppData) {
    
    //BUSY 상태인지 확인.
    if(parent.getBusy() === "X"){
        
        sAppData.RETCD = "E";

        //428	현재 수행 중인 작업으로 인해, AI가 생성한 UI 정보를 적용할 수 없습니다.
        sAppData.RTMSG = parent.WSUTIL.getWsMsgClsTxt("", "ZMSG_WS_COMMON_001", "428");

        return sAppData; //BUSY 상태이면 UI 생성 불가.

    }


    //호출된 팝업이 존재하는지 확인.
    var _aDialog = sap.m.InstanceManager.getOpenDialogs();

    //busy 상태인지 확인.
    if(_aDialog.length > 0){
        
        sAppData.RETCD = "E";
        
        //428	현재 수행 중인 작업으로 인해, AI가 생성한 UI 정보를 적용할 수 없습니다.
        sAppData.RTMSG = parent.WSUTIL.getWsMsgClsTxt("", "ZMSG_WS_COMMON_001", "428");
        
        return sAppData; //팝업이 열려있으면 UI 생성 불가.
        
    }

    return sAppData;

}




/*********************************************************
 * @function - setOBJID
 * @description - UI를 구성하기 위한 OBJECT ID를 생성하는 함수.
 * @param {string} OBJID - 기본 UI명(Button, Input 등)
 * @param {Array} aT_0014 - 현재 구성한 UI 정보.
 ********************************************************/
function setOBJID(OBJID, aT_0014){

    let _cnt = 0;

    //대문자 변환처리.(Button -> BUTTON)
    let _OBJID = OBJID.toUpperCase();

    //대상 UI명에서 숫자 제거.
    _OBJID = _OBJID.replace(/\d/g,"");

    let _found = false;    

    while(_found !== true){
        
        //count 증가.
        _cnt ++;

        //UI명 + 숫자 조합으로 OBJECT ID 구성.
        var _nextOBJID = _OBJID + _cnt;

      //구성한 objid와 동일건 존재여부 확인.
      if(aT_0014.findIndex( a => a.OBJID === _nextOBJID ) === -1){
        //동일건이 존재하지 않는경우 구성한 OBJECT ID RETURN.
        return _nextOBJID;

      }

    }

}  //생성한 UI명 채번




/*********************************************************
 * @function - createAppData
 * @description - 구성한 UI, attribute 정보를 기준으로 design tree, 
 *                attribute, 미리보기 영역의 UI 정보를 생성 하는 함수.
 * @param {sAppData} - UI 정보 객체
 *  sAppData.T_0014 - UI 정보
 *  sAppData.T_0015 - UI의 attribute(property, event, aggregation) 정보
 * @returns {void}
 ********************************************************/
async function createAppData(sAppData){

    //추가 대상 parent UI 정보 얻기.
    var _OBJID = sAppData.sParent.OBJID;

    //parent UI가 ROOT 인경우.
    if(_OBJID === CS_ROOT.ROOT_ID){
        //최상위 UI 인 APP로 대체 처리.
        _OBJID = CS_ROOT.ROOT_UI;
    }


    var _sUndoHist = {
        ROOT : _OBJID,
        PRCCD : "ADD",
        RAND : sAppData.RAND,
        HIST : sAppData.T_0014.filter( item => item.POBID === _OBJID )
    };

    //UNDO 이력 추가.
    parent.require(oAPP.oDesign.pathInfo.undoRedo).saveActionHistoryData("AI_INSERT", _sUndoHist);


    //구성한 UI 정보를 model메 매핑.
    oAPP.attr.oModel.oData.TREE = sAppData.T_0014;

    oAPP.attr.oModel.oData.zTREE = [];

    //tree 바인딩 정보 구성.
    oAPP.fn.setTreeJson(oAPP.attr.oModel,"TREE","OBJID","POBID","zTREE");

    //tree drag & drop 처리 활성여부 처리.
    oAPP.fn.setTreeDnDEnable(oAPP.attr.oModel.oData.zTREE[0]);

    //UI design tree영역 체크박스 활성여부 처리.
    oAPP.fn.setTreeChkBoxEnable(oAPP.attr.oModel.oData.zTREE[0]);

    //UI design tree 영역 UI에 따른 ICON 세팅.
    oAPP.fn.setTreeUiIcon(oAPP.attr.oModel.oData.zTREE[0]);

    //UI design tree 영역의 action icon 활성여부 처리.
    oAPP.fn.designSetActionIcon(oAPP.attr.oModel.oData.zTREE[0]);

    //design tree의 row action 활성여부 설정.
    oAPP.fn.designTreeSetRowAction();

    //모델 갱신 처리.
    oAPP.attr.oModel.refresh();


    //디자인 영역 모델 갱신 처리 후 design tree, attr table 갱신 대기. 
    await oAPP.fn.designRefershModel();

    oAPP.DATA.APPDATA.T_0015 = [];

    oAPP.DATA.APPDATA.T_0015 = sAppData.T_0015;


    //변경 FLAG 처리.
    oAPP.fn.setChangeFlag();


    //미리보기 UI 수집 정보 초기화.
    oAPP.attr.prev = {};

    //미리보기 화면 구성.
    await oAPP.attr.ui.frame.contentWindow.drawPreview();
    

    //라인선택 처리 OBJECT ID 구성.
    var _OBJID = sAppData?.sAiParent?.OBJID || sAppData.sParent.OBJID;

    //부모 라인을 선택 처리.
    await oAPP.fn.setSelectTreeItem(_OBJID); 

    
    //선택된 라인을 펼침처리.
    oAPP.fn.expandTreeItem();


    sAppData.RETCD = "S";

    //429	AI가 생성한 UI를 기반으로 화면 구성이 완료되었습니다.
    sAppData.RTMSG = parent.WSUTIL.getWsMsgClsTxt("", "ZMSG_WS_COMMON_001", "429");

    return sAppData;
    

}




/*********************************************************
 * @function - rebuildAppData
 * @description - UI를 재구성하기 위한 데이터를 구성하는 함수.
 * @param {sAppData} - UI 정보 객체
 *  sAppData.T_0014 - UI 정보
 *  sAppData.T_0015 - UI의 attribute(property, event, aggregation) 정보
 ********************************************************/
function rebuildAppData(sAppData) { 

    
    //현재 TREE -> ITAB 화.
    var _aT_0014 = oAPP.fn.parseTree2Tab(oAPP.attr.oModel.oData.zTREE);


    var _aT_0015 = [];

    //현재 UI의 매핑된 ATTR 정보 수집 처리.
    for (let i = 0; i < _aT_0014.length; i++) {

        let _s0014 = _aT_0014[i];

        _aT_0015 = _aT_0015.concat(oAPP.attr.prev[_s0014.OBJID]._T_0015);
        
    }


    //테마명이 입력된 경우.
    if(sAppData?.THEME_NAME !== ""){

        var _s0015 = _aT_0015.find( item => item.UIATK === "DH001021");
        //입력한 테마명을 매핑.
        _s0015.UIATV = sAppData.THEME_NAME;

    }
    

    //UI 라이브러리 정보.
    var _aT_0022 = oAPP.DATA.LIB.T_0022;

    //UI Attribute 정보.
    var _aT_0023 = oAPP.DATA.LIB.T_0023;

    //어플리케이션 ID.
    var _APPID = oAPP.attr.appInfo.APPID;

    //어플리케이션 GUID 번호.
    var _GUINR = oAPP.attr.appInfo.GUINR;
    

    for (let i = 0, l = sAppData.T_0014.length; i < l; i++) {
        
        var _s0014 = sAppData.T_0014[i];
        
        //Web Application ID
        _s0014.APPID = _APPID;

        //Guid Number
        _s0014.GUINR = _GUINR;

        //대상 UI 검색.
        let _s0022 = _aT_0022.find( item => item.LIBNM === _s0014.UILIB );

        //UI가 존재하지 않는 경우 수집 skip.
        if(typeof _s0022 === "undefined"){
            continue;
        }

        //폐기된 건인경우 생략.
        if(_s0022.ISDEP === "X"){
            continue;
        }

        //이전 UI 정보.
        let _BEFORE_OBJID = _s0014.OBJID;

        //object id 새로 채번.
        let _OBJID = setOBJID(_BEFORE_OBJID, _aT_0014);

        //숫자 제거 처리.
        var _TEMP_OBJID = _OBJID.replace(/\d/g, "");

        //부모 UI 정보가 존재하지 않는경우(최상위 UI인경우)
        //수집된 UI 정보에 이전 OBJID가 없는경우(새로 생성된 UI인경우)
        if(_s0014.POBID === "" && _aT_0014.findIndex( item => item.OBJID === _TEMP_OBJID ) === -1){
            //OBJECT ID에 숫자를 제거.
            //최상위 ui의 경우 OBJECT ID는 숫자가 없는 상태로 구성.(APP)
            _OBJID = _TEMP_OBJID;
        }


        //새로 구성한 OBJECT ID 매핑.
        _s0014.OBJID = _OBJID;


        //현재 UI의 CHILD UI 정보 발췌.
        let _aChild = sAppData.T_0014.filter( item => item.POBID === _BEFORE_OBJID );


        for (let index = 0; index < _aChild.length; index++) {
            let _sChild = _aChild[index];

            _sChild.NEW_POBID = _OBJID;
            
        }


        let _a0015 = sAppData.T_0015.filter( item => item.OBJID === _BEFORE_OBJID );

        for (let index = 0; index < _a0015.length; index++) {
            let _s0015 = _a0015[index];

            _s0015.NEW_OBJID = _OBJID;
            
        }

        
        //현재 UI의 UI OBJECT KEY 매핑.(UO00249)
        _s0014.UIOBK = _s0022.UIOBK;

        //UI Object Find Value(SAP.M.BUTTON)
        _s0014.UIFND = _s0022.UIFND;

        //Is Extension?(Yes : X)
        _s0014.ISEXT = _s0022.ISEXT;

        //Target UI Object Library(sap.m)
        _s0014.TGLIB = _s0022.TGLIB;

        //Is Exception UI?(Yes : X )
        _s0014.ISECP = _s0022.ISECP;


        _aT_0014.push(_s0014);
        
    }


    //수집한 UI의 embed aggregation 정보 설정.
    for (let i = 0, l = sAppData.T_0014.length; i < l; i++) {
        
        var _s0014 = sAppData.T_0014[i];

        if(typeof _s0014.NEW_POBID !== "undefined"){
            _s0014.POBID = _s0014.NEW_POBID;
        }

        delete _s0014.NEW_POBID;

        //부모 UI OBJECT KEY가 없는경우 최상위.
        //호출처에서 만들어진 UI
        if(_s0014.POBID === ""){
            _s0014.POBID = sAppData.sParent.OBJID;
            _s0014.PUIOK = sAppData.sParent.UIOBK;

            continue;
        }

        //부모 instance 검색.
        let _sParent = sAppData.T_0014.find( item => item.OBJID === _s0014.POBID );

        if(typeof _sParent === "undefined"){
            continue;
        }

        //부모 UI의 UI OBJECT KEY 매핑.
        _s0014.PUIOK = _sParent.UIOBK;
        
        
        //embedded Aggregation 검색.
        let _s0023 = _aT_0023.find( item => 
            item.UIOBK === _s0014.PUIOK &&
            item.UIATT === _s0014.UIATT &&
            item.UIATY === _s0014.UIATY
        );

        if(typeof _s0023 === "undefined"){
            continue;
        }

        if(_s0023.ISDEP === "X"){
            continue;
        }

        //embedded Aggregation 정보 설정.
        setEmbeddedAggr(_s0014, _s0023);
        
    }


    
    for (let i = 0, l = sAppData.T_0015.length; i < l; i++) {

        let _s0015 = sAppData.T_0015[i];

        if(typeof _s0015.NEW_OBJID !== "undefined"){
            _s0015.OBJID = _s0015.NEW_OBJID;
        }

        delete _s0015.NEW_OBJID;
                

        //대상 UI 검색.
        let _s0014 = sAppData.T_0014.find( item => item.OBJID === _s0015.OBJID );

        if(typeof _s0014 === "undefined"){
            continue;
        }

        let _s0022 = _aT_0022.find( item => item.UIOBK === _s0014.UIOBK );

        if(typeof _s0022 === "undefined"){
            continue;
        }

        //폐기된 건인경우 수집 생략.
        if(_s0022.ISDEP === "X"){
            continue;
        }


        //Web Application ID
        _s0015.APPID = _APPID;

        //Guid Number
        _s0015.GUINR = _GUINR;


        //DEFAULT 현재 UI의 UI OBJECT KEY.
        let _UIOBK = _s0014.UIOBK;

        //DEFAULT 현재 ATTRIBUTE의 TYPE.
        let _UIATY = _s0015.UIATY;

        //embedded Aggregation인경우.
        if(_UIATY === "6"){

            //부모 UI의 UI OBJECT KEY.
            _UIOBK = _s0014.PUIOK;

            //부모 UI의 aggregation 검색을 위한 type 변경.
            _UIATY = _s0014.UIATY;
        }


        let _s0023 = _aT_0023.find( item => 
            item.UIOBK === _UIOBK &&
            item.UIATT === _s0015.UIATT &&
            item.UIATY === _UIATY
        );

        if(typeof _s0023 === "undefined"){
            continue;
        }

        //폐기된 건인경우 수집 생략.
        if(_s0023.ISDEP === "X"){
            continue;
        }

        //UI Attribute Internal Key
        _s0015.UIATK = _s0023.UIATK;

        //UI Library Internal Key
        _s0015.UILIK = _s0022.UILIK;

        //UI Object Internal Key
        _s0015.UIOBK = _s0023.UIOBK;

        //UI Attribute ID (Upper Case Short)
        _s0015.UIASN = _s0023.UIASN;

        //UI Object Property Data Type (Real)
        _s0015.UIADT = _s0023.UIADT;

        //Is Multie Value Bind? (Yes : X)
        _s0015.ISMLB = _s0023.ISMLB;


        //직접 입력 가능한 AGGREGATION인경우.
        if(_s0023.ISSTR === "X" && _s0015.UIATY === "3"){
            _s0015.UIATK = _s0015.UIATK + "_1";

            _s0015.UIATY = "1";

        }
        
        _aT_0015.push(_s0015);

    }

    //구성한 UI 정보 재구성.
    sAppData.T_0014 = _aT_0014;

    //구성한 attribute 정보 재구성.
    sAppData.T_0015 = _aT_0015;


    return sAppData; //구성한 UI, attribute 정보를 반환.

}




/*********************************************************
 * @function - setRootEmbeddedAggregation
 * @description - Aggregation 정보로부터 _s0014 의 embed aggregation
 *                정보를 구성하는 함수.
 * @param {object} s0014 - _s0014 객체 (T_0014의 UI 정보)
 * @param {object} sAggr - sAggr 객체 (aggregation 정보)
 *********************************************************/
function setRootEmbeddedAggregation(s0014, s0022, sAggr){

    //Aggregation 정보로부터 _s0014 의 embed aggregation 정보를 구성.
    setEmbeddedAggr(s0014, sAggr);
    
    // T_0015 구조 생성
    let _sAttr = oAPP.fn.crtStru0015();

    _sAttr.OBJID = s0014.OBJID;
    _sAttr.UIATK = sAggr.UIATK;
    _sAttr.UIATT = sAggr.UIATT;
    _sAttr.UIASN = sAggr.UIASN;
    _sAttr.UIATY = "6";
    _sAttr.UIADT = sAggr.UIADT;
    _sAttr.ISMLB = sAggr.ISMLB;
    _sAttr.ISEML = "X";
    _sAttr.ISEMB = "X";

    _sAttr.UIOBK = s0022?.UIOBK || "";
    _sAttr.UILIK = s0022?.UILIK || "";

    return _sAttr;

}



/*********************************************************
 * @function - setEmbeddedAggr
 * @description - Aggregation 정보로부터 _s0014 의 embed aggregation
 *                정보를 구성하는 함수.
 * @param {object} s0014 - _s0014 객체 (T_0014의 UI 정보)
 * @param {object} sAggr - sAggr 객체 (aggregation 정보)
 *********************************************************/
function setEmbeddedAggr(s0014, sAggr){
    
    // T_0014용 정보 구성

    //UI Attribute Internal Key
    s0014.UIATK  = sAggr.UIATK;

    //UI Attribute ID.
    s0014.UIATT  = sAggr.UIATT;

    //UI Attribute ID (Upper Case Short)
    s0014.UIASN  = sAggr.UIASN;

    //UI Attribute Type
    s0014.UIATY  = sAggr.UIATY;

    //UI Object Property Data Type (Real)
    s0014.UIADT  = sAggr.UIADT;

    //UI Object Property Data Type (SAP Internal)
    s0014.UIADS  = sAggr.UIADS;

    //UI Object Property Value Key
    s0014.VALKY  = sAggr.VALKY;

    //Is List Box Support? (Yes : X)
    s0014.ISLST  = sAggr.ISLST;

    //Is Multie Value Bind? (Yes : X)
    s0014.ISMLB  = sAggr.ISMLB;

    //UI Attribute Internal Key
    s0014.PUIATK = sAggr.UIATK;

}




/*********************************************************
* @function - setRootAppData
* @description - AI로부터 전달받은 UI를 기준으로 구성된 UI에,
*                ROOT, APP UI 정보를 추가 처리.
* @param {sAppData} - UI 정보 객체
*  sAppData.T_0014 - UI 정보
*  sAppData.T_0015 - UI의 attribute(property, event, aggregation)
********************************************************/
function setRootAppData(sAppData){

    //현재 DESIGN TREE -> ITAB 화.
    var _aT_0014 = oAPP.fn.parseTree2Tab(oAPP.attr.oModel.oData.zTREE);


    //AI로 부터 전달받은 UI 정보와 DESIGN 영역의 UI 정보를 취합해 만든 UI리스트에
    //ROOT UI 존재 여부 확인.
    var _indx = sAppData.T_0014.findIndex( item => item.OBJID === "ROOT" );

    //ROOT UI가 존재하지 않는경우.
    if(_indx === -1){

        //ROOT UI 정보 검색.
        var _s0014 = _aT_0014.find( item => item.OBJID === "ROOT" );

        //T_0014에 ROOT UI 정보 추가.
        sAppData.T_0014.push(_s0014);

        //ROOT UI의 attribute 정보를 같이 수집 처리.
        sAppData.T_0015 = sAppData.T_0015.concat(oAPP.attr.prev[_s0014.OBJID]._T_0015);
        

    }
    

    //AI로 부터 전달받은 UI 정보와 DESIGN 영역의 UI 정보를 취합해 만든 UI리스트에
    //APP UI 존재 여부 확인.
    var _indx = sAppData.T_0014.findIndex( item => item.OBJID === "APP" );


    if(_indx === -1){

        //APP UI 정보 검색.
        var _s0014 = _aT_0014.find( item => item.OBJID === "APP" );

        //T_0014에 APP UI 정보 추가.
        sAppData.T_0014.push(_s0014);

        //ROOT UI의 attribute 정보를 같이 수집 처리.
        sAppData.T_0015 = sAppData.T_0015.concat(oAPP.attr.prev[_s0014.OBJID]._T_0015);

    }

    //해당 UI를 기준으로 ITAB화.(ROOT, APP UI만 구성됨.)

    //AI로 부터 전달받은 UI 정보에 ROOT, APP UI를 추가 처리.
    //(PARENT가 존재하지 않는 UI에 대해 부모를 APP로 설정 처리

    return sAppData;

}