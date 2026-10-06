# 커밋/푸시 직전 체크

- **★손으로 add/commit/push 하지 말고 도구를 쓴다**(2026-10-06): `bash .claude/scripts/gitcp.sh <<'EOF' … EOF`
  (main 까지 = `--to-main`). 아래 규칙은 그 도구가 자동으로 지킨다. 설명 = `.claude/scripts/README.md`.

- 커밋 메시지 제목 **맨앞 `[YYYY-MM-DD HH:MM]`**, 끝에 `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- 기본 브랜치면 **먼저 브랜치**. 커밋/푸시는 **지시가 있을 때만**.
- busy·닫기 등 **기초 결함을 미해결로 두고 커밋 금지**(발견 즉시 수정).
- 커밋/푸시 후 **노션 작업일지 기록**(notion-log 스킬), 결과 URL 보고.
