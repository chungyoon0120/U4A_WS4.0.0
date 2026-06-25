import sys
import os
import json


def get_last_assistant_text(transcript_path):
    """transcript JSONL에서 마지막 assistant 텍스트 응답을 추출한다."""
    if not transcript_path or not os.path.isfile(transcript_path):
        return None

    last_text = None
    with open(transcript_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                entry = json.loads(line)
            except json.JSONDecodeError:
                continue

            if entry.get("type") != "assistant":
                continue

            content = entry.get("message", {}).get("content", [])
            # content는 블록 배열. text 타입 블록만 모은다
            texts = [
                block.get("text", "")
                for block in content
                if isinstance(block, dict) and block.get("type") == "text"
            ]
            joined = "".join(texts).strip()
            if joined:
                last_text = joined  # 마지막 응답으로 계속 갱신

    return last_text


def build_snippet(text, max_len=200):
    """여러 줄 응답을 한 줄로 정리하고 길이를 제한한다."""
    if not text:
        return "응답이 완료되었습니다."
    snippet = " ".join(text.split())  # 개행/연속 공백 정리
    if len(snippet) > max_len:
        snippet = snippet[:max_len].rstrip() + "…"
    return snippet


def main():
    # 1. stdin으로 들어온 Stop hook JSON 파싱
    raw = sys.stdin.read()
    try:
        hook_input = json.loads(raw)
    except json.JSONDecodeError:
        hook_input = {}

    transcript_path = hook_input.get("transcript_path")
    cwd = hook_input.get("cwd", "")
    project = os.path.basename(cwd.rstrip("\\/")) or "Claude Code"

    # 2. 마지막 답변 일부 추출
    answer = get_last_assistant_text(transcript_path)
    snippet = build_snippet(answer)

    # 3. 토스트 알림 표시
    try:
        from windows_toasts import Toast, WindowsToaster

        toaster = WindowsToaster("Claude Code")
        toast = Toast()
        toast.text_fields = [f"✅ [Stop] 훅 실행됨 — {project} 응답 완료(Local)", snippet]
        toaster.show_toast(toast)
    except Exception:
        # 알림이 실패해도 Claude를 막지 않는다
        pass

    # 4. Stop hook은 반드시 0으로 종료 (2면 Claude가 멈추지 않고 계속 진행됨)
    sys.exit(0)


if __name__ == "__main__":
    main()