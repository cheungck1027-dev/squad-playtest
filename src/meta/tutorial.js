// 首次遊玩嘅分步引導（041 第二部分）：純邏輯，唔掂畫面。每格喺規則行完之後叫一次 tick()，佢睇戰鬥狀態決定：
// 而家出邊一步、世界停唔停（state.freeze）、指住邊度（target），玩家做到就去下一步。畫面嗰邊照回傳嘅嘢畫提示（meta/ui.js 嘅 coach）。
//
// 做法：一步出現嗰刻世界停低（敵人、磚、門、子彈全部唔郁，淨係隊長照樣跟手指左右移），等玩家做到指定動作先繼續——
// 所以唔會因為睇字而食虧，亦唔使喺限時之內做到。

import { gateSegment, isGoodGate } from '../crowd/rules.js';
import { TUTORIAL, TUTORIAL_BURST } from '../data/story.js';

const MIN_SHOW = 0.9;   // 每一步最少出現幾耐（秒）：費事玩家本身已經企啱位，啲字一閃就冇咗
const ALIGN = 0.14;     // 離目標條線幾近先算「行到」
const lane = (e) => e.x;

/**
 * @param {{ stage?: boolean, burst?: boolean }} [o]  stage = 教第 1 關嗰幾步；burst = 第一次爆發槽滿教撳頭像
 */
export function createTutorial(o = {}) {
  const T = { i: o.stage === false ? TUTORIAL.length : 0, burst: o.burst !== false, active: null, shown: [], t: 0, x0: 0, travel: 0, lastX: null, since: 99, skipped: false };
  const begin = (s, step, target) => { T.active = { ...step, target }; T.t = 0; T.x0 = s.x; T.travel = 0; T.shown.push(step.id); if (step.id !== 'boss') s.freeze = true; };
  const end = (s) => { s.freeze = false; if (T.active?.id === 'burst') T.burst = false; else T.i++; T.active = null; T.since = 0; };
  const find = (s, ok) => { let best = null; for (const e of s.ents) if (ok(e) && (!best || e.d < best.d)) best = e; return best; };
  const goodGate = (row, x) => { const n = row.gates.length; let best = null; for (let i = 0; i < n; i++) { if (!isGoodGate(row.gates[i])) continue; const [a, b] = gateSegment(n, i), mid = (a + b) / 2; if (!best || Math.abs(mid - x) < Math.abs(best - x)) best = mid; } return best; };

  /**
   * @param {any} s 戰鬥狀態  @param {number} dt 真實過咗幾耐（秒）
   * @returns {{ id: string, text: string, finger: string, target: { x: number, d: number } | null, step: number, total: number } | null} 而家要出嘅提示（冇就 null）
   */
  function tick(s, dt) {
    if (T.skipped || !(s.phase === 'run' || s.phase === 'boss')) { if (s.freeze) s.freeze = false; T.active = null; return null; }
    if (T.lastX !== null) T.travel += Math.abs(s.x - T.lastX);
    T.lastX = s.x; T.t += dt; T.since += dt;
    const ev = (type) => s.events.some((e) => e.type === type), A = T.active;
    if (A) {
      const near = A.target ? Math.abs(s.x - A.target.x) < ALIGN : true;
      let done = false;
      if (A.id === 'move') done = T.travel >= 0.35;
      else if (A.id === 'boss') done = T.t >= 3.2;
      else if (A.id === 'burst') done = s.burst.cut > 0 || s.burst.t > 0 || s.burst.charge < 1;
      else done = near;
      if (done && (T.t >= MIN_SHOW || A.id === 'burst')) end(s);
      else return view();
    }
    // 第一次爆發槽滿：教撳頭像（任何一關都會教，教一次）
    if (T.burst && s.burst && s.burst.charge >= 1 && s.burst.t <= 0 && s.burst.cut <= 0 && T.since > 0.3) { begin(s, TUTORIAL_BURST, null); return view(); }
    if (T.i >= TUTORIAL.length) return null;
    // 去到首領都未教完前面幾步（例如玩家一路避開）：直接跳去首領嗰步
    const bossAt = TUTORIAL.findIndex((x) => x.id === 'boss');
    if (ev('bossIn') || (s.phase === 'boss' && T.i < bossAt)) { T.i = bossAt; begin(s, TUTORIAL[bossAt], null); return view(); }
    const step = TUTORIAL[T.i];
    if (step.id === 'move') { if (s.t >= 0.8) begin(s, step, null); }
    else if (step.id === 'brick') { const e = find(s, (x) => x.type === 'bricks' && !x.prize && x.d > 0.8 && x.d < 5); if (e) begin(s, step, { x: lane(e), d: Math.max(e.d, 1.2) }); }
    else if (step.id === 'wall') { const e = find(s, (x) => x.type === 'barrier' && !x.dead && x.d > 2 && x.d < 14); if (e && T.since >= 1.4) begin(s, step, { x: lane(e), d: e.d }); }
    else if (step.id === 'shoot') { const e = find(s, (x) => x.type === 'gates' && !x.used && x.d > 2.5 && x.d < 7 && goodGate(x, s.x) !== null); if (e) begin(s, step, { x: goodGate(e, s.x), d: e.d }); }
    else if (step.id === 'gate') { const e = find(s, (x) => x.type === 'gates' && !x.used && x.d > 0.3 && x.d < 1.7 && goodGate(x, s.x) !== null); if (e) begin(s, step, { x: goodGate(e, s.x), d: e.d }); }
    return T.active ? view() : null;
  }
  const view = () => { const A = T.active, k = TUTORIAL.findIndex((x) => x.id === A.id); return { id: A.id, text: A.text, finger: A.finger, target: A.target, step: k < 0 ? 0 : k + 1, total: TUTORIAL.length }; };
  /** 跳過：之後唔再出（爆發嗰步都唔教）。 */
  function skip(s) { T.skipped = true; T.active = null; if (s) s.freeze = false; }
  return { tick, skip, get done() { return T.skipped || (T.i >= TUTORIAL.length && !T.active); }, get stageDone() { return T.skipped || T.i >= TUTORIAL.length; }, get burstDone() { return T.skipped || !T.burst; }, get shown() { return T.shown; }, get active() { return T.active; } };
}
