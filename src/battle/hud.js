// 戰鬥 HUD：關卡同進度、首領數字條、SYNC / OVERDRIVE 計量條、橫額。只讀狀態。

import { TEXT } from '../data/text.js';
import { COLORS, setFont, slantPanel } from './draw.js';

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {import('./projection.js').View} view
 * @param {import('./state.js').BattleState} state
 */
export function drawHud(ctx, view, state) {
  const { W, H, u } = view;
  const over = state.over > 0;
  ctx.textBaseline = 'middle';

  // 左上：第幾關
  slantPanel(ctx, 14 * u, 16 * u, 150 * u, 34 * u, 10 * u, COLORS.panel, 'rgba(255,255,255,.35)');
  setFont(ctx, 19 * u, 700); ctx.fillStyle = '#fff'; ctx.textAlign = 'left';
  ctx.fillText(`${TEXT.hud.stage} ${String(state.stageNo).padStart(2, '0')}`, 34 * u, 34 * u);

  // 上方：關卡進度（去到盡頭嘅紅色菱形 = 首領）
  const x0 = 186 * u, x1 = W - 26 * u, y = 33 * u;
  const k = state.boss ? 1 : state.rowIndex / state.rows.length;
  ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 2 * u;
  ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke();
  ctx.strokeStyle = COLORS.cyan;
  ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x0 + (x1 - x0) * k, y); ctx.stroke();
  ctx.fillStyle = COLORS.cyan;
  ctx.beginPath(); ctx.arc(x0 + (x1 - x0) * k, y, 6 * u, 0, 7); ctx.fill();
  ctx.fillStyle = COLORS.red;
  ctx.save(); ctx.translate(x1, y); ctx.rotate(0.785); ctx.fillRect(-6 * u, -6 * u, 12 * u, 12 * u); ctx.restore();

  // 首領 HP 條
  if (state.boss) {
    const bw = W - 190 * u, bx = 16 * u, by = 76 * u;
    slantPanel(ctx, bx, by, bw, 12 * u, 5 * u, 'rgba(14,18,32,.8)');
    slantPanel(ctx, bx, by, bw * Math.max(0, state.boss.hp / state.boss.max), 12 * u, 5 * u, COLORS.red);
  }

  // 攻擊力唔喺呢度：佢係主角頭頂嗰個大數字（squad-view.js 嘅 drawHeadNumber）

  // 右上：飛行核心剩低幾耐
  if (state.flight.time > 0) {
    const fy = 60 * u, fx = W - 150 * u, fw = 136 * u;
    slantPanel(ctx, fx, fy, fw, 30 * u, 9 * u, COLORS.panel, COLORS.cyan);
    setFont(ctx, 12 * u, 700); ctx.fillStyle = COLORS.cyan; ctx.textAlign = 'left';
    ctx.fillText(TEXT.hud.flight, fx + 18 * u, fy + 12 * u);
    setFont(ctx, 15 * u, 800); ctx.fillStyle = '#fff'; ctx.textAlign = 'right';
    ctx.fillText(`${state.flight.time.toFixed(1)} ${TEXT.hud.seconds}`, W - 26 * u, fy + 12 * u);
    slantPanel(ctx, fx + 16 * u, fy + 22 * u, (fw - 30 * u) * Math.min(1, state.flight.time / state.flight.max), 4 * u, 2 * u, COLORS.cyan);
  }

  // 底部：SYNC 計量條（滿咗撳呢度發動 OVERDRIVE）
  const gx = 22 * u, gy = H - 40 * u, gw = W - 44 * u;
  slantPanel(ctx, gx, gy - 12 * u, gw, 34 * u, 10 * u, 'rgba(14,18,32,.8)', 'rgba(255,255,255,.3)');
  setFont(ctx, 13 * u, 700); ctx.textAlign = 'left'; ctx.fillStyle = '#fff';
  ctx.fillText(over ? TEXT.hud.overdrive : TEXT.hud.sync, gx + 20 * u, gy + 5 * u);
  const bx = gx + 120 * u, bw = gw - 200 * u, v = over ? state.over / state.overMax : state.sync;
  slantPanel(ctx, bx, gy, bw, 10 * u, 4 * u, 'rgba(255,255,255,.14)');
  slantPanel(ctx, bx, gy, bw * v, 10 * u, 4 * u, over ? COLORS.gold : COLORS.cyan);
  setFont(ctx, 15 * u, 800); ctx.textAlign = 'right'; ctx.fillStyle = state.sync >= 1 ? COLORS.gold : '#fff';
  ctx.fillText(over ? `${state.over.toFixed(1)} ${TEXT.hud.seconds}` : state.sync >= 1 ? TEXT.hud.syncReady : Math.round(state.sync * 100) + '%', gx + gw - 18 * u, gy + 5 * u);

  // 橫額
  if (state.banner.t > 0) {
    const alert = state.banner.tone === 'alert';
    ctx.globalAlpha = Math.min(1, state.banner.t * 2);
    ctx.save(); ctx.translate(W / 2, H * 0.3); ctx.rotate(-0.06);
    ctx.fillStyle = alert ? 'rgba(160,20,40,.86)' : 'rgba(14,18,32,.86)';
    ctx.fillRect(-W, -30 * u, W * 2, 60 * u);
    setFont(ctx, 40 * u, 800); ctx.textAlign = 'center'; ctx.fillStyle = alert ? '#fff' : COLORS.cyan;
    ctx.fillText(state.banner.text, 0, 2 * u);
    ctx.restore(); ctx.globalAlpha = 1;
  }
}
