// 戰鬥操作：將輸入（0–1 座標、按鍵）變成戰鬥動作。單手玩：
//   - 撳或者拖畫面左 / 中 / 右 → 轉車道
//   - 撳畫面最底一成（SYNC 計量條）→ 發動 OVERDRIVE
//   - 鍵盤：← → 轉車道，空白鍵發動 OVERDRIVE

import { attachInput } from '../core/input.js';
import { setLane, shiftLane, triggerOverdrive } from './update.js';

const laneAt = (nx) => (nx < 0.36 ? -1 : nx > 0.64 ? 1 : 0);

/**
 * @param {HTMLElement} canvas
 * @param {() => import('./state.js').BattleState} getState  每次輸入先攞而家嘅戰鬥狀態
 * @returns {() => void} 解除監聽
 */
export function attachBattleControls(canvas, getState) {
  return attachInput(canvas, {
    onPress(nx, ny) {
      if (ny > 0.9) triggerOverdrive(getState());
      else setLane(getState(), laneAt(nx));
    },
    onDrag(nx) {
      setLane(getState(), laneAt(nx));
    },
    onKey(key) {
      if (key === 'ArrowLeft') shiftLane(getState(), -1);
      else if (key === 'ArrowRight') shiftLane(getState(), 1);
      else if (key === ' ') triggerOverdrive(getState());
    },
  });
}
