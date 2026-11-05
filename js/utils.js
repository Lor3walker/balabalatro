/* 通用工具：可存档的种子随机数、洗牌与加权抽取、数字格式、富文本描述、本地存档 */
window.BT = window.BT || {};
(function (BT) {
  'use strict';

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function lerp(a, b, t) { return a + (b - a) * t; }

  /* 种子字符串 → 32 位整数（FNV-1a），原作种子是 8 位大写字母数字 */
  function hashSeed(str) {
    var h = 2166136261 >>> 0;
    str = String(str);
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return h >>> 0;
  }

  var SEED_CHARS = 'ABCDEFGHIJKLMNPQRSTUVWXYZ123456789';
  function randomSeed() {
    var s = '';
    for (var i = 0; i < 8; i++) s += SEED_CHARS[Math.floor(Math.random() * SEED_CHARS.length)];
    return s;
  }

  /* mulberry32：状态只有一个整数，存档 / 读档可完全复现后续随机序列 */
  function Rng(seed) { this.s = (typeof seed === 'number' ? seed : hashSeed(seed)) >>> 0; }
  Rng.prototype.next = function () {
    var a = this.s = (this.s + 0x6D2B79F5) >>> 0;
    var t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  Rng.prototype.int = function (lo, hi) { return lo + Math.floor(this.next() * (hi - lo + 1)); };
  Rng.prototype.pick = function (arr) { return arr.length ? arr[Math.floor(this.next() * arr.length)] : undefined; };
  Rng.prototype.pickIndex = function (arr) { return Math.floor(this.next() * arr.length); };
  Rng.prototype.shuffle = function (arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(this.next() * (i + 1)), t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  };
  /* items: [{w: 权重, ...}] */
  Rng.prototype.weighted = function (items, key) {
    key = key || 'w';
    var total = 0, i;
    for (i = 0; i < items.length; i++) total += items[i][key];
    var r = this.next() * total;
    for (i = 0; i < items.length; i++) { r -= items[i][key]; if (r < 0) return items[i]; }
    return items[items.length - 1];
  };

  /* 原作格式：1e11 以下千分位，以上转科学计数（4 位有效数字） */
  function fmt(n) {
    if (n === Infinity) return '∞';
    if (n !== n) return 'naneinf';
    var neg = n < 0; n = Math.abs(n);
    var s;
    if (n >= 1e11) {
      var e = Math.floor(Math.log10(n)), m = n / Math.pow(10, e);
      if (m >= 9.9995) { m /= 10; e += 1; }
      s = m.toFixed(3) + 'e' + e;
    } else {
      var whole = Math.floor(n), frac = n - whole;
      s = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      if (frac > 1e-9 && n < 1000) s = (Math.round(n * 100) / 100).toString();
    }
    return (neg ? '-' : '') + s;
  }

  /* 倍率显示：最多两位小数，去掉尾零 */
  function fmtX(n) {
    if (n >= 1e11) return fmt(n);
    return String(Math.round(n * 100) / 100);
  }

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
  }

  /*
   * 描述富文本：{m}+4{} 倍率红 · {c} 筹码蓝 · {x} X倍率（红底白字）· {$} 金钱 · {o} 关键词橙
   * {g} 概率绿 · {t} 塔罗紫 · {p} 星球青 · {s} 幻灵蓝 · {e} 版本彩 · {i} 灰色备注 · {h} 红桃 等花色
   */
  var TAGS = { m: 'tx-mult', c: 'tx-chips', x: 'tx-xmult', $: 'tx-money', o: 'tx-key', g: 'tx-prob', t: 'tx-tarot',
    p: 'tx-planet', s: 'tx-spectral', e: 'tx-edition', i: 'tx-dim', S: 'tx-spade', H: 'tx-heart', C: 'tx-club', D: 'tx-diamond',
    r: 'tx-red', b: 'tx-blue', l: 'tx-legend', w: 'tx-white' };
  function rich(text) {
    var out = '', open = false;
    var parts = String(text).split(/(\{[a-zA-Z$]?\}|\n)/);
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i];
      if (!p) continue;
      if (p === '\n') { if (open) { out += '</span>'; open = false; } out += '<br>'; continue; }
      var m = /^\{([a-zA-Z$]?)\}$/.exec(p);
      if (m) {
        if (open) { out += '</span>'; open = false; }
        if (m[1] && TAGS[m[1]]) { out += '<span class="' + TAGS[m[1]] + '">'; open = true; }
        continue;
      }
      out += esc(p);
    }
    if (open) out += '</span>';
    return out;
  }
  function plain(text) { return String(text).replace(/\{[a-zA-Z$]?\}/g, ''); }

  function load(key, fallback) {
    try {
      var v = window.localStorage.getItem(key);
      return v === null ? fallback : JSON.parse(v);
    } catch (e) { return fallback; }
  }
  function save(key, val) {
    try { window.localStorage.setItem(key, JSON.stringify(val)); } catch (e) { /* 隐私模式静默降级 */ }
  }
  function remove(key) { try { window.localStorage.removeItem(key); } catch (e) { /* 忽略 */ } }

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  BT.Utils = {
    clamp: clamp, lerp: lerp, hashSeed: hashSeed, randomSeed: randomSeed, Rng: Rng,
    fmt: fmt, fmtX: fmtX, esc: esc, rich: rich, plain: plain,
    load: load, save: save, remove: remove, clone: clone
  };
})(window.BT);
