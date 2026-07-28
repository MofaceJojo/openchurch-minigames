/* 夜巡 Night Watch · 像素渲染层。只读 state,不改逻辑。
   所有绘制都在虚拟像素坐标(160x240)里,由 scale 整数放大,保证像素锐利。 */
"use strict";

var Render = (function () {
  var HUD = 18;                 // HUD 高度(虚拟像素)

  var USE_HINT = "Click a demon to drive it out";
  function setUseHint(s) { USE_HINT = s; }

  function canvasSize(C, s) { return { w: C.W * s, h: (C.H + HUD) * s }; }

  function rgb(c) { return "rgb(" + c[0] + "," + c[1] + "," + c[2] + ")"; }
  function mix(a, b, t) {
    return [Math.round(a[0] + (b[0] - a[0]) * t),
            Math.round(a[1] + (b[1] - a[1]) * t),
            Math.round(a[2] + (b[2] - a[2]) * t)];
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

  /* ---------- 场景 ---------- */

  function drawSky(ctx, C, sc, s, t) {
    var g = ctx.createLinearGradient(0, HUD * s, 0, (HUD + C.H) * s);
    g.addColorStop(0, "#0b1024"); g.addColorStop(0.55, "#141a33"); g.addColorStop(1, "#1e2038");
    ctx.fillStyle = g; ctx.fillRect(0, HUD * s, C.W * s, C.H * s);
    var i;
    for (i = 0; i < sc.stars.length; i++) {
      var st2 = sc.stars[i];
      var tw = 0.6 + 0.4 * Math.sin(t * 2 + i);
      px(ctx, s, st2.x, HUD + st2.y, 1, 1, "rgba(255,255,240," + (st2.b * tw).toFixed(2) + ")");
    }
    // 月亮
    var m = sc.moon;
    for (var dy = -m.r; dy <= m.r; dy++) for (var dx = -m.r; dx <= m.r; dx++) {
      if (dx * dx + dy * dy <= m.r * m.r)
        px(ctx, s, m.x + dx, HUD + m.y + dy, 1, 1, "#f2e9c8");
    }
    px(ctx, s, m.x - m.r, HUD + m.y - m.r - 3, m.r * 2 + 1, 1, "rgba(242,233,200,.10)");
  }

  function drawBuildings(ctx, C, sc, s) {
    for (var i = 0; i < sc.buildings.length; i++) {
      var b = sc.buildings[i];
      px(ctx, s, b.x, HUD + b.y, b.w, b.h, b.col);
      px(ctx, s, b.x, HUD + b.y, b.w, 3, b.roof);          // 屋檐
      px(ctx, s, b.x, HUD + b.y + 3, 1, b.h - 3, mix(b.col, [0, 0, 0], 0.3));
      if (b.chimney) {
        px(ctx, s, b.x + 4, HUD + b.y - 7, 5, 7, mix(b.roof, [0, 0, 0], 0.15));
        px(ctx, s, b.x + 4, HUD + b.y - 8, 5, 1, mix(b.roof, [255, 255, 255], 0.15));
      }
      for (var j = 0; j < b.windows.length; j++) {
        var wnd = b.windows[j];
        if (wnd.lit) {
          var c = wnd.warm ? "#f2c76b" : "#9fd3e8";
          px(ctx, s, wnd.x, HUD + wnd.y, 5, 7, c);
          px(ctx, s, wnd.x - 1, HUD + wnd.y - 1, 7, 9, "rgba(242,199,107,.10)");
          px(ctx, s, wnd.x + 2, HUD + wnd.y, 1, 7, "rgba(0,0,0,.25)");
        } else {
          px(ctx, s, wnd.x, HUD + wnd.y, 5, 7, [18, 20, 34]);
          px(ctx, s, wnd.x, HUD + wnd.y, 5, 1, mix(b.col, [0, 0, 0], 0.4));
        }
      }
    }
  }

  function drawGround(ctx, C, sc, s, t) {
    px(ctx, s, 0, HUD + C.H - 46, C.W, 46, [26, 26, 40]);
    px(ctx, s, 0, HUD + C.H - 46, C.W, 1, [40, 40, 58]);
    var i;
    for (i = 0; i < sc.lamps.length; i++) {
      var L = sc.lamps[i];
      px(ctx, s, L.x, HUD + L.y - 46, 2, 46, [58, 50, 34]);      // 灯柱
      px(ctx, s, L.x - 3, HUD + L.y - 50, 8, 5, [72, 62, 40]);   // 灯罩
      px(ctx, s, L.x - 2, HUD + L.y - 48, 6, 3, "#ffd98a");      // 灯芯
      // 光锥
      ctx.save();
      var g = ctx.createRadialGradient((L.x + 1) * s, (HUD + L.y - 46) * s, 0,
                                       (L.x + 1) * s, (HUD + L.y - 46) * s, 30 * s);
      g.addColorStop(0, "rgba(255,214,130,.22)"); g.addColorStop(1, "rgba(255,214,130,0)");
      ctx.fillStyle = g;
      ctx.fillRect((L.x - 29) * s, (HUD + L.y - 76) * s, 60 * s, 60 * s);
      ctx.restore();
    }
    for (i = 0; i < sc.bushes.length; i++) {
      var B = sc.bushes[i];
      px(ctx, s, B.x, HUD + B.y, B.w, 8, [22, 44, 28]);
      px(ctx, s, B.x + 1, HUD + B.y - 2, B.w - 2, 3, [26, 52, 32]);
      px(ctx, s, B.x + 2, HUD + B.y - 3, 3, 2, [30, 60, 36]);
    }
  }

  /* ---------- 鬼:伪装成所在环境的颜色,偶尔眨眼露破绽 ---------- */
  function drawDemon(ctx, C, st, d, s, t) {
    var camo = C.camoStrength(st.level, st.diff);
    if (d.found) return drawFreed(ctx, C, d, s, t);

    // 真正的保护色:直接穿环境的颜色,只留一点点亮度差和紫调,
    // 差值随关卡缩小 —— 后期几乎和背景融为一体,只能靠眨眼认出来
    var delta = (1 - camo) * 46;
    var body = [
      Math.max(0, Math.min(255, Math.round(d.host[0] + delta * 1.15))),
      Math.max(0, Math.min(255, Math.round(d.host[1] + delta * 0.55))),
      Math.max(0, Math.min(255, Math.round(d.host[2] + delta * 1.35)))
    ];
    var telling = C.isTelling(st, d);

    // 身体(小小一团 + 两只角)
    px(ctx, s, d.x + 1, d.y + 3, 7, 6, body);
    px(ctx, s, d.x, d.y + 5, 1, 3, body);
    px(ctx, s, d.x + 8, d.y + 5, 1, 3, body);
    px(ctx, s, d.x + 1, d.y + 1, 2, 2, body);        // 左角
    px(ctx, s, d.x + 6, d.y + 1, 2, 2, body);        // 右角
    px(ctx, s, d.x + 2, d.y + 9, 2, 1, mix(body, [0, 0, 0], 0.35));
    px(ctx, s, d.x + 5, d.y + 9, 2, 1, mix(body, [0, 0, 0], 0.35));

    // 眼睛:平时也是伪装色,眨眼瞬间发红光(这是唯一的破绽)
    var eye = telling ? "#ff4d3d" : rgb(mix(body, [200, 190, 160], 0.22));
    px(ctx, s, d.x + 2, d.y + 5, 2, 2, eye);
    px(ctx, s, d.x + 5, d.y + 5, 2, 2, eye);
    if (telling) {
      px(ctx, s, d.x + 1, d.y + 4, 4, 4, "rgba(255,77,61,.20)");
      px(ctx, s, d.x + 4, d.y + 4, 4, 4, "rgba(255,77,61,.20)");
    }
  }

  /* 被赶出:黑烟升腾散去,底下那个人站起来,头顶亮起小光 */
  function drawFreed(ctx, C, d, s, t) {
    var p = Math.min(1, d.freeing / 1.1);
    if (p < 1) {
      for (var i = 0; i < 5; i++) {
        var q = Math.max(0, Math.min(1, p * 1.5 - i * 0.12));
        if (q <= 0 || q >= 1) continue;
        var yy = d.y + 4 - q * 22;
        var xx = d.x + 3 + Math.sin(q * 6 + i) * 5;
        var a = (1 - q) * 0.75;
        px(ctx, s, xx, yy, 3 - (q * 2 | 0), 2, "rgba(60,20,80," + a.toFixed(2) + ")");
      }
    }
    // 获救的人
    var ap = Math.min(1, Math.max(0, (d.freeing - 0.25) / 0.6));
    if (ap > 0) {
      var wave = Math.sin(t * 6) * 1;
      px(ctx, s, d.x + 2, d.y + 4, 4, 4, "#f6d9b0");                 // 头
      px(ctx, s, d.x + 2, d.y + 8, 4, 4, "#dfe6ee");                 // 身
      px(ctx, s, d.x + 1, d.y + 8 + wave, 1, 2, "#f6d9b0");          // 举起的手
      px(ctx, s, d.x + 6, d.y + 9, 1, 2, "#f6d9b0");
      var glow = 0.35 + 0.25 * Math.sin(t * 4);
      px(ctx, s, d.x + 2, d.y + 1, 4, 1, "rgba(255,230,150," + glow.toFixed(2) + ")");
      px(ctx, s, d.x + 1, d.y + 2, 6, 1, "rgba(255,230,150," + (glow * 0.5).toFixed(2) + ")");
    }
  }

  /* ---------- HUD / 遮罩 ---------- */

  function drawHud(ctx, C, st, s) {
    var w = C.W * s, hh = HUD * s;
    ctx.fillStyle = "#0a0e1c"; ctx.fillRect(0, 0, w, hh);
    ctx.fillStyle = "#1e2740"; ctx.fillRect(0, hh - 1 * s, w, 1 * s);

    var total = st.scene.demons.length;
    text(ctx, "Lv " + st.level, 8, hh / 2, hh * 0.42, "#8fa6c8", "left", true);
    text(ctx, "Freed " + st.found + " / " + total, w / 2, hh / 2, hh * 0.42, "#d9c27a", "center", true);

    // 剩余时间 + 失手
    var mm = Math.ceil(st.time);
    var low = st.time < 10;
    text(ctx, mm + "s", w - 8, hh / 2, hh * 0.42, low ? "#ff6b5a" : "#8fa6c8", "right", true);
    var left = C.maxMisses(st.level, st.diff) - st.misses;
    for (var i = 0; i < C.maxMisses(st.level, st.diff); i++) {
      ctx.fillStyle = i < left ? "#e0b04b" : "#3a4258";
      ctx.beginPath();
      ctx.arc(w - 8 - 30 * s / 2 - i * 7 * s, hh / 2, 2 * s, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function overlay(ctx, C, s, title, lines, hint, shiftUp) {
    var w = C.W * s, h = (C.H + HUD) * s;
    ctx.fillStyle = "rgba(6,9,20,.72)"; ctx.fillRect(0, 0, w, h);
    var pw = Math.min(w * 0.88, 320), ph = 150 + lines.length * 26;
    var x0 = (w - pw) / 2, y0 = Math.max(10, (h - ph) / 2 - (shiftUp || 0));
    ctx.fillStyle = "#121a2e"; rr(ctx, x0, y0, pw, ph, 16); ctx.fill();
    ctx.strokeStyle = "#2c3a5c"; ctx.lineWidth = 2; ctx.stroke();
    text(ctx, title, w / 2, y0 + 40, 24, "#e8d9a0", "center", true);
    for (var i = 0; i < lines.length; i++)
      text(ctx, lines[i], w / 2, y0 + 78 + i * 26, 14, "#a9b8d4");
    text(ctx, hint, w / 2, y0 + ph - 28, 15, "#7fd4b8", "center", true);
  }

  /* 难度选择(菜单页) */
  function diffGeom(C, s) {
    var w = C.W * s, h = (C.H + HUD) * s;
    var bw = Math.min(96, (w - 40) / 3), bh = 46, gap = 8;
    var total = bw * 3 + gap * 2;
    return { bw: bw, bh: bh, gap: gap, x0: (w - total) / 2, y0: h * 0.68 };
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
    text(ctx, "Difficulty", w / 2, g.y0 - 14, 12, "#7d8db0", "center", true);
    for (var i = 0; i < C.DIFF_IDS.length; i++) {
      var id = C.DIFF_IDS[i], d = C.DIFFS[id], c = diffCell(g, i), cur = st.diff === id;
      ctx.fillStyle = cur ? "#2f6f5c" : "#141c30";
      rr(ctx, c.x, c.y, g.bw, g.bh, 9); ctx.fill();
      ctx.strokeStyle = cur ? "#4fae8f" : "#2c3a5c"; ctx.lineWidth = 2; ctx.stroke();
      text(ctx, d.name, c.x + g.bw / 2, c.y + g.bh * 0.36, 15, cur ? "#eafff6" : "#93a4c6", "center", true);
      text(ctx, d.blurb, c.x + g.bw / 2, c.y + g.bh * 0.72, 9.5, cur ? "rgba(234,255,246,.8)" : "#5f6f92");
    }
  }

  /* ---------- 主绘制 ---------- */
  function draw(ctx, C, st, s, t, cursor) {
    var sc = st.scene, i;
    drawSky(ctx, C, sc, s, t);
    drawBuildings(ctx, C, sc, s);
    drawGround(ctx, C, sc, s, t);
    for (i = 0; i < sc.demons.length; i++) drawDemon(ctx, C, st, sc.demons[i], s, t);

    // 点错的反馈
    if (st.flash) {
      var fp = Math.min(1, st.flash.t / 0.5);
      ctx.save();
      ctx.strokeStyle = "rgba(255,90,70," + (1 - fp).toFixed(2) + ")";
      ctx.lineWidth = 2 * s;
      ctx.beginPath();
      ctx.arc(st.flash.x * s, (HUD + st.flash.y) * s, (4 + fp * 12) * s, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // 光标:一圈提灯的光,照亮周围一小片
    if (cursor && st.mode === "play") {
      ctx.save();
      var g = ctx.createRadialGradient(cursor.x * s, (HUD + cursor.y) * s, 0,
                                       cursor.x * s, (HUD + cursor.y) * s, 26 * s);
      g.addColorStop(0, "rgba(255,244,200,.20)");
      g.addColorStop(0.6, "rgba(255,244,200,.06)");
      g.addColorStop(1, "rgba(255,244,200,0)");
      ctx.fillStyle = g;
      ctx.fillRect((cursor.x - 26) * s, (HUD + cursor.y - 26) * s, 52 * s, 52 * s);
      ctx.strokeStyle = "rgba(255,240,190,.75)"; ctx.lineWidth = 1.5 * s;
      ctx.beginPath(); ctx.arc(cursor.x * s, (HUD + cursor.y) * s, 8 * s, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo((cursor.x - 12) * s, (HUD + cursor.y) * s); ctx.lineTo((cursor.x - 9) * s, (HUD + cursor.y) * s);
      ctx.moveTo((cursor.x + 9) * s, (HUD + cursor.y) * s);  ctx.lineTo((cursor.x + 12) * s, (HUD + cursor.y) * s);
      ctx.moveTo(cursor.x * s, (HUD + cursor.y - 12) * s);   ctx.lineTo(cursor.x * s, (HUD + cursor.y - 9) * s);
      ctx.moveTo(cursor.x * s, (HUD + cursor.y + 9) * s);    ctx.lineTo(cursor.x * s, (HUD + cursor.y + 12) * s);
      ctx.stroke();
      ctx.restore();
    }

    drawHud(ctx, C, st, s);

    if (st.mode === "menu") {
      overlay(ctx, C, s, "✦ Night Watch", [
        "Demons hide in the town at night,",
        "wearing the colours around them.",
        "Watch for the red blink — that's the tell.",
        USE_HINT + "."
      ], "Tap to begin · Level " + st.level, 70);
      drawDiffPicker(ctx, C, st, s);
    } else if (st.mode === "intro") {
      var n = st.scene.demons.length;
      overlay(ctx, C, s, "Level " + st.level, [
        n + (n === 1 ? " demon is hiding" : " demons are hiding"),
        "You have " + Math.round(st.time) + " seconds",
        C.maxMisses(st.level, st.diff) - st.misses + " wrong lights allowed"
      ], "Tap to start the watch");
    } else if (st.mode === "cleared") {
      overlay(ctx, C, s, "Town is free!", [
        "Level " + st.level + " · " + st.found + " set free",
        Math.round(st.time) + "s to spare"
      ], st.level >= C.MAX_LEVEL ? "All nights complete! Tap to replay"
                                 : "Tap for level " + (st.level + 1));
    } else if (st.mode === "failed") {
      overlay(ctx, C, s, "Not tonight…", [
        st.failWhy,
        "Freed " + st.found + " of " + st.scene.demons.length
      ], "Tap to try level " + st.level + " again");
    }
  }

  return { HUD: HUD, canvasSize: canvasSize, draw: draw,
           setUseHint: setUseHint, diffPickerHit: diffPickerHit };
})();

if (typeof module !== "undefined") module.exports = Render;
