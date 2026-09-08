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
    const filePath = path.join(logDir, `run_${_stamp()}.log`);

    function write(level, message) {
        const line = formatLogLine(level, message);
        if (level === 'ERROR') {
            console.error(line);
        } else {
            console.log(line);
        }
        fs.appendFileSync(filePath, line + '\n', 'utf8');
    }

    return {
        info: (msg) => write('INFO', msg),
        error: (msg) => write('ERROR', msg),
        filePath
    };
}

module.exports = { formatLogLine, createLogger };
