# Audit Workflow

이 폴더는 Claude가 개발한 기능을 Codex가 감사하고, Claude가 그 감사 결과를 바탕으로 수정하는 흐름을 관리한다.

## 큰 흐름

1. Claude가 기능을 개발한다.
2. 사용자가 Codex에게 특정 기능 감사를 지시한다.
3. Codex는 기능별 감사 보고서를 `.audit/active/<case-id>/01_codex-audit.md`로 작성한다.
4. 사용자는 Claude에게 해당 보고서를 읽게 하고, 이의제기 또는 수정을 진행시킨다.
5. 필요한 경우 Codex가 Claude 답변/수정 결과를 다시 검증한다.
6. 최종 완료되면 해당 감사 케이스 폴더를 `.audit/history/`로 이관한다.

## 폴더 구조

```text
.audit/
  README.md
  active/
    <case-id>/
      01_codex-audit.md
      02_claude-response.md
      03_codex-recheck.md
      04_final-verification.md
  history/
    <case-id>/
      ...
```

## 파일 역할

- `01_codex-audit.md`: Codex 최초 감사 보고서. 우려사항, 버그 가능성, 근거, 우선순위를 기록한다.
- `02_claude-response.md`: Claude의 답변, 이의제기, 수정 계획 또는 수정 결과를 붙여 넣는다.
- `03_codex-recheck.md`: Codex가 Claude 답변/수정 내용을 다시 판단한 결과를 기록한다.
- `04_final-verification.md`: 최종 완료 전 검증 결과와 잔여 리스크를 기록한다.

## 작성 규칙

- 감사 케이스는 기능 단위로 만든다. 예: `version-management-popup`.
- 현행 소스 기준으로 작성하고, `_`로 시작하는 백업/구버전 폴더는 근거로 사용하지 않는다.
- 화면/팝업/UX 관련 검증은 `.analy/` 문서 기준을 함께 명시한다.
- 이슈는 `P1`, `P2`, `P3` 우선순위로 표시한다.
- 최종 완료된 케이스만 `history`로 이동한다.
