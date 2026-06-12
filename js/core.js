// 定数・状態管理・URL共有・イージング等のユーティリティ


// ============================================================
// [timeline.js より統合]
// ============================================================

// イージング・タイムラインユーティリティ

export const E = {
  linear: t => t,
  inQuad: t => t * t,
  outQuad: t => t * (2 - t),
  inOutQuad: t => t < .5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
  inCubic: t => t * t * t,
  outCubic: t => (--t) * t * t + 1,
  inOutCubic: t => t < .5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1,
  inQuart: t => t * t * t * t,
  outQuart: t => 1 - (--t) * t * t * t,
  inExpo: t => t === 0 ? 0 : Math.pow(2, 10 * (t - 1)),
  outExpo: t => t === 1 ? 1 : 1 - Math.pow(2, -10 * t),
  outBack: t => { const c = 1.70158; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); },
  inBack: t => { const c = 1.70158; return (c + 1) * t * t * t - c * t * t; },
  outElastic: t => t === 0 ? 0 : t === 1 ? 1 :
    Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI / 3)) + 1,
};

export const clamp01 = t => Math.max(0, Math.min(1, t));
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;

// 区間[t0,t1]での進捗(0..1)をイージング付きで返す
export function seg(t, t0, t1, ease = E.linear) {
  return ease(clamp01((t - t0) / (t1 - t0)));
}

// 区間内にいるかどうか
export function within(t, t0, t1) {
  return t >= t0 && t < t1;
}

// 乱数ヘルパ
export const rand = (a = 1, b) => b === undefined ? Math.random() * a : a + Math.random() * (b - a);
export const randPick = arr => arr[Math.floor(Math.random() * arr.length)];
export const randSpread = s => (Math.random() - 0.5) * 2 * s;

// ============================================================
// [state.js より統合]
// ============================================================

// 状態管理・URL共有・定数

export const MAX_MEMBERS = 16;

// 戦隊カラー(最大16人分)。text: タイトル演出のアクセント色
export const RANGER_COLORS = [
  { id: 'red',     label: 'レッド',     css: '#ff3b30' },
  { id: 'blue',    label: 'ブルー',     css: '#2e8bff' },
  { id: 'yellow',  label: 'イエロー',   css: '#ffcc00' },
  { id: 'green',   label: 'グリーン',   css: '#2ecc71' },
  { id: 'pink',    label: 'ピンク',     css: '#ff5fa2' },
  { id: 'black',   label: 'ブラック',   css: '#b8c0d4' },
  { id: 'white',   label: 'ホワイト',   css: '#f4f6ff' },
  { id: 'orange',  label: 'オレンジ',   css: '#ff8c1a' },
  { id: 'purple',  label: 'パープル',   css: '#b06bff' },
  { id: 'cyan',    label: 'シアン',     css: '#27d6e8' },
  { id: 'lime',    label: 'ライム',     css: '#a8e832' },
  { id: 'crimson', label: 'クリムゾン', css: '#e8274b' },
  { id: 'navy',    label: 'ネイビー',   css: '#5470ff' },
  { id: 'gold',    label: 'ゴールド',   css: '#ffd76a' },
  { id: 'silver',  label: 'シルバー',   css: '#d8e0ec' },
  { id: 'magma',   label: 'マグマ',     css: '#ff5e3a' },
];

export const INTRO_SCENES = [
  { id: 'dash',      label: '疾走スライドイン' },
  { id: 'cat',       label: 'ネコ救出' },
  { id: 'skyfall',   label: 'ヒーロー着地' },
  { id: 'backflip',  label: 'バク宙キメ' },
  { id: 'mining',    label: '壁ぶち抜き登場' },
  { id: 'spotlight', label: 'シルエット見参' },
  { id: 'tornado',   label: '旋風ターン' },
  { id: 'rocket',    label: '飛翔フライバイ' },
  { id: 'blink',     label: '瞬間移動' },
  { id: 'freeze',    label: 'パンチフリーズ' },
  { id: 'quake',     label: '地割れ登場' },
  { id: 'bomber',    label: '爆風ダイブ' },
  { id: 'beam',      label: 'ビームダウン' },
  { id: 'slowwalk',  label: '漢のスローウォーク' },
  { id: 'thunder',   label: '雷鳴降臨' },
  { id: 'minecart',  label: 'トロッコ参上' },
  { id: 'clones',    label: '影分身' },
  { id: 'breakspin', label: 'ブレイクスピン' },
  { id: 'creeper',   label: 'クリーパー大爆走' },
  { id: 'pigride',   label: 'ピッグライド' },
  { id: 'chickens',  label: 'ニワトリの雨' },
  { id: 'zombies',   label: 'ゾンビ無双' },
  { id: 'enderman',  label: 'エンダー睨み合い' },
  { id: 'sheep',     label: '羊ハードル' },
  { id: 'eat',       label: 'もぐもぐタイム' },
  { id: 'trip',      label: '全力ずっこけ' },
  { id: 'sleep',     label: '寝坊ダッシュ' },
  { id: 'mlg',       label: 'タワーMLG' },
  { id: 'tnt',       label: 'TNTキャノン' },
  { id: 'dance',     label: '勝利のダンス' },
  { id: 'shadowbox', label: 'シャドー乱打' },
  { id: 'wolf',      label: '相棒オオカミ' },
  { id: 'golem',     label: 'ゴーレム肩車' },
  { id: 'bees',      label: 'ハチパニック' },
  { id: 'arrows',    label: '矢避けバレットタイム' },
  { id: 'portal',    label: 'ネザーゲート参上' },
  { id: 'pearl',     label: 'エンダーパールRTA' },
  { id: 'bedbomb',   label: 'ベッド爆破RTA' },
  { id: 'endportal', label: 'エンドポータル起動' },
  { id: 'rta',       label: 'RTA走者(IGT計測)' },
  { id: 'elytra',      label: 'エリトラ急襲' },
  { id: 'trident',     label: 'トライデント・リップタイド' },
  { id: 'warden',      label: 'ウォーデン回避' },
  { id: 'vineswing',   label: 'ツタターザン' },
  { id: 'windcharge',  label: 'ウィンドチャージ跳躍' },
  { id: 'mace',        label: 'メイス一撃' },
  { id: 'totem',       label: '不死のトーテム' },
  { id: 'anvil',       label: '金床の雨' },
  { id: 'catcreeper',  label: 'ネコの威光' },
  { id: 'slime',       label: 'スライムトランポリン' },
  { id: 'parkour',     label: '精密アスレチック' },
  { id: 'ghast',       label: '火球打ち返し' },
  { id: 'henshin',     label: '変身シークエンス' },
  { id: 'powerup',     label: '気合のオーラ' },
  { id: 'coolback',    label: '爆発を背に' },
  { id: 'rooftop',     label: '摩天楼の影' },
  { id: 'slowturn',    label: '振り向きの漢' },
  { id: 'slide',       label: 'スライディング登場' },
  { id: 'catchfist',   label: '拳の受け止め' },
  { id: 'standoff',    label: '夕陽の決闘' },
  { id: 'afterimage',  label: '残像回避' },
  { id: 'debriscatch', label: '落石キャッチ' },
  { id: 'beckon',      label: '挑発の構え' },
  { id: 'walljump',    label: '三角飛び' },
];

export const TEAM_SCENES = [
  { id: 'assemble',   label: '全員集結・大爆発' },
  { id: 'sunset',     label: '夕陽のスローウォーク' },
  { id: 'orbit',      label: '暗闇からの全員見参' },
  { id: 'rollcall',   label: '名乗りロールコール' },
  { id: 'jumpfreeze', label: '全員ジャンプフリーズ' },
  { id: 'coolwalk',   label: '爆発を背に歩く' },
  { id: 'mobparade',  label: 'モブ大行進' },
  { id: 'feast',      label: '勝利の宴(もぐもぐ)' },
  { id: 'pileup',     label: 'ずっこけドミノ' },
  { id: 'teamportal', label: 'ゲート総出撃' },
  { id: 'fireworks',  label: '祝砲フィナーレ' },
  { id: 'biggolem',   label: '巨神ゴーレムと共に' },
  { id: 'dragonslayer', label: 'エンドラ討伐' },
  { id: 'elytrasquad',  label: 'エリトラ編隊飛行' },
  { id: 'wither',       label: 'ウィザー討伐' },
  { id: 'morning',      label: '寝坊戦隊・朝の出撃' },
];

export const RANDOM = 'random';

export function defaultState() {
  return {
    squad: { name: '', title: '', scene: RANDOM },
    members: [emptyMember()],
  };
}

export function emptyMember() {
  return { name: '', title: '', mc: '', scene: RANDOM, color: AUTO_COLOR };
}

export const AUTO_COLOR = 'auto';
const HEX_RE = /^#[0-9a-f]{6}$/i;

// color値の正規化: プリセットID or #rrggbb のみ許可、それ以外はauto
export function sanitizeColor(c) {
  if (typeof c === 'string') {
    if (HEX_RE.test(c)) return c.toLowerCase();
    if (RANGER_COLORS.some(x => x.id === c)) return c;
  }
  return AUTO_COLOR;
}

// メンバーの戦隊カラーを解決(カスタムHEX > プリセット > 並び順自動)
export function memberColor(member, index) {
  const c = member && member.color;
  if (typeof c === 'string' && HEX_RE.test(c)) {
    return { id: c.toLowerCase(), label: c.toLowerCase(), css: c.toLowerCase(), custom: true };
  }
  const found = RANGER_COLORS.find(x => x.id === c);
  return found || RANGER_COLORS[index % RANGER_COLORS.length];
}

// 入力からプレイ用に確定した状態を作る(デフォルト名解決。randomはそのまま保持し再生時に抽選)
export function normalizeState(s) {
  const members = s.members
    .filter(m => (m.name || '').trim() || (m.mc || '').trim())
    .slice(0, MAX_MEMBERS)
    .map(m => ({
      name: (m.name || '').trim() || (m.mc || '').trim(),
      title: (m.title || '').trim(),
      mc: (m.mc || '').trim(),
      scene: m.scene || RANDOM,
      color: sanitizeColor(m.color),
    }));
  const first = members[0] ? members[0].name : '';
  return {
    squad: {
      name: (s.squad.name || '').trim() || `${first}と愉快な仲間たち`,
      title: (s.squad.title || '').trim(),
      scene: s.squad.scene || RANDOM,
    },
    members,
  };
}

// random指定を実際のシーンIDへ抽選(連続して同じ演出にならないように)
export function resolveScenes(state) {
  const pool = INTRO_SCENES.map(x => x.id);
  let prev = null;
  const members = state.members.map(m => {
    let id = m.scene;
    if (id === RANDOM || !pool.includes(id)) {
      const cand = pool.filter(x => x !== prev);
      id = cand[Math.floor(Math.random() * cand.length)];
    }
    prev = id;
    return { ...m, sceneResolved: id };
  });
  let teamId = state.squad.scene;
  const tpool = TEAM_SCENES.map(x => x.id);
  if (teamId === RANDOM || !tpool.includes(teamId)) {
    teamId = tpool[Math.floor(Math.random() * tpool.length)];
  }
  return { squad: { ...state.squad, sceneResolved: teamId }, members };
}

// ---- URL encode/decode ----
function b64urlEncode(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  bytes.forEach(b => bin += String.fromCharCode(b));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlDecode(str) {
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '='.repeat((4 - b64.length % 4) % 4));
  const bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function encodeState(state) {
  const compact = {
    v: 1,
    n: state.squad.name,
    t: state.squad.title,
    s: state.squad.scene,
    m: state.members.map(m => [m.name, m.title, m.mc, m.scene, m.color || AUTO_COLOR]),
  };
  return b64urlEncode(JSON.stringify(compact));
}

export function decodeState(param) {
  try {
    const c = JSON.parse(b64urlDecode(param));
    if (!c || !Array.isArray(c.m)) return null;
    return {
      squad: { name: c.n || '', title: c.t || '', scene: c.s || RANDOM },
      members: c.m.slice(0, MAX_MEMBERS).map(a => ({
        name: a[0] || '', title: a[1] || '', mc: a[2] || '', scene: a[3] || RANDOM,
        color: sanitizeColor(a[4]),
      })),
    };
  } catch {
    return null;
  }
}

export function shareURL(state) {
  const u = new URL(location.href);
  u.search = '?d=' + encodeState(state);
  u.hash = '';
  return u.toString();
}

// 16人フルメンバーのサンプル(Usernameなし=16色の戦隊スーツで登場)
export const SAMPLE_STATE_16 = {
  squad: { name: '超大戦隊マイクレンジャー16', title: '十六色の不滅隊列', scene: RANDOM },
  members: [
    ['マイクレッド', '灼熱の切り込み隊長'],
    ['マイクブルー', '蒼き深海の策士'],
    ['マイクイエロー', '雷鳴の暴れん坊'],
    ['マイクグリーン', '森を統べる影'],
    ['マイクピンク', '天空の射撃手'],
    ['マイクブラック', '闇に潜む参謀'],
    ['マイクホワイト', '静寂の剣聖'],
    ['マイクオレンジ', '爆裂のエンジン屋'],
    ['マイクパープル', '幻惑の魔術師'],
    ['マイクシアン', '氷河の狙撃手'],
    ['マイクライム', '疾風の韋駄天'],
    ['マイククリムゾン', '紅蓮の格闘王'],
    ['マイクネイビー', '深淵の航海士'],
    ['マイクゴールド', '黄金の守護者'],
    ['マイクシルバー', '流星の早撃ち'],
    ['マイクマグマ', '大地を焦がす拳'],
  ].map(([name, title]) => ({ name, title, mc: '', scene: RANDOM, color: AUTO_COLOR })),
};

export const SAMPLE_STATE = {
  squad: { name: 'クラフト戦隊マイクレンジャー', title: '大地を刻む五色の旋風', scene: RANDOM },
  members: [
    { name: 'マイクレッド',   title: '灼熱の切り込み隊長', mc: 'Notch',      scene: RANDOM },
    { name: 'マイクブルー',   title: '蒼き深海の策士',     mc: 'jeb_',       scene: RANDOM },
    { name: 'マイクイエロー', title: '雷鳴の暴れん坊',     mc: 'Dinnerbone', scene: RANDOM },
    { name: 'マイクグリーン', title: '森を統べる影',       mc: 'Grumm',      scene: RANDOM },
    { name: 'マイクピンク',   title: '天空の射撃手',       mc: 'MHF_Alex',   scene: RANDOM },
  ],
};
