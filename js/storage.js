/* 存档边界：本地持久化、校验与可移植备份。云 Provider 默认禁用，不发起网络请求。 */
(function (BT) {
  'use strict';
  var D = BT.Data, U = BT.Utils, KEY = 'bt-run-v1', MAX_BYTES = 2 * 1024 * 1024;
  var state = { local: 'ready', cloud: 'disabled' }, provider = null;
  function record(o) { return !!o && typeof o === 'object' && !Array.isArray(o); }
  function finite(n) { return typeof n === 'number' && Number.isFinite(n); }
  function count(n) { return Number.isSafeInteger(n) && n >= 0; }
  function known(table, key) { return (typeof key === 'string' || typeof key === 'number') && Object.prototype.hasOwnProperty.call(table, key); }
  function score(n) { return n === '__Infinity__' || typeof n === 'number' && n >= 0 && !Number.isNaN(n); }
  function cleanTree(o, depth) {
    if (depth > 16) return false;
    if (o === null || typeof o === 'boolean' || typeof o === 'number') return true;
    if (typeof o === 'string') return o.length <= 1024;
    if (Array.isArray(o)) return o.length <= 10000 && o.every(function (v) { return cleanTree(v, depth + 1); });
    if (!record(o)) return false;
    return Object.keys(o).length <= 10000 && Object.keys(o).every(function (k) { return ['__proto__', 'prototype', 'constructor'].indexOf(k) < 0 && cleanTree(o[k], depth + 1); });
  }
  function validate(r) {
    try {
      if (!record(r) || r.version !== 1 || !cleanTree(r, 0) || JSON.stringify(r).length > MAX_BYTES) return false;
      if (!known(D.DECK, r.deckKey) || !Number.isInteger(r.stake) || r.stake < 1 || r.stake > 8 || !Number.isInteger(r.ante) || !count(r.roundNumber) || !finite(r.money) || typeof r.seed !== 'string' || r.seed.length > 64) return false;
      if (['blind_select', 'round', 'cash_out', 'shop', 'pack', 'game_over', 'won'].indexOf(r.phase) < 0 || !count(r.rng) || r.rng > 0xffffffff || !count(r.nextId) || !count(r.startDeckSize)) return false;
      if (!record(r.base) || !record(r.mods) || !record(r.rates) || !record(r.round) || !record(r.stats) || !record(r.flags) || !record(r.vouchers) || !record(r.hands) || !record(r.current) || !record(r.bossUsed)) return false;
      if (!Object.keys(r.bossUsed).every(function (k) { return known(D.BOSS, k) && count(r.bossUsed[k]); })) return false;
      var scalars = ['editionRate', 'discount', 'rerollBase', 'shopSlots', 'interestCap'];
      if (!scalars.every(function (k) { return finite(r[k]); }) || !count(r.shopSlots) || r.shopSlots > 10000 || r.discount < 0 || r.discount > 100) return false;
      if (!['hands', 'discards', 'handSize', 'jokerSlots', 'consSlots'].every(function (k) { return finite(r.base[k]); }) || !['handSize', 'ecto', 'juggle'].every(function (k) { return finite(r.mods[k]); })) return false;
      if (!['joker', 'tarot', 'planet', 'playing', 'spectral'].every(function (k) { return finite(r.rates[k]) && r.rates[k] >= 0; }) || Object.values(r.rates).reduce(function (a, b) { return a + b; }, 0) <= 0) return false;
      if (!D.HANDS.every(function (h) { var s = r.hands[h.key]; return record(s) && count(s.level) && s.level >= 1 && finite(s.chips) && finite(s.mult) && count(s.played) && count(s.playedRound) && typeof s.visible === 'boolean'; })) return false;
      if (!finite(r.round.handsLeft) || !count(r.round.discardsLeft) || !count(r.round.handsPlayed) || !count(r.round.discardsUsed) || !score(r.round.chips)) return false;
      if (!['handsPlayed', 'tarotsUsed', 'skips', 'unusedDiscards'].every(function (k) { return count(r.stats[k]); }) || !score(r.stats.best) || !record(r.stats.planets) || !Object.keys(r.stats.planets).every(function (k) { return known(D.PLANET, k) && count(r.stats.planets[k]); })) return false;
      if (!Object.keys(r.vouchers).every(function (k) { return known(D.VOUCHER, k) && r.vouchers[k] === true; }) || !Object.keys(r.flags).every(function (k) { return typeof r.flags[k] === 'boolean'; })) return false;
      if (!known(D.HAND, r.lastHand) || r.lastTarotPlanet && !(r.lastTarotPlanet.kind === 'tarot' ? known(D.TAROT, r.lastTarotPlanet.key) : r.lastTarotPlanet.kind === 'planet' && known(D.PLANET, r.lastTarotPlanet.key))) return false;
      if (!known(D.HAND, r.current.oxHand) || !known(D.RANK_LABEL, r.current.mailRank) || !record(r.current.idol) || !known(D.RANK_LABEL, r.current.idol.rank) || !known(D.SUIT, r.current.idol.suit) || !known(D.SUIT, r.current.castleSuit) || !known(D.SUIT, r.current.ancientSuit)) return false;
      if (!record(r.blinds) || !['small', 'big', 'boss'].every(function (k) { return record(r.blinds[k]) && ['next', 'locked', 'skipped', 'defeated'].indexOf(r.blinds[k].state) >= 0; }) || !known(D.BOSS, r.blinds.boss.key)) return false;
      if (!['small', 'big'].every(function (k) { var t = r.blinds[k].tag; return record(t) && known(D.TAG, t.key) && (!t.hand || known(D.HAND, t.hand)); })) return false;
      if (r.voucherKey && !known(D.VOUCHER, r.voucherKey)) return false;
      if (r.blind && (!record(r.blind) || !known(D.BLINDS, r.blind.type) && r.blind.type !== 'boss' || r.blind.type === 'boss' && !known(D.BOSS, r.blind.key) || !score(r.blind.chips) || !finite(r.blind.dollars) || !record(r.blind.seen) || !Object.keys(r.blind.seen).every(function (k) { return known(D.HAND, k) && typeof r.blind.seen[k] === 'boolean'; }) || r.blind.mouth && !known(D.HAND, r.blind.mouth) || !known(D.HAND, r.blind.oxHand))) return false;
      if (r.phase === 'round' && !r.blind) return false;
      var ids = new Set(), deckIds = new Set();
      function card(c, kind) {
        if (!record(c) || !count(c.id) || c.id < 1 || c.id >= r.nextId || ids.has(c.id) || c.kind !== kind || c.edition && !known(D.EDITION, c.edition)) return false;
        ids.add(c.id);
        if (!['flipped', 'debuff', 'eternal', 'perishable', 'rental', 'forced', 'playedAnte'].every(function (k) { return c[k] === undefined || typeof c[k] === 'boolean'; }) || c.perishable && !count(c.perishLeft)) return false;
        if (kind === 'playing') return known(D.SUIT, c.suit) && known(D.RANK_LABEL, c.rank) && (!c.enh || known(D.ENH, c.enh)) && (!c.seal || known(D.SEAL, c.seal)) && finite(c.perma);
        if (kind === 'joker') return known(BT.Jokers.BY, c.key) && record(c.ab) && Object.keys(c.ab).every(function (k) { return finite(c.ab[k]) || k === 'hand' && known(D.HAND, c.ab[k]); }) && finite(c.extraValue);
        if (kind === 'pack') return known(D.PACK, c.key);
        if (kind === 'voucher') return known(D.VOUCHER, c.key);
        var table = kind === 'tarot' ? D.TAROT : kind === 'planet' ? D.PLANET : kind === 'spectral' ? D.SPECTRAL : null;
        return !!table && known(table, c.key) && finite(c.extraValue);
      }
      if (!Array.isArray(r.deck) || !r.deck.every(function (c) { if (!card(c, 'playing')) return false; deckIds.add(c.id); return true; })) return false;
      if (!Array.isArray(r.jokers) || !r.jokers.every(function (c) { return card(c, 'joker'); }) || !Array.isArray(r.cons) || !r.cons.every(function (c) { return ['tarot', 'planet', 'spectral'].indexOf(c.kind) >= 0 && card(c, c.kind); })) return false;
      var zones = new Set();
      if (!['hand', 'draw', 'play', 'discard'].every(function (z) { return Array.isArray(r[z]) && r[z].every(function (id) { if (!deckIds.has(id) || zones.has(id)) return false; zones.add(id); return true; }); })) return false;
      if (!Array.isArray(r.tags) || !r.tags.every(function (t) { return record(t) && known(D.TAG, t.key) && (!t.hand || known(D.HAND, t.hand)); })) return false;
      if (r.shop && (!record(r.shop) || !['cards', 'packs', 'vouchers'].every(function (z) { return Array.isArray(r.shop[z]) && r.shop[z].every(function (c) { return card(c, c.kind); }); }) || !count(r.shop.rerollInc) || !Array.isArray(r.shop.chaosUsed))) return false;
      if (r.pack && (!record(r.pack) || !known(D.PACK, r.pack.key) || !Array.isArray(r.pack.cards) || !r.pack.cards.every(function (c) { return card(c, c.kind); }) || !count(r.pack.choose) || ['shop', 'blind_select'].indexOf(r.pack.returnTo) < 0)) return false;
      if (r.phase === 'shop' && !r.shop || r.phase === 'pack' && !r.pack) return false;
      if (r.cash && (!record(r.cash) || !finite(r.cash.total) || !Array.isArray(r.cash.rows) || !r.cash.rows.every(function (row) { return record(row) && typeof row.label === 'string' && finite(row.amount); }))) return false;
      if (r.phase === 'cash_out' && !r.cash) return false;
      return true;
    } catch (e) { return false; }
  }
  function save(r) {
    try { window.localStorage.setItem(KEY, JSON.stringify(r)); state.local = 'ready'; return true; }
    catch (e) { state.local = 'unavailable'; return false; }
  }
  function load() { return U.load(KEY, null); }
  function exportRun(r) { if (!validate(r)) throw new Error('当前存档无法导出'); return JSON.stringify({ format: 'BalaBalaTro', version: 1, savedAt: new Date().toISOString(), run: r }, null, 2); }
  function importRun(text) {
    if (typeof text !== 'string' || text.length > MAX_BYTES) throw new Error('存档文件过大，限制为 2 MB');
    var file; try { file = JSON.parse(text); } catch (e) { throw new Error('不是有效的 JSON 存档'); }
    if (!record(file) || file.format !== 'BalaBalaTro' || file.version !== 1 || !validate(file.run)) throw new Error('存档内容损坏或版本不兼容');
    return file.run;
  }
  /* 未来由外部托管服务实现 save/load。注册不启用同步，必须由明确的用户动作调用。 */
  function registerProvider(p) { if (!p || typeof p.save !== 'function' || typeof p.load !== 'function') throw new Error('无效的存档 Provider'); provider = p; state.cloud = 'available'; }
  async function push(r) { if (!provider) throw new Error('未连接云存档服务'); if (!validate(r)) throw new Error('无效存档'); return provider.save(U.clone(r)); }
  async function pull() { if (!provider) throw new Error('未连接云存档服务'); var r = await provider.load(); if (!validate(r)) throw new Error('云存档无效'); return r; }
  BT.Storage = { validate: validate, save: save, load: load, exportRun: exportRun, importRun: importRun, registerProvider: registerProvider, push: push, pull: pull, status: function () { return Object.assign({}, state); } };
})(window.BT);
