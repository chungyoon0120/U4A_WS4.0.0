# 01_request — BR43 검수 요청

## 버그 요약 (노션 이슈 BR43, 화면=WS20 Design)
UI Object Select(UI 추가) 팝업으로 UI를 추가할 때, 대상 aggregation이 **바인딩되어 있고 값이 지정된** 상태에서
추가 개수(Generated Cnt)를 **2개 이상**으로 입력하면, 원본은 **1개만 추가하고 "이미 지정됨" 안내(021)**를
표시한다. 이식본에는 이 개수 제한(clamp)이 누락되어 **입력 개수만큼 전부 추가**된다.

## 검수 대상
- 파일: `www/ws30/ws10_20/js/ws_html5_ws20_edit.js`
- 함수: `oAPP.fn.designAddUIObject` (UI 추가 팝업 confirm → 추가 확정 콜백)
- 추가 위치: 반복 생성 루프 `for (var c = 0; c < cnt; c++)` 직전(약 939행 앞)

## 변경 요약 (원본 대비)
- 원본 `uiDesignArea.js` designAddUIObject 5169~5176:
  ```js
  var ls_0015 = oAPP.attr.prev[is_tree.OBJID]._T_0015.find( a => a.UIATK === is_0023.UIATK && a.UIATY === "3" );
  if(typeof ls_0015 !== "undefined" && ls_0015.UIATV !== "" && ls_0015.ISBND === "X" & l_cnt >= 2){
    l_cnt = 1;
    parent.showMessage(sap, 10, "W", oAPP.common.fnGetMsgClsText("/U4A/MSG_WS", "021", "", "", "", ""));
  }
  ```
- 이식(추가):
  ```js
  var _lsAgg0015 = (oAPP.attr.prev && oAPP.attr.prev[is_tree.OBJID] && oAPP.attr.prev[is_tree.OBJID]._T_0015)
      ? oAPP.attr.prev[is_tree.OBJID]._T_0015.find(function (a) { return a.UIATK === is_0023.UIATK && a.UIATY === "3"; })
      : undefined;
  if (_lsAgg0015 && _lsAgg0015.UIATV !== "" && _lsAgg0015.ISBND === "X" && cnt >= 2) {
      cnt = 1;
      try { parent.showMessage(null, 10, "W", _msgWs("021", "The object is already specified in Aggregation.")); } catch (e) { }
  }
  ```
- HTML5 관용: 개수 변수는 `cnt`(원본 `l_cnt`). 값칸 조회는 원본과 동일(`prev[대상]._T_0015`에서 UIATK 일치·UIATY="3").
  prev/_T_0015 부재 가드 추가. 안내는 같은 파일의 기존 021 사용(`_msgWs("021", ...)` + `parent.showMessage(null,10,"W",...)`)과 동일 방식.

## 검수 포인트 (봐달라는 것)
1. **원본 1:1**: 조건(값 있음 `UIATV!==""` && 바인딩 `ISBND==="X"` && 개수 2↑)·처리(cnt=1)·안내(021)가 원본 5172와 동일한가.
2. **분업 정합성(중요)**: 기존 `chkUiCardinality`(약 909 호출, 정의 850~866)의 ISMLB="X" 분기는 "이미 자식이 있는(idx!==-1)"
   바인딩 칸만 막고 `return true`(전체 차단)한다. BR43 clamp는 그와 **겹치지 않는** 경우(자식 없음 idx===-1 + 바인딩 + 값 + cnt≥2)를
   담당한다. 원본도 chkUiCardinality(5033)와 clamp(5172)를 분리 보유 → 이중 차단·이중 021 없이 상호배타인지 확인.
3. **삽입 위치**: clamp가 반복 루프 직전(개수 확정 후, 노드 생성 이전)에 있어 cnt에 정상 반영되는가. undo push(약 928)·미리보기 변경 이전인지.
4. **값칸 조회 안전성**: `oAPP.attr.prev[is_tree.OBJID]._T_0015` 부재 시 예외 없이 통과(가드)하는가. 조회 대상이 "대상 부모의 그 aggregation 행"이 맞는가(UIATK=is_0023.UIATK, UIATY="3").
5. **메시지**: 021은 원본 키. 새 문구·키 생성 없음, 메시지 DB 무수정.
6. **원본 KEEP-UI5 무수정**: `uiDesignArea.js` 미변경.
7. **범위**: BR43 = 개수 clamp만. BR44(검사 3종 UW03/UW08/UW10 복원)는 별건 — 이번 변경에 미포함.

## 근거
- 원본: `www/ws30/ws10_20/design/js/uiDesignArea.js` designAddUIObject — clamp 5169~5176, chkUiCardinality 호출 5033.
- 원본 chkUiCardinality 정의: `callDesignContextMenu.js`(HTML5 이식은 edit.js 850~866, 021/022 동일).
- `.analy/05_디자인영역.md` (Design Tree UI 추가·검증 규칙).
