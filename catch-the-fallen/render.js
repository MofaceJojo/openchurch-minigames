/* Catch the Fallen · Read-only Canvas2D renderer — 明亮蓝天教堂风 */
"use strict";

var Render = (function () {
  var W = Core.W, H = Core.H, HUD = Core.HUD;
  var PAD_Y = Core.PAD_Y, QUEUE_Y = Core.QUEUE_Y;

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawBackground(ctx) {
    var sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, "#8ed4ff");
    sky.addColorStop(0.7, "#d6f0ff");
    sky.addColorStop(1, "#eaf7ff");
    ctx.fillStyle = sky;
    ctx.fillRect(0, HUD, W, H - HUD);
    // 太阳
    ctx.fillStyle = "#ffe36e";
    ctx.beginPath(); ctx.arc(W - 34, HUD + 30, 16, 0, 7); ctx.fill();
    ctx.fillStyle = "rgba(255,227,110,.35)";
    ctx.beginPath(); ctx.arc(W - 34, HUD + 30, 24, 0, 7); ctx.fill();
    // 云
    var now = Date.now() * 0.0004;
    for (var i = 0; i < 3; i++) {
      var cx = ((i * 90 + now * 12) % (W + 80)) - 40;
      var cy = HUD + 26 + i * 34;
      ctx.fillStyle = "rgba(255,255,255,.85)";
      ctx.beginPath(); ctx.ellipse(cx, cy, 20, 9, 0, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.ellipse(cx - 12, cy + 3, 14, 7, 0, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.ellipse(cx + 12, cy + 3, 14, 7, 0, 0, 7); ctx.fill();
    }
    // 地面草地
    ctx.fillStyle = "#a5e07a";
    ctx.fillRect(0, H - 14, W, 14);
    ctx.fillStyle = "#8fd46a";
    ctx.fillRect(0, H - 5, W, 5);
  }

  /* 顶部教堂 + 彩色窗(漏掉一个暗一格) */
  function drawChurch(ctx, st) {
    var m = Core.maxMisses(st.diff);
    var roofY = HUD + 8;
    // 屋顶
    ctx.fillStyle = "#e0734f";
    ctx.beginPath();
    ctx.moveTo(0, roofY + 20); ctx.lineTo(W, roofY + 20);
    ctx.lineTo(W, roofY + 30); ctx.lineTo(0, roofY + 30);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#c95f3f";
    ctx.fillRect(0, roofY + 30, W, 6);
    // 窗户
    var winW = 26, gap = 12;
    var total = m * winW + (m - 1) * gap;
    var startX = (W - total) / 2;
    for (var i = 0; i < m; i++) {
      var wx = startX + i * (winW + gap);
      var lit = i >= st.misses;   // 还没漏掉的窗户是亮的
      var c1 = lit ? "#ffe98a" : "#5a6a7a";
      var c2 = lit ? "#8fd0ff" : "#3a4a5a";
      var g = ctx.createLinearGradient(wx, roofY + 8, wx + winW, roofY + 26);
      g.addColorStop(0, c1); g.addColorStop(1, c2);
      ctx.fillStyle = g;
      ctx.fillRect(wx, roofY + 8, winW, 18);
      ctx.strokeStyle = lit ? "#c98a2b" : "#2a3540";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(wx + 1, roofY + 9, winW - 2, 16);
      // 窗框十字
      ctx.strokeStyle = lit ? "#fff" : "#1f2933";
      ctx.beginPath();
      ctx.moveTo(wx + winW / 2, roofY + 8); ctx.lineTo(wx + winW / 2, roofY + 26);
      ctx.moveTo(wx, roofY + 17); ctx.lineTo(wx + winW, roofY + 17);
      ctx.stroke();
    }
  }

  function drawPerson(ctx, x, y, col, wave, rot) {
    ctx.save();
    ctx.translate(x, y);
    if (rot) ctx.rotate(rot);
    // 身体
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.ellipse(0, 5, 6.5, 8, 0, 0, 7);
    ctx.fill();
    // 头
    ctx.fillStyle = "#ffe0b8";
    ctx.beginPath(); ctx.arc(0, -6, 6, 0, 7); ctx.fill();
    ctx.strokeStyle = "#e0a860"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(0, -6, 6, 0, 7); ctx.stroke();
    // 脸
    ctx.fillStyle = "#5a3a20";
    ctx.beginPath(); ctx.arc(-2.2, -7, 1.1, 0, 7); ctx.arc(2.2, -7, 1.1, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(0, -4.5, 2.4, 0.1 * Math.PI, 0.9 * Math.PI); ctx.stroke();
    // 手臂(挥舞)
    var a = Math.sin(wave) * 1.6;
    ctx.strokeStyle = col;
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-5, 3); ctx.lineTo(-10, 1 - a * 4);
    ctx.moveTo(5, 3); ctx.lineTo(10, 1 + a * 4);
    ctx.stroke();
    ctx.restore();
  }

  function drawCaught(ctx, st) {
    for (var i = 0; i < st.caught.length; i++) {
      var c = st.caught[i];
      var bob = Math.sin(Date.now() * 0.01 + i) * 1.5;
      drawPerson(ctx, c.x, c.y + bob, "#f2a0a0", Date.now() * 0.01 + i, 0);
    }
  }

  function drawFallers(ctx, st) {
    var col = ["#f2a0a0", "#a0c8f2", "#c8f0a0", "#f2d0a0", "#d0a0f2"];
    for (var i = 0; i < st.fallers.length; i++) {
      var f = st.fallers[i];
      var rot = Math.sin(f.sway) * 0.4 + (f.spin < 0 ? -0.1 : 0.1);
      drawPerson(ctx, f.x, f.y, col[i % col.length], f.sway * 6, rot);
    }
  }

  function drawPad(ctx, st) {
    var hw = Core.padW(st.diff) / 2;
    var x = st.pad.x, y = PAD_Y;
    // 阴影
    ctx.fillStyle = "rgba(60,120,40,.15)";
    ctx.beginPath(); ctx.ellipse(x, y + 14, hw * 0.8, 5, 0, 0, 7); ctx.fill();
    // 毯子主体(红金条纹,像救生毯)
    ctx.fillStyle = "#f46a5a";
    ctx.beginPath();
    ctx.ellipse(x, y, hw, 11, 0, 0, 7);
    ctx.fill();
    ctx.strokeStyle = "#c9433a"; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.ellipse(x, y, hw, 11, 0, 0, 7); ctx.stroke();
    // 金色条纹
    ctx.fillStyle = "#ffd54f";
    ctx.fillRect(x - hw * 0.55, y - 4, hw * 0.3, 8);
    ctx.fillRect(x + hw * 0.25, y - 4, hw * 0.3, 8);
    // 两端抓手的结
    ctx.fillStyle = "#c9433a";
    ctx.beginPath(); ctx.arc(x - hw, y, 4, 0, 7); ctx.arc(x + hw, y, 4, 0, 7); ctx.fill();
  }

  function drawFx(ctx, st) {
    for (var i = 0; i < st.fxList.length; i++) {
      var f = st.fxList[i];
      var p = f.t / 40;
      if (f.type === "catch") {
        ctx.globalAlpha = 1 - p;
        ctx.fillStyle = "#ffe36e";
        ctx.beginPath();
        for (var k = 0; k < 5; k++) {
          var ang = k / 5 * Math.PI * 2 + p * 3;
          ctx.moveTo(f.x + Math.cos(ang) * 6 * p, f.y - 8 + Math.sin(ang) * 6 * p);
          ctx.arc(f.x + Math.cos(ang) * 8 * p, f.y - 8 + Math.sin(ang) * 8 * p, 2, 0, 7);
        }
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.font = "bold 12px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("+100", f.x, f.y - 18 - p * 14);
        ctx.globalAlpha = 1;
      } else {
        ctx.globalAlpha = 1 - p;
        ctx.strokeStyle = "#ff5252";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(f.x - 6, f.y - 6); ctx.lineTo(f.x + 6, f.y + 6);
        ctx.moveTo(f.x + 6, f.y - 6); ctx.lineTo(f.x - 6, f.y + 6);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }
  }

  function drawHUD(ctx, st) {
    ctx.fillStyle = "rgba(38,110,160,.94)";
    ctx.fillRect(0, 0, W, HUD);
    ctx.font = "bold 10px monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    var x = 5;
    function seg(label, val, color) {
      ctx.fillStyle = "#cfeaff";
      ctx.fillText(label, x, HUD / 2);
      x += ctx.measureText(label).width + 2;
      ctx.fillStyle = color || "#fff";
      ctx.fillText(String(val), x, HUD / 2);
      x += ctx.measureText(String(val)).width + 8;
    }
    seg("SCORE", st.score, "#fff7c4");
    seg("SAVED", st.caughtCount + "/" + Core.quota(st.level, st.diff), "#b8f0c0");
    seg("FLOOR", st.level, "#fff");
  }

  function drawOverlay(ctx, st) {
    if (st.mode === "menu") {
      ctx.fillStyle = "rgba(190,230,255,.55)";
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#2a5a80";
      ctx.font = "bold 18px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("Catch the Fallen", W / 2, H * 0.36);
      ctx.font = "11px sans-serif";
      ctx.fillStyle = "#4a7a9a";
      ctx.fillText("Tap to start", W / 2, H * 0.46);
    } else if (st.mode === "intro") {
      ctx.fillStyle = "rgba(190,230,255,.5)";
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#2a5a80";
      ctx.font = "bold 14px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("Rescue " + Core.quota(st.level, st.diff) + " people", W / 2, H / 2);
      ctx.font = "10px sans-serif";
      ctx.fillText("Tap to begin", W / 2, H / 2 + 20);
    } else if (st.mode === "lose") {
      ctx.fillStyle = "rgba(40,60,90,.7)";
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#ffd54f";
      ctx.font = "bold 15px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(st.msg || "Game Over", W / 2, H / 2);
      ctx.font = "10px sans-serif";
      ctx.fillStyle = "#ffe0b2";
      ctx.fillText("Tap to retry", W / 2, H / 2 + 22);
    } else if (st.mode === "win") {
      ctx.fillStyle = "rgba(255,240,180,.3)";
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#5a3a20";
      ctx.font = "bold 14px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(st.msg || "All safe!", W / 2, H / 2);
      ctx.font = "10px sans-serif";
      ctx.fillStyle = "#8a6a40";
      ctx.fillText("Tap to continue", W / 2, H / 2 + 22);
    }
  }

  function draw(ctx, st, time, dt) {
    drawBackground(ctx);
    drawChurch(ctx, st);
    drawCaught(ctx, st);
    drawFallers(ctx, st);
    drawPad(ctx, st);
    drawFx(ctx, st);
    drawHUD(ctx, st);
    drawOverlay(ctx, st);
  }

  return { draw:draw, drawBackground:drawBackground, drawChurch:drawChurch,
           drawCaught:drawCaught, drawFallers:drawFallers, drawPad:drawPad,
           drawFx:drawFx, drawHUD:drawHUD, drawOverlay:drawOverlay,
           drawPerson:drawPerson, roundRect:roundRect };
})();

if (typeof module !== "undefined") module.exports = Render;
