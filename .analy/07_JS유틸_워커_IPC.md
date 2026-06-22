# 07. JS 유틸리티 / 모듈 / 워커 / IPC / 브로드캐스트 분석

> 대상 프로젝트: U4A Workspace v3.6.3  
> 분석 기준 브랜치: analysis  
> 작성일: 2026-06-09

---

## 1. 개요

이 문서는 U4A Workspace(Electron + SAP UI5 기반 데스크톱 IDE)의 렌더러 프로세스 내
JS 유틸리티·워커·IPC·브로드캐스트 영역 전체를 실제 소스 코드 기반으로 분석한다.

주요 관심사:
- **Web Worker** 3종: 클라이언트 세션 타임아웃, 서버 세션 유지, 즐겨찾기 아이콘 저장
- **IPC 채널**: Electron `ipcMain` / `ipcRenderer` 기반 프로세스간 통신
- **BroadcastChannel**: 동일 세션 내 자식 창들 간 Busy 상태 동기화
- **UAI(U4A AI Interface)**: Named Pipe(`net` 모듈)를 통한 AI 서버 통신
- **개발자 도구 유틸**: DevSourceFinder, DevBrowser(Puppeteer 래핑)
- **공통 유틸**: dateformat, download, shortcut, IndexedDB(미완성), keybindingPopup

---

## 2. Web Workers (3개)

### 2-1. u4aWsClientSessionWorker.js

**파일 경로**: `www/ws30/ws10_20/js/workers/u4aWsClientSessionWorker.js`

| 항목 | 내용 |
|------|------|
| 목적 | 클라이언트(브라우저) 세션 타임아웃 감시 |
| 메시지 입력 | 숫자값(분 단위 세션 타임 — ex. `30`이면 30분) |
| 동작 원리 | 받은 분값을 밀리초로 변환(`분 * 60 * 1000`) 후 `setTimeout` 등록. 이전 타이머 존재 시 `clearTimeout`으로 초기화 후 재등록 |
| 메시지 출력 | 타이머 만료 시 `postMessage('X')` — 세션 만료 신호 |
| 종료 조건 | 외부에서 `Worker.terminate()` 호출 |
| Electron 종속 여부 | 없음 (순수 Web Worker 표준 코드) |

**메시지 프로토콜**:
```
메인 → 워커: (Number) 타임아웃 분 값  예) 30
워커 → 메인: 'X'  (세션 만료)
```

---

### 2-2. u4aWsServerSessionWorker.js

**파일 경로**: `www/ws30/ws10_20/js/workers/u4aWsServerSessionWorker.js`

| 항목 | 내용 |
|------|------|
| 목적 | SAP 서버 세션을 10분마다 더미 HTTP POST 요청으로 유지 |
| 메시지 입력 | `{ SERVPATH: string, USERINFO: object }` — 서버 경로 및 사용자 정보 |
| 동작 원리 | `setInterval`(10분 = `10 * 60 * 1000` ms)로 `sendAjax()` 반복 호출. `XMLHttpRequest`로 POST 요청 전송. 최초 설정 시 즉시 1회 실행(`this.sendAjax(sServerPath)`) |
| 메시지 출력 | `postMessage({ RETCD: "E", RTMSG: "..." })` — 세션 만료 또는 연결 실패 |
| 종료 조건 | 외부에서 `Worker.terminate()` 호출, 또는 서버 응답 TYPE="E"(ACTCD="002") |
| Electron 종속 여부 | 없음 (XMLHttpRequest는 표준 Web API) |

**메시지 프로토콜**:
```
메인 → 워커: { SERVPATH: "/sap/bc/...", USERINFO: { ID, PW, CLIENT, LANGU } }
워커 → 메인: { RETCD: "E", RTMSG: "connection fail!" }  (오류 시)
```

---

### 2-3. u4aWsFavIconWorker.js

**파일 경로**: `www/ws30/ws10_20/js/workers/u4aWsFavIconWorker.js`

| 항목 | 내용 |
|------|------|
| 목적 | 아이콘 즐겨찾기(RATVAL=1 필터) 목록을 JSON 파일로 저장 |
| 메시지 입력 | `{ aIcons: Array, sSaveFilePath: string }` |
| 동작 원리 | Node.js `fs` 모듈(`require("fs")`)로 파일 존재 여부 확인 후 `writeFileSync` 실행. `RATVAL == 1`인 항목만 필터링하여 저장 |
| 메시지 출력 | 성공: `postMessage('S')`, 실패: `postMessage('E')` + `throw Error` |
| 종료 조건 | 저장 작업 완료 후 자동 종료 (1회성 처리) |
| **Electron 종속 여부** | **높음**: `require("fs")`는 Electron 렌더러의 Node.js 통합에 의존. 순수 Web Worker에서는 동작 불가 |

**메시지 프로토콜**:
```
메인 → 워커: { aIcons: [{ICON_SRC, RATVAL, ...}, ...], sSaveFilePath: "C:/Users/.../fav.json" }
워커 → 메인: 'S' (성공) | 'E' (실패)
```

---

## 3. IPC 핸들러

### 3-1. CLIpcHandler (ipc-handler/index.js)

**파일 경로**: `www/ws30/ws10_20/js/utils/ipc-handler/index.js`

Electron `@electron/remote`로 `ipcMain`과 `ipcRenderer` 양쪽에 접근하는 **단방향 IPC 래퍼 클래스**.

```
Renderer ─ipcRenderer.send()─▶ Main ─ipcMain.on()─▶ Renderer(broadcast)
```

| 메서드 | 설명 |
|--------|------|
| `command(channel, params)` | `ipcRenderer.send(channel, { params })` 래핑 (단방향 전송) |
| `on(channel, handler)` | `ipcMain.on()` 래핑. 중복 등록 방지(`handlerMap` 사용). 메시지 포맷 언패킹(`{ params }`) 후 핸들러 호출 |
| `once(channel, handler)` | `ipcMain.once()` 래핑. 실행 후 자동 해제 |
| `off(channel, handler)` | `ipcMain.removeListener()` + `handlerMap` 정리 |
| `eventNames()` | 현재 등록된 모든 채널명 반환 |

**특징**: 인스턴스별 `handlerMap(Map)`으로 핸들러를 격리 관리하여 복수 인스턴스 간 충돌 방지.

---

### 3-2. ws_fn_ipc.js — 채널 목록

**파일 경로**: `www/ws30/ws10_20/js/ipc/ws_fn_ipc.js`

| IPC 채널명 | 등록/해제 API | 핸들러 함수 | 용도 |
|-----------|--------------|------------|------|
| `if-exam-move` | `IPCMAIN.on/off` | `fnIpcMain_if_exam_move` | Exam 팝업의 WorkBench 이동(앱 실행 또는 WS20 이동) |
| `if-browser-close` | `IPCMAIN.on/off` | `fnIpcMain_if_browser_close` | 다중 창 닫기 조정(ACTCD A/B/C) |
| `if-dragEnd` | `IPCMAIN.on/off` | `fnIpcMain_if_DragEnd` | 전체 브라우저 드래그 종료 동기화 |
| `if-browser-interconnection` | `IPCMAIN.on/off` | `fnIpcMain_browser_interconnection` | 브라우저 간 통신(PRCCD 01~04, assist 동적 로딩) |
| `if-get-sys-info-{BROWSKEY}` | `IPCMAIN.on/off` | `fnIpcMain_if_get_sys_info` | 시스템/접속 정보 요청(sys_info_assist.js 동적 실행) |
| `if-send-action-{BROWSKEY}` | `IPCMAIN.on/off` | `fnIpcMain_if_send_action` | 액션코드별 명령 실행(send_action_assist.js 동적 로딩) |
| `if-p13n-themeChange-{SYSID}` | `IPCMAIN.on/off` | `fnIpcMain_if_p13n_themeChange` | 테마 개인화 변경(`p13n/theme/{SYSID}.json` 읽어 테마 적용). 테마 적용 방식은 [12_테마_컨버전_전략.md](12_테마_컨버전_전략.md) 따름 — 채널명·파일 계약은 불변 유지, 실제 `applyTheme` 호출만 `U4ATheme.apply()` shim 으로 대체 |
| `if-session-time` | `IPCMAIN.off` (해제만) | `fnIpcMain_if_session_time` | 세션 타임아웃 Worker 시작 트리거 |
| `if-dev-browser` | `IPC_HANDLER.on/off` | `fnIpcMain_if_dev_browser` | 개발 브라우저 모듈 실행 (dev_browser/index.js 로딩) |

> **`if-p13n-themeChange-{SYSID}` 는 "전 창 브로드캐스트" — 테마를 보여주는 모든 창/팝업이 직접 구독해야 한다(필수).**
> - 동작: 테마를 적용한 창이 `ipcRenderer.send("if-p13n-themeChange-"+SYSID, {THEME, BGCOL})` 로 보내면, **각 창·팝업이 `REMOTE.require('electron').ipcMain.on(...)`(=remote ipcMain) 으로 같은 채널을 구독**하고 있다가 받아 `U4ATheme.apply(THEME)` + `--boot-bg` removeProperty 로 즉시 반영한다. remote ipcMain 리스너라 한 send 가 전 렌더러로 퍼지는 브로드캐스트가 된다. 메인 셸=`ws_fn_ipc.js fnIpcMain_if_p13n_themeChange`, 별도창 팝업들=각자 `_onIpcMain_if_p13n_themeChange`.
> - ⚠️ **새 HTML5 BrowserWindow 팝업은 이 "수신" 구독을 빠뜨리기 쉽다.** `send`(적용 시 알림)만 있고 `IPCMAIN.on` 구독이 없으면 **그 팝업만** 다른 창의 테마변경에 반응하지 않는다(같은 SYSID 두 창에서 각각 옵션 팝업을 띄우고 한쪽서 바꿔도 다른쪽이 안 바뀜 — 2026-06-22 신 옵션팝업 `optionMain.js` 누락 사례). 수신 시 `sOrigTheme`(되돌림 기준)도 새 테마로 갱신해 Close 가 옛 테마로 되돌리지 않게 한다.
> - ⚠️ **리스너 해제 필수**: remote ipcMain 리스너는 창 파괴 후에도 메인에 남아 다음 브로드캐스트 때 죽은 콜백 호출로 오류난다. `window` `beforeunload`(모든 닫힘 경로 커버)에서 `IPCMAIN.off` 한다. 별도창 공통 체크리스트는 [16_공통_화면UX_표준.md](16_공통_화면UX_표준.md)·skin/shell + ServerList 레퍼런스 참고.

**if-browser-close ACTCD 상세**:

| ACTCD | 동작 |
|-------|------|
| `A` | 같은 세션키의 나를 제외한 나머지 모든 창 닫기 |
| `B` | 지정된 BROWSKEY인 창만 닫기 |
| `C` | 로그오프 시 브라우저 키 수집 → 전체 종료 조율 |

**if-browser-interconnection PRCCD 상세**:

| PRCCD | 동작 |
|-------|------|
| `01` | 같은 SYSID+CLIENT 브라우저에 Illust 팝업 열기 |
| `02` | 같은 SYSID+CLIENT 브라우저의 Illust 팝업 닫기 |
| `03` | 같은 SYSID+CLIENT 브라우저의 Illust 팝업 메시지 변경 |
| `04` | 전체 브라우저 강제 닫기 |
| 기타 | `browser_interconnection_assist.js` 동적 `import()` 후 PRCCD 함수 실행 |

---

### 3-3. Assist 모듈 (ipc/assist/)

#### browser_interconnection_assist.js
`export function MONACO_SNIPPET_CHANGE(oEvent, oRes)` 1개 함수 제공.  
USP(Universal Source Panel) 전체 모나코 에디터에 `snippet_change` PostMessage 전송.

#### send_action_assist.js
IPCRENDERER를 통해 `if-send-action-{BROWSKEY}` 채널로 전달된 ACTCD별 처리:

| export 함수 | ACTCD | 동작 |
|------------|-------|------|
| `SETBUSYLOCK` | `SETBUSYLOCK` | 메인 스코프 Busy+Lock 설정/해제(`oAPP.common.fnSetBusyLock`) |
| `BROAD_BUSY` | `BROAD_BUSY` | BroadcastChannel(`oMainBroad`)으로 자식 창에 Busy 상태 전파 |

#### sys_info_assist.js
`if-get-sys-info-{BROWSKEY}` 채널의 PRCCD별 처리 (CJS `module.exports` 방식):

| export 키 | 용도 |
|-----------|------|
| `USER_LOGIN_INFO` | `parent.process.USERINFO` 반환 |
| `USER_INFO` | `parent.getUserInfo()` 반환 |
| `THEME_INFO` | `parent.getThemeInfo()` 반환 |
| `SERVER_HOST` | `parent.getHost()` 반환 |
| `SERVER_PATH` | `parent.getServerPath()` 반환 |

모두 `oEvent.sender.send(oPARAM.TO_CHID, 데이터)` 방식으로 응답(reply-to 패턴).

---

### 3-4. ipc/dev_browser/index.js

**파일 경로**: `www/ws30/ws10_20/js/ipc/dev_browser/index.js`

`if-dev-browser` 채널을 통해 전달된 `oPARAM`을 기반으로 개발 브라우저 관련 프로세스 처리:

| PRCCD | 함수 | 동작 |
|-------|------|------|
| `SELECT_DESIGN_TREE` | `PRCCD_ACTIONS.SELECT_DESIGN_TREE` | 개발 브라우저에서 클릭한 컨트롤을 WS20 디자인 트리에서 선택 표시 |

세션 키·시스템 ID·브라우저 키를 교차 검증 후 실행하여 다중 창 혼선 방지.

---

## 4. 브로드캐스트 채널 (ws_fn_broad.js)

**파일 경로**: `www/ws30/ws10_20/js/broadcast/ws_fn_broad.js`

**목적**: 메인 Workspace 창이 자식 창(Child Window)들에게 UI 상태를 단방향으로 전파.

```javascript
oAPP.attr.oMainBroad = new BroadcastChannel(`broadcast-to-child-window_${parent.getBrowserKey()}`);
```

채널명 패턴: `broadcast-to-child-window_{BROWSERKEY}` — 브라우저 인스턴스별 격리.

| PRCCD | 동작 |
|-------|------|
| `BUSY_ON` | `parent.setBusy("X")` 호출. TYPE="DIALOG"이면 제목/설명 포함 Busy Dialog 표시 |
| `BUSY_OFF` | `parent.setBusy("")` 호출 |

**Electron 종속 여부**: 없음. `BroadcastChannel`은 Web 표준 API로 웹 컨버전 시 그대로 사용 가능.

---

## 5. 설정/테마 공통 모듈

### 5-1. ws_settings.js

**파일 경로**: `www/ws30/ws10_20/js/common_modules/ws_settings.js`

```javascript
// 내용 요약
var REMOTE = require('@electron/remote');
// ... PATHINFO.WSSETTINGS 경로의 JSON을 require()로 로딩
module.exports = () => {
    return require(sSettingsJsonPath); // 설정 JSON 반환
};
```

| 항목 | 값 |
|------|---|
| 저장 위치 | `PATHINFO.WSSETTINGS` 경로의 JSON 파일 (Electron 앱 경로 내) |
| 접근 방식 | `@electron/remote` → `app.getAppPath()` → `pathInfo.js` → 파일 경로 해석 → Node.js `require()` |
| 반환값 | 설정 JSON 객체 |

---

### 5-2. ws_themeInfo.js

**파일 경로**: `www/ws30/ws10_20/js/common_modules/ws_themeInfo.js`

ws_settings.js와 완전히 동일한 구조. 동일하게 `PATHINFO.WSSETTINGS`를 참조한다.  
(두 파일이 현재 같은 로직을 공유 — 실제 테마 전용 경로는 `if-p13n-themeChange` 핸들러에서 `p13n/theme/{SYSID}.json` 별도 파일 사용)

---

## 6. IndexedDB 유틸 (indexdb/indexdb.js)

**파일 경로**: `www/ws30/ws10_20/js/utils/indexdb/indexdb.js`

**현재 상태**: 구조는 정의되어 있으나 **미완성(구현 미완료)** 상태.

```javascript
class CLIndexDB {
    insert(oParams, fSuccessCallback, fErrorCallback) { /* Promise 반환, 내부 로직 미구현 */ }
    _checkInsertParams(oParams) { /* 미구현 */ }
    read(oParams, ...) { /* 미구현 */ }
    readAll(oParams, ...) { /* 미구현 */ }
    delete(oParams, ...) { /* 미구현 */ }
    deleteAll(oParams, ...) { /* 미구현 */ }
}
module.exports = CLIndexDB;
```

파라미터 구조 (설계 의도):

| 파라미터 키 | 의미 |
|------------|------|
| `DB_NAME` | IndexedDB 데이터베이스 명 |
| `TABLE_NAME` | Object Store(테이블) 명 |
| `DATA` | 삽입/조회 대상 배열 |
| `KEY` | 키 필드 (선택) |

공통 응답 구조: `{ RETCD, ACTCD, PRCCD, ERRCD, RDATA }`

**저장 대상 데이터**: 코드상으로는 범용 클래스 설계이나 실제 저장 대상은 아직 미정의 상태.  
현재 프로젝트에서는 IndexedDB 대신 파일 시스템(Node.js `fs`)을 직접 사용하는 것으로 보임.

---

## 7. 개발자 도구 유틸

### 7-1. DevSourceFinder (utils/devSourceFinder/index.js)

**목적**: [RND 전용] Ctrl+우클릭 시 SAP UI5 컨트롤에서 VS Code 소스 파일로 바로 이동.

| 메서드 | 역할 |
|--------|------|
| `static init(targetWindow)` | 대상 Window에 `contextmenu` 이벤트 리스너 등록. `U4A_WS_LOCAL_ROOT` 환경 변수 미설정 시 비활성화 |
| `static setRunScriptPath(oControl)` | 호출 스택(`new Error().stack`)을 분석, `vscode://file/...` URI를 컨트롤의 커스텀 데이터(`ws-runJsPath`)에 저장 |
| `static _findControlFromElement(el, win)` | UI5 Core로 DOM 요소에서 UI5 컨트롤 인스턴스 탐색 |
| `static _resolveSourcePath(oControl)` | 컨트롤 부모 계층을 순회하며 `ws-runJsPath` 데이터 탐색 |
| `static _openInVsCode(sUri)` | `REMOTE.shell.openExternal(sUri)` — Electron Shell API로 VS Code 딥링크 실행 |

**Electron 종속 요소**: `require('@electron/remote')` 및 `REMOTE.shell.openExternal()`.

---

### 7-2. DevBrowser (utils/dev_browser/)

**목적**: Puppeteer를 통해 SAP UI5 앱 실행 화면을 제어하는 개발 전용 내장 브라우저.

#### CLDevBrowser (lib/core/devBrowser.js)

`EventEmitter` 확장 클래스. `puppeteer-core`와 Node.js `crypto`, `events` 모듈 사용.

| 주요 메서드 | 역할 |
|------------|------|
| `launchPage()` | Puppeteer 브라우저 실행 → 탭 획득 → 스크립트 주입 → URL 로드. `__u4aDevBrowserCallback` 함수 노출(브라우저↔Node.js 통신) |
| `executeScript(sScript)` | Puppeteer `page.evaluate(string)` 실행 |
| `reloadPage()` | 현재 페이지 새로고침 |
| `getBounds()` | CDP 세션으로 현재 창의 bounds 조회 |
| `close()` | 브라우저 및 모든 탭 안전 종료 |

**발행 이벤트(EventEmitter)**:

| 이벤트명 | 트리거 | 데이터 |
|---------|--------|--------|
| `user-action` | 페이지 클릭 등 사용자 액션 | `{ EVTNM, OBJID, IS_CURR_APP }` |
| `extension-message` | Chrome Extension 메시지 수신 | 확장 프로그램 페이로드 |
| `close` | 브라우저 disconnected | 없음 |
| `newtab` | 새 탭 생성 시도(차단됨) | 없음 |
| `console-error` | 콘솔 에러 로그 | `{ type, message }` |
| `framenavigated` | URL 변경 | `{ url }` |
| `pageerror` | JS 런타임 예외 | `{ message, stack }` |
| `requestfailed` | 네트워크 요청 실패 | `{ url, failure, resourceType }` |

#### dev_browser/index.js (모듈 진입점)

IPC 이벤트와 Puppeteer DevBrowser를 연결하는 중간 조정자.

등록하는 IPC 채널 (`CLIpcHandler` 사용):

| 채널명 | 동작 |
|--------|------|
| `naviTo` | 화면 이동 시 모든 DevBrowser 인스턴스 종료 |
| `activate` | 화면 활성화 시 모든 DevBrowser 새로고침 |
| `logoff` | 로그오프 시 모든 DevBrowser 종료 |
| `appModeChange` | Edit 모드 전환 시 모든 DevBrowser 새로고침 |
| `execControllerClass` | 컨트롤러 클래스 실행/종료 시 SideView Busy 상태 동기화 |

**Electron 종속 요소**: `puppeteer-core`(Node.js), `@electron/remote`, `CLIpcHandler`(ipcMain/ipcRenderer).

---

## 8. 키바인딩 (keybindingPopup/index.js)

**파일 경로**: `www/ws30/ws10_20/js/utils/keybindingPopup/index.js`

VS Code 스타일의 단축키 등록 팝업. SAP UI5 Dialog 기반.

**export**: `keyBinding.openKeybindingDialog(sPreShortCut)` — Promise 반환.

| 반환값 | 의미 |
|--------|------|
| `{ ACTCD: "APPLY", RDATA: { keyBinding: "Ctrl+S", autoFocus: true } }` | 단축키 적용 |
| `{ ACTCD: "CANCEL" }` | 취소 |

**주요 로직**:
- `keydown` 이벤트 캡처로 수식자키(Ctrl/Shift/Alt/Meta) 조합 자동 인식
- `buildKeyString(e)` 로 문자열 생성 (예: `Ctrl+Shift+S`)
- 등록 전 중복 단축키 검사 (`checkDuplShortcutKey`) — 변경 데이터 목록과 비교
- `autoFocus` 체크박스: 단축키 실행 시 해당 UI에 포커스 이동 여부 설정
- `Electron 종속 여부`: 없음. 순수 Web API + SAP UI5.

---

## 9. UAI 모듈 (U4A AI Interface)

### 9-1. uai/index.js

**파일 경로**: `www/ws30/ws10_20/js/uai/index.js`

**목적**: Node.js `net` 모듈로 **Windows Named Pipe**(`\\.\pipe\u4a_ai`)를 통해 별도 AI 서버 프로세스와 통신.

**상수**:
- `C_PIPE_NANE = '\\\\.\\pipe\\u4a_ai'` — AI 프로세스 Named Pipe 주소
- `C_AI_CB_WAIT_TIME = 10000` — 응답 대기 타임아웃 10초

**공개 API (`module.exports = AI`)**:

| 메서드 | 역할 |
|--------|------|
| `AI.init()` | WS 레벨 커스텀 이벤트 등록(PRCCD="WS") |
| `AI.setCustomEvent_WS_10()` | WS10 전용 커스텀 이벤트 등록 (중복 방지) |
| `AI.setCustomEvent_WS_20()` | WS20 전용 커스텀 이벤트 등록 (중복 방지) |
| `AI.setCustomEvent_WS_30()` | WS30 전용 커스텀 이벤트 등록 (중복 방지) |
| `AI.connect(oPARAM)` | Named Pipe 연결 후 AI 서버에 CONNECT 요청 전송. Promise 반환 |
| `AI.disconnect(oPARAM)` | AI 서버에 DISCONNECT 요청 전송. 10초 타임아웃. Promise 반환 |

**데이터 흐름**:
```
WS30 (Renderer)
   ↓ CLIENT.write(JSON.stringify(oIF_DATA))
Named Pipe \\.\pipe\u4a_ai
   ↓
AI 서버 프로세스
   ↓ socket.write(JSON.stringify(oIF_DATA))
WS30 CLIENT.on('data')
   ↓ CustomEvent dispatch (PRCCD 키로 라우팅)
PRC_MODULES/{PRCCD}/index.js
```

**오류 코드 체계**:

| 코드 | 의미 |
|------|------|
| `AI-CONNECT-E998` | AI 서버 미실행 |
| `AI-CONNECT-E002` | 이미 다른 브라우저가 연결됨 |
| `AI-CONNECT-E999` | 응답 타임아웃 |
| `AI-DISCONNECT-E001` | 미연결 상태에서 disconnect 시도 |
| `AI-DISCONNECT-E999` | disconnect 응답 타임아웃 |

**Electron 종속 요소**: `require("net")` — Node.js 내장 모듈, Electron 렌더러의 Node.js 통합에 의존.

---

### 9-2. PRC_MODULES — 구조 및 역할

**경로**: `www/ws30/ws10_20/js/uai/PRC_MODULES/`

동적 require 기반 모듈 라우팅 패턴: `PRC_MODULES/{PRCCD}/{ACTCD}/index.js`

#### WS/ (AI 연결 관리)
| 모듈 경로 | PRCCD | ACTCD | 역할 |
|----------|-------|-------|------|
| `WS/index.js` | `WS` | — | PRCCD+ACTCD로 하위 모듈 동적 require 라우팅 |
| `WS/CONNECT_RESULT/index.js` | `WS` | `CONNECT_RESULT` | CB_ID로 등록된 커스텀 이벤트 dispatch (connect 응답 전달) |
| `WS/DISCONNECT_RESULT/index.js` | `WS` | `DISCONNECT_RESULT` | disconnect 응답 콜백 전달 (구조 동일) |
| `WS/TEST/index.js` | `WS` | `TEST` | 테스트용 |

#### WS_10/ (앱 실행 화면 관련)
| 모듈 경로 | ACTCD | 역할 |
|----------|-------|------|
| `WS_10/index.js` | — | ACTCD로 하위 모듈 라우팅 |
| `WS_10/APP_DISPLAY/index.js` | `APP_DISPLAY` | AI가 요청한 앱을 WS10에서 표시 모드로 오픈. 현재 페이지 상태(WS10/WS20)에 따라 분기 처리 |
| `WS_10/APP_EXECUTE_VIA_BROWSER/index.js` | `APP_EXECUTE_VIA_BROWSER` | AI가 요청한 앱을 WS10에서 브라우저 실행 모드로 실행 |

#### WS_20/ (디자인 영역 관련)
| 모듈 경로 | ACTCD | 역할 |
|----------|-------|------|
| `WS_20/index.js` | — | ACTCD로 하위 모듈 라우팅 |
| `WS_20/GEN_U4A_APP/index.js` | `GEN_U4A_APP` | AI가 파싱한 앱 데이터(`EXTRACTED_U4A_DATA`)를 WS20 디자인 영역에 적용. `parseAiLibraryData.js` 실행 |

#### WS_30/
현재 `WS_30/index.js`만 존재하며, 하위 ACTCD 모듈은 없음(빈 라우터 상태).

#### _pattern/
신규 PRC 모듈 작성용 템플릿 파일.

**공통 패턴**: 모든 PRC 모듈은 AI 서버에서 데이터 수신 → `oIF_DATA.PRCCD` 기준 동적 로딩 → UI 조작(SAP UI5 컨트롤 이벤트 fire, Electron 창 제어) 으로 동작.

---

## 10. 범용 유틸 (www/js/)

### 10-1. dateformat.js

**파일 경로**: `www/js/dateformat.js`

`Date.prototype.format(f)` 확장. 포맷 토큰:

| 토큰 | 의미 |
|------|------|
| `yyyy` | 4자리 연도 |
| `yy` | 2자리 연도 |
| `MM` | 2자리 월 |
| `dd` | 2자리 일 |
| `KS`/`KL` | 한국어 요일(짧은/긴) |
| `ES`/`EL` | 영어 요일(짧은/긴) |
| `HH` | 24시간 시 |
| `hh` | 12시간 시 |
| `mm` | 분 |
| `ss` | 초 |
| `a/p` | AM/PM |

`String.prototype.zf(len)`, `Number.prototype.zf(len)` 포함.  
**Electron 종속 여부**: 없음. 순수 JS.

---

### 10-2. download.js

**파일 경로**: `www/js/download.js`  
출처: dandavis/download.js v4.2 (CCBY2)

`window.download(data, fileName, mimeType)` — 브라우저 기반 파일 다운로드.

지원 방식 (우선순위 순):
1. `a[download]` HTML5 속성 (Chrome, Firefox)
2. `navigator.msSaveBlob` (IE10+)
3. `Blob + URL.createObjectURL`
4. dataURL iframe fallback (구버전)

AMD/CommonJS/전역 모두 지원. **Electron 종속 여부**: 없음.

---

### 10-3. shortcut.js

**파일 경로**: `www/js/shortcut.js`  
출처: openjs.com keyboard_shortcuts v2.01.B (BSD)

전역 `shortcut` 객체:

| 메서드 | 역할 |
|--------|------|
| `shortcut.add(combination, callback, opt)` | 단축키 등록 (예: `"ctrl+s"`) |
| `shortcut.remove(combination)` | 단축키 해제 |

옵션: `type`(이벤트 타입), `propagate`, `disable_in_input`, `target`, `keycode`.  
특수키 매핑(esc/escape/enter/backspace/tab 등) 포함. **Electron 종속 여부**: 없음.

---

### 10-4. 라이브러리 (이름만)

| 파일 | 라이브러리 |
|------|-----------|
| `www/js/jquery.min.js` | jQuery |
| `www/js/jquery-ui.min.js` | jQuery UI |

---

## 11. 파일별 역할 표

| 파일 경로 | 분류 | Electron 종속 | 주요 역할 |
|----------|------|--------------|----------|
| `workers/u4aWsClientSessionWorker.js` | Web Worker | 없음 | 클라이언트 세션 타임아웃 타이머 |
| `workers/u4aWsServerSessionWorker.js` | Web Worker | 없음 | 10분 주기 SAP 서버 세션 유지 XHR |
| `workers/u4aWsFavIconWorker.js` | Web Worker | **높음** (Node.js `fs`) | 즐겨찾기 아이콘 JSON 파일 저장 |
| `utils/ipc-handler/index.js` | IPC 유틸 | **높음** (ipcMain/ipcRenderer) | 단방향 IPC 핸들러 래퍼 클래스 |
| `ipc/ws_fn_ipc.js` | IPC 핸들러 | **높음** (IPCMAIN/IPCRENDERER) | 채널 등록·해제·핸들러 연결 총괄 |
| `ipc/assist/browser_interconnection_assist.js` | IPC 보조 | 없음 | Monaco 스니펫 변경 PostMessage |
| `ipc/assist/send_action_assist.js` | IPC 보조 | 없음 | ACTCD별 Busy/BroadcastChannel 처리 |
| `ipc/assist/sys_info_assist.js` | IPC 보조 | **있음** (process.USERINFO 등) | 시스템 정보 IPC 응답 |
| `ipc/dev_browser/index.js` | IPC 핸들러 | **있음** (CURRWIN, IPCMAIN) | DevBrowser 이벤트 → UI 동작 연결 |
| `broadcast/ws_fn_broad.js` | 브로드캐스트 | 없음 | 자식 창 Busy 상태 동기화 |
| `common_modules/ws_settings.js` | 설정 모듈 | **높음** (@electron/remote, require) | 앱 설정 JSON 파일 로딩 |
| `common_modules/ws_themeInfo.js` | 설정 모듈 | **높음** (@electron/remote, require) | 앱 설정 JSON 파일 로딩 (ws_settings와 동일 구조) |
| `utils/indexdb/indexdb.js` | DB 유틸 | 없음 | IndexedDB CRUD 클래스 (미완성) |
| `utils/devSourceFinder/index.js` | 개발 유틸 | **있음** (REMOTE.shell) | Ctrl+우클릭 → VS Code 소스 이동 |
| `utils/dev_browser/index.js` | 개발 유틸 | **높음** (puppeteer-core, IPC) | 개발 브라우저 모듈 진입점 |
| `utils/dev_browser/lib/core/devBrowser.js` | 개발 유틸 | **높음** (puppeteer-core, Node.js) | Puppeteer 래핑 개발 브라우저 클래스 |
| `utils/keybindingPopup/index.js` | UI 유틸 | 없음 | VSCode 스타일 단축키 등록 팝업 |
| `uai/index.js` | AI 연동 | **높음** (Node.js `net`) | Named Pipe로 AI 서버 통신 |
| `uai/PRC_MODULES/WS/*.js` | AI PRC | **있음** (REMOTE, CURRWIN) | AI 연결/해제 콜백 처리 |
| `uai/PRC_MODULES/WS_10/*.js` | AI PRC | **있음** (REMOTE, CURRWIN) | AI → WS10 앱 표시/실행 |
| `uai/PRC_MODULES/WS_20/*.js` | AI PRC | **있음** (REMOTE, CURRWIN, PATH) | AI → WS20 앱 데이터 파싱/적용 |
| `fnNetworkChecker.js` | 네트워크 | 없음 | online/offline 이벤트 → UI 처리 |
| `www/js/dateformat.js` | 라이브러리 | 없음 | Date.prototype.format 확장 |
| `www/js/download.js` | 라이브러리 | 없음 | 브라우저 기반 파일 다운로드 |
| `www/js/shortcut.js` | 라이브러리 | 없음 | 키보드 단축키 등록/해제 |

---

## 12. HTML5 컨버전 시 고려사항

### 12-1. 핵심 전제: 이 앱은 Electron 데스크톱 앱으로 유지된다

U4A Workspace는 계속 **Electron 데스크톱 앱**으로 운영된다.  
따라서 이 영역에서 분석한 Electron/Node.js 자원—Node Worker, `ipcMain`/`ipcRenderer`, `@electron/remote`, `net` 모듈 Named Pipe, `fs` 모듈 설정파일 저장, `require()` 등—은 **모두 그대로 재사용**한다.

**유일한 컨버전 대상은 SAP UI5로 렌더링된 UI 레이어**다.  
이 문서(07장)에서 다루는 유틸/워커/IPC/모듈 영역은 대부분 UI가 아닌 **로직 및 인프라**이므로, 거의 전부 변경 없이 유지된다.

---

### 12-2. 유지 vs. HTML5 교체 대상 표

#### (A) 그대로 유지 — Electron/Node.js 자원

| 구성 요소 | 파일 | 유지 이유 |
|----------|------|----------|
| **Node.js `fs` 기반 파비콘 워커** | `workers/u4aWsFavIconWorker.js` | Electron 렌더러에서 Node.js `require("fs")` 가 유효함. 파일 저장 방식 변경 불필요 |
| **클라이언트 세션 워커** | `workers/u4aWsClientSessionWorker.js` | 순수 Web Worker 표준 코드. Electron 환경에서 그대로 동작 |
| **서버 세션 유지 워커** | `workers/u4aWsServerSessionWorker.js` | `XMLHttpRequest` 기반 표준 코드. Electron 환경에서 그대로 동작 |
| **IPC 핸들러 래퍼 클래스** | `utils/ipc-handler/index.js` | `@electron/remote`로 `ipcMain`/`ipcRenderer` 접근 — Electron 데스크톱 환경에서 계속 사용 |
| **IPC 채널 전체** (`if-exam-move`, `if-browser-close`, `if-dragEnd`, `if-browser-interconnection`, `if-get-sys-info`, `if-send-action`, `if-p13n-themeChange`, `if-session-time`, `if-dev-browser`) | `ipc/ws_fn_ipc.js` 외 | Electron `ipcMain`/`ipcRenderer` 기반 채널 전부 유지. 대체 불필요 |
| **IPC assist 모듈 3종** | `ipc/assist/` 하위 파일 | BroadcastChannel, process.USERINFO, IPCRENDERER 모두 Electron 환경에서 그대로 동작 |
| **UAI Named Pipe 통신** | `uai/index.js` | Node.js `net` 모듈로 `\\.\pipe\u4a_ai` Named Pipe 연결 — Electron 유지이므로 그대로 재사용 |
| **UAI PRC_MODULES 전체** | `uai/PRC_MODULES/**` | Electron 창 제어·IPC 연계 포함 — Electron 환경에서 그대로 동작 |
| **ws_settings.js / ws_themeInfo.js** | `common_modules/` | `@electron/remote`로 앱 경로 해석 후 `require()`로 JSON 로딩 — Electron 유지이므로 변경 불필요 |
| **IndexedDB 유틸** | `utils/indexdb/indexdb.js` | Web 표준 API. Electron 환경에서 그대로 동작 (현재 미완성 상태는 별개) |
| **DevSourceFinder** | `utils/devSourceFinder/index.js` | `REMOTE.shell.openExternal()`로 VS Code 딥링크 — Electron 환경에서 그대로 동작 |
| **DevBrowser (Puppeteer)** | `utils/dev_browser/` | `puppeteer-core`는 Node.js 종속. Electron 유지이므로 그대로 동작 |
| **BroadcastChannel** | `broadcast/ws_fn_broad.js` | Web 표준 API. Electron 환경에서 그대로 동작 |
| **shortcut.js, dateformat.js, download.js** | `www/js/` | 순수 JS/Web 표준. 변경 불필요 |

---

#### (B) HTML5로 교체할 SAP UI5 요소 — 이 영역에서 UI5를 실제 사용하는 부분만

`grep "new sap\."` 결과, 이 영역(유틸/워커/IPC)에서 SAP UI5 컴포넌트를 실제 사용하는 파일은 다음과 같다:

| 파일 | 사용 중인 UI5 컴포넌트 | HTML5 교체 방향 |
|------|----------------------|----------------|
| `utils/keybindingPopup/index.js` | `sap.m.Dialog`, `sap.m.Input`, `sap.m.CheckBox`, `sap.m.MessageStrip`, `sap.m.VBox`, `sap.m.HBox`, `sap.m.Text`, `sap.m.Title`, `sap.m.Toolbar`, `sap.m.ToolbarSpacer`, `sap.m.Button`, `sap.ui.core.Icon` | 단축키 등록 팝업 전체를 HTML5 `<dialog>` + 네이티브 폼 요소로 재구현. 키 캡처 로직(`keydown` 이벤트, `buildKeyString`)은 그대로 유지 |
| `utils/dev_browser/lib/injector/util.js` | `sap.m.BusyDialog` | 개발 전용 인젝터 내 Busy 표시. `<dialog>` 또는 CSS 오버레이로 교체. 개발 전용이므로 우선순위 낮음 |

**그 외 워커/IPC/UAI/설정·테마/IndexedDB/범용유틸 파일에는 `new sap.` 사용이 없다.**  
이 영역에서 UI5 교체가 필요한 파일은 위 2개뿐이다.

---

### 12-3. 요약

```
[그대로 유지 — Electron/Node.js 자원]
  Node Worker 3종 (클라이언트 세션, 서버 세션, 파비콘 저장)
  IPC 채널 전체 (ipcMain/ipcRenderer, @electron/remote)
  UAI Named Pipe (net 모듈, \\.\pipe\u4a_ai)
  ws_settings / ws_themeInfo (fs 설정 파일 저장)
  IndexedDB 유틸, DevSourceFinder, DevBrowser
  BroadcastChannel, shortcut/dateformat/download

[UI5 → HTML5 교체 대상 — 이 영역에서 UI5 사용처만]
  keybindingPopup/index.js  → <dialog> + 네이티브 폼으로 재구현
  dev_browser/injector/util.js → sap.m.BusyDialog → CSS 오버레이 (개발 전용, 우선순위 낮음)
```

---

## 13. 컨버전 적용 메모

> 이 절은 **설계 산출물**이다. 추후 컨버전 작업 시, AI 는 이 절을 읽고 이 영역의 처리 방침과 보존 의무를 판단한다.

### 13.1 이 영역은 UI5→HTML5 컨버전 대상이 아니다

이 문서가 다루는 워커·IPC·BroadcastChannel·UAI(Named Pipe)·설정/테마 로딩·IndexedDB·범용 유틸은 **UI 레이어가 아니라 로직 및 인프라**다. 02 §9 같은 "AI 컨버전 실행 사양" 템플릿(시안→마크업→토큰)을 이 영역에 적용하지 않는다. 컨버전 대상은 오직 **SAP UI5 로 렌더링된 UI** 뿐이며, 이 영역의 자원은 12장(특히 12-2 (A))에서 정리한 대로 **Electron/Node 자원으로 그대로 유지**된다.

| 구분 | 처리 방침 |
|------|----------|
| **비UI 인프라 전체** (워커 3종 / IPC 핸들러·채널 / BroadcastChannel / UAI Named Pipe / PRC_MODULES / ws_settings·ws_themeInfo / IndexedDB / DevSourceFinder·DevBrowser / dateformat·download·shortcut) | **컨버전 없음.** Electron/Node 자원으로 그대로 유지. UI 문서(01~08)에서 이들을 호출하는 **계약(함수 시그니처·채널명·메시지 구조)을 불변으로 보존**한다 |
| **소수의 UI 접점** (12-2 (B): `keybindingPopup/index.js`, `dev_browser/injector/util.js`) | 해당 파일의 UI5 컨트롤 부분만 HTML5 로 교체(12-2 (B) 매핑). 키 캡처·통신 로직은 유지 |
| **테마 적용 경로** (`if-p13n-themeChange` 핸들러) | 채널명·`p13n/theme/{SYSID}.json` 파일 계약은 불변. `applyTheme` 호출만 [12_테마_컨버전_전략.md](12_테마_컨버전_전략.md) §3.4 `U4ATheme.apply()` shim 으로 대체 |

### 13.2 UI 레이어가 보존해야 할 핵심 계약 (불변)

UI 문서(01~08)가 HTML5 로 컨버전되어도, 이 영역을 호출하는 다음 계약은 **그대로 보존**해야 한다. 시그니처·채널명·메시지 구조가 바뀌면 인프라 연동이 깨진다.

| 계약 영역 | 보존 대상 (불변) | 출처 절 |
|----------|-----------------|---------|
| **세션 타임아웃 워커** | `postMessage(Number 분값)` 입력 / `'X'` 만료 신호 출력 | 2-1 |
| **서버 세션 워커** | `{ SERVPATH, USERINFO }` 입력 / `{ RETCD:"E", RTMSG }` 출력 | 2-2 |
| **파비콘 워커** | `{ aIcons, sSaveFilePath }` 입력 / `'S'`·`'E'` 출력 | 2-3 |
| **IPC 핸들러 API** | `command/on/once/off/eventNames`, `{ params }` 패킹 포맷 | 3-1 |
| **IPC 채널명** | `if-exam-move`, `if-browser-close`(ACTCD A/B/C), `if-dragEnd`, `if-browser-interconnection`(PRCCD 01~04), `if-get-sys-info-{BROWSKEY}`, `if-send-action-{BROWSKEY}`, `if-p13n-themeChange-{SYSID}`, `if-session-time`, `if-dev-browser` | 3-2 |
| **Assist 모듈 키** | `SETBUSYLOCK`·`BROAD_BUSY`(send_action), `USER_LOGIN_INFO`·`USER_INFO`·`THEME_INFO`·`SERVER_HOST`·`SERVER_PATH`(sys_info), reply-to(`TO_CHID`) 패턴 | 3-3 |
| **BroadcastChannel** | 채널명 `broadcast-to-child-window_{BROWSERKEY}`, PRCCD `BUSY_ON`/`BUSY_OFF` | 4 |
| **UAI Named Pipe** | 파이프 주소 `\\.\pipe\u4a_ai`, `AI.init/connect/disconnect` 시그니처, `oIF_DATA.PRCCD` 라우팅, 오류코드 체계(`AI-CONNECT-E998/E002/E999`, `AI-DISCONNECT-E001/E999`) | 9 |
| **PRC 라우팅 규약** | `PRC_MODULES/{PRCCD}/{ACTCD}/index.js` 동적 require 패턴, ACTCD(`CONNECT_RESULT`·`DISCONNECT_RESULT`·`APP_DISPLAY`·`APP_EXECUTE_VIA_BROWSER`·`GEN_U4A_APP` 등) | 9-2 |
| **키바인딩 팝업** | `keyBinding.openKeybindingDialog(sPreShortCut)` Promise 반환, `{ ACTCD:"APPLY"\|"CANCEL", RDATA:{ keyBinding, autoFocus } }` 구조 | 8 |

> 요약: 이 영역은 **컨버전 무대상**이되, UI 레이어가 호출하는 **위 계약은 협정으로 고정**한다. UI5→HTML5 교체는 호출하는 쪽의 렌더링만 바꾸고, 위 시그니처·채널명·메시지 포맷은 한 글자도 바꾸지 않는다.

---

*이 문서는 실제 소스 코드 분석을 기반으로 작성되었으며, 추측 없이 코드에서 확인된 사실만 기재하였다.*
