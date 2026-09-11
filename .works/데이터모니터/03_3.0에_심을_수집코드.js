/************************************************************************
 * 3.0 에 심을 「내부 데이터 수집 + 4.0 으로 보내기」 — 한 덩이
 * ----------------------------------------------------------------------
 *  만든 시각 : 2026-09-11 16:02
 *  만든 방법 : 4.0 의 수집 코드(www/ws30/ws10_20/js/ws_html5_datamon.js)를
 *              ★글자 하나 안 고치고 그대로★ 앞에 두고, 보내는 부분만 뒤에 붙였다.
 *              수집 규칙이 조금이라도 다르면 두 프로그램을 비교하는 뜻이 없어진다.
 *
 *  어디에 심나 : 3.0 의 WS10/WS20 화면(그 자리에 oAPP 와 jQuery 가 있다).
 *      ① 그 화면 개발자 도구 Console 에 이 파일 내용을 통째로 붙여 넣거나
 *      ② 3.0 의 파일 로드 목록 맨 뒤에 이 파일을 얹는다.
 *
 *  심고 나면 : 화면 오른쪽 아래에 「3.0 → 4.0 보내기」 단추가 생긴다.
 *      4.0 의 데이터 모니터 창을 먼저 열어 두어야 받는 자리가 열려 있다.
 *
 *  ★ 감시는 켜지 않는다. **부르는 그 순간**의 데이터 구조를 떠서 보낸다.
 *      단추를 누르거나, 콘솔에서 DM30.send() 를 부르면 된다. 바깥에 여는 것은 이 하나뿐이다.
 *
 *  보내는 것 : 감시 대상 데이터 구조 한 벌 전체(oAPP.datamon.snapshot()).
 *
 *  오류코드 접두: DM30 / 다음 번호: 007
 ************************************************************************/


/* ======================================================================
 * [1] 수집 코드 — 4.0 원본 그대로 (아래 한 줄도 고치지 말 것)
 * ====================================================================== */

/************************************************************************
 * ws_html5_datamon.js
 * ----------------------------------------------------------------------
 * 내부 데이터 모니터 — 감시 알맹이 (1단계)
 *
 * 무엇을 하나:
 *   화면에서 무언가를 조작하면, 정해 둔 내부 오브젝트를 다시 떠서
 *   직전에 떠 둔 것과 한 칸씩 비교해 "달라진 자리"만 뽑아 알려준다.
 *
 * 왜 이렇게 하나 (계획서 .works/데이터모니터/00_계획서.md §2.2):
 *   - 감시 껍데기(Proxy)를 씌우면 앱이 보는 물건이 바뀐다. 이 앱은 APP 정보 세 곳이
 *     같은 물건을 가리켜야 정상이고, 그 자리를 통째로 새 것으로 갈아끼우는 곳도
 *     여러 군데라 감시가 끊긴다.
 *   - 속성 하나에 감시문을 다는 방법은 배열에 줄이 새로 들어오는 걸 못 잡는다.
 *   - 그래서 "사진 두 장 비교". 앱 코드는 한 줄도 안 고친다.
 *
 * 실측 (2026-09-09, WS20 앱 1건 연 상태):
 *   공통코드·라이브러리 원장 뺀 기본 범위 = 사진 48만자 / 한 번 왕복 8.4ms.
 *
 * 오류코드 접두: DMON / 다음 번호: 013
 ************************************************************************/

(function (window, $, oAPP) {
    "use strict";

    /* ────────────────────────────────────────────────────────────────
     *  설정값
     * ──────────────────────────────────────────────────────────────── */

    //훑어 들어갈 최대 깊이. 넘으면 더 안 들어간다(끝없이 도는 것 방지).
    var C_MAX_DEPTH = 12;

    //한 번에 뽑을 "달라진 자리" 최대 건수. 넘으면 자르고 잘렸다고 알린다.
    var C_MAX_DIFF = 500;

    //조작이 들어온 뒤 이만큼 기다렸다 1차 비교. 앱이 값을 다 넣을 시간을 준다.
    var C_WAIT_1ST = 200;

    //1차 비교 뒤 이만큼 더 기다렸다 2차 비교. 뒤늦게 따라오는 변경(미리보기 다시 그리기 등)을 잡는다.
    var C_WAIT_2ND = 800;

    //조작으로 볼 것.
    //  ★ 2026-09-10 전면 확대(장군님 지시). 전에는 change/click/keyup/drop 네 가지뿐이라
    //    **WS20 속성 영역 dropdown 에서 값을 골라도 비교가 예약되지 않았다** —
    //    공통 dropdown 은 목록 항목의 mousedown 에서 값을 확정하고 그 자리에서 목록을 없앤다.
    //    그래서 click 이 그 항목에서 안 뜬다. mousedown 을 안 듣고 있어 통째로 놓쳤다.
    //  UI5 가 거는 것과 같은 폭으로 넓히고, 우리에게 필요한 것(change · compositionend)을 더한다.
    //  ※ 값이 안 바뀌는 hover·drag 도중 event 도 그대로 건다. 비교는 마지막 event 로부터
    //    200ms 뒤에만 도므로 그 사이엔 예약이 미뤄질 뿐 여러 번 돌지 않는다(끌어 놓기 도중 비교 안 함 = 의도한 것).
    var C_EVENTS = [
        //누르기
        "click", "dblclick", "contextmenu", "auxclick",
        "mousedown", "mouseup", "mouseover", "mouseout",
        //글쇠
        "keydown", "keypress", "keyup",
        //값 입력 — compositionend 는 한글처럼 조합해서 넣는 글자의 마무리
        "input", "change", "compositionend",
        //자리 옮김
        "focusin", "focusout",
        //고르기
        "select", "selectstart",
        //끌어 놓기
        "dragstart", "dragenter", "dragover", "dragleave", "dragend", "drop",
        //잘라내기·붙여넣기
        "cut", "paste",
        //손가락
        "touchstart", "touchend", "touchmove", "touchcancel"
    ];

    //덩치가 커서 기본으로 빼는 것. 서버에서 받아 앱 여는 동안 안 바뀐다.
    //  (공통코드 133만자 · 라이브러리 원장 919만자 — 2026-09-09 실측)
    var C_SKIP_ATTR = ["S_CODE"];
    var C_SKIP_DATA = ["LIB"];

    //화면 부품(UI5 컨트롤) 안에서 볼 칸 = 우리가 만든 것만 (장군님 지시 2026-09-10).
    //  나머지 밑줄 칸은 UI5 가 자기용으로 쓰는 것이라(앱 소스에 한 번도 안 나옴)
    //  화면을 다시 그릴 때마다 값이 바뀌어 누를 때마다 쓸데없는 줄이 쏟아진다.
    //  실측 2026-09-10 = 부품 하나당 밑줄 칸 16~33개 중 우리 것은 5~6개.
    //  ★ 같은 부품이 oAPP.attr.prev 와 oAPP.attr.ui 두 군데에 들어 있어 잡음이 두 배가 된다.
    //    우리 칸은 그대로 두므로 두 군데가 같이 바뀌는 것은 계속 보인다(그게 맞는 동작 — 장군님 확인).
    var C_UI_KEEP = ["_T_0015", "_MODEL", "_BIND_AGGR", "_OBJID", "__PARENT", "_EMBED_AGGR", "__UIFND"];

    //어디에 있든 아예 안 담는 칸 이름(장군님 지시 2026-09-11).
    //  APPID · GUINR 은 앱마다·열 때마다 값이 달라 두 프로그램을 견주면 늘 "다름"으로 나온다.
    //  그것 때문에 진짜 어긋난 자리가 묻히므로 수집에서 뺀다. **깊이와 상관없이** 이 이름이면 안 담는다.
    var C_SKIP_KEYS = ["APPID", "GUINR"];

    //모델이 놓이는 칸 이름. 이 칸 안에서는 **oData 만** 담는다(장군님 지시 2026-09-11).
    //
    //  왜 필요한가 — 같은 이름인데 두 앱에서 담긴 물건이 다르다(2026-09-11 소스 확인):
    //    3.0 : oAPP.attr.oModel = new sap.ui.model.json.JSONModel()   (UI5 모델)
    //    4.0 : oAPP.attr.oModel = _createModel()                      (우리가 만든 보통 객체)
    //  UI5 모델은 자기 안에 바인딩 목록·이벤트 등록표·문맥까지 들고 있고, 그것들이 다시 화면
    //  부품을 가리킨다. 그래서 3.0 에서만 UI 인스턴스 속이 통째로 딸려 나왔다.
    //  두 앱에서 **같은 기준으로 담아야** 비교가 뜻이 있으므로 oData 한 칸으로 맞춘다.
    //  ※ 4.0 쪽은 나머지 칸이 전부 함수라 원래도 안 담겼다 — 담기는 내용이 바뀌지 않는다.
    var C_MODEL_KEYS = ["oModel", "_MODEL"];


    /* ────────────────────────────────────────────────────────────────
     *  상태
     * ──────────────────────────────────────────────────────────────── */

    var _bOn = false;            //감시 켜져 있나
    var _oBase = null;           //직전 사진
    var _fnOnChange = null;      //달라진 것 알릴 곳
    var _iTimer1 = 0;            //1차 비교 예약 손잡이
    var _iTimer2 = 0;            //2차 비교 예약 손잡이
    var _oLastAct = null;        //마지막 조작 정보(무엇을 눌렀나)
    var _iSeq = 0;               //묶음 번호
    var _oInclude = { sCode: false, lib: false };   //덩치 큰 것 포함 여부

    //모델 칸의 oData 를 담기 직전에 손볼 수 있게 바깥에 열어 둔 자리(기본 = 없음).
    //  ★ 아무도 안 걸면 아무 일도 안 한다 — 4.0 은 안 건다.
    //  3.0 은 앱 모델과 UI5 Core 모델 두 군데에 나뉘어 있어, 3.0 쪽에서만 이 자리에
    //  "둘을 합쳐서 돌려주는 것"을 걸어 4.0 과 같은 모양으로 맞춘다(장군님 지시 2026-09-11).
    var _fnModelData = null;


    /* ────────────────────────────────────────────────────────────────
     *  사진 뜨기 / 비교
     * ──────────────────────────────────────────────────────────────── */

    /**
     * 오브젝트를 통째로 베껴 새 오브젝트로 만든다.
     *   · 함수는 버린다(데이터가 아님)
     *   · 화면 요소·창을 가리키는 값은 안 담는다(그 안이 끝없이 깊다)
     *   · 이미 지나온 것은 표시만 남긴다(서로를 가리켜 빙빙 도는 것 방지)
     *   · ★ Object.keys 로 "자기 것만" 담는다. for...in 으로 물려받은 것까지 담으면
     *     변경 원장이 17,731칸 → 83,732칸으로 5배 부푼다(2026-09-09 실측).
     */
    function _snap(v, iDepth, aChain, sKey) {

        if (v === null || typeof v !== "object") { return v; }
        if (typeof v === "function") { return undefined; }
        if (iDepth > C_MAX_DEPTH) { return "[max depth]"; }

        //★ circular = 자기 윗길에 자기가 또 나온 것만 끊는다(장군님 지시 2026-09-10).
        //  전에는 "이번 snapshot 에서 한 번이라도 지나온 것"을 전부 끊어서,
        //  같은 물건이 다른 path 에도 놓여 있으면(oAPP.attr.oServerInfo = oAPP.attr.metadata.SERVERINFO)
        //  나중 것이 통째로 가려졌다 → 두 자리가 같이 바뀌는지 확인할 수가 없었다.
        if (aChain.indexOf(v) !== -1) { return "[circular]"; }

        if (v.nodeType || v.window === v) { return "[DOM]"; }

        //★ 모델 칸은 oData 만 담는다(장군님 지시 2026-09-11, 위 C_MODEL_KEYS 주석 참고).
        if (sKey && C_MODEL_KEYS.indexOf(sKey) !== -1) {
            aChain.push(v);
            var vModel = _snapModelData(v, iDepth, aChain, sKey);
            aChain.pop();
            return vModel;
        }

        aChain.push(v);

        var vOut;

        //화면 부품(UI5 컨트롤)이면 우리가 만든 칸만 담는다(장군님 지시 2026-09-10).
        //  같은 부품이 prev 와 ui 두 군데에 들어 있어, 걸러내지 않으면 UI5 가 쓰는 칸까지
        //  양쪽에서 두 번씩 쏟아진다. 우리 칸은 그대로 두므로 두 군데가 같이 바뀌는 것은 계속 보인다.
        if (_isUiPart(v)) {

            vOut = _snapUiPart(v, iDepth, aChain);

        } else {

            vOut = Array.isArray(v) ? [] : {};
            var aKeys = Object.keys(v);

            for (var i = 0; i < aKeys.length; i++) {
                try {
                    var vChild = v[aKeys[i]];

                    //★ 함수는 칸 자체를 안 만든다(장군님 지시 2026-09-10).
                    //  예전엔 값만 비우고 칸은 남겨서, 함수가 새로 생기거나 없어지면
                    //  "생김/없어짐" 줄이 떴다. 함수는 데이터가 아니므로 아예 안 담는다.
                    if (typeof vChild === "function") { continue; }

                    //★ 아예 안 담는 칸(위 C_SKIP_KEYS) — 깊이와 상관없이 건너뛴다.
                    if (C_SKIP_KEYS.indexOf(aKeys[i]) !== -1) { continue; }

                    vOut[aKeys[i]] = _snap(vChild, iDepth + 1, aChain, aKeys[i]);
                } catch (e) {
                    //읽는 것만으로 터지는 칸이 있을 수 있다(값을 꺼낼 때 코드가 도는 칸).
                    //  그 칸만 표시로 남기고 나머지는 계속 담는다.
                    console.error("[DMON-008] could not read the cell:", aKeys[i], e);
                    vOut[aKeys[i]] = "[read error]";
                }
            }
        }

        aChain.pop();

        return vOut;

    } // end of _snap

    /**
     * 모델 칸 — oData 만 담는다.
     *   oData 가 없으면 빈 것으로 두고 흔적을 남긴다(조용히 넘기면 왜 비었는지 알 수 없다).
     */
    function _snapModelData(v, iDepth, aChain, sKey) {

        var vData;

        try {
            vData = v.oData;
        } catch (e) {
            console.error("[DMON-011] ERROR MODEL_ODATA_READ_FAILED key=" + sKey + ":", e);
            return { oData: "[read error]" };
        }

        if (vData === undefined) {
            console.warn("[DMON-011] WARN MODEL_HAS_NO_ODATA key=" + sKey +
                " - this model is recorded as empty.");
            return {};
        }

        //바깥에서 손볼 것을 걸어 뒀으면 그것을 거친다(안 걸었으면 그대로).
        if (typeof _fnModelData === "function") {
            try {
                var vFixed = _fnModelData(vData, sKey);
                if (vFixed !== undefined) { vData = vFixed; }
            } catch (e) {
                //손보다 터지면 원래 것을 담는다. 조용히 넘기면 왜 달라졌는지 알 수 없다.
                console.error("[DMON-012] ERROR MODEL_DATA_HOOK_FAILED key=" + sKey +
                    " - the original oData is recorded instead:", e);
            }
        }

        return { oData: _snap(vData, iDepth + 1, aChain, "oData") };

    } // end of _snapModelData

    /**
     * 이 값이 화면 부품(UI5 컨트롤)인가.
     *   부품에만 있는 자기 칸 두 개(mProperties · mAggregations)와 UI5 물건 표시로 가른다.
     *   ★ 모델은 이 두 칸이 없어 안 걸린다 — 모델 안(oData)은 지금처럼 다 봐야 하기 때문이다(실측 확인).
     */
    function _isUiPart(v) {
        return (typeof v.getMetadata === "function"
            && Object.prototype.hasOwnProperty.call(v, "mProperties")
            && Object.prototype.hasOwnProperty.call(v, "mAggregations"));
    }

    /**
     * 화면 부품에서 우리가 만든 칸만 담는다.
     *   부품 자체는 비어 있어도 남긴다 — UI 가 생기고 없어지는 것은 계속 잡아야 하니까.
     */
    function _snapUiPart(v, iDepth, aChain) {

        var oOut = {};

        for (var i = 0; i < C_UI_KEEP.length; i++) {

            var sK = C_UI_KEEP[i];
            if (!Object.prototype.hasOwnProperty.call(v, sK)) { continue; }

            var vVal;
            try {
                vVal = v[sK];
            } catch (e) {
                //읽는 것만으로 터지는 칸이 있을 수 있다. 그 칸만 표시로 남긴다.
                console.error("[DMON-008] could not read the UI control cell:", sK, e);
                oOut[sK] = "[read error]";
                continue;
            }

            //윗 부품 자리에는 그 부품이 통째로 들어 있다. 어느 UI 인지만 알면 되므로 UI ID 만 남긴다.
            if (sK === "__PARENT") {
                if (vVal && typeof vVal === "object") {
                    if (!vVal._OBJID) {
                        console.warn("[DMON-008] parent control has no UI ID - cannot record which UI it is:", v._OBJID || "(unknown UI ID)");
                    }
                    oOut[sK] = vVal._OBJID || "(모름)";
                } else {
                    oOut[sK] = vVal;
                }
                continue;
            }

            oOut[sK] = _snap(vVal, iDepth + 1, aChain, sK);
        }

        return oOut;

    } // end of _snapUiPart

    /**
     * 두 사진을 한 칸씩 훑어 달라진 자리만 뽑는다.
     *   종류 = 바뀜 / 생김 / 없어짐
     *
     *   ★ 각 줄에 다음 둘을 같이 담는다(장군님 지시 2026-09-10).
     *      조각 = 자리를 칸 이름으로 쪼갠 것 ["oAPP.attr","T_UI","0","UIATV"]
     *      실값 = 줄여 놓지 않은 진짜 새 값
     *     모니터 창이 처음에 받아 둔 덩어리에 이 둘로 그 자리만 덮어쓴다.
     *     덩어리를 다시 통째로 넘기지 않으려는 것이다(48만자 — 2026-09-09 실측).
     *     실값은 이미 사진에서 뜬 순수한 값이라 창 사이로 넘길 수 있다.
     *
     *   aPath = 지금까지 내려온 칸 이름들(맨 앞은 "oAPP.attr" 같은 뿌리 이름)
     */
    function _diff(vOld, vNew, sPath, aPath, aOut) {

        if (aOut.length >= C_MAX_DIFF) { return aOut; }
        if (vOld === vNew) { return aOut; }

        var bObjOld = (vOld !== null && typeof vOld === "object");
        var bObjNew = (vNew !== null && typeof vNew === "object");

        //둘 중 하나라도 값이면 값끼리 비교하고 끝.
        if (!bObjOld || !bObjNew) {
            if (vOld !== vNew) {
                aOut.push({ 자리: sPath, 조각: aPath.slice(), 종류: "변경", 이전: _short(vOld), 새값: _short(vNew), 실값: vNew });
            }
            return aOut;
        }

        //양쪽 칸 이름을 모은다.
        var oKeys = {};
        Object.keys(vOld).forEach(function (k) { oKeys[k] = 1; });
        Object.keys(vNew).forEach(function (k) { oKeys[k] = 1; });

        for (var k in oKeys) {

            if (aOut.length >= C_MAX_DIFF) { break; }

            var bHasOld = Object.prototype.hasOwnProperty.call(vOld, k);
            var bHasNew = Object.prototype.hasOwnProperty.call(vNew, k);
            var sSub = sPath + (Array.isArray(vNew) || Array.isArray(vOld) ? "[" + k + "]" : "." + k);
            var aSub = aPath.concat(k);

            if (!bHasOld) {
                aOut.push({ 자리: sSub, 조각: aSub, 종류: "추가", 새값: _short(vNew[k]), 실값: vNew[k] });
                continue;
            }
            if (!bHasNew) {
                //없어진 자리는 넘길 값이 없다. 목록이면 뒤쪽이 통째로 없어진 것이라 줄 수만 줄이면 된다.
                aOut.push({ 자리: sSub, 조각: aSub, 종류: "삭제", 이전: _short(vOld[k]), 목록: Array.isArray(vOld) });
                continue;
            }

            _diff(vOld[k], vNew[k], sSub, aSub, aOut);
        }

        return aOut;

    } // end of _diff

    //값을 글자로 보여줄 때 이 길이까지만. 넘으면 뒤를 자른다(마우스를 올리면 자른 데까지 보인다).
    var C_VAL_LEN = 500;

    /**
     * 화면에 보여줄 값 만들기.
     *   ★ 실제 값을 그대로 보여준다. 예전엔 덩어리를 "칸 2개" 처럼 요약했는데
     *     그건 내가 지어낸 말이라 무슨 값인지 알 수 없었다(장군님 지시 2026-09-10).
     */
    function _short(v) {

        if (v === null) { return "null"; }
        if (v === undefined) { return ""; }

        var sType = typeof v;

        if (sType === "string") { return _cut(v); }
        if (sType !== "object") { return String(v); }

        //덩어리·목록은 그대로 글자로 펴서 보여준다.
        try {
            return _cut(JSON.stringify(v));
        } catch (e) {
            //글자로 못 펴는 경우(서로를 가리켜 빙빙 도는 것 등)만 개수로 알린다.
            return Array.isArray(v) ? ("[" + v.length + "]") : ("{" + Object.keys(v).length + "}");
        }

    } // end of _short

    function _cut(s) {
        s = String(s);
        return (s.length > C_VAL_LEN) ? (s.slice(0, C_VAL_LEN) + "…") : s;
    }


    /* ────────────────────────────────────────────────────────────────
     *  감시 대상 모으기
     * ──────────────────────────────────────────────────────────────── */

    /**
     * 지금 설정대로 감시할 대상을 모아 돌려준다.
     *   기본 = oAPP.attr (공통코드 제외) + oAPP.DATA (라이브러리 원장 제외)
     */
    function _collectTargets() {

        var oOut = {};

        oOut["oAPP.attr"] = _pick(oAPP.attr, (_oInclude.sCode ? [] : C_SKIP_ATTR).concat(C_SKIP_KEYS));
        oOut["oAPP.DATA"] = _pick(oAPP.DATA, (_oInclude.lib ? [] : C_SKIP_DATA).concat(C_SKIP_KEYS));

        return oOut;

    } // end of _collectTargets

    /**
     * 오브젝트에서 지정한 칸만 빼고 얕게 골라 담는다(안쪽은 그대로 물린다).
     */
    function _pick(oSrc, aSkip) {

        var oOut = {};
        if (!oSrc || typeof oSrc !== "object") { return oOut; }

        var aKeys = Object.keys(oSrc);
        for (var i = 0; i < aKeys.length; i++) {
            if (aSkip.indexOf(aKeys[i]) !== -1) { continue; }
            oOut[aKeys[i]] = oSrc[aKeys[i]];
        }

        return oOut;

    } // end of _pick

    /**
     * 지금 상태로 사진 한 장.
     */
    function _takeSnapshot() {

        var oTargets = _collectTargets();
        var oShot = {};

        for (var sName in oTargets) {
            oShot[sName] = _snap(oTargets[sName], 0, [], sName);
        }

        return oShot;

    } // end of _takeSnapshot


    /* ────────────────────────────────────────────────────────────────
     *  비교 실행
     * ──────────────────────────────────────────────────────────────── */

    /**
     * 새 사진을 떠서 직전 사진과 비교하고, 달라진 게 있으면 알린다.
     *   sWhen = "1차" | "따라온 변경" | "지금 비교"
     *   ★ 필수 프로세스 실패는 삼키지 않는다 — 터지면 감시를 끄고 오류코드로 드러낸다.
     */
    function _runCompare(sWhen) {

        if (!_bOn && sWhen !== "지금 비교") { return; }

        var t0 = 0, t1 = 0, oNew = null, aFound = null;

        try {

            t0 = (window.performance && performance.now) ? performance.now() : 0;
            oNew = _takeSnapshot();

            aFound = [];
            for (var sName in oNew) {
                _diff(_oBase ? _oBase[sName] : undefined, oNew[sName], sName, [sName], aFound);
            }

            t1 = (window.performance && performance.now) ? performance.now() : 0;

        } catch (e) {
            //훑다가 터지면 감시만 끄고 앱은 그대로 둔다(도구가 앱을 죽이면 안 된다).
            console.error("[DMON-001] snapshot/diff failed - watch turned off:", e);
            _stop();
            return;
        }

        //새 사진을 다음 비교용으로 보관.
        _oBase = oNew;

        if (!aFound.length) { return; }

        var oBatch = {
            번호: ++_iSeq,
            시각: _nowText(),
            언제: sWhen,
            조작: _oLastAct ? _oLastAct.설명 : "(모름)",
            걸린시간ms: Math.round((t1 - t0) * 100) / 100,
            잘림: (aFound.length >= C_MAX_DIFF),
            변경: aFound
        };

        if (typeof _fnOnChange === "function") {
            try {
                _fnOnChange(oBatch);
            } catch (e) {
                console.error("[DMON-002] result delivery failed:", e);
            }
        }

    } // end of _runCompare

    function _nowText() {
        var d = new Date();
        function p(n) { return (n < 10 ? "0" : "") + n; }
        function p3(n) { return (n < 10 ? "00" : (n < 100 ? "0" : "")) + n; }
        //같은 초에 여러 건이 들어와도 순서를 알 수 있게 1000분의 1초까지 적는다.
        return p(d.getHours()) + ":" + p(d.getMinutes()) + ":" + p(d.getSeconds()) + "." + p3(d.getMilliseconds());
    }


    /* ────────────────────────────────────────────────────────────────
     *  조작 받기
     * ──────────────────────────────────────────────────────────────── */

    /**
     * 화면 어디서 무엇을 눌렀는지 한 줄로 적는다.
     *   ★ 소스에 있는 이름을 그대로 쓰지 않고 화면에 보이는 글자를 쓴다.
     */
    function _describeAct(oEvent) {

        var el = oEvent && oEvent.target;
        var sKind = "";

        switch (oEvent.type) {
            case "change": sKind = "값 바뀜"; break;
            case "click": sKind = "누름"; break;
            case "keyup": sKind = "키 입력"; break;
            case "drop": sKind = "끌어다 놓음"; break;
            default: sKind = oEvent.type; break;
        }

        var sWhere = "";

        try {
            if (el && el.nodeType === 1) {

                //★ 아이콘만 있는 자리를 눌렀을 수 있다. 그 자리엔 글자가 없으므로
                //  위로 올라가며 "사람이 누르는 자리"(버튼·입력칸·목록 줄 등)를 찾아 그 이름을 쓴다.
                //  (예전엔 글자가 없으면 태그 이름을 그대로 썼는데, 화면에 없는 글자라 "i" 처럼 나왔다.)
                var oPick = el;
                if (el.closest) {
                    oPick = el.closest(
                        "button, a, [role='button'], [role='menuitem'], [role='tab'], [role='option'], " +
                        "input, select, textarea, label, li, th, td, [data-uiatk], [data-ctx-key]"
                    ) || el;
                }

                //① 화면에 보이는 글자
                sWhere = (oPick.textContent || "").replace(/\s+/g, " ").trim().slice(0, 40);

                //② 글자가 없으면 마우스를 올렸을 때 뜨는 이름 / 입력칸 안내문구 / 그림 설명
                if (!sWhere && oPick.getAttribute) {
                    sWhere = (oPick.getAttribute("aria-label")
                        || oPick.getAttribute("title")
                        || oPick.getAttribute("placeholder")
                        || oPick.getAttribute("alt")
                        || "").replace(/\s+/g, " ").trim().slice(0, 40);
                }

                //③ 그래도 없으면 이름이 없는 자리로 표시(태그 이름 같은 화면에 없는 글자는 안 쓴다)
                if (!sWhere) { sWhere = "(이름 없는 자리)"; }
            }
        } catch (e) {
            //화면 요소를 못 읽는 건 안내에만 영향이 있고 감시 자체는 계속 돈다.
            sWhere = "";
        }

        return { 설명: sKind + (sWhere ? " · " + sWhere : ""), 종류: oEvent.type };

    } // end of _describeAct

    /**
     * 조작이 들어왔을 때. 이미 예약해 둔 비교가 있으면 취소하고 다시 예약한다(겹침 방지).
     */
    function _onUserAct(oEvent) {

        if (!_bOn) { return; }

        _oLastAct = _describeAct(oEvent);

        if (_iTimer1) { clearTimeout(_iTimer1); _iTimer1 = 0; }
        if (_iTimer2) { clearTimeout(_iTimer2); _iTimer2 = 0; }

        _iTimer1 = setTimeout(function () {
            _iTimer1 = 0;
            _runCompare("1차");

            //뒤늦게 따라오는 변경(미리보기 다시 그린 뒤 서버 원자료가 갱신되는 것 등)을 한 번 더.
            _iTimer2 = setTimeout(function () {
                _iTimer2 = 0;
                _runCompare("따라온 변경");
            }, C_WAIT_2ND);

        }, C_WAIT_1ST);

    } // end of _onUserAct


    /* ────────────────────────────────────────────────────────────────
     *  켜기 / 끄기
     * ──────────────────────────────────────────────────────────────── */

    function _start(fnOnChange, oOpt) {

        if (_bOn) { return true; }

        if (!oAPP || !oAPP.attr) {
            console.error("[DMON-003] no data to watch yet (app not ready).");
            return false;
        }

        oOpt = oOpt || {};
        _oInclude.sCode = (oOpt.sCode === true);
        _oInclude.lib = (oOpt.lib === true);

        _fnOnChange = fnOnChange;
        _iSeq = 0;
        _oLastAct = null;

        //기준 사진 한 장.
        try {
            _oBase = _takeSnapshot();
        } catch (e) {
            console.error("[DMON-001] first snapshot failed - watch not started:", e);
            _oBase = null;
            return false;
        }

        for (var i = 0; i < C_EVENTS.length; i++) {
            //버블 단계로 받는다 — 앱이 먼저 처리한 뒤 우리가 본다.
            document.addEventListener(C_EVENTS[i], _onUserAct, false);
        }

        _bOn = true;
        return true;

    } // end of _start

    function _stop() {

        if (!_bOn) { return; }

        for (var i = 0; i < C_EVENTS.length; i++) {
            document.removeEventListener(C_EVENTS[i], _onUserAct, false);
        }

        if (_iTimer1) { clearTimeout(_iTimer1); _iTimer1 = 0; }
        if (_iTimer2) { clearTimeout(_iTimer2); _iTimer2 = 0; }

        _bOn = false;
        _oBase = null;
        _fnOnChange = null;
        _oLastAct = null;

    } // end of _stop


    /* ────────────────────────────────────────────────────────────────
     *  바깥에 여는 문
     * ──────────────────────────────────────────────────────────────── */

    oAPP.datamon = {

        //감시 켜기. fnOnChange(묶음) 으로 달라진 것을 알려준다.
        //  oOpt = { sCode:true 면 공통코드 포함, lib:true 면 라이브러리 원장 포함 }
        start: function (fnOnChange, oOpt) { return _start(fnOnChange, oOpt); },

        //감시 끄기.
        stop: function () { _stop(); },

        //켜져 있나.
        isOn: function () { return _bOn; },

        //[지금 비교] — 조작 없이 지금 상태를 직전 사진과 맞춰본다.
        compareNow: function () { _runCompare("지금 비교"); },

        //덩치 큰 것 포함 여부 바꾸기. 바꾸면 기준 사진을 새로 뜬다.
        setInclude: function (oOpt) {
            oOpt = oOpt || {};
            if (typeof oOpt.sCode === "boolean") { _oInclude.sCode = oOpt.sCode; }
            if (typeof oOpt.lib === "boolean") { _oInclude.lib = oOpt.lib; }
            if (_bOn) {
                try { _oBase = _takeSnapshot(); }
                catch (e) {
                    console.error("[DMON-001] snapshot after scope change failed - watch turned off:", e);
                    _stop();
                }
            }
        },

        //지금 설정.
        getInclude: function () { return { sCode: _oInclude.sCode, lib: _oInclude.lib }; },

        /**
         * 모델 칸의 oData 를 담기 직전에 손볼 것을 걸어 둔다.
         *   fn(vData, sKey) 가 돌려준 것을 대신 담는다. undefined 를 돌려주면 원래 것을 담는다.
         *   null 을 넣으면 건 것을 뗀다.
         *
         *   ★ 4.0 은 안 건다. 3.0 만 건다 — 3.0 은 앱 모델과 UI5 Core 모델 두 군데에
         *     데이터가 나뉘어 있어, 합쳐야 4.0 과 같은 모양이 된다(장군님 지시 2026-09-11).
         */
        setModelDataHook: function (fn) {
            if (fn !== null && typeof fn !== "function") {
                console.error("[DMON-012] ERROR MODEL_DATA_HOOK_NOT_A_FUNCTION - nothing was set.");
                return false;
            }
            _fnModelData = fn;
            console.log("[DMON] INFO MODEL_DATA_HOOK " + (fn ? "set" : "cleared"));
            return true;
        },

        /**
         * [3.0 ↔ 4.0 비교] 지금 데이터 구조를 한 벌 떠서 그대로 돌려준다.
         *
         * 왜 필요한가 (.works/데이터모니터/01_버전간_데이터비교_설계.md):
         *   3.0 에서 이 파일을 실행 중인 화면에 그대로 붙여 돌린 뒤, 그 결과를
         *   4.0 이 열어 둔 8888 로 보낸다. 비교하려는 것이 "구조"라서 달라진 것만이
         *   아니라 **전체 구조**가 필요하다. 감시를 켜지 않아도 부를 수 있다.
         *
         * 무엇을 돌려주나:
         *   _takeSnapshot() 결과 그대로 — circular 이나 max depth 는 이미 표시로 바뀐
         *   상태라 글자로 바꿔 보내도 터지지 않는다.
         */
        snapshot: function () {
            try {
                return _takeSnapshot();
            } catch (e) {
                //여기서 조용히 null 을 주면 보내는 쪽이 "빈 것"으로 착각한다 — 드러낸다.
                console.error("[DMON-009] ERROR SNAPSHOT_FOR_COMPARE failed - nothing to send:", e);
                return null;
            }
        },

        //덩치 재보기(개발 확인용). 사진 크기와 걸린 시간을 돌려준다.
        measure: function () {
            var t0 = performance.now();
            var oShot = _takeSnapshot();
            var t1 = performance.now();
            var iLen = -1;
            try { iLen = JSON.stringify(oShot).length; } catch (e) { iLen = -1; }
            return { 글자수: iLen, 사진ms: Math.round((t1 - t0) * 100) / 100 };
        }

    };


    /* ────────────────────────────────────────────────────────────────
     *  테스트 메뉴 "데이터 모니터" 배선 (2단계)
     *
     *  왜 여기에 두나:
     *    이 파일은 로드 목록 맨 뒤라 원본 핸들러 파일(fnHmws.js)보다 뒤에 실린다.
     *    그래서 원본 파일을 건드리지 않고 여기서 핸들러 이름만 정의하면 된다.
     *    메뉴가 누르면 oAPP.fn.fnWS10Test84 / fnWS20Test84 를 찾아 부른다
     *    (WS10 = ws10_html.js 의 메뉴 위임, WS20 = ws_html5_ws20.js 의 메뉴 위임).
     * ──────────────────────────────────────────────────────────────── */

    /**
     * 모니터 창 열기. 창 만드는 쪽 = Popups/dataMonitor/index.js.
     *   ★ 창 객체는 여기(모듈 안)에만 둔다 — oAPP.attr 에 두면 감시 대상에 창이 섞인다.
     */
    function _openMonitor() {

        //창을 열기 전에 부모 쪽 주고받는 길부터 연다(창이 뜨자마자 신호를 보내므로).
        _openChannel();

        var sIndexPath = "";

        try {
            var oSettingsInfo = parent.getSettingsInfo();
            sIndexPath = parent.PATH.join(oSettingsInfo.path.POPUP_ROOT, "dataMonitor", "index.js");
        } catch (e) {
            console.error("[DMON-004] could not build the data monitor window path:", e);
            return;
        }

        try {
            parent.require(sIndexPath)(parent.REMOTE, oAPP);
        } catch (e) {
            console.error("[DMON-004] data monitor window open failed:", e);
        }

    } // end of _openMonitor


    /* ────────────────────────────────────────────────────────────────
     *  별창과 신호 주고받기 (4단계)
     *
     *  길 = BroadcastChannel "u4a-datamon_<브라우저키>" 하나로 양방향.
     *  ★ 사진은 안 보낸다. 여기서 비교까지 마치고 "달라진 자리"만 보낸다.
     * ──────────────────────────────────────────────────────────────── */

    var _oCh = null;   //별창과 잇는 길 (oAPP 밖에 두어 감시 대상에 안 섞이게)

    function _chSend(oMsg) {
        if (!_oCh) { return; }
        try { _oCh.postMessage(oMsg); }
        catch (e) { console.error("[DMON-004] send signal to monitor window failed:", e); }
    }

    /**
     * 바뀐 것 묶음 보내기.
     *   ★ 각 줄에 담은 [실값]은 창끼리 넘길 수 없는 종류일 수 있다(아주 드묾).
     *     그때는 실값만 빼고 다시 보내고 "값은 못 보냈다"고 알린다 —
     *     그러면 모니터 창이 덮어쓰기 대신 데이터를 통째로 다시 달라고 한다.
     *     묶음을 통째로 못 보내면 줄이 아예 안 뜨므로 조용히 넘기지 않는다.
     */
    function _sendBatch(oBatch) {

        if (!_oCh) { return; }

        try {
            _oCh.postMessage({ PRCCD: "DMON_BATCH", BATCH: oBatch });
            return;
        } catch (e) {
            console.error("[DMON-007] could not send changed values as-is - resending without values:", e);
        }

        try {
            var aSlim = [];
            for (var i = 0; i < oBatch.변경.length; i++) {
                var oC = oBatch.변경[i];
                aSlim.push({ 자리: oC.자리, 조각: oC.조각, 종류: oC.종류, 이전: oC.이전, 새값: oC.새값, 목록: oC.목록 });
            }
            var oSlim = {};
            for (var k in oBatch) { if (k !== "변경") { oSlim[k] = oBatch[k]; } }
            oSlim.변경 = aSlim;
            oSlim.실값없음 = true;
            _oCh.postMessage({ PRCCD: "DMON_BATCH", BATCH: oSlim });
        } catch (e2) {
            console.error("[DMON-007] could not send without values either - the diff view will not render:", e2);
        }
    }

    function _openChannel() {

        if (_oCh) { return; }

        var sKey = "";
        try { sKey = parent.getBrowserKey(); }
        catch (e) {
            console.error("[DMON-004] no window key - cannot connect to the monitor window:", e);
            return;
        }

        try {
            _oCh = new BroadcastChannel("u4a-datamon_" + sKey);
        } catch (e) {
            console.error("[DMON-004] could not open the channel to the monitor window:", e);
            _oCh = null;
            return;
        }

        _oCh.onmessage = function (ev) {

            var oData = ev && ev.data;
            if (!oData || !oData.PRCCD) { return; }

            switch (oData.PRCCD) {

                case "DMON_READY":
                    //별창이 다 떴다 — 지금 상태를 알려준다.
                    _chSend({ PRCCD: "DMON_STATE", ON: _bOn });
                    break;

                case "DMON_START":
                    _start(function (oBatch) {
                        _sendBatch(oBatch);
                    }, { sCode: (oData.SCODE === true), lib: (oData.LIB === true) });
                    _chSend({ PRCCD: "DMON_STATE", ON: _bOn });
                    break;

                case "DMON_STOP":
                    _stop();
                    _chSend({ PRCCD: "DMON_STATE", ON: _bOn });
                    break;

                case "DMON_NOW":
                    _runCompare("지금 비교");
                    break;

                case "DMON_SNAPNOW":
                    //[3.0 <-> 4.0 비교] "지금 이 순간"을 새로 뜬다.
                    //  ★ 아래 DMON_SNAP 과 다르다. DMON_SNAP 은 마지막으로 비교할 때 뜬 것을 그대로 준다
                    //    (화면에 뿌린 변경 목록과 시점이 같아야 하므로). 그런데 비교 뷰의 [4.0 지금 담기]는
                    //    말 그대로 지금을 떠야 한다 — 감시가 켜져 있으면 마지막 비교 시점(최대 1초 전) 것이
                    //    와서 3.0 쪽과 시점이 어긋난다(장군님 질문 2026-09-11로 드러남).
                    //  ★ 3.0 은 oAPP.datamon.snapshot() 으로 언제나 지금을 뜬다. 양쪽이 같아야 비교가 맞다.
                    try {
                        _chSend({ PRCCD: "DMON_SNAPDATA", NOW: true, SNAP: _takeSnapshot() });
                    } catch (e) {
                        console.error("[DMON-010] ERROR SNAPSHOT_NOW_FAILED - the compare view gets nothing:", e);
                    }
                    break;

                case "DMON_SNAP":
                    //트리 뷰가 "지금 데이터 전부"를 그릴 때 쓴다. 마지막으로 뜬 스냅샷을 그대로 넘긴다.
                    //  (새로 뜨지 않는다 — 지금 화면에 뿌린 변경 목록과 같은 시점이어야 어긋나지 않는다.)
                    try {
                        _chSend({ PRCCD: "DMON_SNAPDATA", SNAP: _oBase || _takeSnapshot() });
                    } catch (e) {
                        console.error("[DMON-006] tree view payload build failed:", e);
                    }
                    break;

                case "DMON_INCLUDE":
                    oAPP.datamon.setInclude({ sCode: (oData.SCODE === true), lib: (oData.LIB === true) });
                    break;

                default:
                    break;
            }
        };
    }

    oAPP.fn = oAPP.fn || {};
    oAPP.fn.fnDataMonitorOpen = function () { _openMonitor(); };
    oAPP.fn.fnWS10Test84 = function () { _openMonitor(); };
    oAPP.fn.fnWS20Test84 = function () { _openMonitor(); };


    /* ────────────────────────────────────────────────────────────────
     *  화면을 나갈 때 이 창은 닫지 않는다 (장군님 지시 2026-09-10)
     *
     *  WS20·WS30 에서 뒤로가기를 하면 자식 창을 일괄로 닫는데(ws_fn_02.js
     *  fnChildWindowClose), 그때 닫히지 않을 창 목록이 이미 있다
     *  (fnCheckPopupCloseException). 그 목록에 이 창을 더한다.
     *
     *  원본 파일은 안 고친다 — 이 파일이 뒤에 로드되므로, 원래 판정을 그대로
     *  부르고 이 창일 때만 "닫지 않음"을 얹는다(원본 목록이 바뀌어도 따라간다).
     * ──────────────────────────────────────────────────────────────── */

    //창 만들 때 넣어 준 이름과 같아야 한다(Popups/dataMonitor/index.js 의 sPopupName).
    var C_WIN_NAME = "dataMonitor";

    (function () {

        var fnOrigin = oAPP.fn.fnCheckPopupCloseException;

        if (typeof fnOrigin !== "function") {
            //원래 판정이 없으면 이 덧대기가 조용히 무의미해진다 — 드러낸다.
            console.error("[DMON-005] no close-exception rule - the data monitor window closes on back navigation.");
            return;
        }

        oAPP.fn.fnCheckPopupCloseException = function (OBJTY) {

            if (OBJTY === C_WIN_NAME) { return true; }   //이 창은 안 닫는다

            return fnOrigin.apply(this, arguments);       //나머지는 원래대로
        };

    })();

})(window, $, oAPP);


/* ======================================================================
 * [2] 보내기 — 이 부분만 3.0 전용
 * ====================================================================== */

(function (window, oAPP) {
    "use strict";

    //4.0 의 데이터 모니터 창이 열어 두는 자리.
    var C_URL = "http://127.0.0.1:9999/snapshot";

    //단추 하나만 남게 하는 표식.
    var C_BTN_ID = "dm30SendBtn";


    /* ----------------------------------------------------------------
     *  3.0 전용 — 앱 모델 oData 에 UI5 Core 모델 oData 를 합친다.
     *
     *  왜 (장군님 지시 2026-09-11):
     *    4.0 은 데이터를 모델 하나에 다 들고 있는데, 3.0 은
     *      oAPP.attr.oModel.oData        (앱 모델)
     *      sap.ui.getCore().getModel().oData  (UI5 Core 모델)
     *    두 군데로 나뉘어 있다. 합쳐야 4.0 과 같은 모양이 되어 비교가 뜻이 있다.
     *
     *  ★ 이 처리는 **3.0 에서만** 돈다. 수집 코드(위 [1])는 4.0 과 글자까지 같게 두고,
     *    바깥에서 걸 수 있게 열어 둔 자리에만 이것을 건다.
     *  ★ 같은 이름이 양쪽에 있으면 **앱 모델 값을 남긴다**(더 가까운 쪽). 몇 개나 겹쳤는지 남긴다.
     * ---------------------------------------------------------------- */

    function _coreModelData() {

        if (typeof sap === "undefined" || !sap.ui || typeof sap.ui.getCore !== "function") {
            console.warn("[DM30-005] WARN NO_SAP_CORE - core model data is not merged.");
            return null;
        }

        var oCore, oModel;

        try {
            oCore = sap.ui.getCore();
            oModel = (oCore && typeof oCore.getModel === "function") ? oCore.getModel() : null;
        } catch (e) {
            console.error("[DM30-005] ERROR CORE_MODEL_READ_FAILED - core model data is not merged:", e);
            return null;
        }

        if (!oModel) {
            console.warn("[DM30-005] WARN NO_CORE_MODEL - core model data is not merged.");
            return null;
        }

        var vData;
        try { vData = oModel.oData; }
        catch (e) {
            console.error("[DM30-005] ERROR CORE_MODEL_ODATA_READ_FAILED:", e);
            return null;
        }

        if (!vData || typeof vData !== "object") {
            console.warn("[DM30-005] WARN CORE_MODEL_ODATA_EMPTY - nothing to merge.");
            return null;
        }

        return vData;
    }

    function _installModelMerge() {

        if (!oAPP || !oAPP.datamon || typeof oAPP.datamon.setModelDataHook !== "function") {
            console.error("[DM30-006] ERROR NO_MODEL_HOOK - core model data will not be merged. " +
                "the collector part is older than this file.");
            return false;
        }

        oAPP.datamon.setModelDataHook(function (vData, sKey) {

            //앱 모델 칸에만 합친다(화면 부품 안의 모델은 그대로 둔다).
            if (sKey !== "oModel") { return vData; }

            var oCore = _coreModelData();
            if (!oCore) { return vData; }

            var oOut = {};
            var aCoreKeys = Object.keys(oCore);
            var i;

            //Core 것을 먼저 깔고
            for (i = 0; i < aCoreKeys.length; i++) { oOut[aCoreKeys[i]] = oCore[aCoreKeys[i]]; }

            //앱 모델 것으로 덮는다(겹치면 앱 모델이 이긴다)
            var iDup = 0;
            if (vData && typeof vData === "object") {
                var aKeys = Object.keys(vData);
                for (i = 0; i < aKeys.length; i++) {
                    if (Object.prototype.hasOwnProperty.call(oOut, aKeys[i])) { iDup++; }
                    oOut[aKeys[i]] = vData[aKeys[i]];
                }
            }

            console.log("[DM30] INFO CORE_MODEL_MERGED core=" + aCoreKeys.length +
                " app=" + (vData ? Object.keys(vData).length : 0) +
                " dup=" + iDup + " total=" + Object.keys(oOut).length);

            return oOut;
        });

        return true;
    }


    /* ----------------------------------------------------------------
     *  보내기
     * ---------------------------------------------------------------- */
    function _send(oBtn) {

        function _say(sText) {
            if (!oBtn) { return; }
            oBtn.textContent = sText;
        }

        if (!oAPP || !oAPP.datamon || typeof oAPP.datamon.snapshot !== "function") {
            console.error("[DM30-001] ERROR ENGINE_MISSING - the collector part did not load. nothing was sent.");
            _say("수집 코드 없음");
            return;
        }

        var oSnap = oAPP.datamon.snapshot();

        if (!oSnap) {
            //수집 코드 쪽에서 이미 흔적을 남긴다(DMON-009).
            console.error("[DM30-003] ERROR SNAPSHOT_EMPTY - nothing was sent.");
            _say("담을 것이 없음");
            return;
        }

        var sBody = "";

        try {
            sBody = JSON.stringify({
                FROM: "3.0",
                TIME: new Date().toISOString(),
                SNAP: oSnap
            });
        } catch (e) {
            console.error("[DM30-003] ERROR SNAPSHOT_STRINGIFY_FAILED - nothing was sent:", e);
            _say("글자로 못 바꿈");
            return;
        }

        if (oBtn) { oBtn.disabled = true; }
        _say("보내는 중…");

        var t0 = (window.performance && performance.now) ? performance.now() : 0;

        fetch(C_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: sBody
        }).then(function (res) {
            if (!res.ok) { throw new Error("HTTP " + res.status); }
            return res.json();
        }).then(function (oRes) {
            var t1 = (window.performance && performance.now) ? performance.now() : 0;
            console.log("[DM30] INFO SEND_DONE size=" + sBody.length +
                " roots=" + (oRes && oRes.ROOTS) + " ms=" + Math.round(t1 - t0));
            _say("보냄 (" + sBody.length + "자)");
        })["catch"](function (e) {
            //4.0 창이 안 떠 있거나 자리가 안 열렸으면 여기로 온다 - 조용히 넘기지 않는다.
            console.error("[DM30-004] ERROR SEND_FAILED url=" + C_URL +
                " size=" + sBody.length + " - is the 4.0 data monitor window open?", e);
            _say("보내기 실패");
        }).then(function () {
            if (oBtn) { oBtn.disabled = false; }
            setTimeout(function () { _say("3.0 → 4.0 보내기"); }, 2500);
        });
    }


    /* ----------------------------------------------------------------
     *  단추 만들기
     * ---------------------------------------------------------------- */
    function _makeButton() {

        if (!document || !document.body) {
            console.error("[DM30-005] ERROR NO_BODY - the send button was not created.");
            return null;
        }

        //여러 번 심어도 하나만 남게.
        var oOld = document.getElementById(C_BTN_ID);
        if (oOld) { oOld.remove(); }

        var oBtn = document.createElement("button");
        oBtn.id = C_BTN_ID;
        oBtn.type = "button";
        oBtn.textContent = "3.0 → 4.0 보내기";

        //3.0 화면의 스타일을 안 건드리려고 이 단추에만 직접 적는다(임시 도구).
        oBtn.style.cssText =
            "position:fixed; right:16px; bottom:16px; z-index:2147483647;" +
            "padding:8px 14px; font-size:13px; line-height:1.2; cursor:pointer;" +
            "background:#0070f2; color:#fff; border:0; border-radius:6px;" +
            "box-shadow:0 2px 8px rgba(0,0,0,.35);";

        oBtn.addEventListener("click", function () { _send(oBtn); });

        document.body.appendChild(oBtn);
        return oBtn;
    }


    /* ----------------------------------------------------------------
     *  심기
     * ---------------------------------------------------------------- */
    var _oBtn = _makeButton();
    var _bMerge = _installModelMerge();

    //★ 감시는 켜지 않는다(장군님 지시 2026-09-11).
    //  3.0 쪽에서 할 일은 "부르는 그 순간의 데이터 구조를 떠서 보내는 것" 하나뿐이다.
    //  감시를 켜면 조작할 때마다 3.0 안에서 계속 비교가 돌아 느려지기만 한다.
    //  그래서 바깥에 여는 것도 **send 하나뿐**이다.
    window.DM30 = {
        send: function () { _send(_oBtn); }
    };

    console.log("[DM30] INFO READY url=" + C_URL +
        " button=" + (_oBtn ? "yes" : "no") + " coreMerge=" + _bMerge);

})(window, oAPP);
