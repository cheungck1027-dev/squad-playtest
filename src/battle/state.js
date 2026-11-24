// 戰鬥狀態：一個普通物件，入面全部係數字同資料，冇畫布、冇 DOM。
// 邏輯（update.js）改佢，繪畫（render.js / effects.js / hud.js）只係讀佢。

import { createRng } from '../core/rng.js';
import { DEFAULT_SQUAD, MAX_SQUAD, getCharacter } from '../data/characters.js';
import { getStage } from '../data/stages.js';
import { STYLES } from '../data/styles.js';
import { TUNING } from '../data/tuning.js';
import { contactLossScale } from './rules.js';
import { enterStage } from './spawning.js';
import { getStyleBehavior } from './styles/index.js';

/**
 * 上場嘅一個隊員。
 * @typedef {Object} SquadMember
 * @property {import('../data/characters.js').CharacterDef} char
 * @property {import('../data/styles.js').StyleDef} style
 * @property {any} weapon                     呢個角色用嘅武器數值（風格冇武器變化就係 null）
 * @property {import('./styles/index.js').StyleBehavior} behavior
 * @property {Record<string, any>} s          風格自己嘅狀態（例如開火冷卻），由 behavior.init 建立
 * @property {boolean} muzzle                 呢一刻有冇槍口閃光（畫面用）
 * @property {number} index                   喺小隊入面排第幾（0 = 隊長），亦即係陣形位置
 * @property {number} x                       呢個隊員嘅橫向位置（追住 lane，隊員比隊長慢半拍；純畫面）
 * @property {number} lunge                   衝前出招動作剩低幾耐（秒；純畫面）
 * @property {number} lungeDur                今次衝前動作總長（秒）
 * @property {{ lane: number, d: number } | null} dashTo   衝前出招衝去邊（路面位置；null = 原地踏前一步）
 * @property {number} sinceAct                距離上次出招過咗幾耐（秒；揀動作片用）
 * @property {number} acts                    出過幾多次招（純畫面：數字一變，動畫片段就跳去出招動作）
 */

/**
 * 路面上嘅區域效果（而家只有術式陣）。位置相對小隊固定，敵人會穿過佢。
 * @typedef {{ k: 'array', lane: number, d: number, t: number, life: number, divisor: number, affectsBoss: boolean, asset: string }} Zone
 */

/**
 * @typedef {Object} BattleState
 * @property {number} t              戰鬥經過時間（秒）
 * @property {number} scroll         車道線流動位置（純視覺）
 * @property {number} lane           目標車道：-1 / 0 / 1
 * @property {number} x              角色實際橫向位置（追住 lane）
 * @property {number} power          攻擊力：主角唯一嘅數字。門直接改佢，傷害由佢決定，俾敵人行到身邊就扣佢剩低嘅數字；跌到 0 就輸
 * @property {number} evo            呢關去到第幾個進化形態（0 = 未進化；只升唔跌）
 * @property {number} evoT           進化演出剩低幾耐（秒；純畫面）
 * @property {{ t: number, tone: 'gain' | 'loss' }} pop   頭頂數字跳動：剩低幾耐、正向定負向（純畫面）
 * @property {number} sync           0–1
 * @property {number} over           OVERDRIVE 剩低幾耐，0 = 冇發動
 * @property {number} overMax        今次 OVERDRIVE 總長（畫計量條用）
 * @property {import('./rules.js').FlightState} flight   隊長嘅飛行狀態（平時喺地面跑，執到飛行核心或者超載先飛）
 * @property {import('./spawning.js').Entity[]} ents
 * @property {import('./spawning.js').EnemyEntity | null} boss
 * @property {import('./bullets.js').Bullet[]} bullets   主角飛緊嘅子彈
 * @property {import('./effects.js').Effect[]} fx
 * @property {import('./effects.js').FloatNumber[]} nums
 * @property {Zone[]} zones
 * @property {number} shake
 * @property {number} hurt           受擊動作剩低幾耐（秒；揀動作片用）
 * @property {number} flash
 * @property {{ text: string, t: number, tone: 'info' | 'alert' }} banner
 * @property {number} stageNo
 * @property {import('../data/stages.js').StageDef} stage
 * @property {import('./spawning.js').StageRow[]} rows
 * @property {number} rowIndex       已經出咗幾多排
 * @property {number} spawnT         距離下一排仲有幾耐
 * @property {SquadMember[]} squad
 * @property {SquadMember} leader
 * @property {import('../data/gates.js').GateRule[]} gateRules   而家生效嘅門規則：全隊每人一條
 * @property {number} contactScale   俾敵人撞到嘅損失倍率（隊入面有盾就細過 1）
 * @property {import('../core/rng.js').Rng} rng     影響勝負嘅亂數（傷害浮動）
 * @property {import('../core/rng.js').Rng} fxRng   純視覺嘅亂數（彈著點偏移），分開就唔會影響勝負
 * @property {import('../core/rng.js').Rng} pickRng 道具幾時出、出喺邊條車道；獨立一條，唔會擾亂傷害浮動
 * @property {BattleEvent[]} events  最近一步入面發生咗嘅事，俾外面（存檔等）處理；每步開頭清空
 */

/** @typedef {{ type: 'stageClear', stage: number } | { type: 'bossSpawn', stage: number } | { type: 'pickup', kind: string } | { type: 'defeat', stage: number } | { type: 'evolve', level: number }} BattleEvent */

/**
 * @param {string} charId
 * @param {number} [index]  喺小隊排第幾
 * @returns {SquadMember}
 */
export function createMember(charId, index = 0) {
  const char = getCharacter(charId);
  const style = STYLES[char.style];
  if (!style) throw new Error(`角色 ${charId} 用咗未知戰鬥風格：${char.style}`);
  const weapon = char.weapon ? style.weapons?.[char.weapon] ?? null : null;
  if (char.weapon && !weapon) throw new Error(`戰鬥風格 ${style.id} 冇 ${char.weapon} 呢種武器`);
  /** @type {SquadMember} */
  const member = { char, style, weapon, behavior: getStyleBehavior(style.id), s: {}, muzzle: false, index, x: 0, lunge: 0, lungeDur: 0, dashTo: null, sinceAct: 99, acts: 0, seenActs: 0 };
  member.behavior.init(member);
  return member;
}

/**
 * 開一場新戰鬥。
 * @param {Object} [opts]
 * @param {number} [opts.stageNo]   由第幾關開始
 * @param {string[]} [opts.squad]   角色 id，第一個係隊長，最多五個
 * @param {boolean} [opts.fullSquad]  成隊上場定係只有隊長（唔填跟 tuning 嘅 squad.enabled）
 * @param {number | string} [opts.seed]  戰鬥亂數種子（唔填就跟關卡種子）；唔影響關卡排法
 * @returns {BattleState}
 */
export function createBattle({ stageNo = 1, squad = DEFAULT_SQUAD, seed, fullSquad = TUNING.squad.enabled } = {}) {
  const stage = getStage(stageNo);
  if (!squad.length || squad.length > MAX_SQUAD) throw new Error(`小隊要有 1 至 ${MAX_SQUAD} 人`);
  if (new Set(squad).size !== squad.length) throw new Error('小隊入面唔可以有重複角色');
  // 小隊未開放：只建立隊長，其餘隊員完全唔存在（唔畫、唔出手、唔計門規則同被動）
  const members = (fullSquad ? squad : squad.slice(0, 1)).map((id, i) => createMember(id, i));
  const rng = createRng(seed ?? `battle:${stage.seed}`);
  const pickRng = rng.fork('pickup');
  /** @type {BattleState} */
  const state = {
    t: 0, scroll: 0,
    lane: 0, x: 0,
    power: stage.startPower ?? TUNING.player.startPower,
    evo: 0, evoT: 0, pop: { t: 0, tone: 'gain' },
    sync: 0, over: 0, overMax: TUNING.overdrive.duration,
    flight: { time: 0, max: TUNING.flight.duration, on: false, air: 0, nextCore: pickRng.range(...TUNING.flight.firstCore) },
    ents: [], boss: null, bullets: [],
    fx: [], nums: [], zones: [],
    shake: 0, flash: 0, hurt: 0,
    banner: { text: '', t: 0, tone: 'info' },
    stageNo, stage, rows: [], rowIndex: 0, spawnT: 0,
    squad: members, leader: members[0],
    gateRules: members.map((m) => m.char.gateRule),
    contactScale: contactLossScale(members.map((m) => m.style.passive)),
    rng, fxRng: rng.fork('fx'), pickRng,
    events: [],
  };
  enterStage(state, stageNo);
  return state;
}
