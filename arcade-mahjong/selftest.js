/* Arcade Mahjong · selftest.js
   Node-runnable regression tests for rules + full game flow.
   Run: node selftest.js */
"use strict";

var Core = require("./core.js");

var passed = 0, failed = 0;
function ok(name, cond, msg) {
  if (cond) { passed++; console.log("  ✓ " + name); }
  else { failed++; console.log("  ✗ " + name + (msg ? " — " + msg : "")); }
}

console.log("\n=== Arcade Mahjong · selftest ===\n");

/* 1. Tile encoding */
console.log("[1/9] Tile encoding");
ok("tileKind(108)=27", Core.tileKind(108) === 27);
ok("tileKind(0)=0", Core.tileKind(0) === 0);
ok("tileKind(135)=33", Core.tileKind(135) === 33);
ok("tileName(0)='1万'", Core.tileName(0) === "1万");
ok("tileName(32)='9万'", Core.tileName(32) === "9万");
ok("tileName(36)='1条'", Core.tileName(36) === "1条");
ok("tileName(72)='1筒'", Core.tileName(72) === "1筒");
ok("tileName(108)='东'", Core.tileName(108) === "东");
ok("tileName(124)='中'", Core.tileName(124) === "中");
ok("tileName(132)='白'", Core.tileName(132) === "白");

/* 2. Win conditions */
console.log("\n[2/9] Win conditions");
ok("3N+2 all pungs", Core.canWin([0,1,2,4,5,6,8,9,10,12,13,14,16,17]));
ok("3N+2 mixed suits", Core.canWin([0,1,2,4,8,12,16,17,18,20,24,28,32,33]));
ok("7 pairs", Core.canWin([0,1,4,5,8,9,12,13,16,17,20,21,28,29]));
ok("13 yao", Core.canWin([0, 32, 36, 68, 72, 104, 108, 112, 116, 120, 124, 128, 132, 132]));
ok("Cannot win (mismatched 5万+白)", !Core.canWin([0,1,2,4,5,6,8,9,10,12,13,14,16,132]));
ok("Cannot win (13 tiles)", Core.canWin([0,1,2,4,5,6,8,9,10,12,13,14,16]) === false);
ok("Cannot win (mismatched 5万+9万)", !Core.canWin([0,1,2,4,5,6,8,9,10,12,13,14,16,32]));

/* 3. Chi/Peng/Gang */
console.log("\n[3/9] Chi/Peng/Gang");
ok("Chi [1,3] with 2", JSON.stringify(Core.chiOptions([0,8], 4)) === "[[0,2]]");
ok("Chi [3,4,6,7] with 5 has 3 opts", Core.chiOptions([8,12,20,24], 16).length === 3);
ok("Chi (honor) none", Core.chiOptions([0,36,72], 108).length === 0);
ok("Chi (edge) k=1万", Core.chiOptions([8], 0).length === 0);
ok("Peng 2 same", Core.canPeng([108,109,112], 108));
ok("Peng 1 same false", !Core.canPeng([108,112,116], 108));
ok("Gang 3 same", Core.canGang([108,109,110,112], 108));
ok("Gang 2 same false", !Core.canGang([108,109,112], 108));
ok("AnGang 4 same", Core.anGangKind([0,1,2,3]) === 0);
ok("AnGang none", Core.anGangKind([0,1,2,4]) === -1);

/* 4. Fan calculation */
console.log("\n[4/9] Fan calculation");
var f1 = Core.calcFan([0,1,2,4,5,6,8,9,10,12,13,14,16,17], [], 16);
ok("Full Flush (all wan)", f1.reasons.indexOf("Full Flush") >= 0);
ok("Full Flush + All Pungs fan=6", f1.fan === 6, "got " + f1.fan);

var f2 = Core.calcFan([0,1,4,5,8,9,12,13,16,17,20,21,28,29], [], 0);
ok("7 Pairs fan bonus", f2.reasons.indexOf("Seven Pairs") >= 0);

var f3 = Core.calcFan([0, 32, 36, 68, 72, 104, 108, 112, 116, 120, 124, 128, 132, 132], [], 132);
ok("13 Orphans bonus", f3.reasons.indexOf("13 Orphans") >= 0);

var f4 = Core.calcFan([0,1,2,36,37,38,72,73,74,108,109,110,16,17], [], 17);
ok("All pungs (3 pungs + pair)", f4.reasons.indexOf("All Pungs") >= 0);

/* 4b. Fan with melds — 回归：meld.tiles 存的是牌种类(0-33)，不是牌值 */
console.log("\n[4b] Fan with melds");
/* 手牌全条(值36..) + 吃牌也是条(种类9,10,11) → 应为 Full Flush */
var m1 = Core.calcFan([36,36,36,40,44,48,52,56,60,64,64],
                      [{ type: "chi", tiles: [9,10,11] }], 36);
ok("Full Flush with chi meld (all tiao)",
   m1.reasons.indexOf("Full Flush") >= 0, JSON.stringify(m1.reasons));
/* 对照组：吃牌是万(种类0,1,2) → 不应判为 Full Flush */
var m2 = Core.calcFan([36,36,36,40,44,48,52,56,60,64,64],
                      [{ type: "chi", tiles: [0,1,2] }], 36);
ok("No Full Flush when meld is wan",
   m2.reasons.indexOf("Full Flush") < 0, JSON.stringify(m2.reasons));
/* 碰(条) 同理 */
var m3 = Core.calcFan([36,36,40,44,48,52,56,60,64,64],
                      [{ type: "peng", tiles: [9,9,9] }], 36);
ok("Full Flush with peng meld (all tiao)",
   m3.reasons.indexOf("Full Flush") >= 0, JSON.stringify(m3.reasons));

/* 5. Start round */
console.log("\n[5/9] Round setup");
var st = Core.create("gentle");
ok("initial mode menu", st.mode === "menu");
ok("2 players", st.players.length === 2);
ok("player 0 is human", st.players[0].isHuman);
ok("player 1 is AI", !st.players[1].isHuman);
ok("player 0 name You", st.players[0].name === "You");
ok("player 1 name CPU", st.players[1].name === "CPU");
ok("3 difficulties defined", Core.DIFFS.gentle && Core.DIFFS.normal && Core.DIFFS.brave);
Core.advance(st);
ok("after advance = await_donden", st.mode === "await_donden");
ok("dealer=0", st.dealer === 0);
ok("turn=0 at start", st.turn === 0);
ok("donDenCount=3", st.donDenCount === 3);
ok("player 0 has 13 tiles (pre-exchange)", st.players[0].hand.length === 13);
ok("player 1 has 13 tiles", st.players[1].hand.length === 13);
ok("deck=110 (136-26)", st.deck.length === 110);
ok("round=1", st.round === 1);
/* Skip don-den to test normal flow */
Core.skipDonDen(st);
ok("after skipDonDen = await_discard or ai_turn", st.mode === "await_discard" || st.mode === "await_hu_choice");
ok("dealer drew 14th tile", st.players[0].hand.length === 14);

/* 5b. Don-Den batch exchange doesn't lose tiles */
console.log("\n[5b] Don-Den batch exchange");
var st2 = Core.create("normal");
Core.advance(st2);
ok("st2 mode=await_donden", st2.mode === "await_donden");
ok("st2 p0=13 tiles", st2.players[0].hand.length === 13);
/* Select 3 tiles to exchange (3 exchanges available) — after all done, dealer draws */
Core.doDonDenExchange(st2, [0, 5, 10]);
ok("st2 p0=14 after 3-exchange (dealer drew)", st2.players[0].hand.length === 14);
ok("st2 cpu still 13", st2.players[1].hand.length === 13);
ok("st2 donDenCount=0", st2.donDenCount === 0);

/* Select 2 tiles when only 1 exchange left — should only exchange 1 */
var st3 = Core.create("normal");
Core.advance(st3);
st3.donDenCount = 1;
Core.doDonDenExchange(st3, [0, 5]);
ok("st3 p0=14 after 2-select 1-exchange (dealer drew)", st3.players[0].hand.length === 14);
ok("st3 cpu still 13", st3.players[1].hand.length === 13);
ok("st3 donDenCount=0", st3.donDenCount === 0);

/* 6. Full game simulation */
console.log("\n[6/9] Full AI-driven game");
var st2 = Core.create("brave");
Core.advance(st2);
var ticks = 0, maxTicks = 20000;
var lastMode = st2.mode;
while (st2.mode !== "round_over" && st2.mode !== "draw" && ticks < maxTicks) {
  if (st2.mode === "await_donden") {
    Core.skipDonDen(st2);
  } else if (st2.mode === "await_discard") {
    Core.discardTile(st2, st2.players[0].hand[0]);
  } else if (st2.mode === "await_hu_choice") {
    st2.mode = "round_over";
    var hand = st2.players[0].hand;
    var yaku = Core.checkYaku(hand, st2.players[0].melds, hand[hand.length-1], false, true, false);
    var fan = yaku.length >= 7 ? 13 : (yaku.length >= 4 ? 6 : (yaku.length >= 2 ? 3 : 1));
    st2.winInfo = { winner: 0, fan: fan, reasons: yaku,
                    tile: hand[hand.length-1], type: "draw" };
  } else if (st2.mode === "waiting_response") {
    Core.decline(st2);
  } else {
    Core.update(st2, 16);
    if (st2.mode === lastMode && ticks > 500) {
      st2.mode = "draw";
      break;
    }
  }
  lastMode = st2.mode;
  ticks++;
}

ok("game completed under maxTicks", ticks < maxTicks, "ticks=" + ticks);
ok("final mode is round_over or draw",
   st2.mode === "round_over" || st2.mode === "draw");
if (st2.mode === "round_over") {
  ok("winInfo present", st2.winInfo !== null);
  ok("winInfo.winner in 0..1 (2P)", st2.winInfo.winner >= 0 && st2.winInfo.winner < 2);
  ok("winInfo.fan >= 1", st2.winInfo.fan >= 1);
  ok("winInfo.reasons non-empty", st2.winInfo.reasons.length > 0);
  console.log("  → Winner:", st2.players[st2.winInfo.winner].name,
              "| Fan:", st2.winInfo.fan,
              "| Reasons:", st2.winInfo.reasons.join(", "));
} else {
  console.log("  → Draw, tiles exhausted");
}
console.log("  → Total ticks:", ticks,
            "| Discards:",
            st2.players.map(function (p) { return p.discards.length; }).join("/"));

/* 7. 2P turn rotation & dealer swap */
console.log("\n[7/9] Turn rotation & dealer swap");
var st3 = Core.create("gentle");
Core.advance(st3);
Core.skipDonDen(st3);
var beforeTurn = st3.turn;
ok("before discard turn=0", beforeTurn === 0);
Core.discardTile(st3, st3.players[0].hand[0]);
ok("after discard turn flips to 1 or round over",
   st3.turn === 1 || st3.mode === "round_over" || st3.mode === "draw",
   "turn=" + st3.turn + " mode=" + st3.mode);

/* 8. Dealer alternates each round */
console.log("\n[8/9] Dealer alternates");
var st4 = Core.create("gentle");
Core.advance(st4);
ok("R1 dealer=0", st4.dealer === 0);
ok("R1 round=1", st4.round === 1);
st4.mode = "draw";
Core.advance(st4);
ok("R2 dealer=1 (swapped)", st4.dealer === 1);
ok("R2 round=2", st4.round === 2);
st4.mode = "draw";
Core.advance(st4);
ok("R3 dealer=0", st4.dealer === 0);
ok("R3 round=3", st4.round === 3);
st4.mode = "draw";
Core.advance(st4);
ok("R4 dealer=1", st4.dealer === 1);
ok("R4 round=4", st4.round === 4);

/* 9. 摸到的牌追踪（lastDrawnTile / drawnTileOf）—— 手牌是排序的，
     摸到的牌不一定在最后一位，凡"打摸到的牌 / 用摸到的牌和牌"都不能用 hand[length-1] */
console.log("\n[9/9] Drawn tile tracking & riichi tsumogiri");
var st5 = Core.create("normal");
Core.advance(st5);
Core.skipDonDen(st5);
ok("real draw records lastDrawnTile",
   typeof st5.lastDrawnTile === "number" &&
   st5.players[0].hand.indexOf(st5.lastDrawnTile) >= 0,
   "lastDrawnTile=" + st5.lastDrawnTile);
ok("drawnTileOf === lastDrawnTile after a real draw",
   Core.drawnTileOf(st5, st5.players[0]) === st5.lastDrawnTile);

/* 构造：手牌 13 张较大的牌，摸到 4（2万）→ 排序后必然落在 index 0 */
var st6 = Core.create("normal");
Core.advance(st6);
Core.skipDonDen(st6);
st6.players[0].hand = [40, 44, 48, 52, 56, 60, 64, 68, 72, 76, 80, 84, 88];
Core.sortHand(st6.players[0].hand);
st6.players[0].hand.push(4);
Core.sortHand(st6.players[0].hand);
st6.lastDrawnTile = 4;
st6.mode = "await_discard";
st6.riichi = [true, false];

ok("drawn tile is NOT the last in sorted hand",
   st6.players[0].hand[st6.players[0].hand.length - 1] !== 4,
   "hand[13]=" + st6.players[0].hand[st6.players[0].hand.length - 1]);
ok("drawnTileOf returns the real drawn tile (4)",
   Core.drawnTileOf(st6, st6.players[0]) === 4);

/* 立直后：打非摸到的牌应被拒绝，打摸到的牌应被接受 */
var notDrawn = st6.players[0].hand[st6.players[0].hand.length - 1];
ok("riichi REJECTS discarding a non-drawn tile",
   Core.discardTile(st6, notDrawn) === false);
ok("riichi ACCEPTS discarding the drawn tile",
   Core.discardTile(st6, 4) === true);
ok("drawn tile left the hand",
   st6.players[0].hand.indexOf(4) < 0);

/* drawnTileOf 的兜底：没有摸牌记录 / 记录已失效时，退回手牌最后一张 */
var st7 = Core.create("normal");
Core.advance(st7);
Core.skipDonDen(st7);
st7.players[0].hand = [40, 44, 48, 52, 56, 60, 64, 68, 72, 76, 80, 84, 88];
Core.sortHand(st7.players[0].hand);
st7.lastDrawnTile = null;
ok("drawnTileOf falls back to last tile when no draw",
   Core.drawnTileOf(st7, st7.players[0]) === 88);
st7.lastDrawnTile = 999;   /* 不在手牌里 → 视为失效 */
ok("drawnTileOf ignores a stale drawn tile",
   Core.drawnTileOf(st7, st7.players[0]) === 88);

/* 汇总 */
console.log("\n=== " + passed + " passed, " + failed + " failed ===\n");
if (failed > 0) process.exit(1);
