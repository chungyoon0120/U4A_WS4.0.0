# U4A Workspace 4.0

SAP UI5 기반 U4A Workspace 를 **HTML5 + 바닐라 JS** 로 바꾸는 Electron 데스크톱 앱.
백엔드(Electron / IPC / Node)는 그대로 두고, 화면 그리는 부분만 UI5 → HTML5 로 교체한다.

---

# 새 PC에서 처음 세팅하기

## 한눈에 보는 순서

1. 프로그램 5가지 설치 (GitHub Desktop · Git · Node.js · **Python** · **C++ 빌드 도구**)
2. 소스 내려받기
3. `npm install`
4. `npm run sqlite:rebuild`
5. `npm start` — 앱 실행

> **Python 과 C++ 빌드 도구를 빼먹지 말 것.** 이 앱은 데이터를 sqlite 에 담는데,
> 그 부품을 Electron 에 맞게 **다시 컴파일**해야 한다. 이 두 개가 없으면
> 설치가 도중에 멈추거나, 설치는 됐는데 앱이 켜지자마자 죽는다.

---

## 1. 프로그램 설치 (5가지)

| 준비물 | 왜 필요한가 | 이 개발 PC에 깔린 버전 |
|---|---|---|
| **GitHub Desktop** | 소스 내려받기·올리기를 클릭으로. 명령어가 익숙하면 없어도 됨 | 3.6.4 |
| **Git** | 터미널에서 명령어로 소스 다루기 | 2.52.0 |
| **Node.js** (LTS) | 라이브러리 설치·앱 실행 | v24.13.0 (npm 11.6.2) |
| **Python 3.x** | sqlite 를 다시 컴파일할 때 내부에서 씀 | 3.14.4 |
| **Visual Studio Build Tools 2022** | sqlite 를 C++ 로 다시 컴파일함 | 17.14 |

**GitHub Desktop** — https://desktop.github.com
설치 후 처음 켜면 GitHub 계정으로 로그인한다.

**Git** — https://git-scm.com/download/win
설치 화면은 전부 기본값 그대로 두면 된다.
GitHub Desktop 안에도 Git 이 들어있지만 그건 그 프로그램 안에서만 쓰인다.
터미널에서 `git` 명령을 쓰려면 이걸 따로 깔아야 한다.

**Node.js** — https://nodejs.org
LTS 를 받는다. 설치 중 **"Tools for Native Modules"** 를 체크하면
아래 Python 과 C++ 빌드 도구를 같이 깔아준다(체크하면 4·5번 생략 가능).

**Python 3.x** — https://www.python.org/downloads/
설치 첫 화면에서 **"Add python.exe to PATH"** 를 **반드시 체크**한다.
체크를 안 하면 깔려 있어도 설치 도중 "Python 을 못 찾겠다"며 멈춘다.

**Visual Studio Build Tools 2022** — https://visualstudio.microsoft.com/downloads/
아래로 내려가 "Tools for Visual Studio" → **Build Tools for Visual Studio 2022** 를 받는다.
설치 화면에서 **"C++를 사용한 데스크톱 개발"** 을 체크하고 설치한다.

다 깔렸는지 확인 (버전이 5개 다 찍혀야 한다):

```bash
git --version && node -v && npm -v && python --version
```

---

## 2. 소스 내려받기

### 방법 A — GitHub Desktop (클릭으로)

1. GitHub Desktop 을 켜고 GitHub 계정으로 로그인한다.
2. 왼쪽 위 **File → Clone repository** 를 누른다.
3. **URL** 칸을 고르고 아래 주소를 붙여넣는다.
   `https://github.com/chungyoon0120/U4A_WS4.0.0.git`
4. **Local path** 에 소스를 둘 폴더를 고르고 **Clone** 을 누른다.
5. 다 받아지면 위쪽 **Current branch** 를 눌러 작업할 브랜치를 고른다 (기본은 `main`).
6. **Repository** 메뉴에서 터미널 열기 항목을 누르면 그 폴더에서 터미널이 열린다.
   (고른 터미널 종류에 따라 `Open in Command Prompt` / `Open in Git Bash` 등으로 이름이 다르게 보인다.)
   다음 3번부터는 이 터미널에서 이어서 한다.

### 방법 B — 명령어로

```bash
git clone https://github.com/chungyoon0120/U4A_WS4.0.0.git
```

기본은 `main` 브랜치다. 작업 브랜치가 따로 있으면 받은 뒤에 옮긴다:

```bash
git checkout bootstrap
```

---

## 3. 라이브러리 설치

받은 폴더 안에서:

```bash
npm install
```

- 라이브러리 폴더(`node_modules`)는 저장소에 안 들어있어서 PC마다 새로 깔아야 한다.
- 설치 끝에 sqlite 를 Electron 용으로 다시 컴파일하는 과정이 자동으로 돈다.
  여기서 Python·C++ 빌드 도구가 쓰이고, 시간이 몇 분 걸린다.

## 4. sqlite 다시 빌드

```bash
npm run sqlite:rebuild
```

3번에서 다시 컴파일이 자동으로 됐다면 건너뛰어도 된다.
다만 **앱이 켜지자마자 죽는다면 십중팔구 이게 안 된 것**이니 이 명령을 돌린다.

## 5. 앱 실행

```bash
npm start
```

## 6. 설치 파일(exe) 만들기 — 필요할 때만

```bash
npm run build
```

결과물은 `dist` 폴더에 생긴다.

---

# 잘 막히는 곳 (여기서 시간 다 날아감)

| 증상 | 원인 | 해결 |
|---|---|---|
| 앱 켜자마자 죽음. 오류에 `better_sqlite3.node` 또는 `NODE_MODULE_VERSION` 글자가 보임 | sqlite 부품이 Node 용으로만 컴파일돼 있고 Electron 용이 아님 | `npm run sqlite:rebuild` |
| 설치 도중 `Could not find any Python installation` | Python 이 없거나 PATH 에 안 잡힘 | Python 설치 + **Add python.exe to PATH** 체크. 그다음 **터미널을 새로 열어** 다시 |
| 설치 도중 C++ 컴파일 오류 (`MSB...`, `Visual Studio not found`) | C++ 빌드 도구 없음 | Build Tools 2022 에서 **"C++를 사용한 데스크톱 개발"** 설치 |
| 위를 다 고쳤는데도 같은 오류 | 예전에 실패한 찌꺼기가 남음 | `node_modules` 폴더를 통째로 지우고 `npm install` 부터 다시 |

---

# 저장소에 안 들어있는 것 (새 PC에서 따로 챙길 것)

| 대상 | 설명 |
|---|---|
| 라이브러리·빌드 결과 폴더 (`node_modules`, `dist`) | `npm install` / `npm run build` 로 다시 만든다 |
| `.mcp.json` | Claude Code 용 설정. PC마다 경로가 달라 저장소에서 뺐다. 쓰려면 새로 만들어야 하고 `uv` 도 필요하다 |
| **접속 서버 목록·개인 설정** | 소스가 아니라 PC 안에 저장된다 — 사용자 데이터 폴더(`%APPDATA%\com.u4a_ws3.app.dev`)와 윈도우 레지스트리(`HKCU\SOFTWARE\U4A\WS`). **새 PC에서는 서버를 다시 등록해야 한다** |
| `node_modules/U4A` | 설치 파일 만들 때 참조하는 항목인데 이 개발 PC에도 없다(미확인). 앱 실행에는 영향 없음 |

---

# 명령어 한눈에

| 명령 | 하는 일 |
|---|---|
| `npm install` | 라이브러리 설치 (+ Electron 용 sqlite 다시 컴파일) |
| `npm run sqlite:rebuild` | sqlite 만 Electron 용으로 다시 컴파일 |
| `npm start` | 앱 실행 |
| `npm run build` | 윈도우 설치 파일(exe) 만들기 → `dist` |

---

# 작업 규칙·문서

화면·UI 작업 전에 아래를 먼저 읽는다. 변환 기준의 단일 출처는 [`.analy/`](.analy/) 문서 묶음이다.

- [`CLAUDE.md`](CLAUDE.md) — 프로젝트 작업 규칙 (원본 손대지 않기 등 최우선 규칙)
- [`.analy/13_AI_작업지시_가이드.md`](.analy/13_AI_작업지시_가이드.md) — 작업 방식·가드레일
- [`.analy/16_공통_화면UX_표준.md`](.analy/16_공통_화면UX_표준.md) — 모든 화면 공통 표준
- [`.report/`](.report/) — 변환 진행 현황·잔여 목록
