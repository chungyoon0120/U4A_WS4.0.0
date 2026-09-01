# BR55 검수 결과 반영·해명 (03)

## 검수 판정 요약
- **코덱스(02_audit_codex.md)**: 수정필요 — P1 2건. 핵심(점검 실패 fail-closed)은 통과. 서브에이전트 2기 독립 재검수 후에도 P1 2건 유지.
- **안티(02_audit_agy.md)**: 수정필요 — P1 2건. 코덱스와 **동일 지적**(P1-1 비동기 로드 실패 시 본창 busy 고착 / P1-2 동기 실패 시 자식창 BUSY_OFF 누락).

두 검수가 완전히 일치. 지적 2건을 **원본 대조 후** 처리했다 — **P1-2 반영**, **P1-1 반론(원본 동일 결함, BR55 범위 밖 → 별도 보고)**.

## 지적 취합표

| # | 지적 | 검수자 | 판정 | 처리 |
|---|---|---|---|---|
| 1 | **P1-2**: `fnMultiFooterMsg` 는 진입 즉시 본창 busy + **자식창 BUSY_ON 방송**을 함께 건다(`fnDialogPopupOpener.js` 2822~2826). 도중 동기 예외로 `WS20ACT-CHK02` catch 로 오면 본창 busy 만 풀고 **자식창 BUSY_OFF 를 안 보내** 바인딩 팝업·편집기 등 자식창이 잠긴 채 남는다 | 코덱스·안티 | **타당** | **반영**. CHK02 회수 갈래에 `oAPP.attr.oMainBroad.postMessage({PRCCD:"BUSY_OFF"})` 추가(실패 시 콘솔 오류). 이 회수 갈래는 원본에 없는 **내가 만든 경로**이므로, 내 경로 안에서 잠금 짝을 완성하는 것이 맞다(메모리 규칙: BUSY_ON 잠그면 BUSY_OFF 필수). `ws_events.js` CHK02 catch |
| 2 | **P1-1**: 오류 목록 창의 **비동기** 로드 실패(`did-fail-load`·`render-process-gone`·ready 전 `closed`·내부 iframe 로드 실패)는 동기 catch 에 안 잡힌다. 정상 busy 해제는 오류창 내부가 로드 완료 후 보내는 IPC 에만 의존하므로, 로드가 실패하면 **본창 busy 가 영구 고착** | 코덱스·안티 | **타당하나 BR55 범위 밖 (원본 동일 결함)** | **반론·미반영** — 아래 §반론 참조 |
| 3 | `chkExcepionAttr` 미정의·동기 throw 시 fail-closed(서버 활성화 호출·`IS_ACT`·자식창 숨기기 미도달), 정상 경로 원본 1:1, 추적 코드 표시 방식(BR51 일관), `node --check`·`git diff --check` 통과 | 코덱스·안티 | 통과 | 유지(변경 없음) |
| 4 | CHK01 은 오류창 BUSY_ON **이전** 단계라 본창 busy 해제만으로 충분(자식창 회수 불필요) | 코덱스 | 통과 | 유지 — 원본 대조 결과 동일. `fnMultiFooterMsg` 호출 전이라 자식창 잠금이 나가지 않았다 |
| 5 | CTS 재호출·Ctrl+F3 단축키 경로에서 BR55 회귀 없음 | 코덱스 | 통과 | 유지 |

## 반영 내용 (P1-2)

`www/ws30/ws10_20/js/ws_events.js` — `ev_pressActivateBtn` 의 `WS20ACT-CHK02` 회수 갈래:

```js
} catch (e) {
    console.error("[WS20ACT-CHK02] 예외 점검 오류목록 표시 실패:", e);
    try { oAPP.common.fnSetBusyLock(""); } catch (e2) { console.error("[WS20ACT-CHK02] busy 해제 실패:", e2 && e2.message); }
    //[BR55-P1] fnMultiFooterMsg 는 진입 즉시 본창 busy + 자식창 BUSY_ON 을 함께 건다
    //  (fnDialogPopupOpener.js 2822~2826). 도중 실패로 여기 오면 본창만 풀어선 안 되고
    //  이미 나간 자식창 잠금도 같이 회수해야 한다(BUSY_ON 잠그면 BUSY_OFF 필수).
    try {
        if (oAPP.attr && oAPP.attr.oMainBroad) { oAPP.attr.oMainBroad.postMessage({ PRCCD: "BUSY_OFF" }); }
    } catch (e4) { console.error("[WS20ACT-CHK02] 자식창 busy 해제 방송 실패:", e4 && e4.message); }
    try { parent.showMessage(null, 10, "E", "WS20ACT-CHK02"); } catch (e3) { console.error("[WS20ACT-CHK02] 오류 안내 표시 실패:", e3 && e3.message); }
}
```
- 방송 수신부 확인: `broadcast/ws_fn_broad.js` 42~46 `case "BUSY_OFF": parent.setBusy("")`. 같은 프로젝트의 다른 회수 갈래(`fnDialogPopupOpener.js` 121·678·1320·1446·1591·2133·2148·2337 등)와 동일한 형식.
- 표시가 **성공**하면 종전대로 본창 busy 를 켠 채 return(오류창 로드 완료 IPC 가 해제) — 원본 1:1 유지. 방송은 실패 갈래에서만 나간다.
- `node --check ws_events.js` 통과.

## 반론 (P1-1 미반영 — 원본에도 똑같이 없음)

**원본 실측 대조** (`C:\Users\socce\Documents\Github\U4A_WS3.0.0\www\ws30\ws10_20\js\fnDialogPopupOpener.js` 2968~3082 `oAPP.fn.fnMultiFooterMsg`):

| 항목 | 원본(as-is) | 현행 HTML5 |
|---|---|---|
| 진입 시 본창 busy + 자식창 BUSY_ON | 있음 (2971~2974) | 동일 |
| `loadURL()` 반환 Promise 처리 | **없음** (3035 `oBrowserWindow.loadURL(sLoadUrl);` 만) | 동일 |
| `did-fail-load` 처리 | **없음** | 동일 |
| `render-process-gone` 처리 | **없음** | 동일 |
| `closed` 에서 busy 해제 | **없음** (IPC off + `CURRWIN.focus()` 만, 3072~3080) | 동일 |
| busy 해제 경로 | 오류창 내부 로드 완료 IPC 단 하나 | 동일 |

두 구현의 **실패 처리 코드 차이는 0**이다(현행과 원본의 차이는 창 닫기 헬퍼·창 크기 비율뿐, 실패 처리와 무관 — diff 실측).

즉 P1-1 은 **변환으로 새로 생긴 결함이 아니라 원본 UI5 가 원래 갖고 있는 결함**이다. 프로젝트 최우선 규칙(`CLAUDE.md`·`.claude/rules/code.md`)이 "원본에 없는 UX·동작 임의 추가 금지, 이상하면 **보고만** 하고 별도 지시가 있을 때만 적용"이므로, 원본에 없는 로드 실패 안전망(`did-fail-load` 회수·Promise 수명주기 일원화)을 임의로 넣지 않는다.

또한 이 보완은 `fnMultiFooterMsg` 를 Promise 반환형으로 바꾸고 `ev_pressActivateBtn` 이 await 하도록 **호출 규약 자체를 바꾸는 변경**이라, BR55(활성화 전 점검 실패 삼킴)의 범위를 크게 넘는다. 같은 방식으로 창을 여는 다른 곳(자식창 opener 계열 전반)에 동일 결함이 퍼져 있으므로, 한 곳만 고치면 오히려 규약이 갈라진다.

**→ 장군님 지시 대기**: 원본 잠재 결함으로 별도 등록(노션 UI5 레거시 잠재 버그 기록) 후, 지시가 있으면 opener 계열 전체에 일괄 안전망을 적용하는 것이 맞다고 본다. BR55 자체는 P1-2 반영으로 마무리.

## 최종 수정 상태
- 파일: `www/ws30/ws10_20/js/ws_events.js` (`ev_pressActivateBtn`) — CHK01(점검 실패 fail-closed) + CHK02(표시 실패 회수, 본창 busy + 자식창 BUSY_OFF).
- 무변경: `chkExcepionAttr`/`chkExcepUiTable` 이식본(`ws_html5_ws20_attr.js`), `ev_pressSyntaxCheckBtn`, `fnMultiFooterMsg`(`fnDialogPopupOpener.js`).
- 백업: `_ws_events.js.br55bak`. `node --check` 통과.

## 테스트
- 실화면 시나리오: `.works/실행점검/00_현황판.md` (BR55-1~4).
- CHK01·CHK02 갈래는 점검 함수/오류창 열기에 강제로 오류를 주입해야 도달하는 내부 방어라 실화면 항목에서 제외(정상 조작으로 재현 불가).
