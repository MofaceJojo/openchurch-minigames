/* Holy Bubbles · selftest.js — run with: node selftest.js */
"use strict";

global.window = {};

var Core = require("./core.js");
var fs = require("fs");
var src = fs.readFileSync("./render.js", "utf8");
var Render = eval(src + "; Render;");

// Stub canvas: any method exists, no throw — just to exercise all draw paths
var ctx = new Proxy({}, {
  get: function(t, k) {
    if (k === "createRadialGradient" || k === "createLinearGradient")
      return function() { return { addColorStop: function() {} }; };
    if (k === "measureText") return function() { return { width: 10 }; };
    if (k === "save" || k === "restore") return function() {};
    if (k === "translate" || k === "scale" || k === "rotate") return function() {};
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

console.log("=== Holy Bubbles selftest ===\n");

// 1. All levels × all difficulties must generate & all enemies in-bounds
console.log("1. Level generation (all levels × all difficulties):");
Core.DIFF_IDS.forEach(function(d) {
  Core.DIFF_IDS.forEach(function(d2) {
    // skip redundant combos but we need at least all levels for normal
  });
  for (var lv = 1; lv <= Core.MAX_LEVEL; lv++) {
    var st = Core.create(1, d);
    st.level = lv; st.mode = "play";
    Core.startLevel(st, false);
    st.mode = "play";
    assert("lv" + lv + "/" + d + " map has walkable area",
           st.map.some(function(v) { return v === 0; }));
    for (var i = 0; i < st.enemies.length; i++) {
      var en = st.enemies[i];
      assert("enemy in-bounds lv" + lv + "/" + d + " enemy#" + i,
             en.c >= 0 && en.c < Core.COLS && en.r >= 0 && en.r < Core.ROWS,
             "c=" + en.c + " r=" + en.r);
    }
    assert("player spawn walkable lv" + lv + "/" + d,
           st.map[1 * Core.COLS + 1] === 0);
  }
});
console.log(" done");
console.log("");

// 2. Three difficulties must produce different numbers
console.log("2. Difficulty tiers produce different values:");
var g = Core.create(1, "gentle");
var n = Core.create(1, "normal");
var b = Core.create(1, "brave");
var gP = g.player.lives, nP = n.player.lives, bP = b.player.lives;
assert("gentle vs normal lives differ", gP !== nP, "g=" + gP + " n=" + nP);
assert("normal vs brave lives differ", nP !== bP, "n=" + nP + " b=" + bP);
assert("gentle vs brave lives differ", gP !== bP, "g=" + gP + " b=" + bP);
console.log("  gentle lives=" + gP + ", normal=" + nP + ", brave=" + bP);
var gE = Core.DIFFS.gentle.enemySpeed, nE = Core.DIFFS.normal.enemySpeed, bE = Core.DIFFS.brave.enemySpeed;
assert("enemy speed differs across tiers", gE !== nE && nE !== bE && gE !== bE);
console.log("  gentle espeed=" + gE + ", normal=" + nE + ", brave=" + bE);
console.log("");

// 3. Render all states without exceptions
console.log("3. Render coverage (all modes × keyframes):");
var st = Core.create(1, "normal");
// menu
st.mode = "menu"; shot("menu", st);
// intro
Core.advance(st); shot("intro", st);
// play — empty (no bombs, no flames)
st.mode = "play"; shot("play-empty", st);
// play — with bomb on field
Core.placeBomb(st); shot("play-with-bomb", st);
// play — simulate explosion: manually push a flame
st.flames.push({ c:1, r:1, t:24 }); shot("play-flame-100%", st);
st.flames[0].t = 12; shot("play-flame-50%", st);
st.flames[0].t = 2; shot("play-flame-1%", st);
st.flames = [];
// play — with drop on field
st.drops.push({ c:2, r:2, type:"fire" }); shot("play-drop-fire", st);
st.drops[0].type = "bomb"; shot("play-drop-bomb", st);
st.drops[0].type = "speed"; shot("play-drop-speed", st);
st.drops[0].type = "shield"; shot("play-drop-shield", st);
st.drops[0].type = "life"; shot("play-drop-life", st);
st.drops = [];
// play — with enemy poof (0% / 50% / 100%)
st.poofs.push({ x:60, y:60, t:36, kind:"imp" }); shot("poof-100%", st);
st.poofs[0].t = 18; shot("poof-50%", st);
st.poofs[0].t = 2; shot("poof-1%", st);
st.poofs.push({ x:60, y:60, t:60, kind:"miniboss", big:true }); shot("poof-boss", st);
st.poofs = [];
// play — enemy hitFlash
st.enemies[0].hitFlash = 45; shot("enemy-hitFlash", st);
st.enemies[0].hitFlash = 0;
// play — boss with blood bar
st.enemies.push({ kind:"miniboss", c:5, r:5, x:5*24+12, y:5*24+12, dir:"left", dead:false,
  hp:2, maxHp:3, speed:1.5, hitFlash:0, boss:true, bombLimit:2, bombPower:0 });
shot("boss-on-field", st);
st.enemies[st.enemies.length-1].hitFlash = 45; shot("boss-hitFlash", st);
// win
st.mode = "win"; st.msg = "Floor cleared!"; shot("win", st);
// lose
st.mode = "lose"; st.msg = "Game Over"; shot("lose", st);
console.log(" done");
console.log("");

// 4. Logic paths
console.log("4. Logic paths:");
// success path: kill all enemies
st = Core.create(1, "normal");
st.mode = "play";
for (var i = 0; i < st.enemies.length; i++) st.enemies[i].dead = true;
Core.update(st, 16);
assert("all-dead triggers win", st.mode === "win", "mode=" + st.mode);
// trap path: water hits player → trapped (not instant death)
st = Core.create(1, "normal");
st.mode = "play";
st.player.lives = 3; st.player.hurtT = 0; st.player.shield = 0;
var pc0 = Math.floor(st.player.x / 24), pr0 = Math.floor(st.player.y / 24);
st.flames.push({ c:pc0, r:pr0, t:24 });
Core.update(st, 16);
assert("water-hit → trapped (not hurt)", st.player.trapped === true, "trapped=" + st.player.trapped);
// fail to break free → lose a life
var livesBefore = st.player.lives;
st.player.trapT = 1;
Core.update(st, 16);
assert("trap timeout → lose a life", st.player.lives === livesBefore - 1, "lives=" + st.player.lives);
// force death via repeated traps
while (st.mode === "play" && st.player.lives > 0) {
  st.player.hurtT = 0; st.player.shield = 0; st.player.trapped = false;
  st.flames.push({ c:Math.floor(st.player.x / 24), r:Math.floor(st.player.y / 24), t:24 });
  Core.update(st, 16);
  st.player.trapT = 1;
  Core.update(st, 16);
}
assert("repeated traps → lose", st.mode === "lose", "mode=" + st.mode);
// advance from lose
Core.advance(st);
assert("advance from lose → intro", st.mode === "intro" || st.mode === "play", "mode=" + st.mode);
console.log(" done");
console.log("");

// 5. Bomb placement & explosion
console.log("5. Bomb mechanics:");
st = Core.create(1, "normal");
st.mode = "play";
var r1 = Core.placeBomb(st);
assert("placeBomb succeeds", r1 && r1.placed);
assert("bomb on field", st.bombs.length === 1);
// can't place second bomb on same cell
var r2 = Core.placeBomb(st);
assert("duplicate bomb blocked", !r2, "got " + JSON.stringify(r2));
// explode: tick bomb to 0
var bt = st.bombs[0].t;
for (var i = 0; i < bt + 1; i++) Core.update(st, 16);
assert("bomb exploded & removed", st.bombs.length === 0);
assert("flames created by explosion", st.flames.length > 0);
// soft wall destroyed?
// (depends on random map, but at least flames should have been placed)
console.log(" done");
console.log("");

// 6. Difficulty set mid-game
console.log("6. Difficulty switching:");
st = Core.create(1, "normal");
var oldLives = st.player.lives;
Core.setDifficulty(st, "brave");
assert("difficulty changed", st.diff === "brave");
assert("brave lives < normal lives", st.player.lives < oldLives, "brave=" + st.player.lives + " normal=" + oldLives);
console.log(" done");
console.log("");

// 7. Win progression: level advances exactly once (regression: double-increment bug)
console.log("7. Win progression (no level skip):");
st = Core.create(1, "normal");
st.mode = "play";
for (var k = 0; k < st.enemies.length; k++) st.enemies[k].dead = true;
Core.update(st, 16);
assert("all-dead → win", st.mode === "win", "mode=" + st.mode);
var lvBefore = st.level;
Core.advance(st);
assert("win → intro", st.mode === "intro", "mode=" + st.mode);
assert("level advanced exactly once", st.level === lvBefore + 1, "was " + lvBefore + " now " + st.level);
assert("best updated", st.best >= st.level, "best=" + st.best + " level=" + st.level);
console.log(" done");
console.log("");

// 8. Trap & purify (泡泡堂核心)
console.log("8. Trap & purify:");
function mkImp(c, r) {
  return { kind:"imp", c:c, r:r, x:c*24+12+7, y:r*24+12+7, dir:"left", dead:false,
           trapped:false, trapT:0, hp:1, maxHp:1, speed:0, dashT:200, dashing:0,
           bombT:999999, hitFlash:0, boss:false, bombLimit:1, bombPower:0 };
}
st = Core.create(1, "normal");
st.mode = "play";
st.enemies = [mkImp(3, 3)];
st.flames.push({ c:3, r:3, t:24 });
Core.update(st, 16);
assert("water hits imp → trapped", st.enemies[0].trapped === true);
assert("trapped imp not dead yet", st.enemies[0].dead === false);
st.flames.push({ c:3, r:3, t:24 });
Core.update(st, 16);
assert("second hit purifies", st.enemies[0].dead === true, "dead=" + st.enemies[0].dead + " score=" + st.score);
st = Core.create(1, "normal");
st.mode = "play";
st.enemies = [mkImp(4, 4)];
st.enemies[0].trapped = true; st.enemies[0].trapT = 1;
Core.update(st, 16);
assert("trapped imp breaks free on timeout", st.enemies[0].trapped === false && st.enemies[0].dead === false);
console.log(" done");
console.log("");

// 9. Kick & break free
console.log("9. Kick & break free:");
st = Core.create(1, "normal");
st.mode = "play";
st.player.trapped = true; st.player.trapT = 100; st.player.struggleN = 0;
for (var s = 0; s < Core.STRUGGLE_NEED; s++) Core.setPlayerDir(st, "up");
Core.update(st, 16);
assert("mash arrows → break free", st.player.trapped === false);
st = Core.create(1, "normal");
st.mode = "play";
st.map = new Array(Core.COLS * Core.ROWS).fill(0);
st.enemies = [];
st.bombs = [{ c:2, r:2, x:2*24+12, y:2*24+12, vx:0, vy:0, kicked:false, t:200, left:true, passable:false, owner:"player", power:1 }];
st.player.x = 1 * 24 + 12; st.player.y = 2 * 24 + 12; st.player._dir = "right";
var kb = Core.kickBomb(st);
assert("kickBomb succeeds", kb && kb.kicked);
assert("bomb has rightward velocity", st.bombs[0].vx > 0, "vx=" + st.bombs[0].vx);
var startC = st.bombs[0].c;
for (var f2 = 0; f2 < 6; f2++) Core.update(st, 16);
assert("bomb slid right", st.bombs[0].c > startC, "c=" + st.bombs[0].c);
console.log(" done");
console.log("");

// 10. Combo, rage & powerups (泡泡堂细节)
console.log("10. Combo, rage & powerups:");
st = Core.create(1, "normal");
st.mode = "play";
st.enemies = [mkImp(3, 3), mkImp(5, 5)];
st.enemies[0].trapped = true; st.enemies[0].trapT = 100;
st.enemies[1].trapped = true; st.enemies[1].trapT = 100;
st.combo = 0; st.comboTimer = 0;
var sc0 = st.score;
st.player.x = 3 * 24 + 12; st.player.y = 3 * 24 + 12;
Core.update(st, 16);
var sc1 = st.score;
st.player.x = 5 * 24 + 12; st.player.y = 5 * 24 + 12;
Core.update(st, 16);
var sc2 = st.score;
assert("combo purifies both", st.enemies[0].dead && st.enemies[1].dead);
assert("combo score doubles", (sc2 - sc1) > (sc1 - sc0), "d1=" + (sc1 - sc0) + " d2=" + (sc2 - sc1));
assert("combo counter ≥ 2", st.combo >= 2, "combo=" + st.combo);
st = Core.create(1, "normal");
st.mode = "play";
st.enemies = [mkImp(4, 4)];
st.enemies[0].trapped = true; st.enemies[0].trapT = 1;
Core.update(st, 16);
assert("trap timeout → rage", st.enemies[0].rage === true && st.enemies[0].trapped === false);
st = Core.create(1, "normal");
st.mode = "play";
st.player.remoteT = 600;
Core.placeBomb(st);
assert("remote: first press places", st.bombs.length === 1 && st.bombs[0].remote === true);
var rbd = Core.placeBomb(st);
assert("remote: second press detonates", rbd && rbd.remote === true, JSON.stringify(rbd));
assert("remote bomb about to blow", st.bombs[0].t <= 1);
st = Core.create(1, "normal");
st.mode = "play";
st.map = new Array(Core.COLS * Core.ROWS).fill(0);
st.enemies = [];
st.bombs = [{ c:3, r:3, x:3*24+12, y:3*24+12, vx:0, vy:0, kicked:false, t:140, left:true, passable:false, owner:"player", power:1 }];
st.player.x = 1 * 24 + 12; st.player.y = 1 * 24 + 12;
st.player.gloveT = 600;
assert("glove passes own bomb", Core.isSolid(st, 3, 3, false, st.player) === false);
st.player.gloveT = 0;
assert("no glove → blocked", Core.isSolid(st, 3, 3, false, st.player) === true);
console.log(" done");
console.log("");

// 11. Poof 过期回归 —— 「炸死第一个怪物就死机」的根因
//     旧代码: if(--st.poofs[i].t<=0) st.poofs.splice(i,1); st.poofs[i].y -= 0.8;
//     poof 是数组最后一个时,splice 之后再读 st.poofs[i] → undefined.y → 抛错
//     → 主循环 Core.update 抛错 → rAF 停摆 → 画面卡死(死机)
console.log("11. Poof expiry regression (first-kill freeze):");
st = Core.create(1, "normal");
st.mode = "play";
var victim = mkImp(4, 4); victim.trapped = true; victim.trapT = 100;
var guard = mkImp(7, 7);                    // 站桩活口:保证不清关,mode 停在 play
st.enemies = [victim, guard];
st.player.x = 4 * 24 + 12; st.player.y = 4 * 24 + 12;
Core.update(st, 16);                        // 踩中已困泡的恶魔 → 净化 → 唯一 1 个 poof
assert("purify -> exactly 1 poof", st.poofs.length === 1, "poofs=" + st.poofs.length);
assert("victim dead", victim.dead === true);
assert("still playing (guard alive)", st.mode === "play", "mode=" + st.mode);
var threw = null;
try {
  for (var f = 0; f < 60; f++) Core.update(st, 16);    // poof.t=36,必然走到过期
} catch (e) { threw = e.constructor.name + ": " + e.message; }
assert("poof expiry must not throw", threw === null, "threw: " + threw);
assert("poof removed after expiry", st.poofs.length === 0, "poofs=" + st.poofs.length);
console.log(" done");
console.log("");

// Summary
console.log("\n=== Results ===");
if (bad === 0) console.log("ALL PASSED ✓");
else { console.log(bad + " FAILURES ✗"); process.exit(1); }
