/* 验证：
   A) Don-Den 换牌动画中牌面正确渲染（不再出现 "undefined"）
   B) 出牌后不留残影（动画按时结束）
   运行：node verify-discard.js  */
"use strict";

var puppeteer = require("puppeteer-core");
var path = require("path");
var fs = require("fs");

var GAME_URL = "file://" + path.join(__dirname, "index.html");
var OUT_DIR = path.join(__dirname, "shots");
var CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
var PROFILE = "/tmp/chrome-mahjong-verify-" + Date.now();

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
  await page.setViewport({ width: 420, height: 620, deviceScaleFactor: 2 });

  page.on("console", function (m) { if (m.type() === "error") console.log("[CONSOLE ERROR]", m.text()); });
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

  /* 开始游戏 */
  await page.mouse.click(cx(180), cy(250));
  await sleep(600);

  /* ---------- A) Don-Den 换牌动画 ---------- */
  var li = await page.evaluate(function () { return window.__game.Render.layoutInfo(); });
  /* 选中两张牌 */
  await page.mouse.click(cx(li.HAND_X + 5 * li.STRIDE), cy(li.HAND_Y + 10));
  await sleep(80);
  await page.mouse.click(cx(li.HAND_X + 9 * li.STRIDE), cy(li.HAND_Y + 10));
  await sleep(120);
  /* 点 EXCHANGE 触发 donden 动画 */
  await page.mouse.click(cx(li.DONDEN_EXCH_X + li.DONDEN_EXCH_W / 2),
                         cy(li.DONDEN_EXCH_Y + li.DONDEN_EXCH_H / 2));
  await sleep(140);   /* 动画进行中（300ms 的一半左右） */
  await page.screenshot({ path: path.join(OUT_DIR, "a1-donden-mid-anim.png") });
  console.log("shot a1-donden-mid-anim (during exchange animation)");

  await sleep(900);   /* 动画应已结束 */
  await page.screenshot({ path: path.join(OUT_DIR, "a2-donden-done.png") });
  console.log("shot a2-donden-done");

  /* 跳过剩余换牌 */
  var left = await page.evaluate(function () { return window.__game.st.donDenCount; });
  while (left > 0) {
    var li2 = await page.evaluate(function () { return window.__game.Render.layoutInfo(); });
    await page.mouse.click(cx(li2.DONDEN_SKIP_X + li2.DONDEN_SKIP_W / 2),
                           cy(li2.DONDEN_SKIP_Y + li2.DONDEN_SKIP_H / 2));
    await sleep(250);
    left = await page.evaluate(function () { return window.__game.st.donDenCount; });
  }
  await sleep(800);

  /* 等到轮到自己出牌 */
  for (var w = 0; w < 40; w++) {
    var mode = await page.evaluate(function () { return window.__game.st.mode; });
    if (mode === "await_discard") break;
    if (mode === "waiting_response") {
      await page.evaluate(function () { window.__game.Core.decline(window.__game.st); });
    }
    await sleep(300);
  }

  var before = await page.evaluate(function () {
    var st = window.__game.st;
    return { mode: st.mode, hand: st.players[0].hand.length, dis: st.players[0].discards.length };
  });
  console.log("before discard:", JSON.stringify(before));

  /* ---------- B) 出牌后无残影 ---------- */
  var li3 = await page.evaluate(function () { return window.__game.Render.layoutInfo(); });
  await page.mouse.click(cx(li3.HAND_X + 2), cy(li3.HAND_Y + 10));
  await sleep(150);
  await page.mouse.click(cx(li3.HAND_X + 2), cy(li3.HAND_Y + 10));
  await sleep(120);
  await page.screenshot({ path: path.join(OUT_DIR, "b1-just-after-discard.png") });

  await sleep(1500);
  await page.screenshot({ path: path.join(OUT_DIR, "b2-after-1500ms.png") });

  var after = await page.evaluate(function () {
    var st = window.__game.st;
    return { mode: st.mode, hand: st.players[0].hand.length, dis: st.players[0].discards.length };
  });
  console.log("after  discard:", JSON.stringify(after));

  /* ---------- C) 吃牌显示顺序（应为升序 1万 2万 3万） ---------- */
  await page.evaluate(function () {
    var st = window.__game.st;
    st.mode = "await_discard";
    st.turn = 0;
    st.selIdx = -1;
    st.players[0].melds = [
      { type: "chi",  tiles: [0, 1, 2] },   /* 1万 2万 3万 */
      { type: "peng", tiles: [9, 9, 9] }    /* 1条 x3 */
    ];
    st.players[0].hand = [36, 40, 44, 48, 52, 56, 60, 64, 68, 72];
    st.players[0].discards = [];
    st.players[1].discards = [];
  });
  await sleep(400);
  await page.screenshot({ path: path.join(OUT_DIR, "c1-meld-order.png") });
  console.log("shot c1-meld-order (expect chi 1万2万3万 ascending)");

  await browser.close();
  console.log("\nSaved a1/a2/b1/b2 to", OUT_DIR);
}

run().catch(function (e) { console.error(e); process.exit(1); });
