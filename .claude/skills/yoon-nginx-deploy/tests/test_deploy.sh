#!/usr/bin/env bash
# deploy.sh 테스트. 실서버를 쓰지 않는다.
#
# DEPLOY_LOCAL_TEST=1 이면 deploy.sh 의 remote_run 이 ssh 대신 로컬 bash 를
# 쓰므로, 임시 디렉터리 두 개를 로컬/원격 삼아 전 과정을 여기서 돌린다.
set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT="$HERE/../scripts/deploy.sh"

PASS=0
FAIL=0
ok()  { PASS=$((PASS+1)); printf '  ok   %s\n' "$1"; }
bad() { FAIL=$((FAIL+1)); printf '  FAIL %s\n' "$1"; printf '       %s\n' "$2"; }

has()     { case "$3" in *"$2"*) ok "$1";; *) bad "$1" "'$2' 가 출력에 있어야 함";; esac; }
has_not() { case "$3" in *"$2"*) bad "$1" "'$2' 가 있으면 안 됨";; *) ok "$1";; esac; }
eq()      { if [ "$2" = "$3" ]; then ok "$1"; else bad "$1" "기대 [$2], 실제 [$3]"; fi; }

setup() {
  TMP="$(mktemp -d)"
  export DEPLOY_LOCAL_BASE="$TMP/local"
  export DEPLOY_TEST_BASE="$TMP/testbase"
  export DEPLOY_LOCAL_TEST=1
  REMOTE="$TMP/remote/site"
  mkdir -p "$DEPLOY_LOCAL_BASE" "$DEPLOY_TEST_BASE"
}
teardown() { rm -rf "$TMP"; }

# "경로=내용" 쌍으로 파일을 만든다.
fill() {
  local root="$1"; shift
  local pair path
  for pair in "$@"; do
    path="${pair%%=*}"
    mkdir -p "$root/$(dirname "$path")"
    printf '%s' "${pair#*=}" > "$root/$path"
  done
}
local_dist() { mkdir -p "$DEPLOY_LOCAL_BASE/$1/dist"; fill "$DEPLOY_LOCAL_BASE/$1/dist" "${@:2}"; }
remote_dir() { mkdir -p "$REMOTE";                    fill "$REMOTE" "$@"; }

run() { bash "$SCRIPT" "$@" 2>&1; }

# ------------------------------------------------------------------ 판정

t_classify() {
  setup
  local_dist app "index.html=new" "css/style.css=same" "view/Add.xml=added"
  remote_dir     "index.html=old" "css/style.css=same" "backend/config.js=secret"
  local out; out="$(run app "$REMOTE")"
  has     "신규를 표시한다"        "+ ./view/Add.xml"      "$out"
  has     "변경을 표시한다"        "~ ./index.html"        "$out"
  has     "대상 전용을 표시한다"    "= ./backend/config.js" "$out"
  has     "건드리지 않는다고 밝힌다" "건드리지 않음"          "$out"
  has_not "같은 파일은 빠진다"      "css/style.css"         "$out"
  has     "올릴 개수를 보고한다"     "올릴 파일 2개"        "$out"
  teardown
}

t_no_change() {
  setup
  local_dist app "index.html=same"
  remote_dir     "index.html=same"
  has "변경 없음을 알린다" "변경 없음" "$(run app "$REMOTE")"
  teardown
}

t_korean_name() {
  setup
  local_dist app "etc/휴가원 템플릿.docx=v2"
  remote_dir     "etc/휴가원 템플릿.docx=v1"
  has "한글·공백 파일명을 그대로 다룬다" "~ ./etc/휴가원 템플릿.docx" "$(run app "$REMOTE")"
  teardown
}

# ------------------------------------------------------------------ 전송

t_apply() {
  setup
  local_dist app "index.html=new" "css/style.css=same" "view/Add.xml=added"
  remote_dir     "index.html=old" "css/style.css=same" "backend/config.js=secret"
  local out status
  out="$(run app "$REMOTE" --apply)"; status=$?
  eq  "정상 종료한다"         0        "$status"
  has "검증 결과를 보고한다"   "검증 OK" "$out"
  eq  "변경 파일이 갱신된다"   new      "$(cat "$REMOTE/index.html")"
  eq  "신규 파일이 올라간다"   added    "$(cat "$REMOTE/view/Add.xml")"
  eq  "대상 전용 파일이 남는다" secret   "$(cat "$REMOTE/backend/config.js")"
  teardown
}

t_apply_korean() {
  setup
  local_dist app "etc/휴가원 템플릿.docx=v2"
  remote_dir     "etc/휴가원 템플릿.docx=v1"
  run app "$REMOTE" --apply > /dev/null
  eq "한글·공백 파일명이 그대로 전송된다" v2 "$(cat "$REMOTE/etc/휴가원 템플릿.docx")"
  teardown
}

t_dry_run_sends_nothing() {
  setup
  local_dist app "index.html=new"
  remote_dir     "index.html=old"
  run app "$REMOTE" > /dev/null
  eq "--apply 없이는 전송하지 않는다" old "$(cat "$REMOTE/index.html")"
  teardown
}

# ------------------------------------------------------------------ 오류

t_no_name() {
  setup
  local out status
  out="$(run)"; status=$?
  eq  "폴더명 없으면 실패한다" 1 "$status"
  has "사용법을 알린다" "사용법" "$out"
  teardown
}

t_no_remote_arg() {
  setup
  local_dist app "index.html=x"
  local out status
  out="$(run app)"; status=$?
  eq  "원격 경로 없으면 실패한다" 1 "$status"
  has "짐작하지 않는다고 알린다" "짐작하지 않습니다" "$out"
  teardown
}

t_relative_remote() {
  setup
  local_dist app "index.html=x"
  local out status
  out="$(run app "some/where")"; status=$?
  eq  "상대 경로는 거부한다" 1 "$status"
  has "절대 경로를 요구한다" "절대 경로" "$out"
  teardown
}

t_no_dist() {
  setup
  remote_dir "index.html=x"
  local out status
  out="$(run app "$REMOTE")"; status=$?
  eq  "dist 없으면 실패한다" 1 "$status"
  has "dist 가 없다고 알린다" "dist 가 없습니다" "$out"
  has "dist 폴더를 만들라고 안내한다" "dist 폴더를 먼저 만들어 주세요" "$out"
  teardown
}

t_no_remote_dir() {
  setup
  local_dist app "index.html=x"
  local out status
  out="$(run app "$REMOTE")"; status=$?
  eq  "원격 폴더 없으면 실패한다" 1 "$status"
  has "원격 폴더가 없다고 알린다" "원격 폴더가 없습니다" "$out"
  if [ -d "$REMOTE" ]; then
    bad "원격 폴더를 만들지 않는다" "폴더가 생겼음"
  else
    ok "원격 폴더를 만들지 않는다"
  fi
  teardown
}

# ------------------------------------------------------------------ 테스트 배포

t_test_new_folder() {
  setup
  local_dist app "index.html=x" "css/a.css=y"
  local out; out="$(run app --test)"
  has "테스트 자리를 대상으로 삼는다" "$DEPLOY_TEST_BASE/app" "$out"
  has "새로 만든다고 알린다"        "새로 만든다"            "$out"
  has "전부 신규로 잡는다"          "신규 2"                "$out"
  if [ -d "$DEPLOY_TEST_BASE/app" ]; then
    bad "판정만 할 때는 폴더를 만들지 않는다" "폴더가 생겼음"
  else
    ok "판정만 할 때는 폴더를 만들지 않는다"
  fi
  teardown
}

t_test_apply_creates() {
  setup
  local_dist app "index.html=x"
  local out status
  out="$(run app --test --apply)"; status=$?
  eq  "정상 종료한다"        0          "$status"
  has "만들었다고 알린다"     "만들었습니다" "$out"
  has "검증을 통과한다"       "검증 OK"    "$out"
  eq  "파일이 올라간다"       x          "$(cat "$DEPLOY_TEST_BASE/app/index.html" 2>&1)"
  teardown
}

t_test_duplicate_stops() {
  setup
  local_dist app "index.html=new"
  mkdir -p "$DEPLOY_TEST_BASE/app"; printf 'someone-else' > "$DEPLOY_TEST_BASE/app/index.html"
  local out status
  out="$(run app --test --apply)"; status=$?
  eq  "중복이면 실패한다"        1             "$status"
  has "이미 있다고 알린다"       "이미 있습니다" "$out"
  has "물어보라고 시킨다"        "물어보세요"   "$out"
  has "두 갈래를 안내한다 (reuse)"   "--reuse"   "$out"
  has "두 갈래를 안내한다 (replace)" "--replace" "$out"
  eq  "중복일 때 덮지 않는다"    someone-else  "$(cat "$DEPLOY_TEST_BASE/app/index.html")"
  teardown
}

t_test_replace_wipes() {
  setup
  local_dist app "index.html=new"
  mkdir -p "$DEPLOY_TEST_BASE/app/old"
  printf 'old'   > "$DEPLOY_TEST_BASE/app/index.html"
  printf 'stale' > "$DEPLOY_TEST_BASE/app/old/leftover.js"
  local out status
  out="$(run app --test --replace --apply)"; status=$?
  eq  "--replace 는 진행한다"      0     "$status"
  has "비운다고 알린다"            "비우고" "$out"
  eq  "새 내용이 들어간다"          new   "$(cat "$DEPLOY_TEST_BASE/app/index.html")"
  if [ -e "$DEPLOY_TEST_BASE/app/old/leftover.js" ]; then
    bad "남아 있던 파일이 지워진다" "아직 있음"
  else
    ok "남아 있던 파일이 지워진다"
  fi
  teardown
}

t_test_replace_labels_deletions() {
  setup
  local_dist app "index.html=same"
  mkdir -p "$DEPLOY_TEST_BASE/app"
  printf 'same'  > "$DEPLOY_TEST_BASE/app/index.html"
  printf 'stale' > "$DEPLOY_TEST_BASE/app/leftover.js"
  local out; out="$(run app --test --replace)"
  has "지워진다고 표시한다"       "(지워진다)"      "$out"
  has "지울 파일을 짚어 준다"     "= ./leftover.js" "$out"
  has "전체를 다시 올린다고 한다" "올릴 파일 1개"    "$out"
  teardown
}

t_replace_needs_test() {
  setup
  local_dist app "index.html=x"
  remote_dir     "index.html=x"
  local out status
  out="$(run app "$REMOTE" --replace)"; status=$?
  eq  "--replace 만 쓰면 실패한다" 1 "$status"
  has "실서비스는 비우지 않는다고 한다" "실서비스 폴더를 통째로 비우는 일은" "$out"
  teardown
}

t_reuse_and_replace_conflict() {
  setup
  local_dist app "index.html=x"
  local out status
  out="$(run app --test --reuse --replace)"; status=$?
  eq  "둘 다 주면 실패한다" 1 "$status"
  has "하나만 고르라고 한다" "하나만 고르세요" "$out"
  teardown
}

t_rejects_path_in_name() {
  setup
  local out status
  out="$(run ../etc --test)"; status=$?
  eq  "폴더명에 경로를 넣으면 실패한다" 1 "$status"
  has "경로를 넣지 말라고 한다" "경로를 넣지 마세요" "$out"
  teardown
}

t_test_reuse_proceeds() {
  setup
  local_dist app "index.html=new"
  mkdir -p "$DEPLOY_TEST_BASE/app"; printf 'old' > "$DEPLOY_TEST_BASE/app/index.html"
  local out status
  out="$(run app --test --reuse --apply)"; status=$?
  eq  "--reuse 면 진행한다" 0     "$status"
  eq  "덮어쓴다"           new   "$(cat "$DEPLOY_TEST_BASE/app/index.html")"
  teardown
}

t_test_rejects_path() {
  setup
  local_dist app "index.html=x"
  local out status
  out="$(run app "$REMOTE" --test)"; status=$?
  eq  "--test 에 경로를 주면 실패한다" 1 "$status"
  has "폴더명만 달라고 한다" "폴더명만" "$out"
  teardown
}

t_reuse_needs_test() {
  setup
  local_dist app "index.html=x"
  remote_dir     "index.html=x"
  local out status
  out="$(run app "$REMOTE" --reuse)"; status=$?
  eq  "--reuse 만 쓰면 실패한다" 1 "$status"
  has "--test 와 함께 쓰라고 한다" "--test 와 함께만" "$out"
  teardown
}

t_classify
t_no_change
t_korean_name
t_apply
t_apply_korean
t_dry_run_sends_nothing
t_test_new_folder
t_test_apply_creates
t_test_duplicate_stops
t_test_reuse_proceeds
t_test_replace_wipes
t_test_replace_labels_deletions
t_replace_needs_test
t_reuse_and_replace_conflict
t_rejects_path_in_name
t_test_rejects_path
t_reuse_needs_test
t_no_name
t_no_remote_arg
t_relative_remote
t_no_dist
t_no_remote_dir

printf '\n통과 %d, 실패 %d\n' "$PASS" "$FAIL"
[ "$FAIL" -eq 0 ]
