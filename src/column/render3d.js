// 「三線長列」玩法嘅 3D 戰鬥畫面（預設；網址加 ?view=2d 開返 2D 畫法對照）：只換戰鬥畫面嘅畫法，規則、關卡、操作同 2D 版一模一樣（讀同一份狀態）。
//
// 兩層畫布：
//   下面一層 WebGL（Three.js，本機檔案 game/vendor/three/）：路面、樓群、主角、敵人、首領、磚、路障、門、子彈。
//   上面一層係原本嗰塊 2D 畫布（透明底）：數字同牌仔、命中特效、戰力牌、進化特寫、介面、結算畫面——全部用返 2D 版嘅畫法。
// 兩層用同一個鏡頭（camera.js 嘅數值 → view3d.js 嘅 camera3d），所以 2D 嘅字會啱啱疊喺 3D 嘅嘢上面。
//
// 模型（由 art/model/ 抄入 game/assets/models/）：
//   主角  每個形態用邊個模型、邊段動作、手上個裝置點砌，全部喺 data/lead3d.js（四個形態各有自己嘅模型，進化嗰刻換）。
//         動作：下半身同脊椎用模型自己嘅跑步動作；雙臂（連手指）由形態 I 第二段動作抄一個「雙手揸住嘢」嘅姿勢，
//               按各自模型嘅企定姿勢換算過嚟（唔同模型嘅骨頭軸向唔同，直接抄數會歪）。
//         裝置：模型係空手嘅，用幾嚿基本形狀砌。裝置擺喺胸口右前方一個固定位、管口指正前方；
//               兩隻手逐格用兩節骨嘅反向運動（膊頭、手踭）伸過去揸住。子彈同槍口閃光由管口出。
//   小敵人、首領、磚、大獎磚、路障、門框用邊個模型，全部喺 data/scene3d.js（填 null 就用程式外觀）。
//         小敵人幾百隻：載入時減面（view3d.js 嘅 decimate）再用 InstancedMesh 一次過畫；模型帶動作就烘幾個姿勢輪住換。
//         首領：原模型直接用，有動作就播（行、受擊、倒下）。
// 載入分兩段：形態 I、開場形態、小敵人、首領載入完就開始（期間上層畫布顯示進度）；其餘形態喺背景載入，未到就用住形態 I 嘅模型。
// 場景外觀（路面、護欄、兩旁殘樓斷橋、霧色、燈光）有兩套，顏色喺 data/scene3d.js 嘅 BACKDROPS；?scene=b 臨時轉另一套。
// 風格：toon 材質（三級明暗）；小敵人同首領加反殼描邊同自發光（數值喺 scene3d.js；主角太細，描邊會糊，冇加）。

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

import { COLORS, setFont, slantPanel } from '../battle/draw.js';
import { formatNumber } from '../core/format.js';
import { BAD, GOOD, drawCount, drawCutin, drawFx, drawHud } from '../crowd/render.js';
import { formOf, gateLabel, gateSegment, isGoodGate } from '../crowd/rules.js';
import { BULLET_3D, bullet3d } from '../data/bullet3d.js';
import { burstOf, COLUMN, COLUMN_TEXT } from '../data/column.js';
import { unitCutinKey } from '../data/assets.js';
import { CHAIN_STAGES, ROSTER, rosterOf } from '../data/characters.js';
import { CROWD } from '../data/crowd.js';
import { MATE_3D, isArmTrack, lead3d } from '../data/lead3d.js';
import { SCENE_3D, backdropOf } from '../data/scene3d.js';
import { WEAPONS } from '../data/weapons.js';
import { makeCamera } from './camera.js';
import { drawResult, drawSalvoTag, label } from './render.js';
import { phalanxColX } from './rules.js';
import { LEAD_BODY, bodyExtent, camera3d, decimateTo, heroBody, makeFpsMeter, makeQualityGuard, salvoOf, worldHeight } from './view3d.js';

const MODELS = new URL('../../assets/models/', import.meta.url);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/** 3D 畫面自己嘅數值（純畫面，唔影響規則）。 */
const V3 = {
  far: 13,                  // 遠過呢個距離嘅嘢唔畫（已經喺畫面頂外面或者霧入面）
  maxEnemies: 1500,
  maxBricks: 260,
  maxPrizes: 60,
  maxBullets: 420,
  maxGates: 28,             // 門板，另外危險地帶同首領出招嘅預告都用呢批半透明色塊
  maxWalls: 6,
  maxPads: 8,
  maxBeams: 48,             // 光束、光柱（每道兩層：外面光暈、入面光芯）
  pixelRatios: [2, 1.5, 1.25, 1], // 畫質級數：WebGL 嗰層嘅像素比上限。更新率長期低就降一級（view3d.js 嘅 makeQualityGuard）
};

const rgb = (str) => { const [r, g, b] = str.split(',').map(Number); return new THREE.Color(r / 255, g / 255, b / 255); };

/** toon 材質用嘅三級明暗圖。 */
function toonRamp() {
  const t = new THREE.DataTexture(new Uint8Array([165, 165, 165, 255, 222, 222, 222, 255, 255, 255, 255, 255]), 3, 1, THREE.RGBAFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true;
  return t;
}

/** 反殼描邊：背面、沿法線脹大少少。 */
function outlineMaterial(color, thickness) {
  const m = new THREE.MeshBasicMaterial({ color, side: THREE.BackSide, fog: true });
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>\n  transformed += normalize(normal) * ${thickness.toFixed(5)};`);
  };
  return m;
}

const ROAD_HALF = 1.15; // 路面半闊（世界單位）：玩嘅範圍係 ±1，出面少少係路邊，再出面就係護欄

/** 細隨機數（固定種子：每次開頁場景一樣）。 */
function seeded(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** 路面貼圖：瀝青（加少少粗糙斑點）、三條線之間嘅虛線、路邊混凝土帶、（夜晚版）兩邊實線；沿住條路重複，跟住行咗幾遠向後捲。 */
function roadTexture(look) {
  const N = 512, c = document.createElement('canvas'); c.width = c.height = N;
  const g = c.getContext('2d'), X = (x) => ((x + ROAD_HALF) / (ROAD_HALF * 2)) * N, rnd = seeded(7);
  g.fillStyle = look.asphalt; g.fillRect(0, 0, N, N);
  for (let i = 0; i < 2600; i++) { // 瀝青粒：好淡，中間保持乾淨
    g.fillStyle = rnd() < 0.5 ? 'rgba(255,255,255,.035)' : 'rgba(0,0,0,.06)';
    g.fillRect(rnd() * N, rnd() * N, 1 + rnd() * 2, 1 + rnd() * 2);
  }
  if (look.shoulder) { g.fillStyle = look.shoulder; g.fillRect(0, 0, X(-1.045), N); g.fillRect(X(1.045), 0, N - X(1.045), N); }
  if (look.edge) { g.fillStyle = look.edge; g.fillRect(X(-1.02) - 3, 0, 6, N); g.fillRect(X(1.02) - 3, 0, 6, N); }
  g.fillStyle = look.dash;
  for (const x of [-1 / 3, 1 / 3]) g.fillRect(X(x) - 3, N * 0.08, 6, N * 0.44);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.ClampToEdgeWrapping; t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

/** 天空：由上到地平線嘅漸變（鏡頭向下望，平時唔入鏡；近鏡除錯先見到）。 */
function skyTexture(colors) {
  const c = document.createElement('canvas'); c.width = 4; c.height = 256;
  const g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, colors[0]); gr.addColorStop(0.3, colors[1]); gr.addColorStop(0.5, colors[2]); gr.addColorStop(1, colors[2]);
  g.fillStyle = gr; g.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** 殘樓外牆貼圖：一格格窗（白底，顏色由逐棟嘅底色乘出嚟），有啲窗爛咗、有啲層塌咗。 */
function towerTexture() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 256;
  const g = c.getContext('2d'), rnd = seeded(23);
  g.fillStyle = '#fff'; g.fillRect(0, 0, 64, 256);
  for (let r = 0; r < 20; r++) {
    if (rnd() < 0.12) { g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(0, r * 12.8 + 2, 64, 9); continue; } // 成層露出嚟
    for (let k = 0; k < 4; k++) { if (rnd() < 0.2) continue; g.fillStyle = `rgba(0,0,0,${0.28 + rnd() * 0.25})`; g.fillRect(4 + k * 15, r * 12.8 + 3, 10, 7); }
  }
  g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(0, 0, 64, 3);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** 發光圓點貼圖（槍口閃光、腳下光環用）。 */
function glowTexture(ring) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  if (ring) { gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.55, 'rgba(255,255,255,.1)'); gr.addColorStop(0.78, 'rgba(255,255,255,.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); }
  else { gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); }
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/**
 * @param {HTMLCanvasElement} canvas   原本嗰塊 2D 畫布（變成上面嗰層）
 * @param {import('../core/assets.js').AssetStore} assets
 * @param {{ screenShake?: () => boolean }} [opts]
 */
export function createColumnRenderer3D(canvas, assets, opts = {}) {
  const ctx = canvas.getContext('2d');
  const view = /** @type {any} */ ({ W: 540, H: 960, u: 1, dpr: 1, cam: makeCamera(540, 960), unitScale: COLUMN.camera.heroScale });
  const perf = { sum: 0, n: 0, max: 0 };
  const meter = makeFpsMeter(5), guard = makeQualityGuard({ levels: V3.pixelRatios.length, below: 45, hold: 3 });
  let started = false, lastDraw = 0;

  // 下面嗰層：WebGL 畫布，同 2D 畫布一樣大細、一樣位置
  const glCanvas = document.createElement('canvas');
  glCanvas.id = 'c3d';
  // 部機開唔到 WebGL 嘅話呢句會掟錯：未掂頁面之前掟，main.js 接住就用返 2D 版
  const gl = new THREE.WebGLRenderer({ canvas: glCanvas, antialias: true, powerPreference: 'high-performance' });
  canvas.parentNode.insertBefore(glCanvas, canvas);
  Object.assign(canvas.style, { position: 'absolute', top: '0', left: '50%', transform: 'translateX(-50%)', background: 'transparent' });
  const BD = backdropOf(opts.scene);
  gl.setClearColor(BD.fog);

  const scene = new THREE.Scene();
  scene.background = skyTexture(BD.sky);
  scene.fog = new THREE.Fog(BD.fog, BD.fogRange[0], BD.fogRange[1]);
  const camera = new THREE.PerspectiveCamera(45, 9 / 16, 0.1, 60);
  camera.rotation.order = 'YXZ';
  scene.add(new THREE.HemisphereLight(BD.hemi[0], BD.hemi[1], BD.hemi[2]));
  const sun = new THREE.DirectionalLight(BD.sun[0], BD.sun[1]);
  sun.position.set(-2.5, 6, 3.5);
  scene.add(sun);
  const ramp = toonRamp();
  const toon = (o) => new THREE.MeshToonMaterial({ gradientMap: ramp, ...o });
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), P = new THREE.Vector3(), S = new THREE.Vector3(), E = new THREE.Euler(), C = new THREE.Color();

  // ---------- 路面、護欄、兩旁廢墟 ----------
  const roadTex = roadTexture(BD.road), ROAD_FROM = 3, ROAD_TO = -27, TILE = 2, SPAN = ROAD_FROM - ROAD_TO;
  roadTex.repeat.set(1, SPAN / TILE);
  const road = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_HALF * 2, SPAN), new THREE.MeshLambertMaterial({ map: roadTex }));
  road.rotation.x = -Math.PI / 2; road.position.set(0, 0, (ROAD_FROM + ROAD_TO) / 2);
  scene.add(road);
  // 高架橋身（路面下面嗰嚿）同最底嘅瓦礫地
  const slab = new THREE.Mesh(new THREE.BoxGeometry(ROAD_HALF * 2 + 0.3, 0.7, SPAN), toon({ color: BD.ruins.pillar }));
  slab.position.set(0, -0.36, (ROAD_FROM + ROAD_TO) / 2); scene.add(slab);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(40, SPAN + 10), new THREE.MeshLambertMaterial({ color: BD.ruins.ground }));
  ground.rotation.x = -Math.PI / 2; ground.position.set(0, -3.6, (ROAD_FROM + ROAD_TO) / 2); scene.add(ground);
  // 護欄：兩邊一節節混凝土（每節 1 個單位），跟住路面向後捲
  const RAIL_N = SPAN * 2;
  const rails = new THREE.InstancedMesh(new THREE.BoxGeometry(0.15, 0.2, 0.965), toon({ color: BD.rail }), RAIL_N);
  // 兩旁廢墟：全部係方塊（一個繪圖指令）。towers = 傾斜殘樓（外牆有窗）；plain = 矮樓頂、斷橋橋面、橋墩、瓦礫；neon = 殘樓上嘅霓虹條（夜晚版）
  const ruinList = { towers: [], plain: [], neon: [] };
  {
    const rnd = seeded(41), DEG = Math.PI / 180, cA = new THREE.Color(BD.ruins.towers[0]), cB = new THREE.Color(BD.ruins.towers[1]);
    const item = (list, x, y, z, sx, sy, sz, rx, ry, rz, color) => { const o = { x, y, z, s: new THREE.Vector3(sx, sy, sz), q: new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')), color: new THREE.Color(color) }; list.push(o); return o; };
    for (const side of [-1, 1]) {
      for (let i = 0; i < 9; i++) { // 殘樓：越遠離條路越高；多數向外傾，遠啲嘅有啲向內
        const off = rnd() * 2.3, x = side * (2.35 + off), w = 0.85 + rnd() * 0.9, dp = 0.85 + rnd() * 0.9, top = -1.5 + rnd() * 1.1 + off * 0.95;
        const lean = (off > 1 && rnd() < 0.35 ? 1 : -1) * side * (4 + rnd() * 17) * DEG, color = cA.clone().lerp(cB, rnd());
        const t = item(ruinList.towers, x, top - 3.5, (i + rnd() * 0.7) * SPAN / 9, w, 7, dp, (rnd() - 0.5) * 16 * DEG, (rnd() - 0.5) * 30 * DEG, lean, color);
        if (BD.ruins.neon.length && rnd() < 0.7) { // 霓虹條：貼喺向住條路嗰面或者向住鏡頭嗰面，近樓頂
          const front = rnd() < 0.5, upright = rnd() < 0.6, len = 0.35 + rnd() * 0.5;
          const local = front ? new THREE.Vector3((rnd() - 0.5) * w * 0.5, 3.5 - 0.3 - rnd() * 0.8, dp / 2 + 0.012) : new THREE.Vector3(-side * (w / 2 + 0.012), 3.5 - 0.3 - rnd() * 0.8, (rnd() - 0.5) * dp * 0.5);
          const o = item(ruinList.neon, 0, 0, 0, front ? (upright ? 0.045 : len) : 0.02, upright ? len : 0.045, front ? 0.02 : (upright ? 0.045 : len), 0, 0, 0, BD.ruins.neon[Math.floor(rnd() * BD.ruins.neon.length)]);
          o.q.copy(t.q); o.of = t; o.d = local.applyQuaternion(t.q);
        }
      }
      for (let i = 0; i < 5; i++) { // 矮樓頂：填滿下面
        const w = 1.4 + rnd() * 1.8;
        item(ruinList.plain, side * (1.9 + w / 2 + rnd() * 2.2), -2.2 - rnd() * 1.2 - 2, (i + rnd() * 0.8) * SPAN / 5, w, 4, 1.4 + rnd() * 2, 0, (rnd() - 0.5) * 20 * DEG, (rnd() - 0.5) * 8 * DEG, cA.clone().lerp(cB, rnd() * 0.5).multiplyScalar(0.8));
      }
      for (let i = 0; i < 3; i++) { // 斷橋：一段橋面加兩條橋墩；有啲橋面斷咗、向下跌
        const yaw = side * (22 + rnd() * 40) * DEG, x = side * (2.7 + rnd() * 1.3), y = -0.75 - rnd() * 0.8, z = (i + 0.2 + rnd() * 0.6) * SPAN / 3, broken = rnd() < 0.45;
        item(ruinList.plain, x, y, z, 0.8, 0.13, 3.4, broken ? (0.12 + rnd() * 0.2) : 0, yaw, 0, BD.ruins.deck);
        for (const k of [-1, 1]) { // 橋邊矮欄
          item(ruinList.plain, x + Math.cos(yaw) * 0.36 * k, y + 0.1, z - Math.sin(yaw) * 0.36 * k, 0.07, 0.12, 3.4, broken ? 0.2 : 0, yaw, 0, new THREE.Color(BD.rail).multiplyScalar(0.85));
          item(ruinList.plain, x + Math.sin(yaw) * 1.05 * k, y - 1.6, z + Math.cos(yaw) * 1.05 * k, 0.24, 3.1, 0.24, 0, yaw, 0, BD.ruins.pillar);
        }
      }
      for (let i = 0; i < 9; i++) { // 瓦礫：散落嘅碎件
        const sz = 0.18 + rnd() * 0.4;
        item(ruinList.plain, side * (1.75 + rnd() * 2.6), -1.6 - rnd() * 1.3, rnd() * SPAN, sz * (1 + rnd()), sz * 0.6, sz * (1 + rnd()), rnd() * 3, rnd() * 3, rnd() * 3, new THREE.Color(BD.ruins.deck).multiplyScalar(0.7 + rnd() * 0.4));
      }
    }
  }
  const wallMat = toon({ color: 0xffffff, map: towerTexture() }), roofMat = toon({ color: 0xffffff });
  const ruins = {
    towers: new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), [wallMat, wallMat, roofMat, roofMat, wallMat, wallMat], ruinList.towers.length),
    plain: new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), roofMat, ruinList.plain.length),
    neon: new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0xffffff }), Math.max(1, ruinList.neon.length)),
  };
  for (const k in ruins) { ruinList[k].forEach((o, i) => ruins[k].setColorAt(i, o.color)); ruins[k].frustumCulled = false; ruins[k].count = ruinList[k].length; scene.add(ruins[k]); }
  rails.frustumCulled = false; scene.add(rails);
  /** 護欄同廢墟跟住行咗幾遠向後捲，捲到身後就駁返去最前（嗰度喺霧入面，睇唔到駁口）。 */
  function scrollBackdrop(dist) {
    const zOf = (z0) => ROAD_FROM - SPAN + (((z0 + dist) % SPAN) + SPAN) % SPAN;
    for (let i = 0; i < RAIL_N; i++) { M.makeTranslation((i % 2 ? 1 : -1) * (ROAD_HALF + 0.075), 0.1, zOf(i >> 1)); rails.setMatrixAt(i, M); }
    rails.instanceMatrix.needsUpdate = true;
    for (const k in ruins) {
      const list = ruinList[k];
      for (let i = 0; i < list.length; i++) {
        const o = list[i];
        if (o.of) P.set(o.of.x + o.d.x, o.of.y + o.d.y, zOf(o.of.z) + o.d.z); else P.set(o.x, o.y, zOf(o.z));
        ruins[k].setMatrixAt(i, M.compose(P, o.q, o.s));
      }
      ruins[k].instanceMatrix.needsUpdate = true;
    }
  }
  scrollBackdrop(0);

  // ---------- 會郁嘅嘢 ----------
  const unitBox = new THREE.BoxGeometry(1, 1, 1);
  const bricks = new THREE.InstancedMesh(unitBox, toon({ color: 0xffffff }), V3.maxBricks);
  const prizes = new THREE.InstancedMesh(unitBox, toon({ color: 0xffffff }), V3.maxPrizes);
  const walls = new THREE.InstancedMesh(unitBox, toon({ color: 0xffffff }), V3.maxWalls * 2);
  const gates = new THREE.InstancedMesh(unitBox, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.62, depthWrite: false }), V3.maxGates);
  const gateFrames = new THREE.InstancedMesh(unitBox, toon({ color: 0xffffff }), V3.maxGates * 3);
  // 子彈：每款彈種一個 InstancedMesh（外形喺 data/bullet3d.js）。幾何全部「前後長 1、闊 1、頭向 −z（前）」，逐粒拉到自己嘅大細。
  const capsule = new THREE.CapsuleGeometry(0.5, 1, 2, 6); capsule.rotateX(Math.PI / 2); capsule.scale(1, 1, 0.5);
  const lathe = (pts, seg) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg).rotateX(-Math.PI / 2); // 側面輪廓 [半徑, 前後]（+ = 前）繞前後軸轉一圈
  const bladeGeo = (() => { // 弧形光刃：平放嘅月牙，凸嗰面向前
    const pos = [], idx = [], N = 10;
    for (let i = 0; i <= N; i++) {
      const a = (i / N - 0.5) * 2.5, x = Math.sin(a) / Math.sin(1.25) * 0.5, front = -Math.cos(a), back = -Math.cos(a) * 0.45 + 0.12 * (1 - Math.abs(i / N - 0.5) * 2);
      pos.push(x, 0, front, x, 0, Math.min(back, front + 0.75));
      if (i) { const k = i * 2; idx.push(k - 2, k - 1, k, k - 1, k + 1, k); }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
    g.computeBoundingBox(); const b = g.boundingBox; g.translate(0, 0, -(b.min.z + b.max.z) / 2); g.scale(1, 1, 1 / (b.max.z - b.min.z));
    return g;
  })();
  const bulletGeo = {
    tracer: capsule,
    orb: lathe([[0, -0.5], [0.1, -0.32], [0.26, -0.05], [0.44, 0.18], [0.5, 0.3], [0.4, 0.44], [0, 0.5]], 8),      // 光球拖短尾
    lance: lathe([[0, -0.5], [0.16, -0.44], [0.2, 0.18], [0.5, 0.26], [0.3, 0.38], [0, 0.5]], 5),                  // 幼桿加闊矛頭
    blade: bladeGeo,
  };
  const bulletCore = {};
  for (const k in bulletGeo) bulletCore[k] = new THREE.InstancedMesh(bulletGeo[k], new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false, side: k === 'blade' ? THREE.DoubleSide : THREE.FrontSide }), V3.maxBullets);
  const bulletMeshes = Object.values(bulletCore), bulletCount = {};
  const bulletGlow = new THREE.InstancedMesh(capsule, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }), V3.maxBullets);
  // 光束同光柱（武器等級入面即時命中嗰幾級）：一嚿拉長嘅方塊，加色混合；每道畫兩層（闊嘅光暈、窄嘅光芯）
  const beams = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }), V3.maxBeams * 2);
  const blob = new THREE.CircleGeometry(0.5, 20); blob.rotateX(-Math.PI / 2);
  const shadows = new THREE.InstancedMesh(blob, new THREE.MeshBasicMaterial({ color: 0x0a0c16, transparent: true, opacity: 0.4, depthWrite: false }), V3.maxEnemies + 4);
  // 方陣腳下嘅淺色地墊（scene3d.js 嘅 grunt.pad）：深色敵人企喺上面，輪廓清楚啲
  const padGeo = new THREE.PlaneGeometry(1, 1); padGeo.rotateX(-Math.PI / 2);
  const pads = new THREE.InstancedMesh(padGeo, new THREE.MeshBasicMaterial({ color: SCENE_3D.grunt.padColor ?? 0xffffff, transparent: true, opacity: SCENE_3D.grunt.pad ?? 0, depthWrite: false }), V3.maxPads);
  for (const m of [pads, bricks, prizes, walls, gates, gateFrames, ...bulletMeshes, bulletGlow, beams, shadows]) { m.frustumCulled = false; m.count = 0; scene.add(m); }
  // 每個 InstancedMesh 都要有顏色欄先可以逐個改色
  for (const m of [bricks, prizes, walls, gates, gateFrames, ...bulletMeshes, bulletGlow, beams]) m.setColorAt(0, C.set(0xffffff));

  // 主角腳下光環（形態顏色）同槍口閃光
  const aura = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: glowTexture(true), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  aura.rotation.x = -Math.PI / 2; aura.position.y = 0.012; scene.add(aura);
  const flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(false), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  scene.add(flash);

  /** 載入咗嘅模型：leads { 模型檔名: 主角 }、boss { root, height }、enemies InstancedMesh */
  const models = /** @type {any} */ ({ leads: {}, lead: null, boss: null, enemies: null, report: {} });
  const triCount = (geo) => (geo.index ? geo.index.count : geo.attributes.position.count) / 3;
  const firstMesh = (root) => { let m = null; root.traverse((o) => { if (!m && o.isMesh) m = o; }); return m; };
  const loader = new GLTFLoader();
  const gltfs = new Map();
  // 下載進度：檔名 → { loaded, total, done }。開場畫面用。
  const progress = new Map();
  let onProgress = () => {};
  const fetchGltf = (file) => {
    progress.set(file, { loaded: 0, total: 0, done: false });
    return loader.loadAsync(new URL(file, MODELS).href, (ev) => { const p = progress.get(file); p.loaded = ev.loaded; if (ev.lengthComputable) p.total = ev.total; onProgress(); })
      .then((g) => { progress.get(file).done = true; onProgress(); return g; });
  };
  const boneMap = (root) => { const m = new Map(); root.traverse((o) => { if (o.isBone) m.set(o.name, o); }); return m; };
  // 載入嗰刻記低每條骨企定（綁骨姿勢）嘅旋轉：之後動作會改寫佢，借姿勢要用返呢份
  const loadGltf = (file) => {
    if (!gltfs.has(file)) gltfs.set(file, fetchGltf(file).then((g) => {
      g.userData.bones = boneMap(g.scene);
      g.userData.rest = new Map([...g.userData.bones].map(([n, bone]) => [n, bone.quaternion.clone()]));
      return g;
    }));
    return gltfs.get(file);
  };
  const findClip = (clips, name) => clips.find((c) => c.name === name) ?? clips.find((c) => c.name.startsWith(name)) ?? null;
  const isArmBone = (name) => isArmTrack(`${name}.quaternion`);

  /**
   * 雙臂嘅姿勢由 from 模型嘅 clip 第 at 秒，搬去 to 模型：
   * 逐條骨計「由企定姿勢轉咗幾多」（喺上胸骨 Spine2 嘅座標入面計），再加落 to 模型自己嘅企定姿勢度。
   * 兩個模型綁骨時手臂角度、骨頭軸向唔同都搬得啱；同一個模型搬返畀自己就等於直接抄。
   * @returns {Map<string, THREE.Quaternion>} 骨頭名 → 局部旋轉
   */
  function borrowArmPose(from, clip, at, to) {
    const pose = new Map();
    for (const tr of clip.tracks) if (isArmTrack(tr.name) && /\.quaternion$/.test(tr.name)) pose.set(tr.name.replace(/\.quaternion$/, ''), new THREE.Quaternion().fromArray(tr.createInterpolant().evaluate(at)));
    const out = new Map(), I = new THREE.Quaternion();
    const walk = (boneS, restS, poseS, boneT, restT, poseT) => {
      for (const childT of boneT.children) {
        if (!childT.isBone || !isArmBone(childT.name)) continue;
        const childS = boneS?.children.find((c) => c.name === childT.name), rT = restT.clone().multiply(to.userData.rest.get(childT.name));
        let pT = rT, rS = null, pS = null;
        if (childS && pose.has(childS.name)) {
          rS = restS.clone().multiply(from.userData.rest.get(childS.name));
          pS = poseS.clone().multiply(pose.get(childS.name));
          pT = pS.clone().multiply(rS.clone().invert()).multiply(rT); // 轉咗幾多 × 自己嘅企定姿勢
        }
        out.set(childT.name, poseT.clone().invert().multiply(pT));
        walk(childS ?? null, rS ?? restS, pS ?? poseS, childT, rT, pT);
      }
    };
    const top = (g) => [...g.userData.bones.values()].find((bone) => /Spine2$/.test(bone.name));
    if (top(from) && top(to)) walk(top(from), I, I, top(to), I.clone(), I.clone());
    return out;
  }

  /**
   * 砌主角用嘅跑步動作：run 做底；arms 有嘅話，雙臂嘅旋轉軌換成嗰個固定姿勢。
   * 鎖住根骨嘅前後左右位移（跑步動作如果帶住人向前行，循環駁口會跳返轉頭；上下起伏留返）。
   * borrowed = 連跑步都係由第二個模型借嚟：只用旋轉，骨長同位置用返自己模型嘅。
   */
  function composeRun(run, arms, borrowed) {
    const tracks = [];
    let fixed = 0;
    for (const tr of run.tracks) {
      const isQ = /\.quaternion$/.test(tr.name);
      if (borrowed && !isQ) continue;
      const q = arms && isQ ? arms.get(tr.name.replace(/\.quaternion$/, '')) : null;
      if (q) { const v = q.toArray(); tracks.push(new tr.constructor(tr.name, [0, run.duration], v.concat(v))); fixed++; continue; }
      const out = tr.clone();
      if (/Hips\.position$/.test(out.name)) for (let i = 0; i < out.values.length; i += 3) { out.values[i] = out.values[0]; out.values[i + 2] = out.values[2]; }
      tracks.push(out);
    }
    return { clip: new THREE.AnimationClip('lead-run', run.duration, tracks), fixed };
  }

  /**
   * 用基本形狀砌主角手上個裝置。原點 = 右手揸嗰個位，管口向 +z。u = 全長。
   *   rifle  形態 I：闊身多面尾、方身、頂上一嚿、細長圓管、青色發光條
   *   cannon 形態 II：粗圓筒、青綠色外殼、兩粒發光晶石、管口一圈光
   *   lance  形態 III：紫色幼長桿、尾端一粒、前端銀色翼片夾住紫晶尖
   *   staff  形態 IV：白色幼桿金色節、前端珍珠球加金環、橙色晶芯、星形尖
   */
  function buildDevice(d, H) {
    const u = d.length * H, grp = new THREE.Group(), inner = new THREE.Group();
    const body = toon({ color: d.body }), dark = toon({ color: d.barrel }), glow = new THREE.MeshBasicMaterial({ color: d.mark, fog: false });
    const add = (geo, mat, y, z, x = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.frustumCulled = false; inner.add(m); return m; };
    const along = (geo) => geo.rotateX(Math.PI / 2); // 圓柱、圓錐本身沿 y，轉去沿 z（頂 = 前）
    const cyl = (r0, r1, z0, z1, mat, seg = 10) => add(along(new THREE.CylinderGeometry(r1 * u, r0 * u, (z1 - z0) * u, seg)), mat, 0, (z0 + z1) / 2 * u); // r0 = 後面半徑，r1 = 前面
    const box = (w, h, z0, z1, mat, y = 0) => add(new THREE.BoxGeometry(w * u, h * u, (z1 - z0) * u), mat, y * u, (z0 + z1) / 2 * u);
    if (d.shape === 'pistol') {
      // 手槍（鈴）：方身滑套、向下嘅握把、槍身兩邊同頂上各一條橙色發光條
      box(0.24, 0.3, 0.12, 1, body); box(0.2, 0.62, 0, 0.3, dark, -0.36);
      box(0.27, 0.07, 0.45, 0.95, glow, 0.02); box(0.08, 0.33, 0.45, 0.95, glow); cyl(0.07, 0.07, 0.96, 1, glow, 8);
    } else if (d.shape === 'smg') {
      // 衝鋒槍（楯）：方身機匣、後面一截短托、向下嘅握把同彈匣、幼槍管，兩邊同頂上一條鈷藍光
      box(0.2, 0.26, 0.12, 0.8, body); box(0.14, 0.16, 0, 0.14, dark, 0.02); box(0.16, 0.46, 0.2, 0.36, dark, -0.3); box(0.13, 0.52, 0.46, 0.6, dark, -0.34);
      cyl(0.05, 0.05, 0.8, 1, dark, 8); box(0.23, 0.06, 0.42, 0.78, glow, 0.03); box(0.07, 0.29, 0.42, 0.78, glow); cyl(0.058, 0.058, 0.97, 1, glow, 8);
    } else if (d.shape === 'shield') {
      // 大盾（楯）：一塊企直嘅長方形厚板（闊 0.62、高 1，單位 = 長度），面向前；四邊同中間一條直線鈷藍發光。原點 = 左手揸嘅位（板後面、偏上）
      box(0.62, 1, 0.04, 0.1, body, -0.12); box(0.5, 0.86, 0.1, 0.13, dark, -0.12);
      for (const sx of [-1, 1]) add(new THREE.BoxGeometry(0.035 * u, 1.02 * u, 0.09 * u), glow, -0.12 * u, 0.075 * u, sx * 0.31 * u);
      for (const sy of [-1, 1]) add(new THREE.BoxGeometry(0.64 * u, 0.035 * u, 0.09 * u), glow, (-0.12 + sy * 0.5) * u, 0.075 * u);
      add(new THREE.BoxGeometry(0.05 * u, 0.7 * u, 0.02 * u), glow, -0.12 * u, 0.135 * u); add(new THREE.BoxGeometry(0.05 * u, 0.7 * u, 0.02 * u), glow, -0.12 * u, 0.035 * u);
    } else if (d.shape === 'launcher') {
      // 榴彈炮（燈）：一條粗圓筒擔喺膊頭，前後各一個桃紅光環，筒口闊少少，上面一個瞄準鏡
      cyl(0.1, 0.1, 0, 0.9, dark, 12); cyl(0.115, 0.115, 0.06, 0.14, glow, 12); cyl(0.115, 0.115, 0.62, 0.7, glow, 12);
      cyl(0.11, 0.135, 0.86, 1, body, 12); cyl(0.12, 0.12, 0.985, 1, glow, 12); box(0.2, 0.12, 0.2, 0.56, body, 0.02);
      box(0.07, 0.07, 0.3, 0.52, dark, 0.15); box(0.08, 0.3, 0.38, 0.46, dark, -0.2);
    } else if (d.shape === 'drone') {
      // 浮游無人機（燈）：一粒白色圓球，前面一隻青色單眼，頂上一條細天線，兩邊細翼
      add(new THREE.SphereGeometry(0.5 * u, 14, 10), body, 0, 0.5 * u);
      add(new THREE.SphereGeometry(0.2 * u, 10, 8), glow, 0.04 * u, 0.93 * u); add(new THREE.TorusGeometry(0.27 * u, 0.045 * u, 6, 16), dark, 0.04 * u, 0.9 * u);
      add(new THREE.SphereGeometry(0.16 * u, 8, 6), glow, -0.02 * u, 0.06 * u);
      add(new THREE.CylinderGeometry(0.02 * u, 0.02 * u, 0.4 * u, 5), dark, 0.62 * u, 0.5 * u);
      for (const sx of [-1, 1]) add(new THREE.BoxGeometry(0.3 * u, 0.05 * u, 0.3 * u), dark, 0, 0.5 * u, sx * 0.6 * u);
    } else if (d.shape === 'katana') {
      // 直刀（霧）：深色刀柄、細護手、窄身直刃（刃口向上）、刀背一條青綠色光
      cyl(0.02, 0.02, 0, 0.23, dark, 6); box(0.085, 0.03, 0.23, 0.25, dark);
      box(0.012, 0.055, 0.25, 0.97, body); box(0.012, 0.03, 0.97, 1, body, -0.012);
      box(0.016, 0.014, 0.27, 0.96, glow, 0.03);
    } else if (d.shape === 'cannon') {
      cyl(0.062, 0.062, 0, 0.05, dark, 8); cyl(0.052, 0.052, 0.05, 0.78, dark, 8);
      box(0.12, 0.085, 0.24, 0.74, body);                                  // 外殼
      box(0.128, 0.05, 0.36, 0.5, glow); box(0.128, 0.05, 0.55, 0.69, glow);   // 兩粒晶石（兩邊都見到）
      box(0.05, 0.112, 0.36, 0.5, glow); box(0.05, 0.112, 0.55, 0.69, glow);   // 上面都見到
      cyl(0.06, 0.06, 0.78, 0.97, dark, 12); cyl(0.064, 0.064, 0.97, 1, glow, 12);
    } else if (d.shape === 'lance') {
      cyl(0.001, 0.036, 0, 0.04, dark, 6); cyl(0.036, 0.024, 0.04, 0.08, dark, 6);   // 尾端一粒
      cyl(0.024, 0.024, 0.06, 0.68, body, 6);
      cyl(0.03, 0.03, 0.3, 0.34, dark, 6);                                          // 中間一個銀環
      cyl(0.028, 0.068, 0.66, 0.78, glow, 4); cyl(0.068, 0.001, 0.78, 1, glow, 4);   // 紫晶尖
      for (const side of [-1, 1]) for (const flat of [0, 1]) {                       // 四塊翼片（上下左右）
        const fin = flat ? box(0.036, 0.014, 0.62, 0.86, dark) : box(0.014, 0.036, 0.62, 0.86, dark, side * 0.07);
        if (flat) fin.position.x = side * 0.07 * u; else fin.rotation.x = -side * 0.2;
      }
    } else if (d.shape === 'staff') {
      cyl(0.001, 0.03, 0, 0.06, dark, 8); cyl(0.03, 0.018, 0.06, 0.1, dark, 8);     // 尾端
      cyl(0.019, 0.019, 0.08, 0.7, body, 8);
      for (const z of [0.12, 0.4, 0.66]) cyl(0.03, 0.03, z, z + 0.03, dark, 8);     // 金色節
      cyl(0.02, 0.046, 0.7, 0.76, dark, 10);
      const orb = add(new THREE.SphereGeometry(0.082 * u, 14, 10), body, 0, 0.84 * u); orb.scale.z = 1.2;
      add(new THREE.OctahedronGeometry(0.058 * u), glow, 0, 0.84 * u).scale.set(1.5, 1.5, 2); // 晶芯：撐出球面少少先見到
      const ring = add(new THREE.TorusGeometry(0.125 * u, 0.016 * u, 6, 22), dark, 0, 0.83 * u); ring.rotation.set(1.15, 0.5, 0); // 金環：斜放，由後上方望落去係一個圈
      add(new THREE.OctahedronGeometry(0.04 * u), glow, 0, 0.98 * u).scale.set(1, 1.6, 1.6); // 星形尖
    } else {
      add(along(new THREE.CylinderGeometry(0.047 * u, 0.082 * u, 0.23 * u, 6)).scale(0.56, 1, 1), body, -0.018 * u, 0.115 * u);
      box(0.056, 0.08, 0.215, 0.685, body);
      box(0.042, 0.045, 0.38, 0.48, body, 0.06);
      cyl(0.034, 0.03, 0.68, 0.72, dark); cyl(0.021, 0.021, 0.7, 1, dark);
      box(0.062, 0.02, 0.5, 0.66, glow);    // 兩邊嘅發光條
      box(0.02, 0.086, 0.5, 0.66, glow);    // 上面都見到一條（鏡頭喺後上方）
      cyl(0.026, 0.026, 0.97, 1, glow);     // 管口一圈光
    }
    const muzzle = new THREE.Object3D(); muzzle.position.set(0, 0, u); inner.add(muzzle);
    inner.position.z = -d.grip * u;
    grp.add(inner);
    return { grp, muzzle };
  }

  /**
   * 修正綁骨權重：自動綁骨嗰陣（A 字企姿）手垂喺大腿側，衫腳有啲頂點會同時跟手（或者手指）同跟腿／髖。
   * 手一舉起，嗰啲面就拉成一大塊。將佢哋跟手嗰份改為跟返腿／髖。返回改咗幾多個頂點。
   */
  function fixHandWeights(mesh) {
    const si = mesh.geometry.attributes.skinIndex, sw = mesh.geometry.attributes.skinWeight;
    const kind = mesh.skeleton.bones.map((b) => (/(Left|Right)Hand/.test(b.name) ? 1 : /Hips$|UpLeg$|Leg$/.test(b.name) ? 2 : 0));
    let fixed = 0;
    for (let i = 0; i < si.count; i++) {
      let hand = 0, low = -1, lowW = 0;
      for (let k = 0; k < 4; k++) {
        const w = sw.getComponent(i, k), t = kind[si.getComponent(i, k)];
        if (t === 1) hand += w; else if (t === 2 && w > lowW) { low = k; lowW = w; }
      }
      if (hand <= 0 || low < 0) continue;
      for (let k = 0; k < 4; k++) if (kind[si.getComponent(i, k)] === 1) sw.setComponent(i, k, 0);
      sw.setComponent(i, low, lowW + hand);
      fixed++;
    }
    if (fixed) sw.needsUpdate = true;
    return fixed;
  }

  /**
   * 長褸衫腳修正（霧）：自動綁骨將衫腳嘅頂點分別綁咗去左腿、右腿，一跑起身兩邊向相反方向拉，衫腳就裂開。
   * 做法：搵出「屬於件褸」嘅頂點——貼圖顏色偏綠（件褸同內裡係綠／青綠，褲同靴係黑），而且喺髖骨以下、離腿骨有返咁上下距離
   * （靴上面嘅青綠色裝飾貼住條腿，唔計）——將佢哋跟腿嗰份權重大部分改為跟髖骨（留 keep 成跟腿，衫腳仲會輕微擺動）。
   * 成件衫腳就好似一塊由腰垂落嚟嘅硬布，唔會再左右扯開。回傳改咗幾多個頂點。
   */
  /** 貼圖顏色啱唔啱設定入面嘅 tint 條件（data/lead3d.js）：min = [色頻, 最少]；over = [[甲, 乙, 倍數]…] 全部「甲 > 乙 × 倍數」。 */
  const tintOk = (tint, r, g, b) => { const c = { r, g, b }; return c[tint.min[0]] > tint.min[1] && tint.over.every(([p, q, k]) => c[p] > c[q] * k); };
  function fixCoat(mesh, opt, root) {
    if (!opt.tint) return 0;
    const geo = mesh.geometry, pos = geo.attributes.position, uv = geo.attributes.uv, si = geo.attributes.skinIndex, sw = geo.attributes.skinWeight, bones = mesh.skeleton.bones;
    const img = mesh.material.map?.image, hips = bones.findIndex((b) => /Hips$/.test(b.name));
    if (!img || !uv || hips < 0 || !globalThis.document) return 0;
    const N = 256, cv = globalThis.document.createElement('canvas'); cv.width = cv.height = N;
    const c2 = cv.getContext('2d', { willReadFrequently: true });
    let px; try { c2.drawImage(img, 0, 0, N, N); px = c2.getImageData(0, 0, N, N).data; } catch { return 0; }
    root.updateMatrixWorld(true);
    const leg = bones.map((b) => /(UpLeg|Leg|Foot|ToeBase|Toe_End)$/.test(b.name)), at = (re) => { const b = bones.find((o) => re.test(o.name)); return b ? new THREE.Vector3().setFromMatrixPosition(b.matrixWorld) : null; };
    const hipP = at(/Hips$/), segs = [];
    for (const side of ['Left', 'Right']) { const a = at(new RegExp(`${side}UpLeg$`)), b = at(new RegExp(`${side}Leg$`)), c = at(new RegExp(`${side}Foot$`)); if (a && b && c) segs.push([a, b], [b, c]); }
    if (!hipP || !segs.length) return 0;
    let top = -Infinity, low = Infinity; const v = new THREE.Vector3(), q = new THREE.Vector3(), ab = new THREE.Vector3();
    for (let i = 0; i < pos.count; i += 7) { v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld); if (v.y > top) top = v.y; if (v.y < low) low = v.y; }
    const H = top - low, yMax = hipP.y - opt.below * H, far = (opt.off ?? 0.03) * H;
    const dist = (p) => { let best = Infinity; for (const [a, b] of segs) { ab.subVectors(b, a); const t = clamp(q.subVectors(p, a).dot(ab) / ab.lengthSq(), 0, 1), d = q.copy(a).addScaledVector(ab, t).distanceTo(p); if (d < best) best = d; } return best; };
    let fixed = 0;
    for (let i = 0; i < pos.count; i++) {
      let legW = 0; for (let k = 0; k < 4; k++) if (leg[si.getComponent(i, k)]) legW += sw.getComponent(i, k);
      if (legW <= 0.02) continue;
      v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
      if (v.y > yMax || (opt.low && v.y < hipP.y - opt.low * H)) continue; // low：髖以下幾多（× 身高）之外唔理（靴同靴上面嘅裝飾）
      const o = (Math.min(N - 1, Math.max(0, Math.floor(uv.getY(i) * N))) * N + Math.min(N - 1, Math.max(0, Math.floor(uv.getX(i) * N)))) * 4, r = px[o], g = px[o + 1], b = px[o + 2];
      if (!tintOk(opt.tint, r, g, b) || dist(v) < far) continue;   // 顏色唔啱（霧：唔夠綠）= 褲／靴；貼住條腿 = 靴上面嘅裝飾
      let slot = -1, moved = 0, minW = Infinity, minK = -1;
      for (let k = 0; k < 4; k++) {
        const bi = si.getComponent(i, k), w = sw.getComponent(i, k);
        if (bi === hips && w > 0) slot = k;
        if (leg[bi]) { const keep = w * opt.keep; moved += w - keep; sw.setComponent(i, k, keep); if (keep < minW) { minW = keep; minK = k; } }
      }
      if (slot >= 0) sw.setComponent(i, slot, sw.getComponent(i, slot) + moved);
      else { si.setComponent(i, minK, hips); sw.setComponent(i, minK, moved + minW); } // 冇髖骨嗰格：借最細嗰格腿骨（嗰少少權重一齊畀髖）
      fixed++;
    }
    if (fixed) { sw.needsUpdate = true; si.needsUpdate = true; }
    return fixed;
  }

  /**
   * 長雙馬尾修正（燈）：自動綁骨將垂落背後嘅馬尾部分綁咗去手臂同腿，手一舉（擔炮）、腳一跑，馬尾就畀扯到一條條尖刺噉。
   * 做法：搵出「屬於頭髮」嘅頂點——貼圖顏色係桃紅（頭髮；外套係白同紫、褲係黑），而且離手臂骨有返咁上下距離（袖口嘅桃紅邊貼住條手，唔計）——
   * 將佢哋跟手臂、跟腿嗰份權重大部分改為跟身（髖以上跟上胸 Spine2，以下跟髖骨；留 keep 成，仲會輕微擺動）。回傳改咗幾多個頂點。
   */
  function fixHair(mesh, opt, root) {
    if (!opt.tint) return 0;
    const geo = mesh.geometry, pos = geo.attributes.position, uv = geo.attributes.uv, si = geo.attributes.skinIndex, sw = geo.attributes.skinWeight, bones = mesh.skeleton.bones;
    const img = mesh.material.map?.image, hips = bones.findIndex((b) => /Hips$/.test(b.name)), chest = bones.findIndex((b) => /Spine2$/.test(b.name));
    if (!img || !uv || hips < 0 || chest < 0 || !globalThis.document) return 0;
    const N = 256, cv = globalThis.document.createElement('canvas'); cv.width = cv.height = N;
    const c2 = cv.getContext('2d', { willReadFrequently: true });
    let px; try { c2.drawImage(img, 0, 0, N, N); px = c2.getImageData(0, 0, N, N).data; } catch { return 0; }
    root.updateMatrixWorld(true);
    const limb = bones.map((b) => /(Shoulder|Arm|ForeArm|Hand\w*|UpLeg|Leg|Foot|ToeBase|Toe_End)$/.test(b.name)), at = (re) => { const b = bones.find((o) => re.test(o.name)); return b ? new THREE.Vector3().setFromMatrixPosition(b.matrixWorld) : null; };
    const hipP = at(/Hips$/), segs = [];
    for (const side of ['Left', 'Right']) { const a = at(new RegExp(`${side}Arm$`)), b = at(new RegExp(`${side}ForeArm$`)), c = at(new RegExp(`${side}Hand$`)); if (a && b && c) segs.push([a, b], [b, c]); }
    for (const side of ['Left', 'Right']) { const a = at(new RegExp(`${side}UpLeg$`)), b = at(new RegExp(`${side}Leg$`)), c = at(new RegExp(`${side}Foot$`)); if (a && b && c) segs.push([a, b], [b, c]); } // 腿上面嘅桃紅花紋貼住條腿，一樣唔計
    if (!hipP || !segs.length) return 0;
    let top = -Infinity, low = Infinity; const v = new THREE.Vector3(), q = new THREE.Vector3(), ab = new THREE.Vector3();
    for (let i = 0; i < pos.count; i += 7) { v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld); if (v.y > top) top = v.y; if (v.y < low) low = v.y; }
    const H = top - low, far = (opt.off ?? 0.045) * H;
    const dist = (p) => { let best = Infinity; for (const [a, b] of segs) { ab.subVectors(b, a); const t = clamp(q.subVectors(p, a).dot(ab) / ab.lengthSq(), 0, 1), d = q.copy(a).addScaledVector(ab, t).distanceTo(p); if (d < best) best = d; } return best; };
    let fixed = 0;
    for (let i = 0; i < pos.count; i++) {
      let limbW = 0; for (let k = 0; k < 4; k++) if (limb[si.getComponent(i, k)]) limbW += sw.getComponent(i, k);
      if (limbW <= 0.02) continue;
      const o = (Math.min(N - 1, Math.max(0, Math.floor(uv.getY(i) * N))) * N + Math.min(N - 1, Math.max(0, Math.floor(uv.getX(i) * N)))) * 4, r = px[o], g = px[o + 1], b = px[o + 2];
      if (!tintOk(opt.tint, r, g, b)) continue;   // 顏色唔啱（燈：唔係桃紅）= 唔係頭髮
      v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
      if (dist(v) < far * (v.y < hipP.y ? opt.leg ?? 1.5 : 1)) continue;                      // 貼住條手／腿 = 袖口嘅邊、襪上面嘅花紋
      if (opt.low && v.y < hipP.y - opt.low * H) continue; // 太低：係靴唔係頭髮
      const to = v.y >= hipP.y ? chest : hips;
      let slot = -1, moved = 0, minW = Infinity, minK = -1;
      for (let k = 0; k < 4; k++) {
        const bi = si.getComponent(i, k), w = sw.getComponent(i, k);
        if (bi === to && w > 0) slot = k;
        if (limb[bi]) { const keep = w * opt.keep; moved += w - keep; sw.setComponent(i, k, keep); if (keep < minW) { minW = keep; minK = k; } }
      }
      if (slot >= 0) sw.setComponent(i, slot, sw.getComponent(i, slot) + moved);
      else { si.setComponent(i, minK, to); sw.setComponent(i, minK, moved + minW); }
      fixed++;
    }
    if (fixed) { sw.needsUpdate = true; si.needsUpdate = true; }
    return fixed;
  }

  async function loadLead(cfg) {
    const g = await loadGltf(cfg.model), from = cfg.animFrom ? await loadGltf(cfg.animFrom) : g;
    const mesh = firstMesh(g.scene), reweighted = fixHandWeights(mesh), own = findClip(g.animations, cfg.run) ?? g.animations[0] ?? null, run = own ?? findClip(from.animations, cfg.run) ?? from.animations[0] ?? null;
    const armsClip = cfg.arms ? findClip(from.animations, cfg.arms.clip) : null;
    const arms = armsClip ? borrowArmPose(from, armsClip, cfg.arms.at, g) : null;
    const bone = (re) => mesh.skeleton.bones.find((b) => re.test(b.name)) ?? null;
    // 兩隻手：手掌嘅方向（喺手骨自己嘅座標）同揸嘢嘅手指姿勢。要趁骨架仲係企定姿勢（未有動作改過）嗰陣量。
    g.scene.updateMatrixWorld(true);
    const side = (s, k) => {
      const h = { arm: bone(new RegExp(`${s}Arm$`)), fore: bone(new RegExp(`${s}ForeArm$`)), hand: bone(new RegExp(`${s}Hand$`)), mid: bone(new RegExp(`${s}HandMiddle1$`)), frame: null, palm: null, scale: 1 };
      const idx = bone(new RegExp(`${s}HandIndex1$`)), pinky = bone(new RegExp(`${s}HandPinky1$`));
      if (!h.hand || !h.mid || !idx || !pinky) return h;
      // f = 手指方向（手腕 → 中指根），n = 手心向邊，c = f × n（手指向手心屈就係繞住呢條軸轉）。
      // 手心向邊由左右手決定：手指方向 ×（尾指 → 食指），左手嗰面係手心，右手嗰面係手背（要反轉）。
      const f = h.mid.position.clone().normalize(), n = new THREE.Vector3().crossVectors(f, idx.position.clone().sub(pinky.position)).normalize();
      if (!k) n.negate();
      const c = new THREE.Vector3().crossVectors(f, n);
      h.frame = new THREE.Matrix4().makeBasis(f, n, c);
      h.palm = h.mid.position.clone().addScaledVector(n, h.mid.position.length() * 0.2); // 貼住機身嗰點：中指根（指節）對落手心面少少，手指由呢度開始箍上去
      h.scale = h.hand.matrixWorld.getMaxScaleOnAxis();
      // 手指：每節喺自己嘅座標繞 c 軸屈；拇指繞「拇指方向 × 手心方向」屈一半
      const curl = (cfg.devices?.[0] ?? cfg.device)?.curl;
      if (arms && curl) {
        const rest = (b) => g.userData.rest.get(b.name), bend = (b, chain, axis, deg) => {
          const local = axis.clone().applyQuaternion(chain.clone().invert());
          arms.set(b.name, rest(b).clone().multiply(new THREE.Quaternion().setFromAxisAngle(local, deg * Math.PI / 180)));
        };
        for (const finger of ['Index', 'Middle', 'Ring', 'Pinky', 'Thumb']) {
          const chain = new THREE.Quaternion();
          let axis = c, amount = 1;
          for (let j = 1; j <= 3; j++) {
            const b = bone(new RegExp(`${s}Hand${finger}${j}$`));
            if (!b) break;
            if (finger === 'Thumb' && j === 1) { const t2 = bone(new RegExp(`${s}HandThumb2$`)), d = (t2 ? t2.position.clone().applyQuaternion(rest(b)) : b.position.clone()).normalize(); axis = new THREE.Vector3().crossVectors(d, n).normalize(); amount = 0.5; }
            chain.multiply(rest(b));
            bend(b, chain, axis, curl[j - 1] * amount * (finger === 'Pinky' ? 1.1 : 1) * (k ? 0.9 : 1)); // 左手托住，屈少少
          }
        }
      }
      return h;
    };
    const coatFixed = opts.noCoat ? 0 : cfg.coat ? fixCoat(mesh, cfg.coat, g.scene) : cfg.hair ? fixHair(mesh, cfg.hair, g.scene) : 0; // ?coat=0：唔修正（對照用）；hair = 雙馬尾修正
    const hands = { r: side('Right', 0), l: side('Left', 1), chest: bone(/Spine2$/) };
    const made = run ? composeRun(run, arms, !own) : null, clip = made?.clip ?? null;
    const mixer = new THREE.AnimationMixer(g.scene);
    if (clip) mixer.clipAction(clip).play();
    // 量人物真正幾高：成個跑步循環抽 12 格，逐格將頂點跟骨架計返位置，量最高（頭頂）同最低（著地嗰隻靴底），取中位數。
    // 手腳、頭髮只會向橫伸，唔影響高度；用頂點資料本身或者骨頭位置量都會錯（比例唔同、骨頭去唔到頭頂鞋底）。
    const samples = [], dur = clip?.duration ?? 0, pos = mesh.geometry.attributes.position, step = Math.max(1, Math.floor(pos.count / 6000));
    for (let k = 0; k < 12; k++) {
      mixer.setTime(dur * k / 12);
      g.scene.updateMatrixWorld(true);
      mesh.skeleton.update();
      let lo = Infinity, hi = -Infinity;
      for (let i = 0; i < pos.count; i += step) { mesh.getVertexPosition(i, P).applyMatrix4(mesh.matrixWorld); if (P.y < lo) lo = P.y; if (P.y > hi) hi = P.y; }
      samples.push({ min: lo, max: hi });
    }
    const hips = bone(/Hips$/) ?? mesh.skeleton.bones[0];
    P.setFromMatrixPosition(hips.matrixWorld);
    const cx = P.x, cz = P.z, ext = bodyExtent(samples), h = ext.height;
    mixer.setTime(0);
    g.scene.position.set(-cx, -ext.base, -cz); // 腳底擺喺地面、身體中線擺喺原點
    // 只用底色貼圖（toon）；模型帶嘅法線、粗糙度貼圖用唔著，放返啲記憶體
    const old = mesh.material;
    mesh.material = toon({ map: old.map });
    for (const k of ['normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap']) { const t = old[k]; if (t && t !== old.map) { t.source?.data?.close?.(); t.dispose(); } }
    old.dispose();
    if (mesh.material.map) gl.initTexture(mesh.material.map); // 而家就送上顯示卡：進化換模型嗰刻唔使窒一下
    mesh.frustumCulled = false;
    const root = new THREE.Group(), turn = new THREE.Group();
    turn.rotation.y = Math.PI; // 模型面向 +z（向鏡頭）；主角要背住鏡頭向前跑
    turn.add(g.scene); root.add(turn); root.visible = false; scene.add(root);
    // 手上嘅嘢：主角一件（雙手揸）；隊員可以多過一件（鈴左右手各一把槍），每件自己記低管口／刀尖喺邊（tip）
    const devices = [];
    if (hands.chest && hands.r.hand && hands.l.hand) for (const dc of cfg.devices ?? (cfg.device ? [cfg.device] : [])) { const d = { ...buildDevice(dc, h), cfg: dc, tip: new THREE.Vector3(), pitchAdd: 0 }; g.scene.add(d.grp); devices.push(d); }
    const device = devices[0] ?? null;
    return {
      root, turn, mixer, mesh, height: h, clip: dur || 1, container: g.scene, hands, device, devices, coatFixed, muzzle: new THREE.Vector3(), gap: [0, 0],
      report: { file: cfg.model, triangles: triCount(mesh.geometry), simplified: false, clips: g.animations.map((c) => c.name.slice(0, 40)), run: run?.name ?? null, armsFrom: armsClip ? `${cfg.animFrom ?? cfg.model}: ${armsClip.name.slice(0, 20)}… @ ${cfg.arms.at}s` : null, armTracksFixed: made?.fixed ?? 0, reweighted, device: cfg.device?.shape ?? null },
    };
  }

  // ---------- 兩節骨嘅反向運動：膊頭 a、手踭 b、手腕 c，將手腕搬去 target（世界座標） ----------
  const pa = new THREE.Vector3(), pb = new THREE.Vector3(), pc = new THREE.Vector3(), v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), ax = new THREE.Vector3();
  const qa = new THREE.Quaternion(), qp = new THREE.Quaternion(), qw = new THREE.Quaternion();
  /** 條骨喺世界座標入面再轉 q。 */
  function turnWorld(bone, q) {
    bone.parent.getWorldQuaternion(qp);
    bone.quaternion.premultiply(qw.copy(qp).invert().multiply(q).multiply(qp));
    bone.updateWorldMatrix(false, true);
  }
  function reach(a, b, c, target) {
    pa.setFromMatrixPosition(a.matrixWorld); pb.setFromMatrixPosition(b.matrixWorld); pc.setFromMatrixPosition(c.matrixWorld);
    const lab = pa.distanceTo(pb), lcb = pb.distanceTo(pc), lat = clamp(pa.distanceTo(target), (lab + lcb) * 0.15, (lab + lcb) * 0.995), ang = (x) => Math.acos(clamp(x, -1, 1));
    v1.subVectors(pc, pa).normalize(); v2.subVectors(pb, pa).normalize();
    const ab0 = ang(v1.dot(v2));
    ax.crossVectors(v1, v2);
    if (ax.lengthSq() < 1e-8) ax.set(0, 1, 0); else ax.normalize();
    const bc0 = ang(v1.subVectors(pa, pb).normalize().dot(v2.subVectors(pc, pb).normalize()));
    const ab1 = ang((lcb * lcb - lab * lab - lat * lat) / (-2 * lab * lat)), bc1 = ang((lat * lat - lab * lab - lcb * lcb) / (-2 * lab * lcb));
    turnWorld(a, qa.setFromAxisAngle(ax, ab1 - ab0));
    turnWorld(b, qa.setFromAxisAngle(ax, bc1 - bc0));
    pc.setFromMatrixPosition(c.matrixWorld);
    turnWorld(a, qa.setFromUnitVectors(v1.subVectors(pc, pa).normalize(), v2.subVectors(target, pa).normalize()));
  }

  /**
   * 裝置擺位（逐格）：揸位 = 上胸骨位置 + hold（右、上、前；× 身高），管口指正前方（再抬 pitch 度）。
   * 跟住兩隻手伸過去：右手揸喺揸位，左手托喺 left 嗰個位。手心貼住機身下面（偏外側 around 度）、手心向住機身中線，
   * 手指方向喺「橫跨機身」同「順住前臂」之間（wrap）；手腕先擺去「手心啱啱到位」嗰點，再將手掌轉去呢個方向。
   */
  const VA = new THREE.Vector3(), VB = new THREE.Vector3(), VC = new THREE.Vector3(), VD = new THREE.Vector3(), VN = new THREE.Vector3(), VF = new THREE.Vector3(), VT = new THREE.Vector3(), FWD = new THREE.Vector3(0, 0, 1);
  const QD = new THREE.Quaternion(), QT = new THREE.Quaternion(), MB = new THREE.Matrix4(), MI = new THREE.Matrix4();
  function placeDevice(L) { for (let n = 0; n < L.devices.length; n++) placeOne(L, L.devices[n], n === 0); }
  function placeOne(L, D, first) {
    const c = D.cfg, H = L.height, u = c.length * H, k = L.root.scale.x, around = c.around * Math.PI / 180;
    L.root.updateMatrixWorld(true);
    L.container.worldToLocal(VA.setFromMatrixPosition(L.hands.chest.matrixWorld));
    VA.x -= c.hold[0] * H; VA.y += c.hold[1] * H + (c.bob ? Math.sin(globalThis.performance.now() / 1000 * 2.6) * c.bob * H : 0); VA.z += c.hold[2] * H;   // 模型面向 +z，佢嘅右邊係 −x；bob = 自己上下浮（無人機）
    const pitch = (c.pitch + D.pitchAdd) * Math.PI / 180, dir = VB.set(0, Math.sin(pitch), Math.cos(pitch)).normalize(); // pitchAdd：揮刀嗰下臨時加減
    D.grp.quaternion.setFromUnitVectors(FWD, dir);
    D.grp.position.copy(VA);
    D.grp.updateMatrixWorld(true);
    D.muzzle.getWorldPosition(D.tip);
    if (first) L.muzzle.copy(D.tip);
    D.grp.getWorldQuaternion(QD);
    // 邊隻手揸：預設雙手（右手揸位、左手托前面）；hands 只寫一隻 = 單手揸喺揸位
    const hs = c.hands ?? ['r', 'l'], sides = hs.map((key) => [L.hands[key], key === 'l' && hs.length > 1 ? (c.left - c.grip) * u : 0, key === 'l' ? 1 : 0]);
    for (let n = 0; n < sides.length; n++) {
      const [h, along, i] = sides[n], out = i ? 1 : -1; // 右手偏向人物右邊（裝置座標 −x），左手偏向左邊
      if (!h.arm || !h.fore) continue;
      // 手心目標（世界座標）：機身中線嗰點，向下偏外側行一個半徑
      VD.set(out * Math.sin(around), -Math.cos(around), 0).applyQuaternion(QD);          // 由中線指向手心
      VC.copy(VA).addScaledVector(dir, along); L.container.localToWorld(VC).addScaledVector(VD, c.radius[i] * H * k);
      if (!h.frame) { reach(h.arm, h.fore, h.hand, VC); continue; }
      reach(h.arm, h.fore, h.hand, VC);                                                    // 第一次：大概伸到位，睇前臂指去邊
      VN.copy(VD).negate();                                                                // 手心向住中線
      VT.set(-out * Math.cos(around), -Math.sin(around), 0).applyQuaternion(QD);          // 橫跨機身下面去對面
      VF.setFromMatrixPosition(h.hand.matrixWorld).sub(pb.setFromMatrixPosition(h.fore.matrixWorld)).normalize(); // 前臂方向
      VF.lerp(VT, c.wrap).addScaledVector(VN, -VF.dot(VN)).normalize();
      MB.makeBasis(VF, VN, VT.crossVectors(VF, VN));
      QT.setFromRotationMatrix(MB.multiply(MI.copy(h.frame).transpose()));                 // 手骨喺世界入面要轉成點
      const s = h.scale * k;
      reach(h.arm, h.fore, h.hand, VT.copy(h.palm).multiplyScalar(s).applyQuaternion(QT).negate().add(VC)); // 手腕 = 手心目標 − 手心相對手腕嘅位移
      h.hand.parent.getWorldQuaternion(qp);
      h.hand.quaternion.copy(qp.invert().multiply(QT));
      h.hand.updateWorldMatrix(false, true);
      // 手心離目標幾遠（× 身高）：報告用，睇隻手有冇去到
      L.gap[i] = h.hand.localToWorld(VT.copy(h.palm)).distanceTo(VC) / (H * k);
    }
  }

  const leadFor = (form) => models.leads[lead3d(form).model] ?? models.leads[lead3d(0).model] ?? null;

  /**
   * 磚、大獎磚、路障、門框：設定表有填模型就換幾何同材質（仍然係一個 InstancedMesh 畫晒）。
   * 模型壓成一嚿：轉 yaw、中心擺喺原點；fit 'box' = 壓成 1×1×1（逐個拉到規則嘅長闊高），'width' = 闊 1、高同深按比例。
   */
  async function loadProp(name, mesh) {
    const cfg = SCENE_3D[name];
    if (!cfg?.model) return;
    const g = await loadGltf(cfg.model), src = firstMesh(g.scene);
    g.scene.updateMatrixWorld(true);
    let geo = src.geometry.clone().applyMatrix4(src.matrixWorld).rotateY((cfg.yaw ?? 0) * Math.PI / 180);
    for (const k of ['skinIndex', 'skinWeight']) geo.deleteAttribute(k);
    geo.computeBoundingBox();
    const sz = geo.boundingBox.getSize(new THREE.Vector3()), ctr = geo.boundingBox.getCenter(new THREE.Vector3()), before = triCount(geo);
    geo.translate(-ctr.x, -ctr.y, -ctr.z);
    // 外來模型面數可以好高，而磚同時有成百塊：減到表入面嘅 tris 以內
    const low = decimateTo(geo.attributes.position.array, geo.attributes.uv?.array ?? null, geo.index?.array ?? null, cfg.tris, Math.max(sz.x, sz.y, sz.z));
    if (low.cell) {
      geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(low.positions, 3));
      geo.setAttribute('uv', new THREE.BufferAttribute(low.uvs, 2));
      geo.setIndex(new THREE.BufferAttribute(low.indices, 1));
    }
    if (low.cell || !geo.attributes.normal) geo.computeVertexNormals();
    if (cfg.fit === 'width') geo.scale(1 / sz.x, 1 / sz.x, 1 / sz.x); else geo.scale(1 / sz.x, 1 / sz.y, 1 / sz.z);
    mesh.geometry = geo;
    mesh.material = toon({ map: src.material.map ?? null, color: 0xffffff });
    mesh.userData.model = { fit: cfg.fit ?? 'box', hy: sz.y / sz.x, scale: cfg.scale ?? 1, offsetY: cfg.offsetY ?? 0 };
    models.report[name] = { file: cfg.model, triangles: before, simplifiedTo: triCount(geo), fit: cfg.fit ?? 'box' };
  }

  /**
   * 小敵人：減面（減到表入面嘅 tris 以內）之後用 InstancedMesh 畫；自動貼地置中；可讀性（提亮、自發光、描邊）照表。
   * 模型帶骨架同動作、而且 poses > 0：由嗰段動作平均抽 poses 個姿勢，逐個喺載入時烘成固定模型（各自一個 InstancedMesh），行嗰陣每隻輪住換。
   */
  async function loadGrunt(cfg) {
    const g = await loadGltf(cfg.model), mesh = firstMesh(g.scene), src = mesh.geometry, n = src.attributes.position.count;
    g.scene.updateMatrixWorld(true);
    const clip = mesh.isSkinnedMesh && cfg.poses > 0 ? (cfg.clip ? findClip(g.animations, cfg.clip) : g.animations[0]) ?? null : null;
    const mixer = clip ? new THREE.AnimationMixer(g.scene) : null;
    if (mixer) mixer.clipAction(clip).play();
    const shots = [];
    for (let k = 0; k < (clip ? cfg.poses : 1); k++) {
      const pos = new Float32Array(n * 3);
      if (mixer) { mixer.setTime(clip.duration * k / cfg.poses); g.scene.updateMatrixWorld(true); mesh.skeleton.update(); }
      for (let i = 0; i < n; i++) { if (mixer) mesh.getVertexPosition(i, P); else P.fromBufferAttribute(src.attributes.position, i); P.applyMatrix4(mesh.matrixWorld).toArray(pos, i * 3); }
      shots.push(pos);
    }
    // 原點唔使啱：用第一個姿勢量，腳底擺落地面、左右前後置中
    let lo = Infinity, hi = -Infinity, x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (let i = 0; i < n * 3; i += 3) { const x = shots[0][i], y = shots[0][i + 1], z = shots[0][i + 2]; if (y < lo) lo = y; if (y > hi) hi = y; if (x < x0) x0 = x; if (x > x1) x1 = x; if (z < z0) z0 = z; if (z > z1) z1 = z; }
    const height = hi - lo, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, map = mesh.material.map ?? null;
    // 可讀性：底色提亮、自發光（有貼圖就用貼圖自己嘅顏色發光）、描邊
    const mat = toon({ map, color: new THREE.Color().setScalar(cfg.tint ?? 1), emissive: cfg.glowColor ?? 0xffffff, emissiveMap: map, emissiveIntensity: cfg.glow ?? 0 });
    if (cfg.rim > 0) { // 邊緣高光：面向鏡頭嗰面唔加，越側越光（圓頂有返層次，唔係一粒平嘅色）
      const rc = new THREE.Color(cfg.rimColor ?? 0xffffff).multiplyScalar(cfg.rim);
      mat.onBeforeCompile = (shader) => {
        shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', `outgoingLight += vec3(${rc.r.toFixed(4)}, ${rc.g.toFixed(4)}, ${rc.b.toFixed(4)}) * pow(1.0 - clamp(dot(normalize(vViewPosition), normal), 0.0, 1.0), 2.5);
#include <opaque_fragment>`);
      };
    }
    const lineMat = cfg.outline > 0 ? outlineMaterial(cfg.outlineColor ?? 0x10131f, cfg.outline * height) : null;
    let cell = 0, hullTris = 0;
    const insts = shots.map((pos) => {
      for (let i = 0; i < n * 3; i += 3) { pos[i] -= cx; pos[i + 1] -= lo; pos[i + 2] -= cz; }
      // 減面：每個姿勢各自減到「唔超過 tris」
      const low = decimateTo(pos, src.attributes.uv?.array ?? null, src.index?.array ?? null, cfg.tris, height);
      cell ||= low.cell;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(low.positions, 3));
      if (low.uvs) geo.setAttribute('uv', new THREE.BufferAttribute(low.uvs, 2));
      if (low.indices) geo.setIndex(new THREE.BufferAttribute(low.indices, 1));
      geo.computeVertexNormals();
      const inst = new THREE.InstancedMesh(geo, mat, V3.maxEnemies);
      inst.frustumCulled = false; inst.count = 0;
      inst.setColorAt(0, C.set(0xffffff)); inst.instanceColor.array.fill(1); // 逐隻染色（精英用另一隻色）
      scene.add(inst);
      if (lineMat) { // 描邊：同一批位置再畫一次反殼
        // 描邊只要個外形：用再減面嘅版本（表入面嘅 outlineTris），幾百隻嗰陣慳好多三角形
        let hull = geo;
        const lowHull = cfg.outlineTris ? decimateTo(low.positions, null, low.indices, cfg.outlineTris, height) : null;
        if (lowHull?.cell) { hull = new THREE.BufferGeometry(); hull.setAttribute('position', new THREE.BufferAttribute(lowHull.positions, 3)); hull.setIndex(new THREE.BufferAttribute(lowHull.indices, 1)); hull.computeVertexNormals(); }
        hullTris = triCount(hull);
        const line = new THREE.InstancedMesh(hull, lineMat, V3.maxEnemies);
        line.frustumCulled = false; line.count = 0; // 自己一份位置：只放近排（表入面嘅 outlineD），遠排唔畫描邊慳三角形
        scene.add(line); inst.userData.line = line;
      }
      return inst;
    });
    models.enemies = { insts, height, cfg, counts: insts.map(() => 0), lineCounts: insts.map(() => 0) };
    models.report.enemy = { file: cfg.model, triangles: triCount(src), simplifiedTo: triCount(insts[0].geometry), simplified: cell > 0, cell: +(cell / height).toFixed(4), poses: insts.length, clip: clip?.name ?? null, outline: !!lineMat, outlineTriangles: hullTris };
  }

  /** 首領：原模型直接用，加反殼描邊。設定表有填動作名、模型又有嗰段，就用骨架動作（行、受擊、倒下）。 */
  async function loadBoss(cfg) {
    const g = await loadGltf(cfg.model), mesh = firstMesh(g.scene);
    g.scene.updateMatrixWorld(true);
    if (mesh.isSkinnedMesh) { mesh.skeleton.update(); mesh.computeBoundingBox(); } // 有骨架：量綁骨姿勢下真正嘅高度
    const before = triCount(mesh.geometry);
    if (!mesh.isSkinnedMesh && cfg.tris) { // 冇骨架嘅外來模型：面數太高就減（有骨架嘅唔減，權重會亂）
      const src = mesh.geometry, low = decimateTo(src.attributes.position.array, src.attributes.uv?.array ?? null, src.index?.array ?? null, cfg.tris, new THREE.Box3().setFromBufferAttribute(src.attributes.position).getSize(P).length());
      if (low.cell) {
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(low.positions, 3));
        geo.setAttribute('uv', new THREE.BufferAttribute(low.uvs, 2));
        geo.setIndex(new THREE.BufferAttribute(low.indices, 1));
        geo.computeVertexNormals();
        mesh.geometry = geo;
      }
    }
    if (!mesh.geometry.attributes.normal) mesh.geometry.computeVertexNormals();
    const box = new THREE.Box3().setFromObject(g.scene);
    mesh.geometry.computeBoundingBox();
    const geoH = mesh.geometry.boundingBox.max.y - mesh.geometry.boundingBox.min.y, map = mesh.material.map ?? null;
    // 原點唔使啱：底擺落地面、左右前後置中
    g.scene.position.set(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2);
    // 可讀性：底色提亮、自發光、描邊（數值喺 scene3d.js）
    mesh.material = toon({ map, color: new THREE.Color().setScalar(cfg.tint ?? 1), emissive: cfg.glowColor ?? 0xffffff, emissiveMap: map, emissiveIntensity: cfg.glow ?? 0 });
    mesh.frustumCulled = false;
    if (cfg.outline > 0) {
      const mat = outlineMaterial(cfg.outlineColor ?? 0x10131f, cfg.outline * geoH), line = mesh.isSkinnedMesh ? new THREE.SkinnedMesh(mesh.geometry, mat) : new THREE.Mesh(mesh.geometry, mat);
      if (mesh.isSkinnedMesh) line.bind(mesh.skeleton, mesh.bindMatrix);
      line.frustumCulled = false;
      mesh.parent.add(line);
    }
    const root = new THREE.Group(), turn = new THREE.Group();
    turn.rotation.y = (cfg.yaw ?? 0) * Math.PI / 180;
    turn.add(g.scene); root.add(turn); root.visible = false; scene.add(root);
    const act = {}, mixer = g.animations.length ? new THREE.AnimationMixer(g.scene) : null;
    for (const k of ['walk', 'hit', 'down']) {
      const clip = mixer && cfg.clips?.[k] ? findClip(g.animations, cfg.clips[k]) : null;
      if (!clip) continue;
      act[k] = mixer.clipAction(clip);
      if (k !== 'walk') { act[k].setLoop(THREE.LoopOnce, 1); act[k].clampWhenFinished = k === 'down'; }
    }
    if (mixer) mixer.addEventListener('finished', (ev) => { if (ev.action === act.hit) { act.hit.stop(); act.walk?.setEffectiveWeight(1); } });
    act.walk?.play();
    models.boss = { root, mesh, height: box.max.y - box.min.y, cfg, mixer, act, down: false };
    models.report.boss = { file: cfg.model, triangles: before, simplifiedTo: triCount(mesh.geometry), simplified: triCount(mesh.geometry) < before, clips: Object.keys(act) };
  }

  // ---------- 分段載入 ----------
  // 第一段（載入完就開始）：形態 I、開場嗰個形態（?form=N）、小敵人、首領、磚／路障／門框嘅模型。
  // 第二段（開始之後喺背景逐個載入）：其餘形態。進化嗰刻模型未到，就用住形態 I 嘅模型（腳下光環係新形態嘅顏色），到咗先換。
  let leadLoadMs = 0, startMs = 0;
  const loadT0 = globalThis.performance.now(), since = () => Math.round(globalThis.performance.now() - loadT0);
  const leadCfgs = CROWD.evolution.forms.map((_, f) => lead3d(f)).filter((cfg, i, all) => cfg.own && all.findIndex((o) => o.model === cfg.model) === i);
  const firstModels = new Set([lead3d(0).model, lead3d(opts.startForm ?? 0).model]);
  const addLead = (cfg) => loadLead(cfg).then((lead) => {
    models.leads[cfg.model] = lead;
    models.lead ??= lead;
    lead.warm = 2; // 頭兩格偷偷畫一次（縮到睇唔見）：幾何同骨架資料而家就送上顯示卡，進化換模型嗰刻唔使窒
    (models.report.leads ??= []).push({ ...lead.report, readyMs: since() });
    models.report.lead = models.lead.report;
    leadLoadMs = since();
  });
  const first = [
    ...leadCfgs.filter((cfg) => firstModels.has(cfg.model)).map(addLead),
    loadGrunt(SCENE_3D.grunt), loadBoss(SCENE_3D.boss),
    loadProp('brick', bricks), loadProp('prize', prizes), loadProp('barrier', walls), loadProp('gate', gateFrames),
  ];
  const firstFiles = [...progress.keys()]; // 第一段要落嘅檔（上面嗰幾句一叫就已經開始落）
  /** 第一段落咗幾多（0 至 1）。未知大細嘅檔當 2 MB。 */
  const loadFraction = () => {
    let got = 0, all = 0;
    for (const f of firstFiles) { const p = progress.get(f), total = p.total || Math.max(p.loaded, 2e6); got += p.done ? total : Math.min(p.loaded, total); all += total; }
    return all ? got / all : 1;
  };
  // 變身特寫圖：預先解碼成點陣圖，再排隊喺開始後頭幾格偷偷畫一次（見 drawOverlay 嘅 warmCutin）。
  // 實測（2026-11-22）：第一次進化嗰兩格卡頓（各約 90 ms）唔係換模型，亦唔係程式本身慢（嗰格程式只用 1 ms），2D 畫法一樣有——
  // 係瀏覽器第一次用「斜帶裁剪 + 貼圖」同「半透明貼圖」呢兩種畫法時，顯示卡嗰邊先至準備，要等。預先畫一次就唔使喺進化嗰刻等。
  const bitmaps = new Map(), overlayAssets = { get: (key) => bitmaps.get(key) ?? assets.get(key) }, warmQueue = [];
  assets.ready().then(() => {
    for (let f = 0; f < CROWD.evolution.forms.length; f++) {
      const key = unitCutinKey(f), im = key ? assets.get(key) : null;
      if (!im?.ok) continue;
      if (!globalThis.createImageBitmap) { warmQueue.push(f); continue; }
      globalThis.createImageBitmap(im.img).then((bm) => { bitmaps.set(key, { ok: true, img: bm, src: im.src, settled: true }); }).catch(() => {}).then(() => warmQueue.push(f));
    }
  });
  /** 將一個形態嘅變身特寫縮到好細、畫喺左上角介面牌下面（睇唔到）：滑入同淡出兩種畫法各一次。 */
  function warmCutin() {
    if (!warmQueue.length) return;
    const f = warmQueue.shift(), T = CROWD.evolution.showTime;
    ctx.save();
    ctx.translate(24 * view.u, 16 * view.u); ctx.scale(0.03, 0.03);
    drawCutin(ctx, view, { evoT: T * 0.5, form: f }, overlayAssets);
    drawCutin(ctx, view, { evoT: T * 0.1, form: f }, overlayAssets);
    ctx.restore();
  }

  /** 預熱：將場上會出現嘅嘢全部顯示一格（各放一個），逼顯示卡而家就編譯著色器、收貼圖；畫面有載入畫面遮住。 */
  function prewarm() {
    const inst = [pads, bricks, prizes, walls, gates, gateFrames, ...bulletMeshes, bulletGlow, beams, shadows, ...(models.enemies?.insts ?? []), ...(models.enemies?.insts ?? []).map((m) => m.userData.line).filter(Boolean)];
    for (const m of inst) { M.makeScale(0.001, 0.001, 0.001); M.setPosition(0, -5, 0); m.setMatrixAt(0, M); m.instanceMatrix.needsUpdate = true; m.count = 1; }
    for (const k in models.leads) models.leads[k].root.visible = true;
    if (models.boss) models.boss.root.visible = true;
    aura.visible = flash.visible = true;
    try { gl.compile(scene, camera); gl.render(scene, camera); } catch (err) { console.error('3D 預熱失敗', err); }
    for (const m of inst) m.count = 0;
    for (const k in models.leads) models.leads[k].root.visible = false;
    if (models.boss) models.boss.root.visible = false;
    aura.visible = flash.visible = false;
  }
  const ready = Promise.allSettled(first).then((results) => {
    startMs = since();
    prewarm();
    const bad = results.find((r) => r.status === 'rejected');
    if (bad) throw bad.reason;
  });
  /** 全部模型（連背景載入嗰批）都有結果先完成。 */
  const allReady = ready.catch(() => {}).then(async () => {
    for (const cfg of leadCfgs) {
      if (firstModels.has(cfg.model)) continue;
      try { await addLead(cfg); } catch (err) { console.error(`3D 模型載入唔到：${cfg.model}`, err); }
    }
    models.report.allMs = since();
  });
  // 隊員（040）：每個隊員自己嘅模型（data/lead3d.js 嘅 MATE_3D），同隊長行同一套載入、骨架、跑步、揸武器流程。用到先載入（未到就唔畫）。
  const mateModels = {}, mateImgs = {}, MATE_PHASE = { suzu: [0.37, 1.07], kiri: [0.71, 0.96], tate: [0.15, 0.93], akari: [0.55, 1.1] };
  const mateLooks = Object.fromEntries(ROSTER.filter((r) => r.battle).flatMap((r) => [[r.id, r.battle.look], ...(r.battle.drone ? [[`${r.id}:drone`, r.battle.drone.look]] : [])]).map(([k, look]) => [k, { ...look, coreC: rgb(look.core), glowC: rgb(look.glow) }]));
  // 榴彈（燈）：最多同時 6 粒，一粒桃紅色發光球；光盾（楯）：隊伍前面一塊彎嘅藍色光幕
  const shellMeshes = Array.from({ length: 6 }, () => { const g = new THREE.Group(), core = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffe6f2, fog: false })), halo = new THREE.Mesh(new THREE.SphereGeometry(0.085, 10, 8), new THREE.MeshBasicMaterial({ color: 0xff5aaa, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); g.add(core, halo); g.visible = false; g.frustumCulled = false; scene.add(g); return g; });
  const guardGeo = new THREE.CylinderGeometry(1, 1, 1, 20, 1, true, Math.PI - 0.62, 1.24);
  const guardWall = new THREE.Mesh(guardGeo, new THREE.MeshBasicMaterial({ color: 0x4a8cff, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
  const guardEdge = new THREE.LineSegments(new THREE.EdgesGeometry(guardGeo), new THREE.LineBasicMaterial({ color: 0x9cc4ff, transparent: true, opacity: 0.9, fog: false }));
  guardWall.add(guardEdge); guardWall.visible = false; guardWall.frustumCulled = false; guardEdge.frustumCulled = false; scene.add(guardWall);
  function mateModel(id) {
    if (!(id in mateModels)) {
      mateModels[id] = null;
      const cfg = MATE_3D[id];
      if (cfg) loadLead(cfg).then((m) => { m.mixer.setTime(m.clip * (MATE_PHASE[id]?.[0] ?? 0.5)); m.cfg = cfg; mateModels[id] = m; (models.report.mates ??= {})[id] = { ...m.report, coatFixed: m.coatFixed, readyMs: since() }; })
        .catch((err) => console.error(`隊員模型載入唔到：${id}`, err));
      // 接力爆發嘅特寫用佢張立繪（裁頭同膊頭）
      if (globalThis.Image) { const im = new globalThis.Image(); im.src = rosterOf(id).portrait(0); mateImgs[id] = im; }
    }
    return mateModels[id];
  }
  if (opts.mates?.length) allReady.then(() => { for (const id of opts.mates) mateModel(id); });

  // ---------- 大細同鏡頭 ----------
  const size = { lead: 1, enemy: 1, boss: 1 }, HERO = heroBody(opts.hero); // HERO = 主角頭頂到靴底佔畫面高度幾多（?hero=N 可以臨時改）
  function resize() {
    const r = glCanvas.getBoundingClientRect();
    view.dpr = Math.min(2, globalThis.devicePixelRatio || 1);
    view.W = Math.max(270, r.width);
    view.H = Math.max(480, r.height);
    view.u = view.W / 540;
    canvas.width = view.W * view.dpr; canvas.height = view.H * view.dpr;
    canvas.style.width = `${view.W}px`; canvas.style.height = `${view.H}px`;
    view.cam = makeCamera(view.W, view.H);
    view.glRatio = Math.min(globalThis.devicePixelRatio || 1, opts.pixelRatio || V3.pixelRatios[guard.level]);
    gl.setPixelRatio(view.glRatio);
    gl.setSize(view.W, view.H, false);
    const c3 = camera3d(view.cam);
    camera.fov = c3.fov; camera.aspect = c3.aspect;
    camera.position.set(...c3.position);
    camera.rotation.set(-c3.pitch, 0, 0);
    camera.updateProjectionMatrix();
    // 主角全身、小敵人、首領喺畫面佔幾高 → 世界入面幾高（同 2D 版同一組比例）
    size.lead = worldHeight(view.cam, HERO);
    // 戰力牌：字嘅大細唔跟主角縮（要睇得清），只係位置跟。2D 畫法將佢擺喺 11% 嗰個主角頭頂；主角細咗，就向下移返去新嘅頭頂上面
    const old = worldHeight(view.cam, LEAD_BODY), k = HERO / LEAD_BODY;
    view.tagShift = [-36 * view.u * k, -30 * view.u * k + (view.cam.project(0, 0, size.lead).y - view.cam.project(0, 0, old).y)];
    size.enemy = worldHeight(view.cam, COLUMN.phalanx.size);
    size.boss = worldHeight(view.cam, COLUMN.boss.size);
    drawLoading();
  }

  /** 開場載入畫面：遊戲未開始之前畫喺上層畫布（唔透明，遮住下面未準備好嘅 3D 畫面）。 */
  function drawLoading() {
    if (started) return;
    const { W, H, u, dpr } = view, k = loadFraction(), bw = W * 0.56, bh = 8 * u, bx = (W - bw) / 2, by = H * 0.56;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#12162a'; ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    setFont(ctx, 40 * u, 800); ctx.fillStyle = '#fff'; ctx.fillText('數字突擊隊', W / 2, H * 0.43);
    setFont(ctx, 15 * u, 700); ctx.fillStyle = '#6ff2e6'; ctx.fillText('NUMBER SQUAD', W / 2, H * 0.43 + 38 * u);
    ctx.fillStyle = 'rgba(255,255,255,.14)'; ctx.fillRect(bx, by, bw, bh);
    ctx.fillStyle = '#6ff2e6'; ctx.fillRect(bx, by, bw * k, bh);
    setFont(ctx, 15 * u, 700); ctx.fillStyle = '#cfd6ea'; ctx.fillText(`載入中 ${Math.round(k * 100)}%`, W / 2, by + 30 * u);
  }
  onProgress = drawLoading;

  let lastT = 0, instBase = null, close = null;
  /** 逐個形態嘅顏色（描邊、光環、子彈）。 */
  const formColor = (form) => (formOf(form).color ? rgb(formOf(form).color) : null);
  const bulletLooks = BULLET_3D.forms.map((b) => ({ ...b, coreC: rgb(b.core), glowC: rgb(b.glow) })), bulletLook = (form) => bulletLooks[Math.max(0, Math.min(form, bulletLooks.length - 1))];
  // 武器等級（大數字版）：每級自己嘅外觀（data/weapons.js 嘅 look）。子彈記住自己係邊一級射出嚟（b.w），升咗級舊子彈照舊
  const weaponLooks = WEAPONS.map((w) => ({ swing: 0, ring: w.look.hit === 'ring', ...w.look, coreC: rgb(w.look.core), glowC: rgb(w.look.glow) }));
  /** 而家手上嗰把嘅外觀：大數字版睇武器等級，舊數值睇形態。 */
  const lookNow = (s) => (COLUMN.numbers.weapons ? weaponLooks[Math.max(0, Math.min(s.weapon ?? 0, weaponLooks.length - 1))] : bulletLook(s.form));
  // 最近幾輪齊射（幾時射、第幾輪、幾多排）：槍口閃光一著就當射咗一輪。用嚟分重拍、左右交替、前後排（純畫面）
  const shots = []; let shotN = 0, lastMuzzle = 0, lastShotT = -1;
  const hash = (n) => { const x = Math.sin(n * 12.9898) * 43758.5453; return x - Math.floor(x); }, NO_SHOT = { shot: null, row: 0 };

  function setBox(mesh, i, x, y, z, sx, sy, sz, color) {
    M.makeScale(sx, sy, sz); M.setPosition(x, y, z);
    mesh.setMatrixAt(i, M);
    if (color) mesh.setColorAt(i, color);
  }
  /**
   * 放一件場上嘅嘢（磚、路障、門框）：y0 = 底，sx/sy/sz = 規則嘅長闊高。
   * 用緊程式外觀：一嚿方塊，顏色 = color。換咗模型：模型拉到呢個大細（fit 'width' 就只對闊度），顏色 = tint（乘落貼圖度，白 = 原色）。
   */
  function put(mesh, i, x, y0, z, sx, sy, sz, color, tint) {
    const m = mesh.userData.model;
    if (!m) setBox(mesh, i, x, y0 + sy / 2, z, sx, sy, sz, color);
    else if (m.fit === 'width') setBox(mesh, i, x, y0 + m.hy * sx * m.scale * (0.5 + m.offsetY), z, sx * m.scale, sx * m.scale, sx * m.scale, tint);
    else setBox(mesh, i, x, y0 + sy * m.scale * (0.5 + m.offsetY), z, sx * m.scale, sy * m.scale, sz * m.scale, tint);
  }
  // 換咗模型之後嘅染色（乘落貼圖度）：WHITE 原色、DIM 鎖住、FLASH 受擊／彈起嗰下閃光（大過 1 = 光過原色）
  const MINI = 0.55;
  const ELITE = { scale: 1.55, tint: [0.72, 0.45, 1.5] }; // 十關版嘅精英小敵人：暫時用同一個模型放大染紫（之後換正式美術）
  const WHITE = new THREE.Color(1, 1, 1), DIM = new THREE.Color(0.55, 0.55, 0.55), FLASH = new THREE.Color(1.9, 1.9, 1.9);

  function drawScene(s) {
    const W3 = COLUMN.world, far = V3.far;
    const dt = clamp(s.t - lastT, 0, 0.1); lastT = s.t;
    // 路面同樓群跟住行咗幾遠向後捲
    roadTex.offset.y = (s.dist / TILE) % 1;
    scrollBackdrop(s.dist);

    let nShadow = 0;
    const shadow = (x, z, r) => { if (nShadow >= shadows.instanceMatrix.count) return; M.makeScale(r, 1, r * 0.8); M.setPosition(x, 0.01, z); shadows.setMatrixAt(nShadow++, M); };

    // 新一輪齊射：槍口閃光由熄變著（或者時間倒返，即係重開咗）
    if (s.t < lastShotT) { shots.length = 0; lastMuzzle = 0; }
    if (s.muzzle > lastMuzzle + 1e-6 && s.power > 0) { shots.push({ t: s.t, n: shotN++, rows: Math.max(1, Math.ceil((s.salvo || 1) / COLUMN.fire.perRow)) }); lastShotT = s.t; if (shots.length > 10) shots.shift(); }
    lastMuzzle = s.muzzle;
    const BEAT = BULLET_3D.beat, onBeat = shots.length > 0 && shots[shots.length - 1].n % BEAT.every === 0;
    // 主角：呢個形態嘅模型（未有就用形態 I 嗰個）
    const L = leadFor(s.form), cfg = lead3d(s.form);
    for (const k in models.leads) {
      const o = models.leads[k];
      o.root.visible = o === L && s.power > 0;
      if (o !== L && o.warm > 0) { o.warm--; o.root.visible = true; o.root.scale.setScalar(1e-4); o.root.position.set(0, -3, 0); } // 啱啱載入完：偷偷畫一格
    }
    if (L) {
      models.lead = L; L.warm = 0;
      if (!s.freeze) L.mixer.update(dt * 1.25); // 引導停住個世界：隊長停步（唔好原地跑）
      const k = size.lead / L.height;
      L.root.scale.setScalar(k);
      L.root.position.set(s.x, 0, 0);
      L.root.rotation.z = close ? 0 : -clamp(s.lean, -CROWD.feel.lean.max, CROWD.feel.lean.max) * 1.6; // 橫移嗰陣向移動方向側傾（近鏡企直睇）
      L.root.rotation.x = s.recoil > 0 ? 0.06 * (onBeat ? BEAT.recoil : 1) * s.recoil / CROWD.feel.recoil.time : 0;   // 後座（重拍大啲）
      placeDevice(L);
      if (!L.device) L.muzzle.set(s.x + size.lead * 0.1, size.lead * 0.62, -size.lead * 0.42); // 空手：槍口當喺身前上方
      const fc = cfg.aura ? rgb(cfg.aura) : formColor(s.form);
      // 受擊閃紅；平時保留模型貼圖原本嘅顏色（形態用腳下光環嘅顏色分）
      L.mesh.material.emissive.set(0xff3030);
      L.mesh.material.emissiveIntensity = s.hurt > 0 ? 0.55 : 0;
      aura.visible = !!fc && s.power > 0;
      if (fc) { aura.material.color.copy(fc); const a = size.lead * (0.72 + 0.1 * s.form + 0.04 * Math.sin(s.t * 6)); aura.material.opacity = 0.7; aura.scale.set(a, a, 1); aura.position.set(s.x, 0.012, 0); }
      shadow(s.x, 0, size.lead * 0.55);
      // 槍口閃光：喺管口
      flash.visible = s.muzzle > 0 && s.power > 0;
      if (flash.visible) {
        const look = lookNow(s), r = Math.max(size.lead, 0.42) * (0.2 + 0.008 * Math.min(20, s.salvo ?? 1)) * (0.6 + 0.4 * s.muzzle / 0.06) * (onBeat ? BEAT.flash : 1);
        flash.material.color.copy(look.glowC); flash.scale.set(r, r, 1);
        flash.position.copy(L.muzzle); flash.position.z -= size.lead * 0.07; // 喺管口前面少少，唔好冚住裝置個頭
      }
    }
    // 隊員：企喺隊長後面兩邊（位置由規則嗰邊計：跟隊長左右移動，有少少延遲），同隊長一樣大；各自嘅跑步相位同步速
    for (const id in mateModels) if (mateModels[id]) mateModels[id].root.visible = false;
    for (const m of s.team?.mates ?? []) {
      const Mt = mateModel(m.id);
      if (!Mt || !(s.power > 0)) continue;
      Mt.root.visible = true;
      Mt.mixer.update(dt * 1.25 * (MATE_PHASE[m.id]?.[1] ?? 1));
      Mt.root.scale.setScalar(size.lead / Mt.height);
      Mt.root.position.set(m.x, 0, -m.d);
      Mt.root.rotation.z = close ? 0 : -clamp(s.lean, -CROWD.feel.lean.max, CROWD.feel.lean.max) * 1.2;
      // 揮刀：出刀氣嗰下由舉起揮到向前落，之後慢慢舉返起；出槍嗰隻手輕微後座
      const sw = Mt.cfg.swing, age = 0.5 - m.fireT;
      if (sw && Mt.devices[0]) Mt.devices[0].pitchAdd = m.fireT <= 0 ? 0 : age < sw.time ? (sw.to - sw.from) * (age / sw.time) : age < sw.time + sw.back ? (sw.to - sw.from) * (1 - (age - sw.time) / sw.back) : 0;
      else if (Mt.cfg.recoil === 'first') { if (Mt.devices[0]) Mt.devices[0].pitchAdd = m.fireT > 0.42 ? 12 * (m.fireT - 0.42) / 0.08 : 0; } // 淨係第一件（槍／炮）有後座，盾同無人機唔郁
      else if (Mt.devices.length > 1) for (let n = 0; n < Mt.devices.length; n++) Mt.devices[n].pitchAdd = m.fireT > 0.42 && (m.shot + n) % 2 === 0 ? 14 * (m.fireT - 0.42) / 0.08 : 0;
      placeDevice(Mt);
      shadow(m.x, -m.d, size.lead * 0.5);
    }
    // 榴彈：拋物線（高度跟飛咗幾多成）；光盾：撐緊就喺隊伍前面，擋嗰下閃白放大
    for (let n = 0; n < shellMeshes.length; n++) {
      const sh = s.shells?.[n], g = shellMeshes[n];
      g.visible = !!sh;
      if (sh) { const k = sh.k ?? 0, ht = rosterOf(sh.mate)?.battle?.blast?.height ?? 0.9; g.position.set(sh.x, size.lead * (0.9 * (1 - k) + 0.15 * k) + Math.sin(Math.PI * k) * ht, -sh.d); g.scale.setScalar(1 + 0.25 * Math.sin(s.t * 30)); }
    }
    const gd = s.guard, gOn = !!gd && (gd.up || gd.flash > 0) && s.power > 0;
    guardWall.visible = gOn;
    if (gOn) {
      const f = gd.flash > 0 ? gd.flash / 0.5 : 0, r = 0.95 * (1 + 0.25 * f);
      guardWall.position.set(s.x, size.lead * 0.36, 0.3); guardWall.scale.set(r, size.lead * 0.72, r);
      guardWall.material.opacity = gd.up ? 0.13 + 0.05 * Math.sin(s.t * 5) : 0.6 * f; guardWall.material.color.setHex(f > 0 ? 0xcfe2ff : 0x4a8cff); guardEdge.material.opacity = gd.up ? 0.85 : f;
    }

    // 場上嘅嘢
    let nBrick = 0, nPrize = 0, nWall = 0, nGate = 0, nFrame = 0, nEnemy = 0, nPad = 0;
    const B = COLUMN.bricks, R = COLUMN.barrier, PH = COLUMN.phalanx, RAD = Math.PI / 180;
    const enemies = models.enemies, G = enemies?.cfg, eScale = enemies ? size.enemy * (G.scale ?? 1) / enemies.height : 1;
    if (enemies && !instBase) instBase = new Float32Array(16);
    if (enemies) { // 小敵人：全部同一個朝向同大細，只係位置（同姿勢）唔同，直接寫矩陣
      E.set((G.tilt ?? 0) * RAD, (G.yaw ?? 0) * RAD, 0); Q.setFromEuler(E); M.compose(P.set(0, 0, 0), Q, S.setScalar(eScale)); M.toArray(instBase);
      enemies.counts.fill(0); enemies.lineCounts.fill(0);
    }
    const nPose = enemies?.insts.length ?? 0, poseAt = nPose > 1 ? Math.floor(s.t * (G.fps ?? 8)) : 0, hopK = size.enemy * (G?.hop ?? 0), lineD = G?.outlineD ?? Infinity, eUp = size.enemy * (G?.scale ?? 1) * (G?.offsetY ?? 0);
    let bossSeen = false;
    for (const e of s.ents) {
      if (e.type === 'bricks') {
        const locked = e.lock && e.lock.hp > 0, hw = e.prize ? R.halfWidth * 0.86 : B.halfWidth * 0.9, depth = e.prize ? 0.3 : B.depth, thick = e.prize ? 0.24 : 0.08;
        const color = locked ? C.set(0x9a8f6c) : e.prize ? C.set(0xffc93f) : C.set(0x3fd6a2), mesh = e.prize ? prizes : bricks, cap = e.prize ? V3.maxPrizes : V3.maxBricks;
        for (let i = e.head; i < e.n && (e.prize ? nPrize : nBrick) < cap; i++) {
          const d = e.d + i * e.gap;
          if (d > far) break;
          if (d < W3.despawn) continue;
          const pop = i === e.head && e.pop > 0 ? e.pop / 0.16 : 0;
          put(mesh, e.prize ? nPrize++ : nBrick++, e.x, pop * 0.05, -(d + depth / 2), hw * 2, thick, depth, pop > 0.3 ? C.set(0xffffff) : color, locked ? DIM : pop > 0.3 ? FLASH : WHITE);
          if (pop > 0.3) color.set(locked ? 0x9a8f6c : e.prize ? 0xffc93f : 0x3fd6a2);
        }
      } else if (e.type === 'barrier') {
        if (e.d > far || e.d < W3.despawn || nWall >= V3.maxWalls * 2 - 1) continue;
        const pop = e.pop > 0 ? 1 + 0.06 * e.pop / 0.16 : 1;
        put(walls, nWall++, e.x, 0, -(e.d + 0.07), R.halfWidth * 2, R.height * pop, 0.14, e.hit > 0 ? C.set(0xd5ddf5) : C.set(0x5a668c), e.hit > 0 ? FLASH : WHITE);
        if (!walls.userData.model) setBox(walls, nWall++, e.x, 0.035, -(e.d - 0.012), R.halfWidth * 2.06, 0.07, 0.17, C.set(0xff9f43)); // 腳下警示帶
      } else if (e.type === 'gates') {
        if (e.d > far || e.d < W3.despawn || e.used) continue;
        const n = e.gates.length, h = 0.36;
        for (let i = 0; i < n && nGate < V3.maxGates; i++) {
          const g = e.gates[i], [x0, x1] = gateSegment(n, i), good = isGoodGate(g), shootable = g.op === 'add' || g.op === 'sub';
          const lit = g.hit > 0 || g.flipT > 0, pop = 1 + (g.pop > 0 ? 0.12 * g.pop / CROWD.gate.popTime : 0);
          const base = good ? C.setRGB(0.27, 0.92, 0.67) : C.setRGB(1, 0.35, 0.42);
          if (lit) base.lerp(new THREE.Color(1, 1, 1), 0.55);
          setBox(gates, nGate++, (x0 + x1) / 2, h / 2 * pop, -e.d, (x1 - x0) * 0.97, h * pop, 0.05, base);
          // 框：上面一條、左右兩條柱；射唔郁嘅門（乘除）用深色實框
          const fc = shootable ? (good ? C.setRGB(0.5, 1, 0.8) : C.setRGB(1, 0.55, 0.6)) : C.setRGB(0.12, 0.14, 0.2);
          if (gateFrames.userData.model) put(gateFrames, nFrame++, (x0 + x1) / 2, 0, -e.d, (x1 - x0) * 0.99, (h + 0.03) * pop, 0.07, fc, fc); // 門框模型：成個框一件，染門嘅顏色
          else if (nFrame + 3 <= V3.maxGates * 3) {
            setBox(gateFrames, nFrame++, (x0 + x1) / 2, h * pop + 0.015, -e.d, (x1 - x0) * 0.99, 0.03, 0.07, fc);
            setBox(gateFrames, nFrame++, x0 + 0.012, h / 2 * pop, -e.d, 0.024, h * pop, 0.07, fc);
            setBox(gateFrames, nFrame++, x1 - 0.012, h / 2 * pop, -e.d, 0.024, h * pop, 0.07, fc);
          }
        }
      } else if (e.type === 'hazard') {
        // 危險地帶：一段閃住嘅紅色地面
        if (e.d > far || nGate >= V3.maxGates) continue;
        const d0 = Math.max(e.d, W3.despawn), d1 = Math.min(e.d + e.len, far);
        if (d1 > d0) setBox(gates, nGate++, e.x, 0.014, -(d0 + d1) / 2, 0.6, 0.02, d1 - d0, C.setRGB(1, 0.16 + 0.12 * Math.sin(s.t * 9), 0.2));
      } else if (e.type === 'slow' || e.type === 'boost') {
        // 減速帶：一段藍色地面（慢慢閃）；加速帶：一段金色地面（快閃，踩過就暗）
        if (e.d > far || nGate >= V3.maxGates) continue;
        const d0 = Math.max(e.d, W3.despawn), d1 = Math.min(e.d + e.len, far), k = e.type === 'slow' ? 0.5 + 0.2 * Math.sin(s.t * 3) : e.used ? 0.25 : 0.75 + 0.25 * Math.sin(s.t * 12);
        if (d1 > d0) setBox(gates, nGate++, e.x, 0.014, -(d0 + d1) / 2, 0.6, 0.02, d1 - d0, e.type === 'slow' ? C.setRGB(0.2 * k, 0.5 * k, 1.1 * k) : C.setRGB(1.2 * k, 0.95 * k, 0.25 * k));
      } else if (e.type === 'phalanx' && enemies) {
        // 盾兵方陣：最前面一塊藍色光盾（打爆先傷到後面）
        if (e.shield > 0 && e.left > 0 && e.d < far && nGate < V3.maxGates) {
          let fr = e.rows; for (let c = 0; c < e.cols; c++) if (e.front[c] < fr) fr = e.front[c];
          const fd = e.d + fr * PH.gapD - 0.28, wide = Math.abs(phalanxColX(e.cols, e.cols - 1)) * 2 + 0.16, hot = e.hit > 0 ? 1.6 : 1;
          if (fd > W3.despawn) setBox(gates, nGate++, e.x, 0.2, -fd, wide, 0.4, 0.035, C.setRGB(0.25 * hot, 0.55 * hot, 1.25 * hot));
        }
        if (G.pad > 0 && e.left > 0 && nPad < V3.maxPads) { // 地墊：由最前仲有敵人嗰行鋪到最後一行（遠到睇唔到嗰段唔鋪）
          let front = e.rows;
          for (let c = 0; c < e.cols; c++) if (e.front[c] < front) front = e.front[c];
          const d0 = Math.max(W3.despawn, e.d + (front - 0.6) * PH.gapD), d1 = Math.min(far + 4, e.d + (e.rows - 0.4) * PH.gapD), half = Math.abs(phalanxColX(e.cols, e.cols - 1) - phalanxColX(e.cols, 0)) / 2 + size.enemy * (G.scale ?? 1) * 0.7;
          if (d1 > d0) { M.makeScale(half * 2, 1, d1 - d0); M.setPosition(e.x, 0.006, -(d0 + d1) / 2); pads.setMatrixAt(nPad++, M); }
        }
        for (let r = 0; r < e.rows; r++) {
          const d = e.d + r * PH.gapD;
          if (d > far) break;
          if (d < W3.despawn) continue;
          const row = r * e.cols;
          for (let c = 0; c < e.cols; c++) {
            if (!e.alive[row + c] || nEnemy >= V3.maxEnemies) continue;
            const pose = nPose > 1 ? (poseAt + r * 3 + c * 5) % nPose : 0, eArr = enemies.insts[pose].instanceMatrix.array;
            const o = enemies.counts[pose]++ * 16, hop = hopK ? Math.abs(Math.sin(s.t * 9 + r * 1.7 + c * 0.9)) * hopK : 0;
            eArr.set(instBase, o);
            if (e.elite) for (let q = 0; q < 11; q++) eArr[o + q] *= ELITE.scale; // 精英：大隻啲
            eArr[o + 12] = e.x + phalanxColX(e.cols, c); eArr[o + 13] = hop + eUp; eArr[o + 14] = -d;
            { const col = enemies.insts[pose].instanceColor.array, q = o / 16 * 3, hurt = e.elite && r === e.front[c] && e.wear?.[c] ? 0.25 * e.wear[c] : 0; // 精英：紫色；中咗未倒嗰隻越打越白
              col[q] = e.elite ? ELITE.tint[0] + hurt : 1; col[q + 1] = e.elite ? ELITE.tint[1] + hurt : 1; col[q + 2] = e.elite ? ELITE.tint[2] + hurt : 1; }
            if (d < lineD) { const line = enemies.insts[pose].userData.line; if (line) line.instanceMatrix.array.set(eArr.subarray(o, o + 16), enemies.lineCounts[pose]++ * 16); }
            nEnemy++;
            if (d < 6 && (r + c) % 2 === 0) shadow(e.x + phalanxColX(e.cols, c), -d, size.enemy * (G.scale ?? 1) * 0.9);
          }
        }
      } else if (e.type === 'boss' && models.boss) {
        const Bm = models.boss, k = size.boss * (Bm.cfg.scale ?? 1) * (e.mini ? MINI : 1) / Bm.height, A = Bm.act; // 小首領：同一個模型縮細
        bossSeen = true;
        Bm.root.visible = e.d < BD.fogRange[1];
        Bm.root.scale.setScalar(k * (1 + (e.pop > 0 ? 0.03 * e.pop / 0.16 : 0)));
        // 有行路／受擊動作就用動作；冇就用程式嘅彈跳同震動頂住
        Bm.root.position.set(e.x + (e.hit > 0 && !A.hit ? Math.sin(s.t * 90) * 0.012 : 0), (A.walk ? 0 : Math.abs(Math.sin(s.t * 5)) * size.boss * 0.03) + size.boss * (Bm.cfg.scale ?? 1) * (Bm.cfg.offsetY ?? 0), -e.d);
        Bm.root.rotation.x = (Bm.cfg.tilt ?? 0) * RAD;
        if (e.hit > 0 && A.hit && !A.hit.isRunning()) { A.hit.reset().play(); A.walk?.setEffectiveWeight(0.25); }
        // 受擊閃白；平時用表入面嘅自發光
        Bm.mesh.material.emissive.set(e.hit > 0 ? 0xffffff : (Bm.cfg.glowColor ?? 0xffffff));
        Bm.mesh.material.emissiveIntensity = (Bm.cfg.glow ?? 0) + (e.hit > 0 ? (Bm.mesh.material.emissiveMap ? 0.45 : 0.14) : 0);
        shadow(e.x, -e.d, size.boss * 0.85 * (e.mini ? MINI : 1));
      }
    }
    // 首領出招預告：成條線閃紅（越近砸落嚟閃得越快）
    if (s.boss?.atk && nGate < V3.maxGates) { const a = s.boss.atk, k = 1 - a.t / a.warn; setBox(gates, nGate++, COLUMN.lanes[a.lane], 0.016, -5.5, 0.62, 0.02, 13, C.setRGB(1, 0.04 + 0.26 * (0.5 + 0.5 * Math.sin(s.t * (14 + 30 * k))), 0.1)); }
    if (models.boss) {
      // 首領打低咗：有倒下動作就留喺原地播一次；冇就即刻收起（爆開嘅特效喺上層）
      const Bm = models.boss, dead = !!(s.boss && s.boss.dead && Bm.act.down);
      if (dead && !Bm.down) { Bm.act.walk?.stop(); Bm.act.hit?.stop(); Bm.act.down.reset().play(); }
      if (!dead && Bm.down) { Bm.act.down.stop(); Bm.act.walk?.setEffectiveWeight(1).play(); }
      Bm.down = dead;
      if (dead) Bm.root.visible = true; else if (!bossSeen) Bm.root.visible = false;
      if (Bm.mixer && Bm.root.visible) Bm.mixer.update(dt);
    }
    // 倒低嘅敵人：向後彈飛、打轉、縮細
    if (enemies) {
      for (const f of s.fx) {
        if (f.k !== 'fell' || nEnemy >= V3.maxEnemies) continue;
        const k = f.t / f.life;
        E.set(-1.5 * k, (G.yaw ?? 0) * RAD, (f.vx ?? 0) * 3 * k); Q.setFromEuler(E);
        M.compose(P.set(f.x + (f.vx ?? 0) * f.t * 1.2, size.enemy * (0.2 + 1.6 * k * (1 - k)), -(f.d + 1.4 * f.t)), Q, S.setScalar(eScale * (1 - 0.6 * k)));
        { const q = enemies.counts[0] * 3, col = enemies.insts[0].instanceColor.array; col[q] = col[q + 1] = col[q + 2] = 1; }
        enemies.insts[0].setMatrixAt(enemies.counts[0]++, M); nEnemy++;
      }
      enemies.insts.forEach((inst, i) => { inst.count = enemies.counts[i]; inst.instanceMatrix.needsUpdate = true; inst.instanceColor.needsUpdate = true; const line = inst.userData.line; if (line) { line.count = enemies.lineCounts[i]; line.instanceMatrix.needsUpdate = true; } });
    }

    // 子彈：每個形態一款彈種（data/bullet3d.js），外面再套一層淡色光暈。位置係規則嘅（命中靠佢），畫面只加一兩個像素嘅隨機偏移
    let nBullet = 0;
    for (const k in bulletCore) bulletCount[k] = 0;
    const F = COLUMN.fire, up = COLUMN.camera.bulletUp, mzX = L ? L.muzzle.x - s.x : 0, mzY = L ? L.muzzle.y : size.lead * 0.62, RW = BULLET_3D.rows, JT = BULLET_3D.jitter;
    const fromD = Math.max(F.startD, (L ? -L.muzzle.z : 0) + size.lead * 0.3); // 子彈喺管口前面少少先出現，唔好冚住裝置
    const hot = s.burst?.t > 0 ? 1.55 : 1, hotB = s.burst?.t > 0 ? 1.4 : 1; // 爆發期間：子彈、光束粗啲亮啲
    for (const b of s.bullets) {
      if (b.mate) { // 隊員嘅子彈／刀氣：由佢自己面前直飛，用佢自己嗰款彈種
        const look = mateLooks[b.mk ?? b.mate], core = look && bulletCore[look.shape];
        if (!core || b.d > far + 2 || nBullet >= V3.maxBullets) continue;
        const y = up * 0.55, z = -(b.d - look.len / 2), wd = look.width * (look.shape === 'blade' ? 1 : hot);
        C.copy(look.coreC).lerp(look.glowC, look.mix).multiplyScalar(hotB);
        setBox(core, bulletCount[look.shape]++, b.x, y, z, wd, wd * look.flat, look.len, C);
        setBox(bulletGlow, nBullet++, b.x, y, z, wd * look.halo, wd * look.halo * Math.max(look.flat, 0.5), look.len * look.haloLen, C.copy(look.glowC).multiplyScalar(hotB));
        continue;
      }
      if (b.d < fromD || b.d > far + 2 || nBullet >= V3.maxBullets) continue;
      const armed = b.w !== undefined, look = armed ? weaponLooks[b.w] : bulletLook(b.form);
      // 武器等級嘅子彈：各級速度唔同，唔計「邊一輪」；每粒用自己射出嗰陣嘅偏移做隨機種子（唔會邊飛邊閃）
      const { shot, row } = armed ? NO_SHOT : salvoOf(shots, s.t, b.d, F), sn = shot ? shot.n : 0, beat = !!shot && sn % BEAT.every === 0;
      const seed = armed ? Math.round((b.off ?? 0) * 977) * 13 + b.w * 71 + Math.round((b.x - (b.vx ?? 0) * b.d / (b.speed || 1)) * 211) : sn * 131 + Math.round(b.x * 400) * 17 + row * 7, r1 = hash(seed), r2 = hash(seed + 1.7), r3 = hash(seed + 3.1);
      // 排數越多成輪越粗；同一輪後排細啲；重拍粗啲長啲
      const big = (1 + RW.width * ((shot?.rows ?? 1) - 1)) * (1 - RW.backRow * row) * (beat ? BEAT.width : 1);
      const wid = look.width * big * hot, len = look.len * (beat ? BEAT.len : 1) * (1 + (r1 - 0.5) * 2 * JT.len) * (hot > 1 ? 1.2 : 1);
      // 啱啱出管口：由管口嘅位置（高度同左右；交替出膛嘅彈種再偏左或者偏右）慢慢返去自己條彈道
      const k = Math.max(0, 1 - (b.d - F.startD) / F.muzzleBlend), k2 = k * k, y = up * 0.55 + (mzY - up * 0.55) * k2;
      // 自動分配去第二行嘅子彈（規則位置喺嗰行正前方）：畫面上由槍口斜出去，飛一小段先返入自己條彈道
      const side = armed && !b.vx && !b.homing ? -(b.off ?? 0) : 0;
      const x = b.x + (mzX + side + (look.swing ? (sn % 2 ? 1 : -1) * look.swing * size.lead : 0)) * k2 + (r2 - 0.5) * 2 * JT.x, z = -(b.d - len / 2);
      const core = bulletCore[look.shape], bright = (1 + (r3 - 0.5) * 2 * JT.bright) * hotB;
      C.copy(look.coreC).lerp(look.glowC, look.mix * (beat ? 1 - BEAT.white : 1)).multiplyScalar(bright);
      setBox(core, bulletCount[look.shape]++, x, y, z, wid, wid * look.flat, len, C);
      const gk = look.halo * (1 + RW.halo * ((shot?.rows ?? 1) - 1)) * (1 - 0.45 * k2); // 啱啱出管口嗰段光暈細啲
      setBox(bulletGlow, nBullet, x, y, z, wid * gk, wid * gk * Math.max(look.flat, 0.5), len * look.haloLen, C.copy(look.glowC).multiplyScalar(bright * (beat ? 1.35 : 1)));
      nBullet++;
    }
    for (const k in bulletCore) bulletCore[k].count = bulletCount[k];
    bulletGlow.count = nBullet;

    // 光束（由管口去到命中嗰度）同光柱（落喺命中嗰度）：規則嗰邊每一下放一個短命嘅特效，呢度畫
    let nBeam = 0;
    for (const f of s.fx) {
      if ((f.k !== 'beam' && f.k !== 'pillar') || nBeam + 2 > V3.maxBeams * 2) continue;
      const look = weaponLooks[f.w] ?? weaponLooks[0], k = f.t / f.life, a = (1 - k * k) * hotB, w = Math.max(look.width, 0.02) * hot;
      if (f.k === 'beam') {
        const z0 = L ? Math.min(L.muzzle.z, -F.startD * 0.6) : -F.startD, z1 = -Math.max(f.d, F.startD + 0.1), len = z0 - z1, fx0 = f.x + (L ? (L.muzzle.x - s.x) * 0 : 0);
        const flick = 0.85 + 0.15 * hash(Math.floor(s.t * 40) + f.x * 7);
        // 由槍口（窄嘅光束）或者主角正前方（闊嘅光束）斜去命中嗰點
        const x0 = look.width < 0.2 && L ? L.muzzle.x : fx0, by = up * 0.55 + (mzY - up * 0.55) * 0.25, slant = Math.hypot(fx0 - x0, len);
        E.set(0, Math.atan2(x0 - fx0, len), 0); Q.setFromEuler(E); P.set((x0 + fx0) / 2, by, (z0 + z1) / 2);
        beams.setMatrixAt(nBeam, M.compose(P, Q, S.set(w * look.halo * flick, w * look.halo * look.flat * flick, slant))); beams.setColorAt(nBeam++, C.copy(look.glowC).multiplyScalar(0.55 * a));
        beams.setMatrixAt(nBeam, M.compose(P, Q, S.set(w * 0.45, w * 0.45 * look.flat, slant))); beams.setColorAt(nBeam++, C.copy(look.coreC).multiplyScalar(a));
      } else {
        const h = 3.2, wide = w * (1.5 - 0.9 * k);
        setBox(beams, nBeam++, f.x, h / 2, -f.d, wide * look.halo, h, wide * look.halo, C.copy(look.glowC).multiplyScalar(0.6 * a));
        setBox(beams, nBeam++, f.x, h / 2, -f.d, wide * 0.5, h, wide * 0.5, C.copy(look.coreC).multiplyScalar(a));
      }
    }
    beams.count = nBeam;

    pads.count = nPad; pads.instanceMatrix.needsUpdate = true;
    bricks.count = nBrick; prizes.count = nPrize; walls.count = nWall; gates.count = nGate; gateFrames.count = nFrame; shadows.count = nShadow;
    for (const m of [bricks, prizes, walls, gates, gateFrames, ...bulletMeshes, bulletGlow, beams, shadows]) {
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }

    // 震屏：鏡頭輕微移位
    const c3 = camera3d(view.cam), shake = s.shake > 0 && (opts.screenShake?.() ?? true) ? s.shake * 0.07 : 0;
    camera.position.set(c3.position[0] + (Math.random() * 2 - 1) * shake, c3.position[1] + (Math.random() * 2 - 1) * shake, c3.position[2]);
    camera.rotation.set(-c3.pitch, 0, 0);
    if (close) { // 近鏡（除錯 / 截圖用）：圍住主角望，yaw 0 = 正後方
      const h = size.lead, yaw = (close.yaw ?? 0) * Math.PI / 180, pitch = (close.pitch ?? 30) * Math.PI / 180, dist = (close.dist ?? 2.4) * h;
      const tx = s.x + (close.x ?? 0) * h, ty = (close.y ?? 0.55) * h, tz = -(close.z ?? 0) * h; // 望住邊：x 向人物右邊、y 離地、z 向前（× 身高）
      camera.position.set(tx + Math.sin(yaw) * Math.cos(pitch) * dist, ty + Math.sin(pitch) * dist, tz + Math.cos(yaw) * Math.cos(pitch) * dist);
      camera.lookAt(tx, ty, tz);
    }
    gl.render(scene, camera);
  }

  /**
   * 命中反饋按目標分（純畫面；規則只係喺命中嗰度放一個 spark 或者 fell，連埋打中乜）：
   *   小敵人  幾粒深紅碎片向外飛（倒飛嘅敵人本身喺 3D 嗰層）；光矛再加一個環形閃光
   *   路障    板面一撮向上散開嘅火花（數字跳動喺上面畫數字嗰度）
   *   門      門板上一道橫向白光（門板本身亦會亮一下）
   *   首領    一個擴開嘅衝擊圈加白芯
   *   磚      一個細嘅青綠圈
   * 其餘（爆開、大圈、飄字）用返 2D 版嘅畫法。
   */
  const fxRest = [];
  function drawHits(s) {
    const { u, cam } = view, look = lookNow(s), glow = look.glow, R = COLUMN.barrier;
    fxRest.length = 0;
    let shards = 0;
    ctx.lineCap = 'round';
    for (const f of s.fx) {
      const k = f.t / f.life, a = 1 - k;
      if (f.k === 'fell') {
        if (++shards > 28) continue; // 光束類武器一秒倒過百隻：碎片最多畫 28 組（上層畫布逐個畫，慢機會食力），倒飛嘅敵人照舊喺 3D 嗰層
        const p = cam.project(f.x, f.d, size.enemy * 0.3), sz = Math.max(1.5, 3.2 * u * p.s) * (1 - 0.5 * k), far2 = (5 + 20 * k) * u * p.s;
        ctx.fillStyle = `rgba(214,36,62,${a})`;
        for (let i = 0; i < 4; i++) { const ang = i * 1.571 + f.x * 37 + f.d * 11; ctx.fillRect(p.x + Math.cos(ang) * far2 - sz / 2, p.y + Math.sin(ang) * far2 * 0.7 - 10 * u * p.s * Math.sin(k * 3.14) - sz / 2, sz, sz); }
        if (look.ring && k < 0.6) { ctx.strokeStyle = `rgba(${glow},${0.9 * (1 - k / 0.6)})`; ctx.lineWidth = Math.max(1, 2 * u * p.s); ctx.beginPath(); ctx.ellipse(p.x, p.y, (4 + 26 * k) * u * p.s, (3 + 18 * k) * u * p.s, 0, 0, 7); ctx.stroke(); }
      } else if (f.k === 'spark' && f.on === 'barrier') {
        const p = cam.project(f.x, f.d, R.height * 0.45);
        ctx.strokeStyle = `rgba(255,${200 + 55 * a | 0},${120 + 120 * a | 0},${a})`; ctx.lineWidth = Math.max(1, 2 * u * p.s);
        ctx.beginPath();
        for (let i = 0; i < 5; i++) { const ang = -1.571 + (i - 2) * 0.55 + (hash(f.x * 91 + i) - 0.5) * 0.4, r0 = (3 + 8 * k) * u * p.s, r1 = (7 + 22 * k) * u * p.s; ctx.moveTo(p.x + Math.cos(ang) * r0, p.y + Math.sin(ang) * r0); ctx.lineTo(p.x + Math.cos(ang) * r1, p.y + Math.sin(ang) * r1); }
        ctx.stroke();
        ctx.fillStyle = `rgba(255,255,255,${a * a})`; ctx.beginPath(); ctx.arc(p.x, p.y, 4 * u * p.s, 0, 7); ctx.fill();
      } else if (f.k === 'spark' && f.on === 'gates') {
        const p = cam.project(f.x, f.d, 0.2), w = (8 + 34 * k) * u * p.s;
        ctx.fillStyle = `rgba(255,255,255,${0.9 * a})`; ctx.fillRect(p.x - w / 2, p.y - 1.5 * u * p.s, w, 3 * u * p.s);
        ctx.fillStyle = `rgba(${glow},${0.8 * a})`; ctx.fillRect(p.x - 1.5 * u * p.s, p.y - w * 0.3, 3 * u * p.s, w * 0.6);
      } else if (f.k === 'spark' && f.on === 'boss') {
        const p = cam.project(f.x, f.d, size.boss * (SCENE_3D.boss.scale ?? 1) * 0.35), r = (8 + 30 * k) * u * p.s;
        ctx.strokeStyle = `rgba(${glow},${a})`; ctx.lineWidth = Math.max(1.5, 3.5 * u * p.s * a);
        ctx.beginPath(); ctx.ellipse(p.x, p.y, r, r * 0.8, 0, 0, 7); ctx.stroke();
        ctx.fillStyle = `rgba(255,255,255,${a * a})`; ctx.beginPath(); ctx.arc(p.x, p.y, 6 * u * p.s * a, 0, 7); ctx.fill();
      } else if (f.k === 'spark' && f.on === 'bricks') {
        const p = cam.project(f.x, f.d, 0.1), r = (4 + 12 * k) * u * p.s;
        ctx.strokeStyle = `rgba(${GOOD},${a})`; ctx.lineWidth = Math.max(1, 2 * u * p.s);
        ctx.beginPath(); ctx.ellipse(p.x, p.y, r, r * 0.7, 0, 0, 7); ctx.stroke();
      } else if (f.k === 'zap') {
        // 連鎖閃電：由命中嗰度逐點跳去隔離嘅敵人，每段中間折一折
        const g2 = (weaponLooks[f.w] ?? look).glow;
        let p0 = cam.project(f.x, f.d, size.enemy * 0.35);
        ctx.lineJoin = 'round';
        for (let pass = 0; pass < 2; pass++) {
          ctx.strokeStyle = pass ? `rgba(255,255,255,${a})` : `rgba(${g2},${0.75 * a})`; ctx.lineWidth = (pass ? 1.2 : 3.4) * u;
          ctx.beginPath(); let q = p0; ctx.moveTo(q.x, q.y);
          f.pts.forEach(([x, d], i) => { const p = cam.project(x, d, size.enemy * 0.35), j = (hash(x * 53 + d * 17 + i + Math.floor(s.t * 30)) - 0.5) * 12 * u; ctx.lineTo((q.x + p.x) / 2 + j, (q.y + p.y) / 2 - Math.abs(j)); ctx.lineTo(p.x, p.y); q = p; });
          ctx.stroke();
        }
      } else if (f.k === 'beam') {
        // 光束打中嗰點：一粒閃光（光束本身喺 3D 嗰層）
        if (f.d < 11.5) { const p = cam.project(f.x, f.d, 0.14), g2 = (weaponLooks[f.w] ?? look), r = Math.max(4, (g2.width * 60 + 5) * u * p.s) * (0.7 + 0.5 * hash(f.x * 31 + Math.floor(s.t * 30)));
          ctx.fillStyle = `rgba(255,255,255,${0.7 * a})`; ctx.beginPath(); ctx.arc(p.x, p.y, r * 0.5, 0, 7); ctx.fill();
          ctx.fillStyle = `rgba(${g2.glow},${0.45 * a})`; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 7); ctx.fill(); }
      } else if (f.k === 'pillar') {
        // 光柱落地：一個擴開嘅光圈（光柱本身喺 3D 嗰層）
        const p = cam.project(f.x, f.d, 0), r = (10 + 30 * k) * u * p.s;
        ctx.strokeStyle = `rgba(${(weaponLooks[f.w] ?? look).glow},${a})`; ctx.lineWidth = Math.max(1.5, 3 * u * p.s * a);
        ctx.beginPath(); ctx.ellipse(p.x, p.y, r, r * 0.6, 0, 0, 7); ctx.stroke();
      } else fxRest.push(f);
    }
    const rest = Object.create(s); rest.fx = fxRest;
    drawFx(ctx, view, rest);
  }

  // ---------- 上面嗰層：數字、牌仔、特效、介面（2D，同一個鏡頭） ----------
  function drawOverlay(s) {
    const { W, H, u, cam, dpr } = view, far = V3.far;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const fade = (d) => clamp((cam.topDistance + 0.6 - d) / 1.2, 0, 1);
    const tag = (txt, x, y, sz, color, sub) => {
      setFont(ctx, sz, 800);
      const w1 = ctx.measureText(txt).width; let w2 = 0;
      if (sub) { setFont(ctx, sz * 0.72, 700); w2 = ctx.measureText(sub).width + sz * 0.14; }
      const pw = w1 + w2 + sz * 0.9;
      slantPanel(ctx, x - pw / 2, y - sz * 0.62, pw, sz * 1.2, sz * 0.2, 'rgba(14,18,32,.86)', color);
      setFont(ctx, sz, 800); ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillStyle = color; ctx.fillText(txt, x - pw / 2 + sz * 0.42, y);
      if (sub) { setFont(ctx, sz * 0.72, 700); ctx.fillStyle = '#fff'; ctx.fillText(sub, x - pw / 2 + sz * 0.56 + w1, y + sz * 0.05); }
    };
    const R = COLUMN.barrier, PH = COLUMN.phalanx, done = s.phase === 'defeat' || s.phase === 'clear';
    const sorted = s.ents.slice().sort((a, b) => b.d - a.d);
    for (const e of sorted) {
      if (e.d > far) continue;
      if (e.type === 'bricks') {
        const locked = e.lock && e.lock.hp > 0, hd = e.d + e.head * e.gap;
        if (e.head >= e.n || hd > far) continue;
        ctx.globalAlpha = fade(hd);
        if (e.prize) {
          for (let i = e.n - 1; i >= e.head; i--) { // 大獎磚：每塊面上寫數
            const d = e.d + i * e.gap, p = cam.project(e.x, d + 0.15, 0.25), sz = clamp(24 * u * p.s, 10 * u, 22 * u);
            if (d < far) label(ctx, `+${formatNumber(e.val)}`, p.x, p.y, sz, locked ? '#d9d2bd' : '#fff');
          }
        } else {
          const p = cam.project(e.x, Math.max(hd, 0.2), 0.42), sz = clamp(20 * u * p.s * 1.25, 11 * u, 21 * u);
          tag(`+${formatNumber(e.val)}`, p.x, p.y, sz, `rgb(${GOOD})`, `×${e.n - e.head}`);
        }
      } else if (e.type === 'barrier') {
        if (e.d < COLUMN.world.despawn) continue;
        const p = cam.project(e.x, e.d, R.height * 0.5), w = R.halfWidth * cam.unit * p.s, txt = formatNumber(Math.max(0, Math.ceil(e.hp)));
        const pop = 1 + (e.pop > 0 ? 0.22 * e.pop / 0.16 : 0), sz = Math.max(11 * u, Math.min(R.height * cam.unit * p.s * 0.55, (w * 2) / (txt.length * 0.62))) * pop;
        ctx.globalAlpha = fade(e.d);
        label(ctx, txt, p.x, p.y, sz, e.hit > 0 ? '#fff' : '#ffd9a8');
      } else if (e.type === 'gates') {
        if (e.used || e.d < COLUMN.world.despawn) continue;
        const n = e.gates.length;
        ctx.globalAlpha = fade(e.d);
        for (let i = 0; i < n; i++) {
          const g = e.gates[i], [x0, x1] = gateSegment(n, i), p = cam.project((x0 + x1) / 2, e.d, 0.18), w = (x1 - x0) * cam.unit * p.s, h = 0.36 * cam.unit * p.s * 0.8;
          const txt = gateLabel(g) + (g.decay > 0 && g.op === 'add' && g.val > 0 ? '↓' : ''), fit = w * 1.5 / Math.max(3, txt.length), pop = 1 + (g.pop > 0 ? 0.35 * g.pop / CROWD.gate.popTime : 0) + (g.flipT > 0 ? 0.3 * g.flipT / CROWD.gate.flipTime : 0);
          label(ctx, txt, p.x, p.y, Math.max(9 * u, Math.min(Math.min(h * 0.9, w * 0.42, fit) * pop, fit * 1.12)), '#fff');
        }
      } else if (e.type === 'phalanx') {
        if (e.left <= 0) continue;
        let front = Infinity;
        for (let c = 0; c < e.cols; c++) if (e.front[c] < e.rows) front = Math.min(front, e.front[c]);
        const fd = e.d + (front === Infinity ? 0 : front) * PH.gapD;
        if (fd > far) continue;
        const p = cam.project(e.x, Math.max(0.3, fd), 0.5), sz = clamp(18 * u * p.s * 1.3, 11 * u, 19 * u);
        ctx.globalAlpha = fade(fd);
        tag(String(e.left), p.x, p.y, sz, `rgb(${BAD})`);
        if (e.shield > 0) tag(formatNumber(Math.ceil(e.shield)), p.x, p.y - sz * 1.5, sz, '#7fb4ff', COLUMN_TEXT.shieldTag);
      } else if (e.type === 'hazard') {
        if (e.d + e.len < 0.2 || e.d > far) continue;
        const p = cam.project(e.x, Math.max(e.d, 0.4), 0.05), sz = clamp(16 * u * p.s * 1.2, 10 * u, 17 * u);
        ctx.globalAlpha = fade(e.d);
        tag(COLUMN_TEXT.hazard, p.x, p.y, sz, COLORS.red);
      } else if (e.type === 'slow' || (e.type === 'boost' && !e.used)) {
        if (e.d + e.len < 0.2 || e.d > far) continue;
        const p = cam.project(e.x, Math.max(e.d, 0.4), 0.05), sz = clamp(16 * u * p.s * 1.2, 10 * u, 17 * u);
        ctx.globalAlpha = fade(e.d);
        tag(e.type === 'slow' ? COLUMN_TEXT.slowZone : COLUMN_TEXT.boostZone, p.x, p.y, sz, e.type === 'slow' ? '#7fb4ff' : COLORS.gold);
      } else if (e.type === 'boss' && !done) {
        const p = cam.project(e.x, e.d, size.boss * Math.max(0.9, (SCENE_3D.boss.scale ?? 1) * 1.5) * (e.mini ? MINI : 1)), txt = formatNumber(Math.max(0, Math.ceil(e.hp)));
        const pop = 1 + (e.pop > 0 ? 0.2 * e.pop / 0.16 : 0), fs = Math.max(15 * u, 0.3 * H * 0.26 * p.s) * pop, y = Math.max(fs * 1.2 + 44 * u, p.y);
        ctx.globalAlpha = fade(e.d - 1.5);
        setFont(ctx, fs, 800);
        const pw = ctx.measureText(txt).width + fs * 0.8;
        slantPanel(ctx, p.x - pw / 2, y - fs * 0.62, pw, fs * 1.2, fs * 0.2, 'rgba(14,18,32,.9)', e.hit > 0 ? '#fff' : COLORS.red);
        label(ctx, txt, p.x, y, fs, e.hit > 0 ? '#fff' : COLORS.red);
      }
    }
    ctx.globalAlpha = 1;
    if (s.boss?.atk && !done) { const p = cam.project(COLUMN.lanes[s.boss.atk.lane], 1.6, 0.05); tag(COLUMN_TEXT.slam, p.x, p.y, 20 * u, COLORS.red); }
    drawHits(s);
    // 戰力牌：同 2D 版一樣喺頭頂上面；3D 模型個頭近鏡頭啲、裝置喺頭嘅右邊伸出嚟，所以再推高、向左移少少，唔好疊住個人同裝置
    // 戰力數字：收穫／損失嗰一刻即刻到位（唔滾動——使用者話似「冇打到嘢都加數值」），drawCount 自己有一下放大回彈
    ctx.save(); ctx.translate(view.tagShift[0], view.tagShift[1]); drawCount(ctx, view, s, { still: false }); ctx.restore();
    if (s.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${Math.min(0.5, s.flash * 1.6)})`; ctx.fillRect(0, 0, W, H); }
    if (s.evoT > 0) { ctx.fillStyle = `rgba(${formOf(s.form).color ?? '255,255,255'},${0.22 * s.evoT / CROWD.evolution.showTime})`; ctx.fillRect(0, 0, W, H); }
    // 武器升級：主角上面一塊細橫額寫新武器個名，約一秒淡出（進化先係大事件，呢個唔停頓、唔搶戲）
    if (s.weaponUp && s.phase !== 'clear' && s.phase !== 'defeat') {
      const wl = weaponLooks[s.weaponUp.level], k = s.weaponUp.t / 1.4, txt = COLUMN_TEXT.weaponUp(WEAPONS[s.weaponUp.level].name), fs = 17 * u * (1 + 0.25 * Math.max(0, k - 0.8) / 0.2);
      const p = cam.project(s.x, 0, size.lead), y = p.y - 132 * u - 10 * u * (1 - k); // 喺戰力牌同佢上面嗰行細字之上，唔好冚住個數
      ctx.globalAlpha = Math.min(1, k * 3);
      setFont(ctx, fs, 800);
      const pw = ctx.measureText(txt).width + fs * 1.2, px = clamp(p.x, pw / 2 + 8 * u, W - pw / 2 - 8 * u);
      slantPanel(ctx, px - pw / 2, y - fs * 0.75, pw, fs * 1.5, fs * 0.3, 'rgba(14,18,32,.9)', `rgb(${wl.glow})`);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = `rgb(${wl.core})`; ctx.fillText(txt, px, y);
      ctx.globalAlpha = 1;
    }
    warmCutin();
    drawCutin(ctx, view, s, overlayAssets);
    // 爆發技：發動嗰刻插入隊長而家形態嘅特寫（同進化用同一條斜帶），帶上面寫技能名；之後成段爆發時間畫面邊有一圈金光，上面一條倒數
    const bu = s.burst, BC = burstOf(bu);
    if (bu?.cut > 0) {
      // 單人：隊長一段。完整爆發：起、承、決三個人逐個出（每人一段），最後先係隊長
      const T = CROWD.evolution.showTime, all = 1 - bu.cut / BC.cutTime, order = bu.full && bu.order ? bu.order : [null], seg = Math.min(order.length - 1, Math.floor(all * order.length)), k = all * order.length - seg;
      const who = order[seg] ? rosterOf(order[seg]) : ROSTER.find((r) => r.leader), slide = Math.min(1, k / 0.15), out = Math.max(0, (k - 0.8) / 0.2);
      ctx.fillStyle = `rgba(8,10,20,${0.35 * (seg === order.length - 1 ? 1 - out : 1)})`; ctx.fillRect(0, 0, W, H);
      const bh = Math.min(H * 0.32, W * 0.667), y0 = H * 0.07;
      if (who.leader) drawCutin(ctx, view, { evoT: T * (1 - k), form: s.form }, overlayAssets);
      else {
        // 隊員：立繪裁頭同膊頭嗰截，放入同一條斜帶（主題色邊）
        const im = mateImgs[who.id];
        ctx.save(); ctx.globalAlpha = 1 - out; ctx.translate((1 - slide) ** 2 * W, 0);
        ctx.beginPath(); ctx.moveTo(0, y0 + bh * 0.1); ctx.lineTo(W, y0); ctx.lineTo(W, y0 + bh * 0.9); ctx.lineTo(0, y0 + bh); ctx.closePath();
        const g = ctx.createLinearGradient(0, y0, W, y0 + bh); g.addColorStop(0, 'rgba(14,18,32,.95)'); g.addColorStop(1, `rgba(${who.color},.45)`);
        ctx.fillStyle = 'rgba(14,18,32,.95)'; ctx.fill(); ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = `rgb(${who.color})`; ctx.lineWidth = 2 * u; ctx.stroke(); ctx.clip();
        if (im?.complete && im.naturalWidth) { const sh = im.naturalHeight * (who.cutin?.[1] ?? 0.3), sy = im.naturalHeight * (who.cutin?.[0] ?? 0.012), sc = Math.max(W * 0.62 / im.naturalWidth, bh / sh); ctx.drawImage(im, 0, sy, im.naturalWidth, sh, W * 0.62 - im.naturalWidth * sc / 2, y0, im.naturalWidth * sc, sh * sc); }
        ctx.restore();
      }
      const label = bu.full ? `${CHAIN_STAGES[who.chain].label} · ${who.leader ? `完整爆發 ${who.burst.name}` : who.burst.name.replace(/^.* · /, '')}` : `爆發技 · ${who.burst.name}`, y = y0 + bh * 0.8;
      ctx.save(); ctx.globalAlpha = 1 - out; ctx.translate((1 - slide) ** 2 * -W * 0.6, 0);
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.lineJoin = 'round';
      ctx.font = `italic 800 ${11 * u}px sans-serif`; ctx.fillStyle = '#6ff2e6'; ctx.fillText(bu.full ? `C H A I N  ${seg + 1} / ${order.length}` : 'B U R S T', 14 * u, y - 26 * u);
      ctx.font = `italic 900 ${24 * u}px "Noto Sans TC","PingFang TC","Microsoft JhengHei",sans-serif`;
      ctx.lineWidth = 5 * u; ctx.strokeStyle = 'rgba(8,10,20,.9)'; ctx.strokeText(label, 14 * u, y); ctx.fillStyle = '#fff'; ctx.fillText(label, 14 * u, y);
      ctx.restore();
    } else if (bu?.t > 0) {
      const k = bu.t / BC.time, a = (bu.full ? 0.4 : 0.3) + 0.12 * Math.sin(s.t * 11), g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.42, W / 2, H / 2, Math.hypot(W, H) * 0.56);
      g.addColorStop(0, 'rgba(255,214,102,0)'); g.addColorStop(1, `rgba(255,190,70,${a})`);
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      if (!opts.domHud) { // 爆發剩低幾耐：有網頁版戰鬥介面就由佢畫
      const bw = W * 0.5, bx = (W - bw) / 2, by = H * 0.118;
      ctx.fillStyle = 'rgba(14,18,32,.7)'; ctx.fillRect(bx, by, bw, 5 * u);
      ctx.fillStyle = k < 0.25 ? '#ff8a5a' : '#ffd24a'; ctx.fillRect(bx, by, bw * k, 5 * u);
      ctx.font = `italic 900 ${11 * u}px "Noto Sans TC","PingFang TC","Microsoft JhengHei",sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; ctx.fillStyle = '#ffd24a';
      ctx.fillText(`${bu.full ? '接力爆發' : '爆發中'} ×${BC.mul}`, W / 2, by - 2 * u);
      }
    }
    drawHud(ctx, view, s, !!opts.domHud);
    if (!opts.domHud) drawSalvoTag(ctx, view, s);
    drawResult(ctx, view, s);
    if (opts.showFps) { // ?fps=1：左下角顯示即時更新率、最近 5 秒最慢嗰格、而家嘅像素比
      const m = meter.read(), txt = `${Math.round(m.fps)} fps · 最慢 ${m.worstMs.toFixed(0)} ms · ×${view.glRatio}`;
      setFont(ctx, 13 * u, 700); ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      const tw = ctx.measureText(txt).width;
      ctx.fillStyle = 'rgba(8,10,18,.72)'; ctx.fillRect(6 * u, H - 30 * u, tw + 14 * u, 22 * u);
      ctx.fillStyle = m.fps >= 55 ? '#7dffb0' : m.fps >= 45 ? '#ffe27a' : '#ff8a8a'; ctx.fillText(txt, 13 * u, H - 19 * u);
    }
  }

  function draw(state) {
    const t0 = globalThis.performance.now(), gap = lastDraw ? t0 - lastDraw : 0;
    lastDraw = t0; started = true;
    if (!globalThis.document?.hidden) { // 分頁收埋嗰陣瀏覽器會自己慢落嚟，唔入數
      meter.frame(gap);
      if (!opts.pixelRatio && guard.frame(gap)) { resize(); console.info(`3D 畫質降一級：像素比上限 ${V3.pixelRatios[guard.level]}`); }
    }
    drawScene(state);
    if (close) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height); } // 近鏡：數字同介面對唔返位，唔畫
    else drawOverlay(state);
    const ms = globalThis.performance.now() - t0;
    perf.sum += ms; perf.n++; if (ms > perf.max) perf.max = ms;
  }

  function takePerf() {
    const out = { frames: perf.n, avgMs: perf.n ? +(perf.sum / perf.n).toFixed(3) : 0, maxMs: +perf.max.toFixed(3) };
    perf.sum = 0; perf.n = 0; perf.max = 0;
    return out;
  }

  return {
    draw, resize, view, takePerf, ready, allReady,
    /** 第一批模型落咗幾多（載入畫面用）：done / total = 幾多個檔，fraction = 照大細計嘅 0 至 1 */
    loadState: () => ({ done: firstFiles.filter((f) => progress.get(f).done).length, total: firstFiles.length, fraction: loadFraction() }),
    /** 近鏡睇主角（除錯 / 截圖用）：closeup({ yaw, pitch, dist, x, y, z })，dist 係身高嘅倍數，x/y/z = 望住邊（人物右邊、離地、向前；× 身高）；closeup(null) 返去正常鏡頭 */
    closeup: (o) => { close = o || null; },
    /** 模型面數同有冇減面；renderer = 上一格 WebGL 畫咗幾多個三角形、幾多次繪圖指令 */
    report: () => ({
      models: models.report, backdrop: BD.name, leadLoadMs, startMs, loadFraction: +loadFraction().toFixed(3),
      // 而家嘅更新率（最近 1 秒）、最近 5 秒最慢嗰格、畫質級數同 WebGL 層嘅像素比
      hero: HERO, fps: meter.read(), quality: { level: guard.level, pixelRatio: view.glRatio },
      // 主角頭頂到靴底而家喺畫面佔幾高（應該約 0.11，同 2D 版一樣）同腳底喺畫面高度邊度
      leadScreen: models.lead ? { body: +((view.cam.project(0, 0).y - view.cam.project(0, 0, size.lead).y) / view.H).toFixed(4), feetY: +(view.cam.project(0, 0).y / view.H).toFixed(4), worldHeight: +size.lead.toFixed(3), modelHeight: +models.lead.height.toFixed(3), form: models.lead.report.file, handGap: models.lead.gap.map((v) => +v.toFixed(3)), muzzle: models.lead.muzzle.toArray().map((v) => +v.toFixed(3)) } : null, triangles: gl.info.render.triangles, calls: gl.info.render.calls,
      // 編譯唔到嘅著色器（正常應該係空）
      badPrograms: (gl.info.programs ?? []).filter((p) => p.diagnostics && !p.diagnostics.runnable).map((p) => `${p.name}: ${p.diagnostics.programLog} ${p.diagnostics.vertexShader?.log ?? ''} ${p.diagnostics.fragmentShader?.log ?? ''}`.slice(0, 600)),
      programs: (gl.info.programs ?? []).length,
    }),
    /** 等顯示卡真係畫完（量時間用）：讀返一粒像素，逼顯示卡做晒排住嘅嘢先返。 */
    finish: () => { const g = gl.getContext(); g.finish(); g.readPixels(0, 0, 1, 1, g.RGBA, g.UNSIGNED_BYTE, new Uint8Array(4)); },
  };
}
