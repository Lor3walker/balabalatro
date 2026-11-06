/* 响应式逻辑坐标：桌面整桌，手机重排，布局变化不接触游戏状态或 RNG。 */
(function (BT) {
  'use strict';
  function area(x, y, width, cardW) { return { x: x, y: y, width: width, cardW: cardW }; }
  function compute(w, h, run) {
    var compact = w < 1100, landscape = compact && w > h && w >= 600 && h <= 600, portrait = compact && !landscape && w < 760, width = compact ? Math.max(280, w) : 1600;
    var phase = run ? run.phase : 'menu', layout = { mode: landscape ? 'landscape' : portrait ? 'portrait' : compact ? 'compact' : 'desktop', width: width, height: 900, centerY: 323, centerHeight: 272 };
    if (landscape) {
      layout.height = Math.max(280, h); layout.sidebarWidth = 176; layout.actionsHeight = 54;
      var x = 192, available = width - x - 12, handW = Math.min(76, Math.max(52, (h - 200) / 2.2));
      var handY = h - layout.actionsHeight - handW * 1.4 - 8;
      layout.jokers = area(x + 8, 73, available * 0.66 - 16, 42); layout.cons = area(x + available * 0.68, 73, available * 0.32 - 12, 38);
      layout.centerY = 142; layout.centerHeight = Math.max(32, handY - layout.centerY - 8);
      layout.hand = area(x + 8, handY, available - 16, handW);
      layout.play = area(x + 16, layout.centerY + 4, available - 32, Math.max(26, Math.min(68, (layout.centerHeight - 8) / 1.4)));
      var packHasHand = run && run.hand.length > 0;
      if (phase === 'pack') {
        layout.centerY = 52; layout.centerHeight = (packHasHand ? handY - 10 : h - layout.actionsHeight - 8) - layout.centerY;
        layout.hideInventory = true;
      }
      if (phase === 'shop' || phase === 'blind_select' || phase === 'cash_out' || phase === 'won' || phase === 'game_over') layout.centerHeight = Math.max(80, h - layout.actionsHeight - layout.centerY - 8);
      var cardY = layout.centerY + (phase === 'pack' ? 52 : 50);
      var cardW = Math.max(36, Math.min(92, (layout.centerY + layout.centerHeight - cardY - (phase === 'shop' ? 25 : 3)) / 1.4));
      layout.pack = area(x + 8, cardY, available - 16, cardW); layout.pack.columns = Math.max(3, Math.floor((available - 16) / (cardW + 12)));
      layout.shop = [area(x + 8, cardY, available - 16, cardW)]; layout.shop[0].columns = layout.pack.columns;
      return layout;
    }
    if (!compact) {
      layout.jokers = area(374, 144, 757, 88); layout.cons = area(1198, 144, 342, 88);
      layout.hand = area(384, 626, 990, 120); layout.play = area(555, 392, 820, 120);
      layout.pack = area(394, 421, 1100, 112); layout.shop = [area(379, 419, 515, 111), area(1005, 419, 295, 111), area(1351, 419, 177, 111)];
      return layout;
    }
    var left = portrait ? 12 : 220, content = width - left - 12;
    layout.centerY = portrait ? 470 : 228;
    layout.jokers = area(left + 8, portrait ? 272 : 109, portrait ? content - 16 : content * 0.65 - 18, portrait ? 58 : 56);
    layout.cons = area(portrait ? left + 8 : left + content * 0.67, portrait ? 398 : 109, portrait ? content - 16 : content * 0.33 - 12, portrait ? 46 : 56);
    layout.play = area(left + 8, layout.centerY + 68, content - 16, portrait ? 65 : 78);
    layout.pack = area(left + 8, layout.centerY + 102, content - 16, portrait ? 91 : 98);
    layout.pack.columns = portrait ? 3 : Math.max(3, Math.floor((content - 16) / 108));
    layout.shop = [area(left + 8, layout.centerY + 94, content - 16, portrait ? 91 : 98)];
    layout.shop[0].columns = portrait ? 3 : Math.max(3, Math.floor((content - 16) / 108));
    var packRows = run && run.pack ? Math.ceil(run.pack.cards.length / layout.pack.columns) : 1;
    var shopCount = run && run.shop ? run.shop.cards.length + run.shop.packs.length + run.shop.vouchers.length : 5;
    layout.centerHeight = phase === 'blind_select' ? (portrait ? 778 : 370) : phase === 'shop' ? 105 + Math.ceil(shopCount / layout.shop[0].columns) * 184 : phase === 'pack' ? 105 + packRows * 165 : phase === 'cash_out' ? 180 + (run.cash ? run.cash.rows.length * 38 : 200) : phase === 'won' || phase === 'game_over' ? 370 : 180;
    var handY = phase === 'pack' ? layout.centerY + layout.centerHeight + 28 : portrait ? 681 : 443;
    layout.hand = area(left + 8, handY, content - 16, portrait ? 74 : 82); layout.hand.columns = portrait ? Math.max(3, Math.floor((content - 16) / 82)) : Math.max(4, Math.floor((content - 16) / 94));
    var handRows = run ? Math.ceil(run.hand.length / layout.hand.columns) : 0;
    layout.height = Math.max(portrait ? 1020 : 720, layout.centerY + layout.centerHeight + 120, run && (phase === 'round' || phase === 'pack') ? handY + handRows * (layout.hand.cardW * 1.4 + 18) + 130 : 0);
    if (!run || phase === 'menu') layout.height = portrait ? 1140 : 890;
    return layout;
  }
  function positions(run, l, jokerSlots, consSlots) {
    var out = {};
    function row(cards, a, zone, capacity, fan) {
      var n = Math.max(cards.length, capacity || 0), step = Math.min(a.cardW + 15, (a.width - a.cardW) / Math.max(1, n - 1));
      var start = a.x + (a.width - (step * Math.max(0, n - 1) + a.cardW)) / 2;
      cards.forEach(function (c, i) { out[c.id] = { x: start + step * i, y: a.y + (fan ? Math.pow((i - (cards.length - 1) / 2) / Math.max(1, cards.length), 2) * 40 : 0), w: a.cardW, zone: zone, card: c, z: i + 10, angle: fan ? (i - (cards.length - 1) / 2) * 1.2 : 0 }; });
    }
    function grid(cards, a, zone) {
      if (!a.columns) { row(cards, a, zone); return; }
      for (var i = 0; i < cards.length; i += a.columns) row(cards.slice(i, i + a.columns), area(a.x, a.y + (i / a.columns) * (a.cardW * 1.4 + 30), a.width, a.cardW), zone);
    }
    if (!l.hideInventory) { row(run.jokers, l.jokers, 'jokers', jokerSlots); row(run.cons, l.cons, 'cons', consSlots); }
    if (run.phase === 'round' || run.phase === 'pack') { if (l.hand.columns) grid(run.hand, l.hand, 'hand'); else row(run.hand, l.hand, 'hand', 0, true); }
    if (run.play.length) row(run.play, l.play, 'play');
    if (run.phase === 'pack') grid(run.pack.cards, l.pack, 'pack');
    if (run.phase === 'shop') {
      if (l.mode === 'desktop') { row(run.shop.cards, l.shop[0], 'shop'); row(run.shop.packs, l.shop[1], 'shop'); row(run.shop.vouchers, l.shop[2], 'shop'); }
      else grid(run.shop.cards.concat(run.shop.packs, run.shop.vouchers), l.shop[0], 'shop');
    }
    return out;
  }
  BT.Layout = { compute: compute, positions: positions };
})(window.BT);
