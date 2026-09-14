#!/usr/bin/env bash
#
# 이관 — 원격 nginx 폴더에서 다른 원격 nginx 폴더로 넘긴다. 바뀐 파일만 넘긴다.
# 개발 자리에서 운영 자리로 올릴 때 쓴다.
#
#   promote.sh <원본경로> <대상경로>           무엇이 바뀌는지만 본다
#   promote.sh <원본경로> <대상경로> --apply   넘긴다
#
# 두 경로 모두 같은 서버 안에 있다고 본다. 파일은 서버 안에서만 오가고
# 로컬을 거치지 않는다.
#
set -euo pipefail
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"

usage() {
  die "사용법: promote.sh <원본경로> <대상경로> [--apply]
      예)   promote.sh /u4arnd/u4a/docker_root/U000/U4A/webapps/u4a_sr_dev \\
                       /u4arnd/u4a/docker_root/U000/U4A/webapps/u4a_sr"
}

main() {
  local src="" dst="" apply=0 arg
  for arg in "$@"; do
    case "$arg" in
      --apply) apply=1 ;;
      -*)      die "모르는 옵션입니다: $arg" ;;
      *)       if   [ -z "$src" ]; then src="$arg"
               elif [ -z "$dst" ]; then dst="$arg"
               else die "인자가 너무 많습니다: $arg"
               fi ;;
    esac
  done
  [ -n "$src" ] || usage
  [ -n "$dst" ] || die "이관할 대상 경로를 지정하세요. 어디로 넘길지 짐작하지 않습니다."
  require_abs "$src" "원본 경로"
  require_abs "$dst" "대상 경로"
  [ "$src" != "$dst" ] || die "원본과 대상이 같습니다: $src"

  remote_dir_exists "$src" || die "원본 폴더가 없습니다: $src"
  remote_dir_exists "$dst" || die "대상 폴더가 없습니다: $dst  (자동으로 만들지 않습니다)"

  declare -A SRC_H DST_H
  read_hashes SRC_H < <(remote_run "$(hash_cmd "$src")")
  read_hashes DST_H < <(remote_run "$(hash_cmd "$dst")")

  printf '이관  %s\n  ->  %s\n\n' "$src" "$dst"
  classify_and_report SRC_H DST_H

  if [ ${#SEND[@]} -eq 0 ]; then
    printf '변경 없음.\n'
    return 0
  fi

  if [ "$apply" -eq 0 ]; then
    printf '\n넘기려면 --apply 를 붙이세요. 넘길 파일 %d개.\n' ${#SEND[@]}
    return 0
  fi

  # 목록을 널로 구분해 원격 tar 의 표준입력으로 넘긴다. 파일 자체는 서버 안에서
  # 곧장 옮겨지므로 로컬로 내려왔다 올라가지 않는다.
  printf '%s\0' "${SEND[@]}" \
    | remote_run "$(printf 'cd %q && tar -czf - --null -T - | tar -xzf - --no-same-owner -C %q' "$src" "$dst")" \
    || die "이관에 실패했습니다. 대상 상태를 확인하세요."

  verify_remote "$dst" SRC_H "${SEND[@]}"
}

if [ "${BASH_SOURCE[0]}" = "$0" ]; then
  main "$@"
fi
