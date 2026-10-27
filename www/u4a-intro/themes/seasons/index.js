
/**
 * Seasons Theme Entry Module
 * ------------------------------------------------------------------
 * ▶ IntroRuntime 에서 선택된 "seasons" 테마의 실제 실행 모듈.
 * ▶ 계절(봄/여름/가을/겨울)에 따라 다른 HTML 인트로를 로딩한다.
 *
 * 역할:
 *   1. 현재 월 기준으로 시즌 결정
 *   2. BrowserWindow를 생성하여 풀스크린 인트로 표시
 *   3. index.html 로 params 전달
 *   4. stop() 호출 시 Renderer 에 종료 요청 → 애니메이션 종료 후 닫힘
 *
 * 구조:
 *   themes/seasons/
 *     ├─ spring/index.html
 *     ├─ summer/index.html
 *     ├─ autumn/index.html
 *     └─ winter/index.html
 *
 * IntroRuntime → 이 모듈(start/stop) → 실제 HTML 애니메이션 실행
 * ------------------------------------------------------------------
 */

const remote = require('@electron/remote');
const path   = require('path');

let oWindow; // 현재 인트로 BrowserWindow 인스턴스 참조


/**
 * 인트로 시작 (Seasons 테마 실행)
 * --------------------------------------------------------------
 * @param {Object} params
 *  - versn     : 버전 문자열 (예: "5.5.9")
 *  - splev     : 패치 레벨 (예: "8")
 *  - devTools  : DevTools 오픈 여부 (개발용)
 */
exports.start = async (params)=>{

   /**
    * 1️⃣ 현재 월 기준 시즌 결정
    * -----------------------------------------------------------
    * 3~5  : spring
    * 6~8  : summer
    * 9~11 : autumn
    * 12~2 : winter
    */
   const month = new Date().getMonth() + 1;

   let _seasonName;

   if (month >= 3 && month <= 5) _seasonName = 'spring';
   else if (month >= 6 && month <= 8) _seasonName = 'summer';
   else if (month >= 9 && month <= 11) _seasonName = 'autumn';
   else _seasonName = 'winter';

   if(params.devTools === true){
      _seasonName = params?.seasons ?? _seasonName;
   }

   // _seasonName = 'spring';

   /**
    * 2️⃣ Intro 전용 BrowserWindow 옵션
    * -----------------------------------------------------------
    * 일반 윈도우가 아니라 "Splash / Intro 전용 UI"
    */
   var _op = {
			// "alwaysOnTop":true,
         "fullscreen": true,       // 전체화면 인트로
         "transparent": true,      // 배경 투명 (CSS 영상 연출용)
         "frame": false,           // 기본 타이틀바 제거 (완전 커스텀 UI)
         "resizable": false,       // 사용자 크기 변경 금지
         "focusable": true,        // 포커스 강제 확보
         // "skipTaskbar": true,  // 작업표시줄에는 안 보이게 (선택사항)

         // "backgroundColor": '#00000000',
			"webPreferences":{
				"nodeIntegration":true,
				"enableRemoteModule":true,
				"contextIsolation": false,
				"nativeWindowOpen": true,
				"webSecurity": false,


			}
			
	};
   
   // 전달 파라미터 복사 (원본 보호)
   const _params = {...params};

   /**
    * 3️⃣ BrowserWindow 생성 + HTML 로딩
    * -----------------------------------------------------------
    * did-finish-load 이후에만 화면 제어 가능하므로 Promise로 대기
    */
   await new Promise((resv)=>{

      oWindow = new remote.BrowserWindow(_op);
      // oWindow.setIgnoreMouseEvents(false);
      oWindow.webContents.on('did-finish-load', function () {
         oWindow.setAlwaysOnTop(true, 'screen-saver');
         oWindow.focus(); // 포커스까지 강제로 가져옴
         return resv();

      });

      /**
       * 4️⃣ 시즌별 HTML 로딩
       * --------------------------------------------------------
       * params 를 query 로 전달 → Renderer 에서 decode 사용
       */
      // 2026-10-27 Electron 45: loadFile 을 쓰지 않는다. custom protocol 주소로 바꿔 loadURL 로 연다.
      oWindow.loadURL(
         remote.getGlobal("u4aToAppUrl")(
            toFilePath(path.join(__dirname, _seasonName, 'index.html')),
            {
               query: {
                  params: encodeURIComponent(JSON.stringify(_params))
               }
            }
         )
      );

      /**
       * 개발 모드일 경우 DevTools 자동 오픈
       */
      if(_params.devTools){
         // oWindow.webContents.openDevTools({ mode: 'detach' });
      }
      
   }); 

};


/**
 * 인트로 종료 요청
 * --------------------------------------------------------------
 * 바로 window.close() 하지 않는 이유:
 * Renderer 쪽 fade-out 애니메이션을 먼저 실행해야 하기 때문.
 *
 * 흐름:
 * stop()
 *   → IPC 'win:request-close' 전달
 *   → Renderer 에서 fade-out 수행
 *   → animationend 시 window.close()
 */
exports.stop = async ()=>{

   if(!oWindow){ return; }

   // 이미 닫힌 경우
   if (oWindow.isDestroyed()) {
      oWindow = null;
      return;
   }

   await new Promise((resv)=>{

      oWindow.on('close', (e) =>{
         oWindow = null;
         return resv();

      });

      // Renderer 에게 종료 요청 (애니메이션 후 닫기)
      // Renderer 살아있을 때만 IPC 보냄
      if (oWindow && !oWindow.isDestroyed() && oWindow.webContents && !oWindow.webContents.isDestroyed()) {
         oWindow.webContents.send('win:request-close', {});
      } else {
         return resv();
      }

   }); 

};



/**
 * Windows file:// 경로 보정 유틸
 * --------------------------------------------------------------
 * Electron loadFile 시 OS/환경에 따라
 * file:///D:/... 같은 경로가 문제를 일으킬 수 있어
 * 순수 파일 경로 형태로 정규화한다.
 *
 * @param {String} filePath
 * @returns {String} normalizedPath
 */
function toFilePath(filePath) {

   // file:// 제거
   let cleanPath = filePath.replace(/^file:[\/\\]+/i, '');

   // 백슬래시 → 슬래시
   cleanPath = cleanPath.replace(/\\/g, '/');

   // /D:/ 형태 → D:/ 형태 보정
   cleanPath = cleanPath.replace(/^\/([a-zA-Z]:)/, '$1');

   return cleanPath;
}