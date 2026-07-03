# macOS 테마 이식 지침서 — Electron + Bootstrap 앱 (for Claude Code)

이 문서는 이미 동작 중인 **Electron + 오픈소스 Bootstrap CSS** 애플리케이션에, 그동안 만든 macOS 스타일 UI(`macOS UI Kit.dc.html`, 오프라인 번들 `macOS UI Kit.html`)를 이식하기 위한 실행 지침이다.

> **두 개의 참조 문서를 함께 사용한다**
> - `MACOS_THEME_GUIDE.md` — 디자인 토큰(색·반경·그림자·폰트·포커스링)과 컴포넌트별 정확한 수치. **모든 스타일 값은 여기서 가져온다.**
> - `macOS UI Kit.dc.html` — 살아있는 참조 구현. "이 컴포넌트를 macOS로 만들면 어떤 마크업/상태가 되는가"를 눈으로 확인할 때 연다.
>
> 이 지침서는 **"어떻게 기존 코드베이스에 얹느냐"**(전략·순서·함정)만 다룬다. 픽셀 값은 위 두 문서를 따른다.

---

## 0. 핵심 결론 먼저 (TL;DR)

1. **Bootstrap을 제거하지 마라. 덧대되, "덮어쓰기"가 아니라 "리매핑"으로 덧댄다.** Bootstrap 5는 대부분의 스킨을 자체 CSS 변수(`--bs-*`)로 그린다. 이 변수를 macOS 토큰으로 다시 정의하는 것이 셀렉터 전쟁보다 압도적으로 안전하고 적은 코드로 끝난다. (§3)
2. **트래픽 라이트(창 버튼)는 CSS로 풀 수 없다. 맞다.** 이건 Electron **메인 프로세스**의 `BrowserWindow` 설정 + 플랫폼 분기 문제다. macOS에서는 네이티브 신호등을 쓰고(가짜로 그리지 말 것), 기존 오른쪽 커스텀 닫기 버튼은 플랫폼별로 숨긴다. (§5)
3. **한 번에 다 바꾸지 마라.** 토큰 → 전역 리매핑 → 컴포넌트 단위 → 창 크롬 순서로 단계 이식한다. 각 단계는 독립적으로 배포 가능해야 한다. (§7)

---

## 1. 먼저 현재 상태를 파악한다 (이식 전 조사)

Claude Code는 코드를 바꾸기 전에 다음을 확인하고 보고한다:

- **Bootstrap 버전.** `package.json` 또는 로드하는 `bootstrap.min.css`의 버전 주석을 확인한다. **4와 5는 전략이 다르다** — 5는 CSS 변수(`--bs-*`)가 풍부해 리매핑이 쉽고, 4는 SCSS 변수 위주라 셀렉터 오버라이드가 더 필요하다. 이 문서는 **Bootstrap 5 기준**이며, 4일 경우 §3.4를 본다.
- **CSS 로드 방식.** `<link>` CDN인가, npm 번들인가, SCSS 소스 컴파일인가? SCSS 소스를 직접 컴파일 중이라면 `$primary`, `$border-radius` 등 **SCSS 변수를 고쳐 다시 빌드**하는 길이 열린다(가장 깨끗함, §3.5).
- **창 설정.** 메인 프로세스에서 `new BrowserWindow({...})`를 찾는다. `frame`, `titleBarStyle`, `titleBarOverlay` 현재 값이 무엇인가.
- **커스텀 타이틀바 유무.** 지금 오른쪽 닫기/최소화 버튼이 (a) OS 네이티브인지 (b) HTML로 그린 커스텀 바인지 확인한다. 이식 난이도가 갈린다.
- **컴포넌트 인벤토리.** 실제로 쓰이는 Bootstrap 컴포넌트를 나열한다(`btn`, `form-control`, `modal`, `dropdown`, `nav-tabs`, `card`, `table`, `list-group`…). 안 쓰는 건 건드릴 필요 없다.

---

## 2. 이식 전략: 제거 vs 덧대기 (의견)

| 전략 | 내용 | 평가 |
|---|---|---|
| **A. Bootstrap 완전 제거** | 부트스트랩 걷어내고 처음부터 macOS CSS | ❌ 비추천(대부분의 경우). 그리드·유틸리티·리셋까지 다 잃고, JS 컴포넌트(모달·드롭다운·툴팁의 동작)까지 재구현해야 함. 리스크·공수 최대. |
| **B. 위에 무조건 덮어쓰기** | `.btn { ... !important }` 식으로 강제 오버라이드 | ❌ 비추천. `!important` 전쟁, 반응형·상태(hover/active/disabled) 누락, Bootstrap 업데이트마다 깨짐. |
| **C. 리매핑 + 스코프 오버라이드 (권장)** | Bootstrap의 레이아웃·JS 동작은 **유지**, 스킨만 macOS 토큰으로 **리매핑**하고, 리매핑으로 안 되는 부분만 좁게 오버라이드 | ✅ **권장.** 공수 대비 효과 최고. 단계 배포 가능. Bootstrap의 접근성·반응형·JS를 그대로 활용. |

**결론: C를 택한다.** Bootstrap은 "구조와 동작"을 담당하게 두고, macOS 테마는 "표면(스킨)"만 담당한다. 레이아웃 그리드(`row`/`col`), 유틸리티(`d-flex`, `gap-*`, `m-*`), 리부트(normalize)는 자산이므로 남긴다.

---

## 3. 리매핑 방식 (전략 C의 심장)

### 3.1 macOS 테마 레이어 파일을 만든다

`macos-theme.css` 한 장을 새로 만들고 **Bootstrap 다음에** 로드한다. 로드 순서가 핵심이다:

```html
<link rel="stylesheet" href="bootstrap.min.css">
<link rel="stylesheet" href="macos-theme.css">   <!-- 항상 나중 -->
```

`macos-theme.css`는 세 부분으로 구성한다: ① 토큰 정의(`MACOS_THEME_GUIDE.md`의 `:root` 블록 복사), ② Bootstrap 변수 리매핑, ③ 리매핑으로 안 되는 좁은 오버라이드.

### 3.2 ② Bootstrap CSS 변수 리매핑 — 가장 강력한 레버

Bootstrap 5는 색·반경·폰트·간격을 `--bs-*` 변수로 그린다. 이 변수만 바꿔도 셀렉터를 거의 건드리지 않고 앱 전체 톤이 macOS로 바뀐다. `MACOS_THEME_GUIDE.md`의 토큰 값을 여기에 연결한다:

```css
:root {
  /* 브랜드/색 — 시스템 블루 하나로 */
  --bs-primary: #0a6cff;
  --bs-primary-rgb: 10, 108, 255;
  --bs-danger: #e0322f;
  --bs-success: #34c759;
  --bs-warning: #ff9f0a;

  /* 타이포 — 시스템 폰트 스택 */
  --bs-body-font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Helvetica, Arial, sans-serif;
  --bs-body-font-size: 13px;
  --bs-body-color: #1d1d1f;
  --bs-secondary-color: #6e6e73;

  /* 표면 */
  --bs-body-bg: #f5f5f7;
  --bs-border-color: rgba(0,0,0,0.16);

  /* 반경 — macOS는 작게 */
  --bs-border-radius: 7px;
  --bs-border-radius-sm: 6px;
  --bs-border-radius-lg: 8px;
  --bs-border-radius-xl: 12px;
}
```

> **원칙: 셀렉터를 고치기 전에 "이 스타일을 그리는 `--bs-*` 변수가 있는가?"를 먼저 찾는다.** 버튼은 `--bs-btn-*`, 모달은 `--bs-modal-*`, 카드·리스트·드롭다운도 각자 변수를 가진다. 변수로 되면 오버라이드 셀렉터를 쓰지 않는다.

### 3.3 ③ 좁은 오버라이드 — 변수로 안 되는 것만

리매핑으로 표현할 수 없는 macOS 고유 디테일(그라데이션 버튼, 포커스 링, 토글 스위치 모양 등)만 스코프해서 오버라이드한다. **`!important`는 최후의 수단**이고, 대신 Bootstrap과 동일하거나 한 단계 높은 특이도로 이긴다:

```css
/* Primary 버튼: macOS 그라데이션 + inset 하이라이트 */
.btn-primary {
  background: linear-gradient(#3b91ff, #0a6cff);
  border: none;
  box-shadow: 0 1px 1px rgba(0,0,0,0.12), inset 0 .5px 0 rgba(255,255,255,0.3);
}
.btn-primary:hover { filter: brightness(1.06); background: linear-gradient(#3b91ff, #0a6cff); }
.btn-primary:active { filter: brightness(0.94); }

/* 입력 포커스: Bootstrap의 박스섀도를 macOS 파란 링으로 */
.form-control:focus, .form-select:focus {
  border-color: #0a6cff;
  box-shadow: 0 0 0 3px rgba(10,108,255,0.3);
}
```

> 정확한 값은 항상 `MACOS_THEME_GUIDE.md`의 "컴포넌트 스펙"에서 가져온다. 위는 형식 예시일 뿐이다.

### 3.4 Bootstrap 4일 경우

Bootstrap 4는 `--bs-*` 변수가 거의 없다. 두 갈래다:
- **SCSS 소스를 컴파일 중이면** §3.5로 간다(가장 깨끗).
- **컴파일된 CSS만 있으면** 리매핑 레버가 약하므로 §3.3의 스코프 오버라이드 비중이 커진다. 이때는 아래 §4의 스코프 클래스를 반드시 써서 오버라이드 범위를 통제한다.

### 3.5 SCSS를 직접 컴파일 중이라면 (최상책)

빌드 파이프라인이 Bootstrap SCSS를 컴파일한다면, `@import "bootstrap"` **앞에** 변수를 선언해 Bootstrap 자체를 macOS 값으로 다시 굽는다. 오버라이드가 아니라 "처음부터 그렇게 생성"되므로 특이도 문제가 사라진다:

```scss
// _macos-overrides.scss  (bootstrap import 앞)
$primary:        #0a6cff;
$danger:         #e0322f;
$border-radius:  .45rem;
$font-family-base: -apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif;
$font-size-base: .8125rem; // 13px
$input-btn-focus-box-shadow: 0 0 0 3px rgba(10,108,255,.3);
@import "bootstrap/scss/bootstrap";
```

---

## 4. 오버라이드는 반드시 스코프한다 (점진 이식의 안전장치)

전면 전환 전, macOS 테마를 **루트 클래스로 스코프**하면 화면 단위로 켜고 끄며 검증할 수 있다. `<body class="theme-mac">` 또는 `[data-theme="mac"]`를 달고, 오버라이드를 그 아래로 한정한다:

```css
.theme-mac .btn-primary { /* ... */ }
.theme-mac .form-control:focus { /* ... */ }
```

- 이식 초기: 새로 손본 화면에만 `theme-mac`를 달아 A/B로 비교.
- 이식 완료: `<body class="theme-mac">`를 상시 적용하고, 원하면 스코프 접두사를 제거해 단순화.
- 이 스코프는 **다크모드 전환**의 발판도 된다(`theme-mac-dark`).

---

## 5. 창 크롬 / 트래픽 라이트 — CSS로 안 되는 부분 (가장 중요한 우려 해소)

### 5.1 왜 CSS만으로 안 되나 (진단이 맞다)

닫기 버튼의 좌/우 위치는 **웹 콘텐츠(렌더러)의 CSS 문제가 아니라 OS 창 장식(window chrome)의 문제**다. macOS의 신호등(빨강·노랑·초록)은 OS가 그리는 네이티브 요소이고, Electron에서는 **메인 프로세스의 `BrowserWindow` 옵션**으로 제어한다. 즉, 렌더러 CSS가 아니라 창 생성 코드를 고쳐야 한다 — 우려가 정확하다.

### 5.2 권장 구성: macOS는 네이티브 신호등을 쓴다 (가짜로 그리지 않는다)

`macOS UI Kit.dc.html`의 신호등은 **디자인 참조용 목업**이다. 실제 Electron 앱에서는 이걸 HTML로 재현하지 말고 **OS 네이티브 신호등을 노출**한다. 메인 프로세스:

```js
// main.js (메인 프로세스)
const mac = process.platform === 'darwin';
const win = new BrowserWindow({
  // macOS: 타이틀바를 숨기되 신호등은 좌상단에 네이티브로 유지
  titleBarStyle: mac ? 'hiddenInset' : 'default',
  trafficLightPosition: mac ? { x: 16, y: 18 } : undefined, // 신호등 위치 미세조정
  // Win/Linux: 프레임 유지하거나, 커스텀 컨트롤을 직접 그릴 거면 frame:false + titleBarOverlay
  frame: mac ? undefined : true,
  vibrancy: mac ? 'sidebar' : undefined,   // 사이드바 반투명(선택)
  // ...
});
```

- `titleBarStyle: 'hiddenInset'` → 타이틀바 영역은 콘텐츠가 차지하되 **신호등은 좌상단에 그대로**. macOS 관례(좌측 닫기)를 코드 한 줄로 얻는다.
- 신호등이 콘텐츠와 겹치므로, 렌더러에서 **좌상단에 안전 여백(약 78px)**을 확보한다(§5.4).

### 5.3 기존 "오른쪽 커스텀 닫기 버튼"은 어떻게 하나

지금 앱이 HTML로 오른쪽에 닫기/최소화 버튼을 그리고 있다면:

- **macOS(`darwin`)에서는 그 커스텀 컨트롤을 렌더링하지 않는다** — 네이티브 신호등과 중복되고 관례에 어긋난다. 플랫폼 분기로 숨긴다:
  ```js
  document.body.classList.add(process.platform === 'darwin' ? 'is-mac' : 'is-win');
  ```
  ```css
  .is-mac .custom-window-controls { display: none; }   /* mac: 네이티브 신호등 사용 */
  .is-win .custom-window-controls { /* 오른쪽 유지 */ }
  ```
- **Windows/Linux에서는** 네이티브 신호등이 없다. 오른쪽 커스텀 컨트롤을 유지하거나, `titleBarOverlay`(창 오버레이 API)로 처리한다. **크로스플랫폼 앱이라면 "mac=좌측 네이티브 / win=우측 커스텀"의 이원화가 정상이며, 억지로 통일하지 않는다.**

### 5.4 드래그 영역과 신호등 여백 (렌더러 CSS)

프레임리스/hiddenInset에서는 창을 잡아 끄는 영역을 CSS로 지정해야 한다:

```css
.app-titlebar { -webkit-app-region: drag; height: 52px; }
.app-titlebar button, .app-titlebar input,
.app-titlebar .interactive { -webkit-app-region: no-drag; } /* 버튼은 클릭 가능하게 */

/* mac: 좌상단 네이티브 신호등과 겹치지 않도록 콘텐츠 시작점을 민다 */
.is-mac .app-titlebar { padding-left: 78px; }
```

### 5.5 이 부분은 "렌더링 재구성"이 맞다

정리: **신호등 위치 = 메인 프로세스 창 옵션 + 플랫폼 분기 + 드래그 영역 CSS**의 3박자다. 순수 CSS 스킨(§3)과는 별개 작업이며, 타이틀바를 커스텀으로 그리고 있었다면 그 마크업을 재구성해야 한다. §7의 이식 단계에서 **가장 마지막(Phase 4)**에 배치해 리스크를 격리한다.

---

## 6. 컴포넌트 매핑 표 (Bootstrap → macOS)

각 항목은 "리매핑으로 되는지 / 오버라이드가 필요한지"를 표시한다. 값은 `MACOS_THEME_GUIDE.md`에서 가져오고, 동작 예시는 `macOS UI Kit.dc.html`에서 확인한다.

- **`.btn` / `.btn-primary` / `.btn-danger`** — 색은 변수 리매핑, **그라데이션·inset 하이라이트·hover(brightness)는 오버라이드**. `.btn-secondary`는 macOS "Default" 버튼(흰→회 그라데이션 + 0.5px 테두리)으로.
- **`.form-control` / `.form-select` / `textarea`** — 반경은 변수, **포커스 링(파란 3px)·inset 그림자는 오버라이드**. `.form-select`의 화살표는 macOS 팝업 버튼 스타일 권장(참조 구현의 CSS 삼각형).
- **`.form-check`(체크박스/라디오)** — Bootstrap 기본형에 `--bs-*`로 색만 맞추거나, 정밀하게 가려면 참조 구현의 커스텀 박스로 오버라이드.
- **`.form-switch`** — Bootstrap 스위치를 macOS 토글(초록 트랙·22px 노브)로 오버라이드.
- **`.modal`** — `--bs-modal-*`로 반경·배경 리매핑. macOS 알림형(작은 중앙 다이얼로그, 세로 버튼 스택)이 필요하면 `.modal-dialog` 폭을 좁히고 참조 구현의 다이얼로그 레이아웃을 따른다. 오버레이는 `backdrop-filter: blur`.
- **`.dropdown-menu` / `.dropdown-item`** — 반투명 재질(`rgba + backdrop-filter`), 반경 8px, 항목 hover 시 파란 배경·흰 글자, 단축키·구분선. 대부분 오버라이드.
- **`.nav-tabs` / `.nav-pills`** — macOS 세그먼트 컨트롤(회색 트랙·흰 선택칩) 또는 앵커 밑줄 탭으로. 참조 구현의 Segmented/Tabs/Anchor Bar 참고.
- **`.card`** — 변수로 반경·테두리 맞추고, 그림자만 macOS 카드 그림자로 오버라이드.
- **`.table`** — 헤더 배경·zebra·hover를 macOS 값으로. 정렬/선택/고정 컬럼/세로 스크롤이 필요하면 참조 구현의 6종 테이블 패턴을 이식.
- **`.list-group`** — 사이드바 소스 리스트(둥근 hover, 파란 선택)로.
- **`.badge`** — macOS 필/카운트 배지 색·반경으로.
- **`.tooltip` / `.popover`** — 다크 툴팁 / 화살표 팝오버. Bootstrap JS 동작은 유지하고 스킨만 교체.
- **`.progress`** — 트랙·채움을 macOS 값으로. 원형이 필요하면 참조 구현의 Progress Ring(SVG).
- **스크롤바** — macOS 오버레이 스크롤바 느낌: `::-webkit-scrollbar`를 얇게(8px), thumb `rgba(0,0,0,0.28)` 둥글게, track 투명.

---

## 7. 이식 단계 (순서대로, 각 단계는 독립 배포 가능)

- **Phase 0 — 준비.** 조사(§1) 완료. `macos-theme.css` 생성, Bootstrap 뒤에 로드(§3.1). `<body class="theme-mac">` 스코프 도입(§4). 이 시점엔 아직 시각 변화 최소.
- **Phase 1 — 토큰 & 리매핑.** `MACOS_THEME_GUIDE.md`의 `:root` 토큰 + Bootstrap 변수 리매핑(§3.2) 적용. 폰트·색·반경·기본 배경이 한 번에 macOS 톤으로. **가장 큰 시각 효과 대비 가장 적은 리스크.** 여기서 멈춰도 앱이 꽤 macOS다워진다.
- **Phase 2 — 폼 & 버튼.** 버튼(그라데이션·hover), 입력 포커스 링, 스위치/체크박스(§6). 사용자가 가장 자주 만지는 요소부터.
- **Phase 3 — 오버레이 & 내비.** 드롭다운·모달·툴팁·탭·리스트·테이블. Bootstrap JS 동작 유지, 스킨만 교체.
- **Phase 4 — 창 크롬.** 트래픽 라이트/타이틀바/드래그 영역(§5). **메인 프로세스 변경 포함, 플랫폼 분기.** 리스크가 가장 크므로 마지막. macOS·Windows 양쪽에서 실기 테스트.
- **Phase 5 — 다듬기.** 스크롤바, 빈 상태/스켈레톤, 애니메이션(토스트·시트), 반투명 vibrancy, (선택)다크모드.

각 Phase 종료 시 macOS·Windows에서 스크린샷 회귀 확인. 문제가 생기면 그 Phase만 롤백.

---

## 8. 흔한 함정 (Do NOT)

- ❌ **Bootstrap 제거부터 시도** — 그리드·유틸·JS까지 잃는다. 리매핑을 먼저 소진하라.
- ❌ **`!important` 남발** — 변수 리매핑 → 동급 특이도 오버라이드 순으로 풀고, `!important`는 정말 마지막.
- ❌ **신호등을 HTML/CSS로 가짜로 그림** — macOS에선 네이티브(`titleBarStyle`)를 써야 진짜 눌리고 관례에 맞다. 참조 구현의 신호등은 목업일 뿐.
- ❌ **플랫폼 분기 없이 창 컨트롤 통일** — mac 좌측 / win·linux 우측은 각 OS 관례다. 이원화가 정상.
- ❌ **유니코드 화살표(⌄▼)로 select 인디케이터** — 흐리게 렌더된다. CSS 삼각형(참조 구현 방식).
- ❌ **웹폰트 강제(Inter/Roboto)** — 시스템 폰트 스택을 쓴다.
- ❌ **한 번에 전면 전환** — 스코프 클래스로 화면 단위 점진 이식하라.
- ❌ **Bootstrap 반응형/접근성 무력화** — 스킨만 바꾸고 구조·포커스 관리·ARIA는 건드리지 않는다.

---

## 9. 검증 체크리스트

- [ ] Bootstrap **뒤에** `macos-theme.css`가 로드되는가.
- [ ] `--bs-primary` 등 변수 리매핑만으로 커버되는 부분에 불필요한 셀렉터 오버라이드가 없는가.
- [ ] 버튼 hover/active/disabled, 입력 focus/invalid 등 **모든 상태**가 macOS 스펙과 일치하는가.
- [ ] `!important` 사용처가 최소인가(가급적 0).
- [ ] macOS 빌드에서 신호등이 좌상단 네이티브로 나오고, 콘텐츠와 겹치지 않는가(여백 78px).
- [ ] Windows/Linux 빌드에서 창 컨트롤이 정상 동작하는가(mac 전용 CSS가 새지 않았는가).
- [ ] 타이틀바 드래그(`-webkit-app-region: drag`)와 버튼 클릭(`no-drag`)이 모두 되는가.
- [ ] 기존 기능(모달 열기/닫기, 드롭다운, 폼 검증)이 스킨 교체 후에도 동작하는가.
- [ ] 스코프 클래스(`theme-mac`)를 떼도/붙여도 앱이 깨지지 않는가.

---

## 10. 요약

1. Bootstrap은 **구조·동작 담당으로 유지**, macOS 테마는 **스킨만** 담당.
2. 스킨은 **`--bs-*`(또는 SCSS `$`) 리매핑 우선**, 안 되는 것만 스코프 오버라이드.
3. **신호등/타이틀바는 CSS가 아니라 Electron 메인 프로세스 + 플랫폼 분기 + 드래그 영역** 문제 — 마지막 Phase에 격리.
4. 값은 `MACOS_THEME_GUIDE.md`, 동작은 `macOS UI Kit.dc.html`을 참조.
5. **토큰 → 폼/버튼 → 오버레이/내비 → 창 크롬 → 다듬기** 순으로 단계 배포.
