// 養成同招募嘅數值表（041 第三部分）。全部貨幣同素材只可以喺遊戲入面賺，冇真錢。
// 改數值淨係改呢個檔；計算喺 src/meta/growth.js。加新角色：角色表（characters.js）加一個，再喺呢度嘅 STAR_EFFECTS、SKILLS 各加一項就得，招募池自動包埋。

/** 貨幣同素材。rarity = 稀有度色（0 普通 … 4 傳說，見 ui/theme.js）。 */
export const ITEMS = {
  gold: { name: '金幣', icon: 'coin', rarity: 1, note: '基地升級、角色升級都要用。' },
  gem: { name: '晶石', icon: 'gem', rarity: 3, note: '稀有貨幣：首次通關、三星、任務同成就會送，用嚟招募。' },
  exp: { name: '訓練數據', icon: 'exp', rarity: 1, note: '角色升級同技能升級用嘅經驗素材，打關就有。' },
  core: { name: '突破核心', icon: 'core', rarity: 2, note: '角色每 10 級要突破一次，第 3 關起會掉。' },
  ticket: { name: '招募券', icon: 'ticket', rarity: 3, note: '一張招募一次。' },
  shard: { name: '碎片', icon: 'shard', rarity: 3, note: '同一個角色嘅碎片儲夠就升星。' },
  wild: { name: '萬能碎片', icon: 'wild', rarity: 4, note: '邊個角色升星都用得：自己嘅碎片唔夠就用佢補。任務、成就、簽到、無盡模式、商店都有。' },
};

/**
 * 角色等級：1 至 60。每升一級要金幣加訓練數據；去到 10、20、30、40、50 級要先突破（突破核心加金幣）先升得上去。
 * 效果：隊長每級開局戰力 +1.5%；隊員每級輸出 +1%（都係由第 2 級起計）。
 */
export const LEVEL = {
  max: 60, step: 10,
  exp: (lv) => 10 + 6 * lv + Math.floor(lv * lv * 0.25),   // 由 lv 升上 lv + 1 要幾多訓練數據
  gold: (lv) => 5 + 3 * lv,                                // 同埋幾多金幣（平：金幣主要留畀基地，等級主要食訓練數據）
  breakCore: [4, 8, 14, 22, 32], breakGold: [100, 300, 700, 1500, 3000], // 第 1 至 5 次突破
  leaderPower: 0.015, mateShare: 0.01,
};

/** 星級：1 至 5。shards[k] = 由 k 星升上 k + 1 星要幾多碎片。招募抽到已經有嘅角色：變 dupe 塊碎片。 */
export const STAR = { max: 5, shards: [0, 10, 20, 40, 80], dupe: 30 };

/** 技能等級：1 至 10（爆發技同被動各自計）。由 lv 升上 lv + 1 嘅成本。 */
export const SKILL = { max: 10, gold: (lv) => Math.round(60 * lv ** 1.6), exp: (lv) => 40 * lv };

/**
 * 每個角色 2 至 5 星嘅效果。mod 係加落戰鬥數值嘅改動（鍵嘅意思見 meta/growth.js 嘅 charStats）：
 *   隊長：power 開局戰力（加幾多成）、burstTime 爆發時間（加幾多秒）、charge 爆發槽儲得快幾多成
 *   隊員：share 輸出（加幾多成）、pierce 穿透（加幾多隻）、half 命中闊度（乘幾多）、near 貼身加成（加幾多）、guardEvery 光盾充能（加幾多秒，負數 = 快咗）、
 *         guardWindow 擋下之後無敵（加幾多秒）、blastHalf 爆炸闊度（乘幾多）、blastRows 爆炸深度（加幾多行）、droneRate 無人機射速（乘幾多）、burstMul 接力時全隊射速倍率（加幾多）
 */
export const STAR_EFFECTS = {
  falcon: [
    { star: 2, text: '開局戰力 +10%', mod: { power: 0.1 } },
    { star: 3, text: '爆發時間 +1 秒', mod: { burstTime: 1 } },
    { star: 4, text: '爆發槽儲得快 15%', mod: { charge: 0.15 } },
    { star: 5, text: '開局戰力再 +25%', mod: { power: 0.25 } },
  ],
  suzu: [
    { star: 2, text: '輸出 +10%', mod: { share: 0.1 } },
    { star: 3, text: '子彈穿透：每粒打倒 2 隻', mod: { pierce: 1 } },
    { star: 4, text: '輸出再 +15%', mod: { share: 0.15 } },
    { star: 5, text: '接力爆發時全隊射速倍率 +0.25', mod: { burstMul: 0.25 } },
  ],
  kiri: [
    { star: 2, text: '輸出 +10%', mod: { share: 0.1 } },
    { star: 3, text: '刀氣變寬 60%', mod: { half: 1.6 } },
    { star: 4, text: '貼身加成 +50%', mod: { near: 0.5 } },
    { star: 5, text: '接力爆發時全隊射速倍率 +0.25', mod: { burstMul: 0.25 } },
  ],
  tate: [
    { star: 2, text: '光盾充能快 1 秒', mod: { guardEvery: -1 } },
    { star: 3, text: '輸出 +25%', mod: { share: 0.25 } },
    { star: 4, text: '擋下之後無敵時間 +0.4 秒', mod: { guardWindow: 0.4 } },
    { star: 5, text: '光盾充能再快 2 秒', mod: { guardEvery: -2 } },
  ],
  akari: [
    { star: 2, text: '爆炸範圍闊 20%', mod: { blastHalf: 1.2 } },
    { star: 3, text: '無人機射速加倍', mod: { droneRate: 2 } },
    { star: 4, text: '輸出 +15%', mod: { share: 0.15 } },
    { star: 5, text: '爆炸向後多冚 2 行', mod: { blastRows: 2 } },
  ],
};

/**
 * 每個角色兩個技能：burst 爆發技（隊員 = 接力嗰一段）、passive 被動。per = 每升一級（由第 2 級起）加幾多，鍵同 STAR_EFFECTS 嘅 mod 一樣；
 * text(v) = 而家合共加咗幾多（v）嗰句說明。
 */
export const SKILLS = {
  falcon: {
    burst: { per: { burstTime: 0.15 }, text: (v) => `爆發時間 +${v.toFixed(2)} 秒` },
    passive: { name: '蓄能迴路', per: { charge: 0.03 }, text: (v) => `爆發槽儲得快 ${Math.round(v * 100)}%` },
  },
  suzu: {
    burst: { per: { burstMul: 0.02 }, text: (v) => `接力時全隊射速倍率 +${v.toFixed(2)}` },
    passive: { name: '快手', per: { share: 0.02 }, text: (v) => `輸出 +${Math.round(v * 100)}%` },
  },
  kiri: {
    burst: { per: { burstMul: 0.02 }, text: (v) => `接力時全隊射速倍率 +${v.toFixed(2)}` },
    passive: { name: '居合', per: { near: 0.06 }, text: (v) => `貼身加成 +${Math.round(v * 100)}%` },
  },
  tate: {
    burst: { per: { burstMul: 0.02 }, text: (v) => `接力時全隊射速倍率 +${v.toFixed(2)}` },
    passive: { name: '堅守', per: { guardEvery: -0.15 }, text: (v) => `光盾充能快 ${Math.abs(v).toFixed(2)} 秒` },
  },
  akari: {
    burst: { per: { burstMul: 0.02 }, text: (v) => `接力時全隊射速倍率 +${v.toFixed(2)}` },
    passive: { name: '加料裝藥', per: { share: 0.02 }, text: (v) => `輸出 +${Math.round(v * 100)}%` },
  },
};

/**
 * 招募。一次 = 1 張招募券或者 gem 粒晶石；十連 = 十次，保證最少一個「史詩」或以上。
 * 連續 pity 次冇出「傳說」，下一次必出。機率喺招募畫面寫明（由呢個表直接讀）。
 *   傳說：整個角色（五個入面隨機一個）。未有嘅角色即刻入隊；已經有嘅變 STAR.dupe 塊嗰個角色嘅碎片。
 *   史詩：某個角色嘅碎片 × shard.n。  稀有、精良：素材同金幣（pick 入面平均揀一樣）。
 */
export const GACHA = {
  gem: 100, ten: 10, pity: 30, tenFloor: 3,
  tiers: [
    { rarity: 4, name: '傳說', p: 0.03, kind: 'char' },
    { rarity: 3, name: '史詩', p: 0.17, kind: 'shard', n: 5 },
    { rarity: 2, name: '稀有', p: 0.35, kind: 'item', pick: [{ item: 'core', n: 2 }, { item: 'exp', n: 80 }] },
    { rarity: 1, name: '精良', p: 0.45, kind: 'item', pick: [{ item: 'gold', n: 300 }, { item: 'exp', n: 25 }] },
  ],
};

/**
 * 關卡掉落（n = 第幾關）。
 *   replay   每次過關都有：訓練數據、突破核心（第 3 關起）。輸咗：照行到幾遠攞 lose[0] 至 lose[1] 成（核心冇）。
 *   first    第一次過關另外送：晶石，同埋某幾關嘅招募券。
 *   stars    第一次攞到第 1／2／3 粒星各送一次。
 */
export const DROPS = {
  replay: (n) => [{ item: 'exp', n: 30 + 20 * n }, ...(n >= 3 ? [{ item: 'core', n: Math.floor((n + 1) / 3) }] : [])],
  lose: [0.2, 0.6],
  first: (n) => [{ item: 'gem', n: 50 }, ...(FIRST_TICKETS[n] ? [{ item: 'ticket', n: FIRST_TICKETS[n] }] : [])],
  stars: (n) => [[{ item: 'exp', n: 40 * n }], [{ item: 'core', n: 1 + Math.floor(n / 3) }], [{ item: 'gem', n: 20 }]],
};
const FIRST_TICKETS = { 2: 1, 3: 2, 4: 1, 5: 2, 6: 1, 7: 2, 8: 1, 9: 2, 10: 3, 11: 1, 12: 2, 13: 1, 14: 2, 15: 3, 16: 1, 17: 2, 18: 1, 19: 2, 20: 5 };
/** 困難模式：重打掉落 × HARD.drop（data/campaign.js），首次過關另外送萬能碎片。 */
export const HARD_FIRST = (n) => [{ item: 'gem', n: 30 }, { item: 'wild', n: 2 + Math.floor(n / 5) }];

/**
 * 連敗支援（拉順難度用）：同一關每輸一次，下次打呢關開局戰力 +per，最多疊 max 次；一過關就清。
 * 噉樣差少少過唔到嘅玩家，最多試幾次就一定過到，唔會卡死喺一關。
 */
export const RALLY = { per: 0.1, max: 5 };

