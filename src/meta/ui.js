// 關外畫面同戰鬥介面（041 第一部分整套重做）：載入、標題、大廳、關卡地圖（連關卡簡介）、結算、新隊員加入、隊員、角色詳情、編隊、
// 基地（永久升級）、設定、暫停、引導提示、「獲得物品」彈窗；另外有戰鬥中嘅關卡牌、進度條、武器牌、爆發時間條、暫停鍵、頭像列（爆發槽）。
// 全部係網頁元素，疊喺戰鬥畫布上面（同畫布一樣大細、一樣位置），唔掂戰鬥嘅畫法。資料由外面傳入；撳掣就叫返外面畀嘅函式。
// 樣式一律用 src/ui/theme.js 嘅變數同組件（說明見 docs/ui-guide.md），圖示用 src/ui/icons.js；呢度只寫各個畫面自己嘅排位。

import { formatNumber } from '../core/format.js';
import { progress } from '../crowd/battle.js';
import { ENDLESS, FEATURES, HARD, STAGE_COUNT, STAGES, UPGRADES, UPGRADE_KEYS, stageAdds, stageNews, upgradeCost } from '../data/campaign.js';
import { CHAIN_STAGES, LOBBY_SIDE, LOBBY_TABS, MAX_MATES, ROSTER, battleSlots, chainOrder, rosterOf } from '../data/characters.js';
import { COLUMN, burstOf, fullBurst } from '../data/column.js';
import { CROWD } from '../data/crowd.js';
import { CHAPTERS, UNLOCKS, chapterOf, storyKey, unlockKey, unlockOf } from '../data/story.js';
import { TIPS, VERSION } from '../data/text.js';
import { WEAPONS } from '../data/weapons.js';
import { ROLE_ICON, WEAPON_ICON, icon } from '../ui/icons.js';
import { TOKENS, installTheme } from '../ui/theme.js';
import { DROPS, GACHA, HARD_FIRST, ITEMS, LEVEL, SKILL, SKILLS, STAR, STAR_EFFECTS } from '../data/growth.js';
import { ACH_GROUPS, DAILY_CHEST, LOGIN, OFFLINE } from '../data/live.js';
import { achievements, badges, chestReady, endlessTiers, hardOpen, loginState, mailUnread, mails, missionsToday, offlineState, shopShelf } from './live.js';
import { RALLY } from '../data/growth.js';
import { rallyOf, canGrow, charOf, charStats, gachaRates, have, levelCap, mergeRewards, nextLevel, nextSkill, nextStar, pityLeft, pullCost, rewardView, skillNow } from './growth.js';
import { faceId, joinedIds, nextStage, playerLevel, seenOf, squadMates, stageStars, stageUnlocked, totalStars } from './progress.js';

const CSS = `
/* ---------- 共用嘅佈景：黃昏廢墟（標題、大廳、地圖底） ---------- */
#meta .dusk{background:linear-gradient(180deg,#131935 0%,#2b2349 30%,#74405a 52%,#e08a5c 66%,#f3b06f 70%,#241a2b 70.2%,#0f0d18 100%)}
#meta svg.sky{position:absolute;left:0;right:0;bottom:29.8cqh;width:100%;height:38cqh;pointer-events:none}
#meta .sun{position:absolute;left:50%;bottom:30cqh;width:70cqw;height:70cqw;margin-left:-35cqw;margin-bottom:-22cqw;border-radius:50%;background:radial-gradient(circle,rgba(255,226,160,.9) 0%,rgba(255,170,100,.45) 38%,rgba(255,150,90,0) 70%);pointer-events:none}
#meta .floor{position:absolute;left:0;right:0;bottom:0;height:29.8cqh;pointer-events:none;background:linear-gradient(180deg,rgba(255,170,110,.22),rgba(0,0,0,0) 40%),repeating-linear-gradient(90deg,rgba(255,255,255,.05) 0 .4cqw,transparent .4cqw 12.5cqw)}
#meta .band{position:absolute;pointer-events:none;transform:skewX(-18deg)}

/* ---------- 載入 ---------- */
#meta .load{align-items:center;padding:0 8cqw}
#meta .logo{position:relative;display:inline-block;font-size:13.4cqw;font-weight:900;font-style:italic;letter-spacing:.02em;line-height:1.1;white-space:nowrap;padding-right:.15em}
#meta .logo .st{position:absolute;left:0;top:0;color:#0a0d1c;-webkit-text-stroke:2.4cqw #0a0d1c;text-shadow:1cqw 1.2cqw 0 var(--primary)}
#meta .logo .fl{position:relative;background:linear-gradient(180deg,#fff 0%,#fff 44%,#ffeaa6 46%,#ffd24a 78%,#f0a43a 100%);-webkit-background-clip:text;background-clip:text;color:transparent;-webkit-text-fill-color:transparent;padding-right:.15em}
#meta .logo.s{font-size:10cqw}
#meta .logoSub{display:inline-block;margin-top:1.2cqw;padding:.2em 1.4em .2em 1em;font-size:var(--fs-s);font-weight:900;font-style:italic;letter-spacing:.42em;color:var(--primary-ink);background:var(--primary);clip-path:polygon(1em 0,100% 0,calc(100% - 1em) 100%,0 100%)}
#meta .load .mid{margin-top:26cqh;text-align:center}
#meta .load .prog{width:100%;margin-top:14cqh}
#meta .load .prog .pb{height:max(8px,2.6cqw)}
#meta .load .prog .pb i{transition:width .15s}
#meta .load .prog .tx{display:flex;justify-content:space-between;margin-top:var(--sp-2);font-size:var(--fs-s);font-weight:800;color:var(--text-2)}
#meta .load .prog .tx b{color:var(--info);font-variant-numeric:tabular-nums}
#meta .load .tipbox.tipbox{position:absolute;left:8cqw;right:8cqw;bottom:calc(var(--sab) + 7cqh);display:flex;gap:var(--sp-3);align-items:flex-start;font-size:var(--fs-s);line-height:1.6;color:var(--text-2);min-height:4.8em}
#meta .load .tipbox .ic{color:var(--accent);font-size:var(--fs-xl);margin-top:.1em}
#meta .load .tipbox b{display:block;color:var(--accent);font-size:var(--fs-xs);letter-spacing:.2em}
#meta .load .tipbox span{animation:fadeIn .4s}

/* ---------- 標題 ---------- */
#meta .title{overflow:hidden;cursor:pointer}
#meta .kvs{background:linear-gradient(180deg,#17183c 0%,#2a2a5c 26%,#0c0a13 100%)}
#meta .kvbg{position:absolute;left:0;bottom:0;width:100%;height:auto;-webkit-mask-image:linear-gradient(180deg,transparent 0,#000 9%);mask-image:linear-gradient(180deg,transparent 0,#000 9%)}
#meta .title .kvbg{animation:kvIn .7s cubic-bezier(.2,.9,.3,1)}
@keyframes kvIn{from{transform:scale(1.06);opacity:0}}
#meta .load .kvbg{opacity:.3;filter:saturate(.7)}
#meta .load>:not(.kvbg){position:relative}
#meta .title::before{content:"";position:absolute;left:0;right:0;top:0;height:30cqh;z-index:1;pointer-events:none;background:linear-gradient(180deg,rgba(7,9,18,.88) 0%,rgba(7,9,18,.5) 45%,rgba(7,9,18,0) 100%)}
#meta .title .head{position:absolute;right:4cqw;text-align:right;top:calc(var(--sat) + 1.6cqh);z-index:2;animation:scrIn .5s .1s backwards}
#meta .title .btm{position:absolute;left:0;right:0;bottom:0;z-index:2;display:flex;flex-direction:column;align-items:center;gap:var(--sp-3);
  padding:12cqh 8cqw calc(var(--sab) + 4.5cqh);background:linear-gradient(180deg,rgba(7,9,18,0),rgba(7,9,18,.9) 60%)}
#meta .title .btm .bt{min-width:60cqw;min-height:max(52px,15cqw);font-size:var(--fs-xl);animation:breath 1.6s ease-in-out infinite}
@keyframes breath{50%{transform:scale(1.04)}}
#meta .title .btm .st{font-size:var(--fs-s);font-weight:800;color:var(--text-2);display:flex;gap:var(--sp-3);align-items:center}
#meta .title .ver{position:absolute;right:4cqw;bottom:calc(var(--sab) + 1.4cqh);font-size:var(--fs-xs);color:var(--text-3);font-weight:700;z-index:2}

/* ---------- 大廳 ---------- */
#meta .lobby{overflow:hidden}
#meta .ltop{position:absolute;top:calc(var(--sat) + var(--sp-2));left:var(--sp-4);right:var(--sp-4);display:flex;align-items:center;gap:var(--sp-2);z-index:3}
#meta .cmd{display:flex;align-items:center;gap:var(--sp-2);font-size:var(--fs-s);font-weight:800;color:var(--text-2);min-width:0}
#meta .cmd i{width:max(34px,9.6cqw);height:max(34px,9.6cqw);flex:none;display:flex;align-items:center;justify-content:center;font-style:italic;font-weight:900;font-size:var(--fs-l);color:var(--accent-ink);background:var(--accent);clip-path:polygon(50% 0,100% 50%,50% 100%,0 50%)}
#meta .cmd b{display:block;color:var(--text);font-size:var(--fs-m);font-style:italic}
#meta .hero{position:absolute;left:-7cqw;bottom:calc(var(--tabh) + 4.5cqh);height:72cqh;transform-origin:50% 100%;animation:lobbyBreath 3.8s ease-in-out infinite;cursor:pointer;z-index:1}
#meta .hero img{height:100%;width:auto;display:block;filter:drop-shadow(0 0 5cqw rgba(255,150,90,.28));transform-origin:50% 100%}
#meta .hero.tap img{animation:lobbyTap .3s}
@keyframes lobbyBreath{50%{transform:translateY(-.7cqh) scale(1.008)}}
@keyframes lobbyTap{35%{transform:scale(.965,1.02)}70%{transform:scale(1.015,.99)}}
#meta :is(.hero,.jp).boxed img{-webkit-mask-image:radial-gradient(ellipse 58% 60% at 50% 46%,#000 60%,transparent 100%);mask-image:radial-gradient(ellipse 58% 60% at 50% 46%,#000 60%,transparent 100%);filter:none}
#meta .bubble{position:absolute;right:4cqw;top:47cqh;width:48cqw;background:var(--text);color:#1a1f38;padding:var(--sp-3) var(--sp-3);font-size:var(--fs-s);line-height:1.55;font-weight:700;z-index:2;animation:bubbleIn .25s;
  clip-path:polygon(0 0,100% 0,100% calc(100% - 2.6cqw),calc(100% - 2.6cqw) 100%,0 100%);filter:none}
#meta .bubble::before{content:"";position:absolute;left:0;top:0;bottom:0;width:1.1cqw;background:var(--primary)}
@keyframes bubbleIn{from{transform:translateY(1.5cqw);opacity:0}}
#meta .ltag{position:absolute;left:5cqw;bottom:calc(var(--tabh) + 3cqh);z-index:2;text-shadow:0 .5cqw 1.5cqw #0b0e1c;pointer-events:none;max-width:48cqw}
#meta .ltag small{display:block;font-size:var(--fs-xs);letter-spacing:.28em;color:var(--info);font-weight:800}
#meta .ltag b{display:block;font-size:var(--fs-3xl);font-weight:900;font-style:italic;line-height:1.05}
#meta .ltag span{display:inline-flex;align-items:center;gap:.4em;font-size:var(--fs-s);font-weight:800;color:var(--accent)}
#meta .sortie{position:absolute;right:4cqw;bottom:calc(var(--tabh) + 3cqh);min-width:40cqw;min-height:max(60px,19cqw);font-size:var(--fs-2xl);z-index:2;flex-direction:column;gap:0;line-height:1.1;--sk:3.4cqw}
#meta .sortie small{font-size:var(--fs-s)}
#meta .lside{position:absolute;right:var(--sp-4);top:calc(var(--sat) + var(--hit) + var(--sp-6));display:grid;grid-template-columns:auto auto;gap:var(--sp-2);z-index:2}

/* ---------- 關卡地圖 ---------- */
#meta .mapsc{flex:1;min-height:0;overflow-y:auto;touch-action:pan-y;scrollbar-width:none;position:relative}
#meta .mapsc::-webkit-scrollbar{display:none}
#meta .mapin{position:relative;width:100%}
#meta .mapin>svg{position:absolute;inset:0;width:100%;height:100%}
#meta .nd{position:absolute;width:17cqw;height:17cqw;min-width:48px;min-height:48px;transform:translate(-50%,-50%);display:flex;flex-direction:column;align-items:center;justify-content:center;font-weight:900;font-size:var(--fs-xl);font-style:italic;filter:var(--shadow);isolation:isolate}
#meta .nd::before,#meta .nd::after{content:"";position:absolute;z-index:-1;clip-path:polygon(50% 0,100% 26%,100% 74%,50% 100%,0 74%,0 26%)}
#meta .nd::before{inset:0;background:var(--line-2)}
#meta .nd::after{inset:calc(var(--bw)*1.6);background:linear-gradient(180deg,#34407a,#1d2547)}
#meta .nd.done::before{background:#c9ffec}#meta .nd.done::after{background:linear-gradient(180deg,#2aa98a,#17604f)}
#meta .nd.next{animation:ndPulse 1.2s ease-in-out infinite}
#meta .nd.next::before{background:#fff3c4}#meta .nd.next::after{background:linear-gradient(180deg,#e9a82c,#a0661a)}
#meta .nd.lock{color:var(--text-3);filter:none}
#meta .nd.lock::after{background:#151b36}
#meta .nd .stars{position:absolute;bottom:-3.6cqw;font-size:var(--fs-s);filter:drop-shadow(0 .3cqw 0 rgba(4,6,14,.8))}
#meta .nd .tg{position:absolute;top:-2.4cqw;left:62%;font-style:normal}
#meta .nd .ic{font-size:var(--fs-l)}
@keyframes ndPulse{50%{transform:translate(-50%,-50%) scale(1.1)}}
#meta .sht .hd{display:flex;align-items:center;gap:var(--sp-3)}
#meta .sht .hd b{font-size:var(--fs-2xl);font-weight:900;font-style:italic;flex:1}
#meta .sht .hd .stars{font-size:var(--fs-xl)}
#meta .drops small .stars{font-size:var(--fs-xs)}
#meta .tags{display:flex;flex-wrap:wrap;gap:var(--sp-2)}
#meta .cmp{display:grid;grid-template-columns:1fr auto 1fr;gap:var(--sp-2);align-items:center;text-align:center;background:rgba(7,9,18,.5);border-radius:var(--r-m);padding:var(--sp-2) var(--sp-3)}
#meta .cmp small{display:block;font-size:var(--fs-xs);color:var(--text-2);font-weight:700}
#meta .cmp b{font-size:var(--fs-xl);font-weight:900;font-style:italic}
#meta .cmp .ok{color:var(--ok)}#meta .cmp .low{color:var(--warn)}
#meta .kv2{display:flex;align-items:center;gap:var(--sp-2);font-size:var(--fs-s);font-weight:700;color:var(--text-2)}
#meta .kv2 .ic{color:var(--info);font-size:var(--fs-l)}
#meta .kv2 b{color:var(--text)}

/* ---------- 結算 ---------- */
#meta .res{align-items:center;padding:calc(var(--sat) + 5cqh) var(--sp-4) 0}
#meta .res .rh{width:120%;text-align:center;padding:var(--sp-3) 0;transform:rotate(-3deg);animation:rhIn .35s cubic-bezier(.2,1.3,.4,1);background:linear-gradient(90deg,rgba(255,210,74,0),rgba(255,210,74,.95) 22%,rgba(255,210,74,.95) 78%,rgba(255,210,74,0));color:var(--accent-ink)}
#meta .res.lost .rh{background:linear-gradient(90deg,rgba(255,90,106,0),rgba(255,90,106,.9) 22%,rgba(255,90,106,.9) 78%,rgba(255,90,106,0));color:#2a070c}
#meta .res .rh small{display:block;font-size:var(--fs-s);font-weight:900;letter-spacing:.4em}
#meta .res .rh b{font-size:var(--fs-3xl);font-weight:900;font-style:italic;letter-spacing:.08em;line-height:1.1}
@keyframes rhIn{from{transform:rotate(-3deg) scaleX(.2);opacity:0}}
#meta .res .stars{font-size:13cqw;margin:var(--sp-4) 0 var(--sp-3);gap:.12em}
#meta .res .stars .ic{animation:starIn .4s cubic-bezier(.2,1.6,.4,1) backwards}
#meta .res .stars .ic:nth-child(1){animation-delay:.35s}#meta .res .stars .ic:nth-child(2){animation-delay:.61s;transform:translateY(-1.6cqw) scale(1.14)}#meta .res .stars .ic:nth-child(3){animation-delay:.87s}
@keyframes starIn{from{transform:scale(2.6) rotate(-40deg);opacity:0}}
#meta .res.seen :is(.rh,.stars .ic){animation:none}
#meta .res .note.lost{margin:var(--sp-6) 0 var(--sp-4);font-size:var(--fs-m);font-weight:800;color:var(--text)}
#meta .lines{display:flex;flex-direction:column;font-size:var(--fs-m)}
#meta .lines div{display:flex;justify-content:space-between;align-items:center;padding:var(--sp-2) 0;border-bottom:var(--bw) solid var(--line);color:var(--text-2);font-weight:700}
#meta .lines div span:last-child{color:var(--text);font-weight:900;font-variant-numeric:tabular-nums}
#meta .lines .sum{border:0;padding-bottom:0;font-size:var(--fs-l);color:var(--text)}
#meta .lines .sum span:last-child{color:var(--accent);font-size:var(--fs-xl);font-style:italic;display:inline-flex;align-items:center;gap:.3em}
#meta .lines .sum small{font-size:var(--fs-xs);color:var(--text-3);font-weight:700;margin-left:.6em;font-style:normal}

/* ---------- 新隊員加入、獲得物品 ---------- */
#meta .rays{position:absolute;left:50%;top:38%;width:220cqw;height:220cqw;margin:-110cqw 0 0 -110cqw;pointer-events:none;border-radius:50%;
  background:repeating-conic-gradient(rgba(var(--jc,255,210,74),.22) 0 7deg,rgba(var(--jc,255,210,74),0) 7deg 20deg);-webkit-mask-image:radial-gradient(circle,#000 10%,transparent 62%);mask-image:radial-gradient(circle,#000 10%,transparent 62%);animation:spin 40s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
#meta .join{align-items:center;overflow:hidden;padding:calc(var(--sat) + 3cqh) var(--sp-4) 0;background:radial-gradient(ellipse at 50% 38%,rgba(var(--jc),.42),rgba(20,26,51,0) 62%),var(--ink-2)}
#meta .join .jt{position:relative;text-align:center}
#meta .join .jt b{display:block;font-size:var(--fs-2xl);font-weight:900;font-style:italic;letter-spacing:.1em}
#meta .join .jp{position:relative;flex:1;min-height:0;width:100%;display:flex;justify-content:center;animation:joinIn .5s cubic-bezier(.2,1.3,.4,1)}
#meta .join .jp img{height:100%;max-width:none;display:block}
@keyframes joinIn{from{transform:translateY(6cqh) scale(.92);opacity:0}}
#meta .join .jb{position:relative;width:100%;margin-top:-9cqh;display:flex;flex-direction:column;gap:var(--sp-2);align-items:center;padding-top:6cqh;background:linear-gradient(180deg,rgba(13,17,34,0),rgba(13,17,34,.92) 34%)}
#meta .join .jn{font-size:var(--fs-3xl);font-weight:900;font-style:italic;line-height:1.05;text-shadow:0 .6cqw 0 var(--ink-0)}
#meta .join .jr{font-size:var(--fs-m);font-weight:800;color:var(--info);display:flex;align-items:center;gap:var(--sp-2)}
#meta .join .pn{width:100%;font-size:var(--fs-m);line-height:1.6;text-align:center;padding:var(--sp-3) var(--sp-4)}
#meta .rw{overflow:hidden;background:rgba(4,6,14,.9)}
#meta .rw .dlg{align-items:center;position:relative}
#meta .rw h3{color:var(--accent)}
#meta .items{display:flex;flex-wrap:wrap;justify-content:center;gap:var(--sp-3)}
#meta .it{width:22cqw;display:flex;flex-direction:column;align-items:center;gap:var(--sp-1);font-size:var(--fs-s);font-weight:800;text-align:center;animation:starIn .4s cubic-bezier(.2,1.4,.4,1) backwards}
#meta .it i{position:relative;width:18cqw;height:18cqw;display:flex;align-items:center;justify-content:center;font-size:9cqw;background:linear-gradient(180deg,rgba(255,255,255,.14),rgba(255,255,255,.02));border:var(--bw) solid var(--rc,var(--r3));border-radius:var(--r-m);box-shadow:inset 0 -1.6cqw 0 rgba(0,0,0,.25),0 0 4cqw -1cqw var(--rc,var(--r3));color:var(--rc,var(--r3))}
#meta .it b{font-size:var(--fs-m);color:var(--accent);font-style:italic}

/* ---------- 隊員、角色詳情、編隊 ---------- */
#meta .roster{display:grid;grid-template-columns:repeat(3,1fr);gap:var(--sp-2)}
#meta .rc{position:relative;aspect-ratio:3/4.6;overflow:hidden;border-radius:var(--r-m);border:var(--bw) solid var(--line-2);background:linear-gradient(180deg,rgba(var(--jc,90,100,160),.5),#161c3a 70%);text-align:left;display:block;transition:transform .08s}
#meta .rc.in{border-color:var(--accent)}
#meta .rc.in:active{transform:scale(.96)}
#meta .rc img{position:absolute;left:50%;top:2%;height:150%;transform:translateX(-50%)}
#meta .rc.no img{filter:brightness(0);opacity:.55}
#meta .rc .lk{position:absolute;left:0;right:0;top:30%;text-align:center;font-size:var(--fs-2xl);color:var(--text-2)}
#meta .rc .tg{position:absolute;top:var(--sp-1);left:var(--sp-1)}
#meta .rc .ro{position:absolute;top:var(--sp-1);right:var(--sp-1);width:6.4cqw;height:6.4cqw;display:flex;align-items:center;justify-content:center;font-size:var(--fs-m);background:rgba(7,9,18,.8);border-radius:50%;color:var(--info)}
#meta .rc .nm{position:absolute;left:0;right:0;bottom:0;background:linear-gradient(180deg,rgba(7,9,18,0),rgba(7,9,18,.94) 34%);padding:5cqw var(--sp-2) var(--sp-2);font-size:var(--fs-l);font-weight:900;font-style:italic}
#meta .rc .nm small{display:block;font-size:var(--fs-xs);font-weight:700;font-style:normal;color:var(--text-2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#meta .rc .nm em{display:block;font-style:normal;font-size:var(--fs-xs);color:var(--accent);font-weight:800}
#meta .rc .nm em.rest{color:var(--text-3)}
#meta .chain{display:flex;align-items:center;justify-content:center;gap:var(--sp-2)}
#meta .chain .cs{display:flex;flex-direction:column;align-items:center;gap:var(--sp-1);font-size:var(--fs-xs);font-weight:800;color:var(--text-2);min-width:19cqw}
#meta .chain .avs{display:flex;gap:var(--sp-1)}
#meta .chain .cs .av{width:12.5cqw;height:12.5cqw}
#meta .chain .cs.no .av{border-style:dashed;background:rgba(7,9,18,.5);display:flex;align-items:center;justify-content:center;color:var(--text-3);font-size:var(--fs-l);font-weight:900;font-style:italic}
#meta .chain .ic{color:var(--text-3);font-size:var(--fs-l);margin-bottom:5cqw}
#meta .dth{position:relative;height:62cqw;flex:none;overflow:hidden;border-radius:var(--r-m);border:var(--bw) solid var(--line-2);background:radial-gradient(ellipse at 70% 30%,rgba(var(--jc),.55),rgba(20,26,51,0) 70%),linear-gradient(180deg,#232c58,#141a33)}
#meta .dth img{position:absolute;right:-4cqw;top:3%;height:200%}
#meta .dth::after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,rgba(13,17,34,.94) 0%,rgba(13,17,34,.7) 38%,rgba(13,17,34,0) 64%)}
#meta .dth .inf{position:absolute;left:var(--sp-4);top:var(--sp-3);bottom:var(--sp-3);width:50%;z-index:1;display:flex;flex-direction:column;gap:var(--sp-1);align-items:flex-start}
#meta .dth .inf small{font-size:var(--fs-xs);letter-spacing:.28em;color:var(--info);font-weight:800}
#meta .dth .inf b{font-size:var(--fs-3xl);font-weight:900;font-style:italic;line-height:1}
#meta .dth .inf .role{display:flex;align-items:center;gap:.4em;font-size:var(--fs-s);font-weight:800;color:var(--accent)}
#meta .dth .inf p{font-size:var(--fs-s);line-height:1.55;color:var(--text-2)}
#meta .forms{display:flex;gap:var(--sp-2)}
#meta .forms button{flex:1;min-height:44px;font-size:var(--fs-l);font-weight:900;font-style:italic;background:rgba(7,9,18,.6);border:var(--bw) solid var(--line-2);border-radius:var(--r-s);display:flex;align-items:center;justify-content:center}
#meta .forms button.on{background:var(--primary);color:var(--primary-ink);border-color:#c9ffec}
#meta .forms button:disabled{color:var(--text-3)}
#meta .wl{display:grid;grid-template-columns:repeat(3,1fr);gap:var(--sp-2)}
#meta .wl div{display:flex;flex-direction:column;align-items:center;gap:.2cqw;background:rgba(20,26,51,.92);border:var(--bw) solid var(--line);border-radius:var(--r-s);padding:var(--sp-2) var(--sp-1);font-size:var(--fs-s);font-weight:800;text-align:center}
#meta .wl div .ic{font-size:var(--fs-xl);color:var(--info)}
#meta .wl div small{font-size:var(--fs-xs);color:var(--text-3);font-weight:700}
#meta .wl div.off{opacity:.42}
#meta .wl div.off .ic{color:var(--text-3)}
#meta .tiles{display:grid;grid-template-columns:repeat(3,1fr);gap:var(--sp-2)}
#meta .tiles div{background:rgba(20,26,51,.92);border:var(--bw) solid var(--line);border-radius:var(--r-s);padding:var(--sp-2);text-align:center;font-size:var(--fs-xs);color:var(--text-2);font-weight:700}
#meta .tiles b{display:block;font-size:var(--fs-xl);font-weight:900;font-style:italic;color:var(--text)}
#meta .field{position:relative;height:66cqw;flex:none;border-radius:var(--r-m);border:var(--bw) solid var(--line-2);overflow:hidden;
  background:linear-gradient(180deg,rgba(255,255,255,.06),rgba(255,255,255,0) 30%),repeating-linear-gradient(90deg,transparent 0 32.8%,rgba(255,255,255,.14) 32.8% 33.4%),linear-gradient(180deg,#2c345e,#191f3c)}
#meta .field .fw{position:absolute;top:var(--sp-2);left:50%;transform:translateX(-50%);font-size:var(--fs-xs);color:var(--text-2);font-weight:800;letter-spacing:.3em;display:flex;flex-direction:column;align-items:center}
#meta .field .fw .ic{transform:rotate(-90deg)}
#meta .pos{position:absolute;width:17cqw;height:17cqw;transform:translate(-50%,-50%);border-radius:var(--r-m);border:var(--bw) dashed var(--line-2);background:rgba(7,9,18,.5) no-repeat;display:flex;align-items:flex-end;justify-content:center;font-size:var(--fs-xs);font-weight:900;overflow:hidden}
#meta .pos.in{border-style:solid;border-color:var(--accent)}
#meta .pos span{background:rgba(7,9,18,.85);width:100%;text-align:center;padding:.2cqh 0}

/* ---------- 養成 ---------- */
#meta .seg{display:flex;gap:var(--sp-1);flex:none}
#meta .seg button{flex:1;min-height:44px;font-size:var(--fs-m);font-weight:900;font-style:italic;color:var(--text-2);background:rgba(7,9,18,.6);border:var(--bw) solid var(--line);position:relative}
#meta .seg button.on{color:var(--primary-ink);background:var(--primary);border-color:#c9ffec}
#meta .cost{display:inline-flex;align-items:center;gap:.3em;font-size:var(--fs-s);font-weight:900;font-variant-numeric:tabular-nums;padding:.2em .7em;background:rgba(7,9,18,.6);border-radius:99px;border:var(--bw) solid var(--line)}
#meta .cost small{color:var(--text-3);font-weight:700}
#meta .cost.lack{color:var(--danger);border-color:rgba(255,90,106,.5)}
#meta .costs{display:flex;flex-wrap:wrap;gap:var(--sp-2);align-items:center}
#meta .grow1{display:flex;flex-direction:column;gap:var(--sp-3)}
#meta .lvrow{display:flex;align-items:baseline;gap:var(--sp-2)}
#meta .lvrow b{font-size:var(--fs-2xl);font-weight:900;font-style:italic;line-height:1}
#meta .lvrow small{font-size:var(--fs-s);color:var(--text-2);font-weight:800}
#meta .fxline{font-size:var(--fs-s);color:var(--text-2);line-height:1.6}
#meta .fxline b{color:var(--ok)}
#meta .act{display:flex;align-items:center;justify-content:space-between;gap:var(--sp-3)}
#meta .stline{display:flex;align-items:center;gap:var(--sp-3);padding:var(--sp-2) 0;border-bottom:var(--bw) solid var(--line);font-size:var(--fs-s);font-weight:700;color:var(--text-2)}
#meta .stline:last-child{border:0}
#meta .stline .stars{font-size:var(--fs-s);flex:none;width:6.6em}
#meta .stline.on{color:var(--text)}
#meta .stline .ic.chk{margin-left:auto;color:var(--primary);font-size:var(--fs-l)}
#meta .bigstars{font-size:var(--fs-2xl);justify-content:center;display:flex}
#meta .sk{display:flex;flex-direction:column;gap:var(--sp-2)}
#meta .sk .hd{display:flex;align-items:center;gap:var(--sp-3)}
#meta .sk .hd>i{width:11cqw;height:11cqw;flex:none;display:flex;align-items:center;justify-content:center;font-size:6.4cqw;color:var(--info);background:rgba(111,242,230,.12);border:var(--bw) solid var(--info);border-radius:var(--r-m)}
#meta .sk .hd b{font-size:var(--fs-l);font-weight:900;font-style:italic}
#meta .sk .hd small{display:block;font-size:var(--fs-xs);color:var(--text-2);font-weight:800}
#meta .rc .lvb{position:absolute;left:var(--sp-1);top:7.4cqw;font-size:var(--fs-xs);font-weight:900;font-style:italic;background:rgba(7,9,18,.82);padding:0 .6em;border-radius:99px}
#meta .rc .stars{font-size:var(--fs-xs);display:flex}
#meta .mats{display:flex;gap:var(--sp-2);flex-wrap:wrap}
#meta .dth .lvb{font-size:var(--fs-m);font-weight:900;font-style:italic;display:flex;align-items:center;gap:var(--sp-2)}
#meta .dth .lvb .stars{font-size:var(--fs-s)}

/* ---------- 招募 ---------- */
#meta .gbn{position:relative;height:62cqw;flex:none;overflow:hidden;border-radius:var(--r-m);border:var(--bw) solid var(--r3);background:#17183c}
#meta .gbn img{position:absolute;left:0;top:-58%;width:100%}
#meta .gbn::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(13,17,34,.1) 30%,rgba(13,17,34,.95) 88%)}
#meta .gbn .tx{position:absolute;left:var(--sp-4);right:var(--sp-4);bottom:var(--sp-3);z-index:1}
#meta .gbn .tx b{display:block;font-size:var(--fs-2xl);font-weight:900;font-style:italic;text-shadow:0 .6cqw 0 var(--ink-0)}
#meta .gbn .tx span{font-size:var(--fs-s);font-weight:800;color:var(--text-2)}
#meta .pulls{display:grid;grid-template-columns:1fr 1fr;gap:var(--sp-3)}
#meta .pulls .bt{flex-direction:column;gap:.2cqw;min-height:max(60px,17cqw);padding:0 2cqw;line-height:1.2}
#meta .pulls .bt small{display:flex;align-items:center;gap:.3em}
#meta .rates{width:100%;border-collapse:collapse;font-size:var(--fs-s)}
#meta .rates td{padding:var(--sp-2) var(--sp-1);border-bottom:var(--bw) solid var(--line);vertical-align:top;text-align:left;color:var(--text-2);line-height:1.5}
#meta .rates td:first-child{font-weight:900;font-style:italic;white-space:nowrap;color:var(--rc)}
#meta .rates td:nth-child(2){font-weight:900;color:var(--text);white-space:nowrap}
#meta .rv{flex-direction:column;gap:var(--sp-4);background:rgba(4,6,14,.94);overflow:hidden}
#meta .rv h3{font-size:var(--fs-xl);font-weight:900;font-style:italic;letter-spacing:.2em;color:var(--accent);position:relative}
#meta .cards{position:relative;display:grid;grid-template-columns:repeat(5,1fr);gap:var(--sp-2);width:100%}
#meta .cards.one{grid-template-columns:40cqw;justify-content:center}
#meta .cd{position:relative;aspect-ratio:3/4.2;perspective:60cqw}
#meta .cd>div{position:absolute;inset:0;transition:transform .45s cubic-bezier(.3,1.3,.5,1);transform-style:preserve-3d;transform:rotateY(180deg)}
#meta .cd.open>div{transform:none}
#meta .cd .f,#meta .cd .bk{position:absolute;inset:0;backface-visibility:hidden;-webkit-backface-visibility:hidden;border-radius:var(--r-s);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:.6cqw;text-align:center;font-size:var(--fs-xs);font-weight:900;overflow:hidden}
#meta .cd .bk{transform:rotateY(180deg);background:repeating-linear-gradient(135deg,#1d2547 0 1.6cqw,#232c58 1.6cqw 3.2cqw);border:var(--bw) solid var(--line-2);color:var(--primary);font-size:6cqw}
#meta .cd .f{background:linear-gradient(180deg,rgba(255,255,255,.16),rgba(255,255,255,.02)),#141a33;border:.6cqw solid var(--rc);box-shadow:inset 0 0 4cqw -1cqw var(--rc);color:var(--text)}
#meta .cd .f>.ic{font-size:7cqw;color:var(--rc)}
#meta .cd .f .av{width:11cqw;height:11cqw;border-color:var(--rc)}
#meta .cd .f b{color:var(--accent);font-style:italic}
#meta .cd .f em{position:absolute;top:0;left:0;right:0;font-style:italic;font-size:var(--fs-xs);color:var(--ink-0);background:var(--rc);line-height:1.5}
#meta .cd.r4.open{animation:cdGlow 1.2s ease-in-out infinite}
#meta .cd.r4.open .f{box-shadow:inset 0 0 6cqw var(--rc),0 0 5cqw var(--rc)}
#meta .cd.r3.open .f{box-shadow:inset 0 0 5cqw -1cqw var(--rc),0 0 3cqw -1cqw var(--rc)}
@keyframes cdGlow{50%{transform:scale(1.06)}}
#meta .cards.one .cd .f{font-size:var(--fs-m)}
#meta .cards.one .cd .f>.ic{font-size:16cqw}
#meta .cards.one .cd .f .av{width:24cqw;height:24cqw}
#meta .drops{display:flex;flex-wrap:wrap;gap:var(--sp-2);align-items:center}
#meta .drops>small{font-size:var(--fs-xs);font-weight:900;color:var(--text-2);letter-spacing:.1em;min-width:4.2em}
#meta .drops .cost.got{opacity:.4;text-decoration:line-through}

/* ---------- 每日內容：任務、成就、簽到、信箱、商店、無盡 ---------- */
#meta .lside .ib.lab{position:relative}
#meta .offl{position:absolute;left:var(--sp-4);top:calc(var(--sat) + var(--hit) + var(--sp-6));z-index:2;display:flex;align-items:center;gap:var(--sp-2);min-height:44px;padding:0 var(--sp-3);font-size:var(--fs-s);font-weight:900;background:rgba(7,9,18,.8);border:var(--bw) solid var(--accent);border-radius:var(--r-m);color:var(--accent);animation:breath 1.6s ease-in-out infinite}
#meta .offl small{color:var(--text-2);font-weight:700}
#meta .ms{display:flex;flex-direction:column;gap:var(--sp-2);padding:var(--sp-3);background:rgba(20,26,51,.92);border:var(--bw) solid var(--line);border-radius:var(--r-m)}
#meta .ms.done{border-color:var(--accent)}
#meta .ms.got{opacity:.5}
#meta .ms .hd{display:flex;align-items:center;gap:var(--sp-2);font-size:var(--fs-m);font-weight:800}
#meta .ms .hd span{flex:1;min-width:0}
#meta .ms .hd small{font-size:var(--fs-s);color:var(--text-2);font-variant-numeric:tabular-nums;white-space:nowrap}
#meta .ms .ft{display:flex;align-items:center;justify-content:space-between;gap:var(--sp-2)}
#meta .ms .bt.sm{min-width:20cqw}
#meta .chest{display:flex;flex-direction:column;gap:var(--sp-2);--pn-line:var(--accent)}
#meta .chest b{font-size:var(--fs-l);font-style:italic;display:flex;align-items:center;gap:var(--sp-2)}
#meta .chest b .ic{color:var(--accent);font-size:var(--fs-xl)}
#meta .days{display:grid;grid-template-columns:repeat(4,1fr);gap:var(--sp-2);width:100%}
#meta .dayc{position:relative;display:flex;flex-direction:column;align-items:center;gap:.4cqw;padding:var(--sp-2) var(--sp-1);background:rgba(7,9,18,.6);border:var(--bw) solid var(--line);border-radius:var(--r-s);font-size:var(--fs-xs);font-weight:800;text-align:center}
#meta .dayc:last-child{grid-column:span 2;border-color:var(--r3)}
#meta .dayc.now{border-color:var(--accent);box-shadow:0 0 3cqw -1cqw var(--accent)}
#meta .dayc.past{opacity:.45}
#meta .dayc b{font-style:italic;color:var(--text-2)}
#meta .dayc .cost{font-size:var(--fs-xs);padding:.1em .5em}
#meta .dayc .ic.chk{position:absolute;top:.6cqw;right:.6cqw;color:var(--primary)}
#meta .mailc{display:flex;flex-direction:column;gap:var(--sp-2);padding:var(--sp-3);background:rgba(20,26,51,.92);border:var(--bw) solid var(--line-2);border-radius:var(--r-m)}
#meta .mailc.got{opacity:.5;border-color:var(--line)}
#meta .mailc b{font-size:var(--fs-m);display:flex;align-items:center;gap:var(--sp-2)}
#meta .mailc p{font-size:var(--fs-s);color:var(--text-2);line-height:1.6}
#meta .goods{display:grid;grid-template-columns:repeat(3,1fr);gap:var(--sp-2)}
#meta .gd{position:relative;display:flex;flex-direction:column;align-items:center;gap:.6cqw;padding:var(--sp-3) var(--sp-1) var(--sp-2);background:rgba(20,26,51,.92);border:var(--bw) solid var(--rc,var(--line-2));border-radius:var(--r-m);font-size:var(--fs-xs);font-weight:800;text-align:center}
#meta .gd>i{width:13cqw;height:13cqw;display:flex;align-items:center;justify-content:center;font-size:7.5cqw;color:var(--rc);background:rgba(255,255,255,.06);border-radius:var(--r-s)}
#meta .gd>b{font-size:var(--fs-s)}
#meta .gd small{color:var(--text-3);font-weight:700}
#meta .gd .bt.sm{width:100%;padding:0;font-size:var(--fs-s);min-height:44px;height:44px;gap:.3em}
#meta .gd .tg{position:absolute;top:-1.4cqw;left:-1cqw}
#meta .gd s{color:var(--text-3);font-size:var(--fs-xs)}
#meta .gd.out{opacity:.45}
#meta .ebig{text-align:center}
#meta .ebig b{display:block;font-size:var(--fs-3xl);font-weight:900;font-style:italic;line-height:1.1;color:var(--accent)}
#meta .ebig small{font-size:var(--fs-s);color:var(--text-2);font-weight:800}
#meta .rec{display:flex;align-items:center;gap:var(--sp-3);padding:var(--sp-2) var(--sp-3);font-size:var(--fs-s);font-weight:800;border-bottom:var(--bw) solid var(--line)}
#meta .rec:last-child{border:0}
#meta .rec i{width:1.6em;font-style:italic;font-weight:900;color:var(--accent)}
#meta .rec span{flex:1}
#meta .rec small{color:var(--text-3);font-weight:700}
#meta .modesw{display:flex;gap:0;flex:none}
#meta .modesw button{min-height:44px;min-width:46px;padding:0 3cqw;font-size:var(--fs-s);font-weight:900;font-style:italic;color:var(--text-2);background:rgba(7,9,18,.7);border:var(--bw) solid var(--line-2)}
#meta .modesw button.on{background:var(--danger);color:#2a070c;border-color:#ffc9cf}
#meta .modesw button:first-child.on{background:var(--primary);color:var(--primary-ink);border-color:#c9ffec}
#metaHud .hFx{position:absolute;right:3cqw;top:calc(var(--sat) + 2.4cqw + 44px + 1.2cqw);display:flex;gap:1.2cqw}
#metaHud .hFx span{display:flex;align-items:center;gap:.3em;padding:.2em .8em;font-size:var(--fs-s);font-weight:900;font-style:italic;background:rgba(10,14,30,.84);clip-path:polygon(1.6cqw 0,100% 0,calc(100% - 1.6cqw) 100%,0 100%)}
#metaHud .hFx .up{color:var(--accent)}
#metaHud .hFx .dn{color:#7fb4ff}

/* ---------- 基地 ---------- */
#meta .up{display:flex;flex-direction:column;gap:var(--sp-2)}
#meta .up .hd{display:flex;align-items:center;gap:var(--sp-3)}
#meta .up .hd>i{width:12cqw;height:12cqw;flex:none;display:flex;align-items:center;justify-content:center;font-size:7cqw;color:var(--primary);background:rgba(47,211,160,.14);border:var(--bw) solid var(--primary);border-radius:var(--r-m)}
#meta .up .hd b{font-size:var(--fs-l);font-weight:900;font-style:italic}
#meta .up .hd small{display:block;font-size:var(--fs-xs);color:var(--text-2);font-weight:800}
#meta .up .fx{font-size:var(--fs-s);color:var(--text-2);display:flex;flex-direction:column;gap:.3cqw}
#meta .up .fx b{color:var(--ok)}
#meta .up .ft{display:flex;align-items:flex-end;justify-content:space-between;gap:var(--sp-3)}

/* ---------- 設定 ---------- */
#meta .set{display:flex;justify-content:space-between;align-items:center;gap:var(--sp-3);font-size:var(--fs-m);font-weight:800;min-height:var(--hit)}
#meta .set>span{display:flex;align-items:center;gap:var(--sp-2)}
#meta .set>span .ic{color:var(--info);font-size:var(--fs-xl)}
#meta .grid{display:grid;grid-template-columns:1fr 1fr;gap:var(--sp-2)}
#meta .grid .bt{padding:0 var(--sp-2);font-size:var(--fs-xs);font-style:normal;letter-spacing:0}
#meta .verline{text-align:center;font-size:var(--fs-xs);color:var(--text-3);font-weight:700}

/* ---------- 引導：戰鬥入面嘅分步提示、大廳嘅指住掣 ---------- */
#metaHud .coach{position:absolute;left:5cqw;right:5cqw;bottom:calc(var(--sab) + 1.2cqh + max(46px,15cqw) + 4cqw);display:flex;flex-direction:column-reverse;align-items:center;gap:var(--sp-2);text-align:center;animation:dlgIn .24s cubic-bezier(.2,1.2,.4,1)}
#metaHud .coach .pn{width:100%;padding:var(--sp-3) var(--sp-4);font-size:var(--fs-l);font-weight:900;line-height:1.45;--pn-line:var(--info);--pn-bg:rgba(10,14,30,.92)}
#metaHud .coach .pn small{display:block;font-size:var(--fs-xs);letter-spacing:.24em;color:var(--info);margin-bottom:.2em}
#metaHud .coach .bt{pointer-events:auto;align-self:flex-end;min-height:44px;height:44px;font-size:var(--fs-s)}
#metaHud .coach.top{bottom:auto;top:calc(var(--sat) + 2.4cqw + 44px + 17cqw);flex-direction:column}
#metaHud .cmark{position:absolute;width:0;height:0;pointer-events:none}
#metaHud .cmark::before{content:"";position:absolute;left:-7cqw;top:-7cqw;width:14cqw;height:14cqw;border-radius:50%;border:.8cqw solid var(--accent);box-shadow:0 0 4cqw var(--accent),inset 0 0 3cqw rgba(255,210,74,.5);animation:markPulse 1s ease-in-out infinite}
#metaHud .cmark::after{content:"";position:absolute;left:-3.2cqw;top:-19cqw;border:3.2cqw solid transparent;border-top:5.5cqw solid var(--accent);filter:drop-shadow(0 .5cqw 0 rgba(4,6,14,.7));animation:markDrop .7s ease-in-out infinite}
@keyframes markPulse{50%{transform:scale(1.25);opacity:.6}}
@keyframes markDrop{50%{transform:translateY(2.6cqw)}}
:is(#metaHud,#meta) .finger{position:absolute;font-size:13cqw;color:#fff;filter:drop-shadow(0 .6cqw 0 rgba(4,6,14,.75));pointer-events:none;margin:-1cqw 0 0 -4.6cqw}
#metaHud .finger.drag{bottom:31cqh;left:var(--fx0,35%);animation:fingerDrag 1.5s ease-in-out infinite}
@keyframes fingerDrag{0%{left:var(--fx0,35%);opacity:0}15%{opacity:1}70%{left:var(--fx1,65%);opacity:1}100%{left:var(--fx1,65%);opacity:0}}
:is(#metaHud,#meta) .finger.tap{animation:fingerTap .8s ease-in-out infinite}
@keyframes fingerTap{50%{transform:translateY(-2.4cqw) scale(1.08)}}
#meta .spot{position:absolute;z-index:15;pointer-events:none;border-radius:var(--r-m);border:.8cqw solid var(--accent);box-shadow:0 0 0 200cqh rgba(4,6,14,.62),0 0 5cqw var(--accent);animation:spotIn .3s}
@keyframes spotIn{from{opacity:0;transform:scale(1.3)}}
#meta .spotTip{position:absolute;z-index:16;left:6cqw;right:6cqw;pointer-events:none;text-align:center;font-size:var(--fs-l);font-weight:900;padding:var(--sp-3) var(--sp-4);--pn-line:var(--accent);--pn-bg:rgba(10,14,30,.95)}
#meta .tabs button.lock{color:var(--ink-4)}
#meta .tabs button.lock .ic:first-child{opacity:.5}
#meta .tabs button.lock i:not(.dot){position:absolute;top:18%;left:50%;font-size:var(--fs-m);color:var(--text-2);display:flex}
#meta .unl{align-items:center}
#meta .unl .big{width:22cqw;height:22cqw;display:flex;align-items:center;justify-content:center;font-size:12cqw;color:var(--primary);background:rgba(47,211,160,.14);border:var(--bw) solid var(--primary);border-radius:var(--r-m);animation:starIn .45s cubic-bezier(.2,1.5,.4,1)}
#meta .unl small{font-size:var(--fs-s);font-weight:900;letter-spacing:.3em;color:var(--accent)}

/* ---------- 故事對話 ---------- */
#meta .story{overflow:hidden;cursor:pointer}
#meta .story .kvbg{opacity:.34;filter:saturate(.6)}
#meta .story .ch{position:absolute;left:0;right:0;top:calc(var(--sat) + 7cqh);text-align:center;z-index:2;animation:scrIn .5s}
#meta .story .ch b{display:block;font-size:var(--fs-2xl);font-weight:900;font-style:italic;letter-spacing:.1em;margin-top:var(--sp-2);text-shadow:0 .6cqw 0 var(--ink-0)}
#meta .story .who{position:absolute;left:50%;bottom:calc(var(--sab) + 30cqw);height:64cqh;transform:translateX(-50%);z-index:1;transition:opacity .2s,filter .2s}
#meta .story .who img{height:100%;display:block;animation:whoIn .3s cubic-bezier(.2,.9,.3,1)}
@keyframes whoIn{from{transform:translateY(3cqw);opacity:0}}
#meta .story .who.off{filter:brightness(.4) saturate(.5)}
#meta .story .say{position:absolute;left:var(--sp-4);right:var(--sp-4);bottom:calc(var(--sab) + var(--sp-4));z-index:3;min-height:36cqw;padding:var(--sp-6) var(--sp-4) var(--sp-4);font-size:var(--fs-l);line-height:1.65;font-weight:700;--pn-bg:rgba(10,14,30,.94);--pn-line:rgb(var(--jc,111,242,230))}
#meta .story .say .nm{position:absolute;left:var(--sp-4);top:-3.4cqw;font-size:var(--fs-m);font-style:italic;font-weight:900;padding:.2em 1.4em .2em 1em;color:var(--ink-0);background:rgb(var(--jc,111,242,230));clip-path:polygon(.6em 0,100% 0,calc(100% - .6em) 100%,0 100%)}
#meta .story .say .nx{position:absolute;right:var(--sp-4);bottom:var(--sp-2);color:var(--accent);font-size:var(--fs-l);display:flex;animation:markDrop .8s ease-in-out infinite}
#meta .story .skip{position:absolute;right:var(--sp-4);top:calc(var(--sat) + var(--sp-2));z-index:4}
#meta .chtag{position:absolute;left:0;right:0;display:flex;justify-content:center;pointer-events:none}
#meta .chtag span{display:inline-flex;gap:.6em;padding:.25em 1.6em;font-size:var(--fs-s);font-weight:900;font-style:italic;letter-spacing:.14em;color:var(--text);background:linear-gradient(90deg,rgba(111,242,230,0),rgba(111,242,230,.22) 20%,rgba(111,242,230,.22) 80%,rgba(111,242,230,0))}
#meta .chtag em{font-style:normal;color:var(--info)}

/* ---------- 戰鬥介面 ---------- */
#metaHud .hTop{position:absolute;left:3cqw;right:3cqw;top:calc(var(--sat) + 2.4cqw);display:flex;align-items:center;gap:2.4cqw}
#metaHud [hidden]{display:none!important}
#metaHud .hStage{position:relative;isolation:isolate;padding:.25em 1.1em .25em .9em;font-size:var(--fs-l);font-weight:900;font-style:italic;white-space:nowrap;filter:var(--shadow)}
#metaHud .hStage::before{content:"";position:absolute;inset:0;z-index:-1;background:linear-gradient(90deg,var(--primary) 0 1.4cqw,rgba(10,14,30,.9) 1.4cqw);clip-path:polygon(2.2cqw 0,100% 0,calc(100% - 2.2cqw) 100%,0 100%)}
#metaHud .hProg{position:relative;flex:1;height:44px;display:flex;align-items:center}
#metaHud .hProg .trk{position:relative;flex:1;height:max(5px,1.5cqw);background:rgba(7,9,18,.78);box-shadow:0 0 0 var(--bw) rgba(255,255,255,.28);transform:skewX(-30deg);margin-right:5.6cqw}
#metaHud .hProg .trk i{position:absolute;left:0;top:0;bottom:0;width:calc(var(--v,0)*100%);background:linear-gradient(90deg,var(--primary),var(--info))}
#metaHud .hProg .run{position:absolute;top:50%;left:calc((100% - 5.6cqw)*var(--v,0));width:3cqw;height:3cqw;min-width:10px;min-height:10px;margin:-1.5cqw 0 0 -1.5cqw;background:#fff;border:.5cqw solid var(--ink-0);transform:rotate(45deg)}
#metaHud .hProg .end{position:absolute;right:0;top:50%;transform:translateY(-50%);font-size:var(--fs-xl);color:var(--danger);display:flex;filter:drop-shadow(0 .3cqw 0 rgba(4,6,14,.8))}
#metaHud .hProg.boss .end{animation:bossPulse .7s ease-in-out infinite}
@keyframes bossPulse{50%{transform:translateY(-50%) scale(1.3)}}
#metaPause{pointer-events:auto}
#metaHud .hWeap{position:absolute;left:3cqw;top:calc(var(--sat) + 2.4cqw + 44px + 1.2cqw);display:flex;align-items:center;gap:.5em;padding:.2em 1em .2em .7em;font-size:var(--fs-s);font-weight:900;font-style:italic;white-space:nowrap;
  color:rgb(var(--fc,255,255,255));background:rgba(10,14,30,.84);clip-path:polygon(1.6cqw 0,100% 0,calc(100% - 1.6cqw) 100%,0 100%)}
#metaHud .hWeap.up{animation:numPop .5s}
#metaHud .hBurst{position:absolute;left:28cqw;right:28cqw;top:calc(var(--sat) + 2.4cqw + 44px + 9.6cqw);text-align:center;font-size:var(--fs-s);font-weight:900;font-style:italic;color:var(--accent);text-shadow:0 .4cqw 0 var(--ink-0)}
#metaHud .hBurst .pb{margin-top:.6cqw;background:rgba(7,9,18,.72)}
#metaHud .hBurst .pb i{transition:none}
#metaHud .hBurst.low .pb i{background:linear-gradient(90deg,#e8643c,var(--warn))}
#metaTeam{position:absolute;left:0;right:0;bottom:calc(var(--sab) + 1.2cqh);display:flex;justify-content:center;align-items:flex-end;gap:1.6cqw}
#metaTeam .slot{width:11cqw;height:11cqw;border-radius:var(--r-m);border:var(--bw) dashed rgba(255,255,255,.22);background:rgba(7,9,18,.25);position:relative;overflow:hidden}
#metaTeam .slot.lead{width:15cqw;height:15cqw;min-width:46px;min-height:46px;border:.6cqw solid rgba(255,255,255,.5);background-color:var(--ink-3);background-repeat:no-repeat;box-shadow:0 .8cqw 0 rgba(4,6,14,.6)}
#metaTeam .slot.lead i{position:absolute;left:0;bottom:0;height:1.9cqw;width:calc(var(--c,0)*100%);background:linear-gradient(90deg,var(--primary),var(--info));z-index:1}
#metaTeam .slot.lead::after{content:"";position:absolute;left:0;right:0;bottom:0;height:1.9cqw;background:rgba(7,9,18,.8)}
#metaTeam .slot.lead .tg{position:absolute;top:0;left:0;font-style:normal;clip-path:polygon(0 0,100% 0,calc(100% - .5em) 100%,0 100%);padding:.05em .9em .05em .5em}
#metaTeam .slot.lead.ready{border-color:var(--accent);box-shadow:0 0 3.5cqw var(--accent);animation:slotPulse .8s infinite}
#metaTeam .slot.lead.ready i{background:var(--accent)}
#metaTeam .slot.lead.on{border-color:#fff;box-shadow:0 0 4.5cqw #ffe9a8}
#metaTeam .slot.lead.on i{background:#fff}
@keyframes slotPulse{50%{transform:scale(1.1)}}
#metaTip{position:absolute;left:0;right:0;bottom:calc(var(--sab) + 1.2cqh + max(46px,15cqw) + 2.2cqw);text-align:center;font-size:var(--fs-s);font-weight:900;font-style:italic;color:var(--accent);text-shadow:0 .4cqw 0 var(--ink-0),0 0 2cqw #000}
`;

/**
 * @param {{ getMeta: () => import('../core/save.js').MetaSave, onPlay: (n: number) => void, onBuy: (key: string) => boolean, onBurst?: () => void }} api  onBurst = 玩家撳咗頭像（放爆發技）
 */
export function createCampaignUI(api) {
  installTheme(CSS);
  const root = document.createElement('div'); root.id = 'meta'; root.hidden = true; document.body.appendChild(root);
  const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
  const sound = (name) => api.onSound?.(name);
  /** 按鈕：cls 揀樣式（pri 主要、dan 危險、gold、sm 細、wide 滿闊）；撳落有聲（data-quiet 嘅自己出聲）。 */
  const btn = (label, cls, fn, disabled) => { const b = h('button', `bt ${cls ?? ''}`, label); b.type = 'button'; b.disabled = !!disabled; b.addEventListener('click', (ev) => { ev.stopPropagation(); if (!b.dataset.quiet) sound('ui_click'); fn(); }); return b; };
  /** 圖示掣（正方形）；label 有就係圖示下面一行細字。 */
  const ibtn = (name, fn, aria, label) => { const b = h('button', `ib ${label ? 'lab' : ''}`, icon(name) + (label ? `<span>${label}</span>` : '')); b.type = 'button'; b.setAttribute('aria-label', aria ?? label ?? name); b.addEventListener('click', (ev) => { ev.stopPropagation(); sound('ui_click'); fn(); }); return b; };
  const img = (src, alt = '') => { const i = document.createElement('img'); i.src = src; i.alt = alt; i.draggable = false; return i; };
  const stars = (n, max = 3) => `<span class="stars">${Array.from({ length: max }, (_, i) => icon('starFull', i < n ? '' : 'off')).join('')}</span>`;
  const FORM_MARK = ['I', 'II', 'III', 'IV'], lead = ROSTER.find((r) => r.leader);
  let screen = 'none', hintTimer = 0, cur = null;

  // ---------- 戰鬥介面：頂部（關卡牌、進度條、暫停鍵、武器牌、爆發時間條）同底部頭像列 ----------
  const hud = document.createElement('div'); hud.id = 'metaHud'; document.body.appendChild(hud);
  const hTop = h('div', 'hTop'), hStage = h('div', 'hStage'), hProg = h('div', 'hProg', `<div class="trk"><i></i></div><span class="run"></span><span class="end">${icon('boss')}</span>`);
  const pauseBtn = h('button', 'ib', icon('pause')); pauseBtn.id = 'metaPause'; pauseBtn.type = 'button'; pauseBtn.setAttribute('aria-label', '暫停');
  pauseBtn.addEventListener('click', (ev) => { ev.stopPropagation(); sound('ui_click'); pause(); });
  hTop.append(hStage, hProg, pauseBtn);
  const hWeap = h('div', 'hWeap'), hBurst = h('div', 'hBurst', '<span></span><div class="pb gold"><i></i></div>');
  // 頭像列：有人嘅位有頭像、段位（起／承／決）同爆發槽，滿咗會發光；冇人嘅係空插槽。
  // 發動 = 喺頭像上面「輕撳一下」（撳落到放手唔過 0.35 秒、手指冇點郁）。唔會攔住拖動：撳住頭像拖照樣係移動主角，唔會誤放。
  const teamBar = document.createElement('div'); teamBar.id = 'metaTeam';
  const tip = document.createElement('div'); tip.id = 'metaTip';
  // 引導（第一次玩）：一塊提示牌（第幾步、一句說明、跳過掣）、指住目標嘅記號、手指示意
  const coachBox = h('div', 'coach', '<div class="pn"><small></small><span></span></div>'), coachMark = h('div', 'cmark'), coachFinger = h('div', 'finger', icon('hand'));
  const skipBtn = h('button', 'bt sm', `跳過引導${icon('skip')}`); skipBtn.type = 'button'; skipBtn.dataset.skiptutor = '1'; coachBox.append(skipBtn);
  skipBtn.addEventListener('click', (ev) => { ev.stopPropagation(); sound('ui_click'); api.onSkipTutorial?.(); });
  const hFx = h('div', 'hFx');
  hud.append(hTop, hWeap, hBurst, hFx, tip, teamBar, coachBox, coachMark, coachFinger);
  for (const e of [hTop, hWeap, hBurst, hFx, tip, teamBar, coachBox, coachMark, coachFinger]) e.hidden = true;
  let coachId = null;
  /**
   * 每格叫一次：v = 引導而家要出嘅提示（meta/tutorial.js 嘅 tick 回傳；冇就 null），at = 目標喺畫面邊度、from = 隊長喺畫面邊度（像素，相對戰鬥畫面左上角）。
   */
  function coach(v, at, from) {
    const show = !!v && (screen === 'none' || screen === 'hint');
    if (!show) { if (!coachBox.hidden) { coachBox.hidden = coachMark.hidden = coachFinger.hidden = true; coachId = null; } return; }
    if (v.id !== coachId) {
      coachId = v.id; coachBox.hidden = false; coachBox.classList.toggle('top', v.finger === 'tap'); // 教撳頭像嗰步：牌擺上面，唔好遮住頭像
      coachBox.querySelector('small').textContent = v.step ? `引導 ${v.step} / ${v.total}` : '新招式';
      coachBox.querySelector('span').textContent = v.text;
      coachBox.style.animation = 'none'; void coachBox.offsetWidth; coachBox.style.animation = '';
      coachFinger.className = `finger ${v.finger}`; coachFinger.hidden = v.finger === 'none';
      if (v.finger === 'tap' && leadSlot) { const r = leadSlot.getBoundingClientRect(), b = hud.getBoundingClientRect(); coachFinger.style.cssText = `left:${r.left - b.left + r.width / 2}px;top:${r.top - b.top + r.height * 0.5}px`; }
      else coachFinger.style.cssText = '';
      sound('ui_click');
    }
    coachMark.hidden = !at;
    if (at) { coachMark.style.left = `${at.x}px`; coachMark.style.top = `${at.y}px`; }
    if (v.finger === 'drag') { const W = hud.clientWidth || 1, a = from ? from.x / W * 100 : 35, b = at ? at.x / W * 100 : a < 50 ? a + 30 : a - 30; coachFinger.style.setProperty('--fx0', `${a}%`); coachFinger.style.setProperty('--fx1', `${Math.abs(b - a) < 6 ? (a < 50 ? a + 28 : a - 28) : b}%`); }
  }
  // 頭像：由立繪裁塊面出嚟——裁切位喺角色表（face: [放大幾多, 位置]），換立繪就改嗰度
  const faceStyle = (el, id, form = 0) => { const r = rosterOf(id), f = r.faces?.[form] ?? r.face ?? ['320%', '50% 5%']; el.style.backgroundImage = `url("${r.portrait(form)}")`; el.style.backgroundSize = f[0]; el.style.backgroundPosition = f[1]; };
  const shown = { c: -1, ready: null, on: null, form: -1, key: null, stage: -1, weapon: -1, v: -1, boss: null, burst: null, bk: -1, low: null };
  let faces = [], leadSlot = null;
  /** 照今場出戰嘅人砌五個頭像位。 */
  function buildTeamBar(mates) {
    teamBar.replaceChildren(); faces = []; leadSlot = null;
    for (const id of battleSlots(mates)) {
      const d = document.createElement('div'); d.className = 'slot';
      if (id) { const r = rosterOf(id); d.classList.add('lead'); d.innerHTML = `<span class="tg">${CHAIN_STAGES[r.chain].label}</span><i></i>`; d.dataset.burst = id; faceStyle(d, id, 0); faces.push(d); if (r.leader) leadSlot = d; }
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
  const hudHide = () => { for (const e of [hTop, hWeap, hBurst, hFx, tip, teamBar, coachBox, coachMark, coachFinger]) if (!e.hidden) e.hidden = true; coachId = null; };
  /** 每格叫一次：照戰鬥狀態更新戰鬥介面。有變先改網頁元素。 */
  function hudUpdate(s) {
    const show = !!s && !!api.inBattle?.() && (screen === 'none' || screen === 'hint');
    if (!show) { hudHide(); return; }
    if (hTop.hidden) { hTop.hidden = false; hWeap.hidden = false; hFx.hidden = false; }
    // 頂部：第幾關、行咗幾遠（去到首領就滿）、而家邊級武器
    const endless = !!s.stage?.endless, sk = endless ? -s.wave : s.stageNo * (api.getMode?.().hard ? 1000 : 1);
    if (sk !== shown.stage) { shown.stage = sk; hStage.textContent = endless ? `無盡 · 第 ${s.wave} 波` : `${api.getMode?.().hard ? '困難 ' : ''}第 ${s.stageNo} 關`; }
    const waveLen = 8 + 14 * ENDLESS.sections, pv = endless ? 1 - (s.stage.len - s.dist) / waveLen : progress(s);
    const boss = s.phase === 'boss', v = boss ? 1 : Math.round(Math.max(0, Math.min(1, pv)) * 500) / 500;
    const fxk = (s.rapid > 0 ? 1 : 0) + (s.mud > 0 ? 2 : 0);
    if (fxk !== shown.fx) { shown.fx = fxk; hFx.innerHTML = `${s.rapid > 0 ? `<span class="up">${icon('skip')}加速</span>` : ''}${s.mud > 0 ? `<span class="dn">${icon('pause')}減速</span>` : ''}`; }
    if (v !== shown.v) { shown.v = v; hProg.style.setProperty('--v', String(v)); }
    if (boss !== shown.boss) { shown.boss = boss; hProg.classList.toggle('boss', boss); }
    const w = s.weapon ?? 0, wk = w * 10 + s.form;
    if (wk !== shown.weapon) {
      const first = shown.weapon < 0 || Math.floor(shown.weapon / 10) === w; shown.weapon = wk;
      hWeap.innerHTML = `${icon(WEAPON_ICON[WEAPONS[w].id] ?? 'bullet')}<span>Lv${w + 1} ${WEAPONS[w].name}</span>`;
      hWeap.style.setProperty('--fc', CROWD.evolution.forms[s.form]?.color ?? '255,255,255');
      if (!first) { hWeap.classList.remove('up'); void hWeap.offsetWidth; hWeap.classList.add('up'); }
    }
    // 爆發
    const b = s.burst;
    if (!b) { if (!teamBar.hidden) { teamBar.hidden = true; tip.hidden = true; hBurst.hidden = true; } return; }
    if (teamBar.hidden) teamBar.hidden = false;
    const key = s.team.mates.map((m) => m.id).join(',');
    if (key !== shown.key) { shown.key = key; buildTeamBar(s.team.mates.map((m) => m.id)); }
    const cfg = burstOf(b), on = b.t > 0 || b.cut > 0, ready = !on && b.charge >= 1, total = b.T ?? cfg.time, c = Math.round((on ? (b.cut > 0 ? 1 : b.t / total) : b.charge) * 100) / 100;
    if (c !== shown.c) { shown.c = c; for (const el of faces) el.style.setProperty('--c', String(c)); }
    if (ready !== shown.ready) { shown.ready = ready; for (const el of faces) el.classList.toggle('ready', ready); tip.hidden = !ready; }
    if (on !== shown.on) { shown.on = on; for (const el of faces) el.classList.toggle('on', on); }
    if (s.form !== shown.form) { shown.form = s.form; faceStyle(leadSlot, lead.id, s.form); }
    const active = b.t > 0 && !(b.cut > 0);
    if (active !== shown.burst) { shown.burst = active; hBurst.hidden = !active; if (active) hBurst.firstChild.textContent = `${b.full ? '接力爆發' : '爆發中'} ×${b.M ?? cfg.mul}`; }
    if (active) {
      const k = Math.round(b.t / total * 200) / 200, low = k < 0.25;
      if (k !== shown.bk) { shown.bk = k; hBurst.lastChild.firstChild.style.width = `${k * 100}%`; }
      if (low !== shown.low) { shown.low = low; hBurst.classList.toggle('low', low); }
    }
  }

  // ---------- 換畫面：新畫面約 0.24 秒淡入上移，舊畫面同時淡出；同一個畫面重畫（例如買完升級）唔做動畫、保留捲動位置 ----------
  const OUT_MS = TOKENS.transition * 1000 + 20;
  const dropLater = (n) => { n.classList.remove('in'); n.classList.add('out'); setTimeout(() => { n.remove(); if (!root.children.length && screen === 'none') root.hidden = true; }, OUT_MS); };
  function mount(name, node, pass) {
    const same = name === screen, keep = same ? root.querySelector('.scr:not(.out) .body')?.scrollTop ?? 0 : 0;
    if (name !== 'hint') hudHide(); else { tip.hidden = true; }
    for (const old of [...root.children]) { if (same || pass || !old.classList.contains('scr') || old.classList.contains('out')) { if (!old.classList.contains('out')) old.remove(); } else dropLater(old); }
    if (!same && !pass) node.classList.add('in');
    root.prepend(node); root.hidden = false; root.classList.toggle('pass', !!pass);
    cur = node; screen = name;
    if (keep) { const b = node.querySelector('.body'); if (b) b.scrollTop = keep; }
    api.onScreen?.(name);
  }
  function hide() {
    for (const old of [...root.children]) { if (old.classList.contains('scr') && !old.classList.contains('out')) dropLater(old); else if (!old.classList.contains('out')) old.remove(); }
    root.classList.add('pass'); screen = 'none'; cur = null;
    if (!root.children.length) root.hidden = true;
    api.onScreen?.('none');
  }

  // ---------- 共用組件 ----------
  /** 提示條（約 1.5 秒自己收）。 */
  function toast(text, ic) { const t = h('div', 'toast', (ic ? icon(ic) : '') + text); root.append(t); setTimeout(() => t.remove(), 1550); }
  /** 數字跳動：由舊數行到新數（約 0.45 秒）。 */
  function countTo(el, from, to, fmt = formatNumber) {
    el.textContent = fmt(to);
    if (from === to) return;
    let i = 0; const N = 9, tick = () => { i++; el.textContent = fmt(Math.round(from + (to - from) * (1 - (1 - i / N) ** 2))); if (i < N && el.isConnected) setTimeout(tick, 45); };
    el.textContent = fmt(from); setTimeout(tick, 45);
  }
  let goldShown = null;
  const lastShown = {};
  /** 貨幣列：個數同上次顯示唔同就跳動。item = gold / gem / exp / core / ticket。 */
  function curChip(item) {
    const meta = api.getMeta(), now = have(meta, item), el = h('div', 'cur', `${icon(ITEMS[item].icon, item === 'gold' ? 'gold' : item === 'gem' || item === 'ticket' ? 'gem' : 'mint')}<b></b>`), from = (item === 'gold' ? goldShown : lastShown[item]) ?? now; el.dataset.cur = item;
    if (item === 'gold') { goldShown = now; el.dataset.gold = '1'; } else lastShown[item] = now;
    countTo(el.lastChild, from, now);
    if (from !== now) el.classList.add('pop');
    return el;
  }
  const goldChip = () => curChip('gold');
  /** 一粒成本／獎勵：圖示 + 數量；need = true 就連「有幾多」都寫，唔夠變紅。 */
  const costChip = (c, need = false, cls = '') => { const meta = api.getMeta(), own = have(meta, c.item, c.id), name = c.item === 'shard' ? `${rosterOf(c.id).name}碎片` : ITEMS[c.item].name; return `<span class="cost ${need && own < c.n ? 'lack' : ''} ${cls}" title="${name}">${icon(ITEMS[c.item].icon, c.item === 'gold' ? 'gold' : c.item === 'gem' || c.item === 'ticket' ? 'gem' : 'mint')}${c.item === 'shard' ? `${rosterOf(c.id).name} ` : ''}${formatNumber(c.n)}${need ? `<small>/ ${formatNumber(own)}</small>` : ''}</span>`; };
  /** 頂欄：有 back 就左邊一個返回掣；右邊放 extra（貨幣列、掣）。 */
  function bar(titleText, back, ...extra) {
    const b = h('div', 'bar');
    if (back) { const k = ibtn('back', back, '返回'); k.dataset.back = '1'; b.append(k); }
    b.append(h('h2', '', titleText), ...extra.filter(Boolean));
    return b;
  }
  const TAB_ICON = { lobby: 'lobby', map: 'map', team: 'team', gacha: 'recruit', base: 'base', shop: 'shop' };
  /** 底部分頁（大廳、關卡、隊員、基地）。未做好嘅入口唔顯示。 */
  const hinted = (key) => !!api.getMeta().hints?.[key];
  /** 呢個系統開咗未（照解鎖次序：第一次通過第 after 關之後開）。 */
  const isOpen = (id) => { const u = unlockOf(id); return !u || u.after <= 0 || stageStars(api.getMeta(), u.after) > 0; };
  const lockNote = (id) => `通過第 ${unlockOf(id).after} 關解鎖`;
  function tabs(now) {
    const el = h('div', 'tabs');
    for (const t of LOBBY_TABS) {
      if (t.soon) continue;
      const open = isOpen(t.id), b = h('button', `${t.id === now ? 'on' : ''} ${open ? '' : 'lock'}`, `${icon(TAB_ICON[t.id] ?? 'info')}${open ? '' : `<i>${icon('lock')}</i>`}<span>${t.label}</span>`); b.type = 'button'; b.dataset.tab = t.id;
      b.addEventListener('click', () => { if (t.id === now) return; if (!open) { sound('ui_deny'); toast(lockNote(t.id), 'lock'); return; } sound('ui_click'); if (t.id === 'lobby') lobby(); else if (t.id === 'map') map(); else if (t.id === 'team') team(); else if (t.id === 'gacha') gacha(); else if (t.id === 'shop') shop(); else if (t.id === 'base') upgrades(null, true); });
      // 紅點：隊員有嘢升得；招募有券或者夠晶石
      const meta = api.getMeta(), dot = open && t.id !== now && ((t.id === 'team' && joinedIds(meta).some((id) => canGrow(meta, id))) || (t.id === 'gacha' && pullCost(meta, 1).ok));
      if (dot) b.append(h('i', 'dot')); if (dot) b.lastChild.style.cssText = 'top:14%;right:26%;left:auto';
      el.append(b);
    }
    return el;
  }
  /** 指住一個掣（大廳嘅功能引導）：四周暗落去，個掣有金框，隔籬一句說明同撳嘅手指。撳邊度都收。 */
  function spot(target, text) {
    if (!target || !cur) return;
    const host = cur, r = target.getBoundingClientRect(), b = root.getBoundingClientRect(), pad = 6;
    const ring = h('div', 'spot'), tipBox = h('div', 'pn spotTip', text), fg = h('div', 'finger tap', icon('hand'));
    ring.style.cssText = `left:${r.left - b.left - pad}px;top:${r.top - b.top - pad}px;width:${r.width + pad * 2}px;height:${r.height + pad * 2}px`;
    const above = r.top - b.top > b.height * 0.5;
    tipBox.style[above ? 'bottom' : 'top'] = `${above ? b.bottom - r.top + 18 : r.bottom - b.top + 18}px`;
    fg.style.cssText = `left:${r.left - b.left + r.width / 2}px;top:${r.top - b.top + r.height * 0.55}px;z-index:16`;
    host.append(ring, tipBox, fg);
    const off = () => { ring.remove(); tipBox.remove(); fg.remove(); host.removeEventListener('pointerdown', off, true); };
    host.addEventListener('pointerdown', off, true);
  }
  /** 新系統解鎖嘅一次性說明彈窗。 */
  function unlockBox(u, then) {
    const { mask, close } = overlay(), box = h('div', 'pn dlg unl hi');
    box.append(h('small', '', 'NEW'), h('div', 'big', icon(u.icon)), h('h3', '', `${u.name} 開放`), h('p', '', u.note));
    const ok = btn('知道了', 'pri sm', () => { close(); then?.(); }); ok.dataset.unlockok = u.id; box.append(ok); mask.append(box);
    sound('weapon_up');
  }
  /** 彈出視窗（疊喺而家個畫面上面）。回傳 { box, close }。 */
  function overlay(cls = '') {
    const mask = h('div', `mask ${cls}`), host = cur && cur.isConnected && cur.classList.contains('scr') ? cur : root;
    const close = () => mask.remove();
    host.append(mask);
    return { mask, close };
  }
  /** 確認視窗：兩個掣。 */
  function confirmBox(titleText, text, okLabel, onOk, danger) {
    const { mask, close } = overlay(), box = h('div', 'pn dlg');
    box.append(h('h3', '', titleText), h('p', '', text));
    const acts = h('div', 'acts'); acts.append(btn('取消', 'sm', close), btn(okLabel, `sm ${danger ? 'dan' : 'pri'}`, () => { close(); onOk(); })); acts.lastChild.dataset.ok = '1';
    box.append(acts); mask.append(box);
  }
  /**
   * 「獲得物品」彈窗（全遊戲統一用呢個）：items = [{ icon, name, amount, rarity（0 至 4，預設 3）}]。
   */
  function reward(items, then, titleText = '獲得物品') {
    const { mask, close } = overlay('rw'), box = h('div', 'dlg');
    mask.append(h('div', 'rays'));
    const list = h('div', 'items');
    items.forEach((it, i) => { const d = h('div', 'it', `<i>${icon(it.icon)}</i><span>${it.name}</span><b>×${typeof it.amount === 'number' ? formatNumber(it.amount) : it.amount}</b>`); d.style.setProperty('--rc', `var(--r${it.rarity ?? 3})`); d.style.animationDelay = `${0.12 + i * 0.09}s`; list.append(d); });
    const ok = btn('確定', 'pri', () => { close(); then?.(); }); ok.dataset.rewardok = '1';
    box.append(h('h3', '', titleText), list, ok); mask.append(box);
    sound('prize');
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
    return `<div class="sun"></div><svg class="sky" viewBox="0 0 100 60" preserveAspectRatio="none">${layer('#8a4a5c', 60, 14, 38, 6, 13, false)}${layer('#3a2238', 60, 8, 26, 7, 15, true)}</svg><div class="floor"></div>`;
  }
  const KEY_VISUAL = new URL('../../assets/key-visual-v2.webp', import.meta.url).href; // 新造型嘅主視覺（043）：近鏡、五個人塞滿畫面
  const logo = (cls = '') => `<div class="logo ${cls}"><span class="st" aria-hidden="true">數字突擊隊</span><span class="fl">數字突擊隊</span></div><br><div class="logoSub">NUMBER SQUAD</div>`;

  // ---------- 載入 ----------
  /**
   * 載入畫面：進度係真嘅——模型逐個檔計（models() 回傳 { done, total, fraction }），立繪逐張計；全部到齊就自動入標題。
   * @param {{ models?: () => { done: number, total: number, fraction: number } | null, ready?: Promise<unknown> }} o
   */
  function loading(o = {}) {
    const s = h('div', 'scr load kvs'); { const kv = img(KEY_VISUAL); kv.className = 'kvbg'; s.append(kv); }
    s.append(h('div', 'mid', logo('s')));
    const prog = h('div', 'prog', '<div class="pb"><i></i></div><div class="tx"><span></span><b>0%</b></div>'), fill = prog.querySelector('i'), what = prog.querySelector('span'), pct = prog.querySelector('b');
    s.append(prog);
    const tipbox = h('div', 'tipbox', `${icon('tip')}<div><b>小提示</b><span></span></div>`); s.append(tipbox);
    let tipNo = Math.floor(Math.random() * TIPS.length);
    const nextTip = () => { const sp = h('span', '', TIPS[tipNo++ % TIPS.length]); tipbox.querySelector('span').replaceWith(sp); };
    nextTip();
    mount('loading', s);
    // 立繪：隊長四個形態、各隊員一張
    const urls = [...new Set([KEY_VISUAL, ...ROSTER.flatMap((r) => Array.from({ length: r.forms }, (_, f) => r.portrait(f)))])];
    let imgDone = 0, modelsOk = !o.ready; const t0 = performance.now();
    for (const u of urls) { const im = new Image(); im.onload = im.onerror = () => { imgDone++; }; im.src = u; }
    o.ready?.catch(() => {}).then(() => { modelsOk = true; });
    let tipT = 0;
    const tick = () => {
      if (screen !== 'loading') return;
      const m = o.models?.() ?? null, mk = m ? (modelsOk ? 1 : Math.min(0.99, m.fraction)) : 1, ik = imgDone / urls.length, k = m ? mk * 0.8 + ik * 0.2 : ik;
      fill.style.width = `${k * 100}%`; pct.textContent = `${Math.round(k * 100)}%`;
      what.textContent = `${m ? `模型 ${modelsOk ? m.total : m.done} / ${m.total} · ` : ''}圖片 ${imgDone} / ${urls.length}`;
      if ((tipT += 100) >= 3200) { tipT = 0; nextTip(); }
      // 立繪最多等 8 秒（慢網絡唔好卡死喺度；之後用到先慢慢出）
      if (modelsOk && (imgDone >= urls.length || performance.now() - t0 > 8000)) { fill.style.width = '100%'; pct.textContent = '100%'; setTimeout(() => { if (screen === 'loading') title(); }, 260); return; }
      setTimeout(tick, 100);
    };
    tick();
  }

  // ---------- 標題 ----------
  function title() {
    const meta = api.getMeta(), started = totalStars(meta) > 0, s = h('div', 'scr title kvs');
    // 主視覺：五人同框嗰張圖。闊度貼滿、貼底；高過 9:16 嘅手機上面多出嚟嘅位用天空色補（圖頂淡出），所以五個人塊面幾闊幾窄都唔會畀裁走
    const kv = img(KEY_VISUAL); kv.className = 'kvbg'; s.append(kv);
    s.append(h('div', 'head', logo('s'))); // 標誌字擺右上角、細一級：新主視覺啲人塊面喺 8%–60% 高，左上係霧塊面，右上係天空
    const btm = h('div', 'btm'), go = btn(started ? '繼續遊戲' : '開始遊戲', 'pri', () => lobby()); go.dataset.start = '1';
    btm.append(go, h('div', 'st', started ? `<span>${icon('flag', 'mint')} 已通過 ${Object.values(meta.stages).filter((v) => v.stars > 0).length} / ${STAGE_COUNT} 關</span><span>${icon('starFull', 'gold')} ${totalStars(meta)}</span>` : '<span>射磚加戰力，打爆首領</span>'));
    s.append(btm, h('div', 'ver', `v${VERSION}`));
    s.addEventListener('click', () => { if (screen === 'title') { sound('ui_click'); lobby(); } });
    mount('title', s);
  }

  // ---------- 大廳 ----------
  let lineNo = -1;
  /** 大廳：看板角色（玩家見過嘅最高形態）企中間，對白每次入嚟隨機一句，撳角色換下一句。 */
  function lobby() {
    api.onDaily?.(); // 換日重置、發信、計離線收益
    const meta = api.getMeta(), s = h('div', 'scr lobby dusk'), seen = seenOf(meta), next = nextStage(meta);
    s.innerHTML = skyline();
    const top = h('div', 'ltop'), set = ibtn('settings', () => settings(() => lobby()), '設定'); set.dataset.settings = '1';
    top.append(h('div', 'cmd grow', `<i>${playerLevel(meta)}</i><div>指揮官<b>Lv.${playerLevel(meta)}</b></div>`), curChip('gem'), goldChip(), set); s.append(top);
    // 右邊入口：任務（連成就）、簽到、信箱、無盡；有嘢領就有紅點，未解鎖嘅唔顯示
    const side = h('div', 'lside'), B = badges(meta, api.now?.() ?? Date.now());
    for (const b of LOBBY_SIDE) {
      if (b.needs && !isOpen(b.needs)) continue;
      const e = ibtn(b.icon, () => (b.id === 'mission' ? missions() : b.id === 'login' ? loginBox() : b.id === 'mail' ? mailbox() : endless()), b.label, b.label); e.dataset.side = b.id;
      if (B[b.id]) e.append(h('i', 'dot')); side.append(e);
    }
    if (side.children.length) s.append(side);
    // 離線收益：儲夠就喺左上角出一粒掣
    const off = offlineState(meta, api.now?.() ?? Date.now());
    if (off.ready) { const ob = h('button', 'offl', `${icon('gift')}<span>離線收益<small> ${off.hours.toFixed(1)} 小時${off.full ? '（滿）' : ''}</small></span>`); ob.type = 'button'; ob.dataset.offline = '1'; ob.addEventListener('click', () => claim('offline', null, () => lobby(), '離線收益')); s.append(ob); }
    const face = rosterOf(faceId(meta)); // 看板角色：玩家揀咗嘅（要入咗隊），否則隊長
    const hero = h('div', `hero ${face.cutout ? '' : 'boxed'}`); hero.append(img(face.portrait(face.leader ? seen.form : 0), face.name)); hero.dataset.hero = face.id;
    const bubble = h('div', 'bubble');
    lineNo = Math.floor(Math.random() * face.lines.length);
    const say = () => { bubble.textContent = face.lines[lineNo % face.lines.length]; bubble.style.animation = 'none'; void bubble.offsetWidth; bubble.style.animation = ''; };
    say();
    hero.addEventListener('click', () => { lineNo++; say(); hero.classList.remove('tap'); void hero.offsetWidth; hero.classList.add('tap'); sound('ui_click'); });
    s.append(hero, bubble);
    s.append(h('div', 'ltag', `<small>${face.title}</small><b>${face.name}</b><span>${icon(ROLE_ICON[face.id] ?? 'assault')}${face.leader ? `形態 ${FORM_MARK[seen.form]}` : face.role}</span>`));
    const go = btn(`出擊<small>第 ${next} 關</small>`, 'pri sortie', () => map(next)); go.dataset.sortie = '1'; s.append(go);
    s.append(tabs('lobby'));
    mount('lobby', s);
    // 功能引導：全新存檔第一次入大廳指住「出擊」；之後每個新系統第一次開，出一次說明，再指住佢個入口
    if (!hinted('lobby') && totalStars(meta) === 0) { api.onHint?.('lobby'); setTimeout(() => { if (cur === s) spot(go, '點「出擊」開始第一關'); }, 350); return; }
    const fresh = UNLOCKS.filter((u) => u.ready && u.after > 0 && isOpen(u.id) && !hinted(unlockKey(u.id)));
    const next1 = () => { const u = fresh.shift(); if (!u || cur !== s) return; api.onHint?.(unlockKey(u.id)); unlockBox(u, () => { if (fresh.length) next1(); else spot(s.querySelector(`.tabs [data-tab=${u.id}]`), `${u.name}在這裡`); }); };
    if (fresh.length) setTimeout(next1, 350);
    else if (loginState(meta, api.now?.() ?? Date.now()).ready && !loginShown) { loginShown = true; setTimeout(() => { if (cur === s) loginBox(); }, 400); } // 每日第一次入大廳：自動彈簽到
  }
  let loginShown = false;

  // ---------- 故事對話 ----------
  /**
   * 一段對話：上面章名，中間講嘢嗰個角色嘅立繪，下面對話框；撳畫面去下一句，右上角可以跳過。講完（或者跳過）就叫 then。
   * @param {import('../data/story.js').Chapter} ch  @param {'intro' | 'outro'} part
   */
  function story(ch, part, then) {
    const lines = ch[part], s = h('div', 'scr story kvs');
    { const kv = img(KEY_VISUAL); kv.className = 'kvbg'; s.append(kv); }
    s.append(h('div', 'ch', `<span class="logoSub">${ch.no}${part === 'intro' ? '' : ' · 終'}</span><b>${ch.name}</b>`));
    const who = h('div', 'who'), say = h('div', 'pn say', '<span class="nm"></span><span class="tx"></span><span class="nx"></span>'); say.querySelector('.nx').innerHTML = icon('next');
    const end = () => { if (done) return; done = true; then(); };
    const skip = btn(`跳過${icon('skip')}`, 'sm skip', end); skip.dataset.storyskip = '1';
    s.append(who, say, skip);
    let i = -1, done = false, shownId = null;
    const step = () => {
      if (++i >= lines.length) return end();
      const l = lines[i], r = rosterOf(l.who);
      say.style.setProperty('--jc', r ? r.color : '111,242,230');
      say.querySelector('.nm').textContent = r ? r.name : '指揮官（你）';
      say.querySelector('.tx').textContent = l.text;
      if (r && r.id !== shownId) { shownId = r.id; who.replaceChildren(img(r.portrait(r.leader ? seenOf(api.getMeta()).form : 0), r.name)); }
      who.classList.toggle('off', !r);
      sound('ui_click');
    };
    s.addEventListener('click', step);
    mount('story', s);
    step();
  }
  /** 出擊：呢關係一章嘅第一關、又未睇過開頭，就先出嗰章嘅開頭對話。 */
  function play(n) {
    const ch = chapterOf(n), key = storyKey(ch, 'in');
    if (n === ch.from && !hinted(key)) { api.onHint?.(key); story(ch, 'intro', () => api.onPlay(n)); } else api.onPlay(n);
  }

  // ---------- 隊員 ----------
  /** 隊員頁：角色表入面嘅角色；未入隊嘅係剪影，寫明過邊關加入。下面係爆發鏈三段而家邊個頂。 */
  function team() {
    const s = h('div', 'scr tabbed'), meta = api.getMeta(), seen = seenOf(meta), joined = joinedIds(meta), out = squadMates(meta);
    const lu = btn('編隊', 'sm pri', () => lineup()); lu.dataset.lineup = '1';
    s.append(bar('隊員', null, h('div', 'cur', `${icon('team', 'mint')}<b>${joined.length} / ${ROSTER.length}</b>`), lu));
    const body = h('div', 'body'), grid = h('div', 'roster'), mats = h('div', 'mats'); mats.append(curChip('exp'), curChip('core'), goldChip()); body.append(mats);
    for (const r of ROSTER) {
      const has = joined.includes(r.id), card = h(has ? 'button' : 'div', `rc ${has ? 'in' : 'no'}`); card.style.setProperty('--jc', r.color);
      card.append(img(r.portrait(r.leader ? seen.form : 0), has ? r.name : ''));
      if (has) {
        card.type = 'button';
        const c = charOf(meta, r.id); if (canGrow(meta, r.id)) { const d = h('i', 'dot'); d.style.cssText = 'top:1.4cqw;right:9cqw'; card.append(d); }
        card.append(h('span', 'tg', CHAIN_STAGES[r.chain].label), h('span', 'lvb', `Lv${c.lv}`), h('span', 'ro', icon(ROLE_ICON[r.id] ?? 'assault')), h('div', 'nm', `${stars(c.star, STAR.max)}${r.name}<small>${r.role}</small>${r.leader ? '<em>隊長</em>' : out.includes(r.id) ? '<em>出戰中</em>' : '<em class="rest">休息</em>'}`));
        card.dataset.char = r.id; card.addEventListener('click', () => { sound('ui_click'); detail(r.id); });
      } else { card.append(h('div', 'lk', icon('lock')), h('div', 'nm', `？？？<small>通過第 ${r.joinAfter} 關加入${isOpen('gacha') ? '，或者招募' : ''}</small>`)); card.dataset.locked = r.id; }
      grid.append(card);
    }
    body.append(grid, h('div', 'sec', '爆發鏈'));
    const order = chainOrder(['falcon', ...out]), pn = h('div', 'pn'), chain = h('div', 'chain'), inSquad = ['falcon', ...out];
    Object.entries(CHAIN_STAGES).forEach(([key, st], i) => {
      // 每一段位：頂緊呢段嘅人（可以兩個）；冇人就係虛線空位
      const who = inSquad.filter((id) => rosterOf(id).chain === key), c = h('div', `cs ${who.length ? '' : 'no'}`), avs = h('div', 'avs');
      if (!who.length) avs.append(h('div', 'av', st.label));
      for (const id of who) { const av = h('div', 'av'); faceStyle(av, id, rosterOf(id).leader ? seen.form : 0); avs.append(av); }
      c.append(avs, h('span', '', who.length ? `${st.label} · ${who.map((id) => rosterOf(id).name).join('、')}` : `${st.label} · 未有`));
      if (i) chain.append(h('span', '', icon('next')));
      chain.append(c);
    });
    pn.append(chain, h('div', 'note', order ? `三段齊人：<b>${order.map((id) => rosterOf(id).name).join(' → ')}</b> 接力放出完整爆發（${fullBurst(order.length).time} 秒、全隊射速 ×${fullBurst(order.length).mul}）。${order.length < 5 ? '同一段位有兩個人，爆發再加長加強。' : ''}` : `三段未齊，暫時係隊長單人版：<b>${lead.burst.name}</b>——${lead.burst.note}`));
    pn.lastChild.style.marginTop = 'var(--sp-3)';
    body.append(pn, h('div', 'note', `隊長喺中間，隊員跟住跑；最多帶 ${MAX_MATES} 個隊員出戰（連隊長五人）。`));
    s.append(body, tabs('team'));
    mount('team', s);
  }

  let detailTab = 'grow';
  /**
   * 角色詳情：上面立繪、名、等級同星；下面四個分頁——養成（升級／突破）、星級（碎片升星，每星一個效果，未到嘅可以預覽）、技能（爆發技同被動各自升級）、
   * 資料（簡介、爆發技；隊長：形態同武器線；隊員：武器同打法、養成後嘅數值）。入咗隊嘅可以設做大廳看板角色。
   */
  function detail(id, form, tab) {
    const r = rosterOf(id), meta = api.getMeta();
    if (!r || !joinedIds(meta).includes(id)) return team();
    if (tab) detailTab = tab;
    const seen = seenOf(meta), f = r.leader ? Math.max(0, Math.min(form ?? seen.form, seen.form, r.forms - 1)) : 0, s = h('div', 'scr tabbed'), c = charOf(meta, id), st = charStats(meta, id);
    s.append(bar('角色', () => team(), curChip('exp'), goldChip()));
    const body = h('div', 'body'), dth = h('div', 'dth'); dth.style.setProperty('--jc', r.color);
    const isFace = faceId(meta) === id, fb = btn(isFace ? `${icon('check')}看板角色` : '設為看板', `sm ${isFace ? '' : 'pri'}`, () => { api.onFace?.(id); detail(id, form); }, isFace); fb.dataset.face = id; fb.style.marginTop = 'auto';
    const inf = h('div', 'inf'); inf.append(h('small', '', r.title), h('b', '', r.name), h('div', 'lvb', `Lv${c.lv}${stars(c.star, STAR.max)}`), h('div', 'role', `${icon(ROLE_ICON[r.id] ?? 'assault')}${r.role}`), h('span', 'tg', `爆發鏈 · ${CHAIN_STAGES[r.chain].label}`), fb);
    dth.append(img(r.portrait(f), r.name), inf); body.append(dth);
    const seg = h('div', 'seg');
    for (const [key, label, dot] of [['grow', '養成', nextLevel(meta, id).ok], ['star', '星級', nextStar(meta, id).ok], ['skill', '技能', nextSkill(meta, id, 'burst').ok || nextSkill(meta, id, 'passive').ok], ['info', '資料', false]]) {
      const b = h('button', detailTab === key ? 'on' : '', label); b.type = 'button'; b.dataset.seg = key; if (dot && detailTab !== key) b.append(h('i', 'dot'));
      b.addEventListener('click', () => { sound('ui_click'); detail(id, form, key); }); seg.append(b);
    }
    body.append(seg);
    const did = (ok, okSound = 'ui_buy') => { if (ok) { sound(okSound); detail(id, form); } else { sound('ui_deny'); toast('素材唔夠', 'info'); } };
    if (detailTab === 'grow') {
      const n = nextLevel(meta, id), cap = levelCap(c), pn = h('div', 'pn grow1');
      pn.append(h('div', 'lvrow', `<b>Lv ${c.lv}</b><small>/ ${cap}${cap < LEVEL.max ? `（突破後上限 ${Math.min(LEVEL.max, cap + LEVEL.step)}）` : ''}</small>`), h('div', 'pb', '<i></i>'));
      pn.lastChild.style.setProperty('--v', String(c.lv / LEVEL.max));
      const now = r.leader ? `開局戰力 <b>+${(st.power * 100).toFixed(1)}%</b>` : `輸出 = 隊長戰力嘅 <b>${(st.cfg.share * 100).toFixed(1)}%</b>`;
      const per = r.leader ? `每級開局戰力 +${LEVEL.leaderPower * 100}%` : `每級輸出 +${LEVEL.mateShare * 100}%`;
      pn.append(h('div', 'fxline', `而家：${now}<br>${n.kind === 'max' ? '已經滿級。' : n.kind === 'break' ? `去到 Lv ${c.lv} 要先<b>突破</b>，之後可以升到 Lv ${Math.min(LEVEL.max, cap + LEVEL.step)}。` : per}`));
      if (n.kind !== 'max') {
        const act = h('div', 'act'); act.append(h('div', 'costs', n.cost.map((x) => costChip(x, true)).join('')));
        const b = btn(n.kind === 'break' ? '突破' : '升級', `sm ${n.ok ? (n.kind === 'break' ? 'gold' : 'pri') : 'off'}`, () => did(api.onLevel?.(id), n.kind === 'break' ? 'weapon_up' : 'ui_buy')); b.dataset.levelup = id; b.dataset.quiet = '1';
        act.append(b); pn.append(act);
      }
      body.append(pn);
    } else if (detailTab === 'star') {
      const n = nextStar(meta, id), pn = h('div', 'pn grow1');
      pn.append(h('div', 'bigstars', stars(c.star, STAR.max)));
      if (!n.max) {
        pn.append(h('div', 'pb gold', '<i></i>')); pn.lastChild.style.setProperty('--v', String(Math.min(1, n.have / n.need)));
        const act = h('div', 'act'); act.append(h('div', 'costs', `<span class="cost ${n.ok ? '' : 'lack'}">${icon('shard', 'mint')}${r.name} ${n.need}<small>/ ${n.own}</small></span>${n.wild ? `<span class="cost">${icon('wild', 'gold')}萬能 <small>有 ${n.wild}${n.useWild ? `，會用 ${n.useWild}` : ''}</small></span>` : ''}`));
        const b = btn('升星', `sm ${n.ok ? 'gold' : 'off'}`, () => did(api.onStar?.(id), 'weapon_up')); b.dataset.starup = id; b.dataset.quiet = '1'; act.append(b); pn.append(act);
        pn.append(h('div', 'note', `碎片嚟源：招募${r.leader ? '' : '（已經有呢個角色，再抽到會變碎片）'}。自己嘅碎片唔夠，會用<b>萬能碎片</b>補（任務、成就、簽到、無盡模式、商店都有）。`));
      } else pn.append(h('div', 'note', '已經滿星。'));
      body.append(pn, h('div', 'sec', '星級效果'));
      const list = h('div', 'pn flat');
      for (const e of STAR_EFFECTS[id] ?? []) list.append(h('div', `stline ${c.star >= e.star ? 'on' : ''}`, `${stars(e.star, STAR.max)}<span>${e.text}</span>${c.star >= e.star ? icon('check', 'chk') : icon('lock', 'dim chk')}`));
      body.append(list);
    } else if (detailTab === 'skill') {
      for (const [key, name, ic] of [['burst', r.burst.name, 'bolt'], ['passive', SKILLS[id].passive.name, 'plus']]) {
        const lv = key === 'burst' ? c.sb : c.sp, n = nextSkill(meta, id, key), now = skillNow(id, key, lv), pn = h('div', 'pn sk');
        pn.append(h('div', 'hd', `<i>${icon(ic)}</i><div class="grow"><b>${name}</b><small>${key === 'burst' ? (r.leader ? '爆發技' : '接力') : '被動'} · Lv ${lv} / ${SKILL.max}</small></div>`));
        pn.append(h('div', 'fxline', `${key === 'burst' ? `${r.burst.note}<br>` : ''}而家：${lv > 1 ? `<b>${now.text}</b>` : now.text}${n.max ? '' : `<br>下一級：<b>${now.next}</b>`}`));
        if (!n.max) { const act = h('div', 'act'); act.append(h('div', 'costs', n.cost.map((x) => costChip(x, true)).join(''))); const b = btn('升級', `sm ${n.ok ? 'pri' : 'off'}`, () => did(api.onSkill?.(id, key))); b.dataset.skillup = key; b.dataset.quiet = '1'; act.append(b); pn.append(act); }
        body.append(pn);
      }
    } else {
      body.append(h('div', 'note', r.intro));
    body.append(h('div', 'sec', r.leader ? '爆發技' : '接力'));
    body.append(h('div', 'pn flat', `<div class="note"><em>${r.burst.name}</em><br>${r.burst.note}</div>`));
    if (r.leader) {
      body.append(h('div', 'sec', `形態 · ${CROWD.evolution.forms[f]?.name ?? ''}`));
      const forms = h('div', 'forms');
      for (let i = 0; i < r.forms; i++) { const ok = i <= seen.form, b = h('button', i === f ? 'on' : '', ok ? FORM_MARK[i] : icon('lock')); b.type = 'button'; b.disabled = !ok; b.dataset.form = String(i); b.addEventListener('click', () => { sound('ui_click'); detail(id, i); }); forms.append(b); }
      body.append(forms);
      body.append(h('div', 'sec', `武器線 · 見過 ${Math.min(seen.weapon, WEAPONS.length)} / ${WEAPONS.length}`));
      const wl = h('div', 'wl');
      WEAPONS.forEach((w, i) => { const ok = i + 1 <= seen.weapon, d = h('div', ok ? '' : 'off', `${icon(ok ? WEAPON_ICON[w.id] ?? 'bullet' : 'lock')}${ok ? w.name : '？？？'}<small>Lv${i + 1} · 形態 ${FORM_MARK[w.form]}</small>`); d.dataset.weapon = String(i + 1); wl.append(d); });
      body.append(wl);
    } else {
      const B = charStats(meta, id).cfg; // 養成後嘅數值
      body.append(h('div', 'sec', '武器同打法'));
      const third = B.guard ? `<div><b>${B.guard.every} 秒</b>光盾充能</div>` : B.blast ? `<div><b>${Math.round(B.blast.half * 2 * 100) / 100} 闊</b>爆炸範圍 · ${B.blast.rows} 行</div>` : `<div><b>${B.pierce} 隻</b>一下打倒</div>`;
      body.append(h('div', 'tiles', `<div><b>${Math.round((B.share + (B.drone?.share ?? 0)) * 100)}%</b>輸出（對隊長戰力）</div><div><b>${B.interval} 秒</b>${B.burst ? `每輪 ${B.burst} 連發` : '每下相隔'}</div>${third}`));
      body.append(h('div', 'note', `${r.weaponNote}${B.near ? `<br>貼身最高 <b>${Math.round(B.share * (1 + B.near) * 100)}%</b>。` : ''}${B.guard ? `<br>光盾擋嘅係：俾敵人撞到、首領出招、危險地帶嘅戰力損失（擋嗰刻起 <b>${B.guard.window}</b> 秒內都唔計）；入錯減數門唔擋。` : ''}<br>只打方陣、路障同首領；唔會受傷。`));
    }
    }
    s.append(body, tabs('team'));
    mount('detail', s);
  }

  /** 編隊：隊長一定出戰；入咗隊嘅隊員揀出戰定休息（而家最多 MAX_MATES 個）。上面係企位圖（前 = 畫面上方）。 */
  function lineup() {
    const meta = api.getMeta(), s = h('div', 'scr tabbed'), joined = joinedIds(meta).filter((id) => !rosterOf(id).leader), out = squadMates(meta), seen = seenOf(meta);
    s.append(bar('編隊', () => team()));
    const body = h('div', 'body'), field = h('div', 'field', `<div class="fw">${icon('next')}前方</div>`), spots = [[14, 52, null], [33, 80, null], [50, 38, lead.id], [67, 80, null], [86, 52, null]], at = [1, 3, 0, 4];
    for (const id of out) spots[at[rosterOf(id).battle.slot]][2] = id;
    spots.forEach(([x, y, id], i) => { const d = h('div', `pos ${id ? 'in' : ''}`, `<span>${id ? rosterOf(id).name : ['左外', '左後', '', '右後', '右外'][i]}</span>`); d.style.left = `${x}%`; d.style.top = `${y}%`; if (id) faceStyle(d, id, rosterOf(id).leader ? seen.form : 0); field.append(d); });
    body.append(field);
    if (!joined.length) body.append(h('div', 'note', `未有隊員。通過第 ${ROSTER.filter((r) => r.joinAfter > 0).map((r) => r.joinAfter).join('、')} 關各有一個隊員加入。`));
    for (const id of joined) {
      const r = rosterOf(id), on = out.includes(id), row = h('div', 'li'), av = h('div', 'av'); faceStyle(av, id, 0);
      const b = btn(on ? '出戰中' : '休息', `sm ${on ? 'pri' : ''}`, () => { if (api.onSquad?.(id, !on)) lineup(); else toast(`最多帶 ${MAX_MATES} 個隊員`, 'info'); }); b.dataset.mate = id;
      row.append(av, h('div', 'tx', `${r.name} <span class="tg">${CHAIN_STAGES[r.chain].label}</span><small>${r.role} · ${['左後', '右後', '左外', '右外'][r.battle.slot]}</small>`), b); body.append(row);
    }
    const order = chainOrder(['falcon', ...out]);
    body.append(h('div', 'note', order ? `<b>完整爆發可以用</b>：${order.map((id) => `${CHAIN_STAGES[rosterOf(id).chain].label} ${rosterOf(id).name}`).join(' → ')}` : '起、承、決未齊：爆發技係隊長單人版。'));
    s.append(body, tabs('team'));
    mount('lineup', s);
  }

  /** 新隊員加入（結算之後插入）：立繪、名、定位、一句對白。撳「繼續」先做返玩家本來揀嘅嘢。 */
  function join(id, then) {
    const r = rosterOf(id), s = h('div', 'scr join'); s.style.setProperty('--jc', r.color);
    s.append(h('div', 'rays'), h('div', 'jt', '<span class="logoSub">NEW MEMBER</span><b>新隊員加入</b>'));
    const jp = h('div', `jp ${r.cutout ? '' : 'boxed'}`); jp.append(img(r.portrait(0), r.name)); s.append(jp);
    const jb = h('div', 'jb');
    jb.append(h('div', 'jn', r.name), h('div', 'jr', `${icon(ROLE_ICON[r.id] ?? 'assault')}${r.role}<span class="tg">爆發鏈 · ${CHAIN_STAGES[r.chain].label}</span>`), h('div', 'pn flat', `「${r.joinLine}」`));
    s.append(jb);
    const foot = h('div', 'foot'), b = btn('繼續', 'pri wide', () => then()); b.dataset.joinok = id; foot.append(b); foot.style.width = '100%'; foot.style.position = 'relative'; s.append(foot);
    mount('join', s);
    sound('join');
  }

  // ---------- 每日內容 ----------
  const nowMs = () => api.now?.() ?? Date.now();
  /** 領獎：領到就出「獲得物品」，之後重畫；領唔到出提示。kind 見 main.js 嘅 onClaim。 */
  function claim(kind, id, again, titleText) {
    const r = api.onClaim?.(kind, id);
    if (!r || !r.length) { sound('ui_deny'); toast(kind === 'shop' ? '買唔到' : '仲未領得', 'info'); return; }
    again(); reward(mergeRewards(r).map(rewardView), null, titleText);
  }
  let missionTab = 'daily';
  /** 任務：每日任務（六個 + 全部做完嘅寶箱）同成就（分類、進度條）。 */
  function missions(tab) {
    if (tab) missionTab = tab;
    api.onDaily?.();
    const meta = api.getMeta(), s = h('div', 'scr'), body = h('div', 'body');
    s.append(bar('任務', () => lobby(), curChip('gem')));
    const seg = h('div', 'seg'), list = missionsToday(meta), ach = achievements(meta);
    for (const [key, label, dot] of [['daily', '每日任務', list.some((m) => m.done && !m.got) || chestReady(meta)], ['ach', '成就', ach.some((a) => a.done && !a.got)]]) { const b = h('button', missionTab === key ? 'on' : '', label); b.type = 'button'; b.dataset.seg = key; if (dot && missionTab !== key) b.append(h('i', 'dot')); b.addEventListener('click', () => { sound('ui_click'); missions(key); }); seg.append(b); }
    body.append(seg);
    const row = (m, kind) => {
      const d = h('div', `ms ${m.got ? 'got' : m.done ? 'done' : ''}`);
      d.append(h('div', 'hd', `<span>${m.name}</span><small>${formatNumber(m.have)} / ${formatNumber(m.need)}</small>`), h('div', `pb ${m.done ? 'gold' : ''}`, '<i></i>')); d.lastChild.style.setProperty('--v', String(m.have / m.need));
      const ft = h('div', 'ft'); ft.append(h('div', 'costs', m.rewards.map((x) => costChip(x)).join('')));
      const b = btn(m.got ? `${icon('check')}已領` : '領取', `sm ${m.done && !m.got ? 'gold' : 'off'}`, () => claim(kind, m.id, () => missions()), m.got); b.dataset.claim = m.id; b.dataset.quiet = '1'; ft.append(b); d.append(ft);
      return d;
    };
    if (missionTab === 'daily') {
      const got = list.filter((m) => m.got).length, chest = h('div', 'pn chest'), ready = chestReady(meta), opened = !!meta.daily?.chest;
      chest.append(h('b', '', `${icon('gift')}每日寶箱<small style="margin-left:auto;font-size:var(--fs-s);color:var(--text-2)">${got} / ${list.length}</small>`), h('div', 'pb gold', '<i></i>')); chest.lastChild.style.setProperty('--v', String(list.length ? got / list.length : 0));
      const ft = h('div', 'act'); ft.append(h('div', 'costs', DAILY_CHEST.map((x) => costChip(x)).join('')));
      const cb = btn(opened ? `${icon('check')}已領` : '開寶箱', `sm ${ready ? 'gold' : 'off'}`, () => claim('chest', null, () => missions(), '每日寶箱'), opened); cb.dataset.chest = '1'; cb.dataset.quiet = '1'; ft.append(cb); chest.append(ft);
      body.append(chest);
      for (const m of list) body.append(row(m, 'mission'));
      body.append(h('div', 'note', '每日任務照本機日期，過咗午夜重置。'));
    } else {
      body.append(h('div', 'note', `已完成 <b>${ach.filter((a) => a.got).length}</b> / ${ach.length}`));
      for (const [g, label] of Object.entries(ACH_GROUPS)) { const part = ach.filter((a) => a.group === g); if (!part.length) continue; body.append(h('div', 'sec', label)); for (const a of [...part.filter((x) => x.done && !x.got), ...part.filter((x) => !x.done), ...part.filter((x) => x.got)]) body.append(row(a, 'ach')); }
    }
    s.append(body);
    mount('missions', s);
  }
  /** 七日簽到（彈窗）：七格，今日嗰格可以領，第七日大獎。 */
  function loginBox() {
    api.onDaily?.();
    const st = loginState(api.getMeta(), nowMs()), { mask, close } = overlay(), box = h('div', 'pn dlg hi'), days = h('div', 'days');
    box.append(h('h3', '', '七日簽到'), h('p', '', `連續第 <b style="color:var(--accent)">${st.day}</b> 日。每日領一次，第七日有大獎；斷咗就由第一日再嚟。`));
    LOGIN.forEach((list, i) => { const d = i + 1, past = d < st.day || (d === st.day && !st.ready), c = h('div', `dayc ${d === st.day && st.ready ? 'now' : past ? 'past' : ''}`, `<b>第 ${d} 日</b>${list.map((x) => costChip(x)).join('')}${past ? icon('check', 'chk') : ''}`); days.append(c); });
    box.append(days);
    const acts = h('div', 'acts'), ok = btn(st.ready ? '領取今日獎勵' : '今日已領', `sm ${st.ready ? 'gold' : 'off'}`, () => { close(); claim('login', null, () => lobby(), `簽到 · 第 ${st.day} 日`); }, !st.ready); ok.dataset.loginok = '1'; ok.dataset.quiet = '1';
    acts.append(btn('關閉', 'sm', close), ok); box.append(acts); mask.append(box);
  }
  /** 信箱：系統發嘅獎勵同通知，可以一鍵領晒。 */
  function mailbox() {
    api.onDaily?.();
    const meta = api.getMeta(), s = h('div', 'scr'), body = h('div', 'body'), list = mails(meta), unread = mailUnread(meta);
    const all = btn('全部領取', `sm ${unread ? 'gold' : 'off'}`, () => claim('mailAll', null, () => mailbox(), '信箱'), !unread); all.dataset.mailall = '1'; all.dataset.quiet = '1';
    s.append(bar('信箱', () => lobby(), all));
    if (!list.length) body.append(h('div', 'note', '未有信件。'));
    for (const m of list) {
      const c = h('div', `mailc ${m.got ? 'got' : ''}`), d = new Date(m.at);
      c.append(h('b', '', `${icon('mail', m.got ? 'dim' : 'gold')}${m.title}<small style="margin-left:auto;font-size:var(--fs-xs);color:var(--text-3)">${d.getMonth() + 1} 月 ${d.getDate()} 日</small>`), h('p', '', m.text));
      const ft = h('div', 'act'); ft.append(h('div', 'costs', m.rewards.map((x) => costChip(x)).join('')));
      const b = btn(m.got ? `${icon('check')}已領` : '領取', `sm ${m.got ? 'off' : 'gold'}`, () => claim('mail', m.id, () => mailbox(), m.title), m.got); b.dataset.mail = m.id; b.dataset.quiet = '1'; ft.append(b); c.append(ft); body.append(c);
    }
    s.append(body);
    mount('mailbox', s);
  }
  /** 商店：每日特價三格（各限一次）同常駐貨架（每日限購）。全部用遊戲貨幣，冇真錢。 */
  function shop() {
    api.onDaily?.();
    const meta = api.getMeta(), s = h('div', 'scr tabbed'), body = h('div', 'body'), shelf = shopShelf(meta, nowMs());
    s.append(bar('商店', null, curChip('gem'), goldChip()));
    const grid = (list) => {
      const g = h('div', 'goods');
      for (const x of list) {
        const it = ITEMS[x.give.item], who = x.give.id ? rosterOf(x.give.id) : null, c = h('div', `gd ${x.left > 0 ? '' : 'out'}`); c.style.setProperty('--rc', `var(--r${it.rarity})`);
        if (x.deal) c.append(h('span', 'tg red', `平 ${Math.round(x.off * 100)}%`));
        c.append(h('i', '', icon(it.icon)), h('b', '', `${who ? `${who.name}碎片` : it.name} ×${formatNumber(x.give.n)}`), h('small', '', x.left > 0 ? `今日仲可以換 ${x.left} 次` : '今日換晒'));
        const b = btn(`${icon(ITEMS[x.pay].icon, x.pay === 'gold' ? 'gold' : 'gem')}${formatNumber(x.cost)}${x.deal ? ` <s>${formatNumber(x.was)}</s>` : ''}`, `sm ${x.ok ? (x.pay === 'gold' ? 'gold' : 'pri') : 'off'}`, () => { if (x.left <= 0) { sound('ui_deny'); toast('今日換晒', 'info'); } else if (!x.ok) { sound('ui_deny'); toast(`${ITEMS[x.pay].name}唔夠`, ITEMS[x.pay].icon); } else { sound('ui_buy'); claim('shop', x.id, () => shop(), '換到'); } }); b.dataset.shop = x.id; b.dataset.quiet = '1'; c.append(b);
        g.append(c);
      }
      return g;
    };
    body.append(h('div', 'sec', '今日特價'), grid(shelf.filter((x) => x.deal)), h('div', 'sec', '常駐'), grid(shelf.filter((x) => !x.deal)), h('div', 'note', '特價同限購照本機日期，每日重置。所有嘢都係用遊戲入面賺到嘅金幣同晶石換。'));
    s.append(body, tabs('shop'));
    mount('shop', s);
  }
  /** 無盡模式：最佳紀錄、本週階段獎勵、本機紀錄榜、出擊。 */
  function endless() {
    api.onDaily?.();
    const meta = api.getMeta(), s = h('div', 'scr'), body = h('div', 'body'), E = meta.endless ?? { best: 0, bestDist: 0, runs: [] }, tiers = endlessTiers(meta, nowMs());
    s.append(bar('無盡模式', () => lobby()));
    const top = h('div', 'pn ebig hi'); top.append(h('small', '', '最佳紀錄'), h('b', '', E.best ? `第 ${E.best} 波` : '未有紀錄'), h('small', '', E.best ? `最遠 ${formatNumber(E.bestDist)} 米 · 本週最高第 ${tiers.some((t) => t.done) || meta.endless?.weekBest ? meta.endless.weekBest : 0} 波` : '一波接一波，打到輸為止'));
    body.append(top);
    const go = btn(`${icon('play')}出擊`, 'pri wide', () => api.onPlayEndless?.()); go.dataset.endlessgo = '1'; body.append(go);
    body.append(h('div', 'note', '每一波三節加一隻首領；每波嘅數照你入波嗰刻嘅戰力定，首領一波強過一波。比嘅係隊伍嘅效率：隊員輸出、爆發、走位。出戰隊伍照編隊。'));
    body.append(h('div', 'sec', '本週階段獎勵'));
    for (const t of tiers) {
      const d = h('div', `ms ${t.got ? 'got' : t.done ? 'done' : ''}`), ft = h('div', 'ft');
      d.append(h('div', 'hd', `<span>去到第 ${t.wave} 波</span>`)); ft.append(h('div', 'costs', t.rewards.map((x) => costChip(x)).join('')));
      const b = btn(t.got ? `${icon('check')}已領` : '領取', `sm ${t.done && !t.got ? 'gold' : 'off'}`, () => claim('tier', t.i, () => endless(), '階段獎勵'), t.got); b.dataset.tier = String(t.i); b.dataset.quiet = '1'; ft.append(b); d.append(ft); body.append(d);
    }
    body.append(h('div', 'note', '階段獎勵每週一（本機日期）重置。'), h('div', 'sec', '本機紀錄'));
    const recs = h('div', 'pn flat');
    if (!E.runs?.length) recs.append(h('div', 'note', '未有紀錄。'));
    (E.runs ?? []).forEach((r, i) => { const d = new Date(r.at); recs.append(h('div', 'rec', `<i>${i + 1}</i><span>第 ${r.wave} 波 · ${formatNumber(r.dist)} 米</span><small>${d.getMonth() + 1} 月 ${d.getDate()} 日</small>`)); });
    body.append(recs, h('div', 'note', '紀錄只存喺呢部機，唔會上網。'));
    s.append(body);
    mount('endless', s);
  }
  /** 無盡模式一局打完。r = { wave, dist, peak, rewards, best } */
  function endlessResult(r) {
    const s = h('div', 'scr glass res lost');
    s.append(h('div', 'rh', `<small>無盡模式</small><b>第 ${r.wave} 波</b>`)); s.firstChild.style.cssText = 'background:linear-gradient(90deg,rgba(111,242,230,0),rgba(111,242,230,.92) 22%,rgba(111,242,230,.92) 78%,rgba(111,242,230,0));color:#04302c';
    const card = h('div', 'pn'), lines = h('div', 'lines'); card.style.cssText = 'width:100%;margin-top:var(--sp-6)';
    const line = (a, b) => { const d = h('div'); d.append(h('span', '', a), h('span', '', b)); lines.append(d); };
    line('行咗幾遠', `${formatNumber(r.dist)} 米`); line('最高戰力', formatNumber(r.peak)); if (r.best) line('紀錄', '新紀錄！');
    card.append(lines, h('div', 'drops', `<small>獎勵</small>${r.rewards.map((x) => costChip(x)).join('')}`)); card.lastChild.style.marginTop = 'var(--sp-3)';
    s.append(card, h('div', 'grow'));
    const foot = h('div', 'foot'), row = h('div', 'acts'); foot.style.width = '100%';
    foot.append(btn(`${icon('retry')}再嚟一次`, 'pri wide', () => api.onPlayEndless?.()));
    row.append(btn('階段獎勵', 'sm', () => endless()), btn('大廳', 'sm', () => lobby())); foot.append(row); s.append(foot);
    mount('result', s);
    sound(r.best ? 'win' : 'lose');
  }

  // ---------- 招募 ----------
  /** 招募：橫額、保底進度、單抽／十連、機率一覽、各角色碎片進度。 */
  function gacha() {
    const meta = api.getMeta(), s = h('div', 'scr tabbed');
    s.append(bar('招募', null, curChip('ticket'), curChip('gem')));
    const body = h('div', 'body'), bn = h('div', 'gbn'); bn.append(img(KEY_VISUAL), h('div', 'tx', `<span class="tg">常駐</span><b>突擊隊集結</b><span>有機會得到新隊員、角色碎片同養成素材</span>`)); body.append(bn);
    const left = pityLeft(meta), pity = h('div', 'pn flat', `<div class="fxline">保底：再 <b>${left}</b> 次之內必出<b>傳說</b>（整個角色）</div><div class="pb gold" style="--v:${1 - left / GACHA.pity};margin-top:1.6cqw"><i></i></div>`); body.append(pity);
    const row = h('div', 'pulls');
    for (const count of [1, GACHA.ten]) {
      const c = pullCost(meta, count), b = btn(`${count === 1 ? '招募一次' : `招募 ${count} 次`}<small>${costChip(c, false)}</small>`, `${count === 1 ? '' : 'gold'} ${c.ok ? '' : 'off'}`, () => {
        const res = api.onPull?.(count);
        if (!res) { sound('ui_deny'); toast(`${ITEMS[c.item].name}唔夠`, ITEMS[c.item].icon); return; }
        reveal(res, () => gacha());
      }); b.dataset.pull = String(count); b.dataset.quiet = '1'; row.append(b);
    }
    body.append(row, h('div', 'note', `十連保證最少一個<b>史詩</b>或以上。有招募券會先用券；冇券先用晶石（一次 ${GACHA.gem} 粒）。`));
    const rb = btn(`${icon('info')}機率一覽`, 'sm', () => rates()); rb.dataset.rates = '1'; body.append(rb);
    body.append(h('div', 'sec', '角色碎片'));
    for (const r of ROSTER) {
      const own = joinedIds(meta).includes(r.id), c = charOf(meta, r.id), n = nextStar(meta, r.id), row2 = h('div', 'li'), av = h('div', 'av'); faceStyle(av, r.id, 0); if (!own) av.style.filter = 'brightness(.25)';
      row2.append(av, h('div', 'tx', `${own ? r.name : '？？？'} ${own ? stars(c.star, STAR.max) : ''}<small>${own ? (n.max ? '已經滿星' : `碎片 ${n.own} / ${n.need}${n.wild ? `（萬能 ${n.wild}）` : ''}`) : `未入隊 · 碎片 ${have(meta, 'shard', r.id)}`}</small>`));
      if (own && n.ok) row2.append(btn('升星', 'sm gold', () => detail(r.id, undefined, 'star')));
      body.append(row2);
    }
    s.append(body, tabs('gacha'));
    mount('gacha', s);
  }
  /** 機率一覽（由數值表直接讀，同實際抽嘅係同一份）。 */
  function rates() {
    const { mask, close } = overlay(), box = h('div', 'pn dlg');
    box.append(h('h3', '', '機率一覽'), h('table', 'rates', gachaRates().map((t) => `<tr style="--rc:var(--r${t.rarity})"><td>${t.name}</td><td>${t.percent}%</td><td>${t.what}</td></tr>`).join('')));
    box.append(h('div', 'note', `連續 ${GACHA.pity} 次冇出傳說，第 ${GACHA.pity} 次必出。十連最少一個史詩或以上。所有貨幣只可以喺遊戲入面賺。`), btn('知道了', 'pri sm', close));
    mask.append(box);
  }
  /** 開獎演出：一張張牌由背面反轉（稀有度越高越遲開、光越強）；撳一下全部開晒，再撳確定。抽到新角色：之後出「新隊員加入」。 */
  function reveal(results, then) {
    const { mask, close } = overlay('rv'), cards = h('div', `cards ${results.length === 1 ? 'one' : ''}`), top = Math.max(...results.map((x) => x.rarity));
    if (top >= 3) { const rays = h('div', 'rays'); rays.style.setProperty('--jc', top >= 4 ? '255,95,162' : '255,194,61'); mask.append(rays); }
    mask.append(h('h3', '', '招募結果'));
    const els = results.map((x) => {
      const cd = h('div', `cd r${x.rarity}`), isChar = x.item === 'char', who = x.id ? rosterOf(x.id) : null, inner = h('div'); cd.style.setProperty('--rc', `var(--r${x.rarity})`);
      const face = h('div', 'f', `<em>${x.tier}</em>`), av = who ? h('div', 'av') : null; if (av) faceStyle(av, who.id, 0);
      if (av) face.append(av); else face.insertAdjacentHTML('beforeend', icon(ITEMS[x.item].icon));
      face.append(h('span', '', isChar ? who.name : who ? `${who.name}碎片` : ITEMS[x.item].name), h('b', '', isChar ? 'NEW' : `×${formatNumber(x.n)}`));
      inner.append(face, h('div', 'bk', icon('recruit'))); cd.append(inner); cards.append(cd); return cd;
    });
    mask.append(cards);
    const ok = btn('確定', 'pri', () => { close(); const fresh = results.filter((x) => x.isNew).map((x) => x.id), next = () => (fresh.length ? join(fresh.shift(), next) : then()); next(); }); ok.dataset.revealok = '1'; ok.style.visibility = 'hidden'; ok.style.position = 'relative';
    mask.append(ok);
    let opened = 0;
    const openOne = (i) => { if (els[i].classList.contains('open')) return; els[i].classList.add('open'); sound(results[i].rarity >= 4 ? 'join' : results[i].rarity >= 3 ? 'prize' : 'coin'); if (++opened >= els.length) ok.style.visibility = ''; };
    results.forEach((x, i) => setTimeout(() => { if (mask.isConnected) openOne(i); }, 350 + i * 170 + (x.rarity >= 4 ? 250 : 0)));
    mask.addEventListener('click', (ev) => { if (ev.target !== ok) els.forEach((_, i) => openOne(i)); });
    sound('weapon_up');
  }

  // ---------- 關卡地圖同關卡簡介 ----------
  /** 關卡地圖：節點由下向上蛇形排，可以上下掃；撳一個節點出關卡簡介。open = 一入嚟就開邊關嘅簡介。 */
  let hardView = false;
  function map(open, hardSet) {
    const meta = api.getMeta(), s = h('div', 'scr tabbed'), canHard = hardOpen(meta);
    if (hardSet !== undefined) hardView = !!hardSet;
    if (!canHard) hardView = false;
    const hard = hardView, next = hard ? (() => { for (let n = 1; n <= STAGE_COUNT; n++) if (stageStars(meta, n, true) === 0) return n; return STAGE_COUNT; })() : nextStage(meta);
    const sw = h('div', 'modesw');
    if (canHard) for (const [v, label] of [[false, '普通'], [true, '困難']]) { const b = h('button', hard === v ? 'on' : '', label); b.type = 'button'; b.dataset.hard = v ? '1' : '0'; b.addEventListener('click', () => { if (hard !== v) { sound('ui_click'); map(undefined, v); } }); sw.append(b); }
    const starSum = hard ? Object.values(meta.hard ?? {}).reduce((a, v) => a + (v.stars ?? 0), 0) : totalStars(meta);
    s.append(bar(hard ? '困難' : '關卡', null, canHard ? sw : null, h('div', 'cur', `${icon('starFull', 'gold')}<b>${starSum} / ${STAGE_COUNT * 3}</b>`), canHard ? null : goldChip()));
    const sc = h('div', 'mapsc'), PITCH = 23, PAD = 18, H = PAD * 2 + (STAGE_COUNT - 1) * PITCH + 16, area = h('div', 'mapin'), pts = [];
    area.style.height = `calc(${H}cqw + var(--tabh))`;
    for (let n = 1; n <= STAGE_COUNT; n++) pts.push([50 + 29 * Math.sin((n - 1) * 1.15), H - PAD - (n - 1) * PITCH]);
    const line = (list, color, dash) => `<polyline points="${list.map((p) => p.join(',')).join(' ')}" fill="none" stroke="${color}" stroke-width="1.3" stroke-linecap="round" ${dash ? 'stroke-dasharray="1.2 3.2"' : ''}/>`;
    const svg = `<svg viewBox="0 0 100 ${H}" preserveAspectRatio="none" style="height:${H}cqw">${line(pts, 'rgba(255,255,255,.3)', true)}${line(pts.slice(0, Math.min(STAGE_COUNT, next)), TOKENS.primary, false)}</svg>`;
    area.innerHTML = svg;
    let focus = null;
    pts.forEach(([x, y], i) => {
      const n = i + 1, st = stageStars(meta, n, hard), ok = stageUnlocked(meta, n, hard), news = stageNews(n);
      // 未到嘅關：有新武器／新形態就預告
      const tease = !ok && (news.form || news.weapons.length) ? `<span class="tg">${news.form ? '新形態' : '新武器'}</span>` : '';
      const node = h(ok ? 'button' : 'div', `nd ${st ? 'done' : ok && n === next ? 'next' : ok ? '' : 'lock'}`, `${ok ? n : icon('lock')}${st ? stars(st) : ''}${tease}`);
      node.style.left = `${x}%`; node.style.top = `${y}cqw`; node.dataset.stage = String(n);
      if (ok) { node.type = 'button'; node.addEventListener('click', () => { sound('ui_click'); stageSheet(n, hard); }); }
      if (n === (open ?? next)) focus = node;
      area.append(node);
    });
    // 每一章嘅第一關下面一條章名
    for (const ch of CHAPTERS) { const t = h('div', 'chtag', `<span><em>${ch.no}</em>${ch.name}</span>`); t.style.top = `${pts[ch.from - 1][1] + 12.5}cqw`; area.append(t); }
    sc.append(area); s.append(sc, tabs('map'));
    mount('map', s);
    if (focus) sc.scrollTop = focus.offsetTop - sc.clientHeight * 0.45;
    if (open) stageSheet(open, hard);
  }
  /** 關卡簡介（由下面升上嚟嘅抽屜）：新嘢、武器、建議戰力對比、出擊。 */
  function stageSheet(n, hard = false) {
    const meta = api.getMeta(), S = STAGES[n - 1], adds = stageAdds(n), news = stageNews(n), [w0, w1] = S.weapons, { mask, close } = overlay('sheet'), box = h('div', 'pn sht');
    mask.addEventListener('click', (ev) => { if (ev.target === mask) close(); });
    const hd = h('div', 'hd', `<b>${hard ? '困難 ' : ''}第 ${n} 關</b>${stars(stageStars(meta, n, hard))}`), x = ibtn('close', close, '關閉'); hd.append(x); box.append(hd);
    const sc = h('div', 'scroll'), tags = h('div', 'tags');
    if (news.form) tags.append(h('span', 'tg', `新形態 ${FORM_MARK[news.form - 1]}`));
    for (const w of news.weapons) tags.append(h('span', 'tg', `新武器 · ${w.name}`));
    for (const k of adds) tags.append(h('span', 'tg info', `新 · ${FEATURES[k].name}`));
    if (tags.children.length) sc.append(tags);
    const need = Math.round(S.base * (S.rec ?? 1) * (hard ? HARD.hp : 1)), rally = rallyOf(meta, n, hard), mine = Math.round(S.base * (1 + UPGRADES.power.per * (meta.upgrades.power ?? 0)) * (1 + charStats(meta, lead.id).power) * (1 + rally.bonus));
    sc.append(h('div', 'cmp', `<div><small>建議開局戰力</small><b>${formatNumber(need)}</b></div>${icon(mine >= need ? 'check' : 'power', mine >= need ? 'mint' : 'dim')}<div><small>你而家</small><b class="${mine >= need ? 'ok' : 'low'}">${formatNumber(mine)}</b></div>`));
    sc.append(h('div', 'kv2', `${icon(WEAPON_ICON[WEAPONS[w0 - 1].id] ?? 'bullet')}<span>武器 <b>Lv${w0} ${WEAPONS[w0 - 1].name}</b> 開局，最高升到 <b>Lv${w1} ${WEAPONS[w1 - 1].name}</b></span>`));
    for (const k of adds) sc.append(h('div', 'kv2', `${icon('info')}<span><b>${FEATURES[k].name}</b>：${FEATURES[k].note}</span>`));
    if (rally.fails) sc.append(h('div', 'kv2', `${icon('power', 'gold')}<span><b>再接再厲</b>：呢關輸咗 ${rally.fails} 次，今次開局戰力 <b>+${Math.round(rally.bonus * 100)}%</b>（最多 +${RALLY.per * RALLY.max * 100}%，過關就冇）</span>`));
    if (S.intro) sc.append(h('div', 'note', S.intro));
    // 掉落：每次過關、首次過關、三粒星各自嘅一次性獎勵（攞咗嘅劃走）
    const got = stageStars(meta, n, hard), chips = (list, done) => list.map((x) => costChip(x, false, done ? 'got' : '')).join('');
    sc.append(h('div', 'drops', `<small>每次過關</small>${chips(DROPS.replay(n).map((x) => ({ ...x, n: x.n * (hard ? HARD.drop : 1) })), false)}`), h('div', 'drops', `<small>首次過關</small>${chips(hard ? HARD_FIRST(n) : DROPS.first(n), got > 0)}`));
    if (!hard) DROPS.stars(n).forEach((list, i) => sc.append(h('div', 'drops', `<small>${stars(i + 1)}</small>${chips(list, got >= i + 1)}`)));
    else sc.append(h('div', 'note', `困難模式：路障、盾、首領嘅數係普通嘅 <b>${HARD.hp}</b> 倍；掉落 <b>${HARD.drop}</b> 倍，首次過關送萬能碎片。`));
    box.append(sc);
    const go = btn(`${icon('play')}出擊`, 'pri wide', () => (hard ? api.onPlay(n, { hard: true }) : play(n)), !stageUnlocked(meta, n, hard)); go.dataset.go = String(n); box.append(go);
    mask.append(box);
  }

  // ---------- 基地 ----------
  const UP_ICON = { power: 'power', weapon: 'bullet', income: 'coin' };
  /** 基地 = 永久升級。tabbed = 由底部分頁入嚟（有分頁列）；否則左上角有返回掣（back）。 */
  function upgrades(back = () => lobby(), tabbed = false) {
    const meta = api.getMeta(), s = h('div', `scr ${tabbed ? 'tabbed' : ''}`);
    s.append(bar('基地', tabbed ? null : back ?? (() => lobby()), goldChip()));
    const body = h('div', 'body');
    body.append(h('div', 'note', '永久升級：買咗之後每一關都生效。'));
    for (const k of UPGRADE_KEYS) {
      const U = UPGRADES[k], lv = meta.upgrades[k] ?? 0, cost = upgradeCost(k, lv), full = lv >= U.max, can = !full && cost <= meta.gold, card = h('div', 'pn up');
      card.append(h('div', 'hd', `<i>${icon(UP_ICON[k] ?? 'power')}</i><div class="grow"><b>${U.name}</b><small>Lv ${lv} / ${U.max}</small><div class="pb" style="--v:${lv / U.max};margin-top:1cqw"><i></i></div></div>`));
      const buy = h('div', 'ft'); buy.append(h('div', 'fx grow', `<span>而家：${lv ? U.effect(lv) : '未升級'}</span>${full ? '' : `<span>下一級：<b>${U.effect(lv + 1)}</b></span>`}`));
      const b = btn(full ? '已滿級' : `${icon('coin')}${formatNumber(cost)}`, `sm ${can ? 'gold' : full ? '' : 'off'}`, () => { if (api.onBuy(k)) { sound('ui_buy'); upgrades(back, tabbed); } else { sound('ui_deny'); toast('金幣唔夠', 'coin'); } }, full);
      b.dataset.upgrade = k; b.dataset.quiet = '1'; // 唔夠錢都撳得：出「唔夠」嘅聲同提示
      buy.append(b); card.append(buy); body.append(card);
    }
    s.append(body);
    if (tabbed) s.append(tabs('base'));
    mount('upgrades', s);
  }

  // ---------- 結算 ----------
  /**
   * 結算。r = { stageNo, won, stars, peak, gold: { clear, stars, first, kills, total }, firstClear, joined }
   */
  function result(r) {
    const meta = api.getMeta(), s = h('div', `scr glass res ${r.won ? '' : 'lost'} ${r.seen ? 'seen' : ''}`);
    s.append(h('div', 'rh', `<small>${r.hard ? '困難 · ' : ''}第 ${r.stageNo} 關</small><b>${r.won ? '過關' : '全滅'}</b>`), h('div', '', r.won ? stars(r.stars) : `<div class="note lost">${isOpen('base') ? `${icon('base', 'mint')} 去基地升級開局戰力，再嚟過。` : `${icon('retry', 'mint')} 再試一次：留意避開紅色嘅門。`}</div>`));
    const card = h('div', 'pn'), lines = h('div', 'lines'); card.style.width = '100%';
    const line = (a, b, cls) => { const d = h('div', cls); d.append(h('span', '', a), h('span', '', b)); lines.append(d); return d; };
    line('最高戰力', formatNumber(r.peak));
    line(r.won ? '過關獎勵' : '參加獎勵', `+${formatNumber(r.gold.clear)}`);
    if (r.gold.stars) line(`新攞到 ${r.gold.newStars} 粒星`, `+${formatNumber(r.gold.stars)}`);
    if (r.gold.first) line('首次過關', `+${formatNumber(r.gold.first)}`);
    line('打低敵人', `+${formatNumber(r.gold.kills)}`);
    const sum = line('金幣', '', 'sum'); sum.lastChild.innerHTML = `${icon('coin', 'gold')}<b></b><small>共 ${formatNumber(meta.gold)}</small>`;
    countTo(sum.querySelector('b'), r.seen ? r.gold.total : 0, r.gold.total, (v) => `+${formatNumber(v)}`);
    card.append(lines);
    if (r.drops?.all?.length) { const d = h('div', 'drops', `<small>掉落</small>${r.drops.all.map((x) => costChip(x)).join('')}`); d.style.marginTop = 'var(--sp-3)'; card.append(d); }
    s.append(card);
    const sp = h('div', 'grow'); s.append(sp);
    // 今場有新隊員入隊：玩家撳邊個掣都好，先逐個出「新隊員加入」，睇完先做嗰個掣本身嘅嘢
    const after = (fn) => () => {
      const q = r.joined ?? []; r.joined = [];
      const ch = chapterOf(r.stageNo), key = storyKey(ch, 'out'), tale = r.won && !r.hard && r.stageNo === ch.to && !hinted(key);
      const last = () => { if (tale) { api.onHint?.(key); story(ch, 'outro', fn); } else fn(); }; // 一章最後一關第一次過：章尾對話
      const next = () => (q.length ? join(q.shift(), next) : last()); next();
    };
    const foot = h('div', 'foot'), row = h('div', 'acts'); foot.style.width = '100%';
    if (r.won && r.stageNo < STAGE_COUNT) foot.append(btn(`下一關${icon('next')}`, 'pri wide', after(() => (r.hard ? api.onPlay(r.stageNo + 1, { hard: true }) : play(r.stageNo + 1)))));
    else if (!r.won) foot.append(btn(`${icon('retry')}再打一次`, 'pri wide', after(() => api.onPlay(r.stageNo, { hard: r.hard }))));
    if (r.won) row.append(btn('再打一次', 'sm', after(() => api.onPlay(r.stageNo, { hard: r.hard }))));
    if (isOpen('base')) row.append(btn('基地', 'sm', after(() => upgrades(() => result(r)))));
    row.append(btn('大廳', 'sm', after(() => lobby())));
    foot.append(row); s.append(foot);
    const fresh = !r.seen; r.seen = true; goldShown = meta.gold;
    mount('result', s);
    if (!fresh) return;
    // 星星逐粒響，之後金幣滾幾下；首次過關再出「獲得物品」
    for (let i = 0; i < r.stars; i++) setTimeout(() => { if (screen === 'result') sound('star'); }, 350 + i * 260);
    for (let i = 0; i < 5; i++) setTimeout(() => { if (screen === 'result') sound('coin'); }, 1300 + i * 90);
    // 首次過關、新攞到嘅星：一次性獎勵用「獲得物品」彈窗講清楚
    const once = mergeRewards([...(r.won && r.firstClear && r.gold.first ? [{ item: 'gold', n: r.gold.first }] : []), ...(r.drops?.first ?? []), ...(r.drops?.stars ?? [])]);
    if (once.length) setTimeout(() => { if (screen === 'result' && cur === s) reward(once.map(rewardView), null, r.firstClear ? '首次過關獎勵' : '新星獎勵'); }, 1500);
  }

  // ---------- 設定、試聽、暫停、引導 ----------
  /** 設定：音效音量、音樂音量、震動開關（即改即存）；另有試聽全部音效。 */
  function settings(back = () => lobby()) {
    const st = api.getSettings(), s = h('div', 'scr');
    s.append(bar('設定', back));
    const body = h('div', 'body'), card = h('div', 'pn');
    const slider = (label, key, ic) => { const row = h('div', 'set'), inp = document.createElement('input'); inp.type = 'range'; inp.min = '0'; inp.max = '100'; inp.step = '10'; inp.value = String(Math.round((st[key] ?? 0) * 100)); inp.dataset.setting = key; inp.setAttribute('aria-label', label);
      const paint = () => inp.style.setProperty('--v', `${inp.value}%`); paint();
      inp.addEventListener('input', () => { paint(); api.onSettings({ [key]: Number(inp.value) / 100 }); if (key === 'sfx') sound('brick'); }); row.append(h('span', '', `${icon(ic)}${label}`), inp); card.append(row); };
    slider('音效音量', 'sfx', 'sound'); slider('音樂音量', 'music', 'music');
    const vib = h('div', 'set'), tog = h('button', `sw ${st.vibrate ? 'on' : ''}`, '<i></i>'); tog.type = 'button'; tog.setAttribute('role', 'switch'); tog.setAttribute('aria-checked', String(!!st.vibrate)); tog.setAttribute('aria-label', '震動');
    tog.addEventListener('click', () => { sound('ui_click'); api.onSettings({ vibrate: !api.getSettings().vibrate }); settings(back); });
    tog.dataset.setting = 'vibrate'; vib.append(h('span', '', `${icon('vibrate')}震動`), tog); card.append(vib);
    card.append(h('div', 'note', '震動只喺支援嘅裝置有效（部分手機嘅瀏覽器冇）。'));
    const again = btn(`${icon('tip')}重看新手引導`, 'sm', () => confirmBox('重看新手引導？', '會由第 1 關重新開始，逐步教一次。進度同金幣唔受影響。', '開始', () => api.onReplayTutorial?.())); again.dataset.replay = '1';
    body.append(card, again, btn(`${icon('sound')}音效試聽`, 'sm', () => sounds(() => settings(back))), h('div', 'verline', `數字突擊隊 NUMBER SQUAD · v${VERSION}`));
    s.append(body);
    mount('settings', s);
  }

  /** 試聽：每把聲一個掣。 */
  function sounds(back = () => lobby()) {
    const s = h('div', 'scr');
    s.append(bar('音效試聽', back));
    const body = h('div', 'body'), grid = h('div', 'grid');
    for (const name of ['map', 'battle', 'boss']) grid.append(btn(`${icon('music')}${name}`, 'sm pri', () => api.onMusic?.(name)));
    for (const name of api.soundNames?.() ?? []) { const b = btn(name, 'sm', () => sound(name)); b.dataset.quiet = '1'; grid.append(b); }
    body.append(grid); s.append(body);
    mount('sounds', s);
  }

  /** 暫停（戰鬥中撳右上角）：停咗個世界，可以繼續、改設定、或者放棄返大廳（要再確認）。 */
  function pause() {
    api.onPause?.();
    const s = h('div', 'scr glass'), mid = h('div', 'mask'), box = h('div', 'pn dlg'); mid.style.cssText = 'background:none;animation:none';
    box.append(h('h3', '', `${icon('pause')} 暫停`));
    const acts = h('div', 'acts col');
    acts.append(btn(`${icon('play')}繼續`, 'pri', () => { hide(); api.onResume?.(); }), btn(`${icon('settings')}設定`, '', () => settings(() => pause())), btn('放棄，返大廳', '', () => confirmBox('放棄呢關？', '今場嘅進度唔會計，亦都冇金幣。', '放棄', () => lobby(), true)));
    acts.firstChild.dataset.resume = '1';
    box.append(acts); mid.append(box); s.append(mid);
    mount('pause', s);
  }

  /** 引導提示：喺戰鬥畫面上面出一句，幾秒後自己收（唔擋操作）。 */
  function hint(text, seconds = 3.2) {
    const box = h('div', 'pn hint', `${icon('tip')}<span>${text}</span>`);
    mount('hint', box, true);
    clearTimeout(hintTimer);
    hintTimer = setTimeout(() => { if (screen === 'hint') hide(); }, seconds * 1000);
  }

  return { loading, title, lobby, team, detail, lineup, join, gacha, reveal, missions, loginBox, mailbox, shop, endless, endlessResult, map, upgrades, result, hint, hide, settings, sounds, pause, reward, story, coach, play, hud: hudUpdate, toast, get screen() { return screen; } };
}
