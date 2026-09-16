/* Catch the Fallen · selftest.js — run with: node selftest.js */
"use strict";

global.window = {};

var Core = require("./core.js");
var fs = require("fs");
var src = fs.readFileSync("./render.js", "utf8");
var Render = eval(src + "; Render;");

var ctx = new Proxy({}, {
  get: function(t, k) {
    if (k === "createRadialGradient" || k === "createLinearGradient")
      return function() { return { addColorStop: function() {} }; };
    if (k === "measureText") return function() { return { width: 10 }; };
    if (k === "save" || k === "restore" || k === "translate" || k === "scale" || k === "rotate") return function() {};
    if (typeof k === "string") return function() {};
    return t[k];
  },
  set: function() { return true; }
});

var bad = 0;
function assert(label, cond, extra) {
  if (!cond) { bad++; console.log("  FAIL: " + label + (extra ? " → " + extra : "")); }
  else process.stdout.write(".");
}
function shot(label, st) {
  try { Render.draw(ctx, st, 1.0, 16); }
  catch (e) { bad++; console.log("  RENDER FAIL: " + label + " → " + e.constructor.name + ": " + e.message); }
}

console.log("=== Catch the Fallen selftest ===\n");

// 1. All levels × all difficulties must generate sane numbers
console.log("1. Level generation (all levels × all difficulties):");
Core.DIFF_IDS.forEach(function(d) {
  for (var lv = 1; lv <= Core.MAX_LEVEL; lv++) {
    var q = Core.quota(lv, d);
    var fs_ = Core.fallSpeed(lv, d);
    var gap = Core.gapFrames(lv, d);
    assert("quota≥3 lv" + lv + "/" + d, q >= 3, "q=" + q);
    assert("fallSpeed>0 lv" + lv + "/" + d, fs_ > 0);
    assert("gap>0 lv" + lv + "/" + d, gap > 0);
    assert("padW in-bounds lv" + lv + "/" + d, Core.padW(d) > 20 && Core.padW(d) < Core.W);
  }
});
console.log(" done\n");

// 2. Three difficulties must produce different numbers
console.log("2. Difficulty tiers produce different values:");
var g = Core.padW("gentle"), n = Core.padW("normal"), b = Core.padW("brave");
assert("pad width differs", g !== n && n !== b && g !== b, "g=" + g + " n=" + n + " b=" + b);
console.log("  padW gentle=" + g + ", normal=" + n + ", brave=" + b);
var gm = Core.maxMisses("gentle"), nm = Core.maxMisses("normal"), bm = Core.maxMisses("brave");
assert("miss allowance differs", gm !== nm && nm !== bm, "g=" + gm + " n=" + nm + " b=" + bm);
console.log("  misses gentle=" + gm + ", normal=" + nm + ", brave=" + bm);
console.log("");

// 3. Render all states without exceptions
console.log("3. Render coverage (all modes × states):");
var st = Core.create(1, "normal");
st.mode = "menu"; shot("menu", st);
Core.advance(st); shot("intro", st);
st.mode = "play"; shot("play-empty", st);
st.fallers.push({ x:60, y:80, vy:1.5, spin:1, sway:0, swayAmt:0.3 }); shot("play-faller", st);
st.caught.push({ x:40, y:Core.QUEUE_Y, t:10 }); shot("play-caught", st);
st.fxList.push({ type:"catch", x:60, y:Core.PAD_Y, t:10 }); shot("fx-catch", st);
st.fxList.push({ type:"miss", x:60, y:Core.PAD_Y, t:10 }); shot("fx-miss", st);
st.misses = 1; shot("window-darkened", st);
st.mode = "win"; st.msg = "All safe!"; shot("win", st);
st.mode = "lose"; st.msg = "Game Over"; shot("lose", st);
console.log(" done\n");

// 4. Logic paths: catch, miss, win, lose
console.log("4. Logic paths:");
// catch path
st = Core.create(1, "normal");
st.mode = "play";
st.fallers.push({ x: st.pad.x, y: Core.PAD_Y - 2, vy: 2, spin:1, sway:0, swayAmt:0 });
Core.update(st, 16);
assert("faller on pad → caught", st.caughtCount === 1, "caught=" + st.caughtCount);
// miss path
st = Core.create(1, "normal");
st.mode = "play";
st.fallers.push({ x: 8, y: Core.PAD_Y - 2, vy: 2, spin:1, sway:0, swayAmt:0 });
Core.update(st, 16);
assert("faller off pad → miss", st.misses === 1, "misses=" + st.misses);
// win path
st = Core.create(1, "normal");
st.mode = "play";
for (var i = 0; i < Core.quota(st.level, st.diff); i++) {
  st.fallers.push({ x: st.pad.x, y: Core.PAD_Y - 2, vy: 2, spin:1, sway:0, swayAmt:0 });
  Core.update(st, 16);
}
assert("reach quota → win", st.mode === "win", "mode=" + st.mode);
// lose path
st = Core.create(1, "normal");
st.mode = "play";
for (var j = 0; j < Core.maxMisses(st.diff); j++) {
  st.fallers.push({ x: 4, y: Core.PAD_Y - 2, vy: 2, spin:1, sway:0, swayAmt:0 });
  Core.update(st, 16);
}
assert("miss limit → lose", st.mode === "lose", "mode=" + st.mode);
console.log(" done\n");

// 5. Win progression: level advances exactly once
console.log("5. Win progression (no level skip):");
st = Core.create(1, "normal");
st.mode = "play";
for (var k = 0; k < Core.quota(st.level, st.diff); k++) {
  st.fallers.push({ x: st.pad.x, y: Core.PAD_Y - 2, vy: 2, spin:1, sway:0, swayAmt:0 });
  Core.update(st, 16);
}
assert("→ win", st.mode === "win");
var lvBefore = st.level;
Core.advance(st);
assert("win → intro", st.mode === "intro");
assert("level advanced exactly once", st.level === lvBefore + 1, "was " + lvBefore + " now " + st.level);
assert("best updated", st.best >= st.level);
console.log(" done\n");

// Summary
console.log("\n=== Results ===");
if (bad === 0) console.log("ALL PASSED ✓");
else { console.log(bad + " FAILURES ✗"); process.exit(1); }
