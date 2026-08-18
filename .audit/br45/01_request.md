# BR45 검수 요청서

## 검수 대상
- **파일:** `www/ws30/ws10_20/js/ws_html5_ws20_edit.js`
- **함수:** `oAPP.fn.designAddUIObject` 내부 반복 생성 루프 `for (var c = 0; c < cnt; c++)` (약 1002~1050행)
- **기능:** UI 추가 팝업(UI Object Select)으로 UI를 추가할 때, 파일올리기 계열 UI(`sap.ui.unified.FileUploader` = UO01180 / `sap.m.UploadCollection` = UO00469)의 `uploaderUrl` 프로퍼티 예외처리 복원

## 변경 요약 (원본 대비)
- **증상:** UI 추가 팝업으로 파일올리기 계열 UI를 넣으면 `uploaderUrl` 초기값 예외처리가 적용되지 않았다. 끌어놓기(드롭)/붙여넣기로 추가하면 정상.
- **근본 원인:** 원본 `uiDesignArea.js`의 `designAddUIObject` 반복 그리기 루프는 각 노드 그린 뒤 `oAPP.fn.attrUploadUrlException(OBJID, UIOBK)`를 호출한다(원본 5628행, 미리보기 예외 draw 직후). 이식본 `designAddUIObject` 삽입 루프에는 이 호출이 빠져 있었다.
- **형제(정상) 경로:** 드롭/붙여넣기 공용 `_rebuild`(`ws_html5_ws20_dnd.js` 1183행)에는 이미 `attrUploadUrlException` 호출이 존재해 정상 동작.
- **변경 내용:** 삽입 루프에서 미리보기 예외 draw(`prevDrawExceptionUi`) 직후에, 형제 경로와 동일하게 `attrUploadUrlException(l14.OBJID, l14.UIOBK)` 호출을 추가. 함수 존재 가드(`typeof ... === "function"`) 후 호출, 오류는 `console.error`로 표면화(조용한 catch 금지 규칙 준수).

```js
// 미리보기 예외 draw(차트/IFrame 등 — uiPreviewArea 로드 시에만, 가드)
try { if (typeof oAPP.fn.prevDrawExceptionUi === "function") { oAPP.fn.prevDrawExceptionUi(l14.UIOBK, l14.OBJID); } } catch (e) { }
// file uploader 계열 UI 의 uploaderUrl 프로퍼티 예외처리(원본 uiDesignArea.js 5628 — 드롭 형제 경로 dnd.js 와 동일).
try { if (typeof oAPP.fn.attrUploadUrlException === "function") { oAPP.fn.attrUploadUrlException(l14.OBJID, l14.UIOBK); } }
catch (e) { console.error("[HTML5][WS20][insert] attrUploadUrlException:", e && e.message ? e.message : e); }
lastObjid = l14.OBJID;
```

## 검수 포인트
1. **정확성(누락 복원):** 원본 5628행 호출이 삽입 루프의 올바른 위치(미리보기 예외 draw 직후, 노드별)로 이식됐는가. 형제 경로 `ws_html5_ws20_dnd.js` 1183행과 동일한 계약인가.
2. **원본 1:1:** 원본에 없는 동작을 추가하지 않았는가. `attrUploadUrlException` 함수 본체(`ws_html5_ws20_attr.js` 1448행)는 UO01180/UO00469 외에는 즉시 `return`이므로, 다른 UI 추가에는 부작용이 없어야 한다(원본 동일).
3. **가드 적정성:** 미리보기 미로드 환경에서의 존재 가드가 형제 경로 방식과 일치하는가. 조용한 catch 없이 오류 표면화됐는가.
4. **루프 배치:** `cnt`번 반복(다건 추가) 시 각 노드마다 호출되는가(원본 루프 내 위치와 동일).

## 근거
- **원본(읽기전용):** `C:\Users\socce\Documents\Github\U4A_WS_DESIGN\design\js\uiDesignArea.js` `designAddUIObject` 반복 그리기 루프 5628행 `oAPP.fn.attrUploadUrlException(l_14.OBJID, l_14.UIOBK);`
- **형제 경로:** `www/ws30/ws10_20/js/ws_html5_ws20_dnd.js` 1183행(`_rebuild`)
- **함수 정의:** `www/ws30/ws10_20/js/ws_html5_ws20_attr.js` 1448행(UO01180=AT000013501 / UO00469=AT000006316)
- **노션 이슈:** BR45 (UI 추가 팝업 원본 대비 전수 감사 2026-08-14 확정)
- `node --check` 통과
