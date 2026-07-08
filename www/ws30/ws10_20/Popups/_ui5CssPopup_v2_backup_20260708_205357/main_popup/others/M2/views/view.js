export async function getView(){

    /************************************************************************
     * 💖 컨트롤러 호출
     ************************************************************************/
    
        let sControlPath = "./control.js";
    
        const oRes   = await import(sControlPath);
        const oContr = await oRes.getControl();
       
    
    /************************************************************************
     * 💖 화면 그리기
     ************************************************************************/
    
        let APP = new sap.m.App({
            busy: true,
            busyIndicatorDelay: 0,
            autoFocus: false,
        }).addStyleClass("sapUiSizeCompact");

        let PAGE1 = new sap.m.Page({
            content: {
                path: "/T_CSS_LIST",
                template: new sap.m.Panel({
                      backgroundDesign: sap.m.BackgroundDesign.Transparent,
                      headerText : "{text} (※ Both applied to sapUiLargeMargin)",
                      content: [
                          new sap.f.Card({
                              width: "auto",
                              header: new sap.f.cards.Header({
                                  title : "sapUiLargeMargin",
                              }), /* end of f.card header */
  
                              content: new sap.m.HBox({
                                  renderType: sap.m.FlexRendertype.Bare,
                                  items: [
                                      new sap.m.Button({
                                          text: "sapUiLargeMargin",
                                      }).addStyleClass("sapUiLargeMargin")
                                  ]
  
                              })
  
                          }).addStyleClass("sapUiLargeMarginEnd"),
  
                          new sap.f.Card({
                              width: "auto",
                              header: new sap.f.cards.Header({
                                  title: "{text}",
                              }),
  
                              content: new sap.m.HBox({
                                  renderType: sap.m.FlexRendertype.Bare,
                                  items: [
                                      new sap.m.Button({
                                          text: "{text}",
                                      }).bindProperty("text", {
                                          parts: [
                                              "text"
                                          ],
                                          formatter: function(text){
  
                                              this.addStyleClass(text);
                                              this.addStyleClass("sapUiLargeMargin");
  
                                              return text;
  
                                          }
  
                                      })
  
                                  ]
  
                              })
  
                          })
  
                      ] /* end of panel content */
  
                }).addStyleClass("sapUiSmallMarginBottom")
  
            } /* end of Page content */
  
        });
        APP.addPage(PAGE1);

        PAGE1.addStyleClass("sapUiContentPadding M6");

        let TOOLBAR1 = new sap.m.Toolbar();
        PAGE1.setCustomHeader(TOOLBAR1);

        let TITLE1 = new sap.m.Title({
            text: `{/TITLE} ( ${oContr.msg.M385} !! )` // Please resize the browser window
        });
        TOOLBAR1.addContent(TITLE1);


        PAGE1.setModel(oContr.oModel);        

        oContr.ui.ROOT = APP;   


    return oContr;
    
}