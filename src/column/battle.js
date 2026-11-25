// 「三線長列」玩法：狀態同每一步嘅更新。只改狀態物件，唔掂畫布（畫法喺 render.js）。
// 固定步長、冇亂數：同一串輸入一定得出同一個結果。
// 主角、戰力、進化、操作同頂視版共用（crowd/battle.js 嘅 setPower、setTarget、setKeyDir）；唔同嘅係場上嘅嘢同射擊。
//
// 每一步嘅次序：主角橫移 → 世界向主角捲、方陣同首領自己再逼近 → 路障推人 → 出新嘢 → 齊射 → 子彈飛同命中 →
//   碰撞（收磚、過門、敵人掂到扣戰力、首領數字比拼）→ 判輸贏。
// 輸 / 贏之後停喺結算畫面，等玩家撳（confirmResult）先重開 / 入下一關，唔會自動行落去。

import { CROWD, CROWD_TEXT } from '../data/crowd.js';
import { COLUMN, COLUMN_TEXT, burstOf, columnStage, niceNumber } from '../data/column.js';
import { MECH, endlessWave } from '../data/campaign.js';
import { setPower, setTarget, sideLimit } from '../crowd/battle.js';
import { stepLean } from '../crowd/feel.js';
import { applyGate, evolutionLevel, gateIndexAt, gateLabel, gateSegment, isGoodGate, shootGate, squadRadius } from '../crowd/rules.js';
import { bossClash, canShootGate, laneAt, laneX, coverCols, gateResult, phalanxColFor, phalanxColX, phalanxColsFor, salvoCount, salvoLayout, shotDamage } from './rules.js';
import { WEAPONS, armAt, weaponAt, weaponLevel, weaponRate } from '../data/weapons.js';
import { formatNumber } from '../core/format.js';
import { MATE_IDS, MAX_MATES, chainOrder, rosterOf } from '../data/characters.js';

export { setKeyDir, setPower, setTarget } from '../crowd/battle.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/**
 * 狀態大致同頂視版一樣（power、form、x、targetX、units、ents、bullets、fx…），場上嘅嘢（ents）唔同：
 *   bricks   加數磚列 { lane, x, d（第 0 塊嘅位置）, n, head（下一塊未收嘅係第幾塊）, val, gap, prize, lock（鎖住佢嘅路障）}
 *   barrier  數字路障 { lane, x, d, hp, max }
 *   （磚列、路障、方陣都有 at = 佢屬於邊一節，即係關卡表入面嗰節嘅 at）
 *   phalanx  敵人大方陣 { lane, x, d（第 0 排嘅位置）, cols, rows, alive（每隻仲喺唔喺度）, front（每一行最前嗰隻係第幾排）, left }
 *   gates    一排門（同頂視版一樣）
 *   boss     首領 { x, d, hp, max }
 * @param {{ stageNo?: number, seed?: number | string, startForm?: number, startWeapon?: number, mates?: number }} [opts]  startWeapon = 由第幾級武器開始（1 起計；只限大數字版）；mates = 邊啲隊員跟跑（角色 id，例如 ['suzu', 'kiri']；預設冇）
 */
export function createColumnBattle(opts = {}) {
  const state = /** @type {any} */ ({
    mode: 'column', seed: opts.seed ?? 1, t: 0, events: [], banner: { text: '', t: 0, tone: 'info' },
    keyDir: 0, kills: 0, attempts: 0,
    startForm: Math.max(0, Math.min(Math.floor(opts.startForm ?? 0) || 0, CROWD.evolution.thresholds.length)),
    startWeapon: Math.max(0, Math.min(Math.floor(opts.startWeapon ?? 0) || 0, WEAPONS.length)),
    mateIds: [...new Set(Array.isArray(opts.mates) ? opts.mates : [])].filter((id) => MATE_IDS.includes(id)).slice(0, MAX_MATES),
    // 養成（meta/growth.js 嘅 battleSetup）：mateCfg = 每個隊員養成後嘅戰鬥數值（冇就用角色表嗰份）；boost = 隊長同全隊嘅加成
    mateCfg: opts.mateCfg ?? null, boost: { charge: 1, burstTime: 0, burstMul: 0, ...(opts.boost ?? {}) },
  });
  enterStage(state, opts.stageNo ?? 1);
  return state;
}

/** 入一關（或者輸咗重打同一關）：全部歸零。 */
export function enterStage(state, no) {
  state.stageNo = no;
  state.stage = columnStage(no);
  state.phase = 'run';
  state.dist = 0; state.next = 0; state.hold = 0;
  state.power = state.startForm > 0 ? CROWD.evolution.thresholds[state.startForm - 1] : (COLUMN.numbers.startPower ?? CROWD.squad.startPower);
  if (COLUMN.numbers.weapons && state.startWeapon > 0) state.power = Math.max(state.power, weaponAt(state.startWeapon - 1));
  state.peak = state.power;
  state.members = 1;
  state.x = 0; state.targetX = 0;
  state.units = [{ x: 0, d: 0, born: 0, v: 0 }];
  state.ents = []; state.bullets = []; state.fx = [];
  state.cd = COLUMN.fire.interval; state.muzzle = 0; state.salvo = 0;
  state.weapon = Math.max(weaponLevel(state.power), COLUMN.numbers.minWeapon ?? 0); state.weaponUp = null; state.weaponT = 0; state.shotN = 0; state.burstN = 0;
  state.pop = { t: 0, tone: 'gain' }; state.flash = 0; state.shake = 0;
  state.form = evolutionLevel(state.power); state.formPeak = state.form; state.evoT = 0;
  state.boss = null; state.bossSpawned = false;
  state.vx = 0; state.lean = 0; state.leanV = 0; state.strafe = 0; state.recoil = 0; state.hurt = 0; state.slow = 0;
  state.gained = 0; state.lost = 0; state.kills = 0;
  // 爆發技：charge 爆發槽（0–1）；cut 特寫仲有幾耐（真實秒）；t 爆發仲有幾耐；n 呢關放咗幾多次；go = 啱啱撳咗（下一步先報事件）
  state.burst = { charge: 0, cut: 0, t: 0, n: 0, go: false, full: false, order: null };
  // 隊伍：隊長（state.x）加 mates。每個隊員：id、cfg 戰鬥數值、x 而家橫向位置（跟隊長，有延遲）、d 前後、cd 幾耐之後再出手、shot 出咗幾多下、fireT 啱啱出手（畫面用）
  const T = COLUMN.team;
  state.team = { mates: (state.mateIds ?? []).map((id, i) => { const cfg = state.mateCfg?.[id] ?? rosterOf(id).battle, sl = T.slots[cfg.slot]; return { id, cfg, x: sl[0], d: sl[1], cd: cfg.interval * (0.4 + 0.3 * i), shot: 0, fireT: 0, lag: 1 - 0.18 * i, dcd: cfg.drone ? cfg.drone.interval * 0.6 : 0 }; }) };
  // 榴彈（燈）：飛緊嘅 { x, d, x0, d0, t, T, ent, ox, od }；光盾（楯）：up = 撐緊（下一次損失會擋走）、cd 仲有幾耐撐返起、t 擋咗之後嘅無敵時間、n 擋咗幾多次、saved 擋走咗幾多戰力
  state.shells = [];
  // 路面機關：mud = 企緊減速帶（仲有幾耐先當離開）；rapid = 加速帶效果仲有幾耐。翻盤：同首領比拼輸梗嗰陣，光盾／儲滿嘅爆發各可以頂返一次
  state.mud = 0; state.rapid = 0; state.repel = { guard: false, burst: false }; state.wave = state.stage.endless ? 1 : 0;
  const guard = state.team.mates.find((m) => m.cfg.guard)?.cfg.guard;
  state.guard = guard ? { cfg: guard, up: false, cd: guard.every * 0.5, t: 0, n: 0, saved: 0, flash: 0 } : null;
  state.burst.order = null;
}

// ---------- 爆發技 ----------

/** 儲爆發槽（爆發緊、特寫緊唔儲）。啱啱儲滿就報 burstReady。 */
function chargeBurst(state, amount) {
  const b = state.burst;
  if (!b || b.t > 0 || b.cut > 0 || b.charge >= 1 || !(amount > 0)) return;
  b.charge = Math.min(1, b.charge + amount * (state.boost?.charge ?? 1));
  if (b.charge >= 1) state.events.push({ type: 'burstReady' });
}

/** 爆發槽滿咗未（可以發動）。 */
export const burstReady = (state) => !!state.burst && state.burst.charge >= 1 && state.burst.t <= 0 && state.burst.cut <= 0 && (state.phase === 'run' || state.phase === 'boss');

/** 爆發緊（火力加倍嗰段）。 */
export const burstActive = (state) => !!state.burst && state.burst.t > 0;

/** 玩家發動爆發技：槽滿先得。得咗回傳 true（下一步插入特寫，之後火力加倍）。 */
export function triggerBurst(state) {
  if (!burstReady(state)) return false;
  const b = state.burst;
  // 起、承、決三個人都喺隊：完整爆發，照次序接力（一下撳就得，唔使逐個撳）
  b.order = chainOrder(['falcon', ...state.team.mates.map((m) => m.id)]); b.full = !!b.order;
  b.charge = 0; b.cut = burstCfg(state).cutTime; b.n++; b.go = true;
  b.T = burstCfg(state).time; b.M = burstCfg(state).mul; // 今次爆發合共幾耐、幾多倍（畫面用）
  return true;
}

/** 而家呢次爆發用邊套數（完整 / 單人）：{ time, mul, cutTime }。 */
export function burstCfg(state) {
  const base = burstOf(state.burst), B = state.boost, time = B?.burstTime ?? 0, mul = state.burst?.full ? B?.burstMul ?? 0 : 0; // 倍率加成淨係接力（完整爆發）先有
  if (!time && !mul) return base;
  const c = state.burstCache;
  if (c && c.base === base) return c.out;
  state.burstCache = { base, out: { ...base, time: base.time + time, mul: Math.round((base.mul + mul) * 100) / 100 } };
  return state.burstCache.out;
}

/**
 * 隊員跟跑同出手。每個隊員每秒輸出 = 隊長而家戰力 ÷ 4 × share，平均分落每一下；子彈／刀氣係真嘅（同隊長嘅子彈行同一套命中規則：
 * 畫面上打中先算中），由隊員自己面前直飛出去。隊員唔會受傷、唔佔碰撞。rate = 爆發期間射速倍數。
 */
function stepTeam(s, dt, rate) {
  const T = COLUMN.team, F = COLUMN.fire, P = COLUMN.phalanx;
  // 隊長面前最近嗰個目標（方陣、路障、首領）：隊員企喺兩邊，子彈向佢斜飛過去（去到目標嗰度啱啱入到佢嘅闊度）；冇目標就直飛
  let aim = null, aimW = 0;
  for (const e of s.ents) {
    const ok = e.type === 'phalanx' ? e.left > 0 : (e.type === 'barrier' || e.type === 'boss') && !e.dead;
    if (ok && e.d > 0.3 && Math.abs(e.x - s.x) < 0.5 && (!aim || e.d < aim.d)) { aim = e; aimW = e.type === 'phalanx' ? Math.abs(phalanxColX(e.cols, e.cols - 1)) : e.type === 'barrier' ? COLUMN.barrier.halfWidth * 0.7 : 0.2; }
  }
  for (const m of s.team.mates) {
    const c = m.cfg, sl = T.slots[c.slot];
    m.x += (s.x + sl[0] - m.x) * (1 - Math.exp(-T.follow * m.lag * dt)); m.d = sl[1];
    m.fireT = Math.max(0, m.fireT - dt);
    if (!(s.power > 0)) continue;
    // 無人機（燈）：自己隔一陣補一發細光彈
    if (c.drone && (m.dcd -= dt * rate) <= 0) {
      m.dcd += c.drone.interval;
      const x = m.x + c.drone.side, d0 = m.d + F.startD, tx = aim ? clamp(x, aim.x - aimW, aim.x + aimW) : x;
      s.bullets.push({ x, d: d0, form: s.form, fresh: true, mate: m.id, mk: `${m.id}:drone`, half: 0, pierce: 1, chain: 0, dmg: Math.max(1, Math.floor(s.power / 4 * c.drone.share * c.drone.interval)), near: 0, vx: aim && aim.d - d0 < c.drone.range ? (tx - x) * c.drone.speed / Math.max(0.6, aim.d - d0) : 0, speed: c.drone.speed, range: m.d + c.drone.range, homing: 0, off: 0 });
      if (s.events.length < 60) s.events.push({ type: 'droneFire', id: m.id });
    }
    if ((m.cd -= dt * rate) > 0) continue;
    const n = c.burst ?? 1, dmg = Math.max(1, Math.floor(s.power / 4 * c.share * c.interval / n));
    if (c.kind === 'lob') {
      // 榴彈：要有目標先射（冇就留住）。向隊長面前最近嗰個目標拋過去，落地範圍爆炸
      if (!aim || aim.d > c.range) { m.cd = 0; continue; }
      m.cd += c.interval; m.shot++; m.fireT = 0.5;
      s.shells.push({ mate: m.id, x: m.x, d: m.d + 0.3, x0: m.x, d0: m.d + 0.3, t: 0, T: c.blast.time, ent: aim, ox: clamp(m.x - aim.x, -aimW, aimW) * 0.4, od: aim.type === 'phalanx' ? 0.25 : 0, dmg, form: s.form });
      if (s.events.length < 60) s.events.push({ type: 'mateFire', id: m.id });
      continue;
    }
    m.shot++; m.fireT = 0.5;
    m.cd += n > 1 ? (m.shot % n ? c.burstGap : c.interval - c.burstGap * (n - 1)) : c.interval; // 點射：一輪 n 下，輪入面相隔 burstGap
    const x = m.x + (c.alt ? (m.shot % 2 ? c.alt : -c.alt) : 0);
    const d0 = m.d + F.startD, tx = aim ? clamp(x, aim.x - aimW, aim.x + aimW) : x, vx = aim && aim.d - d0 < c.range ? (tx - x) * c.speed / Math.max(0.6, aim.d - d0) : 0;
    s.bullets.push({ x, d: d0, form: s.form, fresh: true, mate: m.id, half: c.half, pierce: c.pierce, chain: 0, dmg, near: c.near, vx, speed: c.speed, range: m.d + c.range, homing: 0, off: 0 });
    if (s.events.length < 60) s.events.push({ type: 'mateFire', id: m.id });
  }
  stepShells(s, dt);
  // 光盾：擋完之後等 every 秒再撐起
  const g = s.guard;
  if (g) {
    g.flash = Math.max(0, g.flash - dt);
    if (g.t > 0) g.t = Math.max(0, g.t - dt);
    else if (!g.up && (g.cd -= dt) <= 0) { g.up = true; s.events.push({ type: 'shieldUp' }); fx(s, 'ring', s.x, 0.7, 0.4, { color: '90,150,255', size: 1.1 }, true); }
  }
}

/** 榴彈飛行同落地爆炸。目標仲喺度就跟住佢（目標向主角行緊），唔喺度就落喺原本瞄嗰點。 */
function stepShells(s, dt) {
  if (!s.shells.length) return;
  let kept = 0;
  for (const sh of s.shells) {
    sh.t += dt;
    const e = sh.ent, alive = e && !e.dead && s.ents.includes(e), front = alive && e.type === 'phalanx' ? phalanxFront(e) : 0;
    if (alive) { sh.tx = e.x + sh.ox; sh.td = Math.max(0.6, e.d + front + sh.od); }
    else if (sh.td !== undefined) sh.td -= COLUMN.world.scroll * dt; // 目標冇咗：個落點照樣跟住路面向後退
    const k = Math.min(1, sh.t / sh.T);
    sh.x = sh.x0 + ((sh.tx ?? sh.x0) - sh.x0) * k; sh.d = sh.d0 + ((sh.td ?? sh.d0 + 3) - sh.d0) * k; sh.k = k;
    if (k < 1) { s.shells[kept++] = sh; continue; }
    explode(s, sh);
  }
  s.shells.length = kept;
}
/** 方陣最前嗰隻離方陣起點幾遠。 */
function phalanxFront(e) { let f = Infinity; for (let c = 0; c < e.cols; c++) if (e.front[c] < e.rows) f = Math.min(f, e.front[c]); return f === Infinity ? 0 : f * COLUMN.phalanx.gapD; }
/** 榴彈爆炸：落點附近嘅方陣，冚到嘅每一行由最前數起倒 rows 隻；路障、首領食一發嘅威力。 */
function explode(s, sh) {
  const B = (s.team.mates.find((m) => m.id === sh.mate)?.cfg ?? rosterOf(sh.mate).battle).blast, reach = 0.9;
  fx(s, 'ring', sh.x, sh.d, 0.45, { color: '255,120,190', size: B.half * 5 }, true);
  fx(s, 'puff', sh.x, sh.d, 0.4, { color: '255,200,120', size: B.half * 1.6 }, true);
  s.shake = Math.max(s.shake, 0.12);
  s.events.push({ type: 'blast', id: sh.mate });
  for (const e of s.ents) {
    if (e.dead) continue;
    if (e.type === 'phalanx') {
      const fd = e.d + phalanxFront(e), wide = Math.abs(phalanxColX(e.cols, e.cols - 1)) + COLUMN.phalanx.r;
      if (e.left > 0 && Math.abs(fd - sh.d) < reach && Math.abs(e.x - sh.x) < wide + B.half) hit(s, e, { x: clamp(sh.x, e.x - wide, e.x + wide), form: sh.form, mate: sh.mate, half: B.half, pierce: B.rows, chain: 0, dmg: sh.dmg, near: 0 }, fd);
    } else if ((e.type === 'barrier' || e.type === 'boss') && Math.abs(e.d - sh.d) < reach && Math.abs(e.x - sh.x) < 0.45) hit(s, e, { x: sh.x, form: sh.form, mate: sh.mate, half: B.half, pierce: 1, chain: 0, dmg: sh.dmg, near: 0 }, e.d);
  }
}

/** 結算畫面而家收唔收撳（輸 / 贏咗、又停夠咗）。 */
export const resultReady = (state) => (state.phase === 'defeat' || state.phase === 'clear') && state.hold <= 0;

/**
 * 玩家喺結算畫面撳咗一下：輸咗 → 重打同一關；贏咗 → 入下一關。未去到結算、或者仲未停夠，就乜都唔做（回傳 false）。
 */
export function confirmResult(state) {
  if (!resultReady(state)) return false;
  if (state.phase === 'defeat') state.attempts++;
  enterStage(state, state.phase === 'clear' ? state.stageNo + 1 : state.stageNo);
  state.banner = { text: '', t: 0, tone: 'info' };
  return true;
}

/** 關卡行咗幾多（0–1）：首領去到主角面前 = 1。 */
export const progress = (state) => clamp(state.dist / state.stage.boss.at, 0, 1);

// ---------- 特效（純畫面；多過 fxCap 就唔再加）----------

function fx(state, k, x, d, life, extra, force) {
  if (!force && state.fx.length >= COLUMN.fxCap) return;
  state.fx.push({ k, x, d, t: 0, life, ...extra });
}
const floatText = (state, x, d, text, tone) => fx(state, 'num', x, d, 0.8, { text, tone }, true);
/** 永久升級「收入加成」：磚、大獎磚、加數門、賞金、射門都乘呢個數（冇升級 = 1）。 */
const INC = () => COLUMN.numbers.income ?? 1;

// ---------- 出嘢 ----------

const hitState = () => ({ hit: 0, pop: 0, ft: -1 });

function spawnLane(state, item, lane, d, at) {
  const x = item.x ?? laneX(lane), B = COLUMN.bricks, R = COLUMN.barrier, P = COLUMN.phalanx, W = COLUMN.world; // item.x：唔跟線中心（闊方陣橫跨兩條線）
  if (item.type === 'bricks') {
    state.ents.push({ type: 'bricks', lane, at, x, d, n: item.n, head: 0, val: item.val ?? 1, pct: item.pct ?? 0, gap: B.gap, prize: false, lock: null, ...hitState() });
  } else if (item.type === 'barrier') {
    const wall = { type: 'barrier', lane, at, x, d, hp: item.hp, max: item.hp, pushed: false, ...hitState() };
    state.ents.push(wall);
    state.ents.push({ type: 'bricks', lane, at, x, d: d + R.prizeLead, n: item.prize.n, head: 0, val: item.prize.val ?? 1, pct: item.prize.pct ?? 0, gap: R.prizeGap, prize: true, lock: wall, ...hitState() });
  } else if (item.type === 'phalanx') {
    // 方陣行得快過路面：放遠啲，等佢比同一節其他嘢早 early 秒去到主角面前
    const far = (d / W.scroll - P.early) * (W.scroll + P.speed);
    state.ents.push({
      type: 'phalanx', lane, at, x, d: Math.max(d, far), cols: item.cols, rows: item.rows,
      bite: item.bite ?? 1, // 每隻掂到主角扣幾多戰力
      // 精英：每隻要中 tough 下先倒（wear = 每行最前嗰隻已經中咗幾多下），賞金係普通嘅 bounty 倍
      tough: item.tough ?? 1, elite: !!item.elite, bounty: item.bounty ?? 1, wear: new Uint8Array(item.cols),
      alive: new Uint8Array(item.cols * item.rows).fill(1), front: new Int16Array(item.cols), left: item.cols * item.rows, total: item.cols * item.rows, ...hitState(),
      // 遊走方陣：x0 = 中線，照 sway 左右擺；盾兵方陣：shield = 前面塊盾仲有幾多（打爆先傷到後面）
      x0: x, sway: item.sway ?? null, shield: item.shield ?? 0, shieldMax: item.shield ?? 0,
    });
  }
}

function spawn(state, item) {
  const d = item.at - state.dist;
  if (item.type === 'gates') {
    state.ents.push({ type: 'gates', d, used: false, picked: -1, gates: item.gates.map((g) => ({ ...g, val: g.val ?? 0, hits: 0, hit: 0, pop: 0, flipT: 0 })), live: item.gates.some((g) => g.frac > 0) });
  } else if (item.type === 'section') {
    item.lanes.forEach((l, lane) => { if (l) spawnLane(state, l, lane, d, item.at); });
  } else if (item.type === 'hazard') {
    // 危險地帶：一條線上面一段紅色地面（由 d 到 d + len），主角企喺上面每秒扣當時戰力嘅 rate
    state.ents.push({ type: 'hazard', lane: item.lane, x: laneX(item.lane), d, len: item.len, rate: item.rate, ...hitState() });
  } else if (item.type === 'slow' || item.type === 'boost') {
    // 減速帶／加速帶：一條線上面一段有色地面
    state.ents.push({ type: item.type, lane: item.lane, x: laneX(item.lane), d, len: item.len, used: false, ...hitState() });
  } else if (item.type === 'miniboss') {
    // 中段小首領：同首領一樣係一個數字、自己行埋嚟；打低有大獎（戰力 × (1 + prize)），打唔低撞到就扣戰力，但唔會完場
    const far = d / COLUMN.world.scroll * (COLUMN.world.scroll + COLUMN.boss.speed);
    state.ents.push({ type: 'boss', mini: true, prize: item.prize, x: 0, d: far, hp: item.hp, max: item.hp, ...hitState() });
  }
}

function spawnDue(state) {
  const W = COLUMN.world, T = state.stage.timeline;
  while (state.next < T.length && T[state.next].at - state.dist <= W.spawnDistance) spawn(state, T[state.next++]);
  const B = state.stage.boss;
  if (!state.bossSpawned && B.at - state.dist <= W.spawnDistance) {
    state.bossSpawned = true;
    // 首領自己行埋嚟：放遠啲，等佢喺 boss.at 嗰刻去到主角面前
    const d = (B.at - state.dist) / W.scroll * (W.scroll + COLUMN.boss.speed);
    // slam：首領出招嘅設定（冇 = 唔出招）；atk = 而家預告緊／砸緊邊條線；phases 2 = 打到一半發狂
    state.boss = { type: 'boss', x: 0, d, hp: B.hp, max: B.hp, slam: B.slam ?? null, phases: B.phases ?? 1, phase: 1, atk: null, atkCd: B.slam ? B.slam.every : 0, ...hitState() };
    state.ents.push(state.boss);
  }
}

// ---------- 射擊 ----------

/** 齊射。回傳下一輪幾耐之後射。舊數值：粒數跟戰力，每粒威力 1；橫向排開，多過一排就向後疊。大數字：照而家嗰級武器。 */
function fire(state) {
  if (COLUMN.numbers.weapons) return fireWeapon(state);
  const n = salvoCount(state.power), F = COLUMN.fire;
  if (!n) return F.interval;
  for (const o of salvoLayout(n)) state.bullets.push({ x: state.x + o.x, d: F.startD - o.d, form: state.form, fresh: true });
  state.salvo = n;
  state.muzzle = 0.06;
  state.recoil = CROWD.feel.recoil.time;
  state.events.push({ type: 'fire', weapon: -1 });
  return F.interval;
}

/**
 * 用而家嗰級武器射一輪（data/weapons.js）。每粒記低自己嘅規則數值（half 命中半闊、pierce 穿透、chain 連鎖、dmg 威力），
 * 之後升咗級，飛緊嘅舊子彈照舊。會飛嘅（shot）放入 bullets；即時命中嘅（beam、strike）即刻結算，另外放一個純畫面嘅光束／光柱特效。
 */
function fireWeapon(state) {
  const F = COLUMN.fire;
  if (!(state.power > 0)) return F.interval;
  // 手上嗰級（武器一級一級升，可以暫時落後過戰力）；每粒威力 = 每秒合共威力（戰力 ÷ 4 × out）平均分落每一粒
  const A = armAt(state.weapon, state.power), W = A.weapon, n = A.count, dmg = Math.max(1, Math.floor(state.power * W.out / (4 * weaponRate(W) * n))), shot = ++state.shotN;
  const aim = aimSalvo(state, A, shot), sway = !aim && W.sweep ? Math.sin(shot * 1.9) * W.sweep : 0;
  for (let i = 0; i < n; i++) {
    let off = (i - (n - 1) / 2) * W.gap + sway, vx = off * W.fan, x = state.x + off;
    if (aim) {
      // 前面有方陣：呢粒分配咗去 aim.xs[i] 嗰行。散彈由主角面前斜飛過去（去到嗰行最前嗰隻嗰度啱啱到位）；飛彈照舊由身邊出，飛行途中追過去；其餘直接喺嗰行正前方出
      const tx = aim.xs[i];
      if (W.fan) vx = (tx - x) * W.speed / Math.max(0.6, aim.ds[i] - F.startD);
      else if (W.homing) off = tx - aim.e.x;
      else { x = tx; off = tx - state.x; }
    }
    const b = { x, d: F.startD, form: state.form, fresh: true, w: A.level, half: W.half, pierce: A.pierce, chain: A.chain, dmg, vx, speed: W.speed, range: W.range, homing: W.homing, off };
    if (W.kind === 'shot') state.bullets.push(b); else scan(state, b, W);
  }
  state.salvo = n;
  state.muzzle = 0.06;
  state.events.push({ type: 'fire', weapon: A.level });
  if (W.interval >= 0.15 || shot % 4 === 0) state.recoil = CROWD.feel.recoil.time; // 射得好密嘅武器：唔好每一下都後座
  if (++state.burstN < W.burst) return W.burstGap;
  state.burstN = 0;
  return W.interval - W.burstGap * (W.burst - 1);
}

/**
 * 自動分配（2026-11-23，「紅色小兵成日打唔中」）：前面射程內有方陣、而且有敵人喺主角左右 aimReach 以內，
 * 呢一輪每粒子彈各自去一行——揀最前嗰隻最近主角嘅行先（一樣近就輪流），一粒冚到嘅行唔重複揀。
 * 所以粒數少嘅武器都會一輪一輪掃勻成個闊度，唔會永遠淨係打中間嗰幾行；清得慢嘅話，漏網嘅係後排，唔係邊上成行。
 * 本身已經冚晒成條線嘅武器（命中半闊 ≥ 0.3）唔使分配。回傳 { e 方陣, xs 每粒去邊個 x, ds 嗰行最前嗰隻幾遠 }；冇方陣就 null。
 */
function aimSalvo(state, A, shot) {
  const W = A.weapon, P = COLUMN.phalanx, reach = COLUMN.fire.aimReach;
  if (W.half >= 0.3) return null;
  let e = null, cand = null;
  for (const t of state.ents) {
    if (t.type !== 'phalanx' || t.left <= 0 || t.d > W.range || (e && t.d >= e.d)) continue;
    const list = [];
    for (let c = 0; c < t.cols; c++) if (t.front[c] < t.rows && Math.abs(t.x + phalanxColX(t.cols, c) - state.x) <= reach && t.d + t.front[c] * P.gapD > 0) list.push(c);
    if (list.length) { e = t; cand = list; }
  }
  if (!e) return null;
  cand.sort((p, q) => e.front[p] - e.front[q] || ((p + shot * 3) % e.cols) - ((q + shot * 3) % e.cols));
  const side = (coverCols(W.half) - 1) / 2, used = new Set(), xs = [], ds = [];
  for (let i = 0; i < A.count; i++) {
    const c = cand.find((k) => !used.has(k)) ?? cand[i % cand.length];
    for (let k = c - side; k <= c + side; k++) used.add(k);
    xs.push(e.x + phalanxColX(e.cols, c)); ds.push(e.d + e.front[c] * P.gapD);
  }
  return { e, xs, ds };
}

/** 即時命中：由主角正前方直線掃出去，射到第一樣嘢為止（對方陣由 muzzleD 計起，其他由 startD）。 */
function scan(state, b, W) {
  const F = COLUMN.fire;
  let ent = null, at = Infinity;
  for (const e of state.ents) {
    const d = hitDistance(e, b.x, e.type === 'phalanx' ? F.muzzleD : F.startD, W.range, b.half);
    if (d >= 0 && d < at) { at = d; ent = e; }
  }
  // 純畫面：光束由槍口畫到命中嗰度（冇嘢中就畫到射程盡頭）；光柱落喺命中嗰度（冇嘢中唔畫）
  if (W.kind === 'strike') { if (ent) fx(state, 'pillar', b.x, at, 0.32, { half: b.half, w: b.w }); } else fx(state, 'beam', b.x, ent ? at : W.range, Math.max(0.07, W.interval * 1.5), { half: b.half, w: b.w });
  if (ent) hit(state, ent, b, at);
}

/** 磚列最前嗰塊（未收嘅）喺邊；收晒就 null。 */
export const brickHeadD = (e) => (e.head < e.n ? e.d + e.head * e.gap : null);

/** 磚列而家收唔收得（大獎磚要等路障碎咗）。 */
export const bricksOpen = (e) => !e.lock || e.lock.hp <= 0;

/**
 * 呢粒子彈（橫向 x，今步由 from 飛到 to）會唔會打中呢樣嘢；打中就回傳喺幾遠打中，打唔中回傳 −1。
 * 門：乘除門、未入射程都係穿過。大獎磚有路障擋住，射唔到。
 */
function hitDistance(e, x, from, to, half = 0) {
  let d = -1;
  if (e.dead) return -1;
  if (e.type === 'bricks') {
    if (e.head >= e.n || !bricksOpen(e) || Math.abs(x - e.x) > COLUMN.bricks.halfWidth + half) return -1;
    d = e.d + e.head * e.gap;
  } else if (e.type === 'barrier') {
    if (Math.abs(x - e.x) > COLUMN.barrier.halfWidth + half) return -1;
    d = e.d;
  } else if (e.type === 'phalanx') {
    const c = phalanxColFor(e, x, half);
    if (c < 0) return -1;
    d = e.d + e.front[c] * COLUMN.phalanx.gapD;
  } else if (e.type === 'gates') {
    if (e.used || !canShootGate(e.gates[gateIndexAt(e.gates.length, x)], e.d)) return -1;
    d = e.d;
  } else if (e.type === 'boss') {
    if (Math.abs(x - e.x) > COLUMN.boss.halfWidth + half) return -1;
    d = e.d;
  }
  return d >= from - 0.06 && d <= to && d > 0 ? d : -1;
}

function stepBullets(state, dt) {
  const F = COLUMN.fire, B = state.bullets, E = state.ents;
  let kept = 0;
  for (let i = 0; i < B.length; i++) {
    // 啱啱射出嗰一步，對方陣由 muzzleD 掃起：貼到埋身（startD 以內）嘅小敵人都打得中。其他嘢（磚、路障、門、首領）照舊由子彈起飛嗰度計
    const b = B[i], from = b.d, near = b.fresh ? Math.min(b.d, F.muzzleD) : b.d, to = from + (b.speed ?? F.speed) * dt, half = b.half ?? 0;
    b.fresh = false;
    // 武器嘅橫向郁動（規則嚟㗎：子彈去到邊，就喺邊度判定）：散彈向外散開；飛彈追住最近嗰塊方陣嘅中線
    if (b.vx) b.x += b.vx * dt;
    if (b.homing) {
      let aim = null, best = 0.4; // 只追自己嗰條線附近嘅方陣（隔離線嗰塊唔追，費事打緊路障嗰陣飛咗去第二度）
      for (let k = 0; k < E.length; k++) { const e = E[k]; if (e.type === 'phalanx' && e.left > 0 && e.d + e.rows * COLUMN.phalanx.gapD > b.d && Math.abs(e.x - b.x) < best) { best = Math.abs(e.x - b.x); aim = e; } }
      if (aim) b.x += clamp(aim.x + b.off - b.x, -b.homing * dt, b.homing * dt);
    }
    let ent = null, at = Infinity;
    for (let k = 0; k < E.length; k++) {
      if (b.mate && (E[k].type === 'bricks' || E[k].type === 'gates')) continue; // 隊員只打方陣、路障、首領：磚同門留返畀隊長（收穫唔會因為多咗隊員而快咗）
      const d = hitDistance(E[k], b.x, E[k].type === 'phalanx' ? near : from, to, half);
      if (d >= 0 && d < at) { at = d; ent = E[k]; }
    }
    b.d = to;
    if (ent) { hit(state, ent, b, at); continue; }
    if (to <= (b.range ?? F.range)) B[kept++] = b;
  }
  B.length = kept;
}

/** 一粒子彈打中一樣嘢。打磚收一塊、打小敵人倒一隻；打門、路障、首領照每粒威力（shotDamage）計。 */
function hit(state, e, b, d) {
  // 隊員嘅刀氣：目標越近越重（1 以內 ×(1 + near)，5 以外冇加成）
  const dmg = Math.round((b.dmg ?? shotDamage(state.power)) * (b.near ? 1 + b.near * clamp(1 - (d - 1) / 4, 0, 1) : 1)), half = b.half ?? 0, look = b.w !== undefined ? WEAPONS[b.w].look : null;
  e.hit = 0.08; e.pop = 0.16;
  if (state.events.length < 48) state.events.push({ type: 'hit', on: e.type === 'phalanx' && e.elite ? 'elite' : e.type }); // 聲音用（一步太多就唔再報）
  if (look && look.hit === 'blast') fx(state, 'ring', b.x, d, 0.28, { color: look.glow, size: (half + 0.06) * 2.2 });
  if (state.burst?.t > 0 && e.type !== 'bricks') fx(state, 'ring', b.x, d, 0.2, { color: '255,214,102', size: 0.34 }); // 爆發期間：每下命中多一個金色圈（受特效上限管住）
  if (e.type === 'bricks') { fx(state, 'spark', b.x, d, 0.14, { color: COLUMN.bullets[Math.min(b.form, COLUMN.bullets.length - 1)].glow, on: 'bricks' }); takeBrick(state, e, b.x, d); return; }
  if (e.type === 'gates') {
    const i = gateIndexAt(e.gates.length, b.x), g = e.gates[i], [x0, x1] = gateSegment(e.gates.length, i), next = shootGate(g, Math.max(1, Math.round(dmg * (COLUMN.numbers.gateShare ?? 1) * INC())));
    g.op = next.op; g.val = next.val; g.hits++; g.hit = CROWD.gate.hitTime; g.pop = CROWD.gate.popTime;
    fx(state, 'spark', b.x, d, 0.14, { color: COLUMN.bullets[Math.min(b.form, COLUMN.bullets.length - 1)].glow, on: 'gates' });
    if (next.flipped) { g.flipT = CROWD.gate.flipTime; floatText(state, (x0 + x1) / 2, d + 0.25, CROWD_TEXT.flip, 'gain'); fx(state, 'ring', (x0 + x1) / 2, d, 0.5, { color: '70,235,170', size: 0.8 }, true); }
    return;
  }
  if (e.type === 'phalanx' && e.shield > 0) {
    // 盾兵：塊盾食晒呢一下（穿透都過唔到）；打爆先傷到後面
    e.shield -= dmg;
    fx(state, 'spark', b.x, d, 0.14, { color: '120,180,255', on: 'barrier' });
    if (e.shield <= 0) { e.shield = 0; fx(state, 'ring', e.x, d, 0.45, { color: '120,180,255', size: 1 }, true); floatText(state, e.x, d + 0.3, COLUMN_TEXT.shieldDown, 'gain'); state.events.push({ type: 'barrierBroken', lane: e.lane }); chargeBurst(state, COLUMN.burst.wall / 2); }
    return;
  }
  if (e.type === 'phalanx') {
    const P = COLUMN.phalanx, main = phalanxColFor(e, b.x, half), pierce = b.pierce ?? 1;
    let bounty = 0;
    // 倒一隻：呢行最前嗰隻。向後彈飛（橫向散開少少）
    const fell = (c) => {
      const r = e.front[c];
      if (r >= e.rows) return false;
      if (e.tough > 1 && ++e.wear[c] < e.tough) { fx(state, 'spark', e.x + phalanxColX(e.cols, c), e.d + r * P.gapD, 0.12, { color: '200,150,255', on: 'elite' }); return true; } // 精英：未夠數，淨係中咗一下
      if (e.tough > 1) e.wear[c] = 0;
      e.alive[r * e.cols + c] = 0; e.front[c]++; e.left--;
      state.kills++; bounty += e.bounty ?? 1; chargeBurst(state, COLUMN.burst.phalanx / e.total);
      fx(state, 'fell', e.x + phalanxColX(e.cols, c), e.d + r * P.gapD, 0.42, { vx: (((r * 7 + c * 13) % 9) - 4) * 0.09 });
      return true;
    };
    // 冚到嘅行（冇命中半闊就得對正嗰一行）：每行由最前數起倒 pierce 隻，但唔會倒到比命中嗰度遠過穿透距離嘅
    const cols = half > 0 ? phalanxColsFor(e, b.x, half) : [main];
    for (const c of cols) for (let k = 0; k < pierce; k++) { if (e.d + e.front[c] * P.gapD > d + pierce * P.gapD + 1e-6 || !fell(c)) break; }
    // 連鎖：再跳去隔離未冚到嘅行（由近到遠），每行倒最前一隻
    if (b.chain > 0) {
      const others = [];
      for (let c = 0; c < e.cols; c++) if (!cols.includes(c) && e.front[c] < e.rows) others.push(c);
      others.sort((p, q) => Math.abs(p - main) - Math.abs(q - main));
      const pts = [];
      for (const c of others.slice(0, b.chain)) { pts.push([e.x + phalanxColX(e.cols, c), e.d + e.front[c] * P.gapD]); fell(c); }
      if (pts.length) fx(state, 'zap', b.x, d, 0.16, { pts, w: b.w });
    }
    // 賞金（中檔）：每打低一隻小敵人加而家戰力嘅一個細百分比（最少 1）——清方陣嗰幾秒戰力都喺度爬，唔會停住
    const K = COLUMN.numbers.bounty;
    if (K > 0 && bounty > 0) {
      const gain = Math.max(bounty, Math.round(state.power * K * bounty * INC())); state.gained += gain; setPower(state, state.power + gain);
      // 畫面要睇得出係打低敵人先加：每塊方陣約每 0.4 秒將呢段時間嘅賞金合併做一個「+N」，喺方陣最前面飄出嚟
      e.bountyAcc = (e.bountyAcc ?? 0) + gain;
      if (state.t - (e.bountyT ?? -9) >= 0.4) { floatText(state, e.x, Math.max(0.4, d), `+${formatNumber(e.bountyAcc)}`, 'gain'); e.bountyAcc = 0; e.bountyT = state.t; }
    }
    return;
  }
  fx(state, 'spark', b.x, d, 0.14, { color: COLUMN.bullets[Math.min(b.form, COLUMN.bullets.length - 1)].glow, on: e.type }); // on = 打中乜（畫面按目標畫唔同嘅命中效果）
  e.hp -= dmg;
  if (e.hp > 0) return;
  e.dead = true;
  if (e.type === 'barrier') {
    fx(state, 'puff', e.x, e.d, 0.5, { color: '255,200,90', size: 0.24 }, true);
    fx(state, 'ring', e.x, e.d, 0.5, { color: '255,220,120', size: 0.9 }, true);
    floatText(state, e.x, e.d + 0.3, COLUMN_TEXT.broken, 'gain');
    state.shake = Math.max(state.shake, 0.2);
    state.events.push({ type: 'barrierBroken', lane: e.lane });
    chargeBurst(state, COLUMN.burst.wall);
  } else if (e.type === 'boss' && e.mini) {
    // 小首領打低：大獎
    const gain = Math.round(state.power * e.prize * INC());
    state.gained += gain; setPower(state, state.power + gain);
    fx(state, 'puff', e.x, e.d, 0.6, { color: '255,120,200', size: 0.35 }, true);
    fx(state, 'ring', e.x, e.d, 0.6, { color: '255,220,120', size: 1.4 }, true);
    floatText(state, e.x, e.d + 0.3, `${COLUMN_TEXT.miniDown} +${formatNumber(gain)}`, 'gain');
    state.shake = Math.max(state.shake, 0.3);
    state.events.push({ type: 'miniBossDown' });
  } else if (e.type === 'boss') win(state, e);
}

/** 收一塊磚（子彈打中或者主角掂到）：戰力加磚上面個數。 */
function takeBrick(state, e, x, d) {
  e.head++; e.pop = 0.16;
  state.events.push({ type: 'brick', prize: e.prize });
  chargeBurst(state, COLUMN.burst.brick / e.n);
  state.gained += e.val;
  if (e.prize || state.t - e.ft > 0.12) { e.ft = state.t; floatText(state, e.x, d + 0.15, `+${formatNumber(e.val)}`, 'gain'); }
  if (e.prize) fx(state, 'ring', e.x, d, 0.4, { color: '255,220,120', size: 0.6 }, true);
  setPower(state, state.power + e.val);
}

function win(state, boss) {
  if (state.stage.endless) return nextWave(state, boss);
  boss.dead = true;
  fx(state, 'puff', boss.x, boss.d, 0.7, { color: '255,120,200', size: 0.5 }, true);
  fx(state, 'ring', boss.x, boss.d, 0.7, { color: '255,255,255', size: 2 }, true);
  state.shake = 0.5; state.flash = 0.3;
  state.phase = 'clear'; state.hold = COLUMN.holdTime.clear;
  state.banner = { text: COLUMN_TEXT.clear, t: COLUMN.holdTime.clear, tone: 'gain' };
  state.events.push({ type: 'stageClear', stage: state.stageNo, power: state.power, form: state.form });
}

/** 無盡模式：打低一波嘅首領——即刻接下一波（照而家嘅實際戰力生成），唔完場。 */
function nextWave(state, boss) {
  boss.dead = true;
  fx(state, 'puff', boss.x, boss.d, 0.7, { color: '255,120,200', size: 0.5 }, true);
  fx(state, 'ring', boss.x, boss.d, 0.7, { color: '255,255,255', size: 2 }, true);
  state.shake = 0.4; state.flash = 0.2;
  state.wave++;
  state.banner = { text: COLUMN_TEXT.wave(state.wave), t: 1.6, tone: 'gain' };
  state.events.push({ type: 'waveClear', wave: state.wave - 1 });
  state.stage = endlessWave(state.wave, Math.max(1, state.power), state.dist + 6);
  state.next = 0; state.boss = null; state.bossSpawned = false; state.phase = 'run';
  state.repel = { guard: false, burst: false };
}

// ---------- 碰撞 ----------

function loseTo(state, n, x, d) {
  const loss = Math.min(n, state.power);
  if (loss <= 0) return 0;
  // 光盾（楯）：撐緊就擋走呢一次，之後 window 秒內嘅損失都唔計（一拃敵人撞埋嚟係好多下細損失，要成拃擋晒先似「擋下一次」）
  const g = state.guard;
  if (g && (g.up || g.t > 0)) {
    if (g.up) { g.up = false; g.t = g.cfg.window; g.cd = g.cfg.every; g.n++; g.flash = 0.5; state.events.push({ type: 'shieldBlock' }); floatText(state, state.x, 0.7, COLUMN_TEXT.guarded, 'gain'); fx(state, 'ring', state.x, 0.6, 0.5, { color: '120,180,255', size: 1.6 }, true); state.flash = Math.max(state.flash, 0.08); }
    g.saved += loss;
    return 0;
  }
  state.lost += loss;
  state.hurt = CROWD.feel.hurt.time;
  state.events.push({ type: 'hurt', loss });
  setPower(state, state.power - loss);
  return loss;
}

/**
 * 首領出招（第 7 關起）同兩階段（第 10 關）：
 *   入咗射程（engageD）之後每 every 秒出一招：揀主角而家嗰條線，預告 warn 秒（成條線閃紅），之後砸落去——主角仲喺嗰條線就扣當時戰力嘅 loss。
 *   兩階段：個數跌到一半，發狂一次——之後出招快一倍。
 */
function bossMoves(state, dt) {
  const b = state.boss;
  if (!b || b.dead || !b.slam || state.phase === 'clear' || state.phase === 'defeat' || b.d > COLUMN.boss.engageD) return;
  if (b.phases > 1 && b.phase === 1 && b.hp <= b.max / 2) {
    b.phase = 2; state.shake = Math.max(state.shake, 0.4); state.flash = Math.max(state.flash, 0.15);
    floatText(state, 0, Math.min(b.d, 6), COLUMN_TEXT.phase2, 'loss');
    state.events.push({ type: 'bossPhase', phase: 2 });
  }
  if (b.atk) {
    b.atk.t -= dt;
    if (b.atk.t <= 0) {
      if (laneAt(state.x) === b.atk.lane) {
        const take = Math.min(Math.floor(state.power * b.slam.loss), state.power - 1);
        if (take > 0 && loseTo(state, take)) floatText(state, state.x, 0.5, `−${formatNumber(take)}`, 'loss');
        state.shake = Math.max(state.shake, 0.4);
      }
      fx(state, 'ring', laneX(b.atk.lane), 0.2, 0.4, { color: '255,80,90', size: 1.2 }, true);
      state.events.push({ type: 'bossSlam', lane: b.atk.lane });
      b.atk = null;
    }
    return;
  }
  b.atkCd -= dt;
  if (b.atkCd <= 0) { b.atk = { lane: laneAt(state.x), t: b.slam.warn, warn: b.slam.warn }; b.atkCd = b.slam.every / (b.phase === 2 ? 2 : 1); state.events.push({ type: 'slamWarn', lane: b.atk.lane }); }
}

function contacts(state, dt = 0) {
  const R = squadRadius(state.members), B = COLUMN.bricks, P = COLUMN.phalanx;
  for (const e of state.ents) {
    if (e.dead || state.power <= 0) continue;
    if (e.type === 'bricks') {
      // 由最前嗰塊收起：去到主角面前、主角又喺呢條線就收；過咗頭都冇掂到就走咗
      while (e.head < e.n) {
        const d = e.d + e.head * e.gap;
        if (d > B.touchD) break;
        if (bricksOpen(e) && Math.abs(state.x - e.x) < B.halfWidth + R) takeBrick(state, e, e.x, Math.max(0, d));
        else if (d < B.missD) e.head++;
        else break;
      }
    } else if (e.type === 'gates') {
      if (e.used || e.d > 0) continue;
      e.used = true; e.picked = gateIndexAt(e.gates.length, state.x);
      const g = e.gates[e.picked], [x0, x1] = gateSegment(e.gates.length, e.picked), before = state.power;
      setPower(state, gateResult(before, g));
      state.events.push({ type: 'gate', op: g.op, good: state.power >= before });
      if (state.power > before) chargeBurst(state, COLUMN.burst.gate);
      floatText(state, (x0 + x1) / 2, 0.35, gateLabel(g), isGoodGate(g) ? 'gain' : 'loss');
      if (state.power > before) { state.flash = 0.12; fx(state, 'ring', state.x, 0, 0.45, { color: '70,235,170', size: 1 }, true); } else if (state.power < before) state.shake = Math.max(state.shake, 0.2);
    } else if (e.type === 'phalanx') {
      // 每一行由最前嗰隻睇起：掂到主角 → 戰力 −1；過咗頭都冇掂到 → 跑走咗（唔再計）
      let hits = 0;
      const bite = e.bite ?? 1, K = COLUMN.numbers.contact;
      if (K) { // 大數字版：每隻扣當時戰力嘅一個比例，同一塊方陣合共有上限——俾一大拃撞到會好傷，但唔會一下歸零
        for (let c = 0; c < e.cols; c++) {
          if (Math.abs(e.x + phalanxColX(e.cols, c) - state.x) >= R + P.r) { while (e.front[c] < e.rows && e.d + e.front[c] * P.gapD < P.passD) e.front[c]++; continue; }
          while (e.front[c] < e.rows && e.d + e.front[c] * P.gapD <= P.contactD) { e.alive[e.front[c] * e.cols + c] = 0; e.left--; e.front[c]++; hits++; }
        }
        if (hits) {
          e.biteCap ??= Math.floor(state.power * K.cap); e.bitten ??= 0;
          const want = Math.min(e.biteCap - e.bitten, hits * Math.max(1, Math.ceil(state.power * K.each)), state.power - 1);
          if (want > 0) {
            e.bitten += want;
            const loss = loseTo(state, want);
            state.shake = Math.max(state.shake, 0.15);
            if (loss && state.t - e.ft > 0.15) { e.ft = state.t; floatText(state, state.x, 0.45, `−${formatNumber(loss)}`, 'loss'); }
          }
          fx(state, 'puff', state.x, 0.05, 0.3, { color: P.color, size: 0.07 });
        }
        continue;
      }
      for (let c = 0; c < e.cols; c++) {
        const near = Math.abs(e.x + phalanxColX(e.cols, c) - state.x) < R + P.r;
        while (e.front[c] < e.rows && state.power - hits * bite > 0) {
          const r = e.front[c], d = e.d + r * P.gapD;
          if (d > P.contactD) break;
          if (near) { e.alive[r * e.cols + c] = 0; e.left--; hits++; e.front[c]++; }
          else if (d < P.passD) e.front[c]++;
          else break;
        }
      }
      if (hits) {
        const loss = loseTo(state, hits * bite);
        state.shake = Math.max(state.shake, 0.15);
        fx(state, 'puff', state.x, 0.05, 0.3, { color: P.color, size: 0.07 });
        if (loss && state.t - e.ft > 0.15) { e.ft = state.t; floatText(state, state.x, 0.45, `−${formatNumber(loss)}`, 'loss'); }
      }
    } else if (e.type === 'hazard') {
      // 危險地帶：主角喺呢條線、而且嗰段地面啱啱喺腳下 → 每秒扣當時戰力嘅 rate（最少留返 1）
      if (e.d > 0.05 || e.d + e.len < -0.05 || Math.abs(state.x - e.x) > 0.3) continue;
      e.acc = (e.acc ?? 0) + state.power * e.rate * dt;
      const take = Math.min(Math.floor(e.acc), state.power - 1);
      if (take > 0) { e.acc -= take; if (loseTo(state, take) && state.t - e.ft > 0.25) { e.ft = state.t; floatText(state, state.x, 0.45, `−${formatNumber(take)}`, 'loss'); } }
    } else if (e.type === 'slow' || e.type === 'boost') {
      if (e.d > 0.05 || e.d + e.len < -0.05 || Math.abs(state.x - e.x) > 0.3) continue;
      if (e.type === 'slow') { if (!(state.mud > 0)) state.events.push({ type: 'slowIn' }); state.mud = 0.2; }
      else if (!e.used) { e.used = true; state.rapid = MECH.boost.time; state.events.push({ type: 'boostIn' }); floatText(state, state.x, 0.6, COLUMN_TEXT.boost, 'gain'); fx(state, 'ring', state.x, 0, 0.45, { color: '255,214,102', size: 1.1 }, true); }
    } else if (e.type === 'boss' && e.mini) {
      if (e.d > COLUMN.boss.contactD) continue;
      // 小首領打唔低就撞到：扣剩低個數（最多扣三成戰力），佢就走咗
      const take = Math.min(Math.ceil(e.hp), Math.floor(state.power * 0.3));
      if (take > 0 && loseTo(state, take)) { floatText(state, state.x, 0.5, `−${formatNumber(take)}`, 'loss'); state.hurt = CROWD.feel.hurt.time; }
      state.shake = Math.max(state.shake, 0.3);
      e.dead = true;
    } else if (e.type === 'boss') {
      if (e.d > COLUMN.boss.contactD) continue;
      // 數字比拼：主角扣走首領剩低個數；仲有戰力就贏
      const left = Math.ceil(e.hp), after = bossClash(state.power, left);
      // 翻盤：輸梗嗰陣，撐緊嘅光盾可以頂住首領一次；爆發槽滿咗（留住未用）會自動放出嚟頂一次——首領彈返後，爭取多幾秒火力
      if (!(after > 0) && (COLUMN.numbers.campaign || COLUMN.numbers.endless)) { // 只限主線同無盡（舊嘅比較用數值唔郁）
        const g = state.guard, R = state.repel;
        if (g && g.up && !R.guard) { R.guard = true; g.up = false; g.cd = g.cfg.every; g.n++; g.flash = 0.5; e.d += COLUMN.boss.repel; state.events.push({ type: 'shieldBlock' }); floatText(state, state.x, 0.8, COLUMN_TEXT.repelGuard, 'gain'); fx(state, 'ring', state.x, 0.6, 0.5, { color: '120,180,255', size: 1.8 }, true); state.shake = Math.max(state.shake, 0.3); continue; }
        if (!R.burst && burstReady(state)) { R.burst = true; triggerBurst(state); e.d += COLUMN.boss.repel; floatText(state, state.x, 0.8, COLUMN_TEXT.repelBurst, 'gain'); fx(state, 'ring', state.x, 0.6, 0.5, { color: '255,214,102', size: 1.8 }, true); state.shake = Math.max(state.shake, 0.3); continue; }
      }
      floatText(state, state.x, 0.5, `−${formatNumber(Math.min(left, state.power))}`, 'loss');
      state.shake = Math.max(state.shake, 0.45); state.hurt = CROWD.feel.hurt.time;
      state.lost += state.power - after;
      setPower(state, after);
      if (after > 0) { e.hp = 0; win(state, e); }
    }
  }
}

/** 未打爆嘅路障去到主角面前：將主角推出呢條線（向主角嗰邊推；推出路面就改向另一邊）。唔扣戰力。 */
function pushOut(state) {
  const C = COLUMN.barrier, R = squadRadius(state.members), lim = sideLimit(state.members);
  for (const e of state.ents) {
    if (e.type !== 'barrier' || e.dead || e.d > C.pushD || e.d < C.pushPast) continue;
    const reach = C.halfWidth + R * 0.6;
    if (Math.abs(state.x - e.x) >= reach) continue;
    let dir = state.x >= e.x ? 1 : -1;
    if (Math.abs(e.x + dir * reach) > lim) dir = -dir;
    state.x = e.x + dir * reach;
    if ((state.targetX - state.x) * dir < 0) state.targetX = state.x; // 手指仲撳住呢條線：企喺線邊，唔好穿過去
    if (!e.pushed) {
      e.pushed = true;
      floatText(state, e.x, 0.4, COLUMN_TEXT.blocked, 'loss');
      state.shake = Math.max(state.shake, 0.25);
      state.events.push({ type: 'blocked', lane: e.lane });
    }
  }
}

// ---------- 每一步 ----------

export function updateColumn(state, dt) {
  const s = /** @type {any} */ (state), W = COLUMN.world, C = CROWD.control, FEEL = CROWD.feel, P = COLUMN.phalanx;
  s.events = [];
  // 進化慢動作：呢段時間世界行慢啲（真實時間照計）
  const real = dt;
  if (s.slow > 0) { s.slow = s.slow - real > 1e-9 ? s.slow - real : 0; dt *= FEEL.evolve.slowScale; }
  // 爆發技：撳咗 → 特寫（真實時間計，世界行慢）→ 爆發（遊戲時間計）→ 完
  const BU = COLUMN.burst, bu = s.burst;
  if (bu.go) { bu.go = false; s.events.push({ type: 'burstGo', form: s.form, full: bu.full, order: bu.order }); }
  if (bu.cut > 0) { bu.cut = bu.cut - real > 1e-9 ? bu.cut - real : 0; dt *= BU.slowScale; if (bu.cut <= 0) { bu.t = burstCfg(s).time; s.flash = Math.max(s.flash, 0.2); s.events.push({ type: 'burstStart' }); } }
  else if (bu.t > 0) { bu.t = bu.t - dt > 1e-9 ? bu.t - dt : 0; if (bu.t <= 0) s.events.push({ type: 'burstEnd' }); }
  s.t += dt;
  for (const f of s.fx) f.t += dt;
  s.fx = s.fx.filter((f) => f.t < f.life);
  s.pop.t = Math.max(0, s.pop.t - dt); s.flash = Math.max(0, s.flash - dt); s.shake = Math.max(0, s.shake - dt * 1.6);
  if (s.banner.delay > 0) s.banner.delay = Math.max(0, s.banner.delay - real); else s.banner.t = Math.max(0, s.banner.t - dt);
  s.recoil = Math.max(0, s.recoil - dt); s.hurt = Math.max(0, s.hurt - dt);
  s.evoT = Math.max(0, s.evoT - dt); s.muzzle = Math.max(0, s.muzzle - dt);

  // 輸咗 / 贏咗：結算畫面一直停喺度，等玩家撳先重開 / 入下一關（confirmResult）。hold 行完之前唔收撳，費事打緊嗰下手指誤撳。
  if (s.phase === 'defeat' || s.phase === 'clear') {
    bu.cut = 0; bu.t = 0;
    s.hold = Math.max(0, s.hold - real);
    s.banner.t = Math.max(s.banner.t, 1);
    return;
  }

  // 主角橫移：追手指，有最高速度
  setTarget(s, s.targetX + s.keyDir * C.keySpeed * dt);
  const before = s.x, want = (s.targetX - s.x) * (1 - Math.exp(-C.follow * dt));
  s.x += clamp(want, -C.maxSpeed * dt, C.maxSpeed * dt);
  // 引導停住個世界（state.freeze，見 meta/tutorial.js）：隊長照樣跟手指左右移，其餘嘢（捲動、敵人、開火、碰撞）全部唔行
  if (s.freeze) { s.vx = (s.x - before) / dt; [s.lean, s.leanV] = stepLean(s.lean, s.leanV, s.vx, dt); s.units[0].x = s.x; return; }

  // 世界向主角捲；方陣同首領自己再逼近，方陣近咗仲會橫向追住主角
  const v = W.scroll;
  s.dist += v * dt;
  for (const e of s.ents) {
    e.d -= v * dt;
    // 照實際戰力定數（中檔）：磚每塊 = 而家戰力嘅 pct（所以連續收磚係一路爬，唔會越收越唔值錢）；
    // 加減門個數喺入鏡嗰刻（liveGateD）照嗰陣戰力定一次，之後淨係射佢先會郁
    if (e.pct > 0) e.val = Math.max(1, Math.round(s.power * e.pct * INC()));
    else if (e.live && e.d <= COLUMN.gate.liveD) { e.live = false; for (const g of e.gates) if (g.frac > 0) { g.val = niceNumber(Math.max(1, s.power * g.frac * (g.op === 'add' ? INC() : 1))); g.val0 = g.val; } }
    // 倒數門：加數門個數入鏡之後每秒跌開頭嗰個數嘅 decay（跌到 0 為止；射佢照樣加）
    else if (e.type === 'gates' && !e.live && !e.used) for (const g of e.gates) if (g.decay > 0 && g.op === 'add' && g.val > 0) g.val = Math.max(0, g.val - (g.val0 ?? g.val) * g.decay * dt);
    if (e.hit > 0) e.hit -= dt;
    if (e.pop > 0) e.pop -= dt;
    if (e.type === 'phalanx') {
      e.d -= P.speed * dt;
      if (e.sway) e.x = e.x0 + Math.sin(s.t * e.sway.speed + e.sway.phase) * e.sway.amp; // 遊走方陣：左右擺，唔追主角
      else if (e.d < P.chargeD) e.x += clamp(s.x - e.x, -P.drift * dt, P.drift * dt);
    } else if (e.type === 'boss') e.d -= COLUMN.boss.speed * dt;
    else if (e.type === 'gates') for (const g of e.gates) { g.hit = Math.max(0, g.hit - dt); g.pop = Math.max(0, g.pop - dt); g.flipT = Math.max(0, g.flipT - dt); }
  }
  for (const f of s.fx) f.d -= v * dt;
  pushOut(s);
  // 動態：橫移速度 → 傾身（彈簧）
  s.vx = (s.x - before) / dt;
  [s.lean, s.leanV] = stepLean(s.lean, s.leanV, s.vx, dt);
  s.units[0].x = s.x;
  spawnDue(s);
  if (s.boss && !s.boss.dead && s.phase === 'run' && s.next >= s.stage.timeline.length && s.boss.d <= COLUMN.boss.engageD) { s.phase = 'boss'; s.events.push({ type: 'bossIn' }); }

  // 齊射
  s.cd -= dt;
  // 武器等級跟住戰力：升咗級出一個細橫額同一下閃光（唔停頓）；跌返落門檻就降級
  if (COLUMN.numbers.weapons) {
    // 一級一級升：戰力一下跳過幾個門檻，都係隔 weaponStep 秒升一級（每一級都見到，唔會跳級）；降級即刻跌到位
    const want = Math.max(weaponLevel(s.power), COLUMN.numbers.minWeapon ?? 0); // minWeapon：「武器熟練」升到某幾級，開局直接由第 2、3 級武器開始
    s.weaponT = Math.max(0, s.weaponT - dt);
    if (want < s.weapon) { if (!COLUMN.numbers.keep) { s.weapon = want; s.burstN = 0; } } // keep（十關版）：升咗就唔跌
    else if (want > s.weapon && s.weaponT <= 0 && !(s.evoT > 0)) { // 進化演出緊（約 1.4 秒）唔升武器：兩樣唔好撞埋同一刻
      const lv = s.weapon + 1;
      s.weapon = lv; s.burstN = 0; s.weaponT = COLUMN.numbers.weaponStep ?? 0;
      s.weaponUp = { level: lv, t: 1.4 }; fx(s, 'ring', s.x, 0, 0.35, { color: WEAPONS[lv].look.glow, size: 0.7 }, true); s.events.push({ type: 'weaponUp', level: lv });
    }
    if (s.weaponUp && (s.weaponUp.t -= dt) <= 0) s.weaponUp = null;
  }
  if (s.mud > 0) s.mud = Math.max(0, s.mud - dt);
  if (s.rapid > 0) s.rapid = Math.max(0, s.rapid - dt);
  const rate = (bu.t > 0 ? burstCfg(s).mul : 1) * (s.mud > 0 ? MECH.slow.rate : 1) * (s.rapid > 0 ? MECH.boost.rate : 1); // 爆發期間全隊射速加倍（完整爆發 2.5 倍）；減速帶、加速帶再乘
  if (s.cd <= 0) s.cd += fire(s) / rate;
  if (s.team.mates.length) stepTeam(s, dt, rate);
  stepBullets(s, dt);

  if (s.phase === 'run' || s.phase === 'boss') contacts(s, dt);
  bossMoves(s, dt);
  s.ents = s.ents.filter((e) => !e.dead && !gone(e));

  if (s.power <= 0 && s.phase !== 'clear') {
    s.phase = 'defeat'; s.hold = COLUMN.holdTime.defeat;
    s.banner = { text: COLUMN_TEXT.defeat, t: COLUMN.holdTime.defeat, tone: 'loss' };
    s.bullets = [];
    s.events.push({ type: 'defeat', stage: s.stageNo });
  }
}

/** 成樣嘢（連最尾嗰塊、最尾嗰排）都過咗畫面底：清走。 */
function gone(e) {
  const tail = e.type === 'bricks' ? (e.n - 1) * e.gap : e.type === 'phalanx' ? (e.rows - 1) * COLUMN.phalanx.gapD : e.type === 'hazard' || e.type === 'slow' || e.type === 'boost' ? e.len : 0;
  if (e.type === 'bricks' && e.head >= e.n) return true;
  if (e.type === 'phalanx' && e.left <= 0) return true;
  return e.d + tail < COLUMN.world.despawn;
}
