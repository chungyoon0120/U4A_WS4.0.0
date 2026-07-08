/************************************************************************
 * Copyright 2020. INFOCG Inc. all rights reserved.
 * ----------------------------------------------------------------------
 * - file Name : fnBindPopupOpen.js
 * - file Desc : WS20 속성 "데이터 바인딩 / 바인딩 해제" 팝업 (HTML5)
 * ----------------------------------------------------------------------
 * [컨버전 메모]
 *  원본: design/js/callBindPopup.js (sap.m.Dialog + sap.ui.table.TreeTable)
 *        속성행/애그리게이션행의 바인딩 아이콘(sap-icon://fallback=link) 클릭 →
 *        uiAttributeArea.js attrIcon1Proc → attrBindProp(CARDI F/R/ST) /
 *        attrBindAggr(CARDI T) → callBindPopup(title, CARDI, callback, UIATK).
 *        · 서버 /getBindAttrData(APPID+CLSNM) → T_ATTR(평면 바인딩 트리).
 *        · lf_setBindEnable: CARDI 별로 선택가능(enable)·상태아이콘·highlight 계산.
 *        · CARDI="F": 필드 선택 시 우측에 추가속성(MPROP P01~P08) 편집 패널.
 *        · Bind → callback(true, node, is_attr) → attrSetBindProp,
 *          Unbind → callback(false, null, is_attr) → attrSetUnbindProp.
 *
 *  HTML5: 인앱 native <dialog class="u4a-dialog"> + 공통 컴포넌트
 *        (U4AUI.createTree(3열 트리테이블) · createField/createSelect · .u4a-splitter ·
 *         makeDialogRecenter/Resizable). 색은 시맨틱 토큰(--state-*)만, 문구는 메시지 키.
 *        ★ 공통 파일(shell.css/bootstrap-skin/u4a-ui.js) 미수정 — 화면 스코프(.u4aBind*)만.
 *
 *  ★ 원본 대비 아키텍처 차이(HTML5 미리보기=W2 미변환):
 *    · 원본의 oAPP.attr.prev[OBJID] 는 미리보기(UI5) UI 인스턴스로 _MODEL/_BIND_AGGR/
 *      __PARENT/getMetadata 를 보유. HTML5 는 미리보기 미로드라 prev[OBJID] 가
 *      "스탠드인"(_T_0015 만 보유, ws_html5_ws20_attr.js _ensurePrev)일 수 있다.
 *    · 바인딩의 단일 출처(SSOT)는 _T_0015(→ fnWs20AttrChange 가 수집). _MODEL/_BIND_AGGR 는
 *      미리보기 빌드시 _T_0015 에서 파생된다(prev.js setModelBind/setAggrBind).
 *    · 따라서 적용(attrSet·attrUnbind 계열)에서 _MODEL/_BIND_AGGR/__PARENT 조작은 "라이브 UI
 *      인스턴스일 때만"(getMetadata 보유) 수행하고, 스탠드인이면 안전 no-op 한다.
 *      → 프로퍼티/애그리게이션 바인딩 값은 _T_0015 에 정확히 영속(+ Save)되며 크래시 없음.
 *        n건 바인딩 자식 전파는 미리보기(W2) 도입 시 _T_0015 에서 재파생된다(원본 1:1 정합).
 *
 *  ★ 재사용(HTML5 기존 헬퍼 — 원본 1:1 이식본):
 *    setTreeData(평면→중첩) · getTreeData · getParentAggrBind · setModelBind · chkBindPath ·
 *    getUiInstanceDOM · fnWs20AttrChange(적용경로) · fnOnCheckIsTrial · attrClearErrorField ·
 *    setShortcutLock · crtStru0015/moveCorresponding(수집).
 *
 *  ★ 로딩: 다른 WS20 속성 팝업(DumpWrite/WebSecurity 등)과 동일 — 아이콘 클릭 시
 *    oAPP.loadJs("fnBindPopupOpen") 로 온디맨드 로드(ws_html5_ws20_attr.js _buildIconCell).
 ************************************************************************/

(function (window, $, oAPP) {
  "use strict";

  var APPCOMMON = oAPP.common;

  var C_DLG_ID = "u4aBindDlg";

  // ── 로컬 헬퍼(다른 WS20 팝업과 동일 컨벤션) ────────────────────────────
  function _fa(s) { return '<i class="fa-solid fa-' + s + '"></i>'; }
  function _el(sTag, sClass, sText) {
    var o = document.createElement(sTag);
    if (sClass) { o.className = sClass; }
    if (typeof sText !== "undefined" && sText !== null) { o.textContent = sText; }
    return o;
  }
  // /U4A/CL_WS_COMMON 메시지(A46/A50/B18 …).
  function _cl(sCode, p1, p2, p3, p4) {
    try { return APPCOMMON.fnGetMsgClsText("/U4A/CL_WS_COMMON", sCode, p1 || "", p2 || "", p3 || "", p4 || ""); }
    catch (e) { return ""; }
  }
  // /U4A/MSG_WS 메시지(081/122/265 …).
  function _mw(sCode, p1, p2, p3, p4) {
    try { return APPCOMMON.fnGetMsgClsText("/U4A/MSG_WS", sCode, p1 || "", p2 || "", p3 || "", p4 || ""); }
    catch (e) { return ""; }
  }
  // ZMSG_WS_COMMON_001 메시지(Workspace 다국어 — 312 "No data Found" 등). MIME _wsTxt 와 동일 경로.
  //   ★ /U4A/MSG_WS 와 키 번호가 겹쳐도 클래스가 달라 문구가 다르다(예: 312 = MSG_WS "심각한 오류"),
  //     "데이터 없음" 은 반드시 이 클래스(ZMSG_WS_COMMON_001)를 써야 한다.
  function _wsTxt(sCode, p1) {
    try {
      var L = (parent.getUserInfo && parent.getUserInfo().LANGU) || "";
      return parent.WSUTIL.getWsMsgClsTxt(L, "ZMSG_WS_COMMON_001", sCode, p1 || "");
    } catch (e) { return ""; }
  }
  // ★ 서버가 "백엔드 로그온 언어(getServerInfo().LANGU)"로 구워 내려준 메시지(RTMSG)를 접속(워크스페이스)
  //   언어(getUserInfo().LANGU)로 재현지화 — 앱 공통 SSOT `WsMsgCls.relocalize` 위임(앱복사 _relocalizeBakedMsg /
  //   WS20 _ws20RelocalizeBaked 와 동일). 두 언어 같거나 못 찾으면 원문 폴백. (예: 백엔드 EN, 워크스페이스 KO)
  function _relocalize(sText) {
    if (typeof sText !== "string" || sText === "") { return sText; }
    try {
      var wsL = (parent.getUserInfo && parent.getUserInfo() || {}).LANGU || "";
      var beL = (parent.getServerInfo && parent.getServerInfo() || {}).LANGU || "";
      if (!wsL || (beL && beL === wsL)) { return sText; }
      var WC = parent.REMOTE && parent.REMOTE.getGlobal("WsMsgCls");
      return (WC && WC.relocalize) ? WC.relocalize(sText, beL, wsL) : sText;
    } catch (e) { return sText; }
  }
  // WS20 편집모드 여부(원본 oAPP.attr.oModel.oData.IS_EDIT 대응).
  function _isEdit() {
    try { var o = APPCOMMON.fnGetModelProperty("/WS20/APP"); return !!(o && o.IS_EDIT === "X"); }
    catch (e) { return false; }
  }
  // 메시지 팝업(원본 parent.showMessage) — WS20 렌더러의 parent 셸 제공.
  function _msg(iKind, sType, sMsg, fnCb) {
    try { parent.showMessage(window.sap || null, iKind, sType, sMsg, fnCb); }
    catch (e) { console.warn("[HTML5][WS20][bind] showMessage 실패:", e && e.message); }
  }
  function _busy(bOn) { try { parent.setBusy && parent.setBusy(bOn ? "X" : ""); } catch (e) { } }

  // 오류 필드 자동 포커스 — 다음 틱 defer(공통 _refocus 패턴, createApplicationPopup 55).
  //   ★동기 focus 는 ①Chromium93 이 change/blur/서버콜백 처리 도중이면 무시 ②busy/모달 top-layer 트랩에 막힘 →
  //   다음 틱(setTimeout 0)에 focus 해야 값-스테이트 메시지(.u4a-field__msg, :focus-within)가 확실히 뜬다.
  //   (마이크로태스크인 await 재개=busy(false) 가 먼저, 매크로태스크 focus 가 뒤 → busy 꺼진 뒤 포커스.)
  function _refocus(oEl) { if (!oEl) { return; } setTimeout(function () { try { oEl.focus(); } catch (e) { } }, 0); }

  // 원본 sap-icon 상태 아이콘 → FA 아이콘 + 시맨틱 상태색 클래스(--state-* 토큰).
  //   status-positive(녹색 Success) / accept(파랑 Information=바인딩됨/선택) / share-2(노랑 Warning=n건 파생).
  function _statIcon(sSrc) {
    switch (sSrc) {
      case "sap-icon://status-positive": return { fa: "circle-check", cls: "u4aBindStat--success" };
      case "sap-icon://accept": return { fa: "circle-check", cls: "u4aBindStat--info" };
      case "sap-icon://share-2": return { fa: "share-nodes", cls: "u4aBindStat--warning" };
      default: return null;
    }
  }
  // highlight(UI5 ValueState) → 행 좌측 상태바 클래스.
  function _rowHl(sHl) {
    switch (sHl) {
      case "Success": return "u4aBindRow--success";
      case "Information": return "u4aBindRow--info";
      case "Warning": return "u4aBindRow--warning";
      case "Error": return "u4aBindRow--error";
      default: return "";
    }
  }

  // ── 모듈 상태 ─────────────────────────────────────────────────────────
  var oUI = null;   // 다이얼로그/트리 컨트롤러/DOM 참조(1회 build 후 재사용)
  var oS = {};      // 세션: { CARDI, fnCallback, UIATK, is_attr, title, TREE, zTREE, selNode, T_MPROP, showAddit }

  /* ====================================================================
   * 1. 아이콘 진입점 + 프리체크 + 팝업 호출(원본 attrIcon1Proc/attrBindProp/attrBindAggr)
   * ==================================================================== */

  /************************************************************************
   * 바인딩 아이콘(sap-icon://fallback) 클릭 진입 — 원본 attrIcon1Proc 1:1(가드).
   *   ws_html5_ws20_attr.js _buildIconCell 이 UIATY 1(프로퍼티)/3(애그리게이션) &&
   *   fallback 아이콘일 때 호출. attrClearErrorField 는 호출부에서 선처리.
   *   · 프리체크: attrChkTreeProp(Tree parent/child 게이트)는 이식(바인딩 전용).
   *     App F4 / selectOption F4 / HTML content 프리체크는 별도 기능 — HTML5 정의시에만
   *     호출(typeof 가드)하고, 미변환이면 skip(해당 아이콘은 대개 inspection 이라 여기 미도달).
   ************************************************************************/
  oAPP.fn.attrBindIcon1Proc = function (is_attr) {

    function _unlock() { try { oAPP.fn.setShortcutLock(false); } catch (e) { } }

    try {
      // appcontainer AppID F4 등(별도 기능 — HTML5 정의시에만).
      if (typeof oAPP.fn.attrAppf4Popup === "function" && oAPP.fn.attrAppf4Popup(is_attr)) { _unlock(); return; }

      // sap.m.Tree / sap.ui.table.TreeTable 의 parent·child 프로퍼티 바인딩 점검(바인딩 전용 게이트).
      if (oAPP.fn.attrChkTreeProp(is_attr)) { _unlock(); _busy(false); return; }

      // selectOption2 F4HelpID / F4HelpReturnFIeld (별도 기능 — HTML5 정의시에만).
      if (typeof oAPP.fn.attrSelOption2F4HelpID === "function" && oAPP.fn.attrSelOption2F4HelpID(is_attr)) { _unlock(); return; }
      if (typeof oAPP.fn.attrSelOption2F4HelpReturnFIeld === "function" && oAPP.fn.attrSelOption2F4HelpReturnFIeld(is_attr)) { _unlock(); return; }

      // sap.ui.core.HTML content 바인딩 점검(별도 기능 — HTML5 정의시에만).
      if (typeof oAPP.fn.attrChkHTMLContent === "function" && oAPP.fn.attrChkHTMLContent(is_attr, true, oAPP.fn.attrBindProp)) { _unlock(); return; }

      // selectOption3 F4HelpReturnFIeld 바인딩시 필요값 점검(별도 기능 — HTML5 정의시에만).
      if (typeof oAPP.fn.attrCheckSelOpt3F4ReturnField === "function" && oAPP.fn.attrCheckSelOpt3F4ReturnField(is_attr)) { _unlock(); _busy(false); return; }

      // 프로퍼티 바인딩 팝업 호출.
      if (oAPP.fn.attrBindProp(is_attr)) { return; }

      // 애그리게이션 바인딩 팝업 호출.
      if (oAPP.fn.attrBindAggr(is_attr)) { return; }

      // 여기까지 왔다 = 어떤 바인딩 분기도 처리하지 않음 → 미구현 특수 액션
      //   (AppID F4=앱 검색 팝업 EXT00000030 / selectOption2·3 F4HelpID·ReturnField /
      //    sap.ui.core.HTML content 바인딩 — attrAppf4Popup 등 HTML5 미정의라 가드 skip).
      //   기존엔 조용히 종료돼 "먹통"으로 보였으므로 작업중 안내 토스트(구 attr.js _wipToast 와 동일 문구).
      console.warn("[W4+ 예정] 바인딩 아이콘 미구현 특수 액션:", is_attr && is_attr.UIATT, "(", is_attr && is_attr.UIATK, ")");
      _msg(10, "I", "아직 작업중입니다");

    } catch (e) {
      console.error("[HTML5][WS20][bind] 바인딩 아이콘 처리 오류:", e && e.message);
    }

    _unlock();
    _busy(false);

  }; // end of attrBindIcon1Proc

  /************************************************************************
   * u4a.m.UsageArea 의 AppID(EXT00000030) icon1(돋보기 inspection) = 앱 검색 팝업(App F4).
   *   원본 uiAttributeArea.js attrAppf4Popup(5619행) 1:1 이식.
   *   · 팝업 컴포넌트 fnAppF4PopupOpen(options, callback) 은 WS10 앱검색과 동일 계약(HTML5 변환 완료).
   *   · 콜백: 선택 앱의 APPID → AppID 프로퍼티, APPNM → AppDescript(EXT00000031) 프로퍼티에 매핑 후
   *     attrChangeProc(=HTML5 fnWs20AttrChange) 로 반영.
   *   · UNDO 는 원본 saveActionHistoryData("CHANGE_ATTR", [AppID, AppDesc]) → 단일 스냅샷 스택
   *     (fnWs20PushUndo) 1회로 통합하고 두 변경은 bSkipUndo=true 로 호출(WS20 undo 단일스택 규칙).
   *   · 원본 bindPopupBroadCast("BUSY_ON") = oMainBroad 로 열린 전체 자식 윈도우(앱 멀티 미리보기 등) 잠금.
   *     이 콜백은 직접 브로드캐스트하지 않고, 호출하는 공통 fnWs20AttrChange 가 시작/finally 에서
   *     _broadChildBusy(BUSY_ON/OFF) 로 처리한다(모든 attr 변경 공통 배선 — attr.js). 바인딩 팝업 별창
   *     전송분은 인앱화로 불요.
   ************************************************************************/
  oAPP.fn.attrAppf4Popup = function (is_attr) {

    //appcontainer 의 AppID 프로퍼티가 아닌경우 exit(하위 로직 계속).
    if (is_attr.UIATK !== "EXT00000030") { return; }

    //선택 앱 콜백(원본 lf_appCallback).
    function lf_appCallback(param) {

      //편집상태가 아닌경우 exit(원본 5628행).
      if (!_isEdit()) { return; }
      if (!param) { return; }

      try {
        //UNDO 1회(원본 5646행 CHANGE_ATTR — AppID+AppDesc 를 한 스텝으로).
        if (typeof oAPP.fn.fnWs20PushUndo === "function") { oAPP.fn.fnWs20PushUndo(); }

        //APPLICATION ID 매핑 + ATTR 변경(undo 는 위에서 1회 → skip).
        is_attr.UIATV = param.APPID != null ? param.APPID : "";
        oAPP.fn.fnWs20AttrChange(is_attr, "INPUT", true);

        //AppDescript(EXT00000031) 프로퍼티에 APPNM 매핑(원본 5656행).
        var aAttr = (oAPP.attr.oModel && oAPP.attr.oModel.oData && oAPP.attr.oModel.oData.T_ATTR) || [];
        var ls_desc = aAttr.find(function (a) { return a.UIATK === "EXT00000031"; });
        if (ls_desc) {
          ls_desc.UIATV = param.APPNM != null ? param.APPNM : "";
          oAPP.fn.fnWs20AttrChange(ls_desc, "INPUT", true);
        }

        //디자인 영역(트리)/바인딩 팝업 데이터 갱신(원본 5669·5673행).
        if (typeof oAPP.fn.designRefershModel === "function") { oAPP.fn.designRefershModel(); }
        if (typeof oAPP.fn.updateBindPopupDesignData === "function") { oAPP.fn.updateBindPopupDesignData(); }

      } catch (e) {
        console.error("[HTML5][WS20][bind] AppID F4 콜백 처리 오류:", e && e.message);
      }
    }

    //앱 검색 팝업 옵션(원본 5678행 l_opt 동일).
    var l_opt = { autoSearch: true, initCond: { PACKG: "", APPID: "", APPNM: "", ERUSR: "", HITS: 500 } };

    //앱 검색 팝업 호출 — 로드되어 있으면 즉시, 아니면 loadJs 후(원본 5681~5690).
    if (typeof oAPP.fn.fnAppF4PopupOpen === "function") {
      oAPP.fn.fnAppF4PopupOpen(l_opt, lf_appCallback);
    } else {
      oAPP.loadJs("fnAppF4PopupOpen", function () { oAPP.fn.fnAppF4PopupOpen(l_opt, lf_appCallback); });
    }

    //하위 로직 skip flag return.
    return true;

  }; // end of attrAppf4Popup

  /************************************************************************
   * u4a.m.SelectOption2 의 F4HelpID(EXT00001188) icon1(돋보기 inspection) = DDIC 검색도움 선택 F4.
   *   원본 uiAttributeArea.js attrSelOption2F4HelpID(5825행) 1:1 이식(selectOption2 경로만 — selectOption3
   *   F4HelpID 는 값도움 ⧉ 경로라 별도).
   *   · 원본 callF4HelpPopup("DD_SHLP","DD_SHLP",[],[],cb) → HTML5 공통 fnF4SearchHelpOpen({shlpname:"DD_SHLP"}).
   *   · 콜백: 선택 SHLPNAME → F4HelpID 값. 짝인 F4HelpReturnField(EXT00001189)는 초기화(SearchHelp 가
   *     바뀌면 이전 반환필드는 무효 — 단, 바인딩(ISBND="X")된 경우는 건드리지 않음).
   *   · UNDO 는 단일 스냅샷 스택 1회 + 변경 bSkipUndo. 자식창 busy 브로드캐스트는 공통 fnWs20AttrChange
   *     가 담당(이 콜백은 그걸 거쳐 자동 적용 — 위 attrAppf4Popup 주석 참고).
   ************************************************************************/
  oAPP.fn.attrSelOption2F4HelpID = function (is_attr, bSelOpt3) {

    //★ bSelOpt3 로 selOpt2/selOpt3 진입을 분리(원본 5828·5833행). 이걸 UIATK 단독판별로 바꾸면
    //  바인딩 아이콘 흐름(attrBindIcon1Proc, bSelOpt3 없이 호출)이 selOpt3(2534)를 잘못 잡아 F4 를 열게 됨.
    //  selOpt3 F4 는 입력칸 F4 버튼(값도움) 경로에서만 bSelOpt3=true 로 호출한다.
    //selectOption2 의 F4HelpID 가 아니고 bSelOpt3 도 아니면 exit(원본 5828행).
    if (is_attr.UIATK !== "EXT00001188" && !bSelOpt3) { return; }
    //selectOption3 의 F4HelpID 가 아닌데 bSelOpt3 면 exit(원본 5833행).
    if (is_attr.UIATK !== "EXT00002534" && bSelOpt3 === true) { return; }

    //DDIC 검색도움 선택 콜백(원본 lf_returnDOC).
    function lf_returnDOC(param) {

      //편집상태가 아닌경우/선택값 없는경우 exit.
      if (!_isEdit()) { return; }
      if (!param) { return; }

      try {
        //UNDO 1회(원본 5865행 CHANGE_ATTR — F4HelpID+ReturnField 한 스텝).
        if (typeof oAPP.fn.fnWs20PushUndo === "function") { oAPP.fn.fnWs20PushUndo(); }

        //F4 HELP 선택 SHLPNAME 매핑 + ATTR 변경(undo skip).
        is_attr.UIATV = param.SHLPNAME != null ? param.SHLPNAME : "";
        oAPP.fn.fnWs20AttrChange(is_attr, "INPUT", true);

        //짝인 F4HelpReturnField 초기화(원본 5876행 — 바인딩건은 제외). selOpt2=1189 / selOpt3=2535(원본 5850·5854행).
        var aAttr = (oAPP.attr.oModel && oAPP.attr.oModel.oData && oAPP.attr.oModel.oData.T_ATTR) || [];
        var sRetKey = (is_attr.UIATK === "EXT00002534") ? "EXT00002535" : "EXT00001189";
        var ls_ret = aAttr.find(function (a) { return a.UIATK === sRetKey; });
        if (ls_ret && ls_ret.ISBND !== "X") {
          ls_ret.UIATV = "";
          ls_ret.ISBND = "";
          oAPP.fn.fnWs20AttrChange(ls_ret, "INPUT", true);
        }

        //디자인 영역(트리)/바인딩 팝업 데이터 갱신(원본 5892·5896행).
        if (typeof oAPP.fn.designRefershModel === "function") { oAPP.fn.designRefershModel(); }
        if (typeof oAPP.fn.updateBindPopupDesignData === "function") { oAPP.fn.updateBindPopupDesignData(); }

      } catch (e) {
        console.error("[HTML5][WS20][bind] selectOption2 F4HelpID 콜백 오류:", e && e.message);
      }
    }

    //편집 모드에서만 콜백 연결(원본 5903행 — display 면 선택해도 반영 안 함).
    var fnCb = (_isEdit() === true) ? lf_returnDOC : null;

    //DDIC SearchHelp 선택 F4 팝업 호출(원본 callF4HelpPopup("DD_SHLP","DD_SHLP",[],[],cb)).
    var _open = function () {
      oAPP.fn.fnF4SearchHelpOpen({ shlpname: "DD_SHLP", shlpDef: "DD_SHLP", onPick: fnCb });
    };
    if (typeof oAPP.fn.fnF4SearchHelpOpen === "function") { _open(); }
    else { oAPP.loadJs("fnF4SearchHelpPopup", _open); }

    //하위 로직 skip flag return.
    return true;

  }; // end of attrSelOption2F4HelpID

  /************************************************************************
   * u4a.m.SelectOption2 의 F4HelpReturnField(EXT00001189) icon1(돋보기 inspection) = 필드 리스트 선택.
   *   원본 uiAttributeArea.js attrSelOption2F4HelpReturnFIeld(5932행) 1:1 이식(selectOption2 경로만).
   *   · 짝인 F4HelpID(EXT00001188)에 SearchHelp 가 지정돼 있어야 함(없으면 053, 바인딩이면 050 오류).
   *   · 원본 callDynListPopup("GETF4HELPFIELD", …, [{SHLPNAME}], cb) → HTML5 동적 리스트 팝업(fnDynListPopup).
   *   · 콜백: 선택 FIELDNAME → F4HelpReturnField 값(attrChange=fnWs20AttrChange, undo 1회).
   ************************************************************************/
  oAPP.fn.attrSelOption2F4HelpReturnFIeld = function (is_attr, bSelOpt3) {

    //★ bSelOpt3 로 selOpt2/selOpt3 진입 분리(원본 5964·5969행) — 위 attrSelOption2F4HelpID 와 동일한 함정 회피.
    //  바인딩 아이콘(attrBindIcon1Proc, bSelOpt3 없이 호출)은 selOpt3(2535)를 안 잡고 attrCheckSelOpt3F4ReturnField
    //  → attrBindProp 로 흘러야 한다. selOpt3 필드리스트 F4 는 입력칸 F4 버튼에서만 bSelOpt3=true 로 호출.
    //selectOption2 의 F4HelpReturnField 가 아니고 bSelOpt3 도 아니면 exit(원본 5964행).
    if (is_attr.UIATK !== "EXT00001189" && !bSelOpt3) { return; }
    //selectOption3 의 F4HelpReturnField 가 아닌데 bSelOpt3 면 exit(원본 5969행).
    if (is_attr.UIATK !== "EXT00002535" && bSelOpt3 === true) { return; }

    //편집상태가 아닌경우 skip(원본 5975행).
    if (!_isEdit()) { return true; }

    var aAttr = (oAPP.attr.oModel && oAPP.attr.oModel.oData && oAPP.attr.oModel.oData.T_ATTR) || [];

    //짝인 F4HelpID 프로퍼티 — selOpt2=1188 / selOpt3=2534(원본 5988·5992행).
    var sIdKey = (is_attr.UIATK === "EXT00002535") ? "EXT00002534" : "EXT00001188";
    var ls_attr = aAttr.find(function (a) { return a.UIATK === sIdKey; });

    //F4HelpID 값이 없으면 오류(원본 5999행 — 053 Value & is missing / & = A37 Search Help ID).
    if (!ls_attr || ls_attr.UIATV === "") {
      var sMiss = _mw("053", _cl("A37"));
      if (ls_attr) {
        ls_attr.valst = "Error";
        ls_attr.valtx = sMiss;
        try { if (oAPP.fn.fnRenderWs20AttrRows) { oAPP.fn.fnRenderWs20AttrRows(); } } catch (e) { }
      }
      _msg(10, "E", sMiss);
      return true;
    }

    //F4HelpID 가 바인딩된 경우 오류(원본 6022행 — 050 필드리스트 팝업 호출 불가).
    if (ls_attr.ISBND === "X") {
      ls_attr.valtx = _wsTxt("050");
      try { if (oAPP.fn.fnRenderWs20AttrRows) { oAPP.fn.fnRenderWs20AttrRows(); } } catch (e) { }
      _msg(10, "E", ls_attr.valtx);
      return true;
    }

    //A28 Field List — 제목 = F4HelpID값 + " " + Field List(원본 6041행).
    var l_title = ls_attr.UIATV + " " + _cl("A28");

    //선택 콜백(원본 lf_callback).
    function lf_callback(param) {
      if (!_isEdit()) { return; }
      if (!param) { return; }
      try {
        //리스트에서 선택한 필드명 매핑(원본 5952행).
        is_attr.UIATV = param.FIELDNAME != null ? param.FIELDNAME : "";
        //오류 표현 필드 초기화(원본 5955행).
        if (typeof oAPP.fn.attrClearErrorField === "function") { oAPP.fn.attrClearErrorField(); }
        //ATTR 변경(원본 5958행은 attrChange=FULL — fnWs20AttrChange(=attrChangeProc)+undo 1회).
        oAPP.fn.fnWs20AttrChange(is_attr, "INPUT");
        //원본 attrChange 는 내부에서 아래 두 갱신까지 수행 → fnWs20AttrChange 는 안 하므로 명시 호출
        //  (#1/#3/#4 콜백과 동일 패턴 — 트리 재렌더 + 바인딩 팝업 디자인 동기화).
        if (typeof oAPP.fn.designRefershModel === "function") { oAPP.fn.designRefershModel(); }
        if (typeof oAPP.fn.updateBindPopupDesignData === "function") { oAPP.fn.updateBindPopupDesignData(); }
      } catch (e) {
        console.error("[HTML5][WS20][bind] selectOption2 F4HelpReturnField 콜백 오류:", e && e.message);
      }
    }

    //동적 리스트 팝업 호출 — 로드되어 있으면 즉시, 아니면 loadJs 후(원본 6044~6055).
    var _open = function () {
      oAPP.fn.callDynListPopup("GETF4HELPFIELD", l_title,
        [{ NAME: "SHLPNAME", VALUE: ls_attr.UIATV }], lf_callback);
    };
    if (typeof oAPP.fn.callDynListPopup === "function") { _open(); }
    else { oAPP.loadJs("fnDynListPopup", _open); }

    return true;

  }; // end of attrSelOption2F4HelpReturnFIeld

  /************************************************************************
   * selectOption3 UI 의 F4HelpReturnField(EXT00002535) 바인딩 전 필요값 점검.
   *   원본 uiAttributeArea.js attrCheckSelOpt3F4ReturnField(6194행) 1:1 이식.
   *   · 바인딩 아이콘(icon1) 흐름(attrBindIcon1Proc 145행)에서 attrBindProp 전에 호출.
   *   · 짝인 F4HelpID(EXT00002534)에 값이 없으면 053(Value & is missing / & = A37 Search Help ID) 오류 후 skip.
   *   · F4HelpID 값이 있거나 프로퍼티가 없으면 통과(return undefined → 상위가 다음 분기로).
   *   반환 true = 호출처 후속 분기 skip(원본 동일).
   ************************************************************************/
  oAPP.fn.attrCheckSelOpt3F4ReturnField = function (is_attr) {

    //selectOption3 의 F4HelpReturnField 가 아닌경우 exit(원본 6197행).
    if (is_attr.UIATK !== "EXT00002535") { return; }

    var aAttr = (oAPP.attr.oModel && oAPP.attr.oModel.oData && oAPP.attr.oModel.oData.T_ATTR) || [];

    //짝인 F4HelpID(EXT00002534) 프로퍼티.
    var ls_attr = aAttr.find(function (a) { return a.UIATK === "EXT00002534"; });

    //F4HelpID 가 없거나 값이 있으면 통과(원본 6204행).
    if (!ls_attr || ls_attr.UIATV !== "") { return; }

    //F4HelpID 값이 없으면 053 오류 표현(원본 6209행 — 053 Value & is missing / & = A37 Search Help ID).
    var sMiss = _mw("053", _cl("A37"));
    ls_attr.valst = "Error";
    ls_attr.valtx = sMiss;
    try { if (oAPP.fn.fnRenderWs20AttrRows) { oAPP.fn.fnRenderWs20AttrRows(); } } catch (e) { }
    _msg(10, "E", sMiss);

    //하위 로직 skip flag return(원본 6222행).
    return true;

  }; // end of attrCheckSelOpt3F4ReturnField

  /************************************************************************
   * Tree parent/child 프로퍼티 바인딩 점검 (원본 uiAttributeArea.js 5767행 1:1 — UI5 치환).
   *   items(sap.m.Tree)/rows(sap.ui.table.TreeTable) Aggregation 에 모델 바인딩이 없으면
   *   054(&1 에 모델 정보 없음) 오류 후 상위 skip(true).
   ************************************************************************/
  oAPP.fn.attrChkTreeProp = function (is_attr) {
    var l_UIATK = "";
    var l_msg = _cl("B19");   // B19 Aggregation

    switch (is_attr.UIATK) {
      case "EXT00001190":   // sap.m.Tree parent
      case "EXT00001191":   // sap.m.Tree child
        l_UIATK = "AT000006260"; l_msg = l_msg + " items"; break;
      case "EXT00001192":   // sap.ui.table.TreeTable parent
      case "EXT00001193":   // sap.ui.table.TreeTable child
        l_UIATK = "AT000013146"; l_msg = l_msg + " rows"; break;
      default:
        return false;   // Tree parent/child 아님 → 통과.
    }

    // 편집상태가 아니면 통과(원본: return undefined → 호출부가 팝업 계속).
    if (!_isEdit()) { return; }

    var aAttr = (oAPP.attr.oModel && oAPP.attr.oModel.oData && oAPP.attr.oModel.oData.T_ATTR) || [];
    var ls_attr = aAttr.find(function (a) { return a.UIATK === l_UIATK; });

    // 대상 Aggregation 에 모델 바인딩(UIATV)이 없는 경우 오류.
    if (!ls_attr || ls_attr.UIATV === "") {
      is_attr.valst = "Error";
      is_attr.valtx = _mw("054", l_msg);   // 054 Model information does not exist in &1.
      try { oAPP.fn.fnRenderWs20AttrRows(); } catch (e) { }
      _msg(20, "E", is_attr.valtx);
      return true;   // 상위 로직 skip.
    }
  }; // end of attrChkTreeProp

  /************************************************************************
   * 애그리게이션 바인딩 가능 여부 점검 (원본 uiAttributeArea.js 9243행 — 축약/가드).
   *   · 해당 Aggregation 에 2개 이상 자식 UI → 023(모델 지정 불가) 오류.
   *   · (원본의 단축키 등록 점검(attrGetShortcutEvent)은 HTML5 정의시에만 — 가드.)
   ************************************************************************/
  oAPP.fn.attrChkBindAggrPossible = function (is_attr, bSkipMsg) {
    try {
      var l_tree = (typeof oAPP.fn.getTreeData === "function") ? oAPP.fn.getTreeData(is_attr.OBJID) : null;
      if (!l_tree || !l_tree.zTREE || l_tree.zTREE.length === 0) { return; }

      // 현재 Aggregation(UIATK)에 추가된 자식 UI.
      var lt_filter = l_tree.zTREE.filter(function (a) { return a.UIATK === is_attr.UIATK; });
      if (lt_filter.length >= 2) {
        if (!bSkipMsg) { _msg(10, "E", _mw("023")); }   // 023 자식 2건 이상 → 모델 지정 불가.
        return true;
      }

      // 단축키 등록 이벤트 점검(패치서버/HTML5 정의시에만).
      if (typeof oAPP.fn.attrGetShortcutEvent === "function") {
        var _s = oAPP.fn.attrGetShortcutEvent(is_attr.OBJID);
        if (_s) {
          if (!bSkipMsg) {
            try { _msg(10, "E", parent.WSUTIL.getWsMsgClsTxt("", "ZMSG_WS_COMMON_001", "484", _s.OBJID, _s.UIATT)); } catch (e) { }
          }
          return true;
        }
      }
    } catch (e) {
      console.warn("[HTML5][WS20][bind] attrChkBindAggrPossible 오류:", e && e.message);
    }
  }; // end of attrChkBindAggrPossible

  /************************************************************************
   * 프로퍼티 바인딩 팝업 호출 (원본 uiAttributeArea.js 2362행 1:1).
   *   CARDI = F(단일 필드) / R(range table) / ST(string table). 콜백=attrBindCallBackProp.
   ************************************************************************/
  oAPP.fn.attrBindProp = function (is_attr) {
    if (is_attr.UIATY !== "1") { return; }
    if (oAPP.fn.fnOnCheckIsTrial && oAPP.fn.fnOnCheckIsTrial()) { return; }

    // B18 Data Binding / Unbinding - A52 Property : <속성명>
    var l_title = _cl("B18") + " - " + _cl("A52") + " : " + is_attr.UIATT;

    var l_CARDI = "F";
    if (is_attr.UIATK === "EXT00001161") { l_CARDI = "R"; }   // SELECT OPTION2 VALUE → range table
    if (is_attr.UIATK === "EXT00002507") { l_CARDI = "R"; }   // SELECT OPTION3 VALUE → range table
    // ARRAY 입력 가능 + 숫자유형 아님 → string table.
    if (is_attr.ISMLB === "X" && (is_attr.UIADT !== "int" && is_attr.UIADT !== "float")) { l_CARDI = "ST"; }

    oAPP.fn.fnBindPopupOpen(l_title, l_CARDI, oAPP.fn.attrBindCallBackProp, is_attr.UIATK);
    return true;
  }; // end of attrBindProp

  /************************************************************************
   * 애그리게이션 바인딩 팝업 호출 (원본 uiAttributeArea.js 2417행 1:1).
   *   CARDI = T(table). 콜백=attrBindCallBackAggr.
   ************************************************************************/
  oAPP.fn.attrBindAggr = function (is_attr) {
    if (is_attr.UIATY !== "3") { return; }
    if (oAPP.fn.fnOnCheckIsTrial && oAPP.fn.fnOnCheckIsTrial()) { return; }

    // 애그리게이션 바인딩 가능 여부 점검.
    if (oAPP.fn.attrChkBindAggrPossible(is_attr)) { return true; }

    // B18 Data Binding / Unbinding - B19 Aggregation : <속성명>
    var l_title = _cl("B18") + " - " + _cl("B19") + " : " + is_attr.UIATT;

    oAPP.fn.fnBindPopupOpen(l_title, "T", oAPP.fn.attrBindCallBackAggr, is_attr.UIATK);
    return true;
  }; // end of attrBindAggr

  /* ====================================================================
   * 2. 팝업 UI (원본 design/js/callBindPopup.js)
   * ==================================================================== */

  // 팝업 종료.
  function lf_close() {
    try { if (oUI && oUI.dlg && oUI.dlg.open) { oUI.dlg.close(); } } catch (e) { }
  }

  // 입력 파라메터 설정 (원본 lf_setParam 1067행) — 세션 상태 구성.
  function lf_setParam(sTitle, CARDI, fnCallback, UIATK) {
    oS.CARDI = CARDI;
    oS.fnCallback = fnCallback;
    oS.UIATK = UIATK;
    oS.title = sTitle;
    oS.is_attr = {};
    oS.TREE = [];
    oS.zTREE = [];
    oS.selNode = null;
    oS.T_MPROP = [];
    oS.showAddit = false;

    // UIATK → 대상 attribute 라인 검색(원본: UIATY 를 CARDI 로 역산).
    if (typeof UIATK !== "undefined") {
      var l_UIATY = "";
      switch (CARDI) {
        case "F": case "R": case "ST": l_UIATY = "1"; break;
        case "T": l_UIATY = "3"; break;
        default: break;
      }
      var aAttr = (oAPP.attr.oModel && oAPP.attr.oModel.oData && oAPP.attr.oModel.oData.T_ATTR) || [];
      oS.is_attr = aAttr.find(function (a) { return a.UIATK === UIATK && a.UIATY === l_UIATY; }) || {};
    }
  }

  /************************************************************************
   * 공개 진입점 — 바인딩 팝업 열기 (원본 oAPP.fn.callBindPopup).
   ************************************************************************/
  oAPP.fn.fnBindPopupOpen = function (sTitle, CARDI, fnCallback, UIATK) {

    if (!oUI || !oUI.dlg || !document.body.contains(oUI.dlg)) { oUI = null; lf_build(); }

    // 파라메터/세션 설정.
    lf_setParam(sTitle, CARDI, fnCallback, UIATK);

    // 제목/닫기 문구 반영.
    oUI.titleTxt.textContent = sTitle || "";

    // 편집 가능 여부(Bind/Unbind 활성).
    oUI.edit = _isEdit();

    // 이미 열려있으면(재호출) 데이터만 재로드. (드래그/리센터는 build 시 1회 배선 — 전역 자동)
    if (!oUI.dlg.open) {
      try { oUI.dlg.showModal(); } catch (e) { }
    }

    // 서버에서 바인딩 attr 정보 로드 후 트리 구성.
    lf_loadData(false);

  }; // end of fnBindPopupOpen

  /************************************************************************
   * 다이얼로그 1회 생성.
   ************************************************************************/
  function lf_build() {
    lf_ensureStyle();

    var oDlg = document.createElement("dialog");
    oDlg.id = C_DLG_ID;
    oDlg.className = "u4a-dialog u4aBindDlg";

    oUI = oUI || {};

    // ── 헤더(48px 공통): 아이콘 + 제목(공통 > span flex) + 닫기 X(공통 .u4a-btn-icon) ──
    var oHeader = _el("div", "u4a-dialog__header u4aBindHead");
    oHeader.innerHTML = _fa("link") + "<span></span>";   // 데이터 바인딩 아이콘(원본 journey-depart)
    var oTitle = oHeader.querySelector("span");
    var oXBtn = _el("button", "u4a-btn-icon");
    oXBtn.type = "button";
    oXBtn.innerHTML = _fa("xmark");
    oXBtn.title = _cl("A39");   // A39 Close
    oXBtn.addEventListener("click", function () { lf_closeCancel(); });
    oHeader.appendChild(oXBtn);
    oDlg.appendChild(oHeader);

    // ── 툴바(트리툴 행 — MIME .u4aMimeTreeTool 컨벤션): Expand/Collapse/Refresh | Bind/Unbind ──
    var oTool = _el("div", "u4aBindTool");
    oUI.btnExpand = _mkToolBtn("angles-down", _cl("A46"), function () {   // A46 Expand All
      if (oUI.tree) { oUI.tree.expandToLevel(99999); }
    });
    oUI.btnCollapse = _mkToolBtn("angles-up", _cl("A47"), function () {   // A47 Collapse All
      if (oUI.tree) { oUI.tree.collapseAll(); if (oS.zTREE[0]) { oUI.tree.setExpanded(oS.zTREE[0], true); } }
    });
    oUI.btnRefresh = _mkToolBtn("rotate", _cl("A48"), function () {       // A48 Refresh
      lf_loadData(true);
    });
    oTool.appendChild(oUI.btnExpand);
    oTool.appendChild(oUI.btnCollapse);
    oTool.appendChild(oUI.btnRefresh);
    oTool.appendChild(_el("span", "u4aBindToolSpacer"));

    // Bind (파랑/emphasized) — 라벨 노출(모달 top-layer 라 title 툴팁 안 보임, MIME 동일 판단).
    oUI.btnBind = _mkActBtn("link", _cl("A49"), "u4a-btn--emphasized", function () { lf_bindBtnEvt(); });
    oTool.appendChild(oUI.btnBind);

    // Unbind (빨강/negative) — 바인딩된 경우만 노출.
    oUI.btnUnbind = _mkActBtn("link-slash", _cl("A43"), "u4a-btn--negative", function () { lf_unbindBtnEvt(); });
    oTool.appendChild(oUI.btnUnbind);

    oDlg.appendChild(oTool);

    // ── 바디: 가로 스플리터 [트리 | MPROP] (MIME .u4aMimeBody/.u4aMimeSplit 컨벤션) ──
    var oBody = _el("div", "u4a-dialog__body u4aBindBody");
    var oSplit = _el("div", "u4a-splitter u4aBindSplit");

    // 좌: 트리 패널(공통 .u4a-splitter__pane). ★ 다열 트리테이블 = 공통 U4AUI.makeColumnTree(host, cfg) 소비
    //   — sticky 컬럼헤더 / 세로 그리드라인 / 컬럼 리사이즈(가이드 라인) / 가로 스크롤을 컴포넌트가 전담한다.
    //   대형 바인딩 별창과 "같은 컴포넌트"라 트리 손볼 일은 U4AUI.makeColumnTree 한 곳(16 §3.4.2, 2026-07-08 통일).
    var oTreePane = _el("div", "u4a-splitter__pane u4aBindTreePane");
    var oTreeHost = _el("div", "u4aBindTreeHost");   // makeColumnTree 가 비우고 .u4aColTree 로 채운다(스크롤 컨테이너)
    oTreePane.appendChild(oTreeHost);
    oUI.treePane = oTreePane;
    oUI.treeHost = oTreeHost;
    oSplit.appendChild(oTreePane);

    // 트리 더블클릭 = 바인딩 — 컨테이너에 1회 위임(재렌더로 중복 배선 방지).
    oTreeHost.addEventListener("dblclick", function (ev) {
      var oRow = ev.target && ev.target.closest ? ev.target.closest(".u4a-tree__row") : null;
      if (!oRow || !oRow.__u4aBindNode) { return; }
      if (oRow.__u4aBindNode.enable !== true) { return; }
      lf_bindBtnEvt(oRow.__u4aBindNode);
    });

    // 스플리터 바(공통 스킨, 그립) — MPROP 표시 시만 노출.
    oUI.splitBar = _el("div", "u4a-splitter__bar u4aBindSplitBar");
    oUI.splitBar.setAttribute("role", "separator");
    oSplit.appendChild(oUI.splitBar);

    // 우: 추가속성(MPROP) 패널(공통 .u4a-splitter__pane + .u4a-table) — CARDI="F" 필드 선택 시만 표시.
    oUI.additPane = _el("div", "u4a-splitter__pane u4aBindAdditPane");
    oUI.additWrap = _el("div", "u4a-table-wrap u4aBindAdditWrap");
    oUI.additPane.appendChild(oUI.additWrap);
    oSplit.appendChild(oUI.additPane);

    oBody.appendChild(oSplit);
    oDlg.appendChild(oBody);

    // ── 푸터(48px 공통): Close(negative X) ──
    var oFoot = _el("div", "u4a-dialog__footer u4aBindFoot");
    var oCloseBtn = _el("button", "u4a-btn u4a-btn--negative");
    oCloseBtn.type = "button";
    oCloseBtn.innerHTML = _fa("xmark");
    oCloseBtn.title = _cl("A39");
    oCloseBtn.addEventListener("click", function () { lf_closeCancel(); });
    oFoot.appendChild(oCloseBtn);
    oDlg.appendChild(oFoot);

    // ESC = 닫기(취소 메시지 포함 — 원본 buttons 의 Reject press).
    oDlg.addEventListener("cancel", function (e) { e.preventDefault(); lf_closeCancel(); });

    // 스플리터 드래그.
    _wireSplitter();

    if (window.U4AUI && U4AUI.makeDialogRecenter) { U4AUI.makeDialogRecenter(oDlg, oHeader); }
    if (window.U4AUI && U4AUI.makeDialogResizable) { U4AUI.makeDialogResizable(oDlg, { minW: 560, minH: 440 }); }

    document.body.appendChild(oDlg);
    oUI.dlg = oDlg;
    oUI.header = oHeader;
    oUI.titleTxt = oTitle;
    oUI.splitEl = oSplit;
  }

  // 툴바 라벨 버튼(아이콘+텍스트) — 중립 .u4a-btn. 텍스트는 textContent(주입 방지).
  function _mkToolBtn(sFa, sTip, fn) {
    var b = _el("button", "u4a-btn u4aBindToolBtn");
    b.type = "button";
    b.innerHTML = _fa(sFa) + "<span></span>";
    b.querySelector("span").textContent = sTip || "";
    b.title = sTip || "";
    b.addEventListener("click", fn);
    return b;
  }

  // 액션 버튼(Bind/Unbind) — 의미색(emphasized/negative) + 라벨.
  function _mkActBtn(sFa, sTip, sMod, fn) {
    var b = _el("button", "u4a-btn " + sMod + " u4aBindActBtn");
    b.type = "button";
    b.innerHTML = _fa(sFa) + "<span></span>";
    b.querySelector("span").textContent = sTip || "";
    b.title = sTip || "";
    b.addEventListener("click", fn);
    return b;
  }

  // 닫기(취소) — 원본: lf_closePopup + 001(Cancel operation) 안내.
  function lf_closeCancel() {
    lf_close();
    _msg(10, "I", _mw("001"));   // 001 Cancel operation
  }

  /* ── 데이터 로드 + enable/highlight (원본 lf_openPopup) ── */

  function lf_loadData(bRefresh) {

    // Unbind 버튼 노출 — 현재 바인딩된 경우만(원본 20240830 vis_unbind).
    var bBound = oS.is_attr && oS.is_attr.ISBND === "X";
    oUI.btnUnbind.hidden = !bBound;

    // 편집 가능 여부 반영(Bind/Unbind 활성).
    var bEdit = _isEdit();
    oUI.btnBind.disabled = !bEdit;
    oUI.btnUnbind.disabled = !bEdit;

    // 화면 잠금 — 공통 busy(parent.setBusy → #u4aWsBusyIndicator <dialog>, 모달 top-layer 위에 표시).
    _busy(true);

    var oFormData = new FormData();
    oFormData.append("APPID", oAPP.attr.APPID || "");
    oFormData.append("CLSNM", (oAPP.attr.appInfo && oAPP.attr.appInfo.CLSID) || "");

    var _fail = function () {
      oS.TREE = []; oS.zTREE = [];
      lf_renderTree();
      _busy(false);
    };

    try {
      sendAjax(oAPP.attr.servNm + "/getBindAttrData", oFormData, function (param) {

        // 오류.
        if (!param || param.RETCD === "E") {
          _fail();
          if (param && param.RTMSG) { _msg(10, "E", _relocalize(param.RTMSG)); }
          return;
        }

        oS.TREE = param.T_ATTR || [];

        // 바인딩 정보 없음.
        if (oS.TREE.length === 0) {
          _fail();
          _msg(10, "E", _mw("265"));   // 265 Binding attributes does not exist.
          return;
        }

        // n건 바인딩 path 계산(라이브 미리보기 인스턴스일 때만 유효, 스탠드인이면 undefined).
        var l_path = lf_calcNbindPath();

        // 2레벨 TABLE/STRUCTURE 발췌 후 선택가능/상태 계산.
        var lt_filt = oS.TREE.filter(function (a) { return a.ZLEVEL === 2 && a.KIND !== "E"; });
        lf_setBindEnable(lt_filt, l_path, undefined);

        // 평면 → 중첩(zTREE). enable/stat_* 은 위에서 TREE 에 세팅됨 → 깊은복사로 zTREE 에 반영.
        oS.zTREE = (typeof oAPP.fn.setTreeData === "function")
          ? oAPP.fn.setTreeData(oS.TREE, "PARENT", "CHILD", "zTREE") : [];

        // 트리 렌더.
        lf_renderTree();

        // 이전 바인딩(또는 n건 path) 라인 펼침 & 선택.
        lf_setSelectTree(l_path);

        // 추가속성 패널 초기 표시 여부(원본 lf_setBindPopupLayout(true)).
        lf_setAdditLayout(true);

        _busy(false);

      }, "");
    } catch (e) {
      console.warn("[HTML5][WS20][bind] getBindAttrData 호출 실패:", e && e.message);
      _fail();
    }
  }

  // n건 바인딩 path 계산 (원본 lf_openPopup 312~359행 — 라이브 인스턴스 가드).
  function lf_calcNbindPath() {
    try {
      var oPrev = oAPP.attr.prev && oAPP.attr.prev[oS.is_attr.OBJID];
      var bLive = oPrev && typeof oPrev.getMetadata === "function";

      var l_path = (typeof oAPP.fn.getParentAggrBind === "function" && bLive)
        ? oAPP.fn.getParentAggrBind(oPrev) : undefined;

      // sap.m.Tree / TreeTable parent·child 는 items/rows 바인딩 path 사용.
      if (bLive && oPrev._MODEL) {
        if (oS.is_attr.UIATK === "EXT00001190" || oS.is_attr.UIATK === "EXT00001191") {
          l_path = oPrev._MODEL["items"];
        } else if (oS.is_attr.UIATK === "EXT00001192" || oS.is_attr.UIATK === "EXT00001193") {
          l_path = oPrev._MODEL["rows"];
        }
      }
      return l_path;
    } catch (e) { return undefined; }
  }

  // STRING_TABLE 여부 확인 (원본 lf_chkStringTable 406행 1:1).
  function lf_chkStringTable(is_tree) {
    if (oS.CARDI !== "ST") { return; }
    if (is_tree.KIND !== "T") { return; }
    if (is_tree.PARENT === "Attribute") { return; }
    if (is_tree.EXP_TYP === "STR_TAB") { return true; }
  }

  // range table 여부 확인 (원본 lf_chkRangeTable 428행 1:1).
  function lf_chkRangeTable(is_tree) {
    if (oS.CARDI !== "R") { return; }
    if (is_tree.KIND !== "T") { return; }
    var lt_filter = oS.TREE.filter(function (a) { return a.PARENT === is_tree.CHILD; });
    if (lt_filter.length !== 4) { return; }
    var l_indx = lt_filter.findIndex(function (a) {
      return a.NTEXT !== "SIGN" && a.NTEXT !== "OPTION" && a.NTEXT !== "LOW" && a.NTEXT !== "HIGH";
    });
    if (l_indx === -1) { return true; }
  }

  /************************************************************************
   * 바인딩 가능여부 flag 처리 (원본 lf_setBindEnable 33행 1:1 — 모델참조만 oS 로 치환).
   *   TABLE/STRUCTURE 를 재귀 탐색하며 enable/stat_src/stat_color/highlight 세팅.
   ************************************************************************/
  function lf_setBindEnable(it_tree, l_path, KIND) {

    if (!it_tree || it_tree.length === 0) { return; }

    var UIATV = (oS.is_attr && oS.is_attr.UIATV) || "";

    for (var i = 0, l = it_tree.length; i < l; i++) {

      switch (it_tree[i].KIND) {

        case "T": // TABLE

          // range table 처리.
          if (lf_chkRangeTable(it_tree[i]) === true) {
            it_tree[i].enable = true;
            it_tree[i].stat_src = "sap-icon://status-positive"; it_tree[i].highlight = "Success";
            if (it_tree[i].CHILD === UIATV) { it_tree[i].stat_src = "sap-icon://accept"; it_tree[i].highlight = "Information"; }
            continue;
          }

          // STRING_TABLE 처리.
          if (lf_chkStringTable(it_tree[i]) === true) {
            it_tree[i].enable = true;
            it_tree[i].stat_src = "sap-icon://status-positive"; it_tree[i].highlight = "Success";
            if (it_tree[i].CHILD === UIATV) { it_tree[i].stat_src = "sap-icon://accept"; it_tree[i].highlight = "Information"; }
            continue;
          }

          // 프로퍼티(F/R/ST) 호출 & n건 path 와 현재 path 가 동일 계열 → 하위 탐색.
          if ((oS.CARDI === "F" || oS.CARDI === "R" || oS.CARDI === "ST") &&
            (l_path && l_path.substr(0, it_tree[i].CHILD.length) === it_tree[i].CHILD)) {
            it_tree[i].stat_src = "sap-icon://share-2"; it_tree[i].highlight = "Warning";
            var lt_c1 = oS.TREE.filter(function (a) { return a.PARENT === it_tree[i].CHILD; });
            lf_setBindEnable(lt_c1, l_path, it_tree[i].KIND);
            continue;
          }

          // 프로퍼티 호출인 경우 TABLE 하위 활성 skip.
          if (oS.CARDI === "F") { continue; }

          // aggregation: 첫 TABLE 이 n건 path 계열 → 하위 탐색.
          if (oS.CARDI === "T" && l_path && l_path.substr(0, it_tree[i].CHILD.length) === it_tree[i].CHILD) {
            var lt_c2 = oS.TREE.filter(function (a) { return a.PARENT === it_tree[i].CHILD && a.KIND !== "E"; });
            lf_setBindEnable(lt_c2, l_path, it_tree[i].KIND);
            continue;
          }

          // aggregation: 첫 TABLE 은 선택 가능 처리 후 하위 활성 skip.
          if (oS.CARDI === "T") {
            var l_indx = oS.TREE.findIndex(function (a) { return a.PARENT === it_tree[i].CHILD; });
            if (l_indx !== -1) {
              it_tree[i].enable = true;
              it_tree[i].stat_src = "sap-icon://status-positive"; it_tree[i].highlight = "Success";
            }
            if (it_tree[i].CHILD === UIATV) { it_tree[i].stat_src = "sap-icon://accept"; it_tree[i].highlight = "Information"; }
            continue;
          }
          break;

        case "S": // STRUCTURE

          var l_KIND = "";
          if (oS.CARDI === "T") { l_KIND = "E"; }   // aggregation: 일반필드 제외.

          if (oS.CARDI === "S") {
            it_tree[i].enable = true;
            it_tree[i].stat_src = "sap-icon://status-positive"; it_tree[i].highlight = "Success";
          }

          var lt_c3 = oS.TREE.filter(function (a) { return a.PARENT === it_tree[i].CHILD && a.KIND !== l_KIND; });
          lf_setBindEnable(lt_c3, l_path, KIND);
          break;

        case "E": // 일반 필드

          // sap.m.Tree / TreeTable parent·child 는 바인딩된 AGGR 의 TABLE 하위건만 가능.
          if (oS.is_attr.UIATK === "EXT00001190" || oS.is_attr.UIATK === "EXT00001191" ||
            oS.is_attr.UIATK === "EXT00001192" || oS.is_attr.UIATK === "EXT00001193") {
            if (l_path && it_tree[i].CHILD.substr(0, l_path.length) !== l_path) { continue; }
          }

          // 프로퍼티 → 필드 선택 가능.
          if (oS.CARDI === "F") {
            if (l_path && KIND === "T" && it_tree[i].CHILD.substr(0, l_path.length) !== l_path) { continue; }
            it_tree[i].enable = true;
            it_tree[i].stat_src = "sap-icon://status-positive"; it_tree[i].highlight = "Success";
            if (it_tree[i].CHILD === UIATV) {
              it_tree[i].stat_src = "sap-icon://accept"; it_tree[i].highlight = "Information";
              if (oS.is_attr.MPROP && oS.is_attr.MPROP !== "") { it_tree[i].MPROP = oS.is_attr.MPROP; }
            }
          }
          break;
      }
    }
  } // end of lf_setBindEnable

  /* ── 트리 렌더 (공통 U4AUI.makeColumnTree — 3열 그리드 트리테이블) ──
   *   헤더/세로 그리드라인/컬럼 리사이즈(가이드 라인)/가로 스크롤을 컴포넌트가 전담(대형 바인딩 별창과 동일).
   *   화면은 데이터 매핑(cell/rowHook/onSelect)만 제공. 트리 손볼 일은 U4AUI.makeColumnTree 한 곳(16 §3.4.2). */

  function lf_renderTree() {
    if (!oUI.ctrl) {
      oUI.ctrl = U4AUI.makeColumnTree(oUI.treeHost, {
        columns: [
          { label: _cl("A50"), width: "16rem" },   // A50 Object Name
          { label: _cl("A51"), width: "8rem" },     // A51 Type
          { label: _cl("A35"), width: "16rem" }      // A35 Description
        ],
        roots: function () { return oS.zTREE || []; },
        children: function (n) { return n.zTREE || []; },
        hasChildren: function (n) { return !!(n.zTREE && n.zTREE.length); },
        key: function (n) { return n.CHILD; },
        label: function (n) { return n.NTEXT; },
        tip: function (n) { return n.NTEXT; },   // 이름 말줄임 시 툴팁=전체 이름
        selectable: true,
        emptyText: _wsTxt("312") || "",           // 312 No data Found(ZMSG_WS_COMMON_001)
        // C2 = 상태아이콘 + 유형텍스트, C3 = 설명(둘 다 말줄임 시에만 툴팁).
        cell: function (n) {
          var oType = _el("span", "u4aBindTypeCell");
          var oIc = _statIcon(n.stat_src);
          if (oIc) {
            var oI = _el("span", "u4aBindStat " + oIc.cls);
            oI.innerHTML = _fa(oIc.fa);
            oType.appendChild(oI);
          }
          var oTypeTxt = _el("span", "u4aBindTypeTxt", n.TYPE || "");
          if (n.TYPE) { oTypeTxt.setAttribute("data-tip", n.TYPE); oTypeTxt.setAttribute("data-tip-trunc", ""); }
          oType.appendChild(oTypeTxt);
          var oDesc = _el("span", "u4aBindDescTxt", n.DESCR || "");
          if (n.DESCR) { oDesc.setAttribute("data-tip", n.DESCR); oDesc.setAttribute("data-tip-trunc", ""); }
          return { c2: oType, c3: oDesc };
        },
        // 행 후크: 행 스코프 클래스 + 상태바 색 + 비활성 표시 + 노드 stash(더블클릭/선택용).
        rowHook: function (oRow, n) {
          oRow.classList.add("u4aBindRow");
          var sHl = _rowHl(n.highlight);
          if (sHl) { oRow.classList.add(sHl); }
          if (n.enable !== true) { oRow.classList.add("u4aBindRow--disabled"); }
          oRow.__u4aBindNode = n;
        },
        onSelect: function (n) { lf_selRow(n); }
      });
      oUI.tree = oUI.ctrl.tree;   // 기존 oUI.tree.*(펼침/접기/선택/el) 호출을 그대로 유지
    }
    oUI.ctrl.rerender(false);     // 첫행 자동선택 안 함(lf_setSelectTree 가 선택 담당)
  }

  // 라인선택 이벤트 (원본 lf_selTabRow 458행).
  function lf_selRow(n) {

    // 선택 가능하지 않으면 추가속성 숨김 + 선택 해제.
    if (n.enable !== true) {
      oS.selNode = null;
      lf_showAddit(false);
      if (oUI.tree) {
        var aSel = oUI.tree.el.querySelectorAll('.u4a-tree__row[aria-selected="true"]');
        for (var i = 0; i < aSel.length; i++) { aSel[i].removeAttribute("aria-selected"); }
      }
      return;
    }

    oS.selNode = n;
    if (oUI.tree) { oUI.tree.selectByKey(n.CHILD, false); }

    // 프로퍼티(F)에서 선택 시 추가속성 패널 활성 + 값 구성.
    if (oS.CARDI === "F") {
      lf_showAddit(true);
      // 부모(구조) 하위 필드목록 = 참조필드 후보(CUKY/UNIT).
      var it_parent = oS.TREE.filter(function (a) { return a.PARENT === n.PARENT; });
      lf_setAdditBindInfo(n, it_parent);
    }
  }

  // 이전 바인딩/n건 path 라인 펼침 & 선택 (원본 lf_setSelectTreeItem 506행 — createTree 컨트롤러로).
  //   원본은 바인딩 가능 필드로 향하는 경로만 선택 펼침하나, HTML5 는 전체 펼침(1회 렌더)로
  //   단순화(바인딩 트리는 얕고, 원본 초기 뷰도 필드 포함 구조 대부분을 펼침 — 시각 동일).
  function lf_setSelectTree(l_path) {
    if (!oUI.tree || !oS.zTREE[0]) { return; }

    // 전체 펼침(원본 초기 뷰: 바인딩 가능 필드까지 노출).
    oUI.tree.expandToLevel(99999);

    var L_UIATV = "";
    if (oS.is_attr && oS.is_attr.UIATV !== "" && oS.is_attr.ISBND === "X") { L_UIATV = oS.is_attr.UIATV; }
    if (L_UIATV === "" && l_path) { L_UIATV = l_path; }

    // 이전 바인딩 라인 선택 + 스크롤 reveal.
    if (L_UIATV !== "") {
      oUI.tree.selectByKey(L_UIATV, true);
      var nd = _findNode(oS.zTREE, L_UIATV);
      if (nd && nd.enable === true) { lf_selRow(nd); }
    }
  }

  // zTREE 에서 CHILD(path) 노드 검색.
  function _findNode(aNodes, sKey) {
    for (var i = 0; i < aNodes.length; i++) {
      if (aNodes[i].CHILD === sKey) { return aNodes[i]; }
      if (aNodes[i].zTREE && aNodes[i].zTREE.length) {
        var r = _findNode(aNodes[i].zTREE, sKey);
        if (r) { return r; }
      }
    }
    return null;
  }

  /* ── 추가속성(MPROP) 패널 레이아웃 ── */

  // 추가속성 패널 표시 여부 초기 설정 (원본 lf_setBindPopupLayout 622행).
  function lf_setAdditLayout(bFirst) {
    // aggregation(T) 은 추가속성 비활성.
    if (oS.CARDI === "T" || oS.CARDI === "R" || oS.CARDI === "ST") { lf_showAddit(false); return; }
    // 프로퍼티(F): ★이전 바인딩이 없을 때(ISBND!=="X")만 최초 비활성(필드 선택 시 활성). 이미 바인딩된 경우
    //   (ISBND==="X")엔 lf_setSelectTree 가 그 라인을 lf_selRow 로 선택해 속성 패널을 이미 켰으므로 끄지 않는다
    //   → 재오픈 시 선택+우측 스플릿 함께 표시(원본 lf_setBindPopupLayout 628행 is_frist && F && ISBND!=="X" 조건).
    var bBound = !!(oS.is_attr && oS.is_attr.ISBND === "X");
    if (bFirst === true && oS.CARDI === "F" && !bBound) { lf_showAddit(false); return; }
  }

  // 추가속성 패널 show/hide (원본 width 65%/100% + resize 토글).
  function lf_showAddit(bShow) {
    oS.showAddit = !!bShow;
    if (!oUI.dlg) { return; }
    oUI.dlg.classList.toggle("u4aBindShowAddit", !!bShow);
    if (bShow) {
      // 최초 표시 시 트리 62% / 추가속성 38% (이후 스플리터 드래그로 조정). 이미 드래그값 있으면 유지.
      var cur = oUI.splitEl && oUI.splitEl.style.getPropertyValue("--u4aBindTreeW");
      if (oUI.splitEl && (!cur || cur === "100%")) { oUI.splitEl.style.setProperty("--u4aBindTreeW", "62%"); }
    } else {
      if (oUI.splitEl) { oUI.splitEl.style.removeProperty("--u4aBindTreeW"); }
      if (oUI.additWrap) { oUI.additWrap.innerHTML = ""; }
    }
  }

  /************************************************************************
   * 추가속성 정보 출력 (원본 lf_setAdditBindInfo 658행 1:1 — UI 만 공통 컴포넌트).
   *   T_9011 UA028 기준 P01~P08 행 구성 후 MPROP 테이블 렌더.
   ************************************************************************/
  function lf_setAdditBindInfo(is_tree, it_parent) {
    if (oS.CARDI !== "F") { return; }

    oS.T_MPROP = [];

    var lt_ua028 = [];
    try {
      lt_ua028 = (oAPP.DATA.LIB.T_9011 || []).filter(function (a) { return a.CATCD === "UA028"; });
    } catch (e) { lt_ua028 = []; }
    lt_ua028.sort(function (a, b) { return a.ITMCD.localeCompare(b.ITMCD); });

    var lt_split = [];
    if (is_tree.MPROP) { lt_split = is_tree.MPROP.split("|"); }

    var l_nozero = "Cg";   // nozero 불가(C:char, g:string)
    var l_numfmt = "IP";   // number format 가능(I:int, P:P TYPE)

    for (var i = 0, l = lt_ua028.length; i < l; i++) {

      var ls = {
        ITMCD: lt_ua028[i].ITMCD, prop: lt_ua028[i].FLD01, val: "",
        stat: "None", statTxt: "", edit: false,
        inp_vis: false, sel_vis: false, txt_vis: false, T_DDLB: [], maxlen: undefined
      };
      if (lt_ua028[i].FLD02 !== "X") { ls.edit = true; }   // 조회모드(X) 아니면 편집.

      switch (lt_ua028[i].ITMCD) {

        case "P01": // Field name
          ls.val = is_tree.NTEXT; ls.txt_vis = true; break;

        case "P02": // Field path
          ls.val = is_tree.CHILD; ls.txt_vis = true; break;

        case "P03": // Type
          ls.val = is_tree.TYPE; ls.txt_vis = true; break;

        case "P04": // Bind type
          if (is_tree.MPROP) { ls.val = lt_split[0]; }
          ls.sel_vis = true;
          if (is_tree.TYPE_KIND !== "P") { ls.edit = false; }   // P 타입 아니면 잠금.
          ls.T_DDLB = [
            { KEY: "", TEXT: "" },
            { KEY: "sap.ui.model.type.Currency", TEXT: "sap.ui.model.type.Currency" },
            { KEY: "ext.ui.model.type.Quantity", TEXT: "ext.ui.model.type.Quantity" }
          ];
          break;

        case "P05": // Reference Field name
          if (is_tree.MPROP) { ls.val = lt_split[1]; }
          ls.sel_vis = true;
          // 구조 안 CUKY/UNIT 필드만 참조 후보.
          var lt_ref = (it_parent || []).filter(function (a) { return a.DATATYPE === "CUKY" || a.DATATYPE === "UNIT"; });
          ls.edit = false;
          if (lt_ref.length !== 0) {
            ls.edit = true;
            ls.T_DDLB = [{ KEY: "", TEXT: "" }];
            for (var j = 0, l2 = lt_ref.length; j < l2; j++) {
              ls.T_DDLB.push({ KEY: lt_ref[j].CHILD, TEXT: lt_ref[j].CHILD });
            }
          }
          if (lt_split.length === 0 || lt_split[0] === "") { ls.edit = false; }
          break;

        case "P06": // Conversion Routine
          ls.val = is_tree.CONVE; ls.maxlen = 5;
          if (is_tree.MPROP) { ls.val = lt_split[2]; }
          if (lt_split.length > 0 && lt_split[0] !== "") { ls.edit = false; }   // Bind type 있으면 잠금.
          ls.inp_vis = true;
          break;

        case "P07": // Nozero
          if (is_tree.MPROP) { ls.val = lt_split[3]; }
          if (ls.val === "") { ls.val = "false"; }
          ls.sel_vis = true;
          if (l_nozero.indexOf(is_tree.TYPE_KIND) !== -1) { ls.edit = false; }
          ls.T_DDLB = [{ KEY: "true", TEXT: "true" }, { KEY: "false", TEXT: "false" }];
          break;

        case "P08": // Is number format?
          if (is_tree.MPROP) { ls.val = lt_split[4]; }
          if (ls.val === "") { ls.val = "false"; }
          ls.sel_vis = true;
          if (l_numfmt.indexOf(is_tree.TYPE_KIND) === -1) { ls.edit = false; }
          ls.T_DDLB = [{ KEY: "true", TEXT: "true" }, { KEY: "false", TEXT: "false" }];
          break;
      }

      oS.T_MPROP.push(ls);
    }

    lf_renderAddit();
  }

  // 추가속성 테이블 렌더(공통 .u4a-table + createField/createSelect) — 원본 sap.ui.table.Table 대응.
  function lf_renderAddit() {
    oUI.additWrap.innerHTML = "";
    var bEdit = _isEdit();

    var oTable = _el("table", "u4a-table u4aBindAdditTable");
    var oThead = _el("thead");
    var oHrow = _el("tr");
    oHrow.appendChild(_el("th", "u4aBindAdditColProp", _cl("A52")));   // A52 Property
    oHrow.appendChild(_el("th", null, _cl("A53")));                    // A53 Value
    oThead.appendChild(oHrow);
    oTable.appendChild(oThead);

    var oTbody = _el("tbody");

    for (var i = 0; i < oS.T_MPROP.length; i++) {
      (function (ls, idx) {
        var oTr = _el("tr");
        // 지브라(교대 배경) 제거 — 속성/값 폼형 테이블이라 줄무늬 대신 라인 구분만(사용자 요청). data-odd 미설정.
        if (ls.stat === "Error") { oTr.setAttribute("data-state", "error"); }

        // Property 셀.
        var oTdP = _el("td", "u4aBindAdditProp", ls.prop || "");   // 툴팁=공통 .u4a-table 자동(_autoCellTip: 잘릴 때만)
        oTr.appendChild(oTdP);

        // Value 셀 — 읽기전용 텍스트 / 입력 / 콤보.
        var oTdV = _el("td", "u4aBindAdditVal");

        if (ls.txt_vis) {
          oTdV.textContent = ls.val || "";
          oTdV.classList.add("u4aBindAdditText");   // 값 툴팁=공통 .u4a-table 자동(잘릴 때만 전체값)

        } else if (ls.inp_vis) {
          // Conversion Routine — 대문자 입력.
          var oF = U4AUI.createField({
            type: "text", value: ls.val || "", upper: true, clear: true,
            maxLength: ls.maxlen, readOnly: !(ls.edit && bEdit), disabled: !(ls.edit && bEdit),
            className: "u4aBindAdditField",
            onChange: function (v) { ls.val = (v || "").toUpperCase(); }
          });
          ls._field = oF;
          oTdV.appendChild(oF.el);

        } else if (ls.sel_vis) {
          var aItems = (ls.T_DDLB || []).map(function (d) { return { value: d.KEY, text: d.TEXT }; });
          var oSel = U4AUI.createField({
            type: "select", value: ls.val || "", items: aItems,
            disabled: !(ls.edit && bEdit),
            className: "u4aBindAdditField",
            onChange: function (v) { ls.val = v; lf_onMpropChange(ls); }
          });
          ls._field = oSel;
          oTdV.appendChild(oSel.el);
        }

        // ★ 오류 표시 = 필드 밸류스테이트(원본 callBindPopup valueState:"{stat}"/valueStateText:"{statTxt}" 1:1).
        //   라벨/텍스트 빨강 아님 — 필드에 빨간 테두리 + 메시지(포커스 시 표시). txt 셀(필드없음)은 오류 대상 아님.
        // ★ 공통 createField 는 소문자 value-state("error"/"none")로 data-vs 를 세팅(shell.css .u4a-input[data-vs="error"]
        //   빨간 테두리). ls.stat 은 UI5식 "Error"/"None" 이라 소문자로 매핑해야 빨간 테두리가 걸린다.
        if (ls._field && ls._field.setValueState) { ls._field.setValueState(ls.stat === "Error" ? "error" : "none", ls.statTxt || ""); }

        oTr.appendChild(oTdV);
        oTbody.appendChild(oTr);
      })(oS.T_MPROP[i], i);
    }

    oTable.appendChild(oTbody);
    oUI.additWrap.appendChild(oTable);
  }

  // 추가속성 DDLB 상호작용 (원본 oTabCol2Sel1 change — Bind type ↔ Reference/Conversion).
  function lf_onMpropChange(ls) {
    if (ls.ITMCD !== "P04") { return; }
    var ls_P05 = oS.T_MPROP.find(function (a) { return a.ITMCD === "P05"; });
    var ls_P06 = oS.T_MPROP.find(function (a) { return a.ITMCD === "P06"; });
    if (!ls_P05 || !ls_P06) { return; }

    if (ls.val === "") {
      ls_P05.edit = false; ls_P05.val = "";
      ls_P06.edit = true;
    } else {
      ls_P05.edit = true;
      ls_P06.edit = false; ls_P06.val = "";
    }
    lf_renderAddit();   // edit 상태 반영 재렌더.
  }

  // 추가속성 메시지 초기화 (원본 lf_resetMPROPMsg 958행).
  function lf_resetMPROPMsg() {
    if (oS.CARDI !== "F") { return; }
    if (!oS.T_MPROP || oS.T_MPROP.length === 0) { return; }
    for (var i = 0; i < oS.T_MPROP.length; i++) { oS.T_MPROP[i].stat = "None"; oS.T_MPROP[i].statTxt = ""; }
  }

  /* ── Bind / Unbind ── */

  // 바인딩 선택전 점검 (원본 lf_chkBindVal 865행) — Promise<bool>(true=오류).
  function lf_chkBindVal(is_tree) {
    return new Promise(function (resolve) {

      // 선택 가능 라인인지.
      if (!is_tree || is_tree.enable !== true) {
        _msg(10, "E", _mw("266"));   // 266 This line cannot be selected.
        return resolve(true);
      }

      // aggregation 은 하위 점검 skip.
      if (oS.CARDI === "T") { return resolve(false); }

      if (!oS.T_MPROP || oS.T_MPROP.length === 0) { return resolve(false); }

      var ls_P04 = oS.T_MPROP.find(function (a) { return a.ITMCD === "P04"; });
      if (ls_P04 && ls_P04.val !== "") {
        var ls_P05 = oS.T_MPROP.find(function (a) { return a.ITMCD === "P05"; });
        if (ls_P05 && ls_P05.val === "") {
          ls_P05.stat = "Error";
          ls_P05.statTxt = _mw("267");   // 267 Bind type 선택 시 Reference Field name 필수.
          lf_renderAddit();
          _refocus(ls_P05._field && ls_P05._field.input);   // (select 는 공통 setValueState no-op 라 메시지 미표시 — 별도 이슈)
          _msg(10, "E", ls_P05.statTxt);
          return resolve(true);
        }
      }

      var ls_P06 = oS.T_MPROP.find(function (a) { return a.ITMCD === "P06"; });
      if (!ls_P06 || ls_P06.val === "") { return resolve(false); }

      // Conversion Routine 존재 검증(서버).
      try {
        var oFormData = new FormData();
        oFormData.append("CONVEXIT", ls_P06.val);
        sendAjax(oAPP.attr.servNm + "/chkConvExit", oFormData, function (param) {
          if (param && param.RETCD === "E") {
            var sMsg = _relocalize(param.RTMSG);   // 서버가 백엔드 언어로 구운 메시지 → 접속 언어로 재현지화
            ls_P06.stat = "Error"; ls_P06.statTxt = sMsg;
            lf_renderAddit();
            // 오류 필드 포커스(다음 틱) → 값-스테이트 메시지 즉시 노출(원본 valueState/valueStateText 포커스시 표시).
            _refocus(ls_P06._field && ls_P06._field.input);
            _msg(10, "E", sMsg);
            return resolve(true);
          }
          return resolve(false);
        });
      } catch (e) { return resolve(false); }
    });
  }

  // Bind 버튼 이벤트 (원본 lf_bindBtnEvt 979행).
  async function lf_bindBtnEvt(oNode) {

    _busy(true);   // ★ 바인드 시작 = 팝업 busy 잠금(원본 바인드 버튼 parent.setBusy("X")). 비동기 검증(chkConvExit) 중
                   //   중복 클릭/재진입 방지. 오류/성공 모든 경로에서 _busy(false) 로 해제(원본 setBusy("") 대응).
    lf_resetMPROPMsg();

    // 편집 불가면 종료.
    if (!_isEdit()) { _busy(false); return; }

    // 추가속성 입력값 최신화(change 이벤트 타이밍 무관 — 검증/수집 직전 필드에서 직접 읽기).
    if (oS.CARDI === "F" && oS.T_MPROP) {
      for (var k = 0; k < oS.T_MPROP.length; k++) {
        var mf = oS.T_MPROP[k]._field;
        if (mf && typeof mf.getValue === "function") { oS.T_MPROP[k].val = mf.getValue(); }
      }
    }

    // 인자 노드(더블클릭) 또는 선택 노드.
    var ls_tree = oNode || oS.selNode;

    // 선택 라인 없음.
    if (!ls_tree) {
      _msg(10, "E", _mw("081"));   // 081 Select field information for Binding.
      _busy(false);
      return;
    }

    // 입력값 점검.
    if (await lf_chkBindVal(ls_tree) === true) { _busy(false); return; }

    // 프로퍼티(F): 추가속성(P04~P08) 수집 → MPROP.
    if (oS.CARDI === "F") {
      var l_array = [];
      for (var i = 3; i < oS.T_MPROP.length; i++) { l_array.push(oS.T_MPROP[i].val); }
      ls_tree.MPROP = l_array.join("|");
    }

    // 콜백으로 선택 라인 return → 적용.
    try { oS.fnCallback(true, ls_tree, oS.is_attr); }
    catch (e) { console.error("[HTML5][WS20][bind] bind 콜백 오류:", e && e.message); }

    _busy(false);   // 적용 완료 → busy 해제(성공 경로). (형제창 busy 는 fnWs20AttrChange 가 짝맞춰 처리)
    lf_close();
  }

  // Unbind 버튼 이벤트 (원본 lf_unbindBtnEvt 1057행).
  function lf_unbindBtnEvt() {
    if (!_isEdit()) { _busy(false); return; }
    try { oS.fnCallback(false, null, oS.is_attr); }
    catch (e) { console.error("[HTML5][WS20][bind] unbind 콜백 오류:", e && e.message); }
    lf_close();
  }

  /* ── 스플리터 드래그(트리 ↔ 추가속성) ── */
  function _wireSplitter() {
    var bDrag = false;
    oUI.splitBar.addEventListener("mousedown", function (ev) {
      if (!oS.showAddit) { return; }
      bDrag = true;
      document.body.classList.add("u4a-dragging");   // iframe 위 드래그 끊김 방지(공통).
      if (oUI.dlg) { oUI.dlg.classList.add("u4aBindResizing"); }   // 드래그 중 커서.
      ev.preventDefault();
    });
    document.addEventListener("mousemove", function (ev) {
      if (!bDrag || !oUI.splitEl) { return; }
      var r = oUI.splitEl.getBoundingClientRect();
      var pct = ((ev.clientX - r.left) / r.width) * 100;
      pct = Math.max(30, Math.min(80, pct));
      oUI.splitEl.style.setProperty("--u4aBindTreeW", pct + "%");
    });
    document.addEventListener("mouseup", function () {
      if (bDrag) { bDrag = false; document.body.classList.remove("u4a-dragging"); if (oUI.dlg) { oUI.dlg.classList.remove("u4aBindResizing"); } }
    });
  }

  /* ====================================================================
   * 3. 적용 콜백 (원본 attrBindCallBack 계열 → attrSet·attrUnbind 계열)
   *    ★ _MODEL/_BIND_AGGR/__PARENT 조작은 라이브 UI 인스턴스일 때만(스탠드인 no-op).
   * ==================================================================== */

  // 라이브 미리보기 UI 인스턴스 여부.
  function _isLivePrev(oPrev) { return !!(oPrev && typeof oPrev.getMetadata === "function"); }

  // 프로퍼티 바인딩 콜백 (원본 attrBindCallBackProp 4624행).
  oAPP.fn.attrBindCallBackProp = function (bIsbind, is_tree, is_attr) {
    if (bIsbind === false) { oAPP.fn.attrSetUnbindProp(is_attr); return; }
    // sap.ui.core.HTML content 바인딩 시 UNDO 스킵용 ACTCD(가드).
    if (is_attr.UIATK === "AT000011858" && oAPP.oDesign && oAPP.oDesign.CS_ACTCD) {
      is_attr.ACTCD = oAPP.oDesign.CS_ACTCD.UNBIND_TREE_KEY;
    }
    oAPP.fn.attrSetBindProp(is_attr, is_tree);
  };

  // 애그리게이션 바인딩 콜백 (원본 attrBindCallBackAggr 4699행 — 확인팝업=U4AUI.confirm, _MODEL 가드).
  oAPP.fn.attrBindCallBackAggr = function (bIsbind, is_tree, is_attr) {
    _busy(true);

    var oPrev = oAPP.attr.prev && oAPP.attr.prev[is_attr.OBJID];
    var bLive = _isLivePrev(oPrev);

    function _confirm(fnYes) {
      // 122 Change the model, the binding that exists in the child is initialized. + 123 Do you want to continue?
      var l_msg = _mw("122") + _mw("123");
      if (window.U4AUI && U4AUI.confirm) {
        U4AUI.confirm({ type: "C", message: l_msg, onClose: function (act) { if (act === "YES") { _busy(true); fnYes(); } else { _busy(false); } } });
      } else { _msg(30, "I", l_msg, function (p) { if (p === "YES") { _busy(true); fnYes(); } else { _busy(false); } }); }
    }

    if (bIsbind === false) {
      var bHasChild = bLive && oPrev._BIND_AGGR && oPrev._BIND_AGGR[is_attr.UIATT] && oPrev._BIND_AGGR[is_attr.UIATT].length !== 0;
      var doUnbind = function () {
        if (bLive) { try { oAPP.fn.attrUnbindAggr(oPrev, is_attr.UIATT, is_attr.UIATV); } catch (e) { console.error("[bind] attrUnbindAggr:", e && e.message); } }
        if (oAPP.oDesign && oAPP.oDesign.CS_ACTCD) { is_attr.ACTCD = oAPP.oDesign.CS_ACTCD.UNBIND_AGGR; }
        oAPP.fn.attrSetUnbindProp(is_attr);
        oAPP.fn.attrUnbindTree(is_attr);
      };
      if (bHasChild) { _confirm(doUnbind); } else { doUnbind(); }
      return;
    }

    // Bind.
    var doBind = function () {
      oAPP.fn.attrSetBindProp(is_attr, is_tree);
      oAPP.fn.attrUnbindTree(is_attr);
      if (bLive && oPrev._MODEL) { oPrev._MODEL[is_attr.UIATT] = is_attr.UIATV; }
    };

    // 이전 바인딩 존재 시 확인 후 재바인딩.
    if (is_attr.UIATV !== "" && is_attr.ISBND === "X") {
      _confirm(function () {
        if (bLive) { try { oAPP.fn.attrUnbindAggr(oPrev, is_attr.UIATT, is_attr.UIATV); } catch (e) { } }
        doBind();
      });
    } else { doBind(); }
  };

  // 프로퍼티 바인딩 처리 (원본 attrSetBindProp 4464행 — n건 정리는 라이브일 때만).
  oAPP.fn.attrSetBindProp = function (is_attr, is_bInfo) {

    var oPrev = oAPP.attr.prev && oAPP.attr.prev[is_attr.OBJID];
    var bLive = _isLivePrev(oPrev);

    // 이전 바인딩 존재 시 n건 바인딩 부모 정리(라이브일 때만).
    if (is_attr.ISBND === "X" && bLive && typeof oAPP.fn.getParentAggrBind === "function") {
      var l_model = oAPP.fn.getParentAggrBind(oPrev);
      if (typeof l_model !== "undefined" && l_model !== "") {
        var l_indx = (oPrev._T_0015 || []).findIndex(function (a) {
          return a.ISBND === "X" && a.UIATK !== is_attr.UIATK && a.UIATV.substr(0, l_model.length) === l_model;
        });
        if (l_indx === -1 && is_bInfo.CHILD.substr(0, l_model.length) !== l_model) {
          if (typeof oAPP.fn.attrUnbindProp === "function") { oAPP.fn.attrUnbindProp(is_attr); }
        }
      }
    }

    // DDLB 이전 바인딩값 제거.
    if (is_attr.UIATY === "1" && is_attr.ISBND === "X" && is_attr.T_DDLB) {
      for (var i = is_attr.T_DDLB.length - 1; i >= 0; i--) { if (is_attr.T_DDLB[i].ISBIND === "X") { is_attr.T_DDLB.splice(i, 1); } }
    }

    // 바인딩 값/플래그.
    is_attr.UIATV = is_bInfo.CHILD;
    is_attr.ISBND = "X";
    is_attr.MPROP = "";
    if (is_attr.UIATY === "1" && is_bInfo.MPROP && is_bInfo.MPROP !== "") { is_attr.MPROP = is_bInfo.MPROP; }
    is_attr.edit = false;

    // sap.ui.core.HTML content 바인딩 → 수집 이벤트 삭제(가드).
    if (is_attr.UIATK === "AT000011858") {
      if (typeof oAPP.fn.attrDelClientEvent === "function") { try { oAPP.fn.attrDelClientEvent(is_attr, "HM"); } catch (e) { } }
      is_attr.ADDSC = "";
    }

    // DDLB 항목에 바인딩값 추가.
    if (is_attr.UIATY === "1" && typeof is_attr.T_DDLB !== "undefined") {
      is_attr.T_DDLB.push({ KEY: is_attr.UIATV, TEXT: is_attr.UIATV, ISBIND: "X" });
    }

    // 변경 후속 처리(수집/변경표시/재렌더/undo).
    try { oAPP.fn.fnWs20AttrChange(is_attr, ""); } catch (e) { console.error("[bind] fnWs20AttrChange:", e && e.message); }

    // n건 바인딩 부모 UI 매핑(라이브일 때만; 스탠드인이면 setModelBind 가 __PARENT 없어 no-op).
    if (typeof oAPP.fn.setModelBind === "function") { try { oAPP.fn.setModelBind(oPrev); } catch (e) { } }
  };

  // 프로퍼티 바인딩 해제 (원본 attrSetUnbindProp 4551행).
  oAPP.fn.attrSetUnbindProp = function (is_attr) {

    var oPrev = oAPP.attr.prev && oAPP.attr.prev[is_attr.OBJID];
    var bLive = _isLivePrev(oPrev);

    if (bLive && typeof oAPP.fn.getParentAggrBind === "function") {
      var l_model = oAPP.fn.getParentAggrBind(oPrev);
      if (typeof l_model !== "undefined" && l_model !== "") {
        var l_indx = (oPrev._T_0015 || []).findIndex(function (a) {
          return a.ISBND === "X" && a.UIATK !== is_attr.UIATK && a.UIATV.substr(0, l_model.length) === l_model;
        });
        if (l_indx === -1 && typeof oAPP.fn.attrUnbindProp === "function") { oAPP.fn.attrUnbindProp(is_attr); }
      }
    }

    // DDLB 이전 바인딩값 제거.
    if (is_attr.UIATY === "1" && is_attr.ISBND === "X" && is_attr.T_DDLB) {
      for (var i = is_attr.T_DDLB.length - 1; i >= 0; i--) { if (is_attr.T_DDLB[i].ISBIND === "X") { is_attr.T_DDLB.splice(i, 1); } }
    }

    if (is_attr.UIATK === "AT000011858") {
      if (typeof oAPP.fn.attrDelClientEvent === "function") { try { oAPP.fn.attrDelClientEvent(is_attr, "HM"); } catch (e) { } }
    }

    // 값 초기화.
    is_attr.UIATV = "";
    is_attr.comboval = "";
    var ls_0023 = null;
    try { ls_0023 = oAPP.DATA.LIB.T_0023.find(function (a) { return a.UIATK === is_attr.UIATK; }); } catch (e) { }
    if (ls_0023 && ls_0023.DEFVL !== "") { is_attr.UIATV = ls_0023.DEFVL; }

    is_attr.ISBND = "";
    is_attr.MPROP = "";

    try { oAPP.fn.fnWs20AttrChange(is_attr, ""); } catch (e) { console.error("[bind] fnWs20AttrChange:", e && e.message); }
  };

  // sap.m.Tree / TreeTable parent·child 예외 unbind (원본 attrUnbindTree 4652행).
  oAPP.fn.attrUnbindTree = function (is_attr) {
    var lt_UIATK = [];
    switch (is_attr.UIATK) {
      case "AT000006260": lt_UIATK = ["EXT00001190", "EXT00001191"]; break;   // sap.m.Tree items
      case "AT000013146": lt_UIATK = ["EXT00001192", "EXT00001193"]; break;   // sap.ui.table.TreeTable rows
      default: return;
    }
    var aAttr = (oAPP.attr.oModel && oAPP.attr.oModel.oData && oAPP.attr.oModel.oData.T_ATTR) || [];
    for (var i = 0; i < lt_UIATK.length; i++) {
      var ls_attr = aAttr.find(function (a) { return a.UIATK === lt_UIATK[i]; });
      if (ls_attr && ls_attr.UIATV !== "" && ls_attr.ISBND === "X") {
        if (oAPP.oDesign && oAPP.oDesign.CS_ACTCD) { ls_attr.ACTCD = oAPP.oDesign.CS_ACTCD.UNBIND_TREE_KEY; }
        oAPP.fn.attrSetUnbindProp(ls_attr);
      }
    }
  };

  // n건 바인딩한 프로퍼티 부모 수집 제거 (원본 attrUnbindProp 4922행 — 라이브 인스턴스 전용).
  oAPP.fn.attrUnbindProp = function (is_attr) {
    var oPrev = oAPP.attr.prev && oAPP.attr.prev[is_attr.OBJID];
    if (!_isLivePrev(oPrev)) { return; }   // 스탠드인이면 부모 체인/_BIND_AGGR 없음 → skip.

    function lf_findModelBindParent(oParent) {
      if (!oParent) { return; }
      if ($.isEmptyObject(oParent._BIND_AGGR) === true) { lf_findModelBindParent(oParent.__PARENT); return; }
      for (var i in oParent._BIND_AGGR) {
        var l_indx = oParent._BIND_AGGR[i].findIndex(function (a) { return a._OBJID === is_attr.OBJID; });
        if (l_indx === -1) { continue; }
        oParent._BIND_AGGR[i].splice(l_indx, 1);
        return;
      }
      lf_findModelBindParent(oParent.__PARENT);
    }
    lf_findModelBindParent(oPrev.__PARENT);
  };

  // 애그리게이션 바인딩 해제 재귀 (원본 attrUnbindAggr 4965행 — 라이브 인스턴스 전용).
  oAPP.fn.attrUnbindAggr = function (oUi, UIATT, UIATV) {
    if (!_isLivePrev(oUi)) { return; }

    function lf_clearBindData(oU) {
      if (!oU || typeof oU._T_0015 === "undefined" || oU._T_0015.length === 0) { return; }
      var _deleted = false;
      for (var i = oU._T_0015.length - 1; i >= 0; i--) {
        if (oU._T_0015[i].ISBND !== "X") { continue; }
        if (oAPP.fn.chkBindPath(UIATV, oU._T_0015[i].UIATV) === true) {
          if (oU._T_0015[i].UIATY === "3") { oAPP.fn.attrUnbindAggr(oU, oU._T_0015[i].UIATT, oU._T_0015[i].UIATV); }
          oU._T_0015.splice(i, 1);
          _deleted = true;
        }
      }
      return _deleted;
    }

    if (!oUi._BIND_AGGR || !oUi._BIND_AGGR[UIATT] || oUi._BIND_AGGR[UIATT].length === 0) {
      if (oUi._MODEL && oAPP.fn.chkBindPath(UIATV, oUi._MODEL[UIATT]) === true) { delete oUi._MODEL[UIATT]; }
      return;
    }

    for (var i = oUi._BIND_AGGR[UIATT].length - 1; i >= 0; i--) {
      if ($.isEmptyObject(oUi._BIND_AGGR[UIATT][i]._BIND_AGGR) === true) {
        var _del1 = lf_clearBindData(oUi._BIND_AGGR[UIATT][i]);
        if (_del1 === true) { oUi._BIND_AGGR[UIATT].splice(i, 1); }
        continue;
      }
      for (var j in oUi._BIND_AGGR[UIATT][i]._BIND_AGGR) {
        oAPP.fn.attrUnbindAggr(oUi._BIND_AGGR[UIATT][i], j, UIATV);
      }
      var _del2 = lf_clearBindData(oUi._BIND_AGGR[UIATT][i]);
      if (_del2 === true) { oUi._BIND_AGGR[UIATT].splice(i, 1); }
    }

    if (oUi._MODEL && oAPP.fn.chkBindPath(UIATV, oUi._MODEL[UIATT]) === true) { delete oUi._MODEL[UIATT]; }
  };

  /* ====================================================================
   * 4. 스타일(테마 토큰 소비 — 공통 파일 미수정, 화면 스코프만)
   * ==================================================================== */
  function lf_ensureStyle() {
    var sCss = [
      // 다이얼로그 — 반응형 크기 + 세로 flex(바디가 늘어 푸터 하단 고정). 헤더/푸터 48px=공통.
      ".u4aBindDlg { width: min(60vw, 880px); height: min(84vh, 820px); padding: 0; display: flex; flex-direction: column; }",
      ".u4aBindDlg .u4a-dialog__header { cursor: move; user-select: none; }",
      ".u4aBindHead span { flex: 1 1 auto; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }",
      // 툴바(MIME .u4aMimeTreeTool 컨벤션) — 아이콘/라벨 버튼 한 줄, 하단 경계.
      ".u4aBindTool { flex: 0 0 auto; display: flex; align-items: center; gap: 0.375rem; padding: 0.375rem 0.5rem; border-bottom: 0.0625rem solid var(--line); flex-wrap: wrap; }",
      ".u4aBindToolBtn, .u4aBindActBtn { display: inline-flex; align-items: center; gap: 0.375rem; white-space: nowrap; }",
      ".u4aBindToolSpacer { flex: 1 1 auto; }",
      ".u4aBindActBtn[hidden] { display: none; }",
      // 바디 + 가로 스플리터(MIME .u4aMimeBody/.u4aMimeSplit).
      ".u4aBindBody { flex: 1 1 auto; min-width: 0; min-height: 0; padding: 0; display: flex; }",
      ".u4aBindSplit { flex: 1 1 auto; width: 100%; min-width: 0; min-height: 0; --u4aBindTreeW: 100%; }",
      // 트리 패널(좌) — 공통 U4AUI.makeColumnTree(.u4aColTree)를 담는 컨테이너. 폭/스크롤/그리드/리사이즈는 컴포넌트가 담당.
      ".u4aBindTreePane { flex: 1 1 var(--u4aBindTreeW); display: flex; min-width: 0; min-height: 0; background: var(--surface); overflow: hidden; }",
      ".u4aBindTreeHost { flex: 1 1 auto; min-width: 0; min-height: 0; }",
      // 셀 내용(공통 .u4aColTreeCell 안) — C2=상태아이콘+유형텍스트, C3=설명. 말줄임 시에만 툴팁.
      ".u4aBindTypeCell { display: flex; align-items: center; gap: 0.375rem; min-width: 0; overflow: hidden; }",
      ".u4aBindTypeTxt, .u4aBindDescTxt { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 0.8125rem; }",
      ".u4aBindDescTxt { color: var(--text); }",
      // 상태 아이콘 색(시맨틱 토큰).
      ".u4aBindStat { flex: 0 0 auto; }",
      ".u4aBindStat--success { color: var(--state-success); }",
      ".u4aBindStat--info { color: var(--state-info, var(--accent)); }",
      ".u4aBindStat--warning { color: var(--state-warning); }",
      // 행 좌측 상태바(inset box-shadow, 하이라이트 레벨) — 행 골격/구분선은 공통 .u4aColTreeRow 담당.
      ".u4aBindRow--success { box-shadow: inset 0.1875rem 0 0 var(--state-success); }",
      ".u4aBindRow--info { box-shadow: inset 0.1875rem 0 0 var(--state-info, var(--accent)); }",
      ".u4aBindRow--warning { box-shadow: inset 0.1875rem 0 0 var(--state-warning); }",
      ".u4aBindRow--error { box-shadow: inset 0.1875rem 0 0 var(--state-error); }",
      // 선택 행 설명 텍스트색(공통은 라벨만 처리 → 설명도 명시). 이름 라벨은 공통 shell.css 가 처리.
      ".u4aColTreeTree .u4a-tree__row[aria-selected=\"true\"] .u4aBindDescTxt { color: var(--selected-text); }",
      // 우: 추가속성(MPROP) 패널 — 공통 .u4a-table. 기본 숨김, showAddit 시 표시. (트리 가로 스크롤은 .u4aColTree 자체 담당.)
      ".u4aBindAdditPane { display: none; flex: 1 1 0; min-width: 0; background: var(--surface); overflow: hidden; }",
      ".u4aBindSplitBar { display: none; }",
      ".u4aBindShowAddit .u4aBindTreePane { flex: 0 0 var(--u4aBindTreeW); }",
      ".u4aBindShowAddit .u4aBindAdditPane { display: flex; }",
      ".u4aBindShowAddit .u4aBindSplitBar { display: flex; }",
      ".u4aBindAdditWrap { flex: 1 1 auto; min-height: 0; overflow: auto; }",
      ".u4aBindAdditTable td { vertical-align: middle; }",
      // 컬럼 경계 세로선 — 좌측 트리와 동일한 그리드 느낌으로 속성|값 사이 세로 구분선(헤더+행 전체).
      ".u4aBindAdditTable td:first-child, .u4aBindAdditTable th:first-child { border-right: 0.0625rem solid var(--line); }",
      ".u4aBindAdditColProp, .u4aBindAdditProp { width: 42%; }",
      ".u4aBindAdditProp { font-weight: 700; }",
      ".u4aBindAdditText { color: var(--text-muted); }",
      ".u4aBindAdditVal .u4aBindAdditField { width: 100%; }",
      // ★ 값-스테이트 메시지(원본 valueState/valueStateText). MPROP 은 테이블 셀(폼-행 없음)이라 공통 focus 규칙
      //   (.u4a-form__row:focus-within, shell.css 1262)이 안 걸리고, 게다가 검증 재렌더+토스트로 포커스가 흔들려
      //   focus-within 은 이 컨텍스트에서 불안정 → ★"에러 상태(data-vs=error)면 항상" 인라인 표시(포커스 무관, 확실).
      //   공통 .u4a-field__msg 요소를 그대로 소비하되 위치만 스코프로 인라인화: 텍스트 필드(.u4a-field)를 flex-wrap 해
      //   메시지를 입력칸 '아래 줄'에 정적 배치(absolute 플로팅 아님 → 아래 행 안 가림 + overflow 클리핑 없음).
      //   (.u4aBindAdditField 는 select 콤보에도 붙으므로 .u4a-field 동시선택으로 텍스트 필드에만 한정.)
      ".u4aBindAdditField.u4a-field { flex-wrap: wrap; }",
      ".u4aBindAdditField.u4a-field .u4a-field__msg { position: static; flex: 0 0 100%; margin-top: 0.25rem; box-shadow: none; }",
      ".u4aBindAdditField.u4a-field .u4a-input[data-vs=\"error\"] ~ .u4a-field__msg:not(:empty) { display: inline-flex; }",
      // 드래그 중 iframe(미리보기) 위 끊김 방지는 공통(body.u4a-dragging).
      ".u4aBindResizing, .u4aBindResizing * { cursor: col-resize !important; user-select: none !important; }"
    ].join("");
    // 항상 최신 CSS 로 갱신(1회 캐시 시 옛 규칙 잔류 방지 — MIME 컨벤션).
    var oStyle = document.getElementById("u4aBindStyle");
    if (!oStyle) { oStyle = document.createElement("style"); oStyle.id = "u4aBindStyle"; document.head.appendChild(oStyle); }
    oStyle.textContent = sCss;
  }

})(window, $, oAPP);
