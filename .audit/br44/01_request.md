# 01_request — BR44 검수 요청

## 버그 요약 (노션 이슈 BR44, 화면=WS20 Design)
UI Object Select(UI 추가) 팝업으로 UI를 골라 확정할 때, 원본 `designAddUIObject` 에 있던
**추가 가능 여부 검사 3종(UW03 특정부모 전용 / UW08 자식 aggregation 추가금지 / UW10 실제 허용)** 이
HTML5 이식본 `designAddUIObject` 에서 누락되어 있었다. 그 결과 **금지 조합의 UI 가 검증 없이 트리에 유입**된다.
(드래그드롭 직접경로 `dnd.js` 는 이미 동일 3검사를 보유 → 팝업 확정경로만 빠져 경로 간 동작 불일치.)

## 검수 대상
- 파일: `www/ws30/ws10_20/js/ws_html5_ws20_edit.js`
- 함수: `oAPP.fn.designAddUIObject` (UI 추가 팝업 confirm → 추가 확정 콜백)
- 추가 위치: BR35 의 `designChkHiddenAreaUi` 가드 직후(926행) ~ 개인화 조회/`fnWs20PushUndo()`(약 967행) **이전**
  - `_wsc214` 로컬(약 934~940) / ① UW03(942~948) / ② UW08(950~953) / ③ UW10(955~958)

## 변경 요약 (원본 대비)
원본 `uiDesignArea.js` designAddUIObject 는 카디널리티(5033)·UA039(5049)·UA040(5063) 다음에
**UW03(5079) → UW08(5110) → UW10(5142)** 순으로 세 검사를 하고, 실패 시 각각 안내 후 return 한다.
이식본은 카디널리티·UA039(BR14)·UA040(BR35)까지만 있고 세 검사가 빠져 있었음 → 원본 순서·파라미터·메시지 1:1 복원.

```js
// ① UW03 특정 부모 전용 (원본 5079) — designChkFixedParentUI 가 내부에서 306 자체 토스트
if (typeof oAPP.fn.designChkFixedParentUI !== "function") {        // fail-closed(BR35 동일)
    console.error("[HTML5][WS20][insert] designChkFixedParentUI 미정의 — UW03 특정부모 점검 불가, UI 추가 취소");
    return;
}
if (oAPP.fn.designChkFixedParentUI(is_0022.UIOBK, is_tree.UIOBK, is_0023.UIATT) === true) { return; }
// ② UW08 자식 aggregation 추가금지 (원본 5110) — 214 후 취소
if (oAPP.fn.checkDenyChildAggr({ UIOBK: is_tree.UIOBK, UIATT: is_0023.UIATT, CHILD_UIOBK: is_0022.UIOBK }) === true) {
    try { parent.showMessage(null, 10, "E", _wsc214()); } catch (e) { }
    return;
}
// ③ UW10 실제 허용 (원본 5142) — 허용 아니면 214 후 취소
if (oAPP.fn.checkAllowChildAggr({ PUIOK: is_tree.UIOBK, UIATT: is_0023.UIATT, UIOBK: is_0022.UIOBK }) !== true) {
    try { parent.showMessage(null, 10, "E", _wsc214()); } catch (e) { }
    return;
}
```

- **파라미터 형태**: dnd.js 의 기존 3검사 호출부(1276~1290)와 동일.
  `checkDenyChildAggr({UIOBK:부모, UIATT:집계, CHILD_UIOBK:추가UI})`,
  `checkAllowChildAggr({PUIOK:부모, UIATT:집계, UIOBK:추가UI})`,
  `designChkFixedParentUI(추가UI, 부모, 집계)`.
- **메시지**: 214 는 원본 키. `_wsc214()` 로컬이 원본 5116/5148 과 동일하게
  `getWsMsgClsTxt(GLANGU, "ZMSG_WS_COMMON_001", "214", is_0022.UIOBJ, is_tree.OBJID, is_0023.UIATT)` 로 조립.
  UW03 실패 메시지(306)는 `designChkFixedParentUI`(dnd.js:359) 내부에서 자체 토스트 → 여기서 별도 표시 안 함(원본과 동일).
- **busy**: 이 경로의 자식창 잠금/해제는 호출측(팝업 confirm `lf_confirm`, 약 1622~1637)이
  `_broadBusy(true)` → `.then(_broadBusy(false))` 로 담당. 3검사의 early `return;` 은 promise 를 resolve 시켜
  호출측 `.then` 이 잠금을 해제 → BR14/BR35 early return 과 동일(자기해제 없음).

## 검수 포인트 (봐달라는 것)
1. **원본 1:1**: 세 검사의 순서(UW03→UW08→UW10)·조건·파라미터·메시지(214, 306)가 원본 5079/5110/5142 와 동일한가.
2. **214 치환 인자**: `_wsc214` 의 `is_0022.UIOBJ, is_tree.OBJID, is_0023.UIATT` 가 원본 5116/5148 과 동일 순서인가
   (dnd 경로는 `OBJID, OBJID` 를 쓰지만, 삽입 원본은 `UIOBJ, OBJID, UIATT` → 원본 삽입경로 기준으로 맞췄음).
3. **삽입 위치·원자성**: 세 검사가 UA040(BR35) 다음, 개인화 조회 await·`fnWs20PushUndo()` **이전**인가
   (거부는 스냅샷·트리/미리보기 변경 전에 완료 → 되돌리기 오염 없음).
4. **fail-closed 정합**: `designChkFixedParentUI` 미정의 시 통과 대신 취소(BR35 designChkHiddenAreaUi 방어와 동일 결).
   `checkDenyChildAggr`/`checkAllowChildAggr` 는 같은 파일(edit.js 810/822)에 무조건 정의되므로 직접 호출(가드 불요) — 타당한가.
5. **경로 일치**: 팝업 확정경로가 이제 dnd 직접경로(dnd.js 1276~1290)와 동일 3검사를 갖는가(이중검사·중복토스트 없음).
6. **메시지/DB**: 214·306 원본 키만 배선, 새 문구·키 없음, 메시지 DB 무수정.
7. **원본 KEEP-UI5 무수정**: `uiDesignArea.js` 미변경. `node --check` 통과.

## 근거
- 원본: `www/ws30/ws10_20/design/js/uiDesignArea.js` designAddUIObject — UW03 5079, UW08 5110(214), UW10 5142(214).
- HTML5 기존 3검사 참조: `ws_html5_ws20_dnd.js` 1276~1290(이동/복사 공통 검증), `designChkFixedParentUI` 정의 359.
- HTML5 헬퍼 정의: `checkDenyChildAggr` edit.js 810, `checkAllowChildAggr` edit.js 822.
- `.analy/05_디자인영역.md` (Design Tree UI 추가·검증 규칙: 검증 우회 금지).
