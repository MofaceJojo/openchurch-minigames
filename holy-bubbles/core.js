/* Holy Bubbles · 纯逻辑层（零 DOM、零渲染，网页/微信小游戏共用）
   规则对标 QQ堂 / Crazy Arcade：
   - 11×11 格子，牧师贴格子移动（上下左右）
   - 空格/按钮放圣泡 → 2s 引信 → 十字圣光爆炸（实心墙挡光、木箱挡光并炸毁、圣泡连锁引爆）
   - 爆炸波及小鬼 → 小鬼「被困」（鼓包挣扎 3s）→ 牧师走近相邻格 + 空格/点按「戳破」→ 小鬼净化飞升
   - 小鬼 3s 自挣脱 → 愤怒加速（×1.5，5s）
   - 道具：圣泡数+1、射程+1、移速+12%、护佑盾(6s)、灵巧步(取消滑格)
   - 5 间房，每房 2-3 波，清完过关
*/

"use strict";

var Core = (function () {
  // ========== 常量 ==========
  var COLS = 11, ROWS = 11, N_ROOMS = 5;
  var CELL = 1;                 // 逻辑单位：1 格 = 1
  var PLAYER_SPEED = 5.5;       // 格/秒（贴格子移动）
  var IMP_BASE_SPEED = 3.2;     // 小鬼基础速度
  var BOMB_FUSE = 2.0;          // 圣泡引信（秒）
  var BLAST_LIFE = 0.45;        // 爆炸十字存续（秒）
  var TRAP_TIME = 3.0;          // 被困时长（秒）
  var RAGE_TIME = 5.0;          // 愤怒时长（秒）
  var RAGE_MUL = 1.5;           // 愤怒速度倍率
  var SHIELD_TIME = 6.0;        // 护盾时长（秒）
  var INTRO_MS = 1200, CLEAR_MS = 1500, DEAD_MS = 1400, VICTORY_MS = 2200;

  // 房间名与配色（明亮暖色，泡泡堂糖果风）
  var ROOM_NAMES = [
    "The Chapel", "The Cloister", "The Courtyard", "The Bell Tower", "The Holy Sanctuary"
  ];
  var ROOM_THEME = [
    { floor:"#fdf6ee", floor2:"#faf0e0", wall:"#e8cfa0", wallTop:"#f0ddc0", accent:"#f5d89a", soft:"#ffe8cc" },
    { floor:"#f0f4f8", floor2:"#e8eef4", wall:"#c0d0e0", wallTop:"#d0e0f0", accent:"#a8c8e8", soft:"#d8e8f8" },
    { floor:"#f0f8ee", floor2:"#e4f0dc", wall:"#b8d8a0", wallTop:"#c8e8b0", accent:"#d0e8a0", soft:"#e0f8d0" },
    { floor:"#fdf2ec", floor2:"#fae8e0", wall:"#e0c8a0", wallTop:"#f0d8b0", accent:"#f0c880", soft:"#ffe0cc" },
    { floor:"#faf4f8", floor2:"#f2e8f4", wall:"#d0b8e0", wallTop:"#e0c8f0", accent:"#e0b0f0", soft:"#f0d8f8" }
  ];

  // 难度
  var DIFFS = {
    gentle: { id:"gentle", name:"Gentle", blurb:"Slow and forgiving", impSpeedMul:0.65, impCountMul:0.6, crateMul:0.55 },
    normal: { id:"normal", name:"Normal", blurb:"A steady stroll",     impSpeedMul:0.85, impCountMul:1.0, crateMul:0.7 },
    brave:  { id:"brave",  name:"Brave",  blurb:"Quick and crowded",   impSpeedMul:1.1,  impCountMul:1.35, crateMul:0.85 }
  };
  var DIFF_IDS = ["gentle","normal","brave"];
  function diff(d){ return DIFFS[d] || DIFFS.normal; }

  // 四向
  var DIRS = [{x:1,y:0},{x:-1,y:0},{x:0,y:1},{x:0,y:-1}];
  function key(x,y){ return x + "," + y; }
  function inB(x,y){ return x>=0 && y>=0 && x<COLS && y<ROWS; }
  function md(a,b){ return Math.abs(a.x-b.x)+Math.abs(a.y-b.y); }
  var approach = function(v,t,s){ return v<t ? Math.min(v+s,t) : Math.max(v-s,t); };

  // 随机种子（关卡确定性）
  function rng(seed){
    var s = seed >>> 0 || 1;
    return function(){
      s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0;
      return s / 4294967296;
    };
  }
  function shuffle(a, R){
    for(var i=a.length-1;i>0;i--){ var j=(R()*(i+1))|0; var t=a[i];a[i]=a[j];a[j]=t; }
    return a;
  }

  // ========== 房间生成 ==========
  function roomPlan(idx, d){
    var dd = diff(d);
    var waveCount = 2 + (idx >= 3 ? 1 : 0);          // 后两房 3 波
    return {
      crates:   Math.round(28 * dd.crateMul),        // 木箱数
      imps:     Math.max(2, Math.round((2 + idx*1.2) * dd.impCountMul)), // 小鬼数
      powerups: Math.min(6, 2 + Math.floor(idx/1.2)),
      impSpeed: IMP_BASE_SPEED * dd.impSpeedMul,
      waves:    waveCount
    };
  }

  function create(savedDiff){
    return {
      mode:"menu", diff: diff(savedDiff).id, best:0,
      player:null, room:0, theme:ROOM_THEME[0], roomName:ROOM_NAMES[0],
      solid:[], crates:{}, bombs:[], blasts:[], imps:[], powerups:[], cratePow:{},
      fx:[], sounds:[], introT:0, clearT:0, deadT:0, victoryT:0, msg:"",
      wave:0, waveTimer:0, waveDelay:1.8,
      inputDir:{x:0,y:0}, lastInputDir:{x:0,y:0}
    };
  }
  function setDifficulty(st,d){ if(DIFFS[d]) st.diff = d; }

  function newRoom(st, idx, fresh){
    st.room = idx;
    var d = diff(st.diff), plan = roomPlan(idx, d);
    var R = rng((idx+1)*9973 + 13);

    // 实心格：边框 + 交叉柱（经典 11×11 棋盘）
    var solid = new Array(COLS*ROWS);
    for(var y=0;y<ROWS;y++) for(var x=0;x<COLS;x++)
      solid[y*COLS+x] = (x===0||y===0||x===COLS-1||y===ROWS-1) || (x%2===0 && y%2===0);
    st.solid = solid;

    // 可用空格（非实心、远离出生点 3×3）
    var free = [];
    for(var y2=1;y2<ROWS-1;y2++) for(var x2=1;x2<COLS-1;x2++)
      if(!solid[y2*COLS+x2] && !(x2<3 && y2<3)) free.push({x:x2,y:y2});

    // 木箱
    shuffle(free, R);
    st.crates = {}; st.cratePow = {};
    var nCrates = Math.min(plan.crates, free.length);
    for(var i=0;i<nCrates;i++) st.crates[key(free[i].x, free[i].y)] = true;

    // 道具藏在部分木箱下
    var types = ["bomb","range","speed","shield","nimble","bomb","range"];
    for(var k=0;k<plan.powerups && k<nCrates;k++)
      st.cratePow[key(free[k].x, free[k].y)] = types[k % types.length];

    // 小鬼分波生成：第一波一半，后续波补齐
    st.imps = [];
    var open = free.slice(nCrates);
    shuffle(open, R);
    var totalImps = plan.imps;
    var perWave = Math.ceil(totalImps / plan.waves);
    st.wave = 0;
    st.waveTimer = 0;
    st.waveDelay = 1.8;
    st.plan = plan;
    st.openSlots = open; // 留作后续波生成

    spawnWave(st, 0);

    st.powerups = []; st.bombs = []; st.blasts = []; st.fx = []; st.sounds = [];

    if(fresh || !st.player)
      st.player = { x:1.5, y:1.5, tx:1.5, ty:1.5, moving:false,
                    dir:{x:0,y:0}, nextDir:{x:0,y:0},
                    bombs:1, range:2, speedMul:1, shieldT:0, nimble:false,
                    dead:false, deadT:0, bob:0, squash:1, facing:1 };
    else {
      var p=st.player;
      p.x=1.5; p.y=1.5; p.tx=1.5; p.ty=1.5; p.moving=false;
      p.dir={x:0,y:0}; p.nextDir={x:0,y:0};
      p.dead=false; p.deadT=0; p.bob=0; p.squash=1;
    }

    st.theme = ROOM_THEME[idx]; st.roomName = ROOM_NAMES[idx];
    st.mode = "intro"; st.introT=0; st.clearT=0; st.deadT=0; st.victoryT=0; st.msg="";
    return st;
  }

  function spawnWave(st, waveIdx){
    var plan = st.plan, open = st.openSlots;
    var perWave = Math.ceil(plan.imps / plan.waves);
    var start = waveIdx * perWave;
    var end = Math.min(start + perWave, plan.imps);
    for(var j=start;j<end && j<open.length;j++){
      var c = open[j];
      if(md(c,{x:1,y:1}) < 4) continue;
      st.imps.push({
        x:c.x+0.5, y:c.y+0.5, tx:c.x+0.5, ty:c.y+0.5, moving:false,
        dir:{x:1,y:0}, nextDir:{x:1,y:0},
        speed:plan.impSpeed,
        state:"roam",       // roam / chase / trapped / rage
        trappedT:0, rageT:0,
        target:null,
        dead:false, deadT:0, spin:0,
        bob:0, squash:1, facing:1
      });
    }
  }

  function startGame(st){ newRoom(st, 0, true); }

  // ========== 碰撞查询 ==========
  function solidAt(st,x,y){ return !inB(x,y) || st.solid[y*COLS+x]; }
  function crateAt(st,x,y){ return st.crates[key(x,y)] === true; }
  function bombAt(st,x,y){
    for(var i=0;i<st.bombs.length;i++) if(st.bombs[i].x===x && st.bombs[i].y===y) return st.bombs[i];
    return null;
  }
  function powerupAt(st,x,y){
    for(var i=0;i<st.powerups.length;i++) if(st.powerups[i].x===x && st.powerups[i].y===y) return i;
    return -1;
  }
  function cellOf(e){ return { x:Math.floor(e.x), y:Math.floor(e.y) }; }

  // 牧师可进入：非实心、非木箱、非未离开的圣泡
  function playerEnter(st,x,y){
    var cx=Math.floor(x), cy=Math.floor(y);
    if(solidAt(st,cx,cy) || crateAt(st,cx,cy)) return false;
    var b = bombAt(st,cx,cy);
    if(b && !b.playerLeft) return false;
    return true;
  }
  // 小鬼可进入：非实心、非木箱、非圣泡
  function impEnter(st,x,y){
    var cx=Math.floor(x), cy=Math.floor(y);
    if(solidAt(st,cx,cy) || crateAt(st,cx,cy)) return false;
    if(bombAt(st,cx,cy)) return false;
    return true;
  }
  // 爆炸光可穿透：实心墙挡、木箱挡并炸毁、圣泡引爆并止步
  function blastPass(st,cx,cy){
    if(solidAt(st,cx,cy)) return "wall";
    if(crateAt(st,cx,cy)) return "crate";
    if(bombAt(st,cx,cy)) return "bomb";
    return "free";
  }

  // ========== 移动系统（贴格子、中心点锁定） ==========
  // 牧师：按住方向 → 目标格子中心 → 到达后再读取 nextDir
  function tryStartMove(st, e, dir){
    var cx=Math.floor(e.x), cy=Math.floor(e.y);
    var nx=cx+dir.x, ny=cy+dir.y;
    if(playerEnter(st, nx+0.5, ny+0.5)){
      e.tx = nx+0.5; e.ty = ny+0.5; e.moving = true; e.dir = {x:dir.x,y:dir.y};
      return true;
    }
    return false;
  }

  function updateMove(e, sp, dt){
    if(!e.moving) return;
    var step = sp * dt;
    var dx = e.tx - e.x, dy = e.ty - e.y;
    var dist = Math.sqrt(dx*dx + dy*dy);
    if(dist <= step){
      e.x = e.tx; e.y = e.ty; e.moving = false;
    }else{
      e.x += dx/dist * step;
      e.y += dy/dist * step;
    }
  }

  // 小鬼 AI：巡逻/追击/愤怒 → 贴格子移动
  function impPickDir(st, imp){
    var cx=Math.floor(imp.x), cy=Math.floor(imp.y);
    var opts = [];
    for(var i=0;i<4;i++){
      var d=DIRS[i], nx=cx+d.x, ny=cy+d.y;
      if(!impEnter(st, nx+0.5, ny+0.5)) continue;
      if(imp.dir.x===-d.x && imp.dir.y===-d.y) continue; // 不立即掉头
      opts.push(d);
    }
    if(opts.length===0 && imp.dir){
      // 死路才允许掉头
      var bx=cx-imp.dir.x, by=cy-imp.dir.y;
      if(impEnter(st, bx+0.5, by+0.5)) opts.push({x:-imp.dir.x,y:-imp.dir.y});
    }
    return opts;
  }

  function impAI(st, imp, dt){
    if(imp.dead || imp.state==="trapped") return;
    var cx=Math.floor(imp.x), cy=Math.floor(imp.y);
    var p = st.player;

    // 愤怒倒计时
    if(imp.state==="rage"){
      imp.rageT -= dt;
      if(imp.rageT <= 0) imp.state = "roam";
    }

    // 追击判定：视野内（曼哈顿 ≤ 6）且无墙阻挡
    var chase = false;
    if(imp.state!=="rage" && md({x:cx,y:cy}, cellOf(p)) <= 6){
      // 简单视线检查：同行/同列且中间无实心墙
      if(cx===Math.floor(p.x)){
        var blocked=false, dy=Math.floor(p.y)>cy?1:-1;
        for(var y=cy+dy; y!==Math.floor(p.y); y+=dy)
          if(solidAt(st,cx,y)){ blocked=true; break; }
        if(!blocked) chase=true;
      }else if(cy===Math.floor(p.y)){
        var blocked=false, dx=Math.floor(p.x)>cx?1:-1;
        for(var x=cx+dx; x!==Math.floor(p.x); x+=dx)
          if(solidAt(st,x,cy)){ blocked=true; break; }
        if(!blocked) chase=true;
      }
    }

    if(chase) imp.state = "chase";

    // 选择方向
    var opts = impPickDir(st, imp);
    if(opts.length){
      var nd;
      if(imp.state==="chase" && Math.random()<0.7){
        // 朝玩家方向优先
        opts.sort(function(a,b){
          var da=md({x:cx+a.x,y:cy+a.y}, cellOf(p));
          var db=md({x:cx+b.x,y:cy+b.y}, cellOf(p));
          return da-db;
        });
        nd = opts[0];
      }else{
        nd = opts[(Math.random()*opts.length)|0];
      }
      imp.nextDir = nd;
    }

    // 到达格子中心时应用 nextDir
    if(!imp.moving && imp.nextDir){
      var nx=cx+imp.nextDir.x, ny=cy+imp.nextDir.y;
      if(impEnter(st, nx+0.5, ny+0.5)){
        imp.tx = nx+0.5; imp.ty = ny+0.5; imp.moving = true; imp.dir = imp.nextDir;
      }
      imp.nextDir = null;
    }

    // 移动速度
    var sp = imp.speed * (imp.state==="rage" ? RAGE_MUL : 1);
    updateMove(imp, sp, dt);
  }

  // ========== 圣泡/爆炸 ==========
  function placeBomb(st){
    if(st.mode!=="play") return;
    var p = st.player;
    var cx=Math.floor(p.x), cy=Math.floor(p.y);
    if(st.bombs.length >= p.bombs) return;
    if(solidAt(st,cx,cy) || crateAt(st,cx,cy) || bombAt(st,cx,cy)) return;
    st.bombs.push({ x:cx, y:cy, timer:BOMB_FUSE, range:p.range, playerLeft:false });
    st.sounds.push("place");
  }

  function destroyCrate(st, x, y){
    delete st.crates[key(x,y)];
    var t = st.cratePow[key(x,y)];
    if(t){ delete st.cratePow[key(x,y)]; st.powerups.push({ x:x, y:y, type:t, bob:Math.random()*6.28 }); }
  }

  function explode(st, bomb){
    var i = st.bombs.indexOf(bomb);
    if(i<0) return;
    st.bombs.splice(i,1);
    var cells = [{x:bomb.x, y:bomb.y}]; // 中心格
    // 四向射程
    for(var d=0; d<4; d++){
      var dx=DIRS[d].x, dy=DIRS[d].y;
      for(var r=1; r<=bomb.range; r++){
        var cx=bomb.x+dx*r, cy=bomb.y+dy*r;
        var pass = blastPass(st,cx,cy);
        cells.push({x:cx, y:cy, pass:pass});
        if(pass==="wall") break;
        if(pass==="crate"){ destroyCrate(st,cx,cy); break; }
        if(pass==="bomb"){
          var ob = bombAt(st,cx,cy);
          if(ob){ ob.timer = -1; } // 连锁引爆
          break;
        }
      }
    }
    st.blasts.push({ cells:cells, life:BLAST_LIFE, max:BLAST_LIFE });
    st.sounds.push("pop");
  }

  // 致死集合（爆炸光格子）
  function lethalSet(st){
    var s = {};
    for(var i=0;i<st.blasts.length;i++){
      var cs = st.blasts[i].cells;
      for(var j=0;j<cs.length;j++){
        if(cs[j].pass!=="wall") s[key(cs[j].x, cs[j].y)] = true;
      }
    }
    return s;
  }

  function die(st){
    var p = st.player;
    p.dead = true; p.deadT = 0;
    st.mode = "dead"; st.deadT = 0; st.msg = "Oops! The imp got you.";
    st.sounds.push("die");
  }

  // 道具效果
  function applyPowerup(st, pu){
    var p = st.player;
    if(pu.type==="bomb")      p.bombs = Math.min(6, p.bombs+1);
    else if(pu.type==="range") p.range = Math.min(7, p.range+1);
    else if(pu.type==="speed") p.speedMul = Math.min(1.9, p.speedMul+0.12);
    else if(pu.type==="shield") p.shieldT = Math.max(p.shieldT, SHIELD_TIME);
    else if(pu.type==="nimble") p.nimble = true;
    st.sounds.push("chime");
  }

  // 戳破被困小鬼（赦免/净化）
  function tryPokeTrapped(st){
    if(st.mode!=="play") return;
    var p = st.player, pc = cellOf(p);
    for(var i=0;i<st.imps.length;i++){
      var im = st.imps[i];
      if(im.dead || im.state!=="trapped") continue;
      var ic = cellOf(im);
      if(md(pc, ic) === 1){ // 相邻格
        im.dead = true; im.deadT = 0; im.state = "ascend";
        st.fx.push({ type:"absolve", x:im.x, y:im.y, t:0, dur:1.2 });
        st.sounds.push("absolve");
        // 检查过关
        var alive=0; for(var k=0;k<st.imps.length;k++) if(!st.imps[k].dead && st.imps[k].state!=="ascend") alive++;
        if(alive===0){
          st.mode = "clear"; st.clearT = 0;
          st.sounds.push(st.room===N_ROOMS-1 ? "win" : "clear");
        }
        return;
      }
    }
  }

  // ========== 主更新 ==========
  function update(st, dtRaw){
    var dt = Math.min(dtRaw, 0.05); // 防卡顿穿墙
    var p = st.player;

    // 状态机
    if(st.mode==="intro"){ st.introT += dt; if(st.introT >= INTRO_MS/1000){ st.mode="play"; } return; }
    if(st.mode==="clear"){ st.clearT += dt; if(st.clearT >= CLEAR_MS/1000){ advance(st); } return; }
    if(st.mode==="dead"){ st.deadT += dt; p.deadT += dt; if(st.deadT >= DEAD_MS/1000){ advance(st); } return; }
    if(st.mode==="victory"){ st.victoryT += dt; return; }
    if(st.mode!=="play") return;

    // 护盾倒计时
    if(p.shieldT>0) p.shieldT = Math.max(0, p.shieldT - dt);

    // 玩家输入 → 目标方向
    if(st.inputDir.x!==0 || st.inputDir.y!==0){
      if(!p.moving){
        tryStartMove(st, p, st.inputDir);
      }else{
        p.nextDir = st.inputDir;
      }
    }
    // 到达中心后自动应用 nextDir
    if(!p.moving && (p.nextDir.x!==0 || p.nextDir.y!==0)){
      tryStartMove(st, p, p.nextDir);
      p.nextDir = {x:0,y:0};
    }
    updateMove(p, PLAYER_SPEED * p.speedMul, dt);

    // 圣泡玩家离开标记
    for(var i=0;i<st.bombs.length;i++){
      var b=st.bombs[i];
      if(!b.playerLeft){
        var pc=cellOf(p);
        if(!(pc.x===b.x && pc.y===b.y)) b.playerLeft=true;
      }
    }

    // 圣泡引信
    for(i=0;i<st.bombs.length;i++) st.bombs[i].timer -= dt;
    var guard=0;
    while(guard++ < 32){
      var due=null;
      for(i=0;i<st.bombs.length;i++) if(st.bombs[i].timer <= 0){ due=st.bombs[i]; break; }
      if(!due) break;
      explode(st, due);
    }

    // 爆炸存续
    for(i=st.blasts.length-1;i>=0;i--){
      st.blasts[i].life -= dt;
      if(st.blasts[i].life <= 0) st.blasts.splice(i,1);
    }

    // 小鬼 AI + 移动
    for(i=0;i<st.imps.length;i++) impAI(st, st.imps[i], dt);
    for(i=0;i<st.imps.length;i++) updateMove(st.imps[i], st.imps[i].speed * (st.imps[i].state==="rage"?RAGE_MUL:1), dt);

    // 被困倒计时
    for(i=0;i<st.imps.length;i++){
      var im = st.imps[i];
      if(im.state==="trapped"){
        im.trappedT -= dt;
        if(im.trappedT <= 0){
          im.state = "rage"; im.rageT = RAGE_TIME; im.trappedT = 0;
        }
      }
    }

    // 致死判定：爆炸光优先（同归于尽算死）
    var lethal = lethalSet(st);
    var pc = cellOf(p);
    if(p.shieldT<=0 && lethal[key(pc.x,pc.y)]){ die(st); return; }

    // 小鬼接触伤害（未被困/愤怒/巡逻/追击）
    if(p.shieldT<=0 && !p.dead){
      for(i=0;i<st.imps.length;i++){
        var im=st.imps[i];
        if(im.dead || im.state==="trapped" || im.state==="ascend") continue;
        var ic = cellOf(im);
        if(md(pc, ic)===0){ die(st); return; }
      }
    }

    // 道具拾取
    for(i=st.powerups.length-1;i>=0;i--){
      var pu = st.powerups[i];
      if(cellOf(p).x===pu.x && cellOf(p).y===pu.y){ applyPowerup(st, pu); st.powerups.splice(i,1); }
    }

    // 特效计时
    for(i=st.fx.length-1;i>=0;i--){ st.fx[i].t += dt; if(st.fx[i].t > st.fx[i].dur) st.fx.splice(i,1); }

    // 波次生成
    if(st.wave < st.plan.waves - 1){
      st.waveTimer += dt;
      if(st.waveTimer >= st.waveDelay){
        st.waveTimer = 0;
        spawnWave(st, st.wave+1);
      }
    }
  }

  // ========== 状态推进 ==========
  function advance(st){
    if(st.mode==="menu"){ startGame(st); return; }
    if(st.mode==="intro"){ st.mode="play"; return; }
    if(st.mode==="clear"){
      if(st.room+1 < N_ROOMS) newRoom(st, st.room+1, false);
      else { st.mode="victory"; st.victoryT=0; }
      return;
    }
    if(st.mode==="dead"){ newRoom(st, st.room, false); return; } // 保留道具
    if(st.mode==="victory"){ st.mode="menu"; st.player=null; return; }
  }

  // 对外导出
  return {
    COLS:COLS, ROWS:ROWS, N_ROOMS:N_ROOMS,
    ROOM_NAMES:ROOM_NAMES, ROOM_THEME:ROOM_THEME,
    DIFFS:DIFFS, DIFF_IDS:DIFF_IDS,
    INTRO_MS:INTRO_MS, CLEAR_MS:CLEAR_MS, DEAD_MS:DEAD_MS, VICTORY_MS:VICTORY_MS,
    BOMB_FUSE:BOMB_FUSE, BLAST_LIFE:BLAST_LIFE,
    TRAP_TIME:TRAP_TIME, RAGE_TIME:RAGE_TIME, RAGE_MUL:RAGE_MUL, SHIELD_TIME:SHIELD_TIME,
    create:create, setDifficulty:setDifficulty, startGame:startGame, newRoom:newRoom,
    update:update, advance:advance,
    placeBomb:placeBomb, tryPokeTrapped:tryPokeTrapped,
    setDir:function(st,dx,dy){ if(st.mode==="play") st.inputDir={x:dx,y:dy}; },
    cellOf:cellOf, solidAt:solidAt, crateAt:crateAt, bombAt:bombAt,
    playerEnter:playerEnter, impEnter:impEnter
  };
})();

if(typeof module!=="undefined") module.exports = Core;