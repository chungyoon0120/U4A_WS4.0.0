/****************************************************************************************
 * 앱이 뻗었을 때 처리
 * --------------------------------------------------------------------------------------
 * 오류코드 접두: CRSH / 다음 번호: 011
 *
 * 왜 만들었나 (2026-09-08)
 *   앱이 통째로 뻗으면 그 순간에는 아무것도 못 보낸다.
 *   그래서 ① 뻗었다는 사실을 남겨 두고 ② 다음에 켤 때 그때의 로그를 보낸다.
 *
 * 어떻게 아나
 *   앱을 켤 때 "돌고 있음" 표시 파일을 만들고, 정상으로 끝나면 지운다.
 *   다음에 켰을 때 그 표시가 남아 있으면 지난번에 비정상으로 끝난 것이다.
 *
 * 죽는 순간 잡는 장치(크래시 리포터)
 *   서버로 올리지 않고 그 컴퓨터에만 남긴다.
 *   남는 것은 사람도 AI도 못 읽는 덩어리라, "죽었다 + 그 시각"만 취한다.
 *   원인은 같이 보내는 로그 파일에서 찾는다.
 ****************************************************************************************/

const fs = require('fs');
const path = require('path');

let _app = null;
let _installed = false;
let _sMarkPath = '';        // "돌고 있음" 표시 파일
let _sCrashDir = '';        // 죽은 흔적이 쌓이는 폴더

/****************************************************************************************
 * 로그 폴더 (화면 쪽·앱 본체와 같은 규칙)
 ****************************************************************************************/
function _getLogFolder() {

    let baseDir = process.env.APPDATA;

    if (!baseDir) {
        baseDir = _app.getPath('appData');
    }

    const sFolder = path.join(baseDir, _app.getName(), 'logs');

    if (!fs.existsSync(sFolder)) {
        fs.mkdirSync(sFolder, { recursive: true });
    }

    return sFolder;

}

/****************************************************************************************
 * ① 죽는 순간 잡는 장치 켜기 — 서버로 안 올리고 그 컴퓨터에만 남긴다
 ****************************************************************************************/
function _startCrashReporter() {

    try {

        const { crashReporter } = require('electron');

        if (!crashReporter || typeof crashReporter.start !== 'function') {
            console.warn('[CRSH-001] 죽는 순간 잡는 장치를 쓸 수 없다 — 건너뛴다.');
            return;
        }

        /**
         * 흔적이 쌓이는 폴더를 로그 폴더 아래로 옮긴다(장군님 지시 2026-09-08).
         * 로그 폴더에 바로 두지 않는 이유: 이 장치가 자기 하위 폴더와 설정 파일을
         * 여러 개 만든다. 지금 로그 파일과 섞이면 3개월 정리 로직이 그것들까지 훑는다.
         */
        _sCrashDir = path.join(_getLogFolder(), 'crash');

        if (!fs.existsSync(_sCrashDir)) {
            fs.mkdirSync(_sCrashDir, { recursive: true });
        }

        _app.setPath('crashDumps', _sCrashDir);

        crashReporter.start({
            submitURL: '',            // 서버로 안 올린다
            uploadToServer: false,    // 그 컴퓨터에만 남긴다
            compress: false
        });

    } catch (e) {
        // 이 장치를 못 켜도 앱은 정상으로 돌아야 한다.
        console.error('[CRSH-002] 죽는 순간 잡는 장치를 켜지 못했다.', e);
    }

}

/****************************************************************************************
 * ② 죽는 순간에 같이 남길 값 채우기
 *   - 값 하나가 127바이트까지라 짧게 넣는다(공식 문서 확인).
 *   - 조작이 바뀔 때마다 갱신하면 죽는 순간의 마지막 상태가 남는다.
 ****************************************************************************************/
function setLastState(sKey, sValue) {

    try {

        const { crashReporter } = require('electron');

        if (!crashReporter || typeof crashReporter.addExtraParameter !== 'function') {
            return;
        }

        let s = String(sValue == null ? '' : sValue);

        // 127바이트를 넘으면 통째로 안 들어갈 수 있어 넉넉히 자른다
        if (Buffer.byteLength(s, 'utf8') > 120) {
            while (Buffer.byteLength(s, 'utf8') > 117 && s.length > 0) {
                s = s.slice(0, -1);
            }
            s += '…';
        }

        crashReporter.addExtraParameter(String(sKey).slice(0, 39), s);

    } catch (e) {
        // 값을 못 채워도 앱은 계속 간다.
    }

}

/****************************************************************************************
 * ③ "돌고 있음" 표시
 ****************************************************************************************/
function _markRunning() {

    try {

        _sMarkPath = path.join(_getLogFolder(), 'running.mark');

        fs.writeFileSync(_sMarkPath, JSON.stringify({
            시작시각: new Date().toISOString(),
            앱버전: _app.getVersion()
        }), 'utf8');

    } catch (e) {
        console.error('[CRSH-003] 돌고 있음 표시를 만들지 못했다.', e);
    }

}

function _clearRunningMark() {

    try {

        if (_sMarkPath && fs.existsSync(_sMarkPath)) {
            fs.unlinkSync(_sMarkPath);
        }

    } catch (e) {
        console.error('[CRSH-003] 돌고 있음 표시를 지우지 못했다.', e);
    }

}

/****************************************************************************************
 * ③-1 이미 보낸 흔적을 적어 두는 곳 (2026-09-08 추가 — 계획 11-3 의 6번)
 * --------------------------------------------------------------------------------------
 * 왜 필요한가
 *   흔적 파일은 그 자리에 계속 남는다. 표시를 안 해 두면 앱을 켤 때마다
 *   같은 것을 또 보내 방이 도배된다.
 ****************************************************************************************/
function _sentListPath() {
    return path.join(_getLogFolder(), 'crash_sent.json');
}

function _readSentList() {

    try {

        const sPath = _sentListPath();

        if (!fs.existsSync(sPath)) {
            return [];
        }

        const a = JSON.parse(fs.readFileSync(sPath, 'utf8'));

        return Array.isArray(a) ? a : [];

    } catch (e) {
        console.error('[CRSH-006] 이미 보낸 목록을 읽지 못했다.', e);
        return [];
    }

}

function _addSent(sName) {

    try {

        let a = _readSentList();

        if (a.indexOf(sName) < 0) {
            a.push(sName);
        }

        // 무한정 쌓이지 않게 최근 200건만 둔다
        if (a.length > 200) {
            a = a.slice(a.length - 200);
        }

        fs.writeFileSync(_sentListPath(), JSON.stringify(a), 'utf8');

    } catch (e) {
        console.error('[CRSH-007] 이미 보낸 목록을 적지 못했다.', e);
    }

}

/****************************************************************************************
 * ③-2 오래된 흔적 지우기 (2026-09-08 추가 — 계획 11-3 의 7번)
 * --------------------------------------------------------------------------------------
 * 로그 파일은 앱을 켤 때 3개월 지난 것을 지우는 자리가 이미 있다.
 * 흔적이 쌓이는 하위 폴더는 그 대상이 아니라 여기서 같은 기준으로 지운다.
 ****************************************************************************************/
const KEEP_DAYS = 90;

function _cleanOldCrashFiles() {

    try {

        const sDir = _sCrashDir || path.join(_getLogFolder(), 'crash');

        if (!sDir || !fs.existsSync(sDir)) {
            return;
        }

        const iLimit = Date.now() - (KEEP_DAYS * 24 * 60 * 60 * 1000);

        const walk = (sPath) => {

            const aNames = fs.readdirSync(sPath);

            for (let i = 0; i < aNames.length; i++) {

                const sFull = path.join(sPath, aNames[i]);
                let st = null;

                try {
                    st = fs.statSync(sFull);
                } catch (e) {
                    continue;
                }

                if (st.isDirectory()) {
                    walk(sFull);
                    continue;
                }

                if (st.mtimeMs < iLimit) {
                    try { fs.unlinkSync(sFull); } catch (e) { }
                }

            }

        };

        walk(sDir);

    } catch (e) {
        console.error('[CRSH-008] 오래된 흔적을 지우지 못했다.', e);
    }

}

/****************************************************************************************
 * ④ 지난번에 뻗었는지 보고, 뻗었으면 그때 로그를 보낸다
 ****************************************************************************************/
function _checkLastRun() {

    let oMark = null;

    try {

        const sMark = path.join(_getLogFolder(), 'running.mark');

        if (!fs.existsSync(sMark)) {
            return;   // 지난번에 정상으로 끝났다
        }

        try {
            oMark = JSON.parse(fs.readFileSync(sMark, 'utf8'));
        } catch (e) {
            oMark = {};
        }

    } catch (e) {
        console.error('[CRSH-004] 지난번 실행 상태를 읽지 못했다.', e);
        return;
    }

    // 죽은 흔적 파일이 있으면 그 시각을 뻗은 시점으로 본다
    let sCrashInfo = '(죽은 흔적 파일 없음)';
    let sCrashFile = '';

    try {

        const sReportDir = path.join(_sCrashDir || path.join(_getLogFolder(), 'crash'), 'reports');
        const sDir = fs.existsSync(sReportDir) ? sReportDir : _sCrashDir;

        if (sDir && fs.existsSync(sDir)) {

            const aFiles = fs.readdirSync(sDir)
                .map((f) => ({ name: f, full: path.join(sDir, f) }))
                .filter((f) => {
                    try { return fs.statSync(f.full).isFile(); } catch (e) { return false; }
                })
                .sort((a, b) => fs.statSync(b.full).mtimeMs - fs.statSync(a.full).mtimeMs);

            // 이미 보낸 것은 건너뛴다 (2026-09-08 추가 — 같은 것을 또 보내지 않게)
            const aSent = _readSentList();
            const aNew = aFiles.filter((f) => aSent.indexOf(f.name) < 0);

            if (aNew.length > 0) {
                const st = fs.statSync(aNew[0].full);
                sCrashInfo = '죽은 시각 ' + st.mtime.toLocaleString();
                sCrashFile = aNew[0].full;
            } else if (aFiles.length > 0) {
                sCrashInfo = '(죽은 흔적은 있으나 이미 보낸 것이다)';
            }

        }

    } catch (e) {
        console.error('[CRSH-005] 죽은 흔적을 확인하지 못했다.', e);
    }

    // 로그에 남긴다
    let WsMainLog = null;

    try {
        WsMainLog = require('./ws_main_log');
    } catch (e) { }

    const sText = '지난번 실행이 비정상으로 끝났다 — '
        + '시작 ' + (oMark && oMark.시작시각 ? oMark.시작시각 : '(모름)')
        + ' / ' + sCrashInfo;

    if (WsMainLog) {
        WsMainLog.writeLog('치명', sText);
    }

    // 죽은 흔적을 로그 폴더에 알아보기 쉬운 이름으로 옮겨 담는다(장군님 지시)
    let sCopied = '';

    if (sCrashFile) {

        try {

            const d = new Date();
            const sStamp = d.getFullYear()
                + String(d.getMonth() + 1).padStart(2, '0')
                + String(d.getDate()).padStart(2, '0') + '_'
                + String(d.getHours()).padStart(2, '0')
                + String(d.getMinutes()).padStart(2, '0');

            sCopied = path.join(_getLogFolder(), 'crash-report_' + sStamp + path.extname(sCrashFile));

            fs.copyFileSync(sCrashFile, sCopied);

            if (WsMainLog) {
                WsMainLog.writeLog('치명', '죽은 흔적을 옮겨 담음: ' + sCopied);
            }

            _addSent(path.basename(sCrashFile));   // 이 흔적은 처리했다고 적어 둔다

        } catch (e) {
            console.error('[CRSH-005] 죽은 흔적을 옮겨 담지 못했다.', e);
        }

    }

    // 그때의 로그를 보낸다
    try {

        require('./ws_telegram').sendError({
            kind: 'crash',
            errorCode: 'CRASH',
            message: sText,
            stack: '',
            screenName: '앱 전체',
            logFilePath: WsMainLog ? WsMainLog.getLogFilePath() : ''
        });

    } catch (e) {
        console.error('[CRSH-005] 뻗은 기록을 전송으로 넘기지 못했다.', e);
    }

}

/****************************************************************************************
 * 설치 — main.js 에서 부른다
 ****************************************************************************************/
function install(appInstance) {

    /**
     * ★포장한 앱에서만 돈다 (장군님 지시).
     * 개발로 돌릴 때는 화면 콘솔로 보면 되므로 파일에 쌓지도, 밖으로 보내지도 않는다.
     * 2026-09-08: 이 조건이 빠져 있어 개발 실행에서도 그대로 돌고 있었다(실제 로그로 확인).
     */
    if (!appInstance || !appInstance.isPackaged) {
        return;
    }

    if (_installed) {
        return;
    }

    _installed = true;
    _app = appInstance;

    _startCrashReporter();

    // 지난번 실행부터 확인하고(표시를 읽고) 그 다음에 이번 표시를 남긴다 — 순서 중요
    _checkLastRun();
    _markRunning();

    // 오래된 흔적 정리 — 로그 파일 지우는 기준(3개월)과 같게 맞춘다
    _cleanOldCrashFiles();

    /**
     * 정상 종료면 표시를 지운다.
     * -------------------------------------------------------------------
     * ★2026-09-08 보완 — 이것만으로는 한 번도 안 지워졌다(실제 로그: 시작 17번 / 종료 0번).
     *   이 앱은 서버 목록 화면의 닫기·종료에서 끝내는 함수를 직접 부르는데,
     *   그 함수는 아래 두 신호를 내지 않는다. 그래서 셋 다 건다.
     */
    _app.on('before-quit', _clearRunningMark);
    _app.on('will-quit', _clearRunningMark);

    // ① 끝내는 함수 자체를 감싼다 — 창에서 부르는 것도 결국 여기를 지난다
    try {

        if (typeof _app.exit === 'function' && !_app.__u4aExitWrapped) {

            const fnOriginExit = _app.exit.bind(_app);

            _app.exit = function () {

                try {

                    let WsMainLog = null;

                    try {
                        WsMainLog = require('./ws_main_log');
                    } catch (e) { }

                    if (WsMainLog) {
                        WsMainLog.writeLog('알림', '===== 앱 정상 종료 =====');
                    }

                } catch (e) {
                    // 로그를 못 남겨도 종료는 되어야 한다.
                }

                _clearRunningMark();

                return fnOriginExit.apply(null, arguments);   // 원래 동작 그대로

            };

            _app.__u4aExitWrapped = true;

        }

    } catch (e) {
        console.error('[CRSH-009] 끝내는 함수를 감싸지 못했다.', e);
    }

    // ② 프로세스가 끝나는 순간 한 번 더 — 위를 안 거치고 끝나는 길이 있어도 막는다
    try {
        process.on('exit', _clearRunningMark);
    } catch (e) {
        console.error('[CRSH-010] 프로세스 종료 자리를 걸지 못했다.', e);
    }

}

module.exports = {
    install: install,
    setLastState: setLastState
};
