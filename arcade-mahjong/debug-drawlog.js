/* 页面内探针：每次"摸牌动画"触发时，把三个值对起来看是否一致
 *
 *   anim.idx   —— index.html 的 findDrawnTile 算出来的"摸到的牌"索引（决定 UI 高亮在哪）
 *   anim.tile  —— 同一个来源的牌值
 *   st.lastDrawnTile / hand.indexOf(...)  —— core 立直校验唯一认的真相
 *
 * 三者不一致 = UI 高亮的"摸牌位"不是立直允许打的那张 → 玩家怎么点都被拒。
 *
 * 用法：node debug-drawlog.js [局数上限]
 */
"use strict";

var puppeteer = require("puppeteer-core");
var path = require("path");
var GAME_DIR = process.env.AM_GAME_DIR || __dirname;
var GAME_URL = "file://" + path.join(GAME_DIR, "index.html");
var CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
var MAXSTEP = parseInt(process.argv[2] || "2600", 10);

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

async function run() {
  var browser = await puppeteer.launch({
    executablePath: CHROME, headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox",
           "--user-data-dir=/tmp/chrome-dl-" + Date.now(),
           "--window-size=440,700", "--hide-scrollbars"]
  });
  var page = await browser.newPage();
  await page.setViewport({ width: 420, height: 700, deviceScaleFactor: 1 });

  /* 在页面里挂 addAnim 钩子，记录每一次摸牌动画的三个值 */
  await page.evaluateOnNewDocument(function () {
    window.__drawLog = [];
    var iv = setInterval(function () {
      if (!window.__game || !window.__game.Render) return;
      clearInterval(iv);
      var R = window.__game.Render;
      if (R.__hooked) return;
      R.__hooked = true;
      var orig = R.addAnim;
      R.addAnim = function (type, from, to, dur, data) {
        if (type === "draw" && data && typeof data.idx === "number") {
          var st = window.__game.st;
          var hand = st.players[0].hand;
          window.__drawLog.push({
            animIdx: data.idx,
            animTile: data.tile,
            handAtAnim: hand.slice(),
            handLen: hand.length,
            lastDrawn: st.lastDrawnTile,
            coreIdx: hand.indexOf(st.lastDrawnTile),
            mode: st.mode,
            turn: st.turn
          });
        }
        return orig.apply(this, arguments);
      };
    }, 20);
  });

  await page.goto(GAME_URL, { waitUntil: "networkidle0" });
  await sleep(400);

  var cv = await page.$("#cv");
  var rect = await page.evaluate(function (el) {
    var r = el.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height };
  }, cv);
  function cx(g) { return rect.x + g * (rect.w / 360); }
  function cy(g) { return rect.y + g * (rect.h / 500); }

  async function snap() {
    return page.evaluate(function () {
      var g = window.__game, st = g.st, C = g.Core, R = g.Render;
      var hand = st.players[0].hand;
      var order = R.handDisplayOrder(st);
      var uiIdx = order.length ? order[order.length - 1] : -1;
      return {
        mode: st.mode, turn: st.turn, riichi: st.riichi[0], deck: st.deck.length,
        lastDrawn: st.lastDrawnTile, hand: hand.slice(), order: order,
        uiIdx: uiIdx, uiTile: hand[uiIdx],
        coreIdx: C.drawnTileIndex(st, 0), coreTile: hand[C.drawnTileIndex(st, 0)],
        selIdx: st.selIdx, disLen: st.players[0].discards.length, hint: st.hint
      };
    });
  }
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

  var badLog = [];      /* 动画三个值不一致 */
  var rejected = 0;     /* 点了"高亮位"却被拒的次数 */
  var riichiCount = 0;

  await page.mouse.click(cx(180), cy(250));
  await sleep(500);

  for (var step = 0; step < MAXSTEP; step++) {
    var s = await snap();
    if (s.mode === "menu" || s.mode === "round_over" || s.mode === "draw") {
      await page.mouse.click(cx(180), cy(250)); await sleep(240); continue;
    }
    if (s.mode === "ai_win") { await page.mouse.click(cx(180), cy(250)); await sleep(110); continue; }
    if (s.mode === "await_donden") { await clickSkip(); await sleep(190); continue; }
    if (s.mode === "waiting_response") {
      await page.evaluate(function () { window.__game.Core.decline(window.__game.st); });
      await sleep(120); continue;
    }
    if (s.mode === "await_hu_choice") {
      var li2 = await page.evaluate(function () { return window.__game.Render.layoutInfo(); });
      await page.mouse.click(cx(li2.HU_BTN_X + li2.HU_BTN_W / 2), cy(li2.HU_BTN_Y + li2.HU_BTN_H / 2));
      await sleep(190); continue;
    }
    if (s.mode === "ai_turn") { await sleep(70); continue; }

    if (s.mode === "await_discard") {
      if (!s.riichi && s.hand.length === 14) {
        var can = await page.evaluate(function () { return window.__game.Core.canRiichi(window.__game.st, 0); });
        if (can) { await clickRiichi(); await sleep(170); riichiCount++; s = await snap(); }
      }
      var slot = s.order.indexOf(s.uiIdx);
      if (slot < 0) { await sleep(70); continue; }
      var dis0 = s.disLen;
      await clickSlot(slot); await sleep(80);
      await clickSlot(slot); await sleep(150);
      var s2 = await snap();
      if (s2.disLen === dis0 && s.mode === "await_discard") {
        rejected++;
        if (rejected <= 8) {
          console.log("\n!! 点了高亮位却没打出去  round riichi=" + s2.riichi);
          console.log("   UI 高亮 idx=" + s.uiIdx + " tile=" + s.uiTile + " order=" + JSON.stringify(s.order));
          console.log("   core 要求 lastDrawn=" + s2.lastDrawn + " idx=" + s2.coreIdx + " tile=" + s2.coreTile);
          console.log("   hand=" + JSON.stringify(s2.hand));
          console.log("   hint='" + s2.hint + "'");
        }
        /* 用 core 认的那张恢复 */
        var sc = s2.order.indexOf(s2.coreIdx);
        if (sc >= 0) { await clickSlot(sc); await sleep(80); await clickSlot(sc); await sleep(150); }
        var s3 = await snap();
        if (s3.disLen === dis0) {
          console.log("   ✗✗ core 认的那张也出不去 → 死锁，强制推进");
          await page.evaluate(function () {
            var g = window.__game, st = g.st;
            g.Core.discardTile(st, st.players[0].hand[g.Core.drawnTileIndex(st, 0)]);
          });
          await sleep(200);
        }
      }
      continue;
    }
    await sleep(50);
  }

  var log = await page.evaluate(function () { return window.__drawLog || []; });
  log.forEach(function (e, i) {
    var okIdx = (e.animIdx === e.coreIdx);
    var okTile = (e.animTile === e.lastDrawn);
    if (!okIdx || !okTile) badLog.push({ i: i, e: e });
  });

  console.log("\n================ 摸牌动画日志 ================");
  console.log("总摸牌次数: " + log.length + "   立直次数: " + riichiCount + "   被拒次数: " + rejected);
  console.log("三个值不一致的摸牌: " + badLog.length);
  if (badLog.length) {
    console.log("\n--- 不一致样本 ---");
    badLog.slice(0, 8).forEach(function (b) {
      var e = b.e;
      console.log("  #" + b.i + " mode=" + e.mode + " turn=" + e.turn +
                  " anim(idx=" + e.animIdx + ", tile=" + e.animTile + ")" +
                  " core(lastDrawn=" + e.lastDrawn + ", idx=" + e.coreIdx + ")" +
                  " handLen=" + e.handLen);
      console.log("      hand=" + JSON.stringify(e.handAtAnim));
    });
  } else {
    console.log("（本次自动对局没有复现到不一致）");
  }
  await browser.close();
}

run().catch(function (e) { console.error("FATAL", e); process.exit(2); });
