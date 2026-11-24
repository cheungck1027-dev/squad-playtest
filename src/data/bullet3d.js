// 3D 戰鬥畫面入面子彈嘅外觀（純畫面）。幾多粒、喺邊個橫向位置、飛幾快、打唔打中，全部係規則（data/column.js 嘅 fire、column/rules.js 嘅 salvoLayout）；
// 呢度只決定「畫成點」。子彈嘅橫向位置就係命中判定嘅位置，所以隊形唔可以喺畫面度改——層次靠外形、大細、光暗、尾跡同節奏。
//
// 每個形態一款彈種（forms 第 0 格 = 形態 I）：
//   shape   'tracer' 短曳光彈、'orb' 光球拖短尾、'lance' 細長光矛、'blade' 橫向弧形光刃
//   core    彈芯顏色 'r,g,b'；glow = 外面光暈、槍口閃光、命中火花嘅顏色；mix = 彈芯撈幾多光暈色（0 = 純彈芯色，越大越似光暈色）
//   len     前後幾長（世界單位）；width = 幾闊（光刃係橫向闊度；方陣同齊射嘅橫向間距係 0.075）
//   flat    高度係闊度嘅幾多（1 = 圓；光刃係扁嘅）
//   halo    光暈比彈芯闊幾多倍；haloLen = 光暈比彈芯長幾多倍
//   swing   左右交替出膛：每一輪由管口嘅左邊或者右邊出（× 主角身高），飛出去之後返入自己條彈道（0 = 唔交替）
//   ring    打中小敵人嗰刻多畫一個環形閃光（光矛「穿過」嘅感覺；只係畫面，子彈照樣打中就消失）
//
// 節奏同層次：
//   beat        每幾輪齊射有一輪「重拍」：嗰輪子彈粗啲、長啲、白啲，槍口閃光同後座大啲（傷害一樣）
//   rows        齊射多過一排（規則：每排最多 8 粒，戰力越高排數越多，最多 5 排）時，每多一排成輪粗幾多、光暈大幾多；
//               同一輪入面，後排比前排細幾多（前排最搶眼）
//   jitter      每粒之間嘅輕微隨機差異：長短（比例）、光暗（比例）、左右（世界單位，約一兩個像素）

export const BULLET_3D = {
  beat: { every: 4, width: 1.4, len: 1.3, white: 0.5, flash: 1.5, recoil: 1.7 },
  rows: { width: 0.07, halo: 0.12, backRow: 0.07 },
  jitter: { len: 0.2, bright: 0.22, x: 0.006 },
  forms: [
    { shape: 'tracer', core: '255,236,190', glow: '255,138,44', mix: 0.55, len: 0.17, width: 0.024, flat: 1, halo: 2.6, haloLen: 1.25, swing: 0, ring: false },
    { shape: 'orb', core: '225,255,248', glow: '36,226,190', mix: 0.5, len: 0.2, width: 0.05, flat: 1, halo: 1.7, haloLen: 1.05, swing: 0.05, ring: false },
    { shape: 'lance', core: '246,232,255', glow: '178,104,255', mix: 0.35, len: 0.6, width: 0.03, flat: 1, halo: 2.2, haloLen: 1.05, swing: 0, ring: true },
    { shape: 'blade', core: '255,252,238', glow: '255,204,98', mix: 0.3, len: 0.075, width: 0.12, flat: 0.3, halo: 1.25, haloLen: 2.2, swing: 0, ring: false },
  ],
};

/** 呢個形態用邊款彈種（形態多過表入面嘅就用最後一款）。 */
export const bullet3d = (form) => BULLET_3D.forms[Math.max(0, Math.min(form, BULLET_3D.forms.length - 1))];
