# getAppData의 중간 TREE 참조 제거

## 요청

`www/ws30/ws10_20/design/js/main.js`의 `oAPP.fn.getAppData`에서 APPDATA.T_0014를 중간 TREE에 매핑한 뒤 setTreeJson으로 변환하는 대신, setTreeData 반환값을 zTREE에 직접 구성한다. 기존 로직은 주석으로 남기고 main.js만 먼저 반영한다.

## 변경 내용

- `oAPP.attr.oModel.oData.TREE = oAPP.DATA.APPDATA.T_0014`를 주석 처리했다.
- `setTreeJson(oModel, "TREE", "OBJID", "POBID", "zTREE")` 호출을 주석 처리했다.
- `setTreeData(APPDATA.T_0014, "POBID", "OBJID", "zTREE")` 반환값을 `oModel.oData.zTREE`에 직접 할당했다.
- 중간 TREE를 경유하지 않는 이유와 setTreeData의 부모/자식 인자 순서를 주석으로 기록했다.
- 기존 setTreeJson/setTreeData 함수 정의와 후속 tree 처리 순서는 유지했다.

## 변경 파일

- 변경: `ws30/ws10_20/design/js/main.js`
- 추가(변경 전 백업): `_backup/get-app-data-direct-tree_20261029_111121/ws30/ws10_20/design/js/main.js`
- 추가: `.docs/history/2026/10/2026-10-29_111121_codex_refactor_get-app-data-direct-tree_01a18302.md`
- 삭제: 없음

## 변경 이유

계층 변환은 T_0014와 setTreeData만으로 가능하므로 모델에 중간 TREE 참조를 구성할 필요가 없다. 이 변경은 중간 참조와 wrapper 호출을 생략하는 것으로, setTreeData 내부의 JSON 전체 복사나 T_0014의 보관 자체를 제거하는 변경은 아니다.

## 영향 범위

main.js의 getAppData 데이터 구성 구간만 변경했다. WS4.0 변환 코드인 ws_html5_ws20_data.js 및 다른 소스는 변경하지 않았다. 이미 다른 코드에서 구성된 TREE를 강제로 삭제하는 로직은 추가하지 않았다. 기존 소스의 로그와 오류 처리는 유지했고 새 로그·서버 통신 경로는 추가하지 않았다.

## 검증

- main.js의 `node --check` 통과.
- 백업의 기존 setTreeJson 및 현재 setTreeData 함수를 추출해, 기존 호출과 변경 호출의 계층 결과를 비교했다.
- 빈 배열, root 한 개, 다단계 계층, 형제 순서, 자식이 먼저 배치된 입력, 여러 root 등 6가지 입력의 JSON 결과가 일치했다.
- 변경 구간에서 TREE getter/setter 또는 setTreeJson 접근 시 오류를 발생시키도록 구성했고 모든 입력이 통과했다.
- 원본 T_0014가 변형되지 않고 반환 node가 별도 객체인 기존 동작을 확인했다.
- main.js에 활성화된 oModel.oData.TREE 할당이 남지 않은 것을 확인했다.
- 실제 SAP 조회 및 UI5 화면 렌더링은 미검증이다.

## 참고 사항

- 작업 시작 시 `.docs/CURRENT.md` 및 관련 분석 문서 작성 이력을 확인했다.
- setTreeJson이 빈 입력에서 수행하던 중간 model.refresh는 더 이상 경유하지 않는다. 후속 designRefershModel 호출은 유지했다. 격리 검증의 빈 입력 비교는 계층 결과에 대한 비교이며 실제 화면의 이벤트 순서까지 검증한 것은 아니다.
- 이전 작업에서 pes-work-checklist 전용 토큰이 없어 조회가 불가능함을 확인했다. 이번 작업에서 토큰 등록이나 별도 Notion 변경은 수행하지 않았다.
- `.docs/CURRENT.md`와 기존 분석 문서·Notion은 변경하지 않았다.
