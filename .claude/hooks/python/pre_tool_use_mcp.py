import sys
import os
import json


def parse_mcp_tool(tool_name):
    """mcp__<server>__<tool> 형태에서 서버명과 툴명을 분리한다."""
    if not tool_name:
        return None, None
    if not tool_name.startswith("mcp__"):
        return None, tool_name
    parts = tool_name.split("__", 2)  # ["mcp", server, tool]
    if len(parts) == 3:
        return parts[1], parts[2]
    if len(parts) == 2:
        return parts[1], ""
    return None, tool_name


def build_snippet(text, max_len=180):
    """입력값을 한 줄로 정리하고 길이를 제한한다."""
    if not text:
        return ""
    snippet = " ".join(str(text).split())
    if len(snippet) > max_len:
        snippet = snippet[:max_len].rstrip() + "…"
    return snippet


def main():
    # 1. stdin으로 들어온 PreToolUse hook JSON 파싱
    raw = sys.stdin.read()
    try:
        hook_input = json.loads(raw)
    except json.JSONDecodeError:
        hook_input = {}

    cwd = hook_input.get("cwd", "")
    project = os.path.basename(cwd.rstrip("\\/")) or "Claude Code"

    tool_name = hook_input.get("tool_name", "")
    tool_input = hook_input.get("tool_input", {})

    server, tool = parse_mcp_tool(tool_name)

    # MCP 툴이 아니면 알림 없이 종료 (matcher로 걸러지지만 이중 방어)
    if server is None:
        sys.exit(0)

    # 2. 토스트 본문 구성: 서버 / 툴 / 인자 요약
    title = f"🔧 [PreToolUse] 훅 실행됨 — MCP 툴 사용 ({project})"
    line2 = f"{server} ▸ {tool}"
    arg_summary = build_snippet(json.dumps(tool_input, ensure_ascii=False)) if tool_input else ""

    text_fields = [title, line2]
    if arg_summary:
        text_fields.append(arg_summary)

    # 3. 토스트 알림 표시
    try:
        from windows_toasts import Toast, WindowsToaster

        toaster = WindowsToaster("Claude Code")
        toast = Toast()
        toast.text_fields = text_fields
        toaster.show_toast(toast)
    except Exception:
        # 알림이 실패해도 툴 실행을 막지 않는다
        pass

    # 4. PreToolUse hook은 0으로 종료 (툴 실행 허용)
    sys.exit(0)


if __name__ == "__main__":
    main()
