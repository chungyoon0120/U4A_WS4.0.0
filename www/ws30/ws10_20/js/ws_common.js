
/************************************************************************
 * Copyright 2020. INFOCG Inc. all rights reserved. 
 * ----------------------------------------------------------------------
 * - file Name : ws_common.js
 * - file Desc : ws 공통 스크립트
 ************************************************************************/
(function (window, $, oAPP) {
    "use strict";

    oAPP.common = {};

    const
        REMOTE = parent.REMOTE,
        IPCRENDERER = parent.IPCRENDERER,
        APP = REMOTE.app,
        PATH = REMOTE.require('path'),
        APPPATH = APP.getAppPath(),
        APPCOMMON = oAPP.common;

    var oSettings = parent.WSUTIL.getWsSettingsInfo();

    const
        SYSADM_BIND_ROOT = "/SYSADM";

    /******************************************************************
     *  SAP 시스템 메시지 출력
     ******************************************************************/
    oAPP.common.showSystemNotiMsg = async function () {

        // 1. 서버 호출
        var sServicePath = parent.getServerPath() + "/set_sys_noti_message";

        let response;

        try {

            response = await fetch(sServicePath);

            if (!response.ok) {

                // 콘솔용 오류 메시지
                var aConsoleMsg = [
                    `\n######################################`,
                    `## 시스템 공지사항 서비스 호출`,
                    `######################################`,
                    `[REQ_URL]: ${sServicePath}`,
                    `=> WSUTIL.showSystemNoticeMessage`,
                    `=> response = await fetch()`,
                    `=> response.ok?    ${response.ok}`,
                    `=> response.status?    ${response.status}`,
                    `######################################`,
                ];
                console.error(aConsoleMsg.join("\r\n"));

                return;
            }


        } catch (error) {

            // 콘솔용 오류 메시지
            var aConsoleMsg = [
                `\n######################################`,
                `## 시스템 공지사항 서비스 호출`,
                `######################################`,
                `[REQ_URL]: ${sServicePath}`,
                `[REASON]: ${error.name}`,
                `=> WSUTIL.showSystemNoticeMessage`,
                `=> response = await fetch()`,
                `=> try..catch 블록`,
                `######################################`,
            ];
            console.error(aConsoleMsg.join("\r\n"));
            console.error(error);

            return;
        }

        try {

            var oResult = await response.json();
            if (oResult.RETCD === "E") {
                return;
            }

            let oRDATA = oResult?.RDATA || undefined;
            if (!oRDATA) {
                return;
            }

            let sNotiScript = oRDATA?.SYS_NOTI_SCR || "";
            if (!sNotiScript) {
                return;
            }

            // 2. [HTML5] 구 eval(sNotiScript) 는 sap.m.Dialog/MessageView/MessageItem 등
            //    UI5 컨트롤 생성 스크립트라 UI5 제거 환경에선 실행 불가.
            //    → 백엔드(/U4A/SP200002 SET_SYS_NOTI_MESSAGE)가 내려준 스크립트에서
            //      제목/부제/본문만 파싱(_parseSysNotiScript)해, 동일 모양의 네이티브
            //      다이얼로그(_renderSysNotiDialog)로 그린다.
            var aNotiItems = _parseSysNotiScript(sNotiScript);
            if (!aNotiItems.length) { return; }
            _renderSysNotiDialog(aNotiItems, _parseSysNotiTitle(sNotiScript));

        } catch (error) {

            // 콘솔용 오류 메시지
            var aConsoleMsg = [
                `\n######################################`,
                `## 시스템 공지사항 서비스 호출`,
                `######################################`,
                `[REQ_URL]: ${sServicePath}`,
                `=> WSUTIL.showSystemNoticeMessage`,
                `=> await response.json()`,
                `=> try..catch 블록`,
                `=> 응답 포맷 오류`,
                `######################################`,
            ];
            console.error(aConsoleMsg.join("\r\n"));
            console.error(error);

            return;
        }

    }; // end of oAPP.common.showSystemNotiMsg


    /******************************************************************
     *  [HTML5] 시스템 공지 다이얼로그 — UI5 스크립트 파싱 & 네이티브 렌더
     * ----------------------------------------------------------------
     *  백엔드(/U4A/SP200002)가 내려주는 SYS_NOTI_SCR 은 sap.m.Dialog +
     *  sap.m.MessageView + sap.m.MessageItem 생성 JS 다. UI5 가 없으므로
     *  eval 대신 스크립트에서 항목(제목/부제/본문)만 추출해 동일 모양으로 그린다.
     *
     *  원본 스크립트 항목 포맷(반복):
     *    var oMi = new sap.m.MessageItem({type:"Information",subtitle:"<부제>"});
     *    oMi.setTitle("<제목>"); oMi.setDescription("<본문>"); oMv.addItem(oMi);
     *  헤더 라벨: new sap.m.ObjectNumber({number:"System Message", ...})
     ******************************************************************/

    // JS 문자열 리터럴 이스케이프 해제(\n \t \" \\ \/ \uXXXX 등).
    function _sysNotiUnescape(s) {
        return String(s).replace(/\\(u[0-9a-fA-F]{4}|x[0-9a-fA-F]{2}|.)/g, function (m, p) {
            switch (p.charAt(0)) {
                case "n": return "\n";
                case "r": return "\r";
                case "t": return "\t";
                case "b": return "\b";
                case "f": return "\f";
                case "v": return "\v";
                case "0": return "\0";
                case "u": return String.fromCharCode(parseInt(p.slice(1), 16));
                case "x": return String.fromCharCode(parseInt(p.slice(1), 16));
                default: return p; // \" → "  /  \\ → \  /  \/ → /
            }
        });
    }

    // 스크립트 → 항목 배열 [{ subtitle, title, description }] (원본 등장 순서).
    function _parseSysNotiScript(sScript) {
        var aItems = [];
        if (typeof sScript !== "string" || !sScript) { return aItems; }
        // MessageItem 생성 + setTitle + setDescription 한 묶음을 항목 1개로 캡처.
        //   (?:\\.|[^"\\])*  = JS 문자열 리터럴 내부(이스케이프 허용) 매칭.
        var re = /new sap\.m\.MessageItem\(\{type:"[^"]*",subtitle:"((?:\\.|[^"\\])*)"\}\);\s*oMi\.setTitle\("((?:\\.|[^"\\])*)"\);\s*oMi\.setDescription\("((?:\\.|[^"\\])*)"\);/g;
        var m;
        while ((m = re.exec(sScript)) !== null) {
            aItems.push({
                subtitle: _sysNotiUnescape(m[1]),
                title: _sysNotiUnescape(m[2]),
                description: _sysNotiUnescape(m[3])
            });
        }
        return aItems;
    }

    // 헤더 라벨(ObjectNumber number) 추출. 없으면 "System Message".
    function _parseSysNotiTitle(sScript) {
        var m = /new sap\.m\.ObjectNumber\(\{number:"((?:\\.|[^"\\])*)"/.exec(sScript || "");
        return m ? _sysNotiUnescape(m[1]) : "System Message";
    }

    // 공통 스타일 1회 주입(테마 토큰 소비 — 하드코딩 색 없음).
    function _ensureSysNotiStyle() {
        if (document.getElementById("u4aSysNotiStyle")) { return; }
        var o = document.createElement("style");
        o.id = "u4aSysNotiStyle";
        o.textContent = ""
            + ".u4aSysNotiDlg{width:min(92vw,520px);height:min(72vh,520px);padding:0;display:flex;flex-direction:column;}"
            + ".u4aSysNotiDlg .u4a-dialog__header{cursor:move;user-select:none;}"
            + ".u4aSysNotiDlg .u4a-dialog__header span{flex:1 1 auto;}"
            + ".u4aSysNotiBody{flex:1 1 auto;overflow:auto;padding:0;}"
            + ".u4aSysNotiRow{display:flex;align-items:flex-start;gap:.625rem;width:100%;text-align:left;"
            + "padding:.75rem 1rem;border:0;border-bottom:.0625rem solid var(--line);background:transparent;"
            + "font:inherit;color:var(--text);cursor:pointer;}"
            + ".u4aSysNotiRow:hover{background:var(--hover-bg);}"
            + ".u4aSysNotiIco{color:var(--accent);margin-top:.125rem;}"
            + ".u4aSysNotiMeta{flex:1 1 auto;min-width:0;}"
            + ".u4aSysNotiTitle{font-weight:600;overflow:hidden;text-overflow:ellipsis;}"
            + ".u4aSysNotiSub{font-size:.8125rem;color:var(--text-muted);margin-top:.125rem;}"
            + ".u4aSysNotiChev{color:var(--icon-muted);margin-top:.125rem;}"
            + ".u4aSysNotiDetail{padding:1rem 1.25rem 1.5rem;}"
            + ".u4aSysNotiBack{margin-bottom:.75rem;}"
            + ".u4aSysNotiDetail .u4aSysNotiTitle{font-size:1rem;font-weight:700;display:flex;align-items:center;gap:.5rem;}"
            + ".u4aSysNotiDetail .u4aSysNotiSub{margin:.25rem 0 1rem;}"
            + ".u4aSysNotiDesc{white-space:pre-wrap;line-height:1.5;color:var(--text);}"
            + ".u4aSysNotiFoot{display:flex;justify-content:flex-end;}";
        document.head.appendChild(o);
    }

    function _sysNotiEl(sTag, sClass, sText) {
        var e = document.createElement(sTag);
        if (sClass) { e.className = sClass; }
        if (typeof sText !== "undefined") { e.textContent = sText; }
        return e;
    }

    var _fa_sn = function (s) { return '<i class="fa-solid fa-' + s + '"></i>'; };

    // 항목 배열 → 네이티브 다이얼로그 렌더(원본 sap.m.Dialog+MessageView 모양).
    function _renderSysNotiDialog(aItems, sHeaderTitle) {

        _ensureSysNotiStyle();

        // 이미 떠 있으면 제거 후 재생성.
        var oOld = document.getElementById("u4aSysNotiDlg");
        if (oOld) { try { oOld.close(); } catch (e) { } oOld.remove(); }

        var sClose = "Close";
        try {
            var s = APPCOMMON.fnGetMsgClsText("/U4A/CL_WS_COMMON", "A39");
            if (s && s.indexOf("|") === -1) { sClose = s; }
        } catch (e) { }

        var oDlg = document.createElement("dialog");
        oDlg.id = "u4aSysNotiDlg";
        oDlg.className = "u4a-dialog u4aSysNotiDlg";

        // 헤더 — 원본: 종이비행기 아이콘 + "System Message".
        var oHeader = _sysNotiEl("div", "u4a-dialog__header");
        oHeader.innerHTML = _fa_sn("paper-plane") + "<span></span>";
        oHeader.querySelector("span").textContent = sHeaderTitle || "System Message";
        var oX = _sysNotiEl("button", "u4a-btn-icon");
        oX.type = "button";
        oX.setAttribute("data-act", "close");
        oX.innerHTML = _fa_sn("xmark");
        oX.title = sClose;
        oX.addEventListener("click", function () { _sysNotiClose(oDlg); });
        oHeader.appendChild(oX);
        oDlg.appendChild(oHeader);

        // 바디 — 리스트 / 상세 두 영역.
        var oBody = _sysNotiEl("div", "u4a-dialog__body u4aSysNotiBody");
        oDlg.appendChild(oBody);

        var oList = _sysNotiEl("div", "u4aSysNotiList");
        var oDetail = _sysNotiEl("div", "u4aSysNotiDetail");
        oBody.appendChild(oList);
        oBody.appendChild(oDetail);

        function _showList() { oList.hidden = false; oDetail.hidden = true; }
        function _showDetail(i, bHasBack) {
            var it = aItems[i];
            oDetail.innerHTML = "";
            if (bHasBack) {
                var oBack = _sysNotiEl("button", "u4a-btn u4aSysNotiBack");
                oBack.type = "button";
                oBack.innerHTML = _fa_sn("chevron-left") + "<span></span>";
                oBack.querySelector("span").textContent = sClose === "Close" ? "List" : sClose; // 목록으로
                oBack.addEventListener("click", _showList);
                // 목록 라벨은 코드 폴백("List") — 메시지키 없으면 닫기 라벨 대신 최소 표기.
                oDetail.appendChild(oBack);
            }
            var oT = _sysNotiEl("div", "u4aSysNotiTitle");
            oT.innerHTML = '<span class="u4aSysNotiIco">' + _fa_sn("circle-info") + "</span>";
            oT.appendChild(_sysNotiEl("span", null, it.title));
            oDetail.appendChild(oT);
            oDetail.appendChild(_sysNotiEl("div", "u4aSysNotiSub", it.subtitle));
            oDetail.appendChild(_sysNotiEl("div", "u4aSysNotiDesc", it.description));
            oList.hidden = true; oDetail.hidden = false;
        }

        if (aItems.length === 1) {
            // 원본 MessageView: 1건이면 상세 바로 표시(목록/뒤로 없음).
            _showDetail(0, false);
        } else {
            aItems.forEach(function (it, i) {
                var oRow = _sysNotiEl("button", "u4aSysNotiRow");
                oRow.type = "button";
                oRow.innerHTML = '<span class="u4aSysNotiIco">' + _fa_sn("circle-info") + "</span>";
                var oMeta = _sysNotiEl("div", "u4aSysNotiMeta");
                oMeta.appendChild(_sysNotiEl("div", "u4aSysNotiTitle", it.title));
                oMeta.appendChild(_sysNotiEl("div", "u4aSysNotiSub", it.subtitle));
                oRow.appendChild(oMeta);
                var oChev = _sysNotiEl("span", "u4aSysNotiChev");
                oChev.innerHTML = _fa_sn("chevron-right");
                oRow.appendChild(oChev);
                oRow.addEventListener("click", function () { _showDetail(i, true); });
                oList.appendChild(oRow);
            });
            _showList();
        }

        // 푸터 — 닫기(원본 Accept 버튼 = 강조).
        var oFoot = _sysNotiEl("div", "u4a-dialog__footer u4aSysNotiFoot");
        var oCloseBtn = _sysNotiEl("button", "u4a-btn u4a-btn--emphasized");
        oCloseBtn.type = "button";
        oCloseBtn.innerHTML = _fa_sn("xmark");   // 아이콘만 (텍스트 라벨 제거)
        oCloseBtn.title = sClose;
        oCloseBtn.addEventListener("click", function () { _sysNotiClose(oDlg); });
        oFoot.appendChild(oCloseBtn);
        oDlg.appendChild(oFoot);

        // ESC → 닫기.
        oDlg.addEventListener("cancel", function (e) { e.preventDefault(); _sysNotiClose(oDlg); });

        // 헤더 드래그(화면 밖/상단 공통헤더 침범 방지) — 공통 U4AUI.makeDialogDraggable.
        if (window.U4AUI && U4AUI.makeDialogDraggable) { U4AUI.makeDialogDraggable(oDlg, oHeader); }

        document.body.appendChild(oDlg);
        oDlg.showModal();
    }

    function _sysNotiClose(oDlg) {
        try { oDlg.close(); } catch (e) { }
        try { oDlg.remove(); } catch (e) { }
    }


    /************************************************************************
     * Child Window를 활성/비활성 처리 한다.
     * **********************************************************************
     * @param {Boolean} bIsShow 
     * - true : child window 보이기
     * - false : child window 숨김
     * **********************************************************************/
    oAPP.common.fnIsChildWindowShow = function (bIsShow) {

        var oCurrWin = REMOTE.getCurrentWindow(),
            aChild = oCurrWin.getChildWindows(),
            iChildCnt = aChild.length;

        if (iChildCnt <= 0) {
            return;
        }

        for (var i = 0; i < iChildCnt; i++) {
            var oChild = aChild[i];

            if (bIsShow) {
                oChild.show();
            } else {
                oChild.hide();
            }

        }

    }; // end of oAPP.common.fnIsChildWindowShow

    /************************************************************************
     * 모델 데이터 set
     * **********************************************************************
     * @param {String} sModelPath  
     * - Model Path 명
     * 예) /WS10/APPDATA
     * @param {Object} oModelData
     * 
     * @param {Boolean} bIsRefresh 
     * model Refresh 유무
     ************************************************************************/
    oAPP.common.fnSetModelProperty = function (sModelPath, oModelData, bIsRefresh) {

        var oCoreModel = sap.ui.getCore().getModel();
        if (!oCoreModel) {
            return;
        }

        oCoreModel.setProperty(sModelPath, oModelData);

        if (bIsRefresh) {
            oCoreModel.refresh(true);
        }

    }; // end of oAPP.common.fnSetModelProperty

    /************************************************************************
     * 모델 데이터 get
     * **********************************************************************
     * @param {String} sModelPath  
     * - Model Path 명
     * 예) /WS10/APPDATA
     ************************************************************************/
    oAPP.common.fnGetModelProperty = function (sModelPath) {

        let oCoreModel = sap.ui.getCore().getModel();
        if (!oCoreModel) {
            return;
        }

        return oCoreModel.getProperty(sModelPath);

    }; // end of oAPP.common.fnGetModelProperty    


    oAPP.common.fnGetMsgClsText = (sMsgCls, sMsgNum, p1, p2, p3, p4) => {

        // console.log("msg2");

        let oUserInfo = parent.getUserInfo();        
        let sLangu = oUserInfo.LANGU;
        
        return parent.WSUTIL.getWsMsgClsTxt(sLangu, sMsgCls, sMsgNum, p1, p2, p3, p4);

        // // Metadata에서 메시지 클래스 정보를 구한다.
        // var oMeta = parent.getMetadata(),
        //     oUserInfo = parent.getUserInfo(),
        //     sLangu = oUserInfo.LANGU,
        //     // sLangu = oUserInfo.WSLANGU,
        //     aMsgClsTxt = oMeta["MSGCLS"];

        // if (!aMsgClsTxt || !aMsgClsTxt.length) {
        //     return sMsgCls + "|" + sMsgNum;
        // }

        // // let sDefLangu = "E"; // default language    
        // let sDefLangu = "EN"; // default language    

        // // 현재 접속한 언어로 메시지를 찾는다.
        // let oMsgTxt = aMsgClsTxt.find(a => a.ARBGB == sMsgCls && a.LANGU == sLangu && a.MSGNR == sMsgNum);

        // // 현재 접속한 언어로 메시지를 못찾은 경우
        // if (!oMsgTxt) {

        //     // 접속한 언어가 영어일 경우 빠져나간다.
        //     if (sDefLangu == sLangu) {
        //         return sMsgCls + "|" + sMsgNum;

        //     }

        //     // 접속한 언어가 영어가 아닌데 메시지를 못찾으면 영어로 찾는다.
        //     oMsgTxt = aMsgClsTxt.find(a => a.ARBGB == sMsgCls && a.LANGU == sDefLangu && a.MSGNR == sMsgNum);

        //     // 그래도 없다면 빠져나간다.
        //     if (!oMsgTxt) {
        //         return sMsgCls + "|" + sMsgNum;
        //     }

        // }

        // var sText = oMsgTxt.TEXT,
        //     aWithParam = [];

        // // 파라미터로 전달 받은 Replace Text 수집
        // aWithParam.push(p1 == null ? "" : p1);
        // aWithParam.push(p2 == null ? "" : p2);
        // aWithParam.push(p3 == null ? "" : p3);
        // aWithParam.push(p4 == null ? "" : p4);

        // var iWithParamLenth = aWithParam.length;
        // if (iWithParamLenth == 0) {
        //     return sText;
        // }

        // // 메시지 클래스 텍스트에서 "& + 숫자" (예: &1) 값이 있는 것부터 순차적으로 치환한다.
        // for (var i = 0; i < iWithParamLenth; i++) {

        //     var index = i + 1,
        //         sParamTxt = aWithParam[i];

        //     var sRegEx = "&" + index,
        //         oRegExp = new RegExp(sRegEx, "g");

        //     sText = sText.replace(oRegExp, sParamTxt);

        // }

        // sText = sText.replace(new RegExp("&\\d+", "g"), "");

        // // 메시지 클래스 텍스트에서 "&" 를 앞에서 부터 순차적으로 치환한다."
        // for (var i = 0; i < iWithParamLenth; i++) {

        //     var sParamTxt = aWithParam[i];

        //     sText = sText.replace(new RegExp("&", "i"), sParamTxt);

        // }

        // sText = sText.replace(new RegExp("&", "g"), "");

        // return sText;

    }; // end of oAPP.common.fnGetMsgClsText


    /******************************************************************
     * 서버 요청 메시지 텍스트 구하기
     ******************************************************************/
    oAPP.common.fnGetAjaxReqMsgTxt = function (sMsgCls, sPath) {

        let oUserInfo = parent.getUserInfo();
        let sLangu = oUserInfo.LANGU;

        let sMsgTxtFilePath = parent.PATH.join(parent.APPPATH, "MSG", "AJAX_REQ_MSG", sLangu, sMsgCls + ".json");

        if (!parent.FS.existsSync(sMsgTxtFilePath)) {
            return `${sMsgCls}|${sPath}|${sLangu}`;
        }

        let sMsgListJson = parent.FS.readFileSync(sMsgTxtFilePath, "utf-8");

        try {
            var aMsgList = JSON.parse(sMsgListJson);
        } catch (error) {
            return `${sMsgCls}|${sPath}|${sLangu}|JSON Parse Error`;
        }

        if (!Array.isArray(aMsgList)) {
            return `${sMsgCls}|${sPath}|${sLangu}|Invalid JSON Format`;
        }

        let oFindTxt = aMsgList.find(e => e.REQ_PATH === sPath);

        if (!oFindTxt) {
            return "";
        }

        return oFindTxt.REQ_TEXT || "";

    }; // end of oAPP.common.fnGetAjaxReqMsgTxt


    /************************************************************************
     * z-Index 구하기
     * **********************************************************************/
    oAPP.common.fnGetZIndex = function () {
        return sap.ui.core.Popup.getNextZIndex();
    };

    /************************************************************************
     * 각 페이지 이동 시 푸터 메시지가 있으면 숨김처리
     ************************************************************************/
    oAPP.common.fnHideFloatingFooterMsg = function () {

        if (oAPP.attr.footerMsgTimeout) {
            clearTimeout(oAPP.attr.footerMsgTimeout);
            delete oAPP.attr.footerMsgTimeout;
        }

        // Footer 메시지 모델 초기화
        oAPP.common.fnSetModelProperty("/FMSG", {});

    }; // end of oAPP.common.fnHideFloatingFooterMsg

    /************************************************************************
     * 멀티 푸터 메시지 닫기
     ************************************************************************/
    oAPP.common.fnMultiFooterMsgClose = function () {

        var sPopupName = "ERRMSGPOP";

        // 기존에 멀티 푸터 메시지 팝업이 열렸을 경우 닫는다
        var oResult = APPCOMMON.getCheckAlreadyOpenWindow(sPopupName);
        if (oResult.ISOPEN === true && oResult.WINDOW.isDestroyed() === false) {

            try {
                oResult.WINDOW.close();
            } catch (error) {

            }

        }

    }; // end of oAPP.common.fnMultiFooterMsgClose

    /************************************************************************
     * 각 페이지의 짧은 푸터 메시지
     * **********************************************************************
     * @param {CHAR1} TYPE  
     * - S : success
     * - E : error
     * - W : warning
     * - I : information
     * @param {String} POS
     * - footer message를 실행할 화면 위치 정보
     * 예) WS10, WS20
     * @param {String} MSG  
     ************************************************************************/
    oAPP.common.fnShowFloatingFooterMsg = function (TYPE, POS, MSG) {

        oAPP.common.fnHideFloatingFooterMsg();

        var oMsg = {};

        // 메시지 타입별 아이콘 및 아이콘 색상 지정
        switch (TYPE) {
            case "S":
                oMsg.ICON = "sap-icon://message-success";
                oMsg.ICONCOLOR = "#abe2ab";

                parent.setSoundMsg('01'); // sap sound(success)
                break;

            case "E":
                oMsg.ICON = "sap-icon://message-error";
                oMsg.ICONCOLOR = "#f88";

                parent.setSoundMsg('02'); // sap sound(error)
                break;

            case "W":
                oMsg.ICON = "sap-icon://message-warning";
                oMsg.ICONCOLOR = "#f9a429";
                parent.setSoundMsg('01'); // sap sound(success)		

                break;

            case "I":
                oMsg.ICON = "sap-icon://message-information";
                oMsg.ICONCOLOR = "#346187";
                parent.setSoundMsg('01'); // sap sound(success)

                break;
        }

        oMsg.ISSHOW = true;
        oMsg.TXT = MSG;

        // 메시지 정보를 모델에 세팅
        oAPP.common.fnSetModelProperty("/FMSG/" + POS, oMsg);

        // 이전 timeout이 존재하면 일단 다 날리고 시작
        if (oAPP.attr.footerMsgTimeout) {
            clearTimeout(oAPP.attr.footerMsgTimeout);
            delete oAPP.attr.footerMsgTimeout;
        }

        // timeout 시간이 도래되면 Footer Message를 지운다.
        oAPP.attr.footerMsgTimeout = setTimeout(function () {

            oAPP.common.fnHideFloatingFooterMsg();

            clearTimeout(oAPP.attr.footerMsgTimeout);
            delete oAPP.attr.footerMsgTimeout;

        }, 10000);

    }; // end of oAPP.common.fnShowFloatingFooterMsg

    /*************************************************************************
     * [공통] 단축키 실행 할지 말지 여부 체크
     * @deprecated Deprecated as of version v3.5.7-3
     * [oAPP.common.isProcessRunning] instead.
     **************************************************************************/
    /************************************************************************
     * [HTML5] 단축키 공통 가드 — 모든 페이지 단축키 핸들러의 단일 방어 통로.
     *   화면별 super-wrap(_scGuard/_ws20ScGuard 등)이 이 함수에 위임한다(중복 제거).
     *   순서대로 방어:
     *     (1) 꾹 누름(auto-repeat) — e.repeat
     *     (2) 현재 화면 일치 — parent.getCurrPage() === sPage (다른 화면 단축키 오발화 방지)
     *     (3) 종합 실행가능 체크 — fnShortCutExeAvaliableCheck(): busy / 메뉴열림(.u4a-menu) /
     *         다이얼로그열림 / isShortcutLock / 페이지이동중(isNaviBusy) 전부 포함(원본 종합 체크).
     *   ※ "연타/재진입"은 (3)의 isNaviBusy·busy·다이얼로그 체크가 막는다(비동기 액션이 in-flight
     *      플래그를 들고 있는 동안 같은/다른 단축키 모두 차단). 동기 액션은 즉시 끝나 영향 없음.
     * @param {KeyboardEvent} e
     * @param {string} sPage  이 단축키가 유효한 화면 ("WS10"/"WS20"/"WS30")
     * @param {Function} fnAction  실제 동작
     ************************************************************************/
    oAPP.common.fnRunShortCut = function (e, sPage, fnAction) {
        try { if (e && e.stopImmediatePropagation) { e.stopImmediatePropagation(); } } catch (x) { }
        try { if (e && e.preventDefault) { e.preventDefault(); } } catch (x) { }
        if (e && e.repeat === true) { return; }                                                          // (1)
        try { if (sPage && parent.getCurrPage && parent.getCurrPage() !== sPage) { return; } } catch (x) { } // (2)
        try { if (oAPP.common.fnShortCutExeAvaliableCheck && oAPP.common.fnShortCutExeAvaliableCheck() === "X") { return; } } catch (x) { } // (3)
        try { fnAction(e); } catch (err) { console.error("[HTML5][shortcut][" + sPage + "]", err); }
    }; // end of oAPP.common.fnRunShortCut

    /************************************************************************
     * [HTML5] 페이지 이동 in-flight 락 set/clear — 원본 sap.lock/isLocked 재진입 락 대체.
     *   비동기 네비게이션(fnMoveToWs10 등) 시작 시 lock, 완료/실패 시 release.
     *   release 누락으로 영구 잠김 되지 않도록 lock 시 안전 타임아웃(backstop) 자동 설정.
     ************************************************************************/
    oAPP.common.fnNaviLock = function () {
        oAPP.attr.isNaviBusy = true;
        try { clearTimeout(oAPP.attr._naviBusyTimer); } catch (x) { }
        // backstop: 정상 경로는 완료 시 release 하지만, 서버응답 누락/예외로 release 를 놓쳐도
        //   8초 후 자동 해제(그 이상 걸리면 이미 행 상태) → 단축키가 영구로 막히지 않게.
        oAPP.attr._naviBusyTimer = setTimeout(function () { oAPP.attr.isNaviBusy = false; }, 8000);
    };
    oAPP.common.fnNaviRelease = function () {
        oAPP.attr.isNaviBusy = false;
        try { clearTimeout(oAPP.attr._naviBusyTimer); oAPP.attr._naviBusyTimer = null; } catch (x) { }
    };

    oAPP.common.fnShortCutExeAvaliableCheck = () => {

        if (oAPP.attr.isShortcutLock === true) {
            zconsole.log("!! isShortcutLock => true 여서 단축키 실행 불가 !! ");
            return "X";
        }

        // if (!oAPP.attr?.isShortcutLock) {
        //     return "X";
        // }

        // [HTML5] 페이지 이동(WS10↔WS20↔WS30) 이 진행 중이면 단축키 실행 불가 — 원본의
        //   sap.ui.getCore().lock()/isLocked() 재진입 락이 HTML5 에선 무효(sap 스텁)라, 그 역할을
        //   네비게이션 in-flight 플래그(isNaviBusy)로 대체한다. busy 가 비동기 이동 중 잠깐 풀리는
        //   구멍(저장확인창/주석처리된 busy 해제)으로 F3 연타 시 fnMoveToWs10 재진입→화면 깨짐 방지.
        if (oAPP.attr.isNaviBusy === true) {
            zconsole.log("!! 페이지 이동 중이라 단축키 실행 불가!!");
            return "X";
        }

        // Busy Indicator가 실행중인지 확인
        if (parent.getBusy() == 'X') {
            zconsole.log("!! Busy가 켜져 있어서 단축기 실행 불가!!");
            return "X";
        }

        // [HTML5] 드롭다운 메뉴(.u4a-menu: 윈도우메뉴/오버플로/split 등)가 떠 있으면 단축키 실행 불가.
        if (document.querySelector(".u4a-menu")) {
            zconsole.log("!! (HTML5) 메뉴가 떠 있어서 단축기 실행 불가!!");
            return "X";
        }

        // 화면에 메뉴 팝업이 떠있을 경우 단축키 실행 불가. (구 UI5 sapMMenu — HTML5 엔 없어 통과)
        var oMenuDom = document.querySelector(".sapMMenu");
        if (oMenuDom) {
            var sId = oMenuDom.id,
                oMenu = sap.ui.getCore().byId(sId);
            if (oMenu && oMenu.bOpen) {
                zconsole.log("!! 메뉴가 떠 있어서 단축기 실행 불가!!");
                return "X";
            }
        }

        // 현재 Dialog Popup이 실행 되어 있는지 확인. (HTML5 native <dialog open> 도 fnCheckIsDialogOpen 이 봄)
        var bIsDialogOpen = oAPP.fn.fnCheckIsDialogOpen();
        if (bIsDialogOpen) {
            zconsole.log("!! Dialog 팝업이 떠 있어서 단축기 실행 불가!!");
            return "X";
        }

        zconsole.log("!!___단축기 실행 가능__!!");

        return "";

    }; // end of oAPP.common.fnShortCutExeAvaliableCheck


    /*************************************************************************
     * 프로세스가 실행 중인지 상태 확인
     **************************************************************************/
    oAPP.common.isProcessRunning = function () {

        // 1. 락 걸린 상태인지?
        if (sap.ui.getCore().isLocked()) {
            return true;
        }

        // 2. 단축키 잠금 상태인지? ==> 이것도 프로세스 진행 중으로 판단.
        if (oAPP.attr.isShortcutLock === true) {
            return true;
        }

        // 3. Busy Indicator가 실행 중 인지?
        if (parent.getBusy() == 'X') {
            return true;
        }

        // 4. 화면에 메뉴 팝업이 떠있는 상태인지?
        //    [HTML5] 드롭다운 메뉴(.u4a-menu) 또는 구 UI5(.sapMMenu).
        if (document.querySelector(".u4a-menu")) {
            return true;
        }
        var oMenuDom = document.querySelector(".sapMMenu");
        if (oMenuDom) {
            var sId = oMenuDom.id,
                oMenu = sap.ui.getCore().byId(sId);
            if (oMenu && oMenu.bOpen) {
                return true;
            }
        }

        // 5. 현재 Dialog Popup(화면에 팝업)이 떠 있는지? (HTML5 native <dialog open> 포함 — fnCheckIsDialogOpen)
        var bIsDialogOpen = oAPP.fn.fnCheckIsDialogOpen();
        if (bIsDialogOpen) {
            return true;
        }

        return false;

    }; // end of isProcessRunning


    /*************************************************************************
     * Shortcut 설정
     **************************************************************************/
    oAPP.common.getShortCutList = function (sPgNo) {

        if (!sPgNo) {
            return [];
        }

        let sGlobalLangu = oSettings.globalLanguage;

        // parent.WSUTIL.getWsMsgClsTxt(sGlobalLangu, "ZMSG_WS_COMMON_001", "021");


        var aShortCutWS10 = [{
            KEY: "F11", // [WS10] FullScreen
            DESC: parent.WSUTIL.getWsMsgClsTxt(sGlobalLangu, "ZMSG_WS_COMMON_001", "255"), // Browser Fullscreen
            CODE: `new sap.m.Button({icon: "sap-icon://header"})`,
            fn: (e) => {

                e.stopImmediatePropagation();

                if (e.repeat === true) {
                    return;
                }

                // var oCurrWin = REMOTE.getCurrentWindow(), // 현재 window
                //     bIsFull = oCurrWin.isFullScreen();

                // oCurrWin.setFullScreen(!bIsFull);

                /***************************************
                 * 2024-07-01 soccerhs
                 ***************************************
                 * ## F11 기능 변경
                 * - 기존: 전체창(Kiosk) 모드
                 * - 변경: 브라우저 전체창 모드
                 ***************************************/
                // F11 = 브라우저 최대화 토글(원본 maxWinBtn.firePress). HTML5: maxWinBtn 은 DOM 버튼이라
                //   sap.byId 가 아닌 DOM 클릭으로 토글(아이콘 동기화는 click 핸들러 측 _syncMaxIcon 이 처리).
                var oMaxWinBtn = document.getElementById("maxWinBtn");
                if (oMaxWinBtn) {
                    oMaxWinBtn.click();
                }

            }
        }, {
            KEY: "Ctrl+Shift+F", // [WS10] textSearchPopup
            DESC: parent.WSUTIL.getWsMsgClsTxt(sGlobalLangu, "ZMSG_WS_COMMON_001", "256"), // Text Search Popup
            CODE: `new sap.m.Button({icon: "sap-icon://search"})`,
            fn: (e) => {

                e.stopImmediatePropagation();

                if (e.repeat === true) {
                    return;
                }

                if (sap.ui.getCore().isLocked()) {
                    zconsole.log("!! 락 걸려서 단축기 실행 불가!!");
                    return;
                }

                // 단축키 실행 할지 말지 여부 체크
                var result = oAPP.common.fnShortCutExeAvaliableCheck();

                // X 이면 실행 불가
                if (result == "X") {
                    return;
                }

                oAPP.fn.fnTextSearchPopupOpener();

            }
        }, {
            KEY: "Ctrl+F12", // [WS10] Application Create
            DESC: parent.WSUTIL.getWsMsgClsTxt(sGlobalLangu, "ZMSG_WS_COMMON_001", "257"), // Application Create
            CODE: `new sap.m.Button({
                text: oAPP.common.fnGetMsgClsText("/U4A/CL_WS_COMMON", "A01"),
                icon: "sap-icon://document",
                tooltip: oAPP.common.fnGetMsgClsText("/U4A/CL_WS_COMMON", "A01") + " (Ctrl+F12)",
            })`,
            fn: (e) => {

                e.stopImmediatePropagation();

                if (e.repeat === true) {
                    return;
                }

                // 단축키 실행 할지 말지 여부 체크
                var result = oAPP.common.fnShortCutExeAvaliableCheck();

                // X 이면 실행 불가
                if (result == "X") {
                    return;
                }

                var oAppCreateBtn = sap.ui.getCore().byId("appCreateBtn");
                if (!oAppCreateBtn || !oAppCreateBtn.getEnabled() || !oAppCreateBtn.getVisible()) {
                    return;
                }

                oAppCreateBtn.firePress();

            }
        },
        {
            KEY: "F6", // [WS10] Application Change
            DESC: parent.WSUTIL.getWsMsgClsTxt(sGlobalLangu, "ZMSG_WS_COMMON_001", "258"), // Application Change Mode
            CODE: `new sap.m.Button({
                text: oAPP.common.fnGetMsgClsText("/U4A/CL_WS_COMMON", "A02"),
                icon: "sap-icon://edit",
                tooltip: oAPP.common.fnGetMsgClsText("/U4A/CL_WS_COMMON", "A02") + " (F6)",
            })`,
            fn: (e) => {

                e.stopImmediatePropagation();

                if (e.repeat === true) {
                    return;
                }

                if (sap.ui.getCore().isLocked()) {
                    zconsole.log("!! 락 걸려서 단축기 실행 불가!!");
                    return;
                }

                // lock 걸기
                sap.ui.getCore().lock();

                // 메뉴 팝오버 닫기
                oAPP.common.fnCloseMenuPopover();

                // 단축키 실행 할지 말지 여부 체크
                var result = oAPP.common.fnShortCutExeAvaliableCheck();

                // X 이면 실행 불가
                if (result == "X") {
                    sap.ui.getCore().unlock();
                    return;
                }

                var oAppChangeBtn = sap.ui.getCore().byId("appChangeBtn");
                if (!oAppChangeBtn || !oAppChangeBtn.getEnabled() || !oAppChangeBtn.getVisible()) {
                    sap.ui.getCore().unlock();
                    return;
                }

                // 커서 포커스 날리기
                if (document.activeElement && document.activeElement.blur) {
                    document.activeElement.blur();
                }

                oAppChangeBtn.firePress();

            }
        },
        {
            KEY: "Ctrl+F10", // [WS10] Application Delete
            DESC: parent.WSUTIL.getWsMsgClsTxt(sGlobalLangu, "ZMSG_WS_COMMON_001", "259"), // Application Delete"
            CODE: `new sap.m.Button({
                text: oAPP.common.fnGetMsgClsText("/U4A/CL_WS_COMMON", "A03"),
                icon: "sap-icon://delete",
                type: sap.m.ButtonType.Reject,
                tooltip: oAPP.common.fnGetMsgClsText("/U4A/CL_WS_COMMON", "A03") + " (Ctrl+F10)",
            })`,
            fn: (e) => {

                e.stopImmediatePropagation();

                if (e.repeat === true) {
                    return;
                }

                if (sap.ui.getCore().isLocked()) {
                    zconsole.log("!! 락 걸려서 단축기 실행 불가!!");
                    return;
                }

                // 단축키 실행 할지 말지 여부 체크
                var result = oAPP.common.fnShortCutExeAvaliableCheck();

                // X 이면 실행 불가
                if (result == "X") {
                    return;
                }

                var oAppDelBtn = sap.ui.getCore().byId("appDelBtn");
                if (!oAppDelBtn || !oAppDelBtn.getEnabled() || !oAppDelBtn.getVisible()) {
                    return;
                }

                oAppDelBtn.firePress();

            }
        },
        {
            KEY: "Shift+F11", // [WS10] Application Copy
            DESC: parent.WSUTIL.getWsMsgClsTxt(sGlobalLangu, "ZMSG_WS_COMMON_001", "260"), // Application Copy
            CODE: `new sap.m.Button({
                text: oAPP.common.fnGetMsgClsText("/U4A/CL_WS_COMMON", "A04"),
                icon: "sap-icon://copy",
                tooltip: oAPP.common.fnGetMsgClsText("/U4A/CL_WS_COMMON", "A04") + " (Shift+F11)",
            })`,
            fn: (e) => {

                e.stopImmediatePropagation();

                if (e.repeat === true) {
                    return;
                }

                if (sap.ui.getCore().isLocked()) {
                    zconsole.log("!! 락 걸려서 단축기 실행 불가!!");
                    return;
                }

                // 단축키 실행 할지 말지 여부 체크
                var result = oAPP.common.fnShortCutExeAvaliableCheck();

                // X 이면 실행 불가
                if (result == "X") {
                    return;
                }

                var oAppCopyBtn = sap.ui.getCore().byId("appCopyBtn");
                if (!oAppCopyBtn || !oAppCopyBtn.getEnabled() || !oAppCopyBtn.getVisible()) {
                    return;
                }

                oAppCopyBtn.firePress();

            }
        },
        {
            KEY: "F7", // [WS10] Display Button
            DESC: parent.WSUTIL.getWsMsgClsTxt(sGlobalLangu, "ZMSG_WS_COMMON_001", "261"), // Application Display Mode
            CODE: `new sap.m.Button({
                text: oAPP.common.fnGetMsgClsText("/U4A/CL_WS_COMMON", "A05"),
                icon: "sap-icon://display",
                tooltip: oAPP.common.fnGetMsgClsText("/U4A/CL_WS_COMMON", "A05") + " (F7)"
            })`,
            fn: (e) => {

                e.stopImmediatePropagation();

                if (e.repeat === true) {
                    return;
                }

                if (sap.ui.getCore().isLocked()) {
                    zconsole.log("!! [F7] 락 걸려서 단축기 실행 불가!!");
                    return;
                }

                // lock 걸기
                sap.ui.getCore().lock();

                // 메뉴 팝오버 닫기
                oAPP.common.fnCloseMenuPopover();

                // 단축키 실행 할지 말지 여부 체크
                var result = oAPP.common.fnShortCutExeAvaliableCheck();

                // X 이면 실행 불가
                if (result == "X") {
                    sap.ui.getCore().unlock();
                    return;
                }

                var oDisplayBtn = sap.ui.getCore().byId("displayBtn");
                if (!oDisplayBtn || !oDisplayBtn.getEnabled() || !oDisplayBtn.getVisible()) {
                    sap.ui.getCore().unlock();
                    return;
                }

                // 커서 포커스 날리기
                if (document.activeElement && document.activeElement.blur) {
                    document.activeElement.blur();
                }

                oDisplayBtn.firePress();

            }
        },
        {
            KEY: "F8", // [WS10] Application Execution
            DESC: parent.WSUTIL.getWsMsgClsTxt(sGlobalLangu, "ZMSG_WS_COMMON_001", "262"), // Application Execution
            CODE: `new sap.m.Button({
                text: oAPP.common.fnGetMsgClsText("/U4A/CL_WS_COMMON", "A06"),
                icon: "sap-icon://internet-browser",
                tooltip: oAPP.common.fnGetMsgClsText("/U4A/CL_WS_COMMON", "A06") + " (F8)"
            })`,
            fn: (e) => {

                e.stopImmediatePropagation();

                if (e.repeat === true) {
                    return;
                }

                if (sap.ui.getCore().isLocked()) {
                    zconsole.log("!! 락 걸려서 단축기 실행 불가!!");
                    return;
                }

                // 단축키 실행 할지 말지 여부 체크
                var result = oAPP.common.fnShortCutExeAvaliableCheck();

                // X 이면 실행 불가
                if (result == "X") {
                    return;
                }

                // var oAppExecBtn = sap.ui.getCore().byId("appExecBtn");
                // if (!oAppExecBtn || !oAppExecBtn.getEnabled() || !oAppExecBtn.getVisible()) {
                //     return;
                // }

                // oAppExecBtn.firePress();

                var oAppExecBtn = sap.ui.getCore().byId("appExecMenuBtn");
                if (!oAppExecBtn || !oAppExecBtn.getEnabled() || !oAppExecBtn.getVisible()) {
                    return;
                }

                oAppExecBtn.fireDefaultAction();

            }
        },
        {
            KEY: "Ctrl+F1", // [WS10] Example Open
            DESC: oAPP.common.fnGetMsgClsText("/U4A/CL_WS_COMMON", "A07"), // Example Open
            CODE: `new sap.m.Button({
                text: oAPP.common.fnGetMsgClsText("/U4A/CL_WS_COMMON", "A07"),
                icon: "sap-icon://learning-assistant",
                tooltip: oAPP.common.fnGetMsgClsText("/U4A/CL_WS_COMMON", "A07") + " (Ctrl+F1)"
            })`,
            fn: (e) => {

                e.stopImmediatePropagation();

                if (e.repeat === true) {
                    return;
                }

                if (sap.ui.getCore().isLocked()) {
                    zconsole.log("!! 락 걸려서 단축기 실행 불가!!");
                    return;
                }

                // 단축키 실행 할지 말지 여부 체크
                var result = oAPP.common.fnShortCutExeAvaliableCheck();

                // X 이면 실행 불가
                if (result == "X") {
                    return;
                }

                var oExamBtn = sap.ui.getCore().byId("examBtn");
                if (!oExamBtn || !oExamBtn.getEnabled() || !oExamBtn.getVisible()) {
                    return;
                }

                oExamBtn.firePress();

            }
        },
        {
            KEY: "Ctrl+F3", // [WS10] Multi Preview
            DESC: oAPP.common.fnGetMsgClsText("/U4A/CL_WS_COMMON", "A08"), // Multi Preview
            CODE: `new sap.m.Button({
                text: oAPP.common.fnGetMsgClsText("/U4A/CL_WS_COMMON", "A08"),
                icon: "sap-icon://desktop-mobile",
                tooltip: oAPP.common.fnGetMsgClsText("/U4A/CL_WS_COMMON", "A08") + " (Ctrl+F3)"
            })`,
            fn: (e) => {

                e.stopImmediatePropagation();

                if (e.repeat === true) {
                    return;
                }

                if (sap.ui.getCore().isLocked()) {
                    zconsole.log("!! 락 걸려서 단축기 실행 불가!!");
                    return;
                }

                // 단축키 실행 할지 말지 여부 체크
                var result = oAPP.common.fnShortCutExeAvaliableCheck();

                // X 이면 실행 불가
                if (result == "X") {
                    return;
                }

                var oMultiPrevBtn = sap.ui.getCore().byId("multiPrevBtn");
                if (!oMultiPrevBtn || !oMultiPrevBtn.getEnabled() || !oMultiPrevBtn.getVisible()) {
                    return;
                }

                oMultiPrevBtn.firePress();

            }
        }

        ],
            aShortCutWS20 = [{
                KEY: "F11", // [WS20] FullScreen
                DESC: parent.WSUTIL.getWsMsgClsTxt(sGlobalLangu, "ZMSG_WS_COMMON_001", "255"), // Browser Fullscreen
                CODE: `new sap.m.Button({icon: "sap-icon://header"})`,
                fn: (e) => {

                    e.stopImmediatePropagation();

                    if (e.repeat === true) {
                        return;
                    }

                    // var oCurrWin = REMOTE.getCurrentWindow(), // 현재 window
                    //     bIsFull = oCurrWin.isFullScreen();

                    // oCurrWin.setFullScreen(!bIsFull);

                    /***************************************
                     * 2024-07-01 soccerhs
                     ***************************************
                    * ## F11 기능 변경
                    * - 기존: 전체창(Kiosk) 모드
                    * - 변경: 브라우저 전체창 모드
                    ***************************************/
                    // F11 = 브라우저 최대화 토글(원본 maxWinBtn.firePress). HTML5: maxWinBtn 은 DOM 버튼이라
                    //   sap.byId 가 아닌 DOM 클릭으로 토글(아이콘 동기화는 click 핸들러 측 _syncMaxIcon 이 처리).
                    var oMaxWinBtn = document.getElementById("maxWinBtn");
                    if (oMaxWinBtn) {
                        oMaxWinBtn.click();
                    }

                }
            }, {
                KEY: "Ctrl+Shift+F", // [WS20] textSearchPopup
                DESC: parent.WSUTIL.getWsMsgClsTxt(sGlobalLangu, "ZMSG_WS_COMMON_001", "256"), // Text Search Popup
                CODE: `new sap.m.Button({icon: "sap-icon://search"})`,
                fn: (e) => {

                    e.stopImmediatePropagation();

                    if (e.repeat === true) {
                        return;
                    }

                    if (sap.ui.getCore().isLocked()) {
                        zconsole.log("!! 락 걸려서 단축기 실행 불가!!");
                        return;
                    }

                    // 단축키 실행 할지 말지 여부 체크
                    var result = oAPP.common.fnShortCutExeAvaliableCheck();

                    // X 이면 실행 불가
                    if (result == "X") {
                        return;
                    }

                    oAPP.fn.fnTextSearchPopupOpener();

                }
            }, {
                KEY: "Ctrl+F2", // [WS20] Syntax Check Button
                DESC: oAPP.common.fnGetMsgClsText("/U4A/CL_WS_COMMON", "B72"), // Syntax Check
                CODE: `new sap.m.Button({
                    icon: "sap-icon://validate",
                    tooltip: oAPP.common.fnGetMsgClsText("/U4A/CL_WS_COMMON", "B72") + " (Ctrl+F2)"
                })`,
                fn: async (e) => {

                    e.stopImmediatePropagation();

                    if (e.repeat === true) {
                        return;
                    }

                    if (sap.ui.getCore().isLocked()) {
                        zconsole.log("!! 락 걸려서 단축기 실행 불가!!");
                        return;
                    }

                    // 단축키 실행 할지 말지 여부 체크
                    var result = oAPP.common.fnShortCutExeAvaliableCheck();

                    // X 이면 실행 불가
                    if (result == "X") {
                        return;
                    }

                    var oSyntaxCheckBtn = sap.ui.getCore().byId("syntaxCheckBtn");
                    if (!oSyntaxCheckBtn || !oSyntaxCheckBtn.getEnabled() || !oSyntaxCheckBtn.getVisible()) {
                        return;
                    }

                    oSyntaxCheckBtn.focus();

                    sap.ui.getCore().lock();

                    await new Promise((resolve) => {

                        var _ointer = setInterval(() => {

                            if (parent.getBusy() === "X") { return; }

                            clearInterval(_ointer);
                            resolve();

                        }, 0);

                    });

                    oSyntaxCheckBtn.firePress();

                }
            },
            {
                KEY: "F3", // [WS20] Back Button
                DESC: parent.WSUTIL.getWsMsgClsTxt(sGlobalLangu, "ZMSG_WS_COMMON_001", "264"), // Back
                CODE: `new sap.m.Button({
                    icon: "sap-icon://nav-back",
                })`,
                fn: async (e) => {

                    e.stopImmediatePropagation();

                    if (e.repeat === true) {
                        return;
                    }

                    if (sap.ui.getCore().isLocked()) {
                        zconsole.log("!! 락 걸려서 단축기 실행 불가!!");
                        return;
                    }

                    // lock 걸기
                    sap.ui.getCore().lock();

                    // 메뉴 팝오버 닫기
                    oAPP.common.fnCloseMenuPopover();

                    // 단축키 실행 할지 말지 여부 체크
                    var result = oAPP.common.fnShortCutExeAvaliableCheck();

                    // X 이면 실행 불가
                    if (result == "X") {
                        sap.ui.getCore().unlock();
                        return;
                    }

                    var oBackBtn = sap.ui.getCore().byId("backBtn");
                    if (!oBackBtn || !oBackBtn.getEnabled() || !oBackBtn.getVisible()) {
                        sap.ui.getCore().unlock();
                        return;
                    }

                    // 커서 포커스 날리기
                    if (document.activeElement && document.activeElement.blur) {
                        document.activeElement.blur();
                    }

                    var oBackBtn = sap.ui.getCore().byId("backBtn");
                    oBackBtn.focus();

                    sap.ui.getCore().lock();

                    await new Promise((resolve) => {

                        var _ointer = setInterval(() => {

                            if (parent.getBusy() === "X") { return; }

                            clearInterval(_ointer);
                            resolve();

                        }, 0);

                    });

                    oBackBtn.firePress();

                }

            },
            {
                KEY: "Ctrl+F1", // [WS20] Display or Change Button
                // DESC: "Display <---> Change",
                DESC: oAPP.common.fnGetMsgClsText("/U4A/CL_WS_COMMON", "A05") + " <--> " + oAPP.common.fnGetMsgClsText("/U4A/CL_WS_COMMON", "A02"),
                CODE: `new sap.m.Button({
                    icon: "sap-icon://display",
                    press: function(oEvent){
                    
                        let oBtn = oEvent.getSource();
                        
                        let sIcon = oBtn.getIcon();
                        if(sIcon === "sap-icon://display"){
                            oBtn.setIcon("sap-icon://edit");
                            return;
                        }
                        
                        oBtn.setIcon("sap-icon://display");
                        
                    }
                })`,
                fn: (e) => {

                    e.stopImmediatePropagation();

                    if (e.repeat === true) {
                        return;
                    }

                    // 단축키 실행 할지 말지 여부 체크 (busy/락/메뉴/팝업 가드 — HTML5-safe)
                    if (oAPP.common.fnShortCutExeAvaliableCheck() === "X") {
                        return;
                    }

                    // [HTML5] sap.ui.getCore().byId → DOM 버튼. 표시 토글은 fnUpdateWs20Toolbar 가
                    //   style.display 로 처리(조회/변경 중 한쪽만 display!=="none") → 보이는 쪽을
                    //   click(= ev_pressDisplayModeBtn) 해서 모드 전환. firePress 대체.
                    var oChangeModeBtn = document.getElementById("changeModeBtn"),
                        oDisplayBtn = document.getElementById("displayModeBtn");

                    if (!oChangeModeBtn && !oDisplayBtn) {
                        return;
                    }

                    // 커서 포커스 날리기
                    if (document.activeElement && document.activeElement.blur) {
                        document.activeElement.blur();
                    }

                    // Display(조회) 모드 → changeModeBtn(변경으로) 가 보임
                    if (oChangeModeBtn && oChangeModeBtn.style.display !== "none") {
                        oChangeModeBtn.focus();
                        oChangeModeBtn.click();
                        return;
                    }

                    // Change(변경) 모드 → displayModeBtn(조회로) 가 보임
                    if (oDisplayBtn && oDisplayBtn.style.display !== "none") {
                        oDisplayBtn.focus();
                        oDisplayBtn.click();
                        return;
                    }

                }
            },
            {
                KEY: "Ctrl+F3", // [WS20] Activate Button
                DESC: oAPP.common.fnGetMsgClsText("/U4A/CL_WS_COMMON", "B73"), // Activate
                CODE: `new sap.m.Button({icon: "sap-icon://activate"})`,
                fn: (e) => {
                    e.stopImmediatePropagation();

                    if (e.repeat === true) {
                        return;
                    }

                    // [HTML5] sap.ui.getCore().byId → DOM 버튼. 활성/표시도 DOM 기준(sap 참조 제거).
                    var oActivateBtn = document.getElementById("activateBtn");
                    if (!oActivateBtn || oActivateBtn.disabled ||
                        oActivateBtn.hidden || oActivateBtn.style.display === "none") {
                        return;
                    }

                    // 단축키 실행 할지 말지 여부 체크 (busy/락/메뉴/다이얼로그 가드 — HTML5-safe)
                    if (oAPP.common.fnShortCutExeAvaliableCheck() === "X") {
                        return;
                    }

                    // Active 버튼 누르기 전 커서의 위치를 저장한다.
                    oAPP.attr.beforeActiveElement = document.activeElement;

                    // 커서 포커스 날리기
                    if (document.activeElement && document.activeElement.blur) {
                        document.activeElement.blur();
                    }

                    oActivateBtn.focus();

                    // [HTML5] firePress → click (버튼 click 핸들러가 oAPP.events.ev_pressActivateBtn 호출)
                    oActivateBtn.click();

                }
            },
            {
                /****************************************************************************************************
                 * [WS20] shortcut library bug,
                 ****************************************************************************************************
                 * Ctrl + F4 키를 누르면 Ctrl + S 이벤트를 발생시키는 버그를 발견하여,
                 * Ctrl + F4 키를 눌렀다면 이벤트 전파 방지를 하여 Ctrl + S 이벤트를
                 * 타지 않게 하기 위함.               
                 ****************************************************************************************************/
                KEY: "Ctrl+F4",
                VISIBLE: false,
                fn: (e) => {

                    e.stopImmediatePropagation();

                    zconsole.log("ws30/Ctrl+F4 key in!!");

                },

            },
            {
                KEY: "Ctrl+S", // [WS20] Save Button
                DESC: oAPP.common.fnGetMsgClsText("/U4A/CL_WS_COMMON", "A64"), // Save
                CODE: `new sap.m.Button({icon: "sap-icon://save"})`,
                fn: (e) => {

                    e.stopImmediatePropagation();

                    if (e.repeat === true) {
                        return;
                    }

                    // [HTML5] sap.ui.getCore().byId → DOM 버튼. 활성/표시도 DOM 기준(sap 참조 제거).
                    var oSaveBtn = document.getElementById("saveBtn");
                    if (!oSaveBtn || oSaveBtn.disabled ||
                        oSaveBtn.hidden || oSaveBtn.style.display === "none") {
                        return;
                    }

                    // 단축키 실행 할지 말지 여부 체크 (busy/락/메뉴/다이얼로그 가드 — HTML5-safe)
                    if (oAPP.common.fnShortCutExeAvaliableCheck() === "X") {
                        return;
                    }

                    // Save 버튼 누르기 전 커서의 위치를 저장한다.
                    oAPP.attr.beforeActiveElement = document.activeElement;

                    // 커서 포커스 날리기
                    if (document.activeElement && document.activeElement.blur) {
                        document.activeElement.blur();
                    }

                    oSaveBtn.focus();

                    // [HTML5] firePress → click (버튼 click 핸들러가 oAPP.events.ev_pressSaveBtn 호출)
                    oSaveBtn.click();

                }
            },
            {
                KEY: "F8", // [WS20] Application Execution (실행) — 원본 앱헤더 ev_pressAppExecBtn (F8)
                DESC: oAPP.common.fnGetMsgClsText("/U4A/CL_WS_COMMON", "A06"), // Application Execution
                fn: (e) => {

                    e.stopImmediatePropagation();

                    if (e.repeat === true) {
                        return;
                    }

                    // [HTML5] 표시 여부는 DOM 기준(App Exec 는 split 버튼 → 본체 동작은 이벤트 직접 호출)
                    var oExecBtn = document.getElementById("ws20_appExecMenuBtn");
                    if (!oExecBtn || oExecBtn.hidden || oExecBtn.style.display === "none") {
                        return;
                    }

                    // 단축키 실행 할지 말지 여부 체크 (busy/락/메뉴/다이얼로그 가드 — HTML5-safe)
                    if (oAPP.common.fnShortCutExeAvaliableCheck() === "X") {
                        return;
                    }

                    // 커서 포커스 날리기
                    if (document.activeElement && document.activeElement.blur) {
                        document.activeElement.blur();
                    }

                    // split 버튼 본체 = 기본 실행(ev_pressAppExecBtn). firePress 대체로 이벤트 직접 호출.
                    try { oAPP.events.ev_pressAppExecBtn(); }
                    catch (err) { if (typeof console !== "undefined") { console.warn("[WS20] F8 AppExec error", err); } }

                }
            },
            {
                KEY: "Ctrl+Shift+F12", // [WS20] Mime Button
                DESC: oAPP.common.fnGetMsgClsText("/U4A/CL_WS_COMMON", "A10"), // Mime Repository
                CODE: `new sap.m.Button({
                    icon: "sap-icon://picture",
                    text: oAPP.common.fnGetMsgClsText("/U4A/CL_WS_COMMON", "A10"),
                    tooltip: oAPP.common.fnGetMsgClsText("/U4A/CL_WS_COMMON", "A10") + " (Ctrl+Shift+F12)",
                })`,
                fn: (e) => {

                    e.stopImmediatePropagation();

                    if (e.repeat === true) {
                        return;
                    }

                    if (sap.ui.getCore().isLocked()) {
                        zconsole.log("!! 락 걸려서 단축기 실행 불가!!");
                        return;
                    }

                    // 단축키 실행 할지 말지 여부 체크
                    var result = oAPP.common.fnShortCutExeAvaliableCheck();

                    // X 이면 실행 불가
                    if (result == "X") {
                        return;
                    }

                    var oMimeBtn = sap.ui.getCore().byId("mimeBtn");
                    if (!oMimeBtn || !oMimeBtn.getEnabled() || !oMimeBtn.getVisible()) {
                        return;
                    }

                    oMimeBtn.firePress();
                }
            },
            {
                KEY: "Ctrl+F12", // [WS20] Controller Button
                DESC: oAPP.common.fnGetMsgClsText("/U4A/CL_WS_COMMON", "A11"), // Controller (Class Builder)
                CODE: `new sap.m.Button({
                    icon: "sap-icon://developer-settings",
                    text: oAPP.common.fnGetMsgClsText("/U4A/CL_WS_COMMON", "A11"),
                    tooltip: oAPP.common.fnGetMsgClsText("/U4A/CL_WS_COMMON", "C38") + " (Ctrl+F12)",
                })`,
                fn: (e) => {

                    e.stopImmediatePropagation();

                    if (e.repeat === true) {
                        return;
                    }

                    if (sap.ui.getCore().isLocked()) {
                        zconsole.log("!! 락 걸려서 단축기 실행 불가!!");
                        return;
                    }

                    // 단축키 실행 할지 말지 여부 체크
                    var result = oAPP.common.fnShortCutExeAvaliableCheck();

                    // X 이면 실행 불가
                    if (result == "X") {
                        return;
                    }

                    var oControllerBtn = sap.ui.getCore().byId("controllerBtn");
                    if (!oControllerBtn || !oControllerBtn.getEnabled() || !oControllerBtn.getVisible()) {
                        return;
                    }

                    oControllerBtn.firePress();
                }
            },
            {
                KEY: "F8", // [WS20] Application Execution Button
                DESC: parent.WSUTIL.getWsMsgClsTxt(sGlobalLangu, "ZMSG_WS_COMMON_001", "262"), // Application Execution
                CODE: `new sap.m.Button({
                    icon: "sap-icon://internet-browser",
                    text: oAPP.common.fnGetMsgClsText("/U4A/CL_WS_COMMON", "A06"),
                    tooltip: oAPP.common.fnGetMsgClsText("/U4A/CL_WS_COMMON", "A06") + " (F8)",
                })`,
                fn: (e) => {

                    e.stopImmediatePropagation();

                    if (e.repeat === true) {
                        return;
                    }

                    if (sap.ui.getCore().isLocked()) {
                        zconsole.log("!! 락 걸려서 단축기 실행 불가!!");
                        return;
                    }

                    // 단축키 실행 할지 말지 여부 체크
                    var result = oAPP.common.fnShortCutExeAvaliableCheck();

                    // X 이면 실행 불가
                    if (result == "X") {
                        return;
                    }

                    // var oAppExecBtn = sap.ui.getCore().byId("ws20_appExecBtn");
                    var oAppExecBtn = sap.ui.getCore().byId("ws20_appExecMenuBtn");
                    if (!oAppExecBtn || !oAppExecBtn.getEnabled() || !oAppExecBtn.getVisible()) {
                        return;
                    }

                    oAppExecBtn.fireDefaultAction();
                }
            },

            {
                KEY: "F12", // [WS20] Application Execution Button
                DESC: "U4A DEV Browser",
                CODE: `new sap.m.Button({
                    icon: "sap-icon://u4a-fw-brands/DEV",
                    text: "U4A DEV Browser",
                    tooltip: "U4A DEV Browser" + " (F12)",
                })`,
                fn: (e) => {

                    e.stopImmediatePropagation();

                    if (e.repeat === true) {
                        return;
                    }

                    if (sap.ui.getCore().isLocked()) {
                        zconsole.log("!! 락 걸려서 단축기 실행 불가!!");
                        return;
                    }

                    // 단축키 실행 할지 말지 여부 체크
                    let result = oAPP.common.fnShortCutExeAvaliableCheck();

                    // X 이면 실행 불가
                    if (result == "X") {
                        return;
                    }

                    let oBtn = sap.ui.getCore().byId("ws20_appExecMenu");
                    if (!oBtn || !oBtn.getEnabled() || !oBtn.getVisible()) {
                        return;
                    }

                    let aItems = oBtn.getItems();
                    let oFindItem = aItems.find(e => e?.getKey?.() === "DEV_BROWSER");
                    if (!oFindItem || !oFindItem.getEnabled() || !oFindItem.getVisible()) {
                        return;
                    }

                    oFindItem.firePress();

                }
            },

            {
                KEY: "Ctrl+F5", // [WS20] Multi Preview Button
                DESC: oAPP.common.fnGetMsgClsText("/U4A/CL_WS_COMMON", "A08"), // Multi Preview
                CODE: `new sap.m.Button({
                    icon: "sap-icon://desktop-mobile",
                    text: oAPP.common.fnGetMsgClsText("/U4A/CL_WS_COMMON", "A08"),
                    tooltip: oAPP.common.fnGetMsgClsText("/U4A/CL_WS_COMMON", "A08") + " (Ctrl+F5)",
                })`,
                fn: (e) => {

                    e.stopImmediatePropagation();

                    if (e.repeat === true) {
                        return;
                    }

                    if (sap.ui.getCore().isLocked()) {
                        zconsole.log("!! 락 걸려서 단축기 실행 불가!!");
                        return;
                    }

                    // 단축키 실행 할지 말지 여부 체크
                    var result = oAPP.common.fnShortCutExeAvaliableCheck();

                    // X 이면 실행 불가
                    if (result == "X") {
                        return;
                    }

                    var oMultiPrevBtn = sap.ui.getCore().byId("ws20_multiPrevBtn");
                    if (!oMultiPrevBtn || !oMultiPrevBtn.getEnabled() || !oMultiPrevBtn.getVisible()) {
                        return;
                    }

                    oMultiPrevBtn.firePress();
                }
            },
            {
                KEY: "Ctrl+Shift+F10", // [WS20] Icon List Button
                DESC: parent.WSUTIL.getWsMsgClsTxt(sGlobalLangu, "ZMSG_WS_COMMON_001", "047"), // Icon List
                CODE: `new sap.m.Button({
                    icon: "sap-icon://u4a-fw-solid/Icons",
                    text: "{/WSLANGU/ZMSG_WS_COMMON_001/047}",
                    tooltip: "{/WSLANGU/ZMSG_WS_COMMON_001/047}" + " (Ctrl+Shift+F10)",
                })`,
                fn: (e) => {

                    e.stopImmediatePropagation();

                    if (e.repeat === true) {
                        return;
                    }

                    if (sap.ui.getCore().isLocked()) {
                        zconsole.log("!! 락 걸려서 단축기 실행 불가!!");
                        return;
                    }

                    // 단축키 실행 할지 말지 여부 체크
                    var result = oAPP.common.fnShortCutExeAvaliableCheck();

                    // X 이면 실행 불가
                    if (result == "X") {
                        return;
                    }

                    var oIconListBtn = sap.ui.getCore().byId("iconCollBtn");
                    if (!oIconListBtn || !oIconListBtn.getEnabled() || !oIconListBtn.getVisible()) {
                        return;
                    }

                    let oItem = sap.ui.getCore().byId("iconListMenuItem");

                    oIconListBtn.fireItemSelected({ item: oItem });

                    // var oIconListBtn = sap.ui.getCore().byId("iconListBtn");
                    // if (!oIconListBtn || !oIconListBtn.getEnabled() || !oIconListBtn.getVisible()) {
                    //     return;
                    // }

                    // oIconListBtn.firePress();
                }
            },
            {
                KEY: "Shift+F1", // [WS20] Add Server Event Button
                DESC: oAPP.common.fnGetMsgClsText("/U4A/CL_WS_COMMON", "A13"), // Add Event Method
                CODE: `new sap.m.Button({
                    icon: "sap-icon://touch",
                    text: oAPP.common.fnGetMsgClsText("/U4A/CL_WS_COMMON", "A13"),
                    tooltip: oAPP.common.fnGetMsgClsText("/U4A/CL_WS_COMMON", "A13") + " (Shift+F1)",
                })`,
                fn: (e) => {

                    e.stopImmediatePropagation();

                    if (e.repeat === true) {
                        return;
                    }

                    if (sap.ui.getCore().isLocked()) {
                        zconsole.log("!! 락 걸려서 단축기 실행 불가!!");
                        return;
                    }

                    // 단축키 실행 할지 말지 여부 체크
                    var result = oAPP.common.fnShortCutExeAvaliableCheck();

                    // X 이면 실행 불가
                    if (result == "X") {
                        return;
                    }

                    var oAddEventBtn = sap.ui.getCore().byId("addEventBtn");
                    if (!oAddEventBtn || !oAddEventBtn.getEnabled() || !oAddEventBtn.getVisible()) {
                        return;
                    }

                    oAddEventBtn.firePress();
                }
            },
            {
                KEY: "F9", // [WS20] Runtime Class Navigator Event Button
                DESC: oAPP.common.fnGetMsgClsText("/U4A/CL_WS_COMMON", "A14"), // Runtime Class Navigator
                CODE: `new sap.m.Button({
                    icon: "sap-icon://functional-location",
                    text: oAPP.common.fnGetMsgClsText("/U4A/CL_WS_COMMON", "A14"),
                    tooltip: oAPP.common.fnGetMsgClsText("/U4A/CL_WS_COMMON", "A14"),
                })`,
                fn: (e) => {

                    e.stopImmediatePropagation();

                    if (e.repeat === true) {
                        return;
                    }

                    if (sap.ui.getCore().isLocked()) {
                        zconsole.log("!! 락 걸려서 단축기 실행 불가!!");
                        return;
                    }

                    // 단축키 실행 할지 말지 여부 체크
                    var result = oAPP.common.fnShortCutExeAvaliableCheck();

                    // X 이면 실행 불가
                    if (result == "X") {
                        return;
                    }

                    var oRuntimeBtn = sap.ui.getCore().byId("runtimeBtn");
                    if (!oRuntimeBtn || !oRuntimeBtn.getEnabled() || !oRuntimeBtn.getVisible()) {
                        return;
                    }

                    oRuntimeBtn.firePress();
                }
            },
            {
                KEY: "Ctrl+F", // [WS20] Find
                DESC: oAPP.common.fnGetMsgClsText("/U4A/CL_WS_COMMON", "A70"), // Find UI
                CODE: `new sap.m.Button({
                    icon: "sap-icon://sys-find",
                    tooltip: oAPP.common.fnGetMsgClsText("/U4A/CL_WS_COMMON", "A70") + " (Ctrl+F)"
                })`,
                fn: (e) => {

                    e.stopImmediatePropagation();

                    if (e.repeat === true) {
                        return;
                    }

                    if (sap.ui.getCore().isLocked()) {
                        zconsole.log("!! 락 걸려서 단축기 실행 불가!!");
                        return;
                    }

                    // 단축키 실행 할지 말지 여부 체크
                    var result = oAPP.common.fnShortCutExeAvaliableCheck();

                    // X 이면 실행 불가
                    if (result == "X") {
                        return;
                    }

                    var oFindBtn = sap.ui.getCore().byId("ws20_findBtn");
                    if (!oFindBtn || !oFindBtn.getEnabled() || !oFindBtn.getVisible()) {
                        return;
                    }

                    oFindBtn.firePress();
                }
            },
            {
                // KEY: "Ctrl+Z", // [WS20] UNDO
                KEY: "Ctrl+Shift+Z", // [WS20] UNDO
                DESC: parent.WSUTIL.getWsMsgClsTxt(sGlobalLangu, "ZMSG_WS_COMMON_001", "247"), // Undo
                CODE: `new sap.m.Button({
                    icon: "sap-icon://undo",
                    tooltip: "{/WSLANGU/ZMSG_WS_COMMON_001/247}"
                })`,
                fn: (e) => {

                    if (e.repeat === true) {
                        return;
                    }

                    // 20번 페이지의 앱 정보를 구한다.
                    let _oAppInfo = parent.getAppInfo();
                    if (!_oAppInfo) {
                        return;
                    }

                    // 현재 문서 모드가 display일 경우
                    if (_oAppInfo.IS_EDIT !== "X") {
                        return;
                    }

                    e.stopImmediatePropagation();

                    if (sap.ui.getCore().isLocked()) {
                        zconsole.log("!! 락 걸려서 단축기 실행 불가!!");
                        return;
                    }

                    // lock 걸기
                    sap.ui.getCore().lock();

                    // 단축키 실행 할지 말지 여부 체크
                    var result = oAPP.common.fnShortCutExeAvaliableCheck();

                    // X 이면 실행 불가
                    if (result == "X") {
                        sap.ui.getCore().unlock();
                        return;
                    }

                    parent.require(oAPP.oDesign.pathInfo.undoRedo).executeHistory("UNDO");

                    // zconsole.log("UNDO!!");



                }
            },
            {
                // KEY: "Ctrl+X", // [WS20] REDO
                KEY: "Ctrl+Shift+X", // [WS20] REDO
                DESC: parent.WSUTIL.getWsMsgClsTxt(sGlobalLangu, "ZMSG_WS_COMMON_001", "248"), // Redo
                CODE: `new sap.m.Button({
                    icon: "sap-icon://redo",
                    tooltip: "{/WSLANGU/ZMSG_WS_COMMON_001/248}",
                })`,
                fn: (e) => {

                    if (e.repeat === true) {
                        return;
                    }

                    // 20번 페이지의 앱 정보를 구한다.
                    let _oAppInfo = parent.getAppInfo();
                    if (!_oAppInfo) {
                        return;
                    }

                    // 현재 문서 모드가 display일 경우
                    if (_oAppInfo.IS_EDIT !== "X") {
                        return;
                    }

                    e.stopImmediatePropagation();

                    if (sap.ui.getCore().isLocked()) {
                        zconsole.log("!! 락 걸려서 단축기 실행 불가!!");
                        return;
                    }

                    // lock 걸기
                    sap.ui.getCore().lock();

                    // 단축키 실행 할지 말지 여부 체크
                    var result = oAPP.common.fnShortCutExeAvaliableCheck();

                    // X 이면 실행 불가
                    if (result == "X") {
                        sap.ui.getCore().unlock();
                        return;
                    }

                    // zconsole.log("REDO!!");

                    parent.require(oAPP.oDesign.pathInfo.undoRedo).executeHistory("REDO");

                }
            }

            ],

            /*****************************************************
             * [WS30] USP 단축키
             *****************************************************/
            aShortCutWS30 = [{
                KEY: "F11", // [WS30] FullScreen
                DESC: parent.WSUTIL.getWsMsgClsTxt(sGlobalLangu, "ZMSG_WS_COMMON_001", "255"), // Browser Fullscreen
                CODE: `new sap.m.Button({icon: "sap-icon://header"})`,
                fn: (e) => {

                    e.stopImmediatePropagation();

                    if (e.repeat === true) {
                        return;
                    }

                    // var oCurrWin = REMOTE.getCurrentWindow(), // 현재 window
                    //     bIsFull = oCurrWin.isFullScreen();

                    // oCurrWin.setFullScreen(!bIsFull);

                    /***************************************
                     * 2024-07-01 soccerhs
                     ***************************************
                    * ## F11 기능 변경
                    * - 기존: 전체창(Kiosk) 모드
                    * - 변경: 브라우저 전체창 모드
                    ***************************************/
                    // F11 = 브라우저 최대화 토글(원본 maxWinBtn.firePress). HTML5: maxWinBtn 은 DOM 버튼이라
                    //   sap.byId 가 아닌 DOM 클릭으로 토글(아이콘 동기화는 click 핸들러 측 _syncMaxIcon 이 처리).
                    var oMaxWinBtn = document.getElementById("maxWinBtn");
                    if (oMaxWinBtn) {
                        oMaxWinBtn.click();
                    }

                }
            },
            {
                KEY: "Ctrl+Shift+F", // [WS30] textSearchPopup
                DESC: parent.WSUTIL.getWsMsgClsTxt(sGlobalLangu, "ZMSG_WS_COMMON_001", "256"), // Text Search Popup
                CODE: `new sap.m.Button({icon: "sap-icon://search"})`,
                fn: (e) => {

                    e.stopImmediatePropagation();

                    if (e.repeat === true) {
                        return;
                    }

                    if (sap.ui.getCore().isLocked()) {
                        zconsole.log("!! 락 걸려서 단축기 실행 불가!!");
                        return;
                    }

                    // 단축키 실행 할지 말지 여부 체크
                    var result = oAPP.common.fnShortCutExeAvaliableCheck();

                    // X 이면 실행 불가
                    if (result == "X") {
                        return;
                    }

                    oAPP.fn.fnTextSearchPopupOpener();

                }
            },
            /****************************************************************************************************
             * shortcut library bug,
             ****************************************************************************************************
             * Ctrl + F4 키를 누르면 Ctrl + S 이벤트를 발생시키는 버그를 발견하여,
             * Ctrl + F4 키를 눌렀다면 이벤트 전파 방지를 하여 Ctrl + S 이벤트를
             * 타지 않게 하기 위함.               
             ****************************************************************************************************/
            {
                KEY: "Ctrl+F4", // [WS30]
                VISIBLE: false,
                fn: (e) => {

                    e.stopImmediatePropagation();

                    if (e.repeat === true) {
                        return;
                    }

                    zconsole.log("ws30/Ctrl+F4 key in!!");

                }
            },
            {
                KEY: "F3",  // [WS30] 이전 페이지로 이동 
                DESC: parent.WSUTIL.getWsMsgClsTxt(sGlobalLangu, "ZMSG_WS_COMMON_001", "264"), // Back
                CODE: `new sap.m.Button({
                    icon: "sap-icon://nav-back",
                })`,
                fn: async (e) => {

                    e.stopImmediatePropagation();

                    if (e.repeat === true) {
                        return;
                    }

                    if (sap.ui.getCore().isLocked()) {
                        zconsole.log("!! [F3] 락 걸려서 단축기 실행 불가!!");
                        return;
                    }

                    // lock 걸기
                    sap.ui.getCore().lock();

                    // 메뉴 팝오버 닫기
                    oAPP.common.fnCloseMenuPopover();

                    // 단축키 실행 할지 말지 여부 체크
                    var result = oAPP.common.fnShortCutExeAvaliableCheck();

                    // X 이면 실행 불가
                    if (result == "X") {
                        return;
                    }

                    // var oBackBtn = sap.ui.getCore().byId("ws30_backBtn");
                    // if (!oBackBtn || !oBackBtn.getEnabled() || !oBackBtn.getVisible()) {
                    //     return;
                    // }

                    // 커서 포커스 날리기
                    if (document.activeElement && document.activeElement.blur) {
                        document.activeElement.blur();
                    }

                    var oBackBtn = sap.ui.getCore().byId("ws30_backBtn");
                    oBackBtn.focus();

                    oBackBtn.firePress();

                }
            }, {
                KEY: "Ctrl+F1", // [WS30] Display or Change Button
                DESC: oAPP.common.fnGetMsgClsText("/U4A/CL_WS_COMMON", "A05") + " <--> " + oAPP.common.fnGetMsgClsText("/U4A/CL_WS_COMMON", "A02"),
                CODE: `new sap.m.Button({
                    icon: "sap-icon://display",
                    press: function(oEvent){
                    
                        let oBtn = oEvent.getSource();
                        
                        let sIcon = oBtn.getIcon();
                        if(sIcon === "sap-icon://display"){
                            oBtn.setIcon("sap-icon://edit");
                            return;
                        }
                        
                        oBtn.setIcon("sap-icon://display");
                        
                    }
                })`,
                fn: (e) => {

                    e.stopImmediatePropagation();

                    if (e.repeat === true) {
                        return;
                    }

                    var oChangeModeBtn = sap.ui.getCore().byId("ws30_changeModeBtn"),
                        oDisplayBtn = sap.ui.getCore().byId("ws30_displayModeBtn");

                    if (!oChangeModeBtn && !oDisplayBtn) {
                        return;
                    }

                    if (sap.ui.getCore().isLocked()) {
                        zconsole.log("!! 락 걸려서 단축기 실행 불가!!");
                        return;
                    }

                    // 단축키 실행 할지 말지 여부 체크
                    var result = oAPP.common.fnShortCutExeAvaliableCheck();

                    // X 이면 실행 불가
                    if (result == "X") {
                        return;
                    }

                    var bIsChgVisi = oChangeModeBtn.getVisible(),
                        bIsDisVisi = oDisplayBtn.getVisible();

                    // 커서 포커스 날리기
                    if (document.activeElement && document.activeElement.blur) {
                        document.activeElement.blur();
                    }

                    if (bIsChgVisi == true) {
                        oChangeModeBtn.focus();
                        oChangeModeBtn.firePress();
                        return;
                    }

                    if (bIsDisVisi == true) {
                        oDisplayBtn.focus();
                        oDisplayBtn.firePress();
                        return;
                    }

                }
            }, {
                KEY: "Ctrl+F3", // [WS30] Activate Button
                DESC: oAPP.common.fnGetMsgClsText("/U4A/CL_WS_COMMON", "B73"), // Activate
                CODE: `new sap.m.Button({icon: "sap-icon://activate"})`,
                fn: async (e) => {

                    e.stopImmediatePropagation();

                    if (e.repeat === true) {
                        return;
                    }

                    var oActivateBtn = sap.ui.getCore().byId("ws30_activateBtn");
                    if (!oActivateBtn || !oActivateBtn.getEnabled() || !oActivateBtn.getVisible()) {
                        return;
                    }

                    if (sap.ui.getCore().isLocked()) {
                        zconsole.log("!! 락 걸려서 단축기 실행 불가!!");
                        return;
                    }

                    // 단축키 실행 할지 말지 여부 체크
                    var result = oAPP.common.fnShortCutExeAvaliableCheck();

                    // X 이면 실행 불가
                    if (result == "X") {
                        return;
                    }

                    // Active 버튼 누르기 전 커서의 위치를 저장한다.
                    if (oAPP.attr.beforeActiveElement) {
                        delete oAPP.attr.beforeActiveElement;
                    }

                    oAPP.attr.beforeActiveElement = document.activeElement;

                    // 커서 포커스 날리기
                    if (document.activeElement && document.activeElement.blur) {
                        document.activeElement.blur();
                    }

                    oActivateBtn.focus();

                    sap.ui.getCore().lock();

                    await new Promise((resolve) => {

                        var _ointer = setInterval(() => {

                            if (parent.getBusy() === "X") { return; }

                            clearInterval(_ointer);

                            resolve();

                        }, 0);

                    });

                    oActivateBtn.firePress();
                }
            }, {
                KEY: "Ctrl+S", // [WS30] Save Button
                DESC: oAPP.common.fnGetMsgClsText("/U4A/CL_WS_COMMON", "A64"), // Save
                CODE: `new sap.m.Button({icon: "sap-icon://save"})`,
                fn: async (e) => {

                    e.stopImmediatePropagation();

                    if (e.repeat === true) {
                        return;
                    }

                    var oSaveBtn = sap.ui.getCore().byId("ws30_saveBtn");
                    if (!oSaveBtn || !oSaveBtn.getEnabled() || !oSaveBtn.getVisible()) {
                        return;
                    }

                    if (sap.ui.getCore().isLocked()) {
                        zconsole.log("!! 락 걸려서 단축기 실행 불가!!");
                        return;
                    }

                    // 단축키 실행 할지 말지 여부 체크
                    var result = oAPP.common.fnShortCutExeAvaliableCheck();

                    // X 이면 실행 불가
                    if (result == "X") {
                        return;
                    }

                    // Active 버튼 누르기 전 커서의 위치를 저장한다.
                    if (oAPP.attr.beforeActiveElement) {
                        delete oAPP.attr.beforeActiveElement;
                    }

                    oAPP.attr.beforeActiveElement = document.activeElement;

                    // 커서 포커스 날리기
                    if (document.activeElement && document.activeElement.blur) {
                        document.activeElement.blur();
                    }

                    oSaveBtn.focus();

                    sap.ui.getCore().lock();

                    await new Promise((resolve) => {

                        var _ointer = setInterval(() => {

                            if (parent.getBusy() === "X") { return; }

                            clearInterval(_ointer);
                            resolve();

                        }, 0);

                    });

                    oSaveBtn.firePress();

                }
            }, {
                KEY: "Shift+F1", // [WS30] Code Editor Pretty Print
                DESC: oAPP.common.fnGetMsgClsText("/U4A/CL_WS_COMMON", "C25"), // Pretty Print
                CODE: `new sap.m.Button({
                    icon: "sap-icon://indent",
                    text: oAPP.common.fnGetMsgClsText("/U4A/CL_WS_COMMON", "C25"),
                    tooltip: oAPP.common.fnGetMsgClsText("/U4A/CL_WS_COMMON", "C25") + "(Shift + F1)",
                })`,
                fn: (e) => {

                    e.stopImmediatePropagation();

                    if (e.repeat === true) {
                        return;
                    }

                    if (sap.ui.getCore().isLocked()) {
                        zconsole.log("!! 락 걸려서 단축기 실행 불가!!");
                        return;
                    }

                    // 단축키 실행 할지 말지 여부 체크
                    var result = oAPP.common.fnShortCutExeAvaliableCheck();

                    // X 이면 실행 불가
                    if (result == "X") {
                        return;
                    }

                    // Active 버튼 누르기 전 커서의 위치를 저장한다.
                    if (oAPP.attr.beforeActiveElement) {
                        delete oAPP.attr.beforeActiveElement;
                    }

                    oAPP.attr.beforeActiveElement = document.activeElement;

                    var oBtn = sap.ui.getCore().byId("ws30_codeeditor_prettyBtn");
                    if (!oBtn || !oBtn.getEnabled() || !oBtn.getVisible()) {
                        return;
                    }

                    oBtn.firePress({
                        ISSHORTCUT: "X"
                    });

                }
            },
            {
                KEY: "F8", // [WS30] Application Execution Button
                DESC: parent.WSUTIL.getWsMsgClsTxt(sGlobalLangu, "ZMSG_WS_COMMON_001", "262"), // Application Execution
                CODE: `new sap.m.Button({
                    text: oAPP.common.fnGetMsgClsText("/U4A/CL_WS_COMMON", "A06"),
                    icon: "sap-icon://internet-browser",
                    tooltip: oAPP.common.fnGetMsgClsText("/U4A/CL_WS_COMMON", "A06") + " (F8)"
                })`,
                fn: (e) => {

                    e.stopImmediatePropagation();
                    
                    if (e.repeat === true) {
                        return;
                    }

                    if (sap.ui.getCore().isLocked()) {
                        zconsole.log("!! 락 걸려서 단축기 실행 불가!!");
                        return;
                    }

                    // 단축키 실행 할지 말지 여부 체크
                    var result = oAPP.common.fnShortCutExeAvaliableCheck();

                    // X 이면 실행 불가
                    if (result == "X") {
                        return;
                    }

                    var oAppExecBtn = sap.ui.getCore().byId("ws30_appExecBtn");
                    if (!oAppExecBtn || !oAppExecBtn.getEnabled() || !oAppExecBtn.getVisible()) {
                        return;
                    }

                    oAppExecBtn.firePress();
                }
            },
            {
                KEY: "Ctrl+Shift+F12", // [WS30] Mime Button
                DESC: oAPP.common.fnGetMsgClsText("/U4A/CL_WS_COMMON", "A10"), // Mime Repository
                CODE: `new sap.m.Button({
                    icon: "sap-icon://picture",
                    text: oAPP.common.fnGetMsgClsText("/U4A/CL_WS_COMMON", "A10"),
                    tooltip: oAPP.common.fnGetMsgClsText("/U4A/CL_WS_COMMON", "A10") + " (Ctrl+Shift+F12)",
                })`,
                fn: (e) => {

                    e.stopImmediatePropagation();

                    if (e.repeat === true) {
                        return;
                    }

                    if (sap.ui.getCore().isLocked()) {
                        zconsole.log("!! 락 걸려서 단축기 실행 불가!!");
                        return;
                    }

                    // 단축키 실행 할지 말지 여부 체크
                    var result = oAPP.common.fnShortCutExeAvaliableCheck();

                    // X 이면 실행 불가
                    if (result == "X") {
                        return;
                    }

                    var oMimeBtn = sap.ui.getCore().byId("ws30_MimeBtn");
                    if (!oMimeBtn || !oMimeBtn.getEnabled() || !oMimeBtn.getVisible()) {
                        return;
                    }

                    oMimeBtn.firePress();
                }
            },
            {
                KEY: "Ctrl+F12", // [WS30] Controller Button
                DESC: oAPP.common.fnGetMsgClsText("/U4A/CL_WS_COMMON", "A11"), // Controller (Class Builder)
                CODE: `new sap.m.Button({
                    icon: "sap-icon://developer-settings",
                    text: oAPP.common.fnGetMsgClsText("/U4A/CL_WS_COMMON", "A11"),
                    tooltip: oAPP.common.fnGetMsgClsText("/U4A/CL_WS_COMMON", "C38") + " (Ctrl+F12)",
                })`,
                fn: (e) => {

                    e.stopImmediatePropagation();
                    
                    if (e.repeat === true) {
                        return;
                    }

                    if (sap.ui.getCore().isLocked()) {
                        zconsole.log("!! 락 걸려서 단축기 실행 불가!!");
                        return;
                    }

                    // 단축키 실행 할지 말지 여부 체크
                    var result = oAPP.common.fnShortCutExeAvaliableCheck();

                    // X 이면 실행 불가
                    if (result == "X") {
                        return;
                    }

                    var oControllerBtn = sap.ui.getCore().byId("ws30_controllerBtn");
                    if (!oControllerBtn || !oControllerBtn.getEnabled() || !oControllerBtn.getVisible()) {
                        return;
                    }

                    oControllerBtn.firePress();
                }
            },
            ];

        // // Shortcut에 대한 이미지 경로
        // for(var oItem of aShortCutWS10){
        //     oItem.IMG_SRC = parent.PATH.join(sImgRootPath, "WS10", oItem.KEY + ".png")
        // }

        // for(var oItem of aShortCutWS20){
        //     oItem.IMG_SRC = parent.PATH.join(sImgRootPath, "WS20", oItem.KEY + ".png")
        // }

        // for(var oItem of aShortCutWS30){
        //     oItem.IMG_SRC = parent.PATH.join(sImgRootPath, "WS30", oItem.KEY + ".png")
        // }

        var oShortcutList = {
            "WS10": aShortCutWS10,
            "WS20": aShortCutWS20,
            "WS30": aShortCutWS30
        };

        return oShortcutList[sPgNo] || [];

    }; // end of oAPP.common.getShortCutList

    /************************************************************************
     * 현재 페이지 별 단축키 설정
     * **********************************************************************
     * @param {String} sPgNo  
     * - page 명
     * 예) WS10, WS20     
     ************************************************************************/
    oAPP.common.setShortCut = function (sPgNo) {

        var oShortcut = oAPP.attr.oShortcut;

        var aShortcutList = oAPP.common.getShortCutList(sPgNo),
            iLength = aShortcutList.length;

        for (var i = 0; i < iLength; i++) {

            var oShortcutInfo = aShortcutList[i];

            oShortcut.add(oShortcutInfo.KEY, oShortcutInfo.fn);

        }

    }; // end of oAPP.common.setShortCut

    /************************************************************************
     * 해당 페이지의 단축키 제거
     * **********************************************************************
     * @param {String} sPgNo  
     * - page 명
     * 예) WS10, WS20     
     ************************************************************************/
    oAPP.common.removeShortCut = function (sPgNo) {

        var oShortcut = oAPP.attr.oShortcut;

        var aShortcutList = oAPP.common.getShortCutList(sPgNo),
            iLength = aShortcutList.length;

        for (var i = 0; i < iLength; i++) {

            var oShortcutInfo = aShortcutList[i];

            oShortcut.remove(oShortcutInfo.KEY);

        }

    }; // end of oAPP.common.removeShortCut

    /************************************************************************
     * 로그인 상태 체크
     ************************************************************************/
    oAPP.common.sendAjaxLoginChk = function (fnCallback) {

        // var sPath = parent.getServerPath() + "/wsloginchk";
        var sPath = parent.getServerPath() + "/ping_check";

        sendAjax(sPath, undefined, (oReturn) => {

            if (typeof fnCallback == "function") {
                fnCallback(oReturn);
            }

        });

    }; // end of oAPP.common.sendAjaxLoginChk

    /************************************************************************
     * !! 현재 브라우저의 Child 기준 !!
     ************************************************************************
     * 에디터 타입별로 이미 오픈된 팝업이 있는지 확인
     * 있으면 새창을 띄우지 말고 focus 를 준다.
     * **********************************************************************
     * @param {Object} oEditInfo
     * - 오픈 하려는 에디터의 타입 정보
     * 
     * @return {Object} 
     *  - ISOPEN {Boolean} 
     *      true : 같은 타입의 오픈된 에디터 팝업이 이미 있는 경우.
     *      false : 같은 타입의 오픈된 에디터 팝업이 없는 신규일 경우.
     * 
     *  - WINDOW {Object}
     *      BrowserWindow Instance
     *  
     ************************************************************************/
    oAPP.common.getCheckAlreadyOpenWindow = function (OBJTY) {

        var oCurrWin = REMOTE.getCurrentWindow(), // 현재 window
            aChildWin = oCurrWin.getChildWindows(), // 현재 window의 child window           
            iChildWinCnt = aChildWin.length,
            sObjType = OBJTY;

        if (iChildWinCnt <= 0) {
            return {
                ISOPEN: false
            };
        }

        for (var i = 0; i < iChildWinCnt; i++) {

            var oWin = aChildWin[i];

            if (oWin.isDestroyed()) {
                continue;
            }

            try {

                var oWebCon = oWin.webContents;
                var oWebPref = oWebCon.getWebPreferences();
                var sType = oWebPref.OBJTY;

                if (sObjType != sType) {
                    continue;
                }

                oWin.focus();

                return {
                    ISOPEN: true,
                    WINDOW: oWin
                };

            } catch (error) {
                continue;
            }

        }

        return {
            ISOPEN: false
        };

    }; // end of oAPP.common.onCheckAlreadyOpenEditor

    /************************************************************************
     * !! 전체 떠있는 브라우저 기준 !!
     *************************************************************************
     * OBJTY 별로 이미 오픈된 팝업이 있는지 확인
     * 있으면 새창을 띄우지 말고 focus 를 준다.
     * ***********************************************************************
     * @param {Object} oEditInfo
     * - 오픈 하려는 에디터의 타입 정보
     * 
     * @return {Object} 
     *  - ISOPEN {Boolean} 
     *      true : 같은 타입의 오픈된 에디터 팝업이 이미 있는 경우.
     *      false : 같은 타입의 오픈된 에디터 팝업이 없는 신규일 경우.
     * 
     *  - WINDOW {Object}
     *      BrowserWindow Instance
     *  
     ************************************************************************/
    oAPP.common.getCheckAlreadyOpenWindow2 = (OBJTY) => {

        // 현재 떠있는 전체 윈도우를 구한다.
        let aAllWindows = REMOTE.BrowserWindow.getAllWindows(),
            iAllWinLength = aAllWindows.length;

        if (iAllWinLength <= 0) {
            return {
                ISOPEN: false
            };
        }

        // 현재 떠있는 브라우저의 키를 구한다.
        let oCurrWin = REMOTE.getCurrentWindow(),
            oCurrWinWebCon = oCurrWin.webContents,
            oCurrWinWebPref = oCurrWinWebCon.getWebPreferences(),
            sCurrWinBrowsKey = oCurrWinWebPref.browserkey;

        for (var i = 0; i < iAllWinLength; i++) {

            let oWin = aAllWindows[i];

            // 브라우저가 이미 죽었다면..
            if (oWin.isDestroyed()) {
                continue;
            }

            try {

                let oWebCon = oWin.webContents,
                    oWebPref = oWebCon.getWebPreferences(),
                    sBrowsKey = oWebPref.browserkey,
                    sOBJTY = oWebPref.OBJTY;

                // // 현재 떠있는 브라우저의 키와 같은것을 찾는다.
                // if (sCurrWinBrowsKey !== sBrowsKey) {
                //     continue;
                // }

                // OBJTY가 있는지
                if (!sOBJTY) {
                    continue;
                }

                // OBJTY가 같은것인지
                if (sOBJTY !== OBJTY) {
                    continue;
                }

            } catch (error) {
                continue;
            }

            // 찾으면 빠져나감
            return {
                ISOPEN: true,
                WINDOW: oWin
            };

        }

        // 그래도 못찾았다면..
        return {
            ISOPEN: false
        };

    };


    /************************************************************************
     *  컨트롤러 클래스 실행
     * **********************************************************************
     * @param {String} METHNM
     * - 클래스의 메소드 명
     * @param {String} INDEX
     * - 클래스 메소드 내의 소스 인덱스
     * @param {String} TCODE (반드시 METHNM, INDEX 파라미터는 null 처리 하고 사용 할 것.)
     * - SAP Transaction Code 
     * @param {String} oAppInfo (AppInfo를 던지고 싶을때 사용)
     * - APP Info
     ************************************************************************/
    oAPP.common.execControllerClass = function (METHNM, INDEX, TCODE, oAppInfo) {

        let oServerInfo = parent.getServerInfo();

        // IPCREDERER로 같은 client && SYSID 창에 일러스트 메시지를 뿌린다!!
        let oSendData = {
            PRCCD: "01",
            CLIENT: oServerInfo.CLIENT,
            SYSID: oServerInfo.SYSID,
            OPTIONS: {
                title: oAPP.common.fnGetMsgClsText("/U4A/MSG_WS", "374"), // SAPGUI Launch
                description: oAPP.common.fnGetMsgClsText("/U4A/MSG_WS", "373"), // Please wait a few minutes.
                illustrationType: "tnt-Radar",
                // [HTML5] sap.m.IllustratedMessageSize.Dialog 은 enum=문자열 "Dialog" — sap 제거(값 동일).
                illustrationSize: "Dialog"
            }
        };

        // 같은 client && SYSID 창에 일러스트 메시지를 뿌린다!!
        parent.IPCRENDERER.send("if-browser-interconnection", oSendData); // #[ws_fn_ipc.js]

        var oParam = {
            METHNM: (METHNM == null ? "" : METHNM),
            INDEX: (INDEX == null ? "0" : INDEX),
            TCODE: (typeof TCODE == "undefined" ? "" : TCODE),
            oAppInfo: oAppInfo,
            BROWSKEY: parent.getBrowserKey() // 브라우저 키
        };

        //#[ws_fn_04.js] SAPGUI 멀티 로그인 여부 체크
        oAPP.fn.fnSapGuiMultiLoginCheck()
            .then(oAPP.fn.fnSapGuiMultiLoginCheckThen.bind(oParam))
            .catch((result) => {

                // 같은 client && SYSID 창에 IllustedMsgDialog를 닫는다
                oSendData.PRCCD = "02";

                parent.IPCRENDERER.send("if-browser-interconnection", oSendData);

                if (result && result.RTMSG) {
                    // 메시지 처리... ([HTML5] sap 미정의 — null)
                    parent.showMessage(null, 10, 'E', result.RTMSG);
                }

            });

    }; // end of oAPP.common.execControllerClass

    // /************************************************************************
    //  * 세션타임아웃 후 전체 로그아웃 및 같은 세션 창 전체 닫기
    //  * **********************************************************************/
    // oAPP.common.setSessionTimeout = function () {

    //     // 세션 타임 아웃 시, logoff 처리
    //     var sPath = parent.getServerPath() + '/logoff';

    //     fetch(sPath);

    //     parent.IPCRENDERER.send('if-browser-close', {
    //         ACTCD: "C", // 같은 세션을 가진 브라우저 중 로그오프가 된 브라우저의 키를 전달한다.
    //         SESSKEY: parent.getSessionKey(),
    //         BROWSKEY: parent.getBrowserKey()
    //     });

    // }; // end of oAPP.common.setSessionTimeout      


    /************************************************************************
     * APP 전체 대상 글로벌 Shortcut 지정하기
     ************************************************************************/
    oAPP.common.fnSetCommonShortcut = function () {

        var oShortcut = oAPP.attr.oShortcut;

        // 새창 띄우기
        oShortcut.add("Ctrl+N", () => {

            // Busy Indicator가 실행중이면 하위 로직 수행 하지 않는다.
            if (parent.getBusy() == 'X') {
                return;
            }

            // 단축키 실행 할지 말지 여부 체크
            var result = oAPP.common.fnShortCutExeAvaliableCheck();

            // X 이면 실행 불가
            if (result == "X") {
                return;
            }

            parent.onNewWindow();

        });

        // 브라우저 창 닫기
        oShortcut.add("Ctrl+W", () => {

            // Busy Indicator가 실행중이면 하위 로직 수행 하지 않는다.
            if (parent.getBusy() == 'X') {
                return;
            }

            // 단축키 실행 할지 말지 여부 체크
            var result = oAPP.common.fnShortCutExeAvaliableCheck();

            // X 이면 실행 불가
            if (result == "X") {
                return;
            }

            // 브라우저의 닫기 버튼 눌렀다는 플래그
            oAPP.attr.isPressWindowClose = "X";

            var oCurrWin = parent.REMOTE.getCurrentWindow();
            oCurrWin.close();

        });

        // 브라우저 zoom 기본설정
        oShortcut.add("Ctrl+0", () => {

            // Busy Indicator가 실행중이면 하위 로직 수행 하지 않는다.
            if (parent.getBusy() == 'X') {
                return;
            }

            // 브라우저 zoom을 0으로 설정            
            oAPP.fn.setBrowserZoomZero();

            // 설정된 zoom 값을 저장
            oAPP.fn.setPersonWinZoom("S");

        });

        oShortcut.add("Ctrl+Shift+F9", (e) => {

            e.stopImmediatePropagation();

            // console.log("F9");
            // console.log(e);
        });


    }; // end of oAPP.common.fnSetCommonShortcut


    /************************************************************************
     * APP 전체 대상 공통 Shortcut 지정하기
     ************************************************************************/
    oAPP.common.fnSetGlobalShortcut = function () {

        // var oGlobalShortcut = parent.GLOBALSHORTCUT;

        // oGlobalShortcut.register('Alt+F4', (e) => {

        //     debugger;

        //     e.preventDefault();

        //     console.log('Alt + F4 is disabled.');

        // });

    }; // end of oAPP.common.fnSetGlobalShortcut


    /************************************************************************
     * APP 전체 대상 글로벌 Shortcut 삭제
     * **********************************************************************/
    oAPP.common.fnRemoveGlobalShortcut = function () {

        var oGlobalShortcut = parent.GLOBALSHORTCUT;

        oGlobalShortcut.unregisterAll();

    }; // end of oAPP.common.fnRemoveGlobalShortcut

    /* [제거됨] oAPP.common.fnSetBusyDialog — 구 UI5 sap.m.Dialog+Avatar(gif) busy.
       전 사용처를 기존 busy(parent.setBusy "X"/"")로 직접 대체하고 함수는 삭제했다.
       (sap.m.AvatarSize.Custom 이 sap 안전스텁에서 터지던 크래시 원인 제거) */

    /************************************************************************
     * 현재 떠있는 화면에서 메뉴 또는 Popover 들을 전부 숨긴다.
     * **********************************************************************/
    oAPP.common.fnCloseMenuPopover = () => {

        var oMenu = document.querySelector(".sapMMenu");
        if (oMenu) {
            // zconsole.log("메뉴 찾았다!");
            oMenu.style.visibility = "hidden";
        }

        var oPopover = document.querySelector(".sapMPopover");
        if (oPopover) {
            // zconsole.log("팝오버 찾았다!");
            oPopover.style.visibility = "hidden";
        }

    }; // end of oAPP.common.fnCloseMenuPopover

    /************************************************************************
     * 확장자만 발췌
     * **********************************************************************/
    oAPP.common.fnGetFileExt = (sPath) => {

        if (sPath == null || typeof sPath != "string") {
            return;
        }


        var sExtension = parent.PATH.extname(sPath);
        sExtension = sExtension.replace('.', '');

        return sExtension;

    };

    /************************************************************************
     * 잘못된 Url 호출 또는 현재 버전에 지원되지 않는 서비스를 호출 하는 경우 오류 메시지
     ************************************************************************/
    oAPP.common.fnUnsupportedServiceUrlCall = (u4a_status, oResult) => {

        //오류 메시지 출력.
        parent.showMessage(sap, 20, oResult.RETCD, oResult.RTMSG);

        switch (u4a_status) {
            case "UA0001":








                break;

            default:

                break;
        }

    }; // end of oAPP.common.fnUnsupportedServiceUrlCall

    /************************************************************************
     * 공통 헤더 메뉴의 Admin 버튼 이벤트
     ************************************************************************/
    oAPP.common.fnAdminHeaderMenu = () => {

        // sap.m.MessageToast.show("준비중입니다.");

        let oAdminDialog = sap.ui.getCore().byId("admDlg");

        // Dialog가 이미 만들어졌을 경우
        if (oAdminDialog) {

            // 이미 오픈 되있다면 return.
            if (oAdminDialog.isOpen()) {
                return;
            }

            oAdminDialog.open();
            return;

        }

        // 실행 브라우저 선택 팝업
        let oDialog = new sap.m.Dialog("admDlg", {

            // Properties
            draggable: true,
            resizable: true,

            // Aggregations
            customHeader: new sap.m.Bar({
                contentLeft: [
                    new sap.m.Title({
                        text: "Admimistrator"
                    }).addStyleClass("sapUiTinyMarginBegin"),
                ]
            }),

            content: [

                new sap.m.Input({
                    // width: "200px",
                    type: sap.m.InputType.Password,
                    value: `{${SYSADM_BIND_ROOT}/PW}`,
                    valueState: `{${SYSADM_BIND_ROOT}/VS}`,
                    valueStateText: `{${SYSADM_BIND_ROOT}/VST}`,
                    submit: () => {
                        oAPP.common.fnAdminSubmit();
                    }
                }).bindProperty("valueState", {
                    parts: [
                        `{${SYSADM_BIND_ROOT}/VS}`,
                    ],
                    formatter: (VS) => {

                        if (!VS) {
                            return sap.ui.core.ValueState.None;
                        }

                    }
                })

            ],

            buttons: [
                new sap.m.Button({
                    type: sap.m.ButtonType.Emphasized,
                    icon: "sap-icon://accept",
                    press: () => {
                        oAPP.common.fnAdminSubmit();
                    }
                }),
                new sap.m.Button({
                    type: sap.m.ButtonType.Reject,
                    icon: "sap-icon://decline",
                    press: () => {

                        oDialog.close();

                    }
                }),
            ],
            afterClose: () => {

                oAPP.common.fnSetModelProperty(`${SYSADM_BIND_ROOT}/PW`, "");

            }

        }).addStyleClass("sapUiContentPadding sapUiSizeCompact");

        oDialog.open();

    }; // end of oAPP.common.fnAdminHeaderMenu

    oAPP.common.fnAdminSubmit = () => {

        debugger;

        APPCOMMON.fnSetModelProperty(`${SYSADM_BIND_ROOT}/VS`, "");
        APPCOMMON.fnSetModelProperty(`${SYSADM_BIND_ROOT}/VST`, "");


        let sAdminPw = APPCOMMON.fnGetModelProperty(`${SYSADM_BIND_ROOT}/PW`);
        if (!sAdminPw) {

            var sMsg = "비밀번호를 입력하세요.";

            APPCOMMON.fnSetModelProperty(`${SYSADM_BIND_ROOT}/VS`, sap.ui.core.ValueState.Error);
            APPCOMMON.fnSetModelProperty(`${SYSADM_BIND_ROOT}/VST`, sMsg);

            return;

        }

        // trial 버전이 아닐때만 수행
        var oWsSettings = oAPP.fn.fnGetSettingsInfo(),
            oSYSADMIN = oWsSettings.SYSADMIN,
            sAuthKey = oSYSADMIN.AUTHKEY,
            sKeyEnc = atob(sAuthKey);

    }; // end of oAPP.common.fnAdminSubmit

    /************************************************************************
     * 전체 화면 상단 공통 버튼
     ************************************************************************/
    oAPP.common.fnGetCommonHeaderButtons = () => {

        let HBOX1 = new sap.m.HBox({
            renderType: sap.m.FlexRendertype.Bare,
            alignItems: sap.m.FlexAlignItems.Center,
        }).addStyleClass("u4aWsCommonHeaderArea");

        /**
         * AI 연결 / 연결해제 버튼
         */
        let BUTTON6 = new sap.m.Button({
            press: async function () {

                // Busy On
                parent.setBusy("X", {});

                // 전체 자식 윈도우에 Busy 킨다.
                oAPP.attr.oMainBroad.postMessage({ PRCCD: "BUSY_ON" });

                let bIsState = oAPP.common.fnGetModelProperty("/UAI/state");

                // AI와 연결을 해제할 경우에는 질문 팝업을 물어본다.
                if (bIsState === true) {

                    let sAction = await new Promise(function (resolve) {

                        // Busy Off
                        parent.setBusy("");

                        // [MSG]
                        let sMsg = "AI와 연결을 해제 하시겠습니까?";

                        parent.showMessage(sap, 30, "I", sMsg, function (sAction) {
                            resolve(sAction);
                        });

                    });

                    // Busy On
                    parent.setBusy("X");

                    if (sAction !== "YES") {

                        // Busy Off
                        parent.setBusy("");

                        return;
                    }

                }

                // AI와 연동 or 연동 해제
                oAPP.fn.setConnectionAI(!!!bIsState);

            }
        });

        // 해당 실행 스크립트 파일경로 및 소스 라인 정보 저장
        parent.DEV_SOURCE_FINDER.setRunScriptPath(BUTTON6);

        HBOX1.addItem(BUTTON6);

        // 연결 상태에 따른 버튼 텍스트 변경
        BUTTON6.bindProperty("text", "/UAI/state", function (bIsState) {

            let sStateText = oAPP.msg.M432; // AI Disconnected

            if (bIsState === true) {
                sStateText = oAPP.msg.M431; // AI Connected
            }

            return sStateText;

        });

        // 연결 상태에 따른 버튼 아이콘 변경
        BUTTON6.bindProperty("icon", "/UAI/state", function (bIsState) {

            if (bIsState !== true) {
                return "sap-icon://disconnected";
            }

            return "sap-icon://connected";

        });

        // 연결 상태에 따른 버튼 타입 변경
        BUTTON6.bindProperty("type", "/UAI/state", function (bIsState) {

            let sButtonType = "Default";

            if (bIsState === true) {
                sButtonType = "Accept";

            }

            return sButtonType;

        });

        BUTTON6.bindProperty("visible", {
            parts: [
                "/SERVERINFO/SYSID",
                "/WS10",
                "/WS20/APP/IS_EDIT",
                "/WS30/APP/IS_EDIT",
                "/UAI",
                "/WS20/APP/S_APP_VMS",
                "/CURR_PAGE"
            ],
            formatter: async function (SYSID, WS10, WS20_IS_EDIT, WS30_IS_EDIT, UAI, S_APP_VMS, CURR_PAGE) {

                var _bIsVisi = await new Promise(function (resove) {

                    let isVisi = false;

                    setTimeout(() => {

                        // APP 정보에 버전 관리 정보가 있다면 View 용으로 만들어야 하기 때문에 버튼을 숨긴다.
                        if (typeof S_APP_VMS !== "undefined") {
                            resove(false);
                        }

                        switch (SYSID) {
                            case "UHA":     // 개발서버
                            case "U4A":     // 운영서버

                                // let ROOTNAV = sap.ui.getCore().byId("WSAPP");
                                // let oCurrPage = ROOTNAV.getCurrentPage();
                                // let sCurrId = oCurrPage.getId();

                                let sCurrId = CURR_PAGE;

                                /**
                                 * 10번 페이지에서는 보여주지 않는다.
                                 */
                                if (sCurrId === "WS10") {

                                    isVisi = true;

                                }

                                // 20번 페이지일 경우, APP 상태가 Edit 상태일 경우에만 활성화 시킨다.
                                if (sCurrId === "WS20") {

                                    // isVisi = ( WS20_IS_EDIT === "X" ? true : false );
                                    isVisi = true;

                                }

                                // 30번 (USP) 페이지 일 경우, APP 상태가 Edit 상태일 경우에만 활성화 시킨다.
                                if (sCurrId === "WS30") {

                                    // isVisi = ( WS30_IS_EDIT === "X" ? true : false );
                                    isVisi = true;

                                }

                                break;

                            default:
                                break;
                        }

                        resove(isVisi);

                    }, 0);

                });

                return _bIsVisi;

            }
        });



        /****************************************
         * AI 연동 Switch
         * 
         * // ws20_ai_con_btn <== 아이디 바라보는거 다 제거해야함!!!!
         ****************************************/
        let SWITCH1 = new sap.m.Switch({
            state: "{/UAI/state}",
            change: function (oEvent) {

                oAPP.fn.onAiConnSwitchBtn(oEvent); // [ws_fn_05.js]

            }

        });

        // 해당 실행 스크립트 파일경로 및 소스 라인 정보 저장
        parent.DEV_SOURCE_FINDER.setRunScriptPath(SWITCH1);

        // HBOX1.addItem(SWITCH1);        

        SWITCH1.bindProperty("visible", {
            parts: [
                "/SERVERINFO/SYSID",
                "/WS10",
                "/WS20/APP/IS_EDIT",
                "/WS30/APP/IS_EDIT",
                "/UAI",
                "/WS20/APP/S_APP_VMS"
            ],
            formatter: async function (SYSID, WS10, WS20_IS_EDIT, WS30_IS_EDIT, UAI, S_APP_VMS) {

                var _bIsBusy = await new Promise(function (resove) {

                    let isbusy = false;

                    setTimeout(() => {

                        // APP 정보에 버전 관리 정보가 있다면 View 용으로 만들어야 하기 때문에 버튼을 숨긴다.
                        if (typeof S_APP_VMS !== "undefined") {
                            resove(false);
                        }

                        switch (SYSID) {
                            case "UHA":
                            case "U4A":

                                let ROOTNAV = sap.ui.getCore().byId("WSAPP");
                                let oCurrPage = ROOTNAV.getCurrentPage();
                                let sCurrId = oCurrPage.getId();

                                // "10번 페이지일 경우"
                                if (sCurrId === "WS10") {

                                    isbusy = true;

                                }

                                // "20번 페이지일 경우"
                                if (sCurrId === "WS20") {

                                    isbusy = (WS20_IS_EDIT === "X" ? true : false);

                                }

                                // "30번 (USP) 페이지 일 경우"
                                if (sCurrId === "WS30") {

                                    isbusy = (WS30_IS_EDIT === "X" ? true : false);

                                }

                                break;

                            default:
                                break;
                        }

                        resove(isbusy);

                    }, 0);

                });

                return _bIsBusy;

            }
        });


        /****************************************
         * 브라우저 투명도 팝업 버튼
         ****************************************/
        let BUTTON1 = new sap.m.Button({
            icon: "sap-icon://hide",
            press: () => {
                oAPP.fn.fnSetHideWindow();
            }
        });

        // 해당 실행 스크립트 파일경로 및 소스 라인 정보 저장
        parent.DEV_SOURCE_FINDER.setRunScriptPath(BUTTON1);

        HBOX1.addItem(BUTTON1);


        /****************************************
         * SAP LOGO ICON
         ****************************************/
        let ICON1 = new sap.ui.core.Icon({
            src: "sap-icon://sap-logo-shape",
            size: "24px",
            color: "#FFFFFF",
            backgroundColor: "#2563EB",
            press: function () {

                oAPP.common.execControllerClass(null, null, "SMEN", null);

            }
        });

        ICON1.addStyleClass("u4aWsSapguiLogo");

        // 해당 실행 스크립트 파일경로 및 소스 라인 정보 저장
        parent.DEV_SOURCE_FINDER.setRunScriptPath(ICON1);

        HBOX1.addItem(ICON1);


        /****************************************
         * T-CODE 검색
         ****************************************/
        let SEARCHFIELD1 = new sap.m.SearchField({

            // properties
            width: "200px",
            maxLength: 20, // SAP Standard 기준으로 T-CODE는 최대 20자
            placeholder: "SAP T-CODE",
            showSearchButton: false,
            enableSuggestions: true,

            // aggregations
            suggestionItems: {
                path: "/SUGG/TCODE",
                sorter: "{ path : '/SUGG/TCODE/TCODE' }",
                template: new sap.m.SuggestionItem({
                    // key: "{TCODE}",
                    text: "{TCODE}",
                })
            },

            // events
            liveChange: function (oEvent) {

                var oInput = oEvent.getSource(),
                    sValue = oInput.getValue();

                if (typeof sValue == "string" && sValue.length > 0 && sValue !== "") {
                    oInput.setValue(sValue.toUpperCase());
                }

            },
            search: (oEvent) => {
                oAPP.events.ev_pressTcodeInputSubmit(oEvent); // #[ws_events_01.js]                        
            },
            suggest: (oEvent) => {
                oAPP.events.ev_suggestSapTcode(oEvent);
            }

        });

        // 해당 실행 스크립트 파일경로 및 소스 라인 정보 저장
        parent.DEV_SOURCE_FINDER.setRunScriptPath(SEARCHFIELD1);

        HBOX1.addItem(SEARCHFIELD1);

        SEARCHFIELD1.addStyleClass("u4aWs30sapTcodeInput");

        SEARCHFIELD1.addEventDelegate({
            onAfterRendering: function (oEvent) {

                // 간헐적으로 SearchField에 값을 입력하면 maxlength가 적용이 되지 않아
                // 직접 maxlength 구현
                let oSF = oEvent.srcControl;
                let oSFInput = oSF.getDomRef("I");
                if (!oSFInput) {
                    return;
                }

                oSFInput.setAttribute("maxlength", oSF.getMaxLength());

            }
        });


        /****************************************
         * Browser Pin Button
         ****************************************/
        let BUTTON2 = new sap.m.OverflowToolbarToggleButton({
            icon: "sap-icon://pushpin-off",
            pressed: "{/SETTING/ISPIN}",
            tooltip: "Browser Pin",
            press: oAPP.events.ev_windowPinBtn
        });

        // 해당 실행 스크립트 파일경로 및 소스 라인 정보 저장
        parent.DEV_SOURCE_FINDER.setRunScriptPath(BUTTON2);

        HBOX1.addItem(BUTTON2);


        /****************************************
         * zoom 기능
         ****************************************/
        let BUTTON3 = new sap.m.Button({
            icon: "sap-icon://zoom-in",
            press: oAPP.events.ev_pressZoomBtn,
            tooltip: "zoom",
        });

        // 해당 실행 스크립트 파일경로 및 소스 라인 정보 저장
        parent.DEV_SOURCE_FINDER.setRunScriptPath(BUTTON3);

        HBOX1.addItem(BUTTON3);


        /****************************************
         * 검색 버튼
         ****************************************/
        let BUTTON4 = new sap.m.Button({
            icon: "sap-icon://search",
            tooltip: "window Text Search",
            press: oAPP.events.ev_winTxtSrchWS10
        });

        // 해당 실행 스크립트 파일경로 및 소스 라인 정보 저장
        parent.DEV_SOURCE_FINDER.setRunScriptPath(BUTTON4);

        HBOX1.addItem(BUTTON4);


        /****************************************
         * Logoff 버튼
         ****************************************/
        let BUTTON5 = new sap.m.Button({
            icon: "sap-icon://log",
            type: sap.m.ButtonType.Reject,
            press: oAPP.events.ev_Logout
        });

        // 해당 실행 스크립트 파일경로 및 소스 라인 정보 저장
        parent.DEV_SOURCE_FINDER.setRunScriptPath(BUTTON5);

        HBOX1.addItem(BUTTON5);

        return HBOX1;

    }; // end of oAPP.common.fnGetCommonHeaderButtons

    /**
     * Busy & Lock
     * @param {CHAR1} isbusy "X", ""
     */
    oAPP.common.fnSetBusyLock = (isbusy) => {

        let bIsbusy = (isbusy == "X" ? true : false);

        if (bIsbusy) {

            // 화면 Lock 걸기
            sap.ui.getCore().lock();

            // Busy를 킨다.
            parent.setBusy("X");

            return;
        }

        // 화면 Lock 해제
        sap.ui.getCore().unlock();

        // Busy를 끈다.
        parent.setBusy("");

    }; // end of oAPP.common.fnSetBusyLock

    /**
     * 주어진 시간 동안 멈추기
     * @param {Integer} iTime 멈추는 시간 (ms)
     * @returns 
     */
    oAPP.common.fnSleep = (iTime) => {

        return new Promise((resolve) => {

            setTimeout(() => {

                resolve();

            }, iTime);

        });

    }; // end of oAPP.common.fnSleep

    /**
     * ProgressDialog
     * [HTML5] 구 sap.m.Dialog + sap.m.IllustratedMessage(tnt-Systems) + sap.m.ProgressIndicator
     *   → 네이티브 <dialog>. fnIllustMsgDialogOpen 과 동일 패턴(위성안테나 SVG <img> + 카드)에
     *   다운로드 % 프로그레스바(div)만 추가. sap 의존 제거(WS20 HTML5 빌드는 sap 스텁이라
     *   기존 UI5 판은 도움말 zip 최초 다운로드 시 진행 팝업이 안 떴음).
     *   주 호출처: www/help/u4a_helpdoc/main.js(도움말 문서 다운로드 진행/압축해제 안내).
     *
     * @param {Object} oOptions
     * title / description / illustrationType(미사용·호환) / percentValue / displayValue
     */
    // ── 프로그레스바 값 갱신(공통 헬퍼) ──
    function lf_setWsProgValue(oDlg, percent, sText) {
        if (!oDlg) { return; }
        var p = Number(percent);
        if (!isFinite(p) || p < 0) { p = 0; }
        if (p > 100) { p = 100; }
        var oBar = oDlg.querySelector(".u4aWsProgBar");
        var oTxt = oDlg.querySelector(".u4aWsProgBarText");
        if (oBar) { oBar.style.width = p + "%"; }
        if (oTxt) { oTxt.textContent = sText || ""; }
    }

    oAPP.common.fnProgressDialogOpen = (oOptions) => {
        oOptions = oOptions || {};
        var sDialogId = "u4aWsProgressDialog";

        // 스타일 1회 주입(테마 토큰 소비, 일러스트는 외부 SVG 고정색 — fnIllustMsgDialogOpen 과 동일 컨벤션).
        if (!document.getElementById("u4aWsProgStyle")) {
            var st = document.createElement("style");
            st.id = "u4aWsProgStyle";
            st.textContent =
                ".u4aWsProgDlg{border:0;padding:0;background:transparent;overflow:visible;" +
                "min-width:0;max-width:none;width:fit-content;box-shadow:none;border-radius:0}" +
                ".u4aWsProgDlg::backdrop{background:rgba(15,18,28,.32);backdrop-filter:blur(1.5px)}" +
                ".u4aWsProgCard{display:flex;flex-direction:column;align-items:center;gap:.55rem;" +
                "padding:1.6rem 2.1rem 1.5rem;text-align:center;min-width:18rem;max-width:24rem;" +
                "background:var(--surface-raised,#1b2128);color:var(--text,#fff);" +
                "border:1px solid var(--line,#33414f);border-radius:16px;" +
                "box-shadow:var(--popover-shadow,0 18px 50px rgba(0,0,0,.55))}" +
                ".u4aWsProgArt{width:8.25rem;height:auto;display:block;margin-bottom:.35rem}" +
                ".u4aWsProgTitle{font-weight:700;font-size:1.02rem;letter-spacing:.2px}" +
                ".u4aWsProgTitle:empty{display:none}" +
                ".u4aWsProgDesc{font-size:.8125rem;color:var(--text-muted,#9aa3ad);line-height:1.45;" +
                "white-space:pre-line;min-height:1.1em}" +
                ".u4aWsProgBarWrap{position:relative;width:100%;height:1.1rem;margin-top:.5rem;" +
                "background:var(--line,#33414f);border-radius:.55rem;overflow:hidden}" +
                ".u4aWsProgBar{height:100%;width:0%;background:var(--accent,#3b82f6);" +
                "border-radius:.55rem;transition:width .2s ease}" +
                ".u4aWsProgBarText{position:absolute;inset:0;display:flex;align-items:center;" +
                "justify-content:center;font-size:.7rem;color:var(--text,#fff)}";
            document.head.appendChild(st);
        }

        var oDlg = document.getElementById(sDialogId);
        if (!oDlg) {
            oDlg = document.createElement("dialog");
            oDlg.id = sDialogId;
            oDlg.className = "u4aWsProgDlg";
            // 위성 안테나 로딩 일러스트(www/svg/...) — fnIllustMsgDialogOpen 과 동일 자산/경로 규칙.
            //   ws_common.js 는 ajax+eval 로드(스크립트 태그 없음)라 host 문서(www/ws30/ws10_20/) 기준.
            var sArtRel = "../../svg/satellite-antenna-loading-animated.svg";
            var sArtUrl = sArtRel;
            try { sArtUrl = new URL(sArtRel, window.location.href).href; } catch (e) { }
            oDlg.innerHTML =
                '<div class="u4aWsProgCard">' +
                '<img class="u4aWsProgArt" src="' + sArtUrl + '" alt="" aria-hidden="true"/>' +
                '<div class="u4aWsProgTitle"></div>' +
                '<div class="u4aWsProgDesc"></div>' +
                '<div class="u4aWsProgBarWrap"><div class="u4aWsProgBar"></div>' +
                '<div class="u4aWsProgBarText"></div></div>' +
                '</div>';
            // esc 로 닫히지 않게(원본 escapeHandler 빈 함수).
            oDlg.addEventListener("cancel", function (e) { e.preventDefault(); });
            document.body.appendChild(oDlg);
        }

        oDlg.querySelector(".u4aWsProgTitle").textContent = oOptions.title || "";
        oDlg.querySelector(".u4aWsProgDesc").textContent = oOptions.description || "";
        lf_setWsProgValue(oDlg, oOptions.percentValue || 0, oOptions.displayValue || "");

        try { if (!oDlg.hasAttribute("open")) { oDlg.showModal(); } } catch (e) { }

    }; // end of oAPP.common.fnProgressDialogOpen

    /**
     * ProgressDialog 진행값 갱신
     * [HTML5] 구 sap.ui.getCore().byId("u4aWsProg").setPercentValue/setDisplayValue 대체.
     *   main.js gfn_setProgressbar 가 다운로드 진행률(%)·표시문구를 갱신할 때 호출.
     * @param {number} percent  0~100
     * @param {string} sText    바 가운데 표시 문구(예: "Download.....50%")
     */
    oAPP.common.fnProgressDialogSetValue = (percent, sText) => {
        var oDlg = document.getElementById("u4aWsProgressDialog");
        lf_setWsProgValue(oDlg, percent, sText);
    }; // end of oAPP.common.fnProgressDialogSetValue

    /**
     * ProgressDialog Close
     */
    oAPP.common.fnProgressDialogClose = () => {
        // [HTML5] 네이티브 <dialog> 닫기 + 진행값 리셋(원본 afterClose).
        var oDlg = document.getElementById("u4aWsProgressDialog");
        if (oDlg) {
            try { oDlg.close(); } catch (e) { }
            lf_setWsProgValue(oDlg, 0, "");
        }

    }; // end of oAPP.common.fnProgressDialogClose


    /**
     * IllustMessage Dialog Open
     * @param {*} options 
     * title
     * description
     * illustrationType
     * illustrationSize
     */
    // [HTML5] 구 sap.m.IllustratedMessage(tnt-Radar) + sap.m.Dialog → 네이티브 <dialog>.
    //   위성 안테나 로딩 일러스트(www/svg/satellite-antenna-loading-animated.svg, <img> 로드) +
    //   제목/설명 카드. sap 의존 제거. SAPGUI 실행 등 진행 안내 모달(IPC if-browser-interconnection).
    oAPP.common.fnIllustMsgDialogOpen = (oOptions) => {
        oOptions = oOptions || {};
        var sDialogId = "u4aWsIllustedMsgDialog";

        // 스타일 1회 주입 — 카드/텍스트는 테마 토큰(HTML 이라 var() 동작), 일러스트(위성안테나)는
        //   외부 SVG 의 고정 블루(원본 SAP IllustratedMessage 처럼 테마 무관). 백드롭은 옅게(가독 위해).
        if (!document.getElementById("u4aWsIllustStyle")) {
            var st = document.createElement("style");
            st.id = "u4aWsIllustStyle";
            st.textContent =
                // ★ u4a-dialog 클래스의 min-width(22rem)/box-shadow/border-radius 가 새어나와
                //   투명 다이얼로그가 카드보다 넓어지고(좌측정렬) 우측에 그림자·둥근모서리가
                //   "카드 가장자리처럼" 삐져나오던 것 차단 — 다이얼로그를 카드 크기에 딱 맞춘다.
                ".u4aWsIllustDlg{border:0;padding:0;background:transparent;overflow:visible;" +
                "min-width:0;max-width:none;width:fit-content;box-shadow:none;border-radius:0}" +
                ".u4aWsIllustDlg::backdrop{background:rgba(15,18,28,.32);backdrop-filter:blur(1.5px)}" +
                ".u4aWsIllustCard{display:flex;flex-direction:column;align-items:center;gap:.55rem;" +
                "padding:1.6rem 2.1rem 1.5rem;text-align:center;min-width:16rem;max-width:21rem;" +
                "background:var(--surface-raised,#1b2128);color:var(--text,#fff);" +
                "border:1px solid var(--line,#33414f);border-radius:16px;" +
                "box-shadow:var(--popover-shadow,0 18px 50px rgba(0,0,0,.55));" +
                "animation:u4aWsIllustIn .18s ease both}" +
                ".u4aWsIllustArt{width:8.25rem;height:auto;display:block;margin-bottom:.35rem}" +
                ".u4aWsIllustTitle{font-weight:700;font-size:1.02rem;letter-spacing:.2px}" +
                ".u4aWsIllustDesc{font-size:.8125rem;color:var(--text-muted,#9aa3ad);line-height:1.45;min-height:1.1em}" +
                "@keyframes u4aWsIllustIn{from{opacity:0;transform:translateY(6px) scale(.97)}to{opacity:1;transform:none}}" +
                "@media(prefers-reduced-motion:reduce){.u4aWsIllustCard{animation:none}}";
            document.head.appendChild(st);
        }

        var oDlg = document.getElementById(sDialogId);
        if (!oDlg) {
            oDlg = document.createElement("dialog");
            oDlg.id = sDialogId;
            // ★ u4a-dialog 클래스 제거 — 그 클래스의 min-width(22rem)/box-shadow/border-radius 가
            //   카드보다 넓은 투명 박스를 만들어 우측에 반투명 그림자 슬라이버가 삐져나오던 원인.
            //   레이더 카드(.u4aWsIllustCard)가 자체 배경·보더·그림자를 다 가지므로 다이얼로그는
            //   순수 컨테이너(.u4aWsIllustDlg)면 충분.
            oDlg.className = "u4aWsIllustDlg";
            // [HTML5] 위성 안테나 로딩 일러스트(www/svg/satellite-antenna-loading-animated.svg)를
            //   <img> 로 로드 — SVG 내부 <style>(generic .dish/.scan/.cross 등 클래스·keyframe)이
            //   문서 전역으로 새어 충돌하는 것을 막기 위함(인라인하면 SVG <style> 이 document 스코프).
            //   ws_common.js 는 <script src> 가 아니라 ajax+eval 로 로드되므로(스크립트 태그 없음)
            //   호스트 문서(window.location.href, = www/ws30/ws10_20/) 기준으로 해석한다.
            //   www/ws30/ws10_20/ → ../../svg/ = www/svg/ (preload 의 "./js/..." 해석과 동일 규칙).
            var sArtRel = "../../svg/satellite-antenna-loading-animated.svg";
            var sArtUrl = sArtRel;
            try { sArtUrl = new URL(sArtRel, window.location.href).href; } catch (e) { }
            oDlg.innerHTML =
                '<div class="u4aWsIllustCard">' +
                // 위성 안테나 로딩 일러스트(접시 + 신호파 + 부유 애니메이션) — SVG 내부 CSS 애니메이션은
                //   <img> 로 로드해도 정상 재생되며 스타일은 이미지 문서에 샌드박스된다.
                '<img class="u4aWsIllustArt" src="' + sArtUrl + '" alt="" aria-hidden="true"/>' +
                '<div class="u4aWsIllustTitle"></div>' +
                '<div class="u4aWsIllustDesc"></div>' +
                '</div>';
            // esc 로 닫히지 않게(원본 escapeHandler 빈 함수)
            oDlg.addEventListener("cancel", function (e) { e.preventDefault(); });
            document.body.appendChild(oDlg);
        }

        oDlg.querySelector(".u4aWsIllustTitle").textContent = oOptions.title || "";
        oDlg.querySelector(".u4aWsIllustDesc").textContent = oOptions.description || "";

        try { if (!oDlg.hasAttribute("open")) { oDlg.showModal(); } } catch (e) { }

    }; // end of oAPP.common.fnIllustMsgDialogOpen

    /**
     * IllustMessage Dialog Close     
     */
    oAPP.common.fnIllustMsgDialogClose = () => {
        // [HTML5] 네이티브 <dialog> 닫기 (sap 의존 제거)
        var oDlg = document.getElementById("u4aWsIllustedMsgDialog");
        if (oDlg) { try { oDlg.close(); } catch (e) { } }

    }; // end of oAPP.common.fnIllustMsgDialogClose

    /**
     * WS Header Title 변경     
     */
    oAPP.common.setWSHeadText = (sText) => {

        let oHeaderText = sap.ui.getCore().byId("u4aWsHeaderTitle");
        oHeaderText.setText(sText);

    }; // end of oAPP.common.setWSHeadText

    /**
     * White List Object 유무 확인 
     * 
     * 1. REGTYP
     *   - C : Client,
     *   - S : Server
     * 
     * 2. CHGOBJ
     *  - CTS No
     * 
     * @returns true or false
     */
    oAPP.common.checkWLOList = (REGTYP = "", CHGOBJ = "") => {

        // whiteList Object 목록을 구한다.
        let aWLO = oAPP.common.getWsWLOList();

        // Array 형식인지 여부 확인
        if (!Array.isArray(aWLO)) {
            return false;
        }

        // 전달받은 파라미터에 해당하는 White List Object가 있는지 확인
        let oFindWLO = aWLO.find((elem) => {

            if (elem.REGTYP == REGTYP && elem.CHGOBJ == CHGOBJ) {
                return true;
            }

            return false;

        });

        if (!oFindWLO) {
            return false;
        }

        return true;

    }; // end of oAPP.common.checkWLOList

    /**
     * whiteList Object 목록     
     */
    oAPP.common.getWsWLOList = () => {

        let oCoreModel = sap.ui.getCore().getModel();
        if (!oCoreModel) {
            return [];
        }

        let aWLO = oCoreModel.getProperty("/METADATA/T_REG_WLO");

        if (!aWLO) {
            return [];
        }

        // 데이터 구조가 Array 인지 체크
        if (!Array.isArray(aWLO)) {
            return [];
        }

        if (aWLO.length == 0) {
            return [];
        }

        return aWLO;

    }; // end of oAPP.common.getWsWLOList


    /**
     * Custom Event 등록
     * @param {string} eventName
     * - 이벤트 명
     * 
     * @param {function} cb 
     * - 이벤트 콜백
     * 
     * @returns {EventTarget}
     */
    oAPP.common.addCustomEvent = function (eventName, cb) {

        const oEventTarget = new EventTarget();

        oEventTarget.addEventListener(eventName, cb);

        return oEventTarget;

    }; // end of oAPP.common.addCustomEvent


})(window, $, oAPP);

// 세션 죽이기
function fnKillSession(oFormData, fn_callback) {

    parent.setBusy('X');

    var sPath = parent.getServerPath() + '/kill_session';

    sendAjax(
        sPath,
        oFormData,
        (oReturn) => { // success

            if (typeof fn_callback == "function") {
                fn_callback(oReturn);
            }

        },
        null,
        null,
        null,
        (oReturn) => { // fail
            if (typeof fn_callback == "function") {
                fn_callback(oReturn);
            }
        },
        "X"
    );

}


// application 초기 정보
function ajax_init_prc(oFormData, fn_callback, fn_fail) {

    parent.setBusy('X');

    var sPath = parent.getServerPath() + '/init_prc';

    // function sendAjax(sPath, oFormData, fn_success, bIsBusy, bIsAsync, meth, fn_error, bIsBlob) {

    sendAjax(
        sPath,
        oFormData,
        (oReturn) => { // success

            if (typeof fn_callback == "function") {
                fn_callback(oReturn);
            }

        },
        null,
        null,
        null,
        (oReturn) => { // fail
            if (typeof fn_fail == "function") {
                fn_fail(oReturn);
            }
        }
    );

} // end of ajax_init_prc

// critical 오류
function fnCriticalError() {

    // 현재 같은 세션으로 떠있는 브라우저 창을 전체 닫는다.
    fn_logoff_success("");

}

// JSON Parse Error
function fnJsonParseError(e) {

    console.error(e);

    // JSON parse 오류 일 경우는 critical 오류로 판단하여 메시지 팝업 호출 후 창 닫게 만든다.

    // 화면 Lock 해제 ([HTML5] UI5 제거 환경에선 sap 미정의 — 가드)
    if (typeof sap !== "undefined" && sap.ui) { sap.ui.getCore().unlock(); }

    parent.setBusy("");

    // Fatal Error! Please contact your system administrator.
    let sErrmsg = oAPP.common.fnGetMsgClsText("/U4A/MSG_WS", "192") + " \n \n " + e.toString();
    // let sErrmsg = "Critical Error 관리자에게 문의 하세요. \n\n " + e.toString();

    parent.showMessage(null, 20, "E", sErrmsg, fnCriticalError);

}


/**********************************************************************************************
 * 📝 공통 신규 ajax 기존 로직 
 **********************************************************************************************/
function sendAjax(sPath, oFormData, fn_success, bIsBusy, bIsAsync, meth, fn_error, bIsBlob, iTimeout = 600000) {

    var oXHR = new XMLHttpRequest();

    // let iReqMsgTime = 10000;
    let iReqMsgTime = 1000; // 1초

    // 10초 뒤에도 응답이 없을 경우에는 BusyDialog를 띄운다.
    let iReqMsgTimeout = setTimeout(function () {

        let _oBind = this;

        // Request Path
        let sPath = _oBind.sPath;

        try {
            var oURL = new URL(sPath);
        } catch (error) {
            return;
        }

        // 서버 호출시 Path를 구한다.
        let sPathName = oURL.pathname;
        let sBaseName = parent.PATH.basename(sPathName);
        let sReqPath = sBaseName + oURL.hash;
        sReqPath = sReqPath.toUpperCase();

        // Path에 맞는 메시지 매핑 텍스트 정보를 구한다.
        let sReqMsg = oAPP.common.fnGetAjaxReqMsgTxt("AJAX_REQ_MSG_001", sReqPath);
        if (!sReqMsg) {
            return;
        }

        // parent.setBusy("");

        // if(parent.getBusy() === "X"){
        parent.setBusy("X", { DESC: sReqMsg });
        // }

    }.bind({ sPath: sPath }), iReqMsgTime);

    // 사용자 로그인 정보를 구한다.
    let oUserInfo = parent.getUserInfo();

    /**
     * 서버 통신 시 버전, 패치 레벨 정보 전송 -- Start
     */
    if (oFormData && oFormData instanceof FormData == true) {

        oFormData.append("WSVER", oUserInfo.WSVER);
        oFormData.append("WSPATCH_LEVEL", oUserInfo.WSPATCH_LEVEL);

    }

    // // 전송방식에 따른, 버전 & 패치레벨 정보 파라미터 구성
    // if (!meth || meth !== "POST") {

    //     if (sPath.indexOf("?") == -1) {
    //         sPath += "?";
    //     } else {
    //         sPath += "&";
    //     }

    //     sPath += `WSVER=${oUserInfo.WSVER}&WSPATCH_LEVEL=${oUserInfo.WSPATCH_LEVEL}`;
    // }

    // 전송방식에 따른, 버전 & 패치레벨 정보 파라미터 구성
    if (meth === "GET") {

        let queryString = "";
        if (oFormData && oFormData instanceof FormData == true) {
            queryString = new URLSearchParams(oFormData).toString();
            if (queryString !== "") {
                queryString = queryString + "&";
            }

        }

        if (sPath.indexOf("?") == -1) {
            sPath += "?";
        } else {
            sPath += "&";
        }

        sPath += `${queryString}WSVER=${oUserInfo.WSVER}&WSPATCH_LEVEL=${oUserInfo.WSPATCH_LEVEL}`;
        oFormData = undefined;

    }


    zconsole.log(`[ajax 요청]: ${sPath}`);

    /**
     * 서버 통신 시 버전, 패치 레벨 정보를 무조건 전송 -- End
     */


    // Default Values
    var busy = 'X',
        sMeth = 'POST',
        IsAsync = true;

    busy = bIsBusy;

    // if(bIsBusy === "X" || bIsBusybIsBusy === ""){
    if (bIsBusy === "X") {

        // 부모영역에 현재 busy 실행 여부 정보를 전달
        parent.setBusy(busy);

    }

    // 서버 요청에 대한 정상 응답
    oXHR.onload = function (e) {

        zconsole.log(`[ajax 응답]: ${sPath}`);

        // 서버 요청 메시지 팝업 타임아웃을 죽인다.
        if (typeof iReqMsgTimeout !== "undefined") {
            clearTimeout(iReqMsgTimeout);
            iReqMsgTimeout = undefined;
        }

        // Status 코드가 오류일 경우는 오류쪽 function 호출
        if (e?.target?.status !== 200 && e?.target?.status !== 201) {

            _onError(e);

            return;

        }

        // 혹시 sap에서 응답 헤더 중 오류 내용이 있다면 오류 처리
        let sap_err = oXHR.getResponseHeader("sap-err-id");
        if (sap_err) {

            // 현재 같은 세션으로 떠있는 브라우저 창을 전체 닫고 내 창은 Session Timeout 팝업 호출
            fn_logoff_success('X');

            // 전역 busy 종료
            parent.setBusy("");

            return;

        }

        // u4a status 응답 헤더를 읽는다
        let u4a_status = oXHR.getResponseHeader("u4a_status");

        // status 값이 있다면 서버에서 오류 발생
        if (u4a_status) {

            // 전역 busy 종료
            parent.setBusy("");

            // gif busy dialog 종료 (앱 생성 시 사용하는 Busy)
            parent.setBusy("");

            try {

                var oResult = JSON.parse(oXHR.response);

            } catch (error) {

                fnJsonParseError(error);

                return;
            }

            // 잘못된 url 이거나 지원하지 않는 기능 처리
            oAPP.common.fnUnsupportedServiceUrlCall(u4a_status, oResult);

            return;
        }

        // 응답 타입이 Blob일 경우 응답 데이터를 success 콜백을 호출한다.
        if (oXHR.responseType === 'blob') {

            if (typeof fn_success === "function") {
                fn_success(oXHR.response, oXHR);
            }

            return;

        }

        var oReturn = oXHR.response;
        if (oReturn === "") {
            oReturn = JSON.stringify({});
        }

        try {
            var oResult = JSON.parse(oReturn);

        } catch (e) {

            fnJsonParseError(e);

            return;
        }

        // Critical Error 일 경우 로그아웃 처리
        if (oResult.RETCD === "Z") {

            // 화면 Lock 해제
            sap.ui.getCore().unlock();

            parent.setBusy("");

            parent.showMessage(sap, 20, 'E', oResult.RTMSG, fnCriticalError);

            return;

        }

        // 로그인 티켓 만료되면 로그인 페이지로 이동한다.
        if (oResult.TYPE === "E") {

            // error 콜백이 있다면 호출
            if (typeof fn_error === "function") {
                fn_error();
            }

            // 현재 같은 세션으로 떠있는 브라우저 창을 전체 닫고 내 창은 Session Timeout 팝업 호출
            fn_logoff_success('X');

            return;

        }

        if (typeof fn_success === "function") {
            fn_success(oResult);
        }

    }; // end of oXHR.onload


    /***********************************************
     * 통신 오류 또는 timeout 발생 시
     ***********************************************/
    function _onError(e) {

        // 서버 요청 메시지 팝업 타임아웃을 죽인다.
        if (typeof iReqMsgTimeout !== "undefined") {
            clearTimeout(iReqMsgTimeout);
            iReqMsgTimeout = undefined;
        }

        // 타임아웃일 경우
        if (e.type === "timeout") {

            let _sConsoleMsg = "[ ajax request timeout ]\n";
            _sConsoleMsg += `req url: ${sPath}\n`;
            _sConsoleMsg += "path: [ ws_common.js => _onError ]\n";
            _sConsoleMsg += " request timeout 오류!!";

            console.error(_sConsoleMsg);

            // 현재 같은 세션으로 떠있는 브라우저 창을 전체 닫고 내 창은 Session Timeout 팝업 호출
            let sTitle = oAPP.common.fnGetMsgClsText("/U4A/CL_WS_COMMON", "D85");
            let sDesc = oAPP.common.fnGetMsgClsText("/U4A/MSG_WS", "349"); // Please Try Login Again!
            sDesc += "( Request Timeout )";

            let sIllustType = "tnt-SessionExpired";
            // HTML5 컨텍스트엔 sap 없음 → 크기 enum 가드(미정의 시 문자열 "Dialog").
            let sIllustSize = (typeof sap !== "undefined" && sap.m && sap.m.IllustratedMessageSize) ? sap.m.IllustratedMessageSize.Dialog : "Dialog";

            parent.IPCRENDERER.send('if-browser-close', {
                ACTCD: "A", // 나를 제외한 나머지는 다 죽인다.
                SESSKEY: parent.getSessionKey(),
                BROWSKEY: parent.getBrowserKey()
            });

            // 일러스트 메시지 팝업을 띄운다
            oAPP.fn.fnShowIllustMsgDialog(sTitle, sDesc, sIllustType, sIllustSize, fnSessionTimeOutDialogOk);

            // 화면 Lock 해제 (HTML5 컨텍스트엔 sap 없음 — 가드)
            if (typeof sap !== "undefined" && sap.ui && sap.ui.getCore) { sap.ui.getCore().unlock(); }

            // Busy 종료
            parent.setBusy('');

            return;

        }

        let _sConsoleMsg = "[ ajax request error ]\n";
        _sConsoleMsg += `req url: ${sPath}\n`;
        _sConsoleMsg += "path: [ ws_common.js => sendAjax => _onError ]\n";
        _sConsoleMsg += " request onerror 오류 발생!!";
        _sConsoleMsg += `[status]: ${e?.target?.status}`;

        console.error(_sConsoleMsg);

        // error 콜백이 있다면 호출
        if (typeof fn_error == "function") {
            fn_error();
        }

        parent.IPCRENDERER.send('if-browser-close', {
            ACTCD: "A", // 나를 제외한 나머지는 다 죽인다.
            SESSKEY: parent.getSessionKey(),
            BROWSKEY: parent.getBrowserKey()
        });

        var sCleanHtml = parent.setCleanHtml(oXHR.response);
        if (!sCleanHtml || sCleanHtml === "") {
            //391 통신 오류가 발생하였습니다. 네트워크 상태를 확인하시고 문제가 지속 될 경우 U4A 솔루션 팀에 문의하세요.
            //304 프로그램이 종료됩니다.
            sCleanHtml = oAPP.common.fnGetMsgClsText("ZMSG_WS_COMMON_001", "391") + "\n" +
                oAPP.common.fnGetMsgClsText("/U4A/MSG_WS", "304");
        }

        // HTML5(UI5 제거) 메인 컨텍스트에선 sap 미정의 → 1번째 인자 가드(있으면 sap, 없으면 null).
        parent.showMessage((typeof sap !== "undefined" ? sap : null), 20, 'E', sCleanHtml, fn_callback);

        function fn_callback() {

            // 화면에 떠있는 Dialog 들이 있을 경우 모두 닫는다.
            oAPP.fn.fnCloseAllWs20Dialogs();

            // 현재 같은 세션으로 떠있는 브라우저 창을 전체 닫는다.
            fn_logoff_success("");

        }

        // 화면 Lock 해제 (HTML5 컨텍스트엔 sap 없음 — 가드)
        if (typeof sap !== "undefined" && sap.ui && sap.ui.getCore) { sap.ui.getCore().unlock(); }

        // Busy 종료
        parent.setBusy('');

    } // end of _onError


    // 통신 오류가 발생한 경우
    oXHR.onerror = _onError;

    // Timeout 오류가 발생한 경우
    oXHR.ontimeout = _onError;


    if (meth != null) {
        sMeth = meth;
    }

    if (bIsAsync != null) {
        IsAsync = bIsAsync;
    }

    // async일 경우에만 Timeout을 지정한다 그렇지 않으면 오류 발생됨!!
    if (IsAsync === true) {

        // 요청 타임아웃 시간 지정
        oXHR.timeout = iTimeout;

    }

    oXHR.withCredentials = true;

    // FormData가 없으면 GET으로 전송
    oXHR.open(sMeth, sPath, IsAsync);

    // blob 파일일 경우
    if (bIsBlob == 'X') {
        oXHR.responseType = 'blob';
    }

    if (oFormData) {
        oXHR.send(oFormData);
    } else {
        oXHR.send();
    }

}

// application unlock
function ajax_unlock_app(oParams, fn_callback) {

    var sPath = parent.getServerPath() + '/unlock_app';

    var oFormData = new FormData();
    oFormData.append('APPID', oParams.APPID || "");
    oFormData.append('ACTCD', oParams.ACTCD || "");

    sendAjax(sPath, oFormData, (oReturn) => {

        if (typeof fn_callback == "function") {
            fn_callback(oReturn);
        }

    });

} // end of ajax_unlock_app


// 로그오프 성공시 타는 펑션
function fn_logoff_success(TYPE) {

    // 파라미터가 없을 경우에는 메시지 팝업 없이 강제 종료
    if (!TYPE) {

        parent.setBusy("");

        fnSessionTimeOutDialogOk();

        return;
    }

    // 파라미터가 있을 경우에는 같은 세션 기준으로 나를 제외한 나머지 창들 전체 종료 후
    // Session Timeout 메시지 팝업 호출 후 'OK' 선택 시, 나 자신도 종료

    if (TYPE === "X") {

        let sTitle = oAPP.common.fnGetMsgClsText("/U4A/CL_WS_COMMON", "D85"), // Session Timeout
            sDesc = oAPP.common.fnGetMsgClsText("/U4A/MSG_WS", "349"), // Please Try Login Again!
            sIllustType = "tnt-SessionExpired",
            sIllustSize = sap.m.IllustratedMessageSize.Dialog;

        parent.IPCRENDERER.send('if-browser-close', {
            ACTCD: "A", // 나를 제외한 나머지는 다 죽인다.
            SESSKEY: parent.getSessionKey(),
            BROWSKEY: parent.getBrowserKey()
        });

        oAPP.fn.fnShowIllustMsgDialog(sTitle, sDesc, sIllustType, sIllustSize, fnSessionTimeOutDialogOk);

        parent.setBusy("");

        return;

    }

    parent.setBusy("");

    // 브라우저 창 다 죽인다.    
    fnServerSessionClose();

} // end of fn_logoff_success

function fnServerSessionClose() {

    /**
     * Flow Logic..
     * 
     *	1. 현재 떠있는 창이 몇개 있는지 확인한다. 
     *	2. 내가 아닌 다른 창은 다 닫는다.
     *	3. 나는 로그인 화면으로 전환한다.
     */

    // 현재 브라우저에 종속된 팝업 종류들을 닫는다. [ws_fn_04.js]            
    oAPP.fn.closeAllCurrWinDependentPopups();

    parent.IPCRENDERER.send('if-browser-close', {
        ACTCD: "A", // 나를 제외한 나머지는 다 죽인다.
        SESSKEY: parent.getSessionKey(),
        BROWSKEY: parent.getBrowserKey()
    });

    oAPP.main.fnDetachBeforeunloadEvent();

    // 현재 세션에서 파생된 Childwindow를 닫는다.
    oAPP.fn.fnChildWindowClose(); // #[ws_fn_02.js]

    if (oAPP.attr._oWorker && oAPP.attr._oWorker.terminate) {
        oAPP.attr._oWorker.terminate();
        delete oAPP.attr._oWorker;
    }

    if (oAPP.attr._oServerWorker && oAPP.attr._oServerWorker) {
        oAPP.attr._oServerWorker.terminate();
        delete oAPP.attr._oServerWorker;
    }

    // 현재 브라우저에 걸려있는 shortcut, IPCMAIN 이벤트 등 각종 이벤트 핸들러를 제거 하고, 
    // 현재 브라우저의 화면이 20번 페이지일 경우는 서버 세션 죽이고 Lock도 해제한다.
    oAPP.main.fnBeforeunload("X");

}

function fnSessionTimeOutDialogOk() {

    // // 로그인페이지로 이동..			
    // parent.onMoveToPage("LOGIN");

    // 브라우저 창 다 죽인다.    
    fnServerSessionClose();

}

// 어플리케이션 생성 후 체인지 모드로 가는 펑션
function onAppCrAndChgMode(sAppID) {

    var oAppInput = sap.ui.getCore().byId("AppNmInput"),
        oChgModeBtn = sap.ui.getCore().byId("appChangeBtn");

    if (!oAppInput && !oChgModeBtn) {
        return;
    }

    sAppID = sAppID.toUpperCase();

    oAppInput.setValue(sAppID);
    oChgModeBtn.firePress();

} // end of onAppCrAndChgMode

// Property Help Popup
function fn_PropHelpPopup(sUrl) {

    // busy 키고 Lock 걸기
    oAPP.common.fnSetBusyLock("X");

    oAPP.fn.fnPropertyHelpPopup(sUrl);

}

async function sendServerExit(oOptions, fnCallback) {

    parent.setBusy('X');

    var sUrl = oOptions.URL,
        oFormData = oOptions.FORMDATA;

    var Url = sUrl + "?";

    if (oFormData && oFormData.get) {

        if (oFormData.get("APPID")) {
            Url += `APPID=${oFormData.get("APPID")}&`;
        }

        if (oFormData.get("SSID")) {
            Url += `SSID=${oFormData.get("SSID")}`;
        }

        navigator.sendBeacon(Url);

    } else {

        navigator.sendBeacon(sUrl);
    }

    await oAPP.common.fnSleep(500);

    if (typeof fnCallback === "function") {
        fnCallback();
    }

};


// zconsole.log = (sConsole) => {

//     const
//         APP = zconsole.APP;

//     // 빌드 상태에서는 실행하지 않음.
//     if (APP.isPackaged) {
//         return;
//     }

//     zconsole.log("[zconsole]: " + sConsole);

// };

// zconsole.error = (sConsole) => {

//     const
//         APP = zconsole.APP;

//     // 빌드 상태에서는 실행하지 않음.
//     if (APP.isPackaged) {
//         return;
//     }

//     zconsole.error("[zconsole]: " + sConsole);

// };

// zconsole.warn = (sConsole) => {

//     const
//         APP = zconsole.APP;

//     // 빌드 상태에서는 실행하지 않음.
//     if (APP.isPackaged) {
//         return;
//     }

//     zconsole.warn("[zconsole]: " + sConsole);

// };