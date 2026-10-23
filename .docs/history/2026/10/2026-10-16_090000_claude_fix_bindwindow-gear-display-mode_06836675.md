# 바인딩 창 — 조회 모드에서 「화면 커스터마이징」 기어가 안 먹던 것 (구글시트 13번)

- 날짜 2026-10-16 · 세션 06836675 · type=fix · 장군님 지시 「원본대로 되살려줘」

## 요청

WS20 을 **조회 모드**로 들어간 뒤 바인딩 창의 각 영역 툴바 기어(957 화면 커스터마이징)를 눌러도
아무 일이 없다. 원본 WS3.0 은 조회 모드에서도 동작했고, 이 버튼은 영역을 보이고 숨기는
**레이아웃 변경뿐**이라 조회 모드에서도 되어야 한다.

## 원인 (원본과 대조)

- WS4.0 기어 3곳 핸들러 첫 줄에 `if (oAPP.attr.editable === false) { return; }` — **원본에 없는 가드**.
- 원본(`U4A_WS_DESIGN/Popups/bindPopup/`)은 기어를 `createBindLayoutCustomizingButton()` 하나로 만들고
  `enabled: "{/edit_layout_customizing}"` 만 건다(index.js:3084~3095).
  그 값의 **초기값이 true**(index.js:3976 · bindAdditInfo.js:95 · designTree.js:188)이고,
  잠금 함수 `setViewEditable` 은 **조회 모드(`IS_EDIT === ""`)면 맨 앞에서 return** 하므로
  값이 바뀌지 않는다(index.js:8042 · bindAdditInfo.js:1060 · designTree.js:2759)
  → **원본은 조회 모드에서도 기어가 활성**이다. 장군님 말씀대로다.
- 값이 false 가 되는 유일한 길 = **편집 모드에서 WS20 왕복 중 화면 잠금**.

## 고친 것 (가드 3줄 삭제)

| 어디 | 파일 |
|---|---|
| 왼쪽 모델필드 영역 기어 | `Popups/bindPopup/modelFieldArea/modelFieldArea.js` |
| 가운데 DESIGN TREE 영역 기어 | `Popups/bindPopup/designArea/designArea.js` |
| 오른쪽 추가속성 영역 기어 | `Popups/bindPopup/additInfoArea/additInfoArea.js` |

가운데 기어의 **동일속성 적용 팝업 열림 중 잠금**(`bSyncDialogLock`)은 **남겼다** —
원본 designTree.js:2657 이 그때 기어를 끄는 동작이 있어 그 재현이다.

## 같이 확인한 것

- 우측 기어를 끄는 길은 **동일속성 바인딩 화면 진입**뿐(`syncBindScreen.js:237`,
  원본 `designTree.js:2657`) — 조회 모드와 무관. 원본과 같다.
- 버튼을 만들 때 `disabled` 를 조회 모드로 거는 자리는 **없다**(가운데만 동일속성 잠금 시).
  즉 가드만 빼면 원본과 같아진다.

## 또 밟을 함정

- **「조회 모드니까 막아야지」로 가드를 넣지 말 것.** 원본은 잠금 함수가 조회 모드에서 **아무것도 안 하고
  나가는** 구조라, 조회 모드에서 오히려 **열려 있는** 버튼이 있다. 잠금 플래그를 쓰는 버튼은
  반드시 원본의 **초기값 + 잠금 함수의 early return** 까지 보고 판정한다.

## 검증

- `node --check` 3개 파일 통과. **앱으로는 안 돌려 봤다** — 장군님 테스트 대기.

---

## 이어서 — busy 가 모달 팝업 뒤로 숨던 것 (같은 창, 2026-10-16)

기어를 살리자 다음 문제가 드러났다. 화면 커스터마이징 팝업 안의 도움말을 누르면
**busy 가 그 팝업 뒤로 숨었다.**

- 원인: 그 팝업은 `showModal()` = **top layer**. 바인딩 창 busy 는 평범한 겹침 `div` 라 z-index 로는 못 이긴다.
- 고친 것: 바인딩 창을 **공통 busy** 로 바꿨다 — `frame.html` 에 `theme/u4a-busy.css`·`theme/u4a-busy.js` 로드,
  `frame.js` 의 busy 토글을 `U4ABusy.show()/hide()` 로 교체. 공통이 안 올라오면 옛 겹침 div 로 버티고
  `U4ALOG.warn("GUARD_EXIT", …)` 를 남긴다.
- **규칙으로 못 박았다**(장군님 지시 「모든 화면, 영역에는 반드시 공통 busy.. 반드시!!」):
  `.analy/16` §2.10(표로) · §0.1 컨닝시트 · `.claude/rules/code.md` · `.docs/CURRENT.md` 「먼저 알아야 할 것」.
  종전 §2.10 에 있던 「별도창은 자체 `<dialog>` 로 주입해도 된다」 문구가 **자체 busy 허용으로 읽혀** 이 사고를 낳았다 → 삭제.

### 아직 안 고친 것 — 같은 문제를 가진 별창 (조사 결과, 2026-10-16)

겹침 `div` 로 busy 를 만든 창(= 이 창 안에서 모달 팝업을 열면 busy 가 숨는다):
앱 기술 문서 · 편집기 · 오류 페이지 편집기 · Find · 글꼴 마법사 · 아이콘 미리보기 ·
일러스트 메시지 · 소스 패턴 · Runtime Class Navigator · 버전 관리 · OTR 값도움 ·
오류 메시지 창 · 별창 템플릿 — **13곳**.
※ MIME 리포지토리와 쇼컷링크 생성은 이미 `<dialog>` 라 숨지 않는다(다만 공통이 아니라 자체 `<dialog>`).

## 전수 조사 — busy 가 있는 별창 16곳 중 공통 busy 는 1곳뿐 (2026-10-16)

조사 방법: `www/ws30/ws10_20/Popups/` 아래 폴더 전수(`_` 접두 제외). 각 창의 html 에서 id 에 busy 가
들어간 오버레이 요소와, js 에서 `U4ABusy` 사용 여부를 함께 봤다.
제외: 내부 데이터 모니터(테스트용) · `optionPopup-origin` · `ui5CssPopup_v2`(구버전 폴더).

| 구분 | 창 |
|---|---|
| **공통 busy 사용(O)** | 바인딩 창 1곳 — 2026-10-16 이 턴에 교체 |
| **자체 `<dialog>`**(모달 위에는 보임, 그래도 공통 아님) | 쇼컷링크 생성 · MIME 리포지토리 · Monaco 스니펫 디자이너 · Monaco 테마 디자이너 — **4곳** |
| **자체 겹침 `div`**(모달 팝업 뒤로 숨는다 = 같은 사고 재발) | 앱 기술 문서 · 편집기 · 오류 페이지 편집기 · Find · 글꼴 마법사 · 아이콘 미리보기 · 일러스트 메시지 · 소스 패턴 · Runtime Class Navigator · UI5 미리정의 CSS · 버전 관리 — **11곳** |

★ 특히 헷갈리는 것: **Find 창과 UI5 미리정의 CSS 창은 공통 busy 와 똑같은 id(`u4aWsBusyIndicator`)를
붙인 평범한 `div`** 다(UI5 시절 마크업을 그대로 베낀 흔적 — `data-sap-ui-popup` 속성까지 남아 있다).
**이름만 보고 "공통을 쓰네"라고 판정하면 틀린다.** 반드시 요소가 `<dialog>` 인지, `u4a-busy.js` 를 로드하는지 본다.
