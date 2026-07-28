/* 躲猫猫小镇 Peekaboo Town · 平台无关逻辑(无 DOM 无渲染)
   大白天的彩色小镇,小鬼穿着周围的颜色躲起来;照光点中 → 被弹飞,人得自由 */
"use strict";

var Core = (function () {
  var W = 160, H = 240;          // 虚拟像素画布(竖屏)
  var MAX_LEVEL = 30;

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
  function camoStrength(level, d) {          // 0=一眼看穿, 1=几乎完全融入
    return Math.min(0.95, (0.42 + (level - 1) * 0.019) * diff(d).camo);
  }
  function peekEvery(level, d) {             // 探头间隔(秒)
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

  /* 明快配色:粉、杏、薄荷、天蓝、奶黄、丁香紫 */
  var WALLS = [[247,183,178],[250,214,150],[178,224,196],[176,212,242],[240,226,168],[212,192,238],[245,201,168]];
  var ROOFS = [[214,106,102],[206,140,68],[86,166,126],[92,146,200],[196,160,60],[150,116,196],[204,124,84]];

  function buildScene(level) {
    var R = rng(level * 7919 + 13);
    var sc = { clouds: [], houses: [], trees: [], flowers: [], spots: [] };
    var i;

    sc.sun = { x: 24 + (R() * 12 | 0), y: 22 };
    for (i = 0; i < 4; i++)
      sc.clouds.push({ x: (R() * W) | 0, y: 14 + (R() * 44 | 0), w: 18 + (R() * 16 | 0), sp: 0.25 + R() * 0.5 });

    var GROUND = H - 54;

    // 一排彩色小房子
    var x = -3;
    while (x < W) {
      var hw = 28 + (R() * 16 | 0);
      var hh = 40 + (R() * 34 | 0);
      var top = GROUND - hh;
      var ci = (R() * WALLS.length) | 0;
      var h = { x: x, y: top, w: hw, h: hh,
                wall: WALLS[ci], roof: ROOFS[ci],
                windows: [], door: R() < 0.6, chimney: R() < 0.5 };
      var cols = Math.max(1, Math.floor((hw - 8) / 11));
      var rows = Math.max(1, Math.floor((hh - 16) / 14));
      for (var cx = 0; cx < cols; cx++) for (var cy = 0; cy < rows; cy++)
        h.windows.push({ x: h.x + 5 + cx * 11, y: top + 10 + cy * 14, box: R() < 0.5 });
      sc.houses.push(h);

      sc.spots.push({ kind: "roof",  x: h.x + 5 + (R() * (hw - 14) | 0), y: top - 6, host: h.roof });
      if (h.chimney) sc.spots.push({ kind: "chimney", x: h.x + 4, y: top - 11, host: h.roof });
      for (i = 0; i < h.windows.length; i++)
        if (R() < 0.55) sc.spots.push({ kind: "window", x: h.windows[i].x, y: h.windows[i].y - 1, host: h.wall });
      sc.spots.push({ kind: "wall", x: h.x + 3 + (R() * (hw - 12) | 0), y: top + 14 + (R() * Math.max(1, hh - 26) | 0), host: h.wall });
      x += hw + 2;
    }

    // 树:圆蓬蓬的树冠
    for (i = 0; i < 4; i++) {
      var tx = 12 + i * 40 + (R() * 14 | 0);
      var ty = GROUND - 16 - (R() * 10 | 0);
      var tc = [96 + (R() * 30 | 0), 168 + (R() * 30 | 0), 96 + (R() * 24 | 0)];
      sc.trees.push({ x: tx, y: ty, r: 11 + (R() * 4 | 0), col: tc });
      sc.spots.push({ kind: "tree", x: tx - 4, y: ty - 4, host: tc });
    }

    // 草地上的小花
    for (i = 0; i < 14; i++)
      sc.flowers.push({ x: (R() * W) | 0, y: GROUND + 4 + (R() * 46 | 0),
                        c: [[255,120,140],[255,225,110],[190,150,255],[255,255,255]][(R() * 4) | 0] });

    // 灌木
    sc.bushes = [];
    for (i = 0; i < 5; i++) {
      var bx = 5 + (R() * (W - 20) | 0);
      var by = GROUND + 8 + (R() * 30 | 0);
      var bc = [110 + (R() * 24 | 0), 180 + (R() * 26 | 0), 110 + (R() * 20 | 0)];
      sc.bushes.push({ x: bx, y: by, w: 14 + (R() * 8 | 0), col: bc });
      sc.spots.push({ kind: "bush", x: bx + 3, y: by - 5, host: bc });
    }

    // 只保留完整落在画面内的藏身点(否则小鬼会躲到屏幕外,那关永远过不了)
    sc.spots = sc.spots.filter(function (p) {
      return p.x >= 2 && p.x + 9 <= W - 2 && p.y >= 2 && p.y + 10 <= H - 2;
    });

    var n = impCount(level), picked = [], pool = sc.spots.slice();
    while (picked.length < n && pool.length) {
      var k = (R() * pool.length) | 0, s = pool.splice(k, 1)[0];
      var tooClose = false;
      for (i = 0; i < picked.length; i++)
        if (Math.abs(picked[i].x - s.x) < 17 && Math.abs(picked[i].y - s.y) < 17) tooClose = true;
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

  var HIT_R = 8;

  function shine(st, vx, vy) {
    if (st.mode !== "play") return null;
    var im = st.scene.imps, i, best = -1, bd = 1e9;
    for (i = 0; i < im.length; i++) {
      if (im[i].found) continue;
      var dx = im[i].x + 4 - vx, dy = im[i].y + 5 - vy;
      var dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < bd) { bd = dist; best = i; }
    }
    if (best >= 0 && bd <= HIT_R) {
      im[best].found = true; im[best].freeing = 0;
      im[best].spin = Math.random() < 0.5 ? -1 : 1;
      st.found++;
      if (st.found >= im.length) { st.mode = "cleared"; }
      return { hit: true, at: { x: im[best].x, y: im[best].y }, cleared: st.mode === "cleared" };
    }
    st.misses++;
    st.flash = { x: vx, y: vy, t: 0 };
    if (st.misses >= maxMisses(st.level, st.diff)) {
      st.mode = "failed"; st.failWhy = "Too many wild guesses!";
    }
    return { hit: false, at: { x: vx, y: vy }, failed: st.mode === "failed" };
  }

  /* 返回这一拍新发生的事,壳层据此播音效 */
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
        if (st.elapsed >= d.peekAt + 0.45) {
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
      c.x += c.sp * dt * 3;
      if (c.x > W + 20) c.x = -24;
    }
    return events;
  }

  /* 小鬼此刻是否探头(眼睛瞪大 + 吐舌头,唯一破绽) */
  function isPeeking(st, d) {
    if (d.found) return false;
    var since = st.elapsed - d.peekAt;
    return since >= 0 && since < 0.45;
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
    W: W, H: H, MAX_LEVEL: MAX_LEVEL, HIT_R: HIT_R,
    DIFFS: DIFFS, DIFF_IDS: DIFF_IDS, setDifficulty: setDifficulty,
    impCount: impCount, timeLimit: timeLimit, camoStrength: camoStrength,
    maxMisses: maxMisses, create: create, newLevel: newLevel,
    shine: shine, tick: tick, advance: advance, isPeeking: isPeeking
  };
})();

if (typeof module !== "undefined") module.exports = Core;
