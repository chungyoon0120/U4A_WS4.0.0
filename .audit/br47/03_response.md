# BR47 보완·해명 (03_response)

## 검수 결과 요약
| 검수자 | 판정 | 필수 수정 |
|---|---|---|
| Codex (`02_audit_codex.md`) | **통과** | 0건 |
| Antigravity (`02_audit_agy.md`) | **통과** | 0건 |

두 검수 모두 통과. 원본(UI5) `[선택 await → 한 틱 → 메뉴]` 직렬화를 HTML5 트리 우클릭 핸들러에
1:1 복원한 것이 회귀 원인을 정확히 해소했다고 확인. **추가 코드 수정 없음(반영 0).**

---

## 지적 취합 표 (반영/반론)
| # | 지적/검토 항목 | 검수자 | 판정 | 처리 |
|---|---|---|---|---|
| 1 | 원본 1:1 순서(await 선택→setTimeout(0)→메뉴) 보존 | Codex·Anti | 통과 | 변경 없음 |
| 2 | `_safeCall`이 Promise 전파, `setSelectTreeItem`=Promise 반환 | Codex·Anti | 통과 | 변경 없음 |
| 3 | 팝업 open·후속 렌더 완료까지 await 후 메뉴 표시 | Codex·Anti | 통과 | 변경 없음 |
| 4 | blur-close(0ms)와 메뉴 오픈(0ms)의 FIFO 순서 → 한 틱으로 충분 | Codex·Anti | 통과 | 변경 없음 |
| 5 | 좌표 await 전 원시값 복사(이벤트 풀링 방어) | Codex·Anti | 통과 | 변경 없음 |
| 6 | await 후 `n` stale 되어도 `_buildItems`가 OBJID로 재조회 | Codex·Anti | 통과 | 변경 없음 |
| 7 | 연속 우클릭·ROOT/APP·일반 UI 회귀 없음(busy 차단+`_closeMenu` 선제) | Codex·Anti | 통과 | 변경 없음 |
| 8 | catch에서 오류 표면화(console.warn), busy/잠금은 fnWs20SelectUI finally 회수 | Codex·Anti | 통과 | 변경 없음 |

### 비차단(non-blocking) 검토 — BR47 결함 아님, 미반영
| 항목 | 검수자 | 판단 |
|---|---|---|
| `refreshPreview`의 `new Promise(async executor)`가 예외 시 pending 잔류 가능 | Codex | **반론(별건)**: BR47 이전부터 존재, 원본 선택 경로도 공유, 정상 팝업 메서드에서 재현 근거 없음. BR47 범위 밖 → 별도 이슈 권고. |
| `_safeCall` 내부 동기 예외는 자체 삼킴 → 외부 catch 로그 미남을 수 있음 | Codex | **반론**: 메뉴 계속 표시라는 복구 계약에 영향 없고, 이번 변경으로 생긴 회귀 아님. 변경 없음. |

---

## 최종
- 반영 코드 수정: **0건**(두 검수 통과, 지적 없음).
- 수정 파일: `www/ws30/ws10_20/js/ws_html5_ws20_tree.js` (트리 우클릭 핸들러 1곳, 원본 직렬화 복원).
- 백업: `_ws_html5_ws20_tree.js.br47bak`. `node --check` 통과(tree/prev/attr 3파일 + `git diff --check`).
- 남은 것: 실화면 확인(팝업형·비팝업형 각각 우클릭 시 메뉴 유지·좌표·enable). 테스트 표는
  `.works/디자인트리컨텍스트메뉴/00_현황판.md`.
