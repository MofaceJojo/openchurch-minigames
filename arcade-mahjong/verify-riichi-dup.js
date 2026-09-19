/* 回归测试：立直 tsumogiri 时，UI 呈现的"摸到的牌"必须和 core 认定的"摸到的牌"是同一张。
 *
 * 用户症状：立直后点"正确的那张牌"打不出去（牌直立着、点了只是换个选中态）。
 *
 * 根因 —— 两套"摸到的牌"定义：
 *   渲染侧：newTileIdx ← 摸牌动画 data.idx ← index.html findDrawnTile()（找**插入位置**）
 *   core 侧：st.lastDrawnTile（牌值）→ drawnTileOf / drawnTileIndex（indexOf 找**第一个**同值位置）
 * 摸到手里已有同值的牌（重复牌）时，插入位置 ≠ 第一个同值位置：
 *   hand = [0,0,4,8,...] 摸 0  →  插入位置 1，indexOf 位置 0
 * 于是渲染把索引 1 排在最右格（显示成"刚摸到的牌"），core 只接受索引 0 的牌，
 * declareRiichi 又把 selIdx 设在 0 → 点最右格时 selIdx(0) ≠ idx(1)，
 * 只是换了个选中态，牌纹丝不动 —— 玩家看到的就是"正确的那张牌打不出去"。
 *
 * 修复：渲染侧的"摸到的牌"索引一律来自 core 的权威值（render.js drawnRealIdxFromState）。
 *
 * 用法：node verify-riichi-dup.js
 *      AM_GAME_DIR=/tmp/am_old_browser node verify-riichi-dup.js   # 对旧代码跑（应有 FAIL）
 */
"use strict";

var puppeteer = require("puppeteer-core");
var path = require("path");
var fs = require("fs");
var vm = require("vm");

var GAME_DIR = process.env.AM_GAME_DIR || __dirname;
var GAME_URL = "file://" + path.join(GAME_DIR, "index.html");
var OUT_DIR = path.join(__dirname, "shots", "riichi-dup");
var CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
var PROFILE = "/tmp/chrome-mahjong-dup-" + Date.now();

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

/* 听 4s 的 13 张：1m..9m + 1s2s3s + 5s */
var TENPAI_13 = [0, 4, 8, 12, 16, 20, 24, 28, 32, 72, 76, 80, 88];

var fails = 0;
function ok(label, cond, extra) {
  console.log((cond ? "  PASS  " : "  FAIL  ") + label + (extra ? "  " + extra : ""));
  if (!cond) fails++;
}

async function setup(page, hand) {
  await page.evaluate(function (h) {
    var g = window.__game, st = g.st, C = g.Core;
    st.turn = 0;
    st.mode = "await_discard";
    st.riichi = [false, false];
    st.selIdx = -1;
    st.lastDrawnTile = null;
    st.hint = ""; st.hintT = 0; st.hintTile = -1;
    st.players[0].hand = h.slice();
    st.players[0].melds = [];
    st.players[0].discards = [];
    C.sortHand(st.players[0].hand);
  }, hand);
  await sleep(200);
}

async function draw(page, drawn) {
  await page.evaluate(function (d) {
    var g = window.__game, st = g.st, C = g.Core;
    st.players[0].hand.push(d);
    C.sortHand(st.players[0].hand);
    st.lastDrawnTile = d;
  }, drawn);
  await sleep(750); /* 等 400ms 摸牌动画走完 */
}

function snap(page) {
  return page.evaluate(function () {
    var g = window.__game, st = g.st, C = g.Core;
    var p = st.players[0];
    var order = g.Render.handDisplayOrder(st);
    var dr = order.length > 0 ? order[order.length - 1] : -1;
    return {
      hand: p.hand.slice(),
      order: order,
      rightSlotIdx: dr,                       /* UI 认为"摸到的牌"的真实索引 */
      rightSlotTile: dr >= 0 ? p.hand[dr] : null,
      coreDrawnIdx: C.drawnTileIndex(st, 0),  /* core 认为"摸到的牌"的真实索引 */
      coreDrawnTile: C.drawnTileOf(st, p),
      lastDrawnTile: st.lastDrawnTile,
      selIdx: st.selIdx,
      mode: st.mode,
      riichi: st.riichi[0],
      hint: st.hint,
      handLen: p.hand.length,
      disLen: p.discards.length
    };
  });
}

/* ============================================================
   第 0 段：纯 Node 不变量检查（不开浏览器，毫秒级）
   不变量：render.handDisplayOrder(st) 的最后一格，
           必须就是 core.drawnTileIndex(st, 0) —— 两边对"摸到的牌"只有一种定义。
   ============================================================ */
function nodeChecks() {
  console.log("--- 第 0 段：渲染顺序 vs core 权威（纯 Node） ---");
  var NodeCore = require(path.join(GAME_DIR, "core.js"));
  var sb = { Math: Math, console: console };
  vm.createContext(sb);
  vm.runInContext(fs.readFileSync(path.join(GAME_DIR, "render.js"), "utf8"), sb,
                  { filename: "render.js" });
  var R = sb.Render;
  if (!R || typeof R.handDisplayOrder !== "function") {
    ok("render.js 可在 Node 中加载并导出 handDisplayOrder", false);
    return;
  }
  ok("render.js 可在 Node 中加载并导出 handDisplayOrder", true);

  function mkState(hand, drawn) {
    return {
      lastDrawnTile: drawn,
      selIdx: -1, mode: "await_discard", turn: 0, riichi: [true, false],
      hint: "", hintT: 0, hintTile: -1,
      players: [{ hand: hand.slice(), melds: [], discards: [] },
                { hand: [], melds: [], discards: [] }]
    };
  }
  function isPermutation(order, n) {
    var s = order.slice().sort(function (a, b) { return a - b; }).join(",");
    var want = [];
    for (var i = 0; i < n; i++) want.push(i);
    return s === want.join(",");
  }
  function check(label, hand, drawn) {
    var st = mkState(hand, drawn);
    var order = R.handDisplayOrder(st);
    var last = order[order.length - 1];
    var coreIdx = NodeCore.drawnTileIndex(st, 0);
    ok(label + "：渲染最后一格 = core 的摸牌索引", last === coreIdx,
       "order=" + JSON.stringify(order) + " last=" + last + " core=" + coreIdx);
    ok(label + "：order 是 0.." + (hand.length - 1) + " 的排列",
       isPermutation(order, hand.length), JSON.stringify(order));
  }

  /* A. 摸到重复牌 —— 修复前插入位置(1) ≠ indexOf 位置(0) */
  check("A 摸到重复牌(手上有 1m 又摸 1m)",
        [0, 0, 4, 8, 12, 16, 20, 24, 28, 32, 72, 76, 80, 88], 0);
  /* B. 摸到非重复牌 —— 修复前后都一致（对照组，防止过度修复） */
  check("B 摸到非重复牌(手上没 1m 摸 1m)",
        [0, 4, 8, 12, 16, 20, 24, 28, 32, 36, 72, 76, 80, 88], 0);
  /* C. 摸到的是手里有三张的牌（暗刻上摸第四张） */
  check("C 摸到已有三张的牌",
        [4, 4, 4, 4, 8, 12, 16, 20, 24, 28, 32, 72, 76, 80], 4);
  /* D. 吃/碰之后没有摸牌（lastDrawnTile = null）→ 退回最后一张，且与 core 一致 */
  check("D 吃碰后无摸牌(lastDrawnTile=null)",
        [0, 4, 8, 12, 16, 20, 24, 28, 32, 72, 76], null);
}

async function run() {
  console.log("\n=== verify-riichi-dup · " + GAME_DIR + " ===\n");
  nodeChecks();
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

  await page.mouse.click(cx(180), cy(250));
  await sleep(500);
  var left = await page.evaluate(function () { return window.__game.st.donDenCount; });
  while (left > 0) {
    var li0 = await page.evaluate(function () { return window.__game.Render.layoutInfo(); });
    await page.mouse.click(cx(li0.DONDEN_SKIP_X + li0.DONDEN_SKIP_W / 2),
                           cy(li0.DONDEN_SKIP_Y + li0.DONDEN_SKIP_H / 2));
    await sleep(220);
    left = await page.evaluate(function () { return window.__game.st.donDenCount; });
  }

  var li = await page.evaluate(function () { return window.__game.Render.layoutInfo(); });
  console.log("layout: HAND_X=" + li.HAND_X + " HAND_Y=" + li.HAND_Y +
              " STRIDE=" + li.STRIDE + " TILE_H=" + li.TILE_H + "\n");
  function clickSlot(s) { return page.mouse.click(cx(li.HAND_X + s * li.STRIDE + 12),
                                                  cy(li.HAND_Y + li.TILE_H / 2)); }

  /* ============================================================
     用例 A：摸到一张**手里已有同值**的牌（重复牌）→ 两套定义必然分歧
     ============================================================ */
  console.log("--- 用例 A：摸到重复牌（摸 1m，手里已有 1m） ---");
  await setup(page, TENPAI_13);
  await draw(page, 0);                       /* 0 = 1m，已在手牌中 */
  var A = await snap(page);
  console.log("  hand          = " + JSON.stringify(A.hand));
  console.log("  order         = " + JSON.stringify(A.order));
  console.log("  UI  认为摸到  = idx " + A.rightSlotIdx + " (tile " + A.rightSlotTile + ")");
  console.log("  core认为摸到  = idx " + A.coreDrawnIdx + " (tile " + A.coreDrawnTile + ")");
  ok("1: 手牌 14 张", A.handLen === 14, "len=" + A.handLen);
  ok("1: 摸到的是 1m(0)", A.lastDrawnTile === 0, "lastDrawn=" + A.lastDrawnTile);
  ok("1[关键] UI 与 core 指向同一索引", A.rightSlotIdx === A.coreDrawnIdx,
     "UI=" + A.rightSlotIdx + " core=" + A.coreDrawnIdx);

  /* 立直 */
  await page.mouse.click(cx(li.RIICHI_BTN_X + li.RIICHI_BTN_W / 2),
                         cy(li.RIICHI_BTN_Y + li.RIICHI_BTN_H / 2));
  await sleep(250);
  var A2 = await snap(page);
  console.log("  立直后 selIdx = " + A2.selIdx + " (tile " + A.hand[A2.selIdx] + ")");
  ok("1: 立直成立", A2.riichi === true);
  ok("1: 立直后选中态落在摸到的那张牌上（值）",
     A.hand[A2.selIdx] === 0, "selTile=" + A.hand[A2.selIdx]);
  await page.screenshot({ path: path.join(OUT_DIR, "A1-after-riichi.png") });

  /* 点最右槽位（UI 呈现的"摸到的牌"）→ 期望一次点击就打出去 */
  var beforeA = A2.disLen;
  await clickSlot(13);
  await sleep(300);
  var A3 = await snap(page);
  console.log("  点最右槽位后：disLen=" + A3.disLen + " selIdx=" + A3.selIdx +
              " hint='" + A3.hint + "'");
  ok("1[关键] 点最右槽位（UI 的摸牌）一次就打出", A3.disLen === beforeA + 1,
     "disLen " + beforeA + " -> " + A3.disLen);
  await page.screenshot({ path: path.join(OUT_DIR, "A2-after-click-right.png") });

  /* 若没打出去，再点一次看是否卡死 */
  if (A3.disLen === beforeA) {
    await clickSlot(13);
    await sleep(300);
    var A4 = await snap(page);
    console.log("  再点一次：disLen=" + A4.disLen + " selIdx=" + A4.selIdx);
    ok("1[关键] 再点一次能打出", A4.disLen === beforeA + 1,
       "disLen " + beforeA + " -> " + A4.disLen);
  }

  /* ============================================================
     用例 2：摸到一张**手里没有**的牌（对照组，修复前后都应一致）
     ============================================================ */
  console.log("\n--- 用例 2：摸到非重复牌（摸 1m，手里没有 1m） ---");
  /* 13 张：2m..9m + 1s + 1s2s3s + 5s 的等价手牌，摸 1m（手里没有） */
  await setup(page, [4, 8, 12, 16, 20, 24, 28, 32, 36, 72, 76, 80, 88]);
  await draw(page, 0);
  var B = await snap(page);
  console.log("  hand          = " + JSON.stringify(B.hand));
  console.log("  order         = " + JSON.stringify(B.order));
  console.log("  UI  认为摸到  = idx " + B.rightSlotIdx + " (tile " + B.rightSlotTile + ")");
  console.log("  core认为摸到  = idx " + B.coreDrawnIdx + " (tile " + B.coreDrawnTile + ")");
  ok("B: UI 与 core 指向同一索引", B.rightSlotIdx === B.coreDrawnIdx,
     "UI=" + B.rightSlotIdx + " core=" + B.coreDrawnIdx);

  ok("no page errors", pageErrors.length === 0, pageErrors.join(" | "));

  await browser.close();
  console.log("\n=== " + (fails === 0 ? "ALL PASS" : fails + " FAILED") + " ===\n");
  process.exit(fails === 0 ? 0 : 1);
}

run().catch(function (e) {
  console.error("FATAL: " + (e && e.stack || e));
  process.exit(2);
});
