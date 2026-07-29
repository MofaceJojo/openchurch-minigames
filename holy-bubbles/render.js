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
    for (var y=0;y<Core.ROWS;y++) for (var x=0;x<Core.COLS;x++){
      var r = cellRect(px, x, y);
      ctx.fillStyle = ((x+y)&1) ? th.floor : th.floor2;
      ctx.fillRect(r.x, r.y, r.w, r.h);
    }
  }
  function drawWallsCrates(ctx, Core, st, px){
    var th = st.theme;
    for (var y=0;y<Core.ROWS;y++) for (var x=0;x<Core.COLS;x++){
      var r = cellRect(px, x, y);
      if (Core.solidAt(st, x, y)){
        // 立柱 / 边框:顶面亮、正面暗,带暖光
        ctx.fillStyle = th.wall; ctx.fillRect(r.x, r.y, r.w, r.h);
        ctx.fillStyle = th.wallTop; ctx.fillRect(r.x, r.y, r.w, r.h*0.32);
        ctx.fillStyle = "rgba(255,255,255,0.18)"; ctx.fillRect(r.x+r.w*0.16, r.y+r.h*0.38, r.w*0.18, r.h*0.4);
        ctx.strokeStyle = "rgba(0,0,0,0.10)"; ctx.lineWidth = 1; ctx.strokeRect(r.x+0.5, r.y+0.5, r.w-1, r.h-1);
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
      var pulse = 1 + Math.sin(now*6)*0.06;
      var danger = b.timer < 0.6;
      if (danger && (Math.floor(now*10)%2===0)) pulse *= 1.12;
      var rad = px*0.30*pulse;
      var g = ctx.createRadialGradient(cx-rad*0.3, cy-rad*0.3, rad*0.1, cx, cy, rad);
      g.addColorStop(0, "#ffffff"); g.addColorStop(0.5, "#bfe6ff"); g.addColorStop(1, "#6fb6e8");
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(cx, cy, rad, 0, 7); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.beginPath(); ctx.arc(cx-rad*0.35, cy-rad*0.35, rad*0.22, 0, 7); ctx.fill();
      // 十字微光
      ctx.strokeStyle = danger ? "#e0552b" : "#3a86c8"; ctx.lineWidth = Math.max(1.5, px*0.05);
      ctx.beginPath(); ctx.moveTo(cx, cy-rad*0.5); ctx.lineTo(cx, cy+rad*0.5);
      ctx.moveTo(cx-rad*0.5, cy); ctx.lineTo(cx+rad*0.5, cy); ctx.stroke();
    }
  }

  function drawBlasts(ctx, Core, st, px){
    for (var i=0;i<st.blasts.length;i++){
      var bl = st.blasts[i], I = Math.max(0, bl.life/bl.max);
      for (var j=0;j<bl.cells.length;j++){
        var c = bl.cells[j], r = cellRect(px, c.x, c.y);
        var cx = r.x+r.w/2, cy = r.y+r.h/2, rad = px*0.58;
        var g = ctx.createRadialGradient(cx, cy, rad*0.1, cx, cy, rad);
        g.addColorStop(0, "rgba(255,255,255,"+(0.95*I)+")");
        g.addColorStop(0.4, "rgba(255,236,160,"+(0.8*I)+")");
        g.addColorStop(1, "rgba(255,210,120,0)");
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(cx, cy, rad, 0, 7); ctx.fill();
      }
    }
  }

  function drawImp(ctx, im, px, now){
    var cx = im.x*px, cy = (HUD_CELLS + im.y)*px;
    var wob = Math.sin(now*6 + im.wob) * px*0.04;
    ctx.save();
    if (im.dead){
      var t = Math.min(1, im.deadT/0.7);
      ctx.globalAlpha = 1 - t;
      ctx.translate(cx, cy); ctx.rotate(im.spin * t); ctx.translate(-cx, -cy);
      ctx.translate(0, -t*px*0.6);
    }
    var R = px*0.34; cy += wob;
    // 影子
    ctx.fillStyle = "rgba(0,0,0,0.12)";
    ctx.beginPath(); ctx.ellipse(cx, cy+R*0.95, R*0.8, R*0.3, 0, 0, 7); ctx.fill();
    // 身体
    ctx.fillStyle = "#b07ad6";
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.fill();
    ctx.fillStyle = "#9a63c4";
    ctx.beginPath(); ctx.arc(cx, cy+R*0.25, R*0.85, 0, Math.PI); ctx.fill();
    // 角
    ctx.fillStyle = "#7d4ba6";
    ctx.beginPath(); ctx.moveTo(cx-R*0.55, cy-R*0.8); ctx.lineTo(cx-R*0.3, cy-R*1.15); ctx.lineTo(cx-R*0.1, cy-R*0.85); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(cx+R*0.55, cy-R*0.8); ctx.lineTo(cx+R*0.3, cy-R*1.15); ctx.lineTo(cx+R*0.1, cy-R*0.85); ctx.closePath(); ctx.fill();
    // 眼
    ctx.fillStyle = "#fff";
    ctx.beginPath(); ctx.arc(cx-R*0.32, cy-R*0.1, R*0.26, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(cx+R*0.32, cy-R*0.1, R*0.26, 0, 7); ctx.fill();
    ctx.fillStyle = "#2a1b3a";
    ctx.beginPath(); ctx.arc(cx-R*0.28, cy-R*0.05, R*0.12, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(cx+R*0.36, cy-R*0.05, R*0.12, 0, 7); ctx.fill();
    // 笑
    ctx.strokeStyle = "#5a2d7d"; ctx.lineWidth = Math.max(1.5, px*0.04);
    ctx.beginPath(); ctx.arc(cx, cy+R*0.25, R*0.34, 0.15*Math.PI, 0.85*Math.PI); ctx.stroke();
    ctx.restore();
  }

  function drawPlayer(ctx, st, px, now){
    var p = st.player; if (!p) return;
    var cx = p.x*px, cy = (HUD_CELLS + p.y)*px;
    var moving = (p.dir.x||p.dir.y) && st.mode==="play";
    var bob = moving ? Math.sin(now*10)*px*0.04 : Math.sin(now*2)*px*0.015;
    ctx.save();
    if (p.dead){
      var t = Math.min(1, p.deadT/0.7);
      ctx.translate(cx, cy); ctx.rotate(t*1.4); ctx.scale(1-t*0.3, 1-t*0.7); ctx.translate(-cx, -cy);
    }
    cy += bob;
    var R = px*0.36;
    // 影子
    ctx.fillStyle = "rgba(0,0,0,0.14)";
    ctx.beginPath(); ctx.ellipse(cx, cy+R*0.95, R*0.85, R*0.3, 0, 0, 7); ctx.fill();
    // 圣光护盾
    if (p.shieldT > 0){
      ctx.strokeStyle = "rgba(224,176,75,"+(0.5+0.3*Math.sin(now*8))+")"; ctx.lineWidth = px*0.10;
      ctx.beginPath(); ctx.arc(cx, cy, R*1.5, 0, 7); ctx.stroke();
    }
    // 袍
    ctx.fillStyle = "#2f9e63";
    ctx.beginPath();
    ctx.moveTo(cx-R*0.7, cy+R);
    ctx.quadraticCurveTo(cx-R*0.9, cy, cx-R*0.45, cy-R*0.2);
    ctx.lineTo(cx+R*0.45, cy-R*0.2);
    ctx.quadraticCurveTo(cx+R*0.9, cy, cx+R*0.7, cy+R);
    ctx.closePath(); ctx.fill();
    // 衣领(白)
    ctx.fillStyle = "#fff";
    ctx.beginPath(); ctx.moveTo(cx-R*0.22, cy-R*0.1); ctx.lineTo(cx+R*0.22, cy-R*0.1); ctx.lineTo(cx, cy+R*0.18); ctx.closePath(); ctx.fill();
    // 头
    ctx.fillStyle = "#f4c9a0";
    ctx.beginPath(); ctx.arc(cx, cy-R*0.45, R*0.55, 0, 7); ctx.fill();
    // 头发
    ctx.fillStyle = "#5a3b22";
    ctx.beginPath(); ctx.arc(cx, cy-R*0.55, R*0.55, Math.PI, 0); ctx.fill();
    ctx.fillRect(cx-R*0.55, cy-R*0.55, R*0.22, R*0.3);
    // 眼/笑
    ctx.fillStyle = "#3a2a1a";
    ctx.beginPath(); ctx.arc(cx-R*0.18, cy-R*0.45, R*0.07, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(cx+R*0.18, cy-R*0.45, R*0.07, 0, 7); ctx.fill();
    ctx.strokeStyle = "#3a2a1a"; ctx.lineWidth = Math.max(1.2, px*0.03);
    ctx.beginPath(); ctx.arc(cx, cy-R*0.28, R*0.2, 0.1*Math.PI, 0.9*Math.PI); ctx.stroke();
    // 手里发光圣泡
    if (!p.dead){
      var hx = cx + (p.dir.x? p.dir.x*R*0.9 : R*0.7), hy = cy + (p.dir.y? p.dir.y*R*0.9 : R*0.5);
      var g = ctx.createRadialGradient(hx, hy, 1, hx, hy, R*0.5);
      g.addColorStop(0, "rgba(255,255,255,0.95)"); g.addColorStop(1, "rgba(120,200,240,0)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(hx, hy, R*0.5, 0, 7); ctx.fill();
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
    ctx.fillStyle = "rgba(255,255,255,0.82)";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "rgba(0,0,0,0.06)"; ctx.fillRect(0, h-2, w, 2);
    ctx.textBaseline = "middle";
    // 左:房间
    ctx.fillStyle = "#1C2420"; ctx.textAlign = "left";
    ctx.font = "600 " + (px*0.42) + "px " + SERIF;
    ctx.fillText("Room " + (st.room+1) + "/" + Core.N_ROOMS, px*0.3, h*0.42);
    ctx.fillStyle = "#4A564F"; ctx.font = "500 " + (px*0.30) + "px " + SANS;
    ctx.fillText(st.roomName, px*0.3, h*0.80);
    // 中:剩余小鬼
    var alive = 0; for (var i=0;i<st.imps.length;i++) if(!st.imps[i].dead) alive++;
    var midx = w*0.62;
    ctx.fillStyle = "#b07ad6";
    ctx.beginPath(); ctx.arc(midx, h*0.5, px*0.22, 0, 7); ctx.fill();
    ctx.fillStyle = "#1C2420"; ctx.textAlign = "left"; ctx.font = "600 " + (px*0.40) + "px " + SANS;
    ctx.fillText("× " + alive, midx + px*0.35, h*0.52);
    // 右:道具徽章
    var p = st.player, bx = w - px*0.3;
    ctx.textAlign = "right"; ctx.font = "600 " + (px*0.36) + "px " + SANS;
    if (p){
      ctx.fillStyle = "#2f9e63"; ctx.fillText("✦" + p.bombs, bx, h*0.32);
      ctx.fillStyle = "#047857"; ctx.fillText("+ " + p.range, bx, h*0.66);
      bx -= px*1.15;
      ctx.fillStyle = "#e0762b"; ctx.fillText("» " + Math.round(p.speedMul*10)/10, bx, h*0.32);
      if (p.shieldT > 0){ ctx.fillStyle = "#d9a94e"; ctx.fillText("⛨ " + Math.ceil(p.shieldT) + "s", bx, h*0.66); }
    }
  }

  // ---------------- 覆盖层 ----------------
  function dim(ctx, w, h){ ctx.fillStyle = "rgba(18,28,22,0.55)"; ctx.fillRect(0,0,w,h); }
  function panel(ctx, x, y, w, h){
    ctx.fillStyle = "#fff"; ctx.shadowColor = "rgba(0,0,0,0.3)"; ctx.shadowBlur = 24;
    rr(ctx, x, y, w, h, 18); ctx.fill(); ctx.shadowBlur = 0;
  }
  function menuLayout(w, h){
    var pills = [], pw = w*0.27, ph = h*0.085, gap = w*0.03;
    var total = pw*3 + gap*2, sx = (w-total)/2, py = h*0.60;
    for (var i=0;i<3;i++) pills.push({ id: Core.DIFF_IDS[i], x: sx + i*(pw+gap), y: py, w: pw, h: ph });
    var sw = w*0.5, sh = h*0.10;
    return { pills: pills, start: { x:(w-sw)/2, y: py+ph+h*0.05, w:sw, h:sh } };
  }

  function drawMenu(ctx, Core, st, px, w, h){
    dim(ctx, w, h);
    var pw = w*0.78, ph = h*0.52, px0 = (w-pw)/2, py0 = h*0.20;
    panel(ctx, px0, py0, pw, ph);
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillStyle = "#047857"; ctx.font = "600 " + (px*0.95) + "px " + SERIF;
    ctx.fillText("† Holy Bubbles", w/2, py0 + ph*0.16);
    ctx.fillStyle = "#4A564F"; ctx.font = "500 " + (px*0.40) + "px " + SANS;
    ctx.fillText("Pop the cheeky imps, clear every room.", w/2, py0 + ph*0.32);
    ctx.fillStyle = "#6E7A72"; ctx.font = "500 " + (px*0.34) + "px " + SANS;
    ctx.fillText("Move with arrows / swipe · tap to drop a Holy Bubble", w/2, py0 + ph*0.42);
    var L = menuLayout(w, h);
    for (var i=0;i<L.pills.length;i++){
      var b = L.pills[i], sel = st.diff === b.id;
      ctx.fillStyle = sel ? "#047857" : "#E7F2EC";
      rr(ctx, b.x, b.y, b.w, b.h, b.h*0.5); ctx.fill();
      if (sel){ ctx.strokeStyle = "#047857"; ctx.lineWidth = 2; rr(ctx, b.x, b.y, b.w, b.h, b.h*0.5); ctx.stroke(); }
      ctx.fillStyle = sel ? "#fff" : "#1C2420"; ctx.font = "600 " + (px*0.40) + "px " + SANS;
      ctx.fillText(Core.DIFFS[b.id].name, b.x+b.w/2, b.y+b.h*0.4);
      ctx.font = "400 " + (px*0.26) + "px " + SANS;
      ctx.fillText(Core.DIFFS[b.id].blurb, b.x+b.w/2, b.y+b.h*0.72);
    }
    var s = L.start;
    ctx.fillStyle = "#E0B04B"; rr(ctx, s.x, s.y, s.w, s.h, s.h*0.5); ctx.fill();
    ctx.fillStyle = "#3a2a10"; ctx.font = "700 " + (px*0.46) + "px " + SANS;
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
