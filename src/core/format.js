// 數字顯示：全遊戲統一用呢個（戰力牌、磚、門、路障、首領、飄字、結算）。純函式。
//
// 規則：
//   0–999      照寫（整數）
//   1,000 起   三位有效數字加單位：1.23K、12.3K、123K、1.23M、12.3M、123M、1.23B …
//   單位       K（千）、M（百萬）、B（十億）、T（萬億），之後 aa、ab、ac … az、ba …
//   永遠係三個數字：1.20K 唔會寫成 1.2K，所以數字跳動嗰陣闊度唔會亂晃
//   向下取（唔四捨五入）：1,999 寫 1.99K，唔會寫到比實際多

const UNITS = ['', 'K', 'M', 'B', 'T'];

/** 第 i 級（每級 ×1000）嘅單位：0 冇、1 K、2 M、3 B、4 T、5 aa、6 ab … */
export function unitName(i) {
  if (i < UNITS.length) return UNITS[i];
  const k = i - UNITS.length;
  return String.fromCharCode(97 + Math.floor(k / 26) % 26) + String.fromCharCode(97 + k % 26);
}

/**
 * @param {number} n
 * @returns {string}
 */
export function formatNumber(n) {
  if (!Number.isFinite(n)) return String(n);
  if (n < 0) return `−${formatNumber(-n)}`;
  if (n < 1000) return String(Math.floor(n));
  let tier = Math.floor(Math.log10(n) / 3), v = n / 1000 ** tier;
  if (v >= 1000) { tier++; v /= 1000; } else if (v < 1) { tier--; v *= 1000; } // 小數誤差：log10(1e6) 可以計到 5.999…
  const digits = v < 10 ? 2 : v < 100 ? 1 : 0, k = 10 ** digits;
  return (Math.floor(v * k + 1e-7) / k).toFixed(digits) + unitName(tier);
}
