# WORK ORDER 2 — WS4.0 : get the stack, the message and the quiet lines out to the console

- Issued : 2026-09-30
- Repo : `C:\Users\socce\Documents\Github\CHUNGYOON0120\U4A_WS4.0.0`
- **Branch : a new branch from `bootstrap`** (it already has your `dcb1d34a`). Never `autofix-skill-test` (experiment branch).
- Korean reading copy : [`ws40-work-order-2.ko.md`](ws40-work-order-2.ko.md) — same content; change both or neither
- Previous order : [`ws40-work-order.md`](ws40-work-order.md) — **done, `dcb1d34a`.** Your report on it is what A8 is built on
- Paired order : [`tester-work-order-2.md`](tester-work-order-2.md) — T11 (↔ A6) and T13 (↔ A8)
- History of this file : written by two incident-loop windows on 2026-09-30 and merged into one.
  A5–A7 from the first, A8–A9 from the second (which found that the tester runs the **exe**)

---

## 1. Why this exists

A tester program drives WS4.0 automatically, writes one `INCIDENT.md` per failure, and an AI
agent reads that single document and works out the cause.

Two real incidents were run through it. Both times the analysis **followed the code path
correctly and refused to suppress the symptom** — and both times it stopped at
**`Confidence: medium`** for the same reason:

> *"incident 에 해당 호출부의 **stack 이 없어** 실제로 `ws_usp.js:51` 에서 터졌는지는 실측하지 못했습니다."*

> *"가장 중요한 누락은 … 예외 직전의 호출 정보입니다. 추가로 필요했던 내용: **전체 JavaScript stack trace** …"*

**Two incidents, same request → a decision, not a hint.**

| run | error | what reached the document |
|---|---|---|
| 1 | `[onError]: Uncaught TypeError: n is not a function` (`klay.js:1:122893`) | message + `url, line:col`. The one frame shown was `ws_trycatch.js:158` — the handler's `console.trace`, not the throw site |
| 2 | `[FUTURE FATAL] One or more parameters could not be found. - sap.ui.core.theming.Parameters` | message only — *"exception 객체 없음 · 이벤트에 stackTrace 없음"* |

### The tester runs the installed exe — this changes what reaches it

Both documents show paths under
`C:\Users\socce\AppData\Local\Programs\com.u4a_ws3.app\resources\app.asar\…`. **The tester drives
the packaged build, not dev mode.**

In the exe, `ws_log.js` replaces `console.*` with electron-log and lets through to the real
console **only `error` and above** (`:104`, `:150-155`). Everything else goes to the log file only.
Your own report on the first order flagged this as unconfirmed
(`.works/ws40-work-order/00_현황판.md`: *"테스터가 exe 를 돌리는지 개발 모드를 돌리는지 미확인"*).
**It is the exe.**

---

## 2. The items

| # | What | Where | Size |
|---|---|---|---|
| **A5** | Print the stack `_reportError` already receives | `js/ws_trycatch.js:44` | **one line** |
| **A6** | Put the message into the critical marker | `js/ws_trycatch.js:158`, `:186` | **one line each** |
| **A8** | Switch that lets `참고`/`주의`/`info` lines reach the console in the exe | `js/ws_log.js:104` + `U4ALOG` | small — paired with tester T13 |
| **A7** | Entry logs at the few boundaries the analysis had to guess at | a handful of sites | small — **needs A8 to be visible** |
| **A9** | **Report only** — UI5 log lines (`[FUTURE FATAL]`) carry no stack | read and measure, no edits | investigation |

**Order: A5 → A6 → A8 → A7 → A9.** A5 is the one asked for twice. A7 comes after A8 because in
the exe its lines would otherwise never reach the tester.

---

## A5. Print the stack to the console

### The code — `www/ws30/ws10_20/js/ws_trycatch.js:40-45`

```js
function _reportError(sKind, sMessage, sStack) {

    // 1) 로그는 언제나 남긴다 (첫 1건 제한과 무관)
    try {
        console.error(sMessage);          // ← sStack is never printed
    } catch (e) { … }
    …
    IPC.send('u4a-log:send-error', { …, stack: sStack || '', … });   // ← the stack goes only here (:83)
}
```

Both callers **already pass the stack in** — `onError` at `:152` (`errorObj.stack`),
`onunhandledrejection` at `:180` (`event.reason.stack`). The tester reads the console; it never
sees IPC.

`onunhandledrejection` works **by accident** — at `:170` it builds the stack into the message
itself, so those incidents arrive with a full stack:

```
[error] [onunhandledrejection]: TypeError: l_class is not a constructor
    at createUIInstance (…/design/preview/index.js:5079:42)
    at setUIScript      (…/design/preview/index.js:5387:3)   ×4
    at drawPreview      (…/design/preview/index.js:5172:2)
```

`onError` does not (`sMessage` at `:146` is `` `[onError]: ${message}\n${url}, ${line}:${col}` ``),
so its incidents arrive with **one frame — the handler itself** — and the analysis correctly
refused it:

> *"`ws_trycatch.js:158` 은 오류를 발생시킨 자리가 아니라 전역 오류를 받아 fatal dialog 를 띄운 자리입니다."*

### The change

```js
var sOut = sMessage;
if (sStack && sMessage.indexOf(sStack) === -1) {
    sOut = sMessage + "\n" + sStack;
}
console.error(sOut);
```

- `sStack` is `''` at some call sites — the guard keeps the old output for those
- the `indexOf` check stops `onunhandledrejection` from printing its stack twice
- `sStack` may be long. If this file or `ws_html5_logger.js` already has a length-cap convention,
  follow it; otherwise cap it and say what cap you used
- print what was handed in — do not reformat or re-derive the stack
- IPC, the dialog and `APP.exit()` stay exactly as they are

**No tester change is needed**: it already extracts frames from the message text
(tester commit `794e7fb`), and in the exe an `error`-level line does reach the console.

**Scope**: `_reportError` is shared by every window that installs this handler (13 files reference
`ws_trycatch`, including the preview iframe — run 1's error came from execution context 563,
not the main window). One edit covers all of them.

---

## A6. Put the message into the critical marker

### The code — `ws_trycatch.js:158` and `:186`

```js
console.trace(`[onError]: `);                 // :158
console.trace(`[onunhandledrejection]: `);    // :186
```

These are the markers the tester uses to recognise *"the app is about to show a fatal dialog and
exit"*. **They carry no text.** (electron-log does not replace `console.trace`, so in the exe these
go to the console natively — that is why the tester sees them.)

A real incident folder's entire recorded message was:

```
[onError]:
```

The real text was in a **separate** console line 76 ms later, which the tester had to find and
stitch on (`incident_20260923_123342_613/raw.json`). When ordering is unlucky the incident is
recorded empty.

### The change

```js
console.trace(`[onError]: ${sErrMsg}`);
console.trace(`[onunhandledrejection]: ${sErrorMsg}`);
```

Both variables are already in scope.

**Why here and not in the tester:** the tester already stitches the empty case (its commit
`0be028a`) because it must survive old WS4.0 builds — but this removes the problem instead of
working around it.

⚠ **Check that the marker still matches.** The tester recognises a critical error by a fixed
substring in a `console.trace` line. Appending after `[onError]: ` keeps it intact — **verify, and
report what the line now looks like**, so the tester side can confirm against its rule.

---

## A8. Let `참고` / `주의` / `info` lines reach the console in the exe

### The facts — read in source, 2026-09-30

```js
// www/ws30/ws10_20/js/ws_log.js
log.transports.console.level  = 'error';          // :104
…
if (APP && APP.isPackaged) {
    Object.assign(CONSOLE, log.functions);          // :150-155 — exe only
}
```

What this means for work already done:

| Line | Level | Reaches the tester in the exe? |
|---|---|---|
| `U4ALOG.caught` — `잡고 넘어감 \| … \| thrown at 파일:줄 함수()` | `참고` → `console.log` | **no** |
| your `PROP_COERCE` (A4) and `THROTTLE` (A2) lines | `참고` | **no** |
| any `console.warn` in a `catch` (122 in the first order's scan) | warn | **no** |
| A7's entry logs below (`U4ALOG.info`) | info | **no** |
| `console.error(…, e)` — your 339 edits | error | yes |

**The 2,813 existing `U4ALOG.caught` sites are invisible to the tester in the exe.** The tester
already turns your A2 throttle off on attach (its T6, `26269ba`) — in the exe that has no visible
effect, because the lines it un-throttles never reach the console.

### What to build

**Production default unchanged.** A switch in the same shape as A2:

```js
U4ALOG.setConsoleLevel("silly")    // everything goes to the console as well as the file
U4ALOG.setConsoleLevel("error")    // back to today's default
```

- sets electron-log's `transports.console.level` at runtime; callable from `Runtime.evaluate`
  at any time, safe to call twice, harmless before the logger exists
- **must reach the preview iframe too** — run 1's error came from there. If the iframe has its own
  electron-log instance or console, make the switch reach it, or report that it must be called
  per context
- in dev mode it is a no-op (the console is native there) — say so in a code comment
- the **file** transport is not touched

### Why WS4.0 and not the tester

- **tester reads the log file** (`%APPDATA%\<app>\logs\U4A_WS_<date>.log`) — no WS4.0 change, but a
  second stream with no execution-context id, merged by timestamp. Tester T8 (which frame a line
  came from) would not work for these lines
- **tester sets electron-log's level itself via `eval`** — reaches into WS4.0's internals from
  outside, and breaks silently the day logging is reorganised

A switch owned by the logger keeps these lines in the console stream the tester already reads,
with their context ids.

### Watch the volume

Report console lines for one WS20 app-open with the switch on vs off — the tester's buffer is
20,000 lines (its T5). **Report the exact call signature** — the tester needs it (T13).

---

## A7. Entry logs at the boundaries the analysis had to guess at

Both analyses reconstructed the call path **from reading the source**, and both then said they
could not confirm it actually ran:

> *"`fnCreateWs30()`가 해당 사고에서 실행됐다는 runtime trace"* — listed as missing

> *"오류가 `drawPreview()` 중인지 `refreshPreview()` 중인지에 대한 구분"* — listed as missing

A5 fixes this for anything that throws. It does **not** help when the app catches the error, or
when a library logs a complaint without throwing — which is what both test incidents were.

### The change

An entry log at the **small number of boundaries** the preview/WS30 path crosses:

```js
U4ALOG.info("<what>", "<target>", "<result>");
```

| Boundary | Why |
|---|---|
| `fnWs30Creator()` / `fnCreateWs30()` | run 2 asked whether it ran at all |
| `refreshPreview()` and `drawPreview()` in `design/preview/index.js` | run 1 asked which of the two was active |
| `createUIInstance()` — with the object id and UI5 class | run 1 asked *"who called it with what"* |

- **Entry only, only at these boundaries.** Nothing inside loops. `createUIInstance` runs once per
  tree node — check the volume on a real app before keeping that one
- include the identifiers the analysis asked for (`OBJID`, UI5 class name), truncated
- `info` is not raised as an incident by the tester — correct, this is a trail, not a failure
- ⚠ **in the exe these lines reach the tester only with A8 switched on.** Do A8 first
- **measure the volume** on one WS20 app before committing. More than a few lines per screen → drop it and say so

⚠ The tester is separately adding a state snapshot at incident time (`tester-work-order-2.md`
T9) that reads the selected node's attributes. **Report what you log here before implementing the
`createUIInstance` one**, so the same values are not recorded twice.

---

## A9. Report only — UI5 log lines have no stack

Run 2's line:

```
[2026-09-29 21:46:31.820] [error] 2026-09-29 21:46:31.819600 [FUTURE FATAL] One or more parameters could not be found. - sap.ui.core.theming.Parameters
```

This is **not** an exception, so `onError` never sees it and A5 does not help. It is UI5's own
logger writing through `console.error` (electron-log in the exe), and the event carried **no
stackTrace at all**. The analysis needed *who called* `Parameters.get()` — its candidate was
`ws_usp.js:51` via `fnCreateWs30()`, unconfirmed. (A7's `fnCreateWs30` entry log answers part of it.)

**Change nothing. Find out and report:**

1. which object prints `[FUTURE FATAL]` today (`sap.base.Log` / `jQuery.sap.log` / the shim in
   `library-preload.js:140-145`?), and whether WS4.0 already installs a log listener anywhere
2. whether one `fatal`/`error` listener could add `new Error().stack` to that line — **measure how
   many such lines one WS20 app-open produces** before proposing it
3. anything else that would tell the reader *who called* in cases like run 2

---

## 3. How to work

1. **Branch from `bootstrap`.** `git branch --show-current` and a clean `git status --short` first.
2. **One item per commit**, separately revertible.
3. **No backup `.js` files.** The `AGENTS.md:51` backup rule does not apply — 685 such files piled up before.
4. **Never modify a `catch` inside `ws_html5_logger.js`** — the logger calling the logger is infinite recursion.
5. **A5, A6 and A8 must be checked in the packaged exe**, not only in dev mode — the difference
   between the two is half the reason for this order.
6. **A7 must be volume-checked** on a real app before it is committed.
7. When done, bring the app down with a **logoff** — last time it was left open in
   `YLCY_TEST2142` edit mode, and a server edit lock blocks the next run.

## 4. How to verify

| | Check |
|---|---|
| **A5** | Force an uncaught error (`setTimeout(() => { null.x; })`). The console line carries message **and** stack — in dev mode and in the exe |
| **A5** | `Promise.reject(new Error("p"))` shows its stack **once**, not twice |
| **A5** | A site with empty `sStack` prints exactly what it printed before |
| **A5** | ⚠ report whether `errorObj` was non-null for an error thrown inside a script loaded from the UI5 server (`https://…/openui5_lib/…`) — run 1 was one. If it is `null` there, say so; do not work around it |
| **A6** | The `[onError]:` line now contains the error text; the substring the tester matches is still present |
| **A8** | In the exe: switch on → a `잡고 넘어감 … thrown at …` line appears in DevTools; switch off → it stops. Repeat inside the preview iframe's context |
| **A7** | Open one app in WS20 and count the new lines. A handful, not hundreds |

## 5. Report back

- branch and commit range
- **A5** — a real console line before and after (exe); the `errorObj` answer
- **A6** — the exact text of the new marker line (the tester matches on it)
- **A8** — exact call signature, whether one call covers the iframe, line counts on/off
- **A7** — which boundaries you instrumented, and the measured line count per screen
- **A9** — the findings, with file:line
- anything here that turned out to be wrong

## 6. Evidence

| Fact | Verified at |
|---|---|
| `_reportError` prints only the message | `ws_trycatch.js:40-45` |
| Both callers already pass the stack | `ws_trycatch.js:152`, `:180` |
| `onunhandledrejection` builds the stack into the text | `ws_trycatch.js:170` |
| Markers carry no text | `ws_trycatch.js:158`, `:186` |
| Console level `error`; console replaced only in the exe | `ws_log.js:104,150-155` |
| The tester runs the exe | both run documents — paths under `AppData\Local\Programs\com.u4a_ws3.app\resources\app.asar` |
| Run 1 came from execution context 563 | run 1 document, raw event |
| Run 2's console event had no stackTrace | run 2 document: *"이벤트에 stackTrace 없음"* |
| An incident recorded as `[onError]:` and nothing else | `incident_20260923_123342_613/raw.json` |
| A seven-frame stack arriving via the rejection path | `incident_20260923_053441_411/raw.json` |
| The tester extracts stacks from text; stitches empty criticals; turns the throttle off | tester commits `794e7fb`, `0be028a`, `26269ba` |
| The analysis rejecting `ws_trycatch.js:158` | run 1 reply §1 |
| The stack named as the blocking gap, twice | run 1 reply §5, run 2 reply §5–6 |
| Your own flag of the exe gap | `.works/ws40-work-order/00_현황판.md` |
