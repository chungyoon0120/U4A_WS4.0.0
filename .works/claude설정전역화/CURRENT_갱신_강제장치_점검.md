# CURRENT.md 최신화 — 훅이 강제하나 (점검)

> 2026-09-16 · 장군님 물음 「원래 훅이나 이런 데에서 current.md 최신화하라는 내용이 없는 거야?」
> 설정 파일·훅 소스를 읽어 확인. §2·§3 은 고치기 전 상태다.

---

> **⚠ 아래 §0 은 뒤집혔다(2026-09-16).** 장군님 정정: CURRENT.md 는 인수인계서, 지시할 때만 갱신. 갱신 지침·막는 장치는 빼고 0.9.15 로 다시 빌드 → [CURRENT_용도_정정_영향목록.md](CURRENT_용도_정정_영향목록.md)

## 0. 한 것 (2026-09-16 장군님 지시 「그런 내용들을 D:\workspace\yoon-agent-kit 훅에 추가해」 · 「exe 로 말아서 배포하게」)

| 무엇 | 어디 | 내용 |
|---|---|---|
| 대화 시작 지침 문구 | 킷 `resources/hooks/{claude,codex}/SessionStart` · `antigravity/PreInvocation` (세 파일 같은 글) | 「이력을 쓰거나 고쳤으면 끝내기 전에 CURRENT.md 갱신 — 다른 agent 가 이 파일만 먼저 읽고 무엇을 할지 바로 알게. 이력 먼저, CURRENT 마지막」. 새 프로젝트에 만드는 `.docs/README.md` 글에도 같은 뜻 추가 |
| 답변 끝내기 훅 | 킷 `resources/hooks/{claude,codex}/Stop` | **이 대화의 이력 파일**(이름 끝 `_<session앞8자리>.md`)이 `.docs/CURRENT.md` 보다 나중이면 막는다. 다른 대화 이력으로는 안 막음. 막은 횟수는 이력 검사와 합쳐 한 대화 3번까지 |
| 대화 압축 뒤 | 킷 `installer/configure.py` | 대화 시작 훅 matcher 에 `compact` 추가. 근거 = Claude Code·Codex 0.143.0 실행 파일 안 source 값 목록에 `compact` 가 있다 |
| 빌드 | `D:\workspace\yoon-agent-kit\build\output\Yoon-AgentKit-0.9.14-Setup.exe` (50.2 MB) | 빌드 전 검사 5단계 통과(킷 시험 115건 — 새 검사 18건 포함) · **실제 설치는 안 했다** → [00_현황판.md](00_현황판.md) CG 그룹 |

**안 한 것**: 대화 시작 지침의 「변경이 전혀 없는 단순 질의에는 이력 파일을 만들지 마라」 (§2 네 번째 줄, 이 프로젝트 README 와 반대) — 지시 범위가 애매해 그대로 뒀다.

**설치 뒤 달라지는 점**: 이력을 쓴 대화는 CURRENT.md 도 한 번 고쳐야 끝난다. 이 프로젝트 CURRENT.md 는 「도구 쪽 일은 적지 않는다」 규칙이 있어도 파일은 고쳐야 통과한다.

---

## 2. 지금 무엇이 무엇을 하나 (소스 확인)

| 훅 | 어디 | 하는 일 | CURRENT.md |
|---|---|---|---|
| 매 턴 규칙 주입 | 프로젝트 `.claude/hooks/python/prompt_submit.py` → `.claude/rules/always.md` | 「CURRENT.md 를 먼저 읽고, 작업을 끝낼 때 반영한다」 **글을 매 턴 넣어 준다** | **글로 상기만.** 안 해도 막지 않는다 |
| 대화 시작 (전역 — claude·codex·antigravity 셋 다 같은 글) | 공용 킷 `hooks\<agent>\SessionStart\index.py` (antigravity 는 `PreInvocation`) | **목적이 적혀 있다** — 「새 대화를 시작할 때 README·CURRENT.md 를 먼저 읽고 **이전 작업 맥락을 복원**하라 … 완료 내용·진행 중인 작업·미해결 이슈·결정 사항·다음 작업을 파악한 뒤 현재 요청을 처리하라」. CURRENT.md 가 없으면 그 칸(프로젝트 목적/완료 내용/진행 중인 작업/미해결 이슈/주요 결정 사항/다음 작업/주요 위치)으로 새로 만든다 | **읽고 복원하라는 목적은 있다. 끝날 때 갱신하라는 말은 없다** — 이력 파일만 쓰라고 한다 |
| 답변 끝내기 ① | 공용 킷 `hooks\claude\Stop\index.py` | 가장 최근 이력 파일보다 **뒤에 고친 파일**이 있으면 답변을 **막는다**(한 대화 3번까지) | **안 본다.** `.docs/` 아래는 아예 검사에서 뺀다 |
| 답변 끝내기 ② | 프로젝트 `.claude/hooks/python/answer_finish.py` | Windows 알림 띄우기 | 관련 없음 |
| 대화 시작 안내 글 | 공용 킷 SessionStart (셋 다) | 「**변경이 전혀 없는 단순 질의에는 이력 파일을 만들지 마라**」 | 프로젝트 `.docs/README.md` 는 **반대** — 「조사·질의응답만 했든 남긴다(2026-09-14 장군님 지시로 철회)」 |
| 대화 압축(compact) 뒤 | 전역 설정 `~/.claude/settings.json` · 프로젝트 `.claude/settings.json` | 대화 시작 훅은 `startup|resume|clear` 에만 걸려 있다 — **대화를 압축한 뒤에는 위 안내 글이 다시 안 들어온다**. 킷 로그상 이 프로젝트 마지막 실행 = 2026-09-14 16:58 | 압축 뒤엔 매 턴 규칙 주입(always.md) 글만 남는다 |
| codex 답변 끝내기 | 공용 킷 `hooks\codex\Stop\index.py` | 이력 검사 | CURRENT 검사 없음(검색 0건) |
| 전역 지침 파일 | `~/.claude/CLAUDE.md` 없음 · `~/.codex/AGENTS.md` 빈 파일 | — | 없음 |
| 프로젝트 지침 | `AGENTS.md` 8·173줄 · `.docs/README.md` 8줄 · `.claude/rules/always.md` | 「먼저 읽는다」·「작업이 끝나면 CURRENT.md 에 반영」 | **글로만** |

**결론: CURRENT.md 의 목적(다른 에이전트가 먼저 읽고 이어받기)은 전역 대화 시작 훅·AGENTS.md·README·always.md 에 적혀 있다. 그런데 「끝날 때 갱신하라」는 전역 훅에는 없고 프로젝트 글에만 있으며, 어디서도 막아서 강제하지 않는다. 강제되는 것은 이력 파일뿐이다.** (앞 답변에서 「대화 시작 훅은 읽으라고만 한다」고 한 것은 목적 문구를 빠뜨린 설명이었다 — 정정) 그래서 오늘 CURRENT.md 에 끝난 줄이 남고 진행 중인 일이 빠져 있었다.

## 3. 이력 강제에도 빈틈이 있다

- 판정 기준이 「**가장 최근** 이력 파일의 시각」이다. 뒤에 이력 파일 **하나만** 새로 써도, 그 전에 빠뜨린 작업은 통과한다 — 오늘 오전 조사분 이력이 빠졌는데 안 막힌 이유.
- 한 대화에서 3번 막으면 그다음은 통과한다(갇힘 방지).
