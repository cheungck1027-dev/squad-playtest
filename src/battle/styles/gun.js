// 槍：自動開火，打小隊條車道最近嘅敵人，冇就打首領。
// 隊長嘅步槍射出嚟係一粒一粒飛行嘅子彈（battle/bullets.js）：飛到目標先結算，打敵人扣數、打加減數門 +1。
// 其他用槍嘅隊員（而家關咗）仲係即時命中嘅彈道。
// 射速、傷害等數值嚟自 data/styles.js 嘅 gun.weapons（角色用 weapon 揀邊支）。
// 武器有 pierce 就一發貫穿成條車道所有敵人（狙擊）。

import { fireBullets, hasBulletTarget } from '../bullets.js';
import { damageEnemy, findLaneTarget, targetableEnemies } from '../combat.js';
import { addNumber, addShot } from '../effects.js';
import { TUNING } from '../../data/tuning.js';
import { allInLanes, fireInterval, fireTier, flightFireRate, shotDamage } from '../rules.js';

/** @type {import('./index.js').StyleBehavior} */
export const gun = {
  id: 'gun',
  implemented: true,

  init(member) {
    member.s.cd = 0; // 距離下一發仲有幾耐
    member.s.flash = 0; // 槍口閃光剩低幾耐
  },

  update(state, member, dt) {
    /** @type {import('../../data/styles.js').GunWeapon} */
    const w = member.weapon;
    const s = member.s;
    const over = state.over > 0;
    const from = `m${member.index}`;

    // 飛行核心生效期間，隊長開火快啲
    const interval = fireInterval(w, over, flightFireRate(state.flight, member.index === 0));
    s.cd -= dt;
    if (s.cd <= 0) {
      s.cd = interval;
      // 隊長（步槍）：有嘢射先開火，一輪射出火力級數咁多粒子彈，總傷害平均分
      if (member.index === 0 && !w.pierce) {
        if (hasBulletTarget(state)) {
          member.acts++;
          s.flash = Math.min(over ? w.overFlash : w.flash, interval * 0.6);
          const level = fireTier(state.power), count = TUNING.firepower.tiers[level].streams;
          fireBullets(state, count, shotDamage(state.power, w, over, state.rng.next()) / count, level);
        }
        s.flash -= dt;
        member.muzzle = s.flash > 0;
        return;
      }
      const targets = w.pierce
        ? allInLanes(targetableEnemies(state), [state.lane])
        : [findLaneTarget(state)].filter(Boolean);
      if (targets.length) {
        member.acts++;
        s.flash = Math.min(over ? w.overFlash : w.flash, interval * 0.6);
        const dmg = shotDamage(state.power, w, over, state.rng.next());
        // 彈著點喺目標身上隨機偏少少，純視覺
        const jx = state.fxRng.range(-12, 12) * 3, hk = state.fxRng.range(0.7, 1.3);
        const point = (t) => ({ lane: t.lane, d: t.d, jx, hk: t.def.aimHeight * hk });
        // 彈道畫去最遠嗰個目標（貫穿嗰陣一條線穿晒）
        addShot(state, point(targets[targets.length - 1]), member.index ? from : undefined, w.tracer);
        for (const target of targets) {
          // 狙擊先飄傷害數字；步槍一輪一輪扣，睇敵人頭上個數字跌就得
          if (w.pierce) addNumber(state, { ...point(target), dy: 8 }, Math.round(dmg), 'hit', false, 24);
          damageEnemy(state, target, dmg);
        }
      } else if (w.pierce) {
        s.cd = 0; // 狙擊冇目標就留住呢一發，一有目標即刻開
      }
    }
    // 真係開咗槍先有槍口閃光（冇目標嗰陣唔閃）
    s.flash -= dt;
    member.muzzle = s.flash > 0;
  },
};
