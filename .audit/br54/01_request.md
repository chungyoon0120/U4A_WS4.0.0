# BR54 검수 요청 (01)

> 노션 이슈: **BR54 — ATTRIBUTE 값 변경 시 특정 속성 전용 예외처리(attrChangeException) 미이식**
> 화면: UI 속성 영역 (WS20 Design 우측 `Attribute`)
> 분류: 기능 / 상태: 접수

---

## 1. 검수 대상

| 구분 | 경로 |
|---|---|
| **수정 파일(유일)** | `www/ws30/ws10_20/js/ws_html5_ws20_attr.js` |
| 수정 함수 | `oAPP.fn.fnWs20AttrChange`(3940행) + 신규 헬퍼 3개 |
| 신규 헬퍼 | `_isAttrChangeException`(3874) · `_runAttrChangeException`(3892) · `_releaseAttrChangeLock`(3907) |
| 백업 | `www/ws30/ws10_20/js/_ws_html5_ws20_attr.js.br54bak` |

**원본(as-is) SSOT** = `C:\Users\socce\Documents\Github\U4A_WS_DESIGN`
- `design/js/uiAttributeArea.js` — `oAPP.fn.attrChange`(1781행), 예외처리 호출 블록 **1840~1845행**
- `design/attributesArea/attrChangeException.js` — 예외처리 모듈 전문(28·33·40·42·44·46행)

> ※ 원본 파일은 **한 줄도 고치지 않았다**. 변경은 전부 원본 폴더 **밖**의 내 파일(`js/ws_html5_ws20_attr.js`) 안에서만 이뤄졌다.

---

## 2. 원본 동작 (근거)

`design/js/uiAttributeArea.js:1840~1845` — `attrChange` 가 UNDO 이력 적재(1828행) **직후**,
값 반영(`attrChangeProc`, 1850행 호출) **직전**에 예외처리 모듈을 부른다.

```js
let {attrChangeException} = await import(parent.PATH.join(oAPP.oDesign.pathInfo.designRootPath,
    "attributesArea", "attrChangeException.js"));

if(await attrChangeException(is_attr)){
  return;                    // ← true 면 이후 값 처리(attrChangeProc 이하) 통째 skip
}
```

`design/attributesArea/attrChangeException.js` 전문 요약:

| 행 | 내용 | 동기/비동기 |
|---|---|---|
| 28 | `oAPP.common.checkWLOList("C","UHAK901369")` 미설치면 `return` (=undefined → 정규 처리 계속) | **동기** |
| 33 | `oAPP.attr.S_CODE.UW13.find(item => item.FLD01 === sAttr?.UIATK)` | **동기** |
| 35 | 미등록이면 `return` (=undefined → 정규 처리 계속) | **동기** |
| 40 | `_path = _sUW13.FLD04 + _sUW13.FLD05` | 동기 |
| 42 | `await import(_path)` | 비동기 |
| 44 | `await _module.default(sAttr)` | 비동기 |
| 46 | `return true` → 호출측이 값 처리 skip | — |

**HTML5 현행**: `fnWs20AttrChange` 에 이 호출 자체가 **없었다**(0건). → 이슈 내용과 일치.

---

## 3. 변경 요약

| # | 변경 | 원본 대응 | 위치 |
|---|---|---|---|
| 1 | 예외처리 **대상 판정** 이식(패치 확인 + 코드마스터 UW13 조회) | 모듈 28~37행 | `_isAttrChangeException` 3874 |
| 2 | 예외처리 **모듈 실행** 이식(경로 구성 + 동적 로드 + `default(sAttr)`) | 모듈 39~45행 | `_runAttrChangeException` 3892 |
| 3 | `fnWs20AttrChange` 의 **원본과 같은 자리**(UNDO 적재 직후·값 반영 직전)에 호출 배선 + 대상이면 `return`(이후 정규 처리 통째 skip) | `attrChange` 1840~1845 | 4000~4025 |
| 4 | 진입부 잠금 해제 로직을 `_releaseAttrChangeLock` 한 곳으로 모으고, `finally` 는 그 함수를 호출 | (HTML5 구조 정리 — 동작 동일) | 3907 / 4157 |
| 5 | 예외처리 경로에서는 `finally` 가 잠금을 풀지 않고, 모듈이 **다 돈 뒤**에 푼다 | 원본은 busy 해제를 sub module 에 위임(1843~1845 에 busy off 없음) | `_bExcPending` 3952 |

### 3-1. 원본과 다른 점(의도적 적응) — 검수 핵심

**원본 `attrChange` 는 `async`, HTML5 `fnWs20AttrChange` 는 `동기`다.**
동기 함수를 `async` 로 바꿀 수 없는 이유:

- `fnWs20AttrChange` 호출부가 20여 곳이고 **아무도 `await` 하지 않는다.** 여러 곳이 "반환 직후"
  후속 처리를 이어간다. 예: `fnBindPopupOpen.js:381~383` 은 호출 뒤 줄에서 트리/미리보기 갱신을
  명시 호출한다(그 파일 주석 "원본 attrChange 는 내부에서 아래 두 갱신까지 수행 → fnWs20AttrChange 는
  안 하므로 명시 호출"). `async` 로 바꾸면 이 후속들이 값 반영 **전에** 실행돼 깨진다.

그래서 원본 모듈을 **판정(동기) / 실행(비동기)** 으로 쪼갰다.
위 표에서 보듯 **판정(28·33·35행)은 원본에서도 전부 동기**라 쪼개도 판정 결과는 동일하다.

| 상황 | 원본 | 이번 HTML5 |
|---|---|---|
| 패치 미설치 | 모듈이 `undefined` 반환 → 정규 처리 계속 | 판정 `null` → 정규 처리 계속 (**종전과 완전 동일**) |
| 패치 설치 + 속성 미등록 | `undefined` 반환 → 정규 처리 계속 | 판정 `null` → 정규 처리 계속 (**종전과 완전 동일**) |
| 패치 설치 + 속성 등록 | 모듈 실행 후 `true` → `return`(값 처리 skip) | 판정 hit → 모듈 실행 예약 + 즉시 `return`(값 처리 skip) |

### 3-2. 잠금(로딩표시·단축키·자식창) 처리

- 원본 1843~1845 의 `return` 에는 `parent.setBusy("")`·`setShortcutLock(false)` 가 **없다**
  (같은 함수의 다른 조기 return 인 1803~1809·1815~1821 에는 있다). 즉 **원본은 busy 해제를
  전용 sub module 에 맡긴다.**
- HTML5 는 `finally` 가 잠금을 풀지만, 그러면 모듈이 도는 동안 화면이 열려 연타가 들어간다
  (`.claude/rules/code.md` WP1 규칙: "로딩표시는 전부 끝난 뒤에 끈다").
  → `_bExcPending` 이 켜지면 `finally` 는 건너뛰고, 모듈 promise 가 끝난 뒤 `_releaseAttrChangeLock()`
  이 로딩표시·단축키·자식창 잠금·재진입 방지를 **한 번에** 원복한다.
- 호출 자체가 즉시 실패하면(동기 throw) `_bExcPending` 을 되돌려 `finally` 가 정상적으로 풀게 한다
  → **잠금이 영구히 남는 경로 없음.**

### 3-3. 추가한 가드 1개

`_isAttrChangeException` 에 `oAPP.attr.S_CODE` / `S_CODE.UW13` 존재 확인을 넣었다.
- 원본 33행은 `oAPP.attr.S_CODE.UW13.find(...)` 를 무조건 참조해, 패치는 깔렸는데 코드마스터에
  UW13 그룹 행이 하나도 없으면 **그 자리에서 죽는다**(S_CODE 는 `T_9011` 의 `CATCD` 별로만 만들어짐 —
  `ws_html5_ws20_attr.js:254~270`).
- 이 파일의 기존 S_CODE 참조부(`UA003` 894행 / `UA035` 916행)가 이미 같은 가드를 쓰고 있어 그와 통일했다.
- **원본 잠재 버그를 고친 것 → 이 판단이 맞는지 봐달라.**

---

## 4. 검수 포인트

| # | 봐달라는 것 |
|---|---|
| P1 | **호출 위치**가 원본과 같은가 — UNDO 이력 적재 **직후**, 값 반영(`setChangeFlag` 이하) **직전**. 원본 1828 → 1840~1845 → 1850 순서와 1:1인가 |
| P2 | **대상 아닐 때 종전과 100% 동일한가** — 판정 2줄만 더 돌고 나머지 흐름·순서가 그대로인지(회귀 0) |
| P3 | **동기/비동기 쪼갬이 타당한가** — 원본 판정부(28·33·35)가 전부 동기임을 확인해달라. `fnWs20AttrChange` 를 `async` 로 못 바꾸는 근거(호출부 `await` 없음)가 맞는지 전수 확인 |
| P4 | **잠금 대칭** — ⓐ 정상 경로 ⓑ 예외처리 성공 ⓒ 예외처리 모듈 실패(reject) ⓓ 호출 자체 즉시 실패, 네 갈래 모두에서 로딩표시·단축키·자식창 잠금·재진입 방지가 정확히 1회 해제되는가. `_releaseAttrChangeLock` 로 묶은 뒤 기존 `finally` 와 동작이 달라진 데는 없는가 |
| P5 | **재진입 방지 플래그**(`oAPP.attr._fnAttrChangeBusy`, BR34)가 모듈 도는 동안 계속 걸려 있는 게 맞는가 — 이 사이 다른 속성 변경이 무시되는데 원본 의도(화면 잠금 유지)와 어긋나지 않는가 |
| P6 | **`import(_path)` 경로 해석** — 원본은 `design/js/` 에서 실행되고 내 파일은 `js/` 에서 실행된다. `FLD04+FLD05` 가 상대경로면 기준 위치가 달라 안 읽힐 수 있다. 서버 코드마스터 값이 없어 실측 불가(**미확인**) — 이론적 문제 여부만 봐달라 |
| P7 | **S_CODE 가드 추가**(§3-3)가 원본 이탈인지, 정당한 방어인지 |
| P8 | 오류를 삼키지 않는가 — 판정 실패/실행 실패/호출 실패 3곳 전부 `console.error` 로 드러나는지 (`code.md` 규칙) |
| P9 | 이 파일에 **다른 attrChange 계열 미이식**이 더 없는지 — 원본 `attrChange`(1781~1928) 전 구간 대비 누락 점검 |

---

## 5. 확인 못 한 것 (미확인)

- **실동작 재현 불가.** 이 예외처리는 ⓐ 패치 `UHAK901369` 설치 + ⓑ 코드마스터 `UW13` 에 속성 등록,
  두 조건이 서버에 있어야만 돈다. 둘 다 서버 설정이라 로컬 소스만으로는 확인 불가.
  노션 이슈 본문도 같은 단서를 달고 있다("현재 영향 여부 미확인").
- 따라서 이번 검수는 **소스 대조 기준**으로만 봐달라. 등록이 없으면 원본도 아무 동작 안 한다.

---

## 6. 검증

- `node --check www/ws30/ws10_20/js/ws_html5_ws20_attr.js` — **통과**
- 원본 파일 수정 0건 (`design/` 무변경)
- 하드코딩 hex·`color-mix`·새 문구/메시지 키 — **해당 없음**(화면 요소 변경 없음)

---

## 7. 근거

- 원본 `design/js/uiAttributeArea.js` 1781(attrChange 정의) · 1828(UNDO) · **1840~1845**(예외처리 호출) · 1850(값 반영)
- 원본 `design/attributesArea/attrChangeException.js` 28 · 33 · 35 · 40 · 42 · 44 · 46
- `CLAUDE.md` 최우선 규칙(원본 1:1 / 원본 파일 무수정) · `.analy/18_원본소스_위치_SSOT.md`
- `.claude/rules/code.md` — busy 대칭 / WP1 비동기 직렬화 / 오류 삼킴 금지 / `node --check`
