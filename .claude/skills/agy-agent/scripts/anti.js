#!/usr/bin/env node
"use strict";

/**
 * Brings in the Antigravity CLI (`agy`, nicknamed "Anti") as a coding
 * colleague: ask its opinion, have it check/review something, or hand it a
 * task to actually fix. Runs `agy --print` non-interactively and prints its
 * final message to stdout.
 *
 * Usage:
 *   node anti.js [--write]
 *                [--uncommitted | --commit <sha> | --base <branch> | --prompt "<text>"]
 *                ["extra instructions"]
 *                [--dir <path>] [--model <model>] [--timeout <seconds>]
 *
 * Without --write: agy gets either a git diff (pasted as plain text, no
 * filesystem access at all) or a raw prompt — read-only either way.
 * With --write: agy gets real filesystem access (--add-dir) and no --sandbox,
 * so it can actually edit files. Only pass this when the user asked for the
 * change to be MADE, not just suggested.
 *
 * Defaults to --uncommitted if neither a selector nor --prompt is given.
 */

const { spawn, spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const MAX_DIFF_CHARS = 200000;

const DEFAULT_DIFF_REVIEW_PROMPT =
    "Review the following git diff for bugs, security issues, and code quality problems. " +
    "Give a structured list of findings with file references where possible.\n\n";

const DEFAULT_FULL_REVIEW_PROMPT =
    "Review the code in this directory for bugs, security issues, and code quality problems. " +
    "Give a structured list of findings with file references where possible.";

// Only matters when agy actually gets filesystem access (needsDirAccess) —
// the diff-paste modes never grant --add-dir at all, so there's nothing for
// agy to wander into. Whenever it does have access (write mode, or the
// no-git whole-directory fallback), keep it out of this tooling's own skill
// files (including a large bundled binary) in .claude/.agents/.
const EXCLUDE_TOOLING_NOTE =
    "Ignore the .claude/ and .agents/ directories entirely — they contain this tooling's own skill files " +
    "(including large bundled binaries), not part of the project. Do not read, review, or modify anything inside them.";

function isGitRepo(cwd) {
    const result = spawnSync("git", ["-C", cwd, "rev-parse", "--is-inside-work-tree"], { encoding: "utf8" });
    return result.status === 0 && result.stdout.trim() === "true";
}

function hasCommits(cwd) {
    const result = spawnSync("git", ["-C", cwd, "rev-parse", "--verify", "-q", "HEAD"], { encoding: "utf8" });
    return result.status === 0;
}

function getDiffStat(cwd) {
    const result = spawnSync("git", ["-C", cwd, "diff", "--stat"], { encoding: "utf8" });
    return result.status === 0 ? result.stdout.trim() : "";
}

function getUncommittedDiff(cwd) {
    const diffResult = spawnSync("git", ["-C", cwd, "-c", "core.quotepath=false", "diff", "--no-color", "HEAD", "--"], {
        encoding: "utf8",
    });
    let diff = diffResult.status === 0 ? diffResult.stdout : "";

    const statusResult = spawnSync("git", ["-C", cwd, "status", "--porcelain"], { encoding: "utf8" });
    const untracked = (statusResult.stdout || "")
        .split("\n")
        .filter((line) => line.startsWith("?? "))
        .map((line) => line.slice(3).trim());

    for (const file of untracked) {
        if (diff.length >= MAX_DIFF_CHARS) {
            diff += "\n... (truncated, additional untracked files not shown)\n";
            break;
        }
        let content;
        try {
            content = fs.readFileSync(path.join(cwd, file), "utf8");
        } catch {
            continue; // binary or unreadable — skip rather than fail the whole review
        }
        diff += `\n--- new file: ${file} ---\n${content}\n`;
    }

    return diff.slice(0, MAX_DIFF_CHARS);
}

function getCommitDiff(cwd, sha) {
    const result = spawnSync("git", ["-C", cwd, "show", "--no-color", sha], { encoding: "utf8" });
    return result.status === 0 ? result.stdout.slice(0, MAX_DIFF_CHARS) : null;
}

function getBaseDiff(cwd, branch) {
    const result = spawnSync("git", ["-C", cwd, "diff", "--no-color", `${branch}...HEAD`], { encoding: "utf8" });
    return result.status === 0 ? result.stdout.slice(0, MAX_DIFF_CHARS) : null;
}

// See scripts/codex.js in the sibling codex skill for the full rationale: on
// Windows, `agy` can potentially resolve to more than one installed copy
// depending on how it's spawned, so `shell: true` (matching what a normal
// terminal does) plus our own argv quoting is the safe default here too —
// Node does not auto-quote array args when shell: true is set.
function winCmdQuote(arg) {
    if (arg.length > 0 && !/[\s"&|<>^%!()]/.test(arg)) {
        return arg;
    }
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
        spawnSync("taskkill", ["/pid", String(pid), "/T", "/F"], { stdio: "ignore" });
    } else {
        process.kill(pid, "SIGKILL");
    }
}

const FLAGS_NEEDING_VALUE = new Set(["--commit", "--base", "--prompt", "--dir", "-C", "--model", "-m", "--timeout", "--instructions"]);

function parseArgs(argv) {
    const opts = {
        write: false,
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
            console.error(`[anti] ${a} requires a value but none was given.`);
            process.exit(1);
        }

        if (a === "--write") {
            opts.write = true;
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
            "Usage: node anti.js [--write]",
            '                    [--uncommitted | --commit <sha> | --base <branch> | --prompt "<text>"]',
            '                    ["extra instructions"]',
            "                    [--dir <path>] [--model <model>] [--timeout <seconds>]",
            "",
            "Runs `agy --print` non-interactively (no approval prompts) and prints",
            "Antigravity's response to stdout.",
            "Without --write: read-only (diff pasted as text, or a raw prompt — no",
            "filesystem access either way, except the no-git whole-directory fallback).",
            "With --write: agy gets real filesystem access and can edit files.",
            "Defaults to --uncommitted if neither a selector nor --prompt is given.",
        ].join("\n")
    );
}

function buildPrompt(opts, cwd) {
    if (opts.write) {
        const parts = [];
        if (opts.rawPrompt) {
            parts.push(opts.rawPrompt);
        } else {
            const gitRepo = isGitRepo(cwd) && hasCommits(cwd);
            if (gitRepo && opts.selector) {
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
        if (parts.length === 0) {
            return { error: "Write mode needs to know what to do — pass --prompt or extra instructions describing the fix." };
        }
        return { prompt: `${parts.join(" ")} ${EXCLUDE_TOOLING_NOTE}`, needsDirAccess: true };
    }

    if (opts.rawPrompt) {
        return { prompt: opts.rawPrompt, needsDirAccess: false };
    }

    const gitRepo = isGitRepo(cwd) && hasCommits(cwd);

    if (!gitRepo && (opts.selector.type === "commit" || opts.selector.type === "base")) {
        return { error: `--${opts.selector.type} was requested, but "${cwd}" has no git commit history to diff against.` };
    }

    if (!gitRepo) {
        const base = opts.instructions ? `${DEFAULT_FULL_REVIEW_PROMPT} ${opts.instructions}` : DEFAULT_FULL_REVIEW_PROMPT;
        return {
            prompt: `${base} ${EXCLUDE_TOOLING_NOTE}`,
            needsDirAccess: true,
            note: `"${cwd}" has no git history — reviewing the whole directory instead of a diff.`,
        };
    }

    let diff;
    if (opts.selector.type === "commit") {
        diff = getCommitDiff(cwd, opts.selector.value);
        if (diff === null) {
            return { error: `Could not find commit "${opts.selector.value}" in "${cwd}".` };
        }
    } else if (opts.selector.type === "base") {
        diff = getBaseDiff(cwd, opts.selector.value);
        if (diff === null) {
            return { error: `Could not diff against base branch "${opts.selector.value}" in "${cwd}".` };
        }
    } else {
        diff = getUncommittedDiff(cwd);
    }

    if (!diff.trim()) {
        return { error: "Nothing to review — the selected diff is empty." };
    }

    const instructions = opts.instructions ? `\n\nAdditional focus: ${opts.instructions}` : "";
    const prompt = `${DEFAULT_DIFF_REVIEW_PROMPT}\`\`\`diff\n${diff}\n\`\`\`${instructions}`;
    return { prompt, needsDirAccess: false };
}

async function runAgy(agyArgs, prompt, cwd, timeoutMs) {
    return new Promise((resolve) => {
        const isWin = process.platform === "win32";
        const child = spawn("agy", isWin ? agyArgs.map(winCmdQuote) : agyArgs, {
            cwd,
            shell: isWin,
            stdio: ["pipe", "pipe", "pipe"],
        });

        let stdout = "";
        let stderr = "";
        let timedOut = false;
        const timer = setTimeout(() => {
            timedOut = true;
            if (child.pid) {
                killProcessTree(child.pid);
            }
        }, timeoutMs);

        // The prompt goes over stdin rather than as a command-line argument —
        // a real diff can easily be tens of thousands of characters, well
        // past what Windows (and most shells) allow on a single command line.
        child.stdin.end(prompt);

        child.stdout.on("data", (chunk) => {
            stdout += chunk;
        });
        child.stderr.on("data", (chunk) => {
            process.stderr.write(chunk);
            stderr += chunk;
        });

        child.on("error", (err) => {
            clearTimeout(timer);
            resolve({ code: 127, timedOut: false, launchError: err, stdout, stderr });
        });

        child.on("close", (code) => {
            clearTimeout(timer);
            resolve({ code, timedOut, launchError: null, stdout, stderr });
        });
    });
}

// Confirmed cause in practice: Claude Code's own permission/approval mode.
// Under a more autonomous mode, a Bash call flagged as risky can get
// auto-approved into a *more restricted* execution context (e.g. blocked
// network access) instead of getting a normal approval prompt — enough to
// break agy's OAuth check even though `agy` itself is logged in and works
// fine when run directly in a terminal. Switching Claude Code to "always
// ask" resolves it, since a human-approved call runs unrestricted.
const AUTH_FAILURE_PATTERN = /not logged into antigravity|authentication timed out|failed to get oauth token/i;

function isAuthFailure(stderr) {
    return AUTH_FAILURE_PATTERN.test(stderr);
}

async function main() {
    const opts = parseArgs(process.argv.slice(2));
    if (opts.help) {
        printHelp();
        return;
    }

    const cwd = opts.dir ? path.resolve(opts.dir) : process.cwd();
    const built = buildPrompt(opts, cwd);

    if (built.error) {
        console.error(`[anti] ${built.error}`);
        process.exitCode = 1;
        return;
    }
    if (built.note) {
        console.error(`[anti] ${built.note}`);
    }

    const agyArgs = ["--print", "--dangerously-skip-permissions"];
    if (!opts.write) {
        agyArgs.push("--sandbox");
    }
    agyArgs.push("--print-timeout", `${Math.round(opts.timeoutMs / 1000)}s`);
    if (opts.model) {
        agyArgs.push("--model", opts.model);
    }
    if (built.needsDirAccess) {
        agyArgs.push("--add-dir", cwd);
    }

    console.error(`[anti] cwd: ${cwd}`);
    console.error(`[anti] mode: ${opts.write ? "write (real filesystem access)" : "read-only"}`);
    console.error(`[anti] running agy --print (prompt: ${built.prompt.length} chars via stdin)`);

    let { code, timedOut, launchError, stdout, stderr } = await runAgy(agyArgs, built.prompt, cwd, opts.timeoutMs);

    // A piped-stdio child process (which is what this always is, so the
    // response text can be captured programmatically) has no real terminal
    // attached. If agy's OAuth token happens to need a refresh at exactly
    // this moment, that refresh has nowhere to complete non-interactively
    // and the run fails — even though the exact same command typed directly
    // into a terminal works, because a real terminal *can* complete it. One
    // retry is enough to recover the common case where the previous attempt
    // (or a manual "agy --print ..." run) already resolved the refresh.
    if (!launchError && !timedOut && isAuthFailure(stderr)) {
        console.error("[anti] Antigravity auth check failed — retrying once in case a token refresh just completed elsewhere.");
        ({ code, timedOut, launchError, stdout, stderr } = await runAgy(agyArgs, built.prompt, cwd, opts.timeoutMs));
    }

    if (!launchError && !timedOut && !stdout.trim() && isAuthFailure(stderr)) {
        console.error("[anti] Antigravity CLI reports it isn't authenticated, and this didn't clear up on retry.");
        console.error("[anti] Most likely cause: Claude Code's own permission/approval mode. Under an autonomous mode");
        console.error('[anti] ("only ask for actions detected as risky" / auto-approve), a Bash call flagged as risky can');
        console.error("[anti] get auto-approved into a MORE restricted execution context (e.g. no network), which is");
        console.error("[anti] enough to break agy's OAuth token check even though the CLI itself is logged in.");
        console.error('[anti] Fix: switch Claude Code\'s permission mode to "always ask" (so this Bash call gets a normal,');
        console.error("[anti] unrestricted approval instead of an auto-approved restricted one), then try again.");
        console.error('[anti] If that\'s not it: run "agy --print \\"hi\\" --dangerously-skip-permissions" directly in a');
        console.error("[anti] normal terminal window once to refresh/confirm the session, then retry.");
        process.exitCode = 1;
        return;
    }

    if (launchError) {
        console.error(`[anti] failed to launch "agy": ${launchError.message}`);
        console.error("[anti] This usually means one of two things:");
        console.error("[anti]   1. The Antigravity CLI isn't installed, or isn't on PATH.");
        console.error("[anti]   2. It WAS installed, but this session started before that PATH change took");
        console.error("[anti]      effect — Windows doesn't propagate PATH updates to processes already running.");
        console.error('[anti] Try opening a brand new terminal window and running "agy --version" there.');
        console.error("[anti]   - If that works: restart Claude Code entirely (not just retry) so it picks up the");
        console.error("[anti]     updated PATH, then try again.");
        console.error('[anti]   - If "agy --version" fails even in a fresh terminal: the CLI genuinely needs to');
        console.error("[anti]     be (re)installed / added to PATH.");
        process.exitCode = 127;
        return;
    }

    if (timedOut) {
        console.error(`[anti] timed out after ${opts.timeoutMs / 1000}s (increase with --timeout <seconds>)`);
        process.exitCode = 124;
        return;
    }

    let finalMessage = stdout.trim();

    if (opts.write && code === 0 && isGitRepo(cwd)) {
        const diffStat = getDiffStat(cwd);
        if (diffStat) {
            finalMessage += `\n\n--- Files changed by Anti (git diff --stat) ---\n${diffStat}`;
        }
    }

    if (finalMessage) {
        console.log(finalMessage);
    } else if (code !== 0) {
        console.error(`[anti] agy exited with code ${code} and produced no output.`);
    } else {
        console.error("[anti] agy exited 0 but printed nothing.");
    }

    process.exitCode = code === null || code === undefined ? 1 : code;
}

main();
