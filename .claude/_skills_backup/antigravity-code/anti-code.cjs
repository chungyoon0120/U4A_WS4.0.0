#!/usr/bin/env node
"use strict";

/**
 * Antigravity CLI(agy) 위임 러너.
 *
 * 철학: Claude 는 소스를 분석하지 않는다. "어디를 봐라"만 담은 지침서(브리핑)를
 * 넘기고, 실제 소스 분석·설계·코딩은 agy 가 스스로 한다.
 *
 * 기본: --mode plan  (계획만 세우고 파일을 편집하지 않음)
 * 실제 편집은 --go(=--edit) 를 명시할 때만 --mode accept-edits 로 전환.
 * 위험한 터미널 명령까지 무확인 실행하려면 --go 와 함께 --yolo 를 추가.
 *
 * 사용:
 *   node anti-code.cjs --brief <지침서.md>              # 지침서 읽고 계획 (기본)
 *   node anti-code.cjs --brief <지침서.md> --go         # 지침서 읽고 실제 코딩
 *   node anti-code.cjs "<짧은 지시>"                     # 지침서 없이 즉석 지시
 *   node anti-code.cjs --brief <지침서.md> "추가 지시"   # 지침서 + 보충 지시
 *   node anti-code.cjs --go --yolo --brief <지침서.md>   # 편집 + 명령 무확인
 *   옵션: --model "<모델>"  --add-dir "<경로>"(반복)  --timeout 45m
 */

const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

function findAgy() {
  const la = process.env.LOCALAPPDATA;
  if (la) {
    const known = path.join(la, "agy", "bin", "agy.exe");
    if (fs.existsSync(known)) return known;
  }
  const isWin = process.platform === "win32";
  const probe = spawnSync(isWin ? "where" : "which", ["agy"], { encoding: "utf8" });
  if (probe.status === 0) {
    const hit = String(probe.stdout || "")
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean)
      .find((p) => !isWin || /\.(exe|cmd|bat)$/i.test(p));
    if (hit) return hit;
  }
  return null;
}

const argv = process.argv.slice(2);
let mode = "plan"; // 기본: 계획만
let skipPerms = false;
let model = null;
let timeout = "30m";
let briefFile = null;
const addDirs = [];
const words = [];

for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === "--go" || a === "--edit") mode = "accept-edits";
  else if (a === "--plan") mode = "plan";
  else if (a === "--yolo") skipPerms = true;
  else if (a === "--brief") briefFile = argv[++i];
  else if (a === "--model") model = argv[++i];
  else if (a === "--add-dir") addDirs.push(argv[++i]);
  else if (a === "--timeout") timeout = argv[++i];
  else words.push(a);
}

const extra = words.join(" ").trim();

// 프롬프트 구성: 지침서가 있으면 "이 파일을 직접 읽고 분석해 수행하라" 로 감싼다.
let prompt;
if (briefFile) {
  const briefAbs = path.resolve(briefFile);
  if (!fs.existsSync(briefAbs)) {
    console.error(`지침서 파일을 찾을 수 없습니다: ${briefAbs}`);
    process.exit(2);
  }
  const parts = [
    "너는 아래 '작업 지침서' 파일을 처음부터 끝까지 읽고, 지침서에 나열된 참고 문서·기존 소스·원본 소스 파일들을 네가 직접 열어 분석한 뒤, 그 기준(공통 자산 소비·의미 토큰·반응형 등)에 맞춰 작업을 수행하라. 참고 대상의 실제 내용 분석은 전적으로 너의 몫이다.",
    `작업 지침서 경로: ${briefAbs}`,
  ];
  if (extra) parts.push(`추가 지시: ${extra}`);
  prompt = parts.join("\n\n");
} else {
  prompt = extra;
}

if (!prompt) {
  console.error('작업 지시가 비어 있습니다. --brief <지침서.md> 또는 "<지시>" 를 주세요.');
  process.exit(2);
}
if (skipPerms && mode !== "accept-edits") {
  console.error("--yolo 는 실제 편집 모드(--go)와 함께만 사용할 수 있습니다.");
  process.exit(2);
}

const agy = findAgy();
if (!agy) {
  console.error("agy CLI 를 찾을 수 없습니다. Antigravity CLI 설치/로그인 후 다시 시도하세요.");
  process.exit(127);
}

const args = ["--print", prompt, "--mode", mode, "--print-timeout", timeout];
if (skipPerms) args.push("--dangerously-skip-permissions");
if (model) args.push("--model", model);
for (const d of addDirs) args.push("--add-dir", d);

const banner =
  mode === "plan"
    ? "plan(계획만, 편집 안 함)"
    : `accept-edits(편집)${skipPerms ? " +skip-perms(명령 무확인)" : ""}`;
console.error(`[anti-code] agy ${banner}`);
if (briefFile) console.error(`[anti-code] 지침서: ${path.resolve(briefFile)}`);
if (extra) console.error(`[anti-code] 추가지시: ${extra}`);
console.error("");

const r = spawnSync(agy, args, { stdio: "inherit" });
if (r.error) {
  console.error(`[anti-code] agy 실행 실패: ${r.error.message}`);
  process.exit(1);
}
process.exit(r.status == null ? 1 : r.status);
