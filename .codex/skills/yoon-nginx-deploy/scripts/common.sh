# deploy.sh 와 promote.sh 가 함께 쓰는 부분.
#
# 둘 다 하는 일의 뼈대는 같다. 양쪽 파일의 sha256 을 재서 견주고, 다른 것만
# tar 로 넘긴 뒤, 넘긴 것이 실제로 들어갔는지 다시 잰다. 다른 건 원본이
# 로컬이냐(배포) 원격이냐(이관) 뿐이다.

SSH_HOST="${DEPLOY_SSH_HOST:-u4a_new_ubuntu-u4a_rnd}"

# --test 가 쓰는 자리. 지우기를 허용하는 유일한 구역이라 여기서 정의한다.
TEST_BASE="${DEPLOY_TEST_BASE:-/u4arnd/u4a/docker_root/U000/U4A/webapps/_tmp/soccerhs}"

die() { printf '오류  %s\n' "$*" >&2; exit 1; }

# 원격 접근은 여기 하나로만 나간다. 테스트는 이 함수를 로컬 실행으로 바꾼다.
remote_run() {
  if [ -n "${DEPLOY_LOCAL_TEST:-}" ]; then
    bash -c "$1"
  else
    ssh -o BatchMode=yes -o ConnectTimeout=10 "$SSH_HOST" "$1"
  fi
}

# 디렉터리 안 모든 파일의 sha256 을 뽑는 셸 명령.
hash_cmd() {
  printf 'cd %q && find . -type f -exec sha256sum {} + 2>/dev/null || true' "$1"
}

# sha256sum 출력을 "경로 -> 해시" 로 담는다.
#
# 형식은 <64자 해시><공백><표시><경로>. 표시는 msys 가 *, 리눅스가 공백이라
# 서로 다르지만 경로는 어느 쪽이든 66번째부터 시작한다.
read_hashes() {
  local -n __map="$1"
  local line
  while IFS= read -r line; do
    [ ${#line} -gt 66 ] || continue
    __map["${line:66}"]="${line:0:64}"
  done
}

# 목록을 정렬해 한 줄씩. 빈 목록이면 아무것도 내보내지 않는다.
sorted() {
  [ $# -eq 0 ] && return 0
  printf '%s\n' "$@" | LC_ALL=C sort
}

require_abs() {
  case "$1" in
    /*) ;;
    *)  die "$2 는 절대 경로여야 합니다: $1" ;;
  esac
}

remote_dir_exists() {
  remote_run "test -d $(printf '%q' "$1")"
}

# 원본과 대상을 견줘 보고하고, 넘길 목록을 전역 SEND 에 담는다.
# 갈래별 개수는 N_ADDED / N_CHANGED / N_ONLY 에 남는다.
# 대상 전용 파일을 어떻게 다루는지는 부르는 쪽이 ONLY_LABEL 로 알린다.
#   $1 원본 해시 배열명   $2 대상 해시 배열명
SEND=()
N_ADDED=0
N_CHANGED=0
N_ONLY=0
ONLY_LABEL="(건드리지 않음)"
classify_and_report() {
  local -n __src="$1"
  local -n __dst="$2"
  local -a added=() changed=() only=()
  local f

  for f in "${!__src[@]}"; do
    if [ -z "${__dst[$f]+set}" ]; then
      added+=("$f")
    elif [ "${__dst[$f]}" != "${__src[$f]}" ]; then
      changed+=("$f")
    fi
  done
  for f in "${!__dst[@]}"; do
    [ -n "${__src[$f]+set}" ] || only+=("$f")
  done

  [ ${#added[@]} -gt 0 ] && {
    printf '신규 %d\n' ${#added[@]}
    sorted "${added[@]}" | sed 's/^/  + /'
  }
  [ ${#changed[@]} -gt 0 ] && {
    printf '변경 %d\n' ${#changed[@]}
    sorted "${changed[@]}" | sed 's/^/  ~ /'
  }
  [ ${#only[@]} -gt 0 ] && {
    printf '대상에만 있음 %d  %s\n' ${#only[@]} "$ONLY_LABEL"
    sorted "${only[@]}" | sed 's/^/  = /'
  }

  N_ADDED=${#added[@]}
  N_CHANGED=${#changed[@]}
  N_ONLY=${#only[@]}

  SEND=()
  [ ${#added[@]}   -gt 0 ] && SEND+=("${added[@]}")
  [ ${#changed[@]} -gt 0 ] && SEND+=("${changed[@]}")
  return 0
}

# 지우기는 테스트 자리 아래에서만 한다. 실서비스 폴더를 비우는 사고를 막는다.
require_under_test_base() {
  case "$1" in
    "$TEST_BASE"/?*) ;;
    *) die "지우기는 테스트 자리 아래에서만 합니다.
      대상: $1
      허용: $TEST_BASE/<폴더명>" ;;
  esac
}

# 넘긴 것이 대상에 실제로 들어갔는지 다시 잰다.
#   $1 대상 경로   $2 원본 해시 배열명   나머지 넘긴 파일들
verify_remote() {
  local dst="$1" src_name="$2"; shift 2
  local -n __expected="$src_name"
  declare -A __after
  read_hashes __after < <(remote_run "$(hash_cmd "$dst")")

  local -a wrong=()
  local f
  for f in "$@"; do
    [ "${__after[$f]:-}" = "${__expected[$f]}" ] || wrong+=("$f")
  done

  if [ ${#wrong[@]} -eq 0 ]; then
    printf '\n완료 %d개. 검증 OK.\n' $#
    return 0
  fi

  printf '\n넘겼으나 %d개가 대상과 다릅니다\n' ${#wrong[@]}
  sorted "${wrong[@]}" | sed 's/^/  ! /'
  return 1
}
