
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
            oWindow.show();
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
            },

        });

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


        oWindow.loadFile(
            _toFilePath(path.join(__dirname, 'views', 'index.html')),
            {
                query: {
                    options: encodeURIComponent(JSON.stringify(_options))
                }
            }
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