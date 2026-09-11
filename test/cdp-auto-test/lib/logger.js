'use strict';

const fs = require('fs');
const path = require('path');
const { getMachine } = require('./machine');

function formatLogLine(level, message) {
    const ts = new Date().toISOString();
    return `[${ts}] [${level}] ${message}`;
}

function _stamp() {
    const d = new Date();
    const p2 = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}${p2(d.getMonth() + 1)}${p2(d.getDate())}_`
        + `${p2(d.getHours())}${p2(d.getMinutes())}${p2(d.getSeconds())}`;
}

// 고장 났을 때 "그 직전에 무슨 일이 있었나" 를 보려면 최근 기록이 필요하다.
// 파일 전체를 다시 읽는 건 느리고 지저분하므로, 최근 몇 줄만 메모리에 들고 있는다.
const RECENT_KEEP = 300;

function createLogger(logDir) {
    fs.mkdirSync(logDir, { recursive: true });

    // 최근 줄 보관함 — 가득 차면 오래된 것부터 버린다.
    const recent = [];

    const stamp = _stamp();

    // ★어느 PC 에서 돌린 기록인지 파일 이름에도 박는다. (장군님 지시 2026-09-10)
    //   여러 PC 기록을 한 자리에 모아 놓으면 파일 이름만으로는 구분이 안 됐다.
    const oMachine = getMachine();
    const sPcSafe = String(oMachine.pc).replace(/[\/:*?"<>|s]+/g, '_').slice(0, 20);
    const filePath = path.join(logDir, `run_${sPcSafe}_${stamp}.log`);

    // ★오류 원문을 따로 이어붙이던 파일은 없앴다. (장군님 지시 2026-09-10)
    //   처음 오류에서 멈추도록 바뀐 뒤로는 쌓일 일이 없고, 사고가 나면 증거 폴더에
    //   「원문.json」 이 같은 내용으로 들어가 중복이었다. 이제는 여기서 들고만 있다가
    //   증거 폴더로 넘긴다.
    const aErrorDetails = [];

    function write(level, message) {
        const line = formatLogLine(level, message);
        if (level === 'ERROR') {
            console.error(line);
        } else {
            console.log(line);
        }
        fs.appendFileSync(filePath, line + '\n', 'utf8');

        recent.push(line);

        if (recent.length > RECENT_KEEP) {
            recent.shift();
        }
    }

    // 오류 한 건의 전체 내용(스택·파일·줄번호·원본 이벤트까지)을 들고 있는다.
    //   사고가 나면 증거 폴더에 통째로 넘긴다. 파일로 바로 쓰지 않는다.
    function errorDetail(obj) {

        try {
            aErrorDetails.push({ time: new Date().toISOString(), ...obj });
        } catch (e) {
            // 담다가 실패해도 조용히 넘기지 않고 최소한은 남긴다.
            aErrorDetails.push({
                time: new Date().toISOString(),
                kind: (obj && obj.kind) || 'unknown',
                담기실패: String(e && e.message ? e.message : e)
            });
        }

        // 너무 많이 쌓이면 메모리만 먹는다(--keepGoing 으로 길게 돌릴 때 대비).
        if (aErrorDetails.length > 200) {
            aErrorDetails.shift();
        }

    }

    // 이 기록이 어느 PC 것인지 맨 앞에 한 번 박아 둔다 — 기록을 모아 놓고 봐도 알아보게.
    write('INFO', `host=${oMachine.pc} user=${oMachine.user} node=${oMachine.node} os=${oMachine.os}`);

    return {
        machine: oMachine,
        info: (msg) => write('INFO', msg),
        error: (msg) => write('ERROR', msg),
        errorDetail,
        // 최근 기록을 통째로 꺼내 준다(사고 폴더에 같이 담으려고).
        getRecent: () => recent.slice(),
        // 여태 담아 둔 오류 원문을 통째로 꺼내 준다(사고 폴더에 같이 담으려고).
        getErrorDetails: () => aErrorDetails.slice(),
        filePath
    };
}

module.exports = { formatLogLine, createLogger };
