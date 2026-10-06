#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# gitcp.sh — 커밋 + 푸시(+ 필요하면 main 머지)를 "한 번에" 끝내는 도구
#   만든 이유(2026-10-06 장군님 지시): 커밋·푸시 한 번에 여러 번 왔다 갔다 하느라 느렸다.
#
# 쓰는 법 (커밋 메시지는 표준입력으로 — 제목 첫 줄, 빈 줄, 본문)
#   bash .claude/scripts/gitcp.sh            <<'EOF'   ... EOF   → 현재 브랜치 커밋+푸시
#   bash .claude/scripts/gitcp.sh --to-main  <<'EOF'   ... EOF   → 위 + main 머지 + main 푸시
#   bash .claude/scripts/gitcp.sh --dry      <<'EOF'   ... EOF   → 아무것도 안 하고 계획만 출력
#
# 규칙(.claude/rules/commit.md)은 이 도구가 자동으로 지킨다:
#   - 제목 맨 앞 [YYYY-MM-DD HH:MM]  (이미 있으면 안 붙인다)
#   - 끝에 Co-Authored-By 한 줄      (이미 있으면 안 붙인다)
#   - 기본 브랜치(main)에서 커밋하려 하면 멈춘다 → 먼저 브랜치를 만들라고 알린다
# ---------------------------------------------------------------------------
set -u

ATTR="Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
MAIN="main"
TO_MAIN=0
DRY=0

for a in "$@"; do
  case "$a" in
    --to-main) TO_MAIN=1 ;;
    --dry)     DRY=1 ;;
    *) echo "unknown option: $a" >&2; exit 1 ;;
  esac
done

cd "$(git rev-parse --show-toplevel)" || { echo "not a git repo" >&2; exit 1; }

BR="$(git rev-parse --abbrev-ref HEAD)"
if [ "$BR" = "$MAIN" ]; then
  echo "STOP: 지금 ${MAIN} 브랜치다. 먼저 작업 브랜치를 만들어야 한다(규칙)." >&2
  exit 2
fi

CHANGED="$(git status --porcelain | wc -l | tr -d ' ')"

# 바뀐 파일이 없고 --to-main 이면 "머지만" 한다(커밋 메시지도 안 받는다).
MERGE_ONLY=0
if [ "$CHANGED" = "0" ] && [ "$TO_MAIN" = "1" ]; then
  MERGE_ONLY=1
  MSG=""
else
  MSG="$(cat)"
  [ -z "${MSG// /}" ] && { echo "STOP: 커밋 메시지가 비었다." >&2; exit 1; }
fi

if [ "$MERGE_ONLY" = "1" ]; then
  echo "== 바뀐 파일 없음 → ${MAIN} 머지만 한다 =="
fi

# 제목에 날짜시간 접두가 없으면 붙인다
[ "$MERGE_ONLY" = "1" ] || case "$MSG" in
  \[20*) : ;;
  *) MSG="[$(date '+%Y-%m-%d %H:%M')] ${MSG}" ;;
esac
# 끝에 Co-Authored-By 가 없으면 붙인다
[ "$MERGE_ONLY" = "1" ] || case "$MSG" in
  *"Co-Authored-By:"*) : ;;
  *) MSG="${MSG}"$'\n\n'"${ATTR}" ;;
esac

if [ "$CHANGED" = "0" ] && [ "$MERGE_ONLY" = "0" ]; then
  echo "STOP: 바뀐 파일이 없다(커밋할 것 없음). ${MAIN} 머지만 하려면 --to-main 을 붙인다." >&2
  exit 3
fi

if [ "$MERGE_ONLY" = "0" ]; then
  echo "== 올릴 파일 (${CHANGED}건) =="
  git status --short
fi

if [ "$DRY" = "1" ]; then
  echo
  echo "== 커밋 메시지(미리보기) =="
  echo "${MSG:-(머지 전용 — 커밋 없음)}"
  echo
  echo "(--dry 라 아무것도 하지 않았다)"
  exit 0
fi

if [ "$MERGE_ONLY" = "0" ]; then
  git add -A || exit 1
  git commit -q -F - <<< "$MSG" || exit 1
  git push -q origin "$BR" || exit 1
fi

if [ "$TO_MAIN" = "1" ]; then
  git checkout -q "$MAIN" || exit 1
  git merge --no-edit -q "$BR" \
    -m "[$(date '+%Y-%m-%d %H:%M')] Merge branch '${BR}' into ${MAIN}"$'\n\n'"${ATTR}" || {
      echo "STOP: 머지 충돌. 작업트리를 그대로 두고 멈춘다 — 충돌을 풀어야 한다." >&2
      git status --short | head -20 >&2
      exit 4
    }
  git push -q origin "$MAIN" || exit 1
  git checkout -q "$BR" || exit 1
fi

echo
echo "== 결과 =="
printf '%s = %s (원격 %s)\n' "$BR" "$(git rev-parse --short "$BR")" "$(git ls-remote origin "refs/heads/$BR" | cut -c1-8)"
if [ "$TO_MAIN" = "1" ]; then
  printf '%s = %s (원격 %s)\n' "$MAIN" "$(git rev-parse --short "$MAIN")" "$(git ls-remote origin "refs/heads/$MAIN" | cut -c1-8)"
fi
printf '작업트리 = %s건\n' "$(git status --porcelain | wc -l | tr -d ' ')"
