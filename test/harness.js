/* Node 无头环境：加载浏览器模块，存储隔离，测试不依赖图形或外部包。 */
'use strict';
var fs = require('fs'), path = require('path'), vm = require('vm');
var storage = new Map();
var window = { localStorage: { getItem: function (k) { return storage.get(k) || null; }, setItem: function (k, v) { storage.set(k, v); }, removeItem: function (k) { storage.delete(k); } } };
var context = vm.createContext({ window: window, console: console });
['utils', 'data', 'poker', 'jokers', 'storage', 'layout', 'game', 'shop'].forEach(function (name) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/' + name + '.js'), 'utf8'), context, { filename: name + '.js' });
});
var BT = window.BT;
function game(deck, stake, seed) { return new BT.Game({ seed: seed || 'TEST2026', deck: deck || 'red', stake: stake || 1 }); }
function card(g, rank, suit, opts) { return g.newPlayingCard(suit || 'S', rank, opts); }
function round(g, key) {
  g.selectBlind('small'); g.run.blind.chips = 1e20;
  if (key) { g.run.blind.type = 'boss'; g.run.blind.key = key; }
  return g;
}
function hand(g, cards, held) {
  var r = g.run; r.hand = held || []; r.play = cards;
  cards.concat(r.hand).forEach(function (c) { if (r.deck.indexOf(c) < 0) r.deck.push(c); });
  r.draw = r.deck.filter(function (c) { return cards.indexOf(c) < 0 && r.hand.indexOf(c) < 0; });
  return cards.map(function (c) { return c.id; });
}
function joker(g, key, opts) { return g.createJoker(Object.assign({ key: key, edition: null, force: true }, opts)); }
function score(g, cards, held) { hand(g, cards, held); return g.scoreHand(cards); }
module.exports = { BT: BT, game: game, card: card, round: round, hand: hand, joker: joker, score: score };
