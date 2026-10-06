# yoon-notion 에 U4A 워크스페이스 연결 추가

## 요청
장군님: "U4A 워크스페이스 정보를 yoon-notion에 추가해." (기존 notion-multi MCP 가 쓰던
U4A 워크스페이스를 yoon-notion 스킬의 연결로 등록). 이어서 "새로 넣으라고 내가 말한거" 로
ws4.0 과 별개의 새 연결로 추가하는 것이 맞음을 확인.

## 변경 내용
- notion-multi 가 쓰던 U4A 토큰(`C:\Users\socce\.claude\secrets\notion_u4a.token`, 50자)을
  읽어 yoon-notion 스킬에 `u4a` 연결로 등록.
- 등록 전 확인: yoon-notion 의 기존 `ws4.0` 연결 토큰과 U4A 토큰을 비교 →
  둘 다 50자지만 값이 **다름**(별개 integration). 그래서 덮어쓰지 않고 새 이름 `u4a` 로 추가.
- `connect add` 가 저장 전 토큰 검증 수행 → 검증 완료, workspace="U4A 워크스페이스", bot 연동.
- 이 과정에서 `u4a` 가 **기본 연결(default)로 설정됨**(첫 default 지정이었던 것으로 보임).

## 변경 파일
- 추가: `.claude/skills/yoon-notion/env/u4a.env` (토큰·연결 정보, gitignore 대상)
- 변경: `.claude/skills/yoon-notion/env/.default` (기본 연결 포인터가 `u4a` 로)

## 변경 이유
- 이번 세션 재시작에서 `notion-multi` MCP 연결이 끊김 → 노션 작업 경로를 yoon-notion 스킬로 이관.
- U4A 워크스페이스(이슈 리포트 DB 보유)를 yoon-notion 으로도 접근 가능하게 하기 위함.

## 영향 범위
- yoon-notion 연결: `me`, `ws4.0`, `u4a`(신규·현재 기본).
- 이름 생략 시 `u4a` 로 동작하게 됨 → ws4.0 를 기본으로 원하면 되돌려야 함(장군님 확인 대기).
- 코드·화면 동작에는 영향 없음(스킬 설정만).

## 검증
- `connect add` 결과: `token (저장됨, 검증 완료)`, `workspace U4A 워크스페이스`, `bot 연동`, `default True`.
- 토큰 값은 화면·이력에 노출하지 않음(동일 여부·길이만 확인).

## 참고 사항
- `ws4.0` 과 `u4a` 는 **토큰이 다른 별개 integration** — 같은 워크스페이스를 가리키는지는
  미확인(토큰만 비교함). 필요 시 `connect verify --all` 로 워크스페이스/봇 대조 가능.
- notion-multi 설정 원본: `C:\Users\socce\.claude\secrets\notion_workspaces.json`
  (U4A workspace_id=ff07e18b-1cd6-81b0-8a80-0003b082329e, 이슈 DB=bdd7e18b-1cd6-8396-a2b0-81900fb593d1).
- U4A 이슈 리포트 DB 는 앞서 컬럼 추가(생성/최종 편집 일시)·상태 6단계 정비를 마친 상태.

---

## 후속 (같은 세션) — U4A 노션에 "2차 검증" DB 생성

### 요청
장군님: "같은 레벨에 2차 검증이라는 db 하나 만들고 컬럼은 이슈 리포트 구조랑 동일하게 만들어줘."

### 변경 내용
- `u4a` 연결로 이슈 리포트 DB(`bdd7e18b-1cd6-8396-a2b0-81900fb593d1`) 구조를 읽어,
  같은 부모 페이지("U4A WS 4.0.0", page_id=`3b97e18b-1cd6-8062-a863-f1d4898b3062`) 밑에
  "2차 검증" DB 를 동일 컬럼으로 신규 생성.
- 생성된 DB: id=`3d77e18b-1cd6-8148-82d3-e0f7de26c56e`,
  url=https://app.notion.com/p/3d77e18b1cd6814882d3e0f7de26c56e
- 컬럼(이슈 리포트와 동일): 코드(title) / 분류(select: 기능,UX) / 내용(rich_text) /
  화면(rich_text) / 작성자(rich_text) / 상태(status) / 생성 일시(created_time) /
  최종 편집 일시(last_edited_time)
- 상태(status) 값 8개 그대로: 접수 / 보류 / 작업중 / 수정완료 / 테스트확인중 /
  ✅ 최종완료 / 🔁 재오픈 / 반려

### 변경 파일
- 로컬 소스 변경 없음 (노션 원격 DB 1개 생성). 임시 body 파일은 스크래치패드에만 생성.

### 변경 이유
- 장군님 지시. 2차 검증 단계를 이슈 리포트와 동일 양식으로 별도 DB 에서 관리하기 위함.

### 영향 범위
- U4A 노션 워크스페이스에 DB 1개 추가. 기존 이슈 리포트 DB 는 변경 없음.

### 검증
- 생성 후 raw GET 으로 새 DB properties 재조회 → 컬럼 8개·상태 옵션 8개 모두 확인.
- status 타입이 create database payload 로 정상 수용됨(옵션까지 반영). groups 는 payload 에
  명시하지 않아 노션 기본 배치로 들어감(값·동작엔 지장 없음, 필요 시 노션에서 드래그).

### 참고 사항
- yoon-notion CLI 의 `raw` 는 Git Bash 에서 `/v1/...` 경로가 Windows 경로로 변환돼 실패 →
  `.cmd` 런처를 PowerShell 로 호출하면 정상. (다음 작업자 주의)
- CLI 출력은 UTF-8 BOM 이 붙어 python json.load 시 `encoding="utf-8-sig"` 필요.

---

## 후속2 — 구글시트 "U4A 4.0 테스트" → 노션 "2차 검증" DB 20건 이관

### 요청
장군님: 구글시트(https://docs.google.com/spreadsheets/d/1on_7hjMpXY0v-VpcFxTc8ypTSjjTc7Ji2_FAGY4BHH4)
의 오류 내용·이미지를 노션 "2차 검증" DB 로 옮기고, 구글시트 순번=노션 코드 동일값으로.
내용 컬럼에도 간략히. 앞으로 "최신화/업데이트" 하면 노션과 비교해 **없는 순번만** 추가(증분).

### 변경 내용(노션 원격)
- 노션 `u4a` "2차 검증" DB(`3d77e18b-1cd6-8148-82d3-e0f7de26c56e`)에 **순번 1~20 (20건)** 생성.
  - 코드=순번, 작성자=시트 E열, 내용=시트 D열(확인 및 현상, 간략).
  - 본문=각 "이미지 및 로그N" 탭의 설명 텍스트 + **원본 이미지**(첨부 마커 뒤 순서대로 삽입).
- 증분: 생성 전 DB query 로 기존 코드 조회 → 이미 있는 코드(순번1)는 skip, 나머지 19건만 생성.

### 이미지 추출 방식(핵심)
- 구글시트 삽입 이미지는 다운로드 URL 이 없어 API 로 직접 못 뽑음 →
  **시트를 xlsx 로 export**(`/export?format=xlsx`) 하면 `xl/media/*.png` 에 원본 44장이 그대로 들어있음.
- xlsx 파싱으로 시트(순번)↔drawing↔media 매핑 → 순번별 이미지 그룹 확정.
- 노션 **File Upload API**(POST /v1/file_uploads → multipart send → image block의 file_upload)로 원본 업로드.

### 변경 파일(로컬)
- 프로젝트 소스 변경 없음. 작업 스크립트는 스크래치패드에만:
  xlsx_map.py(시트-이미지 매핑), parse_list.py(테스트목록 메타), prep.py(순번별 payload+이미지 추출),
  push.py(증분 생성·업로드). xlsx/이미지는 %TEMP%.

### 검증
- 생성 후 DB query 재조회 → 총 20건, 코드 1~20, 작성자·내용 모두 정상 확인.
- 순번1은 시범 생성분 재사용(중복 생성 안 함).

### 참고 / 다음 작업자
- **"최신화/업데이트" 재실행 방법**: 구글시트를 xlsx 로 다시 받고 prep 재생성 후 push.py 실행하면,
  DB 에 이미 있는 코드는 skip 되고 새 순번만 추가됨(증분). 단 **기존 항목의 내용 변경은 반영 안 함**
  (신규 추가만). 수정분까지 반영하려면 별도 로직 필요 — 장군님 요구는 "없는 부분만 추가"라 현 방식과 일치.
- PowerShell 5.1 은 한글 든 .ps1 을 ANSI 로 읽어 깨짐 → 노션 API 작업은 **python(UTF-8)**으로 할 것.
- Notion File Upload 는 Notion-Version 2022-06-28 에서 정상 동작 확인.
