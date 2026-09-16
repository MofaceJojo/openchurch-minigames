/* Holy Bubbles · Pure WebAudio synth SFX */
"use strict";

var Audio = (function () {
  var ctx = null, muted = false;

  function init() {
    if (ctx) return;
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {}
  }

  function toggle() {
    muted = !muted;
    try { localStorage.setItem("hb_muted", muted ? "1" : "0"); } catch (e) {}
    return muted;
  }

  function loadMuted() {
    try { muted = localStorage.getItem("hb_muted") === "1"; } catch (e) {}
    return muted;
  }

  function tone(freq, dur, type, vol, ramp) {
    if (!ctx || muted) return;
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.type = type || "square";
    osc.frequency.value = freq;
    gain.gain.value = vol || 0.12;
    if (ramp) osc.frequency.linearRampToValueAtTime(ramp, ctx.currentTime + dur);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + dur);
  }

  function noise(dur, vol, filterFreq) {
    if (!ctx || muted) return;
    var bufSize = ctx.sampleRate * dur;
    var buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    var data = buf.getChannelData(0);
    for (var i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * 0.5;
    var src = ctx.createBufferSource();
    src.buffer = buf;
    var gain = ctx.createGain();
    gain.gain.value = vol || 0.08;
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    var filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = filterFreq || 2000;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start();
  }

  function explode() { noise(0.25, 0.12, 800); tone(120, 0.2, "sawtooth", 0.1, 40); }
  function pickup() { tone(523, 0.08, "square", 0.1); setTimeout(function() { tone(784, 0.12, "square", 0.1); }, 70); }
  function hurt() { tone(220, 0.15, "sawtooth", 0.12, 110); }
  function die() { tone(330, 0.12, "square", 0.1, 110); setTimeout(function() { tone(165, 0.3, "sawtooth", 0.12, 55); }, 100); }
  function levelClear() {
    [523, 659, 784, 1047].forEach(function(f, i) {
      setTimeout(function() { tone(f, 0.15, "square", 0.1); }, i * 120);
    });
  }
  function uiClick() { tone(440, 0.04, "square", 0.06); }
  function trap() { tone(500, 0.18, "sine", 0.1, 180); noise(0.12, 0.05, 1200); }
  function free() { tone(300, 0.16, "square", 0.1, 660); tone(660, 0.1, "square", 0.08, 900); }
  function kick() { tone(700, 0.05, "square", 0.08, 500); }

  return {
    init: init, toggle: toggle, loadMuted: loadMuted, isMuted: function() { return muted; },
    explode: explode, pickup: pickup, hurt: hurt, die: die, levelClear: levelClear, uiClick: uiClick,
    trap: trap, free: free, kick: kick
  };
})();

if (typeof module !== "undefined") module.exports = Audio;
