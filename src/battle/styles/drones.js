// 浮游砲：count 部浮游砲跟住小隊，各自自動射擊小隊唔喺度嗰兩條車道最近嘅敵人。
// 每部先顧自己負責嗰條車道，嗰條冇敵人就幫另一條。首領唔理車道都打。
// 數值喺 data/styles.js 嘅 drones.params。

import { damageEnemy, targetableEnemies } from '../combat.js';
import { addNumber, addShot } from '../effects.js';
import { nearestInLanes, otherLanes, strikeDamage } from '../rules.js';

/** @type {import('./index.js').StyleBehavior} */
export const drones = {
  id: 'drones',
  implemented: true,

  init(member) {
    const P = member.style.params;
    member.s.cds = Array.from({ length: P.count }, (_, i) => 0.6 + i * P.stagger); // 每部距離下一發仲有幾耐
    member.s.flash = Array.from({ length: P.count }, () => 0);                     // 每部砲口閃光剩低幾耐（畫面用）
  },

  update(state, member, dt) {
    const P = member.style.params, s = member.s;
    const lanes = otherLanes(state.lane);
    let enemies = null;

    for (let i = 0; i < P.count; i++) {
      s.flash[i] = Math.max(0, s.flash[i] - dt);
      s.cds[i] = Math.max(0, s.cds[i] - dt);
      if (s.cds[i] > 0) continue;
      enemies ??= targetableEnemies(state);
      const mine = lanes[i % lanes.length];
      const target = nearestInLanes(enemies.filter((e) => !e.boss && e.hp > 0), [mine])
        ?? nearestInLanes(enemies.filter((e) => e.hp > 0), lanes);
      if (!target) continue;

      s.cds[i] = P.interval;
      s.flash[i] = 0.07;
      const dmg = strikeDamage(state.power, P.damage, P.spread, state.rng.next());
      const at = {
        lane: target.lane, d: target.d,
        jx: state.fxRng.range(-12, 12) * 3,
        hk: target.def.aimHeight * state.fxRng.range(0.7, 1.3),
      };
      addShot(state, at, `m${member.index}d${i}`, P.tracer);
      addNumber(state, { ...at, dy: 8 }, dmg, 'drone');
      damageEnemy(state, target, dmg);
    }
  },
};
