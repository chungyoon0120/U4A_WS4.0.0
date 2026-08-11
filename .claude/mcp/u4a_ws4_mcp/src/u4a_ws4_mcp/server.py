#!/usr/bin/env python3
"""U4A WS4.0 .analy 표준 문서 서빙 MCP 서버.

이 서버는 프로젝트의 UX·화면·UI5→HTML5 컨버전 표준의 단일 출처(SSOT)인
`.analy/` 문서 세트를 AI에게 온디맨드로 제공한다. 문서 내용은 호출 시점에
디스크에서 직접 읽으므로, 문서를 수정해도 세션 재시작 없이 항상 최신이 반영된다.

문서 위치는 환경변수 `U4A_WS4_ANALY_DIR` 로 덮어쓸 수 있으며,
미설정 시 아래 DEFAULT_ANALY_DIR 를 사용한다.
"""

from __future__ import annotations

import os
import re
from pathlib import Path
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field
from mcp.server.fastmcp import FastMCP

# --------------------------------------------------------------------------- #
# 상수
# --------------------------------------------------------------------------- #

# 환경변수 미설정 시 기본 .analy 위치
DEFAULT_ANALY_DIR = (
    r"C:\Users\socce\Documents\Github\CHUNGYOON0120\U4A_WS4.0.0\.analy"
)

# 작업 시작 전 반드시 읽어야 하는 문서(번호) — CLAUDE.md / 13번 가이드 기준
MUST_READ_FIRST = ["00", "13", "16"]

# 토픽 → 문서번호 라우팅 키워드. 작업 주제로 어떤 문서를 봐야 하는지 안내한다.
# 값: 해당 문서를 가리키는 한/영 키워드 목록.
TOPIC_KEYWORDS: dict[str, list[str]] = {
    "00": ["개요", "인덱스", "전략", "overview", "index", "strategy"],
    "01": ["부팅", "boot", "아키텍처", "architecture"],
    "02": [
        "로그인", "login", "서버리스트", "serverlist", "server list",
        "트리", "tree", "연결", "connect",
    ],
    "03": ["메인프레임", "ws10", "ws20", "mainframe"],
    "04": ["ws30", "usp", "코드에디터", "editor", "monaco"],
    "05": ["디자인영역", "design area", "design", "디자인"],
    "06": ["팝업", "popup", "모달", "modal", "dialog", "다이얼로그"],
    "07": ["유틸", "util", "worker", "워커", "ipc"],
    "08": ["라이브러리", "library", "플로팅메뉴", "floating", "도움말", "help", "리소스", "resource"],
    "09": ["환경구축", "런북", "runbook", "setup", "환경"],
    "10": ["이주", "마이그레이션", "manifest", "매니페스트", "migration"],
    "11": ["플레이북", "playbook", "처음시작", "getting started", "시작"],
    "12": [
        "테마", "theme", "색", "color", "토큰", "token", "tokens.css",
        "반응형", "responsive", "color-mix", "hex",
        "css", "그림자", "shadow", "box-shadow", "elevation", "cascade",
        "shell.css", "bootstrap-skin", "skin", "ssot", "로드 순서",
    ],
    "13": ["작업지시", "가이드", "ai", "지시", "guardrail", "가드레일", "instruction"],
    "14": [
        "부트스트랩", "bootstrap", "ui5 제거", "ui5부트스트랩", "인트로", "intro",
        "preload", "프리로드",
    ],
    "15": [
        "입력", "input", "입력칸", "폼", "form", "field", "clear", "필드",
    ],
    "16": [
        "공통", "표준", "ux", "화면ux", "모달헤더", "헤더", "푸터", "footer",
        "드래그", "drag", "리사이즈", "resize", "createtree", "공통표준",
    ],
}

# 서버 자기소개/사용지침. MCP 연결 시 AI에게 전달되어, "언제 이 도구를 부를지"를
# 알려주는 트리거 역할을 한다. 표준 '내용'은 .analy 문서(라이브 서빙)에 있고, 여기에는
# 변하지 않는 '진입 규칙'만 둔다. → CLAUDE.md 를 건드리지 않아도 표준 위임이 성립한다.
SERVER_INSTRUCTIONS = """\
이 서버는 U4A WS4.0 프로젝트의 UX·화면·UI5→HTML5 컨버전 표준(.analy 문서 세트)의
단일 출처(SSOT)를 제공한다.

언제 호출하나 (필수):
화면·UI·레이아웃·모달/팝업·트리·폼·입력칸·그리드·스플릿바 등 화면 요소를 만들거나
U4A WS → HTML5 로 변환하는 작업을 시작하기 전에, **먼저 `analy_index` 를 호출**해 어떤
문서를 봐야 하는지 파악하라. 이어서 `analy_get_doc`(특정 문서/절) 또는 `analy_search`
(키워드)로 관련 표준을 읽고 그 기준대로 작업한다.

작업 원칙:
- 모든 설계 결정은 이 문서들의 절 번호로 근거를 댄다. 문서에 없으면 추측하지 말고 사용자에게 묻는다.
- 모양/동작은 화면마다 새로 만들지 말고 공통 자산(shell.css, bootstrap-skin.css, u4a-ui.js, tokens.css)을 소비한다.
- 색은 의미 토큰만 사용(하드코딩 hex 금지), 문구는 메시지 키 사용, 고정 px 폭 금지(반응형).
- 이름이 '_' 로 시작하는 폴더/파일은 백업·구버전·실험 코드이므로 현행으로 인용하지 않는다.

★ CSS 수정 전 필수 (cascade 확인 — 한 파일만 보면 삽질):
공통 컴포넌트(.u4a-dialog/.u4a-toast/.u4a-input/.u4a-combo/.u4a-btn 등)는 shell.css(구조/기본)와
bootstrap-skin.css(색·그림자·테두리) 두 곳에 정의되고, **bootstrap-skin 이 나중에 로드돼 같은
셀렉터를 override** 한다. 따라서 색·box-shadow·border 를 shell.css 에서만 고치면 무효(화면 변화 0).
- 속성을 바꾸기 전, 그 셀렉터·속성을 theme/*.css **전체에서 grep** 해 정의된 모든 곳과 로드 순서를
  확인하고, 실제 먹는 값(SSOT=보통 bootstrap-skin)에서 고친다. 렌더 변화가 0 이면 "더 늦게 로드되는
  같은 셀렉터"부터 의심한다.
- --sl-elev(메뉴/콤보/툴팁/busy 공통)·--popover-shadow(팝오버 전반) 같은 공유 토큰을 직접 키우면
  전체에 영향 → 특정 컴포넌트만 바꿀 땐 그 셀렉터의 속성을 직접 지정한다.
- 외부 CSS 파일 변경은 Electron 캐시로 미반영될 수 있다 → 강제 새로고침(Ctrl+Shift+R)/앱 재시작 필요.
- 근거·세부는 analy_get_doc(ref='12', section='6.1') (산출물 트리 + CSS cascade 주의).
"""

mcp = FastMCP("u4a_ws4_mcp", instructions=SERVER_INSTRUCTIONS)

# --------------------------------------------------------------------------- #
# 내부 헬퍼
# --------------------------------------------------------------------------- #


def _analy_dir() -> Path:
    """현재 .analy 디렉터리 경로를 해석한다(다단계 폴백 — 다른 PC 이식성).

    우선순위:
      1) 환경변수 U4A_WS4_ANALY_DIR 가 가리키는 경로(존재할 때)
      2) 현재 작업 디렉터리의 `.analy` (Claude Code 가 프로젝트 루트에서 서버를
         띄우는 경우 — 환경변수 없이도 자동 인식)
      3) DEFAULT_ANALY_DIR (이 PC 기본값)
    셋 다 없으면, 안내 메시지용으로 env(설정 시) 또는 기본값 경로를 그대로 반환.
    → 환경변수가 비어 있거나 다른 PC 라 경로가 어긋나도 2)/3)로 자가복구된다.
    """
    env = os.environ.get("U4A_WS4_ANALY_DIR")
    candidates: list[Path] = []
    if env:
        candidates.append(Path(env))
    candidates.append(Path.cwd() / ".analy")
    candidates.append(Path(DEFAULT_ANALY_DIR))
    for c in candidates:
        if c.is_dir():
            return c
    return Path(env) if env else Path(DEFAULT_ANALY_DIR)


def _iter_doc_paths() -> list[Path]:
    """.analy 안의 *.md 문서 경로 목록(정렬). '_' 로 시작하는 항목은 제외.

    CLAUDE.md '소스 탐색 규칙' 과 동일하게, 이름이 '_' 로 시작하는
    백업/구버전/실험 파일은 현행 산출물이 아니므로 목록에서 뺀다.
    """
    root = _analy_dir()
    if not root.is_dir():
        return []
    paths = [
        p
        for p in root.glob("*.md")
        if p.is_file() and not p.name.startswith("_")
    ]
    return sorted(paths, key=lambda p: p.name.lower())


def _doc_number(path: Path) -> Optional[str]:
    """파일명 앞쪽 숫자 접두어(예: '16')를 반환. 없으면 None."""
    m = re.match(r"(\d+)", path.name)
    return m.group(1) if m else None


def _doc_title(path: Path) -> str:
    """문서의 첫 번째 H1(`# ...`)을 제목으로 반환. 없으면 파일 stem."""
    try:
        with path.open("r", encoding="utf-8") as f:
            for _ in range(40):  # 앞부분만 살펴봄
                line = f.readline()
                if not line:
                    break
                s = line.strip()
                if s.startswith("# "):
                    return s[2:].strip()
    except OSError:
        pass
    return path.stem


def _resolve_doc(ref: str) -> Optional[Path]:
    """문서 참조(번호/파일명/부분일치)를 실제 경로로 해석한다."""
    ref = ref.strip()
    paths = _iter_doc_paths()
    if not paths:
        return None

    # 1) 숫자 번호로 정확 매칭 (예: "16", "6", "06")
    if ref.lstrip("0").isdigit() or ref.isdigit():
        want = ref.lstrip("0") or "0"
        for p in paths:
            num = _doc_number(p)
            if num is not None and (num.lstrip("0") or "0") == want:
                return p

    # 2) 파일명 정확 매칭
    for p in paths:
        if p.name == ref:
            return p

    # 3) 파일명/제목 부분 일치(대소문자 무시)
    low = ref.lower()
    for p in paths:
        if low in p.name.lower() or low in _doc_title(p).lower():
            return p
    return None


_HEADING_RE = re.compile(r"^(#{1,6})\s+(.*\S)\s*$")


def _enclosing_heading(lines: list[str], idx: int) -> str:
    """idx 라인을 포함하는 가장 가까운 상위 제목 텍스트를 반환."""
    for i in range(idx, -1, -1):
        m = _HEADING_RE.match(lines[i])
        if m:
            return m.group(2).strip()
    return ""


def _extract_section(text: str, heading_query: str) -> Optional[str]:
    """heading_query 와 일치하는 제목 절을 다음 동급 이상 제목 전까지 반환."""
    lines = text.splitlines()
    q = heading_query.strip().lower()
    start = None
    start_level = 0
    for i, line in enumerate(lines):
        m = _HEADING_RE.match(line)
        if m and q in m.group(2).strip().lower():
            start = i
            start_level = len(m.group(1))
            break
    if start is None:
        return None
    end = len(lines)
    for j in range(start + 1, len(lines)):
        m = _HEADING_RE.match(lines[j])
        if m and len(m.group(1)) <= start_level:
            end = j
            break
    return "\n".join(lines[start:end]).strip()


# --------------------------------------------------------------------------- #
# 입력 모델
# --------------------------------------------------------------------------- #


class IndexInput(BaseModel):
    """analy_index 입력(없음)."""

    model_config = ConfigDict(extra="forbid")


class GetDocInput(BaseModel):
    """analy_get_doc 입력."""

    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    ref: str = Field(
        ...,
        description="문서 참조: 번호('16','06','6'), 파일명('16_공통_화면UX_표준.md'), "
        "또는 제목/파일명 부분 문자열('테마','login')",
        min_length=1,
        max_length=200,
    )
    section: Optional[str] = Field(
        default=None,
        description="특정 절만 받고 싶을 때 제목 일부(예: '6.6', '리사이즈', "
        "'헤더'). 미지정 시 문서 전체 반환",
        max_length=200,
    )
    max_chars: Optional[int] = Field(
        default=None,
        description="반환 길이 상한(토큰 절약용). 초과 시 잘라내고 안내 문구 추가",
        ge=200,
        le=200000,
    )


class SearchInput(BaseModel):
    """analy_search 입력."""

    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    query: str = Field(
        ...,
        description="전체 문서에서 찾을 키워드/문구(대소문자 무시). "
        "예: 'color-mix', '48px', '모달 헤더', 'createTree'",
        min_length=2,
        max_length=200,
    )
    limit: Optional[int] = Field(
        default=20,
        description="반환할 최대 매치 수",
        ge=1,
        le=100,
    )


# --------------------------------------------------------------------------- #
# 도구
# --------------------------------------------------------------------------- #


@mcp.tool(
    name="analy_index",
    annotations={
        "title": "U4A WS4.0 표준 문서 인덱스",
        "readOnlyHint": True,
        "destructiveHint": False,
        "idempotentHint": True,
        "openWorldHint": False,
    },
)
async def analy_index(params: IndexInput) -> str:
    """U4A WS4.0 의 UX·화면·UI5→HTML5 컨버전 표준(.analy 문서 세트) 카탈로그를 반환한다.

    화면·UI·레이아웃·모달/팝업·트리·폼·입력칸·그리드 등 화면 요소를 만들거나
    U4A WS → HTML5 로 변환하는 작업을 시작하기 전에 **가장 먼저 이 도구를 호출**해
    어떤 문서를 봐야 하는지 파악하라. 표준은 이 문서 세트가 단일 출처(SSOT)다.

    Args:
        params (IndexInput): 입력 없음.

    Returns:
        str: 마크다운. 다음을 포함한다.
            - 작업 전 필수 우선 읽기 문서(00/13/16)
            - 전체 문서 목록(번호 · 제목 · 파일명 · 라우팅 키워드)
            - 다음 단계 안내(analy_get_doc / analy_search 사용법)
            - 디렉터리가 없거나 비어 있으면 그 사실을 안내
    """
    root = _analy_dir()
    paths = _iter_doc_paths()
    if not paths:
        return (
            f"표준 문서를 찾을 수 없습니다.\n"
            f"- 조회 경로: {root}\n"
            f"- 환경변수 U4A_WS4_ANALY_DIR 로 .analy 디렉터리를 지정하거나, "
            f"해당 경로에 *.md 문서가 있는지 확인하세요."
        )

    lines: list[str] = []
    lines.append("# U4A WS4.0 표준 문서(.analy) 인덱스")
    lines.append("")
    lines.append(f"- 출처 디렉터리: `{root}`")
    lines.append(
        "- 표준의 단일 출처(SSOT). 화면/UI/변환 작업의 모든 설계 결정은 "
        "이 문서들의 절 번호로 근거를 댄다. 문서에 없으면 추측하지 말고 사용자에게 묻는다."
    )
    lines.append("")

    # 필수 우선 읽기
    lines.append("## 작업 전 반드시 먼저 읽기")
    for num in MUST_READ_FIRST:
        p = _resolve_doc(num)
        if p:
            lines.append(f"- **{num}** {_doc_title(p)}  (`{p.name}`)")
    lines.append("")

    # 전체 목록
    lines.append("## 전체 문서 목록")
    lines.append("")
    lines.append("| 번호 | 제목 | 파일 | 라우팅 키워드 |")
    lines.append("|---|---|---|---|")
    for p in paths:
        num = _doc_number(p) or "-"
        title = _doc_title(p)
        kws = ", ".join(TOPIC_KEYWORDS.get(num or "", [])[:6])
        lines.append(f"| {num} | {title} | `{p.name}` | {kws} |")
    lines.append("")

    lines.append("## 다음 단계")
    lines.append(
        "- 문서 전체 또는 특정 절 읽기: `analy_get_doc(ref=\"16\", section=\"6.6\")`"
    )
    lines.append(
        "- 키워드로 해당 절 찾기: `analy_search(query=\"color-mix\")`"
    )
    return "\n".join(lines)


@mcp.tool(
    name="analy_get_doc",
    annotations={
        "title": "표준 문서 조회",
        "readOnlyHint": True,
        "destructiveHint": False,
        "idempotentHint": True,
        "openWorldHint": False,
    },
)
async def analy_get_doc(params: GetDocInput) -> str:
    """.analy 표준 문서 한 건을 (또는 그 안의 특정 절만) 디스크에서 읽어 반환한다.

    호출 시점에 파일을 직접 읽으므로 항상 최신 내용을 반환한다. 토큰 절약을 위해
    가능하면 `section` 으로 필요한 절만, 또는 `max_chars` 로 길이를 제한해 받아라.

    Args:
        params (GetDocInput): 검증된 입력.
            - ref (str): 문서 번호/파일명/부분문자열.
            - section (Optional[str]): 특정 절 제목 일부. 지정 시 그 절만 반환.
            - max_chars (Optional[int]): 반환 길이 상한.

    Returns:
        str: 마크다운 문서 내용(또는 지정 절). 다음의 경우 안내 문구 반환:
            - 문서를 못 찾으면: 사용 가능한 번호 목록과 함께 오류 안내
            - section 을 못 찾으면: 그 문서의 제목 목록과 함께 안내
    """
    path = _resolve_doc(params.ref)
    if path is None:
        avail = ", ".join(
            (_doc_number(p) or "?") for p in _iter_doc_paths()
        )
        return (
            f"Error: '{params.ref}' 에 해당하는 문서를 찾지 못했습니다.\n"
            f"사용 가능한 번호: {avail}\n"
            f"analy_index 로 전체 목록을 확인하세요."
        )

    try:
        text = path.read_text(encoding="utf-8")
    except OSError as e:
        return f"Error: 문서를 읽지 못했습니다 ({path.name}): {type(e).__name__}"

    title = _doc_title(path)
    header = f"<!-- {path.name} · {title} -->\n"

    if params.section:
        sec = _extract_section(text, params.section)
        if sec is None:
            headings = [
                m.group(2).strip()
                for line in text.splitlines()
                if (m := _HEADING_RE.match(line))
            ]
            preview = "\n".join(f"  - {h}" for h in headings[:40])
            return (
                f"Error: '{path.name}' 에서 '{params.section}' 절을 찾지 못했습니다.\n"
                f"이 문서의 제목 목록:\n{preview}"
            )
        body = header + sec
    else:
        body = header + text

    if params.max_chars and len(body) > params.max_chars:
        body = (
            body[: params.max_chars]
            + f"\n\n…(생략됨. 전체 {len(body)}자 중 {params.max_chars}자만 표시. "
            f"section 인자로 필요한 절만 받거나 max_chars 를 늘리세요.)"
        )
    return body


@mcp.tool(
    name="analy_search",
    annotations={
        "title": "표준 문서 키워드 검색",
        "readOnlyHint": True,
        "destructiveHint": False,
        "idempotentHint": True,
        "openWorldHint": False,
    },
)
async def analy_search(params: SearchInput) -> str:
    """전체 .analy 문서에서 키워드를 검색해, 매치된 위치(문서·절·라인)와 스니펫을 반환한다.

    문서를 통째로 읽지 않고 필요한 절만 찾을 때 쓴다(토큰 절약). 결과의 문서 번호와
    절 제목을 보고 analy_get_doc(ref, section) 으로 해당 절만 받아 정밀하게 확인하라.

    Args:
        params (SearchInput): 검증된 입력.
            - query (str): 찾을 키워드/문구(대소문자 무시, 부분일치).
            - limit (Optional[int]): 최대 매치 수(기본 20).

    Returns:
        str: 마크다운. 매치별로 `[번호 §절제목] L<라인>: <스니펫>` 형태.
            매치가 없으면 그 사실과 검색 범위를 안내.
    """
    q = params.query.lower()
    limit = params.limit or 20
    paths = _iter_doc_paths()
    if not paths:
        return f"표준 문서를 찾을 수 없습니다(경로: {_analy_dir()})."

    results: list[str] = []
    total = 0
    for p in paths:
        num = _doc_number(p) or "-"
        try:
            lines = p.read_text(encoding="utf-8").splitlines()
        except OSError:
            continue
        for i, line in enumerate(lines):
            if q in line.lower():
                total += 1
                if len(results) < limit:
                    heading = _enclosing_heading(lines, i)
                    snippet = line.strip()
                    if len(snippet) > 200:
                        snippet = snippet[:200] + "…"
                    sec = f" §{heading}" if heading else ""
                    results.append(f"- [{num}{sec}] L{i + 1}: {snippet}")

    if total == 0:
        return (
            f"'{params.query}' 매치 없음. (검색 문서 {len(paths)}건)\n"
            f"analy_index 의 라우팅 키워드를 참고해 다른 표현으로 재검색하세요."
        )

    head = (
        f"# 검색 결과: '{params.query}'\n"
        f"총 {total}건 매치"
        + (f" (상위 {limit}건 표시)" if total > limit else "")
        + "\n"
    )
    tail = (
        "\n\n필요한 절은 analy_get_doc(ref, section) 으로 정밀 조회하세요."
    )
    return head + "\n".join(results) + tail


def main() -> None:
    """stdio 트랜스포트로 MCP 서버 실행."""
    mcp.run()


if __name__ == "__main__":
    main()
