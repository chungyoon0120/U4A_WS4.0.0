/* 
*📦----------------------------------------------------------------------*
* Module       : index.js
* Creator      : SOCCERHS
* Created On   : 2026-04-01
* Description  : aModules 배열을 순차 실행하여, 개발 브라우저에 필요한 리소스 주입
*----------------------------------------------------------------------*
*/

/**
 * [Node.js Side] 주입할 외부 모듈 목록 정의
 */
const aModules = [
    { 
        name: "u4a_conf_source",  
        fn: require("./conf.js"),  
        desc: "브라우저 환경 설정 로드 중..." 
    },
    { 
        name: "u4a_util_source", 
        fn: require("./util.js"), 
        desc: "U4A 유틸리티 라이브러리 주입 중..." 
    },
    { 
        name: "u4a_main_source", 
        fn: require("./main.js"), 
        desc: "테스트 도구 메인 로직 실행 중..." 
    }
];

/**
 * [Browser Side] 초기화 실행 함수
 */
const init = async function (oInjectedProviders) {
    "use strict";

    // 1. 내부 설정값
    const oConfig = {
        isLoadingTest: false, // 개발 시 로딩 상태 확인용
        iLoadingTime : 3000
    };

    const _fnWaiting = (iTime = 1000) => {
        return new Promise(resolve => setTimeout(resolve, iTime));
    };

    // 2. UI 헬퍼 (Busy Indicator)
    const _uiHelper = {
        id: "u4a-dev-busy",
        msgId: "u4a-dev-busy-msg",
        
        show: function(sMsg) {
            let oDiv = document.getElementById(this.id);
            let oMsgDiv = document.getElementById(this.msgId);

            if (oDiv && oMsgDiv) {
                oMsgDiv.innerText = sMsg;
                return;
            }

            const oNewDiv = document.createElement("div");
            oNewDiv.id = this.id;
            oNewDiv.innerHTML = `
                <div style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);z-index:2147483647;display:flex;flex-direction:column;justify-content:center;align-items:center;color:white;font-family:'Malgun Gothic', sans-serif;">
                    <div style="width:50px;height:50px;border:5px solid #f3f3f3;border-top:5px solid #e74c3c;border-radius:50%;animation:u4aspin 1s linear infinite;"></div>
                    <div id="${this.msgId}" style="margin-top:20px;font-weight:bold;font-size:17px;text-shadow: 1px 1px 2px black;">${sMsg}</div>
                    <style>@keyframes u4aspin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }</style>
                </div>`;
            document.body.appendChild(oNewDiv);
        },

        hide: function() {
            const oDiv = document.getElementById(this.id);
            if (oDiv) {
                oDiv.remove();
            }
        }
    };

    /**
     * 🟢 실행 엔진: 모듈 자동 순차 로드
     */
    async function _onStart() {
        // [사전 체크] U4A 앱의 필수 HTML 요소가 있는지 확인
        const oHiddenArea = document.getElementById("U4A_HIDDEN_AREA");
        if (!oHiddenArea) {
            console.warn("[U4A Check] U4A run area not found (target page is not a U4A app)");
            return;
        }

        const u4adevb = window.u4adevb = window.u4adevb || {};
        
        // 중복 실행 방지
        if (u4adevb._injectRunning === true || u4adevb.initialized === true) {
            return;
        }

        try {
            u4adevb._injectRunning = true;
            _uiHelper.show("U4A 개발자 도구 구성 중...");

            // 등록된 모듈 순회 실행
            const aModuleKeys = Object.keys(oInjectedProviders);

            for (let i = 0; i < aModuleKeys.length; i++) {
                const sKey = aModuleKeys[i];
                const oModule = oInjectedProviders[sKey];

                // 현재 진행 상황 표시
                _uiHelper.show(oModule.desc);

                if (oConfig.isLoadingTest) {
                    await _fnWaiting(oConfig.iLoadingTime);
                }

                // 모듈 함수 실행
                if (typeof oModule.fn === "function") {
                    await oModule.fn();
                    console.log(`[Module Load] ${sKey} done`);
                }

                // [환경 확인] 유틸리티 로드 직후, 실제 U4A 라이브러리가 유효한지 최종 확인
                if (sKey === "u4a_util_source") {
                    const bIsU4AEnv = u4adevb?.util?.checkIsU4A?.();
                    if (!bIsU4AEnv) {
                        // "검증 실패" 대신 상황을 정확히 설명
                        throw new Error("현재 페이지는 U4A 모듈을 실행할 수 없는 환경입니다.");
                    }
                }
            }

            u4adevb.initialized = true;
            console.log("🔔 [U4A DevBot] all resources loaded");

        } catch (err) {
            console.error("❌ [Initialization Error]", err);
            // 사용자에게 정확한 실패 원인 공지
            _uiHelper.show("실행 불가: " + err.message);
            setTimeout(() => _uiHelper.hide(), 4000);
        } finally {
            u4adevb._injectRunning = false;
            // 에러가 없었을 때만 즉시 닫기 (에러 메시지 확인 시간 확보)
            if (u4adevb.initialized) {
                _uiHelper.hide();
            }
        }
    }

    // 문서 로드 상태 체크 후 실행
    if (document.readyState === "loading") {
        window.addEventListener("DOMContentLoaded", _onStart, { once: true });
    } else {
        await _onStart();
    }
};

/**
 * [Node.js Side] 주입 코드 조립
 */
const sModuleMapping = aModules.map(o => {
    return `"${o.name}": { 
        "desc": "${o.desc}", 
        "fn": ${o.fn.toString()} 
    }`;
}).join(",\n");

module.exports = `(function() {
    "use strict";
    const oInjectedProviders = { ${sModuleMapping} };
    (${init.toString()})(oInjectedProviders);
})();`;