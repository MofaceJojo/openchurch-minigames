/* Holy Bubbles · 搞笑音效,纯 WebAudio 合成,不依赖任何音频文件
   圣泡“噗噜”、爆光“噗”、驱散滑哨、道具叮咚、失败放屁号、过关小号…… 全部现算 */
"use strict";

var Sfx = (function () {
  var ctx = null, master = null, muted = false;

  function init() {                        // 必须由用户手势触发
    if (ctx) return;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.30;
    master.connect(ctx.destination);
  }
  function ready() {
    if (!ctx || muted) return false;
    if (ctx.state === "suspended") ctx.resume();
    return true;
  }
  function setMuted(m) { muted = m; }
  function isMuted() { return muted; }

  // 一个带包络的振荡器
  function tone(type, f0, f1, t0, dur, vol, glideShape) {
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    var t = ctx.currentTime + t0;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) {
      if (glideShape === "exp") o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
      else o.frequency.linearRampToValueAtTime(Math.max(1, f1), t + dur);
    }
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + Math.min(0.02, dur * 0.2));
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.03);
  }
  function noise(t0, dur, vol, freq) {
    var len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    var buf = ctx.createBuffer(1, len, ctx.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    var src = ctx.createBufferSource(); src.buffer = buf;
    var bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = freq || 900;
    var g = ctx.createGain(); g.gain.value = vol;
    src.connect(bp); bp.connect(g); g.connect(master);
    src.start(ctx.currentTime + t0);
  }

  // 放圣泡:软软的“噗噜”下行泡泡音
  function place() {
    if (!ready()) return;
    tone("sine", 620, 300, 0, 0.16, 0.20, "exp");
    tone("sine", 900, 500, 0.05, 0.12, 0.10, "exp");
  }
  // 爆光:卡通“噗!”——短噪声砰 + 上滑泡泡,不暴力
  function pop() {
    if (!ready()) return;
    noise(0, 0.14, 0.20, 700);
    tone("triangle", 200, 900, 0, 0.18, 0.16, "exp");
    tone("square", 140, 80, 0.02, 0.10, 0.10);
  }
  // 小鬼被驱散:滑哨往上飞 + “啵”,像被弹走
  function bless() {
    if (!ready()) return;
    tone("sine", 320, 1500, 0, 0.30, 0.22, "exp");
    tone("square", 180, 90, 0, 0.08, 0.10);
    noise(0.02, 0.10, 0.12, 1600);
  }
  // 拾取道具:三个上行音,傻乎乎的小胜利
  function chime() {
    if (!ready()) return;
    var n = [523, 659, 880];
    for (var i = 0; i < 3; i++) tone("triangle", n[i], n[i], 0.30 + i * 0.08, 0.13, 0.16);
  }
  // 失败:经典下滑长号 wah-wah-wah-waaah
  function die() {
    if (!ready()) return;
    var n = [392, 370, 349, 294];
    for (var i = 0; i < n.length; i++) {
      var d = i === 3 ? 0.5 : 0.16;
      tone("sawtooth", n[i], i === 3 ? n[i] * 0.7 : n[i], i * 0.17, d, 0.17, "exp");
    }
  }
  // 过关:小号吹的滑稽凯旋
  function clear() {
    if (!ready()) return;
    var seq = [[523,0],[659,0.11],[784,0.22],[1047,0.33],[880,0.5],[1047,0.6]];
    for (var i = 0; i < seq.length; i++) tone("square", seq[i][0], seq[i][0], seq[i][1], 0.14, 0.15);
    tone("sine", 1047, 1600, 0.72, 0.3, 0.14, "exp");
    noise(0.72, 0.22, 0.10, 2400);
  }
  // 全通关:更响亮的小号 fanfare
  function win() {
    if (!ready()) return;
    var seq = [[523,0],[659,0.12],[784,0.24],[1047,0.36],[784,0.52],[1047,0.62],[1319,0.74]];
    for (var i = 0; i < seq.length; i++) tone("square", seq[i][0], seq[i][0], seq[i][1], 0.16, 0.16);
    tone("sine", 1319, 1800, 0.92, 0.4, 0.15, "exp");
    noise(0.92, 0.3, 0.10, 2600);
  }
  // 界面点击
  function tap() {
    if (!ready()) return;
    tone("square", 660, 880, 0, 0.06, 0.08);
  }

  return { init:init, setMuted:setMuted, isMuted:isMuted,
           place:place, pop:pop, bless:bless, chime:chime,
           die:die, clear:clear, win:win, tap:tap };
})();

if (typeof module !== "undefined") module.exports = Sfx;
