/* debug-sel-not-discard.js — 针对性测试：点「非新摸牌」能不能打出去
 *
 * 背景：自动play 19 次出牌全成功，但每次点的都是最右槽位（新摸的牌）。
 * 本脚本分别测：
 *   A. 非立直 + 点非新摸牌
 *   B. 立直   + 点非新摸牌
 *   C. 立直   + 点新摸牌
 * 每种都「点两次」（选中 → 出牌），记录中间态与结果。
 */
"use strict";

var puppeteer = require("puppeteer-core");
var path = require("path");
var fs = require("fs");

var GAME_URL = "file://" + path.join(__dirname, "index.html");
var CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
var PROFILE = "/tmp/chrome-sel-" + Date.now();

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

async function run() {
  var browser = await puppeteer.launch({
    executablePath: CHROME, headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox",
           "--user-data-dir=" + PROFILE, "--window-size=440,620", "--hide-scrollbars"]
  });
  var page = await browser.newPage();
  await page.setViewport({ width: 420, height: 620, deviceScaleFactor: 2 });
  page.on("pageerror", function (e) { console.log("[PAGE ERROR]", e.message); });

  await page.goto(GAME_URL, { waitUntil: "networkidle0" });
  await sleep(400);

  var rect = await page.evaluate(function () {
    var r = document.getElementById("cv").getBoundingClientRect();
    return { x: r.left, y: r.top, w: r.width, h: r.height };
  });
  function cx(gx) { return rect.x + gx * (rect.w / 360); }
  function cy(gy) { return rect.y + gy * (rect.h / 500); }

  await page.mouse.click(cx(180), cy(250));   /* 开始 */
  await sleep(900);
  for (var k = 0; k < 6; k++) {
    var m0 = await page.evaluate(function () { return window.__game.st.mode; });
    if (m0 !== "await_donden") break;
    var li0 = await page.evaluate(function () { return window.__game.Render.layoutInfo(); });
    await page.mouse.click(cx(li0.DONDEN_SKIP_X + li0.DONDEN_SKIP_W / 2),
                           cy(li0.DONDEN_SKIP_Y + li0.DONDEN_SKIP_H / 2));
    await sleep(250);
  }

  /* 推进到玩家 await_discard（且手牌 14 张） */
  for (var w = 0; w < 80; w++) {
    var s = await page.evaluate(function () {
      var st = window.__game.st;
      return { mode: st.mode, turn: st.turn, handLen: st.players[0].hand.length };
    });
    if (s.mode === "await_discard" && s.turn === 0 && s.handLen === 14) break;
    if (s.mode === "waiting_response") {
      await page.evaluate(function () { window.__game.Core.decline(window.__game.st); });
      await sleep(700);
    } else if (s.mode === "await_hu_choice") {
      await page.mouse.click(cx(180), cy(391)); await sleep(500);
    } else if (s.mode === "ai_win") {
      await page.evaluate(function () { window.__game.st.aiTimer = 1; }); await sleep(250);
    } else if (s.mode === "await_discard" && s.turn === 0 && s.handLen === 14) {
      break;
    } else if (s.mode === "await_discard" && s.turn === 0) {
      /* 手牌不是 14（有副露），也接受 */
      break;
    } else {
      await sleep(350);
    }
  }

  async function probe(label, opts) {
    /* opts: { slot: number|"new", riichi: bool } */
    await page.evaluate(function (ri) {
      var st = window.__game.st;
      st.riichi[0] = ri;
      if (ri) { st.riichiFirstDraw[0] = false; }
      st.selIdx = -1;
    }, opts.riichi);
    await sleep(120);

    var info = await page.evaluate(function () {
      var st = window.__game.st;
      var order = window.__game.Render.handDisplayOrder(st);
      var li = window.__game.Render.layoutInfo();
      return {
        handLen: st.players[0].hand.length,
        order: order,
        newTileRealIdx: order[order.length - 1],   /* 末槽 = 新摸牌的真实索引 */
        orderIsIdentity: order.every(function (v, i) { return v === i; }),
        lastDrawnTile: st.lastDrawnTile,
        hand: st.players[0].hand.slice(),
        HAND_X: li.HAND_X, HAND_Y: li.HAND_Y, STRIDE: li.STRIDE,
        TILE_W: li.TILE_W, TILE_H: li.TILE_H,
        disLen: st.players[0].discards.length,
        mode: st.mode
      };
    });

    var slot = (opts.slot === "new") ? info.handLen - 1 : opts.slot;
    var px = info.HAND_X + slot * info.STRIDE + info.TILE_W / 2;
    var py = info.HAND_Y + info.TILE_H / 2;

    console.log("\n----- " + label + " -----");
    console.log("  mode=" + info.mode + " riichi=" + opts.riichi +
                " handLen=" + info.handLen + " lastDrawn=" + info.lastDrawnTile);
    console.log("  order=" + JSON.stringify(info.order) + " identity=" + info.orderIsIdentity);
    console.log("  点击槽位 " + slot + "  (真实索引 " + info.order[slot] + ", 牌值 " +
                info.hand[info.order[slot]] + ")");

    await page.mouse.click(cx(px), cy(py));    /* 第一次：选中 */
    await sleep(140);
    var mid = await page.evaluate(function () {
      var st = window.__game.st;
      return { selIdx: st.selIdx, mode: st.mode, handLen: st.players[0].hand.length };
    });
    await page.mouse.click(cx(px), cy(py));    /* 第二次：出牌 */
    await sleep(180);
    var after = await page.evaluate(function () {
      var st = window.__game.st;
      return { selIdx: st.selIdx, mode: st.mode, handLen: st.players[0].hand.length,
               disLen: st.players[0].discards.length, lastDiscard: st.lastDiscard };
    });

    var ok = after.disLen > info.disLen;
    console.log("  选中后 selIdx=" + mid.selIdx + "  (期望 " + info.order[slot] + ")");
    console.log("  出牌后 handLen=" + after.handLen + " disLen=" + after.disLen +
                " selIdx=" + after.selIdx + "  => " + (ok ? "✅ 打出去了" : "❌ 打不出去"));

    var shot = await page.evaluate(function () {
      return document.getElementById("cv").toDataURL("image/png");
    });
    fs.writeFileSync(path.join(__dirname, "shots", "probe-" + label.replace(/[^\w]/g, "_") + ".png"),
                     Buffer.from(shot.split(",")[1], "base64"));
    return { info: info, mid: mid, after: after, ok: ok };
  }

  var rA = await probe("A 非立直-点非新摸牌", { slot: 0, riichi: false });
  /* 若 A 成功，手牌少一张，重推进 */
  if (rA.ok) {
    for (var w2 = 0; w2 < 60; w2++) {
      var s2 = await page.evaluate(function () {
        var st = window.__game.st;
        return { mode: st.mode, turn: st.turn, handLen: st.players[0].hand.length };
      });
      if (s2.mode === "await_discard" && s2.turn === 0) break;
      if (s2.mode === "waiting_response") {
        await page.evaluate(function () { window.__game.Core.decline(window.__game.st); });
        await sleep(700);
      } else if (s2.mode === "await_hu_choice") {
        await page.mouse.click(cx(180), cy(391)); await sleep(500);
      } else if (s2.mode === "ai_win") {
        await page.evaluate(function () { window.__game.st.aiTimer = 1; }); await sleep(250);
      } else { await sleep(350); }
    }
  }

  var rB = await probe("B 立直-点非新摸牌", { slot: 0, riichi: true });
  var rC = await probe("C 立直-点新摸牌", { slot: "new", riichi: true });

  console.log("\n===== 结论 =====");
  console.log("  A 非立直+非新摸牌 : " + (rA.ok ? "OK" : "打不出去"));
  console.log("  B 立直+非新摸牌   : " + (rB.ok ? "OK" : "打不出去  <== 复现！"));
  console.log("  C 立直+新摸牌     : " + (rC.ok ? "OK" : "打不出去"));

  await browser.close();
}

run().catch(function (e) { console.error(e); process.exit(1); });
