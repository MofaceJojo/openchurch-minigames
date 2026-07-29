/* 躲猫猫小镇 Peekaboo Town · 平台无关逻辑(无 DOM 无渲染)
   大白天的彩色小镇,小鬼穿着周围的颜色躲起来;点中 → 被弹飞,人得自由 */
"use strict";

var Core = (function () {
  var W = 240, H = 360;          // 虚拟像素画布(竖屏);像素更细,细节更多
  var MAX_LEVEL = 30;
  var IMP_W = 13, IMP_H = 15;    // 小鬼尺寸(够大才能画成认得出的生物)

  var DIFFS = {
    gentle: { id: "gentle", name: "Gentle", blurb: "Slow, easy to spot",
              time: 1.7, camo: 0.5, tell: 0.55, misses: 8 },
    normal: { id: "normal", name: "Normal", blurb: "A merry hunt",
              time: 1.0, camo: 1,   tell: 1,    misses: 5 },
    brave:  { id: "brave",  name: "Brave",  blurb: "Sharp eyes only",
              time: 0.8, camo: 1.3, tell: 1.5,  misses: 3 }
  };
  var DIFF_IDS = ["gentle", "normal", "brave"];
  function diff(d) { return DIFFS[d] || DIFFS.normal; }

  function impCount(level) { return Math.min(7, 1 + Math.floor((level - 1) / 4)); }
  function timeLimit(level, d) {
    return Math.round((45 + impCount(level) * 12) * diff(d).time);
  }
  function camoStrength(level, d) {          // 0=一眼看穿, 1=颜色几乎完全融入
    return Math.min(0.92, (0.4 + (level - 1) * 0.018) * diff(d).camo);
  }
  function peekEvery(level, d) {
    return (1.8 + (level - 1) * 0.1) * diff(d).tell;
  }
  function maxMisses(level, d) { return diff(d).misses; }

  function rng(seed) {
    var s = seed >>> 0 || 1;
    return function () {
      s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0;
      return s / 4294967296;
    };
  }

  var WALLS = [[247,183,178],[250,214,150],[178,224,196],[176,212,242],[240,226,168],[212,192,238],[245,201,168]];
  var ROOFS = [[214,106,102],[206,140,68],[86,166,126],[92,146,200],[196,160,60],[150,116,196],[204,124,84]];
  var GLASS = [184, 228, 246];                 // 窗玻璃颜色,渲染层必须一致

  function buildScene(level) {
    var R = rng(level * 7919 + 13);
    var sc = { clouds: [], houses: [], trees: [], flowers: [], bushes: [], spots: [] };
    var i;

    sc.sun = { x: 36 + (R() * 18 | 0), y: 34 };
    for (i = 0; i < 5; i++)
      sc.clouds.push({ x: (R() * W) | 0, y: 20 + (R() * 66 | 0), w: 26 + (R() * 24 | 0), sp: 0.25 + R() * 0.5 });

    var GROUND = H - 80;

    var x = -4;
    while (x < W) {
      var hw = 42 + (R() * 26 | 0);
      var hh = 60 + (R() * 50 | 0);
      var top = GROUND - hh;
      var ci = (R() * WALLS.length) | 0;
      var h = { x: x, y: top, w: hw, h: hh,
                wall: WALLS[ci], roof: ROOFS[ci],
                windows: [], door: R() < 0.6, chimney: R() < 0.5,
                bricks: R() < 0.5 };
      var cols = Math.max(1, Math.floor((hw - 12) / 17));
      var rows = Math.max(1, Math.floor((hh - 24) / 21));
      for (var cx = 0; cx < cols; cx++) for (var cy = 0; cy < rows; cy++)
        h.windows.push({ x: h.x + 8 + cx * 17, y: top + 15 + cy * 21, box: R() < 0.5 });
      sc.houses.push(h);

      // 藏身点只放在「大片同色表面」上 —— 小鬼必须完整压在同一种颜色里,
      // 否则(比如骑在屋脊上、半个身子露在蓝天里)再怎么调色也藏不住。
      for (i = 0; i < h.windows.length; i++)     // 趴在窗玻璃上,穿玻璃的颜色
        if (R() < 0.5) sc.spots.push({ kind: "window", x: h.windows[i].x - 2, y: h.windows[i].y - 2, host: GLASS });
      for (var q = 0; q < 2; q++)                // 贴在墙面上
        if (hh > 46) sc.spots.push({ kind: "wall",
                                     x: h.x + 4 + (R() * Math.max(1, hw - 21) | 0),
                                     y: top + 14 + (R() * Math.max(1, hh - 32) | 0), host: h.wall });
      x += hw + 3;
    }

    for (i = 0; i < 5; i++) {
      var tx = 16 + i * 48 + (R() * 18 | 0);
      var ty = GROUND - 24 - (R() * 14 | 0);
      var tc = [96 + (R() * 30 | 0), 168 + (R() * 30 | 0), 96 + (R() * 24 | 0)];
      var trr = 17 + (R() * 6 | 0);
      sc.trees.push({ x: tx, y: ty, r: trr, col: tc });
      // 正对树冠圆心,保证整只都压在树叶上
      sc.spots.push({ kind: "tree", x: tx + trr - (IMP_W >> 1), y: ty - (IMP_H >> 1), host: tc });
    }

    for (i = 0; i < 22; i++)
      sc.flowers.push({ x: (R() * W) | 0, y: GROUND + 6 + (R() * 70 | 0),
                        c: [[255,120,140],[255,225,110],[190,150,255],[255,255,255]][(R() * 4) | 0] });

    for (i = 0; i < 6; i++) {
      var bx = 8 + (R() * (W - 30) | 0);
      var by = GROUND + 12 + (R() * 46 | 0);
      var bc = [110 + (R() * 24 | 0), 180 + (R() * 26 | 0), 110 + (R() * 20 | 0)];
      var bww = 22 + (R() * 12 | 0);
      sc.bushes.push({ x: bx, y: by, w: bww, col: bc });
      // 灌木可见范围是 by-7 .. by+12,把小鬼摆在正中间
      sc.spots.push({ kind: "bush", x: bx + (bww >> 1) - (IMP_W >> 1), y: by - 5, host: bc });
    }

    // ① 必须完整落在画面内(否则小鬼躲到屏幕外,那关永远过不了)
    // ② 墙面/窗户的点不能被树或灌木压住 —— 小鬼画在最上层,
    //    一只墙色的小鬼趴在绿树冠上会无比显眼,伪装彻底失效
    function overlapsFoliage(p) {
      var i, t, b;
      for (i = 0; i < sc.trees.length; i++) {
        t = sc.trees[i];
        if (p.x + IMP_W > t.x - 3 && p.x < t.x + t.r * 2 + 3 &&
            p.y + IMP_H > t.y - t.r - 3 && p.y < t.y + t.r + 30) return true;
      }
      for (i = 0; i < sc.bushes.length; i++) {
        b = sc.bushes[i];
        if (p.x + IMP_W > b.x - 3 && p.x < b.x + b.w + 3 &&
            p.y + IMP_H > b.y - 10 && p.y < b.y + 14) return true;
      }
      return false;
    }
    sc.spots = sc.spots.filter(function (p) {
      if (p.x < 2 || p.x + IMP_W > W - 2 || p.y < 2 || p.y + IMP_H > H - 2) return false;
      if (p.kind === "tree" || p.kind === "bush") return true;
      return !overlapsFoliage(p);
    });

    var n = impCount(level), picked = [], pool = sc.spots.slice();
    while (picked.length < n && pool.length) {
      var k = (R() * pool.length) | 0, s = pool.splice(k, 1)[0];
      var tooClose = false;
      for (i = 0; i < picked.length; i++)
        if (Math.abs(picked[i].x - s.x) < 26 && Math.abs(picked[i].y - s.y) < 26) tooClose = true;
      if (!tooClose) picked.push(s);
    }
    sc.imps = picked.map(function (s, idx) {
      return { x: s.x, y: s.y, kind: s.kind, host: s.host,
               found: false, freeing: 0, peekAt: 0.6 + idx * 0.8, peeked: false };
    });
    return sc;
  }

  function newLevel(st, level) {
    st.level = level;
    st.scene = buildScene(level);
    st.found = 0; st.misses = 0;
    st.time = timeLimit(level, st.diff);
    st.elapsed = 0;
    st.flash = null;
    st.mode = "intro";
  }

  function create(savedLevel, difficulty) {
    var st = { mode: "menu", best: savedLevel || 1,
               diff: DIFFS[difficulty] ? difficulty : "normal" };
    newLevel(st, st.best);
    st.mode = "menu";
    return st;
  }

  function setDifficulty(st, d) {
    if (!DIFFS[d] || st.diff === d) return false;
    st.diff = d;
    newLevel(st, st.level);
    st.mode = "menu";
    return true;
  }

  var HIT_R = 12;

  function shine(st, vx, vy) {
    if (st.mode !== "play") return null;
    var im = st.scene.imps, i, best = -1, bd = 1e9;
    for (i = 0; i < im.length; i++) {
      if (im[i].found) continue;
      var dx = im[i].x + IMP_W / 2 - vx, dy = im[i].y + IMP_H / 2 - vy;
      var dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < bd) { bd = dist; best = i; }
    }
    if (best >= 0 && bd <= HIT_R) {
      im[best].found = true; im[best].freeing = 0;
      im[best].spin = Math.random() < 0.5 ? -1 : 1;
      st.found++;
      if (st.found >= im.length) st.mode = "cleared";
      return { hit: true, at: { x: im[best].x, y: im[best].y }, cleared: st.mode === "cleared" };
    }
    st.misses++;
    st.flash = { x: vx, y: vy, t: 0 };
    if (st.misses >= maxMisses(st.level, st.diff)) {
      st.mode = "failed"; st.failWhy = "Too many wild guesses!";
    }
    return { hit: false, at: { x: vx, y: vy }, failed: st.mode === "failed" };
  }

  function tick(st, dtMs) {
    var dt = dtMs / 1000, i, events = { peeked: false, timeUp: false };
    if (st.mode === "play") {
      st.elapsed += dt;
      st.time -= dt;
      if (st.time <= 0) { st.time = 0; st.mode = "failed"; st.failWhy = "Time ran out!"; events.timeUp = true; }
      var period = peekEvery(st.level, st.diff);
      for (i = 0; i < st.scene.imps.length; i++) {
        var d = st.scene.imps[i];
        if (d.found) continue;
        if (st.elapsed >= d.peekAt && !d.peeked) { d.peeked = true; events.peeked = true; }
        if (st.elapsed >= d.peekAt + 0.5) {
          d.peekAt = st.elapsed + period + Math.random() * period * 0.6;
          d.peeked = false;
        }
      }
    }
    for (i = 0; i < st.scene.imps.length; i++)
      if (st.scene.imps[i].found) st.scene.imps[i].freeing += dt;
    if (st.flash) { st.flash.t += dt; if (st.flash.t > 0.6) st.flash = null; }
    for (i = 0; i < st.scene.clouds.length; i++) {
      var c = st.scene.clouds[i];
      c.x += c.sp * dt * 4;
      if (c.x > W + 30) c.x = -36;
    }
    return events;
  }

  function isPeeking(st, d) {
    if (d.found) return false;
    var since = st.elapsed - d.peekAt;
    return since >= 0 && since < 0.5;
  }

  function advance(st) {
    if (st.mode === "menu" || st.mode === "failed") newLevel(st, st.level);
    else if (st.mode === "cleared") {
      var lv = Math.min(st.level + 1, MAX_LEVEL);
      if (lv > st.best) st.best = lv;
      newLevel(st, lv);
    } else if (st.mode === "intro") st.mode = "play";
  }

  return {
    W: W, H: H, MAX_LEVEL: MAX_LEVEL, HIT_R: HIT_R, IMP_W: IMP_W, IMP_H: IMP_H,
    DIFFS: DIFFS, DIFF_IDS: DIFF_IDS, setDifficulty: setDifficulty,
    impCount: impCount, timeLimit: timeLimit, camoStrength: camoStrength,
    maxMisses: maxMisses, create: create, newLevel: newLevel,
    shine: shine, tick: tick, advance: advance, isPeeking: isPeeking
  };
})();

if (typeof module !== "undefined") module.exports = Core;
