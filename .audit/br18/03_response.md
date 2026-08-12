# 03_response — BR18 미리보기 "위치 이동" 팝업 (코덱스·안티 검수 반영/반론)

코덱스 4건 + 안티 2건(1건은 코덱스와 동일). 아래 표로 합쳐 처리.

> ★ 2026-08-12 장군님 지시 반영 — 아래 "장군님 지시 후속 반영" 절 참조.
>   초판에서 B·E 를 반론했으나, ① busy 함수 재확인 결과 **깊이 카운팅이 아니라 켜짐/꺼짐 1개 상태**
>   (`resources/index.js:869-886`, 중복 "X" 무시)여서 확정 시 busy ON 복원이 안전, ② "미리강조"는
>   **HTML5 트리가 highlight 를 지원**(`ws_html5_ws20_tree.js:596`)해 재현 가능 → **B·D·E 모두 원본대로 반영**으로 전환.
>   (C=그냥 두기, F·G=반론 유지.)

## 지적 통합 표

| # | 지적(합침) | 검수자 | 처리 | 요지 |
|---|---|---|---|---|
| A | 팝업 열기 실패/생성·배선 중 예외 시 잠금(단축키+로딩표시) 해제 미보장 → 화면 잠김 위험 | 코덱스2 · 안티1 | **반영** | 오픈을 성공확인식으로 바꾸고, 실패/예외 시 DOM 제거+잠금해제+오류로그 후 중단 |
| B | 확정 시 원본의 로컬 로딩표시 ON 누락 → 이동 도중 연타 가능 | 코덱스1 | **반론(별건)** | 로딩표시는 깊이 카운팅. 팝업에 ON만 더하면 이동 끝 공통 방송의 ON/OFF 짝과 겹쳐 오히려 잠김 잔류. 진짜 직렬화는 공통 이동함수 몫(위/아래와 공유) → 장군님 판단 |
| C | 공통 팝업 3종 세트 중 makeDialogDraggable 배선 없음 | 코덱스3 | **반론** | 헤더 드래그는 전역 자동설치(팝업마다 배선 불필요). 참조·자매 팝업 동일. 규칙 문구 갱신 필요(보고) |
| D | Enter 즉시확정·푸터 닫기 안내 키가 원본과 다름 | 코덱스4 | **반영** | Enter→확인버튼 포커스(원본 1:1)로 되돌림, 푸터 닫기 안내 키 원본대로 복원 |
| E | 이동위치 미리강조(designMoveMark) 제거 편차, 사용성 확인 | 코덱스(정상) · 안티(정상) | **반론(유지)** | HTML5 런타임 미로드 확정 → 복원 시 재크래시. 자매도 미사용. 원본 라이브강조 손실은 보고 |
| F | width min(92vw,360px) 상한이 고정폭 0 기준과 문구 충돌 | 코덱스(정상 내 언급) | **반론** | 뷰포트 따라 축소되는 반응형 관용구. 참조 팝업 min(92vw,460px) 동일 수용 |
| G | 동일 위치 확정 시 무조건 콜백 → no-op 갱신·되돌리기 기록. 조기 return 최적화 제안 | 안티2(선택) | **반론(유지)** | 원본은 무조건 콜백(원본 1:1). 코덱스도 "유지가 맞다". 자매만의 최적화라 미적용 |

## 반영 상세 (수정 위치)

파일: `www/ws30/ws10_20/design/js/uiMovePosition.js`

### A. 오픈 실패/예외 종료 경로 보강
- 오픈을 `bOpened` 성공확인식으로 변경. `showModal()` 실패(이미 열림/비부착 등)나 그 전 예외 시,
  `oDlg.remove()` + 잠금해제(단축키·로딩표시) 후 `return`. 실패는 `console.error`로 표면화(조용한 catch 금지).
- 정상 오픈 후에만 잠금해제 + 입력칸 포커스.
- 공통 종료 정리를 `lf_releaseLocks()`로 묶어 모든 종료 분기가 같은 해제에 도달하게 함.
- 근거: `.claude/rules/code.md`(모든 오류 종료 분기 off 짝 필수, 오류 표면화).

### D. Enter·메시지 키 원본 복원
- 숫자 입력칸 Enter → 즉시 확정(`lf_ok`) → **확인 버튼으로 포커스 이동**으로 변경
  (원본 `_uiMovePosition_ui5_asis.js.bak:109-117` `keydown 13 → oBtn1.focus()` 1:1).
- 푸터 닫기 버튼 안내 키 `A41(Cancel)` → **`A39(Close)`**(원본 헤더·푸터 모두 A39. `.bak:59,164`).
- ⚠ 자매 팝업(트리 우클릭 위치이동, `ws_html5_ws20_edit.js:_moveUIPosition`)은 Enter 즉시확정 + 푸터 A41.
  이번 반영으로 **두 위치이동 팝업 동작이 어긋남**. 원본 1:1을 우선해 미리보기 쪽을 원본에 맞췄으나,
  **두 팝업을 통일할지(어느 방향으로) 장군님 판단 필요**. 자매 파일 수정은 이 검수 범위 밖.

## 반론 상세 (근거)

### B. 확정 시 로컬 로딩표시 ON
- 원본 `.bak:138` 확인 시 `parent.setBusy("X")` 는 성공경로에 짝 OFF가 없어 **그 자체가 잔류**(BR18 2차 증상의 근원. 코덱스도 원본 누수 인정).
- 셸 로딩표시(`resources/index.js:setBusy` → 유틸)는 **ON 횟수만큼 OFF 필요한 깊이 카운팅**(BR18 계측치: ON 3 / OFF 2 → 1건 잔류로 잠김).
- 확정 위임 대상 공통 이동함수(`callDesignContextMenu.js:contextMenuUiMove`)는 끝에서 `updateBindPopupDesignData` 왕복으로
  로컬 로딩표시 ON/OFF **짝을 스스로 맞춘다**(`design/bindPopupHandler/broadcastChannelBindPopup.js:586 ON → 602/BUSY_OFF 왕복 OFF`).
  여기에 팝업이 ON을 하나 더 얹으면 깊이가 안 맞아 **오히려 화면이 잠긴 채 남는다**.
- 승인된 자매 팝업 `_moveUIPosition` 도 팝업에서 로컬 로딩표시를 켜지 않음(자식창 방송만).
- 결론: 팝업 단독으로는 반영 불가. "이동 전 구간 연타 직렬화"는 공통 이동함수가 자기 async 전체를
  로컬 로딩표시+try/finally로 감싸야 하는 사안(위/아래 이동과 공유 → BR17/공통 범위). **장군님 판단 요청.**

### C. makeDialogDraggable
- 헤더 드래그는 `u4a-ui.js:873-877`에서 **전역 자동설치**(document 위임 1개, "팝업마다 배선 불필요, 한 번 설치=전체 적용").
- 참조 팝업(`createEventPopup.js:550-553`)·자매 팝업(`_moveUIPosition:1619-1621`) 모두 `makeDialogRecenter`+`makeDialogResizable`만 호출.
- `.claude/rules/code.md`의 "3종 세트" 문구는 전역 자동설치 도입 이전 표현으로 보임 → **규칙 문구를 현행(드래그=전역 자동)에 맞게 갱신 필요**(보고). 실동작은 MP7로 확인.

### E. designMoveMark(이동위치 미리강조)
- 정의는 `uiDesignArea.js:4831`, 이를 로드하는 유일 지점은 `design/js/main.js:1934`인데 **`main.js`는 HTML5 런타임 미로드**
  (`prev.js:384`·`edit.js:900` 이 "main.js 미정의라 재구현" 명시) → `designMoveMark` **미존재**. 호출 시 BR18과 동일 재크래시.
- 자매 팝업도 미사용. 따라서 제거 유지가 맞음. 단 **원본의 슬라이더 이동 중 대상위치 강조 UX는 손실**(보고). 복원하려면 HTML5 대체 구현이 별건 필요.

### F/G. 반응형 폭 / 동일위치 콜백
- `min(92vw,360px)`는 고정 px 폭이 아니라 뷰포트 따라 축소되는 반응형. 참조 팝업 동일 관용구.
- 동일 위치 확정 무조건 콜백은 원본(`.bak:136-158`) 그대로. 원본 1:1 유지.

## 남은 판단 대기 (장군님)
1. **B**: 위/아래·위치이동 공통 이동함수의 "이동 전 구간 로컬 로딩표시+예외해제" 직렬화를 별건으로 손볼지(BR17/공통 영향).
2. **D**: 두 위치이동 팝업(미리보기/트리)의 Enter·닫기 안내 동작을 통일할지, 통일 시 방향.
3. **C**: 공통 규칙 문구(팝업 3종 세트) 갱신.
4. **E**: 이동위치 미리강조 UX 복원 필요 여부(HTML5 대체 구현 별건).

## 장군님 지시 후속 반영 (2026-08-12) — "원본대로"

장군님 판단: B=원본대로, C=그냥 두기, D=원본대로 통일, E=원본대로. 이에 따라 초판 반론 2건(B·E)을 원본대로 전환.

| # | 최종 처리 | 수정 |
|---|---|---|
| B | **반영** | busy 는 켜짐/꺼짐 1개 상태(중복 "X" 무시, `resources/index.js:869-886`)로 재확인 → 초판의 "깊이 카운팅" 전제가 틀렸음. 확정 시 `parent.setBusy("X")` 복원(원본 `.bak:138`). 이동 동안 연타 차단, 이동 끝 공통 왕복이 1회 off 로 해제. 콜백 즉시 실패 시엔 팝업이 off. |
| D | **반영(양쪽)** | 미리보기 팝업(`uiMovePosition.js`) + 트리 팝업(`ws_html5_ws20_edit.js:_moveUIPosition`) 둘 다 Enter→확인버튼 포커스, 푸터 닫기 키 A39 로 통일(원본 1:1). |
| E | **반영(양쪽)** | "미리강조"를 HTML5 로 재현. HTML5 트리가 `highlight`(Indication02/04/08)를 렌더(`ws_html5_ws20_tree.js:596`)하므로, 원본 designMoveMark 로직(이동가능=04·대상자기=08·대상위치=02)을 각 팝업 로컬 `lf_moveMark`로 이식 + `fnRenderDesignTree` 재렌더. 오픈 시 초기강조·슬라이더/숫자 변경 시 갱신·닫기 시 원복. ※ 원본의 대상 라인 자동 스크롤(`designSetScrollPosOBJID`)은 HTML5 공개 함수가 없어 강조 색만(스크롤 제외). |
| C | 그냥 두기 | 규칙 문구 미변경. |
| F·G | 반론 유지 | 상동. |

### 수정 파일(후속)
- `www/ws30/ws10_20/design/js/uiMovePosition.js`: `lf_moveMark` 추가·오픈/입력/닫기 배선, 확정 시 busy ON, (Enter/A39 는 초판서 반영됨).
- `www/ws30/ws10_20/js/ws_html5_ws20_edit.js` `_moveUIPosition`: `lf_moveMark` 추가·배선, Enter→포커스, 푸터 A39.

### 남은 참고
- **미리강조 성능**: 슬라이더를 끌 때마다 트리 전체를 다시 그린다(원본도 매 변경 시 갱신). 큰 트리에서 버벅이면 조이기(throttle) 검토 — 실화면 확인 후 판단.
- **동일 위치 확정**: 미리보기 팝업=원본대로 무조건 위임(콜백), 트리 팝업=조기 return 유지(자매 기존). 이 차이는 남김(원본 미리보기 경로 기준 충실).

## 실화면 발견 — 확정 시 2차 crash (getTreeIndexOfChild) 수정

장군님 실화면 테스트에서 확인 클릭 시 `[Critical Error] TypeError: oAPP.fn.getTreeIndexOfChild is not a function`
(saveActionHistoryData ← contextMenuUiMove ← lf_callback ← lf_ok). **BR17 과 동일 crash** 이나 BR17 위임 래퍼
(`prev.js:lf_installPreviewMoveDelegate`)는 위/아래(sign, pos 미지정)만 우회하고 **위치 이동(pos 지정)은 원본 통과**로
남겨둬(당시 UI5 팝업이 loadLibrary 로 먼저 죽어 이 경로가 드러나지 않았음), HTML5 팝업으로 고치자 이제 도달해 터졌다.

수정(원본 파일 무수정, HTML5 만):
- `ws_html5_ws20_edit.js`: 트리 위치이동의 이동 로직을 공용 `oAPP.fn.fnWs20MoveUIToIndex(oNode, iTarget)` 로 추출
  (스냅샷 되돌리기 + 미리보기 반영 + 선택 + 변경플래그 + 바인딩팝업 반영 + 자식창 BUSY 짝, 동일위치 no-op). `_moveUIPosition` 도 이 함수 사용.
- `ws_html5_ws20_prev.js`: BR17 위임 래퍼에 **pos 지정(위치 이동) 경로도 `fnWs20MoveUIToIndex` 로 위임** 추가.
- `uiMovePosition.js`: 확정 시 부모 BUSY 제거 — 이동이 동기(즉시)라 연타 틈이 없고, 트리 위치이동 팝업과 동일
  (부모 BUSY 를 걸면 동일위치 no-op 경로에서 해제 짝이 없어 오히려 잠김). 이동 중 짧은 잠금은 updateBindPopupDesignData 왕복이 자체 처리.

## 검증
- `node --check` — `uiMovePosition.js` · `ws_html5_ws20_edit.js` · `ws_html5_ws20_prev.js` 셋 다 통과.
- 실화면 MP1~ / RS1~ 은 앱 재시작 후 테스트 대기(`.works/미리보기위치이동/00_현황판.md`).
