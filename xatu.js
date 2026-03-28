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
  confettiParticles: []
};

const elements = {
  homeScreen: document.getElementById("home-screen"),
  homeTitle: document.getElementById("home-title"),
  startButton: document.getElementById("start-button"),
  gameShell: document.getElementById("game-shell"),
  briefcaseCircle: document.getElementById("circle-container"),
  scoreSlotP1: document.getElementById("score-slot-p1"),
  scoreSlotP2: document.getElementById("score-slot-p2"),
  scoreP1: document.getElementById("score-p1"),
  scoreP2: document.getElementById("score-p2"),
  roundNumber: document.getElementById("round-number"),
  resultScreen: document.getElementById("result-screen"),
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

  elements.briefcaseCircle.innerHTML = "";
  state.cases.forEach((briefcase, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "briefcase";
    button.dataset.caseId = String(briefcase.id);
    button.dataset.index = String(index);
    button.textContent = String(briefcase.id);
    button.setAttribute("aria-label", `Briefcase ${briefcase.id}`);
    button.addEventListener("click", () => handleBriefcaseClick(briefcase.id));
    elements.briefcaseCircle.appendChild(button);
  });
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
  positionBriefcases();
  animateBriefcasesIn();
  clearPanelInputs();
  hideResultScreen();
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
  elements.flashOverlay.classList.remove("flash");
  void elements.flashOverlay.offsetWidth;
  elements.flashOverlay.classList.add("flash");
  setTimeout(() => elements.flashOverlay.classList.remove("flash"), 480);
}

function showVictory(winnerId) {
  state.phase = "ended";
  render();
  elements.resultScreen.className = "screen-overlay result-screen active victory";
  elements.resultTitle.textContent = "VICTORY";
  elements.resultSubtitle.textContent = "";
  elements.resultEmoji.textContent = "🏆";
  runConfetti();
}

function showDraw() {
  state.phase = "ended";
  render();
  elements.resultScreen.className = "screen-overlay result-screen active draw";
  elements.resultTitle.textContent = "DRAW";
  elements.resultSubtitle.textContent = "";
  elements.resultEmoji.textContent = "🏆";
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
  return elements.briefcaseCircle.querySelector(`[data-case-id="${caseId}"]`);
}

function positionBriefcases() {
  const container = document.getElementById('circle-container');
  const rect = container.getBoundingClientRect();
  const centerX = rect.width / 2;
  const centerY = rect.height / 2;
  const radius = Math.min(rect.width, rect.height) * 0.30;
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
  const colors = ["#FFD700", "#6B00FF", "#f5d76e", "#c18bff"];
  const start = performance.now();

  state.confettiParticles = Array.from({ length: 200 }, () => ({
    x: Math.random() * elements.confettiCanvas.width,
    y: -Math.random() * elements.confettiCanvas.height * 0.4,
    size: 4 + Math.random() * 6,
    speedY: 2 + Math.random() * 4,
    speedX: -2 + Math.random() * 4,
    rotation: Math.random() * Math.PI,
    rotationSpeed: -0.2 + Math.random() * 0.4,
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
      ctx.fillRect(-particle.size / 2, -particle.size / 2, particle.size, particle.size * 0.6);
      ctx.restore();
    });

    if (now - start < 4000) {
      state.confettiFrame = requestAnimationFrame(frame);
      return;
    }

    cancelConfetti();
  }

  state.confettiFrame = requestAnimationFrame(frame);
}

function registerEvents() {
  elements.startButton.addEventListener("click", startGame);
  elements.playAgainButton.addEventListener("click", playAgain);

  setTimeout(positionBriefcases, 200);
  window.addEventListener('resize', positionBriefcases);
  window.addEventListener('resize', sizeConfettiCanvas);
}

buildHomeTitle();
setupPanelActions();
registerEvents();
sizeConfettiCanvas();
