#!/usr/bin/env node
/*
 * 把 index.html + css/style.css + js/*.js 内联成单个可双击打开的 HTML 文件。
 * 用法：node build.js
 * 项目零外部素材（牌面/背景/音效均由代码生成），内联后无任何依赖。
 */
'use strict';

var fs = require('fs');
var path = require('path');

var ROOT = __dirname;
var OUT_DIR = path.join(ROOT, 'dist');
var OUT_FILE = path.join(OUT_DIR, 'balabalatro.html');

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8').replace(/^\uFEFF/, '');
}

/* 内联脚本里若出现 </script 会提前闭合标签，必须转义 */
function safeScript(code) {
  return code.replace(/<\/script/gi, '<\\/script');
}

var html = read('index.html');

html = html.replace(/[ \t]*<link rel="stylesheet" href="([^"?]+)(?:\?[^"]*)?">[ \t]*\r?\n/g,
  function (_, href) {
    return '<style>\n' + read(href).trim() + '\n</style>\n';
  });

html = html.replace(/[ \t]*<script src="([^"?]+)(?:\?[^"]*)?"><\/script>[ \t]*\r?\n/g,
  function (_, src) {
    return '  <script>\n' + safeScript(read(src).trim()) + '\n  </script>\n';
  });

/* 只检查必须内联的资源：外链样式表与外链脚本（favicon 的 data URI 保持原样） */
var leftover = html.match(/<link[^>]+rel="stylesheet"[^>]*>|<script[^>]+src="[^"]+"/gi);
if (leftover) {
  console.error('仍有未内联的外部资源：\n  ' + leftover.join('\n  '));
  process.exit(1);
}

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(OUT_FILE, html);

console.log('已生成 ' + path.relative(ROOT, OUT_FILE) +
  '  (' + (Buffer.byteLength(html) / 1024).toFixed(1) + ' KB)');
