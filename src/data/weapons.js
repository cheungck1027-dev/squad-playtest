// 武器等級（大數字版用；?nums=classic 舊數值唔用呢個表）。加武器、改門檻、改外觀只改呢個檔。
//
// 戰力每過一個門檻（at）換一級武器；跌返落門檻以下就降級。同一級入面，戰力由呢級門檻升到下一級門檻，
// 帶 [最少, 最多] 嘅數值（粒數 count、穿透 pierce、連鎖 chain）會慢慢由最少升到最多——滿咗就「合成」做下一級。
//
// 規則數值（畫面打中乜，規則就算打中乜）：
//   kind      'shot' = 會飛嘅子彈；'beam' = 即時命中嘅光束（由主角正前方直線掃出去，射到第一樣嘢為止）；'strike' = 由天而降（一樣係即時命中，畫法唔同）
//   interval  一個循環幾耐（秒）；burst = 一個循環入面連射幾輪（輪同輪相隔 burstGap 秒）
//   count     一輪幾多粒 / 幾多道（最多一排 8）；gap = 粒同粒橫向隔幾遠
//   fan       散開：每粒按佢離中線幾遠，飛出去之後再向外移（橫向速度 = 偏移 × fan），近身窄、遠處闊
//   sweep     機炮式掃射：每一輪成排向左右擺幾遠（跟住輪數嚟回）
//   speed     子彈每秒飛幾遠；range = 射程
//   half      命中半闊（世界單位）：打方陣時，橫向離子彈中心 half 以內嘅行全部中（方陣行距 0.075）；打磚、路障、首領時個判定闊咗 half
//   pierce    每一行由最前數起倒幾多隻（1 = 一粒倒一隻）
//   chain     連鎖：命中之後再跳去隔離幾多行，每行倒最前一隻
//   homing    追蹤：飛行途中每秒最多橫移幾遠，對住最近嗰塊方陣嘅中線（0 = 直飛）
//   out       輸出倍率：打路障、首領、加減門時，每秒合共威力 = 戰力 ÷ 4 × out（所有武器一樣快，分別在於清方陣嘅方式）
//
// 外觀 look（3D 畫面；純畫面）：
//   shape     'tracer' 短光條、'orb' 光球拖尾、'lance' 光矛、'blade' 弧形光刃、'beam' 光束、'pillar' 光柱
//   core / glow / mix / len / width / flat / halo / haloLen  同 data/bullet3d.js 一樣
//   hit       命中效果：'spark' 火花、'blast' 爆炸圈、'ring' 環形閃光、'zap' 電弧
//
// form = 屬於邊個形態（0 = 形態 I）。門檻要同進化門檻（data/column.js 嘅 NUMBERS.big.thresholds：300、10 萬、500 萬）對得上：每個形態三級。

export const WEAPONS = [
  // ---- 形態 I 步槍（橙） ----
  { id: 'tracer', name: '曳光彈', form: 0, at: 1, kind: 'shot', interval: 0.16, burst: 1, burstGap: 0, count: [1, 4], gap: 0.075, fan: 0, sweep: 0, speed: 14, range: 16, half: 0, pierce: 1, chain: 0, homing: 0, out: 1,
    look: { shape: 'tracer', core: '255,176,84', glow: '255,112,20', mix: 0.35, len: 0.18, width: 0.03, flat: 1, halo: 2.6, haloLen: 1.25, hit: 'spark' } },
  { id: 'burst', name: '三連發', form: 0, at: 12, kind: 'shot', interval: 0.36, burst: 3, burstGap: 0.06, count: [2, 4], gap: 0.075, fan: 0, sweep: 0, speed: 16, range: 16, half: 0, pierce: 1, chain: 0, homing: 0, out: 1,
    look: { shape: 'tracer', core: '255,226,96', glow: '255,188,24', mix: 0.3, len: 0.28, width: 0.024, flat: 1, halo: 2.4, haloLen: 1.2, hit: 'spark' } },
  { id: 'scatter', name: '散彈', form: 0, at: 70, kind: 'shot', interval: 0.3, burst: 1, burstGap: 0, count: [5, 8], gap: 0.03, fan: 2.2, sweep: 0, speed: 12, range: 12, half: 0, pierce: 1, chain: 0, homing: 0, out: 1,
    look: { shape: 'tracer', core: '255,118,66', glow: '255,52,24', mix: 0.4, len: 0.1, width: 0.04, flat: 1, halo: 2.0, haloLen: 1.1, hit: 'spark' } },
  // ---- 形態 II 雙管炮（青綠） ----
  { id: 'shell', name: '重炮彈', form: 1, at: 300, kind: 'shot', interval: 0.42, burst: 1, burstGap: 0, count: [1, 2], gap: 0.3, fan: 0, sweep: 0, speed: 9, range: 16, half: 0.115, pierce: [3, 4], chain: 0, homing: 0, out: 1,
    look: { shape: 'orb', core: '225,255,248', glow: '36,226,190', mix: 0.5, len: 0.26, width: 0.12, flat: 1, halo: 1.6, haloLen: 1.05, hit: 'blast' } },
  { id: 'missile', name: '追蹤飛彈', form: 1, at: 2500, kind: 'shot', interval: 0.4, burst: 1, burstGap: 0, count: [3, 5], gap: 0.16, fan: 0, sweep: 0, speed: 9, range: 16, half: 0.08, pierce: 2, chain: 0, homing: 0.9, out: 1,
    look: { shape: 'lance', core: '255,255,255', glow: '90,255,170', mix: 0.25, len: 0.22, width: 0.05, flat: 1, halo: 2.4, haloLen: 2.2, hit: 'blast' } },
  { id: 'gatling', name: '連射機炮', form: 1, at: 20000, kind: 'shot', interval: 0.05, burst: 1, burstGap: 0, count: [2, 3], gap: 0.3, fan: 0, sweep: 0.26, speed: 18, range: 16, half: 0, pierce: 1, chain: 0, homing: 0, out: 1,
    look: { shape: 'tracer', core: '215,255,255', glow: '40,200,255', mix: 0.5, len: 0.1, width: 0.018, flat: 1, halo: 2.2, haloLen: 1.1, hit: 'spark' } },
  // ---- 形態 III 長槍（紫） ----
  { id: 'lance', name: '穿透光矛', form: 2, at: 100000, kind: 'shot', interval: 0.25, burst: 1, burstGap: 0, count: [2, 4], gap: 0.15, fan: 0, sweep: 0, speed: 15, range: 16, half: 0, pierce: 6, chain: 0, homing: 0, out: 1,
    look: { shape: 'lance', core: '246,232,255', glow: '178,104,255', mix: 0.35, len: 0.7, width: 0.034, flat: 1, halo: 2.2, haloLen: 1.05, hit: 'ring' } },
  { id: 'laser', name: '持續激光', form: 2, at: 400000, kind: 'beam', interval: 0.05, burst: 1, burstGap: 0, count: [1, 3], gap: 0.15, fan: 0, sweep: 0, speed: 0, range: 12, half: 0, pierce: 3, chain: 0, homing: 0, out: 1,
    look: { shape: 'beam', core: '255,235,255', glow: '214,80,255', mix: 0.3, len: 0, width: 0.028, flat: 1, halo: 2.6, haloLen: 1, hit: 'spark' } },
  { id: 'chain', name: '連鎖閃電', form: 2, at: 1500000, kind: 'beam', interval: 0.12, burst: 1, burstGap: 0, count: [2, 3], gap: 0.3, fan: 0, sweep: 0.2, speed: 0, range: 12, half: 0, pierce: 2, chain: [5, 8], homing: 0, out: 1,
    look: { shape: 'beam', core: '235,240,255', glow: '120,140,255', mix: 0.3, len: 0, width: 0.016, flat: 1, halo: 2.4, haloLen: 1, hit: 'zap' } },
  // ---- 形態 IV 權杖（白金） ----
  { id: 'wave', name: '光刃波', form: 3, at: 5000000, kind: 'shot', interval: 0.25, burst: 1, burstGap: 0, count: 1, gap: 0, fan: 0, sweep: 0, speed: 10, range: 16, half: 0.3, pierce: [2, 4], chain: 0, homing: 0, out: 1,
    look: { shape: 'blade', core: '255,252,238', glow: '255,204,98', mix: 0.3, len: 0.16, width: 0.68, flat: 0.12, halo: 1.12, haloLen: 1.8, hit: 'spark' } },
  { id: 'megalaser', name: '巨型激光', form: 3, at: 9000000, kind: 'beam', interval: 0.05, burst: 1, burstGap: 0, count: 1, gap: 0, fan: 0, sweep: 0, speed: 0, range: 14, half: 0.3, pierce: 1, chain: 0, homing: 0, out: 1,
    look: { shape: 'beam', core: '255,255,246', glow: '255,214,120', mix: 0.2, len: 0, width: 0.5, flat: 0.5, halo: 1.3, haloLen: 1, hit: 'spark' } },
  { id: 'pillars', name: '天降光柱', form: 3, at: 16000000, kind: 'strike', interval: 0.4, burst: 1, burstGap: 0, count: [3, 5], gap: 0.15, fan: 0, sweep: 0, speed: 0, range: 14, half: 0.075, pierce: [4, 6], chain: 0, homing: 0, out: 1,
    look: { shape: 'pillar', core: '255,255,250', glow: '255,226,150', mix: 0.2, len: 0, width: 0.13, flat: 1, halo: 1.8, haloLen: 1, hit: 'blast' } },
];

// 而家用緊嘅門檻：預設係上面表入面嘅 at（快檔）；慢、中兩檔由成長曲線推出嚟（data/column.js 嘅 useNumbers 會換）。
let AT = WEAPONS.map((w) => w.at);

/** 換門檻（一級一個數，一級高過一級）；唔填就用返表入面嘅。 */
export function setWeaponAt(list) { AT = list ? list.slice() : WEAPONS.map((w) => w.at); }

/** 第 i 級（0 起計）嘅門檻。 */
export const weaponAt = (i) => AT[Math.max(0, Math.min(i, AT.length - 1))];

/** 戰力 power 夠用第幾級武器（0 起計）；戰力未夠第一級門檻都當第一級。 */
export function weaponLevel(power) {
  let lv = 0;
  for (let i = 1; i < WEAPONS.length; i++) if (power >= AT[i]) lv = i;
  return lv;
}

const lerpRange = (v, k) => (Array.isArray(v) ? Math.min(v[1], v[0] + Math.floor((v[1] - v[0] + 1) * k)) : v);

/**
 * 呢個戰力而家手上把武器：第幾級、喺呢級入面行咗幾多（0–1）、而家每輪幾多粒、穿透幾多、連鎖幾多。
 * @returns {{ level: number, weapon: typeof WEAPONS[number], grow: number, count: number, pierce: number, chain: number }}
 */
export const armOf = (power) => armAt(weaponLevel(power), power);

/**
 * 手上係第 level 級武器、戰力 power：喺呢級入面行咗幾多、每輪幾多粒、穿透幾多、連鎖幾多。
 * （武器係一級一級升嘅，戰力可以暫時高過下一級門檻而武器未升——嗰陣當呢級行滿。）
 */
export function armAt(level, power) {
  const weapon = WEAPONS[level], at = AT[level];
  // 喺呢級入面行咗幾多：按量級（對數）計，去到下一級門檻就係 1；最後一級冇下一級，當每大十倍行完
  const top = level + 1 < AT.length && Number.isFinite(AT[level + 1]) ? AT[level + 1] : at * 10; // 下一級呢關升唔到（門檻無限大）都當每大十倍行完
  const grow = Math.max(0, Math.min(0.999, Math.log(Math.max(power, at) / at) / Math.log(top / at)));
  return { level, weapon, grow, count: lerpRange(weapon.count, grow), pierce: lerpRange(weapon.pierce, grow), chain: lerpRange(weapon.chain, grow) };
}

/** 每秒射幾多輪。 */
export const weaponRate = (w) => w.burst / w.interval;
