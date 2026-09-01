# 02_audit_agy — BR55 실행(Activate) 전 예외 점검 실패 시 fail-closed 및 오류 표면화 검수

## 판정

**❌ 수정 필요 — P1 2건**

---

## 1. 서브에이전트 2기 심층 팩트체크 결과 (2차 종합)

본 검수는 "한번 더 면밀히 분석" 지시에 따라 Codex의 리포트와 병행하여 `fnMultiFooterMsg`의 비동기 렌더러 로딩 실패 시 메인 창 Busy 락 고착 가능성 및 동기 throw 시 자식창 `BUSY_OFF` 누락을 디버깅 레벨에서 극한으로 팩트체크한 결과입니다.

### [P1-1 결함] 오류 목록 창(`fnMultiFooterMsg`)의 비동기 로딩 실패 시 메인 창 Busy 락 영구 고착 (에이전트 C 증명)
- **위치**: `ws_events.js:1554~1566`, `fnDialogPopupOpener.js:2819~2948`
- **결함 내용**:
  1. `ev_pressActivateBtn`은 속성 오류 검출 시 `fnMultiFooterMsg`를 호출한 뒤 메인 창 Busy를 켠 상태로 즉시 종료합니다.
  2. Busy 해제는 오류 목록 창 내부(`Popups/errMsgPopup/index.js`)가 로드 완료된 후 IPC(`SETBUSYLOCK ""`)를 보내는 데 전적으로 의존합니다.
  3. 그러나 `fnMultiFooterMsg`에는 `did-fail-load` 핸들러나 `closed` 이벤트 시점의 busy 해제 안전망이 없어, 파일 누락/로드 실패/조기 닫힘 시 IPC가 절대 오지 않습니다.
- **영향**: 오류 목록 팝업 로딩이 실패하면 `WS20ACT-CHK02` 동기 catch에도 잡히지 않고 메인 창이 영구적으로 Busy Lock 상태로 굳어버리는 **치명적 데드락(Freeze)**이 발생합니다.
- **수정 방안**: `fnMultiFooterMsg`에 `closed` 및 `did-fail-load` 시 본창 busy 해제 및 자식창 `BUSY_OFF`를 수행하는 안전망을 추가하거나, Promise 기반 완료/실패 수명주기로 일원화해야 합니다.

### [P1-2 결함] `fnMultiFooterMsg` 동기 throw 시 자식창 `BUSY_OFF` 누락으로 자식창 영구 잠금 (에이전트 D 증명)
- **위치**: `ws_events.js:1562~1566`, `fnDialogPopupOpener.js:2822~2825`
- **결함 내용**:
  1. `fnMultiFooterMsg`는 진입하자마자 `oAPP.attr.oMainBroad.postMessage({ PRCCD: "BUSY_ON" })`을 쏘아 모든 자식창을 잠급니다.
  2. 이후 BrowserWindow 생성/설정 중 동기 예외가 발생하면 `ws_events.js`의 `WS20ACT-CHK02` catch로 이동합니다.
  3. 그러나 해당 catch 블록은 메인 창의 `oAPP.common.fnSetBusyLock("")`만 호출하고 **자식창 해제 신호(`oMainBroad.postMessage({ PRCCD: "BUSY_OFF" })`)를 전송하지 않습니다**.
- **영향**: 메인 창은 풀리지만 바인딩 팝업, 미리보기 등 모든 자식 창은 `parent.setBusy("X")` 상태로 **영구 잠식(먹통)**됩니다.
- **수정 방안**: `WS20ACT-CHK02` catch 블록에서 `oAPP.attr.oMainBroad.postMessage({ PRCCD: "BUSY_OFF" })`를 호출하도록 보완해야 합니다.

---

### [확인된 정상 범위]
1. `chkExcepionAttr` 미정의 또는 점검 중 예외 발생 시 `WS20ACT-CHK01` 블록을 통해 활성화 서버 Ajax 전송 및 `IS_ACT` 설정을 완벽 차단하는 fail-closed 구조는 확실히 작동합니다.
2. 점검 성공 + 오류 0건 시의 정상 활성화 진행 경로는 원본과 완벽히 일치합니다.
3. 추적 코드 기반 에러 표면화 및 2차 try-catch 격리 로깅은 프로젝트 품질 규칙에 부합합니다.

---

## 2. 종합 평가

BR55 이슈는 예외 점검 실패를 fail-closed로 바로잡고 정상 경로를 원본과 1:1로 맞춘 점은 훌륭하나, **오류 목록 창 로드 실패 시 메인 창 busy 영구 고착(P1-1)**과 **동기 실패 시 자식창 `BUSY_OFF` 누락에 따른 자식창 영구 잠금(P1-2)**의 2건의 락 수명주기 결함이 명확히 확인되었습니다.
두 결함을 보완하는 안전망 추가를 강력 권고하며 **❌ 수정 필요** 판정을 확정합니다.
