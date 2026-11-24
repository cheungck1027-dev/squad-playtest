// 3D 戰鬥畫面用嘅純計算：唔掂 Three.js、唔掂畫布，測試可以直接行。
//   camera3d      將 2D 版嘅針孔鏡頭（camera.js）換成 3D 鏡頭嘅擺位：兩邊用同一組數，畫面先會對得返
//   worldHeight   一樣企喺主角嗰條線嘅嘢，想佢喺畫面佔幾高，世界入面要幾高
//   decimate      將模型減面（頂點歸格合併）：幾百隻小敵人同時出現，原模型太重；decimateTo = 減到指定面數以內
//
// 3D 世界座標：x = 橫向（同遊戲一樣），y = 離地高度，z = −d（向前係負 z）。主角腳底喺原點嗰條線。

import { COLUMN } from '../data/column.js';

const RAD = Math.PI / 180;

/** 主角頭頂到靴底佔畫面高度幾多：同 2D 版同一個數（素材設定嘅 15% × heroScale ≈ 11%）。 */
export const LEAD_BODY = 0.15 * COLUMN.camera.heroScale;

/**
 * 3D 畫面主角頭頂到靴底佔畫面高度幾多（2026-11-23 起細過 2D 版：一個人對一大群，主角太大會笨重、遮住前面）。
 * 預設 7%（2026-11-23 使用者試過 6/7/8/9/11 之後揀）。只縮主角，鏡頭同規則（碰撞、線道）唔變。choices = 網址 ?hero=N 可以臨時揀嘅百分比（俾使用者比較）。
 */
export const HERO_3D = { body: 0.07, choices: [6, 7, 8, 9, 11] };

/** ?hero=N（N = 佔畫面高度嘅百分比）→ 比例；冇填或者唔喺 choices 入面就用預設。 */
export function heroBody(param) {
  const n = Number(param);
  return param !== null && param !== undefined && param !== '' && HERO_3D.choices.includes(n) ? n / 100 : HERO_3D.body;
}

/**
 * 呢粒子彈屬於邊一輪齊射、喺嗰輪第幾排（純畫面：重拍、左右交替、前後排大細用）。
 * shots = 最近幾輪齊射 [{ t: 幾時射, n: 第幾輪, rows }]，由舊到新；now = 而家時間；d = 子彈離主角幾遠。
 * 子彈由 startD 起飛、每秒飛 speed；後排起飛嗰陣喺前排後面 rowGap，所以睇落「遲咗少少射」。
 * @returns {{ shot: { t: number, n: number, rows: number } | null, row: number }}
 */
export function salvoOf(shots, now, d, fire) {
  const born = now - (d - fire.startD) / fire.speed;
  for (let i = shots.length - 1; i >= 0; i--) {
    if (shots[i].t <= born + 0.02) return { shot: shots[i], row: Math.max(0, Math.min(shots[i].rows - 1, Math.round((born - shots[i].t) * fire.speed / fire.rowGap))) };
  }
  return { shot: null, row: 0 };
}

/**
 * 由成個跑步循環逐格量到嘅最高點（頭頂）同最低點（著地嗰隻靴底），計人物企直幾高、腳底喺邊。
 * 取中位數：個別一格跳起或者踎低唔會拉歪。伸出去嘅手腳同頭髮只會向橫，唔入數。
 * @param {{ min: number, max: number }[]} samples
 * @returns {{ height: number, base: number }}
 */
export function bodyExtent(samples) {
  const mid = (arr) => { const a = arr.slice().sort((x, y) => x - y), n = a.length; return n % 2 ? a[(n - 1) / 2] : (a[n / 2 - 1] + a[n / 2]) / 2; };
  return { height: mid(samples.map((s) => s.max - s.min)), base: mid(samples.map((s) => s.min)) };
}

/**
 * @param {ReturnType<import('./camera.js').makeCamera>} cam
 * @returns {{ fov: number, aspect: number, position: [number, number, number], pitch: number }}
 *   fov = 上下視野（度）；position = 鏡頭位置；pitch = 向下望幾多（弧度，鏡頭向 −z 再向下轉）
 */
export function camera3d(cam) {
  return { fov: cam.fov, aspect: cam.W / cam.H, position: [0, cam.height, cam.back], pitch: cam.pitch * RAD };
}

/**
 * 企喺主角嗰條線（d = 0）嘅嘢，要喺畫面佔 frac × 畫面高度，世界入面要幾高。
 * 鏡頭由上面斜望落嚟，直企嘅嘢喺畫面會壓短，所以唔係單純除返比例，用二分法搵。
 * @param {ReturnType<import('./camera.js').makeCamera>} cam
 * @param {number} frac
 */
export function worldHeight(cam, frac) {
  const base = cam.project(0, 0).y, want = frac * cam.H;
  let lo = 0, hi = cam.height * 0.95;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (base - cam.project(0, 0, mid).y < want) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

/**
 * 減面：將空間切成邊長 cell 嘅格，同一格嘅頂點合併成一點（位置取平均，貼圖座標用第一點嘅），
 * 三個角落唔同格嘅三角形先留低，重複嘅掉走。粗糙，但小敵人喺畫面得幾十像素高，睇唔出。
 * @param {ArrayLike<number>} positions  每點 x, y, z
 * @param {ArrayLike<number> | null} uvs  每點 u, v
 * @param {ArrayLike<number> | null} indices  每個三角形三個頂點編號；null = 順序每三點一個
 * @param {number} cell
 * @returns {{ positions: Float32Array, uvs: Float32Array, indices: Uint32Array }}
 */
export function decimate(positions, uvs, indices, cell) {
  const n = positions.length / 3, map = new Map(), remap = new Uint32Array(n);
  const sum = [], count = [], uv = [];
  for (let i = 0; i < n; i++) {
    const x = positions[i * 3], y = positions[i * 3 + 1], z = positions[i * 3 + 2];
    const ix = Math.round(x / cell), iy = Math.round(y / cell), iz = Math.round(z / cell);
    // 格仔編號砌成一個數（比砌字串快好多：外來模型可以有幾萬個頂點）；格數多到出界先用字串
    const key = Math.abs(ix) < 65536 && Math.abs(iy) < 65536 && Math.abs(iz) < 65536 ? ((ix + 65536) * 131072 + (iy + 65536)) * 131072 + (iz + 65536) : `${ix},${iy},${iz}`;
    let id = map.get(key);
    if (id === undefined) {
      id = count.length; map.set(key, id);
      sum.push(0, 0, 0); count.push(0); uv.push(uvs ? uvs[i * 2] : 0, uvs ? uvs[i * 2 + 1] : 0);
    }
    sum[id * 3] += x; sum[id * 3 + 1] += y; sum[id * 3 + 2] += z; count[id]++;
    remap[i] = id;
  }
  const outPos = new Float32Array(count.length * 3);
  for (let i = 0; i < count.length; i++) for (let k = 0; k < 3; k++) outPos[i * 3 + k] = sum[i * 3 + k] / count[i];
  const tris = indices ? indices.length / 3 : n / 3, seen = new Set(), out = [];
  for (let t = 0; t < tris; t++) {
    const a = remap[indices ? indices[t * 3] : t * 3], b = remap[indices ? indices[t * 3 + 1] : t * 3 + 1], c = remap[indices ? indices[t * 3 + 2] : t * 3 + 2];
    if (a === b || b === c || a === c) continue;
    const lo = Math.min(a, b, c), hi = Math.max(a, b, c), key = `${lo},${a + b + c - lo - hi},${hi}`;
    if (seen.has(key)) continue;
    seen.add(key); out.push(a, b, c);
  }
  return { positions: outPos, uvs: new Float32Array(uv), indices: new Uint32Array(out) };
}

/**
 * 減面到最多 target 個三角形：格仔邊長由細試到大（二分法），揀「面數唔超過 target」入面最細嗰個格。
 * 本身已經唔超過 target 就原樣返回（cell = 0）。size = 模型最長嗰邊（定格仔邊長嘅範圍）。
 * @param {ArrayLike<number>} positions
 * @param {ArrayLike<number> | null} uvs
 * @param {ArrayLike<number> | null} indices
 * @param {number} target
 * @param {number} size
 * @returns {{ positions: ArrayLike<number>, uvs: ArrayLike<number> | null, indices: ArrayLike<number> | null, cell: number, triangles: number }}
 */
export function decimateTo(positions, uvs, indices, target, size) {
  const tris = (indices ? indices.length : positions.length / 3) / 3;
  if (!(target > 0) || tris <= target) return { positions, uvs, indices, cell: 0, triangles: tris };
  let lo = size * 0.004, hi = size * 0.5, best = null, bestCell = hi;
  for (let i = 0; i < 9; i++) {
    const cell = Math.sqrt(lo * hi), out = decimate(positions, uvs, indices, cell);
    if (out.indices.length / 3 <= target) { best = out; bestCell = cell; hi = cell; } else lo = cell;
  }
  best ??= decimate(positions, uvs, indices, hi);
  return { ...best, cell: bestCell, triangles: best.indices.length / 3 };
}

/**
 * 更新率計：記住最近 windowSec 秒每格相隔幾耐（毫秒）。
 * read() → fps = 最近 1 秒嘅平均更新率；worstMs = 最近 windowSec 秒入面最慢嗰格。
 * 相隔超過 1 秒嘅唔入數（分頁隱藏咗或者停咗，唔係真係慢）。
 * @param {number} [windowSec]
 */
export function makeFpsMeter(windowSec = 5) {
  const ring = [];
  let now = 0;
  return {
    frame(dtMs) {
      if (!(dtMs > 0) || dtMs > 1000) return;
      now += dtMs; ring.push([now, dtMs]);
      while (ring.length && ring[0][0] <= now - windowSec * 1000) ring.shift();
    },
    read() {
      let n = 0, sum = 0, worst = 0;
      for (const [t, dt] of ring) { if (dt > worst) worst = dt; if (t > now - 1000) { n++; sum += dt; } }
      return { fps: sum > 0 ? n * 1000 / sum : 0, worstMs: worst };
    },
  };
}

/**
 * 畫質保護：逐秒計平均更新率，連續 hold 秒都低過 below 就降一級（level + 1），降到最低一級為止；唔會自己升返。
 * 只係揀畫面解像度，唔掂規則同判定。frame() 返回 true = 呢一格啱啱降咗級。
 * @param {{ levels: number, below?: number, hold?: number }} opts  levels = 總共幾多級
 */
export function makeQualityGuard({ levels, below = 45, hold = 3 }) {
  let level = 0, bad = 0, acc = 0, n = 0;
  return {
    get level() { return level; },
    frame(dtMs) {
      if (!(dtMs > 0) || dtMs > 500) { acc = 0; n = 0; bad = 0; return false; } // 停過（或者分頁收埋咗）：由頭計
      acc += dtMs; n++;
      if (acc < 1000) return false;
      bad = n * 1000 / acc < below ? bad + 1 : 0;
      acc = 0; n = 0;
      if (bad < hold || level >= levels - 1) return false;
      level++; bad = 0;
      return true;
    },
  };
}
