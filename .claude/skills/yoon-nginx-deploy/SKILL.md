---
name: yoon-nginx-deploy
description: 사용자가 자기 메시지에서 배포나 이관을 직접 명령했을 때만 쓴다 — "배포해", "배포해라", "배포 좀", "배포 부탁", "배포해줘", "테스트로 배포해", "deploy", "이관해", "이관해라", "이관 좀", "이관 부탁", "운영에 이관해", "promote". 추론으로, 코드를 고친 뒤에, 다른 작업의 앞뒤로, 배포가 유익해 보인다는 판단으로는 절대 발동하지 않는다. 사용자 메시지에 배포나 이관 명령이 없으면 이 스킬은 해당되지 않는다.
---

# nginx deploy and promote

Send only the files that differ. Two jobs.

| | What it does | Script |
|---|---|---|
| **Deploy** (배포) | local project `dist/` → remote nginx folder | `scripts/deploy.sh` |
| **Promote** (이관) | remote nginx folder → another remote nginx folder | `scripts/promote.sh` |

Promote moves work from a dev slot to a production slot (`u4a_sr_dev` → `u4a_sr`).
Files travel inside the server and never come down to the local machine.

**Talk to the user in Korean.** This file is in English, the user is not. Every
question, report and summary you produce goes to them in Korean.

## `$SKILL` — the folder this skill sits in

`$SKILL` in the commands below is **the folder holding this SKILL.md**. Each agent
installs it somewhere different, so the path is not hardcoded. Substitute the right
one at run time.

| Agent | Scope | `$SKILL` |
|---|---|---|
| Claude Code | global | `~/.claude/skills/yoon-nginx-deploy` |
| Claude Code | local | `<project>/.claude/skills/yoon-nginx-deploy` |
| Codex | global | `~/.codex/skills/yoon-nginx-deploy` (under `CODEX_HOME` if set) |
| Codex | local | `<project>/.codex/skills/yoon-nginx-deploy` |
| Antigravity | global | `~/.gemini/config/skills/yoon-nginx-deploy` |
| Antigravity | local | `<project>/.agents/skills/yoon-nginx-deploy` |

Codex reads both `.codex/skills/` and `.agents/skills/` for local skills. The
installer puts it in `.codex/skills/` so it does not collide with Antigravity's slot.

If the project is not a git repository, open the agent **at the project root** or the
skill will not be found. Agents do not walk up past that point.

All three run it through Git Bash `bash`. The scripts are POSIX shell and will not
run under PowerShell.

## When this applies

Only when the user's own message carries a deploy or promote command.

Accept: `배포해`, `배포 좀`, `deploy` / `이관해`, `이관 좀`, `운영에 이관해`, `promote`
        `테스트로 배포해` — goes to the fixed test slot. See step 1.

Do not accept:
- `반영해` — indistinguishable from an ordinary edit request
- your own judgement that a deploy is due because code changed
- running it as the closing step of some other task

## Procedure

The four steps are the same for deploy and promote. Only what you need in step 1 differs.

### 1. Get the paths — ask if you were not told

**Never guess where to put things.** Use only a path heard in this conversation. Even
if you remember where it went last time, that does not count. The script refuses to
run without one.

For a deploy you need a **folder name** and a **remote path**. The folder name is what
the user gave you — `infocg_timeoff 배포해` means `infocg_timeoff`, and the payload is
everything under `D:\workspace\infocg_timeoff\dist`.

> 어느 경로에 올릴까요? nginx 쪽 절대 경로로 알려주세요.
> (예: `/u4arnd/u4a/docker_root/U000/U4A/webapps/infocg_timeoff`)

For a promote you need both a **source path** and a **target path**.

> 어디에서 어디로 이관할까요? 원본과 대상을 절대 경로로 알려주세요.
> (예: `.../webapps/u4a_sr_dev` → `.../webapps/u4a_sr`)

#### A test deploy needs no path

When the user says **"테스트로 배포해"** the slot is fixed. Do not ask — pass `--test`.
The folder name is all you need.

```
_tmp/soccerhs/<folder>
```

**If the name is already taken the script stops.** That slot holds more than sixty old
tests and other people's work, so collisions with local project names are common
(`portlet_portal`, `img_to_ui5`, `u4a_dev_browser` and others).

When it stops, **ask the user which way they want it.** Never pick for them.

> `_tmp/soccerhs/portlet_portal` 이 이미 있습니다. 마지막 수정은 8월 5일입니다.
> 어떻게 할까요?
>   1. 지우고 새로 넣기 — 원격을 통째로 비우고 dist 를 그대로 올립니다.
>      그 폴더에만 있던 파일은 사라집니다.
>   2. 바뀐 것만 고치기 — 다른 파일만 덮어씁니다. 그 폴더에만 있는 파일은 둡니다.
>   3. 다른 이름으로 올리기

| Answer | Flag |
|---|---|
| wipe and re-put | `--replace` |
| changed files only | `--reuse` |
| a different name | none — start again from step 2 with that name |

`--replace` **deletes.** Files marked `= ` in the report are the ones that disappear,
so show that list to the user before you run it. It is refused outside the test slot.

### 2. See what would change

```bash
bash $SKILL/scripts/deploy.sh <folder> <remote-path>
bash $SKILL/scripts/deploy.sh <folder> --test          # test deploy
```

```bash
bash $SKILL/scripts/promote.sh <source-path> <target-path>
```

This judges only, it sends nothing. A test deploy does not create the folder at this
stage either.

### 3. Report the result and get approval

Show the script's output to the user. Do not drop any of these three.

- files going over — `+` new, `~` changed
- files only on the target — `=`. Say plainly that they are left alone
- how many files will be sent

If it says `변경 없음`, stop here. There is nothing to approve.

**Do not move to the next step without approval.** This is a live server.

### 4. Send it and report

Only after approval, re-run with `--apply`.

```bash
bash $SKILL/scripts/deploy.sh <folder> <remote-path> --apply
bash $SKILL/scripts/deploy.sh <folder> --test --apply             # test deploy
bash $SKILL/scripts/deploy.sh <folder> --test --reuse --apply     # collision — changed only
bash $SKILL/scripts/deploy.sh <folder> --test --replace --apply   # collision — wipe and re-put
```

```bash
bash $SKILL/scripts/promote.sh <source-path> <target-path> --apply
```

Changed files are tarred over, then the target hashes are measured again to confirm.

On `검증 OK`, tell the user how many files went. If `검증 OK` is missing or there are
`!` lines, **do not smooth it over** — pass it on as it is. The script exits non-zero.

## What this never does

- no building. `dist/` goes up as it stands. The user runs the build
- no deleting on the target. Files like `backend/config.js` live only there
- no backups. The user handles that separately
- no creating folders. If one is missing, stop and check with the user.
  The `--test` slot is the sole exception, and even there a name collision stops it
- never add `--reuse` or `--replace` on your own for a collision. Always ask
- never use `--replace` outside the test slot. The script refuses

## Settings

| Variable | Default | Meaning |
|---|---|---|
| `DEPLOY_SSH_HOST` | `u4a_new_ubuntu-u4a_rnd` | host alias in `~/.ssh/config` |
| `DEPLOY_LOCAL_BASE` | `/d/workspace` | where the projects live (deploy only) |
| `DEPLOY_TEST_BASE` | `/u4arnd/u4a/docker_root/U000/U4A/webapps/_tmp/soccerhs` | the `--test` slot |

Promote assumes both paths sit on the same server.

## Tests

```bash
bash $SKILL/tests/test_deploy.sh
bash $SKILL/tests/test_promote.sh
```

`DEPLOY_LOCAL_TEST=1` makes `remote_run` use local bash instead of ssh, so transfer
and verification run end to end against temp directories, never the real server.
