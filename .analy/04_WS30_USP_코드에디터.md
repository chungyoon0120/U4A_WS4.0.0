# WS30 USP 코드에디터 — 분석 문서

> 분석 대상 버전: U4A Workspace v3.6.3  
> 분석 기준 파일: `www/ws30/ws10_20/js/usp/ws_usp.js` (8284 줄), `ws_usp_01.js`, `ws_usp_util.js`, `contextMenu/`, `monaco/`

---

## 1. 개요 — WS30 화면 구성

WS30은 **USP(U4A Source Program)** 소스 코드 에디터 화면이다.  
Electron BrowserWindow 안의 `sap.m.Page("WS30")` 로 렌더링되며, 다음 세 영역으로 구성된다.

| 영역 | 설명 |
|------|------|
| **Custom Header** | 앱 ID / 모드 표시 (Display / Change) + Window 메뉴 (Utilities, Test, …) |
| **Sub Header (OverflowToolbar)** | Display Mode, Change Mode, Activate, Save, MIME, Controller, App Exec 버튼 |
| **Content** | 좌: USP 소스 트리 (`sap.ui.table.TreeTable`) / 우: NavContainer (Intro/Doc/Editor 페이지) |
| **Footer (floatingFooter)** | `sap.m.OverflowToolbar` — 아이콘 + 메시지 텍스트 + 닫기 버튼 |

### NavContainer 페이지 구성

```
usp_navcon (sap.m.NavContainer)
 ├── USP30  : fnGetUspDocPageWs30()    — 문서(Properties Form) 페이지
 ├── USP10  : fnGetUspIntroPageWs30()  — 인트로/로딩 이미지 페이지
 └── USP20  : fnGetUspContPageWs30()   — 메인 컨텐츠 (Panel + Monaco Editor)
```

---

## 2. USP 페이지 렌더링 — UI5 컨트롤 목록

### 2.1 최상위 Page

| UI5 컨트롤 | ID | 역할 |
|---|---|---|
| `sap.m.Page` | `WS30` | WS30 루트 페이지, `floatingFooter:true` |
| `sap.m.OverflowToolbar` | — | Custom Header |
| `sap.m.OverflowToolbar` | — | Sub Header (툴바 버튼 그룹) |
| `sap.m.OverflowToolbar` | — | Footer (메시지 바) |

### 2.2 Custom Header 상세

| UI5 컨트롤 | ID | 역할 |
|---|---|---|
| `sap.m.HBox` | — | 앱 ID / 모드 / 액션 타이틀 묶음 |
| `sap.m.Title` | `ws30_appIdTxt` | 앱 ID 표시 |
| `sap.m.Title` | `ws30_appModeTxt` | 모드(Display/Change) 표시 |
| `sap.m.Title` | `ws30_appActTxt` | 활성화 상태 표시 |
| `sap.m.Button` | `ws30_backBtn` | 뒤로 가기 |
| `sap.m.Button` | `ws30_newWindowBtn` | New Window |
| `sap.m.Menu` | `WMENU20` | Utilities 메뉴 (Items: JSONModel 바인딩) |
| `sap.m.Menu` | `WMENU30` | 추가 메뉴 |
| `sap.m.Menu` | `WMENU50` | 추가 메뉴 |
| `sap.m.MenuItem` | — | 각 메뉴 아이템 (template 바인딩) |

### 2.3 Sub Header 버튼

| UI5 컨트롤 | ID | 역할 |
|---|---|---|
| `sap.m.Button` | `ws30_displayModeBtn` | Display 모드 전환 |
| `sap.m.Button` | `ws30_changeModeBtn` | Change 모드 전환 |
| `sap.m.Button` | `ws30_activateBtn` | Activate |
| `sap.m.Button` | `ws30_saveBtn` | Save |
| `sap.m.Button` | `ws30_MimeBtn` | MIME 관리 |
| `sap.m.Button` | `ws30_controllerBtn` | Controller 이동 |
| `sap.m.Button` | `ws30_appExecBtn` | 앱 실행 |
| `sap.m.ToolbarSeparator` | — | 구분선 (다수) |

### 2.4 컨텐츠 영역 (fnGetPageContentWs30)

```
sap.m.VBox
 ├── sap.m.OverflowToolbar   (Sub-toolbar)
 └── sap.m.Page("PP")
      └── sap.ui.layout.Splitter  (좌우 분할)
           ├── 좌: sap.ui.table.TreeTable("usptree")  — 소스 트리
           └── 우: sap.m.NavContainer("usp_navcon")   — 에디터/문서/인트로
```

### 2.5 USP Editor 페이지 (fnGetUspPageWs30)

| UI5 컨트롤 | ID | 역할 |
|---|---|---|
| `sap.m.Page` | — | 에디터 컨테이너 페이지 |
| `sap.m.OverflowToolbar` | — | 에디터 헤더 툴바 |
| `sap.m.Title` | — | 선택된 파일명 (`{/WS30/USPDATA/OBDEC}`) |
| `sap.m.ComboBox` | — | Monaco 테마 선택 (`/WS30/USP_EDITOR/aThemeList` 바인딩) |
| `sap.m.Button` | `editorDefaultFontBtn` | 기본 폰트 크기로 초기화 |
| `sap.m.Button` | — | Split Orientation 변경 |
| `sap.m.ToggleButton` | — | Full Screen 모드 토글 |
| `sap.m.Button` | `ws30_codeeditor_prettyBtn` | Pretty Print (Shift+F1) |
| `sap.ui.layout.Splitter` | `uspCodeeditorSplit` | 에디터 좌우 분할 (초기 왼쪽 0px) |
| `sap.m.Page` | (EDITPAGE1) | 좌측 에디터 컨테이너 |
| `sap.m.Page` | (EDITPAGE2) | 우측(메인) 에디터 컨테이너 |
| `sap.ui.core.HTML` | — | iframe을 content로 삽입 (Monaco index.html) |
| `sap.ui.layout.SplitterLayoutData` | `codeEditorSplitLayout` | 좌측 에디터 크기 관리 |

> **핵심**: Monaco 에디터는 `sap.ui.codeeditor.CodeEditor`가 아닌  
> **순수 `<iframe>` + `sap.ui.core.HTML`** 방식으로 포함된다.  
> `sap.ui.core.HTML`의 `content` 속성에 iframe HTML 문자열을 직접 주입한다.

### 2.6 USP Panel (fnGetUspPanelWs30)

| UI5 컨트롤 | ID | 역할 |
|---|---|---|
| `sap.m.Panel` | `uspPanel` | Properties 패널 (접힘/펼침) |
| `sap.ui.layout.form.Form` | — | Properties Form |
| `sap.ui.layout.form.ResponsiveGridLayout` | — | Form 레이아웃 |
| `sap.m.Input` | — | URL(SPATH, readOnly), 설명(DESCT), 문자셋(CODPG) |
| `sap.m.Button` | — | URL Copy 버튼 |
| `sap.m.CheckBox` | — | 폴더 여부(ISFLD, readOnly) |
| `sap.m.Label` | — | 각 필드 레이블 |

---

## 3. 소스 트리 (USPTREE)

### 3.1 데이터 구조

소스 트리는 JSONModel의 `/WS30/USPTREE` 경로에 **계층형 배열**로 저장된다.  
각 노드는 다음 필드를 가진다.

| 필드 | 타입 | 설명 |
|------|------|------|
| `OBJKY` | string | 고유 오브젝트 키 |
| `PUJKY` | string | 부모 오브젝트 키 (빈 문자열 = 루트) |
| `OBDEC` | string | 파일/폴더 이름 (화면 표시명) |
| `DESCT` | string | 설명 |
| `ISFLD` | `"X"` or `""` | 폴더 여부 (`"X"` = 폴더) |
| `EXTEN` | string | 파일 확장자 (예: `"js"`, `"html"`) |
| `SPATH` | string | 서버 경로 (URL 형태) |
| `CODPG` | string | 문자셋 (예: `"utf-8"`) |
| `ISSEL` | boolean | 선택 여부 (Row 하이라이트용) |
| `USPTREE` | array | 하위 자식 노드 배열 |

Tree 바인딩 설정:

```javascript
rows: {
    path: "/WS30/USPTREE",
    parameters: {
        numberOfExpandedLevels: 1,
        arrayNames: ['USPTREE']   // 중첩 배열 키 지정
    }
}
```

### 3.2 TreeTable 컨트롤 구성

`sap.ui.table.TreeTable("usptree")` 주요 설정:

| 속성 | 값 |
|---|---|
| `selectionMode` | `Single` |
| `selectionBehavior` | `RowOnly` |
| `visibleRowCountMode` | `Auto` |
| `rowHeight` | 45px |
| `layoutData` | `SplitterLayoutData("usptreeSplitLayout", size: "500px")` |

컬럼 구성:
- **Name 컬럼**: `sap.m.HBox` (아이콘 이미지 + 파일명 Text)  
  - 아이콘: `ISFLD`, `EXTEN` 바인딩 → SVG 폴더(`APP.getAppPath()/svg/`)에서 해당 확장자 SVG 로드  
  - 루트 노드(`PUJKY == ""`)도 아이콘 표시
- **Description 컬럼**: `sap.m.Text({text: "{DESCT}"})`

트리 헤더 툴바: expand-all / collapse-all 버튼 (`sap.m.Button`)

### 3.3 트리 항목 찾기 주요 함수

| 함수 | 위치 | 역할 |
|------|------|------|
| `oAPP.fn._fnFindModelData(sPath)` | ws_usp.js | 바인딩 경로로 현재 노드와 형제 배열 반환 |
| `oAPP.fn._fnFindModelData2(oModelData, sPath)` | ws_usp.js | 모델 데이터 전체에서 경로로 검색 |
| `_fnGetSelectedUspTreeData(aUspTreeData)` | ws_usp.js | 재귀적으로 `ISSEL==true` 노드 탐색 |
| `_fnChangedDataToTreeModel(aTreeData, aChangedData)` | ws_usp.js | Rename 후 변경 노드를 트리 모델에 반영 |

### 3.4 파일 노드 관리

- **선택 표시**: `ISSEL=true` 노드는 `RowSettings.highlight = "Indication03"` + 직접 CSS(`background-color`) 적용 (UI5 RowSettings만으로는 부족하여 `$().css()` 직접 조작)  
- **전역 선택 인덱스**: `gSelectedTreeIndex` (우클릭 기준 인덱스)  
- **더블클릭 히스토리**: `gaDblClickHistory` (중복 클릭 방지)

---

## 4. Monaco Editor 통합

### 4.1 아키텍처 — iframe 격리 구조

Monaco Editor는 `sap.ui.codeeditor.CodeEditor`를 사용하지 않는다.  
대신 **별도 HTML 파일을 iframe으로 로드**하는 방식을 택한다.

```
ws_usp.js (UI5 페이지)
 └── sap.ui.core.HTML
      └── <iframe class="MONACO_EDITOR EDITOR_FRAME1/2"
               src="${USP_ROOT}/monaco/index.html?PARAMS=...">
           └── monaco/index.html
                ├── 전역 변수 초기화 (oAPP, PATH, FS, GRAND_FATHER)
                ├── loader.js 동적 로드 (window.require.config → vs/ 경로 설정)
                └── monaco/index.js (스니펫 설정, require(['vs/editor/editor.main']))
```

에디터는 **2개 인스턴스**(`EDITOR_FRAME1` / `EDITOR_FRAME2`)로 구성되며,  
`uspCodeeditorSplit(sap.ui.layout.Splitter)`로 좌우 분할된다.  
초기에는 `EDITPAGE1`(좌측)이 `size: "0px"`으로 숨겨져 있으며, Split Orientation 버튼으로 토글한다.

### 4.2 초기화 흐름

```
1. iframe onload 이벤트 → oAPP.fn.onFrameLoadUspEditor(event)
2. postMessage({ actcd: 'init', port: MessageChannel.port1/2 })
3. iframe 내부: onMessageInit(oParams)
   → oAPP.MESSAGE_CHANEL_PORT.onmessage = (e) => editor.setValue(e.data)
4. window.require(['vs/editor/editor.main'], callback)
5. monaco.editor.create(document.getElementById('content'), { ... })
   - language: 'html', theme: 'vs-dark'
   - automaticLayout: true, tabCompletion: 'on'
   - snippetSuggestions: 'inline'
```

### 4.3 확장자 ↔ 언어 동기화

파일 선택 또는 Rename 시 `oAPP.usp.sendEditorPostMessageAll({ actcd: 'language_change', extension: sExten })`을 호출한다.

iframe 내부 `getMonacoLanguage(sExtension)` 함수의 변환 테이블:

| 확장자 | Monaco 언어 |
|--------|-------------|
| js, mjs, cjs | javascript |
| ts, tsx | typescript |
| css | css |
| scss | scss |
| less | less |
| htm, html | html |
| xml | xml |
| svg | svg |
| json | json |
| txt | text |
| py | python |

언어 변경 후 `_setSnippetConfig(sLangu)` 및 `_setRegisterSnippet(sLangu)` 호출로 스니펫도 갱신한다.

> 구형 `_fnCodeEditorBindPropertyType` 함수(ws_usp.js L2685)는 현재 주석 처리된 구 `sap.ui.codeeditor.CodeEditor` 시절의 잔재 코드다. 현재 사용되지 않는다.

### 4.4 테마 시스템

- 테마 목록: `WSUTIL.MONACO_EDITOR.getThemeList()` → 스탠다드(`vs`, `vs-dark`, 외부 JSON 테마 60여 개) + 커스텀 그룹
- 테마 파일: `www/lib/monaco/themes/*.json` (Active4D, Dracula, Monokai, NightOwl 등 60여 개)
- 선택 테마 **개인화 저장**: `FS.writeFileSync(P13N_ROOT/monaco/theme/{SYSID}/usp_main/select_theme.json)`  
  → Node `fs-extra`로 파일 직접 저장 (서버 API 미사용)
- 테마 적용: `postMessage({ actcd: 'applyTheme', oThemeInfo: { themeName: ... } })`  
  → iframe 내 `monaco.editor.defineTheme()` + `monaco.editor.setTheme()` 호출

> **테마 경계 분리 (중요)**: 본 화면에는 두 종류의 "테마"가 공존하며 출처가 다르다.
> - **셸 크롬 테마** (툴바·트리·패널·다이얼로그·Footer 등 UI5→HTML5 컨버전 대상의 색/모양/그림자) → **[12_테마_컨버전_전략.md](12_테마_컨버전_전략.md)** 의 `theme/tokens.css` 의미 토큰을 소비하고 `U4ATheme.apply(name)` 로 전환한다. 셸의 단일 출처는 12번 문서다.
> - **Monaco 에디터 내부 구문강조 테마** (`vs`/`vs-dark`/Dracula/Monokai 등, 위 60여 개 JSON) → **Monaco 자체 API**(`monaco.editor.defineTheme` / `setTheme`)로 iframe 안에서 적용·유지한다. 셸 토큰(12번)과 **무관**하며, iframe 격리 구조(4.1) 안에서 실제 Monaco 엔진이 처리하므로 **그대로 유지**한다.
> - 따라서 셸 테마 전환과 Monaco 에디터 테마 선택은 **독립적으로** 동작한다. 셸을 다크 토큰으로 바꿔도 Monaco 내부 테마는 사용자가 ComboBox(2.5)에서 고른 값을 유지하며, 그 반대도 같다.

### 4.5 iframe 간 통신

| 통신 방향 | 메커니즘 | 내용 |
|---|---|---|
| 부모 → iframe | `contentWindow.postMessage(oParams)` | setValue, applyTheme, language_change, snippet_change, init |
| iframe → 부모 | MessageChannel (port 기반) | 에디터 내용 변경 전달 |
| 에디터 Context Menu | `oAPP.attr.oCustomEvtDom` (DOM ID `IF_USP_EDITOR`) CustomEvent | 우클릭 이벤트 전파 |

---

## 5. Context Menu 시스템

두 종류의 Context Menu가 존재한다.

### 5.1 USP 소스 트리 Context Menu

`sap.m.Menu` 바인딩 방식 (`/WS30/CTXMENU`):

```javascript
let oCtxMenu = new sap.m.Menu({
    items: { path: "/WS30/CTXMENU", template: new sap.m.MenuItem({...}) },
    itemSelected: ev_UspTreeCtxMenuClick,
    closed: ev_UspTreeCtxMenuClosed
});
oTreeTable.setContextMenu(oCtxMenu);
```

메뉴 정의 (`fnGetUspTreeDefCtxMenuList`):

| KEY | 아이콘 | 텍스트 | 기본 VISIBLE |
|-----|--------|--------|-------------|
| K1 | expand-group | Expand Subtree | true |
| K2 | collapse-group | Collapse Subtree | true |
| K3 | write-new | Create | true |
| K4 | delete | Delete | true |
| K7 | edit | Rename | true |
| K8 | navigation-up-arrow | Up | true |
| K9 | navigation-down-arrow | Down | true |
| K10 | outdent | Move Position | true |
| K5 | download | Download | true |
| K6 | internet-browser | Test Service | true |
| K11 | popup-window | New Window | false |
| K12 | upload | Upload | false |

`beforeOpenContextMenu` 이벤트에서 모드(Display/Change), 선택 노드 유형(폴더/파일/루트)에 따라  
각 항목의 `ENABLED`, `VISIBLE`을 동적으로 갱신한다.

### 5.2 Monaco Editor Context Menu (패턴/스니펫 메뉴)

`sap.m.Menu("uspCDECtxMenu")` 바인딩 방식 (`/WS30/USP_EDITOR_CTX_MENU`):

```javascript
oAPP.fn.fnUspCodeeditorContextMenuOpen = (oEvent, oSelectedCtxInfo) => {
    // oSelectedCtxInfo: { oTargetPage, oEditor, oMonaco }
    // oAPP.usp.oSelectedCtxInfo 에 저장 후 openAsContextMenu() 호출
};
```

패턴 메뉴 클릭 시 `oAPP.fn.fnUspPatternContextMenuClick(oEvent)`:
1. 바인딩 데이터의 `CKEY`로 ACTCD 구분
2. `CKEY`가 `"PAT"` 또는 `"PTN"` 시작 → 소스 패턴 삽입 (`oEditor.executeEdits(...)`)
3. 그 외 → `contextMenu/MENU_MODULES/{CKEY}/index.js` 동적 `import()` 후 `exports(oPARAM)` 실행

메뉴 모듈:

| 모듈 경로 | CKEY | 역할 |
|---|---|---|
| `M001_C001/index.js` | M001_C001 | Monaco Theme Designer 팝업 실행 |
| `M001_C002/index.js` | M001_C002 | Monaco Snippet Designer 팝업 실행 |
| `_module_pattern.js` | — | 패턴 모듈 템플릿 |

### 5.3 Context Menu 구조 정의 (`contextMenuInfo.js`)

```javascript
let TY_MENU = {
    "PKEY": "",      // 부모키
    "CKEY": "",      // 자식키 (모듈 폴더명과 동일)
    "TYPE": "",      // "ROOT" = 최상위
    "DESC": "",      // 메뉴 표시명
    "ICON": "",      // sap-icon:// 경로
    "ACTCD": "",     // 액션 코드
    "ISSTART": false // 구분선 여부
};
```

---

## 6. 코드 패턴/스니펫

### 6.1 Default Pattern JSON 구조

`ws_usp_util.js`의 `getDefaultPatternJsonData()` 반환값 (평면 배열, 후처리로 트리화):

```json
[
  { "PKEY": "",      "CKEY": "PATT001", "TYPE": "ROOT", "DESC": "Default Pattern", "ICON": "sap-icon://source-code" },
  { "PKEY": "PATT001","CKEY": "PTN001", "DESC": "HTML",  "ICON": "<html.svg 경로>" },
  { "PKEY": "PTN001", "CKEY": "PTN001_001", "DESC": "HTML 기본패턴", "ACTCD": "01" },
  { "PKEY": "PTN001", "CKEY": "PTN001_002", "DESC": "FORM 기본패턴", "ACTCD": "01" },
  { "PKEY": "PTN001", "CKEY": "PTN001_003", "DESC": "Iframe 기본패턴", "ACTCD": "01" },
  { "PKEY": "PTN001", "CKEY": "PTN001_004", "DESC": "UI5 기본패턴",  "ACTCD": "01" },
  { "PKEY": "PTN001_004","CKEY":"PTN001_004_001","DESC":"UI5 BootStrap","ACTCD":"01" },
  { "PKEY": "PATT001","CKEY": "PTN002", "DESC": "JS", "ICON": "<js.svg 경로>" },
  { "PKEY": "PTN002", "CKEY": "PTN002_002", "DESC": "즉시실행함수 패턴", "ACTCD": "02" },
  { "PKEY": "PTN002", "CKEY": "PTN002_003", "DESC": "Module js 패턴",   "ACTCD": "02" },
  { "PKEY": "PTN002", "CKEY": "PTN002_004", "DESC": "윈도우 이벤트 패턴","ACTCD": "02" }
]
```

`ACTCD`의 의미: `"01"` = HTML 계열, `"02"` = JS 계열 (패턴 파일 내용 삽입 구분용)

### 6.2 Custom Pattern JSON 구조

`getCustomPatternInitData()` 반환 (초기 루트만):

```json
[{ "PKEY": "", "CKEY": "PATT002", "TYPE": "ROOT", "DESC": "Custom Pattern", "ISSTART": false }]
```

사용자가 추가한 커스텀 패턴이 여기에 children으로 추가된다.

### 6.3 패턴 파일 저장/로드 (Node fs 유지)

```
PATHINFO.DEF_PATT    → 기본 패턴 JSON 목록 파일
PATHINFO.CUST_PATT   → 커스텀 패턴 JSON 목록 파일
PATHINFO.USERDATA_PATT_FILES → 패턴 소스 텍스트 파일 폴더 (PTN001_001.txt 등)
www/ws30/ws10_20/js/usp/pattern/ → 앱 내장 기본 패턴 txt 파일들
```

로드 흐름 (`oAPP.fn.fnModelBindingUspPattern`):

```
1. FS.readFileSync(DEF_PATT)      → 기본 패턴 JSON Parse
2. FS.readFileSync(CUST_PATT)     → 커스텀 패턴 JSON Parse
3. aPatternMerge = 기본 + 커스텀 concat
4. _additionalUspCtxMenu() 호출   → contextMenuInfo.js 모듈의 추가 메뉴 병합
5. WSUTIL.parseArrayToTree(model, "WS30.USP_EDITOR_CTX_MENU", "CKEY", "PKEY", ...)
   → 평면 배열을 트리 구조로 변환 후 모델 갱신
```

패턴 텍스트 파일 읽기 (`getDefaultPatternFileData`):  
`FS.readdirSync(USERDATA_PATT_FILES)` → 각 `.txt` 파일을 `FS.readFileSync`로 읽어 `KEY`(파일명 확장자 제거) ↔ `DATA` 매핑

### 6.4 Monaco 스니펫 시스템

| 경로 | 역할 |
|------|------|
| `www/lib/monaco/snippet/javascript/*.json` | 표준 JS 스니펫 |
| `www/lib/monaco/snippet/html/*.json` | 표준 HTML 스니펫 |
| `www/lib/monaco/snippet/css/*.json` | 표준 CSS 스니펫 |
| `www/lib/monaco/snippet/javascript/ui5.json` | SAP UI5 스니펫 |
| `P13N_ROOT/monaco/snippet/list.json` | 사용자 저장 스니펫 목록 |
| `P13N_ROOT/monaco/snippet/{_key}` | 스니펫 코드 파일 (개별) |

스니펫 구조 (`oAPP.types.S_SNIPPET`):

```json
{
  "label": "",
  "kind": 27,
  "insertText": "",
  "insertTextRules": 4,
  "documentation": ""
}
```

등록: `monaco.languages.registerCompletionItemProvider(sLanguage, { provideCompletionItems: ... })`  
언어 변경 시 기존 provider를 `dispose()`하고 새로 등록한다.

---

## 7. 파일 열기·저장·Rename 플로우

### 7.1 파일 열기 (트리 Row 선택)

```
트리 Row 클릭 (ondblclick 또는 rowSelectionChange)
 → fnUspTreeTableRowSelect(oRow)
    → Ajax POST /usp_get_object_line_data
       { S_HEAD: oRowData, response_format: "SINGLE" }
    → 응답 Blob → FileReader.readAsText()
    → _fnLineSelectCb()
       ├── 멀티파트 파싱 (UHAK900763 버전 조건부)
       ├── 응답 헤더 usp_head_data_Length 기반 헤더/컨텐츠 분리
       ├── JSON.parse() → oResult (S_HEAD 데이터)
       ├── APPCOMMON.fnSetModelProperty("/WS30/USPDATA", ...)
       ├── oAPP.usp.sendEditorPostMessageAll({ actcd: 'setValue', value: CONTENT })
       └── oAPP.usp.sendEditorPostMessageAll({ actcd: 'language_change', extension: EXTEN })
```

### 7.2 파일 저장

```
Save 버튼 press → ev_pressSaveBtn()
 → 모델에서 /WS30/USPDATA (컨텐츠), /WS30/USPTREE (트리 전체) 수집
 → CONTENT를 Blob으로 변환
 → FormData: { APPDATA: JSON, file: Blob("usp_save_content") }
 → Ajax POST /usp_save_active_appdata(#save 또는 #active)
 → _fnSaveCallback()
    ├── 성공: Footer 메시지, IS_CHAG 초기화
    └── 실패: flashFrame, Footer 에러 메시지
```

### 7.3 Rename 플로우

```
트리 우클릭 → K7(Rename) → fnRenameUspNodePopup()
 → sap.m.Dialog("uspRNPopup") 팝업 열기
    Form 구성:
    - URL (read-only)
    - Old Name (read-only)
    - Is Folder (read-only)
    - New Name (ws30_rename_new, 입력)

확인 버튼 → fnRenameSubmit()
 ├── 동명 체크 (같은 레벨 형제 중 중복)
 ├── 유효성 검사 (_fnCheckCreateNodeData)
 ├── Ajax POST /usp_rename_node
 → _fnRenameUspAppChangeMsgCB() → fnRenameUspNode()
    ├── oAPP.fn._fnFindModelData2()로 변경 후 노드 찾기
    ├── JSONModel.setProperty() 로 트리 모델 갱신
    ├── 우측 에디터에 열린 파일과 같으면 /WS30/USPDATA 모델 갱신
    └── sendEditorPostMessageAll({ actcd: 'language_change', extension: newExten })
        (확장자 변경 시 Monaco 언어 동기화)
```

---

## 8. 파일별·주요 함수 역할 표

### ws_usp.js (8284 줄)

| 함수 | 역할 |
|------|------|
| `oAPP.fn.fnCreateWs30()` | WS30 페이지 생성 진입점. SVG 목록 로드 후 렌더링 |
| `fnOnInitRendering()` | `sap.m.Page("WS30")` 생성 및 App에 추가 |
| `fnGetCustomHeaderWs30()` | 상단 헤더 (Window 메뉴 포함) 생성 |
| `fnGetSubHeaderWs30()` | 서브 헤더 툴바 (모드/저장 버튼 그룹) 생성 |
| `fnGetUspPageToolbarButtonsWs30()` | 서브 헤더의 개별 버튼 인스턴스 생성 |
| `fnGetPageContentWs30()` | VBox + Splitter(트리+NavCon) 구성 |
| `fnGetUspNavContainerWs30()` | NavContainer 및 3개 페이지 생성 |
| `fnGetUspIntroPageWs30()` | 인트로 페이지 (로고 이미지) |
| `fnGetUspDocPageWs30()` | 문서 페이지 (Properties Form, USP30) |
| `fnGetUspContPageWs30()` | 메인 컨텐츠 페이지 (Panel + Editor, USP20) |
| `fnGetUspPageWs30()` | Monaco iframe 에디터 페이지 (헤더 툴바 + Splitter) |
| `fnGetUspTreeTableWs30()` | TreeTable("usptree") 생성 및 컨텍스트 메뉴 연결 |
| `fnGetUspPanelWs30()` | Properties 패널 (URL/설명/문자셋/폴더여부) |
| `fnGetUspTreeDefCtxMenuList()` | 트리 우클릭 메뉴 항목 배열 반환 |
| `fnCreateUspNodePopup()` | 노드 생성 팝업 (`uspCrNodePopup`) |
| `fnRenameUspNodePopup()` | Rename 팝업 (`uspRNPopup`) |
| `fnRenameSubmit()` | Rename 유효성 검사 + Ajax 호출 |
| `fnRenameUspNode()` | Rename 완료 후 모델/에디터 갱신 |
| `fnDeleteUspNode()` | 노드 삭제 처리 |
| `fnUspTreeTableRowSelect()` | 트리 Row 선택 → 서버에서 파일 내용 요청 |
| `_fnLineSelectCb()` | 파일 내용 응답 처리 + 에디터 setValue |
| `_fnSaveCallback()` | 저장 응답 처리 |
| `fnSetAppDisplayMode()` | Display 모드 전환 (App Lock 해제) |
| `fnSetAppChangeMode()` | Change 모드 전환 (App Lock 획득) |
| `oAPP.usp.sendEditorPostMessageAll()` | 전체 Monaco iframe에 postMessage 전송 |
| `oAPP.fn.fnOnInitLayoutSettingsWs30()` | 레이아웃 초기화 (Splitter 크기, 트리 초기화) |
| `fnGetWindowMenuWS30()` | Window 메뉴 데이터 배열 반환 |
| `_fnDoubleClickSplitbar()` | 분할바 더블클릭 시 좌측 에디터 0px 초기화 |
| `_fnUspTreeSelectedRowMark()` | ISSEL 플래그에 따라 Row CSS 적용 |
| `fnCommonUspTreeTableExpand/Collapse()` | 트리 전체 펼침/접힘 |
| `fnOnMoveToPage()` | NavContainer 페이지 이동 |

### ws_usp_01.js

| 함수 | 역할 |
|------|------|
| `oAPP.fn.fnSetUspTreeNodeMove()` | 트리 노드 순서 이동 |
| `oAPP.fn.fnUspTreeNodeMoveUp/Down()` | 위/아래 이동 |
| `oAPP.fn.fnUspTreeNodeMovePosition()` | 위치 지정 이동 팝업 (`sap.m.Dialog("ws30_movePosPopup")`) |
| `oAPP.fn.fnModelBindingUspPattern()` | 패턴 JSON 로드 + 트리 모델 바인딩 |
| `oAPP.fn.fnUspCodeeditorContextMenuOpen()` | Monaco 에디터 우클릭 메뉴 열기 |
| `oAPP.fn.fnUspPatternContextMenuClick()` | 패턴/모듈 메뉴 선택 처리 |
| `_setCtxPatternMenuClick()` | 소스 패턴 삽입 (`executeEdits`) |
| `oAPP.fn.fnUspNewWindow()` | 새 Electron 윈도우로 USP 열기 (IPC 활용) |
| `oAPP.fn.onFrameLoadUspEditor()` | iframe 로드 완료 → MessageChannel port 전달 |
| `oAPP.fn.fnResetUspTree()` | 마지막 저장 상태로 트리 복원 |
| `oAPP.fn.fnClearOnBeforeUspTreeData()` | 저장 전 트리 스냅샷 초기화 |

### ws_usp_util.js

| 함수 | 역할 |
|------|------|
| `getDefaultPatternJsonData()` | 기본 패턴 메타 JSON 배열 반환 (언어 감지 포함) |
| `getCustomPatternInitData()` | 커스텀 패턴 루트 노드 초기 배열 반환 |
| `getDefaultPatternData()` | 패턴 메타 + 패턴 파일 내용 매칭 후 반환 |
| `getDefaultPatternFileData()` | USERDATA_PATT_FILES 폴더의 txt 파일 읽기 |

### monaco/index.html (iframe 내부)

| 함수 | 역할 |
|------|------|
| `onLoad()` | `index.js` 동적 삽입 (loader.js 로드 완료 후) |
| `onMessageInit()` | MessageChannel port 수신 및 에디터 setValue 연결 |
| `onApplyTheme() / setApplyTheme()` | 테마 정의 및 적용 |
| `_setEditorValue()` | `editor.setValue()` 호출 |
| `getMonacoLanguage()` | 확장자 → Monaco 언어 변환 테이블 |
| `_setLanguChange()` | 언어 변경 + 스니펫 갱신 |
| `window.addEventListener('message', ...)` | actcd 기반 메시지 분기 처리 |

### monaco/index.js

| 함수 | 역할 |
|------|------|
| `_setSnippetConfig()` | 언어별 스탠다드 + P13n 스니펫 조합 |
| `_getStandardSnippetData()` | `lib/monaco/snippet/{lang}/*.json` 읽기 |
| `_getP13nSnippetList()` | P13n 저장 스니펫 목록(`list.json`) 읽기 |
| `_getP13nSnippetCodeData()` | P13n 개별 스니펫 코드 파일 읽기 |
| `_setRegisterSnippet()` | `monaco.languages.registerCompletionItemProvider()` 등록 |

### contextMenu/contextMenuInfo.js

| 함수/상수 | 역할 |
|---|---|
| `module.exports()` | 추가 컨텍스트 메뉴 배열 반환 (Code Editor Designer, Theme Designer, Snippet Designer) |

---

## 9. UI 컨버전 고려사항

### 표 A — 그대로 유지할 항목

| 항목 | 유지 이유 | 구체 내용 |
|------|-----------|-----------|
| **Node.js fs (FS)** | Electron 데스크톱 전제 | 패턴 파일 읽기/쓰기, P13n 테마/스니펫 저장, SVG 아이콘 로드 전부 `FS.readFileSync / writeFileSync / readdirSync / existsSync / mkdirSync` |
| **@electron/remote** | Electron IPC | REMOTE, CURRWIN, SHELL, APP.getAppPath(), APP.getPath("userData") |
| **IPC (IPCMAIN)** | New Window 기능 | `fnUspNewWindow`: IPC 채널로 새 BrowserWindow 생성 및 초기화 |
| **Monaco Editor 자체** | 코드 편집 엔진 | `monaco.editor.create()`, `registerCompletionItemProvider()`, `defineTheme()`, `executeEdits()` 등 전량 유지 |
| **Monaco iframe 구조** | SAP UI5 미관여 | `<iframe src="monaco/index.html">` 방식은 이미 UI5와 분리되어 있음. 교체 불필요 |
| **MessageChannel 통신** | iframe ↔ 부모 통신 | port 기반 양방향 채널, postMessage 프로토콜 유지 |
| **WSUTIL, PATHINFO** | Node require 기반 유틸 | `require(PATHINFO.WSUTIL)` — Electron Node 모듈 |
| **sendAjax / Ajax** | 서버 연동 | 소스 조회, 저장, Rename, 삭제 전부 XMLHttpRequest 기반 Ajax (변경 불필요) |
| **Pattern txt 파일** | Node fs 읽기 | `www/ws30/ws10_20/js/usp/pattern/PTN*.txt` Node readFile로 로드 |

### 표 B — HTML5로 교체할 UI5 요소

| UI5 컨트롤 | 위치 | HTML5 대체 방안 |
|---|---|---|
| `sap.m.Page("WS30")` | 최상위 페이지 | `<div id="WS30" class="page">` (display:flex, flex-direction:column, height:100%) |
| `sap.m.OverflowToolbar` (Custom Header) | 상단 헤더 | `<header class="toolbar">` + flexbox. Overflow 처리: 버튼 overflow를 `<details>` 또는 드롭다운 `<button>`으로 대체 |
| `sap.m.OverflowToolbar` (Sub Header) | 서브 헤더 | `<div class="sub-toolbar">` + flexbox. 각 버튼은 `<button>` |
| `sap.m.OverflowToolbar` (Footer) | 플로팅 푸터 | `<footer class="floating-footer">` + position:fixed bottom. 아이콘은 SVG 또는 Font-Awesome |
| `sap.ui.layout.Splitter` (좌우 분할) | 컨텐츠 | CSS Grid(`grid-template-columns`) 또는 `Split.js` 라이브러리. 마우스 드래그 리사이즈 구현 |
| `sap.ui.layout.SplitterLayoutData` | Splitter 크기 | CSS `width`, JS `style.width = "0px"` 직접 조작 |
| `sap.ui.table.TreeTable("usptree")` | 소스 트리 | **가장 중요한 교체 대상**. `<ul>/<li>` 기반 재귀 트리 또는 경량 Virtual 트리(`jstree`, `Fancytree`, 또는 바닐라 JS 재귀 렌더). 주요 구현 포인트: ① 재귀 계층 렌더 ② 더블클릭 이벤트 ③ 우클릭 Context Menu ④ ISSEL 행 하이라이트 (CSS class 토글) ⑤ Row expand/collapse |
| `sap.m.Menu` + `sap.m.MenuItem` (트리 Context Menu) | 트리 우클릭 | 순수 HTML `<ul class="context-menu">` + `position:absolute`. 동적 show/hide 및 `document.addEventListener('click', dismiss)`. 활성화/비활성화는 `disabled` class |
| `sap.m.Menu` + `sap.m.MenuItem` (에디터 Context Menu) | Monaco 우클릭 | 동일 방식. 트리 구조(submenu) 구현은 CSS `:hover > ul` |
| `sap.m.NavContainer("usp_navcon")` | 우측 패널 | `<div class="nav-container">` + 자식 페이지 `display:none/block` 전환. 또는 CSS `visibility:hidden` + `z-index` 스택 |
| `sap.m.Page("USP10/20/30")` | NavCon 내 페이지 | `<div class="page" id="USP10/20/30">` |
| `sap.m.Panel("uspPanel")` | Properties 패널 | `<details>/<summary>` (기본 접힘/펼침) 또는 `<div class="panel">` + 버튼 토글 |
| `sap.ui.layout.form.Form` + `FormContainer` + `FormElement` | Properties Form | `<table>` 또는 `<dl>/<dt>/<dd>` 또는 CSS Grid `display:grid; grid-template-columns: label width auto` |
| `sap.m.Input` | URL/설명/문자셋 | `<input type="text">` + `readonly` 속성 |
| `sap.m.CheckBox` | 폴더 여부 | `<input type="checkbox" disabled>` |
| `sap.m.ComboBox` (Monaco 테마 선택) | 에디터 헤더 | `<select>` + `<optgroup label="Standard/Custom">` 로 그룹 구분 (현재 sap.ui.model.Sorter로 groupName 기준 그룹화하는 것을 optgroup으로 대체). **이 컨트롤이 고르는 값은 Monaco 에디터 내부 구문강조 테마**(`vs`/`vs-dark`/Dracula 등)이며 **Monaco 자체 API**(`monaco.editor.defineTheme`/`setTheme`)로 적용한다 → 셸 토큰(12번)과 무관, 4.4절 참조. 단 `<select>` 자체의 외형(배경/테두리/글자색)은 셸 크롬이므로 `tokens.css` 토큰 소비 |
| `sap.m.Button` (전체) | 모든 버튼 | `<button type="button">` + 아이콘은 SVG 또는 `<span class="icon">` |
| `sap.m.ToggleButton` (Full Screen) | 에디터 헤더 | `<button type="button" aria-pressed="false">` (CSS `.pressed` 클래스로 상태 표시) |
| `sap.m.Title` | 텍스트 표시 | `<h3>` 또는 `<span class="title">` |
| `sap.m.Text` | 텍스트 표시 | `<span>` 또는 `<p>` |
| `sap.m.Image` (SVG 아이콘) | 트리 아이콘 | `<img>` 태그 (src 속성 바인딩 방식은 동일, ISFLD/EXTEN에 따라 JS로 src 설정) |
| `sap.m.Dialog("uspCrNodePopup")` | 노드 생성 팝업 | `<dialog>` HTML5 네이티브 요소 + `showModal()` / `close()`. 또는 `<div class="modal-overlay">` |
| `sap.m.Dialog("uspRNPopup")` | Rename 팝업 | 동일 — `<dialog>` 또는 `<div class="modal">` |
| `sap.m.Dialog("ws30_movePosPopup")` | 위치 이동 팝업 | `<dialog>` |
| `sap.m.StepInput` | 이동 위치 입력 | `<input type="number" min="1">` |
| `sap.ui.core.Icon` (Footer) | 아이콘 | SVG inline 또는 `<span class="icon">` |
| `sap.m.ToolbarSpacer` | 공백 | `<div style="flex:1">` 또는 CSS `margin-left:auto` |
| `sap.m.ToolbarSeparator` | 구분선 | `<hr>` 또는 `<div class="separator">` |
| `sap.m.HBox` / `sap.m.VBox` | 레이아웃 | `<div style="display:flex; flex-direction:row/column">` |
| `sap.ui.model.json.JSONModel` | 데이터 바인딩 | 바닐라 JS 상태 객체 (`window.gModel = {}`) + 직접 DOM 업데이트 또는 최소 반응형 래퍼 |
| `sap.ui.model.Sorter` (ComboBox 그룹) | 그룹 정렬 | JS `Array.sort()` + `<optgroup>` 수동 생성 |
| `sap.ui.core.theming.Parameters.get()` | 셸 테마 색상 | **셸 크롬 테마 → [12_테마_컨버전_전략.md](12_테마_컨버전_전략.md) 따름.** `theme/tokens.css` 의미 토큰(`var(--surface)`/`var(--text)`/`var(--accent)` 등)만 소비. 하드코딩 금지. (※ Monaco 에디터 내부 구문강조 테마는 별개 — 4.4절·아래 주석 참조) |
| `sap.ui.table.RowSettings` (highlight) | Row 하이라이트 | `classList.add/remove("selected")` + CSS `.selected { background-color: ... }` |

> **우선순위**: `sap.ui.table.TreeTable` 교체가 가장 복잡하다. 재귀 렌더링, Row 가상화(Auto 행 수), 우클릭 Context Menu, Expand/Collapse 상태 관리, 행 선택/하이라이트를 모두 구현해야 한다. Virtual 트리 라이브러리 (`jstree` 또는 `Fancytree`) 도입을 적극 검토할 것.

---

## 10. AI 컨버전 실행 사양 (WS30 USP 코드에디터)

> ⚠️ **현행화 2026-09-22 — 이 영역은 이미 구현돼 돌고 있다.** WS30 USP 는 HTML5 파일(소스 tree·에디터·우클릭 메뉴)로 동작 중이고, Monaco 는 원래대로 iframe 으로 유지된다.
> 따라서 이 절은 **다시 만들라는 지시서가 아니라 「원래 이래야 한다」는 대조 기준**이다. 고칠 일이 생기면 **현행 구현을 먼저 읽고** 이 절과 대조한다 — 새로 만들지 않는다.
> 아래 원문은 처음 구축할 때 쓴 설계 산출물 그대로 남겨 둔다.  
> 기능 매핑은 9장(표 A 유지 / 표 B 교체)을, **셸 크롬 테마**는 [12_테마_컨버전_전략.md](12_테마_컨버전_전략.md) 를 따른다. **Monaco 에디터 내부 테마는 Monaco 자체 API 유지**(4.4 테마 경계 분리)다. 세 축을 함께 적용해야 완성이다.

### 10.1 시안·참조 출처

| 구분 | 경로 | 용도 |
|---|---|---|
| 기능/구조 분석 | 본 문서 1~7장 | NavContainer 구조·소스 트리·Monaco iframe·패턴/스니펫·파일 I/O 흐름 |
| UI 교체 매핑 | 본 문서 9장 (표 A 유지 / 표 B 교체) | UI5 컨트롤 → HTML5 대체 |
| **현행 구현(기준)** | `www/ws30/ws10_20/js/usp/` (`ws_html5_usp.js` · 트리 · 에디터 · 우클릭 메뉴) | ★지금 실제로 도는 코드 — 고칠 일이 있으면 여기를 먼저 읽는다 |
| 셸 테마 사양 | `.analy/12_테마_컨버전_전략.md` | 기준 `sap_horizon`·테마 5종(white/dark/purple/red/green)·토큰 계약(4.2)·전환 API(5.2)·불변 제약(6.4) |
| Monaco 내부 테마 | `www/lib/monaco/themes/*.json` + Monaco API | iframe 안에서 Monaco 엔진이 직접 처리 (셸 토큰과 별개) |

### 10.2 산출물 파일 트리 (target)

> 본 화면 코드는 8장 파일별 역할표를 기준으로 한다. **셸 크롬 CSS 는 `theme/tokens.css` 토큰을 소비**하고, **Monaco 내부 테마는 별도**(iframe 안 Monaco API)다.

```
www/ws30/ws10_20/js/usp/
├─ ws_usp.js          ← WS30 페이지/트리/에디터 페이지 생성 → 9장 표 B 매핑대로 HTML 마크업, JSONModel → JS 상태객체
├─ ws_usp_01.js       ← 트리 이동·패턴 메뉴·New Window(IPC) 로직 유지, UI 호출부만 교체
├─ ws_usp_util.js     ← 패턴 메타/파일 I/O 유틸 (Node fs) — 9장 표 A, 그대로 유지
├─ usp.html(또는 셸)  ← USP 페이지 HTML 뼈대 (UI5 제거), 트리·툴바·패널·다이얼로그
├─ css/
│  └─ usp.css         ← 셸 컴포넌트 CSS, theme/tokens.css 의 var(--*)만 소비 (hex/하드코딩 0)
└─ monaco/            ← iframe 격리 영역 (그대로 유지)
   ├─ index.html      ← Monaco loader/init, getMonacoLanguage 등 — 9장 표 A
   └─ index.js        ← 스니펫·테마 register/define — Monaco 자체 API (셸 토큰 미사용)

www/ws30/ws10_20/theme/   ← 12번 문서 6.1 산출물 (선행 또는 병행)
├─ tokens.css  ├─ shell.css  ├─ theme-api.js  └─ themes/*.css
```

> USP 화면의 **셸 CSS(`usp.css`)** 는 `theme/tokens.css` 토큰을 소비한다. 테마 시스템(12번 6장)이 아직 없으면 토큰 계약(12번 6.2)을 먼저 세운 뒤 진행한다. **`monaco/` 하위는 셸 토큰을 소비하지 않으며**, 에디터 구문강조 색은 Monaco 테마 JSON + Monaco API 로만 결정된다.

### 10.2.1 기능 동등성 — 기능 인벤토리 (전수 보존)

> **원칙**: 본 컨버전은 외형(마크업·테마)뿐 아니라 **기존 화면의 모든 동작을 빠짐없이 동등하게** 재현해야 한다(행동 기준). UI5 → HTML5 교체 과정에서 임의 단순화·생략·"나중에" 처리는 금지한다. 아래 카테고리를 **전수 목록화**하고, 각 항목을 `기존 동작 → HTML5 구현 위치 → 검증`으로 매핑한다. **단, Monaco 엔진 내부 동작(구문강조·자동완성 렌더·편집 알고리즘 등)은 Monaco 유지 영역**(9장 표 A·4.1 iframe 격리)이며, 여기서 보존 대상은 **셸/USP 호스트 동작**(트리·툴바·패널·다이얼로그·postMessage 계약 등)이다.

**전수 목록화 카테고리** (누락 시 컨버전 미완):

- **이벤트** — 트리 Row 클릭/더블클릭/우클릭, 버튼 press, ComboBox 변경, 스플리터 드래그·더블클릭, iframe onload, Panel 토글, 다이얼로그 확인/취소 등.
- **단축키** — 에디터/화면 키 바인딩(예: Pretty Print `Shift+F1`) 및 기존에 동작하던 모든 가속키.
- **검증** — 노드 생성/Rename 시 동명 체크·유효성(`_fnCheckCreateNodeData`), 저장 가능 조건, 필수값 체크 등.
- **상태** — Display/Change 모드, 변경 플래그(`IS_CHAG`), 선택 상태(`ISSEL`)·하이라이트, Full Screen 토글, Split Orientation, Panel 접힘/펼침, 전역 인덱스(`gSelectedTreeIndex`)·더블클릭 히스토리(`gaDblClickHistory`).
- **서버분기** — 파일 열기/저장/활성화/Rename/삭제 Ajax 응답의 성공·실패·버전 조건부(예: `UHAK900763` 멀티파트, `usp_head_data_Length` 헤더 분리) 분기.
- **엣지케이스** — 루트/폴더/파일 노드별 컨텍스트 메뉴 가시성·활성화, 빈 트리, 저장 실패 시 `flashFrame`, 확장자 없는 파일, 좌측 에디터 `0px` 초기 숨김 등.
- **상호작용** — 부모 ↔ iframe `postMessage`(actcd) 계약, MessageChannel 포트 양방향, 컨텍스트 메뉴 CustomEvent 전파, IPC New Window.

**이 문서(WS30 USP·코드에디터) 구체 예시 — 기능 인벤토리 매핑표** (산출물; 누락 0):

| # | 기존 동작 | HTML5 구현 위치 | 검증 |
|---|-----------|----------------|------|
| 1 | **소스 트리 선택·렌더** — Row 더블클릭/선택 → `fnUspTreeTableRowSelect` → 파일 요청, `ISFLD`/`EXTEN` 기반 SVG 아이콘 렌더, `ISSEL` 행 하이라이트(RowSettings + 직접 CSS), expand/collapse | `ws_usp.js` 트리 `render*()`(재귀 `<ul>/<li>`), 9장 표 B TreeTable 행, 3.2·3.4절 | 더블클릭 시 파일 열림·아이콘 정확·선택 행 하이라이트·펼침/접힘 모두 기존과 동일 |
| 2 | **Monaco 저장/구문체크 흐름** — Save press → `ev_pressSaveBtn` → FormData(`APPDATA`+Blob) → `/usp_save_active_appdata`(#save/#active) → `_fnSaveCallback`(성공 Footer 메시지·`IS_CHAG` 초기화 / 실패 `flashFrame`) | `ws_usp.js` Save 버튼 핸들러(호출부 유지), 7.2·10.4 불변 제약 | 저장 성공/실패 Footer 메시지·변경 플래그 초기화·실패 플래시가 기존과 동일 |
| 3 | **단축키** — Pretty Print `Shift+F1`(`ws30_codeeditor_prettyBtn`) 및 기존 에디터 가속키 | 셸 키 핸들러(`keydown`) + 에디터 명령은 Monaco 영역 위임, 2.5절 | 동일 키 입력 시 동일 동작(Pretty Print 등) 발생 |
| 4 | **서버 응답 분기** — 파일 열기 응답의 버전 조건부 멀티파트 파싱(`UHAK900763`)·`usp_head_data_Length` 헤더/컨텐츠 분리·`JSON.parse` 실패 처리 | `ws_usp.js` `_fnLineSelectCb`(흐름 그대로 유지), 7.1·10.4 | 구/신 버전 응답 모두 정상 파싱, 오류 응답 시 기존과 동일 처리 |
| 5 | **ComboBox 에디터 테마 선택 → Monaco API** — 테마 선택 → 개인화 저장(`FS.writeFileSync .../select_theme.json`) → `postMessage{actcd:'applyTheme'}` → iframe 내 `defineTheme`/`setTheme` | `<select>`+`<optgroup>`(9장 표 B), 4.4 테마 경계 분리 — 셸 토큰 무관, Monaco 영역 유지 | 테마 선택 시 개인화 저장·Monaco 구문강조 변경, 셸 테마와 독립 |
| 6 | **iframe `postMessage` 명령(actcd) 계약** — `init`/`setValue`/`language_change`/`applyTheme`/`snippet_change`, MessageChannel 포트 양방향, 컨텍스트 메뉴 CustomEvent 전파 | `ws_usp.js`/`ws_usp_01.js` 호출부 유지(9장 표 A), 4.2·4.5·5.2 | 각 actcd 명령·포트 통신·우클릭 메뉴가 기존과 동일하게 동작 |

> **수용 기준**: 위 카테고리·예시를 포함하여 기존 화면이 제공하던 **이벤트·단축키·검증·상태·서버분기·엣지케이스·상호작용**을 전수 목록화하고 매핑했을 때 **인벤토리 누락 0**. Monaco 엔진 내부 동작은 보존 대상이 아니라 **유지 영역**으로 분류(9장 표 A)하되, 그 호출부(postMessage/포트/iframe)는 인벤토리에 포함한다.

### 10.3 작업 순서 (각 단계 = 입력 → 산출 → 수용 기준)

1. **Electron/Node 자원 보존 확인** — 9장 표 A 의 자원(`FS.readFileSync/writeFileSync/readdirSync`, `@electron/remote`, IPC New Window, `sendAjax`, MessageChannel, `WSUTIL`/`PATHINFO`, 패턴 txt 파일)은 **호출부를 그대로 유지**. UI 레이어만 교체. 수용: 표 A 항목 코드 변경 0건.
2. **UI5 → HTML5 마크업 교체** — 9장 표 B 매핑대로 `sap.m.Page`/`OverflowToolbar`/`Splitter`/`NavContainer`/`Panel`/`Dialog` 등 → HTML 요소. **소스 트리(`sap.ui.table.TreeTable`)** 는 재귀 `<ul>/<li>`(또는 경량 트리 라이브러리)로 재구현(우클릭 메뉴·expand/collapse·ISSEL 하이라이트 포함). 수용: 화면에서 UI5 컨트롤(`sap.m.*`/`sap.ui.table.*`) 미생성.
3. **모델 → 상태객체/렌더 분리** — `/WS30/USPTREE`·`/WS30/USPDATA`·패턴/컨텍스트 메뉴 JSONModel 바인딩 → JS 상태객체 + `render*()` 함수. 수용: 트리/패널/메뉴 모델 변경 시 DOM 동기화 동작.
4. **셸 테마 토큰 소비** — 모든 셸 크롬의 색·radius·shadow 를 `theme/tokens.css` 의미 토큰(12번 6.2)으로. 수용: `usp.css` 내 hex 색상·하드코딩 radius·shadow **0건**(grep 검증) **+ 12번 6.6 체크리스트 표면**(스크롤바·소스 트리 expand/선택·드롭다운 펼침·focus 링·hover/disabled·placeholder·오버레이 등) 전수 토큰화. Monaco 에디터 내부는 제외(별도 체계).
5. **셸 테마 전환 연동 + Monaco 테마 분리** — 셸 테마는 `applyTheme` 대신 `U4ATheme.apply(name)`(12번 5.2)로 전환. **Monaco 에디터 내부 테마는 변경하지 않고 Monaco 자체 API**(`postMessage{actcd:'applyTheme'}` → `monaco.editor.defineTheme`/`setTheme`)**를 유지**한다. 수용: 셸 테마 전환 시 툴바/트리/패널 색은 함께 바뀌지만, Monaco 에디터 구문강조는 사용자가 ComboBox(2.5)에서 고른 값을 유지(상호 독립).
6. **텍스트 비하드코딩** — 화면 문구·메뉴 텍스트·Footer 메시지는 메시지 키(JS 객체/JSON fetch, 또는 기존 `WSUTIL` 메시지 함수)로. 수용: 화면 문구 하드코딩 없음.

### 10.4 불변 제약 (반드시 보존)

- **코드에디터 서버 흐름 불변** — 파일 열기(`/usp_get_object_line_data`), 저장/활성화(`/usp_save_active_appdata`), Rename(`/usp_rename_node`), 삭제 등 Ajax 흐름과 멀티파트/헤더 분리 파싱(7장)을 건드리지 않는다. UI만 교체.
- **Monaco 인스턴스/테마 API 유지** — `monaco.editor.create`, `registerCompletionItemProvider`, `defineTheme`/`setTheme`, `executeEdits`, iframe 격리 구조, MessageChannel 통신은 전량 유지(9장 표 A). **에디터 내부 테마는 Monaco API 가 단일 출처**다(셸 토큰 침투 금지).
- **셸 테마는 12번 문서 단일 출처** — 셸 크롬 색/모양은 토큰만 소비, 하드코딩·드리프트 금지. Monaco 내부 색은 12번 토큰 대상이 아니다.
- **Electron/Node 자원 전부 유지** — `FS` 기반 패턴/P13n 테마·스니펫 파일 I/O, SVG 아이콘 로드, `@electron/remote`, IPC New Window. 9장 표 A 그대로.
- **기능 동등성** — 기존 기능·이벤트·단축키·검증·상태·서버분기·엣지케이스를 빠짐없이 동등 재현(행동 기준). 임의 단순화·생략 금지(10.2.1 기능 인벤토리). 단 Monaco 엔진 내부 동작은 보존 대상이 아니라 **그대로 유지하는 영역**(9장 표 A·4.1)이며, 그 호출부(postMessage/포트/iframe)는 동등 재현 대상이다.

### 10.5 AI 실행 프롬프트

```text
너는 U4A Workspace 의 WS30 USP 코드에디터 화면을 HTML5 로 컨버전하는 AI다.

참조 문서:
- .analy/04_WS30_USP_코드에디터.md (이 문서) — 1~7장 기능/모델, 9장 UI5→HTML5 매핑(표 A 유지/표 B 교체), 10장 실행 사양, 4.4 테마 경계 분리
- .analy/12_테마_컨버전_전략.md — 셸 크롬 테마 토큰 계약/전환 API/불변 제약
현행 구현(기준): www/ws30/ws10_20/js/usp/ (ws_html5_usp.js 외)  ← 지금 도는 코드를 먼저 읽는다

원칙:
- Electron/Node 자원(9장 표 A: FS 파일 I/O, @electron/remote, IPC New Window, sendAjax, MessageChannel, WSUTIL/PATHINFO, 패턴 txt)은 호출부를 그대로 유지한다. UI 레이어만 교체한다.
- 코드에디터 서버 흐름(파일 열기/저장/활성화/Rename/삭제 Ajax, 멀티파트 파싱)은 변경하지 않는다.
- UI5 컨트롤은 9장 표 B 매핑대로 HTML 요소로 교체하고, 소스 트리(sap.ui.table.TreeTable)는 재귀 트리로 재구현한다. JSONModel 바인딩은 JS 상태객체 + render 함수로 바꾼다.
- 테마는 두 축으로 분리한다:
  · 셸 크롬(툴바/트리/패널/다이얼로그/Footer) = 12번 문서 theme/tokens.css 의미 토큰만 소비, U4ATheme.apply(name) 로 전환. hex 하드코딩·색 드리프트 금지.
  · Monaco 에디터 내부 구문강조 테마 = Monaco 자체 API(defineTheme/setTheme) 유지. 셸 토큰을 iframe 안으로 침투시키지 않는다. 셸 테마 전환과 Monaco 테마 선택은 독립적으로 동작한다.
- 화면 문구·메뉴 텍스트·Footer 메시지는 메시지 키로 처리하고 하드코딩하지 않는다.
- 기능 동등성: 기존 화면의 기능·이벤트·단축키·검증·상태·서버분기·엣지케이스·상호작용을 빠짐없이 동등하게 재현한다(행동 기준). 임의 단순화·생략 금지. 단 Monaco 엔진 내부 동작은 그대로 유지하는 영역이고, 그 호출부(postMessage/포트/iframe)는 동등 재현 대상이다(10.2.1).

작업: 10.2 파일 트리를 10.3 순서대로 산출하고 각 단계 수용 기준을 충족시킨 뒤, 10.4 불변 제약 위반이 없는지 self-check 한다. self-check 에 "기능 인벤토리(10.2.1) 누락 0" 을 포함한다.
```

---

*본 문서는 실제 소스 코드 분석 기반으로 작성되었으며, 추측 내용을 포함하지 않는다.*
