// 登場物: プレイヤーモデル/ポーズ/小道具/Mob

import * as THREE from 'three';
import { E, clamp01, lerp, rand, randPick, seg } from './core.js';
import { makeBlock } from './engine.js';

// ============================================================
// [player.js より統合]
// ============================================================

// Minecraftスキンを着た関節付き3Dキャラクター
// バニラモデルと違い、肘・膝で曲がる8セグメントリグ
//
// 構造:
//   root(this) … 足元原点
//     hips(y=12px)
//       legR.hip / legL.hip → knee → 下脚
//       spine
//         torso
//         head(y=+12px)
//         armR.shoulder / armL.shoulder → elbow → 前腕
//
// モデルは +Z 方向を向く。1px = 1/16 unit、全高2.0

export const PX = 1 / 16;
const TEX = 64;

// スキンレイアウト上の各面rect。モデルは+Zが正面。
// +x=キャラ左, -x=キャラ右
function boxRects(u, v, w, h, d) {
  return {
    nx: { x1: u, y1: v + d, x2: u + d, y2: v + d + h },                       // キャラ右側面
    pz: { x1: u + d, y1: v + d, x2: u + d + w, y2: v + d + h },               // 正面
    px: { x1: u + d + w, y1: v + d, x2: u + d + w + d, y2: v + d + h },       // キャラ左側面
    nz: { x1: u + d + w + d, y1: v + d, x2: u + d + w + d + w, y2: v + d + h }, // 背面
    py: { x1: u + d, y1: v, x2: u + d + w, y2: v + d },                       // 上面
    ny: { x1: u + d + w, y1: v, x2: u + d + w + w, y2: v + d },               // 底面
  };
}

// BoxGeometryのUVを書き換える。face順: px,nx,py,ny,pz,nz
// 各faceのUV頂点順は [左上,右上,左下,右下]。底面のみ上下反転(MC仕様)。
function applyRectUVs(geom, rects) {
  const order = ['px', 'nx', 'py', 'ny', 'pz', 'nz'];
  const uv = geom.attributes.uv;
  order.forEach((k, fi) => {
    const r = rects[k];
    const u1 = r.x1 / TEX, u2 = r.x2 / TEX;
    const v1 = 1 - r.y1 / TEX, v2 = 1 - r.y2 / TEX;
    const corners = (k === 'ny')
      ? [[u1, v2], [u2, v2], [u1, v1], [u2, v1]]
      : [[u1, v1], [u2, v1], [u1, v2], [u2, v2]];
    corners.forEach((c, vi) => uv.setXY(fi * 4 + vi, c[0], c[1]));
  });
  uv.needsUpdate = true;
}

// 縦スライスしたrect群(手足の上半分/下半分用)
function slicedRects(u, v, w, h, d, sliceTop, sliceH) {
  const r = boxRects(u, v, w, h, d);
  const y1 = v + d + sliceTop, y2 = y1 + sliceH;
  for (const k of ['nx', 'pz', 'px', 'nz']) {
    r[k] = { x1: r[k].x1, y1, x2: r[k].x2, y2 };
  }
  if (sliceTop > 0) {
    // 切断面: 近傍1px行を引き伸ばして埋める(ほぼ見えない)
    r.py = { x1: u + d, y1, x2: u + d + w, y2: y1 + 1 };
  }
  if (sliceTop + sliceH < h) {
    r.ny = { x1: u + d, y1: y2 - 1, x2: u + d + w, y2 };
  }
  return r;
}

function buildBox(w, h, d, rects, mat) {
  const geom = new THREE.BoxGeometry(w * PX, h * PX, d * PX);
  applyRectUVs(geom, rects);
  const mesh = new THREE.Mesh(geom, mat);
  mesh.castShadow = true;
  return mesh;
}

export class PlayerModel extends THREE.Group {
  constructor(skin) {
    super();
    const tex = new THREE.CanvasTexture(skin.canvas);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
    tex.colorSpace = THREE.SRGBColorSpace;
    this.tex = tex;

    this.matBase = new THREE.MeshStandardMaterial({
      map: tex, roughness: 0.85, metalness: 0.0,
    });
    this.matOverlay = new THREE.MeshStandardMaterial({
      map: tex, roughness: 0.85, metalness: 0.0,
      transparent: true, alphaTest: 0.4, side: THREE.DoubleSide,
    });

    const aw = skin.slim ? 3 : 4;
    this.slim = skin.slim;

    const J = (parent, x, y, z) => {
      const g = new THREE.Group();
      g.position.set(x * PX, y * PX, z * PX);
      parent.add(g);
      return g;
    };

    // 部位追加: 本体box + overlay box
    const part = (parent, { u, v, w, h, d, ou, ov, cy, sliceTop = 0, sliceH = null, inflate = 0.5 }) => {
      sliceH = sliceH ?? h;
      const g = new THREE.Group();
      g.position.y = cy * PX;
      g.add(buildBox(w, sliceH, d, slicedRects(u, v, w, h, d, sliceTop, sliceH), this.matBase));
      if (ou !== undefined) {
        const ov2 = buildBox(w + inflate, sliceH + inflate, d + inflate,
          slicedRects(ou, ov, w, h, d, sliceTop, sliceH), this.matOverlay);
        ov2.castShadow = false;
        g.add(ov2);
      }
      parent.add(g);
      return g;
    };

    // 手足: 上下2セグメント + 関節充填キューブ
    const limb = (parent, px, py, uvd, yTop) => {
      const pivot = J(parent, px, py, 0);
      part(pivot, { ...uvd, sliceTop: 0, sliceH: 6, cy: yTop - 3 });
      const mid = J(pivot, 0, yTop - 6, 0);
      part(mid, { ...uvd, sliceTop: 6, sliceH: 6, cy: -3 });
      // 関節の隙間埋め
      const fillerRects = slicedRects(uvd.u, uvd.v, uvd.w, uvd.h, uvd.d, 5, 2);
      const filler = buildBox(uvd.w - 0.25, 2.8, uvd.d - 0.25, fillerRects, this.matBase);
      mid.add(filler);
      return { pivot, mid };
    };

    this.hips = J(this, 0, 12, 0);
    this.spine = J(this.hips, 0, 0, 0);

    this.torso = part(this.spine, { u: 16, v: 16, w: 8, h: 12, d: 4, ou: 16, ov: 32, cy: 6 });
    this.head = J(this.spine, 0, 12, 0);
    this.headMesh = part(this.head, { u: 0, v: 0, w: 8, h: 8, d: 8, ou: 32, ov: 0, cy: 4, inflate: 1.0 });

    const armR = limb(this.spine, -(4 + aw / 2), 10, { u: 40, v: 16, w: aw, h: 12, d: 4, ou: 40, ov: 32 }, 2);
    const armL = limb(this.spine, +(4 + aw / 2), 10, { u: 32, v: 48, w: aw, h: 12, d: 4, ou: 48, ov: 48 }, 2);
    const legR = limb(this.hips, -2, 0, { u: 0, v: 16, w: 4, h: 12, d: 4, ou: 0, ov: 32 }, 0);
    const legL = limb(this.hips, 2, 0, { u: 16, v: 48, w: 4, h: 12, d: 4, ou: 0, ov: 48 }, 0);

    this.armR = { shoulder: armR.pivot, elbow: armR.mid };
    this.armL = { shoulder: armL.pivot, elbow: armL.mid };
    this.legR = { hip: legR.pivot, knee: legR.mid };
    this.legL = { hip: legL.pivot, knee: legL.mid };

    // 手・道具のアタッチポイント(前腕の先端)
    this.handR = J(this.armR.elbow, 0, -6, 0);
    this.handL = J(this.armL.elbow, 0, -6, 0);

    this.joints = [
      this.hips, this.spine, this.head,
      this.armR.shoulder, this.armR.elbow, this.armL.shoulder, this.armL.elbow,
      this.legR.hip, this.legR.knee, this.legL.hip, this.legL.knee,
    ];
  }

  resetPose() {
    for (const j of this.joints) j.rotation.set(0, 0, 0);
    this.hips.position.set(0, 12 * PX, 0);
  }

  resetAll() {
    this.resetPose();
    this.position.set(0, 0, 0);
    this.rotation.order = 'XYZ';
    this.rotation.set(0, 0, 0);
    this.scale.set(1, 1, 1);
    this.visible = true;
    this.handR.clear();
    this.handL.clear();
  }

  dispose() {
    this.traverse(o => {
      if (o.geometry) o.geometry.dispose();
    });
    this.matBase.dispose();
    this.matOverlay.dispose();
    this.tex.dispose();
  }
}

// ============================================================
// [anim.js より統合]
// ============================================================

// ポーズ・プロシージャルアニメーションヘルパー
// 規約: モデルは+Zを向く。腕/脚の前方スイング = rotation.x 負。膝は正で後ろに曲がる。

const HIPS_Y = 12 * PX;

// 全力疾走
export function runPose(p, t, { speed = 11, amp = 1, lean = 0.3 } = {}) {
  const s = Math.sin(t * speed), c = Math.cos(t * speed);
  p.legR.hip.rotation.x = -s * 0.95 * amp;
  p.legL.hip.rotation.x = s * 0.95 * amp;
  p.legR.knee.rotation.x = (0.18 + 1.5 * Math.max(0, Math.sin(t * speed - 1.2))) * amp;
  p.legL.knee.rotation.x = (0.18 + 1.5 * Math.max(0, Math.sin(t * speed + Math.PI - 1.2))) * amp;
  p.armR.shoulder.rotation.x = s * 1.15 * amp;
  p.armL.shoulder.rotation.x = -s * 1.15 * amp;
  p.armR.shoulder.rotation.z = -0.07;
  p.armL.shoulder.rotation.z = 0.07;
  p.armR.elbow.rotation.x = -(0.55 + 0.5 * Math.max(0, -s)) * amp;
  p.armL.elbow.rotation.x = -(0.55 + 0.5 * Math.max(0, s)) * amp;
  p.spine.rotation.x = lean * amp;
  p.spine.rotation.y = s * 0.1 * amp;
  p.head.rotation.x = -lean * 0.75 * amp;
  p.hips.position.y = HIPS_Y + (Math.abs(c) * 0.07 - 0.045) * amp;
}

// 直立(呼吸つき)
export function idlePose(p, t) {
  const b = Math.sin(t * 2.2);
  p.spine.rotation.x = 0.02 + b * 0.012;
  p.head.rotation.x = -0.02 - b * 0.01;
  p.armR.shoulder.rotation.x = b * 0.03;
  p.armL.shoulder.rotation.x = -b * 0.03;
  p.armR.shoulder.rotation.z = -0.05;
  p.armL.shoulder.rotation.z = 0.05;
  p.armR.elbow.rotation.x = -0.08;
  p.armL.elbow.rotation.x = -0.08;
  p.hips.position.y = HIPS_Y;
}

// しゃがみ(k: 0..1)
export function crouchPose(p, k) {
  p.hips.position.y = HIPS_Y - 0.3 * k;
  p.spine.rotation.x = 0.55 * k;
  p.head.rotation.x = -0.5 * k;
  p.legR.hip.rotation.x = -1.15 * k;
  p.legL.hip.rotation.x = -1.15 * k;
  p.legR.knee.rotation.x = 1.95 * k;
  p.legL.knee.rotation.x = 1.95 * k;
  p.armR.shoulder.rotation.x = 0.6 * k;
  p.armL.shoulder.rotation.x = 0.6 * k;
  p.armR.shoulder.rotation.z = -0.15 * k;
  p.armL.shoulder.rotation.z = 0.15 * k;
  p.armR.elbow.rotation.x = -0.4 * k;
  p.armL.elbow.rotation.x = -0.4 * k;
}

// ジャンプ上昇(腕を振り上げ脚を流す)
export function jumpRisePose(p, k) {
  p.hips.position.y = HIPS_Y;
  p.spine.rotation.x = -0.18 * k;
  p.head.rotation.x = -0.25 * k;
  p.armR.shoulder.rotation.x = -2.6 * k;
  p.armL.shoulder.rotation.x = -2.6 * k;
  p.armR.shoulder.rotation.z = -0.35 * k;
  p.armL.shoulder.rotation.z = 0.35 * k;
  p.armR.elbow.rotation.x = -0.2 * k;
  p.armL.elbow.rotation.x = -0.2 * k;
  p.legR.hip.rotation.x = 0.45 * k;
  p.legL.hip.rotation.x = 0.25 * k;
  p.legR.knee.rotation.x = 0.7 * k;
  p.legL.knee.rotation.x = 1.1 * k;
}

// 空中タック(丸まり)
export function tuckPose(p, k) {
  p.spine.rotation.x = 0.8 * k;
  p.head.rotation.x = 0.3 * k;
  p.legR.hip.rotation.x = -1.9 * k;
  p.legL.hip.rotation.x = -1.9 * k;
  p.legR.knee.rotation.x = 2.4 * k;
  p.legL.knee.rotation.x = 2.4 * k;
  p.armR.shoulder.rotation.x = -1.6 * k;
  p.armL.shoulder.rotation.x = -1.6 * k;
  p.armR.elbow.rotation.x = -1.8 * k;
  p.armL.elbow.rotation.x = -1.8 * k;
}

// スーパーヒーロー着地(片膝・拳を地面に)
export function heroLandPose(p, k) {
  p.hips.position.y = HIPS_Y - 0.62 * k;
  p.spine.rotation.x = 0.5 * k;
  p.head.rotation.x = -0.55 * k;
  // 左脚を前に立て、右膝を地面へ
  p.legL.hip.rotation.x = -1.7 * k;
  p.legL.knee.rotation.x = 1.8 * k;
  p.legR.hip.rotation.x = 0.45 * k;
  p.legR.knee.rotation.x = 1.85 * k;
  // 右拳を地面へ、左腕は後ろに流す
  p.armR.shoulder.rotation.x = -0.35 * k;
  p.armR.elbow.rotation.x = -0.15 * k;
  p.armL.shoulder.rotation.x = 1.15 * k;
  p.armL.shoulder.rotation.z = 0.5 * k;
  p.armL.elbow.rotation.x = -0.3 * k;
}

// スーパーマン飛行
export function flyPose(p, k = 1) {
  p.armR.shoulder.rotation.x = -3.05 * k;     // 右腕前方へ突き出し
  p.armR.elbow.rotation.x = -0.06;
  p.armL.shoulder.rotation.x = 0.5 * k;       // 左腕は体側後ろ
  p.armL.elbow.rotation.x = -0.15;
  p.legR.hip.rotation.x = 0.12 * k;
  p.legL.hip.rotation.x = -0.05 * k;
  p.legR.knee.rotation.x = 0.1;
  p.legL.knee.rotation.x = 0.18;
  p.spine.rotation.x = -0.1 * k;
  p.head.rotation.x = -1.05 * k;              // 進行方向を見る
}

// ---- 静止キメポーズ集(チームシーンなどで使用) ----
function breathe(p, t) {
  const b = Math.sin(t * 2.4) * 0.012;
  p.spine.rotation.x += b;
  p.head.rotation.x -= b;
}

export const heroPoses = [
  // 腕組み
  (p, t) => {
    p.resetPose();
    p.armR.shoulder.rotation.x = -1.18;
    p.armL.shoulder.rotation.x = -1.02;
    p.armR.shoulder.rotation.y = 1.15;   // 前腕が胸の前で交差するよう肩をロール
    p.armL.shoulder.rotation.y = -1.15;
    p.armR.elbow.rotation.x = -2.1;
    p.armL.elbow.rotation.x = -2.1;
    p.legR.hip.rotation.z = -0.14;
    p.legL.hip.rotation.z = 0.14;
    p.spine.rotation.x = -0.06;
    p.head.rotation.x = 0.03;
    breathe(p, t);
  },
  // 拳を天に
  (p, t) => {
    p.resetPose();
    p.armR.shoulder.rotation.x = -2.95;
    p.armR.shoulder.rotation.z = -0.12;
    p.armL.shoulder.rotation.x = 0.5;
    p.armL.shoulder.rotation.z = 0.25;
    p.armL.elbow.rotation.x = -0.4;
    p.head.rotation.x = -0.4;
    p.spine.rotation.x = -0.12;
    p.legR.hip.rotation.z = -0.16;
    p.legL.hip.rotation.z = 0.16;
    breathe(p, t);
  },
  // 正面指差し
  (p, t) => {
    p.resetPose();
    p.armR.shoulder.rotation.x = -1.55;
    p.armR.elbow.rotation.x = -0.05;
    p.armL.shoulder.rotation.x = 0.55;
    p.armL.shoulder.rotation.z = 0.3;
    p.armL.elbow.rotation.x = -0.5;
    p.spine.rotation.x = 0.1;
    p.spine.rotation.y = -0.25;
    p.head.rotation.y = 0.25;
    p.legR.hip.rotation.x = -0.3;
    p.legL.hip.rotation.x = 0.15;
    breathe(p, t);
  },
  // 仁王立ち(腰に手)
  (p, t) => {
    p.resetPose();
    p.armR.shoulder.rotation.x = 0.15;
    p.armL.shoulder.rotation.x = 0.15;
    p.armR.shoulder.rotation.z = -0.5;
    p.armL.shoulder.rotation.z = 0.5;
    p.armR.shoulder.rotation.y = 1.35;   // 前腕を腰へ折り込む
    p.armL.shoulder.rotation.y = -1.35;
    p.armR.elbow.rotation.x = -1.35;
    p.armL.elbow.rotation.x = -1.35;
    p.legR.hip.rotation.z = -0.12;
    p.legL.hip.rotation.z = 0.12;
    p.spine.rotation.x = -0.08;
    breathe(p, t);
  },
  // 片膝キメ
  (p, t) => {
    p.resetPose();
    heroLandPose(p, 1);
    p.head.rotation.x = -0.75;
    breathe(p, t);
  },
  // ダブルナックル(前傾パワー)
  (p, t) => {
    p.resetPose();
    crouchPose(p, 0.3);
    p.armR.shoulder.rotation.x = -0.55;
    p.armL.shoulder.rotation.x = -0.55;
    p.armR.shoulder.rotation.z = -0.3;
    p.armL.shoulder.rotation.z = 0.3;
    p.armR.elbow.rotation.x = -0.85;
    p.armL.elbow.rotation.x = -0.85;
    p.head.rotation.x = -0.55;
    breathe(p, t);
  },
  // 構え(カラテ)
  (p, t) => {
    p.resetPose();
    p.armR.shoulder.rotation.x = -1.85;
    p.armR.elbow.rotation.x = -0.35;
    p.armL.shoulder.rotation.x = -0.6;
    p.armL.shoulder.rotation.z = 0.4;
    p.armL.elbow.rotation.x = -1.2;
    p.legR.hip.rotation.x = -0.75;
    p.legR.knee.rotation.x = 0.8;
    p.legL.hip.rotation.x = 0.4;
    p.legL.knee.rotation.x = 0.35;
    p.hips.position.y = HIPS_Y - 0.12;
    p.spine.rotation.x = 0.12;
    p.spine.rotation.y = 0.3;
    p.head.rotation.y = -0.3;
    breathe(p, t);
  },
  // Vサイン両腕
  (p, t) => {
    p.resetPose();
    p.armR.shoulder.rotation.x = -2.75;
    p.armL.shoulder.rotation.x = -2.75;
    p.armR.shoulder.rotation.z = -0.55;
    p.armL.shoulder.rotation.z = 0.55;
    p.head.rotation.x = -0.3;
    p.spine.rotation.x = -0.1;
    p.legR.hip.rotation.z = -0.18;
    p.legL.hip.rotation.z = 0.18;
    breathe(p, t);
  },
];

// ---- 退場ジャンプ(共通: 屈んで → 勢いよく画面外へ) ----
// 使い方: init内で const exit = makeExit(player, tStart, ctx, opts)
//         update内で if (exit(t)) return; (退場中は他のポーズ処理をスキップ)
export function makeExit(p, t0, ctx, opts = {}) {
  const { vx = 1.5, vy = 10.5, vz = 4.5, spin = 0 } = opts;
  let base = null;
  let fired = false;
  return (t) => {
    if (t < t0) return false;
    if (!base) base = p.position.clone();
    const crouchEnd = t0 + 0.32;
    if (t < crouchEnd) {
      p.resetPose();
      crouchPose(p, seg(t, t0, crouchEnd, E.outQuad));
      return true;
    }
    if (!fired) {
      fired = true;
      ctx.sfx.whoosh(0.55, 0.6);
      ctx.fx.burst({
        pos: { x: p.position.x, y: p.position.y + 0.1, z: p.position.z },
        count: 26, colors: ['#cfd8ea', '#8fa0c0'], speed: 2.4, gravity: -2,
        life: 0.7, size: 0.07, additive: false,
      });
      ctx.fx.ring({ pos: { x: p.position.x, y: p.position.y + 0.03, z: p.position.z }, r1: 1.6, life: 0.45, color: 0xbfd0ff });
    }
    const tt = t - crouchEnd;
    p.resetPose();
    jumpRisePose(p, clamp01(tt * 4));
    p.position.set(base.x + vx * tt, base.y + vy * tt + 6 * tt * tt, base.z + vz * tt);
    if (spin) p.rotation.y += spin * 0.016;
    return true;
  };
}

// 補間ユーティリティ: 2つのポーズ適用関数をブレンドしたいときに使う簡易版
export function lerpAngle(a, b, t) { return lerp(a, b, t); }

// ============================================================
// [props.js より統合]
// ============================================================

// シーン用小道具(ツルハシ・ネコ・ビル群・石柱・ブロック壁)

function box(w, h, d, color, opts = {}) {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color, roughness: opts.roughness ?? 0.9, metalness: opts.metalness ?? 0, emissive: opts.emissive ?? 0x000000, emissiveIntensity: opts.emissiveIntensity ?? 1 })
  );
  m.castShadow = true;
  return m;
}

// ツルハシ(handRにattachして使用)
export function makePickaxe() {
  const g = new THREE.Group();
  const handle = box(2 * PX, 14 * PX, 2 * PX, 0x8a6038);
  handle.position.y = -3 * PX;
  g.add(handle);
  const head = box(12 * PX, 2.4 * PX, 2.6 * PX, 0x9aa3ad, { metalness: 0.5, roughness: 0.45 });
  head.position.y = 4 * PX;
  g.add(head);
  const tipL = box(2.4 * PX, 3.5 * PX, 2.4 * PX, 0x9aa3ad, { metalness: 0.5, roughness: 0.45 });
  tipL.position.set(-6 * PX, 2.6 * PX, 0);
  g.add(tipL);
  const tipR = tipL.clone();
  tipR.position.x = 6 * PX;
  g.add(tipR);
  return g;
}

// ネコ(しっぽ参照付き)
export function makeCat() {
  const g = new THREE.Group();
  const orange = 0xe8923a, cream = 0xf5e7c8, dark = 0x2a2018;

  const body = box(0.22, 0.2, 0.42, orange);
  body.position.set(0, 0.21, 0);
  g.add(body);

  const head = box(0.24, 0.22, 0.22, orange);
  head.position.set(0, 0.36, 0.26);
  g.add(head);
  g.head = head;

  const snout = box(0.12, 0.08, 0.04, cream);
  snout.position.set(0, -0.04, 0.13);
  head.add(snout);

  for (const sx of [-1, 1]) {
    const ear = box(0.06, 0.08, 0.04, orange);
    ear.position.set(sx * 0.08, 0.15, -0.02);
    head.add(ear);
    const eye = box(0.035, 0.035, 0.012, dark);
    eye.position.set(sx * 0.06, 0.03, 0.115);
    head.add(eye);
  }

  for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
    const leg = box(0.07, 0.14, 0.07, sz > 0 ? orange : cream);
    leg.position.set(sx * 0.07, 0.07, sz * 0.14);
    g.add(leg);
  }

  const tail = new THREE.Group();
  tail.position.set(0, 0.3, -0.21);
  const tailSeg = box(0.05, 0.05, 0.3, orange);
  tailSeg.position.z = -0.14;
  tail.add(tailSeg);
  const tailTip = box(0.055, 0.055, 0.1, cream);
  tailTip.position.z = -0.32;
  tail.add(tailTip);
  g.add(tail);
  g.tail = tail;

  return g;
}

// 夜のビル群シルエット(遠景)
export function makeCityline({ z = -34, spread = 55, count = 26 } = {}) {
  const g = new THREE.Group();
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const mat = new THREE.MeshStandardMaterial({ color: 0x0b1020, roughness: 1 });
  for (let i = 0; i < count; i++) {
    const w = rand(2.5, 7), h = rand(4, 17), d = rand(2.5, 6);
    const m = new THREE.Mesh(geo, mat);
    m.scale.set(w, h, d);
    m.position.set(rand(-spread, spread), h / 2 - 0.1, z - rand(0, 18));
    g.add(m);
    // 窓明かり(まばらな光点)
    if (Math.random() < 0.75) {
      const n = Math.floor(rand(4, 14));
      const pts = new Float32Array(n * 3);
      for (let k = 0; k < n; k++) {
        pts[k * 3] = m.position.x + rand(-w * 0.42, w * 0.42);
        pts[k * 3 + 1] = rand(0.5, h * 0.95);
        pts[k * 3 + 2] = m.position.z + d / 2 + 0.05;
      }
      const pg = new THREE.BufferGeometry();
      pg.setAttribute('position', new THREE.BufferAttribute(pts, 3));
      const pm = new THREE.PointsMaterial({
        color: randPick([0xffd98a, 0x9fc4ff, 0xffe9c0]), size: 0.16,
        transparent: true, opacity: 0.9, depthWrite: false,
      });
      g.add(new THREE.Points(pg, pm));
    }
  }
  return g;
}

// 1x1ブロック積みの高い柱(ネコ救出用)。草+土+石のMCテクスチャ
export function makePillar(height = 6, blockSize = 1) {
  const g = new THREE.Group();
  for (let i = 0; i < height; i++) {
    const isTop = i === height - 1;
    const type = isTop ? 'grass' : (i >= height - 3 ? 'dirt' : 'stone');
    const m = makeBlock(type, blockSize);
    m.position.y = i * blockSize + blockSize / 2;
    g.add(m);
  }
  g.topY = height * blockSize;
  return g;
}

// ブロック壁(採掘登場用)。blocks配列を返しシーン側で破壊できる
export function makeBlockWall({ cols = 7, rows = 5, size = 0.8 } = {}) {
  const g = new THREE.Group();
  const blocks = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const m = makeBlock(Math.random() < 0.85 ? 'stone' : 'deepslate', size);
      m.position.set((c - (cols - 1) / 2) * size, r * size + size / 2, 0);
      m.gridPos = { c, r };
      g.add(m);
      blocks.push(m);
    }
  }
  g.blocks = blocks;
  g.blockSize = size;
  return g;
}

// トロッコ(上が開いた箱)
export function makeMinecart() {
  const g = new THREE.Group();
  const metal = { roughness: 0.45, metalness: 0.55 };
  const bottom = box(0.95, 0.12, 0.62, 0x575c66, metal);
  bottom.position.y = 0.12;
  g.add(bottom);
  for (const [w, d, px, pz] of [
    [0.95, 0.08, 0, 0.31], [0.95, 0.08, 0, -0.31],
    [0.08, 0.62, 0.48, 0], [0.08, 0.62, -0.48, 0],
  ]) {
    const wall = box(w, 0.42, d, 0x4a4f59, metal);
    wall.position.set(px, 0.37, pz);
    g.add(wall);
  }
  return g;
}

// レール(x軸方向に伸びる)
export function makeRails(length = 24) {
  const g = new THREE.Group();
  const metal = { roughness: 0.4, metalness: 0.6 };
  for (const z of [-0.22, 0.22]) {
    const rail = box(length, 0.05, 0.08, 0x9aa3ad, metal);
    rail.position.set(0, 0.085, z);
    g.add(rail);
  }
  const ties = Math.floor(length / 0.6);
  for (let i = 0; i < ties; i++) {
    const tie = box(0.18, 0.06, 0.72, 0x6e4f30);
    tie.position.set(-length / 2 + i * 0.6 + 0.3, 0.03, 0);
    tie.receiveShadow = true;
    g.add(tie);
  }
  return g;
}

// ぽこぽこした白い雲(昼シーン用)
export function makeClouds({ count = 8, yMin = 9, yMax = 16 } = {}) {
  const g = new THREE.Group();
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, emissive: 0x666677 });
  for (let i = 0; i < count; i++) {
    const cloud = new THREE.Group();
    const parts = Math.floor(rand(2, 5));
    let x = 0;
    for (let k = 0; k < parts; k++) {
      const m = new THREE.Mesh(geo, mat);
      m.scale.set(rand(2.5, 5), rand(0.7, 1.2), rand(1.6, 3));
      m.position.set(x, rand(-0.2, 0.2), rand(-0.5, 0.5));
      x += m.scale.x * 0.55;
      cloud.add(m);
    }
    cloud.position.set(rand(-40, 40), rand(yMin, yMax), rand(-45, 5));
    g.add(cloud);
  }
  return g;
}

// ヘリポート風の円形ステージ
export function makePad(radius = 3.2) {
  const g = new THREE.Group();
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius * 1.04, 0.18, 40),
    new THREE.MeshStandardMaterial({ color: 0x232a3c, roughness: 0.8 })
  );
  base.position.y = 0.09;
  base.receiveShadow = true;
  g.add(base);
  const ringGeo = new THREE.RingGeometry(radius * 0.82, radius * 0.9, 40);
  const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xffd76a, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.181;
  g.add(ring);
  return g;
}

// ============================================================
// [mobs.js より統合]
// ============================================================

// Minecraft風Mobたち(演出用の簡易ボクセルモデル)と関連小道具

function mbox(w, h, d, color, opts = {}) {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({
      color, roughness: opts.roughness ?? 0.95, metalness: 0,
      emissive: opts.emissive ?? 0x000000, emissiveIntensity: opts.emissiveIntensity ?? 1,
      transparent: opts.transparent ?? false, opacity: opts.opacity ?? 1,
    })
  );
  m.castShadow = true;
  return m;
}

// 上端ピボットの脚(walk用)
function leg(parent, w, h, d, color, x, y, z) {
  const pivot = new THREE.Group();
  pivot.position.set(x, y, z);
  const m = mbox(w, h, d, color);
  m.position.y = -h / 2;
  pivot.add(m);
  parent.add(pivot);
  return pivot;
}

// 4足/2足歩行アニメ(legs: [FL,FR,BL,BR] or [L,R])
export function mobWalk(mob, t, speed = 8, amp = 0.5) {
  if (!mob.legs) return;
  mob.legs.forEach((l, i) => {
    const phase = (i % 2 ? Math.PI : 0) + (i > 1 ? Math.PI : 0);
    l.rotation.x = Math.sin(t * speed + phase) * amp;
  });
}

function speckleTex(base, variants, drawFace = null) {
  const cv = document.createElement('canvas');
  cv.width = 16; cv.height = 16;
  const g = cv.getContext('2d');
  g.fillStyle = base;
  g.fillRect(0, 0, 16, 16);
  for (let i = 0; i < 90; i++) {
    g.fillStyle = randPick(variants);
    g.fillRect(Math.floor(rand(16)), Math.floor(rand(16)), 1, 1);
  }
  if (drawFace) drawFace(g);
  const t = new THREE.CanvasTexture(cv);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ============ クリーパー ============
export function makeCreeper() {
  const g = new THREE.Group();
  const GREENS = ['#3f8f2f', '#57aa42', '#346f27', '#62b54e'];
  const bodyTex = speckleTex('#4a9c38', GREENS);
  const faceTex = speckleTex('#4a9c38', GREENS, (c) => {
    c.fillStyle = '#0d1a0a';
    c.fillRect(3, 4, 3, 3); c.fillRect(10, 4, 3, 3);       // 目
    c.fillRect(6, 7, 4, 4);                                 // 口中央
    c.fillRect(4, 9, 2, 4); c.fillRect(10, 9, 2, 4);        // 口の垂れ
  });
  const std = (t) => new THREE.MeshStandardMaterial({ map: t, roughness: 1 });
  const bodyMat = std(bodyTex);
  const faceMat = std(faceTex);
  g.mats = [bodyMat, faceMat];

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.8, 0.3), bodyMat);
  body.position.y = 0.7;
  body.castShadow = true;
  g.add(body);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5),
    [bodyMat, bodyMat, bodyMat, bodyMat, faceMat, bodyMat]);
  head.position.y = 1.35;
  head.castShadow = true;
  g.add(head);
  g.head = head;
  g.legs = [];
  for (const [x, z] of [[-0.13, 0.22], [0.13, 0.22], [-0.13, -0.22], [0.13, -0.22]]) {
    const pivot = new THREE.Group();
    pivot.position.set(x, 0.3, z);
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.3, 0.26), bodyMat);
    m.position.y = -0.15;
    m.castShadow = true;
    pivot.add(m);
    g.add(pivot);
    g.legs.push(pivot);
  }
  // 点滅(爆発前)
  g.flash = (on) => g.mats.forEach(m => {
    m.emissive.setHex(on ? 0xffffff : 0x000000);
    m.emissiveIntensity = 0.85;
  });
  return g;
}

// ============ ブタ ============
export function makePig() {
  const g = new THREE.Group();
  const P = 0xeb9c9c, P2 = 0xd98888;
  const body = mbox(0.62, 0.5, 0.95, P);
  body.position.y = 0.62;
  g.add(body);
  const head = mbox(0.45, 0.45, 0.4, P);
  head.position.set(0, 0.72, 0.62);
  g.add(head);
  g.head = head;
  const snout = mbox(0.22, 0.14, 0.06, P2);
  snout.position.set(0, -0.06, 0.23);
  head.add(snout);
  for (const sx of [-1, 1]) {
    const eye = mbox(0.06, 0.06, 0.02, 0x1a1a1a);
    eye.position.set(sx * 0.13, 0.08, 0.21);
    head.add(eye);
  }
  g.legs = [];
  for (const [x, z] of [[-0.2, 0.32], [0.2, 0.32], [-0.2, -0.32], [0.2, -0.32]]) {
    g.legs.push(leg(g, 0.18, 0.38, 0.18, P, x, 0.38, z));
  }
  return g;
}

// ============ ニワトリ ============
export function makeChicken() {
  const g = new THREE.Group();
  const W = 0xf2f2ec;
  const body = mbox(0.35, 0.36, 0.45, W);
  body.position.y = 0.42;
  body.rotation.x = -0.15;
  g.add(body);
  const head = mbox(0.2, 0.32, 0.2, W);
  head.position.set(0, 0.74, 0.2);
  g.add(head);
  g.head = head;
  const beak = mbox(0.14, 0.08, 0.1, 0xe8a93a);
  beak.position.set(0, -0.02, 0.14);
  head.add(beak);
  const wattle = mbox(0.08, 0.1, 0.06, 0xc83a2e);
  wattle.position.set(0, -0.13, 0.1);
  head.add(wattle);
  for (const sx of [-1, 1]) {
    const eye = mbox(0.04, 0.04, 0.02, 0x1a1a1a);
    eye.position.set(sx * 0.06, 0.08, 0.1);
    head.add(eye);
  }
  g.wings = [];
  for (const sx of [-1, 1]) {
    const wing = new THREE.Group();
    wing.position.set(sx * 0.2, 0.55, 0);
    const wm = mbox(0.06, 0.24, 0.4, 0xe4e4dc);
    wm.position.y = -0.12;
    wing.add(wm);
    g.add(wing);
    g.wings.push(wing);
  }
  g.legs = [];
  for (const sx of [-1, 1]) {
    g.legs.push(leg(g, 0.06, 0.24, 0.06, 0xe8a93a, sx * 0.09, 0.24, 0));
  }
  // 羽ばたき
  g.flap = (t, k = 1) => {
    g.wings.forEach((w, i) => { w.rotation.z = (i ? -1 : 1) * (0.3 + Math.sin(t * 26) * 0.8) * k; });
  };
  return g;
}

// ============ ヒツジ ============
export function makeSheep() {
  const g = new THREE.Group();
  const WOOL = 0xe8e4da;
  const body = mbox(0.7, 0.65, 1.05, WOOL);
  body.position.y = 0.78;
  g.add(body);
  const head = mbox(0.34, 0.34, 0.35, 0xd8c8b8);
  head.position.set(0, 1.0, 0.62);
  g.add(head);
  g.head = head;
  const wool = mbox(0.42, 0.42, 0.25, WOOL);
  wool.position.set(0, 0.05, -0.12);
  head.add(wool);
  for (const sx of [-1, 1]) {
    const eye = mbox(0.05, 0.05, 0.02, 0x1a1a1a);
    eye.position.set(sx * 0.1, 0.04, 0.18);
    head.add(eye);
  }
  g.legs = [];
  for (const [x, z] of [[-0.22, 0.36], [0.22, 0.36], [-0.22, -0.36], [0.22, -0.36]]) {
    g.legs.push(leg(g, 0.16, 0.5, 0.16, 0xcabfa8, x, 0.5, z));
  }
  return g;
}

// ============ ハチ ============
export function makeBee() {
  const g = new THREE.Group();
  const tex = speckleTex('#e8b83a', ['#d8a82e', '#f2c850'], (c) => {
    c.fillStyle = '#2a2418';
    c.fillRect(4, 0, 3, 16); c.fillRect(10, 0, 3, 16); // 縞
  });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.26, 0.4),
    new THREE.MeshStandardMaterial({ map: tex, roughness: 1 }));
  body.castShadow = true;
  g.add(body);
  for (const sx of [-1, 1]) {
    const eye = mbox(0.05, 0.05, 0.02, 0x1a1a1a);
    eye.position.set(sx * 0.07, 0.04, 0.21);
    g.add(eye);
  }
  g.wings = [];
  for (const sx of [-1, 1]) {
    const wing = new THREE.Group();
    wing.position.set(sx * 0.1, 0.14, 0);
    const wm = mbox(0.22, 0.02, 0.16, 0xdde8f0, { transparent: true, opacity: 0.7 });
    wm.position.x = sx * 0.12;
    wing.add(wm);
    g.add(wing);
    g.wings.push(wing);
  }
  g.flap = (t) => g.wings.forEach((w, i) => { w.rotation.z = (i ? -1 : 1) * Math.sin(t * 40) * 0.7; });
  return g;
}

// ============ オオカミ ============
export function makeWolf() {
  const g = new THREE.Group();
  const C = 0xb8bcc4, C2 = 0xdde0e8;
  // hips原点で前傾できる構造(おすわり用)
  const hips = new THREE.Group();
  hips.position.set(0, 0.52, -0.18);
  g.add(hips);
  g.hips = hips;

  const body = mbox(0.32, 0.3, 0.66, C);
  body.position.set(0, 0, 0.26);
  hips.add(body);
  const chest = mbox(0.36, 0.34, 0.28, C2);
  chest.position.set(0, 0.02, 0.52);
  hips.add(chest);
  const head = mbox(0.32, 0.3, 0.28, C);
  head.position.set(0, 0.18, 0.74);
  hips.add(head);
  g.head = head;
  const snout = mbox(0.16, 0.14, 0.16, C2);
  snout.position.set(0, -0.05, 0.2);
  head.add(snout);
  for (const sx of [-1, 1]) {
    const ear = mbox(0.08, 0.1, 0.06, C);
    ear.position.set(sx * 0.1, 0.2, -0.04);
    head.add(ear);
    const eye = mbox(0.05, 0.05, 0.02, 0x1a1a1a);
    eye.position.set(sx * 0.08, 0.05, 0.145);
    head.add(eye);
  }
  const tail = new THREE.Group();
  tail.position.set(0, 0.08, -0.02);
  const tm = mbox(0.1, 0.1, 0.4, C);
  tm.position.z = -0.2;
  tail.add(tm);
  hips.add(tail);
  g.tail = tail;

  g.legs = [];
  // 前脚はhips配下(体と一緒に傾く)、後脚はroot直付け
  for (const [parent, x, y, z] of [
    [hips, -0.11, -0.1, 0.52], [hips, 0.11, -0.1, 0.52],
  ]) {
    g.legs.push(leg(parent, 0.12, 0.42, 0.12, C, x, y, z));
  }
  for (const x of [-0.11, 0.11]) {
    g.legs.push(leg(g, 0.12, 0.42, 0.12, C, x, 0.42, -0.32));
  }
  // おすわり(k 0..1)
  g.sit = (k) => {
    g.hips.rotation.x = -0.62 * k;
    g.hips.position.y = 0.52 - 0.1 * k;
    g.legs[0].rotation.x = 0.55 * k;
    g.legs[1].rotation.x = 0.55 * k;
    g.legs[2].rotation.x = -1.3 * k;
    g.legs[3].rotation.x = -1.3 * k;
  };
  return g;
}

// ============ アイアンゴーレム ============
export function makeGolem() {
  const g = new THREE.Group();
  const C = 0xc6c0b4, C2 = 0xb0a89a;
  const hips = new THREE.Group();
  hips.position.y = 1.1;
  g.add(hips);
  const body = mbox(1.15, 1.15, 0.65, C);
  body.position.y = 0.62;
  hips.add(body);
  const waist = mbox(0.6, 0.35, 0.45, C2);
  waist.position.y = 0.0;
  hips.add(waist);
  const head = mbox(0.42, 0.5, 0.42, C);
  head.position.y = 1.4;
  hips.add(head);
  g.head = head;
  const nose = mbox(0.12, 0.3, 0.14, C2);
  nose.position.set(0, -0.08, 0.26);
  head.add(nose);
  for (const sx of [-1, 1]) {
    const eye = mbox(0.1, 0.05, 0.02, 0x8a2020);
    eye.position.set(sx * 0.11, 0.1, 0.22);
    head.add(eye);
  }
  // つる飾り
  const vine = mbox(0.5, 0.08, 0.02, 0x4a7a3a);
  vine.position.set(0.2, 0.7, 0.34);
  vine.rotation.z = -0.4;
  hips.add(vine);

  g.arms = [];
  for (const sx of [-1, 1]) {
    const arm = new THREE.Group();
    arm.position.set(sx * 0.75, 1.05, 0);
    const am = mbox(0.32, 1.5, 0.36, C2);
    am.position.y = -0.6;
    arm.add(am);
    hips.add(arm);
    g.arms.push(arm);
  }
  g.legs = [];
  for (const sx of [-1, 1]) {
    g.legs.push(leg(g, 0.36, 1.1, 0.42, C2, sx * 0.28, 1.1, 0));
  }
  return g;
}

// ============ エンダーマン ============
export function makeEnderman() {
  const g = new THREE.Group();
  const B = 0x17111f;
  const hipsY = 1.5;
  const body = mbox(0.42, 0.85, 0.26, B);
  body.position.y = hipsY + 0.42;
  g.add(body);
  const head = mbox(0.45, 0.42, 0.45, B);
  head.position.y = hipsY + 1.08;
  g.add(head);
  g.head = head;
  const eyeMat = new THREE.MeshStandardMaterial({
    color: 0xd87fff, emissive: 0xb05fff, emissiveIntensity: 1.6, roughness: 0.6,
  });
  const eyes = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.07, 0.02), eyeMat);
  eyes.position.set(0, 0.04, 0.23);
  head.add(eyes);
  g.arms = [];
  for (const sx of [-1, 1]) {
    const arm = new THREE.Group();
    arm.position.set(sx * 0.26, hipsY + 0.78, 0);
    const am = mbox(0.12, 1.15, 0.12, B);
    am.position.y = -0.55;
    arm.add(am);
    g.add(arm);
    g.arms.push(arm);
  }
  g.legs = [];
  for (const sx of [-1, 1]) {
    g.legs.push(leg(g, 0.13, hipsY, 0.13, B, sx * 0.13, hipsY, 0));
  }
  return g;
}

// ============ エンダードラゴン(簡易) ============
export function makeDragon() {
  const g = new THREE.Group();
  const B = 0x1b1426, B2 = 0x2a1f3d;

  const body = mbox(1.1, 0.9, 2.2, B);
  g.add(body);
  const neck = mbox(0.5, 0.5, 1.0, B);
  neck.position.set(0, 0.25, 1.5);
  g.add(neck);

  const head = new THREE.Group();
  head.position.set(0, 0.4, 2.35);
  g.add(head);
  g.head = head;
  const skull = mbox(0.65, 0.55, 0.9, B2);
  head.add(skull);
  const snout = mbox(0.4, 0.28, 0.55, B);
  snout.position.set(0, -0.08, 0.65);
  head.add(snout);
  for (const sx of [-1, 1]) {
    const horn = mbox(0.12, 0.12, 0.55, B2);
    horn.position.set(sx * 0.2, 0.34, -0.25);
    horn.rotation.x = -0.5;
    head.add(horn);
    const eye = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.09, 0.22),
      new THREE.MeshStandardMaterial({ color: 0xd87fff, emissive: 0xb05fff, emissiveIntensity: 2 })
    );
    eye.position.set(sx * 0.34, 0.08, 0.18);
    head.add(eye);
  }

  g.tailSegs = [];
  let tz = -1.55, ty = 0;
  for (let i = 0; i < 3; i++) {
    const seg2 = mbox(0.45 - i * 0.1, 0.36 - i * 0.07, 1.1, B);
    ty -= 0.08 + i * 0.06;
    seg2.position.set(0, ty, tz);
    tz -= 1.0;
    g.add(seg2);
    g.tailSegs.push(seg2);
  }

  g.wings = [];
  for (const sx of [-1, 1]) {
    const wing = new THREE.Group();
    wing.position.set(sx * 0.5, 0.42, 0.35);
    const wm = mbox(3.0, 0.07, 1.7, B2);
    wm.position.x = sx * 1.55;
    wing.add(wm);
    const tip = mbox(1.4, 0.05, 1.1, B);
    tip.position.set(sx * 3.6, 0, -0.15);
    wing.add(tip);
    g.add(wing);
    g.wings.push(wing);
  }
  g.flap = (t, k = 1) => {
    g.wings.forEach((w, i) => {
      w.rotation.z = (i ? -1 : 1) * Math.sin(t * 5.2) * 0.55 * k;
    });
    g.tailSegs.forEach((s2, i) => {
      s2.position.y = -0.08 - i * 0.14 + Math.sin(t * 2.4 - i) * 0.12;
    });
  };
  return g;
}

// ============ エンダーパール ============
export function makePearl() {
  const m = new THREE.Mesh(
    new THREE.SphereGeometry(0.11, 10, 8),
    new THREE.MeshStandardMaterial({
      color: 0x17695e, emissive: 0x0e4a40, emissiveIntensity: 0.9, roughness: 0.4,
    })
  );
  m.castShadow = true;
  return m;
}

// エンドポータル(本家準拠: 3x3の中央を囲むフレーム12個、角なし)
export function makeEndPortalFrame() {
  const g = new THREE.Group();
  const frames = [];
  const POS = [];
  for (const v of [-1, 0, 1]) {
    POS.push([v, -2], [v, 2], [-2, v], [2, v]);
  }
  for (const [x, z] of POS) {
    const b = makeBlock('endstone', 1);
    b.scale.y = 0.8;
    b.position.set(x, 0.4, z);
    g.add(b);
    frames.push(b);
  }
  g.frames = frames; // 12個
  g.eyes = [];
  // エンダーアイをはめる(index順 0..11)
  g.addEye = (i) => {
    const f = frames[i % frames.length];
    const eye = new THREE.Mesh(
      new THREE.BoxGeometry(0.34, 0.1, 0.34),
      new THREE.MeshStandardMaterial({ color: 0x7fe8a0, emissive: 0x3acc70, emissiveIntensity: 1.5 })
    );
    eye.position.set(f.position.x, 0.86, f.position.z);
    g.add(eye);
    g.eyes.push(eye);
    return eye;
  };
  // 中央3x3の暗黒ポータル面(起動で出現)
  const pool = new THREE.Mesh(
    new THREE.PlaneGeometry(3.0, 3.0),
    new THREE.MeshBasicMaterial({ color: 0x0a0618, transparent: true, opacity: 0 })
  );
  pool.rotation.x = -Math.PI / 2;
  pool.position.y = 0.55;
  g.add(pool);
  g.pool = pool;
  return g;
}

// ============ モダンMC勢 ============

// ウォーデン(大型・スカルク色・胸が光る)
export function makeWarden() {
  const g = new THREE.Group();
  const B = 0x1e3a3c, B2 = 0x16292b;
  const body = mbox(0.95, 1.15, 0.55, B);
  body.position.y = 1.45;
  g.add(body);
  // 胸のソウル(光る)
  for (let i = 0; i < 3; i++) {
    const soul = mbox(0.5 - i * 0.12, 0.08, 0.02, 0x4adfdf, { emissive: 0x35c8c8, emissiveIntensity: 1.6 });
    soul.position.set(0, 1.35 - i * 0.16, 0.29);
    g.add(soul);
  }
  const head = mbox(0.6, 0.5, 0.5, B2);
  head.position.y = 2.3;
  g.add(head);
  g.head = head;
  for (const sx of [-1, 1]) {
    const horn = mbox(0.12, 0.45, 0.12, 0xd8d2c0);
    horn.position.set(sx * 0.3, 0.4, 0);
    horn.rotation.z = -sx * 0.35;
    head.add(horn);
  }
  g.arms = [];
  for (const sx of [-1, 1]) {
    const arm = new THREE.Group();
    arm.position.set(sx * 0.62, 1.95, 0);
    const am = mbox(0.3, 1.3, 0.34, B2);
    am.position.y = -0.6;
    arm.add(am);
    g.add(arm);
    g.arms.push(arm);
  }
  g.legs = [];
  for (const sx of [-1, 1]) {
    g.legs.push(leg(g, 0.3, 0.9, 0.34, B, sx * 0.26, 0.9, 0));
  }
  return g;
}

// アレイ(小さな青い妖精)
export function makeAllay() {
  const g = new THREE.Group();
  const B = 0x6fb8e8;
  const body = mbox(0.16, 0.22, 0.14, B, { emissive: 0x3a7ab8, emissiveIntensity: 0.4 });
  g.add(body);
  const head = mbox(0.22, 0.2, 0.2, B, { emissive: 0x3a7ab8, emissiveIntensity: 0.4 });
  head.position.y = 0.24;
  g.add(head);
  for (const sx of [-1, 1]) {
    const eye = mbox(0.04, 0.05, 0.02, 0x1a2a4a);
    eye.position.set(sx * 0.05, 0.02, 0.1);
    head.add(eye);
  }
  g.wings = [];
  for (const sx of [-1, 1]) {
    const wing = new THREE.Group();
    wing.position.set(sx * 0.08, 0.1, -0.05);
    const wm = mbox(0.16, 0.02, 0.1, 0xcfe8f8, { transparent: true, opacity: 0.75 });
    wm.position.x = sx * 0.09;
    wing.add(wm);
    g.add(wing);
    g.wings.push(wing);
  }
  g.flap = (t) => g.wings.forEach((w, i) => { w.rotation.z = (i ? -1 : 1) * Math.sin(t * 36) * 0.8; });
  return g;
}

// ウーパールーパー(アホロートル)
export function makeAxolotl() {
  const g = new THREE.Group();
  const P = 0xf0a8c8, P2 = 0xe88ab8;
  const body = mbox(0.2, 0.16, 0.42, P);
  body.position.y = 0.12;
  g.add(body);
  const head = mbox(0.26, 0.18, 0.2, P);
  head.position.set(0, 0.13, 0.28);
  g.add(head);
  g.head = head;
  for (const sx of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const gill = mbox(0.12, 0.035, 0.035, P2);
      gill.position.set(sx * 0.16, 0.06 - i * 0.04, 0.06 - i * 0.05);
      gill.rotation.z = sx * (0.5 - i * 0.2);
      head.add(gill);
    }
    const eye = mbox(0.035, 0.035, 0.02, 0x222222);
    eye.position.set(sx * 0.08, 0.04, 0.1);
    head.add(eye);
  }
  const tail = mbox(0.05, 0.14, 0.3, P2);
  tail.position.set(0, 0.14, -0.32);
  g.add(tail);
  g.tail = tail;
  for (const [x, z] of [[-0.09, 0.12], [0.09, 0.12], [-0.09, -0.12], [0.09, -0.12]]) {
    const l = mbox(0.05, 0.08, 0.05, P);
    l.position.set(x, 0.04, z);
    g.add(l);
  }
  return g;
}

// ラクダ(背が高い)
export function makeCamel() {
  const g = new THREE.Group();
  const C = 0xd8b078, C2 = 0xc89c60;
  const body = mbox(0.85, 0.8, 1.7, C);
  body.position.y = 1.35;
  g.add(body);
  const hump = mbox(0.5, 0.3, 0.7, C2);
  hump.position.set(0, 1.85, -0.15);
  g.add(hump);
  const saddle = mbox(0.6, 0.12, 0.8, 0xb03a2e);
  saddle.position.set(0, 1.78, 0.35);
  g.add(saddle);
  const neck = mbox(0.35, 0.9, 0.4, C);
  neck.position.set(0, 1.9, 0.9);
  g.add(neck);
  const head = mbox(0.4, 0.35, 0.55, C);
  head.position.set(0, 2.4, 1.05);
  g.add(head);
  g.head = head;
  for (const sx of [-1, 1]) {
    const eye = mbox(0.05, 0.05, 0.02, 0x1a1a1a);
    eye.position.set(sx * 0.16, 0.06, 0.2);
    head.add(eye);
  }
  g.legs = [];
  for (const [x, z] of [[-0.3, 0.6], [0.3, 0.6], [-0.3, -0.6], [0.3, -0.6]]) {
    g.legs.push(leg(g, 0.22, 0.95, 0.24, C2, x, 0.95, z));
  }
  // おすわり(脚を折って沈む)
  g.sit = (k) => {
    g.position.y = -0.7 * k;
    g.legs.forEach((l, i) => { l.rotation.x = (i < 2 ? -1.4 : 1.4) * k; });
  };
  return g;
}

// ガスト(白い浮遊体+触手)
export function makeGhast() {
  const g = new THREE.Group();
  const W = 0xe8e8e4;
  const body = mbox(1.3, 1.3, 1.3, W);
  g.add(body);
  g.body = body;
  // 顔(閉じ目)
  for (const sx of [-1, 1]) {
    const eye = mbox(0.18, 0.1, 0.02, 0x3a3a3a);
    eye.position.set(sx * 0.3, 0.18, 0.66);
    g.add(eye);
  }
  const mouth = mbox(0.3, 0.14, 0.02, 0x3a3a3a);
  mouth.position.set(0, -0.2, 0.66);
  g.add(mouth);
  g.tentacles = [];
  for (let i = 0; i < 9; i++) {
    const tx = ((i % 3) - 1) * 0.42, tz = (Math.floor(i / 3) - 1) * 0.42;
    const tn = new THREE.Group();
    tn.position.set(tx, -0.65, tz);
    const tm = mbox(0.16, 0.7 + Math.abs(tx * tz) * 0.6, 0.16, 0xd8d8d2);
    tm.position.y = -0.35;
    tn.add(tm);
    g.add(tn);
    g.tentacles.push(tn);
  }
  g.wiggle = (t) => g.tentacles.forEach((tn, i) => {
    tn.rotation.x = Math.sin(t * 2.4 + i) * 0.18;
    tn.rotation.z = Math.cos(t * 2.1 + i * 1.7) * 0.18;
  });
  return g;
}

// ウィザー(3つ首の黒ボス)
export function makeWither() {
  const g = new THREE.Group();
  const B = 0x1c1c22, B2 = 0x2c2c34;
  const spine = mbox(0.4, 1.3, 0.4, B);
  spine.position.y = -0.4;
  g.add(spine);
  // 肋骨
  for (let i = 0; i < 3; i++) {
    const rib = mbox(1.0 - i * 0.18, 0.12, 0.45, B2);
    rib.position.y = -0.15 - i * 0.3;
    g.add(rib);
  }
  g.heads = [];
  const mk = (x, y, s) => {
    const h = new THREE.Group();
    h.position.set(x, y, 0);
    const skull = mbox(0.55 * s, 0.5 * s, 0.5 * s, B2);
    h.add(skull);
    for (const sx of [-1, 1]) {
      const eye = mbox(0.1 * s, 0.07 * s, 0.02, 0xffffff, { emissive: 0xc8c8ff, emissiveIntensity: 1.2 });
      eye.position.set(sx * 0.13 * s, 0.05 * s, 0.26 * s);
      h.add(eye);
    }
    g.add(h);
    g.heads.push(h);
    return h;
  };
  mk(0, 0.55, 1.15);
  mk(-0.62, 0.35, 0.8);
  mk(0.62, 0.35, 0.8);
  return g;
}

// ============ モダン小道具 ============
export function makeElytra() {
  const g = new THREE.Group();
  for (const sx of [-1, 1]) {
    const wing = mbox(0.34, 0.78, 0.06, 0x5a5f6e, { roughness: 0.6 });
    wing.position.set(sx * 0.21, -0.3, -0.04);
    wing.rotation.z = sx * 0.35;
    wing.rotation.x = 0.15;
    g.add(wing);
  }
  return g;
}

export function makeTrident() {
  const g = new THREE.Group();
  const metal = { roughness: 0.4, metalness: 0.5 };
  const shaft = mbox(0.05, 1.5, 0.05, 0x2e7e72, metal);
  g.add(shaft);
  const cross = mbox(0.34, 0.07, 0.07, 0x3a9a8a, metal);
  cross.position.y = 0.6;
  g.add(cross);
  for (const x of [-0.14, 0, 0.14]) {
    const prong = mbox(0.06, 0.3, 0.06, 0x3a9a8a, metal);
    prong.position.set(x, 0.76, 0);
    g.add(prong);
  }
  return g;
}

export function makeMace() {
  const g = new THREE.Group();
  const handle = mbox(0.07, 0.85, 0.07, 0x6b4e2e);
  g.add(handle);
  const head = mbox(0.42, 0.42, 0.42, 0x6e7178, { roughness: 0.45, metalness: 0.5 });
  head.position.y = 0.6;
  g.add(head);
  const band = mbox(0.46, 0.1, 0.46, 0xd8b850, { roughness: 0.35, metalness: 0.6 });
  band.position.y = 0.6;
  g.add(band);
  return g;
}

export function makeShield() {
  const g = new THREE.Group();
  const base = mbox(0.55, 0.68, 0.06, 0x6b4e2e);
  g.add(base);
  const face = mbox(0.45, 0.58, 0.02, 0x8a99b8);
  face.position.z = 0.04;
  g.add(face);
  const stripe = mbox(0.45, 0.12, 0.022, 0xc8d4e8);
  stripe.position.z = 0.045;
  g.add(stripe);
  return g;
}

export function makeDragonEgg() {
  const g = new THREE.Group();
  const sizes = [[0.36, 0.12], [0.46, 0.14], [0.4, 0.14], [0.3, 0.12], [0.18, 0.1]];
  let y = 0;
  for (const [w, h] of sizes) {
    const b = mbox(w, h, w, 0x17101f);
    b.position.y = y + h / 2;
    y += h;
    g.add(b);
  }
  const dot = mbox(0.1, 0.1, 0.1, 0x8a2be2, { emissive: 0x6a1bc2, emissiveIntensity: 0.8 });
  dot.position.set(0.14, 0.3, 0.14);
  g.add(dot);
  return g;
}

export function makeBeaconBlock() {
  const g = new THREE.Group();
  const glass = mbox(0.95, 0.95, 0.95, 0xbfe8f0, { transparent: true, opacity: 0.4, roughness: 0.15 });
  glass.position.y = 0.5;
  g.add(glass);
  const core = mbox(0.5, 0.5, 0.5, 0x4adfdf, { emissive: 0x35c8c8, emissiveIntensity: 1.8 });
  core.position.y = 0.5;
  g.add(core);
  g.core = core;
  return g;
}

export function makeTotem() {
  const g = new THREE.Group();
  const G = 0xe8c84a, G2 = 0x4a9a5a;
  const body = mbox(0.16, 0.2, 0.08, G, { emissive: 0x6a5a10, emissiveIntensity: 0.5 });
  g.add(body);
  const head = mbox(0.22, 0.16, 0.08, G, { emissive: 0x6a5a10, emissiveIntensity: 0.5 });
  head.position.y = 0.18;
  g.add(head);
  const gem = mbox(0.07, 0.07, 0.03, G2, { emissive: 0x2a7a3a, emissiveIntensity: 1 });
  gem.position.set(0, 0.18, 0.05);
  g.add(gem);
  for (const sx of [-1, 1]) {
    const arm = mbox(0.07, 0.16, 0.07, G, { emissive: 0x6a5a10, emissiveIntensity: 0.5 });
    arm.position.set(sx * 0.13, 0.06, 0);
    arm.rotation.z = -sx * 0.8;
    g.add(arm);
  }
  return g;
}

export function makeFishingRod() {
  const g = new THREE.Group();
  const rod = mbox(0.045, 1.3, 0.045, 0x6b4e2e);
  rod.position.y = 0.65;
  rod.rotation.x = -0.5;
  g.add(rod);
  return g;
}

export function makeFish() {
  const g = new THREE.Group();
  const body = mbox(0.12, 0.18, 0.4, 0x8aa8b8);
  g.add(body);
  const tail = mbox(0.04, 0.16, 0.14, 0x6a8898);
  tail.position.z = -0.26;
  g.add(tail);
  const eye = mbox(0.03, 0.03, 0.02, 0x111111);
  eye.position.set(0.06, 0.04, 0.14);
  g.add(eye);
  return g;
}

export function makeBoot() {
  const g = new THREE.Group();
  const top = mbox(0.18, 0.26, 0.2, 0x6e5638);
  top.position.y = 0.2;
  g.add(top);
  const toe = mbox(0.18, 0.1, 0.32, 0x5e4830);
  toe.position.set(0, 0.05, 0.06);
  g.add(toe);
  return g;
}

export function makeAnvil() {
  const g = new THREE.Group();
  const M = 0x4a4d55;
  const base = mbox(0.7, 0.18, 0.5, M, { roughness: 0.5, metalness: 0.4 });
  base.position.y = 0.09;
  g.add(base);
  const waist = mbox(0.34, 0.3, 0.34, M, { roughness: 0.5, metalness: 0.4 });
  waist.position.y = 0.33;
  g.add(waist);
  const top = mbox(0.95, 0.22, 0.42, 0x3c3f47, { roughness: 0.5, metalness: 0.4 });
  top.position.y = 0.59;
  g.add(top);
  return g;
}

export function makeSlimeBlock(size = 1.6) {
  const g = new THREE.Group();
  const outer = mbox(size, size, size, 0x5ac84a, { transparent: true, opacity: 0.55, roughness: 0.3 });
  outer.position.y = size / 2;
  g.add(outer);
  const core = mbox(size * 0.5, size * 0.5, size * 0.5, 0x3e9a32);
  core.position.y = size / 2;
  g.add(core);
  return g;
}

export function makeEnchantTable() {
  const g = new THREE.Group();
  const base = makeBlock('obsidian');
  base.scale.y = 0.75;
  base.position.y = 0.37;
  g.add(base);
  const top = mbox(1.1, 0.12, 1.1, 0xb03a4e);
  top.position.y = 0.8;
  g.add(top);
  const book = new THREE.Group();
  book.position.y = 1.0;
  for (const sx of [-1, 1]) {
    const page = mbox(0.3, 0.04, 0.4, 0xf0e8d0);
    page.position.x = sx * 0.15;
    page.rotation.z = -sx * 0.4;
    book.add(page);
  }
  g.add(book);
  g.book = book;
  return g;
}

export function makeEmerald() {
  return mbox(0.18, 0.26, 0.12, 0x3ecc6a, { emissive: 0x1a8a3a, emissiveIntensity: 0.5, roughness: 0.3 });
}

// ツタ(振り子の支点グループごと返す)
export function makeVine(len = 6) {
  const pivot = new THREE.Group();
  for (let i = 0; i < len * 2; i++) {
    const seg2 = mbox(0.09, 0.5, 0.09, i % 2 ? 0x3e8a3e : 0x346f34);
    seg2.position.y = -i * 0.5 - 0.25;
    pivot.add(seg2);
  }
  pivot.len = len;
  return pivot;
}

export function makeHoneyBlock(size = 1) {
  const g = new THREE.Group();
  const outer = mbox(size, size, size, 0xe8a83a, { transparent: true, opacity: 0.7, roughness: 0.25 });
  outer.position.y = size / 2;
  g.add(outer);
  const core = mbox(size * 0.6, size * 0.6, size * 0.6, 0xc8862a);
  core.position.y = size / 2;
  g.add(core);
  return g;
}

export function makeVillagerSkin() {
  return humanoidSkin((g, box2) => {
    const skin = '#bd8b72', skinD = '#a87a62';
    box2(0, 0, 8, 8, 8, { top: skinD, bottom: skinD, side: skinD, front: skin });
    g.fillStyle = '#3a6e4a'; g.fillRect(9, 11, 2, 2); g.fillRect(13, 11, 2, 2); // 緑の目
    g.fillStyle = '#8a5a42'; g.fillRect(11, 12, 2, 4);                          // 大きな鼻
    g.fillStyle = '#6e4a34'; g.fillRect(9, 10, 6, 1);                           // 一本眉
    const robe = '#8a6e52', robeD = '#76603e';
    box2(16, 16, 8, 12, 4, { top: robeD, bottom: robeD, side: robeD, front: robe });
    for (const [u, v] of [[0, 16], [16, 48], [40, 16], [32, 48]]) {
      box2(u, v, 4, 12, 4, { top: robeD, bottom: robeD, side: robeD, front: robe });
    }
  });
}

// ============ 人型Mobスキン(PlayerModelに着せる) ============
function humanoidSkin(draw) {
  const cv = document.createElement('canvas');
  cv.width = 64; cv.height = 64;
  const g = cv.getContext('2d');
  const box2 = (u, v, w, h, d, colors) => {
    g.fillStyle = colors.top;    g.fillRect(u + d, v, w, d);
    g.fillStyle = colors.bottom; g.fillRect(u + d + w, v, w, d);
    g.fillStyle = colors.side;   g.fillRect(u, v + d, d + w + d + w, h);
    g.fillStyle = colors.front;  g.fillRect(u + d, v + d, w, h);
  };
  draw(g, box2);
  return { canvas: cv, slim: false };
}

export function makeZombieSkin() {
  return humanoidSkin((g, box2) => {
    const skin = '#5e9444', skinD = '#4e7c38';
    box2(0, 0, 8, 8, 8, { top: skinD, bottom: skinD, side: skinD, front: skin });
    g.fillStyle = '#16240f'; g.fillRect(9, 11, 2, 2); g.fillRect(13, 11, 2, 2); // 虚ろな目
    g.fillStyle = '#3a5c2c'; g.fillRect(10, 14, 4, 1);
    const shirt = '#3a7a6a', shirtD = '#2e6456';
    box2(16, 16, 8, 12, 4, { top: shirtD, bottom: shirtD, side: shirtD, front: shirt });
    const pants = '#4a3a78', pantsD = '#3c2e62';
    box2(0, 16, 4, 12, 4, { top: pantsD, bottom: pantsD, side: pantsD, front: pants });
    box2(16, 48, 4, 12, 4, { top: pantsD, bottom: pantsD, side: pantsD, front: pants });
    // 腕は肌色(ゾンビアーム)
    box2(40, 16, 4, 12, 4, { top: skinD, bottom: skin, side: skinD, front: skin });
    box2(32, 48, 4, 12, 4, { top: skinD, bottom: skin, side: skinD, front: skin });
  });
}

export function makeSkeletonSkin() {
  return humanoidSkin((g, box2) => {
    const bone = '#d8d8cc', boneD = '#b8b8ac';
    box2(0, 0, 8, 8, 8, { top: boneD, bottom: boneD, side: boneD, front: bone });
    g.fillStyle = '#222222'; g.fillRect(9, 11, 2, 2); g.fillRect(13, 11, 2, 2);
    g.fillRect(10, 14, 4, 1);
    box2(16, 16, 8, 12, 4, { top: boneD, bottom: boneD, side: boneD, front: bone });
    g.fillStyle = '#a8a89c'; // 肋骨
    for (let y = 0; y < 3; y++) g.fillRect(20, 21 + y * 3, 8, 1);
    for (const [u, v] of [[0, 16], [16, 48], [40, 16], [32, 48]]) {
      box2(u, v, 4, 12, 4, { top: boneD, bottom: boneD, side: boneD, front: bone });
    }
  });
}

// ============ 小道具 ============
export function makeBed() {
  const g = new THREE.Group();
  const frame = mbox(1.0, 0.22, 2.0, 0x6b4e2e);
  frame.position.y = 0.26;
  g.add(frame);
  const blanket = mbox(1.0, 0.14, 1.3, 0xc83a2e);
  blanket.position.set(0, 0.43, -0.3);
  g.add(blanket);
  const pillow = mbox(0.84, 0.12, 0.5, 0xf2f2ec);
  pillow.position.set(0, 0.43, 0.66);
  g.add(pillow);
  for (const [x, z] of [[-0.42, 0.9], [0.42, 0.9], [-0.42, -0.9], [0.42, -0.9]]) {
    const l = mbox(0.14, 0.3, 0.14, 0x543c22);
    l.position.set(x, 0.15, z);
    g.add(l);
  }
  return g;
}

export function makeCake() {
  const g = new THREE.Group();
  const base = mbox(0.62, 0.3, 0.62, 0xf2ead8);
  base.position.y = 0.15;
  g.add(base);
  const icing = mbox(0.66, 0.08, 0.66, 0xffffff);
  icing.position.y = 0.32;
  g.add(icing);
  for (let i = 0; i < 5; i++) {
    const cherry = mbox(0.08, 0.07, 0.08, 0xc83a2e);
    cherry.position.set(rand(-0.22, 0.22), 0.39, rand(-0.22, 0.22));
    g.add(cherry);
  }
  return g;
}

export function makeSteak() {
  const g = new THREE.Group();
  const meat = mbox(0.26, 0.08, 0.34, 0x6e3a26);
  g.add(meat);
  const sear = mbox(0.2, 0.02, 0.26, 0x4e2a1a);
  sear.position.y = 0.05;
  g.add(sear);
  return g;
}

export function makeArrow() {
  const g = new THREE.Group();
  const shaft = mbox(0.035, 0.035, 0.6, 0x9a7a4e);
  g.add(shaft);
  const head = mbox(0.07, 0.07, 0.08, 0xb8c0cc);
  head.position.z = 0.32;
  g.add(head);
  const fl = mbox(0.02, 0.12, 0.12, 0xe8e8e0);
  fl.position.z = -0.27;
  g.add(fl);
  const fl2 = mbox(0.12, 0.02, 0.12, 0xe8e8e0);
  fl2.position.z = -0.27;
  g.add(fl2);
  return g;
}

// ネザーゲート(黒曜石枠 + 紫の渦)
export function makePortal(w = 3, h = 4) {
  const g = new THREE.Group();
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) {
      const edge = x === 0 || x === w - 1 || y === 0 || y === h - 1;
      if (!edge) continue;
      const b = makeBlock('obsidian');
      b.position.set((x - (w - 1) / 2), y + 0.5, 0);
      g.add(b);
    }
  }
  const glow = new THREE.Mesh(
    new THREE.PlaneGeometry(w - 2 + 0.9, h - 2 + 0.9),
    new THREE.MeshBasicMaterial({
      color: 0xb05fff, transparent: true, opacity: 0.55,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    })
  );
  glow.material.toneMapped = false;
  glow.position.set(0, h / 2, 0);
  g.add(glow);
  g.glow = glow;
  return g;
}
