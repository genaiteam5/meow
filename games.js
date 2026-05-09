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

// Pre-load the caught-cat reveal photo for the black-cat game.
const BLACK2_IMG = new Image();
BLACK2_IMG.src = "public/black2.png";

// Tuxedo cat photos — cat4 = base (messy), cat5 = tidy/groomed
const CAT4_IMG = new Image();
const CAT5_IMG = new Image();
CAT4_IMG.src = "public/cat4.png";
CAT5_IMG.src = "public/cat5.png";

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
    catchAmt: 0,           // 0 = open, 1 = caught (locks on black2)
    caught: false,
    caughtUntil: 0,
    flash: 0,
    kick: 0,
    blink: 0,              // brief swap to black2 to fake an eye-blink
    nextBlinkAt: 0,
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
    if (!img.naturalWidth || alpha <= 0) return;
    const ar = img.naturalWidth / img.naturalHeight;
    const target = Math.min(w, h) * 0.6 * scaleMul;
    let drawW, drawH;
    if (ar >= 1) { drawW = target; drawH = target / ar; }
    else         { drawH = target; drawW = target * ar; }
    const x = cx - drawW / 2;
    const y = cy - drawH / 2;
    ctx.globalAlpha = alpha;
    ctx.drawImage(img, x, y, drawW, drawH);
    ctx.globalAlpha = 1;
  }

  function drawWanderingEyes(cx, cy, blink) {
    // pixel-style cat eyes: white sclera with black pupil, blink collapses height
    const px = Math.max(2, Math.round(Math.min(w, h) / 180));
    const eyeW = px * 6;
    const eyeH = px * 6;
    const gap  = px * 5;
    const open = Math.max(0, 1 - blink);
    const halfH = Math.max(px * 0.5, (eyeH / 2) * open);

    function drawOne(ex) {
      const x = Math.round(ex - eyeW / 2);
      const yTop = Math.round(cy - halfH);
      const h2 = Math.round(halfH * 2);
      // black outline (slightly larger)
      ctx.fillStyle = "#0a0a0a";
      ctx.fillRect(x - px, yTop - px, eyeW + px * 2, h2 + px * 2);
      // white sclera
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(x, yTop, eyeW, h2);
      // black pupil — vertical slit, scales with openness
      if (open > 0.25) {
        const pw = Math.max(px, Math.round(eyeW * 0.32));
        const ph = Math.max(px, Math.round(h2 * 0.7));
        ctx.fillStyle = "#0a0a0a";
        ctx.fillRect(
          Math.round(ex - pw / 2),
          Math.round(cy - ph / 2),
          pw, ph
        );
      }
    }
    drawOne(cx - gap);
    drawOne(cx + gap);
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

    // eyes wander (cat target drift); freeze in place while caught
    if (!state.caught) {
      if (now > state.cat.retargetAt) pickTarget();
      const dx = state.cat.tx - state.cat.x;
      const dy = state.cat.ty - state.cat.y;
      let speed = 1.6;
      if (handPos) {
        const hd = Math.hypot(handPos.x - state.cat.x, handPos.y - state.cat.y);
        if (hd < Math.min(w, h) * 0.22) {
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
    if (!state.caught && now > state.nextBlinkAt) {
      state.blink = 1;
      state.nextBlinkAt = now + 1800 + Math.random() * 2400;
    }
    state.blink = Math.max(0, state.blink - dt * 6);

    // catch: fist over the eyes
    if (!state.caught && isFist && handPos) {
      const catR = Math.min(w, h) * 0.16;
      if (Math.hypot(handPos.x - state.cat.x, handPos.y - state.cat.y) < catR) {
        state.caught = true;
        state.caughtUntil = now + 1800;
        state.flash = 1;
        state.kick = 1;
        state.blink = 0;
        hint.textContent = "✊ 잡았다!";
      }
    }
    if (state.caught && now > state.caughtUntil) {
      state.caught = false;
      hint.textContent = "✋ 다시 어둠 속의 눈을 찾아봐요";
      placeNow();
    }

    // smooth reveal: photo only appears while caught
    const targetReveal = state.caught ? 1 : 0;
    state.catchAmt += (targetReveal - state.catchAmt) * Math.min(1, dt * 9);
    state.flash = Math.max(0, state.flash - dt * 2.2);
    state.kick  = Math.max(0, state.kick - dt * 3);

    // dark backdrop
    ctx.fillStyle = "#06060a";
    ctx.fillRect(0, 0, w, h);

    if (state.catchAmt > 0.01) {
      // caught reveal — show black2 photo with kick
      const kickScale = 1 + state.kick * 0.08;
      drawCatPhoto(BLACK2_IMG, state.cat.x, state.cat.y, state.catchAmt, kickScale);
    }
    if (state.catchAmt < 0.99) {
      // wandering eyes only — no flashlight, no cat body
      drawWanderingEyes(state.cat.x, state.cat.y, state.blink);
    }

    drawHandCursor();

    if (state.flash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${state.flash * 0.4})`;
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
// 3. TUXEDO CAT — pinch the open chest fur to gather it tidy
//
// Idle: cat4.png shown; the white chest fur is rendered as a wide,
//   ragged opening that slowly drifts wider over time.
// Active: thumb+index pinch (MediaPipe landmarks 4 & 8) inside the
//   fur area continuously narrows the opening.
// Success: opening narrow enough → cat5.png reveal + heart particles
//   + "단정!" pixel text. Holds briefly then resets.
// ============================================================
function startTuxedoCatGame() {
  const canvas = document.getElementById("tuxedoCanvas");
  const hint = document.getElementById("tuxedoHint");
  let { ctx, w, h } = fitCanvas(canvas);
  const onResize = () => { const r = fitCanvas(canvas); ctx = r.ctx; w = r.w; h = r.h; };
  window.addEventListener("resize", onResize);

  const state = {
    openness: 0.85,        // 0 = tidy, 1 = fully open
    success: false,
    successUntil: 0,
    hearts: [],
    raf: 0,
    last: performance.now(),
  };
  let pinchPos = null, pinching = false, pinchDist = 1;

  const unsubscribe = window.HandTracker.subscribe(data => {
    if (data.hands.length > 0) {
      const h0 = data.hands[0];
      const tx = h0.thumbTip.x * w, ty = h0.thumbTip.y * h;
      const ix = h0.indexTip.x * w, iy = h0.indexTip.y * h;
      pinchPos = { x: (tx + ix) / 2, y: (ty + iy) / 2 };
      pinchDist = Math.hypot(tx - ix, ty - iy);
      pinching = h0.isPinch;
    } else {
      pinchPos = null;
      pinching = false;
    }
  });

  // chest fur geometry (as a ratio of cat photo bounds)
  function furBounds() {
    const target = Math.min(w, h) * 0.7;
    // cat photo is 'contain'-fit ~70% of min dim, centered at (cx, cy)
    const cx = w / 2;
    const cy = h * 0.55;
    return {
      cx,
      // chest sits in the lower middle of the cat
      cyTop:    cy + target * 0.05,
      cyBot:    cy + target * 0.36,
      maxHalfW: target * 0.28,    // fully open
      minHalfW: target * 0.07,    // tidy
    };
  }

  function pinchInsideFur(b) {
    if (!pinchPos) return false;
    if (pinchPos.y < b.cyTop - 20 || pinchPos.y > b.cyBot + 20) return false;
    const halfW = b.maxHalfW * state.openness + 20;
    return Math.abs(pinchPos.x - b.cx) < halfW;
  }

  function drawFurOpening(b) {
    // ragged white wedge: top wide, narrows toward bottom — width scales with openness
    const halfW = b.maxHalfW * state.openness + b.minHalfW * (1 - state.openness);
    const px = Math.max(2, Math.round(Math.min(w, h) / 220));  // pixel chunk size
    ctx.fillStyle = "#fbf8ee";
    const rows = Math.floor((b.cyBot - b.cyTop) / px);
    for (let r = 0; r <= rows; r++) {
      const y = b.cyTop + r * px;
      const t = r / rows;
      // tapers from full halfW at top to ~30% at bottom
      const taper = 1 - t * 0.65;
      // ragged left/right edge — deterministic jitter so it doesn't shimmer
      const jitterL = ((r * 73) % 5) * px - 2 * px;
      const jitterR = ((r * 91) % 5) * px - 2 * px;
      const left  = b.cx - halfW * taper + jitterL * (state.openness * 0.7 + 0.3);
      const right = b.cx + halfW * taper + jitterR * (state.openness * 0.7 + 0.3);
      ctx.fillRect(Math.round(left), Math.round(y), Math.max(px, Math.round(right - left)), px);
    }
    // dark outline edges to make the "rip" read as cat fur
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    for (let r = 0; r <= rows; r += 2) {
      const y = b.cyTop + r * px;
      const t = r / rows;
      const taper = 1 - t * 0.65;
      const jitterL = ((r * 73) % 5) * px - 2 * px;
      const jitterR = ((r * 91) % 5) * px - 2 * px;
      const left  = b.cx - halfW * taper + jitterL * (state.openness * 0.7 + 0.3);
      const right = b.cx + halfW * taper + jitterR * (state.openness * 0.7 + 0.3);
      ctx.fillRect(Math.round(left - px), Math.round(y), px, px);
      ctx.fillRect(Math.round(right),     Math.round(y), px, px);
    }
  }

  function spawnHearts(now) {
    if (state.hearts.length > 60) return;
    if (Math.random() < 0.35) {
      const b = furBounds();
      state.hearts.push({
        x: b.cx + (Math.random() - 0.5) * b.maxHalfW * 1.2,
        y: b.cyTop + Math.random() * (b.cyBot - b.cyTop),
        vy: -40 - Math.random() * 50,
        vx: (Math.random() - 0.5) * 30,
        life: 1.4,
        size: 8 + Math.random() * 6,
        born: now,
      });
    }
  }

  function drawHearts(dt) {
    const px = Math.max(2, Math.round(Math.min(w, h) / 240));
    for (let i = state.hearts.length - 1; i >= 0; i--) {
      const p = state.hearts[i];
      p.life -= dt;
      if (p.life <= 0) { state.hearts.splice(i, 1); continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 12 * dt;
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life / 1.2));
      ctx.fillStyle = "#e8556b";
      // simple pixel heart
      const s = px;
      const cx = Math.round(p.x), cy = Math.round(p.y);
      ctx.fillRect(cx - 2*s, cy - s,   2*s, s);
      ctx.fillRect(cx,       cy - s,   2*s, s);
      ctx.fillRect(cx - 3*s, cy,       6*s, s);
      ctx.fillRect(cx - 2*s, cy + s,   4*s, s);
      ctx.fillRect(cx - s,   cy + 2*s, 2*s, s);
      ctx.globalAlpha = 1;
    }
  }

  function drawSuccessText(now) {
    const t = Math.max(0, (state.successUntil - now) / 2500);
    ctx.save();
    const baseSize = Math.max(20, Math.min(w, h) / 18);
    ctx.font = `${Math.round(baseSize)}px "Galmuri11", "Courier New", monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const x = w / 2;
    const y = h * 0.22;
    // shadow
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillText("단정!", x + 3, y + 3);
    ctx.fillStyle = "#fff8a8";
    ctx.fillText("단정!", x, y);
    // tiny sparkles
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    const px = Math.max(2, Math.round(baseSize / 9));
    for (let i = 0; i < 6; i++) {
      const ang = (i / 6) * Math.PI * 2 + (1 - t) * 4;
      const r = baseSize * (1.2 + Math.sin((1 - t) * 6 + i) * 0.3);
      ctx.fillRect(Math.round(x + Math.cos(ang) * r), Math.round(y + Math.sin(ang) * r), px, px);
    }
    ctx.restore();
  }

  function drawPinchCursor() {
    if (!pinchPos) return;
    ctx.save();
    const closing = pinching;
    ctx.strokeStyle = closing ? "#c0392b" : "rgba(40,40,40,0.85)";
    ctx.fillStyle   = closing ? "rgba(192,57,43,0.22)" : "rgba(255,255,255,0.18)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(pinchPos.x, pinchPos.y, closing ? 12 : 22, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  hint.textContent = "✋ 엄지·검지를 흰 털 위에서 모아 여며주세요";

  function loop(now) {
    const dt = Math.min(0.05, (now - state.last) / 1000);
    state.last = now;

    drawPixelGrassBg(ctx, w, h);

    // success state ends → reset to messy
    if (state.success && now > state.successUntil) {
      state.success = false;
      state.openness = 0.85;
      hint.textContent = "✋ 다시 흐트러졌어요. 여며주세요";
    }

    // openness dynamics
    if (!state.success) {
      const b = furBounds();
      if (pinching && pinchInsideFur(b)) {
        // tighter pinch (smaller thumb-index distance) → faster gathering
        const tightness = Math.max(0, 1 - pinchDist / Math.max(40, Math.min(w, h) * 0.08));
        state.openness -= dt * (0.55 + tightness * 0.65);
        hint.textContent = "여미는 중…";
      } else {
        // gentle drift wider
        state.openness += dt * 0.06;
      }
      state.openness = Math.max(0, Math.min(1, state.openness));
      if (state.openness <= 0.18) {
        state.success = true;
        state.successUntil = now + 2500;
        hint.textContent = "단정! ✨ 기분 좋아요";
      }
    }

    // cat photo: cat4 (drowsy) when messy, cat5 (eyes open) on success
    drawTuxedoPhoto(ctx, w, h, state.success ? 100 : 0);

    // chest fur opening — hide on success (clean state)
    if (!state.success) {
      drawFurOpening(furBounds());
    }

    if (state.success) {
      spawnHearts(now);
      drawSuccessText(now);
    }
    drawHearts(dt);

    drawPinchCursor();

    state.raf = requestAnimationFrame(loop);
  }

  state.raf = requestAnimationFrame(loop);
  return () => {
    cancelAnimationFrame(state.raf);
    unsubscribe();
    window.removeEventListener("resize", onResize);
  };
}

function drawPixelGrassBg(ctx, w, h) {
  const skyH = Math.round(h * 0.62);
  // sky
  const sky = ctx.createLinearGradient(0, 0, 0, skyH);
  sky.addColorStop(0, "#4ea7d6");
  sky.addColorStop(1, "#6ec0e0");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, skyH);

  // grass strips (matches home-grass palette)
  const g1H = Math.round((h - skyH) * 0.18);
  const g2H = Math.round((h - skyH) * 0.20);
  ctx.fillStyle = "#79b34a"; ctx.fillRect(0, skyH,            w, g1H);
  ctx.fillStyle = "#6aa340"; ctx.fillRect(0, skyH + g1H,      w, g2H);
  ctx.fillStyle = "#5e9637"; ctx.fillRect(0, skyH + g1H + g2H, w, h - skyH - g1H - g2H);

  // pixel grass-blade tufts at the sky/grass boundary
  ctx.fillStyle = "#79b34a";
  const blade = Math.max(3, Math.round(Math.min(w, h) / 200));
  for (let x = 0; x < w; x += blade * 6) {
    const tuftH = blade * (2 + ((x / (blade * 6)) % 3));
    ctx.fillRect(x,             skyH - tuftH,     blade,     tuftH);
    ctx.fillRect(x + blade * 2, skyH - tuftH * 0.6, blade, tuftH * 0.6);
  }

  // a few pixel clouds in the sky
  ctx.fillStyle = "#fffbe6";
  const cloudY = Math.round(h * 0.12);
  function cloud(cx) {
    const u = blade;
    ctx.fillRect(cx,         cloudY,         u * 6, u);
    ctx.fillRect(cx - u,     cloudY + u,     u * 8, u);
    ctx.fillRect(cx - u * 2, cloudY + u * 2, u * 10, u);
  }
  cloud(Math.round(w * 0.18));
  cloud(Math.round(w * 0.72));
}

function drawTuxedoPhoto(ctx, w, h, grace) {
  // grace 0..100 → blend cat4 (messy) → cat5 (tidy)
  const t = Math.max(0, Math.min(1, grace / 100));
  function drawFit(img, alpha) {
    if (!img.naturalWidth || alpha <= 0) return;
    const ar = img.naturalWidth / img.naturalHeight;
    // contain — show the whole cat, ~70% of the smaller dimension
    const target = Math.min(w, h) * 0.7;
    let dw, dh;
    if (ar >= 1) { dw = target; dh = target / ar; }
    else         { dh = target; dw = target * ar; }
    // sit on the grass: center horizontally, center vertically at h*0.55
    const x = (w - dw) / 2;
    const y = h * 0.55 - dh / 2;
    ctx.globalAlpha = alpha;
    ctx.drawImage(img, x, y, dw, dh);
    ctx.globalAlpha = 1;
  }
  drawFit(CAT4_IMG, 1 - t);
  drawFit(CAT5_IMG, t);
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
