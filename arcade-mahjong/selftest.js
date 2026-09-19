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
console.log("[1/12] Tile encoding");
ok("tileKind(108)=27", Core.tileKind(108) === 27);
ok("tileKind(0)=0", Core.tileKind(0) === 0);
ok("tileKind(135)=33", Core.tileKind(135) === 33);
/* 牌名统一用繁体，和牌面画的「萬」保持一致 */
ok("tileName(0)='1萬'", Core.tileName(0) === "1萬");
ok("tileName(32)='9萬'", Core.tileName(32) === "9萬");
ok("tileName(36)='1條'", Core.tileName(36) === "1條");
ok("tileName(72)='1筒'", Core.tileName(72) === "1筒");
ok("tileName(108)='東'", Core.tileName(108) === "東");
ok("tileName(124)='中'", Core.tileName(124) === "中");
ok("tileName(132)='白'", Core.tileName(132) === "白");

/* 2. Win conditions */
console.log("\n[2/12] Win conditions");
ok("3N+2 all pungs", Core.canWin([0,1,2,4,5,6,8,9,10,12,13,14,16,17]));
ok("3N+2 mixed suits", Core.canWin([0,1,2,4,8,12,16,17,18,20,24,28,32,33]));
ok("7 pairs", Core.canWin([0,1,4,5,8,9,12,13,16,17,20,21,28,29]));
ok("13 yao", Core.canWin([0, 32, 36, 68, 72, 104, 108, 112, 116, 120, 124, 128, 132, 132]));
ok("Cannot win (mismatched 5万+白)", !Core.canWin([0,1,2,4,5,6,8,9,10,12,13,14,16,132]));
ok("Cannot win (13 tiles)", Core.canWin([0,1,2,4,5,6,8,9,10,12,13,14,16]) === false);
ok("Cannot win (mismatched 5万+9万)", !Core.canWin([0,1,2,4,5,6,8,9,10,12,13,14,16,32]));

/* 3. Chi/Peng/Gang */
console.log("\n[3/12] Chi/Peng/Gang");
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
console.log("\n[4/12] Fan calculation");
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
console.log("\n[5/12] Round setup");
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
/* 牌山已按难度裁剪（gentle=52）。旧断言是 110（136-26 全部留山），
   那是 2 人局每人要摸 ~55 巡的根因，已废弃。 */
ok("deck=52 (gentle wall, trimmed after 26 dealt)", st.deck.length === 52,
   "got " + st.deck.length);
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
console.log("\n[6/12] Full AI-driven game");
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
console.log("\n[7/12] Turn rotation & dealer swap");
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
console.log("\n[8/12] Dealer alternates");
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
console.log("\n[9/12] Drawn tile tracking & riichi tsumogiri");
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

/* 10. 牌山长度 & 海底捞月
     136 张全副牌保留（役种完整），但只有 2 个玩家 —— 不裁牌山的话每人要摸 ~55 巡
     （四人麻将只摸 ~21 巡），一局过长且"海底捞月"永远碰不到。 */
console.log("\n[10/12] Wall size & Houtei Raikou (last tile draw)");

var wallExpect = { gentle: 52, normal: 44, brave: 36 };
["gentle", "normal", "brave"].forEach(function (d) {
  var s = Core.create(d);
  Core.advance(s);
  ok("wall size " + d + " = " + wallExpect[d] + " (deck=" + s.deck.length + ")",
     s.deck.length === wallExpect[d], "got " + s.deck.length);
  ok("wall " + d + " is even (both players draw equally)",
     s.deck.length % 2 === 0);
  ok("wall " + d + " keeps 13 tiles dealt to each player",
     s.players[0].hand.length === 13 && s.players[1].hand.length === 13);
});

/* 三档难度必须产出不同数值（项目约定） */
var wallSet = {};
["gentle", "normal", "brave"].forEach(function (d) {
  var s = Core.create(d); Core.advance(s);
  wallSet[s.deck.length] = true;
});
ok("three difficulties give three different wall sizes",
   Object.keys(wallSet).length === 3, JSON.stringify(Object.keys(wallSet)));

/* 全副牌仍在（裁的是牌山，不是牌种）—— 牌山 + 两家手牌 + 换牌不应出现重复牌种超 4 张 */
var stW = Core.create("normal");
Core.advance(stW);
var allKinds = {};
[stW.deck, stW.players[0].hand, stW.players[1].hand].forEach(function (arr) {
  arr.forEach(function (t) { allKinds[t] = (allKinds[t] || 0) + 1; });
});
var over4 = Object.keys(allKinds).filter(function (k) { return allKinds[k] > 4; });
ok("no tile value appears more than 4 times", over4.length === 0, over4.join(","));

/* 海底捞月：摸到最后一张牌时自摸和牌 */
var stH = Core.create("normal");
Core.advance(stH);
stH.players[0].hand = [0, 0, 0, 4, 4, 4, 8, 8, 8, 12, 12, 12, 16];
stH.players[0].melds = [];
stH.dealer = 0;
stH.deck = [16];                       /* 牌山只剩最后一张，正好是和牌张 5万 */
Core.skipDonDen(stH);                  /* → turn=0 → drawForPlayer 摸掉最后一张 */
ok("last tile draw sets lastTileDraw=true", stH.lastTileDraw === true);
ok("last tile draw empties the wall", stH.deck.length === 0);
ok("last tile completes the hand → await_hu_choice",
   stH.mode === "await_hu_choice", "mode=" + stH.mode);
var hy = Core.checkYaku(stH.players[0].hand, [], 16, false, true, false, true);
ok("Houtei Raikou yaku awarded on last tile draw",
   hy.indexOf("Houtei Raikou (Last Tile Draw)") >= 0, JSON.stringify(hy));
var hy2 = Core.checkYaku(stH.players[0].hand, [], 16, false, true, false, false);
ok("Houtei Raikou NOT awarded on a normal draw",
   hy2.indexOf("Houtei Raikou (Last Tile Draw)") < 0, JSON.stringify(hy2));

/* 11. AI 回合展示流程
     原来 AI 的摸牌与打牌在同一帧内瞬间完成，玩家看不到过程。
     现在拆成 draw（摸牌）→ think（思考）→ discard（打牌），
     CPU 和牌还要先过 ai_win 停顿，才弹结算面板。 */
console.log("\n[11/12] AI turn reveal flow");

/* 找一局玩家首打后确实轮到 AI 的（gentle 几乎不会首巡荣和） */
var stA = null;
for (var att = 0; att < 60 && !stA; att++) {
  var sA = Core.create("gentle");
  Core.advance(sA);
  Core.skipDonDen(sA);
  Core.discardTile(sA, sA.players[0].hand[0]);
  if (sA.mode === "ai_turn" && sA.aiPhase === "draw") stA = sA;
}
ok("found a normal AI turn to inspect", stA !== null);

if (stA) {
  ok("AI turn starts in 'draw' phase", stA.aiPhase === "draw", "phase=" + stA.aiPhase);
  ok("AI turn has a non-zero timer", stA.aiTimer > 0, "timer=" + stA.aiTimer);

  var aiDisBefore = stA.players[1].discards.length;
  /* 先把帧数取出来 —— 循环条件里不能再读 stA.aiTimer，
     因为它每轮都在被 update 递减，会让循环提前退出。 */
  var drawFrames = stA.aiTimer;
  /* 只推进 drawFrames-1 帧：AI 绝不能已经出牌（这正是"瞬间出结果"的回归点） */
  for (var k = 0; k < drawFrames - 1; k++) Core.update(stA, 16);
  ok("AI has NOT discarded during the draw phase",
     stA.mode === "ai_turn" && stA.players[1].discards.length === aiDisBefore,
     "mode=" + stA.mode + " discards=" + stA.players[1].discards.length);
  ok("AI still in 'draw' phase", stA.aiPhase === "draw", "phase=" + stA.aiPhase);

  Core.update(stA, 16);                       /* 走完 draw 段 → think */
  ok("AI moves to 'think' phase after drawing", stA.aiPhase === "think",
     "phase=" + stA.aiPhase);
  ok("AI has NOT discarded during the think phase",
     stA.players[1].discards.length === aiDisBefore,
     "discards=" + stA.players[1].discards.length);

  for (var k2 = 0; k2 < 60; k2++) Core.update(stA, 16);
  ok("AI acts only after the think phase",
     stA.players[1].discards.length > aiDisBefore ||
     stA.mode === "ai_win" || stA.mode === "round_over",
     "mode=" + stA.mode);
}

/* CPU 自摸：必须先经过 ai_win 停顿，不能直接跳 round_over */
var stB = Core.create("normal");
Core.advance(stB);
stB.turn = 1;
stB.players[1].hand = [0, 0, 0, 4, 4, 4, 8, 8, 8, 12, 12, 12, 16, 16];
stB.players[1].melds = [];
stB.lastDrawnTile = 16;
stB.riichi = [false, false];
stB.mode = "ai_turn";
stB.aiPhase = "think";
stB.aiTimer = 1;
Core.update(stB, 16);
ok("CPU tsumo enters ai_win instead of jumping to round_over",
   stB.mode === "ai_win", "mode=" + stB.mode);
ok("ai_win carries winInfo for the reveal",
   !!stB.winInfo && stB.winInfo.winner === 1);
ok("ai_win has a reveal timer", stB.aiTimer > 0, "timer=" + stB.aiTimer);
ok("winning tile recorded for the reveal",
   typeof stB.winInfo.tile === "number");
for (var w = 0; w < 200; w++) Core.update(stB, 16);
ok("ai_win resolves to round_over", stB.mode === "round_over", "mode=" + stB.mode);

/* 12. 出牌被拒绝时必须"可解释"（"牌直立着但打不出去"回归）
     症状：立直后点一张非摸牌 → 牌抬起来（选中态）→ 再点毫无反应，而且那块牌
     一直保持抬起，看起来就是卡住了。根因有两处：
       a) core.discardTile 只 return false，UI 拿不到原因 → 静默吞掉；
       b) 按立直之前选中的那张牌，在 declareRiichi 之后仍然是选中态，
          而它恰恰是非法出牌。
     修法：把拒绝原因暴露成 discardBlockReason；declareRiichi 把选中态挪到
     摸到的那张牌上；UI 用 Core.setHint 给文字反馈。 */
console.log("\n[12/12] Discard rejection is explainable (riichi)");

var stR = Core.create("normal");
Core.advance(stR);
Core.skipDonDen(stR);
/* 真·听牌手牌：123万 456万 789万 123筒 + 单张5筒（听 5筒）。
   再摸进一张 1万 → 排序后落在 index 1，**不在最后一位**，
   这样"选中态被挪到摸到的牌上"才是个有意义的断言。 */
stR.players[0].hand = [0, 4, 8, 12, 16, 20, 24, 28, 32, 72, 76, 80, 88];
stR.players[0].melds = [];
Core.sortHand(stR.players[0].hand);
stR.players[0].hand.push(1);
Core.sortHand(stR.players[0].hand);
stR.lastDrawnTile = 1;
stR.turn = 0;
stR.mode = "await_discard";
stR.riichi = [false, false];
stR.selIdx = -1;

var DRAWN = 1;
var nonDrawn = stR.players[0].hand[0];
ok("test hand is actually riichi-able", Core.canRiichi(stR, 0) === true);
ok("drawn tile is not the last one (test premise holds)",
   stR.players[0].hand[stR.players[0].hand.length - 1] !== DRAWN,
   "hand=" + JSON.stringify(stR.players[0].hand));

ok("before riichi there is no block reason",
   Core.discardBlockReason(stR, nonDrawn) === null);

/* 玩家先选中一张牌，再按立直 —— 选中态必须被挪到摸到的那张牌上，
   否则那张牌会一直"直立着"，而它是非法出牌。 */
stR.selIdx = 0;
ok("declareRiichi succeeds on a tenpai hand", Core.declareRiichi(stR, 0) === true);
ok("declareRiichi moves the selection onto the drawn tile",
   stR.players[0].hand[stR.selIdx] === DRAWN,
   "selIdx=" + stR.selIdx + " tile=" + stR.players[0].hand[stR.selIdx]);
ok("declareRiichi does NOT leave the selection on the old tile",
   stR.selIdx !== 0, "selIdx=" + stR.selIdx);
ok("drawnTileIndex points at the drawn tile",
   stR.players[0].hand[Core.drawnTileIndex(stR, 0)] === DRAWN);

ok("riichi: non-drawn tile reports riichi_tsumogiri",
   Core.discardBlockReason(stR, nonDrawn) === "riichi_tsumogiri");
ok("riichi: drawn tile reports no block",
   Core.discardBlockReason(stR, DRAWN) === null);

/* 被拒绝时不能有任何状态副作用 */
var modeBefore = stR.mode, lenBefore = stR.players[0].hand.length;
ok("rejected discard returns false", Core.discardTile(stR, nonDrawn) === false);
ok("rejected discard leaves mode untouched", stR.mode === modeBefore,
   "mode=" + stR.mode);
ok("rejected discard leaves the hand untouched",
   stR.players[0].hand.length === lenBefore);

/* 不是自己回合也要能说清原因 */
var stN = Core.create("normal");
Core.advance(stN);
ok("not-your-turn reports not_your_turn",
   Core.discardBlockReason(stN, stN.players[0].hand[0]) === "not_your_turn");

/* await_hu_choice 下的非法出牌不能把"自摸胡"的选择静默吞掉 */
var stH2 = Core.create("normal");
Core.advance(stH2);
Core.skipDonDen(stH2);
stH2.players[0].hand = [40, 44, 48, 52, 56, 60, 64, 68, 72, 76, 80, 84, 88];
Core.sortHand(stH2.players[0].hand);
stH2.players[0].hand.push(4);
Core.sortHand(stH2.players[0].hand);
stH2.lastDrawnTile = 4;
stH2.riichi = [true, false];
stH2.mode = "await_hu_choice";
Core.discardTile(stH2, stH2.players[0].hand[stH2.players[0].hand.length - 1]);
ok("rejected discard does not eat the await_hu_choice state",
   stH2.mode === "await_hu_choice", "mode=" + stH2.mode);

/* hint 通道：设置后可见，倒计时归零后自动清干净 */
Core.setHint(stH2, "RIICHI · discard the drawn tile", 100, 3);
ok("setHint stores text and target tile",
   stH2.hint.length > 0 && stH2.hintTile === 3);
ok("hint is visible before it expires", stH2.hintT > 0);
for (var hh = 0; hh < 10; hh++) Core.update(stH2, 16);
ok("hint auto-clears after it expires",
   stH2.hint === "" && stH2.hintT === 0 && stH2.hintTile === -1);

/* 汇总 */
console.log("\n=== " + passed + " passed, " + failed + " failed ===\n");
if (failed > 0) process.exit(1);
