/* DOM 牌桌：统一卡牌层、键盘/触摸选择、指针拖动排序、逐事件计分回放。 */
(function (BT) {
  'use strict';
  var U = BT.Utils, D = BT.Data, J = BT.Jokers.BY, $ = function (id) { return document.getElementById(id); };
  function button(act, label, cls, disabled, value) { return '<button' + (act === 'sort-rank' ? ' title="点数从左至右：A、K、Q、J、10 至 2"' : '') + ' data-act="' + act + '"' + (value === undefined ? '' : ' data-value="' + U.esc(value) + '"') + ' class="' + (cls || '') + '"' + (disabled ? ' disabled' : '') + '>' + label + '</button>'; }
  function UI(g) {
    this.g = g; this.view = null; this.nodes = new Map(); this.selected = []; this.activeId = null; this.busy = false; this.menuOpen = true; this.deckIndex = 0;
    this.motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    var savedSettings = U.load('bt-settings-v2', {}) || {};
    this.settings = Object.assign({ speed: 1, crt: true, reduced: false, respectSystem: true }, savedSettings);
    if (savedSettings.pacingVersion !== 3) this.settings.speed = 1;
    this.settings.pacingVersion = 3;
    if ([0.5, 1, 2, 4].indexOf(this.settings.speed) < 0) this.settings.speed = 1;
    ['crt', 'reduced', 'respectSystem'].forEach(function (k) { this.settings[k] = !!this.settings[k]; }, this);
    this.catalogGame = new BT.Game(); this.catalogGame.save = function () {}; this.catalogGame.start({ seed: 'COLLECT', deck: 'red' });
    var self = this; g.onStateChange = function (events) { self.changed(events); };
    $('stage').addEventListener('click', function (e) { self.click(e); });
    $('stage').addEventListener('pointerdown', function (e) { self.pointerDown(e); });
    document.addEventListener('pointermove', function (e) { self.pointerMove(e); });
    document.addEventListener('pointerup', function (e) { self.pointerUp(e); });
    document.addEventListener('pointercancel', function () { self.cancelDrag(); });
    $('stage').addEventListener('pointerover', function (e) { self.hover(e); });
    $('stage').addEventListener('pointerout', function (e) { if (!e.relatedTarget || !e.target.closest('.card') || !e.target.closest('.card').contains(e.relatedTarget)) $('tooltip').hidden = true; });
    $('stage').addEventListener('contextmenu', function (e) { e.preventDefault(); self.clearSelection(); });
    $('stage').addEventListener('change', function (e) { self.settingChanged(e); });
    document.addEventListener('keydown', function (e) { self.key(e); });
    var motionChange = function () { self.applySettings(); };
    if (this.motionQuery.addEventListener) this.motionQuery.addEventListener('change', motionChange); else if (this.motionQuery.addListener) this.motionQuery.addListener(motionChange);
    this.applySettings(); this.render();
  }
  var P = UI.prototype;
  P.isReduced = function () { return this.settings.reduced || this.settings.respectSystem && this.motionQuery.matches; };
  P.applySettings = function () { $('stage').classList.toggle('crt', !!this.settings.crt); $('stage').classList.toggle('reduced-motion', !!this.isReduced()); U.save('bt-settings-v2', this.settings); };
  P.updateLayout = function () {
    var compact = window.innerWidth < 1116; document.body.classList.toggle('compact-view', compact);
    var padding = window.getComputedStyle(document.body), width = document.documentElement.clientWidth - parseFloat(padding.paddingLeft || 0) - parseFloat(padding.paddingRight || 0);
    var viewport = window.visualViewport, visibleHeight = viewport && viewport.scale === 1 ? Math.min(window.innerHeight, viewport.height) : window.innerHeight;
    var height = visibleHeight - parseFloat(padding.paddingTop || 0) - parseFloat(padding.paddingBottom || 0);
    this.layout = BT.Layout.compute(width, height, this.menuOpen ? null : this.view);
    document.body.classList.toggle('landscape-view', this.layout.mode === 'landscape');
    var l = this.layout, root = document.documentElement.style;
    root.setProperty('--layout-width', l.width + 'px'); root.setProperty('--layout-height', l.height + 'px');
    root.setProperty('--scale', l.mode === 'desktop' ? Math.min((window.innerWidth - 16) / 1600, (window.innerHeight - 16) / 900) : 1);
    $('stage').classList.toggle('portrait-layout', l.mode === 'portrait'); $('stage').classList.toggle('compact-layout', l.mode === 'compact'); $('stage').classList.toggle('landscape-layout', l.mode === 'landscape');
    root.setProperty('--table-left', (l.mode === 'landscape' ? 192 : l.mode === 'portrait' ? 12 : 220) + 'px');
    root.setProperty('--visible-height', visibleHeight + 'px');
    $('stage').dataset.phase = this.menuOpen ? 'menu' : this.view && this.view.phase || 'menu';
    $('center').style.top = l.centerY + 'px'; $('center').style.height = l.centerHeight + 'px';
  };
  P.reflow = function () { this.cancelDrag(); if (this.busy) { this.updateLayout(); this.layoutCards(); } else this.render(); };
  P.point = function (e) { var r = $('stage').getBoundingClientRect(), s = r.width / this.layout.width; return { x: (e.clientX - r.left) / s, y: (e.clientY - r.top) / s }; };
  P.toast = function (text) { $('toast').textContent = text; $('toast').classList.add('show'); clearTimeout(this.toastTimer); this.toastTimer = setTimeout(function () { $('toast').classList.remove('show'); }, 2300); };
  P.findCard = function (id) { var r = this.g.run; return r && r.deck.concat(r.jokers, r.cons, r.shop ? r.shop.cards.concat(r.shop.packs, r.shop.vouchers) : [], r.pack ? r.pack.cards : []).find(function (c) { return c.id === id; }); };
  P.cardName = function (c) { return c.kind === 'playing' ? c.enh === 'stone' ? '石头牌' : D.SUIT[c.suit].zh + ' ' + D.RANK_LABEL[c.rank] : (c.kind === 'joker' ? J[c.key] : c.kind === 'planet' ? D.PLANET[c.key] : c.kind === 'tarot' ? D.TAROT[c.key] : c.kind === 'spectral' ? D.SPECTRAL[c.key] : c.kind === 'voucher' ? D.VOUCHER[c.key] : D.PACK[c.key]).zh; };
  P.description = function (c) {
    var def = c.kind === 'playing' ? null : c.kind === 'joker' ? J[c.key] : c.kind === 'planet' ? D.PLANET[c.key] : c.kind === 'tarot' ? D.TAROT[c.key] : c.kind === 'spectral' ? D.SPECTRAL[c.key] : c.kind === 'voucher' ? D.VOUCHER[c.key] : D.PACK[c.key];
    var g = this.g.run ? this.g : this.catalogGame;
    if (c.kind === 'playing') return (c.enh ? D.ENH[c.enh].desc : '{c}+' + D.nominal(c.rank) + '{} 筹码') + (c.perma ? '\n永久 {c}+' + c.perma + '{} 筹码' : '');
    if (c.kind === 'planet') { var h = g.run.hands[def.hand], d = D.HAND[def.hand]; return '{o}' + d.zh + '{} 提升 1 级\n{c}+' + d.lc + '{} 筹码，{m}+' + d.lm + '{} 倍率\n{i}（当前等级 ' + h.level + '）{}'; }
    if (c.kind === 'pack') return '从 {o}' + def.n + '{} 张' + D.PACK_TYPES[def.type].what + '\n选择 {o}' + def.choose + '{} 张' + (D.PACK_TYPES[def.type].use ? '\n' + D.PACK_TYPES[def.type].use : '加入小丑区');
    return typeof def.desc === 'function' ? def.desc(c, g) : def.desc;
  };
  P.tooltipHTML = function (c) {
    var extra = [], def = c.kind === 'joker' ? J[c.key] : c.kind === 'planet' ? D.PLANET[c.key] : c.kind === 'tarot' ? D.TAROT[c.key] : c.kind === 'spectral' ? D.SPECTRAL[c.key] : c.kind === 'voucher' ? D.VOUCHER[c.key] : null;
    var rarity = c.kind === 'joker' ? '<div class="rarity-strip rarity-' + def.rarity + '"><span>' + ['普通', '罕见', '稀有', '传奇'][def.rarity - 1] + '</span></div>' : '';
    if (c.edition) extra.push(D.EDITION[c.edition].zh + ' · ' + D.EDITION[c.edition].desc);
    if (c.seal) extra.push(D.SEAL[c.seal].zh + ' · ' + D.SEAL[c.seal].desc);
    if (c.eternal) extra.push('永恒：无法出售或摧毁'); if (c.perishable) extra.push('易腐：剩余 ' + c.perishLeft + ' 回合'); if (c.rental) extra.push('租用：每回合结束失去 $3');
    return rarity + '<h3>' + U.esc(this.cardName(c)) + '</h3><div class="en">' + U.esc(def ? def.en : c.kind === 'playing' ? D.SUIT[c.suit].en : '') + '</div><div class="description">' + U.rich(this.description(c)) + '</div>' + (extra.length ? '<div class="tip-detail">' + U.rich(extra.join('\n')) + '</div>' : '');
  };
  P.hover = function (e) {
    if (this.busy || this.drag || e.pointerType === 'touch' || !$('modal').hidden || this.menuOpen) return;
    var node = e.target.closest('[data-card]'), tag = e.target.closest('[data-tag]');
    if (!node && !tag) return;
    var c = node && this.findCard(Number(node.dataset.card)); if (c && c.flipped) return;
    var html = c ? this.tooltipHTML(c) : tag ? '<h3>' + D.TAG[tag.dataset.tag].zh + '</h3><div class="description">' + U.rich(D.TAG[tag.dataset.tag].desc) + '</div>' : null;
    if (!html) return; var tip = $('tooltip'), p = this.point(e); tip.innerHTML = html; tip.hidden = false;
    tip.style.left = U.clamp(p.x + 24, 8, this.layout.width - tip.offsetWidth - 8) + 'px'; tip.style.top = U.clamp(p.y - tip.offsetHeight - 15, 10, this.layout.height - tip.offsetHeight - 10) + 'px';
  };
  P.render = function () {
    this.view = this.g.run; var r = this.view; this.updateLayout();
    BT.Audio.setScene(this.menuOpen ? 'menu' : r && r.phase || 'menu');
    $('menu').hidden = !this.menuOpen; $('stage').classList.toggle('menu-visible', this.menuOpen);
    $('topbar').innerHTML = '<div class="brand">Bala<b>Bala</b>Tro<small>一 手 好 戏</small></div><div class="top-tools">' + (r ? '<span class="pill">' + D.DECK[r.deckKey].zh + ' · ' + D.STAKES[r.stake - 1].zh + '</span>' : '') + button('info', '牌型 / 本局', 'small flat', !r) + button('collection', '图鉴', 'small flat') + button('options', '设置', 'small flat') + (r ? button('menu', '菜单', 'small flat') : '') + '</div>';
    if (this.menuOpen) this.renderMenu();
    if (!r) { $('sidebar').innerHTML = ''; return; }
    this.selected = this.selected.filter(function (id) { return r.hand.some(function (c) { return c.id === id; }); });
    r.hand.forEach(function (c) { if (c.forced && this.selected.indexOf(c.id) < 0) this.selected.push(c.id); }, this);
    this.renderPanels(); this.layoutCards();
    $('footer').innerHTML = '<span>Enter 出牌 · X 弃牌 · 拖动排序</span><span>种子 ' + U.esc(r.seed) + ' &nbsp; / &nbsp; ' + (this.g.noSave ? '演示模式' : BT.Storage.status().local === 'ready' ? '自动保存' : '保存失败，请导出备份') + '</span>';
  };
  P.renderPanels = function () {
    var r = this.view, g = this.g, type = r.phase === 'blind_select' ? g.nextBlind() : r.blind && r.blind.type || 'small';
    var def = type === 'boss' ? D.BOSS[r.phase === 'blind_select' ? r.blinds.boss.key : r.blind.key] : D.BLINDS[type];
    var target = r.phase === 'blind_select' || !r.blind ? g.blindTarget(type) : r.blind.chips, reward = type === 'small' && r.stake >= 2 ? 0 : def.dollars;
    var h = this.selected.length && r.phase === 'round' && !this.busy ? g.preview(this.selected) : null, hs = h && h.hand && r.hands[h.hand];
    $('sidebar').innerHTML = '<div class="blind-head"><div class="chip" style="--blind:' + def.color + '">' + def.glyph + '</div><div><div class="label">' + (r.phase === 'blind_select' ? '下 一 盲 注' : '当 前 盲 注') + '</div><h3>' + def.zh + '</h3></div></div><div class="blind-desc dark-rich">' + U.rich((def.desc || '在出牌次数耗尽前达到目标分数。').replace('#hand#', D.HAND[r.current.oxHand].zh)) + '</div><div class="target"><span class="label">至 少 得 分</span><strong>' + U.fmt(target) + '</strong><span class="reward">奖励 ' + '$'.repeat(reward) + (r.blind && r.blind.disabled ? ' · Boss 已禁用' : '') + '</span></div><div class="round-score"><span class="label">本 回 合 得 分</span><strong id="round-total">' + U.fmt(r.round.chips) + '</strong><div class="progress"><div id="score-progress" style="width:' + U.clamp(r.round.chips / target * 100, 0, 100) + '%"></div></div></div><div class="hand-name" id="hand-name">' + (hs ? (h.royal ? '皇家同花顺' : D.HAND[h.hand].zh) + ' · 等级 ' + hs.level : '选择你的下一手') + '</div><div class="equation"><div><span id="chips-value">' + (hs ? U.fmt(hs.chips) : '0') + '</span><small>筹 码</small></div><span>×</span><div><span id="mult-value">' + (hs ? U.fmt(hs.mult) : '0') + '</span><small>倍 率</small></div></div><div class="stat-grid"><div class="stat"><span class="label">剩余出牌</span><strong>' + (r.phase === 'round' ? r.round.handsLeft : r.base.hands + g.passive('hands')) + '</strong></div><div class="stat"><span class="label">剩余弃牌</span><strong>' + (r.phase === 'round' ? r.round.discardsLeft : r.base.discards + g.passive('discards')) + '</strong></div></div><div class="money" id="money-value">$' + U.fmt(r.money) + '</div><div class="sidebar-bottom"><span>底注 <b>' + r.ante + '</b> / 8</span><span>回合 <b>' + r.roundNumber + '</b></span></div>';
    var self = this;
    function slots(n, span) {
      var a = span === 105 ? self.layout.jokers : self.layout.cons, desktop = self.layout.mode === 'desktop', portrait = self.layout.mode === 'portrait';
      var baseX = desktop ? (span === 105 ? 354 : 1179) : portrait ? 12 : span === 105 ? (self.layout.mode === 'landscape' ? 192 : 220) : a.x;
      var baseY = desktop ? 101 : portrait ? (span === 105 ? 238 : 364) : self.layout.mode === 'landscape' ? 49 : 74;
      var step = Math.min(a.cardW + 15, (a.width - a.cardW) / Math.max(1, n - 1)), start = a.x - baseX + (a.width - (step * Math.max(0, n - 1) + a.cardW)) / 2, html = '';
      for (var i = 0; i < Math.min(n, 12); i++) html += '<div class="slot" style="left:' + (start + i * step) + 'px;top:' + (a.y - baseY) + 'px;width:' + a.cardW + 'px;height:' + (a.cardW * 1.4) + 'px">✧</div>';
      return html;
    }
    $('inventory').innerHTML = '<div class="inv-zone"><span class="label">小 丑 牌<span class="count">' + r.jokers.length + ' / ' + g.jokerSlots() + '</span></span><span class="inv-note">从左至右结算 · 拖动调整顺序</span>' + slots(g.jokerSlots(), 105) + '</div><div class="inv-zone inv-cons"><span class="label">消 耗 牌<span class="count">' + r.cons.length + ' / ' + g.consSlots() + '</span></span>' + slots(g.consSlots(), 109) + '</div><div class="tag-row">' + r.tags.map(function (t) { return '<span class="tag-mini" data-tag="' + t.key + '">' + D.TAG[t.key].icon + '</span>'; }).join('') + '</div>';
    var center = '', bar = '', phase = r.phase;
    if (phase === 'round') {
      center = '<div class="table-mark"><span class="mark">♠</span><span class="motto">让每一张牌，都有好戏。</span><span class="submotto">筹码 × 倍率 = 得分</span></div>';
      bar = '<div class="hand-actions">' + button('play', '出牌 <kbd>↵</kbd>', 'primary', this.busy || !g.validSelection(this.selected)) + button('discard', '弃牌 <kbd>X</kbd>', 'red-btn', this.busy || !g.validSelection(this.selected) || r.round.discardsLeft < 1) + '</div>';
    } else if (phase === 'blind_select') {
      center = '<div class="section-title"><h2>选择盲注</h2><span class="quiet">跳过盲注可获得标签，但不会进入商店</span></div><div class="blind-choices">' + ['small', 'big', 'boss'].map(function (k) {
        var b = r.blinds[k], active = b.state === 'next', d = k === 'boss' ? D.BOSS[b.key] : D.BLINDS[k], t = b.tag;
        return '<article class="blind-choice ' + (active ? 'active' : 'locked') + '"><div class="chip" style="--blind:' + d.color + '">' + d.glyph + '</div><h3>' + d.zh + '</h3><div class="blind-points">' + U.fmt(g.blindTarget(k)) + '</div><div class="desc dark-rich">' + (d.desc ? U.rich(d.desc.replace('#hand#', D.HAND[r.current.oxHand].zh)) : '奖励 <span class="tx-money">' + (k === 'small' && r.stake >= 2 ? '$0' : '$'.repeat(d.dollars)) + '</span>') + '</div>' + button('blind', b.state === 'defeated' ? '已击败' : b.state === 'skipped' ? '已跳过' : active ? '选择盲注' : '尚未开放', active ? 'primary small' : 'small', !active || this.busy, k) + (t ? '<div class="tag-choice"><span data-tag="' + t.key + '">' + D.TAG[t.key].icon + ' ' + D.TAG[t.key].zh + '</span>' + button('skip-blind', '跳过', 'small flat', !active || this.busy, k) + '</div>' : '') + '</article>';
      }, this).join('') + '</div>';
      if (r.vouchers.directors_cut) bar = button('boss-reroll', '重掷 Boss · $10', 'small', !g.afford(10) || r.bossRerolled && !r.vouchers.retcon);
    } else if (phase === 'shop') {
      center = '<div class="section-title"><h2>幕间商店 <span class="quiet">投资下一手好戏</span></h2><div class="shop-actions">' + button('reroll', '重掷 · $' + g.rerollCost(), 'small', !g.afford(g.rerollCost()) || this.busy) + button('leave', '下一回合 →', 'primary small', this.busy) + '</div></div><div class="shop-layout"><span class="shop-label" style="left:25px">卡 牌</span><span class="shop-label" style="left:55%">补 充 包</span><span class="shop-label" style="right:35px">优 惠 券</span><div class="shop-divider"></div></div>';
      bar = '<span class="quiet">点击卡牌查看效果或购买</span>';
    } else if (phase === 'pack') {
      var pack = D.PACK[r.pack.key]; center = '<div class="pack-heading"><div><h2>' + pack.zh + '</h2><p>还可选择 ' + r.pack.choose + ' 张 · ' + (r.hand.length ? '需要目标的牌：先选手牌' : D.PACK_TYPES[pack.type].use || '加入小丑区') + '</p></div>' + button('skip-pack', '跳过补充包', 'small flat', this.busy) + '</div>';
      bar = '<span class="quiet">死神：左牌变右牌，可拖动换位</span>';
    } else if (phase === 'cash_out') {
      center = '<div class="cash-panel"><h2>漂亮，过关了。</h2>' + r.cash.rows.map(function (row) { return '<div class="cash-row"><span>' + U.esc(row.label) + '</span><strong>+$' + row.amount + '</strong></div>'; }).join('') + '<div class="cash-total"><div><span class="label">本 回 合 收 益</span><strong> $' + r.cash.total + '</strong></div>' + button('cash', '领取收益 →', 'primary', this.busy) + '</div></div>';
    } else if (phase === 'game_over' || phase === 'won') {
      var win = phase === 'won'; center = '<div class="end-panel"><div class="menu-eyebrow">' + (win ? 'THE SHOW GOES ON' : 'UNTIL NEXT TIME') + '</div><h2>' + (win ? '八个底注，一手好戏。' : '这场好戏，暂告一段落。') + '</h2><p>' + (win ? '你已击败第八底注。继续无尽，看看这套构筑的极限。' : '小丑的顺序、每次弃牌和一块利息，都可能改变下一局。') + '</p><div class="end-stats"><div><span class="label">最高单手</span><strong>' + U.fmt(r.stats.best) + '</strong></div><div><span class="label">总出牌</span><strong>' + r.stats.handsPlayed + '</strong></div><div><span class="label">到达底注</span><strong>' + r.ante + '</strong></div></div>' + (win ? button('endless', '继续无尽', 'primary') + ' ' : '') + button('menu', '再来一局', win ? '' : 'primary') + '</div>';
    }
    $('center').innerHTML = center;
    if (r.hand.length && !this.busy && (phase === 'round' || phase === 'pack')) bar += '<div class="sort-actions"><span class="quiet">' + r.hand.length + ' / ' + g.handSize() + ' 张手牌</span>' + button('sort-rank', '点数 R', 'small flat') + button('sort-suit', '花色 S', 'small flat') + '</div>';
    if (phase === 'round') bar += '<div class="deck-control">' + button('deck', '<div class="deck-back"></div><span class="deck-count">' + r.draw.length + ' / ' + r.deck.length + '</span>', 'flat') + '</div>';
    if (phase === 'round' || phase === 'pack') bar += button('hand-details', '选牌详情', 'small flat', !this.selected.length || this.busy);
    if (this.layout.hideInventory) bar += button('inventory', '小丑 / 消耗牌', 'small flat', this.busy);
    $('handbar').innerHTML = bar;
  };
  P.layoutCards = function () {
    var r = this.view, self = this, visible = new Set(), positions = BT.Layout.positions(r, this.layout, this.g.jokerSlots(), this.g.consSlots());
    Object.keys(positions).forEach(function (id) {
      id = Number(id); visible.add(id); var p = positions[id], c = p.card, node = self.nodes.get(id);
      if (!node) { node = document.createElement('button'); node.type = 'button'; node.dataset.card = id; node.innerHTML = '<img alt="" draggable="false">'; self.nodes.set(id, node); $('cards').appendChild(node); }
      node.dataset.zone = p.zone; node.className = 'card' + (self.selected.indexOf(id) >= 0 ? ' selected' : '') + (c.forced ? ' forced' : '') + (c.edition && !c.flipped ? ' ed-' + c.edition : '') + (c.debuff || c.kind === 'joker' && self.g.jokerDebuffed(c) || c.kind === 'playing' && self.g.cardDebuffed(c) ? ' debuffed' : '');
      node.style.left = p.x + 'px'; node.style.top = p.y + 'px'; node.style.width = p.w + 'px'; node.style.height = p.w * 1.4 + 'px'; node.style.setProperty('--angle', p.angle + 'deg'); node.style.zIndex = p.z;
      node.setAttribute('aria-label', c.flipped ? '背面朝上的牌' : self.cardName(c)); node.setAttribute('aria-pressed', String(self.selected.indexOf(id) >= 0));
      node.querySelector('img').src = BT.Art.image(c, c.flipped);
      var price = node.querySelector('.price'); if (price) price.remove(); if (p.zone === 'shop') { price = document.createElement('span'); price.className = 'price'; price.textContent = self.g.cost(c) ? '$' + self.g.cost(c) : '免费'; node.appendChild(price); }
      var sticker = node.querySelector('.sticker'); if (sticker) sticker.remove(); if (c.eternal || c.perishable || c.rental) { sticker = document.createElement('span'); sticker.className = 'sticker'; sticker.textContent = (c.eternal ? '∞' : '') + (c.perishable ? c.perishLeft : '') + (c.rental ? '$' : ''); node.appendChild(sticker); }
    });
    this.nodes.forEach(function (node, id) { if (!visible.has(id)) { node.remove(); self.nodes.delete(id); } }); this.positions = positions; this.inventoryActions();
  };
  P.inventoryActions = function () {
    var old = document.querySelector('.inventory-action'); if (old) old.remove(); document.body.classList.remove('with-actions'); if (!this.activeId || this.busy) return;
    var c = this.findCard(this.activeId); if (!c) { this.activeId = null; return; }
    var r = this.g.run, owned = r.jokers.indexOf(c) >= 0 || r.cons.indexOf(c) >= 0, pack = r.pack && r.pack.cards.indexOf(c) >= 0, actions;
    if (owned) actions = (c.kind !== 'joker' ? button('use', '使用', 'primary small', !this.g.canUse(c, this.selected, false), c.id) : '') + button('sell-confirm', '出售 $' + this.g.sellValue(c), 'small', c.eternal, c.id);
    else if (pack) actions = button('choose-pack', c.kind === 'playing' || c.kind === 'joker' ? '选择此牌' : '立即使用', 'primary small', c.kind === 'joker' ? !this.g.jokerRoom() && c.edition !== 'negative' : c.kind === 'playing' ? false : !this.g.canUse(c, this.selected, true), c.id);
    else actions = button('buy', '购买 · $' + this.g.cost(c), 'primary small', !this.g.afford(this.g.cost(c)), c.id);
    var node = document.createElement('div'); node.className = 'inventory-action';
    var mobile = this.layout.mode !== 'desktop';
    node.innerHTML = (mobile && !c.flipped ? '<div class="action-description">' + this.tooltipHTML(c) + '</div>' : '') + '<div class="action-buttons">' + actions + button('unfocus', '关闭', 'small flat') + '</div>';
    if (!mobile) { var pos = this.positions && this.positions[c.id]; node.style.left = U.clamp(pos ? pos.x - 15 : 700, 340, 1340) + 'px'; node.style.top = ((pos ? pos.y + pos.w * 1.4 : 540) + 40) + 'px'; }
    else document.body.classList.add('with-actions');
    $('stage').appendChild(node);
  };
  P.renderMenu = function () {
    var d = D.DECKS[this.deckIndex], stored = U.load('bt-run-v1', null), canContinue = stored && stored.version === 1 && Number.isFinite(stored.ante) && Number.isFinite(stored.money) && stored.phase !== 'game_over';
    $('menu').innerHTML = '<div class="menu-layout"><div><h1 class="menu-title">BalaBala<span>Tro.</span></h1><div class="menu-subtitle">一 手 好 戏，不 止 于 运 气。</div><p class="menu-intro">从一副普通纸牌开始，让小丑改写规则。<br>组合牌型、叠加倍率，在八个底注里搭出自己的好戏。</p><div class="menu-fan">' + [ { kind: 'playing', rank: 14, suit: 'S' }, { kind: 'joker', key: 'joker' }, { kind: 'playing', rank: 13, suit: 'H' }, { kind: 'joker', key: 'blueprint' }, { kind: 'planet', key: 'saturn' } ].map(function (c, i) { return '<img alt="" src="' + BT.Art.image(c) + '" style="left:' + (55 + i * 72) + 'px;top:' + (Math.abs(i - 2) * 9) + 'px;transform:rotate(' + ((i - 2) * 12) + 'deg)">'; }).join('') + '</div></div><div><div class="menu-form"><h2>下一局，由你开场。</h2><div class="deck-picker">' + button('deck-prev', '‹', 'flat') + '<div class="deck-icon" style="--deck:' + d.color + '">♠</div><div><h3>' + d.zh + '</h3><span class="quiet">' + (this.deckIndex + 1) + ' / 15 · ' + d.en + '</span></div>' + button('deck-next', '›', 'flat') + '</div><div class="deck-desc dark-rich">' + U.rich(d.desc) + '</div><label for="stake-select">赌 注 · 效果逐级叠加</label><select id="stake-select">' + D.STAKES.map(function (s, i) { return '<option value="' + (i + 1) + '"' + (Number(this.menuStake || 1) === i + 1 ? ' selected' : '') + '>' + s.zh + ' — ' + U.plain(s.desc).replace(/\n/g, ' ') + '</option>'; }, this).join('') + '</select><label for="seed-input">种 子 · 留空随机</label><input id="seed-input" maxlength="32" autocomplete="off" placeholder="例如 ONEGOODHAND" value="' + U.esc(this.menuSeed || '') + '">' + button('start', '开始游戏 →', 'primary') + (canContinue ? button('continue', '继续上次 · 底注 ' + stored.ante + ' · $' + stored.money, 'continue') : '') + '</div><div class="menu-secondary">' + button('rules', '玩法指南', 'small flat') + button('collection', '完整图鉴', 'small flat') + button('options', '设置', 'small flat') + '</div></div></div>';
  };
  P.clearSelection = function () { if (this.busy) return; this.selected = this.g.run ? this.g.run.hand.filter(function (c) { return c.forced; }).map(function (c) { return c.id; }) : []; this.activeId = null; if (this.g.run) this.render(); };
  P.toggleCard = function (id, zone) {
    if (zone !== 'hand') { this.activeId = this.activeId === id ? null : id; this.inventoryActions(); var infoCard = this.findCard(id); if (infoCard && !infoCard.flipped && this.activeId) this.toast(U.plain(this.description(infoCard)).replace(/\n/g, ' · ').slice(0, 64)); return; }
    var c = this.findCard(id), i = this.selected.indexOf(id); if (c.forced && i >= 0) { this.toast('这张牌被蔚蓝之铃强制选中'); return; }
    if (i >= 0) this.selected.splice(i, 1); else if (this.selected.length < 5) this.selected.push(id); else { this.toast('最多选择 5 张牌'); return; }
    BT.Audio.play('card'); this.render();
  };
  P.act = function (fn) { if (this.busy) return; this.view = U.clone(this.g.run); this.activeId = null; $('tooltip').hidden = true; var result = fn(); if (result === false) { BT.Audio.play('error'); this.toast('当前无法执行：请检查资金、槽位或目标选择'); } };
  P.click = function (e) {
    var clickedCard = e.target.closest('[data-card]');
    if (this.suppressedCard && clickedCard && Number(clickedCard.dataset.card) === this.suppressedCard.id && Date.now() < this.suppressedCard.until) { this.suppressedCard = null; return; }
    this.suppressedCard = null; BT.Audio.unlock();
    var card = e.target.closest('[data-card]'); if (card && !this.busy && $('modal').hidden) { this.toggleCard(Number(card.dataset.card), card.dataset.zone); return; }
    var btn = e.target.closest('[data-act]'); if (!btn || btn.disabled || this.busy) return;
    var act = btn.dataset.act, value = btn.dataset.value, g = this.g, self = this; BT.Audio.play('click');
    switch (act) {
      case 'start':
        if (g.run && g.run.phase !== 'game_over' && !this.newConfirmed) { this.openModal('开始新的一局？', '<div class="rules-content"><p>当前自动存档将被新的一局替换。</p><br>' + button('start-confirm', '确认开始新局', 'primary') + '</div>'); break; }
        this.menuSeed = $('seed-input').value.trim().toUpperCase(); this.menuStake = Number($('stake-select').value); this.menuOpen = false; this.newConfirmed = false; this.closeModal(); this.selected = []; g.noSave = false; g.start({ deck: D.DECKS[this.deckIndex].key, stake: this.menuStake, seed: this.menuSeed }); break;
      case 'start-confirm': this.newConfirmed = true; this.closeModal(); this.click({ target: $('menu').querySelector('[data-act="start"]') }); break;
      case 'continue': this.menuOpen = false; g.noSave = false; if (!g.load()) { this.menuOpen = true; this.toast('存档不可读取'); } this.render(); break;
      case 'menu': this.menuOpen = !this.menuOpen; this.activeId = null; this.render(); break;
      case 'deck-prev': case 'deck-next': this.menuSeed = $('seed-input').value; this.menuStake = $('stake-select').value; this.deckIndex = (this.deckIndex + (act === 'deck-prev' ? 14 : 1)) % 15; this.renderMenu(); break;
      case 'blind': this.act(function () { return g.selectBlind(value); }); break;
      case 'skip-blind': this.act(function () { return g.skipBlind(value); }); break;
      case 'play': this.act(function () { return g.play(self.selected); }); break;
      case 'discard': this.act(function () { return g.discard(self.selected); }); break;
      case 'sort-rank': case 'sort-suit': g.sortHand(act === 'sort-rank' ? 'rank' : 'suit'); g.save(); this.render(); break;
      case 'reroll': this.act(function () { return g.reroll(); }); break;
      case 'leave': this.act(function () { return g.leaveShop(); }); break;
      case 'cash': this.act(function () { return g.cashOut(); }); break;
      case 'buy': this.act(function () { return g.buy(Number(value)); }); break;
      case 'choose-pack': this.act(function () { return g.choosePack(Number(value), self.selected); }); break;
      case 'skip-pack': this.act(function () { return g.skipPack(); }); break;
      case 'use': this.act(function () { return g.use(Number(value), self.selected); }); break;
      case 'sell-confirm': var c = this.findCard(Number(value)); this.openModal('出售 ' + this.cardName(c) + '？', '<div class="rules-content"><p>将获得 $' + g.sellValue(c) + '，这张牌的能力会立即移除。</p><br>' + button('sell', '确认出售', 'primary', false, value) + '</div>'); break;
      case 'sell': this.closeModal(); this.act(function () { return g.sell(Number(value)); }); break;
      case 'endless': this.act(function () { return g.continueEndless(); }); break;
      case 'boss-reroll': this.act(function () { return g.rerollBoss(); }); break;
      case 'unfocus': this.activeId = null; this.inventoryActions(); break;
      case 'options': this.options(); break;
      case 'hand-details': this.cardDetails(this.selected[this.selected.length - 1]); break;
      case 'inventory': this.inventoryPanel(); break;
      case 'owned-card': this.closeModal(); this.activeId = Number(value); this.inventoryActions(); break;
      case 'detail-select': this.closeModal(); this.toggleCard(Number(value), 'hand'); break;
      case 'storage': this.storagePanel(); break;
      case 'export-save': this.exportSave(); break;
      case 'import-save': $('save-file').click(); break;
      case 'import-confirm': this.confirmImport(); break;
      case 'music': BT.Audio.toggleMusic(); this.options(); break;
      case 'mute': BT.Audio.toggle(); this.options(); break;
      case 'respect-system': this.settings.respectSystem = !this.settings.respectSystem; this.applySettings(); this.options(); break;
      case 'crt': this.settings.crt = !this.settings.crt; this.applySettings(); this.options(); break;
      case 'reduced': this.settings.reduced = !this.settings.reduced; this.applySettings(); this.options(); break;
      case 'close': this.closeModal(); break;
      case 'info': this.info(); break;
      case 'deck': this.deck(); break;
      case 'rules': this.rules(); break;
      case 'collection': this.collection('joker'); break;
      case 'collection-tab': this.collection(value); break;
      case 'collection-card': this.collectionDetail(value); break;
    }
  };
  P.changed = async function (events) {
    try {
      var score = events.some(function (e) { return e.type === 'score'; });
      var level = events.some(function (e) { return e.type === 'level'; });
      var roundMotion = this.view && this.view.phase === 'round' && events.some(function (e) { return e.type === 'discard_cards' || e.type === 'draw_cards'; });
      if (!this.isReduced() && score) await this.animate(events);
      else if (!this.isReduced() && (level || roundMotion)) await this.animateAction(events);
      else {
        if (events.some(function (e) { return e.type === 'money'; })) BT.Audio.play('money'); this.render();
        var lastLevel = events.filter(function (e) { return e.type === 'level'; }).pop(), finalScore = events.filter(function (e) { return e.type === 'score'; }).pop();
        if (finalScore && finalScore.cleared) this.toast('盲注击破 · ' + U.fmt(finalScore.total) + ' 分');
        else if (lastLevel) this.toast(D.HAND[lastLevel.hand].zh + '升至等级 ' + lastLevel.level);
      }
    } catch (e) { console.error('界面事件回放失败', e); this.busy = false; this.render(); this.toast('动画已恢复，请继续游戏'); }
  };
  P.applyZonesEvent = function (e, view) {
    var by = {}; e.cards.forEach(function (c) { by[c.id] = c; });
    ['hand', 'play', 'jokers', 'cons'].forEach(function (z) { view[z] = e[z].map(function (id) { return by[id]; }); });
    this.view = view; this.updateLayout(); this.layoutCards();
  };
  P.animateDiscard = async function (e, wait) {
    var self = this; e.ids.forEach(function (id, i) { var node = self.nodes.get(id); if (node) { node.style.setProperty('--throw-x', ((i - (e.ids.length - 1) / 2) * 42) + 'px'); node.classList.add('discarding'); } });
    BT.Audio.play('card'); await wait(e.hook ? 190 : 270);
  };
  P.animateDraw = async function (e, wait) {
    var self = this; e.ids.forEach(function (id, i) { var node = self.nodes.get(id); if (node) { node.style.animationDelay = (i * 28) + 'ms'; node.classList.add('drawing'); } });
    BT.Audio.play('card'); await wait(250 + e.ids.length * 24);
    e.ids.forEach(function (id) { var node = self.nodes.get(id); if (node) { node.classList.remove('drawing'); node.style.animationDelay = ''; } });
  };
  P.levelBurst = function (e) {
    var def = D.HAND[e.hand], node = document.createElement('div'), source = this.nodes.get(e.src), up = e.amount >= 0;
    if (source) { source.classList.remove('pulse'); void source.offsetWidth; source.classList.add('pulse'); }
    if ($('hand-name')) $('hand-name').textContent = def.zh + ' · 等级 ' + e.level;
    if ($('chips-value')) $('chips-value').textContent = U.fmt(e.chips);
    if ($('mult-value')) $('mult-value').textContent = U.fmt(e.mult);
    node.className = 'level-burst ' + (up ? 'level-up' : 'level-down');
    node.innerHTML = '<span class="level-kicker">' + (up ? '牌型升级' : '牌型降级') + '</span><strong>' + def.zh + '</strong><span>等级 ' + e.level + '　' + U.fmt(e.chips) + ' 筹码 × ' + U.fmt(e.mult) + ' 倍率</span>';
    $('floating').appendChild(node); BT.Audio.play('score'); setTimeout(function () { node.remove(); }, 2200);
  };
  P.previewScore = function (chips, mult, previous, target) {
    if (!Number.isFinite(chips) || !Number.isFinite(mult)) return;
    if ($('chips-value')) $('chips-value').textContent = U.fmt(chips);
    if ($('mult-value')) $('mult-value').textContent = U.fmt(mult);
    var total = previous + Math.max(0, Math.floor(chips * mult));
    if ($('round-total')) { $('round-total').textContent = U.fmt(total); $('round-total').classList.remove('tally-pop'); void $('round-total').offsetWidth; $('round-total').classList.add('tally-pop'); }
    if ($('score-progress') && target) $('score-progress').style.width = U.clamp(total / target * 100, 0, 100) + '%';
  };
  P.blindClearBurst = function (e) {
    var node = document.createElement('div'), particles = '', colors = ['#e9bc67', '#559fc9', '#e57c67', '#8fd3b4'];
    for (var i = 0; i < 22; i++) particles += '<i style="--a:' + (i * 16.36) + 'deg;--d:' + (i * 18) + 'ms;--c:' + colors[i % colors.length] + '"></i>';
    node.className = 'blind-clear'; node.innerHTML = '<div class="clear-ring"></div><strong>盲注击破</strong><span>超出 ' + U.fmt(Math.max(0, e.total - e.target)) + ' 分</span><div class="clear-particles">' + particles + '</div>';
    $('floating').appendChild(node); $('stage').classList.add('blind-cleared');
    setTimeout(function () { node.remove(); $('stage').classList.remove('blind-cleared'); }, 2200);
  };
  P.animateAction = async function (events) {
    this.busy = true; $('tooltip').hidden = true; var view = U.clone(this.view || this.g.run), speed = this.settings.speed;
    var wait = function (ms) { return new Promise(function (resolve) { setTimeout(resolve, ms / speed); }); };
    for (var i = 0; i < events.length; i++) {
      var e = events[i];
      if (e.type === 'discard_cards') await this.animateDiscard(e, wait);
      else if (e.type === 'level') { this.levelBurst(e); await wait(950); }
      else if (e.type === 'zones') { this.applyZonesEvent(e, view); await wait(80); }
      else if (e.type === 'draw_cards') await this.animateDraw(e, wait);
      else if (e.type === 'money') { if ($('money-value')) $('money-value').textContent = '$' + U.fmt(e.money); BT.Audio.play('money'); await wait(120); }
    }
    this.busy = false; this.render();
  };
  P.scorePhase = function (text) {
    var node = $('score-phase'); if (!node) { node = document.createElement('div'); node.id = 'score-phase'; node.className = 'score-phase'; $('floating').appendChild(node); }
    node.textContent = text;
  };
  P.multImpact = function (e) {
    var value = $('mult-value'); if (value) { value.classList.remove('mult-impact'); void value.offsetWidth; value.classList.add('mult-impact'); }
    var n = document.createElement('div'); n.className = 'mult-stamp'; n.textContent = 'X' + U.fmtX(e.amount); $('floating').appendChild(n); setTimeout(function () { n.remove(); }, 1000);
  };
  P.animate = async function (events) {
    this.busy = true; this.selected = []; $('tooltip').hidden = true;
    var view = U.clone(this.view || this.g.run); view.phase = 'round'; this.view = view; this.renderPanels();
    var speed = this.settings.speed, previous = view.round.chips, target = view.blind.chips, beat = 0, cardIndex = 0;
    var scoringCount = events.filter(function (e) { return e.type === 'card_start'; }).length;
    var wait = function (ms) { return new Promise(function (resolve) { setTimeout(resolve, ms / speed); }); };
    var pace = function (base) { return Math.max(160, base * Math.pow(0.97, beat++)); }; this.scorePhase('准备计分');
    for (var i = 0; i < events.length; i++) {
      var e = events[i], node;
      if (e.type === 'discard_cards') { await this.animateDiscard(e, wait); continue; }
      if (e.type === 'zones') { this.applyZonesEvent(e, view); await wait(85); continue; }
      if (e.type === 'draw_cards') { await this.animateDraw(e, wait); continue; }
      if (e.type === 'level') { this.levelBurst(e); await wait(760); continue; }
      if (e.type === 'base') { $('hand-name').textContent = (e.royal ? '皇家同花顺' : D.HAND[e.hand].zh) + ' · 等级 ' + this.g.run.hands[e.hand].level; this.previewScore(e.chips, e.mult, previous, target); await wait(480); continue; }
      if (e.type === 'card_start') { this.scorePhase('纸牌计分 · ' + (++cardIndex) + ' / ' + scoringCount); node = this.nodes.get(e.card); if (node) node.classList.add('scoring'); await wait(pace(340)); continue; }
      if (e.type === 'card_end') { node = this.nodes.get(e.card); if (node) node.classList.remove('scoring'); this.previewScore(e.chips, e.mult, previous, target); await wait(pace(290)); continue; }
      if (e.type === 'score_phase') { this.scorePhase(e.label); beat = 0; await wait(340); continue; }
      if (e.type === 'balance') { this.previewScore(e.chips, e.mult, previous, target); this.float('平衡', null, 'chips'); await wait(pace(190)); continue; }
      if (['chips', 'mult', 'xmult', 'hmult', 'message', 'retrigger', 'money'].indexOf(e.type) >= 0) {
        node = this.nodes.get(e.src); if (node) { node.classList.remove('pulse'); void node.offsetWidth; node.classList.add('pulse'); }
        var text = e.type === 'message' ? e.text : e.type === 'retrigger' ? '再触发！' : e.type === 'money' ? (e.amount > 0 ? '+' : '') + '$' + e.amount : (e.type === 'xmult' ? 'X' : '+') + U.fmtX(e.amount);
        this.float(text, e.src, e.type); if (e.type === 'money' && $('money-value')) $('money-value').textContent = '$' + U.fmt(e.money);
        if (e.chips !== undefined) this.previewScore(e.chips, e.mult, previous, target);
        if (e.type === 'xmult') this.multImpact(e);
        BT.Audio.play(e.type === 'chips' ? 'chip' : e.type === 'money' ? 'money' : 'mult', beat); await wait(e.type === 'xmult' ? Math.max(360, pace(580)) : e.type === 'retrigger' ? pace(360) : e.quiet ? 130 : pace(320)); continue;
      }
      if (e.type === 'score') {
        this.scorePhase('本手得分 · ' + U.fmt(e.score)); await wait(550);
        $('round-total').textContent = U.fmt(e.total); $('score-progress').style.width = (Number.isFinite(e.target) && e.target > 0 ? U.clamp(e.total / e.target * 100, 0, 100) : 0) + '%';
        this.float(U.fmt(e.score) + ' 分', null, 'score'); BT.Audio.play('score'); if (e.cleared) this.blindClearBurst(e); await wait(e.cleared ? 1650 : 950);
      }
    }
    if ($('score-phase')) $('score-phase').remove();
    this.busy = false; this.render();
  };
  P.float = function (text, id, type) { var p = this.positions && this.positions[id], n = document.createElement('div'); n.className = 'score-float'; n.textContent = text; n.style.left = U.clamp(p ? p.x + p.w / 2 - 25 : this.layout.play.x + this.layout.play.width / 2 - 70, 12, this.layout.width - 150) + 'px'; n.style.top = (p ? p.y - 15 : this.layout.play.y + 30) + 'px'; n.style.color = type === 'chips' ? 'var(--blue)' : type === 'money' || type === 'score' ? 'var(--gold)' : 'var(--red)'; $('floating').appendChild(n); setTimeout(function () { n.remove(); }, 1000); };
  P.inventoryPanel = function () {
    var r = this.g.run, self = this;
    this.openModal('小丑与消耗牌', '<div class="inventory-grid">' + r.jokers.concat(r.cons).map(function (c) { return '<button class="inventory-item" data-act="owned-card" data-value="' + c.id + '"><img alt="" src="' + BT.Art.image(c, c.flipped) + '"><span>' + (c.flipped ? '背面朝上' : U.esc(self.cardName(c))) + '</span></button>'; }).join('') + '</div>');
  };
  P.cardDetails = function (id) {
    var c = this.findCard(id); if (!c || c.flipped) { this.toast('背面朝上的牌无法查看'); return; }
    var selected = this.selected.indexOf(id) >= 0, hand = this.g.run.hand.indexOf(c) >= 0;
    this.openModal(this.cardName(c), '<div class="card-detail"><img alt="" src="' + BT.Art.image(c) + '"><div>' + this.tooltipHTML(c) + '</div></div>' + (hand ? button('detail-select', selected ? '取消选择' : '选择这张牌', 'primary', c.forced && selected, id) : ''));
  };
  P.pointerDown = function (e) {
    var node = e.target.closest('.card'); if (!node || this.busy || e.button !== 0 || !$('modal').hidden || this.menuOpen || this.drag) return;
    var zone = node.dataset.zone, p = this.point(e), self = this;
    this.drag = { node: node, id: Number(node.dataset.card), zone: zone, sortable: ['hand', 'jokers', 'cons'].indexOf(zone) >= 0, pointer: e.pointerId, start: p, x: parseFloat(node.style.left), y: parseFloat(node.style.top), moved: false };
    if (e.pointerType === 'touch') this.pressTimer = setTimeout(function () { var d = self.drag; if (d && !d.moved) { self.suppressedCard = { id: d.id, until: Date.now() + 1000 }; self.cancelDrag(); self.cardDetails(d.id); } }, 520);
    if (this.drag.sortable) { try { node.setPointerCapture(e.pointerId); } catch (error) {} }
    $('tooltip').hidden = true;
  };
  P.pointerMove = function (e) {
    var d = this.drag; if (!d) { this.hover(e); return; } if (d.pointer !== e.pointerId) return; var p = this.point(e);
    if (Math.hypot(p.x - d.start.x, p.y - d.start.y) > 10) { d.moved = true; clearTimeout(this.pressTimer); }
    if (!d.moved || !d.sortable) return;
    d.node.classList.add('dragging'); d.node.style.left = (d.x + p.x - d.start.x) + 'px'; d.node.style.top = (d.y + p.y - d.start.y) + 'px';
  };
  P.pointerUp = function (e) {
    clearTimeout(this.pressTimer); var d = this.drag; if (!d || d.pointer !== e.pointerId) return;
    var p = this.point(e), to = 0, distance = Infinity, self = this;
    if (d.moved && d.sortable) this.g.run[d.zone].forEach(function (c, i) { var pos = self.positions[c.id], delta = Math.hypot(p.x - pos.x - pos.w / 2, p.y - pos.y - pos.w * 0.7); if (delta < distance) { distance = delta; to = i; } });
    this.drag = null; d.node.classList.remove('dragging'); if (d.node.hasPointerCapture(e.pointerId)) d.node.releasePointerCapture(e.pointerId);
    if (d.moved) this.suppressedCard = { id: d.id, until: Date.now() + 1000 };
    if (d.moved && d.sortable) this.g.reorder(d.zone, d.id, to);
  };
  P.cancelDrag = function () { clearTimeout(this.pressTimer); if (this.drag) { var d = this.drag; this.drag = null; d.node.classList.remove('dragging'); if (d.node.hasPointerCapture(d.pointer)) d.node.releasePointerCapture(d.pointer); if (!this.busy) this.render(); } };
  P.openModal = function (title, html) {
    this.activeId = null; this.inventoryActions(); $('tooltip').hidden = true; this.previousFocus = document.activeElement;
    $('modal').innerHTML = '<section class="modal-box" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div class="modal-head"><h2 id="modal-title">' + U.esc(title) + '</h2>' + button('close', '关闭 Esc', 'small flat') + '</div><div class="modal-content">' + html + '</div></section>';
    $('modal').hidden = false; $('modal').querySelector('button').focus();
  };
  P.closeModal = function () { $('modal').hidden = true; if (this.previousFocus && this.previousFocus.isConnected) this.previousFocus.focus(); };
  P.key = function (e) {
    if (!$('modal').hidden) {
      if (e.key === 'Escape') this.closeModal();
      if (e.key === 'Tab') { var nodes = Array.from($('modal').querySelectorAll('button:not(:disabled),select,input')), at = nodes.indexOf(document.activeElement); if (e.shiftKey && at <= 0) { e.preventDefault(); nodes[nodes.length - 1].focus(); } else if (!e.shiftKey && at === nodes.length - 1) { e.preventDefault(); nodes[0].focus(); } } return;
    }
    if (/INPUT|SELECT/.test(e.target.tagName) || this.busy) return;
    if (e.key === 'Escape') { if (this.activeId) { this.activeId = null; this.inventoryActions(); } else if (this.g.run) { this.menuOpen = !this.menuOpen; this.render(); } return; }
    if (this.menuOpen || !this.g.run) return; var g = this.g, self = this;
    if (e.key === 'Enter' && (e.target.tagName !== 'BUTTON' || e.target.classList.contains('card'))) { e.preventDefault(); this.act(function () { return g.play(self.selected); }); }
    if (e.key.toLowerCase() === 'x') this.act(function () { return g.discard(self.selected); });
    if (e.key.toLowerCase() === 'r' || e.key.toLowerCase() === 's') { g.sortHand(e.key.toLowerCase() === 'r' ? 'rank' : 'suit'); g.save(); this.render(); }
    if (/^[1-9]$/.test(e.key) && g.run.hand[Number(e.key) - 1]) this.toggleCard(g.run.hand[Number(e.key) - 1].id, 'hand');
  };
  P.settingChanged = function (e) {
    if (e.target.id === 'speed-select') { this.settings.speed = Number(e.target.value); this.applySettings(); }
    if (e.target.id === 'volume-input') BT.Audio.setVolume(Number(e.target.value) / 100);
    if (e.target.id === 'save-file') this.importSave(e.target.files[0]);
  };
  P.options = function () {
    this.openModal('设置', '<div class="setting-row"><div><h3>计分动画速度</h3></div><select id="speed-select" aria-label="动画速度">' + [0.5, 1, 2, 4].map(function (n) { return '<option' + (n === this.settings.speed ? ' selected' : '') + '>' + n + '</option>'; }, this).join('') + '</select></div><div class="setting-row"><div><h3>背景音乐</h3></div>' + button('music', BT.Audio.isMusicOn() ? '已开启' : '已关闭') + '</div><div class="setting-row"><div><h3>音效</h3></div>' + button('mute', BT.Audio.isMuted() ? '已关闭' : '已开启') + '</div><div class="setting-row"><label for="volume-input">总音量</label><input id="volume-input" type="range" min="0" max="100" value="' + Math.round(BT.Audio.getVolume() * 100) + '"></div><div class="setting-row"><div><h3>扫描线</h3></div>' + button('crt', this.settings.crt ? '已开启' : '已关闭') + '</div><div class="setting-row"><div><h3>减少动态效果</h3><p>静态背景，立即显示结果</p></div>' + button('reduced', this.settings.reduced ? '已开启' : '已关闭') + '</div><div class="setting-row"><div><h3>跟随系统动效设置</h3></div>' + button('respect-system', this.settings.respectSystem ? '已开启' : '已关闭') + '</div><div class="setting-row"><div><h3>存档与备份</h3></div>' + button('storage', '管理存档') + '</div>');
  };
  P.storagePanel = function () {
    this.openModal('存档与备份', '<div class="rules-content"><p>进度保存在当前浏览器。换设备时，请导出存档后再导入。</p><p>自动保存：' + (BT.Storage.status().local === 'ready' ? '正常' : '不可用，请导出备份') + '</p><br>' + button('export-save', '导出当前存档', 'primary', !this.g.run) + ' ' + button('import-save', '导入存档文件') + '<input id="save-file" type="file" accept=".json,application/json" hidden><p class="quiet" style="margin-top:18px">导入将覆盖当前存档，请先备份。仅支持 JSON 文件，最大 2 MB。</p></div>');
  };
  P.exportSave = function () {
    try { var text = BT.Storage.exportRun(this.g.serialize()), blob = new Blob([text], { type: 'application/json' }), url = URL.createObjectURL(blob), link = document.createElement('a'); link.href = url; link.download = 'BalaBalaTro-' + this.g.run.seed.replace(/[^A-Z0-9_-]/gi, '_') + '.json'; document.body.appendChild(link); link.click(); link.remove(); setTimeout(function () { URL.revokeObjectURL(url); }, 10000); this.toast('存档已导出'); }
    catch (e) { this.toast(e.message); }
  };
  P.importSave = async function (file) {
    if (!file) return; if (file.size > 2 * 1024 * 1024) { this.toast('文件超过 2 MB 限制'); return; }
    try { this.pendingImport = BT.Storage.importRun(await file.text()); this.openModal('确认导入存档？', '<div class="rules-content"><p>将恢复底注 ' + this.pendingImport.ante + '，资金 $' + U.fmt(this.pendingImport.money) + '，并替换当前浏览器存档。</p><br>' + button('import-confirm', '确认恢复', 'primary') + '</div>'); }
    catch (e) { this.pendingImport = null; this.toast(e.message); }
  };
  P.confirmImport = function () {
    var data = this.pendingImport; this.pendingImport = null; if (!data) return;
    this.closeModal(); this.menuOpen = false; this.selected = []; this.g.noSave = false;
    if (!this.g.restore(data)) this.toast('恢复失败，原存档未替换'); else this.toast('存档已恢复');
  };
  P.info = function () {
    var r = this.g.run;
    this.openModal('本局 · 牌型', '<table class="hand-table"><thead><tr><th>牌型</th><th>等级</th><th>筹码</th><th>倍率</th><th>累计打出</th></tr></thead><tbody>' + D.HANDS.filter(function (h) { return r.hands[h.key].visible; }).map(function (h) { var s = r.hands[h.key]; return '<tr><td><span class="type">' + h.zh + '</span><br><span class="quiet">' + D.HAND_DESC[h.key] + '</span></td><td>' + s.level + '</td><td style="color:var(--blue)">' + U.fmt(s.chips) + '</td><td style="color:var(--red)">' + U.fmt(s.mult) + '</td><td>' + s.played + '</td></tr>'; }).join('') + '</tbody></table><div class="setting-row"><span>已购买优惠券</span><span>' + (Object.keys(r.vouchers).map(function (k) { return D.VOUCHER[k].zh; }).join(' · ') || '暂无') + '</span></div>');
  };
  P.deck = function () {
    var g = this.g, r = g.run, cards = r.deck.slice().sort(function (a, b) { return g.nominalOf(b, 'suit') - g.nominalOf(a, 'suit'); });
    this.openModal('完整牌组 · ' + cards.length + ' 张', '<p class="quiet" style="margin-bottom:20px">' + D.SUITS.map(function (s) { return D.SUIT[s].sym + ' ' + cards.filter(function (c) { return c.enh !== 'stone' && c.suit === s; }).length; }).join('　') + '　增强牌 ' + g.countEnhanced() + ' 张 · 剩余牌库 ' + r.draw.length + ' 张</p><div class="deck-grid">' + cards.map(function (c) { return '<img alt="' + this.cardName(c) + '" title="' + this.cardName(c) + '" src="' + BT.Art.image(c) + '"' + (r.phase === 'round' && r.draw.indexOf(c) < 0 ? ' style="opacity:.35"' : '') + '>'; }, this).join('') + '</div>');
  };
  P.rules = function () {
    this.openModal('怎么玩 · 一手好戏', '<div class="rules-content"><h3>计分</h3><p>选择 1–5 张牌打出。只有组成牌型的牌计分，石头牌总会计分。得分 = 筹码 × 倍率；在出牌次数耗尽前达到目标分数。</p><h3>结算顺序</h3><p>出牌逐张计分 → 留在手牌中的能力 → 小丑从左到右结算。加倍率和乘倍率的顺序会影响得分，拖动可调整顺序。</p><h3>金钱</h3><p>过关后获得盲注奖励和剩余出牌奖励。每 $5 产生 $1 利息，默认上限 $5；绿色牌组不计利息。</p><h3>盲注与消耗牌</h3><p>每个底注依次挑战小盲注、大盲注和 Boss。小、大盲注可跳过并获得标签，但跳过后不进入商店。星球提升牌型等级，塔罗和幻灵改变牌组或资源。</p><h3>操作</h3><p>点击选牌，拖动排序；长按纸牌或点击“选牌详情”查看效果。消耗牌若需要目标，先选手牌再使用。</p><p><kbd>1–9</kbd> 选牌　<kbd>Enter</kbd> 出牌　<kbd>X</kbd> 弃牌　<kbd>R</kbd> 点数排序　<kbd>S</kbd> 花色排序　<kbd>右键</kbd> 清空选择　<kbd>Esc</kbd> 返回。</p></div>');
  };
  P.collection = function (kind) {
    this.collectionKind = kind; var list = kind === 'joker' ? BT.Jokers.LIST : kind === 'tarot' ? D.TAROTS : kind === 'planet' ? D.PLANETS : kind === 'spectral' ? D.SPECTRALS : D.VOUCHERS;
    var tabs = [['joker', '150 小丑'], ['tarot', '22 塔罗'], ['planet', '12 星球'], ['spectral', '18 幻灵'], ['voucher', '32 优惠券']];
    this.catalogCards = list.map(function (def) { var c = { kind: kind, key: def.key, ab: U.clone(def.ab || {}) }; if (kind === 'joker' && def.init) def.init(c, this.catalogGame); return c; }, this);
    this.openModal('图鉴', '<div class="modal-tabs">' + tabs.map(function (t) { return button('collection-tab', t[1], 'small' + (t[0] === kind ? ' active' : ''), false, t[0]); }).join('') + '</div><div id="collection-detail" hidden class="collection-detail"></div><div class="collection-grid">' + this.catalogCards.map(function (c) { return '<button data-act="collection-card" data-value="' + c.key + '" class="collection-item"><img src="' + BT.Art.image(c) + '" alt="">' + this.cardName(c) + '</button>'; }, this).join('') + '</div>');
  };
  P.collectionDetail = function (key) { var c = this.catalogCards.find(function (c) { return c.key === key; }); $('collection-detail').hidden = false; $('collection-detail').innerHTML = this.tooltipHTML(c); $('modal').querySelector('.modal-content').scrollTop = 0; };
  BT.UI = UI;
})(window.BT);
