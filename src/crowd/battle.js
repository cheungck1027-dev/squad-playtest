// 俯視玩法：狀態同每一步嘅更新。而家係單人：主角一個，頭上嘅數字係「戰力」。只改狀態物件，唔掂畫布（畫法喺 render.js）。
// 固定步長、亂數有種子：同一串輸入一定得出同一個結果。
//
// 每一步嘅次序：隊伍橫移 → 世界向下捲、敵人逼近 → 出新嘢 → 開火 → 子彈飛同命中 →
//   碰撞（過門、敵人掂到扣戰力、撞箱）→ 首領出手 → 隊員各自跟位 → 判輸贏。

import { formatNumber } from '../core/format.js';
import { createRng } from '../core/rng.js';
import { CROWD, CROWD_TEXT, crowdStage } from '../data/crowd.js';
import { stepLean } from './feel.js';
import { applyGate, bulletDamage, canShootGate, evolutionLevel, formOf, gateIndexAt, gateLabel, gateSegment, isGoodGate, shootGate, slotOffset, squadRadius } from './rules.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/**
 * @typedef {Object} CrowdState
 * @property {'run' | 'boss' | 'defeat' | 'clear'} phase
 * @property {number} power     戰力（唯一嘅大數字）；0 = 輸
 * @property {number} members   隊員數目（而家固定 1；之後收集角色最多 squad.maxMembers）
 * @property {number} form      而家第幾個形態（0 = 未進化）
 * @property {number} x         隊伍中心橫向位置（−1 至 1）
 * @property {number} targetX   手指想隊伍去邊
 * @property {{ x: number, d: number, born: number, v: number }[]} units  畫面上嘅隊員（最多 squad.drawCap 個；第 0 個係主角）
 * @property {any[]} ents       場上嘅嘢：一排門（gates）、敵人（enemy）、數字箱（crate）、首領（boss）
 * @property {{ x: number, d: number }[]} bullets
 * @property {any[]} fx         純畫面特效
 */

/**
 * @param {{ stageNo?: number, seed?: number | string, startForm?: number }} [opts]
 *   startForm = 測試用：開場直接係第幾個形態（0 = 形態 I），戰力就係嗰個形態嘅門檻
 * @returns {CrowdState}
 */
export function createCrowdBattle(opts = {}) {
  const state = /** @type {any} */ ({
    mode: 'crowd', seed: opts.seed ?? 1, t: 0, events: [], banner: { text: '', t: 0, tone: 'info' },
    keyDir: 0, kills: 0, attempts: 0,
    startForm: Math.max(0, Math.min(Math.floor(opts.startForm ?? 0) || 0, CROWD.evolution.thresholds.length)),
  });
  enterStage(state, opts.stageNo ?? 1);
  return state;
}

/** 入一關（或者輸咗重打同一關）：全部歸零，由一個人開始。同一關每次嘅敵人位置都一樣。 */
export function enterStage(state, no) {
  state.stageNo = no;
  state.stage = crowdStage(no);
  state.rng = createRng(`${state.seed}:crowd:${no}`);
  state.phase = 'run';
  state.dist = 0; state.next = 0; state.hold = 0;
  // 平時由 startPower 開始；測試用嘅 startForm 就由嗰個形態嘅門檻開始
  state.power = state.startForm > 0 ? CROWD.evolution.thresholds[state.startForm - 1] : CROWD.squad.startPower; state.peak = state.power;
  state.members = Math.min(CROWD.squad.startMembers, CROWD.squad.maxMembers);
  state.x = 0; state.targetX = 0;
  state.units = []; state.ents = []; state.bullets = []; state.fx = [];
  state.cd = CROWD.fire.interval; state.rapid = 0; state.muzzle = 0;
  state.pop = { t: 0, tone: 'gain' }; state.flash = 0; state.shake = 0;
  state.form = evolutionLevel(state.power); state.formPeak = state.form; state.evoT = 0;
  state.boss = null; state.bossSpawned = false;
  // 動態（純手感）：橫移速度、傾身、橫移片淡入、後座、受擊、進化慢動作
  state.vx = 0; state.lean = 0; state.leanV = 0; state.strafe = 0; state.recoil = 0; state.hurt = 0; state.slow = 0;
  syncUnits(state);
}

/** 隊伍中心最遠去到邊：人越多隊伍越闊，要留返位，唔好成隊人企咗出路面。 */
export const sideLimit = (members) => 1 - Math.max(CROWD.control.edge, squadRadius(members) * CROWD.control.edgeBySize);

/** 手指 / 滑鼠：隊伍想去嘅橫向位置。 */
export function setTarget(state, x) {
  const lim = sideLimit(state.members);
  state.targetX = clamp(x, -lim, lim);
}

/** 鍵盤：−1 向左、1 向右、0 停。 */
export function setKeyDir(state, dir) { state.keyDir = dir; }

/** 關卡行咗幾多（0–1）：行到首領面前 = 1。 */
export function progress(state) {
  return clamp(state.dist / (state.stage.boss.at - CROWD.boss.stop), 0, 1);
}

// ---------- 特效（純畫面）----------

const fx = (state, k, x, d, life, extra) => { state.fx.push({ k, x, d, t: 0, life, ...extra }); };
const floatText = (state, x, d, text, tone) => fx(state, 'num', x, d, 0.8, { text, tone });

// ---------- 戰力、形態、隊員 ----------

/**
 * 改戰力：大數字跳一下；過門檻就進化（有演出），跌返落去就退化（evolution.devolve 關咗就唔退）。
 */
export function setPower(state, n) {
  const prev = state.power, E = CROWD.evolution;
  n = Math.max(0, Math.round(n));
  if (n === prev) return;
  state.power = n;
  if (n > state.peak) state.peak = n;
  state.pop = { t: CROWD.squad.numberPop, tone: n > prev ? 'gain' : 'loss' };
  const level = E.devolve ? evolutionLevel(n) : Math.max(state.form, evolutionLevel(n));
  if (level > state.form) {
    state.evoT = E.showTime; state.flash = Math.max(state.flash, 0.25);
    state.slow = CROWD.feel.evolve.slowTime; // 短暫慢動作；橫額等慢動作完先出
    state.banner = { text: CROWD_TEXT.evolve(formOf(level).name), t: CROWD.bannerTime, tone: 'evolve', color: formOf(level).color, delay: CROWD.feel.evolve.slowTime };
    fx(state, 'ring', state.x, 0, 0.7, { color: formOf(level).color ?? '255,255,255', size: 1.6 });
    fx(state, 'ring', state.x, 0, 0.45, { color: '255,255,255', size: 0.9 });
    state.events.push({ type: 'evolve', form: level });
  } else if (level < state.form && n > 0) {
    floatText(state, state.x, 0.55, CROWD_TEXT.devolve, 'loss');
    state.events.push({ type: 'devolve', form: level });
  }
  state.form = level;
  if (level > state.formPeak) state.formPeak = level;
}

/** 改隊員數目（之後收集角色用；而家固定 1）。新人由隊伍中心彈出嚟。 */
export function setMembers(state, n, at) {
  state.members = Math.max(1, Math.min(Math.round(n), CROWD.squad.maxMembers));
  syncUnits(state, at);
}

/** 畫面上嘅隊員數目跟返 members（最多 drawCap 個）。走嘅係最近出事位置嗰個。 */
function syncUnits(state, at) {
  const S = CROWD.squad, want = Math.min(state.members, S.drawCap), U = state.units;
  while (U.length < want) {
    const i = U.length, a = i * 1.7;
    U.push({ x: state.x + Math.cos(a) * 0.03, d: Math.sin(a) * 0.03, born: state.t, v: i % 3 });
  }
  while (U.length > want) {
    let k = U.length - 1;
    if (at && U.length > 1) {
      let best = Infinity;
      for (let i = 1; i < U.length; i++) {
        const q = (U[i].x - at.x) ** 2 + (U[i].d - at.d) ** 2;
        if (q < best) { best = q; k = i; }
      }
    }
    const [u] = U.splice(k, 1);
    fx(state, 'fall', u.x, u.d, 0.35);
  }
}

/** 隊員各自跟返自己個位：入面嘅跟得快、外面嘅慢少少（有拖尾），太近就互相推開。 */
function stepUnits(state, dt) {
  const S = CROWD.squad, U = state.units, n = U.length;
  for (let i = 0; i < n; i++) {
    const u = U[i], o = slotOffset(i);
    const rate = S.followNear + (S.followFar - S.followNear) * (i / Math.max(1, S.drawCap - 1));
    const k = 1 - Math.exp(-rate * dt);
    u.x += (state.x + o.x - u.x) * k;
    u.d += (o.d - u.d) * k;
  }
  const sep = S.separation, sep2 = sep * sep;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const a = U[i], b = U[j], dx = b.x - a.x, dd = b.d - a.d, q = dx * dx + dd * dd;
      if (q >= sep2 || q < 1e-9) continue;
      const dist = Math.sqrt(q), push = (sep - dist) / dist * 0.5;
      if (i > 0) { a.x -= dx * push; a.d -= dd * push; } // 主角唔俾人推走
      b.x += dx * push; b.d += dd * push;
    }
  }
  for (const u of U) u.x = clamp(u.x, -1.02, 1.02);
}

// ---------- 出嘢 ----------

function spawn(state, item) {
  const d = item.at - state.dist;
  if (item.type === 'gates') {
    state.ents.push({ type: 'gates', d, used: false, picked: -1, gates: item.gates.map((g) => ({ ...g, hits: 0, hit: 0, pop: 0, flipT: 0 })) });
  } else if (item.type === 'crate') {
    state.ents.push({ type: 'crate', x: item.x, d, hp: item.hp, max: item.hp, reward: item.reward, hit: 0 });
  } else if (item.type === 'swarm') {
    const rng = state.rng;
    for (let i = 0; i < item.n; i++) {
      const kind = i < (item.brutes ?? 0) ? 'brute' : 'grunt', E = CROWD.enemies[kind], hp = (item.hp ?? 1) * E.hpMul;
      state.ents.push({
        type: 'enemy', kind, hp, max: hp, r: E.r, hit: 0,
        x: clamp(item.x + rng.range(-item.width, item.width), -0.95, 0.95),
        d: d + rng.range(0, item.depth),
        wob: rng.range(0, 6.28),
      });
    }
  }
}

function spawnDue(state) {
  const W = CROWD.world, T = state.stage.timeline;
  while (state.next < T.length && T[state.next].at - state.dist <= W.spawnDistance) spawn(state, T[state.next++]);
  const B = state.stage.boss;
  if (!state.bossSpawned && B.at - state.dist <= W.spawnDistance) {
    state.bossSpawned = true;
    state.boss = { type: 'boss', x: 0, d: B.at - state.dist, hp: B.hp, max: B.hp, hitFor: B.hit, atk: CROWD.boss.attackEvery, warn: false, hit: 0 };
    state.ents.push(state.boss);
  }
}

// ---------- 射擊 ----------

function fire(state) {
  if (state.power <= 0) return;
  const form = formOf(state.form), n = form.streams, F = CROWD.fire;
  const dmg = bulletDamage(state.power);
  for (let i = 0; i < n; i++) {
    state.bullets.push({ x: state.x + (i - (n - 1) / 2) * F.streamGap, d: F.startD, dmg, pierce: form.pierce, form: state.form, seen: null });
  }
  state.muzzle = 0.06;
  state.recoil = CROWD.feel.recoil.time;
}

/** 呢粒子彈（橫向位置 x）打唔打得中呢樣嘢；門嘅話回傳打中邊一道。 */
function bulletTarget(e, x) {
  if (e.dead) return null;
  if (e.type === 'enemy') return Math.abs(x - e.x) <= e.r + 0.03 ? e : null;
  if (e.type === 'crate') return Math.abs(x - e.x) <= CROWD.crate.width / 2 ? e : null;
  if (e.type === 'boss') return Math.abs(x - e.x) <= CROWD.boss.halfWidth ? e : null;
  if (e.type === 'gates' && !e.used) {
    const g = e.gates[gateIndexAt(e.gates.length, x)];
    return canShootGate(g, e.d) ? g : null; // 乘除門、未入射程：子彈穿過
  }
  return null;
}

function stepBullets(state, dt) {
  const F = CROWD.fire;
  for (const b of state.bullets) {
    if (state.phase !== 'run' && state.phase !== 'boss') break;
    const from = b.d;
    b.d += F.speed * dt;
    let ent = null, target = null;
    for (const e of state.ents) {
      if (e.d > b.d || e.d < from - 0.2 || (ent && e.d >= ent.d) || b.seen?.includes(e)) continue;
      const t = bulletTarget(e, b.x);
      if (t) { ent = e; target = t; }
    }
    if (!ent) { if (b.d > F.range) b.gone = true; continue; }
    fx(state, 'spark', b.x, ent.d, 0.14, { color: formOf(b.form).color });
    // 穿透彈：打中敵人之後繼續飛（最多穿 pierce 隻）；門、箱、首領照樣擋住
    if (ent.type === 'enemy' && b.pierce > 0) { b.pierce--; (b.seen ??= []).push(ent); } else b.gone = true;
    if (ent.type === 'gates') hitGate(state, ent, target);
    else hitThing(state, ent, b.dmg);
  }
  state.bullets = state.bullets.filter((b) => !b.gone);
}

/** 一粒子彈打中一道加 / 減數門：數值 +1。 */
function hitGate(state, row, gate) {
  const G = CROWD.gate, i = row.gates.indexOf(gate), [x0, x1] = gateSegment(row.gates.length, i), cx = (x0 + x1) / 2;
  const next = shootGate(gate);
  gate.op = next.op; gate.val = next.val; gate.hits++;
  gate.hit = G.hitTime; gate.pop = G.popTime;
  if (next.flipped) { gate.flipT = G.flipTime; floatText(state, cx, row.d + 0.25, CROWD_TEXT.flip, 'gain'); fx(state, 'ring', cx, row.d, 0.5, { color: '70,235,170', size: 0.8 }); }
}

function hitThing(state, e, dmg) {
  e.hp -= dmg; e.hit = 0.08;
  if (e.hp > 0) return;
  e.dead = true;
  if (e.type === 'enemy') {
    state.kills++;
    fx(state, 'puff', e.x, e.d, 0.32, { color: CROWD.enemies[e.kind].color, size: e.r });
  } else if (e.type === 'crate') {
    fx(state, 'puff', e.x, e.d, 0.45, { color: '255,200,90', size: 0.2 });
    fx(state, 'ring', e.x, e.d, 0.45, { color: '255,220,120', size: 0.7 });
    if (e.reward.type === 'add') {
      floatText(state, e.x, e.d + 0.2, `+${formatNumber(e.reward.n)}`, 'gain');
      setPower(state, state.power + e.reward.n);
    } else {
      state.rapid = CROWD.crate.rapidTime;
      floatText(state, e.x, e.d + 0.2, CROWD_TEXT.rapid, 'gain');
    }
  } else if (e.type === 'boss') {
    fx(state, 'puff', e.x, e.d, 0.7, { color: '255,120,200', size: 0.5 });
    fx(state, 'ring', e.x, e.d, 0.7, { color: '255,255,255', size: 2 });
    state.shake = 0.5; state.flash = 0.3;
    state.phase = 'clear'; state.hold = CROWD.holdTime.clear;
    state.banner = { text: CROWD_TEXT.clear, t: CROWD.holdTime.clear, tone: 'gain' };
    state.events.push({ type: 'stageClear', stage: state.stageNo, power: state.power, form: state.form });
    for (const o of state.ents) if (o.type === 'enemy' && !o.dead) { o.dead = true; fx(state, 'puff', o.x, o.d, 0.3, { color: CROWD.enemies[o.kind].color, size: o.r }); }
  }
}

// ---------- 碰撞 ----------

function contacts(state) {
  const S = CROWD.squad;
  for (const e of state.ents) {
    if (e.dead || state.power <= 0) continue;
    const R = squadRadius(state.members);
    if (e.type === 'gates') {
      if (e.used || e.d > 0) continue;
      // 行到門線：隊伍中心對住邊道就過邊道
      e.used = true; e.picked = gateIndexAt(e.gates.length, state.x);
      const g = e.gates[e.picked], [x0, x1] = gateSegment(e.gates.length, e.picked), before = state.power;
      setPower(state, applyGate(before, g));
      floatText(state, (x0 + x1) / 2, 0.35, gateLabel(g), isGoodGate(g) ? 'gain' : 'loss');
      if (state.power > before) { state.flash = 0.12; fx(state, 'ring', state.x, 0, 0.45, { color: '70,235,170', size: 1 }); } else if (state.power < before) state.shake = Math.max(state.shake, 0.2);
    } else if (e.type === 'enemy') {
      // 掂到主角：扣戰力，扣佢剩低嘅血（向上取整）
      if (Math.hypot(e.x - state.x, e.d / S.depthSquash) >= R + e.r) continue;
      e.dead = true;
      const loss = Math.min(Math.ceil(e.hp), state.power);
      fx(state, 'puff', e.x, e.d, 0.3, { color: CROWD.enemies[e.kind].color, size: e.r });
      floatText(state, state.x, 0.45, `−${formatNumber(loss)}`, 'loss');
      state.shake = Math.max(state.shake, 0.15); state.hurt = CROWD.feel.hurt.time;
      setPower(state, state.power - loss);
    } else if (e.type === 'crate') {
      // 未射爆就撞上去：扣戰力嘅 crashLoss（最少 1），箱子冇咗
      if (e.d > R * S.depthSquash * 0.7 + 0.08 || e.d < -0.2 || Math.abs(e.x - state.x) >= CROWD.crate.width / 2 + R * 0.7) continue;
      e.dead = true;
      const loss = Math.min(state.power, Math.max(1, Math.ceil(state.power * CROWD.crate.crashLoss)));
      fx(state, 'puff', e.x, e.d, 0.4, { color: '255,120,90', size: 0.2 });
      floatText(state, e.x, e.d + 0.2, `−${formatNumber(loss)}`, 'loss');
      state.shake = Math.max(state.shake, 0.3); state.hurt = CROWD.feel.hurt.time;
      setPower(state, state.power - loss);
    }
  }
}

function stepBoss(state, dt) {
  const b = state.boss;
  if (!b || b.dead || state.phase !== 'boss') return;
  b.atk -= dt;
  b.warn = b.atk <= CROWD.boss.warnTime;
  if (b.atk > 0) return;
  b.atk = CROWD.boss.attackEvery;
  const loss = Math.min(b.hitFor, state.power);
  fx(state, 'ring', state.x, 0, 0.5, { color: '255,90,105', size: 1.4 });
  floatText(state, state.x, 0.5, `−${formatNumber(loss)}`, 'loss');
  state.shake = Math.max(state.shake, 0.45); state.hurt = CROWD.feel.hurt.time;
  setPower(state, state.power - loss);
}

// ---------- 每一步 ----------

/**
 * @param {CrowdState} state
 * @param {number} dt
 */
export function updateCrowd(state, dt) {
  const s = /** @type {any} */ (state), W = CROWD.world, C = CROWD.control, FEEL = CROWD.feel;
  s.events = [];
  // 進化慢動作：呢段時間世界行慢啲（真實時間照計）
  const real = dt;
  if (s.slow > 0) { s.slow = s.slow - real > 1e-9 ? s.slow - real : 0; dt *= FEEL.evolve.slowScale; }
  s.t += dt;
  for (const f of s.fx) f.t += dt;
  s.fx = s.fx.filter((f) => f.t < f.life);
  s.pop.t = Math.max(0, s.pop.t - dt); s.flash = Math.max(0, s.flash - dt); s.shake = Math.max(0, s.shake - dt * 1.6);
  if (s.banner.delay > 0) s.banner.delay = Math.max(0, s.banner.delay - real); else s.banner.t = Math.max(0, s.banner.t - dt);
  s.recoil = Math.max(0, s.recoil - dt); s.hurt = Math.max(0, s.hurt - dt);
  s.evoT = Math.max(0, s.evoT - dt); s.muzzle = Math.max(0, s.muzzle - dt);

  // 輸咗 / 贏咗：停一陣先重開 / 入下一關
  if (s.phase === 'defeat' || s.phase === 'clear') {
    stepUnits(s, dt);
    s.hold -= dt;
    if (s.hold <= 0) { if (s.phase === 'defeat') s.attempts++; enterStage(s, s.phase === 'clear' ? s.stageNo + 1 : s.stageNo); }
    return;
  }
  s.rapid = Math.max(0, s.rapid - dt);

  // 隊伍橫移：追手指，有最高速度
  setTarget(s, s.targetX + s.keyDir * C.keySpeed * dt); // 鍵盤移動；人數變咗都喺呢度重新限返喺路面入面
  const want = (s.targetX - s.x) * (1 - Math.exp(-C.follow * dt)), move = clamp(want, -C.maxSpeed * dt, C.maxSpeed * dt);
  s.x += move;
  // 動態：橫移速度 → 傾身（彈簧）同橫移片淡入淡出
  s.vx = move / dt;
  [s.lean, s.leanV] = stepLean(s.lean, s.leanV, s.vx, dt);
  const side = Math.abs(s.vx) > FEEL.strafe.speed ? Math.sign(s.vx) : 0;
  s.strafe += clamp(side - s.strafe, -dt / FEEL.strafe.fade, dt / FEEL.strafe.fade);

  // 世界向下捲（首領戰停低）；敵人自己再逼近，橫向慢慢對住隊伍
  const v = s.phase === 'run' ? W.scroll : 0;
  s.dist += v * dt;
  for (const e of s.ents) {
    e.d -= v * dt;
    if (e.hit > 0) e.hit -= dt;
    if (e.type === 'enemy') {
      const E = CROWD.enemies[e.kind];
      e.d -= E.speed * dt;
      if (e.d > 0) e.x += clamp(s.x - e.x, -E.homing * dt, E.homing * dt);
    } else if (e.type === 'gates') {
      for (const g of e.gates) { g.hit = Math.max(0, g.hit - dt); g.pop = Math.max(0, g.pop - dt); g.flipT = Math.max(0, g.flipT - dt); }
    }
  }
  for (const f of s.fx) f.d -= v * dt;
  if (s.boss && s.phase === 'run' && s.boss.d <= CROWD.boss.stop) { s.boss.d = CROWD.boss.stop; s.phase = 'boss'; }
  spawnDue(s);

  // 開火
  s.cd -= dt;
  if (s.cd <= 0) { fire(s); s.cd += CROWD.fire.interval * (s.rapid > 0 ? CROWD.fire.rapidMul : 1); }
  stepBullets(s, dt);

  if (s.phase === 'run' || s.phase === 'boss') { contacts(s); stepBoss(s, dt); }
  s.ents = s.ents.filter((e) => !e.dead && e.d > W.despawn);
  stepUnits(s, dt);

  if (s.power <= 0 && s.phase !== 'clear') {
    s.phase = 'defeat'; s.hold = CROWD.holdTime.defeat;
    s.banner = { text: CROWD_TEXT.defeat, t: CROWD.holdTime.defeat, tone: 'loss' };
    s.bullets = [];
    s.events.push({ type: 'defeat', stage: s.stageNo });
  }
}
