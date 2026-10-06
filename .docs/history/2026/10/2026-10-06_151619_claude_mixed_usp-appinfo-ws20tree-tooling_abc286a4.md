# USP 전역 AppInfo 동기화 · WS20 디자인 트리 액션 버튼 고정 · 반복작업 도구화 · 백업파일 폐지

> 2026-10-06 · 브랜치 `bootstrap` → `main` 머지·푸시 완료
> 커밋 5건 = `a8ff2c59` · `0a66ed88` · `a49f7f3d` · `1af8936a` · `d7de4ee6`
> 최종 = `bootstrap` `d7de4ee6` / `main` `00de6a4d` / 둘 다 원격 일치 / 작업트리 0건

## 요청

이번 대화에서 받은 지시를 순서대로(원문 인용):

1. "현재 getAppInfo() <-- 이 전역 함수의 사용처좀 조사해줘 내가 볼땐 ws20진입할때만 앱 정보를 넣는거 같아"
2. "USP 진입할때도 해당 앱 정보를 넣어서 getAppInfo() <-- 이 함수 호출 시 USP 앱 정보가 나오게 해줘"
3. "getAppInfo() <-- 이 함수 안에 이런 로직이 있어야 할거 같다. … ws20에서는 앱 상태가 변경되도 같이 변경되는데, usp에서는 앱이 활성화 되던 비활성화 되던 getAppInfo() 여기에 나오는 값은 usp 화면 진입할때 한번만 넣고 그다음에는 관여를 안하는거 같아. 실제 usp에서 관리하는 객체는 oAPP.common.fnGetModelProperty("/WS30/APP") 여기에서 나오는 값이 진짜인데.. 이거랑 동기화 되게 해줘"
4. "ws20의 디자인 트리 영역 보면 트리 깊이가 길면 우측 추가, 삭제 버튼이 같이 이동되는 현상이 있는데, 여기는 트리 깊이에 상관없이 무조건 고정이여야 하는 영역이야 한번 분석해바 **고치라는 말은 아니고 먼저 분석부터** 해바" → 분석 보고 뒤 "테스트 하고 확인은 내가 할테니까 우선 고쳐바"
5. "야 커밋하는 도구를 만들던지 해 … 매번 커밋하고 푸시할때마다 1분이라는 시간이 들어갈 내용이냐?" / "매번 반복하는 내용은 뭔가 도구화를 생각해야 되지 않겠냐? 병신같이 매번 새로 짜는게 맞냐?"
6. "그리고 소스 고치거나 추가할때 임의로 백업 파일 만들지마 시발 깃은 뻘로 있냐? … 백업파일 만들때마다 파일도 지저분하고 그거 또 깃에 안올리겠다고 gitignore에 일일히 하나씩 예외 처리하고 안 지저분하냐?" / "작업전에 백업 만들일이 있으면 깃을 잘 활용해라 잘못됐을때 복원만 할 수 있으면 되는거잖아." → "다 지우고 커밋해라"
7. 커밋·푸시·main 머지 지시 여러 차례
8. 마지막 = "이력 남겨"

## 변경 내용

### 1) getAppInfo() 사용처 조사 (지시 1)

전역 `getAppInfo()` 는 `www/ws30/resources/index.js` 의 `oWS.utill.fn.getAppInfo` 하나뿐이고,
값을 보관하는 곳도 `oWS.utill.attr.oAppInfo` 한 곳이다. 쓰는 쪽을 전수 조사해
`.works/getAppInfo/01_사용처_조사.md` 에 정리했다.

**조사 결론 = 장군님 짐작이 맞았다.** 값을 넣는 곳(`setAppInfo`)은 WS20 진입 경로뿐이었다.
USP(WS30) 진입은 `fnOnEnterDispChangeMode` 의 `APPTY === "U"` 갈래에서 모델에만 넣고
전역에는 손대지 않은 채 끝났다 — 원본 UI5 도 같은 구조다.

### 2) USP 진입에서도 전역 AppInfo 를 채움 (지시 2)

`ws_html5_shell.js` 의 USP 갈래에 `parent.setAppInfo(oAppInfo)` 를 넣었다.
`setAppInfo` 가 없거나 터지는 경우를 대비해 try/catch + 오류코드(`SHEL-002`)로 표면화.
파일 머리 접두/다음 번호를 `SHEL / 003` 으로 올렸다.

### 3) getAppInfo() 가 모델과 동기화되게 함 (지시 3)

진입 때 한 번 넣는 것만으로는 USP 안에서 Activate / 모드전환 / 저장이 일어나면 전역이 묵는다.
그래서 **읽을 때 따라가게** 했다 — `getAppInfo()` 안에서 지금 화면이 WS30 이면
`oAPP.common.fnGetModelProperty("/WS30/APP")` 을 읽어 그 객체를 전역에 그대로 대입하고 반환한다.
읽기가 실패하면 오류코드(`RSRC-009`)로 표면화하고 보관값을 반환(fail-safe).
접두/다음 번호를 `RSRC / 010` 으로 올렸다.

화면 판별은 기존 `oWS.utill.attr.currPage` 를 그대로 썼다(`setCurrPage` 가 `fnNavTo` 에서 채움).

### 4) WS20 디자인 트리 — 추가·삭제 버튼을 트리 깊이와 무관하게 고정 (지시 4)

**먼저 분석만** 하고(`.works/ws20디자인트리/01_액션버튼_깊이따라_밀림_분석.md`),
그 뒤 "우선 고쳐바" 지시를 받고 고쳤다.

- **원인**: HTML5 트리는 들여쓰기를 **row 자체의 왼쪽 여백**으로 준다. depth 가 깊어질수록
  row 가 쓸 수 있는 폭을 들여쓰기가 먹어, 오른쪽 액션 버튼이 밀린다.
  2026-07-10 에 넣은 `position: sticky` 는 **남는 폭이 있을 때만** 버틴다.
  원본(as-is) UI5 는 `sap.ui.table.TreeTable` 의 **고정폭 60px 액션 column** 이라 구조적으로 안 밀린다.
- **고친 방식**: row 를 「이름 cell + 액션 cell」로 갈라, 들여쓰기를 **이름 cell 안의 toggle 왼쪽 여백**으로 옮겼다.
  이제 depth 가 몇이든 액션 cell 의 폭을 건드릴 수 없다 — 원본의 고정 column 과 같은 결과.
- 손댄 곳은 **2곳**(트리 row 구성 함수 1개 + 그 화면 전용 CSS). **공통 자산은 안 건드렸다.**
- row 를 감싸는 데 실패하면 `U4ALOG.warn("GUARD_EXIT", …)` 로 남기되, **같은 경고는 한 번만**(row 마다 X).

### 5) 반복작업 도구화 (지시 5)

| 도구 | 하는 일 |
|---|---|
| `.claude/scripts/gitcp.sh` | 커밋+푸시 한 번에. `--to-main` 이면 main 머지·푸시까지. `--dry` 는 계획만. 제목 앞 시각 prefix·끝 Co-Authored-By 자동, `main` 에서 커밋 시도하면 멈춤, 충돌이면 작업트리 그대로 두고 멈춤, 끝나면 브랜치·커밋번호·원격번호·작업트리 건수 출력 |
| `.claude/scripts/testpass.py` | 테스트 통과 보고 처리. 통과 항목은 ☐ → ✅ O 를 **그 자리에서**(순서 안 바꿈), 그룹 전 항목 통과면 `00_히스토리.md` 로 **그룹째** 이관, 현황판엔 「없음 + 이관 완료」만 남김 |

`.claude/scripts/README.md` 에 쓰는 법을 적고, `.claude/rules/commit.md` · `document.md` 에
"손으로 하지 말고 이 도구를 쓴다" 한 줄씩 추가했다.

마지막 커밋(`d7de4ee6`)은 `gitcp.sh` 보강이다 — **바뀐 파일이 없고 `--to-main` 이면 머지만** 하는 길을 넣었다
(전엔 "바뀐 파일이 없다"로 멈춰서 손으로 git 을 써야 했다).

### 6) 백업 파일 폐지 (지시 6)

- `.claude/rules/code.md` 의 「고치기 전 백업(`_` 접두)」 지시를
  **「백업 파일을 만들지 말 것 — git 이 백업이다」** 로 교체(앞 지시 대체)
- `.gitignore` 에서 백업 확장자 예외 **8줄 전부 제거**, 「백업 파일」 절은 "백업은 만들지 않는다" 설명으로 바꿈
- 저장소에 있던 백업 파일 **9개 전부 삭제**(아래 목록). 이후 `git ls-files` 로 남은 것 **0건** 확인
- 메모리 `backup-original-before-work.md` 를 "백업 파일 만들지 말 것 ·
  `git restore <파일>` / `git checkout <커밋> -- <파일>` 로 복원" 으로 다시 씀 + `MEMORY.md` 색인 한 줄 갱신

## 변경 파일

추가:
- `.claude/scripts/gitcp.sh`
- `.claude/scripts/testpass.py`
- `.claude/scripts/README.md`
- `.works/getAppInfo/00_현황판.md` · `00_히스토리.md` · `01_사용처_조사.md`
- `.works/ws20디자인트리/00_현황판.md` · `00_히스토리.md` · `01_액션버튼_깊이따라_밀림_분석.md`
- `.docs/history/2026/10/2026-10-06_151619_claude_mixed_usp-appinfo-ws20tree-tooling_abc286a4.md` (이 파일)

변경:
- `www/ws30/ws10_20/js/ws_html5_shell.js` — USP 갈래에서 전역 AppInfo 저장
- `www/ws30/resources/index.js` — `getAppInfo()` 가 WS30 에서 모델을 읽어 동기화
- `www/ws30/ws10_20/js/usp/ws_html5_usp.js` — **주석만.** "WS30 은 전역을 안 채운다"는 설명이 2번 작업으로 거짓이 되어 고침
- `www/ws30/ws10_20/js/ws_html5_ws20_tree.js` — 트리 row 를 이름 cell 로 감싸는 처리 추가
- `www/ws30/ws10_20/WS10/css/ws20.css` — 이름 cell 레이아웃 + 들여쓰기를 toggle 로 이동
- `.claude/rules/code.md` · `.claude/rules/commit.md` · `.claude/rules/document.md`
- `.gitignore`
- `.docs/TODO.md`
- 메모리 `backup-original-before-work.md` · `MEMORY.md` (프로젝트 밖 — `~/.claude/projects/<이 프로젝트>/memory/`)

삭제 (백업 파일 9개):
- `electron/_main.js.bak_20260914`
- `electron/lib/log/_ws_crash_dump_read.js.bak_20260914`
- `electron/lib/log/_ws_crash_report.js.bak_20260914`
- `electron/lib/log/_ws_error_hook.js.bak_20260914`
- `electron/lib/log/_ws_main_log.js.bak_20260914`
- `electron/lib/log/_ws_telegram.js.bak_20260914`
- `electron/lib/msg/_MessageDatabase.js.bak_20260914`
- `electron/lib/msg/_WsMsgClsService.js.bak_20260914`
- `www/ws30/ws10_20/js/_ws_html5_ws20_edit.js.br16bak2`

## 변경 이유

- **전역 AppInfo 를 USP 에서도**: 전역 `getAppInfo()` 를 쓰는 쪽이 USP 에서는 `undefined` 를 받고 있었다.
  원본도 그랬지만 장군님이 "USP 앱 정보가 나오게 해줘" 라고 명시 지시하셨다.
- **진입 때 한 번 넣기 대신 「읽을 때 동기화」**: USP 안에서 Activate·모드전환·저장이 모델만 바꾸므로,
  바뀔 때마다 전역에 다시 쓰는 방식은 **쓰는 자리를 전부 찾아야 하고 하나 빠지면 또 묵는다.**
  읽는 자리는 한 곳(`getAppInfo`)이라 거기서 따라가게 하는 쪽이 빠뜨릴 데가 없다.
  또 모델 객체를 **그대로 대입**해 두 곳이 같은 객체를 가리키게 했다(값 복사 X).
- **트리 버튼을 cell 구조로**: 처음 분석 문서에 「들여쓰기 상한」·「sticky 보강」 같은 임시방편도 적어 뒀는데,
  장군님이 "몇번째부터 깨지는지 봐서 모해? 그 내용만 고치면 나중에 더 깊은 구조가 나올때마다 고칠꺼냐?"
  라고 지적하셔서 **두 안을 문서에서 지웠다.** depth 와 무관하게 성립하는 구조만 남겼다.
- **공통(`u4a-ui.js`·`shell.css`)을 안 고친 이유**: 공통 트리는 다른 화면도 쓴다.
  "공통만 고치면 열 고정 된다는 말이야?" 질문에 실측해 보니 **WS20 화면 전용 2곳으로 충분**했다.
- **백업 파일 폐지**: git 이 이미 백업이다. `_` 접두 사본은 폴더를 더럽히고 `.gitignore` 예외를 줄줄이 달게 만든다.

## 영향 범위

- **USP(WS30) 화면**: 이제 `getAppInfo()` 가 그 앱 정보를 돌려준다(전엔 `undefined`).
  WS30 을 벗어날 때 기존 코드가 전역을 비우는 동작은 **그대로 뒀다**(원본 동작).
- **WS20 화면**: 전역 AppInfo 를 읽는 쪽은 WS20 에서만 돌아서 영향 없음(모델 경로 분기 자체가 WS30 한정).
  logout·창닫기는 APPID 만 쓰고, 나머지 한 곳은 넘겨받은 값을 우선 쓴다 — **소스로 확인**.
- **WS20 디자인 트리**: row 안쪽 구성이 바뀌었다. row 자식 순서에 의존하는 WS20 코드가 있는지
  grep 으로 확인한 결과 **0건**이라 영향 없음.
- **공통 자산·다른 화면 트리**: 안 건드렸으므로 영향 없음.
- **저장소**: 백업 파일 9개가 사라졌다. 내용은 git 이력에 그대로 남아 `git show <커밋>:<경로>` 로 꺼낼 수 있다.

## 검증

- `node --check` — 고친 `.js` 전부 통과
- **장군님 앱 테스트**: getAppInfo 그룹(GA1~GA7) **전 항목 통과** · WS20 트리 그룹(TC1~TC8) **전 항목 통과**
  → 두 그룹 모두 그 영역 `00_히스토리.md` 로 이관 완료, 현황판 비움
- `git ls-files` 로 남은 백업 파일 **0건** 확인
- `gitcp.sh` 는 실제로 커밋 5건·main 머지 2회에 써서 동작 확인
- `testpass.py` 는 실제 통과 보고 처리에 써서 동작 확인
  (윈도우 콘솔 기본 코드페이지에서 한글 출력이 터져 UTF-8 로 고정하는 처리를 넣었다)
- **미검증**: exe(패키징본)에서는 확인하지 않았다 — 테스트는 dev mode 에서만 하기로 정해져 있다

## 참고 사항

### 실패·되돌린 것 (숨기지 않고 적는다)

- **`git rm --cached` 로 `.pyc` 87개를 빼려다 권한 분류에서 거절됐다.** 멈추고 상태를 그대로 보고했고,
  장군님이 "니가 해" 하셔서 다시 실행해 성공했다.
- **커밋 메시지에 깨진 글자가 들어갔다**(푸시 전). amend 로 고쳤다.
- **필요 없는 브랜치를 하나 만들었다.** HEAD 를 `main` 으로 잘못 읽어서다 —
  실제 HEAD 는 `bootstrap`(기본 브랜치 아님)이라 "기본 브랜치면 먼저 브랜치" 규칙이 걸릴 상황이 아니었다. 지웠다.
- **백업용 스크립트를 만들다가 폐기**했다. 백업 파일을 아예 만들지 않기로 지시가 내려와서다.
- **고쳐야 할 범위를 "여러 곳" 이라고 과장해 보고했다.** "손대야 되는게 많어?" 질문에 실제로 세어 보니 2곳이었다. 정정했다.
- **중간에 내가 하지 않은 merge 가 진행 중인 상태(`.git/MERGE_HEAD`, 충돌 90건)를 발견**했다.
  추측하지 않고 상태 그대로 보고한 뒤 정리했다(README 는 양쪽 다 살림, 작업문서 2개는 `bootstrap` 쪽 채택, `.pyc` 87개 제거).
- **노션 작업일지는 안 남겼다** — "남기지마라" 지시.

### 아직 정하지 못한 것

- 「지침서 2(오류 stack·오류 글을 console 까지 내보내기)」를 커밋할지 —
  코드는 넣고 dev mode 실측 통과(2026-10-01), 아직 커밋 안 함. exe 는 테스트 안 하기로 정함
- 「WS4.0 catch 오류 기록 보강」 테스트 5개 — 장군님 테스트 대기

### 다음 agent 가 알아야 할 것

- **백업 파일을 만들지 마라.** git 이 백업이다. `.gitignore` 에 백업 확장자 예외도 넣지 마라
- **커밋·푸시는 `bash .claude/scripts/gitcp.sh` 로.** 손으로 add/commit/push 하지 마라
- **테스트 통과 보고는 `python .claude/scripts/testpass.py <영역폴더> <코드접두>` 로.** 손으로 표 고치지 마라
- `getAppInfo()` 는 이제 **WS30 에 있는 동안 모델을 읽어 따라간다.** WS30 쪽에서 앱 정보를 바꿀 때
  전역에 따로 쓰는 코드를 넣을 필요가 없다 — 넣으면 두 곳에서 관리하게 된다
