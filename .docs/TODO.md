# TODO — 남은 일 한눈에 (1~40번)

> 갱신 **2026-10-12** · `bootstrap` = `790697f8` / `main` = `2ab835c3`(안 올림)
> **번호는 문서 전체에 이어서 매긴다 — 「12번 해」 처럼 번호만 말하면 된다.**
> 끝난 항목은 지우고 **번호를 다시 매긴다**(빈 번호를 남기지 않는다).
> 지금 상태 = [CURRENT.md](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/.docs/CURRENT.md) · 왜 그렇게 했는지 = [history/](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/.docs/history/)

## 누가 하나

| 누가 | 번호 | 건수 |
|---|---|---|
| **장군님** | 1~10 (정하기) · 14~15 (직접) · 16~38 (테스트) | **35** |
| 저 | 11~13 (착수 지시만 주시면) | 3 |
| 아무도 (그대로 둠) | 39~40 | 2 |

> **지금 안 끝난 것**: 버그 작업을 시작하려면 **버그 목록을 어디서 가져올지** 정해 주셔야 합니다 —
> ① 노션 이슈 DB(추천) ② 장군님이 말씀하시는 증상 ③ 앱 로그 파일. 정하시면 그 결과를 여기 번호로 올립니다.

---

## A. 장군님이 정하실 것 — 1~10번

| 번호 | 무엇을 정하나 | 제 생각 | 어디 |
|---|---|---|---|
| **1** | **별창 팝업 — 「추가 디테일한 기능」이 화면인가, 동작인가, 둘 다인가** | 모르겠습니다. 장군님 머릿속 그림을 들어야 설계가 됩니다 | [별창팝업 현황판](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/.works/별창팝업/00_현황판.md) |
| **2** | **별창 팝업 — busy 방송 점검에서 새로 나온 결함 2건을 지금 고칠까, 따로 미룰까** | **지금 고친다.** busy 가 안 풀리는 쪽이면 조작이 영영 막힌다 | 같은 현황판 |
| **3** | **개발서버에 빠진 UI 1건을 채울까** | **채운다.** 운영서버엔 있고 개발서버에만 없어서, 개발서버로 작업할 때만 그 UI 를 못 쓴다 | [라이브러리데이터누락 현황판](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/.works/라이브러리데이터누락/00_현황판.md) |
| **4** | **`.works` 에 쌓인 히스토리 파일 30개를 어떻게 할까** | **그냥 지운다.** 지운 내용은 깃 커밋에 그대로 남아 있어 잃는 것이 없습니다 | [폴더정리 후보](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/.works/00_폴더정리_후보.md) |
| **5** | **이력 도구 쪽 규칙을 새 지시에 맞게 고칠까** | **고친다.** `D:\workspace\yoon-history\rules.md` 와 통과표시 도구가 아직 옛 지시(「이력남겨」 할 때만 · 히스토리로 이관)로 돼 있어 저와 어긋납니다. 프로젝트 밖 파일이라 지시를 기다립니다 | — |
| **6** | **화면 글꼴을 무엇으로 할까 — ① SAP 72 ② Pretendard ③ SUIT ④ Noto Sans KR ⑤ IBM Plex Sans KR ⑥ 그대로 둔다** | **②.** 72 에는 **한글이 없습니다**(파일이 58KB — 한글은 1MB 가 넘는다) → 영문·숫자만 바뀌고 한글은 PC 글꼴로 남아 섞입니다. 라이선스도 「SAP 고유 글꼴」과 「Apache 2.0 으로 내려받기」가 함께 적혀 불확실합니다. 후보 5개는 전부 OFL(상업 사용 가능)이고 라이선스·파일 크기를 직접 재어 비교해 뒀습니다. 고칠 곳은 토큰 한 줄 + 글꼴 선언뿐 | [폰트 현황판](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/.works/폰트/00_현황판.md) |
| **7** | **파일 읽기도 레지스트리처럼 가짜 값을 보는지 확인할까** | **확인한다.** 레지스트리가 틀린 값을 보는 것이 2026-10-12 확정됐는데, 파일까지 같은 문제면 소스 조사·검증이 전부 틀어집니다. 확인법 = 장군님이 터미널에서 파일 하나에 글자를 써 주시고 제가 읽어 비교 | — |
| **8** | **하던 일 중간에 딴 문제가 끼어들 때 어떻게 할까** — ① 코드는 안 고치고 **TODO 에 적고 하던 일 계속**(추천) ② 그 자리에 **로그만 심고** 하던 일 계속 ③ 지금처럼 바로 고치러 간다 | **①+② 같이.** 오늘만 해도 로그오프 테스트 → 소스 패턴 버튼 → SAPGUI 건으로 세 갈래가 났습니다. 원인을 모르는 건을 바로 고치러 가면 지난번처럼 **틀린 결론만 쌓입니다**(가짜 레지스트리 값 사건). 로그만 심어 두면 다음에 터질 때 한 번에 잡힙니다 | [TODO 8번 설명](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/.works/execControllerClass/03_SAPGUI대기팝업_안닫힘_조사.md) |
| **9** | **SAPGUI 실행 길목에 로그 4곳을 심을까** (1차 VBS 결과 · 2차 VBS 띄움 여부 · 1초 감시 읽은 값 · 30초 끝났을 때 마지막 값) | **심는다.** 지금은 그 길에 로그가 **0줄**이라 터져도 아무것도 안 남습니다. **동작은 1도 안 바뀝니다**(기록만 추가). 이걸 안 심어서 오늘 또 깜깜하게 당했습니다 | [SAPGUI 조사](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/.works/execControllerClass/03_SAPGUI대기팝업_안닫힘_조사.md) |
| **10** | **「끝남」으로 닫는 기준을 정할까** — 원인을 못 찾고 증상만 사라진 건은 **「끝남」으로 안 닫는다** | **그렇게 한다.** SAPGUI 건을 「PC 재부팅으로 해결」로 닫았다가 오늘 그대로 재발했습니다. 원인 미상이면 **「원인 미상 · 감시 중」** 으로 남기고 로그를 심어 둡니다 | 같은 문서 |

---

## B. 제 코드 작업 — 착수 지시 대기 — 11~13번

| 번호 | 영역 | 지금까지 | 지시가 필요한 것 |
|---|---|---|---|
| **11** | busy 시작·끝 전수 점검 | 기준 확정 + 기존 코드 목록만 뽑음 · **전수 판정분은 코드 한 줄도 안 고침** | **어느 순서로 판정할지** 정해 주시면 파일 단위로 시작 → [현황판](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/.works/busy시작끝/00_현황판.md) |
| **12** | 반드시 있어야 할 것이 없을 때 | 기준 확정(앱 종료로 통일) · 보고 단위도 정해짐(파일 단위) · **코드 한 줄도 안 고침** | **착수 지시** → [현황판](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/.works/필수의존성크리티컬/00_현황판.md) |
| **13** | 별창 팝업 parent 제거 — 8~26번 (19곳) | 공통 전환 끝 · **1~5번 통과** · **6번 = parent 유지로 닫음**(장군님 결정 2026-10-08) · **7번 통과**(2026-10-12) · **메인 창이 죽을 때 별창 전부 닫기**(로그오프·창 닫기·세션 종료 + 앱 바깥 그물) 도 고쳐 테스트 대기 | **LO1~LO4 테스트 결과(O/X)** 주시면 8번으로 → [로그오프 테스트](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/.works/별창팝업/02_로그오프시_별창_안닫힘.md) ·  [진행현황](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/.works/별창팝업/01_parent제거_진행현황.md) |

---

## C. 장군님이 직접 하실 준비 작업 — 14~15번

제가 못 하는 일(비밀번호 입력 · 노션 조작)입니다.

| 번호 | 무엇 | 남은 ☐ | 왜 장군님이 | 어디 |
|---|---|---|---|---|
| **14** | SAP 접속 정보 파일 만들기 | 7 | **비밀번호가 들어간다** — 접속 정보가 0건이라 그 기능을 돌려 본 적이 없음 | [sapAdt스킬 현황판](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/.works/sapAdt스킬/00_현황판.md) |
| **15** | 노션 테스트 현황 확인 | 7 | 노션 화면 조작 | [노션현황판](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/.works/노션현황판/00_현황판.md) |

---

## D. 앱 켜고 테스트해 주실 것 — 16~38번

**전부 코드는 넣었고 앱 확인만 안 된 상태입니다.** 급하지 않습니다 — **번호 큰 것(건수 적은 것)부터** 하시면 빨리 줄어듭니다.
반드시 **앱을 껐다 켜고**(새로고침 아님), **dev mode** 로 보십시오(exe 는 테스트 안 하기로 정함).

| 번호 | 영역 | 남은 ☐ | 현황판 |
|---|---|---|---|
| **16** | 내부 데이터 모니터 | 62 | [열기](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/.works/데이터모니터/00_현황판.md) |
| **17** | 오류 수집·전송 (1차 구현분) | 34 | [열기](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/.works/로그수집전송/00_현황판.md) |
| **18** | 별창 — 뜨자마자 busy 켜기 | 32 | [열기](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/.works/별창busy시작/00_현황판.md) |
| **19** | 대형 바인딩 팝업 | 28 | [열기](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/.works/bindpopup/00_현황판.md) |
| **20** | UI 템플릿 마법사 | 24 | [열기](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/.works/wizard/00_현황판.md) |
| **21** | 앞 화면↔편집 화면 왕복 중 검정 화면 멈춤 | 19 | [열기](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/.works/검정화면멈춤/00_현황판.md) |
| **22** | UI5 미리 정의된 CSS 팝업 | 19 | [열기](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/.works/ui5csspopup/00_현황판.md) |
| **23** | 쇼컷링크 생성 | 18 | [열기](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/.works/숏컷링크생성/00_현황판.md) |
| **24** | 화면 이동 · 단축키 | 18 | [열기](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/.works/단축키생명주기/00_현황판.md) |
| **25** | 앱 이름 입력칸이 기준 (권한 잠금) | 16 | [열기](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/.works/앱이름입력값기준/00_현황판.md) |
| **26** | 원본 이식 전체 | 10 | [열기](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/.works/update/00_전체현황판.md) |
| **27** | 컨트롤러(클래스 빌더) 실행 | 9 | [열기](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/.works/execControllerClass/00_현황판.md) |
| **28** | 미리보기 오류 표면화 | 6 | [열기](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/.works/미리보기오류표면화/00_현황판.md) |
| **29** | 네트워크 끊김 화면 | 6 | [열기](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/.works/네트워크끊김화면/00_현황판.md) |
| **30** | WS4.0 catch 오류 기록 보강 | 6 | [열기](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/.works/ws40-work-order/00_현황판.md) |
| **31** | 클립보드 복사 | 5 | [열기](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/.works/클립보드복사/00_현황판.md) |
| **32** | 미리보기 우클릭 삭제 시 확인창 먹통 | 5 | [열기](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/.works/미리보기삭제BUSY/00_현황판.md) |
| **33** | UI 추가 팝업 (WS20) | 5 | [열기](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/.works/UI추가팝업/00_현황판.md) |
| **34** | 드래그 텍스트 복사 | 4 | [열기](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/.works/드래그복사/00_현황판.md) |
| **35** | 2026-08-16 원본 갱신분 | 4 | [열기](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/.works/update/20260818/00_현황판.md) |
| **36** | 메인 창 busy 를 공통 파일로 옮김 | 4 | [열기](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/.works/busy시작끝/00_현황판.md) |
| **37** | 일러스트 메시지 팝업 | 3 | [열기](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/.works/일러스트팝업/00_현황판.md) |
| **38** | 이미지 압축 설정 창 | 2 | [열기](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/.works/이미지압축설정/00_현황판.md) |

---

## E. 손대지 않은 채 남겨 둔 것 — 39~40번

| 번호 | 무엇 | 왜 그대로 두나 |
|---|---|---|
| **39** | 옛 UI5 판 CSS 팝업에 테스트 잔재 | 그 화면 소스에 **「테스트 끝나면 반드시 주석을 풀것!!」** 이라 적힌 채 창 닫기 처리가 주석 처리돼 있다(2026-09-14 발견). 그 파일이 지금 로드되는 곳을 못 찾았다. 제가 만든 게 아니라 손대지 않았다 |
| **40** | Claude 도구 폴더 안 설치 파일 4개 | `.claude/mcp/` 아래 Python 설치 정보 파일들이다. **제가 고친 것이 아니다** — 그 도구를 돌릴 때 스스로 바뀐 것으로 보인다. 앞으로 또 바뀌면 깃에서 빼 둘지(`.gitignore`) 지시를 기다린다 |

---

## 끝난 것 (지우기 전 한 번만 적어 둠)

- ~~미리보기에서 UI 가 터졌을 때 조합 남기기 + 로그에 비밀번호 찍히던 것 제거~~
  → 코드 `4acd1abc`(2026-10-07) · 테스트 UT1~UT5 · PW1~PW4 **전 항목 통과** · 2026-10-07 장군님 「이건 다 했다 치고 넘어가자」 로 묶음 닫음
