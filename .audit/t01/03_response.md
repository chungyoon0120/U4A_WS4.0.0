# T01 검수 반영·해명 (03_response)

## 요약

코덱스=수정필요(P1 2·P2 1) / 안티=수정필요(P2·P3). 취합 결과 **반영 2건**(코덱스 P1-1 옛 소비자 호환, 안티 P2 방어가드), **반론 3건**(코덱스 P1-2 원본 부재 주장, 코덱스 P2 0:1 노출, 안티 P3 문구 폴백). 핵심 T01 분기(바인딩+자식 → 002 안내)와 두 HTML5 소비부·문구 코드 분리(끌어놓기 002/팝업 000)·잠금 대칭은 **양측 모두 통과**.

## 지적 취합 (한 표)

| # | 지적 | 검수자 | 판단 | 근거·조치 |
|---|---|---|---|---|
| 1 | **[P1] 옛 UAI(작업폴더 design/UAI/parseAiLibraryData.js)가 배열 계약(`.length`) 소비 → 구조체 반환이면 후보없음 사전거부 무력화** | 코덱스 | **반영** | 옛 UAI는 반환값을 `.length===0` **검사에만** 사용(408·411, 원소 접근 0 — grep `_aT_AGGR` 전수). 반환 구조체에 `length`(=T_SEL 개수)를 모든 return 경로에서 동기화(`_fin()`), 옛 사전거부 복원. **원본 최신 UAI 는 이미 구조체 소비로 교체됨**(WS_DESIGN `design/UAI/parseAiLibraryData.js:434` `const _sRes = ...; if(_sRes.RETCD==="E")`, 옛 배열 소비는 주석 처리) → 원작자가 UAI 를 최신판으로 덮어쓰면 자연 정합(신판은 RETCD/T_SEL만 보므로 length 무해). |
| 2 | **[P1] 요청서가 지목한 구조체판 원본이 저장소·Git ref 에 없음 → 1:1/클로버 호환 입증 불가** | 코덱스 | **반론** | 원본 SSOT 는 **저장소 밖 폴더 2곳**(CLAUDE.md·always.md 명시): WS20/디자인영역 = `C:\Users\socce\Documents\Github\U4A_WS_DESIGN`. 구조체판 **실재 확인**(직접 정독): `design/js/uiDesignArea.js:1596~1680`(chkAggrRelation 구조체판, `_isModelBind`, 001/002/003), `design/js/aggrSelectPopup.js:32~34`(`.T_SEL` 소비)·`:66·79`(`.RTMSG` 표시), `designChkSelLine 1474~1482`(`.RETCD/.RTMSG`), UAI `434`. 검수자는 **작업 저장소만 검색**해 SSOT 폴더를 못 본 것(작업폴더 www 는 "원본 아님 — 옛 원본 173개 섞임"이 공지 사항). 클로버 우려도 실측 반박: 작업폴더 `design/js/uiDesignArea.js`·`design/js/aggrSelectPopup.js` 를 HTML5 런타임이 로드하는 배선 **0건**(getScript/require/loadJs grep) → 배열판 되덮기 없음. |
| 3 | **[P2] 점유된 0:1 aggregation 이 후보로 노출(옛 배열판은 제외했음)** | 코덱스 | **반론** | WS_DESIGN 최신 구조체판(1596~1680)에는 **0:1(ISMLB) 제외 분기 자체가 없음**(구간 grep `ISMLB` 0건 + 정독). 옛 배열판의 그 조건을 최신 원본이 **의도적으로 제거** — 점유된 0:1 은 다음 단계 개수 점검(chkUiCardinality, designAddUIObject 5245 → 022 "해당 Aggregation에 오브젝트를 2개 이상 지정할 수 없습니다")이 막는 설계. 내 이식 = 최신 원본 1:1. 옛 제외를 되살리면 원본과 달라짐 → 미채택. (코덱스 스스로 "최신 원본 의도 확정 먼저"라 함 → 확정함.) |
| 4 | **[P2] 방어가드 3곳(prev 체인 / T_0023·T_0027 배열 / UIADT null)** | 안티 | **반영** | `_LIB` 체인 가드 + `(T_0022/23/27\|\|[])` + `(UIADT\|\|"").toUpperCase()` + `oAPP.attr&&oAPP.attr.prev` 체인. 정상 데이터 경로 무변화, 크래시만 차단(이식 관례 — _ensurePrev 등과 동일 결). |
| 5 | **[P3] 문구 조회 실패 시 빈 안내 → 하드코딩 대체문구 세팅 요구** | 안티 | **반론** | 소비부에 폴백 **이미 존재**: aggrSelectPopup 은 RTMSG 가 비면 262(`_sMsg = RTMSG ? RTMSG : 262`), wizard 는 `RTMSG \|\| 280` → 빈 토스트 안 뜸. 하드코딩 문구 세팅은 **메시지 임의 문구 생성 금지 규칙 위반**이라 미채택. 조회 실패 자체는 BR61 반영분(console.error 표면화)이 드러냄. |

## 수정 내역 (이번 반영)

- `www/ws30/ws10_20/js/ws_html5_ws20_dnd.js` `chkAggrRelation`:
  - 반환 마무리 `_fin()` 추가 — 모든 return 경로에서 `_sRes.length = _sRes.T_SEL.length` 동기화(옛 UAI `.length` 계약 호환).
  - 방어가드: `_LIB` 체인, `(T_0022/0023/0027||[])`, `(UIADT||"")`, prev 체인.
- 로직(001/002/003 분기·_isModelBind·zTREE 기준 자식판정)·소비부(aggrSelectPopup·wizard)는 무변경.
- `node --check` dnd.js·wizard.js 통과. 구조체 length 논리 Node 단위검증(후보0→length 0 / 후보1→1).

## 검수자 확인 정상 항목(재기록)

- 핵심 T01 분기(바인딩+자식 → RETCD=E·RTMSG=002·T_SEL 빈) 합성 실행 확인(코덱스).
- 두 소비부 배선·폴백 순서·같은부모 순서변경 분기·후보1 자동선택 유지(코덱스·안티).
- 잠금 해제 대칭(후보0: cancelFunc 위임 or 토스트+방송·화면·단축키 3종 해제 / wizard: BUSY_OFF+_fail)(안티).
- 문구 코드 분리(끌어놓기=002 집계명 없음 / 팝업=000 집계명 인자) 원본 의도와 일치(코덱스·안티).
- 키 000/001/002/003 KO·EN 등록(코덱스).

## 실화면 검증 (남음)

앱 재시작 후 `.works/UI추가팝업/00_현황판.md` T01-1~4. (양 검수 모두 실화면 미실행 명시.)
