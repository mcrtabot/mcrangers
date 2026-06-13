// ============================================================
// CanvasTitles — 録画用のタイトルオーバーレイ(canvas描画版)
// ============================================================
//
// ライブ表示は engine.js の Titles(DOM/CSS)が担当するが、動画録画では
// すべてを1枚のcanvasへ合成する必要がある。DOM要素はcanvasに取り込めず、
// CSSアニメーションも実時計依存でコマ送りと同期できないため、録画時だけ
// この CanvasTitles を ctx.titles に差し替えて使う。
//
// Titles と同じAPI(kicker / name / teamTitle / bubble / moveBubble /
// clearBubble / clear / out)を提供し、Director/Scene 側は無改造で動く。
// 時刻はエンジンの累積時間で駆動する(recorder が毎フレーム now を更新)。
//
// CSSの見た目を完全再現はしないが、フォント・色・発光・スラム/スライド/
// ライズの動きを近似して「演出付きでタイトルが出る」状態を再現する。

const FONT_TITLE = "'Reggae One', serif";
const FONT_SUB = "'DotGothic16', monospace";

// CSS keyframes に対応するイージング(近似)
function easeOutBack(t) {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}
function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
function lerp(a, b, t) { return a + (b - a) * t; }

// 多段キーフレームの線形補間 [[pos,val],...]
function keyframe(stops, p) {
  if (p <= stops[0][0]) return stops[0][1];
  for (let i = 1; i < stops.length; i++) {
    if (p <= stops[i][0]) {
      const [p0, v0] = stops[i - 1], [p1, v1] = stops[i];
      return lerp(v0, v1, (p - p0) / (p1 - p0));
    }
  }
  return stops[stops.length - 1][1];
}

export class CanvasTitles {
  constructor(W, H) {
    this.items = [];      // 通常タイトル群(kicker / name / team)
    this.bubbleEl = null; // Director の bubble追従と互換(ダミーオブジェクト)
    this.now = 0;         // recorder が毎フレーム更新する論理時刻(秒)
    this.centered = false;
    this._W = W || innerWidth;   // 録画論理サイズ(出力アスペクト)
    this._H = H || innerHeight;
  }

  get W() { return this._W; }
  get H() { return this._H; }
  get vmin() { return Math.min(this.W, this.H) / 100; }

  // ---- Titles 互換 API ----
  kicker(text, color) {
    if (!text) return null;
    const it = { kind: 'kicker', text: String(text), color: color || '#fff',
      variant: pickVariant(this.items.length), bornT: this.now, outT: null };
    this.items.push(it);
    return it;
  }

  name(text, color, { sub = '' } = {}) {
    const len = [...String(text)].length;
    // CSS: clamp(44px, 11vmin, 150px)。長い名前は縮小。
    let fs = Math.min(150, Math.max(44, 11 * this.vmin));
    if (len > 7) fs = Math.min(fs, (86 / len) * this.W / 100); // min(11vmin, (86/len)vw)
    const it = { kind: 'name', text: String(text), color: color || '#f33',
      variant: pickVariant(this.items.length), fontSize: fs, sub: String(sub || ''),
      bornT: this.now, outT: null };
    this.items.push(it);
    return it;
  }

  teamTitle(kickerText, nameText, colors) {
    this.centered = true;
    const len = [...String(nameText)].length;
    let fs = Math.min(180, Math.max(52, 13 * this.vmin));
    if (len > 7) fs = Math.min(fs, (92 / len) * this.W / 100);
    this.items.push({ kind: 'team', kicker: String(kickerText || ''), text: String(nameText),
      colors: colors && colors.length ? colors : ['#fff'], fontSize: fs,
      bornT: this.now, outT: null });
  }

  bubble(text) {
    this.clearBubble();
    // Director._trackBubble が bubbleEl.style.display を触るのでダミーを返す
    const dummy = { style: {} };
    this._bubble = { text: String(text), x: 0, y: 0, flip: false, visible: false,
      bornT: this.now, outT: null, dummy };
    this.bubbleEl = dummy;
    return dummy;
  }

  moveBubble(x, y, flip) {
    if (!this._bubble) return;
    // Director は innerWidth/innerHeight 基準のスクリーン座標を渡してくるので、
    // 録画論理サイズ(出力アスペクト)へスケール変換する。
    this._bubble.x = x * this._W / innerWidth;
    this._bubble.y = y * this._H / innerHeight;
    this._bubble.flip = !!flip;
    // Director が style.display='none'/'' で可視性を制御している
    this._bubble.visible = this._bubble.dummy.style.display !== 'none';
  }

  clearBubble(animated = false) {
    if (!this._bubble) return;
    if (animated) {
      this._bubble.outT = this.now;
      const b = this._bubble;
      // out アニメ(0.18s)後に破棄
      this._bubble = b;
      this._bubbleFadeUntil = this.now + 0.2;
    } else {
      this._bubble = null;
      this.bubbleEl = null;
    }
  }

  out() {
    this.items.forEach(it => { if (it.outT == null) it.outT = this.now; });
  }

  clear(immediate = true) {
    if (immediate) {
      this.items = [];
      this.centered = false;
      this._bubble = null;
      this.bubbleEl = null;
    } else {
      this.out();
      this.clearBubble(true);
      // 録画では draw 側で outT+0.42s 経過後に消える
    }
  }

  // recorder が毎フレーム呼ぶ: 期限切れ(out完了)要素を掃除
  prune() {
    this.items = this.items.filter(it => it.outT == null || this.now - it.outT < 0.42);
    if (this._bubble && this._bubble.outT != null && this.now > this._bubbleFadeUntil) {
      this._bubble = null;
      this.bubbleEl = null;
    }
  }

  // ---- 描画 ----
  draw(g, scale) {
    this.prune();
    const W = this.W, H = this.H;

    // タイトル群のレイアウト(下詰め)。各要素の高さを見積もって縦に積む。
    const normal = this.items.filter(it => it.kind !== 'team');
    const team = this.items.find(it => it.kind === 'team');

    if (normal.length) this._drawNormalGroup(g, normal, W, H);
    if (team) this._drawTeam(g, team, W, H);
    if (this._bubble) this._drawBubble(g, this._bubble);
  }

  _drawNormalGroup(g, items, W, H) {
    const vh = H / 100;
    // 高さ見積もり
    const measures = items.map(it => {
      if (it.kind === 'kicker') {
        const fs = Math.min(40, Math.max(18, 3.2 * this.vmin));
        return { it, fs, h: fs * 1.4 + 1.2 * vh, type: 'kicker' };
      }
      // name(+ rule + sub を内包)
      let h = it.fontSize * 1.05;
      h += 1.4 * vh + 4; // rule
      if (it.sub) {
        const sfs = Math.min(22, Math.max(12, 2 * this.vmin));
        h += 1 * vh + sfs * 1.2;
        return { it, fs: it.fontSize, h, type: 'name', sfs };
      }
      return { it, fs: it.fontSize, h, type: 'name' };
    });
    const total = measures.reduce((s, m) => s + m.h, 0);
    const bottom = H - 16 * vh;
    let y = bottom - total; // 群の上端
    const x0 = 6 * (W / 100);

    for (const m of measures) {
      const it = m.it;
      const p = clamp01((this.now - it.bornT) / animDur(it.variant));
      const a = animTransform(it.variant, p, W, H);
      const outA = it.outT != null ? outTransform(this.now - it.outT, W) : null;
      g.save();
      g.globalAlpha = outA ? outA.opacity : a.opacity;
      // 左下基準のアニメ原点
      g.translate(x0 + (outA ? outA.tx : a.tx), y + (a.ty));
      if (a.skew) g.transform(1, 0, Math.tan((outA ? outA.skew : a.skew) * Math.PI / 180), 1, 0, 0);
      else if (outA && outA.skew) g.transform(1, 0, Math.tan(outA.skew * Math.PI / 180), 1, 0, 0);
      if (a.scale !== 1 || a.rot) {
        g.rotate((a.rot || 0) * Math.PI / 180);
        g.scale(a.scale, a.scale);
      }
      if (m.type === 'kicker') this._drawKicker(g, it, m.fs);
      else this._drawName(g, it, m, W);
      g.restore();
      y += m.h;
    }
  }

  _drawKicker(g, it, fs) {
    g.font = `400 ${fs}px ${FONT_TITLE}`;
    g.textBaseline = 'top';
    g.textAlign = 'left';
    const padX = fs * 0.9, padY = fs * 0.2;
    const w = g.measureText(it.text).width + padX * 2;
    const h = fs * 1.2 + padY * 2;
    // 背景(skewX(-8deg)の暗グラデ + 左ボーダー)
    g.save();
    g.transform(1, 0, Math.tan(-8 * Math.PI / 180), 1, 0, 0);
    const grad = g.createLinearGradient(0, 0, w, 0);
    grad.addColorStop(0, 'rgba(0,0,0,.78)');
    grad.addColorStop(0.8, 'rgba(0,0,0,.45)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
    g.fillStyle = it.color;
    g.fillRect(-fs * 0.35, 0, fs * 0.35, h); // 左ボーダー
    g.restore();
    // テキスト
    g.fillStyle = '#fff';
    g.shadowColor = it.color;
    g.shadowBlur = 12;
    g.fillText(it.text, padX, padY + fs * 0.1);
    g.shadowBlur = 0;
  }

  _drawName(g, it, m, W) {
    const fs = it.fontSize;
    g.font = `400 ${fs}px ${FONT_TITLE}`;
    g.textBaseline = 'top';
    g.textAlign = 'left';
    // 発光 + 本体
    g.save();
    g.shadowColor = it.color;
    g.shadowBlur = fs * 0.5;
    g.fillStyle = '#fff';
    g.fillText(it.text, 0, 0);
    g.shadowBlur = 0;
    // 黒フチ(近似)
    g.lineWidth = 2;
    g.strokeStyle = 'rgba(0,0,0,.35)';
    g.strokeText(it.text, 0, 0);
    g.restore();
    // rule(下線, 0→38vw, delay .1s / .5s)
    const ruleY = fs * 1.05 + (1.4 * this.H / 100);
    const rp = clamp01((this.now - it.bornT - 0.1) / 0.5);
    const rw = (38 * W / 100) * easeOutCubic(rp);
    if (rw > 1) {
      const rg = g.createLinearGradient(0, 0, rw, 0);
      rg.addColorStop(0, it.color);
      rg.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = rg;
      g.fillRect(0, ruleY, rw, 4);
    }
    // sub(v-rise)
    if (it.sub) {
      const sfs = m.sfs;
      const subY = ruleY + 4 + (1 * this.H / 100);
      const sp = clamp01((this.now - it.bornT) / 0.5);
      g.save();
      g.globalAlpha = sp;
      g.translate(0, (1 - easeOutBack(sp)) * (8 * this.H / 100) * 0 + (1 - sp) * 20);
      g.font = `400 ${sfs}px ${FONT_SUB}`;
      g.textBaseline = 'top';
      g.fillStyle = '#cfd6e6';
      // letter-spacing .5em を擬似(1文字ずつ)
      drawSpaced(g, it.sub, 0, subY, sfs * 0.5);
      g.restore();
    }
  }

  _drawTeam(g, it, W, H) {
    const vh = H / 100;
    const cx = W / 2;
    const fs = it.fontSize;
    let y = H - 16 * vh - fs * 1.02;
    // kicker
    if (it.kicker) {
      const kfs = Math.min(44, Math.max(18, 3.4 * this.vmin));
      const kp = clamp01((this.now - it.bornT) / 0.5);
      g.save();
      g.globalAlpha = kp;
      g.font = `400 ${kfs}px ${FONT_TITLE}`;
      g.textAlign = 'center';
      g.textBaseline = 'alphabetic';
      g.fillStyle = '#ffe9a8';
      g.shadowColor = 'rgba(255,180,40,.9)';
      g.shadowBlur = 14;
      drawSpacedCenter(g, it.kicker, cx, y - fs * 0.1 - kfs, kfs * 0.3);
      g.restore();
    }
    // name(1文字ずつ chPop、色違い)
    g.font = `400 ${fs}px ${FONT_TITLE}`;
    g.textBaseline = 'top';
    g.textAlign = 'left';
    const chars = [...it.text];
    const ls = fs * 0.03;
    let totalW = 0;
    const widths = chars.map(ch => { const w = g.measureText(ch).width + ls; totalW += w; return w; });
    let x = cx - totalW / 2;
    for (let i = 0; i < chars.length; i++) {
      const delay = i * 0.05;
      const cp = clamp01((this.now - it.bornT - delay) / 0.45);
      const e = easeOutBack(cp);
      const ty = (1 - e) * (-1.2 * fs);
      const sc = lerp(1.6, 1, e);
      const col = it.colors[i % it.colors.length];
      g.save();
      g.globalAlpha = cp;
      g.translate(x + widths[i] / 2, y + fs / 2 + ty);
      g.scale(sc, sc);
      g.fillStyle = '#fff';
      g.shadowColor = col;
      g.shadowBlur = fs * 0.35;
      g.lineWidth = 2;
      g.strokeStyle = 'rgba(0,0,0,.4)';
      g.fillText(chars[i], -widths[i] / 2, -fs / 2);
      g.strokeText(chars[i], -widths[i] / 2, -fs / 2);
      g.restore();
      x += widths[i];
    }
  }

  _drawBubble(g, b) {
    if (!b.visible && b.outT == null) return;
    const fs = Math.min(27, Math.max(17, 3.1 * this.vmin));
    g.font = `700 ${fs}px ${FONT_SUB}`;
    g.textBaseline = 'top';
    g.textAlign = 'left';
    const padX = 20, padY = 12;
    const maxW = Math.min(460, 72 * this.W / 100);
    const lines = wrapText(g, b.text, maxW - padX * 2);
    const lineH = fs * 1.5;
    const bw = Math.min(maxW, Math.max(...lines.map(l => g.measureText(l).width)) + padX * 2);
    const bh = lines.length * lineH + padY * 2;
    // pop / out アニメ
    let scale = 1, alpha = 1;
    if (b.outT != null) {
      const op = clamp01((this.now - b.outT) / 0.18);
      scale = 1 - op; alpha = 1 - op;
    } else {
      const pp = clamp01((this.now - b.bornT) / 0.2);
      scale = keyframe([[0, 0], [0.6, 1.12], [1, 1]], pp);
      alpha = pp < 0.6 ? pp / 0.6 : 1;
    }
    // 配置(moveBubble と同じ: 左上が b.x-24 付近、上は y-bh-34)
    let left = b.flip ? b.x - bw + 24 : b.x - 24;
    let top = b.y - bh - 34;
    left = Math.max(8, Math.min(this.W - bw - 8, left));
    top = Math.max(8, top);
    g.save();
    g.globalAlpha = alpha;
    g.translate(left + bw / 2, top + bh / 2);
    g.scale(scale, scale);
    g.translate(-bw / 2, -bh / 2);
    // 黒フチ枠 + 白地(角ピクセル風は簡略化した角丸矩形)
    g.fillStyle = '#1a1a1a';
    roundRect(g, 0, 0, bw, bh, 6); g.fill();
    g.fillStyle = '#fff';
    roundRect(g, 4, 4, bw - 8, bh - 8, 4); g.fill();
    // しっぽ(三角)
    g.fillStyle = '#1a1a1a';
    const tx = b.flip ? bw - 30 : 20;
    g.beginPath();
    g.moveTo(tx, bh - 2); g.lineTo(tx + 22, bh - 2); g.lineTo(tx, bh + 24); g.closePath(); g.fill();
    g.fillStyle = '#fff';
    g.beginPath();
    g.moveTo(tx + 2, bh - 4); g.lineTo(tx + 16, bh - 4); g.lineTo(tx + 2, bh + 14); g.closePath(); g.fill();
    // テキスト
    g.fillStyle = '#15161a';
    lines.forEach((l, i) => g.fillText(l, padX, padY + i * lineH));
    g.restore();
  }
}

// ---- アニメ補助 ----
const VARIANTS = ['v-slam', 'v-slide', 'v-rise'];
function pickVariant(seed) { return VARIANTS[Math.floor(Math.random() * VARIANTS.length)]; }

function animDur(v) { return v === 'v-slam' ? 0.42 : v === 'v-slide' ? 0.38 : 0.5; }

function animTransform(v, p, W, H) {
  if (v === 'v-slam') {
    const scale = keyframe([[0, 3.2], [0.6, 0.96], [1, 1]], p);
    const rot = keyframe([[0, -4], [0.6, 0.5], [1, 0]], p);
    const opacity = p < 0.6 ? p / 0.6 : 1;
    return { tx: 0, ty: 0, scale, rot, skew: 0, opacity };
  }
  if (v === 'v-slide') {
    const tx = keyframe([[0, -0.6 * W], [0.7, 0.02 * W], [1, 0]], p);
    const skew = keyframe([[0, -18], [0.7, 6], [1, 0]], p);
    const opacity = p < 0.7 ? p / 0.7 : 1;
    return { tx, ty: 0, scale: 1, rot: 0, skew, opacity };
  }
  // v-rise
  const ty = (1 - easeOutBack(p)) * (8 * H / 100);
  return { tx: 0, ty: ty < 0 ? 0 : ty, scale: 1, rot: 0, skew: 0, opacity: p };
}

function outTransform(t, W) {
  const p = clamp01(t / 0.35);
  return { tx: easeInCubic(p) * 40 * W / 100, skew: -15 * p, opacity: 1 - p };
}

function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
function easeInCubic(t) { return t * t * t; }

function drawSpaced(g, text, x, y, gap) {
  let cx = x;
  for (const ch of text) {
    g.fillText(ch, cx, y);
    cx += g.measureText(ch).width + gap;
  }
}
function drawSpacedCenter(g, text, cx, y, gap) {
  const chars = [...text];
  let total = 0;
  const ws = chars.map(ch => { const w = g.measureText(ch).width + gap; total += w; return w; });
  let x = cx - total / 2;
  const prevAlign = g.textAlign;
  g.textAlign = 'left';
  for (let i = 0; i < chars.length; i++) { g.fillText(chars[i], x, y); x += ws[i]; }
  g.textAlign = prevAlign;
}

function wrapText(g, text, maxW) {
  const lines = [];
  let cur = '';
  for (const ch of String(text)) {
    if (ch === '\n') { lines.push(cur); cur = ''; continue; }
    const test = cur + ch;
    if (g.measureText(test).width > maxW && cur) { lines.push(cur); cur = ch; }
    else cur = test;
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [''];
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}
