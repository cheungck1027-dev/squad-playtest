// 形態嘅跑步片「有檔就用片，冇檔就用靜態主圖」：開場試攞每個形態嘅 motion.json 同片，兩個都喺度先換成用片。
// 冇 build、冇檔案清單，所以只可以試攞；未交嘅形態主控台會各有一行 404，正常。

import { UNIT_SPRITE, applyDefaultMotion, applyUnitMotion, unitDefaultMotionSource, unitRunSource } from '../data/assets.js';

/**
 * @param {(url: string, init?: any) => Promise<{ ok: boolean, json: () => Promise<any> }>} [fetchFn]
 * @returns {Promise<number[]>}  換咗用片嘅形態（0 = 形態 I）
 */
export async function probeFormClips(fetchFn = globalThis.fetch) {
  const jobs = UNIT_SPRITE.forms.map(async (_, form) => {
    const src = unitRunSource(form);
    if (!src || !fetchFn) return -1;
    try {
      const res = await fetchFn(src.motion);
      if (!res.ok) return -1;
      const motion = await res.json();
      const clip = await fetchFn(src.file, { method: 'HEAD' });
      return clip.ok && applyUnitMotion(form, motion) ? form : -1;
    } catch {
      return -1; // 攞唔到或者資料壞咗：照用靜態主圖
    }
  });
  const base = probeDefaultMotion(fetchFn);
  const forms = (await Promise.all(jobs)).filter((f) => f >= 0);
  await base;
  return forms;
}

/**
 * 形態 I 嘅片寫死喺設定，但逐格資料都由檔案讀（美術用同檔名換新版本唔使改程式）；讀唔到就用設定入面抄落嚟嗰份。
 * 最舊嗰個三車道版嘅隊長用同一條片，所以佢開場都叫呢個。
 * @returns {Promise<boolean>}  有冇用檔案嗰份
 */
export async function probeDefaultMotion(fetchFn = globalThis.fetch) {
  const url = unitDefaultMotionSource();
  if (!url || !fetchFn) return false;
  try { const res = await fetchFn(url); return res.ok && applyDefaultMotion(await res.json()); } catch { return false; }
}
