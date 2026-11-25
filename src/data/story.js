// 故事包裝同系統解鎖次序（041 第二部分）。全部文字原創，繁體中文書面語帶少量口語。
// 世界觀：城市被「蝕」一塊一塊吞掉——凡是被蝕碰過的東西都會褪成沒有數值的空殼；數字突擊隊用「戰力」把蝕頂回去。
//
// 章節：二十關分五章。每章開頭（第一次出擊該章第一關之前）同結尾（第一次通過該章最後一關之後）各有一段對話。
// who = 角色表 id（出立繪）或者 'cmd'（指揮官，即玩家；冇立繪）。講嘢嘅隊員一定係嗰刻已經入咗隊嘅。

/**
 * @typedef {{ who: string, text: string }} Line
 * @typedef {{ id: string, no: string, name: string, from: number, to: number, intro: Line[], outro: Line[] }} Chapter
 */

/** @type {Chapter[]} */
export const CHAPTERS = [
  {
    id: 'a', no: '第一章', name: '褪色的街', from: 1, to: 3,
    intro: [
      { who: 'falcon', text: '指揮官，前面三個街區已經被「蝕」吞掉了。被它碰過的東西，都只剩下空殼。' },
      { who: 'cmd', text: '路上那些發光的磚，就是還沒被吞掉的戰力？' },
      { who: 'falcon', text: '對。拿得越多，我的火力越強。你負責看路，我負責開槍。' },
      { who: 'falcon', text: '第一次合作，放輕鬆。跟著我跑就好。' },
    ],
    outro: [
      { who: 'suzu', text: '呼——這條街總算亮回來了！隊長，我剛才那幾槍帥不帥？' },
      { who: 'falcon', text: '帥。不過下次別衝到我前面去。' },
      { who: 'cmd', text: '「蝕」退了一點，但源頭還在更裡面。' },
      { who: 'falcon', text: '那就繼續推進。指揮官，下一段路會更擠，記得先回基地整備。' },
    ],
  },
  {
    id: 'b', no: '第二章', name: '斷橋之上', from: 4, to: 7,
    intro: [
      { who: 'suzu', text: '前面那座橋……中間整段都被啃掉了耶。' },
      { who: 'falcon', text: '「蝕」在橋上堆了路障，還放了大傢伙守著。看來它不想讓我們過去。' },
      { who: 'cmd', text: '情報說橋的另一頭有兩個失聯的隊員。' },
      { who: 'falcon', text: '那更要過去了。一個都不能少。' },
    ],
    outro: [
      { who: 'tate', text: '終於會合了。大家都沒受傷吧？讓我看看。' },
      { who: 'kiri', text: '……沒事。橋，守住了。' },
      { who: 'suzu', text: '有楯姐的盾和霧姐的刀，這下我可以放心亂衝啦！' },
      { who: 'falcon', text: '別亂衝。——指揮官，橋後面就是「蝕」最濃的地方。真正的硬仗現在才開始。' },
    ],
  },
  {
    id: 'c', no: '第三章', name: '蝕之源', from: 8, to: 10,
    intro: [
      { who: 'kiri', text: '……空氣變重了。源頭，很近。' },
      { who: 'tate', text: '這裡的「蝕」會主動攻擊。大家靠近一點，光盾一次只能擋一下。' },
      { who: 'cmd', text: '工程組還有一個人困在裡面，訊號就在前面。' },
      { who: 'falcon', text: '收到。先把人帶出來，再把源頭打穿。' },
    ],
    outro: [
      { who: 'akari', text: '轟——！看到沒有？最後那一炮是我的！圓仔也有份喔！' },
      { who: 'tate', text: '源頭熄滅了……城市的顏色，一點一點回來了呢。' },
      { who: 'kiri', text: '……還有別的城市。' },
      { who: 'falcon', text: '那就一座一座來。指揮官，數字突擊隊隨時待命。' },
      { who: 'cmd', text: '辛苦了。休息一下——然後，我們再出發。' },
    ],
  },
  {
    id: 'd', no: '第四章', name: '回聲高塔', from: 11, to: 15,
    intro: [
      { who: 'akari', text: '報告！圓仔收到一段怪訊號——源頭熄了，可是城北那座舊電塔還在「響」。' },
      { who: 'falcon', text: '「蝕」的殘響？……不對，它在學我們。' },
      { who: 'tate', text: '塔裡的方陣會左右移動，還會舉盾。就像在模仿隊形。' },
      { who: 'cmd', text: '那就在它學會之前，把塔拿下來。' },
      { who: 'suzu', text: '好耶，又有新靶子了！' },
    ],
    outro: [
      { who: 'kiri', text: '……塔頂，清空了。' },
      { who: 'akari', text: '訊號沒有消失，只是換了方向——指向地底。很深、很深的地方。' },
      { who: 'falcon', text: '原來我們之前打掉的，只是它伸出來的手。' },
      { who: 'cmd', text: '那下面的，就是本體。' },
    ],
  },
  {
    id: 'e', no: '第五章', name: '零點', from: 16, to: 20,
    intro: [
      { who: 'tate', text: '再往下，光盾的充能會變慢。大家千萬不要離開我太遠。' },
      { who: 'suzu', text: '這裡連數字都是冷的……隊長，我有點怕。' },
      { who: 'falcon', text: '怕就跟緊我。我們五個人一起下去，也要五個人一起上來。' },
      { who: 'cmd', text: '全隊注意：目標「零點」。出發。' },
    ],
    outro: [
      { who: 'falcon', text: '……結束了。零點，歸零。' },
      { who: 'akari', text: '全城的讀數都回來了！圓仔，快拍下來，這可是歷史性的一刻！' },
      { who: 'tate', text: '大家都在。一個都沒有少。' },
      { who: 'kiri', text: '……回去，喝茶。' },
      { who: 'suzu', text: '指揮官請客！——對吧？' },
      { who: 'cmd', text: '好，我請。數字突擊隊，任務完成。' },
    ],
  },
];

/** 第 n 關屬於邊一章。 */
export const chapterOf = (n) => CHAPTERS.find((c) => n >= c.from && n <= c.to) ?? CHAPTERS[CHAPTERS.length - 1];
/** 存檔入面記「睇過未」嘅鍵（只可以用英文字母）：章開頭 st + id + in，結尾 st + id + out。 */
export const storyKey = (chapter, part) => `st${chapter.id}${part}`;

/**
 * 系統解鎖次序：after = 第一次通過第幾關之後開（0 = 一開始就有）。ready = 呢個系統做好未（未做好嘅入口唔顯示，做好先改 true）。
 * 未解鎖而又 ready 嘅入口：顯示鎖同解鎖條件；解鎖嗰刻返到大廳會有一次性嘅說明彈窗（note）。
 */
export const UNLOCKS = [
  { id: 'lobby', after: 0, ready: true, name: '大廳', icon: 'lobby', note: '' },
  { id: 'map', after: 0, ready: true, name: '關卡', icon: 'map', note: '' },
  { id: 'base', after: 1, ready: true, name: '基地', icon: 'base', note: '用打關賺到的金幣做永久升級：開局戰力、武器熟練、收入加成。卡關的時候先來這裡。' },
  { id: 'team', after: 2, ready: true, name: '隊員', icon: 'team', note: '新隊員加入了！在這裡看隊員資料、安排誰出戰，還可以把喜歡的隊員設為大廳看板。' },
  { id: 'mission', after: 2, ready: true, name: '任務', icon: 'mission', note: '每天六個小目標，全部完成還有額外寶箱。長期目標在「成就」分頁。簽到和信箱也在大廳右邊。' },
  { id: 'gacha', after: 3, ready: true, name: '招募', icon: 'recruit', note: '用招募券或晶石招募：有機會得到新隊員、角色碎片和養成素材。' },
  { id: 'shop', after: 4, ready: true, name: '商店', icon: 'shop', note: '用金幣和晶石換素材和招募券，每天有三格特價。' },
  { id: 'endless', after: 5, ready: true, name: '無盡模式', icon: 'flag', note: '一波接一波，敵人不斷變強，看你能撐到第幾波。每週都有階段獎勵。' },
  { id: 'hard', after: 20, ready: true, name: '困難模式', icon: 'boss', note: '同樣的關卡，更強的敵人，更好的掉落，還有萬能碎片。在關卡頁右上角切換。' },
];
export const unlockOf = (id) => UNLOCKS.find((u) => u.id === id) ?? null;
/** 存檔入面記「解鎖說明睇過未」嘅鍵。 */
export const unlockKey = (id) => `un${id}`;

/**
 * 第 1 關嘅分步引導。每一步：when 幾時出（規則嗰邊判斷，見 meta/tutorial.js）、text 一句短說明、finger 手指示意（drag 左右拖、tap 撳、none）。
 * 玩家做到先去下一步；成個引導（去到揀門為止）大約 30 至 40 秒。
 */
export const TUTORIAL = [
  { id: 'move', text: '按住畫面左右拖，隊長就會跟著移動', finger: 'drag' },
  { id: 'brick', text: '跑進磚列那條線——每塊磚都會加戰力', finger: 'drag' },
  { id: 'shoot', text: '對準綠色的門射擊，門上的數字會越射越大', finger: 'drag' },
  { id: 'gate', text: '衝進綠色的門拿加成；紅色的門會扣戰力，要避開', finger: 'drag' },
  { id: 'wall', text: '路障頭上的數字是耐力：對準它射爆，後面有大獎磚', finger: 'drag' },
  { id: 'boss', text: '首領出現！戰力比它頭上的數字大就能贏', finger: 'none' },
];
/** 第一次爆發槽滿（任何一關）：教撳頭像。 */
export const TUTORIAL_BURST = { id: 'burst', text: '爆發槽滿了！輕點下面的頭像放爆發技', finger: 'tap' };
