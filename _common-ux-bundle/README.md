# 공통 UX 번들 — 사용 안내

원본 프로젝트의 **공통 화면 UX 자산·표준·별창 견본·AI 가드레일** 묶음.
이 번들로 **별창 팝업을 개발**한 뒤 **그 폴더만 원본 프로젝트로 이관**하면 이질감 0으로 실행된다.

---

# ★ 설치 (딱 2단계 — 이것만 하면 끝)

## 1단계) 압축 해제
프로젝트 **루트**(`www` 폴더가 있는 위치)에서 압축을 푼다. 파일이 실제 경로에 그대로 안착한다.
(기존 루트 `AGENTS.md` 는 **덮어쓰지 않는다**.)

## 2단계) 루트 `AGENTS.md` 에 한 줄 추가 — ★필수 · 최초 1회
기존 루트 `AGENTS.md` **맨 아래에 아래 문구**를 붙인다(루트에 `AGENTS.md` 가 없으면 이 내용으로 새로 만든다):

```
[공통 UX 규칙] 새 창·새창·별창·팝업·BrowserWindow·Electron(일렉트론) 창/팝업·frameless·모달 등
"창"을 만들거나, 그 밖에 화면·UI(입력칸·표·트리·폼·버튼 등)를 만들거나 고치는 요청이면 —
표현이 무엇이든, "공통 UX" 언급이 없어도 — 먼저 _common-ux-bundle/GUARDRAIL.md 를 읽고
그 규칙(견본 복사·공통 컴포넌트 소비·표준 준수)을 반드시 따를 것.
```

**왜 필수인가:** Codex 는 대화 시작 시 **루트 `AGENTS.md` 만** 자동으로 읽는다. 이 문구가 있어야
동료가 **"BrowserWindow 하나 만들어줘"·"일렉트론 팝업"·"새 창"** 무엇으로 말하든 Codex 가 곧바로
규칙을 찾아 따른다. (이 문구가 없으면 첫 마디에 규칙을 못 찾을 수 있다.)

> **설치 끝.** 이제 새 대화창에서 **"공통 UX 로 새 창(별창 팝업) 하나 만들어줘"** 라고만 하면,
> Codex 가 견본 복사 → 공통 컴포넌트로 화면 구현까지 규칙대로 알아서 한다. 완성된 `Popups/<이름>/`
> 폴더만 원본 담당자에게 넘기면 된다.

### 압축에 담긴 것
```
www/ws30/ws10_20/theme/**            공통 컴포넌트·스타일·테마 (u4a-ui.js, shell.css, tokens.css, theme-api.js, themes/)
www/lib/{bootstrap,fontawesome}/**   벤더 라이브러리 (전량 동봉)
www/ws30/ws10_20/Popups/_win-popup-template/**   별창 팝업 견본 (복사용)
www/ws30/ws10_20/Popups/AGENTS.md    별창 작업 스코프 규칙 (Codex 가 Popups/ 작업 시 보강 로드)
www/ws30/ws10_20/ux-gallery.html     공통 UX 실물 갤러리 (작업 전 대조)
.analy/16_공통_화면UX_표준.md          화면 공통 표준 (SSOT)
.analy/15_공통_입력UX_가이드.md        입력칸 공통 표준
_common-ux-bundle/{GUARDRAIL,README,VERSION}.md   가드레일·안내·버전
```

---

## 2. 별창 팝업 시작법 (Codex 로 개발)

설치(위 2단계) 후, 동료가 **"공통 UX 로 새 창 만들어줘"** 라고 요청하면 Codex 가 다음을 **자율로** 수행한다
(원격 승인자 없음 — 애매하면 요청한 동료에게 되묻는다):

1. 견본 폴더 복사: `Popups/_win-popup-template` → `Popups/<팝업이름>/`.
2. **착수 전 구조 설계(`GUARDRAIL.md` §0, 자율)**: 팝업 이름 확정 → `ux-gallery.html`·`.analy/16`·`15` 를 확인해
   UX 구조를 표준대로 정함 → 그대로 구현. 원격 승인 절차 없음(애매하면 이 요청을 준 사용자에게 되묻음).
3. **`index.*` 에만** UX 를 구현한다(공통 컴포넌트 `U4AUI.*` / `.u4a-*` 소비). **`frame.*` 는 손대지 않는다**
   (창 크롬·Busy·테마·IPC 뼈대 완성됨).
4. 완료된 **`Popups/<팝업이름>/` 폴더만** 원본 프로젝트로 이관 → 화면 버튼에서 실행.

---

## 3. 가드레일이 걸리는 원리 (참고)

- **첫 마디부터 확실히 걸리는 트리거** = 설치 2단계의 **루트 `AGENTS.md` 한 줄**. Codex 는 대화 시작 시
  루트 `AGENTS.md` 를 항상 읽으므로, 이 한 줄이 `GUARDRAIL.md` 로 연결해 준다. **그래서 2단계가 필수.**
- **보강** = 번들의 **`www/ws30/ws10_20/Popups/AGENTS.md`**. Codex 가 `Popups/` 밑 파일을 만질 때
  추가로 읽혀 규칙을 다시 확인시킨다(루트 한 줄이 "첫 진입", 이 파일이 "작업 중 재확인").
- **기존 루트 `AGENTS.md` 를 덮지 않는다** — 2단계는 맨 아래에 한 줄 **추가**(기존 내용 보존).
- 이관 시엔 **내 팝업 폴더만** 옮기므로 `Popups/AGENTS.md` 는 원본 프로젝트로 따라오지 않는다(오염 0).
- (동료는 Codex 사용 — Claude Code 용 스킬은 번들에 미포함. 규칙 원문은 `GUARDRAIL.md`.)

---

## 4. 배선/로드 스택 (견본에 이미 적용됨 — 바꾸지 말 것)

별창 정규 로드 순서:

```
CSS : tokens.css → shell.css → bootstrap-skin.css → fontawesome(all.min.css)
JS  : theme-api.js → u4a-ui.js → frame.js   (본문 iframe: index.html → index.js)
```

- **불변식**: theme CSS 중 `bootstrap-skin.css` 가 **마지막**(색·그림자·테두리 override). 어기면 테마 안 먹음.
- 별창은 `.u4a-*` + `.u4a-titlebar` 만 쓰므로 **Bootstrap(min/bridge) 미로드**.
- 색은 `tokens.css` 의미 토큰만(하드코딩 hex 금지). 고정 px 폭 금지(반응형).
- 파라미터에 테마 정보 없으면 **화이트(horizon_white) 기본**.

---

## 5. 업데이트

원본의 공통 UX 가 바뀌면 새 zip 을 받는다.

- 새 zip 을 **다시 루트에서 풀어 덮어쓴다** → 공통 자산 갱신.
- **내 팝업 폴더(`Popups/<이름>/`)와 `AGENTS.md` 는 그대로**(덮이지 않음).
- `_common-ux-bundle/VERSION.md` 의 "직전 대비 변경" 으로 무엇이 바뀌었는지 확인한다.

---

## 6. 런타임 전제 (환경 확인)

견본 `frame.js` 는 원본 프로젝트의 셸 런타임을 사용한다(동료 환경에서 동일 사용 가능해야 함):

- `@electron/remote`, `ws30/resources/pathInfo.js`, `WSUTIL`(QueryString·MessageClassText 등).
- 별창을 여는 **부모 창**이 `USERINFO`(LANGU/SYSID)·`browserkey`·`BGCOL`/`THEME`/`TITLE` 를 **쿼리스트링으로 전달**.
- 메시지 클래스 텍스트(SQLite) 백엔드.

개발 중 견본을 실행하려면 위 셸 런타임 + 최소 부모 오프너(쿼리스트링 전달)가 필요하다.
이관 후엔 원본 프로젝트 부모가 이를 제공한다.
