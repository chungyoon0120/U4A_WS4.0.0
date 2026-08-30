# BR52 검수 결과 반영·해명 (03)

검수 결과: 코덱스 = 수정필요(P2 3건) / 안티 = 수정필요(P2 3건) — **지적이 동일 3건으로 수렴. 셋 다 반영**(반론 0).

## 지적 취합·처리 표

| # | 지적 | 검수자 | 처리 | 내용 |
|---|---|---|---|---|
| 1 | 선택 강조가 화면 DOM 에만 있어 다음 재렌더(값 변경·Show Changed Items 등)에서 즉시 소실. 원본 sap.m.Table 은 같은 UI 안 재렌더에서 선택 유지, 다른 UI 전환 시에만 removeSelections | 코덱스 P2-1 · 안티 P2-1 (동일) | **반영** | 선택키를 상태(`oAPP.attr._attrSelUiatk`)에 보관 → `fnRenderWs20AttrRows` 행 생성 루프가 매 세대 같은 키 행에 `aria-selected` 복원(수동 지정/해제 블록은 제거 — 렌더가 단일 소스). 다른 UI 전환(`_updateAttrList` 진입부)에서 키 해제 = 원본 updateAttrList removeSelections(7139~7150) 1:1 대응 |
| 2 | 선택 CSS 가 배경만 적용 — 공통 선택 행 계약(배경+선택 글자색+굵기 600+좌측 accent 줄, shell.css 686~691 · .analy/16 §3.7)의 일부만 소비. 진한 선택배경 테마(mac/suse/95)에서 글자 묻힘 | 코덱스 P2-2 · 안티 P2-2 (동일) | **반영** | `.u4aWs20AttrRow[aria-selected="true"]`(+:hover)에 `color: var(--selected-text)` + `font-weight:600` + `box-shadow: inset 0.1875rem 0 0 0 var(--accent)` 전체 세트 적용. 라벨 글자(.u4aWs20AttrLblTxt)도 선택 글자색 따르게 함께 지정. 전부 의미 토큰 — 하드코딩 0 |
| 3 | 원본 setAttrFocus 의 TYPE I(Information)/W(Warning) 분기 누락(원본 8255~8261) | 코덱스 P2-3 · 안티 P2-3 (동일) | **반영** | switch 에 `case "I" → "Information"`, `case "W" → "Warning"` 추가(원본 8246~8267 E/S/I/W 4종 1:1). BR52 이전부터 있던 결함이나 요청서가 원본 동치를 요구해 함께 해소 |
| 4 | 순서(선택→접기→smooth 스크롤→rAF 포커스)·접기/스크롤 무충돌·TYPE 미지정 경로·rAF FIFO·토큰 사용 | 코덱스·안티 공통 | 통과 확인 | 변경 없음 |

## 남긴 참고 (반영 범위 밖 — 보고만)

- 선택된 행이 동시에 "변경된 값" 행(changeValue)이면 라벨 색은 변경행 강조색이 이긴다(뒤에 오는 규칙). 원본에도 선택+변경 중첩 시 변경 강조가 겹치는 구조라 그대로 둠.
- `aria-selected` 를 단 행에 별도 키보드 선택 의미(role 등)는 부여하지 않음 — 속성 행은 클릭 선택 개념이 없고(이동 표시 전용), 원본 계약 밖 신규 UX 는 임의창작 금지.

## 반영 후 검증

- node --check 통과 (`ws_html5_ws20_attr.js`).
- CSS 는 스코프 클래스 한정, 공통 파일 무수정.
