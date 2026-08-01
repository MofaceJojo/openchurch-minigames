"use strict";
const Render = (() => {
  function draw(ctx, state, sc) {
    const W = 800, H = 600;
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    ctx.scale(sc, sc);

    drawScene(ctx, state.level - 1, W, H);
    drawImps(ctx, state);
    if (state.hint && state.hintImp) drawHint(ctx, state.hintImp);

    ctx.restore();
  }

  function drawScene(ctx, idx, W, H) {
    const palettes = [
      { sky: "#87ceeb", ground: "#7cb342", building: "#f5e6d3", roof: "#c0392b", road: "#9e9e9e", accent: "#5d4037" },
      { sky: "#a8d8ea", ground: "#8bc34a", building: "#ffe0b2", roof: "#ff7043", road: "#bdbdbd", accent: "#4e342e" },
      { sky: "#e1f5fe", ground: "#9ccc65", building: "#fff9c4", roof: "#5d4037", road: "#e0e0e0", accent: "#3e2723" },
      { sky: "#b3e5fc", ground: "#689f38", building: "#d7ccc8", roof: "#4e342e", road: "#a1887f", accent: "#263238" },
      { sky: "#1a237e", ground: "#33691e", building: "#fff8e1", roof: "#263238", road: "#616161", accent: "#ffd54f" }
    ];
    const p = palettes[idx] || palettes[0];

    // Sky
    const skyG = ctx.createLinearGradient(0, 0, 0, 340);
    skyG.addColorStop(0, p.sky);
    skyG.addColorStop(1, lighten(p.sky, 50));
    ctx.fillStyle = skyG;
    ctx.fillRect(0, 0, 800, 340);

    // Distant hills/background buildings
    ctx.fillStyle = lighten(p.ground, 20);
    ctx.beginPath(); ctx.moveTo(0, 340); ctx.bezierCurveTo(200, 290, 600, 310, 800, 330); ctx.lineTo(800, 340); ctx.lineTo(0, 340); ctx.fill();

    // Ground
    ctx.fillStyle = p.ground;
    ctx.fillRect(0, 330, 800, 270);

    // Road
    ctx.fillStyle = p.road;
    ctx.fillRect(0, 420, 800, 50);
    ctx.strokeStyle = "#fff"; ctx.lineWidth = 2;
    ctx.setLineDash([18, 12]);
    ctx.beginPath(); ctx.moveTo(0, 445); ctx.lineTo(800, 445); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "#bdbdbd"; ctx.fillRect(0, 418, 800, 4); ctx.fillRect(0, 468, 800, 4);

    if (idx === 0) drawSuburb(ctx, p);
    else if (idx === 1) drawPark(ctx, p);
    else if (idx === 2) drawHall(ctx, p);
    else if (idx === 3) drawRiverside(ctx, p);
    else if (idx === 4) drawChapel(ctx, p);
  }

  function drawSuburb(ctx, p) {
    drawHouse(ctx, 70, 180, 160, 120, p.building, p.roof, "#5d4037", true);
    drawHouse(ctx, 310, 210, 190, 110, "#e0e0d0", "#795548", "#5d4037", false);
    drawHouse(ctx, 560, 160, 150, 160, "#f5f0e1", "#8d6e63", "#4e342e", true);
    drawTree(ctx, 30, 280, 48);
    drawTree(ctx, 250, 300, 36);
    drawTree(ctx, 510, 270, 42);
    drawTree(ctx, 740, 290, 40);
    // Mailbox
    ctx.fillStyle = "#1565c0"; ctx.fillRect(105, 358, 22, 30);
    ctx.fillStyle = "#e0e0e0"; ctx.fillRect(101, 354, 30, 6);
    // Car
    ctx.fillStyle = "#d32f2f"; ctx.fillRect(620, 428, 110, 36);
    ctx.fillStyle = "#b71c1c"; ctx.fillRect(615, 458, 120, 8);
    ctx.fillStyle = "#333"; ctx.beginPath(); ctx.arc(645, 466, 14, 0, Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.arc(708, 466, 14, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = "#fff9c4"; ctx.fillRect(625, 436, 32, 22); ctx.fillRect(688, 436, 32, 22);
  }

  function drawHouse(ctx, x, y, w, h, wall, roofC, doorC, hasChimney) {
    ctx.fillStyle = wall; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = roofC;
    ctx.beginPath(); ctx.moveTo(x - 8, y); ctx.lineTo(x + w/2, y - 40); ctx.lineTo(x + w + 8, y); ctx.closePath(); ctx.fill();
    ctx.fillStyle = doorC; ctx.fillRect(x + w/2 - 18, y + h - 50, 36, 50);
    ctx.fillStyle = "#fff9c4";
    ctx.fillRect(x + 12, y + 14, 34, 30); ctx.fillRect(x + w - 46, y + 14, 34, 30);
    if (hasChimney) { ctx.fillStyle = "#795548"; ctx.fillRect(x + w - 30, y - 55, 16, 22); }
  }

  function drawPark(ctx, p) {
    ctx.fillStyle = "#ff8a65"; ctx.fillRect(340, 340, 14, 75);
    ctx.fillStyle = "#ffcc80"; ctx.beginPath(); ctx.moveTo(335, 340); ctx.lineTo(362, 288); ctx.lineTo(388, 340); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#ff7043"; ctx.fillRect(500, 338, 80, 8);
    ctx.fillStyle = "#a1887f"; ctx.fillRect(518, 346, 6, 50); ctx.fillRect(556, 346, 6, 50);
    ctx.fillStyle = "#ffcc80"; ctx.fillRect(510, 396, 24, 14); ctx.fillRect(548, 396, 24, 14);
    ctx.fillStyle = "#795548"; ctx.fillRect(120, 390, 100, 10); ctx.fillRect(130, 400, 8, 26); ctx.fillRect(202, 400, 8, 26);
    ctx.fillStyle = "#ff5722"; ctx.fillRect(680, 316, 10, 68);
    ctx.fillStyle = "#fff"; ctx.fillRect(660, 312, 50, 8);
    ctx.fillStyle = "#ff9800"; ctx.beginPath(); ctx.arc(685, 306, 14, 0, Math.PI*2); ctx.fill();
    drawTree(ctx, 50, 290, 44); drawTree(ctx, 230, 270, 48); drawTree(ctx, 620, 280, 44); drawTree(ctx, 750, 300, 38);
  }

  function drawHall(ctx, p) {
    ctx.fillStyle = p.building; ctx.fillRect(140, 150, 520, 280);
    ctx.fillStyle = p.roof; ctx.beginPath(); ctx.moveTo(130, 150); ctx.lineTo(400, 55); ctx.lineTo(670, 150); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#4e342e"; ctx.fillRect(365, 350, 70, 80);
    ctx.fillStyle = "#ffd54f"; ctx.fillRect(392, 370, 10, 14); ctx.fillRect(392, 395, 10, 14);
    ctx.fillStyle = "#bbdefb"; ctx.fillRect(180, 185, 55, 45); ctx.fillRect(565, 185, 55, 45);
    ctx.fillRect(180, 265, 55, 45); ctx.fillRect(565, 265, 55, 45);
    ctx.fillStyle = "#fff9c4"; ctx.fillRect(280, 245, 120, 80);
    ctx.fillStyle = "#5d4037"; ctx.fillRect(278, 243, 124, 4);
    ctx.fillStyle = "#90a4ae"; ctx.fillRect(610, 280, 50, 80);
    ctx.fillStyle = "#4db6ac"; ctx.fillRect(618, 288, 34, 22);
    drawPot(ctx, 90, 385, 32); drawPot(ctx, 670, 385, 30);
    ctx.fillStyle = "#a1887f"; ctx.fillRect(300, 390, 120, 8);
    ctx.fillRect(314, 398, 8, 32); ctx.fillRect(398, 398, 8, 32);
  }

  function drawRiverside(ctx, p) {
    const waterG = ctx.createLinearGradient(0, 490, 0, 600);
    waterG.addColorStop(0, "#42a5f5"); waterG.addColorStop(1, "#1565c0");
    ctx.fillStyle = waterG; ctx.fillRect(0, 490, 800, 110);
    ctx.strokeStyle = "#64b5f6"; ctx.lineWidth = 1;
    for (let i = 0; i < 10; i++) { ctx.beginPath(); ctx.moveTo(0, 500 + i*10); ctx.bezierCurveTo(200, 495+i*10, 600, 505+i*10, 800, 500+i*10); ctx.stroke(); }
    ctx.fillStyle = "#d7ccc8"; ctx.fillRect(0, 435, 800, 58);
    ctx.fillStyle = "#795548"; ctx.fillRect(380, 436, 88, 10);
    ctx.fillRect(390, 446, 8, 24); ctx.fillRect(450, 446, 8, 24);
    ctx.fillStyle = "#757575";
    ctx.beginPath(); ctx.moveTo(640, 435); ctx.lineTo(650, 385); ctx.lineTo(680, 385); ctx.lineTo(690, 435); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#616161"; ctx.fillRect(652, 380, 26, 8);
    ctx.fillStyle = "#d32f2f"; ctx.fillRect(230, 415, 20, 22); ctx.fillRect(225, 420, 30, 6);
    ctx.fillStyle = "#b71c1c"; ctx.fillRect(236, 437, 8, 10);
    drawTree(ctx, 80, 350, 52); drawTree(ctx, 520, 360, 50); drawTree(ctx, 720, 370, 44);
  }

  function drawChapel(ctx, p) {
    ctx.fillStyle = p.building; ctx.fillRect(250, 190, 300, 240);
    ctx.fillStyle = p.roof; ctx.beginPath(); ctx.moveTo(240, 190); ctx.lineTo(400, 85); ctx.lineTo(560, 190); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#455a64"; ctx.fillRect(382, 85, 36, 105);
    ctx.fillStyle = "#ffd54f"; ctx.beginPath(); ctx.moveTo(378, 85); ctx.lineTo(400, 45); ctx.lineTo(422, 85); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = "#ffd54f"; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(400, 45); ctx.lineTo(400, 22); ctx.moveTo(390, 30); ctx.lineTo(410, 30); ctx.stroke();
    ctx.fillStyle = "#3e2723"; ctx.beginPath(); ctx.arc(400, 430, 32, Math.PI, 0); ctx.lineTo(432, 430); ctx.lineTo(368, 430); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#ffd54f"; ctx.fillRect(396, 405, 8, 10);
    ctx.fillStyle = "#42a5f5"; ctx.fillRect(340, 250, 50, 80); ctx.fillStyle = "#ef5350"; ctx.fillRect(410, 250, 50, 80);
    ctx.strokeStyle = "#5d4037"; ctx.lineWidth = 3; ctx.strokeRect(340, 250, 50, 80); ctx.strokeRect(410, 250, 50, 80);
    ctx.fillStyle = "#90a4ae"; ctx.beginPath(); ctx.ellipse(150, 410, 50, 18, 0, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = "#42a5f5"; ctx.beginPath(); ctx.ellipse(150, 406, 42, 14, 0, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = "#90a4ae"; ctx.beginPath(); ctx.arc(150, 402, 10, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = "#5d4037";
    for (let i = 0; i < 3; i++) { ctx.fillRect(480, 330 + i*55, 200, 14); ctx.fillRect(485, 344 + i*55, 6, 18); ctx.fillRect(669, 344 + i*55, 6, 18); }
  }

  function drawImps(ctx, state) {
    const idx = state.level - 1;
    const LEVEL_DATA = [
      [{id:"l1_imp0",x:.18,y:.52},{id:"l1_imp1",x:.62,y:.48},{id:"l1_imp2",x:.85,y:.32},{id:"l1_imp3",x:.38,y:.72},{id:"l1_imp4",x:.72,y:.65},{id:"l1_imp5",x:.12,y:.28}],
      [{id:"l2_imp0",x:.45,y:.38},{id:"l2_imp1",x:.22,y:.68},{id:"l2_imp2",x:.78,y:.55},{id:"l2_imp3",x:.58,y:.72},{id:"l2_imp4",x:.15,y:.38}],
      [{id:"l3_imp0",x:.35,y:.42},{id:"l3_imp1",x:.68,y:.55},{id:"l3_imp2",x:.52,y:.72},{id:"l3_imp3",x:.82,y:.28},{id:"l3_imp4",x:.22,y:.55},{id:"l3_imp5",x:.48,y:.28}],
      [{id:"l4_imp0",x:.28,y:.45},{id:"l4_imp1",x:.65,y:.58},{id:"l4_imp2",x:.42,y:.75},{id:"l4_imp3",x:.78,y:.38},{id:"l4_imp4",x:.15,y:.62}],
      [{id:"l5_imp0",x:.45,y:.22},{id:"l5_imp1",x:.58,y:.68},{id:"l5_imp2",x:.22,y:.52},{id:"l5_imp3",x:.78,y:.55},{id:"l5_imp4",x:.35,y:.38},{id:"l5_imp5",x:.62,y:.32}]
    ];
    const imps = LEVEL_DATA[idx] || [];
    for (const imp of imps) {
      if (state.found.includes(imp.id)) continue;
      const ix = imp.x * 800, iy = imp.y * 600;
      drawImp(ctx, ix, iy, state.hint && state.hintImp && state.hintImp.id === imp.id);
    }
  }

  function drawImp(ctx, x, y, highlight) {
    ctx.save();
    ctx.translate(x, y);
    if (highlight) { ctx.shadowColor = "#fff"; ctx.shadowBlur = 22; }
    // Body
    ctx.fillStyle = "#e87a3a";
    ctx.beginPath(); ctx.arc(0, 0, 15, 0, Math.PI*2); ctx.fill();
    // Horns
    ctx.fillStyle = "#5d4037";
    ctx.beginPath(); ctx.moveTo(-9, -11); ctx.lineTo(-14, -24); ctx.lineTo(-2, -13); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(9, -11); ctx.lineTo(14, -24); ctx.lineTo(2, -13); ctx.closePath(); ctx.fill();
    // Eyes
    ctx.fillStyle = "#fff";
    ctx.beginPath(); ctx.arc(-5, -5, 6, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(5, -5, 6, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = "#000";
    ctx.beginPath(); ctx.arc(-4, -4, 2.5, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(6, -4, 2.5, 0, Math.PI*2); ctx.fill();
    // Grin
    ctx.strokeStyle = "#000"; ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.arc(0, 5, 6, 0.3, Math.PI - 0.3); ctx.stroke();
    ctx.restore();
  }

  function drawHint(ctx, imp) {
    const x = imp.x * 800, y = imp.y * 600;
    ctx.save();
    ctx.strokeStyle = "#fff"; ctx.lineWidth = 3; ctx.setLineDash([6, 4]);
    ctx.beginPath(); ctx.arc(x, y, 32, 0, Math.PI*2); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "#fff"; ctx.font = "bold 14px sans-serif"; ctx.textAlign = "center";
    ctx.fillText("👉", x, y - 42);
    ctx.restore();
  }

  function lighten(hex, pct) {
    const num = parseInt(hex.replace("#", ""), 16);
    const amt = Math.round(2.55 * pct);
    const R = Math.min(255, (num >> 16) + amt);
    const G = Math.min(255, ((num >> 8) & 0x00FF) + amt);
    const B = Math.min(255, (num & 0x0000FF) + amt);
    return "#" + (0x1000000 + R*0x10000 + G*0x100 + B).toString(16).slice(1);
  }

  return { draw };
})();
