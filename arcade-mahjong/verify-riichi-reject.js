/* 回归测试：立直后"牌直立着但怎么点都打不出去"
 *
 * 用户症状（截图）：手里有一张牌抬起来（选中态），但点它没反应，看起来卡住了。
 *
 * 复现路径：
 *   1. 玩家先点一张牌 → 它抬起（选中态）
 *   2. 玩家按 Riichi! 按钮 → 立直成立，但那张牌仍然是选中态
 *   3. 立直后只能打"刚摸到的那张牌" → 点那张抬起的牌 → core 直接 return false
 *   4. UI 拿到 false 什么也不做（还先把 selIdx 清了）→ 完全静默
 *
 * 修复后期望：
 *   - declareRiichi 把选中态挪到摸到的那张牌上（抬起的那张一定可打）
 *   - 点非法牌 → 拒绝音效 + 文字提示（st.hint）+ 选中态回到摸到的牌
 *   - 点摸到的牌 → 正常打出去
 *
 * 旧代码下 "点击非摸牌后应出现提示" / "选中态应停在摸到的牌上" 会失败。
 *
 * 用法：node verify-riichi-reject.js
 *      AM_GAME_DIR=/tmp/am_old_browser node verify-riichi-reject.js   # 对旧代码跑
 */
"use strict";

var puppeteer = require("puppeteer-core");
var path = require("path");
var fs = require("fs");

var GAME_DIR = process.env.AM_GAME_DIR || __dirname;
var GAME_URL = "file://" + path.join(GAME_DIR, "index.html");
var OUT_DIR = path.join(__dirname, "shots", "riichi-reject");
var CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
var PROFILE = "/tmp/chrome-mahjong-riichi-" + Date.now();

/* 听 5筒 的 13 张手牌；摸到 1万（排序后落在 index 1，不在最后一位） */
var TENPAI_13 = [0, 4, 8, 12, 16, 20, 24, 28, 32, 72, 76, 80, 88];
var DRAWN = 1;

var fails = 0;
function ok(label, cond, extra) {
  console.log((cond ? "  PASS  " : "  FAIL  ") + label + (extra ? "  " + extra : ""));
  if (!cond) fails++;
}
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

async function run() {
  console.log("\n=== verify-riichi-reject · " + GAME_DIR + " ===\n");
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  var browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox",
           "--user-data-dir=" + PROFILE, "--window-size=440,700", "--hide-scrollbars"]
  });
  var page = await browser.newPage();
  await page.setViewport({ width: 420, height: 700, deviceScaleFactor: 1 });
  var pageErrors = [];
  page.on("pageerror", function (e) { pageErrors.push(e.message); });

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
  await sleep(500);

  /* 跳过所有换牌 */
  var left = await page.evaluate(function () { return window.__game.st.donDenCount; });
  while (left > 0) {
    var li0 = await page.evaluate(function () { return window.__game.Render.layoutInfo(); });
    await page.mouse.click(cx(li0.DONDEN_SKIP_X + li0.DONDEN_SKIP_W / 2),
                           cy(li0.DONDEN_SKIP_Y + li0.DONDEN_SKIP_H / 2));
    await sleep(220);
    left = await page.evaluate(function () { return window.__game.st.donDenCount; });
  }

  /* 等轮到自己出牌 */
  var mode = "";
  for (var w = 0; w < 120; w++) {
    mode = await page.evaluate(function () { return window.__game.st.mode; });
    if (mode === "await_discard") break;
    await sleep(120);
  }
  ok("reached await_discard", mode === "await_discard", "mode=" + mode);

  /* ---- 构造确定性局面：先摆 13 张，隔几帧再摸进第 14 张 ----
     分两步是为了让游戏循环真的触发一次"摸牌动画"，
     newTileIdx 才会被正确设成摸到那张牌的**真实索引**（不是最后一位）。 */
  await page.evaluate(function (hand) {
    var g = window.__game, st = g.st, C = g.Core;
    st.turn = 0;
    st.mode = "await_discard";
    st.riichi = [false, false];
    st.selIdx = -1;
    st.lastDrawnTile = null;
    st.hint = ""; st.hintT = 0; st.hintTile = -1;
    st.players[0].hand = hand.slice();
    st.players[0].melds = [];
    st.players[0].discards = [];
    C.sortHand(st.players[0].hand);
  }, TENPAI_13);
  await sleep(200);
  await page.evaluate(function (drawn) {
    var g = window.__game, st = g.st, C = g.Core;
    st.players[0].hand.push(drawn);
    C.sortHand(st.players[0].hand);
    st.lastDrawnTile = drawn;
  }, DRAWN);
  await sleep(750);   /* 等摸牌动画（400ms）走完 */

  var setup = await page.evaluate(function () {
    var g = window.__game, st = g.st;
    return { hand: st.players[0].hand.slice(), order: g.Render.handDisplayOrder(st) };
  });
  ok("hand has 14 tiles", setup.hand.length === 14, "len=" + setup.hand.length);
  ok("drawn tile is NOT at the last real index",
     setup.hand[setup.hand.length - 1] !== DRAWN, "hand=" + JSON.stringify(setup.hand));
  ok("drawn tile is displayed at the rightmost slot",
     setup.order[setup.order.length - 1] === setup.hand.indexOf(DRAWN),
     "order=" + JSON.stringify(setup.order));

  /* ---- 步骤 1：玩家先选中一张**非摸牌**（模拟"先选牌再按立直"） ---- */
  var SLOT_NONDRAWN = 0;                      /* 槽位 0 = 真实索引 0 = 1万 */
  await page.mouse.click(cx(5 + SLOT_NONDRAWN * 25 + 12), cy(454 + 17));
  await sleep(150);
  var s1 = await page.evaluate(function () {
    var st = window.__game.st;
    return { selIdx: st.selIdx, selTile: st.players[0].hand[st.selIdx] };
  });
  ok("tap selects the non-drawn tile", s1.selTile === 0, "selTile=" + s1.selTile);

  /* ---- 步骤 2：按 Riichi! 按钮 ---- */
  var li = await page.evaluate(function () { return window.__game.Render.layoutInfo(); });
  await page.mouse.click(cx(li.RIICHI_BTN_X + li.RIICHI_BTN_W / 2),
                         cy(li.RIICHI_BTN_Y + li.RIICHI_BTN_H / 2));
  await sleep(200);
  var s2 = await page.evaluate(function () {
    var g = window.__game, st = g.st;
    return {
      riichi: st.riichi[0],
      selIdx: st.selIdx,
      selTile: st.players[0].hand[st.selIdx],
      hint: st.hint, hintT: st.hintT,
      handLen: st.players[0].hand.length
    };
  });
  ok("riichi is declared", s2.riichi === true);
  ok("after riichi the selection moved onto the DRAWN tile",
     s2.selTile === DRAWN, "selTile=" + s2.selTile + " (expect " + DRAWN + ")");
  ok("declaring riichi shows a hint",
     s2.hint.length > 0 && s2.hintT > 0, "hint='" + s2.hint + "'");
  ok("hand still has 14 tiles", s2.handLen === 14, "len=" + s2.handLen);
  await page.screenshot({ path: path.join(OUT_DIR, "1-after-riichi.png") });

  /* ---- 步骤 3：点那张**非摸牌** → 必须被拒绝，且必须给出反馈 ---- */
  var before = await page.evaluate(function () {
    var st = window.__game.st;
    return { handLen: st.players[0].hand.length, disLen: st.players[0].discards.length };
  });
  await page.mouse.click(cx(5 + SLOT_NONDRAWN * 25 + 12), cy(454 + 17));
  await sleep(250);
  var s3 = await page.evaluate(function () {
    var g = window.__game, st = g.st;
    return {
      handLen: st.players[0].hand.length,
      disLen: st.players[0].discards.length,
      selIdx: st.selIdx,
      selTile: st.players[0].hand[st.selIdx],
      hint: st.hint, hintT: st.hintT, hintTile: st.hintTile,
      mode: st.mode
    };
  });
  ok("illegal discard did NOT leave the hand", s3.handLen === before.handLen,
     "len=" + s3.handLen);
  ok("illegal discard did NOT reach the discard pile", s3.disLen === before.disLen);
  ok("illegal discard does NOT silently no-op — a hint is shown",
     s3.hint.length > 0 && s3.hintT > 0, "hint='" + s3.hint + "'");
  ok("hint points at the drawn tile",
     s3.hintTile === s3.selIdx, "hintTile=" + s3.hintTile + " selIdx=" + s3.selIdx);
  ok("selection snaps back onto the drawn tile (tile that stands up is always playable)",
     s3.selTile === DRAWN, "selTile=" + s3.selTile);
  ok("still the player's turn", s3.mode === "await_discard", "mode=" + s3.mode);
  await page.screenshot({ path: path.join(OUT_DIR, "2-rejected-with-hint.png") });

  /* ---- 步骤 4：点摸到的那张（显示在最右槽位）→ 应该打出去 ---- */
  var SLOT_DRAWN = s3.selIdx >= 0 ? 13 : 13;
  await page.mouse.click(cx(5 + SLOT_DRAWN * 25 + 12), cy(454 + 17));
  await sleep(400);
  var s4 = await page.evaluate(function () {
    var st = window.__game.st;
    return {
      handLen: st.players[0].hand.length,
      disLen: st.players[0].discards.length,
      lastDiscard: st.players[0].discards[st.players[0].discards.length - 1]
    };
  });
  ok("tapping the drawn tile DOES discard it", s4.disLen === before.disLen + 1,
     "disLen=" + s4.disLen);
  ok("the discarded tile is the drawn tile", s4.lastDiscard === DRAWN,
     "tile=" + s4.lastDiscard);
  ok("hand is back to 13 tiles", s4.handLen === 13, "len=" + s4.handLen);
  await page.screenshot({ path: path.join(OUT_DIR, "3-after-discard.png") });

  ok("no page errors", pageErrors.length === 0, pageErrors.join(" | "));

  await browser.close();
  console.log("\n=== " + (fails === 0 ? "ALL PASS" : fails + " FAILED") + " ===\n");
  process.exit(fails === 0 ? 0 : 1);
}

run().catch(function (e) {
  console.error("FATAL: " + (e && e.stack || e));
  process.exit(2);
});
