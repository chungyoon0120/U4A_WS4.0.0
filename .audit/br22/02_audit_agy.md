# 02_audit_agy — BR22 미리보기 우클릭 "UI 사용위치" 심층 검수 결과

## 판정

**통과 (Pass)**

---

## 1. 검수 개요 및 배경

- **대상 기능**: WS20 미리보기(Preview) 영역 UI 오브젝트 우클릭 ➔ "UI 사용위치" (M08) 메뉴
- **원본 버그**: 옛 UI5 모듈 `callUiWhereUsePopup.js` 로드 시 `new sap.m.Dialog(...)` 구문 실행 ➔ HTML5 WS20 환경 내 생성자 미존재로 `TypeError: sap.m.Dialog is not a constructor` 예외 발생. 진입 시 설정된 local busy (`parent.setBusy("X")`) 및 단축키 잠금(`setShortcutLock(true)`)이 해제되지 못해 화면 영구 먹통 발생.
- **수정 정책**: Design Tree M08과 동일하게 서버 과부하 방지 차원에서 조회 팝업/서버 통신을 차단하고 **안내 메시지**만 표시하도록 호스트 연결부 오버라이드.

---

## 2. 세부 검수 포인트별 심층 분석 결과 (1:1 대조)

| # | 검수 포인트 | 구현 위치 및 검증 내용 | 결과 |
|---|---|---|---|
| 1 | **UI5 Dialog 예외 완전 제거** | [callDesignContextMenu.js:1510-1522](file:///c:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/www/ws30/ws10_20/design/js/callDesignContextMenu.js#L1510-L1522)<br>구버전 `callUiWhereUsePopup` 호출 및 `new sap.m.Dialog` 실행 로직이 완전 제거됨. | **통과** |
| 2 | **서버 요청(/uiWhereUseList) 차단** | 팝업 오픈 및 전수 조회 AJAX 로직이 동작하지 않으므로 불필요한 서버 부하 원천 차단됨. | **통과** |
| 3 | **잠금/BUSY 수명주기 대칭성** | [callDesignContextMenu.js:1512-1515](file:///c:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/www/ws30/ws10_20/design/js/callDesignContextMenu.js#L1512-L1515)<br>메뉴 선택기(`attachItemSelected`)가 진입 시 건 `setShortcutLock(true)`과 `parent.setBusy("X")`를 함수 시작 즉시 동기식으로 해제(`setShortcutLock(false)`, `parent.setBusy("")`)하여 잠금 누수 0% 보장. | **통과** |
| 4 | **Tree(M08)와의 정책/문구 일치성** | [ws_html5_ws20_edit.js:1751-1758](file:///c:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/www/ws30/ws10_20/js/ws_html5_ws20_edit.js#L1751-L1758)<br>`oAPP.fn.fnWs20WhereUseNotice` 공용 함수를 단일 출처(SSOT)로 삼아 양쪽에서 공유 호출함. KO/EN 문구 및 동작이 100% 동일함. | **통과** |
| 5 | **KEEP-UI5 파일 원본 보존** | `callUiWhereUsePopup.js` (KEEP-UI5) 원본 파일은 손대지 않고, 호스트 연결 지점인 `callDesignContextMenu.js`에서만 호출 경로를 차단함. | **통과** |
| 6 | **반복 호출 및 모듈 로드 안정성** | 동기식 단발 실행 경로이며, `library-preload.js:182`에 의해 `ws_html5_ws20_edit.js`가 항상 선로드되므로 `fnWs20WhereUseNotice` 미정의 위험 없음. | **통과** |
| 7 | **i18n 처리 정책** | 메시지 클래스 키(A59는 메뉴 라벨용 키) 부재로 인해 공용 함수 주석에 i18n 키화 보고 대상으로 기록되어 규칙 준수함. | **통과** |

---

## 3. 관련 소스 코드 정적 구문 점검

### A. 미리보기 위임 연결부 (`callDesignContextMenu.js:1510-1522`)
```javascript
oAPP.fn.contextMenuUiWhereUse = function(){

    //진입 시 걸어둔 단축키 잠금·BUSY 즉시 원복(잔류 금지).
    oAPP.fn.setShortcutLock(false);

    parent.setBusy("");

    //트리와 동일한 공용 안내 호출(문구·동작 한 곳에서 관리).
    if(typeof oAPP.fn.fnWs20WhereUseNotice === "function"){
        oAPP.fn.fnWs20WhereUseNotice();
    }

};
```

### B. 공용 안내 모듈 (`ws_html5_ws20_edit.js:1751-1758`)
```javascript
oAPP.fn.fnWs20WhereUseNotice = function () {
    var bKo = false;
    try { bKo = ((parent.getUserInfo && parent.getUserInfo().LANGU) || "EN") === "KO"; } catch (e) { }
    var sMsg = bKo
        ? "‘UI 사용 위치’는 전체 애플리케이션을 전수 조회하는 기능으로, 서버에 큰 부하를 줄 수 있어 현재 비활성화되어 있습니다."
        : "‘UI Where-Used’ scans every application and can put heavy load on the server, so it is currently disabled.";
    try { parent.showMessage(null, 10, "W", sMsg); } catch (e) { }
};
```

---

## 4. 종합 평가

`br22` 관련 미리보기 우클릭 "UI 사용위치" 수정건은, 예외 발생 원인 차단, 잠금 즉시 원복, 공용 함수(`fnWs20WhereUseNotice`)로의 단일화 리팩토링, KEEP-UI5 원칙 준수 등 모든 요구사항을 완벽히 충족하므로 최종 **통과(Pass)** 판정합니다.
