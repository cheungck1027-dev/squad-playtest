// 介面圖示：全部係程式畫嘅向量圖（SVG），唔用表情符號、唔用字頂替。
// 一套規格：24×24 格、線粗 2、圓頭圓角、冇填色（要「面」嘅位用同色 18% 透明度填，寫 F）；顏色跟文字色（currentColor），由樣式決定。
// 用法：icon('coin')、icon('lock', 'big')。加新圖示：喺 ICONS 加一行，跟返呢套規格。

const F = 'fill="currentColor" fill-opacity=".18"';
const S = 'fill="currentColor" stroke="none"';

export const ICONS = {
  // ---- 貨幣同資源 ----
  coin: `<circle cx="12" cy="12" r="9" ${F}/><path d="M12 7.5l3.2 4.5-3.2 4.5L8.8 12z"/>`,
  gem: `<path d="M7 4h10l4 5-9 11L3 9z" ${F}/><path d="M3 9h18M9.5 4L8 9l4 11 4-11-1.5-5"/>`,
  energy: `<path d="M13.5 2.5L5 13.5h5.5l-1 8 9-11.5H13z" ${F}/>`,
  exp: `<rect x="4" y="3.500" width="16" height="17" rx="2" ${F}/><path d="M8 16v-3M12 16V8.500M16 16v-5.500"/>`,
  core: `<path d="M12 2.800l7.500 4.300v9.800L12 21.200l-7.500-4.300V7.100z" ${F}/><path d="M12 8l3.500 4-3.500 4-3.500-4z"/>`,
  ticket: `<path d="M3 8.500a2 2 0 002-2h14a2 2 0 002 2v7a2 2 0 00-2 2H5a2 2 0 00-2-2z" ${F}/><path d="M12 9.300l.9 1.800 2 .3-1.400 1.400.3 2-1.800-.9-1.800.9.3-2-1.400-1.400 2-.3z"/>`,
  shard: `<path d="M13 2.500l5.500 8-6.500 11-6.500-9z" ${F}/><path d="M13 2.500l-1 19M5.500 12.500l13-2"/>`,
  wild: `<path d="M12 2.500l2.600 6.200 6.400.600-4.900 4.300 1.500 6.400L12 16.600 6.400 20l1.500-6.400L3 9.300l6.400-.600z" ${F}/><path d="M12 8.500l1.800 3.200-1.800 3.200-1.800-3.200z"/>`,
  power: `<path d="M5 12.5l7-7 7 7M5 19l7-7 7 7"/>`,
  // ---- 入口 ----
  lobby: `<path d="M6 10.5V20h12v-9.5" ${F}/><path d="M3.5 12L12 4.5l8.5 7.5M10 20v-5h4v5"/>`,
  map: `<path d="M12 21s6.5-6 6.5-11a6.5 6.5 0 10-13 0c0 5 6.500 11 6.500 11z" ${F}/><circle cx="12" cy="10" r="2.4"/>`,
  team: `<circle cx="9" cy="8" r="3.2" ${F}/><path d="M2.800 20c.4-3.800 2.800-6 6.200-6s5.800 2.200 6.200 6"/><circle cx="17" cy="9" r="2.500"/><path d="M17 14.200c2.400.3 3.900 2.100 4.200 5.300"/>`,
  base: `<path d="M12 2.800l8 4.600v9.200l-8 4.600-8-4.600V7.400z" ${F}/><path d="M12 16.500v-8M8.500 11.500L12 8l3.500 3.500"/>`,
  recruit: `<rect x="6" y="3" width="12" height="18" rx="2" ${F}/><path d="M12 8.200l1.200 2.500 2.700.3-2 1.900.5 2.700-2.400-1.300-2.400 1.300.5-2.700-2-1.900 2.700-.3z"/>`,
  shop: `<path d="M5 8h14l-1.200 12.500H6.200z" ${F}/><path d="M9 8V6.500a3 3 0 016 0V8"/>`,
  mission: `<rect x="5" y="4.500" width="14" height="16.500" rx="2" ${F}/><path d="M9 4.500V3h6v1.500M8.500 13l2.500 2.500 4.500-5"/>`,
  mail: `<rect x="3" y="5.500" width="18" height="13" rx="2" ${F}/><path d="M3.500 7.500l8.500 6 8.500-6"/>`,
  rank: `<path d="M8 4h8v5a4 4 0 01-8 0z" ${F}/><path d="M8 5.500H4.500V7A3.500 3.500 0 008 10.500M16 5.500h3.500V7a3.500 3.500 0 01-3.500 3.500M12 13v4M8.500 20.500h7M10 17h4v3.500h-4z"/>`,
  event: `<path d="M6 4.500h11.500l-2.500 4 2.500 4H6z" ${F}/><path d="M6 21.500V3"/>`,
  settings: `<path d="M12 2.800l2 1.900 2.700-.5 1 2.600 2.500 1.100-.5 2.700 1.500 1.400-1.500 1.400.5 2.700-2.500 1.100-1 2.600-2.700-.5-2 1.900-2-1.900-2.700.5-1-2.600-2.500-1.100.5-2.700L2.800 12l1.500-1.400-.5-2.700 2.500-1.100 1-2.600 2.700.5z" ${F}/><circle cx="12" cy="12" r="3.200"/>`,
  // ---- 狀態同操作 ----
  lock: `<rect x="5" y="10.500" width="14" height="10" rx="2" ${F}/><path d="M8 10.500V8a4 4 0 018 0v2.500M12 14.500v2.500"/>`,
  star: `<path d="M12 3l2.700 5.600 6.100.8-4.500 4.300 1.100 6.100L12 16.900 6.600 19.800l1.100-6.100L3.200 9.400l6.100-.8z" ${F}/>`,
  starFull: `<path d="M12 3l2.700 5.600 6.100.8-4.500 4.300 1.100 6.100L12 16.900 6.600 19.800l1.100-6.100L3.200 9.400l6.100-.8z" fill="currentColor"/>`,
  pause: `<path d="M8.500 5.500v13M15.500 5.500v13" stroke-width="3.200"/>`,
  play: `<path d="M7.500 4.500l11.500 7.500-11.500 7.500z" ${F}/>`,
  back: `<path d="M14.500 5l-7 7 7 7"/>`,
  next: `<path d="M9.500 5l7 7-7 7"/>`,
  skip: `<path d="M5 5l7 7-7 7M12.500 5l7 7-7 7"/>`,
  close: `<path d="M6 6l12 12M18 6L6 18"/>`,
  check: `<path d="M5 12.500l4.500 4.500L19 7.500"/>`,
  plus: `<path d="M12 5v14M5 12h14"/>`,
  retry: `<path d="M19.500 12a7.500 7.500 0 11-2.400-5.500M19.500 3.500V8H15"/>`,
  info: `<circle cx="12" cy="12" r="9" ${F}/><path d="M12 11v6M12 7.500v.3"/>`,
  boss: `<path d="M12 3l9 9-9 9-9-9z" ${F}/><path d="M12 8v5M12 16v.3"/>`,
  flag: `<path d="M6 4.500h12v8H6z" ${F}/><path d="M6 21.500V3"/>`,
  sound: `<path d="M4 9.500h3.500l4.500-4v13l-4.500-4H4z" ${F}/><path d="M15.500 9a4 4 0 010 6M18 6.500a7.500 7.500 0 010 11"/>`,
  music: `<path d="M9 18V5.500l10-2V16"/><circle cx="6.500" cy="18" r="2.500" ${F}/><circle cx="16.500" cy="16" r="2.500" ${F}/>`,
  vibrate: `<rect x="8" y="3.500" width="8" height="17" rx="1.800" ${F}/><path d="M4.500 8.500v7M19.500 8.500v7M2 10.500v3M22 10.500v3"/>`,
  gift: `<rect x="4" y="10" width="16" height="10.500" rx="1.500" ${F}/><path d="M3 7h18v3H3zM12 7v13.500M12 7c-1.500-3.500-6-3.500-5-.8.5 1.300 3 .8 5 .8zm0 0c1.500-3.500 6-3.500 5-.8-.5 1.300-3 .8-5 .8z"/>`,
  hand: `<path d="M9 11.500V4.500a1.500 1.500 0 013 0V10l5.200 1c1.100.2 1.800 1.200 1.600 2.300l-.8 5.200c-.2 1.300-1.300 2.200-2.600 2.200h-3.900c-.9 0-1.700-.4-2.200-1.100l-3.800-5.100c-.6-.8.5-1.800 1.400-1.300L9 14.500z" ${F}/>`,
  tip: `<path d="M8.500 15.500A6.500 6.500 0 1115.500 15.500V18h-7z" ${F}/><path d="M9.500 21h5"/>`,
  // ---- 角色定位 ----
  assault: `<circle cx="12" cy="12" r="6.500" ${F}/><path d="M12 2.500v5M12 16.500v5M2.500 12h5M16.500 12h5"/><circle cx="12" cy="12" r="1" ${S}/>`,
  gunner: `<path d="M3 4.500h10.500V8H9l-1.300 4.500H4.500l1-4.500H3z" ${F}/><path d="M21 11.500H10.500V15H15l1.300 4.500h3.200l-1-4.500H21z" ${F}/>`,
  blade: `<path d="M8 16l12-12.500c.4 2.300-.3 4.300-1.800 5.800L9.500 17.500z" ${F}/><path d="M5.500 14.500l4 4M4 20l3-3"/>`,
  guard: `<path d="M12 3l8 2.500v6c0 4.500-3.200 8-8 9.500-4.800-1.500-8-5-8-9.500v-6z" ${F}/><path d="M12 8v8"/>`,
  support: `<circle cx="12" cy="12" r="9" ${F}/><path d="M12 7.500v9M7.500 12h9"/>`,
  // ---- 武器類型 ----
  bullet: `<path d="M9 21v-9c0-4 1.300-7 3-9 1.700 2 3 5 3 9v9z" ${F}/><path d="M9 16.500h6"/>`,
  scatter: `<path d="M12 21v-6M9 20l-3.500-5M15 20l3.500-5"/><circle cx="12" cy="6" r="2.200" ${F}/><circle cx="5" cy="9" r="2" ${F}/><circle cx="19" cy="9" r="2" ${F}/>`,
  shell: `<circle cx="11" cy="14" r="6.500" ${F}/><path d="M15.500 9.500L18 7M16.500 4l3.500 3.500M20 3l1-1"/>`,
  missile: `<path d="M20.500 3.500c.4 4.200-1 7.600-4 10.500l-3 2.500-6-6 2.500-3c2.900-3 6.300-4.400 10.500-4z" ${F}/><path d="M7.500 10.500l-4 .8 2.500-3.500 3.500-.3M13.500 16.500l-.8 4 3.500-2.500.3-3.500M4.500 19.500l3-3"/>`,
  gatling: `<rect x="3" y="8" width="12" height="8" rx="1.500" ${F}/><path d="M15 10h6.500M15 12h6.500M15 14h6.500M6 16v3.500h4"/>`,
  lance: `<path d="M13.500 5.500l7-2-2 7z" ${F}/><path d="M3.500 20.500L15.500 8.500"/>`,
  beam: `<path d="M3 12h12.500" stroke-width="3.200"/><path d="M18.500 6.500l2-2M18.500 17.500l2 2M20 12h2M16.500 8v8"/>`,
  bolt: `<path d="M14 2.500l-8 10h5l-2 9 9-11.500h-5.500z" ${F}/>`,
  wave: `<path d="M6 7c3 3 3 7 0 10M11 4.500c4.500 4.500 4.500 10.500 0 15M16 2.500c6 6 6 13 0 19"/>`,
  pillar: `<path d="M9 21V7.500l3-4.500 3 4.500V21z" ${F}/><path d="M4.500 21h15M5 9.500v6M19 9.500v6"/>`,
};

/** 武器 id → 武器類型圖示 */
export const WEAPON_ICON = { tracer: 'bullet', burst: 'bullet', scatter: 'scatter', shell: 'shell', missile: 'missile', gatling: 'gatling', lance: 'lance', laser: 'beam', chain: 'bolt', wave: 'wave', megalaser: 'beam', pillars: 'pillar' };
/** 角色 id → 定位圖示 */
export const ROLE_ICON = { falcon: 'assault', suzu: 'gunner', kiri: 'blade', tate: 'guard', akari: 'shell' };

/**
 * 一個圖示嘅 SVG 字串。
 * @param {keyof typeof ICONS} name
 * @param {string} [cls] 額外樣式名（例如 'gold'、'big'）
 */
export function icon(name, cls = '') {
  const body = ICONS[name] ?? ICONS.info;
  return `<svg class="ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;
}
