// 主角嘅「動態」入面純計算嗰部分：傾身嘅彈簧、腳落地嘅時機。唔掂狀態、唔掂畫布。數值喺 data/crowd.js 嘅 feel。

import { CROWD } from '../data/crowd.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/**
 * 傾身行一步：橫移越快傾得越多（有上限）；用彈簧追，所以放手之後會過少少頭再彈返正。
 * @param {number} lean  而家傾幾多（弧度，正數 = 向右）
 * @param {number} vel   傾緊嘅速度
 * @param {number} vx    主角橫移速度（單位／秒）
 * @returns {[number, number]} 新嘅 [lean, vel]
 */
export function stepLean(lean, vel, vx, dt) {
  const L = CROWD.feel.lean, target = clamp(vx * L.perSpeed, -L.max, L.max);
  vel += ((target - lean) * L.stiffness - vel * L.damping) * dt;
  return [lean + vel * dt, vel];
}

/**
 * 由上一格播到呢一格，中間邊隻腳落咗地。
 * @param {number} prev   上次見到第幾格（−1 = 未見過）
 * @param {number} now    而家第幾格
 * @param {number} total  條片有幾多格（循環）
 * @param {{ left: number[], right: number[] }} contacts  落地格
 * @returns {('left' | 'right')[]}
 */
export function contactsBetween(prev, now, total, contacts) {
  if (prev < 0 || prev === now || !contacts) return [];
  const span = ((now - prev) % total + total) % total;
  if (span > total / 2) return []; // 跳咗位（重新載入、拖時間軸）：唔當係行咗咁多步
  const out = [];
  for (const side of /** @type {const} */ (['left', 'right'])) {
    for (const f of contacts[side] ?? []) {
      const ahead = ((f - prev) % total + total) % total;
      if (ahead > 0 && ahead <= span) out.push(side);
    }
  }
  return out;
}

/**
 * 呢一格離最近一次落地有幾遠：0 = 啱啱落地，1 = 兩步中間（身體最高）。影子用嚟縮放。
 * @param {number} frame
 * @param {number} total
 * @param {{ left: number[], right: number[] }} contacts
 */
export function airPhase(frame, total, contacts) {
  const all = [...(contacts?.left ?? []), ...(contacts?.right ?? [])].sort((a, b) => a - b);
  if (all.length < 2) return 0;
  let best = 1;
  for (let i = 0; i < all.length; i++) {
    const a = all[i], gap = ((all[(i + 1) % all.length] - a) % total + total) % total || total;
    const into = ((frame - a) % total + total) % total;
    if (into <= gap) best = Math.min(best, 1 - Math.abs(into / gap * 2 - 1));
  }
  return clamp(best, 0, 1);
}
