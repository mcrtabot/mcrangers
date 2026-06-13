// 個人紹介演出 x64 + シーン共通フレームワーク

import * as THREE from 'three';
import { PlayerModel, crouchPose, flyPose, heroLandPose, heroPoses, idlePose, jumpRisePose, makeAnvil, makeArrow, makeBed, makeBee, makeBlockWall, makeCake, makeCat, makeChicken, makeCityline, makeClouds, makeCreeper, makeDragon, makeElytra, makeEndPortalFrame, makeEnderman, makeExit, makeGhast, makeGolem, makeMace, makeMinecart, makePearl, makePickaxe, makePig, makePillar, makePortal, makeRails, makeSheep, makeSkeletonSkin, makeSlimeBlock, makeSteak, makeTotem, makeTrident, makeVine, makeWarden, makeWolf, makeZombieSkin, mobWalk, runPose, tuckPose } from './actors.js';
import { E, clamp01, lerp, rand, seg, within } from './core.js';
import { makeBlock } from './engine.js';

// エンダーパール/ゲート系で共用する紫パーティクル色
const ENDER = ['#c05fff', '#8a2be2', '#ff7af0', '#e0b0ff'];

// ============================================================
// [scenes.js より統合]
// ============================================================

// 個人紹介演出シーン x10
// 各シーン: { duration, init(), frame(t, dt) } を返す
// ctx: { stage, fx, screen, titles, sfx }

// ---- 共通シェル ----
export function shell(duration, ctx) {
  const cues = [];
  const s = {
    duration, ctx,
    init() {}, update() {},
    at(time, fn) { cues.push({ time, fn, done: false }); },
    frame(t, dt) {
      for (const c of cues) {
        if (!c.done && t >= c.time) { c.done = true; c.fn(); }
      }
      s.update(t, dt);
    },
  };
  return s;
}

// 二つ名→名前→退場前のタイトル消去 をまとめて登録
export function addTitleCues(s, member, color, tKicker, tName, tOut) {
  const { titles, sfx } = s.ctx;
  s.at(tKicker, () => {
    if (member.title) { titles.kicker(member.title, color); sfx.shing(); }
  });
  s.at(tName, () => {
    titles.name(member.name, color, { sub: member.mc ? member.mc : '' });
    sfx.slam();
  });
  s.at(tOut, () => titles.clear(false));
}

export function dust(fx, pos, n = 24, spd = 2.6) {
  fx.burst({
    pos, count: n, colors: ['#cfd8ea', '#94a3c0', '#e8edf8'], speed: spd,
    gravity: -2.5, life: 0.75, size: 0.075, additive: false,
  });
}

// =========================================================
// 1. 疾走スライドイン (例1)
// =========================================================
function dashScene(ctx, member, player, color) {
  const s = shell(5.7, ctx);
  const { stage, fx, screen, sfx } = ctx;
  let exit;

  s.init = () => {
    stage.setEnv('street');
    stage.props.add(makeCityline({ z: -30 }));
    player.rotation.y = Math.PI / 2; // +x方向へ走る
    player.position.set(-10, 0, 0);
    sfx.whoosh(0.7, 0.5);
    screen.setSpeed(0.65);
    addTitleCues(s, member, color, 1.5, 2.1, 3.95);
    s.at(1.1, () => screen.setSpeed(0.18));
    exit = makeExit(player, 4.15, ctx, { vx: 1.2, vy: 10.5, vz: 5 });
  };

  let dustAcc = 0;
  s.update = (t, dt) => {
    // カメラ: 斜め上から、ホールド中はゆっくり寄る
    const k = seg(t, 1.1, 4.0, E.inOutQuad);
    stage.cam(
      lerp(2.6, 1.2, k), lerp(3.4, 1.9, k), lerp(4.6, 3.0, k),
      0, 1.05, 0
    );

    if (exit(t)) return;

    // スライドイン → センターでホールド(走り続ける)
    const x = lerp(-10, 0, seg(t, 0, 1.1, E.outCubic));
    player.position.x = x;
    player.resetPose();
    runPose(player, t, { speed: 12, amp: 1 });

    // 足元から後方へ砂塵
    dustAcc += dt;
    if (dustAcc > 0.13 && t < 4.0) {
      dustAcc = 0;
      fx.burst({
        pos: { x: player.position.x - 0.3, y: 0.12, z: 0 },
        count: 6, colors: ['#8fa0c0', '#cfd8ea'], speed: 1.8,
        dir: { x: -1, y: 0.25, z: 0 }, gravity: -2, life: 0.5, size: 0.06, additive: false,
      });
    }
  };
  return s;
}

// =========================================================
// 2. ネコ救出 (例2)
// =========================================================
function catScene(ctx, member, player, color) {
  const s = shell(7.0, ctx);
  const { stage, fx, sfx } = ctx;
  const TOP = 6;
  let cat, exit;

  s.init = () => {
    stage.setEnv('day');
    stage.props.add(makeClouds());
    const pillar = makePillar(TOP);
    stage.props.add(pillar);
    cat = makeCat();
    cat.position.set(0.26, TOP, 0.3);
    cat.rotation.y = Math.PI * 0.9;
    stage.props.add(cat);

    player.position.set(0, TOP, -0.35);
    player.rotation.y = 0; // ネコの方(+z)を向く=カメラに背中

    s.at(1.0, () => sfx.pop(true));
    addTitleCues(s, member, color, 3.4, 4.0, 5.35);
    exit = makeExit(player, 5.55, ctx, { vx: 1.8, vy: 10, vz: 6 });
  };

  s.update = (t, dt) => {
    // カメラ: 背中ショット → 頭部へ回り込みクローズアップ
    const k = seg(t, 1.6, 2.8, E.inOutCubic);
    stage.cam(
      lerp(0.4, 2.0, k), lerp(TOP + 1.7, TOP + 1.25, k), lerp(-4.2, 1.6, k),
      lerp(0, 0, k), lerp(TOP + 0.9, TOP + 1.32, k), lerp(0.3, 0, k)
    );

    // しっぽ
    if (cat) cat.tail.rotation.y = Math.sin(t * 7) * 0.45;

    const exiting = exit(t);

    if (!exiting) {
      player.resetPose();
      if (t < 1.0) {
        // しゃがんで手を伸ばす
        crouchPose(player, 0.55);
        player.armR.shoulder.rotation.x = -1.5;
        player.armR.elbow.rotation.x = -0.15;
      } else {
        // ネコを抱えて立ち上がる
        const up = seg(t, 1.0, 1.6, E.outQuad);
        crouchPose(player, 0.55 * (1 - up));
        player.armR.shoulder.rotation.x = -1.0;
        player.armL.shoulder.rotation.x = -1.0;
        player.armR.elbow.rotation.x = -1.0;
        player.armL.elbow.rotation.x = -1.0;
        // 顔がこっちを向く
        player.head.rotation.y = seg(t, 2.8, 3.3, E.outBack) * 0.95;
        player.head.rotation.x = -0.08 * seg(t, 2.8, 3.3, E.outQuad);
        const b = Math.sin(t * 2.4) * 0.012;
        player.spine.rotation.x += b;
      }
    }

    // ネコの保持位置(プレイヤーに追従)
    if (cat && t >= 1.0) {
      const hk = seg(t, 1.0, 1.45, E.inOutQuad);
      const hold = new THREE.Vector3(0.05, 0.82, 0.42).applyEuler(player.rotation).add(player.position);
      cat.position.lerpVectors(new THREE.Vector3(0.26, TOP, 0.3), hold, hk);
      cat.rotation.y = lerp(Math.PI * 0.9, Math.PI, hk); // こっち向きに抱えられる
    }
  };
  return s;
}

// =========================================================
// 3. ヒーロー着地
// =========================================================
function skyfallScene(ctx, member, player, color) {
  const s = shell(6.4, ctx);
  const { stage, fx, screen, sfx } = ctx;
  const T_IMPACT = 0.68;
  let exit;

  s.init = () => {
    stage.setEnv('nightcity');
    stage.props.add(makeCityline({ z: -32 }));
    player.position.set(0, 16, 0);
    player.rotation.y = 0;
    sfx.riser(T_IMPACT);
    s.at(T_IMPACT, () => {
      sfx.thud(1.0);
      sfx.boom();
      stage.shake(0.3);
      screen.flash('#bfd4ff', 0.18, 0.5);
      dust(fx, { x: 0, y: 0.1, z: 0 }, 46, 4.5);
      fx.ring({ pos: { x: 0, y: 0.04, z: 0 }, r1: 4.2, life: 0.6, color: 0x9fc0ff });
      fx.debris({ pos: { x: 0, y: 0.1, z: 0 }, count: 12, colors: [0x3a4258, 0x2c3247], size: 0.1, speed: 4, life: 1.2 });
      screen.setSpeed(0);
    });
    addTitleCues(s, member, color, 2.8, 3.4, 4.85);
    exit = makeExit(player, 5.05, ctx, { vx: -1, vy: 10.5, vz: 5 });
  };

  s.update = (t, dt) => {
    // カメラ: ロー&ワイド → 着地後にぐっと寄るヒーローショット
    const k = seg(t, T_IMPACT, 1.5, E.outCubic);
    stage.cam(
      lerp(0, 0.9, k), lerp(1.6, 0.85, k), lerp(7.0, 3.9, k),
      0, lerp(2.2, 0.95, k), 0
    );

    if (exit(t)) return;
    player.resetPose();

    if (t < T_IMPACT) {
      // 落下
      const k2 = t / T_IMPACT;
      player.position.y = 16 * (1 - k2 * k2);
      tuckPose(player, 0.45 + 0.4 * k2);
      screen.setSpeed(0.5 * k2);
      if (Math.random() < 0.6) {
        fx.burst({
          pos: { x: player.position.x, y: player.position.y + 1, z: player.position.z },
          count: 4, colors: ['#9fc0ff', '#ffffff'], speed: 0.8, gravity: 2,
          life: 0.4, size: 0.06,
        });
      }
    } else {
      player.position.y = 0;
      const hold = seg(t, 1.7, 2.4, E.inOutQuad); // 立ち上がり
      heroLandPose(player, 1 - hold);
      if (hold > 0) {
        idlePose(player, t);
        heroLandPose(player, 1 - hold);
        // 見上げる
        player.head.rotation.x = lerp(0.5, -0.12, seg(t, 2.3, 2.8, E.outQuad)) * (1 - hold * 0.0);
      }
      if (hold >= 1) {
        idlePose(player, t);
        player.head.rotation.x = -0.12;
      }
    }
  };
  return s;
}

// =========================================================
// 4. バク宙キメ
// =========================================================
function backflipScene(ctx, member, player, color) {
  const s = shell(6.3, ctx);
  const { stage, fx, screen, sfx } = ctx;
  const T_PLANT = 1.0, T_FLIP0 = 1.3, T_FLIP1 = 2.0, T_LAND = 2.0;
  let exit;

  s.init = () => {
    stage.setEnv('street');
    stage.props.add(makeCityline({ z: -34 }));
    player.position.set(0, 0, -8);
    player.rotation.y = 0; // カメラへ向かって走る
    screen.setSpeed(0.4);
    s.at(T_FLIP0, () => { sfx.whoosh(0.5, 0.55); screen.setSpeed(0.3); });
    s.at(T_LAND, () => {
      sfx.thud(0.9);
      stage.shake(0.18);
      dust(fx, { x: 0, y: 0.1, z: -0.6 }, 30, 3);
      fx.ring({ pos: { x: 0, y: 0.04, z: -0.6 }, r1: 2.6, life: 0.5, color: 0xbfd0ff });
      screen.setSpeed(0);
    });
    s.at(2.45, () => { sfx.hit(420, 0.5); screen.flash('#ffffff', 0.12, 0.25); });
    addTitleCues(s, member, color, 2.75, 3.35, 4.75);
    exit = makeExit(player, 4.95, ctx, { vx: 1.4, vy: 10.5, vz: 4.5 });
  };

  s.update = (t, dt) => {
    // カメラ
    const zoom = seg(t, 2.45, 2.75, E.outCubic) - seg(t, 3.4, 4.4, E.inOutQuad) * 0.4;
    stage.fov = 50 - 7 * zoom;
    stage.cam(0.4, 1.7, 4.6, 0, 1.15, -0.8);

    if (exit(t)) return;
    player.resetPose();

    if (t < T_PLANT) {
      player.position.z = lerp(-8, -0.6, seg(t, 0, T_PLANT, E.outQuad));
      runPose(player, t, { speed: 12 });
    } else if (t < T_FLIP0) {
      player.position.z = -0.6;
      crouchPose(player, seg(t, T_PLANT, T_FLIP0, E.outQuad) * 0.85);
    } else if (t < T_FLIP1) {
      const k = seg(t, T_FLIP0, T_FLIP1, E.inOutQuad);
      player.position.z = -0.6;
      player.position.y = Math.sin(k * Math.PI) * 1.75;
      player.rotation.x = -Math.PI * 2 * k; // バク宙
      tuckPose(player, Math.sin(k * Math.PI) * 1.0);
    } else {
      player.position.set(0, 0, -0.6);
      player.rotation.x = 0;
      const rise = seg(t, 2.15, 2.45, E.outQuad);
      if (rise < 1) {
        crouchPose(player, 0.85 * (1 - rise));
      } else {
        heroPoses[6](player, t); // カラテ構え
      }
    }
  };
  return s;
}

// =========================================================
// 5. 壁ぶち抜き登場
// =========================================================
function miningScene(ctx, member, player, color) {
  const s = shell(6.5, ctx);
  const { stage, fx, screen, sfx } = ctx;
  const T_BREAK = 1.45;
  let wall, pick, exit;

  s.init = () => {
    stage.setEnv('cave');
    wall = makeBlockWall({ cols: 9, rows: 5, size: 0.8 });
    wall.position.z = 1.3;
    stage.props.add(wall);

    pick = makePickaxe();
    // 柄を前腕と直交させて拳で握り、刃の尖った先端が振り下ろす方向(壁側)を向くように。
    // グリップは柄の下端寄り(てこを効かせる持ち方)= ヘッドが拳から遠くなるよう柄軸方向へオフセット
    pick.rotation.set(Math.PI / 2, Math.PI / 2, 0);
    pick.position.set(0, -0.13, 0.4);
    player.handR.add(pick);

    player.position.set(0, 0, -0.4);
    player.rotation.y = 0;

    // 壁の向こうからの打撃音
    for (const tt of [0.35, 0.8, 1.2]) {
      s.at(tt, () => { sfx.crack(); stage.shake(0.06); });
    }
    s.at(T_BREAK, () => {
      sfx.boom();
      sfx.crack();
      stage.shake(0.26);
      screen.flash('#ffd9a0', 0.15, 0.35);
      // 中央のブロックを破壊して破片を飛ばす
      const size = wall.blockSize;
      for (const b of wall.blocks) {
        const { c, r } = b.gridPos;
        const cx = Math.abs(c - 4);
        if (cx <= 1 && r <= 3) {
          b.visible = false;
        }
      }
      fx.debris({
        pos: { x: 0, y: 1.3, z: 1.4 }, count: 22,
        colors: [0x7d8088, 0x6e7178, 0x868a92], size: 0.2, speed: 5.5,
        dir: { x: 0, y: 0.25, z: 0.8 }, life: 1.8,
      });
      dust(fx, { x: 0, y: 1.2, z: 1.4 }, 40, 3.5);
    });
    addTitleCues(s, member, color, 2.9, 3.5, 4.95);
    exit = makeExit(player, 5.15, ctx, { vx: -1.2, vy: 10.5, vz: 4.5 });
  };

  s.update = (t, dt) => {
    const k = seg(t, T_BREAK, 2.6, E.inOutQuad);
    stage.cam(lerp(0, 0.7, k), lerp(1.8, 1.55, k), lerp(5.4, 5.0, k), 0, 1.25, lerp(1.3, 1.9, k));

    // 打撃で壁が揺れる
    if (t < T_BREAK) {
      const j = (t % 0.45 < 0.06) ? 0.03 : 0;
      wall.position.x = (Math.random() - 0.5) * j * 2;
    } else {
      wall.position.x = 0;
    }

    if (exit(t)) return;
    player.resetPose();

    if (t < T_BREAK) {
      // 壁の裏でスイング構え(ほぼ見えない)
      crouchPose(player, 0.2);
      player.armR.shoulder.rotation.x = -2.4 + Math.sin(t * 14) * 0.3;
    } else if (t < 2.6) {
      // 穴をくぐって前進
      const k2 = seg(t, T_BREAK + 0.15, 2.6, E.inOutQuad);
      player.position.z = lerp(-0.4, 2.0, k2);
      runPose(player, t, { speed: 7, amp: 0.55, lean: 0.18 });
      // ツルハシを持つ右腕はスイングの余韻
      player.armR.shoulder.rotation.x = lerp(-2.4, -0.6, seg(t, T_BREAK, 1.9, E.outQuad));
      player.armR.elbow.rotation.x = -0.3;
    } else {
      // ツルハシ担ぎポーズ
      player.position.z = 2.0;
      idlePose(player, t);
      player.armR.shoulder.rotation.x = -2.25;
      player.armR.elbow.rotation.x = -0.55;
      player.armL.shoulder.rotation.x = 0.3;
      player.armL.shoulder.rotation.z = 0.55;
      player.armL.elbow.rotation.x = -1.1;
      player.spine.rotation.y = -0.18;
      player.head.rotation.y = 0.18;
    }
  };
  return s;
}

// =========================================================
// 6. シルエット見参
// =========================================================
function spotlightScene(ctx, member, player, color) {
  const s = shell(6.6, ctx);
  const { stage, fx, screen, sfx } = ctx;
  const T_ON = 2.7;
  let exit;

  s.init = () => {
    stage.setEnv('dark');
    player.position.set(0, 0, -7);
    player.rotation.y = 0;
    s.at(T_ON, () => {
      sfx.zap();
      sfx.hit(500, 0.5);
      screen.flash('#ffffff', 0.22, 0.85);
      stage.key.intensity = 2.3;
      stage.hemi.intensity = 0.55;
      stage.shake(0.08);
      fx.ring({ pos: { x: 0, y: 0.04, z: -0.8 }, r1: 3.4, life: 0.6, color: new THREE.Color(color).getHex() });
    });
    addTitleCues(s, member, color, 3.0, 3.6, 5.05);
    exit = makeExit(player, 5.25, ctx, { vx: 1.3, vy: 10.5, vz: 5 });
  };

  s.update = (t, dt) => {
    const punch = seg(t, T_ON, T_ON + 0.25, E.outCubic);
    stage.fov = 50 - 5 * punch;
    stage.cam(0, 1.15, 4.8, 0, 1.25, -1.5);

    if (exit(t)) return;
    player.resetPose();

    if (t < T_ON - 0.15) {
      // 闇の中をゆっくり歩いてくる
      player.position.z = lerp(-7, -0.8, seg(t, 0, T_ON - 0.15, E.inOutQuad));
      runPose(player, t, { speed: 5.2, amp: 0.42, lean: 0.1 });
    } else {
      player.position.z = -0.8;
      heroPoses[0](player, t); // 腕組み
    }
  };
  return s;
}

// =========================================================
// 7. 旋風ターン
// =========================================================
function tornadoScene(ctx, member, player, color) {
  const s = shell(6.2, ctx);
  const { stage, fx, screen, sfx } = ctx;
  const T_STOP = 2.2;
  let exit, spinAngle = 0;

  s.init = () => {
    stage.setEnv('street');
    stage.props.add(makeCityline({ z: -32 }));
    player.position.set(0, 0, 0);
    spinAngle = 0;
    sfx.whoosh(0.6, 0.5);
    s.at(0.7, () => sfx.whoosh(0.55, 0.45));
    s.at(1.4, () => sfx.whoosh(0.5, 0.4));
    s.at(T_STOP, () => {
      sfx.hit(440, 0.55);
      screen.flash('#ffffff', 0.12, 0.3);
      screen.setSpeed(0);
      fx.ring({ pos: { x: 0, y: 0.04, z: 0 }, r1: 3, life: 0.5, color: new THREE.Color(color).getHex() });
    });
    addTitleCues(s, member, color, 2.5, 3.1, 4.65);
    exit = makeExit(player, 4.85, ctx, { vx: -1.3, vy: 10.5, vz: 5 });
  };

  let dustAcc = 0;
  s.update = (t, dt) => {
    const punch = seg(t, T_STOP, T_STOP + 0.3, E.outCubic);
    stage.fov = 52 - 7 * punch;
    stage.cam(Math.sin(t * 0.25) * 0.8, 1.6, 4.7, 0, 1.15, 0);

    if (exit(t)) return;
    player.resetPose();

    if (t < T_STOP) {
      // 减衰回転
      const w = 26 * (1 - t / T_STOP) + 2;
      spinAngle += w * dt;
      player.rotation.y = spinAngle;
      screen.setSpeed(0.45 * (1 - t / T_STOP) + 0.1);
      crouchPose(player, 0.18);
      player.armR.shoulder.rotation.z = -1.5;
      player.armL.shoulder.rotation.z = 1.5;
      player.armR.shoulder.rotation.x = 0;
      player.armL.shoulder.rotation.x = 0;
      player.armR.elbow.rotation.x = -0.2;
      player.armL.elbow.rotation.x = -0.2;

      dustAcc += dt;
      if (dustAcc > 0.09) {
        dustAcc = 0;
        fx.burst({
          pos: { x: rand(-0.5, 0.5), y: 0.1, z: rand(-0.5, 0.5) },
          count: 7, colors: ['#9fb0d0', '#cfd8ea'], speed: 2.5,
          gravity: -1, life: 0.6, size: 0.06, additive: false, spread: 1.2,
        });
      }
    } else {
      // ピタッと止まって指差し
      player.rotation.y = 0;
      heroPoses[2](player, t);
    }
  };
  return s;
}

// =========================================================
// 8. 飛翔フライバイ
// =========================================================
function rocketScene(ctx, member, player, color) {
  const s = shell(7.6, ctx);
  const { stage, fx, screen, sfx } = ctx;
  let exit;

  s.init = () => {
    stage.setEnv('day');
    stage.props.add(makeClouds({ count: 10 }));
    player.position.set(-26, 8, -14);
    sfx.whoosh(1.2, 0.4);
    s.at(1.5, () => sfx.whoosh(1.0, 0.7));
    s.at(3.55, () => {
      sfx.thud(0.7);
      dust(fx, { x: 0, y: 0.1, z: 0 }, 30, 3);
      fx.ring({ pos: { x: 0, y: 0.04, z: 0 }, r1: 2.8, life: 0.5, color: 0xffffff });
    });
    addTitleCues(s, member, color, 4.1, 4.7, 6.05);
    exit = makeExit(player, 6.25, ctx, { vx: 1.4, vy: 11, vz: 5 });
  };

  s.update = (t, dt) => {
    // カメラ
    const k = seg(t, 2.6, 3.6, E.inOutQuad);
    stage.cam(0, lerp(2.6, 1.7, k), lerp(8, 4.8, k), 0, lerp(4, 1.2, k), 0);

    if (exit(t)) {
      fxTrail(fx, player, 0.5);
      return;
    }
    player.resetPose();

    if (t < 1.3) {
      // 遠景フライバイ(左→右)
      const k2 = t / 1.3;
      player.position.set(lerp(-26, 26, k2), 8 + Math.sin(k2 * Math.PI) * 1.2, -14);
      player.rotation.set(Math.PI / 2, 0, -Math.PI / 2); // +x方向へ水平飛行
      flyPose(player, 1);
      fxTrail(fx, player, 1);
    } else if (t < 1.5) {
      player.visible = false; // 画面外で旋回中
    } else if (t < 2.6) {
      // 手前を大きく横切る(右→左)
      player.visible = true;
      const k2 = (t - 1.5) / 1.1;
      player.position.set(lerp(17, -14, k2), 4.5 - Math.sin(k2 * Math.PI) * 1.8, 2.2);
      player.rotation.set(Math.PI / 2, 0, Math.PI / 2); // -x方向へ
      flyPose(player, 1);
      fxTrail(fx, player, 1);
      screen.setSpeed(0.45 * Math.sin(k2 * Math.PI));
    } else if (t < 3.55) {
      // 旋回して中央上空でホバー → 着地
      player.visible = true;
      const k2 = seg(t, 2.6, 3.3, E.inOutQuad);
      const drop = seg(t, 3.3, 3.55, E.inQuad);
      player.position.set(
        lerp(-14, 0, k2),
        lerp(4.5, 2.6, k2) * (1 - drop) + 0 * drop,
        lerp(2.2, 0, k2)
      );
      player.rotation.x = lerp(Math.PI / 2, 0, k2);
      player.rotation.z = lerp(Math.PI / 2, 0, k2);
      flyPose(player, 1 - k2);
      if (drop > 0) crouchPose(player, drop * 0.5);
      fxTrail(fx, player, 1 - drop);
    } else {
      // 着地後
      player.position.set(0, 0, 0);
      player.rotation.set(0, 0, 0);
      const rise = seg(t, 3.55, 3.95, E.outQuad);
      crouchPose(player, 0.5 * (1 - rise));
      if (rise >= 1) heroPoses[1](player, t); // 拳を天に
      screen.setSpeed(0);
    }
  };
  return s;
}

function fxTrail(fx, player, k) {
  if (k <= 0 || Math.random() > 0.85) return;
  fx.burst({
    pos: { x: player.position.x, y: player.position.y + 0.6, z: player.position.z },
    count: 5, colors: ['#fff7d0', '#ffd98a', '#9fc4ff'], speed: 0.6 * k,
    gravity: 0.5, life: 0.55, size: 0.09 * k + 0.02,
  });
}

// =========================================================
// 9. 瞬間移動
// =========================================================
function blinkScene(ctx, member, player, color) {
  const s = shell(7.0, ctx);
  const { stage, fx, screen, sfx } = ctx;
  const ENDER = ['#c05fff', '#8a2be2', '#ff7af0', '#e0b0ff'];
  const HOPS = [
    { t: 0.25, pos: [-2.8, 0, -2], rotY: 0.5 },
    { t: 0.95, pos: [2.6, 0, -3], rotY: -0.4 },
    { t: 1.65, pos: [-1.6, 0, -0.6], rotY: 0.2 },
    { t: 2.4, pos: [0, 0, 1.7], rotY: 0 },   // 最後はドアップ
  ];
  let exit, hopIdx = -1;

  const poof = (pos) => {
    sfx.pop(true);
    fx.burst({
      pos: { x: pos[0], y: pos[1] + 1, z: pos[2] }, count: 36, colors: ENDER,
      speed: 2.6, gravity: -0.5, life: 0.65, size: 0.085, drag: 2.5,
    });
  };

  s.init = () => {
    stage.setEnv('voidpurple');
    player.visible = false;
    hopIdx = -1;
    for (let i = 0; i < HOPS.length; i++) {
      const h = HOPS[i];
      s.at(h.t, () => {
        if (hopIdx >= 0) {
          const prev = HOPS[hopIdx];
          poof(prev.pos); // 消える側にも残留パーティクル
        }
        hopIdx = i;
        player.position.set(h.pos[0], h.pos[1], h.pos[2]);
        player.rotation.y = h.rotY;
        player.visible = true;
        poof(h.pos);
        if (i === HOPS.length - 1) screen.flash('#c05fff', 0.18, 0.3);
      });
    }
    s.at(3.55, () => sfx.hit(380, 0.5));
    addTitleCues(s, member, color, 3.75, 4.35, 5.55);
    exit = makeExit(player, 5.75, ctx, { vx: 1.3, vy: 10.5, vz: 4.5 });
  };

  s.update = (t, dt) => {
    // カメラ: 最後の出現でドアップ → 引き
    const tight = seg(t, 2.4, 2.55, E.outCubic) - seg(t, 2.95, 3.5, E.inOutQuad);
    stage.cam(
      0, lerp(1.7, 1.5, tight), lerp(5.2, 3.4, tight),
      0, lerp(1.1, 1.45, tight), lerp(-1, 1.7, tight)
    );

    if (exit(t)) return;
    if (!player.visible) return;
    player.resetPose();

    if (t < 2.4) {
      // 各地点でミニポーズ
      if (hopIdx === 0) crouchPose(player, 0.4);
      else if (hopIdx === 1) {
        player.armR.shoulder.rotation.z = -1.4;
        player.armL.shoulder.rotation.z = 1.4;
      } else if (hopIdx === 2) heroPoses[5](player, t);
    } else if (t < 3.0) {
      // ドアップで仁王立ち
      idlePose(player, t);
      player.head.rotation.x = 0.12;
    } else {
      // 一歩下がってキメ
      const back = seg(t, 3.0, 3.55, E.inOutQuad);
      player.position.z = lerp(1.7, 0.4, back);
      if (back < 1) {
        runPose(player, t, { speed: 6, amp: 0.35, lean: -0.05 });
      } else {
        heroPoses[3](player, t); // 仁王立ち
      }
    }
  };
  return s;
}

// =========================================================
// 10. パンチフリーズ
// =========================================================
function freezeScene(ctx, member, player, color) {
  const s = shell(6.9, ctx);
  const { stage, fx, screen, sfx } = ctx;
  const T_JUMP = 1.15, T_FREEZE = 1.45, T_RESUME = 2.75, T_CUT = 3.05;
  let exit;
  const frozenPos = new THREE.Vector3();

  s.init = () => {
    stage.setEnv('street');
    stage.props.add(makeCityline({ z: -36 }));
    player.position.set(0, 0, -14);
    player.rotation.y = 0;
    s.at(T_JUMP, () => sfx.whoosh(0.4, 0.6));
    s.at(T_FREEZE, () => {
      sfx.boom();
      sfx.hit(200, 0.8);
      screen.impact(0.4);
      stage.shake(0.2);
    });
    s.at(T_RESUME, () => sfx.whoosh(0.4, 0.7));
    s.at(T_CUT, () => {
      sfx.thud(0.8);
      screen.flash('#ffffff', 0.16, 0.6);
      dust(fx, { x: 0, y: 0.1, z: 0 }, 30, 3);
    });
    addTitleCues(s, member, color, 3.35, 3.95, 5.35);
    exit = makeExit(player, 5.55, ctx, { vx: -1.3, vy: 10.5, vz: 5 });
  };

  s.update = (t, dt) => {
    if (exit(t)) {
      stage.cam(0, 1.5, 4.5, 0, 1.2, 0);
      return;
    }
    player.resetPose();

    if (t < T_JUMP) {
      // 突進
      player.position.z = lerp(-14, -1.6, seg(t, 0, T_JUMP, E.inQuad));
      player.position.y = 0;
      runPose(player, t, { speed: 13, amp: 1.05 });
      screen.setSpeed(seg(t, 0.2, T_JUMP, E.inQuad) * 0.8);
      stage.cam(0, 1.6, 5, 0, 1.2, lerp(-8, -1, seg(t, 0, T_JUMP, E.inQuad)));
    } else if (t < T_RESUME) {
      // ジャンプパンチ → 空中フリーズ
      const k = seg(t, T_JUMP, T_FREEZE, E.outQuad);
      if (t < T_FREEZE) {
        player.position.z = lerp(-1.6, 0.6, k);
        player.position.y = 1.25 * k;
        frozenPos.copy(player.position);
      } else {
        player.position.copy(frozenPos);
        screen.setSpeed(0.35);
      }
      // パンチポーズ
      player.armR.shoulder.rotation.x = -1.7;
      player.armR.elbow.rotation.x = -0.06;
      player.armL.shoulder.rotation.x = 0.8;
      player.armL.elbow.rotation.x = -1.5;
      player.spine.rotation.x = -0.1;
      player.spine.rotation.y = -0.35;
      player.head.rotation.y = 0.3;
      player.legR.hip.rotation.x = 0.5;
      player.legR.knee.rotation.x = 1.3;
      player.legL.hip.rotation.x = -1.2;
      player.legL.knee.rotation.x = 1.0;

      // バレットタイム: カメラが静止した拳の周りを回る
      const orb = seg(t, T_FREEZE, T_RESUME, E.inOutQuad);
      const ang = lerp(0, 1.0, orb);
      const r = 3.1;
      stage.cam(
        frozenPos.x + Math.sin(ang) * r, 1.45 + orb * 0.3, frozenPos.z + Math.cos(ang) * r,
        frozenPos.x, frozenPos.y + 1.05, frozenPos.z
      );
    } else if (t < T_CUT) {
      // 再生: カメラの上を飛び抜ける
      const k = seg(t, T_RESUME, T_CUT, E.inQuad);
      player.position.set(lerp(0.6, 0, k), lerp(1.25, 2.6, k), lerp(0.6, 6.5, k));
      tuckPose(player, k * 0.7);
      screen.setSpeed(0.6);
      stage.cam(Math.sin(1.0) * 3.1, 1.75, Math.cos(1.0) * 3.1 + 0.6, 0.3, 1.6, 2);
    } else {
      // カット: 中央に着地済み
      player.position.set(0, 0, 0);
      screen.setSpeed(0);
      const rise = seg(t, T_CUT, T_CUT + 0.35, E.outQuad);
      crouchPose(player, 0.6 * (1 - rise));
      if (rise >= 1) heroPoses[5](player, t); // ダブルナックル
      stage.cam(0, 1.5, 4.5, 0, 1.2, 0);
    }
  };
  return s;
}

// =========================================================
// 11. 地割れ登場
// =========================================================
function quakeScene(ctx, member, player, color) {
  const s = shell(6.3, ctx);
  const { stage, fx, screen, sfx } = ctx;
  const T_ERUPT = 1.25, T_LAND = 2.05;
  let exit, hole;

  s.init = () => {
    stage.setEnv('nightcity');
    stage.props.add(makeCityline({ z: -32 }));
    player.position.set(0, -2.8, 0); // 地中
    // 地面の穴
    hole = new THREE.Mesh(
      new THREE.CircleGeometry(0.95, 24),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0 })
    );
    hole.rotation.x = -Math.PI / 2;
    hole.position.y = 0.015;
    stage.props.add(hole);

    for (const tt of [0.2, 0.5, 0.8, 1.05]) {
      s.at(tt, () => { sfx.crack(); stage.shake(0.05 + tt * 0.1); });
    }
    s.at(T_ERUPT, () => {
      sfx.boom();
      stage.shake(0.32);
      hole.material.opacity = 0.85;
      screen.flash('#ffe0b0', 0.15, 0.4);
      fx.debris({ pos: { x: 0, y: 0.2, z: 0 }, count: 26, colors: [0x5e6168, 0x7a5236, 0x8a6042], size: 0.17, speed: 6.5, life: 1.7 });
      dust(fx, { x: 0, y: 0.3, z: 0 }, 50, 4.5);
      fx.ring({ pos: { x: 0, y: 0.05, z: 0 }, r1: 3.8, life: 0.6, color: 0xffc080 });
    });
    s.at(T_LAND, () => { sfx.thud(0.9); dust(fx, { x: 0, y: 0.1, z: 0.7 }, 22, 2.5); });
    addTitleCues(s, member, color, 2.7, 3.3, 4.75);
    exit = makeExit(player, 4.95, ctx, { vx: 1.3, vy: 10.5, vz: 5 });
  };

  s.update = (t, dt) => {
    const k = seg(t, T_ERUPT, 2.6, E.outCubic);
    stage.cam(lerp(0.2, 0.9, k), lerp(1.3, 1.6, k), lerp(5.8, 4.2, k), 0, 1.05, 0.4);

    if (exit(t)) return;
    player.resetPose();

    if (t < T_ERUPT) {
      player.position.set(0, -2.8, 0);
    } else if (t < T_LAND) {
      // 射出 → きりもみしながら放物線
      const k2 = (t - T_ERUPT) / (T_LAND - T_ERUPT);
      player.position.set(0, -2.8 + 18.8 * k2 - 16 * k2 * k2, k2 * 0.7);
      player.rotation.y = k2 * Math.PI * 2;
      tuckPose(player, 0.8);
    } else {
      player.position.set(0, 0, 0.7);
      player.rotation.y = 0;
      const rise = seg(t, 2.25, 2.6, E.outQuad);
      crouchPose(player, 0.85 * (1 - rise));
      if (rise >= 1) heroPoses[5](player, t); // ダブルナックル
    }
  };
  return s;
}

// =========================================================
// 12. 爆走ダイブ (背後を爆発が追いかけてくる)
// =========================================================
function bomberScene(ctx, member, player, color) {
  const s = shell(6.5, ctx);
  const { stage, fx, screen, sfx } = ctx;
  const T_DIVE = 1.6, T_LAND = 2.1;
  let exit;

  s.init = () => {
    stage.setEnv('street');
    stage.props.add(makeCityline({ z: -34 }));
    player.position.set(0, 0, -16);
    player.rotation.y = 0;

    for (const [tt, ox] of [[0.35, -1.4], [0.7, 1.6], [1.05, -1.0], [1.4, 1.2]]) {
      s.at(tt, () => {
        const z = player.position.z - 3;
        sfx.boom();
        stage.shake(0.16);
        screen.flash('#ffd9a0', 0.1, 0.22);
        fx.fireball({ pos: { x: ox, y: 0.5, z }, r: 2.0, life: 1.2 });
        fx.ring({ pos: { x: ox, y: 0.05, z }, r1: 3, life: 0.5, color: 0xffa050 });
        fx.debris({ pos: { x: ox, y: 0.3, z }, count: 8, colors: [0x3a3a44, 0x5a4a3a], size: 0.13, speed: 5, life: 1.2 });
      });
    }
    s.at(T_DIVE, () => sfx.whoosh(0.5, 0.6));
    s.at(T_LAND, () => {
      sfx.thud(0.9);
      dust(fx, { x: 0, y: 0.1, z: 0.4 }, 28, 3);
      fx.ring({ pos: { x: 0, y: 0.04, z: 0.4 }, r1: 2.4, life: 0.5, color: 0xbfd0ff });
    });
    s.at(2.55, () => sfx.hit(420, 0.5));
    addTitleCues(s, member, color, 2.85, 3.45, 4.9);
    exit = makeExit(player, 5.1, ctx, { vx: -1.2, vy: 10.5, vz: 5 });
  };

  s.update = (t, dt) => {
    stage.cam(0.5, 1.6, 4.8, 0, 1.05, lerp(-6, -0.3, seg(t, 0, T_DIVE, E.outQuad)));
    screen.setSpeed(t < T_DIVE ? 0.55 : Math.max(0, 0.55 - (t - T_DIVE) * 1.2));

    if (exit(t)) return;
    player.resetPose();

    if (t < T_DIVE) {
      player.position.z = lerp(-16, -2.2, t / T_DIVE);
      runPose(player, t, { speed: 13, amp: 1.05 });
      // 後ろをチラ見
      if (t > 0.5 && t < 0.85) player.head.rotation.y = 0.8;
    } else if (t < T_LAND) {
      // 前転ダイブ
      const k = (t - T_DIVE) / (T_LAND - T_DIVE);
      player.position.z = lerp(-2.2, 0.4, k);
      player.position.y = Math.sin(k * Math.PI) * 1.1;
      player.rotation.x = Math.PI * 2 * k;
      tuckPose(player, Math.sin(k * Math.PI));
    } else {
      player.position.set(0, 0, 0.4);
      player.rotation.x = 0;
      const rise = seg(t, 2.25, 2.55, E.outQuad);
      crouchPose(player, 0.8 * (1 - rise));
      if (rise >= 1) heroPoses[2](player, t); // 指差し
    }
  };
  return s;
}

// =========================================================
// 13. ビームダウン (転送ビームで降下)
// =========================================================
function beamScene(ctx, member, player, color) {
  const s = shell(6.6, ctx);
  const { stage, fx, screen, sfx } = ctx;
  const T_LAND = 2.2, T_OFF = 2.7;
  let exit, beam;

  s.init = () => {
    stage.setEnv('voidpurple');
    beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.75, 1.0, 13, 20, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0x7fe0ff, transparent: true, opacity: 0, side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending, depthWrite: false,
      })
    );
    beam.material.toneMapped = false;
    beam.position.y = 6.5;
    stage.props.add(beam);

    s.at(0.2, () => sfx.riser(1.9));
    s.at(T_LAND, () => {
      sfx.thud(0.45);
      fx.ring({ pos: { x: 0, y: 0.04, z: 0 }, r1: 2.6, life: 0.6, color: 0x7fe0ff });
    });
    s.at(T_OFF, () => {
      sfx.zap();
      screen.flash('#bff0ff', 0.2, 0.5);
    });
    s.at(2.9, () => sfx.hit(500, 0.45));
    addTitleCues(s, member, color, 3.1, 3.7, 5.15);
    exit = makeExit(player, 5.35, ctx, { vx: 1.3, vy: 10.5, vz: 5 });
  };

  let acc = 0;
  s.update = (t, dt) => {
    const k = seg(t, 0.4, T_LAND, E.inOutQuad);
    stage.cam(2.0, lerp(2.6, 1.7, k), 4.8, 0, lerp(3.6, 1.1, k), 0);

    // ビームの明滅と消滅
    const on = seg(t, 0.2, 0.55, E.outQuad);
    const off = seg(t, T_OFF, T_OFF + 0.25, E.inQuad);
    beam.material.opacity = (0.22 + Math.sin(t * 22) * 0.06) * on * (1 - off);
    beam.scale.x = beam.scale.z = Math.max(0.001, 1 - off);

    // ビーム内の上昇パーティクル
    acc += dt;
    if (acc > 0.09 && t > 0.3 && t < T_OFF) {
      acc = 0;
      const a = Math.random() * Math.PI * 2;
      fx.burst({
        pos: { x: Math.cos(a) * 0.6, y: 0.3, z: Math.sin(a) * 0.6 },
        count: 4, colors: ['#aff0ff', '#7fe0ff', '#ffffff'], speed: 1,
        dir: { x: 0, y: 2.2, z: 0 }, gravity: 2, life: 0.8, size: 0.07, spread: 0.25,
      });
    }

    if (exit(t)) return;
    player.resetPose();

    if (t < T_LAND) {
      // 回転しながら降下
      const kd = seg(t, 0.5, T_LAND, E.inOutQuad);
      player.position.set(0, lerp(9, 0, kd), 0);
      player.rotation.y = (1 - E.outQuad(kd)) * Math.PI * 3;
      player.armR.shoulder.rotation.z = -0.85;
      player.armL.shoulder.rotation.z = 0.85;
      player.head.rotation.x = 0.25;
    } else {
      player.position.set(0, 0, 0);
      player.rotation.y = 0;
      const rise = seg(t, T_LAND, 2.9, E.outQuad);
      crouchPose(player, 0.35 * (1 - rise));
      if (rise >= 1) heroPoses[3](player, t); // 仁王立ち
    }
  };
  return s;
}

// =========================================================
// 14. 漢のスローウォーク (ドアップ → 引きでキメ)
// =========================================================
function slowwalkScene(ctx, member, player, color) {
  const s = shell(7.2, ctx);
  const { stage, fx, screen, sfx } = ctx;
  const T_STOP = 3.2, T_POSE = 4.35;
  let exit;

  s.init = () => {
    stage.setEnv('nightcity');
    stage.props.add(makeCityline({ z: -30 }));
    player.position.set(0, 0, -5);
    player.rotation.y = 0;
    s.at(T_POSE, () => {
      sfx.hit(300, 0.55);
      sfx.whoosh(0.35, 0.4);
      screen.flash('#ffffff', 0.1, 0.2);
    });
    addTitleCues(s, member, color, 3.7, 4.5, 5.75);
    exit = makeExit(player, 5.95, ctx, { vx: 1.3, vy: 10.5, vz: 5 });
  };

  let acc = 0;
  s.update = (t, dt) => {
    // 明滅するリムライト
    stage.rim.intensity = 1.7 + Math.sin(t * 2.1) * 0.5;

    // カメラ: ドアップ固定 → キメで引き
    const pull = seg(t, T_POSE - 0.05, T_POSE + 0.4, E.outCubic);
    stage.cam(
      lerp(0.42, 0, pull), lerp(1.42, 1.6, pull), lerp(3.45, 4.7, pull),
      0, lerp(1.42, 1.1, pull), lerp(1.6, 0.8, pull)
    );

    // 横切る風塵
    acc += dt;
    if (acc > 0.3) {
      acc = 0;
      fx.burst({
        pos: { x: 3, y: 0.4 + Math.random() * 1.4, z: Math.random() * 2 },
        count: 3, colors: ['#8fa0c0'], speed: 3, dir: { x: -1, y: 0.05, z: 0 },
        gravity: 0, life: 1.1, size: 0.05, spread: 0.1, additive: false,
      });
    }

    if (exit(t)) return;
    player.resetPose();

    if (t < T_STOP) {
      player.position.z = lerp(-5, 1.4, t / T_STOP);
      runPose(player, t, { speed: 4.2, amp: 0.5, lean: 0.08 });
      player.head.rotation.x = 0.22; // うつむき気味
    } else if (t < T_POSE) {
      player.position.z = 1.4;
      idlePose(player, t);
      // 顔を上げてカメラを見る
      player.head.rotation.x = lerp(0.25, -0.06, seg(t, 3.4, 3.8, E.outQuad));
    } else {
      player.position.z = 1.4;
      heroPoses[0](player, t); // 腕組み
    }
  };
  return s;
}

// =========================================================
// 15. 雷鳴降臨
// =========================================================
function thunderScene(ctx, member, player, color) {
  const s = shell(6.6, ctx);
  const { stage, fx, screen, sfx } = ctx;
  const T_STRIKE = 0.95;
  let exit;

  s.init = () => {
    stage.setEnv('dark');
    stage.props.add(makeCityline({ z: -34 }));
    player.visible = false;
    s.at(0.1, () => sfx.boom()); // 遠雷
    s.at(T_STRIKE, () => {
      sfx.zap();
      sfx.boom();
      screen.flash('#ffffff', 0.3, 1.0);
      stage.shake(0.27);
      stage.key.intensity = 1.3;
      stage.hemi.intensity = 0.3;
      fx.bolt({ x: 0, z: 0 });
      player.visible = true;
      dust(fx, { x: 0, y: 0.15, z: 0 }, 36, 3.5);
      fx.ring({ pos: { x: 0, y: 0.04, z: 0 }, r1: 3.4, life: 0.6, color: new THREE.Color(color).getHex() });
    });
    s.at(1.5, () => {
      fx.bolt({ x: 4, z: -5, h: 11 });
      screen.flash('#cfe0ff', 0.12, 0.3);
    });
    s.at(2.65, () => { sfx.hit(500, 0.5); screen.flash('#ffffff', 0.1, 0.25); });
    addTitleCues(s, member, color, 2.9, 3.5, 4.95);
    exit = makeExit(player, 5.15, ctx, { vx: -1.3, vy: 10.5, vz: 5 });
  };

  s.update = (t, dt) => {
    const punch = seg(t, T_STRIKE, T_STRIKE + 0.3, E.outCubic);
    stage.fov = 52 - 5 * punch;
    stage.cam(0.6, 1.0, 4.7, 0, 1.15, 0);

    if (exit(t)) return;
    if (!player.visible) return;
    player.resetPose();

    if (t < 1.9) {
      heroLandPose(player, 1); // 落雷とともに片膝着地
    } else if (t < 2.65) {
      heroLandPose(player, 1 - seg(t, 1.9, 2.65, E.inOutQuad));
    } else {
      heroPoses[1](player, t); // 拳を天に
    }
  };
  return s;
}

// =========================================================
// 16. トロッコ参上
// =========================================================
function minecartScene(ctx, member, player, color) {
  const s = shell(6.7, ctx);
  const { stage, fx, screen, sfx } = ctx;
  const T_STOP = 1.6, T_JUMP = 1.8, T_LAND = 2.35;
  let exit, cart;

  s.init = () => {
    stage.setEnv('cave');
    stage.props.add(makeRails(28));
    cart = makeMinecart();
    cart.position.set(-13, 0, 0);
    stage.props.add(cart);

    sfx.whoosh(1.4, 0.45);
    s.at(T_STOP, () => { sfx.crack(); stage.shake(0.13); });
    s.at(T_JUMP, () => sfx.whoosh(0.4, 0.5));
    s.at(T_LAND, () => {
      sfx.thud(0.85);
      dust(fx, { x: 0.3, y: 0.1, z: 1.6 }, 24, 2.6);
      fx.ring({ pos: { x: 0.3, y: 0.04, z: 1.6 }, r1: 2.2, life: 0.5, color: 0xffc080 });
    });
    s.at(2.7, () => sfx.hit(380, 0.5));
    addTitleCues(s, member, color, 3.0, 3.6, 5.05);
    exit = makeExit(player, 5.25, ctx, { vx: -1.2, vy: 10.5, vz: 4.5 });
  };

  let acc = 0;
  s.update = (t, dt) => {
    const k = seg(t, 1.4, 2.6, E.inOutQuad);
    stage.cam(0.5, 1.7, 5.0, lerp(-3.5, 0.3, k), 0.95, lerp(0, 1.2, k));

    // カート滑走 + 火花
    const cartX = lerp(-13, 0, seg(t, 0, T_STOP, E.outCubic));
    cart.position.x = cartX;
    acc += dt;
    if (t < T_STOP && acc > 0.07) {
      acc = 0;
      fx.burst({
        pos: { x: cartX - 0.45, y: 0.12, z: (Math.random() < 0.5 ? -0.22 : 0.22) },
        count: 5, colors: ['#ffd98a', '#ff9a2a', '#fff2c0'], speed: 2,
        dir: { x: -1, y: 0.5, z: 0 }, gravity: -5, life: 0.45, size: 0.06,
      });
    }

    if (exit(t)) return;
    player.resetPose();

    if (t < T_JUMP) {
      // カートに乗っている
      player.position.set(cartX, 0.16, 0);
      crouchPose(player, 0.75);
      player.armR.shoulder.rotation.x = -0.85;
      player.armL.shoulder.rotation.x = -0.85;
      player.armR.elbow.rotation.x = -0.5;
      player.armL.elbow.rotation.x = -0.5;
      if (t > T_STOP) player.spine.rotation.x = 0.8; // 急停止で前のめり
      player.rotation.y = Math.PI / 2; // 進行方向(+x)を向く
    } else if (t < T_LAND) {
      // 前宙で飛び出す
      const k2 = (t - T_JUMP) / (T_LAND - T_JUMP);
      player.rotation.y = lerp(Math.PI / 2, 0, Math.min(1, k2 * 2.5));
      player.position.set(lerp(0, 0.3, k2), Math.sin(k2 * Math.PI) * 1.7 + 0.16 * (1 - k2), lerp(0, 1.6, k2));
      player.rotation.x = Math.PI * 2 * k2;
      tuckPose(player, Math.sin(k2 * Math.PI));
    } else {
      player.rotation.set(0, 0, 0);
      player.position.set(0.3, 0, 1.6);
      const rise = seg(t, 2.45, 2.7, E.outQuad);
      crouchPose(player, 0.8 * (1 - rise));
      if (rise >= 1) heroPoses[7](player, t); // Vサイン
    }
  };
  return s;
}

// =========================================================
// 17. 影分身 (分身が合体して本体に)
// =========================================================
function clonesScene(ctx, member, player, color) {
  const s = shell(6.3, ctx);
  const { stage, fx, screen, sfx } = ctx;
  
  const T_MERGE = 1.5;
  let exit, c1, c2;

  s.init = () => {
    stage.setEnv('voidpurple');
    const skin = { canvas: player.tex.image, slim: player.slim };
    c1 = new PlayerModel(skin);
    c2 = new PlayerModel(skin);
    for (const c of [c1, c2]) {
      c.matBase.color.setRGB(0.3, 0.24, 0.58);
      c.matOverlay.color.setRGB(0.3, 0.24, 0.58);
      stage.props.add(c);
    }
    c1.rotation.y = Math.atan2(7, 1);
    c2.rotation.y = Math.atan2(-7, 1);
    player.position.set(0, 0, -7);
    player.rotation.y = 0;
    sfx.whoosh(0.8, 0.4);

    s.at(T_MERGE, () => {
      sfx.pop(true);
      sfx.hit(500, 0.5);
      screen.flash('#c05fff', 0.15, 0.3);
      for (const c of [c1, c2]) {
        c.visible = false;
        fx.burst({
          pos: { x: c.position.x, y: 1, z: c.position.z }, count: 30, colors: ENDER,
          speed: 2.6, gravity: -0.5, life: 0.65, size: 0.085, drag: 2.5,
        });
      }
    });
    s.at(1.78, () => sfx.hit(380, 0.5));
    addTitleCues(s, member, color, 2.6, 3.2, 4.7);
    exit = makeExit(player, 4.9, ctx, { vx: 1.3, vy: 10.5, vz: 4.5 });
  };

  s.update = (t, dt) => {
    stage.cam(0, 1.65, 4.9, 0, 1.05, -0.4);

    if (exit(t)) return;

    if (t < T_MERGE) {
      const k = t / T_MERGE;
      player.resetPose();
      runPose(player, t, { speed: 12 });
      player.position.set(0, 0, lerp(-7, 0, k));
      c1.position.set(lerp(-7, 0, k), 0, lerp(-1, 0, k));
      c1.resetPose();
      runPose(c1, t + 0.33, { speed: 12 });
      c2.position.set(lerp(7, 0, k), 0, lerp(-1, 0, k));
      c2.resetPose();
      runPose(c2, t + 0.61, { speed: 12 });
    } else {
      player.position.set(0, 0, 0);
      player.resetPose();
      const rise = seg(t, T_MERGE, 1.78, E.outQuad);
      crouchPose(player, 0.5 * (1 - rise));
      if (rise >= 1) heroPoses[6](player, t); // カラテ構え
    }
  };
  return s;
}

// =========================================================
// 18. ブレイクスピン (ウィンドミル → キックアップ)
// =========================================================
function breakspinScene(ctx, member, player, color) {
  const s = shell(6.5, ctx);
  const { stage, fx, screen, sfx } = ctx;
  const T_KIP = 2.0, T_UP = 2.45;
  let exit, endYaw = null;

  s.init = () => {
    stage.setEnv('street');
    stage.props.add(makeCityline({ z: -32 }));
    player.rotation.order = 'YXZ';
    player.position.set(0, 0, 0);
    endYaw = null;
    for (const tt of [0.15, 0.75, 1.35]) s.at(tt, () => sfx.whoosh(0.5, 0.42));
    s.at(T_UP, () => {
      sfx.thud(0.6);
      dust(fx, { x: 0, y: 0.1, z: 0 }, 22, 2.5);
    });
    s.at(2.6, () => sfx.hit(440, 0.5));
    addTitleCues(s, member, color, 2.9, 3.5, 4.95);
    exit = makeExit(player, 5.15, ctx, { vx: 1.4, vy: 10.5, vz: 5 });
  };

  let acc = 0;
  s.update = (t, dt) => {
    stage.cam(Math.sin(t * 0.3) * 1.2, 1.45, 4.5, 0, 0.85, 0);

    if (exit(t)) return;
    player.resetPose();

    if (t < T_KIP) {
      // ウィンドミル: 仰向けで脚を開いて高速回転
      player.rotation.y += (19 * (1 - t / T_KIP) + 4) * dt;
      player.rotation.x = -1.35;
      player.position.y = 0.38;
      player.legR.hip.rotation.z = -1.3;
      player.legL.hip.rotation.z = 1.3;
      player.legR.knee.rotation.x = 0.25;
      player.legL.knee.rotation.x = 0.25;
      player.armR.shoulder.rotation.z = -1.45;
      player.armL.shoulder.rotation.z = 1.45;
      player.head.rotation.x = -0.5;
      screen.setSpeed(0.3 * (1 - t / T_KIP));

      acc += dt;
      if (acc > 0.1) {
        acc = 0;
        dust(fx, { x: randSpreadX(), y: 0.08, z: randSpreadX() }, 6, 1.8);
      }
    } else if (t < T_UP) {
      // キックアップで立ち上がる
      if (endYaw === null) {
        endYaw = ((player.rotation.y % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2) - Math.PI;
      }
      const k = seg(t, T_KIP, T_UP, E.outQuad);
      player.rotation.y = endYaw * (1 - k);
      player.rotation.x = -1.35 * (1 - k);
      player.position.y = 0.38 * (1 - k) + Math.sin(k * Math.PI) * 0.5;
      tuckPose(player, (1 - k) * 0.6);
      screen.setSpeed(0);
    } else {
      player.rotation.x = 0;
      player.rotation.y = 0;
      player.position.y = 0;
      const rise = seg(t, T_UP, 2.6, E.outQuad);
      crouchPose(player, 0.5 * (1 - rise));
      if (rise >= 1) heroPoses[7](player, t); // Vサイン
    }
  };
  return s;
}

function randSpreadX() { return (Math.random() - 0.5) * 1.2; }

// =========================================================



// ============================================================
// [scenes2.js より統合]
// ============================================================

// 個人紹介演出 第2弾 x18 (Mob活用・ギャグ混じり)



// 正座で食べるポーズ(もぐもぐ用)
function sitEatPose(p, t, chew = true) {
  p.resetPose();
  p.hips.position.y = 12 / 16 - 0.5;
  p.legR.hip.rotation.x = -1.55;
  p.legL.hip.rotation.x = -1.55;
  p.legR.knee.rotation.x = 2.5;
  p.legL.knee.rotation.x = 2.5;
  p.spine.rotation.x = 0.08;
  if (chew) {
    p.armR.shoulder.rotation.x = -1.95 + Math.sin(t * 9) * 0.3;
    p.armR.elbow.rotation.x = -1.5;
    p.armL.shoulder.rotation.x = -0.6;
    p.armL.elbow.rotation.x = -1.0;
    p.head.rotation.x = 0.12 + Math.sin(t * 9 + 1.2) * 0.06;
  }
}

// =========================================================
// 19. クリーパー大爆走
// =========================================================
function creeperScene(ctx, member, player, color) {
  const s = shell(6.9, ctx);
  const { stage, fx, screen, sfx } = ctx;
  const T_STOP = 1.5, T_BOOM = 2.3;
  let exit, creeper;

  s.init = () => {
    stage.setEnv('day');
    stage.props.add(makeClouds());
    creeper = makeCreeper();
    creeper.position.set(0, 0, -9.4);
    stage.props.add(creeper);
    player.position.set(0, 0, -7);
    player.rotation.y = 0;
    screen.setSpeed(0.4);
    s.at(1.7, () => sfx.fuse(0.7));
    s.at(1.8, () => creeper.flash(true));
    s.at(1.95, () => creeper.flash(false));
    s.at(2.1, () => creeper.flash(true));
    s.at(T_BOOM, () => {
      sfx.boom();
      stage.shake(0.3);
      screen.flash('#fff2d0', 0.2, 0.7);
      creeper.visible = false;
      fx.fireball({ pos: { x: 0, y: 0.5, z: -2.4 }, r: 2.2, life: 1.4 });
      fx.debris({ pos: { x: 0, y: 0.3, z: -2.4 }, count: 16, colors: [0x4a9c38, 0x79553a, 0x5fa845], size: 0.15, speed: 6, life: 1.6 });
      fx.ring({ pos: { x: 0, y: 0.04, z: -2.4 }, r1: 3.5, life: 0.6, color: 0xffc080 });
    });
    s.at(2.55, () => { sfx.thud(0.8); dust(fx, { x: 0, y: 0.1, z: 1.3 }, 24, 2.6); });
    addTitleCues(s, member, color, 3.2, 3.8, 5.25);
    exit = makeExit(player, 5.45, ctx, { vx: 1.3, vy: 10.5, vz: 5 });
  };

  s.update = (t, dt) => {
    stage.cam(0.7, 1.6, 4.6, 0, 1.0, lerp(-3, 0, seg(t, 0, T_STOP, E.outQuad)));
    if (t > T_STOP) screen.setSpeed(Math.max(0, 0.4 - (t - T_STOP)));

    // クリーパーが追いかけてくる
    if (creeper.visible && t < T_BOOM) {
      creeper.position.z = lerp(-9.4, -2.4, seg(t, 0, 1.9, E.outQuad));
      mobWalk(creeper, t, 11, 0.5);
    }

    if (exit(t)) return;
    player.resetPose();

    if (t < T_STOP) {
      // 必死に逃げる
      player.position.z = lerp(-7, 0, t / T_STOP);
      runPose(player, t, { speed: 13.5, amp: 1.1 });
    } else if (t < T_BOOM) {
      // 振り向いて気づく
      player.position.z = 0;
      idlePose(player, t);
      player.rotation.y = Math.PI * seg(t, T_STOP, T_STOP + 0.25, E.outQuad);
      player.head.rotation.x = -0.1;
    } else if (t < 2.55) {
      // 爆風で前方へ飛ぶ
      const k = seg(t, T_BOOM, 2.55, E.outQuad);
      player.rotation.y = Math.PI * (1 - k); // 着地でカメラ向きに戻る
      player.position.set(0, Math.sin(k * Math.PI) * 0.9, k * 1.3);
      tuckPose(player, 0.7);
    } else {
      player.position.set(0, 0, 1.3);
      player.rotation.y = 0;
      const rise = seg(t, 2.7, 3.0, E.outQuad);
      crouchPose(player, 0.8 * (1 - rise));
      if (rise >= 1) heroPoses[5](player, t);
    }
  };
  return s;
}

// =========================================================
// 20. ピッグライド
// =========================================================
function pigrideScene(ctx, member, player, color) {
  const s = shell(6.6, ctx);
  const { stage, fx, screen, sfx } = ctx;
  const T_BRAKE = 1.8, T_LAND = 2.3;
  let exit, pig;

  s.init = () => {
    stage.setEnv('day');
    stage.props.add(makeClouds());
    pig = makePig();
    stage.props.add(pig);
    s.at(T_BRAKE, () => {
      sfx.crack();
      dust(fx, { x: 0, y: 0.1, z: -1.2 }, 26, 3);
      sfx.whoosh(0.4, 0.5);
    });
    s.at(T_LAND, () => { sfx.thud(0.8); dust(fx, { x: 0, y: 0.1, z: 1.4 }, 22, 2.5); });
    s.at(2.75, () => sfx.hit(400, 0.5));
    addTitleCues(s, member, color, 3.0, 3.6, 5.05);
    exit = makeExit(player, 5.25, ctx, { vx: -1.3, vy: 10.5, vz: 4.5 });
  };

  s.update = (t, dt) => {
    stage.cam(1.4, 1.6, 4.8, 0, 0.95, 0);

    // ブタ疾走 → 急ブレーキ → その場で鼻息
    const gallop = seg(t, 0, T_BRAKE, E.outQuad);
    if (t < T_BRAKE) {
      pig.position.set(lerp(-10, 0, gallop), Math.abs(Math.sin(t * 11)) * 0.12, -1.2);
      pig.rotation.y = Math.PI / 2;
      mobWalk(pig, t, 13, 0.8);
    } else {
      pig.position.set(0, 0, -1.2);
      pig.rotation.y = Math.PI / 2 - seg(t, T_BRAKE, 2.6, E.outQuad) * 0.8;
      pig.head.rotation.x = Math.sin(t * 3) * 0.08;
      pig.legs.forEach(l => l.rotation.x = 0);
    }

    if (exit(t)) return;
    player.resetPose();

    if (t < T_BRAKE) {
      // 騎乗(またがり)
      player.position.set(pig.position.x, pig.position.y + 0.62, -1.2);
      player.rotation.y = Math.PI / 2;
      player.hips.position.y = 12 / 16 - 0.28;
      player.legR.hip.rotation.x = -0.8; player.legR.hip.rotation.z = -0.6;
      player.legL.hip.rotation.x = -0.8; player.legL.hip.rotation.z = 0.6;
      player.legR.knee.rotation.x = 1.2; player.legL.knee.rotation.x = 1.2;
      player.armR.shoulder.rotation.x = -2.8; // 片手を振り上げてカウボーイ
      player.armL.shoulder.rotation.x = -0.9;
      player.armL.elbow.rotation.x = -0.8;
      player.spine.rotation.x = -0.1;
    } else if (t < T_LAND) {
      // 前方へすっ飛ぶ
      const k = seg(t, T_BRAKE, T_LAND, E.linear);
      player.rotation.y = lerp(Math.PI / 2, 0, k);
      player.position.set(lerp(0, 0.2, k), Math.sin(k * Math.PI) * 1.3 + 0.6 * (1 - k), lerp(-1.2, 1.4, k));
      player.rotation.x = Math.PI * 2 * k;
      tuckPose(player, Math.sin(k * Math.PI));
    } else {
      player.rotation.x = 0;
      player.rotation.y = 0;
      player.position.set(0.2, 0, 1.4);
      const rise = seg(t, 2.45, 2.75, E.outQuad);
      crouchPose(player, 0.8 * (1 - rise));
      if (rise >= 1) heroPoses[7](player, t);
    }
  };
  return s;
}

// =========================================================
// 21. ニワトリの雨
// =========================================================
function chickensScene(ctx, member, player, color) {
  const s = shell(6.7, ctx);
  const { stage, fx, screen, sfx } = ctx;
  let exit;
  const chicks = [];
  const DROPS = [
    { t0: 0.2, x: -2.2, z: -1.5 }, { t0: 0.55, x: 1.8, z: -2.2 }, { t0: 0.9, x: -1.2, z: 0.8 },
    { t0: 1.25, x: 2.4, z: 0.4 }, { t0: 1.6, x: -2.6, z: 1.6 },
  ];

  s.init = () => {
    stage.setEnv('day');
    stage.props.add(makeClouds());
    for (const d of DROPS) {
      const c = makeChicken();
      c.visible = false;
      c.rotation.y = rand(Math.PI * 2);
      stage.props.add(c);
      chicks.push({ mob: c, ...d, landed: false });
    }
    // 頭に乗る一羽
    const rider = makeChicken();
    rider.visible = false;
    stage.props.add(rider);
    s.riderMob = rider;
    player.position.set(0, 0, -6);
    player.rotation.y = 0;
    s.at(2.4, () => {
      rider.visible = true;
      sfx.pop(false);
    });
    s.at(2.6, () => sfx.hit(500, 0.35));
    addTitleCues(s, member, color, 3.0, 3.6, 5.05);
    s.at(5.25, () => {
      // 退場前にニワトリが飛び立つ
      rider.visible = false;
      sfx.pop(true);
      fx.burst({ pos: { x: 0, y: 2.1, z: 0 }, count: 14, colors: ['#f2f2ec', '#e8e0c8'], speed: 1.6, gravity: -1, life: 0.6, size: 0.07, additive: false });
    });
    exit = makeExit(player, 5.25, ctx, { vx: 1.3, vy: 10.5, vz: 5 });
  };

  s.update = (t, dt) => {
    stage.cam(0.5, 1.7, 4.9, 0, 1.1, 0);

    // ニワトリたちがゆっくり降ってくる(羽ばたき落下)
    for (const c of chicks) {
      const k = (t - c.t0) / 1.2;
      if (k < 0) continue;
      c.mob.visible = true;
      if (k < 1) {
        c.mob.position.set(c.x, lerp(7, 0, k), c.z);
        c.mob.flap(t, 1);
      } else {
        if (!c.landed) {
          c.landed = true;
          dust(fx, { x: c.x, y: 0.05, z: c.z }, 6, 1.2);
        }
        c.mob.position.set(c.x + Math.sin(t * 0.7 + c.x) * 0.2, 0, c.z);
        c.mob.flap(t, 0);
        mobWalk(c.mob, t, 7, 0.4);
        c.mob.head.rotation.x = Math.sin(t * 5 + c.z) * 0.25; // ついばみ
      }
    }

    const exiting = exit(t);

    if (!exiting) {
      player.resetPose();
      if (t < 2.2) {
        // 我関せず堂々と歩いてくる
        player.position.z = lerp(-6, 0.6, seg(t, 0, 2.2, E.linear));
        runPose(player, t, { speed: 5, amp: 0.45, lean: 0.06 });
      } else {
        player.position.z = 0.6;
        if (t < 2.6) idlePose(player, t);
        else heroPoses[3](player, t); // 仁王立ち(頭に乗られても動じない)
      }
    }

    // 頭上のニワトリ追従
    if (s.riderMob && s.riderMob.visible) {
      s.riderMob.position.set(player.position.x, player.position.y + 2.02, player.position.z);
      s.riderMob.rotation.y = 0.4;
      mobWalk(s.riderMob, 0, 0, 0);
    }
  };
  return s;
}

// =========================================================
// 22. ゾンビ無双
// =========================================================
function zombiesScene(ctx, member, player, color) {
  const s = shell(6.5, ctx);
  const { stage, fx, screen, sfx } = ctx;
  const T_SPIN = 1.8, T_HIT = 2.1;
  let exit;
  const zombies = [];
  const SPOTS = [[-2.6, -1.4], [2.6, -1.8], [-2.0, 1.6], [2.2, 1.4]];

  s.init = () => {
    stage.setEnv('nightcity');
    const skin = makeZombieSkin();
    for (const [x, z] of SPOTS) {
      const z2 = new PlayerModel(skin);
      z2.position.set(x * 2.2, 0, z * 2.2);
      z2.rotation.y = Math.atan2(-x, -z);
      stage.props.add(z2);
      zombies.push({ mob: z2, sx: x, sz: z, flying: false, vx: 0, vz: 0, rot: 0 });
    }
    player.position.set(0, 0, 0);
    player.rotation.y = 0;
    s.at(T_SPIN, () => sfx.whoosh(0.5, 0.6));
    s.at(T_HIT, () => {
      sfx.boom();
      sfx.hit(220, 0.7);
      stage.shake(0.2);
      screen.flash('#ffffff', 0.12, 0.4);
      fx.ring({ pos: { x: 0, y: 0.05, z: 0 }, r1: 4, life: 0.5, color: new THREE.Color(color).getHex() });
      zombies.forEach(zb => {
        zb.flying = true;
        zb.vx = zb.sx * 4.2;
        zb.vz = zb.sz * 4.2;
      });
    });
    s.at(2.5, () => sfx.hit(420, 0.5));
    addTitleCues(s, member, color, 2.8, 3.4, 4.85);
    exit = makeExit(player, 5.05, ctx, { vx: 1.3, vy: 10.5, vz: 5 });
  };

  s.update = (t, dt) => {
    stage.cam(Math.sin(t * 0.3), 1.8, 5.0, 0, 1.05, 0);

    zombies.forEach((zb, i) => {
      const m = zb.mob;
      if (!zb.flying) {
        // にじり寄るゾンビ(両腕前)
        const k = seg(t, 0.1 + i * 0.12, T_HIT, E.linear);
        m.position.set(lerp(zb.sx * 2.2, zb.sx, k), 0, lerp(zb.sz * 2.2, zb.sz, k));
        m.resetPose();
        runPose(m, t * 0.55 + i, { speed: 7, amp: 0.4, lean: 0.12 });
        m.armR.shoulder.rotation.x = -1.5;
        m.armL.shoulder.rotation.x = -1.5;
        m.armR.elbow.rotation.x = -0.1;
        m.armL.elbow.rotation.x = -0.1;
        m.head.rotation.x = 0.15;
      } else {
        // 吹っ飛び中
        const tt = t - T_HIT;
        if (tt < 0.8) {
          m.position.x = zb.sx + zb.vx * tt;
          m.position.z = zb.sz + zb.vz * tt;
          m.position.y = Math.max(0.32, 2.6 * tt - 4.2 * tt * tt);
          m.rotation.x = -Math.PI / 2 * Math.min(1, tt * 2.4);
          m.resetPose();
        } else {
          m.position.y = 0.32; // 仰向けに転がったまま
        }
      }
    });

    if (exit(t)) return;
    player.resetPose();

    if (t < T_SPIN) {
      idlePose(player, t);
      // 周りを見回す
      player.head.rotation.y = Math.sin(t * 2.4) * 0.7;
    } else if (t < 2.5) {
      // 回転アタック
      const k = seg(t, T_SPIN, 2.5, E.outQuad);
      player.rotation.y = k * Math.PI * 4;
      crouchPose(player, 0.25);
      player.armR.shoulder.rotation.z = -1.5;
      player.armL.shoulder.rotation.z = 1.5;
    } else {
      player.rotation.y = 0;
      heroPoses[6](player, t);
    }
  };
  return s;
}

// =========================================================
// 23. エンダー睨み合い
// =========================================================
function endermanScene(ctx, member, player, color) {
  const s = shell(7.0, ctx);
  const { stage, fx, screen, sfx } = ctx;
  let exit, ender;

  s.init = () => {
    stage.setEnv('voidpurple');
    ender = makeEnderman();
    ender.visible = false;
    ender.position.set(0.9, 0, -1.6);
    ender.rotation.y = 0.4;
    stage.props.add(ender);
    player.position.set(-0.9, 0, 0.4);
    player.rotation.y = Math.PI; // 最初は奥を向いている

    s.at(0.6, () => {
      ender.visible = true;
      sfx.pop(true);
      fx.burst({ pos: { x: 0.9, y: 1.6, z: -1.6 }, count: 30, colors: ENDER, speed: 2.4, gravity: -0.5, life: 0.7, size: 0.08, drag: 2.5 });
    });
    s.at(1.2, () => sfx.hit(180, 0.4));
    s.at(2.6, () => {
      // エンダーマンが怖気づいてテレポート逃げ
      ender.visible = false;
      sfx.pop(false);
      fx.burst({ pos: { x: 0.9, y: 1.6, z: -1.6 }, count: 34, colors: ENDER, speed: 2.8, gravity: -0.5, life: 0.7, size: 0.085, drag: 2.5 });
    });
    s.at(3.0, () => sfx.hit(440, 0.5));
    addTitleCues(s, member, color, 3.3, 3.9, 5.35);
    exit = makeExit(player, 5.55, ctx, { vx: 1.3, vy: 10.5, vz: 4.5 });
  };

  s.update = (t, dt) => {
    // にらみ合いはサイド寄りのクローズ
    const k = seg(t, 1.0, 1.6, E.inOutQuad);
    const back = seg(t, 2.8, 3.4, E.inOutQuad);
    stage.cam(
      lerp(0, 2.6, k) - back * 1.6, lerp(1.7, 1.5, k) + back * 0.2, lerp(5.2, 1.8, k) + back * 2.8,
      lerp(0, -0.1, k), 1.45, lerp(0, -0.6, k)
    );

    // エンダーマン挙動
    if (ender.visible) {
      ender.head.rotation.y = Math.sin(t * 1.5) * 0.08 - 0.35;
      if (t > 2.2) {
        // ぷるぷる震える
        ender.position.x = 0.9 + (Math.random() - 0.5) * 0.05;
        ender.arms.forEach((a, i) => a.rotation.z = (i ? -1 : 1) * (0.1 + Math.sin(t * 30) * 0.06));
      }
    }

    if (exit(t)) return;
    player.resetPose();

    if (t < 1.2) {
      idlePose(player, t);
      player.rotation.y = Math.PI;
    } else if (t < 3.0) {
      // 振り返って睨む
      player.rotation.y = Math.PI - seg(t, 1.2, 1.6, E.outQuad) * (Math.PI - 0.45);
      idlePose(player, t);
      player.head.rotation.x = -0.12;
      player.spine.rotation.x = 0.1; // 前傾の圧
      player.armR.shoulder.rotation.x = 0.15;
      player.armL.shoulder.rotation.x = 0.15;
    } else {
      // 勝ち誇り
      player.rotation.y = 0.45 - seg(t, 3.0, 3.3, E.outQuad) * 0.45;
      heroPoses[0](player, t);
    }
  };
  return s;
}

// =========================================================
// 24. 羊ハードル
// =========================================================
function sheepScene(ctx, member, player, color) {
  const s = shell(6.5, ctx);
  const { stage, fx, screen, sfx } = ctx;
  let exit;
  const sheeps = [];
  const HURDLES = [-5.4, -3.4, -1.4]; // 飛び越えるx位置

  s.init = () => {
    stage.setEnv('day');
    stage.props.add(makeClouds());
    for (const x of HURDLES) {
      const sh = makeSheep();
      sh.position.set(x, 0, 0);
      sh.rotation.y = rand(-0.4, 0.4);
      stage.props.add(sh);
      sheeps.push(sh);
    }
    player.position.set(-8.5, 0, 0);
    player.rotation.y = Math.PI / 2;
    screen.setSpeed(0.35);
    HURDLES.forEach((x, i) => {
      s.at(0.45 + i * 0.55, () => sfx.whoosh(0.3, 0.4));
    });
    s.at(2.15, () => {
      sfx.thud(0.7);
      dust(fx, { x: 0.6, y: 0.1, z: 0 }, 22, 2.5);
      screen.setSpeed(0);
    });
    s.at(2.5, () => sfx.hit(400, 0.5));
    addTitleCues(s, member, color, 2.8, 3.4, 4.85);
    exit = makeExit(player, 5.05, ctx, { vx: 1.2, vy: 10.5, vz: 5 });
  };

  s.update = (t, dt) => {
    stage.cam(0.6, 1.55, 5.2, lerp(-4, 0.4, seg(t, 0, 2.1, E.outQuad)), 1.0, 0);

    // ヒツジは草を食む
    sheeps.forEach((sh, i) => {
      sh.head.rotation.x = 0.5 + Math.sin(t * 2 + i * 2) * 0.35;
    });

    if (exit(t)) return;
    player.resetPose();

    if (t < 2.15) {
      // 等速で走りつつヒツジを跳び越える
      const x = lerp(-8.5, 0.6, t / 2.15);
      let y = 0;
      for (const hx of HURDLES) {
        const k = (x - (hx - 0.8)) / 1.7;
        if (k > 0 && k < 1) y = Math.max(y, Math.sin(k * Math.PI) * 1.25);
      }
      player.position.set(x, y, 0);
      if (y > 0.25) {
        tuckPose(player, 0.55);
        player.legR.hip.rotation.x = -1.6; // ハードリング(前脚)
        player.legR.knee.rotation.x = 0.3;
      } else {
        runPose(player, t, { speed: 12.5 });
      }
    } else {
      player.position.set(0.6, 0, 0);
      player.rotation.y = Math.PI / 2 - seg(t, 2.15, 2.5, E.outQuad) * (Math.PI / 2);
      const rise = seg(t, 2.2, 2.5, E.outQuad);
      crouchPose(player, 0.7 * (1 - rise));
      if (rise >= 1) heroPoses[2](player, t);
    }
  };
  return s;
}

// =========================================================
// 25. もぐもぐタイム
// =========================================================
function eatScene(ctx, member, player, color) {
  const s = shell(6.6, ctx);
  const { stage, fx, screen, sfx } = ctx;
  const T_NOTICE = 1.8, T_STAND = 2.3;
  let exit, steak;

  s.init = () => {
    stage.setEnv('day');
    stage.props.add(makeClouds());
    const cake = makeCake();
    cake.position.set(0.7, 0, 0.3);
    stage.props.add(cake);
    steak = makeSteak();
    player.handR.add(steak);
    player.position.set(-0.3, 0, 0.2);
    player.rotation.y = 0.35;

    for (const tt of [0.35, 0.85, 1.35]) s.at(tt, () => sfx.chomp());
    s.at(T_NOTICE, () => sfx.hit(700, 0.3)); // ハッ
    s.at(T_STAND, () => { sfx.whoosh(0.3, 0.4); dust(fx, { x: -0.3, y: 0.1, z: 0.2 }, 12, 1.6); });
    s.at(4.0, () => sfx.chomp()); // ポーズ中もまだ食べてる
    s.at(4.8, () => sfx.chomp());
    addTitleCues(s, member, color, 2.9, 3.5, 5.0);
    exit = makeExit(player, 5.2, ctx, { vx: 1.3, vy: 10.5, vz: 5 });
  };

  s.update = (t, dt) => {
    const k = seg(t, T_NOTICE, T_STAND, E.outQuad);
    stage.cam(lerp(1.8, 0.6, k), lerp(1.1, 1.6, k), lerp(3.2, 4.6, k), -0.1, lerp(0.7, 1.1, k), 0.2);

    // 食べかすパーティクル
    if (t < T_NOTICE && Math.random() < 0.1) {
      fx.burst({
        pos: { x: -0.25, y: 1.0, z: 0.5 }, count: 3, colors: ['#8a5a36', '#6e3a26'],
        speed: 0.7, gravity: -4, life: 0.5, size: 0.05, additive: false,
      });
    }

    if (exit(t)) return;

    if (t < T_NOTICE) {
      sitEatPose(player, t);
    } else if (t < T_STAND) {
      // カメラに気づいて固まる
      sitEatPose(player, t, false);
      player.armR.shoulder.rotation.x = -1.95;
      player.armR.elbow.rotation.x = -1.5;
      player.head.rotation.y = -0.5; // カメラの方をチラ見
      player.head.rotation.x = 0;
    } else {
      // 何事もなかったかのように立つ(ステーキは後ろ手に隠す)
      player.resetPose();
      player.rotation.y = 0.35 * (1 - seg(t, T_STAND, 2.7, E.outQuad));
      const up = seg(t, T_STAND, 2.7, E.outQuad);
      crouchPose(player, 0.6 * (1 - up));
      if (up >= 1) {
        idlePose(player, t);
        player.armR.shoulder.rotation.x = 0.65; // 後ろ手
        player.armR.elbow.rotation.x = -0.5;
        player.armL.shoulder.rotation.z = 0.5;
        player.armL.shoulder.rotation.y = -1.35;
        player.armL.elbow.rotation.x = -1.35;
        player.head.rotation.x = 0.04 + Math.sin(t * 9) * 0.04; // まだ噛んでる
      }
    }
  };
  return s;
}

// =========================================================
// 26. 全力ずっこけ
// =========================================================
function tripScene(ctx, member, player, color) {
  const s = shell(7.5, ctx);
  const { stage, fx, screen, sfx } = ctx;
  const T_TRIP = 1.3, T_DOWN = 1.75, T_GETUP = 3.0, T_POSE = 3.8;
  let exit;

  s.init = () => {
    stage.setEnv('street');
    player.position.set(0, 0, -9);
    player.rotation.y = 0;
    screen.setSpeed(0.6);
    s.at(T_TRIP, () => { sfx.whoosh(0.3, 0.5); screen.setSpeed(0); });
    s.at(T_DOWN, () => {
      sfx.thud(1.0);
      sfx.crack();
      stage.shake(0.2);
      dust(fx, { x: 0, y: 0.1, z: 0.5 }, 34, 3);
    });
    s.at(2.3, () => sfx.pop(false)); // ぴくっ
    s.at(T_POSE, () => { sfx.hit(420, 0.5); screen.flash('#ffffff', 0.1, 0.2); });
    addTitleCues(s, member, color, 4.0, 4.6, 5.95);
    exit = makeExit(player, 6.15, ctx, { vx: 1.3, vy: 10.5, vz: 5 });
  };

  s.update = (t, dt) => {
    stage.cam(0.5, 1.5, 4.8, 0, 0.9, lerp(-4, 0.3, seg(t, 0, T_TRIP, E.outQuad)));

    if (exit(t)) return;
    player.resetPose();

    if (t < T_TRIP) {
      // ヒーロー然と疾走
      player.position.z = lerp(-9, -1.2, seg(t, 0, T_TRIP, E.linear));
      runPose(player, t, { speed: 13, amp: 1.05 });
    } else if (t < T_DOWN) {
      // つまずいて前方へダイブ
      const k = seg(t, T_TRIP, T_DOWN, E.linear);
      player.position.set(0, Math.max(0.16, Math.sin(Math.min(1, k * 1.3) * Math.PI) * 0.7), lerp(-1.2, 0.5, k));
      player.rotation.x = Math.PI / 2 * Math.min(1, k * 1.45);
      player.armR.shoulder.rotation.x = -2.6;
      player.armL.shoulder.rotation.x = -2.6;
      player.legR.knee.rotation.x = 0.6;
      player.legL.knee.rotation.x = 0.9;
    } else if (t < T_GETUP) {
      // うつ伏せでズザーッ → 静止(脚がぴくっ)
      const slide = seg(t, T_DOWN, 2.15, E.outCubic);
      player.position.set(0, 0.16, 0.5 + slide * 0.9);
      player.rotation.x = Math.PI / 2;
      player.armR.shoulder.rotation.x = -2.9;
      player.armL.shoulder.rotation.x = -2.9;
      if (t > 2.25 && t < 2.45) player.legL.knee.rotation.x = 0.8;
      if (slide < 0.9 && Math.random() < 0.3) {
        dust(fx, { x: 0, y: 0.08, z: player.position.z + 0.4 }, 4, 1.2);
      }
    } else if (t < T_POSE) {
      // 立ち上がって砂払い
      const up = seg(t, T_GETUP, 3.4, E.inOutQuad);
      player.position.set(0, 0.16 * (1 - up), 1.4);
      player.rotation.x = Math.PI / 2 * (1 - up);
      if (up >= 1) {
        idlePose(player, t);
        // 腕で体を払う
        player.armR.shoulder.rotation.x = -0.7 + Math.sin(t * 10) * 0.3;
        player.armR.elbow.rotation.x = -1.0;
        player.head.rotation.x = 0.3;
      } else {
        crouchPose(player, 1 - up);
      }
    } else {
      // 何事もなかった
      player.position.set(0, 0, 1.4);
      heroPoses[0](player, t);
    }
  };
  return s;
}

// =========================================================
// 27. 寝坊ダッシュ
// =========================================================
function sleepScene(ctx, member, player, color) {
  const s = shell(6.6, ctx);
  const { stage, fx, screen, sfx } = ctx;
  const T_ALARM = 1.2, T_WAKE = 1.5, T_OFF = 1.9, T_SKID = 2.5;
  let exit, zAcc = 0;

  s.init = () => {
    stage.setEnv('day');
    stage.props.add(makeClouds());
    const bed = makeBed();
    bed.position.set(-1.4, 0, -0.6);
    bed.rotation.y = Math.PI + 0.3; // 枕が頭側に来るよう180°回す
    stage.props.add(bed);
    s.bed = bed;
    player.rotation.order = 'YXZ';
    s.at(T_ALARM, () => sfx.alarm());
    s.at(T_WAKE, () => { sfx.pop(true); stage.shake(0.05); });
    s.at(T_SKID, () => { sfx.thud(0.6); dust(fx, { x: 0.4, y: 0.1, z: 0.6 }, 18, 2); });
    s.at(2.9, () => sfx.hit(420, 0.5));
    addTitleCues(s, member, color, 3.1, 3.7, 5.05);
    exit = makeExit(player, 5.25, ctx, { vx: -1.2, vy: 10.5, vz: 5 });
  };

  s.update = (t, dt) => {
    stage.cam(1.2, 1.6, 4.7, -0.3, 0.9, 0);

    // ZZZパーティクル
    zAcc += dt;
    if (t < T_ALARM && zAcc > 0.55) {
      zAcc = 0;
      fx.burst({
        pos: { x: -1.2, y: 1.1, z: 0.1 }, count: 2, colors: ['#cfd8ff'],
        speed: 0.4, dir: { x: 0.3, y: 1, z: 0 }, gravity: 0.6, life: 1.1, size: 0.09,
      });
    }

    if (exit(t)) return;
    player.resetPose();

    if (t < T_WAKE) {
      // ベッドで爆睡(仰向け)
      player.rotation.set(-Math.PI / 2, 0.3, 0);
      player.position.set(-1.5, 0.62, -0.75);
      player.armR.shoulder.rotation.x = -0.3;
      player.armL.shoulder.rotation.x = -2.6; // 万歳寝相
      if (t > T_ALARM) {
        player.position.y = 0.62 + Math.random() * 0.04; // アラームでガタガタ
      }
    } else if (t < T_OFF) {
      // ガバッと起きる
      const k = seg(t, T_WAKE, T_OFF, E.outBack);
      player.rotation.set(-Math.PI / 2 * (1 - k), 0.3, 0);
      player.position.set(-1.5, lerp(0.62, 0.45, k), lerp(-0.75, -0.3, k));
      player.armR.shoulder.rotation.x = -2.8 * k;
      player.armL.shoulder.rotation.x = -2.8 * k;
      player.head.rotation.x = -0.3 * k;
    } else if (t < T_SKID) {
      // 大慌てで飛び出す
      const k = seg(t, T_OFF, T_SKID, E.outQuad);
      player.rotation.set(0, lerp(0.3, 0, k), 0);
      player.position.set(lerp(-1.5, 0.4, k), 0, lerp(-0.3, 0.6, k));
      runPose(player, t, { speed: 16, amp: 1.15, lean: 0.4 });
    } else {
      player.position.set(0.4, 0, 0.6);
      player.rotation.set(0, 0, 0);
      const rise = seg(t, T_SKID, 2.9, E.outQuad);
      crouchPose(player, 0.6 * (1 - rise));
      if (rise >= 1) heroPoses[1](player, t); // 拳を天に(間に合った!)
    }
  };
  return s;
}

// =========================================================
// 28. タワーMLG
// =========================================================
function mlgScene(ctx, member, player, color) {
  const s = shell(7.1, ctx);
  const { stage, fx, screen, sfx } = ctx;
  const H = 5, T_TOP = 1.8, T_JUMP = 2.6, T_SPLASH = 3.05;
  let exit, blocks = [], water;

  s.init = () => {
    stage.setEnv('day');
    stage.props.add(makeClouds());
    for (let i = 0; i < H; i++) {
      const b = makeBlock('dirt');
      b.position.set(0, i + 0.5, 0);
      b.visible = false;
      stage.props.add(b);
      blocks.push(b);
      s.at(0.25 + (i * (T_TOP - 0.3)) / H, () => {
        b.visible = true;
        sfx.crack();
      });
    }
    water = new THREE.Mesh(
      new THREE.CircleGeometry(1.3, 24),
      new THREE.MeshStandardMaterial({ color: 0x2e6dd6, transparent: true, opacity: 0.85, roughness: 0.3 })
    );
    water.rotation.x = -Math.PI / 2;
    water.position.set(1.8, 0.04, 1.2);
    water.visible = false;
    stage.props.add(water);
    s.at(T_JUMP + 0.2, () => { water.visible = true; sfx.pop(false); }); // バケツ設置(雑)
    s.at(T_SPLASH, () => {
      sfx.splash();
      fx.burst({
        pos: { x: 1.8, y: 0.2, z: 1.2 }, count: 40, colors: ['#7fb0ff', '#bfe0ff', '#ffffff'],
        speed: 3.2, gravity: -7, life: 0.8, size: 0.09,
      });
      fx.ring({ pos: { x: 1.8, y: 0.06, z: 1.2 }, r1: 2.4, life: 0.5, color: 0x7fb0ff });
    });
    s.at(3.5, () => sfx.hit(420, 0.5));
    addTitleCues(s, member, color, 3.7, 4.3, 5.55);
    exit = makeExit(player, 5.75, ctx, { vx: -1.3, vy: 10.5, vz: 4.5 });
  };

  s.update = (t, dt) => {
    const k = seg(t, 0, T_TOP, E.inOutQuad);
    const down = seg(t, T_JUMP, 3.6, E.inOutQuad);
    stage.cam(2.6, lerp(1.4, H + 1.2, k) - down * (H - 0.4), 5.4, 0.5, lerp(0.9, H + 0.6, k) - down * H, 0.5);

    if (exit(t)) return;
    player.resetPose();

    if (t < T_TOP) {
      // ジャンプしながら積み上がる
      const lift = (t - 0.25) / ((T_TOP - 0.3) / H);
      const lvl = Math.max(0, Math.min(H, lift));
      player.position.set(0, lvl + Math.abs(Math.sin(t * 9)) * 0.3, 0);
      crouchPose(player, 0.3 + Math.sin(t * 9) * 0.2);
      player.armR.shoulder.rotation.x = -1.2 + Math.sin(t * 9) * 0.5; // 設置の手振り
      player.armR.elbow.rotation.x = -0.6;
    } else if (t < T_JUMP) {
      // 頂上でドヤ
      player.position.set(0, H, 0);
      heroPoses[1](player, t);
    } else if (t < T_SPLASH) {
      // MLG降下
      const k2 = seg(t, T_JUMP, T_SPLASH, E.inQuad);
      player.position.set(lerp(0, 1.8, k2), lerp(H, 0, k2), lerp(0, 1.2, k2));
      tuckPose(player, 0.5);
      player.armR.shoulder.rotation.x = -2.9; // バケツ構え
    } else {
      player.position.set(1.8, 0, 1.2);
      const rise = seg(t, T_SPLASH + 0.15, 3.5, E.outQuad);
      crouchPose(player, 0.8 * (1 - rise));
      if (rise >= 1) heroPoses[3](player, t);
    }
  };
  return s;
}

// =========================================================
// 29. TNTキャノン
// =========================================================
function tntScene(ctx, member, player, color) {
  const s = shell(7.7, ctx);
  const { stage, fx, screen, sfx } = ctx;
  const T_LIGHT = 1.3, T_ON = 1.8, T_BOOM = 2.6, T_LAND = 3.55;
  let exit, tnt;

  s.init = () => {
    stage.setEnv('sunset');
    tnt = makeBlock('tnt');
    // 点滅でemissiveを書き換えるため共有マテリアルをクローン
    tnt.material = tnt.material.map(m => m.clone());
    tnt.position.set(0, 0.5, 0);
    stage.props.add(tnt);
    player.position.set(0, 0, -3.5);
    player.rotation.y = 0;
    s.at(T_LIGHT, () => { sfx.crack(); sfx.fuse(1.3); });
    s.at(T_BOOM, () => {
      sfx.boom();
      stage.shake(0.32);
      screen.flash('#fff2d0', 0.22, 0.8);
      tnt.visible = false;
      fx.fireball({ pos: { x: 0, y: 0.6, z: 0 }, r: 2.4, life: 1.4 });
      fx.smoke({ pos: { x: 0, y: 0.8, z: 0 }, r: 1.6, life: 2.2, rise: 2.5 });
      fx.ring({ pos: { x: 0, y: 0.05, z: 0 }, r1: 4, life: 0.6, color: 0xffc080 });
    });
    s.at(T_LAND, () => {
      sfx.thud(1.0);
      stage.shake(0.24);
      dust(fx, { x: 0, y: 0.1, z: 1.2 }, 40, 4);
      fx.ring({ pos: { x: 0, y: 0.04, z: 1.2 }, r1: 3.4, life: 0.55, color: 0xbfd0ff });
    });
    addTitleCues(s, member, color, 4.2, 4.8, 6.15);
    exit = makeExit(player, 6.35, ctx, { vx: 1.3, vy: 10.5, vz: 5 });
  };

  s.update = (t, dt) => {
    stage.cam(1.6, 1.6, 5.2, 0, lerp(0.8, 1.4, seg(t, T_BOOM, 3.2, E.outQuad)), 0.4);

    // 導火線点滅
    if (t > T_ON && t < T_BOOM && tnt.visible) {
      const on = Math.floor(t * 8) % 2 === 0;
      tnt.material.forEach?.(m => { m.emissive?.setHex(on ? 0x666666 : 0x000000); });
    }

    if (exit(t)) return;
    player.resetPose();

    if (t < T_LIGHT) {
      // TNTへ歩み寄る
      player.position.z = lerp(-3.5, -0.9, seg(t, 0, T_LIGHT, E.inOutQuad));
      runPose(player, t, { speed: 6.5, amp: 0.5, lean: 0.08 });
    } else if (t < T_ON) {
      // 着火
      player.position.z = -0.9;
      crouchPose(player, 0.55);
      player.armR.shoulder.rotation.x = -1.3;
      player.armR.elbow.rotation.x = -0.3;
    } else if (t < T_BOOM) {
      // TNTの上に乗って待つ(豪胆)
      const k = seg(t, T_ON, T_ON + 0.35, E.outQuad);
      player.position.set(0, k * 1.0, lerp(-0.9, 0, k));
      idlePose(player, t);
      player.armR.shoulder.rotation.x = -0.2;
      player.head.rotation.x = 0.2; // 足元の導火線を見る
    } else if (t < T_LAND) {
      // 打ち上げ → 落下
      const k = seg(t, T_BOOM, T_LAND, E.linear);
      player.position.set(0, 1.0 + Math.sin(k * Math.PI) * 7.5, k * 1.2);
      if (k < 0.5) jumpRisePose(player, 1);
      else tuckPose(player, 0.8);
      player.rotation.y = k * Math.PI * 2;
    } else {
      player.rotation.y = 0;
      player.position.set(0, 0, 1.2);
      const hold = seg(t, 3.9, 4.4, E.inOutQuad);
      heroLandPose(player, 1 - hold);
      if (hold >= 1) heroPoses[5](player, t);
    }
  };
  return s;
}

// =========================================================
// 30. 勝利のダンス
// =========================================================
function danceScene(ctx, member, player, color) {
  const s = shell(6.5, ctx);
  const { stage, fx, screen, sfx } = ctx;
  const T_FREEZE = 2.4;
  let exit;

  s.init = () => {
    stage.setEnv('voidpurple');
    player.position.set(0, 0, 0.4);
    player.rotation.y = 0;
    for (const tt of [0.3, 0.75, 1.2, 1.65, 2.1]) s.at(tt, () => sfx.hit(260 + Math.random() * 120, 0.3));
    s.at(T_FREEZE, () => {
      sfx.hit(440, 0.6);
      screen.flash('#ffffff', 0.12, 0.3);
      fx.ring({ pos: { x: 0, y: 0.05, z: 0.4 }, r1: 2.6, life: 0.5, color: new THREE.Color(color).getHex() });
    });
    addTitleCues(s, member, color, 2.8, 3.4, 4.85);
    exit = makeExit(player, 5.05, ctx, { vx: 1.3, vy: 10.5, vz: 5 });
  };

  s.update = (t, dt) => {
    const punch = seg(t, T_FREEZE, T_FREEZE + 0.25, E.outCubic);
    stage.fov = 50 - 5 * punch;
    stage.cam(Math.sin(t * 0.5) * 0.8, 1.5, 4.4, 0, 1.0, 0.4);

    if (exit(t)) return;
    player.resetPose();

    if (t < 1.2) {
      // ステップ&腕振りダンス
      const b = t * 8.4;
      player.hips.position.y = 12 / 16 - Math.abs(Math.sin(b)) * 0.12;
      player.rotation.y = Math.sin(b * 0.5) * 0.5;
      player.armR.shoulder.rotation.z = -0.4 - Math.max(0, Math.sin(b)) * 1.6;
      player.armL.shoulder.rotation.z = 0.4 + Math.max(0, -Math.sin(b)) * 1.6;
      player.legR.hip.rotation.x = Math.sin(b) * 0.35;
      player.legL.hip.rotation.x = -Math.sin(b) * 0.35;
      player.head.rotation.x = Math.sin(b * 2) * 0.1;
    } else if (t < T_FREEZE) {
      // スピン → 腰振り
      const b = t * 8.4;
      player.rotation.y = seg(t, 1.2, 1.7, E.inOutQuad) * Math.PI * 2 + Math.sin(b * 0.5) * 0.3;
      player.hips.position.y = 12 / 16 - Math.abs(Math.sin(b)) * 0.1;
      player.spine.rotation.z = Math.sin(b) * 0.12;
      player.armR.shoulder.rotation.x = -1.2 + Math.sin(b) * 0.8;
      player.armL.shoulder.rotation.x = -1.2 - Math.sin(b) * 0.8;
      player.armR.elbow.rotation.x = -0.9;
      player.armL.elbow.rotation.x = -0.9;
    } else {
      player.rotation.y = 0;
      heroPoses[7](player, t);
    }
  };
  return s;
}

// =========================================================
// 31. シャドー乱打
// =========================================================
function shadowboxScene(ctx, member, player, color) {
  const s = shell(7.1, ctx);
  const { stage, fx, screen, sfx } = ctx;
  const T_FINISH = 2.4;
  let exit;
  const JABS = [0.4, 0.75, 1.1, 1.5, 1.85, 2.1];

  s.init = () => {
    stage.setEnv('nightcity');
    player.position.set(0, 0, 0.6);
    player.rotation.y = 0;
    JABS.forEach(tt => s.at(tt, () => sfx.whoosh(0.18, 0.45)));
    s.at(T_FINISH, () => {
      sfx.boom();
      sfx.hit(200, 0.8);
      screen.impact(0.32);
      stage.shake(0.16);
    });
    s.at(3.2, () => sfx.hit(400, 0.4));
    addTitleCues(s, member, color, 3.4, 4.0, 5.55);
    exit = makeExit(player, 5.75, ctx, { vx: -1.3, vy: 10.5, vz: 5 });
  };

  s.update = (t, dt) => {
    const punch = seg(t, T_FINISH, T_FINISH + 0.25, E.outCubic);
    stage.fov = 50 - 7 * punch;
    stage.cam(0.4, 1.45, 3.9, 0, 1.25, 0.6);
    screen.setSpeed(t > 1.4 && t < T_FINISH ? 0.25 : 0);

    if (exit(t)) return;
    player.resetPose();

    if (t < T_FINISH) {
      // 構え + ジャブ連打(交互)
      crouchPose(player, 0.2);
      player.spine.rotation.y = -0.2;
      let jab = -1, side = 0;
      JABS.forEach((tt, i) => { if (t >= tt && t < tt + 0.3) { jab = tt; side = i % 2; } });
      // ガード
      player.armR.shoulder.rotation.x = -1.4;
      player.armR.elbow.rotation.x = -1.7;
      player.armL.shoulder.rotation.x = -1.4;
      player.armL.elbow.rotation.x = -1.7;
      if (jab > 0) {
        const k = Math.sin(clamp01((t - jab) / 0.3) * Math.PI);
        const arm = side ? player.armL : player.armR;
        arm.shoulder.rotation.x = -1.4 - 0.35 * k;
        arm.elbow.rotation.x = -1.7 + 1.68 * k;
        player.spine.rotation.y = (side ? 0.35 : -0.35) * k - 0.1;
      }
      player.hips.position.y = 12 / 16 - 0.06 + Math.sin(t * 11) * 0.03; // フットワーク
    } else if (t < 3.2) {
      // フィニッシュストレートで静止
      player.position.z = 0.75;
      crouchPose(player, 0.3);
      player.armR.shoulder.rotation.x = -1.62;
      player.armR.elbow.rotation.x = -0.04;
      player.armL.shoulder.rotation.x = 0.7;
      player.armL.elbow.rotation.x = -1.6;
      player.spine.rotation.y = -0.5;
      player.head.rotation.y = 0.4;
    } else {
      player.position.z = 0.6;
      heroPoses[6](player, t);
    }
  };
  return s;
}

// =========================================================
// 32. 相棒オオカミ
// =========================================================
function wolfScene(ctx, member, player, color) {
  const s = shell(7.2, ctx);
  const { stage, fx, screen, sfx } = ctx;
  const T_STOP = 1.4;
  let exit, wolf;

  s.init = () => {
    stage.setEnv('sunset');
    wolf = makeWolf();
    stage.props.add(wolf);
    player.position.set(-8, 0, 0.2);
    player.rotation.y = Math.PI / 2;
    s.at(T_STOP, () => dust(fx, { x: 0, y: 0.1, z: 0.2 }, 16, 2));
    s.at(3.4, () => { sfx.howl(1.1); });
    s.at(3.3, () => sfx.hit(400, 0.45));
    addTitleCues(s, member, color, 3.5, 4.1, 5.65);
    exit = makeExit(player, 5.85, ctx, { vx: 1.4, vy: 10.5, vz: 5 });
  };

  s.update = (t, dt) => {
    const k = seg(t, 1.6, 2.4, E.inOutQuad);
    stage.cam(lerp(0.8, 1.6, k), lerp(1.7, 1.2, k), 4.9, 0, lerp(1.0, 0.8, k), 0.2);

    // オオカミ: 並走 → おすわり → 遠吠え
    if (t < T_STOP) {
      wolf.position.set(lerp(-9.4, -1.1, seg(t, 0, T_STOP, E.outQuad)), 0, 0.9);
      wolf.rotation.y = Math.PI / 2;
      mobWalk(wolf, t, 13, 0.7);
      wolf.sit(0);
    } else {
      wolf.position.set(-1.1, 0, 0.9);
      wolf.rotation.y = Math.PI / 2 - seg(t, T_STOP, 1.9, E.outQuad) * 1.1;
      wolf.legs.forEach(l => l.rotation.x = 0);
      wolf.sit(seg(t, 1.7, 2.1, E.outQuad));
      wolf.tail.rotation.y = Math.sin(t * 8) * 0.5; // しっぽぶんぶん
      if (t > 3.4 && t < 4.4) {
        wolf.head.rotation.x = -0.85; // 遠吠え
      } else {
        wolf.head.rotation.x = 0;
      }
    }

    if (exit(t)) return;
    player.resetPose();

    if (t < T_STOP) {
      player.position.set(lerp(-8, 0.3, seg(t, 0, T_STOP, E.outQuad)), 0, 0.2);
      runPose(player, t, { speed: 12 });
    } else if (t < 3.2) {
      // オオカミの頭の横にしゃがみ、頭に手を伸ばしてわしゃわしゃ撫でる
      const move = seg(t, T_STOP, 1.9, E.inOutQuad);
      player.position.set(lerp(0.3, -0.35, move), 0, lerp(0.2, 0.55, move));
      player.rotation.y = lerp(Math.PI / 2, -1.05, move); // オオカミの方を向く
      crouchPose(player, seg(t, 1.6, 2.0, E.outQuad) * 0.8);
      if (t > 2.0) {
        player.armR.shoulder.rotation.x = -0.85 + Math.sin(t * 12) * 0.2; // 頭の高さへ
        player.armR.elbow.rotation.x = -0.35;
        player.head.rotation.x = 0.35; // オオカミを見下ろす
      }
    } else {
      // 立ち上がって相棒とキメ
      player.position.set(-0.35, 0, 0.55);
      player.rotation.y = -1.05 * (1 - seg(t, 3.2, 3.5, E.outQuad));
      const up = seg(t, 3.2, 3.5, E.outQuad);
      crouchPose(player, 0.8 * (1 - up));
      if (up >= 1) heroPoses[2](player, t);
    }
  };
  return s;
}

// =========================================================
// 33. ゴーレム肩車
// =========================================================
function golemScene(ctx, member, player, color) {
  const s = shell(7.0, ctx);
  const { stage, fx, screen, sfx } = ctx;
  const T_STOP = 2.2, T_FLIP0 = 2.6, T_FLIP1 = 3.1;
  let exit, golem;

  s.init = () => {
    stage.setEnv('day');
    stage.props.add(makeClouds());
    golem = makeGolem();
    stage.props.add(golem);
    for (const tt of [0.4, 1.0, 1.6, 2.2]) {
      s.at(tt, () => { sfx.thud(0.5); stage.shake(0.06); });
    }
    s.at(T_FLIP0, () => sfx.whoosh(0.4, 0.5));
    s.at(T_FLIP1, () => { sfx.thud(0.8); dust(fx, { x: 0, y: 0.1, z: 1.6 }, 26, 2.8); });
    s.at(3.5, () => sfx.hit(420, 0.5));
    addTitleCues(s, member, color, 3.7, 4.3, 5.45);
    exit = makeExit(player, 5.65, ctx, { vx: 1.3, vy: 10.5, vz: 5 });
  };

  s.update = (t, dt) => {
    stage.cam(1.2, lerp(2.6, 1.6, seg(t, T_STOP, 3.2, E.inOutQuad)), 5.6, 0, lerp(2.4, 1.2, seg(t, T_STOP, 3.2, E.inOutQuad)), 0);

    // ゴーレム: ゆっくり歩いてくる → 停止
    if (t < T_STOP) {
      const k = seg(t, 0, T_STOP, E.linear);
      golem.position.set(0, 0, lerp(-7, -0.6, k));
      mobWalk(golem, t, 4.2, 0.4);
      golem.arms.forEach((a, i) => a.rotation.x = Math.sin(t * 4.2 + (i ? Math.PI : 0)) * 0.3);
    } else {
      golem.position.set(0, 0, -0.6);
      golem.legs.forEach(l => l.rotation.x = 0);
      golem.arms.forEach(a => a.rotation.x = 0);
      golem.head.rotation.y = Math.sin(t * 0.8) * 0.2;
    }

    if (exit(t)) return;
    player.resetPose();

    if (t < T_FLIP0) {
      // 肩の上に立っている
      player.position.set(0.42, golem.position.y + 2.85, golem.position.z);
      idlePose(player, t);
      player.armR.shoulder.rotation.z = -0.5;
      player.armL.shoulder.rotation.z = 0.5;
    } else if (t < T_FLIP1) {
      // バク宙で降りる
      const k = seg(t, T_FLIP0, T_FLIP1, E.linear);
      player.position.set(lerp(0.42, 0, k), 2.85 * (1 - k * k) + Math.sin(k * Math.PI) * 0.8, lerp(-0.6, 1.6, k));
      player.rotation.x = -Math.PI * 2 * k;
      tuckPose(player, Math.sin(k * Math.PI));
    } else {
      player.rotation.x = 0;
      player.position.set(0, 0, 1.6);
      const rise = seg(t, 3.2, 3.5, E.outQuad);
      crouchPose(player, 0.8 * (1 - rise));
      if (rise >= 1) heroPoses[1](player, t);
    }
  };
  return s;
}

// =========================================================
// 34. ハチパニック
// =========================================================
function beesScene(ctx, member, player, color) {
  const s = shell(7.2, ctx);
  const { stage, fx, screen, sfx } = ctx;
  const T_STOP = 1.8, T_FLY = 2.8, T_CALM = 3.2;
  let exit;
  const bees = [];

  s.init = () => {
    stage.setEnv('day');
    stage.props.add(makeClouds());
    for (let i = 0; i < 3; i++) {
      const b = makeBee();
      stage.props.add(b);
      bees.push(b);
    }
    player.position.set(-8, 0, 0.3);
    player.rotation.y = Math.PI / 2;
    for (const tt of [0.3, 0.9, 1.5, 2.1]) s.at(tt, () => sfx.whoosh(0.25, 0.3));
    s.at(T_FLY, () => sfx.pop(true));
    s.at(T_CALM + 0.3, () => sfx.hit(380, 0.4)); // 咳払い的
    addTitleCues(s, member, color, 3.7, 4.3, 5.65);
    exit = makeExit(player, 5.85, ctx, { vx: 1.3, vy: 10.5, vz: 5 });
  };

  s.update = (t, dt) => {
    stage.cam(0.6, 1.6, 4.8, 0, 1.1, 0.3);

    // ハチ: 追跡 → 頭の周りを旋回 → 飛び去る
    bees.forEach((b, i) => {
      b.flap(t + i);
      if (t < T_STOP) {
        const px = lerp(-8, 0.3, seg(t, 0, T_STOP, E.outQuad));
        b.position.set(
          px - 1.1 - i * 0.5 + Math.sin(t * 7 + i * 2) * 0.25,
          1.5 + Math.sin(t * 9 + i * 3) * 0.3,
          0.3 + Math.cos(t * 6 + i) * 0.4
        );
        b.rotation.y = Math.PI / 2;
      } else if (t < T_FLY) {
        const a = t * 5 + i * (Math.PI * 2 / 3);
        b.position.set(0.3 + Math.cos(a) * 0.75, 1.75 + Math.sin(t * 6 + i) * 0.15, 0.3 + Math.sin(a) * 0.75);
        b.rotation.y = -a;
      } else {
        const k = seg(t, T_FLY, T_FLY + 0.9, E.inQuad);
        b.position.y = 1.75 + k * 7;
        b.position.x += dt * 2;
      }
    });

    if (exit(t)) return;
    player.resetPose();

    if (t < T_STOP) {
      // 腕をぶんぶん振り回しながら逃げてくる
      player.position.set(lerp(-8, 0.3, seg(t, 0, T_STOP, E.outQuad)), 0, 0.3);
      runPose(player, t, { speed: 14, amp: 1.0 });
      player.armR.shoulder.rotation.x = t * 22;        // 風車腕
      player.armL.shoulder.rotation.x = -t * 22 + 1;
      player.head.rotation.x = -0.2;
    } else if (t < T_FLY) {
      // 立ち止まってハチを叩こうとする
      player.position.set(0.3, 0, 0.3);
      player.rotation.y = Math.PI / 2 - seg(t, T_STOP, 2.1, E.outQuad) * (Math.PI / 2);
      crouchPose(player, 0.2);
      player.armR.shoulder.rotation.x = -2.0 + Math.sin(t * 14) * 0.7;
      player.armL.shoulder.rotation.x = -2.0 - Math.sin(t * 14) * 0.7;
      player.head.rotation.y = Math.sin(t * 9) * 0.4;
    } else if (t < T_CALM + 0.6) {
      // 飛び去ったのを見送り、襟を正す
      player.position.set(0.3, 0, 0.3);
      player.rotation.y = 0;
      idlePose(player, t);
      player.head.rotation.x = lerp(-0.7, 0, seg(t, T_CALM, T_CALM + 0.5, E.outQuad));
      player.armR.shoulder.rotation.x = -0.5;
      player.armR.elbow.rotation.x = -1.2; // 襟ぱしっ
    } else {
      player.position.set(0.3, 0, 0.3);
      heroPoses[0](player, t);
    }
  };
  return s;
}

// =========================================================
// 35. 矢避けバレットタイム
// =========================================================
function arrowsScene(ctx, member, player, color) {
  const s = shell(7.0, ctx);
  const { stage, fx, screen, sfx } = ctx;
  const SHOTS = [0.8, 1.3, 1.8]; // 発射時刻
  const T_CATCH = 2.3, T_SNAP = 2.75;
  let exit, skeleton;
  const arrows = [];

  s.init = () => {
    stage.setEnv('dark');
    skeleton = new PlayerModel(makeSkeletonSkin());
    skeleton.position.set(0.4, 0, -8);
    stage.props.add(skeleton);
    for (let i = 0; i < 4; i++) {
      const a = makeArrow();
      a.visible = false;
      stage.props.add(a);
      arrows.push({ mesh: a, t0: i < 3 ? SHOTS[i] : T_CATCH - 0.45, y: 1.3 + (i % 2) * 0.25, x: (i % 2 ? -0.3 : 0.35) });
    }
    arrows[3].x = 0.15; // キャッチする矢
    SHOTS.concat([T_CATCH - 0.45]).forEach(tt => s.at(tt, () => sfx.twang()));
    s.at(T_CATCH, () => {
      sfx.hit(600, 0.6);
      screen.impact(0.22);
      stage.shake(0.1);
    });
    s.at(T_SNAP, () => {
      sfx.crack();
      arrows[3].mesh.visible = false;
      fx.burst({ pos: { x: 0.15, y: 1.35, z: 0.4 }, count: 10, colors: ['#9a7a4e', '#e8e8e0'], speed: 1.5, gravity: -4, life: 0.5, size: 0.05, additive: false });
    });
    s.at(3.1, () => sfx.hit(420, 0.5));
    addTitleCues(s, member, color, 3.3, 3.9, 5.45);
    exit = makeExit(player, 5.65, ctx, { vx: 1.3, vy: 10.5, vz: 5 });
  };

  s.update = (t, dt) => {
    stage.cam(1.4, 1.5, 4.4, 0, 1.25, 0);
    screen.setSpeed(t > 0.7 && t < T_CATCH ? 0.35 : 0);

    // スケルトン: 弓を引く構え → 最後はうなだれる
    skeleton.resetPose();
    if (t < T_CATCH + 0.3) {
      skeleton.armL.shoulder.rotation.x = -1.6;
      skeleton.armR.shoulder.rotation.x = -1.5;
      skeleton.armR.elbow.rotation.x = -1.3;
    } else {
      idlePose(skeleton, t);
      skeleton.head.rotation.x = 0.65; // しょんぼり
      skeleton.spine.rotation.x = 0.2;
    }

    // 矢の飛翔
    for (const a of arrows) {
      if (t < a.t0) continue;
      const isCatch = a === arrows[3];
      const k = (t - a.t0) / 0.5;
      if (!isCatch && k > 1.3) { a.mesh.visible = false; continue; }
      a.mesh.visible = true;
      const kk = isCatch ? Math.min(k, 0.86) : k; // キャッチ矢は手前で停止
      a.mesh.position.set(a.x, a.y, lerp(-7.6, 1.2, kk));
      a.mesh.rotation.set(0, 0, (t * 7) % (Math.PI * 2)); // 回転しながら飛ぶ
    }

    if (exit(t)) return;
    player.resetPose();
    player.position.set(0, 0, 0.6);

    if (t < T_CATCH) {
      // マトリックス避け(交互に上体を反らす)
      crouchPose(player, 0.15);
      let lean = 0;
      SHOTS.forEach((tt, i) => {
        const k = clamp01((t - tt - 0.25) / 0.3);
        if (t > tt + 0.1 && t < tt + 0.75) lean = (i % 2 ? -1 : 1) * Math.sin(k * Math.PI) * 1.0;
      });
      player.spine.rotation.z = lean * 0.55;
      player.hips.position.y = 12 / 16 - 0.1 - Math.abs(lean) * 0.18;
      player.head.rotation.z = -lean * 0.3;
      player.armR.shoulder.rotation.z = -0.4 - lean * 0.3;
      player.armL.shoulder.rotation.z = 0.4 - lean * 0.3;
    } else if (t < 3.1) {
      // キャッチ → へし折る
      crouchPose(player, 0.2);
      player.armR.shoulder.rotation.x = -1.55;
      player.armR.elbow.rotation.x = -0.1;
      if (t > T_SNAP) {
        player.armL.shoulder.rotation.x = -1.4;
        player.armL.elbow.rotation.x = -0.9;
        player.armR.elbow.rotation.x = -0.7;
      }
      player.head.rotation.x = 0.05;
    } else {
      heroPoses[6](player, t);
    }
  };
  return s;
}

// =========================================================
// 36. ネザーゲート参上
// =========================================================
function portalScene(ctx, member, player, color) {
  const s = shell(6.3, ctx);
  const { stage, fx, screen, sfx } = ctx;
  const T_OUT = 0.8;
  let exit, portal;

  s.init = () => {
    // ネザーゲートはオーバーワールド(夜)に開く
    stage.setEnv('nightcity');
    portal = makePortal(3, 4);
    portal.position.set(0, 0, -1.6);
    stage.props.add(portal);
    player.visible = false;
    sfx.riser(0.8);
    s.at(T_OUT, () => {
      player.visible = true;
      sfx.pop(true);
      screen.flash('#c05fff', 0.18, 0.4);
      fx.burst({ pos: { x: 0, y: 1.2, z: -1.4 }, count: 40, colors: ENDER, speed: 2.6, gravity: -0.5, life: 0.8, size: 0.09, drag: 2.2 });
    });
    s.at(2.1, () => sfx.hit(420, 0.5));
    addTitleCues(s, member, color, 2.6, 3.2, 4.65);
    exit = makeExit(player, 4.85, ctx, { vx: 1.3, vy: 10.5, vz: 4.5 });
  };

  let acc = 0;
  s.update = (t, dt) => {
    stage.cam(1.0, 1.55, 4.8, 0, 1.15, -0.4);

    // ゲートの揺らめき
    portal.glow.material.opacity = 0.45 + Math.sin(t * 7) * 0.12;
    acc += dt;
    if (acc > 0.16) {
      acc = 0;
      fx.burst({
        pos: { x: rand(-0.5, 0.5), y: rand(0.8, 3), z: -1.55 }, count: 3, colors: ENDER,
        speed: 0.5, gravity: 0.4, life: 0.9, size: 0.07, drag: 1,
      });
    }

    if (exit(t)) return;
    if (!player.visible) return;
    player.resetPose();

    if (t < 1.9) {
      // ゲートからゆっくり歩み出る
      player.position.set(0, 0, lerp(-1.4, 0.8, seg(t, T_OUT, 1.9, E.inOutQuad)));
      runPose(player, t, { speed: 5, amp: 0.42, lean: 0.06 });
    } else {
      player.position.set(0, 0, 0.8);
      const k = seg(t, 1.9, 2.15, E.outQuad);
      if (k >= 1) heroPoses[4](player, t); // 片膝キメ
      else idlePose(player, t);
    }
  };
  return s;
}

// =========================================================
// 37. エンダーパールRTA (投げて着弾点へワープ、落下ダメージでよろける)
// =========================================================
function pearlScene(ctx, member, player, color) {
  const s = shell(6.8, ctx);
  const { stage, fx, screen, sfx } = ctx;
  const W1_THROW = 0.5, W1_HIT = 1.1, W2_THROW = 1.7, W2_HIT = 2.25;
  const P0 = [-3.5, -2], P1 = [-0.6, -0.6], P2 = [0.9, 1.5];
  let exit, pearl;

  const warpBurst = (x, z) => {
    sfx.pop(true);
    fx.burst({
      pos: { x, y: 1, z }, count: 30, colors: ENDER, speed: 2.5,
      gravity: -0.5, life: 0.7, size: 0.08, drag: 2.5,
    });
  };

  s.init = () => {
    stage.setEnv('voidpurple');
    pearl = makePearl();
    pearl.visible = false;
    stage.props.add(pearl);
    player.position.set(P0[0], 0, P0[1]);
    player.rotation.y = 0.5;
    s.at(W1_THROW, () => sfx.whoosh(0.3, 0.4));
    s.at(W1_HIT, () => {
      pearl.visible = false;
      warpBurst(P0[0], P0[1]);
      warpBurst(P1[0], P1[1]);
      sfx.thud(0.5); // 落下ダメージ
    });
    s.at(W2_THROW, () => sfx.whoosh(0.3, 0.4));
    s.at(W2_HIT, () => {
      pearl.visible = false;
      warpBurst(P1[0], P1[1]);
      warpBurst(P2[0], P2[1]);
      sfx.thud(0.6);
      screen.flash('#c05fff', 0.12, 0.25);
    });
    s.at(3.0, () => sfx.hit(420, 0.5));
    addTitleCues(s, member, color, 3.3, 3.9, 5.25);
    exit = makeExit(player, 5.45, ctx, { vx: 1.3, vy: 10.5, vz: 4.5 });
  };

  s.update = (t, dt) => {
    const close = seg(t, W2_HIT, W2_HIT + 0.3, E.outCubic);
    stage.cam(lerp(0.6, 1.0, close), 1.6, lerp(5.6, 4.3, close), 0, 1.1, lerp(-1, 0.8, close));

    // パール飛翔(放物線 + トレイル)
    const arc = (a, b, t0, t1) => {
      const k = seg(t, t0, t1, E.linear);
      pearl.visible = k > 0 && k < 1;
      if (pearl.visible) {
        pearl.position.set(lerp(a[0], b[0], k), 1.1 + Math.sin(k * Math.PI) * 1.7, lerp(a[1], b[1], k));
        if (Math.random() < 0.5) {
          fx.burst({ pos: { x: pearl.position.x, y: pearl.position.y, z: pearl.position.z }, count: 2, colors: ENDER, speed: 0.4, gravity: 0, life: 0.4, size: 0.05 });
        }
      }
    };
    if (t >= W1_THROW && t < W1_HIT) arc(P0, P1, W1_THROW, W1_HIT);
    else if (t >= W2_THROW && t < W2_HIT) arc(P1, P2, W2_THROW, W2_HIT);

    if (exit(t)) return;
    player.resetPose();

    const throwPose = (k) => { // 振りかぶり→リリース
      player.armR.shoulder.rotation.x = lerp(0.8, -2.6, k);
      player.armR.elbow.rotation.x = -0.3;
      player.spine.rotation.y = lerp(0.4, -0.3, k);
    };
    const stumble = (tt, deep) => { // 着地よろけ
      const k = 1 - seg(t, tt, tt + 0.45, E.outQuad);
      crouchPose(player, deep * k);
      player.spine.rotation.z = Math.sin(t * 20) * 0.12 * k;
      player.armR.shoulder.rotation.z = -0.8 * k;
      player.armL.shoulder.rotation.z = 0.8 * k;
    };

    if (t < W1_HIT) {
      player.position.set(P0[0], 0, P0[1]);
      player.rotation.y = 0.5;
      if (t < W1_THROW) idlePose(player, t);
      throwPose(seg(t, W1_THROW - 0.3, W1_THROW + 0.1, E.outQuad));
    } else if (t < W2_HIT) {
      player.position.set(P1[0], 0, P1[1]);
      player.rotation.y = 0.2;
      stumble(W1_HIT, 0.7);
      if (t > W2_THROW - 0.3) throwPose(seg(t, W2_THROW - 0.3, W2_THROW + 0.1, E.outQuad));
    } else if (t < 3.0) {
      // ドアップ着地、大きくよろけて踏ん張る
      player.position.set(P2[0], 0, P2[1]);
      player.rotation.y = 0;
      stumble(W2_HIT, 1.0);
      player.head.rotation.x = 0.2 * (1 - seg(t, W2_HIT, 2.9, E.outQuad));
    } else {
      player.position.set(P2[0], 0, P2[1]);
      heroPoses[6](player, t);
    }
  };
  return s;
}

// =========================================================
// 38. ベッド爆破RTA
// 止まり木の横に黒曜石をセットアップ → ベッドを置き、
// ドラゴンが止まったところを爆破する本家RTA戦法
// =========================================================
function bedbombScene(ctx, member, player, color) {
  const s = shell(8.0, ctx);
  const { stage, fx, screen, sfx } = ctx;
  const T_OBSIDIAN = 0.95, T_BED = 1.3, T_PERCH0 = 1.5, T_PERCH1 = 2.55, T_BOOM = 2.95;
  const FX0 = 0.6, FZ0 = -1.0;     // 止まり木の位置
  const BX = -0.55, BZ = -0.1;     // 黒曜石+ベッドの位置
  let exit, bed, obsidian, dragon;

  s.init = () => {
    stage.setEnv('voidpurple');
    // 止まり木(中央の岩柱)
    for (let i = 0; i < 2; i++) {
      const b = makeBlock('deepslate');
      b.position.set(FX0, i + 0.5, FZ0);
      stage.props.add(b);
    }
    obsidian = makeBlock('obsidian');
    obsidian.visible = false;
    obsidian.position.set(BX, 0.5, BZ);
    stage.props.add(obsidian);
    bed = makeBed();
    bed.visible = false;
    bed.scale.setScalar(0.72);
    bed.position.set(BX, 1.0, BZ);
    bed.rotation.y = 0.7;
    stage.props.add(bed);
    dragon = makeDragon();
    dragon.scale.setScalar(0.6);
    stage.props.add(dragon);

    player.position.set(-6, 0, 1.6);
    player.rotation.y = Math.PI / 2;

    s.at(T_OBSIDIAN, () => { obsidian.visible = true; sfx.crack(); });
    s.at(T_BED, () => { bed.visible = true; sfx.crack(); });
    s.at(T_PERCH0, () => sfx.roar(1.1));
    s.at(T_PERCH1, () => { sfx.thud(0.6); stage.shake(0.1); });
    s.at(T_BOOM, () => {
      // ベッド起爆!
      sfx.boom();
      sfx.boom();
      sfx.roar(1.4);
      stage.shake(0.42);
      screen.flash('#ffffff', 0.32, 0.95);
      bed.visible = false;
      fx.fireball({ pos: { x: BX, y: 1.2, z: BZ }, r: 3.2, life: 1.6 });
      fx.smoke({ pos: { x: FX0, y: 1.6, z: FZ0 }, r: 2.0, life: 2.6, rise: 2.8 });
      fx.debris({ pos: { x: BX, y: 1.0, z: BZ }, count: 22, colors: [0xc83a2e, 0xf2f2ec, 0x6b4e2e], size: 0.15, speed: 7, life: 1.8 });
      fx.ring({ pos: { x: BX, y: 0.05, z: BZ }, r1: 4.5, life: 0.6, color: 0xffc080 });
      // XPオーブが弾ける(大ダメージ!)
      fx.burst({
        pos: { x: FX0, y: 2.4, z: FZ0 }, count: 36, colors: ['#7fe84a', '#d8f23a', '#aef7a0'],
        speed: 3, gravity: -4, life: 1.5, size: 0.1,
      });
    });
    s.at(3.9, () => sfx.hit(420, 0.5));
    addTitleCues(s, member, color, 4.2, 4.8, 6.25);
    exit = makeExit(player, 6.45, ctx, { vx: 1.3, vy: 10.5, vz: 4.5 });
  };

  s.update = (t, dt) => {
    stage.cam(1.8, lerp(1.6, 2.0, seg(t, T_PERCH0, T_PERCH1, E.inOutQuad)), 5.6, 0, 1.4, 0);

    // ドラゴン: 上空旋回 → 止まり木へ降りて翼を畳む → 爆破で吹っ飛ぶ
    if (dragon.visible) {
      if (t < T_PERCH0) {
        const a = t * 0.9 + 2.2;
        dragon.position.set(Math.cos(a) * 9, 6.5, Math.sin(a) * 9 - 5);
        dragon.rotation.y = Math.atan2(-Math.sin(a), Math.cos(a));
        dragon.rotation.z = 0.3;
        dragon.flap(t, 1);
      } else if (t < T_PERCH1) {
        // 着地進入
        const k = seg(t, T_PERCH0, T_PERCH1, E.inOutQuad);
        const a = T_PERCH0 * 0.9 + 2.2;
        dragon.position.set(
          lerp(Math.cos(a) * 9, FX0, k),
          lerp(6.5, 2.55, k),
          lerp(Math.sin(a) * 9 - 5, FZ0, k)
        );
        dragon.rotation.y = lerp(Math.atan2(-Math.sin(a), Math.cos(a)), 0.2, k);
        dragon.rotation.z = 0.3 * (1 - k);
        dragon.flap(t, 1 - k * 0.5);
      } else if (t < T_BOOM) {
        // 止まり木にとまる(翼をたたむ)
        dragon.position.set(FX0, 2.55, FZ0);
        dragon.rotation.y = 0.2;
        dragon.flap(t, 0.08);
        dragon.head.rotation.x = Math.sin(t * 2) * 0.1 + 0.15;
      } else {
        // 爆破でスピンしながら吹っ飛んでいく
        const k = seg(t, T_BOOM, T_BOOM + 1.0, E.outQuad);
        dragon.position.set(FX0 - k * 14, 2.55 + k * 7 - k * k * 2, FZ0 - k * 6);
        dragon.rotation.z = k * Math.PI * 3;
        dragon.flap(t, 0.3);
        if (k >= 1) dragon.visible = false;
      }
    }

    if (exit(t)) return;
    player.resetPose();

    if (t < T_OBSIDIAN) {
      // 駆け込んでくる
      player.position.set(lerp(-6, -1.6, seg(t, 0, T_OBSIDIAN, E.outQuad)), 0, 1.4);
      runPose(player, t, { speed: 13 });
    } else if (t < T_BED + 0.2) {
      // 黒曜石→ベッドを設置
      player.position.set(-1.6, 0, 1.4);
      player.rotation.y = Math.PI / 2 - seg(t, T_OBSIDIAN, T_OBSIDIAN + 0.2, E.outQuad) * 1.1;
      crouchPose(player, 0.5);
      player.armR.shoulder.rotation.x = -1.4 + Math.sin(t * 18) * 0.3;
      player.armR.elbow.rotation.x = -0.3;
    } else if (t < T_BOOM) {
      // 離れて隠れ、ドラゴンが止まるのを待って起爆クリック
      const back = seg(t, T_BED + 0.2, T_BED + 0.6, E.inOutQuad);
      player.position.set(lerp(-1.6, -2.6, back), 0, lerp(1.4, 2.0, back));
      player.rotation.y = 0.3;
      crouchPose(player, 0.75);
      player.head.rotation.x = -0.35; // ドラゴンを見上げて待つ
      if (t > T_BOOM - 0.25) {
        player.armR.shoulder.rotation.x = -1.5; // クリック!
        player.armR.elbow.rotation.x = -0.2;
      }
    } else if (t < 3.9) {
      // 爆風に耐えて、立ち上がる
      player.position.set(-2.6, 0, 2.0);
      player.rotation.y = 0.3 * (1 - seg(t, 3.3, 3.7, E.inOutQuad));
      const up = seg(t, T_BOOM + 0.4, 3.9, E.inOutQuad);
      crouchPose(player, 0.75 * (1 - up));
      player.armL.shoulder.rotation.x = -1.9 * (1 - up); // 顔をかばう
      player.armL.elbow.rotation.x = -1.4 * (1 - up);
    } else {
      player.position.set(-2.6, 0, 2.0);
      heroPoses[0](player, t);
    }
  };
  return s;
}

// =========================================================
// 39. エンドポータル起動 (フレーム12個にエンダーアイを連続ではめる)
// =========================================================
function endportalScene(ctx, member, player, color) {
  const s = shell(7.6, ctx);
  const { stage, fx, screen, sfx } = ctx;
  const N_EYES = 12;
  const T_LAST = 2.55, T_ACTIVE = 2.85, T_JUMPIN = 5.8;
  const FX0 = 0.4, FZ0 = -0.4; // フレーム中心
  let frame;

  s.init = () => {
    stage.setEnv('cave');
    frame = makeEndPortalFrame();
    frame.position.set(FX0, 0, FZ0);
    stage.props.add(frame);
    player.position.set(-6.5, 0, 1.8);
    player.rotation.y = Math.PI / 2;

    // 11個を高速連続ではめ、12個目だけタメて劇的に
    for (let i = 0; i < N_EYES - 1; i++) {
      s.at(0.95 + i * 0.115, () => {
        frame.addEye(i);
        sfx.pop(true);
        sfx.hit(380 + i * 34, 0.28);
      });
    }
    s.at(T_LAST, () => {
      frame.addEye(N_EYES - 1);
      sfx.pop(true);
      sfx.hit(900, 0.5);
      screen.flash('#7fe8a0', 0.1, 0.25);
    });
    s.at(T_ACTIVE, () => {
      sfx.zap();
      sfx.boom();
      stage.shake(0.18);
      screen.flash('#7fe8a0', 0.25, 0.6);
      frame.pool.material.opacity = 0.95;
      fx.burst({
        pos: { x: FX0, y: 0.9, z: FZ0 }, count: 60, colors: ENDER.concat(['#7fe8a0']),
        speed: 3.0, gravity: -0.4, life: 1.0, size: 0.09, drag: 2,
      });
      fx.ring({ pos: { x: FX0, y: 0.6, z: FZ0 }, r1: 3.4, life: 0.6, color: 0x7fe8a0 });
    });
    s.at(3.3, () => sfx.hit(420, 0.5));
    addTitleCues(s, member, color, 3.5, 4.1, 5.5);
    // 退場はポータルに飛び込む(専用)
    s.at(T_JUMPIN + 0.25, () => sfx.whoosh(0.4, 0.5));
    s.at(T_JUMPIN + 0.62, () => {
      sfx.pop(false);
      sfx.boom();
      player.visible = false;
      fx.burst({
        pos: { x: FX0, y: 0.8, z: FZ0 }, count: 46, colors: ENDER, speed: 3,
        gravity: -0.5, life: 0.8, size: 0.09, drag: 2,
      });
      fx.ring({ pos: { x: FX0, y: 0.6, z: FZ0 }, r1: 2.8, life: 0.5, color: 0xb05fff });
    });
  };

  let acc = 0;
  s.update = (t, dt) => {
    const k = seg(t, T_ACTIVE, 3.5, E.inOutQuad);
    stage.cam(lerp(2.2, 1.2, k), lerp(2.4, 2.6, k), lerp(6.0, 5.4, k), FX0, 0.5, FZ0 + 0.4);

    // 起動後はポータル面から紫の粒が立ち上る
    if (t > T_ACTIVE) {
      acc += dt;
      if (acc > 0.12) {
        acc = 0;
        fx.burst({
          pos: { x: FX0 + rand(-1.2, 1.2), y: 0.7, z: FZ0 + rand(-1.2, 1.2) },
          count: 3, colors: ENDER, speed: 0.4, dir: { x: 0, y: 1.4, z: 0 },
          gravity: 0.8, life: 1.0, size: 0.06, spread: 0.3,
        });
      }
    }

    if (!player.visible) return;
    player.resetPose();

    // はめ込み中はリングの周りを2箇所移動する
    const SPOT_A = [-2.4, 1.4], SPOT_B = [2.8, 1.2];
    const hop = seg(t, 1.55, 1.8, E.inOutQuad);
    const px = lerp(SPOT_A[0], SPOT_B[0], hop);
    const pz = lerp(SPOT_A[1], SPOT_B[1], hop);

    if (t < 0.85) {
      // 駆け込み
      player.position.set(lerp(-6.5, SPOT_A[0], seg(t, 0, 0.85, E.outQuad)), 0, 1.8);
      runPose(player, t, { speed: 13 });
    } else if (t < T_ACTIVE) {
      player.position.set(px, hop > 0 && hop < 1 ? Math.sin(hop * Math.PI) * 0.5 : 0, pz);
      player.rotation.y = Math.atan2(FX0 - px, FZ0 - pz); // 常にポータル中心を向く
      if (hop > 0 && hop < 1) {
        tuckPose(player, 0.4);
      } else if (t < T_LAST - 0.35) {
        // 高速はめ込み(腕を交互に素早く)
        crouchPose(player, 0.62);
        player.armR.shoulder.rotation.x = -1.5 + Math.sin(t * 26) * 0.45;
        player.armL.shoulder.rotation.x = -1.2 - Math.sin(t * 26) * 0.45;
        player.armR.elbow.rotation.x = -0.25;
        player.armL.elbow.rotation.x = -0.25;
      } else {
        // 最後の1個は両手でゆっくり
        const slow = seg(t, T_LAST - 0.35, T_LAST, E.inOutQuad);
        crouchPose(player, 0.5 + slow * 0.25);
        player.armR.shoulder.rotation.x = -1.7 * slow - 0.3;
        player.armL.shoulder.rotation.x = -1.7 * slow - 0.3;
      }
    } else if (t < T_JUMPIN) {
      // 起動を見届けてキメ
      player.position.set(SPOT_B[0], 0, SPOT_B[1]);
      player.rotation.y = Math.atan2(FX0 - SPOT_B[0], FZ0 - SPOT_B[1]) * (1 - seg(t, T_ACTIVE, 3.3, E.inOutQuad));
      const up = seg(t, T_ACTIVE, 3.3, E.outQuad);
      crouchPose(player, 0.75 * (1 - up));
      if (up >= 1) heroPoses[2](player, t);
    } else {
      // ポータル中心へ飛び込む!
      const k2 = seg(t, T_JUMPIN, T_JUMPIN + 0.62, E.inQuad);
      if (k2 < 0.4) {
        crouchPose(player, seg(t, T_JUMPIN, T_JUMPIN + 0.25, E.outQuad) * 0.8);
        player.position.set(SPOT_B[0], 0, SPOT_B[1]);
      } else {
        const j = (k2 - 0.4) / 0.6;
        player.position.set(
          lerp(SPOT_B[0], FX0, j), Math.sin(j * Math.PI * 0.75) * 1.6 - j * 0.5, lerp(SPOT_B[1], FZ0, j)
        );
        tuckPose(player, j);
      }
    }
  };
  return s;
}

// =========================================================
// 40. RTA走者 (IGTタイマー付き怒涛の小ネタ詰め)
// =========================================================
function rtaScene(ctx, member, player, color) {
  const s = shell(7.4, ctx);
  const { stage, fx, screen, sfx } = ctx;
  const T_WARP = 1.3, T_BED = 2.0, T_BOOM = 2.4, T_LAND = 2.8, T_GOAL = 3.05;
  let exit, timerEl, bed, clouds, splitText = '';

  s.init = () => {
    stage.setEnv('day');
    clouds = makeClouds();
    stage.props.add(clouds);
    bed = makeBed();
    bed.visible = false;
    bed.position.set(1.6, 0, -0.6);
    stage.props.add(bed);

    timerEl = document.createElement('div');
    timerEl.className = 'rta-timer';
    document.getElementById('app').appendChild(timerEl);

    s.at(0.9, () => { sfx.whoosh(0.3, 0.4); splitText = 'ネザーIN +0.8s'; });
    s.at(T_WARP, () => {
      // パールワープと同時にエンドへ突入(ベッドが爆発するのはエンドだけ)
      sfx.pop(true);
      screen.flash('#c05fff', 0.25, 0.7);
      stage.setEnv('voidpurple');
      clouds.visible = false;
      fx.burst({ pos: { x: 0, y: 1, z: -2.4 }, count: 24, colors: ENDER, speed: 2.4, gravity: -0.5, life: 0.6, size: 0.08, drag: 2.5 });
      fx.burst({ pos: { x: 0, y: 1, z: -0.4 }, count: 24, colors: ENDER, speed: 2.4, gravity: -0.5, life: 0.6, size: 0.08, drag: 2.5 });
      splitText = 'エンド突入 -1.2s ★';
    });
    s.at(T_BED, () => { bed.visible = true; sfx.crack(); });
    s.at(T_BOOM, () => {
      sfx.boom();
      stage.shake(0.3);
      screen.flash('#fff2d0', 0.2, 0.7);
      bed.visible = false;
      fx.fireball({ pos: { x: 1.6, y: 0.5, z: -0.6 }, r: 2.2, life: 1.3 });
      fx.ring({ pos: { x: 1.6, y: 0.05, z: -0.6 }, r1: 3.5, life: 0.55, color: 0xffc080 });
      splitText = 'エンドラ討伐!!';
    });
    s.at(T_LAND, () => { sfx.thud(0.8); dust(fx, { x: -0.2, y: 0.1, z: 0.8 }, 24, 2.6); });
    s.at(T_GOAL, () => {
      sfx.fanfare();
      timerEl.classList.add('pb');
      splitText = '☆ WORLD RECORD ☆';
      screen.flash('#ffe169', 0.2, 0.4);
    });
    addTitleCues(s, member, color, 3.5, 4.1, 5.65);
    exit = makeExit(player, 5.85, ctx, { vx: 1.3, vy: 10.5, vz: 5 });
  };

  s.dispose = () => {
    if (timerEl) timerEl.remove();
    timerEl = null;
  };

  s.update = (t, dt) => {
    stage.cam(0.8, 1.6, 4.9, 0, 1.05, 0);

    // IGT表示(1秒=約7分の超圧縮RTA)
    const igt = Math.min(t, T_GOAL) * 433;
    const mm = Math.floor(igt / 60), ss = Math.floor(igt % 60), cs = Math.floor((igt % 1) * 100);
    timerEl.innerHTML =
      `IGT ${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}.${String(cs).padStart(2, '0')}` +
      (splitText ? `<span class="split">${splitText}</span>` : '');

    if (exit(t)) return;
    player.resetPose();

    if (t < T_WARP) {
      // 猛ダッシュ
      player.position.set(0, 0, lerp(-8, -2.4, seg(t, 0, T_WARP, E.linear)));
      runPose(player, t, { speed: 14, amp: 1.1 });
    } else if (t < T_BED) {
      // パールワープ後、ベッド設置に走る
      const k = seg(t, T_WARP, T_BED, E.linear);
      player.position.set(lerp(0, 1.0, k), 0, lerp(-0.4, -0.2, k));
      player.rotation.y = 0.8;
      runPose(player, t, { speed: 14, amp: 1.0 });
    } else if (t < T_BOOM) {
      // しゃがんでクリック連打
      player.position.set(0.9, 0, -0.1);
      player.rotation.y = 0.8;
      crouchPose(player, 0.7);
      player.armR.shoulder.rotation.x = -1.3 + Math.sin(t * 30) * 0.2;
    } else if (t < T_LAND) {
      // 爆風をバク転で回避
      const k = seg(t, T_BOOM, T_LAND, E.linear);
      player.rotation.y = 0.8 * (1 - k);
      player.position.set(lerp(0.9, -0.2, k), Math.sin(k * Math.PI) * 1.2, lerp(-0.1, 0.8, k));
      player.rotation.x = -Math.PI * 2 * k;
      tuckPose(player, Math.sin(k * Math.PI));
    } else {
      player.rotation.x = 0;
      player.rotation.y = 0;
      player.position.set(-0.2, 0, 0.8);
      const rise = seg(t, T_LAND, T_GOAL + 0.2, E.outQuad);
      crouchPose(player, 0.7 * (1 - rise));
      if (rise >= 1) heroPoses[7](player, t); // 両手Vサイン(完走)
    }
  };
  return s;
}

// =========================================================
export const FACTORIES2 = {
  pearl: pearlScene,
  bedbomb: bedbombScene,
  endportal: endportalScene,
  rta: rtaScene,
  creeper: creeperScene,
  pigride: pigrideScene,
  chickens: chickensScene,
  zombies: zombiesScene,
  enderman: endermanScene,
  sheep: sheepScene,
  eat: eatScene,
  trip: tripScene,
  sleep: sleepScene,
  mlg: mlgScene,
  tnt: tntScene,
  dance: danceScene,
  shadowbox: shadowboxScene,
  wolf: wolfScene,
  golem: golemScene,
  bees: beesScene,
  arrows: arrowsScene,
  portal: portalScene,
};

// ============================================================
// [scenes3.js より統合]
// ============================================================

// 個人紹介演出 第3弾 x24 (モダンMC: ウォーデン/アレイ/エリトラ/メイス等)



// =========================================================
// 41. エリトラ急襲 (ロケット加速つき滑空)
// =========================================================
function elytraScene(ctx, member, player, color) {
  const s = shell(7.1, ctx);
  const { stage, fx, screen, sfx } = ctx;
  let exit, wings;

  // 滑空ポーズ(腕を後ろへ)
  const glidePose = (p) => {
    p.armR.shoulder.rotation.x = 0.7;
    p.armL.shoulder.rotation.x = 0.7;
    p.armR.shoulder.rotation.z = -0.4;
    p.armL.shoulder.rotation.z = 0.4;
    p.legR.knee.rotation.x = 0.15;
    p.legL.knee.rotation.x = 0.15;
    p.head.rotation.x = -1.0;
  };

  s.init = () => {
    stage.setEnv('day');
    stage.props.add(makeClouds());
    wings = makeElytra();
    wings.position.set(0, 1.35, -0.16);
    player.add(wings);
    sfx.whoosh(1.0, 0.4);
    s.at(0.9, () => {
      // ロケット加速
      sfx.boom();
      screen.flash('#fff7c8', 0.1, 0.2);
    });
    s.at(2.75, () => { sfx.thud(0.6); dust(fx, { x: 0, y: 0.1, z: 0.6 }, 26, 2.8); });
    s.at(3.1, () => sfx.hit(420, 0.5));
    addTitleCues(s, member, color, 3.4, 4.0, 5.45);
    exit = makeExit(player, 5.65, ctx, { vx: 1.3, vy: 10.5, vz: 5 });
  };

  s.dispose = () => { if (wings) player.remove(wings); };

  s.update = (t, dt) => {
    const k = seg(t, 1.6, 2.8, E.inOutQuad);
    stage.cam(0.8, lerp(2.8, 1.6, k), lerp(7.5, 4.8, k), 0, lerp(3.5, 1.1, k), 0);

    if (exit(t)) return;
    player.resetPose();
    player.rotation.order = 'XYZ';

    if (t < 0.9) {
      // 高空から滑空進入(左奥→手前へ)
      const k2 = t / 0.9;
      player.position.set(lerp(-16, -6, k2), lerp(9, 6.5, k2), lerp(-10, -5, k2));
      player.rotation.set(Math.PI / 2 - 0.3, 0, -Math.PI / 2 + 0.5);
      glidePose(player);
    } else if (t < 2.0) {
      // ロケット加速して手前を横切る
      const k2 = seg(t, 0.9, 2.0, E.inOutQuad);
      player.position.set(lerp(-6, 6, k2), lerp(6.5, 2.6, k2) - Math.sin(k2 * Math.PI) * 1.2, lerp(-5, 1.5, k2));
      player.rotation.set(Math.PI / 2 - 0.2, 0, -Math.PI / 2 + 0.2);
      glidePose(player);
      fx.burst({
        pos: { x: player.position.x - 0.4, y: player.position.y, z: player.position.z },
        count: 5, colors: ['#fff7c8', '#ffd98a', '#c8d8ff'], speed: 0.8, gravity: 0, life: 0.5, size: 0.09,
      });
      screen.setSpeed(0.35 * Math.sin(k2 * Math.PI));
    } else if (t < 2.75) {
      // フレアをかけて失速着地
      const k2 = seg(t, 2.0, 2.75, E.inOutQuad);
      player.position.set(lerp(6, 0, k2), lerp(2.6, 0, k2) + Math.sin(k2 * Math.PI) * 0.8, lerp(1.5, 0.6, k2));
      player.rotation.x = lerp(Math.PI / 2 - 0.2, 0, k2);
      player.rotation.z = lerp(-Math.PI / 2 + 0.2, 0, k2);
      glidePose(player);
      player.armR.shoulder.rotation.z = -1.2 * k2;
      player.armL.shoulder.rotation.z = 1.2 * k2;
    } else {
      player.position.set(0, 0, 0.6);
      player.rotation.set(0, 0, 0);
      const rise = seg(t, 2.8, 3.1, E.outQuad);
      crouchPose(player, 0.6 * (1 - rise));
      if (rise >= 1) heroPoses[1](player, t);
    }
  };
  return s;
}

// =========================================================
// 42. トライデント・リップタイド (雨中スピン突撃)
// =========================================================
function tridentScene(ctx, member, player, color) {
  const s = shell(6.8, ctx);
  const { stage, fx, screen, sfx } = ctx;
  const T_SPIN = 1.1, T_LAND = 2.2;
  let exit, trident;

  s.init = () => {
    stage.setEnv('dark');
    trident = makeTrident();
    trident.rotation.x = Math.PI / 2;
    player.handR.add(trident);
    player.position.set(-2.5, 0, -1);
    player.rotation.y = 0.6;
    s.at(T_SPIN, () => { sfx.whoosh(0.8, 0.7); sfx.splash(); });
    s.at(T_LAND, () => {
      sfx.thud(0.9);
      sfx.splash();
      stage.shake(0.2);
      dust(fx, { x: 0.4, y: 0.1, z: 0.8 }, 30, 3);
      fx.ring({ pos: { x: 0.4, y: 0.04, z: 0.8 }, r1: 3, life: 0.55, color: 0x7fb0ff });
    });
    s.at(2.6, () => sfx.hit(420, 0.5));
    addTitleCues(s, member, color, 2.9, 3.5, 5.05);
    exit = makeExit(player, 5.25, ctx, { vx: 1.3, vy: 10.5, vz: 5 });
  };

  let acc = 0;
  s.update = (t, dt) => {
    stage.cam(1.0, 1.7, 5.0, 0, 1.2, 0);
    // 雨
    acc += dt;
    if (acc > 0.06) {
      acc = 0;
      fx.burst({
        pos: { x: rand(-5, 5), y: 6, z: rand(-4, 4) }, count: 6, colors: ['#7fa8d8', '#9fc0e8'],
        speed: 0.5, dir: { x: 0, y: -14, z: 0 }, gravity: 0, life: 0.45, size: 0.05, spread: 0.05, additive: false,
      });
    }

    if (exit(t)) return;
    player.resetPose();

    if (t < T_SPIN) {
      // 構え(トライデントを掲げ雨を受ける)
      player.position.set(-2.5, 0, -1);
      crouchPose(player, seg(t, 0.5, T_SPIN, E.inQuad) * 0.6);
      player.armR.shoulder.rotation.x = -2.6;
      player.head.rotation.x = -0.4;
    } else if (t < T_LAND) {
      // リップタイド発動: きりもみ回転しながら突進
      const k = seg(t, T_SPIN, T_LAND, E.inOutQuad);
      player.position.set(lerp(-2.5, 0.4, k), Math.sin(k * Math.PI) * 2.2, lerp(-1, 0.8, k));
      player.rotation.y = k * Math.PI * 6;
      player.armR.shoulder.rotation.x = -2.9;
      player.armL.shoulder.rotation.x = 0.5;
      player.legR.knee.rotation.x = 0.4;
      player.legL.knee.rotation.x = 0.4;
      fx.burst({
        pos: { x: player.position.x, y: player.position.y + 0.8, z: player.position.z },
        count: 6, colors: ['#7fb0ff', '#bfe0ff'], speed: 1.6, gravity: -1, life: 0.5, size: 0.08,
      });
    } else {
      player.rotation.y = 0;
      player.position.set(0.4, 0, 0.8);
      const hold = seg(t, 2.35, 2.7, E.inOutQuad);
      heroLandPose(player, 1 - hold);
      player.armR.shoulder.rotation.x = -0.4 - hold * 2.2; // トライデントを掲げ直す
      if (hold >= 1) {
        idlePose(player, t);
        player.armR.shoulder.rotation.x = -2.6;
        player.armL.shoulder.rotation.z = 0.5;
      }
    }
  };
  return s;
}

// =========================================================
// 43. ウォーデン回避 (スニークで横を抜ける)
// =========================================================
function wardenScene(ctx, member, player, color) {
  const s = shell(7.2, ctx);
  const { stage, fx, screen, sfx } = ctx;
  const T_FREEZE = 1.5, T_RESUME = 2.3, T_SAFE = 3.3;
  let exit, warden;

  s.init = () => {
    stage.setEnv('dark');
    warden = makeWarden();
    warden.position.set(0, 0, -2.2);
    stage.props.add(warden);
    player.position.set(-4.5, 0, 1.2);
    player.rotation.y = Math.PI / 2;
    s.at(0.2, () => sfx.roar(0.8));
    s.at(T_FREEZE, () => sfx.hit(120, 0.5)); // ビクッ
    s.at(T_SAFE + 0.4, () => sfx.hit(420, 0.45));
    addTitleCues(s, member, color, 3.7, 4.3, 5.65);
    exit = makeExit(player, 5.85, ctx, { vx: 1.3, vy: 10.5, vz: 5 });
  };

  let acc = 0;
  s.update = (t, dt) => {
    stage.cam(0.6, 1.6, 5.4, 0, 1.2, -0.5);

    // ウォーデン: ゆっくり徘徊、途中でこちらへ向く
    const facing = t > T_FREEZE && t < T_RESUME;
    warden.head.rotation.y = facing
      ? lerp(warden.head.rotation.y, Math.PI * 0.5, 0.15)
      : Math.sin(t * 0.7) * 0.5;
    warden.arms.forEach((a, i) => a.rotation.x = Math.sin(t * 1.6 + (i ? Math.PI : 0)) * 0.2);
    // スカルクの粒
    acc += dt;
    if (acc > 0.25) {
      acc = 0;
      fx.burst({
        pos: { x: rand(-3, 3), y: 0.15, z: rand(-3, 1) }, count: 2, colors: ['#35c8c8', '#1e6a6a'],
        speed: 0.3, dir: { x: 0, y: 0.8, z: 0 }, gravity: 0.4, life: 1.0, size: 0.05,
      });
    }

    if (exit(t)) return;
    player.resetPose();

    const sneak = (px) => {
      player.position.set(px, 0, 1.2);
      crouchPose(player, 0.55);
      const w = Math.sin(t * 7);
      player.legR.hip.rotation.x += -w * 0.35;
      player.legL.hip.rotation.x += w * 0.35;
      player.head.rotation.y = -0.5; // ウォーデンをチラ見
    };

    if (t < T_FREEZE) {
      sneak(lerp(-4.5, -1.5, seg(t, 0, T_FREEZE, E.linear)));
    } else if (t < T_RESUME) {
      // ウォーデンが向いた! 静止
      player.position.set(-1.5, 0, 1.2);
      crouchPose(player, 0.65);
      player.head.rotation.y = -0.6;
      if (Math.floor(t * 10) % 4 === 0) {
        fx.burst({ pos: { x: -1.3, y: 2.1, z: 1.2 }, count: 1, colors: ['#bfe0ff'], speed: 0.5, gravity: -2, life: 0.4, size: 0.06, additive: false });
      }
    } else if (t < T_SAFE) {
      sneak(lerp(-1.5, 2.2, seg(t, T_RESUME, T_SAFE, E.linear)));
    } else {
      // 抜けきって安堵 → キメ
      player.position.set(2.2, 0, 1.2);
      player.rotation.y = Math.PI / 2 - seg(t, T_SAFE, T_SAFE + 0.4, E.outQuad) * (Math.PI / 2);
      const up = seg(t, T_SAFE, T_SAFE + 0.4, E.outQuad);
      crouchPose(player, 0.55 * (1 - up));
      if (up >= 1) {
        if (t < 4.4) {
          idlePose(player, t);
          player.armR.shoulder.rotation.x = -2.5; // 額の汗をぬぐう
          player.armR.elbow.rotation.x = -1.3;
        } else {
          heroPoses[0](player, t);
        }
      }
    }
  };
  return s;
}

// =========================================================
// 47. ツタターザン
// =========================================================
function vineswingScene(ctx, member, player, color) {
  const s = shell(6.4, ctx);
  const { stage, fx, screen, sfx } = ctx;
  const T_RELEASE = 1.1, T_LAND = 1.55;
  let exit, vine;

  s.init = () => {
    stage.setEnv('day');
    stage.props.add(makeClouds());
    vine = makeVine(5);
    vine.position.set(0, 7.5, 0);
    vine.rotation.z = 1.0;
    stage.props.add(vine);
    sfx.whoosh(0.9, 0.5);
    s.at(T_LAND, () => { sfx.thud(0.8); dust(fx, { x: 1.6, y: 0.1, z: 0.5 }, 26, 2.8); });
    s.at(2.1, () => sfx.hit(420, 0.5));
    addTitleCues(s, member, color, 2.7, 3.3, 4.85);
    exit = makeExit(player, 5.05, ctx, { vx: 1.3, vy: 10.5, vz: 5 });
  };

  s.update = (t, dt) => {
    stage.cam(0.6, 1.8, 5.6, 0, 1.5, 0);

    // ツタの振り子
    const swing = t < T_RELEASE
      ? lerp(1.0, -0.55, seg(t, 0, T_RELEASE, E.inOutQuad))
      : -0.55 * Math.cos((t - T_RELEASE) * 4) * Math.exp(-(t - T_RELEASE) * 1.2);
    vine.rotation.z = swing;

    if (exit(t)) return;
    player.resetPose();

    if (t < T_RELEASE) {
      // ツタにぶら下がって振れてくる
      const ang = vine.rotation.z;
      const L = 5.2;
      player.position.set(Math.sin(ang) * L, 7.5 - Math.cos(ang) * L, 0);
      player.rotation.z = ang;
      player.armR.shoulder.rotation.x = -2.9;
      player.armL.shoulder.rotation.x = -2.9;
      player.legR.knee.rotation.x = 0.6;
      player.legL.knee.rotation.x = 0.3;
    } else if (t < T_LAND) {
      // 手を離して放物線
      const k = seg(t, T_RELEASE, T_LAND, E.linear);
      player.rotation.z = 0;
      player.position.set(lerp(-2.6, 1.6, k), lerp(3.2, 0, k) + Math.sin(k * Math.PI) * 0.9, lerp(0, 0.5, k));
      tuckPose(player, Math.sin(k * Math.PI) * 0.8);
    } else {
      player.position.set(1.6, 0, 0.5);
      const rise = seg(t, 1.7, 2.1, E.outQuad);
      crouchPose(player, 0.7 * (1 - rise));
      if (rise >= 1) heroPoses[6](player, t);
    }
  };
  return s;
}

// =========================================================
// 49. ウィンドチャージ跳躍
// =========================================================
function windchargeScene(ctx, member, player, color) {
  const s = shell(6.8, ctx);
  const { stage, fx, screen, sfx } = ctx;
  const T_THROW = 0.9, T_BURST = 1.1, T_APEX = 1.7, T_LAND = 2.3;
  let exit;

  s.init = () => {
    stage.setEnv('nightcity');
    player.position.set(0, 0, 0.2);
    player.rotation.y = 0;
    s.at(T_THROW, () => sfx.whoosh(0.25, 0.5));
    s.at(T_BURST, () => {
      sfx.boom();
      stage.shake(0.15);
      fx.ring({ pos: { x: 0, y: 0.06, z: 0.2 }, r1: 2.8, life: 0.5, color: 0xdfe8f0 });
      fx.burst({ pos: { x: 0, y: 0.3, z: 0.2 }, count: 30, colors: ['#dfe8f0', '#aebfd0'], speed: 3, gravity: -1, life: 0.6, size: 0.08 });
    });
    s.at(T_LAND, () => {
      sfx.thud(0.9);
      stage.shake(0.18);
      dust(fx, { x: 0, y: 0.1, z: 0.8 }, 30, 3);
      fx.ring({ pos: { x: 0, y: 0.04, z: 0.8 }, r1: 2.6, life: 0.5, color: 0xdfe8f0 });
    });
    s.at(2.7, () => sfx.hit(420, 0.5));
    addTitleCues(s, member, color, 3.0, 3.6, 5.05);
    exit = makeExit(player, 5.25, ctx, { vx: -1.3, vy: 10.5, vz: 5 });
  };

  s.update = (t, dt) => {
    const up = seg(t, T_BURST, T_APEX, E.outQuad) - seg(t, T_APEX, T_LAND, E.inQuad);
    stage.cam(0.8, 1.5 + up * 1.8, 5.0, 0, 1.0 + up * 2.6, 0.4);

    if (exit(t)) return;
    player.resetPose();

    if (t < T_BURST) {
      // 足元に投げつける
      player.position.set(0, 0, 0.2);
      const k = seg(t, T_THROW - 0.25, T_THROW + 0.1, E.outQuad);
      player.armR.shoulder.rotation.x = lerp(0.6, -1.9, k) + lerp(0, 2.3, seg(t, T_THROW + 0.1, T_BURST, E.inQuad));
      player.spine.rotation.x = 0.25 * k;
    } else if (t < T_LAND) {
      // 風で打ち上がる → 自由落下
      const h = (seg(t, T_BURST, T_APEX, E.outQuad) - seg(t, T_APEX, T_LAND, E.inQuad)) * 4.2;
      player.position.set(0, h, lerp(0.2, 0.8, seg(t, T_BURST, T_LAND, E.linear)));
      if (t < T_APEX) jumpRisePose(player, 1);
      else tuckPose(player, 0.6);
    } else {
      player.position.set(0, 0, 0.8);
      const hold = seg(t, 2.45, 2.8, E.inOutQuad);
      heroLandPose(player, 1 - hold);
      if (hold >= 1) heroPoses[5](player, t);
    }
  };
  return s;
}

// =========================================================
// 50. メイス一撃
// =========================================================
function maceScene(ctx, member, player, color) {
  const s = shell(6.8, ctx);
  const { stage, fx, screen, sfx } = ctx;
  const T_JUMP = 1.1, T_APEX = 1.6, T_SMASH = 1.95;
  let exit, mace;

  s.init = () => {
    stage.setEnv('nightcity');
    mace = makeMace();
    mace.rotation.x = Math.PI / 2;
    player.handR.add(mace);
    player.position.set(0, 0, -5);
    player.rotation.y = 0;
    s.at(T_JUMP, () => sfx.whoosh(0.5, 0.6));
    s.at(T_SMASH, () => {
      sfx.boom();
      sfx.clang();
      stage.shake(0.35);
      screen.flash('#ffffff', 0.16, 0.55);
      screen.impact(0.25);
      dust(fx, { x: 0, y: 0.15, z: 0.5 }, 44, 4.5);
      fx.ring({ pos: { x: 0, y: 0.05, z: 0.5 }, r1: 4.6, life: 0.65, color: 0xdfe8f0 });
      fx.debris({ pos: { x: 0, y: 0.2, z: 0.5 }, count: 16, colors: [0x3c3f48, 0x5e6168], size: 0.13, speed: 5.5, life: 1.4 });
    });
    s.at(2.7, () => sfx.hit(420, 0.5));
    addTitleCues(s, member, color, 3.1, 3.7, 5.05);
    exit = makeExit(player, 5.25, ctx, { vx: 1.3, vy: 10.5, vz: 5 });
  };

  s.update = (t, dt) => {
    const punch = seg(t, T_SMASH, T_SMASH + 0.3, E.outCubic);
    stage.fov = 50 - 6 * punch;
    stage.cam(0.9, 1.5, 5.0, 0, 1.0, 0);

    if (exit(t)) return;
    player.resetPose();

    if (t < T_JUMP) {
      player.position.set(0, 0, lerp(-5, -0.6, seg(t, 0, T_JUMP, E.outQuad)));
      runPose(player, t, { speed: 12 });
      player.armR.shoulder.rotation.x = -0.6; // メイスを携えて走る
      player.armR.elbow.rotation.x = -0.8;
    } else if (t < T_SMASH) {
      // 大ジャンプ → メイスを振りかぶって落下
      const k = seg(t, T_JUMP, T_SMASH, E.linear);
      player.position.set(0, Math.sin(Math.min(1, k * 1.15) * Math.PI) * 3.2, lerp(-0.6, 0.5, k));
      player.armR.shoulder.rotation.x = lerp(-2.9, -0.3, seg(t, T_APEX, T_SMASH, E.inQuad));
      player.armR.elbow.rotation.x = -0.2;
      player.armL.shoulder.rotation.x = 0.6;
      player.spine.rotation.x = 0.3 * seg(t, T_APEX, T_SMASH, E.inQuad);
      player.legR.knee.rotation.x = 0.8;
      player.legL.knee.rotation.x = 0.5;
    } else {
      // 着弾クレーターでタメ → 立ち上がり担ぎ
      player.position.set(0, 0, 0.5);
      const hold = seg(t, 2.4, 2.75, E.inOutQuad);
      heroLandPose(player, 1 - hold);
      player.armR.shoulder.rotation.x = lerp(-0.3, -2.2, hold); // メイスを担ぐ
      player.armR.elbow.rotation.x = -0.5 * hold;
      if (hold >= 1) {
        player.armL.shoulder.rotation.z = 0.5;
        player.armL.elbow.rotation.x = -1.1;
        player.spine.rotation.y = -0.15;
      }
    }
  };
  return s;
}

// =========================================================
// 55. 不死のトーテム
// =========================================================
function totemScene(ctx, member, player, color) {
  const s = shell(7.1, ctx);
  const { stage, fx, screen, sfx } = ctx;
  const T_KNEE = 1.4, T_DOWN = 1.8, T_REVIVE = 2.1, T_UP = 2.8;
  let exit, totem;

  s.init = () => {
    stage.setEnv('dark');
    totem = makeTotem();
    totem.visible = false;
    stage.props.add(totem);
    s.at(T_REVIVE, () => {
      sfx.shing();
      sfx.fanfare();
      screen.flash('#ffe88a', 0.4, 0.8);
      stage.shake(0.1);
      totem.visible = true;
      fx.burst({
        pos: { x: 0, y: 1.0, z: 0.3 }, count: 60, colors: ['#ffe88a', '#e8c84a', '#aef7a0'],
        speed: 2.6, gravity: -0.3, life: 1.2, size: 0.1, drag: 1.5,
      });
      fx.ring({ pos: { x: 0, y: 0.06, z: 0.3 }, r1: 3.2, life: 0.7, color: 0xffe88a });
      stage.key.intensity = 1.6;
      stage.hemi.intensity = 0.4;
    });
    s.at(3.2, () => sfx.hit(420, 0.5));
    addTitleCues(s, member, color, 3.5, 4.1, 5.55);
    exit = makeExit(player, 5.75, ctx, { vx: 1.3, vy: 10.5, vz: 5 });
  };

  let acc = 0;
  s.update = (t, dt) => {
    stage.cam(0.6, 1.4, 4.8, 0, 1.0, 0.3);

    // 復活後は金の粒が舞い続ける
    if (t > T_REVIVE && t < 4.5) {
      acc += dt;
      if (acc > 0.12) {
        acc = 0;
        fx.burst({
          pos: { x: rand(-0.6, 0.6), y: rand(0.3, 1.8), z: 0.3 + rand(-0.4, 0.4) },
          count: 2, colors: ['#ffe88a', '#e8c84a'], speed: 0.4, gravity: -0.4, life: 0.9, size: 0.07,
        });
      }
    }
    // トーテムを掲げた手に追従
    if (totem.visible && t > T_UP) {
      totem.position.set(player.position.x + 0.28, 2.2, player.position.z + 0.25);
      totem.rotation.y = t * 2.5;
    } else if (totem.visible) {
      totem.position.set(0.28, 1.3, 0.55);
    }

    if (exit(t)) return;
    player.resetPose();
    player.position.set(0, 0, 0.3);

    if (t < T_KNEE) {
      // 満身創痍でふらふら歩み寄る
      player.position.set(0, 0, lerp(-2.6, 0.3, seg(t, 0, T_KNEE, E.linear)));
      runPose(player, t, { speed: 4.5, amp: 0.4, lean: 0.3 });
      player.spine.rotation.z = Math.sin(t * 3) * 0.12;
      player.head.rotation.x = 0.5;
    } else if (t < T_DOWN) {
      // 膝から崩れる
      heroLandPose(player, seg(t, T_KNEE, T_DOWN, E.inQuad));
      player.head.rotation.x = 0.6;
    } else if (t < T_REVIVE) {
      heroLandPose(player, 1);
      player.head.rotation.x = 0.7;
      player.spine.rotation.x = 0.6;
    } else if (t < T_UP) {
      // 金色の光とともに復活(ゆっくり立ち上がる)
      const k = seg(t, T_REVIVE, T_UP, E.inOutQuad);
      heroLandPose(player, 1 - k);
      player.head.rotation.x = lerp(0.7, -0.3, k);
      player.armR.shoulder.rotation.x = -1.2 * k;
    } else {
      // トーテムを掲げる
      idlePose(player, t);
      player.armR.shoulder.rotation.x = -2.85;
      player.armL.shoulder.rotation.z = 0.45;
      player.head.rotation.x = -0.3;
    }
  };
  return s;
}

// =========================================================
// 59. 金床の雨
// =========================================================
function anvilScene(ctx, member, player, color) {
  const s = shell(6.8, ctx);
  const { stage, fx, screen, sfx } = ctx;
  const DROPS = [
    { t0: 0.6, x: -2.6, z: -0.5 }, { t0: 1.1, x: -1.2, z: 1.3 },
    { t0: 1.6, x: 0.2, z: -0.7 }, { t0: 2.1, x: 1.4, z: 1.2 },
    { t0: 2.45, x: 2.25, z: 0.15 }, // 最後はかかと真後ろ
  ];
  const T_STOP = 2.7;
  let exit;
  const anvils = [];

  s.init = () => {
    stage.setEnv('street');
    for (const d of DROPS) {
      const a = makeAnvil();
      a.visible = false;
      a.rotation.y = rand(Math.PI);
      stage.props.add(a);
      anvils.push({ mesh: a, ...d });
      s.at(d.t0 + 0.38, () => {
        sfx.clang();
        stage.shake(0.12);
        dust(fx, { x: d.x, y: 0.1, z: d.z }, 18, 2.2);
      });
    }
    s.at(T_STOP + 0.3, () => sfx.hit(420, 0.5));
    addTitleCues(s, member, color, 3.1, 3.7, 5.25);
    exit = makeExit(player, 5.45, ctx, { vx: 1.3, vy: 10.5, vz: 5 });
  };

  s.update = (t, dt) => {
    stage.cam(0.5, 1.7, 5.2, 0, 1.1, 0.3);

    // 金床落下
    for (const a of anvils) {
      const k = (t - a.t0) / 0.38;
      if (k < 0) continue;
      a.mesh.visible = true;
      a.mesh.position.set(a.x, Math.max(0, 7 * (1 - k * k)), a.z);
    }

    if (exit(t)) return;
    player.resetPose();

    if (t < T_STOP) {
      // 何も気づかず堂々ウォーク
      player.position.set(lerp(-3.4, 2.0, seg(t, 0, T_STOP, E.linear)), 0, 0.3);
      player.rotation.y = Math.PI / 2;
      runPose(player, t, { speed: 5.2, amp: 0.45, lean: 0.05 });
      player.head.rotation.x = -0.05;
    } else {
      // 止まってキメ(背後の金床には目もくれない)
      player.position.set(2.0, 0, 0.3);
      player.rotation.y = Math.PI / 2 - seg(t, T_STOP, T_STOP + 0.35, E.outQuad) * (Math.PI / 2);
      const up = seg(t, T_STOP, T_STOP + 0.35, E.outQuad);
      if (up >= 1) heroPoses[0](player, t);
      else idlePose(player, t);
    }
  };
  return s;
}

// =========================================================
// 60. ネコの威光 (クリーパーはネコが苦手)
// =========================================================
function catcreeperScene(ctx, member, player, color) {
  const s = shell(7.1, ctx);
  const { stage, fx, screen, sfx } = ctx;
  const T_CAT = 1.5, T_FLEE = 1.9, T_SET = 2.9;
  let exit, creeper, cat;

  s.init = () => {
    stage.setEnv('day');
    stage.props.add(makeClouds());
    creeper = makeCreeper();
    creeper.position.set(0, 0, -7);
    stage.props.add(creeper);
    cat = makeCat();
    cat.visible = false;
    stage.props.add(cat);
    player.position.set(0, 0, 1.0);
    player.rotation.y = Math.PI; // クリーパーの方を向く
    s.at(1.2, () => sfx.fuse(0.5));
    s.at(T_CAT, () => { cat.visible = true; sfx.pop(true); });
    s.at(T_FLEE, () => { sfx.hit(900, 0.4); sfx.whoosh(0.6, 0.5); });
    s.at(T_SET, () => sfx.pop(false));
    s.at(3.4, () => sfx.hit(420, 0.5));
    addTitleCues(s, member, color, 3.6, 4.2, 5.55);
    exit = makeExit(player, 5.75, ctx, { vx: 1.3, vy: 10.5, vz: 5 });
  };

  s.update = (t, dt) => {
    stage.cam(1.6, 1.6, 5.0, 0, 1.0, -0.6);

    // クリーパー: 接近 → ネコを見て大慌てで逃走
    if (t < T_FLEE) {
      creeper.position.z = lerp(-7, -1.6, seg(t, 0, T_FLEE - 0.2, E.outQuad));
      mobWalk(creeper, t, 9, 0.5);
      if (t > 1.2 && t < T_CAT) creeper.flash(Math.floor(t * 8) % 2 === 0);
      if (t > T_CAT) creeper.flash(false);
    } else {
      const k = (t - T_FLEE);
      creeper.position.z = -1.6 - k * 7;
      creeper.rotation.y = Math.PI;
      mobWalk(creeper, t, 16, 0.8);
      if (k < 0.6 && Math.random() < 0.4) dust(fx, { x: 0, y: 0.1, z: creeper.position.z + 0.5 }, 4, 1.4);
    }

    // ネコ: 掲げられる → 地面でスリスリ
    if (cat.visible) {
      cat.tail.rotation.y = Math.sin(t * 7) * 0.5;
      if (t < T_SET) {
        cat.position.set(player.position.x, 1.5, player.position.z - 0.6);
        cat.rotation.y = Math.PI; // クリーパーに顔を向ける
      } else {
        const k = seg(t, T_SET, T_SET + 0.4, E.outQuad);
        cat.position.set(player.position.x + 0.5, 1.5 * (1 - k), player.position.z - 0.2 * k);
        cat.rotation.y = Math.PI + Math.sin(t * 1.5) * 0.4;
      }
    }

    if (exit(t)) return;
    player.resetPose();
    player.position.set(0, 0, 1.0);

    if (t < T_CAT) {
      // 迫るクリーパーに動じず仁王立ち
      player.rotation.y = Math.PI;
      idlePose(player, t);
    } else if (t < T_SET) {
      // ネコを正面に掲げる
      player.rotation.y = Math.PI;
      idlePose(player, t);
      player.armR.shoulder.rotation.x = -1.6;
      player.armL.shoulder.rotation.x = -1.6;
      player.armR.elbow.rotation.x = -0.15;
      player.armL.elbow.rotation.x = -0.15;
    } else {
      // ネコを下ろして振り向きキメ
      player.rotation.y = Math.PI * (1 - seg(t, T_SET + 0.2, T_SET + 0.6, E.inOutQuad));
      const up = seg(t, T_SET, T_SET + 0.5, E.outQuad);
      crouchPose(player, 0.5 * (1 - up) * (t < T_SET + 0.5 ? 1 : 0));
      if (t > T_SET + 0.6) heroPoses[3](player, t);
    }
  };
  return s;
}

// =========================================================
// 62. スライムトランポリン
// =========================================================
function slimeScene(ctx, member, player, color) {
  const s = shell(7.3, ctx);
  const { stage, fx, screen, sfx } = ctx;
  const B = [
    { t0: 1.0, t1: 1.5, h: 1.4 },
    { t0: 1.5, t1: 2.1, h: 2.6 },
    { t0: 2.1, t1: 2.9, h: 5.0 },
  ];
  const T_LAND = 3.3;
  let exit, slime;

  s.init = () => {
    stage.setEnv('day');
    stage.props.add(makeClouds());
    slime = makeSlimeBlock(1.6);
    slime.position.set(0.4, 0, -0.5);
    stage.props.add(slime);
    B.forEach(b => s.at(b.t0, () => sfx.boing(true)));
    s.at(T_LAND, () => {
      sfx.thud(1.0);
      stage.shake(0.22);
      dust(fx, { x: -1.4, y: 0.1, z: 1.0 }, 36, 3.5);
      fx.ring({ pos: { x: -1.4, y: 0.04, z: 1.0 }, r1: 3, life: 0.55, color: 0xbfd0ff });
    });
    s.at(3.9, () => sfx.hit(420, 0.5));
    addTitleCues(s, member, color, 3.6, 4.2, 5.85);
    exit = makeExit(player, 6.05, ctx, { vx: 1.3, vy: 10.5, vz: 5 });
  };

  s.update = (t, dt) => {
    const high = t > 2.1 && t < 2.9 ? seg(t, 2.1, 2.5, E.outQuad) - seg(t, 2.5, 2.9, E.inQuad) : 0;
    stage.cam(1.2, 1.7 + high * 1.6, 5.6, 0, 1.2 + high * 2.2, 0);

    // スライムが潰れて伸びる
    let squish = 1;
    B.forEach(b => {
      if (t > b.t0 - 0.12 && t < b.t0 + 0.12) squish = 0.7;
    });
    slime.scale.y = lerp(slime.scale.y, squish, 0.3);
    slime.scale.x = slime.scale.z = lerp(slime.scale.x, 2 - squish, 0.3);

    if (exit(t)) return;
    player.resetPose();

    if (t < 1.0) {
      // 助走してスライムに飛び乗る
      const k = seg(t, 0, 1.0, E.outQuad);
      player.position.set(lerp(-4.5, 0.4, k), Math.sin(seg(t, 0.6, 1.0, E.linear) * Math.PI) * 0.8, lerp(1.2, -0.5, k));
      player.rotation.y = Math.PI / 2 - k * (Math.PI / 2);
      runPose(player, t, { speed: 12 });
    } else if (t < 2.9) {
      // バウンドを繰り返し高度を上げる
      let y = 1.6;
      for (const b of B) {
        if (t >= b.t0 && t < b.t1) {
          const k = (t - b.t0) / (b.t1 - b.t0);
          y = 1.6 + Math.sin(k * Math.PI) * b.h;
          if (b.h > 4) player.rotation.x = -Math.PI * 2 * seg(t, b.t0 + 0.1, b.t1 - 0.1, E.inOutQuad); // 最後は宙返り
        }
      }
      player.position.set(0.4, y, -0.5);
      if (player.rotation.x === 0) jumpRisePose(player, 0.7);
      else tuckPose(player, 0.8);
    } else if (t < T_LAND) {
      // 横に逸れてスーパーヒーロー着地へ
      const k = seg(t, 2.9, T_LAND, E.inQuad);
      player.rotation.x = 0;
      player.position.set(lerp(0.4, -1.4, k), lerp(1.6, 0, k) + Math.sin(k * Math.PI) * 0.5, lerp(-0.5, 1.0, k));
      tuckPose(player, 0.5);
    } else {
      player.position.set(-1.4, 0, 1.0);
      const hold = seg(t, 3.5, 3.9, E.inOutQuad);
      heroLandPose(player, 1 - hold);
      if (hold >= 1) heroPoses[7](player, t);
    }
  };
  return s;
}

// =========================================================
// 63. 精密アスレチック
// =========================================================
function parkourScene(ctx, member, player, color) {
  const s = shell(6.7, ctx);
  const { stage, fx, screen, sfx } = ctx;
  // 浮島(奥から手前へ)
  const PADS = [
    { x: -2.6, y: 2.6, z: -5 }, { x: -0.8, y: 2.2, z: -3.4 },
    { x: 1.2, y: 2.5, z: -2 }, { x: 0.1, y: 1.8, z: -0.4 },
  ];
  const T_GROUND = 2.5;
  let exit;

  s.init = () => {
    stage.setEnv('voidpurple');
    PADS.forEach(p => {
      const b = makeBlock('endstone');
      b.position.set(p.x, p.y - 0.5, p.z);
      stage.props.add(b);
    });
    [0.5, 1.0, 1.5, 2.0].forEach(tt => s.at(tt, () => sfx.whoosh(0.18, 0.3)));
    s.at(1.55, () => sfx.hit(150, 0.4)); // ヒヤッ
    s.at(T_GROUND, () => { sfx.thud(0.8); dust(fx, { x: 0.2, y: 0.1, z: 1.0 }, 26, 2.8); });
    s.at(2.9, () => sfx.hit(420, 0.5));
    addTitleCues(s, member, color, 3.1, 3.7, 5.25);
    exit = makeExit(player, 5.45, ctx, { vx: 1.3, vy: 10.5, vz: 5 });
  };

  s.update = (t, dt) => {
    stage.cam(2.0, 2.6, 5.4, 0, 1.8, -1.5);

    if (exit(t)) return;
    player.resetPose();

    if (t < T_GROUND) {
      // 浮島を跳び渡る(3島目で着地がギリギリ→腕風車)
      const hop = (i, t0, t1) => {
        const k = seg(t, t0, t1, E.linear);
        const a = i === 0 ? { x: -4.2, y: 2.6, z: -6 } : PADS[i - 1];
        const b = PADS[i];
        player.position.set(lerp(a.x, b.x, k), lerp(a.y, b.y, k) + Math.sin(k * Math.PI) * 0.9, lerp(a.z, b.z, k));
        player.rotation.y = Math.atan2(b.x - a.x, b.z - a.z);
        if (k < 1) tuckPose(player, Math.sin(k * Math.PI) * 0.5);
      };
      if (t < 0.5) hop(0, 0.0, 0.5);
      else if (t < 1.0) hop(1, 0.5, 1.0);
      else if (t < 1.5) hop(2, 1.0, 1.5);
      else if (t < 1.85) {
        // 3島目でバランス崩しかける
        player.position.set(PADS[2].x, PADS[2].y, PADS[2].z);
        player.rotation.y = Math.atan2(PADS[3].x - PADS[2].x, PADS[3].z - PADS[2].z);
        crouchPose(player, 0.3);
        player.armR.shoulder.rotation.x = t * 26;
        player.armL.shoulder.rotation.x = -t * 26;
        player.spine.rotation.x = -0.25;
      }
      else if (t < 2.2) hop(3, 1.85, 2.2);
      else {
        // 最後のドロップ
        const k = seg(t, 2.2, T_GROUND, E.inQuad);
        player.position.set(lerp(PADS[3].x, 0.2, k), lerp(PADS[3].y, 0, k), lerp(PADS[3].z, 1.0, k));
        tuckPose(player, 0.5);
      }
    } else {
      player.position.set(0.2, 0, 1.0);
      player.rotation.y = 0;
      const rise = seg(t, 2.6, 2.9, E.outQuad);
      crouchPose(player, 0.7 * (1 - rise));
      if (rise >= 1) heroPoses[6](player, t);
    }
  };
  return s;
}

// =========================================================
// 64. 火球打ち返し
// =========================================================
function ghastScene(ctx, member, player, color) {
  const s = shell(7.0, ctx);
  const { stage, fx, screen, sfx } = ctx;
  const T_SHOOT = 0.8, T_HIT = 1.9, T_BACK = 2.5;
  let exit, ghast, ball;

  s.init = () => {
    stage.setEnv('cave');
    ghast = makeGhast();
    ghast.position.set(-1.5, 4.5, -9);
    stage.props.add(ghast);
    ball = new THREE.Mesh(
      new THREE.SphereGeometry(0.3, 12, 10),
      new THREE.MeshBasicMaterial({ color: 0xffa050 })
    );
    ball.material.toneMapped = false;
    ball.visible = false;
    stage.props.add(ball);
    player.position.set(0.3, 0, 0.8);
    player.rotation.y = Math.PI;
    s.at(0.2, () => sfx.roar(0.7));
    s.at(T_SHOOT, () => { sfx.pop(false); ball.visible = true; });
    s.at(T_HIT, () => {
      sfx.crack();
      sfx.hit(250, 0.8);
      screen.impact(0.2);
      stage.shake(0.15);
      sfx.whoosh(0.5, 0.7);
    });
    s.at(T_BACK, () => {
      // ガストに命中!
      sfx.boom();
      screen.flash('#ffd9a0', 0.2, 0.5);
      ghast.visible = false;
      ball.visible = false;
      fx.fireball({ pos: { x: -1.5, y: 4.5, z: -9 }, r: 2.4, life: 1.4 });
      fx.burst({ pos: { x: -1.5, y: 4.5, z: -9 }, count: 30, colors: ['#e8e8e4', '#ffd9a0'], speed: 4, gravity: -3, life: 1.2, size: 0.12 });
    });
    s.at(3.0, () => sfx.hit(420, 0.5));
    addTitleCues(s, member, color, 3.3, 3.9, 5.45);
    exit = makeExit(player, 5.65, ctx, { vx: 1.3, vy: 10.5, vz: 5 });
  };

  s.update = (t, dt) => {
    stage.cam(1.6, 1.8, 5.4, 0, 1.6, -1.5);

    if (ghast.visible) {
      ghast.wiggle(t);
      ghast.position.y = 4.5 + Math.sin(t * 1.4) * 0.4;
    }
    // 火球: 飛来 → 打ち返されて戻る
    if (ball.visible) {
      if (t < T_HIT) {
        const k = seg(t, T_SHOOT, T_HIT, E.linear);
        ball.position.set(lerp(-1.5, 0.3, k), lerp(4.5, 1.3, k), lerp(-9, 0.5, k));
      } else {
        const k = seg(t, T_HIT, T_BACK, E.inQuad);
        ball.position.set(lerp(0.3, -1.5, k), lerp(1.3, 4.5, k), lerp(0.5, -9, k));
      }
      ball.scale.setScalar(1 + Math.sin(t * 20) * 0.12);
      fx.burst({ pos: { x: ball.position.x, y: ball.position.y, z: ball.position.z }, count: 3, colors: ['#ffa050', '#ffd9a0'], speed: 0.6, gravity: 0, life: 0.4, size: 0.09 });
    }

    if (exit(t)) return;
    player.resetPose();
    player.position.set(0.3, 0, 0.8);

    if (t < T_HIT - 0.35) {
      // 迎え撃つ構え
      player.rotation.y = Math.PI;
      idlePose(player, t);
      player.head.rotation.x = -0.4;
      crouchPose(player, 0.2);
    } else if (t < T_HIT + 0.3) {
      // フルスイングで打ち返す!
      player.rotation.y = Math.PI;
      const k = seg(t, T_HIT - 0.35, T_HIT + 0.1, E.outQuad);
      crouchPose(player, 0.35);
      player.armR.shoulder.rotation.x = lerp(0.9, -2.7, k);
      player.armR.elbow.rotation.x = -0.15;
      player.spine.rotation.y = lerp(-0.5, 0.55, k);
    } else if (t < 3.0) {
      // フォロースルーで見送る
      player.rotation.y = Math.PI;
      idlePose(player, t);
      player.armR.shoulder.rotation.x = -2.7;
      player.spine.rotation.y = 0.5;
      player.head.rotation.x = -0.5;
    } else {
      player.rotation.y = Math.PI * (1 - seg(t, 3.0, 3.3, E.outQuad));
      heroPoses[6](player, t);
    }
  };
  return s;
}

// =========================================================
export const FACTORIES3 = {
  elytra: elytraScene,
  trident: tridentScene,
  warden: wardenScene,
  vineswing: vineswingScene,
  windcharge: windchargeScene,
  mace: maceScene,
  totem: totemScene,
  anvil: anvilScene,
  catcreeper: catcreeperScene,
  slime: slimeScene,
  parkour: parkourScene,
  ghast: ghastScene,
};

// ============================================================
// [scenes4.js より統合]
// ============================================================

// 個人紹介演出 第4弾 x12 (マイクラ縛りなしの「ヒーロー王道」シーン集)

// =========================================================
// 65. 変身シークエンス (エネルギー渦 → 3連ポーズカット)
// =========================================================
function henshinScene(ctx, member, player, color) {
  const s = shell(6.7, ctx);
  const { stage, fx, screen, sfx } = ctx;
  const CUTS = [1.3, 1.7, 2.1];
  const T_FINAL = 2.5;
  let exit;

  s.init = () => {
    stage.setEnv('dark');
    player.position.set(0, 0, 0.4);
    player.rotation.y = 0;
    sfx.riser(1.25);
    CUTS.forEach((tt, i) => {
      s.at(tt, () => {
        sfx.hit(360 + i * 120, 0.6);
        screen.flash(color, 0.1, 0.3);
      });
    });
    s.at(T_FINAL, () => {
      sfx.slam();
      screen.flash('#ffffff', 0.18, 0.6);
      stage.shake(0.12);
      stage.key.intensity = 2.0;
      stage.hemi.intensity = 0.45;
      fx.ring({ pos: { x: 0, y: 0.05, z: 0.4 }, r1: 3.4, life: 0.6, color: new THREE.Color(color).getHex() });
    });
    s.at(2.8, () => {
      fx.bigExplosion({ pos: { x: 4, y: 0.4, z: -16 }, stage, screen, sfx, scale: 1.0 });
    });
    addTitleCues(s, member, color, 3.1, 3.7, 5.15);
    exit = makeExit(player, 5.35, ctx, { vx: 1.3, vy: 10.5, vz: 5 });
  };

  let acc = 0;
  s.update = (t, dt) => {
    const punch = seg(t, T_FINAL, T_FINAL + 0.25, E.outCubic);
    stage.fov = 50 - 6 * punch;
    stage.cam(0.5, 1.5, 4.6, 0, 1.15, 0.4);

    // 変身中のエネルギー渦
    if (t < T_FINAL) {
      acc += dt;
      if (acc > 0.05) {
        acc = 0;
        const a = t * 9;
        fx.burst({
          pos: { x: Math.cos(a) * 0.85, y: 0.2 + (t * 0.8) % 1.8, z: 0.4 + Math.sin(a) * 0.85 },
          count: 4, colors: [color, '#ffffff'], speed: 0.5, dir: { x: 0, y: 1.4, z: 0 },
          gravity: 0.5, life: 0.6, size: 0.09, spread: 0.2,
        });
      }
    }

    if (exit(t)) return;
    player.resetPose();

    if (t < CUTS[0]) {
      // 構えてエネルギーを練る
      crouchPose(player, 0.3);
      player.armR.shoulder.rotation.x = -1.2;
      player.armL.shoulder.rotation.x = -1.2;
      player.armR.elbow.rotation.x = -1.5;
      player.armL.elbow.rotation.x = -1.5;
      player.rotation.y = Math.sin(t * 2.5) * 0.18;
    } else if (t < CUTS[1]) {
      heroPoses[2](player, t); // 指差し
      player.rotation.y = -0.35;
    } else if (t < CUTS[2]) {
      heroPoses[6](player, t); // カラテ構え
      player.rotation.y = 0.3;
    } else if (t < T_FINAL) {
      heroPoses[7](player, t); // 両腕V
      player.rotation.y = 0;
    } else {
      player.rotation.y = 0;
      heroPoses[1](player, t); // 拳を天に(完成)
    }
  };
  return s;
}

// =========================================================
// 66. 気合のオーラ (チャージ → 解放)
// =========================================================
function powerupScene(ctx, member, player, color) {
  const s = shell(6.6, ctx);
  const { stage, fx, screen, sfx } = ctx;
  const T_BURST = 2.0;
  let exit;

  s.init = () => {
    stage.setEnv('street');
    stage.props.add(makeCityline({ z: -32 }));
    player.position.set(0, 0, 0.4);
    player.rotation.y = 0;
    sfx.riser(1.9);
    s.at(T_BURST, () => {
      sfx.boom();
      sfx.slam();
      screen.flash('#ffffff', 0.25, 0.85);
      stage.shake(0.3);
      fx.ring({ pos: { x: 0, y: 0.06, z: 0.4 }, r1: 5, life: 0.7, color: new THREE.Color(color).getHex() });
      fx.burst({
        pos: { x: 0, y: 1, z: 0.4 }, count: 60, colors: [color, '#ffffff', '#fff7c8'],
        speed: 6, gravity: -2, life: 1.2, size: 0.11, drag: 1.4,
      });
      fx.debris({ pos: { x: 0, y: 0.2, z: 0.4 }, count: 12, colors: [0x3c3f48, 0x5e6168], size: 0.12, speed: 5, life: 1.3 });
    });
    s.at(2.4, () => sfx.hit(440, 0.5));
    addTitleCues(s, member, color, 2.9, 3.5, 5.05);
    exit = makeExit(player, 5.25, ctx, { vx: -1.3, vy: 10.5, vz: 5 });
  };

  let acc = 0;
  s.update = (t, dt) => {
    const punch = seg(t, T_BURST, T_BURST + 0.3, E.outCubic);
    stage.fov = 50 - 7 * punch;
    stage.cam(0.6, 1.4, 4.8, 0, 1.05, 0.4);

    // チャージ中: オーラ上昇 + 小石が浮く + 揺れが強まる
    if (t < T_BURST) {
      const k = t / T_BURST;
      acc += dt;
      if (acc > 0.08 - k * 0.05) {
        acc = 0;
        fx.burst({
          pos: { x: rand(-0.7, 0.7), y: 0.15, z: 0.4 + rand(-0.7, 0.7) },
          count: 3, colors: [color, '#ffffff'], speed: 0.4,
          dir: { x: 0, y: 2.2 + k * 2, z: 0 }, gravity: 0.4, life: 0.7, size: 0.08, spread: 0.25,
        });
      }
      if (Math.random() < k * 0.3) stage.shake(0.03);
    }

    if (exit(t)) return;
    player.resetPose();

    if (t < T_BURST) {
      // 拳を固めて唸るチャージ
      const k = t / T_BURST;
      crouchPose(player, 0.45);
      player.armR.shoulder.rotation.x = 0.5;
      player.armL.shoulder.rotation.x = 0.5;
      player.armR.elbow.rotation.x = -1.9;
      player.armL.elbow.rotation.x = -1.9;
      player.head.rotation.x = 0.3 - k * 0.1;
      player.spine.rotation.x = 0.35;
      player.position.y = Math.random() * 0.015 * k; // 震え
    } else {
      player.position.y = 0;
      const k = seg(t, T_BURST, T_BURST + 0.3, E.outBack);
      if (k < 1) {
        // 解放の伸び上がり
        player.armR.shoulder.rotation.x = -2.8 * k;
        player.armL.shoulder.rotation.x = -2.8 * k;
        player.armR.shoulder.rotation.z = -0.5 * k;
        player.armL.shoulder.rotation.z = 0.5 * k;
        player.spine.rotation.x = -0.18 * k;
        player.head.rotation.x = -0.45 * k;
      } else {
        heroPoses[1](player, t);
      }
    }
  };
  return s;
}

// =========================================================
// 67. 爆発を背に (振り返らない・個人版)
// =========================================================
function coolbackScene(ctx, member, player, color) {
  const s = shell(6.7, ctx);
  const { stage, fx, screen, sfx } = ctx;
  const T_STOP = 2.6;
  let exit;

  s.init = () => {
    stage.setEnv('nightcity');
    stage.props.add(makeCityline({ z: -30 }));
    player.position.set(0, 0, -6);
    player.rotation.y = 0;
    s.at(1.0, () => fx.bigExplosion({ pos: { x: -3, y: 0.4, z: -15 }, stage, screen, sfx, scale: 1.7 }));
    s.at(1.8, () => fx.bigExplosion({ pos: { x: 5, y: 0.3, z: -13 }, stage, screen, sfx, scale: 1.1 }));
    s.at(T_STOP + 0.3, () => sfx.hit(420, 0.5));
    addTitleCues(s, member, color, 3.0, 3.6, 5.15);
    exit = makeExit(player, 5.35, ctx, { vx: 1.3, vy: 10.5, vz: 5 });
  };

  s.update = (t, dt) => {
    stage.cam(0.4, 1.1, 5.2, 0, 1.25, -2);

    if (exit(t)) return;
    player.resetPose();

    if (t < T_STOP) {
      // 爆発に目もくれずゆっくり歩く
      player.position.z = lerp(-6, 0.8, seg(t, 0, T_STOP, E.linear));
      runPose(player, t, { speed: 5, amp: 0.45, lean: 0.05 });
      player.head.rotation.x = -0.03;
      player.head.rotation.y = 0;
    } else {
      player.position.z = 0.8;
      const up = seg(t, T_STOP, T_STOP + 0.35, E.outQuad);
      if (up >= 1) heroPoses[0](player, t);
      else idlePose(player, t);
    }
  };
  return s;
}

// =========================================================
// 68. 摩天楼の影 (高所の月背負いシルエット → 飛び降り)
// =========================================================
function rooftopScene(ctx, member, player, color) {
  const s = shell(6.9, ctx);
  const { stage, fx, screen, sfx } = ctx;
  const TOWER_H = 7;
  const T_JUMP = 1.9, T_LAND = 2.45;
  let exit;

  s.init = () => {
    stage.setEnv('nightcity');
    stage.props.add(makeCityline({ z: -30 }));
    // 月
    const moon = new THREE.Mesh(
      new THREE.CircleGeometry(5, 32),
      new THREE.MeshBasicMaterial({ color: 0xfff3cf, transparent: true, opacity: 0.95 })
    );
    moon.material.toneMapped = false;
    moon.position.set(-6, 14, -40);
    stage.props.add(moon);
    // ビル(塔)
    for (let y = 0; y < TOWER_H; y++) {
      const b = makeBlock('deepslate');
      b.position.set(0, y + 0.5, -2);
      stage.props.add(b);
    }
    player.position.set(0, TOWER_H, -2);
    player.rotation.y = 0;
    s.at(T_JUMP, () => sfx.whoosh(0.5, 0.6));
    s.at(T_LAND, () => {
      sfx.thud(1.0);
      stage.shake(0.25);
      dust(fx, { x: 0, y: 0.1, z: 0.6 }, 36, 3.6);
      fx.ring({ pos: { x: 0, y: 0.04, z: 0.6 }, r1: 3.4, life: 0.6, color: 0x9fc0ff });
    });
    s.at(3.0, () => sfx.hit(420, 0.5));
    addTitleCues(s, member, color, 3.3, 3.9, 5.35);
    exit = makeExit(player, 5.55, ctx, { vx: 1.3, vy: 10.5, vz: 5 });
  };

  s.update = (t, dt) => {
    // カメラ: 下から見上げてゆっくり上昇 → 着地で地上へ
    const rise = seg(t, 0, T_JUMP, E.inOutQuad);
    const down = seg(t, T_JUMP, T_LAND + 0.3, E.inOutQuad);
    stage.cam(
      1.6, lerp(1.0, 4.5, rise) - down * 3.4, lerp(6.5, 5.5, rise) - down * 0.5,
      0, lerp(TOWER_H - 1, TOWER_H + 0.8, rise) - down * TOWER_H, lerp(-2, -1.2, rise)
    );

    if (exit(t)) return;
    player.resetPose();

    if (t < T_JUMP) {
      // 屋上で腕組みシルエット(コートのように揺れる微モーション)
      player.position.set(0, TOWER_H, -2);
      heroPoses[0](player, t);
      player.head.rotation.x = 0.12; // 下界を見下ろす
    } else if (t < T_LAND) {
      const k = seg(t, T_JUMP, T_LAND, E.inQuad);
      player.position.set(0, TOWER_H * (1 - k), lerp(-2, 0.6, k));
      tuckPose(player, 0.5 + k * 0.3);
    } else {
      player.position.set(0, 0, 0.6);
      const hold = seg(t, 2.65, 3.0, E.inOutQuad);
      heroLandPose(player, 1 - hold);
      if (hold >= 1) heroPoses[4](player, t); // 片膝キメ
    }
  };
  return s;
}

// =========================================================
// 69. 振り向きの漢 (スロー振り返り)
// =========================================================
function slowturnScene(ctx, member, player, color) {
  const s = shell(6.9, ctx);
  const { stage, fx, screen, sfx } = ctx;
  const T_STOP = 1.6, T_TURN0 = 2.0, T_TURN1 = 3.0;
  let exit;

  s.init = () => {
    stage.setEnv('sunset');
    player.position.set(0, 0, 1.2);
    player.rotation.y = Math.PI; // 背中を向けて歩き去る
    s.at(T_TURN1, () => {
      sfx.slam();
      screen.flash('#ffd9a0', 0.12, 0.3);
    });
    addTitleCues(s, member, color, 3.3, 3.9, 5.35);
    exit = makeExit(player, 5.55, ctx, { vx: 1.3, vy: 10.5, vz: 5 });
  };

  let acc = 0;
  s.update = (t, dt) => {
    const punch = seg(t, T_TURN1, T_TURN1 + 0.3, E.outCubic);
    stage.fov = 50 - 6 * punch;
    stage.cam(0.5, 1.45, 4.4, 0, 1.25, 0);

    // 夕陽の風(横切る粒)
    acc += dt;
    if (acc > 0.25) {
      acc = 0;
      fx.burst({
        pos: { x: 3, y: rand(0.5, 1.8), z: rand(-0.5, 1.5) }, count: 3,
        colors: ['#ffd9a0', '#ff8a4c'], speed: 3, dir: { x: -1, y: 0.05, z: 0 },
        gravity: 0, life: 1.2, size: 0.06, spread: 0.1, additive: false,
      });
    }

    if (exit(t)) return;
    player.resetPose();

    if (t < T_STOP) {
      // 去っていく背中
      player.position.z = lerp(1.2, -0.6, seg(t, 0, T_STOP, E.linear));
      player.rotation.y = Math.PI;
      runPose(player, t, { speed: 4.8, amp: 0.42, lean: 0.04 });
    } else if (t < T_TURN1) {
      // 立ち止まり…ゆっくり振り向く
      player.position.z = -0.6;
      player.rotation.y = Math.PI * (1 - seg(t, T_TURN0, T_TURN1, E.inOutQuad));
      idlePose(player, t);
      // 顔から先に振り向く
      player.head.rotation.y = Math.sin(seg(t, T_TURN0 - 0.3, T_TURN0 + 0.3, E.inOutQuad) * Math.PI) * 0.6;
    } else {
      player.position.z = -0.6;
      player.rotation.y = 0;
      heroPoses[0](player, t);
    }
  };
  return s;
}

// =========================================================
// 70. スライディング登場
// =========================================================
function slideScene(ctx, member, player, color) {
  const s = shell(6.3, ctx);
  const { stage, fx, screen, sfx } = ctx;
  const T_SLIDE = 0.9, T_STOP = 1.7;
  let exit;

  s.init = () => {
    stage.setEnv('street');
    stage.props.add(makeCityline({ z: -32 }));
    player.position.set(-7.5, 0, 0.4);
    player.rotation.y = Math.PI / 2;
    screen.setSpeed(0.45);
    s.at(T_SLIDE, () => { sfx.whoosh(0.7, 0.6); sfx.fuse(0.7); });
    s.at(T_STOP, () => { screen.setSpeed(0); dust(fx, { x: 0.4, y: 0.1, z: 0.4 }, 22, 2.4); });
    s.at(2.2, () => sfx.hit(420, 0.5));
    addTitleCues(s, member, color, 2.6, 3.2, 4.75);
    exit = makeExit(player, 4.95, ctx, { vx: 1.3, vy: 10.5, vz: 5 });
  };

  s.update = (t, dt) => {
    stage.cam(0.8, 1.4, 4.8, 0, 0.95, 0.3);

    if (exit(t)) return;
    player.resetPose();

    if (t < T_SLIDE) {
      player.position.set(lerp(-7.5, -2.2, seg(t, 0, T_SLIDE, E.linear)), 0, 0.4);
      runPose(player, t, { speed: 13.5, amp: 1.05 });
    } else if (t < T_STOP) {
      // 膝スライド(火花を散らして減速)
      const k = seg(t, T_SLIDE, T_STOP, E.outCubic);
      player.position.set(lerp(-2.2, 0.4, k), 0, 0.4);
      player.hips.position.y = 12 / 16 - 0.42;
      player.spine.rotation.x = -0.3;
      player.legR.hip.rotation.x = -0.5;
      player.legR.knee.rotation.x = 2.2;
      player.legL.hip.rotation.x = -1.7;
      player.legL.knee.rotation.x = 0.6;
      player.armR.shoulder.rotation.x = 0.9; // 片手を地面に
      player.armL.shoulder.rotation.x = -1.4;
      player.armL.shoulder.rotation.z = 0.4;
      player.head.rotation.x = -0.2;
      if (Math.random() < 0.7) {
        fx.burst({
          pos: { x: player.position.x - 0.3, y: 0.1, z: 0.5 }, count: 5,
          colors: ['#ffd98a', '#ff9a2a', '#fff2c0'], speed: 1.8,
          dir: { x: -1, y: 0.5, z: 0 }, gravity: -4, life: 0.4, size: 0.06,
        });
      }
    } else {
      player.position.set(0.4, 0, 0.4);
      player.rotation.y = lerp(Math.PI / 2, 0, seg(t, T_STOP + 0.15, 2.2, E.inOutQuad));
      const up = seg(t, T_STOP + 0.15, 2.2, E.outQuad);
      crouchPose(player, 0.8 * (1 - up));
      if (up >= 1) heroPoses[6](player, t);
    }
  };
  return s;
}

// =========================================================
// 71. 拳の受け止め
// =========================================================
function catchfistScene(ctx, member, player, color) {
  const s = shell(6.8, ctx);
  const { stage, fx, screen, sfx } = ctx;
  const T_SWING = 1.1, T_CATCH = 1.25, T_SHOVE = 2.1;
  let exit, zombie;

  s.init = () => {
    stage.setEnv('nightcity');
    zombie = new PlayerModel(makeZombieSkin());
    zombie.position.set(0.45, 0, -7);
    zombie.rotation.y = 0;
    stage.props.add(zombie);
    player.position.set(-0.45, 0, 0.8);
    player.rotation.y = Math.PI; // 迎え撃つ
    s.at(T_SWING, () => sfx.whoosh(0.25, 0.5));
    s.at(T_CATCH, () => {
      sfx.clang();
      sfx.hit(200, 0.8);
      screen.impact(0.22);
      stage.shake(0.15);
      fx.ring({ pos: { x: 0, y: 1.3, z: -0.2 }, r1: 1.6, life: 0.45, color: 0xffffff });
    });
    s.at(T_SHOVE, () => {
      sfx.whoosh(0.4, 0.6);
      sfx.thud(0.7);
    });
    s.at(T_SHOVE + 0.7, () => sfx.thud(0.8));
    s.at(2.9, () => sfx.hit(420, 0.5));
    addTitleCues(s, member, color, 3.2, 3.8, 5.25);
    exit = makeExit(player, 5.45, ctx, { vx: 1.3, vy: 10.5, vz: 5 });
  };

  s.update = (t, dt) => {
    stage.cam(1.5, 1.5, 4.4, 0, 1.25, 0);

    // ゾンビ: 突進 → 渾身のパンチ → 受け止められて押し返され転倒
    zombie.resetPose();
    if (t < T_SWING) {
      zombie.position.z = lerp(-7, -0.4, seg(t, 0, T_SWING, E.outQuad));
      runPose(zombie, t, { speed: 11, amp: 0.9 });
      zombie.armR.shoulder.rotation.x = -1.4;
      zombie.armL.shoulder.rotation.x = -1.4;
    } else if (t < T_SHOVE) {
      zombie.position.z = -0.4;
      // パンチが受け止められたまま、もがく
      zombie.armR.shoulder.rotation.x = -1.55;
      zombie.armR.elbow.rotation.x = -0.1;
      zombie.armL.shoulder.rotation.x = -0.7 + Math.sin(t * 16) * 0.3;
      zombie.spine.rotation.x = 0.25;
      zombie.legR.hip.rotation.x = -0.4;
      zombie.legR.knee.rotation.x = 0.5;
      zombie.position.x = 0.45 + Math.sin(t * 22) * 0.02;
    } else {
      // 押し返されて吹っ飛び、仰向けに
      const k = seg(t, T_SHOVE, T_SHOVE + 0.7, E.outQuad);
      zombie.position.set(0.45 + k * 1.1, Math.sin(Math.min(1, k * 1.2) * Math.PI) * 0.7, -0.4 - k * 3.4);
      zombie.rotation.x = -Math.PI / 2 * Math.min(1, k * 1.4);
    }

    if (exit(t)) return;
    player.resetPose();
    player.position.set(-0.45, 0, 0.8);
    player.rotation.y = Math.PI;

    if (t < T_CATCH) {
      // 不動で待つ
      idlePose(player, t);
    } else if (t < T_SHOVE) {
      // 片手キャッチ(微動だにしない)
      crouchPose(player, 0.12);
      player.armR.shoulder.rotation.x = -1.45;
      player.armR.elbow.rotation.x = -0.15;
      player.armL.shoulder.rotation.x = 0.3;
      player.head.rotation.x = 0.05;
    } else if (t < 2.9) {
      // 払い飛ばしたフォロースルー
      idlePose(player, t);
      player.armR.shoulder.rotation.x = -0.8;
      player.armR.shoulder.rotation.z = -0.9;
      player.spine.rotation.y = -0.3;
    } else {
      player.rotation.y = Math.PI * (1 - seg(t, 2.9, 3.2, E.outQuad));
      heroPoses[3](player, t);
    }
  };
  return s;
}

// =========================================================
// 72. 夕陽の決闘 (すれ違いざまの一閃)
// =========================================================
function standoffScene(ctx, member, player, color) {
  const s = shell(7.0, ctx);
  const { stage, fx, screen, sfx } = ctx;
  const T_DASH = 1.4, T_CROSS = 1.7, T_LAND = 1.95, T_FALL = 2.7;
  let exit, rival;

  s.init = () => {
    stage.setEnv('sunset');
    rival = new PlayerModel(makeSkeletonSkin());
    rival.position.set(2.8, 0, 0);
    rival.rotation.y = -Math.PI / 2;
    stage.props.add(rival);
    player.position.set(-2.8, 0, 0);
    player.rotation.y = Math.PI / 2;
    s.at(T_DASH, () => { sfx.whoosh(0.4, 0.7); screen.setSpeed(0.6); });
    s.at(T_CROSS, () => {
      sfx.hit(180, 0.9);
      sfx.clang();
      screen.impact(0.2);
      screen.flash('#fff7c8', 0.1, 0.4);
      stage.shake(0.15);
    });
    s.at(T_LAND, () => screen.setSpeed(0));
    s.at(T_FALL, () => sfx.thud(0.9));
    s.at(3.3, () => sfx.hit(420, 0.5));
    addTitleCues(s, member, color, 3.5, 4.1, 5.45);
    exit = makeExit(player, 5.65, ctx, { vx: 1.3, vy: 10.5, vz: 5 });
  };

  let acc = 0;
  s.update = (t, dt) => {
    stage.cam(0, 1.3, 5.6, 0, 1.1, 0);

    // 風の砂塵
    acc += dt;
    if (t < T_DASH && acc > 0.3) {
      acc = 0;
      fx.burst({
        pos: { x: 4, y: rand(0.2, 1), z: rand(-1, 1.5) }, count: 4,
        colors: ['#d8b078', '#c89c60'], speed: 2.6, dir: { x: -1, y: 0.05, z: 0 },
        gravity: -0.5, life: 1.3, size: 0.06, spread: 0.1, additive: false,
      });
    }

    // ライバル(スケルトン)
    rival.resetPose();
    if (t < T_DASH) {
      rival.position.x = 2.8;
      idlePose(rival, t);
      crouchPose(rival, 0.15);
    } else if (t < T_LAND) {
      const k = seg(t, T_DASH, T_LAND, E.inOutQuad);
      rival.position.x = lerp(2.8, -2.2, k);
      runPose(rival, t, { speed: 14, amp: 1.0 });
      rival.armR.shoulder.rotation.x = -1.8;
    } else if (t < T_FALL) {
      rival.position.x = -2.2;
      idlePose(rival, t);
    } else {
      // 一拍おいて倒れる
      const k = seg(t, T_FALL, T_FALL + 0.4, E.inQuad);
      rival.position.x = -2.2;
      rival.position.y = 0.16 * k;
      rival.rotation.x = -Math.PI / 2 * k;
    }

    if (exit(t)) return;
    player.resetPose();

    if (t < T_DASH) {
      // 対峙の構え
      player.position.x = -2.8;
      crouchPose(player, 0.2);
      player.armR.shoulder.rotation.x = -0.9;
      player.armR.elbow.rotation.x = -1.0;
    } else if (t < T_LAND) {
      // 交錯ダッシュ(すれ違いざまに一撃)
      const k = seg(t, T_DASH, T_LAND, E.inOutQuad);
      player.position.x = lerp(-2.8, 2.2, k);
      runPose(player, t, { speed: 14, amp: 1.0 });
      if (t > T_CROSS - 0.12) {
        player.armR.shoulder.rotation.x = -1.6;
        player.armR.elbow.rotation.x = -0.1;
        player.spine.rotation.y = -0.4;
      }
    } else {
      // 背を向けて静止 → 残心
      player.position.x = 2.2;
      player.rotation.y = Math.PI / 2;
      if (t < 3.3) {
        crouchPose(player, 0.25);
        player.armR.shoulder.rotation.x = -0.6;
        player.armR.shoulder.rotation.z = -0.7;
        player.spine.rotation.y = -0.2;
      } else {
        player.rotation.y = Math.PI / 2 - seg(t, 3.3, 3.6, E.outQuad) * (Math.PI / 2);
        heroPoses[6](player, t);
      }
    }
  };
  return s;
}

// =========================================================
// 73. 残像回避
// =========================================================
function afterimageScene(ctx, member, player, color) {
  const s = shell(7.0, ctx);
  const { stage, fx, screen, sfx } = ctx;
  const SWINGS = [0.8, 1.4, 2.0];
  const SPOTS = [[-0.7, 0.9], [0.9, 0.7], [-0.4, 1.6], [0.5, -1.3]]; // 最後は背後
  const T_PUSH = 2.6, T_ZFALL = 2.9;
  let exit, zombie;
  const ghosts = [];

  s.init = () => {
    stage.setEnv('dark');
    zombie = new PlayerModel(makeZombieSkin());
    zombie.position.set(0, 0, -0.6);
    zombie.rotation.y = 0;
    stage.props.add(zombie);
    // 残像用ゴースト
    const skin = { canvas: player.tex.image, slim: player.slim };
    for (let i = 0; i < 2; i++) {
      const g = new PlayerModel(skin);
      g.matBase.transparent = true;
      g.matBase.opacity = 0.4;
      g.matBase.color.setRGB(0.5, 0.6, 1.2);
      g.matOverlay.opacity = 0.3;
      g.visible = false;
      stage.props.add(g);
      ghosts.push({ model: g, t0: -1 });
    }
    player.position.set(SPOTS[0][0], 0, SPOTS[0][1]);
    player.rotation.y = Math.PI;

    SWINGS.forEach((tt, i) => {
      s.at(tt, () => sfx.whoosh(0.25, 0.55));
      s.at(tt + 0.08, () => {
        sfx.pop(true);
        // 今いた場所に残像を置いて瞬間移動
        const g = ghosts[i % 2];
        g.model.visible = true;
        g.model.position.copy(player.position);
        g.model.rotation.y = player.rotation.y;
        g.model.resetPose();
        crouchPose(g.model, 0.4);
        g.t0 = tt + 0.08;
      });
    });
    s.at(T_PUSH, () => sfx.hit(260, 0.6));
    s.at(T_ZFALL + 0.25, () => sfx.thud(0.8));
    s.at(3.3, () => sfx.hit(420, 0.5));
    addTitleCues(s, member, color, 3.5, 4.1, 5.45);
    exit = makeExit(player, 5.65, ctx, { vx: 1.3, vy: 10.5, vz: 5 });
  };

  s.update = (t, dt) => {
    stage.cam(1.2, 1.6, 4.8, 0, 1.1, 0);
    screen.setSpeed(t > 0.6 && t < 2.4 ? 0.3 : 0);

    // 残像は縮みながら消える
    ghosts.forEach(g => {
      if (!g.model.visible || g.t0 < 0) return;
      const k = (t - g.t0) / 0.45;
      if (k >= 1) { g.model.visible = false; return; }
      g.model.scale.setScalar(Math.max(0.01, 1 - k));
      g.model.position.y = -k * 0.4;
    });

    // ゾンビ: 3回スイング → 背後を取られ押されて倒れる
    zombie.resetPose();
    if (t < T_PUSH) {
      // プレイヤーの方を向いて殴りかかる
      const px = player.position.x, pz = player.position.z;
      zombie.rotation.y = Math.atan2(px - zombie.position.x, pz - zombie.position.z);
      const swinging = SWINGS.some(tt => t > tt - 0.18 && t < tt + 0.18);
      if (swinging) {
        zombie.armR.shoulder.rotation.x = -1.9;
        zombie.armR.elbow.rotation.x = -0.1;
        zombie.spine.rotation.y = -0.35;
        zombie.spine.rotation.x = 0.2;
      } else {
        runPose(zombie, t * 0.6, { speed: 7, amp: 0.25, lean: 0.1 });
        zombie.armR.shoulder.rotation.x = -1.3;
        zombie.armL.shoulder.rotation.x = -1.3;
      }
    } else {
      // 背後からつつかれて前のめりに倒れる
      const k = seg(t, T_PUSH + 0.15, T_ZFALL + 0.25, E.inQuad);
      zombie.rotation.y = 0;
      zombie.position.y = 0.16 * k;
      zombie.position.z = -0.6 - k * 0.5;
      zombie.rotation.x = Math.PI / 2 * k;
    }

    if (exit(t)) return;
    player.resetPose();

    // 現在のスポット(スイングのたびに移動済み)
    let spot = 0;
    SWINGS.forEach((tt, i) => { if (t > tt + 0.08) spot = i + 1; });
    const [sx, sz] = SPOTS[spot];
    player.position.set(sx, 0, sz);
    player.rotation.y = Math.atan2(zombie.position.x - sx, zombie.position.z - sz);

    if (t < T_PUSH) {
      crouchPose(player, 0.25);
      player.armR.shoulder.rotation.x = -0.7;
      player.armR.elbow.rotation.x = -1.2;
      player.armL.shoulder.rotation.x = -0.5;
      player.armL.elbow.rotation.x = -1.0;
    } else if (t < 3.3) {
      // 背後からチョン、と押す
      const k = seg(t, T_PUSH, T_PUSH + 0.2, E.outQuad);
      player.armR.shoulder.rotation.x = -1.3 * k;
      player.armR.elbow.rotation.x = -0.2;
      idlePoseSafe(player, t, k);
    } else {
      player.rotation.y = 0; // カメラへ向き直ってキメ
      heroPoses[0](player, t);
    }
  };
  return s;
}

function idlePoseSafe(p, t, armK) {
  const b = Math.sin(t * 2.2);
  p.spine.rotation.x = 0.02 + b * 0.012;
  p.armL.shoulder.rotation.z = 0.05;
  if (armK < 0.5) p.armR.shoulder.rotation.z = -0.05;
}

// =========================================================
// 74. 落石キャッチ
// =========================================================
function debriscatchScene(ctx, member, player, color) {
  const s = shell(7.3, ctx);
  const { stage, fx, screen, sfx } = ctx;
  const T_FALL = 0.9, T_CATCH = 1.25, T_TOSS = 2.3, T_CRASH = 2.75;
  let exit, rock;

  s.init = () => {
    stage.setEnv('cave');
    rock = makeBlock('stone', 1.7);
    rock.position.set(0, 9, 0.35);
    stage.props.add(rock);
    // 予兆の振動
    for (const tt of [0.2, 0.5, 0.75]) {
      s.at(tt, () => { sfx.crack(); stage.shake(0.07); });
    }
    s.at(T_CATCH, () => {
      sfx.clang();
      sfx.thud(1.0);
      stage.shake(0.3);
      screen.impact(0.2);
      dust(fx, { x: 0, y: 1.8, z: 0.35 }, 26, 2.6);
    });
    s.at(T_TOSS, () => sfx.whoosh(0.5, 0.6));
    s.at(T_CRASH, () => {
      sfx.boom();
      stage.shake(0.2);
      fx.debris({ pos: { x: -3.4, y: 0.4, z: -0.6 }, count: 18, colors: [0x7d8088, 0x5e6168], size: 0.18, speed: 5, life: 1.5 });
      dust(fx, { x: -3.4, y: 0.3, z: -0.6 }, 30, 3);
    });
    s.at(3.6, () => sfx.hit(420, 0.5));
    addTitleCues(s, member, color, 3.8, 4.4, 5.85);
    exit = makeExit(player, 6.05, ctx, { vx: 1.3, vy: 10.5, vz: 5 });
  };

  s.update = (t, dt) => {
    stage.cam(1.2, 1.6, 5.0, 0, 1.3, 0.3);

    // 岩: 落下 → 頭上キャッチ → 放り投げ
    if (rock.visible) {
      if (t < T_FALL) {
        rock.position.set(0, 9, 0.35);
      } else if (t < T_CATCH) {
        const k = seg(t, T_FALL, T_CATCH, E.inQuad);
        rock.position.y = lerp(9, 2.6, k);
        rock.rotation.x = k * 0.8;
      } else if (t < T_TOSS) {
        rock.position.set(0, 2.6, 0.35);
      } else if (t < T_CRASH + 0.3) {
        const k = seg(t, T_TOSS, T_CRASH, E.linear);
        rock.position.set(lerp(0, -3.4, k), 2.6 + Math.sin(k * Math.PI) * 1.4 - k * 2.2, lerp(0.35, -0.6, k));
        rock.rotation.z = k * 4;
        if (k >= 1) rock.visible = false;
      }
    }

    if (exit(t)) return;
    player.resetPose();
    player.position.set(0, 0, 0.4);

    if (t < T_FALL) {
      // 上を見上げる(何か来る…!)
      idlePose(player, t);
      player.head.rotation.x = -0.7;
    } else if (t < T_CATCH) {
      // 構え
      crouchPose(player, 0.3);
      player.armR.shoulder.rotation.x = -2.9;
      player.armL.shoulder.rotation.x = -2.9;
      player.head.rotation.x = -0.6;
    } else if (t < T_TOSS) {
      // 頭上で受け止める(踏ん張り)
      const settle = seg(t, T_CATCH, T_CATCH + 0.25, E.outQuad);
      crouchPose(player, 0.55 - settle * 0.15);
      player.armR.shoulder.rotation.x = -2.95;
      player.armL.shoulder.rotation.x = -2.95;
      player.head.rotation.x = -0.5;
    } else if (t < 3.6) {
      // 放り投げて手を払う
      const k = seg(t, T_TOSS, T_TOSS + 0.3, E.outQuad);
      idlePose(player, t);
      player.armR.shoulder.rotation.x = lerp(-2.95, -0.6, k);
      player.armL.shoulder.rotation.x = lerp(-2.95, -0.4, k);
      player.spine.rotation.y = -0.3 * k;
      if (t > 3.0) {
        // パンパンと手を払う
        player.spine.rotation.y = 0;
        player.armR.shoulder.rotation.x = -1.1;
        player.armL.shoulder.rotation.x = -1.1;
        player.armR.elbow.rotation.x = -1.2 + Math.sin(t * 14) * 0.25;
        player.armL.elbow.rotation.x = -1.2 - Math.sin(t * 14) * 0.25;
      }
    } else {
      heroPoses[3](player, t);
    }
  };
  return s;
}

// =========================================================
// 75. 挑発の構え (おいでおいで)
// =========================================================
function beckonScene(ctx, member, player, color) {
  const s = shell(6.5, ctx);
  const { stage, fx, screen, sfx } = ctx;
  const BECKONS = [1.4, 2.0];
  let exit;

  s.init = () => {
    stage.setEnv('voidpurple');
    player.position.set(0, 0, 1.2);
    player.rotation.y = 0;
    BECKONS.forEach((tt, i) => {
      s.at(tt, () => sfx.hit(500 + i * 160, 0.45));
    });
    s.at(BECKONS[1], () => {
      screen.impact(0.16);
      stage.shake(0.06);
    });
    s.at(2.6, () => sfx.hit(420, 0.5));
    addTitleCues(s, member, color, 2.9, 3.5, 4.95);
    exit = makeExit(player, 5.15, ctx, { vx: -1.3, vy: 10.5, vz: 5 });
  };

  s.update = (t, dt) => {
    const punch = seg(t, BECKONS[1], BECKONS[1] + 0.25, E.outCubic) * 0.6
      + seg(t, 2.6, 2.9, E.outCubic) * 0.4;
    stage.fov = 48 - 5 * punch;
    // 上半身ドアップ → キメで少し引く
    const back = seg(t, 2.6, 3.0, E.inOutQuad);
    stage.cam(0.5 - back * 0.2, 1.45, 3.0 + back * 1.4, 0, 1.3 - back * 0.2, 1.2);

    if (exit(t)) return;
    player.resetPose();

    if (t < 0.8) {
      // 二歩だけ歩み出る
      player.position.z = lerp(0.4, 1.2, seg(t, 0, 0.8, E.outQuad));
      runPose(player, t, { speed: 5, amp: 0.4, lean: 0.05 });
    } else {
      player.position.z = 1.2;
      // カラテ構えから「来いよ」
      crouchPose(player, 0.18);
      player.armL.shoulder.rotation.x = -0.7;
      player.armL.elbow.rotation.x = -1.2;
      player.spine.rotation.y = 0.25;
      player.head.rotation.y = -0.22;
      player.head.rotation.x = 0.06;
      // 右手: 前に出して指をクイクイ
      player.armR.shoulder.rotation.x = -1.35;
      let curl = -0.35;
      BECKONS.forEach(tt => {
        const k = clamp01((t - tt) / 0.3);
        if (k > 0 && k < 1) curl = -0.35 - Math.sin(k * Math.PI * 2) * 0.45;
      });
      player.armR.elbow.rotation.x = curl;
      if (t > 2.6) heroPoses[6](player, t);
    }
  };
  return s;
}

// =========================================================
// 76. 三角飛び
// =========================================================
function walljumpScene(ctx, member, player, color) {
  const s = shell(6.8, ctx);
  const { stage, fx, screen, sfx } = ctx;
  // 壁キックの時刻と位置(左右交互に上昇)
  const KICKS = [
    { t0: 1.0, x: -1.45, y: 1.3 },
    { t0: 1.35, x: 1.45, y: 2.3 },
    { t0: 1.7, x: -1.45, y: 3.3 },
  ];
  const T_FLIP0 = 1.7, T_FLIP1 = 2.25;
  let exit;

  s.init = () => {
    stage.setEnv('street');
    // 両側の壁
    for (const sx of [-1, 1]) {
      for (let y = 0; y < 5; y++) {
        const b = makeBlock(y % 2 ? 'stone' : 'deepslate');
        b.position.set(sx * 2.0, y + 0.5, 0);
        stage.props.add(b);
      }
    }
    player.position.set(0, 0, -6);
    player.rotation.y = 0;
    KICKS.forEach(k => {
      s.at(k.t0, () => {
        sfx.whoosh(0.22, 0.5);
        sfx.thud(0.35);
        dust(fx, { x: k.x, y: k.y, z: 0 }, 10, 1.6);
      });
    });
    s.at(T_FLIP1, () => { sfx.thud(0.85); dust(fx, { x: 0, y: 0.1, z: 0.7 }, 26, 2.8); });
    s.at(2.7, () => sfx.hit(420, 0.5));
    addTitleCues(s, member, color, 3.0, 3.6, 5.15);
    exit = makeExit(player, 5.35, ctx, { vx: 1.3, vy: 10.5, vz: 5 });
  };

  s.update = (t, dt) => {
    const up = seg(t, 0.9, T_FLIP0, E.inOutQuad) - seg(t, T_FLIP0, T_FLIP1, E.inOutQuad);
    stage.cam(0.9, 1.4 + up * 1.6, 5.4, 0, 1.0 + up * 2.0, 0.2);

    if (exit(t)) return;
    player.resetPose();

    if (t < 1.0) {
      // 壁の間へ走り込む
      player.position.set(0, 0, lerp(-6, 0, seg(t, 0, 1.0, E.outQuad)));
      runPose(player, t, { speed: 12.5 });
    } else if (t < T_FLIP0) {
      // 左右の壁を蹴って上昇
      let from = { x: 0, y: 0 }, to = KICKS[0], t0 = 1.0, t1 = KICKS[0].t0;
      for (let i = 0; i < KICKS.length; i++) {
        if (t >= KICKS[i].t0 && i < KICKS.length - 1) {
          from = KICKS[i]; to = KICKS[i + 1];
          t0 = KICKS[i].t0; t1 = KICKS[i + 1].t0;
        }
      }
      const k = seg(t, t0, t1, E.linear);
      player.position.set(lerp(from.x * 0.8, to.x * 0.8, k), lerp(from.y, to.y, k) + Math.sin(k * Math.PI) * 0.25, 0);
      player.rotation.y = to.x > 0 ? -0.6 : 0.6;
      // 壁蹴りポーズ
      tuckPose(player, 0.45);
      player.legR.hip.rotation.x = -0.6;
      player.legR.knee.rotation.x = 1.4;
    } else if (t < T_FLIP1) {
      // 頂点からバク宙で中央へ着地
      const k = seg(t, T_FLIP0, T_FLIP1, E.linear);
      player.position.set(lerp(-1.45 * 0.8, 0, k), lerp(3.3, 0, k) + Math.sin(k * Math.PI) * 0.9, lerp(0, 0.7, k));
      player.rotation.y = 0;
      player.rotation.x = -Math.PI * 2 * k;
      tuckPose(player, Math.sin(k * Math.PI));
    } else {
      player.position.set(0, 0, 0.7);
      player.rotation.x = 0;
      const rise = seg(t, 2.4, 2.7, E.outQuad);
      crouchPose(player, 0.8 * (1 - rise));
      if (rise >= 1) heroPoses[7](player, t);
    }
  };
  return s;
}

// =========================================================
export const FACTORIES4 = {
  henshin: henshinScene,
  powerup: powerupScene,
  coolback: coolbackScene,
  rooftop: rooftopScene,
  slowturn: slowturnScene,
  slide: slideScene,
  catchfist: catchfistScene,
  standoff: standoffScene,
  afterimage: afterimageScene,
  debriscatch: debriscatchScene,
  beckon: beckonScene,
  walljump: walljumpScene,
};

// =========================================================
// 演出レジストリ(全セクションの定義が揃った後に構築する)
// =========================================================
const FACTORIES = {
  ...FACTORIES2,
  ...FACTORIES3,
  ...FACTORIES4,
  dash: dashScene,
  cat: catScene,
  skyfall: skyfallScene,
  backflip: backflipScene,
  mining: miningScene,
  spotlight: spotlightScene,
  tornado: tornadoScene,
  rocket: rocketScene,
  blink: blinkScene,
  freeze: freezeScene,
  quake: quakeScene,
  bomber: bomberScene,
  beam: beamScene,
  slowwalk: slowwalkScene,
  thunder: thunderScene,
  minecart: minecartScene,
  clones: clonesScene,
  breakspin: breakspinScene,
};

export function createIntroScene(id, ctx, member, player, color) {
  const factory = FACTORIES[id] || dashScene;
  return factory(ctx, member, player, color);
}
