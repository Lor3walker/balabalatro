/* 卡牌生成、商店、补充包、消耗牌、优惠券与标签。扩展核心引擎，无 DOM 依赖。 */
(function (BT) {
  'use strict';
  var P = BT.Game.prototype, U = BT.Utils, D = BT.Data, J = BT.Jokers.BY;
  P.poolHas = function (kind, key) {
    if (this.has('showman')) return false;
    var r = this.run, cards = r.jokers.concat(r.cons, r.shop ? r.shop.cards : [], r.pack ? r.pack.cards : []);
    return cards.some(function (c) { return c.kind === kind && c.key === key; });
  };
  P.pollEdition = function (rate, guaranteed, noNegative) {
    var p = this.rng.next(), m = (rate || 1) * this.run.editionRate;
    if (guaranteed) return p < 0.15 ? 'poly' : p < 0.5 ? 'holo' : 'foil';
    if (!noNegative && p > 0.997) return 'negative';
    if (p > 1 - 0.006 * m) return 'poly';
    if (p > 1 - 0.02 * m) return 'holo';
    if (p > 1 - 0.04 * m) return 'foil';
    return null;
  };
  P.createJoker = function (opts) {
    opts = opts || {}; var r = this.run, g = this;
    if (!opts.area && !opts.force && !this.jokerRoom() && opts.edition !== 'negative') return null;
    var rarity = opts.rarity;
    if (!rarity) { var p = this.rng.next(); rarity = p > 0.95 ? 3 : p > 0.7 ? 2 : 1; }
    var pool = BT.Jokers.LIST.filter(function (j) {
      return j.rarity === rarity && !g.poolHas('joker', j.key) && (!j.gate || g.countDeck(j.gate)) &&
        (j.key !== 'cavendish' || r.flags.grosExtinct) && (j.key !== 'gros_michel' || !r.flags.grosExtinct);
    });
    var key = opts.key || (this.rng.pick(pool) || J.joker).key, def = J[key];
    if (!def) return null;
    var j = { id: r.nextId++, kind: 'joker', key: key, ab: U.clone(def.ab), edition: opts.edition === undefined ? this.pollEdition() : opts.edition, extraValue: 0 };
    if (opts.stickers && r.stake >= 4) {
      var sticker = this.rng.next(); j.eternal = def.eternal && sticker > 0.7;
      j.perishable = r.stake >= 7 && def.perish && sticker > 0.4 && sticker <= 0.7; j.perishLeft = 5;
      if (r.stake >= 8) j.rental = this.rng.next() > 0.7;
    }
    if (def.init) def.init(j, this);
    if (!opts.area) this.ownJoker(j);
    return j;
  };
  P.ownJoker = function (j) {
    this.run.jokers.push(j); this.passiveDelta(j, 1); if (J[j.key].onAdd) J[j.key].onAdd(j, this); this.zones();
  };
  P.passiveDelta = function (j, sign) {
    var r = this.run, p = J[j.key].passive; if (!p || this.jokerDebuffed(j) || r.phase !== 'round') return;
    ['hands', 'discards'].forEach(function (k) { if (p[k]) r.round[k === 'hands' ? 'handsLeft' : 'discardsLeft'] += sign * p[k]; });
    r.round.discardsLeft = Math.max(0, r.round.discardsLeft);
  };
  P.destroyJoker = function (j) {
    if (j.eternal) return false;
    var i = this.run.jokers.indexOf(j); if (i < 0) return false;
    /* slicing 只阻止本次事件链激活，不取消先前已应用的被动能力。 */
    var slicing = j.slicing; j.slicing = false; this.passiveDelta(j, -1); j.slicing = slicing;
    this.run.jokers.splice(i, 1); this.emit('destroy', { ids: [j.id] }); return true;
  };
  P.copyJoker = function (j, stripNegative) {
    var copy = U.clone(j); copy.id = this.run.nextId++; copy.slicing = false; copy.flipped = false; copy.debuff = false;
    if (stripNegative && copy.edition === 'negative') copy.edition = null;
    this.ownJoker(copy); return copy;
  };
  P.createConsumable = function (kind, opts) {
    opts = opts || {}; var g = this, r = this.run;
    if (!opts.area && !opts.force && !this.consRoom() && opts.edition !== 'negative') return null;
    var list = kind === 'planet' ? D.PLANETS : kind === 'spectral' ? D.SPECTRALS : D.TAROTS;
    var pool = list.filter(function (c) { return !c.hidden && !g.poolHas(kind, c.key) && (!c.softlock || r.hands[c.hand].visible); });
    var key = opts.key || (this.rng.pick(pool) || (kind === 'planet' ? D.PLANET.pluto : kind === 'spectral' ? D.SPECTRAL.incantation : D.TAROT.strength)).key;
    if (opts.soulable) {
      if ((kind === 'tarot' || kind === 'spectral') && !this.poolHas('spectral', 'soul') && this.rng.next() > 0.997) { kind = 'spectral'; key = 'soul'; }
      if ((kind === 'planet' || kind === 'spectral') && !this.poolHas('spectral', 'black_hole') && this.rng.next() > 0.997) { kind = 'spectral'; key = 'black_hole'; }
    }
    var c = { id: r.nextId++, kind: kind, key: key, edition: opts.edition || null, extraValue: 0 };
    if (!opts.area) { r.cons.push(c); this.zones(); } return c;
  };
  P.baseCost = function (c) { return c.kind === 'joker' ? J[c.key].cost : c.kind === 'voucher' ? 10 : c.kind === 'pack' ? D.PACK[c.key].cost : c.kind === 'spectral' ? 4 : c.kind === 'playing' ? 1 : 3; };
  P.cost = function (c) {
    if (c.free || c.kind === 'planet' && this.has('astronomer') || c.kind === 'pack' && D.PACK[c.key].type === 'celestial' && this.has('astronomer')) return 0;
    if (c.rental) return 1;
    return Math.max(1, Math.floor((this.baseCost(c) + (c.edition ? D.EDITION[c.edition].cost : 0) + 0.5) * (100 - this.run.discount) / 100));
  };
  P.sellValue = function (c) { return Math.max(1, Math.floor(this.cost(c) / 2)) + (c.extraValue || 0); };
  P.afford = function (n) { return this.run.money - n >= (this.has('credit_card') ? -20 : 0); };
  P.randomVoucher = function () {
    var r = this.run, pool = D.VOUCHERS.filter(function (v) { return !r.vouchers[v.key] && (!v.req || r.vouchers[v.req]); });
    return pool.length ? this.rng.pick(pool).key : null;
  };
  P.redeemVoucher = function (key) {
    var r = this.run; if (!D.VOUCHER[key] || r.vouchers[key]) return;
    r.vouchers[key] = true;
    switch (key) {
      case 'overstock': case 'overstock_plus': r.shopSlots++; break;
      case 'clearance': r.discount = 25; break;
      case 'liquidation': r.discount = 50; break;
      case 'hone': r.editionRate = 2; break;
      case 'glow_up': r.editionRate = 4; break;
      case 'reroll_surplus': case 'reroll_glut': r.rerollBase -= 2; break;
      case 'crystal_ball': r.base.consSlots++; break;
      case 'grabber': case 'nacho_tong': r.base.hands++; break;
      case 'wasteful': case 'recyclomancy': r.base.discards++; break;
      case 'tarot_merchant': r.rates.tarot *= 2; break;
      case 'tarot_tycoon': r.rates.tarot *= 2; break;
      case 'planet_merchant': r.rates.planet *= 2; break;
      case 'planet_tycoon': r.rates.planet *= 2; break;
      case 'seed_money': r.interestCap = 50; break;
      case 'money_tree': r.interestCap = 100; break;
      case 'antimatter': r.base.jokerSlots++; break;
      case 'magic_trick': r.rates.playing = 4; break;
      case 'hieroglyph': r.ante--; r.base.hands--; break;
      case 'petroglyph': r.ante--; r.base.discards--; break;
      case 'paint_brush': case 'palette': r.base.handSize++; break;
    }
    this.emit('voucher', { key: key });
  };
  P.shopCard = function () {
    var g = this, r = this.run, t = r.tags.find(function (t) { return t.key === 'uncommon' || t.key === 'rare'; }), c;
    if (t) { c = this.createJoker({ area: 'shop', rarity: t.key === 'rare' ? 3 : 2, stickers: true }); c.free = true; r.tags.splice(r.tags.indexOf(t), 1); }
    else {
      var kind = this.rng.weighted(Object.keys(r.rates).map(function (k) { return { key: k, w: r.rates[k] }; })).key;
      if (kind === 'joker') c = this.createJoker({ area: 'shop', stickers: true });
      else if (kind === 'playing') {
        c = this.newPlayingCard(this.rng.pick(D.SUITS), this.rng.pick(D.RANKS));
        if (r.vouchers.illusion) { if (this.rng.next() < 0.4) c.enh = this.rng.pick(D.ENH_KEYS); if (this.rng.next() < 0.2) c.edition = this.pollEdition(1, true, true); }
      } else c = this.createConsumable(kind, { area: 'shop' });
    }
    if (c.kind === 'joker' && !c.edition) {
      t = r.tags.find(function (t) { return ['negative', 'foil', 'holo', 'poly'].indexOf(t.key) >= 0; });
      if (t) { c.edition = t.key; c.free = true; r.tags.splice(r.tags.indexOf(t), 1); }
    }
    return c;
  };
  P.openShop = function () {
    var r = this.run, g = this; r.phase = 'shop'; r.hand = []; r.play = []; r.draw = []; r.discard = [];
    r.shop = { cards: [], packs: [], vouchers: [], rerollInc: 0, chaosUsed: [], d6: false };
    r.tags = r.tags.filter(function (t) { if (t.key === 'd6') { r.shop.d6 = true; return false; } return true; });
    for (var i = 0; i < r.shopSlots; i++) r.shop.cards.push(this.shopCard());
    for (i = 0; i < 2; i++) {
      var key = !r.flags.firstShop && i === 0 ? 'buffoon_normal' : this.rng.weighted(D.PACKS).key;
      r.shop.packs.push({ id: r.nextId++, kind: 'pack', key: key });
    }
    r.flags.firstShop = true;
    if (r.voucherKey && !r.vouchers[r.voucherKey]) r.shop.vouchers.push({ id: r.nextId++, kind: 'voucher', key: r.voucherKey });
    r.tags = r.tags.filter(function (t) {
      if (t.key === 'voucher') {
        var key = g.randomVoucher(), existing = r.shop.vouchers.map(function (v) { return v.key; });
        var pool = D.VOUCHERS.filter(function (v) { return !r.vouchers[v.key] && (!v.req || r.vouchers[v.req]) && existing.indexOf(v.key) < 0; });
        if (pool.length) key = g.rng.pick(pool).key;
        if (key && existing.indexOf(key) < 0) r.shop.vouchers.push({ id: r.nextId++, kind: 'voucher', key: key });
        return false;
      } return true;
    });
    var coupon = r.tags.some(function (t) { return t.key === 'coupon'; });
    if (coupon) { r.shop.cards.concat(r.shop.packs).forEach(function (c) { c.free = true; }); r.tags = r.tags.filter(function (t) { return t.key !== 'coupon'; }); }
    this.zones();
  };
  P.rerollCost = function () {
    var r = this.run; if (!r.shop) return 0;
    if (r.jokers.some(function (j) { return j.key === 'chaos_the_clown' && !j.debuff && r.shop.chaosUsed.indexOf(j.id) < 0; })) return 0;
    return Math.max(0, (r.shop.d6 ? 0 : r.rerollBase) + r.shop.rerollInc);
  };
  P.reroll = function () {
    var r = this.run; if (r.phase !== 'shop' || !this.afford(this.rerollCost())) return false;
    this.begin(); this.addMoney(-this.rerollCost());
    var chaos = r.jokers.find(function (j) { return j.key === 'chaos_the_clown' && !j.debuff && r.shop.chaosUsed.indexOf(j.id) < 0; });
    if (chaos) r.shop.chaosUsed.push(chaos.id); else r.shop.rerollInc++;
    r.shop.cards = []; for (var i = 0; i < r.shopSlots; i++) r.shop.cards.push(this.shopCard());
    this.context({ type: 'reroll_shop' }); return this.finish();
  };
  P.buy = function (id) {
    var r = this.run; if (r.phase !== 'shop') return false;
    var zone = ['cards', 'packs', 'vouchers'].find(function (z) { return r.shop[z].some(function (c) { return c.id === id; }); });
    if (!zone) return false; var c = r.shop[zone].find(function (c) { return c.id === id; }), cost = this.cost(c);
    if (!this.afford(cost) || c.kind === 'joker' && !this.jokerRoom() && c.edition !== 'negative' || ['tarot', 'planet', 'spectral'].indexOf(c.kind) >= 0 && !this.consRoom() && c.edition !== 'negative') return false;
    this.begin(); this.addMoney(-cost); r.shop[zone].splice(r.shop[zone].indexOf(c), 1);
    if (c.kind === 'joker') this.ownJoker(c);
    else if (c.kind === 'voucher') { this.redeemVoucher(c.key); while (r.shop.cards.length < r.shopSlots) r.shop.cards.push(this.shopCard()); }
    else if (c.kind === 'pack') this.openPack(c.key, 'shop');
    else if (c.kind === 'playing') this.addPlayingCards([c]);
    else r.cons.push(c);
    this.zones(); return this.finish();
  };
  P.sell = function (id) {
    var r = this.run; if (['round', 'shop', 'blind_select', 'pack'].indexOf(r.phase) < 0) return false;
    var c = r.jokers.concat(r.cons).find(function (c) { return c.id === id; }); if (!c || c.eternal) return false;
    this.begin(); var value = this.sellValue(c); this.context({ type: 'selling_card', card: c });
    if (c.kind === 'joker') {
      this.effect(this.calc(c, { type: 'selling_self' }), c, {});
      if (this.bossActive('verdant_leaf')) r.blind.leafSold = true;
      this.destroyJoker(c);
    } else r.cons.splice(r.cons.indexOf(c), 1);
    this.addMoney(value, c); this.zones(); return this.finish();
  };
  P.leaveShop = function () {
    if (this.run.phase !== 'shop') return false; this.begin(); this.context({ type: 'ending_shop' });
    this.run.shop = null; this.run.phase = 'blind_select'; this.processBlindTags(); return this.finish();
  };
  P.rerollBoss = function () {
    var r = this.run; if (r.phase !== 'blind_select' || !r.vouchers.directors_cut || r.bossRerolled && !r.vouchers.retcon || !this.afford(10)) return false;
    this.begin(); this.addMoney(-10); r.blinds.boss.key = this.pickBoss(); r.bossRerolled = true; return this.finish();
  };
  P.openPack = function (key, returnTo) {
    var r = this.run, def = D.PACK[key];
    r.pack = { key: key, cards: [], choose: def.choose, returnTo: returnTo || 'shop' }; r.phase = 'pack';
    if (def.type === 'arcana' || def.type === 'spectral') { r.draw = this.rng.shuffle(r.deck.slice()); r.hand = []; this.drawCards(true); }
    for (var i = 0; i < def.n; i++) {
      var c;
      if (def.type === 'buffoon') c = this.createJoker({ area: 'pack', stickers: true });
      else if (def.type === 'standard') {
        c = this.newPlayingCard(this.rng.pick(D.SUITS), this.rng.pick(D.RANKS));
        if (this.rng.next() < 0.4) c.enh = this.rng.pick(D.ENH_KEYS);
        c.edition = this.pollEdition(2, false, true); if (this.rng.next() < 0.2) c.seal = this.rng.pick(['red', 'blue', 'gold', 'purple']);
      } else {
        var kind = def.type === 'celestial' ? 'planet' : def.type === 'spectral' ? 'spectral' : 'tarot', forced;
        if (kind === 'tarot' && r.vouchers.omen_globe && this.rng.next() < 0.2) kind = 'spectral';
        if (def.type === 'celestial' && i === 0 && r.vouchers.telescope) { var hand = this.mostPlayed(); forced = D.PLANETS.find(function (p) { return p.hand === hand; }).key; }
        c = this.createConsumable(kind, { key: forced, area: 'pack', soulable: true });
      }
      r.pack.cards.push(c);
    }
    this.context({ type: 'open_booster' }); this.zones(); this.emit('pack', { key: key });
  };
  P.choosePack = function (id, ids) {
    var r = this.run; if (r.phase !== 'pack') return false;
    var c = r.pack.cards.find(function (c) { return c.id === id; }); if (!c) return false;
    if (c.kind === 'joker' && !this.jokerRoom() && c.edition !== 'negative') return false;
    if (['tarot', 'planet', 'spectral'].indexOf(c.kind) >= 0 && !this.canUse(c, ids || [], true)) return false;
    this.begin(); r.pack.cards.splice(r.pack.cards.indexOf(c), 1);
    if (c.kind === 'joker') this.ownJoker(c);
    else if (c.kind === 'playing') this.addPlayingCards([c]);
    else this.consume(c, ids || []);
    r.pack.choose--; if (r.pack.choose <= 0 || !r.pack.cards.length) this.closePack(); this.zones(); return this.finish();
  };
  P.closePack = function () {
    var r = this.run, returnTo = r.pack.returnTo; r.pack = null; r.hand = []; r.draw = []; r.phase = returnTo;
    if (returnTo === 'blind_select') this.processBlindTags();
  };
  P.skipPack = function () { if (this.run.phase !== 'pack') return false; this.begin(); this.context({ type: 'skipping_booster' }); this.closePack(); return this.finish(); };
  P.canUse = function (c, ids, fromPack) {
    var r = this.run; if (['round', 'shop', 'blind_select', 'pack'].indexOf(r.phase) < 0) return false;
    var def = c.kind === 'planet' ? D.PLANET[c.key] : c.kind === 'tarot' ? D.TAROT[c.key] : D.SPECTRAL[c.key]; if (!def) return false;
    var selected = this.selected(ids || []), room = this.consRoom() + (!fromPack && c.edition !== 'negative' ? 1 : 0);
    if (def.max) return selected.length >= (def.min || 1) && selected.length <= def.max && (c.key !== 'aura' || !selected[0].edition);
    switch (c.key) {
      case 'fool': return !!r.lastTarotPlanet && room > 0;
      case 'high_priestess': case 'emperor': return room > 0;
      case 'judgement': case 'wraith': case 'soul': return this.jokerRoom() > 0;
      case 'wheel': case 'hex': case 'ectoplasm': return r.jokers.some(function (j) { return !j.edition; });
      case 'ankh': return r.jokers.length > 0 && (this.jokerRoom() > 0 || r.jokers.some(function (j) { return !j.eternal; }));
      case 'familiar': case 'grim': case 'incantation': case 'sigil': case 'ouija': return r.hand.length > 0;
      case 'immolate': return r.hand.length > 1;
      default: return true;
    }
  };
  P.use = function (id, ids) {
    var r = this.run, c = r.cons.find(function (c) { return c.id === id; }); if (!c || !this.canUse(c, ids || [], false)) return false;
    this.begin(); r.cons.splice(r.cons.indexOf(c), 1); this.consume(c, ids || []); this.zones(); return this.finish();
  };
  P.consume = function (c, ids) {
    var r = this.run, g = this, selected = this.selected(ids), def = c.kind === 'planet' ? D.PLANET[c.key] : c.kind === 'tarot' ? D.TAROT[c.key] : D.SPECTRAL[c.key];
    if (c.kind === 'planet') { this.levelHand(def.hand, 1, c); r.stats.planets[c.key] = (r.stats.planets[c.key] || 0) + 1; }
    else if (def.enh) selected.forEach(function (card) { card.enh = def.enh; g.logEnhance(card); });
    else if (def.suit) selected.forEach(function (card) { card.suit = def.suit; g.logEnhance(card); });
    else if (def.seal) { selected[0].seal = def.seal; this.logEnhance(selected[0]); }
    else {
      var pool, j, k, cards;
      switch (c.key) {
        case 'fool': this.createConsumable(r.lastTarotPlanet.kind, { key: r.lastTarotPlanet.key }); break;
        case 'high_priestess': case 'emperor': for (k = 0; k < 2 && this.consRoom(); k++) this.createConsumable(c.key === 'emperor' ? 'tarot' : 'planet'); break;
        case 'hermit': this.addMoney(Math.min(20, Math.max(0, r.money)), c); break;
        case 'temperance': this.addMoney(Math.min(50, r.jokers.reduce(function (sum, j) { return sum + g.sellValue(j); }, 0)), c); break;
        case 'wheel':
          pool = r.jokers.filter(function (j) { return !j.edition; });
          if (pool.length && this.chance(4)) { j = this.rng.pick(pool); j.edition = this.pollEdition(1, true, true); this.logEnhance(j); }
          else this.emit('message', { text: '没有！', color: 'tarot', src: c.id }); break;
        case 'strength': selected.forEach(function (card) { card.rank = card.rank === 14 ? 2 : card.rank + 1; g.logEnhance(card); }); break;
        case 'hanged_man': this.removePlayingCards(selected); break;
        case 'death':
          var target = selected[1], left = selected[0], id = left.id, played = left.playedAnte;
          Object.keys(left).forEach(function (k) { delete left[k]; }); Object.assign(left, U.clone(target), { id: id, playedAnte: played, forced: false }); this.logEnhance(left); break;
        case 'judgement': this.createJoker(); break;
        case 'aura': selected[0].edition = this.pollEdition(1, true, true); this.logEnhance(selected[0]); break;
        case 'wraith': case 'soul': this.createJoker({ rarity: c.key === 'soul' ? 4 : 3 }); if (c.key === 'wraith') this.addMoney(-r.money); break;
        case 'sigil': k = this.rng.pick(D.SUITS); r.hand.forEach(function (card) { card.suit = k; g.logEnhance(card); }); break;
        case 'ouija': k = this.rng.pick(D.RANKS); r.hand.forEach(function (card) { card.rank = k; g.logEnhance(card); }); r.mods.handSize--; break;
        case 'ectoplasm': j = this.rng.pick(r.jokers.filter(function (j) { return !j.edition; })); j.edition = 'negative'; r.mods.ecto++; r.mods.handSize -= r.mods.ecto; this.logEnhance(j); break;
        case 'immolate': cards = this.rng.shuffle(r.hand.slice()).slice(0, 5); this.removePlayingCards(cards, false); this.addMoney(20, c); break;
        case 'ankh':
          j = this.rng.pick(r.jokers); r.jokers.slice().forEach(function (other) { if (other !== j) g.destroyJoker(other); });
          if (this.jokerRoom()) this.copyJoker(j, true); break;
        case 'hex':
          j = this.rng.pick(r.jokers.filter(function (j) { return !j.edition; })); j.edition = 'poly'; this.logEnhance(j);
          r.jokers.slice().forEach(function (other) { if (other !== j) g.destroyJoker(other); }); break;
        case 'cryptid': this.addPlayingCards([this.copyPlayingCard(selected[0]), this.copyPlayingCard(selected[0])], 'hand'); break;
        case 'black_hole': D.HANDS.forEach(function (h) { g.levelHand(h.key, 1, c); }); break;
        case 'familiar': case 'grim': case 'incantation':
          this.removePlayingCards([this.rng.pick(r.hand)]); cards = [];
          var n = c.key === 'familiar' ? 3 : c.key === 'grim' ? 2 : 4;
          for (k = 0; k < n; k++) cards.push(this.newPlayingCard(this.rng.pick(D.SUITS), c.key === 'grim' ? 14 : c.key === 'familiar' ? this.randInt(11, 13) : this.randInt(2, 10), { enh: this.rng.pick(D.ENH_KEYS.filter(function (e) { return e !== 'stone'; })) }));
          this.addPlayingCards(cards, 'hand'); break;
      }
    }
    if (c.kind === 'tarot') r.stats.tarotsUsed++;
    if ((c.kind === 'tarot' || c.kind === 'planet') && c.key !== 'fool') r.lastTarotPlanet = { kind: c.kind, key: c.key };
    this.context({ type: 'using_consumable', cons: c }); this.emit('use', { key: c.key, src: c.id });
    if (r.phase === 'round' && !r.hand.length) { this.drawCards(false); if (!r.hand.length) this.endRound(); }
  };
  P.randomTag = function () {
    var r = this.run, def = this.rng.pick(D.TAGS.filter(function (t) { return t.ante <= r.ante; }));
    return { key: def.key, hand: def.key === 'orbital' ? this.randomVisibleHand() : null };
  };
  P.addTag = function (key, opts) {
    var r = this.run, g = this, n = 1;
    if (key !== 'double') r.tags = r.tags.filter(function (t) { if (t.key === 'double') { n++; return false; } return true; });
    for (var i = 0; i < n; i++) {
      var tag = { id: r.nextId++, key: key, hand: opts && opts.hand || (key === 'orbital' ? this.randomVisibleHand() : null) };
      switch (key) {
        case 'economy': this.addMoney(Math.min(40, Math.max(0, r.money))); break;
        case 'handy': this.addMoney(r.stats.handsPlayed); break;
        case 'garbage': this.addMoney(r.stats.unusedDiscards); break;
        case 'speed': this.addMoney(r.stats.skips * 5); break;
        case 'topup': for (var j = 0; j < 2 && this.jokerRoom(); j++) this.createJoker({ rarity: 1 }); break;
        case 'orbital': this.levelHand(tag.hand, 3); break;
        default: r.tags.push(tag);
      }
      this.emit('tag', { key: key });
    }
  };
  P.processBlindTags = function () {
    var r = this.run;
    var packKeys = { standard: 'standard_mega', charm: 'arcana_mega', meteor: 'celestial_mega', buffoon: 'buffoon_mega', ethereal: 'spectral_normal' };
    while (r.phase === 'blind_select') {
      var t = r.tags.find(function (t) { return t.key === 'boss' || packKeys[t.key]; }); if (!t) break;
      r.tags.splice(r.tags.indexOf(t), 1);
      if (t.key === 'boss') r.blinds.boss.key = this.pickBoss(); else this.openPack(packKeys[t.key], 'blind_select');
    }
  };
})(window.BT);
