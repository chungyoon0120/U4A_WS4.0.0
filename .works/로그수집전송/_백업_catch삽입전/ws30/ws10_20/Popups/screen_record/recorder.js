'use strict';

/**
 * @file recorder.js
 * @description 화면 녹화 핵심 로직.
 *
 * - desktopCapturer(via remote)로 화면 소스를 획득하고
 *   MediaRecorder + getUserMedia로 WebM 파일을 생성합니다.
 * - 렌더러 프로세스(control-panel.html)에서 require하여 사용합니다.
 * - AudioContext 기반 마이크 믹싱 지원: 녹화 중 실시간 ON/OFF 가능.
 *
 * @example
 *   const { createRecorder } = require('../recorder');
 *   const recorder = createRecorder();
 *   await recorder.start({ sourceId, outputPath, options });
 *
 *   // 녹화 중 마이크 활성화
 *   const { ok, reason } = await recorder.enableAudio();
 *
 *   // 녹화 중 마이크 비활성화
 *   recorder.disableAudio();
 *
 *   const result = await recorder.stop();
 *   // result => { filePath, duration, fileSize }
 */

const fs     = require('fs');
const path   = require('path');
const remote = require('@electron/remote');

/**
 * 새 레코더 인스턴스를 생성합니다.
 * @returns {RecorderInstance}
 */
function createRecorder() {

  /** @type {Object} 내부 상태 (전역 변수 대신 클로저 사용) */
  const _s = {
    // ── 비디오 ──────────────────────────────────────────────────────────────
    mediaRecorder : null,
    stream        : null,       // 화면 캡처 MediaStream
    writeStream   : null,
    outputPath    : null,
    startTime     : null,       // Date.now() at record start
    pausedMs      : 0,          // 누적 일시정지 시간 (ms)
    pauseStart    : null,       // 현재 일시정지 시작 시각
    pendingWrites : 0,          // 진행 중인 비동기 청크 쓰기 수
    endRequested  : false,      // stop() 호출 여부
    status        : 'idle',     // idle | recording | paused | stopped
    lockFd        : null,       // 파일 잠금용 추가 파일 디스크립터

    // ── 오디오 (마이크) ──────────────────────────────────────────────────────
    audioEnabled  : false,      // 마이크 현재 활성화 여부
    micStream     : null,       // 마이크 getUserMedia 스트림
    audioCtx      : null,       // AudioContext (항상 초기화)
    micSrcNode    : null,       // MediaStreamSourceNode (마이크 연결 시 생성)
    gainNode      : null,       // GainNode: 0=무음, 1=출력
    audioDest     : null,       // MediaStreamAudioDestinationNode
  };

  // ─────────────────────────────────────────────
  // Private helpers
  // ─────────────────────────────────────────────

  /**
   * writeStream을 안전하게 닫습니다.
   * 모든 비동기 청크 쓰기가 완료된 후에 end()를 호출합니다.
   */
  function _requestEnd() {
    _s.endRequested = true;
    if (_s.pendingWrites === 0 && _s.writeStream && !_s.writeStream.destroyed) {
      _s.writeStream.end();
    }
  }

  /**
   * 경과 시간 계산 (일시정지 시간 제외, ms)
   * @returns {number}
   */
  function _elapsed() {
    if (!_s.startTime) return 0;
    const currentPause = _s.pauseStart
      ? Date.now() - _s.pauseStart
      : 0;
    return Date.now() - _s.startTime - _s.pausedMs - currentPause;
  }

  /**
   * 오디오 관련 리소스를 모두 정리합니다.
   * MediaRecorder.onstop 에서 호출합니다.
   */
  function _cleanupAudio() {
    if (_s.micStream) {
      _s.micStream.getTracks().forEach(t => t.stop());
      _s.micStream = null;
    }
    if (_s.audioCtx && _s.audioCtx.state !== 'closed') {
      _s.audioCtx.close().catch(() => {});
    }
    _s.micSrcNode   = null;
    _s.gainNode     = null;
    _s.audioDest    = null;
    _s.audioCtx     = null;
    _s.audioEnabled = false;
  }

  // ─────────────────────────────────────────────
  // Public API
  // ─────────────────────────────────────────────

  /**
   * 화면 소스 목록을 가져옵니다.
   * @param {Object} [opts={}]
   * @param {Object} [opts.thumbnailSize] - { width, height }
   * @returns {Promise<DesktopCapturerSource[]>}
   */
  async function getSources(opts = {}) {
    return remote.desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: 320, height: 180 },
      ...opts,
    });
  }

  /**
   * 녹화를 시작합니다.
   *
   * AudioContext를 항상 초기화하여 녹화 스트림에 오디오 트랙을 포함합니다.
   * 마이크는 기본 OFF(gain=0) 상태이며, enableAudio() 호출 시 활성화됩니다.
   *
   * @param {Object} params
   * @param {string}          params.sourceId    - desktopCapturer 소스 ID
   * @param {string}          params.outputPath  - 저장할 .webm 파일 전체 경로
   * @param {Electron.Display}[params.display]   - 해상도 힌트용 디스플레이 정보
   * @param {Object}          [params.options]   - 추가 옵션
   * @param {number}          [params.options.frameRate=30]
   * @param {number}          [params.options.videoBitsPerSecond=2500000]
   * @param {number}          [params.options.audioBitsPerSecond=128000]
   * @param {number}          [params.options.timeslice=1000]
   * @param {string}          [params.options.videoFormat='webm-vp9']
   * @returns {Promise<void>}
   */
  async function start(params = {}) {
    if (_s.status === 'recording') return;

    const { sourceId, outputPath, display, options: recOpts = {} } = params;
    const {
      frameRate            = 30,
      videoBitsPerSecond   = 2500000,
      audioBitsPerSecond   = 128000,
      timeslice            = 1000,
      videoFormat          = 'webm-h264',
    } = recOpts;

    if (!sourceId)    throw new Error('[recorder] sourceId is required');
    if (!outputPath)  throw new Error('[recorder] outputPath is required');

    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    _s.outputPath    = outputPath;
    _s.pendingWrites = 0;
    _s.endRequested  = false;
    _s.lockFd        = null;
    _s.writeStream   = fs.createWriteStream(outputPath);

    // ── 화면 스트림 획득 ──────────────────────────────────────────────────────
    // desktopCapturer 는 모니터의 물리 해상도로 캡처하므로 maxWidth/maxHeight 도
    // 물리 픽셀(= bounds(DIP) × scaleFactor)로 지정해야 합니다.
    // DIP 값을 그대로 쓰면 배율 모니터(예: 125%)에서 캡처가 다운스케일됩니다.
    // scaleFactor 미제공 시 1 로 폴백하여 기존 동작과 동일하게 유지합니다.
    const scale = display?.scaleFactor || 1;
    const maxW  = Math.round((display?.bounds?.width  || 1920) * scale);
    const maxH  = Math.round((display?.bounds?.height || 1080) * scale);

    _s.stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        mandatory: {
          chromeMediaSource  : 'desktop',
          chromeMediaSourceId: sourceId,
          maxWidth           : maxW,
          maxHeight          : maxH,
          maxFrameRate       : frameRate,
        },
      },
    });

    // ── AudioContext 초기화 ───────────────────────────────────────────────────
    // gain=0: 기본 무음. enableAudio() 로 gain=1 전환.
    // MediaRecorder 스트림에 오디오 트랙을 포함시켜야 나중에 마이크 추가 가능.
    _s.audioCtx  = new (window.AudioContext || window.webkitAudioContext)();
    _s.gainNode  = _s.audioCtx.createGain();
    _s.gainNode.gain.value = 0;
    _s.audioDest = _s.audioCtx.createMediaStreamDestination();
    _s.gainNode.connect(_s.audioDest);

    // ── 스트림 조합: 화면 비디오 + AudioContext 오디오 트랙 ───────────────────
    const videoTrack = _s.stream.getVideoTracks()[0];
    const audioTrack = _s.audioDest.stream.getAudioTracks()[0];
    const combinedStream = audioTrack
      ? new MediaStream([videoTrack, audioTrack])
      : _s.stream;

    // ── 포맷 선택 (오디오 코덱 opus 포함) ────────────────────────────────────
    const FORMAT_MAP = {
      'webm-vp9' : 'video/webm;codecs=vp9,opus',
      'webm-vp8' : 'video/webm;codecs=vp8,opus',
      'webm-h264': 'video/webm;codecs=h264,opus',
    };
    const preferred = FORMAT_MAP[videoFormat] || 'video/webm;codecs=vp9,opus';
    const mimeType  = MediaRecorder.isTypeSupported(preferred)
      ? preferred
      : ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']
          .find(mt => MediaRecorder.isTypeSupported(mt)) || 'video/webm';

    _s.mediaRecorder = new MediaRecorder(combinedStream, { mimeType, videoBitsPerSecond, audioBitsPerSecond });

    // ── 청크 파일 기록 ────────────────────────────────────────────────────────
    _s.mediaRecorder.ondataavailable = async (event) => {
      if (event.data.size === 0 || _s.writeStream.destroyed) return;

      _s.pendingWrites++;
      try {
        const buf = Buffer.from(await event.data.arrayBuffer());
        if (!_s.writeStream.destroyed) {
          await new Promise((res, rej) => _s.writeStream.write(buf, err => err ? rej(err) : res()));
        }
      } finally {
        _s.pendingWrites--;
        if (_s.endRequested && _s.pendingWrites === 0 && !_s.writeStream.destroyed) {
          _s.writeStream.end();
        }
      }
    };

    _s.mediaRecorder.onstop = () => {
      _s.status = 'stopped';
      _s.stream.getTracks().forEach(t => t.stop());
      _cleanupAudio();
      if (_s.lockFd !== null) {
        try { fs.closeSync(_s.lockFd); } catch {}
        _s.lockFd = null;
      }
      _requestEnd();
    };

    // ── 시작 ─────────────────────────────────────────────────────────────────
    _s.startTime  = Date.now();
    _s.pausedMs   = 0;
    _s.pauseStart = null;
    _s.status     = 'recording';
    _s.mediaRecorder.start(timeslice);

    // 파일 잠금 (Best-Effort, 500ms 후 시도)
    setTimeout(() => {
      if (_s.status === 'recording' || _s.status === 'paused') {
        try { _s.lockFd = fs.openSync(outputPath, 'r'); } catch {}
      }
    }, 500);
  }

  /**
   * 녹화를 중지하고 파일 저장 결과를 반환합니다.
   * @returns {Promise<{filePath:string, duration:number, fileSize:number}|null>}
   */
  function stop() {
    return new Promise((resolve) => {
      if (_s.status !== 'recording' && _s.status !== 'paused') {
        resolve(null);
        return;
      }

      const duration = _elapsed();

      _s.writeStream.once('finish', () => {
        const fileSize = (() => {
          try { return fs.statSync(_s.outputPath).size; } catch { return 0; }
        })();
        resolve({ filePath: _s.outputPath, duration, fileSize });
      });

      if (_s.status === 'paused') {
        _s.mediaRecorder.resume();
      }
      _s.mediaRecorder.stop();
    });
  }

  /**
   * 녹화를 일시정지합니다.
   */
  function pause() {
    if (_s.status !== 'recording') return;
    _s.mediaRecorder.pause();
    _s.pauseStart = Date.now();
    _s.status = 'paused';
  }

  /**
   * 일시정지를 해제하고 녹화를 재개합니다.
   */
  function resume() {
    if (_s.status !== 'paused') return;
    _s.pausedMs  += Date.now() - (_s.pauseStart || Date.now());
    _s.pauseStart = null;
    _s.mediaRecorder.resume();
    _s.status = 'recording';
  }

  /**
   * 마이크를 활성화합니다 (녹화 중 실시간 ON).
   *
   * - 최초 호출 시 getUserMedia로 마이크 권한 요청 및 스트림 획득
   * - 두 번째 호출부터는 기존 스트림 재사용, gain 값만 변경
   * - 녹화 상태(recording|paused)에서만 동작
   *
   * @returns {Promise<{ok:boolean, reason?:string}>}
   */
  async function enableAudio() {
    if (_s.status !== 'recording' && _s.status !== 'paused') {
      return { ok: false, reason: 'not_recording' };
    }
    if (_s.audioEnabled) return { ok: true };
    if (!_s.audioCtx)    return { ok: false, reason: 'audio_context_unavailable' };

    try {
      if (!_s.micStream) {
        _s.micStream  = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        _s.micSrcNode = _s.audioCtx.createMediaStreamSource(_s.micStream);
        _s.micSrcNode.connect(_s.gainNode);
      }
      if (_s.audioCtx.state === 'suspended') {
        await _s.audioCtx.resume();
      }
      _s.gainNode.gain.setValueAtTime(1, _s.audioCtx.currentTime);
      _s.audioEnabled = true;
      return { ok: true };
    } catch (err) {
      return { ok: false, reason: err.message };
    }
  }

  /**
   * 마이크를 비활성화합니다 (녹화 중 실시간 OFF).
   *
   * GainNode gain을 0으로 설정하여 오디오 출력만 차단합니다.
   * 마이크 스트림은 유지되어 다시 enableAudio() 호출 시 즉각 재활성화됩니다.
   */
  function disableAudio() {
    if (!_s.audioEnabled || !_s.gainNode) return;
    _s.gainNode.gain.setValueAtTime(0, _s.audioCtx.currentTime);
    _s.audioEnabled = false;
  }

  /**
   * 현재 마이크 상태를 반환합니다.
   * @returns {'on'|'off'}
   */
  function getAudioStatus() {
    return _s.audioEnabled ? 'on' : 'off';
  }

  /**
   * 현재 경과 시간(ms)을 반환합니다 (일시정지 시간 제외).
   * @returns {number}
   */
  function getElapsedMs() {
    return _elapsed();
  }

  /**
   * 시작 시각 (Unix timestamp, ms)
   * @returns {number|null}
   */
  function getStartTime() {
    return _s.startTime;
  }

  /**
   * 누적 일시정지 시간(ms)
   * @returns {number}
   */
  function getPausedMs() {
    if (!_s.pauseStart) return _s.pausedMs;
    return _s.pausedMs + (Date.now() - _s.pauseStart);
  }

  /**
   * 현재 녹화 상태를 반환합니다.
   * @returns {'idle'|'recording'|'paused'|'stopped'}
   */
  function getStatus() {
    return _s.status;
  }

  return {
    getSources,
    start,
    stop,
    pause,
    resume,
    getElapsedMs,
    getStartTime,
    getPausedMs,
    getStatus,
    // 오디오 (마이크)
    enableAudio,
    disableAudio,
    getAudioStatus,
  };
}

module.exports = { createRecorder };
