/* verify-faces.js — 验证牌面符合真实麻将画法
   回归目标（用户反馈）：
     1. 万子必须用**汉字数字**（不是阿拉伯数字），且「萬」是繁体、数字蓝色 / 萬红色
     2. 一条必须画成**鸟**（幺鸡），不是一根竹子
     3. 条子配色：二/三/四/六/八条**纯绿**；五条中心一条红、七条最顶一条红、
        九条中间那一整列红
   顺带覆盖筒子的真实配色（六筒上二绿下四红、九筒蓝红绿三行等）。

   产出 shots/faces/contact-sheet.png —— 全部 34 种牌面的大图对照表，供肉眼验收。

   跑法：NODE_PATH=<puppeteer-core 所在 node_modules> node verify-faces.js
*/
"use strict";

var puppeteer = require("puppeteer-core");
var path = require("path");
var fs = require("fs");

var GAME_URL = "file://" + path.join(__dirname, "index.html");
var OUT_DIR = path.join(__dirname, "shots", "faces");
var CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
var PROFILE = "/tmp/chrome-faces-" + Date.now();

/* 大图画布布局（写在 Node 侧，evaluate 里再用同名常量） */
var TW = 76, TH = 104, LABEL = 16, COLS = 7, GAP = 10, PAD = 14;
var ROWS = Math.ceil(34 / COLS);
var SHEET_W = PAD * 2 + COLS * (TW + GAP) - GAP;
var SHEET_H = PAD * 2 + ROWS * (TH + LABEL + GAP) - GAP;

var passed = 0, failed = 0;
function ok(name, cond, msg) {
  if (cond) { passed++; console.log("  PASS  " + name); }
  else { failed++; console.log("  FAIL  " + name + (msg ? "  — " + msg : "")); }
}
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

function pct(v) { return (v * 100).toFixed(2) + "%"; }

async function run() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  var browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox",
           "--user-data-dir=" + PROFILE, "--hide-scrollbars"]
  });
  var page = await browser.newPage();
  await page.setViewport({ width: SHEET_W + 40, height: SHEET_H + 40, deviceScaleFactor: 2 });

  var errors = [];
  page.on("pageerror", function (e) { errors.push(e.message); });
  page.on("console", function (m) { if (m.type() === "error") errors.push(m.text()); });

  /* 抓 "undefined"/"NaN" 被画到牌面上的情况（画错牌面最容易出这个） */
  await page.evaluateOnNewDocument(function () {
    window.__badText = [];
    var orig = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (txt) {
      var s = String(txt);
      if (/undefined|NaN/.test(s)) window.__badText.push(s);
      return orig.apply(this, arguments);
    };
  });

  await page.goto(GAME_URL, { waitUntil: "networkidle0" });
  await sleep(400);

  /* ---- 把 34 种牌面画成一张对照表 ---- */
  var meta = await page.evaluate(function (TW, TH, LABEL, COLS, GAP, PAD, W, H) {
    var R = window.__game.Render, Core = window.__game.Core;
    var cv = document.createElement("canvas");
    cv.id = "faces";
    cv.width = W; cv.height = H;
    var ctx = cv.getContext("2d");
    ctx.fillStyle = "#0e4a30";
    ctx.fillRect(0, 0, W, H);

    var labels = [];
    for (var k = 0; k < 34; k++) {
      var c = k % COLS, row = Math.floor(k / COLS);
      var x0 = PAD + c * (TW + GAP);
      var y0 = PAD + row * (TH + LABEL + GAP);
      var s = Core.kindSuit(k), r = Core.kindRank(k);
      var tag = s === 0 ? (r + "m") : s === 1 ? (r + "s") : s === 2 ? (r + "p") : "ESWNCFP"[r];
      labels.push({ k: k, suit: s, rank: r, tag: tag, x: x0, y: y0 });

      ctx.fillStyle = "#9fe1cb";
      ctx.font = "600 11px monospace";
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(tag, x0 + 2, y0 + 1);

      R.drawTileFace(ctx, k, x0, y0 + LABEL, TW, TH);
    }
    document.body.appendChild(cv);
    window.__faces = cv;
    window.__meta = labels;
    window.__geo = { TW: TW, TH: TH, LABEL: LABEL, GAP: GAP, PAD: PAD, COLS: COLS };
    return labels;
  }, TW, TH, LABEL, COLS, GAP, PAD, SHEET_W, SHEET_H);

  var el = await page.$("#faces");
  await el.screenshot({ path: path.join(OUT_DIR, "contact-sheet.png") });

  /* ---- 逐张牌面统计红/绿/蓝像素占比（只取牌面内部，避开侧面与斜角） ---- */
  var stats = await page.evaluate(function () {
    var cv = window.__faces;
    var ctx = cv.getContext("2d");
    var g = window.__geo;
    var out = {};
    for (var i = 0; i < window.__meta.length; i++) {
      var m = window.__meta[i];
      var inset = 10;
      var d = ctx.getImageData(m.x + inset, m.y + g.LABEL + inset,
                               g.TW - inset * 2, g.TH - inset * 2).data;
      var red = 0, green = 0, blue = 0, n = 0;
      for (var p = 0; p < d.length; p += 4) {
        var R = d[p], G = d[p + 1], B = d[p + 2];
        n++;
        /* 阈值用"通道序关系"，不用绝对色值 —— 象牙底(约 245,232,200)不会误判 */
        if (R > 120 && R > G + 40 && R > B + 40) red++;
        if (G > 90 && G > R + 25 && G > B + 25) green++;
        if (B > 100 && B > R + 30 && B > G + 15) blue++;
      }
      out[m.tag] = { red: red / n, green: green / n, blue: blue / n };
    }
    return out;
  });

  var bad = await page.evaluate(function () { return window.__badText; });
  await browser.close();

  /* ---------------- 断言 ---------------- */
  var T = {};
  meta.forEach(function (m) { T[m.tag] = stats[m.tag]; });

  console.log("\n  pixel share per tile (red / green / blue):");
  ["1m", "5m", "9m", "1s", "2s", "5s", "6s", "7s", "8s", "9s",
   "1p", "6p", "8p", "9p", "ESWNCFP"[0]].forEach(function (t) {
    if (!T[t]) return;
    console.log("    " + t.padEnd(4) + " r=" + pct(T[t].red) +
                "  g=" + pct(T[t].green) + "  b=" + pct(T[t].blue));
  });

  console.log("\n  [万子 — 汉字数字 + 繁体萬]");
  var wanOk = true, wanBlueRed = true;
  for (var r = 1; r <= 9; r++) {
    var t = T[r + "m"];
    if (!t) { wanOk = false; continue; }
    /* 数字是蓝的、萬是红的 —— 两者都必须有 */
    if (t.blue < 0.005 || t.red < 0.005) wanBlueRed = false;
  }
  ok("9 张万子全部渲染出蓝色数字 + 红色萬", wanBlueRed,
     JSON.stringify(T["1m"]));
  /* 阿拉伯数字是黑色描边细字，汉字笔画多得多 —— 用"非象牙像素占比"间接确认 */
  ok("万子牌面有足够多的着墨（汉字而非细数字）",
     T["1m"] && (T["1m"].blue + T["1m"].red) > 0.03,
     "1m ink=" + (T["1m"] ? (T["1m"].blue + T["1m"].red).toFixed(4) : "n/a"));

  console.log("\n  [条子 — 一条是鸟，其余按真牌配色]");
  ok("一条画的是鸟（同时含绿身与红冠/红腿）",
     T["1s"] && T["1s"].green > 0.02 && T["1s"].red > 0.002,
     JSON.stringify(T["1s"]));

  /* 用户的原话：「好像只有6条是纯绿色的」。
     真实牌例里 二/三/四/六/八 都是纯绿（可组绿一色），不止六条。 */
  [2, 3, 4, 6, 8].forEach(function (r) {
    var t = T[r + "s"];
    ok(r + "条 纯绿（无红条）",
       t && t.red < 0.001 && t.green > 0.02,
       t ? ("red=" + pct(t.red) + " green=" + pct(t.green)) : "missing");
  });
  [5, 7, 9].forEach(function (r) {
    var t = T[r + "s"];
    ok(r + "条 含红条（五条中心 / 七条最顶 / 九条中间列）",
       t && t.red > 0.004 && t.green > 0.02,
       t ? ("red=" + pct(t.red) + " green=" + pct(t.green)) : "missing");
  });
  ok("五条的红比九条少（五条只 1 根红，九条 3 根）",
     T["5s"] && T["9s"] && T["5s"].red < T["9s"].red,
     "5s=" + pct(T["5s"].red) + " 9s=" + pct(T["9s"].red));

  console.log("\n  [筒子 — 真实配色]");
  ok("一筒是同心大圆（蓝环 + 红心）",
     T["1p"] && T["1p"].blue > 0.03 && T["1p"].red > 0.002,
     JSON.stringify(T["1p"]));
  ok("六筒 上二绿 + 下四红", T["6p"] && T["6p"].green > 0.003 && T["6p"].red > 0.01,
     JSON.stringify(T["6p"]));
  ok("八筒 纯蓝（八颗蓝，无红无绿）",
     T["8p"] && T["8p"].blue > 0.03 && T["8p"].red < 0.001 && T["8p"].green < 0.001,
     JSON.stringify(T["8p"]));
  ok("九筒 蓝红绿三行都有", T["9p"] && T["9p"].blue > 0.003 &&
     T["9p"].red > 0.003 && T["9p"].green > 0.003, JSON.stringify(T["9p"]));

  console.log("\n  [健壮性]");
  ok("牌面没有画出 undefined / NaN", bad.length === 0, bad.join(" | "));
  ok("没有页面错误", errors.length === 0, errors.join(" | "));

  console.log("\n  contact sheet → shots/faces/contact-sheet.png");
  console.log("\n" + (failed === 0 ? "ALL PASS" : failed + " FAILED"));
  process.exit(failed === 0 ? 0 : 1);
}

run().catch(function (e) { console.error(e); process.exit(1); });
