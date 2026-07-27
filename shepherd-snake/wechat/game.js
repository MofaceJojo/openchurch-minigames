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

var st = Core.create(+(wx.getStorageSync("shepherd-level") || 1),
                     wx.getStorageSync("shepherd-seen-skills") || {},
                     wx.getStorageSync("shepherd-diff"));
Render.setUseHint("Tap the button to use it", "Swipe or tap to continue");

var lastStepAt = 0, nextStepAt = 0, lastFrame = 0;

function doStep(now) {
  lastStepAt = now;
  nextStepAt = now + Core.currentTickMs(st);
  Core.step(st);
  if (st.mode === "cheering") wx.setStorageSync("shepherd-level", Math.min(st.level + 1, Core.MAX_LEVEL));
  if (st.mode === "skillIntro") wx.setStorageSync("shepherd-seen-skills", st.seenSkills);
}
function resetClock() { lastStepAt = Date.now(); nextStepAt = lastStepAt + Core.currentTickMs(st); }

/* 转向即刻响应:宁可早一点,绝不迟到 */
function turn(vx, vy) {
  if (st.mode !== "play") return;
  if (!Core.setDir(st, vx, vy)) return;
  var now = Date.now(), soonest = lastStepAt + Core.currentTickMs(st) * 0.5;
  if (now >= soonest) doStep(now);
  else nextStepAt = Math.min(nextStepAt, soonest);
}

function loop(now) {
  var dt = lastFrame ? now - lastFrame : 16;
  lastFrame = now;
  var ms = Date.now();
  if (st.mode === "play" && ms >= nextStepAt) doStep(ms);
  Core.tickDying(st, dt);
  Core.tickFx(st, dt);
  var span = nextStepAt - lastStepAt;
  Render.draw(ctx, Core, st, px, now / 1000, span > 0 ? (ms - lastStepAt) / span : 1);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

var touchStart = null;
wx.onTouchStart(function (e) {
  var t = e.touches[0];
  touchStart = { x: t.clientX - offX, y: t.clientY - offY };
});
wx.onTouchCancel(function () { touchStart = null; });
wx.onTouchEnd(function (e) {
  if (!touchStart) return;
  var t = e.changedTouches[0];
  var x = t.clientX - offX, y = t.clientY - offY;
  var dx = x - touchStart.x, dy = y - touchStart.y;
  touchStart = null;
  if (Math.abs(dx) < 16 && Math.abs(dy) < 16) {
    if (st.mode === "menu") {                      // 菜单页:难度按钮 / 关卡格子
      var dd = Render.diffPickerHit(Core, sz.w, sz.h, px, x, y);
      if (dd) { Core.setDifficulty(st, dd); wx.setStorageSync("shepherd-diff", dd); return; }
      var lv = Render.levelPickerHit(Core, sz.w, sz.h, px, x, y);
      if (lv) { Core.newLevel(st, lv); wx.setStorageSync("shepherd-level", lv); resetClock(); return; }
    }
    if (st.mode !== "play") { Core.advance(st); resetClock(); return; }
    var b = Render.skillBtn(Core, px);
    var d2 = (x - b.x) * (x - b.x) + (y - b.y) * (y - b.y);
    if (st.skill && d2 <= b.r * b.r * 1.7) Core.useSkill(st);
    return;
  }
  // 暂停画面滑动 = 继续并朝该方向走
  if (st.mode === "skillIntro" || st.mode === "intro") { Core.advance(st); resetClock(); }
  if (st.mode !== "play") return;
  var v = Math.abs(dx) > Math.abs(dy) ? [dx > 0 ? 1 : -1, 0] : [0, dy > 0 ? 1 : -1];
  turn(v[0], v[1]);
});
