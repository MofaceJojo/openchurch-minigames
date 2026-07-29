/* 牧者行列 · 搞笑音效,纯 WebAudio 合成(无音频文件) */
"use strict";

var Sfx = (function () {
  var ctx = null, master = null, muted = false;

  function init() {
    if (ctx) return;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.3;
    master.connect(ctx.destination);
  }
  function ready() {
    if (!ctx || muted) return false;
    if (ctx.state === "suspended") ctx.resume();
    return true;
  }
  function setMuted(m) { muted = m; }
  function isMuted() { return muted; }

  function tone(type, f0, f1, t0, dur, vol, exp) {
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    var t = ctx.currentTime + t0;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) {
      if (exp) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
      else o.frequency.linearRampToValueAtTime(Math.max(1, f1), t + dur);
    }
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + Math.min(0.02, dur * 0.25));
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.03);
  }

  function noise(t0, dur, vol, freq, q) {
    var len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    var buf = ctx.createBuffer(1, len, ctx.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    var src = ctx.createBufferSource(); src.buffer = buf;
    var bp = ctx.createBiquadFilter();
    bp.type = "bandpass"; bp.frequency.value = freq || 900; bp.Q.value = q || 1;
    var g = ctx.createGain(); g.gain.value = vol;
    src.connect(bp); bp.connect(g); g.connect(master);
    src.start(ctx.currentTime + t0);
  }

  /* 救到一个信徒:轻快的一声"啵咚",队伍越长音越高 */
  function rescue(queueLen) {
    if (!ready()) return;
    var step = Math.min(12, Math.max(0, (queueLen || 3) - 3));
    var f = 520 * Math.pow(1.045, step);
    tone("triangle", f, f * 1.5, 0, 0.11, 0.17, true);
    tone("sine", f * 2, f * 2.4, 0.02, 0.08, 0.07, true);
  }

  /* 捡到技能星:叮叮叮的小闪光 */
  function pickup() {
    if (!ready()) return;
    var n = [784, 988, 1319];
    for (var i = 0; i < 3; i++) tone("sine", n[i], n[i], i * 0.055, 0.12, 0.13);
  }

  /* 释放技能:四种各有各的怪声 */
  function skill(id) {
    if (!ready()) return;
    if (id === "summon") {                       // 呼召:一串上行的吸入声
      tone("sine", 300, 1200, 0, 0.3, 0.18, true);
      for (var i = 0; i < 4; i++) tone("triangle", 500 + i * 180, 900 + i * 180, i * 0.05, 0.1, 0.08, true);
    } else if (id === "smite") {                 // 圣火:滋啦一道劈下去 + 砰
      tone("sawtooth", 1400, 180, 0, 0.18, 0.2, true);
      noise(0.1, 0.25, 0.22, 700, 0.8);
      tone("square", 120, 55, 0.12, 0.3, 0.14, true);
    } else if (id === "shield") {                // 护佑:温暖的和声
      tone("sine", 523, 523, 0, 0.5, 0.12);
      tone("sine", 659, 659, 0.04, 0.5, 0.1);
      tone("sine", 784, 784, 0.08, 0.5, 0.09);
    } else if (id === "ghost") {                 // 灵体:飘忽的滑音
      tone("sine", 700, 420, 0, 0.42, 0.14, true);
      tone("sine", 1050, 640, 0.06, 0.4, 0.08, true);
    } else {                                     // 静止:时间被拉长的下坠感
      tone("sine", 900, 220, 0, 0.7, 0.16, true);
      tone("triangle", 450, 110, 0.05, 0.7, 0.1, true);
    }
  }

  /* 四种死法四种搞笑收场 */
  function die(kind) {
    if (!ready()) return;
    if (kind === "wall") {                       // 撞墙:啪叽一声压扁 + 眩晕
      noise(0, 0.14, 0.3, 260, 0.7);
      tone("square", 200, 70, 0, 0.22, 0.16, true);
      for (var i = 0; i < 3; i++) tone("sine", 900 - i * 120, 700 - i * 120, 0.24 + i * 0.11, 0.1, 0.07);
    } else if (kind === "demon") {               // 炸开:轰
      noise(0, 0.4, 0.34, 500, 0.5);
      tone("sawtooth", 260, 45, 0, 0.45, 0.2, true);
    } else if (kind === "devour") {              // 被吞:咕咚三声 + 饱嗝
      for (var j = 0; j < 3; j++) tone("sine", 300 - j * 70, 150 - j * 40, j * 0.11, 0.14, 0.16, true);
      tone("sawtooth", 150, 90, 0.42, 0.3, 0.14, true);
    } else {                                     // 缠住自己:傻乎乎的弹簧
      tone("sine", 600, 200, 0, 0.3, 0.18, true);
      tone("sine", 260, 520, 0.28, 0.22, 0.12, true);
    }
    // 统一收尾:下滑长号 wah-waaah
    var n = [349, 294];
    for (var k = 0; k < 2; k++)
      tone("sawtooth", n[k], k === 1 ? n[k] * 0.72 : n[k], 0.6 + k * 0.19, k === 1 ? 0.5 : 0.17, 0.14, true);
  }

  /* 过关:滑稽小号凯旋 */
  function win() {
    if (!ready()) return;
    var seq = [[523, 0], [659, 0.1], [784, 0.2], [1047, 0.3], [880, 0.46], [1047, 0.56]];
    for (var i = 0; i < seq.length; i++) tone("square", seq[i][0], seq[i][0], seq[i][1], 0.14, 0.14);
    tone("sine", 1047, 1600, 0.68, 0.3, 0.13, true);
    noise(0.68, 0.25, 0.09, 2400);
  }

  function tap() {
    if (!ready()) return;
    tone("square", 660, 880, 0, 0.06, 0.08);
  }

  return { init: init, setMuted: setMuted, isMuted: isMuted,
           rescue: rescue, pickup: pickup, skill: skill,
           die: die, win: win, tap: tap };
})();

if (typeof module !== "undefined") module.exports = Sfx;
