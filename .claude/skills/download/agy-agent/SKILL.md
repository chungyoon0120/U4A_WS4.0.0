---
name: agy-agent
description: Bring in the Antigravity CLI (the globally-installed `agy` command), nicknamed "Anti" (안티), as a coding colleague — get its opinion, have it check something, or hand it a task to actually fix. Trigger ONLY when the user directly addresses it by name in their message, e.g. "안티야", "안티,", "hey anti". Covers open-ended requests like "안티야 이 부분은 니가 수정 좀 반영해", "안티야 이거 어때?", "안티야 다른 의견 없어?" — not just formal code review. Do NOT trigger on a plain review/fix request that doesn't name Anti (do that yourself), and do NOT trigger on unrelated mentions of "agy"/"안티그래비티" that aren't a direct address to it as a collaborator. If the user names Codex instead, use the sibling `codex-agent` skill.
---

## When this applies

This fires only when the user is *talking to Anti directly*, by name — "안티야 ...", "안티, ...", "hey anti, ...". If the name isn't there, this isn't an Anti request: either do it yourself, or if they named Codex instead, use the sibling `codex-agent` skill.

Within that, the request can be almost anything you'd hand to a human colleague:
- An opinion / sanity check: "안티야 이거 어때 보여?", "안티야 이 방식 괜찮을까?"
- A review or double-check: "안티야 이 부분 확인해봐", "안티야 버그 없는지 봐줘"
- A second opinion when you're stuck: "안티야 더 좋은 아이디어 없어?"
- An actual fix, applied by Anti itself: "안티야 여기 수정 좀 반영해줘", "안티야 이 버그 고쳐줘"

Figure out which kind of request it is (see "Read-only or write?" below) — that decision determines a real flag you pass to the script, not just tone.

`agy` is assumed to already be on the user's PATH globally. Call it directly as `agy` — there's no need to search for an install path.

## Read-only or write?

This is the one judgment call this skill asks of you, and it matters — one mode can only look and talk, the other can actually change files on disk.

- **Default to read-only.** Opinions, reviews, "what do you think", "any better ideas" — none of these need write access. In read-only mode, agy is never given filesystem access at all (except the no-git whole-directory fallback) — it only ever sees whatever text you hand it.
- **Only use `--write`** when the user's phrasing clearly asks for the change to be *made*, not just described — "고쳐줘", "반영해줘", "적용해줘", "니가 수정해". If it's ambiguous, ask the user rather than guessing toward write — applying an unwanted edit is a lot more annoying to undo than just re-asking.
- **Write mode gives Anti real filesystem access** (`--add-dir <cwd>`, no `--sandbox`) so it can actually read and edit files in the target directory. If the project isn't a git repo, strongly suggest the user set one up first (`git init` + a commit) so any change can be diffed and reverted — without git, an unwanted edit has no easy undo.
- **After a write run, always show the user what changed.** The script appends a `git diff --stat` summary automatically when it's a git repo — surface that, and offer to show the full diff or let them review before anything gets committed. Never treat "the write succeeded" as the end of the task; showing the result is part of it.

## Why a bundled script, not a raw `agy` command

`agy` has no built-in diff/review subcommand (unlike Codex's `codex review`) — it only offers `--print`/`-p` to run one prompt non-interactively, and has no concept of "workspace-write vs read-only sandbox" the way Codex does (just a plain `--sandbox` toggle and `--add-dir` for granting filesystem access). `scripts/anti.js` handles the parts that are easy to get wrong by hand:

- Sends the prompt over **stdin**, not as a command-line argument. A real diff (or a detailed task description) can easily be tens of thousands of characters, well past what a Windows command line can hold — passing it as an argv value silently breaks or truncates.
- Computes the git diff itself for review-style requests, since agy can't do that natively.
- Passes `--dangerously-skip-permissions` (and `--sandbox` in read-only mode) so the run never stalls on a tool-approval prompt with nobody there to answer it.
- Runs with a timeout and actually kills the whole process tree if it's exceeded (see "Which Node to run it with" below for why that needs special handling on Windows).

## Which Node to run it with

Always use the Node runtime bundled at `scripts/node_runtime/node.exe` (relative to this skill) — never the system `node` on PATH, even if one exists. Same reasoning as the sibling `codex-agent` skill: a user's installed Node could be missing or too old, and this skill has no way to check that before running. The bundled runtime is a known-good fixed target.

## If this skill folder is going into a git-tracked project

`scripts/node_runtime/node.exe` is ~85MB. If this skill folder gets copied into a project that's under (or about to be under) git, make sure `.claude/` (or at least `.claude/skills/agy-agent/scripts/node_runtime/`) is in that project's `.gitignore` *before* anything gets committed — otherwise that binary ends up permanently baked into git history. Add the ignore rule as part of git setup, not after the fact.

## Command

```bash
"<this-skill-dir>/scripts/node_runtime/node.exe" "<this-skill-dir>/scripts/anti.js" [--write] [SELECTOR] ["extra instructions"] [--dir <path>] [--model <model>] [--timeout <seconds>]
```

`[SELECTOR]` — what to point Anti at:

| Situation | Selector |
|---|---|
| Whatever's currently changed but not committed (default) | `--uncommitted` |
| A specific commit | `--commit <sha>` |
| Current branch vs. a base branch | `--base <branch>` |
| A free-form question, opinion request, or write-mode task | `--prompt "<full text>"` |

`--prompt` is what you reach for most for this skill's actual purpose (a colleague conversation), since it isn't tied to a diff — e.g. `--prompt "이 정렬 알고리즘 시간복잡도 괜찮은지 봐줘: <코드 붙여넣기>"`. When you use `--prompt` in read-only mode, put everything Anti needs to know directly in that string — it isn't given filesystem access, so it only knows what's in the prompt text.

The optional trailing `"extra instructions"` (or the `--instructions` flag) adds focus without changing the selector — e.g. `"보안 취약점 위주로 봐줘"`. Pass the user's own framing/language through when they gave one.

Use `--dir <path>` when the target isn't the current working directory. Default timeout is 10 minutes; raise it with `--timeout <seconds>` for a large diff or a slow fix (this is also forwarded to agy's own `--print-timeout` so both layers agree).

**Examples:**

Opinion / sanity check, no file context needed beyond what you provide:
```bash
"<this-skill-dir>/scripts/node_runtime/node.exe" "<this-skill-dir>/scripts/anti.js" --prompt "이 캐싱 전략 괜찮아 보여? 장단점 위주로 짧게: <설명/코드>"
```

Review the current uncommitted diff (the common "확인해봐" case):
```bash
"<this-skill-dir>/scripts/node_runtime/node.exe" "<this-skill-dir>/scripts/anti.js" --uncommitted
```

Hand off an actual fix — Anti edits the files itself:
```bash
"<this-skill-dir>/scripts/node_runtime/node.exe" "<this-skill-dir>/scripts/anti.js" --write --prompt "index4.py의 문법 오류 고쳐서 반영해줘"
```

## Things to watch for

- **`agy` not found**: the script exits with code `127` and a detailed message — most likely either not installed, or installed but this session's PATH is stale (needs a fresh Claude Code restart). Surface that message, don't guess at a workaround.
- **`agy` says it isn't logged in, even though it clearly is**: confirmed real-world cause — Claude Code's own permission/approval mode. Under a more autonomous mode ("only ask about actions detected as risky"), the Bash call that runs this script can get auto-approved into a *more restricted* execution context (e.g. blocked network access) instead of getting a normal approval prompt, and that's enough to break agy's OAuth check even though `agy` works fine run directly in a terminal. The script retries once automatically and, if it still fails, prints this same diagnosis — the fix is switching Claude Code to "always ask" for this kind of action so it gets approved normally, not auto-approved-but-restricted.
- **Runtime**: a real review or fix can take well over a minute. That's expected — don't re-run thinking it hung. A real timeout exits with code `124`; bump `--timeout` for a big task.
- **Very large diffs get truncated**: the script caps the diff text it builds at 200,000 characters to keep the prompt sane. If truncation happens it's noted inline, but it's worth mentioning to the user if the diff was huge.
- **Relay, don't re-litigate**: the point of this skill is getting Antigravity's own take, in its own words — present its findings/fix as Anti's, not silently redone and re-presented as your own conclusions.
