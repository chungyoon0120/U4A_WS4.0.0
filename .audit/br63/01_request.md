# BR63 검수 요청 — 바인딩 팝업: D&D 바인딩 후 추가속성 설정값 초기화

> 규약 = `.audit/README.md`. 이 문서는 **Claude 가 쓴 검수 요청서**다.
> 코덱스는 `02_audit_codex.md`, 안티는 `02_audit_agy.md` 에 결과를 쓴다. 이 파일은 고치지 않는다.

---

## 0. 한 줄 요약

**원본이 일부러 주석 처리해 둔 "추가속성 목록 재구성" 호출을 HTML5 가 되살려 놓은 것**이 원인.
그 호출을 원본대로 다시 없애고(주석 근거 남김), 같은 함수에서 **누락돼 있던 원본 호출 1줄(`setAdditBindButtonEnable(true)`)을 복원**했다.

---

## 1. 이슈 원문 (노션 이슈 리포트 DB)

- 코드 `BR63` / 화면 `바인딩 팝업` / 분류 `기능` / 상태 `접수` / 작성자 `PES`
- 내용: **바인딩 필드 D&D 적용 후 추가속성 설정값 초기화**
- 현상: Binding Popup 에서 바인딩 추가속성 값(예: `Conversion Routine` = `ALPHA`)을 설정한 뒤,
  바인딩 필드 리스트의 필드를 **메인 Attribute 리스트로 드래그·드롭**하면 바인딩은 정상 적용되지만
  **팝업의 추가속성 설정값이 초기화**된다. 같은 추가속성으로 연속 바인딩하려면 값을 다시 입력해야 한다.
- 이슈에 적힌 CDP 관찰: 바인딩 처리 직후 팝업 재구성 경로에서 `setAdditialListData()` 호출 확인.
  호출 위치 `bindBroadcast.js:117`, 기본값 재생성 `additInfoArea.js:214`.
- 기대 결과: D&D 로 바인딩을 구성해도 **추가속성 영역의 기존 설정값이 유지**되어야 하고,
  같은 추가속성을 다시 입력하지 않고 다음 바인딩을 이어서 할 수 있어야 한다.

---

## 2. 검수 대상 파일

| 파일 | 성격 | 이 건에서 바뀐 곳 |
|---|---|---|
| `www/ws30/ws10_20/Popups/bindPopup/wsDesignHandler/bindBroadcast.js` | **HTML5 변환 파일(내 파일)** — 원본에 같은 이름 파일 없음 | `_updateDesignData` 안 `_fnRebuild` (현행 114~131행: C2 추가 118~120, C1 삭제 123~130) |

- 백업(수정 전) = 같은 폴더 `_bindBroadcast.js.br63bak`
- 대상 함수: `_updateDesignData(oEvent)` (94행) → 그 안의 지연 재구성 콜백 `_fnRebuild` (114행)
- 진입 경로: 방송 수신 스위치 `PRCCD === "UPDATE_DESIGN_DATA"` (256행에서 `_updateDesignData` 호출)

### 원본(as-is) SSOT
`C:\Users\socce\Documents\Github\U4A_WS_DESIGN\Popups\bindPopup\wsDesignHandler\broadcastChannelBindPopup.js`
→ `updateDesignData()` (241행~)

> 바인딩 팝업은 **디자인 담당 개발자 관리 영역**이므로 원본은 `U4A_WS_DESIGN` 을 본다
> (CLAUDE.md ★최우선 규칙 ②, `.analy/18_원본소스_위치_SSOT.md`).

---

## 3. 원본이 실제로 하는 일 (근거)

원본 `updateDesignData()` 본문에서 **추가속성 3줄이 모두 주석 처리**돼 있다.

| 원본 라인 | 코드 | 상태 |
|---|---|---|
| 269 | `// oAPP.fn.clearSelectAdditBind();` | **주석(호출 안 함)** |
| 274 | `oAPP.fn.setAdditLayout("", {KEEP_SPLITTER_SIZE:true});` | 호출함 |
| 282 | `oAPP.attr.oAddit.fn.setAdditBindButtonEnable(true);` | 호출함 |
| 286 | `oAPP.attr.oDesign.fn.setDesignTreeData();` | 호출함 |
| 289 | `// oAPP.attr.oAddit.fn.setAdditialListData();` | **주석(호출 안 함)** |
| 307 | `// oAPP.attr.oAddit.oModel.refresh();` | **주석(호출 안 함)** |

→ **원본은 이 경로(= WS20 이 되돌려주는 화면 갱신 방송)에서 우측 추가속성 값을 의도적으로 건드리지 않는다.**
사용자가 입력해 둔 값이 그대로 남는다.

### 대조군 — 원본이 초기화를 *하는* 다른 경로
`Popups/bindPopup/uiModule/designTree.js:1409~1420` (팝업 **안쪽** 디자인 트리에 직접 드롭하는 경로)
에서는 `clearSelectAdditBind()` + `setAdditLayout("")` + `setDesignTreeData()` + `setAdditialListData()` 를 **모두 호출**한다.
즉 원본은 두 경로를 **의도적으로 다르게** 처리한다. HTML5 도 이 경로(`designArea/designArea.js:941~948`)는 초기화를 유지하고 있으며 이번에 손대지 않았다.

---

## 4. HTML5 가 어긋나 있던 지점 (원인)

수정 전 `bindBroadcast.js` `_fnRebuild`:

```js
oAPP.fn.setAdditLayout("", { KEEP_SPLITTER_SIZE: true });
oAPP.fn.setDesignTreeData();
// 추가속성 리스트 재구성 — ★oAPP.attr.oAddit 는 라이브 미할당(죽은 네임스페이스)이던 것 → oAPP.fn 으로 복구.
oAPP.fn.setAdditialListData();          // ← 원본 289 는 주석인데 살려 놓았음
```

- 주석 문구가 말하듯, 변환 당시 **원본의 `oAPP.attr.oAddit.fn.setAdditialListData()` 를 "죽은 네임스페이스라 안 불리던 코드"로 오판**하고 `oAPP.fn.` 로 바꿔 **되살렸다**.
- 실제로는 원본이 `//` 로 **주석 처리한 코드**였다. 즉 안 불리는 이유는 네임스페이스가 아니라 **주석**이었다.
- 그 결과 매 드롭마다 `setAdditialListData()`(`additInfoArea.js:214`)가 우측 8행을 기본형으로 새로 만든다
  → 일반 항목 `val:""`, `P07`/`P08`(`Nozero`, `Is number format?`)은 `"false"` → **사용자 입력값 소멸**.
  이슈의 `ALPHA → 빈 값` 관찰과 일치.
- 추가로, 원본 282행 `setAdditBindButtonEnable(true)` 가 HTML5 `_fnRebuild` 에 **아예 없었다**(원본 1:1 누락).

---

## 5. 변경 내용 (수정 후)

```js
// 추가속성 화면 비활성 — 원본 setAdditLayout("", {KEEP_SPLITTER_SIZE:true}). 필수 호출 직접(삼킴 제거).
oAPP.fn.setAdditLayout("", { KEEP_SPLITTER_SIZE: true });
// [BR63] 우측 추가속성 바인딩 버튼 활성 — 원본 broadcastChannelBindPopup.js:282
//   setAdditBindButtonEnable(true). HTML5 에 누락돼 있던 원본 1:1 호출을 복원한다.
oAPP.fn.setAdditBindButtonEnable(true);
// 디자인 트리 재구성(재렌더 + 컬럼맞춤 포함).
oAPP.fn.setDesignTreeData();
// ★[BR63] 추가속성 리스트 재구성은 하지 않는다 — 원본 broadcastChannelBindPopup.js:288~289 가
//   setAdditialListData() 를 **주석 처리**해 두었다(268~269 clearSelectAdditBind, 304~305
//   oAddit.oModel.refresh() 도 동일하게 주석). ... (원본 289) oAPP.fn.setAdditialListData();
```

| # | 변경 | 원본 근거 | 성격 |
|---|---|---|---|
| C1 | `oAPP.fn.setAdditialListData();` **호출 삭제**(주석으로 근거 남김) | 원본 289행 주석 | 원본 1:1 복구 |
| C2 | `oAPP.fn.setAdditBindButtonEnable(true);` **추가** | 원본 282행 | 누락 호출 복원 |

- 삭제·추가 외 **다른 줄은 손대지 않았다**. `setAdditLayout` / `setDesignTreeData` / busy 짝 / `_sendDesignAreaBusyOff()` 순서 그대로.
- `node --check` 통과.
- 원본 폴더(`U4A_WS_DESIGN`, `U4A_WS3.0.0`) **읽기만** 함. 작업폴더 안 원본 사본 무수정.

### 부수 확인 (값을 지우는 다른 후보 배제)
- `setAdditLayout(KIND, oOption)` (`additInfoArea.js:735`) = 접기/펼치기 + 스플리터 인라인 크기 제거만. **값 무관.**
- `clearSelectAdditBind()` (`additInfoArea.js:759`) = **중앙하단(선택 attribute)** 저장소만 비움. 우측 MAIN 무관.
- 즉 이 경로에서 **우측 MAIN 값을 지우던 것은 `setAdditialListData()` 한 줄뿐**이었다.

---

## 6. 검수 포인트 (꼭 봐 주십시오)

| # | 항목 | 왜 봐야 하나 |
|---|---|---|
| **A** | **원본 판독이 맞나** — 원본 269·289·307행이 정말 주석이고, 274·282·286 만 살아 있는가. 내 "주석을 죽은 코드로 오판했다"는 진단이 사실인가 | 이 건 전체의 근거. 여기가 틀리면 수정 방향 자체가 틀림 |
| **B** | **경로 구분이 맞나** — 팝업 안쪽 디자인 트리 드롭(`designArea.js:941~948`)은 초기화 유지, WS20 방송 경로만 초기화 제거. 원본의 두 경로 차이와 일치하는가 | 한쪽만 고쳐야 하는데 양쪽을 건드리면 반대 회귀 |
| **C** | **C2 가 과잉인가** — `setAdditBindButtonEnable(true)` 추가는 BR63 증상과 직결되진 않는다. "같은 함수의 원본 누락 복원"으로 봐야 하는가, **범위 밖 임의 추가**로 봐야 하는가 | 원본 1:1 vs 요청 밖 변경. 판단 갈리면 지적 바람 |
| **D** | **C2 부작용** — `setAdditBindButtonEnable` (`frame.js:239`)은 조회모드(`oAPP.attr.editable !== true`)면 무조건 비활성. 이 경로에서 항상 `true` 로 켜는 게 **조회모드/동기화 중 잠금**과 충돌하지 않는가 (`syncBindScreen.js:233` 이 비활성으로 만든 직후 방송이 오면 강제로 켜지지 않는가) | 실제 위험 후보 1순위 |
| **E** | **값이 어디에 사는가** — 이제 우측 MAIN 을 다시 그리지 않는다. 사용자가 입력칸에 친 값이 **화면(DOM)에만** 있고 저장소에는 없다면, 이후 다른 경로가 저장소 기준으로 다시 그릴 때 값이 사라지지 않는가. 반대로 저장소에 이미 반영된다면 문제없음 | "안 그린다"로 해결한 방식의 지속성 |
| **F** | **잔여 초기화 경로** — WS20 드롭 1회에 `UPDATE_DESIGN_DATA` 외에 다른 방송(`ERROR-ADDIT-DATA`, `DESIGN-TREE-SELECT-OBJID`)이 함께 와서 값을 지우는 경우가 없는가 | 이슈의 "연속 바인딩" 요구 충족 여부 |
| **G** | **busy 짝 유지** — `_fnRebuild` 의 `try/finally` 에서 `_sendDesignAreaBusyOff()` + `setBusy(false)` 가 어떤 갈래에서도 반드시 실행되는가. C2 추가가 예외를 던져 WS20 이 영구 잠금되지 않는가 | 프로젝트 필수 규칙(busy on↔off 짝) |
| **H** | **오류 삼킴 없나** — 이번 변경으로 조용히 넘어가는 갈래가 생기지 않았는가 | 규칙: 조용한 catch 금지 |
| **I** | **원본 무수정** — 원본 폴더 2곳과 작업폴더 안 원본 사본(`design/`, 원작자 관리 팝업 폴더)에 손댄 곳이 없는가 | ★최우선 규칙 |

---

## 7. 고친 자리 — 소스 위치

**바꾼 파일은 1개, 바꾼 자리는 2군데다.** 아래 줄 번호로 바로 열어 보면 된다.

파일 = `www/ws30/ws10_20/Popups/bindPopup/wsDesignHandler/bindBroadcast.js`

| 위치 | 줄 | 무엇 |
|---|---|---|
| `_updateDesignData(oEvent)` | **94** | 이 건의 진입 함수 (방송 `PRCCD === "UPDATE_DESIGN_DATA"` 수신) |
| ↳ `_fnRebuild` | **114 ~ 131** | 재구성 콜백 = 검수 범위 전부. 이 안이 아니면 안 건드렸다 |
| **C2 (추가)** | **118 ~ 120** | `oAPP.fn.setAdditBindButtonEnable(true);` — 118·119 는 근거 주석 |
| **C1 (삭제)** | **123 ~ 130** | 원래 `oAPP.fn.setAdditialListData();` 한 줄이 있던 자리. 지우고 그 자리에 근거 주석만 남김(130행이 지운 원래 코드) |
| 그대로 둔 줄 | 116·117 (`setAdditLayout`), 121·122 (`setDesignTreeData`), 131~136 (`catch` / `finally` 의 busy 해제) | 손대지 않음 |

수정 전 상태를 보려면 같은 폴더의 백업 파일 `_bindBroadcast.js.br63bak` 를 열면 된다(같은 함수 안 `setAdditLayout` → `setDesignTreeData` → `setAdditialListData` 3줄 연속).

### 함께 봐야 할 자리 (안 고쳤지만 판단에 필요)

| 파일 | 줄 | 왜 |
|---|---|---|
| `Popups/bindPopup/additInfoArea/additInfoArea.js` | **214** | `setAdditialListData` 본체 — 우측 8행을 기본형(빈 값 / `false`)으로 새로 만드는 곳. C1 을 안 지웠을 때 값이 날아가던 이유 |
| `Popups/bindPopup/additInfoArea/additInfoArea.js` | **735** | `setAdditLayout` 본체 — 접기/펼치기만 함(값 무관) 확인용 |
| `Popups/bindPopup/additInfoArea/additInfoArea.js` | **759** | `clearSelectAdditBind` 본체 — 중앙하단만 비움(우측 무관) 확인용 |
| `Popups/bindPopup/frame.js` | **239** | `setAdditBindButtonEnable` 본체 — 검수 포인트 **D**(조회모드 강제 비활성) 판단 지점 |
| `Popups/bindPopup/designArea/designArea.js` | **941 ~ 948** | 팝업 **안쪽** 디자인 트리 드롭 경로 — 여기는 초기화를 **유지**했다(검수 포인트 **B**) |
| `Popups/bindPopup/synchronizionArea/syncBindScreen.js` | **233** | 동기화 중 바인딩 버튼을 비활성으로 만드는 곳 — 검수 포인트 **D** 의 충돌 상대 |

> ※ 참고: 이 수정은 오늘(2026-09-01) 앞선 세션에서 같은 내용으로 이미 반영·커밋돼 있었는데
> 작업 폴더 파일만 수정 전 상태로 되돌아가 있어 이번에 다시 적용했다.
> **현재 작업 폴더 파일 = 커밋본과 완전히 동일**(바이트 일치 확인). 이중 적용은 없다.
> 그래서 `git diff` 에는 안 잡히니, **위 줄 번호로 파일을 직접 열어서** 검수하면 된다.

---

## 8. 근거 목록

- 원본: `U4A_WS_DESIGN\Popups\bindPopup\wsDesignHandler\broadcastChannelBindPopup.js` 241~310 (`updateDesignData`)
- 원본 대조군: `U4A_WS_DESIGN\Popups\bindPopup\uiModule\designTree.js` 1409~1420
- 원본 기본형 생성: `U4A_WS_DESIGN\Popups\bindPopup\uiModule\bindAdditInfo.js` 913 (`setAdditialListData`)
- HTML5: `bindBroadcast.js` 94·114~131 / `additInfoArea.js` 214·735·759 / `frame.js` 239
- 규칙: `CLAUDE.md` ★최우선(원본 1:1·임의창작 금지), `.claude/rules/code.md`(busy 짝·오류 삼킴 금지·`node --check`)
- SSOT 위치: `.analy/18_원본소스_위치_SSOT.md`
