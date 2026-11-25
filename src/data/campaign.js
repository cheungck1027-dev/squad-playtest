// 十個關卡、三條永久升級、金幣同星數（2026-11-23 起；2026-11-24 038 改慢：一關只升十幾倍、武器同形態攤到十關）。
// 全部係數值同純計算；要調就改呢個檔。
//
// 每一關由下面 STAGES 一行生成（唔係十份手抄）：
//   base      呢關嘅基數 = 冇升級時嘅開局戰力。每關約係上一關 5 倍；一關之內只升約 15–30 倍，所以下一關開局會低過上一關關尾少少
//   sections  有幾多節（一節 = 三條線各一長列，節同節之間一排門）；首領喺 8 + 14 × sections
//   weapons   [開局武器級, 本關最高武器級]（1 起計）。一關只升 1–3 級
//   形態唔寫喺表度：第 1–3 關形態 I 開局、4–6 關 II、7–9 關 III、第 10 關 IV；第 3、6、9 關升到第 4、7、10 級武器嗰陣進化（一關最多一次，見 stageForms）
//   gain      收入倍數（磚、大獎、門、賞金一齊乘）：節數多嘅關收穫次數多，每次細啲，成關先至都係約 20–30 倍（實測調）
//   rec       建議開局戰力係基數嘅幾多倍（校準時普通玩家過呢關嗰刻嘅開局倍數；關卡簡介用）
//   ref       基準（有齊嗰關預計嘅隊員、識用爆發技）：冇升級時，自動試玩（「識揀」同「普通玩家」取幾何平均）喺呢關打得走幾大嘅首領，÷ 基數（實測；關卡內容一改就要重新量）
//   hard      難度倍數：首領個數 = 基數 × ref × hard。細過 1 = 冇升級都過到；大過 1 = 要靠升級
//   intro     地圖簡介
//
// 一關入面嘅收入照「實際戰力嘅百分比」計，所以成關嘅數字只跟基數縮放。

import { COLUMN, niceNumber, paceCurve } from './column.js';
import { WEAPONS } from './weapons.js';
import { MAX_MATES, ROSTER } from './characters.js';

export const STAGE_COUNT = 20;

/** 新嘢：邊一關開始有、叫乜名、一句說明（地圖簡介同報告用）。 */
export const FEATURES = {
  elite: { from: 2, name: '精英小敵人', note: '大隻、紫色，要打幾下先倒，打低賞金多。' },
  wide: { from: 3, name: '闊方陣', note: '一塊方陣橫跨兩條線，要喺兩條線之間左右掃先清得晒。' },
  countdown: { from: 4, name: '倒數門', note: '加數門個數會一路跌，快啲射佢或者快啲過。' },
  miniboss: { from: 5, name: '中段小首領', note: '關卡中段有隻細首領，打低有大獎。' },
  hazard: { from: 6, name: '危險地帶', note: '紅色地面會持續扣戰力，見到就避開嗰條線。' },
  slam: { from: 7, name: '首領出招', note: '首領會預告之後砸向一條線，紅光一閃就要走開。' },
  twoPhase: { from: 10, name: '兩階段大首領', note: '打到一半會發狂，出招快一倍。' },
  // 後十關（041 第四部分）：兩種新敵人行為、兩種新路面機關
  sway: { from: 11, name: '遊走方陣', note: '成塊方陣左右遊走，要跟住佢移動先射得中。' },
  slow: { from: 12, name: '減速帶', note: '藍色地面：企喺上面全隊射速減半，快啲行過。' },
  shield: { from: 13, name: '盾兵方陣', note: '方陣前面有一塊藍色盾，要先打爆塊盾先傷到後面嘅敵人。' },
  boost: { from: 14, name: '加速帶', note: '金色地面：踩過之後幾秒內全隊射速加快，值得轉線去踩。' },
};

/** 路面機關同新敵人嘅數值。 */
export const MECH = {
  slow: { rate: 0.5, len: 3.2 },                 // 減速帶：企喺上面射速 × rate
  boost: { rate: 1.6, time: 6, len: 1.6 },       // 加速帶：踩到之後 time 秒內射速 × rate
  sway: { amp: 0.3, speed: 1.5 },                // 遊走方陣：左右擺幅（路面闊度單位）同快慢
  shield: 0.7,                                   // 盾兵嘅盾 = 同節路障耐力嘅幾多
};
/** 困難模式：同一批關卡，路障、盾、小首領、首領嘅數 × hp；掉落 × drop，另外送萬能碎片。通晒主線先開。 */
export const HARD = { hp: 2.4, drop: 2, wild: 2 };

export const STAGES = [
  { base: 50, sections: 4, weapons: [1, 2], gain: 0.82, hard: 0.5, rec: 1, ref: 65.5, intro: '左右拖動，射磚加戰力，打爆路障攞大獎。' },
  { base: 250, sections: 4, weapons: [1, 3], gain: 1, hard: 0.6, rec: 1.41, ref: 45.8, intro: '' },
  { base: 1250, sections: 5, weapons: [2, 4], gain: 1, hard: 0.7, rec: 1.5, ref: 71.9, intro: '' },
  { base: 6250, sections: 5, weapons: [3, 5], gain: 1, hard: 0.8, rec: 1.72, ref: 98.5, intro: '' },
  { base: 31250, sections: 5, weapons: [4, 6], gain: 1, hard: 1.305, rec: 1.85, ref: 123.1, intro: '' },
  { base: 156250, sections: 6, weapons: [5, 7], gain: 0.78, hard: 1.163, rec: 2.07, ref: 286.2, intro: '' },
  { base: 781250, sections: 6, weapons: [6, 8], gain: 0.78, hard: 0.677, rec: 2.07, ref: 302.6, intro: '' },
  { base: 3906250, sections: 6, weapons: [7, 9], gain: 0.78, hard: 1.885, rec: 2.17, ref: 112.6, intro: '全部新嘢一齊嚟，節奏密咗。' },
  { base: 19531250, sections: 6, weapons: [8, 10], gain: 0.78, hard: 1.391, rec: 2.17, ref: 312.7, intro: '最後一關之前嘅試煉。' },
  { base: 97656250, sections: 6, weapons: [9, 12], gain: 0.78, hard: 1.931, rec: 2.28, ref: 254.7, intro: '' },
  // 第 11 至 20 關：基數每關 ×3（唔再 ×5，費事個數大到計唔準）；武器由高級開局
  { base: 292968750, sections: 6, weapons: [10, 12], gain: 0.78, hard: 2.515, rec: 2.28, ref: 250, intro: '高塔入面嘅「蝕」識得郁：方陣會左右遊走。' },
  { base: 878906250, sections: 6, weapons: [10, 12], gain: 0.78, hard: 2.677, rec: 2.28, ref: 250, intro: '' },
  { base: 2636718750, sections: 6, weapons: [10, 12], gain: 0.78, hard: 2.356, rec: 2.41, ref: 250, intro: '' },
  { base: 7910156250, sections: 6, weapons: [11, 12], gain: 0.78, hard: 2.486, rec: 2.44, ref: 250, intro: '' },
  { base: 23730468750, sections: 7, weapons: [11, 12], gain: 0.78, hard: 2.801, rec: 2.58, ref: 250, intro: '高塔頂層。' },
  { base: 71191406250, sections: 6, weapons: [11, 12], gain: 0.78, hard: 2.778, rec: 2.6, ref: 250, intro: '' },
  { base: 213574218750, sections: 7, weapons: [11, 12], gain: 0.78, hard: 2.801, rec: 2.63, ref: 250, intro: '' },
  { base: 640722656250, sections: 7, weapons: [12, 12], gain: 0.78, hard: 3.096, rec: 2.77, ref: 250, intro: '' },
  { base: 1922167968750, sections: 7, weapons: [12, 12], gain: 0.78, hard: 3.151, rec: 2.8, ref: 250, intro: '' },
  { base: 5766503906250, sections: 7, weapons: [12, 12], gain: 0.78, hard: 3.151, rec: 2.83, ref: 250, intro: '零點：一切「蝕」嘅起點。' },
];

/**
 * 打第 n 關嗰陣預計有邊啲隊員（照入隊關數：過咗第 2 關鈴入隊、過咗第 4 關霧入隊）。路障、小首領、首領嘅數照呢隊人計。
 */
export const stageMates = (n) => ROSTER.filter((r) => !r.leader && r.joinAfter > 0 && n > r.joinAfter).map((r) => r.id).slice(0, MAX_MATES);
/** 呢隊人嘅合共輸出係隊長一個人嘅幾多倍（1 = 冇隊員）：路障同小首領乘呢個數，有隊員都要打返咁耐。近距離加成當一半計。 */
export const teamPower = (ids) => 1 + ids.reduce((sum, id) => { const b = ROSTER.find((r) => r.id === id)?.battle; return sum + (b ? b.share * (1 + b.near / 2) + (b.drone?.share ?? 0) : 0); }, 0);

/** 呢關有邊啲新嘢（已經出過嘅都計）。 */
export const stageHas = (n, key) => n >= FEATURES[key].from;
/** 呢關第一次出現嘅新嘢。 */
export const stageAdds = (n) => Object.keys(FEATURES).filter((k) => FEATURES[k].from === n);

/**
 * 呢關第一次用到嘅武器同新形態（地圖簡介預告用）：
 *   weapons = 之前嘅關未用過、呢關會升到嘅武器（冇升級時）；form = 呢關會第一次進化到第幾形態（1 起計；冇 = 0）
 */
export function stageNews(n) {
  const seen = n > 1 ? Math.max(...STAGES.slice(0, n - 1).map((s) => s.weapons[1])) : 0, [from, to] = STAGES[n - 1].weapons;
  const fresh = []; for (let lv = Math.max(seen + 1, from); lv <= to; lv++) fresh.push(lv);
  const [f0, f1] = stageForms(n);
  return { weapons: fresh.map((lv) => ({ level: lv, name: WEAPONS[lv - 1].name })), form: f1 > f0 ? f1 + 1 : 0 };
}

/** 呢關嘅形態 [開局, 關尾]（0 起計：0 = 形態 I）。每三關進化一次：第 3、6、9 關。 */
export const stageForms = (n) => [Math.min(3, Math.floor((n - 1) / 3)), Math.min(3, Math.floor(n / 3))];

/**
 * 三條永久升級。level 0 = 冇買。
 *   power   開局戰力 × (1 + per × 等級)
 *   weapon  武器熟練：本關嘅武器升級門檻 × (1 − per × 等級)（早啲升）；去到 plus 入面嘅等級，本關最高武器級 +1（最多去到第 12 級）
 *   income  磚、大獎磚、加數門、打低敵人、射門嘅收入 × (1 + per × 等級)
 * 價錢 = cost × grow ^ 等級（取整到 10）。
 */
export const UPGRADES = {
  power: { name: '開局戰力', max: 25, per: 0.08, cost: 80, grow: 1.3, effect: (lv) => `開局戰力 +${Math.round(lv * 8)}%` },
  weapon: { name: '武器熟練', max: 20, per: 0.02, plus: [7, 15], cost: 120, grow: 1.32, effect: (lv) => `武器早啲升級（門檻 −${lv * 2}%）${lv >= 15 ? '，每關最高武器 +2 級' : lv >= 7 ? '，每關最高武器 +1 級' : ''}` },
  income: { name: '收入加成', max: 20, per: 0.006, cost: 200, grow: 1.36, effect: (lv) => `收入 +${(lv * 0.6).toFixed(1)}%` },
};
export const UPGRADE_KEYS = ['power', 'weapon', 'income'];

/** 由而家等級升一級要幾多金幣；滿級就 Infinity。 */
export function upgradeCost(key, level) {
  const U = UPGRADES[key];
  return level >= U.max ? Infinity : Math.round(U.cost * U.grow ** level / 10) * 10;
}

/** 升級嘅實際效果。 */
export function upgradeEffects(levels = {}) {
  const lv = (k) => Math.max(0, Math.min(UPGRADES[k].max, Math.floor(levels[k] ?? 0)));
  const w = lv('weapon');
  return {
    startMul: 1 + UPGRADES.power.per * lv('power'),
    weaponMul: 1 - UPGRADES.weapon.per * w,
    weaponPlus: UPGRADES.weapon.plus.filter((s) => w >= s).length,
    incomeMul: 1 + UPGRADES.income.per * lv('income'),
  };
}

/**
 * 金幣。clear = 過關（× 關數）；重打已經過咗嘅關只有 replay 成；star = 每粒新攞到嘅星（× 關數）；
 * first = 第一次過關（× 關數）；kills = 每打低幾多隻敵人一個金幣。
 * 輸咗：按進度畀——過關獎勵 ×（defeatMin +（defeatMax − defeatMin）× 進度），進度 = 行咗幾遠（佔 defeatRoad）加首領打走幾多成（佔其餘）。
 * 越接近過關攞得越多（最多七成），卡關嗰陣唔使重打好多局先夠錢升級。
 */
export const GOLD = { clear: 40, replay: 0.4, star: 12, first: 40, killsPer: 20, defeatMin: 0.2, defeatMax: 0.7, defeatRoad: 0.5 };

/** 進度（0–1）：road = 行咗關卡幾多成；boss = 首領打走幾多成（未見首領 = 0）。 */
export const progressOf = (road, boss) => Math.max(0, Math.min(1, GOLD.defeatRoad * Math.max(0, Math.min(1, road)) + (1 - GOLD.defeatRoad) * Math.max(0, Math.min(1, boss))));

/** 星數：輸 0；贏 1；首領比拼後剩低嘅戰力 ≥ 最高戰力三成 2；≥ 六成 3。 */
export function starsFor(won, left, peak) {
  if (!won) return 0;
  const k = peak > 0 ? left / peak : 0;
  return k >= 0.6 ? 3 : k >= 0.3 ? 2 : 1;
}

/**
 * 一局打完攞幾多金幣（逐項）。before = 呢關之前嘅紀錄 { stars }（冇打過 = 0 星）。progress = 輸咗嗰陣嘅進度（0–1，見 progressOf）。
 * @returns {{ clear: number, stars: number, first: number, kills: number, total: number, newStars: number }}
 */
export function goldFor(stageNo, { won, stars, kills, progress = 0 }, before = { stars: 0 }) {
  const cleared = before.stars > 0, base = GOLD.clear * stageNo * (cleared ? GOLD.replay : 1);
  const clear = Math.round(won ? base : base * (GOLD.defeatMin + (GOLD.defeatMax - GOLD.defeatMin) * Math.max(0, Math.min(1, progress))));
  const newStars = won ? Math.max(0, stars - before.stars) : 0;
  const starGold = newStars * GOLD.star * stageNo, first = won && !cleared ? GOLD.first * stageNo : 0, killGold = Math.floor((kills ?? 0) / GOLD.killsPer);
  return { clear, stars: starGold, first, kills: killGold, total: clear + starGold + first + killGold, newStars };
}

// ---------- 關卡生成 ----------

const SECTION_KINDS = [['bricks', 'wall', 'bricks'], ['wall', 'phalanx', 'bricks'], ['bricks', 'wall', 'phalanx'], ['phalanx', 'bricks', 'wall'], ['bricks', 'phalanx', 'bricks'], ['wall', 'bricks', 'phalanx']];
const GATE_KINDS = [['mul', 'add', 'sub'], ['add', 'mul', 'sub'], ['add', 'sub', 'mul'], ['add', 'sub', 'div'], ['mul', 'sub', 'mul'], ['add', 'mul', 'sub']];
const BRICK_COUNTS = [20, 30, 25, 40, 30, 30];

/**
 * 一關入面嘅收入（038：單一下唔好加太多）。全部係「而家戰力嘅幾多」：
 *   brick  一整列普通磚合共（每塊 = brick ÷ 塊數；複利，成列約 +25%）
 *   prize  成列大獎磚合共（每塊 = (1 + prize)^(1 ÷ 塊數) − 1；成列 +35%）
 *   add    加數門；sub = 減數門寫幾多（實際最多扣一半）；mul = 乘數門；div = 除數門
 *   bounty 每打低一隻小敵人；gateShare 射加減門每粒郁「每粒威力 × gateShare」
 *   grow   曲線：成關由基數升到基數 × grow（路障、武器門檻照呢條曲線定；實際「識揀」行出嚟約 15–30 倍）
 */
export const INCOME = { brick: 0.22, prize: 0.35, add: 0.1, sub: 0.3, mul: 1.25, div: 1.5, bounty: 0.00015, gateShare: 0.05, grow: 20 };

/** 呢關嘅成長設定（同 data/column.js 嘅 PACES[2] 同一套欄位）。 */
export function stagePace(n) {
  const S = STAGES[n - 1], len = 8 + 14 * S.sections;
  const g = S.gain;
  return { live: true, len, start: S.base, end: S.base * INCOME.grow, brick: INCOME.brick * g, prize: INCOME.prize * g, add: INCOME.add * g, sub: INCOME.sub, mul: 1 + (INCOME.mul - 1) * g, wall: 0.2, boss: 0, gateShare: INCOME.gateShare, bounty: INCOME.bounty * g, lead: 3 };
}

/** 第 lv 級武器（1 起計）滿火力對正方陣，每秒大約清到幾多隻（用嚟定方陣幾大：武器弱嘅關，方陣細啲）。 */
function killsPerSecond(lv) {
  const w = WEAPONS[lv - 1], mid = (v) => (Array.isArray(v) ? (v[0] + v[1]) / 2 : v);
  const cols = 1 + 2 * Math.floor((COLUMN.phalanx.r + COLUMN.fire.hitR + w.half) / COLUMN.phalanx.gapX + 1e-9);
  return w.burst / w.interval * mid(w.count) * (cols * mid(w.pierce) + mid(w.chain));
}

/** 生成第 n 關（1 起計）。同一個 n 每次生成都一樣。 */
export function campaignStage(n, mode = {}) { // mode.hard：困難模式（路障、盾、小首領、首領嘅數 × HARD.hp）
  const S = STAGES[n - 1], pace = stagePace(n), K = S.sections, bossAt = pace.len, has = (k) => stageHas(n, k), HP = mode.hard ? HARD.hp : 1;
  const P = (at) => paceCurve(pace, at - pace.lead), timeline = [], TP = teamPower(stageMates(n)); // TP：呢關預計有幾多隊員火力，路障同小首領照乘
  // 方陣大細跟呢關嘅武器：大約係「專心射幾秒清得晒」嘅數，越後嘅節越大
  const kps = (killsPerSecond(S.weapons[0]) + killsPerSecond(S.weapons[1])) / 2;
  for (let i = 0; i < K; i++) {
    const at = 8 + 14 * i, kinds = SECTION_KINDS[i % SECTION_KINDS.length], cols = i % 2 ? 8 : 9, rows = Math.max(4, Math.min(50, Math.round(kps * (3.5 + 0.7 * i) / cols)));
    const elite = has('elite') && (i === 1 || (n >= 8 && i === 3));
    const lanes = kinds.map((kind, lane) => {
      if (kind === 'bricks') { const count = BRICK_COUNTS[i % BRICK_COUNTS.length]; return { type: 'bricks', n: lane === 2 && i === 0 ? 15 : count, pct: pace.brick / count }; }
      if (kind === 'wall') { const pn = 3 + Math.min(2, Math.floor(i / 1.5)); return { type: 'barrier', hp: niceNumber(pace.wall * 2 * TP * HP * paceCurve(pace, at - 9)), prize: { n: pn, pct: (1 + pace.prize) ** (1 / pn) - 1 } }; }
      // 精英：隻數少、每隻要打 tough 下、賞金 bounty 倍
      if (elite) return { type: 'phalanx', cols: 5, rows: Math.max(2, Math.round(rows / 4)), tough: 4, elite: true, bounty: 8 };
      // 遊走方陣（第 11 關起，逢單數節）；盾兵方陣（第 13 關起，每三節一次）：前面一塊盾要先打爆
      const extra = {};
      if (has('sway') && i % 2 === 0) extra.sway = { ...MECH.sway, phase: i * 1.7 + lane };
      if (has('shield') && i % 3 === 2) extra.shield = niceNumber(pace.wall * 2 * MECH.shield * TP * HP * paceCurve(pace, at - 9));
      return { type: 'phalanx', cols, rows, ...extra };
    });
    // 闊方陣：第 5 節（磚、方陣、磚）改做「左邊兩條線一塊闊方陣、右邊磚」
    if (has('wide') && i % SECTION_KINDS.length === 4) { lanes[0] = { type: 'phalanx', cols: 17, rows: Math.max(3, Math.round(rows * 0.5)), x: -1 / 3 }; lanes[1] = null; }
    timeline.push({ at, type: 'section', lanes });
    // 危險地帶：喺有磚嗰條線前面一段（想執磚就要頂住扣戰力，或者等佢過咗先入）
    if (has('hazard') && (i % 3 === 0 || n >= 8)) { const lane = kinds.indexOf('bricks'); if (lanes[lane]) timeline.push({ at: at - 1.2, type: 'hazard', lane, len: 2.6, rate: 0.06 }); }
    // 減速帶（第 12 關起）：喺方陣嗰條線前面——企喺度射方陣就射得慢；加速帶（第 14 關起）：喺路障嗰條線前面——踩完再打路障
    if (has('slow') && i % 3 === 1) { const lane = kinds.indexOf('phalanx'); if (lane >= 0 && lanes[lane]) timeline.push({ at: at - 0.6, type: 'slow', lane, len: MECH.slow.len }); }
    if (has('boost') && i % 2 === 1) { const lane = kinds.indexOf('wall'); if (lane >= 0 && lanes[lane]) timeline.push({ at: at - 3.4, type: 'boost', lane, len: MECH.boost.len }); }
    // 一排門（最後一排喺首領前面）；第 3 排位喺有小首領嘅關卡換成小首領
    const gat = 17 + 14 * i;
    if (has('miniboss') && i === 2) timeline.push({ at: gat, type: 'miniboss', hp: niceNumber(pace.wall * 1.6 * TP * HP * paceCurve(pace, gat - 9)), prize: 0.3 * S.gain });
    else timeline.push({ at: gat, type: 'gates', gates: GATE_KINDS[i % GATE_KINDS.length].map((op) => (op === 'mul' ? { op, val: pace.mul } : op === 'div' ? { op, val: INCOME.div } : { op, frac: op === 'add' ? pace.add : pace.sub, val: niceNumber((op === 'add' ? pace.add : pace.sub) * P(gat)), ...(op === 'add' && has('countdown') ? { decay: n >= 9 ? 0.16 : 0.11 } : {}) })) });
  }
  timeline.sort((a, b) => a.at - b.at);
  // 首領個數 = 基數 × ref（冇升級嘅自動試玩喺呢關打得走幾大嘅首領，實測）× hard
  const boss = { at: bossAt, hp: niceNumber(S.base * S.ref * S.hard * HP) };
  if (has('slam')) boss.slam = { every: n >= 9 ? 2.6 : 3.4, warn: 1.1, loss: 0.1 };
  if (has('twoPhase')) boss.phases = 2;
  return { id: n, len: bossAt, timeline, boss };
}

/**
 * 呢關 12 級武器嘅門檻（一級一個數）：
 *   低過開局級 = 1；開局級 = 開局戰力少少（粒數由少到多由呢度計起）；之後到本關最高級 = 平均分佈喺成關（曲線上面），兩次升級相隔最少十幾秒；
 *   高過最高級 = 呢關升唔到（Infinity）。weaponMul、plus = 「武器熟練」嘅效果（門檻低啲、最高級加幾級）。
 */
export function stageWeaponAt(n, pace, weaponMul = 1, plus = 0) {
  const [from, top] = STAGES[n - 1].weapons, max = Math.min(WEAPONS.length, top + plus), steps = max - from;
  return WEAPONS.map((_, i) => {
    const lv = i + 1;
    if (lv < from) return 1;
    if (lv === from) return Math.max(1, Math.round(pace.start * 0.9));
    if (lv > max) return Infinity;
    return Math.max(lv, niceNumber(paceCurve(pace, pace.len * 0.9 * (lv - from) / (steps + 0.35)) * 1.3 * weaponMul));
  });
}

/**
 * 第 n 關、呢啲升級等級之下，戰鬥規則要用嘅成套數值（放入 COLUMN.numbers；格式同 data/column.js 嘅 NUMBERS 一樣）。
 * @param {number} n
 * @param {{ power?: number, weapon?: number, income?: number }} [levels]
 */
export function campaignNumbers(n, levels = {}, bonus = {}, mode = {}) { // bonus.power：隊長養成（等級、星級）加幾多成開局戰力，同基地嘅開局戰力相乘
  const pace = stagePace(n), fx = upgradeEffects(levels), at = stageWeaponAt(n, pace, fx.weaponMul, fx.weaponPlus), from = STAGES[n - 1].weapons[0];
  // 進化門檻：開局已經係嗰個形態 = 0；呢關會進化 = 第 4／7／10 級武器嘅門檻（武器同形態一齊嚟）；其餘呢關去唔到 = Infinity
  const [f0, f1] = stageForms(n), evo = [1, 2, 3].map((f) => (f <= f0 ? 0 : f <= f1 ? at[3 * f] : Infinity));
  return {
    name: `stage${n}`, campaign: n, pace, contact: { each: 0.004, cap: 0.35 }, gateLoss: 0.5, weapons: true, weaponStep: 15, keep: true,
    gateShare: pace.gateShare, bounty: pace.bounty, income: fx.incomeMul, minWeapon: from - 1,
    startPower: Math.round(pace.start * fx.startMul * (1 + (bonus.power ?? 0))), weaponAt: at, thresholds: evo, stages: [campaignStage(n, mode)], hardMode: !!mode.hard,
  };
}

/** 建議戰力（地圖簡介用）：冇升級嘅開局戰力。 */
export const stageBase = (n) => STAGES[n - 1].base;

// ---------- 無盡模式 ----------
/**
 * 無盡模式：一波一波打落去，每波三節加一隻首領；打低首領就入下一波，直到輸為止。
 *   每一波嘅數（磚、路障、首領）照「入呢一波嗰刻嘅實際戰力」定——所以比嘅唔係戰力有幾大，而係隊伍打得幾有效率（隊員輸出、爆發、武器、走位）。
 *   首領個數 = 入波戰力 × ref × hard(波)，hard 每波大 step 倍：遲早會打唔過。
 *   新嘢逐波加：第 2 波精英、第 3 波危險地帶同小首領出招、第 4 波遊走方陣、第 5 波減速帶、第 6 波盾兵、第 7 波加速帶。
 */
export const ENDLESS = { start: 500, sections: 3, ref: 60, hard: 0.15, step: 1.22, weaponStep: 6, unlockAfter: 5 };
const ENDLESS_FROM = { elite: 2, hazard: 3, slam: 3, sway: 4, slow: 5, shield: 6, boost: 7, countdown: 4 };

/** 無盡模式第 w 波（1 起計）嘅關卡：start = 入呢波嗰刻嘅戰力，offset = 已經行咗幾遠（時間線由呢度接落去）。 */
export function endlessWave(w, start = ENDLESS.start, offset = 0) {
  const K = ENDLESS.sections, len = 8 + 14 * K, g = 0.78, has = (k) => w >= ENDLESS_FROM[k];
  const pace = { live: true, len, start, end: start * INCOME.grow ** (K / 6), brick: INCOME.brick * g, prize: INCOME.prize * g, add: INCOME.add * g, sub: INCOME.sub, mul: 1 + (INCOME.mul - 1) * g, wall: 0.2, boss: 0, gateShare: INCOME.gateShare, bounty: INCOME.bounty * g, lead: 3 };
  const P = (at) => paceCurve(pace, at - pace.lead), timeline = [], TP = teamPower(MATES_ALL()), lv = Math.min(WEAPONS.length, 3 + w), kps = killsPerSecond(lv);
  for (let i = 0; i < K; i++) {
    const j = (w - 1) * K + i, at = 8 + 14 * i, kinds = SECTION_KINDS[j % SECTION_KINDS.length], cols = j % 2 ? 8 : 9, rows = Math.max(4, Math.min(50, Math.round(kps * (3.5 + 0.5 * i) / cols)));
    const lanes = kinds.map((kind, lane) => {
      if (kind === 'bricks') { const count = BRICK_COUNTS[j % BRICK_COUNTS.length]; return { type: 'bricks', n: count, pct: pace.brick / count }; }
      if (kind === 'wall') { const pn = 3 + (i % 2); return { type: 'barrier', hp: niceNumber(pace.wall * 2 * TP * paceCurve(pace, at - 9)), prize: { n: pn, pct: (1 + pace.prize) ** (1 / pn) - 1 } }; }
      if (has('elite') && i === 1) return { type: 'phalanx', cols: 5, rows: Math.max(2, Math.round(rows / 4)), tough: 4, elite: true, bounty: 8 };
      const extra = {};
      if (has('sway') && j % 2 === 0) extra.sway = { ...MECH.sway, phase: j * 1.7 + lane };
      if (has('shield') && j % 3 === 2) extra.shield = niceNumber(pace.wall * 2 * MECH.shield * TP * paceCurve(pace, at - 9));
      return { type: 'phalanx', cols, rows, ...extra };
    });
    timeline.push({ at: offset + at, type: 'section', lanes });
    if (has('hazard') && j % 2 === 0) { const lane = kinds.indexOf('bricks'); if (lane >= 0) timeline.push({ at: offset + at - 1.2, type: 'hazard', lane, len: 2.6, rate: 0.06 }); }
    if (has('slow') && j % 3 === 1) { const lane = kinds.indexOf('phalanx'); if (lane >= 0) timeline.push({ at: offset + at - 0.6, type: 'slow', lane, len: MECH.slow.len }); }
    if (has('boost') && j % 2 === 1) { const lane = kinds.indexOf('wall'); if (lane >= 0) timeline.push({ at: offset + at - 3.4, type: 'boost', lane, len: MECH.boost.len }); }
    const gat = 17 + 14 * i;
    timeline.push({ at: offset + gat, type: 'gates', gates: GATE_KINDS[j % GATE_KINDS.length].map((op) => (op === 'mul' ? { op, val: pace.mul } : op === 'div' ? { op, val: INCOME.div } : { op, frac: op === 'add' ? pace.add : pace.sub, val: niceNumber((op === 'add' ? pace.add : pace.sub) * P(gat)), ...(op === 'add' && has('countdown') ? { decay: 0.11 } : {}) })) });
  }
  timeline.sort((a, b) => a.at - b.at);
  const boss = { at: offset + len, hp: niceNumber(start * ENDLESS.ref * ENDLESS.hard * ENDLESS.step ** (w - 1)) };
  if (has('slam')) boss.slam = { every: w >= 8 ? 2.6 : 3.4, warn: 1.1, loss: 0.1 };
  return { id: 0, endless: true, wave: w, len: offset + len, timeline, boss };
}
const MATES_ALL = () => ROSTER.filter((r) => !r.leader).map((r) => r.id).slice(0, MAX_MATES);

/** 無盡模式嘅成套數值（放入 COLUMN.numbers）。武器門檻：由開局戰力起每級大 weaponStep 倍（大約一波升一級）。 */
export function endlessNumbers(levels = {}, bonus = {}) {
  const fx = upgradeEffects(levels), start = Math.round(ENDLESS.start * fx.startMul * (1 + (bonus.power ?? 0))), g = 0.78;
  const at = WEAPONS.map((_, i) => (i === 0 ? 1 : Math.round(ENDLESS.start * 2 * ENDLESS.weaponStep ** (i - 1) * fx.weaponMul)));
  const pace = { live: true, len: 8 + 14 * ENDLESS.sections, start, end: start * 20, brick: INCOME.brick * g, prize: INCOME.prize * g, add: INCOME.add * g, sub: INCOME.sub, mul: 1 + (INCOME.mul - 1) * g, wall: 0.2, boss: 0, gateShare: INCOME.gateShare, bounty: INCOME.bounty * g, lead: 3 };
  return {
    name: 'endless', campaign: 0, endless: true, pace, contact: { each: 0.004, cap: 0.35 }, gateLoss: 0.5, weapons: true, weaponStep: 8, keep: true,
    gateShare: pace.gateShare, bounty: pace.bounty, income: fx.incomeMul, minWeapon: 0,
    startPower: start, weaponAt: at, thresholds: [at[3], at[6], at[9]], stages: [endlessWave(1, start, 0)],
  };
}

