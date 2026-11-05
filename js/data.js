/* 静态数据：花色点数、牌型等级表、增强/版本/蜡封、星球/塔罗/幻灵、优惠券、标签、盲注、牌组、赌注、补充包 */
window.BT = window.BT || {};
(function (BT) {
  'use strict';

  /* 原作判同花时按 黑桃 → 红桃 → 梅花 → 方片 的顺序检查 */
  var SUITS = ['S', 'H', 'C', 'D'];
  var SUIT = {
    S: { zh: '黑桃', en: 'Spades', sym: '♠', color: '#3a3f8f', cls: 'S', nominal: 0.04 },
    H: { zh: '红桃', en: 'Hearts', sym: '♥', color: '#e2304e', cls: 'H', nominal: 0.03 },
    C: { zh: '梅花', en: 'Clubs', sym: '♣', color: '#17786a', cls: 'C', nominal: 0.02 },
    D: { zh: '方片', en: 'Diamonds', sym: '♦', color: '#ef7a1a', cls: 'D', nominal: 0.01 }
  };
  var RANKS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];
  var RANK_LABEL = { 2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9', 10: '10', 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };
  var RANK_ZH = { 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };
  function nominal(rank) { return rank === 14 ? 11 : (rank > 10 ? 10 : rank); }
  /* 同点数比较大小时 J<Q<K<A 的细分 */
  function faceNominal(rank) { return rank === 11 ? 0.1 : rank === 12 ? 0.2 : rank === 13 ? 0.3 : rank === 14 ? 0.4 : 0; }

  /* 牌型：s_* 为 1 级基础值，l_* 为每升一级的增量（与原作 1.0.1 一致） */
  var HANDS = [
    { key: 'flush_five', zh: '同花五条', en: 'Flush Five', chips: 160, mult: 16, lc: 50, lm: 3, hidden: true },
    { key: 'flush_house', zh: '同花葫芦', en: 'Flush House', chips: 140, mult: 14, lc: 40, lm: 4, hidden: true },
    { key: 'five', zh: '五条', en: 'Five of a Kind', chips: 120, mult: 12, lc: 35, lm: 3, hidden: true },
    { key: 'straight_flush', zh: '同花顺', en: 'Straight Flush', chips: 100, mult: 8, lc: 40, lm: 4 },
    { key: 'four', zh: '四条', en: 'Four of a Kind', chips: 60, mult: 7, lc: 30, lm: 3 },
    { key: 'full_house', zh: '葫芦', en: 'Full House', chips: 40, mult: 4, lc: 25, lm: 2 },
    { key: 'flush', zh: '同花', en: 'Flush', chips: 35, mult: 4, lc: 15, lm: 2 },
    { key: 'straight', zh: '顺子', en: 'Straight', chips: 30, mult: 4, lc: 30, lm: 3 },
    { key: 'three', zh: '三条', en: 'Three of a Kind', chips: 30, mult: 3, lc: 20, lm: 2 },
    { key: 'two_pair', zh: '两对', en: 'Two Pair', chips: 20, mult: 2, lc: 20, lm: 1 },
    { key: 'pair', zh: '对子', en: 'Pair', chips: 10, mult: 2, lc: 15, lm: 1 },
    { key: 'high', zh: '高牌', en: 'High Card', chips: 5, mult: 1, lc: 10, lm: 1 }
  ];
  var HAND = {};
  HANDS.forEach(function (h, i) { h.order = i + 1; HAND[h.key] = h; });
  var HAND_DESC = {
    flush_five: '5 张点数与花色都相同的牌',
    flush_house: '同花色的三条加对子',
    five: '5 张点数相同的牌',
    straight_flush: '5 张连续且同花色的牌',
    four: '4 张点数相同的牌',
    full_house: '三条加对子',
    flush: '5 张同花色的牌',
    straight: '5 张点数连续的牌（A 可作 1）',
    three: '3 张点数相同的牌',
    two_pair: '两组不同点数的对子',
    pair: '2 张点数相同的牌',
    high: '以上皆非时，仅最大的一张牌计分'
  };

  var PLANETS = [
    { key: 'pluto', zh: '冥王星', en: 'Pluto', hand: 'high', color: '#c29d7a', ring: false },
    { key: 'mercury', zh: '水星', en: 'Mercury', hand: 'pair', color: '#a9a9b8', ring: false },
    { key: 'uranus', zh: '天王星', en: 'Uranus', hand: 'two_pair', color: '#8fd8e0', ring: true },
    { key: 'venus', zh: '金星', en: 'Venus', hand: 'three', color: '#e6c27a', ring: false },
    { key: 'saturn', zh: '土星', en: 'Saturn', hand: 'straight', color: '#d9b26a', ring: true },
    { key: 'jupiter', zh: '木星', en: 'Jupiter', hand: 'flush', color: '#d79a6b', ring: false },
    { key: 'earth', zh: '地球', en: 'Earth', hand: 'full_house', color: '#4aa3df', ring: false },
    { key: 'mars', zh: '火星', en: 'Mars', hand: 'four', color: '#d4573b', ring: false },
    { key: 'neptune', zh: '海王星', en: 'Neptune', hand: 'straight_flush', color: '#3f6fe0', ring: true },
    { key: 'planet_x', zh: 'X 行星', en: 'Planet X', hand: 'five', color: '#7d5bd6', ring: true, softlock: true },
    { key: 'ceres', zh: '谷神星', en: 'Ceres', hand: 'flush_house', color: '#9aa39b', ring: false, softlock: true },
    { key: 'eris', zh: '阋神星', en: 'Eris', hand: 'flush_five', color: '#e7e1d8', ring: false, softlock: true }
  ];
  var PLANET = {};
  PLANETS.forEach(function (p) { PLANET[p.key] = p; });

  var ENH = {
    bonus: { zh: '奖励牌', en: 'Bonus Card', desc: '额外 {c}+30{} 筹码' },
    mult: { zh: '倍率牌', en: 'Mult Card', desc: '{m}+4{} 倍率' },
    wild: { zh: '万能牌', en: 'Wild Card', desc: '可视为任意花色' },
    glass: { zh: '玻璃牌', en: 'Glass Card', desc: '{x}X2{} 倍率\n{g}1/4{} 几率摧毁此牌' },
    steel: { zh: '钢铁牌', en: 'Steel Card', desc: '留在手牌中时 {x}X1.5{} 倍率' },
    stone: { zh: '石头牌', en: 'Stone Card', desc: '{c}+50{} 筹码\n无点数也无花色，总会计分' },
    gold: { zh: '黄金牌', en: 'Gold Card', desc: '回合结束时若留在手牌中\n获得 {$}$3{}' },
    lucky: { zh: '幸运牌', en: 'Lucky Card', desc: '{g}1/5{} 几率 {m}+20{} 倍率\n{g}1/15{} 几率获得 {$}$20{}' }
  };
  var ENH_KEYS = ['bonus', 'mult', 'wild', 'glass', 'steel', 'stone', 'gold', 'lucky'];

  var EDITION = {
    foil: { zh: '闪箔', en: 'Foil', desc: '{c}+50{} 筹码', cost: 2 },
    holo: { zh: '镭射', en: 'Holographic', desc: '{m}+10{} 倍率', cost: 3 },
    poly: { zh: '多彩', en: 'Polychrome', desc: '{x}X1.5{} 倍率', cost: 5 },
    negative: { zh: '负片', en: 'Negative', desc: '{e}+1{} 槽位', cost: 5 }
  };
  var SEAL = {
    gold: { zh: '金色蜡封', en: 'Gold Seal', desc: '打出并计分时获得 {$}$3{}', color: '#e9b33a' },
    red: { zh: '红色蜡封', en: 'Red Seal', desc: '重新触发此牌 {o}1{} 次', color: '#e23a3a' },
    blue: { zh: '蓝色蜡封', en: 'Blue Seal', desc: '回合结束时若留在手牌中，\n为最后打出的牌型生成对应{p}星球{}牌\n{i}（必须有空位）{}', color: '#2f7fe0' },
    purple: { zh: '紫色蜡封', en: 'Purple Seal', desc: '弃掉时生成一张{t}塔罗{}牌\n{i}（必须有空位）{}', color: '#8a4fd8' }
  };

  /* 塔罗：max = 可选牌数上限，min = 下限 */
  var TAROTS = [
    { key: 'fool', zh: '愚者', en: 'The Fool', num: '0', icon: '🃏', desc: '生成本局最后使用过的{t}塔罗{}或{p}星球{}牌\n{i}（愚者除外）{}' },
    { key: 'magician', zh: '魔术师', en: 'The Magician', num: 'I', icon: '🍀', max: 2, enh: 'lucky', desc: '将最多 {o}2{} 张选定的牌\n增强为{o}幸运牌{}' },
    { key: 'high_priestess', zh: '女祭司', en: 'The High Priestess', num: 'II', icon: '🌙', desc: '生成最多 {o}2{} 张随机{p}星球{}牌\n{i}（必须有空位）{}' },
    { key: 'empress', zh: '女皇', en: 'The Empress', num: 'III', icon: '👑', max: 2, enh: 'mult', desc: '将最多 {o}2{} 张选定的牌\n增强为{o}倍率牌{}' },
    { key: 'emperor', zh: '皇帝', en: 'The Emperor', num: 'IV', icon: '🏛️', desc: '生成最多 {o}2{} 张随机{t}塔罗{}牌\n{i}（必须有空位）{}' },
    { key: 'hierophant', zh: '教皇', en: 'The Hierophant', num: 'V', icon: '⛪', max: 2, enh: 'bonus', desc: '将最多 {o}2{} 张选定的牌\n增强为{o}奖励牌{}' },
    { key: 'lovers', zh: '恋人', en: 'The Lovers', num: 'VI', icon: '💞', max: 1, enh: 'wild', desc: '将 {o}1{} 张选定的牌\n增强为{o}万能牌{}' },
    { key: 'chariot', zh: '战车', en: 'The Chariot', num: 'VII', icon: '🛡️', max: 1, enh: 'steel', desc: '将 {o}1{} 张选定的牌\n增强为{o}钢铁牌{}' },
    { key: 'justice', zh: '正义', en: 'Justice', num: 'VIII', icon: '⚖️', max: 1, enh: 'glass', desc: '将 {o}1{} 张选定的牌\n增强为{o}玻璃牌{}' },
    { key: 'hermit', zh: '隐者', en: 'The Hermit', num: 'IX', icon: '🏮', desc: '资金翻倍\n{i}（最多获得 {$}$20{i}）{}' },
    { key: 'wheel', zh: '命运之轮', en: 'The Wheel of Fortune', num: 'X', icon: '🎡', desc: '{g}1/4{} 几率为一张随机小丑牌\n添加{e}闪箔{}、{e}镭射{}或{e}多彩{}版本' },
    { key: 'strength', zh: '力量', en: 'Strength', num: 'XI', icon: '💪', max: 2, desc: '将最多 {o}2{} 张选定牌的\n点数提升 {o}1{}' },
    { key: 'hanged_man', zh: '倒吊人', en: 'The Hanged Man', num: 'XII', icon: '🪢', max: 2, desc: '摧毁最多 {o}2{} 张选定的牌' },
    { key: 'death', zh: '死神', en: 'Death', num: 'XIII', icon: '💀', max: 2, min: 2, desc: '选择 {o}2{} 张牌，将{o}左边{}的牌\n变成{o}右边{}的牌\n{i}（拖动以调整顺序）{}' },
    { key: 'temperance', zh: '节制', en: 'Temperance', num: 'XIV', icon: '🏺', desc: '获得所有当前小丑牌的\n出售价值总和\n{i}（最多 {$}$50{i}）{}' },
    { key: 'devil', zh: '恶魔', en: 'The Devil', num: 'XV', icon: '😈', max: 1, enh: 'gold', desc: '将 {o}1{} 张选定的牌\n增强为{o}黄金牌{}' },
    { key: 'tower', zh: '高塔', en: 'The Tower', num: 'XVI', icon: '🗼', max: 1, enh: 'stone', desc: '将 {o}1{} 张选定的牌\n增强为{o}石头牌{}' },
    { key: 'star', zh: '星星', en: 'The Star', num: 'XVII', icon: '⭐', max: 3, suit: 'D', desc: '将最多 {o}3{} 张选定的牌\n转换为{D}方片{}' },
    { key: 'moon', zh: '月亮', en: 'The Moon', num: 'XVIII', icon: '🌕', max: 3, suit: 'C', desc: '将最多 {o}3{} 张选定的牌\n转换为{C}梅花{}' },
    { key: 'sun', zh: '太阳', en: 'The Sun', num: 'XIX', icon: '☀️', max: 3, suit: 'H', desc: '将最多 {o}3{} 张选定的牌\n转换为{H}红桃{}' },
    { key: 'judgement', zh: '审判', en: 'Judgement', num: 'XX', icon: '📯', desc: '生成一张随机小丑牌\n{i}（必须有空位）{}' },
    { key: 'world', zh: '世界', en: 'The World', num: 'XXI', icon: '🌍', max: 3, suit: 'S', desc: '将最多 {o}3{} 张选定的牌\n转换为{S}黑桃{}' }
  ];
  var TAROT = {};
  TAROTS.forEach(function (t) { TAROT[t.key] = t; });

  var SPECTRALS = [
    { key: 'familiar', zh: '使魔', en: 'Familiar', icon: '🐈‍⬛', desc: '摧毁手牌中 {o}1{} 张随机牌，\n向手牌添加 {o}3{} 张随机{o}增强人头牌{}' },
    { key: 'grim', zh: '冷酷', en: 'Grim', icon: '⚰️', desc: '摧毁手牌中 {o}1{} 张随机牌，\n向手牌添加 {o}2{} 张随机{o}增强 A{}' },
    { key: 'incantation', zh: '咒语', en: 'Incantation', icon: '📿', desc: '摧毁手牌中 {o}1{} 张随机牌，\n向手牌添加 {o}4{} 张随机{o}增强数字牌{}' },
    { key: 'talisman', zh: '护身符', en: 'Talisman', icon: '🧿', max: 1, seal: 'gold', desc: '为 {o}1{} 张选定的牌\n添加{$}金色蜡封{}' },
    { key: 'aura', zh: '光环', en: 'Aura', icon: '😇', max: 1, desc: '为 {o}1{} 张选定的牌添加\n{e}闪箔{}、{e}镭射{}或{e}多彩{}效果' },
    { key: 'wraith', zh: '幽灵', en: 'Wraith', icon: '👻', desc: '生成一张随机{r}稀有{}小丑牌，\n资金变为 {$}$0{}\n{i}（必须有空位）{}' },
    { key: 'sigil', zh: '魔印', en: 'Sigil', icon: '🔯', desc: '将手牌中所有牌\n转换为同一种随机花色' },
    { key: 'ouija', zh: '灵应板', en: 'Ouija', icon: '🪧', desc: '将手牌中所有牌\n转换为同一种随机点数\n{r}-1{} 手牌上限' },
    { key: 'ectoplasm', zh: '灵质', en: 'Ectoplasm', icon: '🫧', desc: '为一张随机小丑牌添加{e}负片{}，\n{r}-1{} 手牌上限\n{i}（每次使用惩罚 +1）{}' },
    { key: 'immolate', zh: '献祭', en: 'Immolate', icon: '🔥', desc: '摧毁手牌中 {o}5{} 张随机牌，\n获得 {$}$20{}' },
    { key: 'ankh', zh: '安卡', en: 'Ankh', icon: '☥', desc: '复制一张随机小丑牌，\n摧毁其他所有小丑牌\n{i}（复制品移除负片）{}' },
    { key: 'deja_vu', zh: '既视感', en: 'Deja Vu', icon: '🔁', max: 1, seal: 'red', desc: '为 {o}1{} 张选定的牌\n添加{r}红色蜡封{}' },
    { key: 'hex', zh: '妖法', en: 'Hex', icon: '🪬', desc: '为一张随机小丑牌添加{e}多彩{}，\n摧毁其他所有小丑牌' },
    { key: 'trance', zh: '出神', en: 'Trance', icon: '🌀', max: 1, seal: 'blue', desc: '为 {o}1{} 张选定的牌\n添加{b}蓝色蜡封{}' },
    { key: 'medium', zh: '灵媒', en: 'Medium', icon: '🔮', max: 1, seal: 'purple', desc: '为 {o}1{} 张选定的牌\n添加{t}紫色蜡封{}' },
    { key: 'cryptid', zh: '隐秘生物', en: 'Cryptid', icon: '🦶', max: 1, desc: '为 {o}1{} 张选定的牌\n生成 {o}2{} 张复制牌' },
    { key: 'soul', zh: '灵魂', en: 'The Soul', icon: '💠', hidden: true, desc: '生成一张{l}传奇{}小丑牌\n{i}（必须有空位）{}' },
    { key: 'black_hole', zh: '黑洞', en: 'Black Hole', icon: '🕳️', hidden: true, desc: '所有{o}牌型{}\n提升 {o}1{} 级' }
  ];
  var SPECTRAL = {};
  SPECTRALS.forEach(function (s) { SPECTRAL[s.key] = s; });

  /* 优惠券：req = 前置券；全部 $10 */
  var VOUCHERS = [
    { key: 'overstock', zh: '库存过剩', en: 'Overstock', icon: '📦', desc: '商店中可购买的卡牌槽位 {o}+1{}' },
    { key: 'overstock_plus', zh: '超额库存', en: 'Overstock Plus', icon: '🏬', req: 'overstock', desc: '商店中可购买的卡牌槽位 {o}+1{}' },
    { key: 'clearance', zh: '清仓大甩卖', en: 'Clearance Sale', icon: '🏷️', desc: '商店中所有卡牌和补充包\n{o}七五折{}' },
    { key: 'liquidation', zh: '清算', en: 'Liquidation', icon: '💸', req: 'clearance', desc: '商店中所有卡牌和补充包\n{o}五折{}' },
    { key: 'hone', zh: '磨砺', en: 'Hone', icon: '🔪', desc: '{e}闪箔{}、{e}镭射{}和{e}多彩{}卡牌\n出现频率提高至 {o}2 倍{}' },
    { key: 'glow_up', zh: '焕然一新', en: 'Glow Up', icon: '✨', req: 'hone', desc: '{e}闪箔{}、{e}镭射{}和{e}多彩{}卡牌\n出现频率提高至 {o}4 倍{}' },
    { key: 'reroll_surplus', zh: '重掷盈余', en: 'Reroll Surplus', icon: '🎲', desc: '重掷费用 {$}-$2{}' },
    { key: 'reroll_glut', zh: '重掷泛滥', en: 'Reroll Glut', icon: '🎰', req: 'reroll_surplus', desc: '重掷费用再 {$}-$2{}' },
    { key: 'crystal_ball', zh: '水晶球', en: 'Crystal Ball', icon: '🔮', desc: '消耗牌槽位 {o}+1{}' },
    { key: 'omen_globe', zh: '预兆球', en: 'Omen Globe', icon: '🌐', req: 'crystal_ball', desc: '{s}幻灵{}牌可能出现在\n任意{t}秘术包{}中' },
    { key: 'telescope', zh: '望远镜', en: 'Telescope', icon: '🔭', desc: '{p}天体包{}中总会包含你\n{o}最常打出的牌型{}对应的{p}星球{}牌' },
    { key: 'observatory', zh: '天文台', en: 'Observatory', icon: '🪐', req: 'telescope', desc: '消耗牌区中的{p}星球{}牌\n为其对应牌型提供 {x}X1.5{} 倍率' },
    { key: 'grabber', zh: '抓取器', en: 'Grabber', icon: '🦾', desc: '每回合永久 {b}+1{} 次出牌' },
    { key: 'nacho_tong', zh: '玉米片夹', en: 'Nacho Tong', icon: '🌮', req: 'grabber', desc: '每回合永久 {b}+1{} 次出牌' },
    { key: 'wasteful', zh: '浪费', en: 'Wasteful', icon: '🗑️', desc: '每回合永久 {r}+1{} 次弃牌' },
    { key: 'recyclomancy', zh: '回收术', en: 'Recyclomancy', icon: '♻️', req: 'wasteful', desc: '每回合永久 {r}+1{} 次弃牌' },
    { key: 'tarot_merchant', zh: '塔罗商人', en: 'Tarot Merchant', icon: '🧙', desc: '{t}塔罗{}牌在商店中\n出现频率提高至 {o}2 倍{}' },
    { key: 'tarot_tycoon', zh: '塔罗大亨', en: 'Tarot Tycoon', icon: '🎩', req: 'tarot_merchant', desc: '{t}塔罗{}牌在商店中\n出现频率提高至 {o}4 倍{}' },
    { key: 'planet_merchant', zh: '星球商人', en: 'Planet Merchant', icon: '🌍', desc: '{p}星球{}牌在商店中\n出现频率提高至 {o}2 倍{}' },
    { key: 'planet_tycoon', zh: '星球大亨', en: 'Planet Tycoon', icon: '🌌', req: 'planet_merchant', desc: '{p}星球{}牌在商店中\n出现频率提高至 {o}4 倍{}' },
    { key: 'seed_money', zh: '种子资金', en: 'Seed Money', icon: '🌱', desc: '每回合利息上限提高至 {$}$10{}' },
    { key: 'money_tree', zh: '摇钱树', en: 'Money Tree', icon: '🌳', req: 'seed_money', desc: '每回合利息上限提高至 {$}$20{}' },
    { key: 'blank', zh: '空白', en: 'Blank', icon: '⬜', desc: '{i}什么也不做？{}' },
    { key: 'antimatter', zh: '反物质', en: 'Antimatter', icon: '⚫', req: 'blank', desc: '{e}+1{} 小丑牌槽位' },
    { key: 'magic_trick', zh: '魔术戏法', en: 'Magic Trick', icon: '🎩', desc: '可以在商店中购买{o}扑克牌{}' },
    { key: 'illusion', zh: '幻象', en: 'Illusion', icon: '🪞', req: 'magic_trick', desc: '商店中的扑克牌可能带有\n{o}增强{}、{e}版本{}和/或{o}蜡封{}' },
    { key: 'hieroglyph', zh: '象形文字', en: 'Hieroglyph', icon: '𓂀', desc: '{o}-1{} 底注\n每回合 {b}-1{} 次出牌' },
    { key: 'petroglyph', zh: '岩画', en: 'Petroglyph', icon: '🦣', req: 'hieroglyph', desc: '{o}-1{} 底注\n每回合 {r}-1{} 次弃牌' },
    { key: 'directors_cut', zh: '导演剪辑版', en: "Director's Cut", icon: '🎬', desc: '每个底注可重掷 {o}1{} 次\nBoss 盲注，每次 {$}$10{}' },
    { key: 'retcon', zh: '设定修正', en: 'Retcon', icon: '📽️', req: 'directors_cut', desc: '可{o}无限次{}重掷 Boss 盲注，\n每次 {$}$10{}' },
    { key: 'paint_brush', zh: '画笔', en: 'Paint Brush', icon: '🖌️', desc: '{o}+1{} 手牌上限' },
    { key: 'palette', zh: '调色板', en: 'Palette', icon: '🎨', req: 'paint_brush', desc: '{o}+1{} 手牌上限' }
  ];
  var VOUCHER = {};
  VOUCHERS.forEach(function (v) { VOUCHER[v.key] = v; });

  /* 标签：ante = 最早出现的底注 */
  var TAGS = [
    { key: 'uncommon', zh: '罕见标签', en: 'Uncommon Tag', icon: '🟢', color: '#3fae6b', ante: 1, desc: '下一个商店会有一张\n免费的{g}罕见{}小丑牌' },
    { key: 'rare', zh: '稀有标签', en: 'Rare Tag', icon: '🔴', color: '#e04848', ante: 1, desc: '下一个商店会有一张\n免费的{r}稀有{}小丑牌' },
    { key: 'negative', zh: '负片标签', en: 'Negative Tag', icon: '⬛', color: '#4c4f6b', ante: 2, desc: '下一个商店中的基础版本\n小丑牌免费并变为{e}负片{}' },
    { key: 'foil', zh: '闪箔标签', en: 'Foil Tag', icon: '🔷', color: '#7aa6d8', ante: 1, desc: '下一个商店中的基础版本\n小丑牌免费并变为{e}闪箔{}' },
    { key: 'holo', zh: '镭射标签', en: 'Holographic Tag', icon: '🔶', color: '#d86a9a', ante: 1, desc: '下一个商店中的基础版本\n小丑牌免费并变为{e}镭射{}' },
    { key: 'poly', zh: '多彩标签', en: 'Polychrome Tag', icon: '🌈', color: '#b57be0', ante: 1, desc: '下一个商店中的基础版本\n小丑牌免费并变为{e}多彩{}' },
    { key: 'investment', zh: '投资标签', en: 'Investment Tag', icon: '💰', color: '#e4b23d', ante: 1, desc: '击败下一个 Boss 盲注后\n获得 {$}$25{}' },
    { key: 'voucher', zh: '优惠券标签', en: 'Voucher Tag', icon: '🎟️', color: '#d5732f', ante: 1, desc: '为下一个商店\n添加一张优惠券' },
    { key: 'boss', zh: 'Boss 标签', en: 'Boss Tag', icon: '♻️', color: '#a64ad8', ante: 1, desc: '重掷 {o}Boss 盲注{}' },
    { key: 'standard', zh: '标准标签', en: 'Standard Tag', icon: '🂠', color: '#4d7bd6', ante: 2, desc: '获得一个免费的\n{o}超级标准包{}' },
    { key: 'charm', zh: '魅力标签', en: 'Charm Tag', icon: '🔯', color: '#8f5bd6', ante: 1, desc: '获得一个免费的\n{t}超级秘术包{}' },
    { key: 'meteor', zh: '流星标签', en: 'Meteor Tag', icon: '☄️', color: '#2fa8c9', ante: 2, desc: '获得一个免费的\n{p}超级天体包{}' },
    { key: 'buffoon', zh: '小丑标签', en: 'Buffoon Tag', icon: '🤡', color: '#e35b3c', ante: 2, desc: '获得一个免费的\n{o}超级小丑包{}' },
    { key: 'handy', zh: '便利标签', en: 'Handy Tag', icon: '✋', color: '#3b82d6', ante: 2, desc: '本局每打出过 {b}1{} 手牌\n获得 {$}$1{}' },
    { key: 'garbage', zh: '垃圾标签', en: 'Garbage Tag', icon: '🗑️', color: '#d64a4a', ante: 2, desc: '本局每有 {r}1{} 次未用弃牌\n获得 {$}$1{}' },
    { key: 'ethereal', zh: '空灵标签', en: 'Ethereal Tag', icon: '👻', color: '#2a7fb8', ante: 2, desc: '获得一个免费的\n{s}幻灵包{}' },
    { key: 'coupon', zh: '折价券标签', en: 'Coupon Tag', icon: '✂️', color: '#e88a2a', ante: 1, desc: '下一个商店中的初始卡牌\n和补充包{o}免费{}' },
    { key: 'double', zh: '双倍标签', en: 'Double Tag', icon: '✖️', color: '#9c9c9c', ante: 1, desc: '复制下一个获得的标签\n{i}（双倍标签除外）{}' },
    { key: 'juggle', zh: '杂耍标签', en: 'Juggle Tag', icon: '🤹', color: '#d9b334', ante: 1, desc: '下回合 {o}+3{} 手牌上限' },
    { key: 'd6', zh: 'D6 标签', en: 'D6 Tag', icon: '🎲', color: '#45a35c', ante: 1, desc: '下一个商店中的重掷\n从 {$}$0{} 开始计价' },
    { key: 'topup', zh: '补充标签', en: 'Top-up Tag', icon: '➕', color: '#4a8ad8', ante: 2, desc: '生成最多 {o}2{} 张{b}普通{}小丑牌\n{i}（必须有空位）{}' },
    { key: 'speed', zh: '速度标签', en: 'Speed Tag', icon: '⏩', color: '#e0a23c', ante: 1, desc: '本局每跳过 {o}1{} 个盲注\n获得 {$}$5{}' },
    { key: 'orbital', zh: '轨道标签', en: 'Orbital Tag', icon: '🪐', color: '#3aa3c6', ante: 2, desc: '将{o}指定牌型{}\n提升 {o}3{} 级' },
    { key: 'economy', zh: '经济标签', en: 'Economy Tag', icon: '📈', color: '#e3b341', ante: 1, desc: '资金翻倍\n{i}（最多获得 {$}$40{i}）{}' }
  ];
  var TAG = {};
  TAGS.forEach(function (t) { TAG[t.key] = t; });

  /* 盲注：mult = 基础分倍数，dollars = 奖励，ante = 最早出现底注，showdown = 第 8 底注终局 Boss */
  var BLINDS = {
    small: { key: 'small', zh: '小盲注', en: 'Small Blind', mult: 1, dollars: 3, color: '#2f72c9', glyph: '小' },
    big: { key: 'big', zh: '大盲注', en: 'Big Blind', mult: 1.5, dollars: 4, color: '#e0912e', glyph: '大' }
  };
  var BOSSES = [
    { key: 'hook', zh: '钩子', en: 'The Hook', glyph: '钩', color: '#a84024', ante: 1, desc: '每次出牌后，随机弃掉 2 张手牌' },
    { key: 'ox', zh: '公牛', en: 'The Ox', glyph: '牛', color: '#b95b08', ante: 6, matador: true, desc: '打出最常用牌型（{o}#hand#{}）时\n资金归零' },
    { key: 'house', zh: '房屋', en: 'The House', glyph: '屋', color: '#5186a8', ante: 2, desc: '第一手牌背面朝上发出' },
    { key: 'wall', zh: '高墙', en: 'The Wall', glyph: '墙', color: '#8a59a5', ante: 2, mult: 4, desc: '超大盲注' },
    { key: 'wheel', zh: '车轮', en: 'The Wheel', glyph: '轮', color: '#50bf7c', ante: 2, desc: '{g}1/7{} 的牌背面朝上发出' },
    { key: 'arm', zh: '手臂', en: 'The Arm', glyph: '臂', color: '#6865f3', ante: 2, matador: true, desc: '降低所打出牌型的等级' },
    { key: 'club', zh: '梅花', en: 'The Club', glyph: '梅', color: '#8da36a', ante: 1, matador: true, debuffSuit: 'C', desc: '所有{C}梅花{}牌被削弱' },
    { key: 'fish', zh: '鱼', en: 'The Fish', glyph: '鱼', color: '#3e85bd', ante: 2, desc: '每次出牌后\n补发的牌背面朝上' },
    { key: 'psychic', zh: '灵媒', en: 'The Psychic', glyph: '灵', color: '#d9a62a', ante: 1, matador: true, desc: '必须打出 5 张牌' },
    { key: 'goad', zh: '刺棒', en: 'The Goad', glyph: '刺', color: '#b95c96', ante: 1, matador: true, debuffSuit: 'S', desc: '所有{S}黑桃{}牌被削弱' },
    { key: 'water', zh: '水', en: 'The Water', glyph: '水', color: '#6aa9c4', ante: 2, desc: '开始时没有弃牌次数' },
    { key: 'window', zh: '窗户', en: 'The Window', glyph: '窗', color: '#a9a295', ante: 1, matador: true, debuffSuit: 'D', desc: '所有{D}方片{}牌被削弱' },
    { key: 'manacle', zh: '镣铐', en: 'The Manacle', glyph: '铐', color: '#575757', ante: 1, desc: '-1 手牌上限' },
    { key: 'eye', zh: '眼睛', en: 'The Eye', glyph: '眼', color: '#4b71e4', ante: 3, matador: true, desc: '本回合不能重复打出同一牌型' },
    { key: 'mouth', zh: '嘴', en: 'The Mouth', glyph: '嘴', color: '#ae718e', ante: 2, matador: true, desc: '本回合只能打出一种牌型' },
    { key: 'plant', zh: '植物', en: 'The Plant', glyph: '植', color: '#709284', ante: 4, matador: true, desc: '所有人头牌被削弱' },
    { key: 'serpent', zh: '蛇', en: 'The Serpent', glyph: '蛇', color: '#439a4f', ante: 5, desc: '出牌或弃牌后\n总是只补 3 张牌' },
    { key: 'pillar', zh: '石柱', en: 'The Pillar', glyph: '柱', color: '#7e6752', ante: 1, matador: true, desc: '本底注中打出过的牌被削弱' },
    { key: 'needle', zh: '针', en: 'The Needle', glyph: '针', color: '#5c6e31', ante: 2, mult: 1, desc: '只能出牌 1 次' },
    { key: 'head', zh: '头颅', en: 'The Head', glyph: '首', color: '#ac9db4', ante: 1, matador: true, debuffSuit: 'H', desc: '所有{H}红桃{}牌被削弱' },
    { key: 'tooth', zh: '牙齿', en: 'The Tooth', glyph: '牙', color: '#b52d2d', ante: 3, desc: '每打出一张牌失去 {$}$1{}' },
    { key: 'flint', zh: '燧石', en: 'The Flint', glyph: '燧', color: '#e56a2f', ante: 2, matador: true, desc: '基础筹码和倍率减半' },
    { key: 'mark', zh: '印记', en: 'The Mark', glyph: '印', color: '#6a3847', ante: 2, desc: '所有人头牌背面朝上发出' },
    { key: 'amber_acorn', zh: '琥珀橡果', en: 'Amber Acorn', glyph: '橡', color: '#fda200', showdown: true, dollars: 8, desc: '翻转并打乱所有小丑牌' },
    { key: 'verdant_leaf', zh: '翠绿叶子', en: 'Verdant Leaf', glyph: '叶', color: '#56a786', showdown: true, dollars: 8, matador: true, desc: '在出售 1 张小丑牌前\n所有牌被削弱' },
    { key: 'violet_vessel', zh: '紫罗兰之杯', en: 'Violet Vessel', glyph: '杯', color: '#8a71e1', showdown: true, dollars: 8, mult: 6, desc: '超超大盲注' },
    { key: 'crimson_heart', zh: '绯红之心', en: 'Crimson Heart', glyph: '心', color: '#ac3232', showdown: true, dollars: 8, desc: '每次出牌随机禁用 1 张小丑牌' },
    { key: 'cerulean_bell', zh: '蔚蓝之铃', en: 'Cerulean Bell', glyph: '铃', color: '#009cfd', showdown: true, dollars: 8, desc: '强制始终选中 1 张牌' }
  ];
  var BOSS = {};
  BOSSES.forEach(function (b) {
    if (b.mult === undefined) b.mult = 2;
    if (b.dollars === undefined) b.dollars = 5;
    BOSS[b.key] = b;
  });

  /* 牌组 */
  var DECKS = [
    { key: 'red', zh: '红色牌组', en: 'Red Deck', color: '#d8433b', desc: '每回合 {r}+1{} 次弃牌' },
    { key: 'blue', zh: '蓝色牌组', en: 'Blue Deck', color: '#2f6fd0', desc: '每回合 {b}+1{} 次出牌' },
    { key: 'yellow', zh: '黄色牌组', en: 'Yellow Deck', color: '#e0b030', desc: '开局额外获得 {$}$10{}' },
    { key: 'green', zh: '绿色牌组', en: 'Green Deck', color: '#3a9a5a', desc: '回合结束时：\n每剩余 {b}1{} 次出牌 {$}$2{}\n每剩余 {r}1{} 次弃牌 {$}$1{}\n不再获得{o}利息{}' },
    { key: 'black', zh: '黑色牌组', en: 'Black Deck', color: '#2c2c3a', desc: '{e}+1{} 小丑牌槽位\n每回合 {b}-1{} 次出牌' },
    { key: 'magic', zh: '魔法牌组', en: 'Magic Deck', color: '#7b4fc9', desc: '开局获得{o}水晶球{}优惠券\n和 {o}2{} 张{t}愚者{}' },
    { key: 'nebula', zh: '星云牌组', en: 'Nebula Deck', color: '#30437d', desc: '开局获得{o}望远镜{}优惠券\n{r}-1{} 消耗牌槽位' },
    { key: 'ghost', zh: '幽灵牌组', en: 'Ghost Deck', color: '#5aa7b8', desc: '{s}幻灵{}牌可能出现在商店，\n开局获得一张{s}妖法{}' },
    { key: 'abandoned', zh: '废弃牌组', en: 'Abandoned Deck', color: '#5a6b4a', desc: '开局牌组中\n没有{o}人头牌{}' },
    { key: 'checkered', zh: '方格牌组', en: 'Checkered Deck', color: '#c94a5a', desc: '开局牌组中有\n26 张{S}黑桃{}和 26 张{H}红桃{}' },
    { key: 'zodiac', zh: '黄道牌组', en: 'Zodiac Deck', color: '#3a5fa8', desc: '开局获得{o}塔罗商人{}、\n{o}星球商人{}和{o}库存过剩{}' },
    { key: 'painted', zh: '彩绘牌组', en: 'Painted Deck', color: '#c46a2a', desc: '{o}+2{} 手牌上限\n{r}-1{} 小丑牌槽位' },
    { key: 'anaglyph', zh: '立体牌组', en: 'Anaglyph Deck', color: '#7a3a6a', desc: '每击败一个 Boss 盲注\n获得一个{o}双倍标签{}' },
    { key: 'plasma', zh: '等离子牌组', en: 'Plasma Deck', color: '#6a4ad0', desc: '计分时{o}平衡{}{c}筹码{}与{m}倍率{}\n盲注基础分 {r}X2{}' },
    { key: 'erratic', zh: '古怪牌组', en: 'Erratic Deck', color: '#3a8a8a', desc: '开局牌组中所有牌的\n点数与花色均随机' }
  ];
  var DECK = {};
  DECKS.forEach(function (d) { DECK[d.key] = d; });

  var STAKES = [
    { key: 'white', zh: '白色赌注', color: '#e8e8e8', desc: '基础难度' },
    { key: 'red', zh: '红色赌注', color: '#e04848', desc: '小盲注不给奖励金钱' },
    { key: 'green', zh: '绿色赌注', color: '#46b05a', desc: '每个底注所需分数增长更快' },
    { key: 'black', zh: '黑色赌注', color: '#3a3a4a', desc: '商店中可能出现{o}永恒{}小丑牌\n{i}（无法出售或摧毁）{}' },
    { key: 'blue', zh: '蓝色赌注', color: '#3a7ad8', desc: '每回合 {r}-1{} 次弃牌' },
    { key: 'purple', zh: '紫色赌注', color: '#8a4ad8', desc: '每个底注所需分数增长再加快' },
    { key: 'orange', zh: '橙色赌注', color: '#ea8a2a', desc: '商店中可能出现{o}易腐{}小丑牌\n{i}（5 回合后被削弱）{}' },
    { key: 'gold', zh: '金色赌注', color: '#e6c040', desc: '商店中可能出现{o}租用{}小丑牌\n{i}（售价 $1，每回合结束 -$3）{}' }
  ];

  /* 补充包：w = 出现权重（与原作一致） */
  var PACK_TYPES = {
    arcana: { zh: '秘术包', color: '#8a5bd6', what: '{t}塔罗{}牌', use: '立即使用' },
    celestial: { zh: '天体包', color: '#2f8fd0', what: '{p}星球{}牌', use: '立即使用' },
    standard: { zh: '标准包', color: '#4d6fb0', what: '{o}扑克牌{}', use: '加入牌组' },
    buffoon: { zh: '小丑包', color: '#e05a3c', what: '{o}小丑{}牌', use: '' },
    spectral: { zh: '幻灵包', color: '#2a8db0', what: '{s}幻灵{}牌', use: '立即使用' }
  };
  var PACKS = [];
  [['arcana', 3, 5, 4, 2, 0.5], ['celestial', 3, 5, 4, 2, 0.5], ['standard', 3, 5, 4, 2, 0.5],
    ['buffoon', 2, 4, 1.2, 0.6, 0.15], ['spectral', 2, 4, 0.6, 0.3, 0.07]].forEach(function (r) {
    PACKS.push({ key: r[0] + '_normal', type: r[0], size: 'normal', n: r[1], choose: 1, cost: 4, w: r[3] });
    PACKS.push({ key: r[0] + '_jumbo', type: r[0], size: 'jumbo', n: r[2], choose: 1, cost: 6, w: r[4] });
    PACKS.push({ key: r[0] + '_mega', type: r[0], size: 'mega', n: r[2], choose: 2, cost: 8, w: r[5] });
  });
  var PACK = {};
  PACKS.forEach(function (p) {
    var t = PACK_TYPES[p.type];
    p.zh = (p.size === 'jumbo' ? '巨型' : p.size === 'mega' ? '超级' : '') + t.zh;
    PACK[p.key] = p;
  });

  /* 底注基础分：绿注 scaling=2、紫注 scaling=3；8 底注以后按原作公式并保留两位有效数字 */
  var AMOUNTS = {
    1: [300, 800, 2000, 5000, 11000, 20000, 35000, 50000],
    2: [300, 900, 2600, 8000, 20000, 36000, 60000, 100000],
    3: [300, 1000, 3200, 9000, 25000, 60000, 110000, 200000]
  };
  function blindAmount(ante, scaling) {
    var amounts = AMOUNTS[scaling || 1];
    if (ante < 1) return 100;
    if (ante <= 8) return amounts[ante - 1];
    var k = 0.75, a = amounts[7], b = 1.6, c = ante - 8, d = 1 + 0.2 * (ante - 8);
    var amount = Math.floor(a * Math.pow(b + Math.pow(k * c, d), c));
    if (!isFinite(amount)) return amount;
    var p = Math.pow(10, Math.floor(Math.log10(amount) - 1));
    amount = amount - amount % p;
    return amount;
  }

  BT.Data = {
    SUITS: SUITS, SUIT: SUIT, RANKS: RANKS, RANK_LABEL: RANK_LABEL, RANK_ZH: RANK_ZH,
    nominal: nominal, faceNominal: faceNominal,
    HANDS: HANDS, HAND: HAND, HAND_DESC: HAND_DESC,
    PLANETS: PLANETS, PLANET: PLANET,
    ENH: ENH, ENH_KEYS: ENH_KEYS, EDITION: EDITION, SEAL: SEAL,
    TAROTS: TAROTS, TAROT: TAROT, SPECTRALS: SPECTRALS, SPECTRAL: SPECTRAL,
    VOUCHERS: VOUCHERS, VOUCHER: VOUCHER, TAGS: TAGS, TAG: TAG,
    BLINDS: BLINDS, BOSSES: BOSSES, BOSS: BOSS,
    DECKS: DECKS, DECK: DECK, STAKES: STAKES,
    PACK_TYPES: PACK_TYPES, PACKS: PACKS, PACK: PACK,
    blindAmount: blindAmount
  };
})(window.BT);
