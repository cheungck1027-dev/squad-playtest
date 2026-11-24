// 輸入：將指標同鍵盤事件變成簡單回呼。座標一律係 0–1（相對畫布），
// 呢度唔知咩係「車道」或者「技能」，嗰啲由各個畫面自己嘅 controls 決定。

/**
 * @typedef {Object} InputHandlers
 * @property {(nx: number, ny: number) => void} [onPress]  撳落去
 * @property {(nx: number, ny: number) => void} [onDrag]   撳住拖
 * @property {(key: string) => void} [onKey]
 * @property {(key: string) => void} [onKeyUp]
 */

/**
 * @param {HTMLElement} target
 * @param {InputHandlers} handlers
 * @returns {() => void} 解除監聽
 */
export function attachInput(target, handlers) {
  const norm = (e) => {
    const r = target.getBoundingClientRect();
    return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height];
  };
  const down = (e) => { const [x, y] = norm(e); handlers.onPress?.(x, y); };
  const move = (e) => {
    if (!(e.buttons || e.pointerType === 'touch')) return;
    const [x, y] = norm(e);
    handlers.onDrag?.(x, y);
  };
  const key = (e) => handlers.onKey?.(e.key);
  const keyUp = (e) => handlers.onKeyUp?.(e.key);

  target.addEventListener('pointerdown', down);
  target.addEventListener('pointermove', move);
  globalThis.addEventListener('keydown', key);
  globalThis.addEventListener('keyup', keyUp);
  return () => {
    target.removeEventListener('pointerdown', down);
    target.removeEventListener('pointermove', move);
    globalThis.removeEventListener('keydown', key);
    globalThis.removeEventListener('keyup', keyUp);
  };
}
