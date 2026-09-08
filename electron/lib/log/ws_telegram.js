/****************************************************************************************
 * 텔레그램 전송 (테스트 기간 전용)
 * --------------------------------------------------------------------------------------
 * 오류코드 접두: TGSD / 다음 번호: 010
 *
 * ★ 이 파일 하나만 끄면 전송이 전부 멈춘다 (장군님 지시 2026-09-08).
 *   테스트가 끝나면 설정 파일의 enabled 를 false 로 두거나 이 파일을 안 부르면 된다.
 *   로그를 파일에 남기는 일은 이 파일과 무관하게 계속 돈다.
 *
 * 설정 파일 위치
 *   - 패키징 후 : (설치 폴더)/resources/telegram_token.json   ← 압축 안 됨. 메모장으로 고치고 앱만 재시작
 *   - 개발 실행 : (프로젝트)/test/telegram_token.json
 *   파일이 없거나 토큰이 비어 있으면 → 보내지 않고 조용히 넘어간다(앱은 정상 동작).
 *
 * 보내는 방식
 *   텔레그램 봇 REST 규격(sendDocument)에 맞춰 파일을 첨부해 올린다.
 *   별도 패키지를 쓰지 않고 Node 기본 통신 기능으로 보낸다.
 ****************************************************************************************/

const fs = require('fs');
const path = require('path');
const https = require('https');
const os = require('os');

let _app = null;
let _config = null;
let _configPath = '';
let _installed = false;

let _sentCountToday = 0;
let _sentCountDate = '';
const _recentSend = {};   // 오류코드 → 마지막 전송 시각(도배 방지)
const _queue = [];        // 못 보낸 것
let _sending = false;

/****************************************************************************************
 * 설정 읽기
 ****************************************************************************************/
function _resolveConfigPath() {

    if (_app && _app.isPackaged) {
        return path.join(process.resourcesPath, 'telegram_token.json');
    }

    // 개발 실행 — electron/lib/log 에서 프로젝트 루트로 세 단계 올라간다
    return path.join(__dirname, '..', '..', '..', 'test', 'telegram_token.json');

}

function _loadConfig() {

    _configPath = _resolveConfigPath();

    if (!fs.existsSync(_configPath)) {
        console.warn('[TGSD-001] 텔레그램 설정 파일이 없다 — 전송하지 않는다. 경로: ' + _configPath);
        _config = null;
        return;
    }

    let sText = '';

    try {
        sText = fs.readFileSync(_configPath, 'utf8');
    } catch (e) {
        console.error('[TGSD-002] 텔레그램 설정 파일을 읽지 못했다 — 전송하지 않는다.', e);
        _config = null;
        return;
    }

    try {
        _config = JSON.parse(sText);
    } catch (e) {
        console.error('[TGSD-003] 텔레그램 설정 파일 형식이 잘못됐다 — 전송하지 않는다.', e);
        _config = null;
        return;
    }

}

/****************************************************************************************
 * 지금 보낼 수 있는 상태인가
 ****************************************************************************************/
function isEnabled() {

    if (!_config) {
        return false;
    }

    if (_config.enabled !== true) {
        return false;
    }

    return _getActiveTargets().length > 0;

}

/**
 * 보낼 곳 목록을 만든다.
 * 봇 토큰 하나로 여러 방에 보낼 수 있게 chatIds 를 방마다 한 건씩 펼친다.
 * (2026-09-08 장군님 지시 — 방을 여러 개 둘 수 있어야 한다)
 * 예전 형태(chatId 하나)도 그대로 읽는다.
 */
function _getActiveTargets(sKind) {

    if (!_config || !Array.isArray(_config.targets)) {
        return [];
    }

    const aOut = [];

    _config.targets.forEach((t) => {

        if (!t || t.enabled !== true) {
            return;
        }

        if (!t.botToken) {
            return;   // 봇 토큰이 아직 안 채워짐
        }

        if (sKind && Array.isArray(t.sendKinds) && t.sendKinds.length > 0) {
            if (t.sendKinds.indexOf(sKind) < 0) {
                return;
            }
        }

        // 방 목록 — 새 형태(chatIds 배열) 우선, 없으면 예전 형태(chatId 하나)
        let aRooms = [];

        if (Array.isArray(t.chatIds) && t.chatIds.length > 0) {
            aRooms = t.chatIds;
        } else if (t.chatId) {
            aRooms = [{ chatId: t.chatId, messageThreadId: t.messageThreadId || '' }];
        }

        aRooms.forEach((room) => {

            if (!room || !room.chatId) {
                return;   // 방 번호가 아직 안 채워짐
            }

            aOut.push({
                targetId: t.id || '',
                roomName: room.name || '',
                botToken: t.botToken,
                chatId: room.chatId,
                messageThreadId: room.messageThreadId || ''
            });

        });

    });

    return aOut;

}

/****************************************************************************************
 * 도배 방지에 쓸 열쇠 만들기 (2026-09-08 보완)
 * ---------------------------------------------------------------------------------------
 * 문제였던 것: 오류 코드가 앱 전체에서 하나뿐이라, 아무 오류나 한 번 보내면
 *             그 뒤 10분 동안 다른 어떤 오류도 안 나갔다.
 * 고친 방법  : 화면 이름 + 오류 문구 앞부분 + 난 자리 첫 줄로 열쇠를 만든다.
 *             그래서 "같은 오류"만 막히고 다른 오류는 바로 나간다.
 ****************************************************************************************/
function _makeMuteKey(oInfo) {

    if (!oInfo) {
        return '(내용없음)';
    }

    const sScreen = oInfo.screenName || '';
    const sMsg = String(oInfo.message || '').slice(0, 120);

    // 난 자리의 첫 줄만 — 같은 자리에서 반복되는 오류를 하나로 묶기 위해
    let sWhere = '';

    if (oInfo.stack) {
        sWhere = String(oInfo.stack).split(String.fromCharCode(10))[0].slice(0, 120);
    }

    return sScreen + '|' + sMsg + '|' + sWhere;

}

/****************************************************************************************
 * 도배 방지 · 하루 상한
 ****************************************************************************************/
function _passesLimit(sErrorCode) {

    const opt = (_config && _config.options) ? _config.options : {};

    // 하루 상한
    const sToday = new Date().toISOString().slice(0, 10);

    if (_sentCountDate !== sToday) {
        _sentCountDate = sToday;
        _sentCountToday = 0;
    }

    const iDailyLimit = typeof opt.dailySendLimit === 'number' ? opt.dailySendLimit : 200;

    if (_sentCountToday >= iDailyLimit) {
        console.warn('[TGSD-004] 하루 전송 상한을 넘어 보내지 않는다.');
        return false;
    }

    // 같은 오류 도배 방지
    const iMuteMin = typeof opt.sameErrorMuteMinutes === 'number' ? opt.sameErrorMuteMinutes : 10;
    const sKey = sErrorCode || '(코드없음)';
    const iLast = _recentSend[sKey] || 0;
    // ※ sErrorCode 는 이제 "화면 + 오류 문구"로 만들어진 값이다(_makeMuteKey).
    //    예전에는 모든 오류가 같은 값이라, 아무 오류나 하나 보내면 그 뒤 10분간 전부 막혔다.

    if (iLast && (Date.now() - iLast) < iMuteMin * 60 * 1000) {
        return false;
    }

    _recentSend[sKey] = Date.now();
    return true;

}

/****************************************************************************************
 * 가릴 것 가리기 (2026-09-08 추가)
 * ---------------------------------------------------------------------------------------
 * 보내기 직전에 한 번 더 훑어, 비밀번호·접속 열쇠 같은 것이 섞여 있으면 지운다.
 * 로그에 애초에 안 남기는 것이 원칙이지만, 어디선가 새어 들어올 수 있어 마지막 방어선을 둔다.
 ****************************************************************************************/
function _maskSecrets(sText) {

    if (!sText) {
        return sText;
    }

    let s = String(sText);

    try {

        // ① 이름표가 붙은 값 — 비밀번호·열쇠 종류
        s = s.replace(
            /((?:password|passwd|pwd|비밀번호|token|apikey|api_key|secret|botToken)\s*[=:"']{1,3}\s*)([^\s,&"'}\]]+)/gi,
            '$1(가림)'
        );

        // ② 인증 표 — 'Bearer 값' 형태는 값까지 지운다
        s = s.replace(
            /((?:authorization|auth)\s*[=:"']{1,3}\s*)(?:bearer\s+)?([^\s,&"'}\]]+)/gi,
            '$1(가림)'
        );

        // ③ 주소 뒤에 붙은 값 — 세션·사용자 정보
        s = s.replace(
            /([?&](?:sessionKey|sessionkey|browserkey|USERINFO|userinfo|token|auth)=)([^&\s"']+)/gi,
            '$1(가림)'
        );

        // ④ 텔레그램 봇 열쇠 모양 — 긴 숫자 다음에 콜론, 그다음 긴 영문
        s = s.replace(/[0-9]{6,}:[A-Za-z0-9_\-]{30,}/g, '(가림)');

    } catch (e) {
        console.error('[TGSD-009] 가리기에 실패했다 — 보내지 않는다.', e);
        return null;   // 가리기에 실패하면 보내지 않는다(fail-closed)
    }

    return s;

}

/****************************************************************************************
 * 보낼 파일 만들기 — 당일 로그 파일의 끝부분을 잘라 담는다
 ****************************************************************************************/
function _buildSendFile(oInfo) {

    const iTailBytes = 200 * 1024;   // 끝에서 200KB

    let sHead = '';
    sHead += '===== U4A Workspace 오류 보고 =====' + os.EOL;
    sHead += '앱 버전   : ' + (_app ? _app.getVersion() : '-') + os.EOL;
    sHead += '윈도우    : ' + os.release() + ' / ' + process.arch + os.EOL;
    sHead += '창        : ' + (oInfo.windowName || '-') + os.EOL;
    sHead += '화면      : ' + (oInfo.screenName || '-') + os.EOL;
    sHead += '추적 번호 : ' + (oInfo.traceId || '-') + '   ← 로그에서 이 번호로 그 조작을 찾는다' + os.EOL;
    sHead += '오류 코드 : ' + (oInfo.errorCode || '-') + os.EOL;
    sHead += '오류 내용 : ' + (oInfo.message || '-') + os.EOL;
    sHead += '그때 화면 : ' + (oInfo.screenState || '-') + os.EOL;
    sHead += '난 자리   : ' + os.EOL + (oInfo.stack || '(스택 없음)') + os.EOL;
    sHead += '=================================' + os.EOL + os.EOL;
    sHead += '--- 아래는 로그 파일의 마지막 부분 ---' + os.EOL;

    let sTail = '(로그 파일을 읽지 못했다)';

    try {

        const sLogPath = oInfo.logFilePath;

        if (sLogPath && fs.existsSync(sLogPath)) {

            const stat = fs.statSync(sLogPath);
            const iStart = Math.max(0, stat.size - iTailBytes);
            const fd = fs.openSync(sLogPath, 'r');
            const buf = Buffer.alloc(Math.min(iTailBytes, stat.size));

            fs.readSync(fd, buf, 0, buf.length, iStart);
            fs.closeSync(fd);

            sTail = buf.toString('utf8');

            if (iStart > 0) {
                sTail = '(앞부분 생략됨)' + os.EOL + sTail;
            }

        }

    } catch (e) {
        console.error('[TGSD-005] 로그 파일 끝부분을 읽지 못했다.', e);
    }

    // 임시 파일로 저장
    let sOutPath = '';

    try {

        const sDir = path.join(path.dirname(oInfo.logFilePath || os.tmpdir()), 'send');

        if (!fs.existsSync(sDir)) {
            fs.mkdirSync(sDir, { recursive: true });
        }

        const d = new Date();
        const sStamp = d.getFullYear()
            + String(d.getMonth() + 1).padStart(2, '0')
            + String(d.getDate()).padStart(2, '0') + '_'
            + String(d.getHours()).padStart(2, '0')
            + String(d.getMinutes()).padStart(2, '0')
            + String(d.getSeconds()).padStart(2, '0');

        const sSafeCode = String(oInfo.errorCode || 'ERR').replace(/[^A-Za-z0-9_\-]/g, '');

        sOutPath = path.join(sDir, '오류_' + sStamp + '_' + sSafeCode + '.txt');

        // 보내기 전에 가릴 것을 가린다(2026-09-08). 실패하면 아예 안 보낸다.
        const sSafe = _maskSecrets(sHead + sTail);

        if (sSafe === null) {
            return '';
        }

        fs.writeFileSync(sOutPath, sSafe, { encoding: 'utf8' });

    } catch (e) {
        console.error('[TGSD-006] 보낼 파일을 만들지 못했다.', e);
        return '';
    }

    return sOutPath;

}

/****************************************************************************************
 * 텔레그램에 파일 첨부해 보내기 (REST sendDocument)
 ****************************************************************************************/
function _postDocument(oTarget, sFilePath, sCaption, fnDone) {

    const opt = (_config && _config.options) ? _config.options : {};
    const iTimeout = typeof opt.sendTimeoutMs === 'number' ? opt.sendTimeoutMs : 15000;

    let fileBuf = null;

    try {
        fileBuf = fs.readFileSync(sFilePath);
    } catch (e) {
        console.error('[TGSD-007] 보낼 파일을 읽지 못했다.', e);
        fnDone(false);
        return;
    }

    const sBoundary = '----U4AWSBoundary' + Date.now().toString(16);
    const sFileName = path.basename(sFilePath);

    const aParts = [];

    function pushField(sName, sValue) {
        aParts.push(Buffer.from(
            '--' + sBoundary + '\r\n'
            + 'Content-Disposition: form-data; name="' + sName + '"\r\n\r\n'
            + sValue + '\r\n', 'utf8'));
    }

    pushField('chat_id', String(oTarget.chatId));

    if (sCaption) {
        pushField('caption', sCaption);
    }

    if (oTarget.messageThreadId) {
        pushField('message_thread_id', String(oTarget.messageThreadId));
    }

    aParts.push(Buffer.from(
        '--' + sBoundary + '\r\n'
        + 'Content-Disposition: form-data; name="document"; filename="' + sFileName + '"\r\n'
        + 'Content-Type: text/plain; charset=utf-8\r\n\r\n', 'utf8'));

    aParts.push(fileBuf);
    aParts.push(Buffer.from('\r\n--' + sBoundary + '--\r\n', 'utf8'));

    const body = Buffer.concat(aParts);

    const req = https.request({
        method: 'POST',
        host: 'api.telegram.org',
        path: '/bot' + oTarget.botToken + '/sendDocument',
        headers: {
            'Content-Type': 'multipart/form-data; boundary=' + sBoundary,
            'Content-Length': body.length
        },
        timeout: iTimeout
    }, (res) => {

        let sRes = '';

        res.on('data', (chunk) => { sRes += chunk.toString('utf8'); });

        res.on('end', () => {

            if (res.statusCode >= 200 && res.statusCode < 300) {
                fnDone(true);
                return;
            }

            console.error('[TGSD-008] 텔레그램이 거절했다. 상태: ' + res.statusCode + ' / 응답: ' + sRes.slice(0, 300));
            fnDone(false);

        });

    });

    req.on('timeout', () => {
        console.error('[TGSD-008] 텔레그램 전송 시간 초과');
        req.destroy();
        fnDone(false);
    });

    req.on('error', (e) => {
        console.error('[TGSD-008] 텔레그램 전송 실패', e);
        fnDone(false);
    });

    req.write(body);
    req.end();

}

/****************************************************************************************
 * 전송 대기열 처리
 ****************************************************************************************/
function _drainQueue() {

    if (_sending) {
        return;
    }

    const item = _queue.shift();

    if (!item) {
        return;
    }

    _sending = true;

    const aTargets = _getActiveTargets(item.kind);

    if (aTargets.length === 0) {
        _sending = false;
        return;
    }

    let iLeft = aTargets.length;

    aTargets.forEach((t) => {

        _postDocument(t, item.filePath, item.caption, (bOk) => {

            if (bOk) {
                _sentCountToday++;
            } else if (item.retry < ((_config.options && _config.options.maxRetry) || 2)) {
                item.retry++;
                _queue.push(item);   // 다음 기회에 다시
            }

            iLeft--;

            if (iLeft <= 0) {
                _sending = false;
                setTimeout(_drainQueue, 500);
            }

        });

    });

}

/****************************************************************************************
 * 오류 한 건 보내기 — 밖에서 부르는 자리
 *   oInfo = { errorCode, message, stack, screenName, logFilePath, kind }
 *   kind  = 'error' | 'crash' | 'fatal'
 ****************************************************************************************/
function sendError(oInfo) {

    if (!oInfo) {
        return;
    }

    if (!isEnabled()) {
        return;   // 토큰이 아직 없거나 꺼져 있음 — 조용히 넘어간다
    }

    if (!_passesLimit(_makeMuteKey(oInfo))) {
        return;
    }

    // 화면 쪽에서 로그 파일 경로를 안 넘겨줬으면 앱 본체가 아는 경로를 쓴다
    if (!oInfo.logFilePath) {

        try {
            oInfo.logFilePath = require('./ws_main_log').getLogFilePath();
        } catch (e) {
            console.error('[TGSD-005] 로그 파일 경로를 알아내지 못했다.', e);
        }

    }

    const sFilePath = _buildSendFile(oInfo);

    if (!sFilePath) {
        return;
    }

    const sCaption = (oInfo.screenName || '화면 미상') + ' / ' + (oInfo.errorCode || '코드 없음');

    _queue.push({
        filePath: sFilePath,
        caption: sCaption,
        kind: oInfo.kind || 'error',
        retry: 0
    });

    _drainQueue();

}

/****************************************************************************************
 * 설치 — 앱 본체에서 한 번 부른다
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

    _loadConfig();

    // 화면 쪽에서 부를 수 있게 통로를 연다
    try {

        const { ipcMain } = require('electron');

        ipcMain.on('u4a-log:send-error', (event, oInfo) => {
            sendError(oInfo);
        });

    } catch (e) {
        console.error('[TGSD-001] 화면 쪽 전송 통로를 열지 못했다.', e);
    }

}

module.exports = {
    install: install,
    sendError: sendError,
    isEnabled: isEnabled,
    getConfigPath: () => _configPath
};
