// 十關版嘅進度：過關紀錄、金幣、買升級。純計算，只改傳入嚟嘅 meta（存檔入面嗰份，見 core/save.js 嘅 MetaSave）。
// 介面同存檔之間只經呢個檔同 save.updateMeta()，之後要接雲端存檔改一處就得。

import { STAGE_COUNT, STAGES, UPGRADES, goldFor, stageForms, starsFor, upgradeCost } from '../data/campaign.js';
import { MAX_MATES, ROSTER, rosterOf } from '../data/characters.js';
import { CHAPTERS, UNLOCKS, storyKey, unlockKey } from '../data/story.js';

/** 第 n 關而家玩唔玩得：第 1 關一定得；之後要過咗上一關。困難模式（hard）：要通晒主線，再逐關開。 */
export const stageUnlocked = (meta, n, hard = false) => (hard ? (meta.stages[STAGE_COUNT]?.stars ?? 0) > 0 && (n === 1 || (n >= 1 && n <= STAGE_COUNT && (meta.hard?.[n - 1]?.stars ?? 0) > 0)) : n === 1 || (n >= 1 && n <= STAGE_COUNT && (meta.stages[n - 1]?.stars ?? 0) > 0));
/** 長期統計加數（每日任務同成就都睇呢度；讀數用 meta/live.js 嘅 statValue）。 */
export function bump(meta, stat, n = 1) { if (!(n > 0)) return; meta.stats ??= {}; meta.stats[stat] = (meta.stats[stat] ?? 0) + n; }

/** 第 n 關最高攞過幾多粒星（冇過 = 0）。 */
export const stageStars = (meta, n, hard = false) => (hard ? meta.hard?.[n]?.stars : meta.stages[n]?.stars) ?? 0;

/** 下一關要打邊關：最前嗰個未過嘅；全部過晒就係最後一關。 */
export function nextStage(meta) {
  for (let n = 1; n <= STAGE_COUNT; n++) if (stageStars(meta, n) === 0) return n;
  return STAGE_COUNT;
}

/** 合共幾多粒星。 */
export const totalStars = (meta) => { let s = 0; for (let n = 1; n <= STAGE_COUNT; n++) s += stageStars(meta, n); return s; };

/**
 * 一局打完：計星數同金幣，記入 meta。
 * @param {{ won: boolean, left: number, peak: number, kills: number, progress?: number }} result  left = 首領比拼後剩低嘅戰力；progress = 輸咗嗰陣行到幾遠（0–1，見 campaign.js 嘅 progressOf）
 * @returns {{ stars: number, gold: ReturnType<typeof goldFor>, firstClear: boolean, bestBefore: number }}
 */
export function applyResult(meta, stageNo, result, hard = false) {
  if (hard) meta.hard ??= {};
  const book = hard ? meta.hard : meta.stages; // 困難模式自己一本紀錄
  const before = book[stageNo] ?? { stars: 0, best: 0 }, stars = starsFor(result.won, result.left, result.peak);
  const gold = goldFor(stageNo, { won: result.won, stars, kills: result.kills, progress: result.progress ?? 0 }, before);
  meta.gold += gold.total;
  if (!hard || result.won || book[stageNo]) book[stageNo] = { stars: Math.max(before.stars, stars), best: Math.max(before.best, Math.floor(result.peak)) };
  return { stars, gold, firstClear: result.won && before.stars === 0, bestBefore: before.best };
}

/** 買一級升級：金幣夠、又未滿級先買得。買到回傳 true。 */
export function buyUpgrade(meta, key) {
  if (!UPGRADES[key]) return false;
  const level = meta.upgrades[key] ?? 0, cost = upgradeCost(key, level);
  if (!(cost <= meta.gold)) return false;
  meta.gold -= cost; meta.upgrades[key] = level + 1;
  return true;
}

/** 過咗幾多關。 */
export const clearedCount = (meta) => { let c = 0; for (let n = 1; n <= STAGE_COUNT; n++) if (stageStars(meta, n) > 0) c++; return c; };

/** 指揮官等級（暫時用過關數計）：1 + 過咗幾多關。 */
export const playerLevel = (meta) => 1 + clearedCount(meta);

/**
 * 玩家見過嘅最高形態（0 起計）同最高武器級（1 起計），由關卡紀錄推出嚟（唔使另外存）：
 * 過咗嘅關 = 見過嗰關關尾嘅形態同最高武器級；打過但未過 = 見過嗰關開局嘅形態同武器級。未打過任何關 = 形態 I、第 1 級。
 */
export function seenOf(meta) {
  let form = 0, weapon = 1;
  for (let n = 1; n <= STAGE_COUNT; n++) {
    const rec = meta.stages[n];
    if (!rec) continue;
    const won = rec.stars > 0, [f0, f1] = stageForms(n), [w0, w1] = STAGES[n - 1].weapons;
    form = Math.max(form, won ? f1 : f0); weapon = Math.max(weapon, won ? w1 : w0);
  }
  return { form, weapon };
}

/** 入咗隊嘅角色 id（隊長一定喺度；隊員 = 過咗佢嗰關（由關卡紀錄推出嚟，舊存檔一樣得），或者由招募攞到）。 */
export const joinedIds = (meta) => ROSTER.filter((r) => r.leader || (r.joinAfter > 0 && stageStars(meta, r.joinAfter) > 0) || meta.chars?.[r.id]?.own === true).map((r) => r.id);

/** 出戰嘅隊員 id（入咗隊、冇被擺去休息；最多 MAX_MATES 個）。 */
export const squadMates = (meta) => joinedIds(meta).filter((id) => !rosterOf(id).leader && !(meta.squad?.rest ?? []).includes(id)).slice(0, MAX_MATES);

/** 大廳看板角色 id：玩家揀咗、而且入咗隊嘅；否則隊長。 */
export const faceId = (meta) => { const f = meta.squad?.face; return f && joinedIds(meta).includes(f) ? f : ROSTER.find((r) => r.leader).id; };

/** 編隊：將一個隊員擺去出戰 / 休息。出戰已經滿咗就唔郁（回傳 false）。 */
export function setMateOut(meta, id, out) {
  if (!joinedIds(meta).includes(id) || rosterOf(id).leader) return false;
  meta.squad ??= { rest: [], face: '' };
  const rest = new Set(meta.squad.rest);
  if (out) { if (!rest.has(id)) return true; rest.delete(id); const next = { ...meta, squad: { ...meta.squad, rest: [...rest] } }; if (!squadMates(next).includes(id)) return false; }
  else rest.add(id);
  meta.squad.rest = [...rest];
  return true;
}

/** 設大廳看板角色（要入咗隊）。 */
export function setFace(meta, id) {
  if (!joinedIds(meta).includes(id)) return false;
  meta.squad ??= { rest: [], face: '' }; meta.squad.face = rosterOf(id).leader ? '' : id;
  return true;
}

/** 過咗第 n 關會唔會有新隊員入隊（第一次過先計）：回傳角色 id 列。 */
export const joinsAt = (n) => ROSTER.filter((r) => !r.leader && r.joinAfter === n).map((r) => r.id);

/**
 * 引導、解鎖說明、故事對話「睇過未」嘅鍵，照而家進度應該當睇過嘅嗰批：分步引導、爆發教學、大廳指引；已經開咗嘅系統嘅說明；
 * 已經打過嘅章節開頭、已經通過嘅章節結尾。all = true 就係全部（開發參數 ?guide=0 用）。
 */
export function seenGuideKeys(meta, all = false) {
  const keys = ['tutor', 'burst', 'lobby'];
  for (const u of UNLOCKS) if (u.after > 0 && (all || stageStars(meta, u.after) > 0)) keys.push(unlockKey(u.id));
  for (const ch of CHAPTERS) { if (all || stageStars(meta, ch.from) > 0) keys.push(storyKey(ch, 'in')); if (all || stageStars(meta, ch.to) > 0) keys.push(storyKey(ch, 'out')); }
  return keys;
}
/**
 * 舊存檔（未有分步引導之前玩開嘅：已經有星、又冇「tutor」記號）：當佢已經睇過照進度應該睇過嘅嘢，唔好返轉頭由第 1 關教起、
 * 亦唔好一入大廳就連環彈解鎖說明。全新存檔唔郁。回傳有冇改過。
 */
export function adoptOldSave(meta) {
  if (meta.hints.tutor || totalStars(meta) === 0) return false;
  for (const k of seenGuideKeys(meta)) meta.hints[k] = true;
  return true;
}

