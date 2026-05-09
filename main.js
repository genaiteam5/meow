(function () {
  const body = document.body;
  const homeBtn = document.getElementById("homeBtn");
  const cards = document.querySelectorAll(".card");
  const buttons = document.querySelectorAll(".nav-btn");
  const fileBtns = document.querySelectorAll(".file-btn");
  const fileCats = document.querySelectorAll(".file-cat");
  const logoCat = document.getElementById("logoCat");
  const bgm = document.getElementById("bgm");
  if (bgm) bgm.volume = 0.45;

  function playBgm() {
    if (!bgm) return;
    const p = bgm.play();
    if (p && typeof p.catch === "function") p.catch(() => {});
  }
  function pauseBgm() { if (bgm) bgm.pause(); }

  // Browsers block autoplay until first user gesture — start bgm on first interaction
  // if we're still on the home screen at that point.
  const onFirstGesture = () => {
    if (body.classList.contains("home-mode")) playBgm();
  };
  ["pointerdown", "keydown", "touchstart"].forEach(ev =>
    document.addEventListener(ev, onFirstGesture, { once: true, passive: true, capture: true })
  );

  const camOverlay = document.getElementById("camOverlay");
  const camStartBtn = document.getElementById("camStartBtn");
  const camCancelBtn = document.getElementById("camCancelBtn");
  const camError = document.getElementById("camError");
  const fsBack = document.getElementById("fsBack");

  const FULLSCREEN_GAMES = new Set(["black"]);

  const starters = {
    black:  () => window.CatGames.startBlackCatGame(),
    cheese: () => window.CatGames.startCheeseCatGame(),
    tuxedo: () => window.CatGames.startTuxedoCatGame(),
    calico: () => window.CatGames.startCalicoCatGame(),
  };
  const stoppers = { black: null, cheese: null, tuxedo: null, calico: null };

  let pendingGame = null;

  function stopAll() {
    Object.keys(stoppers).forEach(k => {
      if (stoppers[k]) { stoppers[k](); stoppers[k] = null; }
    });
  }

  function showCard(name) {
    body.classList.remove("home-mode");
    body.classList.toggle("fullscreen-game", FULLSCREEN_GAMES.has(name));
    cards.forEach(c => c.classList.toggle("hidden", c.dataset.card !== name));
    buttons.forEach(b => b.classList.toggle("active", b.dataset.cat === name));
    pauseBgm();
    stopAll();
    requestAnimationFrame(() => { stoppers[name] = starters[name](); });
  }

  async function enterGame(name) {
    if (window.HandTracker && window.HandTracker.isReady()) {
      body.classList.add("cam-active");
      showCard(name);
      return;
    }
    pendingGame = name;
    showCamPrompt();
  }

  function showCamPrompt(errorMsg) {
    camError.hidden = !errorMsg;
    if (errorMsg) camError.textContent = errorMsg;
    camOverlay.hidden = false;
  }
  function hideCamPrompt() { camOverlay.hidden = true; }

  async function onCamStart() {
    camStartBtn.disabled = true;
    camStartBtn.textContent = "준비 중…";
    camError.hidden = true;
    try {
      await window.HandTracker.ensureStarted();
      body.classList.add("cam-active");
      hideCamPrompt();
      camStartBtn.disabled = false;
      camStartBtn.textContent = "카메라 켜기";
      if (pendingGame) {
        const g = pendingGame; pendingGame = null;
        showCard(g);
      }
    } catch (e) {
      camStartBtn.disabled = false;
      camStartBtn.textContent = "다시 시도";
      const msg = e && e.name === "NotAllowedError"
        ? "브라우저에서 카메라 권한이 거부됐어요. 주소창 옆 카메라 아이콘에서 허용해주세요."
        : (e && e.message) || "카메라를 시작할 수 없어요.";
      showCamPrompt(msg);
    }
  }

  function onCamCancel() {
    pendingGame = null;
    hideCamPrompt();
  }

  function goHome() {
    stopAll();
    body.classList.add("home-mode");
    body.classList.remove("fullscreen-game");
    paintHomeCats();
    playBgm();
  }

  function paintHomeCats() {
    fileCats.forEach(c => window.CatGames.drawHomeCat(c, c.dataset.palette));
    if (logoCat) window.CatGames.drawLogoCat(logoCat);
  }

  buttons.forEach(b => b.addEventListener("click", () => enterGame(b.dataset.cat)));
  fileBtns.forEach(b => b.addEventListener("click", () => enterGame(b.dataset.cat)));
  if (homeBtn) homeBtn.addEventListener("click", goHome);
  if (fsBack)  fsBack.addEventListener("click", goHome);
  if (camStartBtn) camStartBtn.addEventListener("click", onCamStart);
  if (camCancelBtn) camCancelBtn.addEventListener("click", onCamCancel);

  // ESC also returns home from fullscreen games
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && body.classList.contains("fullscreen-game")) goHome();
  });

  // If cat1.png exists in /public, mark the home tile so the photo replaces the canvas
  fileBtns.forEach(b => {
    const photo = b.querySelector(".file-photo");
    if (!photo) return;
    photo.addEventListener("load",  () => b.classList.add("has-photo"));
    photo.addEventListener("error", () => photo.remove());
  });

  window.addEventListener("resize", () => {
    if (body.classList.contains("home-mode")) paintHomeCats();
  });

  paintHomeCats();
  playBgm();
})();
