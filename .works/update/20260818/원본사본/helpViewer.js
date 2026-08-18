/* 
*📦----------------------------------------------------------------------*
* Module       : helpViewer.js
* Category     : Release / Workspace
* Role         : WS3.0 도움말 뷰어 module JS
*
* Creator      : pes
* Created On   : 2026-01-01
*
* Description  :
*  - Popover, Dialog, Electron 유형의 도움말 팝업 처리 module JS
*
*----------------------------------------------------------------------*
*/

/*************************************************************
 * @function - Popover 유형의 도움말 팝업 처리 module.
 * @param {object} contents - 출력 html 정보
 *  contents.src          - HTML src
 *  contents?.htmlContent - HTML Source.
 *  contents?.control     - popover 내부에 추가로 표시할 UI5 control
 * @param  {Object} oParam  - popover 설정 정보
 *  oParam.title         - popover title
 *  oParam.width         - popover width
 *  oParam.height        - popover height
 *  oParam.placement     - popover placement (default: "Auto")
 *  oParam.resizable     - popover resizable 여부 (default: true)
 *  oParam.actions       - popover action button 정보
 *  oParam.IF_DATA       - HTML 내부로 전달할 데이터 정보
 *  oParam.fnCallback    - action 버튼 press 시 호출될 콜백 함수
 *  oParam.closeActionCode - 팝업 종료 시 호출될 action code
 *************************************************************/
//#region ⚙️ popoverViewer
export function popoverViewer(contents, oParam){

    const _oContr = {};

    _oContr.ui = {};

    // const _oHTML = new sap.ui.core.HTML({
    //     preferDOM : false
    // });

    //도움말 html 정보 존재시 HTML ui instance 구성.
    let _oContent = setHTMLUiInstance({contents});


    //u4a help document 버튼 ui instance 구성.
    let _oHelpBtn = setHelpDocButton({oParam});


    let oPopover = new sap.m.Popover({
        placement : oParam?.placement || "Auto",
        busyIndicatorDelay: 0,
        busy :true,
        // title : oParam?.title,
        contentWidth: oParam?.width,
        contentHeight: oParam?.height,
        verticalScrolling: false,
        resizable: oParam?.resizable !== undefined ? oParam.resizable : true,
        customHeader : new sap.m.Toolbar({
            content: [
                new sap.m.Title({
                    text : oParam?.title,
                }),
                new sap.m.ToolbarSpacer(),

                //U4A HELP DOCUMENT 버튼.
                _oHelpBtn,

                new sap.m.ToolbarSeparator(),
                
                new sap.m.Button({
                    type : "Reject",
                    icon : "sap-icon://decline",
                    press : function() {
                        /**
                         * @since   2026-07-07 02:00:12
                         * @version vNAN-NAN
                         * @author  pes
                         * @description
                         * 팝업 종료에 대한 action code를 전달받아 호출처에 전달하도록 처리.
                         */
                        // oPopover.close();

                        if(!oParam.fnCallback){
                            oPopover.close();
                            return;
                        }

                        if(!oParam.closeActionCode){
                            oPopover.close();
                            return;
                        }

                        const _sParam = {

                            ACTCD : closeActionCode,

                            //POPOVER 내부 I/F 데이터 정보
                            IF_DATA : oPopover.data("IF_DATA"),

                            //popover ui instance.
                            popover : oPopover,

                        };

                        //액션 코드에 해당하는 커스텀 데이터 정보를 얻어 호출처에 전달.
                        oParam.fnCallback(_sParam);
                    }
                })
            ]
        }),
        content : [

            /**
             * @since   2026-04-21 11:11:51
             * @version v3.6.0-4
             * @author  pes
             * @description
             * popoverViewer에 추가 UI 컨트롤이 필요한 경우 contents.control에 
             * 해당 컨트롤을 전달하여 popover 내부에 표시할 수 있도록 처리.
             */
            new sap.m.Page({
                showHeader : false,
                enableScrolling : false,
                content:[
                    new sap.m.VBox({
                        height : "100%",
                        renderType: "Bare",
                        items :[
                            _oContent,
                            contents?.control
                        ]
                    })
                ]
            })
        ],
        beforeOpen : function(){
            //befor open에서 html content 정보 매핑.
            //iframe을 기본으로 만들고 src 파라메터에 값이 있으면 src에 해당 값을 매핑.
            //html 정보에 값이 존재하는경우 iframe 안에 해당 html을 줘야함.

            // //테마 변경 이벤트 등록.
            // sap.ui.getCore().attachThemeChanged(themeChanged);
    
            // let _oDelegate = {
            //     onAfterRendering: function(){
            //         // _oHTML.removeEventDelegate(_oDelegate);

            //         let _oDom = oPopover.getDomRef();

            //         if(!_oDom){
            //             return;
            //         }

            //         let _oFrame = _oDom.querySelector('iframe');

            //         if(!_oFrame){
            //             return;
            //         }

            //         //iframe load 이벤트에서 테마 변경 처리 및 init 이벤트 전달.
            //         _oFrame.addEventListener("load", function(){

            //             /**
            //              * @since   2026-04-21 11:13:16
            //              * @version v3.6.0-4
            //              * @author  pes
            //              * @description
            //              * 도움말 html에 대한 초기화 처리를 위해 iframe load 이벤트에서 
            //              * HTML 내부로 init 커스텀 이벤트를 전달하도록 처리.
            //              */
            //             const _sParam = {
            //                 //HTML 내부로 전달할 파라메터 정보
            //                 IF_DATA : oPopover.data("IF_DATA"),

            //                 //현재 적용된 테마 정보
            //                 theme : getThemeMode(sap.ui.getCore().getConfiguration().getTheme()),

            //                 //부모 POPOVER ID 정보
            //                 parentId : oPopover.getId()
            //             };

            //             const customEvt = new CustomEvent('init', {detail:_sParam});

            //             //도움말 html iframe 내부에 init 커스텀 이벤트 전달.
            //             //(도움말 html 영역에 init 이벤트가 등록되지 않는 경우가 있어 강제로 이벤트 전달)
            //             _oFrame.contentWindow.dispatchEvent(customEvt);

            //             //현재 적용된 테마 정보 가져오기.
            //             let _theme = sap.ui.getCore().getConfiguration().getTheme();

            //             //도움말 html iframe 내부에 테마 변경 처리 함수 호출.
            //             toggleTheme(_theme);

            //         }, {once : true});


            //     }
            // };

            // _oHTML.addEventDelegate(_oDelegate);


            // //src 정보를 입력 받은경우.
            // if(contents?.src){
            //     // let _html = `<iframe id="helpDoc" style="width:100%; height:100%; border: none;" src="${contents.src}"></iframe>`;
            //     let _html = `<iframe style="width:100%; height:100%; border: none;" src="${contents.src}"></iframe>`;
            //     _oHTML.setContent(_html);
            //     return;
            // }


            // //html source를 입력받은경우.
            // if(contents?.htmlContent){

            //     let _oFrame = document.createElement("iframe");

            //     _oFrame.setAttribute("srcdoc", contents.htmlContent);

            //     _oFrame.style.width = "100%";
            //     _oFrame.style.height = "100%";
            //     _oFrame.style.border = "none";
            //     // _oFrame.id = "helpDoc";

            //     _oHTML.setContent(_oFrame.outerHTML);

            // }


        },
        afterOpen : function(){

            /**
             * @since   2026-04-21 11:14:28
             * @version v3.6.0-4
             * @author  pes
             * @description
             * popoverViewer가 열린 후 popover DOM에 커스텀 이벤트와 
             * actions에 정의된 액션 코드에 대한 커스텀 이벤트를 등록하여
             * popover 내부의 HTML에서 부모 popover로 이벤트 전달이 가능하도록 처리.
             */
            const _oPopoverDom = this.getDomRef();

            //popover DOM 정보가 없는경우 크리티컬 오류 처리.
            if(!_oPopoverDom){
                let _msg = `"www/ws10_20/design/util/helpViewer.js"\n` +
                `파일에서 오류 발생.\n` +
                `popoverViewer 팝업의 afterOpen 이벤트에 popover DOM 정보가 없음\n` +
                `관리자에게 문의 바랍니다.`;
                throw new Error(_msg);
            }

            //미리보기 html -> 팝업의 I/F를 위한 이벤트 등록.
            _oPopoverDom.addEventListener("childResponse", (oEvent)=>{

                if(!oParam.fnCallback){
                    return;
                }

                const _sParam = {

                    ACTCD : oEvent.detail.ACTCD,

                    //POPOVER 내부 I/F 데이터 정보
                    IF_DATA : oEvent.detail.IF_DATA,

                    //popover ui instance.
                    popover : oPopover,

                };

                //액션 코드에 해당하는 커스텀 데이터 정보를 얻어 호출처에 전달.
                oParam.fnCallback(_sParam);

            });


            //POPOVER DOM에 커스텀 이벤트 등록.
            oParam?.actions?.forEach?.( (oAction) => {
                _oPopoverDom.addEventListener(oAction.ACTCD, (e) => {

                    //전달받은 파라메터를 POPOVER의 커스텀 데이터에 액션 코드와 같이 셋팅.

                    //HTML으로 부터 전달받은 I/F 데이터 갱신 처리.
                    oPopover.data("IF_DATA", e.detail.IF_DATA);

                });
            });

            this.setBusy(false);

        },
        afterClose : function(){

            _oContr.ui = {};

            //테마 변경 이벤트 제거.
            sap.ui.getCore().detachThemeChanged(themeChanged);

            oPopover.destroy();
        },
        footer : new sap.m.OverflowToolbar({
            content : [
                new sap.m.ToolbarSpacer()
            ]
        })
    }).addStyleClass("sapUiSizeCompact");


    //HTML 내부로부터 전달받은 I/F 데이터 정보 셋팅.
    oPopover.data("IF_DATA", JSON.parse(JSON.stringify(oParam?.IF_DATA || {})));


    /**
     * @since   2026-04-21 11:16:26
     * @version v3.6.0-4
     * @author  pes
     * @description
     * popoverViewer에 action 버튼이 정의된 경우, 
     * action 버튼 정보를 기반으로 popover footer에 버튼을 추가하고,
     * 버튼 클릭 시 fnCallback이 호출되도록 처리. 
     * action 버튼이 정의되지 않은 경우 기본적으로 닫기 버튼만 표시하도록 처리.
     */
    const _oFooter = oPopover.getFooter();

    // action 버튼 설정.
    oParam?.actions?.forEach?.( (oAction) => {
        _oFooter.addContent(new sap.m.Button({
            text : oAction.text,
            type : oAction.type,
            icon : oAction.icon,
            enabled : oAction.enabled,
            visible : oAction.visible,
            press : function() {

                if(!oParam.fnCallback){
                    oPopover.close();
                    return;
                }

                const _sParam = {

                    ACTCD : this.data("ACTCD"),

                    //POPOVER 내부 I/F 데이터 정보
                    IF_DATA : oPopover.data("IF_DATA"),

                    //popover ui instance.
                    popover : oPopover,

                };

                //액션 코드에 해당하는 커스텀 데이터 정보를 얻어 호출처에 전달.
                oParam.fnCallback(_sParam);

            }
        }).data("ACTCD", oAction.ACTCD));
    });


    //버튼 설정건이 존재하지 않는경우.
    if(!Array.isArray(oParam?.actions) || oParam.actions.length === 0){
        //기본 닫기 버튼 추가.
        _oFooter.addContent(new sap.m.Button({
            type : "Reject",
            icon : "sap-icon://decline",
            press : function() {
                oPopover.close();
            }
        }));
    }


    if(_oContent){
        _oContent.data("POPUP", oPopover);
    }

    
    _oContr.ui.ROOT = oPopover;


    //테마 변경 이벤트 처리 함수.
    function themeChanged(oEvent){

        let _theme = oEvent.getParameter("theme");

        //도움말 html iframe 내부에 테마 변경 처리 함수 호출.
        toggleTheme(_theme);

    }


    //도움말 html iframe 내부에 테마 변경 처리 함수 호출.
    function toggleTheme(theme){

        if(!theme){
            return;
        }

        let _oDom = oPopover.getDomRef();

        if(!_oDom){
            return;
        }

        let _oFrame = _oDom.querySelector('iframe');

        if(!_oFrame?.contentWindow?.toggleTheme){
            return;
        }

        //테마 모드 가져오기.
        let _themeMode = getThemeMode(theme);


        //iframe 내부에 테마 변경 함수 호출.
        _oFrame.contentWindow.toggleTheme(_themeMode);


    }


    return _oContr;

}




/**
 * @since   2026-02-09 16:17:54
 * @version v3.6.0-0
 * @author  PES
 * @description
 * dialog 유형의 도움말 팝업 처리 module 추가.
 */
/** ───────────────────────────────────────
 //#region ⚙️  dialogViewer 
 * ----------------------------------------
 * 📌 설명: dialog 유형의 도움말 팝업 처리 module.
 *
 * @param {object} contents - 출력 html 정보
 *  contents.src         - HTML src    (src 입력시 htmlContent는 사용하지 않는다.)
 *  contents.htmlContent - HTML Source.(htmlContent입력시 src는 사용하지 않는다.)
 *  contents.control     - popover 내부에 추가로 표시할 UI5 control
 *  contents.altContent  - HTML src가 파일 path일 경우 해당 path에 파일이 존재하지 않을시 출력 html 정보.
 * @param  {Object} oParam  - dialog 설정 정보
 *  oParam.title         - dialog title
 *  oParam.width         - dialog width
 *  oParam.height        - dialog height
 *  oParam.resizable     - popover resizable 여부 (default: true)
 *  oParam.showHelpDocButton - U4A HELP DOCUMENT 버튼 활성 여부.
 *  oParam.u4aHelpDocMenuID  - U4A HELP DOCUMENT 호출을 위한 메뉴 ID정보
 *  oParam.disableMaximize   - 팝업 최대화/최소화 비활성 여부
 *  oParam.actions       - dialog action button 정보
 *  oParam.IF_DATA       - HTML 내부로 전달할 데이터 정보
 *  oParam.fnCallback    - action 버튼 press 시 호출될 콜백 함수
 *  oParam.closeActionCode - 팝업 종료 시 호출될 action code
 * @return {Promise} dialog 내부에서 처리되는 Promise 객체
*/
export function dialogViewer(contents, oParam){

    //도움말 html 정보 존재시 HTML ui instance 구성.
    let _oContent = setHTMLUiInstance({contents});


    //u4a help document 버튼 ui instance 구성.
    let _oHelpBtn = setHelpDocButton({oParam});


    //팝업 최대화/최소화 버튼 ui instance 구성.
    let _oMaxBtn = setMaxizeButton({oParam});
    

    const oDialog = new sap.m.Dialog({
        busyIndicatorDelay: 0,
        busy :true,
        title : oParam?.title,
        contentWidth: oParam?.width,
        contentHeight: oParam?.height,
        draggable: oParam?.draggable,
        resizable: oParam?.resizable,
        verticalScrolling: false,
        escapeHandler : function(oPromise) {
            /**
             * @since   2026-07-07 02:00:12
             * @version vNAN-NAN
             * @author  pes
             * @description
             * 팝업 종료에 대한 action code를 전달받아 호출처에 전달하도록 처리.
             */
            if(!oParam.fnCallback){
                oDialog.close();
                return;
            }

            if(!oParam.closeActionCode){
                oDialog.close();
                return;
            }

            const _sParam = {

                ACTCD : oParam.closeActionCode,

                //dialog 내부 I/F 데이터 정보
                IF_DATA : oDialog.data("IF_DATA"),

                //dialog ui instance.
                dialog : oDialog,

            };

            //액션 코드에 해당하는 커스텀 데이터 정보를 얻어 호출처에 전달.
            oParam.fnCallback(_sParam);
        },
        // showHeader : false,
        customHeader : new sap.m.Toolbar({
            content: [
                new sap.m.Title({
                    text : oParam?.title,
                }),
                new sap.m.ToolbarSpacer(),

                //U4A HELP DOCUMENT 버튼.
                _oHelpBtn,

                new sap.m.ToolbarSeparator(),

                //팝업 최대화/최소화 버튼
                _oMaxBtn,
                
                new sap.m.Button({
                    type : "Reject",
                    icon : "sap-icon://decline",
                    press : function() {
                        /**
                         * @since   2026-07-07 02:00:12
                         * @version vNAN-NAN
                         * @author  pes
                         * @description
                         * 팝업 종료에 대한 action code를 전달받아 호출처에 전달하도록 처리.
                         */
                        // oDialog.close();

                        if(!oParam.fnCallback){
                            oDialog.close();
                            return;
                        }

                        if(!oParam.closeActionCode){
                            oDialog.close();
                            return;
                        }

                        const _sParam = {

                            ACTCD : oParam.closeActionCode,

                            //dialog 내부 I/F 데이터 정보
                            IF_DATA : oDialog.data("IF_DATA"),

                            //dialog ui instance.
                            dialog : oDialog,

                        };

                        //액션 코드에 해당하는 커스텀 데이터 정보를 얻어 호출처에 전달.
                        oParam.fnCallback(_sParam);
                    }
                })
            ]
        }),
        content : [ 
            new sap.m.Page({
                showHeader : false,
                enableScrolling : false,
                
                content:[
                    new sap.m.VBox({
                        height : "100%",
                        renderType: "Bare",
                        justifyContent: "SpaceBetween",
                        items :[
                            _oContent,
                            contents?.control
                        ]
                    })
                ]
            })
        ],

        afterOpen : function(){

            const _oDialogDom = this.getDomRef();

            //dialog DOM 정보가 없는경우 크리티컬 오류 처리.
            if(!_oDialogDom){
                let _msg = `"www/ws10_20/design/util/helpViewer.js"\n` +
                `파일에서 오류 발생.\n` +
                `dialogViewer 팝업의 afterOpen 이벤트에 dialog DOM 정보가 없음\n` +
                `관리자에게 문의 바랍니다.`;
                throw new Error(_msg);
            }

            /**
             * @since   2026-04-21 11:19:52
             * @version v3.6.0-4
             * @author  pes
             * @description
             * dialogViewer와 html 간의 I/F를 위한 커스텀 이벤트 등록.
             */
            //도움말 html -> 팝업의 I/F를 위한 이벤트 등록.
            _oDialogDom.addEventListener("childResponse", (oEvent)=>{

                if(!oParam.fnCallback){
                    return;
                }

                const _sParam = {

                    ACTCD : oEvent.detail.ACTCD,

                    //dialog 내부 I/F 데이터 정보
                    IF_DATA : oEvent.detail.IF_DATA,

                    //dialog ui instance.
                    dialog : oDialog,

                };

                //액션 코드에 해당하는 커스텀 데이터 정보를 얻어 호출처에 전달.
                oParam.fnCallback(_sParam);

            });


            //DIALOG DOM에 커스텀 이벤트 등록.
            oParam?.actions?.forEach?.( (oAction) => {
                _oDialogDom.addEventListener(oAction.ACTCD, (e) => {

                    //전달받은 파라메터를 DIALOG의 커스텀 데이터에 액션 코드와 같이 셋팅.

                    //HTML으로 부터 전달받은 I/F 데이터 갱신 처리.
                    oDialog.data("IF_DATA", e.detail.IF_DATA);
                    
                });
            });

            this.setBusy(false);
        },
        
        afterClose : function(){

            //테마 변경 이벤트 제거.
            sap.ui.getCore().detachThemeChanged(themeChanged);

            oDialog.destroy();
        }            
    }).addStyleClass("sapUiSizeCompact");



    //HTML 내부로부터 전달받은 I/F 데이터 정보 셋팅.
    oDialog.data("IF_DATA", JSON.parse(JSON.stringify(oParam?.IF_DATA || {})));


    // action 버튼 설정.
    oParam?.actions?.forEach?.( (oAction) => {
        oDialog.addButton(new sap.m.Button({
            text : oAction.text,
            type : oAction.type,
            icon : oAction.icon,
            enabled : oAction.enabled,
            visible : oAction.visible,
            press : function() {

                if(!oParam.fnCallback){
                    oDialog.close();
                    return; 
                }

                const _sParam = {

                    ACTCD : this.data("ACTCD"),

                    //DIALOG 내부 I/F 데이터 정보
                    IF_DATA : oDialog.data("IF_DATA"),

                    //dialog ui instance.
                    dialog : oDialog,

                };

                //액션 코드에 해당하는 커스텀 데이터 정보를 얻어 호출처에 전달.



                oParam.fnCallback(_sParam);
                
                // resolve(_sParam);
                // oDialog.close();
            }
        }).data("ACTCD", oAction.ACTCD));
    });


    //버튼 설정건이 존재하지 않는경우.
    if(!Array.isArray(oParam?.actions) || oParam.actions.length === 0){
        //기본 닫기 버튼 추가.
        oDialog.addButton(new sap.m.Button({
            type : "Reject",
            icon : "sap-icon://decline",
            press : function() {
                oDialog.close();
            }
        }));
    }

    
    oDialog.setInitialFocus(oDialog);


    //도움말 HTML 구성건이 존재하는경우.
    if(_oContent){
        _oContent.data("POPUP", oDialog);
    }


    //최대화 최소화 버튼이 존재하는경우.
    if(_oMaxBtn){
        _oMaxBtn.data("POPUP", oDialog);

        oDialog.data("MAX_BTN", _oMaxBtn);
    }


    //팝업 더블클릭 이벤트 설정.
    setPopupDblClickEvent({oPopup: oDialog, oParam});
    


    oDialog.open();


    //테마 변경 이벤트 처리 함수.
    function themeChanged(oEvent){

        let _theme = oEvent.getParameter("theme");

        let _oDom = oDialog.getDomRef();

        if(!_oDom){
            return;
        }

        let _oFrame = _oDom.querySelector('iframe');

        if(!_oFrame?.contentWindow?.toggleTheme){
            return;
        }

        //default light 모드
        let _themeMode = "light";

        _theme = _theme.toUpperCase();

        //테마가 dark 모드인경우.
        if(_theme.indexOf("DARK") !== -1){
            _themeMode = "dark";
        }

        //iframe 내부에 테마 변경 함수 호출.
        _oFrame.contentWindow.toggleTheme(_themeMode);

    }
    

}



/** ───────────────────────────────────────
 * ⚙️ setHTMLUiInstance
 * ----------------------------------------
 * 📌 설명: 도움말 html 정보 존재시 HTML ui instance 구성 처리.
 *
 * @param  {object} sParam   파라메터 정보
 * @return {object} html ui instance(html 정보가 존재하지 않는경우 undefined)
*/
function setHTMLUiInstance(sParam){

    let {contents} = sParam;

    //html src, html source 둘다 존재하지 않는경우 exit.
    if(!contents?.src && !contents?.htmlContent){
        return;
    }


    let _oContent = new sap.ui.core.HTML({
        preferDOM : false,
        content: "<div style='width:100%;height: 100%;'></div>"
    });

    let _oDelegate = {
        onAfterRendering: function(oEvent){
            
            let _oUi = oEvent.srcControl;

            _oUi.removeEventDelegate(_oDelegate);

            let _oDom = _oUi.getDomRef();

            if(!_oDom){
                return;
            }
            
            let _oFrame = document.createElement("iframe");

            _oFrame.style.width = "100%";
            _oFrame.style.height = "100%";
            _oFrame.style.border = "none";
            
            _oFrame.onload = function(){

                let oDialog = _oUi.data("POPUP");

                const _sParam = {
                    //HTML 내부로 전달할 파라메터 정보
                    IF_DATA : oDialog.data("IF_DATA"),

                    //현재 적용된 테마 정보
                    theme : getThemeMode(sap.ui.getCore().getConfiguration().getTheme()),

                    //부모 DIALOG ID 정보
                    parentId : oDialog.getId()
                };

                const customEvt = new CustomEvent('init', {detail:_sParam});

                //도움말 html iframe 내부에 init 커스텀 이벤트 전달.
                //(도움말 html 영역에 init 이벤트가 등록되지 않는 경우가 있어 강제로 이벤트 전달)
                _oFrame.contentWindow.dispatchEvent(customEvt);

            };


            if(contents?.htmlContent){
                _oFrame.setAttribute("srcdoc", contents.htmlContent);
                _oDom.appendChild(_oFrame);
                return;
            }

            if(contents.src){
                _oFrame.setAttribute("src", contents.src);
                _oDom.appendChild(_oFrame);
                return;
            }


        }
    };

    _oContent.addEventDelegate(_oDelegate);

    return _oContent;

}




/** ───────────────────────────────────────
 * ⚙️ setHelpDocButton
 * ----------------------------------------
 * 📌 설명: 도움말 html 정보 존재시 HTML ui instance 구성 처리.
 *
 * @param  {object} sParam   파라메터 정보
 * @return {object} html ui instance(html 정보가 존재하지 않는경우 undefined)
*/
function setHelpDocButton(sParam){

    let {oParam} = sParam;
    
    //u4a help document 버튼을 사용하지 않는경우 exit.
    if(oParam?.showHelpDocButton !== true){
        return;
    }

    //U4A HELP DOCUMENT 버튼은 패치 적용된 경우에만 노출.
    if(oAPP.common.checkWLOList("C", "UHAK901369") !== true){
        return;
    }
    
    return new sap.m.Button({
        icon : "sap-icon://u4a-fw-solid/Book Open Reader",
        type : "Emphasized",
        tooltip : "U4A Help Document",      //$$msg
        press : function(){
            //U4A HELP DOCUMENT 팝업 호출.
            oAPP.fn.fnU4AHelpDocuPopupOpener({startMenuId:oParam?.u4aHelpDocMenuID});
        }
    });

}




/** ───────────────────────────────────────
 * ⚙️ setMaxizeButton
 * ----------------------------------------
 * 📌 설명: 도움말 팝업 최대화/최소화 버튼 ui instance 구성.
 *
 * @param  {object} sParam   파라메터 정보
 * @return {object} html ui instance(html 정보가 존재하지 않는경우 undefined)
*/
function setMaxizeButton(sParam){

    let {oParam} = sParam;

    //최소화 최대화 기능 사용을 안하는경우.
    if(oParam?.disableMaximize === true){
        return;
    }

    return new sap.m.Button({
        icon : "sap-icon://full-screen",
        press : function() {

            let oDialog = this.data("POPUP");

            if(!oDialog){
                return;
            }

            let _maximize = this.data("maximize") || false;

            // let _icon = _maximize === true ? "sap-icon://exit-full-screen" : "sap-icon://full-screen";
            let _icon = _maximize === true ? "sap-icon://full-screen" : "sap-icon://exit-full-screen";

            let _oDom = oDialog.getDomRef();

            if(!_oDom){
                return;
            }

            
            switch (_maximize) {
                case true:
                    _oDom.style.width = oDialog.getContentWidth();
                    _oDom.style.height = oDialog.getContentHeight();
                    break;
            
                default:

                    _oDom.style.width = "100%";
                    _oDom.style.height = "100%";

                    break;
            }

            
            this.setIcon(_icon);
            
            this.data("maximize", !_maximize);

            if(!oDialog?._positionDialog){
                return;
            }

            oDialog._positionDialog();
            

        }
    });

}



/** ───────────────────────────────────────
 * ⚙️ setPopupDblClickEvent
 * ----------------------------------------
 * 📌 설명: 팝업 더블클릭 이벤트 설정.
 *
 * @param  {sParam}
 * sParam.oPopup - 팝업 ui instance.
 * sParam.oParam - 팝업 호출시 전달 파라메터 정보.
 * @return {string} 테마 모드 (light / dark)
*/
function setPopupDblClickEvent(sParam){

    let {oPopup, oParam} = sParam;

    //최대화/최소화 기능을 사용하지 않는경우 exit.
    if(oParam.disableMaximize === true){
        return;
    }

    //팝업 더블클릭 이벤트.
    oPopup.addEventDelegate({"ondblclick": function(oEvent){

        let _oUi = oEvent.srcControl;

        if(!_oUi){
            return;
        }

        let _oMaxBtn = oPopup.data("MAX_BTN");

        if(!_oMaxBtn){
            return;
        }

        if(_oUi?.oParent === oPopup){
            _oMaxBtn.firePress();//이벤트 전파 방지.
            event.preventDefault();
            event.stopPropagation();
            return;
        }
        
    }});


}




/** ───────────────────────────────────────
 * ⚙️ getThemeMode
 * ----------------------------------------
 * 📌 설명: 입력한 테마에 따른 테마 모드 구성.
 *
 * @param  {string} theme   테마 명
 * @return {string} 테마 모드 (light / dark)
*/
function getThemeMode(theme){

    //default light 모드
    let _themeMode = "light";

    let _theme = theme.toUpperCase();

    //테마가 dark 모드인경우.
    if(_theme.indexOf("DARK") !== -1){
        _themeMode = "dark";
    }

    return _themeMode;

}




/** ───────────────────────────────────────
 * ⚙️ getPathType
 * ----------------------------------------
 * 📌 설명: 입력한 경로가 url 경로인지 로컬 path 경로인지 판단.
 *
 * @param  {string} path  url/로컬path 정보
 * @return {boolean} true : URL 경로, false : 로컬 파일(폴더) 경로
*/
function isURLPath(path) {

    try {
        
        const url = new URL(path);
        
        return url.protocol === 'http:' || url.protocol === 'https:';
    
    } catch {
        return false;

    }

}




function isValideFilePath(path){

    //파일 경로 여부 점검.
    if(isURLPath(path)){
        
    }

    let _path = path.replace(/^file:\/+/, "").split("?")[0];

    //파일 존재 여부 점검.
    parent.FS.existsSync(_path);


}