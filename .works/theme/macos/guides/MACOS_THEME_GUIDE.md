# macOS 테마 적용 지침서 (for Claude Code)

이 문서는 `macOS UI Kit.dc.html`(및 오프라인 번들 `macOS UI Kit.html`)을 **참조 구현**으로 삼아, 대상 프로젝트에 동일한 macOS 스타일 테마를 적용하기 위한 지침이다.

> **작업 원칙**
> 1. 먼저 `macOS UI Kit.dc.html`을 열어 실제 마크업과 인라인 스타일 값을 확인한다. 아래 토큰/스펙은 그 파일에서 추출한 것이다.
> 2. 아래 디자인 토큰을 프로젝트의 테마 레이어(예: CSS 변수, Tailwind config, styled-components theme)에 그대로 반영한다.
> 3. 각 컴포넌트를 "컴포넌트 스펙"에 명시된 수치대로 스타일링한다. **임의로 색·반경·그림자를 새로 만들지 말 것.**
> 4. 아래 "금지 사항"을 위반하지 않는다.

---

## 1. 디자인 원칙

- **선명하고 절제된 표면**: 얇은 테두리(0.5px), 낮은 채도, 은은한 그림자. 과한 그라데이션·네온 금지.
- **시스템 폰트 우선**: San Francisco(시스템 폰트 스택). 웹폰트를 강제로 얹지 않는다.
- **강조색은 하나(시스템 블루)**: 파괴적 동작에만 레드를 쓴다.
- **반투명 재질(vibrancy)**: 메뉴·다이얼로그·사이드바는 반투명 + `backdrop-filter: blur()`.
- **작은 모서리 반경**: 컨트롤은 6~8px, 카드/창은 12px, 다이얼로그는 14px.
- **컴팩트한 밀도**: 컨트롤 폰트 13px, 라벨 11~13px. 여백은 촘촘하게.

---

## 2. 디자인 토큰

CSS 커스텀 프로퍼티로 정의해 프로젝트 전역에 노출하는 것을 권장한다.

```css
:root {
  /* Typography */
  --mac-font: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Helvetica, Arial, sans-serif;
  --mac-fs-control: 13px;   /* 버튼·입력·메뉴 항목 */
  --mac-fs-label: 11px;     /* 섹션 캡션(대문자) */
  --mac-fs-title: 19px;     /* 그룹 제목 */

  /* Accent */
  --mac-blue: #0a6cff;
  --mac-blue-grad: linear-gradient(#3b91ff, #0a6cff);
  --mac-red-grad: linear-gradient(#ff6b6b, #e0322f);
  --mac-green: #34c759;     /* 토글 ON 트랙 */

  /* Text */
  --mac-text: #1d1d1f;      /* 기본 */
  --mac-text-2: #6e6e73;    /* 보조 */
  --mac-text-3: #9a9a9e;    /* 3차/placeholder */

  /* Surfaces */
  --mac-bg-window: #ececec;         /* 창 배경 */
  --mac-bg-content: #f5f5f7;        /* 콘텐츠 영역 */
  --mac-bg-card: #ffffff;           /* 카드/그룹 박스 */
  --mac-bg-field: #f0f0f2;          /* 검색·연한 입력 필드 */
  --mac-bg-sidebar: rgba(245,245,247,0.85);
  --mac-material: rgba(250,250,252,0.98); /* 메뉴/팝오버 재질 */

  /* Borders & lines */
  --mac-border: 0.5px solid rgba(0,0,0,0.16);
  --mac-border-soft: 0.5px solid rgba(0,0,0,0.1);
  --mac-hairline: rgba(0,0,0,0.12);

  /* Radii */
  --mac-r-sm: 6px;   /* small 버튼 */
  --mac-r-md: 7px;   /* 기본 버튼 */
  --mac-r-lg: 8px;   /* large 버튼, 세그먼트 */
  --mac-r-card: 12px;
  --mac-r-dialog: 14px;

  /* Shadows */
  --mac-sh-button: 0 1px 1px rgba(0,0,0,0.05);
  --mac-sh-card: 0 1px 3px rgba(0,0,0,0.06), 0 0 0 0.5px rgba(0,0,0,0.06);
  --mac-sh-popover: 0 8px 28px rgba(0,0,0,0.24), 0 0 0 0.5px rgba(0,0,0,0.14);
  --mac-sh-dialog: 0 20px 60px rgba(0,0,0,0.4);
  --mac-sh-window: 0 30px 80px rgba(0,0,0,0.4), 0 0 0 0.5px rgba(0,0,0,0.2);

  /* Focus */
  --mac-focus-ring: 0 0 0 3px rgba(10,108,255,0.3);

  /* Traffic lights */
  --mac-tl-red: #ff5f57;
  --mac-tl-yellow: #febc2e;
  --mac-tl-green: #28c840;
}
```

---

## 3. 컴포넌트 스펙

각 컴포넌트는 참조 HTML의 인라인 스타일을 토큰으로 치환한 형태다.

### 버튼 (Button)
- **Primary**: `background: var(--mac-blue-grad)`, `color:#fff`, `border:none`, `border-radius:var(--mac-r-md)`, `padding:6px 18px`, `font-size:13px; font-weight:500`, `box-shadow:0 1px 1px rgba(0,0,0,0.12), inset 0 0.5px 0 rgba(255,255,255,0.3)`. hover `filter:brightness(1.06)`, active `brightness(0.94)`.
- **Default**: `background:linear-gradient(#fff,#f4f4f4)`, `border:var(--mac-border)`, `color:var(--mac-text)`, `box-shadow:var(--mac-sh-button)`. hover `background:#fafafa`, active `#ededed`.
- **Destructive(Delete)**: `background:var(--mac-red-grad)`, `color:#fff`, 나머지는 Primary와 동일.
- **Disabled**: `background:#f0f0f2`, `color:#b9b9bd`, `border:0.5px solid rgba(0,0,0,0.08)`, `cursor:default`.
- **크기**: small `padding:5px 14px; font-size:12px; radius:6px`, large `padding:9px 24px; font-size:15px; radius:8px`.

### 세그먼트 컨트롤 (Segmented Control)
- 트랙: `background:#e6e6e9`, `border-radius:8px`, `padding:2px`, 항목 사이 `gap:2px`.
- 선택 항목: `background:#fff`, `box-shadow:0 1px 2px rgba(0,0,0,0.15)`, `color:var(--mac-text)`.
- 비선택 항목: `background:transparent`, `color:#5a5a5e`. 항목 `padding:5px 18px; font-size:12.5px`.

### 토글 스위치 (Toggle)
- 트랙: `width:44px; height:26px; border-radius:13px`, ON `background:var(--mac-green)`, OFF `#e4e4e7`, `inset 0 0 0 0.5px rgba(0,0,0,0.08)`.
- 노브: `20px→2px`(top:2px) 위치 이동, `width/height:22px`, `border-radius:50%`, `background:#fff`, `box-shadow:0 1px 3px rgba(0,0,0,0.25)`, `transition:left .18s`.

### 슬라이더 (Slider)
- `input[type=range]`, `accent-color:var(--mac-blue)`, `height:4px`. 값 라벨은 `font-variant-numeric:tabular-nums`.

### 체크박스 / 라디오
- 체크박스: `16px`, `border-radius:4px`. ON `background:var(--mac-blue-grad)` + `✓`(흰색), OFF `background:#fff; border:0.5px solid rgba(0,0,0,0.25); box-shadow:inset 0 1px 1px rgba(0,0,0,0.05)`.
- 라디오: 위와 동일하되 `border-radius:50%`, 선택 시 중앙 `6px` 흰 점.

### 텍스트 필드 (Text Field)
- 기본: `padding:7px 11px`, `border-radius:6px`, `border:0.5px solid rgba(0,0,0,0.2)`, `background:#fff`, `box-shadow:inset 0 1px 2px rgba(0,0,0,0.05)`, `font-size:13px`.
- **포커스**: `border-color:var(--mac-blue)` + `box-shadow:var(--mac-focus-ring)`, `outline:none`.
- 검색 필드: `border-radius:14px`(pill), `background:var(--mac-bg-field)`, 왼쪽에 `⌕` 아이콘.
- 텍스트영역: 기본 필드와 동일 + `resize:vertical`.

### 드롭다운 / 팝업 버튼 (Pop-up Button)
- 트리거: Default 버튼 스타일 + 오른쪽 파란 인디케이터 박스(`18px`, `border-radius:4px`, `var(--mac-blue-grad)`).
- **인디케이터 화살표는 유니코드 문자(⌄ 등)를 쓰지 말고 CSS 삼각형으로 그린다** — 위/아래 삼각형을 세로로 배치:
  ```css
  /* 위 삼각형 */ border-left:3.5px solid transparent; border-right:3.5px solid transparent; border-bottom:4px solid #fff;
  /* 아래 삼각형 */ border-left:3.5px solid transparent; border-right:3.5px solid transparent; border-top:4px solid #fff;
  ```
- 팝오버 리스트: `background:var(--mac-material)`, `backdrop-filter:blur(20px)`, `border-radius:8px`, `box-shadow:var(--mac-sh-popover)`, `padding:5px`.
- 항목: `padding:5px 10px`, `border-radius:5px`, hover `background:var(--mac-blue); color:#fff`. 선택 항목은 왼쪽에 `✓`.

### 컨텍스트 메뉴 (Menu)
- 팝오버 재질은 위와 동일. 항목 우측에 단축키(`⌘D` 등)를 `#a0a0a4`로 표시.
- 구분선: `height:0.5px; background:var(--mac-hairline); margin:5px 8px`.
- 파괴적 항목(Delete): `color:#e0322f`, hover 시에도 파란 배경 + 흰 글자로 반전.

### 다이얼로그 / 알림 (Alert)
- 오버레이: `background:rgba(0,0,0,0.28)` + `backdrop-filter:blur(2px)`, flex center.
- 패널: `width:280px`, `background:rgba(246,246,248,0.95)` + `blur(30px)`, `border-radius:var(--mac-r-dialog)`, `box-shadow:var(--mac-sh-dialog)`, `padding:22px 20px 16px`, 중앙 정렬.
- 상단 앱 아이콘(`52px`, `radius:14px`, 그라데이션), 제목 14px/700, 본문 12px/`#6e6e73`.
- 버튼은 세로 스택: 기본 동작 = Primary, 보조 = Default.

### 알림 배너 (Notification Toast)
- `position:fixed; top:24px; right:24px`, `width:340px`, `background:rgba(250,250,252,0.9)` + `blur(30px)`, `border-radius:16px`, `box-shadow:0 12px 40px rgba(0,0,0,0.28), 0 0 0 0.5px rgba(0,0,0,0.08)`.
- 좌측 앱 아이콘(`38px`, `radius:9px`), 제목/시간(now)/본문, 우측 상단 닫기 `✕`(원형 회색 버튼).

### 파일 첨부 / Finder Open 패널
- **드롭존**: `border:2px dashed rgba(0,0,0,0.16)`, `border-radius:12px`, `background:#fafafa`. hover `border-color:var(--mac-blue); background:#f0f6ff`.
- **첨부 항목**: 확장자 색상별 문서 아이콘(`30x38`, `radius:5px`, 하단정렬 확장자 라벨), 파일명 13px/500, 용량 11.5px/`#9a9a9e`, 우측 원형 `✕`(hover 시 레드).
- **Open 패널(창)**: `width:660px`, `border-radius:12px`, `box-shadow:var(--mac-sh-window)`.
  - 툴바(`52px`): 신호등 3색 + 중앙 위치명 + 우측 검색 필드.
  - 사이드바(`180px`): `background:rgba(238,238,240,0.9)`, "즐겨찾기" 캡션 + 원형 컬러 아이콘 항목, 활성 항목 `background:rgba(0,0,0,0.09)`.
  - 파일 리스트: 헤더(이름/크기/종류) sticky, 행 zebra(`rgba(0,0,0,0.025)`), 선택 행 `background:var(--mac-blue)` + 흰 글자.
  - 푸터(`56px`): 좌측 선택 파일명, 우측 [취소](Default) [열기](Primary).

### 진행 표시 (Progress)
- 결정형 바: 트랙 `height:6px; radius:3px; background:#e6e6e9`, 채움 `linear-gradient(90deg,#3b91ff,#0a6cff)`.
- 스피너: `20px`, `border:2.5px solid #e0e0e3`, `border-top-color:#8e8e93`, `@keyframes spin 0.8s linear infinite`.
- 비결정형 바: 반복 그라데이션 스트라이프를 `background-position`로 애니메이션.

### 창 크롬 (Window Chrome)
- 타이틀바: `height:52px`, `background:linear-gradient(#f6f6f6,#e8e8e8)`, 하단 `0.5px` 헤어라인.
- 신호등: `12px` 원 3개, 색상 `--mac-tl-*`, `inset 0 0 0 0.5px rgba(0,0,0,0.15)`, 좌측 정렬, 중앙에 창 제목.

---

## 4. 레이아웃 패턴

- **콘텐츠 그룹 카드**: `background:var(--mac-bg-card)`, `border-radius:var(--mac-r-card)`, `box-shadow:var(--mac-sh-card)`, `padding:24px`. 카드 위에 19px/700 그룹 제목.
- **행 구성**: 버튼·칩 등 나란한 요소는 항상 `display:flex; gap:*`(또는 grid + gap)로 배치. 인라인 흐름 + margin 금지.
- **사이드바 내비**: 항목 `padding:7px 10px; border-radius:6px`, hover `background:rgba(0,0,0,0.05)`, 좌측 `20px` 컬러 아이콘 배지.

---

## 5. 금지 사항 (Do NOT)

- ❌ 강한/무지개 그라데이션 배경, 네온 색, 채도 높은 색을 새로 만들지 말 것. 강조색은 시스템 블루 하나.
- ❌ 컨트롤 인디케이터에 유니코드 화살표(⌄, ▼ 등)를 쓰지 말 것 — 흐리게 렌더된다. **CSS 삼각형** 사용.
- ❌ 두꺼운 테두리(1px 이상)나 진한 그림자 남발 금지. 테두리는 0.5px, 그림자는 토큰값 유지.
- ❌ Inter/Roboto 등 웹폰트를 강제하지 말 것. 시스템 폰트 스택 사용.
- ❌ 큰 모서리 반경(16px+)을 컨트롤에 쓰지 말 것(pill 검색 필드 제외).
- ❌ 이모지를 UI 장식으로 남용하지 말 것.

---

## 6. 적용 절차 요약

1. `macOS UI Kit.dc.html`을 열어 대상과 매칭되는 컴포넌트의 실제 스타일을 확인한다.
2. 위 토큰을 프로젝트 테마에 정의한다.
3. 기존 컴포넌트를 하나씩 스펙에 맞춰 교체한다(색·반경·그림자·폰트·포커스링·hover/active).
4. 팝오버·다이얼로그·사이드바에는 반투명 재질 + blur을 적용한다.
5. 렌더 후 "금지 사항"을 기준으로 셀프 리뷰한다.
