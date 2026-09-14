# env/ — 노션 연결 목록

이 폴더의 `*.env` 파일 하나가 **노션 연결 하나**입니다. 파일 이름(확장자 제외)이 곧
`/yoon-notion`에서 쓰는 **노션 이름**입니다.

```
env/
  work.env        -> 노션 이름: work
  personal.env    -> 노션 이름: personal
  .default        -> 이름을 생략했을 때 쓸 연결 (선택)
```

## 파일 형식

```dotenv
NOTION_TOKEN=ntn_xxxxxxxxxxxxxxxxxxxx   # 필수. Notion 통합(Integration) 시크릿
DESCRIPTION=회사 워크스페이스            # 선택. 목록에 표시됨
ROOT_PAGE=https://www.notion.so/...     # 선택. 자주 쓰는 시작 페이지
WORKSPACE=...                           # check 명령이 자동으로 채움
BOT=...                                 # check 명령이 자동으로 채움
```

## 추가하는 법

토큰을 명령줄에 입력하는 CLI 명령은 **일부러 없습니다.** 명령줄에 쓰면 셸 기록과
대화 로그에 평문으로 남기 때문입니다. 편집기로 파일을 직접 만드세요.

1. 이 폴더에 `<노션이름>.env` 파일 생성
2. 아래 내용을 넣고 저장

   ```dotenv
   NOTION_TOKEN=ntn_여기에토큰
   DESCRIPTION=무슨 노션인지 한 줄
   ```

3. 연결 확인 — 토큰 유효성과 실제 페이지 접근 여부까지 봅니다.

   ```bash
   ../yoon-notion.sh check --as <노션이름>
   ```

   성공하면 `WORKSPACE`, `BOT`, `VERIFIED_AT`이 파일에 자동으로 채워집니다.

## 토큰 발급

1. https://www.notion.so/profile/integrations 에서 **New integration** 생성
2. Capabilities에서 읽기/쓰기/댓글 권한 선택
3. **Internal Integration Secret** 복사 (`ntn_`으로 시작)
4. 연결할 노션 페이지에서 `···` → **Connections** → 만든 통합을 추가

4번을 하지 않으면 토큰이 유효해도 해당 페이지는 보이지 않습니다 (`404 object_not_found`).

## 보안

`*.env`와 `.default`는 `.gitignore`에 등록되어 있습니다. 이 폴더의 토큰은 평문이므로
커밋하거나 공유하지 마세요.
