/* Arcade Mahjong 2P · core.js
   电子基盘 / 天开眼风格：2 人对战（玩家 vs 电脑）
   日式麻将规则：三元换牌（Don-den）、没有役不能和牌、立直、役满。
   UI 全英文；三档难度控制 AI 出牌/碰杠的侵略性。 */
"use strict";

var Core = (function () {

  /* ===== 画布 ===== */
  var W = 360, H = 500, HUD = 22;

  /* ===== 三档难度 =====
     wall = 发完起手后牌山保留的张数。
     全副 136 张全部保留（役种完整），只裁牌山，因为本作只有 2 人：
     不裁的话每人要摸 ~55 巡（四人麻将只摸 ~21 巡），一局过长，
     而且"海底捞月"（摸到最后一张自摸）永远碰不到。
     44 张 → 每人 22 巡，正好对齐四人街机麻将的节奏。 */
  var DIFFS = {
    gentle: { id:"gentle", name:"Gentle", blurb:"Leisurely CPU",
              aggro:0.25, pungOnly:0.25, discardSafety:0.85, wall:52 },
    normal: { id:"normal", name:"Normal", blurb:"Standard rules",
              aggro:0.60, pungOnly:0.60, discardSafety:0.55, wall:44 },
    brave:  { id:"brave",  name:"Brave",  blurb:"Sharp CPU",
              aggro:0.95, pungOnly:0.95, discardSafety:0.15, wall:36 }
  };
  var DIFF_IDS = ["gentle","normal","brave"];

  /* ===== AI 回合展示节奏（帧，60fps） =====
     原来 AI 的摸牌与打牌在同一帧内瞬间完成，玩家只看到结果、看不到过程。
     现在拆成三段：draw（摸牌）→ think（思考）→ discard（打牌）。
     外壳在 draw 段补"牌从牌山飞到手牌"的动画，在打牌后补"牌飞进牌河"的动画。 */
  var AI_DRAW_FRAMES  = 26;   /* ≈430ms —— 够飞牌动画走完 */
  var AI_THINK_FRAMES = 34;   /* ≈570ms —— 看得见 CPU 在思考 */
  var AI_WIN_FRAMES   = 80;   /* ≈1.3s —— 和牌展示停顿，之后才弹结算面板 */

  /* 进入 AI 回合：phase = "draw"（刚摸完牌）或 "think"（吃碰后没摸牌） */
  function beginAiTurn(st, phase) {
    st.mode = "ai_turn";
    st.aiPhase = phase;
    st.aiTimer = (phase === "draw") ? AI_DRAW_FRAMES : AI_THINK_FRAMES;
  }

  /* 三元换牌次数。菜单文案引用这个常量，避免两边写死不同的数字
     （曾出现菜单写 5 次、实际只给 3 次的不一致）。 */
  var DON_DEN_COUNT = 3;

  /* ===== 牌编码 0..135 ===== */
  var ZI_NAMES = ["東","南","西","北","中","發","白"];
  var SUITS = ["wan","tiao","tong","zi"];

  function tileKind(n)   { return n >>> 2; }
  function kindSuit(k)   { return k < 27 ? (k < 9 ? 0 : (k < 18 ? 1 : 2)) : 3; }
  function kindRank(k)   { return k < 27 ? (k % 9) + 1 : k - 27; }
  function kindName(k)   {
    /* 与牌面保持一致用繁体（牌面画的是「萬」） */
    var s = kindSuit(k), r = kindRank(k);
    if (s === 0) return r + "萬";
    if (s === 1) return r + "條";
    if (s === 2) return r + "筒";
    return ZI_NAMES[r];
  }
  function tileName(n)   { return kindName(tileKind(n)); }

  /* ===== 洗牌发牌 ===== */
  function newDeck() {
    var d = [];
    for (var i = 0; i < 136; i++) d.push(i);
    for (var j = d.length - 1; j > 0; j--) {
      var k = Math.floor(Math.random() * (j + 1));
      var t = d[j]; d[j] = d[k]; d[k] = t;
    }
    return d;
  }

  function sortHand(h) {
    h.sort(function (a, b) { return (tileKind(a) - tileKind(b)) || (a - b); });
  }

  function handCounts(hand) {
    var c = new Array(34); for (var i = 0; i < 34; i++) c[i] = 0;
    for (var j = 0; j < hand.length; j++) c[tileKind(hand[j])]++;
    return c;
  }

  /* =========================================================
     胡牌判定：3N+2 标准型 / 七对 / 十三幺
     ========================================================= */
  function canWin(hand) {
    if (hand.length % 3 !== 2) return false;
    var c = handCounts(hand);
    return checkStandard(c) || check7Pairs(c) || check13Yao(c);
  }

  /* 完整胡牌判定（含役种检查）
     winTile 省略时退回 hand 最后一张（手牌是排序的，所以调用方最好显式传"摸到的那张牌"） */
  function canWinFull(hand, melds, riichi, selfDraw, firstDraw, lastTileDraw, winTile) {
    if (!canWin(hand)) return false;
    if (typeof winTile !== "number") winTile = hand[hand.length - 1];
    var yaku = checkYaku(hand, melds, winTile, riichi, selfDraw, firstDraw, lastTileDraw);
    return hasYaku(yaku);
  }

  /* 取"本回合摸到的那张牌"。吃碰杠之后没有摸牌，退回手牌最后一张。
     注意：手牌是排序的，摸到的牌不一定在最后一位。 */
  function drawnTileOf(st, p) {
    if (typeof st.lastDrawnTile === "number" && p.hand.indexOf(st.lastDrawnTile) >= 0) {
      return st.lastDrawnTile;
    }
    return p.hand[p.hand.length - 1];
  }

  function checkStandard(c) {
    var cc = c.slice();
    for (var j = 0; j < 34; j++) {
      if (cc[j] >= 2) {
        cc[j] -= 2;
        if (tryMelds(cc, 0)) { cc[j] += 2; return true; }
        cc[j] += 2;
      }
    }
    return false;
  }
  function tryMelds(c, from) {
    while (from < 34 && c[from] === 0) from++;
    if (from === 34) return true;
    if (c[from] >= 3) {
      c[from] -= 3;
      if (tryMelds(c, from)) { c[from] += 3; return true; }
      c[from] += 3;
    }
    var s = kindSuit(from);
    if (s < 3) {
      var k1 = from + 1, k2 = from + 2;
      if (k2 < 34 && kindSuit(k1) === s && kindSuit(k2) === s &&
          c[k1] > 0 && c[k2] > 0) {
        c[from]--; c[k1]--; c[k2]--;
        if (tryMelds(c, from)) { c[from]++; c[k1]++; c[k2]++; return true; }
        c[from]++; c[k1]++; c[k2]++;
      }
    }
    return false;
  }
  /* 只允许顺子的拆解（平和判定用） */
  function tryMeldsOnly(c, from) {
    while (from < 34 && c[from] === 0) from++;
    if (from === 34) return true;
    var s = kindSuit(from);
    if (s < 3) {
      var k1 = from + 1, k2 = from + 2;
      if (k2 < 34 && kindSuit(k1) === s && kindSuit(k2) === s &&
          c[k1] > 0 && c[k2] > 0) {
        c[from]--; c[k1]--; c[k2]--;
        if (tryMeldsOnly(c, from)) { c[from]++; c[k1]++; c[k2]++; return true; }
        c[from]++; c[k1]++; c[k2]++;
      }
    }
    return false;
  }

  function check7Pairs(c) {
    var sum = 0;
    for (var i = 0; i < 34; i++) {
      if (c[i] % 2 !== 0) return false;
      sum += c[i];
    }
    return sum === 14;
  }

  function isYao(k) {
    var s = kindSuit(k);
    if (s === 3) return true;
    return (k % 9) === 0 || (k % 9) === 8;
  }
  function check13Yao(c) {
    var yaos = [0, 8, 9, 17, 18, 26, 27, 28, 29, 30, 31, 32, 33];
    var sum = 0;
    for (var i = 0; i < 34; i++) {
      var isY = yaos.indexOf(i) >= 0;
      if (isY && c[i] === 0) return false;
      if (!isY && c[i] > 0) return false;
      sum += c[i];
    }
    return sum === 14;
  }

  /* =========================================================
     响应判定：吃 / 碰 / 明杠 / 暗杠
     ========================================================= */
  function chiOptions(hand, tile) {
    var k = tileKind(tile);
    if (kindSuit(k) === 3) return [];
    var c = handCounts(hand);
    var n = k % 9;
    var opts = [];
    if (n >= 2 && c[k - 2] > 0 && c[k - 1] > 0) opts.push([k - 2, k - 1]);
    if (n >= 1 && n <= 7 && c[k - 1] > 0 && c[k + 1] > 0) opts.push([k - 1, k + 1]);
    if (n <= 6 && c[k + 1] > 0 && c[k + 2] > 0) opts.push([k + 1, k + 2]);
    return opts;
  }
  function canChi(hand, tile)     { return chiOptions(hand, tile).length > 0; }
  function canPeng(hand, tile) {
    var c = handCounts(hand);
    return c[tileKind(tile)] >= 2;
  }
  function canGang(hand, tile) {
    var c = handCounts(hand);
    return c[tileKind(tile)] === 3;
  }
  function anGangKind(hand) {
    var c = handCounts(hand);
    for (var j = 0; j < 34; j++) if (c[j] === 4) return j;
    return -1;
  }
  function canHu(hand, tile, melds, riichi, firstDraw, lastTileDraw) {
    var h = hand.slice();
    h.push(tile);
    return canWinFull(h, melds, riichi, false, firstDraw, lastTileDraw);
  }

  /* =========================================================
     番数（简化国标子集）
     ========================================================= */
  function calcFan(hand14, melds, winTile) {
    var fan = 1;
    var reasons = ["Base"];
    var c = handCounts(hand14);

    var isYao = true, isHonors = true, isOneSuit = true, suitUsed = -1;
    for (var i = 0; i < 34; i++) {
      if (c[i] === 0) continue;
      var s = kindSuit(i);
      if (s !== 3) {
        isHonors = false;
        if (suitUsed === -1) suitUsed = s;
        else if (suitUsed !== s) { isOneSuit = false; }
        if (!(i % 9 === 0 || i % 9 === 8)) isYao = false;
      }
    }
    for (var m = 0; m < melds.length; m++) {
      var meld = melds[m];
      if (meld.type === "chi") isYao = false;
      for (var t = 0; t < meld.tiles.length; t++) {
        var k = meld.tiles[t]; /* meld.tiles 存的已是牌种类，勿再套 tileKind */
        var ss = kindSuit(k);
        if (ss !== 3) {
          isHonors = false;
          if (suitUsed === -1) suitUsed = ss;
          else if (suitUsed !== ss) isOneSuit = false;
        }
      }
    }

    var allPung = true;
    for (var mm = 0; mm < melds.length; mm++) {
      if (melds[mm].type === "chi") { allPung = false; break; }
    }
    if (allPung) {
      var allPungOK = false;
      for (var pp = 0; pp < 34 && !allPungOK; pp++) {
        if (c[pp] >= 2) {
          var ok = true;
          for (var qq = 0; qq < 34; qq++) {
            var rem = (qq === pp ? c[qq] - 2 : c[qq]);
            if (rem % 3 !== 0) { ok = false; break; }
          }
          if (ok) allPungOK = true;
        }
      }
      if (allPungOK && hand14.length >= 5) {
        fan += 2; reasons.push("All Pungs");
      }
    }

    if (melds.length === 0 && check7Pairs(c))    { fan += 2; reasons.push("Seven Pairs"); }
    if (melds.length === 0 && check13Yao(c))     { fan += 3; reasons.push("13 Orphans"); }

    if (isHonors)                                { fan += 4; reasons.push("All Honors"); }
    else if (isOneSuit)                           { fan += 3; reasons.push("Full Flush"); }
    if (isYao && !isHonors)                       { fan += 2; reasons.push("All Terminals"); }

    return { fan: fan, reasons: reasons };
  }

  /* =========================================================
     日式役种（Japanese Yaku）
     没有役不能和牌！
     ========================================================= */
  function checkYaku(hand14, melds, winTile, riichi, selfDraw, firstDraw, lastTileDraw) {
    var yaku = [];
    var c = handCounts(hand14);

    /* --- 役满 (Yakuman) --- */
    /* 大三元: 3 pung of 中(30) 发(31) 白(32) */
    var daSanGen = (c[30] >= 3 || anyMeldKind(melds, 30)) &&
                   (c[31] >= 3 || anyMeldKind(melds, 31)) &&
                   (c[32] >= 3 || anyMeldKind(melds, 32));
    if (daSanGen) yaku.push("Da San Gen (3 Dragons)");

    /* 大四喜: 4 pung of 东南西北 */
    var daShiiKi = (c[27] >= 3 || anyMeldKind(melds, 27)) &&
                   (c[28] >= 3 || anyMeldKind(melds, 28)) &&
                   (c[29] >= 3 || anyMeldKind(melds, 29)) &&
                   (c[33] >= 3 || anyMeldKind(melds, 33));
    if (daShiiKi) yaku.push("Da Shii Ki (4 Winds)");

    /* 国士无双: 13 orphans */
    if (check13Yao(c) && melds.length === 0) yaku.push("Kokushi Musou (13 Orphans)");

    /* 字一色: All Honors */
    var allHonors = true;
    for (var i = 0; i < 34; i++) {
      if (c[i] > 0 && kindSuit(i) !== 3) { allHonors = false; break; }
    }
    if (allHonors && melds.length === 0 && hand14.length >= 14) yaku.push("Chiin Gin (All Honors)");

    /* 四暗刻: 4 concealed pungs */
    var concealedPungs = 0;
    for (var j = 0; j < 34; j++) {
      if (c[j] === 3) concealedPungs++;
    }
    /* 将 (pair) 不算 */
    var hasPair = false;
    for (var k = 0; k < 34; k++) {
      if (c[k] >= 2) { hasPair = true; break; }
    }
    if (concealedPungs >= 4 && melds.length === 0) yaku.push("Shi An Kou (4 Concealed Pungs)");

    /* 绿一色: All Green (2,3,4,6,8 条 + 发) */
    var greenTiles = {10:1,11:1,12:1,14:1,16:1,31:1};
    var allGreen = true;
    for (var g = 0; g < 34; g++) {
      if (c[g] > 0 && !greenTiles[g]) { allGreen = false; break; }
    }
    if (allGreen && melds.length === 0 && hand14.length >= 14) yaku.push("Hatsu Shou (All Green)");

    /* 清一色 (Chii-iisuu): All one suit */
    var suitUsed = -1, oneSuit = true;
    for (var s = 0; s < 34; s++) {
      if (c[s] === 0) continue;
      var ss = kindSuit(s);
      if (ss === 3) { oneSuit = false; break; }
      if (suitUsed === -1) suitUsed = ss;
      else if (suitUsed !== ss) { oneSuit = false; break; }
    }
    var meldsOneSuit = oneSuit;
    for (var m = 0; m < melds.length && meldsOneSuit; m++) {
      for (var t = 0; t < melds[m].tiles.length; t++) {
        var ks = kindSuit(melds[m].tiles[t]);
        if (ks === 3 || (suitUsed !== -1 && ks !== suitUsed)) { meldsOneSuit = false; break; }
      }
    }
    if (oneSuit && meldsOneSuit && suitUsed >= 0) yaku.push("Chii-iisuu (Full Flush)");

    /* --- 普通役 --- */
    /* 役牌 (Yakuhai): pung of wind or dragon */
    var yakuhai = [];
    for (var v = 27; v <= 32; v++) {
      if ((c[v] >= 3 || anyMeldKind(melds, v)) && c[v] >= 2) {
        /* only count if it's a pung (triplet) not just a pair */
        if (c[v] >= 3 || anyMeldKind(melds, v)) yakuhai.push(kindName(v));
      }
    }
    if (yakuhai.length > 0) yaku.push("Yakuhai (" + yakuhai.join(", ") + ")");

    /* 断幺九 (Tanyao): All Simples - no terminals or honors */
    var allSimples = true;
    for (var a = 0; a < 34; a++) {
      if (c[a] > 0 && isYao(a)) { allSimples = false; break; }
    }
    var meldsSimples = allSimples;
    for (var b = 0; b < melds.length && meldsSimples; b++) {
      for (var d = 0; d < melds[b].tiles.length; d++) {
        if (isYao(melds[b].tiles[d])) { meldsSimples = false; break; }
      }
    }
    if (allSimples && meldsSimples) yaku.push("Tanyao (All Simples)");

    /* 立直 (Riichi) */
    if (riichi) yaku.push("Riichi");

    /* 门清自摸 (Tsumo + Menzen) */
    if (selfDraw && melds.length === 0) yaku.push("Menzen Tsumo (Pure Hand Self-draw)");

    /* 一发 (Ippatsu): win on first draw after riichi */
    if (riichi && firstDraw && selfDraw) yaku.push("Ippatsu (First Draw)");

    /* 海底捞月 (Houtei Raikou): win on last tile from wall */
    if (lastTileDraw && selfDraw) yaku.push("Houtei Raikou (Last Tile Draw)");

    /* --- 小三元 / 小四喜 (Partial Yakuman) --- */
    /* 小三元: 2 dragon pungs + 1 dragon pair */
    var dragonPungs = 0;
    for (var dg = 30; dg <= 32; dg++) {
      if (c[dg] >= 3 || anyMeldKind(melds, dg)) dragonPungs++;
    }
    var dragonPair = (c[30] === 2 || c[31] === 2 || c[32] === 2);
    if (dragonPungs === 2 && dragonPair) yaku.push("Shou San Gen (Little 3 Dragons)");

    /* 小四喜: 3 wind pungs + 1 wind pair */
    var windPungs = 0;
    for (var wd = 27; wd <= 33; wd++) {
      if (c[wd] >= 3 || anyMeldKind(melds, wd)) windPungs++;
    }
    var windPair = false;
    for (var wp = 27; wp <= 33; wp++) {
      if (c[wp] === 2) { windPair = true; break; }
    }
    if (windPungs === 3 && windPair) yaku.push("Shou Shii Ki (Little 4 Winds)");

    /* 平和 (Pinfu): all sequences, non-terminal non-honor pair */
    if (melds.length === 0) {
      var pinfuOK = true;
      var cc2 = c.slice();
      var pairFound = false;
      var sequences = 0;
      /* Try to find valid decomposition */
      for (var pf = 0; pf < 34 && pinfuOK; pf++) {
        if (cc2[pf] >= 2 && !isYao(pf) && pf % 9 !== 0 && pf % 9 !== 8) {
          cc2[pf] -= 2; pairFound = true;
          if (!tryMeldsOnly(cc2, 0)) pinfuOK = false;
          cc2[pf] += 2;
        }
      }
      if (pinfuOK && pairFound) yaku.push("Pinfu (All Sequences)");
    }

    /* 一气通贯 (Ittsu): 1-2-3, 4-5-6, 7-8-9 of same suit */
    for (var it = 0; it < 3; it++) {
      var base = it * 9;
      if (c[base+0] >= 1 && c[base+1] >= 1 && c[base+2] >= 1 &&
          c[base+3] >= 1 && c[base+4] >= 1 && c[base+5] >= 1 &&
          c[base+6] >= 1 && c[base+7] >= 1 && c[base+8] >= 1) {
        yaku.push("Ittsu (Straight)"); break;
      }
    }

    /* 混一色 (Honitsu): one suit + honors */
    var suitH = -1, honorsOnly = false, oneSuitH = true;
    for (var sh = 0; sh < 34; sh++) {
      if (c[sh] === 0) continue;
      var sH = kindSuit(sh);
      if (sH === 3) { honorsOnly = true; continue; }
      if (suitH === -1) suitH = sH;
      else if (suitH !== sH) { oneSuitH = false; break; }
    }
    if (oneSuitH && honorsOnly && suitH >= 0) yaku.push("Honitsu (Half Flush)");

    return yaku;
  }

  function anyMeldKind(melds, k) {
    for (var i = 0; i < melds.length; i++) {
      for (var j = 0; j < melds[i].tiles.length; j++) {
        if (melds[i].tiles[j] === k) return true;
      }
    }
    return false;
  }

  function hasYaku(yakuList) {
    return yakuList.length > 0;
  }

  /* =========================================================
     玩家 & 状态（2 人版）
     ========================================================= */
  function newPlayer(name, isHuman) {
    return {
      name: name,
      isHuman: isHuman,
      hand: [],
      melds: [],
      discards: [],
      wins: 0,
      losses: 0
    };
  }

  function create(difficulty) {
    var d = DIFFS[difficulty] ? difficulty : "normal";
    return {
      mode: "menu",
      diff: d,
      aggro: DIFFS[d].aggro,
      pungOnly: DIFFS[d].pungOnly,
      discardSafety: DIFFS[d].discardSafety,
      deck: [],
      wallSize: DIFFS[d].wall,
      players: [
        newPlayer("You", true),
        newPlayer("CPU", false)
      ],
      turn: 0,
      dealer: 0,
      round: 1,
      options: [],
      lastDiscard: null,
      winInfo: null,
      msg: "",
      selIdx: -1,
      /* 一次性提示（toast）。render 会把它画在牌桌中段，update 里倒计时归零。
         st.msg 是个"死"字段 —— render.js 从来没读过它，所以规则性的拒绝
         在画面上完全静默；hint 才是真正会被显示出来的通道。 */
      hint: "",
      hintT: 0,
      hintTile: -1,
      aiPhase: "",
      aiTimer: 0,
      lastTileDraw: false,
      /* 本回合摸到的那张牌（牌值）。手牌是排序的，所以"摸到的牌"不一定在最后一位，
         凡是"打出摸到的牌 / 用摸到的牌和牌"的逻辑都必须用它，不能用 hand[length-1]。
         吃碰杠之后没有摸牌，置为 null。 */
      lastDrawnTile: null,
      /* 三元换牌 */
      donDenCount: 3,
      dondenSelSet: [],
      /* 立直 */
      riichi: [false, false],
      riichiFirstDraw: [false, false]
    };
  }

  /* =========================================================
     一局开始
     ========================================================= */
  function startRound(st) {
    st.deck = newDeck();
    for (var i = 0; i < 2; i++) {
      st.players[i].hand = [];
      st.players[i].melds = [];
      st.players[i].discards = [];
    }
    for (var j = 0; j < 2; j++) {
      for (var k = 0; k < 13; k++) st.players[j].hand.push(st.deck.pop());
    }
    for (var j2 = 0; j2 < 2; j2++) sortHand(st.players[j2].hand);
    /* 裁牌山：只留 DIFFS[diff].wall 张（见 DIFFS 注释）。
       deck.pop() 从尾部取牌，所以保留尾部这一段。 */
    st.wallSize = DIFFS[st.diff].wall;
    if (st.deck.length > st.wallSize) {
      st.deck = st.deck.slice(st.deck.length - st.wallSize);
    }
    st.turn = st.dealer;
    st.lastDiscard = null;
    st.options = [];
    st.winInfo = null;
    st.msg = "";
    st.selIdx = -1;
    st.aiPhase = "";
    st.aiTimer = 0;
    st.donDenCount = DON_DEN_COUNT;
    st.dondenSelSet = [];         /* 新一局清空换牌选中（旧字段 donDenSel 已废弃） */
    st.riichi = [false, false];
    st.riichiFirstDraw = [false, false];
    st.lastTileDraw = false;
    st.lastDrawnTile = null;
    /* 三元换牌阶段：玩家选牌 → 电脑选牌 → 交换 */
    st.mode = "await_donden";
    st.msg = "Select a tile to exchange (3 left)";
  }

  function drawForPlayer(st) {
    if (st.deck.length === 0) {
      st.mode = "draw";
      st.msg = "Draw · Tiles exhausted";
      return false;
    }
    var p = st.players[st.turn];
    var t = st.deck.pop();
    p.hand.push(t);
    sortHand(p.hand);
    st.lastDrawnTile = t;                 /* 记录真正摸到的那张牌 */
    var lastTileDraw = (st.deck.length === 0);
    st.lastTileDraw = lastTileDraw;
    /* 立直后必须打出摸到的牌（不能和牌以外的选择） */
    if (st.riichi[st.turn]) {
      /* 检查是否能和牌 */
      if (canHu(p.hand, t, p.melds, st.riichi[st.turn], st.riichiFirstDraw[st.turn], lastTileDraw) && hasYaku(checkYaku(p.hand, p.melds, t, st.riichi[st.turn], true, st.riichiFirstDraw[st.turn], lastTileDraw))) {
        st.riichiFirstDraw[st.turn] = false;
        if (p.isHuman) {
          st.mode = "await_hu_choice";
          return true;
        }
        /* AI 立直自摸：先走展示流程，aiTurn 里再揭晓 */
        beginAiTurn(st, "draw");
        return true;
      }
      if (p.isHuman) {
        /* 玩家立直：强制摸切，本来就没有选择余地，直接打出 */
        var idx = p.hand.indexOf(t);
        if (idx >= 0) {
          p.hand.splice(idx, 1);
          p.discards.push(t);
          sortHand(p.hand);
          st.lastDiscard = { tile: t, fromPlayer: st.turn };
          st.riichiFirstDraw[st.turn] = false;
          st.selIdx = -1;
          handleAfterDiscard(st);
          return true;
        }
      }
      /* AI 立直：不要在这里瞬间摸切，交给 aiTurn 在展示完之后处理 */
      beginAiTurn(st, "draw");
      return true;
    }
    if (p.isHuman) {
      var canW = canWinFull(p.hand, p.melds, st.riichi[st.turn], true,
                            st.riichiFirstDraw[st.turn], lastTileDraw, t);
      st.mode = canW ? "await_hu_choice" : "await_discard";
    } else {
      beginAiTurn(st, "draw");
    }
    return true;
  }

  /* =========================================================
     三元换牌（Don-den Exchange）
     ========================================================= */
  function doDonDenExchange(st, playerTileIdxs) {
    var p = st.players[0];
    var cpuHand = st.players[1].hand;
    if (st.donDenCount <= 0) return false;
    if (!playerTileIdxs || playerTileIdxs.length === 0) return false;
    var count = Math.min(playerTileIdxs.length, st.donDenCount, p.hand.length, cpuHand.length);
    /* 只取前 count 个选中索引，按降序排列（从后往前删避免索引错位） */
    var actualIdxs = playerTileIdxs.slice(0, count).sort(function(a, b) { return b - a; });
    /* 1. 收集玩家选中的牌并从手牌移除 */
    var playerTiles = [];
    for (var pi = 0; pi < actualIdxs.length; pi++) {
      var idx = actualIdxs[pi];
      if (idx >= 0 && idx < p.hand.length) {
        playerTiles.push(p.hand[idx]);
        p.hand.splice(idx, 1);
      }
    }
    playerTiles.reverse(); /* 恢复原始顺序 */
    /* 2. CPU 选对应数量的牌（AI 选最没用的牌），移除 */
    var cpuTiles = [];
    for (var c = 0; c < count; c++) {
      var ci = aiPickDiscard(cpuHand, st);
      if (ci < 0) ci = 0;
      cpuTiles.push(cpuHand[ci]);
      cpuHand.splice(ci, 1);
    }
    /* 3. 把 CPU 的牌给玩家，把玩家的牌给 CPU */
    for (var di = 0; di < playerTiles.length; di++) {
      p.hand.push(cpuTiles[di]);
      cpuHand.push(playerTiles[di]);
    }
    sortHand(p.hand);
    sortHand(cpuHand);
    st.donDenCount -= count;
    st.dondenSelSet = [];
    if (st.donDenCount > 0) {
      st.mode = "await_donden";
      st.msg = "Exchange " + st.donDenCount + " left · Select tiles";
    } else {
      st.msg = "Exchange finished · Game begins!";
      st.turn = st.dealer;
      drawForPlayer(st);
    }
    return true;
  }

  function skipDonDen(st) {
    if (st.donDenCount <= 0) return false;
    st.donDenCount = 0;
    st.dondenSelSet = [];
    st.msg = "Exchange finished · Game begins!";
    st.turn = st.dealer;
    drawForPlayer(st);
    return true;
  }

  /* =========================================================
     立直（Riichi）
     ========================================================= */
  function canRiichi(st, pid) {
    var p = st.players[pid];
    if (st.riichi[pid]) return false;
    if (p.melds.length > 0) return false;
    if (p.hand.length !== 14) return false;
    /* 必须处于听牌状态（去掉一张牌后能听） */
    for (var i = 0; i < p.hand.length; i++) {
      var h = p.hand.slice();
      h.splice(i, 1);
      if (isTenpai(h)) return true;
    }
    return false;
  }

  function isTenpai(hand) {
    if (hand.length % 3 !== 1) return false;
    /* 检查是否听牌：是否存在一张牌能胡 */
    for (var k = 0; k < 34; k++) {
      if (handCounts(hand)[k] >= 4) continue;
      var test = hand.slice();
      test.push(k * 4);
      if (canWin(test)) return true;
    }
    return false;
  }

  function declareRiichi(st, pid) {
    if (!canRiichi(st, pid)) return false;
    var p = st.players[pid];
    st.riichi[pid] = true;
    st.riichiFirstDraw[pid] = true;
    /* 立直后只能打摸到的那张牌 —— 直接把选中态挪到那张牌上。
       否则"按立直之前就选中好的那张牌"会一直保持抬起+金光的选中态，
       而它恰恰是非法出牌：牌直立着、怎么点都打不出去。
       （selIdx 只描述玩家 0 的手牌，AI 立直时不能碰它。） */
    if (pid === 0) st.selIdx = p.hand.indexOf(drawnTileOf(st, p));
    st.msg = "Riichi!";
    return true;
  }

  /* =========================================================
     出牌
     ========================================================= */
  function discard(st, tile) {
    var p = st.players[st.turn];
    var idx = p.hand.indexOf(tile);
    if (idx < 0) return false;
    p.hand.splice(idx, 1);
    p.discards.push(tile);
    sortHand(p.hand);
    st.lastDiscard = { tile: tile, fromPlayer: st.turn };
    st.selIdx = -1;
    handleAfterDiscard(st);
    return true;
  }

  function handleAfterDiscard(st) {
    var tile = st.lastDiscard.tile;
    var from = st.lastDiscard.fromPlayer;
    var to = 1 - from;
    var pp = st.players[to];

    var opts = [];
    if (canHu(pp.hand, tile, pp.melds, st.riichi[to], false)) opts.push({ type: "hu" });
    /* 立直后不能吃碰杠 */
    if (!st.riichi[to]) {
      if (canGang(pp.hand, tile)) opts.push({ type: "gang" });
      if (canPeng(pp.hand, tile)) opts.push({ type: "peng" });
      if (canChi(pp.hand, tile)) opts.push({ type: "chi" });
    }

    if (pp.isHuman) {
      if (opts.length > 0) {
        st.mode = "waiting_response";
        st.options = opts;
        return;
      }
    } else {
      for (var i = 0; i < opts.length; i++) {
        if (opts[i].type === "hu") {
          doHuDiscard(st, to, tile);
          return;
        }
      }
      for (var g = 0; g < opts.length; g++) {
        if (opts[g].type === "gang" && Math.random() < st.aggro) {
          doGang(st, to, tile);
          return;
        }
      }
      for (var pg = 0; pg < opts.length; pg++) {
        if (opts[pg].type === "peng" && Math.random() < st.pungOnly) {
          doPeng(st, to, tile);
          return;
        }
      }
      for (var cg = 0; cg < opts.length; cg++) {
        if (opts[cg].type === "chi" && Math.random() < st.aggro) {
          doChi(st, to, tile, chiOptions(pp.hand, tile)[0]);
          return;
        }
      }
    }
    advanceTurn(st);
  }

  function doHuDiscard(st, pid, tile) {
    var p = st.players[pid];
    p.hand.push(tile);
    sortHand(p.hand);
    var yaku = checkYaku(p.hand, p.melds, tile, st.riichi[pid], false, st.riichiFirstDraw[pid], false);
    var fan = yaku.length >= 7 ? 13 : (yaku.length >= 4 ? 6 : (yaku.length >= 2 ? 3 : 1));
    st.riichiFirstDraw[pid] = false;
    st.winInfo = { winner: pid, fan: fan, reasons: yaku,
                   tile: tile, type: "discard" };
    /* 玩家自己点 HU 立刻结算；CPU 荣和先停顿展示，别一帧跳过去 */
    if (p.isHuman) {
      st.mode = "round_over";
    } else {
      st.mode = "ai_win";
      st.aiTimer = AI_WIN_FRAMES;
    }
    st.msg = p.name + " wins · " + fan + " fan (" + yaku.length + " yaku)";
  }

  function doPeng(st, pid, tile) {
    var p = st.players[pid];
    var k = tileKind(tile);
    removeKind(p.hand, k, 2);
    p.melds.push({ type: "peng", tiles: [k, k, k] });
    st.turn = pid;
    st.lastDiscard = null;
    st.options = [];
    st.lastDrawnTile = null;      /* 吃碰没有摸牌 */
    if (p.isHuman) st.mode = "await_discard";
    else beginAiTurn(st, "think");   /* 没摸牌 → 直接从"思考"开始展示 */
  }

  function doGang(st, pid, tile) {
    var p = st.players[pid];
    var k = tileKind(tile);
    removeKind(p.hand, k, 3);
    p.melds.push({ type: "mingang", tiles: [k, k, k, k] });
    st.turn = pid;
    st.lastDiscard = null;
    st.options = [];
    drawForPlayer(st);
  }

  function doChi(st, pid, tile, combo) {
    var p = st.players[pid];
    for (var i = 0; i < combo.length; i++) removeKind(p.hand, combo[i], 1);
    p.melds.push({ type: "chi",
      tiles: [combo[0], combo[1], tileKind(tile)].sort(function (a, b) { return a - b; }) });
    st.turn = pid;
    st.lastDiscard = null;
    st.options = [];
    st.lastDrawnTile = null;      /* 吃碰没有摸牌 */
    if (p.isHuman) st.mode = "await_discard";
    else beginAiTurn(st, "think");   /* 没摸牌 → 直接从"思考"开始展示 */
  }

  function removeKind(hand, k, n) {
    var removed = 0;
    for (var i = hand.length - 1; i >= 0 && removed < n; i--) {
      if (tileKind(hand[i]) === k) { hand.splice(i, 1); removed++; }
    }
  }

  function advanceTurn(st) {
    st.turn = 1 - st.turn;
    drawForPlayer(st);
  }

  /* =========================================================
     玩家 API
     ========================================================= */
  /* =========================================================
     出牌合法性
     ========================================================= */
  /* 为什么这张牌现在打不出去？
     返回 null = 可以打；否则返回原因码：
       "not_your_turn"     —— 现在不是你的出牌阶段
       "riichi_tsumogiri"  —— 立直中，只能打出刚摸到的那张牌

     以前这个判断埋在 discardTile 里直接 `return false`，UI 拿到 false 只能
     静默吞掉：玩家点了一张牌 → 牌抬起来（选中态）→ 再点一次毫无反应，
     看起来就是"这张牌直立着但打不出去"。把原因单独暴露出来，UI 才能给反馈。 */
  function discardBlockReason(st, tile) {
    if (st.mode !== "await_discard" && st.mode !== "await_hu_choice") return "not_your_turn";
    /* 立直后只能打出摸到的那张牌（tsumogiri）。
       注意不能用 hand[length-1]：手牌是排序的，摸到的牌不一定在最后一位。 */
    if (st.riichi[0]) {
      var p = st.players[0];
      if (drawnTileOf(st, p) !== tile) return "riichi_tsumogiri";
    }
    return null;
  }

  /* 摸到的那张牌在手牌数组里的真实索引（找不到返回 -1） */
  function drawnTileIndex(st, pid) {
    var p = st.players[pid];
    return p.hand.indexOf(drawnTileOf(st, p));
  }

  /* 一次性提示：显示 ms 毫秒（默认 1600）。tileIdx 指定要一起闪烁的手牌真实索引。 */
  function setHint(st, text, ms, tileIdx) {
    st.hint = text || "";
    st.hintT = (typeof ms === "number" && ms > 0) ? ms : 1600;
    st.hintTile = (typeof tileIdx === "number") ? tileIdx : -1;
  }

  function clearHint(st) {
    st.hint = "";
    st.hintT = 0;
    st.hintTile = -1;
  }

  function discardTile(st, tile) {
    /* 先校验、再改状态。
       原来是先把 await_hu_choice 改成 await_discard 再校验 —— 一旦校验不过，
       自摸胡的选择就被静默吞掉了，面板消失、牌也没打出去。 */
    if (discardBlockReason(st, tile) !== null) return false;
    if (st.mode === "await_hu_choice") st.mode = "await_discard";
    return discard(st, tile);
  }

  function chooseAction(st, idx) {
    if (st.mode !== "waiting_response") return false;
    var opt = st.options[idx];
    if (!opt) return false;
    var tile = st.lastDiscard.tile;
    if (opt.type === "hu")    { doHuDiscard(st, 0, tile); return true; }
    if (opt.type === "peng")  { doPeng(st, 0, tile);      return true; }
    if (opt.type === "gang")  { doGang(st, 0, tile);      return true; }
    if (opt.type === "chi") {
      var combos = chiOptions(st.players[0].hand, tile);
      if (combos.length === 0) return false;
      doChi(st, 0, tile, combos[0]);
      return true;
    }
    return false;
  }

  function decline(st) {
    if (st.mode !== "waiting_response") return false;
    st.options = [];
    advanceTurn(st);
    return true;
  }

  function passHu(st) {
    if (st.mode !== "await_hu_choice") return false;
    st.mode = "await_discard";
    return true;
  }

  function anGangPlayer(st) {
    if (st.mode !== "await_discard" && st.mode !== "await_hu_choice") return false;
    var p = st.players[0];
    var k = anGangKind(p.hand);
    if (k < 0) return false;
    removeKind(p.hand, k, 4);
    p.melds.push({ type: "angang", tiles: [k, k, k, k] });
    drawForPlayer(st);
    return true;
  }

  function setDifficulty(st, d) {
    if (!DIFFS[d]) return false;
    st.diff = d;
    st.aggro = DIFFS[d].aggro;
    st.pungOnly = DIFFS[d].pungOnly;
    st.discardSafety = DIFFS[d].discardSafety;
    return true;
  }

  function advance(st) {
    if (st.mode === "menu") {
      startRound(st);
    } else if (st.mode === "round_over" || st.mode === "draw") {
      st.round++;
      st.dealer = 1 - st.dealer;
      startRound(st);
    }
    return true;
  }

  /* =========================================================
     AI 决策
     ========================================================= */
  /* AI 和牌：不直接跳结算面板，先进入 ai_win 停顿（见 AI_WIN_FRAMES），
     让玩家看清是哪张牌和了、什么役，再揭晓。 */
  function aiWin(st, tile, yaku) {
    var p = st.players[st.turn];
    var fan = yaku.length >= 7 ? 13 : (yaku.length >= 4 ? 6 : (yaku.length >= 2 ? 3 : 1));
    st.riichiFirstDraw[st.turn] = false;
    st.winInfo = { winner: st.turn, fan: fan, reasons: yaku,
                   tile: tile, type: "draw" };
    st.mode = "ai_win";
    st.aiTimer = AI_WIN_FRAMES;
    st.msg = p.name + " wins · " + fan + " fan (" + yaku.length + " yaku)";
  }

  function aiTurn(st) {
    var p = st.players[st.turn];
    /* 立直时只检查和牌 */
    if (st.riichi[st.turn]) {
      var rt = drawnTileOf(st, p);
      if (canWinFull(p.hand, p.melds, true, true, st.riichiFirstDraw[st.turn], st.lastTileDraw, rt)) {
        aiWin(st, rt, checkYaku(p.hand, p.melds, rt, true, true,
                                st.riichiFirstDraw[st.turn], st.lastTileDraw));
        return;
      }
      /* 立直后自动打出摸到的牌 */
      var t = rt;
      var idx = p.hand.indexOf(t);
      if (idx >= 0) {
        p.hand.splice(idx, 1);
        p.discards.push(t);
        sortHand(p.hand);
        st.lastDiscard = { tile: t, fromPlayer: st.turn };
        st.riichiFirstDraw[st.turn] = false;
        st.selIdx = -1;
        handleAfterDiscard(st);
      }
      return;
    }
    /* 正常和牌检查 */
    var at = drawnTileOf(st, p);
    if (canWinFull(p.hand, p.melds, false, true, false, st.lastTileDraw, at)) {
      aiWin(st, at, checkYaku(p.hand, p.melds, at, false, true, false, st.lastTileDraw));
      return;
    }
    /* 暗杠 */
    var ak = anGangKind(p.hand);
    if (ak >= 0 && Math.random() < st.aggro) {
      removeKind(p.hand, ak, 4);
      p.melds.push({ type: "angang", tiles: [ak, ak, ak, ak] });
      drawForPlayer(st);
      return;
    }
    /* 立直 AI 决策 */
    if (canRiichi(st, st.turn) && p.melds.length === 0 && Math.random() < st.aggro * 0.3) {
      declareRiichi(st, st.turn);
      /* 立直后自动打出摸到的牌。
         注意用 drawnTileOf，不能用 hand[length-1] —— 手牌是排序的，
         最后一张其实是最大的牌，不是刚摸到的那张。 */
      var rt2 = drawnTileOf(st, p);
      var ridx = p.hand.indexOf(rt2);
      if (ridx >= 0) {
        p.hand.splice(ridx, 1);
        p.discards.push(rt2);
        sortHand(p.hand);
        st.lastDiscard = { tile: rt2, fromPlayer: st.turn };
        st.selIdx = -1;
        handleAfterDiscard(st);
      }
      return;
    }
    var didx = aiPickDiscard(p.hand, st);
    if (didx >= 0) discard(st, p.hand[didx]);
  }

  function aiPickDiscard(hand, st) {
    var c = handCounts(hand);
    var bestIdx = 0, bestScore = Infinity;
    for (var i = 0; i < hand.length; i++) {
      var k = tileKind(hand[i]);
      var s = kindSuit(k);
      var score = 0;
      score += c[k] * 5;
      if (s < 3) {
        if (k % 9 > 0 && c[k - 1] > 0) score += 3;
        if (k % 9 < 8 && c[k + 1] > 0) score += 3;
        if (k % 9 > 1 && c[k - 2] > 0) score += 1;
        if (k % 9 < 7 && c[k + 2] > 0) score += 1;
      }
      if (isYao(k)) score -= 1;
      if (score < bestScore) { bestScore = score; bestIdx = i; }
    }
    return bestIdx;
  }

  /* =========================================================
     update
     ========================================================= */
  function update(st, dt) {
    /* 提示倒计时：任何模式下都要走，否则提示会一直挂在屏幕上 */
    if (st.hintT > 0) {
      st.hintT -= (dt || 0);
      if (st.hintT <= 0) clearHint(st);
    }
    /* AI 回合三段展示：draw（摸牌）→ think（思考）→ discard（打牌）。
       这样玩家能看见 CPU 的摸打过程，而不是一瞬间出结果。 */
    if (st.mode === "ai_turn") {
      if (st.aiTimer > 0) {
        st.aiTimer--;
        if (st.aiTimer === 0) {
          if (st.aiPhase === "draw") {
            st.aiPhase = "think";
            st.aiTimer = AI_THINK_FRAMES;
          } else if (st.aiPhase === "think") {
            st.aiPhase = "discard";
            aiTurn(st);   /* 可能改成 ai_win / round_over；暗杠会重新进入 draw 段 */
          }
        }
      }
      return;
    }
    /* AI 和牌停顿：先让玩家看清和牌张与役种，再揭晓结算面板 */
    if (st.mode === "ai_win") {
      if (st.aiTimer > 0) {
        st.aiTimer--;
        if (st.aiTimer === 0) st.mode = "round_over";
      }
    }
  }

  /* =========================================================
     导出
     ========================================================= */
  return {
    W: W, H: H, HUD: HUD,
    DIFFS: DIFFS, DIFF_IDS: DIFF_IDS,
    DON_DEN_COUNT: DON_DEN_COUNT,
    create: create,
    startRound: startRound,
    advance: advance,
    update: update,
    setDifficulty: setDifficulty,

    discardTile: discardTile,
    discardBlockReason: discardBlockReason,
    drawnTileIndex: drawnTileIndex,
    setHint: setHint,
    clearHint: clearHint,
    chooseAction: chooseAction,
    decline: decline,
    passHu: passHu,
    anGangPlayer: anGangPlayer,
    doDonDenExchange: doDonDenExchange,
    skipDonDen: skipDonDen,
    canRiichi: canRiichi,
    declareRiichi: declareRiichi,
    isTenpai: isTenpai,

    tileName: tileName, tileKind: tileKind,
    kindSuit: kindSuit, kindRank: kindRank, kindName: kindName,
    canWin: canWin, canWinFull: canWinFull, canChi: canChi, canPeng: canPeng, canGang: canGang,
    canHu: canHu, chiOptions: chiOptions, anGangKind: anGangKind,
    drawnTileOf: drawnTileOf,
    calcFan: calcFan, checkYaku: checkYaku, isYao: isYao,
    sortHand: sortHand, newDeck: newDeck,
    handCounts: handCounts
  };
})();

if (typeof module !== "undefined") module.exports = Core;
