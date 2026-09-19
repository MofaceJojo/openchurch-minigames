/* debug-stuck-discard.js — 复现「选中的牌打不出去」
 *
 * 症状（用户）：手牌里某张牌被金框高亮且上抬（"直立"），但怎么点都出不去。
 *
 * 做法：自动玩若干巡，每次 await_discard 时点同一张牌两次（选中→出牌），
 *       如果手牌数没有减少（没打出去），就把当时的完整状态 dump 出来。
 *       同时 hook Core.discardTile 记录每一次调用的入参与返回值。
 */
"use strict";

var puppeteer = require("puppeteer-core");
var path = require("path");

var GAME_URL = "file://" + path.join(__dirname, "index.html");
var CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
var PROFILE = "/tmp/chrome-stuck-" + Date.now();

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

  await page.goto(GAME_URL, { waitUntil: "networkidle0" });
  await sleep(400);

  /* ---- 插桩：记录每次 discardTile 的调用 ---- */
  await page.evaluate(function () {
    var C = window.__game.Core;
    window.__discardLog = [];
    var orig = C.discardTile;
    C.discardTile = function (st, tile) {
      var before = st.players[0].hand.length;
      var rec = {
        tile: tile,
        mode: st.mode,
        riichi: st.riichi[0],
        lastDrawnTile: st.lastDrawnTile,
        drawnTileOf: null,
        handLenBefore: before
      };
      try { rec.drawnTileOf = C.drawnTileOf(st, st.players[0]); } catch (e) { rec.drawnTileOf = "ERR"; }
      var r = orig.call(C, st, tile);
      rec.result = r;
      rec.handLenAfter = st.players[0].hand.length;
      rec.discardsLenAfter = st.players[0].discards.length;
      window.__discardLog.push(rec);
      if (!r) console.log("!! discardTile REJECTED", JSON.stringify(rec));
      return r;
    };
  });

  var rect = await page.evaluate(function () {
    var r = document.getElementById("cv").getBoundingClientRect();
    return { x: r.left, y: r.top, w: r.width, h: r.height };
  });
  function cx(gx) { return rect.x + gx * (rect.w / 360); }
  function cy(gy) { return rect.y + gy * (rect.h / 500); }

  /* 开始游戏 */
  await page.mouse.click(cx(180), cy(250));
  await sleep(900);

  /* 跳过三元换牌 */
  for (var k = 0; k < 6; k++) {
    var m0 = await page.evaluate(function () { return window.__game.st.mode; });
    if (m0 !== "await_donden") break;
    var li0 = await page.evaluate(function () { return window.__game.Render.layoutInfo(); });
    await page.mouse.click(cx(li0.DONDEN_SKIP_X + li0.DONDEN_SKIP_W / 2),
                           cy(li0.DONDEN_SKIP_Y + li0.DONDEN_SKIP_H / 2));
    await sleep(250);
  }

  var stuck = [];
  for (var turn = 0; turn < 60; turn++) {
    var s = await page.evaluate(function () {
      var st = window.__game.st;
      return {
        mode: st.mode,
        turn: st.turn,
        riichi: st.riichi.slice(),
        selIdx: st.selIdx,
        lastDrawnTile: st.lastDrawnTile,
        handLen: st.players[0].hand.length,
        disLen: st.players[0].discards.length,
        wall: st.wallSize,
        order: window.__game.Render.handDisplayOrder(st),
        newTileIdxIsNew: (st.mode === "await_discard")
      };
    });
    if (s.mode === "round_over" || s.mode === "draw") { console.log("round ended at turn", turn); break; }

    if (s.mode === "await_discard") {
      var li = await page.evaluate(function () { return window.__game.Render.layoutInfo(); });
      /* 挑最后一张（显示槽位 = handLen-1，通常是"新摸的牌"）来点 */
      var slot = s.handLen - 1;
      var px = li.HAND_X + slot * li.STRIDE + li.TILE_W / 2;
      var py = li.HAND_Y + li.TILE_H / 2;

      var beforeLen = s.handLen, beforeDis = s.disLen;
      await page.mouse.click(cx(px), cy(py));      /* 第一次：选中 */
      await sleep(120);
      var mid = await page.evaluate(function () {
        var st = window.__game.st;
        return { selIdx: st.selIdx, mode: st.mode, handLen: st.players[0].hand.length };
      });
      await page.mouse.click(cx(px), cy(py));      /* 第二次：出牌 */
      await sleep(160);
      var after = await page.evaluate(function () {
        var st = window.__game.st;
        return { selIdx: st.selIdx, mode: st.mode, handLen: st.players[0].hand.length,
                 disLen: st.players[0].discards.length, riichi: st.riichi[0],
                 lastDrawnTile: st.lastDrawnTile, order: window.__game.Render.handDisplayOrder(st) };
      });

      if (after.handLen >= beforeLen && after.disLen === beforeDis) {
        var shot = await page.evaluate(function () {
          return document.getElementById("cv").toDataURL("image/png");
        });
        require("fs").writeFileSync(path.join(__dirname, "shots", "stuck-" + turn + ".png"),
                                   Buffer.from(shot.split(",")[1], "base64"));
        var log = await page.evaluate(function () { return window.__discardLog.slice(-6); });
        stuck.push({ turn: turn, slot: slot, px: px, py: py, mid: mid, after: after, log: log });
        console.log("### STUCK at turn " + turn);
        console.log("   slot=" + slot + " px=" + px.toFixed(1) + " py=" + py.toFixed(1));
        console.log("   mid   =" + JSON.stringify(mid));
        console.log("   after =" + JSON.stringify(after));
        console.log("   log   =" + JSON.stringify(log));
        /* 试试点别的槽位，看是不是全都不行 */
        for (var alt = 0; alt < Math.min(s.handLen, 6); alt++) {
          var ax = li.HAND_X + alt * li.STRIDE + li.TILE_W / 2;
          await page.mouse.click(cx(ax), cy(py)); await sleep(90);
          await page.mouse.click(cx(ax), cy(py)); await sleep(140);
          var a2 = await page.evaluate(function () {
            var st = window.__game.st;
            return { disLen: st.players[0].discards.length, handLen: st.players[0].hand.length, mode: st.mode };
          });
          if (a2.disLen > beforeDis) { console.log("   -> slot " + alt + " DID discard"); break; }
        }
        if (stuck.length >= 2) break;
      }
      await sleep(700);
    } else if (s.mode === "waiting_response") {
      await page.evaluate(function () { window.__game.Core.decline(window.__game.st); });
      await sleep(900);
    } else if (s.mode === "await_hu_choice") {
      await page.mouse.click(cx(180), cy(391));
      await sleep(600);
    } else if (s.mode === "ai_win") {
      await page.evaluate(function () { window.__game.st.aiTimer = 1; });
      await sleep(300);
    } else {
      await sleep(400);
    }
  }

  var allLog = await page.evaluate(function () { return window.__discardLog; });
  console.log("\n===== 全部 discardTile 调用 (" + allLog.length + ") =====");
  allLog.forEach(function (r) {
    console.log("  tile=" + r.tile + " riichi=" + r.riichi + " lastDrawn=" + r.lastDrawnTile +
                " drawnTileOf=" + r.drawnTileOf + " -> " + r.result +
                " (hand " + r.handLenBefore + "->" + r.handLenAfter + ")");
  });

  await browser.close();
  console.log("\nSTUCK count =", stuck.length);
}

run().catch(function (e) { console.error(e); process.exit(1); });
