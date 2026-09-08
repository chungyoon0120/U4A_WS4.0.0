/************************************************************************
 * fnEventShortcutRegOpen.js  (HTML5) — WS20 속성 컨텍스트 메뉴 M05 "단축키 등록"
 * ----------------------------------------------------------------------
 * 원본(3파일 1:1 이식):
 *   ① design/attrContextMenu/eventShortcutReg.js  (오케스트레이션 + 검증 _checkValidate)
 *   ② js/utils/keybindingPopup/index.js            (VSCode 스타일 단축키 입력 다이얼로그, UI5→HTML5)
 *   ③ design/attrContextMenu/shortcutList.js       (단축키 등록 허용 UI/이벤트 allow-list)
 *
 *   · 트리거 : 속성 컨텍스트 메뉴(ws_html5_ws20_attr_ctxmenu.js) M05 → oAPP.loadJs 온디맨드 로드 후 호출.
 *              (M05 노출 자체는 WLO(UHAK901289) 패치 서버 + 이벤트(UIATY="2") 편집행에서만 — ctxmenu 규칙.)
 *   · 흐름  : setBusy/락 → allow-list 검증(_checkValidate) → 실패 시 오류박스 후 종료 →
 *              키바인딩 다이얼로그(키 조합 캡처) → [적용] → is_attr.SHCUT 세팅/초기화 → fnWs20AttrChange.
 *
 * ★ 원본 1:1 보존 로직
 *   ① _checkValidate (원본 eventShortcutReg 157행):
 *       - 483(E): 서버이벤트(UIATV) 미입력 + 클라이언트이벤트(T_CEVT) 미등록 → "이벤트 등록 먼저".
 *       - 484(E): 대상 UI(UILIB)+이벤트(UIATT)가 allow-list 에 없음 → "단축키 등록 불가".
 *       - 485(E): 부모 aggregation 이 N건 모델 바인딩(getParentAggrBind) → "모델 바인딩건 등록 불가".
 *   ② SHCUT 구조 = { EVTNM(이벤트명), SCKEY(키조합), ATFOC("X"=단축키 실행 시 대상 UI 포커스) }.
 *       - 등록: is_attr.SHCUT = {객체} → fnWs20AttrChange → attrChgAttrVal 이 prev._T_0015[*].SHCUT 에 커밋
 *               (ws_html5_ws20_attr.js:1788). 저장 시 getAttrChangedData 가 JSON.stringify(ws_html5_ws20_prev.js:367),
 *               재조회 시 JSON.parse(ws_html5_ws20_data.js:250) — 직렬화 왕복은 기존 데이터 계층이 이미 처리.
 *       - 초기화: 키 미입력으로 [적용] → is_attr.SHCUT = "" → 커밋(빈값) → 489 토스트.
 *   ③ 중복 키 점검(원본 keybindingPopup checkDuplShortcutKey): getAttrChangedData() 의 다른 UI/이벤트
 *      SHCUT 과 동일 SCKEY 면 경고 스트립 표시(등록은 막지 않음 — 원본과 동일, 사용처 확인은 Find 팝업 안내).
 *
 * ★ UI5 → HTML5 치환 (SSOT=.analy/16, 형제 M03 fnSameAttrSyncPopupOpen.js 패턴 차용)
 *   - sap.m.Dialog → 네이티브 <dialog class="u4a-dialog">(§2.1 헤더/푸터 48px, §2.5 선두아이콘 accent,
 *     §2.2 헤더드래그/리사이즈/더블클릭 리센터 = 전역 자동 + makeDialogRecenter/Resizable).
 *   - sap.m.Input → "키 캡처 존"(.u4aScCapture) — 입력값을 <kbd> 키캡 칩(.u4aScKbdKey, 단축키 리스트
 *     팝업과 동일 룩)으로 시각화. 키는 window keydown 캡처로만 세팅(직접 타이핑 불가)이라 텍스트 input 대신
 *     전용 존 + getValue/setValue/input 어댑터. sap.m.CheckBox → 옵션 카드(.u4aScOptCard) 안 네이티브
 *     checkbox(accent-color). sap.m.MessageStrip → 스코프 .u4aScStrip. 안내문(472)=아이콘 힌트 블록.
 *     (레이아웃 = 힌트 → 캡처존[hero] → 중복경고 → 옵션카드, 여백으로 그룹 구분. 하드코딩 색 없음.)
 *   - 확인/오류/토스트 → 공통 parent.showMessage(20=오류박스 / 30=Yes·No 확인박스 / 10=토스트).
 *     ★§2.10 top-layer: 다이얼로그(showModal) "위"의 확인은 kind 30(=showModal 박스)이라 위에 뜬다.
 *     검증오류(20)는 다이얼로그 열기 "전", 완료토스트(10)는 닫힌 "후"라 가려지지 않는다.
 *   - 색은 tokens.css 의미토큰만(--accent/--line/--surface-raised/--text/--text-muted), 문구는 메시지키만.
 *
 * ★ 단축키 잠금(원본 대비 조정 근거):
 *   원본은 design iframe 격리라 다이얼로그 오픈 직전 setShortcutLock(false) 해도 iframe 키 캡처가 WS20
 *   단축키와 분리됐다. HTML5(in-window)는 in-window 이므로, 다이얼로그가 "열려 있는" 동안 공통 가드
 *   fnShortCutExeAvaliableCheck(ws_common.js:743, <dialog open> 존재 → 단축키 실행 불가)가 WS20 단축키를
 *   자동 차단한다. + 다이얼로그 자체 window keydown 캡처(preventDefault/stopPropagation)로 이중 방어.
 *   → 원본의 락 시퀀스를 그대로 유지해도 안전. 최종 정리는 fnWs20AttrChange 의 finally(락/busy off).
 ************************************************************************/

(function (window, $, oAPP) {
    "use strict";

    var APPCOMMON = oAPP.common;
    oAPP.fn = oAPP.fn || {};

    var C_DLG_ID = "u4aWsShortcutDlg";

    /* ── 단축키 등록 허용 allow-list ─────────────────────────────────────
     *   원본 design/attrContextMenu/shortcutList.js getShortcutList() 1:1 인라인.
     *   ★SSOT = 위 원본 파일. 원본 목록이 바뀌면 여기도 동기화한다(정적 데이터라 인라인 —
     *     eval 로드 IIFE 컨텍스트에서 ES 모듈 동적 import 경로 불확실성 회피, 형제 데이터 인라인 패턴).
     */
    var C_ALLOW_SHORTCUT = [
        { UILIB: "sap.m.ActionSheet", UIATT: "cancelButtonPress" },
        { UILIB: "sap.m.Button", UIATT: "press" },
        { UILIB: "sap.m.FeedContent", UIATT: "press" },
        { UILIB: "sap.m.FeedListItem", UIATT: "iconPress" },
        { UILIB: "sap.m.FeedListItem", UIATT: "senderPress" },
        { UILIB: "sap.m.GenericTile", UIATT: "press" },
        { UILIB: "sap.m.Image", UIATT: "press" },
        { UILIB: "sap.m.ImageContent", UIATT: "press" },
        { UILIB: "sap.m.Link", UIATT: "press" },
        { UILIB: "sap.m.MenuItem", UIATT: "press" },
        { UILIB: "sap.m.MessagePage", UIATT: "navButtonPress" },
        { UILIB: "sap.m.MessagePopover", UIATT: "activeTitlePress" },
        { UILIB: "sap.m.MessageView", UIATT: "activeTitlePress" },
        { UILIB: "sap.m.NewsContent", UIATT: "press" },
        { UILIB: "sap.m.NumericContent", UIATT: "press" },
        { UILIB: "sap.m.ObjectAttribute", UIATT: "press" },
        { UILIB: "sap.m.ObjectHeader", UIATT: "titleSelectorPress" },
        { UILIB: "sap.m.ObjectHeader", UIATT: "iconPress" },
        { UILIB: "sap.m.ObjectHeader", UIATT: "introPress" },
        { UILIB: "sap.m.ObjectHeader", UIATT: "titlePress" },
        { UILIB: "sap.m.ObjectMarker", UIATT: "press" },
        { UILIB: "sap.m.ObjectNumber", UIATT: "press" },
        { UILIB: "sap.m.ObjectStatus", UIATT: "press" },
        { UILIB: "sap.m.Page", UIATT: "navButtonPress" },
        { UILIB: "sap.m.SegmentedButtonItem", UIATT: "press" },
        { UILIB: "sap.m.SlideTile", UIATT: "press" },
        { UILIB: "sap.m.TabContainer", UIATT: "addNewButtonPress" },
        { UILIB: "sap.m.Token", UIATT: "press" },
        { UILIB: "sap.m.Toolbar", UIATT: "press" },
        { UILIB: "sap.m.UploadCollectionItem", UIATT: "press" },
        { UILIB: "sap.m.UploadCollectionItem", UIATT: "deletePress" },
        { UILIB: "sap.m.semantic.SemanticPage", UIATT: "navButtonPress" },
        { UILIB: "sap.ui.core.Icon", UIATT: "press" },
        { UILIB: "sap.uxap.ObjectPageHeader", UIATT: "markChangesPress" },
        { UILIB: "sap.uxap.ObjectPageHeader", UIATT: "markLockedPress" },
        { UILIB: "sap.uxap.ObjectPageHeader", UIATT: "titleSelectorPress" },
        { UILIB: "sap.uxap.ObjectPageLayout", UIATT: "editHeaderButtonPress" },
        { UILIB: "sap.f.cards.Header", UIATT: "press" },
        { UILIB: "sap.f.cards.NumericHeader", UIATT: "press" },
        { UILIB: "sap.f.ShellBar", UIATT: "menuButtonPressed" },
        { UILIB: "sap.f.ShellBar", UIATT: "homeIconPressed" },
        { UILIB: "sap.f.ShellBar", UIATT: "avatarPressed" },
        { UILIB: "sap.f.ShellBar", UIATT: "productSwitcherPressed" },
        { UILIB: "sap.f.ShellBar", UIATT: "notificationsPressed" },
        { UILIB: "sap.f.ShellBar", UIATT: "navButtonPressed" },
        { UILIB: "sap.f.ShellBar", UIATT: "searchButtonPressed" },
        { UILIB: "sap.f.ShellBar", UIATT: "copilotPressed" },
        { UILIB: "sap.m.FeedListItemAction", UIATT: "press" },
        { UILIB: "sap.m.GenericTag", UIATT: "press" },
        { UILIB: "sap.m.SelectionDetails", UIATT: "actionPress" },
        { UILIB: "u4a.m.VerticalTimeLineItem", UIATT: "itemPress" },
        { UILIB: "sap.suite.ui.commons.MicroProcessFlowItem", UIATT: "press" },
        { UILIB: "sap.suite.ui.commons.networkgraph.ActionButton", UIATT: "press" },
        { UILIB: "sap.suite.ui.commons.networkgraph.Group", UIATT: "headerCheckBoxPress" },
        { UILIB: "sap.suite.ui.commons.networkgraph.Line", UIATT: "press" },
        { UILIB: "sap.suite.ui.commons.networkgraph.Node", UIATT: "press" },
        { UILIB: "sap.suite.ui.commons.networkgraph.Node", UIATT: "headerCheckBoxPress" },
        { UILIB: "sap.suite.ui.commons.ProcessFlow", UIATT: "nodePress" },
        { UILIB: "sap.suite.ui.commons.ProcessFlow", UIATT: "labelPress" },
        { UILIB: "sap.suite.ui.commons.ProcessFlow", UIATT: "headerPress" },
        { UILIB: "sap.suite.ui.commons.ProcessFlowLaneHeader", UIATT: "press" },
        { UILIB: "sap.suite.ui.commons.ProcessFlowNode", UIATT: "press" },
        { UILIB: "sap.suite.ui.commons.statusindicator.StatusIndicator", UIATT: "press" },
        { UILIB: "sap.suite.ui.commons.taccount.TAccountItem", UIATT: "press" },
        { UILIB: "sap.suite.ui.commons.TimelineItem", UIATT: "press" },
        { UILIB: "sap.m.Avatar", UIATT: "press" },
        { UILIB: "sap.suite.ui.microchart.AreaMicroChart", UIATT: "press" },
        { UILIB: "sap.suite.ui.microchart.BulletMicroChart", UIATT: "press" },
        { UILIB: "sap.suite.ui.microchart.ColumnMicroChart", UIATT: "press" },
        { UILIB: "sap.suite.ui.microchart.ComparisonMicroChart", UIATT: "press" },
        { UILIB: "sap.suite.ui.microchart.DeltaMicroChart", UIATT: "press" },
        { UILIB: "sap.suite.ui.microchart.HarveyBallMicroChart", UIATT: "press" },
        { UILIB: "sap.suite.ui.microchart.LineMicroChart", UIATT: "press" },
        { UILIB: "sap.suite.ui.microchart.RadialMicroChart", UIATT: "press" },
        { UILIB: "sap.suite.ui.microchart.StackedBarMicroChart", UIATT: "press" },
        { UILIB: "sap.suite.ui.microchart.StackedBarMicroChart", UIATT: "press" },
        { UILIB: "sap.m.LinkTileContent", UIATT: "linkPress" },
        { UILIB: "sap.m.ActionSheet", UIATT: "cancelButtonTap" },
        { UILIB: "sap.m.Button", UIATT: "tap" },
        { UILIB: "sap.m.Image", UIATT: "tap" },
        { UILIB: "sap.m.Page", UIATT: "navButtonTap" },
        { UILIB: "sap.f.Avatar", UIATT: "press" },
        { UILIB: "sap.f.semantic.AddAction", UIATT: "press" },
        { UILIB: "sap.f.semantic.CloseAction", UIATT: "press" },
        { UILIB: "sap.f.semantic.CopyAction", UIATT: "press" },
        { UILIB: "sap.f.semantic.DeleteAction", UIATT: "press" },
        { UILIB: "sap.f.semantic.DiscussInJamAction", UIATT: "press" },
        { UILIB: "sap.f.semantic.ExitFullScreenAction", UIATT: "press" },
        { UILIB: "sap.f.semantic.FavoriteAction", UIATT: "press" },
        { UILIB: "sap.f.semantic.FlagAction", UIATT: "press" },
        { UILIB: "sap.f.semantic.FooterMainAction", UIATT: "press" },
        { UILIB: "sap.f.semantic.FullScreenAction", UIATT: "press" },
        { UILIB: "sap.f.semantic.MessagesIndicator", UIATT: "press" },
        { UILIB: "sap.f.semantic.NegativeAction", UIATT: "press" },
        { UILIB: "sap.f.semantic.PositiveAction", UIATT: "press" },
        { UILIB: "sap.f.semantic.PrintAction", UIATT: "press" },
        { UILIB: "sap.f.semantic.SendEmailAction", UIATT: "press" },
        { UILIB: "sap.f.semantic.SendMessageAction", UIATT: "press" },
        { UILIB: "sap.f.semantic.ShareInJamAction", UIATT: "press" },
        { UILIB: "sap.f.semantic.TitleMainAction", UIATT: "press" },
        { UILIB: "sap.m.ActionListItem", UIATT: "press" },
        { UILIB: "sap.m.ActionListItem", UIATT: "detailPress" },
        { UILIB: "sap.m.ColumnListItem", UIATT: "detailPress" },
        { UILIB: "sap.m.ColumnListItem", UIATT: "press" },
        { UILIB: "sap.m.CustomListItem", UIATT: "press" },
        { UILIB: "sap.m.CustomListItem", UIATT: "detailPress" },
        { UILIB: "sap.m.CustomTile", UIATT: "press" },
        { UILIB: "sap.m.DisplayListItem", UIATT: "detailPress" },
        { UILIB: "sap.m.DisplayListItem", UIATT: "press" },
        { UILIB: "sap.m.FacetFilterItem", UIATT: "detailPress" },
        { UILIB: "sap.m.FacetFilterItem", UIATT: "press" },
        { UILIB: "sap.m.FeedListItem", UIATT: "detailPress" },
        { UILIB: "sap.m.FeedListItem", UIATT: "press" },
        { UILIB: "sap.m.GroupHeaderListItem", UIATT: "detailPress" },
        { UILIB: "sap.m.GroupHeaderListItem", UIATT: "press" },
        { UILIB: "sap.m.InputListItem", UIATT: "press" },
        { UILIB: "sap.m.InputListItem", UIATT: "detailPress" },
        { UILIB: "sap.m.NotificationListGroup", UIATT: "press" },
        { UILIB: "sap.m.NotificationListGroup", UIATT: "detailPress" },
        { UILIB: "sap.m.NotificationListItem", UIATT: "press" },
        { UILIB: "sap.m.NotificationListItem", UIATT: "detailPress" },
        { UILIB: "sap.m.ObjectListItem", UIATT: "press" },
        { UILIB: "sap.m.ObjectListItem", UIATT: "detailPress" },
        { UILIB: "sap.m.OverflowToolbar", UIATT: "press" },
        { UILIB: "sap.m.OverflowToolbarButton", UIATT: "press" },
        { UILIB: "sap.m.StandardListItem", UIATT: "detailPress" },
        { UILIB: "sap.m.StandardListItem", UIATT: "press" },
        { UILIB: "sap.m.StandardTile", UIATT: "press" },
        { UILIB: "sap.m.StandardTreeItem", UIATT: "press" },
        { UILIB: "sap.m.StandardTreeItem", UIATT: "detailPress" },
        { UILIB: "sap.m.semantic.AddAction", UIATT: "press" },
        { UILIB: "sap.m.semantic.CancelAction", UIATT: "press" },
        { UILIB: "sap.m.semantic.DeleteAction", UIATT: "press" },
        { UILIB: "sap.m.semantic.DetailPage", UIATT: "navButtonPress" },
        { UILIB: "sap.m.semantic.DiscussInJamAction", UIATT: "press" },
        { UILIB: "sap.m.semantic.EditAction", UIATT: "press" },
        { UILIB: "sap.m.semantic.FavoriteAction", UIATT: "press" },
        { UILIB: "sap.m.semantic.FilterAction", UIATT: "press" },
        { UILIB: "sap.m.semantic.FlagAction", UIATT: "press" },
        { UILIB: "sap.m.semantic.ForwardAction", UIATT: "press" },
        { UILIB: "sap.m.semantic.FullscreenPage", UIATT: "navButtonPress" },
        { UILIB: "sap.m.semantic.GroupAction", UIATT: "press" },
        { UILIB: "sap.m.semantic.MainAction", UIATT: "press" },
        { UILIB: "sap.m.semantic.MasterPage", UIATT: "navButtonPress" },
        { UILIB: "sap.m.semantic.MessagesIndicator", UIATT: "press" },
        { UILIB: "sap.m.semantic.MultiSelectAction", UIATT: "press" },
        { UILIB: "sap.m.semantic.NegativeAction", UIATT: "press" },
        { UILIB: "sap.m.semantic.OpenInAction", UIATT: "press" },
        { UILIB: "sap.m.semantic.PositiveAction", UIATT: "press" },
        { UILIB: "sap.m.semantic.PrintAction", UIATT: "press" },
        { UILIB: "sap.m.semantic.SaveAction", UIATT: "press" },
        { UILIB: "sap.m.semantic.SendEmailAction", UIATT: "press" },
        { UILIB: "sap.m.semantic.SendMessageAction", UIATT: "press" },
        { UILIB: "sap.m.semantic.ShareInJamAction", UIATT: "press" },
        { UILIB: "sap.m.semantic.ShareMenuPage", UIATT: "navButtonPress" },
        { UILIB: "sap.m.semantic.SortAction", UIATT: "press" },
        { UILIB: "sap.tnt.ToolHeader", UIATT: "press" },
        { UILIB: "sap.uxap.AnchorBar", UIATT: "press" },
        { UILIB: "sap.uxap.ObjectPageHeaderActionButton", UIATT: "press" },
        { UILIB: "sap.f.semantic.EditAction", UIATT: "press" },
        { UILIB: "sap.m.CustomTreeItem", UIATT: "press" },
        { UILIB: "sap.m.CustomTreeItem", UIATT: "detailPress" },
        { UILIB: "u4a.m.ImageMarkArea", UIATT: "press" },
        { UILIB: "u4a.m.TabContainer", UIATT: "addNewButtonPress" },
        { UILIB: "sap.f.GridListItem", UIATT: "press" },
        { UILIB: "sap.f.GridListItem", UIATT: "detailPress" },
        { UILIB: "u4a.m.BadgeButton", UIATT: "press" },
        { UILIB: "sap.gantt.simple.ContainerToolbar", UIATT: "press" },
        { UILIB: "sap.gantt.simple.ContainerToolbar", UIATT: "birdEyeButtonPress" },
        { UILIB: "sap.m.ActionListItem", UIATT: "detailTap" },
        { UILIB: "sap.m.ActionListItem", UIATT: "tap" },
        { UILIB: "sap.m.ColumnListItem", UIATT: "tap" },
        { UILIB: "sap.m.ColumnListItem", UIATT: "detailTap" },
        { UILIB: "sap.m.CustomListItem", UIATT: "tap" },
        { UILIB: "sap.m.CustomListItem", UIATT: "detailTap" },
        { UILIB: "sap.m.DisplayListItem", UIATT: "tap" },
        { UILIB: "sap.m.DisplayListItem", UIATT: "detailTap" },
        { UILIB: "sap.m.FacetFilterItem", UIATT: "tap" },
        { UILIB: "sap.m.FacetFilterItem", UIATT: "detailTap" },
        { UILIB: "sap.m.FeedListItem", UIATT: "detailTap" },
        { UILIB: "sap.m.FeedListItem", UIATT: "tap" },
        { UILIB: "sap.m.GroupHeaderListItem", UIATT: "detailTap" },
        { UILIB: "sap.m.GroupHeaderListItem", UIATT: "tap" },
        { UILIB: "sap.m.InputListItem", UIATT: "detailTap" },
        { UILIB: "sap.m.InputListItem", UIATT: "tap" },
        { UILIB: "sap.m.NotificationListGroup", UIATT: "detailTap" },
        { UILIB: "sap.m.NotificationListGroup", UIATT: "tap" },
        { UILIB: "sap.m.NotificationListItem", UIATT: "detailTap" },
        { UILIB: "sap.m.NotificationListItem", UIATT: "tap" },
        { UILIB: "sap.m.ObjectListItem", UIATT: "detailTap" },
        { UILIB: "sap.m.ObjectListItem", UIATT: "tap" },
        { UILIB: "sap.m.OverflowToolbarButton", UIATT: "tap" },
        { UILIB: "sap.m.StandardListItem", UIATT: "tap" },
        { UILIB: "sap.m.StandardListItem", UIATT: "detailTap" },
        { UILIB: "sap.m.StandardTreeItem", UIATT: "detailTap" },
        { UILIB: "sap.m.StandardTreeItem", UIATT: "tap" },
        { UILIB: "sap.uxap.ObjectPageHeaderActionButton", UIATT: "tap" }
    ];

    /* ── 헬퍼 ───────────────────────────────────────────────────────── */
    function _fa(s) { return '<i class="fa-solid fa-' + s + '"></i>'; }
    function _el(tag, cls, txt) {
        var o = document.createElement(tag);
        if (cls) { o.className = cls; }
        if (typeof txt !== "undefined") { o.textContent = txt; }
        return o;
    }
    // ZMSG_WS_COMMON_001 (470~476/483~489/003/056/232/328) — 원본과 동일하게 첫 인자 언어="" (Workspace 기본).
    //   가변 인자(&1/&2 치환)는 원본 getWsMsgClsTxt(...) 그대로 위임. 미조회(코드 반환)면 키 노출(임의문구 금지).
    function _wsC(sNr) {
        var aRest = Array.prototype.slice.call(arguments, 1);
        try {
            var s = parent.WSUTIL.getWsMsgClsTxt.apply(parent.WSUTIL, ["", "ZMSG_WS_COMMON_001", sNr].concat(aRest));
            if (s && s.indexOf("|") === -1) { return s; }
        } catch (e) { }
        return sNr;
    }
    // 편집 모드(원본 _sAppInfo.IS_EDIT==="X") — HTML5 SSOT = 속성 모델 IS_EDIT===true (ctxmenu/M03 동일).
    function _isEdit() {
        try { return oAPP.attr.oModel.oData.IS_EDIT === true; } catch (e) { return false; }
    }
    // 토스트(§2.4 공통 정중앙) — 다이얼로그가 닫힌 후에만 사용(§2.10 top-layer).
    function _toast(sType, sText) {
        if (!sText) { return; }
        try { parent.showMessage(null, 10, sType || "I", sText); } catch (e) { }
    }

    /************************************************************************
     * 단축키 등록전 가능여부 점검 — 원본 eventShortcutReg._checkValidate 1:1.
     *   반환 { RETCD:"E"|"" , RTMSG }.
     ************************************************************************/
    function _checkValidate(is_attr) {

        var sRes = { RETCD: "", RTMSG: "" };

        //클라이언트 이벤트 존재 확인.
        var aCevt = [];
        try { aCevt = oAPP.DATA.APPDATA.T_CEVT || []; } catch (e) { aCevt = []; }
        var sCevt = aCevt.find(function (a) { return a.OBJID === is_attr.OBJID + is_attr.UIASN; });

        //서버이벤트(UIATV) 미입력 + 클라이언트 이벤트 미등록 → 이벤트 등록 먼저.
        if (is_attr.UIATV === "" && typeof sCevt === "undefined") {
            sRes.RETCD = "E";
            //483 이벤트 등록을 먼저 진행하십시오
            sRes.RTMSG = _wsC("483");
            return sRes;
        }

        //대상 UI 정보(UILIB) 조회.
        var sUiInfo = null;
        try { sUiInfo = oAPP.fn.getTreeData(is_attr.OBJID); } catch (e) { }
        var sUILIB = sUiInfo ? sUiInfo.UILIB : "";

        //단축키 등록이 가능한 UI + 이벤트 조합(allow-list) 확인.
        var iAllow = C_ALLOW_SHORTCUT.findIndex(function (item) {
            return item.UILIB === sUILIB && item.UIATT === is_attr.UIATT;
        });
        if (iAllow === -1) {
            sRes.RETCD = "E";
            //484 &1 이벤트에 단축키 등록처리를 할 수 없습니다.
            sRes.RTMSG = _wsC("484", is_attr.UIATT);
            return sRes;
        }

        //부모 aggregation 의 N건 모델 바인딩 여부(getParentAggrBind 은 비-라이브 객체에 안전 — early return).
        var sModel;
        try {
            var oPrev = (oAPP.attr.prev && oAPP.attr.prev[is_attr.OBJID]) ? oAPP.attr.prev[is_attr.OBJID] : null;
            sModel = oAPP.fn.getParentAggrBind(oPrev);
        } catch (e) { sModel = undefined; }
        if (typeof sModel !== "undefined" && sModel !== "") {
            sRes.RETCD = "E";
            //485 모델 바인딩 처리된 경우 이벤트의 단축키 등록을 처리할 수 없습니다.
            sRes.RTMSG = _wsC("485");
            return sRes;
        }

        return sRes;
    }

    /************************************************************************
     * 중복 단축키 점검 — 원본 keybindingPopup.checkDuplShortcutKey 1:1.
     *   현재 UI/이벤트를 제외한 다른 등록건 중 동일 SCKEY 존재 시 true.
     *   getAttrChangedData 는 SHCUT 을 JSON string 으로 반환(prev.js:367) → parse. (object 혼입 방어 포함)
     ************************************************************************/
    function _checkDupl(sKey, sPre) {
        var a15;
        try { a15 = oAPP.fn.getAttrChangedData(); } catch (e) { a15 = []; }
        if (!a15 || a15.length === 0) { return false; }

        //단축키 등록건만 발췌.
        a15 = a15.filter(function (item) { return item.SHCUT; });
        if (a15.length === 0) { return false; }

        for (var i = 0, l = a15.length; i < l; i++) {
            var s = a15[i];
            //단축키 팝업을 호출한 UI 의 이벤트와 같은건이면 skip.
            if (sPre.OBJID === s.OBJID && sPre.UIATT === s.UIATT) { continue; }

            var sc = s.SHCUT;
            if (typeof sc === "string") { try { sc = JSON.parse(sc); } catch (e) { continue; } }
            if (sc && sc.SCKEY === sKey) { return true; }
        }
        return false;
    }

    /************************************************************************
     * 키 조합 문자열 구성 — 원본 keybindingPopup.buildKeyString 1:1.
     ************************************************************************/
    function _buildKeyString(e) {
        var parts = [];

        //1. Modifier 상태.
        if (e.ctrlKey) { parts.push("Ctrl"); }
        if (e.shiftKey) { parts.push("Shift"); }
        if (e.altKey) { parts.push("Alt"); }
        if (e.metaKey) { parts.push("Meta"); }

        //2. Modifier 키 목록.
        var modifierKeys = [
            "Control", "Shift", "Alt", "Meta",
            "ControlLeft", "ControlRight", "ShiftLeft", "ShiftRight", "AltLeft", "AltRight"
        ];

        //3. 실제 눌린 키.
        if (modifierKeys.indexOf(e.key) === -1) {
            var key = e.key;

            //영문 소문자 → 대문자.
            if (key.length === 1) { key = key.toUpperCase(); }

            //특수 키 매핑(Space 등).
            var map = {
                " ": "Space",
                "ArrowUp": "ArrowUp", "ArrowDown": "ArrowDown",
                "ArrowLeft": "ArrowLeft", "ArrowRight": "ArrowRight",
                "Escape": "Escape", "Enter": "Enter", "Backspace": "Backspace", "Tab": "Tab"
            };
            if (map[key]) { key = map[key]; }

            parts.push(key);
        }

        return parts.join("+");
    }

    /************************************************************************
     * 키 조합 문자열 → <kbd> 키캡 칩 (예: "Ctrl+Shift+A" → [Ctrl] + [Shift] + [A]).
     *   단축키 리스트 팝업(fnKeyboardShortcutPopupOpen.js lf_buildKbd)과 동일 룩으로 통일.
     ************************************************************************/
    function _buildKbd(sKey) {
        var oWrap = _el("span", "u4aScKbdKeys");
        var aParts = String(sKey || "").split("+");
        aParts.forEach(function (p, idx) {
            if (idx > 0) {
                var oPlus = _el("span", "u4aScKbdPlus", "+");
                oWrap.appendChild(oPlus);
            }
            var oKbd = document.createElement("kbd");
            oKbd.className = "u4aScKbdKey";
            oKbd.textContent = p;
            oWrap.appendChild(oKbd);
        });
        return oWrap;
    }

    /************************************************************************
     * 키바인딩 다이얼로그 — 원본 keybindingPopup.openKeybindingDialog 1:1(UI5→네이티브).
     *   반환: Promise<{ ACTCD:"APPLY"|"CANCEL", RDATA:{keyBinding,autoFocus}|null }>.
     ************************************************************************/
    function _openKeybindingDialog(sPre) {
        return new Promise(function (resolve) {

            _ensureStyle();

            var bEdit = _isEdit();
            var bResolved = false;

            /* ── 다이얼로그 골격 ── */
            var oDlg = document.createElement("dialog");
            oDlg.id = C_DLG_ID;
            //u4a-compact = 원본 addStyleClass("sapUiSizeCompact") 밀도.
            oDlg.className = "u4a-dialog u4aScDlg u4a-compact";

            //헤더 — keyboard 아이콘(선두=accent 자동, §2.5) + 제목(470 + OBJID - UIATT) + 닫기 X.
            var oHeader = _el("div", "u4a-dialog__header");
            oHeader.innerHTML = _fa("keyboard") + "<span></span>";
            var sTitle = _wsC("470");   // 단축키 등록
            if (sPre && sPre.OBJID && sPre.UIATT) { sTitle += " " + sPre.OBJID + " - " + sPre.UIATT; }
            oHeader.querySelector("span").textContent = sTitle;
            var oX = _el("button", "u4a-btn-icon");
            oX.type = "button";
            oX.innerHTML = _fa("xmark");
            oX.title = _wsC("056");   // 닫기
            oX.addEventListener("click", function () { _finish("CANCEL"); });
            oHeader.appendChild(oX);
            oDlg.appendChild(oHeader);

            //바디.
            var oBody = _el("div", "u4a-dialog__body u4aScBody");

            //(1) 안내 힌트 블록 472 — 아이콘 + 안내문(항상 표시, 부드러운 톤).
            var oHint = _el("div", "u4aScHintBox");
            oHint.innerHTML = _fa("circle-info") + '<span class="u4aScHintTxt u4a-selectable"></span>';
            oHint.querySelector(".u4aScHintTxt").textContent = _wsC("472");
            oBody.appendChild(oHint);

            //(2) 키 캡처 존(hero) — 원본 sap.m.Input 대체. 입력값(sKeyVal)을 kbd 키캡 칩으로 시각화.
            //    키는 window keydown 캡처가 세팅(직접 타이핑 불가) → createField 대신 전용 존을 쓰고
            //    getValue/setValue/input 만 갖춘 어댑터(oField)로 하위 로직(_onKeyDown/Reset/Apply) 무변경.
            var sKeyVal = (sPre && sPre.keyBinding) || "";
            var oCapture = _el("div", "u4aScCapture");
            oCapture.tabIndex = 0;
            oCapture.setAttribute("role", "textbox");
            oCapture.setAttribute("aria-label", _wsC("476"));

            function _renderCapture() {
                oCapture.innerHTML = "";
                if (sKeyVal && sKeyVal.length) {
                    //등록된 키 조합 → kbd 칩.
                    oCapture.classList.add("u4aScCapture--filled");
                    oCapture.appendChild(_buildKbd(sKeyVal));
                } else {
                    //빈 상태 → 키보드 아이콘 + placeholder(476).
                    oCapture.classList.remove("u4aScCapture--filled");
                    var oPh = _el("span", "u4aScCapturePh");
                    oPh.innerHTML = _fa("keyboard") + "<span></span>";
                    oPh.querySelector("span").textContent = _wsC("476");   // 단축키를 입력하십시오
                    oCapture.appendChild(oPh);
                }
            }
            _renderCapture();
            //클릭 시 포커스(키 캡처는 window 리스너라 포커스와 무관하나, "입력 대기" 시각 표시용).
            oCapture.addEventListener("click", function () { try { oCapture.focus(); } catch (e) { } });
            oBody.appendChild(oCapture);

            //createField 호환 어댑터(나머지 로직은 oField.getValue/setValue/input 만 사용).
            var oField = {
                input: oCapture,
                getValue: function () { return sKeyVal; },
                setValue: function (v) { sKeyVal = (v == null ? "" : String(v)); _renderCapture(); }
            };

            //(3) 중복 경고 스트립 487 — 기본 숨김(원본 MessageStrip Information).
            var oStrip = _el("div", "u4aScStrip");
            oStrip.hidden = true;
            oStrip.innerHTML = _fa("circle-info") + "<span></span>";
            oStrip.querySelector("span").textContent = _wsC("487");
            oBody.appendChild(oStrip);

            //(4) 포커스 옵션 카드 — 체크박스(471) + 설명(474)을 하나의 카드로 그룹.
            var oOptCard = _el("div", "u4aScOptCard");
            var oOptTop = _el("label", "u4aScOptTop");
            oOptTop.setAttribute("for", "u4aScAutoFocus");
            var oChk = document.createElement("input");
            oChk.type = "checkbox";
            oChk.className = "u4aScChk";
            oChk.id = "u4aScAutoFocus";
            oChk.checked = !!(sPre && sPre.autoFocus);
            oChk.disabled = !bEdit;   // 원본 editable: IS_EDIT==="X"
            oOptTop.appendChild(oChk);
            oOptTop.appendChild(_el("span", "u4aScOptLbl", _wsC("471")));   // 단축키 실행 시 대상 UI에 포커스 적용 여부
            oOptCard.appendChild(oOptTop);
            oOptCard.appendChild(_el("div", "u4aScOptDesc u4a-selectable", _wsC("474")));   // 설명
            oBody.appendChild(oOptCard);

            oDlg.appendChild(oBody);

            //푸터 — [초기화 328][적용 232 파랑][취소 003 빨강] (원본 Reset/Apply/Cancel, 아이콘+텍스트).
            var oFoot = _el("div", "u4a-dialog__footer u4aScFoot");
            oFoot.appendChild(_el("span", "u4aScFootSpacer"));

            var oReset = _el("button", "u4a-btn u4aScBtn");
            oReset.type = "button";
            oReset.innerHTML = _fa("eraser") + "<span></span>";
            oReset.querySelector("span").textContent = _wsC("328");   // 초기화
            oReset.addEventListener("click", function () {
                //단축키 입력값 + autoFocus 초기화(원본 Reset).
                oField.setValue("");
                oChk.checked = false;
                oStrip.hidden = true;
            });

            var oApply = _el("button", "u4a-btn u4a-btn--emphasized u4aScBtn");
            oApply.type = "button";
            oApply.innerHTML = _fa("check") + "<span></span>";
            oApply.querySelector("span").textContent = _wsC("232");   // 적용
            oApply.addEventListener("click", function () { _onApply(); });

            var oCancel = _el("button", "u4a-btn u4a-btn--negative u4aScBtn");
            oCancel.type = "button";
            oCancel.innerHTML = _fa("xmark") + "<span></span>";
            oCancel.querySelector("span").textContent = _wsC("003");   // 취소
            oCancel.addEventListener("click", function () { _finish("CANCEL"); });

            oFoot.appendChild(oReset);
            oFoot.appendChild(oApply);
            oFoot.appendChild(oCancel);
            oDlg.appendChild(oFoot);

            //ESC → 취소.
            oDlg.addEventListener("cancel", function (e) { e.preventDefault(); _finish("CANCEL"); });

            //드래그(전역 자동)·리센터·리사이즈(§2.2).
            if (window.U4AUI && U4AUI.makeDialogRecenter) { U4AUI.makeDialogRecenter(oDlg, oHeader); }
            if (window.U4AUI && U4AUI.makeDialogResizable) { U4AUI.makeDialogResizable(oDlg, { minW: 420, minH: 300 }); }

            document.body.appendChild(oDlg);
            try { oDlg.showModal(); } catch (e) { }

            //원본 afterOpen: busy off + keydown 캡처 등록 + 입력 포커스.
            try { parent.setBusy && parent.setBusy(""); } catch (e) { }
            _addKeyDown();
            try { oField.input.focus(); } catch (e) { }

            /* ── 키 캡처 (원본 addKeyDown/removeKeyDown/onKeyDown) ── */
            function _addKeyDown() { window.addEventListener("keydown", _onKeyDown, true); }
            function _removeKeyDown() { window.removeEventListener("keydown", _onKeyDown, true); }

            function _onKeyDown(e) {
                //편집 모드가 아니면 무시(원본 IS_EDIT!=="X").
                if (!bEdit) { return; }

                oStrip.hidden = true;

                e.preventDefault();
                e.stopPropagation();

                //반복 입력(꾹 누름) 방지.
                if (typeof e.repeat === "boolean" && e.repeat) { return; }

                switch (e.key) {
                    case "Backspace":
                        oField.setValue("");
                        return;
                    case "Enter":
                        _onApply();
                        return;
                    case "Space":
                        //원본과 동일(참고: e.key 스페이스는 " " 라 이 case 는 실질 미발동 →
                        // 아래 buildKeyString 의 " "→"Space" 매핑으로 Space 조합 등록됨).
                        return;
                }

                var sKey = _buildKeyString(e);

                //중복 단축키 존재 시 경고 스트립 표시(등록은 막지 않음).
                if (_checkDupl(sKey, sPre)) { oStrip.hidden = false; }

                oField.setValue(sKey);
            }

            /* ── 적용 (원본 Apply press) ── */
            function _onApply() {
                //확인 팝업 동안 키 캡처 중단(원본).
                _removeKeyDown();

                var key = oField.getValue();

                //등록/초기화 확인 메시지 분기.
                var sMsg = (key.trim() === "")
                    //475 &1 UI의 & 이벤트에 등록된 단축키를 초기화 하시겠습니까?
                    ? _wsC("475", sPre.OBJID, sPre.UIATT)
                    //473 &1 UI의 & 에 단축키를 등록 하시겠습니까?
                    : _wsC("473", sPre.OBJID, sPre.UIATT);

                //확인 박스(kind 30=showModal → 다이얼로그 위 top-layer).
                _confirm(sMsg, function (bYes) {
                    if (!bYes) {
                        //취소 — 키 캡처 재등록 후 유지(원본). 캡처 존 포커스 복귀("입력 대기" 표시).
                        _addKeyDown();
                        try { oField.input.focus(); } catch (e) { }
                        return;
                    }

                    try { parent.setBusy && parent.setBusy("X"); } catch (e) { }
                    _removeKeyDown();

                    var bFocus = oChk.checked;
                    _finish("APPLY", { keyBinding: key || "", autoFocus: bFocus });
                });
            }

            /* ── 종료(1회 보장) — 키 캡처 해제 + 닫기(전역 close 리스너가 DOM 제거, §2.2) + resolve ── */
            function _finish(sActcd, oRdata) {
                if (bResolved) { return; }
                bResolved = true;
                _removeKeyDown();
                try { if (oDlg.open) { oDlg.close(); } } catch (e) { }
                resolve({ ACTCD: sActcd, RDATA: oRdata || null });
            }
        });
    }

    /* ── 확인 박스 — 원본 parent.showMessage(sap,30,"I",msg,cb) 1:1(Yes/No). ──
     *   kind 30 = 공통 showMessage 의 확인 박스(<dialog>.showModal → top-layer, §2.10). */
    function _confirm(sMsg, fnDone) {
        try {
            parent.showMessage(null, 30, "I", sMsg, function (p) { fnDone(p === "YES"); });
        } catch (e) {
            //폴백 — showMessage 부재 시 안전하게 취소 처리(임의 진행 금지).
            fnDone(false);
        }
    }

    /************************************************************************
     * 공개 진입점 — M05(단축키 등록). 원본 eventShortcutReg default(is_attr) 1:1.
     *   @param {object} is_attr - WS20 속성 행(이벤트 행). SHCUT 을 이 객체에 세팅 후 커밋.
     ************************************************************************/
    oAPP.fn.fnEventShortcutRegOpen = async function (is_attr) {

        if (!is_attr) { return; }

        try { parent.setBusy && parent.setBusy("X"); } catch (e) { }
        try { oAPP.fn.setShortcutLock && oAPP.fn.setShortcutLock(true); } catch (e) { }

        //단축키 등록전 가능여부 점검.
        var sRes = _checkValidate(is_attr);

        //점검 오류 → 오류박스(kind 20) 후 종료(다이얼로그 열기 전이라 top-layer 무관).
        if (sRes.RETCD === "E") {
            try { parent.showMessage(null, 20, "E", sRes.RTMSG); } catch (e) { }
            try { oAPP.fn.setShortcutLock(false); } catch (e) { }
            try { parent.setBusy(""); } catch (e) { }
            return;
        }

        //이전 단축키 등록정보 구성(원본 _sPreShortCut).
        var sPre = { OBJID: is_attr.OBJID, UIATT: is_attr.UIATT };
        var pre = is_attr.SHCUT;
        //SHCUT 은 object(당세션 등록) 또는 JSON string(로드 직후 등) 혼재 가능 → 정규화.
        if (typeof pre === "string" && pre !== "") { try { pre = JSON.parse(pre); } catch (e) { pre = null; } }
        if (pre && typeof pre === "object" && Object.keys(pre).length > 0) {
            sPre.keyBinding = pre.SCKEY;
            sPre.autoFocus = pre.ATFOC === "X";
        }

        //다이얼로그 오픈 전 락 해제(원본). 열려 있는 동안은 공통 가드(<dialog open>)가 WS20 단축키 차단.
        try { oAPP.fn.setShortcutLock(false); } catch (e) { }

        //키바인딩 다이얼로그 호출.
        var oInfo = await _openKeybindingDialog(sPre);

        try { parent.setBusy && parent.setBusy("X"); } catch (e) { }
        try { oAPP.fn.setShortcutLock(true); } catch (e) { }

        //등록(APPLY) 이외 처리(취소/닫기) → 정리 후 종료.
        if (!oInfo || oInfo.ACTCD !== "APPLY") {
            try { oAPP.fn.setShortcutLock(false); } catch (e) { }
            try { parent.setBusy(""); } catch (e) { }
            return;
        }

        //SHORTCUT 정보 초기화.
        is_attr.SHCUT = "";

        //팝업에서 단축키 미입력(초기화) → 빈값 커밋 + 초기화 안내.
        if (oInfo.RDATA.keyBinding === "") {
            //fnWs20AttrChange 가 락/busy off + undo 스냅샷(단일 스택) 처리.
            oAPP.fn.fnWs20AttrChange(is_attr, "");
            //489 단축키를 초기화 했습니다.
            _toast("I", _wsC("489"));
            return;
        }

        //단축키 등록 정보 구성(원본 _sShortCut).
        var sShortCut = {
            EVTNM: is_attr.UIATT,                              //단축키 등록 이벤트 명
            SCKEY: oInfo.RDATA.keyBinding,                     //단축키 입력건
            ATFOC: oInfo.RDATA.autoFocus === true ? "X" : ""   //실행 시 대상 UI 포커스 여부
        };
        is_attr.SHCUT = sShortCut;

        //attribute 입력건 커밋(락/busy off + undo 스냅샷 = fnWs20AttrChange 내부 처리).
        oAPP.fn.fnWs20AttrChange(is_attr, "");

        //488 단축키를 등록했습니다.
        _toast("I", _wsC("488"));
    };

    /************************************************************************
     * 공통 스타일 1회 주입(테마 토큰만 — 하드코딩 색 없음).
     ************************************************************************/
    function _ensureStyle() {
        if (document.getElementById("u4aScStyle")) { return; }
        var oStyle = document.createElement("style");
        oStyle.id = "u4aScStyle";
        oStyle.textContent =
            ".u4aScDlg { width: min(92vw, 460px); max-height: 90vh; padding: 0; display: flex; flex-direction: column; }" +
            ".u4aScDlg .u4a-dialog__header { cursor: move; user-select: none; }" +
            ".u4aScDlg .u4a-dialog__header span { flex: 1 1 auto; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }" +
            // 바디 = 힌트/캡처존/스트립/옵션카드 세로 스택(여백으로 그룹 구분).
            ".u4aScBody { flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; gap: 0.875rem; padding: 1rem; overflow: auto; }" +
            // (1) 안내 힌트 블록 — 아이콘 + 안내문(부드러운 톤, 좌측 accent 바).
            ".u4aScHintBox { display: flex; align-items: flex-start; gap: 0.5rem; padding: 0.625rem 0.75rem; border: 1px solid var(--line); border-left: 3px solid var(--accent); border-radius: 6px; background: var(--surface); }" +
            ".u4aScHintBox > i { color: var(--accent); margin-top: 0.15rem; flex: 0 0 auto; font-size: 0.9rem; }" +
            ".u4aScHintTxt { color: var(--text-muted); line-height: 1.55; font-size: 0.8125rem; white-space: pre-wrap; }" +
            // (2) 키 캡처 존(hero) — 점선 테두리, 포커스 시 accent 실선(입력 대기 표시).
            ".u4aScCapture { display: flex; align-items: center; justify-content: center; min-height: 3.5rem; padding: 0.625rem 0.875rem; border: 1.5px dashed var(--line); border-radius: 8px; background: var(--surface); cursor: pointer; outline: none; transition: border-color .15s ease, background .15s ease; }" +
            ".u4aScCapture:focus { border-color: var(--accent); border-style: solid; background: var(--surface-raised); }" +
            ".u4aScCapture--filled { border-style: solid; }" +
            ".u4aScCapturePh { display: inline-flex; align-items: center; gap: 0.45rem; color: var(--text-muted); font-size: 0.8125rem; }" +
            ".u4aScCapturePh > i { font-size: 0.95rem; }" +
            // kbd 키캡 칩 — 단축키 리스트 팝업(u4aKbdKey)과 동일 룩(3D 키캡).
            ".u4aScKbdKeys { display: inline-flex; align-items: center; gap: 0.35rem; flex-wrap: wrap; justify-content: center; }" +
            ".u4aScKbdKey { display: inline-flex; align-items: center; justify-content: center; min-width: 1.75rem; height: 1.75rem; padding: 0 0.5rem; font-family: inherit; font-size: 0.8125rem; font-weight: 600; line-height: 1; color: var(--text); background: var(--surface-raised); border: 0.0625rem solid var(--divider); border-bottom-width: 0.1875rem; border-radius: 0.375rem; }" +
            ".u4aScKbdPlus { color: var(--text-muted); font-size: 0.8125rem; font-weight: 600; }" +
            // (3) 중복 경고 스트립(Information) — 테마 토큰만.
            ".u4aScStrip { display: flex; align-items: flex-start; gap: 0.5rem; padding: 0.5rem 0.625rem; border: 1px solid var(--line); border-left: 3px solid var(--accent); border-radius: 6px; background: var(--surface-raised); color: var(--text); line-height: 1.45; font-size: 0.8125rem; }" +
            ".u4aScStrip[hidden] { display: none; }" +
            ".u4aScStrip > i { color: var(--accent); margin-top: 0.125rem; flex: 0 0 auto; }" +
            // (4) 포커스 옵션 카드 — 체크(굵은 라벨) + 설명(들여쓴 muted).
            ".u4aScOptCard { display: flex; flex-direction: column; gap: 0.4rem; padding: 0.75rem; border: 1px solid var(--line); border-radius: 6px; background: var(--surface); }" +
            ".u4aScOptTop { display: flex; align-items: center; gap: 0.5rem; cursor: pointer; margin: 0; }" +
            ".u4aScChk { accent-color: var(--accent); margin: 0; flex: 0 0 auto; width: 1rem; height: 1rem; }" +
            ".u4aScChk:disabled { cursor: default; }" +
            ".u4aScOptLbl { color: var(--text); font-weight: 600; font-size: 0.8125rem; }" +
            ".u4aScOptDesc { color: var(--text-muted); line-height: 1.5; font-size: 0.75rem; padding-left: 1.5rem; white-space: pre-wrap; }" +
            // 푸터 — 아이콘+텍스트.
            ".u4aScFoot { display: flex; gap: 0.5rem; align-items: center; }" +
            ".u4aScFootSpacer { flex: 1 1 auto; }" +
            ".u4aScBtn { display: inline-flex; align-items: center; gap: 0.375rem; }";
        document.head.appendChild(oStyle);
    }

})(window, jQuery, oAPP);
