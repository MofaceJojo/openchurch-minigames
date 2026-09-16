/* Catch the Fallen · Pure WebAudio synth SFX */
"use strict";

var Audio = (function () {
  var ctx = null, muted = false;

  function init() {
    if (ctx) return;
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {}
  }

  function toggle() {
    muted = !muted;
    try { localStorage.setItem("ctf_muted", muted ? "1" : "0"); } catch (e) {}
    return muted;
  }

  function loadMuted() {
    try { muted = localStorage.getItem("ctf_muted") === "1"; } catch (e) {}
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

  function catchSfx() { tone(523, 0.08, "square", 0.1); setTimeout(function() { tone(784, 0.14, "square", 0.1); }, 70); }
  function missSfx() { tone(300, 0.28, "sawtooth", 0.12, 90); }
  function levelClear() { [523, 659, 784, 1047].forEach(function(f, i) { setTimeout(function() { tone(f, 0.15, "square", 0.1); }, i * 120); }); }
  function gameOver() { tone(330, 0.12, "square", 0.1, 110); setTimeout(function() { tone(165, 0.3, "sawtooth", 0.12, 55); }, 100); }
  function uiClick() { tone(440, 0.04, "square", 0.06); }

  return {
    init: init, toggle: toggle, loadMuted: loadMuted, isMuted: function() { return muted; },
    catchSfx: catchSfx, missSfx: missSfx, levelClear: levelClear, gameOver: gameOver, uiClick: uiClick
  };
})();

if (typeof module !== "undefined") module.exports = Audio;
