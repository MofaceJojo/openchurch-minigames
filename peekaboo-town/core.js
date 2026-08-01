/* 躲猫猫小镇 Peekaboo Town · 平台无关逻辑(无 DOM 无渲染)
   核心:小鬼「伪装成场景里的真实物件」—— 场上摆着一堆花盆/木箱/木桶/窗户,
   其中几个是小鬼假扮的。玩家要找的是「这个东西不对劲」,不是「这里有坨色块」。
   四种场景轮换,卡住时可以用提示道具。 */
"use strict";

var Core = (function () {
  var W = 240, H = 360;              // W = 可视宽度
  var SCENE_W = 240;                 // 场景宽度 = 可视宽度,不做横向滚动
  var MAX_LEVEL = 30;
  var OBJ_W = 21, OBJ_H = 23;          // 物件(也是小鬼)的统一尺寸,放大以容纳细节

  var DIFFS = {
    gentle: { id: "gentle", name: "Gentle", blurb: "Slow, easy to spot",
              time: 1.7, camo: 0.5, tell: 0.55, misses: 8, hints: 4, decoy: 0.6 },
    normal: { id: "normal", name: "Normal", blurb: "A merry hunt",
              time: 1.0, camo: 1,   tell: 1,    misses: 5, hints: 2, decoy: 1 },
    brave:  { id: "brave",  name: "Brave",  blurb: "Sharp eyes only",
              time: 0.8, camo: 1.3, tell: 1.6,  misses: 3, hints: 1, decoy: 1.35 }
  };
  // 探头时随机摆一个搞笑姿势 —— 既是破绽,也是这游戏最好笑的地方
  var POSES = ["wave", "dance", "stretch", "spin", "hips", "faint"];
  var DIFF_IDS = ["gentle", "normal", "brave"];
  function diff(d) { return DIFFS[d] || DIFFS.normal; }

  /* ---- 四种场景;每种有自己可用的伪装物件 ---- */
  var SCENES = [
    { id: "kitchen", name: "Kitchen Counter", objs: ["mug", "jar", "canister", "teapot", "bowl"] },
    { id: "living",  name: "Living Room",     objs: ["book", "frame", "plant", "candle", "bowl"] },
    { id: "shed",    name: "Potting Shed",    objs: ["pot", "canister", "jar", "basket", "wateringcan"] },
    { id: "study",   name: "Study Desk",      objs: ["book", "mug", "frame", "plant", "clock"] }
  ];
  function sceneFor(level) { return SCENES[(level - 1) % SCENES.length]; }

  function impCount(level) { return Math.min(7, 1 + Math.floor((level - 1) / 3.2)); }
  // 场上的「无辜物件」数量 —— 越多越难找,这是本作真正的难度来源
  function decoyCount(level, d) {
    return Math.round(Math.min(30, 8 + level * 1.1) * diff(d).decoy);
  }
  function timeLimit(level, d) {
    return Math.round((38 + impCount(level) * 11) * diff(d).time);
  }
  function camoStrength(level, d) {    // 0=破绽明显, 1=几乎和真物件一样
    return Math.min(0.96, (0.46 + (level - 1) * 0.019) * diff(d).camo);
  }
  function peekEvery(level, d) { return (2.4 + (level - 1) * 0.13) * diff(d).tell; }
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

    // 每种场景的背景陈设(纯装饰,不藏小鬼)。都是明亮的日常室内。
    if (scene.id === "kitchen") {
      sc.window = { x: 150, y: 34, w: 74, h: 62 };              // 洒进阳光的窗
      sc.window2 = { x: 400, y: 34, w: 74, h: 62 };
      sc.shelves = [{ y: 132, x: 8, w: 140 }, { y: 214, x: 8, w: SCENE_W - 16 }];
      sc.counter = { y: 292 };
      sc.tiles = true;
      sc.surfaces = [{ y: 132, x0: 10, x1: 142 }, { y: 214, x0: 10, x1: SCENE_W - 12 },
                     { y: 292, x0: 6, x1: SCENE_W - 8 }, { y: 336, x0: 6, x1: SCENE_W - 8 }];
    } else if (scene.id === "living") {
      sc.window = { x: 18, y: 30, w: 78, h: 66 };
      sc.sofa = { x: 12, y: 246, w: SCENE_W - 24, h: 62 };
      sc.shelves = [{ y: 140, x: 116, w: SCENE_W - 128 }];
      sc.rug = { y: 322 };
      sc.lamp = { x: 24, y: 178 };
      sc.window2 = { x: 330, y: 30, w: 78, h: 66 };
      sc.cushions = [];                                          // 靠垫沿整张沙发铺开
      for (i = 0; i < 10; i++) sc.cushions.push({ x: 18 + i * 54, w: 44 });
      sc.pictures = [];                                          // 墙上挂几幅画
      for (i = 0; i < 3; i++) sc.pictures.push({ x: 150 + i * 130, y: 60 + (R() * 24 | 0) });
      sc.surfaces = [{ y: 140, x0: 118, x1: SCENE_W - 12 }, { y: 250, x0: 16, x1: SCENE_W - 18 },
                     { y: 322, x0: 6, x1: SCENE_W - 8 }, { y: 352, x0: 6, x1: SCENE_W - 8 }];
    } else if (scene.id === "shed") {
      sc.window = { x: 96, y: 28, w: 62, h: 52 };
      sc.pegboard = { x: 8, y: 104, w: 92, h: 74 };
      sc.pegboards = [{ x: 8, y: 104, w: 92, h: 74 },
                      { x: 190, y: 104, w: 92, h: 74 },
                      { x: 372, y: 104, w: 92, h: 74 }];
      sc.window2 = { x: 300, y: 28, w: 62, h: 52 };
      sc.shelves = [{ y: 198, x: 6, w: SCENE_W - 12 }];
      sc.bench = { y: 282 };
      sc.surfaces = [{ y: 104, x0: 10, x1: 90 }, { y: 198, x0: 8, x1: SCENE_W - 10 },
                     { y: 282, x0: 6, x1: SCENE_W - 8 }, { y: 334, x0: 6, x1: SCENE_W - 8 }];
    } else {                                                     // study
      sc.window = { x: 20, y: 26, w: 68, h: 58 };
      sc.pinboard = { x: 106, y: 96, w: 126, h: 82 };
      sc.pinboards = [{ x: 106, y: 96, w: 126, h: 82 }, { x: 320, y: 92, w: 126, h: 82 }];
      sc.window2 = { x: 470, y: 26, w: 68, h: 58 };
      sc.shelves = [{ y: 196, x: 6, w: SCENE_W - 12 }];
      sc.desk = { y: 274 };
      sc.surfaces = [{ y: 96, x0: 12, x1: 96 }, { y: 196, x0: 8, x1: SCENE_W - 10 },
                     { y: 274, x0: 6, x1: SCENE_W - 8 }, { y: 330, x0: 6, x1: SCENE_W - 8 }];
    }
    for (i = 0; i < 4; i++)                                      // 窗外飘过的云
      sc.clouds.push({ x: (R() * W) | 0, y: 10 + (R() * 40 | 0), w: 16 + (R() * 14 | 0), sp: 0.2 + R() * 0.4 });

    // ---- 摆放物件:先算出所有互不重叠的落点 ----
    // ---- 沿「平面」摆放:物件底边贴着搁板/台面,不再悬空 ----
    var slots = [], tries = 0;
    var want = decoyCount(level, d) + impCount(level);
    while (slots.length < want && tries++ < 1200) {
      var surf = sc.surfaces[(R() * sc.surfaces.length) | 0];
      var px2 = surf.x0 + (R() * Math.max(1, surf.x1 - surf.x0 - OBJ_W) | 0);
      var p = { x: px2, y: surf.y - OBJ_H };
      // 提示按钮固定在屏幕右下角。场景可横向滚动,只需保证物件不落在
      // 最底那条平面的最右端(那里无论怎么滚都可能被按钮压住)
      if (p.y + OBJ_H > H - 42 && p.x + OBJ_W > SCENE_W - 46) continue;
      var ok = true;
      for (i = 0; i < slots.length; i++)
        if (Math.abs(slots[i].y - p.y) < 4 && Math.abs(slots[i].x - p.x) < OBJ_W + 3) { ok = false; break; }
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
    st.camX = 0; st.camTarget = null;
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

  var MAX_CAM = SCENE_W - W;
  function clampCam(x) { return Math.max(0, Math.min(MAX_CAM, x)); }
  function panBy(st, dx) { st.camX = clampCam(st.camX + dx); st.camTarget = null; }
  function panTo(st, worldX) { st.camTarget = clampCam(worldX - W / 2); }
  function tickCam(st, dt) {
    if (st.camTarget === null || st.camTarget === undefined) return;
    var d = st.camTarget - st.camX;
    if (Math.abs(d) < 0.6) { st.camX = st.camTarget; st.camTarget = null; return; }
    st.camX = clampCam(st.camX + d * Math.min(1, dt * 6));
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
    panTo(st, st.hintRing.x);                 // 镜头自动摇到那一片
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
        if (st.elapsed >= d.peekAt && !d.peeked) {
          d.peeked = true; events.peeked = true;
          d.pose = POSES[(Math.random() * POSES.length) | 0];   // 每次探头换个姿势
        }
        if (st.elapsed >= d.peekAt + 0.42) {
          d.peekAt = st.elapsed + period + Math.random() * period * 0.6;
          d.peeked = false;
        }
      }
    }
    for (i = 0; i < st.scene.imps.length; i++)
      if (st.scene.imps[i].found) st.scene.imps[i].freeing += dt;
    if (st.flash) { st.flash.t += dt; if (st.flash.t > 0.6) st.flash = null; }
    if (st.hintRing) { st.hintRing.t += dt; if (st.hintRing.t > 2.2) st.hintRing = null; }
    tickCam(st, dt);
    for (i = 0; i < st.scene.clouds.length; i++) {
      var c = st.scene.clouds[i];
      c.x += c.sp * dt * 4;
      if (c.x > W + 30) c.x = -36;
    }
    return events;
  }

  var PEEK_DUR = 0.42;
  function isPeeking(st, d) {
    if (d.found) return false;
    var since = st.elapsed - d.peekAt;
    if (since >= 0 && since < PEEK_DUR) { d.poseT = since / PEEK_DUR; return true; }
    return false;
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
    W: W, H: H, SCENE_W: SCENE_W, MAX_CAM: MAX_CAM, MAX_LEVEL: MAX_LEVEL,
    OBJ_W: OBJ_W, OBJ_H: OBJ_H, POSES: POSES,
    panBy: panBy, panTo: panTo, tickCam: tickCam,
    SCENES: SCENES, sceneFor: sceneFor,
    DIFFS: DIFFS, DIFF_IDS: DIFF_IDS, setDifficulty: setDifficulty,
    impCount: impCount, decoyCount: decoyCount, timeLimit: timeLimit,
    camoStrength: camoStrength, maxMisses: maxMisses, hintCount: hintCount,
    create: create, newLevel: newLevel, shine: shine, useHint: useHint,
    tick: tick, advance: advance, isPeeking: isPeeking
  };
})();

if (typeof module !== "undefined") module.exports = Core;
