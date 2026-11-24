// 槍口喺邊：由片源嘅逐格座標換算做「主圖局部位置」，再套返同人物一樣嘅傾側。純計算，唔掂畫布。
// 局部位置：原點係主圖底邊中點，x 向右、y 向下（即係槍口嘅 y 係負數），單位係畫面像素。

/**
 * 片播到第 time 秒嗰格嘅槍口局部位置；條片冇逐格座標就回傳 null。
 * @param {import('../data/assets.js').ClipDef | undefined} def
 * @param {number | null} time   片而家播到第幾秒
 * @param {number} w  主圖顯示闊
 * @param {number} h  主圖顯示高
 * @returns {[number, number] | null}
 */
export function clipMuzzle(def, time, w, h) {
  const frames = def?.muzzleFrames;
  if (!frames || time === null || !Number.isFinite(time)) return null;
  const n = frames.length, i = ((Math.floor(time * (def.fps ?? 30) + 1e-6) % n) + n) % n;
  const [mx, my] = frames[i], box = def.box;
  return [((mx - box.x) / box.w - 0.5) * w, ((my - box.y) / box.h - 1) * h];
}

/** 主圖上面固定嘅槍口位置（[離中線向右, 離底邊向上] × 主圖高度）換做局部位置。 */
export const stillMuzzle = (m, h) => [m[0] * h, -m[1] * h];

/**
 * 套返人物嘅變形（同 squad-view 畫立繪嗰段一樣：先斜切同壓低，再旋轉，最後移去腳底位置）。
 * @param {[number, number]} p   局部位置
 * @param {{ x: number, y: number, rot: number, skew: number, sy: number }} t  腳底畫面位置、旋轉（弧度）、斜切、垂直縮放
 * @returns {[number, number]}
 */
export function placeMuzzle(p, t) {
  const sx = p[0] + t.skew * p[1], sy = t.sy * p[1];
  const c = Math.cos(t.rot), s = Math.sin(t.rot);
  return [t.x + sx * c - sy * s, t.y + sx * s + sy * c];
}
