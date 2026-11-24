// 俯視玩法嘅純規則：只計數，唔掂狀態、唔掂畫布。數值喺 data/crowd.js。

import { formatNumber } from '../core/format.js';
import { CROWD } from '../data/crowd.js';

/** 戰力 power 嗰陣係第幾個形態（0 = 未進化）。 */
export const evolutionLevel = (power) => CROWD.evolution.thresholds.filter((t) => power >= t).length;

/** 第 level 個形態嘅設定（一輪幾多粒、穿唔穿透、主題色）。 */
export const formOf = (level) => CROWD.evolution.forms[Math.max(0, Math.min(level, CROWD.evolution.forms.length - 1))];

/** 每粒子彈扣幾多血：跟戰力升，但升得慢（開方）。 */
export const bulletDamage = (power) => CROWD.fire.damageBase * Math.max(1, power) ** CROWD.fire.damagePower;

/** 隊伍佔幾大（半徑）：隊員越多越大，去到畫面上限就唔再大。 */
export function squadRadius(members) {
  const S = CROWD.squad, n = Math.max(1, Math.min(members, S.drawCap));
  return S.baseRadius + S.spacing * Math.sqrt(n - 1);
}

/** 隊形：第 i 個人相對隊伍中心嘅位置（向日葵式螺旋，第 0 個喺正中）。 */
export function slotOffset(i) {
  const S = CROWD.squad, r = S.spacing * Math.sqrt(i), a = i * 2.39996323;
  return { x: r * Math.cos(a), d: r * Math.sin(a) * S.depthSquash };
}

/** 過門之後戰力係幾多。減到 0 為止；除數門最少留返 1。 */
export function applyGate(power, gate) {
  if (gate.op === 'add') return power + gate.val;
  if (gate.op === 'sub') return Math.max(0, power - gate.val);
  if (gate.op === 'mul') return Math.round(power * gate.val);
  return power > 0 ? Math.max(1, Math.floor(power / gate.val)) : 0;
}

/** 門對玩家係好係壞。 */
export const isGoodGate = (g) => g.op === 'add' || g.op === 'mul';

/** 門上面寫咩。 */
export const gateLabel = (g) => ({ add: '+', sub: '−', mul: '×', div: '÷' })[g.op] + (g.op === 'add' || g.op === 'sub' ? formatNumber(g.val) : g.val);

/** 一排 n 道門，第 i 道佔路面邊一段 [左, 右]。 */
export const gateSegment = (n, i) => [-1 + (2 * i) / n, -1 + (2 * (i + 1)) / n];

/** 一排 n 道門，橫向位置 x 對住第幾道。 */
export const gateIndexAt = (n, x) => Math.max(0, Math.min(n - 1, Math.floor(((x + 1) / 2) * n)));

/** 呢道門而家射唔射得郁：只有加 / 減數門、入咗射程。冇上限。 */
export function canShootGate(gate, d) {
  return (gate.op === 'add' || gate.op === 'sub') && d > 0 && d <= CROWD.gate.shootRange;
}

/** 一粒子彈打中：數值 +1。減數門減到 0 就變做加數門。 */
export function shootGate(gate, by = 1) {
  if (gate.op === 'add') return { op: 'add', val: gate.val + by, flipped: false };
  const val = gate.val - by;
  return val <= 0 ? { op: 'add', val: 0, flipped: true } : { op: 'sub', val, flipped: false };
}
