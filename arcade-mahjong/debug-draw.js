/* 调试：抓摸牌瞬间的连续帧，定位"最左面多出一张牌" */
"use strict";

var puppeteer = require("puppeteer-core");
var path = require("path");
var fs = require("fs");

var GAME_URL = "file://" + path.join(__dirname, "index.html");
var OUT_DIR = path.join(__dirname, "shots", "drawframes");
var CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
var PROFILE = "/tmp/chrome-mahjong-draw-" + Date.now();

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

async function run() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  var browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox",
           "--user-data-dir=" + PROFILE, "--window-size=440,620", "--hide-scrollbars"]
  });
  var page = await browser.newPage();
  await page.setViewport({ width: 420, height: 620, deviceScaleFactor: 1 });
  page.on("pageerror", function (e) { console.log("[PAGE ERROR]", e.message); });

  await page.goto(GAME_URL, { waitUntil: "networkidle0" });
  await sleep(400);

  var cv = await page.$("#cv");
  var rect = await page.evaluate(function (el) {
    var r = el.getBoundingClientRect();
    return { x: r.left, y: r.top, w: r.width, h: r.height };
  }, cv);
  function cx(gx) { return rect.x + gx * (rect.w / 360); }
  function cy(gy) { return rect.y + gy * (rect.h / 500); }

  await page.mouse.click(cx(180), cy(250));
  await sleep(500);

  var left = await page.evaluate(function () { return window.__game.st.donDenCount; });
  while (left > 0) {
    var li = await page.evaluate(function () { return window.__game.Render.layoutInfo(); });
    await page.mouse.click(cx(li.DONDEN_SKIP_X + li.DONDEN_SKIP_W / 2),
                           cy(li.DONDEN_SKIP_Y + li.DONDEN_SKIP_H / 2));
    await sleep(220);
    left = await page.evaluate(function () { return window.__game.st.donDenCount; });
  }
  await sleep(900);

  /* 等到自己出牌 */
  for (var w = 0; w < 60; w++) {
    var mode = await page.evaluate(function () { return window.__game.st.mode; });
    if (mode === "await_discard") break;
    if (mode === "waiting_response") {
      await page.evaluate(function () { window.__game.Core.decline(window.__game.st); });
    }
    await sleep(250);
  }

  var st0 = await page.evaluate(function () {
    var s = window.__game.st;
    return { mode: s.mode, hand: s.players[0].hand.length };
  });
  console.log("before discard:", JSON.stringify(st0));

  /* 出牌 → 之后自己会再摸一张 */
  var li2 = await page.evaluate(function () { return window.__game.Render.layoutInfo(); });
  await page.mouse.click(cx(li2.HAND_X + 2), cy(li2.HAND_Y + 10));
  await sleep(120);
  await page.mouse.click(cx(li2.HAND_X + 2), cy(li2.HAND_Y + 10));

  /* 紧密轮询，检测到手牌变 14 立刻连拍 */
  var captured = 0, fired = false;
  for (var i = 0; i < 400; i++) {
    var h = await page.evaluate(function () { return window.__game.st.players[0].hand.length; });
    if (!fired && h === 14) {
      fired = true;
      console.log("draw detected at poll " + i);
      /* 连拍 18 帧 */
      for (var f = 0; f < 18; f++) {
        var dataUrl = await page.evaluate(function () {
          return document.getElementById("cv").toDataURL("image/png");
        });
        var b64 = dataUrl.split(",")[1];
        var name = "f" + String(f).padStart(2, "0") + ".png";
        fs.writeFileSync(path.join(OUT_DIR, name), Buffer.from(b64, "base64"));
        captured++;
        await sleep(25);
      }
      break;
    }
    await sleep(15);
  }

  console.log("captured " + captured + " frames -> " + OUT_DIR);
  await browser.close();
}

run().catch(function (e) { console.error(e); process.exit(1); });
