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

  var HAND_Y = H - TILE_H - DEPTH - 8;
  var HAND_X = 5;
  var MELD_Y = HAND_Y - TILE_H - DEPTH - 2;
  var CPU_Y = HUD + 4;
  var CPU_HAND_Y = CPU_Y + 28;
  var CPU_DIS_Y = CPU_HAND_Y + TB_H + DEPTH + 4;
  var PLAYER_DIS_Y = MELD_Y - TD_H * 2 - DEPTH - 10;
  var WALL_X = W / 2;
  var WALL_Y = (CPU_DIS_Y + PLAYER_DIS_Y) / 2;

  /* ===== 街机配色（日式街机麻将 · 竖屏 CRT） =====
     深墨绿毡布 + 深色金属机台 + 琥珀/青双色霓虹。
     牌面与牌背的具体渐变写在 drawTileFace / drawTileBack 内部，
     这里的常量供背景 / HUD / 牌墙 / 高亮使用。 */
  var FELT_CORE = "#0e4a30";     /* 毡布中心（被打光照亮） */
  var FELT_MID  = "#0a3322";
  var FELT_EDGE = "#04170e";     /* 毡布边缘（暗角） */
  var BEZEL_HI  = "#39434c";     /* 机台金属 */
  var BEZEL_MID = "#1b2228";
  var BEZEL_LOW = "#080b0e";
  var NEON      = "#3ce0ff";     /* 青色霓虹 — 新牌 / 焦点 */
  var NEON_DIM  = "#0e6f8c";
  var AMBER     = "#ffb020";     /* 琥珀霓虹 — 选中 / 立直 / 分数 */
  var LED_GREEN = "#54ff9a";     /* 点阵数字 */
  var LED_RED   = "#ff4d4d";

  /* 旧名保留（多处绘制函数引用），指向新配色。
     注意：不要再往这里加"声明了但没人用"的颜色常量 —— 之前 T_L/T_EDGE/FELT_D 等
     一整批常量都是死的（真正的颜色写在各绘制函数里的字面量），
     只改常量会以为换了配色、实际画面毫无变化。 */
  var GOLD = AMBER;

  /* 字牌：真实麻将用**繁体**（東南西北中發白），简体看着不像真牌 */
  var HON_C = ["#1a3a6a","#1a3a6a","#1a3a6a","#1a3a6a","#c42020","#2d7a2d","#6a8aaa"];
  var HON_N = ["東","南","西","北","中","發","白"];

  /* ===== 真实牌面数据 =====
     万子：顶部汉字数字（蓝），底部「萬」（红）。真实牌用汉字而非阿拉伯数字，
           且五万多数牌刻的是大写「伍」。
     条子：一条画鸟；二/三/四/六/八条**纯绿**；五条中心一条红、七条最顶一条红、
           九条中间那一整列红。
     筒子：一筒大圆；三筒蓝红绿斜线；四筒两蓝两绿对角；五筒四筒+中心红；
           六筒上二绿下四红；七筒上三绿斜线下四红；八筒八蓝排 2 列×4 行；
           九筒三行三列，由顶至底为蓝、红、绿。 */
  var WAN_NUM = ["", "一", "二", "三", "四", "伍", "六", "七", "八", "九"];

  var TONG_COL = ["#1a5c8a", "#c42020", "#2d7a2d"];   /* 0=蓝 1=红 2=绿 */
  var TONG_LAYOUT = [
    null,
    /* 1筒 */ { dots: [[0, 0]], cols: [0], big: true },
    /* 2筒 */ { dots: [[0, -0.24], [0, 0.24]], cols: [0, 0] },
    /* 3筒 */ { dots: [[-0.2, -0.24], [0, 0], [0.2, 0.24]], cols: [0, 1, 2] },
    /* 4筒 */ { dots: [[-0.22, -0.24], [0.22, -0.24], [-0.22, 0.24], [0.22, 0.24]],
               cols: [0, 2, 2, 0] },
    /* 5筒 */ { dots: [[-0.22, -0.26], [0.22, -0.26], [0, 0],
                       [-0.22, 0.26], [0.22, 0.26]],
               cols: [0, 2, 1, 2, 0] },
    /* 6筒 — 2 列 × 3 行，顶上一对绿，其余四颗红 */
             { dots: [[-0.2, -0.3], [0.2, -0.3], [-0.2, 0], [0.2, 0],
                       [-0.2, 0.3], [0.2, 0.3]],
               cols: [2, 2, 1, 1, 1, 1] },
    /* 7筒 — 顶上三颗绿排成斜线，下面四颗红 */
             { dots: [[-0.24, -0.34], [0, -0.22], [0.24, -0.1],
                       [-0.2, 0.1], [0.2, 0.1], [-0.2, 0.32], [0.2, 0.32]],
               cols: [2, 2, 2, 1, 1, 1, 1] },
    /* 8筒 — 八颗蓝，2 列 × 4 行 */
             { dots: [[-0.2, -0.36], [0.2, -0.36], [-0.2, -0.12], [0.2, -0.12],
                       [-0.2, 0.12], [0.2, 0.12], [-0.2, 0.36], [0.2, 0.36]],
               cols: [0, 0, 0, 0, 0, 0, 0, 0] },
    /* 9筒 — 三行三列，顶到底 蓝 / 红 / 绿 */
             { dots: [[-0.24, -0.3], [0, -0.3], [0.24, -0.3],
                       [-0.24, 0], [0, 0], [0.24, 0],
                       [-0.24, 0.3], [0, 0.3], [0.24, 0.3]],
               cols: [0, 0, 0, 1, 1, 1, 2, 2, 2] }
  ];

  var TIAO_G = "#2d7a2d", TIAO_R = "#c42020";

  /* 条子排列：[dx, dy, 倾角(度)]，dx/dy 为相对牌心的比例。
     8条用真实的「上倒M + 下M」形，其余按真牌排布。 */
  var TIAO_LAYOUT = [
    null,
    /* 1条 — 画鸟，见 drawBird */ null,
    /* 2条 */ [[0, -0.22, 0], [0, 0.22, 0]],
    /* 3条 — 上一下二 */ [[0, -0.26, 0], [-0.2, 0.2, 0], [0.2, 0.2, 0]],
    /* 4条 */ [[-0.2, -0.22, 0], [0.2, -0.22, 0], [-0.2, 0.22, 0], [0.2, 0.22, 0]],
    /* 5条 — 中心那条红 */ [[-0.2, -0.26, 0], [0.2, -0.26, 0], [0, 0, 0],
                            [-0.2, 0.26, 0], [0.2, 0.26, 0]],
    /* 6条 — 上三下三，纯绿 */ [[-0.24, -0.24, 0], [0, -0.24, 0], [0.24, -0.24, 0],
                                [-0.24, 0.24, 0], [0, 0.24, 0], [0.24, 0.24, 0]],
    /* 7条 — 上方一条红，中间与下方各三条绿 */
                             [[0, -0.36, 0],
                              [-0.24, -0.03, 0], [0, -0.03, 0], [0.24, -0.03, 0],
                              [-0.24, 0.3, 0], [0, 0.3, 0], [0.24, 0.3, 0]],
    /* 8条 — 顶部四条「倒M形」，底部四条「M形」，纯绿 */
                             [[-0.3, -0.23, 22], [-0.1, -0.23, -22],
                              [0.1, -0.23, 22], [0.3, -0.23, -22],
                              [-0.3, 0.23, -22], [-0.1, 0.23, 22],
                              [0.1, 0.23, -22], [0.3, 0.23, 22]],
    /* 9条 — 三行三列，中间那一整列红 */
                             [[-0.24, -0.3, 0], [0, -0.3, 0], [0.24, -0.3, 0],
                              [-0.24, 0, 0], [0, 0, 0], [0.24, 0, 0],
                              [-0.24, 0.3, 0], [0, 0.3, 0], [0.24, 0.3, 0]]
  ];

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

  /* 按类型取活跃动画（无则 null）。CPU 的摸牌/打牌动画靠它来"藏住"目标实体，
     否则会出现"牌已经在原位 + 一张牌又飞过来"的重影。 */
  function activeAnim(type) {
    for (var i = 0; i < anims.length; i++) {
      if (anims[i].type === type) return anims[i];
    }
    return null;
  }

  /* CPU 手牌第 i 个槽位的屏幕坐标（手牌背是居中对齐的） */
  function cpuHandSlotX(st, i) {
    var n = st.players[1].hand.length;
    var totalW = n * (TB_W + DEPTH);
    var sx = Math.floor(W / 2 - totalW / 2);
    return sx + i * (TB_W + DEPTH);
  }

  /* CPU 牌河第 i 张牌（从 cap 窗口起点算）的屏幕坐标 */
  function cpuDiscardSlotPos(i) {
    var cols = 7;
    var stride = TD_W + DEPTH + 1;
    var totalW = cols * stride;
    var sx = Math.floor(W / 2 - totalW / 2);
    var idx = i % (cols * 2);
    var col = idx % cols, row = Math.floor(idx / cols);
    return { x: sx + col * stride, y: CPU_DIS_Y + row * (TD_H + DEPTH + 1) };
  }

  /* ⚠️ 这里曾经有一个模块级变量 newTileIdx（记录"摸到的牌"的真实索引）。
     它只在 drawHands 里被赋值，但 getHandTileAt（命中检测）也读它 ——
     于是"画出来的位置"和"点到的手牌"可能来自两次不同的赋值。
     现在彻底删掉：索引一律由 drawnRealIdxFromState(st) 从 st 现算，
     handDisplayOrder 因此变成纯函数，绘制和命中检测不可能错位。 */

  /* CPU 这一巡摸到的牌在它手牌里的槽位（-1 表示无）。
     由 aiDraw 动画写入，用于在"思考"阶段高亮那一张。 */
  var cpuNewIdx = -1;

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
    drawTurnPlate(ctx, st, t);
    drawHint(ctx, st, t);
    if (st.mode === "await_discard" && Core.canRiichi && Core.canRiichi(st, 0) && !st.riichi[0])
      drawRiichiBtn(ctx, st, t);
    if (st.riichi[0] && st.mode !== "round_over" && st.mode !== "draw")
      drawRiichiEffect(ctx, st, t);
    if (st.mode === "round_over") drawRoundOver(ctx, st, t);
    else if (st.mode === "draw")   drawDrawOver(ctx, st, t);
    else if (st.mode === "ai_win") drawAiWinReveal(ctx, st, t);
  }

  /* ================================================================ */
  /*  背景 — 街机机台 + 墨绿毡布 + CRT 质感                          */
  /* ================================================================ */
  function drawBackground(ctx, t) {
    /* 1. 机台金属外框 */
    var gb = ctx.createLinearGradient(0, 0, 0, H);
    gb.addColorStop(0, BEZEL_HI);
    gb.addColorStop(0.10, BEZEL_MID);
    gb.addColorStop(0.5, "#12181d");
    gb.addColorStop(0.90, BEZEL_MID);
    gb.addColorStop(1, BEZEL_LOW);
    ctx.fillStyle = gb;
    ctx.fillRect(0, 0, W, H);

    /* 拉丝金属纹 */
    ctx.strokeStyle = "rgba(255,255,255,0.028)";
    ctx.lineWidth = 0.5;
    for (var mx = 0; mx < W; mx += 2) {
      ctx.beginPath(); ctx.moveTo(mx + 0.5, 0); ctx.lineTo(mx + 0.5, H); ctx.stroke();
    }

    /* 2. 毡布面 — 中心亮、四周暗 */
    var gF = ctx.createRadialGradient(W / 2, H * 0.46, 20, W / 2, H * 0.52, 300);
    gF.addColorStop(0, FELT_CORE);
    gF.addColorStop(0.35, FELT_MID);
    gF.addColorStop(0.75, "#062516");
    gF.addColorStop(1, FELT_EDGE);
    ctx.fillStyle = gF;
    ctx.fillRect(7, 7, W - 14, H - 14);

    /* 毡布细纤维 */
    ctx.strokeStyle = "rgba(255,255,255,0.018)";
    ctx.lineWidth = 0.4;
    for (var y3 = 9; y3 < H - 9; y3 += 3) {
      ctx.beginPath();
      ctx.moveTo(9, y3 + 0.5);
      ctx.lineTo(W - 9, y3 + 0.5);
      ctx.stroke();
    }

    /* 3. 桌面中央徽记（低对比度雕花，只做质感） */
    drawTableEmblem(ctx, W / 2, H * 0.46);

    /* 4. 霓虹内框 — 双线 */
    ctx.strokeStyle = NEON_DIM;
    ctx.lineWidth = 1.4;
    ctx.strokeRect(7.5, 7.5, W - 15, H - 15);
    ctx.strokeStyle = "rgba(60,224,255,0.22)";
    ctx.lineWidth = 0.7;
    ctx.strokeRect(10, 10, W - 20, H - 20);

    /* 四角霓虹角标 */
    drawNeonCorner(ctx, 11, 11, 1, 1);
    drawNeonCorner(ctx, W - 11, 11, -1, 1);
    drawNeonCorner(ctx, 11, H - 11, 1, -1);
    drawNeonCorner(ctx, W - 11, H - 11, -1, -1);

    /* 5. CRT 扫描线 + 暗角（叠在最上层） */
    ctx.fillStyle = "rgba(0,0,0,0.085)";
    for (var sy = 0; sy < H; sy += 3) ctx.fillRect(0, sy, W, 1);

    var gV = ctx.createRadialGradient(W / 2, H / 2, H * 0.28, W / 2, H / 2, H * 0.72);
    gV.addColorStop(0, "rgba(0,0,0,0)");
    gV.addColorStop(1, "rgba(0,0,0,0.42)");
    ctx.fillStyle = gV;
    ctx.fillRect(0, 0, W, H);
  }

  /* 桌面中央徽记：同心圆 + 十字雕花，alpha 极低，只当质感不当图案 */
  function drawTableEmblem(ctx, cx, cy) {
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.05)";
    ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.arc(cx, cy, 62, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, 56, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, 22, 0, Math.PI * 2); ctx.stroke();

    /* 十字 */
    ctx.strokeStyle = "rgba(255,255,255,0.055)";
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(cx, cy - 15); ctx.lineTo(cx, cy + 15);
    ctx.moveTo(cx - 10, cy - 4); ctx.lineTo(cx + 10, cy - 4);
    ctx.stroke();

    /* 放射刻度 */
    ctx.strokeStyle = "rgba(255,255,255,0.04)";
    ctx.lineWidth = 0.7;
    for (var a = 0; a < 12; a++) {
      var ang = a * Math.PI / 6;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(ang) * 24, cy + Math.sin(ang) * 24);
      ctx.lineTo(cx + Math.cos(ang) * 52, cy + Math.sin(ang) * 52);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawNeonCorner(ctx, x, y, dx, dy) {
    ctx.save();
    ctx.strokeStyle = "rgba(60,224,255,0.5)";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(x + dx * 12, y);
    ctx.lineTo(x, y);
    ctx.lineTo(x, y + dy * 12);
    ctx.stroke();
    ctx.fillStyle = "rgba(60,224,255,0.75)";
    ctx.beginPath();
    ctx.arc(x + dx * 2, y + dy * 2, 1.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /* ================================================================ */
  /*  HUD — 街机 LED 状态条                                          */
  /* ================================================================ */
  /* 霓虹字：同色叠加两次 + shadowBlur，做出灯管的辉光 */
  function glowText(ctx, str, x, y, color, blur) {
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = (blur === undefined) ? 6 : blur;
    ctx.fillStyle = color;
    ctx.fillText(str, x, y);
    ctx.fillText(str, x, y);
    ctx.restore();
  }

  function drawHUD(ctx, st, t) {
    /* 金属条 */
    var gh = ctx.createLinearGradient(0, 0, 0, HUD);
    gh.addColorStop(0, "#2c343a");
    gh.addColorStop(0.45, "#151b20");
    gh.addColorStop(1, "#0a0e12");
    ctx.fillStyle = gh;
    ctx.fillRect(0, 0, W, HUD);
    ctx.fillStyle = "rgba(255,255,255,0.07)";
    ctx.fillRect(0, 0, W, 1);
    /* 底部霓虹线 */
    ctx.fillStyle = "rgba(60,224,255,0.20)";
    ctx.fillRect(0, HUD - 3, W, 2);
    ctx.fillStyle = NEON;
    ctx.fillRect(0, HUD - 1, W, 1);

    ctx.textBaseline = "middle";

    /* 左：局数 */
    ctx.textAlign = "left";
    ctx.font = "bold 12px monospace";
    glowText(ctx, "R" + st.round, 7, HUD / 2, LED_GREEN);

    /* 庄家标记 */
    ctx.font = "bold 11px monospace";
    glowText(ctx, "★" + st.players[st.dealer].name.toUpperCase(), 32, HUD / 2,
             st.dealer === 0 ? AMBER : "#ff8080");

    /* 换牌 / 立直 状态 */
    if (st.mode === "await_donden") {
      ctx.font = "bold 10px monospace";
      glowText(ctx, "EXCH " + st.donDenCount, 98, HUD / 2, "#ff8844");
    } else if (st.riichi[0]) {
      ctx.font = "bold 10px monospace";
      ctx.globalAlpha = 0.6 + 0.4 * Math.sin(t * 6);
      glowText(ctx, "RIICHI", 98, HUD / 2, LED_RED);
      ctx.globalAlpha = 1;
    }

    /* 中：牌山剩余 */
    ctx.textAlign = "center";
    ctx.font = "bold 12px monospace";
    glowText(ctx, String(st.deck.length), W / 2, HUD / 2,
             st.deck.length <= 8 ? LED_RED : LED_GREEN);

    /* 右：比分 */
    ctx.textAlign = "right";
    ctx.font = "bold 12px monospace";
    glowText(ctx, "YOU " + st.players[0].wins + ":" + st.players[1].wins + " CPU",
             W - 7, HUD / 2, "#ffe08a");
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

    /* 右侧面 — 3层渐变（牌身用冷灰蓝，避免和墨绿毡布糊在一起） */
    var gSide = ctx.createLinearGradient(x + w, y, x + w + d, y);
    gSide.addColorStop(0, "#3d4c56");
    gSide.addColorStop(0.3, "#25303a");
    gSide.addColorStop(1, "#0b1015");
    ctx.fillStyle = gSide;
    ctx.fillRect(x + w, y, d, h);
    /* 右侧面顶部高光 */
    ctx.fillStyle = "rgba(150,190,215,0.30)";
    ctx.fillRect(x + w, y + 1, d, 1.5);

    /* 底侧面 */
    var gBot = ctx.createLinearGradient(0, y + h, 0, y + h + d);
    gBot.addColorStop(0, "#25303a");
    gBot.addColorStop(1, "#080c11");
    ctx.fillStyle = gBot;
    ctx.fillRect(x, y + h, w, d);

    /* 角侧面 */
    ctx.fillStyle = "#05080b";
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
    var num = WAN_NUM[r] || "一";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    /* 数字 — 蓝色（真实牌的数字是蓝的，不是红的） */
    ctx.font = "bold " + Math.min(w * 0.6, h * 0.38) + "px serif";
    ctx.fillStyle = "rgba(0,0,0,0.15)";
    ctx.fillText(num, x + w / 2 + 0.5, y + h * 0.29 + 0.5);
    ctx.fillStyle = "#1a4a9a";
    ctx.fillText(num, x + w / 2, y + h * 0.29);
    /* 萬 — 红色，繁体 */
    ctx.font = "bold " + Math.min(w * 0.52, h * 0.34) + "px serif";
    ctx.fillStyle = "rgba(0,0,0,0.15)";
    ctx.fillText("萬", x + w / 2 + 0.5, y + h * 0.72 + 0.5);
    ctx.fillStyle = "#c42020";
    ctx.fillText("萬", x + w / 2, y + h * 0.72);
  }

  function drawTong(ctx, r, x, y, w, h) {
    var L = TONG_LAYOUT[r];
    if (!L) return;
    var cx = x + w / 2, cy = y + h / 2;
    var m = Math.min(w, h);
    /* 一筒的圆最大，二筒次之，三筒起变小；六筒以后还要再小一号才排得下 */
    var dr = L.big ? m * 0.3
           : (r <= 2 ? m * 0.15
           : (r <= 5 ? m * 0.115 : m * 0.098));

    for (var i = 0; i < L.dots.length; i++) {
      var dx = cx + L.dots[i][0] * w, dy = cy + L.dots[i][1] * h;
      var col = TONG_COL[L.cols[i]];

      /* 一筒：同心圆（外蓝环 + 米色环 + 红心），真牌就是这样一个大饼 */
      if (L.big) {
        ctx.fillStyle = "rgba(0,0,0,0.15)";
        ctx.beginPath(); ctx.arc(dx + 0.4, dy + 0.4, dr, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.arc(dx, dy, dr, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#f0e2bc";
        ctx.beginPath(); ctx.arc(dx, dy, dr * 0.64, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = TONG_COL[1];
        ctx.beginPath(); ctx.arc(dx, dy, dr * 0.33, 0, Math.PI * 2); ctx.fill();
        continue;
      }

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

  /* 一根竹子：圆角长条 + 两道竹节 + 左缘高光。ang 为弧度。 */
  function drawStick(ctx, cx, cy, bw, bh, col, ang) {
    ctx.save();
    ctx.translate(cx, cy);
    if (ang) ctx.rotate(ang);
    ctx.fillStyle = "rgba(0,0,0,0.15)";
    roundRect(ctx, -bw / 2 + 0.3, -bh / 2 + 0.3, bw, bh, bw * 0.45);
    ctx.fill();
    ctx.fillStyle = col;
    roundRect(ctx, -bw / 2, -bh / 2, bw, bh, bw * 0.45);
    ctx.fill();
    /* 两道竹节 */
    ctx.fillStyle = "rgba(0,0,0,0.28)";
    ctx.fillRect(-bw / 2, -bh / 6 - 0.3, bw, 0.6);
    ctx.fillRect(-bw / 2, bh / 6 - 0.3, bw, 0.6);
    /* 左缘高光 */
    ctx.fillStyle = "rgba(255,255,255,0.22)";
    ctx.fillRect(-bw / 2 + bw * 0.18, -bh / 2 + bh * 0.1, bw * 0.2, bh * 0.8);
    ctx.restore();
  }

  /* 一条 = 幺鸡（麻雀）。真实麻将的一条不画竹子，画的是一只鸟。 */
  function drawBird(ctx, x, y, w, h) {
    var cx = x + w / 2, cy = y + h / 2;
    var G = "#2d7a2d", GD = "#1d5a1d";

    /* 尾羽 — 左下散开两根 */
    ctx.fillStyle = GD;
    ctx.save();
    ctx.translate(cx - w * 0.17, cy + h * 0.17);
    ctx.rotate(-0.75);
    roundRect(ctx, -w * 0.055, 0, w * 0.11, h * 0.3, w * 0.05);
    ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.translate(cx - w * 0.14, cy + h * 0.19);
    ctx.rotate(-0.35);
    roundRect(ctx, -w * 0.055, 0, w * 0.11, h * 0.26, w * 0.05);
    ctx.fill();
    ctx.restore();

    /* 身体 */
    ctx.fillStyle = G;
    ctx.beginPath();
    ctx.ellipse(cx - w * 0.02, cy + h * 0.03, w * 0.27, h * 0.24, -0.22, 0, Math.PI * 2);
    ctx.fill();

    /* 翅膀 */
    ctx.fillStyle = GD;
    ctx.beginPath();
    ctx.ellipse(cx - w * 0.05, cy + h * 0.07, w * 0.15, h * 0.12, -0.5, 0, Math.PI * 2);
    ctx.fill();

    /* 头 */
    ctx.fillStyle = G;
    ctx.beginPath();
    ctx.arc(cx + w * 0.16, cy - h * 0.19, w * 0.16, 0, Math.PI * 2);
    ctx.fill();

    /* 红色冠羽 */
    ctx.fillStyle = "#c42020";
    ctx.beginPath();
    ctx.arc(cx + w * 0.13, cy - h * 0.33, w * 0.07, 0, Math.PI * 2);
    ctx.fill();

    /* 喙 — 橙红三角，朝右 */
    ctx.fillStyle = "#e08020";
    ctx.beginPath();
    ctx.moveTo(cx + w * 0.29, cy - h * 0.23);
    ctx.lineTo(cx + w * 0.45, cy - h * 0.18);
    ctx.lineTo(cx + w * 0.29, cy - h * 0.13);
    ctx.closePath();
    ctx.fill();

    /* 眼 */
    ctx.fillStyle = "#141414";
    ctx.beginPath();
    ctx.arc(cx + w * 0.2, cy - h * 0.22, w * 0.038, 0, Math.PI * 2);
    ctx.fill();

    /* 腿 — 红色细线 */
    ctx.strokeStyle = "#c42020";
    ctx.lineWidth = Math.max(0.7, w * 0.035);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.06, cy + h * 0.25); ctx.lineTo(cx - w * 0.1, cy + h * 0.4);
    ctx.moveTo(cx + w * 0.06, cy + h * 0.25); ctx.lineTo(cx + w * 0.1, cy + h * 0.4);
    ctx.stroke();
  }

  function drawTiao(ctx, r, x, y, w, h) {
    if (r === 1) { drawBird(ctx, x, y, w, h); return; }
    var pos = TIAO_LAYOUT[r];
    if (!pos) return;
    var cx = x + w / 2, cy = y + h / 2;
    /* 8条要挤 8 根还得留出斜角，单独细一号 */
    var bw = r === 8 ? w * 0.075
           : (r <= 2 ? w * 0.14 : (r <= 4 ? w * 0.12 : (r <= 6 ? w * 0.105 : w * 0.09)));
    var bh = r === 8 ? h * 0.16
           : (r <= 3 ? h * 0.27 : (r <= 6 ? h * 0.21 : h * 0.175));

    for (var i = 0; i < pos.length; i++) {
      /* 真牌的红条只有三处：五条正中心、七条最顶上、九条中间那一整列 */
      var red = (r === 5 && i === 2) || (r === 7 && i === 0) || (r === 9 && i % 3 === 1);
      drawStick(ctx,
                cx + pos[i][0] * w, cy + pos[i][1] * h,
                bw, bh,
                red ? TIAO_R : TIAO_G,
                pos[i][2] * Math.PI / 180);
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

    /* 状态行：正常显示手牌数；AI 回合让位给 DRAWING/THINKING 指示 */
    if (st.mode !== "ai_turn") {
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#8fa4bb";
      ctx.font = "10px monospace";
      ctx.fillText(p.hand.length + " tiles", 34, CPU_Y + 18);
    }

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

    /* CPU 手牌背。
       aiDraw 动画进行中：隐藏正在飞的那一张（槽位 = 手牌数-1），
       否则会"原位已经有一张 + 又飞过来一张"重影。
       摸完之后（think/discard 段）：最右那张就是刚摸到的，给它青色霓虹描边，
       这样玩家能看见"CPU 摸了牌、正在想"，而不是一瞬间出结果。 */
    var aiDraw = activeAnim("aiDraw");
    var cpuHandN = p.hand.length;
    if (st.mode === "ai_turn" && st.aiPhase !== "draw") cpuNewIdx = cpuHandN - 1;
    else cpuNewIdx = -1;
    if (cpuNewIdx >= cpuHandN) cpuNewIdx = -1;

    var totalW = cpuHandN * (TB_W + DEPTH);
    var sx = Math.floor(W / 2 - totalW / 2);
    for (var i = 0; i < cpuHandN; i++) {
      if (aiDraw && i === cpuHandN - 1) continue;   /* 这张正在飞 */
      var bx = sx + i * (TB_W + DEPTH);
      drawTileBack(ctx, bx, CPU_HAND_Y, TB_W, TB_H);
      if (i === cpuNewIdx) {
        var pulseC = 0.45 + 0.35 * Math.sin(t * 6);
        ctx.strokeStyle = "rgba(60,224,255," + pulseC + ")";
        ctx.lineWidth = 1.6;
        roundRect(ctx, bx - 1.5, CPU_HAND_Y - 1.5, TB_W + DEPTH + 3, TB_H + DEPTH + 3, 3);
        ctx.stroke();
      }
    }

    /* 思考指示：ai_turn 期间占用 CPU 的状态行（就是原来显示 "N tiles" 的位置） */
    if (st.mode === "ai_turn") {
      var n = 1 + (Math.floor(t * 3.2) % 3);
      var think = (st.aiPhase === "draw") ? "DRAWING" : "THINKING";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.font = "bold 8px monospace";
      glowText(ctx, think, 34, CPU_Y + 18, NEON, 5);
      var tx0 = 34 + think.length * 5.2 + 5;
      for (var d = 0; d < 3; d++) {
        ctx.fillStyle = (d < n) ? NEON : "rgba(60,224,255,0.22)";
        ctx.beginPath();
        ctx.arc(tx0 + d * 5, CPU_Y + 18, 1.7, 0, Math.PI * 2);
        ctx.fill();
      }
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
    /* 正在飞向牌河的那一张先不画，交给 aiDiscard 动画绘制 */
    var aiDis = activeAnim("aiDiscard");
    var flying = (aiDis && aiDis.data && typeof aiDis.data.idx === "number")
                 ? aiDis.data.idx : -1;
    for (var i = start; i < p.discards.length; i++) {
      if (i === flying) continue;
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
  /*  牌山 — 看得见在变短的牌墙 + LED 读数                          */
  /* ================================================================ */
  function drawWall(ctx, st, t) {
    var remaining = st.deck.length;
    var total = st.wallSize || 44;
    var maxCols = 10;
    /* 可见列数随剩余牌数收缩 —— 玩家能直观看到"牌山快没了" */
    var cols = Math.max(1, Math.ceil(remaining / total * maxCols));
    if (remaining <= 0) cols = 0;

    var cw = 12, ch = 16, lift = 6, stride = 16;
    var wallW = cols > 0 ? cols * stride - (stride - cw) : 0;
    var sx = Math.round(WALL_X - wallW / 2);
    var sy = Math.round(WALL_Y - 12);

    /* 台座 + 阴影 */
    ctx.fillStyle = "rgba(0,0,0,0.30)";
    ctx.beginPath();
    ctx.ellipse(WALL_X, sy + ch + lift + 6, Math.max(20, wallW / 2 + 8), 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(0,0,0,0.18)";
    roundRect(ctx, sx - 4, sy + ch + lift - 1, wallW + 8, 5, 2);
    ctx.fill();

    /* 每列两块牌背（下层露一条边 → 读作"两层高的牌墙"） */
    for (var c = 0; c < cols; c++) {
      var x = sx + c * stride;
      drawTileBack(ctx, x, sy + lift, cw, ch);
      drawTileBack(ctx, x, sy, cw, ch);
    }

    /* LED 读数 */
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "bold 15px monospace";
    var low = (remaining <= 8);
    var col = low ? LED_RED : LED_GREEN;
    if (low) ctx.globalAlpha = 0.55 + 0.45 * Math.sin(t * 7);
    glowText(ctx, String(remaining), WALL_X, sy - 12, col, 8);
    ctx.globalAlpha = 1;

    /* 标签 */
    ctx.font = "9px monospace";
    ctx.fillStyle = "rgba(255,255,255,0.38)";
    ctx.fillText("WALL", WALL_X, sy + ch + lift + 13);

    /* 低牌警告 */
    if (low) {
      var pulse = 0.35 + 0.35 * Math.sin(t * 7);
      ctx.fillStyle = "rgba(255,77,77," + pulse + ")";
      ctx.beginPath();
      ctx.arc(WALL_X + 26, sy - 12, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.font = "bold 9px monospace";
      ctx.fillText("!", WALL_X + 26, sy - 12);
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
     玩家自己的出牌阶段里，"摸到的牌"永远排在最后一个槽位（最右），不插进手牌里；
     其他时候就是 0..n-1 的原序。
     ⚠️ 纯函数：只依赖 st，不依赖任何模块级可变状态。
     绘制（drawHands）和命中检测（getHandTileAt）都调它，所以两者必然一致 ——
     否则"看到的位置"和"点到的手牌"会错位，表现就是"点这张牌却打出另一张"。
     新牌索引来自 drawnRealIdxFromState()，和 core 是同一个定义 —— 见那里的注释。 */
  /* "本回合摸到的牌"该不该单独排到最右槽位？该的话返回它的真实索引，否则 -1。
     ⚠️ 绘制（drawHands）和命中检测（getHandTileAt→handDisplayOrder）都从这里取，
     所以两者永远一致 —— 否则"看到的位置"和"点到的手牌"会错位。 */
  function handDrawnIdx(st) {
    var n = st.players[0].hand.length;
    /* 只有玩家自己的出牌阶段才把摸到的牌单独排到最右 */
    if (!(st.turn === 0 && (st.mode === "await_discard" || st.mode === "await_hu_choice"))) {
      return -1;
    }
    var k = drawnRealIdxFromState(st);
    return (k >= 0 && k < n) ? k : -1;
  }

  function handDisplayOrder(st) {
    var n = st.players[0].hand.length;
    var nIdx = handDrawnIdx(st);
    var order = [];
    for (var k = 0; k < n; k++) {
      if (k !== nIdx) order.push(k);
    }
    if (nIdx >= 0) order.push(nIdx);   /* 新摸的牌 → 最右槽位 */
    return order;
  }

  /* "本回合摸到的牌"在手牌数组里的真实索引 —— 唯一权威。
     ⚠️ 只能用 core 的 st.lastDrawnTile（等价于 core.drawnTileOf 的规则），
     绝不能用摸牌动画的 data.idx：那是 index.html 里 findDrawnTile() 找出来的
     **插入位置**，当摸到的牌手里已经有同值的牌时，插入位置（第二个 1m）
     ≠ core 用 indexOf 认定的位置（第一个 1m）。两边不一致的后果：
       · 渲染把索引 A 排在最后一格（显示成"刚摸到的牌"）
       · core 只接受索引 B 的那张牌
       · 立直后 declareRiichi 把 selIdx 设在 B
       → 玩家点最右那格（UI 说是摸到的牌）时 selIdx ≠ idx，只是换了个选中态，
         牌纹丝不动；再点一次才打出去 —— 玩家看到的就是"正确的那张牌打不出去"。
     规则与 core.drawnTileOf 完全一致：lastDrawnTile 还在手 → 用它的位置，
     否则退回最后一张（吃/碰之后没有摸牌的情况）。 */
  function drawnRealIdxFromState(st) {
    var h = st.players[0].hand;
    if (!h || h.length === 0) return -1;
    if (typeof st.lastDrawnTile === "number") {
      var k = h.indexOf(st.lastDrawnTile);
      if (k >= 0) return k;
    }
    return h.length - 1;
  }

  function drawHands(ctx, st, t) {
    var p = st.players[0];
    var isActive = (st.turn === 0 && (st.mode === "await_discard" || st.mode === "await_hu_choice"));
    var dAnim = activeDrawAnim();
    var drawAnimActive = (dAnim !== null);
    var dondenActive = (st.mode === "await_donden");

    /* "摸到的牌"的真实索引 —— 和 handDisplayOrder 用同一个函数取，
       保证"画在哪一格"和"点哪一格算这张牌"永远一致。
       这正是"点了摸到的牌却打不出去"的根因所在。 */
    var drawnIdx = handDrawnIdx(st);

    /* 新摸牌标记：上抬 4px + 青色霓虹边框（动画结束后才显示） */
    var isNewTile = (drawnIdx >= 0 && !drawAnimActive);

    /* 显示顺序：摸到的牌永远排在最后一个槽位（最右），不插进手牌里。
       出牌后 lastDrawnTile 失效，手牌恢复全排序 → 那张牌才"插"回它该在的位置。 */
    var order = handDisplayOrder(st);

    for (var s = 0; s < order.length; s++) {
      var i = order[s];                 /* i = 这张牌在手牌数组里的真实索引 */
      /* 摸牌动画进行中：只隐藏那张正在被动画绘制的牌 */
      if (drawAnimActive && i === drawnIdx) continue;

      var tx = HAND_X + s * STRIDE;     /* 按显示槽位排布，而不是真实索引 */
      var ty = HAND_Y;

      var isSel = (i === st.selIdx);
      var isDondenSel = dondenActive && st.dondenSelSet && st.dondenSelSet.indexOf(i) >= 0;
      /* 新摸牌上抬 + 选中/换牌选中上抬 */
      if (isNewTile && i === drawnIdx) ty -= 4;
      if (isSel || isDondenSel) ty -= 6;
      drawTile(ctx, p.hand[i], tx, ty, TILE_W, TILE_H, true);

      /* 新摸的牌 —— 用**青色**霓虹，不是金色。
         金色是"选中"的颜色：两者都用金色时，玩家分不清哪张是刚摸到的、
         哪张是自己选的，于是出现"牌直立着但打不出去"的困惑（截图里
         最左的选中牌和最右的摸牌长得一模一样）。
         立直期间再套一圈红环，明确"只有这张能打"。 */
      if (isNewTile && i === drawnIdx) {
        var pulseN = 0.4 + 0.3 * Math.sin(t * 5);
        var riichiNow = st.riichi[0] &&
                        (st.mode === "await_discard" || st.mode === "await_hu_choice");
        var hintOn = (st.hintT > 0 && st.hintTile === i);
        /* 牌顶一道青色窄条：边框可能被相邻牌压住，这条一定看得见 */
        ctx.fillStyle = "rgba(60,224,255," + (0.55 + 0.35 * Math.sin(t * 5)) + ")";
        ctx.fillRect(tx + 3, ty + 3, TILE_W - 6, 2.5);
        if (riichiNow || hintOn) {
          ctx.strokeStyle = "rgba(255,77,77," + (0.55 + 0.45 * Math.sin(t * 7)) + ")";
          ctx.lineWidth = 3;
        } else {
          ctx.strokeStyle = "rgba(60,224,255," + pulseN + ")";
          ctx.lineWidth = 2;
        }
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
      } else if (a.type === "aiDraw") {
        /* CPU 摸牌：牌背从牌山飞到 CPU 手牌区，带弹入缩放。
           CPU 的牌始终是背面朝上（不能泄露手牌）。 */
        var sc = (prog < 0.25) ? 0.55 + 0.45 * easeOut(prog / 0.25) : 1;
        ctx.globalAlpha = 1;
        ctx.save();
        ctx.translate(x + TB_W / 2, y + TB_H / 2);
        ctx.scale(sc, sc);
        ctx.translate(-(x + TB_W / 2), -(y + TB_H / 2));
        drawTileBack(ctx, x, y, TB_W, TB_H);
        ctx.restore();
      } else if (a.type === "aiDiscard") {
        /* CPU 打牌：牌面从 CPU 手牌区滑进牌河，落位时轻微旋转 */
        var alphaD = prog > 0.75 ? 1 - (prog - 0.75) / 0.25 : 1;
        ctx.globalAlpha = alphaD;
        var rotD = Math.sin(prog * Math.PI) * 0.10;
        ctx.save();
        ctx.translate(x + TD_W / 2, y + TD_H / 2);
        ctx.rotate(rotD);
        ctx.translate(-(x + TD_W / 2), -(y + TD_H / 2));
        drawTileFace(ctx, Core.tileKind(animTile(a)), x, y, TD_W, TD_H);
        ctx.restore();
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
  /* 中央回合提示牌。
     原来这个提示画在 CPU_Y+28，正好压在 CPU 手牌背上（重叠 bug）；
     现在挪到牌山下方当"回合牌"，顺便填掉桌面中段的空档。 */
  function drawTurnPlate(ctx, st, t) {
    if (st.mode !== "await_discard" && st.mode !== "ai_turn") return;
    var cpu = (st.turn === 1);
    var label = cpu ? "CPU TURN" : "YOUR TURN";
    var col = cpu ? LED_RED : AMBER;
    var pulse = 0.55 + 0.45 * Math.sin(t * (cpu ? 6 : 3));

    var pw = 106, ph = 22;
    var px = Math.round(W / 2 - pw / 2);
    var py = Math.round(WALL_Y + 52);

    ctx.fillStyle = "rgba(0,0,0,0.5)";
    roundRect(ctx, px, py, pw, ph, 5);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.10)";
    ctx.lineWidth = 0.5;
    roundRect(ctx, px + 0.25, py + 0.25, pw - 0.5, ph - 0.5, 5);
    ctx.stroke();

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "bold 12px monospace";
    ctx.globalAlpha = cpu ? 1 : pulse;
    glowText(ctx, label, W / 2, py + ph / 2, col, 7);
    ctx.globalAlpha = 1;
  }

  /* ================================================================ */
  /*  一次性提示（toast）                                            */
  /* ================================================================ */
  /* 由 Core.setHint 设置。画在牌桌中段 —— 回合提示牌（WALL_Y+52）和
     自家牌河（PLAYER_DIS_Y=360）之间，那里是空的。
     这是规则性拒绝唯一的"说明"通道：core 里的 st.msg 从来没被 render 读过。 */
  function drawHint(ctx, st, t) {
    if (!st.hint || !(st.hintT > 0)) return;
    ctx.font = "bold 10px monospace";
    var tw = ctx.measureText(st.hint).width;
    var pw = Math.min(W - 16, tw + 24), ph = 20;
    var px = Math.round(W / 2 - pw / 2);
    var py = Math.round(WALL_Y + 86);

    /* 最后 300ms 淡出 */
    ctx.globalAlpha = Math.min(1, st.hintT / 300);
    ctx.fillStyle = "rgba(0,0,0,0.80)";
    roundRect(ctx, px, py, pw, ph, 6);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,77,77,0.85)";
    ctx.lineWidth = 1.5;
    roundRect(ctx, px + 0.75, py + 0.75, pw - 1.5, ph - 1.5, 6);
    ctx.stroke();

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    glowText(ctx, st.hint, W / 2, py + ph / 2, "#ffd8d8", 5);
    ctx.globalAlpha = 1;
  }

  /* ================================================================ */
  /*  菜单                                                           */
  /* ================================================================ */
  function drawMenu(ctx, st, t) {
    ctx.fillStyle = "rgba(3,7,10,0.90)";
    ctx.fillRect(0, 0, W, H);

    /* 顶部一排会缓慢换牌的牌面，当招牌 */
    for (var i = 0; i < 5; i++) {
      var mx = 24 + i * 64;
      var k = (i * 4 + Math.floor(t * 0.5)) % 34;
      drawTileFace(ctx, k, mx, 34, 52, 72);
    }

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    /* 标题：霓虹琥珀 */
    var pulse = 0.6 + 0.4 * Math.sin(t * 2);
    ctx.globalAlpha = pulse;
    ctx.font = "bold 34px monospace";
    glowText(ctx, "MAHJONG", W / 2, 156, AMBER, 16);
    ctx.globalAlpha = 1;

    /* 标题下的霓虹分隔线 */
    ctx.strokeStyle = "rgba(60,224,255,0.45)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(W / 2 - 92, 180);
    ctx.lineTo(W / 2 + 92, 180);
    ctx.stroke();

    ctx.font = "bold 12px monospace";
    glowText(ctx, "2-PLAYER ARCADE", W / 2, 198, NEON, 7);

    /* 闪烁的开始提示 */
    if (Math.sin(t * 3) > -0.3) {
      ctx.font = "bold 13px monospace";
      glowText(ctx, "TAP / ENTER TO PLAY", W / 2, 232, LED_GREEN, 9);
    }

    ctx.font = "bold 11px monospace";
    glowText(ctx, "DIFFICULTY  " + st.diff.toUpperCase(), W / 2, 258, "#ffe08a", 5);

    /* 规则列表 */
    ctx.textAlign = "left";
    ctx.font = "11px monospace";
    ctx.fillStyle = "#8fa8b8";
    var lines = [
      "· Don-Den: " + Core.DON_DEN_COUNT + " tile exchanges at start",
      "· Riichi: declare tenpai for bonus",
      "· Need at least 1 yaku to win!",
      "· Yaku: Tanyao / Yakuhai / Riichi / ...",
      "· Space=Chi  Alt=Peng  Ctrl=Gang",
      "· Z=Hu  Click tiles to play"
    ];
    for (var L = 0; L < lines.length; L++) {
      ctx.fillText(lines[L], 24, 300 + L * 18);
    }

    ctx.fillStyle = "rgba(60,224,255,0.28)";
    ctx.fillRect(28, 404, W - 56, 1);
  }

  /* ================================================================ */
  /*  CPU 和牌展示                                                   */
  /* ================================================================ */
  /* 原来是"CPU 一想完就直接弹结算面板"，玩家不知道它怎么和的。
     现在先亮出 CPU 的手牌 + 和牌张 + 役种，停顿一下再进结算。 */
  function drawAiWinReveal(ctx, st, t) {
    var w = st.winInfo;
    if (!w) return;
    var p = st.players[w.winner];

    /* 遮罩渐入 */
    ctx.fillStyle = "rgba(2,8,14,0.86)";
    ctx.fillRect(0, 0, W, H);

    /* 标题条 */
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    var pulse = 0.75 + 0.25 * Math.sin(t * 8);
    ctx.font = "bold 26px monospace";
    ctx.globalAlpha = pulse;
    glowText(ctx, "CPU WINS", W / 2, 96, LED_RED, 14);
    ctx.globalAlpha = 1;

    ctx.font = "bold 11px monospace";
    glowText(ctx, w.type === "draw" ? "TSUMO" : "RON", W / 2, 122, AMBER, 8);

    /* 亮出 CPU 手牌。
       间距按手牌张数自适应 —— 满手 14 张时用 25px 会顶出画布（曾超出到 x=355）。 */
    var hand = p.hand;
    var winTile = w.tile;
    var winIdx = hand.indexOf(winTile);
    var stride = Math.min(25, Math.floor((W - 24) / Math.max(1, hand.length)));
    var rowW = hand.length * stride - 1;
    var hx = Math.round(W / 2 - rowW / 2);
    var hy = 208;

    /* 台面 */
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    roundRect(ctx, hx - 8, hy - 10, rowW + 16, TILE_H + DEPTH + 36, 8);
    ctx.fill();
    ctx.strokeStyle = "rgba(60,224,255,0.35)";
    ctx.lineWidth = 1;
    roundRect(ctx, hx - 7.5, hy - 9.5, rowW + 15, TILE_H + DEPTH + 35, 8);
    ctx.stroke();

    for (var i = 0; i < hand.length; i++) {
      var isWin = (i === winIdx);
      var ty = isWin ? hy - 8 : hy;
      drawTileFace(ctx, Core.tileKind(hand[i]), hx + i * stride, ty, TILE_W, TILE_H);
      if (isWin) {
        var pw = 0.5 + 0.5 * Math.sin(t * 6);
        ctx.strokeStyle = "rgba(60,224,255," + pw + ")";
        ctx.lineWidth = 2.2;
        roundRect(ctx, hx + i * stride - 2, ty - 2,
                  TILE_W + DEPTH + 4, TILE_H + DEPTH + 4, 4);
        ctx.stroke();
      }
    }

    ctx.font = "bold 9px monospace";
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.fillText("WINNING TILE", W / 2, hy + TILE_H + DEPTH + 16);

    /* 役种列表 */
    var y = 292;
    ctx.font = "bold 11px monospace";
    glowText(ctx, w.fan + " FAN · " + w.reasons.length + " YAKU", W / 2, y, AMBER, 6);
    y += 20;
    ctx.font = "10px monospace";
    var maxLines = 6;
    for (var r = 0; r < w.reasons.length && r < maxLines; r++) {
      ctx.fillStyle = "#cfe6f5";
      ctx.fillText(w.reasons[r], W / 2, y);
      y += 14;
    }
    if (w.reasons.length > maxLines) {
      ctx.fillStyle = "#7f96a8";
      ctx.fillText("+" + (w.reasons.length - maxLines) + " more", W / 2, y);
    }
  }

  /* ================================================================ */
  /*  一局结束                                                       */
  /* ================================================================ */
  function drawRoundOver(ctx, st, t) {
    ctx.fillStyle = "rgba(2,6,9,0.94)";
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
      PLAYER_DIS_Y: PLAYER_DIS_Y,
      /* CPU 区域几何 —— 外壳补 CPU 摸牌/打牌动画时要用。
         注意：layoutInfo 必须是**纯数据**，因为 puppeteer 的 page.evaluate
         走 JSON 序列化，函数会被静默丢掉。槽位坐标用下面的常量自己算，
         或者直接调 Render.cpuHandSlotX / Render.cpuDiscardSlotPos。 */
      CPU_HAND_Y: CPU_HAND_Y,
      CPU_HAND_W: TB_W, CPU_HAND_H: TB_H,
      CPU_HAND_STRIDE: TB_W + DEPTH,
      CPU_DIS_Y: CPU_DIS_Y,
      CPU_DIS_W: TD_W, CPU_DIS_H: TD_H,
      CPU_DIS_COLS: 7,
      CPU_DIS_STRIDE: TD_W + DEPTH + 1,
      CPU_DIS_ROW_H: TD_H + DEPTH + 1,
      CPU_DIS_X0: Math.floor(W / 2 - 7 * (TD_W + DEPTH + 1) / 2)
    };
  }

  return {
    draw: draw,
    getHandTileAt: getHandTileAt,
    handDisplayOrder: handDisplayOrder,
    /* 导出给回归测试用：证明"渲染认定的摸牌"和"core 认定的摸牌"是同一张 */
    drawnRealIdxFromState: drawnRealIdxFromState,
    handDrawnIdx: handDrawnIdx,
    layoutInfo: layoutInfo,
    addAnim: addAnim,
    cpuHandSlotX: cpuHandSlotX,
    cpuDiscardSlotPos: cpuDiscardSlotPos,
    /* 导出给 verify-faces.js 出"全部 34 种牌面"对照图用 */
    drawTileFace: drawTileFace
  };
})();

if (typeof module !== "undefined") module.exports = Render;
