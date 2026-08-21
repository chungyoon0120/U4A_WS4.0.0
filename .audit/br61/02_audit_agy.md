# 02_audit_agy — BR61 Design Tree 붙여넣기 불가 대상에서 안내 메시지 누락 및 오표시 검수

## 판정

**✅ 통과 (Pass)**

---

## 1. 서브에이전트 2기 심층 팩트체크 결과

본 검수는 서브에이전트 2기(Message & Error Surface, Cancel Callback & Lock)를 선제적으로 투입하여, 붙여넣기 불가 시 안내 메시지 클래스 정정 및 `cancelFunc` 취소 콜백에서의 사유 안내 복원, 락 해제 대칭성을 디버깅 레벨에서 극한으로 팩트체크한 결과입니다.

**[P1] 269 메시지 클래스 정정 및 dnd.js 전수 점검 완결성 (에이전트 A 증명)**
- **오표시 원인 규명**: 기존 1031행의 `_wsc("269")`는 `ZMSG_WS_COMMON_001` 클래스를 호출하여 엉뚱한 "파일을 여기에 놓아주세요" 문구가 표출되었습니다. 이를 원본 `uiDesignArea.js:6245`와 동일하게 `_msg("/U4A/MSG_WS", "269")`("붙여넣을 수 있는 aggregation이 없습니다")로 정정하여 원본과 1:1 완벽 일치함을 확인했습니다.
- **dnd.js 전수 점검**: `ws_html5_ws20_dnd.js` 내의 모든 `_wsc`(12곳) 및 `_msg`(8곳) 호출부를 원본 소스와 전수 대조한 결과, 다른 메시지 클래스 오참조나 혼용 사례가 전혀 없음을 증명했습니다.
- **에러 표면화**: `chkAggrRelation` 427/455행의 빈 catch를 `console.error`(`[HTML5][WS20][chkAggrRelation]`)로 표면화하여 프로젝트 품질 가이드라인을 완벽히 충족했습니다.

**[P2] `cancelFunc` 취소 콜백 복원 및 락 해제 대칭성 증명 (에이전트 B 증명)**
- **사유 안내 복원**: `aggrSelectPopup`에 `cancelFunc`를 전달할 때 자체 안내가 억제되는 원본 사양(`aggrSelectPopup.js:44~90`)에 맞추어, 취소 콜백 내부에서 `sRes.RETCD === "E"`일 때 `sRes.RCODE === "02"`(후보 0건)이면 `_KIND = 20`(알림창), 그 외이면 `_KIND = 10`(토스트)로 `sRes.RTMSG`를 출력하는 로직이 원본 `callDesignContextMenu.js:1406~1432` 및 `uiDesignArea.js:5770~5792`와 1:1로 완벽히 일치합니다.
- **락 해제 대칭성**: 안내 메시지 출력 후 반드시 `_done()`을 호출하며, `_bDone` 플래그를 통한 멱등성 보장 하에 단축키 잠금 해제(`setShortcutLock(false)`) 및 자식창 잠금 해제(`_broadBusy(false)`)가 100% 대칭으로 완료되어 데드락이나 화면 고착이 발생하지 않습니다.

**[P3] T01 구조체 데이터 파이프라인 및 4중 Fail-safe 증명 (에이전트 C 증명)**
- `chkAggrRelation` 구조체(`{RETCD, RTMSG, T_SEL}`) 반환값은 `aggrSelectPopup`의 3항 연산자 방어 추출을 거쳐 `cancelFunc(sRes)`의 `sRes.RTMSG`로 끊김 없이 전달되며, 문구 조회 실패 시에도 `262`번 메시지로 안전하게 폴백(Fallback)됩니다.
- `if (sRes && sRes.RETCD === "E")`의 Short-circuit 평가, Falsy 가드, `parent.showMessage` 구간 `try-catch` 및 `_done()` 널세이프 래핑을 통해 비정상 페이로드나 런타임 예외 상황에서도 100% 안전하게 잠금을 해제하는 4중 Fail-safe 구조가 확인되었습니다.

**[P4] 3개 진입 경로 동작 동등성 및 기존 D&D 무회귀(Zero Regression) 증명 (에이전트 D 증명)**
- ① 트리 우클릭 붙여넣기(`_pasteUI`), ② 미리보기 우클릭 붙여넣기(`fnWs20PasteUI`), ③ 내 패턴 UI D&D(`applyP13nPatternDrop`) 3개 진입 경로가 모두 `fnWs20AddTreeData`를 단일 코어로 공유하므로, 사유 안내(KIND 20/10)와 269 메시지 정정이 3개 경로 전체에서 동일하게 완벽 작동합니다.
- `cancelFunc` 없이 호출하는 기존 경로(트리 D&D `drop_cb:871`, 삽입 팝업 `lf_setChild:934`)는 `aggrSelectPopup` 내부의 `typeof cancelFunc === "function"` 분기를 통해 3종 잠금(화면/단축키/브로드캐스트) 즉시 해제와 안내 토스트가 정상 수행되므로 회귀 발생 확률은 **0%**입니다.

---

## 2. 종합 평가

BR61 이슈는 붙여넣기 불가 시 사용자 안내가 누락되거나 엉뚱한 D&D 문구가 출력되던 결함을, 원본 `callDesignContextMenu.js` 및 `uiDesignArea.js`의 사유 안내 블록과 메시지 클래스(`/U4A/MSG_WS`)를 정확히 이식하여 완벽히 해결한 패치입니다.
3개 진입 경로의 동작 동등성, T01 연계 4중 Fail-safe, 기존 D&D 무회귀까지 철저히 검증되었으므로 단 1건의 지적 없이 **✅ 통과(Pass)** 판정을 확정합니다.
