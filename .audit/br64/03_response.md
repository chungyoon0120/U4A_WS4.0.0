# BR64 보완·해명 (03) — 코덱스·안티 검수 취합

> 규약 = `.audit/README.md`. 이 문서는 **Claude 가 쓴 반영/반론**이다.
> 코덱스 `02_audit_codex.md`(수정필요 P1·P2) + 안티 `02_audit_agy.md`(통과) 를 모두 읽고 작성.

---

## 0. 한 줄 결론

- **안티 = 통과.** 원본 1:1·적용 버튼과 기준 통일·드롭 차단·busy 대칭 무결점 판정.
- **코덱스 = 수정필요 2건.** **P2(별창 안쪽 드롭 과잉 차단) = 반영**(소스로 확정, 원본 위반 맞음). **P1(빠른 입력→즉시 드래그 시간창) = 반론**(원본에도 동일, BR64 신규 아님, 방어 추가는 원본에 없는 신규 로직) + 별건 보고.

---

## 1. 취합 표

| # | 검수자 | 지적 | 판정 | 처리 |
|---|---|---|---|---|
| P2 | 코덱스 | 별창 **안쪽** 디자인트리 드롭까지 payload 오류로 막는 회귀. 원본은 그 드롭에서 우측 추가속성을 버리므로(`MPROP=""`) Conversion 오류와 무관 | **반영** | `designArea.js` `_checkDragData` 의 `o.RETCD==="E"` 차단 한 줄 제거(원본 838~883 = RETCD 안 읽음 1:1 복원) |
| P1 | 코덱스 | Conversion 서버검증이 비동기라, 잘못 입력 직후 바로 드래그하면 검증 응답 전(`_error`아직 false)이라 오류값이 통과할 수 있는 시간창 | **반론 + 별건** | 원본(`index.js:8394` checkAdditData=`_error`만 동기판독 / 검증은 async)에도 **동일**. BR64가 만든 결함 아님. pending 방어는 원본에 없는 신규 로직 → 임의 적용 금지, 장군님 지시 시 별건 |
| — | 안티 | 통과(무결점) | — | 코드 변경 없음 |

---

## 2. P2 반영 — 근거와 수정 (소스로 확정)

### 확정 사실 (원본 대조)
- 원본 별창 **안쪽** 디자인트리 드롭의 `_checkDragData`(`U4A_WS_DESIGN\Popups\bindPopup\uiModule\designTree.js:838~883`)는
  **payload 의 `RETCD`/`T_ERMSG` 를 읽지 않는다.** 099·100·101·102(드래그정보 없음/깨짐/PRC001아님/다른영역)만 확인한다.
- 원본 같은 파일 **1315~1317**:
  > `//DESIGN TREE 영역에 DROP 되는 데이터는 바인딩 추가 속성 정보를 적용하지 않기에 초기화 처리.`
  > `_sRes.IF_DATA.MPROP = "";`
  → **별창 안쪽 드롭은 우측 추가속성(MPROP)을 통째로 버린다.** 그래서 Conversion Routine 오류가 이 경로엔 애초에 반영될 수 없다.
- HTML5 `designArea.js` 도 **976행에서 `_sRes.IF_DATA.MPROP = "";`** 로 원본대로 버린다(원본 1317 이식 확인).
- 그런데 `designArea.js:196`(`if (o.RETCD === "E") { … return; }`)이 **976 앞에서 먼저 막았다.** 이 줄은 원본에 없는 추가분이었고,
  `checkAdditData` 가 미정의였던 동안엔 payload `RETCD` 가 항상 `""` 라 **잠자던 코드**였는데, **BR64가 `checkAdditData` 를 정의하며 깨어나** 오류와 무관한 별창 안쪽 드롭까지 막게 됐다(코덱스 지적 정확).

### 수정
`designArea.js` `_checkDragData` 에서 `o.RETCD==="E"` 차단 한 줄 **제거**(근거 주석으로 대체). 099/100/101/102 확인은 유지.
→ 별창 안쪽 드롭은 원본대로 `IF_DATA` 를 그대로 받아 976에서 MPROP 를 버리고 정상 진행.

### 이 수정이 BR64 본기능을 깨지 않는 확인
- **BR64 진짜 대상 = WS20 메인 ATTRIBUTE 드롭**(별창 안쪽 아님). 그 경로는 **다른 파일**
  `ws_html5_ws20_attr.js:6322`(V10 `if (l_json.RETCD === "E" …)`)에서 payload 오류를 막고, **MPROP 를 버리지 않고 실제 적용**한다.
  이 경로는 `designArea.js` 와 무관하므로 P2 수정의 영향을 받지 않는다.
- `designArea.js` 의 `_checkDragData` 는 그 파일 `_onDesignDrop:965` 한 곳에서만 호출(전수 확인) → 제거 영향 국소.
- `node --check designArea.js` 통과. 백업 `_designArea.js.br64bak`.

---

## 3. P1 반론 — 근거

### 코덱스 주장
P06(Conversion Routine)은 타이핑 중(`onInput`)엔 `clearConvError`로 오류가 즉시 지워지고, 실제 서버 검증은 blur/엔터(`onChange→convChangeInput`)에서 **비동기**로 시작한다. 잘못 입력 직후 좌측 모델 행을 눌러(그 mousedown 이 blur 유발) 곧바로 드래그하면, 검증 응답 전이라 `_error` 가 아직 false → `checkAdditData` 가 오류 아님으로 읽어 잘못된 값이 payload 로 나갈 수 있다.

### 반론 근거
1. **원본에도 똑같이 있다(BR64 신규 아님).** 원본 `checkAdditData`(`index.js:8394~8413`)도 `_error===true` **만 동기 판독**하고 pending(검증 진행중) 상태를 두지 않는다. 원본 Conversion 검증도 서버 왕복(`chkConvExit`)이라 **비동기**다. 즉 이 시간창은 원본 설계의 특성이며 내 이식은 원본 1:1이다.
2. **막으려면 원본에 없는 신규 방어가 필요.** "검증 진행중(pending) 세대를 기록하고 드래그·적용을 그 동안 막는다"는 건 원본에 없는 새 로직이다. 프로젝트 규칙(원본 1:1·임의창작 금지·이상하면 보고만) 상 BR64 범위에서 임의 추가 불가.
3. **부분 완충은 이미 존재.** `convChangeInput`은 검증 시작 즉시 화면 busy(`setBusy(true)`, `additInfoArea.js:442`)를 걸어 팝업 조작을 덮는다. 이미 시작된 native 드래그를 취소하느냐는 브라우저·타이밍에 달려 실측이 필요(코덱스도 "실화면 재현 확인 필요"로 표기).

### 결론
P1 = **반론(원본 동일·범위 밖)**. 다만 실제 위험이 확인되면 **별건**으로 다룬다(pending 차단은 WS20 수신부 `attrCheckDropMPROP`(원본 8542, 현행 미이식 V9)까지 함께 봐야 하는 별도 작업). **장군님 지시 대기.**

---

## 4. 원본 무수정 확인

- 원본 폴더 2곳(`U4A_WS_DESIGN`, `U4A_WS3.0.0`) **읽기만** 함.
- 이번 반영으로 바뀐 파일: `additInfoArea.js`(01 단계, checkAdditData 정의) + `designArea.js`(03 단계, P2 차단 제거). 둘 다 작업폴더 사본, `node --check` 통과, 각각 백업 존재.

---

## 5. 테스트

실화면 확인 항목을 `.works/bindpopup/00_현황판.md` 최상단에 추가했다(BR64-1~4). 정상 조작으로 재현되는 것만 담았다.
