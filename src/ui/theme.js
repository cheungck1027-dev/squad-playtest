// 介面設計規範（041 第一部分）：顏色、字級、圓角、間距、陰影，同埋全部共用組件嘅樣式。說明見 docs/ui-guide.md。
// 風格：墨線動畫風 + 斜切面板——深墨藍底、薄荷綠主色、琥珀金強調；面板切走左上同右下兩隻角，按鈕係向右傾嘅平行四邊形，
// 全部有一條硬邊墨影（唔係朦朧陰影）。所有畫面只准用呢度嘅變數同組件，唔好喺畫面入面另外寫顏色同字級。
//
// 尺寸單位：cqw / cqh（遊戲直幅框嘅闊同高嘅 1%），所以 320 至 430 闊、平板置中嗰條直幅都係同一個比例；
// 字級有像素下限（細機唔會細到睇唔到），可撳嘅嘢最少 44 像素。

/** 顏色同數值（畫布上面嘅戰鬥介面都由呢度攞色）。 */
export const TOKENS = {
  ink: ['#070912', '#0d1122', '#141a33', '#1d2547', '#2a3463'],
  text: ['#eef2ff', '#b4bde0', '#7c86b0'],
  primary: '#2fd3a0', primaryInk: '#06261c',
  accent: '#ffd24a', accentInk: '#2a1c00',
  info: '#6ff2e6', ok: '#5fe08a', warn: '#ff9f43', danger: '#ff5a6a',
  /** 稀有度：普通、精良、稀有、史詩、傳說 */
  rarity: ['#8f9bc4', '#4aa8ff', '#b47bff', '#ffc23d', '#ff5fa2'],
  /** 畫面轉場（秒） */
  transition: 0.24,
};

const P = ':is(#meta,#metaHud)';
const CUT = 'polygon(var(--cut) 0,100% 0,100% calc(100% - var(--cut)),calc(100% - var(--cut)) 100%,0 100%,0 var(--cut))';
const SKEW = 'polygon(var(--sk) 0,100% 0,calc(100% - var(--sk)) 100%,0 100%)';

export const THEME_CSS = `
:root{
  --ink-0:${TOKENS.ink[0]};--ink-1:${TOKENS.ink[1]};--ink-2:${TOKENS.ink[2]};--ink-3:${TOKENS.ink[3]};--ink-4:${TOKENS.ink[4]};
  --text:${TOKENS.text[0]};--text-2:${TOKENS.text[1]};--text-3:${TOKENS.text[2]};
  --primary:${TOKENS.primary};--primary-ink:${TOKENS.primaryInk};--accent:${TOKENS.accent};--accent-ink:${TOKENS.accentInk};
  --info:${TOKENS.info};--ok:${TOKENS.ok};--warn:${TOKENS.warn};--danger:${TOKENS.danger};
  --r0:${TOKENS.rarity[0]};--r1:${TOKENS.rarity[1]};--r2:${TOKENS.rarity[2]};--r3:${TOKENS.rarity[3]};--r4:${TOKENS.rarity[4]};
  --line:rgba(255,255,255,.14);--line-2:rgba(255,255,255,.3);
  --fs-xs:clamp(10px,2.9cqw,16px);--fs-s:clamp(11px,3.3cqw,19px);--fs-m:clamp(12.5px,3.8cqw,22px);--fs-l:clamp(14px,4.5cqw,26px);
  --fs-xl:clamp(17px,5.6cqw,32px);--fs-2xl:clamp(22px,7.4cqw,44px);--fs-3xl:clamp(30px,10.5cqw,64px);
  --sp-1:1.07cqw;--sp-2:2.13cqw;--sp-3:3.2cqw;--sp-4:4.27cqw;--sp-6:6.4cqw;
  --r-s:1.6cqw;--r-m:2.7cqw;--cut:3.2cqw;--sk:2.6cqw;--bw:max(1.5px,.45cqw);
  --shadow:drop-shadow(0 .9cqw 0 rgba(4,6,14,.6));
  --hit:max(44px,11.7cqw);
  --tabh:calc(max(50px,14.5cqw) + var(--sab));
  --font:"Noto Sans TC","PingFang TC","Microsoft JhengHei","Heiti TC",sans-serif;
  --sat:env(safe-area-inset-top,0px);--sab:env(safe-area-inset-bottom,0px);
}
${P}{position:absolute;top:0;left:50%;transform:translateX(-50%);height:100%;aspect-ratio:9/16;max-width:100%;container-type:size;font-family:var(--font);color:var(--text);
  user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;-webkit-tap-highlight-color:transparent;touch-action:manipulation;line-height:1.35}
#meta{z-index:5;overflow:hidden}
#metaHud{z-index:4;pointer-events:none}
#meta[hidden]{display:none}
#meta.pass{pointer-events:none}
${P} *{box-sizing:border-box}
${P} :is(h1,h2,h3,p){margin:0}
${P} button{font:inherit;color:inherit;border:0;background:none;padding:0;margin:0;cursor:pointer;-webkit-tap-highlight-color:transparent;touch-action:manipulation}
${P} img{-webkit-user-drag:none;user-select:none;pointer-events:none}
${P} .ic{width:1.25em;height:1.25em;flex:none;vertical-align:-.22em;display:inline-block}
${P} .ic.gold{color:var(--accent)}${P} .ic.gem{color:var(--info)}${P} .ic.mint{color:var(--primary)}${P} .ic.red{color:var(--danger)}${P} .ic.dim{color:var(--text-3)}

/* ---------- 畫面骨架：頂欄 .bar ／ 內容 .body（可以上下掃）／ 底部分頁 .tabs ---------- */
#meta .scr{position:absolute;inset:0;display:flex;flex-direction:column;z-index:1;
  background:repeating-linear-gradient(135deg,rgba(255,255,255,.022) 0 .5cqw,transparent .5cqw 3.4cqw),radial-gradient(120% 60% at 50% 0%,#26305f 0%,rgba(38,48,95,0) 70%),linear-gradient(180deg,var(--ink-2) 0%,var(--ink-1) 100%)}
#meta .scr.in{animation:scrIn var(--tt,.24s) cubic-bezier(.2,.8,.3,1)}
#meta .scr.out{z-index:0;pointer-events:none;animation:scrOut var(--tt,.24s) forwards}
@keyframes scrIn{from{opacity:0;transform:translateY(2.4cqw) scale(.985)}}
@keyframes scrOut{to{opacity:0}}
#meta .scr.glass{background:rgba(7,9,18,.78);backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px)}
#meta .scr.glass.in{animation:fadeIn var(--tt,.24s)}
@keyframes fadeIn{from{opacity:0}}
#meta .bar{flex:none;display:flex;align-items:center;gap:var(--sp-2);padding:calc(var(--sat) + var(--sp-2)) var(--sp-4) var(--sp-2);min-height:calc(var(--sat) + var(--hit) + var(--sp-4));
  background:linear-gradient(180deg,rgba(7,9,18,.7),rgba(7,9,18,0));position:relative;z-index:3}
#meta .bar h2{flex:1;min-width:0;font-size:var(--fs-xl);font-weight:900;font-style:italic;letter-spacing:.04em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:flex;align-items:center;gap:var(--sp-2)}
#meta .bar h2::before{content:"";width:1.3cqw;height:1.05em;background:var(--primary);transform:skewX(-14deg);flex:none}
#meta .body{flex:1;min-height:0;overflow-y:auto;overflow-x:hidden;touch-action:pan-y;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;padding:var(--sp-2) var(--sp-4) var(--sp-6);display:flex;flex-direction:column;gap:var(--sp-3);scrollbar-width:none}
#meta .body::-webkit-scrollbar{display:none}
#meta .scr.tabbed .body{padding-bottom:calc(var(--tabh) + var(--sp-4))}
#meta .foot{flex:none;padding:var(--sp-3) var(--sp-4) calc(var(--sab) + var(--sp-4));display:flex;flex-direction:column;gap:var(--sp-2);align-items:stretch}
#meta .row{display:flex;gap:var(--sp-2);align-items:center}
#meta .grow{flex:1;min-width:0}
#meta .sec{font-size:var(--fs-s);font-weight:900;color:var(--accent);letter-spacing:.12em;display:flex;align-items:center;gap:var(--sp-2);margin-top:var(--sp-1)}
#meta .sec::after{content:"";flex:1;height:var(--bw);background:linear-gradient(90deg,var(--line-2),transparent)}
#meta .note{font-size:var(--fs-s);line-height:1.6;color:var(--text-2)}
#meta .note b{color:var(--accent)}
#meta .note em{font-style:normal;color:var(--info);font-weight:800}

/* ---------- 面板：切角 + 幼邊 + 硬墨影 ---------- */
${P} .pn{position:relative;isolation:isolate;padding:var(--sp-4);filter:var(--shadow)}
${P} .pn::before,${P} .pn::after{content:"";position:absolute;z-index:-1;clip-path:${CUT}}
${P} .pn::before{inset:0;background:var(--pn-line,var(--line-2))}
${P} .pn::after{inset:var(--bw);background:var(--pn-bg,linear-gradient(180deg,#1b2346,#121831))}
${P} .pn.hi{--pn-line:var(--accent)}
${P} .pn.mint{--pn-line:var(--primary)}
${P} .pn.flat{filter:none}

/* ---------- 按鈕：主要 .pri ／ 次要（預設）／ 危險 .dan ／ 停用 :disabled；細 .sm、滿闊 .wide ---------- */
${P} .bt{position:relative;isolation:isolate;display:inline-flex;align-items:center;justify-content:center;gap:var(--sp-2);min-height:var(--hit);padding:0 6cqw;
  font-size:var(--fs-l);font-weight:900;font-style:italic;letter-spacing:.06em;white-space:nowrap;color:var(--text);filter:var(--shadow);transition:transform .08s,filter .08s}
${P} .bt::before,${P} .bt::after{content:"";position:absolute;z-index:-1;clip-path:${SKEW}}
${P} .bt::before{inset:0;background:var(--line-2)}
${P} .bt::after{inset:var(--bw);background:linear-gradient(180deg,#34407a 0%,#283263 50%,#222b57 50%,#1d2547 100%)}
${P} .bt:active:not(:disabled){transform:translateY(.7cqw) scale(.98);filter:drop-shadow(0 .2cqw 0 rgba(4,6,14,.6)) brightness(1.15)}
${P} .bt.pri{color:var(--primary-ink)}
${P} .bt.pri::before{background:#c9ffec}
${P} .bt.pri::after{background:linear-gradient(180deg,#6af5cb 0%,#3fe0b0 50%,#2fd3a0 50%,#1fb486 100%)}
${P} .bt.gold{color:var(--accent-ink)}
${P} .bt.gold::before{background:#fff3c4}
${P} .bt.gold::after{background:linear-gradient(180deg,#ffe58a 0%,#ffd866 50%,#ffd24a 50%,#eeb62c 100%)}
${P} .bt.dan{color:#2a070c}
${P} .bt.dan::before{background:#ffc9cf}
${P} .bt.dan::after{background:linear-gradient(180deg,#ff8490 0%,#ff6c7a 50%,#ff5a6a 50%,#e84556 100%)}
${P} .bt:disabled,${P} .bt.off{color:var(--text-3);cursor:default}
${P} .bt:disabled::before,${P} .bt.off::before{background:var(--line)}
${P} .bt:disabled::after,${P} .bt.off::after{background:#181e3a}
${P} .bt.sm{font-size:var(--fs-m);padding:0 4.4cqw;min-height:44px;height:max(44px,10cqw)}
${P} .bt.wide{width:100%}
${P} .bt small{font-size:var(--fs-s);font-style:normal;font-weight:800;letter-spacing:0;opacity:.85}
/* 圖示掣（正方形） */
${P} .ib{position:relative;width:var(--hit);height:var(--hit);flex:none;display:inline-flex;align-items:center;justify-content:center;font-size:var(--fs-xl);color:var(--text);
  background:rgba(7,9,18,.74);border:var(--bw) solid var(--line-2);border-radius:var(--r-m);transition:transform .08s,background .08s}
${P} .ib:active{transform:scale(.92);background:rgba(47,211,160,.25)}
${P} .ib.lab{flex-direction:column;gap:.3cqw;width:max(48px,13cqw);height:max(48px,13cqw)}
${P} .ib.lab span{font-size:var(--fs-xs);font-weight:800;line-height:1}

/* ---------- 貨幣列、標籤、紅點、進度條、清單項 ---------- */
${P} .cur{display:inline-flex;align-items:center;gap:1.4cqw;height:max(30px,8.6cqw);padding:0 3.2cqw 0 2.2cqw;background:rgba(7,9,18,.74);border:var(--bw) solid var(--line-2);border-radius:99px;font-size:var(--fs-m);font-weight:900;font-variant-numeric:tabular-nums;white-space:nowrap}
${P} .cur .ic{font-size:1.15em}
${P} .cur.pop{animation:numPop .42s}
@keyframes numPop{30%{transform:scale(1.22);border-color:var(--accent);color:var(--accent)}}
${P} .tg{display:inline-flex;align-items:center;gap:.3em;padding:.15em .9em;font-size:var(--fs-xs);font-weight:900;font-style:italic;color:var(--accent-ink);background:var(--accent);clip-path:polygon(.5em 0,100% 0,calc(100% - .5em) 100%,0 100%);white-space:nowrap;line-height:1.5}
${P} .tg.info{background:var(--info);color:#04302c}${P} .tg.mint{background:var(--primary);color:var(--primary-ink)}${P} .tg.dim{background:var(--ink-4);color:var(--text-2)}${P} .tg.red{background:var(--danger);color:#2a070c}
${P} .dot{position:absolute;top:-.8cqw;right:-.8cqw;width:2.8cqw;height:2.8cqw;min-width:9px;min-height:9px;border-radius:50%;background:var(--danger);border:.5cqw solid var(--ink-0)}
${P} .pb{height:max(6px,2cqw);background:rgba(255,255,255,.12);transform:skewX(-20deg);overflow:hidden}
${P} .pb i{display:block;height:100%;width:calc(var(--v,0)*100%);background:linear-gradient(90deg,var(--primary),var(--info));transition:width .3s}
${P} .pb.gold i{background:linear-gradient(90deg,#eeb62c,var(--accent))}
#meta .li{display:flex;align-items:center;gap:var(--sp-3);padding:var(--sp-2) var(--sp-3);background:rgba(20,26,51,.92);border:var(--bw) solid var(--line);border-radius:var(--r-m);min-height:var(--hit)}
#meta .li .tx{flex:1;min-width:0;font-size:var(--fs-m);font-weight:800}
#meta .li .tx small{display:block;font-size:var(--fs-s);font-weight:700;color:var(--text-2)}
#meta .av{width:13cqw;height:13cqw;flex:none;border-radius:var(--r-m);background:var(--ink-3) no-repeat;border:var(--bw) solid var(--line-2)}

/* ---------- 底部分頁列 ---------- */
#meta .tabs{position:absolute;left:0;right:0;bottom:0;height:var(--tabh);padding-bottom:var(--sab);display:flex;background:linear-gradient(180deg,rgba(13,17,34,.9),rgba(7,9,18,.98));border-top:var(--bw) solid var(--line-2);z-index:4}
#meta .tabs button{flex:1;min-width:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:.4cqw;font-size:var(--fs-xs);font-weight:800;color:var(--text-3);position:relative;transition:color .12s}
#meta .tabs button .ic{font-size:clamp(20px,6.2cqw,34px);transition:transform .15s}
#meta .tabs button.on{color:var(--primary)}
#meta .tabs button.on .ic{transform:translateY(-.5cqw) scale(1.1)}
#meta .tabs button.on::before{content:"";position:absolute;top:calc(var(--bw)*-1);left:22%;right:22%;height:.9cqw;background:var(--primary);transform:skewX(-30deg);box-shadow:0 0 3cqw var(--primary)}
#meta .tabs button:active{color:var(--text)}

/* ---------- 彈出視窗、底部抽屜、提示條 ---------- */
#meta .mask{position:absolute;inset:0;z-index:20;display:flex;align-items:center;justify-content:center;background:rgba(4,6,14,.84);animation:fadeIn .2s;padding:var(--sp-4)}
#meta .mask.sheet{align-items:flex-end;padding:0}
#meta .dlg{width:100%;max-width:86cqw;display:flex;flex-direction:column;gap:var(--sp-3);animation:dlgIn .24s cubic-bezier(.2,1.2,.4,1)}
@keyframes dlgIn{from{opacity:0;transform:scale(.9)}}
#meta .dlg h3{font-size:var(--fs-xl);font-weight:900;font-style:italic;text-align:center;letter-spacing:.06em}
#meta .dlg p{font-size:var(--fs-m);color:var(--text-2);text-align:center;line-height:1.6}
#meta .acts{display:flex;gap:var(--sp-3);justify-content:center}
#meta .acts.col{flex-direction:column}
#meta .acts .bt{flex:1}
#meta .sht{width:100%;max-height:80cqh;display:flex;flex-direction:column;gap:var(--sp-3);padding:var(--sp-4) var(--sp-4) calc(var(--sab) + var(--sp-4));animation:shtIn .26s cubic-bezier(.2,.8,.3,1);--pn-line:var(--primary)}
#meta .sht::before,#meta .sht::after{clip-path:polygon(var(--cut) 0,100% 0,100% 100%,0 100%,0 var(--cut))}
#meta .sht .scroll{overflow-y:auto;touch-action:pan-y;min-height:0;display:flex;flex-direction:column;gap:var(--sp-2);scrollbar-width:none}
@keyframes shtIn{from{transform:translateY(30%);opacity:0}}
#meta .toast{position:absolute;left:50%;top:38cqh;transform:translateX(-50%);z-index:30;display:flex;align-items:center;gap:var(--sp-2);padding:var(--sp-2) var(--sp-6);font-size:var(--fs-m);font-weight:900;white-space:nowrap;pointer-events:none;
  background:rgba(7,9,18,.94);border:var(--bw) solid var(--accent);clip-path:polygon(2.6cqw 0,100% 0,calc(100% - 2.6cqw) 100%,0 100%);animation:toastFade 1.5s forwards}
@keyframes toastFade{0%{opacity:0;transform:translate(-50%,2cqw)}12%{opacity:1;transform:translate(-50%,0)}78%{opacity:1}100%{opacity:0}}
#meta .hint{position:absolute;left:6cqw;right:6cqw;top:calc(var(--sat) + 30cqh);display:flex;align-items:center;justify-content:center;gap:var(--sp-2);text-align:center;font-size:var(--fs-l);font-weight:900;font-style:italic;padding:var(--sp-3) var(--sp-4);
  pointer-events:none;animation:dlgIn .24s cubic-bezier(.2,1.2,.4,1);--pn-line:var(--info);--pn-bg:rgba(10,14,30,.9)}
#meta .hint .ic{color:var(--info);font-size:1.2em}

/* ---------- 設定用：拉桿、開關 ---------- */
#meta input[type=range]{-webkit-appearance:none;appearance:none;width:46cqw;height:44px;background:none;margin:0;touch-action:pan-x;cursor:pointer}
#meta input[type=range]::-webkit-slider-runnable-track{height:max(6px,1.8cqw);background:linear-gradient(90deg,var(--primary) var(--v,50%),rgba(255,255,255,.16) var(--v,50%));transform:skewX(-20deg)}
#meta input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:max(18px,5.2cqw);height:max(18px,5.2cqw);margin-top:calc(max(18px,5.2cqw) / -2 + max(6px,1.8cqw) / 2);background:#fff;border:.7cqw solid var(--ink-0);box-shadow:0 0 0 var(--bw) var(--primary);transform:skewX(20deg) rotate(45deg)}
#meta input[type=range]::-moz-range-track{height:max(6px,1.8cqw);background:rgba(255,255,255,.16)}
#meta input[type=range]::-moz-range-progress{height:max(6px,1.8cqw);background:var(--primary)}
#meta input[type=range]::-moz-range-thumb{width:max(16px,4.6cqw);height:max(16px,4.6cqw);background:#fff;border:.7cqw solid var(--ink-0);border-radius:0;transform:rotate(45deg)}
#meta .sw{position:relative;width:max(56px,15cqw);height:44px;flex:none}
#meta .sw::before{content:"";position:absolute;left:0;right:0;top:50%;height:max(26px,7cqw);transform:translateY(-50%) skewX(-14deg);background:rgba(7,9,18,.8);border:var(--bw) solid var(--line-2);transition:background .15s,border-color .15s}
#meta .sw i{position:absolute;top:50%;left:8%;width:38%;height:max(18px,5cqw);transform:translateY(-50%) skewX(-14deg);background:var(--text-3);transition:left .15s,background .15s}
#meta .sw.on::before{background:rgba(47,211,160,.22);border-color:var(--primary)}
#meta .sw.on i{left:54%;background:var(--primary)}

/* ---------- 星 ---------- */
${P} .stars{display:inline-flex;gap:.2em;color:var(--accent)}
${P} .stars .off{color:var(--ink-4)}
`;

let installed = false;
/** 將規範嘅樣式放入頁面（只做一次）。 */
export function installTheme(extraCss = '') {
  if (installed) return; installed = true;
  const style = document.createElement('style'); style.id = 'theme'; style.textContent = THEME_CSS + extraCss; document.head.appendChild(style);
}
