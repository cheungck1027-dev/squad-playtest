// 聲音：音效、臨時音樂、震動。全部係程式合成（Web Audio 嘅振盪器同雜訊），冇用任何音檔。
// 所有聲音經事件名觸發：audio.play('brick')。加聲音、改音色只改下面 SOUNDS 表。
//
// 規矩：
//   · 手機瀏覽器要用戶掂過畫面先出得聲：第一下觸控／按鍵嗰刻先開（unlock），之前叫 play 唔出聲亦唔會出錯
//   · 分頁收埋就靜音（停咗個音訊時鐘），返嚟再開
//   · 限流：每種聲有最短相隔（gap 秒），同時最多 MAX_VOICES 把聲；一格入面打低三十隻敵人都只係響一兩聲
//   · 聲音唔影響規則：呢個模組只收事件名，唔讀唔寫戰鬥狀態
//
// 一把聲由幾層砌成，每層：
//   w  波形 'sine' | 'triangle' | 'square' | 'sawtooth' | 'noise'
//   f  頻率（Hz）：一個數，或者 [開始, 結束]（指數滑過去）。雜訊嘅 f = 濾波器中心頻率
//   t  長度（秒）；g 音量（0–1）；d 遲幾耐先響（秒）；a 淡入（秒，預設 0.004）
//   q  雜訊濾波器有幾尖（預設 1）；hp true = 雜訊用高通（沙沙聲），唔填 = 帶通

/** 同時最多幾把聲（多過就唔出新嘅）。 */
export const MAX_VOICES = 22;

const up = (notes, step = 0.07, w = 'triangle', g = 0.22, t = 0.12) => notes.map((f, i) => ({ w, f, t, g, d: i * step }));

/** @type {Record<string, { gap: number, group: string, layers: any[] }>} */
export const SOUNDS = {
  // ---- 射擊（細聲、唔刺耳，因為會連續響）----
  shot_tracer: { group: 'shot', gap: 0.07, layers: [{ w: 'square', f: [900, 420], t: 0.05, g: 0.07 }] },
  shot_burst: { group: 'shot', gap: 0.05, layers: [{ w: 'triangle', f: [1300, 700], t: 0.04, g: 0.1 }] },
  shot_scatter: { group: 'shot', gap: 0.12, layers: [{ w: 'noise', f: 1900, q: 0.8, t: 0.08, g: 0.12 }, { w: 'sine', f: [220, 110], t: 0.07, g: 0.1 }] },
  shot_shell: { group: 'shot', gap: 0.2, layers: [{ w: 'sine', f: [190, 55], t: 0.18, g: 0.2 }, { w: 'noise', f: 500, t: 0.1, g: 0.08 }] },
  shot_missile: { group: 'shot', gap: 0.2, layers: [{ w: 'noise', f: [600, 2600], hp: true, t: 0.22, g: 0.06 }, { w: 'sawtooth', f: [260, 720], t: 0.2, g: 0.05 }] },
  shot_gatling: { group: 'shot', gap: 0.05, layers: [{ w: 'square', f: [620, 500], t: 0.028, g: 0.055 }] },
  shot_lance: { group: 'shot', gap: 0.12, layers: [{ w: 'triangle', f: [1600, 520], t: 0.13, g: 0.11 }] },
  shot_laser: { group: 'shot', gap: 0.09, layers: [{ w: 'sawtooth', f: [430, 410], t: 0.11, g: 0.045, a: 0.02 }, { w: 'sine', f: 860, t: 0.11, g: 0.03, a: 0.02 }] },
  shot_chain: { group: 'shot', gap: 0.11, layers: [{ w: 'noise', f: 5200, hp: true, t: 0.07, g: 0.07 }, { w: 'square', f: [2100, 300], t: 0.06, g: 0.05 }] },
  shot_wave: { group: 'shot', gap: 0.2, layers: [{ w: 'sine', f: [520, 1250], t: 0.2, g: 0.1 }, { w: 'noise', f: [900, 3200], t: 0.2, g: 0.04 }] },
  shot_mega: { group: 'shot', gap: 0.09, layers: [{ w: 'sawtooth', f: 110, t: 0.12, g: 0.06, a: 0.02 }, { w: 'sawtooth', f: 165, t: 0.12, g: 0.04, a: 0.02 }, { w: 'sine', f: 1320, t: 0.12, g: 0.02, a: 0.02 }] },
  shot_pillar: { group: 'shot', gap: 0.25, layers: [{ w: 'sine', f: [1500, 190], t: 0.26, g: 0.11 }, { w: 'noise', f: 1200, t: 0.2, g: 0.06, d: 0.08 }] },
  // ---- 爆發技（039）：槽滿提示、發動、爆發期間嘅底噪（一把 6 秒長嘅聲）、結束 ----
  burst_ready: { group: 'event', gap: 0.5, layers: [...up([880, 1175, 1568], 0.07, 'triangle', 0.16, 0.14), { w: 'sine', f: 2349, t: 0.3, g: 0.05, d: 0.2 }] },
  burst_go: { group: 'event', gap: 0.5, layers: [{ w: 'noise', f: [400, 6000], t: 0.55, g: 0.14 }, { w: 'sawtooth', f: [110, 660], t: 0.6, g: 0.16 }, { w: 'square', f: [220, 880], t: 0.5, g: 0.07, d: 0.1 }, { w: 'sine', f: [80, 40], t: 0.5, g: 0.28, d: 0.62 }, { w: 'noise', f: 1200, t: 0.3, g: 0.16, d: 0.62 }] },
  burst_hum: { group: 'event', gap: 2, layers: [{ w: 'sawtooth', f: 82, t: 6, g: 0.035, d: 0.8, a: 0.3 }, { w: 'sawtooth', f: 123.5, t: 6, g: 0.022, d: 0.8, a: 0.3 }, { w: 'sine', f: [1320, 1480], t: 6, g: 0.012, d: 0.8, a: 0.5 }] },
  burst_end: { group: 'event', gap: 0.5, layers: [{ w: 'sawtooth', f: [330, 82], t: 0.4, g: 0.12 }, { w: 'noise', f: [3000, 300], t: 0.35, g: 0.06 }] },
  // ---- 隊員（040）：鈴嘅雙槍（短、高、密）、霧嘅刀氣（一下「嗖」）、新隊員入隊、三人接力爆發 ----
  mate_suzu: { group: 'shot', gap: 0.06, layers: [{ w: 'square', f: [1500, 900], t: 0.03, g: 0.045 }, { w: 'noise', f: 4200, hp: true, t: 0.02, g: 0.03 }] },
  mate_kiri: { group: 'shot', gap: 0.3, layers: [{ w: 'noise', f: [5200, 900], q: 2, t: 0.2, g: 0.1 }, { w: 'sine', f: [1400, 420], t: 0.18, g: 0.06 }, { w: 'triangle', f: 2640, t: 0.06, g: 0.04, d: 0.02 }] },
  // 楯：衝鋒槍（低沉短促）、撐盾、擋下；燈：榴彈出膛、落地爆炸、無人機補槍
  mate_tate: { group: 'shot', gap: 0.05, layers: [{ w: 'square', f: [640, 380], t: 0.04, g: 0.05 }, { w: 'noise', f: 2400, t: 0.03, g: 0.03 }] },
  mate_akari: { group: 'shot', gap: 0.3, layers: [{ w: 'sine', f: [260, 90], t: 0.16, g: 0.16 }, { w: 'noise', f: 900, t: 0.08, g: 0.06 }] },
  grenade: { group: 'event', gap: 0.15, layers: [{ w: 'noise', f: [1800, 200], t: 0.35, g: 0.22 }, { w: 'sine', f: [130, 45], t: 0.3, g: 0.24 }] },
  drone: { group: 'shot', gap: 0.2, layers: [{ w: 'sine', f: [2200, 1500], t: 0.07, g: 0.05 }] },
  shield_up: { group: 'event', gap: 0.5, layers: [{ w: 'sine', f: [330, 880], t: 0.3, g: 0.12 }, { w: 'triangle', f: 1320, t: 0.25, g: 0.05, d: 0.12 }] },
  shield_block: { group: 'event', gap: 0.2, layers: [{ w: 'triangle', f: [1760, 880], t: 0.25, g: 0.2 }, { w: 'noise', f: 3000, hp: true, t: 0.12, g: 0.1 }, { w: 'sine', f: [220, 110], t: 0.3, g: 0.18 }] },
  join: { group: 'event', gap: 1, layers: [...up([523, 659, 784, 1047, 1319], 0.09, 'triangle', 0.22, 0.26), { w: 'sine', f: 2637, t: 0.5, g: 0.06, d: 0.45 }, ...up([262, 392, 523], 0.18, 'square', 0.06, 0.3)] },
  burst_relay: { group: 'event', gap: 0.5, layers: [{ w: 'square', f: [1500, 900], t: 0.1, g: 0.1 }, { w: 'noise', f: 4200, hp: true, t: 0.12, g: 0.08 }, { w: 'noise', f: [5200, 900], q: 2, t: 0.25, g: 0.14, d: 0.5 }, { w: 'sine', f: [1400, 420], t: 0.2, g: 0.08, d: 0.5 }, { w: 'noise', f: [400, 6000], t: 0.5, g: 0.14, d: 1.0 }, { w: 'sawtooth', f: [110, 880], t: 0.55, g: 0.16, d: 1.0 }, { w: 'sine', f: [80, 40], t: 0.5, g: 0.3, d: 1.5 }, { w: 'noise', f: 1200, t: 0.3, g: 0.18, d: 1.5 }] },
  // ---- 命中 ----
  hit_grunt: { group: 'hit', gap: 0.05, layers: [{ w: 'noise', f: 3000, hp: true, t: 0.035, g: 0.09 }, { w: 'square', f: [520, 260], t: 0.04, g: 0.05 }] },
  hit_elite: { group: 'hit', gap: 0.06, layers: [{ w: 'square', f: [330, 210], t: 0.06, g: 0.09 }] },
  hit_wall: { group: 'hit', gap: 0.07, layers: [{ w: 'triangle', f: 920, t: 0.07, g: 0.08 }, { w: 'triangle', f: 1385, t: 0.05, g: 0.05 }] },
  hit_boss: { group: 'hit', gap: 0.09, layers: [{ w: 'sine', f: [95, 58], t: 0.1, g: 0.2 }] },
  hit_gate: { group: 'hit', gap: 0.07, layers: [{ w: 'triangle', f: 1320, t: 0.045, g: 0.07 }] },
  // ---- 收穫／蝕底 ----
  brick: { group: 'gain', gap: 0.045, layers: [{ w: 'triangle', f: 660, t: 0.07, g: 0.16 }, { w: 'sine', f: 1320, t: 0.05, g: 0.05 }] }, // 連續收：音高一級級升（play 嘅 pitch）
  prize: { group: 'gain', gap: 0.08, layers: up([660, 990, 1320], 0.05, 'triangle', 0.2, 0.14) },
  gate_add: { group: 'gain', gap: 0.2, layers: up([523, 659, 784], 0.06) },
  gate_mul: { group: 'gain', gap: 0.2, layers: [...up([523, 659, 784, 1047], 0.055, 'triangle', 0.24), { w: 'sine', f: 2093, t: 0.25, g: 0.06, d: 0.2 }] },
  gate_bad: { group: 'loss', gap: 0.2, layers: [{ w: 'sawtooth', f: [233, 104], t: 0.3, g: 0.2 }, { w: 'square', f: [117, 52], t: 0.3, g: 0.1 }] },
  hurt: { group: 'loss', gap: 0.14, layers: [{ w: 'noise', f: 700, t: 0.12, g: 0.18 }, { w: 'square', f: [160, 80], t: 0.14, g: 0.14 }] },
  // ---- 事件 ----
  weapon_up: { group: 'event', gap: 0.3, layers: up([784, 988, 1319], 0.05, 'square', 0.1, 0.09) },
  evolve: { group: 'event', gap: 0.5, layers: [...up([262, 330, 392, 523, 659, 784], 0.07, 'sawtooth', 0.1, 0.3), { w: 'sine', f: [130, 520], t: 0.6, g: 0.16 }, { w: 'noise', f: [500, 5000], t: 0.6, g: 0.05 }] },
  wall_break: { group: 'event', gap: 0.2, layers: [{ w: 'noise', f: 900, t: 0.28, g: 0.28 }, { w: 'sine', f: [150, 45], t: 0.3, g: 0.26 }, { w: 'noise', f: 5000, hp: true, t: 0.25, g: 0.08, d: 0.05 }] },
  mini_down: { group: 'event', gap: 0.3, layers: [{ w: 'noise', f: 700, t: 0.35, g: 0.24 }, ...up([523, 784, 1047, 1568], 0.06, 'triangle', 0.2, 0.18)] },
  boss_in: { group: 'event', gap: 1, layers: [{ w: 'sawtooth', f: [82, 58], t: 0.9, g: 0.2, a: 0.1 }, { w: 'sawtooth', f: [123, 87], t: 0.9, g: 0.12, a: 0.1 }, { w: 'noise', f: 200, t: 0.9, g: 0.08, a: 0.2 }] },
  slam_warn: { group: 'event', gap: 0.5, layers: [{ w: 'square', f: 466, t: 0.09, g: 0.12 }, { w: 'square', f: 466, t: 0.09, g: 0.12, d: 0.18 }] },
  slam: { group: 'event', gap: 0.3, layers: [{ w: 'sine', f: [75, 38], t: 0.35, g: 0.34 }, { w: 'noise', f: 400, t: 0.3, g: 0.2 }] },
  boss_rage: { group: 'event', gap: 1, layers: [{ w: 'sawtooth', f: [110, 330], t: 0.5, g: 0.18 }, { w: 'square', f: [55, 165], t: 0.5, g: 0.12 }] },
  boss_down: { group: 'event', gap: 1, layers: [{ w: 'noise', f: [2500, 200], t: 1.0, g: 0.3 }, { w: 'sine', f: [420, 38], t: 1.0, g: 0.3 }, { w: 'noise', f: 6000, hp: true, t: 0.5, g: 0.08, d: 0.1 }] },
  win: { group: 'event', gap: 1, layers: [...up([523, 659, 784, 1047, 1319], 0.11, 'triangle', 0.24, 0.3), ...up([262, 330, 392, 523, 659], 0.11, 'square', 0.07, 0.3)] },
  lose: { group: 'event', gap: 1, layers: [...up([392, 370, 311, 262, 196], 0.16, 'sawtooth', 0.14, 0.34), { w: 'sine', f: [98, 49], t: 0.9, g: 0.2, d: 0.2 }] },
  // ---- 介面 ----
  ui_click: { group: 'ui', gap: 0.04, layers: [{ w: 'triangle', f: 720, t: 0.035, g: 0.14 }] },
  ui_buy: { group: 'ui', gap: 0.1, layers: [...up([659, 988], 0.06, 'triangle', 0.22, 0.12), { w: 'sine', f: 2637, t: 0.2, g: 0.06, d: 0.1 }] },
  ui_deny: { group: 'ui', gap: 0.15, layers: [{ w: 'square', f: 165, t: 0.07, g: 0.14 }, { w: 'square', f: 147, t: 0.09, g: 0.14, d: 0.09 }] },
  star: { group: 'ui', gap: 0.1, layers: [{ w: 'sine', f: [1320, 1760], t: 0.18, g: 0.2 }, { w: 'triangle', f: 2640, t: 0.1, g: 0.06, d: 0.05 }] },
  coin: { group: 'ui', gap: 0.05, layers: [{ w: 'triangle', f: 1865, t: 0.035, g: 0.1 }, { w: 'triangle', f: 2489, t: 0.05, g: 0.07, d: 0.03 }] },
};

/** 12 級武器（data/weapons.js 嘅 id）各自用邊把射擊聲。 */
export const SHOT_SOUND = { tracer: 'shot_tracer', burst: 'shot_burst', scatter: 'shot_scatter', shell: 'shot_shell', missile: 'shot_missile', gatling: 'shot_gatling', lance: 'shot_lance', laser: 'shot_laser', chain: 'shot_chain', wave: 'shot_wave', megalaser: 'shot_mega', pillars: 'shot_pillar' };

/** 打中唔同嘢用邊把聲（battle.js 嘅 hit 事件 on）。 */
export const HIT_SOUND = { phalanx: 'hit_grunt', elite: 'hit_elite', barrier: 'hit_wall', boss: 'hit_boss', gates: 'hit_gate' };

/** 震動（毫秒；陣列 = 震、停、震…）。短而少。 */
export const VIBRATIONS = { hurt: 40, gate_bad: 70, wall_break: 35, evolve: [30, 40, 60], boss_down: [60, 50, 120], lose: [120, 60, 120], slam: 80 };

/**
 * 限流（純計算，測試直接用）：每種聲最短相隔 gap 秒；另外任何 window 秒入面最多開 burst 把新聲。
 * allow(name, now) → 呢一下出唔出得聲（出得就記低）。
 */
export function makeLimiter({ sounds = SOUNDS, burst = 6, window = 0.05 } = {}) {
  const last = new Map(), recent = [];
  return {
    allow(name, now) {
      const S = sounds[name];
      if (!S) return false;
      if (now - (last.get(name) ?? -1e9) < S.gap - 1e-9) return false;
      while (recent.length && recent[0] <= now - window) recent.shift();
      if (recent.length >= burst) return false;
      last.set(name, now); recent.push(now);
      return true;
    },
    reset() { last.clear(); recent.length = 0; },
  };
}

/** 連續收磚：第 n 塊（由 0 計）音高升幾多個半音。一級級升，去到一個八度半封頂；斷咗（相隔超過 resetAfter 秒）由頭嚟。 */
export function makeStreak({ step = 1, max = 18, resetAfter = 0.7 } = {}) {
  let n = 0, lastT = -1e9;
  return { next(now) { n = now - lastT > resetAfter ? 0 : Math.min(max, n + step); lastT = now; return n; }, get value() { return n; } };
}

/** 將存檔入面嘅聲音設定變成安全嘅數（壞值用預設）。 */
export function audioSettings(raw = {}) {
  const vol = (v, d) => (typeof v === 'number' && v >= 0 && v <= 1 ? v : d);
  return { sfx: vol(raw.sfx, 0.8), music: vol(raw.music, 0.5), vibrate: raw.vibrate !== false };
}

// ---- 臨時音樂：十六格一小節嘅小樂句，鼓（低鼓、踩鈸）、低音、一條旋律 ----
// 每條係 16 格（一小節）× 幾小節；數字 = 音高（MIDI 音符號），0 = 唔響；鼓：1 = 響
const n16 = (s) => s.split(' ').map(Number);
export const MUSIC = {
  map: { bpm: 92, kick: n16('1 0 0 0 0 0 0 0 1 0 0 0 0 0 1 0'), hat: n16('0 0 1 0 0 0 1 0 0 0 1 0 0 0 1 0'), bass: n16('45 0 0 0 45 0 0 0 41 0 0 0 43 0 0 0'), lead: n16('69 0 72 0 76 0 72 0 69 0 0 0 67 0 64 0 65 0 69 0 72 0 69 0 67 0 0 0 64 0 0 0') },
  battle: { bpm: 126, kick: n16('1 0 0 0 1 0 0 0 1 0 0 0 1 0 0 1'), hat: n16('0 0 1 0 0 0 1 1 0 0 1 0 0 0 1 1'), bass: n16('40 0 40 0 0 40 0 0 43 0 43 0 0 45 0 0'), lead: n16('64 0 0 67 0 0 71 0 69 0 0 67 0 0 64 0 62 0 0 64 0 0 67 0 64 0 0 0 59 0 0 0') },
  boss: { bpm: 142, kick: n16('1 0 1 0 1 0 0 1 1 0 1 0 1 0 1 1'), hat: n16('1 0 1 1 1 0 1 1 1 0 1 1 1 0 1 1'), bass: n16('38 38 0 38 0 38 38 0 36 36 0 36 0 41 41 0'), lead: n16('62 0 65 0 69 0 68 0 65 0 62 0 61 0 0 0 62 0 65 0 70 0 69 0 65 0 64 0 62 0 0 0') },
};
const midi = (m) => 440 * 2 ** ((m - 69) / 12);

/**
 * @param {{ settings?: () => any, mute?: boolean, vibrate?: (p: number | number[]) => void }} [opts]
 *   settings = 讀而家設定嘅函式（存檔入面嘅 settings）；mute = 全靜音（?mute=1，自動測試用）
 */
export function createAudio(opts = {}) {
  const AC = globalThis.AudioContext ?? globalThis.webkitAudioContext ?? null;
  const limiter = makeLimiter(), streak = makeStreak();
  const get = () => audioSettings(opts.settings?.() ?? {});
  /** @type {any} */ let ctx = null; let master = null, sfxBus = null, musicBus = null, noiseBuf = null, voices = 0, unlocked = false;
  let track = null, nextStep = 0, stepAt = 0, timer = 0;
  const stats = { played: 0, skipped: 0 };

  function ensure() {
    if (ctx || !AC || opts.mute) return !!ctx;
    try {
      ctx = new AC();
      const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 6; // 防爆音
      master = ctx.createGain(); master.connect(comp); comp.connect(ctx.destination);
      sfxBus = ctx.createGain(); musicBus = ctx.createGain(); sfxBus.connect(master); musicBus.connect(master);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0); let seed = 12345;
      for (let i = 0; i < d.length; i++) { seed = (seed * 1664525 + 1013904223) >>> 0; d[i] = seed / 2147483648 - 1; }
      applyVolumes();
    } catch { ctx = null; }
    return !!ctx;
  }
  function applyVolumes() {
    if (!ctx) return;
    const s = get();
    sfxBus.gain.value = s.sfx; musicBus.gain.value = s.music * 0.5; // 音樂細聲過音效
  }

  /** 排一層聲喺 when 開始。 */
  function layer(L, when, bus, rate = 1, gainMul = 1) {
    const t0 = when + (L.d ?? 0), dur = L.t, g = ctx.createGain(), a = L.a ?? 0.004;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(L.g * gainMul, t0 + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    g.connect(bus);
    let src;
    const f0 = (Array.isArray(L.f) ? L.f[0] : L.f) * rate, f1 = (Array.isArray(L.f) ? L.f[1] : L.f) * rate;
    if (L.w === 'noise') {
      src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
      const flt = ctx.createBiquadFilter(); flt.type = L.hp ? 'highpass' : 'bandpass'; flt.Q.value = L.q ?? 1;
      flt.frequency.setValueAtTime(f0, t0); if (f1 !== f0) flt.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
      src.connect(flt); flt.connect(g);
    } else {
      src = ctx.createOscillator(); src.type = L.w;
      src.frequency.setValueAtTime(f0, t0); if (f1 !== f0) src.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
      src.connect(g);
    }
    voices++;
    src.onended = () => { voices--; g.disconnect(); };
    src.start(t0); src.stop(t0 + dur + 0.02);
  }

  /** 播一把聲。pitch = 升幾多個半音（收磚用）；volume = 音量倍數。回傳出咗聲未。 */
  function play(name, { pitch = 0, volume = 1 } = {}) {
    const S = SOUNDS[name];
    if (!S) return false;
    const now = ctx ? ctx.currentTime : (globalThis.performance?.now() ?? Date.now()) / 1000;
    if (!limiter.allow(name, now) || voices + S.layers.length > MAX_VOICES) { stats.skipped++; return false; }
    stats.played++;
    if (!ctx || !unlocked || ctx.state !== 'running' || get().sfx <= 0) return false;
    const rate = 2 ** (pitch / 12);
    for (const L of S.layers) layer(L, now, sfxBus, rate, volume);
    return true;
  }

  /** 連續收磚嘅聲：音高一級級升。 */
  const brick = () => play('brick', { pitch: streak.next(ctx ? ctx.currentTime : (globalThis.performance?.now() ?? 0) / 1000) });

  // ---- 音樂：每 0.1 秒排好之後 0.3 秒嘅音 ----
  function schedule() {
    if (!ctx || !track || ctx.state !== 'running') return;
    const M = MUSIC[track], dt = 60 / M.bpm / 4;
    if (stepAt < ctx.currentTime) stepAt = ctx.currentTime + 0.05;
    while (stepAt < ctx.currentTime + 0.3) {
      const i = nextStep % 16, li = nextStep % M.lead.length;
      if (M.kick[i]) layer({ w: 'sine', f: [150, 45], t: 0.16, g: 0.5 }, stepAt, musicBus);
      if (M.hat[i]) layer({ w: 'noise', f: 7000, hp: true, t: 0.04, g: 0.12 }, stepAt, musicBus);
      if (M.bass[i]) layer({ w: 'triangle', f: midi(M.bass[i]), t: dt * 1.8, g: 0.3 }, stepAt, musicBus);
      if (M.lead[li]) layer({ w: 'square', f: midi(M.lead[li]), t: dt * 1.6, g: 0.07, a: 0.01 }, stepAt, musicBus);
      stepAt += dt; nextStep++;
    }
  }
  /** 換音樂：'map' | 'battle' | 'boss' | null（停）。同一段唔會由頭嚟。 */
  function music(name) {
    const want = name && MUSIC[name] ? name : null;
    if (want === track) return;
    track = want; nextStep = 0; stepAt = 0;
    clearInterval(timer);
    if (track && !opts.mute) timer = setInterval(schedule, 100);
  }

  /** 第一下觸控／按鍵：開聲。 */
  function unlock() {
    if (opts.mute) return;
    if (!ensure()) return;
    unlocked = true;
    if (ctx.state === 'suspended' && !globalThis.document?.hidden) ctx.resume?.();
  }
  /** 分頁收埋／返嚟。 */
  function setHidden(hidden) { if (!ctx) return; if (hidden) ctx.suspend?.(); else if (unlocked) ctx.resume?.(); }

  /** 震動（設定開咗、部機又支援先有）。 */
  function vibrate(name) {
    const p = VIBRATIONS[name];
    if (!p || opts.mute || !get().vibrate) return false;
    try { return !!(opts.vibrate ?? globalThis.navigator?.vibrate?.bind(globalThis.navigator))?.(p); } catch { return false; }
  }

  return {
    play, brick, music, unlock, setHidden, vibrate, applyVolumes,
    /** 全部音效嘅名（試聽用）。 */
    list: () => Object.keys(SOUNDS),
    get track() { return track; },
    /** 除錯：有冇音訊、開咗未、而家幾多把聲、出咗幾多、限流擋咗幾多 */
    report: () => ({ supported: !!AC, unlocked, state: ctx?.state ?? 'none', voices, track, ...stats, settings: get(), vibrateSupported: typeof globalThis.navigator?.vibrate === 'function' }),
  };
}
