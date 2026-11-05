#!/usr/bin/env node
/* 零依赖静态服务器：npm run serve，可用于本地试玩与视觉验收。 */
'use strict';
var http = require('http');
var fs = require('fs');
var path = require('path');
var ROOT = __dirname;
var PORT = Number(process.env.PORT || 8767);
var MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml'
};
http.createServer(function (req, res) {
  var raw = decodeURIComponent((req.url || '/').split('?')[0]);
  if (raw === '/') raw = '/index.html';
  var file = path.resolve(ROOT, '.' + raw);
  if (file !== ROOT && file.indexOf(ROOT + path.sep) !== 0) {
    res.writeHead(403); res.end('Forbidden'); return;
  }
  fs.stat(file, function (err, stat) {
    if (err || !stat.isFile()) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    fs.createReadStream(file).pipe(res);
  });
}).listen(PORT, function () {
  console.log('BalaBalaTro 已启动：http://localhost:' + PORT);
});
