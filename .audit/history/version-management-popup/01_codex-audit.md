# Version Management 별도창 검증 리포트

- 검증 대상: `www/ws30/ws10_20/js/fnVersionManagementPopupOpen.js`, `www/ws30/ws10_20/Popups/versionMng/*`
- 검증 관점: 프로그램 동작 결함, 런타임 오류 가능성, 팝업/IPC/테마/리소스 정리 리스크
- 기준 문서: `.analy/06_팝업.md`, `.analy/07_JS유틸_워커_IPC.md`, `.analy/12_테마_컨버전_전략.md`, `.analy/16_공통_화면UX_표준.md`
- 제외: `_`로 시작하는 백업/구버전 폴더

## 요약

현재 구현에서 가장 우려되는 지점은 **비교 대상(Target) 라디오 버튼이 DOM에 붙지 않는 코드 형태**다. 이 경우 사용자는 비교 기준(Base)만 선택할 수 있고, `Compare` 실행 시 항상 “비교 대상을 선택하라”는 경로로 빠질 가능성이 높다.

그 외에는 종료/리소스 정리, 최초 데이터 수신 실패 시 busy 고착, 이전 diff 화면 잔상, 일부 문구 하드코딩 문제가 있다.

## 발견 사항

### P1. 비교 대상(Target) 라디오 버튼이 실제 DOM에 추가되지 않을 수 있음

- 위치: `www/ws30/ws10_20/Popups/versionMng/versionMngFrame.js:355-359`
- 증상: Compare 컬럼에서 Base 라디오는 표시되지만 Target 라디오가 표시되지 않거나 클릭 불가능할 수 있다.
- 영향: `_onCompare()`는 `input[name="vmTarget"]:checked`를 찾는데, Target input 자체가 없으면 비교 기능이 항상 중단된다.
- 근거:
  - `oRdT`와 `oSpT` 생성 후 `oLblT.appendChild(oRdT); oLblT.appendChild(oSpT);`가 주석 뒤 같은 줄에 붙어 있다.
  - 결과적으로 해당 append 코드가 실행되지 않는 형태로 보인다.
- 권장 조치:
  - Target label 구성 코드를 Base와 동일하게 별도 실행문으로 분리한다.

```js
var oSpT = document.createElement("span");
oSpT.textContent = _z("395");
oLblT.appendChild(oRdT);
oLblT.appendChild(oSpT);
```

### P2. 최초 IF 데이터 수신이 누락되면 창이 busy 상태로 고착될 수 있음

- 위치:
  - opener 송신: `www/ws30/ws10_20/js/fnVersionManagementPopupOpen.js:111-120`
  - renderer 수신 등록: `www/ws30/ws10_20/Popups/versionMng/versionMngFrame.js:782-794`
- 증상: `if-vermng-info` 수신이 누락되거나 서버 응답이 지연/예외로 흐르면 `_finishOpen()`이 호출되지 않아 `vmContent`가 계속 opacity 0 상태로 남거나 busy가 풀리지 않을 수 있다.
- 영향: 사용자 입장에서는 Version Management 창이 열렸지만 본문이 나타나지 않거나 계속 대기 화면처럼 보일 수 있다.
- 근거:
  - `docPopup`에는 20초 busy watch fallback이 있는데, Version Management에는 동일한 안전장치가 없다.
  - `_onVmInfo()` 이후 `_loadVersionList()` 성공 시에만 `_finishOpen()`을 호출한다.
- 권장 조치:
  - renderer IPC listener를 가능한 한 빨리 등록하거나, opener에서 `did-finish-load` 이후 재전송/ack 구조를 둔다.
  - 최소한 15~20초 fallback으로 `_finishOpen()` 또는 사용자 오류 메시지를 표시한다.

### P2. BroadcastChannel을 닫지 않아 창 반복 사용 시 리소스 누수 가능

- 위치:
  - 생성: `www/ws30/ws10_20/Popups/versionMng/versionMngFrame.js:749-757`
  - 종료 정리: `www/ws30/ws10_20/Popups/versionMng/versionMngFrame.js:808-815`
- 증상: 창을 여러 번 열고 닫으면 `BroadcastChannel` 인스턴스가 명시적으로 close되지 않는다.
- 영향: Electron 렌더러가 종료되면 대개 정리되지만, remote/ipc 조합의 팝업에서는 이벤트 핸들러 잔존이나 busy broadcast 오동작 리스크가 커진다.
- 권장 조치:
  - `onbeforeunload`에서 `oBroad.onmessage = null; oBroad.close(); oBroad = null;` 처리한다.

### P3. 다른 비교를 실행할 때 이전 diff 내용이 잠깐 노출될 수 있음

- 위치:
  - diff pane 표시: `www/ws30/ws10_20/Popups/versionMng/versionMngFrame.js:458-471`
  - host 표시 class 추가: `www/ws30/ws10_20/Popups/versionMng/versionMngFrame.js:447-450`
- 증상: 한 번 비교 후 diff pane을 닫았다가 다른 버전을 비교하면, 새 서버 응답 전까지 이전 diff host가 이미 `u4aVmHostShown` 상태로 남아 있을 수 있다.
- 영향: busy overlay가 있어도 반투명 배경 때문에 사용자가 이전 비교 결과를 새 결과로 오해할 여지가 있다.
- 권장 조치:
  - 새 비교 시작 시 `u4aVmHostShown` 제거 또는 host에 빈 모델 전송 후 서버 응답 시 다시 표시한다.

### P3. Yes/No/OK 문구가 메시지 키가 아니라 하드코딩되어 있음

- 위치:
  - `_fatal()` OK: `www/ws30/ws10_20/Popups/versionMng/versionMngFrame.js:155`
  - 새창 이동 confirm Yes/No: `www/ws30/ws10_20/Popups/versionMng/versionMngFrame.js:535`
- 증상: 사용자 언어가 KO/EN 외 다른 언어이거나 메시지 정책을 따져야 할 때 버튼 문구가 현지화되지 않는다.
- 영향: `.analy/16`의 “문구는 메시지 키 사용” 원칙과 어긋난다.
- 권장 조치:
  - 기존 공통 메시지 클래스에서 Yes/No/OK 라벨을 조회해 사용한다.

### P3. Version Management 전용 CSS에 고정 rem 폭이 많아 좁은 화면에서 반응형 품질 저하 가능

- 위치: `www/ws30/ws10_20/Popups/versionMng/versionMngFrame.css:132-151`
- 증상: 테이블 컬럼 폭과 최소 폭이 `rem` 고정값 위주로 지정되어 있다.
- 영향: 가로 스크롤 자체는 허용되지만, `.analy/12`의 반응형 원칙 관점에서는 좁은 창/축소 상태에서 비교 버튼, 긴 제목, diff toolbar가 더 쉽게 밀릴 수 있다.
- 권장 조치:
  - 테이블은 스크롤 유지하되 주요 toolbar는 `minmax`, `clamp`, 축약 라벨, overflow menu 등을 검토한다.

## 추가 확인 결과

- `node --check` 기준으로 아래 파일의 문법 오류는 발견되지 않았다.
  - `www/ws30/ws10_20/js/fnVersionManagementPopupOpen.js`
  - `www/ws30/ws10_20/Popups/versionMng/versionMngFrame.js`
  - `www/ws30/ws10_20/Popups/versionMng/host/index.js`
- 단, P1은 문법 오류가 아니라 DOM 구성 누락형 로직 버그라 `node --check`로 잡히지 않는다.

## 우선 수정 순서

1. P1 Target 라디오 append 누락 수정
2. 최초 IF 데이터/busy fallback 추가
3. BroadcastChannel close 정리 추가
4. 새 비교 시작 시 이전 diff 표시 초기화
5. 버튼 문구 메시지 키화 및 반응형 toolbar 보강
