---
name: codex-agent
description: Bring in the Codex CLI (the globally-installed `codex` command) as a coding colleague — get its opinion, have it check something, or hand it a task to actually fix. Trigger ONLY when the user directly addresses Codex by name in their message, e.g. "코덱스야", "코덱스,", "codex야", "hey codex". Covers open-ended requests like "코덱스야 이 부분 확인해봐 너 의견은?", "코덱스야 여기 좀 고쳐줘", "코덱스야 더 좋은 방법 없어?" — not just formal code review. Do NOT trigger on a plain review/fix request that doesn't name Codex (do that yourself), and do NOT trigger on unrelated mentions of "codex" (questions about the CLI tool itself, etc.) that aren't a direct address to it as a collaborator.
---

## When this applies

This fires only when the user is *talking to Codex directly*, by name — "코덱스야 ...", "코덱스, ...", "hey codex, ...". If the name isn't there, this isn't a Codex request: either do it yourself, or if they named the other agent instead, use the sibling `agy-agent` skill.

Within that, the request can be almost anything you'd hand to a human colleague:
- An opinion / sanity check: "코덱스야 이거 어때 보여?", "코덱스야 이 방식 괜찮을까?"
- A review or double-check: "코덱스야 이 부분 확인해봐", "코덱스야 버그 없는지 봐줘"
- A second opinion when you're stuck: "코덱스야 더 좋은 아이디어 없어?"
- An actual fix, applied by Codex itself: "코덱스야 여기 수정 좀 해줘", "코덱스야 이 버그 고쳐서 반영해줘"

Figure out which kind of request it is (see "Read-only or write?" below) — that decision determines a real flag you pass to the script, not just tone.

`codex` is assumed to already be on the user's PATH globally. Call it directly as `codex` — there's no need to search for `codex.exe` or resolve an install path.

## Read-only or write?

This is the one judgment call this skill asks of you, and it matters — one mode can only look and talk, the other can actually change files on disk.

- **Default to read-only.** Opinions, reviews, "what do you think", "any better ideas" — none of these need write access.
- **Only use `--write`** when the user's phrasing clearly asks for the change to be *made*, not just described — "고쳐줘", "반영해줘", "적용해줘", "니가 수정해". If it's ambiguous, ask the user rather than guessing toward write — applying an unwanted edit is a lot more annoying to undo than just re-asking.
- **Write mode edits real files in the target directory.** It's constrained to that directory (Codex runs with `--sandbox workspace-write`, which confines it to the workspace — it can't touch anything outside), but within that boundary it can create, edit, or delete files. If the project isn't a git repo, strongly suggest the user set one up first (`git init` + a commit) so any change can be diffed and reverted — without git, an unwanted edit has no easy undo.
- **After a write run, always show the user what changed.** The script appends a `git diff --stat` summary automatically when it's a git repo — surface that, and offer to show the full diff or let them review before anything gets committed. Never treat "the write succeeded" as the end of the task; showing the result is part of it.

## Why a bundled script, not a raw `codex` command

Plain `codex` (or `codex review`, without `exec`) launches Codex's interactive TUI, which will hang waiting for a terminal you don't have. `scripts/codex.js` builds the correct non-interactive `codex exec ...` invocation, runs it with a timeout so it can't hang forever, and prints just Codex's final message to stdout (progress/diagnostics go to stderr instead).

For a review-style request against a diff, it uses Codex's own `codex exec review` subcommand (fast, and Codex computes the diff itself). For anything else — an opinion, a question, or a write-mode task — it uses a plain `codex exec "<prompt>"`, since `review` only ever produces a critique and can't apply anything.

## Which Node to run it with

Always use the Node runtime bundled at `scripts/node_runtime/node.exe` (relative to this skill) — never the system `node` on PATH, even if one exists. A user's installed Node could be an old version that doesn't support syntax this script relies on (or missing entirely), and this skill has no way to check that before running. The bundled runtime is a known-good fixed target.

## If this skill folder is going into a git-tracked project

`scripts/node_runtime/node.exe` is ~85MB. If this skill folder gets copied into a project that's under (or about to be under) git, make sure `.claude/` (or at least `.claude/skills/codex-agent/scripts/node_runtime/`) is in that project's `.gitignore` *before* anything gets committed — otherwise that binary ends up permanently baked into git history. Add the ignore rule as part of git setup, not after the fact.

## Session reuse (and when to bypass it with `--fresh`)

A fresh `codex exec` call pays for a full context cache write (tens of thousands of tokens, billed at a premium) since there's nothing to reuse. To avoid that, the script automatically resumes the last thread for this project directory + read/write mode, as long as it's less than 45 minutes old — cheap cache read instead of an expensive cache write, and Codex remembers the earlier conversation.

That resuming happens purely by *project directory*, with no idea of "conversation" or "room" on your end — if the user works the same project across several separate, unrelated conversations back to back, each one calling this skill would by default keep extending the *same* Codex thread, dragging prior, unrelated context into a conversation that has nothing to do with it. If it's clear the user is starting a genuinely new topic in this project (not a continuation of what Codex was just asked), pass `--fresh` to force a clean thread instead of silently inheriting whatever came before.

## Command

```bash
"<this-skill-dir>/scripts/node_runtime/node.exe" "<this-skill-dir>/scripts/codex.js" [--write] [--fresh] [SELECTOR] ["extra instructions"] [--dir <path>] [--model <model>] [--timeout <seconds>]
```

`[SELECTOR]` — what to point Codex at:

| Situation | Selector |
|---|---|
| Whatever's currently changed but not committed (default) | `--uncommitted` |
| A specific commit | `--commit <sha>` |
| Current branch vs. a base branch | `--base <branch>` |
| A free-form question, opinion request, or write-mode task | `--prompt "<full text>"` |

`--prompt` is what you reach for most for this skill's actual purpose (a colleague conversation), since it isn't tied to a diff — e.g. `--prompt "이 정렬 알고리즘 시간복잡도 괜찮은지 봐줘: <코드 붙여넣기>"`. When you use `--prompt`, put everything Codex needs to know directly in that string — in read-only mode without a diff selector, Codex isn't given any extra filesystem access, so it only knows what's in the prompt text. Include relevant code/context yourself if the question is about something specific.

The optional trailing `"extra instructions"` (or the `--instructions` flag) adds focus without changing the selector — e.g. `"보안 취약점 위주로 봐줘"`. Pass the user's own framing/language through when they gave one.

Use `--dir <path>` when the target isn't the current working directory. Default timeout is 10 minutes; raise it with `--timeout <seconds>` for a large diff or a slow fix.

**Examples:**

Opinion / sanity check, no file context needed beyond what you provide:
```bash
"<this-skill-dir>/scripts/node_runtime/node.exe" "<this-skill-dir>/scripts/codex.js" --prompt "이 캐싱 전략 괜찮아 보여? 장단점 위주로 짧게: <설명/코드>"
```

Review the current uncommitted diff (the common "확인해봐" case):
```bash
"<this-skill-dir>/scripts/node_runtime/node.exe" "<this-skill-dir>/scripts/codex.js" --uncommitted
```

Hand off an actual fix — Codex edits the files itself:
```bash
"<this-skill-dir>/scripts/node_runtime/node.exe" "<this-skill-dir>/scripts/codex.js" --write --prompt "index1.py의 result.stderr가 None일 수 있는 문제 고쳐서 반영해줘"
```

## Things to watch for

- **Not a git repo**: `review` and diff selectors need git. If the target isn't a git repo, review-mode falls back to a whole-directory look instead of a diff, and `--commit`/`--base` fail fast with a clear message (no point calling Codex for a diff that can't exist). `--prompt` and write-mode-with-instructions don't need git at all.
- **`codex` not found**: the script exits with code `127` and a detailed message — most likely either not installed, or installed but this session's PATH is stale (needs a fresh Claude Code restart). Surface that message, don't guess at a workaround.
- **Runtime**: a real review or fix can take well over a minute. That's expected — don't re-run thinking it hung. A real timeout exits with code `124`; bump `--timeout` for a big task.
- **Relay, don't re-litigate**: the point of this skill is getting Codex's own take, in its own words — present its findings/fix as Codex's, not silently redone and re-presented as your own conclusions.
