# U4A WS_20 디자인 영역 흐름 지침서

## 1. 목적

이 문서는 U4A Workspace `WS_20` 디자인 영역의 동작 흐름을 AI가 이해하고, 향후 코드 분석·수정·기능 추가 시 기존 구조를 훼손하지 않도록 하기 위한 지침이다.

디자인 영역은 크게 다음 3개 영역으로 구성된다.

| 영역 | 역할 | 대표 JS |
|---|---|---|
| 좌측 Design Tree | UI 계층 구조 표시, UI 추가/삭제/이동/복사/붙여넣기 | `uiDesignArea.js` |
| 중앙 Preview Area | iframe 기반 미리보기 화면 구성 | `uiPreviewArea.js` |
| 우측 Attribute Area | 선택 UI의 Property / Event / Aggregation / Binding 제어 | `uiAttributeArea.js` |

전체 디자인 영역의 대표 진입 JS는 다음 파일이다.

```text
www\ws30\ws10_20\design\js\main.js
```

---

## 2. 주요 파일 역할

### 2.1 `main.js`

WS_20 디자인 영역의 대표 JS이다.

주요 역할은 다음과 같다.

- 디자인 영역 전역 객체 초기화
- `oAPP.attr.prev`, `oAPP.attr.ui`, `oAPP.DATA.LIB`, `oAPP.DATA.APPDATA` 등 주요 데이터 보관 구조 초기화
- UI5 라이브러리 DB 정보 로드
- 어플리케이션 DB 정보 로드
- Design Tree 데이터 구성
- Preview iframe 로드
- 저장 데이터 구성
- 코드마스터 `T_9011`을 `oAPP.attr.S_CODE` 형태로 재구성

주요 함수는 다음과 같다.

```javascript
oAPP.fn.setUIAreaEditable
oAPP.fn.getLibData
oAPP.fn.getAppData
oAPP.fn.setTreeJson
oAPP.fn.getSaveData
oAPP.fn.getAttrChangedData
oAPP.fn.setCodeMasterData
```

---

### 2.2 `uiDesignArea.js`

좌측 Design Tree 영역을 구성하고, UI 계층 조작과 관련된 대부분의 기능을 담당한다.

주요 역할은 다음과 같다.

- `sap.ui.table.TreeTable` 기반 Design Tree 구성
- Tree 라인 선택 처리
- UI 추가
- UI 삭제
- UI 멀티 삭제
- UI 이동
- Drag & Drop
- UI 복사 / 붙여넣기
- 바인딩 팝업과 선택 UI 동기화
- Preview UI와 Design Tree 선택 상태 동기화

주요 함수는 다음과 같다.

```javascript
oAPP.fn.uiDesignArea
oAPP.fn.setSelectTreeItem
oAPP.fn.designTreeItemPress
oAPP.fn.designUIAdd
oAPP.fn.designAddUIObject
oAPP.fn.designUIDelete
oAPP.fn.designTreeMultiDeleteItem
oAPP.fn.drop_cb
oAPP.fn.designCopyUI
oAPP.fn.reCreateUIObjInstance
```

---

### 2.3 `uiPreviewArea.js`

중앙 미리보기 영역을 구성한다.

주요 역할은 다음과 같다.

- Preview iframe 생성
- Preview toolbar 구성
- Zoom / Reset / Full Screen / Help 처리
- Preview iframe 로드
- UI5 bootstrap 경로 결정
- 어플리케이션에서 사용하는 UI5 library 목록 구성
- Preview iframe 내부 함수 호출

주요 함수는 다음과 같다.

```javascript
oAPP.fn.uiPreviewArea
oAPP.fn.loadPreviewFrame
oAPP.fn.getUi5Libraries
oAPP.fn.getBootStrapUrl
oAPP.oDesign.fn.prevRemoveUiObject
```

---

### 2.4 `uiAttributeArea.js`

우측 Attribute 영역을 구성하고, 선택 UI의 속성 변경과 바인딩, 이벤트 연결을 처리한다.

주요 역할은 다음과 같다.

- 선택 UI의 속성 목록 구성
- ROOT Document 속성 구성
- Property / Event / Aggregation 변경 처리
- Binding / Unbinding 처리
- 서버 이벤트 생성 팝업 호출
- Attribute 변경 시 미리보기 UI 반영
- 변경값을 `UI._T_0015`에 수집

주요 함수는 다음과 같다.

```javascript
oAPP.fn.uiAttributeArea
oAPP.fn.updateAttrList
oAPP.fn.updateDOCAttrList
oAPP.fn.attrChange
oAPP.fn.attrChangeProc
oAPP.fn.attrChgAttrVal
oAPP.fn.attrBindProp
oAPP.fn.attrBindAggr
oAPP.fn.attrBindCallBackProp
oAPP.fn.attrBindCallBackAggr
oAPP.fn.attrCreateEventCallBack
```

---

### 2.5 `insertUIPopop.js`

UI 추가 팝업을 구성한다.

주요 역할은 다음과 같다.

- 선택한 부모 UI 기준으로 추가 가능한 Aggregation 목록 구성
- Aggregation 타입 기준으로 추가 가능한 UI 목록 구성
- 생성 개수 입력 처리
- 개인화 속성 적용 여부 처리
- 선택 UI를 `designAddUIObject`로 전달
- UI 목록 Drag & Drop 지원

주요 함수는 다음과 같다.

```javascript
oAPP.fn.callUIInsertPopup
```

> 파일명은 현재 소스 기준 `insertUIPopop.js`로 정리한다. 향후 파일명을 변경할 경우 기존 require/import 경로와 호출부를 함께 확인해야 한다.

---

### 2.6 `callBindPopup.js`

바인딩 / 바인딩 해제 팝업을 구성한다.

주요 역할은 다음과 같다.

- 서버에서 Controller Class 기준 바인딩 가능 필드 목록 조회
- 바인딩 가능 타입 검증
- Property / Aggregation 별 바인딩 가능 대상 제한
- 선택한 바인딩 path를 callback으로 전달

서버 호출은 다음 흐름을 사용한다.

```text
/getBindAttrData
```

---

### 2.7 `createEventPopup.js`

서버 이벤트 생성 팝업을 구성한다.

주요 역할은 다음과 같다.

- 서버 이벤트명 입력
- 설명 입력
- 이벤트명 `EV_` prefix 자동 보정
- 특수문자 및 필수값 검증
- 서버에 이벤트 메소드 생성 요청
- 생성 완료 후 Attribute 변경 흐름으로 연결

서버 호출은 다음 흐름을 사용한다.

```text
/createEventMethod
```

---

### 2.8 `exception/exceptionUI.js`

UI 추가 가능 여부와 관련된 공통 예외 로직을 담당한다.

주요 함수는 다음과 같다.

```javascript
exports.checkDenyChildAggr
exports.checkAllowChildAggr
```

중요한 공통코드 기준은 다음과 같다.

| 공통코드 | 의미 |
|---|---|
| `UW08` | 특정 부모 Aggregation에 추가 불가능한 Child UI 정의 |
| `UW10` | 특정 부모 Aggregation에 추가 가능한 Child UI 정의 |
| `UW10-FLD07 = X` | 지정 UI로부터 파생된 UI까지 허용 판단 |
| `UW03` | 특정 UI가 특정 부모/aggregation에만 추가 가능하도록 제한 |

---

## 3. 주요 데이터 구조

### 3.1 `oAPP.DATA.LIB`

UI5 라이브러리 DB 정보이다.

대표 테이블은 다음과 같다.

| 테이블 | 역할 |
|---|---|
| `T_9011` | 공통코드 |
| `T_0020` | 라이브러리 정보 |
| `T_0022` | UI Object / Class 정보 |
| `T_0023` | UI Attribute 정보(Property, Event, Aggregation, Association 등) |
| `T_0024` | Value Help / Enum / Boolean 등 값 목록 |
| `T_0027` | 상속, interface, 구현 관계 정보 |

`T_9011`은 `main.js`의 `setCodeMasterData`에서 코드별로 재구성되어 다음 형태로 사용된다.

```javascript
oAPP.attr.S_CODE[CATCD]
```

예시:

```javascript
oAPP.attr.S_CODE.UW08
oAPP.attr.S_CODE.UW10
oAPP.attr.S_CODE.UA025
oAPP.attr.S_CODE.UA050
```

---

### 3.2 `oAPP.DATA.APPDATA`

어플리케이션 DB 정보이다.

대표 항목은 다음과 같다.

| 항목 | 역할 |
|---|---|
| `T_0014` | UI 계층 정보 |
| `T_0015` | UI Attribute 변경/설정 정보 |
| `T_CEVT` | Client Event 및 HTML 관련 소스 정보 |
| `T_DESC` | UI Description 정보 |
| `S_0010` | Application 기본 정보 |
| `S_WSO` | Workspace Option 정보 |
| `T_EDIT` | 편집 관련 정보 |
| `T_JSLK`, `T_CSLK` | JS/CSS Link 정보 |
| `T_SKLE` | Skeleton 관련 정보 |

---

### 3.3 `T_0014`

Design Tree의 기준 데이터이다.

주요 필드는 다음과 같다.

| 필드 | 의미 |
|---|---|
| `OBJID` | UI Object ID |
| `POBID` | 부모 Object ID |
| `UIOBK` | UI Object Key |
| `PUIOK` | 부모 UI Object Key |
| `UIATK` | 부모 Aggregation Attribute Key |
| `UIATT` | 부모 Aggregation 이름 |
| `PUIATK` | 부모 Aggregation Key |
| `UILIB` | UI Library Class |
| `TGLIB` | Target Library |
| `ISMLB` | N건 Aggregation 여부 |
| `POSIT` | 저장 시 순번 |

`main.js`에서는 `setTreeJson`을 통해 `T_0014`를 계층형 `zTREE`로 변환한다.

```javascript
oAPP.fn.setTreeJson(oAPP.attr.oModel, "TREE", "OBJID", "POBID", "zTREE");
```

---

### 3.4 `T_0015`

UI의 Attribute 설정 수집 정보이다.

코드상 실제 필드명은 `_T_0015`이다.  
사용자가 설명한 `UI._T0015`는 실제 코드 기준으로는 `UI._T_0015`로 이해해야 한다.

미리보기 UI 인스턴스는 다음처럼 관리된다.

```javascript
oAPP.attr.prev[OBJID]
oAPP.attr.prev[OBJID]._T_0015
```

`_T_0015`에는 Property, Event, Aggregation, Embedded Aggregation 정보가 수집된다.

중요한 구분값은 다음과 같다.

| `UIATY` | 의미 |
|---|---|
| `1` | Property |
| `2` | Event |
| `3` | Aggregation |
| `4` | Association |
| `6` | Embedded Aggregation 정보 |

UI 추가 시에는 생성 UI에 대해 `UIATY = "6"`, `ISEMB = "X"`인 embedded aggregation 라인이 구성된다.

---

## 4. 조회 / 편집 화면 진입 흐름

어플리케이션 조회 또는 편집 화면 진입 시 핵심 시작점은 다음 함수이다.

```javascript
oAPP.fn.setUIAreaEditable
```

### 4.1 기존 데이터가 있고 Display 전환만 필요한 경우

다음 조건을 만족하면 서버 재조회 없이 기존 화면을 Display 상태로 전환한다.

```javascript
IS_EDIT === ""
IS_CHAG === ""
APPDATA 존재
isRefresh !== "X"
```

이 경우 수행 내용은 다음과 같다.

1. `IS_EDIT = false` 설정
2. Undo / Redo history 초기화
3. Tree Drag & Drop 활성 여부 재계산
4. Tree Checkbox 활성 여부 재계산
5. Action Icon 활성 여부 재계산
6. Preview Drop 설정 제거
7. CSS 미리보기 적용 제거
8. Attribute 초기화 버튼 비활성화
9. Attribute 라인 편집 비활성화
10. 모델 refresh 후 Busy 해제

---

### 4.2 라이브러리 DB 정보가 이미 존재하는 경우

`oAPP.DATA.LIB`가 비어 있지 않으면 다음 순서로 처리한다.

1. Undo / Redo 초기화
2. Design Layout 순서 설정
3. 어플리케이션 DB 정보 조회

```javascript
oAPP.fn.getAppData();
```

---

### 4.3 라이브러리 DB 정보가 없는 경우

라이브러리 정보가 없으면 화면을 잠그고 다음 DB 정보를 서버에서 조회한다.

```text
T_9011
T_0020
T_0022
T_0023
T_0024
T_0027
```

조회 완료 후 다음 처리를 수행한다.

1. `T_0022.UIOMD` 값을 기준으로 `LIBNM` 구성  
   예: `sap/m/Input` → `sap.m.Input`
2. `T_9011` 공통코드 재구성
3. `UA035` 추가 정의
4. 어플리케이션 DB 정보 조회

---

## 5. 어플리케이션 DB 정보 조회 흐름

어플리케이션 DB 정보는 다음 함수에서 조회한다.

```javascript
oAPP.fn.getAppData
```

서버 요청 시 `APPID`를 전달한다.

```text
/getAppData
```

조회 후 주요 처리 흐름은 다음과 같다.

1. `StyleCSS`, `HTMLCode`, `ScriptCode` UI 제거  
   대상 `UIOBK`:

```text
UO99997
UO99998
UO99999
```

2. `sap.ui.core.HTML` UI의 `content` property 정리  
   HTML editor에 실제 소스가 없으면 content property 수집값 제거

3. 단축키 정보 `SHCUT`이 JSON string이면 object로 변환
4. `oAPP.DATA.APPDATA`에 서버 응답 매핑
5. `T_0014`를 Design Tree 모델에 매핑
6. 편집 가능 여부 `IS_EDIT` 설정
7. Attribute 변경 필터 초기화
8. `T_0014` → `zTREE` 변환
9. Design Tree 관련 상태 구성
   - Drag & Drop 가능 여부
   - Checkbox 가능 여부
   - UI Icon
   - Action Icon
   - Row Action
10. Design Tree 전체 접기 후 2레벨까지 펼침
11. Tree 선택 해제
12. Attribute 선택 해제
13. Design 영역 invalidate
14. Preview iframe 로드

```javascript
oAPP.fn.loadPreviewFrame();
```

---

## 6. Preview iframe 구성 흐름

Preview 영역은 `uiPreviewArea.js`에서 구성한다.

### 6.1 Preview Area UI 구성

`oAPP.fn.uiPreviewArea`에서 다음 UI를 구성한다.

- iframe 영역
- Toolbar
- Preview title
- Shortcut lock indicator
- Zoom reset button
- Zoom slider
- Full screen switch
- Help button

---

### 6.2 Preview iframe 로드

Preview iframe 로드는 다음 함수가 담당한다.

```javascript
oAPP.fn.loadPreviewFrame
```

현재 코드 기준으로 iframe은 로컬 preview HTML을 바라본다.

```javascript
const sUrl = parent.PATH.join(
  oAPP.oDesign.pathInfo.designRootPath,
  "preview",
  "index.html"
);
```

iframe이 이미 로드되어 있고 `_loaded === true`인 경우에는 다음 흐름을 수행한다.

1. 현재 어플리케이션에서 필요한 UI5 Library 목록 전달

```javascript
oFrame.contentWindow.setUiLoadLibraries(oAPP.fn.getUi5Libraries());
```

2. Preview UI 재구성

```javascript
oFrame.contentWindow.drawPreview()
```

3. Design Tree 첫 번째 라인 선택 이벤트 발생

```javascript
oAPP.attr.ui.oLTree1.fireCellClick(...)
```

---

### 6.3 UI5 Bootstrap 경로 결정

UI5 bootstrap 경로는 다음 함수에서 결정한다.

```javascript
oAPP.fn.getBootStrapUrl
```

우선순위는 다음과 같다.

1. Application 전용 설정: `UA025-FLD01 = WOK_<APPID>`
2. Package 전용 설정: `UA025-FLD01 = WOK_<PACKG>`
3. 전체 기본 설정: `UA025-FLD01 = WOK`

---

### 6.4 로드 대상 UI5 Library 구성

다음 함수에서 `T_0014` 기준으로 필요한 library 목록을 수집한다.

```javascript
oAPP.fn.getUi5Libraries
```

수집 시 다음 library는 제외한다.

```text
u4a
sapui6
```

---

## 7. Preview UI 생성 흐름

Preview iframe 내부 구현은 zip에 포함되어 있지 않지만, 호출부 기준으로 다음 흐름을 전제로 한다.

1. iframe에서 UI5 bootstrap 구성
2. UI5 사용 준비 완료
3. `drawPreview` 호출
4. Design Tree의 `zTREE` 기준으로 UI 생성
5. 각 UI 생성 시 해당 UI의 Attribute 수집 정보 구성
6. 생성된 UI 인스턴스는 다음 위치에 수집

```javascript
oAPP.attr.prev[OBJID]
```

7. 각 UI 인스턴스에는 Attribute 정보가 다음처럼 구성된다.

```javascript
oAPP.attr.prev[OBJID]._T_0015
```

8. UI 생성 중 예외처리는 공통코드 기준으로 수행한다.

대표 예외 공통코드는 다음과 같다.

| 공통코드 | 용도 |
|---|---|
| `UA018` | Preview UI 추가/생성 관련 예외 |
| `UA026` | 부모 UI에 실제로 추가하지 않아야 하는 UI 예외 |
| `UA030` | UI 생성/이동 예외 |
| `UA032` | Attribute 적용 예외 |
| `UA050` | 필수 Child UI 강제 추가 예외 |
| `UA015` | Preview 화면 전환/표시 예외 UI |

---

## 8. Design Tree 선택 흐름

Design Tree 라인 선택은 `uiDesignArea.js`의 TreeTable `cellClick`에서 시작된다.

```javascript
oAPP.fn.setSelectTreeItem(OBJID)
```

### 8.1 `setSelectTreeItem` 처리 흐름

1. Busy ON
2. Shortcut lock
3. 선택 대상 `OBJID`의 Tree path 검색
4. Tree filter가 있으면 해제
5. 대상 path 기준으로 Tree 펼침
6. 대상 row 선택
7. Attribute 영역 갱신

```javascript
oAPP.fn.designTreeItemPress(_sTree)
```

8. Tree scroll 위치 보정
9. Binding Popup에 선택 OBJID 전달

```javascript
oAPP.fn.selectBindingPopupOBJID(_sTree)
```

10. Attribute focus 처리

```javascript
oAPP.fn.setAttrFocus(UIATK, TYPE)
```

11. Preview UI 선택 표시

```javascript
oAPP.attr.ui.frame.contentWindow.selPreviewUI(_sTree.OBJID)
```

---

### 8.2 `designTreeItemPress` 처리 흐름

선택된 Tree 라인 기준으로 다음 작업을 수행한다.

1. Attribute header 펼침
2. 이전 Preview 선택 표시 제거

```javascript
oAPP.attr.ui.frame.contentWindow.oWS.sMark.fn_removeMark()
```

3. Drop 잔상 제거

```javascript
oAPP.fn.ClearDropEffect()
```

4. UI Info 영역 갱신

```javascript
oAPP.fn.setUIInfo(is_tree)
```

5. Attribute 목록 갱신

```javascript
oAPP.fn.updateAttrList(is_tree.UIOBK, is_tree.OBJID)
```

6. 필요 시 Preview UI 재생성

```javascript
redrawUIScript(...)
```

7. Preview 화면 갱신

```javascript
oAPP.attr.ui.frame.contentWindow.refreshPreview(is_tree)
```

8. 구버전 패치 기준에서는 popup 강제 close 처리

---

## 9. ROOT 선택 시 Attribute 구성

선택한 라인이 `ROOT`인 경우 일반 UI Attribute가 아니라 Document Attribute를 구성한다.

ROOT Attribute 구성 기준은 공통코드 `UA003`이다.

```javascript
oAPP.DATA.LIB.T_9011.filter(a => a.CATCD === "UA003")
```

처리 함수는 다음과 같다.

```javascript
oAPP.fn.updateDOCAttrList
```

ROOT Attribute는 다음 성격을 가진다.

- Application / Document 레벨 속성
- UI5 Theme
- CSS Link
- JS Link
- Web Security Settings
- Wait Type
- Router 사용 여부
- Skeleton 사용 여부
- Mobile Zoom 사용 여부
- Request / Task
- Stateful Type
- Dump Write 설정 등

ROOT Attribute 변경 시 일부 값은 `oAPP.attr.appInfo`에도 반영된다.

| Attribute | 반영 대상 |
|---|---|
| Web Application Version | `APPVR` |
| Request / Task | `REQNO`, `REQNR` |
| Change User | `AEUSR` |
| Change Date | `AEDAT` |
| Change Time | `AETIM` |

---

## 10. UI 추가 흐름

UI 추가는 다음 함수에서 시작한다.

```javascript
oAPP.fn.designUIAdd(is_tree)
```

내부적으로 UI 추가 팝업을 호출한다.

```javascript
oAPP.fn.callUIInsertPopup(is_tree.UIOBK, callback)
```

### 10.1 UI 추가 팝업 흐름

파일:

```text
www\ws30\ws10_20\design\js\insertUIPopop.js
```

함수:

```javascript
oAPP.fn.callUIInsertPopup
```

처리 흐름은 다음과 같다.

1. 부모 UI의 추가 가능한 Aggregation 목록 검색

```javascript
T_0023 where UIOBK = parent.UIOBK
       and UIATY = "3"
       and ISDEP !== "X"
```

2. Aggregation이 없으면 메시지 출력 후 종료
3. Aggregation 선택 시 해당 Aggregation의 type을 기준으로 추가 가능한 UI 검색
4. `T_0027` 기준으로 상속/구현 관계를 확인
5. `UW10` 공통코드 기준으로 실제 허용 가능 UI인지 점검
6. `UW03` 기준으로 특정 부모/aggregation에만 추가 가능한 UI인지 점검
7. Deprecated / Stop / 미사용 Library 항목 제외
8. 추가 가능한 UI 리스트 구성
9. 사용자가 UI 선택 후 확인하면 callback 호출

```javascript
retFunc(ls_0022, ls_0023, l_cnt, lt_0023, isPresetAttr)
```

### 10.2 UI 추가 본 처리

실제 UI 추가는 다음 함수가 담당한다.

```javascript
oAPP.fn.designAddUIObject(is_tree, is_0022, is_0023, i_cnt, isPresetAttr)
```

주요 검증 흐름은 다음과 같다.

1. Cardinality 점검: `oAPP.fn.chkUiCardinality`
2. Unique UI 점검: `oAPP.fn.designChkUnique`
3. Hidden Area UI 점검: `oAPP.fn.designChkHiddenAreaUi`
4. 특정 부모 제한 점검: `oAPP.fn.designChkFixedParentUI`
5. 추가 불가능 Aggregation 점검: `checkDenyChildAggr`
6. 허용 가능 Aggregation 점검: `checkAllowChildAggr`

### 10.3 UI 추가 시 데이터 생성

추가 가능하면 `T_0014` 구조를 생성한다.

```javascript
var l_14 = oAPP.fn.crtStru0014();
```

| 항목 | 값 |
|---|---|
| `OBJID` | `setOBJID`로 자동 채번 |
| `POBID` | 부모 `OBJID` |
| `UIOBK` | 추가 UI Object Key |
| `PUIOK` | 부모 UI Object Key |
| `UIATK` | 선택 Aggregation Key |
| `UIATT` | 선택 Aggregation 이름 |
| `UILIB` | UI Library Class |
| `TGLIB` | Target Library |
| `ISMLB` | N건 Aggregation 여부 |

그리고 Embedded Aggregation 정보로 `T_0015` 라인을 생성한다.

```javascript
UIATY = "6"
ISEMB = "X"
```

### 10.4 개인화 속성 적용

UI 추가 팝업의 “개인화 속성 적용”이 선택된 경우 로컬 SQLite DB에서 개인화 속성을 조회한다.

```text
P13N_ROOT\UI_ATTR\UI_ATTR_PRESET.db
```

조회 조건은 다음과 같다.

```javascript
LIBVER
UNAME
UIOBK
```

조회된 속성은 생성 UI의 `_T_0015`에 함께 반영된다.

### 10.5 Preview 반영

UI 생성 후 iframe 내부 함수들을 호출한다.

```javascript
createUIInstance(l_14, _aT0015)
setRichTextEditorException(...)
setChildUiException(...)
moveUIObjPreView(...)
```

이후 다음 처리를 수행한다.

1. Preview 예외 UI draw 처리: `oAPP.fn.prevDrawExceptionUi(...)`
2. FileUploader `uploadUrl` 예외 처리: `oAPP.fn.attrUploadUrlException(...)`
3. Undo history 저장: `saveActionHistoryData("INSERT", ...)`
4. 예외로 강제 추가된 Child 정리: `oAPP.fn.destroyExcepChild(...)`
5. RichTextEditor rendering 대기
6. 모델 refresh
7. Tree binding 재구성
8. 생성 UI 선택: `oAPP.fn.setSelectTreeItem(l_14.OBJID)`
9. Change Flag 설정: `oAPP.fn.setChangeFlag()`
10. Binding Popup Design Data 갱신: `oAPP.fn.updateBindPopupDesignData()`

---

## 11. UI 위치 변경 흐름

UI 위치 변경은 크게 3가지 방식이 있다.

1. Context Menu의 Up / Down
2. Context Menu의 Move Position 팝업
3. Drag & Drop

### 11.1 Context Menu Up / Down

파일:

```text
www\ws30\ws10_20\design\js\callDesignContextMenu.js
```

메뉴 key는 다음과 같다.

| Key | 기능 |
|---|---|
| `M03` | Up |
| `M04` | Down |
| `M05` | Move Position |

Up / Down은 다음 함수로 처리된다.

```javascript
oAPP.fn.contextMenuUiMove(sign, pos)
```

처리 흐름은 다음과 같다.

1. Context Menu에서 선택된 `OBJID` 확인
2. 대상 Tree 라인 검색
3. Undo history 저장
4. 부모 `zTREE`에서 현재 UI 제거
5. `sign` 또는 `pos` 기준으로 새 위치에 삽입
6. 모델 refresh 및 Tree binding 재구성
7. 같은 Aggregation 내 실제 UI index가 변경된 경우 Preview도 이동
8. Preview 이동 전 현재 UI 제거: `oAPP.oDesign.fn.prevRemoveUiObject(ls_tree)`
9. UI 인스턴스 재생성: `oAPP.fn.reCreateUIObjInstance(ls_tree)`
10. `UA026` 기준으로 부모에 실제 추가되지 않는 UI를 제외하고 Preview Aggregation index 계산
11. Preview 이동: `moveUIObjPreView(...)`
12. 대상 UI 다시 선택: `oAPP.fn.setSelectTreeItem(ls_tree.OBJID)`
13. Change Flag 설정
14. Binding Popup Design Data 갱신

### 11.2 Move Position 팝업

파일:

```text
www\ws30\ws10_20\design\js\uiMovePosition.js
```

함수:

```javascript
oAPP.fn.uiMovePosition
```

Move Position은 현재 UI의 형제 위치 중 특정 위치로 바로 이동하는 기능이다.

팝업은 다음 UI를 제공한다.

- Max 위치 표시
- `sap.m.StepInput`
- `sap.m.Slider`
- Confirm 버튼
- Close 버튼

위치 변경 중에는 다음 함수로 이동 위치 표시를 한다.

```javascript
oAPP.fn.designMoveMark(is_parent, OBJID, pos)
```

확인 시 callback으로 0-based index를 전달한다.

```javascript
f_callBack(l_pos)
```

최종 이동은 다시 다음 함수로 위임된다.

```javascript
oAPP.fn.contextMenuUiMove(undefined, pos)
```

### 11.3 Drag & Drop 이동

Drag & Drop 최종 처리는 다음 함수에서 수행된다.

```javascript
oAPP.fn.drop_cb(param, i_drag, i_drop)
```

#### 같은 부모 + 같은 Aggregation 이동

다음 조건이면 두 UI의 위치 교환으로 처리한다.

```javascript
param === undefined
i_drag.POBID === i_drop.POBID
i_drag.UIATK === i_drop.UIATK
```

처리 흐름은 다음과 같다.

1. 부모 Tree 정보 검색
2. Undo history 저장
3. Preview에서 drag/drop UI 제거
4. 두 UI 인스턴스 재생성
5. 부모 `zTREE`에서 두 라인 위치 교환
6. Preview에서도 두 UI 위치 이동
7. RichTextEditor rendering 대기
8. 모델 refresh
9. Tree binding 재구성
10. Drag 종료
11. Change Flag 설정
12. Binding Popup 갱신
13. Drag UI 다시 선택

#### 다른 부모 또는 다른 Aggregation으로 이동

다른 부모/aggregation으로 이동하는 경우 다음 검증을 먼저 수행한다.

1. Cardinality 점검
2. Fixed Parent 점검
3. `UW08` 추가 불가 점검
4. `UW10` 추가 가능 점검

검증 통과 후 처리 흐름은 다음과 같다.

1. Drag UI의 기존 부모에서 제거
2. 기존 부모가 필수 Child 예외 대상이면 `setChildUiException` 처리
3. 직접 입력 Aggregation 반영 처리: `oAPP.fn.previewSetStrAggr(i_drag)`
4. Preview에서 Drag UI 제거: `prevRemoveUiObject(i_drag)`
5. Drop 대상 `zTREE`의 지정 위치에 삽입
6. Drag UI의 부모 정보 변경
7. Drag UI의 Embedded Aggregation `_T_0015` 정보 갱신
8. N건 Binding context가 달라진 경우 바인딩 해제 처리: `oAPP.fn.designUnbindUi(...)`
9. UI 인스턴스 재생성
10. 새 부모 Preview에 삽입
11. 현재 UI가 N건 바인딩 처리된 경우 새 부모에 model bind 정보 재매핑
12. 모델 refresh
13. Drag UI 선택
14. Drag 종료
15. Change Flag 설정
16. Binding Popup 갱신

#### Drag & Drop 복사

Drag effect가 `Copy`인 경우 이동이 아니라 복사로 처리한다.

```javascript
if (l_effect === "Copy") {
  oAPP.fn.designCopyUI(i_drag, i_drop, param);
}
```

복사 흐름은 다음과 같다.

1. 기존 `T_0014` 라인 복사
2. 신규 `OBJID` 채번
3. 부모/aggregation 정보 변경
4. 기존 `_T_0015` 복사
5. Description 복사
6. Client Event 복사
7. Preview UI 생성
8. Child UI가 있으면 재귀 복사
9. Undo history 저장
10. 모델 refresh
11. 복사된 UI 선택
12. Change Flag 설정

---

## 12. UI 삭제 흐름

UI 삭제는 단건 삭제와 멀티 삭제로 구분된다.

### 12.1 단건 삭제

단건 삭제는 다음 함수가 담당한다.

```javascript
oAPP.fn.designUIDelete(is_tree)
```

처리 흐름은 다음과 같다.

1. 삭제 확인 메시지 출력
2. YES가 아니면 종료
3. Undo history 저장: `saveActionHistoryData("DELETE", ls_tree)`
4. Preview에서 부모 Aggregation 기준 UI 제거
5. 부모 및 현재 UI에 대해 필수 Child 예외 처리
6. 삭제 이후 선택할 이전 Tree 라인 검색
7. 삭제 대상 UI와 하위 UI를 재귀적으로 삭제
8. 부모 `zTREE`에서 삭제 대상 라인 제거
9. 직접 입력 Aggregation 반영: `oAPP.fn.previewSetStrAggr(ls_tree)`
10. 모델 refresh
11. 삭제 전 기준 이전 라인 선택: `oAPP.fn.setSelectTreeItem(l_prev)`
12. Change Flag 설정
13. Binding Popup 갱신

재귀 삭제 시 수행하는 작업은 다음과 같다.

- Client Event 삭제
- Description 삭제
- Binding 정보 해제
- Preview UI destroy
- Popup 수집 정보 제거
- `oAPP.attr.prev[OBJID]` 삭제
- 현재 Preview 예외 UI가 삭제 대상이면 `UA015UI` 제거

### 12.2 멀티 삭제

멀티 삭제는 Design Tree checkbox 선택건을 대상으로 한다.

함수:

```javascript
oAPP.fn.designTreeMultiDeleteItem
```

처리 흐름은 다음과 같다.

1. Checkbox 선택건 존재 여부 확인
2. 선택건이 없으면 메시지 출력
3. 현재 선택 UI가 삭제 대상이면 삭제 후 선택할 이전 라인 계산
4. 선택된 OBJID 목록 수집
5. 삭제 확인 메시지 출력
6. Undo history 저장
7. 선택된 UI의 부모 목록 수집
8. 멀티 삭제 후 부모 UI onAfterRendering 대기 설정
9. 선택 라인 재귀 삭제
10. 부모 UI rendering 대기
11. 모델 refresh
12. 삭제 후 대상 라인 선택
13. Change Flag 설정
14. Binding Popup 갱신

각 삭제 라인에 대해 다음 작업을 수행한다.

- Client Event 삭제
- Description 삭제
- Binding 정보 해제
- Popup 수집 정보 제거
- 필수 Child 예외 처리
- Preview에서 UI 제거
- Preview UI destroy
- `oAPP.attr.prev[OBJID]` 삭제
- `UA015UI` 정리
- Tree 라인 제거
- 직접 입력 Aggregation 반영

---

## 13. UI Property 변경 흐름

우측 Attribute 영역에서 Property 값을 변경하면 다음 함수가 호출된다.

```javascript
oAPP.fn.attrChange(is_attr, uityp, bSkipRefresh, bForceUpdate)
```

### 13.1 `attrChange` 처리 흐름

1. 임시 Action Code 확인 후 제거: `is_attr.ACTCD`
2. Attribute 오류 표시 초기화
3. ROOT Document Attribute 예외 처리: `oAPP.fn.attrDocumentProc(is_attr)`
4. `autoGrowing` 관련 예외 처리
5. `dropAble` 관련 예외 처리
6. Undo history 저장
7. Attribute 변경 예외 모듈 호출
8. 실제 Attribute 변경 처리: `oAPP.fn.attrChangeProc(...)`
9. Preview onAfterRendering 대상 UI 확인
10. 대상 UI invalidate 후 rendering 대기
11. Design 모델 refresh
12. Binding Popup Design Data 갱신
13. Preview UI 선택 표시

### 13.2 `attrChangeProc` 처리 흐름

```javascript
oAPP.fn.attrChangeProc
```

처리 흐름은 다음과 같다.

1. Change Flag 설정
2. 입력값 점검
3. 오류가 있으면 Attribute valueState 설정 후 기본값으로 보정
4. `_T_0015` 수집값 변경
5. Attribute 라인 style 처리
6. F4 Help 표시 여부 처리
7. 입력 가능 여부 처리
8. Preview UI에 Property 반영
9. 모델 refresh

### 13.3 `_T_0015` 수집 규칙

`attrChgAttrVal`은 `_T_0015`를 직접 갱신한다.

주요 규칙은 다음과 같다.

- Event(`UIATY = "2"`) 값이 있으면 수집
- Aggregation(`UIATY = "3"`) 값이 있으면 수집
- Event 값이 없고 Client Event도 없으면 수집 라인 제거
- Aggregation 값이 없으면 수집 라인 제거
- Property 값이 default와 같으면 수집하지 않음
- 이미 수집된 값이 default로 돌아가면 수집 라인 제거
- 숫자 타입은 Number 변환 후 String 처리
- 빈 문자열이 default와 다른 의미 있는 값이면 `ISSPACE = "X"` 처리
- OTR Alias는 대문자 보정

---

## 14. Binding 흐름

Binding 아이콘은 Attribute 입력 필드 오른쪽의 노란색 아이콘이다.

아이콘 클릭 시 다음 함수 흐름을 탄다.

```javascript
oAPP.fn.attrIcon1Proc
```

Property인 경우:

```javascript
oAPP.fn.attrBindProp
```

Aggregation인 경우:

```javascript
oAPP.fn.attrBindAggr
```

### 14.1 Binding Popup 호출

Binding Popup은 다음 함수로 호출한다.

```javascript
oAPP.fn.callBindPopup(title, CARDI, callback, UIATK)
```

`CARDI` 값 의미는 다음과 같다.

| 값 | 의미 |
|---|---|
| `T` | TABLE만 가능 |
| `S` | STRUCTURE만 가능 |
| `F` | 일반 필드 가능 |
| `R` | RANGE TABLE만 가능 |
| `ST` | STRING_TABLE만 가능 |

Property binding 시 기본은 `F`이다.

예외:

| 대상 | CARDI |
|---|---|
| SelectOption2 value | `R` |
| SelectOption3 value | `R` |
| Array property 중 숫자가 아닌 타입 | `ST` |

Aggregation binding 시 기본은 `T`이다.

### 14.2 Binding 데이터 조회

Binding Popup은 서버에서 Controller Class 기준 바인딩 가능 필드를 조회한다.

```text
/getBindAttrData
```

서버 응답의 `T_ATTR`를 Tree 형태로 구성하여 출력한다.

선택 가능한 라인만 enable 처리한다.

### 14.3 Property Binding 처리

Property Binding callback은 다음 함수이다.

```javascript
oAPP.fn.attrBindCallBackProp
```

Binding 처리 시 다음 값을 설정한다.

```javascript
is_attr.UIATV = selectedPath
is_attr.ISBND = "X"
is_attr.MPROP = additionalBindingProperty
is_attr.edit = false
```

그 후 다음 흐름으로 일반 Attribute 변경 처리와 동일하게 반영한다.

```javascript
oAPP.fn.attrSetBindProp
oAPP.fn.attrChange
```

Binding 처리된 Property는 직접 수정할 수 없다.

Binding 해제 시:

1. `UIATV` 초기화
2. default value가 있으면 default로 복원
3. `ISBND` 초기화
4. `MPROP` 초기화
5. `attrChange` 재호출

### 14.4 Aggregation Binding 처리

Aggregation Binding callback은 다음 함수이다.

```javascript
oAPP.fn.attrBindCallBackAggr
```

Aggregation Binding은 Child UI에 N건 binding이 존재할 수 있으므로, 기존 binding이 있거나 child binding이 있으면 확인 팝업을 거친다.

Binding 처리 시:

1. Aggregation path를 `UIATV`에 설정
2. `ISBND = "X"`
3. UI의 `_MODEL` 또는 `_BIND_AGGR`에 binding context 구성
4. 하위 UI의 model binding 관계 구성
5. Tree parent/child 예외 속성은 필요 시 unbind 처리

---

## 15. Event 흐름

Event Attribute는 서버 이벤트 목록을 DDLB로 구성한다.

이벤트 라인에서 신규 서버 이벤트를 생성하려면 이벤트 DDLB 오른쪽 녹색 아이콘을 사용한다.

호출 함수:

```javascript
oAPP.fn.attrCallEventPopup
```

실제 팝업 함수:

```javascript
oAPP.fn.createEventPopup
```

파일:

```text
www\ws30\ws10_20\design\js\createEventPopup.js
```

### 15.1 서버 이벤트 생성 팝업 흐름

1. Method Name 입력
2. Description 입력
3. Method Name은 대문자로 변환
4. `EV_` prefix가 없으면 자동 추가
5. 필수값 검증
6. 특수문자 검증
7. 서버 요청

```text
/createEventMethod
```

전달 값은 다음과 같다.

| 값 | 의미 |
|---|---|
| `CLSNM` | Application Class ID |
| `PACKG` | Package |
| `REQNO` | CTS Request |
| `METH` | Event Method |
| `DESC` | Description |

### 15.2 생성 완료 후 처리

서버 이벤트 생성이 정상 완료되면:

1. 서버 이벤트 목록 `oAPP.attr.T_EVT` 갱신
2. Suggestion 저장
3. callback 호출

```javascript
oAPP.fn.attrCreateEventCallBack(is_attr, param.METHOD)
```

4. Attribute 값에 이벤트명 매핑

```javascript
is_attr.UIATV = evtnm
is_attr.comboval = evtnm
```

5. 일반 Attribute 변경 흐름 수행

```javascript
oAPP.fn.attrChange(is_attr)
```

Event의 경우 Preview UI에 실제 이벤트 handler를 직접 생성하지 않고, 저장용 Attribute 값으로 수집한다.

---

## 16. 저장 데이터 구성 흐름

저장 데이터는 다음 함수에서 구성한다.

```javascript
oAPP.fn.getSaveData
```

처리 흐름은 다음과 같다.

1. `zTREE` 기준으로 `POSIT` 재정의
2. Tree 구조를 Table 구조로 변환
3. `POSIT` 기준 정렬
4. Application 정보 `T_0010` 구성
5. ROOT `_T_0015` 중 `UA003`에 매핑되는 Document 속성은 `T_0010` 필드로 반영
6. UI Attribute 변경 수집
7. 최종 저장 구조 반환

```javascript
{
  TU4A0010,
  YU4A0014,
  YU4A0015,
  T_EDIT,
  S_ERHTML,
  T_CEVT,
  T_JSLK,
  T_CSLK,
  T_DESC,
  S_WSO,
  T_SKLE
}
```

---

## 17. AI가 코드 수정 시 반드시 지켜야 할 원칙

### 17.1 Design Tree와 Preview는 항상 동기화해야 한다

UI 추가, 삭제, 이동, 복사, 붙여넣기 시 다음을 동시에 고려해야 한다.

- `zTREE`
- `oAPP.attr.prev`
- UI의 `_T_0015`
- Preview iframe 내부 UI instance
- Binding Popup Design Data
- Undo / Redo history
- Change Flag

Tree만 변경하거나 Preview만 변경하면 안 된다.

### 17.2 UI 선택은 반드시 공통 함수를 사용한다

UI 추가/삭제/이동 후 직접 row index만 선택하지 말고 다음 함수를 사용해야 한다.

```javascript
oAPP.fn.setSelectTreeItem(OBJID)
```

이 함수는 다음까지 함께 처리한다.

- Tree 펼침
- Row 선택
- Attribute 갱신
- Binding Popup 선택 동기화
- Preview 선택 표시
- Attribute focus

### 17.3 Attribute 변경은 `attrChange` 흐름을 우회하지 않는다

Property, Event, Aggregation 값을 변경할 때는 직접 `_T_0015`만 수정하지 말고 다음 흐름을 사용해야 한다.

```javascript
oAPP.fn.attrChange
oAPP.fn.attrChangeProc
oAPP.fn.attrChgAttrVal
```

이 흐름에는 다음 처리가 포함되어 있다.

- 입력값 검증
- Undo history
- Change Flag
- `_T_0015` 수집
- Preview 반영
- Attribute style 처리
- Binding Popup 갱신
- Preview 선택 유지

### 17.4 UI 추가 가능 여부는 공통코드를 기준으로 판단한다

UI 추가 가능 여부를 하드코딩하지 말고 다음 기준을 사용해야 한다.

```javascript
T_0022
T_0023
T_0027
T_9011
oAPP.attr.S_CODE
```

특히 다음 예외 로직을 반드시 거쳐야 한다.

```javascript
checkDenyChildAggr
checkAllowChildAggr
designChkFixedParentUI
chkUiCardinality
```

### 17.5 텍스트는 하드코딩하지 않는다

화면 타이틀, 버튼명, 메시지, tooltip은 접속 언어 기준 텍스트 함수를 사용해야 한다.

사용되는 대표 함수는 다음과 같다.

```javascript
oAPP.common.fnGetMsgClsText(...)
parent.WSUTIL.getWsMsgClsTxt(...)
```

한글/영문 텍스트를 직접 하드코딩하지 않는다.

### 17.6 Preview iframe 내부 함수 호출은 기존 계약을 유지한다

Preview 반영 시 기존 호출 계약을 유지해야 한다.

대표 호출 함수:

```javascript
drawPreview
refreshPreview
selPreviewUI
createUIInstance
moveUIObjPreView
delUIObjPreView
destroyUIPreView
setChildUiException
setRichTextEditorException
removeDropConfig
```

이 함수들의 파라미터 순서를 임의로 변경하면 안 된다.

### 17.7 Rendering 대기 로직을 제거하지 않는다

UI 이동/삭제/추가 후 다음 모듈을 통해 rendering 완료를 대기하는 로직이 존재한다.

```javascript
parent.require(oAPP.oDesign.pathInfo.setOnAfterRender)
```

RichTextEditor, ObjectPage, Dialog, Page 등 예외 UI는 rendering 타이밍이 중요하므로 단순 `refresh()`로 대체하지 않는다.

### 17.8 Undo / Redo history를 누락하지 않는다

사용자가 수행하는 주요 변경은 Undo history에 저장해야 한다.

대표 action:

```text
INSERT
DELETE
MULTI_DELETE
MOVE
DRAG_DROP
COPY
CHANGE_ATTR
RESET_ATTR
```

Undo / Redo에서 호출되는 함수는 추가 파라미터가 있을 수 있으므로 함수 signature를 변경할 때 반드시 기존 호출부를 확인해야 한다.

### 17.9 Binding 처리된 속성은 직접 수정 가능 상태로 만들지 않는다

`ISBND = "X"`인 Property는 직접 입력 불가능해야 한다.

Binding 해제 시에는 default value 복원, `ISBND`, `MPROP`, DDLB binding item 제거까지 함께 처리해야 한다.

### 17.10 삭제 시 하위 데이터까지 정리해야 한다

UI 삭제 시 Tree 라인만 제거하면 안 된다.

반드시 다음 데이터도 함께 정리해야 한다.

- Client Event
- Description
- Binding 수집 정보
- Popup 수집 정보
- Preview instance
- `oAPP.attr.prev[OBJID]`
- `UA015UI` 예외 상태
- 직접 입력 Aggregation 반영
- 필수 Child UI 예외

---

## 18. AI에게 전달하는 프롬프트 예시

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
