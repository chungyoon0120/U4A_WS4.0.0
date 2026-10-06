# A1 진행 — catch 에 오류 위치 남기기

- **상태 : 끝남 (2026-09-29)** — A2 · A4 · A1 전부. `bootstrap` 에 머지.
- 스캔 결과 (지침서 개정판 스크립트, 작업 전) : A 392 / B 339 / C~G 28 / H 15 (합 774)
  - 작업 후 재스캔 : **A 731 / B 0** / C~G 28 / H 15 — B 339곳이 전부 A(오류 객체 있음)로 옮겨감
  - H 15 중 13곳은 주석만 있는 블록(E·F). 지침서 기대값(H 2 / C~G 41)과 다른 이유 = 스크립트가 주석을 지운 뒤 빈 블록을 셈
- 측정 (테스터가 오류 객체에서 stack 을 꺼내나) : **하지 않음** — 장군님 결정(WS4.0 은 테스터에 맞추지 않는다)
- 결정·범위 : [04_착수보고서.md](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/.works/ws40-work-order/04_착수보고서.md)

| 항목 · 묶음 | 대상 | 결과 |
|---|---:|---|
| A2 반복 억제 스위치 | 파일 2 | `U4ALOG.setCaughtThrottle(true/false)` · 화면 바뀔 때(`setScreen`)·앱 열 때(`fnLoadWs20TreeData`) 카운터 비움 |
| A4-1 속성 적용 실패 | 1곳 | `U4ALOG.caught(e, "createUIInstance OBJID=… LIBNM=…")` |
| A4-2 속성값 바뀜 | 3곳 | `U4ALOG.note` 참고 등급 `PROP_COERCE` (지침서는 경고 2곳 — 장군님 결정으로 참고 3곳) |
| A4 선행 — 미리보기에 로그 함수 연결 | 1곳 | 미리보기 iframe 에 U4ALOG 가 없어 기존 호출 51곳이 전부 아무것도 안 남기고 있었다 → 부모 창 것을 이어 받음 |
| B 글자만 → 오류 객체 추가 | 339곳 · 파일 71 · 344줄 | console 호출 끝에 오류 객체를 인자로 덧붙임. 문구·등급 그대로. 변수 없는 `catch {` 1곳은 `catch (e) {` 로 |
| C~G console 없음 | 28 | **고칠 곳 0** (아래) |
| H 빈 catch | 2 | 손대지 않음(장군님 결정 4 — 로그 코드·뒷정리) |

## 판단한 것 (C~G 28곳 · H)

| 분류 | 곳 | 내용 |
|---|---:|---|
| C 다른 로그 함수로 남김 | 11 | `U4ALOG.error` 5 · `_hostFail` 3 · `_caught` 2 · `oCon.error`+rethrow 1 |
| D 다시 던짐 | 6 | `throw` 로 전역 오류 감시에 넘김 — 바인딩 방송 실패 2 · 도움말 HTML 읽기 · 속성 영역 Dump HTML 읽기 · 미리보기 `setTimeout throw` · 트리 다시 그리기(`bStrict`) |
| E 일부러 조용히 (이유 주석) | 2 | 데이터 모니터 — 글자로 못 펴는 값은 개수로 표시 · 화면 이름 못 읽으면 빈 칸 |
| G 대체값 (정상 흐름) | 4 | `ws_common.js:4530` · `:4626` — 로그 요약 코드 자체(결정 4) · `ws_html5_datamon.js:744` 크기 -1 · 데이터 모니터 값 표시 대체 → 전부 기록 안 함 |
| F 주석 처리된 로그 | 1 | 버전 관리 날짜 표시 — 원본에서도 꺼져 있음(결정 7) |
| 로그 파일 안 | 1 | `ws_html5_logger.js` — 무한 반복이라 절대 손대지 않음 |
| 외부 라이브러리 | 1 | `js/download.js` (dandavis, CC-BY2) — 남의 라이브러리 |
| 쓰지 않는 파일 | 2 | `optionPopup-origin` 2곳 |
| 앱 종료감(필수 함수 없음) | 0 | — |

## 손대지 않고 넘긴 것
- 로그 파일(`ws_html5_logger.js`) 안의 catch 전부 — 무한 반복
- 주석 처리된 로그 9곳 — [03_주석처리된_로그_목록.md](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/.works/ws40-work-order/03_주석처리된_로그_목록.md)
- minified 3개 · 외부 라이브러리
