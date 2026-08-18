[변경 사항]

1. bindPopup

- 다음 속성을 바인딩 제외 항목에 추가
  · SAP.UI.UNIFIED.FILEUPLOADER.imageCompressSettings
  · SAP.UI.COMMONS.FILEUPLOADER.imageCompressSettings
  · SAP.M.UPLOADCOLLECTION.imageCompressSettings


2. design

[Aggregation 및 Drag & Drop]

- 추가 가능한 Aggregation을 구성하지 못한 경우
  오류 내용과 메시지를 함께 구성하도록 변경

- Ctrl+D&D로 UI를 복사할 때 모델 바인딩 경로의
  허용 여부를 판단하여 필요한 경로 정보를 초기화하도록 변경

- sap.ui.table.Table의 column Aggregation에 UI를 Drop할 때
  template Aggregation을 기준으로 N건 바인딩 여부를 판단하도록 변경

- Aggregation에 바인딩이 설정된 경우 안내 메시지를 구체화
  기존:
  객체는 이미 Aggregation에 지정되어 있습니다.

  변경:
  &1 Aggregation에 바인딩이 설정되어 있어
  UI를 2건 이상 추가할 수 없습니다.


[Attribute]

- 서버 이벤트 ComboBox에 현재 선택값이 없으면
  해당 값을 항목으로 추가하도록 변경

- ComboBox에서 다른 항목을 선택해도 이전 selectedKey가
  유지되던 문제 수정

- 여러 바인딩·서버 이벤트 팝업을 함께 사용했을 때
  변경 내용이 Attribute에 반영되지 않던 문제 수정

- UI 이름 변경 시 customData에 등록된 OBJID도
  변경된 이름으로 매핑하도록 변경

- 동일 Attribute 동기화 값이 기본값인 경우에도
  Preview UI의 Property에 반영하도록 변경

- Style Class 변경 시 Attribute 변경 처리와
  Preview 반영을 공통 함수로 처리하도록 변경


[Preview]

- 선택된 UI의 Style Class 또는 inline style 변경을
  MutationObserver로 감지하도록 변경

- 선택 DOM뿐 아니라 UI Root DOM까지 감시하도록 변경

- margin 등의 변경으로 UI 위치가 달라지면
  선택 레이어 위치를 다시 계산하도록 변경

- 선택 대상 변경 또는 선택 해제 시
  Style 감시용 MutationObserver를 정리하도록 변경

- Preview에서 UI 선택 시 선택한 UI의 DOM 위치로
  스크롤되도록 변경

- display에서 change로 전환하여 Preview를 다시 구성할 때
  이전 UI 수집 객체를 초기화하도록 변경


[Event Method Popup]

- 팝업 호출 이후에 적용하던 initialFocus를
  팝업 호출 전에 적용하도록 변경


[DataSet Field List Popup]

- parent.sap, parent.oAPP 대신 현재 Scope에서
  sap과 oAPP에 접근하도록 변경

- parent.sendAjax 대신 현재 Scope의 sendAjax를
  사용하도록 변경


[Attribute Preset 설정 팝업]

- UI Attribute 개인화 팝업을 X 버튼 또는 Esc로 종료할 때
  CANCEL action code를 호출처 Callback으로 전달하도록 변경

- CANCEL 처리 시 미리보기 UI의 Attribute 값을
  팝업을 열기 전 값으로 복원


[Insert UI Popup]

- UI 추가 팝업 스크립트 위치를
  design/insertUIPopop/index.js로 변경

- UI 추가 팝업에서 사용하는 공통 메시지 텍스트 구성 추가

- 검색어를 Clear Icon으로 초기화하면
  결과 목록 필터도 해제되도록 변경

- 결과 목록의 UI Guide 기능 열에 최소 너비 적용

- 상속된 Aggregation의 설명을 가진
  원본 라이브러리명을 조회하도록 변경

- 현재 접속 언어의 Aggregation 설명만
  DDLB Tooltip 데이터로 구성하도록 변경

- Dialog 크기 변경 후 Splitter가 부모 영역을 기준으로
  다시 계산되도록 변경

- Dialog 축소 중 0px이 된 Guide 영역을
  마지막 정상 비율로 복원하도록 변경

- UI Guide 렌더링 중 호출처의 공통 Busy를 사용하도록 변경

- 결과 목록에서 기능 버튼을 누른 행을
  Table 선택 상태로 반영하도록 변경

- UI 추가 팝업에서 호출한 샘플을
  비모달·비자식 창으로 실행하도록 변경

- 샘플 검색 파라미터의 중첩 인코딩을 해제하도록 변경

- 결과 목록 이미지 팝업에서 동일한
  메시지 클래스 텍스트를 사용하도록 변경