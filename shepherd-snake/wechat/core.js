/* 牧者行列 · 平台无关游戏逻辑(网页 / 微信小游戏共用,无 DOM 无渲染) */
"use strict";

var Core = (function () {
  var COLS = 12, ROWS = 16, MAX_LEVEL = 50;

  /* 难度档:主要受众是孩子和女性玩家,Gentle 要真的轻松。
     speed 越大走得越慢,demons/quota 是数量倍率,rival 越大大恶魔越迟钝 */
  var DIFFS = {
    gentle: { id: "gentle", name: "Gentle", blurb: "Slow and forgiving",
              speed: 1.28, demons: 0.4, quota: 0.7, rival: 1.6 },
    normal: { id: "normal", name: "Normal", blurb: "A steady stroll",
              speed: 1.0,  demons: 1,   quota: 1,   rival: 1 },
    brave:  { id: "brave",  name: "Brave",  blurb: "Quick and crowded",
              speed: 0.78, demons: 1.3, quota: 1,   rival: 0.8 }
  };
  var DIFF_IDS = ["gentle", "normal", "brave"];
  function diff(d) { return DIFFS[d] || DIFFS.normal; }

  // 设计准则:1-40 关零压力,41-50 关才略微上强度;娱乐性 >> 难度
  function baseQuota(level) {
    return level <= 40 ? 10 + Math.floor(level / 4)          // lv1-40: 10→20,缓到几乎无感
                       : 20 + (level - 40) * 3;              // lv41-50: 23→50,冲刺段
  }
  function quota(level, d) {
    return Math.max(6, Math.round(baseQuota(level) * diff(d).quota));
  }
  function demonCount(level, d) {
    // 小恶魔永远站桩不动(是地形不是威胁),所以数量可以随关卡稳步增加:
    // 第 2 关登场,之后每 5 关 +1,50 关时 10 只(占场地 5%,仍宽敞)
    if (level < 2) return 0;
    return Math.round(Math.min(10, 1 + Math.floor((level - 2) / 5)) * diff(d).demons);
  }
  function hasRival(level) { return level >= 30; }           // 30 关起:大恶魔蛇和你比赛抢信徒
  function rivalEvery(level, d) {                             // 每 N 拍走一步,越后期越敏捷
    var base = level >= 46 ? 2 : level >= 38 ? 3 : 4;
    return Math.max(2, Math.round(base * diff(d).rival));
  }
  var RIVAL_MAX_LEN = 14;
  function hasSkills(level) { return level >= 5; }
  // 后期地图更挤、配额更高,道具数量跟着涨:lv5-16:1, 17-28:2, 29-40:3, 41+:4
  function pickupCount(level) {
    return level < 5 ? 0 : Math.min(4, 1 + Math.floor((level - 5) / 12));
  }           // 技能是玩具,早点给
  function tickMs(level, d) {
    // 每 5 关提一档速度(玩家能明显感到"变快了"的爽感),40 关到顶。
    // 基准比初版慢约 20%:太快跟不上,太慢又断了连贯感,这一档是折中值。
    return Math.round((235 - Math.min(8, Math.floor(level / 5)) * 8) * diff(d).speed);
  }

  var SKILLS = {
    summon: { name: "Gather", desc: "Nearby believers join your line at once", color: "#2f9e63", dark: "#1d6b42" },
    smite:  { name: "Smite",  desc: "Destroy the nearest little demon",        color: "#f4772b", dark: "#b34a0d" },
    shield: { name: "Shield", desc: "Demons can't hurt you for a while",       color: "#3d8ee0", dark: "#1f5c9e" },
    ghost:  { name: "Spirit", desc: "Pass through your line and demons",       color: "#9b6fd6", dark: "#6a3fa8" },
    still:  { name: "Be Still", desc: "Time slows to a gentle crawl",          color: "#3f9aa8", dark: "#226b78" }
  };
  var SKILL_IDS = ["summon", "smite", "shield", "ghost", "still"];
  var EFFECT_TICKS = 30;   // 护佑/灵体持续拍数
  var STILL_TICKS = 16;    // 静止持续拍数(每拍本身被拉长,实际体感更久)
  var STILL_FACTOR = 2.1;  // 静止时每拍时长倍数

  /* 壳层每帧用它决定何时走下一拍 —— 把"时间减慢"算进去 */
  function currentTickMs(st) {
    var ms = tickMs(st.level, st.diff);
    return effectActive(st, "still") ? Math.round(ms * STILL_FACTOR) : ms;
  }

  function occupied(st, x, y) {
    var i;
    for (i = 0; i < st.snake.length; i++) if (st.snake[i].x === x && st.snake[i].y === y) return true;
    for (i = 0; i < st.demons.length; i++) if (st.demons[i].x === x && st.demons[i].y === y) return true;
    for (i = 0; i < st.believers.length; i++) if (st.believers[i].x === x && st.believers[i].y === y) return true;
    for (i = 0; i < st.pickups.length; i++) if (st.pickups[i].x === x && st.pickups[i].y === y) return true;
    return false;
  }

  function freeCell(st, awayFromHead) {
    var p, head = st.snake[0], tries = 0;
    do {
      p = { x: (Math.random() * COLS) | 0, y: (Math.random() * ROWS) | 0 };
      tries++;
    } while (tries < 500 && (occupied(st, p.x, p.y) ||
             (awayFromHead && Math.abs(p.x - head.x) + Math.abs(p.y - head.y) < awayFromHead)));
    return p;
  }

  function fillBelievers(st) {
    var want = Math.min(4, quota(st.level, st.diff) - st.rescued - st.believers.length);
    while (want-- > 0) st.believers.push(freeCell(st, 2));
  }

  function newLevel(st, level) {
    st.level = level;
    st.rescued = 0;
    st.snake = [{ x: 5, y: 8 }, { x: 5, y: 9 }, { x: 5, y: 10 }];
    st.dir = { x: 0, y: -1 }; st.nextDir = st.dir;
    st.demons = []; st.believers = []; st.pickups = [];
    st.skill = null; st.effect = null; st.tickCount = 0; st.rescueFx = null; st.fx = null; st.prev = null;
    st.rival = hasRival(level)
      ? { body: [{ x: COLS - 2, y: 1 }, { x: COLS - 1, y: 1 }, { x: COLS - 1, y: 0 }] }
      : null;
    var i, n = demonCount(level, st.diff);
    for (i = 0; i < n; i++) st.demons.push(freeCell(st, 5));
    // 每个拾取物开局就定好技能类型,据此显示图标 —— 玩家能提前判断值不值得绕路
    n = pickupCount(level);
    for (i = 0; i < n; i++) {
      var p = freeCell(st, 4);
      p.skill = SKILL_IDS[(Math.random() * SKILL_IDS.length) | 0];
      st.pickups.push(p);
    }
    fillBelievers(st);
    st.mode = "intro";
  }

  function create(savedLevel, seenSkills, difficulty) {
    // seenSkills 跨关卡保留:每种技能只在第一次拿到时暂停讲解一次
    var st = { mode: "menu", best: savedLevel || 1, deathMsg: "",
               seenSkills: seenSkills || {}, diff: DIFFS[difficulty] ? difficulty : "normal" };
    newLevel(st, st.best);
    st.mode = "menu";
    return st;
  }

  function setDifficulty(st, d) {
    if (!DIFFS[d] || st.diff === d) return false;
    st.diff = d;
    newLevel(st, st.level);        // 重排本关,立刻按新难度生效
    st.mode = "menu";
    return true;
  }

  /* 返回 true 表示这是一次"新的转向" —— 壳层据此立刻走一拍,
     让慢速下按键也是跟手的(不必干等一整拍) */
  function setDir(st, x, y) {
    if (x === -st.dir.x && y === -st.dir.y) return false;
    var changed = (x !== st.nextDir.x || y !== st.nextDir.y) &&
                  (x !== st.dir.x || y !== st.dir.y);
    st.nextDir = { x: x, y: y };
    return changed;
  }

  function effectActive(st, type) {
    return st.effect && st.effect.type === type && st.effect.ticksLeft > 0;
  }

  var SUMMON_R = 3;              // 呼召半径(切比雪夫距离,即 7×7 方形)

  /* 按下即释放 —— 这是快节奏游戏,不做蓄力两步操作 */
  function useSkill(st) {
    if (st.mode !== "play" || !st.skill) return null;
    var id = st.skill, head = st.snake[0], i;
    var radius = SUMMON_R;
    st.skill = null;
    if (id === "summon") {
      var joined = [];
      for (i = st.believers.length - 1; i >= 0; i--) {
        var b = st.believers[i];
        if (Math.max(Math.abs(b.x - head.x), Math.abs(b.y - head.y)) <= radius) {
          st.believers.splice(i, 1);
          st.snake.push({ x: st.snake[st.snake.length - 1].x, y: st.snake[st.snake.length - 1].y });
          st.rescued++; joined.push(b);
        }
      }
      st.fx = { type: "summon", at: { x: head.x, y: head.y }, r: radius, joined: joined, ms: 0 };
      fillBelievers(st);
      if (st.rescued >= quota(st.level, st.diff)) win(st);
      return { id: id, joined: joined };
    }
    if (id === "smite") {
      var best = -1, dist = 1e9;
      for (i = 0; i < st.demons.length; i++) {
        var d = Math.abs(st.demons[i].x - head.x) + Math.abs(st.demons[i].y - head.y);
        if (d < dist) { dist = d; best = i; }
      }
      if (best >= 0) {
        var gone = st.demons.splice(best, 1)[0];
        st.fx = { type: "smite", at: { x: gone.x, y: gone.y }, from: { x: head.x, y: head.y }, ms: 0 };
        return { id: id, demon: gone };
      }
      return { id: id };
    }
    // shield / ghost / still
    st.effect = { type: id, ticksLeft: id === "still" ? STILL_TICKS : EFFECT_TICKS };
    st.fx = { type: id, at: { x: head.x, y: head.y }, ms: 0 };
    return { id: id };
  }

  var FX_MS = 620;
  function tickFx(st, dtMs) {
    if (st.fx && (st.fx.ms += dtMs) >= FX_MS) st.fx = null;
  }

  function cellInList(list, x, y) {
    for (var i = 0; i < list.length; i++) if (list[i].x === x && list[i].y === y) return i;
    return -1;
  }

  /* 大恶魔蛇:朝最近的信徒贪心走一步,抢到就挂在尾巴上 */
  function rivalTick(st) {
    if (!st.rival || st.tickCount % rivalEvery(st.level, st.diff) !== 0) return;
    var head = st.rival.body[0], target = null, best = 1e9, i;
    for (i = 0; i < st.believers.length; i++) {
      var b = st.believers[i], d = Math.abs(b.x - head.x) + Math.abs(b.y - head.y);
      if (d < best) { best = d; target = b; }
    }
    if (!target) return;
    var opts = [];
    if (target.x !== head.x) opts.push({ x: head.x + (target.x > head.x ? 1 : -1), y: head.y });
    if (target.y !== head.y) opts.push({ x: head.x, y: head.y + (target.y > head.y ? 1 : -1) });
    if (opts.length === 2 && Math.abs(target.y - head.y) > Math.abs(target.x - head.x)) opts.reverse();
    var nh = null;
    for (i = 0; i < opts.length; i++) {
      var o = opts[i];
      if (cellInList(st.rival.body, o.x, o.y) < 0 &&
          cellInList(st.snake, o.x, o.y) < 0 &&
          cellInList(st.demons, o.x, o.y) < 0) { nh = o; break; }
    }
    if (!nh) return; // 被堵住就原地等一拍
    st.rival.body.unshift(nh);
    var bi = cellInList(st.believers, nh.x, nh.y);
    if (bi >= 0) { st.believers.splice(bi, 1); fillBelievers(st); } // 抢走一个,挂上尾巴
    if (bi < 0 || st.rival.body.length > RIVAL_MAX_LEN) st.rival.body.pop();
  }

  /* 死亡:先进 dying 播 1.5 秒演出,再转 dead 出结算。
     kind = wall(撞墙压扁) / demon(炸开) / devour(被吞) / self(自己缠住) */
  var DYING_MS = 1500;
  function die(st, msg, kind, at) {
    st.mode = "dying";
    st.deathMsg = msg;
    st.death = { kind: kind, at: at || { x: st.snake[0].x, y: st.snake[0].y }, since: 0, hitDir: st.dir };
  }
  /* 过关:先进 cheering 播庆祝演出,再转 clear 出结算 */
  var CHEER_MS = 2200;
  function win(st) {
    st.mode = "cheering";
    st.cheer = { since: 0 };
  }

  var RESCUE_FX_MS = 620;
  function tickDying(st, dtMs) {
    if (st.rescueFx) {
      st.rescueFx.since += dtMs;
      if (st.rescueFx.since >= RESCUE_FX_MS) st.rescueFx = null;
    }
    if (st.mode === "dying") {
      st.death.since += dtMs;
      if (st.death.since >= DYING_MS) st.mode = "dead";
    } else if (st.mode === "cheering") {
      st.cheer.since += dtMs;
      if (st.cheer.since >= CHEER_MS) st.mode = "clear";
    }
  }

  function copyCells(list) {
    var out = [], i;
    for (i = 0; i < list.length; i++) out.push({ x: list[i].x, y: list[i].y });
    return out;
  }

  function step(st) {
    if (st.mode !== "play") return;
    // 记录上一拍位置,渲染层据此在两拍之间做平滑插值(慢速下不再是一格一跳)
    st.prev = { snake: copyCells(st.snake), rival: st.rival ? copyCells(st.rival.body) : null };
    st.tickCount++;
    if (st.effect && --st.effect.ticksLeft <= 0) st.effect = null;
    rivalTick(st);

    st.dir = st.nextDir;
    var head = { x: st.snake[0].x + st.dir.x, y: st.snake[0].y + st.dir.y };
    var i;

    if (head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS)
      return die(st, "SPLAT! Straight into the fence.", "wall",
                 { x: Math.min(COLS - 0.5, Math.max(-0.5, head.x)), y: Math.min(ROWS - 0.5, Math.max(-0.5, head.y)) });
    // 尾巴宽容:不吃人时尾巴这拍会挪走,追尾是安全的(娱乐性优先)
    var eating = cellInList(st.believers, head.x, head.y) >= 0;
    if (!effectActive(st, "ghost"))
      for (i = 0; i < st.snake.length - (eating ? 0 : 1); i++)
        if (st.snake[i].x === head.x && st.snake[i].y === head.y)
          return die(st, "Oops — tangled up in your own flock!", "self", head);
    if (!effectActive(st, "ghost") && !effectActive(st, "shield"))
      for (i = 0; i < st.demons.length; i++)
        if (st.demons[i].x === head.x && st.demons[i].y === head.y)
          return die(st, "KABOOM! That demon went off like a firecracker.", "demon", head);

    if (st.rival) {
      var ri = cellInList(st.rival.body, head.x, head.y);
      if (ri === 0) {
        if (!effectActive(st, "ghost") && !effectActive(st, "shield"))
          return die(st, "GULP! The great demon swallowed you whole.", "devour", head);
      } else if (ri > 0 && st.rival.body.length > 3) {
        // 撞到尾巴:从撞点到尾端的俘虏整段抢回(恶魔本体 3 节保留)
        var keep = Math.max(3, ri);
        var freed = st.rival.body.length - keep;
        st.rival.body = st.rival.body.slice(0, keep);
        while (freed-- > 0) {
          st.snake.push({ x: st.snake[st.snake.length - 1].x, y: st.snake[st.snake.length - 1].y });
          st.rescued++;
        }
        if (st.rescued >= quota(st.level, st.diff)) { st.snake.unshift(head); win(st); return; }
      }
    }

    st.snake.unshift(head);

    var pi = cellInList(st.pickups, head.x, head.y);
    if (pi >= 0) {
      st.skill = st.pickups[pi].skill;
      st.skillTick = st.tickCount;   // 渲染层据此播"点这里用"提示
      st.pickups.splice(pi, 1);
      // 这个技能第一次拿到 → 暂停,让玩家看完说明再继续
      if (!st.seenSkills[st.skill]) {
        st.seenSkills[st.skill] = true;
        st.mode = "skillIntro";
      }
    }

    var ate = false;
    for (i = 0; i < st.believers.length; i++)
      if (st.believers[i].x === head.x && st.believers[i].y === head.y) {
        st.believers.splice(i, 1); st.rescued++; ate = true;
        st.rescueFx = { x: head.x, y: head.y, since: 0, n: st.rescued };  // 救人小特效
        break;
      }
    if (!ate) st.snake.pop();
    else {
      fillBelievers(st);
      if (st.rescued >= quota(st.level, st.diff)) win(st);
    }
  }

  /* 交互推进:menu→intro→play,clear→下一关 intro,dead→重试本关,skillIntro→继续本局 */
  function advance(st) {
    if (st.mode === "skillIntro") { st.mode = "play"; return; }
    if (st.mode === "menu" || st.mode === "clear" || st.mode === "dead") {
      var lv = st.mode === "clear" ? Math.min(st.level + 1, MAX_LEVEL) : st.level;
      if (lv > st.best) st.best = lv;
      newLevel(st, lv);
    } else if (st.mode === "intro") {
      st.mode = "play";
    }
  }

  return {
    COLS: COLS, ROWS: ROWS, MAX_LEVEL: MAX_LEVEL,
    SKILLS: SKILLS, quota: quota, demonCount: demonCount,
    hasRival: hasRival, rivalEvery: rivalEvery, hasSkills: hasSkills,
    DYING_MS: DYING_MS, CHEER_MS: CHEER_MS, RESCUE_FX_MS: RESCUE_FX_MS, tickDying: tickDying,
    tickMs: tickMs, create: create, newLevel: newLevel, step: step,
    setDir: setDir, useSkill: useSkill, advance: advance, effectActive: effectActive,
    SUMMON_R: SUMMON_R, pickupCount: pickupCount, tickFx: tickFx, FX_MS: FX_MS,
    DIFFS: DIFFS, DIFF_IDS: DIFF_IDS, setDifficulty: setDifficulty,
    currentTickMs: currentTickMs, STILL_FACTOR: STILL_FACTOR
  };
})();

if (typeof module !== "undefined") module.exports = Core;
