# TODO — 남은 일 한눈에 (1~34번)

> 갱신 **2026-10-07** · `bootstrap` = `40491b22` / `main` = `2ab835c3`
> **번호는 문서 전체에 이어서 매긴다 — 「12번 해」 처럼 번호만 말하면 된다.**
> 끝난 항목은 지우고 **번호를 다시 매긴다**(빈 번호를 남기지 않는다).
> 지금 상태 = [CURRENT.md](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/.docs/CURRENT.md) · 왜 그렇게 했는지 = [history/](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/.docs/history/)
> ☐ 숫자는 **표 안의 실제 테스트 줄만** 센 값이다(설명 줄의 ☐ 는 안 센다).

---

## A. 바로 하실 것 — 1~2번

| 번호 | 무엇 | 내용 | 어디 |
|---|---|---|---|
| **1** | **어제 고친 것 테스트 (UT1~UT5)** | 디자인 미리보기에서 **UI 하나를 만들다 터졌을 때**, 그 UI 하나만 적지 말고 **ROOT 부터의 경로 + 형제 몇 번째 + 그 부모 밑에 붙어 있던 UI 들**을 같이 남기게 고쳤다. 장군님이 「조합 때문에 터진 오류는 어떻게 짚느냐」 고 지적하셔서다. **평소 로그 양은 0자**(성공하면 한 글자도 안 남는다). **앱을 완전히 껐다 켜고 dev mode 로** 본다. UT4 는 Console 에 붙여넣는 「UT4 재현 한 줄」 로 **일부러 터뜨린다** | [05_지침서2_현황판.md](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/.works/ws40-work-order/05_지침서2_현황판.md) 맨 위 · 왜 그렇게 정했나 = [06_진입기록_무엇인지_설명.md](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/.works/ws40-work-order/06_진입기록_무엇인지_설명.md) |
| **2** | **커밋 안 한 것 1건 — 커밋할까** | 1번의 UT4·UT5 를 「Console 로 일부러 터뜨리는」 절차로 다시 쓴 현황판 수정. 문서만 바뀠고 코드는 안 바뀠다 | 같은 현황판 |

---

## B. 정해 주실 것 — 3~5번

| 번호 | 무엇을 정하나 | 제 생각 | 어디 |
|---|---|---|---|
| **3** | **별창 팝업 — 「추가 디테일한 기능」이 화면인가, 동작인가, 둘 다인가** | 모르겠습니다. 장군님 머릿속 그림을 들어야 설계가 됩니다 | [별창팝업 현황판](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/.works/별창팝업/00_현황판.md) |
| **4** | **별창 팝업 — busy 방송 점검에서 새로 나온 결함 2건을 지금 고칠까, 따로 미룰까** | **지금 고친다.** busy 가 안 풀리는 쪽이면 조작이 영영 막힌다 | 같은 현황판 |
| **5** | **개발서버에 빠진 UI 1건을 채울까** | **채운다.** 운영서버엔 있고 개발서버에만 없어서, 개발서버로 작업할 때만 그 UI 를 못 쓴다 | [라이브러리데이터누락 현황판](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/.works/라이브러리데이터누락/00_현황판.md) |

---

## C. 제 코드 작업 — 착수 지시 대기 — 6~7번

| 번호 | 영역 | 지금까지 | 지시가 필요한 것 |
|---|---|---|---|
| **6** | busy 시작·끝 전수 점검 | 기준 확정 + 기존 코드 목록만 뽑음 · **전수 판정분은 코드 한 줄도 안 고침** | **어느 순서로 판정할지** 정해 주시면 파일 단위로 시작 → [현황판](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/.works/busy시작끝/00_현황판.md) |
| **7** | 반드시 있어야 할 것이 없을 때 | 기준 확정(앱 종료로 통일) · 보고 단위도 정해짐(파일 단위) · **코드 한 줄도 안 고침** | **착수 지시** → [현황판](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/.works/필수의존성크리티컬/00_현황판.md) |

---

## D. 장군님이 직접 하실 준비 작업 — 8~9번

제가 못 하는 일(비밀번호 입력 · 노션 조작)입니다.

| 번호 | 무엇 | 남은 ☐ | 왜 장군님이 | 어디 |
|---|---|---|---|---|
| **8** | SAP 접속 정보 파일 만들기 | 7 | **비밀번호가 들어간다** — 접속 정보가 0건이라 그 기능을 돌려 본 적이 없음 | [sapAdt스킬 현황판](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/.works/sapAdt스킬/00_현황판.md) |
| **9** | 노션 테스트 현황 확인 | 7 | 노션 화면 조작 | [노션현황판](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/.works/노션현황판/00_현황판.md) |

---

## E. 앱 켜고 테스트해 주실 것 — 10~32번

**전부 코드는 넣었고 앱 확인만 안 된 상태입니다.** 급하지 않습니다 — 번호 큰 것(작은 묶음)부터 하셔도 됩니다.
반드시 **앱을 껐다 켜고**(새로고침 아님), **dev mode** 로 보십시오(exe 는 테스트 안 하기로 정함).

| 번호 | 영역 | 남은 ☐ | 현황판 |
|---|---|---|---|
| **10** | 내부 데이터 모니터 | 62 | [열기](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/.works/데이터모니터/00_현황판.md) |
| **11** | 오류 수집·전송 (1차 구현분) | 34 | [열기](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/.works/로그수집전송/00_현황판.md) |
| **12** | 별창 — 뜨자마자 busy 켜기 | 32 | [열기](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/.works/별창busy시작/00_현황판.md) |
| **13** | 대형 바인딩 팝업 | 28 | [열기](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/.works/bindpopup/00_현황판.md) |
| **14** | UI 템플릿 마법사 | 24 | [열기](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/.works/wizard/00_현황판.md) |
| **15** | 앞 화면↔편집 화면 왕복 중 검정 화면 멈춤 | 19 | [열기](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/.works/검정화면멈춤/00_현황판.md) |
| **16** | UI5 미리 정의된 CSS 팝업 | 19 | [열기](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/.works/ui5csspopup/00_현황판.md) |
| **17** | 쇼컷링크 생성 | 18 | [열기](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/.works/숏컷링크생성/00_현황판.md) |
| **18** | 화면 이동 · 단축키 | 18 | [열기](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/.works/단축키생명주기/00_현황판.md) |
| **19** | 앱 이름 입력칸이 기준 (권한 잠금) | 16 | [열기](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/.works/앱이름입력값기준/00_현황판.md) |
| **20** | 원본 이식 전체 | 10 | [열기](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/.works/update/00_전체현황판.md) |
| **21** | 컨트롤러(클래스 빌더) 실행 | 9 | [열기](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/.works/execControllerClass/00_현황판.md) |
| **22** | 미리보기 오류 표면화 | 6 | [열기](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/.works/미리보기오류표면화/00_현황판.md) |
| **23** | 네트워크 끊김 화면 | 6 | [열기](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/.works/네트워크끊김화면/00_현황판.md) |
| **24** | WS4.0 catch 오류 기록 보강 | 6 | [열기](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/.works/ws40-work-order/00_현황판.md) |
| **25** | 클립보드 복사 | 5 | [열기](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/.works/클립보드복사/00_현황판.md) |
| **26** | 미리보기 우클릭 삭제 시 확인창 먹통 | 5 | [열기](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/.works/미리보기삭제BUSY/00_현황판.md) |
| **27** | UI 추가 팝업 (WS20) | 5 | [열기](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/.works/UI추가팝업/00_현황판.md) |
| **28** | 드래그 텍스트 복사 | 4 | [열기](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/.works/드래그복사/00_현황판.md) |
| **29** | 2026-08-16 원본 갱신분 | 4 | [열기](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/.works/update/20260818/00_현황판.md) |
| **30** | 메인 창 busy 를 공통 파일로 옮김 | 4 | [열기](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/.works/busy시작끝/00_현황판.md) |
| **31** | 일러스트 메시지 팝업 | 3 | [열기](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/.works/일러스트팝업/00_현황판.md) |
| **32** | 이미지 압축 설정 창 | 2 | [열기](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/.works/이미지압축설정/00_현황판.md) |

> 「라이브러리 데이터 누락」 의 남은 ☐ 2건 중 1건은 **5번(정해 주실 것)** 이고, 나머지 1건은 그 결정 뒤에 확인하는 것이라 여기 따로 번호를 두지 않았다.

---

## F. 손대지 않은 채 남겨 둔 것 — 33~34번

| 번호 | 무엇 | 왜 그대로 두나 |
|---|---|---|
| **33** | 옛 UI5 판 CSS 팝업에 테스트 잔재 | 그 화면 소스에 **「테스트 끝나면 반드시 주석을 풀것!!」** 이라 적힌 채 창 닫기 처리가 주석 처리돼 있다(2026-09-14 발견). 그 파일이 지금 로드되는 곳을 못 찾았다(**미확인**). 제가 만든 게 아니라 손대지 않았다 |
| **34** | Claude 도구 폴더 안 설치 파일 4개가 바뀐 채 있다 | `.claude/mcp/` 아래 Python 설치 정보 파일들이다. **제가 고친 것이 아니다** — 그 도구를 돌릴 때 스스로 바뀐 것으로 보인다(**미확인**). 지우거나 커밋하는 것은 지시를 기다린다 |
