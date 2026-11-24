// 3D 戰鬥畫面入面主角以外嘅嘢用邊個模型：小敵人、首領、磚、大獎磚、路障、門框。換模型只改呢個檔。
// 模型檔放 game/assets/models/。大細、位置、命中範圍全部由規則（data/column.js）決定，呢度只管外觀。
//
// 共通：
//   model   模型檔名；null = 用程式砌嘅臨時外觀
//   yaw     模型要轉幾多度先面向主角（即係面向鏡頭）。模型本身面向 +z 就填 0；背住就填 180；面向 +x 填 -90
//   scale   喺規則大細之上再放大縮細（1 = 啱啱好規則嗰個大細）
//   offsetY 再升高（正數）或者降低幾多（× 件嘢嘅高度）。原點唔使理：載入時自動將模型底擺落地面、左右前後置中；呢個數只係用嚟微調（例如腳陷咗落地）
//   tris    載入時減面到最多幾多個三角形（null = 唔減）。外來模型幾千到幾萬面都得，照交就得
//
// 可讀性（小敵人 grunt、首領 boss 都有；新模型身體深色，喺深色路面上要靠呢幾項先睇得清）：
//   tint          底色提亮倍率（乘落貼圖度；1 = 原色，1.5 = 光一半）
//   glow          自發光強度（0 = 冇；貼圖自己發光，暗位唔會死黑，紅色發光位會更搶眼）
//   glowColor     自發光嘅顏色（白 = 貼圖原色）
//   outline       描邊厚度（× 模型高度；0 = 冇描邊）
//   rim           （只限小敵人）邊緣高光強度（0 = 冇）：面向鏡頭嗰面唔加，越側越光；rimColor = 高光顏色
//   outlineColor  描邊顏色
//   outlineTris   （只限小敵人）描邊嗰層再減面到最多幾多個三角形（null = 用返身體嗰個）。描邊只要外形，可以粗好多
//   outlineD      （只限小敵人）離主角幾遠以內先畫描邊；null = 全部畫。描邊令三角形加倍，遠排細到睇唔出，唔畫可以慳一半
//   實測（2026-11-23，800 隻方陣，兩個場景）：
//     淺色身體（而家嘅舊模型）：幼嘅深色邊（0.012、0x1a0e12）分得開每一隻；粗嘅淺色邊會將成個方陣糊成一片。
//     深色身體（將舊模型染黑到 tint 0.25 模擬新模型）：深色邊冇用，要轉淺紅邊 outline 0.014、outlineColor 0xff8a7a，再加 glow 0.15；
//       咁樣冇地墊都分得清。新模型到咗先試呢組。
//     新模型（2026-11-23，027）：小敵人身形闊過方陣嘅間距，要 scale 0.36 縮到闊度約等於間距、tilt -45 向後仰露出紅眼，
//       再用淺紅邊 0.03 同 glow 0.8；首領又闊又矮，scale 0.62 先唔會闊過條路。
//     瘦高版小敵人 grunt-d（2026-11-23，028）：紅色圓頂本身夠搶眼，唔使後仰、唔使淺色邊；scale 0.6 配幼深色邊分得開，0.7 開始左右黐埋。
//
// 小敵人 grunt（同畫面幾百隻，每個姿勢一個繪圖指令畫晒）：
//   tilt   向前傾幾多度
//   hop    原地彈跳幾高（× 身高）；有動作嘅模型可以填 0
//   clip   模型帶骨架同動作嘅話，用邊段動作嘅名（null = 第一段）
//   poses  由嗰段動作平均抽幾多個姿勢，載入時逐個烘成固定模型，行嗰陣輪住換（0 = 唔用動作，成隻彈跳）
//   fps    每秒換幾多個姿勢
//   pad    方陣腳下一塊淺色地墊嘅透明度（0 = 冇）；padColor = 顏色。深色敵人企喺上面，輪廓同行列會清楚好多
//
// 首領 boss：
//   tilt    向前傾幾多度
//   clips   動作名：walk 行埋嚟（循環）、hit 受擊（播一次）、down 倒下（播一次停喺最後一格）。null 或者模型冇嗰段 = 用程式嘅彈跳／震動頂住
//
// 磚 brick、大獎磚 prize、路障 barrier、門框 gate：
//   fit    'box' = 拉到啱啱好規則嗰個長闊高；'width' = 只對闊度、等比例縮放（底貼地）
//   數字係遊戲畫上去嘅，模型要留平面位（詳見 README「3D 模型交檔要求」）
//
// backdrop：用邊套場景外觀（下面 BACKDROPS 嘅名）。網址加 ?scene=b 可以臨時轉另一套嚟比較。

export const SCENE_3D = {
  backdrop: 'a',
  grunt: { model: 'grunt-d.glb', yaw: 0, scale: 0.6, offsetY: 0, tris: null, tilt: 0, hop: 0.06, clip: null, poses: 0, fps: 8, tint: 0.8, glow: 0.05, glowColor: 0xffffff, rim: 0.7, rimColor: 0xffb4a8, outline: 0.02, outlineColor: 0x0a0c14, outlineTris: 200, outlineD: null, pad: 0.22, padColor: 0xffd0c8 },
  boss: { model: 'boss.glb', yaw: 0, scale: 0.62, offsetY: 0, tris: null, tilt: 7, tint: 1.1, glow: 0.25, glowColor: 0xffffff, outline: 0.006, outlineColor: 0xff5a8c, clips: { walk: null, hit: null, down: null } },
  brick: { model: 'brick.glb', yaw: 0, scale: 1, offsetY: 0, tris: null, fit: 'box' },
  prize: { model: 'prize.glb', yaw: 0, scale: 1, offsetY: 0, tris: null, fit: 'box' },
  barrier: { model: 'barrier.glb', yaw: 0, scale: 1, offsetY: 0, tris: null, fit: 'box' },
  gate: { model: 'gate.glb', yaw: 0, scale: 1, offsetY: 0, tris: null, fit: 'box' },
};

/**
 * 場景外觀（純畫面）。顏色取自概念圖 art/out/025-enemy-and-scene-concepts/scene-a.png（黃昏）同 scene-b.png（夜晚）。
 * 鏡頭由後上方向下望，畫面頂只睇到前面約 10 個單位，所以天空唔入鏡：天色靠「遠處嘅霧」同「兩旁廢墟嘅受光色」帶出嚟。
 *   sky     天空由上到地平線三隻色（近鏡除錯先見到）
 *   fog     遠處霧色；fogRange = 離鏡頭幾遠開始有霧、幾遠全霧
 *   hemi    環境光 [天色, 地色, 強度]；sun = 主光 [顏色, 強度]
 *   road    路面：asphalt 瀝青、dash 線與線之間嘅虛線、edge 兩邊實線（null = 冇）、shoulder 路邊混凝土帶
 *   rail    兩邊混凝土護欄
 *   ruins   兩旁：towers 傾斜殘樓嘅顏色（逐棟喺兩隻色之間揀）、deck 斷橋橋面、pillar 橋墩、ground 最底嘅瓦礫地、neon 殘樓上嘅霓虹條（空 = 冇）
 */
export const BACKDROPS = {
  a: {
    name: '黃昏',
    sky: ['#d57a76', '#fbce8e', '#f99468'],
    fog: 0xb0736a, fogRange: [8.5, 24],
    hemi: [0xffe9da, 0x5e5068, 1.7], sun: [0xffe0bd, 2.2],
    road: { asphalt: '#363c4e', dash: '#787a88', edge: null, shoulder: '#4a4a58' },
    rail: 0x8f7f7c,
    ruins: { towers: [0x4b4252, 0x8a5f55], deck: 0x6b5658, pillar: 0x463e4c, ground: 0x2a2c3e, neon: [] },
  },
  b: {
    name: '夜晚',
    sky: ['#01163b', '#022d60', '#1e4c91'],
    fog: 0x15356a, fogRange: [8.5, 24],
    hemi: [0xdde6ff, 0x3a4468, 1.7], sun: [0xe4ecff, 2.1],
    road: { asphalt: '#21354f', dash: '#6f84a0', edge: '#7d90aa', shoulder: '#3d4859' },
    rail: 0x566a84,
    ruins: { towers: [0x0c2648, 0x26334b], deck: 0x2b3b55, pillar: 0x14294a, ground: 0x0f203b, neon: [0x35e0e8, 0xff5ad0] },
  },
};

/** 用邊套場景：網址指定嘅（?scene=b）有就用，冇就用表入面嗰套。 */
export const backdropOf = (name) => BACKDROPS[name] ?? BACKDROPS[SCENE_3D.backdrop] ?? BACKDROPS.a;

/** 用到嘅模型檔（唔重複）。 */
export const scene3dModels = () => [...new Set(Object.values(SCENE_3D).map((c) => c?.model).filter(Boolean))];
