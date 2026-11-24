// 刀：唔開槍。敵人迫近到 range 以內先衝前出刀，一刀斬晒自己同隔籬車道最前嗰隻；
// 範圍內嘅敵彈亦會被斬走。數值喺 data/styles.js 嘅 blade.params。

import { TUNING } from '../../data/tuning.js';
import { damageEnemy, targetableEnemies } from '../combat.js';
import { addNumber, addSlash } from '../effects.js';
import { frontTargets, lanesWithin, strikeDamage } from '../rules.js';

/** @type {import('./index.js').StyleBehavior} */
export const blade = {
  id: 'blade',
  implemented: true,

  init(member) {
    member.s.cd = 0; // 距離下一刀仲有幾耐
  },

  update(state, member, dt) {
    const P = member.style.params, s = member.s;
    s.cd = Math.max(0, s.cd - dt);
    if (s.cd > 0) return;

    const lanes = lanesWithin(state.lane, P.reach);
    const targets = frontTargets(targetableEnemies(state), lanes, P.range);
    const shots = state.ents.filter((e) => e.type === 'projectile' && !e.dead && e.d <= P.range && lanes.includes(e.lane));
    if (!targets.length && !shots.length) return;

    s.cd = P.cooldown;
    // 衝去最近嗰個目標面前先斬（純畫面）
    const first = targets[0] ?? shots[0];
    member.lunge = member.lungeDur = TUNING.squad.lungeTime;
    member.dashTo = { lane: first.lane - 0.28, d: Math.max(1.2, first.d - TUNING.squad.dashGap) };
    member.acts++;
    const at = Math.max(2, (targets[0] ?? shots[0]).d);
    addSlash(state, lanes[0], lanes[lanes.length - 1], at, P.asset);
    for (const shot of shots) shot.dead = true;
    for (const target of targets) {
      const dmg = strikeDamage(state.power, P.damage, P.spread, state.rng.next());
      addNumber(state, { lane: target.lane, d: target.d, hk: target.def.aimHeight, dy: 14 }, dmg, 'slash', false, 28);
      damageEnemy(state, target, dmg, { dir: 1 }); // 由左向右橫掃
    }
  },
};
