/* 调试：hook canvas fillText，抓出 "undefined" / "NaN" 文字的调用来源 */
"use strict";

var puppeteer = require("puppeteer-core");
var path = require("path");

var GAME_URL = "file://" + path.join(__dirname, "index.html");
var CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
var PROFILE = "/tmp/chrome-mahjong-dbg-" + Date.now();

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

async function run() {
  var browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox",
           "--user-data-dir=" + PROFILE, "--window-size=440,620", "--hide-scrollbars"]
  });
  var page = await browser.newPage();
  await page.setViewport({ width: 420, height: 620, deviceScaleFactor: 2 });

  page.on("pageerror", function (e) { console.log("[PAGE ERROR]", e.message); });

  /* 注入 hook：任何 fillText 出现 undefined / NaN 都记录调用栈 */
  await page.evaluateOnNewDocument(function () {
    window.__hits = [];
    var orig = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (text) {
      var s = String(text);
      if (s.indexOf("undefined") >= 0 || s.indexOf("NaN") >= 0) {
        if (window.__hits.length < 40) {
          window.__hits.push({ text: s, stack: (new Error()).stack });
        }
      }
      return orig.apply(this, arguments);
    };
  });

  await page.goto(GAME_URL, { waitUntil: "networkidle0" });
  await sleep(400);

  var cv = await page.$("#cv");
  var rect = await page.evaluate(function (el) {
    var r = el.getBoundingClientRect();
    return { x: r.left, y: r.top, w: r.width, h: r.height };
  }, cv);
  function cx(gx) { return rect.x + gx * (rect.w / 360); }
  function cy(gy) { return rect.y + gy * (rect.h / 500); }

  /* 开始 */
  await page.mouse.click(cx(180), cy(250));
  await sleep(500);

  /* 跳过换牌 */
  var left = await page.evaluate(function () { return window.__game.st.donDenCount; });
  while (left > 0) {
    var li = await page.evaluate(function () { return window.__game.Render.layoutInfo(); });
    await page.mouse.click(cx(li.DONDEN_SKIP_X + li.DONDEN_SKIP_W / 2),
                           cy(li.DONDEN_SKIP_Y + li.DONDEN_SKIP_H / 2));
    await sleep(220);
    left = await page.evaluate(function () { return window.__game.st.donDenCount; });
  }

  /* 玩若干步，优先吃/碰以产生副露 */
  for (var step = 0; step < 80; step++) {
    var mode = await page.evaluate(function () { return window.__game.st.mode; });
    if (mode === "round_over" || mode === "draw") {
      await page.mouse.click(cx(180), cy(365));
      await sleep(400);
      continue;
    }
    if (mode === "waiting_response") {
      await page.evaluate(function () { window.__game.Core.chooseAction(window.__game.st, 0); });
      await sleep(300);
      continue;
    }
    if (mode === "await_hu_choice") {
      await page.evaluate(function () {
        var st = window.__game.st;
        window.__game.Core.passHu(st);
        window.__game.Core.discardTile(st, st.players[0].hand[0]);
      });
      await sleep(300);
      continue;
    }
    if (mode === "await_discard") {
      var li2 = await page.evaluate(function () { return window.__game.Render.layoutInfo(); });
      await page.mouse.click(cx(li2.HAND_X + 2), cy(li2.HAND_Y + 10));
      await sleep(120);
      await page.mouse.click(cx(li2.HAND_X + 2), cy(li2.HAND_Y + 10));
      await sleep(350);
      continue;
    }
    await sleep(250);
  }

  var hits = await page.evaluate(function () { return window.__hits; });
  console.log("\n=== fillText undefined/NaN hits: " + hits.length + " ===");
  var seen = {};
  for (var i = 0; i < hits.length; i++) {
    var lines = hits[i].stack.split("\n").slice(1, 5).join(" | ");
    var key = hits[i].text + "@@" + lines;
    if (seen[key]) continue;
    seen[key] = 1;
    console.log("\n[" + i + "] text=" + JSON.stringify(hits[i].text));
    console.log("    " + lines);
  }

  /* 顺带导出当前状态里的可疑数据 */
  var dump = await page.evaluate(function () {
    var st = window.__game.st;
    function scan(arr) {
      var bad = [];
      for (var i = 0; i < arr.length; i++) {
        var v = arr[i];
        if (v === undefined || v === null || (typeof v === "number" && isNaN(v))) bad.push(i + ":" + v);
      }
      return bad;
    }
    return {
      mode: st.mode,
      hand0: st.players[0].hand.length, hand1: st.players[1].hand.length,
      badHand0: scan(st.players[0].hand), badHand1: scan(st.players[1].hand),
      badDis0: scan(st.players[0].discards), badDis1: scan(st.players[1].discards),
      melds0: JSON.stringify(st.players[0].melds),
      melds1: JSON.stringify(st.players[1].melds),
      lastDiscard: JSON.stringify(st.lastDiscard),
      winInfo: JSON.stringify(st.winInfo)
    };
  });
  console.log("\n=== state ===");
  console.log(JSON.stringify(dump, null, 2));

  /* ---------- 防御测试：强制注入非法牌种类 ---------- */
  var beforeHits = await page.evaluate(function () { return window.__hits.length; });
  await page.evaluate(function () {
    var st = window.__game.st;
    st.mode = "await_discard";
    st.turn = 0;
    st.selIdx = -1;
    st.players[0].melds = [
      { type: "chi", tiles: [108, undefined, NaN] },  /* 全部非法 */
      { type: "peng", tiles: [999, 999, 999] }
    ];
    st.players[0].hand = [36, 40, 44, 48, 52, 56, 60, 64, 68, 72, 76, 80, 84];
    st.players[0].discards = [108];
  });
  await sleep(600);
  var afterHits = await page.evaluate(function () { return window.__hits.length; });
  console.log("\n[guard test] forced illegal kind/values -> new undefined hits: "
              + (afterHits - beforeHits) + "  (期望 0)");
  await page.screenshot({ path: path.join(__dirname, "shots", "d1-guard-test.png") });
  console.log("shot d1-guard-test");

  await browser.close();
}

run().catch(function (e) { console.error(e); process.exit(1); });
