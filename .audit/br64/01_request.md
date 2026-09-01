# BR64 검수 요청 — 바인딩 팝업: 잘못된 Conversion Routine 이 D&D 바인딩에 적용됨

> 규약 = `.audit/README.md`. 이 문서는 **Claude 가 쓴 검수 요청서**다.
> 코덱스는 `02_audit_codex.md`, 안티는 `02_audit_agy.md` 에 결과를 쓴다. 이 파일은 고치지 않는다.

---

## 0. 한 줄 요약

**원본이 원래 하던 "드래그 시작 시 추가속성 오류 점검"(`checkAdditData`)이 HTML5 에서 2026-08-05 에 일부러 비워져(함수 미정의)** 있어서,
없는 Conversion Routine 을 넣어 입력칸이 빨갛게 오류 난 상태에서도 그 값이 끌어놓기(D&D)로 프로퍼티에 그대로 박혔다.
막는 배선(끌기 쪽·드롭 쪽)은 이미 다 살아 있었고 **점검 함수 하나만 꺼져 있던 것** → 원본(`index.js:8394`) 1:1 로 그 함수를 도로 정의해 넣었다.

---

## 1. 이슈 원문 (노션 이슈 리포트 DB)

- 코드 `BR64` / 화면 `바인딩 팝업` / 분류 `기능` / 상태 `접수` / 작성자 `PES`
- 내용: **잘못된 Conversion Routine 이 D&D 바인딩 시 프로퍼티에 적용됨**
- 현상: 바인딩 팝업의 바인딩 추가속성 영역에 **유효하지 않은 Conversion Routine**(예: 한글)을 입력하면
  입력칸에 오류가 뜨고 서버 검증에서도 "존재하지 않는 Conversion Routine" 으로 확인되는데,
  그 상태에서 바인딩 필드를 **드래그해 메인 ATTRIBUTE 리스트의 프로퍼티에 드롭**하면 그 잘못된 값이 바인딩에 함께 적용된다.
  D&D 경로는 차단되지 않았다.
- 이슈에 적힌 소스 확인 사항: 필드 드래그 시작 경로가 우측 추가속성 값을 `setAdditBindData` 로 문자열화해 전달하고,
  추가 검증은 `checkAdditData` 함수가 **존재하는 경우에만** 수행하도록 구성돼 있으며,
  "기존 동작 유지를 위해 해당 검증 함수를 정의하지 않았다"는 주석이 있다.
  → **적용 버튼 경로와 D&D 경로의 유효성 검사 차이** 검토 필요.
- 기대 결과(이슈 원문):
  1. 유효하지 않은 Conversion Routine 이 설정된 상태에서는 그 값을 포함한 D&D 바인딩 적용을 **차단**해야 한다.
  2. 사용자에게 오류 원인을 **안내**하고, 기존 프로퍼티의 바인딩·추가속성 정보는 **유지**해야 한다.
  3. 추가속성 **적용 버튼 경로와 D&D 경로에 동일한 유효성 검사 기준**을 적용해야 한다.

---

## 2. 검수 대상 파일

| 파일 | 성격 | 이 건에서 바뀐 곳 |
|---|---|---|
| `www/ws30/ws10_20/Popups/bindPopup/additInfoArea/additInfoArea.js` | **HTML5 변환 파일(작업 폴더 사본)** | `oAPP.fn.checkAdditData` 함수 **신규 정의**(725~745행) — 종전 자리엔 "미정의로 둔다"는 주석 4줄만 있었음 |

- 대상 함수: `oAPP.fn.checkAdditData` (신규 정의)
- 이 함수를 **부르는 곳(끌기 시작)**: `modelFieldArea/modelFieldArea.js:277~279` — `typeof oAPP.fn.checkAdditData === "function"` 가드 뒤 호출, 오류면 payload 에 `RETCD="E"` 실음.
- 이 함수 결과를 **받아 막는 곳(드롭)**: `designArea/designArea.js:196`(payload `RETCD==="E"` 판독) → `:966`(쓰기 전 차단 + `RTMSG` 안내 토스트).

### 원본(as-is) SSOT
디자인 담당 개발자 관리 영역이므로 원본은 `U4A_WS_DESIGN` 을 본다(CLAUDE.md ★최우선 규칙 ②, `.analy/18`).
`C:\Users\socce\Documents\Github\U4A_WS_DESIGN\Popups\bindPopup\index.js`
- `checkAdditData` = **8394행** (본문 8399행 `T_MPROP.filter(item => item._error === true)`).
- `setDragStart` = **8460행** → `checkAdditData()` 호출 **8511행** → 오류면 `l_obj.RETCD="E"` **8514~8516행**.
- dragStart 이벤트 배선 = **4381행** (`dragStart: oAPP.fn.setDragStart`).
- 적용 버튼 경로의 P06 오류 판정 = **5115행** (`if(ls_p06._error === true)`).

(작업 폴더 사본 monolith `Popups/bindPopup/index.js` 에도 같은 함수가 8380행에 있으나 참조용이며, 진짜 SSOT 는 위 `U4A_WS_DESIGN`.)

---

## 3. 원본이 실제로 하는 일 (근거)

원본 `setDragStart`(8460)는 드래그를 시작할 때:

1. 드래그한 필드 정보(`IF_DATA`)를 담고,
2. 우측 추가속성 값을 `setAdditBindData(oAddit.oModel.oData.T_MPROP)` 로 문자열화해 `IF_DATA.MPROP` 에 넣고,
3. **`checkAdditData()` 로 추가속성 오류를 점검**한다(8511).
4. 오류면 `l_obj.RETCD="E"` + `RTMSG` + `T_ERMSG` 를 payload 에 실어 보낸다(8514~8516).

원본 `checkAdditData`(8394)는:
- `T_MPROP` 중 `_error === true` 인 행을 모은다(8399).
- 없으면 그대로 통과(오류 아님).
- 있으면 각 행의 `ITMCD`+`_error_msg` 를 `T_ERMSG` 로 모으고, `RETCD="E"`, `RTMSG = 메시지 146`("바인딩 추가속성 정보에 오류건이 존재합니다.") 를 돌려준다.

→ **원본은 오류 상태에서 드래그를 명확히 차단한다.** 드롭 쪽은 payload `RETCD==="E"` 를 만나면 쓰기 전에 막고 안내한다.

### 적용 버튼 경로와의 관계
적용 버튼(추가 속성 바인딩) 경로는 원본에서 P06(Conversion Routine) 오류를 `ls_p06._error === true`(5115) 로 판정한다.
HTML5 도 동일 — `chkAdditBindData`(`additInfoArea.js:599`)가 `p06._error === true` 를 본다.
즉 **오류의 근거 플래그(`_error`)는 두 경로가 이미 같다.** BR64 는 D&D 경로만 그 플래그를 안 보고 있던 문제다.

---

## 4. HTML5 가 어긋나 있던 지점 (원인)

- 끌기 쪽(`modelFieldArea.js:277`)은 `checkAdditData` 가 **있으면** 부르도록 배선돼 있었다.
- 드롭 쪽(`designArea.js:196·966`)은 payload `RETCD==="E"` 면 쓰기 전에 막고 `RTMSG` 를 토스트로 띄우도록 배선돼 있었다.
- 그런데 `checkAdditData` 자체가 **2026-08-05 에 일부러 미정의**로 남겨져 있었다(종전 주석 요지: "원본 코드엔 있지만 실물에선 안 막더라, 코드 존재 ≠ 동작이라 원본 파리티 아님 → 미정의 유지").
- 함수가 없으니 끌기 쪽 `typeof === "function"` 가드가 항상 거짓 → 오류 표시가 payload 에 안 실림 → 드롭이 그냥 통과.

> ※ 2026-08-05 판단의 근거였던 "원본도 안 막더라"는 **원본 소스(`U4A_WS_DESIGN` 8394·8511·8514)와 어긋난다.** 원본은 막는다. BR64 는 그 차단을 요구하므로, 원본대로 함수를 되살리는 것이 1:1 이다.

---

## 5. 변경 내용 (수정 후)

`additInfoArea.js` 725행부터, 종전 "미정의로 둔다" 주석 4줄을 지우고 아래 함수를 정의:

```js
oAPP.fn.checkAdditData = function () {
    var _sRes = { RETCD: "", RTMSG: "", T_ERMSG: [] };
    var _aErr = (oAPP.attr.additRows || []).filter(function (i) { return i._error === true; });
    if (_aErr.length === 0) { return _sRes; }                                   // 오류건 없으면 통과(정상 드래그).
    for (var i = 0; i < _aErr.length; i++) {
        _sRes.T_ERMSG.push({ ITMCD: _aErr[i].ITMCD, ERMSG: _aErr[i]._error_msg || "" });
    }
    _sRes.RETCD = "E";
    _sRes.RTMSG = H.z("146");   // 146 바인딩 추가속성 정보에 오류건이 존재합니다.
    return _sRes;
};
```

| # | 변경 | 원본 근거 | 성격 |
|---|---|---|---|
| C1 | `oAPP.fn.checkAdditData` 신규 정의 | 원본 `index.js:8394`(U4A_WS_DESIGN) 1:1 | 미정의로 꺼둔 원본 동작 복원 |

- 원본은 `oAPP.attr.oAddit.oModel.oData.T_MPROP` 를 보는데, HTML5 의 그 대응 스토어는 `oAPP.attr.additRows` 다
  (`modelFieldArea.js:273` 주석의 매핑과 동일 — 원본 `setAdditBindData(T_MPROP)` → HTML5 `setAdditBindData(additRows)`).
- `oAPP.attr.additRows` = 적용 버튼 경로가 쓰는 배열과 **같은 배열**이다(`additInfoArea.js` 31·35행: `oA.MAIN.store="additRows"`, `_rows(oA.MAIN)`=`oAPP.attr.additRows`).
  Conversion Routine 오류는 그 배열 행의 `_error=true`(`additInfoArea.js:448`, `convChangeInput`)에 남는다 → **기대결과 3(적용 버튼과 동일 기준) 충족**.
- 메시지 146 은 **원본이 이 함수에서 쓰던 기존 키**(새 문구·새 키 안 만듦).
- `node --check` 통과.
- 원본 폴더(`U4A_WS_DESIGN`, `U4A_WS3.0.0`) **읽기만** 함.

---

## 6. 검수 포인트 (꼭 봐 주십시오)

| # | 항목 | 왜 봐야 하나 |
|---|---|---|
| **A** | **원본 판독이 맞나** — 원본 `U4A_WS_DESIGN\index.js` 8394(`checkAdditData`)·8511(setDragStart 에서 호출)·8514(RETCD 세팅)이 실제로 그렇게 막는가. 2026-08-05 "원본도 안 막더라" 판단이 원본과 어긋난다는 내 진단이 사실인가 | 이 건의 방향 근거 |
| **B** | **차단이 오류 있을 때만 걸리나** — `_error===true` 행이 하나도 없으면 `RETCD=""`(통과)인가. 추가속성을 아예 안 채운 **정상 드래그**를 잘못 막지 않는가 | 과잉 차단(정상 D&D 회귀) 방지 |
| **C** | **같은 배열인가** — `oAPP.attr.additRows` 가 적용 버튼 경로(`chkAdditBindData`→`_rows(oA.MAIN)`)와 동일 배열이고, Conversion 오류 플래그 `_error` 가 실제로 그 배열 행에 남는가(`convChangeInput` 448) | 기대결과 3(동일 기준)의 성립 여부 |
| **D** | **기존 바인딩 유지되나** — 드롭 쪽(`designArea.js:966`)이 `RETCD==="E"` 에서 **쓰기(`_setBindAttribute`) 전에** return 하는가. 그래야 프로퍼티의 기존 바인딩·추가속성이 안 지워진다(기대결과 2) | 차단이 파괴적이지 않은지 |
| **E** | **안내 문구가 뜨나** — 드롭 쪽이 `RTMSG`(146)를 토스트로 띄우는가. payload 에 `RTMSG` 가 비어 오면 무음 차단이 되지 않는가 | 기대결과 2(오류 안내) |
| **F** | **busy 짝** — 드롭 차단 갈래에서 `setBusyWS20Interaction(false,{})` 로 잠금이 반드시 풀리는가(`designArea.js:966`) | 필수 규칙(busy on↔off) |
| **G** | **다른 드래그 경로 영향** — `checkAdditData` 를 정의함으로써 이 함수를 쓰는 다른 곳이 생겨 예상 밖 차단이 걸리지 않는가(현재 호출처 = `modelFieldArea.js:277` 한 곳만인지 전수 확인) | 정의 부작용 범위 |
| **H** | **스테일 오류로 막히나** — 우측 추가속성에 오류가 남아 있는 채 다른 프로퍼티를 드래그하면 그것도 막힌다. 이게 적용 버튼과 같은 기준이라 맞는가, 아니면 사용자를 과하게 막는가 | 판단 갈리면 지적 바람 |
| **I** | **원본 무수정** — 원본 폴더 2곳과 작업폴더 안 원본 사본에 손댄 곳이 없는가 | ★최우선 규칙 |

---

## 7. 고친 자리 — 소스 위치

**바꾼 파일 1개, 바꾼 자리 1군데.**

파일 = `www/ws30/ws10_20/Popups/bindPopup/additInfoArea/additInfoArea.js`

| 위치 | 줄 | 무엇 |
|---|---|---|
| `oAPP.fn.checkAdditData` (신규) | **725 ~ 745** | 종전 "미정의로 둔다" 주석 4줄 → 함수 정의로 교체. 근거 주석 포함 |

### 함께 봐야 할 자리 (안 고쳤지만 판단에 필요)

| 파일 | 줄 | 왜 |
|---|---|---|
| `Popups/bindPopup/modelFieldArea/modelFieldArea.js` | **272 ~ 281** | 끌기 시작 — `setAdditBindData(additRows)` + `checkAdditData` 가드 호출(오류면 payload `RETCD="E"`) |
| `Popups/bindPopup/designArea/designArea.js` | **189 ~ 198** | `_checkDragData` — payload `RETCD==="E"`(196) 판독 |
| `Popups/bindPopup/designArea/designArea.js` | **956 ~ 966** | `_onDesignDrop` — 966 에서 오류면 쓰기 전 차단 + `RTMSG` 토스트 + busy off |
| `Popups/bindPopup/additInfoArea/additInfoArea.js` | **441 ~ 468** | `convChangeInput` — Conversion Routine 서버 검증, 오류 시 행에 `_error=true`(448) |
| `Popups/bindPopup/additInfoArea/additInfoArea.js` | **567 ~ 601** | `chkAdditBindData` — 적용 버튼 경로 검증, P06 는 `p06._error===true`(599) |
| `Popups/bindPopup/additInfoArea/additInfoArea.js` | **30 ~ 35** | `oA.MAIN.store="additRows"`, `_rows` — 검수 포인트 **C**(같은 배열) 근거 |

---

## 8. 근거 목록

- 원본 SSOT: `U4A_WS_DESIGN\Popups\bindPopup\index.js` 4381(dragStart 배선)·8394(`checkAdditData`)·8399(`_error===true` 필터)·8460(`setDragStart`)·8511(호출)·8514~8516(RETCD 세팅)·5115(적용 버튼 P06 `_error` 판정).
- HTML5: `additInfoArea.js` 725~745(신규)·31·35(store)·448(`_error` 세팅)·599(적용버튼 판정) / `modelFieldArea.js` 272~281 / `designArea.js` 189~198·956~966.
- 메시지: `ZMSG_WS_COMMON_001` 146(원본 `checkAdditData` 가 쓰던 기존 키).
- 규칙: `CLAUDE.md` ★최우선(원본 1:1·임의창작 금지), `.claude/rules/code.md`(busy 짝·오류 삼킴 금지·`node --check`).
- SSOT 위치: `.analy/18_원본소스_위치_SSOT.md`.
