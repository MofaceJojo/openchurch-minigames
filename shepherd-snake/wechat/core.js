/* 牧者行列 · 平台无关游戏逻辑(网页 / 微信小游戏共用,无 DOM 无渲染) */
"use strict";

var Core = (function () {
  var COLS = 12, ROWS = 16, MAX_LEVEL = 50;

  // 设计准则:1-40 关零压力,41-50 关才略微上强度;娱乐性 >> 难度
  function quota(level) {
    return level <= 40 ? 10 + Math.floor(level / 4)          // lv1-40: 10→20,缓到几乎无感
                       : 20 + (level - 40) * 3;              // lv41-50: 23→50,冲刺段
  }
  function demonCount(level) {
    if (level < 2) return 0;
    return Math.min(3, 1 + Math.floor((level - 2) / 12));    // 小恶魔永远站桩、最多 3 只(地形)
  }
  function hasRival(level) { return level >= 30; }           // 30 关起:大恶魔蛇和你比赛抢信徒
  function rivalEvery(level) {                                // 每 N 拍走一步,越后期越敏捷
    return level >= 46 ? 2 : level >= 38 ? 3 : 4;
  }
  var RIVAL_MAX_LEN = 14;
  function hasSkills(level) { return level >= 5; }           // 技能是玩具,早点给
  function tickMs(level) {
    // 每 5 关提一档速度(玩家能明显感到"变快了"的爽感),
    // 40 关(136ms)到顶,之后不再用速度上难度——难度交给大恶魔蛇
    return 200 - Math.min(8, Math.floor(level / 5)) * 8;
  }

  var SKILLS = {
    summon: { name: "Gather", desc: "Nearby believers join your line at once" },
    smite:  { name: "Smite",  desc: "Destroy the nearest little demon" },
    shield: { name: "Shield", desc: "Demons can't hurt you for a while" },
    ghost:  { name: "Spirit", desc: "Pass through your line and demons" }
  };
  var SKILL_IDS = ["summon", "smite", "shield", "ghost"];
  var EFFECT_TICKS = 30; // 护佑/灵体持续拍数

  function occupied(st, x, y) {
    var i;
    for (i = 0; i < st.snake.length; i++) if (st.snake[i].x === x && st.snake[i].y === y) return true;
    for (i = 0; i < st.demons.length; i++) if (st.demons[i].x === x && st.demons[i].y === y) return true;
    for (i = 0; i < st.believers.length; i++) if (st.believers[i].x === x && st.believers[i].y === y) return true;
    if (st.pickup && st.pickup.x === x && st.pickup.y === y) return true;
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
    var want = Math.min(4, quota(st.level) - st.rescued - st.believers.length);
    while (want-- > 0) st.believers.push(freeCell(st, 2));
  }

  function newLevel(st, level) {
    st.level = level;
    st.rescued = 0;
    st.snake = [{ x: 5, y: 8 }, { x: 5, y: 9 }, { x: 5, y: 10 }];
    st.dir = { x: 0, y: -1 }; st.nextDir = st.dir;
    st.demons = []; st.believers = []; st.pickup = null;
    st.skill = null; st.effect = null; st.tickCount = 0;
    st.rival = hasRival(level)
      ? { body: [{ x: COLS - 2, y: 1 }, { x: COLS - 1, y: 1 }, { x: COLS - 1, y: 0 }] }
      : null;
    var i, n = demonCount(level);
    for (i = 0; i < n; i++) st.demons.push(freeCell(st, 5));
    if (hasSkills(level)) st.pickup = freeCell(st, 4);
    fillBelievers(st);
    st.mode = "intro";
  }

  function create(savedLevel) {
    var st = { mode: "menu", best: savedLevel || 1, deathMsg: "" };
    newLevel(st, st.best);
    st.mode = "menu";
    return st;
  }

  function setDir(st, x, y) {
    if (x === -st.dir.x && y === -st.dir.y) return;
    st.nextDir = { x: x, y: y };
  }

  function effectActive(st, type) {
    return st.effect && st.effect.type === type && st.effect.ticksLeft > 0;
  }

  function useSkill(st) {
    if (st.mode !== "play" || !st.skill) return null;
    var id = st.skill, head = st.snake[0], i;
    st.skill = null;
    if (id === "summon") {
      var joined = [];
      for (i = st.believers.length - 1; i >= 0; i--) {
        var b = st.believers[i];
        if (Math.max(Math.abs(b.x - head.x), Math.abs(b.y - head.y)) <= 3) {
          st.believers.splice(i, 1);
          st.snake.push({ x: st.snake[st.snake.length - 1].x, y: st.snake[st.snake.length - 1].y });
          st.rescued++; joined.push(b);
        }
      }
      fillBelievers(st);
      if (st.rescued >= quota(st.level)) st.mode = "clear";
      return { id: id, joined: joined };
    }
    if (id === "smite") {
      var best = -1, dist = 1e9;
      for (i = 0; i < st.demons.length; i++) {
        var d = Math.abs(st.demons[i].x - head.x) + Math.abs(st.demons[i].y - head.y);
        if (d < dist) { dist = d; best = i; }
      }
      if (best >= 0) return { id: id, demon: st.demons.splice(best, 1)[0] };
      return { id: id };
    }
    st.effect = { type: id, ticksLeft: EFFECT_TICKS }; // shield / ghost
    return { id: id };
  }

  function cellInList(list, x, y) {
    for (var i = 0; i < list.length; i++) if (list[i].x === x && list[i].y === y) return i;
    return -1;
  }

  /* 大恶魔蛇:朝最近的信徒贪心走一步,抢到就挂在尾巴上 */
  function rivalTick(st) {
    if (!st.rival || st.tickCount % rivalEvery(st.level) !== 0) return;
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

  function die(st, msg) { st.mode = "dead"; st.deathMsg = msg; }

  function step(st) {
    if (st.mode !== "play") return;
    st.tickCount++;
    if (st.effect && --st.effect.ticksLeft <= 0) st.effect = null;
    rivalTick(st);

    st.dir = st.nextDir;
    var head = { x: st.snake[0].x + st.dir.x, y: st.snake[0].y + st.dir.y };
    var i;

    if (head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS)
      return die(st, "The little angel flew out of the field");
    // 尾巴宽容:不吃人时尾巴这拍会挪走,追尾是安全的(娱乐性优先)
    var eating = cellInList(st.believers, head.x, head.y) >= 0;
    if (!effectActive(st, "ghost"))
      for (i = 0; i < st.snake.length - (eating ? 0 : 1); i++)
        if (st.snake[i].x === head.x && st.snake[i].y === head.y)
          return die(st, "You bumped into your own line");
    if (!effectActive(st, "ghost") && !effectActive(st, "shield"))
      for (i = 0; i < st.demons.length; i++)
        if (st.demons[i].x === head.x && st.demons[i].y === head.y)
          return die(st, "A little demon caught you");

    if (st.rival) {
      var ri = cellInList(st.rival.body, head.x, head.y);
      if (ri === 0) {
        if (!effectActive(st, "ghost") && !effectActive(st, "shield"))
          return die(st, "The great demon caught you");
      } else if (ri > 0 && st.rival.body.length > 3) {
        // 撞到尾巴:从撞点到尾端的俘虏整段抢回(恶魔本体 3 节保留)
        var keep = Math.max(3, ri);
        var freed = st.rival.body.length - keep;
        st.rival.body = st.rival.body.slice(0, keep);
        while (freed-- > 0) {
          st.snake.push({ x: st.snake[st.snake.length - 1].x, y: st.snake[st.snake.length - 1].y });
          st.rescued++;
        }
        if (st.rescued >= quota(st.level)) { st.snake.unshift(head); st.mode = "clear"; return; }
      }
    }

    st.snake.unshift(head);

    if (st.pickup && st.pickup.x === head.x && st.pickup.y === head.y) {
      st.skill = SKILL_IDS[(Math.random() * SKILL_IDS.length) | 0];
      st.pickup = null;
    }

    var ate = false;
    for (i = 0; i < st.believers.length; i++)
      if (st.believers[i].x === head.x && st.believers[i].y === head.y) {
        st.believers.splice(i, 1); st.rescued++; ate = true; break;
      }
    if (!ate) st.snake.pop();
    else {
      fillBelievers(st);
      if (st.rescued >= quota(st.level)) st.mode = "clear";
    }
  }

  /* 交互推进:menu→intro→play,clear→下一关 intro,dead→重试本关 */
  function advance(st) {
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
    tickMs: tickMs, create: create, newLevel: newLevel, step: step,
    setDir: setDir, useSkill: useSkill, advance: advance, effectActive: effectActive
  };
})();

if (typeof module !== "undefined") module.exports = Core;
