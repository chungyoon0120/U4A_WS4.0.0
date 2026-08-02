# 공통 UX 번들 — 동료 별창 팝업 개발 → 내 프로젝트 이관용 (Design/Spec)

- 작성일: 2026-08-01
- 한 줄 목적: 동료가 **별창 팝업 하나를 폴더 하나로** 개발한 뒤, **그 폴더만 내 프로젝트로 이관**하면
  **이질감 0으로 바로 실행**되도록, 내 프로젝트의 **공통 UX 자산·표준·견본**을 번들로 제공한다.

---

## 1. 최종 그림 (이게 되면 성공)

1. 내가 **내 프로젝트의 공통 스택 + 별창 견본**을 번들(zip)로 동료에게 전달.
2. 동료가 자기 개발 환경에 풀고, **내 경로 골격 그대로** 별창 팝업을 `Popups/<이름>/` 폴더에 개발
   (자기 AI=**Codex**에게 "공통 UX 참고해 별창 팝업 만들어줘" 요청, Codex가 견본을 복사해 내용만 채움).
3. 완료 후 **그 팝업 폴더만** 내 프로젝트로 이관 → 이미 있는 공통 자산을 **같은 상대경로로 참조** →
   화면 버튼 클릭 시 **바로 동일 동작·동일 UX**로 실행.

**핵심 원칙: 번들은 "동료 프로젝트에 이식"이 아니라 "내 프로젝트로 흡수될 산출물을 미리 만드는 것".**
→ 그래서 경로·자산·테마·동작은 **전부 내 프로젝트 기준**으로 맞춘다.

---

## 2. ★ 동료에게 물어볼 것 (미확인 — 인계 전 확인)

| # | 물어볼 질문 | 왜 필요 / 답에 따라 달라지는 것 |
|---|---|---|
| **Q1** | 내 경로 골격(`www/ws30/ws10_20/theme/`, `www/lib/`, `Popups/`)을 **그대로 심어도** 되나요? | 이관 호환의 전제. 동료 환경이 UI5 유사라 이 HTML5 하위트리를 **내 경로 그대로** 얹을 수 있어야 함. 불가하면 base 경로 합의 필요. |
| **Q2** | 별창을 띄우는 쪽(부모)에서 `BrowserWindow`(frame:false) **생성·IPC 배선**은 동료가 하나요? | 번들 견본은 창 *내부*를 담당. 창을 여는 코드/부모 IPC는 이관 시 내 프로젝트가 제공(개발 중엔 동료가 최소 오프너 필요). |
| **Q3** | 어떤 별창 팝업을 만들 예정인가요? (내용·주요 기능·대략 크기·쓰는 부품: 표/트리/입력폼 등) | **견본 뼈대로 충분한지** 판단 + 필요한 공통 부품(§6.2)과 관련 표준 절을 미리 안내하려면 필요. 팝업 성격 따라 견본 베이스(정제할 기존 팝업) 선택도 달라짐. |

### 이미 확인된 전제 (재확인 불필요)
- **AI = Codex 확정**(동료 확인). → 가드레일은 `AGENTS.md`/`GUARDRAIL.md` 로 적용(§5).
- **동료에게 기존 루트 `AGENTS.md` 있음 확정**. → 루트는 **안 건드리고**, 동료가 루트에 트리거 한 줄 추가(§5).
- 목표=**HTML5+Bootstrap** · OS=**Windows** · **동일 Electron**.
- 동료 환경엔 **bootstrap/FA 등 HTML5 프론트 라이브러리만 없음(UI5 유사)** → 번들이 **HTML5 토대 전량 제공**, 버전 충돌 없음.
- **★ WS 셸 런타임은 동료도 동일하게 사용 가능**(확인): `@electron/remote`, `ws30/resources/pathInfo.js`,
  `WSUTIL`(QueryString·MessageClassText 등), 부모 창이 넘기는 `USERINFO`(LANGU/SYSID)·browserkey,
  **메시지 클래스 텍스트(SQLite)**. → **견본 frame.js 가 그대로 실행됨.** (이 런타임은 동료가 이미 보유 → 번들 미포함.)
- **테마 포함.** 파라미터에 테마 정보 없으면 **화이트 기본**(`theme-api.js` `DEFAULT_THEME="horizon_white"`, tokens.css `:root`).

---

## 3. 전달 방식 = "내 경로 미러 오버레이 번들"

- 공유 레포/서브모듈/npm **불가** → **버전 찍힌 자체 완결 zip**, 큰 변경 때 재전달.
- zip 내부 경로 = **내 프로젝트 경로 그대로 미러**. 동료가 루트에서 풀면 내 골격이 그대로 생김.
  - 동료 구조가 달라 내 경로를 못 얹으면(§2 Q1) base 경로 합의 후 매니페스트 경로 매핑.
- 벤더 라이브러리 **전량 동봉**(동료 환경에 없음 → 번들이 HTML5 토대 자체 제공, 풀면 바로 작동).
- **단방향**: 공통 자산은 동료 쪽에서 **읽기 전용**. 수정은 나에게 요청 → 상류에서만 반영.
  (동료 산출물 = 자기 팝업 폴더뿐. 공통 자산을 고치면 이관 시 충돌.)
- zip 패킹 시 **UTF-8 파일명 보존**(한글 파일명 안전).

### 3.1 포함 파일 (오버레이 대상 — 전부 내 경로)

```
# 공통 컴포넌트 (전체) + 스타일 + 테마
www/ws30/ws10_20/theme/tokens.css            # 색·간격 "의미 토큰" 계약
www/ws30/ws10_20/theme/shell.css             # 공통 컴포넌트 구조/기본(+ .u4a-titlebar/.u4a-toast 등)
www/ws30/ws10_20/theme/bootstrap-bridge.css
www/ws30/ws10_20/theme/bootstrap-skin.css    # 색·그림자·테두리 override (로드 마지막)
www/ws30/ws10_20/theme/u4a-ui.js             # 공통 컴포넌트 빌더 전체 (window.U4AUI)
www/ws30/ws10_20/theme/theme-api.js          # 테마 적용 API(U4ATheme, 기본 화이트)
www/ws30/ws10_20/theme/themes/**             # 테마 CSS 11종 (화이트 외 전환용)

# 벤더 (전량 동봉)
www/lib/bootstrap/5.0.2/**
www/lib/fontawesome/7.2.0/**

# 별창 견본 (복사용 최소 뼈대 — 이질감 0의 핵심)
www/ws30/ws10_20/Popups/_win-popup-template/**   # frame(제목줄+busy+IPC) + 빈 index, 공통 참조 배선 완료

# 실물 참조 + 표준 문서
www/ws30/ws10_20/ux-gallery.html             # 공통 UX 실물 갤러리(대조·검색 카탈로그)
.analy/16_공통_화면UX_표준.md                 # 화면 공통 표준 SSOT (별창=§2.6·2.11·9.5)
.analy/15_공통_입력UX_가이드.md               # 입력칸 공통 표준

# AI 가드레일 (동료 = Codex — Claude SKILL 미포함, 루트 AGENTS.md 는 동료가 한 줄 추가)

# 번들 메타 (언더바 = 현행 소스 아님, 충돌 회피)
_common-ux-bundle/GUARDRAIL.md               # Codex/공용 가드레일 (SKILL.md 와 쌍둥이 내용)
_common-ux-bundle/README.md                  # 배선·로드순서·수동 1줄 안내
_common-ux-bundle/VERSION.md                 # 원본 git SHA·날짜·변경요약
_common-ux-bundle/manifest.txt               # 번들 대상 경로 목록 (재수집 SSOT)
```

### 3.2 셸 서비스 처리 (busy/toast/message)

- **busy(로딩표시)**: 별창은 **자기 frame 이 주입하는 busy**를 쓴다(앱 셸 전역 busy가 아님).
  스타일 = `.u4a-busy`(shell.css SSOT, 카드+이중링), 토글 = frame.js `setBusy`/`setBusyLoading`(`data-busy`).
  → **견본 `frame.*` 에 이미 포함.**
- **toast/결과 메시지**: 별창 ↔ 부모 IPC 왕복(§2.11) — 부모가 판정·회신, 별창이 표시. `.u4a-toast`(shell.css).
  → 견본 frame 에 표시 훅 포함, 부모 측 IPC 는 이관 시 내 프로젝트가 제공(§2 Q4).
- 즉 "공통 UI 전체"는 **`u4a-ui.js`(빌더 전량) + 스타일/테마(`.u4a-busy`/`.u4a-toast` 포함) + 별창 견본 frame** 으로 충족.
  (frame 은 WS 셸 런타임에 의존하지만 §2 확인대로 동료가 공유하므로 그대로 동작.)

### 3.3 제외 (넣지 않음)

- **화면 전용/프로세스 문서**: `.analy/00~14, 17`, `U4A_WS20_*` 및 화면별 CSS(예: `login.css`), 다른 팝업 폴더들.
- **`AGENTS.md`(루트)**: 동료 것 존재 확정 → **덮지 않는다**. 대신 동료가 루트에 트리거 한 줄 추가(§5).
- **pack 스크립트**: 내 레포에만(번들엔 `VERSION.md`만).
- (`.analy/12_테마_컨버전_전략.md`: 테마 CSS/스위처는 포함하되, 테마 *전환 전략 문서*는 화면 표준이 아니라 제외. 필요 시 후속.)

---

## 4. 배선 규칙 (README + 견본에 명시)

별창 팝업이 공통 자산을 참조하는 **정규 상대경로**(견본에 이미 배선):

- 스타일/JS: `../../theme/tokens.css`, `../../theme/shell.css`, `../../theme/bootstrap-bridge.css`,
  `../../theme/bootstrap-skin.css`, `../../theme/theme-api.js`, `../../theme/u4a-ui.js`
- 벤더: `../../../../lib/fontawesome/7.2.0/css/all.min.css`, `../../../../lib/bootstrap/5.0.2/...`

**별창 팝업 정규 로드 스택** (실제 팝업 `OTRF4HelpPopup/frame.html` 기준 — 견본도 이대로):
1. `theme/tokens.css`
2. `theme/shell.css`
3. `theme/bootstrap-skin.css`  ← **theme CSS 중 반드시 마지막** (색/그림자/테두리 override)
4. fontawesome `all.min.css` (아이콘 — 순서 무관)
5. (팝업 전용 CSS: `frame.css` → `index.css`)

JS: `theme/theme-api.js` → `theme/u4a-ui.js` → 팝업 `frame.js`(→ iframe 본문 `index.js`).

- **불변식(중요)**: theme CSS 는 `tokens → shell → (bridge) → bootstrap-skin` 상대순서, **skin 이 theme 중 마지막**.
- **Bootstrap 은 별창 견본에 불필요** — 별창은 `.u4a-*` + `.u4a-titlebar` 만 쓰므로 `bootstrap.min.css`/`bootstrap-bridge.css` 를 로드하지 않는다(실제 팝업도 미로드). Bootstrap 클래스를 쓰는 화면만 `fontawesome → bootstrap.min → tokens → shell → bootstrap-bridge → bootstrap-skin` 전체 스택 사용(벤더는 번들에 포함돼 있음).

규칙: 색은 `tokens.css` 의미 토큰만(하드코딩 hex 금지) · 컴포넌트는 `U4AUI.*`/`.u4a-*` 소비(직접 생성 금지) ·
고정 px 폭 금지(반응형) · **공통 자산 수정 금지(읽기 전용)**.

---

## 5. 트리거 = 루트 AGENTS.md 한 줄 (Codex 확정 · 루트 AGENTS.md 존재 확정)

- **루트 `AGENTS.md`는 오버레이하지 않는다**(동료 것 존재 확정 — 덮으면 삭제됨).
- 대신 **동료가 자기 루트 `AGENTS.md` 맨 아래에 한 줄(트리거 문구) 추가**(최초 1회, README 2단계).
  Codex 는 대화 시작 시 루트 `AGENTS.md` 를 항상 읽으므로, 요청에 **"공통 UX"** 가 있으면 이 한 줄이
  `GUARDRAIL.md` 로 연결한다. → 첫 마디부터 확실히 걸림. "공통 UX" 없는 일반 작업엔 미적용.
- 스코프 `Popups/AGENTS.md` 는 **폐기**(루트 한 줄이 확실한 트리거라 중복 · Codex의 나중-로드 타이밍 의존이라 불확실).
- 동료 = Codex 확정 → Claude 용 `SKILL.md` 는 번들 미포함(코덱스가 안 읽음, GUARDRAIL 과 내용 중복).
- 규칙 실체 SSOT = `.analy/16`(+`15`) → `GUARDRAIL.md` 가 얇은 포인터라 **드리프트 없음**.

---

## 6. 가드레일(GUARDRAIL.md) 내용 설계

동료는 UX를 모르고, 용어도 다르게 쓰며, 옵션(가상스크롤 등)을 신경 안 쓴다. 판단은 사람이 아니라
**Codex가 규칙대로 대신**하게 만든다.

### 6.0 이관 호환 규칙 (최우선)
- **★ 착수 전 구조 설계 게이트 (필수 · 자율)**: 화면을 그리기 **전에** ① 팝업 **이름** 확정 →
  ② `ux-gallery.html`·`.analy/16`·`15` 를 확인해 **UX 구조**(영역·배치·쓰는 공통 부품)를 **표준대로** 정함(임의 레이아웃 금지) → 그대로 구현.
  **원격 승인자 없음**(파일만 전달 = 동료가 자율 사용). 구조가 애매하거나 대응 표준이 없으면 만들지 말고 **이 요청을 준 사용자(동료)에게 되묻는다**(§6.1-3).
  **근거**: 원본 프로젝트와 동일 구조로 그리기 위함.
- 별창 팝업은 **`Popups/<이름>/` 폴더 하나**로 만든다. **견본 `_win-popup-template` 을 복사**해 시작.
- 공통 자산은 **§4 정규 상대경로로 참조만** 하고 **복사·수정하지 않는다**(이관 시 충돌 방지).
- 별창 표준(§2.6 첫 페인트/등장, §2.11 부모 IPC, §9.5 서브페이지 전환)을 그대로 따른다.

### 6.1 3층 안전 구조 (용어 예측 불가 흡수)
1. **의도 기반 gate(단어 무관)**: "**어떤** UI 요소를 만들거나 고치기 전에, 먼저 `ux-gallery.html`과
   `.analy/16`·`15`에서 대응 공통 부품을 찾아라. 있으면 그걸 써라. 임의로 새로 만들지 마라."
2. **카탈로그 자가검색**: `ux-gallery.html`·`u4a-ui.js`·`.u4a-*` 를 grep 해 부품을 스스로 찾는다(표에 없어도).
3. **최후 안전망**: 못 찾거나 애매하면 **새로 만들지 말고 사용자에게 물어라.**

### 6.2 용어 번역표 (우리 은어 + 자주 쓰는 말 → 표준/자산)

| 동료가 이렇게 말하면 | = 우리 표준 | 쓸 것 |
|---|---|---|
| electron window / 새창 / BrowserWindow / frameless / 팝업 창 | **별창(별도창)** | `_win-popup-template` 복사 + `16` §2.6·2.11·9.5 + `.u4a-titlebar` |
| 모달 / dialog / 팝업 | 공통 모달 | `.u4a-dialog` (`16` §2.x) |
| dropdown / select / 콤보 | — | `U4AUI.createSelect` / `.u4a-combo` |
| 입력칸 / textbox / field | — | `U4AUI.createField` (`15`) |
| 트리 | — | `U4AUI.createTree` |
| 표 / grid / table / 테이블 | 평면표 | `U4AUI.makeDataTable` (가상 기본 ON) |
| 트리테이블 / 컬럼 트리 | — | `U4AUI.makeColumnTree` |
| 토스트 / 알림 | — | `.u4a-toast` + 부모 IPC(§2.11) |
| 분할 / splitter | — | `U4AUI.wireSplitter` / `.u4a-splitter` |
| 확인창 | — | `U4AUI.confirm` |
| 패널 / 접이식 | — | `U4AUI.createPanel` |
| 푸터 | — | `U4AUI.footerMarkup/footerShow/footerHide` |

표는 완벽히 채울 필요 없음(1·2층이 나머지를 잡음). grep 으로 안 잡히는 **은어(별창)**만 확실히 넣는다.

### 6.3 옵션 결정 규칙 (사람이 판단 안 해도 AI가 대신)
- 표는 **직접 `<table>` 금지**, 무조건 공통 컴포넌트 사용.
- **평면 표(`makeDataTable`)**: 가상스크롤 **기본 ON**(`virtual !== false`) — 데이터 많든 적든 그냥 쓰면 안전.
- **트리테이블(`makeColumnTree`)**: 가상은 **생성 시점 결정**(§6.4). 대량 가능성 있으면 **처음부터 virtual+펼침맵
  레시피**로 짠다. **규모 모르면** 임의로 정하지 말고 **동료에게 "이 트리 최대 몇 건?" 물어라.**
- 밀도/반응형: compact·카드형 등 공통 기본을 그대로 소비(하드코딩 금지).

### 6.4 알려진 제약 (spec + GUARDRAIL 모두 명시)
- **트리테이블 가상스크롤은 생성 시점 결정**이며 **런타임 동적 전환 불가**
  (`makeColumnTree` virtual 은 외부 펼침맵 아키텍처 전제 — `u4a-ui.js:1524`).
  → 비가상으로 만든 뒤 대량이 되면 자동 전환 안 됨(성능 저하, 깨지진 않음) → "규모 불명 시 물어라" 필요.

---

## 7. 별창 견본(`_win-popup-template`) 사양

- 기존 단순 별창(`OTRF4HelpPopup` 등)의 **frame 패턴을 최소 뼈대로 정제**해 만든 복사용 견본.
- 구성: `frame.html/js/css`(제목줄 `.u4a-titlebar`·자체 busy·부모 IPC 훅) + `index.html/js/css`(빈 콘텐츠 영역).
- 공통 자산은 **§4 정규 상대경로**로만 참조(복사·수정 없음). 파라미터에 테마 없으면 화이트.
- 동료 사용법(README/GUARDRAIL): **폴더 복사 → 이름 변경 → `index.*` 내용만 채움.** frame 은 손대지 않음.
- 견본에 불필요한 실기능 로직은 넣지 않는다(빈 뼈대). 실제 참고가 더 필요하면 `ux-gallery.html`·`16` 대조.
- **런타임 의존(§2 확인 = 동료 공유)**: frame.js 는 `@electron/remote`·`pathInfo.js`·`WSUTIL`·부모가 넘기는
  `USERINFO`(LANGU/SYSID)·browserkey·메시지백엔드를 쓴다. → 개발 중 실행하려면 **부모 오프너가 그 쿼리스트링을
  넘겨 창을 열어야** 한다(§2 Q4, 최소 오프너). 이관 후엔 내 프로젝트 부모가 제공.

---

## 8. 업데이트/재동기화 (내가 수행하는 절차)

공유 채널 없음 → 실시간 자동 동기화 불가. 대신 "항상 최신·정확한 번들"을 재생성해 재전달.

사용자가 **"공통 UX 내용 업데이트 되었다"**라고 하면 내가 순서대로:
1. `manifest.txt`(대상 경로) + `VERSION.md`의 직전 SHA 로드.
2. 직전 SHA 대비 `git diff`로 공통 경로 변경 파악.
3. **신규 파일 탐지**(매니페스트 노후 방지): `theme/`·`themes/`에 새 파일, 대표 팝업 `<head>` 로드 목록에
   새 공통 자산, `.analy/16`이 새로 참조하는 자산 → 있으면 **매니페스트에 추가**.
4. 갱신된 매니페스트로 현재 파일 전량 수집 → **UTF-8 보존 zip**.
5. `VERSION.md` 갱신(새 SHA·날짜·`git diff --stat`).
6. 무엇이 바뀌고 무엇이 새로 들어갔는지 **보고**.

- 자동화 보조: 내 레포에 `pack-common-ux.ps1`(PowerShell) — 매니페스트 읽어 결정적 수집·zip.
- 동료: 새 zip을 **다시 오버레이(덮어쓰기)** → 공통 자산 갱신. 자기 팝업 폴더·`AGENTS.md`는 안 건드림.

---

## 9. 별도 보고 (이번 범위 밖 — 원본 변경이라 임의 적용 안 함)

- **B. `makeColumnTree` 행 수 기반 가상스크롤 자동화**: 현재 구조상 동적 전환 불가 → 아키텍처 리팩터링.
  공통 컴포넌트 동작 변경이라 **별도 작업**(승인 시).

---

## 10. 수용 기준

- [ ] zip을 빈 미러 트리에 풀면 §3.1 파일이 내 경로에 정확히 안착(오버레이 무충돌, 루트 `AGENTS.md` 미변경).
- [ ] `_win-popup-template` 을 복사해 이름만 바꾼 팝업이, **§4 상대경로로 공통 자산을 참조해 정상 렌더**
      (제목줄·busy·화이트 테마 적용).
- [ ] 그 팝업 폴더를 내 프로젝트 `Popups/` 에 넣으면 **경로 수정 없이 그대로 실행**(이관 호환).
- [ ] 평면 표(`makeDataTable`)가 가상스크롤 기본 ON.
- [ ] `GUARDRAIL.md` = 이관규칙 + 3층 + 용어표 + 결정규칙 + 알려진 제약. 루트 AGENTS.md 트리거 한 줄로 연결.
- [ ] `VERSION.md`(SHA·날짜·변경요약) + `manifest.txt` 존재. 한글 파일명 UTF-8 무손상.

---

## 11. 미결/후속
- 환경 전제(§2 Q1~Q4) 최초 1회 확인 결과 반영.
- 견본 팝업 뼈대의 베이스(어느 기존 팝업을 정제할지) 확정.
- B(가상스크롤 자동화) 별도 진행 여부.
