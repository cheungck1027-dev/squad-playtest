// 戰鬥風格嘅行為登記處。資料喺 data/styles.js，行為喺呢個資料夾，用 id 對應。
//
// 加一種風格（或者將空殼變成真嘢）要做嘅事：
//   1. 喺 styles/<id>.js 匯出一個符合 StyleBehavior 嘅物件
//   2. 喺下面 BEHAVIORS 登記
//   3. data/styles.js 嗰筆資料改做 implemented: true，需要嘅數值放喺資料度
// 引擎（update.js）只會叫 init 同 update，唔會理係邊種風格。

import { blade } from './blade.js';
import { drones } from './drones.js';
import { formula } from './formula.js';
import { gun } from './gun.js';
import { shield } from './shield.js';

/**
 * @typedef {Object} StyleBehavior
 * @property {string} id            同 data/styles.js 嘅 id 一樣
 * @property {boolean} implemented  false = 空殼，上場都唔會出手
 * @property {(member: import('../state.js').SquadMember) => void} init
 *   開戰時叫一次。喺 member.s 建立呢種風格需要嘅狀態（冷卻時間等）。
 * @property {(state: import('../state.js').BattleState, member: import('../state.js').SquadMember, dt: number) => void} update
 *   每個固定步長叫一次。可以用：
 *     - combat.js：targetableEnemies / findLaneTarget 搵目標，damageEnemy 落傷害
 *     - rules.js：計數（傷害等）；需要隨機就用 state.rng.next()
 *     - effects.js：addShot / addBoom / addNumber 加畫面效果
 *   唔好掂畫布，唔好用 Math.random()。
 */

/** @type {Record<string, StyleBehavior>} */
const BEHAVIORS = { gun, blade, shield, formula, drones };

/**
 * @param {string} id
 * @returns {StyleBehavior}
 */
export function getStyleBehavior(id) {
  const b = BEHAVIORS[id];
  if (!b) throw new Error(`戰鬥風格 ${id} 未登記行為`);
  return b;
}
