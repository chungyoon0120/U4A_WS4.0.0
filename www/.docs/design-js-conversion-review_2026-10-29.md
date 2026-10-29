# UX 디자인 JS 문제점 및 데이터 관리 구조 검토

## 우선 검토할 작업

1. 미리보기 오류 발생 시 끝나지 않는 Promise 대기를 개선한다(R01).
2. 서로 다른 table의 경로를 통과시키는 바인딩 검증을 개선한다(R02).
3. 속성 변경 함수가 실제 처리 완료까지 기다리도록 반환 흐름을 정리한다(R03).
4. UI 구조와 속성 데이터의 기준 저장소를 정하고, 중복 보관·갱신 불일치를 정리한다(D01, D02).
5. 반복 탐색, 전체 Undo snapshot, 종료되지 않는 timer의 비용을 측정하고 개선한다(D03, R07, R06).

> 작성일: 2026-10-29 / 작업: Codex
>
> 이 문서는 문제 분석 결과이며, 제품 소스에 수정 사항을 반영한 기록이 아니다.
> 아래 우선순위는 수정 검토 순서에 대한 제안이며, 실서비스 장애 등급을 의미하지 않는다.

## 1. 요청 및 비교 기준

- `www/ws30/ws10_20/design`의 기존 로직에서 버그, 성능 문제 및 잘못된 로직을 확인한다.
- 현재 WS 4.0의 변환 코드가 같은 문제를 유지하는지, 변환 과정에서 다른 문제가 생겼는지 판단한다.
- 앱 조회 후 design tree를 구성하면서 같은 내용을 광역 변수에 중복 보관하는 구조도 확인한다.
- 사용자가 지정한 기준은 **현재 WS 4.0 작업 폴더의 `design/`**이다. 이를 변경 이력이 없는 WS 3.0 원본이라고 간주하지 않는다.

검토 대상의 주요 파일:

- 기존 로직: `design/js/main.js`, `uiDesignArea.js`, `uiAttributeArea.js`, `uiPreviewArea.js`
- 직접 재사용되는 로직: `design/preview/index.js`, `design/js/previewRender/setOnAfterRender.js`, `design/undoRedo/undoRedo.js`
- 변환 코드: `js/ws_html5_ws20_data.js`, `ws_html5_ws20_attr.js`, `ws_html5_ws20_prev.js`, `ws_html5_ws20_tree.js`, `ws_html5_ws20_edit.js`, `ws_html5_ws20_dnd.js`, `ws_html5_ws20_wizard.js`

WS 4.0은 변환된 JS와 `design/` 아래에서 직접 불러오는 JS를 함께 사용한다. 따라서 `design/`를 수정해도 실행되지 않는 부분과, 해당 폴더의 코드가 그대로 실행되는 부분을 구분해야 한다.

## 2. 검증 수준과 해석

| 구분 | 의미 |
|---|---|
| 소스 확인 | 실제 대입, 복사, 호출 및 갱신 경로를 확인했다. |
| 격리 재현 | 실제 소스의 함수 또는 검증식을 추출하고, 의존성을 모의 구성하여 해당 동작을 확인했다. |
| 합성 데이터 측정 | 임의로 구성한 데이터로 복사 비용 및 직렬화 크기를 확인했다. 실사용 앱 측정이 아니다. |
| 실화면 미검증 | SAP 연결 상태에서 사용자 조작, UI5 렌더링, 저장 결과까지 확인하지 않았다. |

핵심 실행 경로를 대상으로 검토했다. 전체 JS에 대한 무결함 보증이나 모든 조합의 전수 검증은 아니다. 조건을 주입한 재현은 해당 조건에서의 코드 동작을 입증하지만, 실제 환경의 발생 빈도까지 입증하지는 않는다.

## 3. 문제 목록

| ID | 우선순위 | 내용 | WS 4.0 판정 | 근거 수준 |
|---|---|---|---|---|
| R01 | 높음 | 오류 발생 시 미리보기 Promise가 완료되지 않음 | 기존 문제 유지, 직접 재사용 | 격리 재현 |
| R02 | 높음 | 바인딩 경로의 구성요소 경계를 확인하지 않음 | 변환 코드에도 같은 검증 유지 | 검증식 격리 재현 |
| R03 | 높음 | 속성 예외처리 완료 전에 호출자에게 반환 | 기존 처리 순서와 다른 변환 코드 | 격리 재현 |
| R04 | 중간 | 대기 중 추가된 비동기 작업이 공유 목록에서 소실 | 기존 문제 유지, 직접 재사용 | 조건부 격리 재현 |
| R05 | 중간 | JS 로딩 실패를 호출자에게 알리지 않음 | 변환 로더에도 유지 | 실패 응답 격리 재현 |
| R06 | 중간 | NetworkGraph DOM 확인 timer가 무기한 유지될 수 있음 | 기존 코드 직접 사용 | DOM 미생성 조건 재현 |
| R07 | 중간 | 작은 변경에도 앱 전체 Undo snapshot 복사 | 변환 코드의 성능 위험 | 소스 확인·합성 측정 |
| D01 | 중간 | UI 구조를 평면 배열과 별도 tree로 계속 보관 | 기존 구조 유지 | 객체 동일성·변경 격리 재현 |
| D02 | 높음 | 전체 속성과 UI별 속성 목록의 갱신 방식 불일치 | 기존 구조 유지 | 기존 함수 격리 재현 |
| D03 | 중간 | UI마다 전체 속성 목록을 반복 탐색 | 기존 코드 직접 사용 | 소스 확인 |

### R01. 오류 발생 시 미리보기 Promise가 완료되지 않음

**문제**

`refreshPreview`는 `new Promise(async (resolve) => ...)` 안에서 비동기 작업을 수행한다. executor 내부에서 발생한 오류가 바깥 Promise의 실패로 연결되지 않아 호출자는 계속 기다릴 수 있다.

렌더링 보조 함수도 `u4aWaitASyncLoaded()`와 `Promise.all(taskPromiseStack)`의 성공 처리만 연결한다. 내부 Promise가 실패하면 대기 중인 바깥 Promise가 완료되지 않을 수 있다.

**영향 및 재현**

- tree 조회 의존성에서 오류를 발생시키면 `refreshPreview`가 성공·실패 어느 쪽으로도 완료되지 않았다.
- 라이브러리 로딩 Promise를 reject시켜도 바깥 대기는 pending으로 남았다.
- WS 4.0의 UI 선택 처리는 이 함수를 `await`한다. 바깥 `catch`만으로는 완료되지 않는 Promise에서 빠져나오지 못한다.
- Busy 및 후속 선택 처리가 멈출 가능성이 있다. 실제 화면 장애 발생은 미검증이다.

**개선 방향**

불필요한 Promise wrapping을 제거하고 오류를 호출자에게 전달한다. 렌더링 이벤트 미발생, UI 삭제, 화면 이탈에도 대기를 종료하고 등록한 이벤트를 정리하는 계약이 필요하다.

**소스 근거**

- [design/preview/index.js](../ws30/ws10_20/design/preview/index.js): `refreshPreview`, 검토 시 3983행
- [setOnAfterRender.js](../ws30/ws10_20/design/js/previewRender/setOnAfterRender.js): `awaitPreviewExcepionUI`, 489~514행
- [ws_html5_ws20_attr.js](../ws30/ws10_20/js/ws_html5_ws20_attr.js): `fnWs20DesignTreeItemPress`의 `await refreshPreview`, 3635행

### R02. 바인딩 경로의 구성요소 경계를 확인하지 않음

**문제**

부모 경로와 자식 경로의 앞부분 문자열만 비교한다. `ROOT-TABLE`에 대해 `ROOT-TABLE2-FIELD`도 같은 부모 경로로 통과한다.

**재현 및 영향**

| 부모 경로 | 자식 경로 | 현재 검증 결과 | 기대 |
|---|---|---|---|
| `ROOT-TABLE` | `ROOT-TABLE-FIELD` | 통과 | 통과 |
| `ROOT-TABLE` | `ROOT-TABLE2-FIELD` | 통과 | 거부 |

격리 실행한 것은 경로 검증식이다. 나머지 바인딩 조건도 만족하면 다른 table의 필드를 막지 못할 수 있으나, SAP 저장 결과까지 확인한 것은 아니다.

**개선 방향**

경로를 구분자로 나눈 구성요소 단위로 비교한다. 같은 형태의 prefix 비교가 있는 관련 경로도 함께 점검한다.

**소스 근거**

- [uiAttributeArea.js](../ws30/ws10_20/design/js/uiAttributeArea.js): 8808행, 8949행
- [ws_html5_ws20_attr.js](../ws30/ws10_20/js/ws_html5_ws20_attr.js): 6722행, 6757행

### R03. 속성 예외처리 완료 전에 호출자에게 반환

**문제**

기존 `attrChange`는 `attrChangeException` 완료를 `await`한다. 변환된 `fnWs20AttrChange`는 해당 작업을 `.then()`으로 시작한 뒤 먼저 반환한다. 예외처리가 값을 직접 처리하지 않아 정규 처리로 이어지는 경우에도 그 후속 호출의 완료를 바깥 호출자에게 연결하지 않는다.

**재현 및 영향**

예외처리 Promise를 미완료로 유지했을 때, 호출자의 `await fnWs20AttrChange(...)`가 먼저 끝났고 내부 Busy 상태는 남아 있었다. 해당 경로를 사용하는 연속 처리에서는 앞 작업의 실제 완료를 보장할 수 없다.

**개선 방향**

예외처리와 필요한 후속 값 반영을 하나의 반환 Promise에 연결한다. 정상 완료·사용자 취소·오류에 대한 반환 규약과 Busy 해제 책임을 함께 정리한다.

**소스 근거**

- [uiAttributeArea.js](../ws30/ws10_20/design/js/uiAttributeArea.js): 1845~1855행
- [ws_html5_ws20_attr.js](../ws30/ws10_20/js/ws_html5_ws20_attr.js): 4419~4445행

### R04. 대기 중 추가된 작업이 공유 목록에서 소실

**문제**

`Promise.all(taskPromiseStack)` 시작 후 완료 콜백에서 공유 목록 전체를 `[]`로 교체한다. 대기 도중 추가된 작업은 이번 `Promise.all`의 대상이 아니지만, 목록 초기화 때 함께 제거된다.

**재현 및 영향**

작업 A를 기다리는 중 작업 B를 등록하고 A만 완료했다. B는 pending인데 대기 함수가 완료됐고 공유 목록은 빈 배열이 됐다. 실제 라이브러리가 대기 중 작업을 추가하는 상황에서 렌더링 완료 판단이 빨라질 수 있다.

**개선 방향**

이번 대기 대상만 공유 목록에서 분리한다. 이후 등록되는 작업은 보존하고, 추가 작업까지 기다려야 하는 동작인지 명확하게 정한다.

**소스 근거**

- [setOnAfterRender.js](../ws30/ws10_20/design/js/previewRender/setOnAfterRender.js): 509~514행

### R05. JS 로딩 실패를 호출자에게 알리지 않음

**문제**

기존 `getScript`와 변환 로더 모두 HTTP 200일 때만 완료 콜백을 실행한다. 실패 응답, 네트워크 오류, timeout, 실행 오류에 대한 호출자 측 실패 전달 계약이 없다.

**재현 및 영향**

404 응답을 구성하면 완료 콜백이 호출되지 않았다. 이를 기다리는 기능이 후속 진행이나 실패 정리로 넘어가지 못할 수 있다. 예를 들어 위자드 생성 헬퍼를 지연 로드하는 경로가 이 로더를 사용한다.

**개선 방향**

성공·실패 중 하나로 반드시 완료되는 로딩 API를 사용하고, 실패 시 기능별 Busy·잠금 정리를 연결한다.

**소스 근거**

- [main.js](../ws30/ws10_20/design/js/main.js): `getScript`, 289행
- [ws_html5_ws20_prev.js](../ws30/ws10_20/js/ws_html5_ws20_prev.js): `getScript`, 197행
- [ws_html5_ws20_wizard.js](../ws30/ws10_20/js/ws_html5_ws20_wizard.js): `_wizEntry`, 91행

### R06. NetworkGraph DOM 확인 timer의 종료 조건 부족

**문제**

NetworkGraph의 `_preprocessData`를 덮어쓴 코드가 100ms마다 DOM을 찾는다. DOM을 찾으면 종료하지만, 끝내 생성되지 않거나 UI가 삭제되는 경우의 취소·상한 처리가 없다. timer 핸들은 함수 내부 지역 변수에만 있다.

**재현 및 영향**

DOM을 반환하지 않는 조건에서는 반복 확인 후에도 timer가 해제되지 않았다. 같은 처리가 반복 진입하면 timer가 추가로 남을 수 있다. 실제 CPU·메모리 증가량은 측정하지 않았다.

**개선 방향**

UI 생명주기와 연결해 취소하고, 재진입 시 이전 timer를 정리한다. 대기 상한 도달 시 원인을 기록한다.

**소스 근거**

- [design/preview/index.js](../ws30/ws10_20/design/preview/index.js): 3341~3354행

### R07. 작은 변경에도 앱 전체 Undo snapshot 복사

**문제**

기존 속성 Undo는 변경 대상의 속성을 중심으로 기록한다. 변환 코드는 tree 전체, UI별 속성 전체, 클라이언트 이벤트, 설명을 snapshot으로 복사하고 최대 50개를 보관한다. 속성 변경 경로도 이 snapshot을 사용한다.

**합성 데이터 측정**

| node 수 | node당 속성 | snapshot 1개 JSON 크기 | 50개 단순 환산 |
|---|---|---|---|
| 100 | 8개 | 74,385 bytes | 3,719,250 bytes |
| 1,000 | 8개 | 752,985 bytes | 37,649,250 bytes |
| 5,000 | 8개 | 3,808,985 bytes | 190,449,250 bytes |

직렬화 크기이며 실제 heap 사용량이 아니다. 측정 데이터는 실제 앱이 아니며, 고객 PC의 정지 시간으로 해석하면 안 된다. 다만 이력 개수와 앱 전체 크기에 비례해 메모리 및 복사 비용이 커지는 구조는 확인된다.

**개선 방향**

변경 대상 중심의 이력 저장을 검토한다. 먼저 실제 대형 앱에서 속성 변경·Undo·Redo의 시간과 heap을 측정한다.

**소스 근거**

- [undoRedo.js](../ws30/ws10_20/design/undoRedo/undoRedo.js): `CL_CHANGE_ATTR.setActionHistoryData`, 1947행
- [ws_html5_ws20_edit.js](../ws30/ws10_20/js/ws_html5_ws20_edit.js): `_snapshot`, 186행 / `fnWs20PushUndo`, 663행
- [ws_html5_ws20_attr.js](../ws30/ws10_20/js/ws_html5_ws20_attr.js): 속성 변경 시 snapshot 적재, 4400행

## 4. 앱 조회 후 광역 데이터 관리 구조

### 4.1 현재 보관 관계

```text
서버 응답 param.APPDATA
  └─ oAPP.DATA.APPDATA                    같은 객체 참조
      ├─ T_0014 ── oModel.oData.TREE      같은 배열 참조
      │             └─ 전체 JSON 복사
      │                 └─ oData.zTREE   별도 node 객체로 만든 편집 tree
      └─ T_0015
          └─ OBJID별 filter()
              └─ prev[OBJID]._T_0015      배열은 별도, 초기 행 객체는 공유

선택한 UI → oModel.oData.T_ATTR           속성 화면용 행과 편집 상태
```

**이름이 여러 개라는 이유로 모두 전체 복사라고 판단하면 안 된다.** `APPDATA` 대입과 `TREE` 대입은 참조 연결이고, `zTREE` 생성은 실제 전체 복사다. `filter()`는 별도 배열을 만들지만 행 객체를 복사하지 않는다.

### D01. 평면 UI 구조와 별도 tree의 중복 유지·최신 상태 불일치

**확인 내용**

1. `APPDATA.T_0014`를 `oModel.oData.TREE`에 그대로 연결한다.
2. `setTreeData`가 전체 JSON 복사 후 `zTREE`를 구성한다.
3. 이후 UI 추가·이동 등은 `zTREE`를 변경한다.
4. 저장은 `zTREE`를 다시 평면 배열로 변환한다.

기존 함수 격리 실행 결과:

| 확인 항목 | 결과 |
|---|---|
| `TREE === T_0014` | `true` |
| `zTREE` node와 원래 평면 행의 객체 동일성 | `false` |
| tree node의 설명을 변경한 뒤 평면 행의 설명 | 이전 값 유지 |
| tree에 node를 추가한 뒤 평면 배열 건수 | 이전 건수 유지 |

**판단**

- `TREE`는 주 조회 흐름에서 tree 생성을 위한 중간 연결 역할이다. 이름 정리 후보지만, 이 참조 하나를 제거하는 것만으로 큰 메모리 절감이 생기지는 않는다.
- 실제 중복은 평면 UI 행과 별도 복사된 tree node를 함께 유지하는 부분이다.
- 조회 당시 데이터와 현재 편집 데이터를 구분하는 목적이라면 별도 보관이 가능하다. 그러나 각 사용처가 어느 시점의 데이터를 읽는지 명확해야 한다.
- 현재 평면 데이터를 UI5 library 목록과 오류 로그 경로에서도 읽는다. 특히 편집 후 오류 로그가 이전 구조를 따라갈 수 있다. 실제 로그 오기록 사례는 미검증이다.
- WS 4.0 변환 코드도 같은 연결과 전체 복사 방식을 유지한다.

**개선 방향**

현재 UI 구조의 기준 저장소를 하나로 정한다. 평면 저장 데이터는 저장·전송 시 생성하고, 초기 library 정보는 필요한 시점에 추출한다. 조회 원본 snapshot이 필요하면 용도와 수명을 명시한다. 사용처 전환 없이 `T_0014`나 `TREE`를 바로 삭제해서는 안 된다.

**소스 근거**

- [main.js](../ws30/ws10_20/design/js/main.js): 508~542행, `setTreeData` 395행, 저장 1118행
- [uiDesignArea.js](../ws30/ws10_20/design/js/uiDesignArea.js): tree에 복사 UI 추가, 2694~2700행
- [uiPreviewArea.js](../ws30/ws10_20/design/js/uiPreviewArea.js): `getUi5Libraries`, 432행
- [design/preview/index.js](../ws30/ws10_20/design/preview/index.js): `lf_uiTreeRows`, 5107행
- [ws_html5_ws20_data.js](../ws30/ws10_20/js/ws_html5_ws20_data.js): 전체 복사 94행, 데이터 연결 264~299행

### D02. 전체 속성과 UI별 속성 목록의 갱신 방식 불일치

**확인 내용**

`APPDATA.T_0015.filter(...)`로 UI별 속성 배열을 구성한다. 초기 행 객체는 공유하지만, 편집 동작별 갱신 결과가 다르다.

| 동작 | UI별 목록 | 전체 목록 |
|---|---|---|
| 기존 행의 값 변경 | 반영 | 공유 객체이므로 함께 반영 |
| 신규 속성 추가 | `push()`로 반영 | 자동 추가되지 않음 |
| 기존 속성 삭제 | `splice()`로 제거 | 해당 행이 그대로 남음 |

기존 `attrChgAttrVal`을 격리 실행해 값 변경·추가·삭제를 확인했다. 추가 후 전체 목록 1건/UI별 목록 2건이었고, 삭제 후에는 전체 목록과 UI별 목록에 서로 다른 속성이 남았다.

**판단**

전체 목록을 조회 원본이라고 보기 어렵다. 기존 행의 값은 바뀌기 때문이다. 현재 편집본이라고 보기도 어렵다. 추가·삭제가 따라오지 않기 때문이다. 읽는 위치에 따라 다른 결과가 나올 수 있는 구조다.

`drawPreview`는 UI별 속성을 다시 수집해 전체 `T_0015`를 교체한다. 즉 상시 일치하는 구조가 아니라 특정 시점에 재구성하는 구조다. WS 4.0에도 같은 UI별 목록 구성 방식이 유지돼 있다.

**개선 방향**

현재 속성의 기준 저장소를 하나로 정하고, 모든 추가·수정·삭제가 그 저장소를 거치게 한다. UI별 접근은 같은 기준 데이터를 가리키는 index로 처리한다. 서버 원본 비교가 필요하면 변경하지 않는 snapshot으로 분리한다.

`prev`는 UI5 인스턴스도 관리하므로 통째로 불필요하다고 판단하면 안 된다. UI 인스턴스 관리와 저장 속성의 기준 데이터 관리를 구분해야 한다.

**소스 근거**

- [design/preview/index.js](../ws30/ws10_20/design/preview/index.js): UI별 목록 구성 5226~5240행, 전체 목록 재구성 5290~5297행
- [uiAttributeArea.js](../ws30/ws10_20/design/js/uiAttributeArea.js): 값 변경·추가 5403~5435행, 삭제 5486행·5498행
- [ws_html5_ws20_attr.js](../ws30/ws10_20/js/ws_html5_ws20_attr.js): `_ensurePrev`, 2463행 / 값 변경·추가 2068~2100행 / 삭제 2151행·2163행

### D03. UI마다 전체 속성 목록을 반복 탐색

**문제**

미리보기의 `setUIScript`는 각 UI를 생성할 때마다 전체 `T_0015`를 `filter()`한다. UI가 N개, 전체 속성이 M개이면 이 분류 단계는 약 N×M번 비교한다.

**판단 및 개선 방향**

조회 직후 속성을 OBJID별로 한 번 분류하면 반복 탐색을 줄일 수 있다. index가 기존 행을 참조하도록 만들면 속성 행 전체를 추가 복사할 필요도 없다. 단, D02의 추가·삭제 갱신 규칙도 함께 정리해야 한다. index만 추가하고 갱신하지 않으면 또 다른 오래된 목록이 된다.

**소스 근거**

- [design/preview/index.js](../ws30/ws10_20/design/preview/index.js): `setUIScript`, 5553~5561행

### 4.2 별도 보관 자체가 문제라고 보기 어려운 항목

- `T_ATTR`: 선택한 UI의 속성, 기본값, visible/editable, 입력 오류 등 화면 편집 상태를 구성하므로 별도 역할이 있다.
- `prev[OBJID]`: 미리보기 UI5 인스턴스를 보관하는 역할이 있다. 속성 데이터가 붙어 있다는 이유만으로 삭제할 수 없다.
- Undo/Redo 이력: 이전 상태 보관은 필요하다. 문제는 변경 범위에 비해 앱 전체를 반복 복사하는 비용이다.
- 팝업 전송 데이터: 별도 창으로 전달하기 위한 일시적 직렬화는 필요할 수 있다. 같은 데이터의 장기 보관과 구분해야 한다.

## 5. 수정 시 검증해야 할 내용

아래는 이번에 완료한 실화면 테스트가 아니라, 수정 이후 필요한 검증 항목이다.

| 대상 | 검증 내용 |
|---|---|
| 미리보기 대기 | 정상 완료, 내부 오류, 라이브러리 실패, UI 삭제, 화면 이탈에서 Promise와 Busy가 종료되는지 |
| 바인딩 경로 | 이름의 prefix가 같은 서로 다른 table과 정상 하위 필드를 구분하는지 |
| 속성 변경 | 예외처리 대상 속성을 연속 처리해도 앞 작업 완료 후 다음 작업이 수행되는지 |
| 비동기 작업 목록 | 대기 중 새 작업이 추가돼도 소실되지 않는지 |
| JS 로딩 | 파일 누락·오류 응답·실행 오류에서 실패 전달과 잠금 정리가 이뤄지는지 |
| timer | DOM 미생성, UI 삭제, 반복 진입 시 잔여 timer가 없는지 |
| 구조 데이터 | UI 추가·이동·삭제·이름 변경 후 화면, 저장 payload, 오류 로그 경로가 같은 현재 구조를 사용하는지 |
| 속성 데이터 | 기존 값 수정·신규 추가·삭제·초기화 후 저장·미리보기 재구성 결과가 같은지 |
| 이력 | Undo/Redo 후 구조와 속성이 함께 복원되고 대형 앱에서 시간·heap이 허용 범위인지 |
| 대형 앱 | 최초 조회·미리보기 생성의 반복 탐색 횟수, 복사 시간, heap을 실제 데이터로 비교하는지 |

## 6. 이번 작업의 산출 및 한계

- 기존 대화에서 수행한 소스 대조, 격리 재현 및 합성 측정 결과를 이 문서에 정리했다.
- 이번 문서 생성 단계에서 제품 소스를 수정하거나 SAP 실화면 테스트를 실행하지 않았다.
- 재현 코드는 Node 표준입력으로 실행했으며 프로젝트에 회귀 테스트 파일로 저장하지 않았다.
- 소스 행 번호는 검토 시점 기준이다. 이후 수정 시 함수명과 실제 코드로 다시 확인한다.
- 확인되지 않은 발생 빈도, 실제 heap 사용량, 고객 PC의 지연 시간은 확정값으로 제시하지 않는다.

## 9. 추가 조사: sap-user / sap-password 파라미터 처리 SOURCE

확인 기준: 2026-10-29. 사용자가 제공한 추가 조사를 정리하고, 현재 소스의 파라미터 구성 위치를 다시 확인했다. 실제 사용자 ID·비밀번호 값은 조회하거나 기록하지 않았다.

### 9-1. callFavIconPopup.js — CSS·폰트 URL query 구성

SOURCE: `ws30/ws10_20/design/js/callFavIconPopup.js`

| 함수 / 검토 시 행 | 처리 내용 |
|---|---|
| `lf_setFavListData()` / 399~425 | 초기 데이터의 T_CSS(CSS URL 목록), T_STYLE(extension icon font 목록)을 구성해 child로 전달한다. |
| `lf_setLoginParam()` / 520~536 | `parent.getUserInfo()`가 undefined이면 빈 문자열을 반환한다. 정보가 있으면 UNAME을 sap-user에, PW를 sap-password에 넣어 query를 구성한다. |
| `lf_setExtensionIconList()` / 436~474 | UA053에서 FLD04가 X가 아닌 항목을 읽는다. 451행에서 query를 구성해 467행 woff2 URL 뒤에 붙인다. |
| `lf_setFavIconListCSSLink()` / 544~624 | resource 경로·theme를 정하고 592행에서 query를 얻어 sap.ui.core, sap.ushell, sap.tnt의 library.css에 붙인다. 조합 위치는 599·609·619행이다. |
| `lf_setURLPrePath()` / 484~512 | host와 UA025의 UI5 bootstrap 경로를 합치고 sap-ui-core.js를 제거해 CSS resource URL 앞부분을 구성한다. |

```javascript
// 실제 값 대신 소스 필드명만 표시한다.
let _sUserInfo = parent.getUserInfo();
if (typeof _sUserInfo === "undefined") {
    return "";
}
_param = `sap-user=${_sUserInfo.UNAME}&sap-password=${_sUserInfo.PW}`;
```

```text
{UI5 resource 경로}sap/ui/core/themes/{theme}/library.css?{로그인 query}
{UI5 resource 경로}sap/ushell/themes/{theme}/library.css?{로그인 query}
{UI5 resource 경로}sap/tnt/themes/{theme}/library.css?{로그인 query}
{host}{UA053.FLD03}/{UA053.FLD02}.woff2?{로그인 query}
```

사용 시점은 즐겨찾기 리스트 초기 데이터 구성이다. child 화면은 CSS href로 link를 만들고 fontURI로 @font-face src를 구성한다. 관련 소스는 `design/favIconPopup/index.js`의 157~161행(T_CSS/T_STYLE), 255~269행(font style), 327~331행(link/href)이다.

`lf_setLoginParam()`은 필드 값을 query에 직접 연결한다. 해당 코드 안에서 encodeURIComponent 또는 URLSearchParams를 사용하지 않는다. 사용자 정보가 없으면 빈 query를 반환하지만 URL 조합부의 물음표는 남는다.

### 9-2. callP13nDesignDataPopup.js — 개인화 미리보기 POST form

SOURCE: `ws30/ws10_20/design/js/callP13nDesignDataPopup.js`

| 함수 / 검토 시 행 | 처리 내용 |
|---|---|
| `oPrevNav.attachAfterNavigate` / 370~387 | frameLoaded 확인 후 최초에는 lf_loadP13nPrevHTML을 실행하고, 이후에는 기존 iframe 내용을 갱신한다. |
| `lf_loadP13nPrevHTML()` / 1022~1081 | 접속 정보를 얻고 대상 iframe을 위한 POST form을 만든다. action은 host + `/zu4a_wbc/u4a_ipcmain/getP13nPreviewHTML`이다. |
| 로그인 파라미터 / 1051·1054 | sap-user=l_info.ID, sap-password=l_info.PW를 hidden input으로 추가한다. 즐겨찾기의 UNAME과 다른 ID 필드를 읽는다. |
| `lf_setParam()` / 820~828 | hidden input의 name/value를 설정해 form에 추가한다. URL 문자열에 직접 연결하는 방식이 아니라 브라우저 form submit이다. |
| 동반 파라미터 / 1045~1069 | sap-client, sap-language, LIBPATH, LIBRARY, THEME, LANGU, CALLBACKFUNC도 함께 구성한다. |
| 전송·정리 / 1072~1078 | form을 document.body에 추가하고 submit한 후 setTimeout(..., 0)에서 제거한다. |

```javascript
var l_info = parent.getUserInfo();
oForm.setAttribute("method", "POST");
oForm.setAttribute("target", l_dom.id);
oForm.setAttribute("action",
    parent.getHost() + "/zu4a_wbc/u4a_ipcmain/getP13nPreviewHTML");
lf_setParam(oForm, "sap-user", l_info.ID);
lf_setParam(oForm, "sap-password", l_info.PW);
document.body.appendChild(oForm);
oForm.submit();
```

이 경로의 sap-user / sap-password는 해당 form의 POST 파라미터로 전달된다.

### 9-3. 지정 SOURCE와 현행 WS4.0 대응 SOURCE의 차이

| 구분 | 지정 design/js SOURCE | 현행 WS4.0 대응 SOURCE |
|---|---|---|
| 즐겨찾기 아이콘 | CSS·woff2 URL query에 sap-user / sap-password를 추가한다. | `js/fnFavIconPopupOpen.js`는 두 query를 추가하지 않는다. 주석은 Electron session cookie 인증을 의도하지만 실제 cookie 전송·인증 성공은 미검증이다. |
| 개인화 미리보기 | POST form에 ID / PW를 설정한다. | `js/fnP13nDesignPopupOpen.js`에도 같은 POST 파라미터 구성이 남아 있다. iframe·bootstrap helper 등 준비 조건을 충족한 경우 실행한다. |

현행 소스 위치:

- `js/fnFavIconPopupOpen.js`: 313~334행(extension font), 388~391행(CSS). 두 위치 모두 로그인 query를 추가하지 않는다.
- `js/fnP13nDesignPopupOpen.js`: lf_loadPrevHTML(), 557~594행. sap-user는 583행, sap-password는 584행, submit은 592행이다.

### 9-4. 데이터 흐름과 확인 범위

두 파일 모두 로그인 정보는 `parent.getUserInfo()`에서 얻는다. 이 파라미터 구성 코드 자체는 APPDATA.T_0014 / T_0015 또는 prev[OBJID]._T_0015에서 로그인 정보를 읽거나 해당 배열을 변경하지 않는다. UI 개인화·아이콘 resource 요청의 별도 인증 파라미터 처리다.

이번 추가 조사는 처리 위치와 흐름의 문서화이다. 파라미터 제거, 제품 소스 변경, 실제 인증 요청 및 cookie 검증은 수행하지 않았다.

### Notion 반영

이 문서의 분석 결과와 추가 조사 9-1~9-4를 2026-10-29에 아래 페이지의 기존 본문 아래에 요약 추가했다. 일정·진행 상태 등 속성은 변경하지 않았다.

- [U4A WS3.0 불필요한 전역 설정 및 잘못된 로직 보정](https://app.notion.com/p/U4A-WS3-0-4076587b06ef81e4a24be66fa0bd30cd)
