// ============================================================
// Pixel cat sprite (32x32 grid). 0=transparent, 1=black,
// 2=yellow eye, 3=eye highlight, 4=white belly/tuxedo, 5=pink nose
// ============================================================
const CAT_SPRITE = [
  "00000000000000000000000000000000",
  "00000000000000000000000010000000",
  "00000000000000000000000110000000",
  "00000000000000000000001110000000",
  "00000000000000000000011100000000",
  "00000000000000000001111000000000",
  "00000000000000000111110000000000",
  "00000000000000011111100000000000",
  "00000010000001111111000000000000",
  "00000110000111111110000000000000",
  "00001110011111111100000000000000",
  "00011111111111111000000000000000",
  "00111111111111110000000000000000",
  "01111111111111100000000000000000",
  "11111122111122110000000000000000",
  "11112233111223310000000000000000",
  "11112233111223310000000000000000",
  "11111122111122110000000000000000",
  "11111111155111110000000000000000",
  "01111111111111110000000000000000",
  "00111111111111100000000000000000",
  "00011111111111000000000000000000",
  "00001111111110000000000000000000",
  "00000111111100000000000000000000",
  "00000011111000000000000000000000",
  "00000000000000000000000000000000",
  "00000000000000000000000000000000",
  "00000000000000000000000000000000",
  "00000000000000000000000000000000",
  "00000000000000000000000000000000",
  "00000000000000000000000000000000",
  "00000000000000000000000000000000",
];

function paletteColor(palette, code) {
  const map = {
    black:  { 1: "#0a0a0a", 2: "#f5e58a", 3: "#1a1206", 4: "#ffffff", 5: "#e58aa8" },
    cheese: { 1: "#f4a93b", 2: "#1d1100", 3: "#fff0c8", 4: "#ffe1a8", 5: "#e58aa8" },
    tuxedo: { 1: "#0a0a0a", 2: "#a3d24f", 3: "#0c1503", 4: "#fbf8ee", 5: "#e58aa8" },
  };
  return map[palette][code];
}

function drawCat(ctx, sprite, x, y, scale, palette, opts = {}) {
  const blink = opts.blink ?? false;       // blink eyes
  const stretchX = opts.stretchX ?? 1;     // horizontal stretch
  const stretchY = opts.stretchY ?? 1;     // vertical stretch
  const onlyEyes = opts.onlyEyes ?? false; // black-cat hidden mode
  const wobble = opts.wobble ?? 0;         // jitter
  const overrideEyeColor = opts.eyeColor;
  for (let row = 0; row < sprite.length; row++) {
    for (let col = 0; col < sprite[row].length; col++) {
      const c = sprite[row][col];
      if (c === "0") continue;
      const code = parseInt(c, 10);
      if (onlyEyes && code !== 2 && code !== 3) continue;
      let color = paletteColor(palette, code);
      if (overrideEyeColor && (code === 2)) color = overrideEyeColor;
      if (blink && (code === 2 || code === 3)) color = paletteColor(palette, 1);
      ctx.fillStyle = color;
      const wx = wobble ? (Math.random() - 0.5) * wobble : 0;
      const wy = wobble ? (Math.random() - 0.5) * wobble : 0;
      ctx.fillRect(
        Math.round(x + col * scale * stretchX + wx),
        Math.round(y + row * scale * stretchY + wy),
        Math.ceil(scale * stretchX),
        Math.ceil(scale * stretchY),
      );
    }
  }
}

// utility for hi-DPI scaling
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

// ============================================================
// 1. BLACK CAT — find it in the dark
// ============================================================
function startBlackCatGame() {
  const canvas = document.getElementById("blackCanvas");
  const hint = document.getElementById("blackHint");
  let { ctx, w, h } = fitCanvas(canvas);
  const onResize = () => { const r = fitCanvas(canvas); ctx = r.ctx; w = r.w; h = r.h; placeCat(); };
  window.addEventListener("resize", onResize);

  const state = {
    catX: 0, catY: 0,
    visible: false,
    blinkPhase: 0,       // 0..1
    nextBlink: 1.5,
    found: 0,
    total: 5,
    revealUntil: 0,      // timestamp during which cat fully shown after click
    meowAt: 0,
    moveAt: 0,
    raf: 0,
    last: performance.now(),
  };

  const scale = () => Math.max(3, Math.min(w, h) / 70);

  function placeCat() {
    const s = scale();
    const margin = 32 * s;
    state.catX = Math.random() * Math.max(1, w - margin) + margin * 0.2;
    state.catY = Math.random() * Math.max(1, h - margin) + margin * 0.2;
    state.visible = false;
    state.blinkPhase = 0;
    state.nextBlink = 0.6 + Math.random() * 1.2;
    state.meowAt = performance.now() + 1800 + Math.random() * 1800;
    state.moveAt = performance.now() + 4000 + Math.random() * 3000;
  }
  placeCat();

  function loop(now) {
    const dt = Math.min(0.05, (now - state.last) / 1000);
    state.last = now;

    // background — soft starry darkness
    ctx.fillStyle = "#08080c";
    ctx.fillRect(0, 0, w, h);
    // dust stars
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    for (let i = 0; i < 40; i++) {
      const sx = (i * 73 + Math.sin(now / 1500 + i) * 4) % w;
      const sy = (i * 137 + Math.cos(now / 2000 + i) * 4) % h;
      ctx.fillRect(sx, sy, 1.5, 1.5);
    }

    // blinking timer
    state.nextBlink -= dt;
    if (state.nextBlink <= 0) {
      state.blinkPhase = 1;
      state.nextBlink = 0.4 + Math.random() * 0.4;
    }
    state.blinkPhase = Math.max(0, state.blinkPhase - dt * 4);

    // occasional meow ripple
    if (now > state.meowAt) {
      drawMeow(ctx, state.catX, state.catY, now - state.meowAt);
      if (now - state.meowAt > 1200) state.meowAt = now + 2200 + Math.random() * 2500;
    }

    // tiny relocations
    if (now > state.moveAt && state.revealUntil < now) {
      placeCat();
    }

    // draw cat
    const s = scale();
    const reveal = state.revealUntil > now;
    const blink = !reveal && state.blinkPhase > 0.5;
    drawCat(ctx, CAT_SPRITE, state.catX, state.catY, s, "black", {
      blink: false,
      onlyEyes: !reveal,
    });
    if (!reveal && blink) {
      // blink hides eyes briefly — paint over eye area with bg
      ctx.fillStyle = "#08080c";
      ctx.fillRect(state.catX, state.catY + 14 * s, 16 * s, 4 * s);
    }

    state.raf = requestAnimationFrame(loop);
  }

  function drawMeow(ctx, cx, cy, t) {
    const r = (t / 8);
    ctx.strokeStyle = `rgba(255, 230, 120, ${Math.max(0, 0.5 - t / 2400)})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx + 8, cy + 16, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  function handleClick(e) {
    const rect = canvas.getBoundingClientRect();
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
    const y = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;
    const s = scale();
    const cx = state.catX + 16 * s;
    const cy = state.catY + 16 * s;
    const dist = Math.hypot(x - cx, y - cy);
    if (dist < 20 * s) {
      state.revealUntil = performance.now() + 900;
      state.found++;
      setScore("blackScore", (state.found / state.total) * 100);
      hint.textContent = state.found >= state.total
        ? "찾았다! 깜냥이를 모두 발견했어요 🐾"
        : `찾았다! ${state.found}/${state.total}`;
      setTimeout(placeCat, 950);
    } else {
      hint.textContent = "흠… 조금 더 자세히 살펴볼까요?";
    }
  }

  canvas.addEventListener("pointerdown", handleClick);
  state.raf = requestAnimationFrame(loop);

  return () => {
    cancelAnimationFrame(state.raf);
    canvas.removeEventListener("pointerdown", handleClick);
    window.removeEventListener("resize", onResize);
  };
}

// ============================================================
// 2. CHEESE CAT — stretchy cheese reflex game
// ============================================================
function startCheeseCatGame() {
  const canvas = document.getElementById("cheeseCanvas");
  const hint = document.getElementById("cheeseHint");
  let { ctx, w, h } = fitCanvas(canvas);
  const onResize = () => { const r = fitCanvas(canvas); ctx = r.ctx; w = r.w; h = r.h; reset(); };
  window.addEventListener("resize", onResize);

  const state = {
    home: { x: 0, y: 0 },
    pos: { x: 0, y: 0 },
    vel: { x: 0, y: 0 },
    drag: false,
    dragOffset: { x: 0, y: 0 },
    auto: { vx: 0, vy: 0, t: 0 },
    stability: 100,
    raf: 0,
    last: performance.now(),
  };
  const scale = () => Math.max(3, Math.min(w, h) / 70);

  function reset() {
    state.home.x = w / 2 - 16 * scale();
    state.home.y = h / 2 - 16 * scale();
    state.pos.x = state.home.x;
    state.pos.y = state.home.y;
    state.vel.x = 0; state.vel.y = 0;
    state.stability = 100;
  }
  reset();

  function loop(now) {
    const dt = Math.min(0.05, (now - state.last) / 1000);
    state.last = now;

    // backdrop — sun/cheese stripes
    ctx.fillStyle = "#fff8e7";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "rgba(244, 169, 59, 0.12)";
    for (let i = -h; i < w + h; i += 26) {
      ctx.fillRect(i, 0, 12, h);
    }
    // home circle
    ctx.strokeStyle = "rgba(244,169,59,0.6)";
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(state.home.x + 16 * scale(), state.home.y + 16 * scale(), 14 * scale(), 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    if (!state.drag) {
      // physics — spring back to home
      const k = 8;
      const damp = 2.6;
      const ax = (state.home.x - state.pos.x) * k - state.vel.x * damp;
      const ay = (state.home.y - state.pos.y) * k - state.vel.y * damp;
      state.vel.x += ax * dt;
      state.vel.y += ay * dt;
      state.pos.x += state.vel.x * dt;
      state.pos.y += state.vel.y * dt;

      // auto wander (cheese cat is hyperactive)
      state.auto.t -= dt;
      if (state.auto.t <= 0) {
        state.auto.vx = (Math.random() - 0.5) * 380;
        state.auto.vy = (Math.random() - 0.5) * 280;
        state.auto.t = 0.7 + Math.random() * 1.0;
        state.vel.x += state.auto.vx;
        state.vel.y += state.auto.vy;
      }
    }

    // stability ticks down with distance
    const dx = state.pos.x - state.home.x;
    const dy = state.pos.y - state.home.y;
    const dist = Math.hypot(dx, dy);
    const maxDist = Math.min(w, h) * 0.45;
    if (dist > maxDist * 0.6) state.stability -= dt * 25;
    else state.stability += dt * 12;
    state.stability = Math.max(0, Math.min(100, state.stability));
    setScore("cheeseScore", state.stability);

    // draw stretchy body (rubber band from home to current pos)
    const s = scale();
    const cxHome = state.home.x + 16 * s;
    const cyHome = state.home.y + 16 * s;
    const cxNow = state.pos.x + 16 * s;
    const cyNow = state.pos.y + 16 * s;
    const stretch = Math.min(2.5, 1 + dist / (16 * s) * 0.4);

    // back leg shadow at home
    ctx.fillStyle = "rgba(244,169,59,0.45)";
    ctx.beginPath();
    ctx.ellipse(cxHome, cyHome + 12 * s, 14 * s, 4 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    // body curve — series of small ellipses connecting home → now
    const segments = 14;
    for (let i = 1; i < segments; i++) {
      const t = i / segments;
      const x = cxHome + (cxNow - cxHome) * t;
      const y = cyHome + (cyNow - cyHome) * t;
      const r = (10 - Math.abs(t - 0.5) * 12) * s;
      if (r > 0) {
        ctx.fillStyle = "#f4a93b";
        ctx.beginPath();
        ctx.ellipse(x, y, r * 0.9, r * 0.7, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(255,225,168,0.5)";
        ctx.beginPath();
        ctx.ellipse(x, y - r * 0.2, r * 0.5, r * 0.2, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // head at moving pos
    drawCat(ctx, CAT_SPRITE, state.pos.x, state.pos.y, s, "cheese", {
      stretchX: 1, stretchY: 1,
      wobble: state.drag ? 0.5 : 0,
    });

    state.raf = requestAnimationFrame(loop);
  }

  function getXY(e) {
    const rect = canvas.getBoundingClientRect();
    if (e.touches && e.touches[0]) return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function onDown(e) {
    e.preventDefault();
    const p = getXY(e);
    const s = scale();
    const cx = state.pos.x + 16 * s, cy = state.pos.y + 16 * s;
    if (Math.hypot(p.x - cx, p.y - cy) < 22 * s) {
      state.drag = true;
      state.dragOffset.x = state.pos.x - p.x;
      state.dragOffset.y = state.pos.y - p.y;
      hint.textContent = "잡았어요! 끌어서 튕겨봐요";
    }
  }
  function onMove(e) {
    if (!state.drag) return;
    const p = getXY(e);
    const prevX = state.pos.x, prevY = state.pos.y;
    state.pos.x = p.x + state.dragOffset.x;
    state.pos.y = p.y + state.dragOffset.y;
    state.vel.x = (state.pos.x - prevX) / 0.016;
    state.vel.y = (state.pos.y - prevY) / 0.016;
  }
  function onUp() {
    if (!state.drag) return;
    state.drag = false;
    hint.textContent = "이번엔 어디로 튀어갈까요?";
  }
  canvas.addEventListener("pointerdown", onDown);
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);

  state.raf = requestAnimationFrame(loop);
  return () => {
    cancelAnimationFrame(state.raf);
    canvas.removeEventListener("pointerdown", onDown);
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("resize", onResize);
  };
}

// ============================================================
// 3. TUXEDO CAT — keep his outfit tidy
// ============================================================
function startTuxedoCatGame() {
  const canvas = document.getElementById("tuxedoCanvas");
  const hint = document.getElementById("tuxedoHint");
  let { ctx, w, h } = fitCanvas(canvas);
  const onResize = () => { const r = fitCanvas(canvas); ctx = r.ctx; w = r.w; h = r.h; };
  window.addEventListener("resize", onResize);

  const state = {
    udada: 0,           // 0 calm → 1 wild
    nextChaos: 0,
    tieAngle: 0,        // -1..1
    collarSplit: 0,     // 0..1
    furMess: 0,         // 0..1
    grace: 100,
    swipePoints: [],
    raf: 0,
    last: performance.now(),
  };
  const scale = () => Math.max(3, Math.min(w, h) / 70);

  function loop(now) {
    const dt = Math.min(0.05, (now - state.last) / 1000);
    state.last = now;

    // backdrop — formal grid
    ctx.fillStyle = "#fbf8ee";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "rgba(20,20,20,0.05)";
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 24) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
    for (let y = 0; y < h; y += 24) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }

    // chaos timer — random udada bursts
    state.nextChaos -= dt;
    if (state.nextChaos <= 0) {
      state.udada = Math.min(1, state.udada + 0.45);
      state.nextChaos = 1.6 + Math.random() * 1.4;
    }
    state.udada = Math.max(0, state.udada - dt * 0.05);

    if (state.udada > 0.05) {
      state.tieAngle += (Math.random() - 0.5) * dt * 6 * state.udada;
      state.tieAngle = Math.max(-1.2, Math.min(1.2, state.tieAngle));
      state.collarSplit = Math.min(1, state.collarSplit + dt * 0.7 * state.udada);
      state.furMess = Math.min(1, state.furMess + dt * 0.6 * state.udada);
    }

    // grace based on tidiness
    const messiness =
      Math.abs(state.tieAngle) * 0.55 +
      state.collarSplit * 0.25 +
      state.furMess * 0.20;
    state.grace -= messiness * dt * 22;
    state.grace += (1 - messiness) * dt * 12;
    state.grace = Math.max(0, Math.min(100, state.grace));
    setScore("tuxedoScore", state.grace);

    // draw cat
    const s = scale();
    const cx = w / 2 - 16 * s;
    const cy = h / 2 - 18 * s;

    // body shadow
    ctx.fillStyle = "rgba(20,20,20,0.12)";
    ctx.beginPath();
    ctx.ellipse(cx + 16 * s, cy + 30 * s, 18 * s, 4 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    // body (tuxedo style: black w/ white chest)
    drawCat(ctx, CAT_SPRITE, cx, cy, s, "tuxedo", { wobble: state.udada * 0.6 });

    // white chest patch
    ctx.fillStyle = "#fbf8ee";
    const chestX = cx + 11 * s + state.collarSplit * 2 * s;
    const chestY = cy + 16 * s;
    ctx.beginPath();
    ctx.moveTo(cx + 16 * s, chestY);
    ctx.lineTo(chestX, chestY + 8 * s);
    ctx.lineTo(cx + 16 * s, chestY + 12 * s);
    ctx.lineTo(cx + 21 * s - state.collarSplit * 2 * s, chestY + 8 * s);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#0a0a0a";
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // bow tie
    const tieX = cx + 16 * s;
    const tieY = cy + 14 * s;
    ctx.save();
    ctx.translate(tieX, tieY);
    ctx.rotate(state.tieAngle);
    ctx.fillStyle = "#c0392b";
    const tw = 6 * s, th = 3 * s;
    ctx.beginPath();
    ctx.moveTo(-tw, -th); ctx.lineTo(0, 0); ctx.lineTo(-tw, th); ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(tw, -th); ctx.lineTo(0, 0); ctx.lineTo(tw, th); ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#7e1f15";
    ctx.fillRect(-1.2 * s, -1.6 * s, 2.4 * s, 3.2 * s);
    ctx.restore();

    // fur mess — little tufts sticking out
    if (state.furMess > 0.05) {
      ctx.fillStyle = "#0a0a0a";
      const tufts = 5;
      for (let i = 0; i < tufts; i++) {
        const ang = (i / tufts) * Math.PI * 2 + now / 600;
        const r = (16 + Math.sin(now / 200 + i) * 2) * s + state.furMess * 6 * s;
        const tx = cx + 16 * s + Math.cos(ang) * r;
        const ty = cy + 12 * s + Math.sin(ang) * r * 0.7;
        ctx.fillRect(tx, ty, 2 * s, 2 * s);
      }
    }

    // swipe trail
    if (state.swipePoints.length > 1) {
      ctx.strokeStyle = "rgba(255, 216, 74, 0.85)";
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(state.swipePoints[0].x, state.swipePoints[0].y);
      for (let i = 1; i < state.swipePoints.length; i++) {
        ctx.lineTo(state.swipePoints[i].x, state.swipePoints[i].y);
      }
      ctx.stroke();
    }
    // fade swipe
    state.swipePoints = state.swipePoints.filter(p => now - p.t < 300);

    state.raf = requestAnimationFrame(loop);
  }

  function getXY(e) {
    const rect = canvas.getBoundingClientRect();
    if (e.touches && e.touches[0]) return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  let swiping = false;
  let lastP = null;
  let pathLen = 0;

  function onDown(e) {
    e.preventDefault();
    swiping = true;
    pathLen = 0;
    lastP = getXY(e);
    state.swipePoints.push({ x: lastP.x, y: lastP.y, t: performance.now() });
  }
  function onMove(e) {
    if (!swiping) return;
    const p = getXY(e);
    const dx = p.x - lastP.x, dy = p.y - lastP.y;
    pathLen += Math.hypot(dx, dy);
    state.swipePoints.push({ x: p.x, y: p.y, t: performance.now() });
    if (state.swipePoints.length > 30) state.swipePoints.shift();

    // hit-test on the cat region
    const s = scale();
    const cx = w / 2, cy = h / 2;
    if (Math.hypot(p.x - cx, p.y - cy) < 26 * s) {
      // horizontal swipe — fix tie
      if (Math.abs(dx) > Math.abs(dy)) {
        state.tieAngle *= 0.82;
      } else {
        // vertical — flatten fur and close collar
        state.furMess = Math.max(0, state.furMess - 0.04);
        state.collarSplit = Math.max(0, state.collarSplit - 0.04);
      }
    }
    lastP = p;
  }
  function onUp() {
    if (!swiping) return;
    swiping = false;
    if (pathLen > 80) hint.textContent = "오, 다시 신사답네요";
    else hint.textContent = "더 길게 쓸어내려 보세요";
  }

  canvas.addEventListener("pointerdown", onDown);
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);

  state.raf = requestAnimationFrame(loop);
  return () => {
    cancelAnimationFrame(state.raf);
    canvas.removeEventListener("pointerdown", onDown);
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("resize", onResize);
  };
}

window.CatGames = { startBlackCatGame, startCheeseCatGame, startTuxedoCatGame };
