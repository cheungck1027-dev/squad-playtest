// 角色而家應該播邊個動作。純運算：只睇戰鬥狀態，唔掂影片。
//
// 一個角色可以有多條動作片（data/characters.js 嘅 assets.actions：動作名 → 片段 key）。
// 呢度按優先次序列出「而家想播嘅動作」；畫面由頭試到尾，第一條有片、播得到嘅就用。
// 一條都冇（或者角色根本冇填 actions）就用返 assets.clip 嗰條預設片，再冇就用靜態圖。
//
// 動作名：
//   clear           打低首領過關（一次過）
//   hit             俾敵人撞到（一次過）
//   overdriveStart  發動 OVERDRIVE 嘅起手（一次過）
//   laneLeft / laneRight  轉車道（一次過）
//   gate            穿過門（一次過）
//   overdriveShoot  OVERDRIVE 期間出手（循環）
//   shoot           平時出手（循環）
//   idle            向前滑行待機（循環）

import { TEXT } from '../data/text.js';

/** 一次過嘅動作（每次開始都由頭播）；其餘係循環。 */
export const ONE_SHOT_ACTIONS = new Set(['clear', 'hit', 'overdriveStart', 'laneLeft', 'laneRight', 'gate']);

const T = {
  hit: 0.45,            // 受擊動作維持幾耐（秒）
  overdriveStart: 1,    // OVERDRIVE 起手
  lane: 0.12,           // 橫向位置同目標車道差幾多先算「轉緊車道」
  acting: 0.3,          // 出手之後幾耐內都當係出手緊
};

/**
 * @param {import('./state.js').BattleState} state
 * @param {import('./state.js').SquadMember} member
 * @returns {string[]} 想播嘅動作，優先嘅排先；最後一定係 'idle'
 */
export function wantedActions(state, member) {
  const out = [];
  const over = state.over > 0;
  if (state.banner.t > 0 && state.banner.text === TEXT.banner.stageClear) out.push('clear');
  if (state.hurt > 0) out.push('hit');
  if (over && state.overMax - state.over < T.overdriveStart) out.push('overdriveStart');
  const dx = state.lane - member.x;
  if (dx < -T.lane) out.push('laneLeft'); else if (dx > T.lane) out.push('laneRight');
  if (state.flash > 0) out.push('gate');
  if (member.sinceAct < T.acting) { if (over) out.push('overdriveShoot'); out.push('shoot'); }
  out.push('idle');
  return out;
}

/** 受擊動作維持幾耐（update.js 用嚟設定 state.hurt）。 */
export const HIT_ACTION_TIME = T.hit;

// ---------- 地面跑 / 飛行（角色資料有 assets.motion 嘅角色） ----------

/** 揀片用嘅時間（秒）。 */
export const MOTION = {
  fireHold: 0.6,                 // 出手之後幾耐內都播連射片（唔好一停火就即刻切走，免得不停切嚟切去）
  overdriveClip: (129 - 34) / 30, // 超載片由開始到返到巡航姿勢幾耐
  landAt: 0.35,                  // 落地：離地程度跌到呢個數先換返跑步片（唔好喺半空就開始跑）
  fade: 0.18,                    // 兩條片之間交疊淡入淡出幾耐
};

/**
 * 而家應該播 motion 入面邊條片。純運算。
 *   地面                         → run
 *   空中、超載啱啱發動           → overdrive（播一次，播完接返下面）
 *   空中、啱啱開過火             → fire
 *   空中、冇嘢打                 → glide
 * @param {import('./state.js').BattleState} state
 * @param {import('./state.js').SquadMember} member
 * @returns {'run' | 'glide' | 'fire' | 'overdrive'}
 */
export function motionClip(state, member) {
  const F = state.flight;
  if (!(F.on || F.air > MOTION.landAt)) return 'run';
  if (state.over > 0 && state.overMax - state.over < MOTION.overdriveClip) return 'overdrive';
  return member.sinceAct < MOTION.fireHold ? 'fire' : 'glide';
}
