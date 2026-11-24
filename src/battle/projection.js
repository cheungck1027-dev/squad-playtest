// 透視投影：將「第幾條車道、離玩家幾遠」變成畫面座標。
// 邏輯只用 lane 同 d；畫面闊高（view）係繪畫嗰陣先傳入嚟。

import { TUNING } from '../data/tuning.js';

const V = TUNING.view;

/**
 * @typedef {Object} View
 * @property {number} W    畫面闊（CSS 像素）
 * @property {number} H    畫面高
 * @property {number} u    比例尺：W / 540，所有尺寸以 540 闊為基準
 * @property {number} dpr
 */

export const MAX_DISTANCE = V.maxDistance;

export const MIN_DISTANCE = V.minDistance;

/**
 * 距離 → 畫面上嘅「視覺深度」。前面（d > 0）越遠拉得越開：depth = d × (1 + farStretch × d)。
 * 腳邊（d ≈ 0）冇變，所以路面喺腳底嘅流動速度同以前一樣（腳照樣貼地）；
 * 但幾個單位以外嘅嘢喺畫面已經去到好遠、好高，子彈先有路程飛，玩家亦睇到嘢由遠處行埋嚟。
 * 門、敵人、車道線、子彈全部用同一條式，所以佢哋之間唔會錯位。
 */
export function depthOf(d) {
  const x = Math.max(V.minDistance, d);
  return x > 0 ? x * (1 + (V.farStretch ?? 0) * x) : x;
}

/** 距離 → 縮放（0 距離 = 1；負數 = 隊長後面，近鏡頭所以大過 1） */
export function scaleAt(d) {
  return 1 / (1 + depthOf(d) / V.maxDistance * V.perspective);
}

/** scaleAt 嘅反函數：縮放 s（0–1）對應前面幾遠。 */
export function distanceAtScale(s) {
  const depth = (1 / Math.max(1e-6, s) - 1) * V.maxDistance / V.perspective, c = V.farStretch ?? 0;
  if (depth <= 0) return depth;
  return c > 0 ? (Math.sqrt(1 + 4 * c * depth) - 1) / (2 * c) : depth;
}

/** 距離 → 畫面 y */
export function screenY(view, d) {
  return view.H * (V.horizon + (V.baseline - V.horizon) * scaleAt(d));
}

/** 玩家腳線處路面半闊 */
export function roadHalfWidth(view) {
  return view.W * 0.5;
}

/** 車道（-1 / 0 / 1，可以係小數）同距離 → 畫面 x */
export function screenX(view, lane, d) {
  return view.W / 2 + lane * roadHalfWidth(view) * (2 / 3) * scaleAt(d);
}

/** 地平線嘅畫面 y */
export function horizonY(view) {
  return view.H * V.horizon;
}
