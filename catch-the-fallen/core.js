/* Catch the Fallen · Platform-agnostic game logic (no DOM, no canvas)
   天使在下面举着救生毯,接住从教堂钟楼坠落的人。接住的人排队站到旁边挥手,
   漏掉一个,教堂窗户暗一格。 */
"use strict";

var Core = (function () {
  var W = 240, H = 360, HUD = 26;
  var PLAY_H = H - HUD;
  var MAX_LEVEL = 30;
  var PAD_Y = H - 44;          // 救生毯中心高度
  var QUEUE_Y = H - 12;        // 接住的人排队站的高度

  /* 三档难度:必须产出不同数值。padW=毯宽,fallBase=下落基准速度,
     gapBase=掉落间隔帧数,misses=允许漏掉数(即窗户数),quotaMul=接人数量倍率 */
  var DIFFS = {
    gentle: { id:"gentle", name:"Gentle", blurb:"A wide, slow blanket",
              padW:66, fallBase:1.05, gapBase:84, misses:5, quotaMul:0.8 },
    normal: { id:"normal", name:"Normal", blurb:"A steady rescue",
              padW:46, fallBase:1.5,  gapBase:58, misses:3, quotaMul:1.0 },
    brave:  { id:"brave",  name:"Brave",  blurb:"Fast and narrow",
              padW:34, fallBase:1.95, gapBase:42, misses:2, quotaMul:1.2 }
  };
  var DIFF_IDS = ["gentle", "normal", "brave"];
  function diff(d) { return DIFFS[d] || DIFFS.normal; }

  function padW(d) { return diff(d).padW; }
  function maxMisses(d) { return diff(d).misses; }
  function quota(level, d) {
    return Math.max(3, Math.round((4 + Math.floor((level - 1) / 2)) * diff(d).quotaMul));
  }
  function fallSpeed(level, d) {
    return diff(d).fallBase + Math.min(0.8, (level - 1) * 0.03);
  }
  function gapFrames(level, d) {
    return Math.max(26, Math.round(diff(d).gapBase - (level - 1) * 0.7));
  }

  function clamp(x, lo, hi) { return Math.max(lo, Math.min(hi, x)); }

  function newLevel(st, level) {
    st.level = level;
    st.pad = { x: W / 2, dir: null, speed: 3.2 };
    st.fallers = [];
    st.caught = [];
    st.caughtCount = 0;
    st.misses = 0;
    st.gapT = 0;
    st.fx = null;
    st.fxList = [];
    st.mode = "intro";
    st.msg = "";
  }

  function create(savedLevel, difficulty) {
    var st = { mode:"menu", best: savedLevel || 1, diff: DIFFS[difficulty] ? difficulty : "normal",
               score:0, level:1, pad:null, fallers:[], caught:[], caughtCount:0, misses:0,
               gapT:0, fx:null, fxList:[], msg:"" };
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

  /* === input === */
  function setPadDir(st, dir) {
    if (st.mode !== "play") return;
    st.pad.dir = dir;   // "left" / "right" / null
  }

  /* === spawn / update === */
  function spawnFaller(st) {
    var d = diff(st.diff);
    var x = 12 + Math.random() * (W - 24);
    st.fallers.push({
      x: x, y: HUD - 12, vy: fallSpeed(st.level, st.diff),
      spin: Math.random() < 0.5 ? -1 : 1,
      sway: Math.random() * Math.PI * 2,
      swayAmt: st.level >= 10 ? 0.7 : 0.3   // 后期的人左右漂移,更难接
    });
  }

  function update(st, dtMs) {
    var events = [];
    if (st.mode !== "play") return events;
    var i;

    /* move pad */
    if (st.pad.dir === "left") st.pad.x -= st.pad.speed;
    else if (st.pad.dir === "right") st.pad.x += st.pad.speed;
    var hw = padW(st.diff) / 2;
    st.pad.x = clamp(st.pad.x, hw, W - hw);

    /* spawn fallers on a timer */
    st.gapT++;
    if (st.gapT >= gapFrames(st.level, st.diff)) {
      st.gapT = 0;
      spawnFaller(st);
    }

    /* move fallers */
    for (i = st.fallers.length - 1; i >= 0; i--) {
      var f = st.fallers[i];
      f.sway += 0.05;
      f.x += Math.sin(f.sway) * f.swayAmt;
      f.y += f.vy;
      if (f.y >= PAD_Y) {
        var caught = Math.abs(f.x - st.pad.x) <= hw + 8;
        if (caught) {
          st.caughtCount++;
          st.score += 100;
          st.caught.push({ x: f.x, y: PAD_Y - 8, t: 0 });
          st.fxList.push({ type:"catch", x: f.x, y: PAD_Y, t: 0 });
          events.push({ type:"catch" });
          if (st.caughtCount >= quota(st.level, st.diff)) {
            st.mode = "win"; st.msg = "All " + st.caughtCount + " safe!";
            events.push({ type:"levelClear" });
          }
        } else {
          st.misses++;
          st.fxList.push({ type:"miss", x: f.x, y: PAD_Y, t: 0 });
          events.push({ type:"miss" });
          if (st.misses >= maxMisses(st.diff)) {
            st.mode = "lose"; st.msg = "The windows went dark...";
            events.push({ type:"gameOver" });
          }
        }
        st.fallers.splice(i, 1);
      }
    }

    /* caught people hop into a neat queue along the bottom */
    for (i = 0; i < st.caught.length; i++) {
      var c = st.caught[i];
      c.t++;
      c.tx = 20 + i * 14;
      c.ty = QUEUE_Y;
      c.x += (c.tx - c.x) * 0.18;
      c.y += (c.ty - c.y) * 0.18;
    }

    /* fx lifetime */
    for (i = st.fxList.length - 1; i >= 0; i--) {
      st.fxList[i].t++;
      if (st.fxList[i].t > 40) st.fxList.splice(i, 1);
    }

    return events;
  }

  function advance(st) {
    if (st.mode === "menu" || st.mode === "lose") { newLevel(st, st.level); }
    else if (st.mode === "win") {
      var lv = Math.min(st.level + 1, MAX_LEVEL);
      if (lv > st.best) st.best = lv;
      newLevel(st, lv);
    } else if (st.mode === "intro") st.mode = "play";
  }

  return {
    W:W, H:H, HUD:HUD, PLAY_H:PLAY_H, MAX_LEVEL:MAX_LEVEL, PAD_Y:PAD_Y, QUEUE_Y:QUEUE_Y,
    DIFFS:DIFFS, DIFF_IDS:DIFF_IDS,
    padW:padW, maxMisses:maxMisses, quota:quota, fallSpeed:fallSpeed, gapFrames:gapFrames,
    create:create, setDifficulty:setDifficulty, newLevel:newLevel,
    setPadDir:setPadDir, update:update, advance:advance
  };
})();

if (typeof module !== "undefined") module.exports = Core;
