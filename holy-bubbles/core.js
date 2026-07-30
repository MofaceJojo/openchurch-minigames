/* Holy Bubbles · 平台无关游戏逻辑(网页 / 微信小游戏共用,无 DOM 无渲染)
   牧师在不同房间用“圣泡”驱散小捣蛋鬼 —— 泡泡堂类玩法。
   UI/文案一律英文(海外受众);这里只管逻辑。 */
"use strict";

var Core = (function () {
  var COLS = 11, ROWS = 11, N_ROOMS = 5;

  // 每间房英文名字 + 配色(全部明亮,符合“画面必须明朗”红线)。render 用。
  var ROOM_NAMES = ["The Chapel", "The Cloister", "The Courtyard", "The Bell Tower", "The Holy Sanctuary"];
  // 全部改用柔彩配色 —— 像泡泡堂/QQ堂那种粉彩暖光感
  var ROOM_THEME = [
    { floor:"#fdf6ee", floor2:"#faf0e0", wall:"#e8cfa0", wallTop:"#f0ddc0", accent:"#f5d89a", soft:"#ffe8cc" }, // chapel · warm cream
    { floor:"#f0f4f8", floor2:"#e8eef4", wall:"#c0d0e0", wallTop:"#d0e0f0", accent:"#a8c8e8", soft:"#d8e8f8" }, // cloister · baby blue stone
    { floor:"#f0f8ee", floor2:"#e4f0dc", wall:"#b8d8a0", wallTop:"#c8e8b0", accent:"#d0e8a0", soft:"#e0f8d0" }, // courtyard · soft green
    { floor:"#fdf2ec", floor2:"#fae8e0", wall:"#e0c8a0", wallTop:"#f0d8b0", accent:"#f0c880", soft:"#ffe0cc" }, // bell tower · warm peach
    { floor:"#faf4f8", floor2:"#f2e8f4", wall:"#d0b8e0", wallTop:"#e0c8f0", accent:"#e0b0f0", soft:"#f0d8f8" }  // sanctuary · soft lavender
  ];

  var BOMB_FUSE = 2.0, BLAST_LIFE = 0.5;     // 圣泡引信 / 爆光存续(秒)
  var PLAYER_BASE = 4.4;                       // 牧师基础速度(cells/sec)
  var START_BOMBS = 1, START_RANGE = 2;        // 初始同时圣泡数 / 爆光范围
  var DEATH_MS = 1600, CLEAR_MS = 1900, INTRO_MS = 1500, VICTORY_MS = 2600;
  var RAD = 0.34;                              // 实体碰撞半径(格)

  var DIFFS = {
    gentle: { id:"gentle", name:"Gentle", blurb:"Slow and forgiving", impSpeed:0.62, impCount:0.6, crate:0.52 },
    normal: { id:"normal", name:"Normal", blurb:"A steady stroll",     impSpeed:0.80, impCount:1.0, crate:0.66 },
    brave:  { id:"brave",  name:"Brave",  blurb:"Quick and crowded",   impSpeed:1.0,  impCount:1.4, crate:0.78 }
  };
  var DIFF_IDS = ["gentle","normal","brave"];
  function diff(d){ return DIFFS[d] || DIFFS.normal; }

  var DIRS = [{x:1,y:0},{x:-1,y:0},{x:0,y:1},{x:0,y:-1}];

  function roomPlan(idx, d){
    var dd = diff(d);
    return {
      crates:   dd.crate,                                  // 占内部空格比例
      imps:     Math.max(2, Math.round((2 + idx*1.4) * dd.impCount)),
      powerups: Math.min(6, 2 + Math.floor(idx/1.5)),
      impSpeed: PLAYER_BASE * 0.60 * dd.impSpeed
    };
  }

  function key(x,y){ return x + "," + y; }
  function inB(x,y){ return x>=0 && y>=0 && x<COLS && y<ROWS; }
  function md(a,b){ return Math.abs(a.x-b.x)+Math.abs(a.y-b.y); }
  var approach = function(v,t,s){ return v<t ? Math.min(v+s,t) : Math.max(v-s,t); };
  // 碰到墙/箱即硬卡到位，不渐进靠近——彻底消除边界微颤
  function clampAxis(v, lo, hi){ return Math.max(lo, Math.min(v, hi)); }

  function shuffle(a){ for(var i=a.length-1;i>0;i--){ var j=(Math.random()*(i+1))|0; var t=a[i];a[i]=a[j];a[j]=t; } return a; }

  function create(savedDiff){
    return { mode:"menu", diff: diff(savedDiff).id, best:0,
             player:null, room:0, theme:ROOM_THEME[0], roomName:ROOM_NAMES[0],
             solid:[], crates:{}, bombs:[], blasts:[], imps:[], powerups:[], cratePow:{},
             fx:[], sounds:[], introT:0, clearT:0, deadT:0, victoryT:0, msg:"" };
  }

  function setDifficulty(st,d){ if(DIFFS[d]) st.diff = d; }

  /* 生成一间房。fresh=true 重置牧师属性(从菜单开局 / 全新);否则保留已得道具(过关 / 重试) */
  function newRoom(st, idx, fresh){
    st.room = idx;
    var d = diff(st.diff), plan = roomPlan(idx, d);

    // 静态实心格:边框 + 偶数交叉柱(经典泡泡堂棋盘)
    var solid = new Array(COLS*ROWS);
    for (var y=0;y<ROWS;y++) for (var x=0;x<COLS;x++)
      solid[y*COLS+x] = (x===0||y===0||x===COLS-1||y===ROWS-1) || (x%2===0 && y%2===0);
    st.solid = solid;

    // 可用空格(非实心、且远离牧师出生 3×3 角)
    var free = [];
    for (var y2=1;y2<ROWS-1;y2++) for (var x2=1;x2<COLS-1;x2++)
      if (!solid[y2*COLS+x2] && !(x2<3 && y2<3)) free.push({x:x2,y:y2});

    // 木箱(可炸碎):占内部空格的一部分,留出行走走廊(柱子已保证)
    shuffle(free);
    st.crates = {}; st.cratePow = {};
    var freeCells = free.length;
    var nCrates = Math.round(freeCells * plan.crates);
    for (var i=0;i<nCrates;i++) st.crates[key(free[i].x, free[i].y)] = true;

    // 道具藏在部分木箱下
    var types = ["bomb","range","speed","shield","bomb","range"];
    for (var k=0;k<plan.powerups && k<nCrates;k++)
      st.cratePow[key(free[k].x, free[k].y)] = types[k % types.length];

    // 小捣蛋鬼:随机空格、离牧师够远
    var open = free.slice(nCrates);
    shuffle(open);
    st.imps = [];
    for (var j=0;j<open.length && st.imps.length<plan.imps;j++){
      var c = open[j];
      if (md(c,{x:1,y:1}) < 4) continue;
      st.imps.push({ x:c.x+0.5, y:c.y+0.5, dir:{x:1,y:0}, speed:plan.impSpeed,
                       dead:false, spin:0, deadT:0, wob:Math.random()*6.28,
                       bob:0, squash:1, facing:1 });
    }

    st.powerups = []; st.bombs = []; st.blasts = []; st.fx = []; st.sounds = [];

    if (fresh || !st.player)
      st.player = { x:1.5, y:1.5, dir:{x:0,y:0}, bombs:START_BOMBS, range:START_RANGE, speedMul:1, shieldT:0, dead:false, deadT:0,
                     bob:0, squash:1, facing:1 };
    else { var p=st.player; p.x=1.5; p.y=1.5; p.dir={x:0,y:0}; p.dead=false; p.deadT=0; p.bob=0; p.squash=1; }

    st.theme = ROOM_THEME[idx]; st.roomName = ROOM_NAMES[idx];
    st.mode = "intro"; st.introT=0; st.clearT=0; st.deadT=0; st.victoryT=0; st.msg="";
    return st;
  }

  function startGame(st){ newRoom(st, 0, true); }

  function solidAt(st,x,y){ return !inB(x,y) || st.solid[y*COLS+x]; }
  function crateAt(st,x,y){ return st.crates[key(x,y)] === true; }
  function bombAt(st,x,y){ for (var i=0;i<st.bombs.length;i++) if(st.bombs[i].x===x&&st.bombs[i].y===y) return st.bombs[i]; return null; }
  function cellOf(e){ return { x:Math.floor(e.x), y:Math.floor(e.y) }; }

  // 牧师可进入(点判定):实心/木箱不行;自己刚放下的圣泡可走出
  function playerEnter(st,x,y){
    var cx=Math.floor(x), cy=Math.floor(y);
    if (solidAt(st,cx,cy) || crateAt(st,cx,cy)) return false;
    var b = bombAt(st,cx,cy);
    if (b && !b.playerLeft) return false;
    return true;
  }
  // 小鬼可进入:避开实心/木箱/圣泡
  function impEnter(st,x,y){
    var cx=Math.floor(x), cy=Math.floor(y);
    if (solidAt(st,cx,cy) || crateAt(st,cx,cy)) return false;
    if (bombAt(st,cx,cy)) return false;
    return true;
  }

  // 沿单轴移动 + 交叉轴吸附(转角顺滑)。canEnter(st,x,y) 用中心点判定。
  // 被挡住时不弹跳 — 温柔地停在边界上，沿墙滑行。
  function moveAxis(st, e, dir, sp, dt, canEnter){
    var step = sp*dt;
    if (dir.x !== 0){
      var ty = Math.round(e.y-0.5)+0.5;
      e.y = approach(e.y, ty, step);
      var nx = e.x + dir.x*step;
      if (canEnter(st, nx, e.y)){ e.x = nx; }
      else {
        // 被挡住时硬卡到边界，不渐进——彻底消除抖动
        var wall = dir.x>0 ? Math.floor(nx+0.49)-RAD : Math.floor(nx+0.49)+1+RAD;
        e.x = wall;
      }
    } else if (dir.y !== 0){
      var tx = Math.round(e.x-0.5)+0.5;
      e.x = approach(e.x, tx, step);
      var ny = e.y + dir.y*step;
      if (canEnter(st, e.x, ny)){ e.y = ny; }
      else {
        // 被挡住时硬卡到边界，不渐进——彻底消除抖动
        var wall = dir.y>0 ? Math.floor(ny+0.49)-RAD : Math.floor(ny+0.49)+1+RAD;
        e.y = wall;
      }
    }
  }

  function setDir(st, dx, dy){
    if (st.mode !== "play") return;
    if (dx !== 0) st.player.dir = { x: dx>0?1:-1, y:0 };
    else if (dy !== 0) st.player.dir = { x:0, y: dy>0?1:-1 };
  }

  function placeBubble(st){
    if (st.mode !== "play") return;
    var p = st.player, c = cellOf(p);
    if (st.bombs.length >= p.bombs) return;
    if (solidAt(st,c.x,c.y) || crateAt(st,c.x,c.y) || bombAt(st,c.x,c.y)) return;
    st.bombs.push({ x:c.x, y:c.y, timer:BOMB_FUSE, range:p.range, playerLeft:false });
    st.sounds.push("place");
  }

  function destroyCrate(st, x, y){
    delete st.crates[key(x,y)];
    var t = st.cratePow[key(x,y)];
    if (t){ delete st.cratePow[key(x,y)]; st.powerups.push({ x:x, y:y, type:t, bob:Math.random()*6.28 }); }
  }

  function explode(st, bomb){
    var i = st.bombs.indexOf(bomb);
    if (i < 0) return;
    st.bombs.splice(i,1);
    var cells = [{ x:bomb.x, y:bomb.y }];
    for (var d=0; d<4; d++){
      var dx=DIRS[d].x, dy=DIRS[d].y;
      for (var r=1; r<=bomb.range; r++){
        var cx=bomb.x+dx*r, cy=bomb.y+dy*r;
        if (solidAt(st,cx,cy)) break;
        cells.push({ x:cx, y:cy });
        if (crateAt(st,cx,cy)){ destroyCrate(st,cx,cy); break; }
        var ob = bombAt(st,cx,cy);
        if (ob){ ob.timer = -1; break; }   // 连锁引爆,爆光止步于该圣泡
      }
    }
    st.blasts.push({ cells:cells, life:BLAST_LIFE, max:BLAST_LIFE });
    st.sounds.push("pop");
  }

  function lethalSet(st){
    var s = {};
    for (var i=0;i<st.blasts.length;i++){
      var cs = st.blasts[i].cells;
      for (var j=0;j<cs.length;j++) s[key(cs[j].x, cs[j].y)] = true;
    }
    return s;
  }

  function die(st){
    var p = st.player;
    p.dead = true; p.deadT = 0;
    st.mode = "dead"; st.deadT = 0; st.msg = "Oops! The imp got you.";
    st.sounds.push("die");
  }

  function applyPowerup(st, pu){
    var p = st.player;
    if (pu.type === "bomb")  p.bombs = Math.min(6, p.bombs+1);
    if (pu.type === "range") p.range = Math.min(7, p.range+1);
    if (pu.type === "speed") p.speedMul = Math.min(1.9, p.speedMul+0.12);
    if (pu.type === "shield")p.shieldT = Math.max(p.shieldT, 6);
    st.sounds.push("chime");
  }

  function validDirs(st, cx, cy, cur){
    var out = [];
    for (var i=0;i<4;i++){
      var d = DIRS[i], nx=cx+d.x, ny=cy+d.y;
      if (!impEnter(st, nx+0.5, ny+0.5)) continue;
      if (cur && d.x===-cur.x && d.y===-cur.y) continue; // 不立即掉头(死路除外)
      out.push(d);
    }
    if (out.length === 0 && cur){ // 死路才掉头
      var bx=cx-cur.x, by=cy-cur.y;
      if (impEnter(st, bx+0.5, by+0.5)) out.push({x:-cur.x,y:-cur.y});
    }
    return out;
  }

  function impStep(st, imp, dt){
    if (imp.dead) return;
    var cx = Math.floor(imp.x), cy = Math.floor(imp.y);
    var aheadX = imp.x + imp.dir.x*0.55, aheadY = imp.y + imp.dir.y*0.55;
    var blocked = !impEnter(st, aheadX, aheadY);
    var nearCenter = Math.abs(imp.x-(cx+0.5))<0.14 && Math.abs(imp.y-(cy+0.5))<0.14;
    if (blocked || (nearCenter && Math.random()<0.05)){
      var opts = validDirs(st, cx, cy, imp.dir);
      if (opts.length){
        var nd;
        if (Math.random() < 0.4){            // 偶尔朝牧师挪(不太聪明,保持轻松)
          opts.sort(function(a,b){ return md({x:cx+a.x,y:cy+a.y}, cellOf(st.player)) - md({x:cx+b.x,y:cy+b.y}, cellOf(st.player)); });
          nd = opts[0];
        } else nd = opts[(Math.random()*opts.length)|0];
        imp.dir = nd;
      }
    }
    moveAxis(st, imp, imp.dir, imp.speed, dt, impEnter);
  }

  function update(st, dtRaw){
    var dt = Math.min(dtRaw, 0.05);          // 防止卡顿穿墙
    var i, p = st.player;

    if (st.mode === "intro"){ st.introT += dt; if (st.introT >= INTRO_MS/1000) st.mode = "play"; return; }
    if (st.mode === "clear"){ st.clearT += dt; if (st.clearT >= CLEAR_MS/1000) advance(st); return; }
    if (st.mode === "dead"){ st.deadT += dt; if (p) p.deadT += dt; if (st.deadT >= DEATH_MS/1000) advance(st); return; }
    if (st.mode === "victory"){ st.victoryT += dt; return; }   // 等玩家点
    if (st.mode !== "play") return;

    if (p.shieldT > 0) p.shieldT = Math.max(0, p.shieldT - dt);

    // 牧师移动
    if (p.dir.x || p.dir.y) moveAxis(st, p, p.dir, PLAYER_BASE * p.speedMul, dt, playerEnter);
    for (i=0;i<st.bombs.length;i++){ var b=st.bombs[i]; if(!b.playerLeft){ var pc=cellOf(p); if(!(pc.x===b.x&&pc.y===b.y)) b.playerLeft=true; } }

    // 圣泡引信
    for (i=0;i<st.bombs.length;i++) st.bombs[i].timer -= dt;
    var guard=0;
    while (guard++ < 64){
      var due = null;
      for (i=0;i<st.bombs.length;i++) if (st.bombs[i].timer <= 0){ due = st.bombs[i]; break; }
      if (!due) break;
      explode(st, due);
    }

    // 爆光存续
    for (i=st.blasts.length-1;i>=0;i--){ st.blasts[i].life -= dt; if (st.blasts[i].life <= 0) st.blasts.splice(i,1); }

    // 小鬼移动
    for (i=0;i<st.imps.length;i++) impStep(st, st.imps[i], dt);

    // 致死判定:爆光优先(若同归于尽算死)
    var lethal = lethalSet(st);
    var pc = cellOf(p);
    if (p.shieldT<=0 && lethal[key(pc.x,pc.y)]){ die(st); return; }
    for (i=st.imps.length-1;i>=0;i--){
      var im = st.imps[i];
      if (im.dead) continue;
      var ic = cellOf(im);
      if (lethal[key(ic.x,ic.y)]){
        im.dead = true; im.deadT = 0; im.spin = (Math.random()*2-1)*8;
        st.fx.push({ type:"spin", x:im.x, y:im.y, t:0, spin:im.spin });
        st.sounds.push("bless");
      }
    }
    // 小鬼贴身抓人
    if (p.shieldT<=0 && !p.dead){
      for (i=0;i<st.imps.length;i++){ var g=st.imps[i]; if(!g.dead && md(g,p) < 0.72){ die(st); return; } }
    }

    // 道具拾取
    for (i=st.powerups.length-1;i>=0;i--){
      var pu = st.powerups[i];
      if (cellOf(p).x===pu.x && cellOf(p).y===pu.y){ applyPowerup(st, pu); st.powerups.splice(i,1); }
    }

    // 特效计时
    for (i=st.fx.length-1;i>=0;i--){ st.fx[i].t += dt; if (st.fx[i].t > 0.7) st.fx.splice(i,1); }

    // 过关:清光小鬼
    var alive = 0; for (i=0;i<st.imps.length;i++) if(!st.imps[i].dead) alive++;
    if (alive === 0){ st.mode = "clear"; st.clearT = 0; st.sounds.push(st.room===N_ROOMS-1 ? "win" : "clear"); }
  }

  /* 交互推进:menu→开局;intro→玩;clear→下一间/通关;dead→重试本间;victory→回菜单 */
  function advance(st){
    if (st.mode === "menu"){ startGame(st); return; }
    if (st.mode === "intro"){ st.mode = "play"; return; }
    if (st.mode === "clear"){
      if (st.room + 1 < N_ROOMS) newRoom(st, st.room+1, false);
      else { st.mode = "victory"; st.victoryT = 0; }
      return;
    }
    if (st.mode === "dead"){ newRoom(st, st.room, false); return; }   // 保留已得道具,更友好
    if (st.mode === "victory"){ st.mode = "menu"; st.player = null; return; }
  }

  return {
    COLS:COLS, ROWS:ROWS, N_ROOMS:N_ROOMS, ROOM_NAMES:ROOM_NAMES, ROOM_THEME:ROOM_THEME,
    DIFFS:DIFFS, DIFF_IDS:DIFF_IDS, DIRS:DIRS,
    DEATH_MS:DEATH_MS, CLEAR_MS:CLEAR_MS, INTRO_MS:INTRO_MS, VICTORY_MS:VICTORY_MS,
    BOMB_FUSE:BOMB_FUSE, BLAST_LIFE:BLAST_LIFE, START_BOMBS:START_BOMBS, START_RANGE:START_RANGE,
    create:create, setDifficulty:setDifficulty, startGame:startGame, newRoom:newRoom,
    setDir:setDir, placeBubble:placeBubble, update:update, advance:advance,
    cellOf:cellOf, solidAt:solidAt, crateAt:crateAt, bombAt:bombAt,
    playerEnter:playerEnter, impEnter:impEnter, lethalSet:lethalSet
  };
})();

if (typeof module !== "undefined") module.exports = Core;
