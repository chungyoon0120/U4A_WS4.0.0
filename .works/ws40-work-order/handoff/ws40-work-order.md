# WORK ORDER — WS4.0 : make swallowed errors visible from outside

- Issued : 2026-09-29
- Repo : `C:\Users\socce\Documents\Github\CHUNGYOON0120\U4A_WS4.0.0`
- **Branch : start a new branch from `bootstrap`.** Do not work on `autofix-skill-test` —
  that is an experiment branch where errors are planted and removed.
- Korean reading copy : [`ws40-work-order.ko.md`](ws40-work-order.ko.md)
- Paired order (other team) : [`tester-work-order.md`](tester-work-order.md) — read §5 of this file

---

## 1. The background — why you are being asked for this

A tester program drives WS4.0 automatically. When an error occurs it writes an incident folder,
and an AI agent reads that folder and works out the cause.

**The goal is that one single file is enough for that analysis.** Today the incident is spread
across six files, and even then the analysis stalls.

**The tester has no judgement of its own.** All it has is what WS4.0 prints to the console and
what Chrome hands it over CDP. Nothing else. Nobody is there to interpret, infer or add context.

So whatever is not printed is gone forever.

### What the analysis said it was missing

Two real analysis documents, for two different errors, ended with **the same sentence**:

> "the incident folder and daemon measurement did not include
>  **the app attribute dump** or **a UI5 stack trace**"

Both reproduced the error successfully and still stopped at **`Confidence: medium`** —
they reached *"this code path is involved"* but could not say *"this value is the bad one."*

### Why it has to be WS4.0 and not the tester

Chrome sends **no stack** with console messages. Verified against a real incident's raw event:
it carries only `type · args · executionContextId · timestamp`.

So no CDP option can recover the location of an error that WS4.0 caught and logged as text.

The only thing that works already lives in this repo — `U4ALOG.caught` parses `e.stack` itself
and writes the location into the message (`ws_html5_logger.js:277 _crashSite`):

```
[참고] [창] [WS20] [T7XH] 잡고 넘어감 | l_class is not a constructor | thrown at design/preview/index.js:5076 createUIInstance()
```

**A `catch` that does not call `U4ALOG.caught` is permanently invisible from outside the app.**

---

## 2. The four items

| # | What | Where | Size |
|---|---|---|---|
| **A1** | Make every `catch` leave a usable trace — **case by case, not a blanket edit** | `www/**/*.js` | ~380 sites, and **one measurement decides most of it** |
| **A2** | Add a switch to disable the repeat-suppression throttle | `js/ws_html5_logger.js` | small |
| **A3** | (checked — **no change**) | `js/ws_html5_logger.js:460` | — |
| **A4** | Record what was discarded when a property value is dropped | `design/preview/index.js` | 2 sites |

**Priority: A2 → A1 → A4.**
A2 is small and blocks the tester's repeat-error work, so do it first.

⚠ **A1 is not "add `U4ALOG.caught` to 755 places".** An earlier draft of this order said that and
it was wrong: about half those sites already log correctly, and a handful of them **must not be
touched at all** — a `catch` inside the logger that calls the logger is infinite recursion.
Read §A1 in full before editing anything.

---

## A1. Make every `catch` leave a usable trace — **not by adding `U4ALOG.caught` everywhere**

**Read this section in full before you touch anything. The naive version of this task
(add `U4ALOG.caught(e)` to every `catch`) is wrong and will break the app.**

### What the scan actually found

774 `catch` blocks in WS4.0's own code do not call `U4ALOG.caught`. They are **not** all the same
problem. Every block's body was read (brace-matched, comments stripped, 2026-09-29):

| | Situation | Count | What it needs |
|---|---|---:|---|
| **A** | Logs the **error object** — `console.error("…", e)` | **392** | **nothing. Leave it alone.** |
| **B** | Logs **text only** — `console.error("…", e.message)` | **339** | add `e` to the call — **one argument** |
| **C** | Logs through something my scan missed — `U4ALOG.error(…)`, `_hostFail(…)`, `_caught(…)`, `oCon.error(…)` | **~17** | **nothing. Verify and leave it alone.** |
| **D** | Rethrows — `throw e`, `setTimeout(() => { throw e })` | **~4** | **nothing.** It is handled outside on purpose |
| **E** | Deliberately silent, with the reason in a comment | **~7** | **do not touch. See below** |
| **F** | Logging commented out — `// console.error(…)` | **~9** | **ask why before re-enabling** |
| **G** | Returns a fallback value only — `return ""`, `iLen = -1` | **~6** | judgement needed |
| **H** | Genuinely empty `catch {}` | **2** | add a log |

Breakdown by console level and whether a location is recoverable:

| Level used | location present | location missing | total |
|---|---:|---:|---:|
| `console.error` | 361 | 227 | 588 |
| `console.warn` | 14 | 108 | 122 |
| `console.log` / `debug` | 17 | 4 | 21 |
| no console call | — | — | 43 |
| | | | **774** |

**So: about half of these sites are already correct.** The real work is 339 one-argument edits
plus a handful of judgement calls.

---

### The rule — two questions, in this order

**Question 1: is this error safe to pass over, or not?**

```
safe to pass over   →  there is a fallback; the app continues correctly  →  U4ALOG.caught  (level 참고, not raised as an incident)
not safe            →  this is a real failure                            →  console.error / U4ALOG.error  (raised as an incident)
```

`U4ALOG.caught` exists for the first case. Its own comment says so
(`ws_html5_logger.js:849`, added 2026-09-08):

> *"오류를 잡는 자리 대부분이 아무 흔적도 안 남기고 조용히 넘어갔다(실측 81%).
>  그 자리에서 무슨 일이 있었는지 로그에 없으면 나중에 원인을 못 짚는다."*

and why it logs at `참고` rather than `주의` (2026-09-10):

> *"여기 걸리는 것 대부분이 '일단 해 보고 안 되면 다른 길로 가는' 정상 흐름이라
>  '주의' 로 남기면 로그만 봤을 때 문제가 계속 나는 것처럼 보인다."*

**It was built for sites that logged nothing. It was not built to replace working `console.error` calls.**

**Question 2: can the reader tell where it came from?**

`console.error("failed:", e)` — yes. Chrome puts the full stack in the event.
`console.error("failed:", e.message)` — no. Text only, and the location is gone for good.

**Changing the level is not this job. Adding the location is.**

---

### What to do, case by case

#### A (392) and C (~17) — leave them alone

They already log the error object, or they log through `U4ALOG.error` / `_hostFail` / `_caught` /
`oCon.error`. **Converting these to `U4ALOG.caught` would make things worse**: `caught` logs at
`참고`, which the tester does **not** raise as an incident. A real failure would stop being
reported.

For C, just confirm the call really does carry the error (some pass `e.message` too — those
belong in B).

#### B (339) — add one argument

```js
// before
console.error("[INTR-001] cleanup of the failed window failed:", e2 && e2.message);
// after
console.error("[INTR-001] cleanup of the failed window failed:", e2);
```

Keep the message. Keep the level. **Pass the error object instead of (or in addition to) its
message.** That is the whole change.

This is cheaper and safer than inserting `U4ALOG.caught`, and it preserves the author's
judgement about whether this site is an incident.

⚠ **One thing to verify first — see the note at the end of this section.**

#### D (~4) — leave them alone

```js
setTimeout(() => { throw e; });     // design/preview/index.js:5612
if (bStrict) { throw e; }           // js/ws_html5_ws20_edit.js:146
```

The error is deliberately sent outward. It becomes an uncaught error, which arrives with a full
stack already. Adding a log here duplicates it.

#### E (~7) — **do not touch. This is the dangerous group.**

These are silent on purpose and the reason is written next to them:

```js
// www/ws30/ws10_20/js/ws_html5_logger.js:977    // 앱 본체에 못 알려도 화면은 계속 간다.
// www/ws30/ws10_20/js/ws_html5_logger.js:1099   // 로그 때문에 화면이 멈추면 안 된다.
// www/ws30/ws10_20/js/ws_html5_logger.js:1153   return false;
```

**These are inside the logger itself. Calling the logger from them is infinite recursion —
the app dies.** There are more of the same kind:

```js
// www/ws30/ws10_20/js/ws_common.js:4245          // 알릴 통로가 없어도 앱은 계속 간다.
// www/ws30/ws10_20/design/preview/index.js:5828  /* 부모 접근 실패시엔 원본 동작 그대로 진행 */
// www/ws30/ws10_20/Popups/dataMonitor/Popup/js/index.js:1268  /* 이미 끊긴 경우 */
```

**Rule: a `catch` inside `ws_html5_logger.js` is never modified by this job.**
For the others, the comment is the author's decision — respect it. If you think one is wrong,
**report it; do not change it.**

#### F (~9) — ask before re-enabling

Logging that someone commented out:

```js
// www/ws30/ws10_20/js/ws_html5_ws20_tree.js:392
// console.error("[HTML5][WS20][tree] Web Dynpro Conversion Log 오픈 실패:", e);
```

Also in `ws_main.js:857`, `ws_main copy.js:741`, `ws_util.js:901` and `:920`,
`js/usp/ws_usp.js:4860` and `:4873`, `Popups/versionManagement/.../control.js:971`,
`design/preview/index.js:5881`.

It may have been silenced because it was too noisy, or switched off temporarily and forgotten.
**List them with the surrounding context and ask. Do not silently re-enable.**

(`ws_main copy.js` looks like a stray copy of `ws_main.js` — flag it, do not edit it.)

#### G (~6) — judgement needed, report your reasoning

```js
// www/ws30/ws10_20/js/ws_common.js:4530   return "";
// www/ws30/ws10_20/js/ws_common.js:4626   return false;
// www/ws30/ws10_20/js/ws_html5_datamon.js:744   iLen = -1;
```

A fallback value is returned and nothing is recorded. Apply Question 1: if the fallback is the
intended behaviour, `U4ALOG.caught(e)` is right. If the caller cannot actually cope with the
fallback, it is a real failure and belongs at `error` level.

**Write down which you chose and why, per site.**

#### H (2) — add a log

```js
// www/ws30/ws10_20/js/ws_common.js:4569   } catch (e) { }
// www/ws30/ws10_20/js/ws_common.js:4590   } catch (e) { }
```

Read what the `try` was attempting, then apply Question 1.

---

### ⚠ Verify this before doing B (339 sites)

Group B is worth doing **only if the tester actually reads the stack out of an error object.**
There is reason to doubt it.

`u4a-ws-cdp-tester/lib/cdp-client.js:372 _argText` checks in this order:

```js
if (a.preview && a.preview.properties) { …use preview… }   // ← checked first
if (a.description !== undefined)       { …use description… } // ← checked second
```

**The full stack lives in `description`. `preview` holds truncated property values.**
An Error object arrives with both, so the preview branch may win and the stack may be cut off.

None of the 14 existing incident folders contains a non-string console argument, so this could
not be confirmed from the data.

**Measure it first.** In WS4.0's console, with the tester attached:

```js
console.error("probe:", new Error("probe-stack-test"));
```

Then look at what the tester recorded for that line.

- **Full stack recorded** → do group B as described.
- **Truncated** → the fix belongs in the tester (swap those two checks), and **392 sites in
  group A start working for free.** Report this before editing 339 files in WS4.0.

**This measurement takes a minute and decides whether 339 edits are worth making. Do it first.**

---

### Rules for any edit in this section

1. **Use the binding name that is actually there.** Measured: `e` 636 · `error` 57 · `err` 18 ·
   `e2` 15 · `t` 15 · `e3` 13 · `oError` 7 · `eSend` 6 · others.
   **A blanket replace produces `ReferenceError`.**
2. **One `catch {` has no binding** — give it `catch (e) {` first.
3. **One-line blocks are common** (`} catch (e) { return false; }`). Expanding them is fine;
   keep the original statements in order.
4. **Never touch minified files** — `jquery.min.js` · `jquery-ui.min.js` · `crypto-js.min.js`.
5. **Excluded paths** — `openui5_lib` · `node_modules` · `lib/` · `js/aceeditor` ·
   `lib/fontawesome` · `lib/monaco` · anything starting with `_`.
6. **Never modify a `catch` inside `ws_html5_logger.js`.**
7. **Do not create backup `.js` files.** Git reverts things. The `AGENTS.md:51` backup rule
   **does not apply to this job** — 685 such files piled up before and had to be deleted.
8. **Do not change a log's level** as part of this job, except where Question 1 is explicitly
   being answered (groups G and H). Report level problems instead.

### Reproduce the scan yourself

Do not work from a copied list — it goes stale the moment anyone edits a file. Run this from the
repo's `www/` folder. **If your totals differ from the table above, your rule is wrong; fix the
rule before touching any code.**

```python
import os, re, io
from collections import Counter

PAT = re.compile(r'(?<![.\w])catch\s*(?:\(\s*([A-Za-z_$][\w$]*)\s*\))?\s*\{')
SKIP = ('openui5_lib', 'node_modules', 'lib', 'aceeditor', 'fontawesome', 'monaco')
STRIP = re.compile(r'/\*.*?\*/|//[^\n]*', re.S)

def body_of(text, brace_pos):          # brace-match the catch body
    depth = 0
    for j in range(brace_pos, min(len(text), brace_pos + 20000)):
        if text[j] == '{':
            depth += 1
        elif text[j] == '}':
            depth -= 1
            if depth == 0:
                return text[brace_pos + 1:j]
    return None

rows, cat = [], Counter()
for root, dirs, files in os.walk('.'):
    dirs[:] = [d for d in dirs if d not in SKIP and not d.startswith('_')]
    for f in files:
        if not f.endswith('.js') or f.startswith('_'):
            continue
        p = os.path.join(root, f)
        t = io.open(p, encoding='utf-8', errors='replace').read()
        if f.endswith('.min.js') or len(t) / max(1, t.count('\n') + 1) > 300:
            continue                    # minified: one huge line
        for m in PAT.finditer(t):
            b = body_of(t, m.end() - 1)
            if b is None or 'U4ALOG.caught' in b:
                continue
            v, bs = m.group(1), STRIP.sub('', b)
            line = t.count('\n', 0, m.start()) + 1
            if not bs.strip():
                k = 'H empty'
            elif not re.search(r'console\.(error|warn|log|debug|trace)', bs):
                k = 'C/D/E/F/G no console call'
            elif v and re.search(r'console\.\w+\s*\([^;]*(?<![.\w])' + re.escape(v) + r'\s*(\.stack|\)|,)', bs):
                k = 'A location present'
            else:
                k = 'B text only'
            cat[k] += 1
            rows.append((p, line, v, k, bs.strip().replace('\n', ' ')[:120]))

for k in sorted(cat):
    print('%-32s %4d' % (k, cat[k]))
print('total', sum(cat.values()))
```

Expected:

```
A location present               392
B text only                      339
C/D/E/F/G no console call         41
H empty                            2
total                            774
```

The `C/D/E/F/G` bucket is the 43 sites that call no `console.*`; print those rows in full and
sort them by hand into C, D, E, F and G — there are only about forty, and each needs a look.

### Split the work

**This will not fit in one session.** Order:

1. **Run the measurement** in the ⚠ box above. It may cancel group B entirely.
2. **H (2 sites)** and the **C/D/E/F/G list (~41 sites)** — read them, sort them, report F and G
   with your reasoning before changing anything in those two groups.
3. **B**, only if the measurement says it is worth it — folder by folder:
   `www/ws30/ws10_20/js` first, then `js/usp`, then `www/js`, then the rest.

### Keep a progress file so the next session can resume

Before you start, create `.docs/A1-progress.md` in this repo and commit it with each batch:

```markdown
# A1 진행 — catch 에 오류 위치 남기기

- 스캔 결과 : A 392 / B 339 / C~G 41 / H 2  (합 774)
- 측정 결과 (테스터가 오류 객체에서 스택을 꺼내나) : 미측정 / 꺼낸다 / 잘린다
- 브랜치 : <branch>

| 묶음 · 폴더 | 대상 | 끝난 날 | 커밋 | 앱 확인 |
|---|---:|---|---|---|
| H 빈 catch | 2 | | | |
| C~G 분류 | 41 | | | |
| B · www/ws30/ws10_20/js | | | | |
| … | | | | |

## 판단한 것 (F · G · H — 왜 그렇게 정했나)
- (파일:줄 — 판단과 근거)

## 손대지 않고 넘긴 것
- (파일:줄 — 왜)
```

**A session that runs out of context must leave this file accurate.** A later session reads it,
re-runs the scan, and continues. Without it the next session cannot tell what is done.

### After each folder, before moving on

```bash
node --check <each changed file>      # 1. syntax
git diff --stat                       # 2. only the intended lines?
```

**3. Then actually start WS4.0 and open one screen.**

`node --check` proves the file parses. It does **not** prove the app still runs — a `catch` block
expanded wrongly can shift a brace and break the enclosing function while still parsing.

Minimum check per folder: the app launches, you reach WS10, you open one app into WS20, and the
console shows no new error that was not there before.

**4. Commit, and update `.docs/A1-progress.md` in the same commit.**

`node --check` on an ES-module file needs `--input-type=module`; a failure of that kind is not a
real error — verify by eye and move on.

**Each commit must be revertible on its own.**
---

## A2. Add a switch for the repeat-suppression throttle

**This is a paired change. The tester will call the switch — see §5.**

### Current code — `www/ws30/ws10_20/js/ws_html5_logger.js:51-52`

```js
var CAUGHT_FIRST = 3;      // 처음 3번은 그대로 남긴다
var CAUGHT_EVERY = 500;    // 그 뒤로는 500번마다 한 번
```

`caught()` counts occurrences **keyed by the error message** (`:859-865`). From the 4th
occurrence of the same message on, it logs **once every 500 times**.

### Three problems

1. **Repeating and intermittent errors vanish from the log.** The tester clicks every 100 ms,
   so the same error passes 3 occurrences almost immediately. After that it is 1 in 500 — when
   an incident is finally raised, the log may hold no trace of it.
2. **The key is the message, so unrelated sites share a counter.** A common message such as
   `Cannot read properties of undefined` is thrown in dozens of places. If site A throws it
   3 times, **site B is silenced on its very first occurrence.**
3. **`_oCaughtCount` is never cleared** (`:50`, no reset anywhere). Anything that once passed
   3 occurrences stays suppressed for the rest of the session.

### What to build

**Keep today's behaviour as the default.** Add a toggle that turns the throttle off:

```js
U4ALOG.setCaughtThrottle(false)   // 끈다 — 전부 남긴다
U4ALOG.setCaughtThrottle(true)    // 켠다 — 기본값
```

Requirements:

- Must be callable from the console / `Runtime.evaluate` at any time, not only at load.
- Turning it **off** must also **clear `_oCaughtCount`**, so errors already suppressed
  start logging again immediately.
- Production default unchanged.

**Also fix problem 3 regardless of the switch:** clear `_oCaughtCount` on screen change and on
app change. A counter that never resets is a leak as well as a logging bug.

Problem 2 (message-only key) is **not** required in this order. If it is cheap to key by
message + throw site, do it and say so in the report; otherwise leave it.

---

## A3. The level in `_write` — do not change

At `ws_html5_logger.js:460`, level `참고` goes out through `console.log`, so the tester does not
raise it as an incident.

**This is correct as-is.** The code comment's reasoning holds: most of what reaches `caught` is
normal "try this, fall back to that" flow, and promoting it to `오류` would turn the log red.

The tester records **every console line regardless of level**, so `참고` still reaches the analysis.

**Checked — no change. Do not touch it.**

---

## A4. Record what was discarded when a property value is dropped

This is the **"app attribute dump"** the analysis asked for twice.

### A4-1. `design/preview/index.js:5076` — no context on failure

```js
var l_class = getUIClassInstance(ls_0022.LIBNM);
try {
    parent.oAPP.attr.prev[is_tree.OBJID] = new l_class(jQuery.sap.uid(), setUIProperty(is_tree, lt_0015));
} catch (e) {
    if (typeof U4ALOG !== "undefined" && U4ALOG.caught) { U4ALOG.caught(e); }
    parent.oAPP.attr.prev[is_tree.OBJID] = new l_class(jQuery.sap.uid());   // ← rebuilt with no properties
}
```

`U4ALOG.caught` is there, but **which object and which class is missing.**
`caught` takes a **second argument `sWhere`** (`ws_html5_logger.js:849`):

```js
U4ALOG.caught(e, "createUIInstance OBJID=" + is_tree.OBJID + " LIBNM=" + ls_0022.LIBNM);
```

**A real incident came from exactly this site** — `l_class is not a constructor`,
`preview/index.js:5079`, where the retry inside the `catch` threw again.

### A4-2. `design/preview/index.js:5209 parsePropertyValue` — silent drops

```js
case "INT":
case "FLOAT":
    l_val = Number(vVal);
    if (isNaN(l_val) === true) {
        return 0;               // ← a bad value silently becomes 0
    }
    return l_val;
default:
    …
    if (l_type && typeof l_type.isValid === "function" && l_type.isValid(l_val) === false) {
        l_val = undefined;      // ← a bad value silently disappears
    }
```

Neither leaves a record. That is exactly why the analysis could not name the bad attribute.

Add one line at each discard point:

```js
if (typeof U4ALOG !== "undefined" && U4ALOG.warn) {
    U4ALOG.warn("속성값 버림",
                is_attr.OBJID + "." + is_attr.UIATT,
                is_attr.UIADT + " <- " + String(vVal).slice(0, 80) + " => 0");
}
```

**Field names are verified — do not re-derive them.** `is_attr` is a `T_0015` row; callers are
`:5285` (`ls_0015`) and `:5356`, `:5369` (`lt_0015[i]`). `OBJID`, `UIATT`, `UIADT` all exist there.

**Two things to check:**

- This function runs **hundreds of times per screen.** Log **only inside the two branches that
  discard a value** — never on successful conversion.
- **Truncate the value** (`.slice(0, 80)`) so business data does not spill into the log.

**Verify:** open one app in WS20 and count `속성값 버림` lines. A handful is expected;
hundreds means the guard is in the wrong place.

---

## 5. The paired change on the tester side

A2 only pays off if something turns the switch off during a test run. That is the tester's job,
and it is already ordered there: the tester will call

```js
session.eval('typeof U4ALOG !== "undefined" && U4ALOG.setCaughtThrottle && U4ALOG.setCaughtThrottle(false)')
```

right after attaching to a window.

**So the switch must be callable that way** — a global on `U4ALOG`, available once the logger has
loaded, safe to call more than once, and harmless if called before the logger exists.

**Report back when A2 lands**, so the tester side can be switched on.

---

## 6. How to work

1. **Branch from `bootstrap`.** Confirm with `git branch --show-current` and a clean
   `git status --short` before starting.
2. **Do not fix only the line that threw** — check the surrounding flow and every use site.
3. **No backup `.js` files.**
4. **A1 adds lines only.** Commit folder by folder with `node --check` before each commit.
5. **Never touch minified files or third-party libraries.**
6. **A4 must be volume-checked.**

---

## 7. Report back

- branch name and commit range
- **the measurement result** — does the tester read the full stack out of an error object,
  or is it truncated? This decides whether group B (339 sites) is worth doing at all
- your **sorted list of the ~41 no-console sites** into groups C / D / E / F / G, and your
  judgement for each F and G site
- actual counts — sites changed, files touched, against A 392 / B 339 / C–G 41 / H 2
- **whether A2 landed** and the exact call signature (the tester needs it)
- whether `_oCaughtCount` clearing was added, and where it clears
- anything the scan found that this order did not predict

---

## 8. Evidence

| Fact | Verified at |
|---|---|
| Tester enables only `Runtime.enable` · `Page.enable` | `u4a-ws-cdp-tester/lib/cdp-client.js:298,493,601,619` |
| Console lines arrive with no stack | a real incident's `raw.json` — the event has 4 keys |
| Uncaught errors arrive with a full 7-frame stack | same file, `exceptionDetails.stackTrace` |
| `thrown at …` is produced by WS4.0 itself | `ws_html5_logger.js:277 _crashSite` |
| Console is captured at every level | `u4a-ws-cdp-tester/lib/ws/window-session.js:85` |
| Tester can call JS in the page | `u4a-ws-cdp-tester/lib/cdp-client.js:603 evaluate` |
| Why the analysis stopped | two `analysis.md` files in incident folders |
| `catch` counts | full scan of `www` (2026-09-29) |
| `is_attr` field names | `index.js:5285`, `:5356`, `:5369` + `T_0015` rows |
