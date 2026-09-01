import sys
import json
import os
import threading

# ── 항상 AI에게 전달할 내용 (폴백: 파일 못 읽을 때만 사용) ──────────────
_ALWAYS_FALLBACK = """\
- 추측성 답변 절대 금지, 실제 근거 기반으로 답변하고 목숨과 직결된 문제라는 생각으로 신중히 답변 할 것.
- 응답은 한국어로, 간결하고 직접적으로.
- 과도한 추상화/오버엔지니어링 지양.
- UI(화면/컴포넌트/레이아웃)를 새로 만들거나 수정하는 작업에는
  반드시 `.analy` 폴더 안의 UX 관련 md 파일을 먼저 읽고, 그 규칙·패턴에 맞춰 작업할 것.
- 답변은 반드시 항상 팩트만. 짧게. 결과 위주의 답변을 할 것.
- UI5->HTML5 변환 작업은 superpowers의 brainstorming을 생략하고
  계획(writing-plans)->구현(executing/subagent)->검증(verification+systematic-debugging)
  파이프라인으로 진행할 것. 정답은 항상 원본(as-is)+.analy SSOT이며 이 규칙이 어떤 스킬보다 상위.
"""

def load_always(cwd):
    """상시 규칙 = .claude/rules/always.md (없으면 폴백). 규칙 수정 = 파일 편집으로."""
    try:
        base = os.environ.get("CLAUDE_PROJECT_DIR") or cwd or ""
        path = os.path.join(base, ".claude", "rules", "always.md")
        with open(path, "r", encoding="utf-8") as f:
            body = f.read().strip()
        # 원래 하드코딩 규칙도 함께 유지(중복 아님 — 파일은 소통 규칙, 아래는 작업 파이프라인 규칙).
        return _ALWAYS_FALLBACK + "\n" + body if body else _ALWAYS_FALLBACK
    except Exception:
        return _ALWAYS_FALLBACK

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

    # 컨텍스트 주입 (상시 규칙 = rules/always.md)
    output = {
        "hookSpecificOutput": {
            "hookEventName": "UserPromptSubmit",
            "additionalContext": load_always(cwd),
        }
    }
    print(json.dumps(output))   # stdout → AI 컨텍스트로 삽입

    # 데몬 스레드가 토스트를 OS에 전달하기 전에 프로세스가 죽지 않도록 대기
    # (메인이 즉시 sys.exit 하면 데몬 스레드가 강제 종료되어 알림이 사라짐)
    t.join(timeout=5)
    sys.exit(0)

if __name__ == "__main__":
    main()