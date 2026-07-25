/* 牧者行列 · 微信小游戏入口。core.js / render.js 与网页版共用(从上级目录复制,见 README)。 */
"use strict";
var Core = require("./core.js");
var Render = require("./render.js");

var canvas = wx.createCanvas();
var ctx = canvas.getContext("2d");
var info = wx.getSystemInfoSync();
var dpr = Math.min(2, info.pixelRatio || 1);

var px = Math.floor(Math.min(
  info.windowWidth / Core.COLS,
  info.windowHeight / (Core.ROWS + Render.HUD)
));
var sz = Render.canvasSize(Core, px);
canvas.width = sz.w * dpr;
canvas.height = sz.h * dpr;
ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
var offX = (info.windowWidth - sz.w) / 2, offY = (info.windowHeight - sz.h) / 2;

var st = Core.create(+(wx.getStorageSync("shepherd-level") || 1));

var lastTick = 0, lastFrame = 0;
function loop(now) {
  var dt = lastFrame ? now - lastFrame : 16;
  lastFrame = now;
  if (st.mode === "play" && now - lastTick >= Core.tickMs(st.level)) {
    lastTick = now;
    Core.step(st);
    if (st.mode === "clear") wx.setStorageSync("shepherd-level", Math.min(st.level + 1, Core.MAX_LEVEL));
  }
  Core.tickDying(st, dt);
  Render.draw(ctx, Core, st, px, now / 1000);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

var touchStart = null;
wx.onTouchStart(function (e) {
  var t = e.touches[0];
  touchStart = { x: t.clientX - offX, y: t.clientY - offY };
});
wx.onTouchEnd(function (e) {
  if (!touchStart) return;
  var t = e.changedTouches[0];
  var x = t.clientX - offX, y = t.clientY - offY;
  var dx = x - touchStart.x, dy = y - touchStart.y;
  touchStart = null;
  if (Math.abs(dx) < 16 && Math.abs(dy) < 16) {
    if (st.mode !== "play") { Core.advance(st); lastTick = Date.now(); return; }
    var b = Render.skillBtn(Core, px);
    var d2 = (x - b.x) * (x - b.x) + (y - b.y) * (y - b.y);
    if (st.skill && d2 <= b.r * b.r * 1.7) Core.useSkill(st);
    return;
  }
  if (st.mode !== "play") return;
  var v = Math.abs(dx) > Math.abs(dy) ? [dx > 0 ? 1 : -1, 0] : [0, dy > 0 ? 1 : -1];
  Core.setDir(st, v[0], v[1]);
});
