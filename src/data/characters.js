// 六個角色。加角色只需要喺呢度加一筆資料（同埋喺 data/assets.js 登記佢嘅圖）。

import { LEADER_GROUND_CLIP, UNIT_SPRITE } from './assets.js';

/**
 * 連鎖技三段：起 → 承 → 決，行完入 OVERDRIVE。（連鎖技本身未實作，而家只有資料。）
 * @typedef {'qi' | 'cheng' | 'jue'} ChainStage
 */
export const CHAIN_STAGES = {
  qi:    { id: 'qi',    label: '起', order: 1 },
  cheng: { id: 'cheng', label: '承', order: 2 },
  jue:   { id: 'jue',   label: '決', order: 3 },
};

/**
 * @typedef {Object} CharacterDef
 * @property {string} id
 * @property {number} number        隊員編號（No.07 → 7）
 * @property {string} callsign      代號
 * @property {string} style         戰鬥風格，對應 data/styles.js 嘅 id
 * @property {string} [weapon]      風格之下嘅武器變化（例如 gun 嘅 rifle / sniper）
 * @property {ChainStage} chain     連鎖技負責邊一段
 * @property {import('./gates.js').GateRule} gateRule  被動「門規則」
 * @property {string} gateRuleText  俾玩家睇嘅規則說明
 * @property {{ battleBack: string, clip?: string, actions?: Record<string, string>, motion?: Motion, forms?: { clip?: string, still?: string }[], muzzleFlash?: string }} assets
 *   素材 key：battleBack = 背面靜態圖（data/assets.js 嘅 ASSET_MANIFEST）；clip = 預設動畫片段（CLIP_MANIFEST）；
 *   actions = 分動作嘅片段（動作名 → CLIP_MANIFEST 嘅 key；動作名見 battle/actions.js）。
 *   有 actions 就按狀態切換動作片；邊個動作冇片就用優先次序低一級嘅，全部冇就用 clip。
 *   motion = 「地面跑、執到飛行核心先飛」嘅角色用嘅一組片（見下面 Motion）；有呢個就唔用 actions。
 * @property {{ height: number, muzzle: [number, number], muzzleFlight?: [number, number], scale?: number, runs?: boolean, footDrop?: number, shiftX?: number, reach?: [number, number], flashFilter?: string, glow: string }} battle
 *   戰鬥畫面：muzzle = 槍口位置（相對立繪高度，[向右, 向上]）；muzzleFlight = 飛行時嘅槍口位置；
 *   scale = 畫出嚟再放大幾多（唔填 = 1）；runs = 平時喺地面跑（冇腳底推進器光、路面跟腳步流動）；
 *   reach = 做隊長時身體（連頭髮）向左、向右伸出幾多（× 立繪高度）：喺邊線車道用嚟將佢推返入畫面；
 *   glow = 腳底推進器光嘅顏色（R,G,B）
 * @property {boolean} playable     而家有冇齊素材同玩法可以出場
 */

/**
 * 地面 / 飛行兩種狀態嘅片（全部係 CLIP_MANIFEST 嘅 key）。邊條播由 battle/actions.js 嘅 motionClip 決定。
 * @typedef {Object} Motion
 * @property {string} run          地面跑步（循環）
 * @property {string} glide        飛行巡航（循環）
 * @property {string} fire         飛行連射
 * @property {string} overdrive    飛行超載（播一次）
 * @property {string} flightStill  飛行主圖（ASSET_MANIFEST 嘅 key；飛行片未準備好嗰陣用）
 */

/** @type {Record<string, CharacterDef>} */
export const CHARACTERS = {
  falcon: {
    id: 'falcon', number: 7, callsign: '隼',
    style: 'gun', weapon: 'rifle', chain: 'jue',
    gateRule: { type: 'mulGateBonus', value: 0.2 },
    gateRuleText: '乘數門倍數 +0.2',
    assets: {
      battleBack: 'falcon-run-master', clip: 'falcon-run', muzzleFlash: 'muzzle-flash',
      // 飛行用嘅一組片（舊造型；tuning 嘅 flight.enabled 關咗就唔用，淨係播 clip 嗰條跑步片）
      motion: { run: 'falcon-run', glide: 'falcon-glide', fire: 'falcon-fire', overdrive: 'falcon-overdrive', flightStill: 'falcon-fly-master' },
      // 進化形態（第 0 個 = 未進化）。而家全部用同一條跑步片、靠程式效果分形態；
      // 之後某個形態有成套造型片，就喺嗰格填 clip（CLIP_MANIFEST 嘅 key）同 still（ASSET_MANIFEST 嘅 key）。
      forms: [{}, {}, {}, {}],
    },
    // 而家條片同單主角版形態 I 同一條（新服裝），所以對位用返嗰條片量好嘅數（assets.js 嘅 UNIT_SPRITE）：
    // scale 1.24：人物本身（頭頂至鞋底 = 主圖高嘅 bodyFraction 0.749）照舊約佔畫面 26%，即主圖高 34.7%
    // footDrop：主圖底邊喺路面線下面幾多（× 主圖高度）；shiftX：主圖中線喺兩腳中間右邊幾多（× 主圖高度）
    // muzzle：冇片播嗰陣嘅槍口位置；有片就逐格跟片源（assets.js 嘅 LEADER_GROUND_CLIP）。子彈由槍口飛出
    battle: { height: 0.4, scale: 1.24, runs: true, footDrop: UNIT_SPRITE.footDrop, shiftX: UNIT_SPRITE.shiftX, reach: [0.14, 0.14], muzzle: LEADER_GROUND_CLIP.muzzle, muzzleFlight: [0.154, 0.79], flashFilter: 'hue-rotate(150deg) brightness(1.2)', glow: '95,240,255' },
    playable: true,
  },
  bell: {
    id: 'bell', number: 12, callsign: '鈴',
    style: 'blade', chain: 'qi',
    // 「額外 POWER」嘅份量未定，0.25（多 25%）係暫定值。
    gateRule: { type: 'addGateBonus', value: 0.25 },
    gateRuleText: '通過加數門時額外獲得 POWER',
    assets: { battleBack: 'suzu-battle-back', clip: 'suzu-attack' },
    battle: { height: 0.4, muzzle: [0.2, 0.3], glow: '255,170,70' },
    playable: true,
  },
  bulwark: {
    id: 'bulwark', number: 3, callsign: '楯',
    style: 'shield', chain: 'cheng',
    gateRule: { type: 'subGateCostScale', value: 0.5 },
    gateRuleText: '減數門扣減減半',
    assets: { battleBack: 'tate-battle-back', clip: 'tate-attack' },
    battle: { height: 0.4, muzzle: [0, 0.6], glow: '120,160,230' },
    playable: true,
  },
  mist: {
    id: 'mist', number: 21, callsign: '霧',
    style: 'gun', weapon: 'sniper', chain: 'jue',
    gateRule: { type: 'gateShootRaise', value: 0.5 },
    gateRuleText: '射擊門時數值上升快 50%',
    assets: { battleBack: 'kiri-battle-back', clip: 'kiri-attack', muzzleFlash: 'muzzle-flash' },
    battle: { height: 0.4, muzzle: [0.06, 0.88], flashFilter: 'hue-rotate(60deg) brightness(1.2)', glow: '90,220,140' },
    playable: true,
  },
  lantern: {
    id: 'lantern', number: 9, callsign: '燈',
    style: 'drones', chain: 'cheng',
    gateRule: { type: 'overdriveExtend', value: 2 },
    gateRuleText: 'OVERDRIVE 延長 2 秒',
    assets: { battleBack: 'akari-battle-back', clip: 'akari-attack' },
    battle: { height: 0.4, muzzle: [0, 0.6], glow: '255,225,90' },
    playable: true,
  },
  abacus: {
    id: 'abacus', number: 15, callsign: '算',
    style: 'formula', chain: 'qi',
    gateRule: { type: 'divGateCostScale', value: 0.5 },
    gateRuleText: '除數門損失減半',
    assets: { battleBack: 'san-battle-back', clip: 'san-attack' },
    battle: { height: 0.4, muzzle: [-0.12, 0.7], glow: '255,90,200' },
    playable: true,
  },
};

/**
 * 預設小隊：第一個係隊長，其餘按陣形位置排（左翼、右後、右翼、左後，全部喺隊長身後，見 tuning.js 嘅 squad.slots）。
 * 未有選隊畫面；想換人可以用網址參數 ?squad=falcon,mist,bulwark,lantern,abacus
 * 或者主控台 __game.restart({ squad: [...] })。
 */
export const DEFAULT_SQUAD = ['falcon', 'bell', 'bulwark', 'lantern', 'abacus'];

/** 一隊最多幾多人（陣形得五個位）。 */
export const MAX_SQUAD = 5;

/**
 * @param {string} id
 * @returns {CharacterDef}
 */
export function getCharacter(id) {
  const c = CHARACTERS[id];
  if (!c) throw new Error(`未知角色：${id}`);
  return c;
}

// ---------- 十關版嘅角色表（2026-11-24，039；040 加鈴同霧）：大廳嘅看板角色、隊員頁、角色詳情、戰鬥頭像、爆發技、隊員嘅戰鬥數值 ----------
// 之後加角色：喺 ROSTER 加一筆（立繪、對白、段位、戰鬥數值），再喺 data/lead3d.js 嘅 MATE_3D 填佢嘅模型同武器，其餘畫面自己會出。

const GAME_ROOT = new URL('../../', import.meta.url);
const pic = (file) => new URL(`assets/${file}`, GAME_ROOT).href;

/**
 * @typedef {Object} RosterEntry
 * @property {string} id
 * @property {string} name        名
 * @property {string} title       稱號（大廳名牌細字）
 * @property {string} role        武器 · 定位
 * @property {ChainStage} chain   爆發鏈負責邊一段（起／承／決）
 * @property {boolean} leader     係咪隊長（隊長企中間、形態會進化）
 * @property {number} joinAfter   過咗第幾關入隊（0 = 一開始就喺度）
 * @property {number} forms       有幾多個形態（隊員得 1 個）
 * @property {(form: number) => string} portrait  第 form 個形態（0 起計）嘅正面立繪網址
 * @property {[string, string][]} [faces]  逐個形態嘅頭像裁切位（隊長：形態 I 係新立繪、其餘係舊立繪，位唔同）；冇就全部用 face
 * @property {[string, string]} face  頭像點由立繪裁出嚟：[放大幾多（CSS background-size）, 位置（background-position）]——換立繪要跟住改
 * @property {[number, number]} cutin  接力特寫裁立繪邊一截：[由幾高開始, 裁幾高]（都係立繪高度嘅比例）
 * @property {boolean} cutout     立繪有冇透明底（冇：畫面用漸變遮罩淡出四邊）
 * @property {string} color       主題色 'r,g,b'
 * @property {{ name: string, note: string }} burst  爆發技（隊長）／接力嗰一段（隊員）嘅名同說明
 * @property {string} intro       角色簡介
 * @property {string} weaponNote  武器同打法說明（隊員；隊長睇武器線）
 * @property {string} joinLine    入隊畫面講嘅一句
 * @property {string[]} lines     大廳對白（每次返大廳隨機一句，撳角色換下一句）
 * @property {MateBattle | null} battle  隊員嘅戰鬥數值（隊長 = null，用武器表）
 */

/**
 * 隊員嘅戰鬥數值。每秒輸出 = 隊長而家戰力 ÷ 4 × share（隊長自己係 戰力 ÷ 4 × 武器嘅 out），平均分落每一下；打方陣就係一下倒幾多隻。
 * @typedef {Object} MateBattle
 * @property {number} slot      企位（COLUMN.team.slots 第幾個：0 左後、1 右後、2 左外、3 右外）
 * @property {'gun' | 'blade' | 'lob'} kind  gun = 一粒粒細子彈；blade = 一道道刀氣；lob = 拋物線榴彈，落地範圍爆炸
 * @property {number} [burst]   點射：一輪連出幾多下（每輪相隔 interval，輪入面每下相隔 burstGap）
 * @property {{ every: number, window: number }} [guard]  光盾（楯）：每 every 秒撐起一道，擋走下一次戰力損失；擋嗰刻起 window 秒內嘅損失都唔計
 * @property {{ half: number, rows: number, time: number, height: number }} [blast]  榴彈（燈）：爆炸半闊、向後冚幾多行、飛幾耐、拋幾高
 * @property {{ interval: number, share: number, speed: number, range: number, side: number, look: object, sound: string }} [drone]  浮游無人機（燈）：自己隔一陣補一發
 * @property {number} interval  幾耐出一下（秒）
 * @property {number} share     每秒輸出佔隊長戰力幾多（打路障、首領、門）
 * @property {number} near      近距離加成：目標喺 1 以內威力 ×（1 + near），遠過 5 冇加成，中間遞減
 * @property {number} speed     每秒飛幾遠；range = 射程
 * @property {number} half      命中半闊；pierce = 每一行由最前數起倒幾多隻
 * @property {number} alt       左右手交替出：每一下橫向偏幾多（0 = 唔偏）
 * @property {object} look      子彈外觀（同 data/weapons.js 嘅 look 同一套欄位）
 * @property {string} sound     開火嘅聲（core/audio.js 嘅 SOUNDS）
 */

/** @type {RosterEntry[]} */
export const ROSTER = [
  {
    id: 'falcon', name: '隼', title: 'SQUAD LEADER', role: '步槍 · 隊長', chain: 'jue', leader: true, joinAfter: 0, forms: 4, face: ['310%', '50% 7%'], cutin: [0.012, 0.3], cutout: true, color: '255,150,90',
    // 新造型（043）只換咗形態 I；形態 II–IV 仲係舊立繪，所以頭像裁切位逐個形態寫（faces）
    portrait: (form) => (form <= 0 ? pic('falcon-v2-front.webp') : pic(`falcon-b-f${Math.max(0, Math.min(3, form)) + 1}-front.webp`)),
    faces: [['440%', '50% 4.1%'], ['310%', '50% 7%'], ['310%', '50% 7%'], ['310%', '50% 7%']],
    burst: { name: '全彈齊射', note: '6 秒內射速加倍，子彈更粗更亮。' },
    intro: '數字突擊隊隊長。衝在最前面，把「蝕」一塊一塊清掉。', weaponNote: '', joinLine: '', battle: null,
    lines: [
      '指揮官，你來了。今天的路線我已經看過一遍，隨時可以出發。',
      '「蝕」又往市區推進了一段。沒關係，我們把它推回去。',
      '別皺眉啦，有我在前面，你只管下指令就好。',
      '昨晚有好好睡嗎？指揮官倒下的話，全隊都會亂的。',
      '磚拿得越多，火力就越猛——這個道理我最喜歡。',
      '紅色的門我會記住避開。你提醒我別衝太快就行。',
      '新的裝備調校好了，想不想馬上試一試？',
      '等隊員到齊，我們就能打出真正的接力爆發。在那之前，我一個人也頂得住。',
      '每清掉一塊「蝕」，這座城市就亮回一點。值得的。',
      '出擊前先喝口水吧。我？我早就準備好了。',
      '上一場最後那一下，漂亮！再來一次也沒問題。',
      '不管對面的數字多大，我們的數字會更大。走吧，指揮官。',
    ],
  },
  {
    id: 'suzu', name: '鈴', title: 'TWIN GUNNER', role: '雙槍 · 速射', chain: 'qi', leader: false, joinAfter: 2, forms: 1, face: ['440%', '47.4% 4.1%'], cutin: [0.02, 0.2], cutout: true, color: '255,150,60',
    portrait: () => pic('suzu-v2-front.webp'),
    burst: { name: '起 · 彈雨開路', note: '接力第一段：雙槍掃出一片彈雨。' },
    intro: '突擊隊的雙槍手。話多、手快，子彈比話更多。',
    weaponNote: '左右手各一把手槍，輪流速射細小的橙黃色子彈。射得最密，單發最弱，適合清前排。',
    joinLine: '報到！雙槍手鈴，今天起跟你們一起跑。放心，我的子彈管夠！',
    battle: { slot: 0, kind: 'gun', interval: 0.125, share: 0.3, near: 0, speed: 15, range: 12, half: 0, pierce: 1, alt: 0.035, sound: 'mate_suzu',
      look: { shape: 'tracer', core: '255,240,170', glow: '255,160,50', mix: 0.35, len: 0.11, width: 0.02, flat: 1, halo: 2.4, haloLen: 1.2, hit: 'spark' } },
    lines: [
      '指揮官！今天也跑起來吧，我的腿已經等不及了！',
      '隊長說我子彈打太快——可是慢慢打多沒意思嘛。',
      '猜猜我左手快還是右手快？答案是：都比「蝕」快！',
      '剛才那塊方陣，前排是我清的喔，要記我一功。',
      '霧姐話很少，可是她每次都站在我旁邊。嘿嘿。',
      '出擊前吃了三個飯糰，現在火力全開！',
      '指揮官別老盯著螢幕，偶爾也伸個懶腰啦。',
      '下一關跑第一的請喝汽水，怎麼樣？……啊，隊長一定贏。',
    ],
  },
  {
    id: 'kiri', name: '霧', title: 'BLADE', role: '直刀 · 近身', chain: 'cheng', leader: false, joinAfter: 4, forms: 1, face: ['440%', '51.3% 3%'], cutin: [0.02, 0.2], cutout: true, color: '70,230,190',
    portrait: () => pic('kiri-v2-front.webp'),
    burst: { name: '承 · 一閃', note: '接力第二段：一刀把缺口劈開。' },
    intro: '突擊隊的刀手。話很少，刀很快，站在誰旁邊誰就安心。',
    weaponNote: '手持直刀，不射子彈。每隔一小段時間向前揮出一道青綠色的刀氣，穿透一整列；目標越近，威力越大。',
    joinLine: '霧。用刀的。……靠近的，交給我。',
    battle: { slot: 1, kind: 'blade', interval: 0.9, share: 0.22, near: 1, speed: 11, range: 7, half: 0.05, pierce: 6, alt: 0, sound: 'mate_kiri',
      look: { shape: 'blade', core: '230,255,245', glow: '60,230,180', mix: 0.3, len: 0.12, width: 0.34, flat: 0.12, halo: 1.12, haloLen: 1.8, hit: 'spark' } },
    lines: [
      '……來了。可以出發。',
      '刀磨好了。',
      '近的交給我。遠的，鈴會吵著要打。',
      '指揮官，臉色不太好。休息一下。',
      '「蝕」不會等人。但也不必急。',
      '隊長衝太前的時候，我會跟上。',
      '……今天的茶，不錯。',
      '一刀就夠的事，不用兩刀。',
    ],
  },
  {
    id: 'tate', name: '楯', title: 'SHIELD GUARD', role: '大盾 · 守護', chain: 'cheng', leader: false, joinAfter: 6, forms: 1, face: ['440%', '47.4% 3.9%'], cutin: [0.02, 0.2], cutout: true, color: '70,130,255',
    portrait: () => pic('tate-v2-front.webp'),
    burst: { name: '承 · 壁壘推進', note: '接力：舉盾頂開缺口。' },
    intro: '突擊隊的盾手。穩重、溫柔，總是站在大家和危險之間。',
    weaponNote: '左手一面鈷藍邊的大盾，右手衝鋒槍三連點射，火力不高。真正的本事是光盾：每隔一段時間在隊伍前方撐起一道藍色光盾，替全隊擋下一次戰力損失。',
    joinLine: '我是楯。從今天起，前面交給我來擋。大家都要平安回來喔。',
    battle: { slot: 2, kind: 'gun', interval: 0.6, burst: 3, burstGap: 0.08, share: 0.12, near: 0, speed: 15, range: 11, half: 0, pierce: 1, alt: 0, sound: 'mate_tate', guard: { every: 10, window: 0.8 },
      look: { shape: 'tracer', core: '225,238,255', glow: '70,130,255', mix: 0.35, len: 0.13, width: 0.022, flat: 1, halo: 2.4, haloLen: 1.2, hit: 'spark' } },
    lines: [
      '指揮官，辛苦了。先坐下來喝杯熱茶，再看作戰圖吧。',
      '盾擦好了，隨時可以出發。有我在，大家不會有事的。',
      '鈴又把彈匣到處亂放了……我已經幫她收好啦。',
      '你已經盯著螢幕很久了。眼睛休息五分鐘，好嗎？',
      '擋在前面並不可怕。可怕的是回頭看見少了一個人。',
      '霧其實很怕冷，我給她多準備了一條圍巾。別告訴她是我說的。',
      '光盾充能需要一點時間。這段時間，請跑在我身後。',
      '今天也平安回來了呢。這就是最好的戰果。',
    ],
  },
  {
    id: 'akari', name: '燈', title: 'HEAVY ENGINEER', role: '榴彈炮 · 範圍', chain: 'qi', leader: false, joinAfter: 8, forms: 1, face: ['440%', '55.8% 7.5%'], cutin: [0.02, 0.2], cutout: true, color: '255,90,170',
    portrait: () => pic('akari-v2-front.webp'),
    burst: { name: '起 · 煙花開幕', note: '接力：一輪榴彈炸開前路。' },
    intro: '突擊隊的工程師。鬼馬、自信，最愛炫耀自己的發明，身邊總跟著一隻小無人機。',
    weaponNote: '肩上一門榴彈炮，射得慢，每發沿拋物線飛出，落地爆炸清走一整片小敵人。身旁的浮游無人機「圓仔」偶爾自己補一發青色光彈。',
    joinLine: '鏘鏘——天才工程師燈，帶著圓仔登場！這門炮可是我親手改的，要看好囉！',
    battle: { slot: 3, kind: 'lob', interval: 1.5, share: 0.26, near: 0, speed: 9, range: 9, half: 0, pierce: 1, alt: 0, sound: 'mate_akari', blast: { half: 0.3, rows: 5, time: 0.7, height: 0.9 },
      drone: { interval: 2.2, share: 0.04, speed: 16, range: 12, side: 0.15, sound: 'drone', look: { shape: 'tracer', core: '225,255,255', glow: '60,230,235', mix: 0.3, len: 0.09, width: 0.026, flat: 1, halo: 2.6, haloLen: 1.1, hit: 'spark' } },
      look: { shape: 'tracer', core: '255,235,245', glow: '255,90,170', mix: 0.35, len: 0.1, width: 0.05, flat: 1, halo: 2.2, haloLen: 1, hit: 'spark' } },
    lines: [
      '指揮官！快看快看，圓仔今天學會轉圈圈了！……雖然本來就會。',
      '這門榴彈炮的後座力，我調小了百分之十二。厲害吧？誇我誇我。',
      '一發清一片，這才叫效率。鈴那種一粒一粒打的，嘖嘖。',
      '圓仔說牠也想要一個徽章。牠沒說？我是牠的翻譯啦。',
      '楯姐的盾我偷偷加了個杯架。她還沒發現，嘿嘿。',
      '昨晚又通宵改設計圖了。黑眼圈？這是天才的勳章！',
      '放心，爆炸範圍我算過的。大概、應該、多半不會波及自己人。',
      '下一個發明我想做會自己撿磚的機器人。到時候第一個借你用！',
    ],
  },
];

/** 隊員頁一共幾多格（未加入嘅用剪影）。 */
export const ROSTER_SLOTS = 6;

/** 搵角色（冇就 null）。 */
export const rosterOf = (id) => ROSTER.find((r) => r.id === id) ?? null;
/** 隊員（唔計隊長）。 */
export const MATE_IDS = ROSTER.filter((r) => !r.leader).map((r) => r.id);
/** 一隊最多帶幾多個隊員出戰（企位有四個：連隊長五人）。 */
export const MAX_MATES = 4;

/** 大廳右邊嘅細掣同底部分頁。 */
// soon = 未做好：介面唔顯示呢個入口（唔出「即將開放」）；做好先拎走 soon。
export const LOBBY_SIDE = [{ id: 'mission', label: '任務', icon: 'mission', needs: 'mission' }, { id: 'login', label: '簽到', icon: 'gift' }, { id: 'mail', label: '信箱', icon: 'mail' }, { id: 'endless', label: '無盡', icon: 'flag', needs: 'endless' }];
export const LOBBY_TABS = [{ id: 'lobby', label: '大廳' }, { id: 'map', label: '關卡' }, { id: 'team', label: '隊員' }, { id: 'gacha', label: '招募' }, { id: 'base', label: '基地' }, { id: 'shop', label: '商店' }];

/**
 * 戰鬥入面嘅五個頭像位（左到右）：中間係隊長；隊員照企位排——左外、左後、隊長、右後、右外。冇人嘅位係空插槽。
 * @param {string[]} mates 出戰嘅隊員 id
 */
export function battleSlots(mates = []) {
  const out = [null, null, ROSTER.find((r) => r.leader).id, null, null], at = [1, 3, 0, 4];
  for (const id of mates) { const r = rosterOf(id); if (r?.battle) out[at[r.battle.slot]] = id; }
  return out;
}

/**
 * 爆發鏈照「起 → 承 → 決」三段接力：隊入面三段都有人 = 完整爆發（一個接一個出特寫，效果強過單人）；唔齊就係隊長單人版。
 */
export function chainComplete(ids) {
  const have = new Set(ids.map((id) => rosterOf(id)?.chain).filter(Boolean));
  return ['qi', 'cheng', 'jue'].every((k) => have.has(k));
}
/**
 * 完整爆發嘅接力次序：起、承、決各至少一個人先成立（唔齊就回傳 null）。隊入面有幾多人就接幾多段——照 起 → 承 → 決 排，同一段位嘅照角色表次序；
 * 同一段位有兩個人，嗰段就出兩個特寫，爆發亦都加強（見 data/column.js 嘅 fullBurst：每多一個人，時間同倍率再加）。
 */
export function chainOrder(ids) {
  const list = [...new Set(ids)].filter((id) => rosterOf(id)), of = (k) => ROSTER.filter((r) => r.chain === k && list.includes(r.id)).map((r) => r.id);
  const qi = of('qi'), cheng = of('cheng'), jue = of('jue');
  return qi.length && cheng.length && jue.length ? [...qi, ...cheng, ...jue] : null;
}

/** 呢隊人放唔放得爆發技：有隊長就得（三段齊係完整版，唔齊係單人版）。 */
export const canBurst = (ids) => new Set(ids).size === ids.length && ids.some((id) => rosterOf(id)?.leader);
