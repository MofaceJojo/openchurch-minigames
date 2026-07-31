/* 躲猫猫小镇 · 渲染层(明亮的日常室内 + 有光影层次的画法,不再是方块像素)
   结构约定:场景内的一切坐标都经过 Y() 换算(自动加 HUD),避免上一版
   「小鬼漏加 HUD,画出来的位置和能点的位置差一整条」那类 bug。 */
"use strict";

var Render = (function () {
  var HUD = 26;
  var USE_HINT = "Click the impostor";
  function setUseHint(s) { USE_HINT = s; }
  function canvasSize(C, s) { return { w: C.W * s, h: (C.H + HUD) * s }; }

  function Y(y) { return HUD + y; }                       // 场景 y → 画布 y

  function rgb(c) { return "rgb(" + c[0] + "," + c[1] + "," + c[2] + ")"; }
  function sh(c, d) {
    return [Math.max(0, Math.min(255, Math.round(c[0] + d))),
            Math.max(0, Math.min(255, Math.round(c[1] + d))),
            Math.max(0, Math.min(255, Math.round(c[2] + d)))];
  }
  function box(ctx, s, x, y, w, h, col) {                 // 场景矩形
    ctx.fillStyle = typeof col === "string" ? col : rgb(col);
    ctx.fillRect(x * s, Y(y) * s, w * s, h * s);
  }
  function rnd(ctx, s, x, y, w, h, r, col) {              // 场景圆角矩形
    var X = x * s, Yy = Y(y) * s, W = w * s, H = h * s, R = Math.min(r * s, W / 2, H / 2);
    ctx.beginPath();
    ctx.moveTo(X + R, Yy);
    ctx.arcTo(X + W, Yy, X + W, Yy + H, R); ctx.arcTo(X + W, Yy + H, X, Yy + H, R);
    ctx.arcTo(X, Yy + H, X, Yy, R); ctx.arcTo(X, Yy, X + W, Yy, R);
    ctx.closePath();
    ctx.fillStyle = typeof col === "string" ? col : rgb(col); ctx.fill();
  }
  function ell(ctx, s, cx, cy, rx, ry, col) {
    ctx.beginPath(); ctx.ellipse(cx * s, Y(cy) * s, rx * s, ry * s, 0, 0, Math.PI * 2);
    ctx.fillStyle = typeof col === "string" ? col : rgb(col); ctx.fill();
  }
  function vgrad(ctx, s, x, y, w, h, top, bot) {          // 竖向渐变,用来做圆柱体的受光
    var g = ctx.createLinearGradient(x * s, 0, (x + w) * s, 0);
    g.addColorStop(0, rgb(sh(top, -14))); g.addColorStop(0.34, rgb(sh(top, 16)));
    g.addColorStop(0.68, rgb(top)); g.addColorStop(1, rgb(bot));
    ctx.fillStyle = g; ctx.fillRect(x * s, Y(y) * s, w * s, h * s);
  }
  function shadow(ctx, s, x, y, w) {                      // 物件底部的柔和落影
    var g = ctx.createRadialGradient((x + w / 2) * s, Y(y) * s, 0, (x + w / 2) * s, Y(y) * s, w * 0.62 * s);
    g.addColorStop(0, "rgba(70,55,40,.26)"); g.addColorStop(1, "rgba(70,55,40,0)");
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse((x + w / 2) * s, Y(y) * s, w * 0.62 * s, w * 0.2 * s, 0, 0, Math.PI * 2); ctx.fill();
  }
  function text(ctx, str, x, y, size, color, align, bold) {
    ctx.fillStyle = color;
    ctx.font = (bold ? "600 " : "") + size + 'px -apple-system, "Segoe UI", "Helvetica Neue", sans-serif';
    ctx.textAlign = align || "center"; ctx.textBaseline = "middle";
    ctx.fillText(str, x, y);
  }
  function panel(ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  /* ---------------- 场景背景:明亮的日常室内 ---------------- */
  function drawWindow(ctx, C, sc, s, t) {
    var w = sc.window; if (!w) return;
    box(ctx, s, w.x - 3, w.y - 3, w.w + 6, w.h + 6, [252, 250, 244]);   // 窗框
    var g = ctx.createLinearGradient(0, Y(w.y) * s, 0, Y(w.y + w.h) * s);
    g.addColorStop(0, "#a8dcf6"); g.addColorStop(1, "#dff2fb");
    ctx.fillStyle = g; ctx.fillRect(w.x * s, Y(w.y) * s, w.w * s, w.h * s);
    for (var i = 0; i < sc.clouds.length; i++) {                        // 窗外的云
      var c = sc.clouds[i];
      var cx = w.x + 6 + (c.x % (w.w - 16)), cy = w.y + 8 + (c.y % (w.h - 20));
      ell(ctx, s, cx, cy, c.w * 0.4, c.w * 0.17, "rgba(255,255,255,.92)");
      ell(ctx, s, cx + c.w * 0.2, cy - c.w * 0.09, c.w * 0.26, c.w * 0.14, "rgba(255,255,255,.92)");
    }
    box(ctx, s, w.x + w.w / 2 - 1.5, w.y, 3, w.h, [252, 250, 244]);      // 窗棂
    box(ctx, s, w.x, w.y + w.h / 2 - 1.5, w.w, 3, [252, 250, 244]);
    var sg = ctx.createLinearGradient(w.x * s, Y(w.y) * s, (w.x + w.w * 1.6) * s, Y(w.y + w.h * 2.2) * s);
    sg.addColorStop(0, "rgba(255,246,200,.34)"); sg.addColorStop(1, "rgba(255,246,200,0)");
    ctx.fillStyle = sg;                                                 // 洒进来的阳光
    ctx.fillRect(w.x * s, Y(w.y) * s, w.w * 1.8 * s, w.h * 2.4 * s);
    box(ctx, s, w.x - 5, w.y + w.h + 3, w.w + 10, 4, [238, 232, 220]);   // 窗台
  }

  function shelfBoard(ctx, s, x, y, w) {
    box(ctx, s, x, y, w, 5, [196, 158, 112]);
    box(ctx, s, x, y, w, 2, [216, 180, 134]);
    box(ctx, s, x, y + 5, w, 3, [150, 116, 78]);
    ctx.fillStyle = "rgba(90,70,50,.10)";
    ctx.fillRect(x * s, Y(y + 8) * s, w * s, 9 * s);
  }

  function drawScene(ctx, C, st, s, t) {
    var sc = st.scene, i, W = C.W, H = C.H;

    if (sc.id === "kitchen") {
      box(ctx, s, 0, 0, W, H, [246, 238, 224]);
      for (i = 0; i < W; i += 20) for (var j = 0; j < 130; j += 20) {    // 瓷砖墙
        box(ctx, s, i + 1, j + 1, 18, 18, [238, 246, 244]);
        box(ctx, s, i + 1, j + 1, 18, 5, [246, 252, 250]);
      }
      box(ctx, s, 0, 128, W, 4, [214, 222, 220]);
      drawWindow(ctx, C, sc, s, t);
      box(ctx, s, 0, sc.counter.y, W, H - sc.counter.y, [186, 146, 102]); // 木台面
      box(ctx, s, 0, sc.counter.y, W, 5, [212, 174, 128]);
      for (i = 0; i < W; i += 7) box(ctx, s, i, sc.counter.y + 6, 2, H, [176, 136, 94]);
      for (i = 0; i < sc.shelves.length; i++) shelfBoard(ctx, s, sc.shelves[i].x, sc.shelves[i].y, sc.shelves[i].w);

    } else if (sc.id === "living") {
      box(ctx, s, 0, 0, W, H, [244, 234, 222]);
      for (i = 0; i < W; i += 26) box(ctx, s, i, 0, 1, 300, [236, 224, 210]); // 淡竖条壁纸
      drawWindow(ctx, C, sc, s, t);
      for (i = 0; i < sc.shelves.length; i++) shelfBoard(ctx, s, sc.shelves[i].x, sc.shelves[i].y, sc.shelves[i].w);
      box(ctx, s, sc.lamp.x - 2, sc.lamp.y + 16, 4, 46, [150, 130, 108]);      // 落地灯
      ctx.beginPath();
      ctx.moveTo((sc.lamp.x - 14) * s, Y(sc.lamp.y + 16) * s);
      ctx.lineTo((sc.lamp.x + 14) * s, Y(sc.lamp.y + 16) * s);
      ctx.lineTo((sc.lamp.x + 9) * s, Y(sc.lamp.y - 2) * s);
      ctx.lineTo((sc.lamp.x - 9) * s, Y(sc.lamp.y - 2) * s);
      ctx.closePath(); ctx.fillStyle = "#f3d79a"; ctx.fill();
      rnd(ctx, s, sc.sofa.x, sc.sofa.y, sc.sofa.w, sc.sofa.h, 9, [176, 152, 190]); // 沙发
      rnd(ctx, s, sc.sofa.x + 4, sc.sofa.y + 4, sc.sofa.w - 8, 22, 7, [196, 174, 208]);
      rnd(ctx, s, sc.sofa.x + 6, sc.sofa.y + 28, 44, 20, 6, [206, 186, 216]);
      rnd(ctx, s, sc.sofa.x + 58, sc.sofa.y + 28, 44, 20, 6, [206, 186, 216]);
      box(ctx, s, 0, sc.rug.y, W, H - sc.rug.y, [214, 178, 156]);              // 地毯
      for (i = 0; i < W; i += 16) box(ctx, s, i, sc.rug.y + 5, 8, 2, [226, 196, 176]);

    } else if (sc.id === "shed") {
      box(ctx, s, 0, 0, W, H, [226, 210, 186]);
      for (i = 0; i < H; i += 17) box(ctx, s, 0, i, W, 2, [212, 194, 168]);   // 木板墙
      drawWindow(ctx, C, sc, s, t);
      box(ctx, s, sc.pegboard.x, sc.pegboard.y, sc.pegboard.w, sc.pegboard.h, [206, 176, 132]);
      for (i = 6; i < sc.pegboard.w; i += 10)                                  // 洞洞板
        for (var k = 6; k < sc.pegboard.h; k += 10)
          ell(ctx, s, sc.pegboard.x + i, sc.pegboard.y + k, 1.2, 1.2, "rgba(120,94,60,.5)");
      box(ctx, s, sc.pegboard.x + 22, sc.pegboard.y + 12, 3, 30, [138, 142, 150]);  // 挂着的工具
      ell(ctx, s, sc.pegboard.x + 23, sc.pegboard.y + 46, 8, 5, [138, 142, 150]);
      box(ctx, s, sc.pegboard.x + 74, sc.pegboard.y + 10, 4, 36, [150, 110, 70]);
      box(ctx, s, sc.pegboard.x + 66, sc.pegboard.y + 44, 20, 7, [138, 142, 150]);
      for (i = 0; i < sc.shelves.length; i++) shelfBoard(ctx, s, sc.shelves[i].x, sc.shelves[i].y, sc.shelves[i].w);
      box(ctx, s, 0, sc.bench.y, W, H - sc.bench.y, [176, 140, 96]);           // 工作台
      box(ctx, s, 0, sc.bench.y, W, 5, [200, 164, 118]);

    } else {
      box(ctx, s, 0, 0, W, H, [238, 232, 220]);
      drawWindow(ctx, C, sc, s, t);
      box(ctx, s, sc.pinboard.x, sc.pinboard.y, sc.pinboard.w, sc.pinboard.h, [214, 178, 126]);
      box(ctx, s, sc.pinboard.x, sc.pinboard.y, sc.pinboard.w, 4, [230, 198, 150]);
      var notes = [[10, 12, 26, 22, "#fdf3a8"], [46, 8, 24, 30, "#c8e8f8"], [80, 16, 30, 20, "#ffd9d0"]];
      for (i = 0; i < notes.length; i++) {                                     // 钉着的便签
        var n = notes[i];
        box(ctx, s, sc.pinboard.x + n[0], sc.pinboard.y + n[1], n[2], n[3], n[4]);
        ell(ctx, s, sc.pinboard.x + n[0] + n[2] / 2, sc.pinboard.y + n[1] + 3, 2, 2, "#e0604a");
      }
      for (i = 0; i < sc.shelves.length; i++) shelfBoard(ctx, s, sc.shelves[i].x, sc.shelves[i].y, sc.shelves[i].w);
      box(ctx, s, 0, sc.desk.y, W, H - sc.desk.y, [162, 118, 82]);             // 桌面
      box(ctx, s, 0, sc.desk.y, W, 5, [190, 146, 106]);
      for (i = 0; i < W; i += 9) box(ctx, s, i, sc.desk.y + 6, 1, H, [152, 110, 76]);
    }
  }

  /* ---------------- 日常物件(小鬼与无辜物件共用同一套画法) ---------------- */
  var PAL = {
    mug:         [[228,120,110],[236,178,96],[130,180,214],[168,198,150],[224,224,228]],
    jar:         [[196,214,206],[214,206,182],[192,204,220]],
    canister:    [[232,232,226],[210,182,150],[186,204,196]],
    teapot:      [[224,232,236],[212,164,150],[196,214,200]],
    bowl:        [[240,236,228],[196,214,222],[236,206,178]],
    book:        [[178,88,80],[86,116,164],[126,150,96],[196,148,72],[142,110,158]],
    frame:       [[186,146,102],[152,158,166],[212,180,132]],
    plant:       [[206,132,96],[178,182,188],[214,196,158]],
    candle:      [[248,242,226],[236,214,222],[226,232,220]],
    pot:         [[206,124,88],[190,142,104],[178,166,150]],
    basket:      [[206,168,108],[188,150,96]],
    wateringcan: [[150,178,186],[178,178,182],[142,166,148]],
    clock:       [[236,232,224],[192,166,132],[172,186,198]]
  };
  function palOf(o) { var a = PAL[o.type] || PAL.jar; return a[Math.floor(o.tint * a.length) % a.length]; }

  /* 画一个物件。isImp 时加破绽:顶上两只小角(随关卡变小)+ 探头时露眼睛舌头 */
  function drawObject(ctx, C, s, o, isImp, peek, camo, t) {
    var W = C.OBJ_W, H = C.OBJ_H;
    var base = palOf(o);
    var off = isImp ? Math.round((1 - camo) * 16) : 0;     // 小鬼的轻微色差
    var col = sh(base, -off);
    var dark = sh(col, -34), light = sh(col, 26);
    var x = o.x + ((isImp && peek) ? Math.sin(t * 20) * 0.8 : 0), y = o.y;
    var cx = x + W / 2;

    shadow(ctx, s, x, y + H - 1, W);

    if (o.type === "mug") {
      ell(ctx, s, x + W - 3, y + H * 0.55, 4.4, 4.4, dark);            // 手柄
      ell(ctx, s, x + W - 3, y + H * 0.55, 2.4, 2.4, "rgba(255,255,255,0)");
      ctx.save(); ctx.globalCompositeOperation = "destination-out";
      ell(ctx, s, x + W - 3, y + H * 0.55, 2.3, 2.3, "#000"); ctx.restore();
      vgrad(ctx, s, x + 2, y + 5, W - 7, H - 7, col, dark);
      ell(ctx, s, cx - 1.5, y + 5, (W - 7) / 2, 2.6, light);           // 杯口
      ell(ctx, s, cx - 1.5, y + 5, (W - 9) / 2, 1.8, sh(col, -8));
      box(ctx, s, x + 3.5, y + 8, 2, H - 13, "rgba(255,255,255,.45)"); // 高光

    } else if (o.type === "jar") {
      vgrad(ctx, s, x + 2, y + 6, W - 4, H - 6, col, dark);
      rnd(ctx, s, x + 1, y + 2, W - 2, 6, 2, sh(col, -46));            // 盖子
      rnd(ctx, s, x + 1, y + 2, W - 2, 2.4, 1, sh(col, -18));
      box(ctx, s, x + 4, y + 10, 2.4, H - 16, "rgba(255,255,255,.5)");
      box(ctx, s, x + 3, y + H * 0.6, W - 6, 5, "rgba(255,255,255,.35)"); // 标签

    } else if (o.type === "canister") {
      vgrad(ctx, s, x + 2, y + 4, W - 4, H - 5, col, dark);
      rnd(ctx, s, x + 0.5, y + 1, W - 1, 5, 2, sh(col, -30));
      box(ctx, s, x + 3, y + H * 0.42, W - 6, 7, "rgba(255,255,255,.55)");
      box(ctx, s, x + 5, y + H * 0.47, W - 10, 1.6, sh(col, -50));
      box(ctx, s, x + 4, y + 8, 2, H - 14, "rgba(255,255,255,.42)");

    } else if (o.type === "teapot") {
      ell(ctx, s, x + W * 0.5, y + H * 0.62, W * 0.44, H * 0.34, col);
      ell(ctx, s, x + W * 0.38, y + H * 0.5, W * 0.24, H * 0.16, light);
      ctx.beginPath();                                                 // 壶嘴
      ctx.moveTo((x + 1) * s, Y(y + H * 0.52) * s);
      ctx.lineTo((x - 2.5) * s, Y(y + H * 0.34) * s);
      ctx.lineTo((x + 2) * s, Y(y + H * 0.38) * s);
      ctx.closePath(); ctx.fillStyle = rgb(col); ctx.fill();
      ell(ctx, s, x + W - 2.5, y + H * 0.58, 4, 4.6, dark);
      ctx.save(); ctx.globalCompositeOperation = "destination-out";
      ell(ctx, s, x + W - 2.5, y + H * 0.58, 2, 2.6, "#000"); ctx.restore();
      rnd(ctx, s, cx - 4, y + H * 0.22, 8, 4, 1.6, sh(col, -30));      // 壶盖
      ell(ctx, s, cx, y + H * 0.2, 1.8, 1.6, dark);

    } else if (o.type === "bowl") {
      ctx.beginPath();
      ctx.ellipse(cx * s, Y(y + H * 0.52) * s, (W / 2 - 1) * s, (H * 0.34) * s, 0, 0, Math.PI);
      ctx.fillStyle = rgb(col); ctx.fill();
      ell(ctx, s, cx, y + H * 0.52, W / 2 - 1, 3.4, light);
      ell(ctx, s, cx, y + H * 0.52, W / 2 - 3, 2.2, sh(col, -16));
      box(ctx, s, x + 3, y + H * 0.66, W - 6, 1.6, "rgba(255,255,255,.4)");

    } else if (o.type === "book") {
      var lean = (o.tint - 0.5) * 3;
      ctx.save();
      ctx.translate(cx * s, Y(y + H) * s); ctx.rotate(lean * 0.04); ctx.translate(-cx * s, -Y(y + H) * s);
      box(ctx, s, x + 3, y + 2, W - 8, H - 2, col);                    // 书身
      box(ctx, s, x + W - 5, y + 2, 3, H - 2, sh(col, -40));           // 书脊侧
      box(ctx, s, x + 3, y + 2, W - 8, 2.4, light);
      box(ctx, s, x + 5, y + 7, W - 12, 1.6, "rgba(255,255,255,.55)"); // 烫金线
      box(ctx, s, x + 5, y + H - 8, W - 12, 1.6, "rgba(255,255,255,.4)");
      ctx.restore();

    } else if (o.type === "frame") {
      box(ctx, s, x + 1, y + 3, W - 2, H - 6, col);
      box(ctx, s, x + 4, y + 6, W - 8, H - 12, [252, 248, 240]);
      ctx.beginPath();                                                  // 相片里的小山
      ctx.moveTo((x + 4) * s, Y(y + H - 7) * s);
      ctx.lineTo((x + W * 0.42) * s, Y(y + H * 0.42) * s);
      ctx.lineTo((x + W - 4) * s, Y(y + H - 7) * s);
      ctx.closePath(); ctx.fillStyle = "#9fc4a8"; ctx.fill();
      ell(ctx, s, x + W * 0.68, y + H * 0.34, 2.4, 2.4, "#f3d485");
      box(ctx, s, x + 1, y + 3, W - 2, 2, light);

    } else if (o.type === "plant") {
      var g = [92, 156, 96];
      ell(ctx, s, cx - 4, y + 6, 4.6, 3, g);                            // 叶子
      ell(ctx, s, cx + 4, y + 5, 4.2, 2.8, sh(g, 18));
      ell(ctx, s, cx, y + 2.5, 4, 3.2, sh(g, -12));
      box(ctx, s, cx - 0.8, y + 5, 1.6, 6, sh(g, -30));
      ctx.beginPath();                                                  // 花盆(上宽下窄)
      ctx.moveTo((x + 3) * s, Y(y + 11) * s);
      ctx.lineTo((x + W - 3) * s, Y(y + 11) * s);
      ctx.lineTo((x + W - 5) * s, Y(y + H - 1) * s);
      ctx.lineTo((x + 5) * s, Y(y + H - 1) * s);
      ctx.closePath(); ctx.fillStyle = rgb(col); ctx.fill();
      box(ctx, s, x + 2, y + 10, W - 4, 3.4, light);
      box(ctx, s, x + 5.5, y + 15, 2, H - 18, "rgba(255,255,255,.35)");

    } else if (o.type === "candle") {
      box(ctx, s, cx - 0.7, y + 1, 1.4, 3, [120, 104, 84]);             // 烛芯
      ell(ctx, s, cx, y + 0.4, 1.6, 2.6, "rgba(255,196,90,.92)");
      ell(ctx, s, cx, y + 1, 0.9, 1.4, "#fff4c8");
      vgrad(ctx, s, x + 4, y + 4, W - 8, H - 5, col, sh(col, -30));
      ell(ctx, s, cx, y + 4, (W - 8) / 2, 2, sh(col, 22));
      box(ctx, s, x + 6, y + 8, 2, H - 13, "rgba(255,255,255,.5)");

    } else if (o.type === "pot") {
      ctx.beginPath();
      ctx.moveTo((x + 2) * s, Y(y + 6) * s);
      ctx.lineTo((x + W - 2) * s, Y(y + 6) * s);
      ctx.lineTo((x + W - 5) * s, Y(y + H - 1) * s);
      ctx.lineTo((x + 5) * s, Y(y + H - 1) * s);
      ctx.closePath(); ctx.fillStyle = rgb(col); ctx.fill();
      box(ctx, s, x + 1, y + 4, W - 2, 4.4, light);
      box(ctx, s, x + 4.5, y + 10, 2.4, H - 13, "rgba(255,255,255,.34)");
      box(ctx, s, x + 3, y + H - 4, W - 6, 2, dark);

    } else if (o.type === "basket") {
      ell(ctx, s, cx, y + 6, W / 2 - 2, 3, sh(col, 20));
      box(ctx, s, x + 2, y + 6, W - 4, H - 8, col);
      for (var b = 8; b < H - 2; b += 3.4) box(ctx, s, x + 2, y + b, W - 4, 1.3, sh(col, -26));
      for (var b2 = 4; b2 < W - 3; b2 += 4.5) box(ctx, s, x + b2, y + 6, 1.3, H - 8, sh(col, 14));
      ell(ctx, s, cx, y + H - 2, W / 2 - 3, 2, dark);

    } else if (o.type === "wateringcan") {
      rnd(ctx, s, x + 2, y + 7, W - 7, H - 8, 3, col);
      box(ctx, s, x + 4, y + 10, 2.2, H - 15, "rgba(255,255,255,.45)");
      ctx.beginPath();                                                  // 长壶嘴
      ctx.moveTo((x + W - 5) * s, Y(y + 11) * s);
      ctx.lineTo((x + W) * s, Y(y + 3) * s);
      ctx.lineTo((x + W - 2) * s, Y(y + 2) * s);
      ctx.lineTo((x + W - 7) * s, Y(y + 10) * s);
      ctx.closePath(); ctx.fillStyle = rgb(sh(col, -18)); ctx.fill();
      ctx.strokeStyle = rgb(dark); ctx.lineWidth = 1.6 * s;             // 提手
      ctx.beginPath();
      ctx.arc(cx * s - 2 * s, Y(y + 6) * s, 5 * s, Math.PI, 0);
      ctx.stroke();

    } else {                                                            // clock
      ell(ctx, s, cx, y + H * 0.52, W / 2 - 1, W / 2 - 1, col);
      ell(ctx, s, cx, y + H * 0.52, W / 2 - 3.4, W / 2 - 3.4, [252, 250, 244]);
      ctx.strokeStyle = "#4a4238"; ctx.lineWidth = 1.4 * s; ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(cx * s, Y(y + H * 0.52) * s); ctx.lineTo(cx * s, Y(y + H * 0.52 - 5) * s);
      ctx.moveTo(cx * s, Y(y + H * 0.52) * s); ctx.lineTo((cx + 4) * s, Y(y + H * 0.52 + 1) * s);
      ctx.stroke();
      ell(ctx, s, cx, y + H * 0.52, 1.2, 1.2, "#4a4238");
      box(ctx, s, cx - 2, y + 0.5, 4, 3, dark);
    }

    if (!isImp) return;

    // ---- 破绽①:顶上两只小角(camo 越高越小) ----
    var hn = 1 + (1 - camo) * 3.4;
    ctx.fillStyle = rgb(sh(col, -56));
    ctx.beginPath();
    ctx.moveTo((x + 3.5) * s, Y(y + 1.5) * s);
    ctx.lineTo((x + 5.2) * s, Y(y + 1.5 - hn) * s);
    ctx.lineTo((x + 6.4) * s, Y(y + 1.5) * s);
    ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo((x + W - 6.4) * s, Y(y + 1.5) * s);
    ctx.lineTo((x + W - 5.2) * s, Y(y + 1.5 - hn) * s);
    ctx.lineTo((x + W - 3.5) * s, Y(y + 1.5) * s);
    ctx.closePath(); ctx.fill();

    // ---- 破绽②:探头 —— 睁眼吐舌,最可靠的识别信号 ----
    if (peek) {
      var ey = y + H * 0.56;
      ell(ctx, s, cx - 3.4, ey, 2.6, 2.8, "#ffffff");
      ell(ctx, s, cx + 3.4, ey, 2.6, 2.8, "#ffffff");
      ell(ctx, s, cx - 3.0, ey + 0.4, 1.3, 1.5, "#20242e");
      ell(ctx, s, cx + 3.8, ey + 0.4, 1.3, 1.5, "#20242e");
      ell(ctx, s, cx - 3.6, ey - 0.7, 0.6, 0.6, "#ffffff");
      ell(ctx, s, cx + 3.2, ey - 0.7, 0.6, 0.6, "#ffffff");
      rnd(ctx, s, cx - 1.8, ey + 3.2, 3.6, 3.4, 1.6, "#ff5f7a");
    }
  }

  /* 被点中:露真身 → 打着旋儿飞上天;底下的人蹦起来欢呼 */
  function drawPopAway(ctx, C, s, d, t) {
    var p = d.freeing, i, W = C.OBJ_W, H = C.OBJ_H;
    if (p < 0.95) {
      var q = Math.max(0, (p - 0.12) / 0.83);
      var yy = d.y + 8 - q * q * 250;
      var xx = d.x + W / 2 + Math.sin(p * 26) * 12 * (d.spin || 1);
      var sq = p < 0.12 ? 1 + (0.12 - p) * 5 : 1;
      ctx.save();
      ctx.translate(xx * s, Y(yy) * s);
      ctx.rotate(p * 14 * (d.spin || 1));
      ctx.scale(sq, 1 / sq);
      ctx.fillStyle = "#8a5fb0";
      ctx.beginPath(); ctx.ellipse(0, 0, 8 * s, 7.5 * s, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-6 * s, -5 * s); ctx.lineTo(-4 * s, -11 * s); ctx.lineTo(-1.5 * s, -6 * s);
      ctx.closePath(); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(6 * s, -5 * s); ctx.lineTo(4 * s, -11 * s); ctx.lineTo(1.5 * s, -6 * s);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.beginPath(); ctx.ellipse(-3 * s, -1 * s, 2.6 * s, 3 * s, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(3 * s, -1 * s, 2.6 * s, 3 * s, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#20242e";
      ctx.beginPath(); ctx.ellipse(-2.6 * s, -0.6 * s, 1.2 * s, 1.5 * s, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(3.4 * s, -0.6 * s, 1.2 * s, 1.5 * s, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      for (i = 0; i < 4; i++) {
        var sp2 = Math.max(0, q - i * 0.1);
        if (sp2 <= 0) continue;
        ell(ctx, s, d.x + W / 2 + Math.sin(sp2 * 20 + i) * 8,
            d.y + 8 - sp2 * sp2 * 250 + 12 + i * 7, 1.8, 1.8,
            "rgba(255,214,90," + (1 - sp2).toFixed(2) + ")");
      }
    }
    var ap = Math.min(1, Math.max(0, (p - 0.2) / 0.5));
    if (ap > 0) {
      var hop = Math.abs(Math.sin(t * 7)) * 4;
      var bx = d.x + W / 2, by = d.y + H * 0.4 - hop;
      ell(ctx, s, bx, by, 4.4, 4.2, "#f7d9b0");                        // 头
      ctx.save(); ctx.beginPath();
      ctx.ellipse(bx * s, Y(by - 1.2) * s, 4.4 * s, 3.4 * s, 0, Math.PI, 0);
      ctx.fillStyle = "#7a4a2c"; ctx.fill(); ctx.restore();
      ell(ctx, s, bx - 1.5, by + 0.3, 0.6, 0.7, "#3d3226");
      ell(ctx, s, bx + 1.5, by + 0.3, 0.6, 0.7, "#3d3226");
      ctx.strokeStyle = "#c8624f"; ctx.lineWidth = 1 * s; ctx.lineCap = "round";
      ctx.beginPath(); ctx.arc(bx * s, Y(by + 1.4) * s, 1.6 * s, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
      rnd(ctx, s, bx - 4, by + 4, 8, 8, 2.6, [120, 200, 240]);         // 身体
      ell(ctx, s, bx - 5.4, by + 4, 1.5, 2.2, "#f7d9b0");              // 举起的手
      ell(ctx, s, bx + 5.4, by + 4, 1.5, 2.2, "#f7d9b0");
      if (p > 0.42 && p < 1.7) {
        var np = (p - 0.42) / 1.28, a = (1 - np).toFixed(2);
        ell(ctx, s, bx + 7, by - 3 - np * 15, 1.8, 1.5, "rgba(90,70,160," + a + ")");
        box(ctx, s, bx + 8, by - 6 - np * 15, 0.9, 3.4, "rgba(90,70,160," + a + ")");
      }
    }
  }

  /* ---------------- HUD / 遮罩 ---------------- */
  function drawHud(ctx, C, st, s) {
    var w = C.W * s, hh = HUD * s;
    var g = ctx.createLinearGradient(0, 0, 0, hh);
    g.addColorStop(0, "#fffdf6"); g.addColorStop(1, "#f6ecd8");
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, hh);
    ctx.fillStyle = "rgba(190,166,126,.55)"; ctx.fillRect(0, hh - 1.5 * s, w, 1.5 * s);
    var total = st.scene.imps.length;
    text(ctx, "Lv " + st.level, 10, hh / 2, hh * 0.36, "#9c7440", "left", true);
    text(ctx, "Found " + st.found + " / " + total, w / 2, hh * 0.36, hh * 0.36, "#3f8f5e", "center", true);
    text(ctx, st.scene.name, w / 2, hh * 0.74, hh * 0.25, "#b09468", "center");
    var low = st.time < 10;
    text(ctx, Math.ceil(st.time) + "s", w - 10, hh * 0.36, hh * 0.36, low ? "#e0503c" : "#9c7440", "right", true);
    var allow = C.maxMisses(st.level, st.diff), left = allow - st.misses;
    for (var i = 0; i < allow; i++) {
      ctx.fillStyle = i < left ? "#f2a33c" : "#e0d6c2";
      ctx.beginPath(); ctx.arc(w - 12 * s - i * 6 * s, hh * 0.75, 1.9 * s, 0, Math.PI * 2); ctx.fill();
    }
  }

  function hintBtn(C, s) { return { x: (C.W - 22) * s, y: Y(C.H - 22) * s, r: 13 * s }; }
  function hintBtnHit(C, s, cx, cy) {
    var b = hintBtn(C, s);
    return (cx - b.x) * (cx - b.x) + (cy - b.y) * (cy - b.y) <= b.r * b.r * 1.6;
  }
  function drawHintBtn(ctx, C, st, s, t) {
    var b = hintBtn(C, s), on = st.hints > 0, pulse = on ? 0.5 + 0.5 * Math.sin(t * 4) : 0;
    ctx.save();
    if (on) {
      ctx.strokeStyle = "rgba(255,196,60," + (0.22 + 0.38 * pulse) + ")";
      ctx.lineWidth = 3 * s;
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r + 4 * s, 0, Math.PI * 2); ctx.stroke();
    }
    var g = ctx.createRadialGradient(b.x - b.r * 0.3, b.y - b.r * 0.35, 0, b.x, b.y, b.r);
    g.addColorStop(0, on ? "#ffe8a8" : "#e8e4da"); g.addColorStop(1, on ? "#f0b93e" : "#cdc8bc");
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = on ? "#c98b2d" : "#a8a294"; ctx.lineWidth = 2 * s; ctx.stroke();
    text(ctx, "?", b.x, b.y - b.r * 0.12, b.r * 0.95, on ? "#6b4a08" : "#7e7a70", "center", true);
    text(ctx, String(st.hints), b.x, b.y + b.r * 0.55, b.r * 0.42, on ? "#8a6510" : "#8e8a80", "center", true);
    ctx.restore();
  }

  function overlay(ctx, C, s, title, lines, hint, shiftUp) {
    var w = C.W * s, h = (C.H + HUD) * s;
    ctx.fillStyle = "rgba(38,32,24,.46)"; ctx.fillRect(0, 0, w, h);
    var pw = Math.min(w * 0.88, 340), ph = 156 + lines.length * 26;
    var x0 = (w - pw) / 2, y0 = Math.max(10, (h - ph) / 2 - (shiftUp || 0));
    ctx.save();
    ctx.shadowColor = "rgba(40,30,18,.3)"; ctx.shadowBlur = 24; ctx.shadowOffsetY = 8;
    ctx.fillStyle = "#fffdf6"; panel(ctx, x0, y0, pw, ph, 18); ctx.fill();
    ctx.restore();
    ctx.strokeStyle = "#e8d9b6"; ctx.lineWidth = 2; panel(ctx, x0, y0, pw, ph, 18); ctx.stroke();
    text(ctx, title, w / 2, y0 + 42, 25, "#c47a2c", "center", true);
    for (var i = 0; i < lines.length; i++)
      text(ctx, lines[i], w / 2, y0 + 82 + i * 26, 14, "#6b6350");
    text(ctx, hint, w / 2, y0 + ph - 28, 15, "#3f8f5e", "center", true);
  }

  function diffGeom(C, s) {
    var w = C.W * s, h = (C.H + HUD) * s;
    var bw = Math.min(104, (w - 44) / 3), bh = 48, gap = 9;
    return { bw: bw, bh: bh, gap: gap, x0: (w - (bw * 3 + gap * 2)) / 2, y0: h * 0.72 };
  }
  function diffCell(g, i) { return { x: g.x0 + i * (g.bw + g.gap), y: g.y0 }; }
  function diffPickerHit(C, s, x, y) {
    var g = diffGeom(C, s);
    for (var i = 0; i < C.DIFF_IDS.length; i++) {
      var c = diffCell(g, i);
      if (x >= c.x && x <= c.x + g.bw && y >= c.y && y <= c.y + g.bh) return C.DIFF_IDS[i];
    }
    return null;
  }
  function drawDiffPicker(ctx, C, st, s) {
    var g = diffGeom(C, s), w = C.W * s;
    text(ctx, "Difficulty", w / 2, g.y0 - 15, 12, "#ffeec4", "center", true);
    for (var i = 0; i < C.DIFF_IDS.length; i++) {
      var id = C.DIFF_IDS[i], d = C.DIFFS[id], c = diffCell(g, i), cur = st.diff === id;
      ctx.fillStyle = cur ? "#3f8f5e" : "#fffdf6";
      panel(ctx, c.x, c.y, g.bw, g.bh, 10); ctx.fill();
      ctx.strokeStyle = cur ? "#2c6b45" : "#e2d2ac"; ctx.lineWidth = 2;
      panel(ctx, c.x, c.y, g.bw, g.bh, 10); ctx.stroke();
      text(ctx, d.name, c.x + g.bw / 2, c.y + g.bh * 0.36, 15, cur ? "#ffffff" : "#8a7a58", "center", true);
      text(ctx, d.blurb, c.x + g.bw / 2, c.y + g.bh * 0.72, 9.5, cur ? "rgba(255,255,255,.85)" : "#a8987a", "center");
    }
  }

  /* ---------------- 主绘制 ---------------- */
  function draw(ctx, C, st, s, t, cursor) {
    var sc = st.scene, i;
    var camo = C.camoStrength(st.level, st.diff);
    drawScene(ctx, C, st, s, t);

    for (i = 0; i < sc.objects.length; i++)
      drawObject(ctx, C, s, sc.objects[i], false, false, camo, t);
    for (i = 0; i < sc.imps.length; i++) {
      var im = sc.imps[i];
      if (im.found) drawPopAway(ctx, C, s, im, t);
      else drawObject(ctx, C, s, im, true, C.isPeeking(st, im), camo, t);
    }

    if (st.hintRing) {
      var hp = Math.min(1, st.hintRing.t / 2.2);
      ctx.save();
      ctx.strokeStyle = "rgba(255,180,50," + (1 - hp).toFixed(2) + ")";
      ctx.lineWidth = 3 * s;
      ctx.beginPath();
      ctx.arc(st.hintRing.x * s, Y(st.hintRing.y) * s, (36 - hp * 17) * s, 0, Math.PI * 2);
      ctx.stroke(); ctx.restore();
    }

    if (st.flash) {
      var fp = Math.min(1, st.flash.t / 0.6);
      ctx.save();
      ctx.strokeStyle = "rgba(226,86,66," + (1 - fp).toFixed(2) + ")";
      ctx.lineWidth = 2 * s;
      ctx.beginPath(); ctx.arc(st.flash.x * s, Y(st.flash.y) * s, (7 + fp * 22) * s, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1 - fp;
      text(ctx, "NOPE!", st.flash.x * s, Y(st.flash.y - 20 - fp * 10) * s, 6 * s, "#e0503c", "center", true);
      ctx.restore();
    }

    if (cursor && st.mode === "play") {
      ctx.save();
      var g = ctx.createRadialGradient(cursor.x * s, Y(cursor.y) * s, 0, cursor.x * s, Y(cursor.y) * s, 30 * s);
      g.addColorStop(0, "rgba(255,252,210,.24)"); g.addColorStop(1, "rgba(255,252,210,0)");
      ctx.fillStyle = g;
      ctx.fillRect((cursor.x - 30) * s, Y(cursor.y - 30) * s, 60 * s, 60 * s);
      ctx.strokeStyle = "rgba(240,160,50,.85)"; ctx.lineWidth = 1.4 * s;
      ctx.beginPath(); ctx.arc(cursor.x * s, Y(cursor.y) * s, 12 * s, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }

    drawHud(ctx, C, st, s);
    if (st.mode === "play") drawHintBtn(ctx, C, st, s, t);

    if (st.mode === "menu") {
      overlay(ctx, C, s, "🔍 Peekaboo", [
        "Imps disguise themselves as everyday things —",
        "mugs, jars, books, little plants.",
        "Look for tiny horns, or catch one peeking!",
        USE_HINT + "."
      ], "Tap to play · Level " + st.level, 84);
      drawDiffPicker(ctx, C, st, s);
    } else if (st.mode === "intro") {
      var n = sc.imps.length;
      overlay(ctx, C, s, sc.name, [
        n + (n === 1 ? " imp is in disguise" : " imps are in disguise"),
        "among " + sc.objects.length + " ordinary things",
        Math.round(st.time) + "s · " + C.maxMisses(st.level, st.diff) + " wrong pokes · " + st.hints + " hints"
      ], "Tap to start");
    } else if (st.mode === "cleared") {
      overlay(ctx, C, s, "Every imp found!", [
        sc.name + " · Level " + st.level,
        Math.round(st.time) + "s to spare"
      ], st.level >= C.MAX_LEVEL ? "You cleared every level! Tap to replay"
                                 : "Tap for level " + (st.level + 1));
    } else if (st.mode === "failed") {
      overlay(ctx, C, s, "Whoopsie!", [
        st.failWhy, "Found " + st.found + " of " + sc.imps.length
      ], "Tap to try level " + st.level + " again");
    }
  }

  return { HUD: HUD, canvasSize: canvasSize, draw: draw, setUseHint: setUseHint,
           diffPickerHit: diffPickerHit, hintBtnHit: hintBtnHit };
})();

if (typeof module !== "undefined") module.exports = Render;
