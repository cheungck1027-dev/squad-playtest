// 遊戲迴圈：邏輯用固定步長更新，畫面跟瀏覽器嘅重繪節奏。
// 固定步長令同一串輸入一定得出同一個結果，唔受手機快慢影響。

/**
 * @param {Object} opts
 * @param {(dt: number) => void} opts.update   每個固定步長叫一次
 * @param {() => void} opts.draw               每次重繪叫一次
 * @param {number} [opts.step]                 步長（秒）
 * @param {number} [opts.maxFrame]             一格最多補幾耐（秒），避免返嚟分頁嗰陣暴走
 */
export function createLoop({ update, draw, step = 1 / 60, maxFrame = 0.1 }) {
  const raf = globalThis.requestAnimationFrame;
  const caf = globalThis.cancelAnimationFrame;
  // 容許少少時間誤差，60Hz 螢幕就可以穩定每格更新一次，唔會一格零次、一格兩次咁震。
  const slack = step * 0.25;
  let acc = 0, last = 0, handle = 0, running = false, steps = 0;

  function frame(ts) {
    if (!running) return;
    const elapsed = last ? Math.min(maxFrame, Math.max(0, (ts - last) / 1000)) : 0;
    last = ts;
    acc += elapsed;
    while (acc >= step - slack) {
      update(step);
      steps++;
      acc -= step;
    }
    draw();
    handle = raf(frame);
  }

  return {
    step,
    start() {
      if (running) return;
      running = true; last = 0; acc = 0;
      handle = raf(frame);
    },
    stop() {
      running = false;
      if (handle) caf(handle);
      handle = 0;
    },
    get running() { return running; },
    get steps() { return steps; },
    /** 手動行 n 步再畫一次。分頁隱藏咗、瀏覽器唔重繪嗰陣都用得。 */
    advance(n = 1) {
      for (let i = 0; i < n; i++) { update(step); steps++; }
      draw();
    },
  };
}
