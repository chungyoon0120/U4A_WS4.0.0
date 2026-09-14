//즐겨찾기 리스트 구성 대표 object.
const oAPP = {};

//attribute 구성 obecjt.
oAPP.attr = {};

//기능 function 구성 object.
oAPP.fn = {};

//즐겨찾기 팝업과 즐겨찾기 리스트(IFRAME)의 I/F를 위한 커스텀 이벤트명.
const C_IF_FAV_ICON_EVT = "IF_FAV_ICON_EVT";


/*********************************************************
 * @function - 즐겨찾기 html 로드시 이벤트 등록 처리.
 ********************************************************/
window.addEventListener("load", async function(){

    let _PARENT_DOM_ID = await new Promise(function(resolve){

        let _oIntv = setInterval(() => {

            //부모에서 구성한 팝업의 DOM ID가 존재하지 않는경우 EXIT.
            //(child의 onload 이벤트가 먼저 수행된 뒤, parent의 onload이벤트가 수행되어
            //부모에서 window에 매핑한 값을 child에서 기다림)
            if(typeof window?.PARENT_DOM_ID === "undefined"){
                return;
            }

            //interval 초기화.
            clearInterval(_oIntv);

            let _PARENT_DOM_ID = window.PARENT_DOM_ID;

            delete window.PARENT_DOM_ID;

            resolve(_PARENT_DOM_ID);

        }, 50);
    });


    //부모로 부터 전달받은 팝업의 DOM ID가 존재하지 않는경우 EXIT.
    if(typeof _PARENT_DOM_ID === "undefined"){
        return;
    }


    oAPP.attr.PARENT_DOM_ID = _PARENT_DOM_ID;


    //커스텀 이벤트 등록 처리.
    document.body.addEventListener(C_IF_FAV_ICON_EVT, oAPP.fn.favIconCustomEvent);


    //즐겨찾기 아이콘 리스트 iframe 로드 처리됨 이벤트 수행.
    oAPP.fn.fireIconListFrameLoaded();


});


/*********************************************************
 * @function - 즐겨찾기 팝업으로 데이터 전송 처리.
 ********************************************************/
oAPP.fn.sendDataToParent = function(oData){

    let _oParentDom = parent.document.getElementById(oAPP.attr.PARENT_DOM_ID) || undefined;

    if(typeof _oParentDom === "undefined"){
        return;
    }

    let _oCustomEvt = new CustomEvent(C_IF_FAV_ICON_EVT, {detail: oData});

    //즐겨찾기 팝업으로 데이터 전송 처리.
    _oParentDom.dispatchEvent(_oCustomEvt);


};




/*********************************************************
 * @function - //즐겨찾기 팝업과 즐겨찾기 리스트(iframe)과의 I/F를 위한 커스텀 이벤트 callback function.
 ********************************************************/
oAPP.fn.favIconCustomEvent = function(oEvent){

    switch (oEvent?.detail?.ACTCD) {
        case "SET_INIT_FAV_LIST":

            //즐겨찾기 아이콘 화면 초기 구성.
            oAPP.fn.setInitFavIconData(oEvent.detail);
            break;

        case "THEME_CHANGE":
            //테마 변경 처리.
            oAPP.fn.setTheme(oEvent.detail?.S_THEME);
            break;

        default:
            break;
    }

};




/*********************************************************
 * @function - 즐겨찾기 아이콘 리스트 iframe 로드 처리됨 이벤트 수행.
 ********************************************************/
oAPP.fn.fireIconListFrameLoaded = function(){

    let _sParam = {};

    //즐겨찾기 아이콘 리스트 IFRAME 로드됨.
    _sParam.ACTCD = "FAV_ICON_LIST_FRAME_LOADED";


    //즐겨찾기 팝업으로 데이터 전송 처리.
    oAPP.fn.sendDataToParent(_sParam);

};




/*********************************************************
 * @function - 즐겨찾기 아이콘 화면 초기 구성.
 ********************************************************/
oAPP.fn.setInitFavIconData = function(oData){


    //즐겨찾기 아이콘 CSS Link 제거.
    oAPP.fn.removeIconCSSLink();


    //즐겨찾기 아이콘 CSS STYLE 제거.
    oAPP.fn.removeIconStyle();


    //즐겨찾기 아이콘 리스트 초기화.
    oAPP.fn.removeFavList();


    //검색 placeholder/결과없음 문구 적용(부모가 메시지키로 전달).
    oAPP.fn.applyTexts(oData?.S_TXT);


    //테마 적용 처리.
    oAPP.fn.setTheme(oData?.S_THEME);


    //즐겨찾기 아이콘 CSS Link 추가 처리.
    oAPP.fn.createIconCSSLink(oData?.T_CSS);


    //즐겨찾기 아이콘 CSS STYLE 구성 처리.
    oAPP.fn.createIconStyle(oData?.T_STYLE);


    //즐겨찾기 아이콘 리스트 데이터 출력 body 생성.
    oAPP.fn.createFavListBody();


    //즐겨찾기 아이콘 리스트 구성 처리.
    oAPP.fn.setFavList(oData?.T_ICON_LIST);


    //검색 이벤트 1회 배선 + 현재 검색어 기준 필터/카운트 갱신.
    oAPP.fn.wireSearchOnce();
    oAPP.fn.refreshFilter();


    let _oHTML = document.getElementsByTagName("html");

    //현재 HTML의 비활성 해제 처리.
    if(_oHTML.length > 0){
        _oHTML[0].style.display = "";
    }


    let _sParam = {};

    //BUSY OFF 액션코드 매핑.
    _sParam.ACTCD = "BUSY_OFF";

    //아이콘 즐겨찾기 팝업에 BOSY OFF 요청 처리.
    oAPP.fn.sendDataToParent(_sParam);

};




/*********************************************************
 * @function - 즐겨찾기 아이콘 CSS STYLE 제거.
 ********************************************************/
oAPP.fn.removeIconStyle = function(){

    let _oStyle = document.head.querySelector('style[id^="ext_icon"]') || undefined;

    if(typeof _oStyle === "undefined"){
        return;
    }

    document.head.removeChild(_oStyle);


};




/*********************************************************
 * @function - 테마 적용 처리.
 ********************************************************/
oAPP.fn.setTheme = function(sTheme){

    if(typeof sTheme?.THEME === "undefined"){
        return;
    }

    //테마명 대문자 변환 처리.
    let _theme = String(sTheme.THEME).toUpperCase();

    //다크 테마 키워드가 존재하는경우.
    if(_theme.indexOf("DARK") !== -1){
        //즐겨찾기 리스트를 다크 테마로 적용.
        document.body.classList.replace('light-theme', 'dark-theme');
        return;
    }


    //다크 테마가 아닌경우, 밝은 테마로 적용.
    document.body.classList.replace('dark-theme', 'light-theme');


};




/*********************************************************
 * @function - 즐겨찾기 아이콘 CSS STYLE 구성 처리.
 ********************************************************/
oAPP.fn.createIconStyle = function(aFont = []){

    if(aFont.length === 0){
        return;
    }

    let _oStyle = document.createElement("style");

    _oStyle.id = "ext_icon";

    let _style = "";

    //EXTENSION 아이콘 처리를 위해 FONT CSS 구성 처리.
    for (let i = 0, l = aFont.length; i < l; i++) {

        let _sFont = aFont[i];

        _style +=
                `@font-face {` +
                    `font-family: '${_sFont.fontFamily}';` +
                    `src: url('${_sFont.fontURI}') format('woff2');` +
                    `font-weight: normal;` +
                    `font-style: normal;` +
                `}`;
    }


    _oStyle.innerHTML = _style;


    document.head.appendChild(_oStyle);


};




/*********************************************************
 * @function - 즐겨찾기 아이콘 CSS Link 제거.
 ********************************************************/
oAPP.fn.removeIconCSSLink = function(){

    //sap ui5 폰트 사용을 위한 테마 링크 css 정보 얻기.
    let _aLink = document.head.querySelectorAll('link[id^="sap-ui-theme"]');

    if(_aLink.length === 0){
        return;
    }

    //폰트 사용 테마 링크 정보 제거 처리.
    for (let i = 0, l = _aLink.length; i < l; i++) {

        let _oLink = _aLink[i];

        document.head.removeChild(_oLink);

    }

};




/*********************************************************
 * @function - 즐겨찾기 아이콘 CSS Link 추가 처리.
 ********************************************************/
oAPP.fn.createIconCSSLink = function(aLinkPath = []){

    if(aLinkPath.length === 0){
        return;
    }

    //폰트 사용 테마 링크 정보 추가 처리.
    for (let i = 0, l = aLinkPath.length; i < l; i++) {

        let _sLinkPath = aLinkPath[i];

        let _oLink = document.createElement("link");

        _oLink.setAttribute("rel", "stylesheet");

        _oLink.setAttribute("href", _sLinkPath.href);

        _oLink.setAttribute("id", _sLinkPath.id);


        document.head.appendChild(_oLink);

    }

};




/*********************************************************
 * @function - 즐겨찾기 아이콘 리스트 초기화.
 ********************************************************/
oAPP.fn.removeFavList = function(){

    let _oGrid = document.getElementById("favGrid") || undefined;

    if(typeof _oGrid === "undefined"){
        return;
    }

    //그리드 내 타일 전체 제거.
    _oGrid.replaceChildren();

};




/*********************************************************
 * @function - 즐겨찾기 아이콘 리스트 데이터 출력 body 생성.
 *   개편: 출력 컨테이너(#favGrid)는 index.html 에 정적으로 존재하므로
 *   별도 body 생성이 필요 없다(초기화는 removeFavList 가 담당).
 ********************************************************/
oAPP.fn.createFavListBody = function(){
    //정적 그리드 사용 — 생성 불필요.
};




/*********************************************************
 * @function - 즐겨찾기 아이콘 리스트 데이터 출력 body 정보 얻기.
 ********************************************************/
oAPP.fn.getFavListBody = function(){

    return document.getElementById("favGrid") || undefined;

};




/*********************************************************
 * @function - 즐겨찾기 아이콘 리스트 구성 처리.
 *   개편: 밋밋한 <table> 행 → SAP Horizon 룩의 아이콘 타일 그리드.
 *   (아이콘 글리프 렌더·이벤트 I/F·데이터 매핑은 원본 그대로)
 ********************************************************/
oAPP.fn.setFavList = function(aFavIconList = []){

    //즐겨찾기 아이콘 리스트가 존재하지 않는경우 exit.
    if(aFavIconList.length === 0){
        return;
    }


    //즐겨찾기 아이콘 리스트 데이터 출력 그리드 정보 얻기.
    let _oGrid = oAPP.fn.getFavListBody();

    if(typeof _oGrid === "undefined"){
        return;
    }


    //즐겨찾기 아이콘 항목을 기준으로 타일 그리드 구성.
    for (let i = 0, l = aFavIconList.length; i < l; i++) {

        let _sFavIconList = aFavIconList[i];

        //── 아이콘 타일(더블클릭 = 선택) ──────────────────────────
        let _oTile = document.createElement("div");

        //현재 아이콘 라인 데이터를 dom에 매핑 처리.
        _oTile._sFavIconList = _sFavIconList;

        _oTile.classList.add("favTile");

        //말줄임된 아이콘 이름 전체는 타일 title 로 확인(독립 iframe — 네이티브 title 허용).
        _oTile.title = _sFavIconList.ICON_NAME || "";

        //검색 필터용 소문자 캐시 — 이름 + ICON_SRC.
        //  ★[수정 2026-09-14, 장군님 지시] 이름만 보면 복사 버튼으로 복사한 값(ICON_SRC, 예 sap-icon://account)을
        //  그대로 붙여넣어 검색했을 때 한 건도 안 나온다. 같은 앱의 아이콘 뷰어(iconPrevPopup) 도
        //  ICON_SRC 를 검색 대상으로 쓴다 — 기준을 맞춘다.
        _oTile._find = (String(_sFavIconList.ICON_NAME || "") + " " + String(_sFavIconList.ICON_SRC || "")).toLowerCase();

        //키보드 접근성 — 타일 포커스 가능 + Enter/Space 선택(더블클릭과 동일).
        _oTile.tabIndex = 0;
        _oTile.setAttribute("role", "button");
        _oTile.onkeydown = oAPP.onKeydownFavTile;

        //더블클릭 = 아이콘 선택(원본 로직 유지).
        _oTile.ondblclick = oAPP.onDblclickFavList;


        //── 아이콘 글리프(SAP UI5 아이콘 폰트) ────────────────────
        let _oGlyph = document.createElement("span");

        //아이콘 출력(서버 library.css 의 .sapUiIcon 이 content 렌더).
        _oGlyph.setAttribute("data-sap-ui-icon-content", _sFavIconList.content);

        _oGlyph.classList.add("sapUiIcon", "favTile__glyph");

        //아이콘 출력 font family 구성.
        _oGlyph.style.fontFamily = _sFavIconList.fontFamily;

        _oTile.appendChild(_oGlyph);


        //── 아이콘 이름(말줄임) ───────────────────────────────────
        let _oName = document.createElement("span");

        _oName.classList.add("favTile__name");

        _oName.innerText = _sFavIconList.ICON_NAME;

        _oTile.appendChild(_oName);


        //── 이름 복사 버튼(타일 hover 시 우상단 노출) ─────────────
        let _oCopyButton = document.createElement("button");

        _oCopyButton.type = "button";

        //타일 자체 Tab 순서만 유지(복사버튼은 Tab 스톱 제외 — focus-within/hover 로 노출).
        _oCopyButton.tabIndex = -1;

        //현재 아이콘 라인 데이터를 dom에 매핑 처리.
        _oCopyButton._sFavIconList = _sFavIconList;

        _oCopyButton.classList.add("favTile__copy");

        //버튼 클릭 = 이름 복사(원본 로직 유지).
        _oCopyButton.onclick = oAPP.onClipBoardTextCopy;

        //타일 더블클릭(선택)과의 전파 충돌 방지.
        _oCopyButton.ondblclick = function(){
            event.stopPropagation();
        };


        let _oCopyIcon = document.createElement("span");

        //복사 버튼 아이콘.
        _oCopyIcon.setAttribute("data-sap-ui-icon-content", "");

        _oCopyIcon.classList.add("sapUiIcon");

        _oCopyIcon.style.fontFamily = "SAP-icons";

        _oCopyButton.appendChild(_oCopyIcon);


        _oTile.appendChild(_oCopyButton);


        _oGrid.appendChild(_oTile);

    }

};




/*********************************************************
 * @function - 화면 문구 적용(검색 placeholder / 결과없음). 부모가 메시지키로 전달.
 ********************************************************/
oAPP.fn.applyTexts = function(oTxt){

    oAPP.attr.TXT = oTxt || {};

    let _inp = document.getElementById("favSearchInp");
    if(_inp){
        let _ph = oAPP.attr.TXT.search || "";
        //오픈(재오픈)마다 검색어 초기화 — stale 필터 방지.
        _inp.value = "";
        _inp.placeholder = _ph;
        _inp.setAttribute("aria-label", _ph);
    }

    //clear 버튼 숨김(빈 값 기준).
    let _clr = document.getElementById("favSearchClr");
    if(_clr){ _clr.hidden = true; }

};




/*********************************************************
 * @function - 검색 이벤트 1회 배선(입력 debounce 필터 + clear + ESC).
 ********************************************************/
oAPP.fn.wireSearchOnce = function(){

    if(oAPP.attr._searchWired){ return; }

    let _inp = document.getElementById("favSearchInp");
    let _clr = document.getElementById("favSearchClr");
    if(!_inp){ return; }

    let _timer;

    //입력 → 경량 debounce 후 필터.
    _inp.addEventListener("input", function(){
        if(_clr){ _clr.hidden = (_inp.value === ""); }
        clearTimeout(_timer);
        _timer = setTimeout(oAPP.fn.refreshFilter, 80);
    });

    //ESC = 검색어 지우기(모달 닫힘과 충돌 방지 위해 전파 중단).
    _inp.addEventListener("keydown", function(ev){
        if(ev.key === "Escape" && _inp.value !== ""){
            ev.stopPropagation();
            _inp.value = "";
            if(_clr){ _clr.hidden = true; }
            oAPP.fn.refreshFilter();
        }
    });

    if(_clr){
        _clr.addEventListener("click", function(){
            _inp.value = "";
            _clr.hidden = true;
            oAPP.fn.refreshFilter();
            _inp.focus();
        });
    }

    oAPP.attr._searchWired = true;

};




/*********************************************************
 * @function - 현재 검색어로 타일 필터 + 카운트/결과없음 갱신.
 ********************************************************/
oAPP.fn.refreshFilter = function(){

    let _grid = document.getElementById("favGrid");
    if(!_grid){ return; }

    let _inp = document.getElementById("favSearchInp");
    let _q = (_inp && _inp.value ? _inp.value : "").trim().toLowerCase();

    let _tiles = _grid.children;
    let _total = _tiles.length;
    let _shown = 0;

    for(let i = 0; i < _total; i++){
        let _t = _tiles[i];
        let _match = (_q === "" || (_t._find && _t._find.indexOf(_q) !== -1));
        _t.hidden = !_match;
        if(_match){ _shown++; }
    }

    //카운트: 검색 중이면 'n / total', 아니면 total.
    let _cnt = document.getElementById("favCount");
    if(_cnt){
        _cnt.textContent = (_q === "") ? String(_total) : (_shown + " / " + _total);
    }

    //결과 없음 안내.
    let _empty = document.getElementById("favEmpty");
    if(_empty){
        let _none = (_shown === 0);
        _empty.textContent = _none ? ((oAPP.attr.TXT && oAPP.attr.TXT.noResult) ? oAPP.attr.TXT.noResult : "") : "";
        _empty.hidden = !_none;
        _grid.hidden = _none;
    }

};




/*********************************************************
 * @event - 타일 키보드 선택(Enter/Space = 더블클릭 선택과 동일).
 ********************************************************/
oAPP.onKeydownFavTile = function(oEvent){

    if(oEvent.key !== "Enter" && oEvent.key !== " " && oEvent.key !== "Spacebar"){ return; }

    oEvent.preventDefault();

    let _t = oEvent.currentTarget;
    if(!_t || typeof _t._sFavIconList === "undefined"){ return; }

    let _p = {};
    _p.ACTCD = "FAV_ICON_LIST_SEL_LINE";
    _p.sList = _t._sFavIconList;

    oAPP.fn.sendDataToParent(_p);

};




/*********************************************************
 * @event - 즐겨찾기 아이콘 리스트 더블클릭 이벤트.
 ********************************************************/
oAPP.onDblclickFavList = function(oEvent){

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    // //버튼 클릭에서 발생한 더블클릭 방지 타이머가 종료되지 않은경우 exit.
    // if(typeof oAPP.attr.clickTimmer !== "undefined"){
    //     return;
    // }

    //라인 데이터가 존재하지 않는경우 exit.
    if(typeof oEvent?.currentTarget?._sFavIconList === "undefined"){
        return;
    }

    let _sParam = {};

    //즐겨찾기 아이콘 리스트 라인 선택 액션코드.
    _sParam.ACTCD = "FAV_ICON_LIST_SEL_LINE";

    //선택한 라인 데이터 매핑.
    _sParam.sList = oEvent.currentTarget._sFavIconList;


    //즐겨찾기 팝업으로 데이터 전송 처리.
    oAPP.fn.sendDataToParent(_sParam);


};


/*********************************************************
 * @event - 아이콘 이름 복사 버튼 선택 이벤트.
 ********************************************************/
oAPP.onClipBoardTextCopy = async function(oEvent){

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    let _sFavIconList = oEvent?.currentTarget?._sFavIconList;

    // await new Promise(function(resolve){
    //     oAPP.attr.clickTimmer = setTimeout(function(){
    //         delete oAPP.attr.clickTimmer;
    //         resolve();
    //     },300);
    // });

    //라인 데이터가 존재하지 않는경우 exit.
    if(typeof _sFavIconList === "undefined"){
        return;
    }

    let _sParam = {};

    //즐겨찾기 아이콘 클립보드 카피 처리.
    _sParam.ACTCD = "FAV_ICON_CLIP_TXT_COPY";

    //선택한 라인 데이터 매핑.
    _sParam.sList = _sFavIconList;


    //즐겨찾기 팝업으로 데이터 전송 처리.
    oAPP.fn.sendDataToParent(_sParam);


};
