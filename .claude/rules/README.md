# 규칙 게이트 (확장형)

장군님 지시가 늘어나도 견디도록, 규칙을 **매 턴 전부 주입하지 않고** "관련 행동 직전에 해당 파일만" 주입한다.

## 구조
| 파일 | 언제 보이나 | 주입 방식 |
|---|---|---|
| `always.md` | 매 턴 (소수 불변만) | UserPromptSubmit hook (`prompt_submit.py`) |
| `commit.md` | `git commit` 직전 | PreToolUse hook (Bash + "git commit") |
| `document.md` | `.md`/문서 편집 직전 | PreToolUse hook (Edit/Write + 경로) |
| `code.md` | `.js` 등 코드 저장 직전 | PreToolUse hook (Edit/Write + 경로) |

## 확장 방법
- 새 규칙 = **해당 파일에 한 줄 추가**. hook 로직·설정은 안 건드린다.
- 새 카테고리가 필요하면 파일 1개 추가 + 게이트 hook에 매칭 1줄 추가.
- `always.md`는 **늘리지 않는다**(매 턴 주입이라 비대해지면 다 묻힘). 진짜 공통 소수만.

## 원칙
- 규칙은 **명령형 한 줄**. 근거·예외는 메모리/문서로 링크.
- 상태 SSOT·상세는 기존 문서(CLAUDE.md, .analy, 현황판, 메모리)에 두고, 여기는 "행동 직전 상기용 체크"만.
