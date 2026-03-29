const TOTAL_CASES = 10;
const players = {
  P1: "Player 1",
  P2: "Player 2"
};

const state = {
  phase: "home",
  round: 1,
  scores: { P1: 0, P2: 0 },
  roles: { hider: "P1", guesser: "P2" },
  hiddenCaseId: null,
  clue: "",
  hideSelection: null,
  guessSelection: null,
  cases: [],
  confettiFrame: null,
  confettiParticles: [],
  ambienceFrame: null,
  homeGlitchUntil: 0,
  lastHomeGlitch: 0
};

const elements = {
  pageGrainCanvas: document.getElementById("page-grain-canvas"),
  homeScreen: document.getElementById("home-screen"),
  homeNoiseCanvas: document.getElementById("home-noise-canvas"),
  homeTitle: document.getElementById("home-title"),
  startButton: document.getElementById("start-button"),
  gameShell: document.getElementById("game-shell"),
  gameNoiseCanvas: document.getElementById("game-noise-canvas"),
  briefcaseCircle: document.getElementById("circle-container"),
  scoreSlotP1: document.getElementById("score-slot-p1"),
  scoreSlotP2: document.getElementById("score-slot-p2"),
  scoreP1: document.getElementById("score-p1"),
  scoreP2: document.getElementById("score-p2"),
  roundNumber: document.getElementById("round-number"),
  resultScreen: document.getElementById("result-screen"),
  resultNoiseCanvas: document.getElementById("result-noise-canvas"),
  resultTitle: document.getElementById("result-title"),
  resultSubtitle: document.getElementById("result-subtitle"),
  resultEmoji: document.getElementById("result-emoji"),
  playAgainButton: document.getElementById("play-again-button"),
  flashOverlay: document.getElementById("flash-overlay"),
  confettiCanvas: document.getElementById("confetti-canvas"),
  panels: {
    P1: document.getElementById("panel-p1"),
    P2: document.getElementById("panel-p2")
  }
};

const panelRefs = {
  P1: getPanelRefs(elements.panels.P1),
  P2: getPanelRefs(elements.panels.P2)
};

function getPanelRefs(panel) {
  return {
    roleLabel: panel.querySelector("[data-role-label]"),
    clueCard: panel.querySelector("[data-clue-card]"),
    clueInput: panel.querySelector("[data-clue-input]"),
    actionButton: panel.querySelector("[data-action-button]")
  };
}

function buildHomeTitle() {
  const letters = "XATU".split("");
  elements.homeTitle.innerHTML = "";
  letters.forEach((letter, index) => {
    const span = document.createElement("span");
    span.textContent = letter;
    elements.homeTitle.appendChild(span);
    setTimeout(() => span.classList.add("visible"), 180 * index + 120);
  });
}

function initializeCases() {
  state.cases = Array.from({ length: TOTAL_CASES }, (_, index) => ({
    id: index + 1,
    eliminated: false,
    animating: false
  }));

  console.log("Briefcases array length:", state.cases.length);

  elements.briefcaseCircle.innerHTML = "";
  state.cases.forEach((briefcase) => {
    const button = document.createElement("div");
    button.className = "briefcase";
    button.dataset.id = String(briefcase.id);
    button.textContent = String(briefcase.id);
    elements.briefcaseCircle.appendChild(button);
  });

  document.querySelectorAll(".briefcase").forEach(function(el) {
    el.addEventListener("click", function() {
      if (state.phase !== "hide") {
        handleBriefcaseClick(parseInt(this.getAttribute("data-id"), 10));
        return;
      }
      const id = parseInt(this.getAttribute("data-id"), 10);
      const briefcase = state.cases.find((b) => b.id === id);
      if (!briefcase || briefcase.eliminated) return;
      state.hideSelection = id;
      document.querySelectorAll(".briefcase").forEach(function(b) {
        b.classList.remove("selected");
      });
      this.classList.add("selected");
      updateBriefcases();
      render();
    });
  });

  positionBriefcases();
}

function resetState() {
  state.phase = "hide";
  state.round = 1;
  state.scores = { P1: 0, P2: 0 };
  state.roles = { hider: "P1", guesser: "P2" };
  state.hiddenCaseId = null;
  state.clue = "";
  state.hideSelection = null;
  state.guessSelection = null;
  cancelConfetti();
  initializeCases();
  animateBriefcasesIn();
  clearPanelInputs();
  hideResultScreen();
  triggerPhaseFlicker();
}

function clearPanelInputs() {
  Object.values(panelRefs).forEach((refs) => {
    refs.clueInput.value = "";
  });
}

function activeCaseIds() {
  return state.cases.filter((item) => !item.eliminated).map((item) => item.id);
}

function handleBriefcaseClick(caseId) {
  const target = state.cases.find((item) => item.id === caseId);
  if (!target || target.eliminated || target.animating) {
    return;
  }

  if (state.phase === "hide") {
    state.hideSelection = caseId;
    document.querySelectorAll(".briefcase").forEach((briefcase) => {
      briefcase.classList.remove("selected");
    });
    document.querySelector(`[data-id="${caseId}"]`)?.classList.add("selected");
    updateBriefcases();
  } else if (state.phase === "guess") {
    state.guessSelection = caseId;
  } else {
    return;
  }

  render();
}

function handlePanelAction(playerId) {
  const isHiderTurn = state.phase === "hide" && state.roles.hider === playerId;
  const isGuesserTurn = state.phase === "guess" && state.roles.guesser === playerId;

  if (isHiderTurn) {
    submitHide(playerId);
    return;
  }

  if (isGuesserTurn) {
    confirmGuess(playerId);
  }
}

function submitHide(playerId) {
  if (!state.hideSelection) {
    return;
  }

  state.hiddenCaseId = state.hideSelection;
  state.clue = panelRefs[playerId].clueInput.value.trim();
  state.guessSelection = null;
  state.hideSelection = null;
  state.phase = "guess";
  clearPanelInputs();
  triggerPhaseFlicker();
  render();
}

function confirmGuess(playerId) {
  if (!state.guessSelection) {
    return;
  }

  const guesser = state.roles.guesser;
  if (state.guessSelection === state.hiddenCaseId) {
    state.scores[guesser] += 1;
    render();
    showVictory(guesser);
    return;
  }

  const eliminatedCase = state.cases.find((item) => item.id === state.hiddenCaseId);
  if (!eliminatedCase) {
    return;
  }

  state.phase = "resolving";
  triggerPhaseFlicker();
  render();
  flashWrongGuess();
  animateElimination(eliminatedCase.id, () => {
    eliminatedCase.eliminated = true;
    eliminatedCase.animating = false;
    state.hiddenCaseId = null;
    state.clue = "";
    state.hideSelection = null;
    state.guessSelection = null;

    if (activeCaseIds().length === 0) {
      render();
      showDraw();
      return;
    }

    state.roles = {
      hider: state.roles.guesser,
      guesser: state.roles.hider
    };
    state.round += 1;
    state.phase = "hide";
    clearPanelInputs();
    triggerPhaseFlicker();
    render();
  });
}

function animateElimination(caseId, onComplete) {
  const button = getBriefcaseButton(caseId);
  const caseState = state.cases.find((item) => item.id === caseId);
  if (!button || !caseState) {
    onComplete();
    return;
  }

  caseState.animating = true;
  button.classList.add("eliminating");
  setTimeout(onComplete, 950);
}

function flashWrongGuess() {
  elements.flashOverlay.classList.remove("wrong-flash");
  void elements.flashOverlay.offsetWidth;
  elements.flashOverlay.classList.add("wrong-flash");
  setTimeout(() => elements.flashOverlay.classList.remove("wrong-flash"), 480);
}

function showVictory(winnerId) {
  state.phase = "ended";
  triggerPhaseFlicker();
  render();
  elements.resultScreen.className = "screen-overlay result-screen active victory";
  elements.resultTitle.textContent = players[winnerId].toUpperCase();
  elements.resultSubtitle.textContent = "CASE CLOSED";
  elements.resultEmoji.textContent = "";
  runConfetti();
}

function showDraw() {
  state.phase = "ended";
  triggerPhaseFlicker();
  render();
  elements.resultScreen.className = "screen-overlay result-screen active draw";
  elements.resultTitle.textContent = "NO WINNER";
  elements.resultSubtitle.textContent = "The trail goes cold.";
  elements.resultEmoji.textContent = "";
}

function hideResultScreen() {
  elements.resultScreen.className = "screen-overlay result-screen";
}

function startGame() {
  resetState();
  elements.homeScreen.classList.remove("active");
  elements.gameShell.setAttribute("aria-hidden", "false");
  render();
}

function resetGame() {
  elements.homeScreen.classList.remove("active");
  elements.gameShell.setAttribute("aria-hidden", "false");
  resetState();
  render();
}

function playAgain() {
  resetGame();
}

function getBriefcaseButton(caseId) {
  return elements.briefcaseCircle.querySelector(`[data-id="${caseId}"]`);
}

function positionBriefcases() {
  const container = document.getElementById('circle-container');
  const size = 500;
  const centerX = size / 2;
  const centerY = size / 2;
  const radius = 180;
  const cases = document.querySelectorAll('.briefcase');
  cases.forEach((el, i) => {
    const angle = (i * 2 * Math.PI / 10) - Math.PI / 2;
    const x = centerX + radius * Math.cos(angle);
    const y = centerY + radius * Math.sin(angle);
    el.style.position = 'absolute';
    el.style.left = (x - 40) + 'px';
    el.style.top = (y - 40) + 'px';
    el.style.width = '80px';
    el.style.height = '80px';
  });
}

function animateBriefcasesIn() {
  Array.from(elements.briefcaseCircle.children).forEach((button, index) => {
    button.classList.remove("visible");
    button.style.animationDelay = `${index * 90}ms`;
    requestAnimationFrame(() => button.classList.add("visible"));
  });
}

function panelMode(playerId) {
  if (state.roles.hider === playerId) {
    return "hider";
  }
  return "guesser";
}

function activePlayerId() {
  if (state.phase === "hide") {
    return state.roles.hider;
  }
  if (state.phase === "guess") {
    return state.roles.guesser;
  }
  return null;
}

function updatePanel(playerId) {
  const refs = panelRefs[playerId];
  const mode = panelMode(playerId);
  const isActive = activePlayerId() === playerId;

  elements.panels[playerId].classList.toggle("active", isActive);
  elements.panels[playerId].classList.toggle("inactive", !isActive);

  if (mode === "hider") {
    refs.roleLabel.textContent = "HIDE OBJECT";
    refs.clueInput.disabled = !isActive || state.phase !== "hide";
    refs.clueInput.placeholder = "Enter a clue (optional)";
    refs.clueInput.classList.remove("hidden");
    refs.clueCard.classList.add("hidden");
    refs.clueCard.textContent = "";
    refs.actionButton.textContent = "Submit";
    refs.actionButton.disabled = !isActive || state.phase !== "hide";
    return;
  }

  refs.roleLabel.textContent = "MAKE YOUR GUESS";
  refs.clueInput.disabled = true;
  refs.clueInput.value = "";
  refs.clueInput.classList.add("hidden");
  refs.actionButton.textContent = "Confirm";
  refs.actionButton.disabled = !isActive || state.phase !== "guess";

  if (state.clue) {
    refs.clueCard.classList.remove("hidden");
    refs.clueCard.textContent = `Clue: ${state.clue}`;
  } else {
    refs.clueCard.classList.add("hidden");
    refs.clueCard.textContent = "";
  }
}

function updateBriefcases() {
  state.cases.forEach((briefcase) => {
    const button = getBriefcaseButton(briefcase.id);
    if (!button) {
      return;
    }

    button.classList.toggle(
      "hider-selected",
      state.phase === "hide" && state.hideSelection === briefcase.id
    );
    button.classList.toggle(
      "selected",
      state.phase === "hide" && state.hideSelection === briefcase.id
    );
    button.classList.toggle(
      "guesser-selected",
      state.phase === "guess" && state.guessSelection === briefcase.id
    );
    button.classList.toggle("eliminated", briefcase.eliminated);

    if (!briefcase.animating) {
      button.classList.remove("eliminating");
    }

    button.disabled = briefcase.eliminated || state.phase === "ended" || state.phase === "resolving";
  });
}

function updateScoreboard() {
  elements.scoreP1.textContent = String(state.scores.P1);
  elements.scoreP2.textContent = String(state.scores.P2);
  elements.roundNumber.textContent = String(state.round);
  elements.scoreSlotP1.classList.toggle("active", activePlayerId() === "P1");
  elements.scoreSlotP2.classList.toggle("active", activePlayerId() === "P2");
}

function render() {
  updateScoreboard();
  updatePanel("P1");
  updatePanel("P2");
  updateBriefcases();
}

function setupPanelActions() {
  Object.entries(panelRefs).forEach(([playerId, refs]) => {
    refs.actionButton.addEventListener("click", () => handlePanelAction(playerId));
    refs.clueInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !refs.clueInput.disabled) {
        handlePanelAction(playerId);
      }
    });
  });
}

function sizeConfettiCanvas() {
  elements.confettiCanvas.width = window.innerWidth;
  elements.confettiCanvas.height = window.innerHeight;
}

function sizeCanvas(canvas) {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

function sizeAmbienceCanvases() {
  sizeCanvas(elements.pageGrainCanvas);
  sizeCanvas(elements.homeNoiseCanvas);
  sizeCanvas(elements.gameNoiseCanvas);
  sizeCanvas(elements.resultNoiseCanvas);
}

function cancelConfetti() {
  if (state.confettiFrame) {
    cancelAnimationFrame(state.confettiFrame);
    state.confettiFrame = null;
  }
  state.confettiParticles = [];
  const ctx = elements.confettiCanvas.getContext("2d");
  ctx.clearRect(0, 0, elements.confettiCanvas.width, elements.confettiCanvas.height);
}

function runConfetti() {
  cancelConfetti();
  sizeConfettiCanvas();
  const ctx = elements.confettiCanvas.getContext("2d");
  const colors = ["#D4860B", "#E8E8E8", "#8B7355"];
  const start = performance.now();

  state.confettiParticles = Array.from({ length: 90 }, () => ({
    x: Math.random() * elements.confettiCanvas.width,
    y: -Math.random() * elements.confettiCanvas.height * 0.6,
    width: 5 + Math.random() * 7,
    height: 8 + Math.random() * 12,
    speedY: 0.7 + Math.random() * 1.4,
    speedX: -0.6 + Math.random() * 1.2,
    rotation: Math.random() * Math.PI,
    rotationSpeed: -0.03 + Math.random() * 0.06,
    color: colors[Math.floor(Math.random() * colors.length)]
  }));

  function frame(now) {
    ctx.clearRect(0, 0, elements.confettiCanvas.width, elements.confettiCanvas.height);
    state.confettiParticles.forEach((particle) => {
      particle.x += particle.speedX;
      particle.y += particle.speedY;
      particle.rotation += particle.rotationSpeed;

      ctx.save();
      ctx.translate(particle.x, particle.y);
      ctx.rotate(particle.rotation);
      ctx.fillStyle = particle.color;
      ctx.fillRect(-particle.width / 2, -particle.height / 2, particle.width, particle.height);
      ctx.restore();
    });

    if (now - start < 5000) {
      state.confettiFrame = requestAnimationFrame(frame);
      return;
    }

    cancelConfetti();
  }

  state.confettiFrame = requestAnimationFrame(frame);
}

function drawNoiseLayer(canvas, options) {
  const ctx = canvas.getContext("2d");
  const { width, height } = canvas;
  const {
    density,
    alpha,
    palette,
    background,
    flicker
  } = options;

  ctx.clearRect(0, 0, width, height);
  if (background) {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height);
  }

  for (let i = 0; i < density; i += 1) {
    const x = Math.random() * width;
    const y = Math.random() * height;
    const size = 1 + Math.random() * 2;
    const color = palette[Math.floor(Math.random() * palette.length)];
    ctx.fillStyle = `${color}${alpha}`;
    ctx.fillRect(x, y, size, size);
  }

  if (flicker) {
    ctx.fillStyle = `rgba(255, 255, 255, ${Math.random() * flicker})`;
    ctx.fillRect(0, 0, width, height);
  }
}

function renderHomeNoise(now) {
  drawNoiseLayer(elements.homeNoiseCanvas, {
    density: 2200,
    alpha: "0.11)",
    palette: ["rgba(255,255,255,", "rgba(190,190,190,", "rgba(95,95,95,"],
    background: "rgba(13, 13, 13, 0.25)",
    flicker: 0.03
  });

  if (now - state.lastHomeGlitch > 3000) {
    state.lastHomeGlitch = now;
    state.homeGlitchUntil = now + 200;
  }

  if (now < state.homeGlitchUntil) {
    const ctx = elements.homeNoiseCanvas.getContext("2d");
    const { width, height } = elements.homeNoiseCanvas;

    for (let i = 0; i < 9; i += 1) {
      const sliceY = Math.random() * height;
      const sliceH = 8 + Math.random() * 30;
      const offset = -28 + Math.random() * 56;
      ctx.drawImage(elements.homeNoiseCanvas, 0, sliceY, width, sliceH, offset, sliceY, width, sliceH);
    }
  }
}

function renderAmbientNoise() {
  drawNoiseLayer(elements.pageGrainCanvas, {
    density: 3200,
    alpha: "0.09)",
    palette: ["rgba(255,255,255,", "rgba(120,120,120,", "rgba(40,40,40,"]
  });

  if (elements.homeScreen.classList.contains("active")) {
    renderHomeNoise(performance.now());
  } else {
    elements.homeNoiseCanvas.getContext("2d").clearRect(0, 0, elements.homeNoiseCanvas.width, elements.homeNoiseCanvas.height);
  }

  if (elements.gameShell.getAttribute("aria-hidden") === "false") {
    drawNoiseLayer(elements.gameNoiseCanvas, {
      density: 1400,
      alpha: "0.06)",
      palette: ["rgba(255,255,255,", "rgba(150,150,150,", "rgba(60,60,60,"]
    });
  } else {
    elements.gameNoiseCanvas.getContext("2d").clearRect(0, 0, elements.gameNoiseCanvas.width, elements.gameNoiseCanvas.height);
  }

  if (elements.resultScreen.classList.contains("active")) {
    drawNoiseLayer(elements.resultNoiseCanvas, {
      density: 1800,
      alpha: "0.08)",
      palette: ["rgba(255,255,255,", "rgba(180,180,180,", "rgba(70,70,70,"],
      background: "rgba(0, 0, 0, 0.4)"
    });
  } else {
    elements.resultNoiseCanvas.getContext("2d").clearRect(0, 0, elements.resultNoiseCanvas.width, elements.resultNoiseCanvas.height);
  }
}

function runAmbience() {
  renderAmbientNoise();
  state.ambienceFrame = requestAnimationFrame(runAmbience);
}

function triggerPhaseFlicker() {
  elements.flashOverlay.classList.remove("phase-flicker");
  void elements.flashOverlay.offsetWidth;
  elements.flashOverlay.classList.add("phase-flicker");
  setTimeout(() => elements.flashOverlay.classList.remove("phase-flicker"), 180);
}

function registerEvents() {
  elements.startButton.addEventListener("click", startGame);
  elements.playAgainButton.addEventListener("click", playAgain);

  window.addEventListener("resize", () => {
    sizeConfettiCanvas();
    sizeAmbienceCanvases();
  });
}

document.addEventListener('DOMContentLoaded', positionBriefcases);

buildHomeTitle();
setupPanelActions();
registerEvents();
sizeConfettiCanvas();
sizeAmbienceCanvases();
runAmbience();
