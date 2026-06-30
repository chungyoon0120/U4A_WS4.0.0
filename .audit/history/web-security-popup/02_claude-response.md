# Web Security 팝업 HTML5 — Codex 감사에 대한 기술 검토 답변

- 작성: Claude (Opus 4.8)
- 기준 파일(현행만):
  - `www/ws30/ws10_20/js/fnWebSecurityPopupOpen.js`
  - 비교 기준(자매 팝업): `www/ws30/ws10_20/js/fnCssJsLinkAddPopupOpen.js`
  - 콜백 소비처: `www/ws30/ws10_20/design/js/uiAttributeArea.js` (DH001026)
  - 공통 close 정책: `www/ws30/ws10_20/theme/u4a-ui.js`
- `_`로 시작하는 백업/구버전 폴더는 근거에서 제외(원본 UI5 컨트롤러는 `_` 폴더에 있어 직접 인용 불가 → 현행 "원본 1:1 보존" 주석과 자매 팝업으로 교차 검증).

## 결론 요약

| 항목 | 동의 여부 | 조치 방향 | 우선순위 |
|---|---|---|---|
| P1-a. ACA M03 EUL 빈값 검증 없음 | **부분 동의(사실)** | 추가 확인 필요(원본 의도 존중, 무단 추가 금지) | — |
| P1-b. XFO M03 부분행 저장 | **이의 있음(반박)** | 수정 불필요 | — |
| P2-a. setAppChange("X") 무조건 | **이의 있음** | 수정 불필요(전역 정책 일관) | — |
| P2-b. XFO≠M03 WHIT 잔존 저장 | **동의(경미)** | 저장 시 방어 정규화 권장 | 낮음 |
| P3-a. 캐시 주석 부정확 | **동의** | 주석 정정 권장 | 낮음 |
| P3-b. 고정 px | **이의 있음** | 수정 불필요(이미 반응형) | — |

---

## P1-b. XFO M03 White List 부분행(SID/SRC 한쪽만) 저장 — **이의 있음(반박)**

### 1. 동의 여부
이의 있음. **Codex의 코드 해석이 틀렸다.**

### 2. 판단 근거
- Codex 주장: "lf_doSave()는 둘 다 빈 행만 제거하고, SID만/SRC만 빈 행은 그대로 저장된다."
- 실제 코드(`fnWebSecurityPopupOpen.js:254-256`):
  ```js
  if (oState.xfo.M03 === "X") {
      aWhit = aWhit.filter(function (r) { return (r.SID || "") !== "" && (r.SRC || "") !== ""; });
  }
  ```
  - filter 술어가 **AND**(`SID!=="" && SRC!==""`) → **양쪽 모두 채워진 행만 보존**.
  - 즉 SID만 또는 SRC만 채운 **부분행은 제거**된다(둘 다 빈 행은 물론 제거).
- 따라서 "부분행이 S_WSO에 그대로 저장된다"는 **재현 불가**. 데이터 정합성 문제 없음.
- 원본과의 관계: "원본 1:1" 주석(`23행`)은 "M03이면 SID/SRC 빈 행 제거"라 명시 → 현행은 원본의 "빈 행 정리"를 충실히(오히려 더 엄격하게 AND로) 반영.

### 3. 조치 방향
**수정 불필요.** (차이는 "부분행을 조용히 드롭 vs 오류 표시"뿐이며, 원본은 조용한 정리 방식. 오류 표시는 P1-a와 동일한 "원본에 없던 검증 추가" 사안.)

---

## P1-a. ACA M03 External Host URL(EUL) 빈값 필수 검증 없음 — **부분 동의(사실), 조치=추가 확인 필요**

### 1. 동의 여부
부분 동의. "검증이 없다"는 사실. 다만 **무단으로 추가하면 안 되는 사안**.

### 2. 판단 근거
- 사실 확인: `fnWebSecurityPopupOpen.js:259`에서 `EUL = oUI.eulField.getValue()`를 그대로 넣고 required 검증 없음. ACA M03(특정 호스트)인데 EUL이 비어도 저장됨.
- **원본 의도 판단**: 원본 UI5 컨트롤러는 `_` 폴더라 직접 인용 불가하나, 두 가지 정황이 "원본 미검증"을 가리킴:
  1. 현행 "원본 보존 로직(1:1)" 주석 목록(`19-25행`)에 EUL/화이트리스트 **required 검증 항목이 없음**. 오직 "빈 행 제거"만 기재.
  2. 자매 팝업 CSS/JS Link는 URL required 검증을 **1:1로 포팅**했다(`fnCssJsLinkAddPopupOpen.js:278-302`, `setValueState("error")` + MSG_WS 014 + 첫 오류 focus + 다이얼로그 유지). 같은 작성자가 Web Security엔 동일 검증을 넣지 않은 것은 **원본에 없었기 때문**으로 보는 것이 합리적.
- 즉 현행은 원본 동작을 충실히 재현한 것이며, EUL 검증은 **신규 UX 추가**에 해당한다.
- 프로젝트 원칙 충돌: 메모리 `dont-add-unrequested-ux`(원본·요청에 없는 UX 임의 추가 금지), `convert-thoroughly-first-time`(원본 동작 충실 이식). 무단 추가는 이 원칙에 어긋남.

### 3. 조치 방향
**추가 확인 필요.** 원본 UI5에 EUL required 검증이 실제로 있었는지(또는 화면 명세상 필수인지) 사용자/명세 확인 후 결정. 확인 전 임의 추가하지 않음.
- 만약 "추가" 결정 시: 자매 팝업과 동일 패턴(`createField.setValueState("error", msg)` + 공통 메시지 키 + 첫 오류 focus, 모달 위 토스트)으로 일관되게 구현하면 됨(코드 자산 이미 존재).

---

## P2-a. 기본값과 동일 저장 시에도 setAppChange("X") 무조건 호출 — **이의 있음**

### 1. 동의 여부
이의 있음. 의도된 **전역 정책**이며 자매 팝업과 일치.

### 2. 판단 근거
- 사실: `fnWebSecurityPopupOpen.js:269`에서 `parent.setAppChange("X")` 무조건 호출. canon 동일 시 `S_WSO`는 DEF 복사본으로 원복(`265-267`)되지만 IS_CHAG는 X.
- **자매 팝업도 동일**: CSS/JS Link `fnCssJsLinkAddPopupOpen.js:270, 310`에서 저장 시 `parent.setAppChange("X")`를 **무조건** 호출. 즉 "Save = 앱 변경표시"는 두 팝업이 공유하는 전역 규약.
- Codex가 든 "attr행(deepEqual S_WSO≠S_WSO_DEF) vs 앱헤더(IS_CHAG flag) 불일치"는 **자매 팝업에도 똑같이 존재**하는 구조. Web Security만 조건부 호출로 바꾸면 오히려 자매와 **정책 불일치**를 만든다.
- 실사용 영향: "기본값과 정확히 동일한 값으로 저장"이라는 엣지 케이스에서만 발생하는 경미한 과표시. 데이터 손상 아님.

### 3. 조치 방향
**수정 불필요.** Web Security 단독으로 바꾸지 않음. 변경한다면 CSS/JS Link 포함 전역 정책(Save 시 변경표시 규칙)으로 사용자 결정 후 일괄 처리할 사안.

---

## P2-b. XFO가 M03이 아닌데 WHIT 데이터가 남아 저장되는 경로 — **동의(경미)**

### 1. 동의 여부
동의(경미).

### 2. 판단 근거
- 사실: 저장 정규화 필터는 `if (oState.xfo.M03 === "X")` 안에서만 동작(`254-256`). XFO가 M03이 아니면 `aWhit = oState.whit`가 그대로 저장됨.
- WHIT 정리는 **UI 이벤트(라디오 변경)에만** 의존: `373-380`에서 XFO를 M03 밖으로 바꿀 때 `oState.whit = []`.
- 빈틈: 저장값이 비정상(XFO.M03≠"X"인데 WHIT 존재)인 채로 팝업을 열고(`lf_loadState:301`은 XFO 모드와 무관하게 WHIT 로드) 라디오를 건드리지 않고 바로 저장하면 WHIT가 잔존 저장됨.
- 단, 정상 서버 데이터에서는 발생하지 않는 **저확률 비정상 데이터** 케이스. invariant("XFO≠M03 ⇒ WHIT 비움")는 코드/주석에 이미 명시된 의도(`22행`, `376-377`).

### 3. 조치 방향
**저장 시 방어 정규화 권장(낮음).** 기존 명시 invariant를 저장 시점에도 강제하는 1줄 가드 → 정상 흐름 무영향, 비정상 데이터만 정리.

### 4. 수정 범위(진행 시)
- 파일: `fnWebSecurityPopupOpen.js` 단일.
- 동작: `lf_doSave()`의 WHIT 구성부에서 `if (oState.xfo.M03 !== "X") { aWhit = []; }`를 최종 방어로 추가(기존 M03 필터와 양립).
- 주의: M03일 때의 기존 AND 필터(부분행 제거)는 유지. canon 비교(`_wsoCanon`)에는 영향 없음(WHIT를 SID/SRC만으로 정규화하므로 빈 배열이면 더 일관).

---

## P3-a. dialog "캐시/재사용" 주석과 실제 close 후 재생성 정책 불일치 — **동의(주석만)**

### 1. 동의 여부
동의. 런타임 결함 아님, **주석 정확성** 문제.

### 2. 판단 근거
- 공통 정책: `u4a-ui.js:827-837`이 document에 capture `close` 리스너 1개로 **모든 `.u4a-dialog`를 close 시 DOM 제거**(`data-u4a-keep` 있으면 예외).
- Web Security 다이얼로그는 `data-u4a-keep` 미사용 → close 시 제거됨. opener도 `document.body.contains(oUI.dlg)`가 false면 `oUI = null; lf_build()`로 **재생성**(`476`).
- 그런데 주석은 "단일 캐시"(`78`), "다이얼로그 1회 생성(이후 재사용)"(`316`), "캐시 재사용"(`470`)이라 적혀 상태 보존 싱글톤으로 **오해 소지**.

### 3. 조치 방향
**주석 정정 권장(낮음).** "열려 있는 동안만 참조하며 close 후 공통 정책에 따라 DOM 제거되고 다음 열기 때 재생성"으로 수정. 상태 보존이 필요 없으므로 `data-u4a-keep`는 도입하지 않음(현행 동작이 옳음 — 닫을 때 잔여 입력/선택 초기화가 바람직).

### 4. 수정 범위(진행 시)
- 파일: `fnWebSecurityPopupOpen.js` 주석 3곳(`78`, `316` 헤더, `470` 헤더)만.

---

## P3-b. 화면 스코프 스타일 고정 px — **이의 있음**

### 1. 동의 여부
이의 있음. 이미 반응형으로 처리됨.

### 2. 판단 근거
- `fnWebSecurityPopupOpen.js:508`: `width: min(94vw, 640px); height: min(88vh, 660px)` — **이미 vw/vh 기반 clamp**. 좁은 창에서는 94vw/88vh로 자동 축소, 넓을 때만 640/660px 상한. 원본 600×600 **고정**보다 오히려 반응형 우수.
- `minW: 460, minH: 360`(`461`)은 사용자 리사이즈 **하한**일 뿐 초기 크기와 무관. 초기 폭은 항상 ≤94vw라 뷰포트를 넘지 않음.
- `.analy/12·16`의 "고정 px 폭 금지"는 레이아웃 폭을 px로 못박는 것을 금하는 취지인데, 여기선 px가 **상한값**으로만 쓰여 위배 아님.

### 3. 조치 방향
**수정 불필요.** 원본 600×600 다이얼로그 이식 의도 + 공통 dialog clamp(min())으로 좁은 뷰포트가 이미 처리됨.

---

## Codex 확인 요청 항목에 대한 답변(1:1)

1. **ACA M03 EUL 빈값 저장 허용이 원본 의도인가** → 원본 1:1 보존 주석·자매 팝업 정황상 **원본 미검증으로 판단**. 검증 추가는 신규 UX → 명세/사용자 확인 후 결정(P1-a).
2. **XFO M03 부분행 저장 허용이 원본 의도인가** → **부분행은 저장되지 않는다**(AND 필터로 제거). 전제 자체가 코드 오독(P1-b).
3. **S_WSO===S_WSO_DEF 저장에서도 setAppChange("X")가 맞는가** → 맞다. 자매 CSS/JS Link와 동일한 전역 규약(P2-a).
4. **XFO.M03≠"X"일 때 저장 시 WHIT 항상 비우는 정규화 필요한가** → 명시 invariant 강화 차원에서 **저장 시 방어 추가 권장(낮음)**(P2-b).
5. **dialog 캐시 주석을 정정할지** → 정정 권장. 상태 보존 의도 없으므로 `data-u4a-keep`는 미도입(P3-a).

---

## 종합 권고

- **수정 권장(낮음)**: P2-b(저장 시 WHIT 방어 정규화), P3-a(주석 정정). 둘 다 `fnWebSecurityPopupOpen.js` 단일 파일, 정상 동작 무영향.
- **추가 확인 필요**: P1-a(EUL required 검증 — 원본/명세 확인 후 결정).
- **수정 불필요**: P1-b(반박), P2-a(전역 정책 일관), P3-b(이미 반응형).
- 공통 자산(`shell.css`/`u4a-ui.js`/`bootstrap-skin.css`/`tokens.css`)은 어떤 경우에도 무변경.

---

## 실행 결과 (수정 완료)

수정 권장 2건만 반영. P1-a는 보류(원본 확인 대기), 나머지는 검토대로 미수정.

### 수정 파일
- `www/ws30/ws10_20/js/fnWebSecurityPopupOpen.js` (단일). 공통 자산 무변경.

### 변경 내역
1. **P2-b 저장 시 WHIT 방어 정규화** — `lf_doSave()`의 White List 구성부에 `else { aWhit = []; }` 추가.
   XFO가 M03이 아니면 저장 시 WHIT를 항상 비워 invariant("XFO≠M03 ⇒ WHIT 없음")를 저장 시점에도 강제.
   M03일 때의 기존 AND 필터(부분행 제거)는 그대로 유지 → 정상 흐름 무영향.
2. **P3-a 캐시 주석 정정** — "단일 캐시 / 1회 생성 후 재사용 / 캐시 재사용" 3곳을
   "close 시 공통 정책으로 DOM 제거 → 다음 열기 때 재생성(상태 보존 싱글톤 아님)"으로 수정.
   `data-u4a-keep`는 도입하지 않음(닫을 때 잔여 상태 초기화가 바람직).

### 미반영(검토대로)
- **P1-a (EUL required 검증)** — 보류. 원본 UI5/화면 명세에 해당 검증이 있었는지 확인 후 결정.
  자매 CSS/JS Link는 검증을 1:1 포팅했으나 Web Security엔 없음 = 원본 미검증 정황. 무단 추가 금지(`dont-add-unrequested-ux`).
- **P1-b** — 반박(부분행은 AND 필터로 이미 제거됨).
- **P2-a** — 자매 팝업과 동일한 전역 정책이라 단독 수정 시 불일치 유발.
- **P3-b** — `min(94vw,640px)`로 이미 반응형.

### 검증
- `node --check www/ws30/ws10_20/js/fnWebSecurityPopupOpen.js` → **문법 정상**.
- 코드 리뷰:
  - P2-b: M03 분기(부분행 필터)·canon 비교(`_wsoCanon`은 WHIT를 SID/SRC만으로 정규화)와 양립, 정상 데이터 영향 없음. ✔
  - P3-a: 주석만 변경, 로직 무변경. ✔
- 실제 동작(편집모드 진입 / ACA·XFO 라디오 전환 / White List Add·Del / Save·Delete / 닫기-재오픈)은 사용자 환경에서 확인 필요.

### P1-a 확인 완료 (2026-06-30) → 수정 불필요로 종결
사용자 확인 + 현행 소스 3종 근거로 **External Host URL(EUL)은 필수 아님 / 원본에 필수 체크 없음**으로 확정.
1. SSOT `.analy/06_팝업.md:352` — EUL required 검증 미요구.
2. `fnWebSecurityPopupOpen.js:19-25` 원본 1:1 보존 목록에 EUL 검증 없음.
3. 자매 CSS/JS Link는 URL 필수 검증을 1:1 포팅했으나(`fnCssJsLinkAddPopupOpen.js:278-302`) Web Security엔 없음 = 원본 미검증.
→ 현행이 원본을 충실히 재현. 검증 추가는 신규 UX라 미적용(`dont-add-unrequested-ux`). **P1 전체 종결.**
