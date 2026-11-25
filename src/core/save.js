// 存檔：一個有版本號嘅物件，放喺 localStorage。
// 改存檔格式嘅步驟：1) SAVE_VERSION 加一；2) 喺 MIGRATIONS 加一條「舊版本 → 新版本」；
// 3) 更新 defaultSave() 同 SaveData 型別。舊存檔讀入嗰陣會逐級升上嚟。

export const SAVE_KEY = 'number-squad.save';
export const SAVE_VERSION = 2;

/**
 * @typedef {Object} SaveData
 * @property {number} version
 * @property {number} highestStageCleared   通過咗嘅最高關卡，未過任何一關係 0
 * @property {{ screenShake: boolean, sfx: number, music: number, vibrate: boolean }} settings
 * @property {MetaSave} meta   十關版嘅進度（2026-11-24，版本 2 加）
 *
 * @typedef {Object} MetaSave
 * @property {number} gold                                             金幣
 * @property {{ power: number, weapon: number, income: number }} upgrades  三條永久升級嘅等級
 * @property {Record<string, { stars: number, best: number }>} stages   每關最高星數同最高戰力（key = 關數）
 * @property {Record<string, boolean>} hints                            睇過嘅引導
 * @property {{ rest: string[], face: string }} squad                   編隊：唔出戰嘅隊員、大廳看板角色
 * @property {number} gems                                              晶石
 * @property {{ exp: number, core: number, ticket: number }} items      素材：訓練數據、突破核心、招募券
 * @property {Record<string, number>} shards                            每個角色嘅碎片
 * @property {Record<string, { lv: number, br: number, star: number, sb: number, sp: number, own: boolean }>} chars  角色養成：等級、突破次數、星、爆發技級、被動級、係咪由招募攞到
 * @property {{ pity: number, total: number }} gacha                    招募：連續幾多次冇出傳說、合共抽咗幾多次
 */

/** @returns {MetaSave} */
export const defaultMeta = () => ({ gold: 0, upgrades: { power: 0, weapon: 0, income: 0 }, stages: {}, hints: {}, squad: { rest: [], face: '' },
  gems: 0, items: { exp: 0, core: 0, ticket: 0, wild: 0 }, shards: {}, chars: {}, gacha: { pity: 0, total: 0 },
  // 每日內容（041 第四部分；計算見 meta/live.js）：統計、每日任務、成就、簽到、離線收益、信箱、商店、無盡模式、困難模式紀錄
  stats: {}, daily: null, ach: {}, login: { last: '', streak: 0, got: '' }, loginFull: false, offline: { at: 0 }, mail: [], mailSent: {}, shop: null, endless: { best: 0, bestDist: 0, week: '', weekBest: 0, got: [], runs: [] }, hard: {}, rally: null });

/** @returns {SaveData} */
export function defaultSave() {
  // sfx／music = 音效、音樂音量（0–1）；vibrate = 震動開關（2026-11-24 加；舊存檔冇呢幾欄就用預設）
  return { version: SAVE_VERSION, highestStageCleared: 0, settings: { screenShake: true, sfx: 0.8, music: 0.5, vibrate: true }, meta: defaultMeta() };
}

/**
 * 升級表：key 係舊版本號，函數將嗰個版本嘅資料變成下一個版本。
 * 例：2: (old) => ({ ...old, version: 3, newField: 0 })
 * @type {Record<number, (old: any) => any>}
 */
export const MIGRATIONS = {
  // 0 係有版本號之前嘅格式（只得一個 stage 數字），留喺度做示範同測試。
  0: (old) => ({ version: 1, highestStageCleared: Number(old.stage) || 0, settings: {} }),
  // 1 → 2：加十關版嘅進度（舊存檔冇金幣冇升級，由零開始；舊嘅「最高過關」唔搬，因為舊版嘅關同新版唔同）
  1: (old) => ({ ...old, version: 2, meta: defaultMeta() }),
};

/**
 * 將任何讀返嚟嘅嘢變成而家版本嘅 SaveData。睇唔明就當新存檔。
 * @param {unknown} raw
 * @returns {SaveData}
 */
export function migrate(raw) {
  if (!raw || typeof raw !== 'object') return defaultSave();
  let data = /** @type {any} */ (raw);
  let version = Number.isInteger(data.version) ? data.version : 0;
  if (version > SAVE_VERSION) return defaultSave(); // 新過呢個程式識嘅版本：唔好亂估
  while (version < SAVE_VERSION) {
    const up = MIGRATIONS[version];
    if (!up) return defaultSave();
    data = up(data);
    version = data.version;
  }
  const base = defaultSave();
  const cleared = Number(data.highestStageCleared);
  return {
    version: SAVE_VERSION,
    highestStageCleared: Number.isFinite(cleared) && cleared > 0 ? Math.floor(cleared) : 0,
    settings: { ...base.settings, ...(data.settings && typeof data.settings === 'object' ? data.settings : {}) },
    meta: cleanMeta(data.meta),
  };
}

/** 將讀返嚟嘅進度逐欄檢查：唔啱格式嘅欄位用預設值（壞檔唔會整壞遊戲）。 */
export function cleanMeta(raw) {
  const out = defaultMeta(), m = raw && typeof raw === 'object' ? raw : {}, int = (v, max = 1e15) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Math.min(max, Math.floor(Number(v))) : 0);
  out.gold = int(m.gold);
  for (const k of Object.keys(out.upgrades)) out.upgrades[k] = int(m.upgrades?.[k], 99);
  if (m.stages && typeof m.stages === 'object') for (const [k, v] of Object.entries(m.stages)) {
    const n = int(k, 999);
    if (n > 0 && v && typeof v === 'object') out.stages[n] = { stars: Math.min(3, int(v.stars)), best: int(v.best, Number.MAX_SAFE_INTEGER) };
  }
  if (m.hints && typeof m.hints === 'object') for (const [k, v] of Object.entries(m.hints)) if (v === true && /^[a-z]{1,20}$/i.test(k)) out.hints[k] = true;
  const id = (v) => typeof v === 'string' && /^[a-z]{1,20}$/.test(v);
  // 編隊（040 加；舊存檔冇呢欄 = 入咗隊嘅全部出戰、看板係隊長）：rest = 唔出戰嘅隊員 id；face = 大廳看板角色 id（'' = 隊長）
  // 養成同招募（041 第三部分加；舊存檔冇呢幾欄 = 全部由零開始，角色 1 級 1 星）
  out.gems = int(m.gems);
  for (const k of Object.keys(out.items)) out.items[k] = int(m.items?.[k]);
  if (m.shards && typeof m.shards === 'object') for (const [k, v] of Object.entries(m.shards)) if (id(k) && int(v) > 0) out.shards[k] = int(v, 1e6);
  if (m.chars && typeof m.chars === 'object') for (const [k, v] of Object.entries(m.chars)) if (id(k) && v && typeof v === 'object') {
    const br = Math.min(5, int(v.br)), one = (x, max) => Math.max(1, Math.min(max, int(x) || 1));
    out.chars[k] = { lv: Math.min(one(v.lv, 60), 10 * (br + 1)), br, star: one(v.star, 5), sb: one(v.sb, 10), sp: one(v.sp, 10), own: v.own === true };
  }
  if (m.gacha && typeof m.gacha === 'object') out.gacha = { pity: int(m.gacha.pity, 999), total: int(m.gacha.total, 1e9) };
  // 每日內容：逐欄檢查（舊存檔冇 = 預設）
  const obj = (v) => v && typeof v === 'object' && !Array.isArray(v), day = (v) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : ''), nums = (v) => { const o = {}; if (obj(v)) for (const [k, x] of Object.entries(v)) if (/^[a-zA-Z]{1,20}$/.test(k) && int(x) > 0) o[k] = int(x); return o; }, flags = (v) => { const o = {}; if (obj(v)) for (const [k, x] of Object.entries(v)) if (/^[a-zA-Z]{1,20}$/.test(k) && x === true) o[k] = true; return o; }, ids = (v) => (Array.isArray(v) ? [...new Set(v.filter(id))].slice(0, 40) : []);
  out.stats = nums(m.stats); out.ach = flags(m.ach); out.mailSent = flags(m.mailSent); out.loginFull = m.loginFull === true;
  if (obj(m.daily) && day(m.daily.day)) out.daily = { day: m.daily.day, base: nums(m.daily.base), max: nums(m.daily.max), got: ids(m.daily.got), chest: m.daily.chest === true };
  if (obj(m.login)) out.login = { last: day(m.login.last), streak: Math.min(7, int(m.login.streak)), got: day(m.login.got) };
  if (obj(m.offline)) out.offline = { at: int(m.offline.at, 1e15) };
  if (Array.isArray(m.mail)) out.mail = m.mail.filter((x) => obj(x) && id(x.id)).slice(0, 40).map((x) => ({ id: x.id, at: int(x.at, 1e15), got: x.got === true }));
  if (obj(m.shop) && day(m.shop.day)) out.shop = { day: m.shop.day, bought: nums(m.shop.bought) };
  if (obj(m.endless)) out.endless = { best: int(m.endless.best, 9999), bestDist: int(m.endless.bestDist, 1e9), week: day(m.endless.week), weekBest: int(m.endless.weekBest, 9999), got: Array.isArray(m.endless.got) ? [...new Set(m.endless.got.map((x) => int(x, 99)))].slice(0, 20) : [], runs: Array.isArray(m.endless.runs) ? m.endless.runs.filter(obj).slice(0, 20).map((x) => ({ wave: int(x.wave, 9999), dist: int(x.dist, 1e9), at: int(x.at, 1e15) })) : [] };
  if (obj(m.rally) && int(m.rally.n, 999) > 0) out.rally = { n: int(m.rally.n, 999), hard: m.rally.hard === true, fails: int(m.rally.fails, 99) };
  if (obj(m.hard)) for (const [k, v] of Object.entries(m.hard)) { const n = int(k, 999); if (n > 0 && obj(v)) out.hard[n] = { stars: Math.min(3, int(v.stars)), best: int(v.best, Number.MAX_SAFE_INTEGER) }; }
  if (m.squad && typeof m.squad === 'object') { if (Array.isArray(m.squad.rest)) out.squad.rest = [...new Set(m.squad.rest.filter(id))].slice(0, 20); if (id(m.squad.face)) out.squad.face = m.squad.face; }
  return out;
}

/**
 * @param {Pick<Storage, 'getItem' | 'setItem'> | null} [storage]  預設用 localStorage；冇就只存喺記憶體
 */
export function createSave(storage = safeLocalStorage()) {
  /** @type {SaveData} */
  let data = defaultSave();

  function write() {
    try { storage?.setItem(SAVE_KEY, JSON.stringify(data)); } catch { /* 私隱模式或者空間滿：照玩，只係唔存 */ }
  }

  return {
    /** 由儲存空間讀入（順便升級），回傳而家嘅資料。 */
    load() {
      let raw = null;
      try { raw = JSON.parse(storage?.getItem(SAVE_KEY) ?? 'null'); } catch { raw = null; }
      data = migrate(raw);
      return data;
    },
    get data() { return data; },
    /** 記低過咗第 n 關；只會升唔會跌。 */
    recordStageCleared(n) {
      if (n > data.highestStageCleared) { data.highestStageCleared = n; write(); }
    },
    /** @param {Partial<SaveData['settings']>} patch */
    updateSettings(patch) {
      data.settings = { ...data.settings, ...patch };
      write();
    },
    /** 改十關版嘅進度：fn 收到而家嘅 meta，直接改佢；改完即刻存。 */
    updateMeta(fn) { fn(data.meta); data.meta = cleanMeta(data.meta); write(); return data.meta; },
    reset() { data = defaultSave(); write(); },
  };
}

function safeLocalStorage() {
  try { return globalThis.localStorage ?? null; } catch { return null; }
}
