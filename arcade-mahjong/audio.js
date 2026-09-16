/* Arcade Mahjong · Pure WebAudio synth SFX
   麻将音效：出牌咔哒、吃碰杠敲桌、胡牌和弦。 */
"use strict";

var Audio = (function () {
  var ctx = null, muted = false;

  function init() {
    if (ctx) return;
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {}
  }

  function toggle() {
    muted = !muted;
    try { localStorage.setItem("mahjong_muted", muted ? "1" : "0"); } catch (e) {}
    return muted;
  }

  function loadMuted() {
    try { muted = localStorage.getItem("mahjong_muted") === "1"; } catch (e) {}
    return muted;
  }

  function tone(freq, dur, type, vol, rampTo) {
    if (!ctx || muted) return;
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.type = type || "square";
    osc.frequency.value = freq;
    gain.gain.value = vol || 0.12;
    if (rampTo) osc.frequency.linearRampToValueAtTime(rampTo, ctx.currentTime + dur);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + dur);
  }

  function noise(dur, vol, filterFreq, type) {
    if (!ctx || muted) return;
    var bufSize = ctx.sampleRate * dur;
    var buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    var data = buf.getChannelData(0);
    for (var i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * 0.6;
    var src = ctx.createBufferSource();
    src.buffer = buf;
    var gain = ctx.createGain();
    gain.gain.value = vol || 0.1;
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    var filter = ctx.createBiquadFilter();
    filter.type = type || "lowpass";
    filter.frequency.value = filterFreq || 1500;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start();
  }

  /* 出牌：短促木牌声 */
  function discardSfx() {
    noise(0.06, 0.12, 3000, "bandpass");
    tone(180, 0.08, "sine", 0.08, 90);
  }

  /* 摸牌：轻微咔哒 */
  function drawSfx() {
    tone(320, 0.03, "square", 0.05);
  }

  /* 选牌高亮 */
  function pickSfx() {
    tone(520, 0.04, "sine", 0.06);
  }

  /* 吃：三声上行 */
  function chiSfx() {
    [440, 554, 659].forEach(function (f, i) {
      setTimeout(function () { tone(f, 0.1, "square", 0.1); }, i * 60);
    });
    setTimeout(function () { noise(0.08, 0.06, 2500); }, 180);
  }

  /* 碰：厚重敲击 */
  function pengSfx() {
    tone(220, 0.15, "sawtooth", 0.14, 110);
    setTimeout(function () { tone(220, 0.2, "sawtooth", 0.12, 90); }, 90);
    setTimeout(function () { noise(0.1, 0.08, 1200); }, 60);
  }

  /* 杠：更重 */
  function gangSfx() {
    tone(160, 0.2, "sawtooth", 0.16, 60);
    setTimeout(function () { tone(120, 0.25, "sawtooth", 0.14, 50); }, 100);
    setTimeout(function () { noise(0.15, 0.1, 900); }, 80);
  }

  /* 胡：胜利和弦 */
  function huSfx() {
    var notes = [523, 659, 784, 1047, 1319];
    notes.forEach(function (f, i) {
      setTimeout(function () { tone(f, 0.4, "triangle", 0.1); }, i * 100);
    });
    setTimeout(function () { noise(0.3, 0.08, 4000); }, 500);
  }

  /* 输：低音下行 */
  function loseSfx() {
    [440, 349, 262, 196].forEach(function (f, i) {
      setTimeout(function () { tone(f, 0.25, "sawtooth", 0.1); }, i * 130);
    });
  }

  /* 流局：平淡两音 */
  function drawSfx() {
    tone(330, 0.2, "sine", 0.08);
    setTimeout(function () { tone(330, 0.2, "sine", 0.06); }, 250);
  }

  /* UI 点击 */
  function uiClick() { tone(660, 0.03, "square", 0.06); }

  /* 发牌：一串咔哒 */
  function dealSfx() {
    for (var i = 0; i < 6; i++) {
      setTimeout(function () { tone(300 + Math.random() * 60, 0.03, "square", 0.04); }, i * 40);
    }
  }

  return {
    init: init, toggle: toggle, loadMuted: loadMuted,
    isMuted: function () { return muted; },
    discardSfx: discardSfx, drawSfx: drawSfx, pickSfx: pickSfx,
    chiSfx: chiSfx, pengSfx: pengSfx, gangSfx: gangSfx,
    huSfx: huSfx, loseSfx: loseSfx, drawSfx: drawSfx,
    uiClick: uiClick, dealSfx: dealSfx
  };
})();

if (typeof module !== "undefined") module.exports = Audio;
