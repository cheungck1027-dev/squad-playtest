// 動畫片段播放器：將純色背景嘅影片即時去背，俾繪畫程式當一張透明圖咁畫。
//
// 每條片一個 <video>（靜音、循環、唔放入頁面）。繪畫程式每格問 frame(key, role)：
//   - 片未準備好或者播唔到 → 回傳 null，繪畫程式自己改用靜態圖
//   - 準備好 → 回傳一個已去背嘅畫布。**要即刻畫**：顯示卡模式下所有片共用同一個畫布，
//     下一次叫 frame() 就會畫咗第二條片上去。
//
// 兩種去背方法，開頭自動揀：
//   1. 顯示卡（WebGL）：影片直接做貼圖，著色器逐像素去背。唔使將畫面讀返落記憶體，
//      所以原尺寸、每格更新都好平。正常都係用呢個。
//   2. 處理器（後備，冇 WebGL 或者顯示卡環境壞咗嗰陣）：將影片畫落細畫布，讀像素出嚟逐個計。
//      讀像素好貴，所以要靠 profiles 縮細畫布、降低頻率，同埋每格限住幫幾多個隊員更新。
// 分頁隱藏時由外面叫 setPaused(true) 停片。

import { keyOutBackground } from './chroma.js';
import { stepClip, triggerClip } from './clip-timing.js';

/**
 * @typedef {Object} ClipProfile   只有處理器模式用
 * @property {number} width
 * @property {number} height
 * @property {number} fps      每秒最多去背幾多次
 */

/**
 * @typedef {Object} ClipStore
 * @property {() => void} beginFrame   每次重繪開頭叫一次
 * @property {(key: string, role: string) => HTMLCanvasElement | null} frame
 * @property {(key: string) => import('../data/assets.js').ClipDef | undefined} def
 * @property {(key: string) => void} restart   由頭播（片段資料有 start 就由嗰度起；一次過嘅動作片開始嗰刻叫）
 * @property {(key: string, role: string) => void} preload   預先載入一條片：之後第一次要用就即刻有畫面，唔使等
 * @property {(key: string) => void} trigger   遊戲入面出招嗰刻叫：片段跳去出招動作（片段資料冇 attack 就冇反應）
 * @property {() => 'gpu' | 'cpu' | 'off'} mode
 * @property {() => Record<string, string>} report   每條片嘅狀態：playing / paused / loading / fallback
 * @property {() => Record<string, { role: string, size: string, keyMs: number, keysPerSec: number }>} stats
 * @property {() => void} resume    再試播一次（瀏覽器唔俾自動播放嗰陣，喺用戶第一下操作叫）
 * @property {(paused: boolean) => void} setPaused
 * @property {(seconds: number) => Promise<void>} seekAll   全部片跳去某個時間（除錯用）
 */

/** 一條片幾多格冇人用就停低 */
const PARK_AFTER_FRAMES = 20;

const VERTEX = `
attribute vec2 pos;
varying vec2 uv;
void main() { uv = pos * 0.5 + 0.5; gl_Position = vec4(pos, 0.0, 1.0); }`;

// 同 chroma.js 嘅 keyOutBackground 一樣嘅計法，數值範圍由 0–255 變成 0–1。輸出係預乘透明度。
const FRAGMENT = `
precision mediump float;
uniform sampler2D tex;
uniform float blue;   // 0 = 綠幕，1 = 藍幕
uniform vec3 key;     // hard, soft, despill
uniform float feather; // 畫面四邊幾闊嘅範圍淡出（比例）
varying vec2 uv;
void main() {
  vec4 c = texture2D(tex, uv);
  float bg = mix(c.g, c.b, blue);
  float m = max(c.r, mix(c.b, c.g, blue));
  float k = bg - m;
  float a = 1.0;
  float kept = bg;
  if (k > key.x) { a = 0.0; }
  else if (k > key.y) { a = 1.0 - (k - key.y) / (key.x - key.y); kept = m; }
  else if (k > 0.0) { kept = m + k * key.z; }
  vec3 rgb = mix(vec3(c.r, kept, c.b), vec3(c.r, c.g, kept), blue);
  // 片入面嘅光效（刀光、術式閃光）會去到畫面邊，唔淡出就會見到一條直邊
  float edge = min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y));
  a *= smoothstep(0.0, feather, edge);
  gl_FragColor = vec4(rgb * a, a);
}`;

/** 開一個顯示卡去背器；開唔到就回傳 null。 */
function createGpuKeyer(doc, key, feather) {
  try {
    const canvas = doc.createElement('canvas');
    canvas.width = 2; canvas.height = 2;
    const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false });
    if (!gl) return null;
    const compile = (type, src) => {
      const sh = gl.createShader(type);
      gl.shaderSource(sh, src); gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh) || 'shader');
      return sh;
    };
    const prog = gl.createProgram();
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERTEX));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAGMENT));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error('link');
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'pos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    gl.uniform3f(gl.getUniformLocation(prog, 'key'), key.hard / 255, key.soft / 255, key.despill);
    gl.uniform1f(gl.getUniformLocation(prog, 'feather'), Math.max(0.0001, feather));
    const uBlue = gl.getUniformLocation(prog, 'blue');
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.disable(gl.BLEND);

    const keyer = {
      canvas, lost: false,
      makeTexture() {
        const tex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        return tex;
      },
      /** 將 video 而家嗰格（upload = true 先重新上載）去背畫落共用畫布。 */
      render(tex, video, upload, blue) {
        const w = video.videoWidth, h = video.videoHeight;
        if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
        gl.viewport(0, 0, w, h);
        gl.bindTexture(gl.TEXTURE_2D, tex);
        if (upload) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
        gl.uniform1f(uBlue, blue ? 1 : 0);
        gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      },
    };
    canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); keyer.lost = true; });
    return keyer;
  } catch {
    return null;
  }
}

/**
 * @param {Record<string, import('../data/assets.js').ClipDef>} manifest
 * @param {Object} opts
 * @param {Record<string, ClipProfile>} opts.profiles     role → 大細同頻率（處理器模式用）；一定要有 'leader'
 * @param {{ hard: number, soft: number, despill: number }} opts.key
 * @param {number} [opts.memberKeysPerFrame]  處理器模式：每次重繪最多幫幾多個非隊長片段去背
 * @param {boolean} [opts.enabled]   false = 唔載入任何片，frame() 永遠回傳 null
 * @param {boolean} [opts.gpu]       false = 唔用顯示卡，直接用處理器模式（比較 / 除錯用）
 * @param {number} [opts.attackLead] 出招時跳去出招嗰格之前幾耐（秒）
 * @param {number} [opts.edgeFeather] 顯示卡模式：畫面四邊淡出嘅闊度（比例）
 * @returns {ClipStore}
 */
export function loadClips(manifest, opts) {
  const { profiles, key, memberKeysPerFrame = 1, enabled = true, gpu: wantGpu = true, attackLead = 0.1, edgeFeather = 0.06 } = opts;
  const doc = globalThis.document;
  const usable = enabled && !!doc;
  let gpu = usable && wantGpu ? createGpuKeyer(doc, key, edgeFeather) : null;
  /** @type {Map<string, any>} */
  const clips = new Map();
  let frameId = 0, paused = false;
  /** 處理器模式：今格獲准去背嘅非隊長片段 */
  let granted = new Set();

  const now = () => globalThis.performance.now();

  function create(k, role) {
    const def = manifest[k];
    const c = {
      key: k, def, role, profile: profiles[role] ?? profiles.leader,
      video: null, canvas: null, ctx: null, tex: null,
      state: def && usable ? 'loading' : 'fallback',
      mode: 'idle',          // 待機定出招緊（片段資料有 attack 先有用）
      keyed: false,          // 有冇去背過至少一次
      lastKeyAt: -1e9,       // 上次去背嘅時間（ms）
      lastMediaTime: -1,     // 上次去背嗰格嘅影片時間
      seen: 0,               // 最近邊一格有人問過
      parked: false,         // 一陣冇人用，停咗（慳解碼）；再有人問就繼續播
      keyMsSum: 0, keyCount: 0, since: now(),
    };
    clips.set(k, c);
    if (c.state === 'fallback') return c;

    const v = doc.createElement('video');
    if (def.rate) { v.defaultPlaybackRate = def.rate; v.playbackRate = def.rate; }
    v.muted = true; v.loop = !def.once; v.playsInline = true; v.preload = 'auto'; // once = 播完停喺最後一格
    v.setAttribute('muted', ''); v.setAttribute('playsinline', '');
    v.addEventListener('canplay', () => {
      if (c.state === 'fallback') return;
      const first = c.state !== 'ready';
      c.state = 'ready';
      if (first && def.start) seek(c, def.start); // 預先停喺開始位置，一叫播就唔使等跳位
      if (!paused && !c.parked) v.play().catch(() => {});
    });
    v.addEventListener('error', () => { c.state = 'fallback'; });
    v.src = def.url;
    c.video = v;
    return c;
  }

  const playable = (c) => c.state === 'ready' && c.video.readyState >= 2 && c.video.videoWidth > 0;

  const seek = (c, t) => { try { c.video.currentTime = t; } catch { /* 未準備好：下一格再試 */ } };

  /** 待機時避開出招嗰段；出招播完就返待機。片段資料有 loop 就只循環嗰一段。 */
  function tend(c) {
    const lp = c.def.loop;
    if (lp && !c.video.seeking && c.video.currentTime >= lp[1]) seek(c, lp[0]);
    const a = c.def.attack;
    if (!a || c.video.seeking) return;
    const next = stepClip(c.mode, c.video.currentTime, a);
    c.mode = next.mode;
    if (next.seekTo !== null) seek(c, next.seekTo);
  }

  // ----- 顯示卡 -----
  function gpuFrame(c) {
    const t = now();
    const fresh = !c.keyed || c.video.currentTime !== c.lastMediaTime;
    try {
      c.tex ??= gpu.makeTexture();
      gpu.render(c.tex, c.video, fresh, c.def.keyChannel === 'b');
    } catch {
      c.state = 'fallback';
      return null;
    }
    if (fresh) {
      c.keyed = true; c.lastMediaTime = c.video.currentTime; c.lastKeyAt = t;
      c.keyMsSum += now() - t; c.keyCount++;
    }
    return gpu.canvas;
  }

  // ----- 處理器（後備） -----
  function cpuKey(c, t) {
    const { width, height } = c.profile;
    try {
      if (!c.canvas) {
        c.canvas = doc.createElement('canvas');
        c.ctx = c.canvas.getContext('2d', { willReadFrequently: true });
      }
      if (c.canvas.width !== width || c.canvas.height !== height) { c.canvas.width = width; c.canvas.height = height; }
      c.ctx.clearRect(0, 0, width, height);
      c.ctx.drawImage(c.video, 0, 0, width, height);
      const im = c.ctx.getImageData(0, 0, width, height);
      keyOutBackground(im.data, c.def.keyChannel, key);
      c.ctx.putImageData(im, 0, 0);
    } catch {
      c.state = 'fallback'; // 例如跨來源影片令畫布讀唔到
      return;
    }
    c.keyed = true; c.lastMediaTime = c.video.currentTime; c.lastKeyAt = t;
    c.keyMsSum += now() - t; c.keyCount++;
  }

  const cpuDue = (c, t) => playable(c)
    && (!c.keyed || (c.video.currentTime !== c.lastMediaTime && t - c.lastKeyAt >= 1000 / c.profile.fps - 2));

  function cpuFrame(c) {
    const t = now();
    if (cpuDue(c, t) && (c.role === 'leader' || !c.keyed || granted.has(c))) cpuKey(c, t);
    return c.keyed && c.state === 'ready' ? c.canvas : null;
  }

  return {
    beginFrame() {
      if (gpu?.lost) {
        // 顯示卡環境冇咗：之後改用處理器模式
        gpu = null;
        for (const c of clips.values()) { c.tex = null; c.keyed = false; }
      }
      if (!gpu) {
        // 揀今格邊幾個非隊長片段可以去背：上一格有人用、而且夠鐘嘅入面，最耐冇更新嗰啲行先
        const t = now();
        const due = [];
        for (const c of clips.values()) if (c.role !== 'leader' && c.seen === frameId && cpuDue(c, t)) due.push(c);
        due.sort((a, b) => a.lastKeyAt - b.lastKeyAt);
        granted = new Set(due.slice(0, memberKeysPerFrame));
      }
      frameId++;
      // 一陣冇人用嘅片停低（例如喺地面嗰陣嘅飛行片），唔好白白解碼
      for (const c of clips.values()) {
        if (c.state === 'ready' && !c.parked && frameId - c.seen > PARK_AFTER_FRAMES && !c.video.paused) { c.video.pause(); c.parked = true; }
      }
    },

    frame(k, role) {
      let c = clips.get(k);
      if (!c) c = create(k, role);
      c.seen = frameId;
      if (c.role !== role) { c.role = role; c.profile = profiles[role] ?? profiles.leader; if (!gpu) c.keyed = false; }
      if (!playable(c)) return null;
      if (c.parked) { c.parked = false; if (!paused && !c.video.ended) c.video.play().catch(() => {}); }
      tend(c);
      return gpu ? gpuFrame(c) : cpuFrame(c);
    },

    def: (k) => manifest[k],

    /** 呢條片而家播到第幾秒；未準備好就回傳 null。 */
    time(k) {
      const c = clips.get(k);
      return c && c.state === 'ready' ? c.video.currentTime : null;
    },

    preload(k, role) {
      if (!clips.has(k)) create(k, role);
    },

    restart(k) {
      const c = clips.get(k);
      if (!c || c.state !== 'ready') return; // 未載入：第一次 frame() 自然由頭播
      seek(c, c.def.start ?? 0);
      c.parked = false;
      if (!paused) c.video.play().catch(() => {});
    },

    trigger(k) {
      const c = clips.get(k);
      if (!c || c.state !== 'ready' || !c.def.attack) return;
      const next = triggerClip(c.mode, c.video.currentTime, c.def.attack, attackLead);
      c.mode = next.mode;
      if (next.seekTo !== null) seek(c, next.seekTo);
    },
    mode: () => (!usable ? 'off' : gpu ? 'gpu' : 'cpu'),

    report() {
      const out = {};
      for (const c of clips.values()) out[c.key] = c.state === 'ready' ? (c.video.paused ? 'paused' : 'playing') : c.state;
      return out;
    },

    stats() {
      const out = {}, t = now();
      for (const c of clips.values()) {
        out[c.key] = {
          role: c.role,
          size: gpu ? `${c.video?.videoWidth}x${c.video?.videoHeight}` : `${c.profile.width}x${c.profile.height}`,
          keyMs: c.keyCount ? +(c.keyMsSum / c.keyCount).toFixed(3) : 0,
          keysPerSec: +(c.keyCount / Math.max(0.001, (t - c.since) / 1000)).toFixed(1),
        };
        c.keyMsSum = 0; c.keyCount = 0; c.since = t;
      }
      return out;
    },

    resume() {
      if (paused) return;
      for (const c of clips.values()) if (c.state === 'ready' && !c.parked && c.video.paused && !c.video.ended) c.video.play().catch(() => {});
    },

    setPaused(p) {
      paused = p;
      for (const c of clips.values()) {
        if (c.state !== 'ready') continue;
        if (p) c.video.pause(); else if (!c.parked && !c.video.ended) c.video.play().catch(() => {});
      }
    },

    seekAll(seconds) {
      const jobs = [];
      for (const c of clips.values()) {
        if (c.state !== 'ready') continue;
        jobs.push(new Promise((resolve) => {
          const v = c.video;
          const done = () => { v.removeEventListener('seeked', done); resolve(undefined); };
          v.addEventListener('seeked', done);
          v.currentTime = seconds % (v.duration || 1);
          setTimeout(done, 1500);
        }));
      }
      return Promise.all(jobs).then(() => undefined);
    },
  };
}
