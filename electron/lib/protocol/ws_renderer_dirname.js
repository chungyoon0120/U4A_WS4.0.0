/****************************************************************************************
 * 화면(renderer) 의 __dirname · __filename 을 되살린다 — preload 로 먼저 돈다.
 * --------------------------------------------------------------------------------------
 * 오류코드 접두: PDIR / 다음 번호: 004
 *
 * 왜 만들었나 (2026-10-27):
 *   화면을 custom protocol(u4a-ws://) 로 띄우면 Electron 이 화면의 `__dirname` 을
 *   **자기 내부 경로**(…\electron.asar\renderer)로 넣는다. `file://` 일 때만 페이지 폴더였다.
 *   실측으로 확인했다 — 그래서 `PATH.join(__dirname, …)` 로 만든 경로가 전부 어긋나
 *   앱이 첫 화면에서 멈췄다.
 *
 *   화면 코드에서 `__dirname` 을 쓰는 자리가 **54개 파일 90줄**이라 자리마다 고치는 대신,
 *   **페이지가 뜨기 전에 값을 바로잡아** 기존 코드가 그대로 돌게 한다.
 *   (실측: preload 에서 `window.__dirname` 에 넣으면 그 뒤에 오는 `<script src>` 들이 그 값을 본다)
 *
 * 무엇을 하나:
 *   u4a-ws://app/<경로>/페이지.html → `__filename` = <www>\<경로>\페이지.html ·
 *   `__dirname` = 그 폴더. `file://` 때와 같은 값이 된다.
 *
 * ★★★[2026-10-30 장군님 지시] `require` · `module` 객체를 **조작하지 않는다.**
 *   「`require` 또는 `module` 객체를 조작하는 행위는 하지 말고 호출처 전수 검사해서
 *    커스텀 프로토콜 기반으로 절대경로 표시해야 된다」
 *   [걷어낸 것] 2026-10-29 에 넣었던 `window.module.filename` · `window.module.paths` 대입.
 *     그중 `module.paths` 는 `Module._nodeModulePaths` 라는 **Node 내부 API**(앞에 `_`)를 썼다 —
 *     버전이 올라가면 사라질 수 있어 위험했다.
 *   [그래서 먼저 한 일] `<script src>` 로 실린 화면 코드의 상대경로 `require('./…')` **9줄**을
 *     `require(PATH.join(__dirname, …))` 절대경로로 바꿨다(전수 검사 = 279줄 중 9줄).
 *   [확인] `module.paths` 는 2026-10-29 15:07 에 처음 넣었고 **그 전에도 앱이 돌았다** —
 *     `require('@electron/remote')` 같은 npm 모듈은 Electron 의 renderer require 가 스스로 찾는다.
 *   [남긴 것] `__filename` · `__dirname` 두 전역값. 화면 코드 54개 파일 90줄이 쓰고,
 *     **`module` 객체가 아니며 내부 API 도 안 쓴다.**
 *
 * 지키는 것:
 *   - u4a-ws 로 뜬 페이지에서만 손댄다. 다른 주소는 Electron 이 준 값을 그대로 둔다.
 *   - 이 파일 때문에 화면이 죽으면 안 된다. 실패하면 코드와 함께 남기고 그냥 지나간다.
 ****************************************************************************************/

const path = require('path');

const SCHEME = 'u4a-ws:';

/****************************************************************************************
 * 화면 파일이 있는 뿌리 폴더(www)를 이 파일 자리에서 거슬러 올라가 구한다.
 * 이 파일: <뿌리>/electron/lib/protocol/ws_renderer_dirname.js
 ****************************************************************************************/
function _getAppRoot() {

    return path.resolve(__dirname, '..', '..', '..', 'www');

}

/****************************************************************************************
 * 본체
 ****************************************************************************************/
(function () {

    let oUrl = null;

    try {
        oUrl = new URL(window.location.href);
    } catch (e) {
        console.warn('[PDIR] PDIR-001 | could not read location | ' + (e && e.message ? e.message : e));
        return;
    }

    if (oUrl.protocol !== SCHEME) {
        return;
    }

    let sPathname = '';

    try {
        sPathname = decodeURIComponent(oUrl.pathname);
    } catch (e) {
        console.warn('[PDIR] PDIR-002 | pathname decode failed | ' + oUrl.pathname);
        return;
    }

    while (sPathname.indexOf('/') === 0) {
        sPathname = sPathname.substring(1);
    }

    const sFullPath = path.join(_getAppRoot(), sPathname.split('/').join(path.sep));

    window.__filename = sFullPath;
    window.__dirname = path.dirname(sFullPath);

    /**
     * ★[2026-10-30 장군님 지시] 여기서 **`module` 객체를 건드리지 않는다.**
     *   종전에는 `window.module.filename` · `window.module.paths` 를 덮어써서
     *   `<script src>` 로 실린 화면 코드의 `require('./…')` 가 돌게 했다.
     *   지금은 그 호출처 **9줄을 `require(PATH.join(__dirname, …))` 절대경로로** 바꿨으므로
     *   이 조작이 필요 없다. 앞으로도 상대경로로 쓰지 말고 `__dirname` 을 붙여 쓴다.
     */

})();


/****************************************************************************************
 * UI5 와 Node 의 `require` 충돌 막기 — sub-frame(iframe) 에서만
 * --------------------------------------------------------------------------------------
 * 왜 만들었나 (2026-10-29 장군님 지시):
 *   서버가 주는 UI5 의 `sap/ui/thirdparty/URI.js` 는 UMD 라 **`require` 가 있으면 CommonJS 로**
 *   동작한다. iframe 에 Node 를 켜면(`nodeIntegrationInSubFrames`) 그 `require` 가 생기고,
 *   UI5 가 CommonJS 길로 꺾여 `Cannot find module './punycode'` 로 부팅이 통째로 깨진다
 *   (2026-10-29 아이콘 목록 창 실측).
 *
 * 무엇을 하나:
 *   sub-frame 에서만 `require`·`module`·`exports` 를 `window.__node` 에 담아 두고 지운다.
 *   UI5 부팅이 끝나면 화면 쪽에서 되살린다
 *   (`www/ws30/ws10_20/Popups/iconPrevPopup/index.js` 의 `onFrameLoadSuccess`).
 *
 *   원본도 같은 방식이다 —
 *   `U4A_WS3.0.0/www/ServerList_v2/ServerList.js:189` 「UI5와 Electron Node의 충돌 방지 로직」.
 *   되살리는 쪽은 `www/ws30/ws10_20/index.js` 의 `_restoreNodeGlobals()` 에 원래부터 있었다.
 *
 * 지키는 것:
 *   - 창 본체(main frame)는 건드리지 않는다. 거기서 지우면 화면 코드가 전부 깨진다.
 *   - Node 가 없는 frame 에서는 아무 일도 하지 않는다. 지금 `nodeIntegrationInSubFrames` 가
 *     켜진 창은 아이콘 목록 하나뿐이라, 다른 창의 iframe 은 이 가드에서 그대로 빠져나간다.
 ****************************************************************************************/
(function () {

    if (process.isMainFrame) {
        return;
    }

    if (typeof window.require !== 'function') {
        return;
    }

    window.__node = {
        require: window.require,
        module: window.module,
        exports: window.exports
    };

    window.require = undefined;
    window.module = undefined;
    window.exports = undefined;

    console.log('[PDIR] node globals stashed in a sub-frame so the UI5 bootstrap does not take the CommonJS path');

})();
