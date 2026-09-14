#!/usr/bin/env bash
#
# 배포 — 로컬 프로젝트의 dist/ 를 원격 nginx 폴더에 올린다. 바뀐 파일만 올린다.
#
#   deploy.sh <폴더명> <원격경로>           무엇이 바뀌는지만 본다
#   deploy.sh <폴더명> <원격경로> --apply   올린다
#
#   deploy.sh <폴더명> --test               테스트 자리에 올린다 (경로를 받지 않는다)
#   deploy.sh <폴더명> --test --apply
#
# 원격 경로는 반드시 받는다. 어디에 올릴지 짐작하지 않는다.
# --test 만 예외다. 정해진 테스트 자리 아래 <폴더명> 으로 간다.
#
set -euo pipefail
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"

LOCAL_BASE="${DEPLOY_LOCAL_BASE:-/d/workspace}"

usage() {
  die "사용법: deploy.sh <폴더명> <원격경로> [--apply]
            deploy.sh <폴더명> --test [--reuse | --replace] [--apply]
      예)   deploy.sh infocg_timeoff /u4arnd/u4a/docker_root/U000/U4A/webapps/infocg_timeoff
            deploy.sh infocg_timeoff --test"
}

main() {
  local name="" remote="" apply=0 test_mode=0 reuse=0 replace=0 arg
  for arg in "$@"; do
    case "$arg" in
      --apply)   apply=1 ;;
      --test)    test_mode=1 ;;
      --reuse)   reuse=1 ;;
      --replace) replace=1 ;;
      -*)        die "모르는 옵션입니다: $arg" ;;
      *)         if   [ -z "$name" ];   then name="$arg"
                 elif [ -z "$remote" ]; then remote="$arg"
                 else die "인자가 너무 많습니다: $arg"
                 fi ;;
    esac
  done
  [ -n "$name" ] || usage

  case "$name" in
    */*|.|..) die "폴더명에 경로를 넣지 마세요: $name" ;;
  esac
  [ "$reuse" -eq 0 ] || [ "$replace" -eq 0 ] \
    || die "--reuse 와 --replace 는 같이 쓸 수 없습니다. 하나만 고르세요."

  if [ "$test_mode" -eq 1 ]; then
    [ -z "$remote" ] || die "--test 는 원격 경로를 함께 받지 않습니다. 폴더명만 주세요.
      테스트 자리는 정해져 있습니다: $TEST_BASE"
    remote="$TEST_BASE/$name"
  else
    [ -n "$remote" ] || die "배포할 원격 경로를 지정하세요. 어디에 올릴지 짐작하지 않습니다."
    [ "$reuse" -eq 0 ]   || die "--reuse 는 --test 와 함께만 씁니다."
    [ "$replace" -eq 0 ] || die "--replace 는 --test 와 함께만 씁니다.
      실서비스 폴더를 통째로 비우는 일은 이 스크립트가 하지 않습니다."
  fi
  require_abs "$remote" "원격 경로"

  local dist="$LOCAL_BASE/$name/dist"
  [ -d "$dist" ] || die "$dist 가 없습니다.
      배포할 내용을 담을 dist 폴더를 먼저 만들어 주세요. 올릴 것은 이 폴더 안이 전부입니다."

  # 테스트 자리는 없으면 만든다. 그 밖의 자리는 절대 만들지 않는다.
  # 다만 테스트 자리라도 같은 이름이 이미 있으면 멈춘다. 남의 것이거나 예전
  # 테스트일 수 있으므로 사용자에게 확인받아야 한다.
  local make_remote=0
  if remote_dir_exists "$remote"; then
    if [ "$test_mode" -eq 1 ] && [ "$reuse" -eq 0 ] && [ "$replace" -eq 0 ]; then
      die "테스트 자리에 같은 이름이 이미 있습니다: $remote
      남의 것이거나 예전 테스트일 수 있습니다. 사용자에게 어느 쪽인지 반드시 물어보세요.
        --reuse    바뀐 파일만 고친다. 원격에만 있는 파일은 그대로 둔다
        --replace  원격을 통째로 지우고 dist 를 새로 넣는다"
    fi
  elif [ "$test_mode" -eq 1 ]; then
    make_remote=1
    replace=0  # 없는 폴더는 지울 것도 없다
  else
    die "원격 폴더가 없습니다: $remote  (자동으로 만들지 않습니다)"
  fi

  declare -A SRC_H DST_H
  read_hashes SRC_H < <(bash -c "$(hash_cmd "$dist")")
  read_hashes DST_H < <(remote_run "$(hash_cmd "$remote")")

  printf '배포  %s\n  ->  %s\n' "$dist" "$remote"
  [ "$make_remote" -eq 1 ] && printf '      (테스트 자리에 새로 만든다)\n'
  [ "$replace" -eq 1 ]     && printf '      (원격을 지우고 새로 넣는다)\n'
  printf '\n'

  # --replace 는 대상 전용 파일까지 지운다. 표시를 바꿔 그 사실을 드러낸다.
  [ "$replace" -eq 1 ] && ONLY_LABEL="(지워진다)"
  classify_and_report SRC_H DST_H

  if [ $((N_ADDED + N_CHANGED + N_ONLY)) -eq 0 ]; then
    printf '변경 없음.\n'
    return 0
  fi

  # 통째로 지우고 넣으므로 바뀐 것만이 아니라 dist 전부를 올린다.
  if [ "$replace" -eq 1 ]; then
    SEND=()
    local f
    for f in "${!SRC_H[@]}"; do SEND+=("$f"); done
  fi

  if [ ${#SEND[@]} -eq 0 ]; then
    printf '올릴 파일이 없습니다.\n'
    return 0
  fi

  if [ "$apply" -eq 0 ]; then
    printf '\n올리려면 --apply 를 붙이세요. 올릴 파일 %d개.\n' ${#SEND[@]}
    return 0
  fi

  if [ "$replace" -eq 1 ]; then
    require_under_test_base "$remote"
    remote_run "rm -rf $(printf '%q' "$remote") && mkdir -p $(printf '%q' "$remote")" \
      || die "원격 폴더를 비우지 못했습니다: $remote"
    printf '원격 폴더를 비우고 새로 만들었습니다: %s\n' "$remote"
  elif [ "$make_remote" -eq 1 ]; then
    remote_run "mkdir -p $(printf '%q' "$remote")" \
      || die "테스트 폴더를 만들지 못했습니다: $remote"
    printf '테스트 폴더를 만들었습니다: %s\n' "$remote"
  fi

  # 파일명에 한글과 공백이 있으므로 목록을 널로 구분해 넘긴다.
  # --no-same-owner 라야 이미 있는 파일의 소유자와 권한이 그대로 남는다.
  local list
  list="$(mktemp)"
  printf '%s\0' "${SEND[@]}" > "$list"
  tar -czf - -C "$dist" --null -T "$list" \
    | remote_run "$(printf 'tar -xzf - --no-same-owner -C %q' "$remote")" \
    || { rm -f "$list"; die "전송에 실패했습니다. 원격 상태를 확인하세요."; }
  rm -f "$list"

  verify_remote "$remote" SRC_H "${SEND[@]}"
}

if [ "${BASH_SOURCE[0]}" = "$0" ]; then
  main "$@"
fi
