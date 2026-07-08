#!/usr/bin/env node
/*
 * codex-review.cjs
 * -----------------
 * 작업이 끝난 뒤, 변경분(git diff)을 Codex CLI 서브에이전트에게 넘겨
 * "로직 + UX" 를 함께 검수시키는 스크립트.
 *
 * child_process 로 `codex exec` (비대화형, 읽기전용 샌드박스) 를 실행한다.
 * Codex 는 리포지토리를 직접 읽으며, 넘겨준 diff 를 중심으로 리뷰한다.
 *
 * 사용법 (스킬 문서 참고):
 *   node .claude/skills/codex-review/codex-review.cjs [옵션] [파일...]
 *
 * 옵션:
 *   --staged           스테이징된 변경만 리뷰 (git diff --cached)
 *   --commit <ref>     특정 커밋의 변경을 리뷰 (git show <ref>)
 *   --base <ref>       base..HEAD 범위 리뷰 (예: main)
 *   --model <name>     Codex 모델 지정 (기본: Codex 설정값 / CODEX_MODEL)
 *   [파일...]          지정 시 해당 경로들의 diff 로 범위 축소
 *
 * 종료코드: Codex 프로세스의 종료코드를 그대로 전달.
 */

'use strict';

const { spawn, spawnSync, execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

// ── 프로젝트 루트: 이 스크립트 기준 .claude/skills/codex-review → ../../.. ──
const ROOT = path.resolve(__dirname, '..', '..', '..');

// ── 인자 파싱 ──────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const opts = { staged: false, commit: null, base: null, model: process.env.CODEX_MODEL || null, files: [] };
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--staged') opts.staged = true;
  else if (a === '--commit') opts.commit = argv[++i];
  else if (a === '--base') opts.base = argv[++i];
  else if (a === '--model') opts.model = argv[++i];
  else if (a === '-h' || a === '--help') { printHelp(); process.exit(0); }
  else opts.files.push(a);
}

function printHelp() {
  console.log('node codex-review.cjs [--staged|--commit <ref>|--base <ref>] [--model <name>] [파일...]');
}

// ── git diff 수집 ─────────────────────────────────────────────────────
function git(args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}

let scopeLabel;
let diffArgs;
if (opts.commit) {
  scopeLabel = `커밋 ${opts.commit}`;
  diffArgs = ['show', '--no-color', opts.commit];
} else if (opts.base) {
  scopeLabel = `${opts.base}..HEAD`;
  diffArgs = ['diff', '--no-color', `${opts.base}...HEAD`];
} else if (opts.staged) {
  scopeLabel = '스테이징된 변경';
  diffArgs = ['diff', '--no-color', '--cached'];
} else {
  scopeLabel = '작업트리 변경(uncommitted)';
  diffArgs = ['diff', '--no-color', 'HEAD'];
}
if (opts.files.length) diffArgs = diffArgs.concat('--', opts.files);

let diff = '';
try {
  diff = git(diffArgs);
} catch (e) {
  console.error('[codex-review] git diff 실패:', e.message);
  process.exit(2);
}

if (!diff.trim()) {
  console.error(`[codex-review] 변경사항 없음 (${scopeLabel}). 리뷰할 diff 가 비어 있습니다.`);
  process.exit(0);
}

// 변경 파일 목록
let changedFiles = [];
try {
  const nameArgs = diffArgs.slice();
  nameArgs.splice(1, 0, '--name-only'); // 'diff'/'show' 다음에 삽입
  changedFiles = git(nameArgs).split('\n').map((s) => s.trim()).filter(Boolean);
} catch (_) {}

// ── 리뷰 프롬프트 (로직 + UX) ─────────────────────────────────────────
const PROMPT = `당신은 U4A WS4.0 (UI5 → HTML5 컨버전) 프로젝트의 시니어 코드 리뷰어입니다.
아래 변경분(${scopeLabel})을 **로직 정확성**과 **UX 표준 준수** 두 축으로 검수하세요.
답변은 반드시 한국어로 작성합니다.

변경된 파일:
${changedFiles.map((f) => '  - ' + f).join('\n') || '  (목록 수집 실패 — 아래 diff 참고)'}

# 검수 기준

## A. 로직 / 정확성
- 버그·경계조건·null/undefined·비동기(await 누락, Promise 미처리)·이벤트 누수.
- 예외 삼키기 금지: 조용한 catch / stopPropagation 남용 / 오류 억제가 있으면 지적.
- busy 처리 짝: BUSY_ON 후 완료/실패 경로 모두에서 BUSY_OFF 되는지.
- 핸들러는 유효성검증부터: 부작용/서버호출 전에 입력검증이 앞서는지.

## B. UX 표준 (이 프로젝트 SSOT = .analy/16_공통_화면UX_표준.md, CLAUDE.md 규칙)
- **공통 자산 소비**: 모양/동작을 화면마다 새로 만들지 말고 shell.css / bootstrap-skin.css /
  u4a-ui.js / tokens.css 의 공통 컴포넌트(.u4a-dialog/.u4a-table/.u4a-input/.u4a-combo/.u4a-btn 등)를
  사용하는지. 공통 CSS/JS 를 직접 수정하지 않고 스코프 override 하는지(§16 0.5).
- **하드코딩 금지**: 색은 theme/tokens.css 의미 토큰만(hex 금지), 문구는 메시지 키만(임의 메시지 생성 금지).
- **반응형 필수**: 고정 px 폭 금지, flex/컨테이너 기준.
- 잘리는 텍스트엔 툴팁(data-tip-trunc), 오버레이는 공통 시스템(showModal/showMessage), 토스트는 공통 정중앙.
- '_' 로 시작하는 폴더/파일(백업·구버전)을 현행으로 인용하지 않았는지.

# 출력 형식 (이 형식 그대로)

## 판정
PASS 또는 CHANGES_REQUESTED 중 하나.

## 심각 이슈 (반드시 고쳐야 함)
- [파일:라인] 문제 — 근거(가능하면 .analy/16 절 번호 또는 CLAUDE.md 규칙) — 제안 수정.
  (없으면 "없음")

## 개선 제안 (권장)
- [파일:라인] 내용.

## UX 표준 체크
- 공통 자산 소비 / 하드코딩 / 반응형 / 툴팁·오버레이·토스트 각각 OK 또는 위반 요약.

리포지토리 파일을 직접 열어 맥락을 확인해도 됩니다. 아래 <stdin> 의 diff 가 리뷰 대상입니다.`;

// ── Codex 실행 경로 탐색 ──────────────────────────────────────────────
function resolveCodex() {
  // 1) PATH 상의 codex
  const probe = process.platform === 'win32'
    ? spawnSync('cmd', ['/c', 'where', 'codex'], { encoding: 'utf8' })
    : spawnSync('which', ['codex'], { encoding: 'utf8' });
  if (probe.status === 0 && probe.stdout.trim()) {
    const lines = probe.stdout.split('\n').map((s) => s.trim()).filter(Boolean);
    if (process.platform === 'win32') {
      // 확장자 없는 셸 래퍼는 cmd 로 직접 실행 불가 → .cmd/.exe 우선
      const runnable = lines.find((l) => /\.(cmd|exe|bat)$/i.test(l));
      if (runnable) return runnable;
    } else {
      return lines[0];
    }
  }
  // 2) npm 전역 (Windows 기본 위치)
  const candidates = [
    process.env.APPDATA && path.join(process.env.APPDATA, 'npm', process.platform === 'win32' ? 'codex.cmd' : 'codex'),
    path.join(os.homedir(), 'AppData', 'Roaming', 'npm', 'codex.cmd'),
    '/usr/local/bin/codex',
    path.join(os.homedir(), '.npm-global', 'bin', 'codex'),
  ].filter(Boolean);
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return 'codex'; // 최후: PATH 에 있길 기대
}

const codexBin = resolveCodex();
const outFile = path.join(os.tmpdir(), `codex-review-${process.pid}.txt`);

const codexArgs = ['exec',
  '-C', ROOT,                 // 작업 루트 = 프로젝트
  '-s', 'read-only',          // 읽기전용 샌드박스 (파일 수정 안 함)
  '--skip-git-repo-check',
  '-o', outFile,              // 최종 메시지를 파일로
];
if (opts.model) codexArgs.push('-m', opts.model);
codexArgs.push(PROMPT);       // 프롬프트는 인자, diff 는 stdin 으로

console.error(`[codex-review] Codex 검수 시작 — 범위: ${scopeLabel}, 파일 ${changedFiles.length}개`);
console.error(`[codex-review] codex 실행: ${codexBin}`);

const child = spawn(codexBin, codexArgs, {
  cwd: ROOT,
  stdio: ['pipe', 'inherit', 'inherit'],
  shell: process.platform === 'win32', // .cmd 실행 위해 Windows 는 shell
});

child.on('error', (err) => {
  console.error('[codex-review] Codex 실행 실패:', err.message);
  console.error('  Codex CLI 가 설치돼 있는지 확인하세요: npm i -g @openai/codex, 그리고 codex login');
  process.exit(127);
});

// diff 를 stdin 으로 전달 (codex exec 가 <stdin> 블록으로 첨부)
child.stdin.write(diff);
child.stdin.end();

child.on('close', (code) => {
  // 파일로 저장된 최종 판정도 한 번 더 출력(스트림이 잘렸을 경우 대비)
  try {
    if (fs.existsSync(outFile)) {
      const last = fs.readFileSync(outFile, 'utf8');
      if (last.trim()) {
        console.error('\n===== Codex 최종 판정 =====');
        console.log(last.trim());
      }
      fs.unlinkSync(outFile);
    }
  } catch (_) {}
  process.exit(code == null ? 0 : code);
});
