/* 无头整局模拟：普通构筑与强化压力场景，验证阶段推进、卡牌守恒及存档身份。 */
'use strict';
var assert = require('node:assert/strict'), H = require('./harness'), D = H.BT.Data;
var runs = Number(process.argv[2]) || 40, phases = new Set(), totalHands = 0, highAnte = 0;
function check(g) {
  var r = g.run; phases.add(r.phase); assert.ok(Number.isFinite(r.money)); assert.ok(!Number.isNaN(r.round.chips));
  var ids = r.deck.map(function (c) { return c.id; }); assert.equal(new Set(ids).size, ids.length);
  var seen = new Set(); ['hand', 'draw', 'play', 'discard'].forEach(function (zone) { r[zone].forEach(function (c) { assert.ok(r.deck.indexOf(c) >= 0, zone + ' 卡牌必须属于牌组'); assert.ok(!seen.has(c.id), '区域不能重复占用卡牌'); seen.add(c.id); }); });
  assert.ok(r.jokers.every(function (j) { return H.BT.Jokers.BY[j.key]; }));
  assert.ok(r.cons.every(function (c) { return (c.kind === 'tarot' ? D.TAROT : c.kind === 'planet' ? D.PLANET : D.SPECTRAL)[c.key]; }));
}
function best(g) {
  var cards = g.run.hand, bestIds = [], bestScore = -1;
  function visit(from, selected) {
    if (selected.length) {
      var ids = selected.map(function (c) { return c.id; });
      if (g.validSelection(ids)) {
        var p = H.BT.Poker.info(selected, g), h = g.run.hands[p.hand], chips = h.chips, mult = h.mult;
        selected.forEach(function (c) { if (c.enh === 'stone' || p.scoring.indexOf(c) >= 0) { if (!g.cardDebuffed(c)) { chips += c.enh === 'stone' ? 50 : D.nominal(c.rank); if (c.enh === 'bonus') chips += 30; if (c.enh === 'mult') mult += 4; if (c.enh === 'glass') mult *= 2; } } });
        var estimate = chips * mult - selected.length * 0.01;
        if (estimate > bestScore) { bestScore = estimate; bestIds = ids; }
      }
    }
    if (selected.length === 5) return;
    for (var i = from; i < cards.length; i++) visit(i + 1, selected.concat(cards[i]));
  }
  visit(0, []); return bestIds;
}
function useAvailable(g) {
  var r = g.run, c = r.cons.find(function (c) { return g.canUse(c, [], false); }); if (c) g.use(c.id, []);
}
for (var n = 0; n < runs; n++) {
  var stress = n % 5 === 0, g = H.game(D.DECKS[n % 15].key, 1 + n % 8, 'SIM' + n);
  if (stress) {
    ['chicot', 'stuntman', 'cavendish', 'canio', 'blueprint'].forEach(function (key) { H.joker(g, key); });
    g.run.jokers.find(function (j) { return j.key === 'canio'; }).ab.x = 10000;
  }
  var steps = 0, rerolls = 0;
  while (g.run.phase !== 'game_over' && g.run.phase !== 'won' && steps++ < 220) {
    var r = g.run; check(g); highAnte = Math.max(highAnte, r.ante);
    if (r.phase === 'blind_select') { useAvailable(g); g.selectBlind(g.nextBlind()); }
    else if (r.phase === 'round') {
      useAvailable(g); var ids = best(g);
      if (!ids.length) { g.endRound(); continue; }
      var p = g.preview(ids);
      if (!stress && r.round.discardsLeft && p.hand === 'high' && r.hand.length > 1) {
        var discard = r.hand.filter(function (c) { return ids.indexOf(c.id) < 0; }).slice(0, 5).map(function (c) { return c.id; });
        r.hand.filter(function (c) { return c.forced; }).forEach(function (c) { if (discard.indexOf(c.id) < 0) discard = discard.slice(0, 4).concat(c.id); });
        g.discard(discard);
      } else { g.play(ids); totalHands++; }
    } else if (r.phase === 'cash_out') { g.cashOut(); rerolls = 0; }
    else if (r.phase === 'shop') {
      useAvailable(g);
      var c = r.shop.cards.find(function (c) { return g.afford(g.cost(c)) && (c.kind === 'joker' && g.jokerRoom() || c.kind === 'planet' && g.consRoom()); });
      if (!c) c = r.shop.packs.find(function (c) { return g.afford(g.cost(c)); });
      if (c) g.buy(c.id); else if (rerolls++ < 1 && r.money > 12) g.reroll(); else g.leaveShop();
    } else if (r.phase === 'pack') {
      var packCard = r.pack.cards.find(function (c) { return c.kind === 'playing' || c.kind === 'joker' && g.jokerRoom() || c.kind !== 'joker' && g.canUse(c, [], true); });
      if (packCard) g.choosePack(packCard.id, []); else g.skipPack();
    }
    check(g);
    if (steps % 17 === 0) { var saved = g.serialize(), copy = new H.BT.Game(); assert.ok(copy.restore(saved)); assert.equal(JSON.stringify(copy.serialize()), JSON.stringify(saved)); g = copy; }
  }
  assert.ok(steps < 220, '阶段机必须终止或到达第八底注胜利'); check(g);
}
['blind_select', 'round', 'cash_out', 'shop', 'pack', 'game_over', 'won'].forEach(function (p) { assert.ok(phases.has(p), '未覆盖阶段 ' + p); });
console.log('无头模拟：' + runs + ' 局，' + totalHands + ' 手牌，最高底注 ' + highAnte + '；7 个阶段均覆盖，无状态异常。');
