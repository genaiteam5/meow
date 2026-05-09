// ============================================================
// SIDE-VIEW PIXEL CAT — matches the reference photos
// 24 wide x 12 tall. 0=transparent, 1=fur, 2=eye
// ============================================================
const SIDE_CAT = [
  "001100110000000000000000", //  0  ear tips
  "011101110000000000000000", //  1  ears widen
  "011111110000000000000000", //  2  ear bases
  "111111111100000000000000", //  3  head top
  "112211221100000000000000", //  4  eyes (2x1 each)
  "011111111100000000000000", //  5  cheeks
  "011111111111111111111000", //  6  body extends right
  "011111111111111111111100", //  7  body
  "011111111111111111111111", //  8  body bottom + tail tip
  "001111111111111111111110", //  9  belly arch
  "001100110011001100000110", // 10  4 legs + tail base
  "001100110011001100000010", // 11  leg bottoms + tail tip
];

const SIDE_PALETTE = {
  black:  { 1: "#0e0e0e", 2: "#f5e58a" },
  cheese: { 1: "#f4a93b", 2: "#ffffff" },
  white:  { 1: "#fafafa", 2: "#1a1a1a" },
  calico: { 1: "#fafafa", 2: "#1a1a1a" },
};

function drawSideCat(ctx, x, y, scale, palette, opts = {}) {
  const blink = opts.blink ?? false;
  const onlyEyes = opts.onlyEyes ?? false;
  const stretchX = opts.stretchX ?? 1;
  const tilt = opts.tilt ?? 0;
  const colors = SIDE_PALETTE[palette] || SIDE_PALETTE.cheese;

  if (tilt) {
    ctx.save();
    const cxr = x + 12 * scale * stretchX;
    const cyr = y + 6 * scale;
    ctx.translate(cxr, cyr);
    ctx.rotate(tilt);
    ctx.translate(-cxr, -cyr);
  }

  for (let r = 0; r < SIDE_CAT.length; r++) {
    for (let c = 0; c < SIDE_CAT[r].length; c++) {
      const ch = SIDE_CAT[r][c];
      if (ch === "0") continue;
      const code = parseInt(ch, 10);
      if (onlyEyes && code !== 2) continue;
      if (blink && code === 2) continue;
      ctx.fillStyle = colors[code];
      ctx.fillRect(
        Math.round(x + c * scale * stretchX),
        Math.round(y + r * scale),
        Math.ceil(scale * stretchX),
        Math.ceil(scale)
      );
    }
  }

  if (tilt) ctx.restore();
}

const CALICO_ORANGE_PATCH = new Set([
  "6,12","6,13","6,14","6,15","6,16","6,17","6,18",
  "7,13","7,14","7,15","7,16","7,17","7,18","7,19",
  "8,14","8,15","8,16","8,17","8,18",
  "10,7","10,11","11,7","11,11",
]);
const CALICO_BLACK_PATCH = new Set([
  "3,0","3,1","3,2","3,3",
  "4,0","4,1","4,4","4,5",
  "5,1","5,2","5,3",
  "6,1","6,2",
  "8,20","8,21","8,22","8,23",
  "9,20","9,21","9,22",
  "10,21","10,22",
]);
function drawCalicoCat(ctx, x, y, scale, opts = {}) {
  drawSideCat(ctx, x, y, scale, "calico", opts);
  for (let r = 0; r < SIDE_CAT.length; r++) {
    for (let c = 0; c < SIDE_CAT[r].length; c++) {
      const ch = SIDE_CAT[r][c];
      if (ch !== "1") continue;
      const key = `${r},${c}`;
      let color = null;
      if (CALICO_ORANGE_PATCH.has(key)) color = "#f4a93b";
      else if (CALICO_BLACK_PATCH.has(key)) color = "#0e0e0e";
      if (color) {
        ctx.fillStyle = color;
        ctx.fillRect(Math.round(x + c * scale), Math.round(y + r * scale),
                     Math.ceil(scale), Math.ceil(scale));
      }
    }
  }
}

function fitCanvas(canvas) {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.floor(rect.width * dpr);
  canvas.height = Math.floor(rect.height * dpr);
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = false;
  return { ctx, w: rect.width, h: rect.height };
}

function setScore(barId, pct) {
  const el = document.getElementById(barId);
  if (el) el.style.width = Math.max(0, Math.min(100, pct)) + "%";
}

// Pre-load the two black-cat photos used by the fullscreen game.
const BLACK1_IMG = new Image();
const BLACK2_IMG = new Image();
BLACK1_IMG.src = "public/black1.png";
BLACK2_IMG.src = "public/black2.png";

// ============================================================
// 1. BLACK CAT — black1.png fills the screen; making a fist
//    cross-fades to black2.png with a soft flash + zoom kick.
// ============================================================
function startBlackCatGame() {
  const canvas = document.getElementById("blackCanvas");
  const hint = document.getElementById("blackHint");
  let { ctx, w, h } = fitCanvas(canvas);
  const onResize = () => { const r = fitCanvas(canvas); ctx = r.ctx; w = r.w; h = r.h; };
  window.addEventListener("resize", onResize);

  const state = {
    cat: { x: 0, y: 0, tx: 0, ty: 0, retargetAt: 0 },
    fistAmt: 0,            // 0 = black1, 1 = black2 (smoothly animated)
    caught: false,         // locked into black2 once caught
    caughtUntil: 0,        // auto-release time
    flash: 0,
    kick: 0,
    blink: 0,              // 0 = open eyes, 1 = closed
    nextBlinkAt: 0,
    eyeOffset: 0,          // small left/right glance
    eyeDir: 1,
    raf: 0,
    last: performance.now(),
  };

  let handPos = null;
  let isFist = false;
  const unsubscribe = window.HandTracker.subscribe(data => {
    if (data.hands.length > 0) {
      const h0 = data.hands[0];
      handPos = { x: h0.palm.x * w, y: h0.palm.y * h };
      isFist = h0.isFist;
    } else {
      handPos = null;
      isFist = false;
    }
  });

  function pickTarget() {
    const m = Math.min(w, h) * 0.18;
    state.cat.tx = m + Math.random() * Math.max(1, w - m * 2);
    state.cat.ty = m + Math.random() * Math.max(1, h - m * 2);
    state.cat.retargetAt = performance.now() + 2200 + Math.random() * 2200;
  }
  function placeNow() {
    pickTarget();
    state.cat.x = state.cat.tx;
    state.cat.y = state.cat.ty;
    state.cat.retargetAt = performance.now() + 1800 + Math.random() * 2000;
  }
  placeNow();
  state.nextBlinkAt = performance.now() + 800 + Math.random() * 1600;

  function drawCatPhoto(img, cx, cy, alpha, scaleMul) {
    if (!img.naturalWidth) return null;
    const ar = img.naturalWidth / img.naturalHeight;
    // fit cat to ~52% of the smaller screen dimension
    const target = Math.min(w, h) * 0.52 * scaleMul;
    let drawW, drawH;
    if (ar >= 1) { drawW = target; drawH = target / ar; }
    else         { drawH = target; drawW = target * ar; }
    const x = cx - drawW / 2;
    const y = cy - drawH / 2;
    ctx.globalAlpha = alpha;
    ctx.drawImage(img, x, y, drawW, drawH);
    ctx.globalAlpha = 1;
    return { x, y, w: drawW, h: drawH };
  }

  function drawEyes(box) {
    if (!box) return;
    // approximate eye position on the cat photo (upper-center face area)
    const eyeY = box.y + box.h * 0.34;
    const eyeGap = box.w * 0.13;
    const cxL = box.x + box.w * 0.5 - eyeGap + state.eyeOffset;
    const cxR = box.x + box.w * 0.5 + eyeGap + state.eyeOffset;
    const rx  = Math.max(3, box.w * 0.028);
    const ry  = Math.max(2, box.h * 0.022) * (1 - state.blink);

    // soft yellow glow
    ctx.save();
    ctx.fillStyle = "rgba(255, 230, 120, 0.85)";
    ctx.shadowColor = "rgba(255, 220, 90, 0.9)";
    ctx.shadowBlur = Math.max(6, box.w * 0.04);
    if (ry > 0.4) {
      ctx.beginPath(); ctx.ellipse(cxL, eyeY, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(cxR, eyeY, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  function drawHandCursor() {
    if (!handPos) return;
    ctx.save();
    ctx.strokeStyle = isFist ? "rgba(255, 220, 90, 0.95)" : "rgba(255,255,255,0.7)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(handPos.x, handPos.y, isFist ? 22 : 30, 0, Math.PI * 2);
    ctx.stroke();
    if (isFist) {
      ctx.fillStyle = "rgba(255, 220, 90, 0.18)";
      ctx.fill();
    }
    ctx.restore();
  }

  hint.textContent = "✋ 어둠 속 노란 눈을 따라가서 ✊ 주먹으로 잡아요";

  function loop(now) {
    const dt = Math.min(0.05, (now - state.last) / 1000);
    state.last = now;

    // cat drift: only wanders while not caught
    if (!state.caught) {
      if (now > state.cat.retargetAt) pickTarget();
      const dx = state.cat.tx - state.cat.x;
      const dy = state.cat.ty - state.cat.y;
      // ease toward target, then flee if hand is close
      let speed = 1.6;
      if (handPos) {
        const hd = Math.hypot(handPos.x - state.cat.x, handPos.y - state.cat.y);
        if (hd < Math.min(w, h) * 0.22) {
          // dart away from the hand
          const ax = state.cat.x - handPos.x, ay = state.cat.y - handPos.y;
          const am = Math.hypot(ax, ay) || 1;
          state.cat.tx = Math.max(40, Math.min(w - 40, state.cat.x + ax / am * 220));
          state.cat.ty = Math.max(40, Math.min(h - 40, state.cat.y + ay / am * 220));
          state.cat.retargetAt = now + 1400;
          speed = 5.5;
        }
      }
      state.cat.x += dx * Math.min(1, dt * speed);
      state.cat.y += dy * Math.min(1, dt * speed);
    }

    // blink schedule
    if (now > state.nextBlinkAt) {
      state.blink = 1;
      state.nextBlinkAt = now + 1100 + Math.random() * 2200;
    }
    state.blink = Math.max(0, state.blink - dt * 6); // close→open quickly
    // small horizontal eye glance, sinusoidal
    state.eyeOffset = Math.sin(now / 600) * Math.max(2, Math.min(w, h) * 0.004);

    // catch detection: fist while hand overlaps the cat
    if (!state.caught && isFist && handPos) {
      const catR = Math.min(w, h) * 0.18;
      if (Math.hypot(handPos.x - state.cat.x, handPos.y - state.cat.y) < catR) {
        state.caught = true;
        state.caughtUntil = now + 1800;
        state.flash = 1;
        state.kick = 1;
        hint.textContent = "✊ 잡았다!";
      }
    }
    if (state.caught && now > state.caughtUntil) {
      state.caught = false;
      hint.textContent = "✋ 다시 어둠 속을 살펴봐요";
      placeNow();
    }

    // smooth photo cross-fade
    const target = state.caught ? 1 : 0;
    state.fistAmt += (target - state.fistAmt) * Math.min(1, dt * 9);
    state.flash = Math.max(0, state.flash - dt * 2.2);
    state.kick  = Math.max(0, state.kick - dt * 3);

    // dark backdrop
    ctx.fillStyle = "#06060a";
    ctx.fillRect(0, 0, w, h);

    // draw active photo at the cat's current position
    const kickScale = 1 + state.kick * 0.06;
    const box = state.fistAmt < 0.5
      ? drawCatPhoto(BLACK1_IMG, state.cat.x, state.cat.y, 1 - state.fistAmt, 1)
      : drawCatPhoto(BLACK2_IMG, state.cat.x, state.cat.y, state.fistAmt, kickScale);
    if (state.fistAmt > 0 && state.fistAmt < 1) {
      drawCatPhoto(state.fistAmt < 0.5 ? BLACK2_IMG : BLACK1_IMG,
                   state.cat.x, state.cat.y,
                   state.fistAmt < 0.5 ? state.fistAmt : 1 - state.fistAmt, 1);
    }
    if (!state.caught) drawEyes(box);

    drawHandCursor();

    if (state.flash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${state.flash * 0.35})`;
      ctx.fillRect(0, 0, w, h);
    }

    state.raf = requestAnimationFrame(loop);
  }

  state.raf = requestAnimationFrame(loop);
  return () => {
    cancelAnimationFrame(state.raf);
    unsubscribe();
    window.removeEventListener("resize", onResize);
  };
}

// ============================================================
// 2. CHEESE CAT — two-hand stretch + elastic snap
// ============================================================
function startCheeseCatGame() {
  const canvas = document.getElementById("cheeseCanvas");
  const hint = document.getElementById("cheeseHint");
  let { ctx, w, h } = fitCanvas(canvas);
  const onResize = () => { const r = fitCanvas(canvas); ctx = r.ctx; w = r.w; h = r.h; };
  window.addEventListener("resize", onResize);

  const state = {
    free: false,
    cat: { x: 0, y: 0, vx: 0, vy: 0 },
    stability: 70,
    prevDist: null,
    raf: 0,
    last: performance.now(),
  };
  let leftHand = null, rightHand = null;

  const unsubscribe = window.HandTracker.subscribe(data => {
    leftHand  = data.hands[0] || null;
    rightHand = data.hands[1] || null;
  });

  function bgStripes() {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
  }

  function drawHand(p, color, label) {
    ctx.fillStyle = "rgba(244,169,59,0.18)";
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 22, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    if (label) {
      ctx.fillStyle = "#7a4a10";
      ctx.font = "11px ui-monospace, monospace";
      ctx.textAlign = "center";
      ctx.fillText(label, p.x, p.y + 36);
    }
  }

  function loop(now) {
    const dt = Math.min(0.05, (now - state.last) / 1000);
    state.last = now;
    bgStripes();

    if (leftHand && rightHand) {
      state.free = false;
      const lp = { x: leftHand.palm.x * w,  y: leftHand.palm.y * h };
      const rp = { x: rightHand.palm.x * w, y: rightHand.palm.y * h };
      const cx = (lp.x + rp.x) / 2, cy = (lp.y + rp.y) / 2;
      const dx = rp.x - lp.x, dy = rp.y - lp.y;
      const dist = Math.hypot(dx, dy);
      const angle = Math.atan2(dy, dx);

      const dDist = (state.prevDist == null) ? 0 : (state.prevDist - dist);
      const closingSpeed = dDist / Math.max(0.001, dt);
      if (state.prevDist != null && closingSpeed > 700 && state.prevDist > 140) {
        state.free = true;
        state.cat.x = cx; state.cat.y = cy;
        const flingMag = Math.min(1400, closingSpeed * 1.6);
        const flingAng = angle + Math.PI / 2 * (Math.random() < 0.5 ? -1 : 1) + (Math.random() - 0.5) * 0.6;
        state.cat.vx = Math.cos(flingAng) * flingMag;
        state.cat.vy = Math.sin(flingAng) * flingMag - 220;
        hint.textContent = "휘리릭! 튕겨나갔어요";
      }
      state.prevDist = dist;

      const baseScale = Math.max(3, Math.min(w, h) / 80);
      const spriteW = 24 * baseScale;
      const maxStretch = Math.max(4.5, (w * 0.98) / spriteW);
      const stretchX = Math.max(0.85, Math.min(maxStretch, dist / spriteW));
      const drawW = spriteW * stretchX;
      drawSideCat(ctx, cx - drawW / 2, cy - 6 * baseScale, baseScale, "cheese",
                  { stretchX, tilt: angle });

      drawHand(lp, "#c8830f", "L");
      drawHand(rp, "#c8830f", "R");
      ctx.strokeStyle = "rgba(244,169,59,0.35)";
      ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.moveTo(lp.x, lp.y); ctx.lineTo(rp.x, rp.y); ctx.stroke();
      ctx.setLineDash([]);

      const ideal = w * 0.45;
      const off = Math.abs(dist - ideal) / (w * 0.5);
      state.stability += (0.45 - off) * dt * 20;

      if (dist < 120) hint.textContent = "조금 더 벌려보세요";
      else if (!state.free) hint.textContent = "좋아요. 손을 빠르게 모으면 튕겨요";
    } else if (state.free) {
      state.cat.vy += 850 * dt;
      state.cat.vx *= 0.992;
      state.cat.vy *= 0.992;
      state.cat.x += state.cat.vx * dt;
      state.cat.y += state.cat.vy * dt;

      const baseScale = Math.max(3, Math.min(w, h) / 80);
      const r = 14 * baseScale;
      if (state.cat.x < r)     { state.cat.x = r; state.cat.vx *= -0.65; }
      if (state.cat.x > w - r) { state.cat.x = w - r; state.cat.vx *= -0.65; }
      if (state.cat.y > h - r) { state.cat.y = h - r; state.cat.vy *= -0.55; state.cat.vx *= 0.85; }

      drawSideCat(ctx, state.cat.x - 12 * baseScale, state.cat.y - 6 * baseScale, baseScale, "cheese");

      if (Math.abs(state.cat.vx) < 14 && Math.abs(state.cat.vy) < 14 &&
          state.cat.y > h - r - 4) {
        state.free = false;
        hint.textContent = "다시 양손을 보여주세요";
      }
      state.prevDist = null;
    } else {
      const baseScale = Math.max(3, Math.min(w, h) / 80);
      drawSideCat(ctx, w / 2 - 12 * baseScale, h / 2 - 6 * baseScale, baseScale, "cheese");
      if (!leftHand && !rightHand)        hint.textContent = "양손을 카메라에 보여주세요";
      else if (leftHand && !rightHand)    hint.textContent = "다른 손도 보여주세요";
      state.prevDist = null;
    }

    state.stability = Math.max(0, Math.min(100, state.stability));
    setScore("cheeseScore", state.stability);
    state.raf = requestAnimationFrame(loop);
  }

  state.raf = requestAnimationFrame(loop);
  return () => {
    cancelAnimationFrame(state.raf);
    unsubscribe();
    window.removeEventListener("resize", onResize);
  };
}

// ============================================================
// 3. TUXEDO CAT — pinch to gather scattered chest fur
// ============================================================
function startTuxedoCatGame() {
  const canvas = document.getElementById("tuxedoCanvas");
  const hint = document.getElementById("tuxedoHint");
  let { ctx, w, h } = fitCanvas(canvas);
  const onResize = () => { const r = fitCanvas(canvas); ctx = r.ctx; w = r.w; h = r.h; layoutPieces(); };
  window.addEventListener("resize", onResize);

  const state = {
    pieces: [],
    grace: 100,
    raf: 0,
    last: performance.now(),
    chaosTimer: 0,
  };
  let pinchPos = null, pinching = false, grabbed = null;

  function layoutPieces() {
    const cx = w / 2, cy = h / 2 + 10;
    const baseScale = Math.max(3, Math.min(w, h) / 70);
    const px = 11 * baseScale;
    const positions = [
      { x: cx - px*1.2, y: cy + px*0.2 },
      { x: cx - px*0.6, y: cy + px*0.9 },
      { x: cx,          y: cy + px*1.3 },
      { x: cx + px*0.6, y: cy + px*0.9 },
      { x: cx + px*1.2, y: cy + px*0.2 },
    ];
    state.pieces = positions.map(p => ({
      x: p.x, y: p.y,
      vx: 0, vy: 0,
      home: { x: p.x, y: p.y },
      size: 14,
    }));
  }
  layoutPieces();

  const unsubscribe = window.HandTracker.subscribe(data => {
    if (data.hands.length > 0) {
      const h0 = data.hands[0];
      pinchPos = {
        x: ((h0.thumbTip.x + h0.indexTip.x) / 2) * w,
        y: ((h0.thumbTip.y + h0.indexTip.y) / 2) * h,
      };
      const wasPinching = pinching;
      pinching = h0.isPinch;

      if (pinching && !wasPinching) {
        let near = null, best = 70;
        for (const p of state.pieces) {
          const d = Math.hypot(p.x - pinchPos.x, p.y - pinchPos.y);
          if (d < best) { best = d; near = p; }
        }
        grabbed = near;
        if (grabbed) hint.textContent = "잡았다! 가슴 중앙으로 옮겨주세요";
      } else if (!pinching && wasPinching && grabbed) {
        const d = Math.hypot(grabbed.x - grabbed.home.x, grabbed.y - grabbed.home.y);
        if (d < 30) {
          grabbed.x = grabbed.home.x;
          grabbed.y = grabbed.home.y;
          grabbed.vx = grabbed.vy = 0;
          state.grace += 5;
          hint.textContent = "단정하게 놓였어요";
        } else {
          grabbed.vx = (Math.random() - 0.5) * 60;
          grabbed.vy = (Math.random() - 0.5) * 60;
          hint.textContent = "흠… 다시 시도해보세요";
        }
        grabbed = null;
      }
    } else {
      pinchPos = null;
      pinching = false;
      grabbed = null;
    }
  });

  function loop(now) {
    const dt = Math.min(0.05, (now - state.last) / 1000);
    state.last = now;

    ctx.fillStyle = "#fbf8ee";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "rgba(20,20,20,0.05)";
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 24) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
    for (let y = 0; y < h; y += 24) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }

    state.chaosTimer -= dt;
    if (state.chaosTimer <= 0) {
      for (const p of state.pieces) {
        if (p === grabbed) continue;
        const ax = p.x - w / 2;
        const ay = p.y - h / 2;
        const len = Math.hypot(ax, ay) || 1;
        const dirX = ax / len, dirY = ay / len;
        p.vx += dirX * (60 + Math.random() * 80);
        p.vy += dirY * (60 + Math.random() * 80) - 40;
      }
      state.chaosTimer = 1.4 + Math.random() * 1.2;
      hint.textContent = "우다다! 셔츠가 흐트러져요";
    }

    const baseScale = Math.max(3, Math.min(w, h) / 70);
    const headX = w / 2 - 7 * baseScale;
    const headY = h / 2 - 12 * baseScale;
    drawTuxedoFrontCat(ctx, headX, headY, baseScale);

    for (const p of state.pieces) {
      if (p !== grabbed) {
        p.vx *= 0.92; p.vy *= 0.92;
        p.x += p.vx * dt; p.y += p.vy * dt;
        if (p.x < 12) { p.x = 12; p.vx *= -0.5; }
        if (p.x > w - 12) { p.x = w - 12; p.vx *= -0.5; }
        if (p.y < 12) { p.y = 12; p.vy *= -0.5; }
        if (p.y > h - 12) { p.y = h - 12; p.vy *= -0.5; }
      } else if (pinchPos) {
        p.x = pinchPos.x; p.y = pinchPos.y;
      }

      ctx.strokeStyle = "rgba(20,20,20,0.18)";
      ctx.setLineDash([3, 3]);
      ctx.lineWidth = 1;
      ctx.strokeRect(p.home.x - p.size, p.home.y - p.size, p.size * 2, p.size * 2);
      ctx.setLineDash([]);

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = "#fbf8ee";
      ctx.strokeStyle = "#0a0a0a";
      ctx.lineWidth = 1.5;
      ctx.fillRect(-p.size, -p.size, p.size * 2, p.size * 2);
      ctx.strokeRect(-p.size, -p.size, p.size * 2, p.size * 2);
      ctx.restore();

      if (p === grabbed) {
        ctx.strokeStyle = "#c0392b";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size + 8, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    let scatter = 0;
    for (const p of state.pieces) {
      scatter += Math.hypot(p.x - p.home.x, p.y - p.home.y);
    }
    const avg = scatter / state.pieces.length;
    state.grace -= avg * dt * 0.18;
    state.grace += (avg < 14 ? 1 : 0) * dt * 8;
    state.grace = Math.max(0, Math.min(100, state.grace));
    setScore("tuxedoScore", state.grace);

    if (pinchPos) {
      ctx.strokeStyle = pinching ? "#c0392b" : "#0a0a0a";
      ctx.fillStyle = pinching ? "rgba(192,57,43,0.18)" : "rgba(10,10,10,0.06)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(pinchPos.x, pinchPos.y, pinching ? 10 : 22, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#0a0a0a";
      ctx.font = "11px ui-monospace, monospace";
      ctx.textAlign = "center";
      ctx.fillText(pinching ? "👌 핀치" : "✋ 손가락을 모으세요", pinchPos.x, pinchPos.y + 36);
    }

    state.raf = requestAnimationFrame(loop);
  }

  state.raf = requestAnimationFrame(loop);
  return () => {
    cancelAnimationFrame(state.raf);
    unsubscribe();
    window.removeEventListener("resize", onResize);
  };
}

function drawTuxedoFrontCat(ctx, x, y, s) {
  const sprite = [
    "00110000000110",
    "01110000001110",
    "01111000011110",
    "01111111111110",
    "11111111111111",
    "11122111122111",
    "11132111132111",
    "11111155511111",
    "11111111111111",
    "01111111111110",
    "01111111111110",
    "01111111111110",
    "00111111111100",
    "00011111111000",
  ];
  const col = { 1: "#0e0e0e", 2: "#a3d24f", 3: "#0c1503", 5: "#e58aa8" };
  for (let r = 0; r < sprite.length; r++) {
    for (let c = 0; c < sprite[r].length; c++) {
      const ch = sprite[r][c];
      if (ch === "0") continue;
      ctx.fillStyle = col[ch] || "#000";
      ctx.fillRect(Math.round(x + c * s), Math.round(y + r * s), Math.ceil(s), Math.ceil(s));
    }
  }
}

// ============================================================
// 4. CALICO CAT — palm-stroke → happiness → POOF! split into 3
// ============================================================
function startCalicoCatGame() {
  const canvas = document.getElementById("calicoCanvas");
  const hint = document.getElementById("calicoHint");
  let { ctx, w, h } = fitCanvas(canvas);
  const onResize = () => { const r = fitCanvas(canvas); ctx = r.ctx; w = r.w; h = r.h; };
  window.addEventListener("resize", onResize);

  const state = {
    happiness: 0,
    purr: 0,
    pop: false,
    popAt: 0,
    splits: [],
    smoke: [],
    hearts: [],
    raf: 0,
    last: performance.now(),
  };
  let handPos = null, prevHandPos = null;

  const unsubscribe = window.HandTracker.subscribe(data => {
    if (data.hands.length > 0) {
      const h0 = data.hands[0];
      handPos = { x: h0.palm.x * w, y: h0.palm.y * h };
    } else {
      handPos = null;
    }
  });

  function poof(cx, cy) {
    state.pop = true;
    state.popAt = performance.now();
    const colors = ["white", "cheese", "black"];
    for (let i = 0; i < 3; i++) {
      const ang = (i / 3) * Math.PI * 2 - Math.PI / 2;
      state.splits.push({
        x: cx, y: cy,
        vx: Math.cos(ang) * 320,
        vy: Math.sin(ang) * 320 - 120,
        color: colors[i],
      });
    }
    for (let i = 0; i < 36; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = 120 + Math.random() * 220;
      state.smoke.push({
        x: cx, y: cy,
        vx: Math.cos(a) * v, vy: Math.sin(a) * v,
        life: 1.0,
        size: 18 + Math.random() * 20,
      });
    }
    hint.textContent = "펑! 분신술 발동 ✨";
  }

  function loop(now) {
    const dt = Math.min(0.05, (now - state.last) / 1000);
    state.last = now;

    ctx.fillStyle = "#fff5e6";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "rgba(244,169,59,0.06)";
    for (let i = 0; i < 80; i++) {
      const sx = (i * 47 + Math.sin(now / 800 + i) * 3) % w;
      const sy = (i * 113 + Math.cos(now / 1100 + i) * 3) % h;
      ctx.fillRect(sx, sy, 2, 2);
    }

    const baseScale = Math.max(3, Math.min(w, h) / 60);
    const cx = w / 2, cy = h / 2;

    if (!state.pop) {
      if (handPos && prevHandPos) {
        const dx = handPos.x - prevHandPos.x;
        const dy = handPos.y - prevHandPos.y;
        const speed = Math.hypot(dx, dy) / Math.max(0.001, dt);
        const overCat =
          handPos.x > cx - 15 * baseScale && handPos.x < cx + 15 * baseScale &&
          handPos.y > cy - 9  * baseScale && handPos.y < cy + 9  * baseScale;
        if (overCat && speed > 80) {
          state.happiness += dt * Math.min(80, speed) * 0.5;
          state.purr = 1;
          if (Math.random() < 0.18) {
            state.hearts.push({
              x: handPos.x + (Math.random() - 0.5) * 20,
              y: handPos.y - 10,
              vy: -40 - Math.random() * 30,
              life: 1,
            });
          }
        }
      }
      state.purr = Math.max(0, state.purr - dt * 1.6);
      state.happiness = Math.max(0, state.happiness - dt * 1.2);
      state.happiness = Math.min(100, state.happiness);
      setScore("calicoScore", state.happiness);

      const bob = Math.sin(now / 120) * state.purr * 2;
      drawCalicoCat(ctx, cx - 12 * baseScale, cy - 6 * baseScale + bob, baseScale,
        { blink: state.purr > 0.6 && Math.sin(now / 220) > 0.85 });

      if (state.purr > 0.3) {
        ctx.fillStyle = "rgba(244,169,59,0.85)";
        ctx.font = "13px ui-monospace, monospace";
        ctx.textAlign = "center";
        ctx.fillText("그르릉~", cx, cy - 14 * baseScale);
      }

      if (state.happiness >= 100) poof(cx, cy);
    } else {
      const t = (now - state.popAt) / 1000;

      state.smoke = state.smoke.filter(p => p.life > 0);
      for (const p of state.smoke) {
        p.x += p.vx * dt; p.y += p.vy * dt;
        p.vy += 60 * dt;
        p.vx *= 0.96; p.vy *= 0.98;
        p.life -= dt * 0.8;
        ctx.fillStyle = `rgba(220,210,200,${Math.max(0, p.life * 0.7)})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (1 + (1 - p.life)), 0, Math.PI * 2);
        ctx.fill();
      }

      for (const sp of state.splits) {
        sp.vy += 700 * dt;
        sp.vx *= 0.99;
        sp.x += sp.vx * dt;
        sp.y += sp.vy * dt;
        const r = 8 * baseScale;
        if (sp.y > h - r) { sp.y = h - r; sp.vy *= -0.55; sp.vx *= 0.85; }
        if (sp.x < r) { sp.x = r; sp.vx *= -0.6; }
        if (sp.x > w - r) { sp.x = w - r; sp.vx *= -0.6; }
        drawSideCat(ctx, sp.x - 12 * baseScale, sp.y - 6 * baseScale, baseScale, sp.color);
      }

      if (t < 1.6) {
        ctx.fillStyle = `rgba(20,20,20,${Math.max(0, 1 - t / 1.6)})`;
        ctx.font = "bold 28px ui-monospace, monospace";
        ctx.textAlign = "center";
        ctx.fillText("✨ 분신술! ✨", cx, cy - 60);
      }

      if (t > 4) {
        ctx.fillStyle = "rgba(0,0,0,0.6)";
        ctx.font = "12px ui-monospace, monospace";
        ctx.textAlign = "center";
        ctx.fillText("손바닥을 빠르게 흔들면 다시 모여요", cx, h - 18);
        if (handPos && prevHandPos) {
          const speed = Math.hypot(handPos.x - prevHandPos.x, handPos.y - prevHandPos.y) / Math.max(0.001, dt);
          if (speed > 250) reset();
        }
      }
    }

    state.hearts = state.hearts.filter(hh => hh.life > 0);
    for (const hh of state.hearts) {
      hh.y += hh.vy * dt;
      hh.life -= dt * 1.1;
      ctx.fillStyle = `rgba(229,138,168,${Math.max(0, hh.life)})`;
      ctx.font = `${14 + (1 - hh.life) * 6}px ui-monospace, monospace`;
      ctx.textAlign = "center";
      ctx.fillText("♥", hh.x, hh.y);
    }

    if (handPos) {
      ctx.strokeStyle = "rgba(244,169,59,0.85)";
      ctx.fillStyle = "rgba(244,169,59,0.16)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(handPos.x, handPos.y, 26, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
    }

    prevHandPos = handPos ? { ...handPos } : null;
    state.raf = requestAnimationFrame(loop);
  }

  function reset() {
    state.pop = false;
    state.splits = [];
    state.smoke = [];
    state.happiness = 0;
    setScore("calicoScore", 0);
    hint.textContent = "한 번 더! 부드럽게 쓰다듬어 주세요";
  }

  state.raf = requestAnimationFrame(loop);
  return () => {
    cancelAnimationFrame(state.raf);
    unsubscribe();
    window.removeEventListener("resize", onResize);
  };
}

// ============================================================
// HOME — pixel cat icon shown peeking from the file boxes
// ============================================================
const HOME_CAT_SPRITE = [
  "00110000000110",
  "01110000001110",
  "01111000011110",
  "01111111111110",
  "11111111111111",
  "11132111113211",
  "11122111112211",
  "11111155511111",
  "11111111111111",
  "01111444441110",
  "01111444441110",
  "01111444441110",
  "00111111111100",
  "00011111111000",
];

const HOME_PALETTE = {
  black:  { 1: "#0e0e0e", 2: "#f5e58a", 3: "#fff8c4", 4: "#0e0e0e", 5: "#e58aa8" },
  cheese: { 1: "#f4a93b", 2: "#1d1100", 3: "#fff0c8", 4: "#ffd98c", 5: "#e58aa8" },
  tuxedo: { 1: "#0e0e0e", 2: "#a3d24f", 3: "#e8ffc6", 4: "#fbf8ee", 5: "#e58aa8" },
  calico: { 1: "#fafafa", 2: "#1a1a1a", 3: "#ffffff", 4: "#f4a93b", 5: "#e58aa8" },
};

function drawHomeCat(canvas, type) {
  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const cw = canvas.clientWidth || canvas.width;
  const ch = canvas.clientHeight || canvas.height;
  canvas.width = Math.floor(cw * dpr);
  canvas.height = Math.floor(ch * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, cw, ch);

  const cols = HOME_CAT_SPRITE[0].length;
  const rows = HOME_CAT_SPRITE.length;
  const scale = Math.floor(Math.min(cw / cols, ch / rows));
  const ox = Math.floor((cw - cols * scale) / 2);
  const oy = Math.floor((ch - rows * scale) / 2);
  const palette = HOME_PALETTE[type] || HOME_PALETTE.black;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const code = HOME_CAT_SPRITE[r][c];
      if (code === "0") continue;
      ctx.fillStyle = palette[code] || "#000";
      ctx.fillRect(ox + c * scale, oy + r * scale, scale, scale);
    }
  }

  if (type === "calico") {
    const orange = new Set(["7,4","7,5","8,3","8,4","8,5","9,5","9,6","10,5"]);
    const black  = new Set(["3,9","3,10","4,9","4,10","4,11","5,11","5,12","6,11"]);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (HOME_CAT_SPRITE[r][c] !== "1") continue;
        const k = `${r},${c}`;
        if (orange.has(k))      ctx.fillStyle = "#f4a93b";
        else if (black.has(k))  ctx.fillStyle = "#0e0e0e";
        else continue;
        ctx.fillRect(ox + c * scale, oy + r * scale, scale, scale);
      }
    }
  }
}

function drawLogoCat(canvas) {
  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const cw = canvas.clientWidth || canvas.width;
  const ch = canvas.clientHeight || canvas.height;
  canvas.width = Math.floor(cw * dpr);
  canvas.height = Math.floor(ch * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, cw, ch);

  const grid = 16;
  const s = Math.floor(Math.min(cw, ch) / grid);
  const ox = Math.floor((cw - grid * s) / 2);
  const oy = Math.floor((ch - grid * s) / 2);
  const trail = [
    [1, 4, "#0a0a0a"], [2, 5, "#0a0a0a"], [3, 6, "#0a0a0a"],
    [2, 7, "#0a0a0a"], [4, 7, "#0a0a0a"],
    [1, 8, "#0a0a0a"], [3, 9, "#0a0a0a"], [2, 10, "#0a0a0a"],
  ];
  trail.forEach(([x, y, c]) => { ctx.fillStyle = c; ctx.fillRect(ox + x * s, oy + y * s, s, s); });
  const body = [
    [6, 5], [7, 5], [8, 5],
    [5, 6], [6, 6], [7, 6], [8, 6], [9, 6],
    [5, 7], [6, 7], [7, 7], [8, 7], [9, 7],
    [6, 8], [7, 8], [8, 8],
  ];
  ctx.fillStyle = "#fff";
  body.forEach(([x, y]) => ctx.fillRect(ox + x * s, oy + y * s, s, s));
  ctx.fillStyle = "#0a0a0a";
  const outline = [
    [6, 4], [8, 4],
    [5, 5], [9, 5],
    [4, 6], [10, 6],
    [4, 7], [10, 7],
    [5, 8], [9, 8],
    [6, 9], [7, 9], [8, 9],
  ];
  outline.forEach(([x, y]) => ctx.fillRect(ox + x * s, oy + y * s, s, s));
  const squares = [
    [10, 4, "#e74c3c"],
    [11, 5, "#3aa6ff"],
    [10, 6, "#f4d03f"],
    [11, 7, "#34c759"],
  ];
  squares.forEach(([x, y, c]) => { ctx.fillStyle = c; ctx.fillRect(ox + x * s, oy + y * s, s, s); });
}

window.CatGames = {
  startBlackCatGame, startCheeseCatGame, startTuxedoCatGame, startCalicoCatGame,
  drawHomeCat, drawLogoCat,
};
