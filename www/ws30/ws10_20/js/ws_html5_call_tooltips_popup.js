/* ********************************************************************
 * [BR58] 도움말(Tooltips) 팝업 호출 — HTML5.
 *
 * 원본(as-is): design/js/callTooltipsPopup.js (140행) — 읽기 전용.
 *   ★ 원본 파일은 한 줄도 고치지 않는다(원작 개발자가 design 폴더를 통째로
 *     덮어쓰므로). 그래서 원본 폴더 "밖"인 이 파일에 동일 로직을 이식하고
 *     oAPP.fn.callTooltipsPopup 을 여기서 정의한다.
 *
 * 배경:
 *   원본은 서버에 U4A Help Document(공통코드 UHAK901369)가 등록돼 있으면
 *   그쪽 팝업을 열고 return, 등록이 없는 구버전 서버에서만 이 도움말 창을
 *   폴백으로 연다(uiPreviewArea.js 127~135 / uiAttributeArea.js 614~641 /
 *   uiDesignArea.js 966~985). HTML5 는 그 폴백이 비어 있어 구버전 서버에서
 *   도움말이 아예 뜨지 않았다 → 원본과 동일하게 복원.
 *
 * 원본 대비 바뀐 곳(이 2가지 뿐):
 *   (1) parent.showMessage(sap, ...) → parent.showMessage(null, ...)
 *       HTML5 에는 UI5 전역(sap)이 없다. 첫 인자는 표시 대상 지정용이며
 *       null 이 HTML5 표준(다른 변환 파일 동일).
 *   (2) 창을 여는 모든 실패 갈래(창 생성 실패 / 문서 로드 실패 / 다 뜨기 전 창 닫힘 /
 *       화면 프로세스 종료)에서 오류를 드러내고 busy·단축키 잠금을 반드시 한 번 해제.
 *       (코딩규칙: busy on 은 모든 종료 분기에서 off 짝, 조용한 catch 금지)
 *       원본은 성공 갈래에서만 풀어서, 실패하면 회색 대기 표시가 영영 안 풀린다.
 *       해제는 "정리기" 한 곳에서만 1회 수행 → 이미 푼 뒤 창을 닫아도 그때 진행 중인
 *       다른 작업의 대기 표시를 잘못 풀지 않는다. (BR58 검수 P1 반영)
 *
 * 동작(원본 1:1):
 *   ① 누른 버튼(oUi)이 없으면 단축키 잠금 해제 + busy 해제 후 종료
 *   ② 언어별 도움말 HTML 경로 구성 — 없으면 안내 메시지(377) 후 종료
 *   ③ 제목 = "Tooltips(E20) - 영역명(sCODE)"
 *   ④ 별도 창(760x800, 모달 아님, 처음엔 투명)으로 그 HTML 을 열고
 *      부모 창 가운데 배치 → 다 뜨면 보이기 + 서서히 나타내기
 *      → 단축키 잠금 해제 + busy 해제
 * ******************************************************************** */
(function () {
    "use strict";

    if (typeof oAPP === "undefined" || !oAPP.fn) {
        console.error("[WS20HELP-01] oAPP.fn 미구성 — 도움말 팝업 정의 실패.");
        return;
    }

    /************************************************************************
     * 도움말 팝업 호출. (원본 design/js/callTooltipsPopup.js 10행 1:1)
     * **********************************************************************
     * @param {object} oUi   - 도움말 팝업 선택 UI instance(HTML5 = 누른 버튼 DOM).
     * @param {string} sArea - 도움말 HTML 문서명(prevTooltip/attrTooltip/designTooltip).
     * @param {string} sCODE - 도움말 팝업 title 의 text element(E22/E23/E21).
     ************************************************************************/
    oAPP.fn.callTooltipsPopup = function (oUi, sArea, sCODE) {

        //팝업 호출 ui가 존재하지 않는경우 exit. (원본 13~21행)
        if (!oUi) {
            _releaseLock();
            return;
        }

        //도움말 html의 파일 경로 구성. (원본 24~31행)
        var l_path = lf_setHTMLPath(sArea, sCODE);
        if (!l_path) {
            _releaseLock();
            return;
        }

        //도움말 html 팝업 title 구성. (원본 34행)
        var l_title = lf_setHTMLTitle(sCODE);

        var opt = {
            "height": 760,
            "width": 800,
            "modal": false,
            "show": false,
            "opacity": 0.0,
            "minHeight": 750,
            "minWidth": 500,
            "icon": "www/img/logo.png",
            "title": l_title,
            "autoHideMenuBar": true,
            "parent": parent.REMOTE.getCurrentWindow(),
            "webPreferences": {
                "devTools": true,
                "nodeIntegration": true,
                "contextIsolation": false,
                "nativeWindowOpen": true,
                "webSecurity": false
            }
        };

        //[HTML5 보강 · BR58 검수반영] 창을 여는 모든 실패 갈래에서 busy·단축키 잠금이
        //  반드시 한 번 풀리도록 "정리기"를 하나 두고 모든 끝맺음에 연결한다.
        //  ★ 원본은 성공(did-finish-load) 한 갈래에서만 풀어서, 파일 읽기 실패·창이
        //    다 뜨기 전 닫힘·화면 프로세스 종료 시 회색 대기 표시가 영영 안 풀린다.
        //    (loadURL 은 Electron 14 에서 약속(Promise)을 돌려주므로 아래 동기 catch 로는
        //     로드 실패를 못 잡는다 — 검수 지적 P1.)
        //  정리기는 한 번만 동작한다(두 번째부터 무시) → 성공으로 이미 푼 뒤에 창을 닫아도
        //  그때 진행 중인 다른 작업의 대기 표시를 잘못 풀지 않는다.
        var oWin = null;
        var bDone = false;

        function lf_finish(sWhy, oErr, bFail) {

            if (bDone) { return; }
            bDone = true;

            if (bFail) {

                console.error("[WS20HELP-02] 도움말 창 열기 실패(" + sWhy + ") — 경로:", l_path, oErr || "");

                //추적 코드만 표시(내부 예외 원문 노출 금지 — 상세는 콘솔에 이미 있음).
                //  정식 안내 문구 키는 장군님 번호 지정 대기(임의 문구·키 생성 금지).
                try { parent.showMessage(null, 10, "E", "WS20HELP-02"); }
                catch (e) { console.error("[WS20HELP-02] 오류 안내 표시 실패:", e && e.message); }

                try { if (oWin && !oWin.isDestroyed()) { oWin.destroy(); } }
                catch (e) { console.error("[WS20HELP-02] 창 정리 실패:", e && e.message); }
            }

            _releaseLock();

        }   //정리기(한 번만 동작).

        try {

            oWin = new parent.REMOTE.BrowserWindow(opt);

            oWin.setMenu(null);

            //창이 다 뜨기 전에 닫히거나 화면 프로세스가 죽어도 잠금이 남지 않게.
            oWin.once("closed", function () { lf_finish("창이 먼저 닫힘", null, false); });
            oWin.webContents.once("render-process-gone", function (e, oDetail) {
                lf_finish("화면 프로세스 종료", oDetail, true);
            });
            oWin.webContents.on("did-fail-load", function (e, iCode, sDesc, sUrl, bMainFrame) {
                //본문(주 화면) 실패만 본다 — 문서 안에 끼워 넣은 하위 화면 실패는 제외.
                if (bMainFrame === false) { return; }
                //사용자가 로드 도중 창을 닫으면 취소(-3)로 오는데 이건 오류가 아니다.
                if (iCode === -3) { lf_finish("로드 취소", null, false); return; }
                lf_finish("문서 로드 실패(" + iCode + " " + sDesc + ")", null, true);
            });

            // 브라우저가 활성화 될 준비가 될때 타는 이벤트 (원본 66~71행)
            oWin.once("ready-to-show", function () {

                // 부모 위치 가운데 배치한다.
                try { oAPP.fn.setParentCenterBounds(oWin, opt); }
                catch (e) { console.error("[WS20HELP-04] 창 가운데 배치 실패(준비 시점):", e && e.message); }

            });

            // 브라우저가 오픈이 다 되면 타는 이벤트 (원본 75~90행)
            //  ★ once — 도움말 창이 나중에 다시 로드돼도 잠금 해제가 되풀이되지 않게.
            oWin.webContents.once("did-finish-load", function () {

                //보이기·서서히 나타내기·가운데 배치 중 하나가 실패해도 잠금은 반드시 푼다.
                try {

                    oWin.show();

                    // 윈도우 오픈할때 opacity를 이용하여 자연스러운 동작 연출
                    parent.WSUTIL.setBrowserOpacity(oWin);

                    // 부모 위치 가운데 배치한다.
                    oAPP.fn.setParentCenterBounds(oWin, opt);

                } catch (e) {
                    console.error("[WS20HELP-03] 도움말 창 표시 처리 실패:", e && e.message, e);
                }

                //단축키 잠금 해제처리. + busy 해제.
                lf_finish("정상", null, false);

            });

            //loadURL 은 약속(Promise)을 돌려준다 → 실패는 여기서 받는다.
            var oLoad = oWin.loadURL(l_path);
            if (oLoad && typeof oLoad.catch === "function") {
                oLoad.catch(function (e) {
                    //취소(ERR_ABORTED)는 창을 먼저 닫은 경우라 오류로 보지 않는다.
                    var sMsg = (e && e.message) || "";
                    if (sMsg.indexOf("ERR_ABORTED") >= 0) { lf_finish("로드 취소", null, false); return; }
                    lf_finish("문서 로드 실패", e, true);
                });
            }

        } catch (e) {

            lf_finish("창 생성 실패", e, true);

        }

    };  //도움말 팝업 호출.


    //단축키 잠금 해제 + busy 해제. (원본이 종료 분기마다 반복하던 2줄을 한 곳으로)
    function _releaseLock() {

        try { oAPP.fn.setShortcutLock(false); }
        catch (e) { console.error("[WS20HELP-03] 단축키 잠금 해제 실패:", e && e.message); }

        try { parent.setBusy(""); }
        catch (e) { console.error("[WS20HELP-03] busy 해제 실패:", e && e.message); }

    }   //단축키 잠금 해제 + busy 해제.


    //HTML PATH 구성. (원본 96~121행 1:1)
    function lf_setHTMLPath(sArea, sCODE) {

        var l_langu = parent.getUserInfo().LANGU;

        //HTML파일 PATH 구성.
        var l_path = parent.PATH.join(parent.REMOTE.app.getAppPath(), "ws30", "ws10_20", "design",
            "html", "helper", l_langu, sArea, "index.html");

        //HTML 파일이 존재하지 않는경우 EXIT.
        if (parent.FS.existsSync(l_path) !== true) {

            //377  &1 tooltips HTML file does not exist.
            //  ★ 원본은 첫 인자로 UI5 전역(sap)을 넘겼으나 HTML5 에는 없다 → null.
            parent.showMessage(null, 10, "E",
                oAPP.common.fnGetMsgClsText("/U4A/MSG_WS", "377",
                    oAPP.common.fnGetMsgClsText("/U4A/CL_WS_COMMON", sCODE, "", "", "", ""), "", "", ""));

            return;
        }

        //파일이 존재하는경우 path return.
        return l_path;

    }   //HTML PATH 구성.


    //도움말 html 팝업 title 구성. (원본 125~137행 1:1)
    function lf_setHTMLTitle(S_CODE) {

        //E20  Tooltips
        var l_txt = oAPP.common.fnGetMsgClsText("/U4A/CL_WS_COMMON", "E20", "", "", "", "");

        var l_stitle = oAPP.common.fnGetMsgClsText("/U4A/CL_WS_COMMON", S_CODE, "", "", "", "");

        return l_txt + " - " + l_stitle;

    }   //도움말 html 팝업 title 구성.

})();
