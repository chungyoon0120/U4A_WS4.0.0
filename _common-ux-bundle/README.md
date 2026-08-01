# 공통 UX 번들 — 사용 안내

원본 프로젝트의 **공통 화면 UX 자산·표준·별창 견본·AI 가드레일** 묶음이다.
목적: 이 번들로 **별창 팝업을 개발**한 뒤 **그 폴더만 원본 프로젝트로 이관**하면 이질감 0으로 실행되게 한다.

---

## 1. 압축 해제 (내 경로 미러 오버레이)

프로젝트 **루트(`www`·`.analy` 가 있는 위치)에서** 압축을 푼다. 파일이 실제 경로에 그대로 안착한다:

```
www/ws30/ws10_20/theme/**            공통 컴포넌트·스타일·테마 (u4a-ui.js, shell.css, tokens.css, theme-api.js, themes/)
www/lib/{bootstrap,fontawesome}/**   벤더 라이브러리 (전량 동봉)
www/ws30/ws10_20/Popups/_win-popup-template/**   별창 팝업 견본 (복사용)
www/ws30/ws10_20/ux-gallery.html     공통 UX 실물 갤러리 (작업 전 대조)
.analy/16_공통_화면UX_표준.md          화면 공통 표준 (SSOT)
.analy/15_공통_입력UX_가이드.md        입력칸 공통 표준
.claude/skills/common-ux/SKILL.md    Claude Code 용 스킬
_common-ux-bundle/{GUARDRAIL,README,VERSION}.md   가드레일·안내·버전
```

- 루트 `AGENTS.md` 는 **덮어쓰지 않는다**(§3 참고).
- 이미 다른 버전이 있으면 새 zip 을 다시 풀어 덮어쓰면 갱신된다(§5).

---

## 2. 별창 팝업 시작법 (Codex 로 개발)

동료의 AI(Codex)가 다음을 수행한다. 사람은 **요청·구조 승인**만 한다.

1. 견본 폴더 복사: `Popups/_win-popup-template` → `Popups/<팝업이름>/`.
2. **착수 전 구조 승인 게이트**(`GUARDRAIL.md` §0): 팝업 이름 확정 → UX 구조 스케치 → **소유자 확인** → 승인 후 구현.
3. **`index.*` 에만** UX 를 구현한다(공통 컴포넌트 `U4AUI.*` / `.u4a-*` 소비). **`frame.*` 는 손대지 않는다**
   (창 크롬·Busy·테마·IPC 뼈대 완성됨).
4. 완료된 **`Popups/<팝업이름>/` 폴더만** 원본 프로젝트로 이관 → 화면 버튼에서 실행.

---

## 3. 가드레일 자동 적용 (Codex — 수동 편집 불필요)

- 번들에 **`www/ws30/ws10_20/Popups/AGENTS.md`** 가 포함돼 있다. **Codex 는 작업 파일 위쪽 폴더의
  `AGENTS.md` 를 자동으로 읽으므로**, `Popups/` 밑에서 별창 팝업을 만들 때 이 규칙이 자동 적용된다.
- **기존 루트 `AGENTS.md` 는 건드리지 않는다**(덮어쓰기·수동 편집 불필요). Codex 는 루트 + 이 스코프 파일을
  함께 읽는다(중첩 병합, 충돌 없음).
- 이관 시엔 **내 팝업 폴더만** 옮기므로 `Popups/AGENTS.md` 는 원본 프로젝트로 따라오지 않는다(오염 0).
- (동료는 Codex 사용 — Claude Code 용 스킬은 번들에 포함하지 않음. 규칙 원문은 `GUARDRAIL.md`.)

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
