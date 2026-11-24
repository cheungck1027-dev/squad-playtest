// 盾：兩樣嘢。
//   1. 被動：只要佢喺隊，俾敵人撞到嘅 POWER 損失乘 passive.contactLossScale（喺 state.js 開戰時計入 contactScale）。
//   2. 每隔 ramInterval 秒衝前撞一下：打小隊條車道最近嘅敵人，兼將佢撞退。
// 數值喺 data/styles.js 嘅 shield。

import { TUNING } from '../../data/tuning.js';
import { damageEnemy, targetableEnemies } from '../combat.js';
import { addNumber, addRing } from '../effects.js';
import { nearestInLanes, pushedDistance, strikeDamage } from '../rules.js';


/** @type {import('./index.js').StyleBehavior} */
export const shield = {
  id: 'shield',
  implemented: true,

  init(member) {
    member.s.cd = member.style.params.ramInterval * 0.5; // 開場等半個間隔先撞第一下
  },

  update(state, member, dt) {
    const P = member.style.params, s = member.s;
    s.cd = Math.max(0, s.cd - dt);
    if (s.cd > 0) return;

    const target = nearestInLanes(targetableEnemies(state), [state.lane], P.ramRange);
    if (!target) return; // 冇嘢撞就留住，一有敵人入範圍即刻撞

    s.cd = P.ramInterval;
    // 衝前撞（純畫面）：最遠衝 ramDash 咁遠，敵人近過呢個距離就衝到佢面前
    member.lunge = member.lungeDur = TUNING.squad.lungeTime;
    member.dashTo = { lane: target.lane, d: Math.max(1.2, Math.min(target.d - TUNING.squad.dashGap, P.ramDash)) };
    member.acts++;
    const dmg = strikeDamage(state.power, P.ramDamage, P.spread, state.rng.next());
    addRing(state, { lane: target.lane, d: target.d, hk: target.def.aimHeight * 0.5 }, member.char.battle.glow, target.boss ? 2 : 1);
    addNumber(state, { lane: target.lane, d: target.d, hk: target.def.aimHeight, dy: 14 }, dmg, 'ram', false, 28);
    const killed = damageEnemy(state, target, dmg, { dir: state.fxRng.chance(0.5) ? 1 : -1 });
    if (!killed) target.d = pushedDistance(target.d, target.boss ? P.ramPushBoss : P.ramPush, TUNING.world.targetDistance);
  },
};
