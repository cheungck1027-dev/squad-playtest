// 戰鬥畫面：背景、車道線、門、敵人；小隊交俾 squad-view.js。只讀狀態，唔改狀態。
// 畫嘅次序：背景 → 路面區域 → 場上物件（遠至近）→ 小隊同彈道 → 特效 → 全畫面濾色 → HUD。

import { TUNING } from '../data/tuning.js';
import { findCover, gateShape } from './cover.js';
import { COLORS, drawTag, setFont } from './draw.js';
import { drawBooms, drawDebris, drawNumbers, drawProjectile, drawSpeedLines, drawStrikes, drawZones } from './effects.js';
import { drawHud } from './hud.js';
import { MAX_DISTANCE, MIN_DISTANCE, distanceAtScale, horizonY, roadHalfWidth, scaleAt, screenX, screenY } from './projection.js';
import { drawMember, drawSquadOverlay, poseSquad } from './squad-view.js';

const HOR = TUNING.view.horizon;

/**
 * @param {HTMLCanvasElement} canvas
 * @param {import('../core/assets.js').AssetStore} assets
 * @param {{ screenShake?: () => boolean, clips?: import('../core/clips.js').ClipStore | null }} [opts]
 *   clips = 動畫片段播放器；唔傳就全部用靜態圖
 */
export function createBattleRenderer(canvas, assets, opts = {}) {
  const ctx = canvas.getContext('2d');
  /** @type {import('./projection.js').View} */
  const view = { W: 540, H: 960, u: 1, dpr: 1 };
  const clips = opts.clips ?? null;
  /** 最近嘅重繪時間（ms），量度每格成本用 */
  const perf = { sum: 0, n: 0, max: 0 };

  function resize() {
    const r = canvas.getBoundingClientRect();
    view.dpr = Math.min(2, globalThis.devicePixelRatio || 1);
    view.W = Math.max(270, r.width);
    view.H = Math.max(480, r.height);
    view.u = view.W / 540;
    canvas.width = view.W * view.dpr;
    canvas.height = view.H * view.dpr;
  }

  /** @param {import('./state.js').BattleState} state */
  function draw(state) {
    const t0 = globalThis.performance.now();
    const { W, H, dpr } = view;
    clips?.beginFrame();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    ctx.save();
    if (state.shake > 0 && (opts.screenShake?.() ?? true)) {
      // 震動係純視覺，用 Math.random() 冇問題
      ctx.translate((Math.random() * 2 - 1) * state.shake * 16, (Math.random() * 2 - 1) * state.shake * 16);
    }
    drawBackground(ctx, view, state, assets);
    drawZones(ctx, view, state, assets);
    // 門、敵人、隊員都企喺路面：一齊由遠到近畫，近嘅遮住遠嘅
    const posed = poseSquad(view, state);
    /** @type {Map<string, [number, number]>} */
    const origins = new Map();
    // 隊員擋住身後嘅門或者敵人：嗰個隊員變半透明，被擋嘅數字畫多次喺最面
    const cover = findCover(view, posed, state.ents);
    for (const e of [...state.ents, ...posed].sort((a, b) => b.d - a.d)) {
      if ('member' in e) drawMember(ctx, view, state, assets, clips, e.member, e.pose, origins, cover.members.has(e.member));
      else if (e.type === 'gate') drawGate(ctx, view, e);
      else if (e.type === 'projectile') drawProjectile(ctx, view, e);
      else if (e.type === 'pickup') drawPickup(ctx, view, state, e);
      else drawEnemy(ctx, view, state, e, assets);
    }
    for (const e of cover.ents) {
      if (e.type === 'gate') drawGateLabel(ctx, view, e);
      else drawEnemyTag(ctx, view, state, e);
    }
    // 主角條車道、射程內嘅門：數字再畫一次喺最面，唔好俾主角個背影遮住；射得郁嗰啲仲要夠大（遠處嘅門好細，但要睇到個數一粒一粒加）
    for (const e of state.ents) {
      if (e.type === 'gate' && e.lane === state.lane && e.d > 0 && e.d < TUNING.world.targetDistance) drawGateLabel(ctx, view, e, e.op === 'add' || e.op === 'sub' ? 17 * view.u : 0);
    }
    drawSquadOverlay(ctx, view, state, assets, posed, origins);
    drawBullets(ctx, view, state, origins.get('m0'));
    drawStrikes(ctx, view, state, assets);
    drawDebris(ctx, view, state);
    drawBooms(ctx, view, state);
    drawNumbers(ctx, view, state);
    // 速度線：步行冇，飛行同超載先有
    if (state.over > 0 || state.flight.air > 0.5) drawSpeedLines(ctx, view, state);
    ctx.restore();

    // 暗角
    const v = ctx.createRadialGradient(W / 2, H * 0.55, H * 0.3, W / 2, H * 0.55, H * 0.75);
    v.addColorStop(0, 'rgba(10,12,30,0)'); v.addColorStop(1, 'rgba(10,12,30,.5)');
    ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
    // OVERDRIVE 期間成個畫面泛青
    if (state.over > 0) { ctx.fillStyle = `rgba(95,240,255,${0.07 + Math.sin(state.t * 10) * 0.03})`; ctx.fillRect(0, 0, W, H); }
    // 過門一刻閃白
    if (state.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${state.flash * 1.2})`; ctx.fillRect(0, 0, W, H); }

    drawHud(ctx, view, state);

    const ms = globalThis.performance.now() - t0;
    perf.sum += ms; perf.n++; if (ms > perf.max) perf.max = ms;
  }

  /** 由上次叫到而家，每次重繪平均同最耐用咗幾耐（ms）。叫完歸零。 */
  function takePerf() {
    const out = { frames: perf.n, avgMs: perf.n ? +(perf.sum / perf.n).toFixed(3) : 0, maxMs: +perf.max.toFixed(3) };
    perf.sum = 0; perf.n = 0; perf.max = 0;
    return out;
  }

  return { view, resize, draw, takePerf };
}

// ---------- 背景同車道 ----------

function drawBackground(ctx, view, state, assets) {
  const { W, H, u } = view;
  const RW = roadHalfWidth(view);
  const bg = assets.get(state.stage.background);

  if (bg.ok) {
    // 背景圖本身嘅地平線喺 backgroundHorizon。以消失點為中心放大成張圖（路邊線嘅斜度唔變），
    // 再將圖嘅地平線對準而家嘅地平線；放大倍數要夠大，等圖嘅底邊仍然蓋到畫面底。
    const BGH = TUNING.view.backgroundHorizon;
    const s0 = Math.max(W / bg.img.width, H / bg.img.height), h0 = bg.img.height * s0;
    const inImage = (BGH * H - (H - h0) / 2) / h0;             // 地平線喺圖入面嘅比例
    const k = Math.max(1, (H - HOR * H) / (h0 * (1 - inImage)));
    const w = bg.img.width * s0 * k, h = h0 * k;
    ctx.drawImage(bg.img, (W - w) / 2, HOR * H - inImage * h, w, h);
  } else {
    // 冇背景圖：程式畫天空、遠處大廈、地面同路面
    let g = ctx.createLinearGradient(0, 0, 0, H * HOR);
    g.addColorStop(0, '#5d6480'); g.addColorStop(1, '#b9b5c9');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H * HOR + 2);
    ctx.fillStyle = '#7d7f96';
    for (let i = 0; i < 16; i++) {
      const x = (i * 97 % 100) / 100 * W, h = (30 + i * 53 % 90) / 960 * H;
      if (Math.abs(x - W / 2) > W * 0.07) ctx.fillRect(x - 14, H * HOR - h, 26, h);
    }
    g = ctx.createLinearGradient(0, H * HOR, 0, H);
    g.addColorStop(0, '#8b8d9f'); g.addColorStop(1, '#3d4052');
    ctx.fillStyle = g; ctx.fillRect(0, H * HOR, W, H);
    ctx.fillStyle = '#4a4d60';
    ctx.beginPath();
    ctx.moveTo(W / 2 - RW * scaleAt(MAX_DISTANCE), screenY(view, MAX_DISTANCE));
    ctx.lineTo(W / 2 + RW * scaleAt(MAX_DISTANCE), screenY(view, MAX_DISTANCE));
    ctx.lineTo(W / 2 + RW * 1.5, H); ctx.lineTo(W / 2 - RW * 1.5, H);
    ctx.fill();
  }

  // 車道虛線（程式畫，會流動）
  ctx.fillStyle = 'rgba(235,240,255,.75)';
  for (const side of [-1, 1]) {
    const FAR = TUNING.world.spawnDistance + 3; // 再遠嘅虛線喺畫面已經縮埋一齊，唔畫
    for (let k = -1; k * 5 < FAR + 5; k++) {
      const d1 = k * 5 - state.scroll % 5, d2 = d1 + 2.2;
      if (d2 < MIN_DISTANCE || d1 > FAR) continue;
      const a = Math.max(MIN_DISTANCE, d1), b = Math.max(MIN_DISTANCE, d2);
      const xa = W / 2 + side * RW / 3 * scaleAt(a), xb = W / 2 + side * RW / 3 * scaleAt(b);
      const wa = 5 * scaleAt(a) * u, wb = 5 * scaleAt(b) * u;
      ctx.globalAlpha = Math.max(0, Math.min(1, (FAR - d1) / 6));
      ctx.beginPath();
      ctx.moveTo(xa - wa, screenY(view, a)); ctx.lineTo(xa + wa, screenY(view, a));
      ctx.lineTo(xb + wb, screenY(view, b)); ctx.lineTo(xb - wb, screenY(view, b));
      ctx.fill();
    }
  }
  // 路邊實線
  ctx.globalAlpha = 1;
  ctx.strokeStyle = 'rgba(235,240,255,.4)'; ctx.lineWidth = 2 * u;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(W / 2 + side * RW * scaleAt(MAX_DISTANCE), screenY(view, MAX_DISTANCE));
    ctx.lineTo(W / 2 + side * RW * scaleAt(MIN_DISTANCE), screenY(view, MIN_DISTANCE));
    ctx.stroke();
  }
  // 地平線嘅霧
  const f = ctx.createLinearGradient(0, H * (HOR - 0.1), 0, H * (HOR + 0.16));
  f.addColorStop(0, 'rgba(200,200,220,0)'); f.addColorStop(0.45, 'rgba(200,200,220,.5)'); f.addColorStop(1, 'rgba(200,200,220,0)');
  ctx.fillStyle = f; ctx.fillRect(0, horizonY(view) - H * 0.1, W, H * 0.26);
}

// ---------- 場上物件 ----------

/**
 * 主角嘅子彈同命中閃光。子彈：一粒一粒，白芯亮色彈頭加一條短尾跡，外面一圈深色邊（喺灰路面、紅綠門上面都睇得清）。
 * 由槍口出發，飄返入車道中線，喺畫面勻速向上飛。
 * @param {[number, number] | undefined} muzzle  槍口嘅畫面位置
 */
function drawBullets(ctx, view, state, muzzle) {
  const { u, H } = view, B = TUNING.bullets, F = TUNING.firepower;
  const u0 = 1 - scaleAt(TUNING.world.minTargetDistance);
  // 喺路面上空嘅位置（畫面深度 p）
  const onRoad = (b, p) => {
    const d = distanceAtScale(1 - p), s = 1 - p;
    return [screenX(view, b.lane, d) + b.k * F.streamGap * u * Math.sqrt(s), screenY(view, d) - H * B.aimHeight * s];
  };
  // 啱啱離開槍口嗰段：由槍口位置平滑飄去路面上空嗰條線
  const at = (b, p) => {
    const [rx, ry] = onRoad(b, Math.max(u0, p));
    if (!muzzle) return [rx, ry];
    const t = Math.min(1, Math.max(0, (p - u0) / B.blend)), e = t * t * (3 - 2 * t);
    const mx = muzzle[0] + b.k * F.streamGap * u * Math.sqrt(1 - u0), my = muzzle[1] - (p - u0) * (screenY(view, 0) - H * TUNING.view.horizon);
    return [mx + (rx - mx) * e, my + (ry - my) * e];
  };
  ctx.save();
  ctx.lineCap = 'round';
  for (const b of state.bullets) {
    const tier = F.tiers[b.tier] ?? F.tiers[0], s = 1 - b.u;
    const [x, y] = at(b, b.u), [tx, ty] = at(b, Math.max(u0, b.u - B.length));
    const r = Math.max(B.minSize, B.size * (0.8 + tier.width * 0.08) * u * Math.sqrt(s));
    // 尾跡：深色底 + 亮色
    ctx.strokeStyle = 'rgba(10,14,28,.55)'; ctx.lineWidth = r * 1.5;
    ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(x, y); ctx.stroke();
    ctx.strokeStyle = `rgba(${tier.color},.85)`; ctx.lineWidth = r * 0.9;
    ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(x, y); ctx.stroke();
    // 彈頭：深色邊、亮色、白芯
    ctx.fillStyle = 'rgba(10,14,28,.7)';
    ctx.beginPath(); ctx.arc(x, y, r * 1.3, 0, 7); ctx.fill();
    ctx.fillStyle = `rgb(${tier.color})`;
    ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(x, y, r * 0.55, 0, 7); ctx.fill();
  }
  // 命中閃光：一粒白光爆開再收細，外面一個擴開嘅圈
  ctx.globalCompositeOperation = 'lighter';
  for (const f of state.fx) {
    if (f.k !== 'spark') continue;
    const k = 1 - f.t / f.life, s = scaleAt(f.at.d), tier = F.tiers[f.tier] ?? F.tiers[0];
    const x = screenX(view, f.at.lane, f.at.d) + (f.at.jx ?? 0) * u * Math.sqrt(s), y = screenY(view, f.at.d) - H * (f.at.hk ?? 0) * s;
    const r = Math.max(6, 20 * u * Math.sqrt(s)) * (0.6 + (1 - k) * 0.8);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(255,255,255,${k})`); g.addColorStop(0.4, `rgba(${tier.color},${0.8 * k})`); g.addColorStop(1, `rgba(${tier.color},0)`);
    ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  ctx.restore();
}

/** 遠處淡入 */
const fadeIn = (d) => Math.max(0, Math.min(1, (TUNING.world.spawnDistance - d) / TUNING.world.fadeInDistance));

/**
 * 門：兩條門柱加一條橫樑嘅實體門框，中間一塊半透明嘅光幕，數字夠大，遠處都睇得清。
 * @param {import('./spawning.js').GateEntity} e
 */
function drawGate(ctx, view, e) {
  const { u } = view;
  const { x, y, s, laneW, hw, h } = gateShape(view, e);
  const post = Math.max(1.5, laneW * 0.07), beam = Math.max(1.5, laneW * 0.06);
  const c = e.good ? '70,235,170' : '255,90,105';

  ctx.globalAlpha = fadeIn(e.d);
  // 光幕
  const g = ctx.createLinearGradient(0, y - h, 0, y);
  g.addColorStop(0, `rgba(${c},.5)`); g.addColorStop(0.75, `rgba(${c},.26)`); g.addColorStop(1, `rgba(${c},.1)`);
  ctx.fillStyle = g; ctx.fillRect(x - hw, y - h, hw * 2, h);
  ctx.strokeStyle = `rgba(${c},1)`; ctx.lineWidth = Math.max(1, 2.5 * s * u);
  ctx.strokeRect(x - hw, y - h, hw * 2, h);
  // 門框：橫樑同兩條門柱（柱腳闊少少，企穩喺地）
  ctx.fillStyle = '#1b2030';
  ctx.fillRect(x - hw - post, y - h - beam, hw * 2 + post * 2, beam);
  for (const side of [-1, 1]) {
    const px = side < 0 ? x - hw - post : x + hw;
    ctx.fillRect(px, y - h, post, h);
    ctx.fillRect(px - post * 0.25, y - post * 0.5, post * 1.5, post * 0.5);
  }
  // 門柱上嘅燈條
  ctx.fillStyle = `rgba(${c},.95)`;
  for (const side of [-1, 1]) {
    const px = side < 0 ? x - hw - post * 0.65 : x + hw + post * 0.35;
    ctx.fillRect(px, y - h * 0.86, post * 0.3, h * 0.5);
  }
  // 俾人射中：光幕閃一下白
  if (e.hit > 0) { ctx.fillStyle = `rgba(255,255,255,${0.35 * Math.min(1, e.hit / TUNING.gateShoot.hitTime)})`; ctx.fillRect(x - hw, y - h, hw * 2, h); }
  // 由負轉正：成道門爆白再變綠，一個框向外擴開
  if (e.flipT > 0) {
    const k = e.flipT / TUNING.gateShoot.flipTime; // 1 → 0
    ctx.fillStyle = `rgba(255,255,255,${0.85 * k * k})`; ctx.fillRect(x - hw, y - h, hw * 2, h);
    const grow = (1 - k) * hw * 0.9;
    ctx.strokeStyle = `rgba(160,255,215,${k})`; ctx.lineWidth = Math.max(1.5, 5 * s * u * k);
    ctx.strokeRect(x - hw - grow, y - h - grow, (hw + grow) * 2, h + grow * 2);
  }
  ctx.globalAlpha = 1;
  drawGateLabel(ctx, view, e);
}

/** 門上面嘅數字。 */
function drawGateLabel(ctx, view, e, minSize = 0) {
  const { x, y, s, laneW, h } = gateShape(view, e);
  ctx.globalAlpha = fadeIn(e.d);
  // 數字每變一次跳大少少；由負轉正嗰下跳得更大
  const pop = e.flipT > 0 ? 0.6 * (e.flipT / TUNING.gateShoot.flipTime) : e.pop > 0 ? 0.3 * (e.pop / TUNING.gateShoot.popTime) : 0;
  setFont(ctx, Math.max(7, minSize, laneW * 0.36) * (1 + pop), 800);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineWidth = Math.max(1.5, laneW * 0.05); ctx.strokeStyle = 'rgba(12,16,30,.8)'; ctx.lineJoin = 'round';
  ctx.strokeText(e.label, x, y - h * 0.52);
  ctx.fillStyle = '#fff'; ctx.shadowColor = `rgba(${e.good ? '70,235,170' : '255,90,105'},1)`; ctx.shadowBlur = 16 * s;
  ctx.fillText(e.label, x, y - h * 0.52);
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;
}

/**
 * 飛行核心：浮喺路面上空嘅青色發光菱形，冇字。
 * @param {import('./spawning.js').PickupEntity} e
 */
function drawPickup(ctx, view, state, e) {
  const { u } = view;
  const s = scaleAt(e.d), x = screenX(view, e.lane, e.d), ground = screenY(view, e.d);
  const r = 46 * s * u, y = ground - 120 * s * u + Math.sin(state.t * 4 + e.lane) * 8 * s * u;
  const pulse = 0.75 + Math.sin(state.t * 9) * 0.25;
  ctx.globalAlpha = fadeIn(e.d);
  // 地面嘅光
  ctx.fillStyle = `rgba(95,240,255,${0.28 * pulse})`;
  ctx.beginPath(); ctx.ellipse(x, ground, r * 1.1, r * 0.26, 0, 0, 7); ctx.fill();
  // 光暈
  const g = ctx.createRadialGradient(x, y, 0, x, y, r * 2.4);
  g.addColorStop(0, `rgba(95,240,255,${0.6 * pulse})`); g.addColorStop(1, 'rgba(95,240,255,0)');
  ctx.fillStyle = g; ctx.fillRect(x - r * 2.4, y - r * 2.4, r * 4.8, r * 4.8);
  // 菱形：外層青色，內芯白
  const diamond = (k) => { ctx.beginPath(); ctx.moveTo(x, y - r * 1.25 * k); ctx.lineTo(x + r * 0.78 * k, y); ctx.lineTo(x, y + r * 1.25 * k); ctx.lineTo(x - r * 0.78 * k, y); ctx.closePath(); };
  diamond(1); ctx.fillStyle = 'rgba(40,200,235,.95)'; ctx.fill();
  ctx.strokeStyle = '#eaffff'; ctx.lineWidth = Math.max(1, 3 * s * u); ctx.stroke();
  diamond(0.5); ctx.fillStyle = `rgba(255,255,255,${0.75 + 0.25 * pulse})`; ctx.fill();
  ctx.globalAlpha = 1;
}

/** @param {import('./spawning.js').EnemyEntity} e */
function drawEnemy(ctx, view, state, e, assets) {
  const { u } = view;
  const L = e.def.look, im = assets.get(e.def.asset);
  const s = scaleAt(e.d), x = screenX(view, e.lane, e.d), y = screenY(view, e.d);
  const size = L.size * s * u;
  const bob = Math.sin(state.t * L.bobSpeed + e.ph) * L.bobAmp * s;
  const lift = size * L.lift;

  ctx.globalAlpha = fadeIn(e.d);
  // 地面陰影
  ctx.fillStyle = 'rgba(10,12,22,.35)';
  ctx.beginPath(); ctx.ellipse(x, y, size * 0.32, size * 0.07, 0, 0, 7); ctx.fill();

  // 中重擊：向受力方向側傾、彈開少少，再回正
  const st = e.stagger > 0 ? Math.sin((e.stagger / TUNING.feedback.staggerTime) * Math.PI) : 0;
  const tilt = st * 0.22 * (e.staggerDir || 1) * (e.boss ? 0.25 : 1);
  if (st) { ctx.save(); ctx.translate(x + tilt * size * 0.5, y); ctx.rotate(tilt); ctx.translate(-x, -y); }

  if (im.ok) {
    const w = size * L.widthMul, h = w * im.img.height / im.img.width;
    if (e.hit > 0) ctx.filter = L.hitFilter;
    ctx.drawImage(im.img, x - w / 2, y - h - lift + bob, w, h);
    ctx.filter = 'none';
  } else {
    // 冇圖：深色方塊加一粒紅眼
    const w = size * L.blockSize[0], h = size * L.blockSize[1];
    ctx.fillStyle = e.hit > 0 ? '#fff' : '#23262f';
    ctx.beginPath(); ctx.roundRect(x - w / 2, y - h - lift + bob, w, h, 10 * s); ctx.fill();
    ctx.fillStyle = '#ff5a3a';
    ctx.beginPath(); ctx.arc(x, y - h / 2 - lift + bob, size * 0.12, 0, 7); ctx.fill();
  }
  if (st) ctx.restore();
  ctx.globalAlpha = 1;
  drawEnemyTag(ctx, view, state, e);
}

/** 敵人頭上嘅血量牌。 */
function drawEnemyTag(ctx, view, state, e) {
  const L = e.def.look;
  if (L.tagHeight === undefined) return;
  const s = scaleAt(e.d), size = L.size * s * view.u;
  const bob = Math.sin(state.t * L.bobSpeed + e.ph) * L.bobAmp * s;
  ctx.globalAlpha = fadeIn(e.d);
  drawTag(ctx, screenX(view, e.lane, e.d), screenY(view, e.d) - size * L.tagHeight + bob, String(Math.max(0, Math.ceil(e.hp - 1e-9))), Math.max(0.35, s * 1.5) * (e.boss ? 1.6 : 1) * view.u, COLORS.red);
  ctx.globalAlpha = 1;
}
