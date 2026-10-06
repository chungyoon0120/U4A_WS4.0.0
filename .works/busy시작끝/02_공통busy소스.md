# busy 공통 소스 위치

> 조사 2026-09-15. 작업 폴더 `www/` 기준, `_` 로 시작하는 백업 파일·폴더는 뺐다. 코드는 안 고쳤다.

## 1. 메인 창 공통 — 이 두 파일이 전부다

| 파일 | 함수 | 하는 일 |
|---|---|---|
| `www/ws30/resources/index.js` | `setBusy(bIsBusy, oOptions)` (1658줄) | **모든 화면이 부르는 입구.** 옵션(object)을 주면 `oWS.utill.fn.setBusyDialog`, 없으면 `oWS.utill.fn.setBusy`. 끌 때는 둘 다 끈다 |
| 〃 | `oWS.utill.fn.setBusy(sIsBusy)` (893줄) | 실제 본체. 이미 켜져 있으면 다시 켜지 않음 → `body` 의 pointerEvents 차단 → 포커스 저장·해제(끌 때 복구) → `attr.oBusy.open()/close()` → 메인 닫기 버튼 막기·풀기 → 작업표시줄 progress bar |
| 〃 | `oWS.utill.fn.setBusyDialog(sIsbusy, oOptions)` (987줄) | 상태값 `attr.isBusy` 저장 + 작업표시줄 progress bar만. 화면 표시는 안 한다 |
| 〃 | `setDomBusy(bIsBusy)` (1619줄) | `<dialog id="u4aWsBusyIndicator">` 를 `showModal()` / `close()`. ESC 로 안 닫히게 막음. 단순 켜기·끄기(깊이 세기 없음) |
| 〃 | `getBusy()` (1686줄) / `oWS.utill.fn.getBusy` (1146줄) | 현재 상태값 반환 |
| 〃 | `setNetworkBusy(bIsBusy, iZindex)` (1779줄) / `oWS.utill.fn.setNetworkBusy` (1368줄) | 네트워크 끊김 전용 화면(`#u4a_neterr`). 일반 busy 와 별개 |
| 〃 | 새창 열기 안 `_releaseBusy` (587줄) | 새창 열기 도중 걸린 busy 를 한 번만 끄는 지역 함수 |
| `www/ws30/ws10_20/js/ws_html5_shell.js` | `oAPP.fn.fnCreateDummyBusy()` (230줄) | 옛 UI5 `BusyDialog` 흉내. `open()` → `parent.setDomBusy("X")`, `close()` → 제목·문구 비우고 `parent.setDomBusy("")`. 이 객체가 `attr.oBusy` 에 들어간다(대입 = `ws_main.js` 1101줄) |
| 〃 | `oAPP.common.fnSetBusyLock(isbusy, sDesc)` (357줄) | 옛 이름 유지용 통로. `sDesc` 있으면 `parent.setBusy("X", {DESC})`, 끌 때 `parent.setBusy("")` |

화면 모양: `www/ws30/ws10_20/index.html` 113줄 `<dialog id="u4aWsBusyIndicator">`(스피너 + 제목 + 문구).

### 호출 흐름

```
화면 코드 → parent.setBusy("X")
          → oWS.utill.fn.setBusy("X")
          → attr.oBusy.open()            (ws_html5_shell.js 더미)
          → parent.setDomBusy("X")       (<dialog>.showModal())
```

`oAPP.common.fnSetBusyLock` 은 맨 앞에 한 단계 더 붙는 통로다.

## 2. 공통이 아닌 것 — 창마다 따로 가진 busy

같은 이름의 `<dialog>`/요소를 쓰지만 **각자 자기 파일 안에 따로** 만든 것이다.

| 파일 | 함수 |
|---|---|
| `www/ServerList_v2/ServerList.js` | `oAPP.fn.setBusyIndicator` (242줄), `oAPP.setBusy` (263줄) |
| `www/ws30/ws10_20/extopen.js` | 160줄 부근 `u4aWsBusyIndicator` 직접 제어 |
| `www/ws30/ws10_20/Login/Login.js` | 826줄 `parent.document` 의 busy 요소 직접 참조 |
| 별창 팝업 frame 들 | `Popups/*/frame.js` 등의 `_setBusy` / `oAPP.fn.setBusy` (bindPopup·docPopup·findPopup·editorPopup·errPageEditorPopup·runtimeClassNavigator·patternPopup·fontStyleWizard·versionMng·mimeRepository·OTRF4HelpPopup·errMsgPopup·optionPopup·dataMonitor·ShortCutCreator·design/attrPresetPopup 등) |
| 메인 안 팝업 여는 파일들 | `fnAppF4PopupOpen.js`·`fnBindPopupOpen.js`·`fnP13nDesignPopupOpen.js`·`fnUiTempWizardPopupOpen.js`·`fnMimePopupOpen.js`·`fnCtsPopupOpen.js`·`fnDialogPopupOpener.js` 의 `_busy`/`_setBusy` — 전부 **1절 공통을 부르는 얇은 감쌈** |

`www/ws30/ws10_20/js/moduleAppF4Popup.js` 24줄에도 `oAPP.common.fnSetBusyLock` 이 따로 정의돼 있다(같은 이름 재정의).

## 3. 참고로만 — busy 를 읽기만 하는 곳

- `www/ws30/ws10_20/js/ws_html5_logger.js` 611~619줄: busy 요소가 열려 있는지 로그용으로 확인만 한다.
