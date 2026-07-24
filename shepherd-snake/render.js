/* 牧者行列 · Canvas2D 渲染层(网页 / 微信小游戏共用)。只读 state,不改逻辑。 */
"use strict";

var Render = (function () {
  var HUD = 1.5; // HUD 高度 = 1.5 个格子

  function canvasSize(C, px) {
    return { w: C.COLS * px, h: (C.ROWS + HUD) * px };
  }
  function skillBtn(C, px) {
    return { x: (C.COLS - 1.3) * px, y: (HUD + C.ROWS - 1.4) * px, r: px * 0.95 };
  }

  function rr(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function circle(ctx, x, y, r, fill, stroke, lw) {
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 2; ctx.stroke(); }
  }
  function face(ctx, x, y, r, happy) {
    ctx.fillStyle = "#4a3728";
    circle(ctx, x - r * 0.34, y - r * 0.1, r * 0.11, "#4a3728");
    circle(ctx, x + r * 0.34, y - r * 0.1, r * 0.11, "#4a3728");
    ctx.strokeStyle = "#4a3728"; ctx.lineWidth = Math.max(2, r * 0.09);
    ctx.beginPath();
    if (happy) ctx.arc(x, y + r * 0.18, r * 0.3, 0.15 * Math.PI, 0.85 * Math.PI);
    else ctx.arc(x, y + r * 0.32, r * 0.22, 1.15 * Math.PI, 1.85 * Math.PI);
    ctx.stroke();
    ctx.fillStyle = "rgba(255,140,120,.45)";
    circle(ctx, x - r * 0.55, y + r * 0.12, r * 0.14, "rgba(255,140,120,.45)");
    circle(ctx, x + r * 0.55, y + r * 0.12, r * 0.14, "rgba(255,140,120,.45)");
  }

  function drawAngel(ctx, cx, cy, r, t, ghost) {
    ctx.save();
    if (ghost) ctx.globalAlpha = 0.55;
    var flap = Math.sin(t * 10) * r * 0.12;
    ctx.fillStyle = "#fff";
    ctx.strokeStyle = "#d9c9a8"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(cx - r * 1.05, cy + r * 0.05, r * 0.55, r * 0.32 + flap, -0.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(cx + r * 1.05, cy + r * 0.05, r * 0.55, r * 0.32 + flap, 0.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    circle(ctx, cx, cy, r, "#ffffff", "#e3d5b8", 3);
    ctx.strokeStyle = "#f2c14e"; ctx.lineWidth = Math.max(3, r * 0.16);
    ctx.beginPath(); ctx.ellipse(cx, cy - r * 1.28, r * 0.55, r * 0.18, 0, 0, Math.PI * 2); ctx.stroke();
    face(ctx, cx, cy, r, true);
    var gx = cx + r * 0.95, gy = cy + r * 0.55, s = r * 0.5;
    ctx.strokeStyle = "#c98b2d"; ctx.lineWidth = Math.max(3, r * 0.18); ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(gx, gy - s); ctx.lineTo(gx, gy + s);
    ctx.moveTo(gx - s * 0.55, gy - s * 0.35); ctx.lineTo(gx + s * 0.55, gy - s * 0.35); ctx.stroke();
    ctx.restore();
  }

  var QUEUE_COLORS = ["#ffd9a0", "#ffc9c9", "#c9e8ff", "#d6f2c9"];
  function drawFollower(ctx, cx, cy, r, i, ghost) {
    ctx.save();
    if (ghost) ctx.globalAlpha = 0.55;
    circle(ctx, cx, cy, r, QUEUE_COLORS[i % QUEUE_COLORS.length], "#c9a97a", 2);
    ctx.strokeStyle = "#4a3728"; ctx.lineWidth = Math.max(2, r * 0.1);
    ctx.beginPath();
    ctx.arc(cx - r * 0.34, y2(cy, r), r * 0.16, 1.1 * Math.PI, 1.9 * Math.PI);
    ctx.arc(cx + r * 0.34, y2(cy, r), r * 0.16, 1.1 * Math.PI, 1.9 * Math.PI);
    ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy + r * 0.25, r * 0.24, 0.2 * Math.PI, 0.8 * Math.PI); ctx.stroke();
    ctx.restore();
  }
  function y2(cy, r) { return cy - r * 0.08; }

  function drawBeliever(ctx, cx, cy, r, t) {
    var bob = Math.sin(t * 4 + cx) * r * 0.08;
    cy += bob;
    // 举起的双手(求接走),画在身体后面
    ctx.fillStyle = "#ffdba8";
    circle(ctx, cx - r * 0.85, cy - r * 0.65, r * 0.24, "#ffdba8", "#e0b070", 1.5);
    circle(ctx, cx + r * 0.85, cy - r * 0.65, r * 0.24, "#ffdba8", "#e0b070", 1.5);
    circle(ctx, cx, cy, r, "#ffe8b8", "#dfb267", 2.5);
    ctx.fillStyle = "#4a3728";
    circle(ctx, cx - r * 0.32, cy - r * 0.12, r * 0.11, "#4a3728");
    circle(ctx, cx + r * 0.32, cy - r * 0.12, r * 0.11, "#4a3728");
    circle(ctx, cx, cy + r * 0.3, r * 0.17, "#4a3728"); // 张着小嘴 "接我!"
    ctx.fillStyle = "rgba(255,140,120,.45)";
    circle(ctx, cx - r * 0.55, cy + r * 0.1, r * 0.14, "rgba(255,140,120,.45)");
    circle(ctx, cx + r * 0.55, cy + r * 0.1, r * 0.14, "rgba(255,140,120,.45)");
  }

  function drawDemon(ctx, cx, cy, r, t, justBlinked) {
    if (justBlinked) {
      ctx.strokeStyle = "rgba(160,90,255,.6)"; ctx.lineWidth = 3;
      circle(ctx, cx, cy, r * 1.35 + Math.sin(t * 12) * 2, null, "rgba(160,90,255,.6)", 3);
    }
    ctx.fillStyle = "#5b2ea6";
    ctx.beginPath(); ctx.moveTo(cx - r * 0.55, cy - r * 0.6); ctx.lineTo(cx - r * 0.85, cy - r * 1.25); ctx.lineTo(cx - r * 0.18, cy - r * 0.85); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(cx + r * 0.55, cy - r * 0.6); ctx.lineTo(cx + r * 0.85, cy - r * 1.25); ctx.lineTo(cx + r * 0.18, cy - r * 0.85); ctx.closePath(); ctx.fill();
    circle(ctx, cx, cy, r, "#8a4fe0", "#5b2ea6", 3);
    ctx.strokeStyle = "#2e1552"; ctx.lineWidth = Math.max(2.5, r * 0.12); ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(cx - r * 0.5, cy - r * 0.38); ctx.lineTo(cx - r * 0.16, cy - r * 0.18);
    ctx.moveTo(cx + r * 0.5, cy - r * 0.38); ctx.lineTo(cx + r * 0.16, cy - r * 0.18); ctx.stroke();
    ctx.fillStyle = "#2e1552";
    circle(ctx, cx - r * 0.3, cy - r * 0.02, r * 0.13, "#2e1552");
    circle(ctx, cx + r * 0.3, cy - r * 0.02, r * 0.13, "#2e1552");
    ctx.fillStyle = "#fff";
    ctx.beginPath(); ctx.moveTo(cx - r * 0.28, cy + r * 0.34); ctx.lineTo(cx - r * 0.16, cy + r * 0.58); ctx.lineTo(cx - r * 0.04, cy + r * 0.34); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(cx + r * 0.28, cy + r * 0.34); ctx.lineTo(cx + r * 0.16, cy + r * 0.58); ctx.lineTo(cx + r * 0.04, cy + r * 0.34); ctx.closePath(); ctx.fill();
  }

  function drawStar(ctx, cx, cy, r, t) {
    var pulse = 1 + Math.sin(t * 6) * 0.12, i;
    ctx.save(); ctx.translate(cx, cy); ctx.scale(pulse, pulse); ctx.rotate(t * 1.5);
    ctx.fillStyle = "#ffcf3f"; ctx.strokeStyle = "#d9930d"; ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (i = 0; i < 10; i++) {
      var a = i * Math.PI / 5 - Math.PI / 2, rr2 = i % 2 ? r * 0.45 : r;
      ctx.lineTo(Math.cos(a) * rr2, Math.sin(a) * rr2);
    }
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  function text(ctx, str, x, y, size, color, align, bold) {
    ctx.fillStyle = color;
    ctx.font = (bold ? "bold " : "") + size + 'px "Trebuchet MS", "Verdana", sans-serif';
    ctx.textAlign = align || "center"; ctx.textBaseline = "middle";
    ctx.fillText(str, x, y);
  }

  function overlay(ctx, w, h, title, lines, hint) {
    ctx.fillStyle = "rgba(43,34,20,.55)"; ctx.fillRect(0, 0, w, h);
    var pw = Math.min(w * 0.86, 340), ph = 190 + lines.length * 30, px0 = (w - pw) / 2, py0 = (h - ph) / 2;
    ctx.fillStyle = "#fffdf6"; rr(ctx, px0, py0, pw, ph, 20); ctx.fill();
    ctx.strokeStyle = "#e8d9b0"; ctx.lineWidth = 3; ctx.stroke();
    text(ctx, title, w / 2, py0 + 52, 30, "#8a6210", "center", true);
    for (var i = 0; i < lines.length; i++)
      text(ctx, lines[i], w / 2, py0 + 100 + i * 30, 16, "#5c5142");
    text(ctx, hint, w / 2, py0 + ph - 38, 17, "#3f7d5a", "center", true);
  }

  function draw(ctx, C, st, px, t) {
    var sz = canvasSize(C, px), w = sz.w, h = sz.h, top = HUD * px, i;

    ctx.fillStyle = "#cde9f7"; ctx.fillRect(0, 0, w, h);           // 天空底
    ctx.fillStyle = "#fdf6e4"; ctx.fillRect(0, top, w, h - top);   // 禾场
    ctx.fillStyle = "rgba(214,178,110,.14)";
    for (var gx = 0; gx < C.COLS; gx++) for (var gy = 0; gy < C.ROWS; gy++)
      if ((gx + gy) % 2 === 0) ctx.fillRect(gx * px, top + gy * px, px, px);
    ctx.strokeStyle = "#e3cf9e"; ctx.lineWidth = 3;
    ctx.strokeRect(1.5, top + 1.5, w - 3, h - top - 3);

    // HUD(有大恶魔时变成双方比分)
    text(ctx, "Lv " + st.level, 14, top / 2, 20, "#365a8c", "left", true);
    var captives = st.rival ? st.rival.body.length - 3 : 0;
    text(ctx, st.rival ? "You " + st.rescued + "/" + C.quota(st.level) + " · Demon " + captives
                       : "Saved " + st.rescued + " / " + C.quota(st.level),
         w / 2, top / 2, st.rival ? 17 : 20, "#3f7d5a", "center", true);
    if (st.skill) text(ctx, C.SKILLS[st.skill].name, w - 14, top / 2, 18, "#b8860b", "right", true);
    else if (C.hasSkills(st.level)) text(ctx, "Skill: —", w - 14, top / 2, 18, "#b0a488", "right");

    function cc(p) { return { x: p.x * px + px / 2, y: top + p.y * px + px / 2 }; }
    var r = px * 0.42;

    if (st.pickup) { var pk = cc(st.pickup); drawStar(ctx, pk.x, pk.y, r * 0.9, t); }
    for (i = 0; i < st.believers.length; i++) { var b = cc(st.believers[i]); drawBeliever(ctx, b.x, b.y, r, t); }
    for (i = 0; i < st.demons.length; i++) {
      var d = cc(st.demons[i]);
      drawDemon(ctx, d.x, d.y, r, t, false);
    }
    if (st.rival) {
      // 尾巴:第 3 节起是被掳的信徒(灰紫、哭脸),前 2 节是恶魔身体
      for (i = st.rival.body.length - 1; i >= 1; i--) {
        var seg = cc(st.rival.body[i]);
        if (i >= 3) {
          circle(ctx, seg.x, seg.y, r * 0.8, "#cbbfe3", "#8f7cc0", 2);
          face(ctx, seg.x, seg.y, r * 0.8, false);
        } else {
          circle(ctx, seg.x, seg.y, r * 0.85, "#6b3bb8", "#4a2a86", 2.5);
        }
      }
      var rh = cc(st.rival.body[0]);
      drawDemon(ctx, rh.x, rh.y, r * 1.25, t, false);
    }
    var ghost = C.effectActive(st, "ghost");
    for (i = st.snake.length - 1; i >= 1; i--) { var s = cc(st.snake[i]); drawFollower(ctx, s.x, s.y, r * 0.88, i, ghost); }
    var hd = cc(st.snake[0]);
    if (C.effectActive(st, "shield")) {
      ctx.strokeStyle = "rgba(242,193,78,.85)"; ctx.lineWidth = 4;
      circle(ctx, hd.x, hd.y, r * 1.5 + Math.sin(t * 8) * 2, null, "rgba(242,193,78,.85)", 4);
    }
    drawAngel(ctx, hd.x, hd.y, r, t, ghost);

    // 技能按钮
    if (st.skill && st.mode === "play") {
      var btn = skillBtn(C, px);
      circle(ctx, btn.x, btn.y, btn.r, "rgba(255,214,90,.92)", "#c98b2d", 3);
      text(ctx, C.SKILLS[st.skill].name, btn.x, btn.y, btn.r * 0.5, "#6b4a08", "center", true);
    }

    // 遮罩层
    if (st.mode === "menu") {
      overlay(ctx, w, h, "✝ Shepherd's Flock", [
        "Lead the little angel and the cross,",
        "gather lost believers into your line.",
        "Arrow keys / swipe to steer."
      ], "Tap to start · Level " + st.level);
    } else if (st.mode === "intro") {
      var lines = ["Save " + C.quota(st.level) + " believers to clear the level"];
      if (C.demonCount(st.level) > 0) lines.push(C.demonCount(st.level) + " little demons — don't touch them!");
      if (C.hasRival(st.level)) {
        lines.push("A great demon races you for believers!");
        lines.push("Bump its tail to steal them back — avoid its head!");
        if (C.rivalEvery(st.level) <= 2) lines.push("The great demon grows swift!");
      }
      if (C.hasSkills(st.level)) lines.push("Grab the ⭐ for a skill, tap to use it");
      overlay(ctx, w, h, "Level " + st.level, lines, "Tap to set off");
    } else if (st.mode === "clear") {
      overlay(ctx, w, h, "Level Cleared!", ["Level " + st.level + " · " + st.rescued + " believers saved"],
        st.level >= C.MAX_LEVEL ? "All 50 levels cleared! Tap to replay" : "Tap for level " + (st.level + 1));
    } else if (st.mode === "dead") {
      overlay(ctx, w, h, "Oh no…", [st.deathMsg, "Saved " + st.rescued + " / " + C.quota(st.level)], "Tap to retry level " + st.level);
    }
  }

  return { HUD: HUD, canvasSize: canvasSize, skillBtn: skillBtn, draw: draw };
})();

if (typeof module !== "undefined") module.exports = Render;
