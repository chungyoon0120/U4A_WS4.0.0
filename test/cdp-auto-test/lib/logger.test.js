const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { formatLogLine, createLogger } = require('./logger');

test('formatLogLine은 [시각] [레벨] 메시지 형태로 만든다', () => {
    const line = formatLogLine('INFO', '반복 1회차 시작');
    assert.match(line, /^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] \[INFO\] 반복 1회차 시작$/);
});

test('createLogger는 콘솔과 파일에 같은 내용을 남긴다', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cdp-log-'));
    const logger = createLogger(dir);

    logger.info('시작');
    logger.error('콘솔오류 발생: 테스트');

    const fileText = fs.readFileSync(logger.filePath, 'utf8');
    assert.match(fileText, /\[INFO\] 시작/);
    assert.match(fileText, /\[ERROR\] 콘솔오류 발생: 테스트/);
});
