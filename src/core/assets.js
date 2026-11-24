// 素材載入。每個素材有一串候選網址，由頭試到尾；全部失敗就標記為未載入，
// 由繪畫程式自己用程式畫代替。載入期間遊戲照行，唔會等。

/**
 * @typedef {Object} AssetRecord
 * @property {HTMLImageElement | null} img
 * @property {boolean} ok        已經載入成功
 * @property {string} src        而家用緊（或者試緊）嘅網址
 * @property {boolean} settled   已經有結果（成功或者全部失敗）
 */

/**
 * @typedef {Object} AssetStore
 * @property {(key: string) => AssetRecord} get   未登記嘅 key 會得到一個「未載入」紀錄，唔會出錯
 * @property {() => Record<string, string>} report  每個 key 而家用緊邊個檔，冇就係 'fallback'
 * @property {() => Promise<void>} ready  全部有結果先完成（遊戲唔使等，測試同除錯用）
 */

/** @type {AssetRecord} */
const MISSING = Object.freeze({ img: null, ok: false, src: '', settled: true });

/**
 * @param {Record<string, string[]>} manifest  key → 候選網址（順序試）
 * @returns {AssetStore}
 */
export function loadAssets(manifest) {
  /** @type {Record<string, AssetRecord>} */
  const records = {};
  const pending = [];

  for (const [key, urls] of Object.entries(manifest)) {
    const rec = { img: new Image(), ok: false, src: '', settled: false };
    records[key] = rec;
    pending.push(new Promise((resolve) => {
      let i = 0;
      const tryNext = () => {
        if (i >= urls.length) { rec.settled = true; resolve(); return; }
        rec.src = urls[i++];
        rec.img.src = rec.src;
      };
      rec.img.onload = () => { rec.ok = true; rec.settled = true; resolve(); };
      rec.img.onerror = tryNext;
      tryNext();
    }));
  }

  return {
    get: (key) => records[key] || MISSING,
    report: () => Object.fromEntries(Object.entries(records).map(([k, r]) => [k, r.ok ? r.src : 'fallback'])),
    ready: () => Promise.all(pending).then(() => undefined),
  };
}
