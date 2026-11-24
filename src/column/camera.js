// 「三線長列」玩法嘅鏡頭：後上方嘅透視鏡頭（針孔模型）。世界位置（x、d、離地高度）→ 畫面像素。純計算。
// 數值喺 data/column.js 嘅 camera。
//
// 點樣定：鏡頭中心俯角 pitch；主角腳底要喺畫面高度 heroY，而且嗰個位嘅視線俯角要係 heroPitch（跑步片係咁影嘅）。
// 兩樣加埋就定咗焦距（即係上下視野）；再要主角嗰條線半條路闊佔畫面闊 roadHalf，就定咗鏡頭有幾高。

import { COLUMN } from '../data/column.js';

const RAD = Math.PI / 180;

/**
 * @param {number} W 畫面闊（像素）
 * @param {number} H 畫面高（像素）
 */
export function makeCamera(W, H, C = COLUMN.camera) {
  const th = C.pitch * RAD, hp = C.heroPitch * RAD, cos = Math.cos(th), sin = Math.sin(th);
  const f = (C.heroY - 0.5) * H / Math.tan(hp - th);          // 焦距（像素）
  const unit = Math.min(W, H * C.maxAspect) * C.roadHalf;     // 主角嗰條線：一個世界單位幾多像素
  const height = (f / unit) / (cos / Math.tan(hp) + sin);     // 鏡頭離地幾高（世界單位）
  const back = height / Math.tan(hp);                         // 鏡頭喺主角後面幾遠（地面距離）

  /** 世界位置 → 畫面位置；s = 相對主角嗰條線嘅縮放（主角嗰度 = 1）。up = 離地幾高。 */
  function project(x, d, up = 0) {
    const z = back + d, depth = Math.max(0.05, z * cos + (height - up) * sin), k = f / depth;
    return { x: W / 2 + x * k, y: H / 2 + k * ((height - up) * cos - z * sin), s: k / unit };
  }

  // 畫面頂對應地面幾遠（見到地平線就係無限遠）
  const topAngle = th - Math.atan(H / 2 / f);
  return {
    W, H, f, unit, height, back, project,
    /** 鏡頭中心俯角、上下視野（度） */
    pitch: C.pitch, fov: 2 * Math.atan(H / 2 / f) / RAD,
    /** 地面上離主角 d 遠嗰點嘅視線俯角（度）；up = 嗰點離地幾高 */
    pitchAt: (d, up = 0) => Math.atan2(height - up, back + d) / RAD,
    /** 畫面頂、畫面底對應地面幾遠（相對主角） */
    topDistance: topAngle > 0 ? height / Math.tan(topAngle) - back : Infinity,
    bottomDistance: height / Math.tan(th + Math.atan(H / 2 / f)) - back,
    /** 畫面橫向位置（0–1，相對畫布闊）→ 世界 x（主角嗰條線） */
    worldX: (nx) => (nx - 0.5) * W / unit,
  };
}
