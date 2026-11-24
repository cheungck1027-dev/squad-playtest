// 入口：將各個模組接埋一齊。而家只有戰鬥一個畫面，開頁就直接開打。
// 預設係「三線長列」版（src/column/：斜鏡頭、磚列、數字路障、方陣、彈幕），戰鬥畫面用 3D 畫（?view=2d 開返 2D 畫法對照）；
// 網址加 ?mode=top 開返頂視版（src/crowd/）做對比；?mode=lanes 開返最舊嗰個三車道、背後視角版本（src/battle/）。

import { loadAssets } from './core/assets.js';
import { loadClips } from './core/clips.js';
import { createLoop } from './core/loop.js';
import { createSave } from './core/save.js';
import { HIT_SOUND, SHOT_SOUND, createAudio } from './core/audio.js';
import { attachBattleControls } from './battle/controls.js';
import { createBattleRenderer } from './battle/render.js';
import { makePickup } from './battle/spawning.js';
import { createBattle } from './battle/state.js';
import { setLane, triggerOverdrive, updateBattle } from './battle/update.js';
import { ASSET_MANIFEST, CLIP_MANIFEST, unitClipKey, unitCutinKey } from './data/assets.js';
import { CHARACTERS, MATE_IDS, MAX_MATES, rosterOf } from './data/characters.js';
import { useNumbers } from './data/column.js';
import { STAGE_COUNT, campaignNumbers, progressOf } from './data/campaign.js';
import { applyResult, buyUpgrade, joinedIds, nextStage, setFace, setMateOut, squadMates } from './meta/progress.js';
import { createCampaignUI } from './meta/ui.js';
import { WEAPONS } from './data/weapons.js';
import { CROWD } from './data/crowd.js';
import { TUNING } from './data/tuning.js';
import { createCrowdBattle, setTarget, updateCrowd } from './crowd/battle.js';
import { attachCrowdControls } from './crowd/controls.js';
import { probeDefaultMotion, probeFormClips } from './crowd/form-clips.js';
import { createCrowdRenderer } from './crowd/render.js';
import { confirmResult, createColumnBattle, resultReady, triggerBurst, updateColumn } from './column/battle.js';
import { createColumnRenderer } from './column/render.js';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('c'));

const save = createSave();
save.load();

// 網址參數（除錯用，未有選隊畫面）：
//   ?form=2 / 3 / 4                             測試用：開場直接係嗰個形態、戰力係嗰個形態嘅門檻（預設版同頂視版都得）
//   ?view=2d                                    預設版嘅戰鬥畫面用返 2D 畫法（預設係 3D：Three.js；規則、關卡、操作一樣，只換畫法）
//   ?fps=1                                      3D：左下角顯示即時更新率、最近 5 秒最慢嗰格、而家嘅像素比
//   ?dpr=1.5                                    3D：釘死 WebGL 層嘅像素比上限（唔自動降級；試效能用）
//   ?mode=top                                   頂視版（之前嘅預設），同新版對比用
//   ?mode=lanes                                 最舊版：三車道、背後視角
//   ?squad=falcon,mist,bulwark,lantern,abacus   指定小隊（第一個係隊長）
//   ?still                                      唔播動畫片段，全部用靜態圖
//   ?cpukey                                     去背唔用顯示卡，改用處理器後備方法（比較成本用）
//   ?mates=suzu,kiri                            開發用：直接帶呢啲隊員出戰（唔理入咗隊未）；?mates=0 = 唔帶；唔填 = 照存檔嘅編隊
const params = new URLSearchParams(location.search);
const mode = params.get('mode') === 'lanes' ? 'lanes' : params.get('mode') === 'top' ? 'top' : 'column';
const crowd = mode !== 'lanes';        // 單主角、戰力、進化嗰套（頂視版同三線長列版共用）
const column = mode === 'column';
// 數值：預設大數字（K / M / B）；?nums=classic 用返舊數值比較。只關三線長列版事
// 十關版（預設）：標題 → 關卡地圖 → 戰鬥 → 結算 → 升級，數值每關一套（data/campaign.js）。
// ?pace=1|2|3、?nums=classic 係舊嘅單關比較版，冇關外流程。
const campaign = column && !params.has('pace') && params.get('nums') !== 'classic';
if (column && !campaign) useNumbers(params.get('nums') === 'classic' ? 'classic' : `pace${['1', '2', '3'].includes(params.get('pace')) ? params.get('pace') : '2'}`); // ?pace=1 慢、2 中、3 快
// 開發用：?reset=1 清存檔；?gold=N 設金幣；?unlock=1 全部關解鎖；?stage=N 直接打第 N 關
if (campaign) {
  if (params.get('reset') === '1') save.reset();
  if (params.has('gold')) save.updateMeta((m) => { m.gold = Math.max(0, parseInt(params.get('gold'), 10) || 0); });
  if (params.get('unlock') === '1') save.updateMeta((m) => { for (let n = 1; n <= STAGE_COUNT; n++) m.stages[n] = { stars: Math.max(1, m.stages[n]?.stars ?? 0), best: m.stages[n]?.best ?? 0 }; });
}
const stageParam = Math.max(0, Math.min(STAGE_COUNT, parseInt(params.get('stage') ?? '0', 10) || 0));
// 而家打緊第幾關（十關版）；網址有 ?stage / ?weapon / ?form 就唔經標題，直接開打
let stageNow = campaign ? stageParam || 1 : 1;
const directStart = !campaign || stageParam > 0 || params.has('weapon') || params.has('form');
if (campaign) useNumbers(campaignNumbers(stageNow, save.data.meta.upgrades));
const want3d = column && params.get('view') !== '2d'; // 戰鬥畫面預設係 3D；?view=2d 開返原本嘅 2D 畫法（規則一樣，對照用）
const squadParam = (params.get('squad') || '').split(',').map((s) => s.trim()).filter((id) => CHARACTERS[id]);
const startOpts = squadParam.length ? { squad: [...new Set(squadParam)].slice(0, 5) } : {};

// 3D 畫面只用到變身特寫圖（主角、敵人、場景都係模型）：其餘圖片（舊版嘅隊員、背景、敵人，合共廿幾 MB）唔好落，費事同模型爭頻寬。
// 開唔到 3D 要用返 2D 畫法嗰陣，先至補返成份清單。
const cutinKeys = new Set(CROWD.evolution.forms.map((_, f) => unitCutinKey(f)).filter(Boolean));
let assets = loadAssets(want3d ? Object.fromEntries(Object.entries(ASSET_MANIFEST).filter(([key]) => cutinKeys.has(key))) : ASSET_MANIFEST);
const clips = loadClips(CLIP_MANIFEST, {
  profiles: { leader: TUNING.clips.leader, member: TUNING.clips.member, unit: TUNING.clips.unit },
  key: TUNING.clips.key,
  memberKeysPerFrame: TUNING.clips.memberKeysPerFrame,
  attackLead: TUNING.clips.attackLead,
  edgeFeather: TUNING.clips.edgeFeather,
  enabled: !params.has('still'),
  gpu: !params.has('cpukey'),
});
// ?weapon=N：由第 N 級武器開始（1 起計；只限大數字版），形態跟住嗰級武器
const startWeapon = column && params.get('nums') !== 'classic' ? Math.max(0, Math.min(WEAPONS.length, parseInt(params.get('weapon') ?? '0', 10) || 0)) : 0;
const startForm = startWeapon ? WEAPONS[startWeapon - 1].form : Math.max(0, (parseInt(params.get('form') ?? '1', 10) || 1) - 1);
const matesParam = column && params.has('mates') ? (/^\d+$/.test(params.get('mates')) ? MATE_IDS.slice(0, parseInt(params.get('mates'), 10)) : params.get('mates').split(',').map((v) => v.trim()).filter((id) => MATE_IDS.includes(id))).slice(0, MAX_MATES) : null;
/** 今場邊啲隊員出戰：網址指定咗就用嗰啲；否則十關版照存檔嘅編隊（入咗隊、冇休息嘅）。 */
const matesNow = () => matesParam ?? (campaign ? squadMates(save.data.meta) : []);
const rendererOpts = { noCoat: params.get('coat') === '0', mates: matesParam ?? MATE_IDS.filter((id) => campaign && joinedIds(save.data.meta).includes(id)), screenShake: () => save.data.settings.screenShake, clips, startForm, showFps: params.get('fps') === '1', pixelRatio: parseFloat(params.get('dpr') ?? '') || 0, scene: params.get('scene'), hero: params.get('hero') };
// 3D 顯示層用到 Three.js（約 1.3 MB），用到先載入，2D 版唔受影響。部機開唔到 WebGL（或者載入唔到）就用返 2D 畫法。
let renderer3d = null;
if (want3d) {
  try { renderer3d = (await import('./column/render3d.js')).createColumnRenderer3D(canvas, assets, rendererOpts); }
  catch (err) { console.warn('開唔到 3D 畫面，用返 2D', err); assets = loadAssets(ASSET_MANIFEST); }
}
const view3d = !!renderer3d;
document.getElementById('boot')?.remove(); // 程式到咗：收起 index.html 嗰行「載入中」（3D 有自己嘅進度畫面）
const renderer = renderer3d ?? (column ? createColumnRenderer(canvas, assets, rendererOpts) : crowd ? createCrowdRenderer(canvas, assets, rendererOpts) : createBattleRenderer(canvas, assets, rendererOpts));
const newBattle = (opts) => (column ? createColumnBattle({ startForm, startWeapon, mates: matesNow(), ...opts }) : crowd ? createCrowdBattle({ startForm, ...opts }) : createBattle({ ...startOpts, ...opts }));
let battle = newBattle({ stageNo: stageNow });

function update(dt) {
  if (column) updateColumn(battle, dt); else if (crowd) updateCrowd(battle, dt); else updateBattle(battle, dt);
  for (const ev of battle.events) {
    if (ev.type === 'stageClear') save.recordStageCleared(ev.stage);
    if (column) soundFor(ev);
  }
  if (campaign) campaignTick();
}

// ---------- 聲音同震動（core/audio.js；全部程式合成）。?mute=1 全靜音（自動測試用） ----------
const audio = createAudio({ settings: () => save.data.settings, mute: params.get('mute') === '1' });
for (const type of ['pointerdown', 'keydown', 'touchstart']) addEventListener(type, () => audio.unlock(), { passive: true });
document.addEventListener('visibilitychange', () => audio.setHidden(document.hidden));
let buzzAt = -9;
/** 一個戰鬥事件 → 邊把聲、震唔震。聲音只收事件，唔掂規則。 */
function soundFor(ev) {
  const buzz = (name, gap = 0.6) => { if (battle.t - buzzAt >= gap || battle.t < buzzAt) { buzzAt = battle.t; audio.vibrate(name); } };
  switch (ev.type) {
    case 'fire': audio.play(ev.weapon >= 0 ? SHOT_SOUND[WEAPONS[ev.weapon].id] : 'shot_tracer'); break;
    case 'hit': audio.play(HIT_SOUND[ev.on] ?? 'hit_grunt'); break;
    case 'brick': if (ev.prize) audio.play('prize'); else audio.brick(); break;
    case 'gate': audio.play(!ev.good ? 'gate_bad' : ev.op === 'mul' ? 'gate_mul' : 'gate_add'); if (!ev.good) buzz('gate_bad', 0.2); break;
    case 'hurt': audio.play('hurt'); buzz('hurt'); break;
    case 'weaponUp': audio.play('weapon_up'); break;
    case 'evolve': audio.play('evolve'); buzz('evolve', 0.2); break;
    case 'burstReady': audio.play('burst_ready'); break;
    case 'burstGo': audio.play(ev.full ? 'burst_relay' : 'burst_go'); audio.play('burst_hum'); buzz('evolve', 0.2); break;
    case 'mateFire': audio.play(rosterOf(ev.id)?.battle?.sound ?? 'shot_tracer'); break;
    case 'burstEnd': audio.play('burst_end'); break;
    case 'barrierBroken': audio.play('wall_break'); buzz('wall_break', 0.2); break;
    case 'miniBossDown': audio.play('mini_down'); break;
    case 'bossIn': audio.play('boss_in'); audio.music('boss'); break;
    case 'slamWarn': audio.play('slam_warn'); break;
    case 'bossSlam': audio.play('slam'); break;
    case 'bossPhase': audio.play('boss_rage'); break;
    case 'stageClear': audio.play('boss_down'); audio.play('win'); buzz('boss_down', 0); audio.music(null); break;
    case 'defeat': audio.play('lose'); buzz('lose', 0); audio.music(null); break;
    default: break;
  }
}

// ---------- 十關版嘅關外流程 ----------
let ui = null, resultShown = false, userPaused = false;
const HINTS = [[1.2, 'move', '左右拖動，移動主角'], [6.5, 'gate', '射加數門，個數會越射越大'], [11.5, 'sub', '避開紅色嘅減數門']];
/** 開打第 n 關（照而家嘅升級）。 */
function startStage(n) {
  stageNow = Math.max(1, Math.min(STAGE_COUNT, n));
  useNumbers(campaignNumbers(stageNow, save.data.meta.upgrades));
  battle = newBattle({ stageNo: stageNow });
  resultShown = false;
  audio.music('battle');
  ui?.hide();
  if (!userPaused && startedAt) loop.start();
}
function campaignTick() {
  // 第 1 關嘅引導：頭 15 秒內三句，各出現一次（存檔記住）
  if (stageNow === 1 && battle.phase === 'run' && ui) for (const [t, key, text] of HINTS) {
    if (battle.t >= t && battle.t < t + 0.5 && !save.data.meta.hints[key]) { save.updateMeta((m) => { m.hints[key] = true; }); ui.hint(text); }
  }
  // 打完（又停夠咗）：計星數、金幣，存檔，出結算
  if (!resultShown && resultReady(battle)) {
    resultShown = true;
    const won = battle.phase === 'clear';
    let out = null;
    const before = joinedIds(save.data.meta);
    // 進度：行咗關卡幾多成、首領打走幾多成（輸咗嘅金幣按呢個畀）
    const progress = progressOf(battle.dist / battle.stage.len, battle.boss ? 1 - Math.max(0, battle.boss.hp) / battle.boss.max : 0);
    save.updateMeta((m) => { out = applyResult(m, stageNow, { won, left: battle.power, peak: battle.peak, kills: battle.kills, progress }); });
    // 過咗某幾關有新隊員入隊：結算之後插入「新隊員加入」畫面
    const joined = joinedIds(save.data.meta).filter((id) => !before.includes(id));
    ui?.result({ stageNo: stageNow, won, stars: out.stars, peak: battle.peak, gold: out.gold, firstClear: out.firstClear, joined });
  }
}

try { sessionStorage.removeItem('reloaded'); } catch { /* 冇得用就算 */ } // 今次載入到：下次再失敗可以再自動重試一次（見 index.html）

const loop = createLoop({ update, draw: () => { renderer.draw(battle); ui?.hud(battle); }, step: TUNING.fixedStep });
if (campaign) {
  // 返到標題／大廳／地圖：戰鬥畫面遮住晒，停咗個循環慳電
  ui = createCampaignUI({ getMeta: () => save.data.meta, onPlay: startStage, onBurst: () => triggerBurst(battle),
    onSquad: (id, out) => { let ok = false; save.updateMeta((m) => { ok = setMateOut(m, id, out); }); return ok; }, onFace: (id) => { let ok = false; save.updateMeta((m) => { ok = setFace(m, id); }); return ok; },
    onScreen: (name) => { if (['title', 'lobby', 'team', 'detail', 'lineup', 'join', 'map'].includes(name)) loop.stop(); if (['title', 'lobby', 'team', 'detail', 'lineup', 'map', 'upgrades', 'settings'].includes(name)) audio.music('map'); },
    inBattle: () => battle.phase === 'run' || battle.phase === 'boss',
    onSound: (name) => audio.play(name), onMusic: (name) => audio.music(name), soundNames: () => audio.list(),
    getSettings: () => save.data.settings, onSettings: (patch) => { save.updateSettings(patch); audio.applyVolumes(); },
    onPause: () => loop.stop(), onResume: () => { if (!userPaused) loop.start(); }, onBuy: (key) => { let ok = false; save.updateMeta((m) => { ok = buyUpgrade(m, key); }); return ok; } });
  if (!directStart) ui.title();
}

addEventListener('resize', renderer.resize);
renderer.resize();
if (column) {
  attachCrowdControls(canvas, () => battle, (nx) => renderer.view.cam.worldX(nx));
  // 結算畫面：等玩家撳一下（或者按 Enter / 空白鍵）先重開 / 入下一關，唔會自動行
  // （十關版嘅結算用關外畫面嘅掣，唔係撳畫布）
  canvas.addEventListener('pointerdown', () => { if (!campaign) confirmResult(battle); });
  addEventListener('keydown', (e) => { if (!campaign && (e.key === 'Enter' || e.key === ' ')) confirmResult(battle); });
  addEventListener('keydown', (e) => { if (e.key === 'b' || e.key === 'B' || (campaign && e.key === ' ')) triggerBurst(battle); }); // 鍵盤：B（十關版空白鍵都得）放爆發技
}
else if (crowd) attachCrowdControls(canvas, () => battle); else attachBattleControls(canvas, () => battle);
// 預先載入隊長嘅飛行片：執到道具嗰刻即刻有畫面，唔使等
if (!crowd && TUNING.flight.enabled) for (const key of Object.values(battle.leader.char.assets.motion ?? {})) if (CLIP_MANIFEST[key]) clips.preload(key, 'leader');
let startedAt = 0; // 3D：開頁之後第幾毫秒開始行（量載入時間用）
if (view3d) {
  // 3D：第一批模型（形態 I、開場形態、小敵人、首領）載入晒（載入唔到都照行，缺嘅嘢唔畫）先開始，期間畫面顯示進度；
  // 其餘形態嘅模型開始之後喺背景載入。唔使等圖片（得變身特寫圖，進化嗰刻先用）同跑步片。
  renderer.ready.catch((err) => console.error('3D 模型載入唔到', err))
    .then(() => { startedAt = Math.round(performance.now()); if (directStart || ui?.screen === 'none') loop.start(); }); // 十關版：仲喺標題／地圖就唔行住，出擊先開始
} else if (crowd) {
  // 單主角版（頂視、三線長列）：圖片一有結果就畫第一格（唔會空白）；再等一陣睇各形態嘅跑步片到咗未、主角條片播唔播得
  // （合共最多約 1.5 秒）先開始行。片再遲啲先得都唔緊要：未播得之前用靜態主圖頂住，播得就自動換。
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  let started = false;
  assets.ready().then(() => { if (!started) renderer.draw(battle); });
  const probing = params.has('still') ? Promise.resolve([]) : probeFormClips();
  // 其他形態嘅片：開始咗先預載，唔好同開場嗰條爭；進化嗰刻就即刻有片
  probing.then(async (forms) => { await ready; for (const f of forms) clips.preload(unitClipKey(f, 0), 'unit'); });
  const clipSettled = Promise.race([probing, wait(800)]).then(() => {
    const key = unitClipKey(battle.form, 0); // 用靜態主圖嘅形態冇片要等
    if (key) clips.preload(key, 'unit');
    return new Promise((resolve) => {
      const t0 = performance.now();
      const poll = () => (!key || clips.report()[key] !== 'loading' || performance.now() - t0 > 700 ? resolve(undefined) : setTimeout(poll, 50));
      poll();
    });
  });
  const ready = Promise.all([assets.ready(), clipSettled]).then(() => { started = true; loop.start(); });
} else {
  // 最舊版：隊長條片嘅逐格資料（槍口、對位）都由 motion.json 讀；最多等 0.8 秒，讀唔到就用設定入面抄落嚟嗰份
  const settled = params.has('still') ? Promise.resolve(false) : probeDefaultMotion();
  Promise.race([settled, new Promise((resolve) => setTimeout(resolve, 800))]).then(() => loop.start());
}

// 分頁隱藏時停片（唔好白白解碼）；返嚟再播。瀏覽器唔俾自動播放嘅話，用戶第一下操作再試。
document.addEventListener('visibilitychange', () => clips.setPaused(document.hidden));
addEventListener('pointerdown', () => clips.resume());
addEventListener('keydown', () => clips.resume());

// 除錯工具：喺主控台或者自動化腳本用。分頁隱藏咗、畫面唔重繪嗰陣，用 step(n) 一樣推得郁。
globalThis.__game = {
  /** 行 n 個固定步長（每步 1/60 秒）再畫一次 */
  step: (n = 1) => loop.advance(n),
  /** 而家嘅戰鬥狀態（係本尊，改佢會即時生效） */
  state: () => battle,
  /** 每個素材用緊邊個檔；冇載入到就係 'fallback' */
  assets: () => assets.report(),
  /** 全部素材有結果（載入到或者確定冇）先完成 */
  assetsReady: () => assets.ready(),
  /** 而家嘅存檔內容 */
  save: () => save.data,
  setLane: (lane) => setLane(battle, lane),
  /** 而家係邊個版本：'column'（三線長列）、'top'（頂視）、'lanes'（最舊） */
  mode,
  /** 3D 畫面：模型面數、載入時間、更新率、上一格畫咗幾多三角形；用緊 2D 畫法就係 null */
  view3d: () => (view3d ? renderer.report() : null),
  /** 3D：開頁之後第幾毫秒可以開始玩（未開始 = 0） */
  startedAt: () => startedAt,
  /** 3D：近鏡睇主角 closeup({ yaw, pitch, dist, x, y, z })；closeup(null) 返正常 */
  closeup: (o) => (view3d ? renderer.closeup(o) : undefined),
  /** 3D：等顯示卡畫完先返（量每格時間用） */
  finish: () => (view3d ? renderer.finish() : undefined),
  /** 單主角版：主角想去嘅橫向位置（−1 至 1） */
  setX: (x) => setTarget(battle, x),
  overdrive: () => triggerOverdrive(battle),
  /** 三線長列版：放爆發技（槽未滿就冇反應，回傳 false）；burst(true) = 開發用，即刻儲滿再放 */
  burst: (fill) => { if (fill && battle.burst) battle.burst.charge = 1; return triggerBurst(battle); },
  /** 喺指定車道放一粒飛行核心（d = 離隊長幾遠）；試飛行用 */
  spawnCore: (lane = battle.lane, d = 30) => { battle.ents.push(makePickup('flightCore', lane, d)); },
  /** 三線長列版：結算畫面撳一下（重開 / 入下一關）；未去到結算就乜都唔做 */
  confirm: () => confirmResult(battle),
  /** 停止 / 恢復自動更新（停咗之後仍然可以用 step） */
  pause: () => { userPaused = true; loop.stop(); },
  resume: () => { userPaused = false; loop.start(); },
  /** 重新開一場：restart({ stageNo, squad, seed })；唔填 squad 就用返開頁嗰隊 */
  restart: (opts) => {
    if (campaign) { startStage(opts?.stageNo ?? stageNow); if (opts && Object.keys(opts).some((k) => k !== 'stageNo')) battle = newBattle({ stageNo: stageNow, ...opts }); return battle; }
    battle = newBattle(opts ?? {}); return battle;
  },
  /** 十關版：meta = 存檔入面嘅進度；screen = 而家關外畫面（'none' = 打緊）；show(名) 開某個畫面；start(n) 開打第 n 關 */
  /** 聲音：sfx('名') 播一把聲；sfxList() 全部名；music('map'|'battle'|'boss'|null)；audio() 狀態（開咗未、幾多把聲、限流擋咗幾多） */
  sfx: (name) => audio.play(name), sfxList: () => audio.list(), music: (name) => audio.music(name), audio: () => audio.report(),
  campaign: campaign ? { meta: () => save.data.meta, stage: () => stageNow, screen: () => ui.screen, show: (name, arg) => ui[name](arg), start: (n) => startStage(n) } : null,
  /** 每條動畫片段嘅狀態：playing / paused / loading / fallback（fallback = 用緊靜態圖） */
  clips: () => clips.report(),
  /** 由上次叫到而家嘅每格成本：draw = 成個重繪，clips = 每條片每次去背用幾耐、每秒幾多次 */
  perf: () => ({ mode: clips.mode(), draw: renderer.takePerf(), clips: clips.stats() }),
  /** 全部片跳去第幾秒（分頁隱藏、片唔自己行嗰陣用嚟睇唔同動作） */
  seekClips: (seconds) => clips.seekAll(seconds),
};
