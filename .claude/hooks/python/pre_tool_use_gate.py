"""PreToolUse 게이트 — 편집/커밋 도구 직전에 '관련 규칙 파일'만 컨텍스트로 주입한다.

확장형 규칙 구조(.claude/rules/*.md)의 게이트. 규칙이 늘어나도 매 턴 전부 주입하지 않고,
행동 종류에 맞는 파일만 꺼낸다. 규칙 추가 = 해당 .md 에 한 줄, 이 스크립트는 안 건드림.

주의(공식 동작): PreToolUse 의 additionalContext 는 '도구 실행 후 다음 모델 요청'에 주입된다.
→ 순수 선제는 아니지만, 그 도메인 작업이 이어지는 동안 규칙이 컨텍스트에 상주한다.
"""
import sys
import json
import os
import re

# 커밋 메시지 제목 맨앞 [YYYY-MM-DD HH:MM] (메모리 commit-message-datetime-prefix)
_DATE_PREFIX = re.compile(r"\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}\]")


def check_commit_block(tool_name, tool_input):
    """git commit 형식 위반이면 차단 사유(str), 아니면 None.
    -m/--message 로 메시지를 주는 경우만 검사(에디터/-F/amend --no-edit 는 명령에 메시지가 없어 스킵)."""
    if tool_name not in ("Bash", "PowerShell"):
        return None
    cmd = tool_input.get("command") or ""
    if "git commit" not in cmd:
        return None
    if " -m" not in cmd and "--message" not in cmd:
        return None  # 메시지가 명령에 없음 → 스크립트로 검사 불가(스킵)
    if _DATE_PREFIX.search(cmd):
        return None  # 날짜 prefix 있음 → 통과
    return ("커밋 차단: 메시지 제목 맨앞에 [YYYY-MM-DD HH:MM] 형식의 날짜시간이 없습니다.\n"
            "예) git commit -m \"[2026-08-09 14:30] 제목...\"\n"
            "(규칙: .claude/rules/commit.md · 메모리 commit-message-datetime-prefix)")


def read_rule(base, name):
    try:
        with open(os.path.join(base, ".claude", "rules", name), "r", encoding="utf-8") as f:
            return f.read().strip()
    except Exception:
        return ""


def pick_rule(tool_name, tool_input):
    """도구/대상에 맞는 규칙 파일명을 고른다. 매칭 없으면 None."""
    fp = (tool_input.get("file_path") or tool_input.get("path") or "")
    fp_l = fp.replace("\\", "/").lower()
    cmd = (tool_input.get("command") or "")

    # 커밋 — Bash/PowerShell 로 git commit
    if tool_name in ("Bash", "PowerShell") and "git commit" in cmd:
        return "commit.md"

    if tool_name in ("Edit", "Write", "MultiEdit", "NotebookEdit"):
        # 문서(계획/현황판/보고/명세) — .md 또는 문서 폴더
        if fp_l.endswith(".md") or "/.works/" in fp_l or "/.analy/" in fp_l or "/.report/" in fp_l:
            return "document.md"
        # 코드
        if fp_l.endswith((".js", ".css", ".html", ".ts", ".json")):
            return "code.md"
    return None


def main():
    raw = sys.stdin.read()
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        data = {}

    tool_name = data.get("tool_name", "")
    tool_input = data.get("tool_input", {}) or {}
    cwd = data.get("cwd", "")
    base = os.environ.get("CLAUDE_PROJECT_DIR") or cwd or ""

    # ── 경성 차단: 커밋 형식(날짜 prefix) 위반이면 도구 자체를 막는다(exit 2, stderr → 모델) ──
    block = check_commit_block(tool_name, tool_input)
    if block:
        sys.stderr.write(block)
        sys.exit(2)

    rule_file = pick_rule(tool_name, tool_input)
    if not rule_file:
        sys.exit(0)  # 매칭 없음 — 아무 것도 주입 안 함(도구 정상 진행).

    body = read_rule(base, rule_file)
    if not body:
        sys.exit(0)

    ctx = "[규칙 상기: " + rule_file + "]\n" + body
    print(json.dumps({
        "hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "additionalContext": ctx,
            "permissionDecision": "allow"
        }
    }))
    sys.exit(0)


if __name__ == "__main__":
    main()
