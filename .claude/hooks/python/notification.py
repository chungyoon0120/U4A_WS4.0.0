import sys
import os
import json


def build_snippet(text, max_len=200):
    """알림 메시지를 한 줄로 정리하고 길이를 제한한다."""
    if not text:
        return "Claude Code 알림"
    snippet = " ".join(text.split())  # 개행/연속 공백 정리
    if len(snippet) > max_len:
        snippet = snippet[:max_len].rstrip() + "…"
    return snippet


def main():
    # 1. stdin으로 들어온 Notification hook JSON 파싱
    raw = sys.stdin.read()
    try:
        hook_input = json.loads(raw)
    except json.JSONDecodeError:
        hook_input = {}

    cwd = hook_input.get("cwd", "")
    project = os.path.basename(cwd.rstrip("\\/")) or "Claude Code"

    # 2. 알림 메시지 추출 (권한 요청 / 입력 대기 등)
    message = hook_input.get("message", "")
    snippet = build_snippet(message)

    # 3. 토스트 알림 표시
    try:
        from windows_toasts import Toast, WindowsToaster

        toaster = WindowsToaster("Claude Code")
        toast = Toast()
        toast.text_fields = [f"🔔 [Notification] 훅 실행됨 — {project}", snippet]
        toaster.show_toast(toast)
    except Exception:
        # 알림이 실패해도 Claude를 막지 않는다
        pass

    # 4. Notification hook은 0으로 종료
    sys.exit(0)


if __name__ == "__main__":
    main()
