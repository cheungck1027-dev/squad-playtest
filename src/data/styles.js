// 五種戰鬥風格嘅資料：所有數值（射程、冷卻、傷害比例）都喺呢度。
// 行為（每一步做乜）寫喺 battle/styles/<id>.js，兩邊用 id 對應。
// 傷害一律係「POWER × 比例」，再乘 spread 範圍入面一個隨機倍率。

/**
 * @typedef {Object} GunWeapon
 * @property {number} interval       開火間隔（秒）
 * @property {number} overInterval   OVERDRIVE 期間嘅開火間隔
 * @property {number} damage         每發傷害 = 攻擊力 × 呢個數
 * @property {number} overDamage     OVERDRIVE 期間
 * @property {[number, number]} spread   傷害浮動範圍（倍率）
 * @property {number} flash          槍口閃光維持幾耐（秒）
 * @property {number} overFlash
 * @property {number} flashSize      槍口閃光半徑（以 540 闊畫面計）
 * @property {number} overFlashSize
 * @property {boolean} [pierce]      true = 一發打晒條車道所有敵人
 * @property {import('../battle/effects.js').TracerLook} [tracer]  彈道外觀（唔填用預設青色幼線）
 */

/**
 * @typedef {Object} StyleDef
 * @property {string} id
 * @property {string} name          顯示名
 * @property {string} summary       一句講晒點打
 * @property {boolean} implemented  有冇行為
 * @property {Record<string, any>} [weapons]  呢種風格之下嘅武器變化（角色用 weapon 揀）
 * @property {Record<string, any>} [params]   呢種風格嘅數值
 * @property {{ contactLossScale?: number }} [passive]  只要有呢種風格嘅隊員喺隊就生效嘅被動效果
 */

/** @type {Record<string, StyleDef>} */
export const STYLES = {
  gun: {
    id: 'gun',
    name: '槍',
    summary: '自動射擊自己條車道最近嘅敵人，冇就打首領。',
    implemented: true,
    /** @type {Record<string, GunWeapon>} */
    weapons: {
      rifle: {
        // 隊長：每秒約 2.9 輪（射得慢，每粒子彈都睇得清、數得到），每輪總共扣攻擊力嘅 20%，即係每秒約五成半：
        // 一排嘅時間（約 1.6 秒）大約打得晒一隻數字同自己攻擊力一樣嘅敵人。超載：快一倍、每輪多三成
        interval: 0.35, overInterval: 0.175,
        damage: 0.2, overDamage: 0.26,
        spread: [0.8, 1.2],
        flash: 0.05, overFlash: 0.03,
        flashSize: 40, overFlashSize: 54,
      },
      // 狙擊：慢而重，一發貫穿成條車道。
      sniper: {
        interval: 0.9, overInterval: 0.5,
        damage: 0.6, overDamage: 1,
        spread: [0.9, 1.1],
        flash: 0.12, overFlash: 0.1,
        flashSize: 56, overFlashSize: 70,
        pierce: true,
        tracer: { color: '170,255,200', width: 5, life: 0.24 },
      },
    },
  },

  blade: {
    id: 'blade',
    name: '刀',
    summary: '唔開槍。敵人迫近先衝前一刀，自己同隔籬車道最前嗰隻都斬到。',
    implemented: true,
    params: {
      range: 10,          // 敵人迫近到呢個距離先出刀
      reach: 1,           // 斬到隔籬幾多條車道（1 = 自己 + 左右各一）
      cooldown: 1.2,      // 兩刀之間（秒）
      damage: 1.2,        // 每個目標嘅傷害 = POWER × 呢個數
      spread: [0.9, 1.1],
      asset: 'suzu-slash',
    },
  },

  shield: {
    id: 'shield',
    name: '盾',
    summary: '有佢喺隊，俾敵人撞到蝕少啲 POWER；每隔幾秒衝前撞退面前嘅敵人。',
    implemented: true,
    passive: { contactLossScale: 0.6 },   // 撞擊損失乘呢個數（0.6 = 減四成）
    params: {
      ramInterval: 4,     // 兩次衝撞之間（秒）
      ramRange: 26,       // 呢個距離以內先撞
      ramDamage: 0.8,     // 傷害 = POWER × 呢個數
      ramPush: 14,        // 撞退幾遠
      ramPushBoss: 0,     // 首領撞唔郁
      ramDash: 11,        // 衝撞動作最遠衝幾遠（純畫面）
      spread: [0.9, 1.1],
    },
  },

  formula: {
    id: 'formula',
    name: '術式',
    summary: '定時喺前面路面放一個術式陣，敵人踩過 HP 即刻除 2。',
    implemented: true,
    params: {
      interval: 5,        // 兩次施放之間（秒）
      distance: 18,       // 陣放喺前面幾遠（陣跟住小隊走，敵人會穿過佢）
      duration: 3.2,      // 維持幾耐（秒）
      divisor: 2,         // HP 除幾多
      affectsBoss: false, // 首領唔受影響
      asset: 'san-array',
    },
  },

  drones: {
    id: 'drones',
    name: '浮游砲',
    summary: '浮游砲跟住小隊，自動射擊另外兩條車道最近嘅敵人。',
    implemented: true,
    params: {
      count: 2,
      interval: 0.4,      // 每部浮游砲嘅開火間隔（秒）
      stagger: 0.2,       // 第二部遲幾耐先開第一發，等佢哋唔好同步
      damage: 0.1,        // 每發傷害 = POWER × 呢個數
      spread: [0.8, 1.2],
      asset: 'akari-drone-back',
      size: 50,           // 浮游砲大細（以 540 闊畫面計）
      // 每部浮游砲懸停喺邊（以主人身高做單位）：dx = 離主人中線幾遠，up = 離主人腳線幾高
      // 懸停位置（× 主人身高）：喺主人外側嘅路邊上空，唔好飄喺車道上面擋住遠處嘅門同敵人
      hover: [{ dx: 0.36, up: 1.06 }, { dx: 0.3, up: 1.38 }, { dx: 0.38, up: 1.64 }],
      tracer: { color: '255,228,120', width: 2, life: 0.1 },
    },
  },
};
