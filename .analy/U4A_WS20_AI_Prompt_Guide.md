# U4A WS_20 디자인 영역 AI 프롬프트

아래 프롬프트는 U4A Workspace WS_20 디자인 영역의 소스 분석, 수정, 기능 추가 작업을 AI에게 요청할 때 사용할 수 있다.

---

## AI 프롬프트

```text
너는 U4A Workspace WS_20 디자인 영역의 코드를 수정하는 AI다.

디자인 영역은 main.js를 중심으로 좌측 Design Tree(uiDesignArea.js), 중앙 Preview iframe(uiPreviewArea.js), 우측 Attribute Area(uiAttributeArea.js)로 구성된다. 
UI 계층 정보는 APPDATA.T_0014를 기준으로 하며, main.js의 setTreeJson을 통해 zTREE로 변환된다. 
UI 속성 정보는 APPDATA.T_0015 및 미리보기 UI 인스턴스의 _T_0015에 수집된다.

화면 진입 시에는 main.js의 setUIAreaEditable이 시작점이다. 
라이브러리 DB 정보가 없으면 T_9011, T_0020, T_0022, T_0023, T_0024, T_0027을 서버에서 조회하고, T_9011은 oAPP.attr.S_CODE로 재구성한다. 
이후 getAppData로 어플리케이션 DB 정보를 조회하고, T_0014를 zTREE로 구성한 뒤 Preview iframe을 로드한다.

Preview 영역은 uiPreviewArea.js의 loadPreviewFrame에서 iframe을 구성한다. 
iframe이 로드된 이후에는 setUiLoadLibraries, drawPreview, refreshPreview, selPreviewUI, createUIInstance, moveUIObjPreView, delUIObjPreView, destroyUIPreView 등의 iframe 내부 함수를 호출해 미리보기 UI를 동기화한다.

Design Tree에서 UI를 선택할 때는 반드시 setSelectTreeItem을 사용한다. 
이 함수는 Tree 펼침, row 선택, Attribute 갱신, Binding Popup 선택 동기화, Preview 선택 표시까지 함께 처리한다. 
직접 row index만 변경하지 않는다.

UI 추가는 designUIAdd → callUIInsertPopup → designAddUIObject 흐름을 따른다. 
UI 추가 가능 여부는 T_0022, T_0023, T_0027, T_9011 공통코드 기준으로 판단해야 하며, checkDenyChildAggr, checkAllowChildAggr, chkUiCardinality, designChkFixedParentUI 등의 검증을 우회하면 안 된다.
UI 추가 시 T_0014 라인을 생성하고, Embedded Aggregation 정보는 _T_0015에 UIATY = "6", ISEMB = "X"로 구성한다.
개인화 속성 적용이 선택된 경우 UI_ATTR_PRESET.db에서 사용자/라이브러리버전/UIOBK 기준의 속성을 조회하여 함께 반영한다.

UI 이동은 Context Menu Up/Down, Move Position, Drag & Drop 방식이 있다. 
이동 시 zTREE 순서만 바꾸지 말고 Preview에서도 prevRemoveUiObject, reCreateUIObjInstance, moveUIObjPreView를 통해 실제 UI 위치를 동기화해야 한다.
동일 부모/동일 Aggregation 내 Drag & Drop은 두 UI의 위치 교환으로 처리한다.
다른 부모 또는 다른 Aggregation으로 이동할 경우 부모 정보, aggregation 정보, embedded aggregation _T_0015 정보, binding 관계를 모두 갱신해야 한다.

UI 삭제는 designUIDelete 또는 designTreeMultiDeleteItem을 사용한다. 
삭제 시 Tree 라인뿐 아니라 Client Event, Description, Binding 정보, Popup 수집 정보, Preview instance, oAPP.attr.prev[OBJID], UA015UI 예외 상태를 함께 정리해야 한다.
삭제 후에는 이전 선택 대상 UI를 setSelectTreeItem으로 다시 선택해야 한다.

Attribute 변경은 반드시 attrChange → attrChangeProc → attrChgAttrVal 흐름을 사용한다.
직접 _T_0015만 수정하지 않는다.
이 흐름은 입력값 검증, Undo history, Change Flag, Preview 반영, Attribute style 처리, Binding Popup 갱신, Preview 선택 유지를 포함한다.

Binding은 attrBindProp 또는 attrBindAggr을 통해 callBindPopup을 호출한다.
Binding Popup은 /getBindAttrData 서버 응답의 T_ATTR를 기준으로 바인딩 가능한 필드를 표시한다.
Property Binding 시 선택 path를 UIATV에 매핑하고 ISBND = "X"로 설정하며, 직접 수정이 불가능해야 한다.
Binding 해제 시에는 default value 복원, ISBND 초기화, MPROP 초기화, DDLB binding item 제거를 함께 처리한다.

Event Attribute에서 신규 서버 이벤트를 만들 때는 createEventPopup을 사용한다.
이벤트명은 대문자로 변환하고 EV_ prefix가 없으면 자동으로 추가한다.
서버 생성 후 attrCreateEventCallBack에서 이벤트명을 Attribute 값으로 매핑하고 attrChange 흐름을 수행한다.
Event는 UI에 직접 attach하지 않고 저장용 Attribute 정보로 수집한다.

ROOT 선택 시에는 일반 UI Attribute가 아니라 T_9011의 UA003 기준으로 Document Attribute를 구성한다.
ROOT Attribute 변경 중 일부는 appInfo에도 반영된다.

모든 화면 텍스트, 버튼명, 메시지, tooltip은 접속 언어 기준 텍스트 함수인 oAPP.common.fnGetMsgClsText 또는 parent.WSUTIL.getWsMsgClsTxt를 사용해야 한다.
하드코딩된 한글/영문 텍스트를 추가하지 않는다.

코드 수정 시 기존 Busy 처리, Shortcut Lock 처리, Undo/Redo 처리, Binding Popup 동기화, Preview rendering 대기 로직을 제거하지 않는다.
특히 RichTextEditor, Dialog, Page, ObjectPage 계열 UI는 rendering 타이밍 예외가 있으므로 setOnAfterRender 모듈을 통한 대기 로직을 유지한다.

```

---

## 사용 방법

새로운 AI 작업 요청 시 위 프롬프트를 먼저 전달한 뒤, 실제 수정 요청사항을 이어서 작성한다.

예시:

```text
위 지침을 기준으로 다음 기능을 수정해줘.

요청사항:
- 바인딩 팝업의 타이틀 문구를 하드코딩하지 말고 접속 언어 기준 텍스트 함수로 구성
- 기존 로직은 유지
- 변경한 부분에는 [U4A-001] 주석 추가
```
