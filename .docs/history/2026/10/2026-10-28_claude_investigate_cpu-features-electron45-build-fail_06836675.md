# cpu-features 때문에 다른 PC 에서 npm install 이 멈춘 건 — 원인 확정

- 작성: 2026-10-28 (claude, 세션 06836675)
- 지시: 장군님 「다른 pc 에서 일렉트론 버전 올리는데 아래와 같은 오류 발생했어」 →
  「왜 이 pc 에서만 발생되는거냐」 → 「인터넷 뒤져서 왜 그런건지 찾어내라」

## 증상

다른 PC 에서 `npm install` 이 `postinstall`(= `electron-builder install-app-deps`) 단계에서 멈춤.

```
• preparing       moduleName=better-sqlite3 arch=x64
• finished        moduleName=better-sqlite3 arch=x64
• preparing       moduleName=cpu-features arch=x64
⨯ node-gyp failed to rebuild '…\node_modules\cpu-features'
```

컴파일 오류는 전부 `nan` 과 Electron 45 의 V8 헤더가 안 맞는 것:
`v8::External::Value` 인자 수 · `v8::External::New` 인자 수 ·
`v8::Object::SetPrototypeV2` 없음 · `NamedPropertySetterCallbackV2` 변환 불가.
헤더 경로가 `C:\Users\socce\.electron-gyp\45.0.0\include\node\...` 이므로 **Electron 45 용 다시 빌드 단계**가 맞다.

## 원인 (확정)

1. `cpu-features` 0.0.10 의 install script (npm registry 실측):
   `"install": "node buildcheck.js > buildcheck.gypi && node-gyp rebuild"`
   `buildcheck.js` 는 `buildcheck` 모듈로 **그 PC 의 빌드 환경을 실제로 조사**한다
   (`checkHeader('c','dlfcn.h')` · `checkDeclared('c','getauxval')` — 작은 C 코드를 그 PC 에서 컴파일해 본다).
   그 결과를 `buildcheck.gypi` 에 쓰고, 그다음 `node-gyp rebuild` 가 **Node 헤더로** 컴파일한다.
   → **설치 성공 여부가 PC 의 빌드 환경에 달려 있다.**
2. `cpu-features` 는 `node-ssh` → `ssh2` 1.17.0 의 **optionalDependencies**.
   그래서 **빌드가 실패하면 npm 이 조용히 빼고 넘어간다.** 성공하면 남는다.
3. `electron-builder install-app-deps`(내부 = `@electron/rebuild`)는 **install script 를 다시 돌리지 않고
   `node-gyp rebuild` 만** 돌린다. 그래서 **모듈이 남아 있는 PC 에서만** Electron 45 헤더로 컴파일이 시작되고,
   거기서 `nan` 2.27.0 이 Electron 45 의 V8 을 못 따라가 터진다.
4. Electron 14 때는 **깔려 있어도 통과**했다 — 그 시절 V8 은 `nan` 이 지원했다.
   그래서 지금까지 어느 PC 도 안 터졌다.

**한 줄: 「되는 PC」 가 아니라 「cpu-features 가 깔려 있는 PC」만 터진다.**

## 이 PC 실측 (왜 여기선 안 터지나)

| 확인한 것 | 값 |
|---|---|
| `node_modules/cpu-features` · `buildcheck` | **없음** (설치 기록 `node_modules/.package-lock.json` 에도 없음) |
| `node_modules/ssh2` · `nan` 폴더 날짜 | 2026-06-12 11:58:10 |
| npm 캐시의 cpu-features 흔적 | 0.0.10 파일 2026-04-23 18:26 내려받음 · 정보 조회 2026-06-12 11:58:03 |
| Visual Studio 2022 BuildTools | 2026-04-22 설치 · `cl.exe` 있음 (`VC/Tools/MSVC/14.44.35207/bin/Hostx64/x64`) |
| Windows SDK | 10.0.26100.0 |
| Python | 3.14.4 |
| cmake | **없음** |
| node / npm | v24.13.0 / 11.6.2 (오류 난 PC 는 npm 10.9.8) |

→ 이 PC 도 **설치를 시도했고**(캐시 흔적 + ssh2·nan 과 같은 초에 조회), 결과가 트리에 없다 =
  **그때 빌드가 실패해서 빠졌다.** 빌드 도구는 4월부터 있었으니 그것 때문은 아니다.
  **왜 실패했는지는 그때 npm 로그가 없어 모른다 — 추측하지 않는다.**
  (`cpu-features` 0.0.10 은 `deps/cpu_features/cpu_features.gyp` 로 빌드하므로 Windows 에서 cmake 는 안 탄다.
   ssh2 maintainer 가 말한 cmake 요구는 Linux 사례다.)

## 영향도

`ssh2` 가 `cpu-features` 를 쓰는 자리는 **딱 1곳** — `lib/protocol/constants.js`
7행에서 `try/catch` 로 불러오고, 93·99행에서 **SSH 암호 방식 우선순위만** 바꾼다.
쓸 수 있는 암호 목록은 어느 분기에서도 같다(순서만 다름). 없으면 `catch` 로 넘어가 기본 순서를 쓴다.
→ **없어도 기능은 같고 속도만 조금 손해.** 게다가 우리 소스에서 `node-ssh`·`ssh2` 를 쓰는 곳은 현재 **0건**
  (장군님: 「추후에 필요할거 같아서 미리 깔아놓은거야」 → 의존성은 남긴다).

## 버린 방법 (또 밟지 말 것)

| 방법 | 왜 안 되나 |
|---|---|
| `rmdir /s /q node_modules\cpu-features` | **장군님 질책받은 방법.** npm 설치 기록과 어긋나게 만들고, 다음 `npm install` 에 되돌아온다 |
| `npm rm cpu-features` | **안 듣는다**(장군님 실측). `package.json` 에 없는 간접 의존이라 지울 대상이 없다 |
| `.npmrc` 에 `omit=optional` | 이 프로젝트 optional 17개가 같이 빠진다 — `@mongodb-js/saslprep`(mongodb 인증) 등 실제로 필요한 순수 JS 모듈 포함 |
| npm 으로 **하나만** 빼기 | **npm 에는 그 기능이 없다.** pnpm 전용(`ignoredOptionalDependencies` · overrides `"-"`) |
| electron-builder `ignoredProductionDependencies` | 그것은 **패키징에서 빼는 것**이고 다시 빌드를 막지 않는다. 우리가 선언한 의존성만 대상 |
| `nodeGypRebuild: true` | 문서상 **앱 자체가 네이티브일 때만** 쓰는 것. 우리 경우가 아니다 |
| `node-ssh` 제거 | 장군님이 추후 쓸 예정이라 **철회** |

## 제안 (TODO 1-19 로 결정 대기)

`package.json` 의 `postinstall` 을
`electron-builder install-app-deps` → **`npx @electron/rebuild -f -w better-sqlite3`** 로 바꾼다.

근거:
- 이 프로젝트에서 `binding.gyp` 를 가진 모듈은 **`better-sqlite3` 하나뿐**(실측).
- 오류 로그에서 `@electron/rebuild` 가 잡은 대상도 `better-sqlite3`·`cpu-features` **둘뿐**.
- `package.json` 에 이미 같은 모양의 `sqlite:rebuild` 스크립트가 있다.
- 남의 라이브러리를 고치지도, 폴더를 손으로 지우지도 않는다.

**미검증**: 이 변경을 적용한 뒤 `npm install` 을 돌려 보지 않았다(이 PC 에는 cpu-features 가 없어 재현도 안 된다).
오류 난 PC 에서 확인해야 끝난다.

## 참고 (출처)

- ssh2 maintainer: cpu-features 는 optional · 빌드 환경이 필요 — https://github.com/mscdex/ssh2/issues/1074
- 같은 사고 사례(cpu-features 를 Electron rebuild 에서 제외) — https://github.com/wannabespace/tamery/pull/548
- nan 이 새 Electron V8 을 못 따라가는 사고 반복 — https://github.com/nodejs/nan/issues/969 · https://github.com/electron/electron/issues/41518
- npm 은 optional 전부 생략만 가능 — https://docs.npmjs.com/cli/v10/configuring-npm/package-json/
- 하나만 빼기는 pnpm 전용 — https://pnpm.io/settings/dependency-resolution
- electron-builder 설정(`ignoredProductionDependencies`·`nodeGypRebuild`) — https://www.electron.build/docs/configuration/

---

## 추가 실측 (2026-10-28) — 「잘 되던 PC 는 왜 잘됐나」

장군님 질문: 「잘 되던 pc 는 왜 잘된건데 그러면???」 → 이 PC 에서 직접 재현해 확인했다.

### 시험 1 — 임시 폴더(긴 경로)에서 설치 → **실패. 단 이유가 다름**

`scratchpad/cpuftest` (경로 약 170자) 에서 `npm install cpu-features@0.0.10`:

```
error MSB3191: "Release\obj\cpu_features\cpu_features.tlog\" 디렉터리를 만들 수 없습니다.
지정한 경로 및/또는 파일 이름이 너무 깁니다. 정규화된 파일 이름은 260자 미만이어야 하며…
```

**★함정**: Windows 260자 경로 제한 때문이고, **cpu-features 자체 문제가 아니다.**
내 시험 설계 실수였다. 스크래치 폴더 경로가 길어서 네이티브 빌드 시험에 쓸 수 없다 —
네이티브 모듈 빌드 시험은 **짧은 경로**에서 해야 한다.

### 시험 2 — 짧은 경로(`C:\Users\socce\AppData\Local\Temp\cpuf2`, 38자) → **성공**

`EXIT=0` · `build\Release\cpufeatures.node` 생성됨.
→ **이 PC 는 지금 cpu-features 를 빌드할 수 있다.**

### 시험 3 — 프로젝트와 **같은 길이**(57자) 경로 → **성공**

프로젝트 경로 `C:\Users\socce\Documents\Github\CHUNGYOON0120\U4A_WS4.0.0` = 57자.
같은 길이의 임시 폴더를 만들어 설치 → `EXIT=0`, `.node` 생성.
→ **경로 길이는 이 PC 프로젝트에서의 실패 원인이 아니다.**

### 시험 4 — 한 번 빠진 뒤 npm 이 다시 시도하나 → **한다**

시험 3 폴더에서 `cpu-features`·`buildcheck`·`nan` 폴더를 지우고
`node_modules/.package-lock.json`(hidden lockfile)에서도 그 3개 항목을 지운 뒤 `npm install`
→ `added 3 packages in 8s` — **다시 깔렸다.**

### 확정된 답

- **「잘 되던 PC」 = 그 PC 에 `cpu-features` 가 안 깔려 있던 PC.** 선택 모듈이라 설치가 실패하면
  npm 이 조용히 빼고 넘어가므로, 한 번 빠진 PC 는 그 뒤로 **그 모듈 없이** 계속 잘 돌아간다.
  Electron 45 로 올려도 **다시 빌드할 대상이 없어서** 안 터진다.
- **「안 되는 PC」 = 그 모듈이 깔려 있던 PC.** 거기서만 Electron 45 헤더로 다시 컴파일이 시작되고
  `nan` 2.27.0 이 Electron 45 의 V8 을 못 따라가 멈춘다.
- **이 PC 는 안전한 게 아니다.** 지금도 빌드 능력이 있으므로(시험 2·3),
  `node_modules` 를 지우고 새로 깔면 **이 PC 도 같은 자리에서 터질 가능성이 크다.**
- 프로젝트·사용자 `.npmrc` 는 **둘 다 없고** `runtime`/`target`/`disturl`/`nodedir` 설정도 없다
  (= 설치 단계는 Electron 헤더가 아니라 Node 헤더로 빌드한다. 확인함).

### 아직 모르는 것

- **이 PC 에서 2026-06-12 에 왜 실패했는지**는 그때 npm 로그가 없어 모른다.
  단서: `~/AppData/Local/node-gyp/Cache` 에 **16.20.2** 헤더가 남아 있다(nvm 에 v16.20.2 있음) —
  그때 Node 16 으로 돌렸을 가능성. **확인 못 했으므로 단정하지 않는다.**

### 참고 (출처)

- hidden lockfile 은 설치 트리 캐시 — https://docs.npmjs.com/cli/v7/configuring-npm/package-lock-json/
- Windows 경로 길이로 네이티브 빌드가 깨지는 고전 사고 — https://github.com/yeoman/yeoman/issues/1532 · https://adamlynch.com/npm-distribution-path-length-problems/
- ssh2 는 선택 바인딩이 실패해도 그냥 넘어간다 — https://github.com/davidpoxon/roubo/issues/1471

---

## 조치 (2026-10-28) — 장군님 지시 「진행해」

### 결정적 실측 — 이 PC 도 새로 깔면 그 모듈이 깔린다

프로젝트의 `package.json`·`package-lock.json` 만 짧은 경로 임시 폴더로 복사해 `npm ci`
→ **`node_modules/cpu-features` 가 생겼다.**

→ 「잘 되는 PC」의 정체: **6월에 깐 `node_modules` 를 그대로 쓰고 있어 그 모듈이 아예 없는 것.**
  환경 차이가 아니다. 지우고 새로 깔면 이 PC 도 같은 자리에서 멈춘다.
  **6월에 왜 안 깔렸는지는 끝까지 확정하지 못했다**(그때 로그 없음). 지금은 깔리므로 더 파지 않는다.

### 고친 것

| 파일 | 무엇 |
|---|---|
| `package.json` | `"postinstall"` 을 `electron-builder install-app-deps` → **`npx @electron/rebuild -f -w better-sqlite3`** |
| `.analy/09_환경구축_런북.md` | 예시 블록의 같은 줄 · 네이티브 모듈 절에 **왜 바꿨는지 + 새 네이티브 모듈 추가 시 `-w` 에 이름을 같이 적어야 한다**는 규칙 · 검증 문구를 새 명령 기준으로 |

까닭: `install-app-deps` 는 `node_modules` 를 훑어 **네이티브 모듈을 전부** 다시 빌드한다.
`-w` 로 이름을 주면 **그것만** 한다 → `cpu-features` 를 아예 건드리지 않는다.
npm 에는 선택 모듈 하나만 설치에서 빼는 기능이 **없다**(pnpm 전용). 그래서 「빼기」가 아니라 「안 건드리기」로 간다.

### 실측 결과 (이 PC)

```
> npx @electron/rebuild -f -w better-sqlite3
- Searching dependency tree
✔ Rebuild Complete          ← EXIT=0
```

- `node_modules/better-sqlite3/build/Release/.forge-meta` = **`x64--150`** (= Electron 45 ABI)
- `package.json` 은 유효한 JSON (`node -e` 로 확인)
- `cpu-features` 는 여전히 없음 → 건드리지 않음

### ★함정 — 「Rebuild Complete 인데 `build/Release/*.node` 가 없다」는 정상이다

`better-sqlite3` **13.0.3 은 `node-addon-api` ^8 = Node-API(napi)** 로 만들어졌고,
로더(`lib/binding.js:44`)가 **`prebuilds/win32-x64.node`** 를 읽는다(그 파일 안에 `napi_` 문자 72개 확인).
Node-API 는 ABI 중립이라 Electron 버전과 무관하게 그대로 돈다.

`@electron/rebuild` 는 prebuildify 결과를 찾으면 **컴파일하지 않고 `.forge-meta` 만 쓰고 끝낸다**
(`module-rebuilder.js` `findPrebuildifyModule` → `writeMetadata`).
그래서 `build/Release` 에 `.node` 가 없는 것이 **깨진 것이 아니다.** 지우거나 다시 빌드하려 들지 말 것.

→ 뒤집어 말하면 이 프로젝트에는 **지금 Electron ABI 로 다시 빌드해야 하는 모듈이 사실상 없다.**
  `-w better-sqlite3` 는 그 패키지가 나중에 소스 빌드로 바뀔 때를 위한 보험으로 남긴다.

### 미검증 (장군님이 확인하실 것)

- **오류 났던 PC 에서 `npm install` 이 끝까지 통과하는지** — TODO 테스트 4번. 이 PC 에서는
  재현이 안 되므로(그 모듈이 없음) 그 PC 에서만 확인된다.

### 보고만 (고치지 않음 — 지시 대기)

`.analy/09` 의 환경 표에 **Electron 14 시절 값이 그대로** 남아 있다 —
`앱 내장 Node 14.17.0` · `Chromium 93.0.4577.82` · `네이티브 ABI 89`.
같은 문서 다른 줄에는 `Electron 45 → ABI 150` 으로 맞게 적혀 있어 **서로 어긋난다.**
실제 값은 Electron 45 를 켜 봐야 알 수 있어 지금은 손대지 않았다.
