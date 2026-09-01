#WS_20에서 사용하는 기능 function 항목
1.  oAPP.fn.expandTreeItem - design tree의 선택한 라인을 펼치는 기능
    사용 예시

        선택된 라인을 펼침처리.        
        oAPP.fn.expandTreeItem();



2.  oAPP.fn.getTreeData - OBJECT ID에 해당하는 라인 정보를 얻는 기능
    사용 예시

        BUTTON1에 해당하는 TREE 라인 데이터 얻기.
        var _sTree = oAPP.fn.getTreeData("BUTTON1");



3.  oAPP.fn.setSelectTreeItem - design tree의 특정 UI를 선택 처리.
    사용 예시

        BUTTON1을 선택 처리.
        oAPP.fn.setSelectTreeItem("BUTTON1"); 

        BUTTON1을 선택 하면서 ATTRIBUTE 영역의 text Property를 선택.
        oAPP.fn.setSelectTreeItem("BUTTON1", "AT000002730");



4. oAPP.fn.designGetSelectedTreeItem - 선택한 라인의 design tree 라인 정보 얻기.
    사용 예시

        var _sTree = oAPP.fn.designGetSelectedTreeItem();


5. oAPP.fn.getParentAggrBind 현재 ui로부터 부모를 탐색하며 부모에 N건 바인딩 처리가 됐는지 확인.
    사용 예시


    oAPP.fn.getParentAggrBind(oAPP.attr.prev.BUTTON1);



6. UI 추가 처리 FUNCTION
oAPP.fn.designAddUIObject 


7. UNDO, REDO 처리 관련.
parent.require(oAPP.oDesign.pathInfo.undoRedo) 


8. UI가 그려지는것을 기다림.
parent.require(oAPP.oDesign.pathInfo.setOnAfterRender) 



9. drop callback FUNCTION
oAPP.fn.drop_cb UI 


10. UI 삭제 처리 FUNCTION.
oAPP.fn.designUIDelete


11. UI 멀티 삭제 처리 FUNCTION.
oAPP.fn.designTreeMultiDeleteItem


12. 입력 OBJECT ID에 해당하는 위치로 TREE 라인 이동
oAPP.fn.designSetScrollPosOBJID



13. 바인딩 팝업(툴바 버튼 영역) 호출 펑션
www\ws10_20\js\fnDialogPopupOpener.js
oAPP.fn.fnBindWindowPopupOpener



14. WS_20에서 저장 처리시 저장 데이터 구성하는 펑션
www\ws10_20\design\js\main.js
oAPP.fn.getSaveData


15. 프로퍼티 바인딩 CALLBACK 펑션
www\ws30\ws10_20\design\js\uiAttributeArea.js
oAPP.fn.attrBindCallBackProp


16. AGGREGATION 바인딩 CALLBACK 펑션
www\ws30\ws10_20\design\js\uiAttributeArea.js
oAPP.fn.attrBindCallBackAggr


17. 프로퍼티 바인딩 팝업 호출 펑션
www\ws30\ws10_20\design\js\uiAttributeArea.js
oAPP.fn.attrBindProp


18. AGGREGATION 바인딩 팝업 호출 
www\ws30\ws10_20\design\js\uiAttributeArea.js
oAPP.fn.attrBindAggr


19. ATTRIBUTE F4 HELP 이벤트
www\ws30\ws10_20\design\js\uiAttributeArea.js
oAPP.fn.attrCallValueHelp


20. 바인딩, 서버이벤트 아이콘 클릭
www\ws30\ws10_20\design\js\uiAttributeArea.js
oAPP.fn.attrIcon1Proc


21. 클라이언트 이벤트 아이콘 클릭
www\ws30\ws10_20\design\js\uiAttributeArea.js
oAPP.fn.attrIcon2Proc