# BR60 검수 결과 반영·해명 (03_response)

- 검수 판정: **코덱스 = 수정필요(P1 2건·P2 1건) / 안티 = 수정필요(P1 2건·P2 1건)** — 두 검수 지적이 **완전히 동일**.
- 결과: **지적 3건 전부 반영. 반론 0건.** (두 P1 모두 실제 결함 — 내 배치 실수 + 잠금 소유권 오판)
- 수정 파일: `www/ws30/ws10_20/js/ws_html5_ws20.js`, `www/ws30/ws10_20/js/ws_html5_ws20_prev.js`
  (둘 다 원본 폴더 **밖** 내 파일. 원본 폴더 무수정.)
- 백업: `_ws_html5_ws20.js.br60bak`, `_ws_html5_ws20_prev.js.br60bak`. `node --check` 양쪽 통과.

---

## 1. 지적 취합표

| # | 지적 | 검수자 | 판정 | 처리 |
|---|---|---|---|---|
| P1-1 | 재배치 성공 분기에서 미리보기 재로드 완료를 기다리는 리스너를 걸어놓고도, **같은 블록 끝에서 즉시 잠금 해제**가 한 번 더 실행됨(1119행). 저장 직후 잠금이 풀리고, 이후 재로드 완료 때 **두 번째 해제**가 다른 작업의 잠금까지 풂 | 코덱스 · 안티 | **인정** | **반영** — 그 즉시 해제 줄 제거. 주석은 "재부착 없음"인데 실제 위치가 재부착 성공 블록 안이었음(배치 실수 확인) |
| P1-2 | 순서 무변경 명시 재로드 경로에서 `fnWs20LoadPreview()` 호출 **직후 동기 해제** → 미리보기 로더가 방금 인수한 화면잠금까지 즉시 꺼버림. 미리보기가 다 그려지기 전에 화면이 열림 | 코덱스 · 안티 | **인정** | **반영** — 화면잠금 **소유권을 로더에 이전**(내가 끄지 않음), 로더가 관리하지 않는 단축키 잠금만 **로더 완료 알림**을 받아 해제 |
| P2 | 잠금 켜기/끄기 전부 빈 `catch(e){}` → 실패해도 조용히 무효화. 멱등 가드 없음 | 코덱스 · 안티 | **인정** | **반영** — 전부 `console.error` 표면화 + **소유권 기반 1회 해제**(중복 해제 차단) |

---

## 2. 반영 상세

### 2-1. 잠금 관리 재작성 — 소유권 기반 1회 해제 (P2 + 두 P1의 공통 뿌리)
화면잠금·단축키잠금은 **참조 세기가 없는 전역 상태 하나**다. 그래서 이 저장이 이미 푼 잠금을
다시 한 번 끄면, 그 사이 다른 작업이 새로 건 잠금까지 풀린다(코덱스가 지목한 소유권 경합).

```js
var _bOwnBusy = false, _bOwnShortcut = false;
try { if (parent.setBusy) { parent.setBusy("X"); _bOwnBusy = true; } }
catch (e) { console.error("[HTML5][WS20][BR60] 저장 중 화면잠금 실패(저장은 계속):", e); }
try { if (oAPP.fn.setShortcutLock) { oAPP.fn.setShortcutLock(true); _bOwnShortcut = true; } }
catch (e) { console.error("[HTML5][WS20][BR60] 저장 중 단축키잠금 실패(저장은 계속):", e); }

function _releaseShortcut() {              // 단축키만 (화면잠금은 재로드 주체가 관리하는 경로용)
    if (!_bOwnShortcut) { return; }        // ← 멱등: 내가 소유한 것만, 한 번만
    _bOwnShortcut = false;
    try { oAPP.fn.setShortcutLock(false); } catch (e) { console.error(...); }
}
function _unlockAll() {                    // 이 저장이 건 잠금 전부
    _releaseShortcut();
    if (!_bOwnBusy) { return; }
    _bOwnBusy = false;
    try { parent.setBusy(""); } catch (e) { console.error(...); }
}
```
- 잠금이 **실제로 걸린 경우에만** 소유 표시를 세우므로, 켜기 실패 시 끄기도 하지 않는다(남의 잠금 보호).
- 두 잠금을 **따로** 관리하는 이유는 2-3.

### 2-2. 재배치(순서 바뀜) 경로 — 즉시 해제 제거 + 실패 시 회수 (P1-1)
```js
var _offPrevLd = function () {                 // 리스너 정리(성공·실패 공통)
    oAPP.attr.__ws20PrevReloading = false;
    _pf.removeEventListener("load", _onPrevLd);
    _pf.removeEventListener("error", _onPrevErr);
};
var _onPrevLd  = function () { _offPrevLd(); _unlockAll(); };
var _onPrevErr = function () {                 // 재로드 실패해도 화면이 잠긴 채 멈추지 않게
    console.error("[HTML5][WS20][BR60] 미리보기 재로드 실패 — 잠금 회수.");
    _offPrevLd(); _unlockAll();
};
_pf.addEventListener("load",  _onPrevLd);
_pf.addEventListener("error", _onPrevErr);
```
- **블록 끝의 즉시 해제 줄을 삭제**했다(P1-1 핵심).
- 실패(`error`) 회수는 **새 발명이 아니라 기성 패턴 차용** — 미리보기 로더 자체가 iframe 오류에
  같은 방식으로 잠금을 회수한다(`ws_html5_ws20_prev.js` 의 iframe 오류 안전장치).
  `.claude/rules/code.md` 의 "busy on 이면 모든 종료 분기에서 off 짝 필수" 요구이기도 하다.

### 2-3. 순서 무변경 + 명시 재로드 경로 — 소유권 이전 (P1-2)
미리보기 로더(`fnWs20LoadPreview`)는 **이미 완결된 잠금 계약**을 갖고 있다(소스 확인):
진입 시 자기 화면잠금을 걸고(`_ws20EngagePrevBusy`), 미리보기 구성이 끝나거나(ROOT 선택 완료)
실패하면 스스로 푼다(`_ws20ReleasePrevBusy`). 즉 **이 경로의 화면잠금은 로더가 주인**이다.

```js
var _bDelegated = false;
if (typeof oAPP.fn.fnWs20LoadPreview === "function") {
    try {
        if (!Array.isArray(oAPP.attr.__ws20PrevDoneCbs)) { oAPP.attr.__ws20PrevDoneCbs = []; }
        oAPP.attr.__ws20PrevDoneCbs.push(_releaseShortcut);   // 로더 완료 시 단축키 해제
        _bOwnBusy = false;                                     // 화면잠금 소유권 이전
        oAPP.fn.fnWs20LoadPreview();
        _bDelegated = true;
    } catch (e) {
        console.error("[HTML5][WS20][BR60] 미리보기 재로드 호출 실패 — 잠금 회수:", e);
        _bOwnBusy = true;                                      // 위임 실패 → 소유권 회수
    }
}
if (!_bDelegated) { _unlockAll(); }                            // 기다릴 완료 신호 없음 → 즉시 회수
```
- 화면잠금은 이제 **미리보기가 다 그려질 때까지 유지**된다(로더가 끝에 한 번 끔).
- 단축키 잠금은 로더가 관리하지 않으므로, **로더 완료 알림**을 받아 그때 푼다(WP1 직렬화).

### 2-4. 미리보기 로더에 "로드 종료" 알림 추가 (`ws_html5_ws20_prev.js`)
로더의 **기존 종료 지점 한 곳**(`_ws20ReleasePrevBusy` 맨 앞, 성공·실패 공통 경유)에만 알림을 넣었다.
```js
oAPP.attr.__ws20PrevBooting = false;
try {
    var _aDone = oAPP.attr.__ws20PrevDoneCbs;
    if (Array.isArray(_aDone) && _aDone.length) {
        oAPP.attr.__ws20PrevDoneCbs = [];                 // 비우고 실행 = 중복 실행 방지
        _aDone.forEach(function (fnDone) {
            try { fnDone(); } catch (e) { console.error("[HTML5][WS20][prev] 미리보기 로드 종료 콜백 오류:", e); }
        });
    }
} catch (e) { console.error("[HTML5][WS20][prev] 미리보기 로드 종료 알림 오류:", e); }
if (!_bPrevBusyOn) { return; }
```
- 위치가 조기 `return` **앞**이라 성공·실패·중복호출 어느 경로든 알림이 보장된다.
- 등록자가 없으면 아무 일도 안 한다(기존 동작 무변경, 다른 호출부 영향 0).
- 코덱스 제안 3(로더가 완료를 알리게 할 것)의 **최소 구현** — 반환값/계약 변경 없이 알림만 추가.

---

## 3. 종료 갈래 전수 (해제 짝 점검)

| 갈래 | 조건 | 화면잠금 | 단축키잠금 |
|---|---|---|---|
| 재배치 + 미리보기 있음 | 순서 바뀜 | 재로드 완료/실패 시 이 저장이 해제 | 〃 |
| 재배치 + 미리보기 없음 | 〃 | 즉시 해제 | 즉시 해제 |
| 재배치 + 대기 배선 예외 | 〃 | 즉시 회수 | 즉시 회수 |
| 순서 그대로 + 앞선 재로드 진행 중 | BR49 분기 | 즉시 해제 | 즉시 해제 |
| 순서 그대로 + 명시 재로드 | 위임 성공 | **로더가 해제**(그리기 완료 시) | 로더 완료 알림 시 해제 |
| 순서 그대로 + 로더 없음/호출 실패 | 위임 실패 | 즉시 회수 | 즉시 회수 |

- 모든 갈래에 짝이 있고, 각 잠금은 소유 표시 때문에 **최대 한 번만** 해제된다.

---

## 4. 남은 한계 (반론 아님 — 사실 기재)

**코덱스 보강 지적**: iframe 의 `load` 는 문서 로드 시점일 뿐, 그 안의 미리보기 그리기 완료와 동치가 아니다.
→ **맞는 지적이다.** 다만 재배치 경로에서 부모(WS20)가 쓸 수 있는 신호가 이것뿐이다:

- 재배치로 시작되는 재로드는 미리보기 iframe **내부**가 스스로 진행하며(BR49 에서 확인·의도),
  부모의 로더(`fnWs20LoadPreview`)를 타지 않는다 → 부모의 완료 알림이 울리지 않는다.
- 그 완료를 부모에게 알리려면 `design/preview/index.js` 를 고쳐야 하는데 **원본 파일이라 수정 금지**다.
- 부모 로더를 태우면 BR49 의 파괴 경쟁(반복 저장 시 오류)이 되살아난다(그래서 안 부름).

따라서 **재배치 경로에서는 문서 로드 완료 시점에 잠금을 푼다**. 그 이후 그리기가 끝날 때까지의
짧은 구간은 잠기지 않는다는 한계가 남는다. (원본은 미리보기 내부가 부모 잠금을 푸는 구조라 이 구간까지
잠기지만, 그 신호가 HTML5 부모까지 오지 않는다.)
**원본 파일 수정 허가가 나오면 그때 정확한 완료 신호로 바꿀 수 있다 — 지시 대기.**

안티가 "재부착 시 `load` 는 반드시 발생"이라 한 것은 **발생 보장**에 대한 것으로, 위 한계(발생 시점이
그리기 완료보다 이름)와 모순되지 않는다. 두 검수 모두 수용.

---

## 5. 원본 조사에서 확인한 사실 (보고)

원본 SSOT(`U4A_WS_DESIGN`)를 직접 뒤진 결과:

1. **원본은 레이아웃 저장 흐름에서 단축키 잠금을 다시 풀지 않는다.**
   저장 확정 때 잠그기만 하고(`lf_save` 253행), 이후 경로(`lf_after`→`lf_frame`→`loadPreviewFrame`)와
   미리보기 쪽 어디에도 해제가 없다(미리보기 소스 내 해제 호출 0건 — 전수 확인).
   → 원본대로면 저장 후 단축키가 잠긴 채 남는다. **원본 결함으로 보인다.**
   이슈 BR60 의 기대결과가 "잠그고, **끝나면 푼다**" 이므로 **푸는 쪽으로 구현**했다.
2. 원본의 화면잠금 해제는 미리보기 쪽이 부모 잠금을 끄는 방식에 의존한다(호출 6곳 확인).
   HTML5 미리보기 로더도 같은 결의 계약을 갖고 있어 2-3 처럼 위임이 성립한다.

---

## 6. 검수에서 통과 확인된 항목 (변경 없음)

- 타일 **맞바꿈**이 원본의 위치값 교환+정렬과 세 타일 모든 조합에서 결과 동일(양측 전수 검증).
- 닫기·취소 안내(우상단 X·하단 닫기·ESC → 취소 안내 / 저장 종료만 안내 생략)가 원본과 1:1.
- 안내 호출 첫 인자 `null` 안전(HTML5 구현이 UI5 인자 무시), 안내 표시 방식도 계약대로.
- 확인창 동안 잠금을 걸지 않는 것은 원본의 최종 상태와 실질 동일.
- 단축키 잠금 함수는 런타임에 **실제로 로드돼 있음**(코덱스가 적재 경로까지 확인).
- BR49 의 재로드 겹침 방지 처리와 충돌 없음.
