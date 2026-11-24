// 動畫片段嘅「待機 / 出招」時間控制。純運算，唔掂影片，可以喺 Node 測試。
//
// 每條片嘅結構都係：開頭待機 → 一次出招 → 收招 → 返回待機（片尾同片頭駁得返）。
// 片段資料用 attack = { start, strike, end } 標記出招嗰段（秒）：
//   start  = 待機完、開始郁嘅時間
//   strike = 出招嗰一格（刀光、撞擊、開火）
//   end    = 收招完、返到待機姿勢嘅時間
//   lead   = （可以唔填）呢條片出招時跳去 strike 之前幾耐；唔填用全局設定
//   skip   = （可以唔填）出招期間要跳過嘅時間段。片入面有啲光效鋪滿成個畫面，去唔到背，
//            播出嚟會係一嚿實色方塊，所以直接跳過；嗰一刻嘅光效由遊戲自己畫。
// 平時（idle）只播待機部分：由 end 播到片尾、循環返片頭、播到 start，再跳返 end。
// 遊戲入面真係出招嗰刻（attack）先跳去 strike 前少少，等畫面上嘅動作同傷害對得上。

/**
 * @typedef {{ start: number, strike: number, end: number, lead?: number, skip?: [number, number][] }} ClipAttack
 * @typedef {'idle' | 'attack'} ClipMode
 */

/**
 * 每格叫一次：睇而家播到邊，決定使唔使跳。
 * @param {ClipMode} mode
 * @param {number} t          影片而家嘅時間（秒）
 * @param {ClipAttack} attack
 * @returns {{ mode: ClipMode, seekTo: number | null }}
 */
export function stepClip(mode, t, attack) {
  const inside = t > attack.start && t < attack.end;
  if (mode === 'attack') {
    if (!inside) return { mode: 'idle', seekTo: null }; // 出招播完，自然接返待機
    for (const [from, to] of attack.skip ?? []) if (t >= from && t < to) return { mode: 'attack', seekTo: to };
    return { mode: 'attack', seekTo: null };
  }
  return { mode: 'idle', seekTo: inside ? attack.end : null };                      // 待機時唔好播到出招嗰段
}

/**
 * 遊戲入面出招嗰刻叫：決定跳去邊。
 * 已經喺出招、而且未到 strike（上一次啱啱跳完）就唔再跳，免得連續出招時片段不停原地彈。
 * @param {ClipMode} mode
 * @param {number} t
 * @param {ClipAttack} attack
 * @param {number} lead  跳去 strike 之前幾耐（秒），留少少起手動作
 * @returns {{ mode: ClipMode, seekTo: number | null }}
 */
export function triggerClip(mode, t, attack, lead) {
  const from = Math.max(attack.start, attack.strike - (attack.lead ?? lead));
  if (mode === 'attack' && t >= from - 0.02 && t < attack.strike) return { mode: 'attack', seekTo: null };
  return { mode: 'attack', seekTo: from };
}
