// 十關版嘅關外畫面：標題、大廳、隊員頁、角色詳情、編隊、新隊員加入、關卡地圖（連關卡簡介）、結算、基地（永久升級）、第 1 關嘅引導提示；
// 另外有戰鬥中畫面下方嗰排五個頭像位（爆發槽，撳隊長頭像放爆發技）。
// 用網頁元素疊喺戰鬥畫布上面（同畫布一樣大細、一樣位置），唔掂戰鬥嘅畫法。資料全部由外面傳入；撳掣就叫返外面畀嘅函式。

import { formatNumber } from '../core/format.js';
import { FEATURES, STAGE_COUNT, STAGES, UPGRADES, UPGRADE_KEYS, stageAdds, stageNews, upgradeCost } from '../data/campaign.js';
import { CHAIN_STAGES, LOBBY_SIDE, LOBBY_TABS, MAX_MATES, ROSTER, ROSTER_SLOTS, battleSlots, chainOrder, rosterOf } from '../data/characters.js';
import { COLUMN } from '../data/column.js';
import { CROWD } from '../data/crowd.js';
import { WEAPONS } from '../data/weapons.js';
import { faceId, joinedIds, nextStage, playerLevel, seenOf, squadMates, stageStars, stageUnlocked, totalStars } from './progress.js';

const CSS = `
#meta{position:absolute;top:0;left:50%;transform:translateX(-50%);height:100%;aspect-ratio:9/16;max-width:100%;z-index:5;font-family:"Noto Sans TC","PingFang TC","Microsoft JhengHei",sans-serif;color:#eef2ff;user-select:none;-webkit-user-select:none;touch-action:manipulation;container-type:size}
#meta[hidden]{display:none}
#meta *{box-sizing:border-box}
#meta .scr{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;padding:5cqh 6cqw;background:linear-gradient(180deg,#141a33 0%,#1d2242 55%,#3a2a44 100%)}
#meta .scr.glass{background:rgba(10,13,26,.72);backdrop-filter:blur(2px)}
#meta h1{margin:14cqh 0 0;font-size:11cqw;font-weight:900;font-style:italic;letter-spacing:.04em;text-shadow:0 .6cqw 0 #0b0e1c}
#meta h2{margin:0 0 2cqh;font-size:6.4cqw;font-weight:900;font-style:italic}
#meta .sub{font-size:3.6cqw;font-weight:700;color:#6ff2e6;letter-spacing:.3em;margin-top:1cqh}
#meta button{font:inherit;color:inherit;border:0;cursor:pointer;background:#232a4d;padding:2.2cqh 6cqw;font-size:4.6cqw;font-weight:800;font-style:italic;clip-path:polygon(4% 0,100% 0,96% 100%,0 100%);min-width:44cqw}
#meta button.go{background:#2fd3a0;color:#08221b}
#meta button.warn{background:#ff5a6a;color:#2a070c}
#meta button:disabled{opacity:.4;cursor:default}
#meta button.small{min-width:0;padding:1.4cqh 4cqw;font-size:3.8cqw}
#meta .row{display:flex;gap:3cqw;align-items:center;justify-content:center;flex-wrap:wrap}
#meta .top{width:100%;display:flex;justify-content:space-between;align-items:center;margin-bottom:1.5cqh}
#meta .gold{font-size:4.6cqw;font-weight:900;color:#ffd24a}
#meta .gold::before{content:"●";margin-right:1.2cqw}
#meta .map{position:relative;flex:1;width:100%;margin:1cqh 0}
#meta .map svg{position:absolute;inset:0;width:100%;height:100%}
#meta .node{position:absolute;width:15cqw;height:15cqw;margin:-7.5cqw 0 0 -7.5cqw;border-radius:50%;background:#2a3157;border:.8cqw solid #4b5488;display:flex;flex-direction:column;align-items:center;justify-content:center;font-weight:900;font-size:5cqw;font-style:italic;cursor:pointer}
#meta .node small{font-size:2.6cqw;color:#ffd24a;letter-spacing:.1em;font-style:normal;height:2.8cqw}
#meta .node.done{background:#1f6f5c;border-color:#2fd3a0}
#meta .node.next{background:#b6791a;border-color:#ffd24a;animation:metaPulse 1.1s infinite}
#meta .node.lock{opacity:.45;cursor:default}
@keyframes metaPulse{50%{transform:scale(1.1)}}
#meta .card{width:100%;background:rgba(14,18,32,.94);border:.5cqw solid rgba(255,255,255,.22);padding:2.4cqh 5cqw;clip-path:polygon(3% 0,100% 0,97% 100%,0 100%)}
#meta .card p{margin:.8cqh 0;font-size:3.7cqw;line-height:1.5}
#meta .card .new{color:#ffd24a;font-weight:800}
#meta .lines{width:100%;font-size:3.8cqw}
#meta .lines div{display:flex;justify-content:space-between;padding:.7cqh 0;border-bottom:.3cqw solid rgba(255,255,255,.1)}
#meta .lines .sum{font-weight:900;color:#ffd24a;border:0;font-size:4.6cqw}
#meta .stars{font-size:11cqw;letter-spacing:.1em;color:#ffd24a;margin:1cqh 0}
#meta .stars i,#meta h2 i{color:#3a4064;font-style:normal}
#meta h2 .st{color:#ffd24a;font-style:normal;margin-left:2cqw}
#meta .up{width:100%;margin-bottom:1.6cqh}
#meta .up b{font-size:4.4cqw}
#meta .up span{display:block;font-size:3.3cqw;color:#b9c2e6;margin:.4cqh 0}
#meta .up .buy{display:flex;justify-content:space-between;align-items:center;margin-top:.8cqh}
#meta .hint{position:absolute;left:8cqw;right:8cqw;top:30cqh;text-align:center;font-size:4.6cqw;font-weight:900;font-style:italic;padding:1.6cqh 3cqw;background:rgba(14,18,32,.88);border:.5cqw solid #6ff2e6;clip-path:polygon(3% 0,100% 0,97% 100%,0 100%);pointer-events:none;transition:opacity .3s}
#meta.pass{pointer-events:none;background:none}
#meta .set{width:100%;display:flex;justify-content:space-between;align-items:center;font-size:4.2cqw;font-weight:800;padding:1.6cqh 0}
#meta .set input[type=range]{width:52cqw;accent-color:#2fd3a0}
#meta .grid{display:grid;grid-template-columns:1fr 1fr;gap:1.2cqh 2cqw;width:100%;overflow:auto}
#meta .grid button{min-width:0;padding:1.2cqh 1cqw;font-size:3.2cqw;clip-path:none}
#metaHud{position:absolute;top:0;left:50%;transform:translateX(-50%);height:100%;aspect-ratio:9/16;max-width:100%;z-index:4;pointer-events:none;container-type:size}
#metaPause{position:absolute;top:6.2cqh;right:3cqw;pointer-events:auto;width:11cqw;height:4.6cqh;border:0;background:rgba(14,18,32,.82);color:#fff;font:900 4cqw sans-serif;cursor:pointer;clip-path:polygon(12% 0,100% 0,88% 100%,0 100%)}
#metaPause[hidden]{display:none}
#meta .scr.tabbed{padding-bottom:11.5cqh}
#meta .scr.lobby{padding:0;overflow:hidden;background:linear-gradient(180deg,#141a36 0%,#2b2349 30%,#74405a 52%,#e08a5c 66%,#f3b06f 70%,#241a2b 70.2%,#120f1c 100%)}
#meta .lobby svg.sky{position:absolute;left:0;right:0;bottom:29.8cqh;width:100%;height:38cqh}
#meta .ltop{position:absolute;top:2.2cqh;left:4cqw;right:4cqw;display:flex;justify-content:space-between;align-items:center;gap:2cqw;z-index:2}
#meta .chip{background:rgba(14,18,32,.82);border:.4cqw solid rgba(255,255,255,.2);padding:.9cqh 3cqw;font-size:3.4cqw;font-weight:800;border-radius:1.6cqw}
#meta .chip.gold{font-size:3.8cqw}
#meta .lside{position:absolute;right:3cqw;top:13cqh;display:flex;flex-direction:column;gap:1.6cqh;z-index:2}
#meta button.sq{min-width:0;width:13cqw;height:13cqw;padding:0;font-size:3cqw;line-height:1.25;clip-path:none;border-radius:2.4cqw;border:.4cqw solid rgba(255,255,255,.18);background:rgba(14,18,32,.8);font-style:normal;white-space:pre-line}
#meta .hero{position:absolute;left:-7cqw;bottom:14.5cqh;height:72cqh;transform-origin:50% 100%;animation:lobbyBreath 3.8s ease-in-out infinite;cursor:pointer;z-index:1}
#meta .hero img{height:100%;width:auto;display:block;filter:drop-shadow(0 0 5cqw rgba(255,150,90,.28));transform-origin:50% 100%;pointer-events:none}
#meta .hero.tap img{animation:lobbyTap .3s}
@keyframes lobbyBreath{50%{transform:translateY(-.7cqh) scale(1.008)}}
@keyframes lobbyTap{35%{transform:scale(.965,1.02)}70%{transform:scale(1.015,.99)}}
#meta .bubble{position:absolute;right:4cqw;top:49cqh;width:47cqw;background:#eef2ff;color:#1a1f38;padding:1.5cqh 3.4cqw;border-radius:3cqw 3cqw 3cqw .6cqw;font-size:3.5cqw;line-height:1.5;font-weight:700;box-shadow:0 1cqw 3cqw rgba(0,0,0,.35);z-index:2;animation:bubbleIn .25s}
@keyframes bubbleIn{from{transform:scale(.9);opacity:0}}
#meta .ltag{position:absolute;left:5cqw;bottom:21.5cqh;z-index:2;text-shadow:0 .5cqw 1.5cqw #0b0e1c;pointer-events:none}
#meta .ltag small{display:block;font-size:2.8cqw;letter-spacing:.28em;color:#6ff2e6;font-weight:800}
#meta .ltag b{font-size:9cqw;font-weight:900;font-style:italic}
#meta .ltag span{font-size:3.2cqw;font-weight:800;color:#ffd24a;margin-left:2cqw}
#meta button.sortie{position:absolute;right:4cqw;bottom:12.5cqh;min-width:37cqw;padding:1.8cqh 5cqw;font-size:7.4cqw;z-index:2;line-height:1.1}
#meta button.sortie small{display:block;font-size:3.2cqw;font-style:normal;font-weight:800}
#meta .tabs{position:absolute;left:0;right:0;bottom:0;height:9.5cqh;display:flex;background:rgba(10,13,26,.94);border-top:.4cqw solid rgba(255,255,255,.14);z-index:3}
#meta .tabs button{flex:1;min-width:0;clip-path:none;background:none;font-size:3.6cqw;padding:0;color:#9aa3c7;font-style:normal;font-weight:800}
#meta .tabs button.on{color:#2fd3a0;box-shadow:inset 0 .8cqw 0 #2fd3a0}
#meta .tabs button.soon{opacity:.5}
#meta .toast{position:absolute;left:50%;top:40cqh;transform:translateX(-50%);background:rgba(14,18,32,.95);border:.5cqw solid #ffd24a;padding:1.4cqh 6cqw;font-size:4cqw;font-weight:900;pointer-events:none;animation:toastFade 1.3s forwards;z-index:6;white-space:nowrap}
@keyframes toastFade{0%{opacity:0}12%{opacity:1}75%{opacity:1}100%{opacity:0}}
#meta .roster{display:grid;grid-template-columns:repeat(3,1fr);gap:2cqw;width:100%}
#meta .rc{position:relative;aspect-ratio:3/4.7;background:#1a2040;border:.5cqw solid rgba(255,255,255,.16);border-radius:2cqw;overflow:hidden}
#meta .rc.in{cursor:pointer;border-color:#ffd24a}
#meta .rc img{position:absolute;left:50%;top:0;height:150%;transform:translateX(-50%)}
#meta .rc svg{position:absolute;left:18%;top:10%;width:64%;opacity:.5}
#meta .rc .nm{position:absolute;left:0;right:0;bottom:0;background:rgba(10,13,26,.88);padding:.6cqh 1cqw;text-align:center;font-size:3.6cqw;font-weight:900}
#meta .rc .nm small{display:block;font-size:2.6cqw;font-weight:700;color:#b9c2e6}
#meta .rc .tag,#meta .dt .tag{position:absolute;top:1cqw;left:1cqw;background:#ffd24a;color:#2a1c00;font-size:2.8cqw;font-weight:900;padding:0 1.4cqw;border-radius:1cqw}
#meta .note{width:100%;font-size:3.3cqw;line-height:1.55;color:#cfd6f2;margin:1.6cqh 0}
#meta .note b{color:#ffd24a}
#meta .dt{position:relative;width:100%;display:flex;gap:2cqw;height:44cqh}
#meta .dt .pic{position:relative;width:52%;height:100%;overflow:hidden;background:linear-gradient(180deg,#232a4d,#3a2a44);border-radius:2cqw}
#meta .dt .pic img{position:absolute;left:50%;bottom:0;height:100%;transform:translateX(-50%)}
#meta .dt .info{flex:1;display:flex;flex-direction:column;gap:.8cqh;font-size:3.3cqw;line-height:1.5}
#meta .dt .info b{font-size:8cqw;font-style:italic;font-weight:900;line-height:1.1}
#meta .dt .info em{font-style:normal;color:#6ff2e6;font-weight:800}
#meta .forms{display:flex;gap:1.4cqw;flex-wrap:wrap;margin-top:auto}
#meta .forms button{min-width:0;padding:1cqh 0;width:10.5cqw;font-size:3.6cqw;clip-path:none;border-radius:1.4cqw}
#meta .forms button.on{background:#2fd3a0;color:#08221b}
#meta .wl{display:grid;grid-template-columns:repeat(3,1fr);gap:1cqh 1.6cqw;width:100%;margin-top:1cqh}
#meta .wl div{background:#1a2040;border:.4cqw solid rgba(255,255,255,.16);border-radius:1.4cqw;padding:.7cqh 1cqw;font-size:3.1cqw;font-weight:800;text-align:center}
#meta .wl div small{display:block;font-size:2.4cqw;color:#9aa3c7;font-weight:700}
#meta .wl div.off{opacity:.38}
#meta h3{width:100%;margin:1.6cqh 0 0;font-size:3.8cqw;font-weight:900;color:#ffd24a}
#metaTeam{position:absolute;left:0;right:0;bottom:1.2cqh;display:flex;justify-content:center;align-items:flex-end;gap:2cqw;pointer-events:none}
#metaTeam[hidden]{display:none}
#metaTeam .slot{width:13cqw;height:13cqw;border-radius:2.2cqw;border:.5cqw dashed rgba(255,255,255,.3);background:rgba(14,18,32,.3);position:relative;overflow:hidden}
#metaTeam .slot.lead{width:15cqw;height:15cqw;border:.6cqw solid #6b7399;background-color:#1a2040;background-repeat:no-repeat}
#metaTeam .slot.lead i{position:absolute;left:0;bottom:0;height:1.8cqw;width:calc(var(--c,0)*100%);background:#2fd3a0}
#metaTeam .slot.lead::after{content:"";position:absolute;left:0;right:0;bottom:0;height:1.8cqw;background:rgba(10,13,26,.7);z-index:-1}
#metaTeam .slot.lead b{position:absolute;top:.4cqw;left:.5cqw;font:900 2.6cqw sans-serif;color:#2a1c00;background:#ffd24a;padding:0 1cqw;border-radius:.8cqw}
#metaTeam .slot.lead.ready{border-color:#ffd24a;box-shadow:0 0 3.5cqw #ffd24a;animation:metaPulse .8s infinite}
#metaTeam .slot.lead.ready i{background:#ffd24a}
#metaTeam .slot.lead.on{border-color:#fff;box-shadow:0 0 4.5cqw #ffe9a8}
#metaTeam .slot.lead.on i{background:#fff}
#metaTip{position:absolute;left:0;right:0;bottom:18.5cqw;text-align:center;font:900 3.4cqw "Noto Sans TC","PingFang TC","Microsoft JhengHei",sans-serif;color:#ffd24a;text-shadow:0 .4cqw 1cqw #000;pointer-events:none}
#metaTip[hidden]{display:none}
#meta .hero.boxed img{-webkit-mask-image:radial-gradient(ellipse 58% 60% at 50% 46%,#000 60%,transparent 100%);mask-image:radial-gradient(ellipse 58% 60% at 50% 46%,#000 60%,transparent 100%);filter:none}
#meta .rc .nm em{display:block;font-style:normal;font-size:2.5cqw;color:#ffd24a;font-weight:800}
#meta .field{position:relative;width:100%;height:30cqh;background:linear-gradient(180deg,#2a2f52,#1a1f38);border:.5cqw solid rgba(255,255,255,.16);border-radius:2cqw;overflow:hidden;margin-bottom:1.6cqh}
#meta .field::before{content:"前";position:absolute;top:1cqh;left:50%;transform:translateX(-50%);font-size:3cqw;color:#9aa3c7;font-weight:800}
#meta .pos{position:absolute;width:17cqw;height:17cqw;margin:-8.5cqw 0 0 -8.5cqw;border-radius:50%;border:.6cqw dashed rgba(255,255,255,.3);background:rgba(14,18,32,.5) no-repeat;display:flex;align-items:flex-end;justify-content:center;font-size:2.8cqw;font-weight:900;overflow:hidden}
#meta .pos.in{border-style:solid;border-color:#ffd24a}
#meta .pos span{background:rgba(10,13,26,.85);width:100%;text-align:center;padding:.2cqh 0}
#meta .mrow{width:100%;display:flex;align-items:center;gap:3cqw;background:rgba(14,18,32,.94);border:.4cqw solid rgba(255,255,255,.18);border-radius:2cqw;padding:1.2cqh 3cqw;margin-bottom:1.2cqh;font-size:3.6cqw;font-weight:800}
#meta .mrow .av{width:13cqw;height:13cqw;border-radius:2cqw;background:#1a2040 no-repeat;flex:none}
#meta .mrow div{flex:1}
#meta .mrow small{display:block;font-size:2.9cqw;color:#b9c2e6;font-weight:700}
#meta .scr.join{background:radial-gradient(ellipse at 50% 38%,rgba(var(--jc),.5),rgba(20,26,51,0) 62%),#141a33}
#meta .join .jp{height:52cqh;margin-top:1cqh;animation:joinIn .5s cubic-bezier(.2,1.3,.4,1)}
#meta .join .jp img{height:100%;display:block}
#meta .join .jp.boxed img{-webkit-mask-image:radial-gradient(ellipse 60% 62% at 50% 46%,#000 62%,transparent 100%);mask-image:radial-gradient(ellipse 60% 62% at 50% 46%,#000 62%,transparent 100%)}
@keyframes joinIn{from{transform:translateY(6cqh) scale(.92);opacity:0}}
#meta .join .jn{font-size:11cqw;font-weight:900;font-style:italic;line-height:1.1}
#meta .join .jr{font-size:3.8cqw;font-weight:800;color:#6ff2e6;margin:.4cqh 0 1.4cqh}
`;

/**
 * @param {{ getMeta: () => import('../core/save.js').MetaSave, onPlay: (n: number) => void, onBuy: (key: string) => boolean, onBurst?: () => void }} api  onBurst = 玩家撳咗隊長頭像（放爆發技）
 */
export function createCampaignUI(api) {
  const style = document.createElement('style'); style.textContent = CSS; document.head.appendChild(style);
  const root = document.createElement('div'); root.id = 'meta'; root.hidden = true; document.body.appendChild(root);
  const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
  const btn = (label, cls, fn, disabled) => { const b = h('button', cls, label); b.disabled = !!disabled; b.addEventListener('click', (ev) => { ev.stopPropagation(); if (!b.dataset.quiet) api.onSound?.('ui_click'); fn(); }); return b; };
  // 戰鬥中右上角嘅暫停掣
  const pauseBtn = document.createElement('button'); pauseBtn.id = 'metaPause'; pauseBtn.textContent = 'II'; pauseBtn.hidden = true; pauseBtn.setAttribute('aria-label', '暫停');
  const hud = document.createElement('div'); hud.id = 'metaHud'; hud.appendChild(pauseBtn); document.body.appendChild(hud);
  pauseBtn.addEventListener('click', (ev) => { ev.stopPropagation(); api.onSound?.('ui_click'); pause(); });
  const starText = (n) => '★'.repeat(n) + `<i>${'★'.repeat(3 - n)}</i>`;
  let screen = 'none', hintTimer = 0;
  const FORM_MARK = ['I', 'II', 'III', 'IV'], lead = ROSTER.find((r) => r.leader);

  // ---------- 戰鬥中：畫面下方五個頭像位（爆發槽）----------
  // 而家只有中間係隊長：頭像底有一條爆發槽，滿咗會發光；其餘四格係空插槽（之後隊員加入先有頭像）。
  // 發動 = 喺隊長頭像上面「輕撳一下」（撳落到放手唔過 0.35 秒、手指冇點郁）。唔會攔住拖動：撳住頭像拖照樣係移動主角，唔會誤放。
  const teamBar = document.createElement('div'); teamBar.id = 'metaTeam'; teamBar.hidden = true;
  const tip = document.createElement('div'); tip.id = 'metaTip'; tip.hidden = true;
  hud.append(tip, teamBar);
  // 頭像：由立繪裁塊面出嚟（[放大幾多, 位置]）
  const FACE = { falcon: ['310%', '50% 7%'], suzu: ['400%', '50.5% 5%'], kiri: ['420%', '47% 1.5%'] };
  const faceStyle = (el, id, form = 0) => { const r = rosterOf(id), f = FACE[id] ?? FACE.falcon; el.style.backgroundImage = `url("${r.portrait(form)}")`; el.style.backgroundSize = f[0]; el.style.backgroundPosition = f[1]; };
  const shown = { c: -1, ready: null, on: null, form: -1, key: null };
  let faces = [], leadSlot = null;
  /** 照今場出戰嘅人砌五個頭像位：有人嘅位有頭像、段位（起／承／決）同爆發槽；冇人嘅係空插槽。 */
  function buildTeamBar(mates) {
    teamBar.replaceChildren(); faces = []; leadSlot = null;
    for (const id of battleSlots(mates)) {
      const d = document.createElement('div'); d.className = 'slot';
      if (id) { const r = rosterOf(id); d.classList.add('lead'); d.innerHTML = `<b>${CHAIN_STAGES[r.chain].label}</b><i></i>`; d.dataset.burst = id; faceStyle(d, id, 0); faces.push(d); if (r.leader) leadSlot = d; }
      teamBar.append(d);
    }
    const full = !!chainOrder(['falcon', ...mates]);
    tip.textContent = full ? '爆發槽滿 · 撳頭像接力' : '爆發槽滿 · 撳頭像放';
    shown.c = -1; shown.ready = null; shown.on = null; shown.form = -1;
  }
  buildTeamBar([]);
  let press = null;
  const inFace = (ev) => { if (teamBar.hidden) return false; for (const el of faces) { const r = el.getBoundingClientRect(), pad = r.width * 0.12; if (ev.clientX >= r.left - pad && ev.clientX <= r.right + pad && ev.clientY >= r.top - pad && ev.clientY <= r.bottom + pad) return true; } return false; };
  addEventListener('pointerdown', (ev) => { press = inFace(ev) ? { x: ev.clientX, y: ev.clientY, t: performance.now(), id: ev.pointerId } : null; }, true);
  addEventListener('pointerup', (ev) => {
    const p = press; press = null;
    if (!p || p.id !== ev.pointerId || !inFace(ev)) return;
    if (performance.now() - p.t <= 350 && Math.hypot(ev.clientX - p.x, ev.clientY - p.y) <= leadSlot.getBoundingClientRect().width * 0.25) api.onBurst?.();
  }, true);
  /** 每格叫一次：照戰鬥狀態更新頭像列（邊個出戰、槽、發光、隊長頭像跟形態）。有變先改網頁元素。 */
  function hudUpdate(s) {
    const show = !!s?.burst && !!api.inBattle?.() && (screen === 'none' || screen === 'hint');
    if (teamBar.hidden === show) teamBar.hidden = !show;
    if (!show) { if (!tip.hidden) tip.hidden = true; return; }
    const key = s.team.mates.map((m) => m.id).join(',');
    if (key !== shown.key) { shown.key = key; buildTeamBar(s.team.mates.map((m) => m.id)); }
    const b = s.burst, on = b.t > 0 || b.cut > 0, ready = !on && b.charge >= 1, total = (b.full ? COLUMN.burst.full : COLUMN.burst).time, c = Math.round((on ? (b.cut > 0 ? 1 : b.t / total) : b.charge) * 100) / 100;
    if (c !== shown.c) { shown.c = c; for (const el of faces) el.style.setProperty('--c', String(c)); }
    if (ready !== shown.ready) { shown.ready = ready; for (const el of faces) el.classList.toggle('ready', ready); tip.hidden = !ready; }
    if (on !== shown.on) { shown.on = on; for (const el of faces) el.classList.toggle('on', on); }
    if (s.form !== shown.form) { shown.form = s.form; faceStyle(leadSlot, lead.id, s.form); }
  }

  function mount(name, node, pass) { if (name !== 'hint') { teamBar.hidden = true; tip.hidden = true; } root.replaceChildren(node); root.hidden = false; root.classList.toggle('pass', !!pass); screen = name; pauseBtn.hidden = name !== 'hint'; api.onScreen?.(name); }

  function title() {
    const s = h('div', 'scr');
    s.append(h('h1', '', '數字突擊隊'), h('div', 'sub', 'NUMBER SQUAD'));
    const sp = h('div'); sp.style.flex = '1'; s.append(sp);
    const meta = api.getMeta(), started = totalStars(meta) > 0;
    s.append(btn(started ? '繼續' : '開始', 'go', () => lobby()));
    const foot = h('div', '', started ? `已過 ${Object.values(meta.stages).filter((v) => v.stars > 0).length} / ${STAGE_COUNT} 關 · ${totalStars(meta)} 粒星` : '射磚加戰力，打爆首領');
    foot.style.cssText = 'margin:3cqh 0 6cqh;font-size:3.4cqw;color:#b9c2e6';
    s.append(foot);
    mount('title', s);
  }

  // ---------- 大廳 ----------
  function toast(text) { const t = h('div', 'toast', text); root.append(t); setTimeout(() => t.remove(), 1350); }
  /** 底部分頁（大廳、隊員、基地用）。 */
  function tabs(now) {
    const bar = h('div', 'tabs');
    for (const t of LOBBY_TABS) {
      const b = btn(t.label, `${t.id === now ? 'on' : ''} ${t.soon ? 'soon' : ''}`, () => { if (t.soon) toast(`${t.label} · 即將開放`); else if (t.id === 'lobby') lobby(); else if (t.id === 'team') team(); else if (t.id === 'base') upgrades(() => lobby(), true); });
      b.dataset.tab = t.id; bar.append(b);
    }
    return bar;
  }
  /** 黃昏廢墟城市剪影：兩層樓（遠嗰層淡啲），樓頂有崩缺，零星幾格亮燈。用固定種子，每次一樣。 */
  function skyline() {
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const layer = (color, base, hMin, hMax, wMin, wMax, lit) => {
      let x = -4, out = '';
      while (x < 104) {
        const w = wMin + rnd() * (wMax - wMin), ht = hMin + rnd() * (hMax - hMin), y = base - ht, broken = rnd() < 0.45;
        const top = broken ? `${x},${y + 3 + rnd() * 5} ${x + w * 0.3},${y} ${x + w * 0.5},${y + 2 + rnd() * 4} ${x + w * 0.75},${y + 1} ${x + w},${y + 4 + rnd() * 6}` : `${x},${y} ${x + w},${y}`;
        out += `<polygon points="${x},${base} ${top} ${x + w},${base}" fill="${color}"/>`;
        if (lit) for (let k = 0; k < 2; k++) if (rnd() < 0.5) out += `<rect x="${x + 1 + rnd() * Math.max(1, w - 3)}" y="${y + 8 + rnd() * Math.max(1, ht - 14)}" width="1.1" height="1.6" fill="#ffb86b" opacity=".7"/>`;
        x += w + (rnd() < 0.3 ? rnd() * 3 : 0.3);
      }
      return out;
    };
    return `<svg class="sky" viewBox="0 0 100 60" preserveAspectRatio="none">${layer('#8a4a5c', 60, 14, 38, 6, 13, false)}${layer('#3a2238', 60, 8, 26, 7, 15, true)}</svg>`;
  }
  let lineNo = -1;
  /** 大廳：看板角色（玩家見過嘅最高形態）企中間，對白每次入嚟隨機一句，撳角色換下一句。 */
  function lobby() {
    const meta = api.getMeta(), s = h('div', 'scr lobby'), seen = seenOf(meta), next = nextStage(meta);
    s.innerHTML = skyline();
    const top = h('div', 'ltop'), right = h('div', 'row'); right.style.gap = '2cqw';
    right.append(h('div', 'chip gold', formatNumber(meta.gold)), btn('設定', 'small', () => settings(() => lobby())));
    top.append(h('div', 'chip', `指揮官 Lv.${playerLevel(meta)}`), right); s.append(top);
    const side = h('div', 'lside');
    for (const b of LOBBY_SIDE) { const e = btn(b.label, 'sq', () => toast(`${b.label.replace('\n', '')} · 即將開放`)); e.dataset.side = b.id; side.append(e); }
    s.append(side);
    const face = rosterOf(faceId(meta)); // 看板角色：玩家揀咗嘅（要入咗隊），否則隊長
    const hero = h('div', `hero ${face.cutout ? '' : 'boxed'}`), img = document.createElement('img'); img.src = face.portrait(face.leader ? seen.form : 0); img.alt = face.name; img.draggable = false; hero.append(img); hero.dataset.hero = face.id;
    const bubble = h('div', 'bubble');
    lineNo = Math.floor(Math.random() * face.lines.length);
    const say = () => { bubble.textContent = face.lines[lineNo % face.lines.length]; bubble.style.animation = 'none'; void bubble.offsetWidth; bubble.style.animation = ''; };
    say();
    hero.addEventListener('click', () => { lineNo++; say(); hero.classList.remove('tap'); void hero.offsetWidth; hero.classList.add('tap'); api.onSound?.('ui_click'); });
    s.append(hero, bubble);
    s.append(h('div', 'ltag', `<small>${face.title}</small><b>${face.name}</b><span>${face.leader ? `形態 ${FORM_MARK[seen.form]}` : face.role}</span>`));
    const go = btn(`出擊<small>第 ${next} 關</small>`, 'go sortie', () => map()); go.dataset.sortie = '1'; s.append(go);
    s.append(tabs('lobby'));
    mount('lobby', s);
  }

  const SILHOUETTE = '<svg viewBox="0 0 60 90"><circle cx="30" cy="20" r="12" fill="#3a4270"/><path d="M6 90c0-30 10-44 24-44s24 14 24 44z" fill="#3a4270"/></svg>';
  /** 隊員頁：角色表入面嘅角色；未入隊嘅用剪影（寫明過邊關加入）；其餘空位係「未加入」。 */
  function team() {
    const s = h('div', 'scr tabbed'), meta = api.getMeta(), seen = seenOf(meta), joined = joinedIds(meta), out = squadMates(meta);
    const top = h('div', 'top'), tools = h('div', 'row'); tools.style.gap = '2cqw';
    const lu = btn('編隊', 'small go', () => lineup()); lu.dataset.lineup = '1'; tools.append(h('div', 'chip', `${joined.length} / ${ROSTER_SLOTS}`), lu);
    top.append(h('h2', '', '隊員'), tools); top.firstChild.style.margin = '0'; s.append(top);
    const grid = h('div', 'roster');
    for (let i = 0; i < ROSTER_SLOTS; i++) {
      const r = ROSTER[i], has = r && joined.includes(r.id), card = h('div', `rc ${has ? 'in' : ''}`);
      if (has) {
        const img = document.createElement('img'); img.src = r.portrait(r.leader ? seen.form : 0); img.alt = r.name; img.draggable = false;
        card.append(img, h('div', 'tag', CHAIN_STAGES[r.chain].label), h('div', 'nm', `${r.name}<small>${r.role}</small>${r.leader ? '<em>隊長</em>' : out.includes(r.id) ? '<em>出戰中</em>' : '<em style="color:#9aa3c7">休息</em>'}`));
        card.dataset.char = r.id; card.addEventListener('click', () => { api.onSound?.('ui_click'); detail(r.id); });
      } else { card.innerHTML = SILHOUETTE; card.append(h('div', 'nm', `？？？<small>${r ? `過第 ${r.joinAfter} 關加入` : '未加入'}</small>`)); if (r) card.dataset.locked = r.id; }
      grid.append(card);
    }
    s.append(grid);
    const order = chainOrder(['falcon', ...out]);
    s.append(h('div', 'note', `<b>爆發鏈</b>：起 → 承 → 決。${order ? `三段齊：<b>${order.map((id) => rosterOf(id).name).join(' → ')}</b> 接力放出完整爆發（${COLUMN.burst.full.time} 秒、全隊射速 ×${COLUMN.burst.full.mul}）。` : `三段未齊，暫時係隊長單人版：<b>${lead.burst.name}</b>——${lead.burst.note}`}`));
    s.append(h('div', 'note', '隊伍最多五人：隊長喺中間，其餘四人跟住跑。而家最多帶兩個隊員出戰。'));
    s.append(tabs('team'));
    mount('team', s);
  }

  /** 角色詳情：立繪、定位、簡介。隊長：形態（見過嘅先睇得）同武器線十二級；隊員：武器同打法、數值。入咗隊嘅可以設做大廳看板角色。 */
  function detail(id, form) {
    const r = rosterOf(id), meta = api.getMeta();
    if (!r || !joinedIds(meta).includes(id)) return team();
    const seen = seenOf(meta), f = r.leader ? Math.max(0, Math.min(form ?? seen.form, seen.form, r.forms - 1)) : 0, s = h('div', 'scr tabbed');
    const top = h('div', 'top'); top.append(h('h2', '', '角色資料'), btn('返回', 'small', () => team())); top.firstChild.style.margin = '0'; s.append(top);
    const dt = h('div', 'dt'), pic = h('div', 'pic'), img = document.createElement('img'); img.src = r.portrait(f); img.alt = r.name; img.draggable = false; pic.append(img, h('div', 'tag', CHAIN_STAGES[r.chain].label));
    const info = h('div', 'info');
    info.append(h('b', '', r.name), h('em', '', r.role), h('div', '', r.intro), h('div', '', `${r.leader ? '爆發技' : '接力'}：<em>${r.burst.name}</em><br>${r.burst.note}`));
    if (r.leader) {
      const forms = h('div', 'forms');
      for (let i = 0; i < r.forms; i++) { const b = btn(i <= seen.form ? FORM_MARK[i] : '？', i === f ? 'on' : '', () => detail(id, i), i > seen.form); b.dataset.form = String(i); forms.append(b); }
      info.append(h('div', '', `睇緊：${CROWD.evolution.forms[f]?.name ?? ''}`), forms);
    }
    const isFace = faceId(meta) === id, fb = btn(isFace ? '看板角色 ✓' : '設為看板角色', `small ${isFace ? '' : 'go'}`, () => { api.onFace?.(id); detail(id, form); }, isFace); fb.dataset.face = id; fb.style.marginTop = r.leader ? '1cqh' : 'auto';
    info.append(fb);
    dt.append(pic, info); s.append(dt);
    if (r.leader) {
      s.append(h('h3', '', `武器線（見過 ${Math.min(seen.weapon, WEAPONS.length)} / ${WEAPONS.length}）`));
      const wl = h('div', 'wl');
      WEAPONS.forEach((w, i) => { const ok = i + 1 <= seen.weapon, d = h('div', ok ? '' : 'off', `<small>Lv${i + 1} · 形態 ${FORM_MARK[w.form]}</small>${ok ? w.name : '？？？'}`); d.dataset.weapon = String(i + 1); wl.append(d); });
      s.append(wl);
    } else {
      const B = r.battle;
      s.append(h('h3', '', '武器同打法'), h('div', 'note', r.weaponNote));
      s.append(h('div', 'note', `每秒輸出：隊長戰力嘅 <b>${Math.round(B.share * 100)}%</b>${B.near ? `（貼身最高 <b>${Math.round(B.share * (1 + B.near) * 100)}%</b>）` : ''} · 每 <b>${B.interval}</b> 秒出一下 · 打方陣一下倒 <b>${B.pierce}</b> 隻<br>只打方陣、路障同首領；唔會受傷。`));
    }
    s.append(tabs('team'));
    mount('detail', s);
  }

  /** 編隊：隊長一定出戰；入咗隊嘅隊員揀出戰定休息（而家最多 MAX_MATES 個）。上面係企位圖（前 = 畫面上方）。 */
  function lineup() {
    const meta = api.getMeta(), s = h('div', 'scr tabbed'), joined = joinedIds(meta).filter((id) => !rosterOf(id).leader), out = squadMates(meta), seen = seenOf(meta);
    const top = h('div', 'top'); top.append(h('h2', '', '編隊'), btn('返回', 'small', () => team())); top.firstChild.style.margin = '0'; s.append(top);
    const field = h('div', 'field'), spots = [[18, 62, null], [34, 74, null], [50, 40, lead.id], [66, 74, null], [82, 62, null]], at = [1, 3, 0, 4];
    for (const id of out) spots[at[rosterOf(id).battle.slot]][2] = id;
    spots.forEach(([x, y, id], i) => { const d = h('div', `pos ${id ? 'in' : ''}`, `<span>${id ? rosterOf(id).name : ['左外', '左後', '', '右後', '右外'][i]}</span>`); d.style.left = `${x}%`; d.style.top = `${y}%`; if (id) faceStyle(d, id, rosterOf(id).leader ? seen.form : 0); field.append(d); });
    s.append(field);
    if (!joined.length) s.append(h('div', 'note', '未有隊員。過第 2 關、第 4 關各有一個隊員加入。'));
    for (const id of joined) {
      const r = rosterOf(id), on = out.includes(id), row = h('div', 'mrow'), av = h('div', 'av'); faceStyle(av, id, 0);
      const b = btn(on ? '出戰中' : '休息', `small ${on ? 'go' : ''}`, () => { if (api.onSquad?.(id, !on)) lineup(); else toast(`最多帶 ${MAX_MATES} 個隊員`); }); b.dataset.mate = id;
      row.append(av, h('div', '', `${r.name}（${CHAIN_STAGES[r.chain].label}）<small>${r.role} · ${['左後', '右後', '左外', '右外'][r.battle.slot]}</small>`), b); s.append(row);
    }
    const order = chainOrder(['falcon', ...out]);
    s.append(h('div', 'note', order ? `<b>完整爆發可以用</b>：${order.map((id) => `${CHAIN_STAGES[rosterOf(id).chain].label} ${rosterOf(id).name}`).join(' → ')}` : '起、承、決未齊：爆發技係隊長單人版。'));
    s.append(tabs('team'));
    mount('lineup', s);
  }

  /** 新隊員加入（結算之後插入）：立繪、名、定位、一句對白。撳「繼續」先做返玩家本來揀嘅嘢。 */
  function join(id, then) {
    const r = rosterOf(id), s = h('div', 'scr join'); s.style.setProperty('--jc', r.color);
    s.append(h('div', 'sub', 'NEW MEMBER'), h('h2', '', '新隊員加入'));
    const jp = h('div', `jp ${r.cutout ? '' : 'boxed'}`), img = document.createElement('img'); img.src = r.portrait(0); img.alt = r.name; img.draggable = false; jp.append(img); s.append(jp);
    s.append(h('div', 'jn', r.name), h('div', 'jr', `${r.role} · 爆發鏈「${CHAIN_STAGES[r.chain].label}」`));
    const card = h('div', 'card'); card.append(h('p', '', `「${r.joinLine}」`)); s.append(card);
    const sp = h('div'); sp.style.flex = '1'; s.append(sp);
    const b = btn('繼續', 'go', () => then()); b.dataset.joinok = id; b.style.marginBottom = '3cqh'; s.append(b);
    mount('join', s);
    api.onSound?.('join');
  }

  /** 關卡地圖：十個節點由下向上蛇形排；撳一個出簡介。 */
  function map(open) {
    const meta = api.getMeta(), s = h('div', 'scr'), next = nextStage(meta);
    const top = h('div', 'top'), tools = h('div', 'row'); tools.append(btn('大廳', 'small', () => lobby()), btn('設定', 'small', () => settings(() => map(open))), btn('升級', 'small', () => upgrades(() => map(open))));
    top.append(h('div', 'gold', formatNumber(meta.gold)), tools); s.append(top);
    const area = h('div', 'map'), pts = [];
    for (let n = 1; n <= STAGE_COUNT; n++) pts.push([50 + 30 * Math.sin((n - 1) * 1.15), 95 - (n - 1) * 10]);
    area.innerHTML = `<svg viewBox="0 0 100 100" preserveAspectRatio="none"><polyline points="${pts.map((p) => p.join(',')).join(' ')}" fill="none" stroke="#4b5488" stroke-width="1.2" stroke-dasharray="2 2"/></svg>`;
    pts.forEach(([x, y], i) => {
      const n = i + 1, stars = stageStars(meta, n), open2 = stageUnlocked(meta, n);
      // 未到嘅關：有新武器／新形態就用問號預告
      const news2 = stageNews(n), tease = !open2 && (news2.form || news2.weapons.length) ? (news2.form ? '新形態？' : '新武器？') : '鎖';
      const node = h('div', `node ${stars ? 'done' : open2 && n === next ? 'next' : open2 ? '' : 'lock'}`, `${n}<small>${stars ? '★'.repeat(stars) : open2 ? '' : tease}</small>`);
      node.style.left = `${x}%`; node.style.top = `${y}%`; node.dataset.stage = String(n);
      if (open2) node.addEventListener('click', () => map(n));
      area.append(node);
    });
    s.append(area);
    const n = open ?? next, S = STAGES[n - 1], adds = stageAdds(n), card = h('div', 'card');
    card.append(h('h2', '', `第 ${n} 關<span class="st">${starText(stageStars(meta, n))}</span>`));
    const news = stageNews(n), [w0, w1] = S.weapons;
    if (news.form) card.append(h('p', 'new', `新形態：呢關會進化到形態 ${['I', 'II', 'III', 'IV'][news.form - 1]}`));
    if (news.weapons.length) card.append(h('p', 'new', `新武器：${news.weapons.map((w) => w.name).join('、')}`));
    card.append(h('p', '', `武器：第 ${w0} 級開局，呢關最高升到第 ${w1} 級`));
    for (const k of adds) card.append(h('p', 'new', `新：${FEATURES[k].name}——${FEATURES[k].note}`));
    if (S.intro) card.append(h('p', '', S.intro));
    card.append(h('p', '', `建議開局戰力 ${formatNumber(Math.round(S.base * (S.hard > 1 ? S.hard : 1)))} · 你而家 ${formatNumber(Math.round(S.base * (1 + UPGRADES.power.per * (meta.upgrades.power ?? 0))))}`));
    const row = h('div', 'row'); row.style.marginTop = '1.4cqh'; row.append(btn('出擊', 'go', () => api.onPlay(n), !stageUnlocked(meta, n))); card.append(row);
    s.append(card);
    mount('map', s);
  }

  /** 基地 = 永久升級。tabbed = 由底部分頁入嚟（有分頁列）。 */
  function upgrades(back = () => lobby(), tabbed = false) {
    const meta = api.getMeta(), s = h('div', `scr ${tabbed ? 'tabbed' : ''}`);
    const top = h('div', 'top'); top.append(h('div', 'gold', formatNumber(meta.gold)), btn('返回', 'small', back)); s.append(top);
    s.append(h('h2', '', '基地 · 永久升級'));
    for (const k of UPGRADE_KEYS) {
      const U = UPGRADES[k], lv = meta.upgrades[k] ?? 0, cost = upgradeCost(k, lv), card = h('div', 'card up');
      card.append(h('b', '', `${U.name} Lv ${lv}${lv >= U.max ? '（滿級）' : ''}`), h('span', '', `而家：${lv ? U.effect(lv) : '未升級'}`));
      if (lv < U.max) card.append(h('span', '', `下一級：${U.effect(lv + 1)}`));
      const buy = h('div', 'buy'); buy.append(h('div', 'gold', lv >= U.max ? '—' : formatNumber(cost)), btn('升級', 'small go', () => { if (api.onBuy(k)) { api.onSound?.('ui_buy'); upgrades(back, tabbed); } else api.onSound?.('ui_deny'); }, lv >= U.max));
      buy.lastChild.dataset.upgrade = k; buy.lastChild.dataset.quiet = '1'; if (!(cost <= meta.gold)) buy.lastChild.style.opacity = '.45'; // 唔夠錢都撳得：出「唔夠」嘅聲
      card.append(buy); s.append(card);
    }
    if (tabbed) s.append(tabs('base'));
    mount('upgrades', s);
  }

  /**
   * 結算。r = { stageNo, won, stars, peak, gold: { clear, stars, first, kills, total }, firstClear }
   */
  function result(r) {
    const meta = api.getMeta(), s = h('div', 'scr glass');
    const sp = h('div'); sp.style.height = '6cqh'; s.append(sp);
    s.append(h('h2', '', r.won ? `第 ${r.stageNo} 關 過關！` : `第 ${r.stageNo} 關 全滅`), h('div', 'stars', starText(r.stars)));
    const card = h('div', 'card'), lines = h('div', 'lines');
    const line = (a, b, cls) => { const d = h('div', cls); d.append(h('span', '', a), h('span', '', b)); lines.append(d); };
    line('最高戰力', formatNumber(r.peak));
    line(r.won ? '過關獎勵' : '參加獎勵', `+${formatNumber(r.gold.clear)}`);
    if (r.gold.stars) line(`新攞到 ${r.gold.newStars} 粒星`, `+${formatNumber(r.gold.stars)}`);
    if (r.gold.first) line('首次過關', `+${formatNumber(r.gold.first)}`);
    line('打低敵人', `+${formatNumber(r.gold.kills)}`);
    line('金幣', `+${formatNumber(r.gold.total)}（共 ${formatNumber(meta.gold)}）`, 'sum');
    card.append(lines); s.append(card);
    const sp2 = h('div'); sp2.style.flex = '1'; s.append(sp2);
    const row = h('div', 'row');
    // 今場有新隊員入隊：玩家撳邊個掣都好，先逐個出「新隊員加入」，睇完先做嗰個掣本身嘅嘢
    const after = (fn) => () => { const q = r.joined ?? []; r.joined = []; const next = () => (q.length ? join(q.shift(), next) : fn()); next(); };
    if (r.won && r.stageNo < STAGE_COUNT) row.append(btn('下一關', 'go', after(() => api.onPlay(r.stageNo + 1))));
    row.append(btn('再打一次', r.won ? '' : 'go', after(() => api.onPlay(r.stageNo))));
    row.append(btn('升級', '', after(() => upgrades(() => result(r)))), btn('大廳', '', after(() => lobby())), btn('地圖', '', after(() => map())));
    row.style.marginBottom = '3cqh';
    for (const b of row.children) b.classList.add('small');
    s.append(row);
    mount('result', s);
    // 星星逐粒響，之後金幣滾幾下
    for (let i = 0; i < r.stars; i++) setTimeout(() => { if (screen === 'result') api.onSound?.('star'); }, 350 + i * 260);
    for (let i = 0; i < 5; i++) setTimeout(() => { if (screen === 'result') api.onSound?.('coin'); }, 1300 + i * 90);
  }

  /** 設定：音效音量、音樂音量、震動開關（即改即存）；另有試聽全部音效。 */
  function settings(back = () => lobby()) {
    const st = api.getSettings(), s = h('div', 'scr');
    const top = h('div', 'top'); top.append(h('h2', '', '設定'), btn('返回', 'small', back)); top.firstChild.style.margin = '0'; s.append(top);
    const card = h('div', 'card');
    const slider = (label, key) => { const row = h('div', 'set'), inp = document.createElement('input'); inp.type = 'range'; inp.min = '0'; inp.max = '100'; inp.step = '10'; inp.value = String(Math.round((st[key] ?? 0) * 100)); inp.dataset.setting = key;
      inp.addEventListener('input', () => { api.onSettings({ [key]: Number(inp.value) / 100 }); if (key === 'sfx') api.onSound?.('brick'); }); row.append(h('span', '', label), inp); card.append(row); };
    slider('音效音量', 'sfx'); slider('音樂音量', 'music');
    const vib = h('div', 'set'), tog = btn(st.vibrate ? '開' : '熄', `small ${st.vibrate ? 'go' : ''}`, () => { api.onSettings({ vibrate: !api.getSettings().vibrate }); settings(back); });
    tog.dataset.setting = 'vibrate'; vib.append(h('span', '', '震動'), tog); card.append(vib);
    card.append(h('p', '', '震動只喺支援嘅裝置有效（iPhone 嘅瀏覽器冇）。'));
    s.append(card);
    const sp = h('div'); sp.style.flex = '1'; s.append(sp);
    const row = h('div', 'row'); row.append(btn('試聽音效', 'small', () => sounds(() => settings(back)))); row.style.marginBottom = '3cqh'; s.append(row);
    mount('settings', s);
  }

  /** 試聽：每把聲一個掣。 */
  function sounds(back = () => map()) {
    const s = h('div', 'scr');
    const top = h('div', 'top'); top.append(h('h2', '', '試聽'), btn('返回', 'small', back)); top.firstChild.style.margin = '0'; s.append(top);
    const grid = h('div', 'grid');
    for (const name of api.soundNames?.() ?? []) { const b = btn(name, '', () => api.onSound?.(name)); b.dataset.quiet = '1'; grid.append(b); }
    for (const name of ['map', 'battle', 'boss']) { const b = btn(`♪ ${name}`, 'go', () => api.onMusic?.(name)); grid.append(b); }
    s.append(grid);
    mount('sounds', s);
  }

  /** 暫停（戰鬥中撳右上角）：停咗個世界，可以繼續、改設定、或者放棄返地圖。 */
  function pause() {
    api.onPause?.();
    const s = h('div', 'scr glass');
    const sp = h('div'); sp.style.height = '26cqh'; s.append(sp);
    s.append(h('h2', '', '暫停'));
    const col = h('div', 'row'); col.style.cssText = 'flex-direction:column;gap:2cqh;margin-top:3cqh';
    col.append(btn('繼續', 'go', () => { hide(); api.onResume?.(); }), btn('設定', '', () => settings(() => pause())), btn('放棄，返大廳', '', () => lobby()));
    s.append(col);
    mount('pause', s);
  }

  /** 引導提示：喺戰鬥畫面上面出一句，幾秒後自己收（唔擋操作）。 */
  function hint(text, seconds = 3.2) {
    const box = h('div', 'hint', text);
    mount('hint', box, true);
    clearTimeout(hintTimer);
    hintTimer = setTimeout(() => { if (screen === 'hint') hide(); }, seconds * 1000);
  }

  function hide() { root.hidden = true; root.replaceChildren(); root.classList.remove('pass'); screen = 'none'; pauseBtn.hidden = !api.inBattle?.(); api.onScreen?.('none'); }

  return { title, lobby, team, detail, lineup, join, map, upgrades, result, hint, hide, settings, sounds, pause, hud: hudUpdate, toast, get screen() { return screen; } };
}
