// ============================================================
// recorder.js — コマ送り動画書き出し(WebCodecs + mp4-muxer)
// ============================================================
//
// 演出を実時計から切り離し、固定dt(既定30fps)でコマ送りしながら
// 各フレームを1枚のcanvasへ合成 → VideoEncoder(H.264)でエンコード →
// mp4-muxer で .mp4 にまとめてダウンロードする。完全にブラウザ内で完結し、
// レンダリング速度に関係なくカクつかない動画が得られる。
//
// 音声は未対応(無音mp4)。WebAudioがリアルタイムAPI依存のため、コマ送りと
// 同期したオフライン合成は別途の対応が必要。
//
// mp4-muxer は録画時のみ CDN から動的importする(通常起動は軽いまま)。

import { SFX } from './engine.js';

const MUXER_URL = 'https://cdn.jsdelivr.net/npm/mp4-muxer@5.2.1/+esm';

export function recorderSupported() {
  return typeof window.VideoEncoder === 'function' && typeof window.VideoFrame === 'function';
}

// 解像度に応じて使えるH.264コーデック文字列を選ぶ
async function pickCodec(width, height) {
  const pixels = width * height;
  // High/Main/Baseline × 解像度別レベル
  const levels = pixels > 2_100_000
    ? ['avc1.640033', 'avc1.4D4033', 'avc1.640032']   // ~4K (L5.1/5.0)
    : pixels > 1_000_000
      ? ['avc1.640028', 'avc1.4D4028', 'avc1.640029']  // ~1080p (L4.0/4.1)
      : ['avc1.640020', 'avc1.4D401F', 'avc1.42E01F']; // 〜720p (L3.x)
  for (const codec of levels) {
    try {
      const cfg = { codec, width, height, bitrate: 8_000_000, framerate: 30 };
      const res = await VideoEncoder.isConfigSupported(cfg);
      if (res && res.supported) return codec;
    } catch { /* try next */ }
  }
  return null;
}

export class FrameRecorder {
  constructor({ width, height, fps = 30, bitrate, audio = true, sampleRate = 48000 } = {}) {
    // H.264は偶数寸法が必要
    this.width = Math.round(width / 2) * 2;
    this.height = Math.round(height / 2) * 2;
    this.fps = fps;
    this.bitrate = bitrate || Math.min(60_000_000, Math.round(this.width * this.height * fps * 0.13));
    this.frameIndex = 0;
    this.encoder = null;
    this.muxer = null;
    this.audio = audio && typeof window.AudioEncoder === 'function' && typeof window.AudioData === 'function';
    this.sampleRate = sampleRate;
    this.hasAudio = false;
  }

  async init() {
    const codec = await pickCodec(this.width, this.height);
    if (!codec) throw new Error('この環境ではH.264エンコードに対応していません');
    this.codec = codec;

    // 音声(AAC)が使えるか確認
    if (this.audio) {
      try {
        const r = await AudioEncoder.isConfigSupported({
          codec: 'mp4a.40.2', sampleRate: this.sampleRate, numberOfChannels: 2, bitrate: 192_000,
        });
        this.hasAudio = !!(r && r.supported);
      } catch { this.hasAudio = false; }
    }

    const { Muxer, ArrayBufferTarget } = await import(/* @vite-ignore */ MUXER_URL);
    this._target = new ArrayBufferTarget();
    this.muxer = new Muxer({
      target: this._target,
      video: { codec: 'avc', width: this.width, height: this.height, frameRate: this.fps },
      ...(this.hasAudio ? { audio: { codec: 'aac', sampleRate: this.sampleRate, numberOfChannels: 2 } } : {}),
      fastStart: 'in-memory',
    });
    this.encoder = new VideoEncoder({
      output: (chunk, meta) => this.muxer.addVideoChunk(chunk, meta),
      error: (e) => { this._error = e; console.error('VideoEncoder error', e); },
    });
    this.encoder.configure({
      codec, width: this.width, height: this.height,
      bitrate: this.bitrate, framerate: this.fps,
      latencyMode: 'quality',
    });
    if (this.hasAudio) {
      this.audioEncoder = new AudioEncoder({
        output: (chunk, meta) => this.muxer.addAudioChunk(chunk, meta),
        error: (e) => { this._error = e; console.error('AudioEncoder error', e); },
      });
      this.audioEncoder.configure({
        codec: 'mp4a.40.2', sampleRate: this.sampleRate, numberOfChannels: 2, bitrate: 192_000,
      });
    }
  }

  // canvas(this.width×this.height)を1フレーム投入。バックプレッシャ制御込み。
  async addFrame(canvas) {
    if (this._error) throw this._error;
    const ts = Math.round((this.frameIndex * 1_000_000) / this.fps);
    const frame = new VideoFrame(canvas, { timestamp: ts, duration: Math.round(1_000_000 / this.fps) });
    // 2秒ごとにキーフレーム
    this.encoder.encode(frame, { keyFrame: this.frameIndex % (this.fps * 2) === 0 });
    frame.close();
    this.frameIndex++;
    while (this.encoder.encodeQueueSize > 10) {
      await new Promise(r => setTimeout(r, 4));
    }
  }

  // AudioBuffer(this.sampleRate)を音声トラックへエンコード
  async addAudio(buffer) {
    if (!this.hasAudio || !buffer || !this.audioEncoder) return;
    const sr = this.sampleRate;
    const numCh = 2;
    const len = buffer.length;
    const ch0 = buffer.getChannelData(0);
    const ch1 = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : ch0;
    const chunk = 4096;
    for (let off = 0; off < len; off += chunk) {
      if (this._error) throw this._error;
      const n = Math.min(chunk, len - off);
      const planar = new Float32Array(n * numCh);
      planar.set(ch0.subarray(off, off + n), 0);
      planar.set(ch1.subarray(off, off + n), n);
      const ad = new AudioData({
        format: 'f32-planar', sampleRate: sr, numberOfFrames: n, numberOfChannels: numCh,
        timestamp: Math.round((off / sr) * 1_000_000), data: planar,
      });
      this.audioEncoder.encode(ad);
      ad.close();
      while (this.audioEncoder.encodeQueueSize > 20) {
        await new Promise(r => setTimeout(r, 4));
      }
    }
  }

  async finish() {
    await this.encoder.flush();
    if (this.hasAudio && this.audioEncoder) await this.audioEncoder.flush();
    this.muxer.finalize();
    return new Blob([this._target.buffer], { type: 'video/mp4' });
  }

  get seconds() { return this.frameIndex / this.fps; }
}

// 録画中に記録した SFX イベント([{m, args, t}])を OfflineAudioContext で
// その時刻どおりに再スケジュールし、PCM(AudioBuffer)を生成する。
// コマ送り映像と完全同期した音声が得られる。
export async function renderAudio(events, duration, sampleRate = 48000) {
  const OfflineCtx = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  if (!OfflineCtx || !events || !events.length || duration <= 0) return null;
  const length = Math.max(1, Math.ceil(duration * sampleRate));
  const offline = new OfflineCtx(2, length, sampleRate);
  const sfx = new SFX();
  sfx.useContext(offline);
  for (const ev of events) {
    sfx._recTime = Math.max(0, ev.t);
    try { if (typeof sfx[ev.m] === 'function') sfx[ev.m](...ev.args); } catch { /* skip */ }
  }
  sfx._recTime = null;
  return await offline.startRendering();
}

// 1フレームを合成canvasへ描画。W×H は出力ピクセル(=録画論理サイズ)。
export function compositeFrame(g, { W, H, stageCanvas, fxCanvas, canvasTitles, cinema }) {
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, W, H);

  // 3D(WebGL) → 2Dエフェクト
  g.drawImage(stageCanvas, 0, 0, W, H);
  g.drawImage(fxCanvas, 0, 0, W, H);

  // ビネット: radial-gradient(ellipse at center, transparent 55%, rgba(0,0,5,.55) 100%)
  const cx = W / 2, cy = H / 2, outer = Math.hypot(W, H) / 2;
  const grad = g.createRadialGradient(cx, cy, 0, cx, cy, outer);
  grad.addColorStop(0, 'rgba(0,0,5,0)');
  grad.addColorStop(0.55, 'rgba(0,0,5,0)');
  grad.addColorStop(1, 'rgba(0,0,5,0.55)');
  g.fillStyle = grad;
  g.fillRect(0, 0, W, H);

  // レターボックス(cinema時、上下7vh)
  if (cinema) {
    const bh = 0.07 * H;
    g.fillStyle = '#000';
    g.fillRect(0, 0, W, bh);
    g.fillRect(0, H - bh, W, bh);
  }

  // タイトル(canvas版)
  canvasTitles.draw(g);
}

// 出力フォーマットに合わせたファイル名
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
