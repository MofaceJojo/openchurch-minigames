/* Holy Bubbles · Canvas2D 渲染层
   明亮暖色、Q版、泡泡堂糖果风
   - 房间主题配色、地板径向渐变、墙面软垫感
   - 圣泡呼吸发光、引信闪烁、十字圣光展开动画
   - 牧师/小鬼：贴格子插值、眨眼、挣扎/愤怒/净化飞升动画
   - 木箱破碎、道具弹跳、粒子特效
   - HUD：房间名、道具图标、圣泡数/射程/护盾倒计时
*/

"use strict";

var Render = (function(){
  var HUD_CELLS = 1.5;           // HUD 高度（格子数）
  var CELL_PX = 32;              // 基准格子像素（会按屏幕缩放）
  var HUD_H;                     // 计算后的 HUD 像素高

  // 牧师/小鬼精灵尺寸（相对格子）
  var SPRITE_SCALE = 0.78;       // 角色占格子 78%
  var EYE_OFFSET = 0.18;

  // 颜色调色板（牧师）
  var PASTOR = {
    body: "#ff6b9d",    // 粉红
    body2: "#ff8eb8",
    eye: "#2d1a1a",
    cross: "#f5d89a",   // 金十字
    crossGlow: "#fff8e0",
    shoe: "#4a3728"
  };
  // 小鬼配色
  var IMP_COLORS = [
    { body:"#4ecdc4", body2:"#6fe8e0", eye:"#1a3a3a", horn:"#ff6b6b" },   // 青绿
    { body:"#ffe66d", body2:"#fff08a", eye:"#4a3a00", horn:"#ff6b6b" },   // 黄
    { body:"#ff8b8b", body2:"#ffaaa",  eye:"#4a1a1a", horn:"#4ecdc4" },   // 粉
    { body:"#a8e6a3", body2:"#c8f8c0", eye:"#1a3a1a", horn:"#ffe66d" },   // 绿
    { body:"#c8b8ff", body2:"#e0d8ff", eye:"#2a1a3a", horn:"#ff8b8b" }    // 紫
  ];

  // 道具图标绘制
  function drawIcon(ctx, px, x, y, type, t){
    var cx = x * px, cy = y * px, r = px * 0.38;
    ctx.save();
    ctx.translate(cx, cy);
    var bob = Math.sin(t * 3 + x * 7 + y * 11) * px * 0.06;
    ctx.translate(0, bob);
    switch(type){
      case "bomb":   // 圣泡数+1
        ctx.beginPath(); ctx.arc(0,0,r,0,Math.PI*2);
        var g = ctx.createRadialGradient(-r*0.3,-r*0.3,r*0.1, 0,0,r);
        g.addColorStop(0,"#fff8e0"); g.addColorStop(0.6,"#f5d89a"); g.addColorStop(1,"#e0b04b");
        ctx.fillStyle = g; ctx.fill();
        ctx.strokeStyle="#b9862f"; ctx.lineWidth=px*0.06; ctx.stroke();
        // 十字
        ctx.strokeStyle="#fff"; ctx.lineWidth=px*0.08; ctx.lineCap="round";
        ctx.beginPath(); ctx.moveTo(0,-r*0.5); ctx.lineTo(0,r*0.5);
        ctx.moveTo(-r*0.5,0); ctx.lineTo(r*0.5,0); ctx.stroke();
        break;
      case "range":  // 射程+1
        ctx.strokeStyle="#f5d89a"; ctx.lineWidth=px*0.07; ctx.lineCap="round";
        for(var d=0;d<4;d++){
          var a=d*Math.PI/2;
          ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(Math.cos(a)*r, Math.sin(a)*r); ctx.stroke();
        }
        ctx.beginPath(); ctx.arc(0,0,r*0.35,0,Math.PI*2);
        ctx.fillStyle="rgba(245,216,154,0.3)"; ctx.fill();
        break;
      case "speed":  // 移速
        ctx.fillStyle="#ff6b9d";
        ctx.beginPath();
        ctx.moveTo(-r, r*0.3);
        ctx.lineTo(r*0.2, -r*0.4);
        ctx.lineTo(r, r*0.3);
        ctx.lineTo(r*0.2, r*0.1);
        ctx.closePath(); ctx.fill();
        break;
      case "shield": // 护盾
        ctx.strokeStyle="#3d8ee0"; ctx.lineWidth=px*0.06;
        ctx.beginPath(); ctx.arc(0,0,r, -Math.PI/2, Math.PI*1.5); ctx.stroke();
        ctx.fillStyle="rgba(61,142,224,0.15)"; ctx.fill();
        break;
      case "nimble": // 灵巧步
        ctx.fillStyle="#a8e6a3";
        ctx.beginPath();
        for(var i=0;i<3;i++){
          var a=i*Math.PI*2/3 - Math.PI/2;
          ctx.moveTo(Math.cos(a)*r*0.3, Math.sin(a)*r*0.3);
          ctx.lineTo(Math.cos(a)*r, Math.sin(a)*r);
          ctx.lineTo(Math.cos(a+0.4)*r*0.5, Math.sin(a+0.4)*r*0.5);
        }
        ctx.closePath(); ctx.fill();
        break;
    }
    ctx.restore();
  }

  // ========== 尺寸计算 ==========
  function canvasSize(Core, px){
    CELL_PX = px;
    HUD_H = HUD_CELLS * px;
    return { w: Core.COLS * px, h: (Core.ROWS + HUD_CELLS) * px };
  }

  function cellRect(px, x, y){
    return { x: x*px, y: HUD_H + y*px, w: px, h: px };
  }

  // 圆角矩形
  function rr(ctx, x, y, w, h, r){
    r = Math.min(r, w/2, h/2);
    ctx.beginPath();
    ctx.moveTo(x+r, y);
    ctx.arcTo(x+w, y, x+w, y+h, r);
    ctx.arcTo(x+w, y+h, x, y+h, r);
    ctx.arcTo(x, y+h, x, y, r);
    ctx.arcTo(x, y, x+w, y, r);
    ctx.closePath();
  }

  // ========== 场景绘制 ==========
  function drawFloor(ctx, Core, st, px){
    var th = st.theme;
    var W = Core.COLS*px, H = Core.ROWS*px;
    // 温暖径向渐变
    var g = ctx.createRadialGradient(W/2, H*0.42, 0, W/2, H*0.42, Math.max(W,H)*0.68);
    g.addColorStop(0, th.floor);
    g.addColorStop(1, th.floor2);
    ctx.fillStyle = g;
    ctx.fillRect(0, HUD_H, W, H);
    // 中心柔光
    ctx.globalAlpha = 0.10;
    var g2 = ctx.createRadialGradient(W/2, H*0.38, 0, W/2, H*0.38, W*0.5);
    g2.addColorStop(0, "rgba(255,240,210,0.6)");
    g2.addColorStop(1, "rgba(255,240,210,0)");
    ctx.fillStyle = g2;
    ctx.fillRect(0, HUD_H, W, H);
    // 微绒面暖点
    ctx.globalAlpha = 0.04;
    ctx.fillStyle = th.accent;
    for(var y=0;y<Core.ROWS;y++) for(var x=0;x<Core.COLS;x++){
      if((x*7+y*13)%5===0){
        var r = cellRect(px,x,y);
        ctx.beginPath(); ctx.arc(r.x+r.w*0.5, r.y+r.h*0.5, px*0.03, 0, Math.PI*2); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawWallsCrates(ctx, Core, st, px){
    var th = st.theme;
    for(var y=0;y<Core.ROWS;y++) for(var x=0;x<Core.COLS;x++){
      var r = cellRect(px, x, y);
      if(Core.solidAt(st, x, y)){
        // 墙壁：软渐变+圆角，像毛绒软垫
        var wg = ctx.createLinearGradient(r.x, r.y, r.x, r.y+r.h);
        wg.addColorStop(0, th.wallTop);
        wg.addColorStop(0.6, th.wall);
        wg.addColorStop(1, th.wall);
        ctx.fillStyle = wg;
        rr(ctx, r.x+2, r.y+2, r.w-4, r.h-4, px*0.18);
        ctx.fill();
        // 高光边
        ctx.strokeStyle = "rgba(255,255,255,0.25)";
        ctx.lineWidth = 1.5;
        rr(ctx, r.x+2, r.y+2, r.w-4, r.h-4, px*0.18);
        ctx.stroke();
      }else if(Core.crateAt(st, x, y)){
        // 木箱：暖木色、木纹
        var cg = ctx.createLinearGradient(r.x, r.y, r.x, r.y+r.h);
        cg.addColorStop(0, "#e8c89a");
        cg.addColorStop(0.5, "#d4a87a");
        cg.addColorStop(1, "#c09060");
        ctx.fillStyle = cg;
        rr(ctx, r.x+3, r.y+3, r.w-6, r.h-6, px*0.12);
        ctx.fill();
        // 木纹
        ctx.strokeStyle = "rgba(120,80,40,0.25)";
        ctx.lineWidth = 1;
        for(var i=0;i<3;i++){
          var yy = r.y + r.h*0.2 + i*r.h*0.25;
          ctx.beginPath(); ctx.moveTo(r.x+4, yy); ctx.lineTo(r.x+r.w-4, yy+px*0.02*Math.sin(i)); ctx.stroke();
        }
        // 金属带
        ctx.strokeStyle = "rgba(180,130,80,0.6)";
        ctx.lineWidth = px*0.05;
        rr(ctx, r.x+4, r.y+4, r.w-8, r.h-8, px*0.08);
        ctx.stroke();
      }
    }
  }

  // ========== 实体绘制 ==========
  // 通用角色身体
  function drawCharacter(ctx, Core, st, px, e, colors, isPastor, t){
    if(e.dead && e.state!=="ascend") return;
    var r = cellRect(px, 0, 0);
    var cx = e.x * px, cy = HUD_H + e.y * px;
    var size = px * SPRITE_SCALE;
    var squash = e.squash || 1;
    var bob = (e.bob || 0) * px * 0.08;

    ctx.save();
    ctx.translate(cx, cy + bob);

    // 阴影
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = "#000";
    ctx.beginPath(); ctx.ellipse(0, size*0.55, size*0.35, size*0.12, 0, 0, Math.PI*2); ctx.fill();
    ctx.globalAlpha = 1;

    // 身体（圆角菱形/Q版圆）
    var bodyGrad = ctx.createRadialGradient(-size*0.2, -size*0.2, 0, 0, 0, size*0.7);
    bodyGrad.addColorStop(0, colors.body2);
    bodyGrad.addColorStop(0.7, colors.body);
    bodyGrad.addColorStop(1, colors.body);
    ctx.fillStyle = bodyGrad;

    // 圣泡包裹效果（被困时）
    if(e.state==="trapped"){
      // 外层圣泡
      var bubbleG = ctx.createRadialGradient(0,0,size*0.1, 0,0,size*0.9);
      bubbleG.addColorStop(0, "rgba(255,248,224,0.9)");
      bubbleG.addColorStop(0.5, "rgba(245,216,154,0.5)");
      bubbleG.addColorStop(1, "rgba(224,176,75,0.3)");
      ctx.save();
      ctx.globalAlpha = 0.7 + 0.3*Math.sin(t*8);
      ctx.fillStyle = bubbleG;
      ctx.beginPath(); ctx.ellipse(0, 0, size*0.9, size*0.95, 0, 0, Math.PI*2); ctx.fill();
      // 鼓包挣扎
      var struggle = Math.sin(t*12 + e.x*7) * 0.12;
      ctx.strokeStyle = "rgba(245,216,154,0.8)";
      ctx.lineWidth = 2;
      for(var i=0;i<3;i++){
        var a = i*Math.PI*2/3 + t*2;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a)*size*0.6, Math.sin(a)*size*0.6);
        ctx.lineTo(Math.cos(a)*size*(0.8+struggle), Math.sin(a)*size*(0.8+struggle));
        ctx.stroke();
      }
      ctx.restore();
    }

    // 愤怒光环
    if(e.state==="rage"){
      ctx.save();
      ctx.globalAlpha = 0.4 + 0.3*Math.sin(t*15);
      var rageG = ctx.createRadialGradient(0,0,size*0.3, 0,0,size*1.2);
      rageG.addColorStop(0, "rgba(255,100,100,0)");
      rageG.addColorStop(1, "rgba(255,60,60,0.5)");
      ctx.fillStyle = rageG;
      ctx.beginPath(); ctx.ellipse(0, 0, size*1.2, size*1.1, 0, 0, Math.PI*2); ctx.fill();
      ctx.restore();
    }

    // 净化飞升
    if(e.state==="ascend"){
      var prog = Math.min(1, e.deadT / 1.2);
      ctx.globalAlpha = 1 - prog;
      ctx.translate(0, -prog * px * 2.5);
      size *= (1 - prog * 0.3);
    }

    // 身体主体
    ctx.beginPath();
    ctx.ellipse(0, 0, size*0.55, size*0.6*squash, 0, 0, Math.PI*2);
    ctx.fill();

    // 高光
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = "#fff";
    ctx.beginPath(); ctx.ellipse(-size*0.15, -size*0.2, size*0.15, size*0.1, 0, 0, Math.PI*2); ctx.fill();
    ctx.globalAlpha = 1;

    // 眼睛
    var eyeY = -size*0.05;
    var blink = (Math.sin(t*0.5 + e.x*3) > 0.95) ? 0.1 : 1; // 偶尔眨眼
    // 左眼
    ctx.fillStyle = colors.eye;
    ctx.beginPath(); ctx.ellipse(-size*0.18, eyeY, size*0.09*blink, size*0.12, 0, 0, Math.PI*2); ctx.fill();
    // 右眼
    ctx.beginPath(); ctx.ellipse(size*0.18, eyeY, size*0.09*blink, size*0.12, 0, 0, Math.PI*2); ctx.fill();
    // 高光
    if(blink>0.5){
      ctx.fillStyle = "#fff";
      ctx.beginPath(); ctx.arc(-size*0.14, eyeY-size*0.04, size*0.035, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(size*0.22, eyeY-size*0.04, size*0.035, 0, Math.PI*2); ctx.fill();
    }

    // 牧师特有：头顶十字架
    if(isPastor){
      var crossSize = size*0.35;
      ctx.strokeStyle = PASTOR.cross;
      ctx.lineWidth = px*0.06;
      ctx.lineCap = "round";
      ctx.shadowColor = PASTOR.crossGlow;
      ctx.shadowBlur = px*0.1;
      ctx.beginPath();
      ctx.moveTo(0, -size*0.55);
      ctx.lineTo(0, -size*0.55 - crossSize);
      ctx.moveTo(-crossSize*0.6, -size*0.55 - crossSize*0.4);
      ctx.lineTo(crossSize*0.6, -size*0.55 - crossSize*0.4);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // 小鬼角
    if(!isPastor && colors.horn){
      ctx.fillStyle = colors.horn;
      for(var h=0;h<2;h++){
        var hx = (h===0?-1:1)*size*0.3;
        ctx.beginPath();
        ctx.moveTo(hx, -size*0.55);
        ctx.lineTo(hx*1.3, -size*0.85);
        ctx.lineTo(hx*0.7, -size*0.55);
        ctx.fill();
      }
    }

    // 护盾光环（牧师）
    if(isPastor && st.player && st.player.shieldT > 0){
      ctx.save();
      ctx.globalAlpha = 0.3 + 0.2*Math.sin(t*8);
      ctx.strokeStyle = "#3d8ee0";
      ctx.lineWidth = px*0.05;
      ctx.beginPath(); ctx.ellipse(0, 0, size*0.9, size*0.85, 0, 0, Math.PI*2); ctx.stroke();
      ctx.restore();
    }

    ctx.restore();
  }

  // 圣泡
  function drawBombs(ctx, Core, st, px, t){
    for(var i=0;i<st.bombs.length;i++){
      var b = st.bombs[i];
      var cx = b.x * px, cy = HUD_H + b.y * px;
      var r = px * 0.38;
      // 呼吸缩放
      var breath = 1 + 0.12 * Math.sin(t * 4 + b.x*3 + b.y*5);
      // 引信闪烁（最后 0.5s 加速闪烁）
      var blink = 1;
      if(b.timer < 0.5) blink = (Math.sin(t * 30) > 0) ? 1 : 0.4;

      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(breath, breath);

      // 外层光晕
      var glowG = ctx.createRadialGradient(0,0,r*0.1, 0,0,r*1.3);
      glowG.addColorStop(0, "rgba(255,248,224," + (0.4*blink) + ")");
      glowG.addColorStop(1, "rgba(245,216,154,0)");
      ctx.fillStyle = glowG;
      ctx.beginPath(); ctx.arc(0,0,r*1.3,0,Math.PI*2); ctx.fill();

      // 泡泡主体
      var bubbleG = ctx.createRadialGradient(-r*0.3,-r*0.3,r*0.1, 0,0,r);
      bubbleG.addColorStop(0, "#fffef0");
      bubbleG.addColorStop(0.4, "#fff8e0");
      bubbleG.addColorStop(0.7, "#f5d89a");
      bubbleG.addColorStop(1, "#e0b04b");
      ctx.fillStyle = bubbleG;
      ctx.beginPath(); ctx.arc(0,0,r,0,Math.PI*2); ctx.fill();

      // 高光
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = "#fff";
      ctx.beginPath(); ctx.arc(-r*0.25,-r*0.25,r*0.18,0,Math.PI*2); ctx.fill();
      ctx.globalAlpha = 1;

      // 十字标记
      ctx.strokeStyle = "rgba(224,176,75,0.9)";
      ctx.lineWidth = px*0.05;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(0,-r*0.5); ctx.lineTo(0,r*0.5);
      ctx.moveTo(-r*0.5,0); ctx.lineTo(r*0.5,0);
      ctx.stroke();

      // 引信火花（最后 1s）
      if(b.timer < 1.0){
        var spark = Math.sin(t*20 + b.x*7) > 0;
        if(spark){
          ctx.fillStyle = "#ff6b35";
          for(var s=0;s<3;s++){
            var a = t*10 + s*2;
            var sx = Math.cos(a)*r*1.1;
            var sy = Math.sin(a)*r*1.1 - r*0.3;
            ctx.beginPath(); ctx.arc(sx, sy, px*0.03, 0, Math.PI*2); ctx.fill();
          }
        }
      }

      ctx.restore();
    }
  }

  // 爆炸十字圣光
  function drawBlasts(ctx, Core, st, px, t){
    for(var i=0;i<st.blasts.length;i++){
      var bl = st.blasts[i];
      var life = bl.life / bl.max; // 1 -> 0
      var alpha = life * 0.85;
      var expand = 1 + (1-life)*0.3; // 稍微展开再收缩

      ctx.save();
      ctx.globalAlpha = alpha;

      var g = ctx.createRadialGradient(0,0,0, 0,0,px*2);
      // 中心金白
      g.addColorStop(0, "rgba(255,250,230," + alpha + ")");
      g.addColorStop(0.3, "rgba(245,216,154," + (alpha*0.9) + ")");
      g.addColorStop(0.6, "rgba(224,176,75," + (alpha*0.7) + ")");
      g.addColorStop(1, "rgba(200,150,60,0)");

      bl.cells.forEach(function(c){
        var cx = c.x * px, cy = HUD_H + c.y * px;
        var r = px * 0.48 * expand;

        if(c.pass==="crate" || c.pass==="bomb" || c.pass==="wall"){
          // 中心格/阻挡格：圆形爆发
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2); ctx.fill();
        }else{
          // 十字臂：矩形+圆角
          var dx = c.x - bl.cells[0].x;
          var dy = c.y - bl.cells[0].y;
          if(dx===0 && dy===0){
            ctx.fillStyle = g;
            ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2); ctx.fill();
          }else if(dx===0){
            // 竖向
            var h = px * bl.max * 2; // 简化
            ctx.fillStyle = g;
            rr(ctx, cx-r, cy-r, r*2, r*2, r*0.5);
            ctx.fill();
          }else if(dy===0){
            // 横向
            ctx.fillStyle = g;
            rr(ctx, cx-r, cy-r, r*2, r*2, r*0.5);
            ctx.fill();
          }
        }
      });

      ctx.restore();
    }
  }

  // 道具
  function drawPowerups(ctx, Core, st, px, t){
    for(var i=0;i<st.powerups.length;i++){
      var pu = st.powerups[i];
      drawIcon(ctx, px, pu.x, pu.y, pu.type, t);
    }
  }

  // 特效：净化飞升粒子
  function drawFx(ctx, Core, st, px, t){
    for(var i=0;i<st.fx.length;i++){
      var fx = st.fx[i];
      var prog = fx.t / fx.dur;
      if(prog >= 1) continue;

      if(fx.type==="absolve"){
        var cx = fx.x * px, cy = HUD_H + fx.y * px;
        var pcount = 12;
        for(var k=0;k<pcount;k++){
          var a = k * Math.PI*2/pcount + t*2;
          var dist = px * 0.5 + prog * px * 2.5;
          var px2 = cx + Math.cos(a)*dist;
          var py2 = cy + Math.sin(a)*dist - prog * px * 1.5;
          var alpha = 1 - prog;
          var size = px * 0.08 * (1 - prog*0.5);
          var hue = 45 + k*5;
          ctx.save();
          ctx.globalAlpha = alpha;
          ctx.fillStyle = "hsl(" + hue + ", 85%, 70%)";
          ctx.beginPath(); ctx.arc(px2, py2, size, 0, Math.PI*2); ctx.fill();
          // 光尾
          ctx.strokeStyle = "hsl(" + hue + ", 85%, 85%)";
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(px2, py2);
          ctx.lineTo(px2 - Math.cos(a)*size*3, py2 - Math.sin(a)*size*3);
          ctx.stroke();
          ctx.restore();
        }
        // 中心闪光
        ctx.save();
        ctx.globalAlpha = alpha*0.8;
        var fg = ctx.createRadialGradient(cx,cy,0, cx,cy,px*(1+prog));
        fg.addColorStop(0, "rgba(255,250,230,1)");
        fg.addColorStop(1, "rgba(245,216,154,0)");
        ctx.fillStyle = fg;
        ctx.beginPath(); ctx.arc(cx, cy, px*(1+prog), 0, Math.PI*2); ctx.fill();
        ctx.restore();
      }
    }
  }

  // HUD
  function drawHUD(ctx, Core, st, px, t){
    var W = Core.COLS * px;
    var h = HUD_H;

    // HUD 背景
    var hg = ctx.createLinearGradient(0,0,0,h);
    hg.addColorStop(0, "rgba(255,250,240,0.95)");
    hg.addColorStop(1, "rgba(245,235,220,0.9)");
    ctx.fillStyle = hg;
    ctx.fillRect(0,0,W,h);

    // 底部分割线
    ctx.strokeStyle = "rgba(200,180,150,0.3)";
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0,h); ctx.lineTo(W,h); ctx.stroke();

    // 房间名
    ctx.font = "600 " + (px*0.32) + "px -apple-system, 'Segoe UI', 'PingFang SC', sans-serif";
    ctx.fillStyle = "#4a3728";
    ctx.textAlign = "left";
    ctx.fillText(st.roomName + "  " + (st.room+1) + "/" + Core.N_ROOMS, px*0.6, px*0.55);

    // 波次进度
    if(st.mode==="play" && st.plan){
      var waveText = "Wave " + (st.wave+1) + "/" + st.plan.waves;
      ctx.font = "500 " + (px*0.24) + "px -apple-system, 'Segoe UI', 'PingFang SC', sans-serif";
      ctx.fillStyle = "#8b7a6a";
      ctx.fillText(waveText, px*0.6, px*0.85);
    }

    // 右侧道具栏
    var icons = [];
    if(st.player){
      if(st.player.bombs > 1) icons.push({type:"bomb", count:st.player.bombs});
      if(st.player.range > 2) icons.push({type:"range", count:st.player.range});
      if(st.player.speedMul > 1.05) icons.push({type:"speed"});
      if(st.player.shieldT > 0) icons.push({type:"shield", time:st.player.shieldT});
      if(st.player.nimble) icons.push({type:"nimble"});
    }
    var startX = W - px*0.6;
    for(var i=icons.length-1;i>=0;i--){
      var ic = icons[i];
      var cx = startX - (icons.length-1-i)*(px*1.1);
      var cy = h*0.5;
      drawIcon(ctx, px, cx/px, cy/px, ic.type, t);
      if(ic.count){
        ctx.font = "bold " + (px*0.2) + "px sans-serif";
        ctx.fillStyle = "#2d1a1a";
        ctx.textAlign = "center";
        ctx.fillText("×" + ic.count, cx, cy + px*0.45);
      }
      if(ic.time){
        // 护盾倒计时圆环
        var p = 1 - ic.time / Core.SHIELD_TIME;
        ctx.strokeStyle = "#3d8ee0";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, cy, px*0.42, -Math.PI/2, -Math.PI/2 + p*Math.PI*2);
        ctx.stroke();
      }
    }
  }

  // 状态覆盖层
  function drawOverlay(ctx, Core, st, px, t){
    var W = Core.COLS * px, H = (Core.ROWS + HUD_CELLS) * px;
    if(st.mode==="intro"){
      var a = Math.min(1, st.introT / (Core.INTRO_MS/1000));
      ctx.fillStyle = "rgba(30,25,20," + (0.7*a) + ")";
      ctx.fillRect(0,0,W,H);
      ctx.font = "700 " + (px*0.5) + "px Georgia, serif";
      ctx.fillStyle = "#f5e6c8";
      ctx.textAlign = "center";
      ctx.fillText(st.roomName, W/2, H/2 - px*0.4);
      ctx.font = "400 " + (px*0.28) + "px -apple-system, 'Segoe UI', 'PingFang SC', sans-serif";
      ctx.fillText("Room " + (st.room+1) + " / " + Core.N_ROOMS, W/2, H/2 + px*0.1);
      ctx.fillStyle = "rgba(245,230,200," + a + ")";
      ctx.fillText("Tap to Start", W/2, H/2 + px*0.6);
    }else if(st.mode==="clear"){
      var a = Math.min(1, st.clearT / (Core.CLEAR_MS/1000));
      ctx.fillStyle = "rgba(30,40,30," + (0.6*a) + ")";
      ctx.fillRect(0,0,W,H);
      ctx.font = "700 " + (px*0.55) + "px Georgia, serif";
      ctx.fillStyle = "#a8e6a3";
      ctx.textAlign = "center";
      ctx.fillText(st.room===Core.N_ROOMS-1 ? "ALL CLEARED!" : "ROOM CLEARED!", W/2, H/2);
      if(st.room<Core.N_ROOMS-1){
        ctx.font = "400 " + (px*0.26) + "px sans-serif";
        ctx.fillStyle = "rgba(245,230,200," + a + ")";
        ctx.fillText("Next room...", W/2, H/2 + px*0.6);
      }
    }else if(st.mode==="dead"){
      var a = Math.min(1, st.deadT / (Core.DEAD_MS/1000));
      ctx.fillStyle = "rgba(50,20,20," + (0.7*a) + ")";
      ctx.fillRect(0,0,W,H);
      ctx.font = "700 " + (px*0.5) + "px Georgia, serif";
      ctx.fillStyle = "#ff8b8b";
      ctx.textAlign = "center";
      ctx.fillText("CAUGHT!", W/2, H/2 - px*0.2);
      ctx.font = "400 " + (px*0.26) + "px sans-serif";
      ctx.fillStyle = "rgba(255,220,220," + a + ")";
      ctx.fillText(st.msg || "The imp got you...", W/2, H/2 + px*0.3);
      ctx.fillText("Retrying...", W/2, H/2 + px*0.7);
    }else if(st.mode==="victory"){
      var a = Math.min(1, st.victoryT / (Core.VICTORY_MS/1000));
      // 胜利彩带
      for(var i=0;i<20;i++){
        var x = (i/20)*W + Math.sin(t*2+i)*px*2;
        var y = H*0.15 + (H*0.7)*a;
        ctx.save();
        ctx.globalAlpha = a;
        ctx.fillStyle = "hsl(" + (i*18 + t*30)%360 + ", 70%, 70%)";
        ctx.beginPath(); ctx.arc(x, y, px*0.12, 0, Math.PI*2); ctx.fill();
        ctx.restore();
      }
      ctx.font = "700 " + (px*0.6) + "px Georgia, serif";
      ctx.fillStyle = "#f5d89a";
      ctx.textAlign = "center";
      ctx.fillText("ALL IMPS ASCENDED", W/2, H/2 - px*0.3);
      ctx.font = "400 " + (px*0.28) + "px sans-serif";
      ctx.fillStyle = "#ffe8cc";
      ctx.fillText("Peace returns to the sanctuary", W/2, H/2 + px*0.2);
      ctx.fillStyle = "rgba(245,216,154," + (0.8*a) + ")";
      ctx.fillText("Tap to return", W/2, H/2 + px*0.8);
    }else if(st.mode==="menu"){
      // 菜单：难度选择
      var a = 1;
      ctx.fillStyle = "rgba(30,25,20,0.85)";
      ctx.fillRect(0,0,W,H);
      ctx.font = "700 " + (px*0.55) + "px Georgia, serif";
      ctx.fillStyle = "#f5e6c8";
      ctx.textAlign = "center";
      ctx.fillText("HOLY BUBBLES", W/2, H*0.22);
      ctx.font = "400 " + (px*0.28) + "px sans-serif";
      ctx.fillStyle = "#ffe8cc";
      ctx.fillText("Pop the imps, clear every room", W/2, H*0.3);
      // 难度按钮
      var diffs = Core.DIFF_IDS;
      var btnW = px*5.5, btnH = px*1.3, gap = px*0.6;
      var totalW = diffs.length*btnW + (diffs.length-1)*gap;
      var startX = (W - totalW)/2;
      var btnY = H*0.45;
      diffs.forEach(function(d, idx){
        var sel = (st.diff===d);
        var x = startX + idx*(btnW+gap);
        ctx.save();
        rr(ctx, x, btnY, btnW, btnH, px*0.3);
        if(sel){
          var g = ctx.createLinearGradient(x, btnY, x, btnY+btnH);
          g.addColorStop(0, "#f5d89a"); g.addColorStop(1, "#e0b04b");
          ctx.fillStyle = g;
        }else{
          ctx.fillStyle = "rgba(255,248,224,0.6)";
        }
        ctx.fill();
        ctx.strokeStyle = sel ? "#b9862f" : "rgba(180,150,100,0.4)";
        ctx.lineWidth = sel ? 3 : 1.5;
        ctx.stroke();
        ctx.font = "600 " + (px*0.3) + "px sans-serif";
        ctx.fillStyle = sel ? "#4a3728" : "#8b7a6a";
        ctx.textAlign = "center";
        ctx.fillText(Core.DIFFS[d].name, x+btnW/2, btnY+btnH*0.55);
        ctx.font = "400 " + (px*0.2) + "px sans-serif";
        ctx.fillStyle = sel ? "#6a5a3a" : "#aaa";
        ctx.fillText(Core.DIFFS[d].blurb, x+btnW/2, btnY+btnH*0.85);
        ctx.restore();
      });
      // 开始按钮
      var sbtnW = px*6, sbtnH = px*1.5;
      var sx = (W-sbtnW)/2, sy = H*0.72;
      var pulse = 1 + 0.05*Math.sin(t*3);
      ctx.save();
      ctx.translate(sx+sbtnW/2, sy+sbtnH/2);
      ctx.scale(pulse, pulse);
      rr(ctx, -sbtnW/2, -sbtnH/2, sbtnW, sbtnH, px*0.35);
      var sg = ctx.createLinearGradient(-sbtnW/2, -sbtnH/2, sbtnW/2, sbtnH/2);
      sg.addColorStop(0, "#ff6b9d"); sg.addColorStop(1, "#e05580");
      ctx.fillStyle = sg;
      ctx.fill();
      ctx.font = "700 " + (px*0.38) + "px sans-serif";
      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";
      ctx.fillText("Tap to Start", 0, px*0.12);
      ctx.restore();
      // 操作提示
      ctx.font = "400 " + (px*0.22) + "px sans-serif";
      ctx.fillStyle = "rgba(255,240,220,0.7)";
      ctx.textAlign = "center";
      ctx.fillText("← → Move   ↑ / 💬 Drop Bubble   Space / Tap Poke", W/2, H*0.92);
    }
  }

  // ========== 主绘制入口 ==========
  function draw(ctx, Core, st, px, t){
    // 清屏
    var W = Core.COLS * px, H = (Core.ROWS + HUD_CELLS) * px;
    ctx.clearRect(0, 0, W, H);

    // 绘制顺序：地板 → 墙/箱 → 道具 → 圣泡 → 爆炸 → 角色 → 特效 → HUD → 覆盖层
    drawFloor(ctx, Core, st, px);
    drawWallsCrates(ctx, Core, st, px);
    drawPowerups(ctx, Core, st, px, t);
    drawBombs(ctx, Core, st, px, t);
    drawBlasts(ctx, Core, st, px, t);
    // 小鬼
    for(var i=0;i<st.imps.length;i++){
      var im = st.imps[i];
      if(im.dead && im.state!=="ascend") continue;
      var col = IMP_COLORS[i % IMP_COLORS.length];
      drawCharacter(ctx, Core, st, px, im, col, false, t);
    }
    // 牧师
    if(st.player && !st.player.dead){
      drawCharacter(ctx, Core, st, px, st.player, PASTOR, true, t);
    }
    drawFx(ctx, Core, st, px, t);
    drawHUD(ctx, Core, st, px, t);
    drawOverlay(ctx, Core, st, px, t);
  }

  // ========== 菜单命中检测 ==========
  function diffPickerHit(Core, w, h, px, x, y){
    // 菜单绘制坐标基于 Canvas 内部像素，需换算
    var W = Core.COLS * px, H = (Core.ROWS + HUD_CELLS) * px;
    var diffs = Core.DIFF_IDS;
    var btnW = px*5.5, btnH = px*1.3, gap = px*0.6;
    var totalW = diffs.length*btnW + (diffs.length-1)*gap;
    var startX = (W - totalW)/2;
    var btnY = H*0.45;
    for(var idx=0; idx<diffs.length; idx++){
      var bx = startX + idx*(btnW+gap);
      if(x >= bx && x <= bx+btnW && y >= btnY && y <= btnY+btnH) return diffs[idx];
    }
    return null;
  }
  function startBtnHit(Core, w, h, px, x, y){
    var W = Core.COLS * px, H = (Core.ROWS + HUD_CELLS) * px;
    var sbtnW = px*6, sbtnH = px*1.5;
    var sx = (W-sbtnW)/2, sy = H*0.72;
    return x >= sx && x <= sx+sbtnW && y >= sy && y <= sy+sbtnH;
  }

  return {
    HUD_CELLS: HUD_CELLS,
    canvasSize: canvasSize,
    draw: draw,
    diffPickerHit: diffPickerHit,
    startBtnHit: startBtnHit
  };
})();

if(typeof module!=="undefined") module.exports = Render;