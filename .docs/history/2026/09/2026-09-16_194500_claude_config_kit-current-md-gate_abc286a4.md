# 공용 킷 훅에 CURRENT.md 갱신 지침·강제 추가 + 0.9.14 빌드

## 요청

- 장군님 물음: 훅 어디에도 CURRENT.md 최신화 내용이 없나 · 「전역 설정되어 있는 훅을 다시 확인해봐」 → 점검 결과 보고(목적은 적혀 있으나 「끝날 때 갱신」과 강제 장치는 없음, 대화 압축 뒤엔 지침이 다시 안 들어감)
- 장군님 지시: 「그런 내용들을 D:\workspace\yoon-agent-kit 여기에 훅에 추가해」 · 「exe 로 말아서 배포하게」

## 변경 내용

- 킷 소스(`D:\workspace\yoon-agent-kit`) 수정 + 빌드 — 상세는 킷 이력 `D:\workspace\yoon-agent-kit\.docs\history\2026\09\2026-09-16_194000_claude_config_current-md-gate_abc286a4.md`
  - 대화 시작 지침(세 에이전트)에 CURRENT.md 갱신 문구
  - Claude·Codex 답변 끝내기 훅에 「이 대화의 이력 파일이 CURRENT.md 보다 나중이면 막기」
  - 대화 시작 훅 matcher 에 `compact`
- 이 프로젝트 쪽은 문서만: 테스트 CG1~CG4 · 점검 문서에 「한 것」 · CURRENT.md 도구 쪽 안내 줄

## 변경 파일

- 추가: `.docs/history/2026/09/2026-09-16_194500_claude_config_kit-current-md-gate_abc286a4.md`
- 변경: `.works/claude설정전역화/00_현황판.md` · `.works/claude설정전역화/CURRENT_갱신_강제장치_점검.md` · `.docs/CURRENT.md`
- 삭제: 없음
- (프로젝트 밖) 킷 파일 목록은 킷 이력에

## 변경 이유

CURRENT.md 는 다른 agent 가 먼저 읽고 이어받는 입구인데 이력만 강제돼 오늘 이 프로젝트 CURRENT.md 에 묵은 줄이 남았다.

## 영향 범위

- 설치 전에는 아무것도 안 바뀐다(라이브 설정 안 건드림)
- 설치 후: 킷을 쓰는 모든 프로젝트에서 이력을 쓴 대화는 CURRENT.md 도 고쳐야 답변이 끝난다

## 검증

- 킷 `check.ps1` 5단계 통과(시험 115건) · `build.ps1` 성공 0.9.14 / 50.2 MB
- **미실행**: 실제 설치 · 실제 대화 확인 — 장군님 (CG1~CG4)

## 참고 사항

- 대화 시작 지침의 「단순 질의에는 이력 파일을 만들지 마라」(이 프로젝트 README 와 반대)는 안 고쳤다 — 장군님께 여쭘
- Stop 패치 중 셸 heredoc 이 역슬래시를 먹어 파일이 한 번 깨졌고, 사본으로 되돌린 뒤 다시 적용했다

---

## 후속 1 — CURRENT.md 용도 정정 반영 (2026-09-16)

### 요청

- 장군님 정정: CURRENT.md 는 **인수인계서** — 다른 대화창·다른 에이전트가 이어받는 문서이고, **장군님이 별도 지시할 때만** 지금 해야 할 항목을 적는다
- 지시: 「1 2번 그렇게 하고 3번은 되돌려」 (목록 = `.works/claude설정전역화/CURRENT_용도_정정_영향목록.md`)

### 변경 내용

1. 킷: 갱신 지침·막는 장치 되돌림, compact matcher 는 남김 → 0.9.15 빌드 (킷 이력 후속 1)
2. 규칙 글: `.claude/rules/always.md` · `AGENTS.md` · `.works/DEV_STANDARD_작업범위.md` · `.docs/CURRENT.md` 머리말 — 「먼저 읽되 고치는 것은 장군님 지시할 때만」
3. `.docs/CURRENT.md` 내용: **이 대화(abc286a4)가 2026-09-16(KST)에 고친 줄만** 되돌림 — 대화 기록에서 CURRENT.md 를 고친 호출을 모두 뽑아 확인. 다른 대화창이 고친 줄은 그대로
   - 되돌린 것: 「busy 공통 파일 이관」 줄을 09-15 모양으로 · 「busy 검증 로그」「화면 뜨자마자 busy」「로그 부하/로그 남기기 전략」「Login」 줄 뺌 · 도구 쪽 안내 줄을 커밋본 모양으로 · 갱신 날짜 2026-09-14 로
4. 테스트 CG 그룹을 0.9.15 기준으로 바꿈(CG4 = 이제 **막히지 않는지** 확인)
5. 메모리: CURRENT.md = 인수인계서, 지시할 때만 갱신

### 변경 파일

- 변경: `.claude/rules/always.md` · `AGENTS.md` · `.works/DEV_STANDARD_작업범위.md` · `.docs/CURRENT.md` · `.works/claude설정전역화/00_현황판.md` · `.works/claude설정전역화/CURRENT_용도_정정_영향목록.md` · `.works/claude설정전역화/CURRENT_갱신_강제장치_점검.md` · `.works/00_지금할것.md`
- 추가(백업): `.claude/rules/_always.md.currenthandoffbak` · `_AGENTS.md.currenthandoffbak` · `.works/_DEV_STANDARD_작업범위.md.currenthandoffbak` · `.docs/_CURRENT.md.currenthandoffbak`
- 삭제: 없음

### 영향 범위

- 앞으로 agent 는 작업이 끝났다고 CURRENT.md 를 고치지 않는다
- **지금 설치된 킷 0.9.14 는 막는 장치가 살아 있다(2026-09-16 21:11 설치).** 0.9.15 설치 전까지 이력을 쓴 대화는 CURRENT.md 가 오래됐다고 막힐 수 있다

### 검증

- 킷 check 5단계 통과(99건) · 빌드 0.9.15 성공
- CURRENT.md 되돌린 결과를 커밋본(4231301d)과 diff 로 확인
- 미실행: 0.9.15 설치·실제 대화 — 장군님(CG1~CG4)

### 참고 사항

- 되돌린 CURRENT.md 는 오늘 이 대화 작업(Login 테스트 통과·서버 목록 busy 등)을 담지 않는다 — 장군님 지시. 그 내용은 `.works/00_지금할것.md` · 각 영역 현황판 · 이 이력에 있다
