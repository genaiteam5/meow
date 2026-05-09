(function () {
  const cards = document.querySelectorAll(".card");
  const buttons = document.querySelectorAll(".nav-btn");

  const starters = {
    black:  () => window.CatGames.startBlackCatGame(),
    cheese: () => window.CatGames.startCheeseCatGame(),
    tuxedo: () => window.CatGames.startTuxedoCatGame(),
  };
  const stoppers = { black: null, cheese: null, tuxedo: null };

  function show(name) {
    cards.forEach(c => c.classList.toggle("hidden", c.dataset.card !== name));
    buttons.forEach(b => b.classList.toggle("active", b.dataset.cat === name));

    // stop all running games
    Object.keys(stoppers).forEach(k => {
      if (stoppers[k]) { stoppers[k](); stoppers[k] = null; }
    });
    // start the visible one
    requestAnimationFrame(() => { stoppers[name] = starters[name](); });
  }

  buttons.forEach(b => b.addEventListener("click", () => show(b.dataset.cat)));

  // start with black cat
  show("black");
})();
