# BR65 최종 (04)

## 판정: **완료**

| 항목 | 결과 |
|---|---|
| 코덱스 검수 | 통과 (P3 비차단 참고 1건) |
| 안티 검수 | 수정필요 P2 1건 → **반영 완료** |
| 남은 지적 | **0건** (반론·보류 없음) |
| 실화면 테스트 | `.works/bindpopup/00_히스토리.md` 그룹 BR65 **5건 전건 통과**(2026-09-03) |
| 노션 이슈 BR65 | **수정완료** |

## 최종 수정 내역

**주 수정** — `www/ws30/ws10_20/Popups/bindPopup/designArea/bindWrite.js`
원본 `Popups/bindPopup/index.js:6950 attrBindCallBackAggr` 의 BUSY 3단계를 1:1 복원.
(unbind 갈래 6976 / 6990 / 6999, 재바인딩 갈래 7051 / 7064 / 7075)
- 확인 팝업 표시 직후 → 이 팝업 BUSY 만 OFF (WS20 유지, 방송 없음)
- 확인 팝업 onClose → 이 팝업 BUSY 만 다시 ON
- 취소 판정 → `setBusyWS20Interaction(false, {})` 로 WS20+팝업 전체 OFF 후 `return`

**검수 반영** — 같은 파일 `_confirmAsync`
`U4AUI.confirm` 이 동기 경로로 `onClose` 를 반환 전에 부르는 경우 순서가 역전되던 것을
반환 여부 플래그로 막아 **표시 직후 OFF → 닫힘 후 ON → resolve** 순서를 강제.

**결합 작업(장군님 지시 2026-09-02)** — `window.confirm` / `window.alert` 전면 금지
BR65 지적의 뿌리였던 `U4AUI.confirm` 의 `window.confirm` fallback 제거를 포함해
**8파일 11곳** 정리(오류코드 표면화 + fail-closed). 상세·미처리 목록 = `03_response.md` 하단.
`.claude/rules/code.md` 에 금지 규칙 등재.

## 테스트 통과 항목

| 코드 | 확인 내용 |
|---|---|
| BR65-1 | 취소 시 Main·바인딩 팝업 BUSY 모두 해제, 즉시 조작 가능 |
| BR65-2 | 취소 시 Aggregation·하위 속성 바인딩 정보 유지 |
| BR65-3 | ESC 로 닫아도 동일 |
| BR65-4 | 확인 시 정상 재바인딩 + 하위 바인딩 초기화 + BUSY 해제 (회귀 없음) |
| BR65-5 | 미바인딩 Aggregation 은 확인 팝업 없이 바로 바인딩 (회귀 없음) |

## 남은 것

- **커밋·푸시 미실시** — 지시 대기.
- **`window.confirm`/`window.alert` 미처리 7곳** — 성격이 달라 별도 판단 필요(`03_response.md` 하단 표).
