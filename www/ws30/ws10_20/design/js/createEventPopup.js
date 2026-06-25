/************************************************************************
 * Copyright 2020. INFOCG Inc. all rights reserved.
 * ----------------------------------------------------------------------
 * - file Name : createEventPopup.js
 * - file Desc : Server Event(Method) Create Popup  (Add Event Method)
 * ----------------------------------------------------------------------
 * [컨버전 메모]
 *  원본: sap.m.Dialog(contentWidth:30%, draggable) + customHeader Toolbar
 *        + sap.ui.layout.form.Form(JSONModel two-way binding) + footer
 *        accept/decline Button. 입력필드 2개(Method Name / Description) +
 *        Suggestion(setUiSuggest) + ValueState.
 *  HTML5: native <dialog class="u4a-dialog"> + 공통 컴포넌트
 *        (.u4a-form__row/.u4a-label/.u4a-field/.u4a-input/.u4a-field__msg).
 *        fnAppCopyPopupOpen.js / createApplicationPopup 와 동일 전략 —
 *        "비즈니스 로직 100% 보존, UI5 의존부만 치환".
 *
 *  ★ 보존 로직(원본 그대로):
 *    · 입력값 점검 lf_chkInputVal (필수/특수문자/대문자화/EV_ prefix)
 *    · 서버 생성 lf_createEventMethod → sendAjax /createEventMethod
 *    · 응답 처리(RETCD=E[SCRIPT 유무]/MLIST 병합→oAPP.attr.T_EVT/REQNO)
 *    · Suggestion 저장(saveUiSuggest) · 콜백(f_callBack) · attr 모델 refresh
 *    · Trial 차단 · designAreaLockUnlock · parent.setBusy
 *
 *  ★ UI5 의존부 치환:
 *    · JSONModel two-way binding   → 로컬 oData + DOM 직접 동기
 *    · sap.ui.core.ValueState      → data-vs="error" + .u4a-field__msg
 *    · sap.m.*                     → DOM + shell.css 컴포넌트
 *    · sap.m.Input setUiSuggest    → 공통 U4AUI.attachSuggest(이력 기반)
 *    · parent.showMessage(sap,…)   → parent.showMessage(null,…)
 *    · busyDialog focus reset(byId)→ 메서드 입력칸 직접 focus
 *    · eval(param.SCRIPT)          → try/catch 가드(전 코드베이스 공통 규약)
 ************************************************************************/

// 이벤트 생성 팝업 호출.
oAPP.fn.createEventPopup = function (is_attr, f_callBack) {

  //trial 버전인경우 exit.
  if (oAPP.fn.fnOnCheckIsTrial()) { return; }

  var APPCOMMON = oAPP.common;

  // ── 로컬 헬퍼(자기완결 — fnAppCopyPopupOpen 과 동일 컨벤션) ──────────
  var _fa = function (s) { return '<i class="fa-solid fa-' + s + '"></i>'; };
  function _txt(sCls, sCode, p1, p2, p3, p4) {
    try { return APPCOMMON.fnGetMsgClsText(sCls, sCode, p1 || "", p2 || "", p3 || "", p4 || ""); }
    catch (e) { return ""; }
  }
  function _el(sTag, sClass, sText) {
    var o = document.createElement(sTag);
    if (sClass) { o.className = sClass; }
    if (typeof sText !== "undefined") { o.textContent = sText; }
    return o;
  }
  // clear(X) 버튼 — 전 화면 공통 글리프(fa-xmark). 텍스트 "×" 금지.
  function _buildClearBtn() {
    var o = _el("button", "u4a-field__clear");
    o.type = "button";
    o.title = "Clear";
    o.tabIndex = -1;
    o.innerHTML = _fa("xmark");
    return o;
  }

  // 입력값/밸류스테이트는 로컬 상태(구 JSONModel /event)로만 관리.
  var oData = { meth: "", desc: "", meth_stat: "None", meth_text: "", desc_stat: "None", desc_text: "" };

  /************************************************************************
   * 공통 스타일 1회 주입(테마 토큰 소비 — 하드코딩 색 없음)
   ************************************************************************/
  function lf_ensureStyle() {
    if (document.getElementById("u4aEvtPopStyle")) { return; }
    var oStyle = document.createElement("style");
    oStyle.id = "u4aEvtPopStyle";
    oStyle.textContent =
      ".u4aEvtPopDlg { width: min(92vw, 460px); padding: 0; display: flex; flex-direction: column; }" +
      ".u4aEvtPopDlg .u4a-dialog__header { cursor: move; user-select: none; }" +
      ".u4aEvtPopDlg .u4a-dialog__header span { flex: 1 1 auto; }" +
      // flex:1 → 세로 리사이즈 시 바디가 늘어 푸터가 항상 하단에 고정(공통 grip 리사이즈).
      //   overflow 는 두지 않음 — value-state 메시지(absolute)가 잘리지 않게.
      ".u4aEvtPopBody { flex: 1 1 auto; padding: 1.25rem 1.25rem 1.75rem; display: grid; gap: 1.25rem; align-content: start; }" +
      ".u4aEvtPopBody .u4a-form__row .u4a-field__msg { white-space: nowrap; }" +
      ".u4aEvtPopFoot { display: flex; gap: 0.5rem; align-items: center; justify-content: flex-end; }";
    document.head.appendChild(oStyle);
  }

  /************************************************************************
   * label + control row. 반환: {row, control, msg}
   ************************************************************************/
  function lf_row(sLabel, bRequired) {
    var oRow = _el("div", "u4a-form__row");
    oRow.appendChild(_el("label", "u4a-label" + (bRequired ? " u4a-label--required" : ""), sLabel));
    var oCtrl = _el("div", "u4aEvtPopControl");
    oRow.appendChild(oCtrl);
    var oMsg = _el("div", "u4a-field__msg");
    oRow.appendChild(oMsg);
    return { row: oRow, control: oCtrl, msg: oMsg };
  }

  /************************************************************************
   * Suggestion 저장 — 구 oAPP.fn.saveUiSuggest 와 동일 로직.
   *  ★ saveUiSuggest 는 UI5 design/js/main.js 에만 있고 HTML5 프레임엔 미로드.
   *    HTML5 에 존재하는 fnSuggestionRead/fnSuggestionSave(fnSuggestion.js)로 동일 수행.
   *    (최신값 맨 위 + 중복 제거 + iCnt 캡. UI 모델 갱신은 attachSuggest 가 매 오픈마다
   *    디스크에서 다시 읽으므로 불필요.) 저장 실패는 비치명 — 팝업 완료 흐름을 막지 않게 가드.
   ************************************************************************/
  function lf_saveSuggest(sName, sVal, iCnt) {
    try {
      if (typeof oAPP.fn.fnSuggestionRead !== "function" || typeof oAPP.fn.fnSuggestionSave !== "function") { return; }
      var lt = oAPP.fn.fnSuggestionRead(sName) || [];
      //현재 입력한 값과 동일한 값 존재여부 확인 → 존재하면 제거(맨 위로 재배치).
      var idx = lt.findIndex(function (a) { return a && a.NAME === sVal; });
      if (idx !== -1) { lt.splice(idx, 1); }
      //맨 위에 입력값 추가.
      lt.splice(0, 0, { NAME: sVal });
      //기준값보다 큰경우 이후 라인 제거.
      if (lt.length > iCnt) { lt.splice(iCnt, lt.length); }
      oAPP.fn.fnSuggestionSave(sName, lt);
    } catch (e) {
      console.error("[HTML5][createEventMethod] suggest 저장 실패:", e && e.message);
    }
  }

  /************************************************************************
   * value-state(error) 토글 — 구 ValueState/ValueStateText
   ************************************************************************/
  function lf_setVs(oInp, oMsg, bError, sText) {
    if (!oInp) { return; }
    if (bError) { oInp.setAttribute("data-vs", "error"); }
    else { oInp.removeAttribute("data-vs"); }
    if (oMsg) { oMsg.textContent = bError ? (sText || "") : ""; }
  }


  //팝업 종료.
  function lf_dialogClose(bSkipMsg) {

    try { oDlg.close(); } catch (e) { }
    try { oDlg.remove(); } catch (e) { }

    if (bSkipMsg === true) { return; }

    //001	Cancel operation
    parent.showMessage(null, 10, "I", APPCOMMON.fnGetMsgClsText("/U4A/MSG_WS", "001", "", "", "", ""));

  } //팝업 종료.



  //입력값 점검.
  function lf_chkInputVal() {

    var l_erflag = false;

    //현재 입력값 수집(구 oModel.getProperty("/event")).
    oData.meth = oMethInp.value;
    oData.desc = oDescInp.value;

    //메소드명 대문자 변환 처리.
    oData.meth = oData.meth.toUpperCase();
    oMethInp.value = oData.meth;   //구 two-way binding(대문자 반영).

    oData.meth_stat = "None";
    oData.meth_text = "";
    oData.desc_stat = "None";
    oData.desc_text = "";

    //이벤트 메소드명을 입력하지 않은경우.
    if (oData.meth === "") {
      oData.meth_stat = "Error";
      //A34	Method Name
      //196	&1 does not exist.
      oData.meth_text = APPCOMMON.fnGetMsgClsText("/U4A/MSG_WS", "196", APPCOMMON.fnGetMsgClsText("/U4A/CL_WS_COMMON", "A34"), "", "", "");
      l_erflag = true;  //오류 flag 매핑.
    }

    //이벤트 메소드 description을 입력하지 않은경우.
    if (oData.desc === "") {
      oData.desc_stat = "Error";
      //A35	Description
      //196	&1 does not exist.
      oData.desc_text = APPCOMMON.fnGetMsgClsText("/U4A/MSG_WS", "196", APPCOMMON.fnGetMsgClsText("/U4A/CL_WS_COMMON", "A35"), "", "", "");
      l_erflag = true;  //오류 flag 매핑.
    }

    //메소드명에 특수문자가 입력된 경우.
    var reg = /[^\w]/;
    if (reg.test(oData.meth) === true) {
      oData.meth_stat = "Error";
      //278	Special characters are not allowed.
      oData.meth_text = APPCOMMON.fnGetMsgClsText("/U4A/MSG_WS", "278", "", "", "", "");
      l_erflag = true;  //오류 flag 매핑.
    }

    //오류건이 존재하는 경우.
    if (l_erflag === true) {
      //value-state 반영(구 oModel.setProperty("/event", ls_event)).
      lf_setVs(oMethInp, oMethMsg, oData.meth_stat === "Error", oData.meth_text);
      lf_setVs(oDescInp, oDescMsg, oData.desc_stat === "Error", oData.desc_text);

      //274	Check input value.
      parent.showMessage(null, 20, "E", APPCOMMON.fnGetMsgClsText("/U4A/MSG_WS", "274", "", "", "", ""));

      //첫 오류 필드로 포커스 → value-state 메시지가 바로 보이게(공통 :focus-within 노출 규약).
      if (oData.meth_stat === "Error") { try { oMethInp.focus(); } catch (e) { } }
      else if (oData.desc_stat === "Error") { try { oDescInp.focus(); } catch (e) { } }

      return l_erflag;
    }

    //오류 없음 — value-state 초기화.
    lf_setVs(oMethInp, oMethMsg, false, "");
    lf_setVs(oDescInp, oDescMsg, false, "");

  } //입력값 점검.



  //cts 선택 팝업 호출.
  //  (서버 응답 SCRIPT 가 비로컬 패키지 케이스에서 eval 로 호출 — 같은 클로저라 도달 가능)
  function lf_callCtsPopup() {

    //CTS 팝업 호출.
    oAPP.fn.fnCtsPopupOpener(function (param) {

      //이벤트 메소드 생성 처리.
      lf_createEventMethod(param.TRKORR);

    });

  } //cts 선택 팝업 호출.


  //서버이벤트 생성 처리.
  function lf_createEventMethod(REQNO) {

    //서버이벤트 생성전 lock 설정.
    oAPP.fn.designAreaLockUnlock(true);

    //busy dialog open.
    parent.setBusy("X");


    //화면에서 입력한 값 얻기.
    var ls_event = { meth: oData.meth, desc: oData.desc };

    var l_event = ls_event.meth.toUpperCase();

    //이벤트메소드명 앞에 이벤트명 prefix가 없는경우.
    if (l_event.substr(0, 3) !== "EV_") {
      //이벤트명 prefix 추가.
      l_event = "EV_" + l_event;
    }

    //클래스명 서버 전송 데이터에 구성.
    var oFormData = new FormData();
    oFormData.append("CLSNM", oAPP.attr.appInfo.CLSID);

    //package 정보 매핑.
    oFormData.append("PACKG", oAPP.attr.appInfo.PACKG);

    var l_REQNO = oAPP.attr.appInfo.REQNO;
    if (REQNO) {
      l_REQNO = REQNO;
    }

    //request No 정보 매핑.
    oFormData.append("REQNO", l_REQNO);

    //메소드명.
    oFormData.append("METH", l_event);

    //메소드 description.
    oFormData.append("DESC", ls_event.desc);


    //서버 생성 처리.
    sendAjax(oAPP.attr.servNm + "/createEventMethod", oFormData, function (param) {

      //클라이언트 도착 후 lock 해제.
      oAPP.fn.designAreaLockUnlock();

      //busy dialog close.
      parent.setBusy("");

      //오류가 발생한 경우, eval 처리 script가 존재하지 않는경우.
      if (param.RETCD === "E" && typeof param.SCRIPT === "undefined") {
        oData.meth_stat = "Error";
        oData.meth_text = param.RTMSG;
        lf_setVs(oMethInp, oMethMsg, true, param.RTMSG);

        //메소드명 입력필드에 focus 처리.
        oMethInp.focus();
        return;
      }

      //오류가 발생한 경우, eval 처리 script가 존재하는경우.
      //  서버 SCRIPT(sap 참조/lf_callCtsPopup 등) 안전 eval — 전 코드베이스 공통 규약.
      //  같은 클로저라 lf_callCtsPopup·oMethInp 도달, sap 참조는 전역 안전스텁이 흡수.
      if (param.RETCD === "E" && typeof param.SCRIPT !== "undefined") {
        try {
          // eslint-disable-next-line no-eval
          eval(param.SCRIPT);
        } catch (e) {
          console.error("[HTML5][createEventMethod] SCRIPT 수행 실패:", e && e.message, param.SCRIPT);
          //SCRIPT 가 깨져도 서버 메시지는 보여준다.
          if (param.RTMSG) { parent.showMessage(null, 20, "E", param.RTMSG); }
          parent.setBusy("");
        }
        return;
      }

      //서버이벤트 항목 array가 생성되지 않았다면 생성처리.
      if (typeof oAPP.attr.T_EVT === "undefined") {
        oAPP.attr.T_EVT = [];
      }

      if (typeof param.MLIST !== "undefined" && param.MLIST.length !== 0) {

        //기존 서버 이벤트가 존재하는경우.
        if (oAPP.attr.T_EVT.length !== 0) {

          //기존 서버이벤트에서 삭제된 서버 이벤트가 존재하는지 여부 확인.
          for (var i = oAPP.attr.T_EVT.length - 1; i >= 0; i--) {

            //빈값인경우 skip.
            if (oAPP.attr.T_EVT[i].KEY === "") { continue; }

            //서버에서 전달받은 서버이벤트 항목에 현재 수집한 이벤트가 존재하지 않는경우.
            if (param.MLIST.findIndex(function (a) { return a.EVTNM === oAPP.attr.T_EVT[i].KEY; }) === -1) {
              //해당 라인 삭제 처리.
              oAPP.attr.T_EVT.splice(i, 1);
            }

          }

        }

        //서버에서 구성한 이벤트 항목에서 수집되지 않은 이벤트 수집처리.
        for (var j = 0, l = param.MLIST.length; j < l; j++) {
          //기존 수집한 서버이벤트 없는 이벤트 항목인경우.
          if (oAPP.attr.T_EVT.findIndex(function (a) { return a.KEY === param.MLIST[j].EVTNM; }) === -1) {

            //해당 항목 수집 처리.
            var l_ddlb = {};
            l_ddlb.KEY = param.MLIST[j].EVTNM;
            l_ddlb.TEXT = param.MLIST[j].EVTNM;
            l_ddlb.DESC = param.MLIST[j].DESC;
            oAPP.attr.T_EVT.push(l_ddlb);
            l_ddlb = {};
          }

        }

      }

      //메소드명 suggest 저장 처리.
      lf_saveSuggest("crtServEvtMethName", l_event, 20);

      //메소드 desc suggest 저장 처리.
      lf_saveSuggest("crtServEvtMethDesc", ls_event.desc, 20);

      //CALLBACK function 호출.
      if (typeof f_callBack !== "undefined") {
        f_callBack(is_attr, param.METHOD);
      }

      //attribute 영역에서 호출된건이 아닌경우.
      if (!is_attr) {
        //attribute영역 갱신 처리.
        if (oAPP.attr.oModel && typeof oAPP.attr.oModel.refresh === "function") {
          oAPP.attr.oModel.refresh();
        }
      }

      //DIALOG 종료.
      lf_dialogClose(true);

      //메시지 처리.
      if (typeof param.RTMSG !== "undefined" && param.RTMSG !== "") {
        parent.showMessage(null, 10, "S", param.RTMSG);
      }

      //RETURN 받은 CTS번호가 존재하는경우.
      if (typeof param.REQNO !== "undefined" && param.REQNO !== "") {
        //해당 CTS 번호 매핑 처리.
        oAPP.attr.appInfo.REQNR = param.REQNO;
        oAPP.attr.appInfo.REQNO = param.REQNO;
      }


    }, "", true, "POST", function (e) {
      //오류 발생시 lock 해제.
      oAPP.fn.designAreaLockUnlock();

    });

  } //서버이벤트 생성 처리.



  //팝업 title 설정.
  function lf_setTitle() {

    //B09  Server Event Create
    var l_title = APPCOMMON.fnGetMsgClsText("/U4A/CL_WS_COMMON", "B09", "", "", "", "");

    if (typeof is_attr !== "undefined" && is_attr) {
      l_title = l_title + " - " + is_attr.UIATT;
    }

    return l_title;

  } //팝업 title 설정.


  // ── 다이얼로그 골격 ──────────────────────────────────────────────
  lf_ensureStyle();

  var oDlg = document.createElement("dialog");
  oDlg.id = "u4aWsCreateEventDlg";
  oDlg.className = "u4a-dialog u4aEvtPopDlg";

  //헤더 — 원본 icon "add-document" 과 동일 의미의 fa 아이콘.
  var oHeader = _el("div", "u4a-dialog__header");
  oHeader.innerHTML = _fa("file-circle-plus") + "<span></span>";
  oHeader.querySelector("span").textContent = lf_setTitle();

  //A39  Close — 우상단 닫기버튼(공통 .u4a-btn-icon, hover 빨강).
  var oXBtn = _el("button", "u4a-btn-icon");
  oXBtn.type = "button";
  oXBtn.setAttribute("data-act", "close");
  oXBtn.innerHTML = _fa("xmark");
  oXBtn.title = _txt("/U4A/CL_WS_COMMON", "A39");
  oXBtn.addEventListener("click", function () { lf_dialogClose(); });
  oHeader.appendChild(oXBtn);
  oDlg.appendChild(oHeader);

  //바디
  var oBody = _el("div", "u4a-dialog__body u4aEvtPopBody");
  oDlg.appendChild(oBody);

  //A34  Method Name (required) — 입력 + clear(X) + value-state + Suggestion.
  var oR1 = lf_row(_txt("/U4A/CL_WS_COMMON", "A34"), true);
  var oMethWrap = _el("div", "u4a-field");
  oMethWrap.setAttribute("data-trail", "1");
  var oMethInp = _el("input", "u4a-input u4a-field__input");
  oMethInp.maxLength = 27;                 //원본 maxLength:27
  oMethInp.autocomplete = "off";           //원본 autocomplete:false(브라우저 자동완성 방지)
  oMethInp.setAttribute("spellcheck", "false");
  oMethWrap.appendChild(oMethInp);
  var oMethClear = _buildClearBtn();
  oMethWrap.appendChild(oMethClear);
  oR1.control.appendChild(oMethWrap);
  var oMethMsg = oR1.msg;
  oBody.appendChild(oR1.row);

  //A35  Description (required) — 입력 + clear(X) + value-state + Suggestion.
  var oR2 = lf_row(_txt("/U4A/CL_WS_COMMON", "A35"), true);
  var oDescWrap = _el("div", "u4a-field");
  oDescWrap.setAttribute("data-trail", "1");
  var oDescInp = _el("input", "u4a-input u4a-field__input");
  oDescInp.maxLength = 40;                  //원본 maxLength:40
  oDescInp.autocomplete = "off";
  oDescInp.setAttribute("spellcheck", "false");
  oDescWrap.appendChild(oDescInp);
  var oDescClear = _buildClearBtn();
  oDescWrap.appendChild(oDescClear);
  oR2.control.appendChild(oDescWrap);
  var oDescMsg = oR2.msg;
  oBody.appendChild(oR2.row);

  //푸터 — Create(A01, 확정) / Close(A39, 취소)
  var oFoot = _el("div", "u4a-dialog__footer u4aEvtPopFoot");

  //A01  Create — 이벤트 생성 버튼(emphasized).
  var oOkBtn = _el("button", "u4a-btn u4a-btn--emphasized");
  oOkBtn.type = "button";
  oOkBtn.innerHTML = _fa("check");   // 아이콘만 (텍스트 라벨 제거)
  oOkBtn.title = _txt("/U4A/CL_WS_COMMON", "A01");
  oFoot.appendChild(oOkBtn);

  //A39  Close — 닫기 버튼(Reject 느낌 negative).
  var oCancelBtn = _el("button", "u4a-btn u4a-btn--negative");
  oCancelBtn.type = "button";
  oCancelBtn.innerHTML = _fa("xmark");   // X 아이콘만 (텍스트 라벨 제거)
  oCancelBtn.title = _txt("/U4A/CL_WS_COMMON", "A39"); // Close
  oFoot.appendChild(oCancelBtn);
  oDlg.appendChild(oFoot);


  //이벤트 생성 이벤트(구 oBtn1.attachPress).
  oOkBtn.addEventListener("click", function () {

    //busy dialog open.
    parent.setBusy("X");

    //입력값 점검 오류가 발생한 경우 exit.
    if (lf_chkInputVal() === true) {
      //busy dialog close.
      parent.setBusy("");
      return;
    }

    //서버이벤트 생성 처리.
    lf_createEventMethod();

  });

  //팝업 종료 이벤트(구 oBtn2.attachPress).
  oCancelBtn.addEventListener("click", function () { lf_dialogClose(); });

  //엔터→Create 편의 처리는 attachSuggest 등록 뒤에 배선(아래) — 제안목록 항목 선택 Enter 가
  //  먼저 처리되도록(attachSuggest 가 stopImmediatePropagation, 등록 순서상 먼저 실행).

  //clear(X) — 값 있을 때만 노출(공통 U4AUI.attachClear).
  if (window.U4AUI && U4AUI.attachClear) {
    U4AUI.attachClear(oMethInp, oMethClear);
    U4AUI.attachClear(oDescInp, oDescClear);
  }

  //Suggestion 등록(구 setUiSuggest) — 이력 기반 자동완성(공통 U4AUI.attachSuggest).
  //  fnSuggestionRead 가 [{NAME}] 형태로 저장 → 이름만 추려 제안.
  if (window.U4AUI && U4AUI.attachSuggest && typeof oAPP.fn.fnSuggestionRead === "function") {
    U4AUI.attachSuggest(oMethInp, function () {
      try { return (oAPP.fn.fnSuggestionRead("crtServEvtMethName") || []).map(function (o) { return o && o.NAME; }).filter(Boolean); }
      catch (e) { return []; }
    });
    U4AUI.attachSuggest(oDescInp, function () {
      try { return (oAPP.fn.fnSuggestionRead("crtServEvtMethDesc") || []).map(function (o) { return o && o.NAME; }).filter(Boolean); }
      catch (e) { return []; }
    });
  }

  //편의: 어느 입력칸이든 Enter → Create 실행. (구 "다음칸 포커스" 대신 바로 생성)
  //  ★ attachSuggest 등록 뒤에 배선해 "제안목록에서 항목 선택 중인 Enter"는 attachSuggest 가
  //    먼저(stopImmediatePropagation) 가로채 처리 → 그땐 이 핸들러가 안 불린다.
  //  ★ IME(한글 등) 조합 확정 Enter 는 무시(keyCode 229 / isComposing) — 오submit 방지.
  function lf_enterCreate(e) {
    if (e.key !== "Enter") { return; }
    if (e.isComposing || e.keyCode === 229) { return; }
    e.preventDefault();
    oOkBtn.click();
  }
  oMethInp.addEventListener("keydown", lf_enterCreate);
  oDescInp.addEventListener("keydown", lf_enterCreate);

  //ESC → 취소(닫기)(구 footer Close).
  oDlg.addEventListener("cancel", function (e) { e.preventDefault(); lf_dialogClose(); });

  //헤더 드래그는 공통 전역 위임(.u4a-dialog__header)으로 자동 — 배선 불필요.
  //더블클릭 리센터 / 우하단 grip 리사이즈는 팝업별 공통 헬퍼 호출(전 팝업 동일 UX).
  if (window.U4AUI && U4AUI.makeDialogRecenter) { U4AUI.makeDialogRecenter(oDlg, oHeader); }
  if (window.U4AUI && U4AUI.makeDialogResizable) { U4AUI.makeDialogResizable(oDlg, { minW: 360, minH: 240 }); }

  document.body.appendChild(oDlg);

  //서버이벤트 생성 팝업 호출(구 oDlg.open()).
  try { oDlg.showModal(); } catch (e) { document.body.appendChild(oDlg); }

  //dialog 호출시 이벤트(구 oDlg.attachAfterOpen).
  parent.setBusy("");
  oAPP.fn.setShortcutLock(false);

  //메소드명에 focus 처리.
  requestAnimationFrame(function () {
    try { oMethInp.focus(); } catch (e) { }
  });

}; // 이벤트 생성 팝업 호출.
