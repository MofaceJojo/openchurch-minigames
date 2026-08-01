"use strict";
const Core = (() => {
  let canvas, ctx, W, H, scale;
  let state = { level: 1, found: [], score: 0, time: 60, timer: null, running: false, hint: false, hintTimer: null };

  const LEVELS = [
    {
      name: "Maple Street",
      hint: "Some residents are... oddly shaped.",
      time: 70,
      imps: [
        { id: "l1_imp0", x: 0.18, y: 0.52, pose: "mailbox", hint: "Peeking from the mailbox slot" },
        { id: "l1_imp1", x: 0.62, y: 0.48, pose: "gnome", hint: "A garden gnome with a mischievous grin" },
        { id: "l1_imp2", x: 0.85, y: 0.32, pose: "window", hint: "Waving from the attic window" },
        { id: "l1_imp3", x: 0.38, y: 0.72, pose: "cat", hint: "That cat has a very long tail..." },
        { id: "l1_imp4", x: 0.72, y: 0.65, pose: "car", hint: "Hiding behind the red car" },
        { id: "l1_imp5", x: 0.12, y: 0.28, pose: "tree", hint: "Blending in with the oak tree" },
      ]
    },
    {
      name: "Joy Park",
      hint: "Not all playground visitors are children.",
      time: 65,
      imps: [
        { id: "l2_imp0", x: 0.45, y: 0.38, pose: "slide", hint: "Sliding down with a goofy grin" },
        { id: "l2_imp1", x: 0.22, y: 0.68, pose: "sandbox", hint: "Buried in the sandbox, only eyes visible" },
        { id: "l2_imp2", x: 0.78, y: 0.55, pose: "swing", hint: "Swinging way too high" },
        { id: "l2_imp3", x: 0.58, y: 0.72, pose: "basketball", hint: "That basketball has horns" },
        { id: "l2_imp4", x: 0.15, y: 0.38, pose: "bench", hint: "Sitting on the bench, upside down" },
      ]
    },
    {
      name: "Community Hall",
      hint: "The hall is full of 'helpful' volunteers.",
      time: 60,
      imps: [
        { id: "l3_imp0", x: 0.35, y: 0.42, pose: "noticeboard", hint: "Taped to the noticeboard, papers covering its face" },
        { id: "l3_imp1", x: 0.68, y: 0.55, pose: "vending", hint: "Inside the vending machine, pressing buttons" },
        { id: "l3_imp2", x: 0.52, y: 0.72, pose: "table", hint: "Under the folding table, holding up the legs" },
        { id: "l3_imp3", x: 0.82, y: 0.28, pose: "tv", hint: "On the TV screen, making funny faces" },
        { id: "l3_imp4", x: 0.22, y: 0.55, pose: "plant", hint: "That potted plant has very pointy leaves" },
        { id: "l3_imp5", x: 0.48, y: 0.28, pose: "clock", hint: "The clock's hands are... moving backwards?" },
      ]
    },
    {
      name: "Riverside Park",
      hint: "Nature is full of surprises today.",
      time: 65,
      imps: [
        { id: "l4_imp0", x: 0.28, y: 0.45, pose: "treehole", hint: "Peeking from the hollow of the old oak" },
        { id: "l4_imp1", x: 0.65, y: 0.58, pose: "bench", hint: "Under the park bench, upside down again" },
        { id: "l4_imp2", x: 0.42, y: 0.75, pose: "hydrant", hint: "That fire hydrant has tiny legs" },
        { id: "l4_imp3", x: 0.78, y: 0.38, pose: "trashcan", hint: "Rummaging in the trash can, wearing a bin lid as a hat" },
        { id: "l4_imp4", x: 0.15, y: 0.62, pose: "bird", hint: "That bird is wearing a tiny cape" },
      ]
    },
    {
      name: "Old Chapel",
      hint: "Even holy places aren't safe from troublemakers.",
      time: 60,
      imps: [
        { id: "l5_imp0", x: 0.45, y: 0.22, pose: "cross", hint: "Hanging from the cross, doing a handstand" },
        { id: "l5_imp1", x: 0.58, y: 0.68, pose: "fountain", hint: "In the fountain, blowing bubbles" },
        { id: "l5_imp2", x: 0.22, y: 0.52, pose: "statue", hint: "The statue moved! It's now doing a dab pose" },
        { id: "l5_imp3", x: 0.78, y: 0.55, pose: "pew", hint: "Under the pew, reading a tiny upside-down bible" },
        { id: "l5_imp4", x: 0.35, y: 0.38, pose: "bell", hint: "Ring-a-ling! The bell ringer is very small and red" },
        { id: "l5_imp5", x: 0.62, y: 0.32, pose: "stainedglass", hint: "In the stained glass window, holding a tiny hammer" },
      ]
    }
  ];

  function getLevel() { return LEVELS[state.level - 1]; }
  function getImps() { return getLevel().imps; }

  function resetLevel() {
    const lv = getLevel();
    state.found = [];
    state.time = lv.time;
    state.running = true;
    state.hint = false;
    if (state.hintTimer) clearTimeout(state.hintTimer);
    if (state.timer) clearInterval(state.timer);
    state.timer = setInterval(() => {
      if (!state.running) return;
      state.time--;
      if (state.time <= 0) { state.running = false; clearInterval(state.timer); showOverlay("Time's Up!", "You found " + state.found.length + " of " + lv.imps.length + " imps.", "Try Again", () => { hideOverlay(); resetLevel(); }); }
      updateUI();
    }, 1000);
    updateUI();
  }

  function handleClick(wx, wy) {
    if (!state.running) return;
    const lv = getLevel();
    for (const imp of lv.imps) {
      if (state.found.includes(imp.id)) continue;
      const dx = wx - imp.x * 800;
      const dy = wy - imp.y * 600;
      if (Math.sqrt(dx*dx + dy*dy) < 28) {
        state.found.push(imp.id);
        state.score += Math.max(10, state.time);
        Audio.play("found");
        if (state.hintTimer) clearTimeout(state.hintTimer);
        state.hint = false;
        if (state.found.length === lv.imps.length) {
          state.running = false;
          clearInterval(state.timer);
          const stars = state.time > lv.time * 0.6 ? 3 : state.time > lv.time * 0.3 ? 2 : 1;
          setTimeout(() => {
            showOverlay("Level Clear!", "You found all " + lv.imps.length + " imps with " + state.time + "s left!", "★".repeat(stars), () => {
              hideOverlay();
              if (state.level < LEVELS.length) { state.level++; resetLevel(); }
              else { showOverlay("Victory!", "All levels cleared! Score: " + state.score, "Play Again", () => { hideOverlay(); state.level = 1; state.score = 0; resetLevel(); }); }
            });
          }, 600);
        }
        updateUI();
        return;
      }
    }
    Audio.play("miss");
  }

  function useHint() {
    if (!state.running || state.hint) return;
    const lv = getLevel();
    const unfound = lv.imps.filter(i => !state.found.includes(i.id));
    if (!unfound.length) return;
    state.hint = true;
    state.time = Math.max(1, state.time - 5);
    Audio.play("hint");
    const target = unfound[Math.floor(Math.random() * unfound.length)];
    state.hintImp = target;
    if (state.hintTimer) clearTimeout(state.hintTimer);
    state.hintTimer = setTimeout(() => { state.hint = false; state.hintImp = null; render(); }, 3000);
    updateUI();
  }

  function updateUI() {
    const lv = getLevel();
    document.getElementById("scoreChip").textContent = "Found: " + state.found.length + " / " + lv.imps.length;
    document.getElementById("timeChip").textContent = "⏱ " + state.time + "s";
    document.getElementById("levelChip").textContent = "Level " + state.level + " · " + lv.name;
  }

  let overlayDiv = null;
  function showOverlay(title, body, btnText, cb) {
    if (overlayDiv) overlayDiv.remove();
    overlayDiv = document.createElement("div");
    overlayDiv.className = "overlay";
    overlayDiv.innerHTML = `<div class="modal"><h2>${title}</h2><p>${body}</p><div class="stars">${btnText}</div><button id="modalBtn">${btnText || "Continue"}</button></div>`;
    document.body.appendChild(overlayDiv);
    document.getElementById("modalBtn").onclick = cb;
  }
  function hideOverlay() { if (overlayDiv) { overlayDiv.remove(); overlayDiv = null; } }

  function init(c, c2) { canvas = c; ctx = c2; resetLevel(); }
  function render() { Render.draw(ctx, state, scale); }

  document.addEventListener("keydown", (e) => { if (e.key === "h" || e.key === "H") useHint(); });

  return { init, render, handleClick, useHint };
})();
