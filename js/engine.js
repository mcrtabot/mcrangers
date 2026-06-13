// 描画・演出基盤: ステージ/ボクセル地形/パーティクル/効果音/タイトル表示

import * as THREE from 'three';
import { clamp01, rand, randPick } from './core.js';

// ============================================================
// [stage.js より統合]
// ============================================================

// 3Dステージ: レンダラ・空・地面・ライト・環境プリセット・カメラ制御

const SKY_VERT = `
varying vec3 vWorld;
void main() {
  vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const SKY_FRAG = `
uniform vec3 uTop;
uniform vec3 uHorizon;
uniform vec3 uBottom;
varying vec3 vWorld;
void main() {
  float h = normalize(vWorld).y;
  vec3 col = h > 0.0
    ? mix(uHorizon, uTop, pow(clamp(h, 0.0, 1.0), 0.55))
    : mix(uHorizon, uBottom, pow(clamp(-h, 0.0, 1.0), 0.7));
  gl_FragColor = vec4(col, 1.0);
}`;

export const ENVS = {
  street: {
    top: 0x0a1030, horizon: 0x2c3a6e, bottom: 0x11142a,
    fog: 0x141a35, fogD: 0.016, ground: 0x171c30, grid: 0x3a5aff, gridVis: false,
    hemi: 0.45, key: 1.7, keyC: 0xcfe0ff, rim: 1.5, rimC: 0x5d8bff,
  },
  nightcity: {
    top: 0x05070f, horizon: 0x1c2444, bottom: 0x0a0d1c,
    fog: 0x0d1226, fogD: 0.014, ground: 0x12162a, grid: 0x2c4ed6, gridVis: false,
    hemi: 0.4, key: 1.5, keyC: 0xbfd4ff, rim: 1.7, rimC: 0x7a5cff,
  },
  sunset: {
    top: 0x3a1b55, horizon: 0xff8a3c, bottom: 0x2a1a22,
    fog: 0x7a4030, fogD: 0.012, ground: 0x241b22, grid: 0xff8a4c, gridVis: false,
    hemi: 0.5, key: 2.0, keyC: 0xffb060, rim: 1.6, rimC: 0xff5fa2,
  },
  dark: {
    top: 0x05060f, horizon: 0x141a30, bottom: 0x0a0c16,
    fog: 0x0a0d18, fogD: 0.018, ground: 0x141826, grid: 0x2a4080, gridVis: false,
    hemi: 0.32, key: 0.95, keyC: 0xaac4ff, rim: 1.6, rimC: 0x4d7dff,
  },
  day: {
    top: 0x2569c9, horizon: 0xbfe0ff, bottom: 0x44663f,
    fog: 0xa8c8e8, fogD: 0.008, ground: 0x4d7a4a, grid: 0x88bb88, gridVis: false,
    hemi: 0.9, key: 2.4, keyC: 0xfff2dd, rim: 0.9, rimC: 0xbfe0ff,
  },
  cave: {
    top: 0x0a0805, horizon: 0x33271a, bottom: 0x14100a,
    fog: 0x191309, fogD: 0.02, ground: 0x241d12, grid: 0xaa7733, gridVis: false,
    hemi: 0.5, key: 2.0, keyC: 0xffc888, rim: 1.4, rimC: 0xff9540,
  },
  voidpurple: {
    top: 0x0c0518, horizon: 0x3a1a66, bottom: 0x150a26,
    fog: 0x190d33, fogD: 0.018, ground: 0x180f2c, grid: 0xb05fff, gridVis: false,
    hemi: 0.4, key: 1.4, keyC: 0xd8c0ff, rim: 1.9, rimC: 0xc05fff,
  },
};

export class Stage {
  constructor(container) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x141a35, 0.016);

    this.camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 400);
    this.camPos = new THREE.Vector3(0, 1.6, 5);
    this.camTarget = new THREE.Vector3(0, 1, 0);
    this.fov = 50;

    // 空
    this.skyMat = new THREE.ShaderMaterial({
      vertexShader: SKY_VERT,
      fragmentShader: SKY_FRAG,
      uniforms: {
        uTop: { value: new THREE.Color(0x0a1030) },
        uHorizon: { value: new THREE.Color(0x2c3a6e) },
        uBottom: { value: new THREE.Color(0x11142a) },
      },
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    });
    const sky = new THREE.Mesh(new THREE.SphereGeometry(180, 24, 16), this.skyMat);
    sky.frustumCulled = false;
    this.scene.add(sky);

    // 地面
    this.groundMat = new THREE.MeshStandardMaterial({ color: 0x171c30, roughness: 0.93, metalness: 0 });
    // ブロック地形の下の遠景フォールバック面(地形半径の外側を埋める)
    const ground = new THREE.Mesh(new THREE.CircleGeometry(120, 48), this.groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.62;
    ground.receiveShadow = true;
    this.scene.add(ground);

    this.grid = new THREE.GridHelper(90, 90, 0x3a5aff, 0x3a5aff);
    this.grid.material.transparent = true;
    this.grid.material.opacity = 0.16;
    this.grid.material.depthWrite = false;
    this.grid.position.y = 0.012;
    this.scene.add(this.grid);

    // ライト
    this.hemi = new THREE.HemisphereLight(0xaabbff, 0x223344, 0.45);
    this.scene.add(this.hemi);

    this.key = new THREE.DirectionalLight(0xcfe0ff, 1.7);
    this.key.position.set(5, 9, 7);
    this.key.castShadow = true;
    this.key.shadow.mapSize.set(2048, 2048);
    this.key.shadow.camera.left = -10;
    this.key.shadow.camera.right = 10;
    this.key.shadow.camera.top = 12;
    this.key.shadow.camera.bottom = -4;
    this.key.shadow.camera.far = 40;
    this.key.shadow.bias = -0.0004;
    this.scene.add(this.key);
    this.scene.add(this.key.target);

    this.rim = new THREE.DirectionalLight(0x5d8bff, 1.5);
    this.rim.position.set(-5, 6, -8);
    this.scene.add(this.rim);

    // シーンごとの小道具置き場
    this.props = new THREE.Group();
    this.scene.add(this.props);

    this.shakeAmp = 0;
    this._shakeOff = new THREE.Vector3();

    addEventListener('resize', () => this.resize());
    this.resize();
  }

  resize() {
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(innerWidth, innerHeight);
  }

  setEnv(name) {
    const e = ENVS[name] || ENVS.street;
    // ボクセル地形(環境ごとに作り直す)
    if (this._terrainEnv !== name) {
      if (this.terrain) {
        disposeTerrain(this.terrain);
        this.scene.remove(this.terrain);
      }
      this.terrain = buildTerrain(name);
      this.scene.add(this.terrain);
      this._terrainEnv = name;
    }
    this.skyMat.uniforms.uTop.value.setHex(e.top);
    this.skyMat.uniforms.uHorizon.value.setHex(e.horizon);
    this.skyMat.uniforms.uBottom.value.setHex(e.bottom);
    this.scene.fog.color.setHex(e.fog);
    this.scene.fog.density = e.fogD;
    this.groundMat.color.setHex(e.ground);
    this.grid.visible = e.gridVis;
    this.grid.material.color.setHex(e.grid);
    this.hemi.intensity = e.hemi;
    this.key.intensity = e.key;
    this.key.color.setHex(e.keyC);
    this.rim.intensity = e.rim;
    this.rim.color.setHex(e.rimC);
  }

  // カメラを一発で設定
  cam(px, py, pz, tx, ty, tz, fov = null) {
    this.camPos.set(px, py, pz);
    this.camTarget.set(tx, ty, tz);
    if (fov !== null) this.fov = fov;
  }

  shake(amp) {
    this.shakeAmp = Math.max(this.shakeAmp, amp);
  }

  clearProps() {
    const disposeObj = (o) => {
      o.traverse(c => {
        if (c.geometry) c.geometry.dispose();
        if (c.material) {
          (Array.isArray(c.material) ? c.material : [c.material]).forEach(m => m.dispose());
        }
      });
    };
    [...this.props.children].forEach(c => {
      disposeObj(c);
      this.props.remove(c);
    });
  }

  update(dt) {
    // カメラシェイク
    this.shakeAmp *= Math.exp(-5.5 * dt);
    if (this.shakeAmp < 0.0005) this.shakeAmp = 0;
    const a = this.shakeAmp;
    this._shakeOff.set(
      (Math.random() - 0.5) * 2 * a,
      (Math.random() - 0.5) * 2 * a,
      (Math.random() - 0.5) * 1.2 * a
    );

    this.camera.position.copy(this.camPos).add(this._shakeOff);
    this.camera.lookAt(this.camTarget);
    if (Math.abs(this.camera.fov - this.fov) > 0.01) {
      this.camera.fov = this.fov;
      this.camera.updateProjectionMatrix();
    }
    this.renderer.render(this.scene, this.camera);
  }
}

// ============================================================
// [world.js より統合]
// ============================================================

// ボクセル背景世界: MC風プロシージャルテクスチャ + InstancedMeshの立方体地形
// 環境(env)ごとに草原・岩山・メサ・洞窟などの地形を生成する

const TS = 16;

// 決定的ノイズ(地形の段差用)
function n2(x, z) {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

function makeTex(draw) {
  const cv = document.createElement('canvas');
  cv.width = TS; cv.height = TS;
  draw(cv.getContext('2d'));
  const t = new THREE.CanvasTexture(cv);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function fillNoise(g, base, variants, count = 110) {
  g.fillStyle = base;
  g.fillRect(0, 0, TS, TS);
  for (let i = 0; i < count; i++) {
    g.fillStyle = randPick(variants);
    g.fillRect(Math.floor(rand(TS)), Math.floor(rand(TS)), 1, 1);
  }
}

// ---- テクスチャ(遅延生成シングルトン) ----
let T = null;
function textures() {
  if (T) return T;
  T = {};
  T.grassTop = makeTex(g => fillNoise(g, '#5fa845', ['#55973d', '#69b54e', '#4e8c38', '#73bd58']));
  T.grassSide = makeTex(g => {
    fillNoise(g, '#79553a', ['#6e4f37', '#8a6042', '#5f452e']);
    g.fillStyle = '#5fa845';
    g.fillRect(0, 0, TS, 3);
    for (let x = 0; x < TS; x++) {
      if (Math.random() < 0.55) g.fillRect(x, 3, 1, Math.floor(rand(1, 3)));
    }
  });
  T.dirt = makeTex(g => fillNoise(g, '#79553a', ['#6e4f37', '#8a6042', '#5f452e', '#86593b']));
  T.stone = makeTex(g => fillNoise(g, '#7d8088', ['#6e7178', '#868a92', '#5e6168', '#74777e']));
  T.deepslate = makeTex(g => fillNoise(g, '#3c3f48', ['#34363e', '#454852', '#2c2e36']));
  T.snow = makeTex(g => fillNoise(g, '#e8eef4', ['#dde5ee', '#f2f6fa', '#d2dce8'], 60));
  T.sandDry = makeTex(g => fillNoise(g, '#c8b87a', ['#bcac6e', '#d4c486', '#b0a062']));
  T.logSide = makeTex(g => {
    fillNoise(g, '#6b4e2e', ['#5a4026', '#785836'], 40);
    for (let x = 0; x < TS; x += 4) { g.fillStyle = '#543c22'; g.fillRect(x, 0, 1, TS); }
  });
  T.leaves = makeTex(g => fillNoise(g, '#3e7a2e', ['#346826', '#488c36', '#2c5c20', '#52a040'], 160));
  T.obsidian = makeTex(g => fillNoise(g, '#1c1228', ['#150d1f', '#2d1b4e', '#241540'], 70));
  T.endstone = makeTex(g => fillNoise(g, '#dade9e', ['#cdd190', '#e6eaae', '#c2c684']));
  T.netherrack = makeTex(g => fillNoise(g, '#5e2626', ['#521f1f', '#6e3030', '#48381a'], 130));
  T.terracotta = makeTex(g => fillNoise(g, '#b06b3f', ['#a26037', '#bd7849', '#94552f'], 70));
  T.terracotta2 = makeTex(g => fillNoise(g, '#8c4a3a', ['#7e4234', '#9a5642', '#703a2c'], 70));
  T.tntSide = makeTex(g => {
    fillNoise(g, '#c8402e', ['#b83826', '#d44a36'], 50);
    g.fillStyle = '#e8e4da';
    g.fillRect(0, 5, TS, 6);
    g.fillStyle = '#1a1a1a';
    g.fillRect(2, 7, 3, 2); g.fillRect(6, 7, 3, 2); g.fillRect(10, 7, 4, 2); // "TNT"風
  });
  T.tntTop = makeTex(g => {
    fillNoise(g, '#c8402e', ['#b83826'], 30);
    g.fillStyle = '#e8e4da'; g.fillRect(3, 3, 10, 10);
    g.fillStyle = '#1a1a1a'; g.fillRect(7, 7, 2, 2);
  });
  T.iron = makeTex(g => {
    fillNoise(g, '#d8dde2', ['#c8ced4', '#e8ecf0'], 50);
    g.strokeStyle = '#b0b8c0';
    g.strokeRect(1.5, 1.5, 13, 13);
  });
  T.bookshelf = makeTex(g => {
    fillNoise(g, '#9a7444', ['#8a6438', '#a88050'], 40);
    g.fillStyle = '#5a4026'; g.fillRect(0, 0, 16, 2); g.fillRect(0, 14, 16, 2);
    const cols = ['#b03a2e', '#2e6da0', '#3e8a3e', '#c8a02e', '#7a4a9a', '#c87830'];
    let x = 1;
    while (x < 15) {
      const w = 2 + Math.floor(rand(2));
      g.fillStyle = cols[Math.floor(rand(cols.length))];
      g.fillRect(x, 3, w, 10);
      g.fillStyle = 'rgba(0,0,0,.25)';
      g.fillRect(x, 3, 1, 10);
      x += w + 1;
    }
  });
  return T;
}

// ---- マテリアル ----
let M = null;
function materials() {
  if (M) return M;
  const t = textures();
  const std = (tex) => new THREE.MeshStandardMaterial({ map: tex, roughness: 1, metalness: 0 });
  M = {};
  const single = ['dirt', 'stone', 'deepslate', 'snow', 'sandDry', 'leaves', 'obsidian',
    'endstone', 'netherrack', 'terracotta', 'terracotta2', 'iron', 'bookshelf'];
  for (const k of single) M[k] = std(t[k]);
  // 面ごとに違うブロック: [+x,-x,+y,-y,+z,-z]
  M.grass = [std(t.grassSide), std(t.grassSide), std(t.grassTop), M.dirt, std(t.grassSide), std(t.grassSide)];
  M.log = [std(t.logSide), std(t.logSide), M.dirt, M.dirt, std(t.logSide), std(t.logSide)];
  M.tnt = [std(t.tntSide), std(t.tntSide), std(t.tntTop), std(t.tntTop), std(t.tntSide), std(t.tntSide)];
  // 花(無地)
  M.flowerRed = new THREE.MeshStandardMaterial({ color: 0xe84d3a, roughness: 1 });
  M.flowerYellow = new THREE.MeshStandardMaterial({ color: 0xf2d549, roughness: 1 });
  M.flowerWhite = new THREE.MeshStandardMaterial({ color: 0xf2f2ee, roughness: 1 });
  return M;
}

export const BLOCK_GEO = new THREE.BoxGeometry(1, 1, 1);

// 単体ブロック(シーン小道具用)
export function makeBlock(type, size = 1) {
  const m = new THREE.Mesh(BLOCK_GEO, materials()[type] || materials().stone);
  m.scale.setScalar(size);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

// ---- 地形スペック ----
const TERRAIN = {
  day: {
    R: 26, flatR: 9, rise: 0.22, maxH: 3, top: 'grass', fill: 'dirt',
    trees: 9, flowers: 46, rocks: 4,
    mounts: { n: 9, h: [4, 9], type: 'stone', cap: 'snow', r0: 32, r1: 46 },
  },
  street: {
    R: 24, flatR: 10, rise: 0.12, maxH: 2, top: 'deepslate', fill: 'deepslate',
    rocks: 5, rockType: 'deepslate',
  },
  nightcity: {
    R: 24, flatR: 10, rise: 0.12, maxH: 2, top: 'deepslate', fill: 'deepslate',
    rocks: 5, rockType: 'deepslate',
  },
  sunset: {
    R: 26, flatR: 9, rise: 0.18, maxH: 3, top: 'sandDry', fill: 'dirt',
    rocks: 4, rockType: 'terracotta',
    mounts: { n: 8, h: [3, 8], type: 'terracotta', cap: 'terracotta2', r0: 30, r1: 44 },
  },
  dark: {
    R: 20, flatR: 10, rise: 0.06, maxH: 1, top: 'deepslate', fill: 'deepslate',
    rocks: 3, rockType: 'deepslate',
  },
  cave: {
    R: 20, flatR: 7, rise: 0.5, maxH: 7, top: 'stone', fill: 'stone', topMix: ['netherrack', 0.08],
    rocks: 6, rockType: 'stone',
    mounts: { n: 13, h: [6, 12], type: 'stone', r0: 22, r1: 34 },
  },
  voidpurple: {
    R: 24, flatR: 9, rise: 0.14, maxH: 2, top: 'endstone', fill: 'endstone',
    pillars: 10,
    mounts: { n: 6, h: [3, 7], type: 'obsidian', r0: 28, r1: 42 },
  },
};

// 地形を生成して返す
export function buildTerrain(envName) {
  const mats = materials();
  const spec = TERRAIN[envName] || TERRAIN.street;
  const group = new THREE.Group();
  const piles = {}; // type -> [[x,y,z,scale], ...]
  const put = (type, x, y, z, s = 1) => {
    (piles[type] ??= []).push([x, y, z, s]);
  };

  const { R, flatR, rise, maxH } = spec;
  const hAt = (x, z) => {
    const d = Math.hypot(x, z);
    if (d <= flatR || d > R) return 0;
    const noise = n2(Math.floor(x / 4), Math.floor(z / 4));
    return Math.min(maxH, Math.floor((d - flatR) * rise * (0.4 + noise)));
  };

  // 1) 地表(中心は平坦、外周へ向けて段差)
  for (let x = -R; x <= R; x++) {
    for (let z = -R; z <= R; z++) {
      if (Math.hypot(x, z) > R) continue;
      const h = hAt(x, z);
      let topType = spec.top;
      if (spec.topMix && n2(x * 3 + 7, z * 3 - 5) < spec.topMix[1]) topType = spec.topMix[0];
      if (h === 0) {
        put(topType, x, -0.5, z);
      } else {
        const nmin = Math.min(hAt(x + 1, z), hAt(x - 1, z), hAt(x, z + 1), hAt(x, z - 1), h);
        put(topType, x, h - 0.5, z);
        for (let lvl = Math.max(0, nmin); lvl < h; lvl++) put(spec.fill, x, lvl - 0.5, z);
      }
    }
  }

  // 2) 遠景の岩山/メサ(2倍ブロックの柱クラスタ)
  if (spec.mounts) {
    const mt = spec.mounts;
    for (let i = 0; i < mt.n; i++) {
      const a = (i / mt.n) * Math.PI * 2 + rand(-0.25, 0.25);
      const r = rand(mt.r0, mt.r1);
      const cx = Math.round(Math.cos(a) * r / 2) * 2;
      const cz = Math.round(Math.sin(a) * r / 2) * 2;
      const H = Math.round(rand(mt.h[0], mt.h[1]));
      const cols = Math.floor(rand(5, 9));
      for (let c = 0; c < cols; c++) {
        const ox = c === 0 ? 0 : Math.round(rand(-2.2, 2.2)) * 2;
        const oz = c === 0 ? 0 : Math.round(rand(-2.2, 2.2)) * 2;
        const ch = Math.max(2, Math.round(H * (c === 0 ? 1 : rand(0.35, 0.8))));
        for (let y = 0; y < ch; y += 2) {
          const isTop = y + 2 >= ch;
          put(isTop && mt.cap ? mt.cap : mt.type, cx + ox, y + 1 - 0.5, cz + oz, 2);
        }
      }
    }
  }

  // 3) 木
  for (let i = 0; i < (spec.trees || 0); i++) {
    const a = rand(Math.PI * 2), r = rand(flatR + 3, R - 3);
    const x = Math.round(Math.cos(a) * r), z = Math.round(Math.sin(a) * r);
    const base = hAt(x, z);
    const trunkH = Math.floor(rand(3, 5));
    for (let y = 0; y < trunkH; y++) put('log', x, base + y + 0.5, z);
    const ly = base + trunkH;
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        put('leaves', x + dx, ly + 0.5, z + dz);
        if (Math.abs(dx) + Math.abs(dz) < 2) put('leaves', x + dx, ly + 1.5, z + dz);
      }
    }
    put('leaves', x, ly + 2.5, z);
  }

  // 4) 岩
  for (let i = 0; i < (spec.rocks || 0); i++) {
    const a = rand(Math.PI * 2), r = rand(flatR + 2, R - 2);
    const x = Math.round(Math.cos(a) * r), z = Math.round(Math.sin(a) * r);
    const base = hAt(x, z);
    const n = Math.floor(rand(2, 5));
    for (let k = 0; k < n; k++) {
      put(spec.rockType || 'stone',
        x + Math.round(rand(-1, 1)), base + (k > 1 ? 0.5 : -0.2), z + Math.round(rand(-1, 1)),
        rand(0.6, 1));
    }
  }

  // 5) 花
  for (let i = 0; i < (spec.flowers || 0); i++) {
    const a = rand(Math.PI * 2), r = rand(2.5, R - 4);
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (hAt(Math.round(x), Math.round(z)) > 0) continue;
    put(randPick(['flowerRed', 'flowerYellow', 'flowerWhite']), x, 0.09, z, 0.17);
  }

  // 6) 黒曜石の柱(エンド風)
  for (let i = 0; i < (spec.pillars || 0); i++) {
    const a = rand(Math.PI * 2), r = rand(flatR + 3, R - 2);
    const x = Math.round(Math.cos(a) * r), z = Math.round(Math.sin(a) * r);
    const h = Math.floor(rand(2, 6));
    for (let y = 0; y < h; y++) put('obsidian', x, y + 0.5, z);
  }

  // ---- InstancedMesh化(typeごとに1ドローコール) ----
  const dummy = new THREE.Object3D();
  for (const [type, list] of Object.entries(piles)) {
    const mesh = new THREE.InstancedMesh(BLOCK_GEO, mats[type] || mats.stone, list.length);
    list.forEach(([x, y, z, s], i) => {
      dummy.position.set(x, y, z);
      dummy.scale.setScalar(s);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  return group;
}

export function disposeTerrain(group) {
  // ジオメトリ/マテリアル/テクスチャは共有シングルトンなので
  // InstancedMeshのインスタンスバッファだけ解放する
  group.traverse(o => {
    if (o.isInstancedMesh) o.dispose();
  });
}

// ============================================================
// [fx.js より統合]
// ============================================================

// パーティクル・爆発・画面エフェクト

// ============ 3D FX ============
export class FX {
  constructor(scene) {
    this.scene = scene;
    this.items = [];
  }

  add(item) {
    this.items.push(item);
    return item;
  }

  update(dt) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      if (!this.items[i].update(dt)) {
        this.items[i].dispose();
        this.items.splice(i, 1);
      }
    }
  }

  clear() {
    this.items.forEach(i => i.dispose());
    this.items = [];
  }

  // 点パーティクル放出
  burst({ pos, count = 40, colors = ['#ffffff'], size = 0.07, speed = 3, dir = null,
          spread = 1, gravity = -6, life = 0.8, additive = true, drag = 1.5 }) {
    const geo = new THREE.BufferGeometry();
    const p = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const vel = new Float32Array(count * 3);
    const c = new THREE.Color();
    for (let i = 0; i < count; i++) {
      p[i * 3] = pos.x; p[i * 3 + 1] = pos.y; p[i * 3 + 2] = pos.z;
      c.set(randPick(colors));
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
      // ランダム球面 + 指向
      const th = rand(Math.PI * 2), ph = Math.acos(rand(-1, 1));
      const rs = speed * rand(0.3, 1);
      vel[i * 3] = (dir ? dir.x * speed : 0) + Math.sin(ph) * Math.cos(th) * rs * spread;
      vel[i * 3 + 1] = (dir ? dir.y * speed : 0) + Math.cos(ph) * rs * spread;
      vel[i * 3 + 2] = (dir ? dir.z * speed : 0) + Math.sin(ph) * Math.sin(th) * rs * spread;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(p, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const mat = new THREE.PointsMaterial({
      size, vertexColors: true, transparent: true, opacity: 1,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      depthWrite: false, sizeAttenuation: true,
    });
    mat.toneMapped = false;
    const pts = new THREE.Points(geo, mat);
    this.scene.add(pts);

    let t = 0;
    const scene = this.scene;
    return this.add({
      update(dt) {
        t += dt;
        const arr = geo.attributes.position.array;
        for (let i = 0; i < count; i++) {
          vel[i * 3] *= (1 - drag * dt);
          vel[i * 3 + 1] = vel[i * 3 + 1] * (1 - drag * dt * 0.4) + gravity * dt;
          vel[i * 3 + 2] *= (1 - drag * dt);
          arr[i * 3] += vel[i * 3] * dt;
          arr[i * 3 + 1] += vel[i * 3 + 1] * dt;
          arr[i * 3 + 2] += vel[i * 3 + 2] * dt;
        }
        geo.attributes.position.needsUpdate = true;
        mat.opacity = Math.pow(clamp01(1 - t / life), 1.4);
        return t < life;
      },
      dispose() { scene.remove(pts); geo.dispose(); mat.dispose(); },
    });
  }

  // 地面の衝撃波リング
  ring({ pos, color = 0xffffff, life = 0.5, r0 = 0.15, r1 = 3, opacity = 0.85, y = null }) {
    const geo = new THREE.RingGeometry(0.82, 1.0, 48);
    const mat = new THREE.MeshBasicMaterial({
      color, transparent: true, opacity, side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    mat.toneMapped = false;
    const m = new THREE.Mesh(geo, mat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(pos.x, y ?? (pos.y + 0.02), pos.z);
    this.scene.add(m);
    let t = 0;
    const scene = this.scene;
    return this.add({
      update(dt) {
        t += dt;
        const k = clamp01(t / life);
        const r = r0 + (r1 - r0) * (1 - Math.pow(1 - k, 3));
        m.scale.set(r, r, r);
        mat.opacity = opacity * (1 - k);
        return t < life;
      },
      dispose() { scene.remove(m); geo.dispose(); mat.dispose(); },
    });
  }

  // 火球(爆発の核)
  fireball({ pos, r = 2.5, life = 1.5, count = 7, spread = 0.55 }) {
    const group = new THREE.Group();
    group.position.set(pos.x, pos.y, pos.z);
    const geo = new THREE.SphereGeometry(1, 14, 10);
    const balls = [];
    for (let i = 0; i < count; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: 0xfff2ae, transparent: true, opacity: 1, depthWrite: false });
      mat.toneMapped = false;
      const m = new THREE.Mesh(geo, mat);
      const off = new THREE.Vector3(rand(-1, 1), rand(-0.4, 1.2), rand(-1, 1)).multiplyScalar(spread);
      m.userData = { off, sc: rand(0.55, 1) };
      balls.push(m);
      group.add(m);
    }
    this.scene.add(group);

    const c0 = new THREE.Color(0xfff7c8), c1 = new THREE.Color(0xff9a2a),
          c2 = new THREE.Color(0xe84d18), c3 = new THREE.Color(0x33333d);
    let t = 0;
    const scene = this.scene;
    return this.add({
      update(dt) {
        t += dt;
        const k = clamp01(t / life);
        const grow = 1 - Math.pow(1 - k, 2.6);
        for (const b of balls) {
          const s = Math.max(0.001, r * grow * b.userData.sc);
          b.scale.set(s, s, s);
          b.position.copy(b.userData.off).multiplyScalar(r * grow * 1.25);
          b.position.y += k * r * 0.55; // 上昇
          let col;
          if (k < 0.25) col = c0.clone().lerp(c1, k / 0.25);
          else if (k < 0.55) col = c1.clone().lerp(c2, (k - 0.25) / 0.3);
          else col = c2.clone().lerp(c3, (k - 0.55) / 0.45);
          b.material.color.copy(col);
          b.material.opacity = k < 0.75 ? 1 : 1 - (k - 0.75) / 0.25;
        }
        return t < life;
      },
      dispose() {
        scene.remove(group);
        geo.dispose();
        balls.forEach(b => b.material.dispose());
      },
    });
  }

  // 立方体の破片
  debris({ pos, count = 16, colors = [0x7d8088, 0x6e7178], size = 0.14, speed = 5,
           gravity = -14, life = 1.6, dir = null }) {
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshStandardMaterial({ roughness: 0.9 });
    const mesh = new THREE.InstancedMesh(geo, mat, count);
    mesh.castShadow = true;
    const items = [];
    const c = new THREE.Color();
    for (let i = 0; i < count; i++) {
      const th = rand(Math.PI * 2), ph = Math.acos(rand(-1, 1));
      items.push({
        p: new THREE.Vector3(pos.x, pos.y, pos.z),
        v: new THREE.Vector3(
          (dir ? dir.x * speed : 0) + Math.sin(ph) * Math.cos(th) * speed * rand(0.3, 1),
          (dir ? dir.y * speed : 0) + Math.abs(Math.cos(ph)) * speed * rand(0.4, 1),
          (dir ? dir.z * speed : 0) + Math.sin(ph) * Math.sin(th) * speed * rand(0.3, 1)
        ),
        rot: new THREE.Euler(rand(Math.PI * 2), rand(Math.PI * 2), 0),
        rv: { x: rand(-9, 9), y: rand(-9, 9) },
        s: size * rand(0.5, 1.3),
      });
      c.set(randPick(colors)).offsetHSL(0, 0, rand(-0.05, 0.05));
      mesh.setColorAt(i, c);
    }
    this.scene.add(mesh);
    const dummy = new THREE.Object3D();
    let t = 0;
    const scene = this.scene;
    return this.add({
      update(dt) {
        t += dt;
        const k = clamp01(t / life);
        const shrink = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
        for (let i = 0; i < count; i++) {
          const it = items[i];
          it.v.y += gravity * dt;
          it.p.addScaledVector(it.v, dt);
          if (it.p.y < it.s / 2) { // バウンド
            it.p.y = it.s / 2;
            it.v.y = Math.abs(it.v.y) * 0.35;
            it.v.x *= 0.6; it.v.z *= 0.6;
          }
          it.rot.x += it.rv.x * dt;
          it.rot.y += it.rv.y * dt;
          dummy.position.copy(it.p);
          dummy.rotation.copy(it.rot);
          dummy.scale.setScalar(Math.max(0.001, it.s * shrink));
          dummy.updateMatrix();
          mesh.setMatrixAt(i, dummy.matrix);
        }
        mesh.instanceMatrix.needsUpdate = true;
        return t < life;
      },
      dispose() { scene.remove(mesh); geo.dispose(); mat.dispose(); },
    });
  }

  // 上昇する煙
  smoke({ pos, count = 9, life = 2.6, r = 1.6, rise = 2.2, color = 0x2c2c34 }) {
    const geo = new THREE.SphereGeometry(1, 10, 8);
    const group = new THREE.Group();
    const balls = [];
    for (let i = 0; i < count; i++) {
      const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.55, depthWrite: false });
      const m = new THREE.Mesh(geo, mat);
      m.userData = {
        off: new THREE.Vector3(rand(-0.6, 0.6), rand(0, 0.8), rand(-0.6, 0.6)),
        delay: rand(0, 0.5), sc: rand(0.5, 1),
      };
      balls.push(m);
      group.add(m);
    }
    group.position.set(pos.x, pos.y, pos.z);
    this.scene.add(group);
    let t = 0;
    const scene = this.scene;
    return this.add({
      update(dt) {
        t += dt;
        for (const b of balls) {
          const k = clamp01((t - b.userData.delay) / life);
          const s = Math.max(0.001, r * (0.3 + k) * b.userData.sc);
          b.scale.setScalar(s);
          b.position.copy(b.userData.off).multiplyScalar(1 + k * 2);
          b.position.y += k * rise;
          b.material.opacity = 0.5 * (1 - k);
        }
        return t < life + 0.5;
      },
      dispose() {
        scene.remove(group);
        geo.dispose();
        balls.forEach(b => b.material.dispose());
      },
    });
  }

  // 稲妻(ジグザグの発光ボックス連結、チラついて消える)
  bolt({ x = 0, z = 0, h = 13, life = 0.4 }) {
    const group = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({
      color: 0xeaf4ff, transparent: true, opacity: 1,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    mat.toneMapped = false;
    const pts = [new THREE.Vector3(x + rand(-1.6, 1.6), h, z + rand(-1.6, 1.6))];
    const n = 7;
    for (let i = 1; i < n; i++) {
      const y = h * (1 - i / n);
      const sp = (y / h) * 1.8;
      pts.push(new THREE.Vector3(x + rand(-sp, sp), y, z + rand(-sp, sp)));
    }
    pts.push(new THREE.Vector3(x, 0, z));
    const geos = [];
    const up = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      const len = a.distanceTo(b);
      const geo = new THREE.BoxGeometry(0.1, len, 0.1);
      const m = new THREE.Mesh(geo, mat);
      m.position.copy(a).add(b).multiplyScalar(0.5);
      m.quaternion.setFromUnitVectors(up, b.clone().sub(a).normalize());
      group.add(m);
      geos.push(geo);
    }
    this.scene.add(group);
    let t = 0;
    const scene = this.scene;
    return this.add({
      update(dt) {
        t += dt;
        mat.opacity = Math.max(0, 1 - t / life) * (0.55 + Math.random() * 0.45);
        return t < life;
      },
      dispose() { scene.remove(group); geos.forEach(g => g.dispose()); mat.dispose(); },
    });
  }

  // 戦隊モノ定番・背景の大爆発(複合エフェクト)
  bigExplosion({ pos, stage, screen, sfx, scale = 1 }) {
    const fx = this;
    const fire = (delay, fn) => fx.add({
      t: 0,
      update(dt) { this.t += dt; if (this.t >= delay) { fn(); return false; } return true; },
      dispose() {},
    });

    sfx.boom();
    screen.flash('#fff8e0', 0.3, 0.95);
    stage.shake(0.3 * scale);
    this.fireball({ pos, r: 3.2 * scale, life: 1.7 });
    this.ring({ pos: { x: pos.x, y: 0.05, z: pos.z }, r1: 9 * scale, life: 0.9, color: 0xffc060, opacity: 0.7 });
    this.debris({
      pos, count: 26, colors: [0x3a3a44, 0x5a4a3a, 0x7d8088], size: 0.22 * scale,
      speed: 9 * scale, life: 2.2,
    });
    this.burst({
      pos, count: 70, colors: ['#ffd98a', '#ff9a2a', '#ff5a1f', '#fff2c0'],
      speed: 8 * scale, gravity: -7, life: 1.4, size: 0.13, drag: 1.2,
    });

    fire(0.28, () => {
      sfx.boom();
      stage.shake(0.22 * scale);
      this.fireball({ pos: { x: pos.x - 2.4 * scale, y: pos.y + 0.4, z: pos.z + 0.8 }, r: 2.3 * scale, life: 1.5 });
      this.fireball({ pos: { x: pos.x + 2.6 * scale, y: pos.y + 0.2, z: pos.z - 0.5 }, r: 2.6 * scale, life: 1.6 });
    });
    fire(0.55, () => {
      this.smoke({ pos: { x: pos.x, y: pos.y + 1.2 * scale, z: pos.z }, r: 2.2 * scale, life: 3, rise: 3.4 * scale });
      this.burst({
        pos: { x: pos.x, y: pos.y + 0.5, z: pos.z }, count: 40,
        colors: ['#ffb060', '#ff7a30'], speed: 5 * scale, gravity: -3, life: 1.8, size: 0.1,
      });
    });
  }
}

// ============ 2D画面エフェクト(集中線・フラッシュ・インパクトフレーム) ============
export class ScreenFX {
  constructor(canvas) {
    this.cv = canvas;
    this.g = canvas.getContext('2d');
    this.speedInt = 0;       // 集中線の強さ 0..1
    this.flashes = [];       // {color, t, dur, peak}
    this.impactT = 0;
    this.impactDur = 0;
    this._impactSeed = 1;
    addEventListener('resize', () => this.resize());
    this.resize();
  }

  resize() {
    this.cv.width = innerWidth * Math.min(devicePixelRatio, 2);
    this.cv.height = innerHeight * Math.min(devicePixelRatio, 2);
  }

  flash(color = '#ffffff', dur = 0.25, peak = 0.9) {
    this.flashes.push({ color, t: 0, dur, peak });
  }

  impact(dur = 0.3) {
    this.impactT = 0.0001;
    this.impactDur = dur;
    this._impactSeed = Math.random() * 1000;
  }

  setSpeed(v) { this.speedInt = v; }

  reset() {
    this.speedInt = 0;
    this.flashes = [];
    this.impactT = 0;
  }

  update(dt) {
    const { g, cv } = this;
    g.clearRect(0, 0, cv.width, cv.height);
    const cx = cv.width / 2, cy = cv.height / 2;
    const R = Math.hypot(cx, cy);

    // 集中線(アニメ風スピード線)
    if (this.speedInt > 0.01) {
      g.save();
      g.translate(cx, cy);
      const n = Math.floor(70 * this.speedInt);
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const inner = R * (0.42 + Math.random() * 0.3) * (1.25 - this.speedInt * 0.45);
        const wdt = (1 + Math.random() * 5) * this.speedInt;
        g.strokeStyle = `rgba(255,255,255,${(0.1 + Math.random() * 0.4) * this.speedInt})`;
        g.lineWidth = wdt;
        g.beginPath();
        g.moveTo(Math.cos(a) * inner, Math.sin(a) * inner);
        g.lineTo(Math.cos(a) * R * 1.2, Math.sin(a) * R * 1.2);
        g.stroke();
      }
      g.restore();
    }

    // インパクトフレーム(白地に黒の集中ウェッジ)
    if (this.impactT > 0) {
      this.impactT += dt;
      const k = this.impactT / this.impactDur;
      if (k >= 1) {
        this.impactT = 0;
      } else {
        const alpha = k < 0.15 ? 1 : 1 - (k - 0.15) / 0.85;
        g.save();
        // 白地は素早く抜いて、止まったキャラが見えるように
        g.globalAlpha = Math.max(0, alpha - k * 2.4);
        g.fillStyle = '#f5f2ea';
        g.fillRect(0, 0, cv.width, cv.height);
        g.globalAlpha = alpha;
        g.translate(cx, cy);
        g.fillStyle = '#101014';
        const seed = this._impactSeed;
        for (let i = 0; i < 46; i++) {
          const a = (i / 46) * Math.PI * 2 + Math.sin(i * 13.7 + seed) * 0.1;
          const w = 0.014 + Math.abs(Math.sin(i * 7.3 + seed)) * 0.05;
          const inner = R * (0.2 + Math.abs(Math.sin(i * 3.1 + seed)) * 0.16);
          g.beginPath();
          g.moveTo(Math.cos(a - w) * R * 1.3, Math.sin(a - w) * R * 1.3);
          g.lineTo(Math.cos(a + w) * R * 1.3, Math.sin(a + w) * R * 1.3);
          g.lineTo(Math.cos(a) * inner, Math.sin(a) * inner);
          g.closePath();
          g.fill();
        }
        g.restore();
      }
    }

    // フラッシュ
    for (let i = this.flashes.length - 1; i >= 0; i--) {
      const f = this.flashes[i];
      f.t += dt;
      const k = f.t / f.dur;
      if (k >= 1) { this.flashes.splice(i, 1); continue; }
      g.globalAlpha = f.peak * (1 - k) * (1 - k);
      g.fillStyle = f.color;
      g.fillRect(0, 0, cv.width, cv.height);
      g.globalAlpha = 1;
    }
  }
}

// ============================================================
// [sfx.js より統合]
// ============================================================

// WebAudioによる効果音合成(外部音源ファイル不要)
//
// リッチ化の設計:
// - マスターチェーン: master → コンプレッサー → 出力 (音圧を均して迫力を出す)
// - 生成IRによるコンボリューションリバーブ(wetセンド)で空間の高級感
// - 各音は「サブベース + ボディ + トランジェント + 空気感」の多レイヤー
// - 爆発系はWaveShaperで歪ませ、金属音は非整数倍音で鳴らす

export class SFX {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.convolver = null;
    this.enabled = true;
    this._noiseBuf = null;
    this._distCurve = null;
    this._recTime = null;  // 録画時はこの論理時刻でスケジュールする
  }

  // master → compressor → destination とリバーブセンドを構築(this.ctx前提)
  _buildGraph() {
    this.master = this.ctx.createGain();
    this.master.gain.value = this.enabled ? 0.5 : 0;
    const comp = this.ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.knee.value = 18;
    comp.ratio.value = 5;
    comp.attack.value = 0.003;
    comp.release.value = 0.22;
    this.master.connect(comp);
    comp.connect(this.ctx.destination);

    // リバーブ(2秒の減衰ノイズIR)
    this.convolver = this.ctx.createConvolver();
    this.convolver.buffer = this._impulse(2.0, 2.4);
    const ret = this.ctx.createGain();
    ret.gain.value = 0.85;
    this.convolver.connect(ret);
    ret.connect(this.master);
  }

  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this._buildGraph();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  // 録画用: Offline(等の)AudioContext上にグラフを構築する。
  // 以後 _recTime に論理時刻をセットしてから各音メソッドを呼ぶと、その時刻で
  // offlineにスケジュールされる(コマ送り映像と完全同期)。
  useContext(ctx) {
    this.ctx = ctx;
    this.enabled = true;
    this._buildGraph();
  }

  setEnabled(on) {
    this.enabled = on;
    if (this.master) this.master.gain.value = on ? 0.5 : 0;
  }

  get t() { return this._recTime != null ? this._recTime : this.ctx.currentTime; }
  _ok() { return this.ctx && this.enabled; }

  // ---- 基盤ヘルパー ----
  _impulse(dur, decay) {
    const sr = this.ctx.sampleRate;
    const len = Math.floor(sr * dur);
    const buf = this.ctx.createBuffer(2, len, sr);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
      }
    }
    return buf;
  }

  _noiseBuffer() {
    if (this._noiseBuf) return this._noiseBuf;
    const len = this.ctx.sampleRate * 2;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this._noiseBuf = buf;
    return buf;
  }

  _noiseSrc() {
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuffer();
    src.loop = true;
    return src;
  }

  // 歪み(tanhソフトクリップ)
  _dist() {
    if (!this._distCurve) {
      const n = 1024;
      const c = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        const x = (i / (n - 1)) * 2 - 1;
        c[i] = Math.tanh(x * 3.2);
      }
      this._distCurve = c;
    }
    const ws = this.ctx.createWaveShaper();
    ws.curve = this._distCurve;
    return ws;
  }

  // 出力チャンネル(dry + リバーブセンド + 任意パン)
  _chan(reverb = 0.15, pan = 0) {
    let node = this.ctx.createGain();
    let head = node;
    if (pan !== 0 && this.ctx.createStereoPanner) {
      const p = this.ctx.createStereoPanner();
      p.pan.value = pan;
      node.connect(p);
      head = p;
    }
    head.connect(this.master);
    if (reverb > 0) {
      const send = this.ctx.createGain();
      send.gain.value = reverb;
      node.connect(send);
      send.connect(this.convolver);
    }
    return node;
  }

  // エンベロープ付きゲイン(指定ノードに接続)
  _env(to, peak, attack, decay, start = this.t) {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, start);
    g.gain.linearRampToValueAtTime(peak, start + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, start + attack + decay);
    g.connect(to);
    return g;
  }

  _tone(to, { type = 'sine', f0 = 440, f1 = null, dur = 0.3, peak = 0.3, attack = 0.005, start = this.t, detune = 0 }) {
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, start);
    if (f1 !== null) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), start + dur);
    if (detune) o.detune.value = detune;
    const g = this._env(to, peak, attack, dur, start);
    o.connect(g);
    o.start(start);
    o.stop(start + attack + dur + 0.1);
    return o;
  }

  _noiseHit(to, { type = 'bandpass', f0 = 1000, f1 = null, q = 1, dur = 0.2, peak = 0.4, attack = 0.004, start = this.t, distort = false }) {
    const src = this._noiseSrc();
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.Q.value = q;
    f.frequency.setValueAtTime(f0, start);
    if (f1 !== null) f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), start + dur);
    const g = this._env(to, peak, attack, dur, start);
    src.connect(f);
    if (distort) {
      const ws = this._dist();
      f.connect(ws);
      ws.connect(g);
    } else {
      f.connect(g);
    }
    src.start(start);
    src.stop(start + attack + dur + 0.15);
  }

  // ---- 効果音 ----

  // 風切り音(空気感 + パンスイープ)
  whoosh(dur = 0.45, peak = 0.5) {
    if (!this._ok()) return;
    const ch = this._chan(0.18);
    // パンを左→右へ流す
    if (this.ctx.createStereoPanner) {
      const p = this.ctx.createStereoPanner();
      p.pan.setValueAtTime(-0.5, this.t);
      p.pan.linearRampToValueAtTime(0.5, this.t + dur);
      ch.disconnect();
      ch.connect(p);
      p.connect(this.master);
      const send = this.ctx.createGain();
      send.gain.value = 0.18;
      ch.connect(send);
      send.connect(this.convolver);
    }
    this._noiseHit(ch, { f0: 260, f1: 3200, q: 1.4, dur: dur * 0.75, peak, attack: dur * 0.3 });
    this._noiseHit(ch, { type: 'highpass', f0: 3800, dur, peak: peak * 0.3, attack: dur * 0.4 });
  }

  // 着地・衝撃(トランジェント + サブ + ボディ)
  thud(peak = 0.8) {
    if (!this._ok()) return;
    const ch = this._chan(0.22);
    this._noiseHit(ch, { type: 'highpass', f0: 2200, dur: 0.03, peak: peak * 0.55, attack: 0.001 });
    this._tone(ch, { f0: 96, f1: 34, dur: 0.3, peak: peak * 0.95, attack: 0.004 });
    this._noiseHit(ch, { type: 'lowpass', f0: 520, dur: 0.16, peak: peak * 0.5, attack: 0.002, distort: true });
  }

  // 大爆発(サブドロップ + 歪みノイズ + ステレオ残響)
  boom() {
    if (!this._ok()) return;
    const start = this.t;
    const ch = this._chan(0.5);
    // 初撃
    this._noiseHit(ch, { type: 'highpass', f0: 1500, dur: 0.05, peak: 0.7, attack: 0.001 });
    // サブベース・ドロップ
    this._tone(ch, { f0: 58, f1: 22, dur: 1.5, peak: 0.95, attack: 0.008 });
    // 歪んだ轟音(フィルタが閉じていく)
    this._noiseHit(ch, { type: 'lowpass', f0: 2000, f1: 70, q: 0.8, dur: 2.0, peak: 0.85, attack: 0.01, distort: true });
    // 左右の破片感
    for (const pan of [-0.6, 0.6]) {
      const side = this._chan(0.4, pan);
      this._noiseHit(side, { f0: 700, f1: 180, q: 1.2, dur: 0.7, peak: 0.3, attack: 0.02, start: start + 0.05 + Math.random() * 0.05 });
    }
  }

  // タイトル「シャキーン」(非整数倍音シマー + 空気)
  shing() {
    if (!this._ok()) return;
    const ch = this._chan(0.5);
    const start = this.t;
    [2240, 2780, 3520, 4360].forEach((f, i) => {
      this._tone(ch, {
        type: 'sine', f0: f * (1 + (Math.random() - 0.5) * 0.01), dur: 0.7 + i * 0.1,
        peak: 0.16 - i * 0.025, attack: 0.004, start: start + i * 0.012,
      });
    });
    // 引き抜きの「シュッ」
    this._noiseHit(ch, { type: 'highpass', f0: 5000, dur: 0.35, peak: 0.2, attack: 0.02 });
    this._noiseHit(ch, { f0: 1200, f1: 4200, q: 2, dur: 0.18, peak: 0.18, attack: 0.01 });
  }

  // 名前ドーン!(和太鼓+ブレーキング・インパクト。タイトル表示用)
  slam() {
    if (!this._ok()) return;
    const ch = this._chan(0.4);
    // 高域アタック
    this._noiseHit(ch, { type: 'highpass', f0: 2500, dur: 0.04, peak: 0.7, attack: 0.001 });
    // 太鼓ボディ(ピッチ急落)
    this._tone(ch, { f0: 215, f1: 60, dur: 0.32, peak: 0.95, attack: 0.002 });
    this._tone(ch, { type: 'square', f0: 145, f1: 52, dur: 0.18, peak: 0.4, attack: 0.002 });
    // サブドロップ
    this._tone(ch, { f0: 82, f1: 28, dur: 0.55, peak: 0.85, attack: 0.005 });
    // 歪みボディ
    this._noiseHit(ch, { type: 'lowpass', f0: 950, f1: 110, dur: 0.4, peak: 0.6, attack: 0.002, distort: true });
    // 余韻の金属気味シマー(薄く)
    [3150, 4080].forEach((f, i) => {
      this._tone(ch, { type: 'triangle', f0: f, dur: 0.5, peak: 0.05, attack: 0.003, start: this.t + i * 0.01 });
    });
  }

  // 小さいヒット/キメ(パンチ + クリック)
  hit(freq = 220, peak = 0.5) {
    if (!this._ok()) return;
    const ch = this._chan(0.15);
    this._noiseHit(ch, { type: 'highpass', f0: 3000, dur: 0.02, peak: peak * 0.5, attack: 0.001 });
    this._tone(ch, { type: 'square', f0: freq, f1: freq * 0.4, dur: 0.15, peak: peak * 0.7, attack: 0.003 });
    this._tone(ch, { f0: freq * 0.5, f1: freq * 0.2, dur: 0.12, peak: peak * 0.5, attack: 0.003 });
  }

  // テレポート「ポンッ」
  pop(up = true) {
    if (!this._ok()) return;
    const ch = this._chan(0.2);
    const f0 = up ? 300 : 880, f1 = up ? 1150 : 240;
    this._tone(ch, { f0, f1, dur: 0.16, peak: 0.4, attack: 0.004 });
    this._tone(ch, { f0: f0 * 2, f1: f1 * 2, dur: 0.1, peak: 0.12, attack: 0.004 });
    this._noiseHit(ch, { type: 'highpass', f0: 4000, dur: 0.03, peak: 0.12, attack: 0.001 });
  }

  // ライト点灯・電撃(デチューン saw + ノイズ)
  zap() {
    if (!this._ok()) return;
    const ch = this._chan(0.25);
    this._tone(ch, { type: 'sawtooth', f0: 2700, f1: 150, dur: 0.26, peak: 0.22, attack: 0.003 });
    this._tone(ch, { type: 'sawtooth', f0: 2400, f1: 130, dur: 0.24, peak: 0.18, attack: 0.003, detune: 18 });
    this._noiseHit(ch, { f0: 3500, f1: 600, q: 3, dur: 0.2, peak: 0.2, attack: 0.002 });
  }

  // ブロック破壊(石の砕け感 + 破片)
  crack() {
    if (!this._ok()) return;
    const start = this.t;
    const ch = this._chan(0.18);
    this._noiseHit(ch, { f0: 1500, q: 0.7, dur: 0.1, peak: 0.55, attack: 0.001 });
    this._tone(ch, { f0: 280, f1: 90, dur: 0.12, peak: 0.4, attack: 0.002 });
    // 破片がパラパラ
    for (let i = 0; i < 3; i++) {
      this._noiseHit(ch, {
        f0: 1800 + Math.random() * 1500, q: 4, dur: 0.05, peak: 0.12,
        attack: 0.002, start: start + 0.06 + i * 0.045 + Math.random() * 0.02,
      });
    }
  }

  // 盛り上げ(上昇音 + チック加速)
  riser(dur = 1.2) {
    if (!this._ok()) return;
    const ch = this._chan(0.35);
    this._noiseHit(ch, { f0: 220, f1: 4400, q: 2.4, dur, peak: 0.3, attack: dur * 0.8 });
    this._tone(ch, { f0: 180, f1: 760, dur, peak: 0.14, attack: dur * 0.7 });
    this._tone(ch, { f0: 182, f1: 772, dur, peak: 0.1, attack: dur * 0.7, detune: 14 });
  }

  // ファンファーレ(ブラス風2声デチューン + ティンパニ + シンバル)
  fanfare() {
    if (!this._ok()) return;
    const start = this.t;
    const ch = this._chan(0.45);
    // ブラス和音
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
      for (const det of [-7, 7]) {
        const o = this.ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = f;
        o.detune.value = det;
        const lp = this.ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.setValueAtTime(700, start);
        lp.frequency.linearRampToValueAtTime(2600, start + 0.18);
        const ns = start + i * 0.03;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.0001, ns);
        g.gain.linearRampToValueAtTime(0.085, ns + 0.04);
        g.gain.setValueAtTime(0.085, ns + 0.6);
        g.gain.exponentialRampToValueAtTime(0.0001, ns + 1.6);
        o.connect(lp); lp.connect(g); g.connect(ch);
        o.start(ns); o.stop(ns + 1.8);
      }
    });
    // ティンパニ(ドンドコ)
    [0, 0.12, 0.24].forEach((d, i) => {
      this._tone(ch, { f0: 82 - i * 6, f1: 48, dur: 0.4, peak: 0.5, attack: 0.005, start: start + d });
    });
    // シンバル
    this._noiseHit(ch, { type: 'highpass', f0: 6000, dur: 1.3, peak: 0.16, attack: 0.005 });
  }

  // 導火線「シューッ」+ パチパチ
  fuse(dur = 0.9) {
    if (!this._ok()) return;
    const start = this.t;
    const ch = this._chan(0.1);
    this._noiseHit(ch, { type: 'highpass', f0: 3600, dur, peak: 0.26, attack: 0.05 });
    const n = Math.floor(dur * 14);
    for (let i = 0; i < n; i++) {
      this._noiseHit(ch, {
        f0: 2500 + Math.random() * 3000, q: 6, dur: 0.025, peak: 0.12,
        attack: 0.001, start: start + Math.random() * dur,
      });
    }
  }

  // もぐもぐ
  chomp() {
    if (!this._ok()) return;
    const ch = this._chan(0.06);
    this._noiseHit(ch, { type: 'lowpass', f0: 750, dur: 0.08, peak: 0.4, attack: 0.004 });
    this._tone(ch, { f0: 150, f1: 65, dur: 0.09, peak: 0.35, attack: 0.004 });
  }

  // 目覚ましアラーム
  alarm() {
    if (!this._ok()) return;
    const ch = this._chan(0.12);
    for (let i = 0; i < 4; i++) {
      const start = this.t + i * 0.19;
      this._tone(ch, { type: 'square', f0: 980, dur: 0.1, peak: 0.16, attack: 0.008, start });
      this._tone(ch, { type: 'square', f0: 1240, dur: 0.1, peak: 0.1, attack: 0.008, start });
    }
  }

  // 弓「ビュン」(高Q帯域の弦リンギング)
  twang() {
    if (!this._ok()) return;
    const ch = this._chan(0.18);
    const src = this._noiseSrc();
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 16;
    f.frequency.setValueAtTime(190, this.t);
    f.frequency.exponentialRampToValueAtTime(150, this.t + 0.25);
    const g = this._env(ch, 0.55, 0.002, 0.3);
    src.connect(f); f.connect(g);
    src.start(this.t); src.stop(this.t + 0.4);
    this._noiseHit(ch, { type: 'highpass', f0: 2500, dur: 0.04, peak: 0.2, attack: 0.001 });
  }

  // 水しぶき + 水滴
  splash() {
    if (!this._ok()) return;
    const start = this.t;
    const ch = this._chan(0.3);
    this._noiseHit(ch, { f0: 650, f1: 2600, q: 0.7, dur: 0.45, peak: 0.55, attack: 0.01 });
    this._tone(ch, { f0: 150, f1: 60, dur: 0.18, peak: 0.35, attack: 0.005 });
    for (let i = 0; i < 4; i++) {
      this._tone(ch, {
        f0: 1100 + Math.random() * 900, f1: 1900 + Math.random() * 800, dur: 0.06, peak: 0.1,
        attack: 0.003, start: start + 0.15 + i * 0.07 + Math.random() * 0.04,
      });
    }
  }

  // 遠吠え(ビブラート付き)
  howl(dur = 1.0) {
    if (!this._ok()) return;
    const start = this.t;
    const ch = this._chan(0.55);
    const o = this.ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(340, start);
    o.frequency.linearRampToValueAtTime(620, start + dur * 0.45);
    o.frequency.linearRampToValueAtTime(440, start + dur);
    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = 5.5;
    const lfoG = this.ctx.createGain();
    lfoG.gain.value = 14;
    lfo.connect(lfoG);
    lfoG.connect(o.frequency);
    const g = this._env(ch, 0.25, dur * 0.25, dur * 0.85, start);
    o.connect(g);
    o.start(start); o.stop(start + dur + 0.2);
    lfo.start(start); lfo.stop(start + dur + 0.2);
    this._noiseHit(ch, { type: 'bandpass', f0: 900, q: 1.5, dur, peak: 0.05, attack: dur * 0.3 });
  }

  // 金床「ガキーン」(非整数倍音メタル)
  clang() {
    if (!this._ok()) return;
    const start = this.t;
    const ch = this._chan(0.4);
    [822, 1136, 1668, 2360, 3140].forEach((f, i) => {
      this._tone(ch, {
        type: 'triangle', f0: f, dur: 0.55 - i * 0.06, peak: 0.2 - i * 0.03,
        attack: 0.002, start: start + i * 0.004,
      });
    });
    this._noiseHit(ch, { type: 'highpass', f0: 2400, dur: 0.05, peak: 0.4, attack: 0.001 });
    this._tone(ch, { f0: 120, f1: 50, dur: 0.2, peak: 0.5, attack: 0.004 });
  }

  // スライム「ボヨン」
  boing(up = true) {
    if (!this._ok()) return;
    const ch = this._chan(0.15);
    const f0 = up ? 170 : 420, f1 = up ? 540 : 150;
    this._tone(ch, { f0, f1, dur: 0.24, peak: 0.45, attack: 0.008 });
    this._tone(ch, { f0: f0 * 1.5, f1: f1 * 1.5, dur: 0.2, peak: 0.15, attack: 0.008, detune: 10 });
  }

  // ハチミツ「ぬちゃ…」
  squeak() {
    if (!this._ok()) return;
    const ch = this._chan(0.08);
    this._tone(ch, { f0: 880, f1: 600, dur: 0.4, peak: 0.12, attack: 0.06 });
    this._noiseHit(ch, { type: 'bandpass', f0: 1400, q: 5, dur: 0.35, peak: 0.07, attack: 0.08 });
  }

  // ドラゴンの咆哮(歪み + サブ + うなり)
  roar(dur = 1.2) {
    if (!this._ok()) return;
    const start = this.t;
    const ch = this._chan(0.45);
    // 歪んだ咆哮本体
    const o = this.ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(130, start);
    o.frequency.linearRampToValueAtTime(68, start + dur);
    const ws = this._dist();
    const g = this._env(ch, 0.35, 0.07, dur, start);
    o.connect(ws); ws.connect(g);
    o.start(start); o.stop(start + dur + 0.15);
    // サブ
    this._tone(ch, { f0: 55, f1: 32, dur, peak: 0.45, attack: 0.06 });
    // うなりノイズ(振幅LFO)
    const n = this._noiseSrc();
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 650;
    const ng = this._env(ch, 0.3, 0.08, dur * 0.95, start);
    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = 9;
    const lfoG = this.ctx.createGain();
    lfoG.gain.value = 0.12;
    lfo.connect(lfoG);
    lfoG.connect(ng.gain);
    n.connect(lp); lp.connect(ng);
    n.start(start); n.stop(start + dur);
    lfo.start(start); lfo.stop(start + dur);
  }
}

export const sfx = new SFX();

// ============================================================
// [titles.js より統合]
// ============================================================

// 演出テキストオーバーレイ(二つ名・名前・チームタイトル)

const VARIANTS = ['v-slam', 'v-slide', 'v-rise'];

export class Titles {
  constructor(el) {
    this.el = el;
    this.bubbleEl = null;
  }

  // 決め台詞のコミック風吹き出し(位置はmoveBubbleで毎フレーム更新)
  bubble(text) {
    this.clearBubble();
    const b = document.createElement('div');
    b.className = 'bubble';
    // しっぽはclip-pathの外に置く(本体のクリップで切られないようコンテナ直下)
    b.innerHTML =
      `<div class="bubble-body"><div class="bubble-in">${esc(text)}</div></div>` +
      `<svg class="bubble-tail" width="38" height="30" viewBox="0 0 38 30" shape-rendering="crispEdges">` +
      `<path d="M4 0 H34 V6 H24 V14 H14 V22 H4 Z" fill="#1a1a1a"/>` +
      `<path d="M8 0 H30 V2 H20 V10 H10 V16 H8 Z" fill="#ffffff"/>` +
      `</svg>`;
    document.getElementById('app').appendChild(b);
    this.bubbleEl = b;
    return b;
  }

  // 頭上スクリーン座標(x,y)に吹き出しを配置。flip=trueで左右反転
  moveBubble(x, y, flip) {
    if (!this.bubbleEl) return;
    const b = this.bubbleEl;
    b.classList.toggle('flip', !!flip);
    const w = b.offsetWidth, h = b.offsetHeight;
    let left = flip ? x - w + 24 : x - 24;
    let top = y - h - 34;
    left = Math.max(8, Math.min(innerWidth - w - 8, left));
    top = Math.max(8, top);
    b.style.left = left + 'px';
    b.style.top = top + 'px';
  }

  clearBubble(animated = false) {
    if (!this.bubbleEl) return;
    const b = this.bubbleEl;
    this.bubbleEl = null;
    if (animated) {
      b.classList.add('out');
      setTimeout(() => b.remove(), 200);
    } else {
      b.remove();
    }
  }

  _mk(cls, html, color) {
    const d = document.createElement('div');
    d.className = cls;
    d.innerHTML = html;
    if (color) d.style.setProperty('--c', color);
    this.el.appendChild(d);
    return d;
  }

  kicker(text, color) {
    if (!text) return null;
    return this._mk(`t-kicker ${randPick(VARIANTS)}`, esc(text), color);
  }

  name(text, color, { sub = '' } = {}) {
    const n = this._mk(`t-name ${randPick(VARIANTS)}`, esc(text), color);
    const len = [...text].length;
    if (len > 7) n.style.fontSize = `min(11vmin, ${(86 / len).toFixed(1)}vw)`;
    this._mk('t-rule', '', color);
    if (sub) this._mk('t-sub v-rise', esc(sub), color);
    return n;
  }

  // チーム名(中央・1文字ずつ色違いポップ)
  teamTitle(kickerText, nameText, colors) {
    this.el.classList.add('center');
    if (kickerText) this._mk('t-team-kicker v-rise', esc(kickerText));
    const chars = [...nameText].map((ch, i) =>
      `<span class="ch" style="--c:${colors[i % colors.length]};--d:${(i * 0.05).toFixed(2)}s">${esc(ch)}</span>`
    ).join('');
    const el = this._mk('t-team-name', chars);
    const len = [...nameText].length;
    if (len > 7) el.style.fontSize = `min(13vmin, ${(92 / len).toFixed(1)}vw)`;
  }

  out() {
    [...this.el.children].forEach(c => c.classList.add('t-out'));
  }

  clear(immediate = true) {
    this.clearBubble(!immediate);
    if (immediate) {
      this.el.innerHTML = '';
      this.el.classList.remove('center');
    } else {
      this.out();
      setTimeout(() => { this.el.innerHTML = ''; this.el.classList.remove('center'); }, 420);
    }
  }
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, m => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[m]));
}
