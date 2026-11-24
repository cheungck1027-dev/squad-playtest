// 術式：定時喺小隊條車道前面放一個術式陣。陣同小隊保持固定距離，
// 敵人迫近時會穿過佢；越過嗰一刻 HP 除 divisor（飄字「÷2」）。
// 數值喺 data/styles.js 嘅 formula.params。

import { GATE_OPS } from '../../data/gates.js';
import { targetableEnemies } from '../combat.js';
import { addNumber, addRing } from '../effects.js';
import { crossedLine, divideHp } from '../rules.js';

/** @type {import('./index.js').StyleBehavior} */
export const formula = {
  id: 'formula',
  implemented: true,

  init(member) {
    member.s.cd = 1; // 開場一秒後放第一個
  },

  update(state, member, dt) {
    const P = member.style.params, s = member.s;
    const enemies = targetableEnemies(state);

    // 已經放咗嘅陣：邊隻敵人啱啱越過
    for (const z of state.zones) {
      if (z.k !== 'array') continue;
      for (const e of enemies) {
        if (e.lane !== z.lane || (e.boss && !z.affectsBoss) || !crossedLine(e.pd ?? e.d, e.d, z.d)) continue;
        const next = divideHp(e.hp, z.divisor);
        if (next === e.hp) continue;
        e.hp = next;
        e.hit = 0.12;
        const at = { lane: e.lane, d: e.d, hk: e.def.aimHeight };
        addRing(state, { lane: e.lane, d: e.d }, member.char.battle.glow, 0.8);
        addNumber(state, { ...at, dy: 20 }, GATE_OPS.div.symbol + z.divisor, 'formula', false, 34);
      }
    }

    // 放新陣：要前面（陣嘅位置之外）真係有敵人行緊埋嚟先放，唔好放空
    s.cd = Math.max(0, s.cd - dt);
    if (s.cd > 0) return;
    const incoming = enemies.some((e) => e.lane === state.lane && e.d > P.distance && (!e.boss || P.affectsBoss));
    if (!incoming) return;
    s.cd = P.interval;
    member.lunge = member.lungeDur = 0.25; // 舉手施放：向前踏一小步
    member.dashTo = null;
    member.acts++;
    state.zones.push({ k: 'array', lane: state.lane, d: P.distance, t: 0, life: P.duration, divisor: P.divisor, affectsBoss: P.affectsBoss, asset: P.asset });
  },
};
