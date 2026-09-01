# BR58 검수 요청 — 도움말(Tooltips) 팝업 구버전 서버 폴백 이식

작성: Claude / 2026-08-31

---

## 0. 이슈 원문과 실제 현상의 차이 (먼저 봐주십시오)

노션 BR58 본문에는 **"원본 `callTooltipsPopup` 이 `sap.m` 팝업(UI5 의존)이라 변환되지 않았다"** 고
적혀 있으나, 원본을 끝까지 읽은 결과 **사실과 다릅니다.**

- 원본 `callTooltipsPopup` 은 UI5 컨트롤을 **하나도 쓰지 않습니다.** 별도 Electron `BrowserWindow`
  를 만들어 정적 HTML(`design/html/helper/<LANGU>/<area>/index.html`)을 `loadURL` 할 뿐입니다.
- UI5 의존은 **파일 없음 오류 경로의 `parent.showMessage(sap, ...)` 첫 인자 하나뿐**입니다.
- 동일 로직의 UI5-free 이식본이 이미 `Popups/bindPopup/utils/callTooltipsPopup.js` 로 **동작 중**입니다.

또한 이슈는 **미리보기 한 곳**만 적고 있으나, 실제로는 **UI 트리·속성·미리보기 세 곳 모두**
구버전 서버 폴백이 죽어 있었습니다(§2 표).

**★검수 포인트 A** — 위 판단(원본이 UI5 비의존이라는 것)이 맞는지 원본 소스로 직접 확인 바랍니다.

---

## 1. 검수 대상

### 신규 파일 (원본 폴더 밖 — 원본 무수정 규칙 준수)
| 파일 | 줄수 | 역할 |
|---|---|---|
| `www/ws30/ws10_20/js/ws_html5_call_tooltips_popup.js` | 189 | `oAPP.fn.callTooltipsPopup(oUi, sArea, sCODE)` 정의 |

### 수정 파일
| 파일 | 함수·위치 | 내용 |
|---|---|---|
| `www/ws30/ws10_20/js/library-preload.js` | 161~167 | 신규 파일 로드 등록(트리/속성/미리보기보다 **앞**) |
| `www/ws30/ws10_20/js/ws_html5_ws20_tree.js` | `_tbBtn` 244~253 / 도움말 버튼 `press` 402~434 | 눌린 버튼을 `this` 로 전달 + 폴백 배선 |
| `www/ws30/ws10_20/js/ws_html5_ws20_attr.js` | 도움말 버튼 클릭 5350~5380 | 폴백 배선(기존엔 "아직 작업중입니다" 토스트만) |
| `www/ws30/ws10_20/js/ws_html5_ws20_prev.js` | 도움말 버튼 클릭 1106~1146 | 폴백 배선 + 잘못된 주석 정정 |

※ `ws_html5_ws20_attr.js` 는 BR54 변경분이 함께 커밋 대기 중입니다. **BR58 범위는 5350~5380 뿐**입니다.

### 원본(as-is) 대응 위치 — 읽기 전용
- `U4A_WS_DESIGN/design/js/callTooltipsPopup.js` (140행) — 이식 원본
- `U4A_WS_DESIGN/design/js/uiDesignArea.js` 957~985 — UI 트리 도움말 버튼
- `U4A_WS_DESIGN/design/js/uiAttributeArea.js` 600~641 — 속성 도움말 버튼
- `U4A_WS_DESIGN/design/js/uiPreviewArea.js` 105~152 — 미리보기 도움말 버튼

---

## 2. 변경 요약 (원본 대비)

원본은 도움말 버튼 눌림에서 **두 갈래**로 갑니다.

```
parent.setBusy("X")                                   ← 진입 즉시
  ↓
checkWLOList("C","UHAK901369") === true ?
  ├─ 예  → fnU4AHelpDocuPopupOpener({startMenuId}) → return   (통합 도움말)
  └─ 아니오 → callTooltipsPopup(this, <area>, <code>)          (구버전 서버 폴백)
              ※ 함수가 없으면 getScript 로 불러온 뒤 호출
```

HTML5 는 앞갈래만 살아 있고 뒷갈래가 결손이었습니다.

| 영역 | 수정 전 실제 동작 | 수정 후 |
|---|---|---|
| UI 트리 | `_safeCall("callTooltipsPopup", [**null**, "designTooltip","E21"])` — 첫 인자가 `null` 이라 원본의 `if(!oUi){...return;}` 에 걸려 함수가 있어도 무반응 | 눌린 버튼 전달 |
| 속성 | 폴백 호출 자체가 없고 `_wipToast()`("아직 작업중입니다")만 | 원본대로 `callTooltipsPopup(l_ui,"attrTooltip","E23")` |
| 미리보기 | `typeof … !== "undefined"` 가드만 있고 함수가 로드된 적이 없어 `console.warn` 후 종료 | 로드 + 원본대로 호출 |
| 세 곳 공통 | 진입 시 `setBusy("X")` 없음(미리보기는 앞갈래 안에서만) | 원본 순서대로 **핸들러 첫 줄**로 이동 |

### 원본 `callTooltipsPopup` 대비 이식본에서 달라진 곳 — 2가지뿐

| # | 원본 | 이식본 | 사유 |
|---|---|---|---|
| 1 | `parent.showMessage(sap, 10, "E", …)` (원본 114행) | `parent.showMessage(null, 10, "E", …)` | HTML5 에 UI5 전역(`sap`) 없음. 다른 변환 파일과 동일 관례(`ws_html5_ws20_tree.js` 382 등) |
| 2 | 창 생성 실패 방어 없음 | `try/catch` 로 감싸 `WS20HELP-02` 코드 + 콘솔 오류 + busy 해제 + 창 정리 | 코딩규칙 "busy on 은 모든 종료 분기에서 off 짝", "조용한 catch 금지" |

그 외(창 옵션 760x800·모달 아님·처음 투명·메뉴 없음, `ready-to-show`/`did-finish-load` 두 시점의
가운데 배치, `setBrowserOpacity`, `setShortcutLock(false)`, 메시지 키 `E20`/`sCODE`/`377`)는 **원본 그대로**입니다.

---

## 3. 검수 포인트

| # | 항목 | 봐달라는 것 |
|---|---|---|
| A | **원본 성격 판정** | 원본 `callTooltipsPopup` 이 정말 UI5 비의존인지. 이슈 본문("sap.m 팝업")이 틀렸다는 판단이 맞는지 |
| B | **원본 1:1** | 이식본 189행이 원본 140행과 동작상 동일한지. §2 표의 "달라진 곳 2가지" 외에 빠뜨린 차이가 있는지 |
| C | **busy 짝** | 세 곳 모두 진입 `setBusy("X")` 이후 **모든 종료 분기**에 off 짝이 있는지. 특히 앞갈래(통합 도움말)로 빠질 때 opener 가 `fnSetBusyLock("")` 로 끄는 것에 의존하는데, 그 의존이 원본과 동일한지 |
| D | **`getScript` 폴백 미이식** | 원본은 함수가 없으면 `getScript("design/js/callTooltipsPopup")` 로 불러온 뒤 호출한다. 이식본은 **앱 시작 시 항상 로드**하므로 그 경로를 두지 않고, 대신 미로드 시 `WS20HELP-12/22/32` 로 오류를 드러낸다. 이 선택이 타당한지 |
| E | **`_tbBtn` 공통 변경 파급** | `oCfg.press()` → `oCfg.press.call(BTN)` 로 바꿨다. UI 트리 툴바의 **다른 버튼 전부**가 영향받는데, 기존 핸들러가 `this` 를 쓰지 않아 무해하다고 판단했다. 실제로 그런지 |
| F | **원본 무수정 규칙** | 원본 폴더(`design/`) 안 파일을 한 줄도 안 고쳤는지. 신규 파일이 원본 폴더 밖에 있는지 |
| G | **오류 코드 표면화** | `WS20HELP-01`~`-32` 가 조용히 삼켜지지 않고 콘솔+안내로 드러나는지. 코드 구분이 추적에 쓸 만한지 |
| H | **다국어** | 경로가 `getUserInfo().LANGU` 로 갈리고 한국어·영어 도움말 문서 6개가 다 존재함을 확인했다. 그 외 언어일 때 원본과 동일하게(파일 없음 → 안내 후 종료) 되는지 |

---

## 4. 근거

- 원본: `U4A_WS_DESIGN/design/js/callTooltipsPopup.js` / `uiDesignArea.js` / `uiAttributeArea.js` / `uiPreviewArea.js`
- 이미 변환된 동일 로직: `www/ws30/ws10_20/Popups/bindPopup/utils/callTooltipsPopup.js`
- 코딩규칙: `.claude/rules/code.md` (원본 1:1 / 원본 무수정 / busy 짝 / 조용한 catch 금지 / 메시지 키 원본 참조)
- 메시지 키 실재 확인: `www/MSG/WS_COMMON/{KO,EN}/MESSAGE_CLASS.db` — `/U4A/CL_WS_COMMON` E20·E21·E22·E23, `/U4A/MSG_WS` 377 모두 존재

---

## 5. 이미 마친 검증 (참고)

실행중인 앱에 붙어(디버그 포트) 확인했습니다.

- 도움말 버튼 판정을 잠깐 "구버전 서버"로 바꾼 상태에서 **세 곳 모두 도움말 창이 뜸**
  (여는 문서: 디자인/속성/미리보기 각각 정확)
- 창 제목표시줄 = `Tooltips - 디자인 영역` (원본 제목 구성 그대로)
- 회색 대기 표시: 버튼 누른 순간 켜지고 창이 뜬 뒤 꺼짐. 잔류 없음 (세 곳 다)
- 판정을 원래대로 둔 상태(현재 서버) 회귀: 세 곳 다 통합 도움말 창 정상
- 폭이 좁아 물음표 버튼이 ⋯ 안으로 접힌 상태에서도 정상
- `node --check` 5개 파일 통과
- 실화면 테스트 10건 전량 통과 → `.works/도움말팝업/00_히스토리.md`

검증 도구(재현용): `.works/auto-test/br58-help-fallback-test.js`(자동 판정),
`.works/auto-test/br58-old-server-mode.js on|off`(손으로 확인할 때 켜기/끄기)

수정 전 백업: `www/ws30/ws10_20/js/_*.br58bak` 4개
