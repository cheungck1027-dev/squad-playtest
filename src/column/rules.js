// 「三線長列」玩法嘅純規則：只計數，唔掂狀態、唔掂畫布。數值喺 data/column.js。
// 進化門檻、門嘅加減乘除照用 crowd/rules.js。

import { armOf, weaponRate } from '../data/weapons.js';
import { applyGate } from '../crowd/rules.js';
import { COLUMN } from '../data/column.js';

/**
 * 一次齊射幾多粒。
 *   舊數值：floor(√戰力)，最少 1、最多 fire.cap
 *   大數字：睇而家嗰級武器（data/weapons.js），最多一排
 */
export function salvoCount(power) {
  if (!(power > 0)) return 0;
  if (COLUMN.numbers.weapons) return armOf(power).count;
  return Math.max(1, Math.min(COLUMN.fire.cap, Math.floor(Math.sqrt(power))));
}

/**
 * 每粒子彈（每道光束每一下）嘅威力：打路障、首領扣幾多；打加減門個數字郁幾多。打小敵人唔睇威力（睇武器嘅覆蓋同穿透）；磚照磚上面個數。
 *   舊數值：固定 1
 *   大數字：每秒合共威力 = 戰力 ÷ 4 × 武器嘅 out，平均分落每秒射出嘅每一粒度：max(1, floor(戰力 × out ÷ (4 × 每秒輪數 × 每輪粒數)))
 */
export function shotDamage(power) {
  if (!COLUMN.numbers.weapons || !(power > 0)) return 1;
  const a = armOf(power);
  return Math.max(1, Math.floor(power * a.weapon.out / (4 * weaponRate(a.weapon) * a.count)));
}

/**
 * 行過一道門之後戰力變幾多。大數字版：減數門、除數門一道最多扣走當時戰力嘅 gateLoss（一半）——行錯一道門會好傷，但唔會即刻輸。
 */
export function gateResult(power, gate) {
  const after = applyGate(power, gate), cap = COLUMN.numbers.gateLoss ?? 1;
  return after < power && cap < 1 ? Math.max(after, power - Math.floor(power * cap)) : after;
}

/** 一粒命中半闊 half 嘅子彈，打方陣一次過冚到幾多行。 */
export const coverCols = (half) => Math.max(1, 1 + 2 * Math.floor((COLUMN.phalanx.r + COLUMN.fire.hitR + half) / COLUMN.phalanx.gapX + 1e-9));

/** 呢個戰力每秒大約清到幾多隻小敵人（對正方陣、粒粒都中）。自動試玩同測試用嚟估時間。 */
export function killRate(power) {
  if (!(power > 0)) return 0;
  if (!COLUMN.numbers.weapons) return salvoCount(power) / COLUMN.fire.interval;
  const a = armOf(power);
  return weaponRate(a.weapon) * a.count * (coverCols(a.weapon.half) * a.pierce + a.chain);
}

/**
 * 齊射排法：n 粒子彈各自相對主角嘅位置。一排最多 perRow 粒、橫向隔 gapX；多過一排向後疊。
 * @returns {{ x: number, d: number }[]}  x = 橫向偏移；d = 向後幾多（0 = 最前嗰排）
 */
export function salvoLayout(n) {
  const F = COLUMN.fire, out = [];
  for (let i = 0; i < n; i++) {
    const row = Math.floor(i / F.perRow), inRow = Math.min(F.perRow, n - row * F.perRow), k = i - row * F.perRow;
    out.push({ x: (k - (inRow - 1) / 2) * F.gapX, d: row * F.rowGap });
  }
  return out;
}

/** 齊射有幾闊（最左至最右）。 */
export const salvoWidth = (n) => (Math.min(n, COLUMN.fire.perRow) - 1) * COLUMN.fire.gapX;

/** 第 i 條線（0 左、1 中、2 右）嘅中心 x。 */
export const laneX = (i) => COLUMN.lanes[i];

/** 橫向位置 x 喺第幾條線。 */
export const laneAt = (x) => Math.max(0, Math.min(COLUMN.lanes.length - 1, Math.floor(((x + 1) / 2) * COLUMN.lanes.length)));

/** 方陣第 c 行（橫向）相對方陣中心嘅 x。 */
export const phalanxColX = (cols, c) => (c - (cols - 1) / 2) * COLUMN.phalanx.gapX;

/** 橫向偏移 dx（相對方陣中心）對住方陣第幾行；唔喺方陣範圍就 −1。 */
export function phalanxColAt(cols, dx) {
  const c = Math.round(dx / COLUMN.phalanx.gapX + (cols - 1) / 2);
  return c >= 0 && c < cols ? c : -1;
}

/**
 * 一粒子彈（橫向位置 x）會打中方陣邊一行；打唔中任何一行就 −1。
 * 橫向離嗰行中心 phalanx.r + fire.hitR 以內先算；已經清晒嘅行唔計（子彈穿過去）。
 * 夾喺兩行中間、兩行都掂到：打最前嗰隻近主角啲嗰行，一樣近就打橫向近啲嗰行。
 * （2026-11-23 之前係將 x 四捨五入去最近嗰行。9 行方陣對住 8 粒一排嘅齊射，粒粒子彈都啱啱喺兩行正中間，
 *   四捨五入加上小數誤差，令到有一兩行永遠冇子彈揀中，成行行到主角身上。）
 * @param {{ x: number, cols: number, rows: number, front: ArrayLike<number> }} e
 */
export function phalanxColFor(e, x, half = 0) {
  const P = COLUMN.phalanx, f = (x - e.x) / P.gapX + (e.cols - 1) / 2, reach = (P.r + COLUMN.fire.hitR + half) / P.gapX;
  let best = -1, bestFront = Infinity, bestOff = Infinity;
  for (let c = Math.max(0, Math.ceil(f - reach)); c <= Math.min(e.cols - 1, Math.floor(f + reach)); c++) {
    const front = e.front[c], off = Math.abs(c - f);
    if (front >= e.rows) continue;
    if (front < bestFront || (front === bestFront && off < bestOff - 1e-9)) { best = c; bestFront = front; bestOff = off; }
  }
  return best;
}

/** 命中半闊 half 嘅子彈（橫向位置 x）冚到方陣邊幾行（仲有敵人嘅先計），由左至右。 */
export function phalanxColsFor(e, x, half = 0) {
  const P = COLUMN.phalanx, f = (x - e.x) / P.gapX + (e.cols - 1) / 2, reach = (P.r + COLUMN.fire.hitR + half) / P.gapX, out = [];
  for (let c = Math.max(0, Math.ceil(f - reach)); c <= Math.min(e.cols - 1, Math.floor(f + reach)); c++) if (e.front[c] < e.rows) out.push(c);
  return out;
}

/** 呢道門而家射唔射得郁：只有加 / 減數門、入咗射程。 */
export const canShootGate = (gate, d) => (gate.op === 'add' || gate.op === 'sub') && d > 0 && d <= COLUMN.gate.shootRange;

/** 首領掂到主角嘅數字比拼：主角扣走首領剩低個數。回傳主角剩低幾多戰力（0 = 輸）。 */
export const bossClash = (power, bossLeft) => Math.max(0, power - Math.max(0, Math.ceil(bossLeft)));
