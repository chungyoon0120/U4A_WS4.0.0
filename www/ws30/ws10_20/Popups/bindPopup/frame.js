/****************************************************************************
 * 데이터 모델 바인딩 편집 팝업(Binding Popup) 창 부트/셸 (frame.js) — HTML5
 * --------------------------------------------------------------------------
 *  ★ 소형 callBindPopup(js/fnBindPopupOpen.js = 속성아이콘 인앱 다이얼로그)과 다른 기능 —
 *    이것은 WS20 헤더 "바인딩 팝업"(fnBindWindowPopupOpener)이 여는 대형 별창이다.
 *
 *  원본: frame.html(로더 iframe) + index.html/index.js(UI5 sap.m.App/Page/Splitter + 3영역 모듈)
 *        의 2단 iframe. HTML5: docPopup/runtimeClassNav 과 동일한 1단 frameless 창으로 재작성 —
 *        최상위 문서에 [공통 .u4a-titlebar + 3영역 스플리터 셸]을 직접 둔다.
 *
 *  레이아웃(원본 callBindPopup 1059~ 대응, 기본 BULK 3분할):
 *   · 좌   = 모델 필드 트리(sap.ui.table.TreeTable → 공통 createTree 3열)      [Stage2]
 *   · 중상 = 디자인 트리(앱 전체 UI 계층)                                       [Stage3]
 *   · 중하 = 추가속성 적용 테이블                                               [Stage4]
 *   · 우   = 추가속성(MPROP) 정보 테이블                                        [Stage4]
 *
 *  ★ 불변 계약(07 §13.2 — UI 렌더만 교체, 아래는 그대로 보존):
 *   · IPC `if_modelBindingPopup`(초기 데이터), `if-p13n-themeChange-${SYSID}`(테마추종), `if-dragEnd`.
 *   · BroadcastChannel 주채널 `${browserkey}_ws20_bindpop`(channelKey), 공용 busy `broadcast-to-child-window_${browserkey}`.
 *   · PRCCD 철자 비대칭(UPDATE_DESIGN_DATA 언더바 / UPDATE-DESIGN-DATA 하이픈) 절대 통일 금지.
 *   · dataTransfer prc001/prc002 + DnDRandKey(=SSID). 데이터 키 T_0014/T_0015/oPrev/T_CEVT/T_MPROP.
 *
 *  ★ 이 파일(Stage1) 책임 = 창 셸/부트/타이틀바/테마/busy/공용 busy 브로드캐스트/생명주기.
 *    데이터 로드·주채널(WS20 동기화)·영역 렌더러는 후속 단계 모듈이 담당(아래 _bootApp 훅).
 ****************************************************************************/

var REMOTE = require('@electron/remote'),
    IPCMAIN = REMOTE.require('electron').ipcMain,
    IPCRENDERER = require('electron').ipcRenderer,
    PATH = REMOTE.require('path'),
    APP = REMOTE.app,
    APPPATH = APP.getAppPath(),
    PATHINFO = require(PATH.join(APPPATH, "ws30", "resources", "pathInfo.js")),
    WSUTIL = require(PATHINFO.WSUTIL),
    WSERR = require(PATHINFO.WSTRYCATCH),
    FS = REMOTE.require('fs'),
    USERDATA = APP.getPath('userData'),
    CURRWIN = REMOTE.getCurrentWindow();

var oQueryParams = WSUTIL.QueryString.parse(location.href);

var USERINFO = oQueryParams.USERINFO,
    SESSKEY = oQueryParams.sessionKey,
    BROWSKEY = oQueryParams.browserkey,
    BGCOL = oQueryParams.BGCOL,
    SYSID = USERINFO.SYSID,
    LANGU = USERINFO.LANGU,
    WSMSG = new WSUTIL.MessageClassText(SYSID, LANGU);

var zconsole = WSERR(window, document, console);

/* ==========================================================================
 * 앱 객체 — 원본 index.js 의 oAPP 계약을 유지(영역 모듈이 window.oAPP 로 접근).
 *   attr = 세션/데이터, fn = 함수, ui = 컨트롤 참조, common = 공통.
 * ======================================================================== */
var oAPP = {};
oAPP.fn = {};
oAPP.ui = {};
oAPP.attr = {};
// [S1a §5.1-6] 동일속성 바인딩 화면 활성 플래그(원본 oAPP.attr.bSyncEqualityScreenActive). 기본 false.
oAPP.attr.bSyncEqualityScreenActive = false;
oAPP.common = {};
oAPP.types = {};

/* ── 오류 메시지 계약(SPEC §6) — 원본 index.js:1297/1332 1:1 ─────────────────
 *  검증 실패 시 게이트가 TY_BIND_ERROR 배열(T_RTMSG)을 만들고, 오류목록 팝오버가
 *  각 항목의 "오류 위치 확인"(msg 091) 링크를 ACTCD 로 라우팅해 실제 위치로 이동/강조한다.
 *  ★ ACTCD 값·의미는 원본 그대로. 통일/변경 금지(라우팅 분기 키). */
oAPP.attr.CS_MSG_ACTCD = {
    ACT01: "01",   // 모델(좌측) 트리 영역
    ACT02: "02",   // 디자인 트리 영역
    ACT03: "03",   // 추가속성 정보 영역(우측 MAIN_ADDIT)
    ACT04: "04",   // 디자인 트리 "라인"        — 해당 행 강조 + 스크롤 이동
    ACT05: "05",   // 우측 추가속성 테이블 "라인" — ITMCD 매칭 강조
    ACT06: "06",   // 중앙 하단 추가속성 영역(DESIGN_ADDIT)
    ACT07: "07"    // 중앙 하단 추가속성 "라인"  — ITMCD 매칭 강조
};

// 오류 1건 구조(원본 oAPP.types.TY_BIND_ERROR). LK_VIS=false 면 "오류 위치 확인" 링크 숨김.
oAPP.types.TY_BIND_ERROR = {
    ACTCD: "",      // 오류 위치 ACTION CODE(CS_MSG_ACTCD)
    LINE_KEY: "",   // 오류 라인 KEY(디자인트리=CHILD / 추가속성=ITMCD)
    TYPE: "",       // 오류 TYPE(Error/Warning/Information)
    TITLE: "",      // 오류 제목
    DESC: "",       // 오류 상세
    LK_VIS: true    // 위치확인 링크 노출 여부
};

// 오류 1건 생성 헬퍼 — 원본 JSON.parse(JSON.stringify(TY_BIND_ERROR)) 대응(템플릿 오염 방지).
oAPP.fn.newBindError = function (o) {
    var s = JSON.parse(JSON.stringify(oAPP.types.TY_BIND_ERROR));
    if (o) { for (var k in o) { if (k in s) { s[k] = o[k]; } } }
    return s;
};

oAPP.REMOTE = REMOTE;
oAPP.IPCRENDERER = IPCRENDERER;
oAPP.IPCMAIN = IPCMAIN;
oAPP.PATH = PATH;
oAPP.FS = FS;
oAPP.APP = APP;
oAPP.APPPATH = APPPATH;
oAPP.WSUTIL = WSUTIL;

// [C-9 픽스] 아이콘 이름(T_0022.UICON) → .gif 절대경로 변환기.
//   원본 index.js:8705 / WS20 ws_fn_03.js:315 와 1:1. 라이브 팝업은 index.js 를 로드하지 않아
//   이 함수가 없었고(진단 확정 2026-07-29 hasFn:false), 그 탓에 디자인트리 UI 오브젝트 이미지가 안 떴다.
oAPP.fn.fnGetSapIconPath = function (sIcon) {
    if (sIcon == null) { return; }
    return PATH.join(APP.getAppPath(), "icons", sIcon + ".gif");
};
oAPP.USERDATA = USERDATA;

// 접속(워크스페이스) 언어 — 메시지 SSOT.
oAPP.attr.GLANGU = WSUTIL.getWsSettingsInfo().globalLanguage;

// 셸 상태(부트 1회성).
var bBusy = false, oToastTimer = null, iBusyWatch = null, bOpenDone = false,
    bBooted = false, oBroad = null;

/* ── 로컬 헬퍼 ──────────────────────────────────────────────────────────── */

// /U4A/CL_WS_COMMON · /U4A/MSG_WS 등 메시지 클래스 텍스트.
function _msg(sCls, sCode, p1, p2, p3, p4) {
    try { return WSMSG.fnGetMsgClsText(sCls, sCode, p1 || "", p2 || "", p3 || "", p4 || ""); }
    catch (e) { return ""; }
}
// ZMSG_WS_COMMON_001 (Workspace 다국어 — 원본 bindPopup 은 이 클래스로 전 문구를 냄).
function _zmsg(sNo, p1) {
    try { return WSUTIL.getWsMsgClsTxt(oAPP.attr.GLANGU || LANGU, "ZMSG_WS_COMMON_001", sNo, p1 || "") || ""; }
    catch (e) { return ""; }
}
oAPP.common.msg = _msg;
oAPP.common.zmsg = _zmsg;

/****************************************************************************
 * [.analy/17] 서버 오류 텍스트 → 클라이언트 메시지 클래스 DB 로 역현지화.
 *   서버(ABAP)는 메시지를 "서버 로그온 언어"로 이미 렌더한 텍스트만 내려준다(서버 수정 불가).
 *   → 받은 텍스트로 로컬 MESSAGE_CLASS.db 에서 키를 역추적한 뒤 클라 언어로 다시 렌더한다.
 *   ★ 공통 단일출처 WsMsgCls.relocalize(electron/lib/msg/WsMsgClsService.js) 위임 — 자체 구현 금지.
 *   ★ 못 찾으면 원문 그대로(graceful) — 표시는 되고 재렌더만 안 됨.
 ****************************************************************************/
oAPP.common.relocalizeServerMsg = function (sText) {
    var sRaw = String(sText || "");
    if (!sRaw) { return sRaw; }
    try {
        var WC = REMOTE.getGlobal("WsMsgCls");
        if (!WC || typeof WC.relocalize !== "function") { return sRaw; }
        // beLangu=null → 공통이 EN/KO 후보로 역추적. wsLangu = 화면(Workspace) 언어.
        // ★ wsLangu 는 반드시 접속(Workspace) 언어 LANGU(=USERINFO.LANGU) — .analy/17 §6, 타 화면(MIME frame.js:278·ShortCut:307)과 동일.
        //   GLANGU(getWsSettingsInfo().globalLanguage)는 글로벌/시스템 언어라 접속언어와 다를 수 있다(실측 2026-08-10: 접속 KO 인데 GLANGU="EN"
        //   → relocalize 가 서버 EN 문구를 "이미 EN"으로 보고 건너뛰어 037 이 영문으로 노출). → LANGU 를 우선한다.
        return WC.relocalize(sRaw, null, LANGU || oAPP.attr.GLANGU || "") || sRaw;
    } catch (e) { return sRaw; }
};

// WLO(등록 기능) 여부 — 원본 index.js:1045 oAPP.common.checkWLOList 1:1.
//   데이터 원천 = oAPP.attr.oUserInfo.META.T_REG_WLO(부트 수신, bindData.js 도 동일 참조).
oAPP.common.checkWLOList = function (REGTYP, CHGOBJ) {
    var aReg = (oAPP.attr.oUserInfo && oAPP.attr.oUserInfo.META && oAPP.attr.oUserInfo.META.T_REG_WLO) || [];
    return aReg.some(function (item) { return item.REGTYP === REGTYP && item.CHGOBJ === CHGOBJ; });
};

/****************************************************************************
 * [P6] 도움말(198) — 원본 index.js oAPP.fn.onHelp 1:1.
 *   v3.6.0_00004+ 부터 도움말 HTML 을 U4A HELP DOCUMENT 로 통합 → WLO(C/UHAK901369) 등록 시
 *   WS20 디자인 영역에 팝업 호출을 방송 요청(startMenuId)하고 종료한다.
 *   ★ 영역별 도움말 문서 ID(원본): 모델필드 "000276"(index.js:4872) · 디자인트리 "000275"(designTree.js:2696)
 *     · 추가속성 "000274"(bindAdditInfo.js:348) · 레이아웃 커스터마이징 "000281"(index.js:3121)
 *     · 동기화 "000277"(synchronizionBind.js:796). 호출부가 자기 영역 ID 를 넘긴다(미지정=모델필드 276 하위호환).
 *   ★ busy 는 켠 채로 둔다(원본 동일) — WS20 이 도움말을 띄우고 BUSY_OFF 를 되돌려줘야 풀린다.
 *   ★ WLO 미등록(구버전) 경로 = utils/callTooltipsPopup.js(로컬 도움말 HTML). 별창 + CJS(module.exports)
 *     제약으로 미이식 — 해당 시스템에선 도움말이 뜨지 않는다(P6 잔여, 보고 대상).
 ****************************************************************************/
oAPP.fn.onHelp = function (sStartMenuId) {
    var _sMenuId = sStartMenuId || "000276";   // 미지정 = 모델필드 문서(하위호환).
    if (oAPP.common.checkWLOList("C", "UHAK901369") === true) {
        oAPP.fn.setBusy(true, { ISBROAD: true });
        if (typeof oAPP.fn.sendHelpDocOpen === "function") {
            oAPP.fn.sendHelpDocOpen({ opstion: { startMenuId: _sMenuId } });
        } else {
            console.error("[HTML5][bindWindow] onHelp: sendHelpDocOpen 없음 — 방송 미배선");
            oAPP.fn.setBusy(false);
        }
        return;
    }
    console.warn("[HTML5][bindWindow] onHelp: WLO(UHAK901369) 미등록 — 구버전 tooltip 팝업 경로 미이식(P6 잔여)");
};

/****************************************************************************
 * [S1a §5.1-6] 동일속성 바인딩 화면 진입/복귀 잠금 3종.
 *   원본은 UI5 모델플래그(edit/edit_refresh/edit_layout_customizing/edit_additbind)를 컨트롤
 *   enabled 에 자동바인딩했다. HTML5-live 는 각 버튼 DOM(data-bwp-lock)의 .disabled 로 직접 토글.
 *   ★ live 잠금 대상은 렌더 시 정적 editable 로 굳으므로 플래그만 뒤집으면 안 바뀐다("코드 존재≠동작")
 *     → 반드시 DOM 을 직접 토글한다.
 *   대상(data-bwp-lock):
 *     · "edit"        = 중앙하단 추가속성 적용(139)      … 원본 index.js:4296 {/edit}
 *     · "refresh"     = 좌측 모델트리 갱신(171)          … 원본 index.js:4044 {/edit_refresh}
 *     · "layout-main" = 좌측/메인 커스터마이징 기어(957) … 원본 index.js:3070 {/edit_layout_customizing}
 *     · "additbind"   = 우측 추가속성 바인딩(098)        … 원본 bindAdditInfo.js setAdditBindButtonEnable
 *     · "layout-addit"= 우측 커스터마이징 기어(957)      … 원본 bindAdditInfo.js setLayoutCustomizingEditable
 *   ★ 좌측 드래그는 대상 아님(원본 DragInfo enabled=생성 시 상수, index.js:4364).
 ****************************************************************************/
function _bwpToggleLock(sKind, bEnable) {
    try {
        var aEl = document.querySelectorAll('[data-bwp-lock="' + sKind + '"]');
        for (var i = 0; i < aEl.length; i++) { aEl[i].disabled = !bEnable; }
    } catch (e) { console.error("[HTML5][bindWindow] _bwpToggleLock(" + sKind + "):", e && e.message); }
}

// 메인 화면 잠금/해제 — 원본 index.js:8015 setViewEditable(bLock). bLock=true 활성 / false 잠금.
//   edit(중앙하단 적용) + edit_refresh(좌측 갱신) + edit_layout_customizing(좌측 기어). ★드래그 제외.
oAPP.fn.setViewEditable = function (bLock) {
    if (oAPP.attr.editable !== true) { return; }   // 원본 IS_EDIT==="" → exit(조회모드는 이미 잠김).
    _bwpToggleLock("edit", bLock);
    _bwpToggleLock("refresh", bLock);
    _bwpToggleLock("layout-main", bLock);
};

// 우측 추가속성 바인딩 버튼 활성/비활성 — 원본 bindAdditInfo.js setAdditBindButtonEnable.
//   ★ 조회모드(IS_EDIT!=="X")면 원본처럼 무조건 비활성(원본 _setAdditBindButtonEnable 112~115).
oAPP.fn.setAdditBindButtonEnable = function (bEnable) {
    if (oAPP.attr.editable !== true) { _bwpToggleLock("additbind", false); return; }
    _bwpToggleLock("additbind", bEnable);
};

// 우측 커스터마이징 기어 활성/비활성 — 원본 bindAdditInfo.js setLayoutCustomizingEditable.
oAPP.fn.setLayoutCustomizingEditable = function (bEnable) {
    _bwpToggleLock("layout-addit", bEnable);
};

// SYSID 별 테마 JSON(theme_ws4) — 라이브 테마 변경 추종용.
function _getThemeInfo() {
    try {
        var sPath = PATH.join(USERDATA, "p13n", "theme_ws4", SYSID + ".json");
        if (!FS.existsSync(sPath)) { return null; }
        return JSON.parse(FS.readFileSync(sPath, "utf-8"));
    } catch (e) { return null; }
}

// busy(로딩 오버레이 + 닫기 차단 + 공용 자식창 브로드캐스트). runtimeClassNav/docPopup 규약.
//   oOpt.ISBROAD=true → 브로드캐스트 재전송 안 함(수신으로 인한 busy).
function _setBusy(bOn, oOpt) {
    bBusy = !!bOn;
    var oEl = document.getElementById("bwpBusy");
    if (oEl) { oEl.setAttribute("data-busy", bBusy ? "true" : "false"); }
    // ★ closable 은 항상 false 유지(Alt+F4/OS X 차단). 닫기는 닫기버튼(공통 closeWindow)으로만.
    try { CURRWIN.closable = false; } catch (e) { }
    // ★ 원본 setBusy(index.js:3473/3488) = lf_setCurrentWindowClosable(!bBusy) — 닫기(X)버튼도 busy 와 대칭 토글.
    //   ★★ busy off 는 setBusyWS20Interaction 뿐 아니라 setBusy(false)(왕복 해제부 bindBroadcast:126 등)로도 온다.
    //   여기서 복원을 안 하면, 진입 때 setBusyWS20Interaction(true)로 건 disabled=true 가 성공-왕복(setBusy(false)) 후
    //   잔류해 X 가 영구 사망한다(2026-08-09 감사: 해제/멀티/일괄적용/추가속성 성공경로 6건 결함). SSOT 를 여기로 일원화.
    try {
        var oBtnClose = document.querySelector(".u4a-winbtn--close");
        if (oBtnClose) { oBtnClose.disabled = bBusy; }
    } catch (e) { }
    if (oBroad && !(oOpt && oOpt.ISBROAD)) {
        try { oBroad.postMessage({ PRCCD: bBusy ? "BUSY_ON" : "BUSY_OFF" }); } catch (e) { }
    }
}
oAPP.fn.setBusy = function (bIsShow, oOpt) {
    // 원본 setBusy(bBusy, {ISBROAD}) 계약 — 'X'/true 켜기, ''/false 끄기.
    _setBusy(bIsShow === true || bIsShow === "X", oOpt);
};

/****************************************************************************
 * [P6] WS20 상호작용 busy — 원본 index.js oAPP.fn.setBusyWS20Interaction(bBusy, sOption) 1:1.
 *   원본 구성: oAPP.oMain.attr.isBusy 광역화 + sap.ui.getCore().lock/unlock + lf_setAppBusy +
 *              lf_setCurrentWindowClosable + (sOption 있을 때) lf_postBusyToChild(BUSY_ON/OFF).
 *   HTML5 매핑:
 *     · lock/unlock(UI5 전용) → busy 오버레이(.u4a-busy)가 포인터 차단으로 대체.
 *     · lf_setAppBusy       → _setBusy(로딩 오버레이).
 *     · lf_postBusyToChild  → oBroad(자식창 채널). ★ WS20 이 아니라 "자식 팝업"용이다(SPEC §8) —
 *                             WS20 반영은 UPDATE-DESIGN-DATA(bindBroadcast) 가 담당하는 별개 경로.
 *     · sOption(TITLE/DESC) → 원본처럼 TYPE:"DIALOG" 로 실어 보내고, _setBusy 의 기본 방송은
 *                             ISBROAD 로 억제해 중복 송신을 막는다.
 *   ★ 미정의 상태로 utils/callTooltipsPopup.js 가 호출해 크래시하던 것을 복원(P6).
 ****************************************************************************/
oAPP.fn.setBusyWS20Interaction = function (bBusy, sOption) {
    var bOn = (bBusy === true || bBusy === "X");
    oAPP.attr.isBusyWS20 = bOn;   // 원본 oAPP.oMain.attr.isBusy 광역화 대응.

    if (typeof sOption !== "undefined" && sOption !== null && oBroad) {
        try {
            oBroad.postMessage(bOn
                ? { PRCCD: "BUSY_ON", TITLE: sOption.TITLE || "", DESC: sOption.DESC || "", TYPE: "DIALOG" }
                : { PRCCD: "BUSY_OFF" });
        } catch (e) { console.error("[HTML5][bindWindow] setBusyWS20Interaction 방송:", e && e.message); }
        _setBusy(bOn, { ISBROAD: true });   // 위에서 이미 보냈으므로 재방송 억제.
    } else {
        // 원본 index.js:3550 — sOption 없으면 WS20 에 방송하지 않는다(로컬 busy/닫기버튼만 처리).
        //   기존 _setBusy(bOn)[방송] 은 진입완료 시 WS20 busy 를 조기 해제해 원본과 어긋났다.
        //   → ISBROAD 로 방송 억제. 이제 setBusyWS20Interaction(false)[sOption 없음] = 닫기버튼 복원 + 로컬 off + WS20 유지.
        _setBusy(bOn, { ISBROAD: true });
    }

    // ★ 닫기(X)버튼 토글은 _setBusy 로 일원화(위 두 분기 모두 _setBusy 경유) — 원본 lf_setCurrentWindowClosable.
    //   여기서 따로 토글하지 않는다(중복 제거). busy off 가 setBusy(false) 로 오는 경로도 _setBusy 가 복원한다.
};

// 로드 완료 — 메인 busy lock 해제 + 공용 BUSY_OFF + 본문 표시(1회만).
function _finishOpen() {
    if (bOpenDone) { return; }
    bOpenDone = true;
    try { clearTimeout(iBusyWatch); } catch (e) { }
    try { IPCRENDERER.send("if-send-action-" + BROWSKEY, { ACTCD: "SETBUSYLOCK", ISBUSY: "" }); } catch (e) { }
    // ★ 초기 모델트리 로드가 진행 중이면 busy 를 끄지 않는다 — loadBindData 가 비동기 ajax 를 던진 직후
    //   부트가 여기로 오므로, 여기서 끄면 로드~렌더 구간이 무오버레이가 된다(장군님 지적 2026-08-03 "대량 로드 시 busy 안 뜸").
    //   로드의 finally(modelFieldArea loadBindData)가 렌더 완료 후 busy 를 끈다. 원본 UIUpdated 가 로드~렌더를 감싼 것과 동일.
    if (!(oAPP.attr && oAPP.attr.isBindLoading)) { _setBusy(false); }
    var oShell = document.getElementById("bwpShell");
    if (oShell) { oShell.classList.add("u4aBwpShown"); }
}

// 공통 .u4a-toast(화면 정중앙) — 싱글톤 div + data-show + 3초.
//   ★ top-layer(16 §2.10): showModal() 모달이 열려 있으면 토스트를 그 <dialog>(top layer) 안으로
//     옮겨 붙인다. body 에 두면 모달 top-layer 뒤로 가려져 안 보인다(툴팁/컬럼메뉴와 동일 처리).
function _toast(sText) {
    if (!sText) { return; }
    var oEl = document.getElementById("u4aBwpToast");
    if (!oEl) {
        oEl = document.createElement("div");
        oEl.id = "u4aBwpToast";
        oEl.className = "u4a-toast";
        oEl.setAttribute("role", "alert");
    }
    // 열린 모달 <dialog> 있으면 그 안(top layer), 없으면 body — 매 표시마다 재배치.
    var oHost = document.querySelector("dialog[open]") || document.body;
    if (oEl.parentNode !== oHost) { oHost.appendChild(oEl); }
    oEl.textContent = sText;
    oEl.dataset.show = "true";
    try { clearTimeout(oToastTimer); } catch (e) { }
    oToastTimer = setTimeout(function () { oEl.dataset.show = "false"; }, 3000);
}
oAPP.fn.toast = _toast;

/* ── 타이틀바/닫기 ──────────────────────────────────────────────────────── */
function _initChrome() {
    var oLogo = document.getElementById("bwpLogo");
    if (oLogo) {
        try { oLogo.src = encodeURI("file:///" + PATH.join(APPPATH, "img", "logo.png").replaceAll("\\", "/")); } catch (e) { }
    }

    var oTitle = document.getElementById("bwpTitle");
    if (oTitle) {
        var s = "";
        try { s = document.title || CURRWIN.getTitle() || ""; } catch (e) { s = document.title || ""; }
        if (!s) { s = _msg("/U4A/CL_WS_COMMON", "A15"); } // Binding Popup
        oTitle.textContent = s;
    }

    var oClose = document.querySelector('#bwpTitlebar [data-action="close"]');
    if (oClose) {
        oClose.addEventListener("click", function () {
            if (bBusy) { return; }
            if (window.U4AUI && U4AUI.closeWindow) { U4AUI.closeWindow(CURRWIN); }
            else { try { CURRWIN.setClosable(true); CURRWIN.close(); } catch (e) { } }
        });
    }
}

// 라이브 테마 변경(원본 _onIpcMain_if_p13n_themeChange). 개인화 없음 → 워크스페이스 테마 추종.
function _onThemeChange() {
    var oTheme = _getThemeInfo();
    if (!oTheme || !oTheme.THEME) { return; }
    try {
        if (oTheme.BGCOL) {
            CURRWIN.webContents.insertCSS("html,body{margin:0;height:100%;background-color:" + oTheme.BGCOL + ";}");
            BGCOL = oTheme.BGCOL;
            document.documentElement.style.setProperty("--boot-bg", oTheme.BGCOL);
        }
    } catch (e) { }
    try { if (window.U4ATheme) { U4ATheme.apply(oTheme.THEME); } } catch (e) { }
    oAPP.attr.oThemeInfo = oTheme;
}

/* ── 스플리터(공통 U4AUI.wireSplitter 소비) ────────────────────────────────
 *   원본 sap.ui.layout.Splitter 대응. 좌|중|우 가로 3분할(axis:x) + 중앙 세로 2분할(axis:y).
 *   드래그 리사이즈·창 리사이즈 재클램프·더블클릭 최초복귀·iframe 차단은 전부 공통이 담당(16 §4.3/§4.4).
 *   바=.u4a-splitter__bar / 패널=그 외 자식(유연=.u4a-splitter__pane--flex 또는 flex-grow>0). 최소=CSS min-*.
 * ------------------------------------------------------------------------ */
function _wireSplitters() {
    var oShell = document.getElementById("bwpShell");
    var oCenter = document.getElementById("bwpCenterPane");
    if (!oShell || !window.U4AUI || typeof U4AUI.wireSplitter !== "function") { return; }
    U4AUI.wireSplitter(oShell, { axis: "x" });                 // 좌|중|우
    if (oCenter) { U4AUI.wireSplitter(oCenter, { axis: "y" }); } // 디자인|추가속성적용
}

/* ── 공용 busy 브로드캐스트(형제 자식창) ──────────────────────────────────
 *   `broadcast-to-child-window_${browserkey}` — 원본 oMain.broadToChild. WS20 동기화 주채널
 *   (`${browserkey}_ws20_bindpop`)은 데이터/선택 동기화라 통신 단계(Stage6)에서 배선한다.
 * ------------------------------------------------------------------------ */
function _initBroadcast() {
    try {
        oBroad = new BroadcastChannel("broadcast-to-child-window_" + BROWSKEY);
        oBroad.onmessage = function (oEvent) {
            var sPrc = oEvent && oEvent.data && oEvent.data.PRCCD;
            if (sPrc === "BUSY_ON") { _setBusy(true, { ISBROAD: true }); }
            else if (sPrc === "BUSY_OFF") { _setBusy(false, { ISBROAD: true }); }
        };
        oAPP.attr.oMainBroad = oBroad;
    } catch (e) { }
}

/* ── 부트: if_modelBindingPopup 수신 → 데이터 저장 → 앱 기동 ──────────────── */
function _onModelBindingPopup(events, oInfo) {
    if (bBooted) { return; }
    if (!oInfo) { return; }
    bBooted = true;

    // 원본 frame.js if_modelBindingPopup 1:1 — oAPP.attr 에 저장.
    oAPP.attr.oUserInfo = oInfo.oUserInfo;
    oAPP.attr.oThemeInfo = oInfo.oThemeInfo;
    oAPP.attr.T_9011 = oInfo.T_9011 || [];
    oAPP.attr.T_0022 = oInfo.T_0022 || [];
    oAPP.attr.T_0023 = oInfo.T_0023 || [];
    oAPP.attr.T_0014 = oInfo.T_0014 || [];
    oAPP.attr.T_0015 = oInfo.T_0015 || [];
    oAPP.attr.T_CEVT = oInfo.T_CEVT || [];
    oAPP.attr.oAppInfo = oInfo.oAppInfo || {};
    // 편집 가능여부(IS_EDIT="X") — 영역 툴바(바인딩 버튼 enabled="{/edit}")가 초기화 시점에 참조하므로
    //   비동기 loadBindData 이전에 부트에서 확정한다(원본 oAPP.attr.oAppInfo.IS_EDIT).
    oAPP.attr.editable = (oAPP.attr.oAppInfo.IS_EDIT === "X");
    oAPP.attr.servNm = oInfo.servNm || "";
    oAPP.attr.DnDRandKey = oInfo.SSID;
    oAPP.attr.SSID = oInfo.SSID;
    oAPP.attr.channelKey = oInfo.channelKey;
    oAPP.attr.browserkey = BROWSKEY;

    _bootApp();
}

// 앱 기동 — 영역 모듈 초기화(있으면) → 창 표시 → busy 해제.
//   Stage2~ 에서 oAPP.fn.initModelArea / initDesignArea / initAdditArea / loadBindData 등을 채운다.
function _bootApp() {
    try {
        // [Stage2+] 각 영역 렌더러(정의된 것만 호출 — 미구현 단계에선 skip).
        if (typeof oAPP.fn.initModelArea === "function") { oAPP.fn.initModelArea(); }
        if (typeof oAPP.fn.initDesignArea === "function") { oAPP.fn.initDesignArea(); }
        if (typeof oAPP.fn.initAdditArea === "function") { oAPP.fn.initAdditArea(); }
        // 화면 커스터마이징 — 저장된 영역 표시상태 로드+적용(원본 BIND_LAYOUT). 영역 렌더 뒤 1회.
        if (typeof oAPP.fn.initBindLayout === "function") { oAPP.fn.initBindLayout(); }
        // [Stage6] WS20 동기화 주채널 생성 + 초기 데이터 로드.
        if (typeof oAPP.fn.createBindChannel === "function") { oAPP.fn.createBindChannel(); }
        if (typeof oAPP.fn.loadBindData === "function") { oAPP.fn.loadBindData(); }
    } catch (e) {
        console.error("[HTML5][bindWindow] 앱 기동 오류:", e && e.message);
        // 기동 중 예외로 loadBindData 콜백 finally 가 안 돌 수 있음 → 로드 표식 해제해 아래 _finishOpen 이 busy 를 끄게(무한 busy 방지).
        try { oAPP.attr.isBindLoading = false; } catch (x) { }
    }
    _finishOpen();
}

function _keepSession() {
    try { IPCRENDERER.send("if-session-time", SESSKEY); } catch (e) { }
}

// 디자인영역 드래그 종료 IPC(원본 if-dragEnd 대응) — 드롭 강조 해제.
function _onDialogDragEnd() {
    try { if (document.activeElement && document.activeElement.blur) { document.activeElement.blur(); } } catch (x) { }
    try { if (typeof oAPP.fn.onDesignDragEnd === "function") { oAPP.fn.onDesignDragEnd(); } } catch (e) { }
}

/* ── 부트 진입 ──────────────────────────────────────────────────────────── */
window.addEventListener("load", function () {

    try { CURRWIN.setMenu(null); } catch (e) { }

    _setBusy(true);

    _initChrome();
    _initBroadcast();
    _wireSplitters();

    // 초기 데이터 IPC — opener did-finish-load 가 send.
    IPCRENDERER.on("if_modelBindingPopup", _onModelBindingPopup);
    // 디자인영역 드래그 종료 / 라이브 테마 변경.
    IPCMAIN.on("if-Dialog-dragEnd", _onDialogDragEnd);
    IPCMAIN.on("if-p13n-themeChange-" + SYSID, _onThemeChange);

    window.addEventListener("click", _keepSession);
    window.addEventListener("keyup", _keepSession);
    _keepSession();

    // frameless — 위치 확정 후 표시(흰 번쩍 방지). opener show:false.
    try { CURRWIN.show(); } catch (e) { }

    // 안전판 — if_modelBindingPopup 이 안 오면 busy 강제 해제(방어).
    iBusyWatch = setTimeout(function () {
        console.error("[HTML5][bindWindow] 초기 데이터(if_modelBindingPopup) 수신 지연 — busy 강제 해제");
        _finishOpen();
    }, 20000);
});

// busy 중 창 닫기 차단(원본 onbeforeunload). 정상 종료 시 리스너/IPC 해제.
window.onbeforeunload = function () {
    if (bBusy) { return false; }
    try { window.removeEventListener("click", _keepSession); } catch (e) { }
    try { window.removeEventListener("keyup", _keepSession); } catch (e) { }
    try { IPCRENDERER.removeListener("if_modelBindingPopup", _onModelBindingPopup); } catch (e) { }
    try { IPCMAIN.removeListener("if-Dialog-dragEnd", _onDialogDragEnd); } catch (e) { }
    try { IPCMAIN.removeListener("if-p13n-themeChange-" + SYSID, _onThemeChange); } catch (e) { }
    try { if (typeof oAPP.fn.onWindowClose === "function") { oAPP.fn.onWindowClose(); } } catch (e) { }
    try { if (oBroad) { oBroad.close(); } } catch (e) { }
};

// 영역 모듈이 접근할 수 있도록 전역 노출(원본 window.oAPP 계약).
window.oAPP = oAPP;
