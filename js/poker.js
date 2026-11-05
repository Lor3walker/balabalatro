/*
 * 牌型判定：逐行移植原作 evaluate_poker_hand / get_X_same / get_flush / get_straight / get_highest。
 * 关键细节：
 *   - get_X_same 只收"恰好 N 张"的组，随后用"包含"关系补齐（五条含四条、四条含三条、三条含对子）
 *   - 四条不包含两对；葫芦包含三条、两对、对子
 *   - 同花判定忽略削弱（万能牌被削弱时除外），石头牌没有点数也没有花色
 *   - 四指：同花/顺子 4 张即可；捷径：顺子允许间隔 1；A 可作 1 但不能 K-A-2 回绕
 */
window.BT = window.BT || {};
(function (BT) {
  'use strict';

  function xSame(num, hand, g) {
    var vals = {};
    for (var i = hand.length - 1; i >= 0; i--) {
      var curr = [hand[i]], id = g.rid(hand[i]);
      for (var j = 0; j < hand.length; j++) if (i !== j && g.rid(hand[j]) === id) curr.push(hand[j]);
      if (curr.length === num && id > 0) vals[id] = curr;
    }
    var ret = [];
    for (var r = 14; r >= 1; r--) if (vals[r]) ret.push(vals[r]);
    return ret;
  }

  function getFlush(hand, g) {
    var need = g.has('four_fingers') ? 4 : 5;
    if (hand.length > 5 || hand.length < need) return [];
    var suits = BT.Data.SUITS;
    for (var s = 0; s < suits.length; s++) {
      var t = [];
      for (var i = 0; i < hand.length; i++) if (g.isSuit(hand[i], suits[s], false, true)) t.push(hand[i]);
      if (t.length >= need) return [t];
    }
    return [];
  }

  function getStraight(hand, g) {
    var need = g.has('four_fingers') ? 4 : 5;
    if (hand.length > 5 || hand.length < need) return [];
    var ids = {};
    hand.forEach(function (c) {
      var id = g.rid(c);
      if (id > 1 && id < 15) (ids[id] = ids[id] || []).push(c);
    });
    var len = 0, straight = false, canSkip = g.has('shortcut'), skipped = false, t = [];
    for (var j = 1; j <= 14; j++) {
      var key = j === 1 ? 14 : j;
      if (ids[key]) {
        len++; skipped = false;
        for (var k = 0; k < ids[key].length; k++) t.push(ids[key][k]);
      } else if (canSkip && !skipped && j !== 14) {
        skipped = true;
      } else {
        len = 0; skipped = false;
        if (!straight) t = [];
        if (straight) break;
      }
      if (len >= need) straight = true;
    }
    return straight ? [t] : [];
  }

  function getHighest(hand, g) {
    var best = null;
    hand.forEach(function (c) { if (!best || g.nominalOf(c) > g.nominalOf(best)) best = c; });
    return best ? [[best]] : [];
  }

  function evaluate(hand, g) {
    var p5 = xSame(5, hand, g), p4 = xSame(4, hand, g), p3 = xSame(3, hand, g), p2 = xSame(2, hand, g);
    var fl = getFlush(hand, g), st = getStraight(hand, g), hi = getHighest(hand, g);
    var R = { flush_five: [], flush_house: [], five: [], straight_flush: [], four: [], full_house: [], flush: [], straight: [], three: [], two_pair: [], pair: [], high: [] };
    if (p5.length && fl.length) R.flush_five = p5;
    if (p3.length && p2.length && fl.length) R.flush_house = [p3[0].concat(p2[0])];
    if (p5.length) R.five = p5;
    if (fl.length && st.length) {
      var ret = fl[0].slice();
      st[0].forEach(function (c) { if (ret.indexOf(c) < 0) ret.push(c); });
      R.straight_flush = [ret];
    }
    if (p4.length) R.four = p4;
    if (p3.length && p2.length) R.full_house = [p3[0].concat(p2[0])];
    if (fl.length) R.flush = fl;
    if (st.length) R.straight = st;
    if (p3.length) R.three = p3;
    if (p2.length === 2 || (p3.length === 1 && p2.length === 1)) R.two_pair = [p2[0].concat(p2[1] || p3[0])];
    if (p2.length) R.pair = p2;
    if (hi.length) R.high = hi;
    if (R.five.length) R.four = [R.five[0]];
    if (R.four.length) R.three = [R.four[0]];
    if (R.three.length) R.pair = [R.three[0]];
    return R;
  }

  var ORDER = ['flush_five', 'flush_house', 'five', 'straight_flush', 'four', 'full_house', 'flush', 'straight', 'three', 'two_pair', 'pair', 'high'];

  /* 返回 {hand, scoring, poker（包含关系）, royal}；scoring 按出牌顺序排列 */
  function info(cards, g) {
    var R = evaluate(cards, g), hand = null, scoring = [];
    for (var i = 0; i < ORDER.length; i++) if (R[ORDER[i]].length) { hand = ORDER[i]; scoring = R[hand][0]; break; }
    var poker = {};
    ORDER.forEach(function (k) { poker[k] = R[k].length > 0; });
    var royal = false;
    if (hand === 'straight_flush') royal = scoring.every(function (c) { return g.rid(c) >= 10; });
    scoring = cards.filter(function (c) { return scoring.indexOf(c) >= 0; });
    return { hand: hand, scoring: scoring, poker: poker, royal: royal };
  }

  BT.Poker = { evaluate: evaluate, info: info, ORDER: ORDER };
})(window.BT);
