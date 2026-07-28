/* 搞笑音效 · 纯 WebAudio 合成,不依赖任何音频文件
   卡通滑哨、弹簧、放屁号、失败的滑音长号…… 全部现算 */
"use strict";

var Sfx = (function () {
  var ctx = null, master = null, muted = false;

  function init() {                       // 必须由用户手势触发
    if (ctx) return;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.32;
    master.connect(ctx.destination);
  }
  function ready() {
    if (!ctx || muted) return false;
    if (ctx.state === "suspended") ctx.resume();
    return true;
  }
  function setMuted(m) { muted = m; }
  function isMuted() { return muted; }

  /* 一个带包络的振荡器 */
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

  function noise(t0, dur, vol, freq) {        // 短促噪声(拍打、砰)
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

  /* 抓到小鬼:滑哨往上飞 + "啵"一声 —— 像被弹弓射出去 */
  function catchImp() {
    if (!ready()) return;
    tone("sine", 300, 1500, 0, 0.34, 0.28, "exp");     // 滑哨升空
    tone("square", 180, 90, 0, 0.09, 0.12);            // 弹出的"啵"
    noise(0.02, 0.12, 0.16, 1600);                     // 一阵烟
    tone("triangle", 900, 1300, 0.16, 0.16, 0.1, "exp");
  }

  /* 人获救:三个上行音,傻乎乎的小胜利 */
  function freed() {
    if (!ready()) return;
    var n = [523, 659, 880];
    for (var i = 0; i < 3; i++) tone("triangle", n[i], n[i], 0.34 + i * 0.09, 0.13, 0.16);
  }

  /* 照错地方:放屁号,下滑的"呜哇——" */
  function miss() {
    if (!ready()) return;
    tone("sawtooth", 260, 110, 0, 0.34, 0.2, "exp");
    tone("square", 130, 60, 0.03, 0.3, 0.09, "exp");
    noise(0, 0.08, 0.1, 400);
  }

  /* 过关:小号吹的滑稽凯旋 */
  function win() {
    if (!ready()) return;
    var seq = [[523, 0], [659, 0.11], [784, 0.22], [1047, 0.33], [880, 0.5], [1047, 0.6]];
    for (var i = 0; i < seq.length; i++)
      tone("square", seq[i][0], seq[i][0], seq[i][1], 0.14, 0.15);
    tone("sine", 1047, 1600, 0.72, 0.3, 0.14, "exp");
    noise(0.72, 0.25, 0.1, 2400);
  }

  /* 失败:经典下滑长号 wah-wah-wah-waaah */
  function lose() {
    if (!ready()) return;
    var n = [392, 370, 349, 294];
    for (var i = 0; i < n.length; i++) {
      var d = i === 3 ? 0.5 : 0.16;
      tone("sawtooth", n[i], i === 3 ? n[i] * 0.7 : n[i], i * 0.17, d, 0.17, "exp");
    }
  }

  /* 小鬼探头(破绽):轻轻一声"嘀",提示但不吵 */
  function peek() {
    if (!ready()) return;
    tone("sine", 1100, 1400, 0, 0.07, 0.055, "exp");
  }

  /* 界面点击 */
  function tap() {
    if (!ready()) return;
    tone("square", 660, 880, 0, 0.06, 0.08);
  }

  return { init: init, setMuted: setMuted, isMuted: isMuted,
           catchImp: catchImp, freed: freed, miss: miss,
           win: win, lose: lose, peek: peek, tap: tap };
})();

if (typeof module !== "undefined") module.exports = Sfx;
