"use strict";
const Audio = (() => {
  let enabled = true, ctx = null;

  function getCtx() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    return ctx;
  }

  function play(name) {
    if (!enabled) return;
    try {
      const ac = getCtx();
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.connect(g); g.connect(ac.destination);
      const now = ac.currentTime;
      if (name === "found") {
        o.type = "sine"; o.frequency.setValueAtTime(600, now); o.frequency.linearRampToValueAtTime(1200, now + 0.08);
        g.gain.setValueAtTime(0.25, now); g.gain.linearRampToValueAtTime(0, now + 0.18);
        o.start(now); o.stop(now + 0.2);
      } else if (name === "miss") {
        o.type = "square"; o.frequency.setValueAtTime(200, now); o.frequency.linearRampToValueAtTime(120, now + 0.15);
        g.gain.setValueAtTime(0.1, now); g.gain.linearRampToValueAtTime(0, now + 0.15);
        o.start(now); o.stop(now + 0.15);
      } else if (name === "hint") {
        o.type = "sine"; o.frequency.setValueAtTime(400, now); o.frequency.linearRampToValueAtTime(800, now + 0.12);
        g.gain.setValueAtTime(0.15, now); g.gain.linearRampToValueAtTime(0, now + 0.25);
        o.start(now); o.stop(now + 0.25);
      } else if (name === "win") {
        o.type = "sine";
        [523, 659, 784, 1047].forEach((f, i) => { o.frequency.setValueAtTime(f, now + i*0.12); });
        g.gain.setValueAtTime(0.2, now); g.gain.linearRampToValueAtTime(0, now + 0.6);
        o.start(now); o.stop(now + 0.6);
      }
    } catch (e) { /* audio not supported */ }
  }

  function toggle() { enabled = !enabled; return enabled; }
  return { play, toggle };
})();
