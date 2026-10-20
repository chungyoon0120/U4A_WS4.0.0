# 속성값을 바꾼 뒤 미리보기가 다 그려질 때까지 기다리게 고쳤다 → **원복** (TODO 1B-2)

> ★★ **2026-10-19 원복함** (장군님 지시). 원작자가 수정 내용을 주기로 해서, 아래 수정분은
> `git checkout` 으로 전부 되돌렸다. 코드는 커밋 전 상태(`783c0f5d`)와 같다.
> **아래 내용은 「되돌린 안」의 설계·영향도 기록이며, 원작자 안을 받았을 때 대조용이다.**

> 2026-10-19 · 장군님 지시 「원본 기준으로 맞추되 영향도를 철저히 분석해서 작업해라」
> 원본 = `U4A_WS_DESIGN/design/js/uiAttributeArea.js` (attrChange 1781~1913 · attrResetAttr 2151~2299)
> 전수 조사 = `2026-10-19_192900_claude_analysis_setafterrendering-callsites_06836675.md`

## 고친 곳 — 한 파일

`www/ws30/ws10_20/js/ws_html5_ws20_attr.js`

| 무엇 | 원본 근거 |
|---|---|
| 속성값 변경 함수를 `async` 로 바꿈 + 6번째 인자 `bForcePreviewTail` 추가 | attrChange 1781 이 `async function` |
| `_awaitPreviewRendered()` 새 helper — 대상 고르기 → DOM 확인 → 등록 → invalidate → await | attrChange 1870~1897 |
| 값 반영·속성 행 재렌더 뒤 그 helper 를 await | attrChange 1886~1897 자리 |
| 바인딩 팝업 반영 뒤 `selPreviewUI` 로 미리보기 선택 테두리 복구 | attrChange 1913 |
| 속성 초기화(Attribute Reset) 확인창 콜백을 `async` 로 + 루프 뒤 한 번 대기·테두리 복구 | attrResetAttr 2152(콜백 async) · 2271~2299 |
| 파일 상단에 오류코드 접두 선언 추가 | 코딩규약 |

새 오류코드: `WS20ATTR-PRV01`(대기 실패) · `PRV02`(속성 변경 뒤 선택 테두리 복구 실패) · `PRV03`(초기화 뒤 복구 실패).
`GUARD_EXIT` 로그: 속성 행에 OBJID 없음 · getTreeData 못 찾음 · 초기화 시 고른 UI 없음.

## 영향도 분석 (작업 전에 실측한 것)

| 항목 | 실측 | 판정 |
|---|---|---|
| 값 변경 함수 호출처 | 주석 제외 **38곳** (내 파일 + 팝업 모듈), 그중 `await` 하는 곳 0 | 원본도 30곳 중 await 4곳 — **원본과 같은 「불 지르고 가기」** |
| 원본이 `attrChangeProc`(동기 일꾼)를 직접 부르던 경로 | WS4.0 은 5번째 인자 `bSkipAttrExc=true` 로 표시돼 있음 | 그 경로는 **꼬리를 안 타게** 해 완전 동기 유지 |
| 연속 호출(루프) 경로 — 속성 초기화 루프 · AppID+설명 2건 · SelOption2 · 바인딩 팝업 F4 | **전부 `bSkipAttrExc=true`** | await 안 탐 → 재진입 가드에 안 걸림. 값 누락 없음 |
| 단발 호출인데 꼬리를 타는 곳 — 동일속성 소스 커밋 · 이벤트 JS 유무 변경 · 입력칸/콤보/체크 핸들러 | 루프 밖 1회 호출임을 소스로 확인 | 안전 |
| `try/catch` 로만 감싼 호출처 | 7곳, 그중 꼬리를 타는 것 3곳 | helper 가 **절대 reject 하지 않게** 만들어 catch 무력화 회피 |
| 재진입 가드(`_fnAttrChangeBusy`) | await 동안 켜져 있음 | 그 사이 사람 조작은 busy 가 막고, 코드 연속 호출은 전부 동기 경로 → 영향 없음 |
| busy | `finally` 가 await 뒤로 밀림 | **미리보기가 다 그려진 뒤에 풀린다 = 목표 달성** |
| 미리보기 선택 테두리 | 원본 `selPreviewUI` = `oWS.sMark.fn_mark` 재적용 | 다시 그리면 지워지므로 **반드시 같이 넣어야 함** |

## 원본에 있는데 일부러 안 넣은 것 — 1개

**`designRefershModel`(원본 attrChange 1905).** 그것은 UI5 트리와 속성 테이블이 다시 그려지길 기다리는 것이고,
HTML5 는 그 역할을 속성 행 재렌더(`fnRenderWs20AttrRows`)가 이미 한다. WS4.0 의 같은 이름 함수는
**디자인 트리 전체 재렌더**라, 속성 한 글자 바꿀 때마다 부르면 느린 PC 에서 비용이 붙는다.
→ 기능 동등(「기능이 같으면 성공」) 기준으로 뺐다.
**장군님 확정 2026-10-19**: 「UI5 사상하고 HTML 사상하고 다르잖아, 계속 디자인 트리를 다시 그릴 필요는 없잖아」
— 빼는 것이 맞다. UI5 는 model 바인딩이라 값이 바뀌면 트리 글자까지 다시 그려야 맞고, HTML5 는 속성 행을
직접 다시 그리므로 트리는 건드릴 일이 없다. **다시 넣지 말 것.**

## 미검증 — 앱으로 아직 안 돌려 봄

- 속성값 변경 뒤 미리보기 테두리가 유지되는지(눈으로)
- 무거운 앱(`ZDWU0020`)에서 입력 반응이 느려지지 않는지
- 동일속성 팝업은 호출처 `finally` 가 busy 를 먼저 끈다 — 그 창만 미리보기 대기 전에 busy 가 풀린다(원본도 동일 구조, 미확인)
- 미리보기가 아직 안 뜬 상태(iframe 미로드)에서 속성 변경 → `_frameWin()` null 로 조용히 지나감(설계대로)

## ★ 또 밟을 함정

1. **`bSkipAttrExc=true` 경로에 await 를 태우면 안 된다.** 속성 초기화 루프가 그 경로로 연속 호출하는데,
   await 가 붙으면 재진입 가드에 걸려 **2번째 속성부터 값이 안 들어간다.**
2. **기다릴 대상을 고른 UI 자신으로 잡으면 멈춘다.** 많은 UI 의 `invalidate` 가 부모를 다시 그리므로
   `onAfterRendering` 이 자기에게 안 온다. `getTargetAfterRenderingUI` 가 올라가 준 것을 써야 한다.
3. **`getDomRef()` 확인을 빼면 영영 안 끝난다.** 화면에 안 떠 있는 UI 는 그려짐 신호가 안 온다.
4. **다시 그린 뒤 `selPreviewUI` 를 빼면 선택 테두리가 사라진다.**
5. helper 가 reject 하면 `try/catch` 로만 감싼 호출처 3곳이 **조용히 실패**한다 — 그래서 안에서 전부 잡는다.


## ★ 궁극적 목적 = busy 끄는 시점 (장군님 확정 2026-10-19)

장군님 확정: 「결국 busy 때문인건 맞어」.

속성값 변경 함수는 `finally` 에서 처리중 표시(busy)를 끈다. 그 앞에 미리보기 대기(`await`)가 들어가면
**busy 가 미리보기까지 다 그려진 뒤에 꺼진다.** 지금은 값만 꽂고 바로 꺼져서, 사용자가 「다 됐다」고
보는 순간에 미리보기는 아직 그려지는 중이다.

같은 날 넣은 「DOM 이 조용해질 때까지 기다렸다 busy 끄기」(`index.js` 전역 `setBusy`)와 **같은 목표**이고,
이쪽은 미리보기가 **직접 주는 완료 신호**(`onAfterRendering`)로 정확히 맞추는 것이다.

★ 그래서 자리 판정이 간단해진다: **대기가 `finally`(busy 끄기)보다 앞에 있으면 목적은 달성된다.**
속성 행 다시 그리기의 앞이든 뒤든 busy 관점에서는 차이가 없다.

## ★ 원작자 안을 받으면 이 네 가지로 대조한다 (2026-10-19 장군님 지시)

장군님 지시: 「원작자가 잘못된 로직을 줬을 경우에는 네가 보고 잘 판단해라」. 판단 기준:

1. **함수를 `async` 로 바꿨는가** — `await` 만 넣고 선언을 안 바꾸면 **문법 오류로 파일 전체가 안 올라간다.**
2. **원본이 `attrChangeProc`(동기 일꾼)를 직접 부르던 경로를 갈랐는가** — WS4.0 은 그 두 함수를 하나로
   합쳐 놨고 5번째 인자(`bSkipAttrExc`)가 그 표시다. 안 가르면 **속성 초기화(Attribute Reset) 루프가
   재진입 가드에 걸려 2번째 속성부터 값이 안 들어간다.**
3. **다시 그린 뒤 미리보기 선택 테두리를 복구하는가**(원본 `attrChange` 끝 `selPreviewUI`, 1913행)
   — 없으면 속성을 바꿀 때마다 고른 UI 의 테두리가 사라진다.
4. **값이 없을 때 가드가 있는가** — `getTreeData` 결과가 없으면 `.POBID` 에서 터져, 그 뒤 속성 행 갱신·
   바인딩 팝업 반영이 전부 안 돈다. (`oAPP.attr.prev.ROOT` 는 UI5 control 이 아니라 값만 담은 plain
   object 라서 ROOT 바로 아래 UI 는 기다릴 대상이 아예 없다 — 원본도 같다.)

원작자 안이 1·2를 안 지켰으면 **그 부분만 보완해서** 쓰고, 3·4는 빠져 있으면 더해 준다.

---

## (11) 2026-10-20 — 필수 의존성 가드를 기준대로 고침 (장군님 승인 「당연히 고쳐야지 기준인데」)

### 왜 고쳤나

위 (1)~(10) 작업에서 내가 넣은 가드가 `.works/DEV_STANDARD_오류처리.md` §6 **「하지 말 것」**
 — `typeof fn === "function"` 로 필수 함수를 **조용히 skip** — 을 정면으로 어겼다.
기준 문서를 읽지 않고 코딩한 결과다. 판정 기준은
`.works/필수의존성크리티컬/00_현황판.md` §5 의 질문 하나로 갈린다:
**「이게 없다는 건 프로그램이 잘못 만들어졌다는 뜻인가?」**

| 성격 | 판정 |
|---|---|
| 우리가 만든 함수·모듈이 없다 (`fnWs20AwaitPrevRender…` · `getTreeData` · `setOnAfterRender`) | 크리티컬 → 코드 담아 `throw` |
| 미리보기 iframe 이 아직 없다 | **정상 분기 유지** — UI5 미로드 자리에서 던지면 앱이 그냥 죽는다 |
| 값(`sAttr.OBJID` 등)이 아직 없다 | 정상 분기 — 기다릴 대상이 없다는 뜻 |

### 고친 자리 (전수)

| 파일 | 자리 | 전 | 후 |
|---|---|---|---|
| `js/ws_html5_ws20_prev.js` | `fnWs20AwaitPrevRender` require 실패 | 콘솔 + `return` | `[PREV-ERR-007]` 담아 `throw`(midFn 1회 실행 후) |
| 같음 | `fnWs20AwaitPrevRenderMulti` require 실패 | 콘솔 + `return` | `[PREV-ERR-012]` 담아 `throw` |
| 같음 | 두 함수 선언 | `if (typeof … !== "function")` 중복 선언 래퍼 | 그냥 대입(그 파일 관행 = `fnWs20LoadPreview`) |
| `js/ws_html5_ws20_attr.js` | `attrChange` · `attrResetAttr` | 존재하면만 호출 | 없으면 `throw` → `[W20A-001]` · `[W20A-002]` |
| `js/ws_html5_ws20_edit.js` | 단건·멀티 삭제 `.catch` | `[W20E-003]` · `[W20E-004]` | `[W20E-005]` · `[W20E-006]` (기존 번호와 **중복이었다**) |
| `js/ws_html5_ws20_wizard.js` | `_wizFinish` | 가드 3개로 조용히 `return` | 없으면 `throw` → `[W20W-001]` |
| `js/fnAttrPresetSettingsOpen.js` | `_parentNodeOfAttr` | `getTreeData` 없으면 `null` | `throw` → `[APSO-001]` |
| `js/fnSameAttrSyncPopupOpen.js` | `_parentNodesOfApplied` · 호출처 | 조용히 skip | `[SASP-001]` · `[SASP-002]` · `[SASP-003]` |
| `js/fnStyleClassPopupOpen.js` | `_commit` 롤백 콘솔 | 코드 없음 | `[SCPO-001]` |
| `js/fnBindPopupOpen.js` | `lf_appCallback` · `lf_returnDOC` | 코드 없음 | `[FBPO-001]` · `[FBPO-002]` |
| `design/bindPopupHandler/broadcastChannelBindPopup.js` | 방송 수신 | 가드 2개로 조용히 skip | `throw` → `[BCBP-001]` |

접두 8개(`PREV-ERR`·`W20A`·`W20W`·`APSO`·`SASP`·`SCPO`·`FBPO`·`BCBP`)를
`.works/DEV_STANDARD_오류처리.md` 접두 사전에 등록하고, 각 파일 1행에
`// 오류코드 접두: XXX / 다음 번호: NNN` 주석을 넣었다.

### 전례를 따랐다 (새로 만들지 않음)

`ws_events.js` 의 `_ws20ReselectSelectedUI`(2095행)가 바로 이 꼴이다 —
**`throw new Error("<함수 이름> 미정의(…미로드)")` + catch 에서 코드 붙인 `console.error`.**

### 버린 방법

- **앱 종료까지 밀어붙이기**(전역 오류 감시로 보내 오류창 → 앱 종료). 기준 §6 의 경로이지만,
  호출처 catch 가 `busy`·`setShortcutLock`·자식창 `BUSY_OFF` 를 풀어야 해서 catch 를 없앨 수 없다.
  그 전환은 `.works/필수의존성크리티컬` 의 별도 작업이고 **아직 미착수**(그 문서에 「아직 코드
  한 줄도 안 고쳤다」로 적혀 있다). 「지시한 것 외 임의 작업 금지」에 걸려 하지 않았다.
- **기존 코드의 같은 가드까지 손보기** — `previewUIsetProp` · `attrSetDropAbleException` ·
  `fnWs20ApplyPrevTheme` · `WS20ATTR-CHK01`(2026-08-21) 은 전수 개조 금지·보이스카웃 규칙으로 그대로.

### ★ 또 밟을 함정

1. **`throw` 를 넣으면 그 뒤 줄이 전부 안 돈다.** 단건 삭제는 `await` 다음에
   `_broadBusy(false)` · `_unlock()` 이 있어서, catch 가 그 둘을 안 풀면 **화면이 영영 잠긴다.**
   → 호출처 7곳을 전수 확인했다: `broadcastChannelBindPopup:360`(뒤에 `sendBindPopupBusyOff`) ·
   `fnAttrPresetSettingsOpen:311`(finally) · `fnSameAttrSyncPopupOpen:485`(finally) ·
   `ws_html5_ws20_attr:4361`·`5043`(finally) · `ws_html5_ws20_edit:952`(`.catch` 가
   `_broadBusy(false)`+`_unlock()`) · `1166`(`.catch` 가 `_broadBusy(false)`) ·
   `ws_html5_ws20_wizard:250`(호출처 194행에 reject 핸들러 + `_bindBusy("BUSY_OFF")`). 전부 풀린다.
2. **`return <Promise>` 를 감싼 `try/catch` 는 reject 를 못 잡는다.** wizard 가 그 꼴이라
   동기 `throw` 만 그 catch 가 잡고, require 실패(reject)는 194행 reject 핸들러가 받는다.
3. **오류 코드 번호는 그 파일 안에서 유일해야 한다.** `W20E-003`·`004` 를 기존 코드와 중복시켰다 —
   새 번호를 쓸 때는 `grep -o "접두-[0-9]*" 파일 | sort -u` 로 먼저 센다.
4. **python 으로 파일을 고칠 때 줄바꿈** — `io.open(…)` 읽기는 CRLF 를 LF 로 바꾼다. 이 저장소는
   LF 보관이라 피해가 없었지만, CRLF 보관 파일에서 같은 짓을 하면 **파일 전체가 바뀐 것으로 잡힌다.**

### 미검증

- **앱으로 테스트 안 했다**(장군님이 직접 돌리신다). 확인할 것은 콘솔 순서뿐:
  `[PREV] preview rendering done at=…` 이 **먼저**, `[BUSY] on→off=` 가 **나중**.
- `throw` 갈래는 원본 모듈이 없을 때만 타므로 정상 환경에서는 **재현되지 않는다.**

---

## (12) 2026-10-20 — 로그를 `setAfterRendering` 한 곳으로 모음 (장군님 제안)

### 발단 — 「ws20 처음 진입할때도 … 콘솔에 안 찍히길래」

**첫 진입은 이미 맞게 돼 있었다**(고칠 것 없음). 소스로 확인한 순서:

| 순서 | 어디 | 무엇 |
|---|---|---|
| ① | `design/preview/index.js:5282` | `drawPreview` 끝에서 `setAfterRendering(prevRootPage)` + `await` |
| ② | `design/js/uiPreviewArea.js:362` / `design/preview/index.js:6059` | `await drawPreview()` 끝난 뒤 `fireCellClick`(ROOT 선택) |
| ③ | `js/ws_html5_ws20_prev.js:1907` | ROOT 선택 `await` → `.finally` 에서 `_ws20ReleasePrevBusy()` = busy off |

재진입(`_loaded === true`)·첫 로드 두 경로 모두 `await drawPreview()` 를 지난다.
콘솔에 안 찍힌 까닭은 내 `[PREV]` 로그가 **내가 만든 공통 함수 2개 안에만** 있었기 때문이다
(첫 진입은 그 함수를 안 쓰고 iframe 이 직접 `setAfterRendering` 을 await 한다).

### 장군님 제안 = `setAfterRendering` 안에 찍으면 전부 찍힌다

실측한 호출처 — **30여 곳이 전부 이 함수 하나를 지난다**:
`uiDesignArea.js`(2880·3101·3503·3554·4886·5437·5735·6344·6984) ·
`uiAttributeArea.js`(1886·2284·6590·7485) · `callDesignContextMenu.js`(589·966) ·
`undoRedo/undoRedo.js`(2232·2473) · `preview/index.js`(3970·4004·4017·5264·5282) ·
`previewRender/setOnAfterRender.js` 자신(282·319) · `renderingRichTextEditor.js`(89) ·
**내 파일 `ws_html5_ws20_prev.js`(2228·2321) · `ws_html5_ws20_edit.js`(152) · `ws_html5_ws20_dnd.js`(1671)**.

★ 끌어다 놓기(`dnd.js:1671`)와 단건 삭제(`edit.js:152`)는 **내 공통 함수를 안 쓰고 자체로 등록**한다 —
그 2곳도 이제 같이 찍힌다.

### 넣은 것 (41줄 추가 · 0줄 삭제 — git numstat 로 검증)

`design/js/previewRender/setOnAfterRender.js` `setAfterRendering` 맨 앞에 `_prevRenderLog` 헬퍼,
`resolve()` 5곳 앞에 호출 한 줄씩. **기존 줄은 하나도 고치지 않았다.**

`[PREV] preview rendering done how=<…> OBJID=<…> <ms> <HH:MM:SS.mmm>`
`how=` : `AWAITED`(onAfterRendering 까지 기다림) · `RTE`(RichTextEditor 준비까지) ·
`NO_TARGET` · `NO_DELEGATE` · `NO_HOOK`(뒤 세 개는 기다리지 않고 바로 끝난 것 — 전에는 구분이 안 됐다).
개발 모드(`parent.REMOTE.app.isPackaged === false`)에서만 찍는다.

### 금지 규칙과의 관계

`CLAUDE.md` · `.claude/rules/code.md` · `.analy/05` 세 곳에 「이 모듈 **수정 금지**」로 박아 뒀었다
(장군님 2026-10-20 「원본 모듈은 놔둬」). 그래서 넣기 전에 물었고 승인받았다 —
**「수정 금지는 맞는데 콘솔 찍었다고 기존 소스가 잘못 도는건 아니잖아 콘솔까지는 추가 허용이야」.**
세 문서에 그 허용을 한 줄씩 더했다(다음 대화창이 또 묻지 않게).

### ★ 또 밟을 함정

1. **이 로그가 어느 콘솔에 찍히는지는 아직 모른다.** 이 모듈은 iframe 이 `u4aRootParent.require`,
   호스트가 `parent.require` 로 읽는다 — `require` 캐시를 공유하면 `console` 은 **모듈이 처음 평가된
   쪽**의 것이 된다. 소스만으로 정할 수 없어 **돌려 봐야 안다.** DevTools 에서 frame 을 바꿔 봐야 할 수 있다.
2. **개발 모드 판정은 try 로 감쌌다** — 그 모듈이 `parent.REMOTE` 에 닿지 못하는 context 에서도
   터지지 않고 그냥 안 찍는다(로그 때문에 기존 로직이 깨지면 안 된다).
3. **내 공통 함수 안의 `[PREV]` 로그 2벌은 아직 그대로 둔다.** 그쪽은 `at=attrChange` 처럼
   **어느 프로세스인지**를 알려주고, 모듈 쪽은 **실제 resolve 시점**을 알려준다 — 서로 다른 정보다.
   지울지는 장군님 결정 대기.
