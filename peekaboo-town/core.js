/* 躲猫猫小镇 Peekaboo Town · 平台无关逻辑(无 DOM 无渲染)
   核心:小鬼「伪装成场景里的真实物件」—— 场上摆着一堆花盆/木箱/木桶/窗户,
   其中几个是小鬼假扮的。玩家要找的是「这个东西不对劲」,不是「这里有坨色块」。
   四种场景轮换,卡住时可以用提示道具。 */
"use strict";

var Core = (function () {
  var W = 240, H = 360;
  var MAX_LEVEL = 30;
  var OBJ_W = 15, OBJ_H = 17;          // 物件(也是小鬼)的统一尺寸

  var DIFFS = {
    gentle: { id: "gentle", name: "Gentle", blurb: "Slow, easy to spot",
              time: 1.7, camo: 0.5, tell: 0.55, misses: 8, hints: 4, decoy: 0.6 },
    normal: { id: "normal", name: "Normal", blurb: "A merry hunt",
              time: 1.0, camo: 1,   tell: 1,    misses: 5, hints: 2, decoy: 1 },
    brave:  { id: "brave",  name: "Brave",  blurb: "Sharp eyes only",
              time: 0.8, camo: 1.3, tell: 1.6,  misses: 3, hints: 1, decoy: 1.35 }
  };
  var DIFF_IDS = ["gentle", "normal", "brave"];
  function diff(d) { return DIFFS[d] || DIFFS.normal; }

  /* ---- 四种场景;每种有自己可用的伪装物件 ---- */
  var SCENES = [
    { id: "town",   name: "Sunny Street", objs: ["window", "pot", "bush"] },
    { id: "market", name: "Market Day",   objs: ["crate", "barrel", "basket", "lantern"] },
    { id: "garden", name: "The Garden",   objs: ["pot", "bush", "basket"] },
    { id: "river",  name: "Riverside",    objs: ["rock", "barrel", "crate", "bush"] }
  ];
  function sceneFor(level) { return SCENES[(level - 1) % SCENES.length]; }

  function impCount(level) { return Math.min(6, 1 + Math.floor((level - 1) / 4)); }
  // 场上的「无辜物件」数量 —— 越多越难找,这是本作真正的难度来源
  function decoyCount(level, d) {
    return Math.round(Math.min(26, 6 + level * 0.9) * diff(d).decoy);
  }
  function timeLimit(level, d) {
    return Math.round((45 + impCount(level) * 13) * diff(d).time);
  }
  function camoStrength(level, d) {    // 0=破绽明显, 1=几乎和真物件一样
    return Math.min(0.95, (0.34 + (level - 1) * 0.021) * diff(d).camo);
  }
  function peekEvery(level, d) { return (2.0 + (level - 1) * 0.1) * diff(d).tell; }
  function maxMisses(level, d) { return diff(d).misses; }
  function hintCount(level, d) { return diff(d).hints; }

  function rng(seed) {
    var s = seed >>> 0 || 1;
    return function () {
      s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0;
      return s / 4294967296;
    };
  }

  /* ---- 场景生成 ---- */
  function buildScene(level, d) {
    var R = rng(level * 7919 + 13);
    var scene = sceneFor(level);
    var sc = { id: scene.id, name: scene.name, clouds: [], props: [], objects: [], imps: [] };
    var i;

    sc.sun = { x: 34 + (R() * 20 | 0), y: 32 };
    for (i = 0; i < 5; i++)
      sc.clouds.push({ x: (R() * W) | 0, y: 18 + (R() * 60 | 0), w: 26 + (R() * 24 | 0), sp: 0.25 + R() * 0.5 });

    // 每种场景的背景陈设(纯装饰,不能藏小鬼)
    if (scene.id === "town") {
      var x = -4;
      while (x < W) {
        var hw = 44 + (R() * 24 | 0), hh = 66 + (R() * 44 | 0), ci = (R() * 7) | 0;
        sc.props.push({ kind: "house", x: x, y: H - 116 - hh, w: hw, h: hh, ci: ci, door: R() < 0.6 });
        x += hw + 3;
      }
    } else if (scene.id === "market") {
      for (i = 0; i < 4; i++)
        sc.props.push({ kind: "stall", x: 6 + i * 60 + (R() * 10 | 0), y: 148 + (R() * 22 | 0),
                        w: 52, ci: (R() * 7) | 0 });
    } else if (scene.id === "garden") {
      for (i = 0; i < 3; i++)
        sc.props.push({ kind: "hedge", x: -6 + (R() * 20 | 0), y: 150 + i * 44, w: W + 12, h: 20 });
      for (i = 0; i < 4; i++)
        sc.props.push({ kind: "tree", x: 14 + i * 60 + (R() * 16 | 0), y: 120 + (R() * 20 | 0),
                        r: 20 + (R() * 6 | 0) });
    } else {
      sc.props.push({ kind: "water", y: H - 132 });
      for (i = 0; i < 5; i++)
        sc.props.push({ kind: "reed", x: 10 + i * 48 + (R() * 20 | 0), y: H - 138 + (R() * 16 | 0) });
      sc.props.push({ kind: "dock", x: 40 + (R() * 60 | 0), y: H - 96, w: 78 });
    }

    // ---- 摆放物件:先算出所有互不重叠的落点 ----
    var slots = [], tries = 0;
    var yTop = scene.id === "town" ? 132 : 118;
    var yBot = H - OBJ_H - 8;
    var want = decoyCount(level, d) + impCount(level);
    while (slots.length < want && tries++ < 900) {
      var p = { x: 4 + (R() * (W - OBJ_W - 8) | 0), y: yTop + (R() * (yBot - yTop) | 0) };
      // 右下角是提示按钮,物件不能压在它下面 —— 否则点它只会触发提示,永远打不中
      if (p.x + OBJ_W > W - 42 && p.y + OBJ_H > H - 42) continue;
      var ok = true;
      for (i = 0; i < slots.length; i++)
        if (Math.abs(slots[i].x - p.x) < OBJ_W + 4 && Math.abs(slots[i].y - p.y) < OBJ_H + 4) { ok = false; break; }
      if (ok) slots.push(p);
    }

    // 洗牌后前 n 个是小鬼,其余是无辜物件
    for (i = slots.length - 1; i > 0; i--) { var j = (R() * (i + 1)) | 0, t = slots[i]; slots[i] = slots[j]; slots[j] = t; }
    var n = Math.min(impCount(level), slots.length);
    for (i = 0; i < slots.length; i++) {
      var type = scene.objs[(R() * scene.objs.length) | 0];
      var tint = R();                       // 同类物件之间的细微色差,避免看起来是复制粘贴
      if (i < n) {
        sc.imps.push({ x: slots[i].x, y: slots[i].y, type: type, tint: tint,
                       found: false, freeing: 0, spin: R() < 0.5 ? -1 : 1,
                       peekAt: 0.8 + i * 0.9, peeked: false });
      } else {
        sc.objects.push({ x: slots[i].x, y: slots[i].y, type: type, tint: tint });
      }
    }
    return sc;
  }

  function newLevel(st, level) {
    st.level = level;
    st.scene = buildScene(level, st.diff);
    st.found = 0; st.misses = 0;
    st.hints = hintCount(level, st.diff);
    st.hintRing = null;
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

  function hitBox(o, vx, vy) {
    return vx >= o.x - 2 && vx <= o.x + OBJ_W + 2 && vy >= o.y - 2 && vy <= o.y + OBJ_H + 2;
  }

  function shine(st, vx, vy) {
    if (st.mode !== "play") return null;
    var im = st.scene.imps, i;
    for (i = 0; i < im.length; i++) {
      if (im[i].found) continue;
      if (hitBox(im[i], vx, vy)) {
        im[i].found = true; im[i].freeing = 0;
        st.found++;
        if (st.found >= im.length) st.mode = "cleared";
        return { hit: true, at: { x: im[i].x, y: im[i].y }, cleared: st.mode === "cleared" };
      }
    }
    st.misses++;
    st.flash = { x: vx, y: vy, t: 0 };
    if (st.misses >= maxMisses(st.level, st.diff)) {
      st.mode = "failed"; st.failWhy = "Too many wild guesses!";
    }
    return { hit: false, at: { x: vx, y: vy }, failed: st.mode === "failed" };
  }

  /* 提示道具:圈出一只还没找到的小鬼所在的大致区域 */
  function useHint(st) {
    if (st.mode !== "play" || st.hints <= 0) return null;
    var pool = [], i;
    for (i = 0; i < st.scene.imps.length; i++) if (!st.scene.imps[i].found) pool.push(st.scene.imps[i]);
    if (!pool.length) return null;
    var pick = pool[(Math.random() * pool.length) | 0];
    st.hints--;
    st.hintRing = { x: pick.x + OBJ_W / 2, y: pick.y + OBJ_H / 2, t: 0 };
    return { at: st.hintRing };
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
        if (st.elapsed >= d.peekAt + 0.55) {
          d.peekAt = st.elapsed + period + Math.random() * period * 0.6;
          d.peeked = false;
        }
      }
    }
    for (i = 0; i < st.scene.imps.length; i++)
      if (st.scene.imps[i].found) st.scene.imps[i].freeing += dt;
    if (st.flash) { st.flash.t += dt; if (st.flash.t > 0.6) st.flash = null; }
    if (st.hintRing) { st.hintRing.t += dt; if (st.hintRing.t > 2.2) st.hintRing = null; }
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
    return since >= 0 && since < 0.55;
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
    W: W, H: H, MAX_LEVEL: MAX_LEVEL, OBJ_W: OBJ_W, OBJ_H: OBJ_H,
    SCENES: SCENES, sceneFor: sceneFor,
    DIFFS: DIFFS, DIFF_IDS: DIFF_IDS, setDifficulty: setDifficulty,
    impCount: impCount, decoyCount: decoyCount, timeLimit: timeLimit,
    camoStrength: camoStrength, maxMisses: maxMisses, hintCount: hintCount,
    create: create, newLevel: newLevel, shine: shine, useHint: useHint,
    tick: tick, advance: advance, isPeeking: isPeeking
  };
})();

if (typeof module !== "undefined") module.exports = Core;
