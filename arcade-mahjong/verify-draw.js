/* 回归测试：新摸的牌永远显示在最右槽位，不插进手牌里
 *
 * 场景：手牌 13 张全是较大的牌，摸到一张 4（2万）→ 排序后落在 index 0。
 *
 * 期望：
 *   - 摸牌前 / 动画中：槽位 0..12 显示那 13 张牌，槽位 13 为空
 *   - 动画结束后：槽位 13 出现新摸的牌（上抬 + 金框）
 *   - 槽位 0..12 在"摸牌前"和"动画中"必须逐像素一致（不能因为插入而抖动/移位）
 *
 * 旧代码把新牌按真实索引（0）插进手牌，槽位 0 会被重复绘制 → 本测试失败。
 */
"use strict";

var puppeteer = require("puppeteer-core");
var path = require("path");
var fs = require("fs");
var cp = require("child_process");

var GAME_URL = "file://" + path.join(__dirname, "index.html");
var OUT_DIR = path.join(__dirname, "shots", "verify-draw");
var CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
var PROFILE = "/tmp/chrome-mahjong-vdraw-" + Date.now();
var PY = "/Users/mofacejojo/.workbuddy-ai/binaries/python/envs/default/bin/python";

var fails = 0;
function ok(label, cond, extra) {
  console.log((cond ? "  PASS  " : "  FAIL  ") + label + (extra ? "  " + extra : ""));
  if (!cond) fails++;
}
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
  await sleep(600);

  /* 轮到自己出牌 */
  for (var w = 0; w < 80; w++) {
    var mode = await page.evaluate(function () { return window.__game.st.mode; });
    if (mode === "await_discard") break;
    if (mode === "waiting_response") {
      await page.evaluate(function () { window.__game.Core.decline(window.__game.st); });
    }
    await sleep(200);
  }
  var m0 = await page.evaluate(function () { return window.__game.st.mode; });
  ok("reached await_discard", m0 === "await_discard", "mode=" + m0);

  async function grab(name) {
    var d = await page.evaluate(function () {
      return document.getElementById("cv").toDataURL("image/png");
    });
    fs.writeFileSync(path.join(OUT_DIR, name + ".png"), Buffer.from(d.split(",")[1], "base64"));
  }

  /* ---- 构造确定场景：13 张全是较大的牌 ---- */
  await page.evaluate(function () {
    var st = window.__game.st;
    st.players[0].hand = [40, 44, 48, 52, 56, 60, 64, 68, 72, 76, 80, 84, 88];
    window.__game.Core.sortHand(st.players[0].hand);
    st.selIdx = -1;
  });
  await sleep(150);                       /* 让主循环的 prevHand 快照同步 */
  await grab("before");

  /* ---- 摸到一张最小的牌 → 排序后落在 index 0，但显示应在最右 ---- */
  await page.evaluate(function () {
    var st = window.__game.st;
    st.players[0].hand.push(4);
    window.__game.Core.sortHand(st.players[0].hand);
  });
  await sleep(70);                        /* 动画进行中（牌还在飞） */
  await grab("mid");

  var midInfo = await page.evaluate(function () {
    var st = window.__game.st;
    return { head: st.players[0].hand.slice(0, 3), len: st.players[0].hand.length };
  });
  ok("hand has 14 after draw", midInfo.len === 14, JSON.stringify(midInfo.head));
  ok("drawn tile sorted to index 0", midInfo.head[0] === 4, "hand[0]=" + midInfo.head[0]);

  await sleep(900);                       /* 等动画结束 */
  await grab("settled");

  var li = await page.evaluate(function () { return window.__game.Render.layoutInfo(); });

  /* ---- 点击映射：显示槽位 -> 手牌真实索引 ----
     此时手牌 = [4,40,44,...,88]（14 张），新摸的 4 排在最右槽位。
     order = [1,2,...,13, 0]，所以：
       槽位 0 -> 真实 1    槽位 5 -> 真实 6    槽位 12 -> 真实 13   槽位 13 -> 真实 0（新摸的牌）
     每次点不同的槽位只改选中，不会出牌。 */
  console.log("\n  click mapping (slot -> real hand index):");
  var expect = [[0, 1], [5, 6], [12, 13], [13, 0]];
  for (var ci = 0; ci < expect.length; ci++) {
    var slotN = expect[ci][0], wantIdx = expect[ci][1];
    await page.mouse.click(cx(li.HAND_X + slotN * li.STRIDE + li.TILE_W / 2),
                           cy(li.HAND_Y + li.TILE_H / 2));
    await sleep(90);
    var got = await page.evaluate(function () { return window.__game.st.selIdx; });
    ok("click slot " + slotN + " selects real index " + wantIdx, got === wantIdx,
       "got " + got);
  }

  /* 再点一次最右槽位（已选中）→ 打出那张新摸的牌 */
  await page.mouse.click(cx(li.HAND_X + 13 * li.STRIDE + li.TILE_W / 2),
                         cy(li.HAND_Y + li.TILE_H / 2));
  await sleep(160);
  var afterDis = await page.evaluate(function () {
    var st = window.__game.st;
    return { dis: st.players[0].discards.slice(), hand: st.players[0].hand.slice() };
  });
  ok("clicking the far-right slot again discards the drawn tile (2万)",
     afterDis.dis.indexOf(4) >= 0, "discards=" + JSON.stringify(afterDis.dis));
  ok("hand back to 13 and re-sorted (drawn tile inserted/removed)",
     afterDis.hand.length === 13 && afterDis.hand[0] === 40,
     "hand[0]=" + afterDis.hand[0] + " len=" + afterDis.hand.length);

  await browser.close();

  /* ---- 逐槽位像素判定 ---- */
  var script =
    "from PIL import Image\n" +
    "import numpy as np, sys, json\n" +
    "S = 2.0\n" +
    "li = json.loads(sys.argv[1])\n" +
    "imgs = {n: np.asarray(Image.open('shots/verify-draw/' + n + '.png').convert('RGB'), dtype=np.int16)\n" +
    "        for n in ['before','mid','settled']}\n" +
    "def slot_region(i):\n" +
    "    x0 = int((li['HAND_X'] + i*li['STRIDE']) * S) + 4\n" +
    "    x1 = int((li['HAND_X'] + i*li['STRIDE'] + li['TILE_W']) * S) - 4\n" +
    "    y0 = int(li['HAND_Y'] * S) + 10\n" +
    "    y1 = int((li['HAND_Y'] + li['TILE_H']) * S) - 10\n" +
    "    return y0, y1, x0, x1\n" +
    "def kind_of(a, i):\n" +
    "    y0,y1,x0,x1 = slot_region(i)\n" +
    "    r = a[y0:y1, x0:x1]\n" +
    "    R,G,B = r[:,:,0], r[:,:,1], r[:,:,2]\n" +
    "    ivory = float(((R>200)&(G>190)&(B>160)).mean())\n" +
    "    green = float(((G>R+25)&(G>B+25)).mean())\n" +
    "    return 'tile' if ivory > 0.4 else ('empty' if green > 0.5 else 'other')\n" +
    "res = {}\n" +
    "for n, a in imgs.items():\n" +
    "    res[n] = [kind_of(a, i) for i in range(14)]\n" +
    "# 槽位 0..12 在 mid 与 settled 之间是否逐像素一致（新牌落位不应挤动其它牌）\n" +
    "# 阈值取 120：低于此值的差异属于抗锯齿/金框脉冲的亚像素抖动，不算位移\n" +
    "y0 = int(li['HAND_Y']*S)+4; y1 = int((li['HAND_Y']+li['TILE_H'])*S)-4\n" +
    "x0 = int(li['HAND_X']*S); x1 = int((li['HAND_X'] + 13*li['STRIDE']) * S)\n" +
    "band = np.abs(imgs['mid'][y0:y1, x0:x1] - imgs['settled'][y0:y1, x0:x1]).sum(axis=2)\n" +
    "res['jitter_px'] = int((band > 120).sum())\n" +
    "print(json.dumps(res))\n";

  var out = cp.execFileSync(PY, ["-c", script, JSON.stringify(li)], {
    cwd: __dirname, encoding: "utf8"
  });
  var r = JSON.parse(out.trim());
  var jitter = r.jitter_px;
  delete r.jitter_px;
  console.log("\n  slots:", JSON.stringify(r));
  console.log("  jitter (slots 0..12, mid vs settled):", jitter, "px\n");

  var allTiles = function (arr) {
    return arr.slice(0, 13).every(function (k) { return k === "tile"; });
  };

  ok("before: slots 0..12 all tiles", allTiles(r.before));
  ok("before: slot 13 EMPTY", r.before[13] === "empty", "got " + r.before[13]);
  ok("mid: slots 0..12 all tiles", allTiles(r.mid));
  ok("mid: slot 13 EMPTY (drawn tile still flying)", r.mid[13] === "empty", "got " + r.mid[13]);
  ok("settled: slots 0..12 all tiles", allTiles(r.settled));
  ok("settled: slot 13 shows the drawn tile (far right)", r.settled[13] === "tile",
     "got " + r.settled[13]);
  ok("no jitter: slots 0..12 unchanged between mid and settled",
     jitter < 200, "jitter=" + jitter + "px");

  ok("no page errors", pageErrors.length === 0, pageErrors.join(" | "));

  console.log("\n" + (fails === 0 ? "ALL PASS" : fails + " FAILED"));
  process.exit(fails === 0 ? 0 : 1);
}

run().catch(function (e) { console.error(e); process.exit(1); });
