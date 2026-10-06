# stop_history_gate를 Yoon Agent Kit 관리로 교체

작업일: 2026-09-14 · 대화창: 71244c22 (yoon-agent-kit 저장소 세션)

## 요청

이 프로젝트가 아니라 `D:\workspace\yoon-agent-kit`(Yoon Agent Kit 설치기를 만드는
별도 저장소) 세션에서 온 지시:

> C:\Users\socce\Documents\Github\CHUNGYOON0120\U4A_WS4.0.0 <-- 여기에 훅 중에
> stop_history_gate 도 탑재해줘

## 무엇을 했나

1. **킷에 stop_history_gate를 정식 훅으로 편입.** 지금까지 킷은 에이전트당
   훅 이벤트 하나(SessionStart/PreInvocation)만 지원했는데, `Stop` 이벤트를
   추가로 등록할 수 있게 확장했다 (`resources/hooks/{claude,codex}/Stop/`).
   판정 로직은 이 프로젝트에 손으로 심어져 있던 `stop_history_gate.py`
   원안(git status + `.docs/history` 최신 파일 mtime 기준선, 4겹 안전장치)을
   그대로 옮겼다 — 프로젝트 경로만 하드코딩 대신 매 실행 시 훅 payload의
   `cwd`로 알아내도록 바꿨다(킷의 다른 훅과 같은 방식. 여러 프로젝트에서
   공용으로 써야 하기 때문).
2. **이 프로젝트에 원래 있던 손으로 심은 버전을 걷어냈다.** 같은 Stop
   이벤트에 두 벌이 동시에 등록되면 매 턴 git status가 두 번 돌고 막힘
   메시지가 겹칠 수 있어서, 장군님 확인을 받고 교체하는 쪽으로 갔다.
3. **킷으로 다시 등록.** Claude·Codex 로컬 스코프로 `configure.py`를 다시
   실행해 Stop 훅을 킷 관리 경로로 새로 심었다.

## 변경 파일

- 변경:
  - `.claude/settings.json` — `Stop` 배열에서 `stop_history_gate.py`(내 프로젝트
    경로 하드코딩 버전) 항목을 빼고, 킷의 `hooks\claude\Stop\run.cmd`를 가리키는
    항목으로 교체. `answer_finish.py` 항목은 그대로 뒀다.
  - `.codex/hooks.json` — 같은 방식으로 `Stop` 배열을 킷 관리 경로로 교체.
    (이 파일은 Stop 밑에 내 항목 하나뿐이었어서, 결과적으로 이 배열의
    유일한 항목이 바뀐 것이다.)
- 삭제:
  - `.claude/hooks/python/stop_history_gate.py` — 킷이 같은 로직을 대신하므로
    프로젝트 안에 따로 둘 필요가 없어졌다. `git rm`으로 지웠다(커밋은 안 함).

## 변경 이유

같은 보호 로직을 프로젝트마다 손으로 심어 유지하는 대신, Yoon Agent Kit
설치기로 여러 프로젝트에 똑같이 배포하고 갱신할 수 있게 하려는 것이다.
로직 자체(무엇을 막고 언제 통과시키는지)는 손대지 않았다 — 옮기기만 했다.

## 영향 범위

- Claude/Codex 양쪽 다 Stop 훅이 이제 `%LOCALAPPDATA%\yoon-agent-kit\hooks\...`를
  가리킨다. 동작(막는 조건, 4겹 안전장치, timeout 60초)은 원본과 동일하다.
- `answer_finish.py`, `pre_tool_use_mcp.py`, `pre_tool_use_gate.py`,
  `prompt_submit.py` 등 이 프로젝트의 다른 커스텀 훅은 전혀 건드리지 않았다.
- 같이 실행된 킷 재설치로 스킬 링크(agy-agent, codex-agent 포함)와
  `.mcp.json`/`.codex/config.toml`의 `ui5-mcp-server` 등록도 다시 확인됐다
  (이미 있던 것들이라 실질적인 변화는 없다). `sap_adt_mcp`는 이 프로젝트에
  없는 MCP라 "mcp.json이 없거나 실행 방법을 알 수 없습니다"로 건너뛰었다 —
  킷 쪽에 아직 만들지 않은 항목이라 이 프로젝트만의 문제는 아니다.

## 검증

- Yoon Agent Kit 저장소 쪽에서 `check.ps1`(5단계, 97건 + 8조합×101건 매트릭스)과
  `build.ps1` 전부 통과 확인 (버전 0.9.5).
- matcher/timeout이 이벤트별로 맞게 나가는지 — 일부러 버그를 재현해
  `test_configure.py`가 정확히 2건("Claude Stop 그룹에는 matcher 키가 없다",
  "Codex Stop 그룹은 matcher가 빈 문자열이다")을 잡아내는 것으로 확인한 뒤 복구.
- 이 프로젝트에 실제로 재등록한 뒤 `.claude/settings.json`,
  `.codex/hooks.json` 최종 내용을 직접 읽어 확인:
  - Claude Stop 그룹 — matcher 키 없음, timeout 60, command가 킷 경로
  - Codex Stop 그룹 — matcher "", timeout 60, command/commandWindows가 킷 경로
- **미검증**: 실제로 파일을 고친 뒤 Stop 이벤트가 발생했을 때 막힘 동작이
  이 대화(별도 세션)에서 도는지는 확인하지 못했다 — 이 문서 자체가 그
  검증을 통과시키기 위한 이력 기록이다.

## 참고 사항

- `.claude/hooks/python/__pycache__/`에 지운 스크립트의 컴파일 캐시가
  남아 있다. 무해하지만(git 추적 대상 아님) 다음에 지나가면서 지워도 된다.
- Antigravity는 이번에 포함하지 않았다. 이 프로젝트는 애초에 Antigravity를
  설치한 적이 없고(장군님 확인), `PostInvocation`이라는 이벤트가 있다는 것만
  `language_server.exe` 문자열에서 확인했을 뿐 입출력 계약을 실측하지
  못해 킷 쪽에서도 보류했다.
