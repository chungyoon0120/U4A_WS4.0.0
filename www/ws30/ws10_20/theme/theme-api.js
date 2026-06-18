/************************************************************************
 * U4A Workspace — 테마 API shim (doc 12 §5.2)
 * ----------------------------------------------------------------------
 * UI5 테마 API 와 동일 시그니처로 내부만 CSS 변수 기반으로 동작.
 *   applyTheme(name)        → U4ATheme.apply(name)
 *   Parameters.get("--x")   → U4ATheme.param("--x")
 *   attachThemeChanged(fn)  → U4ATheme.onChange(fn)
 *
 * UI5 테마명(sap_horizon 등)은 5종 키로 매핑한다.
 ************************************************************************/
(function (global) {
    "use strict";

    // 기본 테마
    var DEFAULT_THEME = "horizon_white";

    /**
     * 이 스크립트(theme-api.js)의 디렉터리. 활성 테마 CSS 를 자기 위치 기준
     * (`./themes/{key}.css`)으로 동적 로드하기 위해 사용한다 → 화면(경로) 독립적.
     */
    var THEME_DIR = (function () {
        try {
            var s = document.currentScript && document.currentScript.src;
            return s ? s.replace(/\/[^\/]*$/, "") : "";
        } catch (e) { return ""; }
    })();

    /**
     * 활성 테마 CSS 보장 로드 (없으면 <link> 주입).
     * horizon_white 는 tokens.css(:root) 기본값이라 별도 CSS 불필요.
     * → 화면은 5종을 모두 로드할 필요 없이 활성 테마 1종만 로드한다.
     */
    function _ensureThemeCss(sKey) {
        if (!sKey || sKey === DEFAULT_THEME) { return; }
        if (document.querySelector('link[data-theme-css="' + sKey + '"]')) { return; }
        var l = document.createElement("link");
        l.rel = "stylesheet";
        l.href = (THEME_DIR ? THEME_DIR + "/" : "") + "themes/" + sKey + ".css";
        l.dataset.themeCss = sKey;
        document.head.appendChild(l);
    }

    /**
     * 테마 별칭 매핑 → 정식 data-theme 키.
     * 명명 규칙: {대표테마}_{색상의미} (예: horizon_white). 베이스 테마 확장 대비.
     *  - UI5 테마명(sap_horizon 등)
     *  - 레거시 5종 키(white/dark/purple/red/green)도 호환
     */
    var THEME_ALIAS = {
        // UI5 테마명
        "sap_horizon": "horizon_white",
        "sap_horizon_dark": "horizon_dark",
        "sap_horizon_hcb": "horizon_dark",
        "sap_horizon_hcw": "horizon_white",
        // 레거시 키
        "white": "horizon_white",
        "dark": "horizon_dark",
        "purple": "horizon_purple",
        "red": "horizon_red",
        "green": "horizon_green"
    };

    /**
     * [Bootstrap 데모 스킨] 테마별 틴트 맵 — 전 화면 공통(bootstrap-skin.css 의 짝).
     *  apply() 가 documentElement 에 data-sl-theme + 인라인 --u4a-/--sl- 변수를 세팅한다.
     *  (구: ServerList.js 의 THEME_MAP/applyBsTheme → 단일 출처로 theme-api 로 이관)
     */
    var SKIN_MAP = {
        horizon_white: { mode: "light", accent: "#0070f2", hover: "#0064d9", soft: "rgba(0,112,242,.14)", bar: "#354a5f", bar2: "#2c5a7a" },
        horizon_dark: { mode: "dark", accent: "#3c93f5", hover: "#5aa6f7", soft: "rgba(60,147,245,.18)", bar: "#1b2a3a", bar2: "#22405e" },
        horizon_purple: { mode: "light", accent: "#7a3ff2", hover: "#6a2fe0", soft: "rgba(122,63,242,.16)", bar: "#4a2a6f", bar2: "#5e3491", bg: "#f6f2fe", surface: "#efe8fd", surface2: "#e7dcfb", border: "#e3d8f6" },
        horizon_red: { mode: "light", accent: "#e23b3b", hover: "#c92f2f", soft: "rgba(226,59,59,.15)", bar: "#6f2a2a", bar2: "#8c3030", bg: "#fdf4f4", surface: "#fbeaea", surface2: "#f7dcdc", border: "#f2d6d6" },
        horizon_green: { mode: "light", accent: "#1f9d57", hover: "#178047", soft: "rgba(31,157,87,.15)", bar: "#244d2c", bar2: "#2c6639", bg: "#f1faf4", surface: "#e6f5ec", surface2: "#d6eede", border: "#d3ead9" }
    };

    function _applySkin(sKey) {
        var oT = SKIN_MAP[sKey] || SKIN_MAP[DEFAULT_THEME];
        var oRoot = document.documentElement;
        oRoot.setAttribute("data-sl-theme", oT.mode);
        oRoot.style.setProperty("--u4a-accent", oT.accent);
        oRoot.style.setProperty("--u4a-accent-hover", oT.hover);
        oRoot.style.setProperty("--u4a-accent-soft", oT.soft);
        oRoot.style.setProperty("--u4a-titlebar-bg", oT.bar);
        oRoot.style.setProperty("--u4a-titlebar-bg2", oT.bar2 || oT.bar);
        var _v = function (sName, sVal) { if (sVal) { oRoot.style.setProperty(sName, sVal); } else { oRoot.style.removeProperty(sName); } };
        _v("--sl-bg", oT.bg); _v("--sl-surface", oT.surface); _v("--sl-surface-2", oT.surface2); _v("--sl-border", oT.border);
    }

    var U4ATheme = {

        THEMES: ["horizon_white", "horizon_dark", "horizon_purple", "horizon_red", "horizon_green"],

        /**
         * UI5 테마명 / 레거시 키 / 정식 키를 받아 data-theme 키로 정규화.
         * @param {string} name
         * @returns {string} 정식 테마 키 (기본 horizon_white)
         */
        normalize: function (name) {
            if (!name) {
                return DEFAULT_THEME;
            }
            if (this.THEMES.indexOf(name) !== -1) {
                return name;
            }
            if (THEME_ALIAS[name]) {
                return THEME_ALIAS[name];
            }
            return DEFAULT_THEME;
        },

        /** applyTheme() 대체 — 활성 테마 CSS 보장 로드 후 data-theme 전환 */
        apply: function (name) {
            var t = this.normalize(name);
            _ensureThemeCss(t);
            document.documentElement.dataset.theme = t;
            // Bootstrap 데모 스킨 틴트(전 화면 공통) — bootstrap-skin.css 가 소비.
            _applySkin(t);
            global.dispatchEvent(new CustomEvent("u4a-theme-changed", { detail: { name: t } }));
            return t;
        },

        /** 활성 테마 CSS 만 보장 로드 (data-theme 전환 없이) */
        ensureCss: function (name) {
            _ensureThemeCss(this.normalize(name));
        },

        /** 현재 적용된 테마 키 */
        current: function () {
            return document.documentElement.dataset.theme || DEFAULT_THEME;
        },

        /** Parameters.get() 대체 — 의미 토큰 값 조회 */
        param: function (varName) {
            return getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
        },

        /** attachThemeChanged 대체 */
        onChange: function (cb) {
            global.addEventListener("u4a-theme-changed", cb);
        }
    };

    global.U4ATheme = U4ATheme;

    // CommonJS(Electron nodeIntegration) 환경에서도 require 가능하게
    if (typeof module === "object" && module.exports) {
        module.exports = U4ATheme;
    }

})(typeof window !== "undefined" ? window : this);
