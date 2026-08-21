# BR52 Codex 검수 결과

## 판정

**수정필요**

대상 행 강조·헤더 접기·smooth scroll/rAF focus의 기본 흐름은 복원됐지만, 선택 상태가 다음 재렌더에서 소실되고 공통 선택 시각 규약도 일부만 적용됐습니다. 원본 `setAttrFocus`의 Information/Warning 상태도 여전히 누락돼 있습니다.

## 지적

### 1. [P2] 선택 상태가 DOM에만 있어 다음 속성 재렌더에서 즉시 소실됨

- 위치: `www/ws30/ws10_20/js/ws_html5_ws20_attr.js:3252`~`3256`, `www/ws30/ws10_20/js/ws_html5_ws20_attr.js:6224`~`6288`
- BR52는 현재 DOM 행의 `aria-selected`만 바꾸며 선택 UIATK를 상태에 보관하지 않습니다. `fnRenderWs20AttrRows()`는 행을 다시 만들지만 선택키를 읽어 새 행에 `aria-selected`를 복원하지 않습니다.
- 선택된 속성 값을 변경하면 `fnWs20AttrChange`가 `3982`에서 행을 재렌더하고, Show Changed Items 토글도 `5068`에서 재렌더하므로 선택 강조가 사라집니다.
- 원본은 `setSelectedItem`으로 선택한 뒤 동일 UI 내부 갱신에서는 선택을 해제하지 않고, 다른 UI로 전환하는 `updateAttrList`에서만 `removeSelections()`합니다. 즉 동일 UI 내부 재렌더와 객체 전환 초기화를 구분합니다. 현행은 이 구분 없이 모든 행 재렌더에서 선택을 잃습니다. 참고로 `.analy/16_공통_화면UX_표준.md:347`의 선택키·rowHook 규칙은 직접 문맥이 트리이므로 속성표의 독립 의무로 인용하지 않고, 여기서는 원본 parity와 확정 재현 경로를 주근거로 삼습니다.

### 2. [P2] 공통 선택 표시 규약에서 배경색만 적용해 테마 대비와 일관성이 깨짐

- 위치: `www/ws30/ws10_20/WS10/css/ws20.css:1040`~`1043`
- 추가 규칙은 `background: var(--ws20-sel-bg)`만 설정합니다. 공통 규약은 `.analy/16_공통_화면UX_표준.md:465`~`466`과 `theme/shell.css:686`~`691`에서 선택 배경뿐 아니라 `--selected-text`, 굵기, 좌측 3px accent inset을 한 세트로 요구합니다.
- 일부 테마는 이를 대비 계약으로 사용합니다. `horizon_mac.css:34`~`35`, `horizon_suse.css:32`~`33`, `horizon_95.css:36`~`37`은 진한 선택 배경과 흰색 `--selected-text`를 함께 정의합니다. 현재 속성 행은 글자색을 바꾸지 않아 해당 테마에서 가독성이 저하됩니다.
- `aria-selected`를 단 일반 `div`에 공통 행 역할/키보드 선택 의미도 부여하지 않아 시각 상태 외 접근성 의미가 불완전합니다.

### 3. [P2] 원본의 Information/Warning value-state 분기가 누락됨

- 위치: `www/ws30/ws10_20/js/ws_html5_ws20_attr.js:3238`~`3242`
- 현행은 TYPE `E`와 `S`만 처리합니다. 원본 `U4A_WS_DESIGN/design/js/uiAttributeArea.js:8245`~`8261`은 `I`를 `Information`, `W`를 `Warning`으로도 설정합니다.
- 오류 팝업/IPC는 행의 TYPE을 보존해 `setSelectTreeItem(OBJID, UIATK, TYPE)`으로 전달하는 일반 계약이므로, 현재 저장 데이터나 서버 응답에 I/W가 포함되면 대상 이동은 되더라도 value-state가 사라집니다.
- 이는 BR52 신규 라인에서 생긴 회귀는 아니지만, 요청서가 `setAttrFocus`의 원본 동치와 전 호출 경로 검증을 요구하므로 통과 전에 해소해야 할 parity 결함입니다.

## 정상 확인 사항

- 대상 행을 찾은 뒤 선택→헤더 접기→smooth scroll→rAF focus 순서는 원본과 의미상 같습니다. HTML5에서 먼저 행을 재렌더하는 것은 새 DOM 참조를 얻기 위한 필수 적응입니다.
- `_attrHeaderExpanded(false)`의 즉시 scrollTop 조정 뒤 `scrollIntoView({behavior:"smooth", block:"nearest"})`가 최종 대상 행 위치를 잡는 순서는 원본에도 동일하며 정적으로 확정할 충돌은 없습니다.
- rAF focus는 원본과 동일하고 BR34 `_attrVsRefocus`와 직접 같은 실행에서 경쟁하는 필수 재현 경로는 확인되지 않았습니다. 연속 `setAttrFocus`도 rAF FIFO상 마지막 호출 대상이 최종 포커스를 얻습니다.
- TYPE 미지정 일반 이동에서도 대상 컨트롤이 있으면 접기·강조·포커스를 수행하는 것은 원본과 같습니다.
- 색상은 하드코딩하지 않고 `--ws20-sel-bg` → `--selected-bg` 토큰을 사용합니다. 문제는 공통 선택 세트의 일부만 소비한 점입니다.
- `node --check www/ws30/ws10_20/js/ws_html5_ws20_attr.js` 통과.
- `git diff --check -- www/ws30/ws10_20/js/ws_html5_ws20_attr.js www/ws30/ws10_20/WS10/css/ws20.css` 통과.

## 제안

1. `oAPP.attr`에 선택 UIATK를 보관하고 `fnRenderWs20AttrRows`의 행 생성 시 같은 키에 `aria-selected="true"`를 재적용하십시오. UI/OBJID 전환 시에는 원본의 새 테이블 선택 상태에 맞춰 초기화하십시오.
2. 선택 행 CSS에 공통 `--selected-text`, `font-weight`, `box-shadow: inset .1875rem 0 0 0 var(--accent)` 계약을 적용하고 hover에서도 동일하게 유지하십시오.
3. TYPE `I`/`W`를 원본과 동일하게 `Information`/`Warning`으로 매핑하십시오.

## 독립 재검수 취합 (2026-08-21)

사용자 요청에 따라 두 독립 서브에이전트가 기존 지적을 반박하는 방향으로 선택 지속성과 테마/parity를 각각 검증했습니다.

### 선택 지속성

- `fnRenderWs20AttrRows`가 `ROWS.innerHTML=""`로 기존 행 전체를 제거하고, 새 행 생성 시 선택키를 복원하지 않는 것이 재확인됐습니다.
- 확정 소실 경로는 일반 속성 변경(`3982`), Show Changed Items(`5068`), RESET_ATTR 및 autoGrowing/dropAble 후속 재렌더입니다. 사용자가 이동된 속성을 바로 편집하는 정상 동작만으로 강조가 사라집니다.
- 원본은 `setSelectedItem` 선택 후 다른 UI로 전환할 때만 `removeSelections`하므로, P2는 공통 트리 규칙이 아니라 이 원본 parity 차이만으로도 성립합니다.
- rAF/smooth scroll에서는 추가 필수 결함이 발견되지 않았습니다. 연속 호출은 rAF FIFO상 마지막 대상이 최종 포커스를 얻습니다.

### 테마 선택 규약과 TYPE parity

- 선택 CSS는 `.analy/16:465`~`466`의 배경+선택 텍스트+굵기+좌측 accent 세트 중 배경만 소비합니다. Mac·SUSE·95의 진한 배경/흰색 선택 텍스트 조합에서 실제 대비 문제가 생기므로 P2 유지가 확정됐습니다.
- I/W 누락은 활성 `ws_fn_ipc.js:75`~`96`이 서버 행 TYPE을 검증 없이 전달하므로 공개 계약상 도달 가능합니다. 다만 저장소 안의 정적 I/W producer는 확인되지 않았고 BR52 변경 전부터 있던 결함입니다. 넓은 요청 범위(원본 1:1·전 호출 경로)에서는 P2로 유지하되, patch-local 정책이면 별도 이슈로 분리할 수 있습니다.

### 재검수 최종 판정

**수정필요 유지 — BR52 직접 P2 2건(선택 지속성, 선택 테마 규약). I/W 누락 P2는 원본 parity 보완 또는 별도 이슈 분리 필요.**
