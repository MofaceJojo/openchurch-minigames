/* Holy Bubbles · Platform-agnostic game logic (no DOM, no canvas) */
"use strict";

var Core = (function () {
  var W = 240, H = 386, HUD = 26;
  var SS = 2;
  var COLS = 10, ROWS = 15, T = 24;
  var PLAY_H = H - HUD;
  var MAX_LEVEL = 30;

  /* Three difficulty tiers — must produce visibly different numbers */
  var DIFFS = {
    gentle: { id:"gentle", name:"Gentle", blurb:"Slow and forgiving",
              enemySpeed:0.65, enemyMul:0.5, density:0.10, lives:5, powerDrop:0.30, bossHp:2 },
    normal: { id:"normal", name:"Normal", blurb:"A steady challenge",
              enemySpeed:1.0, enemyMul:1.0, density:0.16, lives:3, powerDrop:0.22, bossHp:3 },
    brave:  { id:"brave",  name:"Brave",  blurb:"Fast and fierce",
              enemySpeed:1.3, enemyMul:1.4, density:0.21, lives:2, powerDrop:0.18, bossHp:4 }
  };
  var DIFF_IDS = ["gentle","normal","brave"];
  function diff(d) { return DIFFS[d] || DIFFS.normal; }

  /* Demon bestiary */
  var DEMONS = {
    hound:   { speed:1.7, score:60 },
    imp:     { speed:1.15, score:40 },
    ghost:   { speed:1.0, score:80 },
    brute:   { speed:0.95, score:100 },
    bomber:  { speed:0.9, score:150 },
    miniboss:{ speed:1.6, score:800, boss:true },
    bigboss: { speed:2.4, score:5000, boss:true }
  };

  function levelRoster(level) {
    var base = level <= 1 ? ["hound","hound","imp"]
            : level <= 2 ? ["hound","imp","imp","imp"]
            : level <= 3 ? ["hound","imp","ghost","ghost"]
            : level <= 4 ? ["imp","ghost","brute","brute"]
            : ["ghost","brute","brute","bomber"].concat(level > 5 ? ["bomber"] : []);
    if (level >= 11 && level < 30) base.push("miniboss");
    if (level >= 30) base.push("miniboss","miniboss");
    return base;
  }
  function bossForLevel(level) {
    if (level > 0 && level % 30 === 0) return "bigboss";
    if (level > 0 && level % 10 === 0) return "miniboss";
    return null;
  }

  var DROP_POOL = ["fire","fire","bomb","speed","shield","life","remote","glove"];
  var DIRS = { up:[0,-1], down:[0,1], left:[-1,0], right:[1,0] };
  var OPP = { up:"down", down:"up", left:"right", right:"left" };

  /* 泡泡堂对标:困泡 + 踢泡。
     恶魔被圣光水柱碰到 → 困进圣泡(trapped),需天使补刀(碰一下)才净化,超时挣脱复活;
     天使被碰到 → 困进黑暗泡,限时连点方向键挣脱,失败才扣命。 */
  var TRAP_TICKS = 190;        // 恶魔被困时长(帧,≈3秒)
  var PLAYER_TRAP_TICKS = 150; // 天使被困时长(帧,≈2.5秒)
  var STRUGGLE_NEED = 6;       // 挣脱需连点方向键次数
  var KICK_SPEED = 5.0;        // 踢泡滑行速度(像素/帧)
  var RAGE_TICKS = 150;        // 恶魔挣脱后狂暴时长(帧,≈2.5秒)
  var RAGE_MUL = 1.5;          // 狂暴速度倍率
  var COMBO_WINDOW = 120;      // 连击计分窗口(帧,≈2秒)

  function idx(c, r) { return r * COLS + c; }

  /* Fixed pillar positions — sparse, not the classic full grid */
  var PILLARS = [];
  (function() {
    for (var r = 2; r < ROWS - 1; r += 3)
      for (var c = 2; c < COLS - 1; c += 3)
        if (r % 2 === 0 && c % 2 === 0) PILLARS.push([c, r]);
  })();

  function buildMap(level, d) {
    var m = new Array(COLS * ROWS).fill(0);
    var i;
    for (i = 0; i < COLS; i++) { m[idx(i,0)] = 1; m[idx(i,ROWS-1)] = 1; }
    for (i = 0; i < ROWS; i++) { m[idx(0,i)] = 1; m[idx(COLS-1,i)] = 1; }
    for (i = 0; i < PILLARS.length; i++) m[idx(PILLARS[i][0], PILLARS[i][1])] = 1;
    m[idx(1,1)] = 0; m[idx(2,1)] = 0; m[idx(1,2)] = 0;
    var dens = Math.min(diff(d).density + level * 0.006, 0.28);
    for (var r = 1; r < ROWS - 1; r++)
      for (var c = 1; c < COLS - 1; c++) {
        if (m[idx(c,r)] !== 0) continue;
        if (c <= 2 && r <= 2) continue;
        if (Math.random() < dens) m[idx(c,r)] = 2;
      }
    return m;
  }

  function spawnEnemies(st) {
    st.enemies = [];
    var roster = levelRoster(st.level);
    var placed = 0, tries;
    for (tries = 0; tries < 600 && placed < roster.length; tries++) {
      var c = 3 + Math.floor(Math.random() * (COLS - 5));
      var r = 2 + Math.floor(Math.random() * (ROWS - 4));
      if (st.map[idx(c,r)] !== 0) continue;
      if (Math.hypot(c - 1, r - 1) < 5) continue;
      st.enemies.push(makeDemon(st, roster[placed], c, r));
      placed++;
    }
    var bk = bossForLevel(st.level);
    if (bk) {
      for (tries = 0; tries < 400; tries++) {
        c = Math.floor(COLS / 2 - 3 + Math.random() * 6);
        r = Math.floor(ROWS / 2 - 2 + Math.random() * 5);
        if (c < 2 || r < 2 || c >= COLS - 2 || r >= ROWS - 2) continue;
        if (st.map[idx(c,r)] !== 0) continue;
        if (Math.hypot(c - 1, r - 1) < 6) continue;
        st.enemies.push(makeDemon(st, bk, c, r));
        break;
      }
    }
  }

  function makeDemon(st, kind, c, r) {
    var book = DEMONS[kind];
    var df = diff(st.diff);
    var hp = book.boss ? df.bossHp : 1;
    return { kind:kind, c:c, r:r, x:c*T+T/2, y:r*T+T/2, dir:"left", dead:false,
             trapped:false, trapT:0, rage:false, rageT:0,
             hp:hp, maxHp:hp,
             speed: book.speed * df.enemySpeed * (1 + (st.level - 1) * 0.04),
             dashT:200, dashing:0, bombT:240, hitFlash:0,
             boss: !!book.boss,
             bombLimit: kind === "bigboss" ? 3 : (kind === "miniboss" ? 2 : 1),
             myBombs: 0, bombPower: 0 };
  }

  function startLevel(st, fresh) {
    st.map = buildMap(st.level, st.diff);
    st.player = { x:T*1.5, y:T*1.5, c:1, r:1, speed:2.4, lives:st.player ? st.player.lives : diff(st.diff).lives,
                  hurtT:0, power:1, maxBombs:1, shield:0,
                  trapped:false, trapT:0, struggleN:0,
                  remoteT:0, gloveT:0 };
    if (fresh) {
      st.player.lives = diff(st.diff).lives;
      st.player.power = 1; st.player.maxBombs = 1; st.player.speed = 2.4;
      st.score = 0; st.level = 1;
    }
    st.bombs = []; st.flames = []; st.drops = []; st.poofs = []; st.fx = [];
    st.combo = 0; st.comboTimer = 0;
    st.mode = "intro";
    st.msg = "";
    spawnEnemies(st);
  }

  function create(savedLevel, difficulty) {
    var st = { mode:"menu", best: savedLevel || 1, diff: DIFFS[difficulty] ? difficulty : "normal",
               score:0, level:1, player:null, enemies:[], bombs:[], flames:[], drops:[], poofs:[], fx:[], msg:"",
               combo:0, comboTimer:0 };
    st.level = st.best;
    startLevel(st, true);
    st.mode = "menu";
    return st;
  }

  function setDifficulty(st, d) {
    if (!DIFFS[d] || st.diff === d) return false;
    st.diff = d;
    startLevel(st, true);
    st.mode = "menu";
    return true;
  }

  /* === collision === */
  function isSolid(st, c, r, forGhost, entity) {
    if (c < 0 || r < 0 || c >= COLS || r >= ROWS) return true;
    var v = st.map[idx(c,r)];
    if (v === 1) return true;
    if (v === 2) return forGhost ? false : true;
    if (entity) {
      var R = 10;
      var bx = c * T, by = r * T;
      if (entity.x + R > bx && entity.x - R < bx + T && entity.y + R > by && entity.y - R < by + T) return false;
    }
    return st.bombs.some(function(b) {
      if (b.c !== c || b.r !== r || b.passable) return false;
      if (entity && entity.gloveT > 0 && b.owner === "player") return false;  // 手套:能穿自己的泡
      return true;
    });
  }

  function moveEntity(st, e, dx, dy) {
    var R = 10;
    if (dx) {
      var nx = e.x + dx, edge = nx + (dx > 0 ? R : -R), c = Math.floor(edge / T);
      if (isSolid(st, c, Math.floor((e.y - R + 2) / T), e.ghost, e) ||
          isSolid(st, c, Math.floor((e.y + R - 2) / T), e.ghost, e))
        e.x = dx > 0 ? c * T - R - 0.01 : (c + 1) * T + R + 0.01;
      else e.x = nx;
    }
    if (dy) {
      var ny = e.y + dy, edge2 = ny + (dy > 0 ? R : -R), r = Math.floor(edge2 / T);
      if (isSolid(st, Math.floor((e.x - R + 2) / T), r, e.ghost, e) ||
          isSolid(st, Math.floor((e.x + R - 2) / T), r, e.ghost, e))
        e.y = dy > 0 ? r * T - R - 0.01 : (r + 1) * T + R + 0.01;
      else e.y = ny;
    }
  }

  /* === input === */
  function setPlayerDir(st, dir) {
    if (st.mode !== "play") return;
    var p = st.player;
    if (p.trapped) { p.struggleN = (p.struggleN || 0) + 1; return; }  // 被困:连点方向键挣扎
    p._dir = dir;
  }

  function placeBomb(st) {
    if (st.mode !== "play") return null;
    var p = st.player;
    if (p.trapped) return null;
    if (p.remoteT > 0) {          // 遥控:场上有自己的遥控泡时,再按则引爆
      var remotes = st.bombs.filter(function(b) { return b.owner === "player" && b.remote; });
      if (remotes.length > 0) {
        for (var ri = 0; ri < remotes.length; ri++) remotes[ri].t = 1;
        return { remote:true };
      }
    }
    var c = Math.floor(p.x / T), r = Math.floor(p.y / T);
    if (st.bombs.some(function(b) { return b.c === c && b.r === r; })) return null;
    if (st.bombs.filter(function(b) { return b.owner === "player"; }).length >= p.maxBombs) return null;
    var bomb = { c:c, r:r, x:c*T+T/2, y:r*T+T/2, vx:0, vy:0, kicked:false,
                 t:140, left:true, passable:true, owner:"player", power:p.power, remote: p.remoteT > 0 };
    st.bombs.push(bomb);
    return { placed:true };
  }

  /* 踢泡:站到自己的圣泡相邻格、面朝它按放泡键 → 泡沿方向滑出 */
  function kickBomb(st) {
    if (st.mode !== "play") return null;
    var p = st.player;
    if (p.trapped) return null;
    var dir = p._dir;
    if (!dir || !DIRS[dir]) return null;
    var nc = Math.floor(p.x / T) + DIRS[dir][0], nr = Math.floor(p.y / T) + DIRS[dir][1];
    for (var i = 0; i < st.bombs.length; i++) {
      var b = st.bombs[i];
      if (b.owner === "player" && b.c === nc && b.r === nr) {
        b.vx = DIRS[dir][0] * KICK_SPEED;
        b.vy = DIRS[dir][1] * KICK_SPEED;
        b.kicked = true;
        b.left = true;             // 泡已离手,玩家不能穿过它
        return { kicked:true, dir:dir };
      }
    }
    return null;
  }

  /* === bombs === */
  function explode(st, c, r, power) {
    var dirs = [[0,0],[1,0],[-1,0],[0,1],[0,-1]];
    for (var i = 0; i < dirs.length; i++) {
      var dc = dirs[i][0], dr = dirs[i][1];
      var len = (dc === 0 && dr === 0) ? 1 : power;
      for (var s = 1; s <= len; s++) {
        var nc = c + dc * s, nr = r + dr * s;
        if (nc < 0 || nr < 0 || nc >= COLS || nr >= ROWS) break;
        var v = st.map[idx(nc,nr)];
        if (v === 1) break;
        st.flames.push({ c:nc, r:nr, t:24 });
        if (v === 2) { st.map[idx(nc,nr)] = 0; st.score += 10;
          if (Math.random() < diff(st.diff).powerDrop) st.drops.push(makeDrop(nc, nr)); break; }
      }
    }
  }

  function makeDrop(c, r) {
    return { c:c, r:r, type: DROP_POOL[Math.floor(Math.random() * DROP_POOL.length)] };
  }

  function applyDrop(st, d) {
    var p = st.player;
    if (d.type === "fire") p.power = Math.min(p.power + 1, 6);
    else if (d.type === "bomb") p.maxBombs = Math.min(p.maxBombs + 1, 5);
    else if (d.type === "speed") p.speed = Math.min(p.speed + 0.3, 4.0);
    else if (d.type === "shield") p.shield = 300;
    else if (d.type === "life") p.lives = Math.min(p.lives + 1, 5);
    else if (d.type === "remote") p.remoteT = 600;   // 遥控:再按引爆自己的泡
    else if (d.type === "glove") p.gloveT = 600;     // 手套:能穿过自己的泡
  }

  /* 连击计分:连续净化恶魔,得分 100→200→400 翻倍(泡泡堂核心爽感) */
  function killScore(st, kind, x, y) {
    var gained = DEMONS[kind].score * Math.pow(2, st.combo);
    st.score += gained;
    st.fx.push({ type:"score", x:x, y:y, gained:gained, t:0 });
    st.combo++;
    st.comboTimer = COMBO_WINDOW;
    return gained;
  }

  /* === update === */
  function update(st, dtMs) {
    var events = [];
    if (st.mode !== "play") return events;

    var p = st.player;

    /* combo timer */
    if (st.comboTimer > 0) { st.comboTimer--; if (st.comboTimer <= 0) st.combo = 0; }
    if (p.remoteT > 0) p.remoteT--;
    if (p.gloveT > 0) p.gloveT--;

    /* player movement */
    var dx = 0, dy = 0;
    if (!p.trapped) {
      if (p._dir === "up") dy = -1;
      else if (p._dir === "down") dy = 1;
      else if (p._dir === "left") dx = -1;
      else if (p._dir === "right") dx = 1;
    }
    if (dx && dy) dy = 0;
    if (dx || dy) {
      moveEntity(st, p, dx * p.speed, dy * p.speed);
      if (dx) p.y += (Math.floor(p.y / T) * T + T / 2 - p.y) * 0.3;
      if (dy) p.x += (Math.floor(p.x / T) * T + T / 2 - p.x) * 0.3;
    }

    /* enemies */
    for (var i = 0; i < st.enemies.length; i++) {
      var en = st.enemies[i];
      if (en.dead) continue;
      if (en.trapped) { if (--en.trapT <= 0) { en.trapped = false; en.rage = true; en.rageT = RAGE_TICKS; } continue; }
      if (en.rage) { if (--en.rageT <= 0) en.rage = false; }
      if (en.kind === "brute") { if (--en.dashT <= 0) { en.dashing = 45; en.dashT = 220 + Math.random() * 140; } }
      if ((en.kind === "bomber" || en.boss) && --en.bombT <= 0) {
        en.bombT = en.boss ? (120 + Math.random() * 90) : (300 + Math.random() * 180);
        var bc = Math.floor(en.x / T), br = Math.floor(en.y / T);
        if (!st.bombs.some(function(b) { return b.c === bc && b.r === br; }) &&
            st.bombs.filter(function(b) { return b.owner === en; }).length < en.bombLimit) {
          var epower = en.kind === "bigboss" ? Math.min(2 + Math.floor(st.level / 10), 6)
                     : en.kind === "miniboss" ? Math.min(1 + Math.floor(st.level / 10), 5)
                     : (en.kind === "bomber" ? Math.min(1 + Math.floor(st.level / 3), 4) : 1);
          st.bombs.push({ c:bc, r:br, x:bc*T+T/2, y:br*T+T/2, vx:0, vy:0, kicked:false,
                          t:140, left:false, passable:false, owner:en, power:epower });
        }
      }
      var sp = en.speed * (en.dashing > 0 ? 2.8 : 1) * (en.rage ? RAGE_MUL : 1);
      var cx = en.c * T + T / 2, cy = en.r * T + T / 2;
      if (Math.hypot(cx - en.x, cy - en.y) <= sp) {
        en.x = cx; en.y = cy;
        var opts = [];
        for (var k in DIRS) {
          var nc = en.c + DIRS[k][0], nr = en.r + DIRS[k][1];
          if (!isSolid(st, nc, nr, en.kind === "ghost") &&
              !st.bombs.some(function(b) { return b.c === nc && b.r === nr; })) opts.push(k);
        }
        if (opts.length) {
          if (en.kind === "bigboss" && Math.random() < 0.7) {
            var pc = Math.floor(p.x / T), pr = Math.floor(p.y / T);
            opts.sort(function(a, b) {
              var da = Math.abs(en.c + DIRS[a][0] - pc) + Math.abs(en.r + DIRS[a][1] - pr);
              var db = Math.abs(en.c + DIRS[b][0] - pc) + Math.abs(en.r + DIRS[b][1] - pr);
              return da - db;
            });
            en.dir = opts[0];
          } else {
            en.dir = (opts.indexOf(en.dir) >= 0 && Math.random() < 0.6) ? en.dir : opts[Math.floor(Math.random() * opts.length)];
          }
        } else en.dir = OPP[en.dir];
        var tc = en.c + DIRS[en.dir][0], tr = en.r + DIRS[en.dir][1];
        if (!isSolid(st, tc, tr, en.kind === "ghost") &&
            !st.bombs.some(function(b) { return b.c === tc && b.r === tr; })) {
          en.c = tc; en.r = tr;
        }
      } else {
        en.x += DIRS[en.dir][0] * sp;
        en.y += DIRS[en.dir][1] * sp;
      }
      if (en.dashing > 0) en.dashing--;
      if (en.hitFlash > 0) en.hitFlash--;
    }

    /* bombs */
    var pc = Math.floor(p.x / T), pr = Math.floor(p.y / T);
    for (i = st.bombs.length - 1; i >= 0; i--) {
      var b = st.bombs[i];
      if (b.vx || b.vy) {                                   // 踢泡滑动
        var nx = b.x + b.vx, ny = b.y + b.vy;
        var ncx = Math.floor(nx / T), ncy = Math.floor(ny / T);
        var stopped = false;
        if (ncx < 0 || ncy < 0 || ncx >= COLS || ncy >= ROWS) stopped = true;
        else if (st.map[idx(ncx, ncy)] !== 0) stopped = true;   // 撞墙/箱子/柱子停下
        else {
          b.x = nx; b.y = ny; b.c = ncx; b.r = ncy;
          for (var e = 0; e < st.enemies.length; e++) {         // 撞到恶魔 → 困进圣泡
            var en4 = st.enemies[e];
            if (!en4.dead && !en4.boss && !en4.trapped && en4.c === b.c && en4.r === b.r) {
              en4.trapped = true; en4.trapT = TRAP_TICKS;
              stopped = true; events.push({ type:"trap" });
              break;
            }
          }
          if (!stopped && Math.floor(p.x / T) === b.c && Math.floor(p.y / T) === b.r &&
              !p.trapped && p.hurtT <= 0 && p.shield <= 0) {    // 撞到自己 → 困住玩家
            p.trapped = true; p.trapT = PLAYER_TRAP_TICKS; p.struggleN = 0;
            stopped = true; events.push({ type:"trap" });
          }
        }
        if (stopped) { b.vx = 0; b.vy = 0; b.x = b.c * T + T / 2; b.y = b.r * T + T / 2; }
      }
      b.t--;
      if (b.owner === "player" && (b.c !== pc || b.r !== pr)) b.left = true;
      b.passable = b.owner === "player" ? !b.left : false;
      if (b.t <= 0) { explode(st, b.c, b.r, b.power); events.push({ type:"explode", at:{c:b.c, r:b.r} }); st.bombs.splice(i, 1); }
    }

    /* flames */
    for (i = st.flames.length - 1; i >= 0; i--) if (--st.flames[i].t <= 0) st.flames.splice(i, 1);
    for (i = st.poofs.length - 1; i >= 0; i--) { var pf = st.poofs[i]; pf.y -= 0.8; if (--pf.t <= 0) st.poofs.splice(i, 1); }
    for (i = st.fx.length - 1; i >= 0; i--) { if (++st.fx[i].t > 40) st.fx.splice(i, 1); }

    /* water vs enemies:普通恶魔被圣光水柱碰到 → 困进圣泡,再被碰到则净化;boss 免疫困泡直接扣 hp */
    for (i = 0; i < st.flames.length; i++) {
      var f = st.flames[i];
      for (var j = 0; j < st.enemies.length; j++) {
        var en2 = st.enemies[j];
        if (en2.dead) continue;
        if (en2.c === f.c && en2.r === f.r) {
          if (en2.boss && en2.hitFlash <= 0) {
            en2.hp--; en2.hitFlash = 45;
            if (en2.hp <= 0) { en2.dead = true; killScore(st, en2.kind, en2.x, en2.y);
              st.poofs.push({ x:en2.x, y:en2.y, t:60, kind:en2.kind, big:true }); events.push({ type:"bossDie" }); }
          } else if (!en2.boss) {
            if (en2.trapped) {
              en2.dead = true; en2.trapped = false; killScore(st, en2.kind, en2.x, en2.y);
              st.poofs.push({ x:en2.x, y:en2.y, t:36, kind:en2.kind }); events.push({ type:"enemyDie" });
            } else {
              en2.trapped = true; en2.trapT = TRAP_TICKS; events.push({ type:"trap" });
            }
          }
        }
      }
    }

    /* player purifies trapped demons by walking into them (补刀) */
    for (i = 0; i < st.enemies.length; i++) {
      var enP = st.enemies[i];
      if (enP.dead || !enP.trapped) continue;
      if (Math.floor(p.x / T) === enP.c && Math.floor(p.y / T) === enP.r) {
        enP.dead = true; enP.trapped = false; killScore(st, enP.kind, enP.x, enP.y);
        st.poofs.push({ x:enP.x, y:enP.y, t:36, kind:enP.kind }); events.push({ type:"enemyDie" });
      }
    }

    /* boss eats drops */
    for (i = st.drops.length - 1; i >= 0; i--) {
      var d = st.drops[i];
      var eater = null;
      for (j = 0; j < st.enemies.length; j++) {
        var en3 = st.enemies[j];
        if (!en3.dead && en3.boss && Math.floor(en3.x / T) === d.c && Math.floor(en3.y / T) === d.r) { eater = en3; break; }
      }
      if (eater) {
        st.drops.splice(i, 1);
        if (d.type === "fire") eater.bombPower = (eater.bombPower || 0) + 1;
        else if (d.type === "life") eater.hp = Math.min(eater.hp + 1, eater.maxHp);
        else eater.speed = Math.min(eater.speed * 1.06, 5.5);
      }
    }

    /* player picks up drops */
    for (i = st.drops.length - 1; i >= 0; i--) {
      d = st.drops[i];
      if (Math.floor(p.x / T) === d.c && Math.floor(p.y / T) === d.r) {
        applyDrop(st, d); st.score += 20; st.drops.splice(i, 1); events.push({ type:"pickup" });
      }
    }

    /* player hurt:被困时挣扎到足够次数则挣脱;非被困时碰到水柱才进困泡 */
    if (p.trapped) {
      if (p.struggleN >= STRUGGLE_NEED) { p.trapped = false; p.struggleN = 0; p.hurtT = 60; events.push({ type:"free" }); }
    }
    if (p.hurtT > 0) p.hurtT--;
    if (p.shield > 0) p.shield--;
    var hitFlame = st.flames.some(function(f) { return Math.hypot(f.c * T + T / 2 - p.x, f.r * T + T / 2 - p.y) < T * 0.55; });
    var hitEnemy = st.enemies.some(function(en) { return !en.dead && !en.trapped && Math.hypot(en.x - p.x, en.y - p.y) < T * 0.45; });
    if ((hitFlame || hitEnemy) && p.hurtT <= 0 && p.shield <= 0 && !p.trapped) {
      p.trapped = true; p.trapT = PLAYER_TRAP_TICKS; p.struggleN = 0;
      p.x = Math.floor(p.x / T) * T + T / 2; p.y = Math.floor(p.y / T) * T + T / 2;  // 对齐格子
      events.push({ type:"trap" });
    }
    if (p.trapped && p.trapT > 0) p.trapT--;
    if (p.trapped && p.trapT <= 0) {                       // 挣脱失败
      p.lives--; p.trapped = false; p.hurtT = 90;
      p.x = T * 1.5; p.y = T * 1.5; events.push({ type:"hurt" });
      if (p.lives <= 0) { st.mode = "lose"; st.msg = "Swallowed by the dark!"; events.push({ type:"gameOver" }); }
    }

    /* level clear —— 只置为 win,推进交给 advance(),避免与 setTimeout 重复加关卡 */
    if (st.enemies.length > 0 && st.enemies.every(function(e) { return e.dead; })) {
      st.mode = "win"; st.msg = "Floor " + st.level + " purified!";
      events.push({ type:"levelClear" });
    }

    return events;
  }

  function advance(st) {
    if (st.mode === "menu" || st.mode === "lose") { startLevel(st, true); st.mode = "intro"; }
    else if (st.mode === "win") { st.level = Math.min(st.level + 1, MAX_LEVEL); if (st.level > st.best) st.best = st.level; startLevel(st, false); st.mode = "intro"; }
    else if (st.mode === "intro") st.mode = "play";
  }

  return {
    W:W, H:H, HUD:HUD, SS:SS, COLS:COLS, ROWS:ROWS, T:T, PLAY_H:PLAY_H, MAX_LEVEL:MAX_LEVEL,
    DIFFS:DIFFS, DIFF_IDS:DIFF_IDS, DEMONS:DEMONS, DROP_POOL:DROP_POOL,
    TRAP_TICKS:TRAP_TICKS, PLAYER_TRAP_TICKS:PLAYER_TRAP_TICKS, STRUGGLE_NEED:STRUGGLE_NEED,
    create:create, setDifficulty:setDifficulty, startLevel:startLevel,
    setPlayerDir:setPlayerDir, placeBomb:placeBomb, kickBomb:kickBomb,
    update:update, advance:advance, isSolid:isSolid,
    levelRoster:levelRoster, bossForLevel:bossForLevel
  };
})();

if (typeof module !== "undefined") module.exports = Core;
