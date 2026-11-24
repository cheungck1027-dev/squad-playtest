// 戰鬥共用動作：搵目標、扣敵人 HP、打低首領過關。
// 各種戰鬥風格（styles/）都經呢度落手，唔好自己直接改敵人 HP。

import { TEXT } from '../data/text.js';
import { TUNING } from '../data/tuning.js';
import { addBoom, addDebris } from './effects.js';
import { gainSync, isDefeated } from './rules.js';
import { enterStage } from './spawning.js';


/**
 * 可以打嘅敵人：已經入咗射程、未死。
 * @param {import('./state.js').BattleState} state
 * @returns {import('./spawning.js').EnemyEntity[]}
 */
export function targetableEnemies(state) {
  const out = [];
  for (const e of state.ents) {
    if (e.type === 'enemy' && !e.dead && e.hp > 0 && e.d < TUNING.world.targetDistance) out.push(e);
  }
  return out;
}

/**
 * 預設搵目標方法：隊長條車道最近嘅敵人；首領唔理車道都打得。
 * @param {import('./state.js').BattleState} state
 * @returns {import('./spawning.js').EnemyEntity | null}
 */
export function findLaneTarget(state) {
  let best = null;
  for (const e of targetableEnemies(state)) {
    if ((e.boss || e.lane === state.lane) && (!best || e.d < best.d)) best = e;
  }
  return best;
}

/**
 * 對敵人造成傷害。處理中彈閃光、SYNC、擊破爆炸、打低首領過關。
 * @param {import('./state.js').BattleState} state
 * @param {import('./spawning.js').EnemyEntity} target
 * @param {number} dmg
 * @param {{ dir: number }} [heavy]  重擊（斬、撞）：敵人會向 dir（-1 左 / 1 右）失衡側傾，甩出裝甲碎片
 * @returns {boolean} 係咪打死咗
 */
export function damageEnemy(state, target, dmg, heavy) {
  target.hp -= dmg;
  target.hit = TUNING.feedback.hitFlash;
  state.sync = gainSync(state.sync, TUNING.sync.perHit);
  const at = { lane: target.lane, d: target.d, hk: target.def.aimHeight };
  if (heavy) {
    target.stagger = TUNING.feedback.staggerTime;
    target.staggerDir = heavy.dir || 1;
    addDebris(state, at, 5, heavy.dir || 1, state.fxRng.next());
  }
  if (!isDefeated(target)) return false;
  addDebris(state, at, 8, 0, state.fxRng.next());
  addBoom(state, { lane: target.lane, d: target.d, hk: 0.08 }, target.def.boomScale);
  if (target === state.boss) clearStage(state);
  return true;
}

/** 過關（首領嘅數字打到 0，或者佢行到身邊扣完之後攻擊力仲有剩）：記低、入下一關（清場、攻擊力返去下一關嘅開場數值）。 */
export function clearStage(state) {
  state.events.push({ type: 'stageClear', stage: state.stageNo });
  state.banner = { text: TEXT.banner.stageClear, t: TUNING.feedback.bannerTime, tone: 'info' };
  enterStage(state, state.stageNo + 1);
}
