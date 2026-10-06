(function(oAPP){
    "use strict";

    /********************************************************
     * 브로드 캐스트 이벤트 걸기
     ********************************************************/
    oAPP.fn.fnBroadCast_Attach_Event_Handler = function(){

        oAPP.attr.oMainBroad = new BroadcastChannel(`broadcast-to-child-window_${parent.getBrowserKey()}`);

        /**
         * 창끼리 주고받는 신호 로그 (2026-09-08 추가)
         * -------------------------------------------------------------------
         * 왜 넣었나: 이 앱은 창끼리 신호를 주고받아 움직인다.
         *           한 창이 보낸 신호 때문에 다른 창이 터지는 경우가 있는데,
         *           그 이어짐이 로그에 없어 원인을 못 이었다.
         * 무엇을 남기나: 무슨 신호를 보냈고 받았는지. 신호에 담긴 값은 안 남긴다.
         *
         * 보내는 쪽도 남긴다 — 원래 보내던 함수를 감싸서 덧댄다(원래 동작 그대로).
         */
        try {

            if (typeof U4ALOG !== "undefined" && !oAPP.attr.oMainBroad.__u4aLogWrapped) {

                var _fnOriginPost = oAPP.attr.oMainBroad.postMessage.bind(oAPP.attr.oMainBroad);

                oAPP.attr.oMainBroad.postMessage = function (oData) {

                    try {

                        /**
                         * 로딩 표시 켜고 끄는 신호는 안 남긴다 (2026-09-10 — 장군님 지시)
                         * 화면이 뜰 때마다 자동으로 오가는 것이라 사용자 행위가 아니고,
                         * 원인을 짚는 데도 쓸모가 없다. 14분에 892줄이 이것으로 찼다(실측).
                         */
                        var _sPrc = (oData && oData.PRCCD) ? String(oData.PRCCD) : "";

                        if (_sPrc === "BUSY_ON" || _sPrc === "BUSY_OFF") {
                            return _fnOriginPost.apply(this, arguments);
                        }

                        U4ALOG.info("창끼리 신호 보냄", _sPrc || "(no type)", "");
                    } catch (e) { if (typeof U4ALOG !== "undefined" && U4ALOG.caught) { U4ALOG.caught(e); } }

                    return _fnOriginPost(oData);

                };

                oAPP.attr.oMainBroad.__u4aLogWrapped = true;

            }

        } catch (e) {
            if (typeof U4ALOG !== "undefined" && U4ALOG.caught) { U4ALOG.caught(e); }
            // 로그 때문에 창끼리 신호가 막히면 안 된다.
        }

        oAPP.attr.oMainBroad.onmessage = function(oEvent){

            var _PRCCD = oEvent?.data?.PRCCD || undefined;

            // 창끼리 신호 로그 — 받은 쪽 (2026-09-08 추가)
            try {
                if (typeof U4ALOG !== "undefined") {
                    var _sRecv = (oEvent && oEvent.data && oEvent.data.PRCCD) ? String(oEvent.data.PRCCD) : "";
                    if (_sRecv !== "BUSY_ON" && _sRecv !== "BUSY_OFF") {
                        U4ALOG.info("창끼리 신호 받음", _PRCCD || "(no type)", "");
                    }
                }
            } catch (e) { if (typeof U4ALOG !== "undefined" && U4ALOG.caught) { U4ALOG.caught(e); } }

            if(typeof _PRCCD === "undefined"){
                return;
            }
    
            //프로세스에 따른 로직분기.
            switch (_PRCCD) {

                //BUSY ON을 요청 받은 경우.
                case "BUSY_ON":

                    //BUSY DIALOG를 호출하는경우.
                    if(oEvent?.data?.TYPE === "DIALOG"){

                        var _sOption = {};

                        _sOption.TITLE = oEvent?.data?.TITLE || "";
                        _sOption.DESC  = oEvent?.data?.DESC || "";

                        parent.setBusy("X", _sOption);

                        return;
                    }
                
                    parent.setBusy("X");
    
                    break;
    
                case "BUSY_OFF":

                    //BUSY OFF를 요청 받은 경우.
                    parent.setBusy("");
    
                    break;
    
                default:
                    break;
            }
    
        };

    }; // end of oAPP.fn.fnBroadCast_Attach_Event_Handler


})(oAPP);
