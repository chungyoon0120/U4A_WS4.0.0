//#region [MF-001]
// var oFrame = document.getElementById('ws_frame');

// var oAPP = oFrame.contentWindow.oAPP;
var oAPP = parent.oAPP;
//#endregion

var oCheckFunc = {};


/************************************************************************
 * attribute 점검 항목 영역 -start.
 * /U4A/CL_APPLICATION_CHECKER=>GTY_SYNTAX
    GRCOD(20) TYPE C,               "내부 그룹코드
    TYPE      TYPE SYMSGTY,         "오류 타입
    FNAME     TYPE STRING,          "오류 필드명
    DESC      TYPE STRING,          "내역
    LINE      TYPE I,               "오류 Index
    METHOD    TYPE STRING,          "메소드명
    OBJID     TYPE STRING,          "UI OBJECT ID
    UIATK     TYPE ZTU4A0023-UIATK, "오류 대상 프로퍼티 내부KEY
    GUBN(1)   TYPE C.               "A:UI 디자인 영역 B:컨트롤러 EDIT
************************************************************************/
const TY_ERROR = {
    GRCOD  : "",    //내부 그룹코드
    TYPE   : "",    //오류 타입
    FNAME  : "",    //오류 필드명
    DESC   : "",    //내역
    LINE   : "",    //오류 Index
    METHOD : "",    //메소드명
    OBJID  : "",    //UI OBJECT ID
    UIATK  : "",    //오류 대상 프로퍼티 내부KEY
    GUBN   : "",    //A:UI 디자인 영역 B:컨트롤러 EDIT
};


const TY_CHECK_RES = {
    RETCD : "",     //오류 여부 E: 오류
    ERCOD : "",     //오류 코드
    RTMSG : "",     //오류 메시지
};


/*********************************************************
 * @module - child가 필수인 UI의 Child 존재 여부 점검.
 ********************************************************/
module.exports.checkRequireChild = function() {

    //design tree 데이터를 기준으로 child필수 UI 점검.
    return checkRequireChildRec(oAPP.attr.oModel.oData.zTREE);
    
};



/*********************************************************
 * @module - 입력한 property에 대한 점검 처리.
 ********************************************************/
module.exports.checkValidProperty = function() {

    //design tree 데이터를 기준으로 입력 property 점검.
    return checkValidProperty(oAPP.attr.oModel.oData.zTREE);
    
};



/*********************************************************
 * @module - 프로퍼티 입력건 점검.
 ********************************************************/
module.exports.checkPropertyValue = function(sAttr){

    var _sRes = JSON.parse(JSON.stringify(TY_CHECK_RES));

    //바인딩 처리된 건인경우 EXIT.
    if(sAttr.ISBND === "X"){
        return _sRes;
    }

    //PROPERTY가 아닌경우 EXIT.
    if(sAttr.UIATY !== "1"){
        return _sRes;
    }


    //공통코드 UI 프로퍼티 점검 항목이 존재하지 않는다면 EXIT.
    if(typeof oAPP.attr.S_CODE?.UW09 === "undefined" || oAPP.attr.S_CODE?.UW09 === null){
        return _sRes;
    }


    //현재 프로퍼티가 점검 대상 인지 확인.
    var _sUW09 = oAPP.attr.S_CODE?.UW09.find( item => item.FLD01 === sAttr.UIOBK && item.FLD01 && item.FLD03 === sAttr.UIATT && item.FLD07 !== "X" ); 

    //점검 대상이 아닌경우 exit.
    if(typeof _sUW09 === "undefined"){
        return _sRes;
    }


    //점검처리 SCRIPT가 존재하지 않는경우 EXIT.
    if(_sUW09.FLD04 === "" && _sUW09.FLD05 === "" && _sUW09.FLD06 === ""){
        return _sRes;
    }

    //점검 처리 script 구성.
    var _eval = `_sRes = ${_sUW09.FLD04}${_sUW09.FLD05}${_sUW09.FLD06}`;


    //구성된 script 수행.
    try {
        eval(_eval);    
    } catch (error) {

    }
    

    return _sRes;


};



/*********************************************************
 * @module - child가 필수인 UI의 Child 존재 여부 점검 재귀호출 function.
 ********************************************************/
function checkRequireChildRec(aTree, aError = []) {
    
    if(typeof aTree === "undefined"){
        return aError;
    }

    if(aTree.length === 0){
        return aError;
    }


    for (let i = 0, l = aTree.length; i < l; i++) {
        
        var _sTree = aTree[i];

        var _aUA050 = oAPP.attr.S_CODE.UA050.filter( item => item.FLD01 === _sTree.UIOBK && item.FLD08 !== "X" );

        if(_aUA050.length === 0){
            //하위를 탐색하며, 점검 처리.
            checkRequireChildRec(_sTree.zTREE, aError);

            continue;
        }

        for (let j = 0; j < _aUA050.length; j++) {
            
            var _sUA050 = _aUA050[j];

            //필수 aggregation의 child가 존재하는지 확인.
            var _exist = _sTree.zTREE.findIndex( item => item.UIATT === _sUA050.FLD03 );

            //존재하는경우 하위 로직 skip.
            if(_exist === 0){
                continue;
            }

            //필수점검 예외 AGGR명(해당 AGGR에 UI가 존재시 점검 생략) 항목이 존재시 해당 aggr에 UI가 존재하는경우.
            if(_sUA050.FLD09 !== "" && _sTree.zTREE.findIndex( item => item.UIATT === _sUA050.FLD09 ) !== -1){
                //필수 점검 생략 처리.
                _exist = 0;
            }

            //필수 aggregation에 child 정보가 존재하지 않는경우.
            if(_exist === -1){

                var _sError = JSON.parse(JSON.stringify(TY_ERROR));

                //그룹코드 : 오브젝트 (CLAS,METH...)
                _sError.GRCOD  = "PROG";

                //오류 flag.
                _sError.TYPE   = "E";

                //오류 메시지.
                //217	&1 UI의 &2 Aggregation에 UI를 추가하십시오.
                _sError.DESC   = parent.WSUTIL.getWsMsgClsTxt(oAPP.oDesign.settings.GLANGU, "ZMSG_WS_COMMON_001", "217", _sTree.OBJID, _sUA050.FLD03);

                //오류 Index
                _sError.LINE   = "";
                
                //UI OBJECT ID            
                _sError.OBJID  = _sTree.OBJID;
                
                //A:UI 디자인 영역 B:컨트롤러 EDIT
                _sError.GUBN   = "A";


                aError.push(_sError);
                
                _sError = null;
                
            }
            
        }


        //하위를 탐색하며, 점검 처리.
        checkRequireChildRec(_sTree.zTREE, aError);

        // //현재 UI가 필수 점검 대상 UI 인지 여부 확인.
        // var _sUA050 = oAPP.attr.S_CODE.UA050.find( item => item.FLD01 === _sTree.UIOBK && item.FLD08 !== "X" );

        // //필수 점검 대상 UI가 아닌경우.
        // if(typeof _sUA050 === "undefined"){

        //     //하위를 탐색하며, 점검 처리.
        //     checkRequireChildRec(_sTree.zTREE, aError);

        //     continue;

        // }

        // //필수 aggregation의 child가 존재하는지 확인.
        // var _exist = _sTree.zTREE.findIndex( item => item.UIATT === _sUA050.FLD03 );

        // //필수 aggregation에 child 정보가 존재하지 않는경우.
        // if(_exist === -1){

        //     var _sError = JSON.parse(JSON.stringify(TY_ERROR));

        //     //그룹코드 : 오브젝트 (CLAS,METH...)
        //     _sError.GRCOD  = "PROG";

        //     //오류 flag.
        //     _sError.TYPE   = "E";

        //     //오류 메시지.
        //     //217	&1 UI의 &2 Aggregation에 UI를 추가하십시오.
        //     _sError.DESC   = parent.WSUTIL.getWsMsgClsTxt(oAPP.oDesign.settings.GLANGU, "ZMSG_WS_COMMON_001", "217", _sTree.OBJID, _sUA050.FLD03);

        //     //오류 Index
        //     _sError.LINE   = "";
            
        //     //UI OBJECT ID            
        //     _sError.OBJID  = _sTree.OBJID;
            
        //     //A:UI 디자인 영역 B:컨트롤러 EDIT
        //     _sError.GUBN   = "A";


        //     aError.push(_sError);
            
        //     _sError = null;
            
        // }


        // //하위를 탐색하며, 점검 처리.
        // checkRequireChildRec(_sTree.zTREE, aError);

    }

    return aError;
    
}



/*********************************************************
 * @function - design tree 데이터를 기준으로 입력 property 점검.
 ********************************************************/
function checkValidProperty(aTree, aError = []){

    if(typeof aTree === "undefined"){
        return;
    }

    if(aTree.length === 0){
        return;
    }

    for (let i = 0, l = aTree.length; i < l; i++) {
        
        const _sTree = aTree[i];

        const _aT0015 = oAPP.attr.prev[_sTree.OBJID]._T_0015;

        for (let j = 0; j < _aT0015.length; j++) {
            
            const _s0015 = _aT0015[j];

            //프로퍼티 점검 처리.
            let _sRes = module.exports.checkPropertyValue(_s0015);

            if(_sRes?.RETCD === "E"){

                let _sError = JSON.parse(JSON.stringify(TY_ERROR));

                //그룹코드 : 오브젝트 (CLAS,METH...)
                _sError.GRCOD  = "PROG";

                //오류 flag.
                _sError.TYPE   = "E";

                //오류 메시지.
                _sError.DESC   = _sRes.RTMSG;

                //오류 Index
                _sError.LINE   = "";
                
                //UI OBJECT ID            
                _sError.OBJID  = _sTree.OBJID;

                //오류 대상 프로퍼티 내부KEY
                _sError.UIATK  = _s0015.UIATK;
                
                //A:UI 디자인 영역 B:컨트롤러 EDIT
                _sError.GUBN   = "A";


                aError.push(_sError);
                
                _sError = null;

            }

            
        }

        //하위를 탐색하며, 프로퍼티 점검 처리.
        checkValidProperty(_sTree.zTREE, aError);
        
    }

    return aError;

}



/*********************************************************
 * @function - 입력한 property의 from to 값 점검 처리.
 ********************************************************/
oCheckFunc.validFromTo = function(sAttr, from, to){

    const _sRes = JSON.parse(JSON.stringify(TY_CHECK_RES));
    

    //attribute에 입력한 값을 integer으로 변환.
    const _UIATV = parseInt(Number(sAttr.UIATV));

    //숫자 유형 여부 확인.
    if(isNaN(_UIATV) === true){
        _sRes.RETCD = "E";

        //372	&1 은 숫자 유형이 아닙니다. 숫자 유형의 값을 입력 하십시오.
        _sRes.RTMSG = parent.WSUTIL.getWsMsgClsTxt(oAPP.oDesign.settings.GLANGU, "ZMSG_WS_COMMON_001", "372", sAttr.UIATV);

        return _sRes;
    }


    //from 값보다 작은 값을 입력했거나, to 값보다 큰 값을 입력한 경우.
    if(_UIATV < from || _UIATV > to){

        _sRes.RETCD = "E";

        //226	&1 값은 허용값이 아닙니다.(&2 ~ &3 사이의 값을 입력하십시오.)
        _sRes.RTMSG = parent.WSUTIL.getWsMsgClsTxt(oAPP.oDesign.settings.GLANGU, 
            "ZMSG_WS_COMMON_001", "226", sAttr.UIATV, from, to);

        return _sRes;

    }

    return _sRes;

};



/**
 * @since   2026-08-14 19:22:08
 * @version vNAN-NAN
 * @author  pes
 * @description
 * sap.ui.layout.form.ResponsiveGridLayout 컬럼/레이블 관련 속성 점검
 */
oCheckFunc.validResponsiveGridLayoutColumns = function(sAttr){

    const _sRes = JSON.parse(JSON.stringify(TY_CHECK_RES));

    var _sKey = "";

    if(typeof sAttr.UIATK === "string"){
        _sKey = sAttr.UIATK.trim();
    }

    if(_sKey === ""){
        return null;
    }

    // 대상 속성인지 판단.
    switch(_sKey){
        case "AT000012666": // labelSpanXL
        case "AT000012675": // columnsXL
            break;
        case "AT000012667": // labelSpanL
        case "AT000012668": // labelSpanM
        case "AT000012669": // labelSpanS
        case "AT000012676": // columnsL
        case "AT000012677": // columnsM
            break;
        default:
            return null;
    }

    //숫자 유형 여부 확인.
    var _sVal = sAttr.UIATV;

    _sVal = _sVal && _sVal.trim ? _sVal.trim() : String(_sVal);

    const _nVal = Number(_sVal);

    if(_sVal === "" || Number.isNaN(_nVal) || Number.isInteger(_nVal) !== true){

        _sRes.RETCD = "E";

        //372	&1 은 숫자 유형이 아닙니다. 숫자 유형의 값을 입력 하십시오.
        _sRes.RTMSG = parent.WSUTIL.getWsMsgClsTxt(oAPP.oDesign.settings.GLANGU, "ZMSG_WS_COMMON_001", "372", sAttr.UIATV);

        return _sRes;
    }

    // labelSpanXL/columnsXL: -1, 1~12 허용
    if(_sKey === "AT000012666" || _sKey === "AT000012675"){

        if(_nVal !== -1 && (_nVal < 1 || _nVal > 12)){

            _sRes.RETCD = "E";

            //226	&1 값은 허용값이 아닙니다.(&2 ~ &3 사이의 값을 입력하십시오.)
            _sRes.RTMSG = parent.WSUTIL.getWsMsgClsTxt(oAPP.oDesign.settings.GLANGU, 
                "ZMSG_WS_COMMON_001", "226", sAttr.UIATV, -1, 12);

            return _sRes;
        }

        return _sRes;
    }

    // 나머지 대상 속성: 1~12 허용
    if(_nVal < 1 || _nVal > 12){

        _sRes.RETCD = "E";

        //226	&1 값은 허용값이 아닙니다.(&2 ~ &3 사이의 값을 입력하십시오.)
        _sRes.RTMSG = parent.WSUTIL.getWsMsgClsTxt(oAPP.oDesign.settings.GLANGU, 
            "ZMSG_WS_COMMON_001", "226", sAttr.UIATV, 1, 12);

        return _sRes;
    }

    return _sRes;

};



/*********************************************************
 * @function - 입력한 property의 최소값 숫자 점검.
 ********************************************************/
oCheckFunc.validMinInt = function(sAttr, minValue){

    const _sRes = JSON.parse(JSON.stringify(TY_CHECK_RES));

    //attribute에 입력한 값을 integer으로 변환.
    const _UIATV = parseInt(Number(sAttr.UIATV));

    //숫자 유형 여부 확인.
    if(isNaN(_UIATV) === true){
        _sRes.RETCD = "E";

        //372	&1 은 숫자 유형이 아닙니다. 숫자 유형의 값을 입력 하십시오.
        _sRes.RTMSG = parent.WSUTIL.getWsMsgClsTxt(oAPP.oDesign.settings.GLANGU, "ZMSG_WS_COMMON_001", "372", sAttr.UIATV);

        return _sRes;
    }
    
    //입력값이 기준값보다 작은경우.
    if(_UIATV < minValue){

        _sRes.RETCD = "E";

        //373	&1 보다 큰 값을 입력 하십시오.
        _sRes.RTMSG = parent.WSUTIL.getWsMsgClsTxt(oAPP.oDesign.settings.GLANGU, "ZMSG_WS_COMMON_001", "373", minValue);

        return _sRes;

    }

    return _sRes;

};



/**
 * @since   2026-05-22 16:50:18
 * @version v3.6.4-0
 * @author  pes
 * @description
 * sap.m.Column의 minScreenWidth 프로퍼티 점검 처리 function 추가.
 * 해당 프로퍼티는 px, em, rem 혹은 sap.m.ScreenSize 의 값을 허용 하기에
 * 별도의 점검 로직이 필요하여 추가함.
 */
oCheckFunc.validmColMinScreenWidth = function(sAttr){

    const _sRes = {...TY_CHECK_RES};

    //px, em, rem 단위 체크를 위한 정규식.
    const _regex = /^(0|[1-9]\d*)(px|em|rem)$/;


    //입력값이 sap.m.ScreenSize에 해당하는 경우 점검 통과 처리.
    if(Object.keys(oAPP.attr.ui.frame.contentWindow.sap.m.ScreenSize).includes(sAttr.UIATV)){
        return _sRes;
    }

    //입력값이 px, em, rem 단위에 해당하는지 체크.
    if(_regex.test(sAttr.UIATV) === false){

        _sRes.RETCD = "E";

        //814	&1는 혀용되지 않는 값 입니다. "px", "em", "rem" 또는 sap.m.ScreenSize 값만 입력할 수 있습니다.
        //      sap.m.ScreenSize - Phone, Tablet, Desktop, XXSmall, XSmall, Small, Medium, Large, XLarge, XXLarge
        _sRes.RTMSG = parent.WSUTIL.getWsMsgClsTxt("", "ZMSG_WS_COMMON_001", "814", sAttr.UIATV);

        return _sRes;

    }

    return _sRes;

};



/**
 * @since   2026-05-22 16:50:18
 * @version v3.6.4-0
 * @author  pes
 * @description
 * sap.m.ColorPalette, sap.m.ColorPalettePopover의 colors 프로퍼티 점검 로직 추가
 * colors 프로퍼티의 경우 색상코드의 값을 배열 형식으로 추가 해야하는 내용이 있음
 * 특히 최소 2건 최대 15건이라는 갯수 제약을 갖고 있기에 별도의 점검 function을 통해
 * 입력값을 점검 하도록 로직 보완함.
 */
oCheckFunc.validmColorPaletteColors = function({ sAttr, min = 2, max = 15 }){

    const _sRes = {...TY_CHECK_RES};


    let _sVal = sAttr.UIATV;


    _sVal = _sVal.trim();


    //입력값이 공백인 경우 허용.
    //이 경우 호출부에서 ui.setColors(); 형태로 처리해야 함.
    if(_sVal === ""){
        return _sRes;
    }


    //대괄호 입력 형식 점검.
    const _bStartBracket = _sVal.startsWith("[");
    const _bEndBracket   = _sVal.endsWith("]");

    if(_bStartBracket !== _bEndBracket){

        _sRes.RETCD = "E";
        //816   &1는 허용되지 않는 값 입니다. 배열 형식은 [값1, 값2] 형태로 입력해야 합니다.
        _sRes.RTMSG = parent.WSUTIL.getWsMsgClsTxt("", "ZMSG_WS_COMMON_001", "816", sAttr.UIATV);

        return _sRes;

    }


    //[yellow, pink] 형태인 경우 대괄호 제거.
    if(_bStartBracket === true && _bEndBracket === true){
        _sVal = _sVal.substring(1, _sVal.length - 1).trim();
    }


    //대괄호 제거 후 공백이면 빈 배열 입력으로 판단.
    //단, 최초 입력값 공백은 허용하지만 [] 는 colors 배열 개수 조건 위반으로 처리.
    if(_sVal === ""){

        _sRes.RETCD = "E";
        //817   &1는 허용되지 않는 값 입니다. 최소 &2개 이상 입력해야 합니다.
        _sRes.RTMSG = parent.WSUTIL.getWsMsgClsTxt("", "ZMSG_WS_COMMON_001", "817", sAttr.UIATV, min);

        return _sRes;

    }


    const _aVal = _sVal.split(",").map(function(sVal){

        sVal = sVal.trim();

        // "red", 'red' 형태의 따옴표 제거.
        sVal = sVal.replace(/^["'](.*)["']$/, "$1").trim();

        return sVal;

    });


    //red,,blue / red, blue, 처럼 빈 항목이 존재하는지 점검.
    if(_aVal.some(function(sVal){ return sVal === ""; }) === true){

        _sRes.RETCD = "E";
        //818   &1는 허용되지 않는 값 입니다. 빈 색상 항목이 존재합니다.
        _sRes.RTMSG = parent.WSUTIL.getWsMsgClsTxt("", "ZMSG_WS_COMMON_001", "818", sAttr.UIATV);

        return _sRes;

    }


    //최소 개수 점검.
    if(_aVal.length < min){

        _sRes.RETCD = "E";
        //817   &1는 허용되지 않는 값 입니다. 최소 &2개 이상 입력해야 합니다.
        _sRes.RTMSG = parent.WSUTIL.getWsMsgClsTxt("", "ZMSG_WS_COMMON_001", "817", sAttr.UIATV, min);

        return _sRes;

    }


    //최대 개수 점검.
    if(_aVal.length > max){

        _sRes.RETCD = "E";
        //819	&1는 허용되지 않는 값 입니다. 최대 &2개까지만 입력할 수 있습니다.
        _sRes.RTMSG = parent.WSUTIL.getWsMsgClsTxt("", "ZMSG_WS_COMMON_001", "819", sAttr.UIATV, max);

        return _sRes;

    }


    //sap.ui.core.CSSColor 정합성 점검.
    const _oWin = oAPP.attr.ui.frame.contentWindow;

    let _CSSColor = undefined;

    if(_oWin.sap?.ui?.core?.CSSColor){
        _CSSColor = _oWin.sap.ui.core.CSSColor;
    }

    if(!_CSSColor && _oWin.sap?.ui?.require){

        const _oCoreLib = _oWin.sap.ui.require("sap/ui/core/library");

        if(_oCoreLib?.CSSColor){
            _CSSColor = _oCoreLib.CSSColor;
        }

    }

    if(!_CSSColor || typeof _CSSColor.isValid !== "function"){
        return _sRes;
    }


    for(let i = 0, l = _aVal.length; i < l; i++){

        const _sColor = _aVal[i];

        if(_CSSColor.isValid(_sColor) === true){
            continue;
        }

        _sRes.RETCD = "E";
        //820	&1는 허용되지 않는 색상 값 입니다. CSSColor 형식의 값을 입력해야 합니다.
        _sRes.RTMSG = parent.WSUTIL.getWsMsgClsTxt("", "ZMSG_WS_COMMON_001", "820", _sColor);

        return _sRes;

    }


    return _sRes;

};



/**
 * @since   2026-05-22 16:50:18
 * @version v3.6.4-0
 * @author  pes
 * @description
 * sap.m.TimePicker의 localeId 프로퍼티 입력값 점검 function 추가.
 * localeId 프로퍼티의 타입이 string 이지만 실제로는 허용되는 값이 존재하기에
 * 별도의 점검 function을 통해 입력값을 점검 해야하기에 로직 보완함.
 */
oCheckFunc.validmTimePickerLocaleId = function(sAttr){

    const _sRes = {...TY_CHECK_RES};


    let _sVal = sAttr.UIATV;

    _sVal = _sVal.trim();

    //공백 허용.
    if(_sVal === ""){
        return _sRes;
    }

    const _oWin = oAPP.attr.ui.frame.contentWindow;

    let Locale = undefined;

    if(_oWin.sap?.ui?.require){
        Locale = _oWin.sap.ui.require("sap/ui/core/Locale");
    }

    if(!Locale){
        return _sRes;
    }

    try {

        new Locale(_sVal);

    } catch (e) {

        _sRes.RETCD = "E";

        //821	"&1는 허용되지 않는 값 입니다. BCP-47 형식의 locale 값을 입력해야 합니다.
        //      예: ko, ko-KR, en, en-US, ja-JP"
        _sRes.RTMSG = parent.WSUTIL.getWsMsgClsTxt("", "ZMSG_WS_COMMON_001", "821", sAttr.UIATV);

        return _sRes;

    }

    return _sRes;

};



/**
 * @since   2026-05-22 16:50:18
 * @version v3.6.4-0
 * @author  pes
 * @description
 * - sap.m.PlanningCalendar의 viewKey 정합성 점검 로직 추가
 * - viewKey는 단순 string 값이 아니라 현재 PlanningCalendar에서 사용 가능한
 *   PlanningCalendarView의 key를 참조하는 값이므로 일반 문자열 입력을 제한함
 * - 허용값은 sap.m.PlanningCalendarBuiltInView enum 값과
 *   현재 UI 계층의 views aggregation에 추가된 PlanningCalendarView의
 *   key 프로퍼티 직접 입력값으로 한정함.
 */
oCheckFunc.validmPlanningCalendarViewKey = function(sAttr){

    const _sRes = {...TY_CHECK_RES};


    let _sVal = sAttr.UIATV;

    _sVal = _sVal.trim();

    if(_sVal === ""){
        return _sRes;
    }


    //허용 가능한 viewKey 목록.
    const _aAllowKeys = [];


    /*************************************************************
     * 1. sap.m.PlanningCalendarBuiltInView enum 값 수집
     *************************************************************/
    const _oWin = oAPP.attr.ui.frame.contentWindow;

    const _oBuiltInView = _oWin?.sap?.m?.PlanningCalendarBuiltInView;

    if(_oBuiltInView && typeof _oBuiltInView === "object"){

        Object.keys(_oBuiltInView).forEach(function(sKey){

            const _sEnumVal = _oBuiltInView[sKey];

            if(typeof _sEnumVal !== "string" || _sEnumVal.trim() === ""){
                return;
            }

            _aAllowKeys.push(_sEnumVal.trim());

        });

    }


    /*************************************************************
     * 2. 현재 PlanningCalendar의 views aggregation 하위 UI 수집
     *************************************************************/
    const _sTree = oAPP.fn.getTreeData(sAttr.OBJID);

    if(_sTree && Array.isArray(_sTree.zTREE)){

        //views aggregation에 추가된 child UI만 발췌.
        const _aViewChild = _sTree.zTREE.filter(function(oTree){

            return oTree && oTree.UIATK === "AT000005048";

        });


        _aViewChild.forEach(function(oTree){

            if(!oTree){
                return;
            }

            //PlanningCalendarView UI명.
            //예: PLANNINGCALENDARVIEW1
            const _sChildObjid = oTree.OBJID;

            if(!_sChildObjid){
                return;
            }

            const _oPrev = oAPP.attr.prev[_sChildObjid];

            if(!_oPrev || !Array.isArray(_oPrev._T_0015)){
                return;
            }

            //PlanningCalendarView의 key 프로퍼티 정보 검색.
            const _oKeyAttr = _oPrev._T_0015.find(function(oAttr){

                return oAttr && oAttr.UIATK === "AT000005085";

            });

            if(!_oKeyAttr){
                return;
            }


            if(_oKeyAttr.ISBND !== ""){
                return;
            }

            const _sKeyVal = _oKeyAttr.UIATV;

            if(typeof _sKeyVal !== "string" || _sKeyVal.trim() === ""){
                return;
            }

            _aAllowKeys.push(_sKeyVal.trim());

        });

    }


    /*************************************************************
     * 3. 중복 제거
     *************************************************************/
    const _aUniqueAllowKeys = Array.from(new Set(_aAllowKeys));


    /*************************************************************
     * 4. 허용값 존재 여부 점검
     *************************************************************/
    if(_aUniqueAllowKeys.includes(_sVal) === false){

        _sRes.RETCD = "E";

        //822	"&1는 허용되지 않는 값 입니다. 
        //      PlanningCalendar의 viewKey는 sap.m.PlanningCalendarBuiltInView 값 
        //      또는 views aggregation에 추가된 PlanningCalendarView의 key 값만 입력할 수 있습니다.
        //      허용값: &2
        _sRes.RTMSG = parent.WSUTIL.getWsMsgClsTxt("", "ZMSG_WS_COMMON_001", "822", sAttr.UIATV, _aUniqueAllowKeys.join(", "));

        return _sRes;

    }

    return _sRes;

};
