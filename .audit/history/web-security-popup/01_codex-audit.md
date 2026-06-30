# Web Security 팝업 HTML5 검증 리포트

- 검증 대상: `www/ws30/ws10_20/js/fnWebSecurityPopupOpen.js`
- 진입점: `www/ws30/ws10_20/js/fnDialogPopupOpener.js`의 `fnWebSecurityPopupOpener`
- 검증 관점: 저장 데이터 정합성, 보안 설정 입력 검증, 변경 플래그 동기화, 공통 dialog UX 준수
- 기준 문서: `.analy/06_팝업.md`, `.analy/07_JS유틸_워커_IPC.md`, `.analy/12_테마_컨버전_전략.md`, `.analy/16_공통_화면UX_표준.md`
- 제외: `_`로 시작하는 백업/구버전 폴더

## 요약

Web Security HTML5 팝업은 별도 `BrowserWindow`가 아니라 WS20 내부 native `<dialog class="u4a-dialog">`로 구현되어 있다. 문법 오류는 없고, 공통 dialog 리사이즈/리센터/close 제거 정책도 대체로 맞게 소비한다.

가장 우려되는 부분은 **보안 설정 저장 시 필수값 검증이 약한 점**이다. `Access-Control-Allow-Origin`을 특정 호스트 모드로 선택해도 External Host URL이 비어 있는 상태로 저장될 수 있고, `X-Frame-Options Allow-From`의 White List도 SID/SRC 중 한쪽만 입력된 행이 저장될 수 있다.

추가로, 저장 결과가 기본값과 논리적으로 동일해도 `parent.setAppChange("X")`를 무조건 호출해 앱 헤더/변경 상태가 실제 `S_WSO` 변경 여부와 어긋날 가능성이 있다.

## 발견 사항

### P1. 보안 모드별 필수값 검증이 없어 불완전한 Security 설정이 저장될 수 있음

- 위치:
  - ACA External Host URL 입력 생성: `www/ws30/ws10_20/js/fnWebSecurityPopupOpen.js:356-360`
  - 저장 데이터 구성: `www/ws30/ws10_20/js/fnWebSecurityPopupOpen.js:249-262`
- 증상:
  - ACA에서 `M03` 특정 호스트 모드를 선택해도 `EUL`이 빈 값인 상태로 저장될 수 있다.
  - XFO에서 `M03` Allow-From 모드일 때 White List 행의 `SID` 또는 `SRC` 중 하나만 입력해도 저장될 수 있다.
- 근거:
  - `lf_doSave()`는 XFO M03일 때 `SID`와 `SRC`가 **둘 다 빈 행**만 제거한다.
  - `SID`만 비거나 `SRC`만 빈 행은 `WHIT`에 그대로 저장된다.
  - ACA M03의 `EUL`은 `oUI.eulField.getValue()`를 그대로 넣고 별도 required 검증이 없다.
- 영향:
  - 서버로 전달되는 `S_WSO`가 보안 헤더 생성에 필요한 완전한 값이 아닐 수 있다.
  - 사용자 입장에서는 저장 성공 메시지를 받지만 실제 Web Security 설정은 무효 또는 부분 적용 상태가 될 수 있다.
- 권장 조치:
  - ACA M03이면 `EUL.trim()` 필수 검증을 추가한다.
  - XFO M03이면 White List에서 `SID`/`SRC`가 한쪽만 빈 행은 저장하지 말고 오류 표시한다.
  - 가능하면 `U4AUI.createField`의 `setValueState("error", msg)`와 공통 메시지 키를 사용해 첫 오류 필드에 focus한다.

### P2. 기본값과 동일하게 저장해도 앱 변경 플래그가 강제로 `X`가 될 수 있음

- 위치: `www/ws30/ws10_20/js/fnWebSecurityPopupOpen.js:264-270`
- 증상:
  - `oBuilt`가 `S_WSO_DEF`와 논리적으로 동일하면 `A.S_WSO`는 `S_WSO_DEF` 복사본으로 되돌린다.
  - 그런데 바로 뒤에서 `parent.setAppChange("X")`를 무조건 호출한다.
- 근거:
  - `parent.setAppChange("X")`는 `www/ws30/resources/index.js:1697-1713`에서 `oAppInfo.IS_CHAG = "X"`로 설정한다.
  - 반면 Web Security 속성행 변경 표시는 `S_WSO`와 `S_WSO_DEF`의 deepEqual 결과로 판단한다.
  - `www/ws30/ws10_20/js/ws_html5_ws20_attr.js:2958-2960`에서 `S_WSO`와 `S_WSO_DEF`가 같으면 Web Security 행은 changed로 보지 않는다.
- 영향:
  - 속성행은 변경 없음처럼 보이는데 앱 헤더는 Inactive/변경됨으로 남는 식의 상태 불일치가 발생할 수 있다.
  - 사용자는 실제 Web Security 값이 기본값인데도 저장 필요 상태로 오해할 수 있다.
- 권장 조치:
  - 저장 후 `S_WSO`와 `S_WSO_DEF`가 같은 경우 `setAppChange`를 호출하지 않거나, 전체 앱 변경 상태를 재계산하는 기존 경로가 있으면 그 값을 사용한다.
  - 단, CSS/JS Link 팝업과의 정책 일관성이 필요하므로 Claude가 기존 UX 의도를 함께 확인해야 한다.

### P2. Allow-From이 아닌 상태에서 기존 White List 데이터가 남아 있으면 저장 시 그대로 보존될 수 있음

- 위치:
  - 상태 로드: `www/ws30/ws10_20/js/fnWebSecurityPopupOpen.js:293-301`
  - XFO 변경 시 White List 초기화: `www/ws30/ws10_20/js/fnWebSecurityPopupOpen.js:373-379`
  - 저장 구성: `www/ws30/ws10_20/js/fnWebSecurityPopupOpen.js:252-261`
- 증상:
  - 사용자가 XFO 라디오를 M03에서 다른 값으로 직접 바꿀 때는 `oState.whit = []`로 비워진다.
  - 그러나 이미 저장된 데이터가 `XFO.M03 !== "X"`이면서 `WHIT`에 값이 남아 있는 비정상 상태라면, 팝업을 열고 바로 저장했을 때 그 White List가 그대로 보존될 수 있다.
- 영향:
  - 화면에서 현재 모드와 관련 없는 White List 데이터가 내부 `S_WSO`에 계속 남을 수 있다.
  - 이후 변경 비교, 전송 데이터, 디버깅에서 혼선을 만들 수 있다.
- 권장 조치:
  - 저장 시에도 최종 방어로 `XFO.M03 !== "X"`이면 `WHIT: []`로 정규화한다.
  - 화면 변경 이벤트에만 정규화를 의존하지 않는다.

### P3. `<dialog>` 캐시 재사용 주석과 공통 close 정책이 어긋나 혼동을 줄 수 있음

- 위치:
  - Web Security 주석/구현: `www/ws30/ws10_20/js/fnWebSecurityPopupOpen.js:78`, `316-318`, `470`
  - 공통 close 정책: `www/ws30/ws10_20/theme/u4a-ui.js:819-835`
- 증상:
  - Web Security 코드에는 "단일 캐시", "다이얼로그 1회 생성(이후 재사용)", "캐시 재사용"이라고 적혀 있다.
  - 하지만 공통 `u4a-ui.js`는 `dialog.u4a-dialog`가 close될 때 DOM에서 제거한다.
  - 실제 opener도 `document.body.contains(oUI.dlg)`가 false이면 `oUI = null; lf_build();`로 새로 만든다.
- 영향:
  - 런타임 결함은 아니지만, 유지보수자가 이 팝업을 상태 보존 싱글톤으로 오해할 수 있다.
  - 상태 보존이 정말 필요하다면 `[data-u4a-keep]` opt-out을 써야 하는데 현재는 쓰지 않는다.
- 권장 조치:
  - 주석을 "열려 있는 동안만 참조, close 후 공통 정책에 따라 제거되고 다음 열기 때 재생성"으로 정정한다.
  - 상태 보존 의도가 있다면 `data-u4a-keep` 적용 여부를 별도로 판단한다.

### P3. 화면 스코프 스타일에 고정 px 값이 남아 있어 반응형 원칙과 일부 충돌 가능

- 위치:
  - `www/ws30/ws10_20/js/fnWebSecurityPopupOpen.js:460-461`
  - `www/ws30/ws10_20/js/fnWebSecurityPopupOpen.js:507-558`
- 증상:
  - dialog width/height는 `min(94vw, 640px)`, `min(88vh, 660px)`로 되어 있고, resizable 최소 크기도 `minW: 460, minH: 360`이다.
  - `.analy/12`, `.analy/16`은 반응형과 고정 px 폭 금지를 강조한다.
- 영향:
  - 일반 데스크톱에서는 문제가 작지만, 좁은 창이나 축소 상태에서 최소 리사이즈 크기/고정 기준이 뷰포트와 충돌할 수 있다.
- 권장 조치:
  - 가능한 경우 `rem`, `clamp()`, viewport 기반 제한으로 치환한다.
  - 실제 문제가 없다면 Claude가 "원본 600x600 dialog 이식 의도"와 공통 dialog clamp 동작을 근거로 유지 여부를 답변하면 된다.

## 추가 확인 결과

- `node --check www/ws30/ws10_20/js/fnWebSecurityPopupOpen.js`: 문법 오류 없음
- 현재 `fnWebSecurityPopupOpen.js` 자체에는 git diff가 없다.
- Web Security 팝업은 `.analy/06` 기준의 별도 BrowserWindow 팝업이 아니라 WS20 내부 native dialog 방식으로 구현되어 있어, IPC/BroadcastChannel 리스크는 주요 감사 대상에서 제외했다.

## Claude에게 확인 요청할 항목

1. ACA M03의 External Host URL 빈 값 저장을 허용하는 것이 원본 의도인지 확인
2. XFO M03 White List의 SID/SRC 부분 입력 행 저장을 허용하는 것이 원본 의도인지 확인
3. `S_WSO === S_WSO_DEF`인 저장에서도 `setAppChange("X")`가 맞는지 확인
4. `XFO.M03 !== "X"`일 때 저장 시 `WHIT`을 항상 비우는 정규화가 필요한지 확인
5. dialog 캐시 주석과 실제 close 후 재생성 정책을 정정할지 확인
