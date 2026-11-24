// 「三線長列」玩法嘅全部數值、關卡同文字（src/column/）。改手感、改平衡只改呢個檔。
// 單位同頂視版一樣：橫向 x 由 −1（路面左邊）到 +1（路面右邊）；向前嘅距離 d 用同一把尺（1 = 半條路闊）。
// 進化門檻、形態名、主角動態（傾身、後座、受擊）、操作手感照用 data/crowd.js 嗰套，呢度唔重複。

import { formatNumber } from '../core/format.js';
import { CROWD } from './crowd.js';
import { WEAPONS, setWeaponAt } from './weapons.js';

export const COLUMN = {
  /**
   * 而家用緊邊套數值（下面 NUMBERS 其中一格；useNumbers 換）。呢個檔本身預設係 classic（舊數值），
   * 遊戲開頁嗰陣 main.js 會轉做 big（大數字），網址加 ?nums=classic 就留喺舊數值。
   */
  numbers: /** @type {any} */ (null),

  /**
   * 鏡頭：後上方嘅透視鏡頭。
   *   pitch      鏡頭中心嘅俯角（度）
   *   heroPitch  主角腳底嗰個位嘅視線俯角（度）。主角嘅跑步片係由後上方約 55 度影嘅，所以呢個數要係 55
   *   heroY      主角腳底喺畫面高度邊度
   * 上下視野係由呢三個數推出嚟（見 src/column/camera.js）；鏡頭高度由 roadHalf 推出嚟。
   * pitch 越接近 heroPitch = 鏡頭越遠越高、視野越窄 → 路面向遠處收窄得越少（但睇到嘅距離都短咗）。
   * 而家 42.4：上下視野約 44 度，鏡頭高約 4.9 個單位；畫面頂嘅路闊約係畫面闊 42%，睇到主角前面約 9.7 個單位。
   *   heroScale  主角畫幾大（× 素材設定嘅大細；素材設定係全身佔畫面高 15%，0.733 即係約 11%）
   */
  camera: {
    pitch: 42.4,
    heroPitch: 55,
    heroY: 0.78,
    heroScale: 0.733,
    roadHalf: 0.46,      // 主角嗰條線：半條路闊佔畫面闊幾多
    maxAspect: 0.6,      // 畫面闊過呢個闊高比就當係呢個比例（路面唔會跟住無限變闊）
    bulletUp: 0.26,      // 子彈離地幾高（純畫面）
  },

  world: {
    scroll: 1.0,         // 世界每秒向主角捲幾多
    spawnDistance: 32,   // 嘢喺幾遠出現（好遠，喺霧入面淡入；兩節之後嘅嘢已經見到）
    despawn: -1.3,       // 過咗主角幾遠就清走（畫面底外面）
    fadeDepth: 3,      // 出現嗰陣用幾長距離淡入
  },

  /** 三條線：線中心嘅 x。 */
  lanes: [-2 / 3, 0, 2 / 3],

  /**
   * 射擊：一次齊射幾多粒、每粒威力幾多，由 NUMBERS 嗰套數值定（column/rules.js 嘅 salvoCount、shotDamage）。
   *   classic：每粒威力固定 1；粒數 = floor(√戰力)，最少 1、最多 cap（戰力 1 → 1 粒、50 → 7、200 → 14、1000 → 31、1600 起 → 40）
   *   big：    唔係越射越多粒，而係戰力每過一個門檻換一級武器（data/weapons.js）；下面 interval、cap、perRow、gapX、rowGap、speed、range 只係 classic 用
   * 齊射排法：一排最多 perRow 粒，橫向隔 gapX；多過一排就向後疊（rowGap），所以最闊都係 (perRow − 1) × gapX，唔會闊過一條線。
   */
  fire: {
    interval: 0.2,
    cap: 40,
    perRow: 8,
    gapX: 0.075,
    rowGap: 0.3,
    speed: 14,           // 子彈每秒飛幾遠
    range: 16,           // 飛幾遠就消失（差唔多去到畫面頂）
    startD: 0.45,        // 子彈由主角前面幾遠起飛
    hitR: 0.005,         // 子彈打方陣嗰陣嘅半徑：橫向離一隻敵人中心 phalanx.r + hitR 以內就打得中（啱啱飛喺兩行中間嘅子彈，兩行都掂到）
    muzzleD: 0.1,        // 啱啱射出嗰一步，對方陣嚟講子彈由主角前面呢個距離掃起（唔係由 startD）：貼到埋身嘅小敵人都打得中，唔會「子彈喺佢身後先出現」
    aimReach: 0.34,      // 武器等級（大數字版）：前面有方陣嗰陣，子彈自動分配去主角左右呢個距離以內、最前嗰幾行（9 行方陣闊 0.6，企正中就冚晒）
    muzzleBlend: 0.9,    // 純畫面：子彈離開槍口之後飛幾遠先完全返入主角正前方
  },

  /**
   * 四個形態嘅子彈外觀（純畫面）。color 芯色、glow 光暈色、len 尾巴長度（世界單位）、size 粗幼倍數、
   * shape：'bolt' 短光條、'twin' 光條加白芯、'orb' 光球加光環、'lance' 長光矛加十字星
   */
  bullets: [
    { shape: 'bolt', color: '235,250,255', glow: '120,220,255', len: 0.3, size: 1 },
    { shape: 'twin', color: '255,255,255', glow: '95,240,255', len: 0.5, size: 1.15 },
    { shape: 'orb', color: '240,220,255', glow: '190,120,255', len: 0.42, size: 1.45 },
    { shape: 'lance', color: '255,255,240', glow: '255,214,110', len: 0.8, size: 1.6 },
  ],

  /** 加數磚列：一長串細磚，每塊一個數；子彈打中或者主角掂到就收。只可以由最前嗰塊收起。 */
  bricks: {
    halfWidth: 0.27,     // 磚半闊（子彈打得中、主角掂得到嘅範圍）
    gap: 0.2,            // 磚同磚隔幾遠
    depth: 0.15,         // 磚面前後幾長（純畫面）
    touchD: 0.12,        // 去到主角前面幾遠就當掂到
    missD: -0.3,         // 過咗主角呢個距離都冇掂到：呢塊就走咗
  },

  /**
   * 數字路障：橫擋一條線，每中一粒 −1；歸零就碎，後面嘅大獎磚先收得。
   * 未打爆就去到主角面前：將主角推離呢條線（唔扣戰力），大獎磚跟住路障一齊過，攞唔到。
   */
  barrier: {
    halfWidth: 0.31,
    height: 0.5,         // 路障高度（世界單位，純畫面）
    pushD: 0.32,         // 去到主角前面幾遠開始推
    pushPast: -0.45,     // 過咗主角幾遠先唔再推
    prizeLead: 0.7,      // 第一塊大獎磚喺路障後面幾遠
    prizeGap: 0.5,       // 大獎磚同大獎磚隔幾遠
  },

  /**
   * 敵人大方陣：cols × rows 隻一模一樣嘅小敵人排成長方塊，成塊向主角推進，比路面快 speed。
   * 每隻 1 點血，一粒子彈倒一隻；每有一隻掂到主角，戰力 −1。
   * 去到 chargeD 之內成塊會橫向追住主角（每秒 drift），所以唔清佢就一定撞埋嚟；跑得快可以兜開一部分。
   * early：方陣比同一節嘅磚列、路障早幾多秒去到主角面前。
   */
  phalanx: {
    gapX: 0.075,
    gapD: 0.1,
    r: 0.04,             // 一隻佔嘅半徑
    speed: 0.3,
    early: 1.5,
    chargeD: 5,
    drift: 0.5,
    contactD: 0.1,       // 去到主角前面幾遠就當掂到
    passD: -0.15,        // 過咗主角呢個距離都冇掂到：呢隻就跑走咗
    size: 0.046,         // 一隻喺主角嗰條線佔畫面高度幾多（主角約 11%）
    color: '255,116,84',
  },

  /**
   * 一排門（節同節之間）：規則同頂視版一樣，入到呢個距離就射得郁（每粒 +1，冇上限）。
   * 7 = 門啱啱成道入咗畫面（375×812 喺畫面高度約 11%，即係畫面上面三分一入面）就開始食子彈，數字即刻跳。
   * 射得咁遠，射門變咗主要收入之一（後段每秒 200 粒 × 7 秒 ≈ +1400），所以關卡入面：
   *   路障嗰條線放乘數門（子彈穿過，唔會擋住打路障）；另外兩條線一道細加數門、一道大減數門（要射到佢變返正數先好行過）。
   */
  gate: { shootRange: 7, liveD: 11 },   // liveD：照實際戰力定數嘅門（中檔），喺幾遠嗰刻定（啱啱入鏡之前）

  /**
   * 首領：頭上係一個數字（唔係血條），每中一粒 −1。佢自己行埋嚟（比路面快 speed）；
   * 掂到主角就數字比拼：主角戰力扣走首領剩低個數，仲有戰力就贏，冇就輸。
   */
  boss: {
    halfWidth: 0.5,
    speed: 0.25,
    contactD: 0.55,
    size: 0.3,           // 喺主角嗰條線佔畫面高度幾多
    engageD: 16,         // 入到呢個距離當係開始打首領（介面用）
  },

  /**
   * 爆發技（2026-11-24，039）。爆發槽 0–1：
   *   brick   收晒一整列磚儲幾多（每塊 = brick ÷ 塊數；大獎磚一樣）
   *   phalanx 清晒一塊方陣儲幾多（每隻 = phalanx ÷ 隻數）
   *   gate    過一道好門；wall = 打爆一個路障
   * 滿咗玩家撳頭像發動（撳邊個頭像都得；三段齊就自動接力，唔使逐個撳）：先插入特寫 cutTime 秒（真實時間；期間世界行慢到 slowScale，唔係停），之後 time 秒內射速 × mul。
   * 爆發期間同特寫期間唔儲槽。一關大約儲得滿 2–3 次。
   */
  burst: { brick: 0.2, phalanx: 0.22, gate: 0.1, wall: 0.08, time: 6, mul: 2, cutTime: 0.8, slowScale: 0.25,
    // 完整爆發（起、承、決三個人都喺隊）：三個人逐個出特寫（合共 cutTime 秒），之後 time 秒內全隊射速 × mul
    full: { time: 8, mul: 2.5, cutTime: 1.5 } },
  /**
   * 隊伍（039 鋪路，040 有真隊員）。隊長加最多四個隊員（邊個、打法、數值喺 data/characters.js 嘅 ROSTER）：
   *   slots   每個企位相對隊長嘅位置 [橫向, 前後]（世界單位；前後負數 = 喺隊長後面）。次序：左後、右後、左外、右外
   *   follow  跟隊長左右移動嘅快慢（越大越貼；1 ÷ follow 秒左右跟到）。每個隊員再慢少少唔同（唔好似複製貼上）
   */
  team: { max: 4, follow: 7, slots: [[-0.24, -0.3], [0.24, -0.3], [-0.47, -0.12], [0.47, -0.12]] },
  holdTime: { defeat: 1.0, clear: 1.2 },   // 輸 / 贏之後最少停幾耐先收玩家嗰下撳（之後一直等，唔會自動重開）
  fxCap: 90,             // 命中火花、倒低嘅敵人呢類特效同時最多幾多個（多過就唔再加，唔影響規則）
};

/**
 * 關卡。timeline 嘅 at = 離起點幾遠（嗰樣嘢最前面去到主角面前嗰刻行咗幾多）。
 *   section  一節：lanes = [左, 中, 右]，每條線一長列（null = 空）：
 *              { type: 'bricks', n, val }                       加數磚列：n 塊，每塊 +val
 *              { type: 'barrier', hp, prize: { n, val } }       數字路障：數字 hp；後面 n 塊大獎磚，每塊 +val
 *              { type: 'phalanx', cols, rows }                  敵人大方陣：cols × rows 隻
 *   gates    一排門：gates 入面每道 { op: 'add' | 'sub' | 'mul' | 'div', val }
 * boss：at = 喺幾遠；hp = 頭上個數字
 */
export const COLUMN_STAGES = [
  {
    id: 1,
    timeline: [
      { at: 8, type: 'section', lanes: [{ type: 'bricks', n: 20, val: 1 }, { type: 'barrier', hp: 32, prize: { n: 3, val: 12 } }, { type: 'bricks', n: 15, val: 1 }] },
      { at: 17, type: 'gates', gates: [{ op: 'mul', val: 1.2 }, { op: 'add', val: 10 }, { op: 'sub', val: 300 }] },
      { at: 21, type: 'section', lanes: [{ type: 'barrier', hp: 300, prize: { n: 4, val: 150 } }, { type: 'phalanx', cols: 8, rows: 19 }, { type: 'bricks', n: 30, val: 1 }] },
      { at: 31, type: 'gates', gates: [{ op: 'add', val: 20 }, { op: 'mul', val: 1.2 }, { op: 'sub', val: 900 }] },
      { at: 35, type: 'section', lanes: [{ type: 'bricks', n: 25, val: 2 }, { type: 'barrier', hp: 1570, prize: { n: 4, val: 500 } }, { type: 'phalanx', cols: 8, rows: 25 }] },
      { at: 45, type: 'gates', gates: [{ op: 'add', val: 30 }, { op: 'sub', val: 1500 }, { op: 'mul', val: 1.2 }] },
      { at: 49, type: 'section', lanes: [{ type: 'phalanx', cols: 9, rows: 30 }, { type: 'bricks', n: 40, val: 2 }, { type: 'barrier', hp: 2325, prize: { n: 5, val: 1200 } }] },
      { at: 59, type: 'gates', gates: [{ op: 'add', val: 40 }, { op: 'sub', val: 2500 }, { op: 'div', val: 2 }] },
      { at: 63, type: 'section', lanes: [{ type: 'bricks', n: 30, val: 5 }, { type: 'phalanx', cols: 9, rows: 44 }, { type: 'bricks', n: 30, val: 5 }] },
      { at: 70, type: 'gates', gates: [{ op: 'mul', val: 1.5 }, { op: 'sub', val: 1000 }, { op: 'mul', val: 1.5 }] },
    ],
    boss: { at: 75, hp: 13000 },
  },
];

/**
 * 大數字版關卡（2026-11-23）：戰力由 1 開始，每一節大約大一個量級，關尾去到百萬（M）。排法（邊條線放乜、幾時出）同舊版一樣，只係數字唔同。
 *   小敵人掂到主角扣幾多唔喺呢度填：按當時戰力嘅比例計，有上限（下面 NUMBERS.big.contact）。
 *   路障嘅數字照「上一節過晒先開始專心打，啱啱打得爆」配：每秒合共威力 = 戰力 ÷ 4，專心打約 8 秒即係約 2 × 戰力。
 */
export const COLUMN_STAGES_BIG = [
  {
    id: 1,
    timeline: [
      { at: 8, type: 'section', lanes: [{ type: 'bricks', n: 20, val: 3 }, { type: 'barrier', hp: 40, prize: { n: 3, val: 30 } }, { type: 'bricks', n: 15, val: 3 }] },
      { at: 17, type: 'gates', gates: [{ op: 'mul', val: 2 }, { op: 'add', val: 50 }, { op: 'sub', val: 600 }] },
      { at: 21, type: 'section', lanes: [{ type: 'barrier', hp: 120, prize: { n: 4, val: 500 } }, { type: 'phalanx', cols: 8, rows: 19 }, { type: 'bricks', n: 30, val: 20 }] },
      { at: 31, type: 'gates', gates: [{ op: 'add', val: 800 }, { op: 'mul', val: 3 }, { op: 'sub', val: 12000 }] },
      { at: 35, type: 'section', lanes: [{ type: 'bricks', n: 25, val: 600 }, { type: 'barrier', hp: 3000, prize: { n: 4, val: 25000 } }, { type: 'phalanx', cols: 8, rows: 25 }] },
      { at: 45, type: 'gates', gates: [{ op: 'add', val: 12000 }, { op: 'sub', val: 150000 }, { op: 'mul', val: 3 }] },
      { at: 49, type: 'section', lanes: [{ type: 'phalanx', cols: 9, rows: 30 }, { type: 'bricks', n: 40, val: 20000 }, { type: 'barrier', hp: 250000, prize: { n: 5, val: 300000 } }] },
      { at: 59, type: 'gates', gates: [{ op: 'add', val: 500000 }, { op: 'sub', val: 2000000 }, { op: 'div', val: 2 }] },
      { at: 63, type: 'section', lanes: [{ type: 'bricks', n: 30, val: 100000 }, { type: 'phalanx', cols: 9, rows: 44 }, { type: 'bricks', n: 30, val: 100000 }] },
      { at: 70, type: 'gates', gates: [{ op: 'mul', val: 2 }, { op: 'sub', val: 3000000 }, { op: 'mul', val: 2 }] },
    ],
    boss: { at: 75, hp: 74000000 },
  },
];

/**
 * 成長速度（2026-11-23，034）：一關嘅數字由一條「目標戰力曲線」推出嚟，唔再逐個手填。
 *   P(t) = start × (end ÷ start) ^ (t ÷ 75)      t = 行咗幾遠（世界每秒捲 1，所以亦即係秒數）；75 = 首領嗰度
 * 即係每秒升同一個百分比。改快慢只改 end（關尾去到幾多）。其餘全部係「當時戰力嘅幾多成」：
 *   brick     一整列磚行晒合共加幾多 × 當時戰力（每塊 = 呢個數 ÷ 塊數，約 2–6%）
 *   prize     路障後面成列大獎磚合共加幾多 × 當時戰力（嗰一節最大嘅一筆）
 *   add       加數門加幾多 × 當時戰力；sub = 減數門寫幾多 × 當時戰力（實際最多扣一半）
 *   mul       五排門入面乘數門嘅倍數（逐排）
 *   wall      路障個數 = wall × 2 × 早 9 秒嗰陣嘅戰力（專心打 8 秒合共威力約 2 × 戰力；細過 1 = 留返餘裕）
 *   boss      首領個數 = boss × 關尾戰力
 *   gateShare 射加減門：每粒令個數郁「每粒威力 × gateShare」（快檔係 1；慢、中兩檔細好多，唔係射一陣就翻幾倍）
 *   lead      一樣嘢個數照「佢去到主角面前之前幾秒」嘅戰力計（子彈好遠就打到）
 * 12 級武器嘅門檻 = 曲線上平均分佈嘅 12 個時間點（weaponSpan = 最後一級喺第幾秒）× ahead；進化門檻 = 第 4、7、10 級嘅門檻
 * （進化演出緊嗰 1.4 秒唔升武器，所以係先進化、約一秒半之後先換新形態第一級武器，唔會撞埋同一刻；中檔武器最快 3 秒升一級）。
 *   ahead     實測「識揀」中段嘅戰力約係曲線嘅 1.5–2.5 倍（佢乜都食到），門檻照呢個倍數放高，升級先會平均分佈喺成關
 * 快檔（pace 3）唔用呢條曲線：係 033 嗰版手調嘅數（COLUMN_STAGES_BIG 同 data/weapons.js 嘅 at）。
 */
export const PACES = {
  1: { start: 50, end: 2500, brick: 0.45, prize: 0.9, add: 0.25, sub: 0.6, mul: [1.5, 1.5, 1.5, 1.5, 1.5], wall: 0.8, boss: 4.9, gateShare: 0.12, lead: 3, weaponSpan: 62, ahead: 2.4 },
  // 中檔（正式數值，2026-11-23 使用者揀）。live = 收入照「實際戰力」計，唔係曲線戰力：
  //   brick = 一整列磚合共嘅百分比（每塊加而家戰力嘅 brick ÷ 塊數，連續收係複利）；prize = 每塊大獎磚加而家戰力幾多（成列約 ×2）；
  //   bounty = 每打低一隻小敵人加而家戰力幾多（清方陣嗰陣戰力都喺度爬）。
  //   add、sub = 門入鏡嗰刻戰力嘅幾多成。路障、首領、武器門檻仍然照曲線（絕對數），所以曲線要貼住「識揀」實際行出嚟嘅戰力（ahead = 1）。
  2: { live: true, start: 50, end: 40000, brick: 0.4, prize: 0.1, add: 0.2, sub: 0.6, mul: [1.5, 1.5, 1.5, 1.5, 1.5], wall: 0.45, boss: 1.86, gateShare: 0.06, bounty: 0.0005, lead: 3, weaponSpan: 64, ahead: 1, early: [1.5, 1.25] },
};
const STAGE_LEN = 75;

/** 目標戰力：行到 t 嗰陣「識揀」應該有幾多。 */
export const paceCurve = (pace, t) => pace.start * (pace.end / pace.start) ** (Math.max(0, t) / (pace.len ?? STAGE_LEN)); // pace.len = 呢關幾長（十關版每關唔同；冇填 = 75）

/** 取整到兩位有效數字（磚、門上面嘅數唔好係 137 呢類碎數），最少 1。 */
export function niceNumber(x) {
  if (x < 10) return Math.max(1, Math.round(x));
  const k = 10 ** (Math.floor(Math.log10(x)) - 1);
  return Math.round(x / k) * k;
}

/** 由曲線砌第 1 關：排法（邊條線放乜、幾時出、方陣幾多隻）同舊版一樣，數字全部照當時戰力計。 */
export function paceStage(pace) {
  const P = (at) => paceCurve(pace, at - pace.lead);
  const L = pace.live;
  const bricks = (at, n) => (L ? { type: 'bricks', n, pct: pace.brick / n } : { type: 'bricks', n, val: niceNumber(pace.brick * P(at) / n) });
  const wall = (at, n) => ({ type: 'barrier', hp: niceNumber(pace.wall * 2 * paceCurve(pace, at - 9)), prize: L ? { n, pct: pace.prize } : { n, val: niceNumber(pace.prize * P(at) / n) } });
  const gate = (op, k, at) => (L ? { op, frac: k, val: niceNumber(k * P(at)) } : { op, val: niceNumber(k * P(at)) });
  const add = (at) => gate('add', pace.add, at), sub = (at) => gate('sub', pace.sub, at), mul = (i) => ({ op: 'mul', val: pace.mul[i] });
  return {
    id: 1,
    timeline: [
      { at: 8, type: 'section', lanes: [bricks(8, 20), wall(8, 3), bricks(8, 15)] },
      { at: 17, type: 'gates', gates: [mul(0), add(17), sub(17)] },
      { at: 21, type: 'section', lanes: [wall(21, 4), { type: 'phalanx', cols: 8, rows: 19 }, bricks(21, 30)] },
      { at: 31, type: 'gates', gates: [add(31), mul(1), sub(31)] },
      { at: 35, type: 'section', lanes: [bricks(35, 25), wall(35, 4), { type: 'phalanx', cols: 8, rows: 25 }] },
      { at: 45, type: 'gates', gates: [add(45), sub(45), mul(2)] },
      { at: 49, type: 'section', lanes: [{ type: 'phalanx', cols: 9, rows: 30 }, bricks(49, 40), wall(49, 5)] },
      { at: 59, type: 'gates', gates: [add(59), sub(59), { op: 'div', val: 2 }] },
      { at: 63, type: 'section', lanes: [bricks(63, 30), { type: 'phalanx', cols: 9, rows: 44 }, bricks(63, 30)] },
      { at: 70, type: 'gates', gates: [mul(3), sub(70), mul(4)] },
    ],
    boss: { at: STAGE_LEN, hp: niceNumber(pace.boss * pace.end) },
  };
}

/** 12 級武器嘅門檻：第 1 級 = 開場戰力，其餘平均分佈喺曲線上（最後一級喺第 weaponSpan 秒）。 */
// early：開場頭幾秒一次過收晒第一節嘅磚，戰力會高過曲線一截；第 2、3 級嘅門檻照呢個倍數放高，唔好一開波就連升兩級
export const paceWeaponAt = (pace) => WEAPONS.map((_, i) => (i ? niceNumber(pace.ahead * (pace.early?.[i - 1] ?? 1) * paceCurve(pace, pace.weaponSpan * i / (WEAPONS.length - 1))) : 1));

/**
 * 幾套數值。網址：冇填 = pace2（中）；?pace=1 慢、?pace=3 快（= big）；?nums=classic 用舊嗰套。
 *   contact     小敵人掂到主角：每隻扣當時戰力嘅 each（最少 1），同一塊方陣合共最多扣第一下掂到嗰刻戰力嘅 cap；null = 舊規則（每隻扣 1，扣到 0 為止）
 *   gateLoss    減數門、除數門一道最多扣走當時戰力嘅幾多（1 = 冇上限）
 *   startPower  開場戰力（冇填 = 1）；gateShare 見上面 PACES；weaponAt = 12 級武器嘅門檻（冇填 = data/weapons.js 表入面嘅）；weaponStep = 武器最快幾耐升一級（秒）
 *   weapons     true = 用武器等級（data/weapons.js）：戰力過門檻換武器，每秒合共威力 = 戰力 ÷ 4；false = 舊規則（粒數 floor(√戰力)、每粒威力 1）
 *   thresholds  進化門檻（形態 II、III、IV）
 */
export const NUMBERS = {
  classic: { name: 'classic', contact: null, gateLoss: 1, weapons: false, thresholds: [50, 200, 1000], stages: COLUMN_STAGES },
  big: { name: 'big', contact: { each: 0.004, cap: 0.35 }, gateLoss: 0.5, weapons: true, weaponStep: 2, gateShare: 1, startPower: 1, weaponAt: null, thresholds: [300, 100000, 5000000], stages: COLUMN_STAGES_BIG },
};
for (const k of [1, 2]) {
  const pace = PACES[k], at = paceWeaponAt(pace);
  NUMBERS[`pace${k}`] = { name: `pace${k}`, pace, contact: { each: 0.004, cap: 0.35 }, gateLoss: 0.5, weapons: true, gateShare: pace.gateShare, startPower: pace.start, weaponAt: at, bounty: pace.bounty ?? 0, thresholds: [at[3], at[6], at[9]], weaponStep: pace.live ? 3 : 2, stages: [paceStage(pace)] };
}
NUMBERS.pace3 = NUMBERS.big;
COLUMN.numbers = NUMBERS.classic;

/** 換數值：NUMBERS 入面嘅名（其他當 classic），或者直接畀成套數值（十關版每關一套，見 data/campaign.js 嘅 campaignNumbers）。進化門檻係同頂視版共用嘅 CROWD.evolution.thresholds，一齊換。 */
export function useNumbers(name) {
  COLUMN.numbers = typeof name === 'object' && name ? name : NUMBERS[name] ?? NUMBERS.classic;
  CROWD.evolution.thresholds = COLUMN.numbers.thresholds.slice();
  CROWD.evolution.devolve = !COLUMN.numbers.keep; // keep（十關版）：一關之內升咗嘅形態同武器唔會因為蝕戰力而跌返
  setWeaponAt(COLUMN.numbers.weaponAt ?? null);
  return COLUMN.numbers;
}

/**
 * 超出已編排嘅關卡：用最後一關做底，方陣每關長一成半、首領數字每關大 8%。
 * 路障唔加：佢哋嘅數字係照「專心打啱啱打得爆」配嘅，加咗就一定打唔爆。試玩版只係等過關之後有嘢繼續打，未認真編排。
 */
export function columnStage(no) {
  if (COLUMN.numbers.campaign) return COLUMN.numbers.stages[0]; // 十關版：呢套數值就係為呢一關生成嘅
  const list = COLUMN.numbers.stages, last = list.length, base = list[Math.min(no, last) - 1], k = Math.max(0, no - last);
  if (!k) return base;
  const lane = (l) => (l && l.type === 'phalanx' ? { ...l, rows: Math.round(l.rows * (1 + 0.15 * k)) } : l);
  return {
    id: no,
    timeline: base.timeline.map((it) => (it.type === 'section' ? { ...it, lanes: it.lanes.map(lane) } : it)),
    boss: { ...base.boss, hp: Math.round(base.boss.hp * (1 + 0.08 * k)) },
  };
}

/** 玩家睇到嘅字（其餘照用 data/crowd.js 嘅 CROWD_TEXT）。 */
export const COLUMN_TEXT = {
  blocked: '擋住！',
  broken: '打爆！',
  hazard: '危險',
  slam: '閃開！',
  phase2: '首領發狂！',
  miniDown: '小首領打低！',
  salvo: (n) => `齊射 ×${n}`,
  weapon: (level, name) => `Lv${level} ${name}`,
  weaponUp: (name) => `武器升級 · ${name}`,
  // 結算畫面
  clear: '過關！',
  defeat: '全滅！',
  resultPeak: (n) => `最高戰力 ${formatNumber(n)}`,
  resultKills: (n) => `打低敵人 ${formatNumber(n)}`,
  tapNext: '撳一下去下一關',
  tapRetry: '撳一下再嚟',
};
