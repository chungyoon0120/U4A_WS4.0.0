# 별창 parent 제거 17번 — 오류 페이지 에디터 창 (2026-10-14)

## 요청

장군님 지시 — 별창 parent 제거 남은 10곳(17~26번)을 하나씩. 그 첫 번째가 17번이다.

## 고친 것

| 번호 | 파일 | 무엇 |
|---|---|---|
| 1 | `Popups/errPageEditorPopup/errorPageEditorFrame.html` | 제목줄에 최소화·최대화 버튼 추가(원래 닫기만 있었다) |
| 2 | `Popups/errPageEditorPopup/errorPageEditorFrame.js` | 그 두 버튼 배선. 최대화 상태면 아이콘·tooltip 을 Restore 로 바꾼다 |
| 3 | `js/fnErrorPageEditorPopupOpen.js` | `parent` 지정을 뺐다. 이미 열렸는지 판정을 **OBJTY + browserkey** 로 바꾸고, 최소화 상태면 올린 뒤 포커스 |

8번 기술 문서 창·9번 소스 패턴 창과 같은 짝으로 맞췄다. `node --check` 통과.

## 검증

**아직 안 했다** — 장군님 테스트 대기(`.docs/TODO.md` 맨 위).

## ★ 또 밟을 함정

- **커스텀 제목줄 창에 parent 가 있으면 최소화한 뒤 다시 올릴 길이 없다.** 그래서 parent 를 뗀다.
- parent 를 떼면 `getChildWindows()` 로 못 찾으므로 **이미 열림 판정을 OBJTY + browserkey 로** 바꿔야 한다.
  OBJTY 만 보면 같은 로그인의 다른 메인 창이 띄운 같은 종류 창을 잘못 집는다.
- 쓰지 않게 된 지역 변수 선언 한 줄(`oCurrWin`)은 그대로 뒀다 — 동작과 무관.
