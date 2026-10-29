# USP 에서 XML 을 열면 빨간 오류가 찍히던 것 — 오류가 아니었다

- 날짜: 2026-10-29
- 지시: 장군님 「이거 왜 찍히는지 좀 확인좀 해줘 저게 진짜 오류인지」 → 「오류가 아니면 빼라」
- 고친 자리: `www/ws30/ws10_20/js/usp/monaco/index.js` — `_getStandardSnippetData` 의 **첫 분기 하나**

## 무엇이 찍혔나

```
[PATH]: www\ws10_20\js\usp\monaco\index.js
=> _getStandardSnippetData
=> Snippet Langage: xml
=> SnippetRootPath: C:\…\www\lib\monaco\snippet\xml
=> 스니펫 루트 경로가 없음!!
```

`console.error` 라 **빨간 X** 로 보였다.

## 판정 — 오류가 아니다

| 스니펫 폴더 | WS4.0 | 원본 WS3.0.0 |
|---|---|---|
| `css` · `html` · `javascript` | 있음 | 있음 |
| **`xml`** | **없음** | **없음** |

스니펫(자동완성 조각) 파일은 **일부 언어에만** 만들어 둔 것이고, **원본도 그 셋뿐**이다.
코드는 「폴더 없으면 그냥 빠져나간다」로 정상 처리한다 — **편집기는 뜨고 XML 편집도 된다.**
없는 것은 자동완성 조각뿐이다.

즉 **예측 가능한 정상 상황을 오류 등급으로 찍고 있었다**(`.analy/19` 예외처리 표준과 어긋남).

## 고친 것

`console.error` 를 걷어내고, **같은 언어는 한 번만** 색 없는 안내로 남긴다.

```js
var _aNoSnippetLogged = [];   // 이미 알린 언어

if (FS.existsSync(sSnippetRootPath) === false) {
    if (_aNoSnippetLogged.indexOf(sLanguage) === -1) {
        _aNoSnippetLogged.push(sLanguage);
        console.log(`[USP monaco] no snippet folder for "${sLanguage}" - completion snippets are skipped (not an error). …`);
    }
    return;
}
```

아예 없애지 않은 이유 — 없애면 나중에 「왜 자동완성이 안 되지?」 할 때 단서가 0이 된다.

## 건드리지 않은 것

같은 함수 안의 나머지 `console.error` **3곳은 그대로** 뒀다. 전부 **진짜 이상한 상황**이다.

- 스니펫 루트가 폴더가 아님
- `FS.statSync` / `FS.readdirSync` 실패
- 스니펫 JSON 이 Array 가 아님 · JSON 파싱 오류

## 또 밟을 함정

- **「파일/폴더가 없다」는 대개 오류가 아니다.** 원본에 원래 없는 것인지부터 본다
  (원본 폴더 `C:\Users\socce\Documents\Github\U4A_WS3.0.0` 에서 같은 자리를 본다).
- 오류 등급은 **그 화면이 실패했는지**로 가른다. 기능이 그대로 돌면 오류가 아니다.
- 같은 상황이 되풀이되는 자리는 **한 번만** 남긴다(로그 표준 — 「같은 이름에 딱 한 번」).

## 남은 것 (지시 없이 하지 않는다)

**XML 스니펫 파일을 새로 만들어 넣는 것**은 원본에 없는 것을 더하는 일이라 별도 지시가 필요하다.
지금은 XML 에 자동완성 조각이 없는 상태 그대로다.

## 미검증

- **앱으로 돌려 보지 않았다.** `node --check` 만 했다. 테스트 = TODO 1-21.
