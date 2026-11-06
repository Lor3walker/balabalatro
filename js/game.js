/* 核心阶段机与计分流水线。逻辑同步执行，界面只回放事件，不参与规则计算。 */
window.BT = window.BT || {};
(function (BT) {
  'use strict';
  var U = BT.Utils, D = BT.Data, J = BT.Jokers.BY;
  var ZONES = ['hand', 'draw', 'play', 'discard'];
  function Game(options) {
    this.run = null; this.events = []; this.tally = null; this.onStateChange = null;
    if (options) this.start(options);
  }
  var P = Game.prototype;
  P.emit = function (type, data) { this.events.push(Object.assign({ type: type }, data || {})); };
  P.begin = function () { this.events = []; };
  P.finish = function () {
    this.run.rng = this.rng.s; this.save();
    if (this.onStateChange) this.onStateChange(this.events);
    return this.events;
  };
  P.start = function (o) {
    o = o || {}; this.begin(); this.rng = new U.Rng(o.seed || U.randomSeed());
    var deckKey = D.DECK[o.deck] ? o.deck : 'red', stake = U.clamp(Number(o.stake) || 1, 1, 8);
    var r = this.run = {
      version: 1, seed: o.seed || '', deckKey: deckKey, stake: stake, ante: 1, roundNumber: 0,
      phase: 'blind_select', money: 4, nextId: 1, sortMode: 'rank', deck: [], draw: [], hand: [], play: [], discard: [],
      jokers: [], cons: [], vouchers: {}, tags: [], bossUsed: {}, current: { oxHand: 'high' },
      base: { hands: 4, discards: 3, handSize: 8, jokerSlots: 5, consSlots: 2 },
      mods: { handSize: 0, ecto: 0, juggle: 0 }, rates: { joker: 20, tarot: 4, planet: 4, playing: 0, spectral: 0 },
      editionRate: 1, discount: 0, rerollBase: 5, shopSlots: 2, interestCap: 25,
      hands: {}, flags: {}, stats: { handsPlayed: 0, tarotsUsed: 0, skips: 0, unusedDiscards: 0, planets: {}, best: 0 },
      round: { handsLeft: 0, discardsLeft: 0, handsPlayed: 0, discardsUsed: 0, chips: 0 },
      blind: null, blinds: null, shop: null, pack: null, lastTarotPlanet: null, lastHand: 'high', won: false
    };
    if (!r.seed) { r.seed = U.randomSeed(); this.rng = new U.Rng(r.seed); }
    D.HANDS.forEach(function (h) { r.hands[h.key] = { level: 1, chips: h.chips, mult: h.mult, played: 0, playedRound: 0, visible: !h.hidden }; });
    if (deckKey === 'red') r.base.discards++;
    if (deckKey === 'blue') r.base.hands++;
    if (deckKey === 'yellow') r.money += 10;
    if (deckKey === 'black') { r.base.jokerSlots++; r.base.hands--; }
    if (deckKey === 'painted') { r.base.handSize += 2; r.base.jokerSlots--; }
    if (deckKey === 'nebula') r.base.consSlots--;
    if (stake >= 5) r.base.discards--;
    for (var s = 0; s < 4; s++) for (var k = 2; k <= 14; k++) {
      if (deckKey === 'abandoned' && k >= 11 && k <= 13) continue;
      var suit = D.SUITS[s], rank = k;
      if (deckKey === 'checkered') suit = s % 2 === 0 ? 'S' : 'H';
      if (deckKey === 'erratic') { suit = this.rng.pick(D.SUITS); rank = this.rng.pick(D.RANKS); }
      r.deck.push(this.newPlayingCard(suit, rank));
    }
    r.startDeckSize = r.deck.length;
    if (deckKey === 'magic') { this.redeemVoucher('crystal_ball'); this.createConsumable('tarot', { key: 'fool', force: true }); this.createConsumable('tarot', { key: 'fool', force: true }); }
    if (deckKey === 'nebula') this.redeemVoucher('telescope');
    if (deckKey === 'ghost') { r.rates.spectral = 2; this.createConsumable('spectral', { key: 'hex' }); }
    if (deckKey === 'zodiac') { this.redeemVoucher('tarot_merchant'); this.redeemVoucher('planet_merchant'); this.redeemVoucher('overstock'); }
    this.resetCurrent(); this.newAnte(); return this.finish();
  };
  P.randInt = function (a, b) { return this.rng.int(a, b); };
  P.has = function (key) { var g = this; return !!this.run && this.run.jokers.some(function (j) { return j.key === key && !g.jokerDebuffed(j); }); };
  P.countJoker = function (key) { var g = this; return this.run.jokers.filter(function (j) { return j.key === key && !g.jokerDebuffed(j); }).length; };
  P.prob = function () { return Math.pow(2, this.countJoker('oops_all_6s')); };
  P.chance = function (n) { return this.rng.next() < this.prob() / n; };
  P.jokerDebuffed = function (j) { return !!(j && (j.debuff || j.slicing || (j.perishable && j.perishLeft <= 0))); };
  P.rid = function (c) { return !c ? 0 : c.enh === 'stone' ? -(1000 + c.id) : c.rank; };
  P.isSuit = function (c, suit, bypass, flushCalc) {
    if (!c || c.enh === 'stone') return false;
    if (!bypass && !flushCalc && this.cardDebuffed(c)) return false;
    if (c.enh === 'wild' && (bypass || !this.cardDebuffed(c))) return true;
    if (this.has('smeared_joker')) return ('HD'.indexOf(c.suit) >= 0) === ('HD'.indexOf(suit) >= 0);
    return c.suit === suit;
  };
  P.isFace = function (c, bypass) {
    if (!c || c.enh === 'stone' || (!bypass && this.cardDebuffed(c))) return false;
    return this.has('pareidolia') || (c.rank >= 11 && c.rank <= 13);
  };
  P.cardDebuffed = function (c) {
    if (!c) return false; if (c.debuff) return true;
    var b = this.run.blind;
    if (!b || b.type !== 'boss' || b.disabled || this.run.phase !== 'round') return false;
    var def = D.BOSS[b.key];
    if (def.debuffSuit && this.isSuit(c, def.debuffSuit, true)) return true;
    if (b.key === 'plant' && this.isFace(c, true)) return true;
    if (b.key === 'pillar' && c.playedAnte) return true;
    return b.key === 'verdant_leaf' && !b.leafSold;
  };
  P.nominalOf = function (c, mode) {
    if (!c) return 0;
    var suit = D.SUIT[c.suit].nominal, rank = D.nominal(c.rank) + D.faceNominal(c.rank);
    if (c.enh === 'stone') return -10000 + rank + c.id * 1e-6;
    return rank * 10 + suit * (mode === 'suit' ? 10000 : 1) + c.id * 1e-6;
  };
  P.sortHand = function (mode) {
    if (mode) this.run.sortMode = mode;
    var g = this; this.run.hand.sort(function (a, b) { return g.nominalOf(b, g.run.sortMode) - g.nominalOf(a, g.run.sortMode); });
  };
  P.reorder = function (zone, id, to) {
    if (['hand', 'jokers', 'cons'].indexOf(zone) < 0) return false;
    var arr = this.run[zone], from = arr.findIndex(function (c) { return c.id === id; });
    if (from < 0) return false; arr.splice(U.clamp(to, 0, arr.length - 1), 0, arr.splice(from, 1)[0]);
    this.begin(); return this.finish();
  };
  P.passive = function (key) {
    var g = this, total = 0;
    this.run.jokers.forEach(function (j) { var p = J[j.key].passive; if (!g.jokerDebuffed(j) && p && p[key]) total += typeof p[key] === 'function' ? p[key](j) : p[key]; });
    return total;
  };
  P.handSize = function () { var r = this.run; return Math.max(0, r.base.handSize + r.mods.handSize + r.mods.juggle + this.passive('handSize') - (this.bossActive('manacle') ? 1 : 0)); };
  P.jokerSlots = function () { return this.run.base.jokerSlots + this.run.jokers.filter(function (j) { return j.edition === 'negative'; }).length; };
  P.consSlots = function () { return this.run.base.consSlots + this.run.cons.filter(function (c) { return c.edition === 'negative'; }).length; };
  P.jokerRoom = function () { return Math.max(0, this.jokerSlots() - this.run.jokers.length); };
  P.consRoom = function () { return Math.max(0, this.consSlots() - this.run.cons.length); };
  P.discardsLeft = function () { return this.run.round.discardsLeft; };
  P.stencilX = function () { return this.jokerSlots() - this.run.jokers.length + this.run.jokers.filter(function (j) { return j.key === 'joker_stencil'; }).length; };
  P.countDeck = function (enh) { return this.run.deck.filter(function (c) { return c.enh === enh; }).length; };
  P.countRank = function (rank) { return this.run.deck.filter(function (c) { return c.rank === rank && c.enh !== 'stone'; }).length; };
  P.countEnhanced = function () { return this.run.deck.filter(function (c) { return !!c.enh; }).length; };
  P.erosionMult = function () { return Math.max(0, 4 * (this.run.startDeckSize - this.run.deck.length)); };
  P.uniquePlanets = function () { return Object.keys(this.run.stats.planets).length; };
  P.otherSellValue = function (j) { var g = this; return this.run.jokers.reduce(function (n, c) { return n + (c === j ? 0 : g.sellValue(c)); }, 0); };
  P.randomVisibleHand = function (exclude) { var r = this.run; return this.rng.pick(D.HANDS.filter(function (h) { return r.hands[h.key].visible && h.key !== exclude; })).key; };
  P.mostPlayed = function () {
    var r = this.run, best = 'high', n = -1;
    D.HANDS.forEach(function (h) { if (r.hands[h.key].visible && r.hands[h.key].played > n) { n = r.hands[h.key].played; best = h.key; } });
    return best;
  };
  P.newPlayingCard = function (suit, rank, opts) { return Object.assign({ id: this.run.nextId++, kind: 'playing', suit: suit, rank: rank, enh: null, edition: null, seal: null, perma: 0 }, opts || {}); };
  P.copyPlayingCard = function (c) { var copy = U.clone(c); copy.id = this.run.nextId++; delete copy.forced; delete copy.flipped; delete copy.shattered; return copy; };
  P.addPlayingCards = function (cards, zone) {
    var r = this.run; cards.forEach(function (c) { r.deck.push(c); if (zone) r[zone].push(c); });
    this.context({ type: 'card_added', count: cards.length }); this.zones();
  };
  P.removePlayingCards = function (cards, shatterGlass) {
    var r = this.run;
    cards.forEach(function (c) { if (c.enh === 'glass' && shatterGlass !== false) c.shattered = true; });
    this.context({ type: 'removed', removed: cards });
    ['deck'].concat(ZONES).forEach(function (zone) { r[zone] = r[zone].filter(function (c) { return cards.indexOf(c) < 0; }); });
    this.emit('destroy', { ids: cards.map(function (c) { return c.id; }) });
  };
  P.logEnhance = function (c) { this.emit('enhance', { card: U.clone(c) }); };
  P.zones = function () {
    var r = this.run, data = { cards: U.clone(r.hand.concat(r.play, r.jokers, r.cons)), drawCount: r.draw.length };
    ['hand', 'play', 'jokers', 'cons'].forEach(function (z) { data[z] = r[z].map(function (c) { return c.id; }); });
    this.emit('zones', data);
  };
  P.addMoney = function (n, src) { if (!n) return; this.run.money += n; this.emit('money', { amount: n, money: this.run.money, src: src && src.id }); };
  P.levelHand = function (key, amount, src) {
    if (!key || !D.HAND[key]) return;
    var h = this.run.hands[key], def = D.HAND[key]; amount = amount === undefined ? 1 : amount;
    h.level = Math.max(1, h.level + amount); h.chips = Math.max(1, def.chips + def.lc * (h.level - 1)); h.mult = Math.max(1, def.mult + def.lm * (h.level - 1));
    this.emit('level', { hand: key, level: h.level, amount: amount, chips: h.chips, mult: h.mult, src: src && src.id });
  };
  /* 不同时机的筹码/倍率应用顺序不同；绝不把 X 倍率合并到最终一步。 */
  P.effect = function (res, src, ctx, order) {
    if (!res) return; src = res.src || src; var g = this;
    (order || ['mult', 'chips', 'dollars', 'xmult', 'hmult']).forEach(function (k) {
      if (res[k] === undefined) return;
      var v = res[k];
      if (k === 'dollars') { g.addMoney(v, src); return; }
      if (!g.tally || !v) return;
      if (k === 'chips') g.tally.chips += v;
      else if (k === 'xmult') g.tally.mult *= v;
      else g.tally.mult += v;
      g.emit(k, { amount: v, chips: g.tally.chips, mult: g.tally.mult, src: src && src.id });
    });
    if (res.levelUp) this.levelHand(res.levelUp === true ? ctx.hand : res.levelUp, 1, src);
    if (res.msg) this.emit('message', { text: res.msg, color: res.color || 'dim', src: src && src.id, quiet: res.quiet });
  };
  P.calc = function (j, ctx) { return !this.jokerDebuffed(j) && J[j.key].calc ? J[j.key].calc(j, ctx, this) : null; };
  P.context = function (ctx, order) {
    var g = this, result = [];
    this.run.jokers.slice().forEach(function (j) {
      if (g.run.jokers.indexOf(j) < 0) return;
      var res = g.calc(j, ctx); if (res) { g.effect(res, j, ctx, order); result.push(res); }
    });
    return result;
  };
  P.bossActive = function (key) { var b = this.run.blind; return !!b && this.run.phase === 'round' && b.type === 'boss' && !b.disabled && b.key === key; };
  P.pickBoss = function () {
    var r = this.run, showdown = r.ante % 8 === 0 && r.ante >= 8;
    var pool = D.BOSSES.filter(function (b) { return !!b.showdown === showdown && (b.showdown || b.ante <= r.ante); });
    var min = Math.min.apply(null, pool.map(function (b) { return r.bossUsed[b.key] || 0; }));
    var def = this.rng.pick(pool.filter(function (b) { return (r.bossUsed[b.key] || 0) === min; }));
    r.bossUsed[def.key] = (r.bossUsed[def.key] || 0) + 1; return def.key;
  };
  P.newAnte = function () {
    var r = this.run; r.blinds = {
      small: { state: 'next', tag: this.randomTag() }, big: { state: 'locked', tag: this.randomTag() },
      boss: { state: 'locked', key: this.pickBoss() }
    };
    r.voucherKey = this.randomVoucher(); r.bossRerolled = false;
  };
  P.resetCurrent = function () {
    var r = this.run, cards = r.deck.filter(function (c) { return c.enh !== 'stone'; }), c = this.rng.pick(cards);
    r.current.mailRank = c ? c.rank : 14;
    c = this.rng.pick(cards); r.current.idol = c ? { rank: c.rank, suit: c.suit } : { rank: 14, suit: 'S' };
    r.current.castleSuit = c ? this.rng.pick(cards).suit : 'S';
    r.current.ancientSuit = this.rng.pick(D.SUITS.filter(function (s) { return s !== r.current.ancientSuit; }));
  };
  P.nextBlind = function () { var b = this.run.blinds; return ['small', 'big', 'boss'].find(function (k) { return b[k].state === 'next'; }); };
  P.advanceBlind = function (type, state) {
    var b = this.run.blinds; b[type].state = state;
    if (type === 'small') b.big.state = 'next'; if (type === 'big') b.boss.state = 'next';
  };
  P.selectBlind = function (type) {
    var r = this.run; if (r.phase !== 'blind_select' || type !== this.nextBlind()) return false;
    this.begin(); var def = type === 'boss' ? D.BOSS[r.blinds.boss.key] : D.BLINDS[type];
    r.roundNumber++; r.phase = 'round'; r.mods.juggle = 0;
    r.tags = r.tags.filter(function (t) { if (t.key === 'juggle') { r.mods.juggle += 3; return false; } return true; });
    r.round = { handsLeft: Math.max(1, r.base.hands + this.passive('hands')), discardsLeft: Math.max(0, r.base.discards + this.passive('discards')), handsPlayed: 0, discardsUsed: 0, chips: 0 };
    r.blind = { type: type, key: def.key, chips: this.blindTarget(type), dollars: type === 'small' && r.stake >= 2 ? 0 : def.dollars, disabled: false, triggered: false, seen: {}, mouth: null, oxHand: r.current.oxHand };
    Object.keys(r.hands).forEach(function (k) { r.hands[k].playedRound = 0; });
    r.hand = []; r.play = []; r.discard = []; r.draw = r.deck.slice();
    r.deck.forEach(function (c) { c.flipped = false; c.forced = false; });
    r.jokers.forEach(function (j) { j.debuff = false; j.flipped = false; });
    if (this.bossActive('water')) { r.blind.restoreDiscards = r.round.discardsLeft; r.round.discardsLeft = 0; }
    if (this.bossActive('needle')) { r.blind.restoreHands = r.round.handsLeft - 1; r.round.handsLeft = 1; }
    if (this.bossActive('amber_acorn')) { this.rng.shuffle(r.jokers); r.jokers.forEach(function (j) { j.flipped = true; }); }
    this.context({ type: 'setting_blind', boss: type === 'boss' });
    this.rng.shuffle(r.draw); this.changeCrimson(); this.drawCards(true);
    this.context({ type: 'first_hand_drawn' }); this.forceBell(); this.sortHand(); this.zones();
    if (!r.hand.length) this.endRound(); return this.finish();
  };
  P.blindTarget = function (type) {
    var r = this.run, def = type === 'boss' ? D.BOSS[r.blinds.boss.key] : D.BLINDS[type];
    return Math.floor(D.blindAmount(r.ante, r.stake >= 6 ? 3 : r.stake >= 3 ? 2 : 1) * def.mult * (r.deckKey === 'plasma' ? 2 : 1));
  };
  P.skipBlind = function (type) {
    var r = this.run; if (r.phase !== 'blind_select' || type === 'boss' || type !== this.nextBlind()) return false;
    this.begin(); r.stats.skips++; this.advanceBlind(type, 'skipped'); this.addTag(r.blinds[type].tag.key, r.blinds[type].tag);
    this.processBlindTags(); return this.finish();
  };
  P.disableBlind = function () {
    var r = this.run, b = r.blind; if (!b || b.type !== 'boss' || b.disabled) return;
    var wasManacle = b.key === 'manacle'; b.disabled = true;
    if (b.key === 'water') r.round.discardsLeft += b.restoreDiscards || 0;
    if (b.key === 'needle') r.round.handsLeft += b.restoreHands || 0;
    if (b.key === 'wall' || b.key === 'violet_vessel') b.chips = Math.floor(b.chips * 2 / D.BOSS[b.key].mult);
    r.hand.forEach(function (c) { c.forced = false; c.flipped = false; });
    r.jokers.forEach(function (j) { j.debuff = false; if (b.key === 'amber_acorn') j.flipped = false; });
    if (wasManacle && r.hand.length) this.drawCards(false, 1);
    this.emit('message', { text: 'Boss 已禁用', color: 'dim' });
  };
  P.forceBell = function () {
    var r = this.run; if (!this.bossActive('cerulean_bell') || !r.hand.length || r.hand.some(function (c) { return c.forced; })) return;
    this.rng.pick(r.hand).forced = true;
  };
  P.changeCrimson = function () {
    var r = this.run; if (!this.bossActive('crimson_heart') || !r.jokers.length) return;
    var pool = r.jokers.filter(function (j) { return !j.debuff; });
    r.jokers.forEach(function (j) { j.debuff = false; }); (this.rng.pick(pool.length ? pool : r.jokers)).debuff = true;
  };
  P.drawCards = function (first, exact, afterPlay) {
    var r = this.run, drawn = [], n = exact === undefined ? Math.max(0, this.handSize() - r.hand.length) : exact;
    if (exact === undefined && this.bossActive('serpent') && !first) n = 3;
    n = Math.min(n, r.draw.length);
    for (var i = 0; i < n; i++) {
      var c = r.draw.pop(); c.forced = false;
      c.flipped = this.bossActive('house') && first || this.bossActive('wheel') && this.chance(7) || this.bossActive('mark') && this.isFace(c, true) || this.bossActive('fish') && !!afterPlay;
      r.hand.push(c); drawn.push(c.id);
    }
    this.sortHand(); this.forceBell(); this.zones();
    if (drawn.length) this.emit('draw_cards', { ids: drawn, first: !!first, afterPlay: !!afterPlay });
  };
  P.selected = function (ids) { return this.run.hand.filter(function (c) { return ids.indexOf(c.id) >= 0; }); };
  P.validSelection = function (ids) { var r = this.run, cards = this.selected(ids); return cards.length >= 1 && cards.length <= 5 && r.hand.every(function (c) { return !c.forced || ids.indexOf(c.id) >= 0; }); };
  P.preview = function (ids) { return BT.Poker.info(this.selected(ids), this); };
  P.discardCards = function (cards, hook) {
    var r = this.run, g = this, ctx = { type: 'pre_discard', full: cards, hook: !!hook };
    this.emit('discard_cards', { ids: cards.map(function (c) { return c.id; }), hook: !!hook }); this.context(ctx);
    var removed = [];
    cards.forEach(function (c) {
      c.flipped = false; c.forced = false;
      if (c.seal === 'purple' && !g.cardDebuffed(c) && g.consRoom()) g.createConsumable('tarot');
      var effects = g.context({ type: 'discard', card: c, full: cards, hook: !!hook });
      if (effects.some(function (e) { return e.remove; })) removed.push(c); else r.discard.push(c);
    });
    r.hand = r.hand.filter(function (c) { return cards.indexOf(c) < 0; });
    if (removed.length) this.removePlayingCards(removed); this.zones();
  };
  P.discard = function (ids) {
    var r = this.run; if (r.phase !== 'round' || r.round.discardsLeft < 1 || !this.validSelection(ids)) return false;
    this.begin(); this.discardCards(this.selected(ids), false); r.round.discardsLeft--; r.round.discardsUsed++;
    this.drawCards(false); if (!r.hand.length) this.endRound(); return this.finish();
  };
  P.play = function (ids) {
    var r = this.run; if (r.phase !== 'round' || r.round.handsLeft < 1 || !this.validSelection(ids)) return false;
    this.begin(); r.round.handsLeft--; r.play = this.selected(ids);
    r.hand = r.hand.filter(function (c) { return r.play.indexOf(c) < 0; });
    r.play.forEach(function (c) { c.flipped = false; c.forced = false; }); this.zones();
    if (this.bossActive('hook')) this.discardCards(this.rng.shuffle(r.hand.slice()).slice(0, 2), true);
    if (this.bossActive('tooth')) this.addMoney(-r.play.length);
    this.scoreHand(r.play.slice());
    r.stats.handsPlayed++; r.round.handsPlayed++;
    r.play.forEach(function (c) { c.playedAnte = true; r.discard.push(c); }); r.play = []; this.zones();
    if (r.round.chips >= r.blind.chips || r.round.handsLeft <= 0 || (!r.hand.length && !r.draw.length)) this.endRound();
    else { this.changeCrimson(); this.drawCards(false, undefined, true); }
    return this.finish();
  };
  P.debuffHand = function (cards, hand) {
    var b = this.run.blind, blocked = false;
    if (!b || b.disabled || b.type !== 'boss') return false;
    if (b.key === 'psychic' && cards.length < 5) blocked = true;
    if (b.key === 'eye') { blocked = !!b.seen[hand]; b.seen[hand] = true; }
    if (b.key === 'mouth') { blocked = !!b.mouth && b.mouth !== hand; if (!b.mouth) b.mouth = hand; }
    if (b.key === 'arm' && this.run.hands[hand].level > 1) { this.levelHand(hand, -1); b.triggered = true; }
    if (b.key === 'ox' && hand === b.oxHand) { this.addMoney(-this.run.money); b.triggered = true; }
    if (blocked) b.triggered = true; return blocked;
  };
  P.repetitions = function (ctx, c, hasEffect) {
    var g = this, reps = [];
    if (c.seal === 'red' && hasEffect && !this.cardDebuffed(c)) reps.push(c);
    this.run.jokers.slice().forEach(function (j) { var res = g.calc(j, ctx); if (res && res.reps) for (var k = 0; k < res.reps; k++) reps.push(res.src || j); });
    return reps;
  };
  P.playCard = function (c, ctx) {
    var res = { chips: (c.enh === 'stone' ? 50 : D.nominal(c.rank)) + (c.perma || 0) + (c.enh === 'bonus' ? 30 : 0) };
    c.luckyHit = false;
    if (c.enh === 'mult') res.mult = 4;
    if (c.enh === 'lucky' && this.chance(5)) { res.mult = 20; c.luckyHit = true; }
    if (c.seal === 'gold') res.dollars = 3;
    if (c.enh === 'lucky' && this.chance(15)) { res.dollars = (res.dollars || 0) + 20; c.luckyHit = true; }
    if (c.enh === 'glass') res.xmult = 2;
    this.effect(res, c, ctx, ['chips', 'mult', 'dollars', 'xmult']);
    if (c.edition === 'foil') this.effect({ chips: 50 }, c, ctx);
    if (c.edition === 'holo') this.effect({ mult: 10 }, c, ctx);
    if (c.edition === 'poly') this.effect({ xmult: 1.5 }, c, ctx);
    this.context(Object.assign({}, ctx, { type: 'play', card: c }), ['chips', 'mult', 'dollars', 'xmult']);
    c.luckyHit = false;
  };
  P.heldCard = function (c, ctx, roundEnd) {
    var g = this, hasEffect = false;
    if (roundEnd) {
      if (!this.cardDebuffed(c)) {
        if (c.enh === 'gold') { this.addMoney(3, c); hasEffect = true; }
        if (c.seal === 'blue' && this.consRoom()) { this.createConsumable('planet', { key: D.PLANETS.find(function (p) { return p.hand === g.run.lastHand; }).key }); hasEffect = true; }
      }
    } else {
      if (c.enh === 'steel' && !this.cardDebuffed(c)) { this.effect({ xmult: 1.5 }, c, ctx); hasEffect = true; }
      this.run.jokers.slice().forEach(function (j) {
        var res = g.calc(j, Object.assign({}, ctx, { type: 'held', card: c }));
        if (res) { g.effect(res, j, ctx, ['dollars', 'hmult', 'xmult']); if (res.dollars || res.hmult || res.xmult) hasEffect = true; }
      });
    }
    return hasEffect;
  };
  P.scoreHand = function (cards) {
    var r = this.run, g = this, info = BT.Poker.info(cards, this), hand = info.hand;
    if (!hand) return 0;
    var scoring = cards.filter(function (c) { return g.has('splash') || c.enh === 'stone' || info.scoring.indexOf(c) >= 0; });
    var ctx = { full: cards, scoring: scoring, hand: hand, poker: info.poker };
    r.lastHand = hand; r.blind.triggered = false; r.hands[hand].played++; r.hands[hand].playedRound++; r.hands[hand].visible = true;
    var blocked = this.debuffHand(cards, hand);
    if (blocked) {
      this.emit('message', { text: '牌型被 Boss 禁用', color: 'mult' }); this.context(Object.assign({}, ctx, { type: 'debuffed_hand' }));
      this.emit('score', { hand: hand, score: 0, previous: r.round.chips, total: r.round.chips, target: r.blind.chips, cleared: false, chips: 0, mult: 0 });
      return 0;
    }
    this.context(Object.assign({}, ctx, { type: 'before' })); this.zones();
    this.tally = { chips: r.hands[hand].chips, mult: r.hands[hand].mult };
    if (this.bossActive('flint')) { this.tally.chips = Math.max(1, Math.floor(this.tally.chips / 2 + 0.5)); this.tally.mult = Math.max(1, Math.floor(this.tally.mult / 2 + 0.5)); r.blind.triggered = true; }
    this.emit('base', { hand: hand, royal: info.royal, chips: this.tally.chips, mult: this.tally.mult });
    scoring.forEach(function (c) {
      g.emit('card_start', { card: c.id });
      if (g.cardDebuffed(c)) { r.blind.triggered = true; g.emit('message', { text: '已削弱', src: c.id, color: 'dim' }); g.emit('card_end', { card: c.id, chips: g.tally.chips, mult: g.tally.mult }); return; }
      var reps = g.repetitions(Object.assign({}, ctx, { type: 'rep_play', card: c }), c, true);
      g.playCard(c, ctx);
      reps.forEach(function (src) { g.emit('retrigger', { src: src.id, card: c.id }); g.playCard(c, ctx); });
      g.emit('card_end', { card: c.id, chips: g.tally.chips, mult: g.tally.mult });
    });
    this.emit('score_phase', { label: '手牌能力' });
    r.hand.slice().forEach(function (c) {
      var active = g.heldCard(c, ctx, false);
      var reps = g.repetitions(Object.assign({}, ctx, { type: 'rep_held', card: c, hasEffect: active }), c, active);
      reps.forEach(function (src) { g.emit('retrigger', { src: src.id, card: c.id }); g.heldCard(c, ctx, false); });
    });
    this.emit('score_phase', { label: '小丑结算' });
    r.jokers.concat(r.cons).slice().forEach(function (j) {
      if (j.kind === 'joker' && (g.jokerDebuffed(j) || r.jokers.indexOf(j) < 0)) return;
      if (j.edition === 'foil') g.effect({ chips: 50 }, j, ctx);
      if (j.edition === 'holo') g.effect({ mult: 10 }, j, ctx);
      if (j.kind === 'joker') {
        g.effect(g.calc(j, Object.assign({}, ctx, { type: 'main' })), j, ctx, ['mult', 'chips', 'xmult', 'dollars']);
        g.context(Object.assign({}, ctx, { type: 'other_joker', other: j }));
      }
      if (j.edition === 'poly') g.effect({ xmult: 1.5 }, j, ctx);
    });
    if (r.vouchers.observatory) r.cons.forEach(function (c) { if (c.kind === 'planet' && D.PLANET[c.key].hand === hand) g.effect({ xmult: 1.5 }, c, ctx); });
    if (r.deckKey === 'plasma') { var balance = Math.floor((this.tally.chips + this.tally.mult) / 2); this.tally.chips = balance; this.tally.mult = balance; this.emit('balance', U.clone(this.tally)); }
    var removed = [];
    cards.forEach(function (c) {
      var res = g.context(Object.assign({}, ctx, { type: 'destroying_card', card: c }));
      if (res.some(function (e) { return e.destroy; }) || (c.enh === 'glass' && !g.cardDebuffed(c) && g.chance(4))) removed.push(c);
    });
    if (removed.length) this.removePlayingCards(removed);
    var score = Math.floor(this.tally.chips * this.tally.mult), previous = r.round.chips; r.round.chips += score; r.stats.best = Math.max(r.stats.best, score);
    this.emit('score', { hand: hand, score: score, previous: previous, total: r.round.chips, target: r.blind.chips, cleared: previous < r.blind.chips && r.round.chips >= r.blind.chips, chips: this.tally.chips, mult: this.tally.mult });
    this.tally = null; this.context(Object.assign({}, ctx, { type: 'after' })); return score;
  };
  P.endRound = function () {
    var r = this.run, g = this, lost = r.round.chips < r.blind.chips;
    var res = this.context({ type: 'end_of_round', gameOver: lost }); if (res.some(function (e) { return e.saved; })) lost = false;
    r.jokers.slice().forEach(function (j) { if (j.rental) g.addMoney(-3, j); if (j.perishable && j.perishLeft > 0) j.perishLeft--; });
    if (lost) { r.phase = 'game_over'; this.emit('end', { won: false }); return; }
    r.hand.slice().forEach(function (c) {
      var ctx = { type: 'rep_held', card: c, roundEnd: true }, active = g.heldCard(c, ctx, true);
      g.repetitions(Object.assign({}, ctx, { hasEffect: active }), c, active).forEach(function () { g.heldCard(c, ctx, true); });
    });
    r.stats.unusedDiscards += r.round.discardsLeft;
    var rows = [], cash = function (label, n, src) { if (n) rows.push({ label: label, amount: n, src: src && src.id }); };
    cash('盲注奖励', r.blind.dollars);
    cash('剩余出牌 × $' + (r.deckKey === 'green' ? 2 : 1), r.round.handsLeft * (r.deckKey === 'green' ? 2 : 1));
    if (r.deckKey === 'green') cash('剩余弃牌 × $1', r.round.discardsLeft);
    r.jokers.forEach(function (j) { if (!g.jokerDebuffed(j) && J[j.key].dollars) cash(J[j.key].zh, J[j.key].dollars(j, g), j); });
    if (r.blind.type === 'boss') r.tags = r.tags.filter(function (t) { if (t.key === 'investment') { cash('投资标签', 25); return false; } return true; });
    if (r.deckKey !== 'green') cash('利息', (1 + this.passive('interest')) * Math.min(Math.floor(Math.max(0, r.money) / 5), r.interestCap / 5));
    r.cash = { rows: rows, total: rows.reduce(function (n, row) { return n + row.amount; }, 0) };
    this.advanceBlind(r.blind.type, 'defeated'); r.jokers.forEach(function (j) { j.flipped = false; j.debuff = false; });
    if (r.blind.type === 'boss') {
      r.current.oxHand = this.mostPlayed(); var beatenAnte = r.ante; r.ante++;
      r.deck.forEach(function (c) { c.playedAnte = false; });
      if (r.deckKey === 'anaglyph') this.addTag('double');
      if (beatenAnte === 8 && !r.won) { r.won = true; r.flags.winPending = true; }
      this.newAnte();
    }
    r.mods.juggle = 0; this.resetCurrent(); r.phase = 'cash_out'; this.emit('cash', U.clone(r.cash));
  };
  P.cashOut = function () {
    if (this.run.phase !== 'cash_out') return false; this.begin(); this.addMoney(this.run.cash.total);
    if (this.run.flags.winPending) { this.run.phase = 'won'; delete this.run.flags.winPending; }
    else this.openShop(); return this.finish();
  };
  P.continueEndless = function () { if (this.run.phase !== 'won') return false; this.begin(); this.openShop(); return this.finish(); };
  /* 所有活动区域共享同一扑克牌对象；存档用 id 编码，读取时恢复身份关系。 */
  P.serialize = function () {
    var r = this.run, data = Object.assign({}, r, { rng: this.rng.s });
    ZONES.forEach(function (z) { data[z] = r[z].map(function (c) { return c.id; }); });
    return JSON.parse(JSON.stringify(data, function (k, v) { return v === Infinity ? '__Infinity__' : v; }));
  };
  P.restore = function (data) {
    if (!data || data.version !== 1 || !BT.Storage.validate(data)) return false;
    var previous = { run: this.run, rng: this.rng, events: this.events };
    try {
      var r = JSON.parse(JSON.stringify(data), function (k, v) { return v === '__Infinity__' ? Infinity : v; });
      if (!D.DECK[r.deckKey] || !Array.isArray(r.deck)) return false;
      var by = {}; r.deck.forEach(function (c) { by[c.id] = c; });
      ZONES.forEach(function (z) { r[z] = r[z].map(function (id) { if (!by[id]) throw new Error('无效卡牌'); return by[id]; }); });
      this.run = r; this.rng = new U.Rng(r.rng); this.begin(); this.zones(); return this.finish();
    } catch (e) { this.run = previous.run; this.rng = previous.rng; this.events = previous.events; return false; }
  };
  P.save = function () { if (this.run && !this.noSave) return BT.Storage.save(this.serialize()); return false; };
  P.load = function () { return this.restore(BT.Storage.load()); };
  BT.Game = Game;
})(window.BT);
