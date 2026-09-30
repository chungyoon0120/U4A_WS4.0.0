# WS4.0 catch 오류 기록 보강 (ws40-work-order 개정판)

- 날짜: 2026-09-29 ~ 2026-09-30 · agent: claude · session: 1c9e61f4
- 커밋: `dcb1d34a` `[2026-09-29 19:29]` (브랜치 `bootstrap`, push 안 함)

## 요청

1. 지침서 `D:\workspace\ws4-auto-fix-daemon\.docs\handoff\ws40-work-order.md` (개정판 18:40) 를 리마인드하고 작업 위치를 파악한다.
2. 장군님 결정을 받아 작업한다: A2 반복 억제 스위치, A4 미리보기 속성값 기록, A1 catch 보강.
3. 커밋하고 `bootstrap` 에 머지한 뒤 `ws40-catch-log` 브랜치를 지운다.
4. 앱을 실행해 CDP 로 붙어 실측하고, 끝나면 로그오프하고 앱을 끈다.
5. 다른 PC 설치 테스트용으로 빌드한다.

## 변경 내용

- **A2**: `U4ALOG.setCaughtThrottle(true/false)` · `clearCaughtCount()` · `note()` 를 추가했다. 반복 카운터는 화면 이름이 바뀔 때(`setScreen`)와 앱을 열 때(`fnLoadWs20TreeData`) 비운다. 새 사건 `THROTTLE` 을 추가했다.
- **A4 선행**: 미리보기 iframe(`design/preview/index.js`) 에 U4ALOG 가 없어서 기존 기록 호출 51곳이 아무것도 남기지 못하고 있었다. 부모 창의 `U4ALOG` 를 이어 받게 했다. 부모 창에 없으면 `console.error("[PREV-001] ...")` 를 남긴다.
- **A4-1**: createUIInstance catch 에 `OBJID` / `LIBNM` 을 기록한다.
- **A4-2**: 속성값이 바뀌는 3곳을 참고 등급 `PROP_COERCE` (`U4ALOG.note`) 로 기록한다: isNaN→0, isValid false→undefined, enum 불일치→undefined.
- **A1-B**: catch 안 console 호출 339곳(파일 71개, 344줄)에 오류 객체를 마지막 인자로 덧붙였다. 문구와 등급은 그대로다. `settings-store.js` 에서 변수 없는 `catch {` 1곳은 `catch (e) {` 로 바꿨다.
- **A1-C~G 28곳 · H**: 판단 결과 고친 곳 없음. 목록은 `.docs/A1-progress.md` 에 있다.
- **로그 표준**(`.works/DEV_STANDARD_로그.md`): R2 에 예외 1줄(일부러 조용히 넘기는 정상 흐름 catch 는 기록 안 함)을 적었다. 사건 `THROTTLE` · `PROP_COERCE` 를 추가했다.
- **빌드**: `npm run build` → `dist/U4A-Workspace-Setup-3.6.4.exe` (154,075,497 B, 09-29 19:47, 서명됨)

## 변경 파일

- 변경(커밋 `dcb1d34a`, 82개)
  - `www/ws30/ws10_20/js/ws_html5_logger.js`
  - `www/ws30/ws10_20/js/ws_html5_ws20_data.js`
  - `www/ws30/ws10_20/design/preview/index.js`
  - B 묶음 71개 파일(`intro.js` · `u4a-ui.js` · `settings-store.js` · `vw_main/control.js` 등)
  - `.works/DEV_STANDARD_로그.md` · `.docs/TODO.md`
- 추가(커밋)
  - `.docs/A1-progress.md`
  - `.works/ws40-work-order/` (00_현황판 · 01_catch_targets · 02_지침서_개정판_비교 · 03_주석처리된_로그_목록 · 04_착수보고서 · handoff/ 지침서 복사본)
- **커밋 안 됨**
  - `.works/ws40-work-order/00_현황판.md` (CDP 실측 결과 부분)
  - `.works/ws40-work-order/verify-cdp.js` (미추적)
- 삭제: 없음. `ws40-catch-log` 브랜치만 지웠다.

## 변경 이유 · 결정 (장군님)

1. **이미 console.error 인 곳은 U4ALOG.caught 로 바꾸지 않는다.** 타면 안 되는 catch 는 console.error 가 맞다. caught 는 참고 등급이라 테스트 프로그램이 오류로 보지 않고 넘긴다.
2. **속성값이 바뀌는 곳은 참고 등급으로 남긴다.** WS4.0 은 UI5 개발 툴이라 사용자가 숫자가 아닌 값을 넣을 수 있고, 툴이 0 으로 바꿔 주는 것은 정상 흐름이다. 지침서는 경고 2곳이었는데 참고 3곳으로 바꿨다.
3. **앱 실행 확인은 생략**했다. 로그만 넣는 작업이라 회귀 테스트가 필요 없다는 판단이었다. 이후 장군님이 CDP 실측을 따로 지시했다.
4. **일부러 조용히 넘기는 catch 는 기록하지 않는다.** 많이 호출되는 자리라서다. 로그 표준 R2 에 예외 1줄을 적었다.
5. **필수 객체·함수가 없으면 크리티컬 규칙**(오류 코드 + 앱 종료)을 적용한다. 이번 대상 중 해당하는 곳은 0곳이었다.
6. **개정판 B 339곳**은 오류 객체를 추가한다. "테스터가 stack 을 꺼내는지" 측정은 하지 않는다. WS4.0 은 테스터에 맞추지 않고, 툴 입장에서는 정보를 주는 게 낫다는 판단이다.
7. **주석 처리된 로그 9곳(F)은 손대지 않는다.** 주석 처리한 데는 이유가 있다고 봤다. 목록은 03 파일에 있다.

## 시도했다 버린 것 · 실수

- 빈 catch 개수가 지침서 기대값(H 41)과 다르게 나왔다(2/15). 원인은 스캔을 3줄 창으로 했기 때문이다. 블록 본문 기준으로 다시 셌다.
- CRLF 때문에 위치 계산이 어긋났다. scan·edit 모두 `newline=''` 로 읽게 맞췄다.
- 브랜치: 지침서의 "new branch from bootstrap" 을 그대로 따라 `ws40-catch-log` 를 만들었다. 장군님은 `bootstrap` 에서 작업하길 원했다. 결국 `bootstrap` 에 머지하고 브랜치를 지웠다. (지침서 문구가 원인)
- md 링크를 상대경로로 걸었다가 크게 질책받았다. 절대경로로 고치고, 프로젝트 밖 파일(D: 지침서)은 `handoff/` 로 복사한 뒤 링크했다. 메모리에 기록했다.
- 장군님이 "고쳤어?" 라고 물었는데 작업을 시작해서 질책받았다. 질문에는 답만 한다.
- 처음 로그오프한 뒤에도 앱이 남아 있었다. #Main 만 닫히고 #ServerList 창이 떠 있었기 때문이다. `window.close()` 로 닫았다.

## 영향 범위

- 동작 변화는 로그 줄뿐이다(console 인자 추가, 참고 줄 추가). 화면과 기능 로직은 바꾸지 않았다.
- 미리보기 iframe 이 이제 부모 로그로 기록한다. 기존 51곳의 기록 호출이 실제로 줄을 남기기 시작한다.
- exe 에서는 electron-log 콘솔 level 이 `error` 라서 참고·info 줄은 콘솔로 나가지 않는다. 파일에만 남는다.

## 검증

- `node --check`: 수정한 파일 전부 통과
- 재스캔: A 731 / B 0 / C~G 28 / H 15
- CDP 실측(앱 YLCY_TEST2142, WS20 편집 모드): 전부 통과
  - 오류 0줄, PREV-001 0줄
  - 미리보기 창의 U4ALOG === 부모 창 것
  - 같은 오류 10번: 반복 억제 켬 3줄 / 끔 10줄. THROTTLE on/off 줄 확인
  - PROP_COERCE: 이 앱에서는 0줄. 일부러 넣은 잘못된 값은 1줄씩 찍히고, 정상 값 `12` 는 안 찍힘
  - console.error(…, Error) 는 CDP 로 object/error 로 오고, description 에 전체 stack 이 있음
  - 실측 뒤 로그오프(편집 잠금 반납)하고 앱 종료
- 빌드: exit 0. app.asar 안에서 새 코드 5곳(logger · ws20_data · preview · intro · u4a-ui) 모두 확인
- **미검증**: 장군님 테스트 5개(00_현황판 맨 위), 다른 PC 설치 테스트

## 참고 사항 · 남은 것

- 버전이 3.6.4 그대로라서, 이미 3.6.4 가 설치된 PC 는 새 버전으로 보지 않을 수 있다. 그 경우 지우고 다시 설치한다.
- 커밋 안 된 문서 2개는 커밋 지시를 기다리는 중이다. push 는 하지 않았다.
- 노션 작업일지(commit 규칙상 커밋 뒤 기록)는 지시를 받지 않아 하지 않았다.
- `.works/ws40-work-order/handoff/ws40-work-order.ko.md` 는 개정 전 내용이다.
- CURRENT.md 는 프로젝트 규칙(지시할 때만)에 따라 고치지 않았다.
