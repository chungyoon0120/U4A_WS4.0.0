# 구버전 UI5 Predefined CSS 창의 테마 이름이 서버에 그대로 넘어가 색이 깨지던 것 (TODO 52)

- 날짜: 2026-10-14
- 종류: fix
- 세션: abc286a4
- 지시: 장군님 「이전 팝업 띄우니까 테마 정보가 잘못된거 같아 현재 신 버전이랑 똑같이 할 수 없나?
  UI5 버전을 넣어야 하는데 지금 ws4.0 테마 정보로 하니까 저런 현상이 발생되는거 같은데..」
  → 「신 버전 창에서 했던 방식을 참고해서 작업해줘」

## 1. 증상 (장군님 화면 캡처)

구버전 창을 콘솔로 띄우니 설명 목록의 색이 깨지고, 그 창 콘솔에 404 가 줄줄이 떴다.

```
GET .../resources/sap/ui/core/themes/horizon_white/library.css  404 (Not Found)
GET .../resources/sap/m/themes/horizon_white/library.css        404 (Not Found)
... (6건)
[FUTURE FATAL] One or more parameters could not be found. - sap.ui.core.theming.Parameters
```

## 2. 원인

WS4 테마 키(`horizon_white` 등)를 **UI5 테마 이름으로 바꾸지 않고** 서버(`/getui5_pre_css`)에
그대로 넘겼다. 서버 UI5 에는 그 이름의 테마 CSS 가 없어 전부 404 → 파라미터 조회 실패 → 색 깨짐.

- 넘기던 자리: `Popups/ui5CssPopup/frame.js` 의 `if-ui5css-info` 수신부
  — `sThemeName = oInfo.oThemeInfo.THEME` (raw 값)
- opener 는 `oThemeInfo` 를 통째로 보내므로 `BGCOL` 도 함께 와 있다.

**신 버전 창(`ui5CssPopup_v2`)에는 변환이 이미 있었다** — 그 파일 주석이 같은 함정을 그대로 적어 두었다:
「raw 키를 그대로 넘기면 .../themes/<key>/library.css 404 → Parameters 실패 → 색 깨짐」.

## 3. 한 일

`www/ws30/ws10_20/Popups/ui5CssPopup/frame.js` 한 파일, 두 자리.

1. 신 버전 창의 `oAPP.fn.toUI5Theme(sKey, sBgCol)` 를 **그대로** 가져와 `getThemeInfo` 아래에 뒀다.
   - 키에 `dark` 가 있거나 **배경색 휘도가 128 미만**이면 `sap_horizon_dark`, 아니면 `sap_horizon`.
   - 3자리 단축 hex(`#abc`)·`rgb(r,g,b)` 두 모양 다 받는다.
2. 서버로 보낼 값을 그 함수에 통과시켰다.
   `sThemeName = oAPP.fn.toUI5Theme(oInfo.oThemeInfo && oInfo.oThemeInfo.THEME, … && .BGCOL)`

`node --check` 통과.

## 4. 같이 확인한 것

- 창 화면(`frame.html`)은 쿼리의 **BGCOL 만** 쓴다(첫 페인트 흰 플래시 방지). THEME 은 UI5 로
  넘기지 않으므로 **고칠 자리는 한 군데뿐**이었다.
- 같은 변환 함수가 아이콘 미리보기 창·일러스트 메시지 창에도 이미 들어가 있다(이름·동작 동일).

## 5. 또 밟을 함정

1. **WS4 테마 키와 UI5 테마 이름은 다르다.** UI5 로 넘어가는 자리(부트스트랩 `data-sap-ui-theme`,
   `applyTheme`, 서버 CSS 요청)에는 **반드시 변환해서** 넘긴다. 그대로 넘기면 조용히 404 가 나고
   화면은 「색만 이상한」 상태가 된다 — 오류창이 안 뜨므로 눈치채기 어렵다.
2. **신·구 두 벌인 창은 한쪽만 고쳐지기 쉽다.** 이 창은 서버가 3.4.2-sp2 이상이면 신 버전이 떠서,
   구버전 쪽 결함이 오래 안 드러났다. 구버전 경로는 콘솔에서 오프너 함수를 직접 불러 확인한다
   (`oAPP.fn.fnUI5PredefinedCssPopupOpener()` — WS20 화면 콘솔에서).

## 6. 아직 안 한 것

- **라이브 테마 변경 추종**: 신 버전 창은 떠 있는 동안 테마가 바뀌면 따라가지만, 구버전 창에는 그
  구독이 없다. 이번 지시 범위(테마 이름 변환) 밖이라 **건드리지 않았다.** 필요하면 지시받고 넣는다.
- 테스트는 장군님 확인 대기(TODO 52).

## 7. 테스트 결과

- **2026-10-14 장군님 「52번 테스트 통과」** — 구버전 창의 색이 제대로 나오고, 테마 CSS 를 못 찾던
  빨간 줄도 사라졌다.
- 이 수정으로 **49번의 구버전 UI5 Predefined CSS 창도 띄울 수 있게 되어**, 미검증이던 창 자리
  재배치를 이어서 테스트할 수 있다(TODO 49-3).
- **2026-10-15 장군님 「49-3 테스트 통과」** — 이 수정 덕에 구버전 창을 띄울 수 있게 되어,
  49번의 마지막 미검증분(창 자리 재배치)도 그 창으로 확인을 마쳤다.
