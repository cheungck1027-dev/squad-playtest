// 出怪：1) 用種子將關卡資料展開成固定嘅「排」清單；2) 戰鬥期間逐排放入場。
// 呢度冇 Math.random()，全部亂數嚟自關卡種子。

import { createRng } from '../core/rng.js';
import { getEnemy } from '../data/enemies.js';
import { getStage } from '../data/stages.js';
import { TUNING } from '../data/tuning.js';
import { applyGate, gateLabel, isGoodGate } from './rules.js';

const LANES = [-1, 0, 1];
/** 嘢喺幾遠出現。 */
const spawnDistance = () => TUNING.world.spawnDistance;

/**
 * @typedef {{ kind: 'gates', gates: import('../data/gates.js').Gate[] }} GateRow   三道門，順序係左、中、右
 * @typedef {{ kind: 'enemies', enemies: { lane: number, enemy: string, hp: number, phase: number }[] }} EnemyRow
 * @typedef {{ kind: 'boss', enemy: string, hp?: number }} BossRow   hp 唔填 = 用敵人資料嘅數
 * @typedef {GateRow | EnemyRow | BossRow} StageRow
 */

/**
 * 將關卡資料展開成排清單。同一份資料（同一粒種子）永遠得出同一個結果。
 * @param {import('../data/stages.js').StageDef} def
 * @returns {StageRow[]}
 */
export function buildStageRows(def) {
  const rows = def.rows ? def.rows.map((r) => structuredClone(r)) : generateRows(def);
  if (!rows.length || rows[rows.length - 1].kind !== 'boss') {
    throw new Error(`第 ${def.id} 關最後一排必須係首領`);
  }
  return rows;
}

function generateRows(def) {
  const rng = createRng(def.seed);
  let gateRows = 0;
  const rows = def.pattern.map((kind, i) => {
    if (kind === 'boss') return { kind: 'boss', enemy: def.boss, hp: 0 };
    if (kind === 'gates') return { kind: 'gates', gates: rollGates(def, rng, (def.gateGrowth ?? 1) ** gateRows++) };
    return { kind: 'enemies', enemies: rollEnemies(def, rng, (def.hpScale ?? 1) * (def.enemyGrowth ?? 1) ** i) };
  });
  // 首領嘅數字：關卡有填 bossHp 就用；有填 bossRatio 就按呢關嘅門排計（每排揀最好嗰道、唔射門，去到幾多攻擊力）再乘倍數，
  // 等唔同排法嘅關卡，首領都係「揀啱門兼有射門就贏到」嘅份量。
  let ideal = def.startPower ?? TUNING.player.startPower;
  for (const row of rows) if (row.kind === 'gates') ideal = Math.max(...row.gates.map((g) => applyGate(ideal, g)));
  const base = def.bossHp ?? (def.bossRatio ? ideal * def.bossRatio : getEnemy(def.boss).hp[0]);
  for (const row of rows) if (row.kind === 'boss') row.hp = Math.round(base * (def.hpScale ?? 1));
  return rows;
}

/**
 * 三道門，洗亂左右位置。grow = 加 / 減數值嘅放大倍數（越後面越大）。
 * 唔保證有正向門（加 / 減數門可以射到變好），但保證至少一道唔係減數門：只有減數門先會將攻擊力扣到 0，
 * 所以任何一排都一定有一條行得過嘅路，唔會出現點行都輸嘅門排。
 */
function rollGates(def, rng, grow = 1) {
  const roll = (entry) => ({
    op: entry.op,
    val: entry.value !== undefined ? entry.value : Math.round(rng.int(entry.min, entry.max) * grow),
  });
  const safePool = def.gatePool.filter((e) => e.op !== 'sub');
  const picked = [roll(rng.pick(safePool)), roll(rng.pick(def.gatePool)), roll(rng.pick(def.gatePool))];
  return rng.shuffle(picked);
}

/**
 * 一排敵人：1 至 3 隻，各佔一條車道。scale = 數字嘅放大倍數（越後面越大）。
 * 三條車道都有敵人（冇得避）嗰陣，其中一隻係「弱點」：數字唔跟進度放大，等玩家一定有條數字細嘅路。
 */
function rollEnemies(def, rng, scale = 1) {
  let count = 1;
  for (const p of def.enemyRow.extraChances) if (rng.chance(p)) count++;
  const lanes = rng.shuffle(LANES).slice(0, Math.min(count, LANES.length));
  return lanes.map((lane, i) => {
    const enemy = rng.weighted(def.enemyRow.table).enemy;
    const [lo, hi] = getEnemy(enemy).hp;
    const k = lanes.length === LANES.length && i === 0 ? (def.hpScale ?? 1) : scale;
    return { lane, enemy, hp: Math.max(1, Math.round(rng.range(lo, hi) * k)), phase: rng.range(0, 6) };
  });
}

// ---------- 場上物件 ----------

/**
 * @typedef {Object} GateEntity
 * @property {'gate'} type
 * @property {number} lane
 * @property {number} d        離玩家幾遠
 * @property {import('../data/gates.js').GateOp} op
 * @property {number} val
 * @property {string} label    門上面顯示嘅字（已套用門規則）
 * @property {boolean} good
 * @property {number} hit      啱啱中彈，閃一下剩低幾耐（秒；純畫面）
 * @property {number} pop      數字啱啱變咗，跳大剩低幾耐（秒；純畫面）
 * @property {number} flipT    啱啱由負轉正，演出剩低幾耐（秒；純畫面）
 * @property {boolean} [dead]
 */

/**
 * @typedef {Object} EnemyEntity
 * @property {'enemy'} type
 * @property {string} kind     敵人 id
 * @property {import('../data/enemies.js').EnemyDef} def
 * @property {boolean} boss
 * @property {number} lane
 * @property {number} d
 * @property {number} hp
 * @property {number} max
 * @property {number} hit      中彈閃光剩低幾耐
 * @property {number} ph       浮動相位（純視覺）
 * @property {boolean} [dead]
 */

/**
 * 敵人射出嚟嘅彈。而家未有敵人識開火，呢個類型係為咗「刀可以斬走敵彈」預留：
 * 喺自己條車道去到腳線就蝕 dmg 咁多 POWER。
 * @typedef {Object} ProjectileEntity
 * @property {'projectile'} type
 * @property {number} lane
 * @property {number} d
 * @property {number} dmg
 * @property {number} speed
 * @property {boolean} [dead]
 */

/**
 * 路面上嘅道具。喺自己條車道去到腳線就執到。而家只有飛行核心（flightCore）。
 * @typedef {Object} PickupEntity
 * @property {'pickup'} type
 * @property {'flightCore'} kind
 * @property {number} lane
 * @property {number} d
 * @property {boolean} [dead]
 */

/** @typedef {GateEntity | EnemyEntity | ProjectileEntity | PickupEntity} Entity */

/**
 * @param {import('../data/gates.js').Gate} gate
 * @param {number} lane
 * @param {readonly import('../data/gates.js').GateRule[]} gateRules
 * @returns {GateEntity}
 */
export function makeGate(gate, lane, gateRules) {
  return { type: 'gate', lane, d: spawnDistance(), op: gate.op, val: gate.val, label: gateLabel(gate, gateRules), good: isGoodGate(gate), hit: 0, pop: 0, flipT: 0 };
}

/**
 * @param {string} enemyId
 * @param {number} lane
 * @param {number} [hp]    唔填 = 敵人資料 HP 範圍嘅下限
 * @param {number} [phase]
 * @returns {EnemyEntity}
 */
export function makeEnemy(enemyId, lane, hp, phase = 0) {
  const def = getEnemy(enemyId);
  hp = Math.max(1, Math.round(hp ?? def.hp[0]));
  return { type: 'enemy', kind: def.id, def, boss: def.role === 'boss', lane, d: spawnDistance(), hp, max: hp, hit: 0, ph: phase };
}

/**
 * @param {number} lane
 * @param {number} d
 * @param {number} dmg
 * @param {number} speed
 * @returns {ProjectileEntity}
 */
export function makeProjectile(lane, d, dmg, speed) {
  return { type: 'projectile', lane, d, dmg, speed };
}

/**
 * @param {'flightCore'} kind
 * @param {number} lane
 * @param {number} [d]
 * @returns {PickupEntity}
 */
export function makePickup(kind, lane, d = spawnDistance()) {
  return { type: 'pickup', kind, lane, d };
}

/**
 * 將下一排放入場。回傳放咗邊一排；冇排剩就回傳 null。
 * @param {import('./state.js').BattleState} state
 * @param {number} [d]  放喺幾遠（唔填 = 最遠處）
 * @returns {StageRow | null}
 */
export function spawnNextRow(state, d = spawnDistance()) {
  const row = state.rows[state.rowIndex];
  if (!row) return null;
  state.rowIndex++;
  const from = state.ents.length;
  if (row.kind === 'gates') {
    row.gates.forEach((gate, i) => state.ents.push(makeGate(gate, LANES[i], state.gateRules)));
  } else if (row.kind === 'enemies') {
    for (const e of row.enemies) state.ents.push(makeEnemy(e.enemy, e.lane, e.hp, e.phase));
  } else {
    const boss = makeEnemy(row.enemy, 0, row.hp);
    state.ents.push(boss);
    state.boss = boss;
  }
  for (let i = from; i < state.ents.length; i++) state.ents[i].d = d;
  return row;
}

/**
 * 開始（或者重打）第 n 關：清場、攻擊力返去開場數值、進化形態清零、載入排清單，
 * 再將頭幾排預先排喺路上（第一排喺 firstRowDistance），等玩家一開始就見到嘢行埋嚟。
 * SYNC 同飛行狀態唔喺呢度理。
 * @param {import('./state.js').BattleState} state
 * @param {number} stageNo
 */
export function enterStage(state, stageNo) {
  loadStage(state, stageNo);
  state.ents = [];
  state.bullets = [];
  state.boss = null;
  state.zones = [];
  state.power = state.stage.startPower ?? TUNING.player.startPower;
  state.evo = 0; state.evoT = 0;
  const gap = rowSpacing(state);
  let d = TUNING.world.firstRowDistance;
  for (; d < spawnDistance() && state.rows[state.rowIndex]?.kind !== 'boss'; d += gap) spawnNextRow(state, d);
  state.spawnT = Math.max(0, d - spawnDistance()) / TUNING.world.approachSpeed;
}

/**
 * 載入第 n 關嘅排清單，由第一排開始（淨係換清單；成套開關做法見 enterStage）。
 * @param {import('./state.js').BattleState} state
 * @param {number} stageNo
 */
export function loadStage(state, stageNo) {
  state.stageNo = stageNo;
  state.stage = getStage(stageNo);
  state.rows = buildStageRows(state.stage);
  state.rowIndex = 0;
}

/** 每排相隔幾遠（距離單位）。 */
export function rowSpacing(state) {
  return state.stage.rowSpacing ?? TUNING.world.rowSpacing;
}

/** 每排相隔幾耐（秒）= 相隔距離 ÷ 世界速度。 */
export function rowInterval(state) {
  return rowSpacing(state) / TUNING.world.approachSpeed;
}
