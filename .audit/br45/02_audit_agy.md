# 02_audit_agy — BR45 파일올리기 계열 UI 추가 시 uploaderUrl 예외처리 누락 복원 검수

## 판정

**❌ 수정 필요 (P1 1건)**

---

## 1. 서브에이전트 2기 심층 팩트체크 결과 (2차)

본 검수는 "한번 더 면밀히 분석" 지시에 따라 Codex의 리포트와 병행하여 `attrUploadUrlException` 내부의 필드 할당 오타(`UIAT` vs `UIATV`) 및 개인화 프리셋 적용 시의 URL 오염 여부를 디버깅 레벨에서 극한으로 팩트체크한 결과입니다.

**[P1] attrUploadUrlException 내 `UIAT` 오타로 인한 개인화 프리셋 URL 오염 결함 (에이전트 C, 코덱스 공통)**
- **결함 확정**: `ws_html5_ws20_attr.js`의 `attrUploadUrlException` 함수 내 1482행 및 1497행(기존 수집 행 `ls_0015`가 존재하는 분기)에서, 속성값 필드인 `UIATV`가 아니라 잘못된 필드명인 `ls_0015.UIAT = ...` 에 값을 할당하는 치명적인 오타가 존재합니다.
- **영향 분석**: 
  1. 개인화 프리셋(`_buildPresetT0015`)이 적용되어 `_T_0015`에 `uploadUrl` 행이 선행 주입된 상태에서, 다른 APPID에서 생성된 프리셋을 가져오거나 빈 URL 프리셋을 적용할 경우 이 기존 행 분기(1474행~)로 진입합니다.
  2. 현재 APPID의 경로(`/zu4a_srs/<current_app>`)가 엉뚱한 `UIAT` 필드에만 할당되고, 실제 UI5 바인딩/전송에 쓰이는 `UIATV` 필드는 이전 APPID의 URL이나 빈 값 그대로 유지되어 런타임 파일 업로드 엔드포인트가 오염됩니다.
- **수정 방안**: `ws_html5_ws20_attr.js` 1482행 및 1497행의 `ls_0015.UIAT`를 **`ls_0015.UIATV`**로 수정해야 합니다.

*(참고: `designAddUIObject` 삽입 루프 내 호출 위치와 인자, 일반 UI 추가 시 1450행 Early Return을 통한 0 부작용, `typeof` 가드 및 `console.error` 표면화 자체는 완벽합니다.)*

---

## 2. 종합 평가

UI 추가 팝업 삽입 루프의 `attrUploadUrlException` 호출 배선 자체는 완벽하게 복원되었습니다.
그러나 **예외 함수 내부의 기존 행 보정 분기에서 `UIAT` 오타로 인해 개인화 프리셋 적용 시 `UIATV`가 갱신되지 않고 이전 APPID로 오염되는 결함**이 최종 확인되었습니다. 따라서 Codex의 지적을 100% 수용하여 **❌ 수정 필요 (P1 1건)** 판정으로 정정하며, `ws_html5_ws20_attr.js` 내 오타 2곳을 즉시 `UIATV`로 수정하는 조치를 권고합니다.
