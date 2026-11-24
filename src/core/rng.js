// 有種子嘅亂數。同一粒種子一定出同一串數，關卡同戰鬥先可以重播、測試。
// 遊戲邏輯唔好用 Math.random()。

/**
 * @typedef {Object} Rng
 * @property {() => number} next            [0, 1)
 * @property {(a: number, b: number) => number} range   [a, b)
 * @property {(a: number, b: number) => number} int     整數，a 至 b（包頭包尾）
 * @property {(p: number) => boolean} chance
 * @property {<T>(list: readonly T[]) => T} pick
 * @property {<T>(list: readonly T[]) => T[]} shuffle   回傳新陣列
 * @property {<T extends {weight: number}>(table: readonly T[]) => T} weighted
 * @property {(label: number | string) => Rng} fork     分一條獨立嘅亂數流出嚟
 */

/** 將數字或者字串變成 32 位元種子。 */
export function hashSeed(value) {
  const s = String(value);
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * @param {number | string} seed
 * @returns {Rng}
 */
export function createRng(seed) {
  let a = (typeof seed === 'number' ? seed : hashSeed(seed)) >>> 0;
  const origin = a;

  // mulberry32
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const range = (lo, hi) => lo + next() * (hi - lo);
  const shuffle = (list) => {
    const out = list.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(next() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  };

  return {
    next,
    range,
    int: (lo, hi) => Math.floor(range(lo, hi + 1)),
    chance: (p) => next() < p,
    pick: (list) => list[Math.floor(next() * list.length)],
    shuffle,
    weighted: (table) => {
      let total = 0;
      for (const row of table) total += row.weight;
      let roll = next() * total;
      for (const row of table) {
        roll -= row.weight;
        if (roll < 0) return row;
      }
      return table[table.length - 1];
    },
    fork: (label) => createRng(hashSeed(origin + ':' + label)),
  };
}
