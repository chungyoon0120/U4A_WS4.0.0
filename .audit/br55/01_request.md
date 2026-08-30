# BR55 검수 요청 (01)

## 이슈 원문 (노션 이슈 리포트 DB, 코드 BR55)
- **화면**: UI 속성 영역 / **분류**: 기능 / **상태**: 접수
- **내용**: 실행(Activate) 예외 점검 실패를 조용히 삼켜 오류 앱이 통과될 여지
- **현상**: `ev_pressActivateBtn` 이 예외 점검 `chkExcepionAttr` 를 `try/catch` 로 감싸, 점검 도중 예외가 나면 **오류 0건으로 간주하고 활성화를 진행**한다(`www/ws30/ws10_20/js/ws_events.js`). 점검 함수 자체는 BR34 로 이식됐으나, 점검 내부(`checkValidProperty` 등)에서 예외가 나면 여전히 검증 없이 "활성화 성공"으로 넘어갈 수 있다.
- **원본**: 원본은 `chkExcepionAttr` 를 감싸지 않고 직접 호출한다(점검 실패 시 활성화도 진행되지 않음).
- **기대**: 점검 실패를 조용히 삼키지 말고 오류코드로 표면화 후 활성화 중단.
- **비고**: BR34 후속. `.claude/rules/code.md` "오류 삼킴·조용한 catch 금지(오류코드+표면화)" 와도 합치.

---

## 1. 검수 대상

| 항목 | 값 |
|---|---|
| 파일 | `www/ws30/ws10_20/js/ws_events.js` |
| 함수 | `oAPP.events.ev_pressActivateBtn` (1512행~) |
| 기능 | WS20 편집화면 상단 툴바 **Activate (Ctrl+F3)** 버튼 → 활성화 전 예외 점검 |
| 백업 | `www/ws30/ws10_20/js/_ws_events.js.br55bak` |
| 문법 | `node --check ws_events.js` 통과 |

참고(변경 없음, 대조용):
- 원본 as-is: `C:\Users\socce\Documents\Github\U4A_WS3.0.0\www\ws30\ws10_20\js\ws_events.js` 1305~1338행 (`ev_pressActivateBtn`), 1157~1169행 (`ev_pressSyntaxCheckBtn`)
- 점검 함수 이식본: `www/ws30/ws10_20/js/ws_html5_ws20_attr.js` 424~482행 (`chkExcepionAttr`), 484~ (`chkExcepUiTable`) — BR34 산출물, 이번에 **손대지 않음**
- 원본 점검 본체: `C:\Users\socce\Documents\Github\U4A_WS_DESIGN\design\js\main.js` 1306행 `chkExcepionAttr`

---

## 2. 원본 대비 현재 상태

### 2-1. 원본 (as-is, ws_events.js 1317행)
```js
let T_excep = oAPP.fn.chkExcepionAttr(),
    iexceplength = T_excep.length;
```
- 감싸지 않는다. 점검이 실패하면 **예외가 그대로 전파돼 이후 저장/활성화 서버 호출에 도달하지 못한다**(fail-closed).
- 오류가 1건 이상이면 `fnMultiFooterMsg(T_excep)` 로 오류 목록 창을 띄우고 `flashFrame(true)` 후 `return`.
  이때 busy 는 **일부러 풀지 않는다**(오류 목록 창이 로드 완료되면 IPC 로 busy 를 끄는 구조 — 원본 주석 명시).

### 2-2. 변경 전 HTML5 (버그)
```js
let T_excep = [];
try {
    if (typeof oAPP.fn.chkExcepionAttr === "function") { T_excep = oAPP.fn.chkExcepionAttr() || []; }
} catch (e) { console.warn("[HTML5][WS20] chkExcepionAttr skip:", e && e.message); }
```
문제 2가지
1. 점검 도중 예외 → `T_excep` 가 빈 배열 그대로 → `iexceplength === 0` → **오류가 있어도 활성화 진행**.
2. 점검 함수가 아예 미정의여도(모듈 미로드) 같은 경로로 **조용히 통과**.

추가로 같은 함수 안에 오류 목록 표시도 빈 catch 로 감싸져 있었다.
```js
try { if (oAPP.fn.fnMultiFooterMsg) { oAPP.fn.fnMultiFooterMsg(T_excep); } } catch (e) { }
```
→ 오류가 있는데 목록 표시가 실패하면 **아무 표시 없이 busy 만 계속 걸린 채 멈춤**(오류 통과는 아니지만 화면 정지).

---

## 3. 변경 요약 (이번 수정)

### 변경 A — 점검 실패 시 활성화 중단 + 오류코드 표면화 (`WS20ACT-CHK01`)
```js
let T_excep = [];
try {
    if (typeof oAPP.fn.chkExcepionAttr !== "function") {
        throw new Error("oAPP.fn.chkExcepionAttr 미정의(예외 점검 모듈 미로드)");
    }
    T_excep = oAPP.fn.chkExcepionAttr() || [];
} catch (e) {
    console.error("[WS20ACT-CHK01] 실행 전 예외 점검(chkExcepionAttr) 실패 — 활성화 중단:", e);
    try { oAPP.common.fnSetBusyLock(""); } catch (e2) { console.error("[WS20ACT-CHK01] busy 해제 실패:", e2 && e2.message); }
    try { parent.showMessage(null, 10, "E", "WS20ACT-CHK01"); } catch (e3) { console.error("[WS20ACT-CHK01] 오류 안내 표시 실패:", e3 && e3.message); }
    return;
}
```
- 원본과 동일한 **fail-closed** 경계 재현: 점검 실패 = 검증 안 된 상태 → 활성화 진행 금지.
- 원본은 예외 전파로 자연히 멈추지만, HTML5 는 진입부에서 `fnSetBusyLock("X")` 로 화면을 잠근 상태라 그대로 전파시키면 **화면이 잠긴 채 남는다** → 중단 갈래에서 busy·Lock 을 명시 원복.
- 점검 함수 미정의(모듈 미로드)도 같은 갈래로 묶음(BR34 이식본이 있으면 정상 환경에서는 타지 않음).
- 화면 안내는 **추적 코드만** 표시. 정식 안내 문구 키는 장군님 지정 대기(임의 문구·키 생성 금지 규칙).

### 변경 B — 오류 목록 표시 실패도 삼키지 않음 (`WS20ACT-CHK02`)
```js
try {
    if (typeof oAPP.fn.fnMultiFooterMsg !== "function") {
        throw new Error("oAPP.fn.fnMultiFooterMsg 미정의(오류목록 표시 모듈 미로드)");
    }
    oAPP.fn.fnMultiFooterMsg(T_excep);
} catch (e) {
    console.error("[WS20ACT-CHK02] 예외 점검 오류목록 표시 실패:", e);
    try { oAPP.common.fnSetBusyLock(""); } catch (e2) { ... }
    try { parent.showMessage(null, 10, "E", "WS20ACT-CHK02"); } catch (e3) { ... }
}
```
- 표시가 죽으면 IPC busy off 가 영영 오지 않으므로 여기서만 busy 를 푼다. 표시가 **성공**하면 원본대로 busy 를 켠 채 return(원본 1:1 유지).
- 흐름은 그대로(예외 없이 표시 성공 시 동작 동일). 오류 목록 표시 실패는 여전히 `return` 후 종료(활성화 진행 안 함).

### 손대지 않은 것
- `ev_pressSyntaxCheckBtn`(1320행)은 이미 원본대로 감싸지 않고 직접 호출 → 변경 없음.
- `chkExcepionAttr` / `chkExcepUiTable` 이식본(ws_html5_ws20_attr.js) 변경 없음. **내부에 삼키는 catch 가 없음을 확인**(원본 1:1) → 내부 예외가 바깥 갈래까지 올라온다.
- `fnChildWindowShow(false)` 의 빈 catch 는 이번 범위 밖(점검 통과 후 자식창 숨기기, 오류 통과와 무관) → 유지.

---

## 4. 검수 포인트 (봐달라는 것)

| # | 항목 |
|---|---|
| 1 | **원본 1:1** — 정상 경로(점검 성공, 오류 0건 / 오류 N건) 동작이 원본과 완전히 같은가? 특히 오류 N건일 때 busy 를 **켠 채** return 하는 원본 규약(오류 목록 창 IPC 가 끔)을 그대로 지켰는지. |
| 2 | **fail-closed 경계** — 점검 실패 시 `save_active_appdata#active` 서버 호출·`fnChildWindowShow(false)`·`IS_ACT` 세팅에 절대 도달하지 않는지. |
| 3 | **busy/Lock 짝** — 새로 만든 두 중단 갈래에서 `fnSetBusyLock("")` 이 정확히 한 번 불리는지, 이중 해제·미해제 없는지. 다른 종료 분기(기존 return)와 겹치지 않는지. |
| 4 | **재진입** — 점검 실패로 중단한 뒤 다시 Activate 를 눌렀을 때 상태가 꼬이지 않는지(busy 다시 걸림, 이전 오류 목록 창 정리). |
| 5 | **다른 호출부 영향** — 저장 후 활성화 경로(`ev_pressSaveBtn` → CTS 팝업 → `ev_pressActivateBtn` 재호출), 단축키 Ctrl+F3 경로에서 새 중단 갈래가 부작용을 만들지 않는지. |
| 6 | **조용한 catch 잔존** — 이 함수 안에 아직 삼키는 catch 가 남아 있는지(빈 `catch (e) { }`), 남았다면 위험도 판단. |
| 7 | **메시지 규칙** — 화면에 추적 코드만 띄우고 임의 문구를 만들지 않았는지. BR51 의 `WS20ATTR-CHK01` 과 같은 방식인지(일관성). |
| 8 | **원본 파일 수정 규칙** — `ws_events.js` 는 `design/` 폴더 **밖**이라 이번 통째 덮어쓰기 대상이 아님(`.works/원본덮어쓰기/00_현황판.md` 명시). 이 판단이 맞는지, 아니면 별도 파일로 빼야 하는지. |

---

## 5. 근거

| 근거 | 위치 |
|---|---|
| 원본 활성화 흐름(감싸지 않고 직접 호출) | `U4A_WS3.0.0\www\ws30\ws10_20\js\ws_events.js` 1305~1338 |
| 원본 예외 점검 본체 | `U4A_WS_DESIGN\design\js\main.js` 1306 `chkExcepionAttr` |
| 조용한 catch 금지 · 오류코드 표면화 | `.claude/rules/code.md` |
| busy on/off 짝 규칙(모든 종료 분기에서 off) | `.claude/rules/code.md` |
| 메시지 임의 생성 금지(키는 장군님 지정) | `.claude/rules/code.md` |
| 같은 방식 선례(구간 오류코드 + fail-closed return) | `www/ws30/ws10_20/js/ws_html5_ws20_attr.js` 3913~3929 (BR51 `WS20ATTR-CHK01`) |
| 점검 함수 이식 경위 | BR34, `www/ws30/ws10_20/js/ws_html5_ws20_attr.js` 424~ 주석 |

---

## 6. 알려진 한계 / 미확인

- 이 결함은 **정상 화면 조작으로는 재현되지 않는다**(점검 함수 내부에서 예외가 나야 함). 노션 이슈 본문의 테스트 시나리오도 "강제 예외 주입" 전제다. 따라서 실화면 테스트 항목은 **정상 경로가 안 깨졌는지**(오류 있는 앱 → 오류 목록 뜸 / 오류 없는 앱 → 활성화 성공) 위주가 된다.
- 화면 안내 문구는 추적 코드(`WS20ACT-CHK01` / `WS20ACT-CHK02`)만 표시 — 정식 문구 번호 미정(장군님 지정 대기).
