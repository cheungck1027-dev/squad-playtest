// 門嘅四種運算，同埋「門規則」（角色被動）有邊幾種。

/**
 * @typedef {'add' | 'mul' | 'sub' | 'div'} GateOp
 * @typedef {{ op: GateOp, val: number }} Gate
 */

/** @type {Record<GateOp, { symbol: string, good: boolean }>} */
export const GATE_OPS = {
  add: { symbol: '+', good: true },
  mul: { symbol: '×', good: true },
  sub: { symbol: '−', good: false },
  div: { symbol: '÷', good: false },
};

/**
 * 門規則 = 類型 + 數值。計算寫喺 battle/rules.js 嘅 GATE_RULE_EFFECTS，
 * 新角色如果用現有類型，只需要填資料；要新類型先要加一個處理函數。
 *
 * | type              | value 嘅意思                         | 狀態 |
 * |-------------------|--------------------------------------|------|
 * | mulGateBonus      | 乘數門嘅倍數加幾多（0.2 → ×2 變 ×2.2） | 已實作 |
 * | addGateBonus      | 加數門嘅數值多幾多成（0.25 → +25%）    | 已實作 |
 * | subGateCostScale  | 減數門嘅扣減乘幾多（0.5 → 扣一半）     | 已實作 |
 * | divGateCostScale  | 除數門嘅損失乘幾多（0.5 → 蝕一半）     | 已實作 |
 * | overdriveExtend   | OVERDRIVE 延長幾多秒                  | 已實作 |
 * | gateShootRaise    | 射門令門數值上升嘅速度加幾多成         | 只有資料（未有「射門」玩法） |
 *
 * @typedef {'mulGateBonus' | 'addGateBonus' | 'subGateCostScale' | 'divGateCostScale' | 'overdriveExtend' | 'gateShootRaise'} GateRuleType
 * @typedef {{ type: GateRuleType, value: number }} GateRule
 */
export const GATE_RULE_TYPES = /** @type {const} */ ([
  'mulGateBonus', 'addGateBonus', 'subGateCostScale', 'divGateCostScale', 'overdriveExtend', 'gateShootRaise',
]);
