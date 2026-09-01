# U4A Workspace 4.0

SAP UI5 기반 U4A Workspace 를 **HTML5 + 바닐라 JS** 로 바꾸는 Electron 데스크톱 앱.
백엔드(Electron / IPC / Node)는 그대로 두고, 화면 그리는 부분만 UI5 → HTML5 로 교체한다.

---

## 새 PC에서 처음 세팅하기 (이 순서대로)

### 0. 먼저 깔아야 하는 것 4가지

**이 4개가 없으면 뒤에서 반드시 막힌다.** 특히 Python 과 C++ 빌드 도구는
sqlite 를 다시 빌드할 때 쓰이는데, 없으면 앱이 아예 안 켜진다.

| 준비물 | 왜 필요한가 | 현재 개발 PC에서 쓰는 버전 |
|---|---|---|
| **Git** | 소스 내려받기 | 2.52.0 |
| **Node.js** (LTS) | npm 설치·앱 실행 | v24.13.0 (npm 11.6.2) |
| **Python 3.x** | sqlite 다시 빌드할 때 내부에서 씀. 없으면 빌드가 멈춤 | 3.14.4 |
| **Visual Studio Build Tools 2022** — 설치할 때 **"C++를 사용한 데스크톱 개발"** 항목 체크 | sqlite 를 C++ 로 다시 컴파일함 | 17.14 (Build Tools) |

- Node.js: https://nodejs.org (LTS 설치. 설치 중 "Tools for Native Modules" 체크하면 Python·빌드 도구를 같이 깔아준다)
- Python: https://www.python.org/downloads/ (설치 첫 화면에서 **Add python.exe to PATH** 반드시 체크)
- Visual Studio Build Tools: https://visualstudio.microsoft.com/downloads/ → "Build Tools for Visual Studio 2022"

설치 다 됐는지 확인:

```bash
git --version && node -v && npm -v && python --version
```

### 1. 소스 내려받기

```bash
git clone https://github.com/chungyoon0120/U4A_WS4.0.0.git
```

기본은 `main` 브랜치다. 작업 브랜치가 따로 있으면 받은 뒤에 옮긴다:

```bash
git checkout bootstrap
```

### 2. 라이브러리 설치

받은 폴더 안에서:

```bash
npm install
```

- `node_modules` 는 저장소에 안 들어있어서 PC마다 새로 깔아야 한다.
- 설치 끝에 `electron-builder install-app-deps` 가 자동으로 돌면서 sqlite 를 Electron 용으로 다시 빌드한다. 여기서 Python·C++ 빌드 도구가 쓰인다.

### 3. sqlite 다시 빌드 (2번에서 실패했거나, 앱이 안 켜질 때)

```bash
npm run sqlite:rebuild
```

### 4. 앱 실행

```bash
npm start
```

### 5. 설치 파일(exe) 만들기 — 필요할 때만

```bash
npm run build
```

결과물은 `dist` 폴더에 생긴다.

---

## 잘 막히는 곳 (여기서 시간 다 날아감)

| 증상 | 원인 | 해결 |
|---|---|---|
| 앱 켜자마자 죽음 + `better_sqlite3.node` / `NODE_MODULE_VERSION` 글자가 보이는 오류 | sqlite 가 Node 용으로만 빌드돼 있고 Electron 용이 아님 | `npm run sqlite:rebuild` |
| 설치 도중 `Could not find any Python installation` | Python 이 없거나 PATH 에 안 잡힘 | Python 설치 + **Add python.exe to PATH** 체크 후 새 터미널에서 다시 |
| 설치 도중 C++ 컴파일 관련 오류(`MSB...`, `Visual Studio not found`) | C++ 빌드 도구 없음 | Visual Studio Build Tools 2022 에서 **"C++를 사용한 데스크톱 개발"** 설치 |
| 위 3개를 고친 뒤에도 계속 같은 오류 | 예전에 실패한 찌꺼기가 남음 | `node_modules` 폴더 통째로 지우고 `npm install` 부터 다시 |

---

## 저장소에 안 들어있는 것 (새 PC에서 따로 챙겨야 함)

| 대상 | 설명 |
|---|---|
| `node_modules`, `dist` | 저장소 제외. `npm install` / `npm run build` 로 다시 만듦 |
| `.mcp.json` | Claude Code 용 설정. PC마다 경로가 달라서 제외했다. 쓰려면 새로 만들어야 하고 `uv` 도 필요하다 |
| 접속 서버 목록·개인 설정 | 소스가 아니라 PC 안에 저장된다 — 사용자 데이터 폴더(`%APPDATA%\com.u4a_ws3.app.dev`)와 윈도우 레지스트리(`HKCU\SOFTWARE\U4A\WS`). **새 PC에서는 서버를 다시 등록해야 한다** |
| `node_modules/U4A` | 설치 파일 만들 때 참조하는 항목인데 지금 개발 PC에도 없다(미확인). 실행에는 영향 없음 |

---

## 명령어 한눈에

| 명령 | 하는 일 |
|---|---|
| `npm install` | 라이브러리 설치 (+ Electron 용 sqlite 자동 재빌드) |
| `npm start` | 앱 실행 |
| `npm run sqlite:rebuild` | sqlite 만 Electron 용으로 다시 빌드 |
| `npm run build` | 윈도우 설치 파일(exe) 만들기 → `dist` |

---

## 작업 규칙·문서

화면·UI 작업을 하려면 아래를 먼저 읽는다. 변환 기준의 원본은 [`.analy/`](.analy/) 문서 묶음이다.

- [`CLAUDE.md`](CLAUDE.md) — 프로젝트 작업 규칙 (원본 손대지 않기 등 최우선 규칙)
- [`.analy/13_AI_작업지시_가이드.md`](.analy/13_AI_작업지시_가이드.md) — 작업 방식·가드레일
- [`.analy/16_공통_화면UX_표준.md`](.analy/16_공통_화면UX_표준.md) — 모든 화면 공통 표준
- [`.report/`](.report/) — 변환 진행 현황·잔여 목록
