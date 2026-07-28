/* 躲猫猫小镇 · 像素渲染层。明快白天配色,动作走搞笑路线。 */
"use strict";

var Render = (function () {
  var HUD = 18;
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

  /* ---------- 明亮的白天小镇 ---------- */

  function drawSky(ctx, C, sc, s, t) {
    var g = ctx.createLinearGradient(0, HUD * s, 0, (HUD + C.H) * s);
    g.addColorStop(0, "#8fd8f7"); g.addColorStop(0.6, "#bfeaff"); g.addColorStop(1, "#e6f7ff");
    ctx.fillStyle = g; ctx.fillRect(0, HUD * s, C.W * s, C.H * s);

    // 太阳:带一圈慢慢转的光芒
    var sun = sc.sun, i;
    ctx.save();
    ctx.translate(sun.x * s, (HUD + sun.y) * s);
    ctx.rotate(t * 0.25);
    ctx.fillStyle = "rgba(255,224,120,.55)";
    for (i = 0; i < 8; i++) {
      ctx.rotate(Math.PI / 4);
      ctx.fillRect(-1 * s, -16 * s, 2 * s, 5 * s);
    }
    ctx.restore();
    for (var dy = -8; dy <= 8; dy++) for (var dx = -8; dx <= 8; dx++)
      if (dx * dx + dy * dy <= 64) px(ctx, s, sun.x + dx, HUD + sun.y + dy, 1, 1, "#ffe36e");
    px(ctx, s, sun.x - 3, HUD + sun.y - 1, 2, 2, "#4a3728");   // 太阳的小眼睛
    px(ctx, s, sun.x + 2, HUD + sun.y - 1, 2, 2, "#4a3728");
    px(ctx, s, sun.x - 2, HUD + sun.y + 3, 5, 1, "#4a3728");   // 微笑

    for (i = 0; i < sc.clouds.length; i++) {
      var c = sc.clouds[i];
      px(ctx, s, c.x, HUD + c.y, c.w, 5, "#ffffff");
      px(ctx, s, c.x + 3, HUD + c.y - 3, c.w - 8, 4, "#ffffff");
      px(ctx, s, c.x + 6, HUD + c.y - 5, c.w - 16, 3, "#ffffff");
      px(ctx, s, c.x, HUD + c.y + 5, c.w, 1, "rgba(180,215,240,.6)");
    }
  }

  function drawHouses(ctx, C, sc, s) {
    for (var i = 0; i < sc.houses.length; i++) {
      var h = sc.houses[i];
      px(ctx, s, h.x, HUD + h.y, h.w, h.h, h.wall);
      px(ctx, s, h.x, HUD + h.y, h.w, 1, shade(h.wall, 22));
      px(ctx, s, h.x + h.w - 1, HUD + h.y, 1, h.h, shade(h.wall, -22));
      // 屋顶(带一点斜边)
      px(ctx, s, h.x - 2, HUD + h.y - 5, h.w + 4, 5, h.roof);
      px(ctx, s, h.x - 1, HUD + h.y - 7, h.w + 2, 2, shade(h.roof, 16));
      if (h.chimney) {
        px(ctx, s, h.x + 3, HUD + h.y - 12, 5, 7, shade(h.roof, -20));
        px(ctx, s, h.x + 3, HUD + h.y - 13, 5, 1, shade(h.roof, 24));
      }
      for (var j = 0; j < h.windows.length; j++) {
        var w = h.windows[j];
        px(ctx, s, w.x - 1, HUD + w.y - 1, 8, 9, "#ffffff");          // 白窗框
        px(ctx, s, w.x, HUD + w.y, 6, 7, "#bfe6f5");                  // 玻璃
        px(ctx, s, w.x, HUD + w.y, 3, 3, "#e2f4fb");                  // 反光
        px(ctx, s, w.x + 2, HUD + w.y, 1, 7, "#ffffff");
        if (w.box) {                                                  // 窗台花箱
          px(ctx, s, w.x - 1, HUD + w.y + 8, 8, 2, "#b07a4a");
          px(ctx, s, w.x, HUD + w.y + 7, 2, 1, "#ff7f96");
          px(ctx, s, w.x + 3, HUD + w.y + 7, 2, 1, "#ffd76e");
        }
      }
      if (h.door) {
        px(ctx, s, h.x + h.w / 2 - 3, HUD + h.y + h.h - 12, 6, 12, shade(h.roof, -10));
        px(ctx, s, h.x + h.w / 2 + 1, HUD + h.y + h.h - 6, 1, 1, "#ffe36e");
      }
    }
  }

  function drawGround(ctx, C, sc, s) {
    var G = C.H - 54, i;
    px(ctx, s, 0, HUD + G, C.W, 54, [138, 206, 118]);
    px(ctx, s, 0, HUD + G, C.W, 2, [158, 222, 132]);
    for (i = 0; i < sc.trees.length; i++) {
      var tr = sc.trees[i];
      px(ctx, s, tr.x + tr.r - 2, HUD + tr.y + 2, 3, 18, [140, 96, 60]);
      for (var dy = -tr.r; dy <= tr.r; dy++) for (var dx = -tr.r; dx <= tr.r; dx++)
        if (dx * dx + dy * dy <= tr.r * tr.r)
          px(ctx, s, tr.x + tr.r + dx, HUD + tr.y + dy, 1, 1, tr.col);
      for (var k = 0; k < 5; k++)
        px(ctx, s, tr.x + tr.r - 5 + k * 2, HUD + tr.y - tr.r + 2 + (k % 2), 2, 2, shade(tr.col, 26));
    }
    for (i = 0; i < sc.bushes.length; i++) {
      var b = sc.bushes[i];
      px(ctx, s, b.x, HUD + b.y, b.w, 8, b.col);
      px(ctx, s, b.x + 2, HUD + b.y - 3, b.w - 4, 4, b.col);
      px(ctx, s, b.x + 3, HUD + b.y - 4, 3, 2, shade(b.col, 24));
    }
    for (i = 0; i < sc.flowers.length; i++) {
      var f = sc.flowers[i];
      px(ctx, s, f.x, HUD + f.y, 2, 2, f.c);
      px(ctx, s, f.x, HUD + f.y + 2, 1, 2, [96, 160, 88]);
    }
  }

  /* ---------- 小鬼:穿环境色躲着,探头时瞪眼吐舌头 ---------- */
  function drawImp(ctx, C, st, d, s, t) {
    if (d.found) return drawPopAway(ctx, C, d, s, t);

    var camo = C.camoStrength(st.level, st.diff);
    var delta = (1 - camo) * 44;
    var body = [
      Math.max(0, Math.min(255, Math.round(d.host[0] - delta * 0.85))),
      Math.max(0, Math.min(255, Math.round(d.host[1] - delta * 1.15))),
      Math.max(0, Math.min(255, Math.round(d.host[2] - delta * 0.5)))
    ];
    var peek = C.isPeeking(st, d);
    var wig = peek ? Math.round(Math.sin(t * 22) * 1) : 0;   // 探头时抖两下

    px(ctx, s, d.x + 1 + wig, d.y + 3, 7, 6, body);          // 身体
    px(ctx, s, d.x + wig, d.y + 5, 1, 3, body);
    px(ctx, s, d.x + 8 + wig, d.y + 5, 1, 3, body);
    px(ctx, s, d.x + 1 + wig, d.y + 1, 2, 2, body);          // 角
    px(ctx, s, d.x + 6 + wig, d.y + 1, 2, 2, body);
    px(ctx, s, d.x + 2 + wig, d.y + 9, 2, 1, shade(body, -22));
    px(ctx, s, d.x + 5 + wig, d.y + 9, 2, 1, shade(body, -22));

    if (peek) {                                              // 破绽:大白眼 + 舌头
      px(ctx, s, d.x + 1 + wig, d.y + 4, 3, 3, "#ffffff");
      px(ctx, s, d.x + 5 + wig, d.y + 4, 3, 3, "#ffffff");
      px(ctx, s, d.x + 2 + wig, d.y + 5, 2, 2, "#20242e");
      px(ctx, s, d.x + 6 + wig, d.y + 5, 2, 2, "#20242e");
      px(ctx, s, d.x + 3 + wig, d.y + 8, 3, 2, "#ff5f7a");   // 吐舌头
      px(ctx, s, d.x + 3 + wig, d.y + 10, 2, 1, "#ff5f7a");
    } else {
      px(ctx, s, d.x + 2, d.y + 5, 2, 1, shade(body, -14));  // 平时只是两道缝
      px(ctx, s, d.x + 5, d.y + 5, 2, 1, shade(body, -14));
    }
  }

  /* 被点中:原地一挤 → 打着旋儿飞上天 → 冒星星,底下的人蹦起来欢呼 */
  function drawPopAway(ctx, C, d, s, t) {
    var p = d.freeing, i;

    if (p < 0.9) {
      var q = Math.max(0, (p - 0.1) / 0.8);
      var yy = d.y + 4 - q * q * 150;                       // 越飞越快
      var xx = d.x + 3 + Math.sin(p * 26) * 6 * (d.spin || 1);
      var sq = p < 0.1 ? 1 + (0.1 - p) * 6 : 1;             // 起飞前先挤扁
      ctx.save();
      ctx.translate((xx + 2) * s, (HUD + yy + 2) * s);
      ctx.rotate(p * 15 * (d.spin || 1));
      ctx.scale(sq, 1 / sq);
      ctx.fillStyle = "#6b4a8a";
      ctx.fillRect(-4 * s, -3 * s, 8 * s, 6 * s);
      ctx.fillRect(-4 * s, -5 * s, 2 * s, 2 * s);
      ctx.fillRect(2 * s, -5 * s, 2 * s, 2 * s);
      ctx.fillStyle = "#ffffff";                             // 惊呆的白眼
      ctx.fillRect(-3 * s, -2 * s, 2 * s, 2 * s);
      ctx.fillRect(1 * s, -2 * s, 2 * s, 2 * s);
      ctx.restore();
      // 屁股后面的小星星
      for (i = 0; i < 3; i++) {
        var sp = Math.max(0, q - i * 0.12);
        if (sp <= 0) continue;
        px(ctx, s, xx + 3 + Math.sin(sp * 20 + i) * 5, d.y + 4 - sp * sp * 150 + 6 + i * 4,
           2, 2, "rgba(255,220,90," + (1 - sp).toFixed(2) + ")");
      }
    }

    // 获救的人:蹦起来举手,头顶一个小音符
    var ap = Math.min(1, Math.max(0, (p - 0.18) / 0.5));
    if (ap > 0) {
      var hop = Math.abs(Math.sin(t * 7)) * 3;
      var by = d.y + 4 - hop;
      px(ctx, s, d.x + 2, by, 5, 4, "#f9dcb4");                       // 头
      px(ctx, s, d.x + 3, by + 1, 1, 1, "#3d3226");
      px(ctx, s, d.x + 5, by + 1, 1, 1, "#3d3226");
      px(ctx, s, d.x + 3, by + 3, 3, 1, "#c8624f");                   // 咧嘴笑
      px(ctx, s, d.x + 2, by + 4, 5, 5, "#78c8f0");                   // 身体
      px(ctx, s, d.x + 1, by + 2, 1, 2, "#f9dcb4");                   // 举起的手
      px(ctx, s, d.x + 7, by + 2, 1, 2, "#f9dcb4");
      px(ctx, s, d.x + 2, by + 9, 2, 1, "#4a6fa5");
      px(ctx, s, d.x + 5, by + 9, 2, 1, "#4a6fa5");
      if (p > 0.4 && p < 1.6) {
        var np = (p - 0.4) / 1.2;
        px(ctx, s, d.x + 8, by - 2 - np * 10, 2, 2, "rgba(90,70,160," + (1 - np).toFixed(2) + ")");
        px(ctx, s, d.x + 9, by - 4 - np * 10, 1, 3, "rgba(90,70,160," + (1 - np).toFixed(2) + ")");
      }
    }
  }

  /* ---------- HUD / 遮罩 ---------- */
  function drawHud(ctx, C, st, s) {
    var w = C.W * s, hh = HUD * s;
    ctx.fillStyle = "#fff6e0"; ctx.fillRect(0, 0, w, hh);
    ctx.fillStyle = "#e8cf9e"; ctx.fillRect(0, hh - 1 * s, w, 1 * s);
    var total = st.scene.imps.length;
    text(ctx, "Lv " + st.level, 8, hh / 2, hh * 0.42, "#a2703a", "left", true);
    text(ctx, "Freed " + st.found + " / " + total, w / 2, hh / 2, hh * 0.42, "#3f8f5e", "center", true);
    var low = st.time < 10;
    text(ctx, Math.ceil(st.time) + "s", w - 8, hh / 2, hh * 0.42, low ? "#e0503c" : "#a2703a", "right", true);
    var allow = C.maxMisses(st.level, st.diff), left = allow - st.misses;
    for (var i = 0; i < allow; i++) {
      ctx.fillStyle = i < left ? "#f2a33c" : "#e2d6bd";
      ctx.beginPath();
      ctx.arc(w - 44 * s / 2 - i * 6 * s, hh / 2, 1.8 * s, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function overlay(ctx, C, s, title, lines, hint, shiftUp) {
    var w = C.W * s, h = (C.H + HUD) * s;
    ctx.fillStyle = "rgba(40,60,40,.42)"; ctx.fillRect(0, 0, w, h);
    var pw = Math.min(w * 0.88, 320), ph = 150 + lines.length * 26;
    var x0 = (w - pw) / 2, y0 = Math.max(10, (h - ph) / 2 - (shiftUp || 0));
    ctx.fillStyle = "#fffdf2"; rr(ctx, x0, y0, pw, ph, 16); ctx.fill();
    ctx.strokeStyle = "#e8cf9e"; ctx.lineWidth = 3; ctx.stroke();
    text(ctx, title, w / 2, y0 + 40, 24, "#c47a2c", "center", true);
    for (var i = 0; i < lines.length; i++)
      text(ctx, lines[i], w / 2, y0 + 78 + i * 26, 14, "#6b6350");
    text(ctx, hint, w / 2, y0 + ph - 28, 15, "#3f8f5e", "center", true);
  }

  function diffGeom(C, s) {
    var w = C.W * s, h = (C.H + HUD) * s;
    var bw = Math.min(96, (w - 40) / 3), bh = 46, gap = 8;
    return { bw: bw, bh: bh, gap: gap, x0: (w - (bw * 3 + gap * 2)) / 2, y0: h * 0.7 };
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
    text(ctx, "Difficulty", w / 2, g.y0 - 14, 12, "#fff0c8", "center", true);
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

    if (st.flash) {                                  // 点错:一圈波纹 + NOPE!
      var fp = Math.min(1, st.flash.t / 0.6);
      ctx.save();
      ctx.strokeStyle = "rgba(230,90,70," + (1 - fp).toFixed(2) + ")";
      ctx.lineWidth = 2 * s;
      ctx.beginPath();
      ctx.arc(st.flash.x * s, (HUD + st.flash.y) * s, (4 + fp * 14) * s, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1 - fp;
      text(ctx, "NOPE!", st.flash.x * s, (HUD + st.flash.y - 12 - fp * 8) * s,
           7 * s, "#e0503c", "center", true);
      ctx.restore();
    }

    if (cursor && st.mode === "play") {              // 提灯光圈
      ctx.save();
      var g = ctx.createRadialGradient(cursor.x * s, (HUD + cursor.y) * s, 0,
                                       cursor.x * s, (HUD + cursor.y) * s, 24 * s);
      g.addColorStop(0, "rgba(255,255,210,.32)");
      g.addColorStop(1, "rgba(255,255,210,0)");
      ctx.fillStyle = g;
      ctx.fillRect((cursor.x - 24) * s, (HUD + cursor.y - 24) * s, 48 * s, 48 * s);
      ctx.strokeStyle = "rgba(255,180,60,.9)"; ctx.lineWidth = 1.5 * s;
      ctx.beginPath(); ctx.arc(cursor.x * s, (HUD + cursor.y) * s, 8 * s, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }

    drawHud(ctx, C, st, s);

    if (st.mode === "menu") {
      overlay(ctx, C, s, "🔍 Peekaboo Town", [
        "Cheeky imps are hiding in town,",
        "painted the colour of whatever they sit on.",
        "They peek — big eyes, tongue out. That's your cue!",
        USE_HINT + "."
      ], "Tap to play · Level " + st.level, 74);
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
