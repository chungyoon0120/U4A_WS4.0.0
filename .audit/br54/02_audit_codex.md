# BR54 Codex 검수 결과

## 판정

**수정필요**

예외 대상 판정과 호출 위치 자체는 원본 순서를 잘 옮겼지만, 저장소에서 확인되는 유일한 하위 모듈 후보는 HTML5에서 실행 불가능합니다. 또한 동기 RESET 루프 중간에 BR54 비동기 분기가 들어오면 이후 속성 처리가 결정적으로 누락됩니다.

## 지적

### 1. [P1] 확인 가능한 유일한 예외 하위 모듈이 HTML5 런타임과 호환되지 않는다

- 위치: `www/ws30/ws10_20/js/ws_html5_ws20_attr.js:3908`~`3915`, `4025`~`4039`; `www/ws30/ws10_20/design/attributesArea/imageCompress.js:40`~`185`; `www/ws30/ws10_20/js/ws_html5_shell.js:28`~`108`
- 저장소의 `design/attributesArea`에서 `default(sAttr)` 형태로 확인되는 속성 예외 하위 모듈은 `imageCompress.js`뿐입니다. 실제 운영 UW13의 `FLD04+FLD05`가 이 파일을 가리키는지는 서버 데이터가 없어 정적으로 확정하지 못했지만, 이 모듈이 매핑되는 경우의 실패는 확정적입니다.
- 모듈은 `sap.ui.model.json.JSONModel`, `sap.m.Panel`, `sap.f.GridList`, `sap.m.Switch/Input/Slider` 및 UI5 control을 받는 `dialogViewer`를 직접 사용합니다. HTML5 본창은 UI5 bootstrap을 제거했고 `ws_html5_shell.js`의 `sap`은 메시지용 최소 스텁이라 `imageCompress.js:72`에서 TypeError가 발생합니다.
- 설령 UI 생성부를 통과해도 Apply 콜백 `imageCompress.js:183`은 HTML5에 정의되지 않은 `oAPP.fn.attrChangeProc(...)`를 호출합니다. 현행은 그 역할을 `fnWs20AttrChange`로 통합했으므로 커밋 경로도 호환되지 않습니다.
- BR54 호출부는 reject를 로그로 소비하고 정규 값 처리를 건너뛴 채 잠금을 해제합니다. 이 UW13 매핑에서는 이미지 압축 팝업과 예외 기능이 모두 동작하지 않습니다.

### 2. [P1] RESET_ATTR 동기 루프에서 UW13 대상 이후의 모든 속성 처리가 누락된다

- 위치: `www/ws30/ws10_20/js/ws_html5_ws20_attr.js:3963`~`3968`, `4025`~`4039`, `4759`~`4806`; 원본 `www/ws30/ws10_20/design/js/uiAttributeArea.js:2143`~`2194`
- HTML5 RESET은 각 대상의 `UIATV`를 먼저 기본값으로 직접 변경한 뒤 `fnWs20AttrChange`를 동기 루프에서 연속 호출합니다. 중간에 UW13 대상이 나오면 BR54는 `_fnAttrChangeBusy=true`를 비동기 모듈 완료까지 유지한 채 즉시 반환합니다.
- 같은 루프의 이후 `fnWs20AttrChange` 호출은 재진입 가드에서 전부 즉시 return합니다. 뒤쪽 행은 메모리의 `UIATV`만 바뀌고 `attrChgAttrVal`, prev 저장 후보, 스타일·검증·후처리가 누락됩니다. 모듈이 즉시 성공하거나 reject해도 Promise 후속은 microtask라 루프 종료 전에는 플래그가 풀리지 않습니다.
- RESET 외부 `finally`는 BR54 모듈 완료를 기다리지 않고 본창 busy와 단축키를 해제합니다. 그 사이 화면은 조작 가능하지만 `_fnAttrChangeBusy`는 true여서 다른 속성 변경도 조용히 무시되는 split-brain 상태가 됩니다.
- 원본 RESET은 각 행에 `attrChangeProc`를 직접 호출하고 `attrChange`/`attrChangeException`을 거치지 않습니다. RESET에 UW13 팝업과 비동기 분기가 끼는 현행은 원본과 다르며 BR54 도입으로 발생한 확정 회귀입니다.

## 정상 확인 사항

- `_isAttrChangeException`의 정상 판정 조건은 원본과 같습니다: `UHAK901369` 설치 확인 후 UW13 `FLD01===UIATK` 검색입니다.
- Undo 스냅샷 직후, 일반 `setChangeFlag`와 값 처리 직전에 예외 분기를 둔 위치는 원본 `attrChange`의 순서와 같습니다.
- 대상이 아닌 정상 데이터에서는 기존 동기 처리 흐름과 최종 `finally` 잠금 해제가 유지됩니다.
- 대상 분기의 Promise 성공·reject 모두 `.then(_releaseAttrChangeLock)`으로 이어져 settle되는 한 재진입 플래그, 단축키, 본창 busy, 자식창 busy가 회수됩니다. 동기 호출 실패도 `_bExcPending=false`로 되돌려 `finally`가 회수합니다.
- 모듈 실행 중 `_fnAttrChangeBusy`를 유지하는 것은 단일 사용자 변경에서는 원본 화면 잠금 의도와 맞습니다.
- 동적 import 경로의 실제 UW13 `FLD04+FLD05` 값은 저장소에 없어 정적으로 확정하지 못했습니다. 상대 경로라면 classic-script의 import 기준 URL 차이도 추가 검증해야 합니다.
- `node --check www/ws30/ws10_20/js/ws_html5_ws20_attr.js` 통과.

## 비차단 참고

- 최초 검수에서 `_isAttrChangeException` throw 및 UW13 미구성을 fail-open P2로 판정했으나 독립 반박 검토 후 철회합니다. 현행 `checkWLOList`는 목록을 배열로 정규화하고, UW13 미구성 시에는 예외 대상을 식별할 근거가 없습니다. 부분 로딩·손상 상태의 fail-closed는 방어 개선 가치가 있지만 정상 제품 경로의 재현 가능한 P2로 확정하기에는 근거가 부족합니다.

## 제안

1. `imageCompress.js`를 HTML5 공통 `<dialog>`와 입력 컴포넌트로 변환하고 Apply를 HTML5 변경 수집 함수와 연결하십시오. 원본 UI5 모듈을 본창에서 직접 실행하지 마십시오.
2. RESET은 원본처럼 예외 dispatcher를 거치지 않는 내부 커밋 경로를 사용하거나 전체 RESET을 await 가능한 직렬 작업으로 재설계하십시오.
3. 예외 실행 함수가 성공/취소/실패를 표현하는 명시적 결과를 반환하게 하고 호출부가 결과별 후속 처리와 잠금 회수를 한 곳에서 수행하도록 하십시오.
4. 실제 UW13 데이터로 import, 팝업, Cancel, Apply 단일 Undo·저장, RESET 대상 전후 행의 저장 정합, load 실패 회수를 통합 테스트하십시오.

## 독립 재검수 취합 (2026-08-21)

- 모듈 호환성 에이전트는 UI5 bootstrap 부재, 최소 sap 스텁의 실제 shape, `attrChangeProc` 미로드를 독립 확인했습니다. UW13 경로는 서버 데이터이므로 `imageCompress.js` 실제 매핑은 조건부로 표현하도록 보정했습니다.
- 비동기 계약 에이전트는 RESET 정상 경로에서 BR54 재진입 플래그가 이후 행을 결정적으로 누락시키는 새 P1을 발견했습니다. 원본 RESET이 dispatcher를 거치지 않는다는 반대 대조도 확인했습니다.
- 최초 fail-open P2는 현실적 throw 도달성이 부족해 철회하고 비차단 참고로 낮췄습니다.

### 재검수 최종 판정

**수정필요 유지 — P1 2건(조건부 하위 모듈 실행 불능, RESET 후속 행 처리 누락).**
