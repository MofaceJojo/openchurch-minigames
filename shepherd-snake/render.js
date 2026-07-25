/* 牧者行列 · Canvas2D 渲染层(网页 / 微信小游戏共用)。只读 state,不改逻辑。 */
"use strict";

var Render = (function () {
  var HUD = 1.5; // HUD 高度 = 1.5 个格子

  // 释放技能的操作提示,由壳层按设备设定(触屏 / 键盘)
  var USE_HINT = "Press SPACE or tap the button";
  function setUseHint(s) { USE_HINT = s; }

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

  /* ---------- 四种技能:各自的图标 ---------- */

  function iconGather(ctx, cx, cy, r, col, t) {   // 呼召:向内收拢的同心波纹 + 中心小人
    ctx.strokeStyle = col; ctx.lineCap = "round";
    for (var i = 0; i < 3; i++) {
      var ph = (t * 0.9 + i / 3) % 1;             // 由外向内收
      ctx.lineWidth = Math.max(1.6, r * 0.16);
      ctx.globalAlpha = 0.25 + 0.75 * ph;
      ctx.beginPath();
      ctx.arc(cx, cy, r * (0.35 + (1 - ph) * 0.78), -0.72 * Math.PI, -0.28 * Math.PI); ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy, r * (0.35 + (1 - ph) * 0.78), 0.28 * Math.PI, 0.72 * Math.PI); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    circle(ctx, cx, cy, r * 0.3, col);
  }

  function iconSmite(ctx, cx, cy, r, col, t) {    // 圣火:跳动的火苗
    var f = 1 + Math.sin(t * 8) * 0.08;
    ctx.save(); ctx.translate(cx, cy); ctx.scale(1, f);
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(0, -r * 1.05);
    ctx.bezierCurveTo(r * 0.82, -r * 0.2, r * 0.6, r * 0.95, 0, r * 0.95);
    ctx.bezierCurveTo(-r * 0.6, r * 0.95, -r * 0.82, -r * 0.2, 0, -r * 1.05);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#ffe9a8";                    // 内焰
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.3);
    ctx.bezierCurveTo(r * 0.4, r * 0.12, r * 0.3, r * 0.72, 0, r * 0.72);
    ctx.bezierCurveTo(-r * 0.3, r * 0.72, -r * 0.4, r * 0.12, 0, -r * 0.3);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  function iconShield(ctx, cx, cy, r, col, t) {   // 护佑:盾牌 + 十字
    var g = 1 + Math.sin(t * 4) * 0.04;
    ctx.save(); ctx.translate(cx, cy); ctx.scale(g, g);
    ctx.fillStyle = col; ctx.strokeStyle = "#ffffff"; ctx.lineWidth = Math.max(1.5, r * 0.12);
    ctx.beginPath();
    ctx.moveTo(0, -r * 1.05);
    ctx.lineTo(r * 0.85, -r * 0.62);
    ctx.lineTo(r * 0.85, r * 0.18);
    ctx.quadraticCurveTo(r * 0.8, r * 0.86, 0, r * 1.1);
    ctx.quadraticCurveTo(-r * 0.8, r * 0.86, -r * 0.85, r * 0.18);
    ctx.lineTo(-r * 0.85, -r * 0.62);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = "#ffffff"; ctx.lineWidth = Math.max(2, r * 0.2); ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.5); ctx.lineTo(0, r * 0.55);
    ctx.moveTo(-r * 0.36, -r * 0.12); ctx.lineTo(r * 0.36, -r * 0.12);
    ctx.stroke();
    ctx.restore();
  }

  function iconGhost(ctx, cx, cy, r, col, t) {    // 灵体:半透明幽灵,底部波浪飘动
    var bob = Math.sin(t * 3.5) * r * 0.1;
    ctx.save(); ctx.globalAlpha = 0.85; ctx.translate(cx, cy + bob);
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(0, -r * 0.15, r * 0.88, Math.PI, 0);
    ctx.lineTo(r * 0.88, r * 0.55);
    for (var i = 0; i < 3; i++) {                 // 三个波浪裙边
      var x0 = r * 0.88 - i * r * 0.586;
      ctx.quadraticCurveTo(x0 - r * 0.146, r * 0.55 + (i % 2 ? -r * 0.3 : r * 0.34),
                           x0 - r * 0.586, r * 0.55);
    }
    ctx.lineTo(-r * 0.88, -r * 0.15);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#ffffff";
    circle(ctx, -r * 0.3, -r * 0.24, r * 0.19, "#ffffff");
    circle(ctx, r * 0.3, -r * 0.24, r * 0.19, "#ffffff");
    ctx.restore();
  }

  function drawSkillIcon(ctx, C, id, cx, cy, r, t) {
    var col = C.SKILLS[id].color;
    if (id === "summon") iconGather(ctx, cx, cy, r, col, t);
    else if (id === "smite") iconSmite(ctx, cx, cy, r, col, t);
    else if (id === "shield") iconShield(ctx, cx, cy, r, col, t);
    else iconGhost(ctx, cx, cy, r, col, t);
  }

  function drawPickup(ctx, C, id, cx, cy, r, t) {  // 场上的技能拾取物:光晕托底 + 专属图标
    var pulse = 0.5 + 0.5 * Math.sin(t * 4);
    var col = C.SKILLS[id].color;
    ctx.save();
    ctx.globalAlpha = 0.2 + 0.22 * pulse;
    circle(ctx, cx, cy, r * (1.35 + 0.22 * pulse), col);
    ctx.restore();
    circle(ctx, cx, cy, r * 1.02, "#fffdf2", C.SKILLS[id].dark, 2.5);
    drawSkillIcon(ctx, C, id, cx, cy, r * 0.68, t);
  }

  /* ---------- 死亡演出:三种死法三种搞笑动画 ---------- */

  function drawStars(ctx, cx, cy, r, p) {           // 头上转圈圈的小星星
    for (var i = 0; i < 3; i++) {
      var a = p * 7 + i * Math.PI * 2 / 3;
      drawStar(ctx, cx + Math.cos(a) * r * 1.5, cy - r * 1.5 + Math.sin(a) * r * 0.45, r * 0.3, p * 4);
    }
  }

  function drawSquashedAngel(ctx, cx, cy, r, p, dir) {
    // 撞墙:压扁 → 弹回 → 眩晕转星星
    var squash = p < 0.28 ? 1 - 0.65 * (p / 0.28) : Math.min(1, 0.35 + (p - 0.28) / 0.3 * 0.65);
    var back = p < 0.28 ? 0 : Math.min(1, (p - 0.28) / 0.45) * r * 1.6;
    var horiz = Math.abs(dir.x) > Math.abs(dir.y);
    cx -= (dir.x || 0) * back; cy -= (dir.y || 0) * back;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(horiz ? squash : 1 / squash * 0.85, horiz ? 1 / squash * 0.85 : squash);
    circle(ctx, 0, 0, r, "#ffffff", "#e3d5b8", 3);
    // X_X 眼 + 张大的嘴
    ctx.strokeStyle = "#4a3728"; ctx.lineWidth = Math.max(2.5, r * 0.13); ctx.lineCap = "round";
    [-1, 1].forEach(function (s) {
      var ex = s * r * 0.36, ey = -r * 0.12, q = r * 0.16;
      ctx.beginPath();
      ctx.moveTo(ex - q, ey - q); ctx.lineTo(ex + q, ey + q);
      ctx.moveTo(ex + q, ey - q); ctx.lineTo(ex - q, ey + q); ctx.stroke();
    });
    ctx.fillStyle = "#4a3728";
    ctx.beginPath(); ctx.ellipse(0, r * 0.4, r * 0.26, r * 0.2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    if (p > 0.45) drawStars(ctx, cx, cy, r, p);
    if (p < 0.35) {                                  // 撞击瞬间的冲击线
      ctx.strokeStyle = "rgba(255,120,80," + (1 - p / 0.35) + ")"; ctx.lineWidth = 3;
      for (var i = 0; i < 7; i++) {
        var a = -Math.PI / 2 + (i - 3) * 0.28 + Math.atan2(dir.y || 0, dir.x || 1) + Math.PI / 2;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * r * 1.1, cy + Math.sin(a) * r * 1.1);
        ctx.lineTo(cx + Math.cos(a) * r * 2.1, cy + Math.sin(a) * r * 2.1);
        ctx.stroke();
      }
    }
  }

  function drawExplosion(ctx, cx, cy, r, p) {
    // 撞小恶魔:火球炸开 + 碎片四射 + POOF! 字样
    var g = Math.min(1, p / 0.3), fade = p < 0.55 ? 1 : Math.max(0, 1 - (p - 0.55) / 0.45);
    var R = r * (0.6 + g * 3.2);
    ctx.save(); ctx.globalAlpha = fade;
    var grd = ctx.createRadialGradient(cx, cy, R * 0.15, cx, cy, R);
    grd.addColorStop(0, "#fff6c9"); grd.addColorStop(0.4, "#ffb43f");
    grd.addColorStop(0.75, "#ff6a2b"); grd.addColorStop(1, "rgba(120,40,20,0)");
    ctx.fillStyle = grd;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();
    // 卡通爆炸尖角
    ctx.fillStyle = "rgba(255,220,120," + (0.85 * fade) + ")";
    ctx.beginPath();
    for (var k = 0; k < 16; k++) {
      var a = k * Math.PI / 8, rr2 = k % 2 ? R * 0.62 : R * 1.05;
      ctx.lineTo(cx + Math.cos(a) * rr2, cy + Math.sin(a) * rr2);
    }
    ctx.closePath(); ctx.fill();
    // 碎片
    for (var i = 0; i < 10; i++) {
      var ang = i * 0.628 + 0.3, d = R * (0.9 + (i % 3) * 0.25);
      circle(ctx, cx + Math.cos(ang) * d, cy + Math.sin(ang) * d, r * 0.2 * (1 - p * 0.5),
             i % 2 ? "#8a4fe0" : "#ffd97a");
    }
    ctx.restore();
    if (p > 0.25) {
      ctx.save(); ctx.globalAlpha = Math.max(0, 1 - (p - 0.25) / 0.75);
      ctx.translate(cx, cy - r * 2.2 - p * r);
      ctx.rotate(-0.15);
      text(ctx, "POOF!", 0, 0, r * 1.5, "#ffffff", "center", true);
      ctx.strokeStyle = "#c23b1e"; ctx.lineWidth = 2;
      ctx.strokeText("POOF!", 0, 0);
      ctx.restore();
    }
  }

  function drawDevour(ctx, cx, cy, r, p, t) {
    // 被大恶魔吞:血盆大口合上 → 咕咚 → 打嗝小星星
    var open = p < 0.45 ? 1 - p / 0.45 : 0;          // 1=张到最大, 0=合上
    var scale = 1 + (p < 0.45 ? 0.25 * (1 - open) : 0.25 - Math.min(0.25, (p - 0.45) * 0.6));
    // 被吞的小天使:逐渐缩小消失
    if (p < 0.42) {
      ctx.save(); ctx.globalAlpha = 1 - p / 0.42;
      drawAngel(ctx, cx, cy + p * r * 0.8, r * (1 - p * 0.7), t, false);
      ctx.restore();
    }
    ctx.save(); ctx.translate(cx, cy); ctx.scale(scale, scale);
    var R = r * 1.5;
    circle(ctx, 0, 0, R, "#8a4fe0", "#4a2a86", 3);   // 大恶魔的头
    // 犄角
    ctx.fillStyle = "#4a2a86";
    ctx.beginPath(); ctx.moveTo(-R * 0.55, -R * 0.62); ctx.lineTo(-R * 0.9, -R * 1.25); ctx.lineTo(-R * 0.15, -R * 0.88); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(R * 0.55, -R * 0.62); ctx.lineTo(R * 0.9, -R * 1.25); ctx.lineTo(R * 0.15, -R * 0.88); ctx.closePath(); ctx.fill();
    // 得意的眯眼
    ctx.strokeStyle = "#2e1552"; ctx.lineWidth = Math.max(3, R * 0.11); ctx.lineCap = "round";
    [-1, 1].forEach(function (s) {
      ctx.beginPath(); ctx.arc(s * R * 0.34, -R * 0.16, R * 0.2, 1.15 * Math.PI, 1.85 * Math.PI); ctx.stroke();
    });
    // 大嘴:张开时是黑洞 + 尖牙,合上后是满足的弧线
    var mh = R * (0.15 + open * 0.85);
    ctx.fillStyle = "#2b0d3f";
    ctx.beginPath(); ctx.ellipse(0, R * 0.34, R * 0.62, mh, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#fff";
    for (var i = -2; i <= 2; i++) {
      var tx = i * R * 0.24;
      ctx.beginPath();
      ctx.moveTo(tx - R * 0.09, R * 0.34 - mh);
      ctx.lineTo(tx, R * 0.34 - mh + R * 0.26);
      ctx.lineTo(tx + R * 0.09, R * 0.34 - mh);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
    if (p > 0.55) {                                   // 吞完打个饱嗝
      ctx.save(); ctx.globalAlpha = Math.max(0, 1 - (p - 0.55) / 0.45);
      text(ctx, "BURP", cx + r * 1.9, cy - r * 1.6 - (p - 0.55) * r * 3, r * 0.95, "#ffe08a", "center", true);
      ctx.restore();
      drawStars(ctx, cx, cy, r * 1.4, p);
    }
  }

  function drawTangled(ctx, cx, cy, r, p, t) {
    // 自己缠住:天使晕头转向打转 + 星星
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(p * Math.PI * 3);
    drawAngel(ctx, 0, 0, r, t, false);
    ctx.restore();
    drawStars(ctx, cx, cy, r, p);
  }

  /* ---------- 过关庆祝演出 ---------- */

  var CONFETTI = ["#ffd24a", "#ff8fa3", "#7ec8ff", "#9ee493", "#c9a7ff", "#ffffff"];

  function drawRays(ctx, cx, cy, r, p, t) {           // 身后绽放的圣光
    var grow = Math.min(1, p / 0.35), fade = p > 0.8 ? 1 - (p - 0.8) / 0.2 : 1;
    ctx.save();
    ctx.globalAlpha = 0.5 * fade;
    ctx.translate(cx, cy);
    ctx.rotate(t * 0.6);
    ctx.fillStyle = "#ffe9a8";
    for (var i = 0; i < 12; i++) {
      ctx.rotate(Math.PI / 6);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(r * 0.55, -r * 9 * grow);
      ctx.lineTo(-r * 0.55, -r * 9 * grow);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
    ctx.save();
    ctx.globalAlpha = 0.75 * fade;
    var g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 4 * grow);
    g.addColorStop(0, "rgba(255,255,220,.95)");
    g.addColorStop(0.5, "rgba(255,226,140,.4)");
    g.addColorStop(1, "rgba(255,226,140,0)");
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cx, cy, r * 4 * grow, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function drawConfetti(ctx, w, h, p, seedN) {         // 从顶上飘落的彩纸
    ctx.save();
    for (var i = 0; i < seedN; i++) {
      var sx = ((i * 97) % 100) / 100 * w;
      var delay = ((i * 37) % 100) / 100 * 0.35;
      var q = p - delay;
      if (q <= 0) continue;
      var y = -20 + q * (h + 60) * (0.75 + ((i * 13) % 50) / 100);
      var x = sx + Math.sin(q * 6 + i) * 26;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(q * 9 + i);
      ctx.globalAlpha = Math.max(0, Math.min(1, 1.3 - q));
      ctx.fillStyle = CONFETTI[i % CONFETTI.length];
      ctx.fillRect(-5, -3.5, 10, 7);
      ctx.restore();
    }
    ctx.restore();
  }

  function drawCheer(ctx, C, st, w, h, top, px, r, t) {
    var p = Math.min(1, st.cheer.since / C.CHEER_MS);
    var cx = w / 2, cy = top + (h - top) * 0.42;

    ctx.fillStyle = "rgba(255,250,225," + (0.7 * Math.min(1, p / 0.25)) + ")";
    ctx.fillRect(0, top, w, h - top);

    drawRays(ctx, cx, cy, r, p, t);

    // 信徒围成一圈欢呼跳跃(从正下方起排,给天使和光环留出上方空间)
    var n = 7, R = r * 5.6;
    for (var i = 0; i < n; i++) {
      var a = Math.PI / 2 + i * Math.PI * 2 / n;
      var hop = Math.abs(Math.sin(t * 7 + i * 0.9)) * r * 0.75 * Math.min(1, p / 0.2);
      var bx = cx + Math.cos(a) * R, by = cy + Math.sin(a) * R * 0.66 + r * 0.6 - hop;
      var br = r * 0.8;
      // 欢呼举起的双手(小圆手,和场上信徒同一套画法,避免看成犄角)
      var wave = Math.sin(t * 9 + i) * br * 0.12;
      circle(ctx, bx - br * 0.9, by - br * 0.72 + wave, br * 0.26, "#ffdba8", "#e0b070", 1.5);
      circle(ctx, bx + br * 0.9, by - br * 0.72 - wave, br * 0.26, "#ffdba8", "#e0b070", 1.5);
      circle(ctx, bx, by, br, "#ffe8b8", "#dfb267", 2.5);
      face(ctx, bx, by, br, true);
    }

    // 天使腾空 + 欢喜蹦跳
    var rise = Math.min(1, p / 0.45) * r * 1.4;
    var bob = Math.sin(t * 6) * r * 0.18;
    drawAngel(ctx, cx, cy - rise + bob, r * 1.45, t * 1.6, false);

    drawConfetti(ctx, w, h, p, 34);

    // 弹出的大字
    if (p > 0.12) {
      var q = Math.min(1, (p - 0.12) / 0.22);
      var pop = q < 1 ? 0.4 + q * 0.75 : 1 + Math.sin((p - 0.34) * 9) * 0.04;
      ctx.save();
      ctx.translate(cx, top + (h - top) * 0.16);
      ctx.scale(pop, pop);
      ctx.rotate(-0.04);
      ctx.lineJoin = "round";
      ctx.strokeStyle = "#b26a00"; ctx.lineWidth = 7;
      ctx.font = 'bold 40px "Trebuchet MS", Verdana, sans-serif';
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.strokeText("WELL DONE!", 0, 0);
      ctx.fillStyle = "#ffd85e";
      ctx.fillText("WELL DONE!", 0, 0);
      ctx.restore();
      if (p > 0.4) {
        ctx.save();
        ctx.globalAlpha = Math.min(1, (p - 0.4) / 0.2);
        text(ctx, st.rescued + " believers brought home", cx, top + (h - top) * 0.26, 17, "#7a5a1e", "center", true);
        ctx.restore();
      }
    }
  }

  function drawDeath(ctx, C, st, cc, r, t) {
    var p = Math.min(1, st.death.since / C.DYING_MS);
    var at = cc(st.death.at), kind = st.death.kind;
    if (kind === "wall") drawSquashedAngel(ctx, at.x, at.y, r, p, st.death.hitDir || { x: 1, y: 0 });
    else if (kind === "demon") drawExplosion(ctx, at.x, at.y, r, p);
    else if (kind === "devour") drawDevour(ctx, at.x, at.y, r, p, t);
    else drawTangled(ctx, at.x, at.y, r, p, t);
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
    if (st.skill) {
      text(ctx, C.SKILLS[st.skill].name, w - 14, top / 2, 18, C.SKILLS[st.skill].dark, "right", true);
      drawSkillIcon(ctx, C, st.skill, w - 14 - ctx.measureText(C.SKILLS[st.skill].name).width - 16, top / 2, top * 0.26, t);
    } else if (C.hasSkills(st.level)) text(ctx, "Skill: —", w - 14, top / 2, 18, "#b0a488", "right");

    function cc(p) { return { x: p.x * px + px / 2, y: top + p.y * px + px / 2 }; }
    var r = px * 0.42;

    var cheering = st.mode === "cheering";
    if (st.pickup && !cheering) {
      var pk = cc(st.pickup);
      drawPickup(ctx, C, st.pickupSkill || "summon", pk.x, pk.y, r * 0.9, t);
    }
    if (!cheering) for (i = 0; i < st.believers.length; i++) { var b = cc(st.believers[i]); drawBeliever(ctx, b.x, b.y, r, t); }
    if (!cheering) for (i = 0; i < st.demons.length; i++) {
      var d = cc(st.demons[i]);
      drawDemon(ctx, d.x, d.y, r, t, false);
    }
    if (st.rival && !cheering) {
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
    if (!cheering) for (i = st.snake.length - 1; i >= 1; i--) { var s = cc(st.snake[i]); drawFollower(ctx, s.x, s.y, r * 0.88, i, ghost); }
    var hd = cc(st.snake[0]);
    if (C.effectActive(st, "shield")) {
      ctx.strokeStyle = "rgba(242,193,78,.85)"; ctx.lineWidth = 4;
      circle(ctx, hd.x, hd.y, r * 1.5 + Math.sin(t * 8) * 2, null, "rgba(242,193,78,.85)", 4);
    }
    if (st.mode === "dying") drawDeath(ctx, C, st, cc, r, t);
    else if (st.mode !== "cheering") drawAngel(ctx, hd.x, hd.y, r, t, ghost);

    if (st.mode === "cheering") drawCheer(ctx, C, st, w, h, top, px, r, t);

    // 技能按钮:有技能时脉冲发光,刚捡到时飘一行提示
    if (st.skill && st.mode === "play") {
      var btn = skillBtn(C, px);
      var sk0 = C.SKILLS[st.skill];
      var pulse = 0.5 + 0.5 * Math.sin(t * 5);
      ctx.strokeStyle = sk0.color; ctx.globalAlpha = 0.25 + 0.45 * pulse;
      circle(ctx, btn.x, btn.y, btn.r + 5 + 6 * pulse, null, sk0.color, 3 + 4 * pulse);
      ctx.globalAlpha = 1;
      circle(ctx, btn.x, btn.y, btn.r, "#fffdf2", sk0.dark, 3.5);
      drawSkillIcon(ctx, C, st.skill, btn.x, btn.y - btn.r * 0.22, btn.r * 0.5, t);
      text(ctx, sk0.name.toUpperCase(), btn.x, btn.y + btn.r * 0.58, btn.r * 0.3, sk0.dark, "center", true);

      var fresh = st.skillTick != null ? st.tickCount - st.skillTick : 99;
      if (fresh < 22) {                       // 刚捡到:气泡说明技能作用 + 两种操作方式
        var fade = fresh > 17 ? 1 - (fresh - 17) / 5 : 1;
        var bob = Math.sin(t * 6) * 4;
        var sk = C.SKILLS[st.skill];
        ctx.save(); ctx.globalAlpha = fade;
        var bw = Math.min(w - px * 0.8, px * 9), bh = px * 3.1;
        var bx0 = Math.max(px * 0.4, btn.x - bw + btn.r * 0.5);
        var by0 = btn.y - btn.r - bh - 18 + bob;
        ctx.fillStyle = "#fffdf2"; rr(ctx, bx0, by0, bw, bh, 12); ctx.fill();
        ctx.strokeStyle = sk.dark; ctx.lineWidth = 2.5; ctx.stroke();
        var mid = bx0 + bw / 2;
        drawSkillIcon(ctx, C, st.skill, bx0 + px * 0.85, by0 + bh * 0.26, px * 0.42, t);
        text(ctx, sk.name.toUpperCase(), mid + px * 0.5, by0 + bh * 0.24, px * 0.56, sk.dark, "center", true);
        text(ctx, sk.desc, mid, by0 + bh * 0.52, px * 0.42, "#7a6a4a");
        text(ctx, USE_HINT, mid, by0 + bh * 0.8, px * 0.46, "#3f7d5a", "center", true);
        ctx.fillStyle = sk.color; ctx.strokeStyle = sk.dark;
        ctx.beginPath();
        ctx.moveTo(btn.x, by0 + bh + 13); ctx.lineTo(btn.x - 8, by0 + bh + 1); ctx.lineTo(btn.x + 8, by0 + bh + 1);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.restore();
      }
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
      if (C.hasSkills(st.level)) lines.push("Grab the ⭐ for a skill — " + USE_HINT.toLowerCase());
      overlay(ctx, w, h, "Level " + st.level, lines, "Tap to set off");
    } else if (st.mode === "clear") {
      overlay(ctx, w, h, "Level Cleared!", ["Level " + st.level + " · " + st.rescued + " believers saved"],
        st.level >= C.MAX_LEVEL ? "All 50 levels cleared! Tap to replay" : "Tap for level " + (st.level + 1));
    } else if (st.mode === "dead") {
      overlay(ctx, w, h, "Oh no…", [st.deathMsg, "Saved " + st.rescued + " / " + C.quota(st.level)], "Tap to retry level " + st.level);
    }
  }

  return { HUD: HUD, canvasSize: canvasSize, skillBtn: skillBtn, draw: draw, setUseHint: setUseHint };
})();

if (typeof module !== "undefined") module.exports = Render;
