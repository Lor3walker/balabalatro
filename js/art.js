/* 离屏 Canvas 程序化卡面：不加载字体、图片或原作素材。 */
(function (BT) {
  'use strict';
  var D = BT.Data, cache = new Map(), W = 240, H = 336;
  function box(ctx, x, y, w, h, r, fill, stroke) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { ctx.strokeStyle = stroke; ctx.stroke(); } }
  function text(ctx, str, x, y, size, color, font) { ctx.fillStyle = color; ctx.font = (font || '700') + ' ' + size + 'px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(str, x, y); }
  function star(ctx, x, y, r, points, color, angle) { ctx.beginPath(); for (var i = 0; i < points * 2; i++) { var a = (angle || 0) + i * Math.PI / points, rr = i % 2 ? r * 0.45 : r; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } ctx.closePath(); ctx.fillStyle = color; ctx.fill(); }
  function playing(ctx, c) {
    var s = D.SUIT[c.suit], col = s.color, enhColors = { bonus: '#d6e6ef', mult: '#efdadb', wild: '#e7dfef', glass: '#d6e9e8', steel: '#c9d1d4', stone: '#a6a39a', gold: '#ecd393', lucky: '#d6e5c9' };
    box(ctx, 4, 4, W - 8, H - 8, 16, enhColors[c.enh] || '#f5efe1', '#ded5bd');
    if (c.enh === 'stone') {
      ctx.fillStyle = '#777b77'; ctx.beginPath(); ctx.moveTo(62, 128); ctx.lineTo(157, 108); ctx.lineTo(195, 172); ctx.lineTo(165, 231); ctx.lineTo(55, 213); ctx.lineTo(39, 165); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#c4c6ba'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(62, 128); ctx.lineTo(117, 181); ctx.lineTo(55, 213); ctx.moveTo(117, 181); ctx.lineTo(195, 172); ctx.stroke(); text(ctx, '+50', 120, 283, 23, '#f5efdb');
    } else {
      text(ctx, D.RANK_LABEL[c.rank], 28, 33, 32, col); text(ctx, s.sym, 28, 68, 31, col);
      ctx.save(); ctx.translate(W, H); ctx.rotate(Math.PI); text(ctx, D.RANK_LABEL[c.rank], 28, 33, 32, col); text(ctx, s.sym, 28, 68, 31, col); ctx.restore();
      if (c.rank >= 11 && c.rank <= 13) {
        box(ctx, 55, 80, 130, 178, 3, '#e7ddc8', col); ctx.save(); ctx.translate(120, 169);
        ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(-45, 36); ctx.lineTo(-38, -12); ctx.lineTo(-23, -43); ctx.lineTo(0, -15); ctx.lineTo(22, -43); ctx.lineTo(40, -12); ctx.lineTo(46, 36); ctx.closePath(); ctx.fill();
        box(ctx, -25, -7, 50, 53, 19, '#f7e2b5'); ctx.fillStyle = '#303c3a'; ctx.fillRect(-14, 11, 7, 5); ctx.fillRect(8, 11, 7, 5);
        ctx.strokeStyle = '#bb654d'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 23, 9, 0.3, Math.PI - 0.3); ctx.stroke(); star(ctx, 0, -21, 13, 4, '#e3ae46'); ctx.restore();
        text(ctx, s.sym, 120, 234, 26, col);
      } else if (c.rank === 14) { text(ctx, s.sym, 120, 168, 123, col); }
      else {
        var pips = { 2: [[0, -64], [0, 64]], 3: [[0, -64], [0, 0], [0, 64]], 4: [[-40, -66], [40, -66], [-40, 66], [40, 66]] };
        var positions = pips[c.rank];
        if (!positions) { positions = [[-40, -68], [40, -68], [-40, 0], [40, 0], [-40, 68], [40, 68]]; if (c.rank % 2) positions.push([0, 0]); if (c.rank >= 8) positions.push([0, -36], [0, 36]); if (c.rank === 10) { positions = []; [-78, -26, 26, 78].forEach(function (y) { positions.push([-40, y], [40, y]); }); positions.push([0, -52], [0, 52]); } if (c.rank === 5) positions = pips[4].concat([[0, 0]]); }
        positions.forEach(function (p) { text(ctx, s.sym, 120 + p[0], 168 + p[1], 43, col); });
      }
    }
    if (c.enh === 'glass') { ctx.strokeStyle = '#ffffffbb'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(85, 0); ctx.lineTo(121, 93); ctx.lineTo(91, 160); ctx.lineTo(138, 248); ctx.lineTo(120, 336); ctx.stroke(); }
    if (c.enh === 'steel') { ctx.fillStyle = '#ffffff55'; ctx.beginPath(); ctx.moveTo(0, 195); ctx.lineTo(240, 46); ctx.lineTo(240, 98); ctx.lineTo(0, 247); ctx.fill(); }
    if (c.seal) { var seal = D.SEAL[c.seal]; star(ctx, 177, 248, 24, 14, seal.color); ctx.beginPath(); ctx.arc(177, 248, 16, 0, Math.PI * 2); ctx.strokeStyle = '#ffffff77'; ctx.lineWidth = 2; ctx.stroke(); text(ctx, { gold: '$', red: '↻', blue: '★', purple: '✦' }[c.seal], 177, 248, 23, '#fff5d6'); }
  }
  function joker(ctx, c) {
    var def = BT.Jokers.BY[c.key], palette = { m: '#bc5554', c: '#5486ae', x: '#ca9a4f', cm: '#8471ac', e: '#508c83', r: '#8378b7', $: '#789152' };
    var col = palette[def.type], seed = BT.Utils.hashSeed(c.key), rng = new BT.Utils.Rng(seed);
    box(ctx, 4, 4, 232, 328, 16, '#eee5d3', '#d9c9ab'); box(ctx, 15, 15, 210, 276, 8, col);
    ctx.save(); ctx.beginPath(); ctx.roundRect(15, 15, 210, 276, 8); ctx.clip();
    ctx.strokeStyle = '#ffffff18'; ctx.lineWidth = 1;
    for (var x = -260; x < 500; x += 22) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 330, 330); ctx.stroke(); }
    for (var i = 0; i < 15; i++) star(ctx, rng.int(25, 215), rng.int(25, 265), rng.int(2, 7), 4, '#f8e5b747');
    ctx.translate(120, 145); ctx.rotate((rng.next() - 0.5) * 0.12);
    ctx.fillStyle = '#233b40'; ctx.beginPath(); ctx.moveTo(-67, 12); ctx.lineTo(-75, -70); ctx.lineTo(-19, -28); ctx.lineTo(7, -89); ctx.lineTo(29, -31); ctx.lineTo(78, -62); ctx.lineTo(63, 17); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#efd895'; ctx.beginPath(); ctx.ellipse(0, 25, 53, 63, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#fff3cd'; ctx.beginPath(); ctx.ellipse(-14, 20, 24, 46, -0.2, 0, 7); ctx.fill();
    text(ctx, rng.next() < 0.4 ? '×' : '◆', -23, 8, 25, '#263e42'); text(ctx, '◆', 24, 8, 25, '#263e42');
    ctx.fillStyle = '#d96a4f'; ctx.beginPath(); ctx.arc(0, 24, 10, 0, 7); ctx.fill();
    ctx.strokeStyle = '#263e42'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(0, 37, 26, 0.2, Math.PI - 0.2); ctx.stroke();
    [-75, 7, 78].forEach(function (x, i) { star(ctx, x, [-70, -89, -62][i], 11, 5, '#f2ce6d'); }); ctx.restore();
    text(ctx, def.icon, 181, 256, 43, '#fff');
    text(ctx, def.zh, 120, 311, def.zh.length > 6 ? 20 : 23, '#283d42');
    var rar = ['#8d988e', '#91d4a0', '#f49275', '#e6c067'][def.rarity - 1]; ctx.strokeStyle = rar; ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect(7, 7, 226, 322, 14); ctx.stroke();
  }
  function consumable(ctx, c) {
    var def = c.kind === 'planet' ? D.PLANET[c.key] : c.kind === 'tarot' ? D.TAROT[c.key] : c.kind === 'spectral' ? D.SPECTRAL[c.key] : c.kind === 'voucher' ? D.VOUCHER[c.key] : D.PACK[c.key];
    var col = c.kind === 'tarot' ? '#715d94' : c.kind === 'spectral' ? '#3a8596' : c.kind === 'voucher' ? '#ad8951' : c.kind === 'pack' ? D.PACK_TYPES[def.type].color : '#396e89';
    box(ctx, 4, 4, 232, 328, 16, '#ebe1ce', '#ccbea1'); box(ctx, 15, 15, 210, 276, 8, col);
    ctx.strokeStyle = '#eedbb377'; ctx.lineWidth = 2; ctx.strokeRect(26, 28, 188, 250);
    for (var i = 0; i < 18; i++) { var a = i * 2.399; star(ctx, 120 + Math.cos(a) * (50 + i * 2), 155 + Math.sin(a) * (50 + i * 2), 3, 4, '#f5e5bd88'); }
    if (c.kind === 'planet') {
      var grad = ctx.createRadialGradient(97, 119, 3, 120, 153, 64); grad.addColorStop(0, '#f6e4c6'); grad.addColorStop(0.6, def.color); grad.addColorStop(1, '#1d3439');
      ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(120, 153, 64, 0, 7); ctx.fill();
      if (def.ring) { ctx.strokeStyle = '#ead7b2aa'; ctx.lineWidth = 12; ctx.beginPath(); ctx.ellipse(120, 154, 97, 27, -0.35, 0, 7); ctx.stroke(); }
      text(ctx, D.HAND[def.hand].zh, 120, 252, 20, '#f3e4c6');
    } else if (c.kind === 'pack') {
      ctx.fillStyle = '#ffffee12'; ctx.fillRect(40, 61, 160, 182); text(ctx, { arcana: '✧', celestial: '☄', spectral: '☥', standard: '♠', buffoon: '♜' }[def.type], 120, 145, 105, '#f0dfb5');
      text(ctx, def.n + ' 选 ' + def.choose, 120, 252, 22, '#f0dfb5');
    } else { text(ctx, def.num || '✦', 120, 49, 20, '#eedbb3'); text(ctx, def.icon, 120, 153, 90, '#f6e4c6'); text(ctx, c.kind === 'tarot' ? 'TAROT' : c.kind === 'spectral' ? 'SPECTRAL' : 'VOUCHER', 120, 251, 16, '#eedbb3'); }
    text(ctx, def.zh, 120, 311, def.zh.length > 6 ? 19 : 23, '#283d42');
  }
  function image(c, back) {
    var key = back ? 'back' : [c.kind, c.key, c.suit, c.rank, c.enh, c.seal].join(':'); if (cache.has(key)) return cache.get(key);
    var canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H; var ctx = canvas.getContext('2d');
    if (back) { box(ctx, 4, 4, 232, 328, 16, '#e7dcc5'); box(ctx, 14, 14, 212, 308, 9, '#285360'); ctx.strokeStyle = '#e8d49c66'; for (var y = 29; y < 310; y += 17) for (var x = 25; x < 220; x += 17) { ctx.strokeRect(x, y, 8, 8); } star(ctx, 120, 168, 60, 8, '#c8a967'); star(ctx, 120, 168, 37, 8, '#285360'); }
    else if (c.kind === 'playing') playing(ctx, c); else if (c.kind === 'joker') joker(ctx, c); else consumable(ctx, c);
    var url = canvas.toDataURL(); cache.set(key, url); return url;
  }
  BT.Art = { image: image };
})(window.BT);
