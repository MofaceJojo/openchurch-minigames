/* Holy Bubbles · Canvas2D 渲染(明亮卡通风,与合集同族)
   只画,不碰逻辑;颜色、角色都走“明朗暖色、笑脸、不搞笑不行”的红线。 */
"use strict";

var Render = (function () {
  var HUD_CELLS = 1.45;

  function canvasSize(Core, px){ return { w: Core.COLS * px, h: (Core.ROWS + HUD_CELLS) * px }; }

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
  function cellRect(px, x, y){ return { x: x*px, y: HUD_CELLS*px + y*px, w: px, h: px }; }

  // ---------------- 场景 ----------------
  function drawFloor(ctx, Core, st, px){
    var th = st.theme;
    var W = Core.COLS*px, H = Core.ROWS*px;
    var g = ctx.createLinearGradient(0,0,0,H);
    g.addColorStop(0, th.floor);
    g.addColorStop(1, th.floor2);
    ctx.fillStyle = g;
    ctx.fillRect(0,0,W,H);
    // 柔光格子纹路
    ctx.globalAlpha = 0.08;
    for (var y=0;y<Core.ROWS;y++) for (var x=0;x<Core.COLS;x++){
      var r = cellRect(px,x,y);
      ctx.fillStyle = ((x+y)&1) ? th.accent : th.soft;
      ctx.fillRect(r.x, r.y, r.w, r.h);
    }
    ctx.globalAlpha = 1;
  }
  function drawWallsCrates(ctx, Core, st, px){
    var th = st.theme;
    for (var y=0;y<Core.ROWS;y++) for (var x=0;x<Core.COLS;x++){
      var r = cellRect(px, x, y);
      if (Core.solidAt(st, x, y)){
        ctx.fillStyle = th.wall; ctx.fillRect(r.x, r.y, r.w, r.h);
        ctx.fillStyle = th.wallTop; ctx.fillRect(r.x, r.y, r.w, r.h*0.32);
        // 柔光高光
        ctx.fillStyle = "rgba(255,255,255,0.12)"; ctx.fillRect(r.x+r.w*0.12, r.y+r.h*0.40, r.w*0.20, r.h*0.35);
        // 底部柔影
        ctx.fillStyle = "rgba(0,0,0,0.06)"; ctx.fillRect(r.x, r.y+r.h*0.85, r.w, r.h*0.15);
        ctx.strokeStyle = "rgba(255,255,255,0.08)"; ctx.lineWidth = 1;
        rr(ctx, r.x+0.5, r.y+0.5, r.w-1, r.h-1, px*0.06); ctx.stroke();
      } else if (Core.crateAt(st, x, y)){
        // 木箱:暖棕、交叉木条 + 小十字
        ctx.fillStyle = "#c79a5b"; rr(ctx, r.x+px*0.08, r.y+px*0.08, px*0.84, px*0.84, px*0.12); ctx.fill();
        ctx.strokeStyle = "rgba(120,80,30,0.55)"; ctx.lineWidth = Math.max(1.5, px*0.06);
        ctx.beginPath();
        ctx.moveTo(r.x+px*0.12, r.y+px*0.12); ctx.lineTo(r.x+px*0.88, r.y+px*0.88);
        ctx.moveTo(r.x+px*0.88, r.y+px*0.12); ctx.lineTo(r.x+px*0.12, r.y+px*0.88);
        ctx.stroke();
        ctx.fillStyle = "rgba(255,255,255,0.5)"; ctx.fillRect(r.x+px*0.42, r.y+px*0.30, px*0.16, px*0.40);
        ctx.fillRect(r.x+px*0.30, r.y+px*0.42, px*0.40, px*0.16);
      }
    }
  }

  function drawPowerups(ctx, Core, st, px, now){
    for (var i=0;i<st.powerups.length;i++){
      var pu = st.powerups[i], r = cellRect(px, pu.x, pu.y);
      var bob = Math.sin(now*3 + pu.bob) * px*0.05;
      var cx = r.x+r.w/2, cy = r.y+r.h/2 + bob;
      ctx.save();
      ctx.shadowColor = "rgba(224,176,75,0.7)"; ctx.shadowBlur = px*0.3;
      ctx.fillStyle = "#fff"; rr(ctx, cx-px*0.30, cy-px*0.30, px*0.60, px*0.60, px*0.16); ctx.fill();
      ctx.restore();
      ctx.strokeStyle = "#E0B04B"; ctx.lineWidth = Math.max(1.5, px*0.05);
      rr(ctx, cx-px*0.30, cy-px*0.30, px*0.60, px*0.60, px*0.16); ctx.stroke();
      drawPowerIcon(ctx, pu.type, cx, cy, px);
    }
  }
  function drawPowerIcon(ctx, type, cx, cy, px){
    ctx.save();
    if (type === "bomb"){
      ctx.fillStyle = "#4aa3e0";
      ctx.beginPath(); ctx.arc(cx-px*0.08, cy+px*0.04, px*0.16, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.arc(cx+px*0.12, cy-px*0.06, px*0.11, 0, 7); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.8)";
      ctx.beginPath(); ctx.arc(cx-px*0.12, cy, px*0.04, 0, 7); ctx.fill();
    } else if (type === "range"){
      ctx.fillStyle = "#047857";
      ctx.fillRect(cx-px*0.05, cy-px*0.20, px*0.10, px*0.40);
      ctx.fillRect(cx-px*0.20, cy-px*0.05, px*0.40, px*0.10);
    } else if (type === "speed"){
      ctx.fillStyle = "#e0762b";
      for (var k=0;k<2;k++){
        var ox = cx-px*0.14 + k*px*0.16;
        ctx.beginPath();
        ctx.moveTo(ox-px*0.08, cy-px*0.18); ctx.lineTo(ox+px*0.10, cy); ctx.lineTo(ox-px*0.08, cy+px*0.18);
        ctx.lineTo(ox-px*0.02, cy+px*0.18); ctx.lineTo(ox+px*0.16, cy); ctx.lineTo(ox-px*0.02, cy-px*0.18);
        ctx.closePath(); ctx.fill();
      }
    } else if (type === "shield"){
      ctx.fillStyle = "#d9a94e";
      ctx.beginPath();
      ctx.moveTo(cx, cy-px*0.20); ctx.lineTo(cx+px*0.17, cy-px*0.10);
      ctx.lineTo(cx+px*0.17, cy+px*0.06); ctx.lineTo(cx, cy+px*0.20);
      ctx.lineTo(cx-px*0.17, cy+px*0.06); ctx.lineTo(cx-px*0.17, cy-px*0.10);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#fff"; ctx.fillRect(cx-px*0.03, cy-px*0.10, px*0.06, px*0.18);
      ctx.fillRect(cx-px*0.10, cy-px*0.03, px*0.20, px*0.06);
    }
    ctx.restore();
  }

  function drawBombs(ctx, Core, st, px, now){
    for (var i=0;i<st.bombs.length;i++){
      var b = st.bombs[i], r = cellRect(px, b.x, b.y);
      var cx = r.x+r.w/2, cy = r.y+r.h/2;
      var pulse = 1 + Math.sin(now*8)*0.08;
      var fuse = 1 - b.timer/BOMB_FUSE;
      var R = px*0.35 * pulse;

      // 外层柔和光晕
      var g = ctx.createRadialGradient(cx, cy, R*0.2, cx, cy, R*1.3);
      g.addColorStop(0, "rgba(255,220,120,0.4)");
      g.addColorStop(0.5, "rgba(255,200,100,0.15)");
      g.addColorStop(1, "rgba(255,200,100,0)");
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(cx, cy, R*1.3, 0, Math.PI*2); ctx.fill();

      // 泡面
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI*2); ctx.fill();

      // 泡泡高光
      ctx.fillStyle = "rgba(255,255,255,0.8)";
      ctx.beginPath(); ctx.arc(cx-R*0.25, cy-R*0.25, R*0.3, 0, Math.PI*2); ctx.fill();

      // 引信火花
      if (fuse < 1){
        var sparkR = Math.max(1, R*0.12 * (1-fuse));
        ctx.fillStyle = "rgba(255,200,50,"+(0.5+0.5*Math.sin(now*15)).toFixed(2)+")";
        ctx.beginPath(); ctx.arc(cx, cy-R*0.55, sparkR, 0, Math.PI*2); ctx.fill();
      }

      // 十字温柔标记
      ctx.strokeStyle = fuse > 0.8 ? "rgba(255,120,60,0.5)" : "rgba(200,160,60,0.3)";
      ctx.lineWidth = Math.max(1, px*0.03); ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(cx, cy-R*0.45); ctx.lineTo(cx, cy+R*0.45); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx-R*0.45, cy); ctx.lineTo(cx+R*0.45, cy); ctx.stroke();
    }
  }

  function drawBlasts(ctx, Core, st, px){
    for (var i=0;i<st.blasts.length;i++){
      var bl = st.blasts[i], I = Math.max(0, bl.life/bl.max);
      for (var j=0;j<bl.cells.length;j++){
        var c = bl.cells[j], r = cellRect(px, c.x, c.y);
        var cx = r.x+r.w/2, cy = r.y+r.h/2, rad = px*0.6;
        // 柔金光晕
        var g = ctx.createRadialGradient(cx, cy, rad*0.05, cx, cy, rad);
        g.addColorStop(0, "rgba(255,255,200,"+(0.9*I).toFixed(2)+")");
        g.addColorStop(0.3, "rgba(255,220,100,"+(0.7*I).toFixed(2)+")");
        g.addColorStop(0.7, "rgba(255,180,80,"+(0.3*I).toFixed(2)+")");
        g.addColorStop(1, "rgba(255,160,60,0)");
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(cx, cy, rad, 0, Math.PI*2); ctx.fill();

        // 小光点飞溅
        if (I > 0.4) {
          ctx.fillStyle = "rgba(255,240,180,"+(0.6*I).toFixed(2)+")";
          for (var k=0;k<4;k++){
            var a = (k/4)*Math.PI*2 + now*2;
            var d = rad*0.5;
            ctx.beginPath(); ctx.arc(cx+Math.cos(a)*d, cy+Math.sin(a)*d, px*0.04, 0, Math.PI*2); ctx.fill();
          }
        }
      }
    }
  }

  function drawImp(ctx, im, px, now){
    var cx = im.x*px, cy = (HUD_CELLS + im.y)*px;
    var wob = Math.sin(now*6 + im.wob) * px*0.04;
    var bob = Math.sin(now*8 + im.wob) * px*0.02;
    var squash = im.squash || 1;

    ctx.save();
    ctx.translate(cx, cy + bob);
    ctx.scale(1/squash, squash);

    if (im.dead){
      var t = Math.min(1, im.deadT/0.7);
      ctx.globalAlpha = 1 - t;
      ctx.rotate(im.spin * t);
      ctx.translate(0, -t*px*0.6);
    }

    var R = px*0.38;
    // 柔和影子
    ctx.fillStyle = "rgba(0,0,0,0.08)";
    ctx.beginPath(); ctx.ellipse(0, R*0.9, R*0.9, R*0.25, 0, 0, Math.PI*2); ctx.fill();

    // 身体
    ctx.fillStyle = "#d4a8e8";
    ctx.beginPath(); ctx.arc(0, R*0.2, R*0.85, 0, Math.PI*2); ctx.fill();

    // 白肚皮
    ctx.fillStyle = "#f5e0ff";
    ctx.beginPath(); ctx.arc(0, R*0.3, R*0.55, 0, Math.PI*2); ctx.fill();

    // 大圆眼睛
    var eyeY = -R*0.15;
    ctx.fillStyle = "#fff";
    ctx.beginPath(); ctx.arc(-R*0.3, eyeY, R*0.32, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(R*0.3, eyeY, R*0.32, 0, Math.PI*2); ctx.fill();

    // 瞳孔
    ctx.fillStyle = "#3a1a5a";
    ctx.beginPath(); ctx.arc(-R*0.28, eyeY+R*0.06, R*0.14, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(R*0.32, eyeY+R*0.06, R*0.14, 0, Math.PI*2); ctx.fill();

    // 高光
    ctx.fillStyle = "#fff";
    ctx.beginPath(); ctx.arc(-R*0.22, eyeY-R*0.06, R*0.06, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(R*0.38, eyeY-R*0.06, R*0.06, 0, Math.PI*2); ctx.fill();

    // 小嘴(微笑)
    ctx.strokeStyle = "#7a3fa0"; ctx.lineWidth = Math.max(1, px*0.03); ctx.lineCap = "round";
    ctx.beginPath(); ctx.arc(0, R*0.35, R*0.18, 0.1*Math.PI, 0.9*Math.PI); ctx.stroke();

    // 粉色腮红
    ctx.fillStyle = "rgba(255,150,180,0.35)";
    ctx.beginPath(); ctx.arc(-R*0.45, R*0.1, R*0.1, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(R*0.45, R*0.1, R*0.1, 0, Math.PI*2); ctx.fill();

    // 小角(更软)
    ctx.fillStyle = "#c89ad6";
    ctx.beginPath(); ctx.ellipse(-R*0.4, -R*0.75, R*0.12, R*0.2, -0.3, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(R*0.4, -R*0.75, R*0.12, R*0.2, 0.3, 0, Math.PI*2); ctx.fill();

    ctx.restore();
  }

  function drawPlayer(ctx, st, px, now){
    var p = st.player; if (!p) return;
    var cx = p.x*px, cy = (HUD_CELLS + p.y)*px;
    var moving = (p.dir.x||p.dir.y) && st.mode==="play";
    var bob = moving ? Math.sin(now*10)*px*0.05 : Math.sin(now*2)*px*0.02;
    var squash = p.squash || 1;
    var facing = p.facing || (p.dir.x||1);

    ctx.save();
    ctx.translate(cx, cy + bob);
    ctx.scale(facing > 0 ? 1 : -1, 1);
    if (p.dead){
      var t = Math.min(1, p.deadT/0.7);
      ctx.translate(0, -t*px*0.3);
      ctx.scale(1+t*0.2, 1-t*0.1);
      ctx.globalAlpha = 1 - t*0.3;
    } else {
      ctx.scale(1/squash, squash);
    }

    var R = px*0.40;

    // 柔和影子
    ctx.fillStyle = "rgba(0,0,0,0.08)";
    ctx.beginPath(); ctx.ellipse(0, R*0.95, R*0.85, R*0.25, 0, 0, Math.PI*2); ctx.fill();

    // 袍(更圆润)
    ctx.fillStyle = "#3cb87a";
    ctx.beginPath();
    ctx.moveTo(-R*0.8, R*0.5);
    ctx.quadraticCurveTo(-R*0.9, -R*0.1, -R*0.5, -R*0.3);
    ctx.lineTo(R*0.5, -R*0.3);
    ctx.quadraticCurveTo(R*0.9, -R*0.1, R*0.8, R*0.5);
    ctx.closePath(); ctx.fill();

    // 袍领(白, 圆)
    ctx.fillStyle = "#fff";
    ctx.beginPath(); ctx.ellipse(0, -R*0.28, R*0.22, R*0.12, 0, 0, Math.PI*2); ctx.fill();

    // 头(更圆更大)
    ctx.fillStyle = "#fdc99a";
    ctx.beginPath(); ctx.arc(0, -R*0.72, R*0.52, 0, Math.PI*2); ctx.fill();

    // 头发(柔软卷曲)
    ctx.fillStyle = "#6b4a2a";
    ctx.beginPath(); ctx.arc(0, -R*0.85, R*0.52, Math.PI, 0); ctx.fill();
    ctx.fillRect(-R*0.52, -R*0.80, R*0.20, R*0.28);

    // 大眼睛(温柔)
    ctx.fillStyle = "#fff";
    ctx.beginPath(); ctx.arc(-R*0.18, -R*0.74, R*0.20, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(R*0.18, -R*0.74, R*0.20, 0, Math.PI*2); ctx.fill();

    // 瞳孔
    ctx.fillStyle = "#3a2a1a";
    ctx.beginPath(); ctx.arc(-R*0.16, -R*0.72, R*0.09, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(R*0.20, -R*0.72, R*0.09, 0, Math.PI*2); ctx.fill();

    // 高光
    ctx.fillStyle = "#fff";
    ctx.beginPath(); ctx.arc(-R*0.12, -R*0.78, R*0.04, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(R*0.24, -R*0.78, R*0.04, 0, Math.PI*2); ctx.fill();

    // 微笑(柔和)
    ctx.strokeStyle = "#3a2a1a"; ctx.lineWidth = Math.max(1, px*0.025); ctx.lineCap = "round";
    ctx.beginPath(); ctx.arc(0, -R*0.55, R*0.14, 0.15*Math.PI, 0.85*Math.PI); ctx.stroke();

    // 腮红
    ctx.fillStyle = "rgba(255,150,150,0.3)";
    ctx.beginPath(); ctx.arc(-R*0.38, -R*0.55, R*0.09, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(R*0.38, -R*0.55, R*0.09, 0, Math.PI*2); ctx.fill();

    // 圣泡光芒
    if (!p.dead){
      var hx = R*0.7, hy = -R*0.3;
      var t = now*4;
      var g = ctx.createRadialGradient(hx, hy, 1, hx, hy, R*0.7);
      g.addColorStop(0, "rgba(255,255,255,0.95)");
      g.addColorStop(0.3, "rgba(200,240,255,0.6)");
      g.addColorStop(1, "rgba(120,200,240,0)");
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(hx, hy, R*0.7, 0, Math.PI*2); ctx.fill();
    }

    ctx.restore();
  }

  function drawFx(ctx, Core, st, px){
    for (var i=0;i<st.fx.length;i++){
      var f = st.fx[i], r = cellRect(px, 0, 0);
      var cx = f.x*px, cy = (HUD_CELLS + f.y)*px, t = f.t/0.7;
      ctx.save(); ctx.globalAlpha = 1-t;
      ctx.strokeStyle = "#E0B04B"; ctx.lineWidth = px*0.06;
      for (var k=0;k<6;k++){
        var a = k/6*Math.PI*2 + t*3;
        var d = px*0.2 + t*px*0.5;
        ctx.beginPath(); ctx.moveTo(cx+Math.cos(a)*d, cy+Math.sin(a)*d);
        ctx.lineTo(cx+Math.cos(a)*(d+px*0.12), cy+Math.sin(a)*(d+px*0.12)); ctx.stroke();
      }
      ctx.restore();
    }
  }

  // ---------------- HUD ----------------
  function drawHUD(ctx, Core, st, px){
    var w = Core.COLS*px, h = HUD_CELLS*px;
    // 柔和毛玻璃条
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    rr(ctx, 0, 0, w, h, px*0.08); ctx.fill();
    // 底部柔线
    ctx.fillStyle = "rgba(200,180,150,0.15)"; ctx.fillRect(0, h-2, w, 2);
    ctx.textBaseline = "middle";
    // 左:房间
    ctx.fillStyle = "#3a4a3a"; ctx.textAlign = "left";
    ctx.font = "600 " + (px*0.40) + "px " + SERIF;
    ctx.fillText("Room " + (st.room+1) + "/" + Core.N_ROOMS, px*0.3, h*0.42);
    ctx.fillStyle = "#5a6a5a"; ctx.font = "500 " + (px*0.28) + "px " + SANS;
    ctx.fillText(st.roomName, px*0.3, h*0.77);
    // 中:剩余小鬼(圆)
    var alive = 0; for (var i=0;i<st.imps.length;i++) if(!st.imps[i].dead) alive++;
    var midx = w*0.62;
    ctx.fillStyle = "#d4a8e8";
    ctx.beginPath(); ctx.arc(midx, h*0.45, px*0.24, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = "#3a2a3a"; ctx.textAlign = "left"; ctx.font = "600 " + (px*0.36) + "px " + SANS;
    ctx.fillText("× " + alive, midx + px*0.32, h*0.48);
    // 右:道具徽章(圆角柔和)
    var p = st.player, bx = w - px*0.3;
    ctx.textAlign = "right"; ctx.font = "600 " + (px*0.32) + "px " + SANS;
    if (p){
      ctx.fillStyle = "rgba(60,180,120,0.7)"; rr(ctx, bx-px*0.25, h*0.22, px*0.50, px*0.28, px*0.10); ctx.fill();
      ctx.fillStyle = "#1a3a2a"; ctx.fillText("✦"+p.bombs, bx, h*0.36);
      ctx.fillStyle = "rgba(4,120,80,0.7)"; rr(ctx, bx-px*0.25, h*0.54, px*0.50, px*0.28, px*0.10); ctx.fill();
      ctx.fillStyle = "#0a3a1a"; ctx.fillText("+ "+p.range, bx, h*0.68);
      bx -= px*1.05;
      ctx.fillStyle = "rgba(200,100,30,0.6)"; rr(ctx, bx-px*0.25, h*0.22, px*0.50, px*0.28, px*0.10); ctx.fill();
      ctx.fillStyle = "#4a2a0a"; ctx.fillText("»"+Math.round(p.speedMul*10)/10, bx, h*0.36);
      if (p.shieldT > 0){
        ctx.fillStyle = "rgba(200,160,60,0.6)"; rr(ctx, bx-px*0.25, h*0.54, px*0.50, px*0.28, px*0.10); ctx.fill();
        ctx.fillStyle = "#4a3a0a"; ctx.fillText("⛨"+Math.ceil(p.shieldT)+"s", bx, h*0.68);
      }
    }
  }

  // ---------------- 覆盖层 ----------------
  function dim(ctx, w, h){ ctx.fillStyle = "rgba(30,45,35,0.40)"; ctx.fillRect(0,0,w,h); }
  function panel(ctx, x, y, w, h, px){
    // 柔和毛玻璃面板
    ctx.fillStyle = "rgba(255,255,255,0.72)";
    rr(ctx, x, y, w, h, px*0.10); ctx.fill();
    // 柔光边框
    ctx.strokeStyle = "rgba(200,180,150,0.3)"; ctx.lineWidth = 1;
    rr(ctx, x, y, w, h, px*0.10); ctx.stroke();
  }
  function menuLayout(w, h){
    var pills = [], pw = w*0.28, ph = h*0.085, gap = w*0.025;
    var total = pw*3 + gap*2, sx = (w-total)/2, py = h*0.55;
    for (var i=0;i<3;i++) pills.push({ id: Core.DIFF_IDS[i], x: sx + i*(pw+gap), y: py, w: pw, h: ph });
    var sw = w*0.5, sh = h*0.10;
    return { pills: pills, start: { x:(w-sw)/2, y: py+ph+h*0.04, w:sw, h:sh } };
  }

  function drawMenu(ctx, Core, st, px, w, h){
    dim(ctx, w, h);
    // 柔光背景
    var bg = ctx.createRadialGradient(w/2, h*0.35, 0, w/2, h*0.35, w*0.7);
    bg.addColorStop(0, "rgba(255,240,210,0.3)");
    bg.addColorStop(1, "rgba(255,240,210,0)");
    ctx.fillStyle = bg; ctx.fillRect(0,0,w,h);

    var pw = w*0.78, ph = h*0.50, px0 = (w-pw)/2, py0 = h*0.18;
    panel(ctx, px0, py0, pw, ph, px);
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    // 标题(暖金色柔光)
    ctx.fillStyle = "#047857"; ctx.font = "600 " + (px*0.90) + "px " + SERIF;
    ctx.fillText("† Holy Bubbles", w/2, py0 + ph*0.14);
    // 副标题
    ctx.fillStyle = "#5a6a5a"; ctx.font = "500 " + (px*0.38) + "px " + SANS;
    ctx.fillText("Pop the cheeky imps, clear every room.", w/2, py0 + ph*0.28);
    ctx.fillStyle = "#7a8a72"; ctx.font = "500 " + (px*0.30) + "px " + SANS;
    ctx.fillText("Move with arrows / swipe · tap to drop a Holy Bubble", w/2, py0 + ph*0.37);
    var L = menuLayout(w, h);
    for (var i=0;i<L.pills.length;i++){
      var b = L.pills[i], sel = st.diff === b.id;
      ctx.fillStyle = sel ? "rgba(4,120,87,0.10)" : "rgba(230,242,236,0.80)";
      rr(ctx, b.x, b.y, b.w, b.h, b.h*0.45); ctx.fill();
      if (sel){ ctx.fillStyle = "rgba(4,120,87,0.15)"; rr(ctx, b.x, b.y, b.w, b.h, b.h*0.45); ctx.fill(); }
      ctx.fillStyle = sel ? "#045838" : "#1C2420"; ctx.font = "600 " + (px*0.38) + "px " + SANS;
      ctx.fillText(Core.DIFFS[b.id].name, b.x+b.w/2, b.y+b.h*0.40);
      ctx.fillStyle = "#5a6a5a"; ctx.font = "400 " + (px*0.24) + "px " + SANS;
      ctx.fillText(Core.DIFFS[b.id].blurb, b.x+b.w/2, b.y+b.h*0.68);
    }
    var s = L.start;
    // 开始按钮(柔和金)
    ctx.fillStyle = "rgba(224,176,75,0.85)"; rr(ctx, s.x, s.y, s.w, s.h, s.h*0.4); ctx.fill();
    ctx.fillStyle = "#3a2a10"; ctx.font = "700 " + (px*0.42) + "px " + SANS;
    ctx.fillText("Tap to start", s.x+s.w/2, s.y+s.h*0.5);
  }

  function drawBanner(ctx, Core, st, px, w, h, big, small){
    dim(ctx, w, h);
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillStyle = "#fff"; ctx.font = "700 " + (px*1.1) + "px " + SERIF;
    ctx.fillText(big, w/2, h*0.44);
    ctx.fillStyle = "#E7F2EC"; ctx.font = "500 " + (px*0.42) + "px " + SANS;
    ctx.fillText(small, w/2, h*0.56);
  }

  function draw(ctx, Core, st, px, now){
    var w = Core.COLS*px, boardH = Core.ROWS*px, h = boardH + HUD_CELLS*px;
    ctx.clearRect(0,0,w,h);
    drawFloor(ctx, Core, st, px);
    drawWallsCrates(ctx, Core, st, px);
    drawPowerups(ctx, Core, st, px, now);
    drawBombs(ctx, Core, st, px, now);
    drawBlasts(ctx, Core, st, px);
    for (var i=0;i<st.imps.length;i++) drawImp(ctx, st.imps[i], px, now);
    drawPlayer(ctx, st, px, now);
    drawFx(ctx, Core, st, px);
    drawHUD(ctx, Core, st, px);

    if (st.mode === "menu") drawMenu(ctx, Core, st, px, w, h);
    else if (st.mode === "intro") drawBanner(ctx, Core, st, px, w, h, st.roomName, "Room " + (st.room+1) + " · get ready!");
    else if (st.mode === "clear") drawBanner(ctx, Core, st, px, w, h, "Room cleared! ✨", st.room+1 < Core.N_ROOMS ? "On to the next…" : "One room to go…");
    else if (st.mode === "dead") drawBanner(ctx, Core, st, px, w, h, "Oops!", st.msg + "  Tap to try again.");
    else if (st.mode === "victory") drawBanner(ctx, Core, st, px, w, h, "All rooms cleared! 🎉", "Tap for another round.");
  }

  // ---------------- 触屏命中(菜单) ----------------
  function diffPickerHit(Core, w, h, px, x, y){
    var L = menuLayout(w, h);
    for (var i=0;i<L.pills.length;i++){ var b=L.pills[i]; if (x>=b.x&&x<=b.x+b.w&&y>=b.y&&y<=b.y+b.h) return b.id; }
    return null;
  }
  function startBtnHit(Core, w, h, px, x, y){
    var s = menuLayout(w, h).start;
    return x>=s.x && x<=s.x+s.w && y>=s.y && y<=s.y+s.h;
  }

  var SERIF = '"Iowan Old Style","Palatino Linotype",Palatino,Georgia,"Songti SC",serif';
  var SANS = '-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC",Roboto,sans-serif';

  return {
    HUD: HUD_CELLS, canvasSize: canvasSize, draw: draw,
    diffPickerHit: diffPickerHit, startBtnHit: startBtnHit
  };
})();
