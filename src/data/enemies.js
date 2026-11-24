// 敵人資料。加敵人只需要喺呢度加一筆（同埋喺 data/assets.js 登記佢嘅圖），
// 然後喺關卡嘅 enemyRow.table 或者 boss 用佢個 id。

/**
 * @typedef {Object} EnemyDef
 * @property {string} id
 * @property {'grunt' | 'boss'} role
 * @property {string} asset            素材 key
 * @property {[number, number]} hp     頭上嗰個數字嘅基本範圍（同攻擊力同一個單位；關卡會按進度放大）。首領嘅數字由關卡嘅 bossHp 決定，呢度係後備
 * @property {number} [approachSpeed]  自己嘅迫近速度（唔填就用全局速度）
 * @property {number} [holdDistance]   迫近到呢個距離就停低（首領用）
 * @property {boolean} [ground]        true = 行地面嘅敵人：隊長飛行期間撞唔到佢
 * @property {number} aimHeight        子彈打中佢身上幾高（相對畫面高度，再乘距離縮放）
 * @property {number} boomScale        爆炸大細
 * @property {Object} look             純畫面用
 * @property {number} look.size        基本大細（以 540 闊畫面、距離 0 計）
 * @property {number} look.widthMul    圖片闊度 = size × 呢個數
 * @property {number} look.lift        離地幾高 = size × 呢個數
 * @property {number} look.bobAmp      上下浮動幅度
 * @property {number} look.bobSpeed    上下浮動速度
 * @property {string} look.hitFilter   中彈一刻嘅濾鏡
 * @property {number} [look.tagHeight] HP 牌喺頭頂幾高（× size）；唔填就唔顯示 HP 牌
 * @property {[number, number]} look.blockSize  冇圖嗰陣代替用嘅方塊 [闊, 高]（× size）
 */

/** @type {Record<string, EnemyDef>} */
export const ENEMIES = {
  drone: {
    id: 'drone', role: 'grunt', asset: 'enemy-drone',
    hp: [2, 4],
    aimHeight: 0.1, boomScale: 1,
    look: { size: 170, widthMul: 1, lift: 0.45, bobAmp: 8, bobSpeed: 5, hitFilter: 'brightness(2)', tagHeight: 1.25, blockSize: [0.8, 0.7] },
  },
  walker: {
    id: 'walker', role: 'grunt', asset: 'enemy-walker', ground: true,
    hp: [4, 8],
    aimHeight: 0.1, boomScale: 1,
    look: { size: 250, widthMul: 1, lift: 0, bobAmp: 8, bobSpeed: 5, hitFilter: 'brightness(2)', tagHeight: 1.05, blockSize: [0.8, 0.7] },
  },
  boss: {
    id: 'boss', role: 'boss', asset: 'boss-01',
    hp: [300, 300],
    // 首領跟住世界速度一路迫近到腳邊（唔會停）：到身邊都未打完，就由攻擊力扣佢剩低嘅數字
    aimHeight: 0.36, boomScale: 3,
    look: { size: 520, widthMul: 1.5, lift: 0.5, bobAmp: 6, bobSpeed: 2, hitFilter: 'brightness(1.25)', tagHeight: 1.22, blockSize: [1.4, 0.6] },
  },
};

/**
 * @param {string} id
 * @returns {EnemyDef}
 */
export function getEnemy(id) {
  const e = ENEMIES[id];
  if (!e) throw new Error(`未知敵人：${id}`);
  return e;
}
