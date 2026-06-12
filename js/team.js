// チーム紹介演出 x16

import * as THREE from 'three';
import { PlayerModel, crouchPose, heroPoses, idlePose, jumpRisePose, makeBed, makeCake, makeChicken, makeCityline, makeClouds, makeCreeper, makeDragon, makeElytra, makeEnderman, makeGolem, makePad, makePig, makePortal, makeSheep, makeSteak, makeWither, makeWolf, makeZombieSkin, mobWalk, runPose, tuckPose } from './actors.js';
import { E, clamp, lerp, rand, randPick, seg } from './core.js';
import { dust, shell } from './scenes.js';

// ============================================================
// [team.js より統合]
// ============================================================

// チーム紹介演出シーン x3 (戦隊モノ定番・背景大爆発つき)

// V字フォーメーション(0が先頭)
function formation(n) {
  const out = [];
  const tight = n > 9;
  for (let i = 0; i < n; i++) {
    if (i === 0) { out.push([0, 0]); continue; }
    const k = Math.ceil(i / 2);
    const side = i % 2 === 1 ? -1 : 1;
    out.push([side * k * (tight ? 0.95 : 1.3), -k * (tight ? 0.62 : 0.95)]);
  }
  return out;
}

function teamTitleCues(s, state, colors, tKicker, tName) {
  const { titles, sfx } = s.ctx;
  s.at(tKicker, () => {
    if (state.squad.title) { titles.teamTitle(state.squad.title, '', colors); sfx.shing(); }
  });
  s.at(tName, () => {
    titles.clear(true);
    titles.teamTitle(state.squad.title, state.squad.name, colors);
    sfx.slam();
    sfx.fanfare();
  });
}

// =========================================================
// 1. 全員集結・大爆発 (空から順番に降ってくる)
// =========================================================
function assembleScene(ctx, state, players, colors) {
  const n = players.length;
  const stagger = n > 8 ? 0.28 : 0.42;
  const tAll = 0.6 + n * stagger + 0.7;
  const s = shell(tAll + 5.2, ctx);
  const { stage, fx, screen, sfx } = ctx;
  const form = formation(n);
  const drops = [];

  s.init = () => {
    stage.setEnv('nightcity');
    stage.props.add(makeCityline({ z: -30 }));
    players.forEach((p, i) => {
      p.visible = false;
      const t0 = 0.6 + i * stagger;
      drops.push({ t0, x: form[i][0], z: form[i][1] });
      s.at(t0 + 0.42, () => {
        sfx.thud(0.75);
        stage.shake(0.1);
        fx.burst({
          pos: { x: form[i][0], y: 0.1, z: form[i][1] }, count: 22,
          colors: ['#cfd8ea', colors[i]], speed: 2.8, gravity: -3, life: 0.7,
          size: 0.07, additive: false,
        });
        fx.ring({ pos: { x: form[i][0], y: 0.04, z: form[i][1] }, r1: 1.9, life: 0.45, color: new THREE.Color(colors[i]).getHex() });
      });
    });
    teamTitleCues(s, state, colors, tAll, tAll + 0.65);
    s.at(tAll + 1.15, () => {
      fx.bigExplosion({ pos: { x: 0, y: 0.4, z: -17 }, stage, screen, sfx, scale: 1.7 });
    });
    s.at(tAll + 1.7, () => {
      fx.bigExplosion({ pos: { x: -7.5, y: 0.3, z: -15 }, stage, screen, sfx, scale: 1.0 });
      fx.bigExplosion({ pos: { x: 8, y: 0.3, z: -16 }, stage, screen, sfx, scale: 1.1 });
    });
    s.at(tAll + 1.2, () => {
      // member色の紙吹雪
      fx.burst({
        pos: { x: 0, y: 5, z: -2 }, count: 80, colors, speed: 4, gravity: -2,
        life: 2.2, size: 0.09, drag: 1.8,
      });
    });
  };

  s.update = (t, dt) => {
    // カメラ: ワイド → じわ寄り → 爆発でさらにロー
    const k = seg(t, tAll - 1, tAll + 2.2, E.inOutQuad);
    const low = seg(t, tAll + 1.15, tAll + 1.6, E.outQuad);
    stage.cam(
      Math.sin(t * 0.07) * 1.2,
      lerp(2.6, 1.3, k) - low * 0.25,
      lerp(11.5, 8.2, k),
      0, lerp(1.2, 1.55, k), -1.5
    );

    players.forEach((p, i) => {
      const d = drops[i];
      if (t < d.t0) return;
      const tl = t - d.t0;
      p.visible = true;
      p.rotation.y = 0;
      p.resetPose();
      if (tl < 0.42) {
        // 落下
        const k2 = tl / 0.42;
        p.position.set(d.x, 9 * (1 - k2 * k2), d.z);
        tuckPose(p, 0.6);
      } else if (tl < 0.72) {
        p.position.set(d.x, 0, d.z);
        crouchPose(p, 0.8 * (1 - seg(tl, 0.42, 0.72, E.outQuad)));
      } else {
        p.position.set(d.x, 0, d.z);
        heroPoses[i % heroPoses.length](p, t + i);
      }
    });
  };
  return s;
}

// =========================================================
// 2. 夕陽のスローウォーク
// =========================================================
function sunsetScene(ctx, state, players, colors) {
  const n = players.length;
  const s = shell(10.6, ctx);
  const { stage, fx, screen, sfx } = ctx;
  const spacing = clamp(13 / Math.max(n, 1), 0.95, 1.6);
  const T_STOP = 4.4;

  s.init = () => {
    stage.setEnv('sunset');
    stage.props.add(makeCityline({ z: -36, spread: 60 }));
    players.forEach((p, i) => {
      p.visible = true;
      p.rotation.y = 0;
    });
    // 順番にキメポーズ
    players.forEach((p, i) => {
      s.at(T_STOP + 0.25 + i * 0.14, () => sfx.hit(280 + i * 40, 0.35));
    });
    teamTitleCues(s, state, colors, 5.4, 6.0);
    s.at(6.6, () => {
      fx.bigExplosion({ pos: { x: -3, y: 0.4, z: -20 }, stage, screen, sfx, scale: 1.6 });
    });
    s.at(7.15, () => {
      fx.bigExplosion({ pos: { x: 6, y: 0.4, z: -18 }, stage, screen, sfx, scale: 1.2 });
    });
  };

  s.update = (t, dt) => {
    // カメラ: ロー・逆光
    const k = seg(t, 0, T_STOP, E.inOutQuad);
    stage.cam(0, lerp(0.9, 1.4, k), lerp(5.2, 6.4, k), 0, 1.35, -4);

    const walk = seg(t, 0, T_STOP, E.linear);
    const z = lerp(-13, -1.2, walk);
    players.forEach((p, i) => {
      const x = (i - (n - 1) / 2) * spacing;
      p.resetPose();
      if (t < T_STOP) {
        // スローモーション歩き(少しずらして揃いすぎない様に)
        p.position.set(x, 0, z - Math.abs(i - (n - 1) / 2) * 0.3);
        runPose(p, t + i * 0.4, { speed: 3.4, amp: 0.5, lean: 0.06 });
      } else {
        p.position.set(x, 0, -1.2 - Math.abs(i - (n - 1) / 2) * 0.3);
        const posed = t > T_STOP + 0.25 + i * 0.14;
        if (posed) heroPoses[i % heroPoses.length](p, t + i);
        else runPose(p, T_STOP + i * 0.4, { speed: 3.4, amp: 0.5, lean: 0.06 });
      }
    });
  };
  return s;
}

// =========================================================
// 3. 暗闇からの全員見参 (カメラが旋回 → ライトON → 爆発)
// =========================================================
function orbitScene(ctx, state, players, colors) {
  const n = players.length;
  const s = shell(9.8, ctx);
  const { stage, fx, screen, sfx } = ctx;
  const form = formation(n);
  const T_ON = 4.3;

  s.init = () => {
    stage.setEnv('dark');
    stage.props.add(makePad(Math.max(3.4, n * 0.55)));
    stage.props.add(makeCityline({ z: -34 }));
    players.forEach((p, i) => {
      p.visible = true;
      p.position.set(form[i][0], 0.18, form[i][1]);
      p.rotation.y = 0;
    });
    // 旋回中に一人ずつ足元が光る
    players.forEach((p, i) => {
      s.at(0.7 + i * (3.2 / Math.max(n, 1)), () => {
        sfx.pop(true);
        fx.ring({
          pos: { x: form[i][0], y: 0.22, z: form[i][1] }, r1: 1.5, life: 0.6,
          color: new THREE.Color(colors[i]).getHex(), opacity: 1,
        });
        fx.burst({
          pos: { x: form[i][0], y: 1, z: form[i][1] }, count: 18, colors: [colors[i], '#ffffff'],
          speed: 1.6, gravity: -0.5, life: 0.6, size: 0.07,
        });
      });
    });
    s.at(T_ON, () => {
      sfx.zap();
      screen.flash('#ffffff', 0.25, 0.9);
      stage.key.intensity = 2.4;
      stage.hemi.intensity = 0.6;
      stage.rim.intensity = 2.0;
      stage.shake(0.1);
    });
    teamTitleCues(s, state, colors, T_ON + 0.35, T_ON + 0.95);
    s.at(T_ON + 1.5, () => {
      fx.bigExplosion({ pos: { x: 2, y: 0.4, z: -19 }, stage, screen, sfx, scale: 1.7 });
    });
    s.at(T_ON + 2.05, () => {
      fx.bigExplosion({ pos: { x: -7, y: 0.3, z: -16 }, stage, screen, sfx, scale: 1.0 });
    });
  };

  s.update = (t, dt) => {
    // カメラ旋回 → 正面に回り込んで静止
    const orb = seg(t, 0, T_ON, E.inOutQuad);
    const ang = lerp(Math.PI * 1.45, Math.PI * 2, orb);
    const r = lerp(8.5, 9.5, seg(t, T_ON, T_ON + 2, E.outQuad));
    const cy = lerp(1.1, 2.0, seg(t, T_ON, T_ON + 2.5, E.inOutQuad));
    stage.cam(
      Math.sin(ang) * r, cy, Math.cos(ang) * r,
      0, 1.3, -1
    );

    players.forEach((p, i) => {
      p.resetPose();
      heroPoses[i % heroPoses.length](p, t + i * 0.7);
      p.position.set(form[i][0], 0.18, form[i][1]);
    });
  };
  return s;
}

// =========================================================
// 4. 名乗りロールコール (一人ずつカメラが寄って名乗り)
// =========================================================
function rollcallScene(ctx, state, players, colors) {
  const n = players.length;
  const step = Math.min(1.05, 8.5 / Math.max(n, 1));
  const T0 = 0.9;
  const tAll = T0 + n * step + 0.3;
  const s = shell(tAll + 5.4, ctx);
  const { stage, fx, screen, sfx, titles } = ctx;
  const spacing = clamp(13 / Math.max(n, 1), 1.0, 1.7);
  const px = i => (i - (n - 1) / 2) * spacing;
  const pz = i => -Math.abs(i - (n - 1) / 2) * 0.22;
  const posed = new Array(n).fill(false);

  s.init = () => {
    stage.setEnv('nightcity');
    stage.props.add(makeCityline({ z: -30 }));
    players.forEach((p, i) => {
      p.visible = true;
      p.position.set(px(i), 0, pz(i));
      p.rotation.y = 0;
    });
    players.forEach((p, i) => {
      s.at(T0 + i * step, () => {
        posed[i] = true;
        sfx.hit(260 + (i % 8) * 36, 0.5);
        sfx.shing();
        titles.clear(true);
        titles.kicker(state.members[i].name, colors[i]);
        fx.ring({ pos: { x: px(i), y: 0.04, z: pz(i) }, r1: 1.8, life: 0.5, color: new THREE.Color(colors[i]).getHex() });
        fx.burst({
          pos: { x: px(i), y: 1.2, z: pz(i) }, count: 20, colors: [colors[i], '#ffffff'],
          speed: 2, gravity: -0.5, life: 0.6, size: 0.07,
        });
      });
    });
    s.at(tAll, () => titles.clear(true));
    teamTitleCues(s, state, colors, tAll + 0.3, tAll + 0.9);
    s.at(tAll + 1.45, () => {
      fx.bigExplosion({ pos: { x: 0, y: 0.4, z: -18 }, stage, screen, sfx, scale: 1.7 });
    });
    s.at(tAll + 2.0, () => {
      fx.bigExplosion({ pos: { x: -8, y: 0.3, z: -15 }, stage, screen, sfx, scale: 1.0 });
      fx.bigExplosion({ pos: { x: 8.5, y: 0.3, z: -16 }, stage, screen, sfx, scale: 1.1 });
    });
  };

  s.update = (t, dt) => {
    // カメラ: 名乗り中はメンバーごとにスナップカット → 最後にワイドへ
    const wideR = Math.max(8.5, n * 0.62 + 5.5);
    if (t < T0) {
      stage.cam(0, 1.7, wideR, 0, 1.2, -1);
    } else if (t < tAll) {
      const i = Math.min(n - 1, Math.floor((t - T0) / step));
      stage.cam(px(i) + 0.8, 1.5, pz(i) + 2.8, px(i), 1.25, pz(i));
    } else {
      const k = seg(t, tAll, tAll + 1.0, E.inOutQuad);
      const i = n - 1;
      stage.cam(
        lerp(px(i) + 0.8, 0, k), lerp(1.5, 1.9, k), lerp(pz(i) + 2.8, wideR, k),
        lerp(px(i), 0, k), lerp(1.25, 1.3, k), lerp(pz(i), -1, k)
      );
    }

    players.forEach((p, i) => {
      p.resetPose();
      if (posed[i]) heroPoses[i % heroPoses.length](p, t + i);
      else idlePose(p, t + i * 0.7);
      p.position.set(px(i), 0, pz(i));
    });
  };
  return s;
}

// =========================================================
// 5. 全員ジャンプフリーズ (空中で一斉静止 + 爆発)
// =========================================================
function jumpfreezeScene(ctx, state, players, colors) {
  const n = players.length;
  const form = formation(n);
  const T_RUN = 1.7, T_JUMP = 2.1, T_FREEZE = 2.42, T_RESUME = 4.7, T_LAND = 5.02;
  const s = shell(8.0, ctx);
  const { stage, fx, screen, sfx } = ctx;

  s.init = () => {
    stage.setEnv('nightcity');
    stage.props.add(makeCityline({ z: -30 }));
    players.forEach(p => { p.visible = true; p.rotation.y = 0; });
    s.at(T_JUMP, () => sfx.whoosh(0.4, 0.65));
    s.at(T_FREEZE, () => {
      sfx.boom();
      sfx.hit(200, 0.7);
      screen.impact(0.4);
    });
    teamTitleCues(s, state, colors, 2.85, 3.45);
    s.at(3.8, () => {
      fx.bigExplosion({ pos: { x: 0, y: 0.4, z: -17 }, stage, screen, sfx, scale: 1.6 });
    });
    s.at(T_RESUME, () => sfx.whoosh(0.3, 0.45));
    s.at(T_LAND, () => {
      sfx.thud(1.0);
      stage.shake(0.22);
      players.forEach((p, i) => {
        fx.burst({
          pos: { x: form[i][0], y: 0.1, z: form[i][1] }, count: 14,
          colors: ['#cfd8ea', colors[i]], speed: 2.4, gravity: -3, life: 0.6,
          size: 0.07, additive: false,
        });
      });
    });
  };

  s.update = (t, dt) => {
    // カメラ: フリーズ中はゆっくり回り込む
    if (t < T_FREEZE) {
      stage.cam(0, 1.8, 9.5, 0, 1.3, -2);
    } else {
      const orb = seg(t, T_FREEZE, T_RESUME, E.inOutQuad);
      const a = orb * 0.55;
      const r = 9.0;
      stage.cam(Math.sin(a) * r, 1.9 + orb * 0.5, Math.cos(a) * r, 0, 1.6, -1);
    }
    screen.setSpeed(t > T_FREEZE && t < T_RESUME ? 0.3 : 0);

    players.forEach((p, i) => {
      const [fx2, fz] = form[i];
      p.resetPose();
      // フリーズ中は時間停止
      const eff = t < T_FREEZE ? t : (t < T_RESUME ? T_FREEZE : T_FREEZE + (t - T_RESUME));
      if (eff < T_RUN) {
        const k = seg(eff, 0, T_RUN, E.outQuad);
        p.position.set(fx2, 0, lerp(fz - 9, fz, k));
        runPose(p, eff + i * 0.13, { speed: 12 });
      } else if (eff < T_JUMP) {
        p.position.set(fx2, 0, fz);
        crouchPose(p, seg(eff, T_RUN, T_JUMP, E.outQuad) * 0.85);
      } else {
        const k = clamp((eff - T_JUMP) / 0.64, 0, 1);
        p.position.set(fx2, Math.sin(k * Math.PI) * 2.0, fz);
        if (k < 1) {
          // 空中ポーズはメンバーごとに違う
          const v = i % 3;
          if (v === 0) jumpRisePose(p, 1);
          else if (v === 1) tuckPose(p, 0.85);
          else heroPoses[6](p, t);
        } else {
          const rise = seg(eff, T_JUMP + 0.64, T_JUMP + 0.94, E.outQuad);
          crouchPose(p, 0.8 * (1 - rise));
          if (rise >= 1) heroPoses[i % heroPoses.length](p, t + i);
        }
      }
    });
  };
  return s;
}

// =========================================================
// 6. 爆発を背に歩く (振り返らないのが男)
// =========================================================
function coolwalkScene(ctx, state, players, colors) {
  const n = players.length;
  const T_STOP = 6.0;
  const s = shell(8.2, ctx);
  const { stage, fx, screen, sfx } = ctx;
  const spacing = clamp(12 / Math.max(n, 1), 0.95, 1.6);

  s.init = () => {
    stage.setEnv('nightcity');
    stage.props.add(makeCityline({ z: -32 }));
    players.forEach((p, i) => { p.visible = true; p.rotation.y = 0; });
    s.at(1.3, () => {
      fx.bigExplosion({ pos: { x: -2, y: 0.4, z: -16 }, stage, screen, sfx, scale: 1.9 });
    });
    s.at(2.1, () => {
      fx.bigExplosion({ pos: { x: 6, y: 0.3, z: -14 }, stage, screen, sfx, scale: 1.2 });
    });
    s.at(3.0, () => {
      fx.bigExplosion({ pos: { x: -7.5, y: 0.3, z: -13 }, stage, screen, sfx, scale: 1.3 });
    });
    teamTitleCues(s, state, colors, 2.4, 3.0);
    players.forEach((p, i) => {
      s.at(T_STOP + 0.2 + i * 0.12, () => sfx.hit(280 + (i % 8) * 36, 0.35));
    });
  };

  s.update = (t, dt) => {
    stage.cam(0, 1.0, 5.8, 0, 1.3, -3);

    const z = lerp(-8, 0.6, seg(t, 0, T_STOP, E.linear));
    players.forEach((p, i) => {
      const x = (i - (n - 1) / 2) * spacing;
      const zi = z - Math.abs(i - (n - 1) / 2) * 0.55 + (i === 0 ? 0.35 : 0);
      p.resetPose();
      if (t < T_STOP) {
        p.position.set(x, 0, zi);
        // スローモーション歩き。爆発でも誰も振り返らない
        runPose(p, t * 0.62 + i * 0.5, { speed: 5.2, amp: 0.5, lean: 0.05 });
        p.head.rotation.x = -0.02;
        p.head.rotation.y = 0;
      } else {
        p.position.set(x, 0, 0.6 - Math.abs(i - (n - 1) / 2) * 0.55 + (i === 0 ? 0.35 : 0));
        const posed = t > T_STOP + 0.2 + i * 0.12;
        if (posed) heroPoses[i % heroPoses.length](p, t + i);
        else runPose(p, T_STOP * 0.62 + i * 0.5, { speed: 5.2, amp: 0.5, lean: 0.05 });
      }
    });
  };
  return s;
}

// =========================================================



// ============================================================
// [team2.js より統合]
// ============================================================

// チーム紹介演出 第2弾 x6

const ENDER = ['#c05fff', '#8a2be2', '#ff7af0', '#e0b0ff'];

function lineX(i, n, spacing) { return (i - (n - 1) / 2) * spacing; }

function teamTitleCues2(s, state, colors, tKicker, tName) {
  const { titles, sfx } = s.ctx;
  s.at(tKicker, () => {
    if (state.squad.title) { titles.teamTitle(state.squad.title, '', colors); sfx.shing(); }
  });
  s.at(tName, () => {
    titles.clear(true);
    titles.teamTitle(state.squad.title, state.squad.name, colors);
    sfx.slam();
    sfx.fanfare();
  });
}

// =========================================================
// 7. モブ大行進
// =========================================================
function mobparadeScene(ctx, state, players, colors) {
  const n = players.length;
  const s = shell(10.5, ctx);
  const { stage, fx, screen, sfx } = ctx;
  const spacing = clamp(12 / Math.max(n, 1), 0.95, 1.6);
  const mobs = [];
  const T_POSE = 3.4;

  s.init = () => {
    stage.setEnv('day');
    stage.props.add(makeClouds());
    players.forEach((p, i) => {
      p.visible = true;
      p.rotation.y = 0;
      p.position.set(lineX(i, n, spacing), 0, 0.6 - Math.abs(i - (n - 1) / 2) * 0.3);
    });
    // 後方にモブ軍団(2列)
    const makers = [makeCreeper, makePig, makeSheep, makeChicken, makeWolf, () => new PlayerModel(makeZombieSkin())];
    const mobN = Math.min(12, n * 2 + 4);
    for (let i = 0; i < mobN; i++) {
      const m = makers[i % makers.length]();
      const row = i % 2;
      m.position.set(
        lineX(i >> 1, Math.ceil(mobN / 2), 1.5) + rand(-0.3, 0.3),
        0, -2.6 - row * 1.6 + rand(-0.3, 0.3)
      );
      stage.props.add(m);
      mobs.push(m);
    }
    players.forEach((p, i) => {
      s.at(T_POSE + i * 0.12, () => sfx.hit(280 + (i % 8) * 36, 0.35));
    });
    teamTitleCues2(s, state, colors, 4.4, 5.0);
    s.at(5.6, () => fx.bigExplosion({ pos: { x: 0, y: 0.4, z: -18 }, stage, screen, sfx, scale: 1.6 }));
    s.at(6.2, () => {
      fx.bigExplosion({ pos: { x: -8, y: 0.3, z: -15 }, stage, screen, sfx, scale: 1.0 });
      // クリーパーたちはビクッとする(7.のお楽しみ)
      sfx.pop(false);
    });
  };

  s.update = (t, dt) => {
    const k = seg(t, 0, T_POSE, E.inOutQuad);
    stage.cam(lerp(-5, 0, k), lerp(1.2, 1.7, k), lerp(6.5, 8.8, k), 0, 1.2, -1.2);

    // モブはその場で足踏み・小芝居
    mobs.forEach((m, i) => {
      if (m.legs) mobWalk(m, t + i, 5, 0.25);
      if (m.flap) m.flap(t + i, 0.4);
      if (m.head && !m.isPlayerModel) m.head.rotation.y = Math.sin(t * 1.2 + i) * 0.25;
      if (m.resetPose) { // ゾンビ
        m.resetPose();
        runPose(m, (t + i) * 0.5, { speed: 6, amp: 0.3, lean: 0.1 });
        m.armR.shoulder.rotation.x = -1.5;
        m.armL.shoulder.rotation.x = -1.5;
      }
      // 爆発でビクッ
      if (t > 5.6 && t < 6.1) m.position.y = Math.abs(Math.sin((t - 5.6) * 18)) * 0.12;
      else m.position.y = 0;
    });

    players.forEach((p, i) => {
      p.resetPose();
      if (t > T_POSE + i * 0.12) heroPoses[i % heroPoses.length](p, t + i);
      else idlePose(p, t + i * 0.7);
    });
  };
  return s;
}

// =========================================================
// 8. 勝利の宴(全員もぐもぐ)
// =========================================================
function feastScene(ctx, state, players, colors) {
  const n = players.length;
  const s = shell(9.8, ctx);
  const { stage, fx, screen, sfx } = ctx;

  s.init = () => {
    stage.setEnv('sunset');
    // ごちそう(中央にケーキの山)
    for (let i = 0; i < Math.min(5, 2 + (n >> 2)); i++) {
      const cake = makeCake();
      cake.position.set(rand(-1.2, 1.2), 0, rand(-0.8, 0.8));
      stage.props.add(cake);
    }
    players.forEach((p, i) => {
      p.visible = true;
      const a = (i / Math.max(n, 1)) * Math.PI * 1.5 - Math.PI * 0.75 + Math.PI / 2;
      p.position.set(Math.sin(a) * 2.6, 0, Math.cos(a) * 2.0 + 0.4);
      p.rotation.y = Math.atan2(-p.position.x, -(p.position.z - 0.2)); // 中央を向く
      const steak = makeSteak();
      p.handR.add(steak);
    });
    // もぐもぐ音をランダムに
    for (let i = 0; i < 10; i++) {
      s.at(0.4 + i * 0.55 + rand(0, 0.2), () => sfx.chomp());
    }
    teamTitleCues2(s, state, colors, 3.2, 3.8);
    s.at(4.5, () => fx.bigExplosion({ pos: { x: 2, y: 0.4, z: -18 }, stage, screen, sfx, scale: 1.7 }));
    s.at(5.2, () => fx.bigExplosion({ pos: { x: -7, y: 0.3, z: -15 }, stage, screen, sfx, scale: 1.1 }));
    // 爆発しても誰も食事をやめない
  };

  s.update = (t, dt) => {
    const orb = Math.sin(t * 0.18) * 1.6;
    stage.cam(orb, 1.5, 6.4, 0, 0.9, 0);

    players.forEach((p, i) => {
      // 正座でもぐもぐ(食べる速度は人それぞれ)
      p.resetPose();
      p.hips.position.y = 12 / 16 - 0.5;
      p.legR.hip.rotation.x = -1.55;
      p.legL.hip.rotation.x = -1.55;
      p.legR.knee.rotation.x = 2.5;
      p.legL.knee.rotation.x = 2.5;
      const sp = 8 + (i % 3) * 2;
      p.armR.shoulder.rotation.x = -1.95 + Math.sin(t * sp + i) * 0.32;
      p.armR.elbow.rotation.x = -1.5;
      p.armL.shoulder.rotation.x = -0.6;
      p.armL.elbow.rotation.x = -1.0;
      p.head.rotation.x = 0.12 + Math.sin(t * sp + i + 1.2) * 0.06;
      // 爆発の瞬間だけ一瞬手が止まる(でも食べる)
      if (t > 4.5 && t < 4.9) {
        p.armR.shoulder.rotation.x = -1.95;
        p.head.rotation.y = -0.3;
      }
    });
  };
  return s;
}

// =========================================================
// 9. ずっこけドミノ
// =========================================================
function pileupScene(ctx, state, players, colors) {
  const n = players.length;
  const s = shell(11.0, ctx);
  const { stage, fx, screen, sfx } = ctx;
  const T_TRIP = 1.5;            // 先頭が転ぶ
  const stagger = 0.16;
  const T_ALLDOWN = T_TRIP + n * stagger + 0.4;
  const T_UP = T_ALLDOWN + 1.2;  // 一斉に跳ね起きる

  s.init = () => {
    stage.setEnv('street');
    stage.props.add(makeCityline({ z: -30 }));
    players.forEach((p, i) => { p.visible = true; p.rotation.y = 0; });
    s.at(T_TRIP, () => sfx.whoosh(0.3, 0.4));
    players.forEach((p, i) => {
      s.at(T_TRIP + 0.25 + i * stagger, () => {
        sfx.thud(0.55 + Math.min(0.4, i * 0.05));
        stage.shake(0.05);
        dust(fx, { x: lineX(0, 1, 1) , y: 0.1, z: -0.4 - i * 0.32 }, 12, 1.6);
      });
    });
    s.at(T_UP, () => {
      sfx.hit(440, 0.7);
      sfx.whoosh(0.4, 0.5);
      screen.flash('#ffffff', 0.15, 0.5);
      players.forEach((p, i) => {
        dust(fx, { x: p.position.x, y: 0.2, z: p.position.z }, 10, 2);
      });
    });
    teamTitleCues2(s, state, colors, T_UP + 0.5, T_UP + 1.1);
    s.at(T_UP + 1.7, () => fx.bigExplosion({ pos: { x: 0, y: 0.4, z: -17 }, stage, screen, sfx, scale: 1.7 }));
    s.at(T_UP + 2.3, () => fx.bigExplosion({ pos: { x: 8, y: 0.3, z: -15 }, stage, screen, sfx, scale: 1.0 }));
  };

  s.update = (t, dt) => {
    stage.cam(1.2, 1.5, 6.8, 0, 1.0, -1.5);

    players.forEach((p, i) => {
      p.resetPose();
      const tripT = T_TRIP + 0.25 + i * stagger;
      if (t < tripT - 0.25) {
        // 縦一列で走ってくる
        const k = seg(t, 0, T_TRIP, E.linear);
        p.position.set(0, 0, lerp(-9 - i * 1.1, -0.2 - i * 1.1, k));
        runPose(p, t + i * 0.17, { speed: 12 });
      } else if (t < tripT) {
        // 前のめりに飛ぶ
        const k = seg(t, tripT - 0.25, tripT, E.linear);
        p.position.set(0, Math.sin(k * Math.PI) * 0.5, lerp(-0.2 - i * 1.1, 0.4 - i * 0.6, k));
        p.rotation.x = Math.PI / 2 * k;
      } else if (t < T_UP) {
        // 折り重なって倒れている
        p.position.set(Math.sin(i * 2.7) * 0.35, 0.16 + (i % 3) * 0.13, 0.4 - i * 0.6);
        p.rotation.x = Math.PI / 2;
        p.rotation.z = Math.sin(i * 1.9) * 0.4;
        if (t > T_ALLDOWN + 0.4 && t < T_ALLDOWN + 0.6 && i === 0) {
          p.legR.knee.rotation.x = 0.8; // 先頭の脚がぴくっ
        }
      } else if (t < T_UP + 0.35) {
        // 一斉にバク転気味に跳ね起きてフォーメーションへ
        const k = seg(t, T_UP, T_UP + 0.35, E.outQuad);
        const tx = lineX(i, n, clamp(12 / n, 0.95, 1.6));
        const tz = -Math.abs(i - (n - 1) / 2) * 0.4;
        p.rotation.x = Math.PI / 2 * (1 - k);
        p.rotation.z = Math.sin(i * 1.9) * 0.4 * (1 - k);
        p.position.set(
          lerp(Math.sin(i * 2.7) * 0.35, tx, k),
          Math.sin(k * Math.PI) * 1.2,
          lerp(0.4 - i * 0.6, tz, k)
        );
        tuckPose(p, Math.sin(k * Math.PI) * 0.8);
      } else {
        const tx = lineX(i, n, clamp(12 / n, 0.95, 1.6));
        const tz = -Math.abs(i - (n - 1) / 2) * 0.4;
        p.position.set(tx, 0, tz);
        p.rotation.set(0, 0, 0);
        heroPoses[i % heroPoses.length](p, t + i);
      }
    });
  };
  return s;
}

// =========================================================
// 10. ゲート総出撃
// =========================================================
function teamportalScene(ctx, state, players, colors) {
  const n = players.length;
  const stagger = n > 8 ? 0.42 : 0.6;
  const tAll = 1.0 + n * stagger + 0.6;
  const s = shell(tAll + 5.2, ctx);
  const { stage, fx, screen, sfx } = ctx;
  const spacing = clamp(12 / Math.max(n, 1), 0.95, 1.6);
  const starts = [];

  s.init = () => {
    // ネザーゲートで行けるのはオーバーワールド⇔ネザーのみ(エンドではない)
    stage.setEnv('nightcity');
    const portal = makePortal(5, 5);
    portal.position.set(0, 0, -4);
    stage.props.add(portal);
    s.portal = portal;
    players.forEach((p, i) => {
      p.visible = false;
      const t0 = 1.0 + i * stagger;
      starts.push(t0);
      s.at(t0, () => {
        p.visible = true;
        sfx.pop(true);
        fx.burst({ pos: { x: 0, y: 1.4, z: -3.6 }, count: 26, colors: ENDER, speed: 2.2, gravity: -0.5, life: 0.7, size: 0.08, drag: 2.4 });
      });
    });
    teamTitleCues2(s, state, colors, tAll + 0.3, tAll + 0.9);
    s.at(tAll + 1.5, () => fx.bigExplosion({ pos: { x: 3, y: 0.4, z: -20 }, stage, screen, sfx, scale: 1.6 }));
    s.at(tAll + 2.1, () => fx.bigExplosion({ pos: { x: -8, y: 0.3, z: -17 }, stage, screen, sfx, scale: 1.1 }));
  };

  let acc = 0;
  s.update = (t, dt) => {
    const k = seg(t, tAll - 1.5, tAll + 1, E.inOutQuad);
    stage.cam(Math.sin(t * 0.1) * 1.5, lerp(1.5, 2.0, k), lerp(7.5, 9.2, k), 0, 1.25, -1.5);

    if (s.portal) {
      s.portal.glow.material.opacity = 0.45 + Math.sin(t * 7) * 0.12;
      acc += dt;
      if (acc > 0.2) {
        acc = 0;
        fx.burst({
          pos: { x: rand(-1.4, 1.4), y: rand(1, 4), z: -3.9 }, count: 3, colors: ENDER,
          speed: 0.5, gravity: 0.4, life: 0.9, size: 0.07, drag: 1,
        });
      }
    }

    players.forEach((p, i) => {
      if (!p.visible) return;
      const t0 = starts[i];
      const tx = lineX(i, n, spacing);
      const tz = 0.6 - Math.abs(i - (n - 1) / 2) * 0.35;
      const walk = seg(t, t0, t0 + 1.3, E.inOutQuad);
      p.resetPose();
      if (walk < 1) {
        p.position.set(lerp(0, tx, walk), 0, lerp(-3.6, tz, walk));
        p.rotation.y = 0;
        runPose(p, t + i * 0.3, { speed: 6, amp: 0.45, lean: 0.06 });
      } else {
        p.position.set(tx, 0, tz);
        heroPoses[i % heroPoses.length](p, t + i);
      }
    });
  };
  return s;
}

// =========================================================
// 11. 祝砲フィナーレ(花火)
// =========================================================
function fireworksScene(ctx, state, players, colors) {
  const n = players.length;
  const s = shell(10.5, ctx);
  const { stage, fx, screen, sfx } = ctx;
  const spacing = clamp(12 / Math.max(n, 1), 0.95, 1.6);

  s.init = () => {
    stage.setEnv('nightcity');
    stage.props.add(makeCityline({ z: -30 }));
    players.forEach((p, i) => {
      p.visible = true;
      p.rotation.y = 0;
      p.position.set(lineX(i, n, spacing), 0, -Math.abs(i - (n - 1) / 2) * 0.35);
    });
    // 花火: 打ち上げ(riser+光の筋) → 開花(色burst)。カメラの画角に収まる位置で
    const shots = Math.min(9, 4 + n);
    for (let i = 0; i < shots; i++) {
      const t0 = 0.7 + i * 0.62;
      const x = rand(-6, 6), z = rand(-10, -5.5), y = rand(4.2, 7.0);
      const col = colors[i % colors.length];
      s.at(t0, () => {
        sfx.riser(0.7);
        // 打ち上げの光跡
        fx.burst({
          pos: { x, y: 0.5, z }, count: 14, colors: ['#fff7c8', col],
          speed: 1.2, dir: { x: 0, y: 7, z: 0 }, gravity: -2, life: 0.7, size: 0.07, spread: 0.12,
        });
      });
      s.at(t0 + 0.72, () => {
        sfx.boom();
        fx.burst({
          pos: { x, y, z }, count: 90, colors: [col, '#ffffff', col],
          speed: 5.5, gravity: -1.2, life: 1.5, size: 0.16, drag: 1.6,
        });
        fx.burst({
          pos: { x, y, z }, count: 30, colors: ['#fff7c8'],
          speed: 2.4, gravity: -0.8, life: 1.9, size: 0.1, drag: 1.2,
        });
        screen.flash(col, 0.12, 0.14);
      });
    }
    players.forEach((p, i) => {
      s.at(1.4 + i * 0.1, () => sfx.hit(280 + (i % 8) * 36, 0.3));
    });
    teamTitleCues2(s, state, colors, 3.4, 4.0);
    s.at(5.0, () => fx.bigExplosion({ pos: { x: 0, y: 0.4, z: -19 }, stage, screen, sfx, scale: 1.5 }));
  };

  s.update = (t, dt) => {
    // 花火が上がっている間はあおり気味に空を入れる
    const k = seg(t, 2.8, 4.0, E.inOutQuad);
    stage.cam(
      Math.sin(t * 0.08) * 1.4, lerp(0.9, 1.7, k), lerp(8.2, 8.8, k),
      0, lerp(2.8, 1.5, k), lerp(-4, -2, k)
    );

    players.forEach((p, i) => {
      p.resetPose();
      if (t > 1.4 + i * 0.1) heroPoses[i % heroPoses.length](p, t + i);
      else {
        idlePose(p, t + i * 0.7);
        p.head.rotation.x = -0.45; // 花火を見上げる
      }
    });
  };
  return s;
}

// =========================================================
// 12. 巨神ゴーレムと共に
// =========================================================
function biggolemScene(ctx, state, players, colors) {
  const n = players.length;
  const s = shell(9.8, ctx);
  const { stage, fx, screen, sfx } = ctx;
  const spacing = clamp(12 / Math.max(n, 1), 0.95, 1.6);
  let golem;

  s.init = () => {
    stage.setEnv('sunset');
    golem = makeGolem();
    golem.scale.setScalar(3.2);
    golem.position.set(0, 0, -6.5);
    stage.props.add(golem);
    players.forEach((p, i) => {
      p.visible = true;
      p.rotation.y = 0;
      p.position.set(lineX(i, n, spacing), 0, 0.8 - Math.abs(i - (n - 1) / 2) * 0.35);
    });
    s.at(0.5, () => { sfx.thud(0.9); stage.shake(0.15); });
    s.at(1.5, () => { sfx.thud(0.9); stage.shake(0.15); });
    players.forEach((p, i) => {
      s.at(2.4 + i * 0.12, () => sfx.hit(280 + (i % 8) * 36, 0.35));
    });
    teamTitleCues2(s, state, colors, 3.6, 4.2);
    s.at(4.9, () => fx.bigExplosion({ pos: { x: -9, y: 0.4, z: -16 }, stage, screen, sfx, scale: 1.3 }));
    s.at(5.4, () => fx.bigExplosion({ pos: { x: 9, y: 0.4, z: -16 }, stage, screen, sfx, scale: 1.3 }));
    s.at(5.9, () => {
      // ゴーレムも拳を突き上げる
      sfx.hit(180, 0.6);
    });
  };

  s.update = (t, dt) => {
    // ロー&あおりでスケール感
    const k = seg(t, 0, 3.2, E.inOutQuad);
    stage.cam(lerp(2.5, 0, k), lerp(0.8, 1.6, k), lerp(7.5, 9.5, k), 0, lerp(2.8, 2.0, k), -2.5);

    // ゴーレム: 最後の2歩 → 仁王立ち → 拳上げ
    if (t < 2.0) {
      const k2 = seg(t, 0, 2.0, E.linear);
      golem.position.z = lerp(-8.5, -6.5, k2);
      mobWalk(golem, t, 3.2, 0.35);
      golem.arms.forEach((a, i) => a.rotation.x = Math.sin(t * 3.2 + (i ? Math.PI : 0)) * 0.25);
    } else {
      golem.legs.forEach(l => l.rotation.x = 0);
      const up = seg(t, 5.9, 6.4, E.outBack);
      golem.arms[1].rotation.x = -2.6 * up; // 右腕(向かって左)を突き上げ
      golem.arms[0].rotation.x = 0;
      golem.head.rotation.y = Math.sin(t * 0.6) * 0.15;
    }

    players.forEach((p, i) => {
      p.resetPose();
      if (t > 2.4 + i * 0.12) heroPoses[i % heroPoses.length](p, t + i);
      else idlePose(p, t + i * 0.7);
    });
  };
  return s;
}

// =========================================================
// 13. エンドラ討伐 (ドラゴンが旋回 → 急降下 → 空中で撃破、XPの雨)
// =========================================================
function dragonScene(ctx, state, players, colors) {
  const n = players.length;
  const s = shell(11.5, ctx);
  const { stage, fx, screen, sfx } = ctx;
  const spacing = clamp(12 / Math.max(n, 1), 0.95, 1.6);
  const T_SWOOP = 4.2, T_SWOOP_END = 5.3, T_DEATH = 5.9;
  const DEATH_POS = { x: -5, y: 7.5, z: -8 };
  let dragon;

  s.init = () => {
    stage.setEnv('voidpurple');
    dragon = makeDragon();
    stage.props.add(dragon);
    players.forEach((p, i) => {
      p.visible = false;
      const t0 = 0.5 + i * Math.min(0.35, 2.2 / Math.max(n, 1));
      s.at(t0 + 0.4, () => {
        sfx.thud(0.7);
        fx.ring({ pos: { x: lineX(i, n, spacing), y: 0.04, z: 0.5 }, r1: 1.6, life: 0.45, color: new THREE.Color(colors[i]).getHex() });
        dust(fx, { x: lineX(i, n, spacing), y: 0.1, z: 0.5 }, 14, 2);
      });
      s[`drop${i}`] = t0;
    });
    s.at(0.8, () => sfx.roar(1.3));
    s.at(T_SWOOP - 0.2, () => { sfx.roar(1.0); sfx.whoosh(1.0, 0.7); });
    s.at(T_SWOOP + 0.5, () => stage.shake(0.18));
    s.at(T_DEATH, () => {
      // 空中で撃破: 白い光芒 + 爆発 + XPの雨
      sfx.boom();
      sfx.roar(1.5);
      screen.flash('#ffffff', 0.4, 0.95);
      stage.shake(0.3);
      dragon.visible = false;
      fx.fireball({ pos: DEATH_POS, r: 3.4, life: 1.8 });
      fx.bolt({ x: DEATH_POS.x - 1, z: DEATH_POS.z, h: DEATH_POS.y + 3, life: 0.5 });
      fx.bolt({ x: DEATH_POS.x + 1.5, z: DEATH_POS.z + 1, h: DEATH_POS.y + 2, life: 0.55 });
      fx.burst({
        pos: DEATH_POS, count: 90, colors: ['#ffffff', '#d8b8ff', '#b05fff'],
        speed: 7, gravity: -2, life: 1.8, size: 0.13, drag: 1.2,
      });
    });
    // XPオーブの雨
    for (let i = 0; i < 7; i++) {
      s.at(T_DEATH + 0.3 + i * 0.3, () => {
        sfx.pop(true);
        fx.burst({
          pos: { x: rand(-5, 5), y: rand(5, 8), z: rand(-4, 2) },
          count: 16, colors: ['#7fe84a', '#d8f23a', '#aef7a0'],
          speed: 1.4, gravity: -3.5, life: 1.6, size: 0.1, drag: 0.8,
        });
      });
    }
    teamTitleCues2(s, state, colors, T_DEATH + 0.7, T_DEATH + 1.3);
    s.at(T_DEATH + 2.2, () => fx.bigExplosion({ pos: { x: 6, y: 0.4, z: -18 }, stage, screen, sfx, scale: 1.4 }));
  };

  s.update = (t, dt) => {
    const k = seg(t, T_DEATH, T_DEATH + 1.5, E.inOutQuad);
    stage.cam(
      Math.sin(t * 0.07) * 1.4, lerp(1.4, 1.9, k), lerp(8.5, 9.5, k),
      0, lerp(2.6, 1.4, k), -2
    );

    // ドラゴン飛行
    if (dragon.visible) {
      dragon.flap(t, 1);
      if (t < T_SWOOP) {
        // 上空旋回
        const a = t * 0.62 + 1.2;
        const px = Math.cos(a) * 10, pz = Math.sin(a) * 10 - 6;
        dragon.position.set(px, 6.8 + Math.sin(t * 0.9) * 0.8, pz);
        dragon.rotation.y = Math.atan2(-Math.sin(a), Math.cos(a));
        dragon.rotation.z = 0.3;
      } else if (t < T_SWOOP_END) {
        // メンバーの頭上スレスレへ急降下して横切る
        const k2 = seg(t, T_SWOOP, T_SWOOP_END, E.inOutQuad);
        const p0 = { x: 10, y: 7, z: -10 }, p1 = { x: 0, y: 2.6, z: 1.5 }, p2 = { x: -11, y: 7, z: -7 };
        const a1 = lerp(p0.x, p1.x, k2), a2 = lerp(p1.x, p2.x, k2);
        dragon.position.set(
          lerp(a1, a2, k2),
          lerp(lerp(p0.y, p1.y, k2), lerp(p1.y, p2.y, k2), k2),
          lerp(lerp(p0.z, p1.z, k2), lerp(p1.z, p2.z, k2), k2)
        );
        dragon.rotation.y = -Math.PI / 2;
        dragon.rotation.z = Math.sin(k2 * Math.PI) * -0.4;
      } else {
        // 撃破ポイントへ
        const k2 = seg(t, T_SWOOP_END, T_DEATH, E.inOutQuad);
        dragon.position.set(
          lerp(-11, DEATH_POS.x, k2), lerp(7, DEATH_POS.y, k2), lerp(-7, DEATH_POS.z, k2)
        );
        dragon.rotation.y = -Math.PI / 2 + k2 * 0.8;
        dragon.rotation.z = 0;
      }
    }

    players.forEach((p, i) => {
      const t0 = s[`drop${i}`];
      if (t < t0) return;
      p.visible = true;
      const tl = t - t0;
      const x = lineX(i, n, spacing);
      p.resetPose();
      if (tl < 0.4) {
        p.position.set(x, 7 * (1 - (tl / 0.4) ** 2), 0.5);
        tuckPose(p, 0.6);
      } else if (tl < 0.7) {
        p.position.set(x, 0, 0.5);
        crouchPose(p, 0.8 * (1 - (tl - 0.4) / 0.3));
      } else {
        p.position.set(x, 0, 0.5);
        // スウープ中は身をかがめ、撃破後はキメ
        if (t > T_SWOOP + 0.3 && t < T_SWOOP_END) {
          crouchPose(p, 0.55);
          p.head.rotation.x = -0.4;
        } else {
          heroPoses[i % heroPoses.length](p, t + i);
          if (t > T_SWOOP_END && t < T_DEATH) p.head.rotation.x = -0.5; // 空を見上げる
        }
      }
    });
  };
  return s;
}

// =========================================================
export const TEAM_FACTORIES2 = {
  dragonslayer: dragonScene,
  mobparade: mobparadeScene,
  feast: feastScene,
  pileup: pileupScene,
  teamportal: teamportalScene,
  fireworks: fireworksScene,
  biggolem: biggolemScene,
};

// ============================================================
// [team3.js より統合]
// ============================================================

// チーム紹介演出 第3弾 x3 (エリトラ編隊 / ウィザー討伐 / 朝の総出撃)


function teamTitleCues3(s, state, colors, tKicker, tName) {
  const { titles, sfx } = s.ctx;
  s.at(tKicker, () => {
    if (state.squad.title) { titles.teamTitle(state.squad.title, '', colors); sfx.shing(); }
  });
  s.at(tName, () => {
    titles.clear(true);
    titles.teamTitle(state.squad.title, state.squad.name, colors);
    sfx.slam();
    sfx.fanfare();
  });
}

// =========================================================
// 14. エリトラ編隊飛行
// =========================================================
function elytrasquadScene(ctx, state, players, colors) {
  const n = players.length;
  const s = shell(11.0, ctx);
  const { stage, fx, screen, sfx } = ctx;
  const spacing = clamp(12 / Math.max(n, 1), 0.95, 1.6);
  const T_PASS = 2.2, T_LAND0 = 4.0;
  const stagger = Math.min(0.3, 2.4 / Math.max(n, 1));
  const wingsList = [];

  const glidePose = (p) => {
    p.armR.shoulder.rotation.x = 0.7;
    p.armL.shoulder.rotation.x = 0.7;
    p.armR.shoulder.rotation.z = -0.4;
    p.armL.shoulder.rotation.z = 0.4;
    p.head.rotation.x = -1.0;
  };

  s.init = () => {
    stage.setEnv('day');
    stage.props.add(makeClouds({ count: 12 }));
    players.forEach((p, i) => {
      p.visible = true;
      const w = makeElytra();
      w.position.set(0, 1.35, -0.16);
      p.add(w);
      wingsList.push(w);
    });
    sfx.whoosh(1.4, 0.5);
    s.at(T_PASS, () => sfx.whoosh(1.2, 0.8));
    players.forEach((p, i) => {
      s.at(T_LAND0 + i * stagger + 0.45, () => {
        sfx.thud(0.6);
        dust(fx, { x: lineX(i, n, spacing), y: 0.1, z: 0.4 }, 18, 2.2);
      });
    });
    teamTitleCues3(s, state, colors, T_LAND0 + n * stagger + 1.2, T_LAND0 + n * stagger + 1.8);
    s.at(T_LAND0 + n * stagger + 2.4, () => {
      fx.bigExplosion({ pos: { x: 0, y: 0.4, z: -18 }, stage, screen, sfx, scale: 1.6 });
    });
    s.at(T_LAND0 + n * stagger + 3.0, () => {
      fx.bigExplosion({ pos: { x: 8, y: 0.3, z: -15 }, stage, screen, sfx, scale: 1.0 });
    });
  };

  s.dispose = () => {
    players.forEach((p, i) => { if (wingsList[i]) p.remove(wingsList[i]); });
  };

  s.update = (t, dt) => {
    const k = seg(t, T_PASS, T_LAND0 + 1, E.inOutQuad);
    stage.cam(0.5, lerp(3.2, 1.7, k), lerp(9.5, 8.6, k), 0, lerp(4.5, 1.4, k), -1.5);

    players.forEach((p, i) => {
      const t0 = T_LAND0 + i * stagger;
      const tx = lineX(i, n, spacing);
      p.resetPose();
      if (t < T_PASS) {
        // 遠景をV字編隊で横切る
        const k2 = t / T_PASS;
        p.position.set(
          lerp(-22, 14, k2) - Math.abs(i - (n - 1) / 2) * 1.4,
          7.5 - Math.abs(i - (n - 1) / 2) * 0.4,
          -11 - Math.abs(i - (n - 1) / 2) * 1.2
        );
        p.rotation.set(Math.PI / 2 - 0.2, 0, -Math.PI / 2 + 0.15);
        glidePose(p);
        if (Math.random() < 0.4) {
          fx.burst({
            pos: { x: p.position.x - 0.5, y: p.position.y, z: p.position.z },
            count: 3, colors: [colors[i], '#fff7c8'], speed: 0.6, gravity: 0, life: 0.7, size: 0.1,
          });
        }
      } else if (t < t0) {
        // 旋回して戻ってくる(各自の着地点上空へ)
        const k2 = seg(t, T_PASS, t0, E.inOutQuad);
        p.position.set(
          lerp(14, tx, k2),
          lerp(7.5, 3.2, k2),
          lerp(-11, -4, k2)
        );
        p.rotation.set(Math.PI / 2 - 0.3, 0, lerp(-Math.PI / 2 + 0.15, 0, k2));
        glidePose(p);
      } else if (t < t0 + 0.45) {
        // フレア → 着地
        const k2 = seg(t, t0, t0 + 0.45, E.inOutQuad);
        p.position.set(tx, lerp(3.2, 0, k2) + Math.sin(k2 * Math.PI) * 0.5, lerp(-4, 0.4, k2));
        p.rotation.x = lerp(Math.PI / 2 - 0.3, 0, k2);
        glidePose(p);
        p.armR.shoulder.rotation.z = -1.2 * k2;
        p.armL.shoulder.rotation.z = 1.2 * k2;
      } else {
        p.position.set(tx, 0, 0.4);
        p.rotation.set(0, 0, 0);
        const up = seg(t, t0 + 0.45, t0 + 0.8, E.outQuad);
        crouchPose(p, 0.6 * (1 - up));
        if (up >= 1) heroPoses[i % heroPoses.length](p, t + i);
      }
    });
  };
  return s;
}

// =========================================================
// 15. ウィザー討伐
// =========================================================
function witherScene(ctx, state, players, colors) {
  const n = players.length;
  const s = shell(10.5, ctx);
  const { stage, fx, screen, sfx } = ctx;
  const spacing = clamp(12 / Math.max(n, 1), 0.95, 1.6);
  const T_RISE = 0.6, T_SKULLS = 2.0, T_BEAM = 4.0, T_DEATH = 4.6;
  let wither;
  const skulls = [];

  s.init = () => {
    stage.setEnv('dark');
    stage.props.add(makeCityline({ z: -32 }));
    wither = makeWither();
    wither.position.set(0, -2, -10);
    stage.props.add(wither);
    players.forEach((p, i) => {
      p.visible = true;
      p.rotation.y = 0;
      p.position.set(lineX(i, n, spacing), 0, 0.8 - Math.abs(i - (n - 1) / 2) * 0.35);
    });
    // 黒いスカル弾(3連)
    for (let i = 0; i < 3; i++) {
      const sk = new THREE.Mesh(
        new THREE.BoxGeometry(0.34, 0.32, 0.32),
        new THREE.MeshStandardMaterial({ color: 0x2c2c34, emissive: 0x1a1a3a, emissiveIntensity: 0.6 })
      );
      sk.visible = false;
      stage.props.add(sk);
      skulls.push({ mesh: sk, t0: T_SKULLS + i * 0.55, x: (i - 1) * 4.5 });
    }
    s.at(T_RISE, () => { sfx.roar(1.4); stage.shake(0.15); });
    skulls.forEach(sk => {
      s.at(sk.t0, () => sfx.pop(false));
      s.at(sk.t0 + 0.6, () => {
        sfx.boom();
        stage.shake(0.2);
        fx.fireball({ pos: { x: sk.x, y: 0.4, z: -2.5 }, r: 1.6, life: 1.1 });
        fx.ring({ pos: { x: sk.x, y: 0.05, z: -2.5 }, r1: 2.6, life: 0.5, color: 0x8a8aff });
      });
    });
    s.at(T_BEAM, () => {
      sfx.zap();
      sfx.riser(0.6);
      screen.flash('#bff8ff', 0.15, 0.4);
    });
    s.at(T_DEATH, () => {
      sfx.boom();
      sfx.roar(1.6);
      screen.flash('#ffffff', 0.45, 0.95);
      stage.shake(0.35);
      wither.visible = false;
      fx.fireball({ pos: { x: 0, y: 4.5, z: -10 }, r: 3.6, life: 1.8 });
      fx.bolt({ x: -1, z: -10, h: 8, life: 0.5 });
      fx.bolt({ x: 1.5, z: -9, h: 7, life: 0.55 });
      fx.burst({
        pos: { x: 0, y: 4.5, z: -10 }, count: 80, colors: ['#aab8ff', '#ffffff', '#5a5aff'],
        speed: 6.5, gravity: -2, life: 1.8, size: 0.13, drag: 1.2,
      });
    });
    teamTitleCues3(s, state, colors, T_DEATH + 0.7, T_DEATH + 1.3);
    s.at(T_DEATH + 2.2, () => {
      fx.bigExplosion({ pos: { x: -8, y: 0.4, z: -16 }, stage, screen, sfx, scale: 1.2 });
    });
  };

  let beam = null;
  s.update = (t, dt) => {
    stage.cam(Math.sin(t * 0.09) * 1.2, 1.6, 9.0, 0, lerp(2.6, 1.5, seg(t, T_DEATH, T_DEATH + 1.5, E.inOutQuad)), -2);

    // ウィザー: 地中からせり上がり浮遊
    if (wither.visible) {
      const riseK = seg(t, T_RISE, T_RISE + 1.2, E.outQuad);
      wither.position.y = lerp(-2, 4.5, riseK) + Math.sin(t * 1.6) * 0.3;
      wither.heads.forEach((h, i) => {
        h.rotation.y = Math.sin(t * 1.2 + i * 2) * 0.4;
      });
      // 黒い粒をまとう
      if (Math.random() < 0.3) {
        fx.burst({
          pos: { x: wither.position.x + rand(-0.8, 0.8), y: wither.position.y + rand(-0.5, 0.8), z: wither.position.z },
          count: 2, colors: ['#3a3a4a', '#5a5aff'], speed: 0.5, gravity: 0.3, life: 0.7, size: 0.08,
        });
      }
    }
    // スカル弾の飛翔
    skulls.forEach(sk => {
      const k = (t - sk.t0) / 0.6;
      if (k > 0 && k < 1) {
        sk.mesh.visible = true;
        sk.mesh.position.set(lerp(0, sk.x, k), lerp(4.5, 0.4, k) + Math.sin(k * Math.PI) * 1.2, lerp(-10, -2.5, k));
        sk.mesh.rotation.x = t * 9;
      } else {
        sk.mesh.visible = false;
      }
    });
    // チームのビーム反撃
    if (t > T_BEAM && t < T_DEATH + 0.3) {
      if (!beam) {
        beam = new THREE.Mesh(
          new THREE.CylinderGeometry(0.18, 0.18, 12, 10, 1, true),
          new THREE.MeshBasicMaterial({ color: 0xbff8ff, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false })
        );
        beam.material.toneMapped = false;
        stage.props.add(beam);
      }
      beam.visible = true;
      beam.position.set(0, 2.7, -4.6);
      beam.lookAt(0, 4.5, -10);
      beam.rotateX(Math.PI / 2);
      beam.material.opacity = 0.55 + Math.sin(t * 30) * 0.25;
    } else if (beam) {
      beam.visible = false;
    }

    players.forEach((p, i) => {
      p.resetPose();
      const x = lineX(i, n, spacing);
      const z = 0.8 - Math.abs(i - (n - 1) / 2) * 0.35;
      p.position.set(x, 0, z);
      if (t < T_BEAM) {
        // スカル弾の爆風に耐える
        const brace = skulls.some(sk => t > sk.t0 + 0.5 && t < sk.t0 + 0.9);
        if (brace) {
          crouchPose(p, 0.5);
          p.armL.shoulder.rotation.x = -1.7;
          p.armL.elbow.rotation.x = -1.2;
        } else {
          idlePose(p, t + i * 0.7);
          p.head.rotation.x = -0.35;
        }
      } else if (t < T_DEATH) {
        // 全員で正面に手をかざす(ビーム)
        crouchPose(p, 0.25);
        p.armR.shoulder.rotation.x = -1.55;
        p.armR.elbow.rotation.x = -0.1;
        p.head.rotation.x = -0.3;
      } else {
        heroPoses[i % heroPoses.length](p, t + i);
      }
    });
  };
  return s;
}

// =========================================================
// 16. 寝坊戦隊・朝の出撃
// =========================================================
function morningScene(ctx, state, players, colors) {
  const n = players.length;
  const s = shell(9.5, ctx);
  const { stage, fx, screen, sfx } = ctx;
  const spacing = clamp(13 / Math.max(n, 1), 1.1, 1.8);
  const T_CROW = 1.3, T_WAKE = 1.7, T_OFF = 2.2, T_POSE = 3.2;
  let chicken;

  s.init = () => {
    stage.setEnv('sunset'); // 朝焼け
    players.forEach((p, i) => {
      p.visible = true;
      p.rotation.order = 'YXZ';
      const bed = makeBed();
      bed.position.set(lineX(i, n, spacing), 0, -0.8);
      bed.rotation.y = 0;
      stage.props.add(bed);
    });
    chicken = makeChicken();
    chicken.position.set(lineX(0, n, spacing) - 1.6, 0, 1.2);
    chicken.rotation.y = 0.6;
    stage.props.add(chicken);
    // ニワトリが鳴く(コケコッコー風)
    s.at(T_CROW, () => {
      sfx.alarm();
      sfx.howl(0.7);
    });
    s.at(T_WAKE, () => { sfx.pop(true); stage.shake(0.06); });
    players.forEach((p, i) => {
      s.at(T_POSE + i * 0.12, () => sfx.hit(280 + (i % 8) * 36, 0.35));
    });
    teamTitleCues3(s, state, colors, 4.0, 4.6);
    s.at(5.3, () => fx.bigExplosion({ pos: { x: 3, y: 0.4, z: -17 }, stage, screen, sfx, scale: 1.5 }));
    s.at(5.9, () => fx.bigExplosion({ pos: { x: -8, y: 0.3, z: -15 }, stage, screen, sfx, scale: 1.0 }));
  };

  let zAcc = 0;
  s.update = (t, dt) => {
    stage.cam(0.6, 1.7, 7.6, 0, 1.1, -0.5);

    // ZZZ
    zAcc += dt;
    if (t < T_CROW && zAcc > 0.4) {
      zAcc = 0;
      const i = Math.floor(rand(n));
      fx.burst({
        pos: { x: lineX(i, n, spacing) + 0.3, y: 1.1, z: -0.5 }, count: 2, colors: ['#cfd8ff'],
        speed: 0.4, dir: { x: 0.3, y: 1, z: 0 }, gravity: 0.6, life: 1.1, size: 0.09,
      });
    }
    // ニワトリ: 鳴くとき羽ばたき
    if (t > T_CROW - 0.1 && t < T_CROW + 0.7) {
      chicken.flap(t, 1);
      chicken.head.rotation.x = -0.6;
    } else {
      chicken.flap(t, 0);
      mobWalkSafe(chicken, t);
    }

    players.forEach((p, i) => {
      const x = lineX(i, n, spacing);
      const jitter = i * 0.07; // 起きるタイミングが微妙にバラける
      p.resetPose();
      if (t < T_WAKE + jitter) {
        // ベッドで爆睡
        p.rotation.set(-Math.PI / 2, 0, 0);
        p.position.set(x, 0.62, -0.95);
        p.armL.shoulder.rotation.x = -2.6;
        if (t > T_CROW) p.position.y = 0.62 + Math.random() * 0.04;
      } else if (t < T_OFF + jitter) {
        // ガバッ
        const k = seg(t, T_WAKE + jitter, T_OFF + jitter, E.outBack);
        p.rotation.set(-Math.PI / 2 * (1 - k), 0, 0);
        p.position.set(x, lerp(0.62, 0, k), lerp(-0.95, 0.2, k));
        p.armR.shoulder.rotation.x = -2.8 * k;
        p.armL.shoulder.rotation.x = -2.8 * k;
      } else if (t < T_POSE + i * 0.12) {
        // 大慌てで整列位置へ
        p.rotation.set(0, 0, 0);
        p.position.set(x, 0, lerp(0.2, 1.0, seg(t, T_OFF + jitter, T_POSE, E.outQuad)));
        runPose(p, t + i, { speed: 15, amp: 1.0, lean: 0.3 });
      } else {
        p.rotation.set(0, 0, 0);
        p.position.set(x, 0, 1.0);
        heroPoses[i % heroPoses.length](p, t + i);
      }
    });
  };
  return s;
}

// ニワトリの待機モーション(脚だけ)
function mobWalkSafe(mob, t) {
  if (mob.legs) mob.legs.forEach((l, i) => { l.rotation.x = Math.sin(t * 2 + i) * 0.08; });
  if (mob.head) mob.head.rotation.x = Math.sin(t * 4) * 0.2;
}

// =========================================================
export const TEAM_FACTORIES3 = {
  elytrasquad: elytrasquadScene,
  wither: witherScene,
  morning: morningScene,
};

// =========================================================
// 演出レジストリ(全セクションの定義が揃った後に構築する)
// =========================================================
const FACTORIES = {
  ...TEAM_FACTORIES2,
  ...TEAM_FACTORIES3,
  assemble: assembleScene,
  sunset: sunsetScene,
  orbit: orbitScene,
  rollcall: rollcallScene,
  jumpfreeze: jumpfreezeScene,
  coolwalk: coolwalkScene,
};

export function createTeamScene(id, ctx, state, players, colors) {
  const factory = FACTORIES[id] || assembleScene;
  return factory(ctx, state, players, colors);
}
