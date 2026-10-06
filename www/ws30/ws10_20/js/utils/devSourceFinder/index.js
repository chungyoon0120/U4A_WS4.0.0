/**
 * =================================================================================
 * [RND] DevSourceFinder - UI5 Control to VS Code Source Mapper
 * =================================================================================
 *
 * 1. 윈도우 환경 변수 설정 (Windows Environment Setup)
 *
 * 개발 환경의 로컬 소스 루트 경로를 시스템 환경 변수로 반드시 등록해야 합니다.
 *
 * - 변수명 : U4A_WS_LOCAL_ROOT
 * - 변수값 : 프로젝트의 로컬 물리 경로 (예: C:\U4A_Workspace\Project_01)
 *
 *
 * 2. 모듈 초기화 (Initialization)
 *
 * 이벤트를 바인딩할 대상 Window 객체를 주입하여 초기화합니다. 
 * window.onload 또는 UI5 attachInit 시점에 호출하는 것을 권장합니다.
 *
 * [Example - window.onload]
 * const DevSourceFinder = require(PATH.join(PATHINFO.JS_ROOT, "utils", "devSourceFinder"));
 *
 * window.onload = () => { 
 *   DevSourceFinder.init(window); 
 * };
 *
 * [Example - UI5 attachInit]
 * const DevSourceFinder = require(PATH.join(PATHINFO.JS_ROOT, "utils", "devSourceFinder"));
 *
 * sap.ui.getCore().attachInit(() => {
 *   DevSourceFinder.init(window);
 * });
 *
 *
 * 3. 소스 식별 정보 등록 (Source Tracking)
 *
 * 특정 컨트롤에서 소스로 점프할 수 있도록 식별 정보를 주입합니다. 
 * 컨트롤 생성 직후 또는 데이터 바인딩 로직 내에서 호출합니다.
 *
 * [Example]
 * const oButton = new sap.m.Button({ text: "Find Source" });
 * DevSourceFinder.setRunScriptPath(oButton); 
 *
 *
 * 4. [중요] 동적 스크립트 로딩 시 주의사항 (Dynamic Script Loading)
 *
 * jQuery.getScript() 또는 eval()을 사용하여 동적으로 스크립트를 실행하는 경우, 
 * StackTrace 분석을 위해 반드시 '//# sourceURL' 지시자를 포함해야 합니다.
 *
 * [Implementation Guide]
 * var sFilePath   = "path/to/your/script.js"; 
 * var sAbsoluteURL = new URL(sFilePath, window.location.href).href;
 * var sSourceURL   = "\n//# sourceURL=" + sAbsoluteURL;
 *
 * // 소스 데이터와 sourceURL 주석을 합쳐서 실행
 * window["eval"].call(window, sRawData + sSourceURL);
 *
 *
 * 5. 실행 및 사용 방법 (Usage)
 *
 * - 앱 실행 화면에서 [ Ctrl + 마우스 우클릭 ] 을 수행합니다.
 * - 해당 컨트롤 또는 상위 계층에 등록된 소스 경로가 존재할 경우, 
 * VS Code가 즉시 실행되며 해당 파일의 위치로 이동합니다.
 *
 * =================================================================================
 */
const REMOTE = require('@electron/remote');

/**
 * @class DevSourceFinder
 * @description [RND 전용] 주입된 Window 영역의 UI5 컨트롤을 식별하여 VS Code로 연결하는 모듈
 */
"use strict";

class DevSourceFinder {
    /**
     * UI5 컨트롤 내 소스 경로 식별을 위한 고유 키
     * @private
     */
    static _SOURCE_ID = "ws-runJsPath";

    /**
     * @static init
     * @description 파라미터로 전달된 특정 Window 영역에 이벤트를 등록함
     * @param {Window} targetWindow - 이벤트를 바인딩할 대상 영역 (window 또는 iframe.contentWindow)
     */
    static init(targetWindow) {
        // 1. 인자값 유효성 검증
        if (!targetWindow || !targetWindow.addEventListener) {
            console.error("[DevSourceFinder] no valid window object was passed");
            return;
        }

        const sLocalWorkspaceRoot = process?.env?.U4A_WS_LOCAL_ROOT;
        if (!sLocalWorkspaceRoot) {
            console.warn("[DevSourceFinder] env var 'U4A_WS_LOCAL_ROOT' not set - disabled");
            return;
        }

        // 2. 주입받은 targetWindow에 컨텍스트 메뉴 리스너 등록
        targetWindow.addEventListener('contextmenu', (e) => {

            if (!e.ctrlKey) return;

            e.preventDefault();
            e.stopImmediatePropagation();

            // 중요: 해당 targetWindow의 스코프에서 UI5 컨트롤을 찾아야 함
            const oTargetControl = this._findControlFromElement(e.target, targetWindow);
            if (!oTargetControl) return;

            const sSourcePath = this._resolveSourcePath(oTargetControl);
            
            if (sSourcePath) {
                console.log(`%c[Finder] %cFound Source Location: ${sSourcePath}`, "color: #007acc; font-weight: bold;", "color: inherit;");
                this._openInVsCode(sSourcePath);
            } else {
                console.warn("[Finder] no source identification info on the control");
            }
        }, true);

        console.log(`[RND] DevSourceFinder enabled for ${targetWindow.location.pathname}`);
    }

    /**
     * @static setRunScriptPath
     * @description 호출 지점 정보를 추출하여 컨트롤에 식별 데이터 저장
     */
    static setRunScriptPath(oControl) {

        if (!oControl || typeof oControl.data !== "function") return;

        const sLocalWorkspaceRoot = process?.env?.U4A_WS_LOCAL_ROOT;
        if (!sLocalWorkspaceRoot) return;

        const stack = new Error().stack;
        const matches = stack.match(/(https?|file|ms-appx|app):\/\/[^\s\)]+/g);
        if (!matches || matches.length < 1) return;

        let sCallerUrl = matches[0]; 
        const sBaseFolder = "www/";
        const iBaseIdx = sCallerUrl.indexOf(sBaseFolder);

        if (iBaseIdx !== -1) {
            sCallerUrl = sCallerUrl.substring(iBaseIdx);
        }

        const sNormalizedRoot = sLocalWorkspaceRoot.replace(/\/$/, "");
        const sNormalizedPath = sCallerUrl.replace(/^\//, "");
        const sVscUri = `vscode://file/${sNormalizedRoot}/${sNormalizedPath}`;

        const aExistingPaths = oControl.data(this._SOURCE_ID) || [];
        if (aExistingPaths.includes(sVscUri)) return;

        aExistingPaths.push(sVscUri);
        oControl.data(this._SOURCE_ID, aExistingPaths);
    }

    /**
     * @private _findControlFromElement
     * @description 주입된 window의 UI5 Core를 참조하여 컨트롤 식별 (Internal)
     */
    static _findControlFromElement(oElement, targetWindow) {
        if (!oElement || !targetWindow) return null;
        let oInstance = null;

        // 핵심: 주입된 영역의 sap 및 jQuery 객체 참조
        const sap = targetWindow.sap;

        if (oElement.id && sap?.ui?.getCore) {
            oInstance = sap.ui.getCore().byId(oElement.id);
        }

        if (!oInstance && sap?.ui?.core?.Element?.closestTo) {
            oInstance = sap.ui.core.Element.closestTo(oElement);
        }

        if (!oInstance && sap?.ui?.getCore && targetWindow.jQuery) {
            const sControlId = targetWindow.jQuery(oElement).closest("[data-sap-ui]").attr("id");
            oInstance = sap.ui.getCore().byId(sControlId);
        }

        return oInstance;
    }

    /**
     * @private _resolveSourcePath
     * @description 계층 구조 탐색 (Internal)
     */
    static _resolveSourcePath(oControl) {
        let oCurrent = oControl;
        while (oCurrent) {
            const aPaths = (typeof oCurrent.data === "function") ? oCurrent.data(this._SOURCE_ID) : null;
            if (Array.isArray(aPaths) && aPaths.length > 0) {
                return aPaths[0];
            }
            oCurrent = oCurrent.getParent?.() || null;
        }
        return null;
    }

    /**
     * @private _openInVsCode
     * @description 딥링크 실행 (Internal)
     */
    static _openInVsCode(sUri) {
        REMOTE.shell.openExternal(sUri);
    }
}

module.exports = DevSourceFinder;