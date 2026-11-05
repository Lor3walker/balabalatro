/* 合成纸牌、筹码与和弦音效；首次用户操作后才创建 AudioContext。 */
(function (BT) {
  'use strict';
  var U = BT.Utils, ctx, sfxBus, musicBus, noiseBuffer, timer = null, nextAt = 0, step = 0;
  var muted = U.load('bt-muted', false), music = U.load('bt-music', true), volume = U.clamp(Number(U.load('bt-volume', 0.55)), 0, 1);
  var unlocked = false, paused = false, scene = 'menu', voices = new Set();
  var CHORDS = [[50, 57, 60, 64, 69], [46, 53, 57, 60, 65], [41, 48, 53, 57, 60], [48, 55, 60, 62, 67]];
  var MELODY = [74, 77, 81, 79, 77, 74, 72, 69, 70, 74, 77, 76, 74, 72, 69, 67];
  function frequency(note) { return 440 * Math.pow(2, (note - 69) / 12); }
  function initialise() {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    var master = ctx.createGain(), compressor = ctx.createDynamicsCompressor(); master.gain.value = volume * 0.65;
    sfxBus = ctx.createGain(); musicBus = ctx.createGain(); musicBus.gain.value = 0.7;
    sfxBus.connect(master); musicBus.connect(master); master.connect(compressor); compressor.connect(ctx.destination);
    var echo = ctx.createDelay(1), feedback = ctx.createGain(), filter = ctx.createBiquadFilter();
    echo.delayTime.value = 0.365; feedback.gain.value = 0.22; filter.type = 'lowpass'; filter.frequency.value = 1800;
    musicBus.connect(echo); echo.connect(filter); filter.connect(feedback); feedback.connect(echo); feedback.connect(master);
    var n = Math.floor(ctx.sampleRate * 0.15); noiseBuffer = ctx.createBuffer(1, n, ctx.sampleRate);
    var data = noiseBuffer.getChannelData(0), rng = new U.Rng('AUDIO-NOISE');
    for (var i = 0; i < n; i++) data[i] = rng.next() * 2 - 1;
    BT.Audio.master = master;
  }
  function track(node, gain, filter) {
    voices.add(node); node.onended = function () { voices.delete(node); node.disconnect(); gain.disconnect(); if (filter) filter.disconnect(); };
  }
  function note(midi, at, duration, type, gain, cutoff, detune) {
    var osc = ctx.createOscillator(), amp = ctx.createGain(), filter = ctx.createBiquadFilter();
    osc.type = type || 'triangle'; osc.frequency.value = frequency(midi); osc.detune.value = detune || 0;
    filter.type = 'lowpass'; filter.frequency.value = cutoff || 1800;
    amp.gain.setValueAtTime(0, at); amp.gain.linearRampToValueAtTime(gain, at + Math.min(0.12, duration * 0.15)); amp.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    osc.connect(filter); filter.connect(amp); amp.connect(musicBus); track(osc, amp, filter); osc.start(at); osc.stop(at + duration + 0.03);
  }
  function noise(at, duration, gain, cutoff, destination) {
    var src = ctx.createBufferSource(), amp = ctx.createGain(), filter = ctx.createBiquadFilter();
    src.buffer = noiseBuffer; filter.type = 'highpass'; filter.frequency.value = cutoff;
    amp.gain.setValueAtTime(gain, at); amp.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    src.connect(filter); filter.connect(amp); amp.connect(destination); track(src, amp, filter); src.start(at); src.stop(at + duration);
  }
  function schedule(at, s) {
    var chord = CHORDS[Math.floor(s / 32) % 4], beat = 60 / 82, pulse = s % 16;
    var intense = scene === 'round' || scene === 'pack', level = intense ? 1 : 0.7;
    if (s % 16 === 0) chord.slice(1, 5).forEach(function (m, i) { note(m, at, beat * 4.8, 'triangle', 0.016 * level, 1050, i % 2 ? -5 : 5); });
    if (s % 4 === 0) note(chord[0] - 12 + (pulse === 8 ? 12 : 0), at, beat * 0.85, 'triangle', 0.12 * level, 500);
    if (s % 2 === 0) note(chord[1 + (s / 2 % 4)], at, beat * 0.6, 'square', 0.014 * level, 1500, -3);
    if (s % 8 === 2) note(MELODY[Math.floor(s / 8) % MELODY.length], at, beat * 1.4, 'square', 0.021 * level, 2100, 3);
    if (s % 4 === 2) noise(at, 0.045, 0.022 * level, 6500, musicBus);
    if (pulse === 4 || pulse === 12) { noise(at, 0.1, 0.03 * level, 900, musicBus); note(50, at, 0.08, 'triangle', 0.028, 700); }
    if (pulse === 0 || intense && pulse === 8) note(31, at, 0.15, 'sine', 0.15 * level, 150);
  }
  function tick() {
    if (!ctx || paused || !music || ctx.state !== 'running') return;
    if (nextAt < ctx.currentTime - 0.1) nextAt = ctx.currentTime + 0.05;
    while (nextAt < ctx.currentTime + 0.18) { schedule(nextAt, step++); nextAt += 60 / 82 / 4; }
  }
  function startMusic() {
    if (!ctx || !music || paused || timer !== null || ctx.state !== 'running') return;
    nextAt = ctx.currentTime + 0.07; tick(); timer = setInterval(tick, 40);
  }
  function unlock() {
    try {
      if (!ctx) initialise(); unlocked = true;
      if (paused) return;
      if (ctx.state === 'suspended' || ctx.state === 'interrupted') Promise.resolve(ctx.resume()).then(startMusic).catch(function () {}); else startMusic();
    } catch (e) { /* 浏览器不支持音频时仍可正常游戏 */ }
  }
  function pause() {
    paused = true; if (timer !== null) clearInterval(timer); timer = null;
    voices.forEach(function (node) { try { node.stop(); } catch (e) {} });
    if (ctx && ctx.state !== 'closed') Promise.resolve(ctx.suspend()).catch(function () {});
  }
  function resume() { paused = false; if (unlocked) unlock(); }
  function toggleMusic() {
    music = !music; U.save('bt-music', music);
    if (musicBus) musicBus.gain.setTargetAtTime(music ? 0.7 : 0, ctx.currentTime, 0.08);
    if (!music && timer !== null) { clearInterval(timer); timer = null; } else if (music) unlock();
    return music;
  }
  function setVolume(v) { volume = U.clamp(Number(v) || 0, 0, 1); U.save('bt-volume', volume); if (ctx) BT.Audio.master.gain.setTargetAtTime(volume * 0.65, ctx.currentTime, 0.06); }
  function tone(f, duration, delay, type, gain) {
    if (!ctx || muted || paused) return; var osc = ctx.createOscillator(), vol = ctx.createGain(), at = ctx.currentTime + (delay || 0);
    osc.type = type || 'sine'; osc.frequency.setValueAtTime(f, at); vol.gain.setValueAtTime(0, at); vol.gain.linearRampToValueAtTime(gain || 0.04, at + 0.007); vol.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    osc.connect(vol); vol.connect(sfxBus); track(osc, vol); osc.start(at); osc.stop(at + duration + 0.02);
  }
  function paper() {
    if (!ctx || muted || paused) return; noise(ctx.currentTime, 0.045, 0.09, 1900, sfxBus);
  }
  function play(key, index) {
    if (key === 'card' || key === 'use') { paper(); tone(320, 0.07); }
    else if (key === 'money') { tone(1100, 0.15); tone(1650, 0.15, 0.05); }
    else if (key === 'score') [261.63, 329.63, 392, 523.25].forEach(function (f, i) { tone(f, 0.6, i * 0.045, 'triangle', 0.035); });
    else if (key === 'chip') tone(380 * Math.pow(1.04, Math.min(index || 0, 30)), 0.1, 0, 'triangle');
    else if (key === 'mult') { tone(260 * Math.pow(1.05, Math.min(index || 0, 30)), 0.14, 0, 'triangle'); }
    else if (key === 'error') tone(110, 0.13, 0, 'triangle');
    else tone(580, 0.06, 0, 'triangle', 0.025);
  }
  BT.Audio = {
    unlock: unlock, play: play, pause: pause, resume: resume, toggleMusic: toggleMusic, setVolume: setVolume,
    setScene: function (phase) { scene = phase; }, isMusicOn: function () { return music; }, getVolume: function () { return volume; },
    isMuted: function () { return muted; }, toggle: function () { muted = !muted; U.save('bt-muted', muted); return muted; },
    status: function () { return { unlocked: unlocked, running: !!ctx && ctx.state === 'running' && !paused, music: music, timer: timer !== null, voices: voices.size, scene: scene }; }
  };
})(window.BT);
