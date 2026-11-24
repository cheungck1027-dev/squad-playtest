// 俯視玩法嘅畫面：路面、門、敵人、數字箱、首領、主角（隊伍）、子彈、特效、介面。只讀狀態，唔改狀態。
// 畫嘅次序：路面 → 場上嘅嘢同隊員（遠至近）→ 子彈 → 特效 → 人數大字 → 介面。

import { formatNumber } from '../core/format.js';
import { COLORS, setFont, slantPanel } from '../battle/draw.js';
import { clipMuzzle, placeMuzzle, stillMuzzle } from '../battle/muzzle.js';
import { UNIT_SPRITE, unitClipKey, unitCutinKey, unitLook } from '../data/assets.js';
import { CROWD, CROWD_TEXT } from '../data/crowd.js';
import { progress } from './battle.js';
import { airPhase, contactsBetween } from './feel.js';
import { canShootGate, formOf, gateLabel, gateSegment, isGoodGate, squadRadius } from './rules.js';
import { project as topProject, topDistance, unitPx as topUnitPx } from './view.js';

export const GOOD = '70,235,170', BAD = '255,90,105';

// 鏡頭：平時用頂視嗰套（view.js）。view.cam 有嘢（「三線長列」玩法嘅透視鏡頭）就用佢，下面畫主角、特效、介面嘅函數兩邊共用。
const project = (view, x, d) => (view.cam ? view.cam.project(x, d) : topProject(view, x, d));
const unitPx = (view) => (view.cam ? view.cam.unit : topUnitPx(view));

/**
 * 主角（同隊員）今格嘅小圖同腳步記錄：頂視版同「三線長列」版共用。
 * prepare(need, state) 準備小圖；track(state) 跟腳步出塵、計身體離地幾多。sprites、motion 俾 drawUnit 等用。
 */
export function createLeadPainter(view, assets, clips) {
  /** 每條錯開相位嘅片，今格去好背、縮到單位大細嘅一張小圖（全隊共用，唔使每個人縮一次大圖） */
  const sprites = UNIT_SPRITE.phases.map(() => ({ canvas: null, ctx: null, ok: false }));
  /** 主角動態入面純畫面嗰啲記錄：腳步塵、上次見到片播到第幾格、身體離地幾多、用緊橫移片幾成 */
  const motion = { dust: [], frame: -1, air: 0, strafe: 0, lastStep: 0, side: 1, form: -1, clipTime: null, muzzle: null, still: false };

  /**
   * 準備今格嘅單位小圖：有片用片（去咗背），冇就用主圖；再按形態染少少主題色，受擊嗰陣閃紅白。
   * 主角（第 0 張）橫移夠快、形態又有橫移片：跑步片同橫移片交叉淡入。
   */
  function prepareSprites(need, s) {
    // 呢個形態用片但片未播得（載入緊）：今格成套用返靜態主圖嘅比例，唔好將主圖套落片嘅比例
    const form = s.form, key0 = unitClipKey(form, 0);
    motion.still = !!key0 && unitLook(form).hasStillLook && !clips?.frame(key0, 'unit');
    const look = unitLook(form, motion.still), hp = Math.ceil(view.H * (view.unitScale ?? 1) * look.height * view.dpr * 1.12), wp = Math.ceil(hp * 2 / 3);
    const still = assets.get(look.still), F = formOf(form), H = CROWD.feel.hurt;
    motion.strafe = 0;
    for (let i = 0; i < sprites.length; i++) {
      const sp = sprites[i];
      sp.ok = false;
      if (i >= need) continue;
      if (!sp.canvas) { sp.canvas = globalThis.document.createElement('canvas'); sp.ctx = sp.canvas.getContext('2d'); }
      if (sp.canvas.width !== wp || sp.canvas.height !== hp) { sp.canvas.width = wp; sp.canvas.height = hp; }
      const runKey = motion.still ? null : unitClipKey(form, i), c = sp.ctx, frame = runKey ? clips?.frame(runKey, 'unit') : null;
      const blit = (fr, box, alpha) => { const fw = wp / box.w, fh = hp / box.h; c.globalAlpha = alpha; c.drawImage(fr, -fw * box.x, -fh * box.y, fw, fh); c.globalAlpha = 1; };
      c.globalCompositeOperation = 'source-over';
      c.clearRect(0, 0, wp, hp);
      // 橫移片：有片先用；舊片保持實色到一半先淡走，新片由零淡入（中間唔會兩條都半透明）
      const a = i === 0 ? Math.abs(s.strafe) : 0, sideKey = a > 0 ? unitClipKey(form, 0, s.strafe < 0 ? 'strafeLeft' : 'strafeRight') : null;
      const sideFrame = sideKey ? clips?.frame(sideKey, 'unit') : null;
      if (sideFrame) {
        if (frame) blit(frame, look.box, Math.min(1, 2 * (1 - a)));
        blit(sideFrame, clips.def(sideKey).box, Math.min(1, 2 * a));
        motion.strafe = a;
      } else if (frame) blit(frame, look.box, 1);
      else if (still.ok) c.drawImage(still.img, 0, 0, wp, hp);
      else continue;
      // 只染人物本身（有像素嘅地方）
      c.globalCompositeOperation = 'source-atop';
      if (F.color && F.tint > 0 && !look.own) { c.fillStyle = `rgba(${F.color},${F.tint})`; c.fillRect(0, 0, wp, hp); }
      if (i === 0 && s.hurt > 0) {
        const k = s.hurt / H.time; // 1 → 0：先白後紅
        c.fillStyle = k > 0.6 ? `rgba(255,255,255,${0.85 * k})` : `rgba(255,70,90,${0.9 * k})`; c.fillRect(0, 0, wp, hp);
      }
      c.globalCompositeOperation = 'source-over';
      sp.ok = true;
    }
  }

  /** 腳步：睇片播到第幾格，邊隻腳啱啱落地就喺腳下出一團塵；順手計身體離地幾多（影子用）。 */
  function trackSteps(s) {
    const look = unitLook(s.form, motion.still), S = CROWD.feel.steps;
    const runKey = motion.still ? null : unitClipKey(s.form, 0), t = runKey ? clips?.time(runKey) ?? null : null;
    motion.clipTime = t;
    const puff = (side) => {
      const h = look.height * (view.unitScale ?? 1) * view.H / unitPx(view); // 主圖高度（世界單位）
      motion.dust.push({ x: s.x + (side === 'left' ? -1 : 1) * look.footSpread * h, dist: s.dist, t: s.t, form: s.form });
      if (motion.dust.length > 14) motion.dust.shift();
    };
    if (motion.form !== s.form) { motion.form = s.form; motion.frame = -1; }
    if (t !== null && look.frames) {
      const f = Math.floor(t * look.fps + 1e-6) % look.frames;
      if (s.phase === 'run') for (const side of contactsBetween(motion.frame, f, look.frames, look.footContacts)) puff(side);
      motion.frame = f;
      motion.air = airPhase(f, look.frames, look.footContacts);
    } else {
      // 冇片（用緊靜態圖）：按固定節奏左右腳輪流
      if (s.phase === 'run' && s.t - motion.lastStep >= S.fallbackEvery) { motion.lastStep = s.t; motion.side = -motion.side; puff(motion.side < 0 ? 'left' : 'right'); }
      // 身體喺兩步中間最高（靜態主圖靠呢個數做起伏同影子縮放）
      motion.air = s.phase === 'run' ? Math.sin(Math.min(1, Math.max(0, (s.t - motion.lastStep) / S.fallbackEvery)) * Math.PI) : 0;
    }
    if (s.t < motion.lastSeenT) { motion.dust.length = 0; motion.lastStep = 0; } // 重開咗
    motion.lastSeenT = s.t;
    motion.dust = motion.dust.filter((d) => s.t - d.t < S.life && s.t >= d.t);
  }

  return { sprites, motion, prepare: prepareSprites, track: trackSteps };
}

/**
 * @param {HTMLCanvasElement} canvas
 * @param {import('../core/assets.js').AssetStore} assets
 * @param {{ screenShake?: () => boolean, clips?: import('../core/clips.js').ClipStore | null }} [opts]
 */
export function createCrowdRenderer(canvas, assets, opts = {}) {
  const ctx = canvas.getContext('2d');
  const view = { W: 540, H: 960, u: 1, dpr: 1 };
  const clips = opts.clips ?? null;
  const perf = { sum: 0, n: 0, max: 0 };
  const lead = createLeadPainter(view, assets, clips), { sprites, motion } = lead;

  function resize() {
    const r = canvas.getBoundingClientRect();
    view.dpr = Math.min(2, globalThis.devicePixelRatio || 1);
    view.W = Math.max(270, r.width);
    view.H = Math.max(480, r.height);
    view.u = view.W / 540;
    canvas.width = view.W * view.dpr;
    canvas.height = view.H * view.dpr;
  }

  /** @param {import('./battle.js').CrowdState} state */
  function draw(state) {
    const t0 = globalThis.performance.now();
    const s = /** @type {any} */ (state), { W, H, dpr } = view;
    clips?.beginFrame();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    if (s.shake > 0 && (opts.screenShake?.() ?? true)) ctx.translate((Math.random() * 2 - 1) * s.shake * 12, (Math.random() * 2 - 1) * s.shake * 12);

    drawRoad(ctx, view, s, assets);
    drawSpeedLines(ctx, view, s);
    lead.prepare(Math.min(sprites.length, s.units.length), s);
    lead.track(s);
    drawDust(ctx, view, s, motion);
    // 場上嘅嘢同隊員一齊由遠到近畫
    const list = [];
    for (const e of s.ents) list.push(e);
    for (let i = 0; i < s.units.length; i++) list.push({ type: 'unit', i, d: s.units[i].d });
    list.sort((a, b) => b.d - a.d);
    for (const e of list) {
      if (e.type === 'unit') drawUnit(ctx, view, s, s.units[e.i], e.i, sprites, motion);
      else if (e.type === 'gates') drawGates(ctx, view, s, e);
      else if (e.type === 'enemy') drawEnemy(ctx, view, s, e, assets);
      else if (e.type === 'crate') drawCrate(ctx, view, e);
      else if (e.type === 'boss') drawBoss(ctx, view, s, e, assets);
    }
    drawBullets(ctx, view, s, motion);
    drawFx(ctx, view, s);
    drawCount(ctx, view, s, motion);
    ctx.restore();

    if (s.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${Math.min(0.5, s.flash * 1.6)})`; ctx.fillRect(0, 0, W, H); }
    if (s.evoT > 0) { ctx.fillStyle = `rgba(${formOf(s.form).color ?? '255,255,255'},${0.22 * s.evoT / CROWD.evolution.showTime})`; ctx.fillRect(0, 0, W, H); }
    drawCutin(ctx, view, s, assets);
    drawHud(ctx, view, s);

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

// ---------- 路面 ----------

/** 程式畫嘅俯視路面：瀝青、兩邊路肩、車道虛線同橫向接縫（跟住世界向下捲）。有美術路面圖就鋪圖。 */
function drawRoad(ctx, view, s, assets) {
  const { W, H } = view, far = topDistance(view) + 0.3, near = -(H * (1 - CROWD.view.squadY)) / unitPx(view) - 0.1;
  const art = CROWD.view.background ? assets.get(CROWD.view.background) : null;
  if (art?.ok) {
    // 美術路面：一張上下接得返嘅圖，鋪滿成個畫面闊，跟世界速度向下捲
    const h = W * art.img.height / art.img.width, off = (s.dist * unitPx(view)) % h;
    for (let y = off - h; y < H; y += h) ctx.drawImage(art.img, 0, y, W, h);
    return;
  }
  // 路肩
  ctx.fillStyle = '#272b36'; ctx.fillRect(0, 0, W, H);
  // 路面（遠處窄少少）
  const a = project(view, -1, far), b = project(view, 1, far), c = project(view, 1, near), e = project(view, -1, near);
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#565b6b'); g.addColorStop(1, '#484d5c');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.lineTo(e.x, e.y); ctx.closePath(); ctx.fill();
  // 橫向接縫同路肩嘅斜紋：等速向下，睇得出世界郁緊
  const seam = 1.2, o = s.dist % seam;
  ctx.strokeStyle = 'rgba(20,24,34,.22)'; ctx.lineWidth = Math.max(1, 2 * view.u);
  for (let d = Math.ceil((near + o) / seam) * seam - o; d < far; d += seam) {
    const l = project(view, -1, d), r = project(view, 1, d);
    ctx.beginPath(); ctx.moveTo(l.x, l.y); ctx.lineTo(r.x, r.y); ctx.stroke();
  }
  const mark = 0.4, om = s.dist % mark;
  for (let d = Math.ceil((near + om) / mark) * mark - om, i = Math.round((d + s.dist) / mark); d < far; d += mark, i++) {
    const p = project(view, 1, d), q = project(view, 1, d + mark * 0.5), l = project(view, -1, d), m = project(view, -1, d + mark * 0.5);
    ctx.fillStyle = i % 2 ? '#343a48' : '#272b36';
    ctx.fillRect(p.x, q.y, W - p.x, p.y - q.y); ctx.fillRect(0, m.y, l.x, l.y - m.y);
  }
  // 邊線同兩條車道虛線
  ctx.strokeStyle = 'rgba(235,238,245,.8)'; ctx.lineWidth = Math.max(1.5, 3 * view.u);
  for (const side of [-1, 1]) {
    const p = project(view, side * 0.97, near), q = project(view, side * 0.97, far);
    ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
  }
  const dash = 0.8, od = s.dist % dash;
  ctx.strokeStyle = 'rgba(235,238,245,.5)';
  for (const x of [-1 / 3, 1 / 3]) {
    for (let d = Math.ceil((near + od) / dash) * dash - od; d < far; d += dash) {
      const p = project(view, x, d), q = project(view, x, d + dash * 0.45);
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
    }
  }
}

// ---------- 場上嘅嘢 ----------

const fadeIn = (d) => Math.max(0, Math.min(1, (CROWD.world.spawnDistance - d) / 0.4));

/** 一排門：每道一塊企喺路面嘅光幕，上面一個大數字。射得郁嘅門有準星邊；乘除門係實心框（射唔郁）。 */
export function drawGates(ctx, view, s, row, o = {}) {
  const n = row.gates.length, base = project(view, 0, row.d), h = view.H * 0.075 * base.s;
  ctx.save();
  ctx.globalAlpha = (o.alpha ?? fadeIn(row.d)) * (row.used ? 0.35 : 1);
  for (let i = 0; i < n; i++) {
    const g = row.gates[i], [x0, x1] = gateSegment(n, i);
    const l = project(view, x0, row.d).x + 2, r = project(view, x1, row.d).x - 2, w = r - l, y = base.y;
    const c = isGoodGate(g) ? GOOD : BAD, lit = g.hit > 0 || g.flipT > 0;
    const grad = ctx.createLinearGradient(0, y - h, 0, y);
    grad.addColorStop(0, `rgba(${c},${lit ? 0.85 : 0.62})`); grad.addColorStop(1, `rgba(${c},.22)`);
    ctx.fillStyle = grad; ctx.fillRect(l, y - h, w, h);
    const shootable = g.op === 'add' || g.op === 'sub';
    ctx.lineWidth = Math.max(1.5, 3 * view.u * base.s);
    ctx.strokeStyle = shootable ? `rgba(${c},1)` : '#1b2030';
    ctx.strokeRect(l, y - h, w, h);
    if (!shootable) { ctx.fillStyle = '#1b2030'; ctx.fillRect(l, y - h, w, h * 0.14); ctx.fillRect(l, y - h * 0.1, w, h * 0.1); }
    // 入咗射程、仲食得子彈：四角準星
    if (!row.used && (o.range ? shootable && row.d > 0 && row.d <= o.range : canShootGate(g, row.d))) {
      const k = h * 0.22; ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(1, 2 * view.u);
      for (const [cx, cy, sx, sy] of [[l, y - h, 1, 1], [r, y - h, -1, 1], [l, y, 1, -1], [r, y, -1, -1]]) {
        ctx.beginPath(); ctx.moveTo(cx + sx * k, cy); ctx.lineTo(cx, cy); ctx.lineTo(cx, cy + sy * k); ctx.stroke();
      }
    }
    const pop = 1 + (g.pop > 0 ? 0.35 * g.pop / CROWD.gate.popTime : 0) + (g.flipT > 0 ? 0.3 * g.flipT / CROWD.gate.flipTime : 0);
    // 字要擺得落道門入面：數字射到好多位（例如 +1576）就跟位數縮細；彈大嗰下都唔好爆出隔籬道門
    const label = gateLabel(g), fit = w * 1.5 / Math.max(3, label.length);
    setFont(ctx, Math.min(Math.min(h * 0.7, w * 0.42, fit) * pop, fit * 1.12), 800); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(2, h * 0.09); ctx.strokeStyle = COLORS.ink;
    ctx.strokeText(label, l + w / 2, y - h * 0.5); ctx.fillStyle = '#fff'; ctx.fillText(label, l + w / 2, y - h * 0.5);
  }
  ctx.restore();
}

function drawEnemy(ctx, view, s, e, assets) {
  const E = CROWD.enemies[e.kind], p = project(view, e.x, e.d), size = view.H * E.size * p.s;
  const bob = Math.sin(s.t * 9 + e.wob) * size * 0.04;
  ctx.globalAlpha = fadeIn(e.d);
  ctx.fillStyle = 'rgba(10,12,22,.35)';
  ctx.beginPath(); ctx.ellipse(p.x, p.y, size * 0.34, size * 0.13, 0, 0, 7); ctx.fill();
  const im = assets.get(E.asset);
  if (im.ok) {
    const w = size * im.img.width / im.img.height;
    ctx.drawImage(im.img, p.x - w / 2, p.y - size + bob, w, size);
  } else {
    ctx.fillStyle = `rgb(${E.color})`;
    ctx.beginPath(); ctx.arc(p.x, p.y - size * 0.45 + bob, size * 0.34, 0, 7); ctx.fill();
    ctx.fillStyle = COLORS.ink; ctx.fillRect(p.x - size * 0.2, p.y - size * 0.55 + bob, size * 0.4, size * 0.09);
  }
  if (e.hit > 0) {
    ctx.fillStyle = 'rgba(255,255,255,.75)';
    ctx.beginPath(); ctx.arc(p.x, p.y - size * 0.5, size * 0.36, 0, 7); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawCrate(ctx, view, e) {
  const p = project(view, e.x, e.d), w = CROWD.crate.width * unitPx(view) * p.s, h = w * 0.82;
  const add = e.reward.type === 'add';
  ctx.globalAlpha = fadeIn(e.d);
  ctx.fillStyle = 'rgba(10,12,22,.35)'; ctx.fillRect(p.x - w * 0.54, p.y - h * 0.08, w * 1.08, h * 0.2);
  ctx.fillStyle = e.hit > 0 ? '#fff3c4' : '#c9923a'; ctx.fillRect(p.x - w / 2, p.y - h, w, h);
  ctx.strokeStyle = '#5a3d17'; ctx.lineWidth = Math.max(2, w * 0.07); ctx.strokeRect(p.x - w / 2, p.y - h, w, h);
  ctx.fillStyle = '#5a3d17'; ctx.fillRect(p.x - w / 2, p.y - h * 0.24, w, h * 0.06);
  setFont(ctx, h * 0.5, 800); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(2, h * 0.08); ctx.strokeStyle = COLORS.ink;
  const txt = formatNumber(Math.ceil(e.hp));
  ctx.strokeText(txt, p.x, p.y - h * 0.6); ctx.fillStyle = '#fff'; ctx.fillText(txt, p.x, p.y - h * 0.6);
  // 獎勵牌
  const tag = add ? `+${formatNumber(e.reward.n)}` : '⚡';
  setFont(ctx, h * 0.3, 800);
  const tw = ctx.measureText(tag).width + h * 0.26;
  slantPanel(ctx, p.x - tw / 2, p.y - h * 1.38, tw, h * 0.34, h * 0.07, 'rgba(14,18,32,.85)', add ? `rgb(${GOOD})` : COLORS.gold);
  ctx.fillStyle = add ? `rgb(${GOOD})` : COLORS.gold; ctx.fillText(tag, p.x, p.y - h * 1.2);
  ctx.globalAlpha = 1;
}

function drawBoss(ctx, view, s, e, assets) {
  const p = project(view, e.x, e.d), size = view.H * CROWD.boss.size * p.s, u = view.u;
  ctx.globalAlpha = fadeIn(e.d);
  ctx.fillStyle = 'rgba(10,12,22,.4)';
  ctx.beginPath(); ctx.ellipse(p.x, p.y, size * 0.42, size * 0.13, 0, 0, 7); ctx.fill();
  const shakeX = e.hit > 0 ? Math.sin(s.t * 90) * 2 * u : 0, lunge = e.warn ? Math.sin(s.t * 22) * size * 0.015 : 0;
  const im = assets.get('boss-01');
  if (im.ok) {
    const w = size * im.img.width / im.img.height;
    ctx.drawImage(im.img, p.x - w / 2 + shakeX, p.y - size + lunge, w, size);
  } else {
    ctx.fillStyle = '#8a3a6a'; ctx.fillRect(p.x - size * 0.35 + shakeX, p.y - size + lunge, size * 0.7, size);
  }
  if (e.warn) {
    // 出手預警：首領腳下同隊伍身上各一個紅圈
    const k = 1 - Math.max(0, e.atk) / CROWD.boss.warnTime, q = project(view, s.x, 0), r = unitPx(view) * (squadRadius(s.members) + 0.15);
    ctx.strokeStyle = `rgba(${BAD},${0.4 + 0.6 * k})`; ctx.lineWidth = (2 + 4 * k) * u;
    ctx.beginPath(); ctx.ellipse(q.x, q.y, r * (1.6 - 0.6 * k), r * 0.8 * (1.6 - 0.6 * k), 0, 0, 7); ctx.stroke();
  }
  // 血條同數字
  const bw = size * 0.9, bh = 12 * u, bx = p.x - bw / 2, by = p.y - size - 22 * u, k = Math.max(0, e.hp / e.max);
  slantPanel(ctx, bx - 3 * u, by - 3 * u, bw + 6 * u, bh + 6 * u, 4 * u, 'rgba(14,18,32,.85)', 'rgba(255,255,255,.4)');
  slantPanel(ctx, bx, by, bw * k, bh, 4 * u * k, e.hit > 0 ? '#fff' : COLORS.red);
  setFont(ctx, 22 * u, 800); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round'; ctx.lineWidth = 4 * u; ctx.strokeStyle = COLORS.ink;
  const txt = formatNumber(Math.max(0, Math.ceil(e.hp)));
  ctx.strokeText(txt, p.x, by - 14 * u); ctx.fillStyle = '#fff'; ctx.fillText(txt, p.x, by - 14 * u);
  ctx.globalAlpha = 1;
}

// ---------- 隊伍 ----------

export function drawUnit(ctx, view, s, u, i, sprites, motion) {
  const S = CROWD.squad, FEEL = CROWD.feel, p = project(view, u.x, u.d), F = formOf(s.form), lead = i === 0, look = unitLook(s.form, motion.still);
  // 新加入嘅隊員由細彈大；主角本身一開場就係足尺寸
  const age = (s.t - u.born) / S.popTime, grow = lead || age >= 1 ? 1 : 0.4 + 0.6 * (1 - (1 - age) ** 2) + 0.25 * Math.sin(Math.max(0, age) * Math.PI);
  const show = s.evoT > 0 ? s.evoT / CROWD.evolution.showTime : 0; // 進化演出：1 → 0
  // 進化嗰刻放大彈一下（頭三成時間內彈完）
  const punch = lead && show > 0.7 ? FEEL.evolve.punch * Math.sin((1 - show) / 0.3 * Math.PI) : 0;
  // 主角用足設定嘅大細；其他隊員有少少大細差
  const h = view.H * (view.unitScale ?? 1) * look.height * p.s * (lead ? 1 : 0.96 + ((i * 7) % 5) * 0.02) * grow * (1 + punch), w = h * 2 / 3;
  // 形態光環：腳下一圈主題色嘅光，形態越高越大；進化演出期間爆大再收返，加一條向上嘅光柱
  if (F.color) {
    const pulse = 0.85 + Math.sin(s.t * 5) * 0.15, r = h * (0.26 + 0.05 * s.form) * (1 + show * 1.4);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ctx.translate(p.x, p.y); ctx.scale(1, 0.42);
    const g = ctx.createRadialGradient(0, 0, r * 0.3, 0, 0, r);
    g.addColorStop(0, `rgba(${F.color},${0.18 * pulse})`); g.addColorStop(0.72, `rgba(${F.color},${(0.4 + 0.1 * s.form) * pulse})`); g.addColorStop(1, `rgba(${F.color},0)`);
    ctx.fillStyle = g; ctx.fillRect(-r, -r, r * 2, r * 2);
    ctx.restore();
    if (show > 0) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const bw = h * 0.5 * (0.4 + show * 0.6), beam = ctx.createLinearGradient(0, p.y - h * 1.6, 0, p.y);
      beam.addColorStop(0, `rgba(${F.color},0)`); beam.addColorStop(1, `rgba(${F.color},${0.6 * show})`);
      ctx.fillStyle = beam; ctx.fillRect(p.x - bw / 2, p.y - h * 1.6, bw, h * 1.6);
      ctx.restore();
    }
  }
  // 貼地影：身體喺兩步中間（最高）嗰陣縮細少少、淡少少
  const air = lead ? motion.air : 0, sw = h * FEEL.shadow.width * (1 - FEEL.shadow.airShrink * air);
  ctx.fillStyle = `rgba(10,12,22,${0.42 - 0.1 * air})`;
  ctx.beginPath(); ctx.ellipse(p.x, p.y, sw, sw * 0.36, 0, 0, 7); ctx.fill();
  const sp = sprites[u.v % sprites.length].ok ? sprites[u.v % sprites.length] : sprites[0];
  if (sp.ok) {
    if (lead) {
      // 主角嘅動態：拖動傾身（有橫移片就讓返俾片）、射擊後座（向後一頓）、受擊後退
      const R = FEEL.recoil, back = (s.recoil > 0 ? R.kick * (1 + R.perForm * s.form) * (s.recoil / R.time) : 0) + (s.hurt > 0 ? FEEL.hurt.knock * Math.sin(s.hurt / FEEL.hurt.time * Math.PI) : 0);
      const lean = s.lean * (1 - motion.strafe);
      ctx.save();
      // 靜態主圖：身體跟腳步節奏輕輕上下郁（有片就唔加，片本身有）
      const lift = look.useStill ? FEEL.bob.amp * motion.air : 0;
      ctx.translate(p.x, p.y + h * (back - lift));
      ctx.rotate(lean);
      ctx.scale(1 - FEEL.lean.squash * Math.min(1, Math.abs(lean) / FEEL.lean.max), 1);
      ctx.drawImage(sp.canvas, h * look.shiftX - w / 2, h * look.footDrop - h, w, h);
      ctx.restore();
      // 槍口喺畫面邊度（跟片入面而家嗰格，連埋傾身）：槍口閃光同子彈起點用
      const m = clipMuzzle({ muzzleFrames: look.muzzleFrames, fps: look.fps, box: look.box }, motion.clipTime, w, h) ?? stillMuzzle(look.muzzle, h);
      motion.muzzle = placeMuzzle([m[0] + h * look.shiftX, m[1] + h * look.footDrop], { x: p.x, y: p.y + h * (back - lift), rot: lean, skew: 0, sy: 1 });
    } else ctx.drawImage(sp.canvas, p.x + h * look.shiftX - w / 2, p.y + h * look.footDrop - h, w, h);
  }
  // 新加入嘅隊員彈出嚟閃一下（主角本身唔閃：開場唔好有個圓擋住佢）
  if (!lead && age < 1) { ctx.fillStyle = `rgba(255,255,255,${0.6 * (1 - age)})`; ctx.beginPath(); ctx.arc(p.x, p.y - h * 0.45, h * 0.3, 0, 7); ctx.fill(); }
}

/** 腳步塵：喺落地嗰個位出，跟路面向後流走，擴開、淡出。有形態色就帶少少主題色嘅光。 */
export function drawDust(ctx, view, s, motion) {
  const S = CROWD.feel.steps, px = unitPx(view);
  for (const d of motion.dust) {
    const k = (s.t - d.t) / S.life, p = project(view, d.x, -(s.dist - d.dist)), c = formOf(d.form).color;
    const r = px * S.size * (0.5 + k * 1.1);
    ctx.fillStyle = `rgba(${c ?? '210,214,225'},${S.alpha * (1 - k) ** 1.5})`;
    ctx.beginPath(); ctx.ellipse(p.x, p.y, r, r * 0.5, 0, 0, 7); ctx.fill();
  }
}

/** 速度線：路面上幼細嘅流動紋，快過路面本身；形態越高越長、越明顯，但一直好淡。 */
function drawSpeedLines(ctx, view, s) {
  const L = CROWD.feel.speedLines, far = topDistance(view), span = far + 1.2;
  const alpha = L.alpha + L.alphaPerForm * s.form, len = L.length + L.lengthPerForm * s.form;
  ctx.strokeStyle = `rgba(${formOf(s.form).color ?? '235,238,245'},${alpha})`;
  ctx.lineWidth = Math.max(1, 1.5 * view.u); ctx.lineCap = 'round';
  ctx.beginPath();
  for (let i = 0; i < L.count; i++) {
    const x = ((i * 0.618034 + 0.13) % 1) * 1.8 - 0.9;
    const d = far - ((i * 1.37 + s.dist * L.speedMul) % span);
    const a = project(view, x, d), b = project(view, x, d + len);
    ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
  }
  ctx.stroke();
}

/**
 * 進化嗰刻嘅變身特寫圖（UNIT_SPRITE.forms[形態].cutin）：一條斜帶由右邊滑入、停一陣、淡走。
 * 美術未交圖：張圖未載入到就乜都唔畫。
 */
export function drawCutin(ctx, view, s, assets) {
  if (!(s.evoT > 0)) return;
  const key = unitCutinKey(s.form), im = key ? assets.get(key) : null;
  if (!im?.ok) return;
  const { W, H } = view, k = 1 - s.evoT / CROWD.evolution.showTime;               // 0 → 1
  // 條帶闊鋪滿畫面，高按張圖嘅比例（最高唔過畫面三成二）；張圖對住上面裁，保住塊面
  const slide = Math.min(1, k / 0.15), out = Math.max(0, (k - 0.8) / 0.2), bh = Math.min(H * 0.32, W * im.img.height / im.img.width), y = H * 0.07;
  ctx.save();
  ctx.globalAlpha = 1 - out;
  ctx.translate((1 - slide) ** 2 * W, 0);
  ctx.beginPath(); ctx.moveTo(0, y + bh * 0.1); ctx.lineTo(W, y); ctx.lineTo(W, y + bh * 0.9); ctx.lineTo(0, y + bh); ctx.closePath();
  const c = formOf(s.form).color ?? '255,255,255', g = ctx.createLinearGradient(0, y, W, y + bh);
  g.addColorStop(0, 'rgba(14,18,32,.92)'); g.addColorStop(1, `rgba(${c},.35)`);
  ctx.fillStyle = 'rgba(14,18,32,.9)'; ctx.fill(); ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = `rgb(${c})`; ctx.lineWidth = 2 * view.u; ctx.stroke();
  ctx.clip();
  const sc = Math.max(W / im.img.width, bh / im.img.height), iw = im.img.width * sc, ih = im.img.height * sc;
  ctx.drawImage(im.img, (W - iw) / 2, y, iw, ih);
  ctx.restore();
}

/** 子彈：樣式跟形態。I 白芯青色單發；II 青色雙發；III 紫色穿透光彈（大粒、長尾、外面一圈光）；IV 金白色多道穿透。 */
function drawBullets(ctx, view, s, motion) {
  ctx.lineCap = 'round';
  // 子彈由槍口出：槍口喺主角右肩外，子彈離開之後飄返入主角正前方嗰條線（規則上子彈一直喺嗰條線）
  const FI = CROWD.fire, start = project(view, s.x, FI.startD), mz = s.power > 0 ? motion.muzzle : null;
  const offX = mz ? mz[0] - start.x : 0, offY = mz ? mz[1] - start.y : 0;
  const at = (b, d) => {
    const q = project(view, b.x, d), k = Math.max(0, 1 - (d - FI.startD) / FI.muzzleBlend), e = k * k * (3 - 2 * k);
    return { x: q.x + offX * e, y: q.y + offY * e, s: q.s };
  };
  for (const b of s.bullets) {
    const F = formOf(b.form), c = F.color ?? '150,235,255', pierce = F.pierce > 0, len = pierce ? 0.3 : 0.16;
    const p = at(b, b.d), q = at(b, Math.max(FI.startD, b.d - len)), r = Math.max(2.5, 5 * view.u * p.s) * F.bullet;
    if (pierce) {
      // 穿透光彈：外面一圈柔光
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 3);
      g.addColorStop(0, `rgba(${c},.55)`); g.addColorStop(1, `rgba(${c},0)`);
      ctx.fillStyle = g; ctx.fillRect(p.x - r * 3, p.y - r * 3, r * 6, r * 6);
      ctx.restore();
    }
    ctx.strokeStyle = 'rgba(10,14,28,.55)'; ctx.lineWidth = r * 1.5;
    ctx.beginPath(); ctx.moveTo(q.x, q.y); ctx.lineTo(p.x, p.y); ctx.stroke();
    ctx.strokeStyle = `rgba(${c},.9)`; ctx.lineWidth = r * 0.9;
    ctx.beginPath(); ctx.moveTo(q.x, q.y); ctx.lineTo(p.x, p.y); ctx.stroke();
    ctx.fillStyle = 'rgba(10,14,28,.7)'; ctx.beginPath(); ctx.arc(p.x, p.y, r * 1.25, 0, 7); ctx.fill();
    ctx.fillStyle = pierce ? `rgb(${c})` : '#fff'; ctx.beginPath(); ctx.arc(p.x, p.y, r * 0.85, 0, 7); ctx.fill();
    if (pierce) { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(p.x, p.y, r * 0.45, 0, 7); ctx.fill(); }
  }
  // 槍口閃光：喺槍口一下短閃，形態越高越大
  if (s.muzzle > 0 && mz) {
    const r = unitPx(view) * 0.16 * (1 + 0.2 * s.form) * (0.6 + 0.4 * s.muzzle / 0.06);
    const g = ctx.createRadialGradient(mz[0], mz[1], 0, mz[0], mz[1], r);
    g.addColorStop(0, 'rgba(255,255,255,.95)'); g.addColorStop(0.4, `rgba(${formOf(s.form).color ?? '150,235,255'},.6)`); g.addColorStop(1, `rgba(${formOf(s.form).color ?? '95,240,255'},0)`);
    ctx.fillStyle = g; ctx.fillRect(mz[0] - r, mz[1] - r, r * 2, r * 2);
  }
}

// ---------- 特效 ----------

export function drawFx(ctx, view, s) {
  const px = unitPx(view);
  for (const f of s.fx) {
    const k = f.t / f.life, p = project(view, f.x, f.d);
    if (f.k === 'spark') {
      const r = Math.max(5, 14 * view.u) * (0.6 + k * 0.8);
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
      const sc = f.color ?? '95,240,255';
      g.addColorStop(0, `rgba(255,255,255,${1 - k})`); g.addColorStop(0.5, `rgba(${sc},${0.7 * (1 - k)})`); g.addColorStop(1, `rgba(${sc},0)`);
      ctx.fillStyle = g; ctx.fillRect(p.x - r, p.y - r, r * 2, r * 2);
    } else if (f.k === 'puff') {
      // 擊殺：一下白閃、一個擴開嘅圈、幾粒向外飛嘅碎
      const r = px * p.s * (f.size * 1.2 + k * f.size * 3.2), y = p.y - px * f.size * 0.8;
      ctx.fillStyle = `rgba(255,255,255,${0.85 * (1 - k) ** 2})`; ctx.beginPath(); ctx.arc(p.x, y, r * 0.55, 0, 7); ctx.fill();
      ctx.strokeStyle = `rgba(${f.color},${1 - k})`; ctx.lineWidth = Math.max(1.5, 4 * view.u * (1 - k));
      ctx.beginPath(); ctx.arc(p.x, y, r, 0, 7); ctx.stroke();
      ctx.fillStyle = `rgba(${f.color},${1 - k})`;
      for (let i = 0; i < 6; i++) {
        const a = i * 1.047 + f.x * 9, rr = r * (1 + k * 0.7), sz = Math.max(1.5, 3.5 * view.u * (1 - k));
        ctx.fillRect(p.x + Math.cos(a) * rr - sz / 2, y + Math.sin(a) * rr * 0.8 - sz / 2, sz, sz);
      }
    } else if (f.k === 'ring') {
      const r = px * p.s * f.size * (0.2 + k * 0.8);
      ctx.strokeStyle = `rgba(${f.color},${0.9 * (1 - k)})`; ctx.lineWidth = Math.max(2, 6 * view.u * (1 - k));
      ctx.beginPath(); ctx.ellipse(p.x, p.y, r, r * 0.8, 0, 0, 7); ctx.stroke();
    } else if (f.k === 'fall') {
      // 隊員倒低：原地一下紅色淡出
      const r = px * 0.07 * (1 + k);
      ctx.fillStyle = `rgba(${BAD},${0.6 * (1 - k)})`; ctx.beginPath(); ctx.ellipse(p.x, p.y - r * 0.5, r, r * 1.3, 0, 0, 7); ctx.fill();
    } else if (f.k === 'num') {
      const size = 26 * view.u * (1 + 0.5 * Math.max(0, 1 - k * 5)), y = p.y - 34 * view.u * k;
      setFont(ctx, size, 800); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.globalAlpha = Math.min(1, (1 - k) * 2.5);
      ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(3, size * 0.16); ctx.strokeStyle = COLORS.ink; ctx.strokeText(f.text, p.x, y);
      ctx.fillStyle = f.tone === 'gain' ? `rgb(${GOOD})` : f.tone === 'loss' ? COLORS.red : COLORS.gold; ctx.fillText(f.text, p.x, y);
      ctx.globalAlpha = 1;
    }
  }
}

/** 戰力大字：浮喺主角頭上，變嗰陣跳大、加變綠、扣變紅；平時用形態主題色，旁邊細字寫住形態。 */
export function drawCount(ctx, view, s, motion) {
  const N = CROWD.squad, R = squadRadius(s.members), top = project(view, s.x, R * N.depthSquash * 0.3), F = formOf(s.form);
  const k = s.pop.t > 0 ? s.pop.t / N.numberPop : 0, size = 44 * view.u * (1 + 0.6 * k * k);
  // 放喺槍管尖上面少少（槍管伸到頭頂以上）
  // 各形態嘅槍尖高度唔同：跟住嗰個形態嘅主圖計
  const look = unitLook(s.form, motion.still);
  const y = Math.max(size, project(view, s.x, 0).y - view.H * (view.unitScale ?? 1) * look.height * ((look.top ?? look.muzzle[1]) - look.footDrop + 0.04) - size * 0.6);
  const txt = formatNumber(s.power);
  const base = F.color ? `rgb(${F.color})` : '#fff';
  // 受擊：數字抖一下
  if (s.hurt > 0) top.x += Math.sin(s.t * 95) * CROWD.feel.hurt.shake * view.u * (s.hurt / CROWD.feel.hurt.time);
  const color = k > 0.15 ? (s.pop.tone === 'gain' ? `rgb(${GOOD})` : COLORS.red) : base;
  ctx.save();
  setFont(ctx, size, 800); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  // 底牌：數字會疊住門同敵人，要有塊深色底先睇得清；框用形態主題色
  const pw = ctx.measureText(txt).width + size * 0.7;
  slantPanel(ctx, top.x - pw / 2, y - size * 0.6, pw, size * 1.16, size * 0.2, 'rgba(14,18,32,.93)', k > 0.15 ? color : (F.color ? base : 'rgba(255,255,255,.35)'));
  ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(3, size * 0.15); ctx.strokeStyle = COLORS.ink; ctx.strokeText(txt, top.x, y);
  ctx.shadowColor = color; ctx.shadowBlur = (6 + 12 * k + 4 * s.form) * view.u; ctx.fillStyle = color; ctx.fillText(txt, top.x, y);
  ctx.restore();
  // 細字：「戰力 · 形態」
  setFont(ctx, 13 * view.u, 700); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round'; ctx.lineWidth = 3 * view.u; ctx.strokeStyle = COLORS.ink;
  const cap = `${CROWD_TEXT.power} · ${F.name}`;
  ctx.strokeText(cap, top.x, y - size * 0.86); ctx.fillStyle = base; ctx.fillText(cap, top.x, y - size * 0.86);
  if (s.rapid > 0) {
    // 火力加成剩低幾耐
    const w = 70 * view.u, h = 6 * view.u, f = s.rapid / CROWD.crate.rapidTime;
    ctx.fillStyle = 'rgba(14,18,32,.8)'; ctx.fillRect(top.x - w / 2, y + size * 0.62, w, h);
    ctx.fillStyle = COLORS.gold; ctx.fillRect(top.x - w / 2, y + size * 0.62, w * f, h);
  }
}

// ---------- 介面 ----------

export function drawHud(ctx, view, s) {
  const { W, H, u } = view;
  // 關卡牌同進度條
  slantPanel(ctx, 14 * u, 16 * u, 150 * u, 36 * u, 9 * u, COLORS.panel, 'rgba(255,255,255,.25)');
  setFont(ctx, 21 * u, 800); ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillText(CROWD_TEXT.stage(s.stageNo), 30 * u, 34 * u);
  const x0 = 186 * u, x1 = W - 24 * u, y = 34 * u, k = progress(s);
  ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 3 * u; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke();
  ctx.strokeStyle = COLORS.cyan; ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x0 + (x1 - x0) * k, y); ctx.stroke();
  ctx.fillStyle = COLORS.cyan; ctx.beginPath(); ctx.arc(x0 + (x1 - x0) * k, y, 6 * u, 0, 7); ctx.fill();
  ctx.fillStyle = COLORS.red; ctx.save(); ctx.translate(x1, y); ctx.rotate(Math.PI / 4); ctx.fillRect(-6 * u, -6 * u, 12 * u, 12 * u); ctx.restore();
  // 橫額：輸、贏、升級
  if (s.banner.t > 0 && !(s.banner.delay > 0)) {
    const a = Math.min(1, s.banner.t * 3), c = s.banner.tone === 'loss' ? COLORS.red : s.banner.tone === 'gain' ? `rgb(${GOOD})` : s.banner.color ? `rgb(${s.banner.color})` : COLORS.gold;
    ctx.globalAlpha = a;
    slantPanel(ctx, W * 0.08, H * 0.36, W * 0.84, 64 * u, 16 * u, 'rgba(14,18,32,.86)', c);
    setFont(ctx, 34 * u, 800); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = c;
    ctx.fillText(s.banner.text, W / 2, H * 0.36 + 33 * u);
    ctx.globalAlpha = 1;
  }
}
