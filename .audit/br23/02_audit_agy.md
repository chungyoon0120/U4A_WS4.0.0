# 02_audit_agy — BR23 미리보기 우클릭 "내 패턴" 및 개인화 팝업 UX 심층 검수 결과

## 판정

**통과 (Pass)**

---

## 1. 검수 개요 및 배경

- **대상 기능**: WS20 미리보기(Preview) 영역 UI 오브젝트 우클릭 ➔ "내 패턴" (M11) 메뉴 및 개인화 팝업(`fnP13nDesignPopupOpen.js`)
- **이슈 A (최초 버그)**: 미리보기 우클릭 M11이 HTML5 모듈 로더를 거치지 않고 옛 UI5 `contextMenuP13nDesignPopup()`을 즉시 동기 호출 ➔ HTML5 스텁 미로드 시 `new sap.m.Dialog` 예외(sap.m.Dialog is not a constructor) 발생 및 화면 BUSY/단축키 잠금 잔류.
- **이슈 B~D (UX 개선 3건)**:
  - **B**: 개인화 팝업 툴바 배경을 본문 톤으로 맞추고 하단 경계선만 부여하여 헤더-툴바 경계 명확화.
  - **C**: 개인화 팝업 우측 디자인 트리에 가상 스크롤(`virtual: true`) 적용 및 컨트롤러 1회 생성 후 데이터 갱신 재사용.
  - **D**: 패턴 드래그 중 백드롭만 토글하여 팝업 자신은 드래그 중에도 이벤트를 차단(팝업 위 드롭 무효화).

---

## 2. 세부 검수 포인트별 심층 분석 결과 (1:1 대조)

| 구 분 | 검수 포인트 | 코드 위치 및 검증 내용 | 결과 |
|---|---|---|---|
| **이슈 A** | **미리보기 M11 모듈 선로드** | [callDesignContextMenu.js:207-238](file:///c:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/www/ws30/ws10_20/design/js/callDesignContextMenu.js#L207-L238)<br>`oAPP.fn.fnP13nDesignPopupOpen` 정의 여부 확인 ➔ 미로드 시 `oAPP.loadJs("fnP13nDesignPopupOpen", run)` 선로드 후 실행 덮어쓰기 적용 완료. | **통과 (Pass)** |
| **이슈 A** | **예외 및 사후검증 잠금 해제** | `run()` 내부 예외 및 `loadJs` 완료 후 사후 검증(`!== "function"`) 시 `setShortcutLock(false)` + `parent.setBusy("")`를 동기식으로 호출하여 잠금 누수 0% 보장. | **통과 (Pass)** |
| **이슈 A** | **OBJID 타겟 전달** | [fnP13nDesignPopupOpen.js:1530](file:///c:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/www/ws30/ws10_20/js/fnP13nDesignPopupOpen.js#L1530)<br>미리보기에서 노드 미전달 시 `/lcmenu/OBJID` 프로퍼티로 안전하게 폴백하여 우클릭 UI를 정확히 팝업 대상으로 지정함. | **통과 (Pass)** |
| **이슈 B** | **헤더 ↔ 툴바 경계 UX** | [fnP13nDesignPopupOpen.js:1610, 1641, 1644](file:///c:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/www/ws30/ws10_20/js/fnP13nDesignPopupOpen.js#L1610)<br>툴바의 `--surface-raised` 배경 제거 ➔ 본문 톤 + `border-bottom: 0.0625rem solid var(--ws20-sep)` 및 `.u4aP13nTreeTool { background: transparent; }` 적용으로 경계 명확화. | **통과 (Pass)** |
| **이슈 C** | **우측 트리 가상 스크롤** | [fnP13nDesignPopupOpen.js:1081-1118](file:///c:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/www/ws30/ws10_20/js/fnP13nDesignPopupOpen.js#L1081-L1118)<br>`createTree({ virtual: true, ... })` 설정 적용. `oUI.tree` 1회 생성 후 `collapseAll()` + `expandToLevel(1)` 재렌더 방식으로 휠/리사이즈 중복 부착 방지 및 대용량 성능 확보. | **통과 (Pass)** |
| **이슈 D** | **팝업 위 드롭 무효화** | [fnP13nDesignPopupOpen.js:1210-1212](file:///c:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/www/ws30/ws10_20/js/fnP13nDesignPopupOpen.js#L1210-L1212)<br>`_setModalLook`에서 팝업 `pointer-events: none` 부여를 제거하고 백드롭 디스플레이만 조작. 팝업 위 드롭 시 이벤트 차단으로 무효화되고, 팝업 밖 트리에만 드롭 적용됨. | **통과 (Pass)** |

---

## 3. 관련 소스 코드 정적 구문 점검

### A. 미리보기 선로드 핸들러 (`callDesignContextMenu.js:214-238`)
```javascript
(function () {
    var run = function () {
        try {
            oAPP.fn.contextMenuP13nDesignPopup();
        } catch (e) {
            console.error("[HTML5][design] My Pattern:", e && e.message ? e.message : e);
            oAPP.fn.setShortcutLock(false);
            parent.setBusy("");
        }
    };
    if (typeof oAPP.fn.fnP13nDesignPopupOpen === "function") { run(); return; }
    try { oAPP.loadJs("fnP13nDesignPopupOpen", run); }
    catch (e) { console.error("[HTML5][design] My Pattern load:", e && e.message ? e.message : e); }
    if (typeof oAPP.fn.fnP13nDesignPopupOpen !== "function") {
        console.error("[HTML5][design] My Pattern: fnP13nDesignPopupOpen load failed");
        oAPP.fn.setShortcutLock(false);
        parent.setBusy("");
    }
})();
```

### B. 가상 스크롤 및 1회 생성 컨트롤러 (`fnP13nDesignPopupOpen.js:1081-1118`)
```javascript
if (!oUI.tree) {
    oUI.tree = U4AUI.createTree({
        virtual: true,
        roots: function () { return oS.zTREE || []; },
        children: function (n) { return n.zTREE || []; },
        hasChildren: function (n) { return !!(n.zTREE && n.zTREE.length); },
        key: function (n) { return n.OBJID; },
        label: function (n) { return n.OBJID; },
        ...
    });
    oUI.treeWrap.appendChild(oUI.tree.el);
}
oUI.tree.collapseAll();
oUI.tree.expandToLevel(1);
```

---

## 4. 종합 평가

`br23` 관련 미리보기 우클릭 "내 패턴" 및 개인화 팝업 UX 보완건은 예외 방지, 선로드 사후검증, 잠금 해제 안전성, 가상 스크롤 성능 최적화, 드롭 무효화 등 요구된 모든 항목(A~D)을 충족하므로 최종 **통과(Pass)** 판정합니다.
