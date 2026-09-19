/* verify-aiturn.js — 验证 CPU 回合真的"被展示出来"了
   回归目标：以前 CPU 的摸牌与打牌在同一帧内瞬间完成，玩家只看到结果。
   现在必须能观察到 draw → think → discard 三段，且补上了飞牌动画。

   跑法：NODE_PATH=<puppeteer-core 所在 node_modules> node verify-aiturn.js
*/
"use strict";

var puppeteer = require("puppeteer-core");
var path = require("path");
var fs = require("fs");

var GAME_URL = "file://" + path.join(__dirname, "index.html");
var OUT_DIR = path.join(__dirname, "shots", "aiturn");
var CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
var PROFILE = "/tmp/chrome-aiturn-" + Date.now();

var passed = 0, failed = 0;
function ok(name, cond, msg) {
  if (cond) { passed++; console.log("  PASS  " + name); }
  else { failed++; console.log("  FAIL  " + name + (msg ? "  — " + msg : "")); }
}
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

async function run() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  var browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox",
           "--user-data-dir=" + PROFILE, "--window-size=440,660", "--hide-scrollbars"]
  });
  var page = await browser.newPage();
  await page.setViewport({ width: 420, height: 660, deviceScaleFactor: 2 });

  var errors = [];
  page.on("pageerror", function (e) { errors.push(e.message); });
  page.on("console", function (m) { if (m.type() === "error") errors.push(m.text()); });

  await page.goto(GAME_URL, { waitUntil: "networkidle0" });
  await sleep(400);

  /* 记录所有动画调用 */
  await page.evaluate(function () {
    window.__animLog = [];
    var R = window.__game.Render;
    var orig = R.addAnim;
    R.addAnim = function (type, from, to, dur, data) {
      window.__animLog.push({ type: type, from: from, to: to, dur: dur,
                              tile: (data && data.tile) });
      return orig.apply(this, arguments);
    };
  });

  var cv = await page.$("#cv");
  var rect = await page.evaluate(function (el) {
    var r = el.getBoundingClientRect();
    return { x: r.left, y: r.top, w: r.width, h: r.height };
  }, cv);
  function cx(gx) { return rect.x + gx * (rect.w / 360); }
  function cy(gy) { return rect.y + gy * (rect.h / 500); }

  /* 开始一局 */
  await page.mouse.click(cx(180), cy(250));
  await sleep(600);

  /* 跳过三元换牌 */
  for (var s = 0; s < 6; s++) {
    var m = await page.evaluate(function () { return window.__game.st.mode; });
    if (m !== "await_donden") break;
    var li = await page.evaluate(function () { return window.__game.Render.layoutInfo(); });
    await page.mouse.click(cx(li.DONDEN_SKIP_X + li.DONDEN_SKIP_W / 2),
                           cy(li.DONDEN_SKIP_Y + li.DONDEN_SKIP_H / 2));
    await sleep(250);
  }

  /* 找一个"玩家打牌后确实轮到 CPU"的局面（避开 CPU 首巡荣和） */
  var found = false;
  for (var att = 0; att < 30 && !found; att++) {
    var mode = await page.evaluate(function () { return window.__game.st.mode; });
    if (mode === "await_discard") {
      await page.evaluate(function () { window.__animLog.length = 0; });
      /* 用 Core API 出牌，避免坐标误差 */
      await page.evaluate(function () {
        var g = window.__game;
        g.Core.discardTile(g.st, g.st.players[0].hand[0]);
      });
      await sleep(30);
      var m2 = await page.evaluate(function () { return window.__game.st.mode; });
      if (m2 === "ai_turn") found = true;
      else if (m2 === "round_over" || m2 === "ai_win" || m2 === "draw") {
        /* CPU 荣和了，开新局重来 */
        await page.evaluate(function () {
          var g = window.__game;
          g.st.mode = "round_over";
          g.Core.advance(g.st);
        });
        await sleep(400);
        for (var s2 = 0; s2 < 6; s2++) {
          var m3 = await page.evaluate(function () { return window.__game.st.mode; });
          if (m3 !== "await_donden") break;
          var li2 = await page.evaluate(function () { return window.__game.Render.layoutInfo(); });
          await page.mouse.click(cx(li2.DONDEN_SKIP_X + li2.DONDEN_SKIP_W / 2),
                                 cy(li2.DONDEN_SKIP_Y + li2.DONDEN_SKIP_H / 2));
          await sleep(250);
        }
      }
    } else if (mode === "waiting_response") {
      await page.evaluate(function () {
        var g = window.__game; g.Core.decline(g.st);
      });
      await sleep(300);
    } else if (mode === "await_hu_choice") {
      await page.evaluate(function () {
        var g = window.__game; g.Core.passHu(g.st);
      });
      await sleep(200);
    } else {
      await sleep(200);
    }
  }
  ok("reached a real CPU turn", found);

  if (found) {
    /* 高频采样 CPU 回合的 phase 变化 */
    var phases = [];
    var cpuHandLens = [];
    var t0 = Date.now();
    var shotDraw = false, shotThink = false, shotAfter = false;
    while (Date.now() - t0 < 2600) {
      var snap = await page.evaluate(function () {
        var g = window.__game;
        return { mode: g.st.mode, phase: g.st.aiPhase, timer: g.st.aiTimer,
                 cpuHand: g.st.players[1].hand.length,
                 cpuDis: g.st.players[1].discards.length };
      });
      if (phases.indexOf(snap.phase) < 0) phases.push(snap.phase);
      if (cpuHandLens.indexOf(snap.cpuHand) < 0) cpuHandLens.push(snap.cpuHand);

      if (!shotDraw && snap.mode === "ai_turn" && snap.phase === "draw") {
        await page.screenshot({ path: path.join(OUT_DIR, "1-draw.png") });
        shotDraw = true;
      }
      if (!shotThink && snap.mode === "ai_turn" && snap.phase === "think") {
        await page.screenshot({ path: path.join(OUT_DIR, "2-think.png") });
        shotThink = true;
      }
      if (snap.mode !== "ai_turn" && shotThink && !shotAfter) {
        await page.screenshot({ path: path.join(OUT_DIR, "3-after.png") });
        shotAfter = true;
      }
      if (snap.mode !== "ai_turn" && snap.mode !== "ai_win") break;
      await sleep(25);
    }

    console.log("       phases seen :", JSON.stringify(phases));
    console.log("       cpu hand    :", JSON.stringify(cpuHandLens));

    ok("CPU turn shows a 'draw' phase", phases.indexOf("draw") >= 0);
    ok("CPU turn shows a 'think' phase", phases.indexOf("think") >= 0);

    var log = await page.evaluate(function () { return window.__animLog; });
    var types = log.map(function (a) { return a.type; });
    console.log("       anims fired :", JSON.stringify(types));

    ok("aiDraw animation was fired", types.indexOf("aiDraw") >= 0, JSON.stringify(types));
    ok("aiDiscard animation was fired", types.indexOf("aiDiscard") >= 0, JSON.stringify(types));

    var drawAnim = log.filter(function (a) { return a.type === "aiDraw"; })[0];
    if (drawAnim) {
      ok("aiDraw starts at the wall", drawAnim.from[0] === 180, JSON.stringify(drawAnim.from));
      ok("aiDraw flies to the CPU hand row", drawAnim.to[1] > 40 && drawAnim.to[1] < 80,
         "to=" + JSON.stringify(drawAnim.to));
    }
    var liNow = await page.evaluate(function () { return window.__game.Render.layoutInfo(); });
    var disAnim = log.filter(function (a) { return a.type === "aiDiscard"; })[0];
    if (disAnim) {
      ok("aiDiscard starts at the CPU hand row",
         Math.abs(disAnim.from[1] - liNow.CPU_HAND_Y) < 1,
         "from.y=" + disAnim.from[1] + " expect " + liNow.CPU_HAND_Y);
      /* 期望落点从 layoutInfo 的数值常量算，别写死数字。
         第一张弃牌 = 第 0 行第 0 列。 */
      ok("aiDiscard lands in the CPU discard row",
         Math.abs(disAnim.to[1] - liNow.CPU_DIS_Y) < 1 &&
         Math.abs(disAnim.to[0] - liNow.CPU_DIS_X0) < 1,
         "to=" + JSON.stringify(disAnim.to) +
         " expect=[" + liNow.CPU_DIS_X0 + "," + liNow.CPU_DIS_Y + "]");
    }

    ok("captured a mid-draw screenshot", shotDraw);
    ok("captured a mid-think screenshot", shotThink);
  }

  ok("no page errors", errors.length === 0, errors.join(" | "));

  await browser.close();
  console.log("\n=== verify-aiturn: " + passed + " passed, " + failed + " failed ===\n");
  if (failed > 0) process.exit(1);
}

run().catch(function (e) { console.error(e); process.exit(1); });
