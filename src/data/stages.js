// 關卡資料。一關 = 一粒種子 + 一份排法；battle/spawning.js 用種子將佢展開成
// 固定嘅「排」清單（門排、敵人排、首領），同一粒種子永遠出同一關。
// 想完全人手編排，可以直接填 rows（格式見 battle/spawning.js 嘅 StageRow），咁就唔會用種子生成。

/**
 * @typedef {Object} GatePoolEntry
 * @property {import('./gates.js').GateOp} op
 * @property {number} [value]   固定數值
 * @property {number} [min]     或者一個範圍（整數，包頭包尾）
 * @property {number} [max]
 */

/**
 * @typedef {Object} StageDef
 * @property {number} id
 * @property {string} name
 * @property {number | string} seed
 * @property {string} background             素材 key
 * @property {number} [startPower]           呢關開始嗰陣嘅攻擊力（唔填用 tuning）；每關都由呢個數重新開始
 * @property {number} [rowSpacing]           每排相隔幾遠（距離單位；唔填用 tuning）
 * @property {number} [hpScale]              呢關所有敵人數字乘幾多（唔填 = 1）
 * @property {number} [gateGrowth]           加數門、減數門嘅數值每過一排門乘幾多（唔填 = 1）：越後面嘅門數字越大
 * @property {number} [enemyGrowth]          敵人數字每一排乘幾多（唔填 = 1）：越後面嘅敵人數字越大
 * @property {number} [bossHp]               首領嘅數字（固定）
 * @property {number} [bossRatio]            冇填 bossHp 先用：首領嘅數字 = 呢關「每排門揀最好、唔射門」去到嘅攻擊力 × 呢個倍數
 * @property {('enemies' | 'gates' | 'boss')[]} pattern   每一排係乜，順序出
 * @property {GatePoolEntry[]} gatePool      門排由呢度抽三道門；保證至少一道係加或者乘
 * @property {{ extraChances: number[], table: { enemy: string, weight: number }[] }} enemyRow
 *   敵人排：一定有一隻，extraChances 每個數係「再多一隻」嘅機會；table 係抽邊種敵人
 * @property {string} boss                   首領嘅敵人 id
 * @property {import('../battle/spawning.js').StageRow[]} [rows]  人手編排（有就唔用上面嘅生成設定）
 */

/** @type {StageDef[]} */
export const STAGES = [
  {
    id: 1,
    name: '高架公路',
    seed: 20261119,
    background: 'bg-highway',
    startPower: 10,
    pattern: [
      'gates', 'enemies', 'gates', 'enemies', 'enemies', 'gates', 'enemies', 'gates', 'enemies', 'enemies',
      'gates', 'enemies', 'gates', 'enemies', 'enemies', 'gates', 'enemies', 'gates', 'enemies', 'enemies', 'boss',
    ],
    gateGrowth: 1.3,
    enemyGrowth: 1.25,
    bossHp: 5000,
    gatePool: [
      // 攻擊力由 10 開始。加 / 減嘅數值會跟 gateGrowth 越嚟越大
      { op: 'add', min: 4, max: 8 },
      { op: 'mul', value: 2 },
      { op: 'sub', min: 4, max: 8 },
      { op: 'div', value: 2 },
      { op: 'add', min: 6, max: 10 },
      { op: 'div', value: 3 },
    ],
    enemyRow: {
      extraChances: [0.75, 0.5],
      table: [
        { enemy: 'drone', weight: 6 },
        { enemy: 'walker', weight: 4 },
      ],
    },
    boss: 'boss',
  },
];

/**
 * 攞第 n 關。超出已編排嘅關卡，就沿用最後一關嘅排法、換一粒種子，
 * 等過關之後可以好似原型咁一直玩落去；每多一關敵人同首領嘅數字多一成（攻擊力每關重新開始），首領嘅數字按嗰關嘅門排計。
 * @param {number} n  由 1 開始
 * @returns {StageDef}
 */
export function getStage(n) {
  const found = STAGES.find((s) => s.id === n);
  if (found) return found;
  const last = STAGES[STAGES.length - 1];
  const { rows: _handAuthored, bossHp: _fixedBoss, ...template } = last;
  return { ...template, id: n, name: `${last.name}・延伸 ${n - last.id}`, seed: `${last.seed}:${n}`, bossRatio: 6, hpScale: (last.hpScale ?? 1) * (1 + 0.1 * (n - last.id)) };
}
