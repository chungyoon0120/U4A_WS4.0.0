import sys
import json
import threading

# ── 항상 AI에게 전달할 내용 ──────────────────────────
ALWAYS_CONTEXT = """\
- 응답은 한국어로, 간결하고 직접적으로.
- 과도한 추상화/오버엔지니어링 지양.
- UI(화면/컴포넌트/레이아웃)를 새로 만들거나 수정하는 작업에는
  반드시 `.analy` 폴더 안의 UX 관련 md 파일을 먼저 읽고, 그 규칙·패턴에 맞춰 작업할 것.
"""

def show_toast(prompt, project):
    """데스크탑 알림 (블로킹 방지를 위해 별도 스레드)"""
    try:
        from windows_toasts import Toast, WindowsToaster
        toaster = WindowsToaster("Claude Code")
        toast = Toast()
        toast.text_fields = [
            f"📝 [UserPromptSubmit] {project}",
            prompt[:80],
        ]
        toaster.show_toast(toast)
    except Exception:
        pass  # 알림 실패가 훅을 막으면 안 됨

def main():
    raw = sys.stdin.read()
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        data = {}
    import os
    prompt = data.get("prompt", "")
    cwd = data.get("cwd", "")
    project = os.path.basename(cwd.rstrip("\\/")) or "Claude Code"

    # 알림은 백그라운드로 (모델 처리 지연 방지)
    t = threading.Thread(target=show_toast, args=(prompt, project), daemon=True)
    t.start()

    # 컨텍스트 주입
    output = {
        "hookSpecificOutput": {
            "hookEventName": "UserPromptSubmit",
            "additionalContext": ALWAYS_CONTEXT,
        }
    }
    print(json.dumps(output))   # stdout → AI 컨텍스트로 삽입

    # 데몬 스레드가 토스트를 OS에 전달하기 전에 프로세스가 죽지 않도록 대기
    # (메인이 즉시 sys.exit 하면 데몬 스레드가 강제 종료되어 알림이 사라짐)
    t.join(timeout=5)
    sys.exit(0)

if __name__ == "__main__":
    main()