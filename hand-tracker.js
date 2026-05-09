// MediaPipe Hands wrapper. Exposes mirrored hand landmarks + gesture flags.
// Coordinates are in normalized 0..1 space (x is mirrored to feel like a mirror).
window.HandTracker = (function () {
  let video = null;
  let hands = null;
  let stream = null;
  let initialized = false;
  let starting = null;
  let lastResults = { hands: [], at: 0 };
  const listeners = new Set();
  let raf = 0;

  function ensureStarted() {
    if (initialized) return Promise.resolve(true);
    if (starting) return starting;

    starting = (async () => {
      // 1. ask for camera
      stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: "user" },
        audio: false,
      });
      video = document.getElementById("camPreview");
      if (!video) {
        video = document.createElement("video");
        video.autoplay = true; video.muted = true; video.playsInline = true;
        video.style.display = "none";
        document.body.appendChild(video);
      }
      video.srcObject = stream;
      await video.play();

      // 2. wait for global Hands constructor
      await waitFor(() => typeof window.Hands !== "undefined", 8000, "MediaPipe Hands script not loaded");

      hands = new window.Hands({
        locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4/${f}`,
      });
      hands.setOptions({
        maxNumHands: 2,
        modelComplexity: 0,
        minDetectionConfidence: 0.55,
        minTrackingConfidence: 0.45,
      });
      hands.onResults(onResults);

      initialized = true;
      pump();
      return true;
    })();

    starting.catch(() => { starting = null; });
    return starting;
  }

  async function pump() {
    if (!initialized || !video) return;
    try {
      if (video.readyState >= 2) await hands.send({ image: video });
    } catch (e) { /* swallow per-frame errors */ }
    raf = requestAnimationFrame(pump);
  }

  function onResults(results) {
    const out = { hands: [], at: performance.now() };
    const list = results.multiHandLandmarks || [];
    const handed = results.multiHandedness || [];
    for (let i = 0; i < list.length; i++) {
      const lm = list[i].map(p => ({ x: 1 - p.x, y: p.y, z: p.z })); // mirror x
      const label = handed[i]?.label === "Right" ? "Left" : "Right"; // also flip handedness
      out.hands.push({
        landmarks: lm,
        handedness: label,
        isFist: isFist(lm),
        isPinch: isPinch(lm),
        pinchDist: pinchDistance(lm),
        palm: palmCenter(lm),
        indexTip: lm[8],
        thumbTip: lm[4],
      });
    }
    // sort left → right by hand x so consumers can index reliably
    out.hands.sort((a, b) => a.palm.x - b.palm.x);
    lastResults = out;
    listeners.forEach(fn => { try { fn(out); } catch (e) { console.warn(e); } });
  }

  function subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  // --- gesture helpers (operate on mirrored landmarks) ---
  function isFist(lm) {
    const tips = [8, 12, 16, 20];
    const pips = [6, 10, 14, 18];
    let folded = 0;
    for (let i = 0; i < tips.length; i++) {
      // a finger is "folded" when its tip is BELOW (larger y) its PIP joint
      if (lm[tips[i]].y > lm[pips[i]].y - 0.005) folded++;
    }
    // also thumb tucked: thumb tip near index MCP
    return folded >= 3;
  }

  function pinchDistance(lm) {
    const t = lm[4], i = lm[8];
    return Math.hypot(t.x - i.x, t.y - i.y);
  }
  function isPinch(lm) {
    return pinchDistance(lm) < 0.055;
  }

  function palmCenter(lm) {
    // average wrist (0), index MCP (5), middle MCP (9), pinky MCP (17)
    const pts = [lm[0], lm[5], lm[9], lm[17]];
    let x = 0, y = 0;
    pts.forEach(p => { x += p.x; y += p.y; });
    return { x: x / pts.length, y: y / pts.length };
  }

  function waitFor(check, timeoutMs, errMsg) {
    return new Promise((res, rej) => {
      const t0 = performance.now();
      (function spin() {
        if (check()) return res();
        if (performance.now() - t0 > timeoutMs) return rej(new Error(errMsg || "timeout"));
        setTimeout(spin, 80);
      })();
    });
  }

  return {
    ensureStarted,
    isReady: () => initialized,
    subscribe,
    getLast: () => lastResults,
    getVideo: () => video,
    isFist, isPinch, pinchDistance, palmCenter,
  };
})();
