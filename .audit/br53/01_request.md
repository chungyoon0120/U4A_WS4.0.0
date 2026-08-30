# BR53 검수 요청 — 미등록 서버이벤트 콤보 오류 시 해당 행 이동·포커스 누락

## 1. 이슈 (노션 이슈 리포트 DB, 코드=BR53, 화면=UI 속성 영역)

- **현상**: 원본은 등록되지 않은 서버 이벤트가 선택된 콤보에 대해 `setAttrFocus(UIATK, "E")` 를 호출해
  그 행으로 스크롤 + 포커스 + ATTR 상단영역 접힘을 수행한다
  (원본 `design/js/uiAttributeArea.js:1126~1129`).
  WS4.0 HTML5 는 콤보를 펼칠 때(`onOpen`) 인라인으로 `valueState=error` 만 설정하고
  그 행으로의 화면 이동·포커스가 없다.
- **통과 기준**: 원본처럼 오류 시 그 속성 줄로 이동·포커스한다.
- 분류 = UX, 상태 = 접수(수정완료 변경은 장군님 테스트 통과 후).

## 2. 검수 대상

| 파일 | 함수/위치 | 내용 |
|---|---|---|
| `www/ws30/ws10_20/js/ws_html5_ws20_attr.js` | `oAPP.fn.setAttrFocus` (3247행~) | 3번째 인자 `oOpt` 추가(`bKeepRow`), 이동·포커스 대상 선택자 교정, 빈 catch 표면화 |
| 〃 | `_attrWaitScrollIdle()` (3184행~, 신설) | 속성 목록 스크롤이 멎을 때까지 대기 |
| 〃 | 이벤트 DDLB(`UIATY==="2"`) `oSelOpts.onOpen` (5655행~) | 미등록 판정 분기에서 `setAttrFocus(UIATK,"E",{bKeepRow:true})` 호출 + 목록 펼치기 전 스크롤 대기 |

- 백업: `www/ws30/ws10_20/js/_ws_html5_ws20_attr.js.br53bak`
- 원본 파일 수정 0건(내 파일 1개만 수정).
- `node --check` 통과.

## 3. 변경 요약 (원본 대비)

### (1) 오류 시 그 행으로 이동·포커스 — 원본 1:1 복원

원본 `uiAttributeArea.js:1126~1129`:

```js
//서버이벤트가 존재하는경우 현재 선택된 값이 서버이벤트 목록에 없는경우 오류 표현 처리.
if(_sAttr.UIATV !== "" && _aEvent.findIndex(item=>item.KEY === _sAttr.UIATV) === -1){
  oAPP.fn.setAttrFocus(_sAttr.UIATK, "E");
}
```
(그 뒤 1148행 `_oUi.open()` 으로 콤보를 편다. 즉 **이동·포커스가 먼저, 펼치기가 나중**.)

HTML5 는 같은 판정 자리(미등록 이벤트 분기)에서 `setAttrFocus(sAttr.UIATK, "E", {bKeepRow:true})` 를
호출하도록 추가했다. 호출 순서도 원본과 같이 **이동·포커스 → 목록 펼치기**.

`setAttrFocus` 는 원본(8244행)대로 진입 시 `valst`/`valtx` 를 먼저 비우고 TYPE 에 따라 `valst` 만 세우므로,
HTML5 가 쓰는 안내문구(`valtx`, 미등록 이벤트 문구)는 `setAttrFocus` **호출 뒤에** 다시 채우도록 순서를 잡았다.

### (2) `bKeepRow` — 행을 다시 그리지 않는 모드 신설

원본 `setAttrFocus` 는 상태 변경 후 `oAPP.attr.oModel.refresh()`(8271행)만 한다 →
UI5 는 컨트롤 인스턴스를 유지한 채 바인딩 값만 갱신하므로 **콤보 인스턴스가 살아 있다**.

HTML5 `setAttrFocus` 는 대응으로 `fnWs20AttrRows()` 재렌더(행 DOM 전체 재생성)를 한다.
그런데 이 호출 지점은 콤보의 **"펼치기 직전" 콜백** 안이라, 여기서 행을 다시 그리면
지금 열리려는 콤보 DOM 이 통째로 교체되고, 공통 콤보(`theme/u4a-ui.js` `createSelect`)의
`_open()` 이 **떨어져 나간(detached) 엘리먼트** 기준으로 펼침목록 위치를 계산하게 된다.

→ 이 경로에만 `bKeepRow:true` 를 주어 재렌더를 건너뛰고, 선택 표시(`aria-selected`)만
행 DOM 에 직접 지정한다(기존 선택 제거 후 지정 = 단일 선택). 다른 호출처(무인자·2인자)는 종전 그대로 재렌더.
선택키 보관(`oAPP.attr._attrSelUiatk`, BR52)은 두 모드 공통이라 이후 재렌더에서도 강조가 유지된다.

### (3) 이동·포커스 대상 선택자 교정

원본 8300~8330행은 값 셀(`CELL_INFO === "ATTR_CHANGE"`) 안에서 **UITYP**
(`INPUT` / `COMBOBOX` / `BUTTON` / `CHECKBOX`)으로 값 컨트롤을 고른 뒤 그 컨트롤에
`scrollIntoView` + `focus` 한다.

종전 HTML5 는 `oRow.querySelector("input, select, textarea, button")` 이었다.
공통 콤보는 `div.u4a-combo`(tabIndex=0) 이므로 **DDLB 행에서는 이 선택자에 걸리지 않고**,
대신 뒤쪽 아이콘 칸의 `<button>`(바인딩/도움말 아이콘)이 걸리거나 아무것도 안 걸렸다.
→ 값 칸(`.u4aWs20AttrRowVal`) 안의 값 컨트롤(콤보 포함)을 찾도록 교정.
못 찾으면 종전대로 행을 이동시킨다(회귀 방지).

### (4) 펼침목록이 스스로 닫히는 문제 차단

공통 콤보는 `_open()` 시 `window` 에 `scroll`(capture) 리스너를 걸어 **바깥이 스크롤되면 목록을 닫는다**
(`theme/u4a-ui.js` `_onScrollClose`).
이동(스크롤)을 만든 직후 곧바로 목록을 열면, 그 스크롤 신호가 열린 뒤에 도착해 목록이 즉시 닫힌다.
(스크롤 이벤트는 비동기 dispatch — `onOpen` 의 Promise 는 마이크로태스크로 먼저 resolve 되어 `_open()` 이 앞선다.)

→ 이동이 있었던 경우에만(`bMoved`) `_attrWaitScrollIdle()` 로 **실제 스크롤 위치를 프레임마다 읽어**
3프레임 연속 변화가 없으면(최대 40프레임) 끝난 것으로 보고 목록을 편다. 고정 대기시간이 아니다.

또한 `_attrHeaderExpanded(false)`(ATTR 상단영역 접힘)는 `ws20AttrScroller.scrollTop` 을 직접 바꾸므로
이 역시 위 대기의 대상이다.

### (5) 빈 catch 표면화

`setAttrFocus` 말미의 `catch (e) { }` → `console.error(...)` (`.claude/rules/code.md` "오류 삼킴 금지").

## 4. 검수 포인트

1. **[최우선] 펼침목록 동작 회귀 없음**
   - 정상(등록된 이벤트) 값일 때 `bMoved=false` → 대기 없이 종전과 동일하게 즉시 펼쳐지는가.
   - 미등록 값일 때 이동 후 목록이 정상적으로 펼쳐지고, 펼침목록 최상단 오류문구가 그대로 보이는가.
   - `_attrWaitScrollIdle()` 이 어떤 경우에도 resolve 되는가(최대 40프레임 상한). 미해결 Promise 로 콤보가
     `data-loading="true"` 에 갇혀 다시 못 여는 경우가 없는가.
2. **원본 1:1 여부**
   - 호출 순서(이동·포커스 → 펼치기)가 원본 1148행과 같은가.
   - `setAttrFocus` 가 `valtx` 를 비우는 원본 동작을 HTML5 안내문구가 덮어써도 되는지
     (원본은 `valtx` 를 채우지 않음 — HTML5 는 콤보 밸류스테이트 문구를 쓰므로 재설정).
   - 값 컨트롤 선택자 우선순위가 원본 UITYP 판정(INPUT→COMBOBOX→BUTTON→CHECKBOX)과 어긋나지 않는가.
     (현재는 CSS 선택자 나열이라 **DOM 순서**로 첫 매치를 잡는다. 값 칸에 컨트롤이 2개 이상 들어가는
     행 유형이 있으면 원본과 달라질 수 있음 — 실재 여부 확인 요청.)
3. **`bKeepRow` 부작용**
   - 재렌더를 건너뛰므로 `valst` 변경이 화면에 반영되지 않는 경로가 생기지 않는가
     (이 경로는 콤보에 직접 오류표시를 걸므로 무해하다고 판단 — 반증 요청).
   - `aria-selected` 직접 지정과 재렌더 복원(BR52) 사이에 불일치가 생기지 않는가.
4. **다른 호출처 영향 0 확인**
   - `setAttrFocus` 3인자 추가가 기존 호출부(2인자·1인자)에 영향 없는가.
   - 유일한 다른 호출부인 `fnWs20SelectUI`(3581행, `setAttrFocus(oOpt.UIATK, oOpt.TYPE)` — 2인자)가
     종전 그대로 재렌더 경로를 타는가. (전수 grep 결과 실제 호출부는 이 1곳 + 이번 신규 1곳뿐)
5. **BR52 회귀**
   - 선택 강조 유지/해제(같은 UI 재렌더 유지, 다른 UI 전환 시 해제) 계약이 그대로인가.
6. **잠금·busy**
   - `getServerEventList(fnOk, false)` 는 콜백 전에 `parent.setBusy("")` 로 화면잠금을 이미 푼다.
     그 뒤 대기(최대 40프레임) 동안 잠금이 없는 상태가 원본과 어긋나지 않는가(원본도 `setBusy("")` 가
     `setAttrFocus` 뒤·`open()` 앞 1148행 근처, 순서 차이 확인 요청).
7. **오류 표면화**: 새로 추가한 `console.error` 들이 조용한 삼킴 없이 코드와 함께 나오는가.

## 5. 근거

- 원본(as-is, 읽기전용): `C:\Users\socce\Documents\Github\U4A_WS_DESIGN\design\js\uiAttributeArea.js`
  - 1087~1148행 — 이벤트 콤보 펼치기 경로(목록 조회 → 매핑 → 모델 갱신 → 미등록이면 `setAttrFocus(UIATK,"E")` → `open()`)
  - 1313~1344행 — F4 키 경로(같은 구조)
  - 8186~8360행 — `setAttrFocus` 본체(valst 초기화 → TYPE 분기 → `oModel.refresh()` → 행 선택 →
    값 셀에서 UITYP 로 값 컨트롤 검색 → `attrHeaderExpanded(false)` → `scrollIntoView(smooth,nearest)` →
    `requestAnimationFrame` focus)
- 공통 콤보: `www/ws30/ws10_20/theme/u4a-ui.js` `createSelect` (`_requestOpen`/`_open`/`_onScrollClose`)
- 규칙: `.claude/rules/code.md`(원본 1:1·원본 파일 수정금지·오류 삼킴 금지·`node --check`),
  `.analy/15_공통_입력UX_가이드.md` §3.5.5(콤보 밸류스테이트 공통)
