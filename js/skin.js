// Minecraftスキン取得
// 1. PlayerDB (username -> uuid) + mineatar (uuid -> skin PNG)
//    ※uuidは不変なのでPlayerDBのキャッシュが古くても無害。
//      スキン本体はmineatarが新しいものを返す
// 2. フォールバック: Ashcon API (uuid+slim+スキンPNG一括だが、
//    スキンのキャッシュが数ヶ月単位で古いことがある)
// 3. UUID直接入力ならmineatarへ直行
// 4. 全部失敗したら戦隊カラーのスーツスキンを生成

const UUID_RE = /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i;

async function fetchWithTimeout(url, ms = 8000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function blobToCanvas(blob) {
  const bmp = await createImageBitmap(blob);
  const cv = document.createElement('canvas');
  cv.width = bmp.width; cv.height = bmp.height;
  cv.getContext('2d', { willReadFrequently: true }).drawImage(bmp, 0, 0);
  return cv;
}

// 取得したスキンを利用可能な形に整える(旧式変換 + 不透明オーバーレイ除去)
function prepareSkin(raw) {
  const legacy = raw.height < 64;
  const cv = convertLegacy(raw);
  stripSolidOverlays(cv, legacy);
  return cv;
}

// 完全不透明なオーバーレイ領域は旧式の「色キー」扱いなので消す
// (これをしないと旧スキンの頭が黒い箱を被ったように描画される)
function stripSolidOverlays(cv, legacy) {
  const g = cv.getContext('2d', { willReadFrequently: true });
  const regions = [
    [32, 0, 32, 16],   // hat
    [16, 32, 24, 16],  // jacket
    [40, 32, 16, 16],  // 右腕sleeve
    [0, 32, 16, 16],   // 右脚pants
    [0, 48, 16, 16],   // 左脚pants
    [48, 48, 16, 16],  // 左腕sleeve
  ];
  for (const [x, y, w, h] of regions) {
    const img = g.getImageData(x, y, w, h);
    const d = img.data;
    let allOpaque = true;
    let min = [255, 255, 255], max = [0, 0, 0];
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 250) { allOpaque = false; break; }
      for (let c = 0; c < 3; c++) {
        min[c] = Math.min(min[c], d[i + c]);
        max[c] = Math.max(max[c], d[i + c]);
      }
    }
    if (!allOpaque) continue;
    const uniform = (max[0] - min[0]) + (max[1] - min[1]) + (max[2] - min[2]) < 36;
    if (legacy || uniform) g.clearRect(x, y, w, h);
  }
}

// 旧式64x32スキンを64x64へ変換(右腕/右脚をミラーして左腕/左脚を生成)
function convertLegacy(src) {
  if (src.height >= 64) return src;
  const cv = document.createElement('canvas');
  cv.width = 64; cv.height = 64;
  const g = cv.getContext('2d', { willReadFrequently: true });
  g.drawImage(src, 0, 0);
  const mirror = (sx, sy, w, h, dx, dy) => {
    g.save();
    g.translate(dx + w, dy);
    g.scale(-1, 1);
    g.drawImage(src, sx, sy, w, h, 0, 0, w, h);
    g.restore();
  };
  // 右脚(0,16) -> 左脚(16,48)
  mirror(4, 16, 4, 4, 20, 48);   // top
  mirror(8, 16, 4, 4, 24, 48);   // bottom
  mirror(0, 20, 4, 12, 24, 52);
  mirror(4, 20, 4, 12, 20, 52);
  mirror(8, 20, 4, 12, 16, 52);
  mirror(12, 20, 4, 12, 28, 52);
  // 右腕(40,16) -> 左腕(32,48)
  mirror(44, 16, 4, 4, 36, 48);  // top
  mirror(48, 16, 4, 4, 40, 48);  // bottom
  mirror(40, 20, 4, 12, 40, 52);
  mirror(44, 20, 4, 12, 36, 52);
  mirror(48, 20, 4, 12, 32, 52);
  mirror(52, 20, 4, 12, 44, 52);
  return cv;
}

// slim(Alex型・腕3px)判定ヒューリスティック:
// classicでのみ使用されるテクスチャ領域が完全透明ならslim
function detectSlim(canvas) {
  const g = canvas.getContext('2d', { willReadFrequently: true });
  const regions = [
    [50, 16, 2, 4],   // 右腕 top/bottom行の右端(slimでは未使用)
    [54, 20, 2, 12],  // 右腕 側面行の右端
  ];
  for (const [x, y, w, h] of regions) {
    const data = g.getImageData(x, y, w, h).data;
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] > 8) return false; // 不透明ピクセルあり -> classic
    }
  }
  return true;
}

async function fromAshcon(username) {
  const res = await fetchWithTimeout(`https://api.ashcon.app/mojang/v2/user/${encodeURIComponent(username)}`);
  if (!res.ok) throw new Error(`ashcon ${res.status}`);
  const json = await res.json();
  const data = json?.textures?.skin?.data;
  if (!data) throw new Error('ashcon: no skin data');
  const bin = atob(data);
  const bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
  const canvas = prepareSkin(await blobToCanvas(new Blob([bytes], { type: 'image/png' })));
  const slim = typeof json?.textures?.slim === 'boolean' ? json.textures.slim : detectSlim(canvas);
  return { canvas, slim };
}

async function uuidFromPlayerDB(username) {
  const res = await fetchWithTimeout(`https://playerdb.co/api/player/minecraft/${encodeURIComponent(username)}`);
  if (!res.ok) throw new Error(`playerdb ${res.status}`);
  const json = await res.json();
  const id = json?.data?.player?.raw_id || json?.data?.player?.id;
  if (!id) throw new Error('playerdb: not found');
  return id;
}

async function fromMineatar(uuid) {
  const res = await fetchWithTimeout(`https://api.mineatar.io/skin/${uuid.replace(/-/g, '')}`);
  if (!res.ok) throw new Error(`mineatar ${res.status}`);
  const canvas = prepareSkin(await blobToCanvas(await res.blob()));
  return { canvas, slim: detectSlim(canvas) };
}

// スーツの胴体・腕・脚をcanvasに描く(頭は対象外)
function drawSuitBody(g, colorCss) {
  const base = colorCss;
  const dark = shade(colorCss, -0.35);
  const darker = shade(colorCss, -0.55);
  const lite = shade(colorCss, 0.25);

  const box = (u, v, w, h, d, colors) => {
    // colors: {top,bottom,right,front,left,back}
    g.fillStyle = colors.top;    g.fillRect(u + d, v, w, d);
    g.fillStyle = colors.bottom; g.fillRect(u + d + w, v, w, d);
    g.fillStyle = colors.right;  g.fillRect(u, v + d, d, h);
    g.fillStyle = colors.front;  g.fillRect(u + d, v + d, w, h);
    g.fillStyle = colors.left;   g.fillRect(u + d + w, v + d, d, h);
    g.fillStyle = colors.back;   g.fillRect(u + d + w + d, v + d, w, h);
  };

  // 胴体: スーツ + 白ベルト + 胸のV
  box(16, 16, 8, 12, 4, { top: dark, bottom: darker, right: dark, front: base, left: dark, back: dark });
  g.fillStyle = '#f2f4fa';
  g.fillRect(20, 27, 8, 2);         // ベルト
  g.fillStyle = '#ffd34d';
  g.fillRect(23, 27, 2, 2);         // バックル
  g.fillStyle = lite;
  g.fillRect(20, 20, 8, 1);         // 胸ライン

  // 右腕 / 左腕: スーツ + 白手袋
  const armC = { top: dark, bottom: '#f2f4fa', right: dark, front: base, left: dark, back: dark };
  box(40, 16, 4, 12, 4, armC);
  box(32, 48, 4, 12, 4, armC);
  g.fillStyle = '#f2f4fa';
  g.fillRect(40, 26, 16, 2);        // 右手袋
  g.fillRect(32, 58, 16, 2);        // 左手袋

  // 右脚 / 左脚: スーツ + 白ブーツ
  const legC = { top: darker, bottom: '#f2f4fa', right: dark, front: base, left: dark, back: dark };
  box(0, 16, 4, 12, 4, legC);
  box(16, 48, 4, 12, 4, legC);
  g.fillStyle = '#f2f4fa';
  g.fillRect(0, 29, 16, 3);         // 右ブーツ
  g.fillRect(16, 61, 16, 3);        // 左ブーツ

  return { base, dark, darker, lite, box };
}

// 取得失敗・未入力時: 戦隊スーツスキンを生成(ヘルメット付きフルスーツ)
export function makeSuitSkin(colorCss) {
  const cv = document.createElement('canvas');
  cv.width = 64; cv.height = 64;
  const g = cv.getContext('2d', { willReadFrequently: true });

  const { base, dark, darker, lite, box } = drawSuitBody(g, colorCss);

  // 頭: ヘルメット + 黒バイザー
  box(0, 0, 8, 8, 8, { top: lite, bottom: darker, right: dark, front: base, left: dark, back: dark });
  g.fillStyle = '#14161f';
  g.fillRect(9, 10, 6, 3);          // バイザー(前面)
  g.fillStyle = '#3b4a6b';
  g.fillRect(10, 11, 4, 1);         // バイザー反射
  g.fillStyle = '#c8ccda';
  g.fillRect(11, 14, 2, 1);         // マウスプレート

  return { canvas: cv, slim: false, fallback: true };
}

// スーツ統一モード用: 体はメンバーカラーのスーツ、頭(顔)は本人のスキンのまま
export function makeSuitedSkin(baseSkin, colorCss) {
  const cv = document.createElement('canvas');
  cv.width = 64; cv.height = 64;
  const g = cv.getContext('2d', { willReadFrequently: true });

  drawSuitBody(g, colorCss);
  // 頭+帽子レイヤー(上段16px)だけ本人のスキンから移植
  g.clearRect(0, 0, 64, 16);
  g.drawImage(baseSkin.canvas, 0, 0, 64, 16, 0, 0, 64, 16);

  // スーツは腕4px(classic)で描いているのでモデルもclassicで表示する
  return { canvas: cv, slim: false };
}

function shade(hex, amt) {
  const n = parseInt(hex.replace('#', ''), 16);
  let r = (n >> 16) & 255, g2 = (n >> 8) & 255, b = n & 255;
  if (amt >= 0) {
    r += (255 - r) * amt; g2 += (255 - g2) * amt; b += (255 - b) * amt;
  } else {
    r *= 1 + amt; g2 *= 1 + amt; b *= 1 + amt;
  }
  return `rgb(${r | 0},${g2 | 0},${b | 0})`;
}

const cache = new Map();

export async function loadSkin(query, fallbackColor = '#ff3b30') {
  const key = (query || '').trim().toLowerCase();
  if (!key) return makeSuitSkin(fallbackColor);
  if (cache.has(key)) return cache.get(key);

  let result = null;
  try {
    if (UUID_RE.test(key)) {
      result = await fromMineatar(key);
    } else {
      try {
        const uuid = await uuidFromPlayerDB(key);
        result = await fromMineatar(uuid);
      } catch {
        result = await fromAshcon(key);
      }
    }
  } catch (e) {
    console.warn(`skin load failed for "${query}":`, e);
    // フォールバックスーツはメンバーカラー依存なのでキャッシュしない
    return makeSuitSkin(fallbackColor);
  }
  cache.set(key, result);
  return result;
}
