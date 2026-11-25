// 3D 戰鬥畫面主角嘅設定：每個形態用邊個模型、邊段動作、手上個裝置點砌。換模型只改呢個檔。
// 模型檔放 game/assets/models/（由 art/model/ 抄入嚟）。
//
// 每個形態一格（null = 模型未到：用返形態 I 嗰格，只係腳下光環顏色唔同）：
//   model    模型檔名
//   run      跑步動作嘅名（下半身同脊椎用呢段；模型自己冇就向 animFrom 借）
//   arms     雙臂（連手指）嘅姿勢由邊段動作、第幾秒抄過嚟固定住（null = 成個人都用 run）。clip 係動作名嘅開頭。
//   animFrom arms 嗰段動作喺邊個模型檔度（骨頭要同名；按兩邊嘅企定姿勢換算）。null = 喺自己個檔
//   device   手上個裝置（null = 空手）
//   aura     腳下光環顏色 'r,g,b'（null = 跟 data/crowd.js 嗰個形態嘅主題色；形態 I 冇主題色即係冇光環）
//
// 裝置嘅數（長度單位 = 人物身高）。裝置擺喺身體右前方一個固定位，兩隻手伸過去揸住（膊頭同手踭逐格計）：
//   shape    外形：'rifle' 方身長管、'cannon' 粗圓筒、'lance' 幼長槍、'staff' 幼杖加球頭
//   length   由尾到管口幾長
//   grip     右手揸喺由尾數起幾多（0 = 尾，1 = 管口）
//   left     左手托喺由尾數起幾多
//   hold     右手揸嗰點喺邊：由上胸骨（膊頭中間對落少少）起計 [向人物右邊, 向上, 向前]
//   pitch    管口向上抬幾多度（0 = 水平指正前方）
//   radius   [右手, 左手] 手揸嗰個位機身幾粗（半徑）：手心貼喺機身表面
//   around   手心喺機身下面偏外側幾多度（0 = 正下面托住；右手向右偏、左手向左偏）
//   wrap     手指橫跨機身嘅程度（0 = 手指順住前臂方向，1 = 手指打橫箍住機身）
//   curl     手指三節各屈幾多度（幼桿屈多啲、粗筒屈少啲）；拇指跟住屈一半
//   body / barrel / mark  主色、副色、發光色

const HOLD = { grip: 0.2, left: 0.44, hold: [0.15, 0.02, 0.09], pitch: 6, radius: [0.022, 0.022], around: 25, wrap: 0.55, curl: [60, 60, 40] };

const DEVICES = {
  rifle: { shape: 'rifle', length: 0.56, ...HOLD, radius: [0.024, 0.024], body: 0x7b8499, barrel: 0x565d70, mark: 0x6ff2e6 },
  cannon: { shape: 'cannon', length: 0.56, ...HOLD, left: 0.44, radius: [0.03, 0.034], curl: [35, 45, 30], body: 0x5fa894, barrel: 0x3a3d47, mark: 0x3ff5dc },
  lance: { shape: 'lance', length: 0.74, ...HOLD, grip: 0.22, left: 0.41, radius: [0.018, 0.018], curl: [80, 75, 50], body: 0xa46bff, barrel: 0xcfc6e6, mark: 0xb98cff },
  staff: { shape: 'staff', length: 0.78, ...HOLD, grip: 0.24, left: 0.42, radius: [0.016, 0.016], curl: [80, 75, 50], body: 0xf1ebe6, barrel: 0xe0a93a, mark: 0xffb23a },
};

const F1 = 'falcon-b-f1.glb';
const ARMS = { clip: 'Running forward', at: 3.0 };

export const LEAD_3D = {
  forms: [
    { model: 'leader-v2.glb', run: 'run', arms: ARMS, animFrom: F1, device: DEVICES.rifle, aura: null }, // 新造型（043）；雙臂姿勢照舊借舊形態 I 嗰條動作
    { model: 'falcon-b-f2.glb', run: 'run', arms: ARMS, animFrom: F1, device: DEVICES.cannon, aura: null },
    { model: 'falcon-b-f3.glb', run: 'run', arms: ARMS, animFrom: F1, device: DEVICES.lance, aura: null },
    { model: 'falcon-b-f4.glb', run: 'run', arms: ARMS, animFrom: F1, device: DEVICES.staff, aura: null },
  ],
};

/**
 * 呢個形態用邊份設定：未有自己模型嘅形態用返形態 I 嗰份。
 * @param {number} form 0 起計
 * @returns {{ model: string, run: string, arms: { clip: string, at: number } | null, animFrom: string | null, device: typeof DEVICES.rifle | null, aura: string | null, own: boolean }}
 */
export function lead3d(form) {
  const forms = LEAD_3D.forms, own = forms[Math.max(0, Math.min(form, forms.length - 1))];
  return { animFrom: null, arms: null, device: null, aura: null, ...(own ?? forms[0]), own: !!own };
}

/** 用到嘅模型檔（唔重複）。 */
export const lead3dModels = () => [...new Set(LEAD_3D.forms.filter(Boolean).flatMap((f) => [f.model, f.animFrom]).filter(Boolean))];

/** 呢條動作軌係咪屬於雙臂（肩、上臂、前臂、手、手指）。軌名係「骨頭名.屬性」，例如 mixamorigLeftForeArm.quaternion。 */
export const isArmTrack = (name) => /(Left|Right)(Shoulder|Arm|ForeArm|Hand)/.test(name);


/**
 * 隊員嘅 3D 設定（040）。同主角同一套欄位（model、run、arms、animFrom），另外：
 *   devices  手上嘅嘢，可以多過一件。每件多一個 hands：邊隻手揸（'r' 右、'l' 左；兩隻都寫 = 雙手揸）。單手揸嘅嘢 hold[0] 負數 = 喺人物左邊
 *   swing    揮刀：出刀氣嗰下，件嘢嘅 pitch 由 from 度揮到 to 度（time 秒），之後慢慢返位
 *   coat     長褸衫腳修正（見 render3d.js 嘅 fixCoat）：below = 髖骨以下幾多（× 身高）開始算衫腳；keep = 保留幾多成跟腿（其餘跟髖）
 *   hair     長馬尾修正（fixHair）：keep = 保留幾多成跟手腳；off = 離手臂骨幾遠（× 身高）先當係頭髮；leg = 髖以下離腿骨嘅門檻係 off 嘅幾多倍；low = 髖以下幾多（× 身高）之外唔理
 *   coat / hair 嘅 tint：點樣由貼圖顏色認出嗰件嘢——min = [色頻, 最少幾多]，over = [[甲, 乙, 倍數]…] 即係「甲 > 乙 × 倍數」全部啱先算。
 *            換模型（造型、顏色唔同）淨係改呢度，唔使掂程式；冇填 tint 就唔做修正。
 */
const PISTOL = { shape: 'pistol', length: 0.2, grip: 0.18, left: 0.18, pitch: 4, radius: [0.016, 0.016], around: 0, wrap: 0.75, curl: [70, 70, 50], body: 0x2b2f3a, barrel: 0x15171d, mark: 0xff9a3a };
export const MATE_3D = {
  suzu: { model: 'suzu-v2.glb', run: 'run', arms: ARMS, animFrom: F1, aura: '255,150,60', recoil: 'alt',
    devices: [{ ...PISTOL, hands: ['r'], hold: [0.17, -0.02, 0.2] }, { ...PISTOL, hands: ['l'], hold: [-0.17, -0.02, 0.2] }] },
  kiri: { model: 'kiri-v2.glb', run: 'run', arms: ARMS, animFrom: F1, aura: '70,230,190',
    devices: [{ shape: 'katana', length: 0.7, grip: 0.16, left: 0.06, hold: [0.1, -0.06, 0.12], pitch: 58, radius: [0.014, 0.014], around: 0, wrap: 0.8, curl: [80, 80, 55], body: 0xd8e6e6, barrel: 0x15171d, mark: 0x3fe6b4, hands: ['r', 'l'] }],
    swing: { from: 58, to: -8, time: 0.14, back: 0.35 },
    coat: { below: 0, keep: 0.15, low: 0.3, tint: { min: ['g', 22], over: [['g', 'r', 1.18], ['g', 'b', 0.85]] } } }, // 新造型（043）：褸披喺膊頭、垂到膝下，深綠色；tint = 貼圖顏色啱呢個條件先算係件褸；low = 髖以下幾多之外唔理（靴）
  // 楯：右手衝鋒槍、左手大盾（長方形，邊緣鈷藍發光；塊盾企直，面向前）
  tate: { model: 'tate-v2.glb', run: 'run', arms: ARMS, animFrom: F1, aura: '70,130,255', recoil: 'first',
    devices: [
      { shape: 'smg', length: 0.3, grip: 0.3, left: 0.3, hands: ['r'], hold: [0.17, -0.03, 0.2], pitch: 3, radius: [0.016, 0.016], around: 0, wrap: 0.75, curl: [70, 70, 50], body: 0x2a3350, barrel: 0x14171f, mark: 0x4a8cff },
      { shape: 'shield', length: 0.4, grip: 0, left: 0, hands: ['l'], hold: [-0.17, -0.02, 0.2], pitch: 0, radius: [0.02, 0.02], around: 0, wrap: 0.75, curl: [70, 70, 50], body: 0x24305c, barrel: 0x10162c, mark: 0x4a8cff },
    ] },
  // 燈：右膊頭一門榴彈炮；身邊浮住一粒單眼無人機「圓仔」（冇手揸，自己上下浮）。hair：雙馬尾修正（見 render3d.js 嘅 fixHair）
  akari: { model: 'akari-v2.glb', run: 'run', arms: ARMS, animFrom: F1, aura: '255,90,170', recoil: 'first',
    devices: [
      { shape: 'launcher', length: 0.5, grip: 0.42, left: 0.42, hands: ['r'], hold: [0.15, 0.17, 0.02], pitch: 12, radius: [0.05, 0.05], around: 20, wrap: 0.7, curl: [50, 50, 40], body: 0x3a2a4a, barrel: 0x17131f, mark: 0xff5aaa },
      { shape: 'drone', length: 0.13, grip: 0, left: 0, hands: [], hold: [0.34, 0.3, -0.02], pitch: 0, radius: [0, 0], around: 0, wrap: 0, curl: [0, 0, 0], body: 0xe8eef4, barrel: 0x23283a, mark: 0x3ce6eb, bob: 0.025 },
    ],
    hair: { keep: 0.2, low: 0.2, tint: { min: ['r', 110], over: [['r', 'g', 1.7], ['b', 'g', 1.15], ['r', 'b', 1.1]] } } }, // 新造型（043）：馬尾垂到大腿；low = 髖以下幾多之外唔理（桃紅色嘅靴同襪嘅花紋）
};
