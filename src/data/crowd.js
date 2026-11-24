// 俯視玩法嘅全部數值、關卡同文字。改手感、改平衡只改呢個檔。
// 單位：橫向 x 由 −1（路面左邊）到 +1（路面右邊）；向前嘅距離 d 用同一把尺（1 = 半條路闊）。

export const CROWD = {
  /** 鏡頭：高角度俯視，透視好弱。 */
  view: {
    roadHalf: 0.46,      // 半條路闊佔畫面闊幾多（兩邊各留 4% 做路肩）
    squadY: 0.76,        // 隊伍中心喺畫面高度邊度
    perspective: 0.05,   // 透視強度：越遠縮得越細（畫面頂大約縮到八成二）；0 = 完全冇透視
    background: null,    // 之後換美術路面：填 ASSET_MANIFEST 嘅 key（一張可以上下接駁嘅俯視路面圖）；null = 程式畫
  },

  world: {
    scroll: 0.9,         // 世界每秒向下捲幾多（等速）
    spawnDistance: 4.5,  // 嘢喺幾遠出現（啱啱喺畫面頂外面）
    despawn: -0.9,       // 過咗隊伍幾遠就清走
  },

  /** 操作：手指撳住左右拖，隊伍跟住手指嘅橫向位置。 */
  control: {
    mode: 'follow',      // 'follow' = 跟手指位置；'drag' = 跟手指移動咗幾多（相對拖動）
    follow: 14,          // 追手指有幾快（每秒追返差距嘅幾多倍；越大越跟手）
    maxSpeed: 3.6,       // 隊伍橫移最快每秒幾多
    keySpeed: 1.7,       // 鍵盤左右鍵每秒移幾多
    edge: 0.3,           // 隊伍中心離路邊最少幾遠
    edgeBySize: 0.9,     // 人多嗰陣：隊伍中心離路邊最少係隊伍半徑嘅幾多倍（等成隊人留喺路面）
  },

  /**
   * 隊伍。而家係單人：隊員數目固定（startMembers），頭上嘅大數字係「戰力」，唔係人數。
   * 之後收集角色會開到最多 5 人（maxMembers）；多人隊形（螺旋排位、跟隨延遲、互相推開）嘅程式留喺度。
   */
  squad: {
    startPower: 1,       // 開場戰力
    startMembers: 1,     // 開場有幾多個隊員
    maxMembers: 1,       // 隊員上限（之後開到 5）
    drawCap: 60,         // 畫面最多畫幾多個人（多人複本嗰陣用）
    spacing: 0.12,       // 隊形疏密（第 i 個人離中心 spacing × √i）
    depthSquash: 0.8,    // 隊形前後壓扁幾多
    baseRadius: 0.12,    // 一個人佔嘅半徑（敵人、箱掂唔掂到用呢個）
    followNear: 13,      // 最入面嘅人跟得有幾快
    followFar: 6,        // 最外面嘅人跟得有幾快（慢啲 = 有拖尾）
    separation: 0.1,     // 兩個人近過呢個距離就互相推開
    popTime: 0.3,        // 新隊員彈出嚟用幾耐
    numberPop: 0.45,     // 戰力變嗰陣大數字跳幾耐
  },

  /** 射擊：自動向前射，一粒一粒。一輪幾多粒、穿唔穿透由形態決定（evolution.forms）。 */
  fire: {
    interval: 0.2,       // 幾耐射一輪（秒）
    speed: 5,            // 子彈每秒飛幾遠
    range: 4.2,          // 飛幾遠就消失（差唔多去到畫面頂）
    startD: 0.45,        // 子彈由主角前面幾遠起飛（約槍身中段；近過呢度嘅嘢射唔到，會掂到主角）
    muzzleBlend: 0.7,    // 純畫面：子彈離開槍口之後，飛幾遠先完全飄返入主角正前方嗰條線
    // 每粒子彈打敵人、箱、首領扣幾多血 = damageBase × 戰力^damagePower（戰力 1 → 1、50 → 7、200 → 14、1000 → 32）
    damageBase: 1,
    damagePower: 0.5,
    streamGap: 0.13,     // 一輪多過一粒：粒同粒橫向隔幾遠
    rapidMul: 0.5,       // 火力加成期間，射擊間隔乘幾多
  },

  /**
   * 門：一排兩三道，平分成條路。加 / 減數門可以射，每粒命中 +1，冇上限；乘 / 除數門射唔郁，子彈穿過。
   * 一道門加得幾多，靠射程（入到 shootRange 先射得郁）同射速（fire.interval、形態嘅 streams）自然限住。
   */
  gate: {
    shootRange: 4.0,
    hitTime: 0.1, popTime: 0.2, flipTime: 0.6,
  },

  /** 小敵人：一波波湧埋嚟。血量由關卡嗰一波定（× hpMul）。掂到主角：扣戰力，扣佢剩低嘅血（向上取整）。size = 佔畫面高度幾多。 */
  enemies: {
    grunt: { hpMul: 1, r: 0.07, speed: 0.35, homing: 0.3, size: 0.07, asset: 'enemy-drone', color: '255,120,90' },
    brute: { hpMul: 3, r: 0.09, speed: 0.25, homing: 0.22, size: 0.09, asset: 'enemy-walker', color: '255,90,160' },
  },

  /** 數字箱：射爆有獎；未射爆就撞上去，扣戰力嘅 crashLoss（最少 1），箱子冇咗。 */
  crate: {
    width: 0.36,
    crashLoss: 0.25,
    rapidTime: 5,        // 火力加成維持幾耐（秒）
  },

  /** 關尾首領：主角停喺佢面前射；佢每隔一陣打一下，扣戰力。 */
  boss: {
    stop: 1.5,           // 首領去到離隊伍幾遠就停（世界都停）
    halfWidth: 0.5,      // 子彈打得中嘅半闊
    attackEvery: 2.2,    // 幾耐打一下（秒）
    warnTime: 0.7,       // 出手前幾耐開始預警
    size: 0.3,           // 佔畫面高度幾多
  },

  /**
   * 進化：戰力去到門檻就升一個形態（共四個）。forms 第 0 個 = 未進化。
   *   streams 一輪射幾多粒；pierce 每粒可以穿過幾多隻敵人（0 = 唔穿）；
   *   color 主題色（光環、色調、子彈；null = 冇光環）；tint 人物染幾多主題色；bullet 子彈大細倍數
   * devolve：戰力跌返落門檻以下會唔會退化（true = 會；false = 升咗就唔跌）。
   * 每個形態之後有自己嘅跑步片：喺 data/assets.js 嘅 UNIT_SPRITE.forms 填。
   */
  evolution: {
    thresholds: [50, 200, 1000],
    devolve: true,
    showTime: 1.4,
    forms: [
      { name: '形態 I', streams: 1, pierce: 0, color: null, tint: 0, bullet: 1 },
      { name: '形態 II', streams: 2, pierce: 0, color: '95,240,255', tint: 0.1, bullet: 1.1 },
      { name: '形態 III', streams: 2, pierce: 2, color: '190,120,255', tint: 0.16, bullet: 1.5 },
      { name: '形態 IV', streams: 4, pierce: 3, color: '255,236,170', tint: 0.2, bullet: 1.5 },
    ],
  },

  /**
   * 主角嘅動態（純手感同畫面，唔影響勝負）。全部保持克制。
   */
  feel: {
    // 左右拖嗰陣傾身：橫移每秒 1 單位傾 perSpeed 弧度，最多 max；用彈簧追（stiffness、damping），放手會過少少頭再彈返正
    lean: { perSpeed: 0.075, max: 0.2, stiffness: 240, damping: 15, squash: 0.06 },
    // 射擊後座：每射一輪向後一頓 kick（× 主圖高度），recoilTime 秒內彈返；每升一個形態多 perForm 倍
    recoil: { kick: 0.014, time: 0.09, perForm: 0.35 },
    // 腳步：每次落地腳下一小團塵，跟路面向後流走
    steps: { life: 0.42, size: 0.045, alpha: 0.4, fallbackEvery: 0.24 },
    // 起伏：形態用靜態主圖（未有片）嗰陣，身體按腳步節奏上下郁 amp（× 主圖高度）。有片就唔加（片本身有）
    bob: { amp: 0.012 },
    // 貼地影：闊度（× 主圖高度）；身體喺半空嗰陣縮細 airShrink
    shadow: { width: 0.15, airShrink: 0.16 },
    // 受擊：閃紅白 time 秒、向後退 knock（× 主圖高度）、戰力數字抖 shake 像素
    hurt: { time: 0.28, knock: 0.05, shake: 5 },
    // 進化：慢動作 slowTime 秒（世界速度乘 slowScale）、主角放大彈一下 punch；橫額等慢動作完先出
    evolve: { slowTime: 0.3, slowScale: 0.25, punch: 0.22 },
    // 速度線：路面上幼細嘅流動紋；數量 count、透明度 alpha + 每個形態 alphaPerForm、快過路面 speedMul 倍
    speedLines: { count: 9, alpha: 0.05, alphaPerForm: 0.035, length: 0.3, lengthPerForm: 0.1, speedMul: 2.2 },
    // 橫移片（有先用）：橫移快過 speed 就淡入，fade 秒淡完
    strafe: { speed: 1.2, fade: 0.14 },
  },

  holdTime: { defeat: 1.4, clear: 1.8 },   // 輸 / 贏之後停幾耐先重開 / 入下一關
  bannerTime: 1.6,
};

/**
 * 關卡。timeline 嘅 at = 離起點幾遠。
 *   gates  一排門：gates 入面每道 { op: 'add' | 'sub' | 'mul' | 'div', val }
 *   swarm  一波敵人：n 隻，每隻 hp 血（大隻 × 3），以 x 為中心、左右鋪 width、前後鋪 depth；brutes = 入面有幾多隻大隻
 *   crate  數字箱：hp = 箱上面個數；reward = { type: 'add', n } 加戰力，或者 { type: 'rapid' } 短時間火力加成
 * boss：at = 喺幾遠；hp = 血量；hit = 每下扣幾多戰力
 */
export const CROWD_STAGES = [
  {
    id: 1,
    timeline: [
      { at: 3.0, type: 'gates', gates: [{ op: 'add', val: 3 }, { op: 'add', val: 1 }] },
      { at: 5.4, type: 'swarm', n: 5, hp: 1, x: 0.2, width: 0.5, depth: 0.5 },
      { at: 7.8, type: 'gates', gates: [{ op: 'add', val: 2 }, { op: 'div', val: 2 }, { op: 'mul', val: 2 }] },
      { at: 10.2, type: 'swarm', n: 10, hp: 2, x: -0.2, width: 0.6, depth: 0.7 },
      { at: 12.0, type: 'crate', x: -0.5, hp: 60, reward: { type: 'add', n: 15 } },
      { at: 13.8, type: 'gates', gates: [{ op: 'sub', val: 6 }, { op: 'add', val: 10 }] },
      { at: 16.2, type: 'swarm', n: 16, hp: 3, x: 0, width: 0.75, depth: 0.9, brutes: 2 },
      { at: 18.6, type: 'gates', gates: [{ op: 'mul', val: 2 }, { op: 'sub', val: 30 }, { op: 'div', val: 2 }] },
      { at: 21.0, type: 'swarm', n: 22, hp: 5, x: 0.2, width: 0.8, depth: 1.0, brutes: 3 },
      { at: 22.8, type: 'crate', x: 0.45, hp: 300, reward: { type: 'rapid' } },
      { at: 24.6, type: 'gates', gates: [{ op: 'div', val: 3 }, { op: 'add', val: 120 }] },
      { at: 27.0, type: 'swarm', n: 28, hp: 8, x: -0.1, width: 0.85, depth: 1.2, brutes: 4 },
      { at: 29.4, type: 'gates', gates: [{ op: 'sub', val: 80 }, { op: 'div', val: 2 }, { op: 'mul', val: 3 }] },
      { at: 31.8, type: 'swarm', n: 34, hp: 12, x: 0, width: 0.9, depth: 1.4, brutes: 5 },
    ],
    boss: { at: 36, hp: 6000, hit: 60 },
  },
];

/** 超出已編排嘅關卡：用最後一關做底，敵人每關多一成半、首領血每關多一成。試玩版只係等過關之後有嘢繼續打，未認真編排。 */
export function crowdStage(no) {
  const last = CROWD_STAGES.length, base = CROWD_STAGES[Math.min(no, last) - 1], k = Math.max(0, no - last);
  if (!k) return base;
  return {
    id: no,
    timeline: base.timeline.map((it) => (it.type === 'swarm' ? { ...it, n: Math.round(it.n * (1 + 0.15 * k)) } : it)),
    boss: { ...base.boss, hp: Math.round(base.boss.hp * (1 + 0.1 * k)) },
  };
}

/** 玩家睇到嘅字。 */
export const CROWD_TEXT = {
  stage: (no) => `關卡 ${String(no).padStart(2, '0')}`,
  defeat: '全滅！再嚟一次',
  clear: '過關！',
  evolve: (name) => `進化！${name}`,
  devolve: '退化',
  power: '戰力',
  rapid: '火力全開',
  flip: '逆轉！',
  boss: '首領',
};
