/* 无浏览器的前端契约测试：布局边界、存档防损坏、音频计时器/静音/后台生命周期。 */
'use strict';
var assert = require('node:assert/strict'), H = require('./harness'), BT = H.BT, fs = require('node:fs'), vm = require('node:vm'), path = require('node:path');
var tests = 0;
function test(name, fn) { fn(); tests++; }
function mockAudio() {
  var timers = new Map(), timerId = 0, created = [], s = new Map();
  function param() { return { value: 0, setValueAtTime: function () {}, linearRampToValueAtTime: function () {}, exponentialRampToValueAtTime: function () {}, setTargetAtTime: function () {} }; }
  function node() { return { gain: param(), frequency: param(), detune: param(), delayTime: param(), connect: function () {}, disconnect: function () {}, start: function () { created.push(this); }, stop: function () {} }; }
  function Context() { this.state = 'running'; this.currentTime = 0; this.sampleRate = 1000; this.destination = node(); }
  Context.prototype.createGain = node; Context.prototype.createOscillator = node; Context.prototype.createBiquadFilter = node; Context.prototype.createDelay = node; Context.prototype.createDynamicsCompressor = node; Context.prototype.createBufferSource = node;
  Context.prototype.createBuffer = function (a, n) { return { getChannelData: function () { return new Float32Array(n); } }; };
  Context.prototype.suspend = function () { this.state = 'suspended'; return Promise.resolve(); }; Context.prototype.resume = function () { this.state = 'running'; return Promise.resolve(); };
  var window = { AudioContext: Context, localStorage: { getItem: function (k) { return s.get(k) || null; }, setItem: function (k, v) { s.set(k, v); } } };
  var sandbox = vm.createContext({ window: window, console: console, setInterval: function (fn) { var id = ++timerId; timers.set(id, fn); return id; }, clearInterval: function (id) { timers.delete(id); } });
  ['utils', 'audio'].forEach(function (name) { vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/' + name + '.js'), 'utf8'), sandbox); });
  return { audio: window.BT.Audio, timers: timers, created: created };
}
[320, 360, 390, 430, 600, 768, 844, 1024, 1440].forEach(function (w) {
  ['blind_select', 'round', 'shop', 'pack', 'cash_out'].forEach(function (phase) {
    test('布局 ' + w + ' / ' + phase, function () {
      var g = H.game(); g.selectBlind('small');
      if (phase === 'shop') g.openShop(); else if (phase === 'pack') g.openPack('arcana_mega', 'blind_select'); else if (phase === 'cash_out') { g.run.round.chips = g.run.blind.chips; g.endRound(); } else g.run.phase = phase;
      var l = BT.Layout.compute(w, 844, g.run), p = BT.Layout.positions(g.run, l, g.jokerSlots(), g.consSlots());
      Object.values(p).forEach(function (c) { assert.ok(c.x >= 0 && c.x + c.w <= l.width, '横向越界'); assert.ok(c.y >= 0 && c.y + c.w * 1.4 <= l.height, '纵向越界'); });
    });
  });
});
[350, 390, 440].forEach(function (h) { test('iPhone 横屏 ' + h + ' 高度内放下牌桌', function () { var g=H.round(H.game()), l=BT.Layout.compute(838,h-21,g.run), p=BT.Layout.positions(g.run,l,g.jokerSlots(),g.consSlots()); assert.equal(l.mode,'landscape'); assert.equal(l.height,h-21); Object.values(p).forEach(function (c) { assert.ok(c.x>=0 && c.x+c.w<=l.width); assert.ok(c.y>=0 && c.y+c.w*1.4<=l.height-l.actionsHeight); }); }); });
test('导出导入往返保持对象身份与随机数状态', function () {
  var g = H.round(H.game()), data = g.serialize(), backup = BT.Storage.exportRun(data), restored = new BT.Game();
  assert.equal(BT.Storage.status().cloud, 'disabled'); assert.ok(restored.restore(BT.Storage.importRun(backup)));
  assert.equal(restored.run.hand[0], restored.run.deck.find(function (c) { return c.id === restored.run.hand[0].id; })); assert.equal(restored.rng.next(), g.rng.next());
});
test('损坏存档与重复区域不能替换当前状态', function () {
  var g = H.round(H.game()), before = JSON.stringify(g.serialize());
  var cases = [function (r) { r.money = '<img src=x onerror=alert(1)>'; }, function (r) { r.hand.push(r.hand[0]); }, function (r) { r.deck[0].suit = 'Z'; }, function (r) { r.current = null; }, function (r) { r.stats.planets = null; }, function (r) { r.jokers.push({ id: 9000, kind: 'joker', key: 'not_exist', ab: {} }); }, function (r) { r.shop = { cards: [] }; }, function (r) { r.phase = '<script>'; }, function (r) { r.seed = 'x'.repeat(10000); }, function (r) { r.deck[0].suit = 'toString'; }, function (r) { r.blind.seen = null; }, function (r) { r.shopSlots = 1e30; }, function (r) { r.current.idol.suit = 'constructor'; }, function (r) { r.bossUsed = null; }, function (r) { r.bossUsed = { hook: -1 }; }, function (r) { r.bossUsed = { not_a_boss: 1 }; }];
  cases.forEach(function (mutate) { var r = JSON.parse(before); mutate(r); assert.equal(g.restore(r), false); assert.equal(JSON.stringify(g.serialize()), before); });
  assert.throws(function () { BT.Storage.importRun('{bad}'); }); assert.throws(function () { BT.Storage.importRun('x'.repeat(3 * 1024 * 1024)); });
  assert.throws(function () { BT.Storage.importRun('{"format":"BalaBalaTro","version":1,"run":{"__proto__":{}}}'); });
});
test('无尽 Infinity 分数可备份恢复', function () { var g = H.round(H.game()); g.run.round.chips = Infinity; g.run.stats.best = Infinity; g.run.blind.chips = Infinity; var text = BT.Storage.exportRun(g.serialize()), restored = new BT.Game(); assert.ok(restored.restore(BT.Storage.importRun(text))); assert.equal(restored.run.stats.best, Infinity); });
test('所有牌组合法存档', function () { BT.Data.DECKS.forEach(function (d) { var g = H.game(d.key, 8); assert.ok(BT.Storage.validate(g.serialize()), d.key); g.selectBlind('small'); assert.ok(BT.Storage.validate(g.serialize()), d.key + ' round'); }); });
test('音乐首次交互开始且不重复计时器', function () { var m = mockAudio(), a = m.audio; assert.equal(a.status().unlocked, false); assert.equal(a.isMusicOn(), true); a.unlock(); a.unlock(); a.unlock(); assert.equal(m.timers.size, 1); assert.ok(m.created.length > 0); });
test('音乐与音效独立，暂停释放计时器', function () { var m = mockAudio(), a = m.audio; a.unlock(); a.toggle(); assert.equal(a.isMuted(), true); assert.equal(m.timers.size, 1); a.toggleMusic(); assert.equal(m.timers.size, 0); assert.equal(a.isMuted(), true); a.toggle(); var n = m.created.length; a.play('score'); assert.ok(m.created.length > n); a.toggleMusic(); assert.equal(m.timers.size, 1); a.pause(); assert.equal(m.timers.size, 0); assert.equal(a.status().running, false); a.setVolume(-10); assert.equal(a.getVolume(), 0); a.setVolume(100); assert.equal(a.getVolume(), 1); });
console.log('前端契约测试：' + tests + ' 项通过。');
