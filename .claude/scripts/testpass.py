#!/usr/bin/env python3
# ---------------------------------------------------------------------------
# testpass.py — 테스트 통과 표시 + 그룹 전부 통과면 히스토리로 이관
#   규칙: .claude/rules/document.md (개별 통과는 그 자리 ✅ O / 그룹 전부 통과해야 그룹째 이관)
#   만든 이유(2026-10-06 장군님 지시): 매번 손으로 표를 고치고 옮기느라 오래 걸렸다.
#
# 쓰는 법
#   python .claude/scripts/testpass.py <영역폴더> <코드접두> [통과코드...]
#     통과코드를 적으면 그 항목만, 안 적으면 그 접두의 전 항목을 통과(✅ O) 처리한다.
#   예) python .claude/scripts/testpass.py ws20디자인트리 TC          (TC 전부 통과)
#       python .claude/scripts/testpass.py Login LE LE1 LE3           (LE1·LE3 만 통과)
#
#   그룹의 전 항목이 ✅ O 가 되면 그 표를 00_현황판.md 에서 떼어
#   00_히스토리.md 맨 위 그룹으로 옮기고, 현황판에는 "이관 완료" 한 줄만 남긴다.
#   (설명 문단은 사람이 쓰는 것 — 옮긴 표 아래에 직접 적는다)
# ---------------------------------------------------------------------------
import io, os, re, sys, subprocess, datetime

# 윈도우 콘솔 기본 코드페이지(cp949)에서 한글/기호 출력이 터지는 것 방지
try:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass

if len(sys.argv) < 3:
    print("쓰는 법: testpass.py <영역폴더> <코드접두> [통과코드...]", file=sys.stderr)
    sys.exit(1)

area, prefix = sys.argv[1], sys.argv[2]
only = set(sys.argv[3:])

root = subprocess.check_output(["git", "rev-parse", "--show-toplevel"]).decode().strip()
base = os.path.join(root, ".works", area)
board = os.path.join(base, "00_현황판.md")
hist = os.path.join(base, "00_히스토리.md")
if not os.path.isfile(board):
    print("STOP: 현황판이 없다 — %s" % board, file=sys.stderr)
    sys.exit(2)

s = io.open(board, encoding="utf-8").read()
lines = s.split("\n")
row_re = re.compile(r"^\|\s*(%s\d+)\s*\|" % re.escape(prefix))

hit = 0
for i, l in enumerate(lines):
    m = row_re.match(l)
    if not m:
        continue
    if only and m.group(1) not in only:
        continue
    new = re.sub(r"\|\s*☐\s*\|?\s*$", "| ✅ O |", l)
    if new != l:
        lines[i] = new
        hit += 1

if hit == 0 and not only:
    print("STOP: %s 로 시작하는 미테스트(☐) 항목이 없다." % prefix, file=sys.stderr)
    sys.exit(3)

s = "\n".join(lines)
io.open(board, "w", encoding="utf-8", newline="\n").write(s)
print("통과 표시 %d건 (%s)" % (hit, prefix))

# 그룹 전 항목 통과인지 — 현황판에 남은 그 접두 행 중 ☐ 가 있으면 아직이다.
rows = [l for l in s.split("\n") if row_re.match(l)]
if any("☐" in l for l in rows):
    left = sum(1 for l in rows if "☐" in l)
    print("아직 미테스트 %d건 — 이관하지 않는다(규칙: 그룹 전부 통과해야 이관)." % left)
    sys.exit(0)

# ── 그룹째 이관 ──────────────────────────────────────────────────────────
today = datetime.date.today().isoformat()
head = "| 코드 | 동작 | 조작·확인 포인트 | O/X |"
sep = "|---|---|---|---|"
block = "## %s 그룹 (%s 전 항목 통과)\n\n%s\n%s\n%s\n" % (prefix, today, head, sep, "\n".join(rows))

old = io.open(hist, encoding="utf-8").read() if os.path.isfile(hist) else "# 히스토리 — %s\n" % area
p = old.split("\n")
ins = next((i for i, l in enumerate(p) if l.startswith("## ")), len(p))
io.open(hist, "w", encoding="utf-8", newline="\n").write(
    "\n".join(p[:ins]).rstrip("\n") + "\n\n" + block + "\n" + "\n".join(p[ins:]).lstrip("\n"))

# 현황판에서 그 행들과 바로 위 표 머리(헤더+구분선)를 떼어낸다.
out, drop = [], 0
for l in s.split("\n"):
    if row_re.match(l):
        drop += 1
        continue
    out.append(l)
# 남은 표 머리(헤더/구분선)가 외톨이면 같이 뺀다
txt = "\n".join(out)
txt = re.sub(r"\| *코드 *\| *동작 *\|[^\n]*\n\|[-| ]+\|\n(?=\s*(\n|##|###|>|$))", "", txt)
txt = txt.replace("### 테스트할 것",
                  "### 테스트할 것 — 없음\n\n> %s 그룹(%s) 전 항목 통과 → [00_히스토리.md](00_히스토리.md) 이관 완료(%s).\n\n<!--지움-->"
                  % (prefix, prefix, today), 1)
txt = re.sub(r"<!--지움-->[^\n]*\n", "", txt)
txt = re.sub(r"\n{3,}", "\n\n", txt)
io.open(board, "w", encoding="utf-8", newline="\n").write(txt)
print("그룹 %s(%d건) → 00_히스토리.md 이관. 설명 문단은 직접 적을 것." % (prefix, drop))
