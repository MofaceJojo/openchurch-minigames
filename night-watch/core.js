/* 夜巡 Night Watch · 平台无关逻辑(无 DOM 无渲染)
   像素小镇场景 + 伪装成环境的鬼,点中即赶出、人得自由 */
"use strict";

var Core = (function () {
  var W = 160, H = 240;          // 虚拟像素画布(竖屏)
  var MAX_LEVEL = 30;

  var DIFFS = {
    gentle: { id: "gentle", name: "Gentle", blurb: "More time, clearer tells",
              time: 1.6, camo: 0.55, tell: 0.6, misses: 6 },
    normal: { id: "normal", name: "Normal", blurb: "A steady watch",
              time: 1.0, camo: 1,    tell: 1,   misses: 4 },
    brave:  { id: "brave",  name: "Brave",  blurb: "Sharp eyes only",
              time: 0.78, camo: 1.35, tell: 1.5, misses: 3 }
  };
  var DIFF_IDS = ["gentle", "normal", "brave"];
  function diff(d) { return DIFFS[d] || DIFFS.normal; }

  /* 关卡曲线:鬼变多、伪装变强、提示变淡、时间变紧 —— 但基准很宽松 */
  function demonCount(level) { return Math.min(7, 1 + Math.floor((level - 1) / 4)); }
  function timeLimit(level, d) {
    return Math.round((40 + demonCount(level) * 11) * diff(d).time);
  }
  function camoStrength(level, d) {          // 0=一眼看穿, 1=几乎完全融入
    return Math.min(0.96, (0.46 + (level - 1) * 0.019) * diff(d).camo);
  }
  function tellEvery(level, d) {             // 眨眼间隔(秒),越大越难
    return (2.0 + (level - 1) * 0.11) * diff(d).tell;
  }
  function maxMisses(level, d) { return diff(d).misses; }

  /* ---- 可复现随机:同一关卡布局固定,重试时场景不变 ---- */
  function rng(seed) {
    var s = seed >>> 0 || 1;
    return function () {
      s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0;
      return s / 4294967296;
    };
  }

  /* ---- 场景生成:夜里的小镇 ---- */
  function buildScene(level, d) {
    var R = rng(level * 7919 + 13);
    var sc = { stars: [], buildings: [], lamps: [], bushes: [], spots: [] };
    var i;

    for (i = 0; i < 34; i++)
      sc.stars.push({ x: (R() * W) | 0, y: (R() * 92) | 0, b: 0.35 + R() * 0.65 });
    sc.moon = { x: W - 30 - (R() * 18 | 0), y: 22 + (R() * 10 | 0), r: 9 };

    // 一排高低错落的房子
    var x = -4;
    while (x < W) {
      var bw = 26 + (R() * 20 | 0);
      var bh = 52 + (R() * 58 | 0);
      var top = H - 46 - bh;
      var shade = 26 + (R() * 16 | 0);
      var b = { x: x, y: top, w: bw, h: bh,
                col: [shade, shade + 6, shade + 20],
                roof: [shade + 10, shade + 14, shade + 26],
                windows: [], chimney: R() < 0.45 };
      var cols = Math.max(1, Math.floor((bw - 8) / 9));
      var rows = Math.max(1, Math.floor((bh - 12) / 12));
      for (var cx = 0; cx < cols; cx++) for (var cy = 0; cy < rows; cy++) {
        b.windows.push({ x: b.x + 5 + cx * 9, y: top + 8 + cy * 12,
                         lit: R() < 0.42, warm: R() < 0.7 });
      }
      sc.buildings.push(b);
      // 可藏点:屋顶边缘、烟囱旁、暗窗
      sc.spots.push({ kind: "roof", x: b.x + 4 + (R() * (bw - 12) | 0), y: top - 5, host: b.roof });
      if (b.chimney) sc.spots.push({ kind: "chimney", x: b.x + 5, y: top - 9, host: b.roof });
      for (i = 0; i < b.windows.length; i++)
        if (!b.windows[i].lit && R() < 0.5)
          sc.spots.push({ kind: "window", x: b.windows[i].x, y: b.windows[i].y, host: [18, 20, 34] });
      x += bw + 1;
    }

    // 路灯 + 灌木 + 木桶
    for (i = 0; i < 3; i++) {
      var lx = 16 + i * 52 + (R() * 12 | 0);
      sc.lamps.push({ x: lx, y: H - 46 });
      sc.spots.push({ kind: "lamp", x: lx - 3, y: H - 92, host: [58, 50, 34] });
    }
    for (i = 0; i < 5; i++) {
      var bx = 6 + (R() * (W - 16) | 0);
      sc.bushes.push({ x: bx, y: H - 30 + (R() * 8 | 0), w: 12 + (R() * 8 | 0) });
      sc.spots.push({ kind: "bush", x: bx + 2, y: H - 34 + (R() * 6 | 0), host: [22, 44, 28] });
    }

    // 只保留完整落在画面内的藏身点 —— 否则鬼会藏到屏幕外,那一关永远过不了
    sc.spots = sc.spots.filter(function (p) {
      return p.x >= 2 && p.x + 9 <= W - 2 && p.y >= 2 && p.y + 10 <= H - 2;
    });

    // 从可藏点里挑不重叠的位置放鬼
    var n = demonCount(level), picked = [];
    var pool = sc.spots.slice();
    while (picked.length < n && pool.length) {
      var k = (R() * pool.length) | 0, s = pool.splice(k, 1)[0];
      var tooClose = false;
      for (i = 0; i < picked.length; i++)
        if (Math.abs(picked[i].x - s.x) < 16 && Math.abs(picked[i].y - s.y) < 16) tooClose = true;
      if (!tooClose) picked.push(s);
    }
    sc.demons = picked.map(function (s, idx) {
      return { x: s.x, y: s.y, kind: s.kind, host: s.host,
               found: false, freeing: 0, tellAt: 0.7 + idx * 0.9 };
    });
    return sc;
  }

  function newLevel(st, level) {
    st.level = level;
    st.scene = buildScene(level, st.diff);
    st.found = 0;
    st.misses = 0;
    st.time = timeLimit(level, st.diff);
    st.elapsed = 0;
    st.flash = null;          // 点错时的反馈
    st.freed = [];            // 获救的人
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

  var HIT_R = 7;              // 命中判定半径(虚拟像素),放宽一点更好点

  /* 玩家照光:命中鬼 → 赶出并救人;落空 → 记一次失手 */
  function shine(st, vx, vy) {
    if (st.mode !== "play") return null;
    var ds = st.scene.demons, i, best = -1, bd = 1e9;
    for (i = 0; i < ds.length; i++) {
      if (ds[i].found) continue;
      var dx = ds[i].x + 4 - vx, dy = ds[i].y + 5 - vy;
      var dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < bd) { bd = dist; best = i; }
    }
    if (best >= 0 && bd <= HIT_R) {
      var dm = ds[best];
      dm.found = true; dm.freeing = 0;
      st.found++;
      st.freed.push({ x: dm.x, y: dm.y, t: 0 });
      if (st.found >= ds.length) st.mode = "cleared";
      return { hit: true, at: { x: dm.x, y: dm.y } };
    }
    st.misses++;
    st.flash = { x: vx, y: vy, t: 0 };
    if (st.misses >= maxMisses(st.level, st.diff)) { st.mode = "failed"; st.failWhy = "The night got away from you."; }
    return { hit: false, at: { x: vx, y: vy } };
  }

  function tick(st, dtMs) {
    var dt = dtMs / 1000, i;
    if (st.mode === "play") {
      st.elapsed += dt;
      st.time -= dt;
      if (st.time <= 0) { st.time = 0; st.mode = "failed"; st.failWhy = "Dawn came too soon."; }
      var period = tellEvery(st.level, st.diff);
      for (i = 0; i < st.scene.demons.length; i++) {
        var d = st.scene.demons[i];
        if (!d.found && st.elapsed >= d.tellAt) d.tellAt = st.elapsed + period + Math.random() * period * 0.5;
      }
    }
    for (i = 0; i < st.scene.demons.length; i++)
      if (st.scene.demons[i].found) st.scene.demons[i].freeing += dt;
    for (i = 0; i < st.freed.length; i++) st.freed[i].t += dt;
    if (st.flash) { st.flash.t += dt; if (st.flash.t > 0.5) st.flash = null; }
  }

  /* 某只鬼此刻是否在"眨眼"(给玩家的破绽提示) */
  function isTelling(st, d) {
    if (d.found) return false;
    var since = d.tellAt - st.elapsed;
    return since < 0 && since > -0.34;
  }

  function advance(st) {
    if (st.mode === "menu" || st.mode === "failed") { newLevel(st, st.level); }
    else if (st.mode === "cleared") {
      var lv = Math.min(st.level + 1, MAX_LEVEL);
      if (lv > st.best) st.best = lv;
      newLevel(st, lv);
    } else if (st.mode === "intro") st.mode = "play";
  }

  return {
    W: W, H: H, MAX_LEVEL: MAX_LEVEL, HIT_R: HIT_R,
    DIFFS: DIFFS, DIFF_IDS: DIFF_IDS, setDifficulty: setDifficulty,
    demonCount: demonCount, timeLimit: timeLimit, camoStrength: camoStrength,
    maxMisses: maxMisses, create: create, newLevel: newLevel,
    shine: shine, tick: tick, advance: advance, isTelling: isTelling
  };
})();

if (typeof module !== "undefined") module.exports = Core;
