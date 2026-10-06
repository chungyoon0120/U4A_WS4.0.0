# yoon-audit 노션 경로 갱신(notion-multi 폐기 → yoon-notion CLI u4a) + BR40 상태 수정완료

## 요청
장군님: "yoon-audit 스킬에 연결된 노션 지금 안 되는거야?" → 확인 후 "① BR40 상태 변경 ② yoon-audit 파일 갱신 둘 다 진행."

## 조사 결과
- yoon-audit 명령이 쓰던 `notion-multi` MCP 는 이 세션에 **미연결**(도구 목록에 없음, `.mcp.json`·`~/.claude.json`·`settings.json` 어디에도 등록 없음) → 폐기됨.
- 이슈 리포트 DB 는 `yoon-notion` CLI 의 `u4a` 연결(U4A 워크스페이스)로 이관돼 있음(연결 설명 "notion-multi에서 이관", 연동일 2026-09-10). CLI 정상 동작 확인(`whoami`·`query`·`update` 성공).
- DB 상태(status) 옵션 실측: `접수 / 보류 / 작업중 / 수정완료 / 테스트확인중 / ✅ 최종완료 / 🔁 재오픈 / 반려`.

## 변경 내용
1. **BR40 노션 상태 변경**: `🔁 재오픈` → `수정완료` (page_id 3bb7e18b-1cd6-81ed-9c20-d5d45432cc4e). 재조회로 반영 확인.
   - **본문 추가(테스터용)**: 상태만 바꾸면 테스트하는 사람이 사유·현황을 모른다는 장군님 지적으로, BR40 페이지 본문 끝에 "✅ 수정 내역(2026-09-14, 개발)" 블록 11개 append(`yoon-notion append --content-file`) — 원인(delDesc 본체 유실)·수정(원본 1:1 재이식)·테스트 확인법(F12 콘솔 `T_DESC` 조회 4가지). get 재조회로 반영 확인.
   - **본문 히스토리 스타일 재구성**(장군님 지적: 리포터가 라운드마다 heading_1 "수정 후 재테스트 결과"로 구분해 쌓아둠 → 그 패턴에 맞춰라). 앞서 넣은 블록 전부 `blocks`로 id 확인 후 `delete`로 제거하고, **구분선(divider) + 빨간 heading_1 "🔧 수정 (2026-09-14, 개발) — delDesc 본체 재이식"**(raw `PATCH /v1/blocks/{id}/children`, `heading_1.color=red`) + 본문(markdown append)으로 재작성. blocks --json 으로 `color=red`·순서 확인. 이로써 리포터 라운드 아래에 재수정 라운드가 시간순으로 쌓임.
2. **yoon-audit 명령 파일 갱신**: 모든 노션 경로를 `notion-multi` MCP → `yoon-notion` CLI(`--as u4a`)로 교체.
   - front-matter `allowed-tools` 에서 `mcp__notion-multi__*` 5개 제거(Read/Write/Edit/Grep/Glob/Bash 만 유지).
   - "노션 대상(고정)" 절: CLI 실행법(Windows PowerShell / Bash), subcmd(query/get/update/db), status 옵션 목록, ★필터 JSON PowerShell 이스케이프(`\"`) 주의 추가.
   - 분기1(고쳐라)·분기4(수정 완료해라)의 조회·상태변경 단계를 CLI 명령으로 교체.

## 변경 파일(추가·변경·삭제)
- 변경: `.claude/commands/yoon-audit.md`
- 추가: 없음 / 삭제: 없음
- 노션(외부): 이슈 리포트 DB BR40 행 상태 = 수정완료

## 변경 이유
명령 문서가 폐기된 MCP 를 가리켜 노션 조회·상태변경이 전부 실패하던 것을 실제 경로(CLI u4a)로 바로잡음. BR40 은 재수정+DD1~DD4 재통과 완료라 상태를 수정완료로 정정.

## 영향 범위
- 문서·노션 상태만. 런타임 코드 무관.
- 다음 `/yoon-audit` 실행부터 CLI 경로로 동작. codex/agy 검수 흐름·`.audit` 규약은 그대로.

## 검증
- `whoami --as ws4.0` / `connect list` 로 연결 확인. `query`(BR40 조회)·`update`(상태변경)·재`query`(상태=수정완료) 성공.
- ★PowerShell 에서 `--filter` JSON 은 내부 큰따옴표가 벗겨져 실패 → `\"` 이스케이프로 해결(명령 파일에 주의로 명시).

## 참고 사항
- **Stop hook 오탐 계속**: 게이트가 이번에도 `www/ws30/resources/index.js`·`www/ws30/ws10_20/js/fnFavIconPopupOpen.js` 를 지목했으나 **이 세션에서 건드린 적 없음**(다른 세션이 동시 편집 중). 게이트가 세션 구분 없이 전역 mtime 으로 비교하는 구조로 보임.
- yoon-notion CLI 연결: `me`(개인) / `u4a`(기본, 이슈 DB) / `ws4.0`(전기능 테스트 시트). MCP `notion-multi` 는 더 이상 없음.
