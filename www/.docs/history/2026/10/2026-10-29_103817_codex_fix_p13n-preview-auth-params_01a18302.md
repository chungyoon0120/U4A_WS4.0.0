# 개인화 미리보기의 sap-user / sap-password 파라미터 주석 처리

## 요청

`design/js/callP13nDesignDataPopup.js`와 `js/fnP13nDesignPopupOpen.js`에서 sap-user / sap-password를 파라미터로 추가하는 부분을 주석 처리한다. 사유는 `design/preview/index.js`의 `loadUi5BootstrapScript` 주석을 참고해 작성한다.

## 변경 내용

- 두 파일의 sap-user 및 sap-password 전달 호출 총 4줄을 주석 처리했다.
- 참고 함수 주석에 기록된 bootstrap 요청의 재로그인·기존 세션 무효화·후속 JS 요청의 로그인 HTML 반환 사유를 인용했다.
- 해당 Network 관찰이 bootstrap 요청에 대한 기록임을 구분했고, 이번 POST 경로의 cookie 인증 성공은 별도 검증이 필요하다고 명시했다.
- sap-client, sap-language와 나머지 5개 파라미터, form POST·submit·제거 흐름은 유지했다.
- 주석 처리 전 두 소스의 사본을 `_backup` 아래에 보관했다.

## 변경 파일

- 변경: `ws30/ws10_20/design/js/callP13nDesignDataPopup.js`
- 변경: `ws30/ws10_20/js/fnP13nDesignPopupOpen.js`
- 추가: `_backup/p13n-preview-auth-params_20261029_103817/ws30/ws10_20/design/js/callP13nDesignDataPopup.js`
- 추가: `_backup/p13n-preview-auth-params_20261029_103817/ws30/ws10_20/js/fnP13nDesignPopupOpen.js`
- 추가: `.docs/history/2026/10/2026-10-29_103817_codex_fix_p13n-preview-auth-params_01a18302.md`
- 삭제: 없음

## 변경 이유

사용자 요청에 따라 기존 세션 쿠키를 사용하는 방향으로 개인화 미리보기에서도 ID/PW 재전송을 중지한다. 근거로 지정된 bootstrap 함수의 주석에는 ID/PW 재전송으로 새 로그인이 발생해 기존 세션과 후속 리소스 로딩에 문제가 생겼다는 Network 관찰 기록이 있다. 이번 작업에서 그 현상을 새로 측정한 것은 아니다.

## 영향 범위

기존 개인화 팝업과 현행 HTML5 개인화 팝업의 getP13nPreviewHTML POST form에만 적용된다. `design/preview/index.js`, 즐겨찾기 소스, 전역 인증 처리, SAP 서버 및 기존 분석·Notion 문서는 변경하지 않았다. 과거 분석 문서의 POST 파라미터 기술은 이 수정 이전의 조사 결과다.

## 검증

- 두 파일 모두 `node --check` 통과.
- 실제 함수 본문을 추출해 모의 DOM에서 실행했다. ID/PW 접근 시 오류를 발생시키는 getter를 사용했고, 두 함수 모두 해당 필드를 읽지 않고 완료했다.
- sap-user / sap-password 미포함, 나머지 7개 파라미터 유지, POST method·target·action 유지, append→submit→remove 순서를 확인했다. 실제 네트워크 요청은 발생시키지 않았다.
- 백업과 비교해 주석을 제외한 실행 코드 차이가 요청된 파라미터 호출 4줄 제거뿐임을 확인했다.
- 실제 SAP 연결, 개인화 미리보기 렌더링, cookie 전송 및 인증 성공은 미검증이다.

## 참고 사항

- 작업 전 `.docs/CURRENT.md`와 관련 개인화 팝업 이력을 확인했다.
- `pes-work-checklist`의 활성 항목 조회는 이 PC에 해당 스킬용 Notion 토큰이 없어 실패했다. 토큰을 임의 등록하지 않았다.
- 이번 변경은 파라미터 전달 비활성화 및 사유 주석 추가다. 새 런타임 분기·로그는 추가하지 않았고 기존 오류 처리와 로그는 유지했다.
- `.docs/CURRENT.md`는 변경하지 않았다.
