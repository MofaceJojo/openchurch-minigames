/* 分歧探测器：UI 认定的"摸到的牌" vs core 认定的"摸到的牌"
 *
 * UI 侧：Render.handDisplayOrder(st) 的最后一个元素（渲染层私有变量 newTileIdx 驱动）
 * core 侧：Core.drawnTileOf(st, p)（st.lastDrawnTile 驱动）
 *
 * 两者不一致时：UI 把牌 X 高亮在"摸牌位"，但 core 只允许打牌 Y →
 * 玩家点 X 被拒、点 Y 又找不到（没有任何标记），看起来就是"打不出去"。
 *
 * 用法：node debug-drawn-mismatch.js
 */
"use strict";

var puppeteer = require("puppeteer-core");
var path = require("path");
var GAME_DIR = process.env.AM_GAME_DIR || __dirname;
var GAME_URL = "file://" + path.join(GAME_DIR, "index.html");
var CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
var OUT = path.join(__dirname, "shots", "drawn-mismatch");
var fs = require("fs");

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

async function run() {
  if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });
  var browser = await puppeteer.launch({
    executablePath: CHROME, headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox",
           "--user-data-dir=/tmp/chrome-mm-" + Date.now(),
           "--window-size=440,700", "--hide-scrollbars"]
  });
  var page = await browser.newPage();
  await page.setViewport({ width: 420, height: 700, deviceScaleFactor: 1 });
  await page.goto(GAME_URL, { waitUntil: "networkidle0" });
  await sleep(400);

  var cv = await page.$("#cv");
  var rect = await page.evaluate(function (el) {
    var r = el.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height };
  }, cv);
  function cx(g) { return rect.x + g * (rect.w / 360); }
  function cy(g) { return rect.y + g * (rect.h / 500); }

  function snap() {
    return page.evaluate(function () {
      var g = window.__game, st = g.st, C = g.Core, R = g.Render;
      var hand = st.players[0].hand;
      var order = R.handDisplayOrder(st);
      var uiIdx = order.length ? order[order.length - 1] : -1;
      var coreIdx = C.drawnTileIndex(st, 0);
      return {
        mode: st.mode, turn: st.turn, riichi: st.riichi[0],
        round: st.round, deck: st.deck.length,
        lastDrawn: st.lastDrawnTile,
        hand: hand.slice(),
        order: order,
        uiIdx: uiIdx, uiTile: hand[uiIdx],
        coreIdx: coreIdx, coreTile: hand[coreIdx],
        drawnTileOf: C.drawnTileOf(st, st.players[0]),
        selIdx: st.selIdx, hint: st.hint, hintTile: st.hintTile,
        disLen: st.players[0].discards.length,
        donDen: st.donDenCount,
        options: st.options ? st.options.length : 0
      };
    });
  }

  function slotOf(order, realIdx) { return order.indexOf(realIdx); }
  async function clickSlot(slot) {
    await page.mouse.click(cx(5 + slot * 25 + 12), cy(454 + 17));
  }
  async function clickRiichi() {
    var li = await page.evaluate(function () { return window.__game.Render.layoutInfo(); });
    await page.mouse.click(cx(li.RIICHI_BTN_X + li.RIICHI_BTN_W / 2),
                           cy(li.RIICHI_BTN_Y + li.RIICHI_BTN_H / 2));
  }
  async function clickSkip() {
    var li = await page.evaluate(function () { return window.__game.Render.layoutInfo(); });
    await page.mouse.click(cx(li.DONDEN_SKIP_X + li.DONDEN_SKIP_W / 2),
                           cy(li.DONDEN_SKIP_Y + li.DONDEN_SKIP_H / 2));
  }

  var mismatches = [];
  var stuck = [];
  var riichiTurns = 0;
  var shots = 0;

  await page.mouse.click(cx(180), cy(250));
  await sleep(500);

  for (var step = 0; step < 2600; step++) {
    var s = await snap();

    /* 每一帧都查一次分歧（不管什么模式） */
    if (s.mode !== "menu" && s.uiTile !== undefined && s.coreTile !== undefined &&
        s.uiTile !== s.coreTile) {
      var key = s.mode + "|" + s.uiTile + "|" + s.coreTile;
      var seen = mismatches.some(function (m) { return m.key === key && m.round === s.round; });
      if (!seen) {
        mismatches.push({
          key: key, round: s.round, mode: s.mode, riichi: s.riichi,
          uiIdx: s.uiIdx, uiTile: s.uiTile, coreIdx: s.coreIdx, coreTile: s.coreTile,
          lastDrawn: s.lastDrawn, order: s.order, hand: s.hand, deck: s.deck
        });
        console.log("\n!! 分歧 @round" + s.round + " mode=" + s.mode + " riichi=" + s.riichi);
        console.log("   UI  : idx=" + s.uiIdx + " tile=" + s.uiTile + " (order=" + JSON.stringify(s.order) + ")");
        console.log("   core: idx=" + s.coreIdx + " tile=" + s.coreTile + " lastDrawn=" + s.lastDrawn);
        console.log("   hand: " + JSON.stringify(s.hand));
        if (shots < 3) {
          await page.screenshot({ path: path.join(OUT, "mismatch-" + (++shots) + ".png") });
        }
      }
    }

    if (s.mode === "menu" || s.mode === "round_over" || s.mode === "draw") {
      await page.mouse.click(cx(180), cy(250)); await sleep(260); continue;
    }
    if (s.mode === "ai_win") { await page.mouse.click(cx(180), cy(250)); await sleep(120); continue; }
    if (s.mode === "await_donden") { await clickSkip(); await sleep(200); continue; }
    if (s.mode === "waiting_response") {
      var li = await page.evaluate(function () { return window.__game.Render.layoutInfo(); });
      await page.mouse.click(cx(li.PANEL_BTN_Y + 14 + 200), cy(li.PANEL_BTN_Y + 14));
      await sleep(150);
      /* 面板 SKIP 按钮位置：按选项数算，简化用键盘兜底 */
      await page.evaluate(function () { window.__game.Core.decline(window.__game.st); });
      await sleep(120);
      continue;
    }
    if (s.mode === "await_hu_choice") {
      /* 直接放弃胡、改出牌，走和玩家一样的路径 */
      var li2 = await page.evaluate(function () { return window.__game.Render.layoutInfo(); });
      await page.mouse.click(cx(li2.HU_BTN_X + li2.HU_BTN_W / 2), cy(li2.HU_BTN_Y + li2.HU_BTN_H / 2));
      await sleep(200);
      continue;
    }
    if (s.mode === "ai_turn") { await sleep(80); continue; }

    if (s.mode === "await_discard") {
      /* 能立直就立直 —— 这是要复现的状态 */
      if (!s.riichi && s.hand.length === 14) {
        var can = await page.evaluate(function () { return window.__game.Core.canRiichi(window.__game.st, 0); });
        if (can) {
          await clickRiichi();
          await sleep(180);
          riichiTurns++;
          var s2 = await snap();
          console.log("[riichi] round" + s2.round + " uiTile=" + s2.uiTile +
                      " coreTile=" + s2.coreTile + " lastDrawn=" + s2.lastDrawn +
                      " order=" + JSON.stringify(s2.order) +
                      (s2.uiTile === s2.coreTile ? "  ✓一致" : "  ✗不一致"));
          s = s2;
        }
      }
      var slot = slotOf(s.order, s.uiIdx);
      if (slot < 0) { await sleep(80); continue; }
      await clickSlot(slot);            /* 选中 */
      await sleep(90);
      await clickSlot(slot);            /* 再点 = 出牌 */
      await sleep(160);
      var s3 = await snap();
      if (s3.disLen === s.disLen) {
        /* 没打出去 —— 记录卡住现场 */
        stuck.push({
          round: s3.round, mode: s3.mode, riichi: s3.riichi,
          uiTile: s3.uiTile, coreTile: s3.coreTile, lastDrawn: s3.lastDrawn,
          selIdx: s3.selIdx, hint: s3.hint, hintTile: s3.hintTile,
          order: s3.order, hand: s3.hand
        });
        if (stuck.length <= 5) {
          console.log("\n!! 卡住 @round" + s3.round + " riichi=" + s3.riichi +
                      " mode=" + s3.mode);
          console.log("   点了 UI 高亮位 idx=" + s.uiIdx + " tile=" + s.uiTile +
                      " → 没打出去");
          console.log("   core 要求 lastDrawn=" + s3.lastDrawn +
                      " (idx=" + s3.coreIdx + ", tile=" + s3.coreTile + ")");
          console.log("   hand=" + JSON.stringify(s3.hand) + " order=" + JSON.stringify(s3.order));
          console.log("   hint='" + s3.hint + "' hintTile=" + s3.hintTile + " selIdx=" + s3.selIdx);
        }
        /* 用 core 认定的那张恢复，让牌局继续 */
        var slotC = slotOf(s3.order, s3.coreIdx);
        if (slotC >= 0) {
          await clickSlot(slotC); await sleep(90);
          await clickSlot(slotC); await sleep(160);
        }
        var s4 = await snap();
        if (s4.disLen === s3.disLen) {
          console.log("   ✗✗ core 认定的那张也打不出去 —— 死锁");
          await page.evaluate(function () { window.__game.Core.discardTile(window.__game.st, window.__game.st.players[0].hand[window.__game.Core.drawnTileIndex(window.__game.st, 0)]); });
          await sleep(200);
        }
      }
      continue;
    }
    await sleep(60);
  }

  console.log("\n================ 汇总 ================");
  console.log("立直次数: " + riichiTurns);
  console.log("UI/core 摸牌分歧: " + mismatches.length + " 种");
  console.log("卡住（点了高亮位打不出去）: " + stuck.length + " 次");
  if (mismatches.length) {
    console.log("\n--- 分歧样本 ---");
    mismatches.slice(0, 6).forEach(function (m) {
      console.log("  round" + m.round + " mode=" + m.mode + " riichi=" + m.riichi +
                  " UI(tile=" + m.uiTile + ") core(tile=" + m.coreTile + ", lastDrawn=" + m.lastDrawn + ")" +
                  " hand=" + JSON.stringify(m.hand));
    });
  }
  await browser.close();
}

run().catch(function (e) { console.error("FATAL", e); process.exit(2); });
