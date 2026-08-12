/**
 * @since   2026-06-12 01:36:51
 * @version v3.6.4-3
 * @author  PES
 * @description
 * 기존 테마 설정 진입 요청을 신규 테마 화면으로 연결한다.
 *
 */
(function () {
    "use strict";

    if (window.parent?.OptionPopupMain) {
        window.parent.OptionPopupMain.reloadActive();
        return;
    }

    location.href = "../theme/index.html";

})();
