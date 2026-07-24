/* 牧者行列 · 平台无关游戏逻辑(网页 / 微信小游戏共用,无 DOM 无渲染) */
"use strict";

var Core = (function () {
  var COLS = 12, ROWS = 16, MAX_LEVEL = 50;

  function quota(level) { return Math.min(50, 10 + Math.round((level - 1) * 40 / 49)); }
  function demonCount(level) { return level < 2 ? 0 : Math.min(10, 1 + Math.floor((level - 2) / 5)); }
  function demonsMove(level) { return level >= 30; }
  function demonsBlink(level) { return level >= 40; }
  function hasSkills(level) { return level >= 10; }
  function tickMs(level) { return Math.max(110, 170 - Math.floor(level * 1.2)); }

  var SKILLS = {
    summon: { name: "呼召", desc: "附近的信徒立刻加入队伍" },
    smite:  { name: "圣火", desc: "摧毁最近的一只小恶魔" },
    shield: { name: "护佑", desc: "短时间内不怕小恶魔" },
    ghost:  { name: "灵体", desc: "短时间内穿过队伍与恶魔" }
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
    var want = Math.min(3, quota(st.level) - st.rescued - st.believers.length);
    while (want-- > 0) st.believers.push(freeCell(st, 2));
  }

  function newLevel(st, level) {
    st.level = level;
    st.rescued = 0;
    st.snake = [{ x: 5, y: 8 }, { x: 5, y: 9 }, { x: 5, y: 10 }];
    st.dir = { x: 0, y: -1 }; st.nextDir = st.dir;
    st.demons = []; st.believers = []; st.pickup = null;
    st.skill = null; st.effect = null; st.tickCount = 0;
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

  function moveDemons(st) {
    var i, dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    if (demonsMove(st.level) && st.tickCount % 6 === 0) {
      for (i = 0; i < st.demons.length; i++) {
        var d = st.demons[i], v = dirs[(Math.random() * 4) | 0];
        var nx = d.x + v[0], ny = d.y + v[1];
        if (nx >= 0 && nx < COLS && ny >= 0 && ny < ROWS && !occupied(st, nx, ny)) { d.x = nx; d.y = ny; }
      }
    }
    if (demonsBlink(st.level) && st.tickCount % 45 === 0 && st.demons.length) {
      var j = (Math.random() * st.demons.length) | 0;
      var p = freeCell(st, 4);
      st.demons[j].x = p.x; st.demons[j].y = p.y;
      st.demons[j].blinked = st.tickCount; // 渲染层可做闪现特效
    }
  }

  function die(st, msg) { st.mode = "dead"; st.deathMsg = msg; }

  function step(st) {
    if (st.mode !== "play") return;
    st.tickCount++;
    if (st.effect && --st.effect.ticksLeft <= 0) st.effect = null;
    moveDemons(st);

    st.dir = st.nextDir;
    var head = { x: st.snake[0].x + st.dir.x, y: st.snake[0].y + st.dir.y };
    var i;

    if (head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS)
      return die(st, "小天使飞出了禾场");
    if (!effectActive(st, "ghost"))
      for (i = 0; i < st.snake.length; i++)
        if (st.snake[i].x === head.x && st.snake[i].y === head.y)
          return die(st, "撞到了自己的队伍");
    if (!effectActive(st, "ghost") && !effectActive(st, "shield"))
      for (i = 0; i < st.demons.length; i++)
        if (st.demons[i].x === head.x && st.demons[i].y === head.y)
          return die(st, "被小恶魔抓住了");

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
    demonsMove: demonsMove, demonsBlink: demonsBlink, hasSkills: hasSkills,
    tickMs: tickMs, create: create, newLevel: newLevel, step: step,
    setDir: setDir, useSkill: useSkill, advance: advance, effectActive: effectActive
  };
})();

if (typeof module !== "undefined") module.exports = Core;
