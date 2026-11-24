// 小隊陣形：每個隊員企喺路面邊度（車道 + 距離），同埋畫出嚟幾大。純運算，唔掂畫布。
// 隊員係真係企喺路上：企前啲就遠啲、細啲；企後啲就近鏡頭、大啲（同門、敵人用同一套透視）。
// 位置數值喺 data/tuning.js 嘅 squad。

import { TUNING } from '../data/tuning.js';
import { scaleAt, screenX, screenY } from './projection.js';

const S = TUNING.squad;

/**
 * 呢個位喺小隊橫向位置 x（-1 左車道 … 1 右車道，可以係小數）時，離隊長幾多條車道。
 * @param {{ lane: [number, number, number] }} slot
 * @param {number} x
 */
export function slotLaneOffset(slot, x) {
  const [l, c, r] = slot.lane;
  const k = Math.max(-1, Math.min(1, x));
  return k < 0 ? l * -k + c * (1 + k) : r * k + c * (1 - k);
}

/**
 * 隊員喺路面嘅位置：lane = 車道座標（可以係小數），d = 離隊長條線幾遠（正數 = 前面）。
 * 衝前出招（member.dashTo 有值、lunge 未完）時，會由陣形位置衝去目標再返嚟。
 * @param {import('./state.js').SquadMember} member
 * @returns {{ lane: number, d: number, lunge: number }}  lunge：0 = 喺陣形位置，1 = 去到最前
 */
export function memberSpot(member) {
  const slot = S.slots[member.index] ?? S.slots[0];
  let lane = member.x + slotLaneOffset(slot, member.x), d = slot.d;
  const dur = member.lungeDur || S.lungeTime;
  const p = member.lunge > 0 ? 1 - Math.min(1, member.lunge / dur) : 1; // 0 → 1
  // 快去慢返：頭三成時間衝到盡，之後慢慢返位
  const lunge = member.lunge > 0 ? (p < 0.3 ? Math.sin((p / 0.3) * Math.PI / 2) : Math.cos(((p - 0.3) / 0.7) * Math.PI / 2)) : 0;
  if (lunge > 0 && member.dashTo) {
    lane += (member.dashTo.lane - lane) * lunge;
    d += (member.dashTo.d - d) * lunge;
  } else if (lunge > 0) {
    d += S.lungeStep * lunge; // 冇指定目標（例如舉手施放）：原地向前踏一小步
  }
  return { lane, d, lunge };
}

/**
 * @typedef {Object} MemberPose
 * @property {number} x        腳底中心嘅畫面 x
 * @property {number} ground   腳底踩住嘅路面嘅畫面 y（未計上下浮動）
 * @property {number} h        立繪高度（像素）
 * @property {number} k        大細比例（1 = 原型嗰個佔四成畫面高嘅隊長），光效大細跟呢個
 * @property {number} lane
 * @property {number} d
 * @property {number} lunge
 * @property {number} air      離地程度 0–1（已平滑；只有識飛嘅隊長先會大過 0）
 * @property {number} lift     升高咗幾多像素
 */

/**
 * @param {import('./projection.js').View} view
 * @param {import('./state.js').SquadMember} member
 * @param {{ air: number }} [flight]  戰鬥狀態嘅 flight；唔傳 = 喺地面
 * @returns {MemberPose}
 */
export function memberPose(view, member, flight) {
  const spot = memberSpot(member);
  const slot = S.slots[member.index] ?? S.slots[0];
  const h = view.H * S.height * scaleAt(spot.d) * (slot.size ?? 1) * (member.char.battle.scale ?? 1);
  // 只有隊長會飛；起飛落地用平滑曲線
  const a = member.index === 0 && flight ? flight.air : 0;
  const air = a * a * (3 - 2 * a);
  // 身形闊嘅隊長喺邊線車道會出界：將佢向內推返入畫面（reach = 身體向左 / 右伸出幾多 × 立繪高度）
  let x = screenX(view, spot.lane, spot.d);
  const reach = member.index === 0 ? member.char.battle.reach : undefined;
  if (reach) x = Math.max(reach[0] * h, Math.min(view.W - reach[1] * h, x));
  return {
    x,
    ground: screenY(view, spot.d),
    h,
    k: h / (view.H * 0.4),
    lane: spot.lane, d: spot.d, lunge: spot.lunge,
    air, lift: air * TUNING.flight.liftHeight * h,
  };
}
