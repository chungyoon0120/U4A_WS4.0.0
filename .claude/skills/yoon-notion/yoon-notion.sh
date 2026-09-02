#!/usr/bin/env sh
# yoon-notion launcher (POSIX / Git Bash / WSL / macOS / Linux)
#
# Finds a usable Python 3.9+ under any of the names it might have on this
# machine and runs notion_cli.py with it. Search order:
#   1. $YOON_NOTION_PYTHON            explicit override
#   2. <skill>/runtime                bundled self-contained runtime - needs no install
#   3. <skill>/.venv                  a virtualenv next to this script, if present
#   4. python3 / python / py          whatever is on PATH and new enough
#   5. common install locations       Windows/macOS/Linux defaults
#   6. uv run                         last resort; fetches a Python if needed
#
# Step 2 is what makes this skill work on a machine with no Python at all.
# Step 3 does NOT: a venv's python is a stub that delegates to the base
# installation, so a copied .venv dies with "did not find executable at ...".
# `yoon-notion.sh --setup-venv` creates that optional venv anyway; this CLI has
# no dependencies, so it only buys isolation, never portability.

set -e

DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
CLI="$DIR/notion_cli.py"
MIN_CHECK='import sys; sys.exit(0 if sys.version_info >= (3, 9) else 1)'

usable() {
    [ -n "$1" ] || return 1
    command -v "$1" >/dev/null 2>&1 || [ -x "$1" ] || return 1
    "$1" -c "$MIN_CHECK" >/dev/null 2>&1 || return 1
    return 0
}

find_python() {
    if [ -n "$YOON_NOTION_PYTHON" ]; then
        if usable "$YOON_NOTION_PYTHON"; then
            echo "$YOON_NOTION_PYTHON"
            return 0
        fi
        echo "yoon-notion: \$YOON_NOTION_PYTHON=$YOON_NOTION_PYTHON is not a usable Python 3.9+" >&2
        return 1
    fi

    # A bundled runtime: unlike a venv, this one is self-contained and works on
    # a machine with no Python installed. Drop the python.org "embeddable
    # package" (python-3.x-embed-amd64.zip) into <skill>/runtime/.
    for embedded in \
        "$DIR/runtime/python.exe" "$DIR/runtime/bin/python3" "$DIR/runtime/python"
    do
        if [ -x "$embedded" ] && usable "$embedded"; then
            echo "$embedded"
            return 0
        fi
    done

    for venv in "$DIR/.venv/bin/python" "$DIR/.venv/Scripts/python.exe"; do
        if [ -x "$venv" ] && usable "$venv"; then
            echo "$venv"
            return 0
        fi
    done

    for name in python3 python py; do
        if usable "$name"; then
            echo "$name"
            return 0
        fi
    done

    for path in \
        /usr/bin/python3 /usr/local/bin/python3 /opt/homebrew/bin/python3 \
        /c/Python3*/python.exe /c/Program\ Files/Python3*/python.exe \
        "$LOCALAPPDATA"/Programs/Python/Python3*/python.exe
    do
        if [ -x "$path" ] && usable "$path"; then
            echo "$path"
            return 0
        fi
    done

    return 1
}

no_python() {
    cat >&2 <<'MSG'
yoon-notion: 이 시스템에서 Python 3.9 이상을 찾지 못했습니다.

찾아본 곳:
  $YOON_NOTION_PYTHON, <스킬폴더>/runtime, <스킬폴더>/.venv,
  PATH의 python3/python/py, 일반적인 설치 경로들, uv.

해결 방법 (하나만 하면 됩니다):
  1) Python 설치        https://www.python.org/downloads/
                        Windows는 설치 시 "Add python.exe to PATH" 체크
  2) 경로를 직접 지정   YOON_NOTION_PYTHON=/실제/python/경로 로 환경변수 설정
  3) uv 설치            https://docs.astral.sh/uv/  (설치하면 파이썬도 알아서 받아옴)
  4) 이미 설치돼 있다면 어느 이름으로 실행되는지 확인 후 2)번으로 지정

참고: 이 CLI는 표준 라이브러리만 쓰므로 pip 설치는 필요 없습니다.
MSG
    exit 2
}

if [ "$1" = "--setup-venv" ]; then
    shift
    base=$(find_python) || no_python
    echo "creating venv with: $base"
    "$base" -m venv "$DIR/.venv"
    echo "created $DIR/.venv"
    echo "이제 이 런처가 자동으로 이 venv를 사용합니다."
    exit 0
fi

if [ "$1" = "--which-python" ]; then
    found=$(find_python) || no_python
    echo "$found"
    "$found" --version
    exit 0
fi

if PY=$(find_python); then
    exec "$PY" "$CLI" "$@"
fi

# Last resort: uv can fetch a standalone Python on demand. Useful on macOS and
# Linux, where the bundled Windows runtime/ does not apply. Needs uv installed
# and (on first run) network access, so it comes after every local option.
if command -v uv >/dev/null 2>&1; then
    echo "yoon-notion: 로컬 파이썬을 찾지 못해 uv로 실행합니다 (첫 실행은 다운로드로 느릴 수 있음)" >&2
    exec uv run --no-project --python ">=3.9" "$CLI" "$@"
fi

no_python
