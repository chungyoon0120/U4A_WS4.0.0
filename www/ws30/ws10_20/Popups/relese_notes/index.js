
// 오류코드 접두: RELN / 다음 번호: 002
const remote = require('@electron/remote');
const path   = require('path');
const { EventEmitter } = require('events');

// ✅ EventEmitter 인스턴스 생성
const emitter = new EventEmitter();

let oWindow = undefined;

const ALLOWED_CHANNELS = [
    "openNewFeature",

];

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
function _toFilePath(filePath) {

   // file:// 제거
   let cleanPath = filePath.replace(/^file:[\/\\]+/i, '');

   // 백슬래시 → 슬래시
   cleanPath = cleanPath.replace(/\\/g, '/');

   // /D:/ 형태 → D:/ 형태 보정
   cleanPath = cleanPath.replace(/^\/([a-zA-Z]:)/, '$1');

   return cleanPath;
}


/**
 * Release Notes 창 열기
 * - 이미 열려있으면 포커스만 이동
 * - 창 내부에서 ipc-message 로 이벤트를 수신해 외부로 emit
 *
 * @param {Object} options
 * @param {String} options.theme        - 테마 (dark | light)
 * @param {String} options.language     - 언어 코드
 * @param {String} options.sessionkey   - webContents partition 키
 * @param {Object} options.service      - 서비스 호스트 및 파라미터
 * @returns {Promise<void>}             - 창 로드 완료 시 resolve
 */
function open(options={}){
    return new Promise(async (resolve)=>{

        // 이미 열려있으면 포커스만
        if (oWindow && !oWindow.isDestroyed()) {

            // ★ [2026-10-15, 장군님 지시] 이미 떠 있는 창을 다시 불렀을 때도 **호출한 창 가운데로 다시 놓는다.**
            //   종전에는 그 자리에 그대로 있어, 창을 구석으로 끌어 둔 뒤 다시 부르면 안 움직였다.
            //   다른 별창(fnDialogPopupOpener.js 의 「이미 열린 창이면 포커스만」 분기)과 같은 처리다.
            try { if (oWindow.isMinimized()) { oWindow.restore(); } }
            catch (e) { if (typeof U4ALOG !== "undefined" && U4ALOG.caught) { U4ALOG.caught(e); } }

            oWindow.show();

            _centerOnOpener();

            oWindow.focus();

            return resolve();
        }

        const _options = {
            ...options, 
            isdev: !remote.app.isPackaged,
            theme: options?.theme || 'dark',
        };

        const _backgroundColor = _options.theme === 'dark' ? '#1e1e1e' : '#ffffff';

        oWindow = new remote.BrowserWindow({
            height         : options?.height || 800,
            width          : options?.width  || 1000,
            minWidth       : 800,
            minHeight      : 600,
            title          : 'U4A WS3.0 Relese Notes',
            focusable      : true,
            skipTaskbar    : false,
            show           : false,
            autoHideMenuBar: true,
            backgroundColor: _backgroundColor,
            frame          : false,
            titleBarStyle  : 'hidden',
            webPreferences : {
                nodeIntegration   : true,
                enableRemoteModule: true,
                contextIsolation  : false,
                nativeWindowOpen  : true,
                webSecurity       : false,
                partition         : options.sessionkey,
                // ★ [2026-10-15, 장군님 지시] 별창 식별값 2개 — 이 둘이 **다 있어야** 별창으로 센다.
                //   공통 getSiblingWindows(js/ws_common.js)가 OBJTY 없는 창 · browserkey 가 다른 창을
                //   건너뛰므로, 종전에는 이 창이 별창 목록에서 통째로 빠져 있었다.
                //   그래서 확인창이 떠도 안 숨고(TODO 44) 뒤로가기 일괄 닫기에도 안 잡혔다.
                //   값은 부른 쪽(js/fnDialogPopupOpener.js 의 fnReleaseNotePopupOpenerV2)이 넘긴다.
                OBJTY             : options.objty,
                browserkey        : options.browserkey,
            },

        });

        // ★ [2026-10-15, 장군님 지시 TODO 57] 뜨는 자리 = 「호출한 창」 가운데.
        //   종전에는 자리 잡는 줄이 아예 없어 Electron 기본값인 모니터 한가운데에 떴다.
        //   ★**두 번 부른다** — 만든 직후와, 보이기 직전(`ready-to-show`).
        //    이 창은 show:false 로 만들고 **창 안에서 show()** 하므로, 열기가 끝난 뒤에 옮기면
        //    이미 보인 뒤라 늦다. `ready-to-show` 는 `show()` 보다 반드시 먼저 온다.
        function _centerOnOpener() {

            try {

                if (!oWindow || oWindow.isDestroyed()) { return; }

                const oOpener = remote.getCurrentWindow();

                if (!oOpener || oOpener.isDestroyed()) {
                    if (typeof U4ALOG !== "undefined" && U4ALOG.warn) {
                        U4ALOG.warn("GUARD_EXIT", "opener window", "release notes window stays at the screen center");
                    }
                    return;
                }

                const oBase = oOpener.getBounds(),
                      oSelf = oWindow.getBounds(),
                      oArea = remote.require("electron").screen.getDisplayMatching(oBase).workArea;

                let iX = Math.round(oBase.x + (oBase.width - oSelf.width) / 2),
                    iY = Math.round(oBase.y + (oBase.height - oSelf.height) / 2);

                // 화면(작업 영역) 밖으로 나가지 않게 가둔다.
                iX = Math.min(Math.max(iX, oArea.x), oArea.x + oArea.width - oSelf.width);
                iY = Math.min(Math.max(iY, oArea.y), oArea.y + oArea.height - oSelf.height);

                oWindow.setBounds({ x: iX, y: iY, width: oSelf.width, height: oSelf.height });

            } catch (e) {
                console.error("[RELN-001] centering the release notes window failed:", e && e.message, e);
                if (typeof U4ALOG !== "undefined" && U4ALOG.caught) { U4ALOG.caught(e); }
            }

        } // end of _centerOnOpener

        _centerOnOpener();                               // ① 만든 직후
        oWindow.once("ready-to-show", _centerOnOpener);  // ② 보이기 직전

        // 값이 안 넘어오면 위 효과가 조용히 사라지므로 흔적을 남긴다(동작은 종전대로 계속).
        if (!options.objty || !options.browserkey) {
            if (typeof U4ALOG !== "undefined" && U4ALOG.warn) {
                U4ALOG.warn("GUARD_EXIT", "objty/browserkey of release notes window",
                    "this window is left out of the sibling window list - it will not hide behind dialogs or close on back");
            }
        }

        // 로드 완료 시 resolve (개발 환경에서는 DevTools 자동 오픈)
        oWindow.webContents.on('did-finish-load', function () {

            if(!remote.app.isPackaged){
                oWindow.webContents.openDevTools({ mode: 'detach' });
            }

            resolve();

        });        

        // 렌더러에서 ipcRenderer.send() 로 발생한 메시지를 수신해 외부로 emit
        // ipcMain 대신 webContents 단위로 수신 → 이 창에서 온 메시지만 처리        
        oWindow.webContents.on('ipc-message', async (event, channel, ...args) => {
            
            if (!channel || !channel.trim()){ return; }

            if(channel === "openNewFeature"){
                // 입력받은 채널(channel)로 이벤트(emit)를 트리거하고 인자값들을 전송
                const _args = args[0] || {}; 
                _args.replyChannel = `${channel}:cb`;
                emitter.emit(channel, event.sender, _args); 
            
                // return event.sender.send(`${channel}:cb`, {aa:'aaaa'});  

            }
         
        });

        // 창 종료 시 리스너 정리
        oWindow.on('close', (e) =>{
            emitter.removeAllListeners();
            oWindow = undefined;

            if(!remote.app.isPackaged){
                // remote.getCurrentWindow().close();
            }

        });        


        // 2026-10-27 Electron 45: loadFile 을 쓰지 않는다. custom protocol 주소로 바꿔 loadURL 로 연다.
        oWindow.loadURL(
            remote.getGlobal("u4aToAppUrl")(
                _toFilePath(path.join(__dirname, 'views', 'index.html')),
                {
                    query: {
                        options: encodeURIComponent(JSON.stringify(_options))
                    }
                }
            )
        );


    });
    
}

// 릴리즈 노트 팝업 닫기
const close = function(){

    try {

        if(oWindow){
            oWindow.close();
        }
        
    } catch (error) {
        if (typeof U4ALOG !== "undefined" && U4ALOG.caught) { U4ALOG.caught(error); }
        
    }
}

// 현재 윈도우가 닫힐 때(새로고침 등) 브라우저 정리 (1회성)
window.addEventListener('pagehide', () => {
   close();
}, { once: true });

module.exports = {
    open,
    close,    
    /**
     * 이벤트를 등록하기 전에 해당 채널의 기존 리스너를 모두 제거하여
     * 중복 실행(이벤트 누적)을 원천 차단함
     */
    on: (channel, listener) => {
        if (emitter.listenerCount(channel) > 0) {
            emitter.removeAllListeners(channel);
        }
        return emitter.on(channel, listener);
    },
}