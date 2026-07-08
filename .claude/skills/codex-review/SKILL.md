---
name: codex-review
description: Codex CLI 서브에이전트로 변경분(git diff)의 로직 정확성과 UX 표준(.analy/16, CLAUDE.md)을 검수한다. child_process 로 `codex exec`(비대화형, 읽기전용)를 실행한다. ⚠️ 사용자가 "코덱스로 검수/리뷰", "소스 검증", "코덱스 돌려" 처럼 명시적으로 검수를 지시할 때에만 실행한다. 작업 완료·커밋 전이라는 이유로 자동/선제 실행하지 말 것.
---

# Codex 소스 검수 (로직 + UX)

**Codex CLI 를 서브에이전트로 돌려** 변경분을 독립적으로 검수받는다.
Codex 는 이 프로젝트의 표준(로직 정확성 + UX 공통 자산/토큰/반응형)을 기준으로 diff 를 리뷰한다.

## 언제 실행하나 (중요)

- **사용자가 검수를 명시적으로 지시할 때에만** 실행한다.
  예: "코덱스로 검수/리뷰해줘", "소스 검증해줘", "코덱스 돌려".
- 작업이 끝났다·커밋 직전이다 라는 이유만으로 **자동/선제 실행하지 않는다.**
  (검수가 필요해 보이면 실행 대신 "코덱스 검수 돌릴까요?" 라고 물어본다.)

## 실행 방법

프로젝트 루트에서 Node 스크립트를 실행한다. `child_process` 로 `codex exec` 를 띄우고,
변경분(git diff)을 stdin 으로 넘겨 검수시킨다.

```bash
node .claude/skills/codex-review/codex-review.cjs
```

기본 동작: **작업트리의 커밋 안 된 변경**(`git diff HEAD`) 전체를 리뷰한다.

### 범위 옵션

| 명령 | 리뷰 대상 |
|------|-----------|
| `node .claude/skills/codex-review/codex-review.cjs` | 커밋 안 된 변경 전체 (기본) |
| `... codex-review.cjs --staged` | 스테이징된 변경만 |
| `... codex-review.cjs --commit <ref>` | 특정 커밋 |
| `... codex-review.cjs --base main` | `main..HEAD` 범위 |
| `... codex-review.cjs www/ws30/.../frame.js` | 지정 파일들만 |
| `... codex-review.cjs --model <name>` | Codex 모델 지정 (기본: Codex 설정값) |

## 절차

1. 변경 작업을 끝낸다(파일 저장까지 완료).
2. 위 명령을 Bash 로 실행한다. Codex 가 리포지토리를 읽으며 검수하고, 스트림으로 진행이 보인다.
3. Codex 의 **판정**(`PASS` / `CHANGES_REQUESTED`)과 이슈 목록을 사용자에게 요약 전달한다.
4. `CHANGES_REQUESTED` 이고 지적이 타당하면 수정 후 **다시 실행**해 재검수한다.
   - 단, Codex 지적을 맹목 수용하지 말 것. 이 프로젝트 규칙(CLAUDE.md/.analy)과 어긋나거나
     오탐이면 근거를 들어 사용자에게 알리고 반영하지 않는다.

## Codex 가 보는 검수 기준

- **로직/정확성**: 버그·경계조건·null·비동기(await 누락)·이벤트 누수, 예외 삼키기 금지,
  busy on/off 짝, 핸들러 유효성검증 우선.
- **UX 표준**(SSOT `.analy/16`, `CLAUDE.md`): 공통 자산 소비(shell/bootstrap-skin/u4a-ui/tokens),
  공통 CSS/JS 직접수정 금지·스코프 override, 색은 의미 토큰만(hex 금지)·문구는 메시지 키,
  반응형(고정 px 금지), 잘리는 텍스트 툴팁, 오버레이/토스트 공통 시스템, `_` 폴더 인용 금지.

## 사전 조건

- Codex CLI 설치·로그인 필요: `npm i -g @openai/codex` 후 `codex login`.
- 스크립트는 PATH 의 `codex`, 없으면 npm 전역(`%APPDATA%\npm\codex.cmd`)을 자동 탐색한다.
- 샌드박스는 `read-only` — Codex 는 파일을 수정하지 않고 **리뷰만** 한다.
