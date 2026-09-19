/* Screenshot helper: opens the game and captures menu, gameplay, action panel, win screen. */
"use strict";

var puppeteer = require("puppeteer-core");
var path = require("path");
var fs = require("fs");

var GAME_URL = "file://" + path.join(__dirname, "index.html");
var OUT_DIR = path.join(__dirname, "shots");

var CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
var PROFILE = "/tmp/chrome-mahjong-" + Date.now();

async function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

async function run() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  var browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: "new",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--user-data-dir=" + PROFILE,
      "--window-size=440,620",
      "--hide-scrollbars"
    ]
  });
  var page = await browser.newPage();
  await page.setViewport({ width: 420, height: 620, deviceScaleFactor: 2 });

  /* Capture console errors */
  page.on("console", function(msg) {
    if (msg.type() === "error") console.log("[CONSOLE ERROR]", msg.text());
  });
  page.on("pageerror", function(err) {
    console.log("[PAGE ERROR]", err.message);
  });

  await page.goto(GAME_URL, { waitUntil: "networkidle0" });
  await sleep(500);

  /* Check game loaded */
  var state = await page.evaluate(function() {
    return window.__game ? { mode: window.__game.st.mode, players: window.__game.st.players.length } : null;
  });
  console.log("Initial state:", JSON.stringify(state));

  // 1. Menu
  await page.screenshot({ path: path.join(OUT_DIR, "01-menu.png") });
  console.log("shot 01-menu");

  // Start game
  var cv = await page.$("#cv");
  var rect = await page.evaluate(function (el) {
    var r = el.getBoundingClientRect();
    return { x: r.left, y: r.top, w: r.width, h: r.height };
  }, cv);
  function cx(gameX) { return rect.x + gameX * (rect.w / 360); }
  function cy(gameY) { return rect.y + gameY * (rect.h / 500); }

  await page.mouse.click(cx(180), cy(250));
  await sleep(800);
  await page.screenshot({ path: path.join(OUT_DIR, "02-game-start.png") });
  console.log("shot 02-game-start");

  // Check current mode
  var mode1 = await page.evaluate(function () { return window.__game.st.mode; });
  console.log("mode after start:", mode1);

  // Don-Den: select tiles then exchange
  var li = await page.evaluate(function() { return window.__game.Render.layoutInfo(); });
  // Select 2 tiles
  await page.mouse.click(cx(li.HAND_X + 5 * li.STRIDE), cy(li.HAND_Y));
  await sleep(100);
  await page.mouse.click(cx(li.HAND_X + 10 * li.STRIDE), cy(li.HAND_Y));
  await sleep(200);
  await page.screenshot({ path: path.join(OUT_DIR, "03-donden-selected.png") });
  // Click EXCHANGE
  await page.mouse.click(cx(li.DONDEN_EXCH_X + li.DONDEN_EXCH_W/2), cy(li.DONDEN_EXCH_Y + li.DONDEN_EXCH_H/2));
  await sleep(600);
  // Skip remaining exchanges
  var dondenLeft = await page.evaluate(function() { return window.__game.st.donDenCount; });
  while (dondenLeft > 0) {
    var li2 = await page.evaluate(function() { return window.__game.Render.layoutInfo(); });
    await page.mouse.click(cx(li2.DONDEN_SKIP_X + li2.DONDEN_SKIP_W/2), cy(li2.DONDEN_SKIP_Y + li2.DONDEN_SKIP_H/2));
    await sleep(300);
    dondenLeft = await page.evaluate(function() { return window.__game.st.donDenCount; });
  }
  await sleep(1000);
  await page.screenshot({ path: path.join(OUT_DIR, "04-after-donden.png") });
  console.log("shot 03-donden-selected, 04-after-donden");

  // Play a few more moves
  for (var i = 0; i < 12; i++) {
    var mode = await page.evaluate(function () { return window.__game.st.mode; });
    if (mode === "round_over" || mode === "draw") break;
    if (mode === "await_discard") {
      // Discard middle tile
      await page.mouse.click(cx(150 + Math.random() * 80), cy(472));
      await sleep(200);
      await page.mouse.click(cx(150 + Math.random() * 80), cy(472));
      await sleep(1800);
    } else if (mode === "waiting_response") {
      // Skip via Core API (avoids button coordinate guesswork)
      await page.evaluate(function () { window.__game.Core.decline(window.__game.st); });
      await sleep(1500);
    } else if (mode === "await_hu_choice") {
      // Click HU button (centered, at y=391 game coords)
      await page.mouse.click(cx(180), cy(391));
      await sleep(800);
    } else {
      await sleep(500);
    }
  }

  await page.screenshot({ path: path.join(OUT_DIR, "05-mid-game.png") });
  console.log("shot 05-mid-game, mode=", mode);

  // Force win to test round_over screen
  await page.evaluate(function () {
    var st = window.__game.st;
    st.players[0].hand = [0,1,2,4,5,6,8,9,10,12,13,14,16,17];
    st.mode = "await_hu_choice";
  });
  await sleep(300);
  await page.screenshot({ path: path.join(OUT_DIR, "06-hu-panel.png") });
  console.log("shot 06-hu-panel");

  await page.mouse.click(cx(180), cy(391));
  await sleep(400);
  await page.screenshot({ path: path.join(OUT_DIR, "07-round-over.png") });
  console.log("shot 07-round-over");

  // Next round
  await page.mouse.click(cx(180), cy(365));
  await sleep(500);
  await page.screenshot({ path: path.join(OUT_DIR, "08-round-2.png") });
  console.log("shot 08-round-2");

  // Force CPU win
  await page.evaluate(function () {
    var st = window.__game.st;
    st.mode = "round_over";
    st.winInfo = { winner: 1, fan: 3, reasons: ["Shi An Kou (4 Concealed Pungs)", "Chii-iisuu (Full Flush)"], tile: 16, type: "draw" };
    st.players[1].hand = [16,17,18,20,21,22,24,25,26,28,29,30,16,17];
    st.msg = "CPU wins";
  });
  await sleep(400);
  await page.screenshot({ path: path.join(OUT_DIR, "09-cpu-win.png") });
  console.log("shot 09-cpu-win");

  // Test draw screen
  await page.evaluate(function () {
    var st = window.__game.st;
    st.mode = "draw";
  });
  await sleep(300);
  await page.screenshot({ path: path.join(OUT_DIR, "10-draw.png") });
  console.log("shot 10-draw");

  // CPU 和牌展示（ai_win）—— 亮出 CPU 手牌 + 和牌张 + 役种
  await page.evaluate(function () {
    var st = window.__game.st;
    st.players[1].hand = [0, 1, 2, 4, 5, 6, 8, 9, 10, 12, 13, 14, 16, 17];
    st.players[1].melds = [];
    st.winInfo = {
      winner: 1, fan: 6, type: "draw", tile: 17,
      reasons: ["Tanyao (All Simples)", "Iipeikou (Pure Double Chow)",
                "Pinfu (No-points Hand)", "Menzen Tsumo (Pure Hand Self-draw)"]
    };
    st.mode = "ai_win";
    st.aiTimer = 9999;
  });
  await sleep(300);
  await page.screenshot({ path: path.join(OUT_DIR, "11-cpu-win-reveal.png") });
  console.log("shot 11-cpu-win-reveal");

  await browser.close();
  console.log("\nAll screenshots saved to", OUT_DIR);
}

run().catch(function (e) { console.error(e); process.exit(1); });
