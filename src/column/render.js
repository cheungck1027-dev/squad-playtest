// 「三線長列」玩法嘅畫面：斜鏡頭下嘅高架路、三條線上面嘅磚列 / 路障 / 方陣、門、首領、主角、彈幕、特效、介面。只讀狀態，唔改狀態。
// 主角、戰力牌、進化特寫、介面、一般特效同頂視版共用（crowd/render.js），靠 view.cam 換鏡頭。
// 數量多嘅嘢全部批次畫：方陣每隻敵人係一張預先畫好嘅小圖（按大細分級存起），一排一排貼；
// 子彈、磚、倒低嘅敵人各自砌成幾條路徑，一次過填色。
//
// 畫嘅次序：遠景 → 路面 → 場上嘅嘢同主角（遠至近）→ 彈幕 → 特效 → 戰力牌 → 介面。

import { WEAPONS } from '../data/weapons.js';
import { formatNumber } from '../core/format.js';
import { COLORS, setFont, slantPanel } from '../battle/draw.js';
import { BAD, GOOD, createLeadPainter, drawCount, drawCutin, drawDust, drawFx, drawGates, drawHud, drawUnit } from '../crowd/render.js';
import { formOf } from '../crowd/rules.js';
import { COLUMN, COLUMN_TEXT } from '../data/column.js';
import { CROWD } from '../data/crowd.js';
import { resultReady } from './battle.js';
import { makeCamera } from './camera.js';
import { phalanxColX, salvoCount } from './rules.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
/** 啱啱出現嗰陣淡入。 */
const fadeIn = (d) => clamp((COLUMN.world.spawnDistance - d) / COLUMN.world.fadeDepth, 0, 1);

/**
 * @param {HTMLCanvasElement} canvas
 * @param {import('../core/assets.js').AssetStore} assets
 * @param {{ screenShake?: () => boolean, clips?: import('../core/clips.js').ClipStore | null }} [opts]
 */
export function createColumnRenderer(canvas, assets, opts = {}) {
  const ctx = canvas.getContext('2d');
  const view = /** @type {any} */ ({ W: 540, H: 960, u: 1, dpr: 1, cam: makeCamera(540, 960) });
  const clips = opts.clips ?? null;
  const perf = { sum: 0, n: 0, max: 0 };
  const lead = createLeadPainter(view, assets, clips);
  /** 小敵人嘅小圖：按高度（裝置像素）存起，每張兩格（左右腳） */
  const enemySprites = new Map();

  function resize() {
    const r = canvas.getBoundingClientRect();
    view.dpr = Math.min(2, globalThis.devicePixelRatio || 1);
    view.W = Math.max(270, r.width);
    view.H = Math.max(480, r.height);
    view.u = view.W / 540;
    canvas.width = view.W * view.dpr;
    canvas.height = view.H * view.dpr;
    view.cam = makeCamera(view.W, view.H);
    view.unitScale = COLUMN.camera.heroScale; // 主角畫細啲（頂視版唔受影響）
    enemySprites.clear();
  }

  function draw(state) {
    const t0 = globalThis.performance.now();
    const s = /** @type {any} */ (state), { W, H, dpr } = view;
    clips?.beginFrame();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    if (s.shake > 0 && (opts.screenShake?.() ?? true)) ctx.translate((Math.random() * 2 - 1) * s.shake * 12, (Math.random() * 2 - 1) * s.shake * 12);

    drawBackdrop(ctx, view, s);
    drawRoad(ctx, view, s);
    lead.prepare(1, s);
    lead.track(s);
    drawDust(ctx, view, s, lead.motion);

    // 場上嘅嘢同主角一齊由遠到近畫；方陣橫跨主角前後，分兩截畫（主角後面嗰截遲啲畫）
    const list = [{ type: 'unit', d: 0 }];
    for (const e of s.ents) {
      if (e.type === 'phalanx') {
        list.push({ type: 'phalanx', e, lo: 0, hi: Infinity, d: Math.max(e.d, 0.001) });
        if (e.d < 0) list.push({ type: 'phalanx', e, lo: -Infinity, hi: 0, d: -0.001 });
      } else if (e.type === 'bricks') list.push({ type: 'bricks', e, d: e.d + e.head * e.gap });
      else list.push({ type: e.type, e, d: e.d });
    }
    list.sort((a, b) => b.d - a.d);
    for (const it of list) {
      if (it.type === 'unit') drawUnit(ctx, view, s, s.units[0], 0, lead.sprites, lead.motion);
      else if (it.type === 'gates') drawGates(ctx, view, s, it.e, { range: COLUMN.gate.shootRange, alpha: fadeIn(it.e.d) });
      else if (it.type === 'bricks') drawBricks(ctx, view, it.e);
      else if (it.type === 'barrier') drawBarrier(ctx, view, s, it.e);
      else if (it.type === 'phalanx') drawPhalanx(ctx, view, s, it.e, it.lo, it.hi, enemySprites);
      else if (it.type === 'boss') drawBoss(ctx, view, s, it.e, assets);
    }
    drawBullets(ctx, view, s, lead.motion);
    drawFell(ctx, view, s);
    drawFx(ctx, view, s);
    drawCount(ctx, view, s, lead.motion);
    ctx.restore();

    if (s.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${Math.min(0.5, s.flash * 1.6)})`; ctx.fillRect(0, 0, W, H); }
    if (s.evoT > 0) { ctx.fillStyle = `rgba(${formOf(s.form).color ?? '255,255,255'},${0.22 * s.evoT / CROWD.evolution.showTime})`; ctx.fillRect(0, 0, W, H); }
    drawCutin(ctx, view, s, assets);
    drawHud(ctx, view, s);
    drawSalvoTag(ctx, view, s);
    drawResult(ctx, view, s);

    const ms = globalThis.performance.now() - t0;
    perf.sum += ms; perf.n++; if (ms > perf.max) perf.max = ms;
  }

  function takePerf() {
    const out = { frames: perf.n, avgMs: perf.n ? +(perf.sum / perf.n).toFixed(3) : 0, maxMs: +perf.max.toFixed(3) };
    perf.sum = 0; perf.n = 0; perf.max = 0;
    return out;
  }

  return { view, resize, draw, takePerf };
}

// ---------- 遠景同路面（全部程式畫；美術之後補）----------

const quad = (ctx, a, b, c, d) => { ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.lineTo(d.x, d.y); ctx.closePath(); };

/** 路外面：空嘅，下面遠處係廢墟城市嘅天台（跟住世界慢慢流走，有前後視差）。 */
function drawBackdrop(ctx, view, s) {
  const { W, H, cam } = view;
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#39425f'); g.addColorStop(0.3, '#232a40'); g.addColorStop(1, '#10131c');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // 一組樓每 period 咁長重複一次；每幢：喺路邊幾遠、幾闊、幾長、天台喺路面以下幾多
  const period = 9, near = cam.bottomDistance - 4, far = 46;
  const blocks = [[1.5, 1.3, 0.5, 3.2, 4.5], [3.1, 1.6, 4.2, 2.6, 7], [1.7, 0.9, 5.6, 2.2, 3.2], [2.9, 1.2, 0.2, 2.4, 9], [4.6, 1.8, 2.5, 4, 5.5]];
  for (let k = Math.floor((far + s.dist) / period); k * period - s.dist > near - period; k--) {
    for (let side = -1; side <= 1; side += 2) {
      for (let i = 0; i < blocks.length; i++) {
        const [bx, bw, bd, bl, drop] = blocks[(i + (side > 0 ? 2 : 0) + k * 3 + 500) % blocks.length];
        const d0 = k * period + bd + (side > 0 ? 1.7 : 0) - s.dist, d1 = d0 + bl;
        if (d1 < near || d0 > far) continue;
        const x0 = side * bx, x1 = side * (bx + bw), fog = clamp(d0 / far, 0, 1);
        const a = cam.project(x0, d0, -drop), b = cam.project(x1, d0, -drop), c = cam.project(x1, d1, -drop), e = cam.project(x0, d1, -drop);
        const lo = cam.project(x0, d0, -drop - 9), lo2 = cam.project(x1, d0, -drop - 9), lo3 = cam.project(x0, d1, -drop - 9);
        // 向住路嗰面牆、向住鏡頭嗰面牆、天台
        ctx.fillStyle = mix('#1a2031', '#343d58', fog); ctx.beginPath(); quad(ctx, a, e, lo3, lo); ctx.fill();
        ctx.fillStyle = mix('#141927', '#2f3852', fog); ctx.beginPath(); quad(ctx, a, b, lo2, lo); ctx.fill();
        ctx.fillStyle = mix('#2b3349', '#3d4764', fog); ctx.beginPath(); quad(ctx, a, b, c, e); ctx.fill();
        ctx.strokeStyle = 'rgba(120,140,180,.18)'; ctx.lineWidth = 1; ctx.stroke();
      }
    }
  }
}

function mix(a, b, k) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16), ch = (sh) => Math.round(((pa >> sh) & 255) * (1 - k) + ((pb >> sh) & 255) * k);
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}

/** 高架公路：橋面、兩邊護欄、三條線嘅分隔虛線、橫向接縫（跟住世界向主角流）。遠處有霧。 */
function drawRoad(ctx, view, s) {
  const { W, H, cam, u } = view, near = cam.bottomDistance - 0.3, far = 60, edge = 1.07, dist = s.dist;
  const P = (x, d, up) => cam.project(x, d, up);
  // 橋身側面（見到少少厚度）同橋面
  for (const side of [-1, 1]) {
    ctx.fillStyle = '#171b28'; ctx.beginPath();
    quad(ctx, P(side * edge, near), P(side * edge, far), P(side * (edge + 0.02), far, -0.5), P(side * (edge + 0.02), near, -0.5)); ctx.fill();
  }
  const g = ctx.createLinearGradient(0, P(0, far).y, 0, H);
  g.addColorStop(0, '#59607a'); g.addColorStop(0.35, '#50566a'); g.addColorStop(1, '#434859');
  ctx.fillStyle = g; ctx.beginPath(); quad(ctx, P(-edge, near), P(-edge, far), P(edge, far), P(edge, near)); ctx.fill();
  // 三條線嘅底色：中間嗰條深少少，睇得出分三條
  ctx.fillStyle = 'rgba(16,20,34,.12)'; ctx.beginPath(); quad(ctx, P(-1 / 3, near), P(-1 / 3, far), P(1 / 3, far), P(1 / 3, near)); ctx.fill();
  // 橫向接縫
  const seam = 2, o = dist % seam;
  ctx.strokeStyle = 'rgba(18,22,34,.3)'; ctx.lineWidth = Math.max(1, 1.5 * u);
  ctx.beginPath();
  for (let d = Math.ceil((near + o) / seam) * seam - o; d < 26; d += seam) { const l = P(-edge, d), r = P(edge, d); ctx.moveTo(l.x, l.y); ctx.lineTo(r.x, r.y); }
  ctx.stroke();
  // 邊線（實線）同分隔線（虛線）：砌成一條路徑一次過填
  ctx.fillStyle = 'rgba(236,240,248,.78)'; ctx.beginPath();
  for (const side of [-1, 1]) quad(ctx, P(side * 0.975, near), P(side * 0.975, far), P(side * 1.0, far), P(side * 1.0, near));
  ctx.fill();
  const dash = 1.2, od = dist % dash;
  ctx.fillStyle = 'rgba(236,240,248,.6)'; ctx.beginPath();
  for (const x of [-1 / 3, 1 / 3]) {
    for (let d = Math.ceil((near + od) / dash) * dash - od; d < 30; d += dash) quad(ctx, P(x - 0.012, d), P(x - 0.012, d + dash * 0.5), P(x + 0.012, d + dash * 0.5), P(x + 0.012, d));
  }
  ctx.fill();
  // 護欄：一條矮牆（橙色警示邊）加一支支柱
  for (const side of [-1, 1]) {
    ctx.fillStyle = '#2a3042'; ctx.beginPath(); quad(ctx, P(side * edge, near), P(side * edge, far), P(side * edge, far, 0.16), P(side * edge, near, 0.16)); ctx.fill();
    ctx.strokeStyle = 'rgba(255,178,84,.85)'; ctx.lineWidth = Math.max(1, 2 * u);
    const a = P(side * edge, near, 0.16), b = P(side * edge, far, 0.16);
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  }
  const post = 1.5, op = dist % post;
  ctx.strokeStyle = 'rgba(190,200,220,.55)'; ctx.lineWidth = Math.max(1, 2 * u);
  ctx.beginPath();
  for (let d = Math.ceil((near + op) / post) * post - op; d < 18; d += post) {
    for (const side of [-1, 1]) { const a = P(side * edge, d, 0.16), b = P(side * edge, d, 0.3); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); }
  }
  ctx.stroke();
  // 遠處嘅霧
  const fogH = H * 0.2, fog = ctx.createLinearGradient(0, 0, 0, fogH);
  fog.addColorStop(0, 'rgba(57,66,95,.92)'); fog.addColorStop(1, 'rgba(57,66,95,0)');
  ctx.fillStyle = fog; ctx.fillRect(0, 0, W, fogH);
}

// ---------- 場上嘅嘢 ----------

export function label(ctx, txt, x, y, size, fill) {
  setFont(ctx, size, 800); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(2, size * 0.16); ctx.strokeStyle = COLORS.ink;
  ctx.strokeText(txt, x, y); ctx.fillStyle = fill; ctx.fillText(txt, x, y);
}

/**
 * 加數磚列 / 大獎磚：每塊係一塊矮磚（面同前面兩個面），成列砌成兩條路徑一次過填。
 * 近嘅磚面上面寫數；成列最前面浮住一塊牌寫「+幾多 × 剩幾多塊」，中距離都睇得到。
 */
function drawBricks(ctx, view, e) {
  const { cam, u } = view, B = COLUMN.bricks, locked = e.lock && e.lock.hp > 0;
  const hw = e.prize ? COLUMN.barrier.halfWidth * 0.86 : B.halfWidth * 0.9, depth = e.prize ? 0.3 : B.depth, thick = e.prize ? 0.24 : 0.07;
  const topC = locked ? '#8d8262' : e.prize ? '#ffd257' : '#46dca9', frontC = locked ? '#5b5440' : e.prize ? '#b4802a' : '#1f8f6c';
  const tops = [], fronts = [], texts = [];
  for (let i = e.n - 1; i >= e.head; i--) {
    const d = e.d + i * e.gap;
    if (d > COLUMN.world.spawnDistance || d < COLUMN.world.despawn) continue;
    const g = cam.project(e.x, d), a = cam.project(e.x, d, thick), b = cam.project(e.x, d + depth, thick);
    const w0 = hw * cam.unit * a.s, w1 = hw * cam.unit * b.s, wg = hw * cam.unit * g.s;
    tops.push(a.x - w0, a.y, a.x + w0, a.y, b.x + w1, b.y, b.x - w1, b.y);
    fronts.push(g.x - wg, g.y, g.x + wg, g.y, a.x + w0, a.y, a.x - w0, a.y);
    if (e.prize) texts.push([`+${formatNumber(e.val)}`, g.x, (g.y + a.y) / 2, Math.min((g.y - a.y) * 0.72, wg * 0.62)]);
    else if (a.s > 0.5) texts.push([`+${formatNumber(e.val)}`, a.x, (a.y + b.y) / 2, Math.min((a.y - b.y) * 1.05, w0 * 0.7)]);
  }
  if (!tops.length) return;
  ctx.globalAlpha = fadeIn(e.d + e.head * e.gap);
  const fill = (pts, color) => {
    ctx.fillStyle = color; ctx.beginPath();
    for (let i = 0; i < pts.length; i += 8) { ctx.moveTo(pts[i], pts[i + 1]); ctx.lineTo(pts[i + 2], pts[i + 3]); ctx.lineTo(pts[i + 4], pts[i + 5]); ctx.lineTo(pts[i + 6], pts[i + 7]); ctx.closePath(); }
    ctx.fill();
  };
  fill(fronts, frontC); fill(tops, topC);
  ctx.strokeStyle = 'rgba(14,18,32,.55)'; ctx.lineWidth = 1; ctx.stroke();
  // 最前嗰塊啱啱俾人收咗：下一塊閃一下
  if (e.pop > 0) { ctx.globalAlpha *= Math.min(1, e.pop / 0.16); fill(tops.slice(-8), '#fff'); fill(fronts.slice(-8), '#fff'); ctx.globalAlpha = fadeIn(e.d + e.head * e.gap); }
  for (const [txt, x, y, size] of texts) if (size >= 7) label(ctx, txt, x, y, size, locked ? '#d9d2bd' : '#fff');
  // 浮牌：喺最前嗰塊上面
  if (!e.prize) {
    const hd = e.d + e.head * e.gap, p = cam.project(e.x, Math.max(hd, 0.2), 0.42), size = clamp(20 * u * p.s * 1.25, 11 * u, 21 * u);
    const txt = `+${formatNumber(e.val)}`, sub = `×${e.n - e.head}`;
    setFont(ctx, size, 800);
    const w1 = ctx.measureText(txt).width; setFont(ctx, size * 0.72, 700);
    const w2 = ctx.measureText(sub).width, pw = w1 + w2 + size * 0.9;
    slantPanel(ctx, p.x - pw / 2, p.y - size * 0.62, pw, size * 1.2, size * 0.2, 'rgba(14,18,32,.86)', `rgb(${GOOD})`);
    setFont(ctx, size, 800); ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillStyle = `rgb(${GOOD})`; ctx.fillText(txt, p.x - pw / 2 + size * 0.36, p.y);
    setFont(ctx, size * 0.72, 700); ctx.fillStyle = '#fff'; ctx.fillText(sub, p.x - pw / 2 + size * 0.5 + w1, p.y + size * 0.05);
  }
  ctx.globalAlpha = 1;
}

/** 數字路障：一塊橫擋成條線嘅厚閘，上面一個大數字（每中一粒跳一下）；越打越多裂痕。 */
function drawBarrier(ctx, view, s, e) {
  const { cam, u } = view, C = COLUMN.barrier, g = cam.project(e.x, e.d), t = cam.project(e.x, e.d, C.height), b = cam.project(e.x, e.d + 0.14, C.height);
  const w = C.halfWidth * cam.unit * g.s, wt = C.halfWidth * cam.unit * t.s, wb = C.halfWidth * cam.unit * b.s, h = g.y - t.y, k = 1 - e.hp / e.max;
  ctx.globalAlpha = fadeIn(e.d);
  // 頂面、正面
  ctx.fillStyle = '#525d7c'; ctx.beginPath(); ctx.moveTo(t.x - wt, t.y); ctx.lineTo(t.x + wt, t.y); ctx.lineTo(b.x + wb, b.y); ctx.lineTo(b.x - wb, b.y); ctx.closePath(); ctx.fill();
  const grad = ctx.createLinearGradient(0, t.y, 0, g.y);
  grad.addColorStop(0, e.hit > 0 ? '#aab6d8' : '#3a4462'); grad.addColorStop(1, e.hit > 0 ? '#7a86aa' : '#232a41');
  ctx.fillStyle = grad; ctx.beginPath(); ctx.moveTo(g.x - w, g.y); ctx.lineTo(g.x + w, g.y); ctx.lineTo(t.x + wt, t.y); ctx.lineTo(t.x - wt, t.y); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#ff9f43'; ctx.lineWidth = Math.max(1.5, 3 * u * g.s); ctx.stroke();
  // 腳下一條警示帶
  ctx.fillStyle = '#ff9f43'; ctx.fillRect(g.x - w, g.y - h * 0.13, w * 2, h * 0.09);
  // 裂痕：打得越多越多條
  if (k > 0.15 && h > 14) {
    ctx.strokeStyle = 'rgba(12,14,24,.7)'; ctx.lineWidth = Math.max(1, 1.5 * u * g.s);
    ctx.beginPath();
    for (let i = 0; i < Math.floor(k * 6); i++) {
      const x = g.x + w * (((i * 0.37 + 0.2) % 1) * 1.7 - 0.85), y = t.y + h * (0.1 + ((i * 0.53) % 0.5));
      ctx.moveTo(x, y); ctx.lineTo(x + w * 0.16, y + h * 0.18); ctx.lineTo(x + w * 0.04, y + h * 0.34);
    }
    ctx.stroke();
  }
  const txt = formatNumber(Math.max(0, Math.ceil(e.hp))), pop = 1 + (e.pop > 0 ? 0.22 * e.pop / 0.16 : 0);
  const size = Math.max(11 * u, Math.min(h * 0.62, (w * 2) / (txt.length * 0.62))) * pop;
  label(ctx, txt, g.x, t.y + h * 0.46, size, e.hit > 0 ? '#fff' : '#ffd9a8');
  ctx.globalAlpha = 1;
}

/** 小敵人嘅小圖（程式畫，美術之後補）：矮身拾荒機械兵，暗紅機身、橙色單眼；兩格（左右腳輪流）。 */
function enemySprite(cache, hpx) {
  let sp = cache.get(hpx);
  if (sp) return sp;
  const w = Math.max(3, Math.round(hpx * 0.86)), c = globalThis.document.createElement('canvas'), g = c.getContext('2d'), col = COLUMN.phalanx.color;
  c.width = w * 2; c.height = hpx;
  for (let f = 0; f < 2; f++) {
    const x0 = f * w, cx = x0 + w / 2;
    if (hpx < 9) {
      // 好遠：一粒色塊就夠
      g.fillStyle = `rgb(${col})`; g.fillRect(x0 + w * 0.2, hpx * 0.15, w * 0.6, hpx * 0.75);
      g.fillStyle = '#2a1420'; g.fillRect(x0 + w * 0.2, hpx * 0.15, w * 0.6, hpx * 0.25);
      continue;
    }
    g.fillStyle = 'rgba(8,10,18,.4)'; g.beginPath(); g.ellipse(cx, hpx * 0.94, w * 0.4, hpx * 0.06, 0, 0, 7); g.fill();
    // 腳（兩格輪流一長一短）
    g.fillStyle = '#2a1420';
    g.fillRect(cx - w * 0.26, hpx * 0.66, w * 0.17, hpx * (f ? 0.28 : 0.2));
    g.fillRect(cx + w * 0.09, hpx * 0.66, w * 0.17, hpx * (f ? 0.2 : 0.28));
    // 機身（梯形）同肩甲
    g.fillStyle = `rgb(${col})`;
    g.beginPath(); g.moveTo(cx - w * 0.3, hpx * 0.3); g.lineTo(cx + w * 0.3, hpx * 0.3); g.lineTo(cx + w * 0.38, hpx * 0.7); g.lineTo(cx - w * 0.38, hpx * 0.7); g.closePath(); g.fill();
    g.fillStyle = '#7c2f33'; g.fillRect(cx - w * 0.38, hpx * 0.58, w * 0.76, hpx * 0.12);
    // 頭罩同單眼
    g.fillStyle = '#2a1420'; g.beginPath(); g.arc(cx, hpx * 0.24, w * 0.27, 0, 7); g.fill();
    g.fillStyle = '#ffd36a'; g.fillRect(cx - w * 0.16, hpx * 0.2, w * 0.32, Math.max(1, hpx * 0.07));
  }
  sp = { canvas: c, w, h: hpx };
  cache.set(hpx, sp);
  return sp;
}

/** 方陣：一排一排由遠到近貼小圖（同一排大細一樣）。lo / hi = 只畫 d 喺呢個範圍嘅排。 */
function drawPhalanx(ctx, view, s, e, lo, hi, cache) {
  const { cam, dpr, H } = view, P = COLUMN.phalanx, tick = Math.floor(s.t * 7);
  for (let r = e.rows - 1; r >= 0; r--) {
    const d = e.d + r * P.gapD;
    if (d <= lo || d > hi || d > COLUMN.world.spawnDistance || d < COLUMN.world.despawn) continue;
    const p = cam.project(e.x, d), size = P.size * H * p.s, sp = enemySprite(cache, Math.max(4, Math.round(size * dpr)));
    const w = sp.w / dpr, h = sp.h / dpr, step = P.gapX * cam.unit * p.s, x0 = p.x - ((e.cols - 1) / 2) * step - w / 2, y = p.y - h * 0.94, row = r * e.cols;
    const a = fadeIn(d);
    if (a < 1) ctx.globalAlpha = a;
    for (let c = 0; c < e.cols; c++) {
      if (!e.alive[row + c]) continue;
      ctx.drawImage(sp.canvas, ((tick + r + c) & 1) * sp.w, 0, sp.w, sp.h, x0 + c * step, y, w, h);
    }
    if (a < 1) ctx.globalAlpha = 1;
  }
  // 浮牌：仲有幾多隻
  if (hi === Infinity && e.left > 0) {
    let front = Infinity;
    for (let c = 0; c < e.cols; c++) if (e.front[c] < e.rows) front = Math.min(front, e.front[c]);
    if (front === Infinity) return;
    const p = cam.project(e.x, Math.max(0.3, e.d + front * P.gapD), 0.5), size = clamp(18 * view.u * p.s * 1.3, 11 * view.u, 19 * view.u), txt = String(e.left);
    ctx.globalAlpha = fadeIn(e.d);
    setFont(ctx, size, 800);
    const pw = ctx.measureText(txt).width + size * 0.9;
    slantPanel(ctx, p.x - pw / 2, p.y - size * 0.62, pw, size * 1.2, size * 0.2, 'rgba(14,18,32,.86)', `rgb(${BAD})`);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = `rgb(${BAD})`; ctx.fillText(txt, p.x, p.y);
    ctx.globalAlpha = 1;
  }
}

/** 首領：頭上係一個會跳嘅大數字（唔係血條）。 */
function drawBoss(ctx, view, s, e, assets) {
  const { cam, u, H } = view, p = cam.project(e.x, e.d), size = H * COLUMN.boss.size * p.s;
  ctx.globalAlpha = fadeIn(e.d);
  ctx.fillStyle = 'rgba(10,12,22,.4)';
  ctx.beginPath(); ctx.ellipse(p.x, p.y, size * 0.42, size * 0.13, 0, 0, 7); ctx.fill();
  const shakeX = e.hit > 0 ? Math.sin(s.t * 90) * 2 * u : 0, stomp = Math.abs(Math.sin(s.t * 5)) * size * 0.02;
  const im = assets.get('boss-01');
  if (im.ok) {
    const w = size * im.img.width / im.img.height;
    ctx.drawImage(im.img, p.x - w / 2 + shakeX, p.y - size - stomp, w, size);
  } else { ctx.fillStyle = '#8a3a6a'; ctx.fillRect(p.x - size * 0.35 + shakeX, p.y - size - stomp, size * 0.7, size); }
  if (s.phase === 'defeat' || s.phase === 'clear') { ctx.globalAlpha = 1; return; } // 結算畫面：收起首領個數字，唔好喺結算牌後面透出嚟
  const txt = formatNumber(Math.max(0, Math.ceil(e.hp))), pop = 1 + (e.pop > 0 ? 0.2 * e.pop / 0.16 : 0), fs = Math.max(15 * u, size * 0.26) * pop;
  setFont(ctx, fs, 800);
  const pw = ctx.measureText(txt).width + fs * 0.8, y = p.y - size - fs * 0.9;
  slantPanel(ctx, p.x - pw / 2, y - fs * 0.62, pw, fs * 1.2, fs * 0.2, 'rgba(14,18,32,.9)', e.hit > 0 ? '#fff' : COLORS.red);
  label(ctx, txt, p.x, y, fs, e.hit > 0 ? '#fff' : COLORS.red);
  ctx.globalAlpha = 1;
}

// ---------- 彈幕 ----------

/**
 * 子彈全部批次畫：按形態、再按遠近分三級（線粗幼唔同），每級幾條路徑一次過描。
 * 四個形態嘅樣：I 短光條；II 長啲、加白芯；III 光球加光環；IV 長光矛、彈頭有十字星。
 */
function drawBullets(ctx, view, s, motion) {
  const { cam, u } = view, F = COLUMN.fire, up = COLUMN.camera.bulletUp;
  // 子彈由槍口出：離開槍口之後飄返入主角正前方嗰條線（規則上子彈一直喺嗰條線）
  const start = cam.project(s.x, F.startD, up), mz = s.power > 0 ? motion.muzzle : null;
  const offX = mz ? mz[0] - start.x : 0, offY = mz ? mz[1] - start.y : 0;
  const at = (x, d) => {
    const q = cam.project(x, d, up), k = Math.max(0, 1 - (d - F.startD) / F.muzzleBlend), e = k * k * (3 - 2 * k), spread = 1 - e * 0.75;
    // 啱啱出槍口：成排子彈由槍口位散開
    return { x: q.x + (offX - (x - s.x) * cam.unit * q.s * (1 - spread)) * e, y: q.y + offY * e, s: q.s };
  };
  /** 每個形態三級（近、中、遠）：各自一串線段 [x0, y0, x1, y1, …] */
  const groups = new Map();
  for (const b of s.bullets) {
    if (b.d < F.startD) continue; // 後排未出槍口
    const look = COLUMN.bullets[Math.min(b.form, COLUMN.bullets.length - 1)], p = at(b.x, b.d), q = at(b.x, Math.max(F.startD, b.d - look.len));
    const tier = b.d < 3.5 ? 0 : b.d < 9 ? 1 : 2, key = b.form * 3 + tier;
    let g = groups.get(key);
    if (!g) { g = { look, tier, seg: [] }; groups.set(key, g); }
    g.seg.push(q.x, q.y, p.x, p.y);
  }
  ctx.lineCap = 'round';
  const widths = [1, 0.6, 0.36];
  for (const g of groups.values()) {
    const { look, seg } = g, r = Math.max(1.1, 5 * u * widths[g.tier] * look.size);
    const path = () => { ctx.beginPath(); for (let i = 0; i < seg.length; i += 4) { ctx.moveTo(seg[i], seg[i + 1]); ctx.lineTo(seg[i + 2], seg[i + 3]); } };
    // 光暈
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = `rgba(${look.glow},.38)`; ctx.lineWidth = r * 2.4; path(); ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
    // 深色底邊（喺淺色路面都睇得清）同光芯
    ctx.strokeStyle = 'rgba(10,14,28,.5)'; ctx.lineWidth = r * 1.35; ctx.stroke();
    ctx.strokeStyle = `rgb(${look.glow})`; ctx.lineWidth = r * 0.95; ctx.stroke();
    if (look.shape !== 'bolt') {
      // 白芯：只描近彈頭嗰半截
      ctx.strokeStyle = `rgb(${look.color})`; ctx.lineWidth = r * 0.42;
      ctx.beginPath(); for (let i = 0; i < seg.length; i += 4) { ctx.moveTo((seg[i] + seg[i + 2]) / 2, (seg[i + 1] + seg[i + 3]) / 2); ctx.lineTo(seg[i + 2], seg[i + 3]); }
      ctx.stroke();
    }
    if (look.shape === 'orb') {
      ctx.fillStyle = `rgb(${look.color})`; ctx.beginPath();
      for (let i = 0; i < seg.length; i += 4) { ctx.moveTo(seg[i + 2] + r * 0.95, seg[i + 3]); ctx.arc(seg[i + 2], seg[i + 3], r * 0.95, 0, 7); }
      ctx.fill();
      ctx.strokeStyle = `rgba(${look.glow},.9)`; ctx.lineWidth = Math.max(1, r * 0.3); ctx.beginPath();
      for (let i = 0; i < seg.length; i += 4) { ctx.moveTo(seg[i + 2] + r * 1.7, seg[i + 3]); ctx.arc(seg[i + 2], seg[i + 3], r * 1.7, 0, 7); }
      ctx.stroke();
    } else if (look.shape === 'lance') {
      // 彈頭十字星
      ctx.strokeStyle = `rgb(${look.color})`; ctx.lineWidth = Math.max(1, r * 0.4); ctx.beginPath();
      for (let i = 0; i < seg.length; i += 4) {
        const x = seg[i + 2], y = seg[i + 3], k = r * 2.1;
        ctx.moveTo(x - k, y); ctx.lineTo(x + k, y); ctx.moveTo(x, y - k * 1.3); ctx.lineTo(x, y + k * 0.7);
      }
      ctx.stroke();
    }
  }
  // 槍口閃光：形態越高、齊射越多粒就越大
  if (s.muzzle > 0 && mz) {
    const look = COLUMN.bullets[Math.min(s.form, COLUMN.bullets.length - 1)];
    const r = cam.unit * (view.unitScale ?? 1) * (0.13 + 0.008 * Math.min(20, s.salvo ?? 1)) * (1 + 0.15 * s.form) * (0.6 + 0.4 * s.muzzle / 0.06);
    const g = ctx.createRadialGradient(mz[0], mz[1], 0, mz[0], mz[1], r);
    g.addColorStop(0, 'rgba(255,255,255,.95)'); g.addColorStop(0.4, `rgba(${look.glow},.6)`); g.addColorStop(1, `rgba(${look.glow},0)`);
    ctx.fillStyle = g; ctx.fillRect(mz[0] - r, mz[1] - r, r * 2, r * 2);
  }
}

// ---------- 特效 ----------

/** 倒低嘅小敵人：中彈一下白閃，機身向後彈飛、碎開。按進度分三級透明度，批次填色。 */
function drawFell(ctx, view, s) {
  const { cam, H } = view, P = COLUMN.phalanx, tiers = [[], [], []], flash = [];
  for (const f of s.fx) {
    if (f.k !== 'fell') continue;
    const k = f.t / f.life, p = cam.project(f.x + f.vx * k, f.d + 0.55 * k, 0.05 + Math.sin(k * Math.PI) * 0.3), size = P.size * H * p.s;
    if (k < 0.3) flash.push(p.x, p.y - size * 0.3, size * (0.5 + k));
    const tier = tiers[Math.min(2, Math.floor(k * 3))], q = size * (0.42 - 0.2 * k), spread = size * (0.2 + k * 0.9);
    for (let i = 0; i < 3; i++) { const a = i * 2.1 + f.x * 7; tier.push(p.x + Math.cos(a) * spread - q / 2, p.y - size * 0.4 + Math.sin(a) * spread * 0.7 - q / 2, q); }
  }
  if (flash.length) {
    ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.beginPath();
    for (let i = 0; i < flash.length; i += 3) { ctx.moveTo(flash[i] + flash[i + 2], flash[i + 1]); ctx.arc(flash[i], flash[i + 1], flash[i + 2], 0, 7); }
    ctx.fill();
  }
  tiers.forEach((t, i) => {
    if (!t.length) return;
    ctx.fillStyle = `rgba(${i ? P.color : '255,214,150'},${[1, 0.75, 0.4][i]})`; ctx.beginPath();
    for (let j = 0; j < t.length; j += 3) ctx.rect(t[j], t[j + 1], t[j + 2], t[j + 2]);
    ctx.fill();
  });
}

/** 結算畫面：輸 / 贏嗰塊橫額下面寫住今局成績；停夠咗就閃住叫玩家撳（撳咗先重開 / 入下一關）。 */
export function drawResult(ctx, view, s) {
  if (s.phase !== 'clear' && s.phase !== 'defeat') return;
  const { W, H, u } = view, top = H * 0.36 - 92 * u, win = s.phase === 'clear';
  slantPanel(ctx, W * 0.14, top, W * 0.72, 80 * u, 12 * u, 'rgba(14,18,32,.86)', 'rgba(255,255,255,.25)');
  setFont(ctx, 19 * u, 700); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff';
  ctx.fillText(COLUMN_TEXT.resultPeak(s.peak), W / 2, top + 25 * u);
  ctx.fillText(COLUMN_TEXT.resultKills(s.kills), W / 2, top + 55 * u);
  if (resultReady(s)) {
    const y = H * 0.36 + 90 * u;
    ctx.globalAlpha = 0.65 + 0.35 * Math.sin(s.t * 6);
    slantPanel(ctx, W * 0.2, y - 20 * u, W * 0.6, 40 * u, 9 * u, 'rgba(14,18,32,.86)', win ? `rgb(${GOOD})` : COLORS.gold);
    setFont(ctx, 21 * u, 800); ctx.fillStyle = win ? `rgb(${GOOD})` : COLORS.gold;
    ctx.fillText(win ? COLUMN_TEXT.tapNext : COLUMN_TEXT.tapRetry, W / 2, y);
    ctx.globalAlpha = 1;
  }
}

/** 介面：關卡牌下面寫住而家一次齊射幾多粒。 */
export function drawSalvoTag(ctx, view, s) {
  const { u } = view, n = salvoCount(s.power), c = formOf(s.form).color, armed = COLUMN.numbers.weapons;
  // 大數字版寫而家第幾級武器同個名；舊數值寫齊射幾多粒
  const txt = armed ? COLUMN_TEXT.weapon((s.weapon ?? 0) + 1, WEAPONS[s.weapon ?? 0].name) : COLUMN_TEXT.salvo(n);
  setFont(ctx, 15 * u, 800); ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  slantPanel(ctx, 14 * u, 58 * u, Math.max(112 * u, ctx.measureText(txt).width + 30 * u), 26 * u, 7 * u, COLORS.panel, 'rgba(255,255,255,.2)');
  ctx.fillStyle = c ? `rgb(${c})` : '#fff';
  ctx.fillText(txt, 28 * u, 71 * u);
}
