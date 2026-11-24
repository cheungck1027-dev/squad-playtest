// 戰鬥規則：全部係純函數，只做數字運算，唔掂畫布、唔掂狀態物件、唔用亂數
//（需要隨機嘅地方由外面傳一個 0–1 嘅 roll 入嚟）。測試直接叫呢度。

import { GATE_OPS } from '../data/gates.js';
import { TUNING } from '../data/tuning.js';

/** @typedef {import('../data/gates.js').Gate} Gate */
/** @typedef {import('../data/gates.js').GateRule} GateRule */

/** 攻擊力（程式入面叫 power）一定係整數，最低 0；跌到 0 就輸（見 isDefeatedPlayer）。 */
export function clampPower(power) {
  return Math.max(0, Math.round(power));
}

const tidy = (n) => Math.round(n * 1e4) / 1e4; // 清走 2.2000000000000004 呢類浮點尾數

/**
 * 每種門規則點樣改一道門。g = { op, val, costScale }，直接改 g。
 * 唔影響門運算嘅規則類型（例如 overdriveExtend）唔使喺度登記。
 * @type {Record<string, (g: { op: string, val: number, costScale: number }, rule: GateRule) => void>}
 */
export const GATE_RULE_EFFECTS = {
  mulGateBonus: (g, rule) => { if (g.op === 'mul') g.val = tidy(g.val + rule.value); },
  addGateBonus: (g, rule) => { if (g.op === 'add') g.val = Math.round(g.val * (1 + rule.value)); },
  subGateCostScale: (g, rule) => { if (g.op === 'sub') g.val = Math.max(1, Math.round(g.val * rule.value)); },
  divGateCostScale: (g, rule) => { if (g.op === 'div') g.costScale *= rule.value; },
};

/**
 * 套用晒門規則之後，呢道門實際係乜（未計 OVERDRIVE）。
 * costScale 只對除數門有用：損失嘅 POWER 乘呢個數。
 * @param {Gate} gate
 * @param {readonly GateRule[]} [gateRules]
 * @returns {{ op: Gate['op'], val: number, costScale: number }}
 */
export function effectiveGate(gate, gateRules = []) {
  const g = { op: gate.op, val: gate.val, costScale: 1 };
  for (const rule of gateRules) GATE_RULE_EFFECTS[rule?.type]?.(g, rule);
  return g;
}

/**
 * 門上面顯示嘅字，顯示嘅係套用規則之後嘅實際數值（例如 ×2 喺隼帶隊時顯示 ×2.2）。
 * @param {Gate} gate
 * @param {readonly GateRule[]} [gateRules]
 */
export function gateLabel(gate, gateRules = []) {
  const g = effectiveGate(gate, gateRules);
  const shown = g.op === 'add' || g.op === 'sub' ? Math.round(g.val) : +g.val.toFixed(2);
  return GATE_OPS[g.op].symbol + String(shown);
}

/** 呢道門對玩家係咪好事（畫綠色定紅色）。 */
export function isGoodGate(gate) {
  return GATE_OPS[gate.op].good;
}

/**
 * 通過一道門之後嘅 POWER。
 * OVERDRIVE 期間，加數門同乘數門嘅效果乘 gateBoost（預設 +50%）；減、除唔受影響。
 * @param {number} power
 * @param {Gate} gate
 * @param {{ overdrive?: boolean, gateRules?: readonly GateRule[], gateBoost?: number }} [ctx]
 * @returns {number}
 */
export function applyGate(power, gate, ctx = {}) {
  const { overdrive = false, gateRules = [], gateBoost = TUNING.overdrive.gateBoost } = ctx;
  const g = effectiveGate(gate, gateRules);
  const k = overdrive ? gateBoost : 1;
  switch (g.op) {
    case 'add': return clampPower(power + Math.round(g.val * k));
    case 'mul': return clampPower(power * (1 + (g.val - 1) * k));
    case 'sub': return clampPower(power - Math.round(g.val));
    case 'div': {
      // 除數門唔會除到 0：最少剩 1（輸只會係俾減數門或者敵人扣晒）
      const loss = power - Math.max(Math.min(1, power), Math.floor(power / g.val));
      return clampPower(power - Math.round(loss * g.costScale));
    }
    default: throw new Error(`未知門運算：${g.op}`);
  }
}

/** 呢道門射唔射得郁：只有加數門同減數門會俾子彈改變；乘數門同除數門子彈直接穿過。 */
export function isShootableGate(gate) {
  return gate.op === 'add' || gate.op === 'sub';
}

/**
 * 一粒子彈打中一道門：加數門 +1；減數門 −1，去到 0 就變做加數門（+0，之後再中就 +1、+2…）；乘 / 除數門原封不動。
 * 純運算，回傳新嘅門（唔改傳入嚟嗰個）。數值一定係整數，同攻擊力、火力級數無關。
 * @param {{ op: Gate['op'], val: number }} gate
 * @returns {{ op: Gate['op'], val: number, flipped: boolean }}  flipped = 呢一粒令減數門變咗做加數門
 */
export function shootGate(gate) {
  let { op, val } = gate, flipped = false;
  if (op === 'add') val += 1;
  else if (op === 'sub') {
    val -= 1;
    if (val <= 0) { op = 'add'; val = 0; flipped = true; }
  }
  return { op, val, flipped };
}

/**
 * 小隊嘅撞擊損失倍率：將所有隊員風格嘅 contactLossScale 乘埋（冇就係 1）。
 * @param {readonly ({ contactLossScale?: number } | undefined)[]} [passives]
 */
export function contactLossScale(passives = []) {
  let k = 1;
  for (const p of passives) if (p?.contactLossScale !== undefined) k *= p.contactLossScale;
  return k;
}

/** 俾敵人行到身邊會扣幾多攻擊力：佢頭上剩低嘅數字（向上取整，即係畫面見到嗰個數）× 損失倍率。 */
export function contactLoss(enemyHp, lossScale = 1) {
  return Math.round(Math.ceil(Math.max(0, enemyHp - 1e-9)) * lossScale);
}

/** 俾敵人撞到之後嘅 POWER。 */
export function applyContact(power, enemyHp, lossScale = 1) {
  return clampPower(power - contactLoss(enemyHp, lossScale));
}

/** 攻擊力跌到 0 = 失敗。 */
export function isDefeatedPlayer(power) {
  return power <= 0;
}

/**
 * 而家係第幾級火力（0 起計）：攻擊力過咗邊一級嘅門檻。
 * @param {number} power
 * @param {readonly { at: number }[]} [tiers]
 */
export function fireTier(power, tiers = TUNING.firepower.tiers) {
  let level = 0;
  for (let i = 0; i < tiers.length; i++) if (power >= tiers[i].at) level = i;
  return level;
}

/**
 * 攻擊力夠唔夠去到第幾個進化形態（0 = 未進化）。
 * @param {number} power
 * @param {readonly number[]} [thresholds]
 */
export function evolutionLevel(power, thresholds = TUNING.evolution.thresholds) {
  let level = 0;
  for (const at of thresholds) if (power >= at) level++;
  return level;
}

/**
 * 一輪射擊嘅總傷害 = 攻擊力 × 武器倍率 × 浮動（隊長會平均分落呢輪每粒子彈）。可以係小數（敵人頭上嘅數字顯示嗰陣向上取整）。
 * @param {number} power
 * @param {{ damage: number, overDamage: number, spread: [number, number] }} weapon
 * @param {boolean} overdrive
 * @param {number} roll  0–1，決定傷害浮動
 */
export function shotDamage(power, weapon, overdrive, roll) {
  const [lo, hi] = weapon.spread;
  const base = overdrive ? weapon.overDamage : weapon.damage;
  return Math.max(0, power * base * (lo + (hi - lo) * roll));
}

/**
 * 一下攻擊（斬、撞、浮游砲）嘅傷害 = POWER × share × 浮動倍率，最少 1。
 * @param {number} power
 * @param {number} share
 * @param {[number, number]} [spread]
 * @param {number} [roll]  0–1
 */
export function strikeDamage(power, share, spread = [1, 1], roll = 0.5) {
  const [lo, hi] = spread;
  return Math.max(1, Math.round(power * share * (lo + (hi - lo) * roll)));
}

/** 術式：HP 除 divisor，向上取整，最少 1（唔會直接除死）。 */
export function divideHp(hp, divisor) {
  return Math.max(1, Math.ceil(hp / divisor));
}

/** 撞退：距離加 push，最遠去到 maxDistance。 */
export function pushedDistance(d, push, maxDistance) {
  return Math.min(maxDistance, d + Math.max(0, push));
}

/** 呢一步有冇越過 lineD 呢條線（由遠行到近）。 */
export function crossedLine(prevD, d, lineD) {
  return prevD > lineD && d <= lineD;
}

// ---------- 搵目標（傳入嘅敵人只需要有 lane、d、boss） ----------

const ALL_LANES = [-1, 0, 1];

/** lane 同佢左右 reach 條車道以內嘅車道。 */
export function lanesWithin(lane, reach) {
  return ALL_LANES.filter((l) => Math.abs(l - lane) <= reach);
}

/** 小隊唔喺度嘅另外兩條車道。 */
export function otherLanes(lane) {
  return ALL_LANES.filter((l) => l !== lane);
}

/**
 * 每條指定車道入面、range 以內最前（最近）嗰隻敵人。首領佔晒成條路，喺範圍內就一定計，只計一次。
 * @template {{ lane: number, d: number, boss?: boolean }} T
 * @param {readonly T[]} enemies
 * @param {readonly number[]} lanes
 * @param {number} range
 * @returns {T[]}
 */
export function frontTargets(enemies, lanes, range) {
  /** @type {Map<number | 'boss', T>} */
  const best = new Map();
  for (const e of enemies) {
    if (e.d > range) continue;
    const key = e.boss ? 'boss' : e.lane;
    if (!e.boss && !lanes.includes(e.lane)) continue;
    const cur = best.get(key);
    if (!cur || e.d < cur.d) best.set(key, e);
  }
  return [...best.values()].sort((a, b) => a.d - b.d);
}

/**
 * 指定車道入面最近嗰隻；首領唔理車道都計。可以再限距離。
 * @template {{ lane: number, d: number, boss?: boolean }} T
 * @param {readonly T[]} enemies
 * @param {readonly number[]} lanes
 * @param {number} [range]
 * @returns {T | null}
 */
export function nearestInLanes(enemies, lanes, range = Infinity) {
  let best = null;
  for (const e of enemies) {
    if (e.d > range || !(e.boss || lanes.includes(e.lane))) continue;
    if (!best || e.d < best.d) best = e;
  }
  return best;
}

/** 指定車道入面所有敵人（首領都計），由近到遠。貫穿射擊用。 */
export function allInLanes(enemies, lanes) {
  return enemies.filter((e) => e.boss || lanes.includes(e.lane)).sort((a, b) => a.d - b.d);
}

/** @param {{ hp: number }} target */
export function isDefeated(target) {
  return target.hp <= 0;
}

// ---------- SYNC 同 OVERDRIVE ----------

/** SYNC 加 amount，上限 1。 */
export function gainSync(sync, amount) {
  return Math.min(1, sync + amount);
}

/**
 * OVERDRIVE 維持幾耐：基本時間 + 所有 overdriveExtend 規則。
 * @param {readonly GateRule[]} [gateRules]
 * @param {number} [base]
 */
export function overdriveDuration(gateRules = [], base = TUNING.overdrive.duration) {
  let total = base;
  for (const rule of gateRules) if (rule?.type === 'overdriveExtend') total += rule.value;
  return total;
}

/** SYNC 滿咗而且未喺 OVERDRIVE 入面，先可以發動。 */
export function canOverdrive(sync, over) {
  return sync >= 1 && over <= 0;
}

/**
 * 嘗試發動 OVERDRIVE。成功就清空 SYNC、開始倒數。
 * @param {{ sync: number, over: number }} s
 * @param {number} duration
 * @returns {{ sync: number, over: number, started: boolean }}
 */
export function startOverdrive(s, duration) {
  if (!canOverdrive(s.sync, s.over)) return { sync: s.sync, over: s.over, started: false };
  return { sync: 0, over: duration, started: true };
}

/** OVERDRIVE 倒數。 */
export function tickOverdrive(over, dt) {
  return Math.max(0, over - dt);
}

// ---------- 飛行 ----------

/**
 * 飛行狀態（狀態物件入面嘅 flight）。
 * @typedef {Object} FlightState
 * @property {number} time   飛行核心剩低幾耐（秒）；0 = 冇
 * @property {number} max    今次飛行核心總長（畫計量條用）
 * @property {boolean} on    而家應唔應該喺空中（飛行核心生效緊，或者超載緊）
 * @property {number} air    離地程度 0–1：0 = 喺地面跑，1 = 完全升起（起飛 / 落地期間喺中間）
 * @property {number} nextCore  距離下一粒飛行核心出現仲有幾耐（秒）
 */

/**
 * 行一步飛行狀態：核心倒數；有核心或者超載緊就起飛，兩樣都冇就落地。
 * @param {FlightState} flight
 * @param {number} dt
 * @param {boolean} overdrive
 * @param {number} [liftTime]
 * @returns {{ time: number, on: boolean, air: number }}
 */
export function tickFlight(flight, dt, overdrive, liftTime = TUNING.flight.liftTime) {
  const time = Math.max(0, flight.time - dt);
  const on = time > 0 || overdrive;
  const air = Math.max(0, Math.min(1, flight.air + (on ? dt : -dt) / liftTime));
  return { time, on, air };
}

/** 執到飛行核心：飛行時間補滿（已經飛緊就重新計，唔會疊加）。 */
export function collectFlightCore(flight, duration = TUNING.flight.duration) {
  return { time: Math.max(flight.time, duration), max: duration };
}

/** 隊長而家係咪喺空中（撞唔到地面敵人）：要飛就即刻當係；落地落到一半先當返喺地面。 */
export function isAirborne(flight) {
  return flight.on || flight.air > 0.5;
}

/** 呢隻敵人撞唔撞得到隊長：喺空中嗰陣，行地面嘅敵人撞唔到。 */
export function contactApplies(enemyDef, airborne) {
  return !(airborne && enemyDef.ground === true);
}

/**
 * 槍嘅開火間隔（秒）。
 * @param {{ interval: number, overInterval: number }} weapon
 * @param {boolean} overdrive
 * @param {number} [rateMul]  射速倍率（飛行核心生效期間隊長有加成）
 */
export function fireInterval(weapon, overdrive, rateMul = 1) {
  return (overdrive ? weapon.overInterval : weapon.interval) / rateMul;
}

/** 飛行核心生效期間，隊長嘅射速倍率；其他情況係 1。 */
export function flightFireRate(flight, isLeader, mul = TUNING.flight.fireRateMul) {
  return isLeader && flight.time > 0 ? mul : 1;
}
