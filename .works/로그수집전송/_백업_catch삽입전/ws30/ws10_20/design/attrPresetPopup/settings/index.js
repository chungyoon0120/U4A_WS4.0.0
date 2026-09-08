/* 
*📦----------------------------------------------------------------------*
* Module       : attrPresetPopup.js
* Category     : Release / Workspace
* Role         : UI의 ATTRIBUTE 개인화 처리를 위한 팝업.
*
* Creator      : pes
* Created On   : 2026-03-24
*
* Description  :
*  - UI의 ATTRIBUTE 개인화 처리를 위한 팝업.
*
*----------------------------------------------------------------------*
*/

const USERINFO = parent.process.USERINFO;

const C_ATTR_PRESET_POPUP = "ATTR_PRESET_POPUP";

const TY_RES = {
    RETCD : "",
    RTMSG : ""
};

export async function attrPresetPopup(sParam){
    

    //Help Viewer module load.
    const _viewerPath =  parent.PATH.join(oAPP.oDesign.pathInfo.designRootPath, "util", "helpViewer.js");

    //DIALOG VIEWER IMPORT.
    const {dialogViewer} = await import(_viewerPath);

    //003  Cancel
    let _cancel = parent.WSUTIL.getWsMsgClsTxt("", "ZMSG_WS_COMMON_001", "003");

    //display 모드일경우 버튼 text를 close로 변경.
    if(oAPP.attr.oModel.oData.IS_EDIT === false){
        //056   close
        _cancel = parent.WSUTIL.getWsMsgClsTxt("", "ZMSG_WS_COMMON_001", "056");
    }


    const _oModel = new sap.ui.model.json.JSONModel({
        attr : JSON.parse(JSON.stringify(sParam.sAttr))
    });

    //settings UI 정보 구성.
    let _oContent = _getSettingUiInfo();


    _oContent.setModel(_oModel);


    //DIALOG VIEWER 호출.
    dialogViewer({
        control : _oContent
    }, {
        //627   UI Attribute 개인화
        title:parent.WSUTIL.getWsMsgClsTxt("", "ZMSG_WS_COMMON_001", "627"),
        width:"30%", 
        height:"80px", 
        draggable:true,
        resizable:true,
        showHelpDocButton : true,
        u4aHelpDocMenuID : "000278",
        disableMaximize : true,
        closeActionCode : "CANCEL",
        actions:[
        {
            ACTCD:"OK", 
            type : "Accept",
            icon: "sap-icon://accept",
            visible : oAPP.attr.oModel.oData.IS_EDIT,
            //232	Apply
            text:parent.WSUTIL.getWsMsgClsTxt("", "ZMSG_WS_COMMON_001", "232")
        },
        {
            ACTCD:"CANCEL", 
            type: "Reject",
            icon: "sap-icon://decline",
            //003	Cancel
            text:_cancel
        }
    ], fnCallback : async (sRes)=>{

            parent.setBusy("X");

            //단축키 잠금 처리.
            oAPP.fn.setShortcutLock(true);


            //취소(닫기) 선택시 팝업 종료.
            if(sRes?.ACTCD === "CANCEL"){

                //미리보기 화면 UI의 프로퍼티를 기존 attr 값으로 변경.
                oAPP.fn.previewUIsetProp(sParam.sAttr);

                sRes.dialog.close();

                //단축키 잠금 해제처리.
                oAPP.fn.setShortcutLock(false);

                parent.setBusy("");

                return;
            }

            let _sRes = {...TY_RES};

            let _sAttr = _oModel.getProperty("/attr");


            //저장 전 입력값 점검 처리.
            _sRes = _checkAttrValue(_sAttr);

            if(_sRes.RETCD === "E"){

                _sAttr.valst = "Error";
                _sAttr.valtx = _sRes.RTMSG;

                _oModel.refresh();

                parent.showMessage(sap, 20, "E", _sRes.RTMSG);

                //단축키 잠금 해제처리.
                oAPP.fn.setShortcutLock(false);

                parent.setBusy("");

                return;
            }

            
            //ui의 attr의 개인화 데이터 저장 처리.
            _sRes = await _savePresetAttrData(_sAttr);

            if(_sRes.RETCD === "E"){

                parent.showMessage(sap, 20, "E", _sRes.RTMSG);

                //단축키 잠금 해제처리.
                oAPP.fn.setShortcutLock(false);

                parent.setBusy("");

                return;
            }


            //미리보기 화면 UI의 프로퍼티를 기존 attr 값으로 변경.
            oAPP.fn.previewUIsetProp(sParam.sAttr);


            //628 등록이 완료됐습니다.
            parent.showMessage(sap, 10, "S", parent.WSUTIL.getWsMsgClsTxt("", "ZMSG_WS_COMMON_001", "628"));


            const sSysID = USERINFO.SYSID;

            const _allWindows = parent.REMOTE.BrowserWindow.getAllWindows();

            //인터페이스 명.
            const _if_name = `if-attrPresetPopup-${sSysID}`;

            //팝업명.
            const _popupName = `${C_ATTR_PRESET_POPUP}-${sSysID}`;

            const _IF_DATA = {
                PRCCD : "ATTR_CHANGE",
                DATA : {
                    UIATK : _sAttr.UIATK,
                    UIOBK : _sAttr.UIOBK,
                }
            };

            for (const _windows of _allWindows) {

                const sBrowserUrl = _windows.getURL();

                const oWebPref = parent.WSUTIL.QueryString.parse(sBrowserUrl);

                if(oWebPref?.OBJTY !== _popupName){
                    continue;
                }

                _windows.send(_if_name, _IF_DATA);

            }

            
            sRes.dialog.close();

            //단축키 잠금 해제처리.
            oAPP.fn.setShortcutLock(false);

            parent.setBusy("");




        }
    
    });

    //단축키 잠금 해제처리.
    oAPP.fn.setShortcutLock(false);

    parent.setBusy("");
    
}




/** ───────────────────────────────────────
 * ⚙️ _savePresetAttrData
 * ----------------------------------------
 * 📌 ui의 attr의 개인화 데이터 저장 처리.
 *
 * @return {object} 저장 처리 결과 정보
*/
async function _savePresetAttrData(sAttr){

    let _sRes = {...TY_RES};

    let _folderPath = parent.PATH.join(parent.PATHINFO.P13N_ROOT, "UI_ATTR");

    //폴더가 존재하지 않는 경우 생성.
    if (!parent.FS.existsSync(_folderPath)) {

        try {
            parent.FS.mkdirSync(_folderPath, {recursive: true});    
        } catch (error) {
            _sRes.RETCD = "E";

            //651   개인화 데이터 저장 폴더 생성에 실패했습니다.
            let _msg = parent.WSUTIL.getWsMsgClsTxt("", "ZMSG_WS_COMMON_001", "651");

            _sRes.RTMSG = _msg + "\n",
                        "www/ws10_20/design/attrPresetPopup/settings/index.js\n" + 
                        error.message;
            return _sRes;
        }
        

    }
    
    let _path = parent.PATH.join(oAPP.oDesign.pathInfo.designRootPath, "util", "sqliteManager.js");

    //SQLite3 처리 클래스 module import
    let {default: sqliteManager} = await import(_path);


    //db 저장 경로 정보 구성.
    let _dbPath = parent.PATH.join(parent.PATHINFO.P13N_ROOT, "UI_ATTR", "UI_ATTR_PRESET.db");

    let _sqlite = new sqliteManager(_dbPath);


    //DB 생성.
    _sqlite.createTable({
        tableName: "UI_ATTR_PRESET",
        columns: [
            "LIBVER TEXT NOT NULL",
            "SYSID TEXT NOT NULL",
            "UNAME TEXT NOT NULL",
            "UIATK TEXT NOT NULL",
            "UIOBK TEXT NOT NULL",
            "UIATV TEXT",
            "UIATY TEXT"
        ],
        primaryKey: ["LIBVER", "SYSID", "UNAME", "UIATK"]
    });


    /************************************************************************
     * DB 필드 업데이트 처리.
     * 
     * CREATE TABLE IF NOT EXISTS 구문은 테이블이 이미 존재하는 경우
     * 신규 컬럼을 자동으로 추가하지 않는다.
     * 
     * 따라서 DB 구조가 변경되는 경우 PRAGMA user_version 값을 기준으로
     * 필요한 ALTER TABLE 구문을 1회만 수행한다.
     ************************************************************************/

    //현재 DB 스키마 버전 조회.
    let _oVersion = _sqlite.query("PRAGMA user_version", [], {
        single: true
    });

    let _iVersion = _oVersion?.user_version || 0;


    //version 0 -> 1
    //최초 테이블 구조 버전.
    if(_iVersion < 1){

        _sqlite.execute("PRAGMA user_version = 1");

        _iVersion = 1;

    }

    

    // //version 1 -> 2
    // //UIATY 필드 추가됨
    // if(_iVersion < 2){

    //     _sqlite.addColumn({
    //         tableName: "UI_ATTR_PRESET",
    //         columnDef: "UIASN TEXT DEFAULT ''"
    //     });

    //     _sqlite.execute("PRAGMA user_version = 2");

    //     _iVersion = 2;

    // }

        
    //대상 DB에 프로퍼티 개인화 데이터 저장.
    _sqlite.upsertData({
        tableName: "UI_ATTR_PRESET",
        data: {
            LIBVER : oAPP.attr.metadata.METADATA.LIBVER,
            SYSID  : oAPP.attr.metadata.USERINFO.SYSID,
            UNAME  : oAPP.attr.metadata.USERINFO.UNAME,
            UIATK  : sAttr.UIATK,
            UIOBK  : sAttr.UIOBK,
            UIATV  : sAttr.UIATV,
            UIATY  : sAttr.UIATY,
        }
    });


    return _sRes;

}



/** ───────────────────────────────────────
 * ⚙️ _checkAttrValue
 * ----------------------------------------
 * 📌 ui의 ATTRIBUTE 설정값 점검.
 *
 * @return {object} 바인딩 데이터
*/
function _checkAttrValue(sAttr){

    sAttr.valst = undefined;
    sAttr.valtx = undefined;

    let _sRes = {...TY_RES};
    
    let _oDesignChkModule = parent.require(
      parent.PATH.join(oAPP.oDesign.pathInfo.designRootPath, "js", "checkAppData", "designTreeData.js"));


    //입력한 값에 따른 점검 처리.
    let _aReuireError = _oDesignChkModule.checkPropertyValue(sAttr);

    //입력한 값에 오류가 존재하는경우.
    if(_aReuireError?.RETCD === "E"){
        
        _sRes.RETCD = _aReuireError?.RETCD;
        _sRes.RTMSG = _aReuireError?.RTMSG;
        return _sRes;

    }


    //프로퍼티 입력건 정합성 점검.
    if(oAPP.fn.chkValidProp(sAttr) === false){
        _sRes.RETCD = "E";
        //629   잘못된 값을 입력했습니다.
        _sRes.RTMSG = parent.WSUTIL.getWsMsgClsTxt("", "ZMSG_WS_COMMON_001", "629");

        return _sRes;

    }


    return _sRes;


}



/** ───────────────────────────────────────
 * ⚙️ _onCallAttrDescPopup
 * ----------------------------------------
 * 📌 ui ATTRIBUTE 설명글 팝업 호출.
 *
*/
function _onCallAttrDescPopup(oUi){

    parent.setBusy("X");

    if(!oUi){
        parent.setBusy("");
        return;
    }

    let _oModel = oUi.getModel();

    if(!_oModel){
        parent.setBusy("");
        return;
    }

    let _sAttr = _oModel.getProperty("/attr");

    if(!_sAttr){
        parent.setBusy("");
        return;
    }


    //attribute 설명글 팝업 function이 존재하는경우.
    if(typeof oAPP.fn.callAttrDescPopup !== "undefined"){
        //attribute 설명글 팝업 호출.
        oAPP.fn.callAttrDescPopup(oUi, _sAttr);
        return;
    }

    //attribute 설명글 팝업 function이 존재하지 않는경우 script 호출.
    oAPP.fn.getScript("design/js/callAttrDescPopup",function(){
        //attribute 설명글 팝업 호출.
        oAPP.fn.callAttrDescPopup(oUi, _sAttr);
    }); 


}




/** ───────────────────────────────────────
 * ⚙️ _onChangeAttr
 * ----------------------------------------
 * 📌 UI ATTR의 입력 필드 변경 이벤트.
 *
 * @return {object} 바인딩 데이터
*/
function _onChangeAttr(oUi){
    
    parent.setBusy("X");

    if(!oUi){
        parent.setBusy("");
        return;
    }

    let _oModel = oUi.getModel();

    if(!_oModel){
        parent.setBusy("");
        return;
    }

    let _sAttr = _oModel.getProperty("/attr");

    if(!_sAttr){
        parent.setBusy("");
        return;
    }


    //입력값 점검.
    let _sRes = _checkAttrValue(_sAttr);

    if(_sRes.RETCD === "E"){

        _sAttr.valst = "Error";
        _sAttr.valtx = _sRes.RTMSG;

        _oModel.refresh();

        parent.showMessage(sap, 20, "E", _sRes.RTMSG);

        parent.setBusy("");

        return;
    }


    //미리보기 화면 UI의 프로퍼티 변경 처리.
    oAPP.fn.previewUIsetProp(_sAttr);


    parent.setBusy("");

}






/** ───────────────────────────────────────
 * ⚙️ _getSettingUiInfo
 * ----------------------------------------
 * 📌 setting 설정 UI instance.
 *
 * @return {object} setting 정보에 관련된 UI Instance
*/
function _getSettingUiInfo(){

    return new sap.m.HBox({
        alignItems: "Center",
        items : [
            new sap.m.HBox({
                alignItems: "Center",
                items : [
                    new sap.m.ObjectStatus({
                        text:"{/attr/UIATT}", 
                        icon:"{/attr/UIATT_ICON}", 
                        active:true,
                        press : function(oEvent){
                            _onCallAttrDescPopup(oEvent.getSource());
                        }
                    }),
                    new sap.ui.core.Icon({
                        src:"{/attr/icon0_src}", 
                        color:"{/attr/icon0_color}", 
                        visible:"{/attr/icon0_visb}", 
                        tooltip:"{/attr/icon0_ttip}", 
                        size:"12px"
                    })
                ]
            }).addStyleClass("sapUiLargeMarginEnd"),

            new sap.m.VBox({
                items: [
                    new sap.m.Input({
                        value:"{/attr/UIATV}", 
                        editable:"{/attr/edit}", 
                        visible:"{/attr/inp_visb}", 
                        tooltip:"{/attr/UIATV}", 
                        showClearIcon : true,
                        enabled:"{/attr/IS_EDIT}", 
                        valueState:"{/attr/valst}", 
                        valueStateText:"{/attr/valtx}",
                        submit: function(oEvent){
                            _onChangeAttr(oEvent.getSource());
                        }
                    }),
                    new sap.m.ComboBox({
                        showSecondaryValues:true, 
                        width:"100%", 
                        selectedKey:"{/attr/UIATV}", 
                        tooltip:"{/attr/UIATV}",
                        editable:"{/attr/edit}", 
                        visible:"{/attr/sel_visb}", 
                        enabled:"{/attr/IS_EDIT}", 
                        tooltip:"{/attr/UIATV}", 
                        value:"{/attr/comboval}",
                        valueState:"{/attr/valst}", 
                        valueStateText:"{/attr/valtx}",
                        change: function(oEvent){
                            _onChangeAttr(oEvent.getSource());
                        },
                        items: {
                            path : "/attr/T_DDLB",
                            templateShareable:true,
                            template: new sap.ui.core.ListItem({
                                key:"{KEY}", 
                                text:"{TEXT}", 
                                additionalText:"{DESC}"
                            })
                        }
                    }),
                    new sap.m.Button({
                        text:"{/attr/btn_text}", 
                        icon:"{/attr/btn_icon}", 
                        width:"100%", 
                        type:"{/attr/btn_type}", 
                        visible:"{/attr/btn_visb}",
                        press: function(oEvent){
                            
                        }
                    }),
                    new sap.m.CheckBox({
                        selected:"{/attr/UIATV_c}", 
                        editable:"{/attr/edit}", 
                        visible:"{/attr/chk_visb}",
                        enabled:"{/attr/IS_EDIT}", 
                        valueState:"{/attr/valst}",
                        select: function(oEvent){
                            
                        }
                    }),
                ]
            })
        ]
    }).addStyleClass("sapUiSmallMargin");

}