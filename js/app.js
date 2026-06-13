// アプリ本体: フォームUI/シーン進行/エントリポイント

import * as THREE from 'three';
import { PlayerModel } from './actors.js';
import { AUTO_COLOR, INTRO_SCENES, MAX_MEMBERS, RANDOM, RANGER_COLORS, SAMPLE_STATE, SAMPLE_STATE_16, TEAM_SCENES, decodeState, defaultState, emptyMember, memberColor, normalizeState, resolveScenes, shareURL } from './core.js';
import { FX, ScreenFX, Stage, Titles, sfx } from './engine.js';
import { createIntroScene } from './scenes.js';
import { loadSkin, makeSuitedSkin } from './skin.js';
import { createTeamScene } from './team.js';

// ============================================================
// [ui.js より統合]
// ============================================================

// 入力フォームUI

const DRAFT_KEY = 'mcrangers-draft-v1';

export class FormUI {
  constructor(onPlay) {
    this.onPlay = onPlay;
    this.el = document.getElementById('form-screen');
    this.listEl = document.getElementById('member-list');
    this.squadName = document.getElementById('squad-name');
    this.squadTitle = document.getElementById('squad-title');
    this.squadScene = document.getElementById('squad-scene');
    this.squadSuit = document.getElementById('squad-suit');
    this.errEl = document.getElementById('form-error');
    this.countEl = document.getElementById('member-count');

    this.state = this._loadDraft() || defaultState();

    // チーム演出セレクト
    this.squadScene.innerHTML = sceneOptions(TEAM_SCENES);

    // HTMLとJSのキャッシュ世代がずれてボタンが存在しなくても、
    // 他のハンドラ登録まで死なないように要素が無ければスキップする
    const on = (id, fn) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('click', fn);
      else console.warn(`#${id} が見つかりません(古いindex.htmlがキャッシュされている可能性。再読み込みしてください)`);
    };
    on('btn-add-member', () => {
      if (this.state.members.length >= MAX_MEMBERS) return;
      this.state.members.push(emptyMember());
      this.renderMembers();
    });
    on('btn-sample', () => {
      this.state = JSON.parse(JSON.stringify(SAMPLE_STATE));
      this.render();
      this._saveDraft();
    });
    on('btn-sample16', () => {
      this.state = JSON.parse(JSON.stringify(SAMPLE_STATE_16));
      this.render();
      this._saveDraft();
    });
    on('btn-play', () => this._play());

    this.squadName.addEventListener('input', () => { this.state.squad.name = this.squadName.value; this._saveDraft(); });
    this.squadTitle.addEventListener('input', () => { this.state.squad.title = this.squadTitle.value; this._saveDraft(); });
    this.squadScene.addEventListener('change', () => { this.state.squad.scene = this.squadScene.value; this._saveDraft(); });
    if (this.squadSuit) {
      this.squadSuit.addEventListener('change', () => { this.state.squad.suit = this.squadSuit.checked; this._saveDraft(); });
    }

    this.render();
  }

  setState(state) {
    this.state = state;
    this.render();
  }

  render() {
    this.squadName.value = this.state.squad.name || '';
    this.squadTitle.value = this.state.squad.title || '';
    this.squadScene.value = this.state.squad.scene || RANDOM;
    if (this.squadSuit) this.squadSuit.checked = !!this.state.squad.suit;
    this.renderMembers();
  }

  renderMembers() {
    this.listEl.innerHTML = '';
    this.state.members.forEach((m, i) => {
      this.listEl.appendChild(this._memberCard(m, i));
    });
    this.countEl.textContent = `${this.state.members.length} / ${MAX_MEMBERS}人`;
    document.getElementById('btn-add-member').style.display =
      this.state.members.length >= MAX_MEMBERS ? 'none' : '';
  }

  _memberCard(m, i) {
    const color = memberColor(m, i);
    const card = document.createElement('div');
    card.className = 'member-card';
    card.style.setProperty('--c', color.css);
    card.innerHTML = `
      <div class="mc-head">
        <img class="avatar" alt="" loading="lazy">
        <span class="mc-idx">MEMBER ${String(i + 1).padStart(2, '0')} — ${color.label}</span>
        <button class="mc-move mc-up" title="上へ" ${i === 0 ? 'disabled' : ''}>&#x25B2;</button>
        <button class="mc-move mc-down" title="下へ" ${i === this.state.members.length - 1 ? 'disabled' : ''}>&#x25BC;</button>
        <button class="mc-remove" title="削除">&#x2715;</button>
      </div>
      <div class="field-row"><label>メンバー名</label><input type="text" data-k="name" maxlength="20" placeholder="例: マイクレッド"></div>
      <div class="field-row"><label>二つ名 <small>(オプション)</small></label><input type="text" data-k="title" maxlength="30" placeholder="例: 灼熱の切り込み隊長"></div>
      <div class="field-row"><label>決め台詞 <small>(オプション)</small></label><input type="text" data-k="quote" maxlength="40" placeholder="例: 燃えるぜ、一番槍はもらった!"></div>
      <div class="field-row"><label>MC Username</label><input type="text" data-k="mc" maxlength="40" placeholder="Java版ユーザー名 or UUID" spellcheck="false"></div>
      <div class="field-row color-row"><label>戦隊カラー</label>
        <span class="color-chip" style="--c:${color.css}"></span>
        <select data-k="color">${colorOptions()}</select>
        <input type="color" class="color-picker" title="カラーピッカー">
        <input type="text" class="color-hex" maxlength="18" spellcheck="false"
               placeholder="#ff3b30" title="HEX(#ff3b30) または RGB(255,59,48) で入力">
      </div>
      <div class="field-row"><label>個人紹介演出</label><select data-k="scene">${sceneOptions(INTRO_SCENES)}</select></div>
    `;

    const avatar = card.querySelector('.avatar');
    const updateAvatar = () => {
      const u = (m.mc || '').trim();
      if (u && !u.includes(' ')) {
        avatar.src = `https://crafthead.net/avatar/${encodeURIComponent(u)}/32`;
        avatar.style.visibility = 'visible';
      } else {
        avatar.removeAttribute('src');
        avatar.style.visibility = u ? 'hidden' : 'visible';
      }
    };
    avatar.addEventListener('error', () => { avatar.style.visibility = 'hidden'; });
    avatar.addEventListener('load', () => { avatar.style.visibility = 'visible'; });
    updateAvatar();

    card.querySelectorAll('input[data-k]').forEach(inp => {
      inp.value = m[inp.dataset.k] || '';
      inp.addEventListener('input', () => {
        m[inp.dataset.k] = inp.value;
        if (inp.dataset.k === 'mc') debounce(card, () => updateAvatar(), 600);
        this._saveDraft();
      });
    });
    const sceneSel = card.querySelector('select[data-k="scene"]');
    sceneSel.value = m.scene || RANDOM;
    sceneSel.addEventListener('change', () => { m.scene = sceneSel.value; this._saveDraft(); });

    // ---- 戦隊カラー(プリセット選択 / ピッカー / HEX・RGB直接入力) ----
    const colorSel = card.querySelector('select[data-k="color"]');
    const chip = card.querySelector('.color-chip');
    const picker = card.querySelector('.color-picker');
    const hexInput = card.querySelector('.color-hex');
    const idxLabel = card.querySelector('.mc-idx');

    // 現在の色をカード全体へ反映(再レンダリングせずin-place更新)
    const syncColor = () => {
      const c = memberColor(m, i);
      card.style.setProperty('--c', c.css);
      chip.style.setProperty('--c', c.css);
      idxLabel.textContent = `MEMBER ${String(i + 1).padStart(2, '0')} — ${c.label}`;
      colorSel.value = c.custom ? CUSTOM_COLOR : (m.color || AUTO_COLOR);
      picker.value = c.css;
      if (document.activeElement !== hexInput) hexInput.value = c.css;
      hexInput.classList.remove('invalid');
    };
    syncColor();

    colorSel.addEventListener('change', () => {
      m.color = colorSel.value === CUSTOM_COLOR ? picker.value.toLowerCase() : colorSel.value;
      syncColor();
      this._saveDraft();
    });
    picker.addEventListener('input', () => {
      m.color = picker.value.toLowerCase();
      syncColor();
    });
    picker.addEventListener('change', () => this._saveDraft());
    hexInput.addEventListener('input', () => {
      const parsed = parseColorInput(hexInput.value);
      if (parsed) {
        m.color = parsed;
        syncColor();
        this._saveDraft();
      } else {
        hexInput.classList.toggle('invalid', hexInput.value.trim() !== '');
      }
    });
    hexInput.addEventListener('blur', () => syncColor());

    card.querySelector('.mc-remove').addEventListener('click', () => {
      this.state.members.splice(i, 1);
      if (this.state.members.length === 0) this.state.members.push(emptyMember());
      this.renderMembers();
      this._saveDraft();
    });

    // 並び替え(隣のメンバーと入れ替え)。値はinputイベントで即state反映済みなので
    // 配列を入れ替えてrenderMembersすれば内容も色(おまかせ=並び順)も正しく更新される
    const move = (delta) => {
      const j = i + delta;
      const ms = this.state.members;
      if (j < 0 || j >= ms.length) return;
      [ms[i], ms[j]] = [ms[j], ms[i]];
      this.renderMembers();
      this._saveDraft();
    };
    card.querySelector('.mc-up').addEventListener('click', () => move(-1));
    card.querySelector('.mc-down').addEventListener('click', () => move(1));

    return card;
  }

  _play() {
    const valid = this.state.members.some(m => (m.name || '').trim() || (m.mc || '').trim());
    if (!valid) {
      this.errEl.textContent = 'メンバーを最低1人入力してください(メンバー名かMC Usernameのどちらかが必要です)。';
      this.errEl.classList.remove('hidden');
      return;
    }
    this.errEl.classList.add('hidden');
    this._saveDraft();
    this.onPlay(this.state);
  }

  show() { this.el.classList.remove('hidden'); }
  hide() { this.el.classList.add('hidden'); }

  _saveDraft() {
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(this.state)); } catch {}
  }

  _loadDraft() {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return null;
      const s = JSON.parse(raw);
      if (!s || !s.squad || !Array.isArray(s.members) || s.members.length === 0) return null;
      return s;
    } catch { return null; }
  }
}

function sceneOptions(list) {
  return `<option value="${RANDOM}">おまかせ(ランダム)</option>` +
    list.map(s => `<option value="${s.id}">${s.label}</option>`).join('');
}

const CUSTOM_COLOR = 'custom';

function colorOptions() {
  return `<option value="${AUTO_COLOR}">おまかせ(並び順)</option>` +
    RANGER_COLORS.map(c => `<option value="${c.id}">${c.label}</option>`).join('') +
    `<option value="${CUSTOM_COLOR}">カスタム</option>`;
}

// HEX(#fff / #ffffff / ffffff) と RGB(rgb(255,0,0) / 255,0,0) を受け付けて #rrggbb に正規化
export function parseColorInput(str) {
  const s = String(str).trim().toLowerCase();
  let m = s.match(/^#?([0-9a-f]{6})$/);
  if (m) return '#' + m[1];
  m = s.match(/^#?([0-9a-f]{3})$/);
  if (m) return '#' + m[1].split('').map(c => c + c).join('');
  m = s.match(/^rgb\s*\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/)
    || s.match(/^(\d{1,3})\s*[,\s]\s*(\d{1,3})\s*[,\s]\s*(\d{1,3})$/);
  if (m) {
    const rgb = [m[1], m[2], m[3]].map(Number);
    if (rgb.every(v => v >= 0 && v <= 255)) {
      return '#' + rgb.map(v => v.toString(16).padStart(2, '0')).join('');
    }
  }
  return null;
}

const timers = new WeakMap();
function debounce(key, fn, ms) {
  clearTimeout(timers.get(key));
  timers.set(key, setTimeout(fn, ms));
}

// ============================================================
// [director.js より統合]
// ============================================================

// 演出全体の進行管理: メンバー紹介 → チーム紹介 → 終了

export class Director {
  // resolved: resolveScenes()済みのstate / players: PlayerModel[]
  constructor(ctx, resolved, players, { onFinish, onProgress } = {}) {
    this.ctx = ctx;
    this.state = resolved;
    this.players = players;
    this.onFinish = onFinish || (() => {});
    this.onProgress = onProgress || (() => {});
    this.colors = resolved.members.map((m, i) => memberColor(m, i).css);
    this.running = false;
    this.scene = null;
    this.t = 0;
    this.idx = -1;
  }

  start() {
    this.running = true;
    this.idx = -1;
    this.next();
  }

  _cleanup() {
    const { stage, fx, screen, titles } = this.ctx;
    // シーン固有の後始末(タイマーUIなどDOM要素の除去)
    if (this.scene && this.scene.dispose) {
      this.scene.dispose();
    }
    fx.clear();
    titles.clear(true);
    screen.reset();
    stage.clearProps();
    stage.fov = 50;
    stage.shakeAmp = 0;
    // 環境光のシーン内上書きをリセット(setEnvは次シーンのinitで呼ばれる)
    this.players.forEach(p => {
      p.resetAll();
      if (p.parent) p.parent.remove(p);
    });
  }

  next() {
    if (!this.running) return;
    this._cleanup();
    this.idx++;
    const n = this.state.members.length;

    if (this.idx < n) {
      // メンバー紹介
      const m = this.state.members[this.idx];
      const p = this.players[this.idx];
      this.ctx.stage.scene.add(p);
      this.scene = createIntroScene(m.sceneResolved, this.ctx, m, p, this.colors[this.idx]);
      this.afterglow = 0;
      this.currentPlayer = p;
      this.onProgress({ type: 'member', index: this.idx, total: n, member: m });
    } else if (this.idx === n) {
      // チーム紹介: 決めポーズの後に余韻を残す
      this.players.forEach(p => this.ctx.stage.scene.add(p));
      this.scene = createTeamScene(this.state.squad.sceneResolved, this.ctx, this.state, this.players, this.colors);
      this.afterglow = 2.2;
      this.currentPlayer = null;
      this.onProgress({ type: 'team', squad: this.state.squad });
    } else {
      this.scene = null;
      this.running = false;
      this._cleanup();
      this.onFinish();
      return;
    }

    this.t = 0;
    this.scene.init();
  }

  skip() {
    if (this.running) this.next();
  }

  stop() {
    this.running = false;
    this.scene = null;
    this._cleanup();
  }

  update(dt) {
    if (!this.running || !this.scene) return;
    this.t += dt;
    // シーン時間はshellが返す(決め台詞ホールド中はスロー再生で実時間より遅れる)
    const sceneTime = this.scene.frame(this.t, dt);
    this._trackBubble();
    const end = (typeof sceneTime === 'number' ? sceneTime : this.t);
    if (end >= this.scene.duration + (this.afterglow || 0)) {
      this.next();
    }
  }

  // 決め台詞の吹き出しをキャラの頭上スクリーン座標へ追従させる
  _trackBubble() {
    const titles = this.ctx.titles;
    if (!titles.bubbleEl || !this.currentPlayer) return;
    const head = this.currentPlayer.head;
    const v = new THREE.Vector3();
    head.getWorldPosition(v);
    v.y += 0.55;
    v.project(this.ctx.stage.camera);
    if (v.z > 1) { titles.bubbleEl.style.display = 'none'; return; }
    titles.bubbleEl.style.display = '';
    const x = (v.x * 0.5 + 0.5) * innerWidth;
    const y = (-v.y * 0.5 + 0.5) * innerHeight;
    titles.moveBubble(x, y, x > innerWidth * 0.62);
  }
}

// ============================================================
// [main.js より統合]
// ============================================================

// MCRangers エントリポイント

// ---- 初期化 ----
const stage = new Stage(document.getElementById('stage-container'));
const fx = new FX(stage.scene);
const screen = new ScreenFX(document.getElementById('fx2d'));
const titles = new Titles(document.getElementById('titles'));
const ctx = { stage, fx, screen, titles, sfx };

const hud = document.getElementById('hud');
const hudProgress = document.getElementById('hud-progress');
const overlay = document.getElementById('overlay-screen');
const overlayInner = document.getElementById('overlay-inner');

let director = null;
let players = [];
let currentState = null;   // normalize済み(random未解決)
let idleT = 0;

const form = new FormUI((rawState) => {
  sfx.unlock();
  startShow(normalizeState(rawState));
});

stage.setEnv('street');

// ---- メインループ ----
// ?debug=1 のとき: 時間は自動で進まず、window.__mcrFF(秒)でのみ進む
// (ヘッドレステストでシーンの特定時刻を決定論的に撮影するための開発用フック)
const DEBUG = new URLSearchParams(location.search).has('debug');
const clock = new THREE.Clock();
function loop() {
  requestAnimationFrame(loop);
  const dt = Math.min(clock.getDelta(), 0.05);

  if (DEBUG) {
    stage.update(0);
    return;
  }

  if (director && director.running) {
    director.update(dt);
  } else {
    // アイドル時はゆっくりカメラドリフト
    idleT += dt;
    stage.cam(Math.sin(idleT * 0.12) * 4, 2.2 + Math.sin(idleT * 0.07) * 0.4, 7, 0, 1, 0);
  }

  fx.update(dt);
  stage.update(dt);
  screen.update(dt);
}
loop();

if (DEBUG) {
  window.__mcrFF = (sec) => {
    const step = 1 / 30;
    const steps = Math.round(sec * 30);
    for (let i = 0; i < steps; i++) {
      if (director && director.running) director.update(step);
      fx.update(step);
      screen.update(step);
    }
    stage.update(0);
  };
}

// ---- ショー開始フロー ----
async function startShow(state) {
  currentState = state;
  form.hide();
  hideOverlay();

  // 共有URLをアドレスバーへ反映
  try { history.replaceState(null, '', shareURL(state)); } catch {}

  // スキンロード
  showLoading(state);
  const results = [];
  let done = 0;
  await Promise.all(state.members.map(async (m, i) => {
    const color = memberColor(m, i).css;
    results[i] = await loadSkin(m.mc, color);
    // スーツ統一モード: 体をメンバーカラーのスーツに差し替え(顔は本人のまま)
    if (state.squad.suit && !results[i].fallback) {
      results[i] = makeSuitedSkin(results[i], color);
    }
    done++;
    updateLoading(done, state.members.length);
  }));

  // プレイヤーモデル構築
  players.forEach(p => { if (p.parent) p.parent.remove(p); p.dispose(); });
  players = results.map(r => new PlayerModel(r));

  hideOverlay();
  beginDirector();
}

function beginDirector() {
  const resolved = resolveScenes(currentState);
  director = new Director(ctx, resolved, players, {
    onFinish: showEndCard,
    onProgress: (info) => {
      if (info.type === 'member') {
        hudProgress.textContent =
          `MEMBER ${String(info.index + 1).padStart(2, '0')} / ${String(info.total).padStart(2, '0')}`;
      } else {
        hudProgress.textContent = 'FINAL — 全員集合';
      }
    },
  });
  document.body.classList.add('cinema');
  hud.classList.remove('hidden');
  director.start();
}

function exitToForm() {
  if (director) director.stop();
  director = null;
  document.body.classList.remove('cinema');
  hud.classList.add('hidden');
  hideOverlay();
  stage.setEnv('street');
  stage.fov = 50;
  form.show();
}

// ---- オーバーレイ(ローディング / スタート / エンドカード) ----
function showLoading(state) {
  overlayInner.innerHTML = `
    <div class="ov-squad-title">${esc(state.squad.title || 'NOW LOADING')}</div>
    <div class="ov-squad-name">${esc(state.squad.name)}</div>
    <div class="ov-loading">スキンを取得中… <span id="ld-num">0 / ${state.members.length}</span></div>
    <div class="ov-bar"><i id="ld-bar"></i></div>
  `;
  overlay.classList.remove('hidden');
}

function updateLoading(done, total) {
  const n = document.getElementById('ld-num');
  const b = document.getElementById('ld-bar');
  if (n) n.textContent = `${done} / ${total}`;
  if (b) b.style.width = `${(done / total) * 100}%`;
}

function showStartScreen(state) {
  overlayInner.innerHTML = `
    ${state.squad.title ? `<div class="ov-squad-title">${esc(state.squad.title)}</div>` : ''}
    <div class="ov-squad-name">${esc(state.squad.name)}</div>
    <button class="btn start" id="ov-start">&#9654; START</button>
    <div class="ov-buttons">
      <button class="btn sub ghost" id="ov-edit">内容を編集する</button>
    </div>
  `;
  overlay.classList.remove('hidden');
  form.hide();
  document.getElementById('ov-start').addEventListener('click', () => {
    sfx.unlock();
    startShow(currentState);
  });
  document.getElementById('ov-edit').addEventListener('click', () => {
    hideOverlay();
    form.show();
  });
}

function showEndCard() {
  document.body.classList.remove('cinema');
  hud.classList.add('hidden');
  overlayInner.innerHTML = `
    <div class="ov-complete">★ MISSION COMPLETE ★</div>
    <div class="ov-squad-name">${esc(currentState.squad.name)}</div>
    <div class="ov-buttons">
      <button class="btn sub" id="ov-replay">&#9654; もう一度</button>
      <button class="btn sub" id="ov-copy">&#128279; URLをコピー</button>
      <button class="btn sub ghost" id="ov-edit2">編集に戻る</button>
    </div>
    <div class="ov-copied" id="ov-copied"></div>
  `;
  overlay.classList.remove('hidden');
  document.getElementById('ov-replay').addEventListener('click', () => {
    hideOverlay();
    beginDirector();
  });
  document.getElementById('ov-copy').addEventListener('click', async () => {
    const url = shareURL(currentState);
    try {
      await navigator.clipboard.writeText(url);
      document.getElementById('ov-copied').textContent = 'コピーしました！仲間に共有しよう';
    } catch {
      prompt('このURLをコピーしてください', url);
    }
  });
  document.getElementById('ov-edit2').addEventListener('click', () => exitToForm());
}

function hideOverlay() {
  overlay.classList.add('hidden');
  overlayInner.innerHTML = '';
}

// ---- 操作 ----
document.getElementById('btn-exit').addEventListener('click', exitToForm);

const muteBtn = document.getElementById('btn-mute');
muteBtn.addEventListener('click', () => {
  sfx.unlock();
  sfx.setEnabled(!sfx.enabled);
  muteBtn.classList.toggle('off', !sfx.enabled);
  muteBtn.innerHTML = sfx.enabled ? '&#x1F50A;' : '&#x1F507;';
});

// クリック/Spaceで次のシーンへ
// 3Dキャンバス(#stage-container)を直接クリックした時だけスキップする。
// ボタン等のクリックがバブリングしてきても誤発火しない(除去済みDOMでも安全)
document.addEventListener('click', (e) => {
  if (!director || !director.running) return;
  if (!(e.target instanceof Element) || !e.target.closest('#stage-container')) return;
  director.skip();
});
document.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && director && director.running) {
    e.preventDefault();
    director.skip();
  } else if (e.code === 'Escape' && director && director.running) {
    exitToForm();
  }
});

function esc(s) {
  return String(s).replace(/[&<>"']/g, m => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[m]));
}

// ---- URLパラメータからの起動 ----
const params = new URLSearchParams(location.search);
const shared = params.get('d') ? decodeState(params.get('d')) : null;
if (shared) {
  form.setState(shared);
  currentState = normalizeState(shared);
  showStartScreen(currentState);
} else {
  form.show();
}
