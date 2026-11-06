/* 核心机制回归：使用可手算的计分预期值，不以引擎自身输出作为断言来源。 */
'use strict';
var assert = require('node:assert/strict'), H = require('./harness');
var BT = H.BT, D = BT.Data, game = H.game, card = H.card, round = H.round, joker = H.joker, score = H.score;
var count = 0, failed = 0;
function test(name, fn) { try { fn(); count++; } catch (e) { failed++; console.error('失败：' + name + '\n' + e.stack); } }
function eq(a, b) { assert.equal(a, b); }
function info(g, ranks, suits) { return BT.Poker.info(ranks.map(function (r, i) { return card(g, r, suits && suits[i] || D.SUITS[i % 4]); }), g); }

test('数据完整性与稀有度分布', function () {
  eq(BT.Jokers.LIST.length, 150); eq(new Set(BT.Jokers.LIST.map(function (j) { return j.key; })).size, 150);
  [61, 64, 20, 5].forEach(function (n, i) { eq(BT.Jokers.LIST.filter(function (j) { return j.rarity === i + 1; }).length, n); });
  eq(D.TAROTS.length, 22); eq(D.SPECTRALS.length, 18); eq(D.PLANETS.length, 12); eq(D.VOUCHERS.length, 32); eq(D.TAGS.length, 24); eq(D.BOSSES.length, 28); eq(D.DECKS.length, 15); eq(D.STAKES.length, 8);
});
test('底注分表与无尽公式', function () { eq(D.blindAmount(1), 300); eq(D.blindAmount(8), 50000); eq(D.blindAmount(9), 110000); eq(D.blindAmount(10), 560000); eq(D.blindAmount(8, 3), 200000); });
[
  ['high', [2, 4, 7, 9, 13]], ['pair', [2, 2, 7, 9, 13]], ['two_pair', [2, 2, 7, 7, 13]],
  ['three', [2, 2, 2, 9, 13]], ['straight', [14, 2, 3, 4, 5]], ['full_house', [2, 2, 2, 9, 9]],
  ['four', [2, 2, 2, 2, 13]], ['five', [2, 2, 2, 2, 2]]
].forEach(function (row) { test('牌型：' + row[0], function () { eq(info(game(), row[1]).hand, row[0]); }); });
test('秘密同花牌型', function () { var g = game(); eq(info(g, [2, 2, 2, 2, 2], ['S', 'S', 'S', 'S', 'S']).hand, 'flush_five'); eq(info(g, [2, 2, 2, 9, 9], ['H', 'H', 'H', 'H', 'H']).hand, 'flush_house'); });
test('皇家同花顺与不允许 A 回绕', function () { var g = game(); eq(info(g, [10, 11, 12, 13, 14], ['S', 'S', 'S', 'S', 'S']).royal, true); eq(info(g, [12, 13, 14, 2, 3]).poker.straight, false); });
test('四条含三条与对子但不含两对', function () { var p = info(game(), [7, 7, 7, 7, 2]).poker; eq(p.three, true); eq(p.pair, true); eq(p.two_pair, false); });
test('葫芦含两对', function () { eq(info(game(), [7, 7, 7, 2, 2]).poker.two_pair, true); });
test('四指同花顺可以来自不同的四张子集', function () { var g = game(); joker(g, 'four_fingers'); eq(info(g, [2, 3, 4, 5, 9], ['S', 'S', 'S', 'H', 'S']).hand, 'straight_flush'); });
test('捷径：间隔一张与不能间隔两张', function () { var g = game(); joker(g, 'shortcut'); eq(info(g, [3, 5, 6, 8, 10]).hand, 'straight'); eq(info(g, [2, 5, 7, 9, 11]).poker.straight, false); });
test('万能牌与石头牌的判定', function () { var g = game(), cs = [2, 4, 6, 8].map(function (r) { return card(g, r, 'H'); }); cs.push(card(g, 10, 'S', { enh: 'wild' })); eq(BT.Poker.info(cs, g).hand, 'flush'); cs[4].debuff = true; eq(BT.Poker.info(cs, g).poker.flush, false); eq(BT.Poker.info([card(g, 14, 'S', { enh: 'stone' }), card(g, 2)], g).scoring[0].rank, 2); });
test('对子 K + 基础小丑 = 180', function () { var g = round(game()); joker(g, 'joker'); eq(score(g, [card(g, 13), card(g, 13, 'H')]), 180); });
test('高牌只计最高牌；石头总计分', function () { var g = round(game()); eq(score(g, [card(g, 2), card(g, 13)]), 15); eq(score(g, [card(g, 2), card(g, 13, 'H', { enh: 'stone' })]), 57); });
test('奖励/倍率/玻璃效果顺序', function () { var g = round(game()); eq(score(g, [card(g, 2, 'S', { enh: 'mult' }), card(g, 2, 'H', { enh: 'glass' })]), (10 + 2 + 2) * (2 + 4) * 2); });
test('增强先于版本：玻璃 + 镭射', function () { var g = round(game()); eq(score(g, [card(g, 2, 'S', { enh: 'glass', edition: 'holo' })]), 7 * (1 * 2 + 10)); });
test('小丑左右顺序影响 X 倍率', function () { var a = round(game()), b = round(game()); joker(a, 'joker'); joker(a, 'cavendish'); joker(b, 'cavendish'); joker(b, 'joker'); eq(score(a, [card(a, 2)]), 105); eq(score(b, [card(b, 2)]), 49); });
test('小丑版本：镭射在主效果之前，多彩在之后', function () { var g = round(game()); joker(g, 'cavendish', { edition: 'holo' }); eq(score(g, [card(g, 2)]), 231); });
test('红蜡封与悬空选票累加触发', function () { var g = round(game()); joker(g, 'hanging_chad'); eq(score(g, [card(g, 2, 'S', { seal: 'red' })]), 13); });
test('徒步者在本次基础筹码之后永久成长', function () { var g = round(game()), c = card(g, 2, 'S', { seal: 'red' }); joker(g, 'hiker'); eq(score(g, [c]), 14); eq(c.perma, 10); });
test('钢铁 + 男爵 + 哑剧 + 红封全部重新触发', function () { var g = round(game()); joker(g, 'baron'); joker(g, 'mime'); eq(score(g, [card(g, 2)], [card(g, 13, 'H', { enh: 'steel', seal: 'red' })]), Math.floor(7 * Math.pow(1.5, 6))); });
test('无能力手牌不触发哑剧或红封', function () { var g = round(game()); joker(g, 'mime'); score(g, [card(g, 2)], [card(g, 9, 'H', { seal: 'red' })]); eq(g.events.filter(function (e) { return e.type === 'retrigger'; }).length, 0); });
test('削弱牌不计分、不触发蜡封与小丑', function () { var g = round(game(), 'club'); joker(g, 'arrowhead'); eq(score(g, [card(g, 2, 'C', { seal: 'red', edition: 'foil' })]), 5); });
test('花色 Boss 也削弱万能牌', function () { var g = round(game(), 'club'); eq(g.cardDebuffed(card(g, 2, 'H', { enh: 'wild' })), true); });
test('灵媒禁用四张，但五张正常；斗牛士禁手奖励', function () { var g = round(game(), 'psychic'); joker(g, 'matador'); var before = g.run.money; eq(score(g, [card(g, 2)]), 0); eq(g.run.money, before + 8); assert.ok(score(g, [2, 3, 4, 5, 6].map(function (r, i) { return card(g, r, D.SUITS[i % 4]); })) > 0); });
test('燧石基础值四舍五入', function () { var g = round(game(), 'flint'); eq(score(g, [card(g, 2)]), 5); });
test('手臂只降到一级', function () { var g = round(game(), 'arm'); g.levelHand('high', 2); score(g, [card(g, 2)]); eq(g.run.hands.high.level, 2); score(g, [card(g, 2)]); eq(g.run.hands.high.level, 1); score(g, [card(g, 2)]); eq(g.run.hands.high.level, 1); });
test('眼睛与嘴的牌型限制', function () { var g = round(game(), 'eye'); eq(score(g, [card(g, 2)]), 7); eq(score(g, [card(g, 2)]), 0); g = round(game(), 'mouth'); eq(score(g, [card(g, 2)]), 7); eq(score(g, [card(g, 2), card(g, 2, 'H')]), 0); });
test('蓝图复制能力且不复制状态成长', function () { var g = round(game()); joker(g, 'blueprint'); var j = joker(g, 'green_joker'); eq(score(g, [card(g, 2)]), 21); eq(j.ab.mult, 1); j.debuff = true; eq(score(g, [card(g, 2)]), 7); });
test('积分卡第六手触发，蓝图顺序无关', function () { var g = round(game()); joker(g, 'blueprint'); joker(g, 'loyalty_card'); for (var i = 0; i < 6; i++) { eq(score(g, [card(g, 2)]), i === 5 ? 112 : 7); g.run.stats.handsPlayed++; } });
test('DNA 与第六感只在第一手', function () { var g = round(game()); joker(g, 'dna'); var n = g.run.deck.length; score(g, [card(g, 2)]); eq(g.run.hand.length, 1); eq(g.run.deck.length, n + 2); g = round(game()); joker(g, 'sixth_sense'); var c = card(g, 6); score(g, [c]); eq(g.run.cons[0].kind, 'spectral'); eq(g.run.deck.indexOf(c), -1); });
test('等离子牌组取整平衡', function () { var g = round(game('plasma')); eq(g.blindTarget('small'), 600); eq(score(g, [card(g, 2)]), 16); });
test('牌组开局与赌注叠加', function () { eq(game('abandoned').run.deck.length, 40); eq(game('checkered').countRank(2), 4); eq(game('yellow').run.money, 14); eq(game('magic').run.cons.length, 2); eq(game('magic').consSlots(), 3); eq(game('nebula').consSlots(), 1); eq(game('black').run.base.hands, 3); eq(game('red', 8).run.base.discards, 3); });
test('价格、版本加价、折扣与出售价值', function () { var g = game(), j = joker(g, 'joker', { edition: 'poly' }); eq(g.cost(j), 7); eq(g.sellValue(j), 3); g.redeemVoucher('clearance'); eq(g.cost(j), 5); j.extraValue = 3; eq(g.sellValue(j), 5); j.rental = true; eq(g.cost(j), 1); });
test('负片提供槽位，即使被削弱', function () { var g = game(), j = joker(g, 'joker', { edition: 'negative' }); eq(g.jokerSlots(), 6); j.debuff = true; eq(g.jokerSlots(), 6); g.destroyJoker(j); eq(g.jokerSlots(), 5); });
test('永恒无法出售或摧毁', function () { var g = game(), j = joker(g, 'joker'); j.eternal = true; eq(g.destroyJoker(j), false); eq(g.sell(j.id), false); });
test('首店保证小丑包与重掷递增/混沌免费', function () { var g = game(); g.run.money = 100; g.openShop(); eq(g.run.shop.packs[0].key, 'buffoon_normal'); eq(g.rerollCost(), 5); joker(g, 'chaos_the_clown'); eq(g.rerollCost(), 0); g.reroll(); eq(g.rerollCost(), 5); g.reroll(); eq(g.rerollCost(), 6); });
test('信用卡透支边界', function () { var g = game(); joker(g, 'credit_card'); eq(g.afford(24), true); eq(g.afford(25), false); });
test('塔罗选择上下限与死神按手牌左右复制', function () { var g = round(game()), a = card(g, 2), b = card(g, 14, 'H', { enh: 'glass', seal: 'red' }); g.run.hand = [a, b]; g.run.deck.push(a, b); var c = g.createConsumable('tarot', { key: 'death' }); eq(g.canUse(c, [a.id]), false); g.use(c.id, [b.id, a.id]); eq(a.rank, 14); eq(a.seal, 'red'); eq(a.enh, 'glass'); eq(a.id === b.id, false); });
test('力量 A 回到 2；愚者复制最后使用星球', function () { var g = round(game()), a = card(g, 14); g.run.hand = [a]; g.run.deck.push(a); var c = g.createConsumable('tarot', { key: 'strength' }); g.use(c.id, [a.id]); eq(a.rank, 2); c = g.createConsumable('planet', { key: 'pluto' }); g.use(c.id); eq(g.run.hands.high.level, 2); c = g.createConsumable('tarot', { key: 'fool' }); g.use(c.id); eq(g.run.cons[0].key, 'pluto'); });
test('紫封弃牌与交易卡摧毁', function () { var g = round(game()), c = card(g, 2, 'S', { seal: 'purple' }); g.run.hand = [c]; g.run.deck.push(c); joker(g, 'trading_card'); g.discard([c.id]); eq(g.run.cons.length, 1); eq(g.run.deck.indexOf(c), -1); eq(g.run.money, 7); });
test('幻灵黑洞升级含隐藏牌型，献祭摧毁五张', function () { var g = round(game()); var c = g.createConsumable('spectral', { key: 'black_hole' }); g.use(c.id); D.HANDS.forEach(function (h) { eq(g.run.hands[h.key].level, 2); }); var n = g.run.deck.length; c = g.createConsumable('spectral', { key: 'immolate' }); g.use(c.id); eq(g.run.deck.length, n - 5); eq(g.run.money, 24); });
test('灵质惩罚递增；安卡移除复制品负片', function () { var g = game(); joker(g, 'joker'); joker(g, 'jolly_joker'); var c = g.createConsumable('spectral', { key: 'ectoplasm' }); g.use(c.id); eq(g.handSize(), 7); c = g.createConsumable('spectral', { key: 'ectoplasm' }); g.use(c.id); eq(g.handSize(), 5); c = g.createConsumable('spectral', { key: 'ankh' }); g.use(c.id); eq(g.run.jokers.length, 2); eq(g.run.jokers[1].edition, null); });
test('双倍复制经济标签；D6 从零逐次增加', function () { var g = game(); g.addTag('double'); g.addTag('economy'); eq(g.run.money, 16); eq(g.run.tags.length, 0); g.addTag('d6'); g.openShop(); eq(g.rerollCost(), 0); g.reroll(); eq(g.rerollCost(), 1); });
test('望远镜保底最常用牌型；包选择次数', function () { var g = game(); g.redeemVoucher('telescope'); g.run.hands.pair.played = 3; g.openPack('celestial_mega', 'blind_select'); eq(g.run.pack.cards[0].key, 'mercury'); g.choosePack(g.run.pack.cards[0].id); eq(g.run.pack.choose, 1); g.choosePack(g.run.pack.cards[0].id); eq(g.run.phase, 'blind_select'); });
test('蓝封/黄金牌回合收益与哑剧', function () { var g = round(game()); joker(g, 'mime'); var c = card(g, 2, 'H', { enh: 'gold', seal: 'blue' }); g.run.hand = [c]; g.run.deck.push(c); g.run.round.chips = g.run.blind.chips; g.endRound(); eq(g.run.money, 10); eq(g.run.cons.length, 2); eq(g.run.cons[0].key, 'pluto'); });
test('利息按结算前资金计算，绿色牌组无利息', function () { var g = round(game()); g.run.money = 25; g.run.round.chips = g.run.blind.chips; g.endRound(); eq(g.run.cash.rows.find(function (r) { return r.label === '利息'; }).amount, 5); g = round(game('green')); g.run.money = 100; g.run.round.chips = g.run.blind.chips; g.endRound(); eq(g.run.cash.total, 3 + 8 + 3); });
test('禁用水/针/镣铐/墙恢复对应限制', function () { var g = round(game(), 'needle'); g.run.round.handsLeft = 1; g.run.blind.restoreHands = 3; g.disableBlind(); eq(g.run.round.handsLeft, 4); g = round(game(), 'wall'); g.run.blind.chips = 1200; g.disableBlind(); eq(g.run.blind.chips, 600); });
test('蔚蓝铃强制选牌校验与绯红更换禁用', function () { var g = round(game(), 'cerulean_bell'); g.forceBell(); var c = g.run.hand.find(function (c) { return c.forced; }); eq(g.validSelection([c.id]), true); eq(g.validSelection([g.run.hand.find(function (h) { return h !== c; }).id]), false); g = round(game(), 'crimson_heart'); joker(g, 'joker'); joker(g, 'jolly_joker'); g.changeCrimson(); eq(g.run.jokers.filter(function (j) { return j.debuff; }).length, 1); });
test('完整回合/结算/商店/下一盲注阶段流', function () { var g = round(game()); g.run.blind.chips = 1; assert.ok(g.play([g.run.hand[0].id])); eq(g.run.phase, 'cash_out'); g.cashOut(); eq(g.run.phase, 'shop'); g.leaveShop(); eq(g.nextBlind(), 'big'); g.selectBlind('big'); eq(g.run.roundNumber, 2); });
test('存档恢复对象身份与随机状态', function () { var g = round(game()); var data = g.serialize(), copy = new BT.Game(); assert.ok(copy.restore(data)); eq(copy.run.deck.find(function (c) { return c.id === copy.run.hand[0].id; }), copy.run.hand[0]); eq(copy.rng.next(), g.rng.next()); var ids = g.run.hand.slice(0, 3).map(function (c) { return c.id; }); g.discard(ids); copy.discard(ids); eq(JSON.stringify(g.serialize()), JSON.stringify(copy.serialize())); });
test('同种子开局完全可复现', function () { eq(JSON.stringify(game('erratic', 8).serialize()), JSON.stringify(game('erratic', 8).serialize())); });
test('点数降序严格按 A K Q J 10 到 2，石头最后', function () { var g=game(); g.run.hand=[2,14,10,11,3,13,5,12].map(function(r){return card(g,r);}); g.run.hand.push(card(g,14,'H',{enh:'stone'})); g.sortHand('rank'); eq(JSON.stringify(g.run.hand.map(function(c){return c.enh==='stone'?'stone':c.rank;})),JSON.stringify([14,13,12,11,10,5,3,2,'stone'])); });
test('烧焦小丑首次弃牌升级并发出完整动画事件', function () { var g = round(game()), a = g.run.hand[0], b = g.run.hand[1]; a.rank = 9; b.rank = 9; joker(g, 'burnt_joker'); var before = g.run.hands.pair.level; g.discard([a.id, b.id]); eq(g.run.hands.pair.level, before + 1); var types = g.events.map(function (e) { return e.type; }), level = g.events.find(function (e) { return e.type === 'level'; }); assert.ok(types.indexOf('discard_cards') < types.indexOf('level')); assert.ok(types.indexOf('level') < types.indexOf('zones')); assert.ok(types.indexOf('draw_cards') > types.indexOf('zones')); eq(level.hand, 'pair'); eq(level.level, before + 1); assert.ok(level.chips > 0 && level.mult > 0); });
test('逐张计分事件成对并标记单手跨越盲注', function () { var g = round(game()), a = card(g, 8), b = card(g, 8, 'H'); g.run.blind.chips = 1; g.begin(); score(g, [a, b]); var starts = g.events.filter(function (e) { return e.type === 'card_start'; }), ends = g.events.filter(function (e) { return e.type === 'card_end'; }), final = g.events.find(function (e) { return e.type === 'score'; }); eq(starts.length, 2); eq(ends.length, 2); eq(final.previous, 0); eq(final.target, 1); eq(final.cleared, true); assert.ok(ends[1].chips >= ends[0].chips); });
test('献祭可用于两张手牌，但不触发玻璃小丑成长', function () { var g = round(game()), a = card(g, 2, 'S', { enh: 'glass' }), b = card(g, 3, 'H', { enh: 'glass' }); g.run.hand = [a, b]; g.run.deck.push(a, b); var j = joker(g, 'glass_joker'), c = g.createConsumable('spectral', { key: 'immolate' }); assert.ok(g.canUse(c, [], false)); g.use(c.id); eq(j.ab.x, 1); eq(g.run.deck.indexOf(a), -1); assert.ok(g.run.hand.length > 0); eq(g.run.money, 24); });
test('摧毁最后一张手牌不造成交互死锁', function () { var g = round(game()), c = g.run.hand[0]; g.run.hand = [c]; var t = g.createConsumable('tarot', { key: 'hanged_man' }); g.use(t.id, [c.id]); assert.ok(g.run.hand.length || g.run.phase !== 'round'); });
test('视觉场景不覆盖玩家的正式存档', function () { var saved = game(); var before = JSON.stringify(saved.serialize()), demo = new BT.Game(); demo.noSave = true; demo.start({ seed: 'DEMO' }); demo.selectBlind('small'); var restored = new BT.Game(); assert.ok(restored.load()); eq(JSON.stringify(restored.serialize()), before); });
test('蔚蓝之铃：死神替换强制牌后仍强制选中一张', function () { var g = round(game(), 'cerulean_bell'); g.forceBell(); var forced = g.run.hand.find(function (c) { return c.forced; }), target = g.run.hand.find(function (c) { return c !== forced; }); g.run.hand = [forced, target].concat(g.run.hand.filter(function (c) { return c !== forced && c !== target; })); var t = g.createConsumable('tarot', { key: 'death' }); g.use(t.id, [forced.id, target.id]); eq(g.run.hand.filter(function (c) { return c.forced; }).length, 1); assert.ok(g.run.hand.some(function (c) { return c.forced; })); });
test('蔚蓝之铃：倒吊人摧毁强制牌后重新强制现有手牌', function () { var g = round(game(), 'cerulean_bell'); g.forceBell(); var forced = g.run.hand.find(function (c) { return c.forced; }), t = g.createConsumable('tarot', { key: 'hanged_man' }); g.use(t.id, [forced.id]); eq(g.run.hand.filter(function (c) { return c.forced; }).length, 1); eq(g.run.deck.indexOf(forced), -1); });
D.BOSSES.forEach(function (def) {
  test('Boss 实际初始化与禁用：' + def.key, function () {
    var g = game(); joker(g, 'joker'); joker(g, 'jolly_joker'); g.run.blinds.small.state = 'skipped'; g.run.blinds.big.state = 'skipped'; g.run.blinds.boss.state = 'next'; g.run.blinds.boss.key = def.key; g.selectBlind('boss');
    if (def.key === 'water') eq(g.run.round.discardsLeft, 0); if (def.key === 'needle') eq(g.run.round.handsLeft, 1); if (def.key === 'manacle') eq(g.run.hand.length, 7);
    if (def.key === 'crimson_heart') eq(g.run.jokers.filter(function (j) { return j.debuff; }).length, 1);
    if (def.key === 'cerulean_bell') eq(g.run.hand.filter(function (c) { return c.forced; }).length, 1);
    if (def.key === 'amber_acorn') assert.ok(g.run.jokers.every(function (j) { return j.flipped; }));
    g.disableBlind(); eq(g.run.blind.disabled, true);
    if (def.key === 'amber_acorn') assert.ok(g.run.jokers.every(function (j) { return !j.flipped; })); eq(g.run.round.handsLeft, 4); eq(g.run.round.discardsLeft, 4); eq(g.handSize(), 8);
  });
});
BT.Jokers.LIST.forEach(function (def) {
  test('小丑引擎契约：' + def.key, function () {
    var g = game(), j = joker(g, def.key); round(g); var cs = [card(g, 2), card(g, 2, 'H')];
    if (typeof def.desc === 'function') assert.equal(typeof def.desc(j, g), 'string');
    score(g, cs, [card(g, 13, 'H', { enh: 'steel' })]); g.context({ type: 'end_of_round', gameOver: false });
    eq(Number.isNaN(g.run.money), false); eq(Number.isNaN(g.run.round.chips), false);
  });
});
console.log('机制测试：' + count + ' 通过，' + failed + ' 失败'); if (failed) process.exitCode = 1;
