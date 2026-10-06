# busy 표시 지연(0.3초) 제거 — 원본대로 즉시 표시

## 요청

장군님 지시 3단.

1. "브라우저 윈도우 실행시 busy부터 키고 시작해야되는데 그렇지 않은데가 상당 수 있어. 느린 pc에서 실행하면
   다크테마일 경우, 검은 화면 부터 나오고 조금 뒤에 busy가 실행되. … 조사시작해라"
2. "0.3초 지연을 왜 한거지?"
3. **"지연 없애고 원본대로 즉시 표시로 고쳐"** ← 이번에 실행한 것

## 변경 내용

공통 busy 오버레이의 **표시 지연 0.3초 + 페이드인 0.18초를 제거**해 켜는 즉시 뜨게 했다.
같은 흉내를 JS 로 하던 한 곳(300ms 타이머)과, 그 지연을 취소하려고 화면마다 덧대 놓은 규칙 2곳도 같이 정리했다.

| 대상 | 전 | 후 |
|---|---|---|
| 공통 busy 오버레이 (`theme/shell.css`) | `transition: opacity 0.18s linear 0.3s, visibility 0s linear 0.3s` | `transition: none` |
| U4A MIME Repository (`Popups/mimeRepository/frame.js`) | `setTimeout(... showModal(), 300)` | 즉시 `showModal()` |
| UI Find (`Popups/findPopup/findFrame.css`) | 지연 취소 덧댐(`0.12s` 페이드) | 삭제 — 공통이 즉시 |
| 속성 기본값 팝업 (`design/attrPresetPopup/list/css/index.css`) | 지연 취소 덧댐(`transition-delay: 0s`) | 삭제 — 공통이 즉시 |
| 속성 바인딩 팝업 (`Popups/bindPopup/frame.css`) | `#bwpBusy { transition: none; }` + 옛 설명 | 규칙 유지, 주석만 현행화 |

**끄는 쪽(페이드아웃)은 건드리지 않았다.** 지시는 "표시 지연 제거"였고, 끄는 쪽은 창이 늦게 보이는 문제와 무관하다.

그 밖에 "0.3s 지연"이라고 적혀 있던 **주석 11곳**을 현행화했다(동작 변화 없음).

## 변경 파일

- 추가:
  - `.works/별창busy시작/00_현황판.md` (테스트 BD1~BD5 + 남은 결정사항)
  - `.works/별창busy시작/01_전수조사.md` (별창 busy 전수조사 결과)
  - 백업 15개 (`_<원본이름>.busydelaybak`) — 고친 파일과 주석만 고친 파일 전부

- 변경 (동작):
  - `www/ws30/ws10_20/theme/shell.css` — 공통 busy 표시 지연·페이드 제거
  - `www/ws30/ws10_20/Popups/mimeRepository/frame.js` — 300ms 타이머 제거
  - `www/ws30/ws10_20/Popups/findPopup/findFrame.css` — 덧댐 삭제
  - `www/ws30/ws10_20/design/attrPresetPopup/list/css/index.css` — 덧댐 삭제

- 변경 (문서·주석만):
  - `.analy/16_공통_화면UX_표준.md` — §2.10 에 「busy 는 지연 없이 즉시 표시」 표준 기록
  - `www/ws30/ws10_20/Popups/bindPopup/frame.css`
  - `www/ws30/ws10_20/Popups/docPopup/frame.html`
  - `www/ws30/ws10_20/Popups/editorPopup/editor.css` · `editorFrame.html`
  - `www/ws30/ws10_20/Popups/errMsgPopup/frame.css` · `frame.html`
  - `www/ws30/ws10_20/Popups/errPageEditorPopup/errorPageEditorFrame.css` · `.html`
  - `www/ws30/ws10_20/Popups/mimeRepository/frame.html`
  - `www/ws30/ws10_20/Popups/optionPopup/js/optionMain.js`
  - `www/ws30/ws10_20/Popups/OTRF4HelpPopup/frame.css` · `frame.html`

- 삭제: 없음

## 변경 이유

**그 지연은 원본에 없는 임의 창작이었다 — 내가 넣은 것이다.**

- 처음 변환(`c57753cb`, 2026-06-12 16:33)에는 지연이 없었다(즉시 표시).
- 같은 날 3시간 뒤 `37e4cdce`(2026-06-12 19:50, 로그인 화면 HTML5 컨버전) 에서 내가 추가했다.
- 남아 있는 근거는 주석 한 줄뿐 — "짧은 busy(빠른 on/off)는 화면에 나타나지 않아 깜빡임 없음".
- `.analy` 어디에도 이 지연에 대한 근거가 없다.
- **원본(UI5)은 반대다.** busy 를 띄울 때 지연값을 항상 `0` 으로 넘긴다
  (`sap.ui.core.BusyIndicator.show(0)` — 원본 폴더 전수 13곳 모두 `0`. UI5 기본값 1000ms 를 일부러 끈 것).

**그 지연이 만든 실제 피해 3가지**

1. 별창이 화면에 나타나는 순간 테마 배경만 깔린 빈 창이 0.3~0.5초 먼저 보였다
   — 느린 PC·다크 테마에서 장군님이 보신 **검은 화면**.
2. 수십 ms 짜리 짧은 처리는 페이드가 끝나기 전에 busy 가 꺼져 **아예 안 떴다.**
   2026-08-04 에 이미 한 번 터졌는데, 그때 나는 원인을 busy 켜는 **위치** 문제로 오진하고
   함수를 옮겨 다니며 **세 번 헛발질**한 뒤 속성 바인딩 팝업 한 곳만 예외 처리해 덮었다.
3. 그 탓에 화면마다 지연을 취소하는 덧댐 규칙이 번지고 있었다(발견 3곳).

## 영향 범위

**전 화면.** 공통 busy 오버레이는 별창뿐 아니라 ServerList·메인 화면 등 이 스타일을 쓰는 모든 화면이 공유한다.

- 눈에 보이는 변화 = busy 스피너 카드가 **더 빨리** 뜬다. 그 외 배치·색·크기 변화 없음.
- 전에 안 보이던 짧은 busy 가 이제 보인다 → **깜빡임이 늘어날 수 있다.** 거슬리는 자리가 나오면
  그 자리만 따로 다룬다(현황판 BD5).
- 메인 화면 busy(`index.html` 의 `<dialog>` 판)는 원래 지연이 없었다 — 이번 변경과 무관.

## 검증

- `node --check www/ws30/ws10_20/Popups/mimeRepository/frame.js` → 통과
- 프로젝트 전체에서 남은 0.3초 지연 코드 0건 확인(백업 파일 제외). 남은 문자열 2건은 내가 새로 쓴 설명 주석이다.
- `git diff --stat` 로 줄바꿈 통째 변환 사고 없음 확인 — 고친 파일들이 실제 고친 줄 수만큼만 바뀌었다
  (`shell.css` 13줄, `mimeRepository/frame.js` 10줄, 주석만 고친 파일들 2줄).
- **실화면 테스트는 안 했다(미확인).** 앱 재시작이 필요하고, 장군님 테스트 항목 5건을
  `.works/별창busy시작/00_현황판.md` 에 올려 뒀다(BD1~BD5).

## 참고 사항

### 규칙과 어긋난 점 (숨기지 않고 적는다)

프로젝트 규칙은 **"공통 자산(shell 등) 직접 수정 금지 → 스코프 override"** 다.
이번엔 공통(`theme/shell.css`)을 직접 고쳤다. 이유는 두 가지다.

1. 장군님이 **지연 자체를 없애라고 지시**하셨다.
2. 화면별 override 야말로 이번에 걷어내는 대상이었다 — override 로 처리하면 같은 문제가 더 번진다.

### 아직 안 고친 것 — 이번 지시의 원래 문제는 절반만 해결됐다

검은 화면의 원인은 둘이었다.

- **원인 B(0.3초 지연)** → 이번에 해결.
- **원인 A(창이 나타나는 순간 그 창의 busy 가 꺼져 있음)** → **그대로 남아 있다.**
  창 페이지 21곳 중 첫 페인트부터 busy 가 켜져 있는 곳은 여전히 3곳뿐이고,
  7곳은 창이 뜰 때 busy 를 아예 안 켠다(부모 창 busy 만 믿는다).
  전수 목록·고치는 법 = `.works/별창busy시작/01_전수조사.md`, 결정 대기 = 같은 폴더 현황판 D1·D3·D4.

### 로그

CSS 규칙 변경과 타이머 제거라 새 분기가 생기지 않았다. 기존 오류 로그(`U4ALOG.caught`)는 그대로 유지했다.

### 커밋

**안 했다.** 지시 있을 때만 커밋한다. 백업 파일 15개도 아직 그대로 남아 있다.
