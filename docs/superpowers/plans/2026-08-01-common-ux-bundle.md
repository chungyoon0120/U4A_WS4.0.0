# 공통 UX 번들 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 동료가 별창 팝업을 개발해 내 프로젝트로 이관하면 이질감 0으로 실행되도록, 내 공통 UX 자산·표준·별창 견본·AI 가드레일을 "내 경로 미러 오버레이 zip"으로 패키징한다.

**Architecture:** 내 레포에 (1) 번들 대상 목록 `manifest.txt`, (2) 별창 복사용 견본 `_win-popup-template/`, (3) 가드레일 `GUARDRAIL.md`/`SKILL.md`·`README.md`, (4) 결정적 패킹 스크립트 `pack-common-ux.ps1` 를 만든다. 스크립트가 manifest 를 읽어 현재 파일을 내 경로 그대로 수집 → `VERSION.md`(git SHA·변경요약) 스탬프 → UTF-8 zip 생성. 동료는 프로젝트 루트에서 풀어 사용.

**Tech Stack:** 순수 HTML5/CSS/JS(공통 자산), PowerShell(패킹), Electron/@electron/remote(견본 런타임 — 동료 공유), Git(SHA·diff).

## Global Constraints

- SSOT = 스펙 `docs/superpowers/specs/2026-08-01-common-ux-bundle.md`. 모든 결정은 그 §번호로 근거.
- 원본 우선·임의창작 금지: 견본은 기존 `OTRF4HelpPopup` 을 **정제**해 만든다(새 UX 창작 금지).
- 공통 자산(`theme/*`, `lib/*`)은 **수정 금지**. 번들은 그것들을 **복사만** 한다.
- 별창 견본 로드 스택 고정(스펙 §4): `tokens → shell → bootstrap-skin → FA`, theme CSS 중 `bootstrap-skin` 마지막. JS `theme-api → u4a-ui → frame/index`. Bootstrap(min/bridge)은 별창 미로드.
- 공통 자산 참조는 정규 상대경로만: 팝업 폴더 기준 `../../theme/...`, `../../../../lib/...`.
- 색은 `tokens.css` 의미 토큰만(하드코딩 hex 금지). 컴포넌트는 `U4AUI.*`/`.u4a-*` 소비.
- 한글 파일명 zip: UTF-8 보존.
- 커밋 메시지 제목 맨 앞 `[YYYY-MM-DD HH:MM]`.
- 언더바(`_`)로 시작하는 폴더/파일은 현행 소스 탐색 제외 대상(백업/견본/메타).

---

## File Structure (무엇을 만들고 무엇을 담나)

**신규 생성(내 레포):**
- `_common-ux-bundle/manifest.txt` — 번들에 담을 경로 목록(글롭 허용). 재수집 SSOT.
- `_common-ux-bundle/GUARDRAIL.md` — Codex 가드레일(구조 게이트·3층·용어표·결정규칙·제약·이관규칙).
- `_common-ux-bundle/SKILL.md` — Claude Code용 스킬. GUARDRAIL 과 **내용 쌍둥이**(형식만 다름).
- `_common-ux-bundle/README.md` — 배선·로드순서·`AGENTS.md` 1줄 추가 안내.
- `_common-ux-bundle/VERSION.md` — 패킹 시 자동 스탬프(git SHA·날짜·변경요약). 초기 자리표시.
- `pack-common-ux.ps1` — manifest 읽어 수집→VERSION 스탬프→UTF-8 zip(번들 미포함, 내 레포에만).
- `www/ws30/ws10_20/Popups/_win-popup-template/` — 별창 복사용 견본 6파일(아래 Task 2).

**번들에 담기지만 이미 존재(복사만):**
- `www/ws30/ws10_20/theme/{tokens,shell,bootstrap-bridge,bootstrap-skin}.css`, `{u4a-ui,theme-api}.js`, `themes/**`
- `www/lib/bootstrap/5.0.2/**`, `www/lib/fontawesome/7.2.0/**`
- `www/ws30/ws10_20/ux-gallery.html`
- `.analy/16_공통_화면UX_표준.md`, `.analy/15_공통_입력UX_가이드.md`
- `_win-popup-template/**`, `_common-ux-bundle/{GUARDRAIL,README,VERSION}.md`, `SKILL.md`

**패킹 시 경로 매핑:** `_common-ux-bundle/SKILL.md` → zip 안 `.claude/skills/common-ux/SKILL.md` (내 레포의 기존 common-ux 스킬과 충돌 회피). 나머지는 내 경로 그대로.

---

## Task 1: 번들 매니페스트 + 폴더 스캐폴드

**Files:**
- Create: `_common-ux-bundle/manifest.txt`
- Create: `_common-ux-bundle/VERSION.md` (자리표시)

**Interfaces:**
- Produces: `manifest.txt` 형식 = 한 줄에 한 항목. `SRC => DEST` (DEST 생략 시 SRC 그대로). `#` 주석. 글롭 `**` 허용. Task 5 패킹 스크립트가 소비.

- [ ] **Step 1: manifest.txt 작성**

```
# 공통 UX 번들 대상 목록 (SRC => DEST). DEST 생략 = SRC 경로 그대로 zip.
# --- 공통 컴포넌트/스타일/테마 ---
www/ws30/ws10_20/theme/tokens.css
www/ws30/ws10_20/theme/shell.css
www/ws30/ws10_20/theme/bootstrap-bridge.css
www/ws30/ws10_20/theme/bootstrap-skin.css
www/ws30/ws10_20/theme/u4a-ui.js
www/ws30/ws10_20/theme/theme-api.js
www/ws30/ws10_20/theme/themes/**
# --- 벤더 (전량 동봉) ---
www/lib/bootstrap/5.0.2/**
www/lib/fontawesome/7.2.0/**
# --- 별창 견본 ---
www/ws30/ws10_20/Popups/_win-popup-template/**
# --- 실물 참조 + 표준 문서 ---
www/ws30/ws10_20/ux-gallery.html
.analy/16_공통_화면UX_표준.md
.analy/15_공통_입력UX_가이드.md
# --- AI 가드레일 (SKILL 은 .claude 경로로 매핑) ---
_common-ux-bundle/SKILL.md => .claude/skills/common-ux/SKILL.md
_common-ux-bundle/GUARDRAIL.md
_common-ux-bundle/README.md
_common-ux-bundle/VERSION.md
```

- [ ] **Step 2: VERSION.md 자리표시 작성**

```
# 공통 UX 번들 버전
- 원본 커밋: (패킹 시 자동)
- 패킹 일시: (패킹 시 자동)
- 직전 대비 변경: (패킹 시 자동)
```

- [ ] **Step 3: 매니페스트 SRC 존재 검증**

Run (Bash):
```bash
cd <repo> && while read -r line; do [ -z "$line" ] && continue; case "$line" in \#*) continue;; esac; src="${line%% =>*}"; src="${src%%\*\*}"; ls -d "$src"* >/dev/null 2>&1 || echo "MISSING: $line"; done < _common-ux-bundle/manifest.txt
```
Expected: `MISSING` 출력 0줄 (단 `_win-popup-template` 은 Task 2 이후 존재 → 이 단계선 MISSING 정상, Task 2 후 재검증).

- [ ] **Step 4: Commit**

```bash
git add _common-ux-bundle/manifest.txt _common-ux-bundle/VERSION.md
git commit -m "[<date>] 공통 UX 번들 매니페스트+버전 스캐폴드"
```

---

## Task 2: 별창 견본 `_win-popup-template` (OTRF4 정제)

**Files:**
- Create: `www/ws30/ws10_20/Popups/_win-popup-template/frame.html`
- Create: `www/ws30/ws10_20/Popups/_win-popup-template/frame.css`
- Create: `www/ws30/ws10_20/Popups/_win-popup-template/frame.js`
- Create: `www/ws30/ws10_20/Popups/_win-popup-template/index.html`
- Create: `www/ws30/ws10_20/Popups/_win-popup-template/index.css`
- Create: `www/ws30/ws10_20/Popups/_win-popup-template/index.js`
- Base(참조·복사원본): `www/ws30/ws10_20/Popups/OTRF4HelpPopup/*`

**Interfaces:**
- Produces: 복사용 별창 뼈대. `frame.html`=창 크롬(`.u4a-titlebar`+winbtn+`#ws_frame` iframe+`.u4a-busy`), `frame.js`=titlebar/busy/theme/IPC 스켈레톤, `index.*`=빈 콘텐츠(iframe 로드). 공통 참조 = 정규 상대경로. 스펙 §7.

- [ ] **Step 1: OTRF4 6파일을 견본 폴더로 복사**

```bash
cd <repo>
mkdir -p www/ws30/ws10_20/Popups/_win-popup-template
cp www/ws30/ws10_20/Popups/OTRF4HelpPopup/{frame.html,frame.css,frame.js,index.html,index.css,index.js} www/ws30/ws10_20/Popups/_win-popup-template/
```

- [ ] **Step 2: frame.html 정제 (KEEP/STRIP)**

KEEP(그대로): 공통 자산 `<link>`/`<script>`(§4 스택), `<header class="u4a-titlebar">` + 로고/제목/min/max/close 버튼, `#ws_frame` iframe, `.u4a-busy` 오버레이 블록, `theme-api`·`u4a-ui`·`frame.js` 스크립트.
STRIP/치환:
- OTR 전용 id 접두 `otr*` → 중립 `tpl*`(예: `otrTitlebar`→`tplTitlebar`, `otrTitle`→`tplTitle`, `otrWinMin/Max/Close`→`tplWinMin/Max/Close`, `otrContent`→`tplContent`, `otrLogo`→`tplLogo`).
- 주석의 "OTR Manager/검색폼/결과 테이블" 문구 → "별창 팝업 견본(복사해 사용) — 본문은 index.html".
- 제목 텍스트 하드코딩 있으면 빈값(제목은 frame.js 가 파라미터로 주입).

- [ ] **Step 3: frame.js 정제 (KEEP/STRIP)**

KEEP(그대로): 상단 런타임 취득 블록(`@electron/remote`·`pathInfo`·`WSUTIL`·`CURRWIN`·`oQueryParams`·`USERINFO`/`LANGU`/`SYSID`·`WSMSG`), `oAPP` 골격, `oAPP.setBusyLoading`/`oAPP.fn.setBusy`(closable:false 유지), 타이틀바 초기화(로고/제목/min·max·close·드래그), 테마 취득/적용, 창 닫기(`fnClose`: setClosable→close), id 셀렉터를 Step2 의 `tpl*` 로 일치.
STRIP: OTR 전용 IPC 채널 계약(`if_OTRF4HelpPopup`/`if-otr-callback`/`if-send-action-<BROWSKEY>`) 및 검색/콜백 핸들러 → **제거하고 자리표시 주석**:
```js
// TODO(견본): 이 팝업의 부모↔자식 IPC 채널을 여기에 정의(스펙 §2.11 별창 IPC 계약).
//   부모: 판정 후 RETCD/MSGTY/RTMSG 회신. 자식: 응답 수신 후 결과 표시(던지자마자 완료토스트 금지).
```
- iframe(`#ws_frame` → `tplContent` 내부) src 주입부는 KEEP 하되 대상 = `index.html`(데이터 도착 대기 없이 바로 주입 가능하게 단순화). 하드 종속(OTR 데이터 선행) 제거.

- [ ] **Step 4: index.html/index.css/index.js 정제**

- `index.html`: 공통 자산 `<link>`/`<script>`(§4) KEEP, 본문을 **빈 콘텐츠 영역**으로:
```html
<main id="tplBody" class="tpl-body">
  <!-- TODO(견본): 여기에 팝업 UX 를 U4AUI.* / .u4a-* 로 구성. 착수 전 구조 승인 게이트(스펙 §6.0). -->
</main>
```
- `index.css`: OTR 검색폼/테이블 전용 규칙 제거, 컨테이너 여백 등 최소만 남김(색 하드코딩 금지, 토큰만).
- `index.js`: OTR 검색/렌더 로직 제거. 골격만:
```js
// 별창 팝업 견본 본문. 공통 컴포넌트로 UX 구성(U4AUI.*). 색=tokens.css 토큰만.
(function () {
  "use strict";
  // TODO(견본): U4AUI.createField/createTree/makeDataTable 등으로 화면 구성.
})();
```

- [ ] **Step 5: 문법 검증(JS)**

Run:
```bash
cd <repo> && node --check www/ws30/ws10_20/Popups/_win-popup-template/frame.js && node --check www/ws30/ws10_20/Popups/_win-popup-template/index.js && echo OK
```
Expected: `OK` (구문 오류 없음). ※ require/electron 런타임 미해결은 정상(문법만 검사).

- [ ] **Step 6: 잔여 OTR 참조·경로 검증**

Run:
```bash
cd <repo> && grep -rn "otr\|OTR\|if_OTRF4HelpPopup\|if-otr-callback" www/ws30/ws10_20/Popups/_win-popup-template/ ; echo "--- 상대경로 ---" ; grep -rn "\.\./\.\./theme\|\.\./\.\./\.\./\.\./lib" www/ws30/ws10_20/Popups/_win-popup-template/*.html
```
Expected: 첫 grep 0줄(OTR 잔재 없음). 둘째 grep 에 `../../theme/...`·`../../../../lib/...` 존재.

- [ ] **Step 7: 로드 스택 순서 검증(§4)**

Run:
```bash
cd <repo> && grep -n "tokens.css\|shell.css\|bootstrap-skin.css\|all.min.css\|theme-api.js\|u4a-ui.js" www/ws30/ws10_20/Popups/_win-popup-template/frame.html
```
Expected: 순서 = `tokens → shell → bootstrap-skin → all.min(FA)` … `theme-api → u4a-ui`. `bootstrap.min.css`/`bootstrap-bridge.css` 없음.

- [ ] **Step 8: Commit**

```bash
git add www/ws30/ws10_20/Popups/_win-popup-template
git commit -m "[<date>] 별창 팝업 견본 _win-popup-template (OTRF4 정제)"
```

---

## Task 3: GUARDRAIL.md + SKILL.md (쌍둥이)

**Files:**
- Create: `_common-ux-bundle/GUARDRAIL.md`
- Create: `_common-ux-bundle/SKILL.md`

**Interfaces:**
- Produces: 동료 AI 규칙. 본문 동일, SKILL.md 만 상단에 Claude 스킬 frontmatter. 스펙 §6 전체 반영.

- [ ] **Step 1: GUARDRAIL.md 작성 (스펙 §6 그대로)**

포함 절(각 스펙 §번호 주석):
1. **착수 전 구조 승인 게이트(§6.0)** — 팝업 이름 확정 → UX 구조 스케치(영역/배치/쓰는 부품) → 소유자 확인 → 승인 후 구현.
2. **이관 호환 규칙(§6.0)** — `Popups/<이름>/` 폴더, `_win-popup-template` 복사, 공통 자산 참조만(수정 금지), 별창 표준 §2.6/2.11/9.5.
3. **3층 안전 구조(§6.1)** — 의도 기반 gate / 카탈로그 자가검색(`ux-gallery.html`·`u4a-ui.js` grep) / 애매하면 물어라.
4. **용어 번역표(§6.2)** — 표 그대로(별창=`_win-popup-template`+§2.6/2.11/9.5, makeDataTable, makeColumnTree, createField, createTree, createSelect, wireSplitter, confirm, createPanel, footer*, .u4a-toast).
5. **옵션 결정 규칙(§6.3)** — `<table>` 금지·makeDataTable(가상 기본 ON)·트리는 생성시점 결정·규모 불명 시 물어라.
6. **알려진 제약(§6.4)** — 트리 가상스크롤 동적 전환 불가.
7. **배선/로드 스택 요약(§4)** + 색=토큰만·공통 수정 금지.

- [ ] **Step 2: SKILL.md 작성 (frontmatter + 동일 본문)**

상단:
```markdown
---
name: common-ux
description: 별창 팝업/화면을 만들 때 공통 UX 자산(theme/u4a-ui.js·.u4a-*)과 표준(.analy/16·15)을 소비하도록 강제. 새로 그리기 전에 ux-gallery.html·16 을 먼저 확인.
---
```
아래 본문 = GUARDRAIL.md 와 동일(복붙).

- [ ] **Step 3: 쌍둥이 일치 검증**

Run:
```bash
cd <repo> && diff <(sed '1,4d' _common-ux-bundle/SKILL.md) _common-ux-bundle/GUARDRAIL.md && echo "TWINS OK"
```
Expected: `TWINS OK`(frontmatter 4줄 제외 본문 동일). 불일치 시 본문 맞춤.

- [ ] **Step 4: 참조 정합 검증(스펙 §번호·API명)**

Run:
```bash
cd <repo> && grep -n "makeDataTable\|makeColumnTree\|createField\|createTree\|createSelect\|wireSplitter\|_win-popup-template\|§2.6\|§2.11\|§9.5" _common-ux-bundle/GUARDRAIL.md
```
Expected: 위 API명·견본명·별창 §번호 모두 등장(오탈자 없음, u4a-ui.js export 와 일치).

- [ ] **Step 5: Commit**

```bash
git add _common-ux-bundle/GUARDRAIL.md _common-ux-bundle/SKILL.md
git commit -m "[<date>] 공통 UX 가드레일 GUARDRAIL+SKILL 쌍둥이"
```

---

## Task 4: README.md (배선·인계 안내)

**Files:**
- Create: `_common-ux-bundle/README.md`

- [ ] **Step 1: README.md 작성**

내용(스펙 §3·§4·§5):
- **무엇인가**: 내 프로젝트 공통 UX 번들. 프로젝트 루트에서 압축 해제(내 경로 미러 오버레이).
- **압축 해제**: `<repo-root>` 에서 풀면 `www/...`, `.analy/...`, `.claude/...`, `_common-ux-bundle/...` 안착. `AGENTS.md`는 안 건드림.
- **AGENTS.md 1줄 추가(§5)**: 기존 `AGENTS.md` 에 `"화면/UI·별창 팝업 작업 시 _common-ux-bundle/GUARDRAIL.md 규칙을 따를 것."` (없으면 새로 생성).
- **별창 팝업 시작법**: `Popups/_win-popup-template` 복사 → `Popups/<이름>/` 로 이름 변경 → 착수 전 구조 승인(§6.0) → `index.*` 채움. frame 은 손대지 않음.
- **로드 스택(§4)**: 별창 정규 순서 + 불변식(skin 마지막). 색=토큰만.
- **런타임 전제(§2)**: `@electron/remote`·pathInfo·WSUTIL·부모 USERINFO·메시지백엔드 필요(동료 공유 확인됨).
- **업데이트(§8)**: 새 zip 받으면 다시 풀어 덮어씀(자기 팝업 폴더·AGENTS.md 제외). `VERSION.md` diff 로 변경 확인.

- [ ] **Step 2: Commit**

```bash
git add _common-ux-bundle/README.md
git commit -m "[<date>] 공통 UX 번들 README(배선·인계 안내)"
```

---

## Task 5: 패킹 스크립트 `pack-common-ux.ps1` + 첫 패킹

**Files:**
- Create: `pack-common-ux.ps1`
- Modify: `_common-ux-bundle/VERSION.md` (스크립트가 스탬프)

**Interfaces:**
- Consumes: `_common-ux-bundle/manifest.txt`(Task 1). Git.
- Produces: `_common-ux-bundle/dist/common-ux-bundle_<date>.zip`(내 레포, 번들엔 미포함), 스탬프된 `VERSION.md`.

- [ ] **Step 1: pack-common-ux.ps1 작성**

```powershell
# 공통 UX 번들 패킹 — manifest 읽어 현재 파일 수집 → VERSION 스탬프 → UTF-8 zip
$ErrorActionPreference = "Stop"
$Root     = Split-Path -Parent $MyInvocation.MyCommand.Path
$Manifest = Join-Path $Root "_common-ux-bundle/manifest.txt"
$Stage    = Join-Path $env:TEMP ("cuxb_" + (Get-Date -Format yyyyMMdd_HHmmss))
$DistDir  = Join-Path $Root "_common-ux-bundle/dist"
New-Item -ItemType Directory -Force -Path $Stage, $DistDir | Out-Null

# VERSION 스탬프
$sha     = (git -C $Root rev-parse HEAD).Trim()
$prevSha = (Select-String -Path (Join-Path $Root "_common-ux-bundle/VERSION.md") -Pattern 'PREV_SHA:\s*(\S+)' | Select-Object -First 1).Matches.Groups[1].Value
$now     = Get-Date -Format "yyyy-MM-dd HH:mm"
$changed = if ($prevSha) { (git -C $Root diff --stat "$prevSha" "$sha") -join "`n" } else { "(최초 패킹)" }
@"
# 공통 UX 번들 버전
- 원본 커밋: $sha
- 패킹 일시: $now
- 직전($prevSha) 대비 변경:
$changed

<!-- PREV_SHA: $sha -->
"@ | Out-File -FilePath (Join-Path $Root "_common-ux-bundle/VERSION.md") -Encoding utf8

# manifest 순회 → staging 복사(경로 보존, SRC => DEST 매핑 지원, ** 글롭)
Get-Content $Manifest | ForEach-Object {
  $line = $_.Trim()
  if (-not $line -or $line.StartsWith("#")) { return }
  $parts = $line -split '\s*=>\s*', 2
  $src = $parts[0].Trim(); $dest = if ($parts.Count -eq 2) { $parts[1].Trim() } else { $src }
  $glob = $src.EndsWith("/**")
  $srcBase = if ($glob) { $src.Substring(0, $src.Length-3) } else { $src }
  $items = if ($glob) { Get-ChildItem -Recurse -File (Join-Path $Root $srcBase) } else { Get-Item (Join-Path $Root $srcBase) }
  foreach ($it in $items) {
    $rel = if ($glob) { $it.FullName.Substring((Join-Path $Root $srcBase).Length).TrimStart('\','/') ; $target = Join-Path (Join-Path $Stage $dest) $rel } else { $target = Join-Path $Stage $dest }
    New-Item -ItemType Directory -Force -Path (Split-Path $target) | Out-Null
    Copy-Item $it.FullName $target -Force
  }
}

# UTF-8 zip
$zip = Join-Path $DistDir ("common-ux-bundle_" + (Get-Date -Format yyyyMMdd) + ".zip")
if (Test-Path $zip) { Remove-Item $zip -Force }
Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::CreateFromDirectory($Stage, $zip, [System.IO.Compression.CompressionLevel]::Optimal, $false, [System.Text.UTF8Encoding]::new($false))
Remove-Item -Recurse -Force $Stage
Write-Host "PACKED: $zip"
```

- [ ] **Step 2: dist 를 git 무시(선택)**

`.gitignore` 에 `_common-ux-bundle/dist/` 추가(빌드 산출물). 없으면 생성.

- [ ] **Step 3: 실행 → zip 생성**

Run (PowerShell):
```powershell
cd <repo>; ./pack-common-ux.ps1
```
Expected: `PACKED: ...common-ux-bundle_<yyyymmdd>.zip`. `VERSION.md` 에 SHA·일시 채워짐.

- [ ] **Step 4: zip 내용 검증(경로 매핑·한글명)**

Run (PowerShell):
```powershell
Add-Type -AssemblyName System.IO.Compression.FileSystem
$z=[System.IO.Compression.ZipFile]::OpenRead((Get-ChildItem <repo>/_common-ux-bundle/dist/*.zip | Select -Last 1).FullName)
$z.Entries.FullName | Sort-Object; $z.Dispose()
```
Expected: `www/ws30/ws10_20/theme/...`, `www/lib/...`, `www/ws30/ws10_20/Popups/_win-popup-template/...`, `.analy/16_...md`(한글 정상), `.claude/skills/common-ux/SKILL.md`(매핑됨), `_common-ux-bundle/{GUARDRAIL,README,VERSION}.md`. 루트 `AGENTS.md` **없음**.

- [ ] **Step 5: Commit**

```bash
git add pack-common-ux.ps1 _common-ux-bundle/VERSION.md .gitignore
git commit -m "[<date>] 공통 UX 번들 패킹 스크립트 + 첫 VERSION 스탬프"
```

---

## Task 6: 이관 호환 E2E 검증

**Files:** (검증 전용 — 신규 소스 없음)

**Interfaces:**
- Consumes: Task 5 의 zip.

- [ ] **Step 1: 깨끗한 폴더에 압축 해제**

Run (PowerShell):
```powershell
$t = Join-Path $env:TEMP "cuxb_verify"; Remove-Item -Recurse -Force $t -ErrorAction SilentlyContinue; New-Item -ItemType Directory $t | Out-Null
Expand-Archive (Get-ChildItem <repo>/_common-ux-bundle/dist/*.zip | Select -Last 1).FullName -DestinationPath $t
Get-ChildItem -Recurse $t | Select-Object -First 40 FullName
```
Expected: 내 경로 골격이 그대로 재현. 한글 파일명 무손상.

- [ ] **Step 2: 견본 상대경로가 해제 트리에서 실제 해결되는지 검증**

Run (Bash):
```bash
T="$TEMP/cuxb_verify"  # 위 경로
cd "$T/www/ws30/ws10_20/Popups/_win-popup-template" && \
for f in ../../theme/tokens.css ../../theme/shell.css ../../theme/bootstrap-skin.css ../../theme/u4a-ui.js ../../theme/theme-api.js ../../../../lib/fontawesome/7.2.0/css/all.min.css; do [ -f "$f" ] && echo "OK $f" || echo "MISSING $f"; done
```
Expected: 전부 `OK`(견본이 참조하는 공통 자산이 해제 트리에서 실경로로 해결됨 = 이관 호환).

- [ ] **Step 3: 견본 JS 문법 재검증(해제본)**

Run:
```bash
cd "$T" && node --check www/ws30/ws10_20/Popups/_win-popup-template/frame.js && node --check www/ws30/ws10_20/Popups/_win-popup-template/index.js && echo OK
```
Expected: `OK`.

- [ ] **Step 4: 표준/가드레일 동봉 확인**

Run:
```bash
cd "$T" && ls .analy/16_공통_화면UX_표준.md .analy/15_공통_입력UX_가이드.md www/ws30/ws10_20/ux-gallery.html _common-ux-bundle/GUARDRAIL.md .claude/skills/common-ux/SKILL.md && echo ALL-PRESENT
```
Expected: `ALL-PRESENT`.

- [ ] **Step 5: 수용 기준 대조(스펙 §10) 체크 기록**

스펙 §10 체크리스트 7항목을 이 검증 결과로 채운다(통과/실패 표). 실패 시 해당 Task 로 복귀.

- [ ] **Step 6: Commit(검증 기록)**

문서/기록 변경이 있으면 커밋:
```bash
git commit -am "[<date>] 공통 UX 번들 이관 E2E 검증 통과 기록"
```

---

## Self-Review 결과 (계획↔스펙 대조)

- **스펙 커버리지**: §2 체크리스트(인계 게이트=Task6 Step5 기록)·§3 포함/제외(Task1 manifest)·§4 로드스택(Task2 Step7)·§5 AGENTS 회피(Task4·zip 검증 Task5 Step4)·§6 가드레일(Task3)·§6.0 구조게이트(Task3 Step1-1)·§7 견본(Task2)·§8 업데이트(Task5 스크립트)·§10 수용기준(Task6). 누락 0.
- **플레이스홀더**: 견본의 `TODO(견본)` 은 의도된 복사용 자리표시(실코드 아님) — 규칙 위반 아님. 그 외 TBD 없음.
- **타입/이름 일관**: `_win-popup-template`, `manifest.txt`(SRC=>DEST), `pack-common-ux.ps1`, `PREV_SHA`, id 접두 `tpl*` — 전 Task 동일 표기.
- **미결(스펙 §11)**: 견본 베이스=OTRF4 확정(본 계획). Q1/Q5 등 동료 답변은 최종 패킹/인계 직전 게이트(재패킹 1회로 반영).
