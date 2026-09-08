'use strict';

const fs = require('fs');
const path = require('path');

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

function createLogger(logDir) {
    fs.mkdirSync(logDir, { recursive: true });

    const stamp = _stamp();
    const filePath = path.join(logDir, `run_${stamp}.log`);
    // 사람이 읽는 로그와 별개로, 오류 원문을 통째로 담는 파일을 하나 더 둔다.
    // 한 줄에 오류 하나(JSON) — 나중에 AI/도구가 그대로 읽어서 분석할 수 있게.
    const errorFilePath = path.join(logDir, `run_${stamp}_errors.jsonl`);

    function write(level, message) {
        const line = formatLogLine(level, message);
        if (level === 'ERROR') {
            console.error(line);
        } else {
            console.log(line);
        }
        fs.appendFileSync(filePath, line + '\n', 'utf8');
    }

    // 오류 한 건의 전체 내용(스택·파일·줄번호·원본 이벤트까지)을 JSON 한 줄로 남긴다.
    function errorDetail(obj) {
        let line;
        try {
            line = JSON.stringify({ time: new Date().toISOString(), ...obj });
        } catch (e) {
            // 순환 참조 등으로 JSON 이 안 될 때도 조용히 넘기지 않고 최소한은 남긴다.
            line = JSON.stringify({
                time: new Date().toISOString(),
                kind: (obj && obj.kind) || 'unknown',
                jsonError: String(e && e.message ? e.message : e)
            });
        }
        fs.appendFileSync(errorFilePath, line + '\n', 'utf8');
    }

    return {
        info: (msg) => write('INFO', msg),
        error: (msg) => write('ERROR', msg),
        errorDetail,
        filePath,
        errorFilePath
    };
}

module.exports = { formatLogLine, createLogger };
