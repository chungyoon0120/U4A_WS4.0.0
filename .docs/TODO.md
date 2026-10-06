# TODO — 남은 일 한눈에

> 갱신 **2026-10-06** · 브랜치 `bootstrap` = `54748b44` (원격 일치, 작업트리 0건)
> **앞으로 할 일은 이 파일 한 곳에만 둔다.** 끝난 항목은 지운다(끝난 일의 기록은 `history/` 에 남는다).
> 지금 상태 = [CURRENT.md](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/.docs/CURRENT.md) · 왜 그렇게 했는지 = [history/](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/.docs/history/)

---

## 1️⃣ 지금 정해 주실 것 — 5건

이것만 정해 주시면 나머지는 제가 움직입니다. **「1번 해」 처럼 번호로 답해 주십시오.**

| # | 무엇을 정하나 | 선택지 · 맥락 |
|---|---|---|
| 1 | **오늘 작업을 `main` 에도 머지할까** | 오늘 커밋 6건이 `bootstrap` 까지만 올라가 있다. 머지 지시가 없어서 멈춰 둠 |
| 2 | **지침서 2(오류 stack·오류 글을 console 까지 내보내기)를 커밋할까** | 코드는 넣고 dev mode 실측 통과(2026-10-01). 아직 커밋 안 함. `createUIInstance` 진입 기록은 안 넣은 상태 → [05_지침서2_현황판.md](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/.works/ws40-work-order/05_지침서2_현황판.md) |
| 3 | **오류 수집·전송을 착수할까 / 어떤 방향으로** | **아직 코드 한 줄도 없다** — 내용 정리 단계. 패키징 앱을 여러 곳에서 테스트 중인데 테스터가 오류를 일일이 적어 줄 수 없어서 나온 건. → [로그수집전송 현황판](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/.works/로그수집전송/00_현황판.md) |
| 4 | **별창 팝업 추가 기능 방향** | 구현 아님, 방향만 잡는 설계 문서. 정해 주실 것 3건 대기 → [별창팝업 현황판](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/.works/별창팝업/00_현황판.md) |
| 5 | **개발서버에 빠진 라이브러리 1건을 채울까** | 특정 UI 하나가 개발서버에만 없다. 쓰는 곳이 있는지까지 적혀 있음 → [라이브러리데이터누락 현황판](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/.works/라이브러리데이터누락/00_현황판.md) |

---

## 2️⃣ 장군님이 직접 하실 준비 작업 — 2건

제가 못 하는 일(비밀번호 입력 · 노션 조작)입니다.

| 무엇 | 왜 장군님이 | 어디 |
|---|---|---|
| SAP 접속 정보 파일 만들기 | **비밀번호가 들어간다** — 접속 정보가 아직 0건이라 스킬을 못 돌려 봄 | [sapAdt스킬 현황판](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/.works/sapAdt스킬/00_현황판.md) |
| 노션 테스트 현황 확인 7건 | 노션 화면 조작 | [노션현황판](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/.works/노션현황판/00_현황판.md) |

---

## 3️⃣ 앱 켜고 테스트해 주실 것 — 영역 24곳

**전부 코드는 넣었고 앱 확인만 안 된 상태입니다.** 많으니 위에서부터 몇 개씩 하시면 됩니다.
반드시 **앱을 껐다 켜고**(새로고침 아님), **dev mode** 로 보십시오(exe 는 테스트 안 하기로 정함).

### 큰 묶음 (20건 이상)

| 영역 | 남은 ☐ | 현황판 |
|---|---|---|
| 내부 데이터 모니터 | 62 | [열기](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/.works/데이터모니터/00_현황판.md) |
| 별창 — 뜨자마자 busy 켜기 | 32 | [열기](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/.works/별창busy시작/00_현황판.md) |
| 대형 바인딩 팝업 | 29 | [열기](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/.works/bindpopup/00_현황판.md) |
| UI 템플릿 마법사 | 25 | [열기](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/.works/wizard/00_현황판.md) |
| UI5 미리 정의된 CSS 팝업 | 20 | [열기](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/.works/ui5csspopup/00_현황판.md) |

### 중간 묶음 (6~19건)

| 영역 | 남은 ☐ | 현황판 |
|---|---|---|
| 앞 화면↔편집 화면 왕복 중 검정 화면 멈춤 | 19 | [열기](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/.works/검정화면멈춤/00_현황판.md) |
| 쇼컷링크 생성 | 18 | [열기](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/.works/숏컷링크생성/00_현황판.md) |
| 화면 이동 · 단축키 | 18 | [열기](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/.works/단축키생명주기/00_현황판.md) |
| 앱 이름 입력칸이 기준 (권한 잠금) | 16 | [열기](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/.works/앱이름입력값기준/00_현황판.md) |
| 원본 이식 전체 | 10 | [열기](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/.works/update/00_전체현황판.md) |
| 컨트롤러(클래스 빌더) 실행 | 9 | [열기](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/.works/execControllerClass/00_현황판.md) |
| 미리보기 오류 표면화 | 7 | [열기](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/.works/미리보기오류표면화/00_현황판.md) |
| 네트워크 끊김 화면 | 6 | [열기](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/.works/네트워크끊김화면/00_현황판.md) |
| WS4.0 catch 오류 기록 보강 | 6 | [열기](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/.works/ws40-work-order/00_현황판.md) |

### 작은 묶음 (1~5건)

| 영역 | 남은 ☐ | 현황판 |
|---|---|---|
| 클립보드 복사 | 5 | [열기](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/.works/클립보드복사/00_현황판.md) |
| 미리보기 우클릭 삭제 시 확인창 먹통 | 5 | [열기](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/.works/미리보기삭제BUSY/00_현황판.md) |
| UI 추가 팝업 (WS20) | 5 | [열기](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/.works/UI추가팝업/00_현황판.md) |
| 드래그 텍스트 복사 | 4 | [열기](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/.works/드래그복사/00_현황판.md) |
| 2026-08-16 원본 갱신분 | 4 | [열기](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/.works/update/20260818/00_현황판.md) |
| 메인 창 busy 를 공통 파일로 옮김 | 4 | [열기](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/.works/busy시작끝/00_현황판.md) |
| 일러스트 메시지 팝업 | 3 | [열기](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/.works/일러스트팝업/00_현황판.md) |
| 이미지 압축 설정 창 | 2 | [열기](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/.works/이미지압축설정/00_현황판.md) |
| 디자인 트리 우클릭 메뉴 | 1 | [열기](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/.works/디자인트리컨텍스트메뉴/00_현황판.md) |
| 속성 styleClass → CSS 편집기 | 1 | [열기](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/.works/속성styleClassCSS편집기/00_현황판.md) |

> 「속성 styleClass → CSS 편집기」는 맨 위에 "전부 통과·이관 완료" 라고 적혀 있는데 ☐ 가 1개 남아 있다.
> **아래쪽에 빠뜨린 항목이 있는지 확인이 필요하다**(내용 미확인).

---

## 4️⃣ 제가 할 코드 작업 — 4곳 (다음 지시 대기)

넷 다 **지시를 기다리는 상태**입니다. 세부는 각 현황판에 있습니다.

| 영역 | 지금까지 | 다음에 할 것 |
|---|---|---|
| 별창 busy 시작 | 코드 다 넣음 · 앱 확인 전 | 위 3️⃣ 테스트 결과를 받아 반영 |
| busy 시작·끝 전수 점검 | 기준 확정 + 기존 코드 목록만 뽑음 · **코드는 아직 안 고침** | 판정 순서·보고 단위를 정해 주시면 파일 단위로 판정 |
| busy 공통 파일 합치기 | 메인 창 busy 를 전용 파일로 옮김 · 앱 확인 전 | 위 테스트 통과 뒤, 남은 busy 를 합칠지 조사·제안 |
| 반드시 있어야 할 것이 없을 때 | 기준 확정(앱 종료로 통일) · **코드는 아직 안 고침** | 원장 목록을 파일 단위로 판정 |

---

## 5️⃣ 손대지 않은 채 남겨 둔 것 — 1건

| 무엇 | 왜 그대로 두나 |
|---|---|
| 옛 UI5 판 CSS 팝업에 테스트 잔재 | 그 화면 소스에 **「테스트 끝나면 반드시 주석을 풀것!!」** 이라 적힌 채 창 닫기 처리가 주석 처리돼 있다(2026-09-14 발견). 그 파일이 지금 로드되는 곳을 못 찾았다(**미확인**). 제가 만든 게 아니라 손대지 않았다 |
