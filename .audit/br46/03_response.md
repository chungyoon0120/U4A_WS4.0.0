# BR46 검수 반영·해명 (03_response)

두 검수(코덱스·안티)를 모두 읽고 지적을 한 표로 합쳐 정리한다.

## 지적 취합 표

| # | 지적(요약) | 제기 | 판정 | 처리 |
|---|---|---|---|---|
| 1 | `_rerenderParentRTE` 마지막 `await Promise.all(aRte)`가 **빈 catch**로 오류를 삼킴 | 안티 P2 (코덱스는 "이 Promise들은 reject 안 함"으로 최초 P2 **철회**) | **반영** | 빈 catch → `console.error` 표면화(code.md "조용한 catch 금지"). 코덱스 철회 사유(reject 미발생)와 무관하게 규칙 준수·무해. |
| 2 | 비동기 대기(`await _rerenderParentRTE`) 동안 **현재 WS20 메인 창 무잠금** → 대기 중 대상(부모) 삭제 시 렌더 이벤트 미도래로 **영구 대기**·자식창 잠금 해제 누락 가능 | 코덱스 P1 / 안티 P1 | **반론(별건, BR60)** | 원본 `designAddUIObject`도 `await` 전후 메인창 잠금 없음(상위 팝업 문맥 관리). WS20 비동기 무잠금은 BR46 고유가 아니라 프리셋 조회·D&D·삭제 등 전반의 선재 구조 사안 → BR43(6c)/BR44(7c)와 동일하게 **전역 공통 잠금(BR60)**으로 분리. 안티도 동일 반론. |
| 3 | 원본은 삽입 **전에** 부모 렌더완료 리스너(`setAfterRendering`)를 선등록하나, 현행은 모든 미리보기 변이 **후**에 등록 → 선등록 경쟁방지 상실("원본 1:1 아님") | 코덱스 P2 | **반론** | 원본 모듈 `setOnAfterRender.js` 확인: 이 부모 Promise는 **명시적 `oTarget.rerender()` 호출**(등록 뒤 실행)이 `onAfterRendering`을 동기 발화시켜 resolve한다. 즉 resolve를 **미리보기 변이의 예약 렌더가 아니라 명시 rerender가 구동**하므로, 리스너 등록이 삽입 앞/뒤여도 결과 동일(최악=여분 렌더 1회, 누락·고착 없음). 또한 현행은 **검증된 정상 형제 경로 `_rerenderCore`(dnd.js)와 1:1**이며, RTE 자식 수집(`renderingRichTextEditor`)의 삽입-후 시점은 원본 5651과 완전 동일. prepare/complete 2단계 분리는 형제와 어긋나고 재현 이득이 없어 미채택. |

## 반영한 코드 수정

- `www/ws30/ws10_20/js/ws_html5_ws20_edit.js` — `_rerenderParentRTE` 의 RTE 렌더 완료 대기 catch:
  - 변경 전: `try { await Promise.all(aRte); } catch (e) { }`
  - 변경 후: `try { await Promise.all(aRte); } catch (e) { console.error("[HTML5][WS20][insert] RTE 렌더 대기:", e && e.message ? e.message : e); }`
- `node --check` 통과.

## 반론 근거 상세

### 지적 2 (메인창 무잠금) — BR60 분리
- 원본 `uiDesignArea.js designAddUIObject`(5405~5666)는 `await` 구간에 `setBusy`/락 없음. 락은 상위 팝업/디스패처 문맥에서 관리하는 구조.
- BR46이 추가한 `await`는 삽입 루프 **종료 후·트리 갱신 전**이라 삽입 자체는 이미 끝난 상태이며, 원본도 동일 위치에서 `await`한다(5660/5666).
- "대기 중 대상 삭제→영구 대기"는 미리보기 렌더 창 안의 재진입 노출로, 메인창을 잠그지 않는 HTML5 WS20 전반이 공유하는 선재 사안. 개별 패치가 아니라 전역 공통 잠금(BR60)이 옳음(BR43/BR44와 동일 분류). 타임아웃/취소는 원본에 없는 동작이라 임의 추가하지 않음.

### 지적 3 (리스너 선등록 순서) — 명시 rerender가 resolve 구동
- `setAfterRendering(oTarget)`(setOnAfterRender.js 15~85): 부모가 RTE가 아니면 `addEventDelegate({onAfterRendering})` 분기 → **다음 `rerender()` 시 발화**해 resolve.
- 현행/원본 모두 등록 뒤 **명시 `oTarget.rerender()`**를 호출(setOnAfterRender 계약상 동기 재렌더 → `onAfterRendering` 발화 → resolve). 삽입 변이가 예약한 렌더가 등록보다 먼저 일어나도, 명시 rerender가 다시 발화시키므로 resolve 누락·고착 없음.
- RTE 자식 완료 배열(`renderingRichTextEditor`)은 원본과 동일하게 삽입 후 수집(5651) → 시점 동일.
- 현행은 정상 동작하는 형제 D&D `_rerenderCore`와 1:1. 2단계 분리는 형제와 불일치·재현 이득 0 → 미채택.

## 확인된 정상 범위 (양측 통과)
- 부모(is_tree) 기준 대상 탐색, 완료 순서(등록→RTE수집→rerender→부모 await→RTE await), 다건 삽입 후 1회 호출, 미리보기 미로드 가드, UI 추가 팝업 내 신규 D&D도 동일 경로 await, KEEP-UI5 경계(원본 `design/` 무수정).

## 후속
- 실화면 테스트: `.works/UI추가팝업/00_현황판.md` BR46-1~3.
- BR60(WS20 비동기 구간 전역 공통 잠금) = 별건 등록 대상(BR43/BR44/BR49와 공통).
