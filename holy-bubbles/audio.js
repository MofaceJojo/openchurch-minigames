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

  // 放圣泡:软软的"噗噜"下行泡泡音,温柔可爱
  function place() {
    if (!ready()) return;
    tone("sine", 680, 380, 0, 0.14, 0.16, "exp");
    tone("sine", 950, 550, 0.03, 0.10, 0.08, "exp");
    tone("triangle", 1200, 1400, 0, 0.06, 0.05);
  }
  // 爆光:温柔的"啵~"泡泡音
  function pop() {
    if (!ready()) return;
    tone("sine", 350, 1200, 0, 0.12, 0.12, "exp");
    tone("triangle", 500, 900, 0, 0.10, 0.08, "exp");
  }
  // 小鬼被驱散:滑哨往上飞 + "啵"
  function bless() {
    if (!ready()) return;
    tone("sine", 400, 1600, 0, 0.25, 0.16, "exp");
    tone("triangle", 600, 1000, 0, 0.10, 0.08, "exp");
  }
  // 拾取道具:三个欢快上行音
  function chime() {
    if (!ready()) return;
    tone("triangle", 587, 587, 0, 0.12, 0.12);
    tone("triangle", 740, 740, 0.07, 0.12, 0.12);
    tone("triangle", 880, 880, 0.14, 0.14, 0.12);
  }
  // 失败:温柔下滑,不 harsh
  function die() {
    if (!ready()) return;
    tone("sine", 440, 330, 0, 0.18, 0.12, "exp");
    tone("sine", 330, 262, 0.1, 0.18, 0.10, "exp");
    tone("sine", 262, 196, 0.2, 0.30, 0.08, "exp");
  }
  // 过关:轻快小号
  function clear() {
    if (!ready()) return;
    var seq = [[523,0],[659,0.10],[784,0.20],[1047,0.30],[880,0.48],[1047,0.60]];
    for (var i = 0; i < seq.length; i++) tone("triangle", seq[i][0], seq[i][0], seq[i][1], 0.12, 0.10);
    tone("sine", 1047, 1600, 0.65, 0.25, 0.10, "exp");
  }
  // 全通关:更欢快
  function win() {
    if (!ready()) return;
    var seq = [[523,0],[659,0.10],[784,0.20],[1047,0.30],[784,0.48],[1047,0.60],[1319,0.72]];
    for (var i = 0; i < seq.length; i++) tone("triangle", seq[i][0], seq[i][0], seq[i][1], 0.14, 0.11);
    tone("sine", 1319, 1800, 0.84, 0.35, 0.12, "exp");
  }
  // 界面点击
  function tap() {
    if (!ready()) return;
    tone("triangle", 700, 900, 0, 0.05, 0.06);
  }

  return { init:init, setMuted:setMuted, isMuted:isMuted,
           place:place, pop:pop, bless:bless, chime:chime,
           die:die, clear:clear, win:win, tap:tap };
})();

if (typeof module !== "undefined") module.exports = Sfx;
