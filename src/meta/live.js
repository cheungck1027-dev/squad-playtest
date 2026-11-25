// 每日內容同長期目標嘅計算（041 第四部分）：統計、每日任務、成就、七日簽到、離線收益、信箱、商店、無盡模式紀錄同每週獎勵、困難模式紀錄。
// 純計算，只改傳入嚟嘅 meta。時間一律由外面傳入（now = 毫秒），日期用本機時間——冇連網，改手機時鐘可以呃到，接受。
// 數值表喺 src/data/live.js。

import { STAGE_COUNT } from '../data/campaign.js';
import { ROSTER } from '../data/characters.js';
import { ACHIEVEMENTS, DAILY_CHEST, DEAL_SLOTS, ENDLESS_RUN, ENDLESS_TIERS, LOGIN, MAILS, MISSIONS, MISSION_COUNT, OFFLINE, RECORDS, SHOP } from '../data/live.js';
import { unlockOf } from '../data/story.js';
import { charOf, grant, have } from './growth.js';
import { bump, clearedCount, joinedIds, stageStars, totalStars } from './progress.js';

const pad = (n) => String(n).padStart(2, '0');
/** 本機日期鍵 'YYYY-MM-DD'。 */
export const dayKey = (now) => { const d = new Date(now); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
/** 呢個日期鍵之前一日。 */
export const prevDay = (key) => { const [y, m, d] = key.split('-').map(Number), t = new Date(y, m - 1, d - 1); return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`; };
/** 本機「星期」鍵：嗰個星期一嘅日期（每週獎勵用）。 */
export const weekKey = (now) => { const d = new Date(now), back = (d.getDay() + 6) % 7; return dayKey(new Date(d.getFullYear(), d.getMonth(), d.getDate() - back).getTime()); };
/** 日期鍵 → 一個整數（商店每日特價用嚟抽）。 */
const dayNumber = (key) => { const [y, m, d] = key.split('-').map(Number); return Math.round(Date.UTC(y, m - 1, d) / 864e5); };

// ---------- 統計 ----------
export { bump };
/** 一個統計數而家幾多（有啲係由存檔其他位推算出嚟）。 */
export function statValue(meta, stat) {
  switch (stat) {
    case 'cleared': return clearedCount(meta);
    case 'stars': return totalStars(meta);
    case 'hardCleared': return Object.values(meta.hard ?? {}).filter((v) => v.stars > 0).length;
    case 'maxStar': return Math.max(...joinedIds(meta).map((id) => charOf(meta, id).star));
    case 'maxLevel': return Math.max(...joinedIds(meta).map((id) => charOf(meta, id).lv));
    case 'owned': return joinedIds(meta).length;
    case 'endlessBest': return meta.endless?.best ?? 0;
    default: return meta.stats?.[stat] ?? 0;
  }
}
const open = (meta, id) => { const u = unlockOf(id); return !u || (u.ready && (u.after <= 0 || stageStars(meta, u.after) > 0)); };

// ---------- 換日 ----------
/**
 * 開遊戲、返大廳都叫一次：過咗一日就重置每日任務同商店限購、推進簽到。回傳 true = 啱啱換咗日。
 */
export function rollDay(meta, now) {
  const today = dayKey(now);
  meta.stats ??= {}; meta.ach ??= {};
  if (meta.daily?.day === today) return false;
  // 每日任務：記低今日開始時每個統計數，之後睇多咗幾多
  meta.daily = { day: today, base: { ...meta.stats }, max: {}, got: [], chest: false };
  meta.shop = { day: today, bought: {} };
  // 簽到：尋日有嚟 = 連續 +1（七日一個循環）；斷咗由第 1 日再嚟
  const L = meta.login ?? { last: '', streak: 0, got: '' };
  L.streak = L.last === prevDay(today) ? (L.streak % LOGIN.length) + 1 : 1;
  L.last = today; meta.login = L;
  return true;
}

// ---------- 每日任務 ----------
/** 今日嘅任務（頭 MISSION_COUNT 個已經解鎖嘅）連進度：[{ ...任務, have, done, got }]。 */
export function missionsToday(meta) {
  const D = meta.daily ?? { base: {}, max: {}, got: [] };
  return MISSIONS.filter((m) => !m.needs || open(meta, m.needs)).slice(0, MISSION_COUNT).map((m) => {
    const now = m.kind === 'max' ? D.max?.[m.stat] ?? 0 : (meta.stats?.[m.stat] ?? 0) - (D.base?.[m.stat] ?? 0);
    return { ...m, have: Math.min(m.need, Math.max(0, now)), done: now >= m.need, got: D.got.includes(m.id) };
  });
}
/** 今日最高（例如無盡去到第幾波）。 */
export function bumpMax(meta, stat, v) { if (!meta.daily) return; meta.daily.max ??= {}; meta.daily.max[stat] = Math.max(meta.daily.max[stat] ?? 0, v); }
/** 領一個做完嘅任務。回傳獎勵（領唔到 = null）。 */
export function claimMission(meta, id) {
  const m = missionsToday(meta).find((x) => x.id === id);
  if (!m || !m.done || m.got) return null;
  meta.daily.got.push(id); bump(meta, 'missions');
  return grant(meta, m.rewards);
}
/** 全部任務做晒又領晒：開額外寶箱。 */
export function chestReady(meta) { const list = missionsToday(meta); return !!meta.daily && !meta.daily.chest && list.length > 0 && list.every((m) => m.got); }
export function claimChest(meta) { if (!chestReady(meta)) return null; meta.daily.chest = true; return grant(meta, DAILY_CHEST); }

// ---------- 成就 ----------
/** 全部成就連進度：[{ ...成就, have, done, got }]。 */
export const achievements = (meta) => ACHIEVEMENTS.map((a) => { const v = statValue(meta, a.stat); return { ...a, have: Math.min(a.need, v), done: v >= a.need, got: !!meta.ach?.[a.id] }; });
export function claimAchievement(meta, id) {
  const a = achievements(meta).find((x) => x.id === id);
  if (!a || !a.done || a.got) return null;
  meta.ach ??= {}; meta.ach[id] = true;
  return grant(meta, a.rewards);
}

// ---------- 七日簽到 ----------
/** 今日簽到嘅狀態：day = 連續第幾日（1 至 7）、ready = 今日未領。 */
export const loginState = (meta, now) => { const L = meta.login ?? { last: '', streak: 0, got: '' }, today = dayKey(now); return { day: Math.max(1, L.streak), ready: L.last === today && L.got !== today, rewards: LOGIN }; };
export function claimLogin(meta, now) {
  const s = loginState(meta, now);
  if (!s.ready) return null;
  meta.login.got = dayKey(now); bump(meta, 'logins');
  if (s.day === LOGIN.length) meta.loginFull = true;
  return grant(meta, LOGIN[s.day - 1]);
}

// ---------- 離線收益 ----------
/** 而家儲咗幾多：{ hours（最多 cap）, rewards, ready（儲夠 min 分鐘）}。未過第 1 關就冇。 */
export function offlineState(meta, now) {
  const cleared = clearedCount(meta);
  if (!cleared) return { hours: 0, rewards: [], ready: false, full: false };
  const at = meta.offline?.at ?? now, hours = Math.max(0, Math.min(OFFLINE.cap, (now - at) / 36e5));
  const rewards = [{ item: 'gold', n: Math.floor(OFFLINE.gold(cleared) * hours) }, { item: 'exp', n: Math.floor(OFFLINE.exp(cleared) * hours) }].filter((r) => r.n > 0);
  return { hours, rewards, ready: hours * 60 >= OFFLINE.min && rewards.length > 0, full: hours >= OFFLINE.cap };
}
/** 開始計時（第一次過咗第 1 關、或者未有記錄）。 */
export function startOffline(meta, now) { if (!meta.offline?.at && clearedCount(meta) > 0) meta.offline = { at: now }; }
export function claimOffline(meta, now) {
  const s = offlineState(meta, now);
  if (!s.ready) return null;
  meta.offline = { at: now };
  return grant(meta, s.rewards);
}

// ---------- 信箱 ----------
const mailOk = (meta, w) => (w.start ? true : w.cleared ? stageStars(meta, w.cleared) > 0 : w.login7 ? !!meta.loginFull : false);
/** 睇有冇新信要發（條件啱、又未發過）。回傳新發咗幾多封。 */
export function syncMail(meta, now) {
  meta.mail ??= []; meta.mailSent ??= {};
  let n = 0;
  for (const m of MAILS) if (!meta.mailSent[m.id] && mailOk(meta, m.when)) { meta.mailSent[m.id] = true; meta.mail.unshift({ id: m.id, at: now, got: false }); n++; }
  if (meta.mail.length > 40) meta.mail = [...meta.mail.filter((x) => !x.got), ...meta.mail.filter((x) => x.got)].slice(0, 40);
  return n;
}
/** 信箱入面嘅信（連範本內容）。 */
export const mails = (meta) => (meta.mail ?? []).map((x) => ({ ...MAILS.find((m) => m.id === x.id), ...x })).filter((x) => x.title);
export const mailUnread = (meta) => (meta.mail ?? []).filter((x) => !x.got).length;
export function claimMail(meta, id) {
  const x = (meta.mail ?? []).find((m) => m.id === id && !m.got), T = MAILS.find((m) => m.id === id);
  if (!x || !T) return null;
  x.got = true;
  return grant(meta, T.rewards);
}
/** 一鍵領晒。回傳合共攞到嘅獎勵。 */
export function claimAllMail(meta) { const out = []; for (const x of [...(meta.mail ?? [])]) { const r = claimMail(meta, x.id); if (r) out.push(...r); } return out; }

// ---------- 商店 ----------
/** 今日嘅特價（照日期抽 DEAL_SLOTS 格；指定角色碎片嗰格照日期輪角色）。 */
export function dealsToday(now) {
  const k = dayNumber(dayKey(now)), D = SHOP.deals, out = [];
  for (let i = 0; i < DEAL_SLOTS; i++) {
    const d = D[(k * 2 + i * 3 + (i ? 1 : 0)) % D.length];
    if (out.some((x) => x.id === d.id)) { const alt = D.find((x) => !out.some((y) => y.id === x.id)); out.push(price(alt, k)); } else out.push(price(d, k));
  }
  return out;
}
const price = (d, k) => ({ ...d, give: d.pickChar ? { ...d.give, id: ROSTER[k % ROSTER.length].id } : d.give, was: d.cost, cost: Math.round(d.cost * (1 - d.off) / 10) * 10, limit: 1, deal: true });
/** 成個貨架（特價喺前）連今日買咗幾多次：[{ ...貨品, bought, left, ok }]。 */
export function shopShelf(meta, now) {
  const B = meta.shop?.bought ?? {};
  return [...dealsToday(now), ...SHOP.goods].map((g) => { const bought = B[g.id] ?? 0, left = g.limit - bought; return { ...g, bought, left, ok: left > 0 && have(meta, g.pay) >= g.cost }; });
}
/** 買一件。回傳攞到嘅嘢（買唔到 = null）。 */
export function buy(meta, id, now) {
  const g = shopShelf(meta, now).find((x) => x.id === id);
  if (!g || !g.ok) return null;
  grant(meta, [{ item: g.pay, n: -g.cost }]);
  meta.shop ??= { day: dayKey(now), bought: {} }; meta.shop.bought[id] = (meta.shop.bought[id] ?? 0) + 1;
  bump(meta, 'buys');
  return grant(meta, [g.give]);
}

// ---------- 無盡模式 ----------
/** 一局無盡打完：記紀錄（最佳、本週最佳、本機紀錄榜），派今局獎勵。回傳 { rewards, best（係咪破紀錄）}。 */
export function finishEndless(meta, { wave, dist, kills = 0, bursts = 0 }, now) {
  const E = meta.endless ?? { best: 0, bestDist: 0, week: '', weekBest: 0, got: [], runs: [] }, wk = weekKey(now);
  if (E.week !== wk) { E.week = wk; E.weekBest = 0; E.got = []; }
  const done = Math.max(0, wave - 1), best = done > E.best; // 去到第 w 波 = 打低咗 w − 1 隻首領；紀錄記「打到第幾波」
  E.best = Math.max(E.best, wave); E.bestDist = Math.max(E.bestDist, Math.floor(dist)); E.weekBest = Math.max(E.weekBest, wave);
  E.runs = [...E.runs, { wave, dist: Math.floor(dist), at: now }].sort((a, b) => b.wave - a.wave || b.dist - a.dist).slice(0, RECORDS);
  meta.endless = E;
  bump(meta, 'plays'); bump(meta, 'endlessRuns'); bump(meta, 'kills', kills); bump(meta, 'bursts', bursts); bump(meta, 'bosses', done); bumpMax(meta, 'endlessWave', wave);
  return { rewards: grant(meta, [{ item: 'gold', n: ENDLESS_RUN.gold(wave) }, { item: 'exp', n: ENDLESS_RUN.exp(wave) }]), best: best || wave > (E.runs[1]?.wave ?? 0) && E.runs[0].at === now };
}
/** 本週階段獎勵連狀態：[{ wave, rewards, done, got }]。 */
export function endlessTiers(meta, now) {
  const E = meta.endless ?? {}, same = E.week === weekKey(now), bestW = same ? E.weekBest ?? 0 : 0, got = same ? E.got ?? [] : [];
  return ENDLESS_TIERS.map((t, i) => ({ ...t, i, done: bestW >= t.wave, got: got.includes(i) }));
}
export function claimEndlessTier(meta, i, now) {
  const t = endlessTiers(meta, now)[i];
  if (!t || !t.done || t.got) return null;
  meta.endless.got.push(i);
  return grant(meta, t.rewards);
}

// ---------- 紅點 ----------
/** 邊啲入口有嘢領：任務、成就、簽到、信箱、離線、無盡。 */
export function badges(meta, now) {
  return {
    mission: missionsToday(meta).some((m) => m.done && !m.got) || chestReady(meta) || achievements(meta).some((a) => a.done && !a.got),
    login: loginState(meta, now).ready,
    mail: mailUnread(meta) > 0,
    offline: offlineState(meta, now).ready,
    endless: endlessTiers(meta, now).some((t) => t.done && !t.got),
  };
}

/** 主線通晒未（困難模式要通晒先開）。 */
export const hardOpen = (meta) => stageStars(meta, STAGE_COUNT) > 0;
