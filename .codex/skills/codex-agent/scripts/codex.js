#!/usr/bin/env node
"use strict";

/**
 * Brings in the Codex CLI (`codex`) as a coding colleague: ask its opinion,
 * have it check/review something, or hand it a task to actually fix. Runs
 * `codex exec` non-interactively and prints Codex's final message to stdout.
 *
 * Usage:
 *   node codex.js [--write]
 *                 [--uncommitted | --commit <sha> | --base <branch> | --prompt "<text>"]
 *                 ["extra instructions"]
 *                 [--dir <path>] [--model <model>] [--timeout <seconds>]
 *
 * Without --write: read-only sandbox — Codex can look around and give an
 * opinion/review, but can't change anything.
 * With --write: workspace-write sandbox — Codex can actually edit files to
 * apply a fix. Only pass this when the user asked for the change to be MADE,
 * not just suggested.
 *
 * Defaults to --uncommitted if neither a selector nor --prompt is given.
 */

const { spawn, spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");

// Every fresh `codex exec` call pays for a full context cache write (tens of
// thousands of tokens, billed at a premium) since there's no prior turn to
// reuse a cache from. If the last call from this same project directory (and
// the same read-only/write mode — a session's sandbox policy is fixed at
// creation and can't be changed on resume) is still resumable, continue that
// exact thread instead: much cheaper, and Codex keeps the earlier context.
// Read-only and write sessions are tracked separately since resuming doesn't
// let you switch sandbox mode.
const SESSION_STATE_DIR = path.join(os.tmpdir(), "codex-agent-sessions");

// Resuming isn't free even when it's cheaper than a fresh session — a cache
// hit still costs something, and it scales with however much history has
// piled up. Chaining resumes indefinitely across many separate conversations
// (e.g. a new "room" every so often, all pointed at the same project) means
// every call pays to read a bigger and bigger transcript, most of which is
// irrelevant to whatever's being asked now. And past the cache's ~1 hour
// lifetime, resuming stops being cheap anyway — it just drags in a long
// history and pays full price to re-cache all of it. So a saved session
// older than this is treated as gone rather than resumed.
const MAX_SESSION_AGE_MS = 45 * 60 * 1000;

function sessionStateFile(cwd, mode) {
    const key = crypto.createHash("sha1").update(`${path.resolve(cwd)}::${mode}`).digest("hex").slice(0, 16);
    return path.join(SESSION_STATE_DIR, `${key}.json`);
}

function loadSessionId(cwd, mode) {
    try {
        const data = JSON.parse(fs.readFileSync(sessionStateFile(cwd, mode), "utf8"));
        if (Date.now() - data.updatedAt > MAX_SESSION_AGE_MS) {
            return null;
        }
        return data.sessionId || null;
    } catch {
        return null;
    }
}

function saveSessionId(cwd, mode, sessionId) {
    try {
        fs.mkdirSync(SESSION_STATE_DIR, { recursive: true });
        fs.writeFileSync(sessionStateFile(cwd, mode), JSON.stringify({ sessionId, updatedAt: Date.now() }));
    } catch {
        // Non-fatal — just means the next call starts fresh instead of resuming.
    }
}

function clearSessionId(cwd, mode) {
    try {
        fs.rmSync(sessionStateFile(cwd, mode), { force: true });
    } catch {
        // Non-fatal.
    }
}

// `codex exec --json` prints one JSON object per line to stdout; the very
// first event is always `{"type":"thread.started","thread_id":"..."}`. Pull
// that id out so the next call can resume this exact thread.
function extractThreadId(stdout) {
    for (const line of stdout.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("{")) continue;
        try {
            const event = JSON.parse(trimmed);
            if (event.type === "thread.started" && event.thread_id) {
                return event.thread_id;
            }
        } catch {
            // Not a JSON line (or not this event) — keep scanning.
        }
    }
    return null;
}

const DEFAULT_FULL_REVIEW_PROMPT =
    "Review the code in this directory for bugs, security issues, and code quality problems. " +
    "Give a structured list of findings with file references where possible.";

// Applies in every mode, not just the whole-directory fallback: a git-diff
// review only looks at the diff itself, but write mode and any exploration
// Codex does on its own (even in read-only mode, nothing stops it reading
// extra files) can wander into .claude/.agents/ otherwise, where this
// tooling's own skill files (including a large bundled binary) live.
const EXCLUDE_TOOLING_NOTE =
    "Ignore the .claude/ and .agents/ directories entirely — they contain this tooling's own skill files " +
    "(including large bundled binaries), not part of the project. Do not read, review, or modify anything inside them.";

function withExcludeNote(instructions) {
    return instructions ? `${instructions} ${EXCLUDE_TOOLING_NOTE}` : EXCLUDE_TOOLING_NOTE;
}

function isGitRepo(cwd) {
    const result = spawnSync("git", ["-C", cwd, "rev-parse", "--is-inside-work-tree"], { encoding: "utf8" });
    return result.status === 0 && result.stdout.trim() === "true";
}

function getDiffStat(cwd) {
    const result = spawnSync("git", ["-C", cwd, "diff", "--stat"], { encoding: "utf8" });
    return result.status === 0 ? result.stdout.trim() : "";
}

// Windows can have several `codex` entries on PATH (e.g. an npm-installed CLI
// shim alongside a desktop-app-bundled one), and only the shell's own PATHEXT
// resolution reliably picks the right one — spawning "codex" directly without
// a shell can silently land on a different, older binary. That means `shell:
// true` is required on Windows, but Node does NOT auto-quote array args for
// you in that mode: it just joins them into one command-line string, so any
// arg containing a space (e.g. review instructions) gets split into extra
// words by cmd.exe. Quote each arg ourselves before that join happens.
//
// Whenever quoting kicks in, the arg is wrapped in a balanced "..." span,
// which is enough to stop cmd.exe treating & | < > ( ) as metacharacters (it
// only interprets those outside of quotes). The one thing quoting can't
// neutralize is %— cmd.exe expands %NAME% sequences even inside quotes — so
// a literal "%PATH%"-shaped substring in free-text instructions could still
// get expanded. That's a wording-corruption risk, not code execution, and
// there's no fully reliable cmd.exe-level escape for it.
function winCmdQuote(arg) {
    if (arg.length > 0 && !/[\s"&|<>^%!()]/.test(arg)) {
        return arg;
    }
    // Matches the CommandLineToArgvW-compatible escaping algorithm (as used
    // by MSDN's own reference implementation): backslashes are only special
    // immediately before a double quote, where they must be doubled, and one
    // extra backslash is added to escape the quote itself.
    let result = '"';
    let backslashes = 0;
    for (const ch of arg) {
        if (ch === "\\") {
            backslashes++;
            continue;
        }
        if (ch === '"') {
            result += "\\".repeat(backslashes * 2 + 1) + '"';
        } else {
            result += "\\".repeat(backslashes) + ch;
        }
        backslashes = 0;
    }
    result += "\\".repeat(backslashes * 2) + '"';
    return result;
}

function killProcessTree(pid) {
    if (process.platform === "win32") {
        // On Windows, child.kill() only signals the cmd.exe wrapper created by
        // `shell: true` — the actual codex process it launched is a separate
        // process in the tree and survives. /T kills that whole tree by pid.
        spawnSync("taskkill", ["/pid", String(pid), "/T", "/F"], { stdio: "ignore" });
    } else {
        process.kill(pid, "SIGKILL");
    }
}

const FLAGS_NEEDING_VALUE = new Set(["--commit", "--base", "--prompt", "--dir", "-C", "--model", "-m", "--timeout", "--instructions"]);

function parseArgs(argv) {
    const opts = {
        write: false,
        fresh: false,
        selector: null,
        rawPrompt: null,
        instructions: null,
        dir: null,
        model: null,
        timeoutMs: 10 * 60 * 1000,
        help: false,
    };
    const rest = [];

    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];

        if (FLAGS_NEEDING_VALUE.has(a) && argv[i + 1] === undefined) {
            console.error(`[codex] ${a} requires a value but none was given.`);
            process.exit(1);
        }

        if (a === "--write") {
            opts.write = true;
        } else if (a === "--fresh") {
            opts.fresh = true;
        } else if (a === "--uncommitted") {
            opts.selector = { type: "uncommitted" };
        } else if (a === "--commit") {
            opts.selector = { type: "commit", value: argv[++i] };
        } else if (a === "--base") {
            opts.selector = { type: "base", value: argv[++i] };
        } else if (a === "--prompt") {
            opts.rawPrompt = argv[++i];
        } else if (a === "--dir" || a === "-C") {
            opts.dir = argv[++i];
        } else if (a === "--model" || a === "-m") {
            opts.model = argv[++i];
        } else if (a === "--timeout") {
            opts.timeoutMs = Number(argv[++i]) * 1000;
        } else if (a === "--instructions") {
            opts.instructions = argv[++i];
        } else if (a === "-h" || a === "--help") {
            opts.help = true;
        } else {
            rest.push(a);
        }
    }

    if (!opts.instructions && rest.length > 0) {
        opts.instructions = rest.join(" ");
    }
    if (!opts.selector && !opts.rawPrompt) {
        opts.selector = { type: "uncommitted" };
    }
    if (!Number.isFinite(opts.timeoutMs) || opts.timeoutMs <= 0) {
        opts.timeoutMs = 10 * 60 * 1000;
    }

    return opts;
}

function printHelp() {
    console.log(
        [
            "Usage: node codex.js [--write] [--fresh]",
            '                     [--uncommitted | --commit <sha> | --base <branch> | --prompt "<text>"]',
            '                     ["extra instructions"]',
            "                     [--dir <path>] [--model <model>] [--timeout <seconds>]",
            "",
            "Runs `codex exec` non-interactively and prints Codex's final message to stdout.",
            "Without --write: read-only sandbox, Codex can only look and comment.",
            "With --write: workspace-write sandbox, Codex can actually edit files.",
            "Automatically resumes the last thread for this project directory + mode",
            "(cheaper — reuses its cache) unless it's more than 45 minutes old, or --fresh",
            "is passed to force a brand-new thread regardless.",
            "Defaults to --uncommitted if neither a selector nor --prompt is given.",
        ].join("\n")
    );
}

// Shared by write mode and resume mode (resume can only take a plain prompt —
// there's no way to hand it the `review` subcommand's diff-selector flags).
function buildTaskParts(opts) {
    const parts = [];
    if (opts.rawPrompt) {
        parts.push(opts.rawPrompt);
    } else {
        if (opts.selector) {
            if (opts.selector.type === "uncommitted") {
                parts.push("Focus on the current uncommitted changes in this repository.");
            } else if (opts.selector.type === "commit") {
                parts.push(`Focus on commit ${opts.selector.value}.`);
            } else if (opts.selector.type === "base") {
                parts.push(`Focus on what has changed on this branch since it diverged from ${opts.selector.value}.`);
            }
        }
        if (opts.instructions) {
            parts.push(opts.instructions);
        }
    }
    return parts;
}

function buildCodexArgs(opts, outFile, gitRepo, resumeId) {
    if (resumeId) {
        // `codex exec resume <id> [PROMPT]` doesn't accept --sandbox (a
        // session's sandbox policy is fixed when it's first created and
        // inherited on resume) or the `review` subcommand — just a plain
        // prompt, same shape as write mode's task description.
        const args = ["exec", "resume", resumeId, "--json", "-o", outFile];
        if (opts.model) {
            args.push("-m", opts.model);
        }
        if (!gitRepo) {
            args.push("--skip-git-repo-check");
        }
        const parts = buildTaskParts(opts);
        if (parts.length === 0) {
            return { error: "Write mode needs to know what to do — pass --prompt or extra instructions describing the fix." };
        }
        args.push(`${parts.join(" ")} ${EXCLUDE_TOOLING_NOTE}`);
        return { args };
    }

    const args = ["exec", "--sandbox", opts.write ? "workspace-write" : "read-only", "--json", "-o", outFile];
    if (opts.model) {
        args.push("-m", opts.model);
    }
    if (!gitRepo) {
        // Codex's `review` subcommand always diffs against git history, and even a
        // plain `exec` prompt gets gated behind a "trusted directory" check outside
        // a git repo. Skip that check whenever there's no git history to rely on.
        args.push("--skip-git-repo-check");
    }

    if (opts.write) {
        // Never use `review` here — it only ever produces a critique, it has no
        // ability to apply a fix. Give Codex a plain task description instead
        // and let it use its own tools (git, file read/edit) within the
        // workspace-write sandbox to find and make the change itself.
        const parts = buildTaskParts(opts);
        if (parts.length === 0) {
            return { error: "Write mode needs to know what to do — pass --prompt or extra instructions describing the fix." };
        }
        args.push(`${parts.join(" ")} ${EXCLUDE_TOOLING_NOTE}`);
        return { args };
    }

    if (opts.rawPrompt) {
        args.push(`${opts.rawPrompt} ${EXCLUDE_TOOLING_NOTE}`);
        return { args };
    }

    if (!gitRepo) {
        args.push(`${DEFAULT_FULL_REVIEW_PROMPT} ${withExcludeNote(opts.instructions)}`);
        return { args };
    }

    if (opts.instructions) {
        // `review`'s own selector flags (--uncommitted/--commit/--base) are
        // mutually exclusive with a trailing PROMPT argument — there's no way
        // to give it a selector AND custom instructions at the same time.
        // Fall back to a plain exec prompt that names the same target in
        // words instead, the same way write mode does.
        const parts = buildTaskParts(opts);
        args.push(`${parts.join(" ")} ${EXCLUDE_TOOLING_NOTE}`);
        return { args };
    }

    args.push("review");
    if (opts.selector.type === "uncommitted") {
        args.push("--uncommitted");
    } else if (opts.selector.type === "commit") {
        args.push("--commit", opts.selector.value);
    } else if (opts.selector.type === "base") {
        args.push("--base", opts.selector.value);
    }
    // No trailing PROMPT here — review's selector flags reject one outright,
    // and a git-diff-scoped review has nowhere to wander into .claude/.agents/
    // in the first place, so the exclude note wouldn't add anything real.
    return { args };
}

async function runCodex(args, cwd, timeoutMs) {
    return new Promise((resolve) => {
        const isWin = process.platform === "win32";
        const child = spawn("codex", isWin ? args.map(winCmdQuote) : args, {
            cwd,
            shell: isWin,
            stdio: ["ignore", "pipe", "pipe"],
        });

        let stdout = "";
        let timedOut = false;
        const timer = setTimeout(() => {
            timedOut = true;
            if (child.pid) {
                killProcessTree(child.pid);
            }
        }, timeoutMs);

        // With --json now always on, stdout is the JSONL event stream (used to
        // pull out the thread id for the next call's resume) — still forwarded
        // live to stderr for visibility, but also accumulated so it can be
        // scanned once the process exits.
        child.stdout.on("data", (chunk) => {
            process.stderr.write(chunk);
            stdout += chunk;
        });
        child.stderr.on("data", (chunk) => process.stderr.write(chunk));

        child.on("error", (err) => {
            clearTimeout(timer);
            resolve({ code: 127, timedOut: false, launchError: err, stdout });
        });

        child.on("close", (code) => {
            clearTimeout(timer);
            resolve({ code, timedOut, launchError: null, stdout });
        });
    });
}

async function main() {
    const opts = parseArgs(process.argv.slice(2));
    if (opts.help) {
        printHelp();
        return;
    }

    const cwd = opts.dir ? path.resolve(opts.dir) : process.cwd();
    const gitRepo = isGitRepo(cwd);

    if (!gitRepo && opts.selector && (opts.selector.type === "commit" || opts.selector.type === "base")) {
        console.error(
            `[codex] --${opts.selector.type} was requested, but "${cwd}" is not a git repository, so there's no commit/branch history to diff against.`
        );
        process.exitCode = 1;
        return;
    }

    if (!gitRepo) {
        console.error(`[codex] "${cwd}" is not a git repository — working against the whole directory instead of a git diff.`);
    }

    const mode = opts.write ? "write" : "read";
    let resumeId = opts.fresh ? null : loadSessionId(cwd, mode);

    const outFile = path.join(os.tmpdir(), `codex-${Date.now()}-${process.pid}.txt`);
    let built = buildCodexArgs(opts, outFile, gitRepo, resumeId);

    if (built.error) {
        console.error(`[codex] ${built.error}`);
        process.exitCode = 1;
        return;
    }

    console.error(`[codex] cwd: ${cwd}`);
    console.error(`[codex] mode: ${opts.write ? "write (workspace-write sandbox)" : "read-only"}`);
    console.error(`[codex] session: ${resumeId ? `resuming ${resumeId}` : "starting fresh"}`);
    console.error(`[codex] running: codex ${built.args.map((a) => (a.includes(" ") ? JSON.stringify(a) : a)).join(" ")}`);

    let { code, timedOut, launchError, stdout } = await runCodex(built.args, cwd, opts.timeoutMs);

    // A resumed thread can fail to resume (expired, deleted, etc.) — rather
    // than surface that as a hard failure, drop the stale pointer and retry
    // once as a fresh session.
    if (resumeId && !launchError && !timedOut && code !== 0) {
        console.error(`[codex] resuming thread ${resumeId} didn't work — retrying as a fresh session.`);
        clearSessionId(cwd, mode);
        resumeId = null;
        built = buildCodexArgs(opts, outFile, gitRepo, null);
        if (built.error) {
            console.error(`[codex] ${built.error}`);
            process.exitCode = 1;
            return;
        }
        ({ code, timedOut, launchError, stdout } = await runCodex(built.args, cwd, opts.timeoutMs));
    }

    if (launchError) {
        console.error(`[codex] failed to launch "codex": ${launchError.message}`);
        console.error("[codex] This usually means one of two things:");
        console.error("[codex]   1. The Codex CLI isn't installed, or isn't on PATH.");
        console.error("[codex]   2. It WAS installed, but this session started before that PATH change took");
        console.error("[codex]      effect — Windows doesn't propagate PATH updates to processes already running.");
        console.error('[codex] Try opening a brand new terminal window and running "codex --version" there.');
        console.error("[codex]   - If that works: restart Claude Code entirely (not just retry) so it picks up the");
        console.error("[codex]     updated PATH, then try again.");
        console.error('[codex]   - If "codex --version" fails even in a fresh terminal: the CLI genuinely needs to');
        console.error("[codex]     be (re)installed / added to PATH.");
        process.exitCode = 127;
        return;
    }

    if (timedOut) {
        console.error(`[codex] timed out after ${opts.timeoutMs / 1000}s (increase with --timeout <seconds>)`);
        process.exitCode = 124;
        return;
    }

    let finalMessage = "";
    try {
        finalMessage = fs.readFileSync(outFile, "utf8").trim();
    } catch {
        // codex may not have written the file (e.g. it errored before finishing)
    } finally {
        fs.rm(outFile, { force: true }, () => {});
    }

    const threadId = extractThreadId(stdout);
    if (threadId) {
        saveSessionId(cwd, mode, threadId);
    }

    if (opts.write && gitRepo && code === 0) {
        const diffStat = getDiffStat(cwd);
        if (diffStat) {
            finalMessage += `\n\n--- Files changed by Codex (git diff --stat) ---\n${diffStat}`;
        }
    }

    if (finalMessage) {
        console.log(finalMessage);
    } else if (code !== 0) {
        console.error(`[codex] codex exited with code ${code} and produced no output.`);
    } else {
        console.error("[codex] codex exited 0 but wrote no final message.");
    }

    process.exitCode = code === null || code === undefined ? 1 : code;
}

main();
