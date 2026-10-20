# UI 추가 팝업 — 확인을 눌러도 busy 가 안 켜지던 것

- 작성 2026-10-20 · 세션 06836675 · type=fix
- 지시: 장군님 「확인 버튼 누르자마자 busy가 안켜지는거 같아 … 생성 건수 100개 등으로 다량 추가 시,
  느린 pc에서는 잠깐 멈췃다가 실행되는 느낌이 난다 … 원본을 비교해서 … 확인 버튼 누르자마자 busy를 켜서 …
  미리보기가 다 그려진 이후에 busy를 끄면 되잖아」

## 1. 실제로 안 켜고 있었다

`www/ws30/ws10_20/js/ws_html5_ws20_edit.js` `lf_confirm`(UI 추가 팝업 확인 단추)은
**자식 창 방송(`BUSY_ON`)만** 보내고 메인 창 busy(`parent.setBusy("X")`)는 켜지 않았다.
메인 창 busy 가 켜지는 자리는 **맨 끝 선택 흐름(`fnWs20SelectUI`) 안쪽** 하나뿐 —
즉 100건 추가 루프·미리보기 생성·렌더 대기가 **전부 끝난 뒤**에야 잠깐 켜졌다 꺼졌다.
그래서 느린 PC 에서 확인 직후 화면이 멈춘 것처럼 보였다.

## 2. 원본은 확인 단추 첫 줄에서 켠다

`U4A_WS_DESIGN/design/insertUIPopop/index.js` 1022~1032행 (확인 단추):

```
parent.setBusy("X");
… TY_BUSY_OPTION.DESC = 215 "디자인 화면에서 UI 추가 처리 작업을 진행하고 있습니다."
parent.require(bindPopupBroadCast)("BUSY_ON", _sOption);
```

같은 파일 755행(결과 표 더블클릭)도 똑같다. 그리고 `design/js/uiDesignArea.js` `designAddUIObject`(5236~)의
**조기취소 분기 6곳이 저마다 `BUSY_OFF` + `setShortcutLock(false)` + `parent.setBusy("")`** 를 부른다 —
즉 원본은 **이 함수에 들어올 때 busy 가 이미 켜져 있다는 전제**다.

성공 경로의 끝(5729~5772)에는 `parent.setBusy("")` 가 **없다**. 끄는 것은 마지막
`await setSelectTreeItem(새 OBJID)` **안쪽**(uiDesignArea.js 2570)이다.

## 3. 순서는 이미 원본과 같다 — 바꾸지 않았다

장군님 말씀 중 「좌측 UI 트리도 먼저 구성하고 그거 기반으로 미리보기 추가」는 **원본과 반대**다.
원본 성공 경로:

| 차례 | 원본 `designAddUIObject` | 우리 이식본 |
|---:|---|---|
| 1 | 루프 안에서 트리 **데이터**에 추가(`zTREE.push`) → 미리보기 생성(`createUIInstance`·`moveUIObjPreView`) | 같음 |
| 2 | `destroyExcepChild` | 같음 |
| 3 | `renderingRichTextEditor` + `rerender()` + **`await` 렌더 종료** | `await _rerenderParentRTE(is_tree)` |
| 4 | `await designRefershModel()` + tree binding `_buildTree` ← **좌측 트리 화면 갱신** | `_refreshTree()` |
| 5 | `await setSelectTreeItem(새 OBJID)` ← **여기 안쪽이 busy off** | `await _selectNode(lastObjid)` |
| 6 | `setChangeFlag()` · `updateBindPopupDesignData()` | 같음 |

**미리보기 반영이 먼저, 좌측 트리 화면 갱신이 나중**이고, 미리보기 렌더 종료 대기(3)는 이미 들어 있다.
그래서 순서는 손대지 않고 **빠진 busy 만 채웠다.**

## 4. 고친 것 — 파일 1개

`www/ws30/ws10_20/js/ws_html5_ws20_edit.js` (1행 주석 `다음 번호: 008` 로)

| 자리 | 내용 |
|---|---|
| `lf_confirm` 맨 앞 | `parent.setBusy("X")` + `_broadBusy(true)` — 원본 1:1 |
| 그 뒤 | `oAPP.common.fnYieldToPaint()` 한 번 — **없으면 busy 가 아예 안 그려진다**(잠그자마자 100번 도는 동기 루프가 이어져 브라우저가 한 번도 paint 하지 못한다) |
| 체인 끝 | `_broadBusy(false)` + `parent.setBusy("")` — 검사에 걸려 되돌아온 경우(선택 흐름을 안 지남)에도 풀리게 |

- `fnYieldToPaint` 가 없으면 `[W20E-007]` 을 던진다. 체인 안에서 던지므로 `.catch` 가 잡고
  마지막 `.then` 이 busy 를 풀어 준다 — **동기 자리에서 던지면 busy 가 켜진 채 남는다.**
- 성공 경로에서는 선택 흐름이 이미 껐으므로 끝의 `setBusy("")` 는 두 번째다 —
  공통 busy 는 깊이를 세지 않으므로(`resources/index.js:1859`) 두 번 꺼도 문제없다.

## 5. 영향도

- `lf_confirm` 호출처 3곳 = 확인 단추 click · 검색칸 Enter · 결과 행 더블클릭. 전부 같은 함수를 지난다.
- `lf_close()` 는 busy 를 건드리지 않는다(닫기·리스너 정리만) — 확인했다.
- `designAddUIObject` 자체는 **한 글자도 안 고쳤다.** 끌어놓기 경로(`js/ws_html5_ws20_dnd.js:969`)는
  자기 잠금을 따로 쓰므로 영향 없다.
- 어제 넣은 「busy 가 닫히기를 기다리는」 대기(`ws_html5_ws20_attr.js` `_waitBusyClosed`)와 충돌하지 않는다:
  선택 흐름 안쪽의 `setBusy("")` 한 번으로 실제로 닫히고(깊이를 안 센다) 그 뒤 대기가 풀린다.

## 6. 또 밟을 함정

- **`setBusy("X")` 만으로는 busy 가 안 보인다.** 바로 뒤에 무거운 동기 로직이 이어지면 브라우저가
  한 번도 그리지 못한다. `oAPP.common.fnYieldToPaint()` 를 한 번 끼워야 한다.
- **Promise 체인 바깥(동기 자리)에서 던지면 busy 가 켜진 채 남는다.** 잠금을 켠 뒤의 예외는
  반드시 체인 안에서 나게 해 `.catch` → 마지막 `.then` 이 풀게 한다.
- 원본은 바인딩 팝업 `BUSY_ON` 에 **안내 문구 215**("디자인 화면에서 UI 추가 처리 작업을 진행하고 있습니다")를
  같이 보낸다. 우리 `_broadBusy` 는 문구 없이 보낸다 — **지시 범위가 아니라 손대지 않았다.**

## 7. 아직 안 한 것

- **앱 테스트 안 했다**(장군님이 직접). 테스트 항목 = `.docs/TODO.md` 1B-5.
- 커밋하지 않았다.

---

# (이어 씀) 생성 건수 입력칸 — 원본에 있는 동작 반영

- 지시: 장군님 「여기는 max값 체크도 없고 입력도 되고 뭐 아무것도 없네」 → 「원본에 있는 내용은 좀 반영을 해라」

## 8. 원본과 대조한 결과

원본 = `U4A_WS_DESIGN/design/insertUIPopop/index.js`

| 줄 | 원본 |
|---:|---|
| 508 | `new sap.m.StepInput({max:CV_MAX_CNT(100), min:1, value:1, description:"Max : 100"})` — **숫자 전용** |
| 512~520 | 값 변경 시 빈 값이면 `setValue(1)` + **`oInp2.focus()`**(UI 오브젝트 검색칸) 후 종료 |
| 526~537 | `parseInt` → 100 초과면 100, 1 미만이면 1 |
| 540~542 | 맞춘 값 `setValue` + **`oInp2.focus()`** |

이식본에 **있던 것**: 1~100 으로 맞추기(`lf_clampCnt`, 값 확정·포커스 빠질 때 · 확인 누를 때 · +/- 단추 누를 때).
이식본에 **빠진 것**: ①숫자 전용(여긴 `type="text"` 라 글자가 쳐졌다) ②값 바꾼 뒤 검색칸으로 포커스 이동.

## 9. 고친 것

`www/ws30/ws10_20/js/ws_html5_ws20_edit.js` — 생성 건수 칸 이벤트 배선 한 곳

- `input` 이벤트에서 숫자가 아닌 글자를 제거 → 원본의 숫자 전용 성격 재현.
- `change` 이벤트에서 1~100 으로 맞춘 뒤 **UI 오브젝트 검색칸으로 포커스 이동**(원본 516~520·540~542행).
- `blur` 는 종전대로 값 맞추기만 — 포커스는 옮기지 않는다(확인 단추를 누를 때 포커스를 뺏으면 안 된다).
- `+`/`-` 단추는 값을 코드로 바꿔 `change` 가 나지 않으므로 포커스가 안 옮겨진다 → 연타가 된다.

## 10. 안 한 것 · 못 본 것

- **「치는 도중에 100 을 넘으면 즉시 100 으로」는 넣지 않았다.** 원본은 값이 확정될 때 맞춘다 —
  즉시 맞추기는 원본에 없는 동작이라 임의로 더하지 않았다.
- `sap.m.StepInput` 의 **내부 동작(+/- 단추가 경계에서 비활성되는지 등)은 소스로 확인하지 못했다** —
  UI5 라이브러리를 CDN 으로 받아 쓰고 있어 로컬에 소스가 없다. 그래서 확인한 원본 코드(위 표)만 반영했다.

## 11. 생성 건수 칸 — 통과 (장군님 확인 2026-10-20 「1B-1 잘됨」)

글자가 안 들어가고, `200` 을 치면 칸을 벗어날 때 100 으로 맞춰지며 커서가 UI 오브젝트 검색칸으로 간다.
`+`/`-` 연타도 1~100 안에서 움직이고 커서가 안 옮겨진다. TODO 1부-B 에서 이 항목을 닫았다.
