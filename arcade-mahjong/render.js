/* Arcade Mahjong 2P · render.js v5 — 360×500 canvas
   画质大改版：3D 牌质感 / 出牌动画 / 牌墙堆叠 / 特效 / 中式装饰 */
"use strict";

var Render = (function () {

  var W = 360, H = 500, HUD = 22;

  var TILE_W = 24, TILE_H = 34;
  var DEPTH = 4;
  var STRIDE = TILE_W + 1;
  var TB_W = 12, TB_H = 17;
  var TD_W = 15, TD_H = 20;

  var HAND_Y = H - TILE_H - DEPTH - 4;
  var HAND_X = 5;
  var MELD_Y = HAND_Y - TILE_H - DEPTH - 2;
  var CPU_Y = HUD + 4;
  var CPU_HAND_Y = CPU_Y + 28;
  var CPU_DIS_Y = CPU_HAND_Y + TB_H + DEPTH + 4;
  var PLAYER_DIS_Y = MELD_Y - TD_H * 2 - DEPTH - 10;
  var WALL_X = W / 2;
  var WALL_Y = (CPU_DIS_Y + PLAYER_DIS_Y) / 2;

  /* 牌面颜色 */
  var T_L = "#fffef8", T_M = "#f8f0d8", T_D = "#e8dca8";
  var T_EDGE = "#a89060", T_SIDE = "#1a3820", T_SIDE2 = "#284830";
  /* 牌背颜色 */
  var B_T = "#2850a0", B_M = "#1c3878", B_B = "#102858", B_E = "#081838";
  var B_HI = "rgba(140,180,255,0.25)";
  /* 桌面 */
  var FELT_D = "#0a5218", FELT_M = "#167a28", FELT_L = "#1e9a38";
  var FRAME_D = "#2a1808", FRAME_M = "#5a3818", FRAME_L = "#7a4828";
  var GOLD = "#ffd700", GOLD_D = "#b8960a", GOLD_L = "#ffe860";
  var SHADOW = "rgba(0,0,0,0.45)";

  var HON_C = ["#1a3a6a","#1a3a6a","#1a3a6a","#1a3a6a","#c42020","#2d7a2d","#6a8aaa"];
  var HON_N = ["东","南","西","北","中","发","白"];

  /* 象牙纹理 — 预计算噪点位置 */
  var IVORY_DOTS = [];
  (function() {
    var rng = 12345;
    for (var i = 0; i < 120; i++) {
      rng = (rng * 1103515245 + 12345) & 0x7fffffff;
      IVORY_DOTS.push([
        ((rng % 1000) / 1000),
        (((rng = (rng * 1103515245 + 12345) & 0x7fffffff) % 1000) / 1000),
        0.3 + ((rng = (rng * 1103515245 + 12345) & 0x7fffffff) % 40) / 100
      ]);
    }
  })();

  /* 木纹预计算 */
  var WOOD_LINES = [];
  (function() {
    var rng = 54321;
    for (var i = 0; i < 40; i++) {
      rng = (rng * 1103515245 + 12345) & 0x7fffffff;
      WOOD_LINES.push([
        ((rng % 1000) / 1000) * 360,
        ((rng = (rng * 1103515245 + 12345) & 0x7fffffff) % 300) / 300 * 500,
        0.5 + ((rng = (rng * 1103515245 + 12345) & 0x7fffffff) % 20) / 40,
        0.3 + ((rng = (rng * 1103515245 + 12345) & 0x7fffffff) % 30) / 100
      ]);
    }
  })();

  /* 动画系统 */
  var anims = [];
  function addAnim(type, from, to, duration, data) {
    /* duration 由调用方以毫秒传入，内部统一换算为秒 */
    var durSec = (duration || 300) / 1000;
    anims.push({ type: type, fromX: from[0], fromY: from[1],
                 toX: to[0], toY: to[1], duration: durSec,
                 elapsed: 0, data: data });
  }
  function updateAnims(dt) {
    for (var i = anims.length - 1; i >= 0; i--) {
      anims[i].elapsed += dt;
      if (anims[i].elapsed >= anims[i].duration) anims.splice(i, 1);
    }
  }
  function easeOut(t) { return 1 - (1 - t) * (1 - t); }
  function easeIn(t) { return t * t; }

  /* 返回当前活跃的摸牌动画（无则 null） */
  function activeDrawAnim() {
    for (var i = 0; i < anims.length; i++) {
      if (anims[i].type === "draw") return anims[i];
    }
    return null;
  }

  /* 新摸的牌在排序后手牌中的真实索引（-1 表示无）。
     摸牌动画开始时由动画数据写入，动画结束后继续用于高亮。 */
  var newTileIdx = -1;

  /* ================================================================ */
  function draw(ctx, st, t, dt) {
    updateAnims(dt || 1/60);
    drawBackground(ctx, t);
    drawHUD(ctx, st, t);
    if (st.mode === "menu") { drawMenu(ctx, st, t); return; }
    drawCPU(ctx, st, t);
    drawCpuDiscards(ctx, st);
    drawWall(ctx, st, t);
    drawPlayerDiscards(ctx, st);
    drawPlayerMelds(ctx, st);
    drawHands(ctx, st, t);
    drawAnims(ctx, st, t);
    if (st.mode === "await_donden")        drawDonDenPanel(ctx, st, t);
    else if (st.mode === "waiting_response") drawActionPanel(ctx, st, t);
    else if (st.mode === "await_hu_choice") drawHuPanel(ctx, st, t);
    else if (st.mode === "ai_turn")         drawTurnHint(ctx, st, t);
    if (st.mode === "await_discard" && Core.canRiichi && Core.canRiichi(st, 0) && !st.riichi[0])
      drawRiichiBtn(ctx, st, t);
    if (st.riichi[0] && st.mode !== "round_over" && st.mode !== "draw")
      drawRiichiEffect(ctx, st, t);
    if (st.mode === "round_over") drawRoundOver(ctx, st, t);
    else if (st.mode === "draw")   drawDrawOver(ctx, st, t);
  }

  /* ================================================================ */
  /*  背景 — 中式牌桌                                                */
  /* ================================================================ */
  function drawBackground(ctx, t) {
    /* 外框木质 — 多层渐变 + 纹理 */
    var gf = ctx.createLinearGradient(0, 0, W, H);
    gf.addColorStop(0, "#1a0e04");
    gf.addColorStop(0.15, "#3d2210");
    gf.addColorStop(0.5, "#5a3818");
    gf.addColorStop(0.85, "#3d2210");
    gf.addColorStop(1, "#1a0e04");
    ctx.fillStyle = gf;
    ctx.fillRect(0, 0, W, H);

    /* 木纹 — 用预计算的位置画不规则木纹 */
    ctx.strokeStyle = "rgba(0,0,0,0.12)";
    for (var i = 0; i < WOOD_LINES.length; i++) {
      var wd = WOOD_LINES[i];
      ctx.lineWidth = wd[2];
      ctx.beginPath();
      ctx.moveTo(0, wd[1] + Math.sin(wd[0] * 0.05) * 2);
      ctx.bezierCurveTo(
        W * 0.3, wd[1] + Math.sin(wd[0] * 0.05 + 1) * 3,
        W * 0.7, wd[1] + Math.cos(wd[0] * 0.03 + 2) * 2,
        W, wd[1] + Math.cos(wd[0] * 0.05) * 2.5
      );
      ctx.stroke();
    }
    /* 浅色木纹高光 */
    ctx.strokeStyle = "rgba(180,120,60,0.06)";
    for (var j = 0; j < WOOD_LINES.length; j += 2) {
      var wd2 = WOOD_LINES[j];
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.moveTo(0, wd2[1] + 1);
      ctx.lineTo(W, wd2[1] + 1 + Math.sin(wd2[0] * 0.04) * 2);
      ctx.stroke();
    }

    /* 牌桌绒布面 — 更强的径向渐变 */
    var gF = ctx.createRadialGradient(W / 2, H / 2 - 30, 20, W / 2, H / 2 + 10, 280);
    gF.addColorStop(0, "#1da840");
    gF.addColorStop(0.3, "#148830");
    gF.addColorStop(0.7, "#0a5818");
    gF.addColorStop(1, "#063a0e");
    ctx.fillStyle = gF;
    ctx.fillRect(5, 5, W - 10, H - 10);

    /* 绒布纤维纹理 — 随机短线 */
    ctx.strokeStyle = "rgba(0,0,0,0.035)";
    ctx.lineWidth = 0.4;
    var frng = 999;
    for (var y3 = 8; y3 < H - 8; y3 += 2) {
      frng = (frng * 1103515245 + 12345) & 0x7fffffff;
      var offset = (frng % 10 - 5) * 0.3;
      ctx.beginPath();
      ctx.moveTo(6 + offset, y3);
      ctx.lineTo(W - 6 + offset, y3);
      ctx.stroke();
    }
    /* 绒布噪点 */
    ctx.fillStyle = "rgba(0,0,0,0.025)";
    for (var nx = 10; nx < W - 10; nx += 3) {
      for (var ny = 10; ny < H - 10; ny += 3) {
        var nrng = (nx * 7 + ny * 13) & 0x7fffffff;
        if (nrng % 3 === 0) ctx.fillRect(nx, ny, 1, 1);
      }
    }

    /* 金色内框 — 双层 */
    ctx.strokeStyle = "#c8a020";
    ctx.lineWidth = 1.8;
    ctx.strokeRect(5.5, 5.5, W - 11, H - 11);
    ctx.strokeStyle = "rgba(255,215,0,0.35)";
    ctx.lineWidth = 0.8;
    ctx.strokeRect(4, 4, W - 8, H - 8);

    /* 中式角花装饰 */
    drawChineseCorner(ctx, 8, 8, 1, 1);
    drawChineseCorner(ctx, W - 8, 8, -1, 1);
    drawChineseCorner(ctx, 8, H - 8, 1, -1);
    drawChineseCorner(ctx, W - 8, H - 8, -1, -1);

    /* 桌面中央微光 */
    var pulse = 0.025 + 0.015 * Math.sin(t * 1.5);
    var gC = ctx.createRadialGradient(W / 2, H / 2 - 10, 0, W / 2, H / 2, 140);
    gC.addColorStop(0, "rgba(255,255,220," + pulse + ")");
    gC.addColorStop(0.5, "rgba(200,255,200," + pulse * 0.3 + ")");
    gC.addColorStop(1, "rgba(255,255,220,0)");
    ctx.fillStyle = gC;
    ctx.fillRect(0, 0, W, H);
  }

  function drawChineseCorner(ctx, x, y, dx, dy) {
    ctx.save();
    ctx.strokeStyle = GOLD_D;
    ctx.lineWidth = 1;
    /* 外框 */
    ctx.beginPath();
    ctx.moveTo(x + dx * 14, y);
    ctx.lineTo(x, y);
    ctx.lineTo(x, y + dy * 14);
    ctx.stroke();
    /* 内框 */
    ctx.strokeStyle = "rgba(255,215,0,0.4)";
    ctx.beginPath();
    ctx.moveTo(x + dx * 8, y + dy * 2);
    ctx.lineTo(x + dx * 2, y + dy * 2);
    ctx.lineTo(x + dx * 2, y + dy * 8);
    ctx.stroke();
    /* 回纹 */
    ctx.strokeStyle = "rgba(255,215,0,0.3)";
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(x + dx * 6, y + dy * 4);
    ctx.lineTo(x + dx * 4, y + dy * 4);
    ctx.lineTo(x + dx * 4, y + dy * 6);
    ctx.lineTo(x + dx * 6, y + dy * 6);
    ctx.stroke();
    /* 角点 */
    ctx.fillStyle = GOLD;
    ctx.beginPath();
    ctx.arc(x + dx * 2, y + dy * 2, 1.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /* ================================================================ */
  /*  HUD                                                            */
  /* ================================================================ */
  function drawHUD(ctx, st, t) {
    var gh = ctx.createLinearGradient(0, 0, 0, HUD);
    gh.addColorStop(0, "rgba(0,0,0,0.9)");
    gh.addColorStop(1, "rgba(0,0,0,0.7)");
    ctx.fillStyle = gh;
    ctx.fillRect(0, 0, W, HUD);
    ctx.fillStyle = GOLD_D;
    ctx.fillRect(0, HUD - 1, W, 1);

    ctx.textBaseline = "middle";
    ctx.font = "bold 11px sans-serif";
    ctx.textAlign = "left";
    ctx.fillStyle = "#fff";
    ctx.fillText("R" + st.round, 7, HUD / 2);

    ctx.fillStyle = GOLD;
    ctx.fillText("★" + st.players[st.dealer].name, 28, HUD / 2);

    if (st.mode === "await_donden") {
      ctx.fillStyle = "#ff8844";
      ctx.fillText("EXCH:" + st.donDenCount, 90, HUD / 2);
    }
    if (st.riichi[0]) {
      ctx.fillStyle = "#ff4040";
      ctx.font = "bold 10px sans-serif";
      ctx.fillText("RIICHI!", 90, HUD / 2);
      ctx.font = "bold 11px sans-serif";
    }

    ctx.textAlign = "center";
    ctx.fillStyle = "#88ccff";
    ctx.fillText(st.deck.length + " tiles", W / 2, HUD / 2);

    ctx.textAlign = "right";
    ctx.fillStyle = "#ffe880";
    ctx.fillText("You:" + st.players[0].wins + " CPU:" + st.players[1].wins, W - 7, HUD / 2);
  }

  /* ================================================================ */
  /*  3D 牌面 — 高质量渲染                                          */
  /* ================================================================ */
  function drawTileFace(ctx, k, x, y, w, h) {
    /* 防御：牌种类必须是 0..33 的整数，否则回退为 1万 面 */
    if (typeof k !== "number" || isNaN(k) || k < 0 || k > 33) k = 0;
    var d = Math.max(3, Math.round(DEPTH * w / TILE_W));
    var r = Math.max(2, Math.round(2.5 * w / TILE_W));

    /* 多层阴影 — 大 + 小 */
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.beginPath();
    ctx.ellipse(x + w * 0.5, y + h + d + 2, w * 0.55, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.beginPath();
    ctx.ellipse(x + w * 0.48, y + h + d + 0.8, w * 0.42, 1.8, 0, 0, Math.PI * 2);
    ctx.fill();

    /* 右侧面 — 3层渐变 */
    var gSide = ctx.createLinearGradient(x + w, y, x + w + d, y);
    gSide.addColorStop(0, "#2a5530");
    gSide.addColorStop(0.3, "#1a3820");
    gSide.addColorStop(1, "#081808");
    ctx.fillStyle = gSide;
    ctx.fillRect(x + w, y, d, h);
    /* 右侧面顶部高光 */
    ctx.fillStyle = "rgba(80,140,80,0.3)";
    ctx.fillRect(x + w, y + 1, d, 1.5);

    /* 底侧面 */
    var gBot = ctx.createLinearGradient(0, y + h, 0, y + h + d);
    gBot.addColorStop(0, "#1a3820");
    gBot.addColorStop(1, "#061008");
    ctx.fillStyle = gBot;
    ctx.fillRect(x, y + h, w, d);

    /* 角侧面 */
    ctx.fillStyle = "#040804";
    ctx.fillRect(x + w, y + h, d, d);

    /* 顶面 — 多层渐变模拟象牙 */
    var gTop = ctx.createLinearGradient(0, y, 0, y + h);
    gTop.addColorStop(0, "#fffdf5");
    gTop.addColorStop(0.1, "#fffaf0");
    gTop.addColorStop(0.4, "#f5e8c8");
    gTop.addColorStop(0.7, "#e8d8a8");
    gTop.addColorStop(1, "#d0c088");
    ctx.fillStyle = gTop;
    roundRect(ctx, x, y, w, h, r);
    ctx.fill();

    /* 象牙纹理 — 随机小点 */
    ctx.fillStyle = "rgba(180,160,100,0.08)";
    for (var di = 0; di < IVORY_DOTS.length; di++) {
      var dot = IVORY_DOTS[di];
      var dx = x + dot[0] * w;
      var dy = y + dot[1] * h;
      ctx.fillRect(dx, dy, dot[2] * (w / 24), dot[2] * (w / 24));
    }

    /* 表面光泽 — 对角渐变 */
    var gGloss = ctx.createLinearGradient(x, y, x + w * 0.7, y + h * 0.6);
    gGloss.addColorStop(0, "rgba(255,255,255,0.45)");
    gGloss.addColorStop(0.3, "rgba(255,255,255,0.18)");
    gGloss.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = gGloss;
    roundRect(ctx, x + 0.5, y + 0.5, w - 1, h - 1, r - 0.5);
    ctx.fill();

    /* 4面斜角 — 顶部 */
    var gBevelTop = ctx.createLinearGradient(0, y, 0, y + 3);
    gBevelTop.addColorStop(0, "rgba(255,255,255,0.7)");
    gBevelTop.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = gBevelTop;
    ctx.fillRect(x + 1, y + 0.5, w - 2, 3);

    /* 4面斜角 — 左侧 */
    var gBevelL = ctx.createLinearGradient(x, 0, x + 2.5, 0);
    gBevelL.addColorStop(0, "rgba(255,255,255,0.35)");
    gBevelL.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = gBevelL;
    ctx.fillRect(x + 0.5, y + 1, 2.5, h - 2);

    /* 4面斜角 — 右下暗角 */
    var gBevelBR = ctx.createLinearGradient(0, y + h - 3, 0, y + h);
    gBevelBR.addColorStop(0, "rgba(0,0,0,0)");
    gBevelBR.addColorStop(1, "rgba(0,0,0,0.12)");
    ctx.fillStyle = gBevelBR;
    ctx.fillRect(x + 1, y + h - 3, w - 2, 3);

    var gBevelR = ctx.createLinearGradient(x + w - 2.5, 0, x + w, 0);
    gBevelR.addColorStop(0, "rgba(0,0,0,0)");
    gBevelR.addColorStop(1, "rgba(0,0,0,0.08)");
    ctx.fillStyle = gBevelR;
    ctx.fillRect(x + w - 2.5, y + 1, 2, h - 2);

    /* 外边框 */
    ctx.strokeStyle = "#9a8050";
    ctx.lineWidth = 0.8;
    roundRect(ctx, x + 0.4, y + 0.4, w - 0.8, h - 0.8, r);
    ctx.stroke();

    /* 内边框 */
    ctx.strokeStyle = "rgba(0,0,0,0.05)";
    ctx.lineWidth = 0.4;
    roundRect(ctx, x + 1.5, y + 1.5, w - 3, h - 3, r - 1);
    ctx.stroke();

    drawSuit(ctx, k, x, y, w, h);
  }

  function drawTileBack(ctx, x, y, w, h) {
    var d = Math.max(3, Math.round(DEPTH * w / TILE_W));
    var r = Math.max(2, Math.round(2.5 * w / TILE_W));

    /* 多层阴影 */
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.beginPath();
    ctx.ellipse(x + w * 0.5, y + h + d + 2, w * 0.55, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.beginPath();
    ctx.ellipse(x + w * 0.48, y + h + d + 0.8, w * 0.42, 1.8, 0, 0, Math.PI * 2);
    ctx.fill();

    /* 右侧面 */
    var gSide = ctx.createLinearGradient(x + w, y, x + w + d, y);
    gSide.addColorStop(0, "#102050");
    gSide.addColorStop(0.4, "#081030");
    gSide.addColorStop(1, "#040818");
    ctx.fillStyle = gSide;
    ctx.fillRect(x + w, y, d, h);
    ctx.fillStyle = "rgba(60,100,180,0.25)";
    ctx.fillRect(x + w, y + 1, d, 1.5);

    /* 底侧面 */
    ctx.fillStyle = "#060e20";
    ctx.fillRect(x, y + h, w, d);
    ctx.fillStyle = "#030810";
    ctx.fillRect(x + w, y + h, d, d);

    /* 顶面 — 多层蓝色渐变 */
    var gTop = ctx.createLinearGradient(0, y, 0, y + h);
    gTop.addColorStop(0, "#3868c0");
    gTop.addColorStop(0.25, "#2858a8");
    gTop.addColorStop(0.6, "#1c3878");
    gTop.addColorStop(1, "#0c2050");
    ctx.fillStyle = gTop;
    roundRect(ctx, x, y, w, h, r);
    ctx.fill();

    /* 光泽 */
    var gG = ctx.createLinearGradient(x, y, x + w * 0.6, y + h * 0.5);
    gG.addColorStop(0, "rgba(180,210,255,0.25)");
    gG.addColorStop(0.4, "rgba(150,190,255,0.08)");
    gG.addColorStop(1, "rgba(180,210,255,0)");
    ctx.fillStyle = gG;
    roundRect(ctx, x + 0.5, y + 0.5, w - 1, h - 1, r - 0.5);
    ctx.fill();

    /* 4面斜角 — 顶部 */
    var gBevelTop = ctx.createLinearGradient(0, y, 0, y + 3);
    gBevelTop.addColorStop(0, "rgba(180,210,255,0.35)");
    gBevelTop.addColorStop(1, "rgba(180,210,255,0)");
    ctx.fillStyle = gBevelTop;
    ctx.fillRect(x + 1, y + 0.5, w - 2, 3);

    /* 外边框 */
    ctx.strokeStyle = "#081838";
    ctx.lineWidth = 0.8;
    roundRect(ctx, x + 0.4, y + 0.4, w - 0.8, h - 0.8, r);
    ctx.stroke();

    /* 中式回纹图案 */
    var cx = x + w / 2, cy = y + h / 2;
    ctx.strokeStyle = "rgba(140,180,255,0.25)";
    ctx.lineWidth = 0.6;
    /* 菱形 */
    ctx.beginPath();
    ctx.moveTo(cx, y + 2);
    ctx.lineTo(cx + w * 0.32, cy);
    ctx.lineTo(cx, y + h - 2);
    ctx.lineTo(cx - w * 0.32, cy);
    ctx.closePath();
    ctx.stroke();
    /* 内框 */
    ctx.strokeStyle = "rgba(120,160,230,0.15)";
    roundRect(ctx, x + 2, y + 2, w - 4, h - 4, 1);
    ctx.stroke();
    /* 中心点 */
    ctx.fillStyle = "rgba(160,200,255,0.4)";
    ctx.beginPath();
    ctx.arc(cx, cy, 1.5, 0, Math.PI * 2);
    ctx.fill();

    /* 底部暗角 */
    var gBot = ctx.createLinearGradient(0, y + h - 4, 0, y + h);
    gBot.addColorStop(0, "rgba(0,0,0,0)");
    gBot.addColorStop(1, "rgba(0,0,0,0.2)");
    ctx.fillStyle = gBot;
    ctx.fillRect(x + 1, y + h - 4, w - 2, 4);
  }

  function drawTile(ctx, tile, x, y, w, h, faceUp) {
    if (faceUp === false || tile === undefined || tile < 0) {
      drawTileBack(ctx, x, y, w, h); return;
    }
    drawTileFace(ctx, Core.tileKind(tile), x, y, w, h);
  }

  /* ================================================================ */
  /*  花色符号 — 更精致的渲染                                       */
  /* ================================================================ */
  function drawSuit(ctx, k, x, y, w, h) {
    var s = Core.kindSuit(k), r = Core.kindRank(k);
    if (s === 3) { drawHonor(ctx, k, x, y, w, h); return; }
    if (s === 0) { drawWan(ctx, r, x, y, w, h); return; }
    if (s === 1) { drawTiao(ctx, r, x, y, w, h); return; }
    drawTong(ctx, r, x, y, w, h);
  }

  function drawWan(ctx, r, x, y, w, h) {
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    /* 数字 — 带阴影 */
    ctx.fillStyle = "rgba(0,0,0,0.15)";
    ctx.font = "bold " + Math.min(w * 0.6, h * 0.36) + "px serif";
    ctx.fillText(String(r), x + w / 2 + 0.5, y + h * 0.28 + 0.5);
    ctx.fillStyle = "#c42020";
    ctx.fillText(String(r), x + w / 2, y + h * 0.28);
    /* 万字 */
    ctx.font = Math.min(w * 0.46, h * 0.28) + "px serif";
    ctx.fillStyle = "#c42020";
    ctx.fillText("万", x + w / 2, y + h * 0.72);
  }

  function drawTong(ctx, r, x, y, w, h) {
    var cx = x + w / 2, cy = y + h / 2;
    var patterns = [
      null,
      [[0, 0]],
      [[0, -h * 0.26], [0, h * 0.26]],
      [[-w * 0.2, -h * 0.24], [0, 0], [w * 0.2, h * 0.24]],
      [[-w * 0.22, -h * 0.24], [w * 0.22, -h * 0.24],
       [-w * 0.22, h * 0.24], [w * 0.22, h * 0.24]],
      [[-w * 0.22, -h * 0.24], [w * 0.22, -h * 0.24], [0, 0],
       [-w * 0.22, h * 0.24], [w * 0.22, h * 0.24]],
      [[-w * 0.22, -h * 0.32], [w * 0.22, -h * 0.32],
       [-w * 0.22, 0], [w * 0.22, 0],
       [-w * 0.22, h * 0.32], [w * 0.22, h * 0.32]],
      [[-w * 0.22, -h * 0.38], [w * 0.22, -h * 0.38],
       [-w * 0.22, -h * 0.05], [0, h * 0.05], [w * 0.22, h * 0.05],
       [-w * 0.22, h * 0.38], [w * 0.22, h * 0.38]],
      [[-w * 0.22, -h * 0.38], [w * 0.22, -h * 0.38],
       [-w * 0.22, -h * 0.12], [w * 0.22, -h * 0.12],
       [-w * 0.22, h * 0.16], [w * 0.22, h * 0.16],
       [-w * 0.22, h * 0.42], [w * 0.22, h * 0.42]],
      [[-w * 0.26, -h * 0.34], [0, -h * 0.34], [w * 0.26, -h * 0.34],
       [-w * 0.26, 0], [0, 0], [w * 0.26, 0],
       [-w * 0.26, h * 0.34], [0, h * 0.34], [w * 0.26, h * 0.34]]
    ];
    var dots = patterns[r];
    if (!dots) return;
    var dr = r <= 2 ? 3.8 : (r <= 5 ? 3 : (r <= 6 ? 2.6 : 2.2));
    for (var i = 0; i < dots.length; i++) {
      var dx = cx + dots[i][0], dy = cy + dots[i][1];
      var col = (i === 0) ? "#c42020" : (r >= 3 && i % 3 === 2 ? "#2d7a2d" : "#1a5c8a");
      if (r === 1) col = "#c42020";
      /* 阴影 */
      ctx.fillStyle = "rgba(0,0,0,0.15)";
      ctx.beginPath();
      ctx.arc(dx + 0.3, dy + 0.3, dr, 0, Math.PI * 2);
      ctx.fill();
      /* 主体 */
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(dx, dy, dr, 0, Math.PI * 2);
      ctx.fill();
      /* 高光 */
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.beginPath();
      ctx.arc(dx - dr * 0.3, dy - dr * 0.3, dr * 0.35, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawTiao(ctx, r, x, y, w, h) {
    var cx = x + w / 2, cy = y + h / 2;
    var bw = r <= 3 ? 2.5 : (r <= 6 ? 2 : 1.6);
    var bh = r <= 3 ? h * 0.3 : (r <= 6 ? h * 0.24 : h * 0.2);
    var positions = [
      null,
      [[0, 0]],
      [[0, -h * 0.24], [0, h * 0.24]],
      [[0, -h * 0.3], [-w * 0.22, h * 0.16], [w * 0.22, h * 0.16]],
      [[-w * 0.22, -h * 0.26], [w * 0.22, -h * 0.26],
       [-w * 0.22, h * 0.26], [w * 0.22, h * 0.26]],
      [[-w * 0.22, -h * 0.3], [w * 0.22, -h * 0.3], [0, 0],
       [-w * 0.22, h * 0.3], [w * 0.22, h * 0.3]],
      [[-w * 0.22, -h * 0.32], [w * 0.22, -h * 0.32],
       [-w * 0.22, -h * 0.05], [w * 0.22, -h * 0.05],
       [-w * 0.22, h * 0.27], [w * 0.22, h * 0.27]],
      [[-w * 0.22, -h * 0.38], [w * 0.22, -h * 0.38],
       [-w * 0.22, -h * 0.12], [w * 0.22, -h * 0.12],
       [-w * 0.22, h * 0.13], [w * 0.22, h * 0.13],
       [-w * 0.22, h * 0.38], [w * 0.22, h * 0.38]],
      [[-w * 0.22, -h * 0.38], [w * 0.22, -h * 0.38],
       [-w * 0.22, -h * 0.12], [w * 0.22, -h * 0.12],
       [-w * 0.22, h * 0.13], [w * 0.22, h * 0.13],
       [-w * 0.22, h * 0.38], [w * 0.22, h * 0.38],
       [0, 0]],
      [[-w * 0.26, -h * 0.34], [0, -h * 0.34], [w * 0.26, -h * 0.34],
       [-w * 0.26, 0], [0, 0], [w * 0.26, 0],
       [-w * 0.26, h * 0.34], [0, h * 0.34], [w * 0.26, h * 0.34]]
    ];
    var pos = positions[r];
    if (!pos) return;
    for (var i = 0; i < pos.length; i++) {
      var px = cx + pos[i][0], py = cy + pos[i][1];
      var col = (r === 1 || (r === 5 && i === 2)) ? "#c42020" : "#2d7a2d";
      /* 阴影 */
      ctx.fillStyle = "rgba(0,0,0,0.15)";
      ctx.fillRect(px - bw / 2 + 0.3, py - bh / 2 + 0.3, bw, bh);
      /* 主体 */
      ctx.fillStyle = col;
      ctx.fillRect(px - bw / 2, py - bh / 2, bw, bh);
      /* 竹节 */
      ctx.fillStyle = "rgba(0,0,0,0.25)";
      ctx.fillRect(px - bw / 2, py - 0.3, bw, 0.6);
      /* 高光 */
      ctx.fillStyle = "rgba(255,255,255,0.15)";
      ctx.fillRect(px - bw / 2, py - bh / 2, bw * 0.3, bh);
    }
  }

  function drawHonor(ctx, k, x, y, w, h) {
    var r = Core.kindRank(k);
    /* 防御：非法牌种类不渲染文字，避免画出 "undefined" */
    if (typeof r !== "number" || isNaN(r) || r < 0 || r >= HON_N.length) return;
    var name = HON_N[r];
    var col = HON_C[r];
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    if (name === "白") {
      ctx.strokeStyle = "#4a7aaa";
      ctx.lineWidth = 2;
      roundRect(ctx, x + w * 0.2, y + h * 0.18, w * 0.6, h * 0.64, 1.5);
      ctx.stroke();
      ctx.strokeStyle = "rgba(74,122,170,0.3)";
      ctx.lineWidth = 1;
      roundRect(ctx, x + w * 0.22, y + h * 0.2, w * 0.56, h * 0.6, 1);
      ctx.stroke();
      return;
    }
    /* 阴影 */
    ctx.fillStyle = "rgba(0,0,0,0.15)";
    ctx.font = "bold " + Math.min(w * 0.78, h * 0.6) + "px serif";
    ctx.fillText(name, x + w / 2 + 0.5, y + h / 2 + 0.5);
    /* 主体 */
    ctx.fillStyle = col;
    ctx.fillText(name, x + w / 2, y + h / 2);
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  /* ================================================================ */
  /*  CPU 区域                                                       */
  /* ================================================================ */
  function drawCPU(ctx, st, t) {
    var p = st.players[1];
    var isActive = (st.turn === 1 && st.mode !== "round_over" && st.mode !== "draw");

    var ax = 18, ay = CPU_Y + 13, ar = 11;

    /* 激活光环 */
    if (isActive) {
      var pulse = 0.3 + 0.2 * Math.sin(t * 4);
      ctx.fillStyle = "rgba(255,215,0," + pulse + ")";
      ctx.beginPath(); ctx.arc(ax, ay, ar + 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "rgba(255,215,0," + pulse * 0.5 + ")";
      ctx.beginPath(); ctx.arc(ax, ay, ar + 8, 0, Math.PI * 2); ctx.fill();
    }

    /* 头像 */
    var gA = ctx.createRadialGradient(ax - 2, ay - 2, 1, ax, ay, ar);
    gA.addColorStop(0, isActive ? "#ffe880" : "#555");
    gA.addColorStop(0.5, isActive ? "#e0a030" : "#333");
    gA.addColorStop(1, isActive ? "#a07010" : "#222");
    ctx.fillStyle = gA;
    ctx.beginPath(); ctx.arc(ax, ay, ar, 0, Math.PI * 2); ctx.fill();

    ctx.strokeStyle = isActive ? GOLD : "#666";
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(ax, ay, ar, 0, Math.PI * 2); ctx.stroke();

    /* 机器人脸 */
    ctx.fillStyle = isActive ? "#1a1a1a" : "#888";
    /* 眼睛 */
    ctx.fillRect(ax - 5, ay - 3, 3.5, 3.5);
    ctx.fillRect(ax + 1.5, ay - 3, 3.5, 3.5);
    /* 眼睛高光 */
    ctx.fillStyle = isActive ? "#40a0ff" : "#aaa";
    ctx.fillRect(ax - 4.5, ay - 2.5, 1.5, 1.5);
    ctx.fillRect(ax + 2, ay - 2.5, 1.5, 1.5);
    /* 嘴 */
    ctx.fillStyle = isActive ? "#1a1a1a" : "#888";
    ctx.fillRect(ax - 3, ay + 2.5, 6, 1.5);

    /* 天线 */
    ctx.strokeStyle = isActive ? "#ff8040" : "#888";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(ax, ay - ar);
    ctx.lineTo(ax, ay - ar - 3);
    ctx.stroke();
    ctx.fillStyle = isActive ? "#ff4040" : "#666";
    ctx.beginPath(); ctx.arc(ax, ay - ar - 3, 1.5, 0, Math.PI * 2); ctx.fill();
    if (isActive) {
      var blink = Math.sin(t * 8) > 0;
      if (blink) {
        ctx.fillStyle = "rgba(255,80,80,0.4)";
        ctx.beginPath(); ctx.arc(ax, ay - ar - 3, 3, 0, Math.PI * 2); ctx.fill();
      }
    }

    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.font = "bold 11px sans-serif";
    ctx.fillStyle = isActive ? GOLD : "#aabbdd";
    var name = p.name;
    if (st.dealer === 1) name = "★" + name;
    ctx.fillText(name, 34, CPU_Y + 7);

    ctx.fillStyle = "#888";
    ctx.font = "10px sans-serif";
    ctx.fillText(p.hand.length + " tiles", 34, CPU_Y + 18);

    /* CPU 明杠/碰 */
    if (p.melds.length > 0) {
      var mx = 76;
      for (var m = 0; m < p.melds.length; m++) {
        var meld = p.melds[m];
        var faceUp = (meld.type !== "angang");
        for (var ti = 0; ti < meld.tiles.length; ti++) {
          var k = meld.tiles[ti];
          var tx = mx + ti * (18 + DEPTH) + m * 80;
          if (faceUp) drawTileFace(ctx, k, tx, CPU_Y - 3, 18, 22);
          else       drawTileBack(ctx, tx, CPU_Y - 3, 18, 22);
        }
      }
    }

    /* CPU 手牌背 */
    var totalW = p.hand.length * (TB_W + DEPTH);
    var sx = Math.floor(W / 2 - totalW / 2);
    for (var i = 0; i < p.hand.length; i++) {
      drawTileBack(ctx, sx + i * (TB_W + DEPTH), CPU_HAND_Y, TB_W, TB_H);
    }
  }

  /* ================================================================ */
  /*  弃牌河                                                         */
  /* ================================================================ */
  function drawCpuDiscards(ctx, st) {
    var p = st.players[1];
    var cols = 7, cap = 14;
    var start = Math.max(0, p.discards.length - cap);
    var stride = TD_W + DEPTH + 1;
    var totalW = cols * stride;
    var sx = Math.floor(W / 2 - totalW / 2);
    for (var i = start; i < p.discards.length; i++) {
      var idx = i - start;
      var col = idx % cols, row = Math.floor(idx / cols);
      drawTile(ctx, p.discards[i], sx + col * stride,
               CPU_DIS_Y + row * (TD_H + DEPTH + 1), TD_W, TD_H, true);
    }
  }

  function drawPlayerDiscards(ctx, st) {
    var p = st.players[0];
    var cols = 7, cap = 14;
    var start = Math.max(0, p.discards.length - cap);
    var stride = TD_W + DEPTH + 1;
    var totalW = cols * stride;
    var sx = Math.floor(W / 2 - totalW / 2);
    for (var i = start; i < p.discards.length; i++) {
      var idx = i - start;
      var col = idx % cols, row = Math.floor(idx / cols);
      drawTile(ctx, p.discards[i], sx + col * stride,
               PLAYER_DIS_Y + row * (TD_H + DEPTH + 1), TD_W, TD_H, true);
    }
  }

  /* ================================================================ */
  /*  牌墙 — 3D 堆叠                                                */
  /* ================================================================ */
  function drawWall(ctx, st, t) {
    var remaining = st.deck.length;
    var x = WALL_X - 24, y = WALL_Y - 18;
    var d = DEPTH + 1;

    /* 大阴影 */
    ctx.fillStyle = "rgba(0,0,0,0.2)";
    ctx.beginPath();
    ctx.ellipse(WALL_X, y + 32, 32, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.beginPath();
    ctx.ellipse(WALL_X, y + 30, 26, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();

    /* 牌墙底座 */
    ctx.fillStyle = "rgba(0,0,0,0.15)";
    roundRect(ctx, x - 2, y + 28, 52, 6, 2);
    ctx.fill();

    /* 双层牌墙 */
    for (var layer = 1; layer >= 0; layer--) {
      var ly = y - layer * 7;
      var isTop = (layer === 0);

      /* 侧面 — 底 */
      var gSideBot = ctx.createLinearGradient(0, ly + 24, 0, ly + 24 + d);
      gSideBot.addColorStop(0, isTop ? "#081030" : "#060c20");
      gSideBot.addColorStop(1, "#030810");
      ctx.fillStyle = gSideBot;
      ctx.fillRect(x, ly + 24, 48, d);

      /* 侧面 — 右 */
      var gSideR = ctx.createLinearGradient(x + 48, ly, x + 48 + d, ly);
      gSideR.addColorStop(0, isTop ? "#102050" : "#0c1840");
      gSideR.addColorStop(0.5, isTop ? "#081030" : "#060c20");
      gSideR.addColorStop(1, "#030810");
      ctx.fillStyle = gSideR;
      ctx.fillRect(x + 48, ly, d, 24);

      /* 角 */
      ctx.fillStyle = "#020608";
      ctx.fillRect(x + 48, ly + 24, d, d);

      /* 顶面 — 多层渐变 */
      var gTop = ctx.createLinearGradient(0, ly, 0, ly + 24);
      if (isTop) {
        gTop.addColorStop(0, "#3868c0");
        gTop.addColorStop(0.3, "#2858a8");
        gTop.addColorStop(0.7, "#1c3878");
        gTop.addColorStop(1, "#0c2050");
      } else {
        gTop.addColorStop(0, "#284890");
        gTop.addColorStop(0.3, "#1c3870");
        gTop.addColorStop(0.7, "#102858");
        gTop.addColorStop(1, "#081838");
      }
      ctx.fillStyle = gTop;
      roundRect(ctx, x, ly, 48, 24, 2);
      ctx.fill();

      /* 光泽 */
      var gGloss = ctx.createLinearGradient(x, ly, x + 30, ly + 14);
      gGloss.addColorStop(0, "rgba(180,210,255,0.25)");
      gGloss.addColorStop(1, "rgba(180,210,255,0)");
      ctx.fillStyle = gGloss;
      roundRect(ctx, x + 0.5, ly + 0.5, 47, 23, 2);
      ctx.fill();

      /* 边框 */
      ctx.strokeStyle = isTop ? "#081838" : "#060e20";
      ctx.lineWidth = 0.8;
      roundRect(ctx, x + 0.4, ly + 0.4, 47.2, 23.2, 2);
      ctx.stroke();

      /* 光泽顶边 */
      ctx.fillStyle = isTop ? "rgba(180,210,255,0.3)" : "rgba(140,180,255,0.2)";
      ctx.fillRect(x + 3, ly + 1, 42, 1.5);

      /* 分隔线 — 牌堆纹路 */
      ctx.strokeStyle = "rgba(0,0,0,0.1)";
      ctx.lineWidth = 0.4;
      for (var ly2 = ly + 6; ly2 < ly + 21; ly2 += 4) {
        ctx.beginPath();
        ctx.moveTo(x + 4, ly2);
        ctx.lineTo(x + 44, ly2);
        ctx.stroke();
      }
    }

    /* 数字显示 */
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.font = "bold 14px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(remaining, WALL_X + 1, y - 5);
    ctx.fillStyle = remaining <= 10 ? "#ff4040" : "#fff";
    ctx.fillText(remaining, WALL_X, y - 6);

    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.font = "9px sans-serif";
    ctx.fillText("WALL", WALL_X, y + 33);

    /* 低牌警告 */
    if (remaining <= 10) {
      var pulse = 0.3 + 0.3 * Math.sin(t * 6);
      ctx.fillStyle = "rgba(255,60,60," + pulse + ")";
      ctx.beginPath();
      ctx.arc(x + 52, y - 14, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.font = "bold 9px sans-serif";
      ctx.fillText("!", x + 52, y - 14);
    }
  }

  /* ================================================================ */
  /*  玩家明杠/碰                                                    */
  /* ================================================================ */
  function drawPlayerMelds(ctx, st) {
    var p = st.players[0];
    if (p.melds.length === 0) return;
    var mx = W - 4;
    for (var m = p.melds.length - 1; m >= 0; m--) {
      var meld = p.melds[m];
      var meldW = meld.tiles.length * STRIDE - 1;
      mx -= meldW + 3;
      var faceUp = (meld.type !== "angang");
      for (var ti = 0; ti < meld.tiles.length; ti++) {
        var k = meld.tiles[ti];
        var tx = mx + ti * STRIDE;
        if (faceUp) drawTileFace(ctx, k, tx, MELD_Y, TILE_W, TILE_H);
        else       drawTileBack(ctx, tx, MELD_Y, TILE_W, TILE_H);
      }
    }
  }

  /* ================================================================ */
  /*  玩家手牌                                                       */
  /* ================================================================ */
  /* 手牌显示顺序：返回 [显示槽位 -> 手牌真实索引]。
     新摸的牌永远排在最后一个槽位（最右），不插进手牌里。
     没有新摸牌时就是 0..n-1 的原序。 */
  function handDisplayOrder(st) {
    var n = st.players[0].hand.length;
    var nIdx = (newTileIdx >= 0 && newTileIdx < n) ? newTileIdx : -1;
    var order = [];
    for (var k = 0; k < n; k++) {
      if (k !== nIdx) order.push(k);
    }
    if (nIdx >= 0) order.push(nIdx);   /* 新摸的牌 → 最右槽位 */
    return order;
  }

  function drawHands(ctx, st, t) {
    var p = st.players[0];
    var isActive = (st.turn === 0 && (st.mode === "await_discard" || st.mode === "await_hu_choice"));
    var dAnim = activeDrawAnim();
    var drawAnimActive = (dAnim !== null);
    var dondenActive = (st.mode === "await_donden");

    /* 记录这张正在飞的牌在排序后手牌里的真实索引 */
    if (drawAnimActive && dAnim.data && typeof dAnim.data.idx === "number") {
      newTileIdx = dAnim.data.idx;
    }
    /* 不在自己的摸牌/出牌阶段且无动画 → 清除新牌标记 */
    if (!isActive && !drawAnimActive) newTileIdx = -1;
    if (newTileIdx < 0 || newTileIdx >= p.hand.length) newTileIdx = -1;
    /* 兜底：动画数据未带索引时，退回隐藏最后一张 */
    if (drawAnimActive && newTileIdx < 0 && p.hand.length > 0) {
      newTileIdx = p.hand.length - 1;
    }

    /* 新摸牌标记：上抬 4px + 金色边框（动画结束后才显示） */
    var isNewTile = (newTileIdx >= 0 && !drawAnimActive);

    /* 显示顺序：新摸的牌永远排在最后一个槽位（最右），不插进手牌里。
       出牌后 newTileIdx 被清除，手牌恢复全排序 → 那张牌才"插"回它该在的位置。 */
    var order = handDisplayOrder(st);

    for (var s = 0; s < order.length; s++) {
      var i = order[s];                 /* i = 这张牌在手牌数组里的真实索引 */
      /* 摸牌动画进行中：只隐藏那张正在被动画绘制的牌 */
      if (drawAnimActive && i === newTileIdx) continue;

      var tx = HAND_X + s * STRIDE;     /* 按显示槽位排布，而不是真实索引 */
      var ty = HAND_Y;

      var isSel = (i === st.selIdx);
      var isDondenSel = dondenActive && st.dondenSelSet && st.dondenSelSet.indexOf(i) >= 0;
      /* 新摸牌上抬 + 选中/换牌选中上抬 */
      if (isNewTile && i === newTileIdx) ty -= 4;
      if (isSel || isDondenSel) ty -= 6;
      drawTile(ctx, p.hand[i], tx, ty, TILE_W, TILE_H, true);

      /* 新摸牌金色边框 */
      if (isNewTile && i === newTileIdx) {
        var pulseN = 0.4 + 0.3 * Math.sin(t * 5);
        ctx.strokeStyle = "rgba(255,215,0," + pulseN + ")";
        ctx.lineWidth = 2;
        roundRect(ctx, tx - 1, ty - 1, TILE_W + DEPTH + 2, TILE_H + DEPTH + 2, 4);
        ctx.stroke();
      }
      if (isSel) {
        var pulse = 0.4 + 0.3 * Math.sin(t * 5);
        /* 外光晕 */
        ctx.fillStyle = "rgba(255,215,0," + pulse * 0.3 + ")";
        roundRect(ctx, tx - 4, ty - 4, TILE_W + DEPTH + 8, TILE_H + DEPTH + 8, 6);
        ctx.fill();
        /* 中光晕 */
        ctx.strokeStyle = "rgba(255,215,0," + pulse + ")";
        ctx.lineWidth = 5;
        roundRect(ctx, tx - 2, ty - 2, TILE_W + DEPTH + 4, TILE_H + DEPTH + 4, 5);
        ctx.stroke();
        /* 内边框 */
        ctx.strokeStyle = GOLD;
        ctx.lineWidth = 2.5;
        roundRect(ctx, tx - 1, ty - 1, TILE_W + DEPTH + 2, TILE_H + DEPTH + 2, 4);
        ctx.stroke();
      }
      if (isDondenSel) {
        var pulseD = 0.4 + 0.3 * Math.sin(t * 5);
        /* 外光晕 */
        ctx.fillStyle = "rgba(80,200,255," + pulseD * 0.3 + ")";
        roundRect(ctx, tx - 4, ty - 4, TILE_W + DEPTH + 8, TILE_H + DEPTH + 8, 6);
        ctx.fill();
        /* 中光晕 */
        ctx.strokeStyle = "rgba(80,200,255," + pulseD + ")";
        ctx.lineWidth = 5;
        roundRect(ctx, tx - 2, ty - 2, TILE_W + DEPTH + 4, TILE_H + DEPTH + 4, 5);
        ctx.stroke();
        /* 内边框 */
        ctx.strokeStyle = "#50c8ff";
        ctx.lineWidth = 2.5;
        roundRect(ctx, tx - 1, ty - 1, TILE_W + DEPTH + 2, TILE_H + DEPTH + 2, 4);
        ctx.stroke();
      }
    }

    if (isActive) {
      var pulse2 = 0.3 + 0.2 * Math.sin(t * 3);
      ctx.fillStyle = "rgba(255,215,0," + pulse2 + ")";
      var totalW = p.hand.length * STRIDE - 1;
      ctx.fillRect(HAND_X, HAND_Y + TILE_H + DEPTH + 2, totalW, 2.5);
    }
  }
  /* ================================================================ */
  /*  出牌动画                                                       */
  /* ================================================================ */
  /* 动画数据兼容：既支持旧的裸牌值，也支持 {tile, idx} 对象 */
  function animTile(a) {
    if (a.data && typeof a.data === "object" && typeof a.data.tile === "number") {
      return a.data.tile;
    }
    return a.data;
  }
  function drawAnims(ctx, st, t) {
    for (var i = 0; i < anims.length; i++) {
      var a = anims[i];
      var prog = Math.min(1, a.elapsed / a.duration);
      var e = easeOut(prog);
      var x = a.fromX + (a.toX - a.fromX) * e;
      var y = a.fromY + (a.toY - a.fromY) * e;

      if (a.type === "draw") {
        /* 摸牌动画：3 阶段 */
        ctx.globalAlpha = 1;
        var w = TILE_W, h = TILE_H;
        if (prog < 0.2) {
          /* 阶段1：牌墙位置弹入 */
          var popProg = prog / 0.2;
          var scale = 0.5 + 0.5 * easeOut(popProg);
          ctx.save();
          ctx.translate(x + w / 2, y + h / 2);
          ctx.scale(scale, scale);
          ctx.translate(-(x + w / 2), -(y + h / 2));
          drawTileBack(ctx, x, y, w, h);
          ctx.restore();
        } else if (prog < 0.6) {
          /* 阶段2：从牌墙飞向手牌区，显示牌背 */
          drawTileBack(ctx, x, y, w, h);
        } else {
          /* 阶段3：翻面（牌背→牌面） */
          var flipProg = (prog - 0.6) / 0.4;
          var scaleX = Math.cos(flipProg * Math.PI); /* 1 → -1 */
          ctx.save();
          var cx = x + w / 2;
          ctx.translate(cx, y + h / 2);
          ctx.scale(Math.abs(scaleX), 1);
          ctx.translate(-cx, -(y + h / 2));
          if (scaleX > 0) {
            drawTileBack(ctx, x, y, w, h);
          } else {
            drawTileFace(ctx, Core.tileKind(animTile(a)), x, y, w, h);
          }
          ctx.restore();
        }
      } else if (a.type === "discard") {
        /* 打牌动画：飞向弃牌区，带轻微旋转 */
        var alpha = prog > 0.6 ? 1 - (prog - 0.6) / 0.4 : 1;
        ctx.globalAlpha = alpha;
        var rot = Math.sin(prog * Math.PI) * 0.12;
        ctx.save();
        ctx.translate(x + TD_W / 2, y + TD_H / 2);
        ctx.rotate(rot);
        ctx.translate(-(x + TD_W / 2), -(y + TD_H / 2));
        drawTileFace(ctx, Core.tileKind(animTile(a)), x, y, TD_W, TD_H);
        ctx.restore();
      } else if (a.type === "deal") {
        ctx.globalAlpha = 1;
        drawTileBack(ctx, x, y, TB_W, TB_H);
      } else if (a.type === "donden") {
        /* 换牌动画：牌从 CPU 区域飞到玩家手牌区 */
        var alpha = prog > 0.7 ? 1 - (prog - 0.7) / 0.3 : 1;
        ctx.globalAlpha = alpha;
        drawTileFace(ctx, Core.tileKind(animTile(a)), x, y, TD_W, TD_H);
      } else {
        ctx.globalAlpha = 1;
      }
      ctx.globalAlpha = 1;
    }
  }

  /* ================================================================ */
  /*  三元换牌面板                                                   */
  /* ================================================================ */
  function drawDonDenPanel(ctx, st, t) {
    var panelY = HAND_Y - TILE_H - DEPTH - 100;
    var panelH = 80;
    var selCount = (st.dondonSelSet) ? st.dondonSelSet.length : 0;

    ctx.fillStyle = "rgba(0,0,0,0.92)";
    roundRect(ctx, 4, panelY, W - 8, panelH, 8);
    ctx.fill();

    ctx.strokeStyle = GOLD;
    ctx.lineWidth = 1.5;
    roundRect(ctx, 4.5, panelY + 0.5, W - 9, panelH - 1, 8);
    ctx.stroke();

    /* 标题 */
    ctx.fillStyle = GOLD;
    ctx.font = "bold 14px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Don-Den Exchange", W / 2, panelY + 16);

    /* 提示文字 */
    ctx.font = "10px sans-serif";
    if (selCount > 0) {
      ctx.fillStyle = "#88ccff";
      ctx.fillText(selCount + " tile" + (selCount > 1 ? "s" : "") + " selected", W / 2, panelY + 34);
    } else {
      ctx.fillStyle = "#aaa";
      ctx.fillText("Tap tiles to select", W / 2, panelY + 34);
    }

    /* EXCHANGE 按钮 */
    var exchX = W / 2 - 42, exchY = panelY + 44;
    var exchW = 84, exchH = 28;
    if (selCount > 0) {
      var pulse = 0.6 + 0.4 * Math.sin(t * 4);
      ctx.fillStyle = "rgba(255,215,0," + (0.12 + 0.08 * pulse) + ")";
      roundRect(ctx, exchX - 3, exchY - 3, exchW + 6, exchH + 6, 6);
      ctx.fill();
      var gB = ctx.createLinearGradient(0, exchY, 0, exchY + exchH);
      gB.addColorStop(0, "#ffd700");
      gB.addColorStop(0.5, "#c4a020");
      gB.addColorStop(1, "#8a6a10");
      ctx.fillStyle = gB;
      roundRect(ctx, exchX, exchY, exchW, exchH, 5);
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 1.5;
      roundRect(ctx, exchX + 1, exchY + 1, exchW - 2, exchH - 2, 4);
      ctx.stroke();
      ctx.fillStyle = "#1a1a1a";
      ctx.font = "bold 13px sans-serif";
      ctx.fillText("EXCHANGE", exchX + exchW / 2, exchY + exchH / 2);
    } else {
      ctx.fillStyle = "#333";
      roundRect(ctx, exchX, exchY, exchW, exchH, 5);
      ctx.fill();
      ctx.strokeStyle = "#555";
      ctx.lineWidth = 1;
      roundRect(ctx, exchX + 0.5, exchY + 0.5, exchW - 1, exchH - 1, 5);
      ctx.stroke();
      ctx.fillStyle = "#666";
      ctx.font = "bold 12px sans-serif";
      ctx.fillText("EXCHANGE", exchX + exchW / 2, exchY + exchH / 2);
    }

    /* SKIP 按钮 */
    var skipX = W - 64, skipY = panelY + 46;
    var skipW = 50, skipH = 24;
    ctx.fillStyle = "#444";
    roundRect(ctx, skipX, skipY, skipW, skipH, 5);
    ctx.fill();
    ctx.strokeStyle = "#888";
    ctx.lineWidth = 1;
    roundRect(ctx, skipX + 0.5, skipY + 0.5, skipW - 1, skipH - 1, 5);
    ctx.stroke();
    ctx.fillStyle = "#fff";
    ctx.font = "bold 11px sans-serif";
    ctx.fillText("SKIP", skipX + skipW / 2, skipY + skipH / 2);

    /* 剩余次数 */
    ctx.fillStyle = "#666";
    ctx.font = "9px sans-serif";
    ctx.fillText(st.donDenCount + " exchanges left", skipX + skipW / 2, panelY + 16);
  }

  /* ================================================================ */
  /*  立直按钮                                                       */
  /* ================================================================ */
  function drawRiichiBtn(ctx, st, t) {
    var pulse = 0.5 + 0.5 * Math.sin(t * 4);
    var btnX = W - 62, btnY = HAND_Y - 42;
    var bg = ctx.createLinearGradient(0, btnY, 0, btnY + 24);
    bg.addColorStop(0, "#ff5050");
    bg.addColorStop(0.5, "#dd2020");
    bg.addColorStop(1, "#881010");
    ctx.fillStyle = bg;
    roundRect(ctx, btnX, btnY, 54, 24, 5);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255," + (0.5 + 0.5 * pulse) + ")";
    ctx.lineWidth = 1.5;
    roundRect(ctx, btnX + 0.5, btnY + 0.5, 53, 23, 5);
    ctx.stroke();
    /* 火花 */
    if (pulse > 0.7) {
      ctx.fillStyle = "rgba(255,200,100,0.4)";
      ctx.beginPath();
      ctx.arc(btnX + 10, btnY + 5, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(btnX + 44, btnY + 19, 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "#fff";
    ctx.font = "bold 13px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Riichi!", btnX + 27, btnY + 12);
  }

  /* 立直持续特效 */
  function drawRiichiEffect(ctx, st, t) {
    var pulse = 0.3 + 0.2 * Math.sin(t * 3);
    /* 手牌下方红光 */
    var p = st.players[0];
    var totalW = p.hand.length * STRIDE - 1;
    ctx.fillStyle = "rgba(255,60,60," + pulse * 0.3 + ")";
    ctx.fillRect(HAND_X - 2, HAND_Y + TILE_H + DEPTH + 1, totalW + 4, 4);
    /* 火花粒子 */
    for (var i = 0; i < 5; i++) {
      var seed = i * 73;
      var sx = HAND_X + (seed % totalW);
      var sy = HAND_Y + TILE_H + DEPTH + 6 + Math.sin(t * 3 + i) * 3;
      ctx.fillStyle = "rgba(255," + (100 + i * 30) + ",50," + (0.2 + 0.1 * Math.sin(t * 5 + i)) + ")";
      ctx.beginPath();
      ctx.arc(sx, sy, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /* ================================================================ */
  /*  响应面板                                                       */
  /* ================================================================ */
  function drawActionPanel(ctx, st, t) {
    var panelY = HAND_Y - TILE_H - DEPTH - 80;
    var panelH = 60;

    ctx.fillStyle = "rgba(0,0,0,0.92)";
    roundRect(ctx, 4, panelY, W - 8, panelH, 8);
    ctx.fill();

    ctx.strokeStyle = GOLD;
    ctx.lineWidth = 1.5;
    roundRect(ctx, 4.5, panelY + 0.5, W - 9, panelH - 1, 8);
    ctx.stroke();

    ctx.fillStyle = "#aaa";
    ctx.font = "10px sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText("From: " + st.players[st.lastDiscard.fromPlayer].name, 14, panelY + 12);

    var btnY = panelY + 26;
    var btnH = 28;
    var btnX = 14;
    var opts = st.options;
    for (var i = 0; i < opts.length; i++) {
      var label = opts[i].type.toUpperCase();
      var bw = label.length * 8 + 22;
      var bg = ctx.createLinearGradient(0, btnY, 0, btnY + btnH);
      bg.addColorStop(0, "#ffd040");
      bg.addColorStop(0.5, "#e8a020");
      bg.addColorStop(1, "#b87010");
      ctx.fillStyle = bg;
      roundRect(ctx, btnX, btnY, bw, btnH, 5);
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 1;
      roundRect(ctx, btnX + 0.5, btnY + 0.5, bw - 1, btnH - 1, 5);
      ctx.stroke();
      ctx.fillStyle = "#1a1a1a";
      ctx.font = "bold 13px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(label, btnX + bw / 2, btnY + btnH / 2);
      btnX += bw + 6;
    }

    ctx.fillStyle = "#444";
    roundRect(ctx, btnX, btnY, 56, btnH, 5);
    ctx.fill();
    ctx.strokeStyle = "#888";
    roundRect(ctx, btnX + 0.5, btnY + 0.5, 55, btnH - 1, 5);
    ctx.stroke();
    ctx.fillStyle = "#fff";
    ctx.font = "bold 13px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("SKIP", btnX + 28, btnY + btnH / 2);
  }

  /* ================================================================ */
  /*  自摸胡面板                                                     */
  /* ================================================================ */
  function drawHuPanel(ctx, st, t) {
    var panelY = HAND_Y - TILE_H - DEPTH - 74;
    var panelH = 58;
    var pulse = 0.5 + 0.5 * Math.sin(t * 6);

    /* 发光背景 */
    ctx.fillStyle = "rgba(255,215,0," + pulse * 0.08 + ")";
    roundRect(ctx, 0, panelY - 4, W, panelH + 8, 10);
    ctx.fill();

    ctx.fillStyle = "rgba(0,0,0,0.92)";
    roundRect(ctx, 4, panelY, W - 8, panelH, 8);
    ctx.fill();

    ctx.strokeStyle = "rgba(255,215,0," + (0.5 + 0.5 * pulse) + ")";
    ctx.lineWidth = 2.5;
    roundRect(ctx, 4.5, panelY + 0.5, W - 9, panelH - 1, 8);
    ctx.stroke();

    ctx.fillStyle = "rgba(255,215,0," + (0.7 + 0.3 * pulse) + ")";
    ctx.font = "bold 17px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Ready to Win!", W / 2, panelY + 17);

    var bg = ctx.createLinearGradient(0, panelY + 32, 0, panelY + 54);
    bg.addColorStop(0, "#ffd040");
    bg.addColorStop(1, "#b87010");
    ctx.fillStyle = bg;
    roundRect(ctx, W / 2 - 38, panelY + 32, 76, 22, 5);
    ctx.fill();
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 1.5;
    roundRect(ctx, W / 2 - 37.5, panelY + 32.5, 75, 21, 5);
    ctx.stroke();
    ctx.fillStyle = "#1a1a1a";
    ctx.font = "bold 15px sans-serif";
    ctx.fillText("HU!", W / 2, panelY + 43);

    ctx.fillStyle = "#888";
    ctx.font = "10px sans-serif";
    ctx.fillText("tap tile to skip", W / 2, panelY + 56);
  }

  /* ================================================================ */
  /*  回合提示                                                       */
  /* ================================================================ */
  function drawTurnHint(ctx, st, t) {
    var p = st.players[st.turn];
    if (!p || p.isHuman) return;
    var pulse = 0.5 + 0.5 * Math.sin(t * 8);
    ctx.fillStyle = "rgba(0,0,0,0.65)";
    roundRect(ctx, W / 2 - 72, CPU_Y + 28, 144, 18, 5);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255," + (0.6 + 0.4 * pulse) + ")";
    ctx.font = "11px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(p.name + " thinking...", W / 2, CPU_Y + 37);
    /* 思考点 */
    var dots = Math.floor(t * 3) % 4;
    for (var i = 0; i < dots; i++) {
      ctx.fillStyle = "rgba(255,255,255," + (0.4 + 0.2 * i) + ")";
      ctx.beginPath();
      ctx.arc(W / 2 + 40 + i * 6, CPU_Y + 37, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /* ================================================================ */
  /*  菜单                                                           */
  /* ================================================================ */
  function drawMenu(ctx, st, t) {
    ctx.fillStyle = "rgba(0,0,0,0.82)";
    ctx.fillRect(0, 0, W, H);

    for (var i = 0; i < 5; i++) {
      var mx = 24 + i * 64;
      var k = (i * 4 + Math.floor(t * 0.5)) % 34;
      drawTileFace(ctx, k, mx, 36, 52, 72);
    }

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    var pulse = 0.5 + 0.5 * Math.sin(t * 2);
    ctx.fillStyle = "rgba(255,215,0," + (0.1 + 0.1 * pulse) + ")";
    ctx.beginPath();
    ctx.ellipse(W / 2, 158, 110, 32, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = GOLD;
    ctx.font = "bold 34px serif";
    ctx.fillText("MAHJONG", W / 2, 158);

    ctx.fillStyle = "#fff";
    ctx.font = "bold 15px sans-serif";
    ctx.fillText("2-Player Arcade", W / 2, 188);

    var blink = Math.sin(t * 3) > -0.3;
    if (blink) {
      ctx.fillStyle = "#88ccff";
      ctx.font = "13px sans-serif";
      ctx.fillText("Tap / Enter to Play", W / 2, 222);
    }

    ctx.fillStyle = "#e0a020";
    ctx.font = "12px sans-serif";
    ctx.fillText("Difficulty: " + st.diff.toUpperCase(), W / 2, 248);

    ctx.fillStyle = "#999";
    ctx.font = "11px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("· Don-Den: 5 tile exchanges at start", 24, 300);
    ctx.fillText("· Riichi: declare tenpai for bonus", 24, 318);
    ctx.fillText("· Need at least 1 yaku to win!", 24, 336);
    ctx.fillText("· Yaku: Tanyao/Yakuhai/Riichi/...", 24, 354);
    ctx.fillText("· Space=Chi  Alt=Peng  Ctrl=Gang", 24, 372);
    ctx.fillText("· Z=Hu  Click tiles to play", 24, 390);

    ctx.fillStyle = "rgba(184,150,10,0.5)";
    ctx.fillRect(28, 404, W - 56, 1);
  }

  /* ================================================================ */
  /*  一局结束                                                       */
  /* ================================================================ */
  function drawRoundOver(ctx, st, t) {
    ctx.fillStyle = "rgba(0,0,0,0.88)";
    ctx.fillRect(0, 0, W, H);

    var w = st.winInfo;
    if (!w) return;
    var p = st.players[w.winner];
    var isYou = (w.winner === 0);

    drawConfetti(ctx, t, isYou);
    if (isYou) drawWinGlow(ctx, t);

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    /* 文字阴影 */
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.font = "bold 30px serif";
    ctx.fillText(p.name + (isYou ? " Win!" : " Wins!"), W / 2 + 1, 109);
    ctx.fillStyle = isYou ? GOLD : "#ff6060";
    ctx.fillText(p.name + (isYou ? " Win!" : " Wins!"), W / 2, 108);

    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.font = "bold 26px sans-serif";
    ctx.fillText(w.fan + " Fan", W / 2 + 1, 153);
    ctx.fillStyle = "#fff";
    ctx.fillText(w.fan + " Fan", W / 2, 152);

    var hand = p.hand;
    var sx = Math.floor(W / 2 - hand.length * STRIDE / 2);
    for (var i = 0; i < hand.length; i++) {
      drawTile(ctx, hand[i], sx + i * STRIDE, 182, TILE_W, TILE_H, true);
    }

    ctx.fillStyle = "#bbb";
    ctx.font = "12px sans-serif";
    for (var r = 0; r < w.reasons.length; r++) {
      ctx.fillText("· " + w.reasons[r], W / 2, 248 + r * 17);
    }

    var pulse = 0.5 + 0.5 * Math.sin(t * 4);
    /* 按钮光晕 */
    ctx.fillStyle = "rgba(255,215,0," + pulse * 0.15 + ")";
    roundRect(ctx, W / 2 - 58, 344, 116, 42, 10);
    ctx.fill();
    var bg = ctx.createLinearGradient(0, 350, 0, 380);
    bg.addColorStop(0, "#ffd040");
    bg.addColorStop(1, "#b87010");
    ctx.fillStyle = bg;
    roundRect(ctx, W / 2 - 52, 350, 104, 30, 8);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255," + (0.5 + 0.5 * pulse) + ")";
    ctx.lineWidth = 2.5;
    roundRect(ctx, W / 2 - 51.5, 350.5, 103, 29, 8);
    ctx.stroke();
    ctx.fillStyle = "#1a1a1a";
    ctx.font = "bold 16px sans-serif";
    ctx.fillText("NEXT ▶", W / 2, 365);
  }

  function drawConfetti(ctx, t, isYou) {
    if (!isYou) return;
    for (var i = 0; i < 28; i++) {
      var seed = i * 137.5;
      var x = (Math.sin(seed + t * 1.5) * 0.5 + 0.5) * W;
      var y = ((t * 50 + seed * 3) % (H + 20)) - 10;
      var col = ["#ffd700", "#ff4060", "#40a0ff", "#40ff80", "#ff80ff"][i % 5];
      var size = 2.5 + (i % 3);
      ctx.fillStyle = col;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(t * 2 + i);
      ctx.fillRect(-size / 2, -size / 2, size, size);
      ctx.restore();
    }
  }

  function drawWinGlow(ctx, t) {
    /* 胜利光柱 */
    var pulse = 0.3 + 0.2 * Math.sin(t * 2);
    for (var i = 0; i < 3; i++) {
      var angle = (t * 0.5 + i * 2) % (Math.PI * 2);
      var x = W / 2 + Math.cos(angle) * 80;
      var y = 120 + Math.sin(angle * 2) * 30;
      ctx.fillStyle = "rgba(255,215,0," + pulse * 0.08 + ")";
      ctx.beginPath();
      ctx.arc(x, y, 30, 0, Math.PI * 2);
      ctx.fill();
    }
    /* 中心光芒 */
    var g = ctx.createRadialGradient(W / 2, 130, 0, W / 2, 130, 100);
    g.addColorStop(0, "rgba(255,215,0," + pulse * 0.12 + ")");
    g.addColorStop(1, "rgba(255,215,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 30, W, 200);
  }

  /* ================================================================ */
  /*  流局                                                           */
  /* ================================================================ */
  function drawDrawOver(ctx, st) {
    ctx.fillStyle = "rgba(0,0,0,0.88)";
    ctx.fillRect(0, 0, W, H);

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#aaa";
    ctx.font = "bold 32px serif";
    ctx.fillText("DRAW", W / 2, 160);

    ctx.fillStyle = "#fff";
    ctx.font = "14px sans-serif";
    ctx.fillText("Tiles exhausted", W / 2, 200);

    var bg = ctx.createLinearGradient(0, 260, 0, 290);
    bg.addColorStop(0, "#ffd040");
    bg.addColorStop(1, "#b87010");
    ctx.fillStyle = bg;
    roundRect(ctx, W / 2 - 52, 260, 104, 30, 8);
    ctx.fill();
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    roundRect(ctx, W / 2 - 51.5, 260.5, 103, 29, 8);
    ctx.stroke();
    ctx.fillStyle = "#1a1a1a";
    ctx.font = "bold 16px sans-serif";
    ctx.fillText("NEXT ▶", W / 2, 275);
  }

  /* ================================================================ */
  /*  命中检测                                                       */
  /* ================================================================ */
  /* 命中检测：把"显示槽位"换算回"手牌真实索引"。
     新摸的牌显示在最右，真实索引可能是任意值，必须过 handDisplayOrder 映射。 */
  function getHandTileAt(x, y, st) {
    if (x < HAND_X || x >= HAND_X + 14 * STRIDE) return -1;
    if (y < HAND_Y - 8 || y > HAND_Y + TILE_H + DEPTH + 2) return -1;
    var slot = Math.floor((x - HAND_X) / STRIDE);
    if (!st) return -1;                 /* 必须传 st，否则宁可点不中也不要选错牌 */
    var order = handDisplayOrder(st);
    if (slot < 0 || slot >= order.length) return -1;
    return order[slot];
  }

  function layoutInfo() {
    var huPanelY = HAND_Y - TILE_H - DEPTH - 74;
    var panelY = HAND_Y - TILE_H - DEPTH - 100;
    return {
      HAND_X: HAND_X, HAND_Y: HAND_Y,
      TILE_W: TILE_W, TILE_H: TILE_H, DEPTH: DEPTH, STRIDE: STRIDE,
      PANEL_Y: panelY,
      PANEL_BTN_Y: HAND_Y - TILE_H - DEPTH - 54,
      HU_BTN_X: W / 2 - 38,
      HU_BTN_Y: huPanelY + 32,
      HU_BTN_W: 76,
      HU_BTN_H: 22,
      DONDEN_EXCH_X: W / 2 - 42,
      DONDEN_EXCH_Y: panelY + 44,
      DONDEN_EXCH_W: 84,
      DONDEN_EXCH_H: 28,
      DONDEN_SKIP_X: W - 64,
      DONDEN_SKIP_Y: panelY + 46,
      DONDEN_SKIP_W: 50,
      DONDEN_SKIP_H: 24,
      RIICHI_BTN_X: W - 62,
      RIICHI_BTN_Y: HAND_Y - 42,
      RIICHI_BTN_W: 54,
      RIICHI_BTN_H: 24,
      WALL_X: WALL_X, WALL_Y: WALL_Y,
      PLAYER_DIS_Y: PLAYER_DIS_Y
    };
  }

  return {
    draw: draw,
    getHandTileAt: getHandTileAt,
    handDisplayOrder: handDisplayOrder,
    layoutInfo: layoutInfo,
    addAnim: addAnim
  };
})();

if (typeof module !== "undefined") module.exports = Render;
