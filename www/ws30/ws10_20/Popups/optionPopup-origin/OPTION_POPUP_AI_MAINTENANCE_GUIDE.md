# 옵션 팝업 기능 및 유지보수 컨텍스트

작성일: 2026-07-16  
대상 경로: `www/ws30/ws10_20/Popups/optionPopup`

## 문서 목적

이 문서는 옵션 팝업 개선 과정에서 논의하고 반영한 요구사항, 오류 원인, 현재 기능 구조, 로직 처리 방식, 유지보수 주의점을 정리한다.

향후 AI 또는 개발자가 다음 작업을 수행할 때 참고할 수 있도록 작성한다.

- 기존 옵션 팝업 기능 분석
- 회귀 테스트 항목 도출
- UI/UX 개선
- 신규 화면 재구성
- 서버/패치 조건 기반 기능 노출 제어
- Electron/Chromium 제약 검토

## 전체 구성 요약

| 영역 | 주요 파일 | 역할 |
| --- | --- | --- |
| 옵션 팝업 Shell | `main/index.html`, `main/index.css`, `main/index.js` | 좌측 메뉴, 우측 iframe, 창 제어, Busy, 최소 크기, 메뉴 전환 |
| 공통 초기화 | `js/index.js` | Electron remote, PATHINFO, WSUTIL, USERINFO, 메시지 클래스, oAPP 구성 |
| 공통 유틸 | `common/util.js` | 테마 적용, 메시지, 경로, SYSID, 도움말 호출, WLO 기반 도움말 버튼 표시 제어 |
| 공통 팝업 | `common/popup.js` | confirm, prompt, toast, 입력값 검증/오류 표시 |
| 공통 색상 팔레트 | `common/colorPalette.js` | 색상 칩, custom color, HEX, opacity 선택 팝업 |
| 아이콘 | `common/iconFont.js` | SAP icon font 적용 |
| DB | `common/db.js` | UI 선택 스타일 프리셋/매핑 저장, 기본 프리셋 관리 |
| 테마 설정 | `theme/index.html`, `theme/index.css`, `theme/index.js` | 테마 DDLB, 테마 미리보기, 테마 저장, 도움말 버튼 |
| UI 선택 스타일 설정 | `selectionEffect/index.html`, `selectionEffect/index.css`, `selectionEffect/index.js` | UI 선택 강조 효과, 프리셋 저장/수정/삭제, 색상/네온/사선 효과, 미리보기 |

## 런타임 및 환경 제약

현재 확인된 Electron/Chromium 정보는 다음과 같다.

| 항목 | 값 |
| --- | --- |
| Electron | `14.2.9` |
| Chrome | `93.0.4577.82` |
| Node | `14.17.0` |
| V8 | `9.3.345.20-electron.0` |

중요 제약:

- `EyeDropper API`는 Chrome 95 이상에서 지원된다.
- 현재 Chrome 93 기반 Electron 14 환경에서는 `new EyeDropper().open()` 사용이 불가능하다.
- 따라서 색상 팔레트는 현재 브라우저 기본 `input type="color"` 방식으로 유지한다.
- Electron 업그레이드가 어렵다면 브라우저 내장 EyeDropper 방식은 적용하지 않는다.

## 작업 및 요구사항 반영 이력

### 1. UI 선택 스타일 GAP 최소값 변경

문제:

- GAP 입력 필드에 `20`을 입력하려고 할 때, 첫 글자인 `2` 입력 순간 점검 로직이 기존 최소값 `4`를 강제하여 `2`가 `4`로 바뀌었다.

처리:

- `stripeGap` 최소값을 `4`에서 `1`로 변경했다.

관련 파일:

- `selectionEffect/index.html`

현재 기준:

```html
<input id="stripeGap" type="range" min="1" max="96" data-field="STRIPE_GAP" data-suffix="px">
```

유지보수 주의:

- 숫자 입력을 단계적으로 입력하는 UX에서는 최종 값 기준 검증만 고려하면 사용자가 중간 입력을 할 수 없다.
- range/input 조합에서 min을 변경할 때는 미리보기 로직과 DB 저장값 범위도 함께 확인한다.

### 2. 옵션 팝업 최소 높이 500px 적용

문제:

- 옵션 팝업이 너무 작아지면 내부 UI와 하단 액션 버튼이 잘릴 수 있었다.

처리:

- 옵션 팝업 최소 높이를 `500px` 기준으로 보정했다.

관련 파일:

- `main/index.js`

핵심 상수:

```js
const MIN_WINDOW_HEIGHT = 500;
```

유지보수 주의:

- Electron BrowserWindow의 `setMinimumSize` 또는 기존 최소 크기와 충돌하지 않도록 `Math.max` 기준으로 적용한다.
- 내부 iframe 화면도 500px 근처에서 레이아웃이 버티도록 각 화면별 compact CSS를 같이 점검해야 한다.

### 3. 프리셋명 입력 길이 40자 제한

요구:

- Save User Preset 팝업과 Rename Preset 팝업 모두 프리셋명 입력 길이를 40자로 제한한다.

처리:

- UI 선택 스타일 화면에 `PRESET_NAME_MAX_LENGTH = 40` 상수를 추가했다.
- Save User Preset, Rename Preset prompt 호출 시 `maxLength`를 전달한다.
- 공통 prompt 팝업이 `options.maxLength`를 받아 input `maxLength`로 적용하도록 했다.

관련 파일:

- `selectionEffect/index.js`
- `common/popup.js`

핵심 코드:

```js
const PRESET_NAME_MAX_LENGTH = 40;
```

```js
const iMaxLength = Number(options?.maxLength);

if (Number.isFinite(iMaxLength) === true && iMaxLength > 0) {
    oInput.maxLength = Math.floor(iMaxLength);
}
```

유지보수 주의:

- 길이 제한은 UI input 레벨에서만 끝내지 말고, 필요하면 DB 저장 전 검증도 고려한다.
- 현재는 prompt 공통 로직에 추가되었으므로 다른 prompt에서 `maxLength`를 넘기면 동일하게 적용된다.

### 4. 기본 프리셋 저장 시 프리셋명 중복 검사

문제:

- 기본 프리셋 값을 변경한 뒤 Save User Preset으로 저장할 때 기존 프리셋명과 중복되어도 막지 못했다.
- Rename Preset 팝업에는 이미 중복 검사 메시지가 있었다.

요구:

- 기본 프리셋 저장 시에도 기존 프리셋명 중복 여부를 검사한다.
- 중복 시 Rename Preset에서 사용하던 메시지 클래스를 그대로 출력한다.

처리:

- 기존 `validatePresetName(name, currentSelky)` 함수를 Save User Preset validate에도 재사용했다.
- 빈 값은 Save User Preset 전용 필수 입력 메시지를 유지한다.
- 값이 있는 경우 중복 검사를 수행하고, 중복이면 `ZMSG_WS_COMMON_001 / 841` 메시지를 표시한다.

관련 파일:

- `selectionEffect/index.js`

메시지:

| 키 | 메시지 클래스 | 의미 |
| --- | --- | --- |
| `PRESET_NAME_DUPLICATE` | `ZMSG_WS_COMMON_001 / 841` | 같은 이름의 프리셋이 이미 있음 |
| `PRESET_DESC_REQUIRED` | `ZMSG_WS_COMMON_001 / 846` | 저장 프리셋 설명 필수 |

핵심 흐름:

```js
validate: function (value) {
    if (!value) {
        return text("PRESET_DESC_REQUIRED");
    }

    return validatePresetName(value);
}
```

중복 비교 기준:

- `preset.SELTX`
- `getPresetOptionText(preset)`
- 기본 프리셋 표시용 suffix `(Default)` 또는 한국어 suffix 제거 후 비교
- 대소문자 무시
- Rename의 경우 현재 선택 프리셋 `SELKY`는 중복 비교에서 제외

유지보수 주의:

- 프리셋 표시명과 실제 저장명 모두 비교하는 이유는 기본 프리셋 suffix가 UI에 붙기 때문이다.
- 기본 프리셋명과 사용자 프리셋명이 충돌하면 사용자 혼동이 크므로 저장 단계에서 막아야 한다.

### 5. UI 선택 스타일 하단 버튼 잘림 보정

문제:

- 옵션 팝업 크기가 작거나 compact 레이아웃이 적용될 때 `Apply`, `Delete` 버튼 일부가 화면 하단에서 잘렸다.

처리:

- 하단 액션 영역 높이를 늘리고 버튼 아래 안전 여백을 추가했다.
- narrow layout에서 settings/preview 최소 높이가 과하게 잡혀 footer를 밀어내지 않도록 조정했다.

관련 파일:

- `selectionEffect/index.css`

핵심 CSS:

```css
.se-page {
    grid-template-rows: minmax(0, 1fr) 54px;
}

.se-actions {
    min-height: 54px;
    padding: 7px 14px 13px;
}
```

compact 레이아웃:

```css
@media (max-width: 760px) {
    .se-layout {
        grid-template-columns: 1fr;
        grid-template-rows: minmax(160px, var(--se-settings-height)) 8px minmax(120px, 1fr);
    }

    .se-preview-target,
    .se-preview-card {
        min-height: 120px;
    }
}
```

유지보수 주의:

- footer 자체만 늘리면 해결되지 않을 수 있다.
- 부모 grid의 row min-height와 preview/settings 최소 높이를 같이 봐야 한다.
- 500px 높이 근처에서 반드시 직접 확인한다.

### 6. Delete 버튼 위험 색상 적용

요구:

- UI 선택 스타일 화면 하단 Delete 버튼을 붉은색으로 표시한다.

처리:

- Delete 버튼에 `se-action--danger` modifier 클래스를 추가했다.
- 라이트/다크 테마와 disabled 상태 스타일을 각각 정의했다.

관련 파일:

- `selectionEffect/index.html`
- `selectionEffect/index.css`

핵심 HTML:

```html
<button id="deleteButton" class="se-action se-action--danger" type="button">
```

유지보수 주의:

- Delete 버튼은 기본 프리셋 선택 시 disabled 상태가 될 수 있다.
- disabled 상태도 위험 동작임을 알 수 있게 붉은 계열을 유지하되 opacity로 비활성 상태를 표현한다.

### 7. 네온 효과 스위치 클릭 범위 제한

문제:

- 네온 효과 메뉴에서 라벨 또는 스위치 오른쪽 빈 영역을 클릭해도 스위치가 토글되었다.
- 원인은 전체 항목이 `<label class="se-switch">`로 감싸져 있어 label 전체가 checkbox 클릭으로 전달되었기 때문이다.

요구:

- 스위치 자체를 누를 때만 토글되도록 변경한다.

처리:

- 외부 wrapper를 `label`에서 `div`로 변경했다.
- 실제 스위치 트랙만 `for="borderNeon"` 라벨로 연결했다.

관련 파일:

- `selectionEffect/index.html`
- `selectionEffect/index.css`

핵심 구조:

```html
<div class="se-switch">
    <span data-opt-msg-cls="ZMSG_WS_COMMON_001" data-opt-msg-no="834" data-opt-suffix=":"></span>
    <span class="se-switch__control">
        <input id="borderNeon" type="checkbox">
        <label class="se-switch__track" for="borderNeon" aria-hidden="true"></label>
    </span>
</div>
```

유지보수 주의:

- checkbox 자체는 hidden/transparent 상태이므로 keyboard 접근성을 추가로 강화하려면 focus style을 별도 고려한다.
- 클릭 범위를 의도적으로 좁힌 요구사항이므로 label 전체 감싸기 패턴으로 되돌리지 않는다.

### 8. 색상 팔레트 및 스포이드 관련 결정

문제:

- UI 선택 스타일 색상 팔레트에서 Custom Color의 Chromium 기본 색상 선택 팝업을 열고 스포이드를 선택하면, 옵션 팝업 바깥 영역을 제대로 선택하지 못했다.
- 사용자 관찰상 z-index 문제처럼 보였으나, 실제로는 Chromium native color picker와 Electron 창/레이어 캡처 동작의 제약으로 판단했다.

검토한 선택지:

1. `EyeDropper API`
2. Electron `desktopCapturer` 기반 커스텀 스포이드
3. 기존 `input type="color"` 유지

결론:

- 현재 Electron 14 / Chrome 93 환경에서는 `EyeDropper API`를 사용할 수 없다.
- 임시로 검토했던 `desktopCapturer` 또는 overlay 기반 스포이드 로직은 최종적으로 원복했다.
- 현재 색상 팔레트는 기존 Chromium `input type="color"` 기반으로 유지한다.

관련 파일:

- `common/colorPalette.js`

현재 상태:

```js
const oColor = document.createElement("input");
oColor.type = "color";
oColor.value = rgbToHex(oSelected);
```

현재 CSS:

```css
.op-palette__custom input[type="color"] {
    width: 42px;
    height: 30px;
}
```

유지보수 주의:

- `EyeDropper API`를 다시 적용하려면 최소 Chrome 95 이상이 필요하다.
- Electron 기준으로는 Electron 16 이상부터 Chromium 96이 포함되어 안정 조건을 만족한다.
- Electron 업그레이드 전에는 PhotoKit 방식의 `new EyeDropper().open()` 구현을 넣지 않는다.
- native color picker 내부 UI는 앱 코드에서 z-index로 제어할 수 있는 일반 DOM이 아니다.

### 9. 도움말 버튼 WLO 조건 표시

요구:

- 옵션 팝업에서 현재 접속 SYSID 기준으로 `oAPP.WSUTIL.getWsWLOListAsync(SYSID)`를 호출한다.
- 반환 array에 다음 항목이 있으면 도움말 버튼을 표시한다.

```js
item.REGTYP === "C" && item.CHGOBJ === "UHAK901435"
```

초기 요구는 "활성화"였으나, 이후 "아예 안 보이게"로 변경되었다.

처리:

- 공통 유틸에 WLO 조회 및 캐시 로직을 추가했다.
- 도움말 버튼은 기본적으로 hidden/display none 상태다.
- WLO 목록에서 `UHAK901435`가 확인되면 화면에 표시한다.
- 조회 실패, SYSID 없음, API 없음, 목록 형식 오류 시 숨김 상태를 유지한다.

관련 파일:

- `common/util.js`
- `theme/index.js`
- `selectionEffect/index.js`
- `theme/index.css`
- `selectionEffect/index.css`

핵심 상수:

```js
const HELP_WLO_CHGOBJ = "UHAK901435";
```

핵심 함수:

```js
function isHelpButtonAvailable() {
    const sSysID = getSysId();
    const oWsUtil = getWsUtil();

    if (!sSysID || typeof oWsUtil?.getWsWLOListAsync !== "function") {
        return Promise.resolve(false);
    }

    if (!oHelpAvailabilityCache[sSysID]) {
        oHelpAvailabilityCache[sSysID] = Promise.resolve(oWsUtil.getWsWLOListAsync(sSysID))
            .then(function (list) {
                if (Array.isArray(list) === false) {
                    return false;
                }

                return list.some(function (item) {
                    return item?.REGTYP === "C" && item?.CHGOBJ === HELP_WLO_CHGOBJ;
                });
            })
            .catch(function () {
                return false;
            });
    }

    return oHelpAvailabilityCache[sSysID];
}
```

표시 제어:

```js
button.hidden = true;
button.style.display = "none";
button.disabled = true;

return isHelpButtonAvailable().then(function (available) {
    const bAvailable = available === true;
    button.hidden = bAvailable !== true;
    button.style.display = bAvailable ? "" : "none";
    button.disabled = bAvailable !== true;
});
```

적용 화면:

| 화면 | 버튼 | 연결 위치 |
| --- | --- | --- |
| Theme Setting | `themeHelpButton` | `theme/index.js` |
| UI Selection Style Settings | `previewHelpButton` | `selectionEffect/index.js` |

유지보수 주의:

- 버튼을 disabled로 남기지 말고, 조건 미충족 시 화면에서 숨긴다.
- 새 옵션 화면에 도움말 버튼을 추가하면 `OptionPopupUtil.applyHelpButtonAvailability(button)`를 동일하게 호출한다.
- WLO 결과는 SYSID별 Promise로 캐시한다.

### 10. 테마 설정 화면 레이아웃 변경

기존 구조:

- 상단 타이틀
- 좌측 테마 선택 form
- 좌우 splitter
- 우측 미리보기 이미지
- 하단 Apply 버튼

요구:

- 테마 선택 툴바 오른쪽에 DDLB 배치
- 좌우 splitter 제거
- 기존 오른쪽 미리보기 이미지를 툴바 하단에 크게 배치
- DDLB 오른쪽의 중복 `테마 선택` 텍스트 제거
- DDLB는 왼쪽 타이틀 옆에 적절한 여백을 두고 배치

처리:

- HTML에서 `theme-layout`, `theme-form`, `themeSplitter` 구조를 제거했다.
- `theme-title` 안에 title, DDLB, 도움말 버튼을 배치했다.
- 미리보기 이미지는 header 아래 단일 `theme-preview-wrap` 영역으로 이동했다.
- JS에서 splitter 관련 DOM 참조, 초기화, pointer/keyboard resize 로직을 제거했다.
- 테마 선택, 미리보기 변경, 적용 저장 로직은 유지했다.

관련 파일:

- `theme/index.html`
- `theme/index.css`
- `theme/index.js`

현재 HTML 구조:

```html
<header class="theme-title">
    <h1 id="themeTitle" data-opt-msg-cls="/U4A/CL_WS_COMMON" data-opt-msg-no="C65"></h1>
    <div class="theme-toolbar-field">
        <select id="themeSelect" aria-labelledby="themeTitle"></select>
    </div>
    <button id="themeHelpButton" class="opt-help-button" type="button">
        ...
    </button>
</header>

<div class="theme-preview-wrap">
    <img id="themePreview" class="theme-preview" alt="theme preview">
</div>
```

현재 CSS 레이아웃:

```css
.theme-page {
    display: grid;
    grid-template-rows: 52px minmax(0, 1fr) 44px;
}

.theme-title {
    display: grid;
    grid-template-columns: auto minmax(260px, 360px) minmax(0, 1fr) auto;
    gap: 16px;
}

.theme-preview {
    width: min(920px, 100%);
    max-height: 100%;
    object-fit: contain;
}
```

반응형:

- `max-width: 760px`에서는 header가 2줄 구조로 변경된다.
- DDLB는 두 번째 줄 전체 폭을 사용한다.
- 도움말 버튼은 우측 상단에 유지된다.

유지보수 주의:

- `themeSplitter`, `theme-layout`, `theme-form`, `theme-field` 클래스는 현재 구조에서 사용하지 않는다.
- 새 화면에서 splitter가 필요하지 않다면 관련 pointer/keyboard resize JS를 추가하지 않는다.
- 테마 DDLB는 `aria-labelledby="themeTitle"`로 접근성 라벨을 대체하므로 별도 텍스트 라벨을 다시 추가하지 않는다.

### 11. 점검 시트 Markdown 작성

요구:

- 그간 논의한 오류사항을 종합하여 점검 시트 항목을 Markdown으로 작성한다.

처리:

- `OPTION_POPUP_ISSUE_CHECKLIST.md` 파일을 작성했다.
- 주요 점검 항목: minHeight, GAP, 프리셋 검증, 색상 팔레트 원복, 버튼 잘림, Delete 색상, 네온 스위치, 도움말 WLO 조건.

관련 파일:

- `OPTION_POPUP_ISSUE_CHECKLIST.md`

현재 이 문서는 유지보수/AI 분석용 상세 컨텍스트이고, `OPTION_POPUP_ISSUE_CHECKLIST.md`는 테스트 실행용 체크리스트 성격이다.

## 현재 주요 로직 흐름

### 옵션 팝업 Shell

1. `main/index.html`이 좌측 메뉴와 iframe 영역을 구성한다.
2. `main/index.js`가 메뉴 선택에 따라 iframe에 각 화면을 로드한다.
3. 공통 테마는 `OptionPopupUtil.applyThemeShell()`을 통해 적용한다.
4. 창 최소 높이는 `MIN_WINDOW_HEIGHT = 500` 기준을 따른다.
5. Busy 상태는 `OptionPopupMain.setBusy()` 또는 `oAPP.fn.setBusy()` 흐름으로 처리한다.

### 테마 설정 흐름

1. `theme/index.js` 초기화 시 테마 목록을 select에 렌더링한다.
2. 저장된 사용자 테마 정보를 읽어 현재 select 값을 설정한다.
3. select 변경 시 `setPreview(theme)`로 이미지 경로를 바꾼다.
4. Apply 클릭 시 SYSID별 theme json에 저장한다.
5. IPC로 theme 변경을 알리고 현재 팝업에도 즉시 테마를 적용한다.
6. 도움말 버튼은 WLO 조건 충족 시에만 보인다.

### UI 선택 스타일 설정 흐름

1. DB에서 effect type과 preset 목록을 로드한다.
2. 기본 프리셋과 사용자 프리셋을 select에 표시한다.
3. slider/value input 변경 시 `oState.current`가 갱신되고 미리보기가 업데이트된다.
4. 색상 버튼 클릭 시 `OptionPopupColorPalette.open()`을 호출한다.
5. 기본 프리셋을 수정하고 Apply하면 Save User Preset prompt를 띄운다.
6. 사용자 프리셋을 수정하고 Apply하면 update confirm 후 기존 프리셋을 갱신한다.
7. 기본 프리셋은 rename/delete 불가다.
8. 사용자 프리셋 rename 시 이름 필수/중복 검사를 수행한다.
9. 사용자 프리셋 delete 시 default preset으로 매핑을 되돌린다.
10. 도움말 버튼은 WLO 조건 충족 시에만 보인다.

## 파일별 유지보수 메모

### `main/index.js`

- `MIN_WINDOW_HEIGHT = 500`이 옵션 팝업 최소 높이 기준이다.
- 이 값 변경 시 theme/selectionEffect의 compact 레이아웃도 같이 확인한다.
- iframe 로드 경로 문제는 이 파일 또는 상위 팝업 opener URL 구성과 관련될 수 있다.

### `common/util.js`

- 옵션 팝업 공통 중추 파일이다.
- SYSID, USERINFO, PATHINFO, WSUTIL, 테마, 메시지, 도움말 관련 함수가 모여 있다.
- WLO 기반 도움말 버튼 표시 제어가 추가되어 있다.
- 새 화면에 도움말 버튼을 추가하면 `applyHelpButtonAvailability` 사용을 우선 검토한다.

### `common/popup.js`

- prompt 입력 필드에 `maxLength` 옵션이 추가되어 있다.
- prompt validation은 문자열 메시지를 반환하면 field error로 표시된다.
- Save/Rename 프리셋 검증은 이 공통 prompt 에러 UI를 사용한다.

### `common/colorPalette.js`

- 현재는 기존 `input type="color"` 기반이다.
- `EyeDropper`, `desktopCapturer`, overlay picker 로직은 남아 있지 않아야 한다.
- Electron 업그레이드 전에는 외부 화면 색상 선택 기능을 무리하게 추가하지 않는다.

### `selectionEffect/index.js`

- 프리셋명 길이 제한 상수 `PRESET_NAME_MAX_LENGTH = 40`이 있다.
- `validatePresetName`은 rename과 save-as 모두에서 쓰인다.
- 기본 프리셋 수정 시 save-as 흐름으로 들어간다.
- 사용자 프리셋 수정 시 update confirm 흐름으로 들어간다.

### `selectionEffect/index.css`

- 하단 액션 영역 높이/여백 보정이 들어 있다.
- Delete 버튼 danger 스타일이 들어 있다.
- compact 레이아웃에서 settings/preview 최소 높이를 줄여 footer 잘림을 방지한다.
- 네온 스위치 wrapper 스타일이 있다.

### `theme/index.html`, `theme/index.css`, `theme/index.js`

- 현재 테마 설정 화면은 splitter 없는 단일 미리보기 구조다.
- DDLB는 title 옆에 위치한다.
- DDLB 옆 별도 라벨 텍스트는 제거되어 있다.
- `theme/index.js`에는 splitter 관련 함수가 없어야 한다.

## 회귀 테스트 권장 항목

| ID | 점검 항목 | 기대 결과 |
| --- | --- | --- |
| T-01 | 팝업 세로 크기 축소 | 500px 미만으로 줄지 않거나 주요 UI가 잘리지 않음 |
| T-02 | Theme Setting 화면 | title 옆 DDLB, 큰 미리보기, splitter 없음 |
| T-03 | Theme DDLB 변경 | 미리보기 이미지가 즉시 변경됨 |
| T-04 | Theme Apply | SYSID별 theme 저장 및 테마 적용 |
| T-05 | WLO 있음 | 도움말 버튼 표시 |
| T-06 | WLO 없음 | 도움말 버튼 숨김 |
| T-07 | UI 선택 스타일 GAP 입력 | `20` 입력 중 첫 `2`가 `4`로 바뀌지 않음 |
| T-08 | 기본 프리셋 수정 후 Apply | Save User Preset prompt 표시 |
| T-09 | Save User Preset 40자 초과 입력 | 40자까지만 입력 |
| T-10 | Rename Preset 40자 초과 입력 | 40자까지만 입력 |
| T-11 | 중복 프리셋명 저장 | `ZMSG_WS_COMMON_001 / 841` 메시지 표시 |
| T-12 | 네온 효과 라벨 클릭 | 토글되지 않음 |
| T-13 | 네온 효과 스위치 트랙 클릭 | 토글됨 |
| T-14 | Delete 버튼 | 붉은색 danger 스타일 표시 |
| T-15 | compact 화면 | Apply/Delete 버튼 잘림 없음 |
| T-16 | 색상 팔레트 | 기존 `input type="color"` UI 동작 |

## 향후 개선 시 권장 접근

### UI를 새로 구성할 때

1. 기존 파일별 책임을 먼저 확인한다.
2. 화면별 HTML/CSS/JS 변경 범위를 분리한다.
3. 공통 기능은 `common/util.js` 또는 `common/popup.js`에 둘 수 있는지 판단한다.
4. 단일 화면에만 필요한 스타일은 해당 화면 CSS에 둔다.
5. 반응형 기준은 `max-width: 760px` 기존 패턴을 우선 따른다.
6. 화면 높이 500px 근처에서 하단 버튼 잘림을 반드시 확인한다.

### 프리셋 기능을 수정할 때

1. 기본 프리셋과 사용자 프리셋을 명확히 구분한다.
2. 기본 프리셋은 수정 저장 시 새 사용자 프리셋으로 저장하는 흐름이다.
3. 사용자 프리셋은 update/rename/delete 가능하다.
4. 이름 검증은 `validatePresetName`을 재사용한다.
5. 중복 메시지는 `ZMSG_WS_COMMON_001 / 841` 기준이다.

### 도움말 기능을 수정할 때

1. 도움말 버튼은 WLO 조건 충족 시만 표시한다.
2. 조건은 `REGTYP === "C"` 및 `CHGOBJ === "UHAK901435"`다.
3. 버튼을 disabled로 보여주는 것이 아니라 숨기는 것이 현재 요구사항이다.
4. 조회 실패 시에도 팝업 사용 자체는 막지 않는다.

### 색상 선택 기능을 다시 검토할 때

1. 현재 Electron/Chrome 버전을 먼저 확인한다.
2. Chrome 95 미만이면 `EyeDropper API`를 쓰지 않는다.
3. Electron 16 이상 또는 Chrome 95 이상으로 올라간 뒤에만 브라우저 내장 EyeDropper를 검토한다.
4. `desktopCapturer` 기반 구현은 권한, 화면 캡처, 멀티 모니터, 스케일 팩터, overlay focus 문제를 동반하므로 신중히 설계한다.

## 검증 명령

수정 후 최소한 다음 명령을 실행한다.

```powershell
node --check common/util.js
node --check common/popup.js
node --check common/colorPalette.js
node --check main/index.js
node --check theme/index.js
node --check selectionEffect/index.js
```

## 절대 주의 사항

- 사용자가 명시적으로 요청하지 않은 기존 정상 로직은 변경하지 않는다.
- 색상 팔레트 외부 스포이드 문제는 현재 원복 상태가 의도된 최종 상태다.
- `themeSplitter` 관련 코드를 테마 화면에 되살리지 않는다.
- 도움말 버튼은 WLO 미충족 시 화면에서 보이지 않아야 한다.
- 기본 프리셋을 직접 update/delete하는 방향으로 바꾸지 않는다.
- 프리셋명 중복 검사는 save-as와 rename 양쪽에서 유지한다.
