// 特效：彈道、爆炸、飄字。
// 上半部係資料（邏輯用嚟加特效，全部用「車道 + 距離」記位置，唔掂畫布）；
// 下半部係繪畫（將資料投影到畫面再畫）。

import { TUNING } from '../data/tuning.js';
import { horizonY, roadHalfWidth, scaleAt, screenX, screenY } from './projection.js';
import { COLORS, setFont } from './draw.js';

const F = TUNING.feedback;

/**
 * 場上一個點：車道 lane、距離 d，再加偏移。
 * jx = 橫向偏移（像素，會跟距離縮細）；hk = 離地高度（× 畫面高，會跟距離縮細）；dy = 再向上移幾多像素。
 * @typedef {{ lane: number, d: number, jx?: number, hk?: number, dy?: number }} WorldPoint
 */

/**
 * @typedef {{ color: string, width: number, life: number }} TracerLook   彈道外觀：顏色（R,G,B）、粗幼、維持幾耐
 * @typedef {{ k: 'shot', at: WorldPoint, t: number, from?: string, look?: TracerLook, life?: number, ox?: number }} ShotEffect
 *   一發子彈打中嘅位置；彈道由 from 指嘅發射點畫過去（'m0' = 隊長槍口，'m3d1' = 第 3 個隊員嘅第 1 部浮游砲；唔填 = 隊長）
 * @typedef {{ k: 'boom', at: WorldPoint, scale: number, t: number }} BoomEffect
 * @typedef {{ k: 'slash', lo: number, hi: number, d: number, asset: string, t: number }} SlashEffect   刀光：橫跨 lo 至 hi 車道
 * @typedef {{ k: 'ring', at: WorldPoint, color: string, scale: number, t: number }} RingEffect   衝擊波環
 * @typedef {{ k: 'debris', at: WorldPoint, n: number, dir: number, seed: number, t: number }} DebrisEffect   甩出嚟嘅裝甲碎片同火花
 * @typedef {{ k: 'spark', at: WorldPoint, tier: number, t: number, life: number }} SparkEffect   子彈命中點嘅小閃光
 * @typedef {ShotEffect | BoomEffect | SlashEffect | RingEffect | DebrisEffect | SparkEffect} Effect
 */

/**
 * 飄字。at 係場上一個點，或者 { leaderX } = 跟隊長當時嘅橫向位置、喺佢頭頂出。
 * @typedef {Object} FloatNumber
 * @property {string} txt
 * @property {'gain' | 'loss' | 'hit' | 'slash' | 'ram' | 'drone' | 'formula'} tone
 * @property {boolean} big
 * @property {number} [size]   字嘅大細（以 540 闊畫面計）；唔填就睇 big
 * @property {WorldPoint | { leaderX: number }} at
 * @property {number} t
 */

// ---------- 資料 ----------

/**
 * @param {import('./state.js').BattleState} state
 * @param {WorldPoint} at
 * @param {string} [from]        發射點
 * @param {TracerLook} [look]
 * @param {number} [ox]          發射點向右錯開幾多（以 540 闊畫面計；多道彈道並排用）
 */
export function addShot(state, at, from, look, ox) {
  /** @type {ShotEffect} */
  const fx = { k: 'shot', at, t: 0 };
  if (ox) fx.ox = ox;
  if (from) fx.from = from;
  if (look) { fx.look = look; fx.life = look.life; }
  state.fx.push(fx);
}

/** 刀光，橫跨 lo 至 hi 車道，喺距離 d。 */
export function addSlash(state, lo, hi, d, asset) {
  state.fx.push({ k: 'slash', lo, hi, d, asset, t: 0 });
}

/** 裝甲碎片同火花：n 塊，向 dir（-1 左 / 1 右 / 0 四散）飛。seed 決定每塊點飛（純視覺）。 */
export function addDebris(state, at, n, dir, seed) {
  state.fx.push({ k: 'debris', at, n, dir, seed, t: 0 });
}

/** 衝擊波環。color = 'R,G,B'。 */
export function addRing(state, at, color, scale = 1) {
  state.fx.push({ k: 'ring', at, color, scale, t: 0 });
}

/** @param {import('./state.js').BattleState} state @param {WorldPoint} at @param {number} scale */
export function addBoom(state, at, scale) {
  state.fx.push({ k: 'boom', at, scale, t: 0 });
}

/**
 * @param {import('./state.js').BattleState} state
 * @param {FloatNumber['at']} at
 * @param {string | number} txt
 * @param {FloatNumber['tone']} tone
 * @param {boolean} [big]
 */
export function addNumber(state, at, txt, tone, big = false, size) {
  /** @type {FloatNumber} */
  const n = { txt: String(txt), tone, big, at, t: 0 };
  if (size) n.size = size;
  state.nums.push(n);
}

/** 特效計時，過期就清走。 */
export function ageEffects(state, dt) {
  for (const f of state.fx) f.t += dt;
  state.fx = state.fx.filter((f) => f.t < fxLife(f));
  for (const n of state.nums) n.t += dt;
  state.nums = state.nums.filter((n) => n.t < F.numberLife);
}

const FX_LIFE = { shot: F.shotLife, boom: F.boomLife, slash: F.slashLife, ring: F.ringLife, debris: F.debrisLife };
const fxLife = (f) => f.life ?? FX_LIFE[f.k];

// ---------- 繪畫 ----------


/** @param {import('./projection.js').View} view @param {WorldPoint} p @returns {[number, number]} */
function project(view, p) {
  const s = scaleAt(p.d);
  return [
    screenX(view, p.lane, p.d) + (p.jx ?? 0) * s,
    screenY(view, p.d) - view.H * (p.hk ?? 0) * s - (p.dy ?? 0),
  ];
}

/**
 * 由發射點畫去每個彈著點。
 * @param {Map<string, [number, number]>} origins  發射點（key 見 ShotEffect.from）；搵唔到就用隊長槍口 'm0'
 */
export function drawTracers(ctx, view, state, origins) {
  const { u } = view;
  const fallback = origins.get('m0');
  for (const f of state.fx) {
    if (f.k !== 'shot') continue;
    const o0 = origins.get(f.from ?? 'm0') ?? fallback;
    if (!o0) continue;
    const o = [o0[0] + (f.ox ?? 0) * u, o0[1]];
    const [x, y] = project(view, f.at);
    const k = 1 - f.t / fxLife(f);
    if (f.look) {
      // 粗啲嘅光束：外面一層色、入面一條白芯
      ctx.lineCap = 'round';
      ctx.strokeStyle = `rgba(${f.look.color},${k * 0.9})`;
      ctx.lineWidth = f.look.width * u * (0.4 + 0.6 * k);
      ctx.beginPath(); ctx.moveTo(o[0], o[1]); ctx.lineTo(x, y); ctx.stroke();
      ctx.strokeStyle = `rgba(255,255,255,${k})`;
      ctx.lineWidth = Math.max(1, f.look.width * 0.3 * u * k);
      ctx.beginPath(); ctx.moveTo(o[0], o[1]); ctx.lineTo(x, y); ctx.stroke();
      ctx.lineCap = 'butt';
    } else {
      ctx.strokeStyle = `rgba(150,245,255,${k})`;
      ctx.lineWidth = 2.5 * u;
      ctx.beginPath(); ctx.moveTo(o[0], o[1]); ctx.lineTo(x, y); ctx.stroke();
    }
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(x, y, 5 * u * k + 1, 0, 7); ctx.fill();
  }
}

/** 刀光同衝擊波環。 */
export function drawStrikes(ctx, view, state, assets) {
  const { u } = view;
  for (const f of state.fx) {
    if (f.k === 'slash') {
      const k = f.t / F.slashLife, s = scaleAt(f.d);
      const laneW = roadHalfWidth(view) * (2 / 3) * s;
      const cx = (screenX(view, f.lo, f.d) + screenX(view, f.hi, f.d)) / 2;
      const w = (f.hi - f.lo + 1.9) * laneW * (0.85 + 0.3 * k);
      const cy = screenY(view, f.d) - view.H * 0.07 * s;
      const im = assets.get(f.asset);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = Math.min(1, (1 - k) * 1.8);
      if (im.ok) {
        const h = w * im.img.height / im.img.width;
        // 由左掃到右：頭三分一時間逐步揭開
        const reveal = Math.min(1, k * 3 + 0.25);
        ctx.beginPath(); ctx.rect(cx - w / 2, cy - h, w * reveal, h * 2); ctx.clip();
        ctx.drawImage(im.img, cx - w / 2, cy - h / 2, w, h);
        ctx.drawImage(im.img, cx - w / 2, cy - h / 2, w, h); // 疊多一次，光啲
      } else {
        ctx.strokeStyle = 'rgba(255,190,90,1)'; ctx.lineWidth = 10 * u * s * (1 - k) + 1; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.ellipse(cx, cy + w * 0.12, w / 2, w * 0.16, 0, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
      }
      ctx.restore();
    } else if (f.k === 'ring') {
      const [x, y] = project(view, f.at);
      const k = f.t / F.ringLife, s = scaleAt(f.at.d);
      const r = (40 + 150 * k) * f.scale * s * u;
      ctx.strokeStyle = `rgba(${f.color},${1 - k})`;
      ctx.lineWidth = Math.max(1, 9 * s * u * (1 - k));
      ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.42, 0, 0, 7); ctx.stroke();
      ctx.fillStyle = `rgba(${f.color},${0.25 * (1 - k)})`;
      ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.42, 0, 0, 7); ctx.fill();
    }
  }
}

/** 簡單嘅固定亂數：同一個 seed 同 i 永遠出同一個 0–1 嘅數（碎片每格都要喺同一條軌跡上）。 */
const rnd = (seed, i) => { const v = Math.sin(seed * 9301.7 + i * 127.1) * 43758.5453; return v - Math.floor(v); };

/** 裝甲碎片同火花：由受擊點彈開，受重力落返地面，一路轉一路淡出。 */
export function drawDebris(ctx, view, state) {
  const { u } = view;
  for (const f of state.fx) {
    if (f.k !== 'debris') continue;
    const [x0, y0] = project(view, f.at);
    const s = scaleAt(f.at.d), t = f.t, k = t / F.debrisLife;
    for (let i = 0; i < f.n; i++) {
      const a = rnd(f.seed, i), b = rnd(f.seed, i + 50), c = rnd(f.seed, i + 100);
      const vx = ((f.dir ? f.dir * (0.4 + a) : a * 2 - 1) * 260) * s * u;
      const vy = -(160 + b * 260) * s * u;
      const x = x0 + vx * t, y = y0 + vy * t + 900 * s * u * t * t;
      const size = (5 + c * 9) * s * u;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - k * k);
      ctx.translate(x, y); ctx.rotate(t * (6 + a * 10) * (i % 2 ? 1 : -1));
      if (i % 3 === 2) {
        // 火花：一條短亮線
        ctx.strokeStyle = 'rgba(255,200,110,1)'; ctx.lineWidth = Math.max(1, 2 * s * u);
        ctx.beginPath(); ctx.moveTo(-size, 0); ctx.lineTo(size, 0); ctx.stroke();
      } else {
        // 裝甲片：一塊深灰色嘅碎片，有一邊光
        ctx.fillStyle = '#4b4f62';
        ctx.beginPath(); ctx.moveTo(-size, -size * 0.5); ctx.lineTo(size * 0.7, -size * 0.7); ctx.lineTo(size, size * 0.4); ctx.lineTo(-size * 0.6, size * 0.6); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#9aa0b8';
        ctx.fillRect(-size * 0.8, -size * 0.5, size * 1.4, Math.max(1, size * 0.22));
      }
      ctx.restore();
    }
  }
}

/** 路面上嘅區域（術式陣）：壓扁貼住路面，跟距離縮放，慢慢轉。 */
export function drawZones(ctx, view, state, assets) {
  for (const z of state.zones) {
    const s = scaleAt(z.d), x = screenX(view, z.lane, z.d), y = screenY(view, z.d);
    const r = roadHalfWidth(view) * (2 / 3) * s * 0.62;
    const im = assets.get(z.asset);
    const a = Math.min(1, z.t / 0.25, (z.life - z.t) / 0.4);
    const pop = 1 + Math.max(0, 1 - z.t / 0.25) * 0.35;
    ctx.save();
    ctx.globalAlpha = Math.max(0, a) * (0.82 + Math.sin(state.t * 9) * 0.12);
    ctx.translate(x, y); ctx.scale(pop, 0.3 * pop);
    if (im.ok) {
      ctx.rotate(state.t * 0.9);
      ctx.drawImage(im.img, -r, -r, r * 2, r * 2);
    } else {
      ctx.strokeStyle = 'rgba(255,90,200,1)'; ctx.lineWidth = 4 * s * view.u + 1;
      ctx.beginPath(); ctx.arc(0, 0, r * 0.9, 0, 7); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, r * 0.6, 0, 7); ctx.stroke();
    }
    ctx.restore();
  }
}

/** 敵人嘅彈：一粒紅色光球。 */
export function drawProjectile(ctx, view, e) {
  const s = scaleAt(e.d), x = screenX(view, e.lane, e.d), y = screenY(view, e.d) - view.H * 0.06 * s;
  const r = 26 * s * view.u + 2;
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,90,80,.9)'); g.addColorStop(1, 'rgba(255,60,60,0)');
  ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

export function drawBooms(ctx, view, state) {
  const { u } = view;
  for (const f of state.fx) {
    if (f.k !== 'boom') continue;
    const [x, y] = project(view, f.at);
    const k = f.t / F.boomLife;
    const r = (30 + 130 * k) * f.scale * scaleAt(f.at.d) * u * 2;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(255,250,220,${1 - k})`);
    g.addColorStop(0.4, `rgba(255,150,60,${0.8 * (1 - k)})`);
    g.addColorStop(1, 'rgba(255,80,40,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
}

const NUMBER_COLORS = { gain: COLORS.cyan, loss: COLORS.red, hit: '#ffffff', slash: '#ffb347', ram: '#9cc4ff', drone: '#ffe36a', formula: '#ff7ad9' };

export function drawNumbers(ctx, view, state) {
  const { u, H } = view;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const n of state.nums) {
    const [x, y] = 'leaderX' in n.at ? [screenX(view, n.at.leaderX, 0), H * TUNING.squad.bigNumberY] : project(view, n.at);
    const k = n.t / F.numberLife;
    setFont(ctx, (n.size ?? (n.big ? 44 : 17)) * u * (1 + (1 - k) * 0.25), 800);
    ctx.globalAlpha = 1 - k * k;
    ctx.lineWidth = 3 * u;
    ctx.strokeStyle = COLORS.ink;
    ctx.strokeText(n.txt, x, y - k * 46 * u);
    ctx.fillStyle = NUMBER_COLORS[n.tone];
    ctx.fillText(n.txt, x, y - k * 46 * u);
  }
  ctx.globalAlpha = 1;
}

/** 由地平線向外射嘅速度線。 */
export function drawSpeedLines(ctx, view, state) {
  const { W, u } = view;
  const cx = W / 2, cy = horizonY(view);
  ctx.strokeStyle = 'rgba(255,255,255,.16)';
  ctx.lineWidth = 1.5 * u;
  for (let i = 0; i < 14; i++) {
    const a = (i * 2.399 + Math.floor(state.t * 14) * 0.7) % 6.283;
    if (Math.sin(a) < -0.1) continue;
    const r1 = W * (0.5 + (i * 37 % 20) / 50), r2 = r1 + W * 0.22;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1 * 1.3);
    ctx.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2 * 1.3);
    ctx.stroke();
  }
}
