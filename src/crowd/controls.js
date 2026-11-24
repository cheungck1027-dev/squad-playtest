// 俯視玩法嘅操作：手指 / 滑鼠撳住左右拖，隊伍跟住；鍵盤左右鍵都得。冇車道。

import { attachInput } from '../core/input.js';
import { CROWD } from '../data/crowd.js';
import { setKeyDir, setTarget } from './battle.js';
import { worldX } from './view.js';

/**
 * @param {HTMLElement} canvas
 * @param {() => import('./battle.js').CrowdState} getState
 * @param {(nx: number) => number} [toWorldX]  畫面橫向位置（0–1）→ 世界 x；唔填就用頂視鏡頭嗰套
 * @returns {() => void} 解除監聽
 */
export function attachCrowdControls(canvas, getState, toWorldX = worldX) {
  let last = 0;
  const held = new Set();
  const keys = () => setKeyDir(getState(), (held.has('ArrowRight') ? 1 : 0) - (held.has('ArrowLeft') ? 1 : 0));
  const move = (nx, pressed) => {
    const s = getState();
    if (CROWD.control.mode === 'drag') { if (!pressed) setTarget(s, s.targetX + toWorldX(nx) - toWorldX(last)); }
    else setTarget(s, toWorldX(nx));
    last = nx;
  };
  return attachInput(canvas, {
    onPress: (nx) => move(nx, true),
    onDrag: (nx) => move(nx, false),
    onKey(key) { if (key === 'ArrowLeft' || key === 'ArrowRight') { held.add(key); keys(); } },
    onKeyUp(key) { if (held.delete(key)) keys(); },
  });
}
