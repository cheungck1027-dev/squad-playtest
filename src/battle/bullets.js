// 主角嘅子彈：一粒一粒由槍口飛出去，飛到目標嗰刻先結算（門 +1、敵人扣數）。
// 只改狀態物件，唔掂畫布；畫法喺 render.js 嘅 drawBullets。數值喺 tuning 嘅 bullets。
//
// 子彈沿住開火嗰刻主角條車道一直向前飛，撞到第一樣「射得郁」嘅嘢就中：
//   敵人（首領佔晒成條路，喺邊條車道都中）、加數門、減數門。
// 乘數門同除數門射唔郁，子彈直接穿過。飛出射程都冇嘢中就消失。
// 太近身嘅嘢（world.minTargetDistance 以內）射唔到：佢哋喺畫面已經低過槍口，子彈喺佢哋上面飛過。
//
// 子彈嘅位置用「畫面深度」u 記（0 = 腳線，1 = 地平線），每秒行固定咁多，所以喺畫面係勻速向上飛；
// d（路面距離）由 u 換算返嚟，用嚟同門、敵人比遠近。

import { TEXT } from '../data/text.js';
import { TUNING } from '../data/tuning.js';
import { damageEnemy } from './combat.js';
import { addNumber, addRing } from './effects.js';
import { distanceAtScale, scaleAt } from './projection.js';
import { gateLabel, isGoodGate, isShootableGate, shootGate } from './rules.js';

/**
 * @typedef {Object} Bullet
 * @property {number} lane   飛緊邊條車道（開火嗰刻主角嘅目標車道）
 * @property {number} x0     開火嗰刻主角實際嘅橫向位置（轉緊車道嗰陣係小數；純畫面，子彈由呢度飄返入車道中線）
 * @property {number} u      飛到邊（畫面深度：0 = 腳線，1 = 地平線）
 * @property {number} d      即係路面距離幾遠（由 u 計出嚟）
 * @property {number} k      呢一輪入面排第幾道（中間係 0，左負右正；純畫面，用嚟左右錯開）
 * @property {number} dmg    打中敵人扣幾多
 * @property {number} tier   開火嗰刻嘅火力級數（純畫面：粗幼同顏色）
 */

/** 呢樣嘢子彈打唔打得中。 */
function shootable(e, lane) {
  if (e.dead || e.d < TUNING.world.minTargetDistance) return false; // 已經行到身邊：射唔到
  if (e.type === 'enemy') return e.hp > 0 && (e.boss || e.lane === lane);
  return e.type === 'gate' && e.lane === lane && TUNING.gateShoot.enabled && isShootableGate(e);
}

/**
 * 主角條車道入面、射程內有冇嘢射（有先開火，冇就唔好亂射）。
 * @param {import('./state.js').BattleState} state
 */
export function hasBulletTarget(state) {
  return state.ents.some((e) => shootable(e, state.lane) && e.d < TUNING.world.targetDistance);
}

/**
 * 開一輪火：count 粒子彈並排飛出去，每粒打中敵人扣 dmgEach。
 * @param {import('./state.js').BattleState} state
 * @param {number} count
 * @param {number} dmgEach
 * @param {number} tier
 */
export function fireBullets(state, count, dmgEach, tier) {
  for (let i = 0; i < count; i++) {
    const d = TUNING.world.minTargetDistance; // 由槍口嗰個深度起飛
    state.bullets.push({ lane: state.lane, x0: state.x, u: 1 - scaleAt(d), d, k: i - (count - 1) / 2, dmg: dmgEach, tier });
  }
}

/**
 * 行一步：子彈向前飛，飛到嘢就結算。要喺場上嘅嘢移動完之後叫。
 * @param {import('./state.js').BattleState} state
 * @param {number} dt
 */
export function stepBullets(state, dt) {
  const B = TUNING.bullets, flying = state.bullets;
  for (const b of flying) {
    if (state.bullets !== flying) return; // 上一粒打低咗首領、換咗關：呢批子彈作廢
    b.u += B.speed * dt;
    b.d = distanceAtScale(1 - b.u);
    // 而家已經飛過咗、最近主角嗰樣射得郁嘅嘢（嘢行埋嚟、子彈飛出去，相遇嗰刻就係佢）
    let hit = null;
    for (const e of state.ents) if (shootable(e, b.lane) && e.d <= b.d && (!hit || e.d < hit.d)) hit = e;
    if (hit) {
      b.gone = true;
      // 命中點閃一下（純畫面）
      state.fx.push({ k: 'spark', at: { lane: b.lane, d: hit.d, jx: b.k * TUNING.firepower.streamGap, hk: B.aimHeight }, tier: b.tier, t: 0, life: B.sparkLife });
      if (hit.type === 'gate') hitGate(state, hit);
      else damageEnemy(state, hit, b.dmg);
    } else if (b.d > TUNING.world.targetDistance || b.u >= 0.98) {
      b.gone = true;
    }
  }
  state.bullets = state.bullets.filter((b) => !b.gone);
}

/** 一粒子彈打中一道加 / 減數門：數值 +1、更新門上面嘅字同顏色、加回饋（閃、跳、由負轉正嘅演出）。 */
export function hitGate(state, gate) {
  const G = TUNING.gateShoot;
  const next = shootGate(gate);
  gate.op = next.op; gate.val = next.val;
  gate.label = gateLabel(gate, state.gateRules);
  gate.good = isGoodGate(gate);
  gate.hit = G.hitTime;
  gate.pop = G.popTime;
  if (next.flipped) {
    // 由負轉正：門爆一下光、飄「逆轉！」
    gate.flipT = G.flipTime;
    addRing(state, { lane: gate.lane, d: gate.d, hk: 0.05 }, '70,235,170', 1.8);
    addNumber(state, { lane: gate.lane, d: gate.d, hk: 0.13 }, TEXT.float.gateFlip, 'gain', false, 30);
  }
}
