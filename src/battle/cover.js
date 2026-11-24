// 遮擋：邊個隊員擋住咗後面（遠啲）嘅門或者敵人。純運算，唔掂畫布。
// 鏡頭喺小隊後上方，企得近鏡頭嘅隊員會遮住佢身後行埋嚟嘅嘢。陣形已經盡量避開（全隊企喺隊長身後），
// 呢度係最後一重保險：擋住嘢嘅隊員變半透明，被擋嘅門數字同敵人血量再畫一次喺最面。
// 隊長唔計（佢企喺自己條車道正中，門同敵人本來就係衝住佢嚟）；首領太大，亦唔計。

import { roadHalfWidth, scaleAt, screenX, screenY } from './projection.js';

/** 擋住嘢嗰陣，隊員淡到幾多 */
export const COVER_ALPHA = 0.4;

/**
 * 門嘅畫面形狀（render.js 畫門都用呢個）。
 * @returns {{ x: number, y: number, s: number, laneW: number, hw: number, h: number }}
 */
export function gateShape(view, e) {
  const s = scaleAt(e.d), laneW = roadHalfWidth(view) * (2 / 3) * s;
  return { x: screenX(view, e.lane, e.d), y: screenY(view, e.d), s, laneW, hw: laneW * 0.46, h: laneW * 0.66 };
}

/**
 * 門或者敵人要睇得清楚嘅範圍（門：成個門框；敵人：由血量牌到腳）。投射物同首領回傳 null。
 * @returns {{ x0: number, x1: number, y0: number, y1: number } | null}
 */
export function entityBox(view, e) {
  if (e.type === 'gate') {
    const g = gateShape(view, e);
    return { x0: g.x - g.hw, x1: g.x + g.hw, y0: g.y - g.h, y1: g.y };
  }
  if (e.type !== 'enemy' || e.boss) return null;
  const L = e.def.look, size = L.size * scaleAt(e.d) * view.u;
  const x = screenX(view, e.lane, e.d), y = screenY(view, e.d);
  const top = L.tagHeight !== undefined ? size * (L.tagHeight + 0.12) : size * (L.lift + 0.8);
  return { x0: x - size * 0.36, x1: x + size * 0.36, y0: y - top, y1: y };
}

/** 隊員身體大約佔嘅範圍（立繪兩邊同頭頂有留白，所以窄過成張圖）。 */
export function memberBox(pose) {
  return { x0: pose.x - pose.h * 0.2, x1: pose.x + pose.h * 0.2, y0: pose.ground - pose.h * 0.95, y1: pose.ground };
}

const overlap = (a, b) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

/**
 * @param {import('./projection.js').View} view
 * @param {{ member: import('./state.js').SquadMember, pose: import('./formation.js').MemberPose }[]} posed
 * @param {object[]} ents
 * @returns {{ members: Set<object>, ents: Set<object> }}  擋住嘢嘅隊員、被擋住嘅門同敵人
 */
export function findCover(view, posed, ents) {
  const members = new Set(), covered = new Set();
  for (const e of ents) {
    const box = entityBox(view, e);
    if (!box) continue;
    for (const { member, pose } of posed) {
      if (member.index === 0 || pose.d >= e.d) continue; // 隊長唔計；企得遠過件嘢就擋唔到佢
      if (!overlap(box, memberBox(pose))) continue;
      covered.add(e);
      if (pose.lunge <= 0) members.add(member); // 衝緊去出招嘅唔淡化，保持招式睇得清楚
    }
  }
  return { members, ents: covered };
}
