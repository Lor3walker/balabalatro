/*
 * 150 张小丑牌。结构仿照原作 card.lua 的 calculate_joker(context)：
 *   calc(j, ctx, g) 在不同时机被调用，ctx.type ∈
 *   setting_blind / first_hand_drawn / before / play（逐张计分牌）/ rep_play（计分牌重新触发）/
 *   held（逐张手牌）/ rep_held / main（独立结算）/ other_joker / after / debuffed_hand /
 *   destroying_card / removed（扑克牌被摧毁）/ pre_discard / discard（逐张弃牌）/ end_of_round /
 *   selling_card / selling_self / open_booster / skipping_booster / reroll_shop / ending_shop /
 *   using_consumable / card_added（扑克牌加入牌组）
 *   返回值字段：chips mult xmult dollars hmult reps msg levelUp remove saved
 * 带 ctx.bp 的调用来自蓝图 / 头脑风暴，状态成长类效果要跳过（原作 not context.blueprint）。
 */
window.BT = window.BT || {};
(function (BT) {
  'use strict';

  var LIST = [], BY = {};
  var HAND_ZH = function (k) { return BT.Data.HAND[k].zh; };
  var SUIT_TAG = { S: '{S}', H: '{H}', C: '{C}', D: '{D}' };
  function suitTxt(s) { return SUIT_TAG[s] + BT.Data.SUIT[s].zh + '{}'; }
  function cur(t) { return '\n{i}（当前 ' + t + '{i}）{}'; }
  function curM(v) { return cur('{m}+' + v + '{} 倍率'); }
  function curC(v) { return cur('{c}+' + v + '{} 筹码'); }
  function curX(v) { return cur('{x}X' + BT.Utils.fmtX(v) + '{} 倍率'); }
  function odds(g, n) { return '{g}' + g.prob() + '/' + n + '{}'; }

  /*
   * J(key, 中文名, 英文名, 稀有度 1-4, 价格, 图标, 类型, 选项)
   * 类型用于牌面底色：m 加倍率 / c 加筹码 / x 乘倍率 / cm 双加 / e 特效 / r 重新触发 / $ 经济
   */
  function J(key, zh, en, rarity, cost, icon, type, o) {
    o = o || {};
    var def = {
      key: key, zh: zh, en: en, rarity: rarity, cost: cost, icon: icon, type: type,
      ab: o.ab || {}, bp: o.bp !== false, eternal: o.eternal !== false, perish: o.perish !== false,
      gate: o.gate || null, desc: o.desc, calc: o.calc || null, dollars: o.dollars || null,
      passive: o.passive || null, init: o.init || null, onAdd: o.onAdd || null
    };
    LIST.push(def); BY[key] = def;
  }

  function isMain(c) { return c.type === 'main'; }

  /* ---------------- 普通（61） ---------------- */
  J('joker', '小丑', 'Joker', 1, 2, '🃏', 'm', {
    desc: '{m}+4{} 倍率',
    calc: function (j, c) { if (isMain(c)) return { mult: 4 }; }
  });
  function suitJoker(key, zh, en, icon, suit) {
    J(key, zh, en, 1, 5, icon, 'm', {
      desc: '打出的' + suitTxt(suit) + '牌\n在计分时给予 {m}+3{} 倍率',
      calc: function (j, c, g) { if (c.type === 'play' && g.isSuit(c.card, suit)) return { mult: 3 }; }
    });
  }
  suitJoker('greedy_joker', '贪婪小丑', 'Greedy Joker', '♦️', 'D');
  suitJoker('lusty_joker', '色欲小丑', 'Lusty Joker', '❤️', 'H');
  suitJoker('wrathful_joker', '暴怒小丑', 'Wrathful Joker', '♠️', 'S');
  suitJoker('gluttonous_joker', '暴食小丑', 'Gluttonous Joker', '♣️', 'C');
  function handJoker(key, zh, en, cost, icon, hand, field, amt) {
    J(key, zh, en, 1, cost, icon, field === 'mult' ? 'm' : 'c', {
      desc: (field === 'mult' ? '{m}+' + amt + '{} 倍率' : '{c}+' + amt + '{} 筹码') + '\n如果打出的牌中包含{o}' + HAND_ZH(hand) + '{}',
      calc: function (j, c) { if (isMain(c) && c.poker[hand]) { var r = {}; r[field] = amt; return r; } }
    });
  }
  handJoker('jolly_joker', '开心小丑', 'Jolly Joker', 3, '😄', 'pair', 'mult', 8);
  handJoker('zany_joker', '古怪小丑', 'Zany Joker', 4, '🤪', 'three', 'mult', 12);
  handJoker('mad_joker', '疯狂小丑', 'Mad Joker', 4, '😠', 'two_pair', 'mult', 10);
  handJoker('crazy_joker', '狂野小丑', 'Crazy Joker', 4, '🌀', 'straight', 'mult', 12);
  handJoker('droll_joker', '滑稽小丑', 'Droll Joker', 4, '😏', 'flush', 'mult', 10);
  handJoker('sly_joker', '狡猾小丑', 'Sly Joker', 3, '🦊', 'pair', 'chips', 50);
  handJoker('wily_joker', '诡诈小丑', 'Wily Joker', 4, '🐺', 'three', 'chips', 100);
  handJoker('clever_joker', '机灵小丑', 'Clever Joker', 4, '🦉', 'two_pair', 'chips', 80);
  handJoker('devious_joker', '奸诈小丑', 'Devious Joker', 4, '😈', 'straight', 'chips', 100);
  handJoker('crafty_joker', '精明小丑', 'Crafty Joker', 4, '🎨', 'flush', 'chips', 80);
  J('half_joker', '半张小丑', 'Half Joker', 1, 5, '🌗', 'm', {
    desc: '{m}+20{} 倍率\n如果打出的牌不超过 {o}3{} 张',
    calc: function (j, c) { if (isMain(c) && c.full.length <= 3) return { mult: 20 }; }
  });
  J('credit_card', '信用卡', 'Credit Card', 1, 1, '💳', '$', { bp: false, desc: '资金最多可以透支到 {r}-$20{}' });
  J('banner', '旗帜', 'Banner', 1, 5, '🚩', 'c', {
    desc: function (j, g) { return '每剩余 {r}1{} 次弃牌\n{c}+30{} 筹码' + curC(30 * g.discardsLeft()); },
    calc: function (j, c, g) { if (isMain(c) && g.discardsLeft() > 0) return { chips: 30 * g.discardsLeft() }; }
  });
  J('mystic_summit', '神秘之峰', 'Mystic Summit', 1, 5, '🏔️', 'm', {
    desc: '剩余弃牌次数为 {r}0{} 时\n{m}+15{} 倍率',
    calc: function (j, c, g) { if (isMain(c) && g.discardsLeft() === 0) return { mult: 15 }; }
  });
  J('eight_ball', '8 号球', '8 Ball', 1, 5, '🎱', 'e', {
    desc: function (j, g) { return '每张打出的 {o}8{} 在计分时\n有 ' + odds(g, 4) + ' 几率生成一张{t}塔罗{}牌\n{i}（必须有空位）{}'; },
    calc: function (j, c, g) {
      if (c.type === 'play' && g.rid(c.card) === 8 && g.consRoom() && g.chance(4)) {
        g.createConsumable('tarot', { key: null, src: j }); return { msg: '+1 塔罗', color: 'tarot' };
      }
    }
  });
  J('misprint', '印错', 'Misprint', 1, 4, '🖨️', 'm', {
    desc: '{m}+0~23{} 倍率',
    calc: function (j, c, g) { if (isMain(c)) return { mult: g.randInt(0, 23) }; }
  });
  J('raised_fist', '举起拳头', 'Raised Fist', 1, 5, '✊', 'm', {
    desc: '将手牌中{o}点数最小{}的牌的\n点数{o}两倍{}加到倍率',
    calc: function (j, c, g) {
      if (c.type !== 'held') return;
      var low = null, lowId = 15, nom = 15;
      g.run.hand.forEach(function (h) { var id = g.rid(h); if (h.enh !== 'stone' && lowId >= id) { lowId = id; nom = BT.Data.nominal(h.rank); low = h; } });
      if (low === c.card) { if (g.cardDebuffed(c.card)) return { msg: '已削弱', color: 'dim' }; return { hmult: 2 * nom }; }
    }
  });
  J('chaos_the_clown', '混沌小丑', 'Chaos the Clown', 1, 4, '🤡', 'e', { bp: false, desc: '每个商店可免费重掷 {o}1{} 次' });
  J('scary_face', '恐怖面孔', 'Scary Face', 1, 4, '👹', 'c', {
    desc: '打出的{o}人头牌{}\n在计分时给予 {c}+30{} 筹码',
    calc: function (j, c, g) { if (c.type === 'play' && g.isFace(c.card)) return { chips: 30 }; }
  });
  J('abstract_joker', '抽象小丑', 'Abstract Joker', 1, 4, '🔷', 'm', {
    desc: function (j, g) { return '每有一张{o}小丑{}牌\n{m}+3{} 倍率' + curM(3 * g.run.jokers.length); },
    calc: function (j, c, g) { if (isMain(c)) return { mult: 3 * g.run.jokers.length }; }
  });
  J('delayed_gratification', '延迟满足', 'Delayed Gratification', 1, 4, '⏳', '$', {
    bp: false, desc: '如果回合结束时未使用弃牌\n每剩余 {r}1{} 次弃牌获得 {$}$2{}',
    dollars: function (j, g) { var r = g.run.round; return (r.discardsUsed === 0 && r.discardsLeft > 0) ? 2 * r.discardsLeft : 0; }
  });
  J('gros_michel', '大麦克香蕉', 'Gros Michel', 1, 5, '🍌', 'm', {
    eternal: false,
    desc: function (j, g) { return '{m}+15{} 倍率\n回合结束时有 ' + odds(g, 6) + ' 几率\n摧毁这张牌'; },
    calc: function (j, c, g) {
      if (isMain(c)) return { mult: 15 };
      if (c.type === 'end_of_round' && !c.bp) {
        if (g.chance(6)) { g.run.flags.grosExtinct = true; g.destroyJoker(j); return { msg: '灭绝了！', color: 'mult' }; }
        return { msg: '安全！', color: 'dim' };
      }
    }
  });
  J('even_steven', '偶数史蒂文', 'Even Steven', 1, 4, '✌️', 'm', {
    desc: '打出的{o}偶数{}点数牌\n在计分时给予 {m}+4{} 倍率\n{i}（10, 8, 6, 4, 2）{}',
    calc: function (j, c, g) { var id = g.rid(c.card); if (c.type === 'play' && id <= 10 && id >= 0 && id % 2 === 0) return { mult: 4 }; }
  });
  J('odd_todd', '奇数托德', 'Odd Todd', 1, 4, '☝️', 'c', {
    desc: '打出的{o}奇数{}点数牌\n在计分时给予 {c}+31{} 筹码\n{i}（A, 9, 7, 5, 3）{}',
    calc: function (j, c, g) { var id = g.rid(c.card); if (c.type === 'play' && ((id <= 10 && id >= 0 && id % 2 === 1) || id === 14)) return { chips: 31 }; }
  });
  J('scholar', '学者', 'Scholar', 1, 4, '🎓', 'cm', {
    desc: '打出的 {o}A{} 在计分时\n给予 {c}+20{} 筹码和 {m}+4{} 倍率',
    calc: function (j, c, g) { if (c.type === 'play' && g.rid(c.card) === 14) return { chips: 20, mult: 4 }; }
  });
  J('business_card', '名片', 'Business Card', 1, 4, '💼', '$', {
    desc: function (j, g) { return '打出的{o}人头牌{}在计分时\n有 ' + odds(g, 2) + ' 几率给予 {$}$2{}'; },
    calc: function (j, c, g) { if (c.type === 'play' && g.isFace(c.card) && g.chance(2)) return { dollars: 2 }; }
  });
  J('supernova', '超新星', 'Supernova', 1, 5, '💥', 'm', {
    desc: '将本局中所打出牌型的\n已打出次数加到倍率',
    calc: function (j, c, g) { if (isMain(c)) return { mult: g.run.hands[c.hand].played }; }
  });
  J('ride_the_bus', '搭乘巴士', 'Ride the Bus', 1, 6, '🚌', 'm', {
    perish: false, ab: { mult: 0 },
    desc: function (j) { return '连续打出不含计分{o}人头牌{}的手牌时\n这张牌获得 {m}+1{} 倍率' + curM(j.ab.mult); },
    calc: function (j, c, g) {
      if (c.type === 'before' && !c.bp) {
        var faces = c.scoring.some(function (x) { return g.isFace(x); });
        if (faces) { var last = j.ab.mult; j.ab.mult = 0; if (last > 0) return { msg: '重置', color: 'dim' }; }
        else j.ab.mult += 1;
      }
      if (isMain(c) && j.ab.mult > 0) return { mult: j.ab.mult };
    }
  });
  J('egg', '蛋', 'Egg', 1, 4, '🥚', '$', {
    bp: false, desc: '回合结束时\n出售价值增加 {$}$3{}',
    calc: function (j, c) { if (c.type === 'end_of_round' && !c.bp) { j.extraValue = (j.extraValue || 0) + 3; return { msg: '升值！', color: 'money' }; } }
  });
  J('runner', '跑步选手', 'Runner', 1, 5, '🏃', 'c', {
    perish: false, ab: { chips: 0 },
    desc: function (j) { return '如果打出的牌中包含{o}顺子{}\n这张牌获得 {c}+15{} 筹码' + curC(j.ab.chips); },
    calc: function (j, c) {
      if (c.type === 'before' && !c.bp && c.poker.straight) { j.ab.chips += 15; return { msg: '升级！', color: 'chips' }; }
      if (isMain(c) && j.ab.chips > 0) return { chips: j.ab.chips };
    }
  });
  J('ice_cream', '冰淇淋', 'Ice Cream', 1, 5, '🍦', 'c', {
    eternal: false, ab: { chips: 100 },
    desc: function (j) { return '{c}+' + j.ab.chips + '{} 筹码\n每打出一手牌 {c}-5{} 筹码'; },
    calc: function (j, c, g) {
      if (isMain(c)) return { chips: j.ab.chips };
      if (c.type === 'after' && !c.bp) {
        if (j.ab.chips - 5 <= 0) { g.destroyJoker(j); return { msg: '融化了！', color: 'chips' }; }
        j.ab.chips -= 5; return { msg: '-5', color: 'chips' };
      }
    }
  });
  J('splash', '水花飞溅', 'Splash', 1, 3, '💦', 'e', { bp: false, desc: '打出的{o}每一张{}牌都会计分' });
  J('blue_joker', '蓝色小丑', 'Blue Joker', 1, 5, '🔵', 'c', {
    desc: function (j, g) { return '牌库中每剩余一张牌\n{c}+2{} 筹码' + curC(2 * g.run.draw.length); },
    calc: function (j, c, g) { if (isMain(c) && g.run.draw.length > 0) return { chips: 2 * g.run.draw.length }; }
  });
  J('faceless_joker', '无面小丑', 'Faceless Joker', 1, 4, '😶', '$', {
    desc: '如果同时弃掉 {o}3{} 张或更多\n{o}人头牌{}，获得 {$}$5{}',
    calc: function (j, c, g) {
      if (c.type === 'discard' && c.card === c.full[c.full.length - 1]) {
        var n = c.full.filter(function (x) { return g.isFace(x); }).length;
        if (n >= 3) return { dollars: 5 };
      }
    }
  });
  J('green_joker', '绿色小丑', 'Green Joker', 1, 4, '💚', 'm', {
    perish: false, ab: { mult: 0 },
    desc: function (j) { return '每打出一手牌 {m}+1{} 倍率\n每弃一次牌 {m}-1{} 倍率' + curM(j.ab.mult); },
    calc: function (j, c) {
      if (c.type === 'before' && !c.bp) { j.ab.mult += 1; return { msg: '+1 倍率', color: 'mult' }; }
      if (c.type === 'discard' && !c.bp && c.card === c.full[c.full.length - 1]) {
        var prev = j.ab.mult; j.ab.mult = Math.max(0, j.ab.mult - 1);
        if (prev !== j.ab.mult) return { msg: '-1 倍率', color: 'mult' };
      }
      if (isMain(c)) return { mult: j.ab.mult };
    }
  });
  J('superposition', '叠加态', 'Superposition', 1, 4, '⚛️', 'e', {
    desc: '如果打出的牌型包含 {o}A{} 和{o}顺子{}\n生成一张{t}塔罗{}牌\n{i}（必须有空位）{}',
    calc: function (j, c, g) {
      if (isMain(c) && c.poker.straight && c.scoring.some(function (x) { return g.rid(x) === 14; }) && g.consRoom()) {
        g.createConsumable('tarot', { src: j }); return { msg: '+1 塔罗', color: 'tarot' };
      }
    }
  });
  J('todo_list', '待办清单', 'To Do List', 1, 4, '📝', '$', {
    init: function (j, g) { j.ab.hand = g.randomVisibleHand(null); },
    desc: function (j) { return '如果打出的牌型是{o}' + HAND_ZH(j.ab.hand || 'high') + '{}\n获得 {$}$4{}\n{i}（回合结束时改变牌型）{}'; },
    calc: function (j, c, g) {
      if (c.type === 'before' && c.hand === j.ab.hand) return { dollars: 4 };
      if (c.type === 'end_of_round' && !c.bp) { j.ab.hand = g.randomVisibleHand(j.ab.hand); return { msg: '重置', color: 'dim' }; }
    }
  });
  J('cavendish', '卡文迪什香蕉', 'Cavendish', 1, 4, '🍌', 'x', {
    eternal: false,
    desc: function (j, g) { return '{x}X3{} 倍率\n回合结束时有 ' + odds(g, 1000) + ' 几率\n摧毁这张牌'; },
    calc: function (j, c, g) {
      if (isMain(c)) return { xmult: 3 };
      if (c.type === 'end_of_round' && !c.bp) {
        if (g.chance(1000)) { g.destroyJoker(j); return { msg: '灭绝了！', color: 'mult' }; }
        return { msg: '安全！', color: 'dim' };
      }
    }
  });
  J('red_card', '红牌', 'Red Card', 1, 5, '🟥', 'm', {
    perish: false, ab: { mult: 0 },
    desc: function (j) { return '每跳过一个{o}补充包{}\n这张牌获得 {m}+3{} 倍率' + curM(j.ab.mult); },
    calc: function (j, c) {
      if (c.type === 'skipping_booster' && !c.bp) { j.ab.mult += 3; return { msg: '+3 倍率', color: 'mult' }; }
      if (isMain(c) && j.ab.mult > 0) return { mult: j.ab.mult };
    }
  });
  J('square_joker', '方形小丑', 'Square Joker', 1, 4, '🟧', 'c', {
    perish: false, ab: { chips: 0 },
    desc: function (j) { return '如果打出的牌恰好有 {o}4{} 张\n这张牌获得 {c}+4{} 筹码' + curC(j.ab.chips); },
    calc: function (j, c) {
      if (c.type === 'before' && !c.bp && c.full.length === 4) { j.ab.chips += 4; return { msg: '升级！', color: 'chips' }; }
      if (isMain(c) && j.ab.chips > 0) return { chips: j.ab.chips };
    }
  });
  J('riff_raff', '乌合之众', 'Riff-Raff', 1, 6, '👥', 'e', {
    desc: '选择{o}盲注{}时\n生成 {o}2{} 张{b}普通{}小丑牌\n{i}（必须有空位）{}',
    calc: function (j, c, g) {
      if (c.type === 'setting_blind' && !j.slicing) {
        var n = Math.min(2, g.jokerRoom());
        if (n > 0) { for (var i = 0; i < n; i++) g.createJoker({ rarity: 1, src: j }); return { msg: '+' + n + ' 小丑', color: 'chips' }; }
      }
    }
  });
  J('photograph', '照片', 'Photograph', 1, 5, '📷', 'x', {
    desc: '第一张打出的{o}人头牌{}\n在计分时给予 {x}X2{} 倍率',
    calc: function (j, c, g) {
      if (c.type !== 'play' || !g.isFace(c.card)) return;
      for (var i = 0; i < c.scoring.length; i++) if (g.isFace(c.scoring[i])) { if (c.scoring[i] === c.card) return { xmult: 2 }; return; }
    }
  });
  J('reserved_parking', '预留车位', 'Reserved Parking', 1, 6, '🅿️', '$', {
    desc: function (j, g) { return '手牌中的每张{o}人头牌{}\n有 ' + odds(g, 2) + ' 几率给予 {$}$1{}'; },
    calc: function (j, c, g) {
      if (c.type === 'held' && g.isFace(c.card) && g.chance(2)) return { dollars: 1 };
    }
  });
  J('mail_in_rebate', '邮寄返利', 'Mail-In Rebate', 1, 4, '📮', '$', {
    desc: function (j, g) { return '每弃掉一张 {o}' + BT.Data.RANK_LABEL[g.run.current.mailRank] + '{}\n获得 {$}$5{}\n{i}（点数每回合改变）{}'; },
    calc: function (j, c, g) {
      if (c.type === 'discard' && !g.cardDebuffed(c.card) && g.rid(c.card) === g.run.current.mailRank) return { dollars: 5 };
    }
  });
  J('hallucination', '幻觉', 'Hallucination', 1, 4, '🍄', 'e', {
    desc: function (j, g) { return '每打开一个{o}补充包{}\n有 ' + odds(g, 2) + ' 几率生成{t}塔罗{}牌\n{i}（必须有空位）{}'; },
    calc: function (j, c, g) {
      if (c.type === 'open_booster' && g.consRoom() && g.chance(2)) { g.createConsumable('tarot', { src: j }); return { msg: '+1 塔罗', color: 'tarot' }; }
    }
  });
  J('fortune_teller', '占卜师', 'Fortune Teller', 1, 6, '🧿', 'm', {
    desc: function (j, g) { return '本局每使用过一张{t}塔罗{}牌\n{m}+1{} 倍率' + curM(g.run.stats.tarotsUsed); },
    calc: function (j, c, g) { if (isMain(c) && g.run.stats.tarotsUsed > 0) return { mult: g.run.stats.tarotsUsed }; }
  });
  J('juggler', '杂耍者', 'Juggler', 1, 4, '🤹', 'e', { bp: false, passive: { handSize: 1 }, desc: '{o}+1{} 手牌上限' });
  J('drunkard', '醉汉', 'Drunkard', 1, 4, '🍺', 'e', { bp: false, passive: { discards: 1 }, desc: '每回合 {r}+1{} 次弃牌' });
  J('golden_joker', '黄金小丑', 'Golden Joker', 1, 6, '🌟', '$', {
    bp: false, desc: '回合结束时获得 {$}$4{}', dollars: function () { return 4; }
  });
  J('popcorn', '爆米花', 'Popcorn', 1, 5, '🍿', 'm', {
    eternal: false, ab: { mult: 20 },
    desc: function (j) { return '{m}+' + j.ab.mult + '{} 倍率\n每回合 {m}-4{} 倍率'; },
    calc: function (j, c, g) {
      if (isMain(c)) return { mult: j.ab.mult };
      if (c.type === 'end_of_round' && !c.bp) {
        if (j.ab.mult - 4 <= 0) { g.destroyJoker(j); return { msg: '吃完了！', color: 'mult' }; }
        j.ab.mult -= 4; return { msg: '-4 倍率', color: 'mult' };
      }
    }
  });
  J('walkie_talkie', '对讲机', 'Walkie Talkie', 1, 4, '📻', 'cm', {
    desc: '每张打出的 {o}10{} 或 {o}4{}\n在计分时给予 {c}+10{} 筹码和 {m}+4{} 倍率',
    calc: function (j, c, g) { var id = g.rid(c.card); if (c.type === 'play' && (id === 10 || id === 4)) return { chips: 10, mult: 4 }; }
  });
  J('smiley_face', '笑脸', 'Smiley Face', 1, 4, '😊', 'm', {
    desc: '打出的{o}人头牌{}\n在计分时给予 {m}+5{} 倍率',
    calc: function (j, c, g) { if (c.type === 'play' && g.isFace(c.card)) return { mult: 5 }; }
  });
  J('golden_ticket', '金色门票', 'Golden Ticket', 1, 5, '🎟️', '$', {
    gate: 'gold', desc: '打出的{o}黄金牌{}\n在计分时获得 {$}$4{}',
    calc: function (j, c) { if (c.type === 'play' && c.card.enh === 'gold') return { dollars: 4 }; }
  });
  J('swashbuckler', '侠盗', 'Swashbuckler', 1, 4, '⚔️', 'm', {
    desc: function (j, g) { return '将所有其他小丑牌的\n{o}出售价值{}加到倍率' + curM(g.otherSellValue(j)); },
    calc: function (j, c, g) { if (isMain(c)) { var v = g.otherSellValue(j); if (v > 0) return { mult: v }; } }
  });
  J('hanging_chad', '悬空选票', 'Hanging Chad', 1, 4, '🗳️', 'r', {
    desc: '第一张用于计分的牌\n额外重新触发 {o}2{} 次',
    calc: function (j, c) { if (c.type === 'rep_play' && c.card === c.scoring[0]) return { reps: 2 }; }
  });
  J('shoot_the_moon', '射月', 'Shoot the Moon', 1, 5, '🌙', 'm', {
    desc: '手牌中每有一张 {o}Q{}\n{m}+13{} 倍率',
    calc: function (j, c, g) { if (c.type === 'held' && g.rid(c.card) === 12 && !g.cardDebuffed(c.card)) return { hmult: 13 }; }
  });

  /* ---------------- 罕见（64） ---------------- */
  J('joker_stencil', '小丑模板', 'Joker Stencil', 2, 8, '🖼️', 'x', {
    desc: function (j, g) { return '每有一个空的小丑牌槽位\n{x}X1{} 倍率\n{i}（小丑模板本身也计入）{}' + curX(g.stencilX()); },
    calc: function (j, c, g) { if (isMain(c)) { var x = g.stencilX(); if (x > 1) return { xmult: x }; } }
  });
  J('four_fingers', '四指', 'Four Fingers', 2, 7, '🖐️', 'e', { bp: false, desc: '所有{o}同花{}和{o}顺子{}\n只需 {o}4{} 张牌即可组成' });
  J('mime', '哑剧演员', 'Mime', 2, 5, '🤐', 'r', {
    desc: '重新触发所有{o}留在手牌中{}的\n牌的能力',
    calc: function (j, c) { if (c.type === 'rep_held' && c.hasEffect) return { reps: 1 }; }
  });
  J('ceremonial_dagger', '仪式匕首', 'Ceremonial Dagger', 2, 6, '🗡️', 'm', {
    perish: false, ab: { mult: 0 },
    desc: function (j) { return '选择{o}盲注{}时，摧毁右侧的小丑牌\n并将其出售价值的{o}两倍{}\n永久加到这张牌的倍率' + curM(j.ab.mult); },
    calc: function (j, c, g) {
      if (c.type === 'setting_blind' && !c.bp && !j.slicing) {
        var i = g.run.jokers.indexOf(j), r = g.run.jokers[i + 1];
        if (r && !r.eternal && !r.slicing) {
          r.slicing = true; j.ab.mult += 2 * g.sellValue(r); g.destroyJoker(r);
          return { msg: '+' + j.ab.mult + ' 倍率', color: 'mult' };
        }
      }
      if (isMain(c) && j.ab.mult > 0) return { mult: j.ab.mult };
    }
  });
  J('marble_joker', '大理石小丑', 'Marble Joker', 2, 6, '🪨', 'e', {
    desc: '选择{o}盲注{}时\n向牌组添加一张{o}石头牌{}',
    calc: function (j, c, g) {
      if (c.type === 'setting_blind' && !j.slicing) {
        var card = g.newPlayingCard(g.rng.pick(BT.Data.SUITS), g.rng.pick(BT.Data.RANKS), { enh: 'stone' });
        g.addPlayingCards([card], 'draw'); return { msg: '+1 石头', color: 'chips' };
      }
    }
  });
  J('loyalty_card', '积分卡', 'Loyalty Card', 2, 5, '🎫', 'x', {
    /* 与原作一样按全局出牌计数取模，蓝图复制时不受左右顺序影响 */
    init: function (j, g) { j.ab.at = g.run.stats.handsPlayed; },
    desc: function (j, g) {
      var left = 5 - ((g.run.stats.handsPlayed - (j.ab.at || 0)) % 6);
      return '每打出 {o}6{} 手牌\n{x}X4{} 倍率\n{i}（' + (left === 0 ? '下一手生效！' : '还剩 ' + left + ' 手') + '）{}';
    },
    calc: function (j, c, g) { if (isMain(c) && (g.run.stats.handsPlayed - (j.ab.at || 0)) % 6 === 5) return { xmult: 4 }; }
  });
  J('dusk', '黄昏', 'Dusk', 2, 5, '🌆', 'r', {
    desc: '重新触发本回合{o}最后一手{}\n打出的所有牌',
    calc: function (j, c, g) { if (c.type === 'rep_play' && g.run.round.handsLeft === 0) return { reps: 1 }; }
  });
  J('fibonacci', '斐波那契', 'Fibonacci', 2, 8, '🐚', 'm', {
    desc: '每张打出的 {o}A{}、{o}2{}、{o}3{}、{o}5{} 或 {o}8{}\n在计分时给予 {m}+8{} 倍率',
    calc: function (j, c, g) { var id = g.rid(c.card); if (c.type === 'play' && (id === 14 || id === 2 || id === 3 || id === 5 || id === 8)) return { mult: 8 }; }
  });
  J('steel_joker', '钢铁小丑', 'Steel Joker', 2, 7, '⚙️', 'x', {
    gate: 'steel',
    desc: function (j, g) { return '完整牌组中每有一张{o}钢铁牌{}\n给予 {x}X0.2{} 倍率' + curX(1 + 0.2 * g.countDeck('steel')); },
    calc: function (j, c, g) { if (isMain(c)) { var x = 1 + 0.2 * g.countDeck('steel'); if (x > 1) return { xmult: x }; } }
  });
  J('hack', '骇客', 'Hack', 2, 6, '💻', 'r', {
    desc: '重新触发每张打出的\n{o}2{}、{o}3{}、{o}4{} 或 {o}5{}',
    calc: function (j, c, g) { var id = g.rid(c.card); if (c.type === 'rep_play' && id >= 2 && id <= 5) return { reps: 1 }; }
  });
  J('pareidolia', '幻视', 'Pareidolia', 2, 5, '👀', 'e', { bp: false, desc: '所有牌都视为{o}人头牌{}' });
  J('space_joker', '太空小丑', 'Space Joker', 2, 5, '👽', 'e', {
    desc: function (j, g) { return '有 ' + odds(g, 4) + ' 几率\n提升所打出{o}牌型{}的等级'; },
    calc: function (j, c, g) { if (c.type === 'before' && g.chance(4)) return { levelUp: true }; }
  });
  J('burglar', '窃贼', 'Burglar', 2, 6, '🦹', 'e', {
    desc: '选择{o}盲注{}时\n获得 {b}+3{} 次出牌并失去所有弃牌',
    calc: function (j, c, g) {
      if (c.type === 'setting_blind' && !j.slicing) { g.run.round.handsLeft += 3; g.run.round.discardsLeft = 0; return { msg: '+3 出牌', color: 'chips' }; }
    }
  });
  J('blackboard', '黑板', 'Blackboard', 2, 6, '🖤', 'x', {
    desc: '如果手牌中的牌全部是\n{S}黑桃{}或{C}梅花{}\n{x}X3{} 倍率',
    calc: function (j, c, g) {
      if (!isMain(c)) return;
      var ok = g.run.hand.every(function (h) { return g.isSuit(h, 'C', false, true) || g.isSuit(h, 'S', false, true); });
      if (ok) return { xmult: 3 };
    }
  });
  J('sixth_sense', '第六感', 'Sixth Sense', 2, 6, '🔮', 'e', {
    bp: false, desc: '如果本回合第一手牌只打出\n一张 {o}6{}，将其摧毁\n并生成一张{s}幻灵{}牌\n{i}（必须有空位）{}',
    calc: function (j, c, g) {
      if (c.type === 'destroying_card' && !c.bp && c.full.length === 1 && g.rid(c.full[0]) === 6 && g.run.round.handsPlayed === 0) {
        if (g.consRoom()) g.createConsumable('spectral', { src: j });
        return { destroy: true, msg: '+1 幻灵', color: 'spectral' };
      }
    }
  });
  J('constellation', '星座', 'Constellation', 2, 6, '✨', 'x', {
    perish: false, ab: { x: 1 },
    desc: function (j) { return '每使用一张{p}星球{}牌\n这张牌获得 {x}X0.1{} 倍率' + curX(j.ab.x); },
    calc: function (j, c) {
      if (c.type === 'using_consumable' && !c.bp && c.cons.kind === 'planet') { j.ab.x = Math.round((j.ab.x + 0.1) * 100) / 100; return { msg: 'X' + j.ab.x + ' 倍率', color: 'mult' }; }
      if (isMain(c) && j.ab.x > 1) return { xmult: j.ab.x };
    }
  });
  J('hiker', '徒步者', 'Hiker', 2, 5, '🥾', 'c', {
    desc: '每张打出的牌在计分时\n永久获得 {c}+5{} 筹码',
    calc: function (j, c) { if (c.type === 'play') { c.card.perma = (c.card.perma || 0) + 5; return { msg: '升级！', color: 'chips' }; } }
  });
  J('card_sharp', '卡牌高手', 'Card Sharp', 2, 6, '🎩', 'x', {
    desc: '如果所打出的牌型\n本回合已经打出过\n{x}X3{} 倍率',
    calc: function (j, c, g) { if (isMain(c) && g.run.hands[c.hand].playedRound > 1) return { xmult: 3 }; }
  });
  J('madness', '疯狂', 'Madness', 2, 7, '😵', 'x', {
    perish: false, ab: { x: 1 },
    desc: function (j) { return '选择{o}小盲注{}或{o}大盲注{}时\n获得 {x}X0.5{} 倍率\n并{o}摧毁{}一张随机小丑牌' + curX(j.ab.x); },
    calc: function (j, c, g) {
      if (c.type === 'setting_blind' && !c.bp && !c.boss && !j.slicing) {
        j.ab.x += 0.5;
        var pool = g.run.jokers.filter(function (o) { return o !== j && !o.eternal && !o.slicing; });
        if (pool.length) { var v = g.rng.pick(pool); v.slicing = true; g.destroyJoker(v); }
        return { msg: 'X' + j.ab.x + ' 倍率', color: 'mult' };
      }
      if (isMain(c) && j.ab.x > 1) return { xmult: j.ab.x };
    }
  });
  J('seance', '降神会', 'Séance', 2, 6, '🕯️', 'e', {
    desc: '如果打出的牌型是{o}同花顺{}\n生成一张随机{s}幻灵{}牌\n{i}（必须有空位）{}',
    calc: function (j, c, g) {
      if (isMain(c) && c.poker.straight_flush && g.consRoom()) { g.createConsumable('spectral', { src: j }); return { msg: '+1 幻灵', color: 'spectral' }; }
    }
  });
  J('vampire', '吸血鬼', 'Vampire', 2, 7, '🧛', 'x', {
    perish: false, ab: { x: 1 },
    desc: function (j) { return '每打出一张计分的{o}增强牌{}\n这张牌获得 {x}X0.1{} 倍率\n并移除该牌的增强' + curX(j.ab.x); },
    calc: function (j, c, g) {
      if (c.type === 'before' && !c.bp) {
        var n = 0;
        c.scoring.forEach(function (x) { if (x.enh && !g.cardDebuffed(x) && !x.vampired) { n++; x.vampired = true; x.enh = null; g.logEnhance(x); } });
        c.scoring.forEach(function (x) { delete x.vampired; });
        if (n) { j.ab.x = Math.round((j.ab.x + 0.1 * n) * 100) / 100; return { msg: 'X' + j.ab.x + ' 倍率', color: 'mult' }; }
      }
      if (isMain(c) && j.ab.x > 1) return { xmult: j.ab.x };
    }
  });
  J('shortcut', '捷径', 'Shortcut', 2, 7, '⤴️', 'e', { bp: false, desc: '允许组成{o}顺子{}时\n点数间隔 {o}1{}\n{i}（例：10 8 6 5 3）{}' });
  J('hologram', '全息影像', 'Hologram', 2, 7, '📽️', 'x', {
    perish: false, ab: { x: 1 },
    desc: function (j) { return '每有一张{o}扑克牌{}加入牌组\n这张牌获得 {x}X0.25{} 倍率' + curX(j.ab.x); },
    calc: function (j, c) {
      if (c.type === 'card_added' && !c.bp) { j.ab.x += 0.25 * c.count; return { msg: 'X' + j.ab.x + ' 倍率', color: 'mult' }; }
      if (isMain(c) && j.ab.x > 1) return { xmult: j.ab.x };
    }
  });
  J('cloud_9', '云九', 'Cloud 9', 2, 7, '☁️', '$', {
    bp: false,
    desc: function (j, g) { return '回合结束时，完整牌组中\n每有一张 {o}9{} 获得 {$}$1{}' + cur('{$}$' + g.countRank(9) + '{}'); },
    dollars: function (j, g) { return g.countRank(9); }
  });
  J('rocket', '火箭', 'Rocket', 2, 6, '🚀', '$', {
    bp: false, perish: false, ab: { dollars: 1 },
    desc: function (j) { return '回合结束时获得 {$}$' + j.ab.dollars + '{}\n每击败一个 Boss 盲注\n收益增加 {$}$2{}'; },
    dollars: function (j) { return j.ab.dollars; },
    calc: function (j, c, g) { if (c.type === 'end_of_round' && !c.bp && g.run.blind.type === 'boss') { j.ab.dollars += 2; return { msg: '升级！', color: 'money' }; } }
  });
  J('midas_mask', '迈达斯面具', 'Midas Mask', 2, 7, '🏅', 'e', {
    bp: false, desc: '打出的所有{o}人头牌{}\n在计分时变为{o}黄金牌{}',
    calc: function (j, c, g) {
      if (c.type === 'before' && !c.bp) {
        var n = 0;
        c.scoring.forEach(function (x) { if (g.isFace(x)) { x.enh = 'gold'; g.logEnhance(x); n++; } });
        if (n) return { msg: '黄金！', color: 'money' };
      }
    }
  });
  J('luchador', '摔跤手', 'Luchador', 2, 5, '🤼', 'e', {
    bp: false, eternal: false, desc: '出售这张牌以禁用\n当前的 {o}Boss 盲注{}',
    calc: function (j, c, g) {
      if (c.type === 'selling_self' && !c.bp && g.run.phase === 'round' && g.run.blind.type === 'boss' && !g.run.blind.disabled) { g.disableBlind(); return { msg: '禁用！', color: 'dim' }; }
    }
  });
  J('gift_card', '礼品卡', 'Gift Card', 2, 6, '🎁', '$', {
    bp: false, desc: '回合结束时，为每张小丑牌\n和消耗牌增加 {$}$1{} 出售价值',
    calc: function (j, c, g) {
      if (c.type === 'end_of_round' && !c.bp) {
        g.run.jokers.concat(g.run.cons).forEach(function (o) { o.extraValue = (o.extraValue || 0) + 1; });
        return { msg: '升值！', color: 'money' };
      }
    }
  });
  J('turtle_bean', '黑龟豆', 'Turtle Bean', 2, 6, '🐢', 'e', {
    bp: false, eternal: false, ab: { h: 5 },
    passive: { handSize: function (j) { return j.ab.h; } },
    desc: function (j) { return '{o}+' + j.ab.h + '{} 手牌上限\n每回合减少 {r}1{}'; },
    calc: function (j, c, g) {
      if (c.type === 'end_of_round' && !c.bp) {
        if (j.ab.h - 1 <= 0) { g.destroyJoker(j); return { msg: '吃完了！', color: 'dim' }; }
        j.ab.h -= 1; return { msg: '-1', color: 'dim' };
      }
    }
  });
  J('erosion', '侵蚀', 'Erosion', 2, 6, '🏜️', 'm', {
    desc: function (j, g) { return '完整牌组每比初始数量（' + g.run.startDeckSize + '）\n少一张牌，{m}+4{} 倍率' + curM(g.erosionMult()); },
    calc: function (j, c, g) { if (isMain(c) && g.erosionMult() > 0) return { mult: g.erosionMult() }; }
  });
  J('to_the_moon', '登月', 'To the Moon', 2, 5, '🌕', '$', {
    bp: false, passive: { interest: 1 }, desc: '回合结束时，每拥有 {$}$5{}\n额外获得 {$}$1{} {o}利息{}'
  });
  J('stone_joker', '石头小丑', 'Stone Joker', 2, 6, '🗿', 'c', {
    gate: 'stone',
    desc: function (j, g) { return '完整牌组中每有一张{o}石头牌{}\n给予 {c}+25{} 筹码' + curC(25 * g.countDeck('stone')); },
    calc: function (j, c, g) { if (isMain(c) && g.countDeck('stone') > 0) return { chips: 25 * g.countDeck('stone') }; }
  });
  J('lucky_cat', '招财猫', 'Lucky Cat', 2, 6, '🐱', 'x', {
    gate: 'lucky', perish: false, ab: { x: 1 },
    desc: function (j) { return '每有一张{o}幸运牌{}成功触发\n这张牌获得 {x}X0.25{} 倍率' + curX(j.ab.x); },
    calc: function (j, c) {
      if (c.type === 'play' && !c.bp && c.card.luckyHit) { j.ab.x += 0.25; return { msg: '升级！', color: 'mult' }; }
      if (isMain(c) && j.ab.x > 1) return { xmult: j.ab.x };
    }
  });
  J('bull', '公牛', 'Bull', 2, 6, '🐂', 'c', {
    desc: function (j, g) { return '每拥有 {$}$1{}\n{c}+2{} 筹码' + curC(2 * Math.max(0, g.run.money)); },
    calc: function (j, c, g) { if (isMain(c) && g.run.money > 0) return { chips: 2 * g.run.money }; }
  });
  J('diet_cola', '健怡可乐', 'Diet Cola', 2, 6, '🥤', 'e', {
    bp: false, eternal: false, desc: '出售这张牌以获得\n一个免费的{o}双倍标签{}',
    calc: function (j, c, g) { if (c.type === 'selling_self' && !c.bp) { g.addTag('double'); return { msg: '+双倍标签', color: 'dim' }; } }
  });
  J('trading_card', '交易卡', 'Trading Card', 2, 6, '🔄', '$', {
    bp: false, desc: '如果本回合第一次弃牌\n只弃掉 {o}1{} 张，将其摧毁\n并获得 {$}$3{}',
    calc: function (j, c, g) {
      if (c.type === 'discard' && !c.bp && !c.hook && g.run.round.discardsUsed <= 0 && c.full.length === 1) return { dollars: 3, remove: true };
    }
  });
  J('flash_card', '闪卡', 'Flash Card', 2, 5, '⚡', 'm', {
    perish: false, ab: { mult: 0 },
    desc: function (j) { return '商店中每重掷一次\n这张牌获得 {m}+2{} 倍率' + curM(j.ab.mult); },
    calc: function (j, c) {
      if (c.type === 'reroll_shop' && !c.bp) { j.ab.mult += 2; return { msg: '+2 倍率', color: 'mult' }; }
      if (isMain(c) && j.ab.mult > 0) return { mult: j.ab.mult };
    }
  });
  J('spare_trousers', '备用裤子', 'Spare Trousers', 2, 6, '👖', 'm', {
    perish: false, ab: { mult: 0 },
    desc: function (j) { return '如果打出的牌中包含{o}两对{}\n这张牌获得 {m}+2{} 倍率' + curM(j.ab.mult); },
    calc: function (j, c) {
      if (c.type === 'before' && !c.bp && c.poker.two_pair) { j.ab.mult += 2; return { msg: '升级！', color: 'mult' }; }
      if (isMain(c) && j.ab.mult > 0) return { mult: j.ab.mult };
    }
  });
  J('ramen', '拉面', 'Ramen', 2, 6, '🍜', 'x', {
    eternal: false, ab: { x: 2 },
    desc: function (j) { return '{x}X' + BT.Utils.fmtX(j.ab.x) + '{} 倍率\n每弃掉一张牌\n失去 {x}X0.01{} 倍率'; },
    calc: function (j, c, g) {
      if (isMain(c)) return { xmult: j.ab.x };
      if (c.type === 'discard' && !c.bp) {
        if (j.ab.x - 0.01 <= 1) { g.destroyJoker(j); return { msg: '吃完了！', color: 'mult' }; }
        j.ab.x = Math.round((j.ab.x - 0.01) * 100) / 100; return { msg: '-X0.01', color: 'mult', quiet: true };
      }
    }
  });
  J('seltzer', '苏打水', 'Seltzer', 2, 6, '🍾', 'r', {
    eternal: false, ab: { left: 10 },
    desc: function (j) { return '重新触发接下来 {o}' + j.ab.left + '{} 手\n打出的所有牌'; },
    calc: function (j, c, g) {
      if (c.type === 'rep_play') return { reps: 1 };
      if (c.type === 'after' && !c.bp) {
        if (j.ab.left - 1 <= 0) { g.destroyJoker(j); return { msg: '喝完了！', color: 'dim' }; }
        j.ab.left -= 1; return { msg: String(j.ab.left), color: 'dim' };
      }
    }
  });
  J('castle', '城堡', 'Castle', 2, 6, '🏰', 'c', {
    perish: false, ab: { chips: 0 },
    desc: function (j, g) { return '每弃掉一张' + suitTxt(g.run.current.castleSuit) + '牌\n这张牌获得 {c}+3{} 筹码\n{i}（花色每回合改变）{}' + curC(j.ab.chips); },
    calc: function (j, c, g) {
      if (c.type === 'discard' && !c.bp && !g.cardDebuffed(c.card) && g.isSuit(c.card, g.run.current.castleSuit)) { j.ab.chips += 3; return { msg: '升级！', color: 'chips' }; }
      if (isMain(c) && j.ab.chips > 0) return { chips: j.ab.chips };
    }
  });
  J('mr_bones', '骷髅先生', 'Mr. Bones', 2, 5, '💀', 'e', {
    bp: false, eternal: false, desc: '如果得分至少达到所需分数的 {o}25%{}\n则免于死亡\n{r}自我摧毁{}',
    calc: function (j, c, g) {
      if (c.type === 'end_of_round' && !c.bp && c.gameOver && g.run.round.chips / g.run.blind.chips >= 0.25) {
        g.destroyJoker(j); return { saved: true, msg: '得救了！', color: 'mult' };
      }
    }
  });
  J('acrobat', '杂技演员', 'Acrobat', 2, 6, '🤸', 'x', {
    desc: '本回合{o}最后一手{}出牌时\n{x}X3{} 倍率',
    calc: function (j, c, g) { if (isMain(c) && g.run.round.handsLeft === 0) return { xmult: 3 }; }
  });
  J('sock_and_buskin', '喜剧与悲剧', 'Sock and Buskin', 2, 6, '🎭', 'r', {
    desc: '重新触发所有打出的{o}人头牌{}',
    calc: function (j, c, g) { if (c.type === 'rep_play' && g.isFace(c.card)) return { reps: 1 }; }
  });
  J('troubadour', '吟游诗人', 'Troubadour', 2, 6, '🎻', 'e', {
    bp: false, passive: { handSize: 2, hands: -1 }, desc: '{o}+2{} 手牌上限\n每回合 {b}-1{} 次出牌'
  });
  J('certificate', '证书', 'Certificate', 2, 6, '📜', 'e', {
    desc: '回合开始时，向手牌添加一张\n带随机{o}蜡封{}的随机扑克牌',
    calc: function (j, c, g) {
      if (c.type === 'first_hand_drawn') {
        var seals = ['red', 'blue', 'gold', 'purple'];
        var card = g.newPlayingCard(g.rng.pick(BT.Data.SUITS), g.rng.pick(BT.Data.RANKS), { seal: g.rng.pick(seals) });
        g.addPlayingCards([card], 'hand'); return { msg: '+1 牌', color: 'chips' };
      }
    }
  });
  J('smeared_joker', '涂抹小丑', 'Smeared Joker', 2, 7, '🖌️', 'e', { bp: false, desc: '{H}红桃{}与{D}方片{}视为同一花色\n{S}黑桃{}与{C}梅花{}视为同一花色' });
  J('throwback', '回溯', 'Throwback', 2, 6, '📼', 'x', {
    desc: function (j, g) { return '本局每跳过一个{o}盲注{}\n{x}X0.25{} 倍率' + curX(1 + 0.25 * g.run.stats.skips); },
    calc: function (j, c, g) { if (isMain(c) && g.run.stats.skips > 0) return { xmult: 1 + 0.25 * g.run.stats.skips }; }
  });
  J('rough_gem', '原石', 'Rough Gem', 2, 7, '💎', '$', {
    desc: '打出的' + suitTxt('D') + '牌\n在计分时获得 {$}$1{}',
    calc: function (j, c, g) { if (c.type === 'play' && g.isSuit(c.card, 'D')) return { dollars: 1 }; }
  });
  J('bloodstone', '鸡血石', 'Bloodstone', 2, 7, '🩸', 'x', {
    desc: function (j, g) { return '打出的' + suitTxt('H') + '牌在计分时\n有 ' + odds(g, 2) + ' 几率给予 {x}X1.5{} 倍率'; },
    calc: function (j, c, g) { if (c.type === 'play' && g.isSuit(c.card, 'H') && g.chance(2)) return { xmult: 1.5 }; }
  });
  J('arrowhead', '箭头', 'Arrowhead', 2, 7, '🏹', 'c', {
    desc: '打出的' + suitTxt('S') + '牌\n在计分时给予 {c}+50{} 筹码',
    calc: function (j, c, g) { if (c.type === 'play' && g.isSuit(c.card, 'S')) return { chips: 50 }; }
  });
  J('onyx_agate', '缟玛瑙', 'Onyx Agate', 2, 7, '🔘', 'm', {
    desc: '打出的' + suitTxt('C') + '牌\n在计分时给予 {m}+7{} 倍率',
    calc: function (j, c, g) { if (c.type === 'play' && g.isSuit(c.card, 'C')) return { mult: 7 }; }
  });
  J('glass_joker', '玻璃小丑', 'Glass Joker', 2, 6, '🥂', 'x', {
    gate: 'glass', perish: false, ab: { x: 1 },
    desc: function (j) { return '每摧毁一张{o}玻璃牌{}\n这张牌获得 {x}X0.75{} 倍率' + curX(j.ab.x); },
    calc: function (j, c) {
      if (c.type === 'removed' && !c.bp) {
        var n = c.removed.filter(function (x) { return x.shattered; }).length;
        if (n) { j.ab.x += 0.75 * n; return { msg: 'X' + j.ab.x + ' 倍率', color: 'mult' }; }
      }
      if (isMain(c) && j.ab.x > 1) return { xmult: j.ab.x };
    }
  });
  J('showman', '马戏团长', 'Showman', 2, 5, '🎪', 'e', { bp: false, desc: '{o}小丑{}、{t}塔罗{}、{p}星球{}和{s}幻灵{}牌\n可能重复出现' });
  J('flower_pot', '花盆', 'Flower Pot', 2, 6, '🪴', 'x', {
    desc: '如果打出的牌型中包含\n{D}方片{}、{C}梅花{}、{H}红桃{}和{S}黑桃{}牌\n{x}X3{} 倍率',
    calc: function (j, c, g) {
      if (!isMain(c)) return;
      var s = { H: 0, D: 0, S: 0, C: 0 }, order = ['H', 'D', 'S', 'C'];
      c.scoring.forEach(function (x) {
        if (x.enh === 'wild') return;
        for (var i = 0; i < 4; i++) if (g.isSuit(x, order[i], true) && s[order[i]] === 0) { s[order[i]]++; break; }
      });
      c.scoring.forEach(function (x) {
        if (x.enh !== 'wild') return;
        for (var i = 0; i < 4; i++) if (g.isSuit(x, order[i]) && s[order[i]] === 0) { s[order[i]]++; break; }
      });
      if (s.H && s.D && s.S && s.C) return { xmult: 3 };
    }
  });
  J('merry_andy', '欢乐安迪', 'Merry Andy', 2, 7, '🥳', 'e', {
    bp: false, passive: { discards: 3, handSize: -1 }, desc: '每回合 {r}+3{} 次弃牌\n{r}-1{} 手牌上限'
  });
  J('oops_all_6s', '哎呀！全是 6', 'Oops! All 6s', 2, 4, '🎲', 'e', { bp: false, desc: '所有列出的{g}概率{}翻倍\n{i}（例：1/3 → 2/3）{}' });
  J('the_idol', '偶像', 'The Idol', 2, 6, '🗽', 'x', {
    desc: function (j, g) { var i = g.run.current.idol; return '每张打出的' + suitTxt(i.suit).replace(/\{\}$/, '') + ' ' + BT.Data.RANK_LABEL[i.rank] + '{}\n在计分时给予 {x}X2{} 倍率\n{i}（牌每回合改变）{}'; },
    calc: function (j, c, g) { var i = g.run.current.idol; if (c.type === 'play' && g.rid(c.card) === i.rank && g.isSuit(c.card, i.suit)) return { xmult: 2 }; }
  });
  J('seeing_double', '重影', 'Seeing Double', 2, 6, '👯', 'x', {
    desc: '如果打出的牌型中有计分的\n{C}梅花{}牌和其他任意花色的计分牌\n{x}X2{} 倍率',
    calc: function (j, c, g) {
      if (!isMain(c)) return;
      var s = { H: 0, D: 0, S: 0, C: 0 };
      c.scoring.forEach(function (x) {
        if (x.enh === 'wild') return;
        if (g.isSuit(x, 'H')) s.H++; if (g.isSuit(x, 'D')) s.D++; if (g.isSuit(x, 'S')) s.S++; if (g.isSuit(x, 'C')) s.C++;
      });
      c.scoring.forEach(function (x) {
        if (x.enh !== 'wild') return;
        if (g.isSuit(x, 'C') && s.C === 0) s.C++;
        else if (g.isSuit(x, 'D') && s.D === 0) s.D++;
        else if (g.isSuit(x, 'S') && s.S === 0) s.S++;
        else if (g.isSuit(x, 'H') && s.H === 0) s.H++;
      });
      if (s.C > 0 && (s.H > 0 || s.D > 0 || s.S > 0)) return { xmult: 2 };
    }
  });
  J('matador', '斗牛士', 'Matador', 2, 7, '🎯', '$', {
    desc: '如果打出的牌触发了\n{o}Boss 盲注{}的能力\n获得 {$}$8{}',
    calc: function (j, c, g) { if ((c.type === 'debuffed_hand' || isMain(c)) && g.run.blind.triggered) return { dollars: 8 }; }
  });
  J('satellite', '卫星', 'Satellite', 2, 6, '🛰️', '$', {
    bp: false,
    desc: function (j, g) { return '回合结束时，本局每使用过\n一种{p}星球{}牌，获得 {$}$1{}' + cur('{$}$' + g.uniquePlanets() + '{}'); },
    dollars: function (j, g) { return g.uniquePlanets(); }
  });
  J('cartomancer', '卡牌术士', 'Cartomancer', 2, 6, '🎴', 'e', {
    desc: '选择{o}盲注{}时\n生成一张{t}塔罗{}牌\n{i}（必须有空位）{}',
    calc: function (j, c, g) { if (c.type === 'setting_blind' && !j.slicing && g.consRoom()) { g.createConsumable('tarot', { src: j }); return { msg: '+1 塔罗', color: 'tarot' }; } }
  });
  J('astronomer', '天文学家', 'Astronomer', 2, 8, '🔭', 'e', { bp: false, desc: '商店中所有{p}星球{}牌和\n{p}天体包{}均{o}免费{}' });
  J('bootstraps', '靴襻', 'Bootstraps', 2, 7, '👢', 'm', {
    desc: function (j, g) { return '每拥有 {$}$5{}\n{m}+2{} 倍率' + curM(2 * Math.floor(Math.max(0, g.run.money) / 5)); },
    calc: function (j, c, g) { var v = 2 * Math.floor(Math.max(0, g.run.money) / 5); if (isMain(c) && v > 0) return { mult: v }; }
  });

  /* ---------------- 稀有（20） ---------------- */
  J('dna', 'DNA', 'DNA', 3, 8, '🧬', 'e', {
    desc: '如果本回合第一手牌只有 {o}1{} 张\n将其永久复制一张加入牌组\n并抽到手牌中',
    calc: function (j, c, g) {
      if (c.type === 'before' && g.run.round.handsPlayed === 0 && c.full.length === 1) {
        var copy = g.copyPlayingCard(c.full[0]); g.addPlayingCards([copy], 'hand'); return { msg: '已复制！', color: 'chips' };
      }
    }
  });
  J('vagabond', '流浪者', 'Vagabond', 3, 8, '🎒', 'e', {
    desc: '如果出牌时资金不超过 {$}$4{}\n生成一张{t}塔罗{}牌\n{i}（必须有空位）{}',
    calc: function (j, c, g) { if (isMain(c) && g.run.money <= 4 && g.consRoom()) { g.createConsumable('tarot', { src: j }); return { msg: '+1 塔罗', color: 'tarot' }; } }
  });
  J('baron', '男爵', 'Baron', 3, 8, '👑', 'x', {
    desc: '手牌中每有一张 {o}K{}\n{x}X1.5{} 倍率',
    calc: function (j, c, g) { if (c.type === 'held' && g.rid(c.card) === 13 && !g.cardDebuffed(c.card)) return { xmult: 1.5 }; }
  });
  J('obelisk', '方尖碑', 'Obelisk', 3, 8, '🗼', 'x', {
    perish: false, ab: { x: 1 },
    desc: function (j) { return '连续打出不是你{o}最常打出{}的牌型时\n每手这张牌获得 {x}X0.2{} 倍率' + curX(j.ab.x); },
    calc: function (j, c, g) {
      if (c.type === 'before' && !c.bp) {
        var reset = true, n = g.run.hands[c.hand].played;
        BT.Data.HANDS.forEach(function (h) { var s = g.run.hands[h.key]; if (h.key !== c.hand && s.played >= n && s.visible) reset = false; });
        if (reset) { if (j.ab.x > 1) { j.ab.x = 1; return { msg: '重置', color: 'dim' }; } }
        else j.ab.x = Math.round((j.ab.x + 0.2) * 100) / 100;
      }
      if (isMain(c) && j.ab.x > 1) return { xmult: j.ab.x };
    }
  });
  J('baseball_card', '棒球卡', 'Baseball Card', 3, 8, '⚾', 'x', {
    desc: '每张{g}罕见{}小丑牌\n给予 {x}X1.5{} 倍率',
    calc: function (j, c) { if (c.type === 'other_joker' && c.other !== j && BY[c.other.key].rarity === 2) return { xmult: 1.5 }; }
  });
  J('ancient_joker', '远古小丑', 'Ancient Joker', 3, 8, '🏺', 'x', {
    desc: function (j, g) { return '每张打出的' + suitTxt(g.run.current.ancientSuit) + '牌\n在计分时给予 {x}X1.5{} 倍率\n{i}（花色每回合改变）{}'; },
    calc: function (j, c, g) { if (c.type === 'play' && g.isSuit(c.card, g.run.current.ancientSuit)) return { xmult: 1.5 }; }
  });
  J('campfire', '篝火', 'Campfire', 3, 9, '🏕️', 'x', {
    perish: false, ab: { x: 1 },
    desc: function (j) { return '每出售一张牌\n这张牌获得 {x}X0.25{} 倍率\n{i}（击败 Boss 盲注时重置）{}' + curX(j.ab.x); },
    calc: function (j, c, g) {
      if (c.type === 'selling_card' && !c.bp) { j.ab.x += 0.25; return { msg: '升级！', color: 'mult' }; }
      if (c.type === 'end_of_round' && !c.bp && g.run.blind.type === 'boss' && j.ab.x > 1) { j.ab.x = 1; return { msg: '重置', color: 'dim' }; }
      if (isMain(c) && j.ab.x > 1) return { xmult: j.ab.x };
    }
  });
  J('blueprint', '蓝图', 'Blueprint', 3, 10, '📘', 'e', {
    desc: function (j, g) { var t = g.run.jokers[g.run.jokers.indexOf(j) + 1]; return '复制{o}右侧{}小丑牌的能力' + (t ? '\n' + (BY[t.key].bp ? '{c}兼容{}' : '{r}不兼容{}') : ''); },
    calc: function (j, c, g) { return copyJoker(j, g.run.jokers[g.run.jokers.indexOf(j) + 1], c, g); }
  });
  J('wee_joker', '小小丑', 'Wee Joker', 3, 8, '🐭', 'c', {
    perish: false, ab: { chips: 0 },
    desc: function (j) { return '每张打出的 {o}2{} 计分时\n这张牌获得 {c}+8{} 筹码' + curC(j.ab.chips); },
    calc: function (j, c, g) {
      if (c.type === 'play' && !c.bp && g.rid(c.card) === 2) { j.ab.chips += 8; return { msg: '升级！', color: 'chips' }; }
      if (isMain(c) && j.ab.chips > 0) return { chips: j.ab.chips };
    }
  });
  J('hit_the_road', '上路吧', 'Hit the Road', 3, 8, '🛣️', 'x', {
    perish: false, ab: { x: 1 },
    desc: function (j) { return '本回合每弃掉一张 {o}J{}\n这张牌获得 {x}X0.5{} 倍率' + curX(j.ab.x); },
    calc: function (j, c, g) {
      if (c.type === 'discard' && !c.bp && !g.cardDebuffed(c.card) && g.rid(c.card) === 11) { j.ab.x += 0.5; return { msg: 'X' + j.ab.x + ' 倍率', color: 'mult' }; }
      if (c.type === 'end_of_round' && !c.bp && j.ab.x > 1) { j.ab.x = 1; return { msg: '重置', color: 'dim' }; }
      if (isMain(c) && j.ab.x > 1) return { xmult: j.ab.x };
    }
  });
  function xHand(key, zh, en, icon, hand, x) {
    J(key, zh, en, 3, 8, icon, 'x', {
      desc: '如果打出的牌中包含{o}' + HAND_ZH(hand) + '{}\n{x}X' + x + '{} 倍率',
      calc: function (j, c) { if (isMain(c) && c.poker[hand]) return { xmult: x }; }
    });
  }
  xHand('the_duo', '二重奏', 'The Duo', '👫', 'pair', 2);
  xHand('the_trio', '三重奏', 'The Trio', '🔺', 'three', 3);
  xHand('the_family', '一家人', 'The Family', '🏠', 'four', 4);
  xHand('the_order', '秩序', 'The Order', '📶', 'straight', 3);
  xHand('the_tribe', '部落', 'The Tribe', '🗻', 'flush', 2);
  J('stuntman', '特技演员', 'Stuntman', 3, 7, '🏍️', 'c', {
    passive: { handSize: -2 }, desc: '{c}+250{} 筹码\n{r}-2{} 手牌上限',
    calc: function (j, c) { if (isMain(c)) return { chips: 250 }; }
  });
  J('invisible_joker', '隐形小丑', 'Invisible Joker', 3, 8, '🫥', 'e', {
    bp: false, eternal: false, ab: { rounds: 0 },
    desc: function (j) { return '经过 {o}2{} 回合后，出售这张牌\n可{o}复制{}一张随机小丑牌\n{i}（当前 ' + Math.min(j.ab.rounds, 2) + '/2）（复制品移除负片）{}'; },
    calc: function (j, c, g) {
      if (c.type === 'end_of_round' && !c.bp) { j.ab.rounds += 1; if (j.ab.rounds === 2) return { msg: '激活！', color: 'dim' }; }
      if (c.type === 'selling_self' && !c.bp && j.ab.rounds >= 2) {
        var pool = g.run.jokers.filter(function (o) { return o !== j; });
        if (pool.length && g.run.jokers.length <= g.jokerSlots()) {
          var copy = g.copyJoker(g.rng.pick(pool), true); if (copy.ab.rounds !== undefined && copy.key === 'invisible_joker') copy.ab.rounds = 0;
          return { msg: '已复制！', color: 'dim' };
        }
      }
    }
  });
  J('brainstorm', '头脑风暴', 'Brainstorm', 3, 10, '🧠', 'e', {
    desc: function (j, g) { var t = g.run.jokers[0]; return '复制{o}最左侧{}小丑牌的能力' + (t && t !== j ? '\n' + (BY[t.key].bp ? '{c}兼容{}' : '{r}不兼容{}') : ''); },
    calc: function (j, c, g) { return copyJoker(j, g.run.jokers[0], c, g); }
  });
  J('drivers_license', '驾照', "Driver's License", 3, 7, '🚗', 'x', {
    desc: function (j, g) { return '如果完整牌组中至少有\n{o}16{} 张增强牌\n{x}X3{} 倍率' + cur(g.countEnhanced() + ' 张'); },
    calc: function (j, c, g) { if (isMain(c) && g.countEnhanced() >= 16) return { xmult: 3 }; }
  });
  J('burnt_joker', '烧焦小丑', 'Burnt Joker', 3, 8, '🔥', 'e', {
    desc: '提升每回合{o}第一次{}弃掉的\n牌型的等级',
    calc: function (j, c, g) {
      if (c.type === 'pre_discard' && !c.hook && g.run.round.discardsUsed <= 0) {
        var info = BT.Poker.info(c.full, g); return { levelUp: info.hand };
      }
    }
  });

  /* ---------------- 传奇（5） ---------------- */
  J('canio', '卡尼奥', 'Canio', 4, 20, '🔱', 'x', {
    perish: false, ab: { x: 1 },
    desc: function (j) { return '每摧毁一张{o}人头牌{}\n这张牌获得 {x}X1{} 倍率' + curX(j.ab.x); },
    calc: function (j, c, g) {
      if (c.type === 'removed' && !c.bp) {
        var n = c.removed.filter(function (x) { return g.isFace(x); }).length;
        if (n) { j.ab.x += n; return { msg: 'X' + j.ab.x + ' 倍率', color: 'mult' }; }
      }
      if (isMain(c) && j.ab.x > 1) return { xmult: j.ab.x };
    }
  });
  J('triboulet', '特里布莱', 'Triboulet', 4, 20, '🤴', 'x', {
    desc: '打出的 {o}K{} 和 {o}Q{}\n在计分时各给予 {x}X2{} 倍率',
    calc: function (j, c, g) { var id = g.rid(c.card); if (c.type === 'play' && (id === 12 || id === 13)) return { xmult: 2 }; }
  });
  J('yorick', '约里克', 'Yorick', 4, 20, '☠️', 'x', {
    perish: false, ab: { x: 1, left: 23 },
    desc: function (j) { return '每弃掉 {o}23{} 张牌\n这张牌获得 {x}X1{} 倍率\n{i}（还剩 ' + j.ab.left + ' 张）{}' + curX(j.ab.x); },
    calc: function (j, c) {
      if (c.type === 'discard' && !c.bp) {
        if (j.ab.left <= 1) { j.ab.left = 23; j.ab.x += 1; return { msg: 'X' + j.ab.x + ' 倍率', color: 'mult' }; }
        j.ab.left -= 1;
      }
      if (isMain(c) && j.ab.x > 1) return { xmult: j.ab.x };
    }
  });
  J('chicot', '希科', 'Chicot', 4, 20, '🃏', 'e', {
    bp: false, desc: '禁用所有 {o}Boss 盲注{}的效果',
    onAdd: function (j, g) { if (g.run.phase === 'round' && g.run.blind.type === 'boss' && !g.run.blind.disabled) g.disableBlind(); },
    calc: function (j, c, g) { if (c.type === 'setting_blind' && !c.bp && c.boss && !g.run.blind.disabled) { g.disableBlind(); return { msg: '禁用！', color: 'dim' }; } }
  });
  J('perkeo', '佩奇奥', 'Perkeo', 4, 20, '🧙', 'e', {
    desc: '离开{o}商店{}时，为随机一张\n消耗牌生成{e}负片{}复制品',
    calc: function (j, c, g) {
      if (c.type === 'ending_shop' && g.run.cons.length) {
        var src = g.rng.pick(g.run.cons); g.createConsumable(src.kind, { key: src.key, edition: 'negative', src: j, force: true });
        return { msg: '已复制！', color: 'dim' };
      }
    }
  });

  /* 蓝图 / 头脑风暴：把上下文转发给目标，效果记在复制者名下 */
  function copyJoker(self, target, c, g) {
    if (!target || target === self) return;
    var depth = (c.bp || 0) + 1;
    if (depth > g.run.jokers.length + 1) return;
    var def = BY[target.key];
    if (!def.bp || !def.calc || g.jokerDebuffed(target)) return;
    var sub = {}; for (var k in c) sub[k] = c[k];
    sub.bp = depth; sub.bpCard = c.bpCard || self;
    var r = def.calc(target, sub, g);
    if (r) r.src = sub.bpCard;
    return r;
  }

  BT.Jokers = { LIST: LIST, BY: BY };
})(window.BT);
