# 미리보기 변경 이력

이 문서는 미리보기 영역과 관련된 요청, 원인 분석, 수정 사항을 누적 관리하기 위한 기록 파일이다.
이후 미리보기 관련 수정이 발생하면 이 파일에 날짜순으로 계속 추가한다.

## 관리 기준

- 미리보기 관련 요청과 수정 사항은 날짜순으로 추가한다.
- 각 항목은 요청 내용, 원인, 수정 내용, 영향 파일, 검증 결과를 중심으로 기록한다.
- 요구사항과 무관한 리팩토링, 스타일 변경, 동작 변경은 이 문서에 기록하지 않는다.
- 특정 UI 예외 처리가 아니라 공통 로직 수정인 경우, 왜 공통 수정인지 함께 기록한다.
- 기존 정상 동작 로직을 변경한 경우에는 변경 사유와 영향 범위를 반드시 남긴다.

## 2026-06-25

### 요청: `refreshPreview` 이후 RichTextEditor가 정상 출력되지 않음

**요청 내용**

- 미리보기 영역에는 `RichTextEditor`처럼 내부 라이브러리를 통해 늦게 그려지는 UI를 기다리는 로직이 있다.
- UI를 선택하고 `refreshPreview`를 통해 화면을 다시 구성하는 과정에서 `sap.ui.richtexteditor.RichTextEditor`가 정상적으로 화면에 출력되지 않는다.
- 해당 렌더링 대기 흐름을 확인하고 수정한다.

**원인 분석**

- `RichTextEditor`는 UI5 렌더링 이후 TinyMCE와 내부 iframe을 통해 추가 초기화가 진행된다.
- 따라서 일반적인 `onAfterRendering` 시점만으로는 실제 편집기 영역이 완전히 준비됐다고 보기 어렵다.
- `readyRecurring` 이벤트가 발생해도 iframe document의 ready/resize가 아직 완료되지 않은 상태가 있을 수 있다.
- `refreshPreview` 과정에서는 현재 선택된 `RichTextEditor`가 DOM을 갖기 전에 다시 연결될 수 있어, 기존 대기 등록 흐름에서 현재 선택 UI가 누락될 가능성이 있었다.
- 기존 `richTextEditorException()`에서는 `U4A_HIDDEN_AREA`에 숨김 `RichTextEditor` 인스턴스를 미리 생성하고 있었다.
- UI5 RichTextEditor는 숨김 컨테이너에서 생성될 경우 TinyMCE/iframe 초기화가 꼬일 수 있으므로, hidden area preload 방식이 렌더링 불안정의 원인이 될 수 있다.

**수정 내용**

- `design/preview/index.js`
  - `refreshPreview`에서 RichTextEditor 렌더링 대기 호출 시 현재 선택 UI까지 대기 등록할 수 있도록 변경했다.
  - 호출 형태를 `_oRender.renderingRichTextEditor(is_tree, true)`로 변경했다.
  - `richTextEditorException()`에서 `sap.ui.requireSync("sap/ui/richtexteditor/RichTextEditor")`로 라이브러리만 로드하도록 변경했다.
  - `U4A_HIDDEN_AREA`에 hidden `RichTextEditor` 인스턴스를 새로 생성하던 흐름을 제거했다.
  - 이미 hidden area에 남아 있는 `sap.ui.richtexteditor.RichTextEditor` 인스턴스는 정리하도록 했다.
  - hidden area 정리 시 live `childNodes`를 직접 순회하지 않고, 고정된 node snapshot을 만든 뒤 순회하도록 변경했다.

- `design/js/previewRender/setOnAfterRender.js`
  - `renderingRichTextEditor(is_tree, bWaitCurrentBeforeDom)` 형태로 현재 선택 UI의 사전 대기 등록 여부를 받을 수 있게 했다.
  - `refreshRichTextEditor()`에서 현재 대상이 RichTextEditor이고 DOM 생성 전이어도 대기 등록이 가능하도록 했다.
  - `setAfterRendering()`의 RichTextEditor 처리 흐름을 보강했다.
  - native editor API가 이미 준비되어 있고 DOM이 존재하면 즉시 finalize 처리한다.
  - 아직 준비되지 않은 경우 `readyRecurring` 이후 finalize 처리한다.
  - finalize 단계에서 기존 예외 UI 대기 로직을 유지하면서 iframe document ready까지 추가로 기다린다.
  - iframe 준비 이후 guarded `_resizeEditorTinyMCE()`를 animation frame 기준으로 호출해 레이아웃을 보정한다.

**검증 결과**

- `node --check design/preview/index.js` 통과.
- `node --check design/js/previewRender/setOnAfterRender.js` 통과.
- `U4A_HIDDEN_AREA`에 `new sap.ui.richtexteditor.RichTextEditor(...).placeAt(...)`로 hidden 인스턴스를 생성하는 코드가 남아 있지 않음을 확인했다.

### 요청: Label/Text 선택 시 네온 효과가 출력되지 않음

**요청 내용**

- 미리보기 UI 선택 효과에서 다른 UI들은 네온사인 효과가 정상적으로 적용된다.
- `Label`, `Text` UI는 선택 시 네온 효과가 출력되지 않는다.
- `Label`, `Text`에 대한 개별 예외 처리로 해결하지 말고 근본 원인을 수정한다.

**원인 분석**

- `Label`, `Text` 선택 표시는 공통 compact selection layer 흐름을 사용한다.
- CSS의 compact selection layer는 아래 변수를 참조한다.
  - `--u4a-preview-selection-layer-compact-shadow`
  - `--u4a-preview-selection-layer-compact-animation`
- 하지만 JS의 네온 스타일 적용 로직은 아래 변수만 설정하고 있었다.
  - `--u4a-preview-selection-compact-shadow`
  - `--u4a-preview-selection-compact-animation`
- 즉 CSS가 읽는 변수명과 JS가 쓰는 변수명이 맞지 않아 compact layer에 네온 shadow/animation 값이 전달되지 않았다.
- 이 문제는 `Label`, `Text`만의 문제가 아니라 compact selection layer 공통 변수 계약 불일치 문제다.

**수정 내용**

- `design/preview/index.js`
  - `applyPreviewNeonStyleConfig()`에서 기존 compact 변수와 함께 compact layer 변수를 같이 설정하도록 보강했다.
  - 네온 활성 상태와 비활성 상태 모두 아래 변수를 함께 처리하도록 했다.
    - `layer-compact-shadow`
    - `layer-compact-animation`

**검증 결과**

- `node --check design/preview/index.js` 통과.
- `design/preview/index.css`에서 `.u4a_ws_selection_layer[data-u4a-layer-compact="X"]`가 `--u4a-preview-selection-layer-compact-shadow`, `--u4a-preview-selection-layer-compact-animation`을 사용하고 있음을 확인했다.
- 수정은 `Label`, `Text` 예외 처리가 아니라 공통 compact selection layer 변수 처리 보강으로 적용했다.

## 현재 관련 파일

- `design/preview/index.js`
- `design/preview/index.css`
- `design/js/previewRender/setOnAfterRender.js`

