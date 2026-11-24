// 素材清單：全遊戲唯一一個寫住「邊個 key 對應邊個檔」嘅地方。
//   ASSET_MANIFEST = 圖片。每個 key 係一串候選檔案，由頭試到尾；全部冇就由繪畫程式用程式畫代替。
//   CLIP_MANIFEST  = 動畫片段（純色背景影片，播放時即時去背）。播唔到就用返角色嘅靜態圖。
// 美術檔由另一條流程交到 art/，呢度只係讀，唔好改 art/ 入面任何嘢。

import { TUNING } from './tuning.js';

const GAME_ROOT = new URL('../../', import.meta.url);          // game/
const ART_OUT = new URL('../art/out/', GAME_ROOT);              // art/out/
const ART_ANIM = new URL('../art/anim/', GAME_ROOT);            // art/anim/
const PLACEHOLDER = new URL('../demo/battle-2d/placeholder/', GAME_ROOT); // 原型留低嘅臨時圖

const LOCAL = new URL('assets/', GAME_ROOT);                    // game/assets/：由美術原檔縮細出嚟嘅遊戲用版本

/**
 * 主角「隼」而家用邊一套服裝：全部主角素材嘅路徑都由呢度砌出嚟，換服裝只改呢兩行（同埋重新縮 game/assets/ 嗰批圖，見 README）。
 *   anim  art/anim/ 入面嘅資料夾：f1–f4-run.mp4 同 f1–f4-run-motion.json（四個形態嘅跑步片同逐格資料）
 *   out   art/out/ 入面嘅資料夾：f1–f4-game-master-run.png（片未播得嗰陣嘅主圖，同片嘅 box 對齊）、f1–f4-cutin.png（進化特寫）
 *   local game/assets/ 入面縮細版嘅檔名字頭
 * 片同 motion.json 係開場即場讀（src/crowd/form-clips.js），所以美術用同檔名、同規格換新版本，唔使改程式。
 * 而家係 017「橘弧」服裝；之前係 013（跑步片）加 012（主圖、特寫），舊檔仲喺原位。
 */
export const LEAD_ART = { anim: '017-falcon', out: '017-leader-outfit-b-final', local: 'falcon-b' };

const art = (path) => new URL(path, ART_OUT).href;
const local = (path) => new URL(path, LOCAL).href;
const anim = (path) => new URL(path, ART_ANIM).href;
const placeholder = (path) => new URL(path, PLACEHOLDER).href;
const squadArt = (name) => art(`004-squad-battle-sprites/${name}.png`);

/** @type {Record<string, string[]>} */
export const ASSET_MANIFEST = {
  // 戰鬥
  'bg-highway':         [art('002-battle-demo/bg-highway.png'),         placeholder('bg-highway.png')],
  // 隼（最舊嗰個三車道版）：地面跑步同飛行各一張主圖（影片未準備好嗰陣用；亦係影片對位嘅基準）。
  // 跑步主圖用 LEAD_ART 嗰套服裝嘅形態 I 主圖（同單主角版同一張）。美術原檔係 2048×3072，所以遊戲載入 game/assets/ 入面縮到 683×1024 嘅 WebP；冇先用原檔。
  // 飛行主圖仲係舊造型（新服裝冇飛行素材），飛行道具關咗所以用唔到。
  'falcon-run-master':  [local(`${LEAD_ART.local}-f1-master.webp`), art(`${LEAD_ART.out}/f1-game-master-run.png`), placeholder('leader-battle-back.png')],
  'falcon-fly-master':  [local('falcon-fly-master.webp'), art('007-leader-layered-battle/falcon-fly-master.png'), art('002-battle-demo/leader-battle-back.png'), placeholder('leader-battle-back.png')],
  'muzzle-flash':       [art('002-battle-demo/muzzle-flash.png'),       placeholder('muzzle-flash.png')],
  'enemy-drone':        [art('002-battle-demo/enemy-drone.png'),        placeholder('enemy-drone.png')],
  'enemy-walker':       [art('002-battle-demo/enemy-walker.png'),       placeholder('enemy-walker.png')],
  'boss-01':            [art('002-battle-demo/boss-01.png'),            placeholder('boss-01.png')],
  // 隊員背面靜態圖（動畫片段播唔到嗰陣用）
  'suzu-battle-back':   [squadArt('suzu-battle-back')],
  'tate-battle-back':   [squadArt('tate-battle-back')],
  'kiri-battle-back':   [squadArt('kiri-battle-back')],
  'akari-battle-back':  [squadArt('akari-battle-back')],
  'san-battle-back':    [squadArt('san-battle-back')],
  // 單主角版（頂視、三線長列）嘅主角：四個形態各一張主圖（片未播得嗰陣頂住；同片嘅 box 對齊）同一張進化特寫。
  // game/assets/ 入面係縮細版（主圖 683×1024、特寫 1024×683 嘅 WebP）；原檔喺 art/out/，冇縮細版先用原檔。邊套服裝睇 LEAD_ART。
  ...Object.fromEntries([1, 2, 3, 4].map((n) => [`falcon-f${n}-master`, [local(`${LEAD_ART.local}-f${n}-master.webp`), art(`${LEAD_ART.out}/f${n}-game-master-run.png`)]])),
  ...Object.fromEntries([1, 2, 3, 4].map((n) => [`falcon-f${n}-cutin`, [local(`${LEAD_ART.local}-f${n}-cutin.webp`), art(`${LEAD_ART.out}/f${n}-cutin.png`)]])),
  // 戰鬥風格效果
  'suzu-slash':         [squadArt('suzu-slash')],
  'akari-drone-back':   [squadArt('akari-drone-back')],
  'san-array':          [squadArt('san-array')],
};

/**
 * 動畫片段。
 * @typedef {Object} ClipDef
 * @property {string} url
 * @property {'g' | 'b'} keyChannel   背景係綠色定藍色（去背時減走邊個通道）
 * @property {{ x: number, y: number, w: number, h: number }} box
 *   影片畫面入面，邊個範圍對應返靜態圖成張圖（比例 0–1）。畫嗰陣將呢個範圍對準立繪位置。
 * @property {boolean} [once]   true = 一次過嘅動作片：播完停喺最後一格（唔循環）
 * @property {number} [start]   每次開始播（restart）由第幾秒起；唔填 = 由頭
 * @property {[number, number]} [loop]   播到第二個數（秒）就跳返第一個數：只循環片入面一段（例如連射嘅一拍）
 * @property {number} [rate]    播放速度倍率（唔填 = 1）
 * @property {number} [done]    一次過嘅片：由 start 播到第幾秒就算做完（之後嘅姿勢同待機片接得返）
 * @property {number} [fps]     片嘅格率（有 muzzleFrames 先要）
 * @property {[number, number][]} [muzzleFrames]   逐格槍口座標（成個影片畫面嘅比例）；見 battle/muzzle.js
 * @property {{ left: number[], right: number[] }} [footContacts]   腳落地嘅格號（30 格／秒）。暫時冇程式用，留俾腳步塵、腳步聲。
 * @property {import('../core/clip-timing.js').ClipAttack} [attack]
 *   片入面出招嗰段（秒）：start 開始郁、strike 出招嗰格、end 收招完。有填嘅話平時只播待機部分，
 *   遊戲入面真係出招先播呢段（見 core/clip-timing.js）。唔填 = 成條片不停循環（不停開火嘅角色用）。
 */

// 五個隊員嘅片都係將 1024×1536 嘅立繪放喺 540×960 畫面正中：闊佔 85.9%，高佔 72.55%。
const FIGURE_BOX = { x: 0.0705, y: 0.137, w: 0.859, h: 0.7255 };

const FALCON_FLY_BOX = { x: 0.024074, y: 0.067187, w: 1.02037, h: 0.860938 };

/**
 * 單主角版（頂視、三線長列）嘅主角。片同主圖嚟自 LEAD_ART 嗰套服裝（而家係 017「橘弧」；規格同之前 013 嗰批一樣：540×960、62 格、同一個 box、頭頂同靴底對齊）。
 * 下面抄落嚟嘅 box、格數、落地格、槍口係 art/anim/017-falcon/f1-run-motion.json 嘅數；開場會再由檔案讀一次蓋過（applyDefaultMotion）。
 * 形態 I 呢條片係雙手托住裝置朝前，槍口喺右肩前上方（約 x 0.63、y 0.16），照 motion.json 用。
 *   file / box   片源同對位（同 LEADER_GROUND_CLIP 一樣嘅意思）
 *   fps / frames / footContacts   格率、格數、落地格（motion.json）：腳步塵同影子縮放跟住呢啲格
 *   muzzle / muzzleFrames   槍口：冇片嗰陣嘅固定位置（[離主圖中線向右, 離主圖底邊向上] × 主圖高度）同逐格座標（成個影片畫面嘅比例）
 *   still        冇片播嗰陣用嘅主圖（ASSET_MANIFEST 嘅 key）
 *   height       主圖高佔畫面高度幾多。人物本身（頭頂至鞋底，唔計留白）佔主圖嘅 bodyFraction，所以全身 = height × bodyFraction ≈ 15%
 *   top          人物最高嗰點離主圖底邊幾高（× 主圖高度）：戰力牌擺喺佢上面。冇填就用槍口高度
 *   footDrop / shiftX   錨點：主圖底邊喺腳底（承重中段）下面幾多、主圖中線喺兩腳中間右邊幾多（× 主圖高度；負數 = 左邊）
 *   footSpread   左右腳離兩腳中間幾遠（× 主圖高度）：腳步塵喺邊度出
 *   rate         播放倍率，見下面「D 片嘅量度」
 *   phases       開幾多條錯開相位嘅片（秒）：多過一個隊員嗰陣輪流用，唔會全隊同一步
 *   forms        每個進化形態自己嘅素材（第 0 個 = 形態 I）。每格可以填，冇填嘅就用上面預設（即係形態 I 嘅片）：
 *                  useStill: true = 用 still 嗰張靜態主圖做外觀（程式加起伏、傾身、後座、腳步塵頂住）
 *                  height、bodyFraction、footDrop、shiftX、footSpread、muzzle：靜態主圖嘅比例、錨點同槍尖（睇圖量嘅）
 *                  run: { file, motion }   呢個形態嘅跑步片同逐格資料（相對 art/anim/）。**檔案喺度就用片，唔喺度就用靜態主圖**：
 *                    開場會試攞 motion 同 file（src/crowd/form-clips.js），兩個都攞到先叫 applyUnitMotion 換成用片，
 *                    格數、落地格、逐格槍口、對位全部由 motion.json 讀；人物比例同腳底基線當同形態 I 嘅片一樣（美術講明同一規格）。
 *                    所以美術交片只要放檔，唔使改程式。未交嘅形態開場各有一行 404（試攞 motion.json 嗰下），正常。
 *                  file、box、fps、frames、footContacts、muzzleFrames：想手動寫死某個形態嘅片都得（唔使 run）
 *                  strafeLeft / strafeRight：{ file, box }，向左 / 向右橫移嘅片；橫移夠快就交叉淡入，冇填就用程式傾身代替
 *                  cutin：進化到呢個形態嗰刻嘅變身特寫圖（ASSET_MANIFEST 嘅 key）
 *
 * 比例同錨點係用之前 013 嘅 D 片量嘅（017 同一規格，照用）。D 片嘅量度（540×960，逐格去綠量；主圖 = box 嗰格，高 750 像素）：
 *   頭頂 y 256–268（中位 261）、鞋底最低 823–827 → 頭頂至鞋底約 562 像素 = 主圖高 0.749（bodyFraction），height = 0.15 ÷ 0.749 = 0.2003。
 *   承重腳由落地（鞋底 y 約 740）向後行到離地（約 820），中段約 780 → footDrop = (855 − 780) ÷ 750 = 0.10；
 *   兩腳中間 x 約 247，主圖中線 270 → shiftX = +0.031；左右腳各偏約 17 像素 → footSpread 0.023。
 *   播放倍率：承重腳喺片入面每格向後行約 15.6 像素（5 格行 78 像素）；路面喺同一個比例下每格行約 29 像素。
 *   D 片鏡頭比之前低（似後上方約 35°，唔係俯視），地面向後嘅距離被壓扁咗，所以要完全對到腳要播 1.86 倍（每分鐘 320 幾步），
 *   睇落會好似快鏡。而家取 1.2（每分鐘約 209 步）：步頻仲似跑步，腳對路面嘅滑動由 46% 減到 35%。呢個係片嘅鏡頭角度同遊戲路面唔夾，
 *   靠倍率解決唔晒。改咗 height、world.scroll 或者 view.roadHalf 要重算。
 */
export const UNIT_SPRITE = {
  file: `${LEAD_ART.anim}/f1-run.mp4`,
  /** 形態 I 嘅逐格資料：開場會讀呢個檔蓋過下面抄落嚟嘅 box、格數、落地格、槍口（applyDefaultMotion）；讀唔到先用下面呢啲 */
  motion: `${LEAD_ART.anim}/f1-run-motion.json`,
  box: { x: 0.037037, y: 0.109375, w: 0.925926, h: 0.78125 },
  fps: 30,
  frames: 62,
  footContacts: { left: [1, 21, 43], right: [11, 33, 53] },
  muzzle: [0.10752, 0.895117],
  muzzleFrames: [
    [0.6316, 0.1615], [0.6316, 0.1633], [0.6310, 0.1627], [0.6299, 0.1614], [0.6282, 0.1584], [0.6279, 0.1570],
    [0.6294, 0.1554], [0.6304, 0.1558], [0.6310, 0.1562], [0.6313, 0.1583], [0.6311, 0.1604], [0.6287, 0.1631],
    [0.6273, 0.1615], [0.6264, 0.1596], [0.6260, 0.1572], [0.6265, 0.1553], [0.6266, 0.1532], [0.6280, 0.1543],
    [0.6290, 0.1563], [0.6307, 0.1582], [0.6313, 0.1602], [0.6315, 0.1621], [0.6309, 0.1625], [0.6305, 0.1623],
    [0.6292, 0.1592], [0.6288, 0.1572], [0.6298, 0.1556], [0.6299, 0.1552], [0.6306, 0.1553], [0.6308, 0.1572],
    [0.6309, 0.1594], [0.6289, 0.1629], [0.6274, 0.1625], [0.6265, 0.1613], [0.6262, 0.1585], [0.6255, 0.1561],
    [0.6253, 0.1540], [0.6275, 0.1541], [0.6282, 0.1535], [0.6301, 0.1562], [0.6310, 0.1581], [0.6323, 0.1604],
    [0.6318, 0.1616], [0.6316, 0.1629], [0.6302, 0.1614], [0.6292, 0.1595], [0.6293, 0.1573], [0.6296, 0.1560],
    [0.6299, 0.1551], [0.6306, 0.1555], [0.6311, 0.1573], [0.6314, 0.1611], [0.6295, 0.1618], [0.6270, 0.1630],
    [0.6262, 0.1604], [0.6263, 0.1583], [0.6251, 0.1554], [0.6257, 0.1538], [0.6267, 0.1522], [0.6293, 0.1550],
    [0.6303, 0.1573], [0.6314, 0.1597],
  ],
  still: 'falcon-f1-master',
  height: 0.2003,
  bodyFraction: 0.749,
  top: 0.8,
  footDrop: 0.1,
  shiftX: 0.031,
  footSpread: 0.023,
  rate: 1.2,
  /** 片入面承重腳每格向後行幾多像素（量出嚟嘅，俾測試同重算倍率用） */
  footPxPerFrame: 15.6,
  phases: [0, 0.69, 1.38],
  // 形態 II–IV：主圖同片嘅 box 對齊，所以比例、錨點用返上面預設；muzzle 係主圖嘅槍尖（motion.json 嘅 stillMuzzle，片到咗會由檔案蓋過）
  forms: [
    { cutin: 'falcon-f1-cutin' }, // 形態 I 嘅特寫圖登記咗，但遊戲入面冇「進化到形態 I」，所以暫時冇地方用
    ...[[0.105283, 0.917995], [0.145106, 0.980815], [0.117531, 0.927798]].map((muzzle, i) => ({
      useStill: true, still: `falcon-f${i + 2}-master`, muzzle, top: 0.97, cutin: `falcon-f${i + 2}-cutin`,
      run: { file: `${LEAD_ART.anim}/f${i + 2}-run.mp4`, motion: `${LEAD_ART.anim}/f${i + 2}-run-motion.json` },
    })),
  ],
};

/**
 * 最舊嗰個三車道版（?mode=lanes）嘅隊長地面跑步片：而家同單主角版用同一條片（LEAD_ART 嗰套服裝嘅形態 I），
 * 片源、box、格數、落地格、槍口全部跟 UNIT_SPRITE（開場由 motion.json 讀到就一齊更新，見 applyDefaultMotion）。
 *   muzzle       冇片播（只顯示主圖）嗰陣嘅槍口位置：[離主圖中線向右幾多, 離主圖底邊向上幾多]，單位係主圖高度
 *   muzzleFrames 逐格槍口座標（成個影片畫面嘅比例）；子彈同槍口閃光跟住呢個位出（換算喺 battle/muzzle.js）
 *   footSpeed    原速播嗰陣腳底貼地嘅世界速度（單位／秒）。**呢個數仲係舊片（010 持槍跑步）量嘅 1.73，新片未喺呢個版本嘅透視下重量**，
 *                所以呢個版本腳同路面未必對得啱。tuning 嘅 flight.groundPlaybackRate = world.approachSpeed ÷ footSpeed。
 * 新片係後上方約 55 度影嘅，呢個版本嘅路面係背後視角，角度唔夾；呢個版本只係留嚟對比，冇為新片重新調透視。
 * 大細、腳線、左右對位喺角色資料嘅 battle.scale / footDrop / shiftX。舊片（art/anim/010-falcon/leader-run.mp4）仲喺原位。
 */
export const LEADER_GROUND_CLIP = {
  file: UNIT_SPRITE.file,
  fps: UNIT_SPRITE.fps,
  frames: UNIT_SPRITE.frames,
  box: UNIT_SPRITE.box,
  footContacts: UNIT_SPRITE.footContacts,
  muzzle: UNIT_SPRITE.muzzle,
  muzzleFrames: UNIT_SPRITE.muzzleFrames,
  footSpeed: 1.73,
};

/** 第 form 個形態嘅變身特寫圖喺 ASSET_MANIFEST 嘅 key；形態冇填 cutin 就回傳 null（唔顯示）。 */
export const unitCutinKey = (form) => UNIT_SPRITE.forms[form]?.cutin ?? null;

/**
 * 第 form 個形態嘅外觀設定：形態有填就用形態嘅，冇就用預設。
 *   useStill = 用靜態主圖（冇片、冇逐格槍口）；own = 形態有自己嘅造型（唔使再靠染色分）
 *   hasStillLook = 呢個形態用片，但片未播得嗰陣有自己一套靜態主圖比例可以頂住
 * still = true：片未播得（載入緊 / 播唔到），要返「靜態主圖」嗰套——主圖同片嘅取景唔同，
 *   唔可以將主圖套落片嘅比例度（人會縮細、腳離開影子）。
 * @param {number} form
 * @param {boolean} [still]
 */
export function unitLook(form, still = false) {
  const g = UNIT_SPRITE.forms[form] ?? {}, f = still && g.stillLook ? { ...g.stillLook, still: g.still, useStill: true } : g;
  const pick = (k) => f[k] ?? UNIT_SPRITE[k], useStill = !!f.useStill;
  return {
    file: useStill ? null : pick('file'), box: pick('box'), still: pick('still'),
    fps: pick('fps'), frames: useStill ? 0 : pick('frames'), footContacts: useStill ? null : pick('footContacts'),
    muzzle: pick('muzzle'), muzzleFrames: useStill ? null : pick('muzzleFrames'),
    height: pick('height'), bodyFraction: pick('bodyFraction'), footDrop: pick('footDrop'), shiftX: pick('shiftX'), footSpread: pick('footSpread'),
    top: useStill ? f.top ?? null : pick('top'),
    useStill, own: useStill || !!f.file || !!f.still, hasStillLook: !!g.stillLook,
  };
}

/** 形態嘅跑步片同逐格資料嘅網址（forms[n].run）；冇填就回傳 null。 */
export function unitRunSource(form) {
  const run = UNIT_SPRITE.forms[form]?.run;
  return run ? { file: anim(run.file), motion: anim(run.motion) } : null;
}

/** 形態 I（預設）嘅逐格資料嘅網址。 */
export const unitDefaultMotionSource = () => (UNIT_SPRITE.motion ? anim(UNIT_SPRITE.motion) : null);

/**
 * 形態 I 嘅 motion.json 讀到咗：用檔案入面嘅 box、格數、落地格、逐格槍口、主圖槍口蓋過設定入面抄落嚟嗰份。
 * 所以美術用同檔名換一條新嘅 f1 片（連 motion.json），唔使改程式。資料唔齊就唔換，回傳 false。
 * @param {any} motion
 */
export function applyDefaultMotion(motion) {
  const frames = motion?.frameCount, pos = motion?.muzzlePositions;
  if (!(frames > 0) || !motion.box || !Array.isArray(pos) || pos.length !== frames) return false;
  const still = motion.stillMuzzle?.offsetFromCenterRightAndBottomUp;
  Object.assign(UNIT_SPRITE, {
    box: { x: motion.box.x, y: motion.box.y, w: motion.box.w, h: motion.box.h },
    fps: motion.fps ?? UNIT_SPRITE.fps, frames,
    footContacts: motion.footContactFrames ?? UNIT_SPRITE.footContacts,
    muzzleFrames: pos.map((q) => [q.x, q.y]),
    ...(Array.isArray(still) ? { muzzle: still } : {}),
  });
  UNIT_SPRITE.phases.forEach((_, i) => { CLIP_MANIFEST[`unit-run-${i}`] = unitClipDef(-1, i, 'run'); });
  // 最舊嗰個三車道版嘅隊長用同一條片：一齊更新
  const U = UNIT_SPRITE, lead = { fps: U.fps, frames: U.frames, box: U.box, footContacts: U.footContacts, muzzle: U.muzzle, muzzleFrames: U.muzzleFrames };
  Object.assign(LEADER_GROUND_CLIP, lead);
  Object.assign(CLIP_MANIFEST['falcon-run'], { box: lead.box, footContacts: lead.footContacts, fps: lead.fps, muzzleFrames: lead.muzzleFrames });
  return true;
}

/**
 * 將「對住主圖（box 嗰格）」嘅比例同錨點，換算成「對住成個影片畫面」：畫成格片，唔再裁走 box 以外嘅嘢。
 * 形態三嘅雙軌槍尖伸到 box 上面、形態四嘅翼尖伸到 box 左邊，照 box 裁會俾切走。人物喺畫面嘅大細同位置唔變。
 * 小圖闊高比固定 2:3，所以新 box 上下啱啱係成個畫面，左右比畫面闊少少（多出嚟嗰啲係空白）。
 * @param {{ x: number, y: number, w: number, h: number }} box   主圖喺影片畫面嘅位置（比例）
 * @param {number} aspect   影片闊 ÷ 高
 */
export function fullFrameLook(box, aspect) {
  const B = UNIT_SPRITE, below = 1 - box.y - box.h, w = (2 / 3) / aspect, mid = box.x + box.w / 2;
  return {
    box: { x: mid - w / 2, y: 0, w, h: 1 },
    height: B.height / box.h, bodyFraction: B.bodyFraction * box.h,
    footDrop: B.footDrop * box.h + below, top: B.top * box.h + below,
    shiftX: B.shiftX * box.h, footSpread: B.footSpread * box.h,
  };
}

/**
 * 形態 form 嘅跑步片到咗：由靜態主圖換成用片。motion = 美術嘅 motion.json 內容。
 * 人物比例同腳底基線用返預設（形態 I 嘅片）嗰套——美術交嘅四條片頭頂、靴底、中線對齊（我逐格量過，見 README）；
 * 靜態主圖自己嗰套比例留喺 stillLook，片未播得嗰陣先用。資料唔齊就唔換，回傳 false。
 * @param {number} form
 * @param {any} motion
 * @returns {boolean}
 */
export function applyUnitMotion(form, motion) {
  const f = UNIT_SPRITE.forms[form], frames = motion?.frameCount, pos = motion?.muzzlePositions;
  if (!f?.run || !(frames > 0) || !motion.box || !Array.isArray(pos)) return false;
  const { useStill, height, bodyFraction, footDrop, shiftX, footSpread, muzzle, top, stillLook, ...keep } = f;
  const full = fullFrameLook(motion.box, (motion.width ?? 540) / (motion.height ?? 960));
  UNIT_SPRITE.forms[form] = {
    ...keep,
    stillLook: stillLook ?? { height, bodyFraction, footDrop, shiftX, footSpread, muzzle: motion.stillMuzzle?.offsetFromCenterRightAndBottomUp ?? muzzle, top },
    file: f.run.file, fps: motion.fps ?? UNIT_SPRITE.fps, frames,
    ...full,
    footContacts: motion.footContactFrames ?? { left: [], right: [] },
    muzzleFrames: pos.map((q) => [q.x, q.y]),
    // 戰力牌擺喺人物同武器最高嗰點上面：武器尖（逐格槍口最高嗰格）高過頭頂就跟武器尖
    top: Math.max(full.top, 1 - Math.min(...pos.map((q) => q.y))),
    ...(motion.keyChannel ? { keyChannel: motion.keyChannel } : {}),
  };
  UNIT_SPRITE.phases.forEach((_, i) => { CLIP_MANIFEST[`unit-f${form}-run-${i}`] = unitClipDef(form, i, 'run'); });
  return true;
}

/**
 * 第 form 個形態、某個狀態嘅片，喺 CLIP_MANIFEST 嘅 key。
 *   state 'run'：形態冇專用片就用返預設嗰組（第 phase 份錯開相位）；形態用靜態主圖（useStill）就回傳 null
 *   state 'strafeLeft' / 'strafeRight'：形態冇填就回傳 null（用程式傾身代替）
 * @param {number} form
 * @param {number} phase
 * @param {'run' | 'strafeLeft' | 'strafeRight'} [state]
 * @returns {string | null}
 */
export function unitClipKey(form, phase, state = 'run') {
  const f = UNIT_SPRITE.forms[form];
  if (state !== 'run') return f?.[state]?.file ? `unit-f${form}-${state}` : null;
  if (f?.useStill) return null;
  return f?.file ? `unit-f${form}-run-${phase}` : `unit-run-${phase}`;
}

/** 某條單位片嘅設定（即場由 UNIT_SPRITE 砌，所以填咗新形態唔使再登記）。 */
function unitClipDef(form, phase, state) {
  const f = UNIT_SPRITE.forms[form] ?? {}, alt = state === 'run' ? null : f[state];
  const file = alt?.file ?? f.file ?? UNIT_SPRITE.file;
  return { url: anim(file), keyChannel: alt?.keyChannel ?? f.keyChannel ?? 'g', box: alt?.box ?? f.box ?? UNIT_SPRITE.box, rate: UNIT_SPRITE.rate, start: state === 'run' ? UNIT_SPRITE.phases[phase] ?? 0 : 0 };
}

/** @type {Record<string, ClipDef>} */
export const CLIP_MANIFEST = {
  // 隼（最舊嗰個三車道版）：地面跑步片同單主角版形態 I 同一條（見 LEADER_GROUND_CLIP）；飛行三條片（art/out/007-leader-layered-battle/falcon-motions.json）仲係舊造型，飛行道具關咗所以唔會播。
  // 全部 30 格／秒，下面嘅秒數 = 格號 ÷ 30。
  // 跑步同飛行嘅 box 唔同，各自對返自己張主圖。
  // 地面移動：片源、對位、落地格全部喺上面嘅 LEADER_GROUND_CLIP；播放倍率喺 tuning 嘅 flight.groundPlaybackRate
  'falcon-run':       { url: anim(LEADER_GROUND_CLIP.file), keyChannel: 'g', box: LEADER_GROUND_CLIP.box, rate: TUNING.flight.groundPlaybackRate,
                        footContacts: LEADER_GROUND_CLIP.footContacts, fps: LEADER_GROUND_CLIP.fps, muzzleFrames: LEADER_GROUND_CLIP.muzzleFrames },
  'falcon-glide':     { url: anim('007-falcon/leader-glide.mp4'),     keyChannel: 'g', box: FALCON_FLY_BOX },   // 150 格，成段循環
  // 連射：第 24 格開第一槍；之後循環第 50–78 格（一拍）
  'falcon-fire':      { url: anim('007-falcon/leader-auto-fire.mp4'), keyChannel: 'g', box: FALCON_FLY_BOX, start: 22 / 30, loop: [50 / 30, 78 / 30] },
  // 超載：第 34 格開始，第 129 格返到巡航姿勢；播一次
  'falcon-overdrive': { url: anim('007-falcon/leader-overdrive.mp4'), keyChannel: 'g', box: FALCON_FLY_BOX, once: true, start: 34 / 30, done: 129 / 30 },
  // 俯視玩法嘅主角：預設片開幾份，各自由唔同位置開始循環；有專用片嘅形態各自一組，另加左右橫移片（見上面 UNIT_SPRITE）
  ...Object.fromEntries(UNIT_SPRITE.phases.map((_, i) => [`unit-run-${i}`, unitClipDef(-1, i, 'run')])),
  ...Object.fromEntries(UNIT_SPRITE.forms.flatMap((f, n) => [
    ...(f.file ? UNIT_SPRITE.phases.map((_, i) => [`unit-f${n}-run-${i}`, unitClipDef(n, i, 'run')]) : []),
    ...['strafeLeft', 'strafeRight'].filter((st) => f[st]?.file).map((st) => [`unit-f${n}-${st}`, unitClipDef(n, 0, st)]),
  ])),
  'suzu-attack':   { url: anim('suzu-attack.mp4'),   keyChannel: 'g', box: FIGURE_BOX, attack: { start: 0.5, strike: 1.86, end: 4.2, lead: 0.16, skip: [[1.86, 2.74]] } },  // 衝前橫斬；跳過鋪滿畫面嘅刀光
  'tate-attack':   { url: anim('tate-attack.mp4'),   keyChannel: 'g', box: FIGURE_BOX, attack: { start: 0.6, strike: 0.84, end: 3.3 } },  // 舉盾衝撞
  // 霧件外套係深綠色，所以用藍幕
  'kiri-attack':   { url: anim('kiri-attack.mp4'),   keyChannel: 'b', box: FIGURE_BOX, attack: { start: 1.0, strike: 1.3, end: 2.6 } },   // 開一槍
  'akari-attack':  { url: anim('akari-attack.mp4'),  keyChannel: 'g', box: FIGURE_BOX },
  'san-attack':    { url: anim('san-attack.mp4'),    keyChannel: 'g', box: FIGURE_BOX, attack: { start: 0.6, strike: 1.62, end: 4.2 } },  // 舉手施放
};
