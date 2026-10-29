# USP — 고친 뒤 다른 파일을 고르면 묻지 않고 **말없이 버리던 것**

- 날짜: 2026-10-29
- 지시: 장군님 「원래 에디터에서 값입력하고 다른 파일 선택하면 변경된게 있습니다 팝업 왜 안뜨냐」 →
  「이거 원본에도 있는데 ws4.0에서는 안되고 있다고」
- 고친 자리: `js/usp/ws_html5_usp.js`(검사 + 저장 후 열기 분기) · `js/usp/ws_html5_usp_tree.js`(클릭 핸들러)

## 증상

USP 에서 파일을 고쳐 놓고 왼쪽 트리에서 다른 파일을 누르면 **아무것도 묻지 않고** 바로 열린다.
**고친 내용이 말없이 사라진다.**

## 원인 — 변환 때 **의식적으로 생략**했다

원본 `ws_usp.js:4605` `ev_uspTreeItemDblClickEvent`:

```js
var IS_CHAG = getAppChangeWs30();
if (IS_CHAG == 'X') {
    var sMsg = APPCOMMON.fnGetMsgClsText("/U4A/MSG_WS", "119");   // Save before leaving editor?
    parent.showMessage(sap, 40, 'W', sMsg, _fnSaveBeforeLeavEditMsgCb.bind(this, oRow));
    oAPP.fn.fnChildWindowShow(false);
    oAPP.common.fnSetBusyLock("");
    return;
}
fnUspTreeTableRowSelect(oRow);
```

HTML5 쪽에는 이 검사가 **통째로 없다.** 그리고 생략한 흔적이 주석 두 곳에 남아 있었다.

| 자리 | 주석 |
|---|---|
| `ws_html5_usp.js:789` | 「(AFPRC 신규/Rename, **ISROW 분기는 컨텍스트메뉴 CRUD 영역(미구현)이라 발생 안 함 → 생략**)」 |
| `ws_html5_usp.js:1507` | 「트리 미저장 변경 복원 = 구 fnResetUspTree 는 **노드 이동 미구현**이라 현재 불필요」 |

`ISROW` 가 바로 이 확인창의 「저장하고 그 행 열기」 경로이고,
「노드 이동」이 장군님이 말씀하신 **파일 전환**이다. 둘 다 「안 쓴다」고 보고 뺀 것이다.

## 전수 확인 — 다른 자리에는 살아 있다

USP 의 확인창 자리를 전부 봤다. **파일 전환에만** 빠져 있었다.

| 자리 | 확인창 |
|---|---|
| 뒤로가기(F3) | 있음 (`ws_html5_usp.js:518`) |
| Change ↔ Display 모드 전환 | 있음 (`ws_html5_usp.js:1848`) |
| 우클릭 → 생성 · 삭제 · 이름변경 | 있음 (`ws_html5_usp_ctxmenu.js:250·278·300`) |
| **트리에서 다른 파일 클릭** | **없었다** |

`ws_html5_usp_tree.js` 에는 `IS_CHAG` 가 **git 이력상 한 번도 들어간 적이 없다.**

## 고친 방법 — 원본의 세 갈래를 그대로

`oAPP.fn.fnUspAskBeforeOpen(oNodeData)` 를 새로 두고 클릭 핸들러가 그것을 부른다.

| 답 | 하는 일 | 원본 대응 |
|---|---|---|
| (검사) 변경분 없음 · Display 모드 | 묻지 않고 바로 연다 | 동일 |
| **YES** | 저장하고, 저장이 끝나면 그 파일을 연다 | `oSaveBtn.firePress({ISROW: oRow})` |
| **NO** | 변경을 버리고(에디터 원복 + 플래그 해제) 그 파일을 연다 | `setAppChangeWs30("") + fnResetUspTree` |
| **CANCEL** | 아무것도 안 한다. 숨긴 별창만 되살린다 | 동일 |

저장 콜백에는 `AFPRC === "_OPEN"` 분기를 더했다 — 기존 `_C`(생성) · `_RN`(이름변경) 과 같은 모양이다.

### ★ 검사를 넣은 자리가 중요하다

**클릭 핸들러**에 넣었다. 파일을 읽는 함수(`fnUspTreeTableRowSelect`) 안에 넣으면
**루트 자동 선택**(`ws_html5_usp.js:706`)과 **신규 노드 추가 후 선택**(`1182`)에서도 확인창이 떠 버린다.
그 함수는 세 군데서 불린다.

### 버리지 않은 것

원본의 NO 경로는 `fnResetUspTree()` 로 **트리 모델까지** 원복한다. HTML5 에는 그 함수가 없고,
대신 `fnUspSaveCancel()` 이 **에디터 내용과 변경 플래그**를 원복한다. HTML5 는 파일을 열 때
**서버에서 다시 읽어 오므로**(`fnUspTreeTableRowSelect` → `usp_get_object_line_data`)
트리 원복이 없어도 화면 내용은 맞는다. 그래서 `fnUspSaveCancel` 로 대신했다.

## 곁다리로 드러난 것 (고치지 않았다)

**`fnChildWindowShow` 가 어디에도 정의돼 있지 않다.** 쓰는 곳이 전부
`if (typeof oAPP.fn.fnChildWindowShow === "function")` 으로 감싸고 있어 **조용히 안 돈다**
(`ws_html5_usp.js` · `ws_events.js` · `ws_fn_02.js`). 확인창이 뜨는 동안 별창을 숨기는 기능이
아예 없다는 뜻이다. 기존 코드와 같은 모양으로 맞췄으므로 이번 수정으로 나빠지는 것은 없다.
**별개 건이라 보고만 한다.**

## 또 밟을 함정

- **주석에 「미구현이라 발생 안 함 → 생략」이 적혀 있으면 의심한다.** 그 판단이 틀리면
  기능이 통째로 사라지고, 사용자는 **데이터를 잃고 나서야** 안다.
- **같은 기능이라도 진입 경로마다 따로 있다.** USP 는 확인창이 6곳인데 그중 한 곳만 빠져 있었다.
  「뒤로가기에서는 뜨니까 된다」로 판정하면 틀린다.
- 검사를 **공통 함수 안쪽**에 넣지 말 것. 그 함수를 부르는 다른 경로(자동 선택 등)가 같이 걸린다.

## 미검증

- **앱으로 돌려 보지 않았다.** `node --check` 두 파일 통과. 테스트 = TODO 1-22 · 1-23 · 1-24.
- **YES 경로(저장 후 열기)** 는 `AFPRC "_OPEN"` 분기를 새로 만든 것이라 특히 봐야 한다.
  저장이 실패하면 그 파일이 안 열리고 busy 가 어떻게 되는지도 1-24 에서 드러난다.
