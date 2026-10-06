//최대 이력 저장 갯수.
const C_MAX_HISTORY = 100;

//#region  [MF-001]
//WS 3.0 메인 프레임.
// var oWS_FRAME = document.getElementById('ws_frame').contentWindow;


//oAPP 정보 광역화.
// var oAPP = parent.oAPP;
var oAPP = parent.oAPP;
//#endregion


//UNDO 이력 저장 ARRAY.
var __ACT_UNDO_HIST = [];

//REDO 이력 저장 ARRAY.
var __ACT_REDO_HIST = [];



/*************************************************************
 * @module - 이력 초기화.
 *************************************************d************/
module.exports.clearHistory = function(){

    //UNDO 이력 초기화.
    __ACT_UNDO_HIST = [];


    //REDO 이력 초기화.
    __ACT_REDO_HIST = [];

};


/*************************************************************
 * @module - undo, redo 버튼 활성여부 처리.
 *************************************************************/
module.exports.setUndoRedoButtonEnable = function(){

    //undo, redo 버튼 활성여부 처리.
    CL_COMMON.setUndoRedoButtonEnable();

};



/*************************************************************
 * @module - 디자인 영역에서 수행된 action에 따라 
 *           undo, redo를 위한 이력 저장 처리.
 *************************************************************/
module.exports.saveActionHistoryData = function(ACTCD, oParam){

    //redo history 초기화.
    __ACT_REDO_HIST = [];

    switch (ACTCD) {
        case "INSERT":
            //UI 추가.
            CL_INSERT_UI.saveActionHistoryData(__ACT_UNDO_HIST, oParam);
            break;

        case "DELETE":
            //UI 삭제.
            CL_DELETE_UI.saveActionHistoryData(__ACT_UNDO_HIST, [oParam]);
            break;

        case "MULTI_DELETE":
            //UI 멀티 삭제.
            CL_DELETE_UI.saveActionHistoryData(__ACT_UNDO_HIST, oParam);
            break;        

        case "MOVE":
            //UI 이동 처리.(MOVE, MOVE POSITION)
            CL_MOVE_UI.saveActionHistoryData(__ACT_UNDO_HIST, oParam);
            break;

        case "PASTE":
            //UI 붙여넣기.
            CL_INSERT_UI.saveActionHistoryData(__ACT_UNDO_HIST, [oParam]);
            break;

        case "COPY":
            //CTRL + D&D로 UI 복사 처리.
            CL_INSERT_UI.saveActionHistoryData(__ACT_UNDO_HIST, [oParam]);
            break;

        case "WIZARD_INSERT":
            //WIZARD UI 추가.
            CL_INSERT_UI.saveActionHistoryData(__ACT_UNDO_HIST, oParam);
            break;

        case "INSERT_PERS":
            //개인화 UI 추가.
            CL_INSERT_UI.saveActionHistoryData(__ACT_UNDO_HIST, [oParam]);
            break;

        case "DRAG_DROP":
            //UI DRAG & DROP.
            CL_DRAG_DROP.saveActionHistoryData(__ACT_UNDO_HIST, oParam);
            break;

        case "CHANGE_OBJID":
            //UI 이름 변경.
            CL_CHANGE_OBJID.saveActionHistoryData(__ACT_UNDO_HIST, oParam);
            break;

        case "CHANGE_ATTR":
            CL_CHANGE_ATTR.saveActionHistoryData(__ACT_UNDO_HIST, oParam);
            //attrubyte 변경.
            break;

        case "RESET_ATTR":
            //attr 초기화.
            CL_CHANGE_ATTR.saveActionHistoryData(__ACT_UNDO_HIST, oParam);
            break;

        case "AI_INSERT":            
            //AI에서 추가된 UI.        
            CL_AI_INSERT.saveActionHistoryData(__ACT_UNDO_HIST, oParam);
            break;
    
        default:
            //잘못된 ACTION CODE를 전달받았을때의 로직 처리.
            //(강제 오류 발생 처리등..)
            throw(new Error(`(undoRedo.js)이력 저장시 잘못된 action code가 전달됨(${ACTCD})`));

    }


};



/*************************************************************
 * @module - UNDO, REDO의 이전 HISTORY 수행 처리.
 * @param PRCCD - (UNDO:실행취소, REDO:다시샐행)
 *************************************************************/
module.exports.executeHistory = async function(PRCCD){

    parent.setBusy("X");


    //단축키 잠금 처리.
    oAPP.fn.setShortcutLock(true);


    var _sOption = JSON.parse(JSON.stringify(oAPP.oDesign.types.TY_BUSY_OPTION));

    //208	디자인 화면에서 UI 변경 작업을 진행하고 있습니다.
    _sOption.DESC = parent.WSUTIL.getWsMsgClsTxt(oAPP.oDesign.settings.GLANGU, "ZMSG_WS_COMMON_001", "208");

    //WS 20 -> 바인딩 팝업 BUSY ON 요청 처리.
    parent.require(oAPP.oDesign.pathInfo.bindPopupBroadCast)("BUSY_ON", _sOption);

    
    //이력 정보가 존재하지 않는경우 exit.
    if(typeof __ACT_UNDO_HIST === "undefined" || 
        typeof __ACT_REDO_HIST === "undefined"){

        //WS 20 -> 바인딩 팝업 BUSY OFF 요청 처리.
        parent.require(oAPP.oDesign.pathInfo.bindPopupBroadCast)("BUSY_OFF");

        //단축키 잠금 해제처리.
        oAPP.fn.setShortcutLock(false);

        parent.setBusy("");

        return;
    }


    //UNDO, REDO 이력이 둘다 없다면 EXIT.
    if(__ACT_UNDO_HIST.length === 0 && 
        __ACT_REDO_HIST.length === 0){

        //WS 20 -> 바인딩 팝업 BUSY OFF 요청 처리.
        parent.require(oAPP.oDesign.pathInfo.bindPopupBroadCast)("BUSY_OFF");

        //단축키 잠금 해제처리.
        oAPP.fn.setShortcutLock(false);
        
        parent.setBusy("");

        return;
    }


    var _sHist = undefined;
    

    var _sEventParam = {};

    //UNDO, REDO 구분자 코드.
    _sEventParam.PRCCD  = PRCCD;

    //UNDO, REDO HISTORY 구성 ARRAY.
    _sEventParam.T_HIST = [];
    

    switch (PRCCD) {
        case "UNDO":
            //UNDO의 마지막 이력 정보 얻기.
            _sHist = __ACT_UNDO_HIST.pop();

            //REDO history array.
            _sEventParam.T_HIST = __ACT_REDO_HIST;

            break;

        case "REDO":
            //REDO의 마지막 이력 정보 얻기.
            _sHist = __ACT_REDO_HIST.pop();

            //UNDO history array.
            _sEventParam.T_HIST = __ACT_UNDO_HIST;
            
            break;
        default:
            break;
    }


    //history 처리 정보가 존재하지 않는경우.
    if(typeof _sHist === "undefined"){

        //WS 20 -> 바인딩 팝업 BUSY OFF 요청 처리.
        parent.require(oAPP.oDesign.pathInfo.bindPopupBroadCast)("BUSY_OFF");

        //단축키 잠금 해제처리.
        oAPP.fn.setShortcutLock(false);
        
        parent.setBusy("");

        return;
    }


    //마지막 이력의 ACTION 코드에 따른 로직 분기.
    switch (_sHist.ACTCD) {
        case "INSERT":
            //UI 추가.
            CL_INSERT_UI.executeHistory(_sEventParam, _sHist);
            break;

        case "DELETE":
            //UI 삭제.
            CL_DELETE_UI.executeHistory(_sEventParam, _sHist);
            break;

        case "MOVE":
            //UI 이동 처리.(MOVE, MOVE POSITION)
            CL_MOVE_UI.executeHistory(_sEventParam, _sHist);
            break;

        case "DRAG_DROP":
            //UI DRAG & DROP.
            CL_DRAG_DROP.executeHistory(_sEventParam, _sHist);
            break;

        case "CHANGE_OBJID":
            //UI 이름 변경.
            CL_CHANGE_OBJID.executeHistory(_sEventParam, _sHist);            
            break;

        case "CHANGE_ATTR":
            //ATTRIBUTE 변경.
            CL_CHANGE_ATTR.executeHistory(_sEventParam, _sHist);
            break;

        case "AI_INSERT":
            //AI에서 추가된 UI.
            CL_AI_INSERT.executeHistory(_sEventParam, _sHist);
            break;
    
        default:
            //잘못된 ACTION CODE를 전달받았을때의 로직 처리.
            //(강제 오류 발생 처리등..)
            throw(new Error(`(undoRedo.js의 executeHistory)${PRCCD} 처리시 잘못된 action code가 전달됨(${_sHist.ACTCD})`));
        
    }

};



/*************************************************************
 * @module - 멀티 삭제시 파라메터 정보 구성.
 *************************************************************/
module.exports.getMultiDeleteParam = function(){

    //멀티 삭제 파라메터 정보 구성.
    //(체크박스 선택건 정보 구성, 부모선택시 child는 수집 생략)
    return CL_DELETE_UI.getMultiDeleteParam(oAPP.attr.oModel.oData.zTREE);

};


/*************************************************************
 * @module - attr 초기화시 파라메터 정보 구성.
 *************************************************************/
module.exports.getResetAttrParam = function(){

    //attr 초기화시 파라메터 정보 구성.
    return CL_CHANGE_ATTR.getResetAttrParam();

};




/*************************************************************
 * @class - INSERT UI 처리 CLASS.
 *************************************************************/
class CL_INSERT_UI{
    
    //INSERT DATA 구조.
    static TY_INSERT_DATA = {
        
        S_DESIGN     : {},      //DESIGN TREE 라인 정보.

        BEFORE_POSIT : null,    //UI가 위치한 INDEX 정보.

        T_0015       : [],      //DESIGN TREE로부터 CHILD UI의 ATTR 변경건 수집 ARRAY
        T_CEVT       : [],      //DESIGN TREE로부터 CHILD UI의 클라이언트 이벤트 수집 ARRAY.
        T_DESC       : []       //DESIGN TREE로부터 CHILD UI의 DESC 정보 수집 ARRAY.

    };


    /*************************************************************
     * @method - INSERT에 대한 이력 데이터 구성 처리
     *************************************************************/
    static setActionHistoryData(oParam){
        
        let _aT_OBJID = [];

        for (let i = 0, l = oParam.length; i < l; i++) {

            var _sParam = oParam[i];

            //object id만 수집 처리.
            _aT_OBJID.push(_sParam.OBJID);

        }

        return _aT_OBJID;

    };


    /*************************************************************
     * @method - INSERT에 대한 이력 저장 처리.
     *************************************************************/
    static saveActionHistoryData(aTargetHist, oParam) {

        //파라메터 정보가 존재하는지 확인.
        if(typeof oParam === "undefined"){
            console.error(`(undoRedo.js) CL_INSERT_UI history save parameter undefined`);
            return;
        }

        //파라메터 정보가 존재하는지 확인.
        if(oParam === null){
            console.error(`(undoRedo.js) CL_INSERT_UI history save parameter null`);
            return;
        }

        if(Array.isArray(oParam) !== true){
            console.error(`(undoRedo.js) CL_INSERT_UI history save parameter array not`);
            return;
        }

        if(oParam.length === 0){
            console.error(`(undoRedo.js) CL_INSERT_UI history save parameter data none`);
            return;
        }


        var _sSaveParam = {};

        //UNDO, REDO시 수행할 ACTION 코드.
        _sSaveParam.ACTCD   = "DELETE";

        //INSERT한 UI OBJECT ID 수집 ARRAY.
        _sSaveParam.T_OBJID = CL_INSERT_UI.setActionHistoryData(oParam);


        //이력 저장 처리.
        CL_COMMON.setHistoryData(aTargetHist, _sSaveParam);


        //UNDO, REDO 버튼 활성화 처리.
        CL_COMMON.setUndoRedoButtonEnable();

    };



    /*************************************************************
     * @method - INSERT 처리.
     * 🚩 INSERT시 순서 🚩
     * 1. INSERT시 부모 UI에 attachOnAfterRendering 처리 필수.
     *    (CL_COMMON.attachOnAfterRendering)
     * 
     * 2. INSERT할 UI를 부모에 추가.
     *    (CL_INSERT_UI.insertUiObject)
     *
     * 3. 이때 부모 UI에 invalidateUiObject 처리 필수.
     *    (CL_COMMON.invalidateUiObject)
     *    (INSERT할 UI가 layoutData와 같이 화면에 표현되지 않는
     *    UI인경우, 부모의 onAfterRendering이 수행되지 않음)
     * 
     * 4. 모델 갱신 처리, 미리보기에 UI 추가를 기다림.
     *    (oAPP.fn.designRefershModel)
     *    (onAfterRendering를 하는 경우 반드시 onAfterRendering를 먼저 하고 
     *    designRefershModel를 수행 해야함. richTextEditor가 해당 순서에 영향을 받음)
     * 
     * 5. 이후 반드시 라인 선택 처리 해야함.
     *    (oAPP.fn.setSelectTreeItem)
     * 
     * ⚠️ 내용 추가시 아래 항목도 확인 ⚠️
     *    oAPP.fn.designAddUIObject
     *    CL_AI_INSERT.executeInsert
     *    
     *************************************************************/
    static async executeHistory(sEvent, oParam){

        //전달받은 파라메터가 없다면 EXIT.
        if(typeof oParam?.T_INSERT_DATA === "undefined"){

            console.error(`(undoRedo.js)[${sEvent.PRCCD}] ${oParam.ACTCD} during T_INSERT_DATA parameter undefined`);

            //WS 20 -> 바인딩 팝업 BUSY OFF 요청 처리.
            parent.require(oAPP.oDesign.pathInfo.bindPopupBroadCast)("BUSY_OFF");

            //단축키 잠금 해제처리.
            oAPP.fn.setShortcutLock(false);
            
            parent.setBusy("");

            return;
        }

        if(Array.isArray(oParam.T_INSERT_DATA) !== true){

            console.error(`(undoRedo.js)[${sEvent.PRCCD}] ${oParam.ACTCD} during T_INSERT_DATA parameter array not`);

            //WS 20 -> 바인딩 팝업 BUSY OFF 요청 처리.
            parent.require(oAPP.oDesign.pathInfo.bindPopupBroadCast)("BUSY_OFF");

            //단축키 잠금 해제처리.
            oAPP.fn.setShortcutLock(false);
            
            parent.setBusy("");

            return;

        }

        if(oParam.T_INSERT_DATA.length === 0){

            console.error(`(undoRedo.js)[${sEvent.PRCCD}] ${oParam.ACTCD} during T_INSERT_DATA data none`);

            //WS 20 -> 바인딩 팝업 BUSY OFF 요청 처리.
            parent.require(oAPP.oDesign.pathInfo.bindPopupBroadCast)("BUSY_OFF");

            //단축키 잠금 해제처리.
            oAPP.fn.setShortcutLock(false);
            
            parent.setBusy("");

            return;

        }

        var _aDesign = [];

        var _aOBJID = [];


        for (let i = 0, l = oParam.T_INSERT_DATA.length; i < l; i++) {
            
            var _sInsertData = oParam.T_INSERT_DATA[i];

            _aDesign.push(_sInsertData.S_DESIGN);

            _aOBJID.push(_sInsertData.S_DESIGN.POBID);
            
        }

        
        //REDO HISTORY 등록 처리.
        CL_INSERT_UI.saveActionHistoryData(sEvent.T_HIST, _aDesign);


        //UI 추가 대상 부모 정보 얻기.
        var _aParent = CL_COMMON.collectUIObject(_aOBJID);


        //대상 UI에 onAfterRendering 이벤트 등록 처리.
        // var _aPromise = CL_COMMON.attachOnAfterRendering(_aParent);
        var _sRet = CL_COMMON.attachOnAfterRendering(_aParent);



        for (let i = 0, l = oParam.T_INSERT_DATA.length; i < l; i++) {
            
            var _sInsertData = oParam.T_INSERT_DATA[i];
            
            //design tree 및 미리보기 UI 생성, 추가 처리.
            CL_INSERT_UI.insertUiObject(_sInsertData);

        }


        oAPP.attr.oModel.refresh();


        //대상 UI를 invalidate 처리.
        // CL_COMMON.invalidateUiObject(_aParent);
        CL_COMMON.invalidateUiObject(_sRet.aDesign);

    
        //richtexteditor 미리보기 화면이 다시 그려질때까지 대기.
        //(richtexteditor가 없다면 즉시 하위 로직 수행 처리됨)
        // await Promise.all(_aPromise);
        await Promise.all(_sRet.aPromise);

        

        //디자인 영역 모델 갱신 처리 후 design tree, attr table 갱신 대기. 
        await oAPP.fn.designRefershModel();


        //마지막 이력정보 얻기.
        var _sInsertData = oParam.T_INSERT_DATA[oParam.T_INSERT_DATA.length - 1 ];


        //라인 선택 처리.
        await oAPP.fn.setSelectTreeItem(_sInsertData.S_DESIGN.OBJID);

        //20240621 pes.
        //바인딩 팝업의 디자인 영역 갱신처리.
        oAPP.fn.updateBindPopupDesignData();


    };



    /*************************************************************
     * @method - design tree 및 미리보기 UI 생성, 추가 처리.
     *************************************************************/
    static insertUiObject = function(sInsertData){

        
        var _sDesign = sInsertData.S_DESIGN;
        
        //INSERT 처리 대상 UI의 부모 정보 얻기.
        var _sParent = oAPP.fn.getTreeData(_sDesign.POBID);


        //부모 위치에 추가.
        _sParent.zTREE.splice(sInsertData.BEFORE_POSIT, 0, _sDesign);


        var _aT_0015 = sInsertData.T_0015.filter( item => item.OBJID === _sDesign.OBJID );

        //UI 생성 처리.
        oAPP.attr.ui.frame.contentWindow.createUIInstance(_sDesign, _aT_0015);
        

        //CHILD 정보의 UI INSTANCE 생성 처리.
        CL_INSERT_UI.createPreviewUI(_sDesign.zTREE, sInsertData.T_0015);


        //클라이언트 이벤트 원복 처리.
        oAPP.DATA.APPDATA.T_CEVT = oAPP.DATA.APPDATA.T_CEVT.concat(sInsertData.T_CEVT);

        //desc 정보 원복 처리.
        oAPP.DATA.APPDATA.T_DESC = oAPP.DATA.APPDATA.T_DESC.concat(sInsertData.T_DESC);


        //SAP.UI.RICHTEXTEDITOR.RICHTEXTEDITOR UI의 예외처리 script 구성.
        oAPP.attr.ui.frame.contentWindow.setRichTextEditorException(_sDesign.UIOBK, _sDesign.OBJID);


        //자식 UI가 필수인 UI에 자식이 없는경우 강제추가 예외처리.
        oAPP.attr.ui.frame.contentWindow.setChildUiException(_sDesign.UIOBK, _sDesign.OBJID, _sDesign.zTREE, oAPP.attr.S_CODE.UA050);


        //현재 추가하고자 하는 aggregation만 필터링.
        var _aChild = _sParent.zTREE.filter( a => a.UIATK === _sDesign.UIATK );

        //해당 aggr에 추가될 UI의 INDEX 위치 확인.
        var _indx = _aChild.findIndex( item => item.OBJID === _sDesign.OBJID );


        var _cnt = 0;

        //같은 aggregation안에 있는 UI중 부모에 추가되지 않은 UI 존재 여부 확인.
        for(var i = 0; i < _indx; i++){

          var _sTree =  _sParent.zTREE[i];

          if(oAPP.attr.S_CODE.UA026.findIndex( item => item.FLD01 === _sTree.UILIB ) !== -1){
            continue;
          }

          _cnt++;

        }


        //부모에 생성한 UI 추가.
        oAPP.attr.ui.frame.contentWindow.moveUIObjPreView(_sDesign.OBJID, _sDesign.UILIB, _sDesign.POBID, 
            _sDesign.PUIOK, _sDesign.UIATT, _cnt, _sDesign.ISMLB, _sDesign.UIOBK, true);


        //미리보기 예외처리 UI 추가 draw 처리.
        oAPP.fn.prevDrawExceptionUi(_sDesign.UIOBK, _sDesign.OBJID);


        //UI에 N건 바인딩 처리된경우 부모 UI에 해당 UI 매핑 처리.
        oAPP.fn.setModelBind(oAPP.attr.prev[_sDesign.OBJID]);


    };


    
    /*************************************************************
     * @method - 미리보기 UI 생성 처리.
     *************************************************************/
    static createPreviewUI(aDesignTree, aT_0015){

        if(typeof aDesignTree === "undefined"){
            return;
        }

        if(aDesignTree.length === 0){
            return;
        }

        for (let i = 0, l = aDesignTree.length; i < l; i++) {
            
            var _sDesignTree = aDesignTree[i];

            var _aT_0015 = aT_0015.filter( item => item.OBJID === _sDesignTree.OBJID );

            //UI 생성 처리.
            oAPP.attr.ui.frame.contentWindow.createUIInstance(_sDesignTree, _aT_0015);

            //CHILD 정보의 UI INSTANCE 생성 처리.
            CL_INSERT_UI.createPreviewUI(_sDesignTree.zTREE, aT_0015);

            //부모 UI에 추가 처리.
            oAPP.attr.ui.frame.contentWindow.setUIParent(_sDesignTree);
            
        }

    };

};




/*************************************************************
 * @class - DELETE UI 처리 CLASS.
 *************************************************************/
class CL_DELETE_UI{

    /*************************************************************
     * @method - DELETE에 대한 이력 데이터 구성 처리.
     *************************************************************/
    static setActionHistoryData(oParam){

        let _aT_INSERT_DATA = [];

        for (let i = 0, l = oParam.length; i < l; i++) {
            
            var _sParam = oParam[i];

            //전달받은 파라메터의 UI OBJECT ID에 해당하는 DESIGN TREE 라인 데이터 얻기.
            var _sDesign = oAPP.fn.getTreeData(_sParam.OBJID);

            
            if(typeof _sDesign === "undefined"){
                return;
            }

            
            //대상 UI의 CHILD를 탐색하며, ATTR 변경건 수집 처리.
            var _aT_0015 = CL_COMMON.collect0015Data(_sDesign);
            

            //현재 UI가 부모의 몇번째 INDEX인지 확인.
            var _posit = oAPP.fn.getTreeIndexOfChild(_sDesign.OBJID);

            
            //desc 정보 수집 처리.
            var _aDESC = CL_COMMON.collectDescData(_sDesign);


            //클라이언트 이벤트 수집 처리.
            var _aCEVT = CL_COMMON.collectClientEventData(_aT_0015);
            

            var _sInsertData = JSON.parse(JSON.stringify(CL_INSERT_UI.TY_INSERT_DATA));

            //이전 위치 정보.
            _sInsertData.BEFORE_POSIT = _posit;

            //design tree 라인 정보.
            _sInsertData.S_DESIGN     = JSON.parse(JSON.stringify(_sDesign));

            //design tree로부터 하위의 attr 변경건 정보 수집건.
            _sInsertData.T_0015       = JSON.parse(JSON.stringify(_aT_0015));

            //클라이언트 이벤트.
            _sInsertData.T_CEVT       = JSON.parse(JSON.stringify(_aCEVT));

            //desc 정보.
            _sInsertData.T_DESC       = JSON.parse(JSON.stringify(_aDESC));


            _aT_INSERT_DATA.push(_sInsertData);

            _sInsertData = null;

        }

        return _aT_INSERT_DATA;

    };

    /*************************************************************
     * @method - DELETE에 대한 이력 저장 처리.
     *************************************************************/
    static saveActionHistoryData(aTargetHist, oParam) {

        if(typeof oParam === "undefined"){
            console.error(`(undoRedo.js) CL_DELETE_UI history save parameter undefined`);
            return;
        }

        if(oParam === null){
            console.error(`(undoRedo.js) CL_DELETE_UI history save parameter null`);
            return;
        }

        if(Array.isArray(oParam) !== true){
            console.error(`(undoRedo.js) CL_DELETE_UI history save parameter array not`);
            return;
        }

        if(oParam.length === 0){
            console.error(`(undoRedo.js) CL_DELETE_UI history save parameter data none`);
            return;
        }


        var _sSaveParam = {};

        //UNDO, REDO시 수행할 ACTION 코드.
        _sSaveParam.ACTCD         = "INSERT";

        _sSaveParam.T_INSERT_DATA = CL_DELETE_UI.setActionHistoryData(oParam);

        
        //이력 저장 처리.
        CL_COMMON.setHistoryData(aTargetHist, _sSaveParam);


        //UNDO, REDO 버튼 활성화 처리.
        CL_COMMON.setUndoRedoButtonEnable();

    };


    /*************************************************************
     * @method - DELETE 처리.
     * 🚩 DELETE시 순서 🚩
     * 
     * 1. 삭제전 확인 팝업.
     *    (삭제 취소 처리 할경우 HISTORY를 되돌려야함)
     * 
     * 2. 삭제전 부모의 onAfterRendering 이벤트 등록.
     *    (CL_COMMON.attachOnAfterRendering)
     * 
     * 3. 대상 UI 삭제 처리.
     *    (CL_DELETE_UI.deleteUiObject)
     * 
     * 4. 이때 부모 UI에 invalidateUiObject 처리 필수.
     *    (CL_COMMON.invalidateUiObject)
     *    (INSERT할 UI가 layoutData와 같이 화면에 표현되지 않는
     *    UI인경우, 부모의 onAfterRendering이 수행되지 않음)
     * 
     * 5. 모델 갱신 처리, 미리보기에 UI 추가를 기다림.
     *    (oAPP.fn.designRefershModel)
     *    (onAfterRendering를 하는 경우 반드시 onAfterRendering를 먼저 하고 
     *    designRefershModel를 수행 해야함. richTextEditor가 해당 순서에 영향을 받음)
     * 
     * 6. 이후 반드시 라인 선택 처리 해야함.
     *    (oAPP.fn.setSelectTreeItem)
     *    (현재 선택한 UI가 삭제 대상건이라면 삭제 후 ATTR 영역을
     *    갱신 시켜야함.)
     * 
     * ⚠️ 내용 추가시 아래 항목도 확인 ⚠️
     *    oAPP.fn.designUIDelete
     *    oAPP.fn.designTreeMultiDeleteItem
     *    CL_AI_INSERT.executeDelete
     * 
     *************************************************************/
    static async executeHistory(sEvent, oParam){

        if(typeof oParam?.T_OBJID === "undefined"){

            console.error(`(undoRedo.js)[${sEvent.PRCCD}] ${oParam.ACTCD} during T_OBJID parameter undefined`);

            //WS 20 -> 바인딩 팝업 BUSY OFF 요청 처리.
            parent.require(oAPP.oDesign.pathInfo.bindPopupBroadCast)("BUSY_OFF");

            //단축키 잠금 해제처리.
            oAPP.fn.setShortcutLock(false);
            
            parent.setBusy("");

            return;
        }


        if(oParam?.T_OBJID === null){

            console.error(`(undoRedo.js)[${sEvent.PRCCD}] ${oParam.ACTCD} during T_OBJID parameter null`);

            //WS 20 -> 바인딩 팝업 BUSY OFF 요청 처리.
            parent.require(oAPP.oDesign.pathInfo.bindPopupBroadCast)("BUSY_OFF");

            //단축키 잠금 해제처리.
            oAPP.fn.setShortcutLock(false);
            
            parent.setBusy("");

            return;
        }


        if(Array.isArray(oParam?.T_OBJID) !== true){

            console.error(`(undoRedo.js)[${sEvent.PRCCD}] ${oParam.ACTCD} during T_OBJID parameter array not`);

            //WS 20 -> 바인딩 팝업 BUSY OFF 요청 처리.
            parent.require(oAPP.oDesign.pathInfo.bindPopupBroadCast)("BUSY_OFF");

            //단축키 잠금 해제처리.
            oAPP.fn.setShortcutLock(false);
            
            parent.setBusy("");

            return;
        }


        if(oParam.T_OBJID?.length === 0){

            console.error(`(undoRedo.js)[${sEvent.PRCCD}] ${oParam.ACTCD} during T_OBJID parameter data none`);

            //WS 20 -> 바인딩 팝업 BUSY OFF 요청 처리.
            parent.require(oAPP.oDesign.pathInfo.bindPopupBroadCast)("BUSY_OFF");

            //단축키 잠금 해제처리.
            oAPP.fn.setShortcutLock(false);
            
            parent.setBusy("");

            return;
        }


        //003	Do you really want to delete the object?
        var _msg = oAPP.common.fnGetMsgClsText("/U4A/MSG_WS", "003", "", "", "", "");

        parent.setBusy("");

        var _res = await new Promise((resolve)=>{

            parent.showMessage(parent.sap, 30, "I", _msg, async function(oEvent){

                parent.setBusy("X");

                resolve(oEvent);
            });

        });


        //삭제를 취소한 경우.
        if(_res !== "YES"){

            //이전 history에 다시 추가 처리. 
            switch (sEvent.PRCCD) {
                case "UNDO":
                    __ACT_UNDO_HIST.push(oParam);
                    break;
            
                case "REDO":
                    __ACT_REDO_HIST.push(oParam);
                    break;
            }

            //UNDO, REDO 버튼 활성화 처리.
            CL_COMMON.setUndoRedoButtonEnable();
            
            oAPP.attr.oModel.refresh();

            //WS 20 -> 바인딩 팝업 BUSY OFF 요청 처리.
            parent.require(oAPP.oDesign.pathInfo.bindPopupBroadCast)("BUSY_OFF");


            //단축키 잠금 해제처리.
            oAPP.fn.setShortcutLock(false);
            
            parent.setBusy("");

            return;
        }


        var _aParam = [];

        for (let i = 0, l = oParam.T_OBJID.length; i < l; i++) {
            
            var _OBJID = oParam.T_OBJID[i];

            _aParam.push(oAPP.fn.getTreeData(_OBJID));

        }

        //이력 정보 저장 처리.
        CL_DELETE_UI.saveActionHistoryData(sEvent.T_HIST, _aParam);
        

        //현재 우측에 출력한 UI의 TREE 정보 얻기.
        var _stree = oAPP.fn.getTreeData(oAPP.attr.oModel.oData.uiinfo.OBJID);

        //현재 선택건의 OBJID 매핑.
        var _SEL_OBJID = _stree?.OBJID || undefined;

        
        //삭제 대상건이 선택한건인지 확인.
        let _selected = CL_DELETE_UI.checkSelectObjidDelete(oParam.T_OBJID);

        if(_selected === true){
            
            //선택한 UI의 부모를 얻음.
            var _sParent = oAPP.fn.getTreeData(_stree.POBID);

            _SEL_OBJID = _sParent.OBJID;

        }


        //직전 라인 정보를 얻지 못한 경우 ROOT를 선택 처리.
        if(typeof _SEL_OBJID === "undefined"){
            _SEL_OBJID = "ROOT";
        }


        //삭제 대상 UI의 부모 정보 수집 처리.
        var _aParent = CL_COMMON.collectParent(oParam.T_OBJID);


        //대상 UI에 onAfterRendering 이벤트 등록 처리.
        // var _aPromise = CL_COMMON.attachOnAfterRendering(_aParent);
        var _sRet = CL_COMMON.attachOnAfterRendering(_aParent, oParam.T_OBJID);


        for (let i = 0, l = oParam.T_OBJID.length; i < l; i++) {
            
            var _OBJID = oParam.T_OBJID[i];
            
            //design tree 및 미리보기 UI 삭제 처리.
            CL_DELETE_UI.deleteUiObject(_OBJID);

        }


        //변경 FLAG 처리.
        oAPP.fn.setChangeFlag();

        
        //대상 UI를 invalidate 처리.
        // CL_COMMON.invalidateUiObject(_aParent);
        CL_COMMON.invalidateUiObject(_sRet.aDesign);


        //미리보기 화면 변경 대기 처리.
        // await Promise.all(_aPromise);
        await Promise.all(_sRet.aPromise);
        

        //디자인 영역 모델 갱신 처리 후 design tree, attr table 갱신 대기. 
        await oAPP.fn.designRefershModel();


        //라인 선택 처리.
        await oAPP.fn.setSelectTreeItem(_SEL_OBJID);

        
        //20240621 pes.
        //바인딩 팝업의 디자인 영역 갱신처리.
        oAPP.fn.updateBindPopupDesignData();


    };



    // static executeDelete = function(){

    // };



    /*************************************************************
     * @method - design tree 및 미리보기 UI 삭제 처리.
     *************************************************************/    
    static deleteUiObject = function(OBJID){
        
        //전달받은 파라메터의 UI OBJECT ID에 해당하는 DESIGN TREE 라인 데이터 얻기.
        var ls_tree = oAPP.fn.getTreeData(OBJID); 


        //내 부모가 자식 UI가 필수인 UI에 자식이 없는경우 강제추가 script 처리. 
        oAPP.attr.ui.frame.contentWindow.setChildUiException(ls_tree.PUIOK, ls_tree.POBID, undefined, undefined, true);

        //현재 UI가 자식 UI가 필수인 UI에 자식이 없는경우 강제추가 script 처리.
        oAPP.attr.ui.frame.contentWindow.setChildUiException(ls_tree.UIOBK, ls_tree.OBJID, undefined, undefined, true);

        //미리보기 화면 UI 제거.
        oAPP.attr.ui.frame.contentWindow.delUIObjPreView(ls_tree.OBJID, ls_tree.POBID, ls_tree.PUIOK, ls_tree.UIATT, ls_tree.ISMLB, ls_tree.UIOBK);


        //부모 TREE 라인 정보 얻기.
        var ls_parent = oAPP.fn.getTreeData(ls_tree.POBID);

        
        //선택라인의 삭제대상 OBJECT 제거 처리.
        CL_DELETE_UI.deleteTreeLine(ls_tree);
        
        //부모에서 현재 삭제대상 라인이 몇번째 라인인지 확인.
        var l_fIndx = ls_parent.zTREE.findIndex( a => a.OBJID === ls_tree.OBJID );

        if(l_fIndx !== -1){
            //부모에서 현재 삭제 대상건 제거.
            ls_parent.zTREE.splice(l_fIndx, 1);
        }

        //미리보기의 직접 입력 가능한 UI의 직접 입력건 반영처리.
        oAPP.fn.previewSetStrAggr(ls_tree);


    };



    /*************************************************************
     * @method - 선택라인의 삭제대상 OBJECT 제거 처리.
     *************************************************************/
    static deleteTreeLine = function (is_tree) {

        //child정보가 존재하는경우.
        if(is_tree.zTREE.length !== 0){
            //하위 TREE 정보가 존재하는경우
            for(var i=0, l=is_tree.zTREE.length; i<l; i++){
                //재귀호출 탐색하며 삭제 처리.
                CL_DELETE_UI.deleteTreeLine(is_tree.zTREE[i]);
    
            }

        }

        //클라이언트 이벤트 및 sap.ui.core.HTML의 프로퍼티 입력건 제거 처리.
        oAPP.fn.delUiClientEvent(is_tree);

        //Description 삭제.
        oAPP.fn.delDesc(is_tree.OBJID);

        //해당 UI의 바인딩처리 수집건 제거 처리.
        oAPP.fn.designUnbindLine(is_tree);

        //미리보기 UI destroy 처리.
        oAPP.attr.ui.frame.contentWindow.destroyUIPreView(is_tree.OBJID);

        //팝업 수집건에서 해당 UI 제거 처리.
        oAPP.fn.removeCollectPopup(is_tree.OBJID);

        //미리보기 UI 수집항목에서 해당 OBJID건 삭제.
        delete oAPP.attr.prev[is_tree.OBJID];

        //현재 미리보기 예외처리 대상 UI가 삭제되는 UI인경우.
        if(oAPP.attr?.UA015UI?._OBJID === is_tree.OBJID){
            //예외처리 UI 정보 제거.
            delete oAPP.attr.UA015UI;
        }
        
    };

    

    /*************************************************************
     * @method - 삭제 대상 라인으로 부터 하위의 ATTR 변경 데이터 수집.
     *************************************************************/
    static getMultiDeleteParam = function(aDesign, aParam = []) {

        if(typeof aDesign === "undefined"){
            return aParam;
        }

        if(aDesign.length === 0){
            return aParam;
        }

        for (let i = 0, l = aDesign.length; i < l; i++) {
            
            var _sDesign = aDesign[i];

            //라인선택한 건인 경우.
            if(_sDesign.chk === true){
                //수집 처리 후 하위 탐색 skip.
                aParam.push(_sDesign);
                continue;
            }

            //라인을 선택하지 않은 경우 하위를 탐색하며 수집 처리.
            aParam = CL_DELETE_UI.getMultiDeleteParam(_sDesign.zTREE, aParam);
            
        }

        return aParam;

    };


    /*************************************************************
     * @method - 삭제 대상건이 선택한건인지 확인.
     *************************************************************/
    static checkSelectObjidDelete = function(aOBJID){	
	
        for(let i = 0, l = aOBJID.length; i < l; i++){
            
            let _OBJID = aOBJID[i];

            //design tree 라인 정보 얻기.
            let _sDesign = oAPP.fn.getTreeData(_OBJID);
            
            //하위를 탐색하며 삭제건이 선택한건인지 확인.
            let _found = CL_DELETE_UI.checkSelectObjidDeleteRec(_sDesign);
            
            if(_found === true){
                
                return true;
            }
        }
        
    };


    /*************************************************************
     * @method - 삭제 대상건이 선택한건인지 확인 재귀호출 function.
     *************************************************************/
    static checkSelectObjidDeleteRec = function(sDesign){
	
        if(typeof sDesign === "undefined"){
            return;
        }
        
        //삭제 대상건이 선택한 건인경우.
        if(sDesign.OBJID === oAPP?.attr?.oModel?.oData?.uiinfo?.OBJID){
            //찾음 flag return.
            return true;
        }
        
        if(typeof sDesign?.zTREE === "undefined"){
            return;
        }
        
        if(sDesign?.zTREE?.length === 0){
            return;
        }
        
        for(let i = 0, l = sDesign.zTREE.length; i < l; i++){
            
            //하위를 탐색하며 삭제건이 선택한건인지 확인.
            let _found = CL_DELETE_UI.checkSelectObjidDeleteRec(sDesign.zTREE[i]);
            
            if(_found === true){
                return true;
            }
            
        }
        
        
    }

};




/*************************************************************
 * @class - UI 이동 처리 CLASS.(MOVE UP, MOVE DOWN, MOVE POSITION)
 *************************************************************/
class CL_MOVE_UI{

    /*************************************************************
     * @method - UI 이동 처리에 대한 이력 저장 처리.
     *************************************************************/
    static saveActionHistoryData(aTargetHist, oParam) {

        //파라메터 정보가 존재하는지 확인.
        if(typeof oParam?.OBJID === "undefined"){
            console.error(`(undoRedo.js) CL_MOVE_UI history save parameter undefined`);
            return;
        }

        //파라메터 정보가 존재하는지 확인.
        if(oParam?.OBJID === null){
            console.error(`(undoRedo.js) CL_MOVE_UI history save parameter null`);
            return;
        }

        //파라메터 값이 존재하지 않는경우.
        if(oParam?.OBJID === ""){
            console.error(`(undoRedo.js) CL_MOVE_UI history save parameter value none`);
            return;
        }

        //현재 UI가 부모의 몇번째 INDEX인지 확인.
        var _posit = oAPP.fn.getTreeIndexOfChild(oParam.OBJID);

        //저장 데이터구성.
        var _sParam = {
            ACTCD        : "MOVE",
            OBJID        : oParam.OBJID,
            BEFORE_POSIT : _posit
        };


        //이력 저장 처리.
        CL_COMMON.setHistoryData(aTargetHist, _sParam);


        //UNDO, REDO 버튼 활성화 처리.
        CL_COMMON.setUndoRedoButtonEnable();

    };


    /*************************************************************
     * @method - UI 이동 처리.
     *************************************************************/
    static executeHistory(sEvent, oParam){

        if(typeof oParam?.OBJID === "undefined"){

            console.error(`(undoRedo.js)[${sEvent.PRCCD}] ${oParam.ACTCD} during OBJID parameter undefined`);

            //WS 20 -> 바인딩 팝업 BUSY OFF 요청 처리.
            parent.require(oAPP.oDesign.pathInfo.bindPopupBroadCast)("BUSY_OFF");

            //단축키 잠금 해제처리.
            oAPP.fn.setShortcutLock(false);
            
            parent.setBusy("");

            return;
        }

        if(oParam?.OBJID === null){

            console.error(`(undoRedo.js)[${sEvent.PRCCD}] ${oParam.ACTCD} during OBJID parameter null`);

            //WS 20 -> 바인딩 팝업 BUSY OFF 요청 처리.
            parent.require(oAPP.oDesign.pathInfo.bindPopupBroadCast)("BUSY_OFF");

            //단축키 잠금 해제처리.
            oAPP.fn.setShortcutLock(false);
            
            parent.setBusy("");

            return;
        }

        if(oParam?.OBJID === ""){

            console.error(`(undoRedo.js)[${sEvent.PRCCD}] ${oParam.ACTCD} during OBJID parameter value none`);

            //WS 20 -> 바인딩 팝업 BUSY OFF 요청 처리.
            parent.require(oAPP.oDesign.pathInfo.bindPopupBroadCast)("BUSY_OFF");

            //단축키 잠금 해제처리.
            oAPP.fn.setShortcutLock(false);
            
            parent.setBusy("");

            return;
        }

        //이력 정보 저장 처리.
        CL_MOVE_UI.saveActionHistoryData(sEvent.T_HIST, oParam);


        //이동할 OBJECT ID 매핑 처리.
        oAPP.attr.oModel.setProperty("/lcmenu/OBJID", oParam?.OBJID);


        //현재 UNDO, REDO 처리 프로세스 정보 파라메터 처리.
        var _sProcess = {
            PRCCD: "UNDO_REDO"
        };


        //해당 UI 이전 위치로 이동 처리.
        oAPP.fn.contextMenuUiMove(undefined, oParam.BEFORE_POSIT, _sProcess);


    };


};



/*************************************************************
 * @class - UI 이름 변경.
 *************************************************************/
class CL_CHANGE_OBJID{

    /*************************************************************
     * @method - UI 이름 변경 처리에 대한 이력 저장 처리.
     *************************************************************/
    static saveActionHistoryData(aTargetHist, oParam) {

        //파라메터 정보가 존재하는지 확인.
        if(typeof oParam?.BEFORE_OBJID === "undefined"){
            console.error(`(undoRedo.js) CL_CHANGE_OBJID history save BEFORE_OBJID parameter undefined`);
            return;
        }

        //파라메터 정보가 존재하는지 확인.
        if(oParam?.BEFORE_OBJID === null){
            console.error(`(undoRedo.js) CL_CHANGE_OBJID history save BEFORE_OBJID parameter null`);
            return;
        }

        //파라메터 정보가 존재하는지 확인.
        if(oParam?.BEFORE_OBJID === ""){
            console.error(`(undoRedo.js) CL_CHANGE_OBJID history save BEFORE_OBJID parameter value none`);
            return;
        }

        if(typeof oParam?.OBJID === "undefined"){
            console.error(`(undoRedo.js) CL_CHANGE_OBJID history save OBJID parameter undefined`);
            return;
        }

        if(oParam?.OBJID === null){
            console.error(`(undoRedo.js) CL_CHANGE_OBJID history save OBJID parameter null`);
            return;
        }

        if(oParam?.OBJID === ""){
            console.error(`(undoRedo.js) CL_CHANGE_OBJID history save OBJID parameter value none`);
            return;
        }


        //저장 데이터구성.
        var _sParam = {
            ACTCD        : "CHANGE_OBJID",
            BEFORE_OBJID : oParam.BEFORE_OBJID,
            OBJID        : oParam.OBJID
        };


        //이력 저장 처리.
        CL_COMMON.setHistoryData(aTargetHist, _sParam);


        //UNDO, REDO 버튼 활성화 처리.
        CL_COMMON.setUndoRedoButtonEnable();

    };


    /*************************************************************
     * @method - UI 이름 변경 처리.
     *************************************************************/
    static async executeHistory(sEvent, oParam){

        //파라메터 정보가 존재하는지 확인.
        if(typeof oParam?.BEFORE_OBJID === "undefined" || oParam?.BEFORE_OBJID === null || oParam?.BEFORE_OBJID === ""){

            console.error(`(undoRedo.js)[${sEvent.PRCCD}] ${oParam.ACTCD} during BEFORE_OBJID parameter data none`);

            //WS 20 -> 바인딩 팝업 BUSY OFF 요청 처리.
            parent.require(oAPP.oDesign.pathInfo.bindPopupBroadCast)("BUSY_OFF");

            //단축키 잠금 해제처리.
            oAPP.fn.setShortcutLock(false);
            
            parent.setBusy("");

            return;
        }

        if(typeof oParam?.OBJID === "undefined" || oParam?.OBJID === null || oParam?.OBJID === ""){

            console.error(`(undoRedo.js)[${sEvent.PRCCD}] ${oParam.ACTCD} during OBJID parameter data none`);

            //WS 20 -> 바인딩 팝업 BUSY OFF 요청 처리.
            parent.require(oAPP.oDesign.pathInfo.bindPopupBroadCast)("BUSY_OFF");

            //단축키 잠금 해제처리.
            oAPP.fn.setShortcutLock(false);
            
            parent.setBusy("");

            return;
        }


        //저장 데이터구성.
        var _sParam = {
            ACTCD        : "CHANGE_OBJID",
            BEFORE_OBJID : oParam.OBJID,
            OBJID        : oParam.BEFORE_OBJID
        };


        //이력 정보 저장 처리.
        CL_CHANGE_OBJID.saveActionHistoryData(sEvent.T_HIST, _sParam);


        //변경된 이름으로 UI 수집 처리.
        oAPP.attr.prev[oParam.BEFORE_OBJID] = oAPP.attr.prev[oParam.OBJID];

        //UI의 OBJECT ID매핑건 변경 처리.
        oAPP.attr.prev[oParam.BEFORE_OBJID]._OBJID = oParam.BEFORE_OBJID;

        //DESIGN영역의 변경전 OBJID에 해당하는건 검색.
        var l_tree = oAPP.fn.getTreeData(oParam.OBJID);

        //OBJID ID 변경건으로 매핑.
        l_tree.OBJID = oParam.BEFORE_OBJID;

        //CHILD 정보가 존재하는 경우.
        if(l_tree.zTREE.length !== 0){
            //CHILD의 부모 OBJECT ID 를 변경 처리.
            for(var i=0,l=l_tree.zTREE.length; i<l; i++){
                l_tree.zTREE[i].POBID = oParam.BEFORE_OBJID;
            }
        }


        //클라이언트 이벤트 수집건 objid 변경.
        oAPP.fn.attrChgClientEventOBJID(oParam.BEFORE_OBJID, oParam.OBJID);


        //desc 입력건 정보 objid 변경.
        oAPP.fn.changeDescOBJID(oParam.BEFORE_OBJID, oParam.OBJID);


        //이전 UI OBJECT에 수집된 ATTR 정보가 존재하는경우.
        if(oAPP.attr.prev[oParam.BEFORE_OBJID]._T_0015.length !== 0){
            
            //ATTR의 OBJECT ID를 변경건으로 매핑.
            for(var i = 0, l = oAPP.attr.prev[oParam.BEFORE_OBJID]._T_0015.length; i < l; i++){
                oAPP.attr.prev[oParam.BEFORE_OBJID]._T_0015[i].OBJID = oParam.BEFORE_OBJID;

            }
    
        }

        
        //이전 이름의 UI 제거.
        delete oAPP.attr.prev[oParam.OBJID];


        var ls_uiinfo = oAPP.attr.oModel.getProperty("/uiinfo");


        //현재 선택한 라인이 아닌경우.
        if(ls_uiinfo.OBJID !== oParam.OBJID){
        
            oAPP.attr.oModel.refresh();

            //디자인 영역 모델 갱신 처리 후 design tree, attr table 갱신 대기. 
            await oAPP.fn.designRefershModel();
        
            //화면에서 UI추가, 이동, 삭제 및 attr 변경시 변경 flag 처리.
            oAPP.fn.setChangeFlag();

            //20240621 pes.
            //바인딩 팝업의 디자인 영역 갱신처리.
            oAPP.fn.updateBindPopupDesignData();

            return;
        }
        

        //현재 UI명을 이전으로 되돌림.
        ls_uiinfo.OBJID    = oParam.BEFORE_OBJID;
        ls_uiinfo.OBJID_bf = oParam.BEFORE_OBJID;


        //현재 출력된 attribute 리스트의 OBJID 변경 처리.
        for(var i = 0, l = oAPP.attr.oModel.oData.T_ATTR.length; i<l; i++){
            oAPP.attr.oModel.oData.T_ATTR[i].OBJID = oParam.BEFORE_OBJID;

        }
        
        //20240621 pes.
        //바인딩 팝업의 디자인 영역 갱신처리.
        oAPP.fn.updateBindPopupDesignData();


        //MODEL 갱신 처리.
        oAPP.attr.oModel.setProperty("/uiinfo", ls_uiinfo);
        oAPP.attr.oModel.refresh();

        //디자인 영역 모델 갱신 처리 후 design tree, attr table 갱신 대기. 
        await oAPP.fn.designRefershModel();


        //화면에서 UI추가, 이동, 삭제 및 attr 변경시 변경 flag 처리.
        oAPP.fn.setChangeFlag();

        //20240621 pes.
        //바인딩 팝업의 디자인 영역 갱신처리.
        oAPP.fn.updateBindPopupDesignData();
        

    };


};




/*************************************************************
 * @class - UI DRAG & DROP 처리.
 *************************************************************/
class CL_DRAG_DROP{

    /*************************************************************
     * @method - UIDRAG & DROP 처리에 대한 이력 저장 처리.
     *************************************************************/
    static saveActionHistoryData(aTargetHist, oParam) {

        if(typeof oParam === "undefined"){
            console.error(`(undoRedo.js) CL_DRAG_DROP history save parameter undefined`);
            return;
        }

        if(typeof oParam?.S_DRAG === "undefined"){
            console.error(`(undoRedo.js) CL_DRAG_DROP history save S_DRAG parameter undefined`);
            return;
        }

        if(typeof oParam?.S_DROP === "undefined"){
            console.error(`(undoRedo.js) CL_DRAG_DROP history save S_DROP parameter undefined`);
            return;
        }


        //저장 데이터구성.
        var _sDNDParam = {};

        _sDNDParam.ACTCD           = "DRAG_DROP";

        
        //대상 UI의 CHILD를 탐색하며, ATTR 변경건 수집 처리.
        var _aT_DRAG_0015 = CL_COMMON.collect0015Data(oParam.S_DRAG);

        var _aT_DROP_0015 = CL_COMMON.collect0015Data(oParam.S_DROP);


        _sDNDParam.S_DRAG          = JSON.parse(JSON.stringify(oParam.S_DRAG));

        //부모의 몇번째 CHILD 위치 정보.
        _sDNDParam.BEFORE_DRAG_POS = oAPP.fn.getTreeIndexOfChild(oParam.S_DRAG.OBJID);

        //drag한 UI로부터 하위 UI의 ATTR 변경건 수집.
        _sDNDParam.T_DRAG_0015     = JSON.parse(JSON.stringify(_aT_DRAG_0015));


        _sDNDParam.S_DROP          = JSON.parse(JSON.stringify(oParam.S_DROP));

        //drop한 UI로부터 하위 UI의 ATTR 변경건 수집.
        _sDNDParam.T_DROP_0015     = JSON.parse(JSON.stringify(_aT_DROP_0015));

        _sDNDParam.BEFORE_DROP_POS = oAPP.fn.getTreeIndexOfChild(oParam.S_DROP.OBJID);

        
        //이력 저장 처리.
        CL_COMMON.setHistoryData(aTargetHist, _sDNDParam);


        //UNDO, REDO 버튼 활성화 처리.
        CL_COMMON.setUndoRedoButtonEnable();

    };


    /*************************************************************
     * @method - UI DRAG & DROP 처리.
     *************************************************************/
    static async executeHistory(sEvent, oParam){


        if(typeof oParam?.S_DRAG === "undefined"){

            console.error(`(undoRedo.js)[${sEvent.PRCCD}] ${oParam.ACTCD} during S_DRAG parameter undefined`);

            //WS 20 -> 바인딩 팝업 BUSY OFF 요청 처리.
            parent.require(oAPP.oDesign.pathInfo.bindPopupBroadCast)("BUSY_OFF");

            //단축키 잠금 해제처리.
            oAPP.fn.setShortcutLock(false);
            
            parent.setBusy("");

            return;
        }


        if(typeof oParam?.S_DROP === "undefined"){

            console.error(`(undoRedo.js)[${sEvent.PRCCD}] ${oParam.ACTCD} during S_DROP parameter undefined`);

            //WS 20 -> 바인딩 팝업 BUSY OFF 요청 처리.
            parent.require(oAPP.oDesign.pathInfo.bindPopupBroadCast)("BUSY_OFF");

            //단축키 잠금 해제처리.
            oAPP.fn.setShortcutLock(false);
            
            parent.setBusy("");

            return;
        }

        
        //drag UI의 현재 라인 정보 얻기.
        var _sDesign = oAPP.fn.getTreeData(oParam.S_DRAG.OBJID);
        
        var _sParam = {};

        //현재 UI 정보를 얻어 매핑 처리.
        _sParam.S_DRAG = _sDesign;

        _sParam.S_DROP = oAPP.fn.getTreeData(oParam.S_DROP.OBJID);


        //이력 정보 저장 처리.
        CL_DRAG_DROP.saveActionHistoryData(sEvent.T_HIST, _sParam);
        
        
        //DRAG, DROP의 부모가 다르거나, aggregation이 다른경우.
        if(_sDesign.POBID !== oParam.S_DROP.POBID ||
            _sDesign.UIATK !== oParam.S_DROP.UIATK || 
            oParam.S_DRAG.POBID !== oParam.S_DROP.POBID || 
            oParam.S_DRAG.UIATK !== oParam.S_DROP.UIATK){
            
            var _aParent = [];


            //현재 UI의 부모 정보 얻기.
            _aParent.push(oAPP.fn.getTreeData(_sDesign.POBID));

            
            var _sInsertData = JSON.parse(JSON.stringify(CL_INSERT_UI.TY_INSERT_DATA));

            _sInsertData.S_DESIGN     = oParam.S_DRAG;

            _sInsertData.BEFORE_POSIT = oParam.BEFORE_DRAG_POS;
            
            //drag한 UI로부터 하위 UI의 ATTR 변경건.
            _sInsertData.T_0015       = oParam.T_DRAG_0015;

            //desc 정보 수집 처리.
            _sInsertData.T_DESC       = CL_COMMON.collectDescData(_sInsertData.S_DESIGN);

            //클라이언트 이벤트 수집 처리.
            _sInsertData.T_CEVT       = CL_COMMON.collectClientEventData(_sInsertData.T_0015);

            
            //현재 UI를 삭제 처리.
            CL_DELETE_UI.deleteUiObject(oParam.S_DRAG.OBJID);
            

            //부모의 onAfterRendering 이벤트 등록 처리.
            // var _aPromise = CL_COMMON.attachOnAfterRendering(_aParent);
            var _sRet = CL_COMMON.attachOnAfterRendering(_aParent);


            //대상 UI를 invalidate 처리.
            // CL_COMMON.invalidateUiObject(_aParent);
            CL_COMMON.invalidateUiObject(_sRet.aDesign);


            //부모의 onAfterRendering 처리 대기.
            // await Promise.all(_aPromise);
            await Promise.all(_sRet.aPromise);
            


            var _aParent = [];

            //UI의 이전 부모 정보 얻기.
            _aParent.push(oAPP.fn.getTreeData(oParam.S_DRAG.POBID));


            //부모의 onAfterRendering 이벤트 등록 처리.
            // var _aPromise = CL_COMMON.attachOnAfterRendering(_aParent);
            var _sRet = CL_COMMON.attachOnAfterRendering(_aParent);
            

            //이전 부모에 UI를 추가 처리.
            CL_INSERT_UI.insertUiObject(_sInsertData);


            //대상 UI를 invalidate 처리.
            // CL_COMMON.invalidateUiObject(_aParent);
            CL_COMMON.invalidateUiObject(_sRet.aDesign);
               

            oAPP.attr.oModel.refresh();


            //디자인 영역 모델 갱신 처리 후 design tree, attr table 갱신 대기. 
            await oAPP.fn.designRefershModel();

        
            //부모의 onAfterRendering 처리 대기.
            // await Promise.all(_aPromise);
            await Promise.all(_sRet.aPromise);


            //라인 선택 처리.
            await oAPP.fn.setSelectTreeItem(oParam.S_DRAG.OBJID);


            //20240621 pes.
            //바인딩 팝업의 디자인 영역 갱신처리.
            oAPP.fn.updateBindPopupDesignData();
           

            return;

        }


        var _aParent = [];

        //현재 UI의 부모 정보 얻기.
        _aParent.push(oAPP.fn.getTreeData(oParam.S_DRAG.POBID));



        var _aDNDData = [];


        //부모와 aggregation이 같은경우.

        //DRAG ui의 위치가 큰 경우
        if(oParam.BEFORE_DRAG_POS > oParam.BEFORE_DROP_POS){
           
            var _sDNDData = JSON.parse(JSON.stringify(CL_INSERT_UI.TY_INSERT_DATA));

            _sDNDData.S_DESIGN     = oParam.S_DROP;

            _sDNDData.BEFORE_POSIT = oParam.BEFORE_DROP_POS;
            
            _sDNDData.T_0015       = oParam.T_DROP_0015;

            //desc 정보 수집 처리.
            _sDNDData.T_DESC       = CL_COMMON.collectDescData(_sDNDData.S_DESIGN);

            //클라이언트 이벤트 수집 처리.
            _sDNDData.T_CEVT       = CL_COMMON.collectClientEventData(_sDNDData.T_0015);

            _aDNDData.push(_sDNDData);


            var _sDNDData = JSON.parse(JSON.stringify(CL_INSERT_UI.TY_INSERT_DATA));

            _sDNDData.S_DESIGN     = oParam.S_DRAG;

            _sDNDData.BEFORE_POSIT = oParam.BEFORE_DRAG_POS;
            
            _sDNDData.T_0015       = oParam.T_DRAG_0015;

            //desc 정보 수집 처리.
            _sDNDData.T_DESC       = CL_COMMON.collectDescData(_sDNDData.S_DESIGN);

            //클라이언트 이벤트 수집 처리.
            _sDNDData.T_CEVT       = CL_COMMON.collectClientEventData(_sDNDData.T_0015);

            _aDNDData.push(_sDNDData);

        }else{
            
            var _sDNDData = JSON.parse(JSON.stringify(CL_INSERT_UI.TY_INSERT_DATA));

            _sDNDData.S_DESIGN     = oParam.S_DRAG;

            _sDNDData.BEFORE_POSIT = oParam.BEFORE_DRAG_POS;
            
            _sDNDData.T_0015       = oParam.T_DRAG_0015;

            //desc 정보 수집 처리.
            _sDNDData.T_DESC       = CL_COMMON.collectDescData(_sDNDData.S_DESIGN);

            //클라이언트 이벤트 수집 처리.
            _sDNDData.T_CEVT       = CL_COMMON.collectClientEventData(_sDNDData.T_0015);

            _aDNDData.push(_sDNDData);

            
            var _sDNDData = JSON.parse(JSON.stringify(CL_INSERT_UI.TY_INSERT_DATA));

            _sDNDData.S_DESIGN     = oParam.S_DROP;

            _sDNDData.BEFORE_POSIT = oParam.BEFORE_DROP_POS;
            
            _sDNDData.T_0015       = oParam.T_DROP_0015;

            //desc 정보 수집 처리.
            _sDNDData.T_DESC       = CL_COMMON.collectDescData(_sDNDData.S_DESIGN);

            //클라이언트 이벤트 수집 처리.
            _sDNDData.T_CEVT       = CL_COMMON.collectClientEventData(_sDNDData.T_0015);

            _aDNDData.push(_sDNDData);


        }


        //drag, drop ui 삭제 처리.
        for (let i = 0, l = _aDNDData.length; i < l; i++) {
            
            var _sDNDData = _aDNDData[i];

            //대상 UI를 삭제 처리.
            CL_DELETE_UI.deleteUiObject(_sDNDData.S_DESIGN.OBJID);
            
        }


        
        //부모의 onAfterRendering 이벤트 등록 처리.
        // var _aPromise = CL_COMMON.attachOnAfterRendering(_aParent);
        var _sRet = CL_COMMON.attachOnAfterRendering(_aParent);


        //대상 UI를 invalidate 처리.
        // CL_COMMON.invalidateUiObject(_aParent);
        CL_COMMON.invalidateUiObject(_sRet.aDesign);


        //richtexteditor 미리보기 화면이 다시 그려질때까지 대기.
        //(richtexteditor가 없다면 즉시 하위 로직 수행 처리됨)
        // await Promise.all(_aPromise);
        await Promise.all(_sRet.aPromise);

        var _aParent = [];

        //현재 UI의 부모 정보 얻기.
        _aParent.push(oAPP.fn.getTreeData(oParam.S_DRAG.POBID));


        //부모의 onAfterRendering 이벤트 등록 처리.
        // var _aPromise = CL_COMMON.attachOnAfterRendering(_aParent);
        var _sRet = CL_COMMON.attachOnAfterRendering(_aParent);

        //drag, drop ui 추가 처리.
        for (let i = 0, l = _aDNDData.length; i < l; i++) {

            var _sDNDData = _aDNDData[i];
            
            //이전 부모에 UI를 추가 처리.
            CL_INSERT_UI.insertUiObject(_sDNDData);

        }

        //대상 UI를 invalidate 처리.
        // CL_COMMON.invalidateUiObject(_aParent);
        CL_COMMON.invalidateUiObject(_sRet.aDesign);

       
        oAPP.attr.oModel.refresh();


        //디자인 영역 모델 갱신 처리 후 design tree, attr table 갱신 대기. 
        await oAPP.fn.designRefershModel();

    
        //richtexteditor 미리보기 화면이 다시 그려질때까지 대기.
        //(richtexteditor가 없다면 즉시 하위 로직 수행 처리됨)
        // await Promise.all(_aPromise);
        await Promise.all(_sRet.aPromise);


        //라인 선택 처리.
        await oAPP.fn.setSelectTreeItem(oParam.S_DRAG.OBJID);
       

        //20240621 pes.
        //바인딩 팝업의 디자인 영역 갱신처리.
        oAPP.fn.updateBindPopupDesignData();


    };


};



/*************************************************************
 * @class - ATTRIBUTE 변경.
 *************************************************************/
class CL_CHANGE_ATTR{

    /*************************************************************
     * @method - attr 변경에 대한 이력 데이터 구성 처리.
     *************************************************************/
    static setActionHistoryData(oParam){

        var aT_ATTR  = [];


        for (let i = 0, l = oParam.length; i < l; i++) {
            
            var _sParam = oParam[i];

            var _sATTR = {};

            //UI OBJECT ID.
            _sATTR.OBJID  = _sParam.OBJID;

            //ATTRIBUTE KEY.
            _sATTR.UIATK  = _sParam.UIATK;

            //ATTRIBUTE TYPE.
            _sATTR.UIATY  = _sParam.UIATY;

            //ATTRIBUTE NAME.
            _sATTR.UIATT  = _sParam.UIATT;

            //ATTRIBUTE 대문자명.
            _sATTR.UIASN  = _sParam.UIASN;

            //ATTR 변경건 수집정보.
            _sATTR.S_0015 = undefined;

            //클라이언트 이벤트.
            _sATTR.T_CEVT = [];
                

            //현재 attr 수집건 정보 존재 여부 확인.
            var _s0015 = oAPP.attr.prev[_sParam.OBJID]._T_0015.find( item => item.UIATK === _sParam.UIATK );


            //수집된 정보가 존재하는경우.
            if(typeof _s0015 !== "undefined"){
                _sATTR.S_0015 = JSON.parse(JSON.stringify(_s0015));

            }

            aT_ATTR.push(_sATTR);
            
        }

        return aT_ATTR;

    };

    /*************************************************************
     * @method - ATTRIBUTE 변경 처리에 대한 이력 저장 처리.
     *************************************************************/
    static saveActionHistoryData(aTargetHist, aParam) {

        if(typeof aParam === "undefined"){
            console.error(`(undoRedo.js) CL_CHANGE_ATTR history save parameter undefined`);
            return;
        }

        if(Array.isArray(aParam) !== true){
            console.error(`(undoRedo.js) CL_CHANGE_ATTR history save parameter array not`);
            return;
        }

        if(aParam.length === 0){
            console.error(`(undoRedo.js) CL_CHANGE_ATTR history save parameter data none`);
            return;
        }


        var _sSaveHist = {};

        //UNDO, REDO시 수행할 ACTION 코드.
        _sSaveHist.ACTCD   = "CHANGE_ATTR";

        //attr 변경에 대한 이력 데이터 구성 처리.
        _sSaveHist.T_ATTR  = CL_CHANGE_ATTR.setActionHistoryData(aParam);


        //이력 저장 처리.
        CL_COMMON.setHistoryData(aTargetHist, _sSaveHist);


        //UNDO, REDO 버튼 활성화 처리.
        CL_COMMON.setUndoRedoButtonEnable();

    };


    /*************************************************************
     * @method - ATTRIBUTE 변경 처리.
     *************************************************************/
    static async executeHistory(sEvent, oParam){

        if(typeof oParam === "undefined"){

            console.error(`(undoRedo.js)[${sEvent.PRCCD}] ${oParam.ACTCD} during oParam parameter undefined`);

            //WS 20 -> 바인딩 팝업 BUSY OFF 요청 처리.
            parent.require(oAPP.oDesign.pathInfo.bindPopupBroadCast)("BUSY_OFF");

            //단축키 잠금 해제처리.
            oAPP.fn.setShortcutLock(false);
            
            parent.setBusy("");

            return;
        }

        if(Array.isArray(oParam?.T_ATTR) !== true){

            console.error(`(undoRedo.js)[${sEvent.PRCCD}] ${oParam.ACTCD} during T_ATTR parameter array not`);

            //WS 20 -> 바인딩 팝업 BUSY OFF 요청 처리.
            parent.require(oAPP.oDesign.pathInfo.bindPopupBroadCast)("BUSY_OFF");

            //단축키 잠금 해제처리.
            oAPP.fn.setShortcutLock(false);
            
            parent.setBusy("");

            return;
        }

        if(oParam.T_ATTR.length === 0){

            console.error(`(undoRedo.js)[${sEvent.PRCCD}] ${oParam.ACTCD} during T_ATTR data none`);

            //WS 20 -> 바인딩 팝업 BUSY OFF 요청 처리.
            parent.require(oAPP.oDesign.pathInfo.bindPopupBroadCast)("BUSY_OFF");

            //단축키 잠금 해제처리.
            oAPP.fn.setShortcutLock(false);
            
            parent.setBusy("");

            return;
        }


        //이력 정보 저장 처리.
        CL_CHANGE_ATTR.saveActionHistoryData(sEvent.T_HIST, oParam.T_ATTR);
        
        
        //ATTRIBUTE 변경 처리.
        CL_CHANGE_ATTR.executeChangeAttr(oParam);


    };




    /*************************************************************
     * @method - ATTRIBUTE 변경 처리.
     *************************************************************/
    static executeChangeAttr = async function(oParam){

        var _aOBJID = [];

        //현재 OBJECT ID 정보 수집.
        for (let i = 0, l = oParam.T_ATTR.length; i < l; i++) {

            var _sATTR = oParam.T_ATTR[i];

            //프로퍼티 변경건만 수집 처리.
            //(프로퍼티 세팅으로 미리보기 갱신을 위함)
            if(_sATTR.UIATY === "1"){
                _aOBJID.push(_sATTR.OBJID);
            }

        }

        
        //UI 추가 대상 부모 정보 얻기.
        var _aParent = CL_COMMON.collectParent(_aOBJID);


        for (let i = 0, l = oParam.T_ATTR.length; i < l; i++) {

            var _sATTR = oParam.T_ATTR[i];
            

            //이전 ATTR 변경건 위치 확인.
            var _indx = oAPP.attr.prev[_sATTR.OBJID]._T_0015.findIndex( item => item.UIATK === _sATTR.UIATK );


            //존재시 이전 수집 정보 제거.
            if(_indx !== -1){
                oAPP.attr.prev[_sATTR.OBJID]._T_0015.splice(_indx, 1);
            }


            //이전에 수집한 attribute 정보가 존재하는경우.
            if(typeof _sATTR.S_0015 !== "undefined"){
                //attr 변경건에 추가 처리.
                oAPP.attr.prev[_sATTR.OBJID]._T_0015.push(_sATTR.S_0015);

            }
            

            var _s0015 = _sATTR.S_0015;

            //이전 attr 정보가 존재하지 않는경우.
            //(_T_0015에 변경건 수집이 안된경우)
            if(typeof _s0015 === "undefined"){

                _s0015 = oAPP.fn.crtStru0015();

                //직접 입력 가능한 AGGREGATION인경우 구분자 제거.
                //(AT000001188_1 -> AT000001188)
                var _UIATK = _sATTR.UIATK.replace(/_1/, "");

                //attribute 항목 검색.
                var _s0023 = oAPP.DATA.LIB.T_0023.find( item => item.UIATK === _UIATK );

                if(typeof _s0023 !== "undefined"){
                    Object.assign(_s0015, JSON.parse(JSON.stringify(_s0023)));
                    _s0015.UIATV = _s0023.DEFVL;
                }

                _s0015.OBJID = _sATTR.OBJID;
                

            }

            
            //n건 바인딩 처리 정보 얻기.
            var l_model = oAPP.fn.getParentAggrBind(oAPP.attr.prev[_s0015.OBJID]);


            //n건 바인딩 정보가 존재하는경우.
            if(typeof l_model !== "undefined" && l_model !== ""){

                //현재 attr이 아닌 다른 바인딩된 UI가 N건 바인딩 처리됐는지 여부 확인.
                var l_indx = oAPP.attr.prev[_s0015.OBJID]._T_0015.findIndex( a=> a.ISBND === "X" && a.UIATK !== _sATTR.UIATK 
                && a.UIATV.substr(0, l_model.length) === l_model );
        
        
                //다른 바인딩 설정건중 n건 바인딩 처리건이 없는경우.
                if(l_indx === -1){
            
                    //부모에서 현재 n건 바인딩 정보 제거 처리.
                    oAPP.fn.attrUnbindProp(_s0015);
        
                }
        
            }


            //n건 바인딩 처리건인경우 부모 UI에 현재 UI 매핑 처리.
            oAPP.fn.setModelBind(oAPP.attr.prev[_sATTR.OBJID]);

            
            //미리보기 화면의 대상 ui의 프로퍼티 변경처리.
            oAPP.fn.previewUIsetProp(_s0015);
            
            
        }

        
        //미리보기 onAfterRendering 처리 관련 module load.
        var _oRender = parent.require(oAPP.oDesign.pathInfo.setOnAfterRender);


        var _aPromise = [];

        for (let i = 0; i < _aParent.length; i++) {
            
            var _sParent = _aParent[i];

            //onAfterRendering 이벤트 등록 대상 UI 얻기.
            let _oTarget = _oRender.getTargetAfterRenderingUI(oAPP.attr.prev[_sParent.OBJID]);
            
            let _oDom = undefined;

            if(typeof _oTarget?.getDomRef === "function"){
                _oDom = _oTarget.getDomRef();
            }
            
            
            //대상 UI가 화면에 출력된경우 onAfterRendering 이벤트 등록.
            if(typeof _oDom !== "undefined" && _oDom !== null){
                _aPromise.push(_oRender.setAfterRendering(_oTarget));

                /**
                 * @since   2026-02-03 11:25:22
                 * @version v3.5.9-1
                 * @author  pes
                 * @description
                 * attribute 변경건에 대해 RichTextEditor UI가 그려지는 것을 기다리는 
                 * 예외로직 주석 처리함.
                 * RichTextEditor UI의 visible이 true -> false로 변경되는 경우
                 * DOM을 구성하지 않아 richtexteditor 내부에 iframe이 생성되는것을
                 * 기다릴 수 없기에 주석 처리함.
                 */
                // //RichTextEditor 미리보기 출력 예외처리로직.
                // _aPromise = _aPromise.concat(_oRender.renderingRichTextEditor(_sParent));

                _oTarget.invalidate();

            }
            
        }
           

        //onAfterRendering 수행까지 대기.
        await Promise.all(_aPromise);


        //20240621 pes.
        //바인딩 팝업의 디자인 영역 갱신처리.
        oAPP.fn.updateBindPopupDesignData();

        
        //ROOT의 테마 변경건 존재여부 확인.
        var _sTheme = oParam.T_ATTR.find( item => item.UIATK === "DH001021" );

        if(typeof _sTheme?.S_0015?.UIATV !== "undefined"){
            //미리보기 테마 변경처리.
            oAPP.attr.ui.frame.contentWindow.setPreviewUiTheme(_sTheme.S_0015.UIATV);
        }

        
        //가장 첫번째로 수집된 ATTR 항목 얻기.
        var _sAttr = oParam.T_ATTR[0];

        
        //DESIGN tree item 선택 처리
        await oAPP.fn.setSelectTreeItem(_sAttr.OBJID, _sAttr.UIATK);

    };




    /*************************************************************
     * @method - attr 초기화시 파라메터 정보 구성.
     *************************************************************/
    static getResetAttrParam = function(){

        var _aATTR = [];

        //현재 ATTRIBUTE 항목중 PROPERTY 항목에 대해 직접 입력하여 값을 변경했다면, DEFAULT 값으로 초기화 처리.
        for(var i = 0, l = oAPP.attr.oModel.oData.T_ATTR.length; i < l; i++){

            var _sATTR = oAPP.attr.oModel.oData.T_ATTR[i];

            //프로퍼티가 아닌경우 skip.
            if(_sATTR.UIATY !== "1"){continue}

            //바인딩 처리된건인경우 skip.
            if(_sATTR.ISBND === "X"){continue;}

            var l_UIATK = _sATTR.UIATK;

            //직접 입력 가능한 attribute 여부확인(AT000002650_1 형식으로 구성됨)
            if(l_UIATK.indexOf("_") !== -1){
                //_1 부분 제거.
                l_UIATK = l_UIATK.substr(0, l_UIATK.indexOf("_"));
            }

            //현재 attribute 정보 검색.
            var ls_0023 = oAPP.DATA.LIB.T_0023.find( a => a.UIATK === l_UIATK );
            if(!ls_0023){continue;}

            //직접 입력 가능한 AGGREGATION인경우 값을 입력했다면.
            if(ls_0023.ISSTR === "X" && _sATTR.UIATV !== ""){

                _aATTR.push(_sATTR);

                continue;
            }

            //현재 attribute값과 default값이 같다면 skip.
            if(_sATTR.UIATV === ls_0023.DEFVL){continue;}

            _aATTR.push(_sATTR);

        }

        return _aATTR;

    };


};



/*************************************************************
 * @class - COMMON CLASS.
 *************************************************************/
class CL_COMMON{


    /*************************************************************
     * @method - 이력 저장 처리.
     *************************************************************/
    static setHistoryData = function(aHistory, oParam){

        //이력 저장 처리.
        aHistory.push(oParam);


        //저장된 이력 라인이 MAX 이력값을 초과한경우.
        if(aHistory.length > C_MAX_HISTORY){

            //가장 마지막 이력 제거 처리.
            aHistory.splice(0,  aHistory.length - C_MAX_HISTORY);

        }

    };


            
    /*************************************************************
     * @method - 입력 UI의 부모정보 수집 처리.
     *************************************************************/
    static collectParent = function (aDesign){

        var _aParent = [];

        for (let i = 0, l = aDesign.length; i < l; i++) {
            
            var _OBJID  = aDesign[i];

            //전달받은 파라메터의 UI OBJECT ID에 해당하는 DESIGN TREE 라인 데이터 얻기.
            var _sDesign = oAPP.fn.getTreeData(_OBJID);

            if(typeof _sDesign === "undefined"){
                continue;
            }

            var _sParent = oAPP.fn.getTreeData(_sDesign.POBID);

            if(typeof _sParent === "undefined"){
                continue;
            }

            //수집되지 않은경우만 수집 처리.
            if(_aParent.findIndex( item => item.OBJID === _sParent.OBJID) === -1){
                _aParent.push(_sParent);   
            }
            
        }

        return _aParent;
        
    };



    /*************************************************************
     * @method - 입력 UI 수집 처리.
     *************************************************************/
    static collectUIObject = function (aDesign){

        var _aUiObject = [];

        for (let i = 0, l = aDesign.length; i < l; i++) {
            
            var _OBJID  = aDesign[i];

            //전달받은 파라메터의 UI OBJECT ID에 해당하는 DESIGN TREE 라인 데이터 얻기.
            var _sDesign = oAPP.fn.getTreeData(_OBJID);

            if(typeof _sDesign === "undefined"){
                continue;
            }

            //수집되지 않은경우만 수집 처리.
            if(_aUiObject.findIndex( item => item.OBJID === _sDesign.OBJID) === -1){
                _aUiObject.push(_sDesign);   
            }
            
        }

        return _aUiObject;
        
    };


    /*************************************************************
     * @method - 대상 UI에 onAfterRendering 이벤트 등록 처리.
     *************************************************************/
    static attachOnAfterRendering = function(aDesign, T_OBJID = []) {
       
        //미리보기 onAfterRendering 처리 관련 module load.
        var _oRender = parent.require(oAPP.oDesign.pathInfo.setOnAfterRender);

        // var _aPromise = [];

        var _sRet = {};

        _sRet.aPromise = [];

        _sRet.aDesign = [];


        for (let i = 0; i < aDesign.length; i++) {
            
            var _sDesign = aDesign[i];
                        
            //onAfterRendering 이벤트 등록 대상 UI 얻기.
            let _oTarget = _oRender.getTargetAfterRenderingUI(oAPP.attr.prev[_sDesign.OBJID]);
            
            let _oDom = undefined;

            if(typeof _oTarget?.getDomRef === "function"){
                _oDom = _oTarget.getDomRef();
            }      
            
            var _sTree = oAPP.fn.getTreeData(_oTarget?._OBJID);

            if(_sTree === undefined){
                continue;
            }
            
            //대상 UI가 화면에 출력된경우 onAfterRendering 이벤트 등록.
            if(typeof _oDom !== "undefined" && _oDom !== null){
                
                // _aPromise.push(_oRender.setAfterRendering(_oTarget));
                _sRet.aPromise.push(_oRender.setAfterRendering(_oTarget));


                _sRet.aDesign.push(_sTree);

                //RichTextEditor 미리보기 출력 예외처리로직.
                // _aPromise = _aPromise.concat(_oRender.renderingRichTextEditor(_sDesign));

                for (let j = 0; j < _sTree.zTREE.length; j++) {
                    
                    var _sChild = _sTree.zTREE[j];

                    if(T_OBJID.indexOf(_sChild.OBJID) !== -1){
                        continue;
                    }

                    _sRet.aPromise = _sRet.aPromise.concat(_oRender.renderingRichTextEditor(_sChild));
                    
                }

            }
            
        }

        // return _aPromise;
        return _sRet;
        
    };


    /*************************************************************
     * @method - undo, redo 버튼 활성여부 처리.
     *************************************************************/
    static setUndoRedoButtonEnable = function() {

        if(typeof oAPP?.attr?.oModel?.oData?.designTree === "undefined"){
            oAPP.attr.oModel.oData.designTree = {};
        }


        //default 비활성 처리.
        oAPP.attr.oModel.oData.designTree.undo = false;
        oAPP.attr.oModel.oData.designTree.redo = false;
        

        //undo 이력이 존재하는경우.
        if(__ACT_UNDO_HIST.length > 0){
            //undo 버튼 활성화.
            oAPP.attr.oModel.oData.designTree.undo = true;
        }


        //redo 이력이 존재하는 경우.
        if(__ACT_REDO_HIST.length > 0){
            //redo 버튼 활성화.
            oAPP.attr.oModel.oData.designTree.redo = true;
        }

        
    };


    
    /*************************************************************
     * @method - 대상 라인으로 부터 하위의 ATTR 변경 데이터 수집.
     *************************************************************/
    static collect0015Data = function(sDesign, aT_0015 = []){

        if(typeof sDesign === "undefined"){
            return aT_0015;
        }   

        if(typeof oAPP.attr.prev[sDesign.OBJID]?._T_0015 !== "undefined"){
            //ATTR 변경건 데이터 수집.
            aT_0015 = aT_0015.concat(oAPP.attr.prev[sDesign.OBJID]._T_0015);
        }


        //CHILD 정보가 존재하지 않는경우 EXIT.
        if(typeof sDesign.zTREE === "undefined"){
            return aT_0015;
        }

        //CHILD 정보가 존재하지 않는경우 EXIT.
        if(sDesign.zTREE.length === 0){
            return aT_0015;
        }

        for (let i = 0, l = sDesign.zTREE.length; i < l; i++) {

            var _sChild = sDesign.zTREE[i];

            //하위 ui를 탐색하며, ATTR 변경 데이터 수집 처리.
            aT_0015 = CL_COMMON.collect0015Data(_sChild, aT_0015);
            
        }

        return aT_0015;


    };



    /*************************************************************
     * @method - 대상 라인으로 부터 하위의 Desc 입력건 수집.
     *************************************************************/
    static collectDescData = function(sDesign, aT_DESC = []){

        if(typeof sDesign === "undefined"){
            return aT_DESC;
        }   

        //현재 UI의 desc 입력건 확인.
        var _sDESC = oAPP.DATA.APPDATA.T_DESC.find( item => item.OBJID === sDesign.OBJID);

        //입력건이 존재하는경우 수집 처리.
        if(typeof _sDESC !== "undefined"){
            aT_DESC.push(_sDESC);
        }


        //CHILD 정보가 존재하지 않는경우 EXIT.
        if(typeof sDesign.zTREE === "undefined"){
            return aT_DESC;
        }

        //CHILD 정보가 존재하지 않는경우 EXIT.
        if(sDesign.zTREE.length === 0){
            return aT_DESC;
        }

        for (let i = 0, l = sDesign.zTREE.length; i < l; i++) {

            var _sChild = sDesign.zTREE[i];

            //하위 ui를 탐색하며, Desc 입력건 수집.
            aT_DESC = CL_COMMON.collectDescData(_sChild, aT_DESC);
            
        }

        return aT_DESC;


    };



    /*************************************************************
     * @method - 대상 라인으로 부터 하위의 클라이언트 이벤트 수집.
     *************************************************************/
    static collectClientEventData = function(aATTR){

        var _aT_CEVT = [];

        //전제 수집된 클라이언트 이벤트가 없는경우 exit.
        if(oAPP.DATA.APPDATA.T_CEVT.length === 0){
            return _aT_CEVT;
        }
        

        for (let i = 0, l = aATTR.length; i < l; i++) {
            
            var _sATTR = aATTR[i];

            if(_sATTR.UIATY !== "1" && _sATTR.UIATY !== "2"){
                continue;
            }

            //UI OBJECT ID + EVENT명.(BUTTON1PRESS)
            var _OBJID = _sATTR.OBJID + _sATTR.UIASN;

            var _sCEVT = oAPP.DATA.APPDATA.T_CEVT.find( a => a.OBJID === _OBJID );

            if(typeof _sCEVT === "undefined"){
                continue;
            }

            _aT_CEVT.push(_sCEVT);
            
        }

        return _aT_CEVT;

    };

    /*************************************************************
     * @method - 대상 UI를 invalidate 처리.
     *************************************************************/
    static invalidateUiObject = function(aDesign){

        if(typeof aDesign === "undefined"){
            return;
        }

        if(aDesign.length === 0){
            return;
        }

        for (let i = 0, l = aDesign.length; i < l; i++) {
            var _sDesign = aDesign[i];

            if(typeof oAPP.attr.prev[_sDesign.OBJID]?.invalidate !== "function"){
                continue;
            }

            //oAPP.attr.prev[_sDesign.OBJID].invalidate();
            oAPP.attr.prev[_sDesign.OBJID].rerender();
            
        }

    };


};



/*************************************************************
 * @class - AI를 통한 UI 추가.
 *************************************************************/
class CL_AI_INSERT{

    /*************************************************************
     * @method - UI 이름 변경 처리에 대한 이력 저장 처리.
     *************************************************************/
    static saveActionHistoryData(aTargetHist, oParam) {

        //파라메터 정보가 존재하는지 확인.
        if(typeof oParam?.PRCCD === "undefined"){
            console.error(`(undoRedo.js) CL_AI_INSERT history save PRCCD parameter undefined`);
            return;
        }

        //파라메터 정보가 존재하는지 확인.
        if(oParam?.PRCCD === null){
            console.error(`(undoRedo.js) CL_AI_INSERT history save PRCCD parameter null`);
            return; 
        }

        //파라메터 정보가 존재하는지 확인.
        if(oParam?.PRCCD === ""){
            console.error(`(undoRedo.js) CL_AI_INSERT history save: PRCCD parameter is empty`);
            return; 
        }


        //파라메터 정보가 존재하는지 확인.
        if(typeof oParam?.HIST === "undefined"){
            console.error(`(undoRedo.js) CL_AI_INSERT history save HIST parameter undefined`);
            return;
        }

        //파라메터 정보가 존재하는지 확인.
        if(oParam?.HIST === null){
            console.error(`(undoRedo.js) CL_AI_INSERT history save HIST parameter null`);
            return; 
        }


        //저장 데이터구성.
        var _sParam = {
            ACTCD          : "AI_INSERT",
            ROOT           : oParam.ROOT,
            RAND           : oParam.RAND,
            HIST           : [],
        };


        //UI가 삭제되는경우.
        if(oParam.PRCCD === "DEL"){

            _sParam.PRCCD = "ADD";

            _sParam.HIST = CL_DELETE_UI.setActionHistoryData(oParam.HIST) || [];
        }


        //UI가 추가되는 경우.
        if(oParam.PRCCD === "ADD"){

            _sParam.PRCCD = "DEL";

            _sParam.HIST = CL_INSERT_UI.setActionHistoryData(oParam.HIST) || [];    
        }


        //UI의 ATTRIBUTE 변경건인 경우.
        if(oParam.PRCCD === "CHANGE_ATTR"){

            _sParam.PRCCD = "CHANGE_ATTR";

            _sParam.HIST = CL_CHANGE_ATTR.setActionHistoryData(oParam.HIST) || [];
        }

        

        //이력 저장 처리.
        CL_COMMON.setHistoryData(aTargetHist, _sParam);


        //UNDO, REDO 버튼 활성화 처리.
        CL_COMMON.setUndoRedoButtonEnable();

    };


    /*************************************************************
     * @method - UI 추가, 삭제 처리.
     * 🚩 AI UI 추가, 삭제 시 순서 🚩
     * 1. 삭제건이 존재하는경우 삭제건 먼저 수행.
     * (삭)
     *************************************************************/
    static async executeHistory(sEvent, oParam){

        //파라메터 정보가 존재하는지 확인.
        if(typeof oParam?.HIST === "undefined" || oParam?.HIST === null){

            console.error(`(undoRedo.js)[${sEvent.PRCCD}] ${oParam.ACTCD} during HIST parameter data none`);

            //WS 20 -> 바인딩 팝업 BUSY OFF 요청 처리.
            parent.require(oAPP.oDesign.pathInfo.bindPopupBroadCast)("BUSY_OFF");

            //단축키 잠금 해제처리.
            oAPP.fn.setShortcutLock(false);
            
            parent.setBusy("");

            return;
        }


        //파라메터 정보가 존재하는지 확인.
        if(typeof oParam?.PRCCD === "undefined" || oParam?.PRCCD === null || oParam?.PRCCD === ""){

            console.error(`(undoRedo.js)[${sEvent.PRCCD}] ${oParam.ACTCD} during PRCCD parameter data none`);

            //WS 20 -> 바인딩 팝업 BUSY OFF 요청 처리.
            parent.require(oAPP.oDesign.pathInfo.bindPopupBroadCast)("BUSY_OFF");

            //단축키 잠금 해제처리.
            oAPP.fn.setShortcutLock(false);
            
            parent.setBusy("");

            return;
        }


        //삭제 처리건인경우.
        if(oParam.PRCCD === "DEL"){
            let _cancel = await CL_AI_INSERT.executeDelete(sEvent, oParam);

            if(_cancel === true){
                return;
            }

        }

        //추가 처리건인경우.
        if(oParam.PRCCD === "ADD"){
            await CL_AI_INSERT.executeInsert(sEvent, oParam);
        }

        
        //ATTR 변경건인경우.
        if(oParam.PRCCD === "CHANGE_ATTR"){
            CL_AI_INSERT.executeChangeAttr(sEvent, oParam);
        }
        

        let _aTarget = undefined;

        
        //UNDO, REDO에 따른 HISTORY 판단.
        switch (sEvent.PRCCD) {
            case "UNDO":
                
                _aTarget = __ACT_UNDO_HIST;

                break;

            case "REDO":
                
                _aTarget = __ACT_REDO_HIST;

                break;
        }


        //UNDO, REDO ACTION 수행 이후에 후속으로 수행해야하는 이력이 존재하는지 확인.
        let _aSubHist = _aTarget.filter( item => item?.RAND === oParam.RAND );

        //존재하지 않는경우.
        if(_aSubHist.length === 0){

            let _OBJID = oParam?.ROOT || "APP";

            //라인 선택 처리.
            await oAPP.fn.setSelectTreeItem(_OBJID);

            //20240621 pes.
            //바인딩 팝업의 디자인 영역 갱신처리.
            oAPP.fn.updateBindPopupDesignData();

            return;

        }


        //후속으로 수행해야 하는건이 존재하는경우 마지막 라인 발췌.
        let _subHist = _aSubHist.pop();

        //원본 이력 array에서 수행라인 위치 얻기.
        var _indx = _aTarget.findIndex( item => item === _subHist );

        //원본 이력 array에서 해당 라인 삭제.
        _aTarget.splice(_indx, 1);

        //후속 ACTION 수행.
        CL_AI_INSERT.executeHistory(sEvent, _subHist);
        

    };



    /*************************************************************
     * @method - UI ATTR 변경건 처리
     *************************************************************/
    static executeChangeAttr = function(sEvent, oParam){

        return new Promise(async function(resolve){

            if(oParam.HIST.length === 0){
                return resolve();
            }
            
            //저장 데이터구성.
            var _sParam = {
                ROOT           : oParam.ROOT,
                PRCCD          : "CHANGE_ATTR",
                RAND           : oParam.RAND,
                HIST           : [],
            };

            
            _sParam.HIST = oParam.HIST;

            //이력 정보 저장 처리.
            CL_AI_INSERT.saveActionHistoryData(sEvent.T_HIST, _sParam);

            
            var _sChangeAttr = {};

            _sChangeAttr.T_ATTR = oParam.HIST;
            

            CL_CHANGE_ATTR.executeChangeAttr(_sChangeAttr);


        });

    };




    /*************************************************************
     * @method - UI 삭제 처리.
     *************************************************************/
    static executeDelete = function(sEvent, oParam){

        return new Promise(async function(resolve){

            if(oParam.HIST.length === 0){
                return resolve();
            }
                
            //003	Do you really want to delete the object?
            var _msg = oAPP.common.fnGetMsgClsText("/U4A/MSG_WS", "003", "", "", "", "");

            parent.setBusy("");

            var _res = await new Promise((resolve)=>{

                parent.showMessage(parent.sap, 30, "I", _msg, async function(oEvent){

                    parent.setBusy("X");

                    resolve(oEvent);
                });

            });


            //삭제를 취소한 경우.
            if(_res !== "YES"){

                //이전 history에 다시 추가 처리. 
                switch (sEvent.PRCCD) {
                    case "UNDO":
                        __ACT_UNDO_HIST.push(oParam);
                        break;
                
                    case "REDO":
                        __ACT_REDO_HIST.push(oParam);
                        break;
                }

                //UNDO, REDO 버튼 활성화 처리.
                CL_COMMON.setUndoRedoButtonEnable();
                
                oAPP.attr.oModel.refresh();

                //WS 20 -> 바인딩 팝업 BUSY OFF 요청 처리.
                parent.require(oAPP.oDesign.pathInfo.bindPopupBroadCast)("BUSY_OFF");


                //단축키 잠금 해제처리.
                oAPP.fn.setShortcutLock(false);
                
                parent.setBusy("");

                //취소 처리됨 파라메터 RETURN.
                return resolve(true);
            }

                
            //저장 데이터구성.
            var _sParam = {
                ROOT           : oParam.ROOT,
                PRCCD          : "DEL",
                RAND           : oParam.RAND,
                HIST           : [],
            };

            for (let i = 0, l = oParam.HIST.length; i < l; i++) {
                
                var _OBJID = oParam.HIST[i];

                _sParam.HIST.push(oAPP.fn.getTreeData(_OBJID));

            }

            //이력 정보 저장 처리.
            CL_AI_INSERT.saveActionHistoryData(sEvent.T_HIST, _sParam);
                            

            //현재 우측에 출력한 UI의 TREE 정보 얻기.
            var _stree = oAPP.fn.getTreeData(oAPP.attr.oModel.oData.uiinfo.OBJID);

            //현재 선택건의 OBJID 매핑.
            var _SEL_OBJID = _stree?.OBJID || undefined;

            
            //삭제 대상건이 선택한건인지 확인.
            let _selected = CL_DELETE_UI.checkSelectObjidDelete(oParam.HIST);

            if(_selected === true){
                
                //선택한 UI의 부모를 얻음.
                var _sParent = oAPP.fn.getTreeData(_stree.POBID);

                _SEL_OBJID = _sParent.OBJID;

            }


            //직전 라인 정보를 얻지 못한 경우 ROOT를 선택 처리.
            if(typeof _SEL_OBJID === "undefined"){
                _SEL_OBJID = "ROOT";
            }


            //삭제 대상 UI의 부모 정보 수집 처리.
            var _aParent = CL_COMMON.collectParent(oParam.HIST);


            //대상 UI에 onAfterRendering 이벤트 등록 처리.
            // var _aPromise = CL_COMMON.attachOnAfterRendering(_aParent);
            var _sRet = CL_COMMON.attachOnAfterRendering(_aParent, oParam.HIST);


            for (let i = 0, l = oParam.HIST.length; i < l; i++) {
                
                var _OBJID = oParam.HIST[i];
                
                //design tree 및 미리보기 UI 삭제 처리.
                CL_DELETE_UI.deleteUiObject(_OBJID);

            }


            //변경 FLAG 처리.
            oAPP.fn.setChangeFlag();


            //대상 UI를 invalidate 처리.
            // CL_COMMON.invalidateUiObject(_aParent);
            CL_COMMON.invalidateUiObject(_sRet.aDesign);


            //미리보기 화면 변경 대기 처리.
            // await Promise.all(_aPromise);
            await Promise.all(_sRet.aPromise);

            oAPP.attr.oModel.refresh();
            
            //디자인 영역 모델 갱신 처리 후 design tree, attr table 갱신 대기. 
            await oAPP.fn.designRefershModel();

       
            return resolve();
            

        });

    };


    /*************************************************************
     * @method - UI 추가 처리.
     *************************************************************/
    static executeInsert = function(sEvent, oParam){

        return new Promise(async function(resolve){

            if(oParam.HIST.length === 0){
                return resolve();
            }

            var _aOBJID = [];

            //저장 데이터구성.
            var _sParam = {
                ROOT           : oParam.ROOT,
                PRCCD          : "ADD",
                RAND           : oParam.RAND,
                HIST           : [],
            };


            for (let i = 0, l = oParam.HIST.length; i < l; i++) {
                
                var _sInsertData = oParam.HIST[i];

                _sParam.HIST.push(_sInsertData.S_DESIGN);

                _aOBJID.push(_sInsertData.S_DESIGN.POBID);
                
            }
            
            //이력 정보 저장 처리.
            CL_AI_INSERT.saveActionHistoryData(sEvent.T_HIST, _sParam);

        

            //UI 추가 대상 부모 정보 얻기.
            var _aParent = CL_COMMON.collectUIObject(_aOBJID);


            //대상 UI에 onAfterRendering 이벤트 등록 처리.
            // var _aPromise = CL_COMMON.attachOnAfterRendering(_aParent);
            var _sRet = CL_COMMON.attachOnAfterRendering(_aParent);


            for (let i = 0, l = oParam.HIST.length; i < l; i++) {
                
                var _sInsertData = oParam.HIST[i];
                
                //design tree 및 미리보기 UI 생성, 추가 처리.
                CL_INSERT_UI.insertUiObject(_sInsertData);

            }


            //대상 UI를 invalidate 처리.
            // CL_COMMON.invalidateUiObject(_aParent);
            CL_COMMON.invalidateUiObject(_sRet.aDesign);

        
            //richtexteditor 미리보기 화면이 다시 그려질때까지 대기.
            //(richtexteditor가 없다면 즉시 하위 로직 수행 처리됨)
            // await Promise.all(_aPromise);
            await Promise.all(_sRet.aPromise);


            oAPP.attr.oModel.refresh();

            //디자인 영역 모델 갱신 처리 후 design tree, attr table 갱신 대기. 
            await oAPP.fn.designRefershModel();


            return resolve();
            

        });

    };

};