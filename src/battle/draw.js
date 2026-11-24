// 繪畫共用嘅小工具同顏色。全部函數都要傳 ctx 入嚟，匯入呢個檔唔需要有畫布。

export const COLORS = {
  cyan: '#5ff0ff',
  red: '#ff5a6a',
  gold: '#ffe36a',
  ink: '#0e1220',
  panel: 'rgba(14,18,32,.78)',
};

/** 斜邊面板（平行四邊形）。sk = 斜幾多。 */
export function slantPanel(ctx, x, y, w, h, sk, fill, stroke) {
  ctx.beginPath();
  ctx.moveTo(x + sk, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w - sk, y + h); ctx.lineTo(x, y + h);
  ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1.2; ctx.stroke(); }
}

/** 斜體介面字。 */
export function setFont(ctx, px, weight = 700) {
  ctx.font = `italic ${weight} ${px}px "Segoe UI","Noto Sans TC",system-ui,sans-serif`;
}

/** 深色斜牌 + 白字（敵人 HP 牌用）。 */
export function drawTag(ctx, x, y, txt, s, stroke) {
  setFont(ctx, 22 * s, 800);
  const w = ctx.measureText(txt).width + 22 * s;
  slantPanel(ctx, x - w / 2, y - 15 * s, w, 28 * s, 7 * s, 'rgba(14,18,32,.82)', stroke);
  ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(txt, x, y);
}
