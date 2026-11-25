// 養成同招募嘅計算（041 第三部分）：角色等級、突破、星級、技能、招募、關卡掉落，同埋「將養成變成戰鬥數值」。
// 純計算，只改傳入嚟嘅 meta（存檔入面嗰份）。數值表喺 src/data/growth.js。

import { HARD, campaignNumbers, endlessNumbers } from '../data/campaign.js';
import { ROSTER, rosterOf } from '../data/characters.js';
import { DROPS, GACHA, HARD_FIRST, ITEMS, LEVEL, RALLY, SKILL, SKILLS, STAR, STAR_EFFECTS } from '../data/growth.js';
import { applyResult, bump, joinedIds, squadMates } from './progress.js';

/** 一個角色嘅養成狀態（冇記錄就係初始：1 級、1 星、技能各 1 級）。lv 等級、br 突破咗幾多次、star 星、sb 爆發技級、sp 被動級、own 由招募攞到。 */
export const charOf = (meta, id) => ({ lv: 1, br: 0, star: 1, sb: 1, sp: 1, own: false, ...(meta.chars?.[id] ?? {}) });
const edit = (meta, id, fn) => { meta.chars ??= {}; const c = charOf(meta, id); fn(c); meta.chars[id] = c; return c; };
/** 有幾多（金幣、晶石、素材、某個角色嘅碎片）。 */
export const have = (meta, item, id) => (item === 'gold' ? meta.gold : item === 'gem' ? meta.gems ?? 0 : item === 'shard' ? meta.shards?.[id] ?? 0 : meta.items?.[item] ?? 0);
const add = (meta, item, n, id) => {
  if (item === 'gold') meta.gold += n; else if (item === 'gem') meta.gems = (meta.gems ?? 0) + n;
  else if (item === 'shard') { meta.shards ??= {}; meta.shards[id] = (meta.shards[id] ?? 0) + n; }
  else { meta.items ??= {}; meta.items[item] = (meta.items[item] ?? 0) + n; }
};
/** 派一批獎勵（[{ item, n, id? }]）入存檔；回傳同一批（畀「獲得物品」彈窗用）。 */
export function grant(meta, rewards) { for (const r of rewards) add(meta, r.item, r.n, r.id); return rewards; }
/** 獎勵 → 彈窗顯示用嘅 { icon, name, amount, rarity }。 */
export const rewardView = (r) => ({ icon: ITEMS[r.item].icon, name: r.item === 'shard' ? `${rosterOf(r.id).name}碎片` : ITEMS[r.item].name, amount: r.n, rarity: ITEMS[r.item].rarity });
/** 將同一樣嘢嘅獎勵合併（十連出好多重複）。 */
export function mergeRewards(list) {
  const out = [];
  for (const r of list) { const o = out.find((x) => x.item === r.item && x.id === r.id); if (o) o.n += r.n; else out.push({ ...r }); }
  return out;
}

// ---------- 等級同突破 ----------
/** 而家最高升到幾多級（未突破嘅上限）。 */
export const levelCap = (c) => Math.min(LEVEL.max, LEVEL.step * (c.br + 1));
/** 下一步係乜：'max' 滿級、'break' 要突破、'level' 升一級；連成本同夠唔夠。 */
export function nextLevel(meta, id) {
  const c = charOf(meta, id);
  if (c.lv >= LEVEL.max) return { kind: 'max', ok: false, cost: [] };
  const kind = c.lv >= levelCap(c) ? 'break' : 'level';
  const cost = kind === 'break' ? [{ item: 'core', n: LEVEL.breakCore[c.br] }, { item: 'gold', n: LEVEL.breakGold[c.br] }] : [{ item: 'exp', n: LEVEL.exp(c.lv) }, { item: 'gold', n: LEVEL.gold(c.lv) }];
  return { kind, cost, ok: cost.every((x) => have(meta, x.item) >= x.n) };
}
const pay = (meta, cost) => { for (const x of cost) add(meta, x.item, -x.n, x.id); };
/** 升一級或者突破一次（睇而家輪到邊樣）。夠先做，做到回傳 true。 */
export function levelUp(meta, id) {
  if (!joinedIds(meta).includes(id)) return false;
  const n = nextLevel(meta, id);
  if (!n.ok) return false;
  pay(meta, n.cost); edit(meta, id, (c) => { if (n.kind === 'break') c.br++; else c.lv++; });
  if (n.kind === 'level') bump(meta, 'levels');
  return true;
}

// ---------- 星級 ----------
/** 升星要幾多、有幾多：own = 呢個角色自己嘅碎片，wild = 萬能碎片（自己嗰啲唔夠先用佢補）。 */
export function nextStar(meta, id) {
  const c = charOf(meta, id), own = have(meta, 'shard', id), wild = have(meta, 'wild');
  if (c.star >= STAR.max) return { ok: false, max: true, need: 0, have: own, own, wild, useWild: 0 };
  const need = STAR.shards[c.star], useWild = Math.max(0, need - own);
  return { ok: own + wild >= need, max: false, need, have: own + wild, own, wild, useWild: Math.min(useWild, wild) };
}
export function starUp(meta, id) {
  if (!joinedIds(meta).includes(id)) return false;
  const n = nextStar(meta, id);
  if (!n.ok) return false;
  add(meta, 'shard', -(n.need - n.useWild), id); if (n.useWild) add(meta, 'wild', -n.useWild);
  edit(meta, id, (c) => { c.star++; }); bump(meta, 'starups');
  return true;
}

// ---------- 技能 ----------
const SKEY = { burst: 'sb', passive: 'sp' };
export function nextSkill(meta, id, key) {
  const lv = charOf(meta, id)[SKEY[key]];
  if (lv >= SKILL.max) return { ok: false, max: true, cost: [] };
  const cost = [{ item: 'gold', n: SKILL.gold(lv) }, { item: 'exp', n: SKILL.exp(lv) }];
  return { ok: cost.every((x) => have(meta, x.item) >= x.n), max: false, cost };
}
export function skillUp(meta, id, key) {
  if (!SKEY[key] || !joinedIds(meta).includes(id)) return false;
  const n = nextSkill(meta, id, key);
  if (!n.ok) return false;
  pay(meta, n.cost); edit(meta, id, (c) => { c[SKEY[key]]++; }); bump(meta, 'skills');
  return true;
}
/** 呢個技能而家合共加咗幾多（主要嗰個數）同說明。 */
export function skillNow(id, key, lv) {
  const S = SKILLS[id][key], k = Object.keys(S.per)[0], v = S.per[k] * (lv - 1);
  return { value: v, text: lv > 1 ? S.text(v) : '未有加成', next: S.text(S.per[k] * lv) };
}
/** 有冇嘢升得（隊員頁紅點用）。 */
export const canGrow = (meta, id) => nextLevel(meta, id).ok || nextStar(meta, id).ok || nextSkill(meta, id, 'burst').ok || nextSkill(meta, id, 'passive').ok;

// ---------- 養成 → 戰鬥數值 ----------
/**
 * 一個角色而家嘅戰鬥加成（等級 + 星級 + 技能加埋）。
 * 隊長：{ power 開局戰力加幾多成, burstTime 爆發多幾多秒, charge 爆發槽快幾多成, burstMul }
 * 隊員：{ cfg 戰鬥數值（由角色表嗰份改出嚟）, burstMul 接力時全隊射速倍率加幾多 }
 */
export function charStats(meta, id) {
  const r = rosterOf(id), c = charOf(meta, id), m = {};
  const put = (mod, times = 1) => { for (const [k, v] of Object.entries(mod)) { if (k === 'half' || k === 'blastHalf' || k === 'droneRate') m[k] = (m[k] ?? 1) * v ** times; else m[k] = (m[k] ?? 0) + v * times; } };
  for (const e of STAR_EFFECTS[id] ?? []) if (c.star >= e.star) put(e.mod);
  if (SKILLS[id]) { put(SKILLS[id].burst.per, c.sb - 1); put(SKILLS[id].passive.per, c.sp - 1); }
  if (r.leader) return { power: LEVEL.leaderPower * (c.lv - 1) + (m.power ?? 0), burstTime: m.burstTime ?? 0, charge: m.charge ?? 0, burstMul: m.burstMul ?? 0 };
  const B = r.battle, share = (1 + LEVEL.mateShare * (c.lv - 1)) * (1 + (m.share ?? 0));
  const cfg = { ...B, share: B.share * share, pierce: B.pierce + (m.pierce ?? 0), half: B.half * (m.half ?? 1), near: B.near + (m.near ?? 0) };
  if (B.guard) cfg.guard = { every: Math.max(3, B.guard.every + (m.guardEvery ?? 0)), window: B.guard.window + (m.guardWindow ?? 0) };
  if (B.blast) cfg.blast = { ...B.blast, half: B.blast.half * (m.blastHalf ?? 1), rows: B.blast.rows + (m.blastRows ?? 0) };
  if (B.drone) cfg.drone = { ...B.drone, share: B.drone.share * share, interval: B.drone.interval / (m.droneRate ?? 1) };
  return { cfg, burstMul: m.burstMul ?? 0, share };
}

/**
 * 開打第 n 關要用嘅嘢：numbers 畀 useNumbers()；opts 畀 createColumnBattle()（邊啲隊員、佢哋養成後嘅數值、隊長嘅加成）。
 * mates 唔填 = 照存檔嘅編隊。主程式同自動試玩都用呢個，唔好各自砌。
 */
/** 連敗支援：呢關（普通／困難分開計）而家疊咗幾多次、加幾多成開局戰力。 */
export function rallyOf(meta, n, hard = false) {
  const r = meta.rally, hit = r && r.n === n && !!r.hard === !!hard ? Math.min(RALLY.max, r.fails) : 0;
  return { fails: hit, bonus: hit * RALLY.per };
}
export function battleSetup(meta, n, mates = squadMates(meta), mode = {}) { // mode.hard = 困難模式；mode.endless = 無盡模式（n 唔理）
  const lead = charStats(meta, ROSTER.find((r) => r.leader).id), mateCfg = {}; let burstMul = lead.burstMul;
  for (const id of mates) { const s = charStats(meta, id); mateCfg[id] = s.cfg; burstMul += s.burstMul; }
  const power = mode.endless ? lead.power : (1 + lead.power) * (1 + rallyOf(meta, n, mode.hard).bonus) - 1; // 隊長養成 × 連敗支援
  return { numbers: mode.endless ? endlessNumbers(meta.upgrades, { power }) : campaignNumbers(n, meta.upgrades, { power }, mode), opts: { mates, mateCfg, boost: { charge: 1 + lead.charge, burstTime: lead.burstTime, burstMul } } };
}

// ---------- 關卡掉落 ----------
/**
 * 一局打完掉乜（未派入存檔）。before = 打之前呢關嘅紀錄 { stars }；stars = 今次攞到幾多星。
 * @returns {{ replay: object[], first: object[], stars: object[], all: object[] }}
 */
export function stageDrops(n, { won, stars = 0, progress = 0 }, before = { stars: 0 }, hard = false) {
  const k = won ? 1 : DROPS.lose[0] + (DROPS.lose[1] - DROPS.lose[0]) * Math.max(0, Math.min(1, progress));
  const replay = DROPS.replay(n).filter((r) => won || r.item === 'exp').map((r) => ({ ...r, n: Math.max(1, Math.round(r.n * k * (hard ? HARD.drop : 1))) }));
  const first = won && !(before.stars > 0) ? (hard ? HARD_FIRST(n) : DROPS.first(n)) : [], star = [];
  if (won && !hard) DROPS.stars(n).forEach((list, i) => { if (stars >= i + 1 && before.stars < i + 1) star.push(...list); });
  return { replay, first, stars: star, all: mergeRewards([...replay, ...first, ...star]) };
}

/**
 * 一局打完：計星數、金幣（applyResult），再派關卡掉落。主程式同自動試玩都用呢個。
 * @returns {ReturnType<typeof applyResult> & { drops: ReturnType<typeof stageDrops> }}
 */
export function finishStage(meta, n, result, mode = {}) {
  const hard = !!mode.hard, book = hard ? meta.hard ?? {} : meta.stages, before = { stars: book[n]?.stars ?? 0 }, out = applyResult(meta, n, result, hard);
  const drops = stageDrops(n, { won: result.won, stars: out.stars, progress: result.progress ?? 0 }, before, hard);
  grant(meta, drops.all);
  // 統計（每日任務、成就用）
  bump(meta, 'plays'); bump(meta, 'kills', result.kills ?? 0); bump(meta, 'bursts', result.bursts ?? 0);
  if (result.won) { bump(meta, 'clears'); bump(meta, 'bosses'); bump(meta, 'newStars', Math.max(0, out.stars - before.stars)); }
  // 連敗支援：輸咗就疊一次（淨係計同一關連續輸），贏咗清
  if (result.won) meta.rally = null; else { const r = meta.rally; meta.rally = { n, hard, fails: r && r.n === n && !!r.hard === hard ? r.fails + 1 : 1 }; }
  return { ...out, drops };
}

// ---------- 招募 ----------
/** 招募一次要幾多：有招募券就用券，否則用晶石。回傳 { item, n, ok }。 */
export function pullCost(meta, count = 1) {
  if (have(meta, 'ticket') >= count) return { item: 'ticket', n: count, ok: true };
  return { item: 'gem', n: GACHA.gem * count, ok: have(meta, 'gem') >= GACHA.gem * count };
}
/** 仲有幾多次保底（連續冇出傳說嘅次數到 GACHA.pity 就必出）。 */
export const pityLeft = (meta) => GACHA.pity - (meta.gacha?.pity ?? 0);
/**
 * 招募 count 次（1 或 10）。rng() 回傳 0 至 1。夠先抽；回傳每一次嘅結果 [{ rarity, tier, item, n, id?, isNew?, dupe? }]，唔夠回傳 null。
 * 結果已經派入存檔。十連保證最少一個史詩或以上（最後一抽補）。
 */
export function pull(meta, count, rng) {
  const cost = pullCost(meta, count);
  if (!cost.ok) return null;
  add(meta, cost.item, -cost.n);
  meta.gacha ??= { pity: 0, total: 0 };
  const out = [], T = GACHA.tiers, ids = ROSTER.map((r) => r.id);
  for (let i = 0; i < count; i++) {
    let roll = rng(), tier = T[T.length - 1];
    for (const t of T) { if (roll < t.p) { tier = t; break; } roll -= t.p; }
    if (meta.gacha.pity + 1 >= GACHA.pity) tier = T[0];                                                   // 保底
    else if (count >= GACHA.ten && i === count - 1 && !out.some((o) => o.rarity >= GACHA.tenFloor) && tier.rarity < GACHA.tenFloor) tier = T.find((t) => t.rarity === GACHA.tenFloor); // 十連保證
    meta.gacha.total++; meta.gacha.pity = tier.rarity >= 4 ? 0 : meta.gacha.pity + 1; bump(meta, 'pulls');
    const res = { rarity: tier.rarity, tier: tier.name };
    if (tier.kind === 'char') {
      const id = ids[Math.floor(rng() * ids.length) % ids.length];
      if (joinedIds(meta).includes(id)) { add(meta, 'shard', STAR.dupe, id); Object.assign(res, { item: 'shard', n: STAR.dupe, id, dupe: true }); }
      else { edit(meta, id, (c) => { c.own = true; }); Object.assign(res, { item: 'char', n: 1, id, isNew: true }); }
    } else if (tier.kind === 'shard') { const id = ids[Math.floor(rng() * ids.length) % ids.length]; add(meta, 'shard', tier.n, id); Object.assign(res, { item: 'shard', n: tier.n, id }); }
    else { const p = tier.pick[Math.floor(rng() * tier.pick.length) % tier.pick.length]; add(meta, p.item, p.n); Object.assign(res, { item: p.item, n: p.n }); }
    out.push(res);
  }
  return out;
}
/** 招募畫面寫明嘅機率表（由數值表直接讀）：[{ name, rarity, percent, what }]。 */
export const gachaRates = () => GACHA.tiers.map((t) => ({ name: t.name, rarity: t.rarity, percent: Math.round(t.p * 1000) / 10, what: t.kind === 'char' ? `整個角色（${ROSTER.length} 個隨機一個；已經有就變 ${STAR.dupe} 塊碎片）` : t.kind === 'shard' ? `角色碎片 ×${t.n}（${ROSTER.length} 個角色隨機一個）` : t.pick.map((p) => `${ITEMS[p.item].name} ×${p.n}`).join(' 或 ') }));
