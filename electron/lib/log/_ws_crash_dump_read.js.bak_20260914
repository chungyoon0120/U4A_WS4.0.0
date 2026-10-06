/****************************************************************************************
 * 죽은 흔적 덩어리를 글로 풀어 읽기
 * --------------------------------------------------------------------------------------
 * 오류코드 접두: CDMP / 다음 번호: 004
 *
 * 왜 만들었나 (2026-09-10 — 장군님 지시 "AI 가 보고 판단할 수만 있으면 된다")
 *   죽는 순간 잡는 장치가 남기는 덩어리는 사람도 AI 도 못 읽는다.
 *   원래는 WinDbg 같은 전용 도구를 깔아야 열리는데, 고객사에서는 그럴 수 없다.
 *   그래서 **우리가 직접 읽어 글로 풀어** 크래시 보고서에 붙인다.
 *
 * 무엇을 얻나 (실제 파일로 확인함 2026-09-10)
 *   ① 터진 갈래 (허락 안 된 메모리를 건드림 / 바닥이 남 / 메모리가 모자람 …)
 *   ② 터진 주소가 **어느 파일 안인지** — ★남의 프로그램이 끼어들어 터뜨렸는지 여기서 보인다
 *   ③ 그때 실행 중이던 자리
 *   ④ 불러와 있던 파일 목록과 판 — 그래픽 도구·백신이 낀 것이 보인다
 *   ⑤ 죽는 순간 잡는 장치가 같이 적어 둔 값 (어느 프로세스인지, 메모리 여유, Electron 판)
 *
 * 못 얻는 것
 *   우리가 짠 자바스크립트의 함수 이름·줄 번호. 그건 로그와 보고서에서 찾는다.
 *   여기서 얻는 것은 "엔진이 어디서 터졌나" 까지다.
 *
 * ★느린 PC 를 위해 (2026-09-10 — 장군님 지시)
 *   덩어리 파일은 수십 MB 가 될 수 있다. **통째로 읽지 않는다.**
 *   필요한 토막만 골라 읽고, 읽은 양에 상한을 둔다(아래 MAX_READ_KB).
 *   느린 디스크에서 앱이 멈춰 보이는 일을 막기 위한 것이다.
 *   이 코드는 앱을 켤 때도 도는데, 통째로 읽으면 켜는 것 자체가 느려진다.
 *
 * 모양 근거
 *   윈도우 표준 덤프 모양(파일 앞 네 글자 MDMP). 자리 계산은 실제 파일로 하나씩 맞춰 봤다.
 *   ※ 죽는 순간 잡는 장치가 붙인 값의 한 칸 크기는 **12바이트**다(문서 아닌 실측).
 ****************************************************************************************/

const fs = require('fs');
const path = require('path');

/** 파일 앞 네 글자 */
const MAGIC = 'MDMP';

/** 묶음 종류 번호 */
const T_THREAD = 3;
const T_MODULE = 4;
const T_EXCEPTION = 6;
const T_SYSTEM = 7;
const T_CRASHPAD = 0x43500001;

/** 한 번에 읽어 오는 토막 크기 · 최대 읽을 양 (느린 PC 에서 앱이 멈추지 않게) */
const CHUNK = 8 * 1024;
const MAX_READ_KB = 2048;                                  // 2MB 를 넘겨 읽지 않는다
const MAX_CHUNKS = Math.floor(MAX_READ_KB * 1024 / CHUNK);

/** 이름 하나가 이보다 길면 깨진 파일로 본다 */
const MAX_NAME_BYTES = 4096;

/** 몇 개까지만 적는다 — 보고서가 너무 길어지면 안 된다 */
const MAX_MODULES = 60;
const MAX_ANNOS = 30;

/** 터진 갈래 번호를 우리말로 */
const EXC_TEXT = {
    0xC0000005: 'ACCESS_VIOLATION - dereferenced an invalid pointer (by far the most common)',
    0xC0000006: 'IN_PAGE_ERROR - could not page code/data in from disk',
    0xC000001D: 'ILLEGAL_INSTRUCTION - executed bytes that are not a valid instruction',
    0xC0000025: 'NONCONTINUABLE_EXCEPTION - unrecoverable state',
    0xC0000026: 'INVALID_DISPOSITION - unknown exception handling request',
    0xC000008C: 'ARRAY_BOUNDS_EXCEEDED',
    0xC000008E: 'FLT_DIVIDE_BY_ZERO',
    0xC0000090: 'FLT_INVALID_OPERATION',
    0xC0000094: 'INT_DIVIDE_BY_ZERO',
    0xC00000FD: 'STACK_OVERFLOW - runaway recursion; look for a function calling itself',
    0xC0000135: 'DLL_NOT_FOUND - a required library is missing',
    0xC0000142: 'DLL_INIT_FAILED',
    0xC0000374: 'HEAP_CORRUPTION - fallout from an earlier bad memory write',
    0xC0000409: 'STACK_BUFFER_OVERRUN / __fastfail - a security check tripped',
    0xC0000602: 'FAIL_FAST_EXCEPTION - the process deliberately aborted',
    0x80000003: 'BREAKPOINT - a debug breakpoint was hit (usually deliberate)',
    0xE0000008: 'OUT_OF_MEMORY (Chromium OOM)',
    0x40000015: 'FATAL_APP_EXIT - process killed itself on purpose'
};

/****************************************************************************************
 * 파일에서 필요한 토막만 골라 읽는 도구
 * --------------------------------------------------------------------------------------
 * ★통째로 읽지 않는 이유 = 느린 PC. 덩어리가 50MB 여도 실제로 읽는 것은 몇백 KB 다.
 ****************************************************************************************/
/** 시각을 나라 말 안 타는 모양으로 (보고서를 읽는 것은 AI 다) */
function _fmtLocal(d) {

    try {

        const p = (n) => String(n).padStart(2, '0');

        return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate())
            + ' ' + p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());

    } catch (e) {
        return String(d);
    }

}

function _opener(sPath) {

    const fd = fs.openSync(sPath, 'r');
    const iSize = fs.fstatSync(fd).size;
    const oCache = new Map();

    let iChunksRead = 0;
    let bHitLimit = false;

    function chunk(i) {

        if (oCache.has(i)) { return oCache.get(i); }

        if (iChunksRead >= MAX_CHUNKS) {
            bHitLimit = true;
            return null;
        }

        const iOff = i * CHUNK;

        if (iOff >= iSize) { return null; }

        const iLen = Math.min(CHUNK, iSize - iOff);
        const b = Buffer.alloc(iLen);

        fs.readSync(fd, b, 0, iLen, iOff);

        oCache.set(i, b);
        iChunksRead++;

        return b;

    }

    /** 이 자리부터 이만큼 — 토막 경계를 넘으면 이어 붙인다. 못 읽으면 null */
    function read(rva, len) {

        if (!(rva >= 0) || !(len > 0) || (rva + len) > iSize) { return null; }

        const i0 = Math.floor(rva / CHUNK);
        const i1 = Math.floor((rva + len - 1) / CHUNK);

        if (i0 === i1) {

            const c = chunk(i0);

            if (!c) { return null; }

            const s = rva - i0 * CHUNK;

            return (s + len <= c.length) ? c.slice(s, s + len) : null;

        }

        const out = Buffer.alloc(len);
        let iDone = 0;

        for (let i = i0; i <= i1; i++) {

            const c = chunk(i);

            if (!c) { return null; }

            const from = Math.max(rva, i * CHUNK) - i * CHUNK;
            const n = Math.min(c.length - from, len - iDone);

            if (n <= 0) { return null; }

            c.copy(out, iDone, from, from + n);
            iDone += n;

        }

        return (iDone === len) ? out : null;

    }

    function u8(rva) { const b = read(rva, 1); return b ? b.readUInt8(0) : 0; }
    function u16(rva) { const b = read(rva, 2); return b ? b.readUInt16LE(0) : 0; }
    function u32(rva) { const b = read(rva, 4); return b ? b.readUInt32LE(0) : 0; }
    function u64(rva) { const b = read(rva, 8); return b ? b.readBigUInt64LE(0) : 0n; }

    /** 길이가 앞에 붙은 두바이트글자 (파일 이름) */
    function name16(rva) {

        if (!rva) { return ''; }

        const len = u32(rva);

        if (!(len > 0) || len > MAX_NAME_BYTES) { return ''; }

        const b = read(rva + 4, len);

        return b ? b.toString('utf16le') : '';

    }

    /** 길이가 앞에 붙은 보통글자 */
    function name8(rva) {

        if (!rva) { return ''; }

        const len = u32(rva);

        if (!(len > 0) || len > MAX_NAME_BYTES) { return ''; }

        const b = read(rva + 4, len);

        return b ? b.toString('utf8') : '';

    }

    return {
        size: iSize,
        read: read, u8: u8, u16: u16, u32: u32, u64: u64,
        name16: name16, name8: name8,
        readKB: function () { return Math.round(iChunksRead * CHUNK / 1024); },
        hitLimit: function () { return bHitLimit; },
        close: function () { try { fs.closeSync(fd); } catch (e) { } }
    };

}

/****************************************************************************************
 * 덩어리를 읽어 글로 돌려준다.
 * 못 읽으면 왜 못 읽었는지를 글로 돌려준다(빈 값을 돌려주지 않는다 — 조용히 넘어가면 안 된다).
 ****************************************************************************************/
function readDump(sPath) {

    const EOL = require('os').EOL;

    if (!sPath) {
        return '  (no crash dump was available - nothing to analyse)';
    }

    let R = null;

    try {

        if (!fs.existsSync(sPath)) {
            return '  (dump file is not there any more: ' + sPath + ')';
        }

        R = _opener(sPath);

    } catch (e) {
        console.error('[CDMP-001] could not open the crash dump.', e);
        return '  (could not open the dump file: ' + (e && e.message ? e.message : e) + ')';
    }

    try {

        const bHead = R.read(0, 32);

        if (!bHead || bHead.toString('ascii', 0, 4) !== MAGIC) {
            return '  (not a Windows minidump - first four bytes are not ' + MAGIC + ')';
        }

        const nStreams = bHead.readUInt32LE(8);
        const rvaDir = bHead.readUInt32LE(12);
        const tStamp = bHead.readUInt32LE(20);

        const S = {};

        for (let i = 0; i < nStreams && i < 64; i++) {

            const o = rvaDir + i * 12;
            const type = R.u32(o);

            if (!type) { continue; }

            S[type] = { size: R.u32(o + 4), rva: R.u32(o + 8) };

        }

        // ---- 불러와 있던 파일들 -------------------------------------------
        const aMods = [];

        if (S[T_MODULE]) {

            const n = R.u32(S[T_MODULE].rva);

            for (let i = 0; i < n && i < 500; i++) {

                const o = S[T_MODULE].rva + 4 + i * 108;
                const iBase = R.u64(o);

                if (!iBase) { continue; }

                const vMS = R.u32(o + 32);
                const vLS = R.u32(o + 36);

                aMods.push({
                    base: iBase,
                    size: BigInt(R.u32(o + 8)),
                    full: R.name16(R.u32(o + 20)),
                    ver: ((vMS >>> 16) & 0xffff) + '.' + (vMS & 0xffff) + '.'
                        + ((vLS >>> 16) & 0xffff) + '.' + (vLS & 0xffff)
                });

            }

        }

        const aByBase = aMods.slice().sort((x, y) => (x.base < y.base ? -1 : 1));

        function shortName(s) {
            return String(s).split('\\').pop() || '(unnamed)';
        }

        /** 이 주소가 어느 파일 안인지 */
        function whereIs(addr) {

            for (let i = 0; i < aByBase.length; i++) {

                const m = aByBase[i];

                if (addr >= m.base && addr < (m.base + m.size)) {
                    return shortName(m.full) + ' + 0x' + (addr - m.base).toString(16)
                        + '  (v' + m.ver + ')';
                }

            }

            return '<-- NOT INSIDE ANY LOADED MODULE (jumped into freed/unmapped memory)';

        }

        // ---- 글 만들기 ----------------------------------------------------
        let t = '';

        t += '  Dump file       : ' + path.basename(sPath)
            + '  (' + Math.round(R.size / 1024) + 'KB total, ' + R.readKB() + 'KB read)' + EOL;
        t += '  Written at      : ' + _fmtLocal(new Date(tStamp * 1000)) + EOL;

        // ---- 터진 내용 ----------------------------------------------------
        let iCrashTid = 0;

        if (S[T_EXCEPTION]) {

            const o = S[T_EXCEPTION].rva;

            iCrashTid = R.u32(o);

            const code = R.u32(o + 8);
            const addr = R.u64(o + 24);
            const nParam = R.u32(o + 32);

            t += EOL;
            t += '  EXCEPTION       : 0x' + code.toString(16).toUpperCase()
                + '  ' + (EXC_TEXT[code] || '(no known name)') + EOL;
            t += '  FAULTING MODULE : ' + whereIs(addr) + EOL;
            t += '     raw address  : 0x' + addr.toString(16) + EOL;

            /**
             * 허락 안 된 메모리를 건드린 경우, 딸린 값 두 개가 읽기였는지 쓰기였는지를 알려준다.
             * 첫째 0=읽다가, 1=쓰다가, 8=실행하려다. 둘째는 건드리려던 주소.
             */
            if (code === 0xC0000005 && nParam >= 2) {

                const kind = R.u64(o + 40);
                const at = R.u64(o + 48);

                t += '     operation    : '
                    + (kind === 0n ? 'read' : (kind === 1n ? 'write' : (kind === 8n ? 'execute' : '(' + kind + ')')))
                    + EOL;
                t += '     target addr  : 0x' + at.toString(16)
                    + (at < 0x10000n ? '   <-- near NULL: a required value was empty and used anyway' : '') + EOL;

            }

        }

        // ---- 그때 실행 중이던 자리 ----------------------------------------
        if (S[T_THREAD]) {

            const n = R.u32(S[T_THREAD].rva);

            t += EOL;
            t += '  Threads         : ' + n + EOL;

            for (let i = 0; i < n && i < 2000; i++) {

                const o = S[T_THREAD].rva + 4 + i * 48;

                if (R.u32(o) !== iCrashTid) { continue; }

                const ctxSize = R.u32(o + 40);
                const ctxRva = R.u32(o + 44);

                // 64비트 상태 기록에서 「지금 실행 중인 자리」 는 0xF8 자리에 있다
                if (ctxSize >= 0x100) {
                    t += '  Instruction ptr : ' + whereIs(R.u64(ctxRva + 0xF8)) + EOL;
                }

                break;

            }

        }

        // ---- 어떤 컴퓨터 --------------------------------------------------
        if (S[T_SYSTEM]) {

            const o = S[T_SYSTEM].rva;
            const arch = R.u16(o);

            t += '  Machine         : Windows ' + R.u32(o + 8) + '.' + R.u32(o + 12)
                + ' build ' + R.u32(o + 16)
                + ' / ' + (arch === 9 ? 'x64' : (arch === 0 ? 'x86' : 'arch ' + arch))
                + ' / ' + R.u8(o + 6) + ' CPUs' + EOL;

        }

        // ---- 죽는 순간 잡는 장치가 같이 적어 둔 값 -------------------------
        if (S[T_CRASHPAD]) {

            const cp = S[T_CRASHPAD].rva;

            // 판(4) + 보고서 번호(16) + 컴퓨터 번호(16) 다음이 값 주머니
            const rvaSimple = R.u32(cp + 40);
            const rvaModList = R.u32(cp + 48);

            const aPair = [];

            /** 이름=값 주머니 하나 */
            function eatDict(rva) {

                if (!rva) { return; }

                const n = R.u32(rva);

                for (let i = 0; i < n && i < 200 && aPair.length < MAX_ANNOS; i++) {

                    const o = rva + 4 + i * 8;
                    const k = R.name8(R.u32(o));

                    if (k) { aPair.push(k + ' = ' + R.name8(R.u32(o + 4))); }

                }

            }

            eatDict(rvaSimple);

            // 파일마다 붙은 값 — 한 칸 12바이트(실측)
            if (rvaModList) {

                const nm = R.u32(rvaModList);

                for (let i = 0; i < nm && i < 200; i++) {

                    const rvaInfo = R.u32(rvaModList + 4 + i * 12 + 8);

                    if (!rvaInfo) { continue; }

                    eatDict(R.u32(rvaInfo + 16));           // 이름=값 주머니

                    const rvaObj = R.u32(rvaInfo + 24);     // 이름붙은 값 목록

                    if (!rvaObj) { continue; }

                    const no = R.u32(rvaObj);

                    for (let k = 0; k < no && k < 200 && aPair.length < MAX_ANNOS; k++) {

                        const oo = rvaObj + 4 + k * 12;
                        const nm2 = R.name8(R.u32(oo));

                        // 종류 1 = 글자. 그 밖은 우리가 못 읽으니 건너뛴다.
                        if (R.u32(oo + 4) !== 1 || !nm2) { continue; }

                        aPair.push(nm2 + ' = ' + R.name8(R.u32(oo + 8)));

                    }

                }

            }

            if (aPair.length) {

                t += EOL;
                t += '  [CRASHPAD ANNOTATIONS]' + EOL;
                t += '   NOTE: process_type / ptype = renderer means a window died; browser means the main process died.' + EOL;

                for (let i = 0; i < aPair.length; i++) {
                    t += '     ' + aPair[i] + EOL;
                }

            }

        }

        // ---- 남의 프로그램이 끼어들었나 -----------------------------------
        if (aMods.length) {

            const aOther = [];

            /**
             * 우리 앱이 깔린 폴더 = 맨 첫 파일(앱 본체)이 있는 폴더.
             * 폴더 이름을 글자로 짐작하면(예: 이름에 u4a 가 들었나) 틀린다 — 실제로 틀렸다.
             */
            let sOurDir = '';

            if (aMods[0] && aMods[0].full) {
                sOurDir = String(aMods[0].full).toLowerCase();
                sOurDir = sOurDir.slice(0, sOurDir.lastIndexOf('\\') + 1);
            }

            for (let i = 0; i < aMods.length; i++) {

                const s = String(aMods[i].full).toLowerCase();

                if (!s) { continue; }

                // 윈도우가 준 것도, 우리 앱 폴더 것도 아니면 "끼어든 것"
                if (s.indexOf('\\windows\\') >= 0) { continue; }
                if (sOurDir && s.indexOf(sOurDir) === 0) { continue; }

                aOther.push(shortName(aMods[i].full) + '   v' + aMods[i].ver
                    + '   [' + aMods[i].full + ']');

            }

            t += EOL;
            t += '  [THIRD-PARTY MODULES INJECTED]  antivirus / GPU tools / screen recorders show up here' + EOL;

            if (aOther.length) {
                for (let i = 0; i < aOther.length; i++) { t += '     ' + aOther[i] + EOL; }
                t += '     -> if FAULTING MODULE above is one of these, this is NOT our code at fault.' + EOL;
            } else {
                t += '     (none - only Windows-supplied files and our own app files)' + EOL;
            }

            t += EOL;
            t += '  [LOADED MODULES (' + aMods.length + ')]' + EOL;

            const aShow = aByBase.slice(0, MAX_MODULES);

            for (let i = 0; i < aShow.length; i++) {
                t += '     ' + shortName(aShow[i].full) + '   v' + aShow[i].ver + EOL;
            }

            if (aMods.length > MAX_MODULES) {
                t += '     ... and ' + (aMods.length - MAX_MODULES) + ' more' + EOL;
            }

        }

        if (R.hitLimit()) {
            t += EOL;
            t += '  NOTE: read was capped at ' + MAX_READ_KB + 'KB (slow-disk safeguard) - some fields above may be blank.' + EOL;
        }

        return t;

    } catch (e) {
        console.error('[CDMP-002] the dump parser itself threw.', e);
        return '  (the dump parser itself threw: ' + (e && e.message ? e.message : e) + ')';
    } finally {

        try {
            if (R) { R.close(); }
        } catch (e) {
            console.error('[CDMP-003] could not close the dump file.', e);
        }

    }

}

module.exports = {
    readDump: readDump
};
