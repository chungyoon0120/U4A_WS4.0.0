# TODO — 남은 일 한눈에

> 갱신 **2026-10-06** · 브랜치 `bootstrap` = `df84f079` / `main` = `c6f1d564`
> **앞으로 할 일은 이 파일 한 곳에만 둔다.** 끝난 항목은 지운다(끝난 일의 기록은 `history/` 에 남는다).
> 지금 상태 = [CURRENT.md](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/.docs/CURRENT.md) · 왜 그렇게 했는지 = [history/](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/.docs/history/)
> 아래 ☐ 숫자는 **표 안의 실제 테스트 줄만** 센 값이다(설명 줄의 ☐ 는 안 센다 — 2026-10-06 바로잡음).

---

## 1️⃣ 지금 정해 주실 것 — 4건

**「1번 해」 처럼 번호로 답해 주십시오.**

| # | 무엇을 정하나 | 제 생각 | 근거 문서 |
|---|---|---|---|
| 1 | **UI 하나를 만들 때마다 진입 기록을 남길까** | **넣지 않는다.** 이 처리는 트리의 UI 한 줄마다 돌아서 UI 100개 앱이면 100줄이 쌓인다. 실패하면 이미 객체 이름·UI5 class 이름이 오류 줄에 찍힌다 | [지침서 2 현황판](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/.works/ws40-work-order/05_지침서2_현황판.md) |
| 2 | **별창 팝업 — 「추가 디테일한 기능」이 화면인가 동작인가 둘 다인가** | 모르겠습니다. 장군님 머릿속 그림을 들어야 설계가 됩니다 | [별창팝업 현황판](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/.works/별창팝업/00_현황판.md) |
| 3 | **별창 팝업 — busy 방송 점검에서 새로 나온 결함 2건을 지금 고칠까, 따로 미룰까** | **지금 고친다.** busy 가 안 풀리는 쪽이면 조작이 영영 막힌다 | 같은 현황판 |
| 4 | **개발서버에 빠진 UI 1건을 채울까** | **채운다.** 운영서버엔 있고 개발서버에만 없어서, 개발서버로 작업할 때만 그 UI 를 못 쓴다 | [라이브러리데이터누락 현황판](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/.works/라이브러리데이터누락/00_현황판.md) |

---

## 2️⃣ 제 코드 작업 — 착수 지시를 기다리는 것 2건

| 영역 | 지금까지 | 지시가 필요한 것 |
|---|---|---|
| busy 시작·끝 전수 점검 | 기준 확정 + 기존 코드 목록만 뽑음 · **전수 판정분은 코드 한 줄도 안 고침** | **어느 순서로 판정할지** 정해 주시면 파일 단위로 시작 → [현황판](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/.works/busy시작끝/00_현황판.md) |
| 반드시 있어야 할 것이 없을 때 | 기준 확정(앱 종료로 통일) · 보고 단위도 정해짐(파일 단위) · **코드는 한 줄도 안 고침** | **착수 지시** → [현황판](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/.works/필수의존성크리티컬/00_현황판.md) |

---

## 3️⃣ 장군님이 직접 하실 준비 작업 — 2건

제가 못 하는 일(비밀번호 입력 · 노션 조작)입니다.

| 무엇 | 남은 ☐ | 왜 장군님이 | 어디 |
|---|---|---|---|
| SAP 접속 정보 파일 만들기 | 7 | **비밀번호가 들어간다** — 접속 정보가 0건이라 그 기능을 돌려 본 적이 없음 | [sapAdt스킬 현황판](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/.works/sapAdt스킬/00_현황판.md) |
| 노션 테스트 현황 확인 | 7 | 노션 화면 조작 | [노션현황판](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/.works/노션현황판/00_현황판.md) |

---

## 4️⃣ 앱 켜고 테스트해 주실 것 — 영역 24곳

**전부 코드는 넣었고 앱 확인만 안 된 상태입니다.** 많으니 위에서부터 몇 개씩 하시면 됩니다.
반드시 **앱을 껐다 켜고**(새로고침 아님), **dev mode** 로 보십시오(exe 는 테스트 안 하기로 정함).

### 큰 묶음 (19건 이상)

| 영역 | 남은 ☐ | 현황판 |
|---|---|---|
| 내부 데이터 모니터 | 62 | [열기](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/.works/데이터모니터/00_현황판.md) |
| 오류 수집·전송 (1차 구현분) | 34 | [열기](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/.works/로그수집전송/00_현황판.md) |
| 별창 — 뜨자마자 busy 켜기 | 32 | [열기](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/.works/별창busy시작/00_현황판.md) |
| 대형 바인딩 팝업 | 28 | [열기](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/.works/bindpopup/00_현황판.md) |
| UI 템플릿 마법사 | 24 | [열기](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/.works/wizard/00_현황판.md) |
| 앞 화면↔편집 화면 왕복 중 검정 화면 멈춤 | 19 | [열기](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/.works/검정화면멈춤/00_현황판.md) |
| UI5 미리 정의된 CSS 팝업 | 19 | [열기](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/.works/ui5csspopup/00_현황판.md) |

### 중간 묶음 (6~18건)

| 영역 | 남은 ☐ | 현황판 |
|---|---|---|
| 쇼컷링크 생성 | 18 | [열기](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/.works/숏컷링크생성/00_현황판.md) |
| 화면 이동 · 단축키 | 18 | [열기](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/.works/단축키생명주기/00_현황판.md) |
| 앱 이름 입력칸이 기준 (권한 잠금) | 16 | [열기](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/.works/앱이름입력값기준/00_현황판.md) |
| 원본 이식 전체 | 10 | [열기](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/.works/update/00_전체현황판.md) |
| 컨트롤러(클래스 빌더) 실행 | 9 | [열기](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/.works/execControllerClass/00_현황판.md) |
| 오류 stack·오류 글을 console 까지 (지침서 2) | 7 | [열기](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/.works/ws40-work-order/05_지침서2_현황판.md) |
| 미리보기 오류 표면화 | 6 | [열기](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/.works/미리보기오류표면화/00_현황판.md) |
| 네트워크 끊김 화면 | 6 | [열기](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/.works/네트워크끊김화면/00_현황판.md) |
| WS4.0 catch 오류 기록 보강 | 6 | [열기](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/.works/ws40-work-order/00_현황판.md) |

### 작은 묶음 (2~5건)

| 영역 | 남은 ☐ | 현황판 |
|---|---|---|
| 클립보드 복사 | 5 | [열기](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/.works/클립보드복사/00_현황판.md) |
| 미리보기 우클릭 삭제 시 확인창 먹통 | 5 | [열기](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/.works/미리보기삭제BUSY/00_현황판.md) |
| UI 추가 팝업 (WS20) | 5 | [열기](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/.works/UI추가팝업/00_현황판.md) |
| 드래그 텍스트 복사 | 4 | [열기](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/.works/드래그복사/00_현황판.md) |
| 2026-08-16 원본 갱신분 | 4 | [열기](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/.works/update/20260818/00_현황판.md) |
| 메인 창 busy 를 공통 파일로 옮김 | 4 | [열기](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/.works/busy시작끝/00_현황판.md) |
| 일러스트 메시지 팝업 | 3 | [열기](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/.works/일러스트팝업/00_현황판.md) |
| 라이브러리 데이터 누락 — 다시 확인 | 2 | [열기](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/.works/라이브러리데이터누락/00_현황판.md) |
| 이미지 압축 설정 창 | 2 | [열기](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/.works/이미지압축설정/00_현황판.md) |

---

## 5️⃣ 손대지 않은 채 남겨 둔 것 — 1건

| 무엇 | 왜 그대로 두나 |
|---|---|
| 옛 UI5 판 CSS 팝업에 테스트 잔재 | 그 화면 소스에 **「테스트 끝나면 반드시 주석을 풀것!!」** 이라 적힌 채 창 닫기 처리가 주석 처리돼 있다(2026-09-14 발견). 그 파일이 지금 로드되는 곳을 못 찾았다(**미확인**). 제가 만든 게 아니라 손대지 않았다 |
