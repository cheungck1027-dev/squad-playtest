// 每日內容同長期目標嘅數值表（041 第四部分）：每日任務、成就、七日簽到、離線收益、信箱、商店、無盡模式嘅每週階段獎勵。
// 全部獎勵只係遊戲入面嘅貨幣同素材；冇真錢、冇連網，日期用本機時間。計算喺 src/meta/live.js。
// 獎勵寫法同 data/growth.js 一樣：{ item, n }；item 可以係 gold / gem / exp / core / ticket / wild（萬能碎片：邊個角色升星都用得）。

/**
 * 每日任務池。每日由上而下揀頭 MISSION_COUNT 個「已經解鎖」嘅（needs = 要邊個系統開咗先會出，對應 data/story.js 嘅 UNLOCKS）。
 * stat = 睇邊個統計數（meta/live.js 嘅 bump）；kind 'max' = 睇今日最高（例如無盡去到第幾波），其餘係今日累計。
 */
export const MISSION_COUNT = 6;
export const MISSIONS = [
  { id: 'play', name: '出擊 3 次', stat: 'plays', need: 3, rewards: [{ item: 'gold', n: 200 }, { item: 'exp', n: 100 }] },
  { id: 'clear', name: '通過 2 關', stat: 'clears', need: 2, rewards: [{ item: 'gold', n: 300 }, { item: 'exp', n: 150 }] },
  { id: 'kills', name: '打低 600 隻敵人', stat: 'kills', need: 600, rewards: [{ item: 'exp', n: 200 }] },
  { id: 'burst', name: '放 4 次爆發技', stat: 'bursts', need: 4, rewards: [{ item: 'gem', n: 15 }] },
  { id: 'level', name: '角色升級 3 次', stat: 'levels', need: 3, needs: 'team', rewards: [{ item: 'gold', n: 300 }, { item: 'core', n: 1 }] },
  { id: 'pull', name: '招募 1 次', stat: 'pulls', need: 1, needs: 'gacha', rewards: [{ item: 'exp', n: 200 }, { item: 'core', n: 1 }] },
  { id: 'shop', name: '喺商店換 1 樣嘢', stat: 'buys', need: 1, needs: 'shop', rewards: [{ item: 'gem', n: 15 }] },
  { id: 'endless', name: '無盡模式去到第 3 波', stat: 'endlessWave', kind: 'max', need: 3, needs: 'endless', rewards: [{ item: 'gem', n: 20 }, { item: 'wild', n: 2 }] },
  { id: 'boss', name: '打低 2 隻首領', stat: 'bosses', need: 2, rewards: [{ item: 'gold', n: 300 }] },
  { id: 'stars', name: '攞到 3 粒新嘅星', stat: 'newStars', need: 3, rewards: [{ item: 'gem', n: 15 }] },
];
/** 六個任務全部做完嘅額外寶箱。 */
export const DAILY_CHEST = [{ item: 'gem', n: 50 }, { item: 'ticket', n: 1 }, { item: 'wild', n: 5 }];

/**
 * 成就：長期目標，分類顯示，有進度條。stat = 統計數或者推算出嚟嘅數（meta/live.js 嘅 statValue）。
 */
export const ACH_GROUPS = { story: '主線', battle: '戰鬥', growth: '養成', recruit: '招募', endless: '無盡', daily: '日常' };
const A = (id, group, name, stat, need, rewards) => ({ id, group, name, stat, need, rewards });
const gem = (n) => ({ item: 'gem', n }), wild = (n) => ({ item: 'wild', n }), ticket = (n) => ({ item: 'ticket', n }), core = (n) => ({ item: 'core', n }), gold = (n) => ({ item: 'gold', n });
export const ACHIEVEMENTS = [
  A('sa', 'story', '通過第 3 關', 'cleared', 3, [gem(30), wild(5)]),
  A('sb', 'story', '通過第 7 關', 'cleared', 7, [gem(50), wild(10)]),
  A('sc', 'story', '通過第 10 關', 'cleared', 10, [gem(80), wild(15)]),
  A('sd', 'story', '通過第 15 關', 'cleared', 15, [gem(100), wild(15)]),
  A('se', 'story', '通過第 20 關', 'cleared', 20, [gem(150), wild(20), ticket(3)]),
  A('st', 'story', '合共攞到 20 粒星', 'stars', 20, [gem(40), wild(5)]),
  A('su', 'story', '合共攞到 40 粒星', 'stars', 40, [gem(60), wild(10)]),
  A('sv', 'story', '合共攞到 60 粒星', 'stars', 60, [gem(120), wild(20)]),
  A('ha', 'story', '困難模式通過 5 關', 'hardCleared', 5, [gem(80), wild(10)]),
  A('hb', 'story', '困難模式通過 20 關', 'hardCleared', 20, [gem(200), wild(30)]),
  A('ba', 'battle', '打低 2,000 隻敵人', 'kills', 2000, [gold(500), core(2)]),
  A('bb', 'battle', '打低 20,000 隻敵人', 'kills', 20000, [gem(50), core(5)]),
  A('bc', 'battle', '打低 100,000 隻敵人', 'kills', 100000, [gem(100), wild(10)]),
  A('bd', 'battle', '放 20 次爆發技', 'bursts', 20, [gem(30)]),
  A('be', 'battle', '放 150 次爆發技', 'bursts', 150, [gem(80), wild(5)]),
  A('bf', 'battle', '打低 10 隻首領', 'bosses', 10, [gem(40)]),
  A('bg', 'battle', '打低 60 隻首領', 'bosses', 60, [gem(80), wild(10)]),
  A('ga', 'growth', '角色升級合共 20 次', 'levels', 20, [gem(30), core(3)]),
  A('gb', 'growth', '角色升級合共 80 次', 'levels', 80, [gem(60), wild(10)]),
  A('gc', 'growth', '角色升級合共 200 次', 'levels', 200, [gem(120), wild(15)]),
  A('gd', 'growth', '有角色升到 3 星', 'maxStar', 3, [gem(50), wild(10)]),
  A('ge', 'growth', '有角色升到 5 星', 'maxStar', 5, [gem(150), ticket(5)]),
  A('gf', 'growth', '技能升級合共 15 次', 'skills', 15, [gem(40), core(4)]),
  A('gg', 'growth', '有角色去到 30 級', 'maxLevel', 30, [gem(80), wild(10)]),
  A('ra', 'recruit', '招募 10 次', 'pulls', 10, [ticket(2)]),
  A('rb', 'recruit', '招募 50 次', 'pulls', 50, [ticket(5), wild(10)]),
  A('rc', 'recruit', '五個隊員全部入隊', 'owned', 5, [gem(100), wild(10)]),
  A('ea', 'endless', '無盡模式去到第 4 波', 'endlessBest', 4, [gem(40), wild(5)]),
  A('eb', 'endless', '無盡模式去到第 8 波', 'endlessBest', 8, [gem(80), wild(10)]),
  A('ec', 'endless', '無盡模式去到第 12 波', 'endlessBest', 12, [gem(150), wild(20)]),
  A('da', 'daily', '累計簽到 7 日', 'logins', 7, [gem(60), ticket(2)]),
  A('db', 'daily', '完成 30 個每日任務', 'missions', 30, [gem(100), wild(10)]),
];

/** 七日簽到：連續第 1 至 7 日嘅獎勵（第 7 日大獎）；斷咗就由第 1 日再嚟，行完七日又返去第 1 日。 */
export const LOGIN = [
  [gold(300), { item: 'exp', n: 200 }],
  [gem(30)],
  [ticket(1), core(2)],
  [gem(40), { item: 'exp', n: 400 }],
  [wild(5), gold(600)],
  [gem(60), core(4)],
  [wild(30), ticket(3), gem(100)],
];

/**
 * 離線收益：過咗第 1 關之後，離開遊戲期間每小時累積金幣同訓練數據（照過咗幾多關），最多儲 cap 小時；儲夠 min 分鐘先領得。
 */
export const OFFLINE = { cap: 8, min: 5, gold: (cleared) => 40 + 30 * cleared, exp: (cleared) => 20 + 14 * cleared };

/**
 * 信箱：系統發嘅獎勵同通知。when = 幾時發（meta/live.js 嘅 mailDue 判斷）：start 第一次入大廳；cleared N 第一次過咗第 N 關；login7 第一次簽滿七日。
 */
export const MAILS = [
  { id: 'welcome', title: '歡迎加入數字突擊隊', text: '指揮官，歡迎上任。這是一點見面禮，祝武運昌隆。', when: { start: true }, rewards: [ticket(3), gem(100), { item: 'exp', n: 300 }] },
  { id: 'half', title: '第三章完結賀禮', text: '「蝕」的第一個源頭熄滅了。隊員們託我把這份心意交給你。', when: { cleared: 10 }, rewards: [gem(150), wild(15), ticket(2)] },
  { id: 'full', title: '主線通關賀禮', text: '零點已經清除。困難模式開放了，更強的對手在等著你。', when: { cleared: 20 }, rewards: [gem(300), wild(30), ticket(5)] },
  { id: 'week', title: '七日全勤', text: '連續七天都來報到，辛苦了。隊長說要請你喝汽水。', when: { login7: true }, rewards: [gem(100), wild(10)] },
  { id: 'endless', title: '無盡模式開放', text: '訓練場新設了無盡模擬戰，每週都有階段獎勵，記得去挑戰。', when: { cleared: 5 }, rewards: [gem(50), core(3)] },
];

/**
 * 商店。常駐貨架 goods：每日限買 limit 次；每日特價 deals：每日照日期抽 DEAL_SLOTS 格，比常駐平（off = 平幾多成），各限買一次。
 * pay = 用乜買（gold / gem）；冇真錢，畫面只會出現遊戲貨幣嘅圖示同數量。
 */
export const DEAL_SLOTS = 3;
export const SHOP = {
  goods: [
    { id: 'exps', give: { item: 'exp', n: 300 }, pay: 'gold', cost: 500, limit: 5 },
    { id: 'expl', give: { item: 'exp', n: 1500 }, pay: 'gem', cost: 60, limit: 3 },
    { id: 'core', give: { item: 'core', n: 3 }, pay: 'gold', cost: 900, limit: 3 },
    { id: 'tick', give: { item: 'ticket', n: 1 }, pay: 'gem', cost: 90, limit: 5 },
    { id: 'wild', give: { item: 'wild', n: 5 }, pay: 'gem', cost: 120, limit: 2 },
    { id: 'gold', give: { item: 'gold', n: 1500 }, pay: 'gem', cost: 50, limit: 3 },
  ],
  deals: [
    { id: 'dtick', give: { item: 'ticket', n: 3 }, pay: 'gem', cost: 270, off: 0.3 },
    { id: 'dwild', give: { item: 'wild', n: 10 }, pay: 'gem', cost: 240, off: 0.4 },
    { id: 'dcore', give: { item: 'core', n: 8 }, pay: 'gold', cost: 2400, off: 0.4 },
    { id: 'dexp', give: { item: 'exp', n: 2000 }, pay: 'gold', cost: 3200, off: 0.5 },
    { id: 'dshard', give: { item: 'shard', n: 8 }, pay: 'gem', cost: 260, off: 0.4, pickChar: true }, // 指定角色碎片：邊個角色照日期輪
    { id: 'dgold', give: { item: 'gold', n: 4000 }, pay: 'gem', cost: 130, off: 0.4 },
  ],
};

/**
 * 無盡模式：每局打完照去到第幾波有金幣同訓練數據；每週（星期一起計，本機日期）照「本週最高波數」領階段獎勵，各領一次。
 */
export const ENDLESS_RUN = { gold: (wave) => 120 * wave, exp: (wave) => 80 * wave };
export const ENDLESS_TIERS = [
  { wave: 2, rewards: [gold(500), { item: 'exp', n: 300 }] },
  { wave: 4, rewards: [gem(40), core(3)] },
  { wave: 6, rewards: [wild(10), gem(40)] },
  { wave: 8, rewards: [ticket(2), gem(60)] },
  { wave: 10, rewards: [wild(20), gem(80)] },
  { wave: 13, rewards: [ticket(5), wild(30), gem(150)] },
];
/** 本機紀錄榜留幾多條。 */
export const RECORDS = 8;
