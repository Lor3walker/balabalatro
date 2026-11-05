/* Chromium 自动集成验收：真实 viewport、鼠标/触摸、音频生命周期与静态单文件。零第三方依赖。 */
'use strict';
var assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), spawn = require('node:child_process').spawn;
var ROOT = path.resolve(__dirname, '..'), URL_BASE = process.env.URL || 'http://localhost:8767';
var executable = process.env.CHROME || (process.platform === 'darwin' ? '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge' : 'chromium');
var child, socket, seq = 0, pending = new Map(), errors = [], passed = 0;
function delay(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function command(method, params) { return new Promise(function (resolve, reject) { var id = ++seq, timer = setTimeout(function () { pending.delete(id); reject(new Error('CDP 超时：' + method)); }, 12000); pending.set(id, { resolve: resolve, reject: reject, timer: timer }); socket.send(JSON.stringify({ id: id, method: method, params: params || {} })); }); }
async function evaluate(expression) {
  var result = await command('Runtime.evaluate', { expression: expression, awaitPromise: true, returnByValue: true, userGesture: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text + ' ' + JSON.stringify(result.exceptionDetails.exception));
  return result.result.value;
}
async function wait(expression) { for (var i = 0; i < 120; i++) { if (await evaluate(expression)) return; await delay(50); } throw new Error('等待失败：' + expression); }
async function navigate(scene, single) {
  await command('Page.navigate', { url: URL_BASE + '/' + (single ? 'dist/balabalatro.html' : 'index.html') + '?scene=' + (scene || 'menu') + '&test=' + Date.now() });
  await wait('!!(window.BT && BT.app && BT.app.ui.layout)'); await delay(160);
}
async function metrics(w, h, mobile) { await command('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: !!mobile }); await command('Emulation.setTouchEmulationEnabled', { enabled: !!mobile, maxTouchPoints: 1 }); }
async function click(selector, touch) {
  var p = await evaluate('(function(){var n=document.querySelector(' + JSON.stringify(selector) + ');if(!n)throw new Error("目标不存在");n.scrollIntoView({block:"center"});var r=n.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,disabled:n.disabled};})()');
  assert.ok(!p.disabled, '按钮不能被禁用：' + selector); await delay(80);
  if (touch) { await command('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: p.x, y: p.y }] }); await command('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); }
  else { await command('Input.dispatchMouseEvent', { type: 'mouseMoved', x: p.x, y: p.y }); await command('Input.dispatchMouseEvent', { type: 'mousePressed', x: p.x, y: p.y, button: 'left', clickCount: 1 }); await command('Input.dispatchMouseEvent', { type: 'mouseReleased', x: p.x, y: p.y, button: 'left', clickCount: 1 }); }
  await delay(120);
}
async function screenshot(name) { var r = await command('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }); fs.writeFileSync(path.join(ROOT, 'screenshots/verify-' + name + '.png'), Buffer.from(r.data, 'base64')); }
async function test(name, fn) { await fn(); passed++; console.log('通过：' + name); }
async function launch() {
  child = spawn(executable, ['--headless=new', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=0', '--user-data-dir=' + path.join(ROOT, '.cache/browser-tests'), 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
  var endpoint = await new Promise(function (resolve, reject) { var timer = setTimeout(function () { reject(new Error('浏览器启动超时')); }, 20000); child.on('error', reject); child.stderr.on('data', function (b) { var m = /DevTools listening on (ws:\/\/[^\s]+)/.exec(b.toString()); if (m) { clearTimeout(timer); resolve(m[1]); } }); });
  var origin = endpoint.replace(/^ws:/, 'http:').split('/devtools/')[0], response = await fetch(origin + '/json/list'), targets = await response.json();
  socket = new WebSocket(targets.find(function (t) { return t.type === 'page'; }).webSocketDebuggerUrl);
  await new Promise(function (resolve, reject) { socket.addEventListener('open', resolve); socket.addEventListener('error', reject); });
  socket.addEventListener('message', function (e) { var m = JSON.parse(e.data); if (m.id) { var p = pending.get(m.id); if (p) { clearTimeout(p.timer); pending.delete(m.id); if (m.error) p.reject(new Error(m.error.message)); else p.resolve(m.result); } } else if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.text + ' ' + JSON.stringify(m.params.exceptionDetails.exception)); });
  await command('Page.enable'); await command('Runtime.enable');
  await command('Network.enable'); await command('Network.setCacheDisabled', { cacheDisabled: true });
  await command('Page.addScriptToEvaluateOnNewDocument', { source: 'localStorage.removeItem("bt-settings-v2");localStorage.removeItem("bt-muted");localStorage.removeItem("bt-music");' });
}
async function main() {
  await launch();
  await test('桌面默认动效与配乐、设置独立控制', async function () {
    await metrics(1440, 900, false); await navigate('round');
    assert.equal(await evaluate('BT.app.ui.layout.mode'), 'desktop');
    assert.equal(await evaluate('BT.app.ui.settings.crt && !BT.app.ui.isReduced()'), true);
    assert.equal(await evaluate('BT.Audio.status().unlocked'), false);
    await click('[data-act="options"]'); await wait('BT.Audio.status().timer');
    await click('[data-act="music"]'); assert.equal(await evaluate('BT.Audio.status().timer'), false);
    await click('[data-act="mute"]'); assert.equal(await evaluate('BT.Audio.isMuted()'), true);
    await click('[data-act="music"]'); await wait('BT.Audio.status().timer');
    assert.equal(await evaluate('BT.Audio.isMuted()'), true); await click('[data-act="mute"]'); await click('[data-act="close"]');
    await screenshot('desktop-new');
  });
  await test('竖屏菜单/牌桌/卡包/商店不横向溢出', async function () {
    await metrics(390, 844, true);
    for (var scene of ['menu', 'blinds', 'round', 'pack', 'shop', 'cash', 'collection']) {
      await navigate(scene); assert.equal(await evaluate('innerWidth'), 390); assert.equal(await evaluate('BT.app.ui.layout.mode'), 'portrait');
      var overflow = await evaluate('document.documentElement.scrollWidth > innerWidth'); assert.equal(overflow, false, scene + ' 页面横向溢出');
      var out = await evaluate('Array.from(document.querySelectorAll(".card")).filter(n=>{var r=n.getBoundingClientRect();return r.left<0||r.right>innerWidth;}).map(n=>n.getAttribute("aria-label"))'); assert.equal(out.length, 0, scene + ' 卡牌越界 ' + out);
      await screenshot('portrait-' + scene);
    }
  });
  await test('触摸选牌与长按详情', async function () {
    await navigate('round'); await evaluate('BT.app.ui.clearSelection()');
    await click('.card[data-zone="hand"]', true); assert.equal(await evaluate('BT.app.ui.selected.length'), 1);
    await click('[data-act="hand-details"]', true); assert.equal(await evaluate('document.getElementById("modal").hidden'), false); await click('[data-act="close"]', true);
    var p = await evaluate('(function(){var n=document.querySelector(".card[data-zone=hand]");n.scrollIntoView({block:"center"});var r=n.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()');
    await command('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: p.x, y: p.y }] }); await delay(620); await command('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    assert.equal(await evaluate('document.getElementById("modal").hidden'), false); await click('[data-act="close"]', true);
  });
  await test('触摸拖动第一张手牌跨行至最后', async function () {
    await navigate('round');
    var before = await evaluate('BT.app.game.run.hand.map(c=>c.id)');
    var points = await evaluate('(function(){scrollTo(0,550);var cs=BT.app.game.run.hand;return [cs[0],cs[cs.length-1]].map(c=>{var n=document.querySelector("[data-card=\\\""+c.id+"\\\"]"),r=n.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};});})()');
    await command('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [points[0]] });
    for (var k = 1; k <= 8; k++) { await command('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: points[0].x + (points[1].x - points[0].x) * k / 8, y: points[0].y + (points[1].y - points[0].y) * k / 8 }] }); await delay(30); }
    await command('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await delay(200);
    var after = await evaluate('BT.app.game.run.hand.map(c=>c.id)'); assert.equal(after[after.length - 1], before[0]); assert.equal(await evaluate('BT.app.ui.drag'), null);
  });
  await test('手机卡包塔罗增强与底部操作', async function () {
    await navigate('pack'); await click('.card[data-zone="hand"]', true);
    var selected = await evaluate('BT.app.ui.selected[0]'), justice = await evaluate('BT.app.game.run.pack.cards.find(c=>c.key==="justice").id');
    await click('[data-card="' + justice + '"]', true); await click('[data-act="choose-pack"]', true);
    assert.equal(await evaluate('BT.app.game.run.deck.find(c=>c.id===' + selected + ').enh'), 'glass'); assert.equal(await evaluate('BT.app.game.run.pack.choose'), 1);
  });
  await test('横屏布局、商店真实购买', async function () {
    await metrics(844, 390, true); await navigate('shop'); assert.equal(await evaluate('BT.app.ui.layout.mode'), 'compact');
    assert.equal(await evaluate('document.documentElement.scrollWidth > innerWidth'), false);
    var id = await evaluate('BT.app.game.run.shop.cards.find(c=>c.kind==="joker").id'), cost = await evaluate('BT.app.game.cost(BT.app.game.run.shop.cards.find(c=>c.id===' + id + '))');
    await click('[data-card="' + id + '"]', true); await click('[data-act="buy"]', true); assert.equal(await evaluate('BT.app.game.run.money'), 45 - cost);
    await screenshot('landscape-shop');
  });
  await test('桌面计分回放与存档有效性', async function () {
    await metrics(1440, 900, false); await navigate('round'); await click('[data-act="play"]'); await wait('!BT.app.ui.busy');
    assert.ok(await evaluate('BT.app.game.run.round.chips>0')); assert.equal(await evaluate('BT.Storage.validate(BT.app.game.serialize())'), true);
  });
  await test('可移植备份与坏存档不覆盖原进度', async function () {
    await navigate('shop');
    assert.equal(await evaluate('(function(){var g=BT.app.game,s=g.serialize(),text=BT.Storage.exportRun(s);return JSON.stringify(BT.Storage.importRun(text))===JSON.stringify(s);})()'), true);
    assert.equal(await evaluate('(function(){var g=BT.app.game,before=JSON.stringify(g.serialize());try{BT.Storage.importRun("{bad}");}catch(e){}return before===JSON.stringify(g.serialize());})()'), true);
    await click('[data-act="options"]'); await click('[data-act="storage"]'); await click('[data-act="export-save"]');
  });
  await test('音频失焦暂停与恢复不重复计时器', async function () {
    await navigate('round'); await click('[data-act="options"]'); await wait('BT.Audio.status().timer');
    await evaluate('BT.Audio.pause()'); await delay(100); assert.equal(await evaluate('BT.Audio.status().timer'), false);
    await evaluate('BT.Audio.resume()'); await wait('BT.Audio.status().timer');
    await evaluate('BT.Audio.unlock();BT.Audio.unlock();BT.Audio.unlock()'); assert.equal(await evaluate('BT.Audio.status().timer'), true);
  });
  await test('窄屏、平板与横屏菜单实际边界', async function () {
    for (var w of [320, 360, 600, 768, 1024]) {
      await metrics(w, 844, true); await navigate('menu'); assert.equal(await evaluate('document.documentElement.scrollWidth > innerWidth'), false, '菜单 ' + w);
      await navigate('round'); assert.equal(await evaluate('document.documentElement.scrollWidth > innerWidth'), false, '牌桌 ' + w);
    }
  });
  await test('系统减少动态偏好与用户覆盖一致', async function () {
    await metrics(1440, 900, false); await command('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] }); await navigate('round');
    assert.equal(await evaluate('BT.app.ui.isReduced()'), true); await click('[data-act="options"]'); await click('[data-act="respect-system"]');
    assert.equal(await evaluate('BT.app.ui.isReduced()'), false); await click('[data-act="close"]');
    await command('Emulation.setEmulatedMedia', { features: [] });
  });
  await test('正式新局存档与刷新继续', async function () {
    await navigate('menu'); await click('[data-act="start"]'); await click('[data-act="blind"]');
    await evaluate('BT.app.ui.toggleCard(BT.app.game.run.hand[0].id,"hand")'); await click('[data-act="discard"]');
    var saved = await evaluate('JSON.stringify(BT.app.game.serialize())'); assert.equal(await evaluate('BT.Storage.validate(BT.Storage.load())'), true);
    await navigate('menu'); await click('[data-act="continue"]'); assert.equal(await evaluate('JSON.stringify(BT.app.game.serialize())'), saved);
  });
  await test('单文件浏览器运行', async function () { await navigate('round', true); assert.equal(await evaluate('BT.Storage.validate(BT.app.game.serialize())'), true); });
  assert.equal(errors.length, 0, errors.join('\n')); console.log('浏览器集成验收：' + passed + ' 项通过，未捕获运行异常。');
}
main().catch(function (e) { console.error(e.stack); process.exitCode = 1; }).finally(function () { if (socket) socket.close(); if (child) child.kill(); pending.forEach(function (p) { clearTimeout(p.timer); }); });
