// 去背（純色背景 → 透明）。純運算：只改一個 RGBA 像素陣列，唔掂畫布，可以喺 Node 測試。
//
// 做法：背景色通道（綠幕 = G，藍幕 = B）減去另外兩個通道入面大嗰個，得出「背景色超出幾多」k。
//   k > hard          → 全透明
//   soft < k ≤ hard   → 按比例半透明，並將背景色通道壓到同另外兩個通道一樣（去走邊緣嘅綠 / 藍邊）
//   0 < k ≤ soft      → 唔透明，只係將溢色壓低到 despill 咁多
//   k ≤ 0             → 原封不動

/**
 * @param {Uint8ClampedArray | Uint8Array} data  RGBA，每像素 4 格；直接改
 * @param {'g' | 'b'} channel                    背景色係邊個通道
 * @param {{ hard: number, soft: number, despill: number }} opts
 */
export function keyOutBackground(data, channel, opts) {
  const { hard, soft, despill } = opts;
  const ch = channel === 'b' ? 2 : 1, other = channel === 'b' ? 1 : 2;
  const fade = 255 / (hard - soft);
  for (let i = 0, n = data.length; i < n; i += 4) {
    const r = data[i], o = data[i + other], m = r > o ? r : o;
    const k = data[i + ch] - m;
    if (k <= 0) continue;
    if (k > hard) data[i + 3] = 0;
    else if (k > soft) { data[i + 3] = 255 - (k - soft) * fade; data[i + ch] = m; }
    else data[i + ch] = m + k * despill;
  }
}
