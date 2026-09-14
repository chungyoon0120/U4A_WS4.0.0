#!/usr/bin/env bash
# promote.sh 테스트. 실서버를 쓰지 않는다.
#
# DEPLOY_LOCAL_TEST=1 이면 promote.sh 의 remote_run 이 ssh 대신 로컬 bash 를
# 쓰므로, 임시 디렉터리 두 개를 원본/대상 삼아 전 과정을 여기서 돌린다.
set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT="$HERE/../scripts/promote.sh"

PASS=0
FAIL=0
ok()  { PASS=$((PASS+1)); printf '  ok   %s\n' "$1"; }
bad() { FAIL=$((FAIL+1)); printf '  FAIL %s\n' "$1"; printf '       %s\n' "$2"; }

has()     { case "$3" in *"$2"*) ok "$1";; *) bad "$1" "'$2' 가 출력에 있어야 함";; esac; }
has_not() { case "$3" in *"$2"*) bad "$1" "'$2' 가 있으면 안 됨";; *) ok "$1";; esac; }
eq()      { if [ "$2" = "$3" ]; then ok "$1"; else bad "$1" "기대 [$2], 실제 [$3]"; fi; }

setup() {
  TMP="$(mktemp -d)"
  export DEPLOY_LOCAL_TEST=1
  SRC="$TMP/dev"
  DST="$TMP/prod"
}
teardown() { rm -rf "$TMP"; }

fill() {
  local root="$1"; shift
  mkdir -p "$root"
  local pair path
  for pair in "$@"; do
    path="${pair%%=*}"
    mkdir -p "$root/$(dirname "$path")"
    printf '%s' "${pair#*=}" > "$root/$path"
  done
}

run() { bash "$SCRIPT" "$@" 2>&1; }

# ------------------------------------------------------------------ 판정

t_classify() {
  setup
  fill "$SRC" "index.html=new" "css/style.css=same" "view/Add.xml=added"
  fill "$DST" "index.html=old" "css/style.css=same" "backend/config.js=secret"
  local out; out="$(run "$SRC" "$DST")"
  has     "이관이라고 밝힌다"      "이관"                  "$out"
  has     "신규를 표시한다"        "+ ./view/Add.xml"      "$out"
  has     "변경을 표시한다"        "~ ./index.html"        "$out"
  has     "대상 전용을 표시한다"    "= ./backend/config.js" "$out"
  has     "건드리지 않는다고 밝힌다" "건드리지 않음"          "$out"
  has_not "같은 파일은 빠진다"      "css/style.css"         "$out"
  has     "넘길 개수를 보고한다"     "넘길 파일 2개"          "$out"
  teardown
}

t_no_change() {
  setup
  fill "$SRC" "index.html=same"
  fill "$DST" "index.html=same"
  has "변경 없음을 알린다" "변경 없음" "$(run "$SRC" "$DST")"
  teardown
}

t_dry_run_sends_nothing() {
  setup
  fill "$SRC" "index.html=new"
  fill "$DST" "index.html=old"
  run "$SRC" "$DST" > /dev/null
  eq "--apply 없이는 넘기지 않는다" old "$(cat "$DST/index.html")"
  teardown
}

# ------------------------------------------------------------------ 이관

t_apply() {
  setup
  fill "$SRC" "index.html=new" "css/style.css=same" "view/Add.xml=added"
  fill "$DST" "index.html=old" "css/style.css=same" "backend/config.js=secret"
  local out status
  out="$(run "$SRC" "$DST" --apply)"; status=$?
  eq  "정상 종료한다"          0        "$status"
  has "검증 결과를 보고한다"    "검증 OK" "$out"
  eq  "변경 파일이 갱신된다"    new      "$(cat "$DST/index.html")"
  eq  "신규 파일이 넘어간다"    added    "$(cat "$DST/view/Add.xml")"
  eq  "대상 전용 파일이 남는다"  secret   "$(cat "$DST/backend/config.js")"
  eq  "원본은 그대로다"         new      "$(cat "$SRC/index.html")"
  teardown
}

t_apply_korean() {
  setup
  fill "$SRC" "etc/휴가원 템플릿.docx=v2"
  fill "$DST" "etc/휴가원 템플릿.docx=v1"
  run "$SRC" "$DST" --apply > /dev/null
  eq "한글·공백 파일명이 그대로 넘어간다" v2 "$(cat "$DST/etc/휴가원 템플릿.docx")"
  teardown
}

# ------------------------------------------------------------------ 오류

t_no_src() {
  setup
  local out status
  out="$(run)"; status=$?
  eq  "원본 없으면 실패한다" 1 "$status"
  has "사용법을 알린다" "사용법" "$out"
  teardown
}

t_no_dst_arg() {
  setup
  fill "$SRC" "index.html=x"
  local out status
  out="$(run "$SRC")"; status=$?
  eq  "대상 경로 없으면 실패한다" 1 "$status"
  has "짐작하지 않는다고 알린다" "짐작하지 않습니다" "$out"
  teardown
}

t_same_path() {
  setup
  fill "$SRC" "index.html=x"
  local out status
  out="$(run "$SRC" "$SRC" --apply)"; status=$?
  eq  "원본과 대상이 같으면 실패한다" 1 "$status"
  has "같다고 알린다" "원본과 대상이 같습니다" "$out"
  teardown
}

t_relative_path() {
  setup
  local out status
  out="$(run "dev" "prod")"; status=$?
  eq  "상대 경로는 거부한다" 1 "$status"
  has "절대 경로를 요구한다" "절대 경로" "$out"
  teardown
}

t_missing_src_dir() {
  setup
  fill "$DST" "index.html=x"
  local out status
  out="$(run "$SRC" "$DST")"; status=$?
  eq  "원본 폴더 없으면 실패한다" 1 "$status"
  has "원본 폴더가 없다고 알린다" "원본 폴더가 없습니다" "$out"
  teardown
}

t_missing_dst_dir() {
  setup
  fill "$SRC" "index.html=x"
  local out status
  out="$(run "$SRC" "$DST")"; status=$?
  eq  "대상 폴더 없으면 실패한다" 1 "$status"
  has "대상 폴더가 없다고 알린다" "대상 폴더가 없습니다" "$out"
  if [ -d "$DST" ]; then
    bad "대상 폴더를 만들지 않는다" "폴더가 생겼음"
  else
    ok "대상 폴더를 만들지 않는다"
  fi
  teardown
}

t_classify
t_no_change
t_dry_run_sends_nothing
t_apply
t_apply_korean
t_no_src
t_no_dst_arg
t_same_path
t_relative_path
t_missing_src_dir
t_missing_dst_dir

printf '\n통과 %d, 실패 %d\n' "$PASS" "$FAIL"
[ "$FAIL" -eq 0 ]
