# Version Management 별도창 — Codex 감사에 대한 기술 검토 답변

- 작성: Claude (Opus 4.8)
- 기준 파일(현행만):
  - `www/ws30/ws10_20/js/fnVersionManagementPopupOpen.js`
  - `www/ws30/ws10_20/Popups/versionMng/versionMngFrame.js`
  - `www/ws30/ws10_20/Popups/versionMng/versionMngFrame.css`
  - `www/ws30/ws10_20/Popups/versionMng/host/*`
- `_`로 시작하는 백업/구버전 폴더는 근거에서 제외함.

## 결론 요약

| 항목 | 동의 여부 | 조치 방향 | 우선순위 |
|---|---|---|---|
| P1. Target 라디오 미추가 | **이의 있음(반박)** | 수정 불필요 | — |
| P2. 최초 IF 데이터 busy 고착 | **부분 동의** | 방어 fallback 추가 권장 | 낮음 |
| P2. BroadcastChannel 미close | **동의** | 수정 권장 | 낮음 |
| P3. 이전 diff 잔상 | **동의(경미)** | 수정 권장 | 낮음 |
| P3. Yes/No/OK 하드코딩 | **이의 있음(부분 동의)** | 수정 불필요(전역 정책) | — |
| P3. CSS 고정 rem 폭 | **이의 있음(부분 동의)** | 수정 불필요(현 설계 의도) | — |

---

## P1. 비교 대상(Target) 라디오 버튼 미추가 — **이의 있음(반박)**

### 1. 동의 여부
이의 있음. **현행 코드에 이 버그는 존재하지 않는다.**

### 2. 판단 근거
- Codex가 지목한 위치(`versionMngFrame.js:355-359`)는 실제로는 **App Version 셀(`u4a-c-vmver`)** 코드다(`oTr.appendChild(oTdVer)`). Target 라디오 구성과 무관한 위치다 → **인용 라인이 어긋남**.
- Target 라디오의 실제 구성은 `versionMngFrame.js:370-375`:
  ```js
  var oLblT = document.createElement("label");
  oLblT.className = "u4aVmRadio";
  var oRdT = document.createElement("input");
  oRdT.type = "radio"; oRdT.name = "vmTarget"; oRdT.value = String(idx);
  var oSpT = document.createElement("span"); oSpT.textContent = _z("395");   // 비교 대상
  oLblT.appendChild(oRdT); oLblT.appendChild(oSpT);
  ```
  `appendChild`는 **375줄의 독립 실행문**이고, 주석(`// 비교 대상`)은 **이전 줄(374)** 끝에 있다. "주석 뒤 같은 줄에 붙어 실행 안 됨"이라는 지적과 다르다.
- 이어서 `oCmpBox.appendChild(oLblT)` (378줄)로 셀에 정상 부착된다.
- `_onCompare()`(419줄)가 `input[name="vmTarget"]:checked`를 읽는 경로도 정상 동작한다.
- **재현 가능성**: Base/Target 라디오 모두 렌더되며 Compare가 정상 진행됨. 지적된 "항상 비교 대상 선택 경로로 빠짐"은 재현 불가.
- 추정: Codex가 현재와 다른(과거/중간) 스냅샷을 본 것으로 보임. (git status상 해당 파일은 수정됨 상태)

### 3. 조치 방향
**수정 불필요.**

---

## P2. 최초 IF 데이터 수신 누락 시 busy 고착 — **부분 동의**

### 1. 동의 여부
부분 동의. 정상 경로는 안전하나, 방어용 fallback 부재는 사실.

### 2. 판단 근거
- **정상 경로는 정상**:
  - opener는 `did-finish-load`에서 `if-vermng-info`를 send (`fnVersionManagementPopupOpen.js:113-122`).
  - renderer는 `window load`에서 listener 등록 (`versionMngFrame.js:811`). Electron에서 `did-finish-load`는 렌더러의 `load` 이후 발생하므로 **수신 누락은 정상 상황에서 발생하지 않음**.
- **WS20 전체 busy는 이미 해제됨**: opener는 `ready-to-show`에서 `fnSetBusyLock("")` + `BUSY_OFF` 수행(`108-109`). 즉 데이터가 안 와도 **부모 WS20이 멈추는 일은 없고**, 멈추는 것은 **자식창 본문(opacity 0) + 자식창 자체 busy 오버레이**뿐이다 → 증상 범위는 Codex 설명보다 좁다.
- **`_loadVersionList`는 hang 불가**: `_post`는 항상 resolve하며(`184-211`), 오류 시 `_fatal`이 창을 닫는다(`167-181`). 따라서 "서버 응답 지연/예외로 _finishOpen 미호출"은 `if-vermng-info` 자체가 안 오는 경우로 국한된다(저확률).
- 다만 `docPopup`에 있는 busy watch fallback이 versionMng에는 없는 것은 사실. `_waitHostReady`에는 15초 watchdog(`511-517`)이 있으나 이는 **diff 호스트용**이지 최초 오픈용이 아니다.

### 3. 조치 방향
**방어 fallback 추가 권장(낮은 우선순위).** 정상 경로는 문제없으나, 일관성·견고성 차원에서 최초 오픈 busy에 15~20초 watchdog을 두는 것이 합리적.

### 4. 수정 범위(진행 시)
- 파일: `versionMngFrame.js`
- 동작: `load` 시점에 타이머 설정 → 시간 내 `_finishOpen()` 미호출이면 `_fatal("E", _z("314")...)` 또는 busy 해제 후 안내.
- 주의: `bOpenDone` 가드가 이미 있으므로(`140-142`) 정상 수신 시 fallback이 중복 발화하지 않게 `bOpenDone` 검사로 가드.

---

## P2. BroadcastChannel 미close — **동의**

### 1. 동의 여부
동의(경미).

### 2. 판단 근거
- 생성: `_initBroadcast()` `767-776`에서 `oBroad = new BroadcastChannel(...)`.
- 정리: `window.onbeforeunload` `826-833`은 click/keyup/message/IPC listener는 제거하지만 **`oBroad`는 close하지 않음**. (Codex 인용 808-815는 어긋나나 내용은 826-833과 일치)
- 단, 이 팝업은 매 오픈마다 **새 BrowserWindow**로 생성되고(`fnVersionManagementPopupOpen.js:77`) 닫힐 때 렌더러가 파괴되므로 채널은 OS/Electron 차원에서 회수된다 → "반복 사용 누적 누수"는 실제로 크지 않음. 그래도 명시적 close는 위생상 바람직하고 비용이 낮다.

### 3. 조치 방향
**수정 권장(낮음).**

### 4. 수정 범위(진행 시)
- 파일: `versionMngFrame.js`
- 동작: `onbeforeunload`에 `if (oBroad) { try { oBroad.onmessage = null; oBroad.close(); } catch(e){} oBroad = null; }` 추가.
- 주의: `onbeforeunload` 상단에 `if (bBusy) { return false; }` 가드(827)가 있어 **busy 중에는 언로드가 취소**된다. close는 그 가드 **이후**(실제 언로드 확정 구간)에 두어야 busy 취소 시 채널을 잘못 끊지 않음.

---

## P3. 다른 비교 실행 시 이전 diff 잔상 — **동의(경미)**

### 1. 동의 여부
동의(경미).

### 2. 판단 근거
- `_onCompare()`는 `u4aVmHostShown` 클래스를 host wrap에 추가(`465`).
- `_hideDiffPane()`(`489-498`)는 pane을 hidden 처리하지만 **`u4aVmHostShown`을 제거하지 않고**, host(Monaco)의 이전 sourceA/B도 그대로 남는다.
- 재비교 시 흐름: `_setBusy(true)`(432) → `_showDiffPane()`(435) → 서버 응답 후 `setCompareData`(455). busy 오버레이가 덮긴 하지만 **반투명**이라 새 응답 도착 전 짧게 이전 diff가 비칠 수 있음 → 지적 타당.
- 영향은 시각적 혼동에 국한(데이터 정합성 문제 아님).

### 3. 조치 방향
**수정 권장(낮음).**

### 4. 수정 범위(진행 시)
- 파일: `versionMngFrame.js`
- 동작: `_onCompare()`의 `_setBusy(true)` 직후 host wrap에서 `u4aVmHostShown` 제거(또는 host에 빈 모델 전송), 서버 응답·layout 후 다시 add. 기존 add(`465`)는 유지.
- 주의: 최초 1회 호스트 로드 경로(`_loadHost`/`_waitHostReady`)와 충돌하지 않게, 클래스 제거만 하고 host src/ready 상태는 건드리지 않음.

---

## P3. Yes/No/OK 문구 하드코딩 — **이의 있음(부분 동의)**

### 1. 동의 여부
이의 있음. 원칙엔 부분 동의하나 **versionMng 단독 수정은 부적절**.

### 2. 판단 근거
- 지적 위치는 사실: `_fatal()` OK = `versionMngFrame.js:170` (`var sOk = "OK"`), 새창 confirm = `551` (`"Yes"`/`"No"`).
- 그러나 이는 **코드베이스 전역 관행**이다. 동일 리터럴이 공통/다수 화면에 존재:
  - 공통 `U4AUI.confirm` 기본값: `u4a-ui.js:1880` (`opts.yesLabel || "Yes"` / `"No"`)
  - `ws_html5_shell.js:444`, `ws_events.js:1219`, `usp/*` 다수, `mimeRepository/frame.js:204`, `resources/index.js:293/301/309`
- 반면 **액션 고유 라벨**(Delete/Save 등)은 키 사용(예: `docPopup/frame.js:309/356` = A03/A64). 즉 현행 규약은 "일반 확인 버튼(Yes/No/OK)은 리터럴, 의미 있는 액션 라벨은 메시지 키"로 일관됨.
- 따라서 versionMng만 키화하면 **오히려 전역 일관성을 깨고** 공통 컴포넌트 기본값과도 어긋난다. `.analy/16` "문구는 메시지 키" 원칙과의 충돌은 **전역 정책 결정 사항**이지 이 화면의 결함이 아니다.

### 3. 조치 방향
**수정 불필요(이 화면 한정).** Yes/No/OK 키화가 필요하면 공통 `U4AUI.confirm` 기본값 + 전체 소비처를 함께 다루는 별도 전역 작업으로 분리해 사용자 결정 후 진행. (메모리 `no-invented-messages` 취지와도 정합: 임의 키 생성 금지, 필요 키는 수집·보고)

---

## P3. CSS 고정 rem 폭 — **이의 있음(부분 동의)**

### 1. 동의 여부
이의 있음. 부분 동의(원칙)하나 **현 설계는 의도된 것**.

### 2. 판단 근거
- `versionMngFrame.css:136-154`: 테이블 `min-width: 64rem` + 컬럼 고정 rem 폭. 이는 **원본 `sap.ui.table.Column` 고정 width를 1:1 이식**한 것이고(주석 명시), 좁을 때 **가로 스크롤**로 흡수하는 방식(`u4aVmTableWrap { overflow:auto }` `125-129`).
- 이는 `table-common-component`/`16번 공통표준`의 "테이블은 스크롤 유지" 패턴과 정합 → 결함 아님.
- toolbar 측면: Compare 버튼은 목록 헤더의 **단일 소형 버튼**(`vmCompareBtn`), diff toolbar도 아이콘 버튼 위주라 실질적 overflow 위험이 낮다. `clamp/minmax/overflow menu` 도입은 이득 대비 복잡도가 커 현 시점 가치 낮음.

### 3. 조치 방향
**수정 불필요(현 설계 의도).** 향후 좁은 창 품질 이슈가 실제 보고되면 그때 toolbar 축약만 국소 검토.

---

## 종합 권고 (수정 진행 시 순서)

다음 3건만 **낮은 우선순위로** 반영 권장. 나머지(P1, Yes/No/OK, CSS)는 수정하지 않음.

1. **P2 BroadcastChannel close** — `onbeforeunload` busy 가드 이후에 `oBroad.close()` 추가.
2. **P3 diff 잔상** — `_onCompare` busy 직후 `u4aVmHostShown` 제거 → 응답 후 재표시.
3. **P2 최초 오픈 watchdog** — 15~20초 fallback(`bOpenDone` 가드와 함께).

모두 **versionMng 전용 파일 내부**에서만 수정하며, 공통 자산(`shell.css`/`u4a-ui.js`/`bootstrap-skin.css`/`tokens.css`)은 건드리지 않음.

### 검증 방법(수정 시)
- `node --check www/ws30/ws10_20/Popups/versionMng/versionMngFrame.js` (문법).
- 코드 리뷰: ① 정상 오픈 시 watchdog가 `bOpenDone`로 중복 발화 안 함 ② busy 취소(`return false`) 경로에서 채널이 잘못 close되지 않음 ③ 재비교 시 `u4aVmHostShown` add/remove 순서.
- 실제 동작 테스트(오픈/비교/재비교/닫기-재오픈)는 사용자 환경에서 확인.

---

## 실행 결과 (수정 완료)

권장 3건을 모두 반영함. 공통 자산(`shell.css`/`u4a-ui.js`/`bootstrap-skin.css`/`tokens.css`)은 무변경.

> ### ⚠ 정정(2026-06-30, 03_codex-recheck 반영)
> 최초 작성 시 "versionMng 전용 파일 **1개만** 수정"이라 적었으나 이는 **부정확**하다.
> 그 문장은 "이번 세션에서 Claude가 직접 편집한 파일(=`.js`)"만 가리킨 것이고,
> 작업트리(working tree)의 실제 미커밋 diff에는 **3개 파일**이 포함된다.
>
> - `versionMngFrame.html` / `versionMngFrame.css` 및 `_setBusy()`의 **Busy 공통화(.u4a-busy)** 변경은
>   **이번 세션 착수 이전부터 작업트리에 존재**하던 미커밋 변경이다(세션 시작 git status가 3개 모두 `M`,
>   첫 파일 Read 시점에 `_setBusy`는 이미 `data-busy`+`.u4a-busy__card/__label` 구조였음).
> - 즉 Busy 공통화는 Claude의 이번 조치가 아니라 **선행 작업**이며, 보고서가 작업트리 전체 diff를
>   기술하지 않아 누락된 것이다. 의도/검증은 아래 "Busy 공통화" 절 참조.

### 작업트리 전체 변경 파일(미커밋 diff 기준)
1. `www/ws30/ws10_20/Popups/versionMng/versionMngFrame.js` — **이번 세션 Claude 편집**(권장 3건) + 선행 busy 토글(`_setBusy`)
2. `www/ws30/ws10_20/Popups/versionMng/versionMngFrame.html` — **선행 변경**: `#vmBusy`를 공통 `.u4a-busy` 구조로 교체
3. `www/ws30/ws10_20/Popups/versionMng/versionMngFrame.css` — **선행 변경**: 전용 busy overlay/spinner 스타일 제거(공통 소비)

### 이번 세션 Claude 편집 파일
- `www/ws30/ws10_20/Popups/versionMng/versionMngFrame.js` (단일)

### 변경 내역
1. **최초 오픈 watchdog 추가** (P2)
   - 변수 `iOpenWatch` 추가(`66-67`).
   - `load` 핸들러에 20초 타이머: `bOpenDone` 미완료 시 `_fatal("E", ...)`로 안내 후 창 닫기(docPopup 동일 정책).
   - `_finishOpen()`에서 `clearTimeout(iOpenWatch)`로 정상 수신 시 해제 → 중복 발화 방지(`bOpenDone` 가드와 이중 안전).
2. **재비교 시 이전 diff 잔상 제거** (P3)
   - `_onCompare()`의 `_setBusy(true)` 직후 `vmDiffHostWrap`에서 `u4aVmHostShown` 제거. 응답(`setCompareData`) 후 기존 로직(`465`)이 다시 add → 새 결과만 노출.
3. **BroadcastChannel 명시적 close** (P2)
   - `onbeforeunload`의 `if (bBusy) return false;` 가드 **이후**에 `oBroad.onmessage=null; oBroad.close(); oBroad=null;` + `clearTimeout(iOpenWatch)` 추가. busy 취소 경로에서 채널을 잘못 끊지 않음.

### 미반영(검토대로 수정하지 않음)
- P1(Target 라디오) — 버그 미존재.
- Yes/No/OK 하드코딩 — 전역 관행(공통 `U4AUI.confirm` 기본값 포함), 전역 정책 사항.
- CSS 고정 rem 폭 — 원본 `sap.ui.table` 폭 1:1 + 가로 스크롤(의도된 설계).

### 검증
- `node --check .../versionMngFrame.js` → **문법 정상**.
- 코드 리뷰 확인 사항:
  - watchdog: 정상 수신 시 `_finishOpen`의 `clearTimeout` + `bOpenDone` 가드로 fallback 미발화. ✔
  - busy 취소(`return false`) 시 채널·타이머 정리 미실행(언로드 자체가 취소되므로). ✔
  - 재비교: class remove(시작) → add(응답 후) 순서 유지, host src/ready 상태 무변경. ✔
- 실제 동작(오픈 / 비교 / 재비교 / 닫기-재오픈 / 데이터 미수신 fallback)은 사용자 환경에서 확인 필요.

---

## Busy 공통화(.u4a-busy) — 의도/검증 (03_codex-recheck 항목)

### 의도
- 전용 `#vmBusy`(`u4aVmBusyBox`/`u4aVmSpinner`/`u4aVmBusyText`)를 공통 `.u4a-busy`(shell.css 단일 출처)로
  수렴한 변경. ServerList·메인 셸(`.u4aWsBusyIndicator`)과 동일한 카드+이중링 스피너 구조.
- 프로젝트 원칙(공통 컴포넌트 소비, 화면별 중복 스타일 제거)과 정합 → **유지가 타당**, 되돌릴 이유 없음.
- 단, 최초 감사 합의 3건 범위 밖 **선행 변경**임을 명시(위 정정 참조).

### 동작 검증(정적)
| 시나리오 | 경로 | 판정 |
|---|---|---|
| 오픈 busy 표시 | `_onVmInfo`→`_setBusy(true)`→`#vmBusy[data-busy="true"]` | ✔ |
| 오픈 busy 해제 | `_finishOpen`→`_setBusy(false)`→`data-busy="false"`(기본 opacity0/visibility hidden) | ✔ |
| 비교 busy 표시/해제 | `_onCompare` `_setBusy(true)`…응답 후 `_setBusy(false)` | ✔ |
| busy 중 입력 차단 | 오버레이 `pointer-events:auto`(shell.css `763-768`) + `document.body.style.pointerEvents="none"` + `CURRWIN.closable=false`(`132-133`) | ✔ |
| busy 중 창 닫기 차단 | `CURRWIN.closable=false` + `onbeforeunload`의 `if(bBusy)return false` | ✔ |
| 해제 후 조작 정상 | `_setBusy(false)`가 data-busy/ body pointerEvents/ closable 모두 원복 | ✔ |
| 자식창 busy 동기화 | `oBroad.postMessage(BUSY_ON/OFF)` 유지(`134-136`) | ✔ |

- shell.css 기본 `.u4a-busy`=opacity0·visibility hidden·pointer-events none(`713-727`), `[data-busy="true"]`에서만
  표시·차단(`763-768`) → 안전. `.u4a-busy__label:empty{display:none}`로 DESC 없으면 문구 자동 숨김.
- `position:absolute; inset:0`(공통)로 frameless 전체 창을 덮음(ServerList 동일 패턴) — 회귀 없음.
- 신규 결함 미발견.

### 잔여(사용자 환경 실확인 권장)
1. 창 오픈 후 목록 표시 2. Base/Target 비교 실행 3. 재비교 시 이전 diff 잔상 미노출
4. busy 중 입력/닫기 차단 및 해제 후 조작 정상. (03_codex-recheck 최종 판단과 동일)
