# -*- coding: utf-8 -*-
"""Stop hook - 소스를 고쳤는데 .docs 이력을 안 남겼으면 답변을 못 끝내게 막는다.

2026-09-10 장군님 지시. 배포 후 운영을 AI 가 맡으므로,
어떤 agent 가 와도 이전 맥락을 이어받게 하려면 이력이 반드시 남아야 한다.

판정 방법 (도구 종류와 무관하게 통한다):
  .docs/history 안 **가장 최근 이력 파일의 시각**을 기준선으로 삼고,
  그보다 뒤에 손댄 파일이 있으면 "고쳤는데 안 남겼다" 로 본다.
  Edit 로 고쳤든 Bash 로 고쳤든 상관없이 잡힌다.

오류코드 접두: SHG / 다음 번호: 005

안전장치 - 세션이 갇히면 안 된다:
  1) payload 의 stop_hook_active 가 참이면 통과
  2) 같은 대화에서 3번 막으면 그다음은 통과 (로그를 남기고)
  3) 어떤 예외가 나도 통과 (fail-open) - 막는 쪽이 위험하다
  4) 무슨 일이 있어도 log 는 남긴다
"""
import sys
import os
import json
import subprocess
from datetime import datetime

HERE = os.path.dirname(os.path.abspath(__file__))
PROJECT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
LOG = os.path.join(HERE, "stop_history_gate.log")
STATE = os.path.join(HERE, "stop_history_gate.state.json")

HISTORY_DIR = os.path.join(PROJECT, ".docs", "history")
MAX_BLOCKS_PER_SESSION = 3
MAX_LISTED = 12

# 이 아래에 있는 것은 "고쳤다" 로 보지 않는다
SKIP_DIR_PARTS = (
    "/.docs/", "/.git/", "/node_modules/", "/dist/", "/logs/",
    "/__pycache__/", "/.venv/", "/archived_sessions/",
)
SKIP_SUFFIX = (".log", ".marker", ".state.json", ".bak", ".zip", ".tmp",
               "-shm", "-wal", ".lock")


def log(level, event, detail=""):
    """Append one line. Never raises - a logging failure must not break the hook."""
    try:
        with open(LOG, "a", encoding="utf-8") as f:
            f.write("%s %s %s %s\n" % (
                datetime.now().isoformat(timespec="seconds"), level, event, detail))
    except Exception:
        pass


def emit(obj):
    sys.stdout.write(json.dumps(obj, ensure_ascii=False) + "\n")
    sys.stdout.flush()


def passthrough(reason):
    log("INFO", "DONE", "pass through - " + reason)
    emit({"continue": True})
    return 0


def newest_history_mtime():
    """가장 최근 이력 파일의 시각. 이력이 하나도 없으면 None."""
    newest = None
    newest_path = ""
    if not os.path.isdir(HISTORY_DIR):
        return None, ""
    for root, dirs, files in os.walk(HISTORY_DIR):
        for name in files:
            if not name.endswith(".md"):
                continue
            p = os.path.join(root, name)
            try:
                m = os.path.getmtime(p)
            except Exception as e:
                log("WARN", "GUARD_EXIT", "[SHG-001] mtime read error on " + p + ": " + repr(e))
                continue
            if newest is None or m > newest:
                newest = m
                newest_path = p
    return newest, newest_path


def skipped(rel_path):
    p = "/" + rel_path.replace("\\", "/")
    for part in SKIP_DIR_PARTS:
        if part in p:
            return True
    base = os.path.basename(p)
    if base.startswith("_"):          # 백업 규약: _ 접두
        return True
    for suf in SKIP_SUFFIX:
        if base.endswith(suf):
            return True
    return False


def changed_files():
    """git 이 보는 바뀐 파일 목록 (수정 + 새 파일). git 이 없으면 빈 목록."""
    try:
        out = subprocess.run(
            ["git", "status", "--porcelain", "--untracked-files=all"],
            cwd=PROJECT, capture_output=True, text=True, timeout=30,
        )
    except Exception as e:
        log("ERROR", "CAUGHT", "[SHG-002] git status failed: " + repr(e))
        return None
    if out.returncode != 0:
        log("ERROR", "CAUGHT", "[SHG-003] git status returned %s: %s"
            % (out.returncode, (out.stderr or "")[:300]))
        return None

    files = []
    for line in (out.stdout or "").splitlines():
        if len(line) < 4:
            continue
        rel = line[3:].strip().strip('"')
        if " -> " in rel:             # 이름 바뀐 것은 뒤쪽이 지금 이름
            rel = rel.split(" -> ", 1)[1].strip().strip('"')
        if rel and not skipped(rel):
            files.append(rel)
    return files


def load_state(session):
    try:
        with open(STATE, encoding="utf-8") as f:
            d = json.load(f)
        if isinstance(d, dict) and d.get("session") == session:
            return int(d.get("blocks", 0))
    except Exception:
        pass
    return 0


def save_state(session, blocks):
    try:
        with open(STATE, "w", encoding="utf-8") as f:
            json.dump({"session": session, "blocks": blocks}, f)
    except Exception as e:
        log("ERROR", "CAUGHT", "[SHG-004] state write error: " + repr(e))


def main():
    raw = ""
    try:
        raw = sys.stdin.read()
    except Exception as e:
        log("ERROR", "CAUGHT", "[SHG-005] stdin read error: " + repr(e))
        return passthrough("stdin read error")

    payload = {}
    if raw.strip():
        try:
            payload = json.loads(raw)
        except Exception as e:
            log("ERROR", "CAUGHT", "[SHG-006] json parse error: " + repr(e))
            return passthrough("json parse error")
    if not isinstance(payload, dict):
        payload = {}

    if payload.get("stop_hook_active"):
        return passthrough("stop_hook_active is true")

    session = str(payload.get("session_id") or payload.get("sessionId") or "unknown")

    baseline, baseline_path = newest_history_mtime()
    if baseline is None:
        log("WARN", "GUARD_EXIT",
            "no history file under .docs/history - no baseline to compare, so nothing is enforced")
        return passthrough("no history baseline")

    files = changed_files()
    if files is None:
        return passthrough("git status unavailable")

    late = []
    for rel in files:
        full = os.path.join(PROJECT, rel)
        try:
            if os.path.isfile(full) and os.path.getmtime(full) > baseline:
                late.append(rel)
        except Exception as e:
            log("WARN", "GUARD_EXIT", "[SHG-001] mtime read error on " + rel + ": " + repr(e))

    if not late:
        return passthrough("no source file changed after the newest history file")

    blocks = load_state(session)
    if blocks >= MAX_BLOCKS_PER_SESSION:
        log("WARN", "GUARD_EXIT",
            "already blocked %d times in this session - passing through to avoid a block loop (%d file(s) still unrecorded)"
            % (blocks, len(late)))
        return passthrough("block limit reached")

    save_state(session, blocks + 1)

    shown = late[:MAX_LISTED]
    more = len(late) - len(shown)
    listing = "\n".join("  - " + p for p in shown)
    if more > 0:
        listing += "\n  - ... 그 밖에 %d개" % more

    log("INFO", "DONE", "block issued (%d/%d) - %d file(s) changed after %s"
        % (blocks + 1, MAX_BLOCKS_PER_SESSION, len(late), os.path.basename(baseline_path)))

    reason = (
        "파일을 고쳤는데 .docs 이력이 없다. 답변을 끝내기 전에 이력을 남겨라.\n\n"
        "가장 최근 이력 파일보다 뒤에 손댄 파일:\n" + listing + "\n\n"
        "남길 곳: .docs/history/%s/%s/\n"
        "파일 이름: YYYY-MM-DD_HHmmss_<agent>_<type>_<화면이름>_<session앞8자리>.md\n"
        "  - type = add / fix / refactor / remove / config / docs / test / mixed\n"
        "  - 화면이름 = 소스 폴더 이름 그대로 (나중에 이름으로 찾는다)\n"
        "필수 섹션: 요청 / 변경 내용 / 변경 파일(추가·변경·삭제) / 변경 이유 / 영향 범위 / 검증 / 참고 사항\n"
        "자세한 규칙은 .docs/README.md 를 봐라.\n\n"
        "같은 작업의 후속 수정이면 새 파일을 만들지 말고 그 작업의 이력 파일에 이어서 써라.\n"
        "실패·미검증·되돌린 것도 숨기지 말고 써라 - 다음 agent 가 같은 실수를 반복한다."
        % (datetime.now().strftime("%Y"), datetime.now().strftime("%m"))
    )

    emit({"decision": "block", "reason": reason})
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
