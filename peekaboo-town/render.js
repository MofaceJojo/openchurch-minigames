/* 躲猫猫小镇 · 像素渲染层。
   结构约定:场景内的一切都用 sp()(自动加 HUD 偏移),只有 HUD 自己用 px()。
   ——上一版就是因为小鬼直接用了 px() 漏加 HUD,导致画出来的位置和能点的位置差了一整条 HUD。 */
"use strict";

var Render = (function () {
  var HUD = 26;
  var USE_HINT = "Click the impostor";
  function setUseHint(s) { USE_HINT = s; }
  function canvasSize(C, s) { return { w: C.W * s, h: (C.H + HUD) * s }; }

  function rgb(c) { return "rgb(" + c[0] + "," + c[1] + "," + c[2] + ")"; }
  function sh(c, d) {
    return [Math.max(0, Math.min(255, c[0] + d)),
            Math.max(0, Math.min(255, c[1] + d)),
            Math.max(0, Math.min(255, c[2] + d))];
  }
  function px(ctx, s, x, y, w, h, col) {          // 画布坐标(含 HUD 区)
    ctx.fillStyle = typeof col === "string" ? col : rgb(col);
    ctx.fillRect(Math.round(x) * s, Math.round(y) * s, Math.round(w) * s, Math.round(h) * s);
  }
  function sp(ctx, s, x, y, w, h, col) {          // 场景坐标(y 自动加 HUD)
    px(ctx, s, x, HUD + y, w, h, col);
  }
  function disc(ctx, s, cx, cy, r, col) {         // 场景坐标的实心圆
    for (var dy = -r; dy <= r; dy++) {
      var w = Math.floor(Math.sqrt(r * r - dy * dy));
      sp(ctx, s, cx - w, cy + dy, w * 2 + 1, 1, col);
    }
  }
  function text(ctx, str, x, y, size, color, align, bold) {
    ctx.fillStyle = color;
    ctx.font = (bold ? "bold " : "") + size + 'px "Trebuchet MS", Verdana, sans-serif';
    ctx.textAlign = align || "center"; ctx.textBaseline = "middle";
    ctx.fillText(str, x, y);
  }
  function rr(ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  var WALLS = [[247,183,178],[250,214,150],[178,224,196],[176,212,242],[240,226,168],[212,192,238],[245,201,168]];
  var ROOFS = [[214,106,102],[206,140,68],[86,166,126],[92,146,200],[196,160,60],[150,116,196],[204,124,84]];

  /* ---------------- 天空 ---------------- */
  function drawSky(ctx, C, sc, s, t, topCol, midCol, botCol) {
    var g = ctx.createLinearGradient(0, HUD * s, 0, (HUD + C.H) * s);
    g.addColorStop(0, topCol); g.addColorStop(0.55, midCol); g.addColorStop(1, botCol);
    ctx.fillStyle = g; ctx.fillRect(0, HUD * s, C.W * s, C.H * s);

    var sun = sc.sun, i;
    ctx.save();
    ctx.translate(sun.x * s, (HUD + sun.y) * s);
    ctx.rotate(t * 0.22);
    ctx.fillStyle = "rgba(255,222,110,.5)";
    for (i = 0; i < 12; i++) { ctx.rotate(Math.PI / 6); ctx.fillRect(-1 * s, -25 * s, 2 * s, 7 * s); }
    ctx.restore();
    disc(ctx, s, sun.x, sun.y, 13, "#ffe36e");
    disc(ctx, s, sun.x - 3, sun.y - 4, 6, "#fff0a8");
    sp(ctx, s, sun.x - 5, sun.y - 2, 2, 3, "#c98b2d");
    sp(ctx, s, sun.x + 3, sun.y - 2, 2, 3, "#c98b2d");
    sp(ctx, s, sun.x - 3, sun.y + 4, 7, 2, "#c98b2d");
    sp(ctx, s, sun.x - 8, sun.y + 2, 3, 2, "rgba(255,150,150,.45)");
    sp(ctx, s, sun.x + 6, sun.y + 2, 3, 2, "rgba(255,150,150,.45)");

    for (i = 0; i < sc.clouds.length; i++) {
      var c = sc.clouds[i];
      sp(ctx, s, c.x, c.y, c.w, 7, "#ffffff");
      sp(ctx, s, c.x + 4, c.y - 4, c.w - 10, 5, "#ffffff");
      sp(ctx, s, c.x + 9, c.y - 7, c.w - 22, 4, "#ffffff");
      sp(ctx, s, c.x + 2, c.y + 7, c.w - 4, 2, "rgba(178,214,240,.65)");
    }
  }

  /* ---------------- 四种场景背景 ---------------- */
  function drawScene(ctx, C, st, s, t) {
    var sc = st.scene, i, p;
    if (sc.id === "town") {
      drawSky(ctx, C, sc, s, t, "#7fd2f5", "#b6e8ff", "#e4f6ff");
      for (i = 0; i < sc.props.length; i++) {
        p = sc.props[i];
        var wall = WALLS[p.ci], roof = ROOFS[p.ci];
        sp(ctx, s, p.x, p.y, p.w, p.h, wall);
        sp(ctx, s, p.x, p.y, 2, p.h, sh(wall, 18));
        sp(ctx, s, p.x + p.w - 2, p.y, 2, p.h, sh(wall, -20));
        sp(ctx, s, p.x - 4, p.y - 8, p.w + 8, 8, roof);
        sp(ctx, s, p.x - 3, p.y - 11, p.w + 6, 3, sh(roof, 14));
        for (var j = 0; j < p.w + 6; j += 5) sp(ctx, s, p.x - 3 + j, p.y - 8, 1, 8, sh(roof, -14));
        if (p.door) {
          var dx = p.x + Math.round(p.w / 2) - 5;
          sp(ctx, s, dx, p.y + p.h - 20, 11, 20, sh(roof, -8));
          sp(ctx, s, dx + 7, p.y + p.h - 10, 2, 2, "#ffe36e");
        }
      }
      sp(ctx, s, 0, C.H - 116, C.W, 116, [206, 198, 182]);       // 石板路
      sp(ctx, s, 0, C.H - 116, C.W, 3, [220, 214, 198]);
      for (i = 0; i < C.W; i += 16) sp(ctx, s, i, C.H - 110, 1, 110, [196, 188, 172]);
      for (i = C.H - 100; i < C.H; i += 18) sp(ctx, s, 0, i, C.W, 1, [196, 188, 172]);

    } else if (sc.id === "market") {
      drawSky(ctx, C, sc, s, t, "#8ed6f0", "#c2ecff", "#f0e6cf");
      sp(ctx, s, 0, C.H - 150, C.W, 150, [214, 198, 170]);        // 集市地面
      sp(ctx, s, 0, C.H - 150, C.W, 3, [228, 214, 188]);
      for (i = 0; i < C.W; i += 14) sp(ctx, s, i, C.H - 144, 1, 144, [202, 186, 158]);
      for (i = 0; i < sc.props.length; i++) {
        p = sc.props[i];
        if (p.kind !== "stall") continue;
        var aw = ROOFS[p.ci];
        sp(ctx, s, p.x + 2, p.y + 12, 3, 46, [150, 112, 74]);     // 支柱
        sp(ctx, s, p.x + p.w - 5, p.y + 12, 3, 46, [150, 112, 74]);
        for (var k = 0; k < p.w; k += 8) {                        // 条纹雨棚
          sp(ctx, s, p.x + k, p.y, Math.min(4, p.w - k), 12, aw);
          sp(ctx, s, p.x + k + 4, p.y, Math.min(4, Math.max(0, p.w - k - 4)), 12, "#fffaf0");
        }
        sp(ctx, s, p.x - 2, p.y - 3, p.w + 4, 4, sh(aw, 18));
        sp(ctx, s, p.x, p.y + 12, p.w, 2, sh(aw, -30));
        sp(ctx, s, p.x, p.y + 52, p.w, 6, [176, 138, 96]);        // 台面
      }

    } else if (sc.id === "garden") {
      drawSky(ctx, C, sc, s, t, "#86d4f2", "#bfeaff", "#dff5e0");
      sp(ctx, s, 0, C.H - 232, C.W, 232, [142, 208, 122]);        // 草地
      sp(ctx, s, 0, C.H - 232, C.W, 3, [166, 226, 140]);
      for (i = 0; i < C.W; i += 9) sp(ctx, s, i, C.H - 226 + (i % 3) * 11, 3, 1, [126, 194, 108]);
      for (i = 0; i < sc.props.length; i++) {
        p = sc.props[i];
        if (p.kind === "hedge") {
          sp(ctx, s, p.x, p.y, p.w, p.h, [92, 158, 92]);
          sp(ctx, s, p.x, p.y, p.w, 4, [112, 182, 106]);
          for (var m = 0; m < p.w; m += 7) sp(ctx, s, p.x + m, p.y + 3, 3, 3, [122, 192, 114]);
          sp(ctx, s, p.x, p.y + p.h - 2, p.w, 2, [72, 130, 74]);
        } else if (p.kind === "tree") {
          sp(ctx, s, p.x + p.r - 3, p.y + p.r - 4, 5, 34, [140, 96, 60]);
          disc(ctx, s, p.x + p.r, p.y, p.r, [104, 176, 100]);
          disc(ctx, s, p.x + p.r - 5, p.y - 5, Math.round(p.r * 0.5), [124, 198, 116]);
        }
      }

    } else {
      drawSky(ctx, C, sc, s, t, "#84d0f2", "#bfe9ff", "#cfeedd");
      sp(ctx, s, 0, C.H - 200, C.W, 200, [146, 206, 128]);        // 草岸
      for (i = 0; i < sc.props.length; i++) {
        p = sc.props[i];
        if (p.kind === "water") {
          sp(ctx, s, 0, p.y, C.W, C.H - p.y, [96, 172, 214]);
          sp(ctx, s, 0, p.y, C.W, 3, [140, 202, 234]);
          for (var wv = 0; wv < 8; wv++)
            sp(ctx, s, ((wv * 37 + Math.round(t * 6)) % (C.W + 30)) - 15, p.y + 12 + wv * 14,
               14, 2, "rgba(190,230,248,.5)");
        } else if (p.kind === "reed") {
          for (var rd = 0; rd < 5; rd++)
            sp(ctx, s, p.x + rd * 3, p.y - 18 + (rd % 2) * 5, 2, 20 - (rd % 2) * 4, [86, 150, 92]);
        } else if (p.kind === "dock") {
          sp(ctx, s, p.x, p.y, p.w, 10, [178, 138, 96]);
          for (var dk = 0; dk < p.w; dk += 9) sp(ctx, s, p.x + dk, p.y, 1, 10, [152, 114, 76]);
          sp(ctx, s, p.x, p.y + 10, p.w, 2, [138, 102, 68]);
        }
      }
    }
  }

  /* ---------------- 伪装物件(小鬼和无辜物件用同一套画法) ---------------- */
  var OBJ_PAL = {
    window:  { main: [188, 228, 246], dark: [120, 168, 196], extra: "#ffffff" },
    pot:     { main: [214, 126, 88],  dark: [166, 90, 60],   extra: "#5aa85e" },
    bush:    { main: [104, 176, 100], dark: [72, 134, 74],   extra: "#c8e88a" },
    crate:   { main: [198, 154, 100], dark: [154, 112, 68],  extra: "#e0bc86" },
    barrel:  { main: [176, 124, 78],  dark: [130, 88, 54],   extra: "#c8a072" },
    basket:  { main: [206, 168, 108], dark: [160, 124, 74],  extra: "#ff8f6e" },
    lantern: { main: [240, 200, 96],  dark: [180, 140, 60],  extra: "#fff3c4" },
    rock:    { main: [168, 170, 176], dark: [124, 126, 134], extra: "#c2c4ca" }
  };

  /* 画一个物件。isImp=true 时加上"不对劲"的破绽:小角 + 轻微色差;探头时露眼睛和舌头 */
  function drawObject(ctx, C, s, o, isImp, peek, camo, t) {
    var W = C.OBJ_W, H = C.OBJ_H, x = o.x, y = o.y;
    var pal = OBJ_PAL[o.type] || OBJ_PAL.crate;
    var jitter = Math.round((o.tint - 0.5) * 10);          // 同类物件的天然色差
    var off = isImp ? Math.round((1 - camo) * 20) : 0;      // 小鬼的额外色差:越后期越小
    var main = sh(pal.main, jitter - off);
    var dark = sh(pal.dark, jitter - off);
    var wig = (isImp && peek) ? Math.round(Math.sin(t * 20)) : 0;
    x += wig;

    if (o.type === "window") {
      sp(ctx, s, x, y, W, H, "#ffffff");
      sp(ctx, s, x + 2, y + 2, W - 4, H - 4, main);
      sp(ctx, s, x + 2, y + 2, 5, 6, sh(main, 26));
      sp(ctx, s, x + Math.floor(W / 2) - 1, y + 2, 2, H - 4, "#ffffff");
      sp(ctx, s, x + 2, y + Math.floor(H / 2) - 1, W - 4, 2, "#ffffff");
      sp(ctx, s, x - 1, y + H - 2, W + 2, 3, dark);
    } else if (o.type === "pot") {
      sp(ctx, s, x + 3, y, 9, 5, pal.extra);                 // 小绿植
      sp(ctx, s, x + 1, y + 2, 4, 3, pal.extra);
      sp(ctx, s, x + 10, y + 2, 4, 3, pal.extra);
      sp(ctx, s, x + 1, y + 6, W - 2, 3, sh(main, 16));      // 盆沿
      sp(ctx, s, x + 2, y + 9, W - 4, H - 10, main);
      sp(ctx, s, x + 3, y + 10, 3, H - 13, sh(main, 20));
      sp(ctx, s, x + 2, y + H - 2, W - 4, 2, dark);
    } else if (o.type === "bush") {
      disc(ctx, s, x + Math.floor(W / 2), y + Math.floor(H / 2) + 1, 7, main);
      disc(ctx, s, x + 4, y + 7, 4, main);
      disc(ctx, s, x + W - 4, y + 8, 4, main);
      sp(ctx, s, x + 4, y + 4, 3, 2, sh(main, 24));
      sp(ctx, s, x + 2, y + H - 2, W - 4, 2, dark);
    } else if (o.type === "crate") {
      sp(ctx, s, x, y + 1, W, H - 1, main);
      sp(ctx, s, x, y + 1, W, 2, sh(main, 22));
      sp(ctx, s, x, y + H - 3, W, 3, dark);
      sp(ctx, s, x, y + 1, 2, H - 1, sh(main, 14));
      sp(ctx, s, x + W - 2, y + 1, 2, H - 1, dark);
      for (var d = 0; d < W; d += 3) sp(ctx, s, x + d, y + 3 + d % 5, 2, 1, sh(main, -12));
      sp(ctx, s, x + 2, y + Math.floor(H / 2), W - 4, 2, dark);
    } else if (o.type === "barrel") {
      sp(ctx, s, x + 1, y, W - 2, H, main);
      sp(ctx, s, x, y + 3, W, H - 6, main);
      sp(ctx, s, x + 2, y + 1, 3, H - 2, sh(main, 22));
      sp(ctx, s, x, y + 3, W, 2, dark);
      sp(ctx, s, x, y + H - 6, W, 2, dark);
      sp(ctx, s, x + 1, y, W - 2, 2, sh(main, 14));
    } else if (o.type === "basket") {
      sp(ctx, s, x + 2, y + 2, W - 4, 4, pal.extra);         // 里面的果子
      sp(ctx, s, x + 5, y, 5, 3, pal.extra);
      sp(ctx, s, x, y + 5, W, H - 5, main);
      for (var b = 6; b < H; b += 3) sp(ctx, s, x, y + b, W, 1, dark);
      for (var b2 = 1; b2 < W; b2 += 4) sp(ctx, s, x + b2, y + 5, 1, H - 5, sh(main, 14));
    } else if (o.type === "lantern") {
      sp(ctx, s, x + Math.floor(W / 2) - 1, y, 2, 3, dark);   // 挂钩
      sp(ctx, s, x + 2, y + 3, W - 4, 2, dark);
      sp(ctx, s, x + 3, y + 5, W - 6, H - 8, main);
      sp(ctx, s, x + 5, y + 7, W - 10, H - 12, pal.extra);
      sp(ctx, s, x + 2, y + H - 3, W - 4, 3, dark);
    } else {                                                  // rock
      disc(ctx, s, x + Math.floor(W / 2), y + H - 6, 7, main);
      disc(ctx, s, x + 4, y + H - 8, 4, main);
      sp(ctx, s, x + 4, y + H - 12, 4, 2, sh(main, 20));
      sp(ctx, s, x + 2, y + H - 2, W - 4, 2, dark);
    }

    if (!isImp) return;

    // ---- 破绽①:两只小角(越后期越小,camo 高时只剩 1px) ----
    var hn = Math.max(1, Math.round(1 + (1 - camo) * 2.4));
    sp(ctx, s, x + 2, y - hn, 2, hn, dark);
    sp(ctx, s, x + W - 4, y - hn, 2, hn, dark);

    // ---- 破绽②:探头 —— 睁眼吐舌头,这是最可靠的识别信号 ----
    if (peek) {
      var ey = y + Math.floor(H / 2) - 2;
      sp(ctx, s, x + 2, ey, 4, 4, "#ffffff");
      sp(ctx, s, x + W - 6, ey, 4, 4, "#ffffff");
      sp(ctx, s, x + 3, ey + 1, 2, 3, "#20242e");
      sp(ctx, s, x + W - 5, ey + 1, 2, 3, "#20242e");
      sp(ctx, s, x + Math.floor(W / 2) - 2, ey + 5, 4, 2, "#ff5f7a");
      sp(ctx, s, x + Math.floor(W / 2) - 2, ey + 7, 3, 2, "#ff5f7a");
    }
  }

  /* 被点中:物件抖一下露出真身 → 打着旋儿飞上天;底下的人蹦起来欢呼 */
  function drawPopAway(ctx, C, s, d, t) {
    var p = d.freeing, i, W = C.OBJ_W, H = C.OBJ_H;
    if (p < 0.95) {
      var q = Math.max(0, (p - 0.12) / 0.83);
      var yy = d.y + 6 - q * q * 240;
      var xx = d.x + 5 + Math.sin(p * 26) * 10 * (d.spin || 1);
      var sq = p < 0.12 ? 1 + (0.12 - p) * 5 : 1;
      ctx.save();
      ctx.translate((xx + 3) * s, (HUD + yy + 4) * s);
      ctx.rotate(p * 14 * (d.spin || 1));
      ctx.scale(sq, 1 / sq);
      ctx.fillStyle = "#7b52a0";
      ctx.fillRect(-6 * s, -6 * s, 12 * s, 11 * s);
      ctx.fillRect(-6 * s, -9 * s, 3 * s, 3 * s);
      ctx.fillRect(3 * s, -9 * s, 3 * s, 3 * s);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(-4 * s, -4 * s, 3 * s, 3 * s);
      ctx.fillRect(1 * s, -4 * s, 3 * s, 3 * s);
      ctx.fillStyle = "#20242e";
      ctx.fillRect(-3 * s, -3 * s, 1 * s, 2 * s);
      ctx.fillRect(2 * s, -3 * s, 1 * s, 2 * s);
      ctx.restore();
      for (i = 0; i < 4; i++) {
        var st2 = Math.max(0, q - i * 0.1);
        if (st2 <= 0) continue;
        sp(ctx, s, xx + 5 + Math.sin(st2 * 20 + i) * 7, d.y + 6 - st2 * st2 * 240 + 10 + i * 6,
           3, 3, "rgba(255,220,90," + (1 - st2).toFixed(2) + ")");
      }
    }
    var ap = Math.min(1, Math.max(0, (p - 0.2) / 0.5));
    if (ap > 0) {
      var hop = Math.abs(Math.sin(t * 7)) * 4;
      var bx = d.x + 1, by = d.y + 4 - hop;
      sp(ctx, s, bx + 2, by, 7, 6, "#f9dcb4");
      sp(ctx, s, bx + 2, by, 7, 2, "#7a4a2c");
      sp(ctx, s, bx + 3, by + 3, 1, 1, "#3d3226");
      sp(ctx, s, bx + 7, by + 3, 1, 1, "#3d3226");
      sp(ctx, s, bx + 4, by + 5, 3, 1, "#c8624f");
      sp(ctx, s, bx + 2, by + 6, 7, 7, "#78c8f0");
      sp(ctx, s, bx + 4, by + 7, 3, 3, "#ffffff");
      sp(ctx, s, bx, by + 3, 2, 3, "#f9dcb4");
      sp(ctx, s, bx + 9, by + 3, 2, 3, "#f9dcb4");
      sp(ctx, s, bx + 2, by + 13, 3, 2, "#4a6fa5");
      sp(ctx, s, bx + 6, by + 13, 3, 2, "#4a6fa5");
      if (p > 0.42 && p < 1.7) {
        var np = (p - 0.42) / 1.28, a = (1 - np).toFixed(2);
        sp(ctx, s, bx + 11, by - 3 - np * 14, 3, 3, "rgba(90,70,160," + a + ")");
        sp(ctx, s, bx + 13, by - 6 - np * 14, 1, 4, "rgba(90,70,160," + a + ")");
      }
    }
  }

  /* ---------------- HUD / 遮罩 ---------------- */
  function drawHud(ctx, C, st, s) {
    var w = C.W * s, hh = HUD * s;
    ctx.fillStyle = "#fff6e0"; ctx.fillRect(0, 0, w, hh);
    ctx.fillStyle = "#e8cf9e"; ctx.fillRect(0, hh - 2 * s, w, 2 * s);
    var total = st.scene.imps.length;
    text(ctx, "Lv " + st.level, 10, hh / 2, hh * 0.38, "#a2703a", "left", true);
    text(ctx, "Found " + st.found + " / " + total, w / 2, hh * 0.36, hh * 0.38, "#3f8f5e", "center", true);
    text(ctx, st.scene.name, w / 2, hh * 0.74, hh * 0.26, "#b09468", "center");
    var low = st.time < 10;
    text(ctx, Math.ceil(st.time) + "s", w - 10, hh * 0.36, hh * 0.38, low ? "#e0503c" : "#a2703a", "right", true);
    var allow = C.maxMisses(st.level, st.diff), left = allow - st.misses;
    for (var i = 0; i < allow; i++) {
      ctx.fillStyle = i < left ? "#f2a33c" : "#e2d6bd";
      ctx.beginPath();
      ctx.arc(w - 12 * s - i * 6 * s, hh * 0.75, 1.9 * s, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /* 提示按钮(右下角) */
  function hintBtn(C, s) {
    return { x: (C.W - 22) * s, y: (HUD + C.H - 22) * s, r: 13 * s };
  }
  function hintBtnHit(C, s, cx, cy) {
    var b = hintBtn(C, s);
    return (cx - b.x) * (cx - b.x) + (cy - b.y) * (cy - b.y) <= b.r * b.r * 1.6;
  }
  function drawHintBtn(ctx, C, st, s, t) {
    var b = hintBtn(C, s), on = st.hints > 0;
    var pulse = on ? 0.5 + 0.5 * Math.sin(t * 4) : 0;
    ctx.save();
    if (on) {
      ctx.strokeStyle = "rgba(255,206,70," + (0.25 + 0.4 * pulse) + ")";
      ctx.lineWidth = 3 * s;
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r + 4 * s, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.fillStyle = on ? "rgba(255,214,90,.96)" : "rgba(210,205,192,.85)";
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = on ? "#c98b2d" : "#a8a294"; ctx.lineWidth = 2 * s; ctx.stroke();
    text(ctx, "?", b.x, b.y - b.r * 0.12, b.r * 1.0, on ? "#6b4a08" : "#7e7a70", "center", true);
    text(ctx, String(st.hints), b.x, b.y + b.r * 0.55, b.r * 0.45, on ? "#8a6510" : "#8e8a80", "center", true);
    ctx.restore();
  }

  function overlay(ctx, C, s, title, lines, hint, shiftUp) {
    var w = C.W * s, h = (C.H + HUD) * s;
    ctx.fillStyle = "rgba(40,60,40,.44)"; ctx.fillRect(0, 0, w, h);
    var pw = Math.min(w * 0.88, 340), ph = 156 + lines.length * 26;
    var x0 = (w - pw) / 2, y0 = Math.max(10, (h - ph) / 2 - (shiftUp || 0));
    ctx.fillStyle = "#fffdf2"; rr(ctx, x0, y0, pw, ph, 16); ctx.fill();
    ctx.strokeStyle = "#e8cf9e"; ctx.lineWidth = 3; ctx.stroke();
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
    text(ctx, "Difficulty", w / 2, g.y0 - 15, 12, "#fff0c8", "center", true);
    for (var i = 0; i < C.DIFF_IDS.length; i++) {
      var id = C.DIFF_IDS[i], d = C.DIFFS[id], c = diffCell(g, i), cur = st.diff === id;
      ctx.fillStyle = cur ? "#3f8f5e" : "#fffdf2";
      rr(ctx, c.x, c.y, g.bw, g.bh, 9); ctx.fill();
      ctx.strokeStyle = cur ? "#2c6b45" : "#e0cfa4"; ctx.lineWidth = 2; ctx.stroke();
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

    if (st.hintRing) {                              // 提示圈:由大收small,指向那一片
      var hp = Math.min(1, st.hintRing.t / 2.2);
      ctx.save();
      ctx.strokeStyle = "rgba(255,190,60," + (1 - hp).toFixed(2) + ")";
      ctx.lineWidth = 3 * s;
      ctx.beginPath();
      ctx.arc(st.hintRing.x * s, (HUD + st.hintRing.y) * s, (34 - hp * 16) * s, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    if (st.flash) {
      var fp = Math.min(1, st.flash.t / 0.6);
      ctx.save();
      ctx.strokeStyle = "rgba(230,90,70," + (1 - fp).toFixed(2) + ")";
      ctx.lineWidth = 2 * s;
      ctx.beginPath();
      ctx.arc(st.flash.x * s, (HUD + st.flash.y) * s, (6 + fp * 20) * s, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1 - fp;
      text(ctx, "NOPE!", st.flash.x * s, (HUD + st.flash.y - 18 - fp * 10) * s, 6 * s, "#e0503c", "center", true);
      ctx.restore();
    }

    if (cursor && st.mode === "play") {
      ctx.save();
      var g = ctx.createRadialGradient(cursor.x * s, (HUD + cursor.y) * s, 0,
                                       cursor.x * s, (HUD + cursor.y) * s, 30 * s);
      g.addColorStop(0, "rgba(255,255,210,.26)");
      g.addColorStop(1, "rgba(255,255,210,0)");
      ctx.fillStyle = g;
      ctx.fillRect((cursor.x - 30) * s, (HUD + cursor.y - 30) * s, 60 * s, 60 * s);
      ctx.strokeStyle = "rgba(255,170,50,.9)"; ctx.lineWidth = 1.5 * s;
      ctx.beginPath(); ctx.arc(cursor.x * s, (HUD + cursor.y) * s, 11 * s, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }

    drawHud(ctx, C, st, s);
    if (st.mode === "play") drawHintBtn(ctx, C, st, s, t);

    if (st.mode === "menu") {
      overlay(ctx, C, s, "🔍 Peekaboo Town", [
        "Cheeky imps disguise themselves as",
        "pots, crates, windows — anything nearby.",
        "Look for tiny horns, or catch them peeking!",
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
        st.failWhy,
        "Found " + st.found + " of " + sc.imps.length
      ], "Tap to try level " + st.level + " again");
    }
  }

  return { HUD: HUD, canvasSize: canvasSize, draw: draw, setUseHint: setUseHint,
           diffPickerHit: diffPickerHit, hintBtnHit: hintBtnHit };
})();

if (typeof module !== "undefined") module.exports = Render;
