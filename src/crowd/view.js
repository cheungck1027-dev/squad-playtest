// 俯視鏡頭嘅換算：世界位置（x、d）→ 畫面像素。高角度、透視好弱。純計算。
// view = { W, H }（畫面闊高，像素）。數值喺 data/crowd.js 嘅 view。

import { CROWD } from '../data/crowd.js';

const V = CROWD.view;

/** 距離 d 嘅嘢畫幾大（隊伍嗰條線 = 1；越遠越細，但細得好少）。 */
export const scaleAt = (d) => (d > 0 ? 1 / (1 + V.perspective * d) : 1);

/** 半條路喺畫面佔幾多像素（隊伍嗰條線）。亦係一個世界單位嘅像素。 */
export const unitPx = (view) => view.W * V.roadHalf;

/** 世界位置 → 畫面位置同縮放。 */
export function project(view, x, d) {
  const s = scaleAt(d), px = unitPx(view);
  return { x: view.W / 2 + x * px * s, y: view.H * V.squadY - d * px * s, s };
}

/** 畫面橫向位置（0–1，相對畫布闊）→ 世界 x（隊伍嗰條線）。 */
export const worldX = (nx) => (nx - 0.5) / V.roadHalf;

/** 畫面頂對應幾遠。 */
export function topDistance(view) {
  const k = (view.H * V.squadY) / unitPx(view); // d × s = k
  return k / (1 - V.perspective * k);
}
