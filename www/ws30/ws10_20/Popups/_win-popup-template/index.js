/************************************************************************
 * _win-popup-template/index.js — 별창 팝업 견본 본문.
 *   공통 컴포넌트로 UX 를 구성한다(U4AUI.*). 색은 tokens.css 토큰만.
 *   외부 셸(frame.js)의 oAPP(테마/Busy/IPC)은 parent.oAPP 로 접근한다.
 *
 *   착수 전 구조 승인 게이트(스펙 §6.0): 팝업 이름 확정 → UX 구조 스케치 →
 *   소유자 확인 → 승인 후 이 파일에서 화면을 구현한다. 임의 레이아웃 금지.
 ************************************************************************/
(function () {
    "use strict";

    // 예) 본문 컨테이너
    // var oBody = document.getElementById("tplBody");

    // TODO(견본): 공통 컴포넌트로 화면 구성. 예시(스펙 §6.2 용어표 참고):
    //   - 입력칸  : U4AUI.createField({ ... })
    //   - 콤보    : U4AUI.createSelect(aItems, sValue, fnChange)
    //   - 평면표  : U4AUI.makeDataTable(oHost, { columns, rows })   // 가상스크롤 기본 ON
    //   - 트리표  : U4AUI.makeColumnTree(oHost, { ... })            // 대량이면 virtual+펼침맵(§6.4)
    //   - 트리    : U4AUI.createTree({ ... })
    //   - 확인창  : U4AUI.confirm({ ... })
    //   결과 메시지는 부모 IPC 왕복 후 표시(스펙 §2.11). 색 하드코딩 금지.

})();
