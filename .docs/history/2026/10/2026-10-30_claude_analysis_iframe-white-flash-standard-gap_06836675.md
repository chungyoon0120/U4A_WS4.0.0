# 별창 안 iframe 이 흰 배경으로 한 번 번쩍이는 것 — 표준은 있는데 그 창만 빠져 있었다

- 날짜: 2026-10-30
- 지시: 장군님 「미리 정의된 css 팝업에서, 우측 상단에 새창 버튼 눌렀을때 뜨는 새창에서, 처음 새창 뜰때
  잠깐 흰배경이 보였다가 다크 테마 적용되는거 같아서 눈에 거슬려 … 정작 "미리 정의된 css 팝업"을 띄울때
  조차 자연스럽게 흰 배경이 안보이는데 … 비교 분석해서 왜 이런 차이가 있는지? 이건 공통 표준 사항 아닌지?」
- **코드는 한 줄도 안 고쳤다.** 조사만 했다.

## 결론 — 장군님 말씀이 맞다. 공통 표준이고, 그 창만 빠졌다

표준은 **이미 문서에 있다** — `.analy/16_공통_화면UX_표준.md` §2.6:

> 「첫 페인트 전 동기 테마 적용 … **iframe 본문이 있는 2단 구조면 iframe 도** 동일하게 —
>  부모가 `iframe.src` 에 `?BGCOL=&THEME=` 를 붙이고 iframe `<head>` 에도 같은 boot 스크립트를 둔다
>  (**안 하면 iframe 만 흰 번쩍**).」

현상까지 그대로 적혀 있다. 지킨 창과 안 지킨 창이 섞여 있었다.

## 두 창 비교 — 바깥 틀은 똑같고, iframe 안쪽만 다르다

두 창 다 **창 틀(BrowserWindow)** 쪽은 완전히 같다:

| | 바깥 팝업 (자연스러움) | 그 안의 새창 (흰 번쩍) |
|---|---|---|
| 여는 코드 | `Popups/ui5CssPopup_v2/control.js` | `Popups/ui5CssPopup_v2/main/views/control.js:820~960` |
| `backgroundColor` = 테마 배경 | ✅ | ✅ |
| `show: false` + 페이지가 `show()` | ✅ | ✅ |
| `u4aSetWindowCss` 로 `html,body` 배경 | ✅ | ✅ |
| iframe URL 에 `BGCOL`·`THEME` 전달 | ✅ | ✅ |

**차이는 iframe 안쪽 문서 한 곳뿐이다.**

| | 바깥 팝업의 iframe<br>`main/index.html` | 새창의 iframe<br>`detail/index.html` |
|---|---|---|
| `<head>` 맨 앞의 배경 보호 | **있다** (아래 4줄) | **없다** |

`main/index.html:11~25` — 주석이 이번 현상을 그대로 적고 있다:

```html
<!-- [흰 플래시 방지] UI5 콘텐츠라 테마 인프라가 없어 로드 전 흰색. 부모(frame.html)의 --boot-bg 를
     첫 페인트 전 문서 배경으로 상속(동일 origin). UI5 렌더 완료되면 UI5 배경이 덮는다. -->
<script>
    (function () {
        try {
            var bg = parent.document.documentElement.style.getPropertyValue("--boot-bg");
            if (bg) {
                var s = document.createElement("style");
                s.textContent = "html,body{background:" + bg + ";}";
                document.head.appendChild(s);
            }
        } catch (e) { }
    })();
</script>
```

`detail/index.html` 의 `<head>`(1~51행)에는 이 스크립트가 없다. 그 파일에도 `BGCOL` 글자는 나오지만
**96행 — `</head>` 뒤**이고, `data-sap-ui-theme` 을 고르는 데 쓰는 값이지 배경 보호가 아니다.

### 왜 UI5 iframe 만 이런가

iframe 안이 **UI5** 면 우리 테마 CSS(`tokens.css` 등)가 없다. UI5 가 자기 테마 CSS 를 받아
다 그릴 때까지 그 문서의 배경은 브라우저 기본값(흰색)이다. 창 틀은 다크인데 **그 위에 덮인
iframe 만 흰색**으로 보인다 → 장군님이 보신 「잠깐 흰 배경」.

우리 테마 CSS 를 `<head>` 의 `<link>` 로 직접 붙이는 문서는 그 CSS 가 **렌더를 막아서**(render-blocking)
흰 화면이 아예 안 그려진다. 그래서 같은 보호가 없어도 멀쩡해 보이는 창이 있다.

## 방식이 세 가지로 갈려 있다 — 이것이 「표준 아닌가」의 실체

| 방식 | 어떻게 | 쓰는 곳 |
|---|---|---|
| ① 부모의 `--boot-bg` 를 읽는다 | `parent.document.documentElement.style.getPropertyValue("--boot-bg")` | `aboutU4APopup/frame.html` · `illustMsgPopup/frame.html` · `ui5CssPopup_v2/main/index.html` |
| ② 자기 URL 쿼리의 `BGCOL` 을 읽는다 | `new URLSearchParams(location.search).get("BGCOL")` | `ui5CssPopup_v2/others/M1·M2/index.html` 등 |
| ③ **아무것도 안 한다** | — | `ui5CssPopup_v2/detail/index.html` ← 이번 건 |

§2.6 이 말하는 것은 ②다(부모가 `iframe.src` 에 붙이고 iframe 이 읽는다). ①은 같은 효과를 내는
다른 길인데, 둘이 섞여 있어 **새로 창을 만들 때 어느 쪽을 따라야 할지 알 수 없다.**

## 규모 — 「후보」까지만. 전수는 아직 아니다

`Popups` 아래 `.html` 중 `boot-bg` 도 `BGCOL` 도 **한 글자도 없는 문서가 39개**다.
다만 이 숫자는 **그대로 믿으면 안 된다**:

- 그중 상당수는 우리 테마 CSS 를 `<link>` 로 붙여 렌더가 막히므로 흰 번쩍이 안 보인다.
- 반대로 `BGCOL` 글자가 있어도 **배경 보호가 아닌 자리**일 수 있다 —
  실제로 `detail/index.html` 이 그랬고, 제 첫 grep 이 그것을 「보호 있음」으로 잘못 셌다.

**그래서 「39곳이 같은 병」이라고 말하지 않는다.** 고치라는 지시를 받으면
창마다 ① iframe 이 있나 ② 그 안이 UI5 인가 ③ `<head>` 에 보호가 있나 를 한 줄씩 읽어
표로 먼저 보고한다.

확실한 것은 **이번 창 1곳**(`ui5CssPopup_v2/detail/index.html`)이다.

## 또 밟을 함정

- **창 틀만 다크로 맞추면 끝난 것이 아니다.** 본문이 iframe 이면 **그 안쪽 문서에도**
  같은 보호를 넣어야 한다. 창 틀은 다크인데 그 위를 iframe 이 흰색으로 덮는다.
- **iframe 안이 UI5 면 특히** — UI5 는 자기 테마 CSS 를 받아야 색이 생기므로 그때까지 흰색이다.
- **`BGCOL` 글자가 있다고 보호된 것이 아니다.** `<head>` 안에서 **첫 페인트 전에** 넣어야 한다.
  `</head>` 뒤에 있는 `BGCOL` 은 다른 용도일 수 있다(이번에 실제로 그랬다).
- 동적으로 붙인 `<link rel=stylesheet>` 는 **렌더를 막지 않는다.** `<head>` 에 태그로 직접 쓴 것만 막는다.

## 아직 안 본 것

- **`findPopup/frame.html` · `ShortCutCreator/frame.html`** — UI5 를 부트하면서 보호가 0 인 문서로
  걸렸지만, 그 창이 실제로 iframe 2단 구조인지, 흰 번쩍이 보이는지는 **확인하지 않았다.**
- `illustMsgPopup/selectSAP.html` · `optionPopup/optionS.html` · `ui5CssPopup/frame.html` 은
  `BGCOL` 글자로 걸렸을 뿐, **그것이 배경 보호인지 확인하지 않았다.**

---

# 고쳤다 — 2026-10-30 (장군님 「1번만 진행」)

## 무엇을 고쳤나

`www/ws30/ws10_20/Popups/ui5CssPopup_v2/detail/index.html` 의 `<head>` 맨 앞에
**부모의 `--boot-bg` 를 첫 페인트 전 문서 배경으로 물려받는 스크립트**를 넣었다.
같은 팝업의 형제(`main/index.html`)에 있던 것과 같은 일을 한다.

**고친 파일은 이 1개뿐이다.** 부모(`detail/frame.html`)는 손대지 않았다.

## 방식을 ② 에서 ① 로 바꿨다 — 영향도 때문이다

조사 직후 저는 **②(iframe 이 자기 주소에서 `BGCOL` 을 읽는 쪽)** 로 통일하자고 제안했다.
`.analy/16` §2.6 이 그 방식이기 때문이다. 그런데 **고치기 전 영향도를 보니 ① 이 더 적게 건드린다.**

| | ① 부모의 `--boot-bg` 를 읽는다 | ② 자기 주소에서 `BGCOL` 을 읽는다 |
|---|---|---|
| 고칠 파일 | **1개** | **2개** |
| 까닭 | 부모가 이미 갖고 있다 (`detail/frame.html:77`) | 부모가 `iframe.src` 에 **안 붙인다** (`frame.html:263` = `oIframe.src = "index.html"`) |
| 같은 팝업 안 선례 | **있다** (`main/index.html`) | 다른 팝업(`others/M1`·`M2`) |

`detail/index.html` 은 `location.search` 를 **한 번도 읽지 않으므로**(실측 0건) ② 로 해도
기존 로직은 안 깨진다. 그래도 파일 2개보다 1개가 낫다고 보고 ① 을 택했다.

★**그래서 「표준을 무엇으로 통일할까」는 아직 안 정했다.** 이번 건은 고쳤지만
방식은 여전히 세 갈래다. 정하는 것은 따로 여쭤야 한다.

## 영향도 — `oIframe.src` 를 다루는 자리 전수

`detail/frame.html` 에서 `detail_frame` 의 `src` 를 다루는 자리는 **3곳**이고,
**값을 넣는 곳은 1곳뿐**이다:

| 줄 | 하는 일 | 이번 수정의 영향 |
|---:|---|---|
| 174 | `if(oIframe.src == "")` — 아직 안 띄웠으면 그만둔다 | 없음 (읽기만) |
| 197 | 같은 검사 | 없음 (읽기만) |
| **263** | `oIframe.src = "index.html"` — **값을 넣는 유일한 곳** | 없음 (주소를 안 바꿨다) |

① 방식은 `src` 를 건드리지 않으므로 세 자리 모두 그대로다.

## 같은 병인 다른 창 — 이 방식으로 잡히는 범위에서는 **0곳**

`scratchpad/scan_pair.py` — 별창 폴더마다 「iframe 을 가진 html」과 그 iframe 이 `.src =` 로
부르는 같은 폴더 안 html 을 짝지어, **안쪽 `<head>` 에 배경 보호가 있나**를 봤다.

| 폴더 | 창틀 | 안쪽 | 창틀 보호 | 안쪽 보호 |
|---|---|---|:---:|:---:|
| `aboutU4APopup` | `index.html` | `frame.html` | O | **O** |
| `ui5CssPopup_v2/detail` | `frame.html` | `index.html` | O | **X → 이번에 넣음** |

★**이것을 「전수」라고 부르면 안 된다.** 이 방식이 잡는 것은
**「같은 폴더 안 html 을 `.src =` 로 부르는 경우」뿐**이다. iframe `src` 를 HTML 에 직접 쓰거나
다른 폴더를 부르는 창은 안 걸린다. 더 넓게 보려면 창마다 하나씩 열어 봐야 한다.

## 오류 코드

새 접두 `UCSSD` 를 쓰고 `.works/DEV_STANDARD_오류처리.md` 접두 사전에 등록했다.
이 자리는 **첫 페인트 전**이라 `U4ALOG` 가 아직 없어 `console.error` 로 남긴다.
실패해도 흰 번쩍만 보이고 기능은 돈다.

## 검증 — **통과** (2026-10-30)

장군님이 `WF1` 을 눌러 보고 **통과**를 알려 주셨다 — 새창이 뜨는 순간 흰색이 지나가지 않는다.
넣은 `<script>` 블록은 떼어내 `node --check` 도 통과했다.
TODO 의 🧪 테스트 항목 절은 이 한 줄뿐이었으므로 목차와 함께 지웠다.

## 또 밟을 함정 (추가)

- **「표준 문서에 적힌 방식」이 늘 적은 변경은 아니다.** 고치기 전에 **부모가 이미 무엇을 갖고 있는지**
  보면 더 짧은 길이 있을 수 있다. 이번에는 부모가 `--boot-bg` 를 이미 갖고 있었다.
- `iframe.src` 에 쿼리를 붙이려거든 **그 `src` 를 읽는 자리**(`src == ""` 검사 등)를 먼저 전수로 본다.

---

# 후속 (같은 날) — **`parent` → `window.top` 으로 바꿨다 · 표준도 그렇게 못 박았다**

## 장군님 결정

> 「iframe일 경우는 최상위 top 영역에 있는 부모의 테마 색상 정보를 구해서 처리한다 이렇게 하면,
>  iframe 의 겹이 많아도 상관 없지않아?」
> 「처음 실행할때 자연스럽게 깜빡임 현상 없이 이질감없게 띄우는게 목적이지
>  그 이후에는 각 화면 영역별 지정된 색상이 나오는건 상관 없다고」

**장군님 말씀이 맞다.** 제가 「미리보기처럼 일부러 다른 배경을 쓰는 자리에서는 top 색이 틀린 색이 된다」고
걱정했는데 **과했다** — 그 색은 **첫 그림에만** 깔리고 화면이 그려지면 그 화면 CSS 가 덮는다.

## 고친 것 — 파일 2개

| 파일 | 전 | 후 |
|---|---|---|
| `ui5CssPopup_v2/detail/index.html` | `parent.document…--boot-bg` | **`window.top.document…--boot-bg`** |
| `ui5CssPopup_v2/main/index.html` | 같음 (한 줄로 압축돼 있던 것을 풀어씀) | 같음 |

오류 코드 접두: `UCSSD`(detail, 이미 있던 것) · **`UCSSM`(main, 새로 등록)**.
`.works/DEV_STANDARD_오류처리.md` 접두 사전에 둘 다 있다.

## ★동작이 **하나 바뀌었다** — 팝업 안(임베드)에서도 이제 색을 깐다

이 두 문서는 **별창일 때와 팝업 안일 때 둘 다** 쓰인다.

| | 전(`parent`) | 후(`window.top`) |
|---|---|---|
| 별창으로 띄울 때 | 창틀이 `--boot-bg` 를 갖고 있어 **깔았다** | 같다(창틀이 곧 top) |
| 팝업 안에 띄울 때 | 부모(팝업)가 안 갖고 있어 **아무것도 안 했다** | top = 메인 WS 창이 갖고 있어 **깐다** |

메인 창은 `ws30/ws10_20/index.html:65` 에서 `--boot-bg` 를 넣는다.
첫 그림에만 깔리고 UI5 가 덮지만, **눈으로 확인해야 한다** — 테스트 `WF3`.

## 표준 문서

`.analy/16` §2.6 의 iframe 규정을 바꿨다.
전: 「부모가 `iframe.src` 에 `?BGCOL=&THEME=` 를 붙이고 iframe `<head>` 에도 같은 boot 스크립트를 둔다」
후: 「**`window.top` 문서의 `--boot-bg` 를 읽어** 첫 페인트 전에 깐다 — 주소에 안 붙여도 되고 겹이 몇이든 닿는다」

## 안 한 것

- **공통으로 빼지 않았다.** 같은 블록이 지금 4곳에 있다(위 2곳 + `aboutU4APopup/frame.html` ·
  `illustMsgPopup/frame.html`). 뒤 2곳은 **읽어서 자기한테도 `setProperty` 로 넣는** 중간 단계라
  동작이 다르고, 첫 페인트 전 인라인이라 외부 파일로 빼면 요청이 하나 더 붙는다. 지시를 받으면 한다.
- `--boot-bg` 를 **넣는** 자리가 54곳인데, 그중 **중간 iframe 이 일부러 다른 색을 넣는 자리가 있는지는
  안 봤다.** 있어도 첫 그림에만 영향이고 바로 덮인다.

## 검증 — **둘 다 통과** (2026-10-30)

- `WF2` 별창으로 띄울 때 — **통과**. 흰색이 지나가지 않는다.
- `WF3` 팝업 안(이번에 동작이 바뀐 쪽) — **통과**. 배경이 평소와 같다.
- 두 블록 모두 떼어내 `node --check` 도 통과.
- TODO 의 🧪 테스트 항목 절은 둘 다 끝나 목차와 함께 지웠다.

## 또 밟을 함정 (추가)

- **`parent` 하나만 보는 코드는 iframe 이 한 겹만 깊어져도 끊긴다.** 배경·테마처럼
  **창 전체가 하나인 값**은 `window.top` 에서 읽는다.
- **`parent` → `top` 으로 바꾸면 「전에는 아무것도 안 하던 자리」가 일을 하기 시작한다.**
  그 문서가 별창과 임베드 양쪽에서 쓰이면 **임베드 쪽 동작이 바뀐다** — 양쪽 다 눌러 봐야 한다.
