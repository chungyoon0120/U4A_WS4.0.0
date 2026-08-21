# BR51 검수 요청서 — ATTRIBUTE 입력값 점검 모듈 실패 시 오류 없이 통과(조용한 예외 처리)

## 검수 대상

- 파일: `www/ws30/ws10_20/js/ws_html5_ws20_attr.js`
- 함수: `oAPP.fn.fnWs20AttrChange` 내부의 입력값 점검 블록 (3872~3903행 부근, `checkPropertyValue` 호출부)
- 기능: WS20 오른쪽 Attribute(속성) 영역에서 속성 값을 바꿀 때 수행되는 "입력값 범위 점검"
- 노션 이슈: BR51 (이슈 리포트 DB, 상태=접수)

## 배경 (버그 내용)

- HTML5 이식본은 점검 모듈 로드+점검 호출 전체를 try/catch 로 감싸고, **catch 가 완전히 빈 채**(`// 점검 모듈 미로드(헤드리스) — skip.`)로 조용히 건너뛰었다.
- 이 갈래가 타면 **허용 범위 밖 값이 아무 오류 표시 없이 수용**될 수 있다.
- 원본(`U4A_WS_DESIGN\design\js\uiAttributeArea.js` attrChangeProc 1957~1977행)은 try/catch **없이 무조건** `parent.require(...designTreeData.js)` → `checkPropertyValue(is_attr)` 를 호출한다 — 실패하면 예외가 그대로 위로 터져 드러난다.
- 프로젝트 코딩 규칙(`.claude/rules/code.md`): "오류 삼킴·조용한 catch 금지(오류코드+표면화)".

## 변경 요약 (원본 대비)

catch 를 "조용한 skip" → "오류코드 표면화"로 교체. **정상 경로(try 본문)는 한 글자도 변경 없음.**

변경 후 catch (3890~3903행 부근):
```js
} catch (e) {
    //[BR51] 점검 모듈 로드/실행 실패를 조용히 삼키지 않는다(코딩규칙: 조용한 catch 금지).
    console.error("[WS20ATTR-CHK01] 입력값 점검 모듈(designTreeData.js) 로드/실행 실패 — 값 점검 미수행:", e);
    try {
        parent.showMessage(null, 10, "E",
            "WS20ATTR-CHK01: " + ((e && e.message) ? e.message : "check module error"));
    } catch (e2) {
        console.error("[WS20ATTR-CHK01] 오류 안내 표시 실패:", e2 && e2.message);
    }
}
```

- `console.error` + 구간 오류코드 `WS20ATTR-CHK01` (현장 SR 추적용).
- 사용자 안내 = `parent.showMessage(null, 10, "E", ...)` — 같은 파일의 기존 오류 표면화 전례(1658행 `parent.showMessage(null, 10, "E", sTxt)`)와 동일 형태.
- 안내 문구는 메시지 DB 등록 문구가 아니라 "오류코드: 실패 내용" 원문 — 메시지 임의 등록 금지 규칙 때문(정식 키 배선은 장군님 번호 지정 시 후속).
- catch 유지 이유(원본처럼 그냥 throw 하지 않은 이유): fnWs20AttrChange 상위 흐름에는 busy/재진입 플래그(finally 해제)가 있으나, 점검 실패 하나로 이후 수집·스타일·재렌더 전체가 끊기면 HTML5 쪽 화면 상태가 원본보다 더 크게 어긋난다. 이슈 [기대]도 "표면화(console.error + 사용자 안내)"를 요구.

## 검수 포인트

1. **정상 경로 무변경 확인**: try 본문(모듈 로드→checkPropertyValue→RETCD "E" 시 valst/valtx/기본값 복귀)이 원본 attrChangeProc 1957~1977행과 1:1 그대로인가.
2. **catch 갈래 안전성**: catch 안에서 새 예외가 밖으로 새지 않는가(showMessage 자체를 내부 try/catch 로 가드). fnWs20AttrChange 의 재진입 플래그/busy 흐름(finally)과 충돌 없는가.
3. **동작 변화 범위**: 정상 설치 환경에서는 catch 가 타지 않아 평소 동작 변화 0 인가. (BR34 이식 chkExcepionAttr 도 같은 require 를 무가드로 쓰며 실앱 CDP 검증 통과 이력.)
4. **KIND 10 사용 적정성**: `parent.showMessage(null, 10, "E", ...)` 가 이 파일 기존 전례(111·1658·4770행)와 같은 계약인가. UI5(sap) 인자 의존 없는가(null 사용).
5. **규칙 합치**: 조용한 catch 금지(code.md)·임의 메시지 문구 미등록(오류코드 원문만 표시) 처리가 규칙과 어긋나지 않는가.
6. (참고) 같은 파일의 다른 조용한 catch 들은 BR51 범위 밖(실행 점검 삼킴=BR55 별건).

## 근거

- 원본: `C:\Users\socce\Documents\Github\U4A_WS_DESIGN\design\js\uiAttributeArea.js` — attrChangeProc 1929행~, 점검 호출 1957~1977행(무가드).
- 점검 모듈: 원본 `design/js/checkAppData/designTreeData.js` — checkPropertyValue(71행~).
- 규칙: `.claude/rules/code.md` "오류 삼킴·조용한 catch 금지(오류코드+표면화)".
- 노션 이슈 BR51 본문 [기대]: "점검 실패를 조용히 삼키지 말고 오류코드로 표면화(console.error + 사용자 안내)".
- node --check 통과(수정 후).
