/* 躲猫猫小镇 · 像素渲染层。240×360 细像素,明快白天配色,动作走搞笑路线。
   小鬼有清晰的生物轮廓(角/耳/手/尾/脚 + 描边),伪装只靠颜色。 */
"use strict";

var Render = (function () {
  var HUD = 26;
  var USE_HINT = "Click an imp to pop it away";
  function setUseHint(s) { USE_HINT = s; }
  function canvasSize(C, s) { return { w: C.W * s, h: (C.H + HUD) * s }; }

  function rgb(c) { return "rgb(" + c[0] + "," + c[1] + "," + c[2] + ")"; }
  function shade(c, d) {
    return [Math.max(0, Math.min(255, c[0] + d)),
            Math.max(0, Math.min(255, c[1] + d)),
            Math.max(0, Math.min(255, c[2] + d))];
  }
  function px(ctx, s, x, y, w, h, col) {
    ctx.fillStyle = typeof col === "string" ? col : rgb(col);
    ctx.fillRect(Math.round(x) * s, Math.round(y) * s, Math.round(w) * s, Math.round(h) * s);
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
  function disc(ctx, s, cx, cy, r, col) {
    for (var dy = -r; dy <= r; dy++) {
      var w = Math.floor(Math.sqrt(r * r - dy * dy));
      px(ctx, s, cx - w, cy + dy, w * 2 + 1, 1, col);
    }
  }

  /* ---------- 明亮的白天小镇 ---------- */

  function drawSky(ctx, C, sc, s, t) {
    var g = ctx.createLinearGradient(0, HUD * s, 0, (HUD + C.H) * s);
    g.addColorStop(0, "#7fd2f5"); g.addColorStop(0.55, "#b6e8ff"); g.addColorStop(1, "#e4f6ff");
    ctx.fillStyle = g; ctx.fillRect(0, HUD * s, C.W * s, C.H * s);

    var sun = sc.sun, i;
    ctx.save();
    ctx.translate(sun.x * s, (HUD + sun.y) * s);
    ctx.rotate(t * 0.22);
    ctx.fillStyle = "rgba(255,222,110,.5)";
    for (i = 0; i < 12; i++) { ctx.rotate(Math.PI / 6); ctx.fillRect(-1 * s, -25 * s, 2 * s, 7 * s); }
    ctx.restore();
    disc(ctx, s, sun.x, HUD + sun.y, 13, "#ffe36e");
    disc(ctx, s, sun.x - 3, HUD + sun.y - 4, 6, "#fff0a8");
    px(ctx, s, sun.x - 5, HUD + sun.y - 2, 2, 3, "#c98b2d");     // 眼睛
    px(ctx, s, sun.x + 3, HUD + sun.y - 2, 2, 3, "#c98b2d");
    px(ctx, s, sun.x - 3, HUD + sun.y + 4, 7, 2, "#c98b2d");     // 微笑
    px(ctx, s, sun.x - 4, HUD + sun.y + 3, 1, 1, "#c98b2d");
    px(ctx, s, sun.x + 4, HUD + sun.y + 3, 1, 1, "#c98b2d");
    px(ctx, s, sun.x - 8, HUD + sun.y + 2, 3, 2, "rgba(255,150,150,.45)");
    px(ctx, s, sun.x + 6, HUD + sun.y + 2, 3, 2, "rgba(255,150,150,.45)");

    for (i = 0; i < sc.clouds.length; i++) {
      var c = sc.clouds[i];
      px(ctx, s, c.x, HUD + c.y, c.w, 7, "#ffffff");
      px(ctx, s, c.x + 4, HUD + c.y - 4, c.w - 10, 5, "#ffffff");
      px(ctx, s, c.x + 9, HUD + c.y - 7, c.w - 22, 4, "#ffffff");
      px(ctx, s, c.x + 2, HUD + c.y + 7, c.w - 4, 2, "rgba(178,214,240,.65)");
    }
  }

  function drawHouses(ctx, C, sc, s) {
    for (var i = 0; i < sc.houses.length; i++) {
      var h = sc.houses[i], j;
      px(ctx, s, h.x, HUD + h.y, h.w, h.h, h.wall);
      px(ctx, s, h.x, HUD + h.y, 2, h.h, shade(h.wall, 18));            // 受光面
      px(ctx, s, h.x + h.w - 2, HUD + h.y, 2, h.h, shade(h.wall, -20)); // 背光面
      if (h.bricks) for (j = 6; j < h.h; j += 8)                        // 细砖缝
        px(ctx, s, h.x + 2, HUD + h.y + j, h.w - 4, 1, shade(h.wall, -9));

      px(ctx, s, h.x - 4, HUD + h.y - 8, h.w + 8, 8, h.roof);           // 屋顶
      px(ctx, s, h.x - 3, HUD + h.y - 11, h.w + 6, 3, shade(h.roof, 14));
      for (j = 0; j < h.w + 6; j += 5)                                  // 瓦楞
        px(ctx, s, h.x - 3 + j, HUD + h.y - 8, 1, 8, shade(h.roof, -14));
      px(ctx, s, h.x - 4, HUD + h.y - 1, h.w + 8, 1, shade(h.roof, -26));

      if (h.chimney) {
        px(ctx, s, h.x + 5, HUD + h.y - 20, 8, 12, shade(h.roof, -18));
        px(ctx, s, h.x + 4, HUD + h.y - 22, 10, 3, shade(h.roof, 20));
      }

      for (j = 0; j < h.windows.length; j++) {
        var w = h.windows[j];
        px(ctx, s, w.x - 2, HUD + w.y - 2, 13, 15, "#ffffff");          // 白窗框
        px(ctx, s, w.x, HUD + w.y, 9, 11, "#b8e4f6");                   // 玻璃
        px(ctx, s, w.x, HUD + w.y, 4, 5, "#e2f5fc");                    // 反光
        px(ctx, s, w.x + 4, HUD + w.y, 1, 11, "#ffffff");               // 窗棂
        px(ctx, s, w.x, HUD + w.y + 5, 9, 1, "#ffffff");
        px(ctx, s, w.x - 3, HUD + w.y + 13, 15, 2, shade(h.wall, -26)); // 窗台
        if (w.box) {
          px(ctx, s, w.x - 2, HUD + w.y + 15, 13, 4, "#b07a4a");
          px(ctx, s, w.x - 1, HUD + w.y + 14, 3, 2, "#ff7f96");
          px(ctx, s, w.x + 3, HUD + w.y + 13, 3, 3, "#ffd76e");
          px(ctx, s, w.x + 7, HUD + w.y + 14, 3, 2, "#ff7f96");
        }
      }
      if (h.door) {
        var dx = h.x + Math.round(h.w / 2) - 5;
        px(ctx, s, dx, HUD + h.y + h.h - 20, 11, 20, shade(h.roof, -8));
        px(ctx, s, dx + 1, HUD + h.y + h.h - 19, 9, 18, shade(h.roof, 6));
        px(ctx, s, dx + 7, HUD + h.y + h.h - 10, 2, 2, "#ffe36e");      // 门把手
        px(ctx, s, dx - 1, HUD + h.y + h.h - 22, 13, 2, shade(h.roof, -18));
      }
    }
  }

  function drawGround(ctx, C, sc, s) {
    var G = C.H - 80, i, k;
    px(ctx, s, 0, HUD + G, C.W, 80, [138, 206, 118]);
    px(ctx, s, 0, HUD + G, C.W, 3, [162, 224, 136]);
    for (i = 0; i < C.W; i += 7)                                        // 草地纹理
      px(ctx, s, i, HUD + G + 5 + (i % 3) * 9, 3, 1, [122, 192, 104]);

    for (i = 0; i < sc.trees.length; i++) {
      var tr = sc.trees[i];
      px(ctx, s, tr.x + tr.r - 3, HUD + tr.y + tr.r - 4, 5, 30, [140, 96, 60]);
      px(ctx, s, tr.x + tr.r - 3, HUD + tr.y + tr.r - 4, 2, 30, [162, 116, 74]);
      disc(ctx, s, tr.x + tr.r, HUD + tr.y, tr.r, tr.col);              // 树冠
      disc(ctx, s, tr.x + tr.r - 5, HUD + tr.y - 5, Math.round(tr.r * 0.5), shade(tr.col, 22));
      for (k = 0; k < 7; k++)                                           // 叶子高光
        px(ctx, s, tr.x + tr.r - 9 + k * 3, HUD + tr.y - tr.r + 5 + (k % 3) * 3, 2, 2, shade(tr.col, 30));
      px(ctx, s, tr.x + tr.r - 6, HUD + tr.y + tr.r - 6, 12, 2, shade(tr.col, -26));
    }
    for (i = 0; i < sc.bushes.length; i++) {
      var b = sc.bushes[i];
      px(ctx, s, b.x, HUD + b.y, b.w, 12, b.col);
      px(ctx, s, b.x + 3, HUD + b.y - 5, b.w - 6, 6, b.col);
      px(ctx, s, b.x + 6, HUD + b.y - 7, Math.max(3, b.w - 14), 3, shade(b.col, 12));
      px(ctx, s, b.x + 5, HUD + b.y - 4, 3, 2, shade(b.col, 28));
      px(ctx, s, b.x, HUD + b.y + 11, b.w, 1, shade(b.col, -28));
    }
    for (i = 0; i < sc.flowers.length; i++) {
      var f = sc.flowers[i];
      px(ctx, s, f.x, HUD + f.y + 3, 1, 3, [96, 160, 88]);
      px(ctx, s, f.x - 1, HUD + f.y + 1, 3, 2, f.c);
      px(ctx, s, f.x, HUD + f.y, 1, 1, [255, 255, 255]);
    }
  }

  /* ---------- 小鬼:轮廓清晰的小生物,只用颜色伪装 ---------- */
  function drawImp(ctx, C, st, d, s, t) {
    if (d.found) return drawPopAway(ctx, C, d, s, t);

    var camo = C.camoStrength(st.level, st.diff);
    var delta = (1 - camo) * 26;                 // 和环境的色差:越后期越小
    var body = [
      Math.max(0, Math.min(255, Math.round(d.host[0] - delta * 0.8))),
      Math.max(0, Math.min(255, Math.round(d.host[1] - delta * 1.1))),
      Math.max(0, Math.min(255, Math.round(d.host[2] - delta * 0.45)))
    ];
    // 描边只用来勾出"这是个生物"的轮廓,深浅同样随伪装强度收敛,
    // 否则一圈深色边框比色差本身还显眼
    var line = shade(body, -(5 + (1 - camo) * 12));
    var peek = C.isPeeking(st, d);
    var x = d.x + (peek ? Math.round(Math.sin(t * 20)) : 0), y = d.y;

    // 角
    px(ctx, s, x + 2, y, 2, 3, line);
    px(ctx, s, x + 9, y, 2, 3, line);
    px(ctx, s, x + 2, y + 1, 2, 2, body);
    px(ctx, s, x + 9, y + 1, 2, 2, body);
    // 头 + 身体(带描边)
    px(ctx, s, x + 1, y + 3, 11, 9, line);
    px(ctx, s, x + 2, y + 4, 9, 7, body);
    px(ctx, s, x + 2, y + 12, 9, 2, line);
    px(ctx, s, x + 3, y + 12, 7, 1, body);
    // 耳朵
    px(ctx, s, x, y + 5, 1, 3, line);
    px(ctx, s, x + 12, y + 5, 1, 3, line);
    // 手
    px(ctx, s, x, y + 9, 2, 2, line);
    px(ctx, s, x + 11, y + 9, 2, 2, line);
    // 脚
    px(ctx, s, x + 2, y + 14, 3, 1, line);
    px(ctx, s, x + 8, y + 14, 3, 1, line);
    // 尾巴
    px(ctx, s, x + 12, y + 11, 2, 1, line);
    px(ctx, s, x + 13, y + 9, 1, 2, line);

    if (peek) {                                  // 破绽:瞪大白眼 + 吐舌头
      px(ctx, s, x + 2, y + 5, 4, 4, "#ffffff");
      px(ctx, s, x + 7, y + 5, 4, 4, "#ffffff");
      px(ctx, s, x + 3, y + 6, 2, 3, "#20242e");
      px(ctx, s, x + 8, y + 6, 2, 3, "#20242e");
      px(ctx, s, x + 3, y + 6, 1, 1, "#ffffff");
      px(ctx, s, x + 8, y + 6, 1, 1, "#ffffff");
      px(ctx, s, x + 5, y + 10, 4, 2, "#ff5f7a");
      px(ctx, s, x + 5, y + 12, 3, 2, "#ff5f7a");
    } else {                                     // 平时:两道眯着的缝
      px(ctx, s, x + 3, y + 7, 3, 1, line);
      px(ctx, s, x + 8, y + 7, 3, 1, line);
      px(ctx, s, x + 5, y + 9, 4, 1, line);
    }
  }

  function drawPopAway(ctx, C, d, s, t) {
    var p = d.freeing, i;
    if (p < 0.95) {
      var q = Math.max(0, (p - 0.1) / 0.85);
      var yy = d.y + 6 - q * q * 230;
      var xx = d.x + 5 + Math.sin(p * 26) * 9 * (d.spin || 1);
      var sq = p < 0.1 ? 1 + (0.1 - p) * 6 : 1;
      ctx.save();
      ctx.translate((xx + 3) * s, (HUD + yy + 3) * s);
      ctx.rotate(p * 15 * (d.spin || 1));
      ctx.scale(sq, 1 / sq);
      ctx.fillStyle = "#7b52a0";
      ctx.fillRect(-6 * s, -5 * s, 12 * s, 10 * s);
      ctx.fillRect(-6 * s, -8 * s, 3 * s, 3 * s);
      ctx.fillRect(3 * s, -8 * s, 3 * s, 3 * s);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(-4 * s, -3 * s, 3 * s, 3 * s);
      ctx.fillRect(1 * s, -3 * s, 3 * s, 3 * s);
      ctx.fillStyle = "#20242e";
      ctx.fillRect(-3 * s, -2 * s, 1 * s, 2 * s);
      ctx.fillRect(2 * s, -2 * s, 1 * s, 2 * s);
      ctx.restore();
      for (i = 0; i < 4; i++) {
        var sp = Math.max(0, q - i * 0.1);
        if (sp <= 0) continue;
        px(ctx, s, xx + 5 + Math.sin(sp * 20 + i) * 7, d.y + 6 - sp * sp * 230 + 9 + i * 6,
           3, 3, "rgba(255,220,90," + (1 - sp).toFixed(2) + ")");
      }
    }
    var ap = Math.min(1, Math.max(0, (p - 0.18) / 0.5));
    if (ap > 0) {
      var hop = Math.abs(Math.sin(t * 7)) * 4;
      var bx = d.x + 1, by = d.y + 4 - hop;
      px(ctx, s, bx + 2, by, 7, 6, "#f9dcb4");                    // 头
      px(ctx, s, bx + 2, by, 7, 2, "#7a4a2c");                    // 头发
      px(ctx, s, bx + 3, by + 3, 1, 1, "#3d3226");
      px(ctx, s, bx + 7, by + 3, 1, 1, "#3d3226");
      px(ctx, s, bx + 4, by + 5, 3, 1, "#c8624f");                // 笑
      px(ctx, s, bx + 2, by + 6, 7, 7, "#78c8f0");                // 身体
      px(ctx, s, bx + 4, by + 7, 3, 3, "#ffffff");
      px(ctx, s, bx, by + 3, 2, 3, "#f9dcb4");                    // 举手
      px(ctx, s, bx + 9, by + 3, 2, 3, "#f9dcb4");
      px(ctx, s, bx + 2, by + 13, 3, 2, "#4a6fa5");
      px(ctx, s, bx + 6, by + 13, 3, 2, "#4a6fa5");
      if (p > 0.4 && p < 1.7) {
        var np = (p - 0.4) / 1.3;
        var a = (1 - np).toFixed(2);
        px(ctx, s, bx + 11, by - 3 - np * 14, 3, 3, "rgba(90,70,160," + a + ")");
        px(ctx, s, bx + 13, by - 6 - np * 14, 1, 4, "rgba(90,70,160," + a + ")");
      }
    }
  }

  /* ---------- HUD / 遮罩 ---------- */
  function drawHud(ctx, C, st, s) {
    var w = C.W * s, hh = HUD * s;
    ctx.fillStyle = "#fff6e0"; ctx.fillRect(0, 0, w, hh);
    ctx.fillStyle = "#e8cf9e"; ctx.fillRect(0, hh - 2 * s, w, 2 * s);
    var total = st.scene.imps.length;
    text(ctx, "Lv " + st.level, 10, hh / 2, hh * 0.4, "#a2703a", "left", true);
    text(ctx, "Freed " + st.found + " / " + total, w / 2, hh / 2, hh * 0.4, "#3f8f5e", "center", true);
    var low = st.time < 10;
    text(ctx, Math.ceil(st.time) + "s", w - 10, hh / 2, hh * 0.4, low ? "#e0503c" : "#a2703a", "right", true);
    var allow = C.maxMisses(st.level, st.diff), left = allow - st.misses;
    for (var i = 0; i < allow; i++) {
      ctx.fillStyle = i < left ? "#f2a33c" : "#e2d6bd";
      ctx.beginPath();
      ctx.arc(w - 46 * s - i * 7 * s, hh / 2, 2.2 * s, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function overlay(ctx, C, s, title, lines, hint, shiftUp) {
    var w = C.W * s, h = (C.H + HUD) * s;
    ctx.fillStyle = "rgba(40,60,40,.42)"; ctx.fillRect(0, 0, w, h);
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

  function draw(ctx, C, st, s, t, cursor) {
    var sc = st.scene, i;
    drawSky(ctx, C, sc, s, t);
    drawHouses(ctx, C, sc, s);
    drawGround(ctx, C, sc, s);
    for (i = 0; i < sc.imps.length; i++) drawImp(ctx, C, st, sc.imps[i], s, t);

    if (st.flash) {
      var fp = Math.min(1, st.flash.t / 0.6);
      ctx.save();
      ctx.strokeStyle = "rgba(230,90,70," + (1 - fp).toFixed(2) + ")";
      ctx.lineWidth = 2 * s;
      ctx.beginPath();
      ctx.arc(st.flash.x * s, (HUD + st.flash.y) * s, (6 + fp * 20) * s, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1 - fp;
      text(ctx, "NOPE!", st.flash.x * s, (HUD + st.flash.y - 18 - fp * 10) * s,
           6 * s, "#e0503c", "center", true);
      ctx.restore();
    }

    if (cursor && st.mode === "play") {
      ctx.save();
      var g = ctx.createRadialGradient(cursor.x * s, (HUD + cursor.y) * s, 0,
                                       cursor.x * s, (HUD + cursor.y) * s, 34 * s);
      g.addColorStop(0, "rgba(255,255,210,.3)");
      g.addColorStop(1, "rgba(255,255,210,0)");
      ctx.fillStyle = g;
      ctx.fillRect((cursor.x - 34) * s, (HUD + cursor.y - 34) * s, 68 * s, 68 * s);
      ctx.strokeStyle = "rgba(255,170,50,.9)"; ctx.lineWidth = 1.5 * s;
      ctx.beginPath(); ctx.arc(cursor.x * s, (HUD + cursor.y) * s, 12 * s, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }

    drawHud(ctx, C, st, s);

    if (st.mode === "menu") {
      overlay(ctx, C, s, "🔍 Peekaboo Town", [
        "Cheeky imps are hiding in town,",
        "painted the colour of whatever they sit on.",
        "They peek — big eyes, tongue out. That's your cue!",
        USE_HINT + "."
      ], "Tap to play · Level " + st.level, 84);
      drawDiffPicker(ctx, C, st, s);
    } else if (st.mode === "intro") {
      var n = st.scene.imps.length;
      overlay(ctx, C, s, "Level " + st.level, [
        n + (n === 1 ? " imp is hiding" : " imps are hiding"),
        Math.round(st.time) + " seconds on the clock",
        C.maxMisses(st.level, st.diff) + " wrong pokes allowed"
      ], "Tap to start");
    } else if (st.mode === "cleared") {
      overlay(ctx, C, s, "Town's all smiles!", [
        "Level " + st.level + " · " + st.found + " set free",
        Math.round(st.time) + "s to spare"
      ], st.level >= C.MAX_LEVEL ? "You cleared every level! Tap to replay"
                                 : "Tap for level " + (st.level + 1));
    } else if (st.mode === "failed") {
      overlay(ctx, C, s, "Whoopsie!", [
        st.failWhy,
        "Freed " + st.found + " of " + st.scene.imps.length
      ], "Tap to try level " + st.level + " again");
    }
  }

  return { HUD: HUD, canvasSize: canvasSize, draw: draw,
           setUseHint: setUseHint, diffPickerHit: diffPickerHit };
})();

if (typeof module !== "undefined") module.exports = Render;
