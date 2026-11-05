/* 启动、自适应缩放、后台降耗与可复现视觉验收场景。 */
(function (BT) {
  'use strict';
  var g = new BT.Game(), ui = new BT.UI(g); BT.app = { game: g, ui: ui };
  var resizeTimer;
  window.addEventListener('resize', function () { clearTimeout(resizeTimer); resizeTimer = setTimeout(function () { ui.reflow(); last = -1; }, 80); });
  if (window.visualViewport) window.visualViewport.addEventListener('resize', function () { last = -1; });
  document.addEventListener('pointerdown', function () { BT.Audio.unlock(); }, { passive: true });
  document.addEventListener('keydown', function () { BT.Audio.unlock(); });
  BT.Background.init(document.getElementById('background'));
  var params = new URLSearchParams(window.location.search), scene = params.get('scene');
  if (scene && scene !== 'menu' || params.get('autostart') === '1') {
    ui.menuOpen = false; g.noSave = !!scene; g.start({ seed: params.get('seed') || 'ONEGOODHAND', deck: 'red' });
    if (scene === 'shop') {
      g.run.money = 45; ['joker', 'fibonacci', 'blueprint'].forEach(function (key) { g.createJoker({ key: key, edition: null }); }); g.openShop(); ui.render();
    } else if (scene === 'pack') { g.openPack('arcana_mega', 'blind_select'); ui.render(); }
    else if (scene === 'collection') ui.collection('joker');
    else if (scene !== 'blinds') {
      if (scene) {
        ['joker', 'fibonacci', 'hanging_chad', 'blueprint', 'cavendish'].forEach(function (key, i) { g.createJoker({ key: key, edition: i === 3 ? 'foil' : null }); });
        g.createConsumable('tarot', { key: 'death' }); g.createConsumable('planet', { key: 'saturn' });
      }
      g.selectBlind('small');
      if (scene === 'round' || scene === 'score' || scene === 'cash') {
        var ranks = [14, 13, 10, 8, 8, 5, 3, 2]; g.run.hand.forEach(function (c, i) { c.rank = ranks[i]; c.suit = ['S', 'H', 'S', 'H', 'C', 'D', 'S', 'H'][i]; }); g.sortHand();
        ui.selected = g.run.hand.filter(function (c) { return c.rank === 8; }).map(function (c) { return c.id; }); ui.render();
        if (scene === 'score') setTimeout(function () { ui.act(function () { return g.play(ui.selected); }); }, 600);
        if (scene === 'cash') { g.run.round.chips = g.run.blind.chips; g.endRound(); ui.render(); }
      }
    }
  }
  var last = -1, lastReduced;
  function frame(ms) {
    if (!document.hidden && (last < 0 || !ui.isReduced() && ms - last >= 32 || ui.isReduced() !== lastReduced)) { BT.Background.frame(ms / 1000, ui.isReduced()); last = ms; lastReduced = ui.isReduced(); }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  function pause() { BT.Audio.pause(); ui.cancelDrag(); if (g.run) g.save(); }
  document.addEventListener('visibilitychange', function () { if (document.hidden) pause(); else { last = -1; BT.Audio.resume(); } });
  window.addEventListener('blur', pause);
  window.addEventListener('focus', function () { if (!document.hidden) BT.Audio.resume(); });
  window.addEventListener('pagehide', pause);
  window.addEventListener('pageshow', function () { if (!document.hidden) { last = -1; BT.Audio.resume(); } });
})(window.BT);
