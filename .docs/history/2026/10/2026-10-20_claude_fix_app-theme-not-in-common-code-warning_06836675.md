# 앱에 설정된 테마가 공통코드에 없으면 경고 — 원본 블록 이식

- 작성 2026-10-20 · 세션 06836675 · type=fix · TODO 1B-1
- 지시: 장군님 2026-10-19 (화면 캡처로 전달) 「앱을 편집 모드로 열 때, 그 앱에 설정된 테마가
  지금 서버에 없으면 경고 메시지를 띄운다 — 원본(WS3.0.0)에 이 로직이 있으니 원본을 보고 작업한다」

## 1. 원본 — 통째로 빠져 있었다

원본 `U4A_WS_DESIGN/design/js/main.js` 593~611행 (작성자 pes, 2026-09-07 / 2026-10-01 주석):

```js
if(oAPP.common.checkWLOList("C", "UHAK901500") === true){
  var _theme = oAPP.DATA.APPDATA.S_0010.UITHM || "";
  var _aTheme = oAPP.attr.S_CODE.UA007 || [];
  if(_theme !== "" && _aTheme.findIndex( item => item.FLD01 === _theme && item.FLD03 === "X" ) === -1){
    //006 현재 어플리케이션에 설정된 테마 &1가 공통코드에 존재하지 않습니다.
    parent.showMessage(sap, 20, "W", parent.WSUTIL.getWsMsgClsTxt("", "ZMSG_WS_COMMON_002", "006", _theme));
  }
}
```

자리는 **앱 정보 검색 완료 콜백 안**, 미리보기 화면 구성(`loadPreviewFrame`)과 세션 랜덤키 얻기 **바로 뒤**.
우리 사본에는 이 블록이 **한 줄도 없었다**(`UHAK901500` 전수 검색 0건).

## 2. 이식한 것 — `www/ws30/ws10_20/js/ws_html5_ws20_data.js` 1곳

원본 그대로 옮기고 두 가지만 바꿨다.

| 원본 | 이식본 | 까닭 |
|---|---|---|
| `parent.showMessage(sap, 20, "W", …)` | `parent.showMessage(null, 20, "W", …)` | HTML5 에 `sap` 이 없다(전 호출부 동일 관행) |
| (try/catch 없음) | try/catch + `[DMAIN-001]` | 여기서 터지면 **앱 열기가 통째로 깨진다**. 우리 예외 표준(.analy/19) |

경고를 띄울 때 `U4ALOG.warn` 한 줄도 같이 남긴다(로그 규칙).
오류 코드 접두 `W20D` 를 `.works/DEV_STANDARD_오류처리.md` 사전에 등록하고 파일 1행에 주석을 달았다.

## 3. 의존성 — 전부 있는 것을 확인

| 쓰는 것 | 어디 있나 |
|---|---|
| `oAPP.common.checkWLOList` | `js/ws_html5_shell.js:326`(뒤에 로드돼 이김) · `js/ws_common.js:4043` |
| `oAPP.DATA.APPDATA.S_0010.UITHM` | 미리보기가 실제로 쓴다 — `design/preview/index.js:4624` |
| `oAPP.attr.S_CODE.UA007` | `design/js/callDAMISampleDownloadPopup.js:346` 에서 쓴다 |
| `parent.showMessage` · `parent.WSUTIL.getWsMsgClsTxt` | 전 화면 공통 |

## 4. 아직 안 본 것 · 미검증

- **메시지 `ZMSG_WS_COMMON_002` 의 `006` 이 로컬 메시지 DB 에 등록돼 있는지 확인하지 못했다.**
  DB 조회는 앱이 돌 때만 가능하다. 미등록이면 공통 함수가 키를 그대로 돌려주고, 그 결과를 **가공 없이**
  그대로 띄운다(원본과 같은 계약). 메시지 DB 는 장군님만 넣으신다 — 손대지 않았다.
- `UHAK901500` 이 지금 서버에서 켜져 있는지는 앱에서만 확인된다. 꺼져 있으면 블록 전체가 안 돈다(원본과 같다).
- **앱 테스트 안 했다.**

## 5. 또 밟을 함정

- 이 검사는 **`checkWLOList("C", "UHAK901500")` 가 true 일 때만** 돈다. 경고가 안 뜬다고 바로
  코드를 의심하지 말고 그 값부터 본다.
- 테마 목록은 `S_CODE.UA007` 에서 **`FLD03 === "X"`(사용 중) 인 것만** 유효하다. 목록에 있어도
  그 표시가 없으면 「없음」으로 친다.

---

# (이어 씀) ★ 처음에 **안 도는 파일**에 넣었다 — 장군님 지적으로 잡음

## 6. 사고 — 사본 `design/js/main.js` 에 넣었는데 그 함수가 HTML5 에선 안 돈다

원본은 `design/js/main.js` 의 `getAppData()` 콜백 안에 이 블록을 둔다. 그래서 우리 사본의 같은 자리에 넣었다.
**그런데 HTML5 는 `oAPP.fn.getAppData()` 를 부르지 않는다.**

근거 — `js/ws_html5_ws20_attr.js` 2246행 주석과 2346행 코드:

```
· 전 테이블 로드 완료 시 원본은 oAPP.fn.getAppData() 를 직접 호출하나,
  HTML5 에선 호출처가 넘긴 fnDone(연속 처리: fnLoadWs20TreeData) 호출.
```

즉 앱 데이터 수신을 맡는 곳은 **`js/ws_html5_ws20_data.js`** 이고, 사본의 그 함수는 **죽은 코드**다.
경고가 안 뜬 이유가 이것이다(장군님 「왜 안뜨냐?」 → 「엉뚱한 소스에 반영하는거 아니냐?」).

## 7. 되돌리고 다시 넣었다

- `www/ws30/ws10_20/design/js/main.js` → **커밋 상태로 원복**(넣었던 블록·진단 줄·파일 1행 주석 전부 제거).
- `www/ws30/ws10_20/js/ws_html5_ws20_data.js` 의 **세션 랜덤키(원본 592행 대응) 바로 뒤**에 넣었다.
  그 바로 위가 원본 588행(미리보기 구성) 대응이라 **원본과 같은 순서·같은 자리**가 된다.
- 오류 코드 접두를 `DMAIN` → **`W20D`** 로 바꿔 사전에 등록했다(사본 파일 접두는 쓰지 않게 됐다).

## 8. 또 밟을 함정 (이번에 새로 안 것 — 가장 중요)

- **원본에 있는 자리라고 해서 사본의 같은 자리가 도는 것이 아니다.**
  WS4.0 은 `design/js/` 사본의 여러 함수를 **안 쓰고** 내 파일(`js/ws_html5_*.js`)로 흐름을 갈아탔다.
  사본에 코드를 넣기 전에 **그 함수가 실제로 호출되는지** 반드시 먼저 확인한다
  (정의가 있다 ≠ 불린다 — `grep "함수명()"` 로 호출처를 세어 본다).
- 이번에 확인한 갈아탄 자리: `getAppData()`(사본) → `fnLoadWs20TreeData`(`js/ws_html5_ws20_data.js`).

## 9. 결과 — 통과 (장군님 확인 2026-10-20 「잘뜬다」)

옮긴 자리(`js/ws_html5_ws20_data.js` 세션 랜덤키 바로 뒤)에서 **경고창이 정상적으로 뜬다.**
TODO 1부-B 에서 이 항목을 닫았고, 「원본이 앱을 열 때 검사하는 것이 테마 말고 더 없는지 전수 조사」가
그 다음 항목으로 올라왔다(장군님 지시 2026-10-20 — 이 건이 끝나면 착수).

메시지 문구는 화면에 제대로 나왔다 → `ZMSG_WS_COMMON_002` 의 `006` 은 로컬 메시지 DB 에 **등록돼 있다**(실측 확인).
