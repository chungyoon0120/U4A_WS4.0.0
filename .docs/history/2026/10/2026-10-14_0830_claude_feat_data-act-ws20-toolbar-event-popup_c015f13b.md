# WS20 툴바·「서버 이벤트 생성」 창에 자동 테스트 식별값(data-act) 달기

- 날짜: 2026-10-14
- 요청: 다른 Claude 세션(u4a-ws4-mcp MAIN) 요청서 `D:\workspace\u4a-ws4-mcp\.docs\request\2026-10-14_ws20-toolbar-popups.md`
- 근거 표준: `.analy/21_화면요소_식별값_표준.md` (§2.0 밖에서 집는 이름은 data-act 하나, §2.3 공통 생성기는 이름을 받는 옵션)

## 한 일

| 파일 | 무엇 |
|---|---|
| `www/ws30/ws10_20/design/js/createEventPopup.js` | 이벤트 이름 칸 `EVTNM` · 설명 칸 `EVTTX` · 각 지우기 `EVTNM_CLEAR`/`EVTTX_CLEAR` · 생성 `CREATE` · 푸터 닫기 `CLOSE` · 머리의 X 를 소문자 `close` → `CLOSE` 로 통일 |
| `www/ws30/ws10_20/js/ws_html5_ws20.js` | 상단 툴바 11개에 act 추가(DISPLAYMODE·CHANGEMODE·SYNTAXCHECK·ACTIVATE·SAVE·MIME·CONTROLLER·MULTIPREV·ADDEVENT·RUNTIME·BINDPOPUP), `_txBtn` 이 act 를 받으면 붙이게, `_txMenuBtn` 이 공통 빌더로 act 전달 |
| `www/ws30/ws10_20/js/ws10_html.js` | 공통 `_buildMenuButton` 이 `cfg.act` 를 받으면 붙인다(안 주면 전과 동일) |
| `www/ws30/ws10_20/theme/u4a-ui.js` | `attachOverflow` — 접혀 ⋯ 메뉴로 간 줄에 원래 버튼의 `data-act` 복사(`one.act` 우선) |

전 파일 `node --check` 통과. 모양·동작은 바꾸지 않았고 값만 더했다.

## 이름을 어떻게 정했나

툴바는 **코드가 쓰는 id 에서 `Btn` 을 떼고 대문자**로 했다(새로 짓지 않음). 11개 모두
소스 전체 grep 으로 **중복 0** 을 확인한 뒤 넣었다.

## 안 한 것 (이름이 겹쳐서 묻는다)

툴바의 아이콘 항목(`iconListBtn` 평평 버튼 / `iconViewerBtn` 드롭다운)에는 **달지 않았다.**
`ICONVIEWER`·`ICONLIST`·`IMAGEICONS` 가 이미 WS20 상단 메뉴(`ws_html5_ws20.js` 의 창 메뉴)와
WS10 메뉴에 쓰이고 있어, 툴바에 같은 값을 또 달면 **한 화면 DOM 에 같은 이름이 둘** 이 된다
(자동 테스트 도구가 엉뚱한 것을 누를 수 있다). 접두를 새로 지어내지 않고 피어에게 물었다.

## 또 밟을 함정

- `_txSplitBtn`·`_txMenuBtn` 둘 다 `id: oCfg.id, icon: oCfg.fa, …` 로 **같은 줄 모양**이다.
  split 쪽은 2026-10-13 에 이미 `act` 를 넘기고 있어, 치환할 때 범위를 안 좁히면 2곳이 잡힌다.
- `data-act` 를 새로 정할 때는 **반드시 소스 전체에서 그 값을 먼저 grep** 한다. 한 화면 DOM 에
  안 쓰는 화면이 `display:none` 으로 같이 남아 있어, 겹치면 조용히 어긋난다.

---

## 이어서 (같은 날 두 번째 요청 — 「집는 이름을 data-act 하나로」)

요청서 `D:\workspace\u4a-ws4-mcp\.docs\request\2026-10-14_all-data-act.md`.
사장님 결정 「절대 id 로 잡지마라 · 기준은 data-act, 없으면 만든다」.

### 한 일 (요청서가 값까지 지정 → 그 값 그대로)

| 어디 | 값 |
|---|---|
| WS20 툴바 11곳 | 앞서 내가 붙인 값을 **요청서 값으로 교정** — SYNTAXCHECK→`SYNTAX` · SAVE→`SAVE_APP` · RUNTIME→`RUNTIMECLS` · BINDPOPUP→`BINDPOP` · DISPLAYMODE→`DISPLAY_MODE`. `iconViewerBtn` 에 `ICONVIEWER` 추가. 내가 짝으로 붙였던 `changeModeBtn` 은 `CHANGE_MODE` 로 모양 통일 |
| WS10 툴바 10곳 (`ws10_html.js`) | `DISPLAY`·`CHANGE`·`COPY_APP`·`DELETE_APP`·`MULTIPREV`·`EXAMPLE`·`NEWWIN` + 앱 이름 칸 `APPNM_INPUT` · SAP T-CODE 칸 `TCODE_INPUT`. 평범한 버튼 분기(`_renderSubHeader`)가 `cfg.act` 를 받으면 붙이게 한 줄 |
| 창 단추 9곳 | MIME 창 `CLOSE`·`MINIMIZE`·`MAXIMIZE` / 아이콘 목록·이미지 아이콘·오류 메시지 창 `CLOSE` / 옵션 창 `APPLY`·`CLOSE`(푸터)·`CLOSE`(타이틀바) |
| `.analy/21` §2.0 | 「밖에서 id 로 집지 않는다」 + 「같은 일에는 같은 값」 두 줄 추가 |

### 일부러 안 바꾼 것

- SAP T-CODE 칸의 **지우기는 `sapTcode_CLEAR` 그대로**. 2026-10-13 에 정해 상대 도구가 이미
  그 이름으로 집고 있다 — 한 번 정한 이름은 바꾸지 않는다(바꾸면 그쪽이 조용히 깨진다).
  요청서의 `TCODE_INPUT` 은 **칸 본체**에만 달았다.
- 요청서 2-4(창·범위를 가리는 이름)는 **`DLG_APPF4`·`ATTR_ROWS` 두 개만 예시**로 주고
  나머지(복사·서버 정보·단축키·브라우저 선택 창, 푸터 2곳, 처리중 막 2곳)는 값이 없다.
  지어내지 않고 값 목록을 받기로 했다(요청서도 급하지 않다고 적혀 있다).

### 이름이 한 화면에 둘이 되는 자리 (상대에게 알림)

- `ICONVIEWER` — WS20 **상단 창 메뉴**와 **툴바 드롭다운** 둘에 생긴다(요청서가 지정한 값).
- `CLOSE` — 옵션 창은 **타이틀바 X** 와 **푸터 닫기** 둘 다 `CLOSE`(요청서가 둘 다 지정).
  둘 중 어느 것이 잡혀도 창이 닫히므로 동작은 같다.

### 또 밟을 함정

- WS10 서브헤더는 `_renderSubHeader` 안에서 **split 과 평범한 버튼이 분기**된다. split 쪽은
  `_renderSplitButton` 이 이미 `act` 를 처리하므로, 평범한 분기에만 한 줄 넣어야 중복이 안 생긴다.

---

## 이어서 (세 번째 요청 — 요청서 6절 ①~④)

| 번호 | 어디 | 값 |
|---|---|---|
| ① | WS10 생성 단추(`appCreateBtn`) | `CREATE_APP` |
| ② | WS30(USP) 툴바 — `js/usp/ws_html5_usp.js` 의 `_txBtn()` 에 한 줄 + 7곳 | `DISPLAY_MODE`·`CHANGE_MODE`·`ACTIVATE`·`SAVE_APP`·`MIME`·`CONTROLLER`·`RUN`(WS20 과 같은 값) |
| ③ | 창이 좁아 ⋯ 안에 새로 만들어지는 T-CODE 칸(`ws10_html.js` 공통버튼 오버플로) | `TCODE_INPUT` |
| ④ | USP 의 T-CODE 칸(UI5 `SearchField`) — `ws_common.js` 의 `onAfterRendering` 에서 이미 잡아 둔 속 `input` 에 한 줄 | `TCODE_INPUT` |

전 파일 `node --check` 통과.

### 알고도 그렇게 한 것 — 같은 이름이 DOM 에 둘 이상

`ACTIVATE`·`SAVE_APP`·`MIME`·`CONTROLLER`·`DISPLAY_MODE`·`CHANGE_MODE`·`RUN`·`TCODE_INPUT` 은
이제 **WS20 과 WS30(USP) 양쪽에** 있다. WS10/WS20/WS30 은 한 프레임에서 안 쓰는 쪽을
`display:none` 으로 숨기므로 **같은 이름이 DOM 에 동시에 남는다.**
상대 창이 「보이는 것만 누른다(꺼진 것·화면이 내려 둔 것은 안 누른다)」고 명시했고, 같은 값을
달라고 지정했으므로 그대로 했다. **상대 도구가 보임 여부를 안 보면 엉뚱한 화면을 누른다.**

### 또 밟을 함정

- UI5 컨트롤(`SearchField`)에는 생성 시점에 속성을 못 붙인다 — UI5 가 DOM 을 다시 그리면
  사라진다. `onAfterRendering` 안에서 `getDomRef("I")` 로 속 `input` 을 잡아 붙여야 한다.
  그 자리가 이미 `maxlength` 때문에 있어 거기에 한 줄만 더했다.
