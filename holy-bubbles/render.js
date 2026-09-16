/* Holy Bubbles · Read-only Canvas2D renderer */
"use strict";

var Render = (function () {
  var T = Core.T;
  var COLS = Core.COLS, ROWS = Core.ROWS;
  var HUD = Core.HUD, H = Core.H, W = Core.W;

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  /* 四叶草:4 片圆润叶片 + 小茎(1 次 fill,泡泡堂草地的标志性纹理) */
  function drawClover(ctx, x, y, s, col) {
    ctx.fillStyle = col;
    ctx.beginPath();
    for (var i = 0; i < 4; i++) {
      var a = i * Math.PI / 2 - Math.PI / 2;
      ctx.ellipse(x + Math.cos(a) * s * 0.42, y + Math.sin(a) * s * 0.42, s * 0.42, s * 0.42, 0, 0, 7);
    }
    ctx.moveTo(x - s * 0.07, y + s * 0.28);
    ctx.quadraticCurveTo(x - s * 0.2, y + s * 0.85, x, y + s * 0.92);
    ctx.quadraticCurveTo(x + s * 0.2, y + s * 0.85, x + s * 0.07, y + s * 0.28);
    ctx.closePath();
    ctx.fill();
  }

  /* 翠绿草地 + 四叶草纹理(俯视,泡泡堂式)
     草地是静态的 → 首次绘制后缓存到离屏 canvas,之后每帧只 drawImage 一次。
     (原来每帧重画 150 个四叶草 = 750 次 ellipse 调用,是主要帧耗) */
  function paintBackground(g) {
    var grad = g.createLinearGradient(0, 0, 0, H - HUD);
    grad.addColorStop(0, "#98e44d");
    grad.addColorStop(1, "#69bf2f");
    g.fillStyle = grad;
    g.fillRect(0, 0, W, H - HUD);
    for (var r = 0; r < ROWS; r++) {
      for (var c = 0; c < COLS; c++) {
        var x = c * T + T / 2, y = r * T + T / 2;
        if ((r + c) % 2 === 0) drawClover(g, x, y, T * 0.5, "rgba(36,112,16,.38)");
        else drawClover(g, x, y, T * 0.34, "rgba(255,255,255,.22)");
      }
    }
    g.fillStyle = "rgba(255,255,255,.16)";
    g.fillRect(0, 0, 1, H - HUD);
  }

  var bgCache = null;
  function getBgCache() {
    if (bgCache) return bgCache;
    if (typeof document === "undefined" || !document.createElement) return null;
    try {
      var c = document.createElement("canvas");
      c.width = W; c.height = H - HUD;
      paintBackground(c.getContext("2d"));
      bgCache = c;
    } catch (e) { bgCache = null; }
    return bgCache;
  }

  function drawBackground(ctx) {
    var c = getBgCache();
    if (c) { ctx.drawImage(c, 0, HUD); return; }
    ctx.save();
    ctx.translate(0, HUD);
    paintBackground(ctx);
    ctx.restore();
  }

  function drawHUD(ctx, st) {
    ctx.fillStyle = "rgba(38,110,160,.94)";
    ctx.fillRect(0, 0, W, HUD);
    ctx.font = "bold 10px monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    var p = st.player;
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
    seg("LIVES", p ? p.lives : 0, "#ffb3c1");
    seg("PWR", p ? p.power : 1, "#ffe08a");
    seg("BMB", p ? p.maxBombs : 1, "#b8e6ff");
    seg("FLOOR", st.level, "#fff");
    if (st.combo > 1) {
      ctx.fillStyle = "#ff8a5c";
      ctx.font = "bold 11px monospace";
      ctx.fillText("x" + st.combo, x, HUD / 2);
    }
  }

  /* 泡泡堂方块: solid=浅蓝白实心砖(3D顶面), ice=半透明蓝色冰块(高光斜纹+闪光) */
  function drawBlock(ctx, x, y, solid) {
    var b = 2.5, s = T - 2 * b, X = x + b, Y = y + b;
    ctx.fillStyle = "rgba(40,95,25,.26)";
    ctx.beginPath(); ctx.ellipse(x + T / 2, y + T - 1.5, T * 0.34, 3.2, 0, 0, 7); ctx.fill();
    if (solid) {
      ctx.fillStyle = "#dfe8f0";
      roundRect(ctx, X, Y, s, s, 4); ctx.fill();
      ctx.fillStyle = "#b9cbda";
      roundRect(ctx, X + s - 5, Y, 5, s, 2); ctx.fill();
      ctx.fillStyle = "#f8fbfe";
      roundRect(ctx, X, Y, s, 6, 3); ctx.fill();
      ctx.strokeStyle = "#93a9bc"; ctx.lineWidth = 1;
      roundRect(ctx, X, Y, s, s, 4); ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,.75)";
      roundRect(ctx, X + 3, Y + 1.5, s - 10, 2.5, 1.5); ctx.fill();
    } else {
      ctx.fillStyle = "rgba(135,212,255,.45)";
      roundRect(ctx, X, Y, s, s, 4); ctx.fill();
      ctx.strokeStyle = "rgba(80,175,238,.9)"; ctx.lineWidth = 1.5;
      roundRect(ctx, X, Y, s, s, 4); ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,.6)";
      roundRect(ctx, X + 2.5, Y + 2.5, s - 5, 4, 2); ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,.45)"; ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(X + 3, Y + s - 3); ctx.lineTo(X + s - 3, Y + 7);
      ctx.stroke();
      ctx.fillStyle = "rgba(95,190,255,.45)";
      roundRect(ctx, X + s - 5.5, Y + 3, 4.5, s - 6, 2); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,.85)";
      ctx.beginPath(); ctx.arc(X + 5, Y + s - 5, 1.1, 0, 7); ctx.fill();
    }
  }

  function drawMap(ctx, st) {
    for (var r = 0; r < ROWS; r++)
      for (var c = 0; c < COLS; c++) {
        var v = st.map[r * COLS + c], x = c * T, y = r * T + HUD;
        if (v === 1) drawBlock(ctx, x, y, true);
        else if (v === 2) drawBlock(ctx, x, y, false);
      }
  }

  var DROP_STYLE = {
    fire:   { bg:"#ffd54f", fg:"#ff5722" },
    bomb:   { bg:"#90caf9", fg:"#283593" },
    speed:  { bg:"#a5d6a7", fg:"#1b5e20" },
    shield: { bg:"#ce93d8", fg:"#4a148c" },
    life:   { bg:"#ef9a9a", fg:"#b71c1c" }
  };

  function drawDrops(ctx, st) {
    for (var i = 0; i < st.drops.length; i++) {
      var d = st.drops[i];
      var x = d.c * T + T / 2, y = d.r * T + T / 2 + HUD + Math.sin(Date.now() * 0.005 + d.c) * 2;
      var s = DROP_STYLE[d.type];
      ctx.save();
      ctx.translate(x, y);
      ctx.fillStyle = "rgba(90,50,30,.18)";
      ctx.beginPath();
      ctx.ellipse(0, 12, 8, 2.5, 0, 0, 7);
      ctx.fill();
      var glow = ctx.createRadialGradient(0, 0, 3, 0, 0, 16);
      glow.addColorStop(0, s.bg + "44");
      glow.addColorStop(1, s.bg + "00");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(0, 0, 16, 0, 7);
      ctx.fill();
      var bg3 = ctx.createLinearGradient(0, -10, 0, 10);
      bg3.addColorStop(0, "#ffffff");
      bg3.addColorStop(0.2, s.bg);
      bg3.addColorStop(1, s.fg + "aa");
      ctx.fillStyle = bg3;
      roundRect(ctx, -10, -10, 20, 20, 5);
      ctx.fill();
      ctx.strokeStyle = "rgba(60,30,20,.3)";
      ctx.lineWidth = 1.5;
      roundRect(ctx, -10, -10, 20, 20, 5);
      ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,.5)";
      roundRect(ctx, -7, -8, 14, 3, 2);
      ctx.fill();
      ctx.fillStyle = s.fg;
      if (d.type === "fire") {
        ctx.beginPath();
        ctx.moveTo(0, -7);
        ctx.quadraticCurveTo(6, 0, 0, 7);
        ctx.quadraticCurveTo(-6, 0, 0, -7);
        ctx.fill();
      } else if (d.type === "bomb") {
        ctx.beginPath();
        ctx.arc(0, 1, 5, 0, 7);
        ctx.fill();
        ctx.fillRect(-1, -8, 2, 4);
      } else if (d.type === "speed") {
        ctx.beginPath();
        ctx.moveTo(-6, 5);
        ctx.lineTo(2, -6);
        ctx.lineTo(2, -1);
        ctx.lineTo(6, -1);
        ctx.lineTo(-2, 6);
        ctx.lineTo(-2, 1);
        ctx.closePath();
        ctx.fill();
      } else if (d.type === "shield") {
        ctx.beginPath();
        ctx.moveTo(0, -7);
        ctx.lineTo(6, -4);
        ctx.lineTo(6, 2);
        ctx.quadraticCurveTo(6, 6, 0, 8);
        ctx.quadraticCurveTo(-6, 6, -6, 2);
        ctx.lineTo(-6, -4);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.font = "bold 14px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("H", 0, 1);
      }
      ctx.restore();
    }
  }

  /* 圣光水柱(替代火焰):蓝色发光水柱 + 上升气泡 */
  function drawFlames(ctx, st) {
    for (var i = 0; i < st.flames.length; i++) {
      var f = st.flames[i];
      var cx = f.c * T + T / 2, cy = f.r * T + T / 2 + HUD, p = f.t / 24;
      ctx.globalAlpha = Math.min(1, p * 1.4);
      var halo = ctx.createRadialGradient(cx, cy, 3, cx, cy, T * 0.6 * p + 10);
      halo.addColorStop(0, "rgba(200,240,255,.85)");
      halo.addColorStop(0.5, "rgba(140,215,255,.45)");
      halo.addColorStop(1, "rgba(140,215,255,0)");
      ctx.fillStyle = halo;
      ctx.beginPath(); ctx.arc(cx, cy, T * 0.6 * p + 10, 0, 7); ctx.fill();
      var arm = T * (0.3 + 0.4 * p);
      ctx.fillStyle = "#5fc0ff";
      roundRect(ctx, cx - arm, cy - 4, arm * 2, 8, 3); ctx.fill();
      roundRect(ctx, cx - 4, cy - arm, 8, arm * 2, 3); ctx.fill();
      ctx.fillStyle = "#bfe9ff";
      roundRect(ctx, cx - arm * 0.6, cy - 2, arm * 1.2, 4, 2); ctx.fill();
      roundRect(ctx, cx - 2, cy - arm * 0.6, 4, arm * 1.2, 2); ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.beginPath(); ctx.arc(cx, cy, 4 * p + 2.5, 0, 7); ctx.fill();
      var now = Date.now() * 0.01;
      for (var b = 0; b < 3; b++) {
        var by = cy - ((now * 14 + b * 9) % (T * 0.7));
        var bx = cx + Math.sin(now + b * 2) * 5;
        ctx.fillStyle = "rgba(255,255,255,.7)";
        ctx.beginPath(); ctx.arc(bx, by, 1.5 + (b % 2), 0, 7); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  }

  function drawPoofs(ctx, st) {
    for (var i = 0; i < st.poofs.length; i++) {
      var p = st.poofs[i];
      var prog = 1 - p.t / (p.big ? 60 : 36);
      ctx.globalAlpha = 1 - prog;
      ctx.fillStyle = "#fff";
      for (var j = 0; j < 5; j++) {
        var ang = j / 5 * Math.PI * 2 + prog * 2;
        var dist = prog * 16;
        ctx.beginPath();
        ctx.arc(p.x + Math.cos(ang) * dist, p.y + HUD + Math.sin(ang) * dist * 0.7, 5 * (1 - prog) + 1.5, 0, 7);
        ctx.fill();
      }
      var sy = p.y - prog * 22 + HUD;
      ctx.globalAlpha = (1 - prog) * 0.9;
      ctx.fillStyle = "#fffde7";
      ctx.beginPath();
      ctx.arc(p.x, sy, 6, 0, 7);
      ctx.fill();
      ctx.strokeStyle = "#ffd54f";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(p.x, sy - 8, 4, 1.5, 0, 0, 7);
      ctx.stroke();
      ctx.fillStyle = "#fff8e1";
      ctx.beginPath();
      ctx.ellipse(p.x - 6, sy, 3, 2, -0.5, 0, 7);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(p.x + 6, sy, 3, 2, 0.5, 0, 7);
      ctx.fill();
      ctx.strokeStyle = "#a1887f";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(p.x - 2, sy - 1, 1.5, 0.1 * Math.PI, 0.9 * Math.PI);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(p.x + 2, sy - 1, 1.5, 0.1 * Math.PI, 0.9 * Math.PI);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  /* 泡泡堂标志:红色圆柱油桶炸弹 + 蓝色底环 + 白色闪光 + 导火索火花 */
  function drawBombs(ctx, st, isPlayer) {
    var now = Date.now();
    for (var i = 0; i < st.bombs.length; i++) {
      var b = st.bombs[i];
      var x = (b.x !== undefined ? b.x : b.c * T + T / 2);
      var y = (b.y !== undefined ? b.y : b.r * T + T / 2) + HUD;
      ctx.fillStyle = "rgba(30,70,20,.26)";
      ctx.beginPath(); ctx.ellipse(x, y + T * 0.23, T * 0.24, T * 0.07, 0, 0, 7); ctx.fill();

      var hw = T * 0.27, hh = T * 0.29;
      var top = y - hh, bot = y + hh;
      var mine = b.owner === "player";
      var body = mine ? "#e8433a" : "#d9543f";
      var dark = mine ? "#b0241d" : "#a2301f";

      var grad = ctx.createLinearGradient(x - hw, 0, x + hw, 0);
      grad.addColorStop(0, "#ff8a76");
      grad.addColorStop(0.35, body);
      grad.addColorStop(1, dark);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(x - hw, top + 2);
      ctx.lineTo(x - hw, bot);
      ctx.quadraticCurveTo(x - hw, bot + 5, x - hw * 0.55, bot + 5);
      ctx.lineTo(x + hw * 0.55, bot + 5);
      ctx.quadraticCurveTo(x + hw, bot + 5, x + hw, bot);
      ctx.lineTo(x + hw, top + 2);
      ctx.quadraticCurveTo(x + hw, top - 4, x + hw * 0.5, top - 4);
      ctx.lineTo(x - hw * 0.5, top - 4);
      ctx.quadraticCurveTo(x - hw, top - 4, x - hw, top + 2);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = mine ? "#2f6fd0" : "#3d76b8";
      roundRect(ctx, x - hw + 1, bot - 5, hw * 2 - 2, 6.5, 2); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,.3)";
      roundRect(ctx, x - hw + 1, bot - 5, hw * 2 - 2, 1.6, 1); ctx.fill();

      ctx.fillStyle = "#ff9d8a";
      ctx.beginPath(); ctx.ellipse(x, top - 3, hw * 0.55, hw * 0.22, 0, 0, 7); ctx.fill();
      ctx.strokeStyle = dark; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(x, top - 3, hw * 0.55, hw * 0.22, 0, 0, 7); ctx.stroke();

      ctx.fillStyle = "rgba(255,255,255,.85)";
      ctx.beginPath();
      ctx.arc(x - hw * 0.45, top + 3, 1.7, 0, 7);
      ctx.arc(x + hw * 0.22, top + 9, 1.1, 0, 7);
      ctx.arc(x - hw * 0.2, top + 13, 1.0, 0, 7);
      ctx.fill();

      var sp = Math.floor(now * 0.02 + b.c + b.r) % 2 === 0;
      ctx.fillStyle = sp ? "#ffe14d" : "#ff9a3d";
      ctx.beginPath(); ctx.arc(x, top - 6, 2.4 + (sp ? 0.8 : 0), 0, 7); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,.9)";
      ctx.beginPath(); ctx.arc(x - 0.6, top - 6.7, 0.9, 0, 7); ctx.fill();

      if (b.kicked) {
        ctx.strokeStyle = "rgba(255,255,255,.85)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x - (b.vx || 0) * 3, y - (b.vy || 0) * 3);
        ctx.lineTo(x - (b.vx || 0) * 8, y - (b.vy || 0) * 8);
        ctx.stroke();
      }
    }
  }

  /* ===== 泡泡堂式蛋形角色 =====
     蛋形身体 + 水汪汪大眼睛直接长在蛋上 + 球面高光 */
  function drawEgg(ctx, x, y, rx, ry, color, dark) {
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, 7); ctx.fill();
    ctx.strokeStyle = dark || "rgba(0,0,0,.18)";
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, 7); ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,.38)";
    ctx.beginPath(); ctx.ellipse(x - rx * 0.32, y - ry * 0.42, rx * 0.28, ry * 0.16, -0.45, 0, 7); ctx.fill();
  }
  function drawBigEyes(ctx, x, y, rage, gap, s) {
    var ex = gap || 5, sc = s || 1;
    var wr = 3.8 * sc, pr = 2.2 * sc;
    ctx.fillStyle = "#fff";
    ctx.beginPath(); ctx.arc(x - ex, y, wr, 0, 7); ctx.arc(x + ex, y, wr, 0, 7); ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,.15)"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(x - ex, y, wr, 0, 7); ctx.stroke();
    ctx.beginPath(); ctx.arc(x + ex, y, wr, 0, 7); ctx.stroke();
    ctx.fillStyle = rage ? "#e53935" : "#2b1f14";
    ctx.beginPath(); ctx.arc(x - ex, y + 0.5 * sc, pr, 0, 7); ctx.arc(x + ex, y + 0.5 * sc, pr, 0, 7); ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.beginPath(); ctx.arc(x - ex - 1.1 * sc, y - 1.1 * sc, 1.1 * sc, 0, 7); ctx.arc(x + ex - 1.1 * sc, y - 1.1 * sc, 1.1 * sc, 0, 7); ctx.fill();
  }
  function drawSmile(ctx, x, y, s, col) {
    ctx.strokeStyle = col || "rgba(0,0,0,.5)";
    ctx.lineWidth = 1.6; ctx.lineCap = "round";
    ctx.beginPath(); ctx.arc(x, y, 3.2 * (s || 1), 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
  }
  function drawOpenMouth(ctx, x, y, s) {
    ctx.fillStyle = "#5a2a1a";
    ctx.beginPath(); ctx.arc(x, y, 3 * (s || 1), 0, Math.PI); ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.fillRect(x - 2.5 * (s || 1), y - 0.5, 1.6 * (s || 1), 1.6);
    ctx.fillRect(x + 1 * (s || 1), y - 0.5, 1.6 * (s || 1), 1.6);
  }

  function drawDemon(ctx, en, time) {
    var x = en.x, y = en.y + HUD;
    var bob = Math.sin(time * 5 + en.c * 2) * 1.5;
    ctx.fillStyle = "rgba(80,60,20,.15)";
    ctx.beginPath(); ctx.ellipse(x, y + T * 0.36, T * 0.2, T * 0.05, 0, 0, 7); ctx.fill();

    var rage = !!en.rage;
    var RX = T * 0.34, RY = T * 0.42;   // 泡泡堂蛋形身体半径
    if (rage) {   // 暴怒:红色抖动光晕
      var rj = Math.sin(time * 30) * 1.5;
      x += rj;
      ctx.fillStyle = "rgba(255,60,40,.25)";
      ctx.beginPath(); ctx.arc(x, y + bob, T * 0.5, 0, 7); ctx.fill();
    }

    if (en.kind === "hound") {
      // 橙红蛋形小狗:立耳 + 翘尾 + 吐舌
      drawEgg(ctx, x, y + bob, RX, RY, "#ff8a5c", "#d96a3c");
      ctx.fillStyle = "#ff8a5c";
      ctx.beginPath(); ctx.moveTo(x - RX * 0.6, y - RY * 0.7 + bob); ctx.lineTo(x - RX * 0.35, y - RY * 1.25 + bob); ctx.lineTo(x - RX * 0.05, y - RY * 0.8 + bob); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(x + RX * 0.6, y - RY * 0.7 + bob); ctx.lineTo(x + RX * 0.35, y - RY * 1.25 + bob); ctx.lineTo(x + RX * 0.05, y - RY * 0.8 + bob); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = "#ff8a5c"; ctx.lineWidth = 4; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(x - RX * 0.8, y - RY * 0.1 + bob);
      ctx.quadraticCurveTo(x - RX * 1.3, y - RY * 0.7 + bob, x - RX * 1.1 + Math.sin(time * 9) * 2, y - RY * 1.1 + bob); ctx.stroke();
      drawBigEyes(ctx, x, y - RY * 0.15 + bob, rage, 5.5);
      ctx.fillStyle = "#c0392b";
      ctx.beginPath(); ctx.arc(x, y + RY * 0.15 + bob, 2, 0, 7); ctx.fill();
      ctx.fillStyle = "#ff6a6a";
      ctx.beginPath(); ctx.arc(x + 3, y + RY * 0.3 + bob, 3, 0.1 * Math.PI, 0.9 * Math.PI); ctx.fill();
    } else if (en.kind === "imp") {
      // 粉紫蛋形小恶魔:角 + 蝙蝠翅
      var flap = Math.sin(time * 11) * 2.5;
      ctx.fillStyle = "#c2185b";
      ctx.beginPath();
      ctx.moveTo(x - RX * 0.7, y - RY * 0.1 + bob); ctx.quadraticCurveTo(x - RX * 1.4, y - RY * 0.9 - flap + bob, x - RX * 1.15, y + RY * 0.25 + bob);
      ctx.quadraticCurveTo(x - RX * 0.85, y - RY * 0.05 + bob, x - RX * 0.7, y + RY * 0.1 + bob); ctx.closePath(); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x + RX * 0.7, y - RY * 0.1 + bob); ctx.quadraticCurveTo(x + RX * 1.4, y - RY * 0.9 - flap + bob, x + RX * 1.15, y + RY * 0.25 + bob);
      ctx.quadraticCurveTo(x + RX * 0.85, y - RY * 0.05 + bob, x + RX * 0.7, y + RY * 0.1 + bob); ctx.closePath(); ctx.fill();
      drawEgg(ctx, x, y + bob, RX, RY, "#f48fb1", "#c2185b");
      ctx.fillStyle = "#880e4f";
      ctx.beginPath(); ctx.moveTo(x - RX * 0.35, y - RY * 0.7 + bob); ctx.lineTo(x - RX * 0.5, y - RY * 1.2 + bob); ctx.lineTo(x - RX * 0.05, y - RY * 0.9 + bob); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(x + RX * 0.35, y - RY * 0.7 + bob); ctx.lineTo(x + RX * 0.5, y - RY * 1.2 + bob); ctx.lineTo(x + RX * 0.05, y - RY * 0.9 + bob); ctx.closePath(); ctx.fill();
      drawBigEyes(ctx, x, y - RY * 0.15 + bob, rage);
      drawSmile(ctx, x, y + RY * 0.2 + bob);
    } else if (en.kind === "ghost") {
      // 淡紫幽灵:蛋形 + 波浪下摆
      var fl = Math.sin(time * 3) * 2.5;
      ctx.globalAlpha = 0.88;
      ctx.fillStyle = "#d9c6ff";
      ctx.beginPath();
      ctx.arc(x, y + fl, RX, Math.PI, 0);
      ctx.quadraticCurveTo(x + RX, y + RY * 0.9 + fl, x + RX * 0.5, y + RY * 0.7 + fl);
      ctx.quadraticCurveTo(x, y + RY * 1.0 + fl, x - RX * 0.5, y + RY * 0.7 + fl);
      ctx.quadraticCurveTo(x - RX, y + RY * 0.9 + fl, x - RX, y + fl);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#9c7cd6";
      ctx.beginPath(); ctx.moveTo(x - 5, y - 6 + fl); ctx.lineTo(x - 8, y - 14 + fl); ctx.lineTo(x - 2, y - 9 + fl); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(x + 5, y - 6 + fl); ctx.lineTo(x + 8, y - 14 + fl); ctx.lineTo(x + 2, y - 9 + fl); ctx.closePath(); ctx.fill();
      drawBigEyes(ctx, x, y - 2 + fl, rage);
      drawSmile(ctx, x, y + 4 + fl);
    } else if (en.kind === "brute") {
      // 红蛋形蛮牛:大弯角
      ctx.strokeStyle = "#fff5ea"; ctx.lineWidth = 4.5; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(x - RX * 0.5, y - RY * 0.5 + bob); ctx.quadraticCurveTo(x - RX * 1.1, y - RY * 0.85 + bob, x - RX * 1.15, y - RY * 1.3 + bob); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x + RX * 0.5, y - RY * 0.5 + bob); ctx.quadraticCurveTo(x + RX * 1.1, y - RY * 0.85 + bob, x + RX * 1.15, y - RY * 1.3 + bob); ctx.stroke();
      drawEgg(ctx, x, y + bob, RX, RY, "#ff7a5c", "#c0392b");
      drawBigEyes(ctx, x, y - RY * 0.12 + bob, rage);
      ctx.fillStyle = "#c0392b";
      ctx.beginPath(); ctx.arc(x - 4, y + RY * 0.18 + bob, 1.8, 0, 7); ctx.arc(x + 4, y + RY * 0.18 + bob, 1.8, 0, 7); ctx.fill();
    } else if (en.kind === "bomber") {
      // 棕蛋形轰炸魔:兜帽 + 金眼 + 手持小炸弹
      drawEgg(ctx, x, y + bob, RX, RY, "#8a6a4a", "#5a4530");
      ctx.fillStyle = "#5a4530";
      ctx.beginPath(); ctx.arc(x, y - RY * 0.15 + bob, RX * 0.85, Math.PI, 0); ctx.fill();
      ctx.fillStyle = "#ffd54f";
      ctx.beginPath(); ctx.arc(x - 5, y - RY * 0.25 + bob, 3, 0, 7); ctx.arc(x + 5, y - RY * 0.25 + bob, 3, 0, 7); ctx.fill();
      ctx.fillStyle = "#2b1f14";
      ctx.beginPath(); ctx.arc(x - 5, y - RY * 0.25 + bob, 1.5, 0, 7); ctx.arc(x + 5, y - RY * 0.25 + bob, 1.5, 0, 7); ctx.fill();
      ctx.fillStyle = "#3a2a1a";
      ctx.beginPath(); ctx.arc(x + RX * 0.85, y + RY * 0.3 + bob, 4, 0, 7); ctx.fill();
      ctx.fillStyle = "#ffd54f"; ctx.beginPath(); ctx.arc(x + RX * 0.85, y + RY * 0.3 + bob, 1.4, 0, 7); ctx.fill();
    } else if (en.kind === "miniboss" || en.kind === "bigboss") {
      var scale = en.kind === "bigboss" ? 1.25 : 1.05;
      ctx.save(); ctx.translate(x, y + bob); ctx.scale(scale, scale);
      var bp = Math.sin(time * 8) * 3;
      ctx.fillStyle = en.kind === "bigboss" ? "#4a2a55" : "#3a2a45";
      ctx.beginPath();
      ctx.moveTo(-RX * 0.6, -RY * 0.1); ctx.quadraticCurveTo(-RX * 1.9, -RY * 1.5 - bp, -RX * 1.6, RY * 0.4);
      ctx.quadraticCurveTo(-RX * 1.05, RY * 0.05, -RX * 0.6, RY * 0.25); ctx.closePath(); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(RX * 0.6, -RY * 0.1); ctx.quadraticCurveTo(RX * 1.9, -RY * 1.5 - bp, RX * 1.6, RY * 0.4);
      ctx.quadraticCurveTo(RX * 1.05, RY * 0.05, RX * 0.6, RY * 0.25); ctx.closePath(); ctx.fill();
      drawEgg(ctx, 0, 0, RX, RY, en.kind === "bigboss" ? "#c0392b" : "#e6e0ec", en.kind === "bigboss" ? "#8e1f1f" : "#9a8aa5");
      if (en.kind === "bigboss") {
        ctx.fillStyle = "#ffd54f";
        for (var i = -1; i <= 1; i++) {
          ctx.beginPath(); ctx.moveTo(i * 7 - 4, -RY * 0.8); ctx.lineTo(i * 7, -RY * 1.15); ctx.lineTo(i * 7 + 4, -RY * 0.8); ctx.closePath(); ctx.fill();
        }
        ctx.strokeStyle = "#4a148c"; ctx.lineWidth = 4.5; ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(-RX * 0.5, -RY * 0.55); ctx.quadraticCurveTo(-RX * 1.1, -RY * 1.1, -RX * 0.7, -RY * 1.35); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(RX * 0.5, -RY * 0.55); ctx.quadraticCurveTo(RX * 1.1, -RY * 1.1, RX * 0.7, -RY * 1.35); ctx.stroke();
      }
      drawBigEyes(ctx, 0, -RY * 0.12, rage, 6.5, 1.1);
      drawOpenMouth(ctx, 0, RY * 0.35, 1.2);
      ctx.restore();
    }

    if (en.boss && !en.dead) {
      var bw = T * 0.7, bx = x - bw / 2, by = y - T * 0.55;
      if (!(en.hitFlash > 0 && en.hitFlash % 8 < 4)) {
        ctx.fillStyle = "rgba(0,0,0,.4)";
        ctx.fillRect(bx - 1, by - 1, bw + 2, 5);
        ctx.fillStyle = en.kind === "bigboss" ? "#ff5252" : "#ffd54f";
        ctx.fillRect(bx, by, bw * (en.hp / en.maxHp), 3);
      }
    }

    /* 被困进圣泡:半透明金泡包裹 + 高光;快挣脱时闪红提醒 */
    if (en.trapped) {
      var tr = T * 0.5;
      var wob = Math.sin(Date.now() * 0.02) * 1.5;
      ctx.fillStyle = "rgba(255,239,176,.30)";
      ctx.beginPath(); ctx.arc(x, y, tr + wob, 0, 7); ctx.fill();
      ctx.strokeStyle = "rgba(255,200,80,.85)";
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, y, tr + wob, 0, 7); ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,.65)";
      ctx.beginPath(); ctx.ellipse(x - tr * 0.32, y - tr * 0.4, tr * 0.28, tr * 0.16, -0.6, 0, 7); ctx.fill();
      if (en.trapT < 60 && Math.floor(en.trapT / 5) % 2 === 0) {
        ctx.strokeStyle = "rgba(255,90,90,.9)";
        ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.arc(x, y, tr + wob, 0, 7); ctx.stroke();
      }
    }
  }

  function drawPlayer(ctx, st, time) {
    var p = st.player;
    if (!p) return;
    if (p.hurtT > 0 && p.hurtT % 10 < 5) return;
    var x = p.x, y = p.y + HUD;
    if (p.shield > 0) {
      ctx.strokeStyle = "rgba(206,147,216,.7)";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(x, y, T * 0.45 + Math.sin(Date.now() * 0.01) * 1.5, 0, 7);
      ctx.stroke();
    }
    var aura = ctx.createRadialGradient(x, y + T * 0.25, 2, x, y + T * 0.25, T * 0.5);
    aura.addColorStop(0, "rgba(255,240,180,.35)");
    aura.addColorStop(1, "rgba(255,240,180,0)");
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.arc(x, y + T * 0.25, T * 0.5, 0, 7);
    ctx.fill();
    var flap = Math.sin(time * 9) * 3;
    var RXp = T * 0.34, RYp = T * 0.42;
    // 白翅膀
    ctx.fillStyle = "#fff8e1";
    ctx.beginPath();
    ctx.moveTo(x - RXp * 0.6, y - RYp * 0.1); ctx.quadraticCurveTo(x - RXp * 1.4, y - RYp * 0.9 - flap, x - RXp * 1.15, y + RYp * 0.3);
    ctx.quadraticCurveTo(x - RXp * 0.8, y - RYp * 0.05, x - RXp * 0.6, y + RYp * 0.15); ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x + RXp * 0.6, y - RYp * 0.1); ctx.quadraticCurveTo(x + RXp * 1.4, y - RYp * 0.9 - flap, x + RXp * 1.15, y + RYp * 0.3);
    ctx.quadraticCurveTo(x + RXp * 0.8, y - RYp * 0.05, x + RXp * 0.6, y + RYp * 0.15); ctx.closePath(); ctx.fill();
    // 白色蛋形身体
    drawEgg(ctx, x, y, RXp, RYp, "#fffdf5", "#e8d8b0");
    // 金色光环
    ctx.strokeStyle = "#ffd54f"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(x, y - RYp * 1.05, RXp * 0.5, RYp * 0.15, 0, 0, 7); ctx.stroke();
    // 大眼睛 + 微笑 + 红晕
    drawBigEyes(ctx, x, y - RYp * 0.15, false);
    drawSmile(ctx, x, y + RYp * 0.2);
    ctx.fillStyle = "rgba(255,150,160,.5)";
    ctx.beginPath(); ctx.arc(x - RXp * 0.75, y + RYp * 0.05, 2.5, 0, 7); ctx.arc(x + RXp * 0.75, y + RYp * 0.05, 2.5, 0, 7); ctx.fill();

    /* 天使被困进黑暗泡:深紫半透明泡包裹 */
    if (p.trapped) {
      var tr2 = T * 0.5;
      var wob2 = Math.sin(Date.now() * 0.03) * 2;
      ctx.fillStyle = "rgba(60,30,90,.35)";
      ctx.beginPath(); ctx.arc(x, y, tr2 + wob2, 0, 7); ctx.fill();
      ctx.strokeStyle = "rgba(150,100,220,.9)";
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, y, tr2 + wob2, 0, 7); ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,.5)";
      ctx.beginPath(); ctx.ellipse(x - tr2 * 0.32, y - tr2 * 0.4, tr2 * 0.28, tr2 * 0.16, -0.6, 0, 7); ctx.fill();
    }
  }

  function drawOverlay(ctx, st) {
    if (st.mode === "menu") {
      ctx.fillStyle = "rgba(255,240,180,.6)";
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#5d2e1a";
      ctx.font = "bold 18px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("Holy Bubbles", W / 2, H * 0.35);
      ctx.font = "11px sans-serif";
      ctx.fillStyle = "#8d4a2f";
      ctx.fillText("Tap to start", W / 2, H * 0.45);
    } else if (st.mode === "intro") {
      ctx.fillStyle = "rgba(255,240,180,.5)";
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#5d2e1a";
      ctx.font = "bold 14px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("Floor " + st.level, W / 2, H / 2);
      ctx.font = "10px sans-serif";
      ctx.fillText("Tap to begin", W / 2, H / 2 + 20);
    } else if (st.mode === "lose") {
      ctx.fillStyle = "rgba(80,20,10,.7)";
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#ffd54f";
      ctx.font = "bold 16px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(st.msg || "Game Over", W / 2, H / 2);
      ctx.font = "10px sans-serif";
      ctx.fillStyle = "#ffe0b2";
      ctx.fillText("Tap to retry", W / 2, H / 2 + 22);
    } else if (st.mode === "win") {
      ctx.fillStyle = "rgba(255,240,180,.3)";
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#fffde7";
      ctx.font = "bold 14px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(st.msg || "Floor cleared!", W / 2, H / 2);
      ctx.font = "10px sans-serif";
      ctx.fillStyle = "#ffe0b2";
      ctx.fillText("Tap to continue", W / 2, H / 2 + 22);
    }

    /* 被困挣扎提示:连点方向键的进度条 */
    if (st.player && st.player.trapped && st.mode === "play") {
      ctx.fillStyle = "rgba(20,10,40,.4)";
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#fff";
      ctx.font = "bold 13px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("Mash the arrows!", W / 2, H * 0.42);
      var need = Core.STRUGGLE_NEED || 6;
      var got = Math.min(st.player.struggleN || 0, need);
      ctx.fillStyle = "rgba(255,255,255,.35)";
      ctx.fillRect(W / 2 - 40, H * 0.48, 80, 8);
      ctx.fillStyle = "#ffd54f";
      ctx.fillRect(W / 2 - 40, H * 0.48, 80 * (got / need), 8);
    }
  }

  function draw(ctx, st, time, dt) {
    drawBackground(ctx);
    drawMap(ctx, st);
    drawDrops(ctx, st);
    drawFlames(ctx, st);
    drawPoofs(ctx, st);
    drawBombs(ctx, st);
    for (var i = 0; i < st.enemies.length; i++) {
      var en = st.enemies[i];
      if (!en.dead) drawDemon(ctx, en, time);
    }
    drawPlayer(ctx, st, time);
    /* combo 飘分特效:净化恶魔时 killScore 写入 st.fx */
    if (st.fx) for (i = 0; i < st.fx.length; i++) {
      var f = st.fx[i], p = f.t / 40;
      ctx.globalAlpha = 1 - p;
      ctx.fillStyle = "#ffd54f";
      ctx.font = "bold 12px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("+" + f.gained, f.x, f.y - 10 - p * 20 + HUD);
      if (st.combo > 1) {
        ctx.font = "bold 10px sans-serif";
        ctx.fillStyle = "#ff8a5c";
        ctx.fillText("x" + st.combo + " combo!", f.x, f.y - 24 - p * 20 + HUD);
      }
      ctx.globalAlpha = 1;
    }
    drawHUD(ctx, st);
    drawOverlay(ctx, st);
  }

  return { draw:draw, drawBackground:drawBackground, drawMap:drawMap, drawDrops:drawDrops,
           drawFlames:drawFlames, drawPoofs:drawPoofs, drawBombs:drawBombs,
           drawDemon:drawDemon, drawPlayer:drawPlayer, drawHUD:drawHUD, drawOverlay:drawOverlay,
           roundRect:roundRect };
})();

if (typeof module !== "undefined") module.exports = Render;
