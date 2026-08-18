# BR45 Codex 검수 결과

## 판정

**수정 필요 — P1 1건**

`designAddUIObject` 반복 루프에 추가한 호출 위치와 인자는 원본 및 D&D 형제 경로와 일치한다. 프리셋이 없는 일반 삽입에서는 `uploaderUrl` 행을 새로 만들어 정상값을 저장한다. 그러나 UI 추가 팝업의 개인화 속성 적용 경로에서는 이미 존재하는 `uploaderUrl` 행을 예외 함수가 잘못된 필드에 기록하여 BR45의 목적이 달성되지 않는 재현 가능한 결함이 있다.

## 지적

### [P1] 개인화 프리셋의 기존 uploaderUrl을 현재 APPID로 보정하지 못한다

- 개인화 적용 시 `_buildPresetT0015`는 프리셋의 `UIATV`를 신규 UI의 `_T_0015`에 먼저 넣는다 (`www/ws30/ws10_20/js/ws_html5_ws20_edit.js:1137~1162`).
- BR45 호출은 그 뒤 `attrUploadUrlException(l14.OBJID, l14.UIOBK)`을 정확히 실행한다 (`ws_html5_ws20_edit.js:1048~1053`).
- 이때 예외 함수는 uploaderUrl 행이 이미 있으므로 기존 행 분기로 들어간다. 빈 값 또는 다른 APPID의 `/zu4a_srs/...`를 보정하면서 실제 값 필드 `UIATV`가 아니라 구조에 없는 `UIAT`에 기록한다 (`ws_html5_ws20_attr.js:1480~1482`, `1494~1497`). 따라서 `UIATV`는 빈 값이나 이전 APPID URL 그대로 남는다.

재현:

1. FileUploader 또는 UploadCollection의 uploaderUrl을 개인화 속성으로 등록한다.
2. 다른 APPID에서 UI 추가 팝업을 열고 개인화 속성 적용을 선택해 해당 UI를 추가한다.
3. `_buildPresetT0015`가 이전 `/zu4a_srs/<old-app>` 값을 가진 행을 생성한다.
4. BR45 예외 함수가 호출되지만 `UIAT`만 새로 만들고 `UIATV`는 이전 URL을 유지한다.
5. 저장 payload와 런타임 upload endpoint가 현재 APPID가 아닌 이전 APPID를 가리킬 수 있다. 빈 프리셋 값도 동일하게 기본 URL이 채워지지 않는다.

개인화 DB의 키는 `LIBVER, SYSID, UNAME, UIATK`이며 APPID가 없다 (`design/attrPresetPopup/settings/index.js:255~331`). uploaderUrl도 별도 제외 조건 없이 현재 `UIATK/UIOBK/UIATV/UIATY` 그대로 저장되므로, 같은 사용자·시스템·라이브러리 버전에서 다른 앱에 프리셋을 재사용하는 것이 정상 도달 경로다. 삽입 시 저장 수집은 `prev._T_0015`의 `UIATV`를 사용하고 비스키마 `UIAT`는 소비하지 않으므로 오타가 실제 payload에 영향을 준다.

실제 WS3 원본 함수에도 같은 `UIAT` 오타가 있으나, BR45의 수용 기준은 단순 호출 존재가 아니라 UI 추가 팝업에서 uploaderUrl 예외처리가 실제 적용되는 것이다. 또한 HTML5에는 개인화 프리셋 적용 기능이 이 호출보다 먼저 행을 주입하므로 해당 분기가 정상 제품 경로에서 직접 재현된다.

권고:

- `attrUploadUrlException`의 기존 행 보정 두 곳을 `ls_0015.UIATV = ...`로 수정한다.
- 프리셋 없음, 빈 uploaderUrl 프리셋, 다른 APPID의 U4A 기본 URL, 사용자 지정 외부 URL, 바인딩 URL을 각각 확인한다. 외부 URL과 바인딩 URL은 현재의 early return 계약을 유지해야 한다.

## 나머지 검증

| 항목 | 결과 |
|---|---|
| 원본 호출 위치(미리보기 예외 draw 뒤) | 통과 |
| 인자 순서 `OBJID, UIOBK` | 통과 |
| `cnt` 반복 시 생성 노드별 호출 | 통과 |
| FileUploader/UploadCollection 외 UI no-op | 통과 |
| 함수 부재 가드 및 오류 표면화 | 통과 |
| 프리셋 없는 신규 uploaderUrl 행 생성 | 통과 |
| 개인화 프리셋 기존 행 보정 | **실패** |
| Undo/Redo | 통과 — 삽입 전 전체 스냅샷이며 Redo는 post-insert `_T_0015`를 캡처 |

## 독립 재검수 취합

서브에이전트가 기존 P1을 반박하는 방향으로 개인화 설정 저장부터 DB 조회, 신규 `_T_0015` 구성, BR45 호출, 저장 수집까지 독립 추적했다. uploaderUrl이 실제 프리셋 대상이고 APPID 비포함 키로 다른 앱에 재사용되며, 기존 행 분기의 `UIAT` 기록은 저장에서 무시된다는 점을 재확인하여 **P1·FAIL 유지**로 결론 내렸다.

비차단 추가 확인 사항: 미리보기 `createUIInstance`는 BR45 예외 호출보다 먼저 프리셋의 old/empty `UIATV`를 소비한다. 따라서 `UIATV` 오타 수정 후에도 현재 라이브 미리보기 인스턴스까지 즉시 갱신되는지는 실화면에서 확인해야 한다. 원본도 같은 호출 순서이고 예외 함수의 주효과는 저장 데이터 보정이므로 별도 필수 결함으로 추가하지 않았다.

## 정적 검증

- `node --check www/ws30/ws10_20/js/ws_html5_ws20_edit.js` 통과
- `node --check www/ws30/ws10_20/js/ws_html5_ws20_attr.js` 통과
- `git diff --check -- www/ws30/ws10_20/js/ws_html5_ws20_edit.js` 통과

제품 소스는 수정하지 않았다.
