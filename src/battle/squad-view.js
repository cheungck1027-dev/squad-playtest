// 畫小隊：隊員（動畫片段或者靜態圖）、落地陰影、腳底推進器光、槍口閃光、浮游砲、彈道。只讀狀態。
// 隊員同門、敵人一樣企喺路面，所以 render.js 會將佢哋同場上物件一齊按遠近排次序畫（drawMember）；
// 浮游砲同彈道喺所有嘢上面（drawSquadOverlay）。

import { MOTION, ONE_SHOT_ACTIONS, motionClip, wantedActions } from './actions.js';
import { TUNING } from '../data/tuning.js';
import { COVER_ALPHA } from './cover.js';
import { COLORS, setFont, slantPanel } from './draw.js';
import { drawTracers } from './effects.js';
import { memberPose } from './formation.js';
import { clipMuzzle, placeMuzzle, stillMuzzle } from './muzzle.js';
import { fireTier } from './rules.js';

/** 每個隊員上次見到佢出過幾多次招、播緊邊個動作、而家幾透明（純畫面記錄）。 @type {WeakMap<object, { acts: number, action: string, alpha?: number, t?: number }>} */
const seen = new WeakMap();

/**
 * 每格開頭叫一次：計好每個隊員嘅位置。
 * @param {import('./projection.js').View} view
 * @param {import('./state.js').BattleState} state
 */
export function poseSquad(view, state) {
  return state.squad.map((member) => {
    const pose = memberPose(view, member, state.flight);
    return { member, pose, d: pose.d };
  });
}

/** 揀呢個隊員而家播邊條片，回傳已去背嘅畫面同嗰條片嘅資料；冇片播得就回傳 null。 */
function pickFrame(clips, state, member, lead) {
  if (!clips) return null;
  const a = member.char.assets;
  const role = lead ? 'leader' : 'member';
  const memo = seen.get(member) ?? { acts: member.acts, action: '' };
  seen.set(member, memo);

  // 有分動作嘅角色：按優先次序搵第一條播得到嘅
  if (a.actions) {
    for (const action of wantedActions(state, member)) {
      const key = a.actions[action];
      if (!key) continue;
      if (memo.action !== action && ONE_SHOT_ACTIONS.has(action)) clips.restart(key);
      const frame = clips.frame(key, role);
      if (frame) { memo.action = action; memo.acts = member.acts; return { frame, def: clips.def(key) }; }
    }
  }
  // 預設片：出招嗰刻跳去片入面嘅出招動作。隊長有進化形態專用片就用嗰條（而家全部形態都未填，即係用返預設片）
  const key = (lead ? a.forms?.[state.evo]?.clip : undefined) ?? a.clip;
  if (!key) return null;
  if (memo.acts !== member.acts) clips.trigger(key);
  memo.acts = member.acts; memo.action = '';
  const frame = clips.frame(key, role);
  return frame ? { frame, def: clips.def(key), time: clips.time(key) } : null;
}

/** 將一格已去背嘅影片畫落立繪位置：影片入面 box 呢個範圍對應返成張立繪（闊 w、高 h，腳底喺原點）。 */
function blitClip(ctx, frame, box, w, h) {
  const fw = w / box.w, fh = h / box.h;
  ctx.drawImage(frame, -w / 2 - fw * box.x, -h - fh * box.y, fw, fh);
}

/**
 * 「地面跑 / 飛行」角色：按狀態揀片，換片時新舊兩條交疊淡入淡出（唔會閃一格空白）。
 * 新片未準備好就用返嗰個狀態嘅主圖。
 * @returns {boolean} 有冇畫到嘢
 */
function drawMotion(ctx, clips, assets, state, member, h, alpha) {
  const M = member.char.assets.motion;
  const memo = seen.get(member);
  const want = motionClip(state, member);
  if (memo.motion !== want) {
    memo.prevMotion = memo.motion; memo.motion = want; memo.fadeT = state.t;
    const def = clips?.def(M[want]);
    if (def && (def.once || def.start !== undefined)) clips.restart(M[want]);
  }
  const k = memo.prevMotion ? Math.max(0, Math.min(1, (state.t - memo.fadeT) / MOTION.fade)) : 1;
  let drawn = false;
  const layer = (name, a) => {
    if (a <= 0) return;
    const still = assets.get(name === 'run' ? member.char.assets.battleBack : M.flightStill);
    const w = h * (still.ok ? still.img.width / still.img.height : 2 / 3);
    const frame = clips?.frame(M[name], 'leader');
    ctx.globalAlpha = alpha * a;
    if (frame) blitClip(ctx, frame, clips.def(M[name]).box, w, h);
    else if (still.ok) ctx.drawImage(still.img, -w / 2, -h, w, h);
    else return;
    drawn = true;
  };
  // 舊片保持實色到一半先淡走，新片由零淡入：中間唔會兩條都半透明、睇穿去背景
  if (k < 1) layer(memo.prevMotion, Math.min(1, 2 * (1 - k)));
  layer(want, Math.min(1, 2 * k));
  ctx.globalAlpha = alpha;
  return drawn;
}

/**
 * 畫一個隊員。
 * @param {Map<string, [number, number]>} origins  發射點會寫入呢度（'m0' = 隊長槍口）
 * @param {boolean} [covering]  呢個隊員擋住咗身後嘅門或者敵人：淡出做半透明
 */
export function drawMember(ctx, view, state, assets, clips, member, pose, origins, covering = false) {
  const { u } = view;
  // 半透明要順滑咁過渡：快啲淡出（等玩家即刻睇到後面），慢啲返嚟
  const memo0 = seen.get(member) ?? { acts: member.acts, action: '' };
  seen.set(member, memo0);
  const dt = Math.max(0, Math.min(0.1, state.t - (memo0.t ?? state.t)));
  const target = covering ? COVER_ALPHA : 1, now = memo0.alpha ?? 1;
  const alpha = target < now ? Math.max(target, now - dt * 8) : Math.min(target, now + dt * 4);
  memo0.alpha = alpha; memo0.t = state.t;
  ctx.globalAlpha = alpha;
  const c = member.char, k = pose.k, lead = member.index === 0;
  const x = pose.x, vx = state.lane - member.x;
  const ax = x + pose.h * (c.battle.shiftX ?? 0); // 主圖中線（槍伸出一邊嘅造型，主圖中線唔喺腳中間）
  const h = pose.h, runs = c.battle.runs === true, air = pose.air;
  // 上下浮動：隊員各自錯開少少。跑步嘅角色喺地面唔浮（片入面本身有起伏），升起嚟先浮
  const bob = Math.sin(state.t * 7 + member.index * 1.7) * 3 * u * k * (runs ? air : 1);
  // 滑行嘅角色離地少少；跑步嘅角色腳踩實路面（主圖底邊係後腳離地嗰下，承重腳喺上面少少），飛行時升高
  const feet = runs ? pose.ground + bob + h * (c.battle.footDrop ?? 0.03) * (1 - air) - pose.lift : pose.ground + bob - 4 * u * k;

  // 貼地嘅接觸影（唔跟身體浮動）：跑步時實而短，飛行時細啲淡啲
  if (runs) {
    ctx.fillStyle = `rgba(10,12,22,${0.5 - 0.3 * air})`;
    ctx.beginPath(); ctx.ellipse(x, pose.ground + h * 0.012, h * (0.15 - 0.05 * air), h * (0.028 - 0.01 * air), 0, 0, 7); ctx.fill();
  } else {
    ctx.fillStyle = 'rgba(10,12,22,.32)';
    ctx.beginPath(); ctx.ellipse(x, pose.ground - h * 0.025, h * 0.19, h * 0.04, 0, 0, 7); ctx.fill();
  }

  // 腳底推進器光（跑步嘅角色喺地面冇，起飛先亮起）
  const glow = c.battle.glow, glowK = runs ? air : 1;
  if (runs) {
    // 識飛嘅角色：靴嘅噴射光喺片入面已經有，呢度只畫照落路面嗰灘光
    if (air > 0.01) {
      ctx.save(); ctx.translate(x, pose.ground); ctx.scale(1, 0.3);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, h * 0.2);
      g.addColorStop(0, `rgba(${glow},${0.32 * air})`); g.addColorStop(1, `rgba(${glow},0)`);
      ctx.fillStyle = g; ctx.fillRect(-h * 0.2, -h * 0.2, h * 0.4, h * 0.4);
      ctx.restore();
    }
  } else if (glowK > 0.01) {
    for (const side of [-1, 1]) {
      const cx = x + side * 22 * u * k, cy = feet - 6 * u * k;
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 46 * u * k);
      g.addColorStop(0, `rgba(${glow},${(0.55 + Math.sin(state.t * 40) * 0.15) * glowK})`); g.addColorStop(1, `rgba(${glow},0)`);
      ctx.fillStyle = g; ctx.fillRect(x - 90 * u * k, feet - 60 * u * k, 180 * u * k, 110 * u * k);
    }
  }

  // 進化形態嘅光環（隊長）：腳下一圈代表色嘅光，演出期間由細爆大再收返
  if (lead && state.evo > 0) drawAura(ctx, state, x, pose.ground, h, alpha);

  // 立繪：轉車道時傾側，平時輕微搖擺；衝前時向前壓低
  ctx.save();
  const lean = { x: ax, y: feet, rot: vx * 0.12, skew: Math.sin(state.t * 2.4 + member.index) * 0.012 - vx * 0.05, sy: 1 - pose.lunge * 0.05 };
  ctx.translate(lean.x, lean.y); ctx.rotate(lean.rot);
  ctx.transform(1, 0, lean.skew, lean.sy, 0, 0);
  const still = assets.get((lead ? c.assets.forms?.[state.evo]?.still : undefined) ?? c.assets.battleBack);
  // 飛行道具開咗先用「地面 / 飛行」嗰組片；關咗就淨係播預設嘅跑步片
  const useMotion = lead && !!c.assets.motion && TUNING.flight.enabled;
  const picked = useMotion ? null : pickFrame(clips, state, member, lead);
  if (useMotion && drawMotion(ctx, clips, assets, state, member, h, alpha)) {
    // 已經畫咗
  } else if (picked) {
    blitClip(ctx, picked.frame, picked.def.box, h * (still.ok ? still.img.width / still.img.height : 2 / 3), h);
  } else if (still.ok) {
    const w = h * still.img.width / still.img.height;
    ctx.drawImage(still.img, -w / 2, -h, w, h);
  } else {
    ctx.fillStyle = lead ? '#cfc8e6' : `rgb(${glow})`;
    ctx.fillRect(-30 * u * k, -h, 60 * u * k, h);
  }
  ctx.restore();

  // 槍口位置（用槍嘅角色先有閃光；彈道由呢度畫出去）
  const mg = c.battle.muzzle, mf = c.battle.muzzleFlight ?? mg;
  let gx = ax + h * (mg[0] + (mf[0] - mg[0]) * air), gy = feet - h * (mg[1] + (mf[1] - mg[1]) * air);
  if (runs && !useMotion) {
    // 跟住片入面而家嗰格嘅槍口（冇片就用主圖嘅固定位置），再套返人物換車道嗰陣嘅傾側同平移
    const sw = h * (still.ok ? still.img.width / still.img.height : 2 / 3);
    [gx, gy] = placeMuzzle((picked && clipMuzzle(picked.def, picked.time, sw, h)) || stillMuzzle(mg, h), lean);
  }
  origins.set(`m${member.index}`, [gx, gy]);
  if (member.muzzle) {
    const over = state.over > 0;
    const boost = lead ? TUNING.firepower.tiers[fireTier(state.power)].flash : 1; // 火力級數越高，閃光越大
    const r = ((over ? member.weapon?.overFlashSize : member.weapon?.flashSize) ?? 40) * u * k * boost;
    const m = assets.get(c.assets.muzzleFlash ?? '');
    if (m.ok) {
      if (c.battle.flashFilter) ctx.filter = c.battle.flashFilter;
      ctx.drawImage(m.img, gx - r, gy - r, r * 2, r * 2);
      ctx.filter = 'none';
    } else {
      const g = ctx.createRadialGradient(gx, gy, 0, gx, gy, r);
      g.addColorStop(0, 'rgba(255,255,255,.95)'); g.addColorStop(0.35, 'rgba(120,240,255,.7)'); g.addColorStop(1, 'rgba(95,240,255,0)');
      ctx.fillStyle = g; ctx.fillRect(gx - r, gy - r, r * 2, r * 2);
    }
  }
  ctx.globalAlpha = 1;
}

/** 所有隊員畫完之後：浮游砲、護衛光球、彈道、隊長頭頂嘅攻擊力數字。 */
export function drawSquadOverlay(ctx, view, state, assets, posed, origins) {
  for (const { member, pose } of posed) if (member.style.id === 'drones') drawDrones(ctx, view, state, assets, member, pose, origins);
  const lead = posed.find((p) => p.member.index === 0);
  if (lead) drawOrbs(ctx, view, state, lead.pose);
  drawTracers(ctx, view, state, origins);
  if (lead) drawHeadNumber(ctx, view, state, lead.pose);
}

/** 進化形態嘅代表色（R,G,B）。 */
const evoColor = (level) => TUNING.evolution.colors[Math.min(level, TUNING.evolution.colors.length - 1)];

/** 進化光環：腳下一圈光，形態越高越大越光；演出期間（state.evoT）爆開一下，再加一條向上嘅光柱。 */
function drawAura(ctx, state, x, ground, h, alpha) {
  const c = evoColor(state.evo), E = TUNING.evolution;
  const show = state.evoT > 0 ? state.evoT / E.showTime : 0;           // 1 → 0
  const burst = show > 0 ? Math.sin(Math.min(1, (1 - show) * 2.5) * Math.PI / 2) * show : 0;
  const pulse = 0.85 + Math.sin(state.t * 5) * 0.15;
  const r = h * (0.2 + 0.04 * state.evo) * (1 + burst * 1.6);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.translate(x, ground); ctx.scale(1, 0.32);
  const g = ctx.createRadialGradient(0, 0, r * 0.35, 0, 0, r);
  g.addColorStop(0, `rgba(${c},0)`); g.addColorStop(0.7, `rgba(${c},${(0.35 + 0.1 * state.evo) * pulse * alpha})`); g.addColorStop(1, `rgba(${c},0)`);
  ctx.fillStyle = g; ctx.fillRect(-r, -r, r * 2, r * 2);
  ctx.restore();
  if (show > 0) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const w = h * 0.34 * (0.4 + show * 0.6);
    const p = ctx.createLinearGradient(0, ground - h * 1.5, 0, ground);
    p.addColorStop(0, `rgba(${c},0)`); p.addColorStop(1, `rgba(${c},${0.55 * show})`);
    ctx.fillStyle = p; ctx.fillRect(x - w / 2, ground - h * 1.5, w, h * 1.5);
    ctx.restore();
  }
}

/** 護衛光球：火力去到某幾級，身邊多幾粒跟住浮動嘅光球（純畫面，數量喺 tuning 嘅 firepower.tiers）。 */
function drawOrbs(ctx, view, state, pose) {
  const tier = TUNING.firepower.tiers[fireTier(state.power)];
  if (!tier.orbs) return;
  const { u } = view, h = pose.h;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < tier.orbs; i++) {
    const side = i % 2 ? 1 : -1, row = Math.floor(i / 2);
    const x = pose.x + side * h * (0.27 + row * 0.1) + Math.sin(state.t * 2.1 + i * 1.9) * 4 * u;
    const y = pose.ground - h * (0.72 - row * 0.2) + Math.sin(state.t * 3.3 + i * 1.3) * 5 * u;
    const r = (13 - row * 2) * u;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r * 2.2);
    g.addColorStop(0, 'rgba(255,255,255,.95)'); g.addColorStop(0.3, `rgba(${tier.color},.8)`); g.addColorStop(1, `rgba(${tier.color},0)`);
    ctx.fillStyle = g; ctx.fillRect(x - r * 2.2, y - r * 2.2, r * 4.4, r * 4.4);
  }
  ctx.restore();
}

/**
 * 主角嘅攻擊力大數字：主角唯一嘅數字，畫喺佢腳線下面（headNumber.below）。
 * 唔放頭頂：正前方嘅門同敵人行埋嚟嗰陣，佢哋嘅數字會經過頭頂嗰個位，兩個數字疊埋睇唔到。腳線下面冇嘢會行過。
 * 過門 / 受擊嗰陣跳大再縮返，正向（加、乘）變綠、負向（減、除、俾敵人扣）變紅；
 * 平時用進化形態嘅代表色，進化咗就加框。
 */
function drawHeadNumber(ctx, view, state, pose) {
  const { u } = view, N = TUNING.headNumber;
  const k = state.pop.t > 0 ? state.pop.t / N.popTime : 0;               // 1 → 0
  const evoPop = state.evoT > 0 ? state.evoT / TUNING.evolution.showTime : 0;
  const size = N.size * u * (1 + N.popScale * Math.max(k * k, evoPop * evoPop * 0.8));
  const x = pose.x, y = pose.ground + view.H * N.below;
  const txt = state.power > 99999 ? (state.power / 1000).toFixed(0) + 'K' : String(state.power);
  const base = `rgb(${evoColor(state.evo)})`;
  const color = k > 0.15 ? (state.pop.tone === 'gain' ? '#46ebaa' : COLORS.red) : base;
  ctx.save();
  setFont(ctx, size, 800); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  if (state.evo > 0) {
    // 進化咗：數字後面加一塊斜牌，框用形態色；形態越高框越粗
    const w = ctx.measureText(txt).width + size * 0.7;
    slantPanel(ctx, x - w / 2, y - size * 0.62, w, size * 1.2, size * 0.22, 'rgba(14,18,32,.72)');
    ctx.strokeStyle = base; ctx.lineWidth = (1.5 + state.evo) * u; ctx.stroke();
  }
  ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(3, size * 0.14); ctx.strokeStyle = COLORS.ink;
  ctx.strokeText(txt, x, y);
  ctx.shadowColor = color; ctx.shadowBlur = (8 + 10 * k + 6 * state.evo) * u;
  ctx.fillStyle = color;
  ctx.fillText(txt, x, y);
  ctx.restore();
}

/** 浮游砲：懸停喺主人頭頂附近，各自輕輕浮動；開火一刻砲口閃一閃。 */
function drawDrones(ctx, view, state, assets, member, pose, origins) {
  const { u } = view;
  const P = member.style.params, im = assets.get(P.asset);
  const size = P.size * u * Math.max(0.7, pose.k * 1.4);
  for (let i = 0; i < P.count; i++) {
    const hv = P.hover[i % P.hover.length];
    const x = Math.max(size * 0.6, Math.min(view.W - size * 0.6, pose.x + hv.dx * pose.h)) + Math.sin(state.t * 1.9 + i * 2.4) * 5 * u;
    const y = pose.ground - hv.up * pose.h + Math.sin(state.t * 3.1 + i * 1.3) * 5 * u;
    origins.set(`m${member.index}d${i}`, [x, y - size * 0.1]);
    if (im.ok) ctx.drawImage(im.img, x - size / 2, y - size / 2, size, size);
    else {
      ctx.fillStyle = '#eef0f6'; ctx.beginPath(); ctx.arc(x, y, size * 0.36, 0, 7); ctx.fill();
      ctx.fillStyle = `rgb(${member.char.battle.glow})`; ctx.beginPath(); ctx.arc(x, y + size * 0.1, size * 0.12, 0, 7); ctx.fill();
    }
    if (member.s.flash?.[i] > 0) {
      const r = size * 0.7;
      const g = ctx.createRadialGradient(x, y - size * 0.1, 0, x, y - size * 0.1, r);
      g.addColorStop(0, 'rgba(255,255,255,.95)'); g.addColorStop(0.4, `rgba(${P.tracer.color},.7)`); g.addColorStop(1, `rgba(${P.tracer.color},0)`);
      ctx.fillStyle = g; ctx.fillRect(x - r, y - size * 0.1 - r, r * 2, r * 2);
    }
  }
}
