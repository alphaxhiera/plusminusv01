/* ============================================================
 * Math Plus Minus — app logic & game loop
 * Ties the UI to MathEngine, handles screens, streaks, FX,
 * and saves progress in localStorage.
 * ============================================================ */
(function () {
  "use strict";

  var engine = new MathEngine();
  var QUESTIONS_PER_SESSION = 20;

  // ---- Game state ----
  var state = {
    game: null,        // "add" | "sub"
    level: null,       // 1 | 2 | 3
    input: "",         // current keypad input
    current: null,     // current question object
    answered: 0,
    correct: 0,
    streak: 0,
    bestStreak: 0,
  };

  // ---- localStorage helpers ----
  var STORE_KEY = "mathPlusMinus";

  function loadProgress() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; }
    catch (e) { return {}; }
  }
  function saveProgress(data) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(data)); } catch (e) {}
  }
  function remember(key, value) {
    var d = loadProgress();
    d[key] = value;
    saveProgress(d);
  }
  function highScoreKey() { return "best_" + state.game + "_" + state.level; }

  // ---- Screen switching ----
  var screens = ["game", "level", "question", "result", "end"].reduce(function (map, name) {
    map[name] = document.getElementById("screen-" + name);
    return map;
  }, {});

  function show(name) {
    Object.keys(screens).forEach(function (k) {
      screens[k].classList.toggle("active", k === name);
    });
  }

  // ---- DOM refs ----
  var $ = function (id) { return document.getElementById(id); };

  /* ================= GAME SELECT ================= */

  var GAME_LABEL = { add: "Addition", sub: "Subtraction" };

  function renderBestStats() {
    var d = loadProgress();
    var parts = [];
    if (d.bestStreak) parts.push("Best streak: 🔥 " + d.bestStreak);
    ["add", "sub"].forEach(function (g) {
      for (var l = 1; l <= 3; l++) {
        var s = d["best_" + g + "_" + l];
        if (s) parts.push(GAME_LABEL[g] + " " + l + "-digit: " + s + "/20");
      }
    });
    $("best-stats").textContent = parts.length ? "⭐ " + parts.join("  •  ") : "Let's play your first game!";
  }

  document.querySelectorAll(".game-card").forEach(function (card) {
    card.addEventListener("click", function () {
      state.game = card.dataset.game;
      remember("lastGame", state.game);
      $("level-title").textContent = GAME_LABEL[state.game];
      // pre-select the last used level for this game
      var lastLevel = loadProgress()["lastLevel_" + state.game];
      selectLevel(lastLevel || 1);
      show("level");
    });
  });

  /* ================= LEVEL SELECT ================= */

  function selectLevel(level) {
    state.level = Number(level);
    document.querySelectorAll(".level-btn").forEach(function (b) {
      b.classList.toggle("selected", Number(b.dataset.level) === state.level);
    });
    $("btn-start").disabled = false;
  }

  document.querySelectorAll(".level-btn").forEach(function (btn) {
    btn.addEventListener("click", function () { selectLevel(btn.dataset.level); });
  });

  $("btn-back-game").addEventListener("click", function () { renderBestStats(); show("game"); });

  $("btn-start").addEventListener("click", startSession);

  /* ================= QUESTION FLOW ================= */

  function startSession() {
    remember("lastLevel_" + state.game, state.level);
    engine.startSession(state.game, state.level, QUESTIONS_PER_SESSION);
    state.input = "";
    state.answered = 0;
    state.correct = 0;
    state.streak = 0;
    state.bestStreak = 0;
    updateHUD();
    nextQuestion();
    show("question");
  }

  function nextQuestion() {
    state.current = engine.generateQuestion();
    if (!state.current) return endSession();

    state.input = "";
    $("q-num1").textContent = state.current.num1;
    $("q-num2").textContent = state.current.num2;
    $("q-operator").textContent = state.current.operator === "+" ? "+" : "−";
    renderAnswerBox();
    show("question");
  }

  function renderAnswerBox() {
    $("q-answer-box").textContent = state.input || "?";
  }

  /* ---- Keypad ---- */

  function pressKey(key) {
    if (key === "clear") state.input = "";
    else if (key === "back") state.input = state.input.slice(0, -1);
    else if (state.input.length < 4) state.input += key; // answers max 4 digits (999+999)
    renderAnswerBox();
  }

  document.querySelectorAll(".key").forEach(function (k) {
    k.addEventListener("click", function () { pressKey(k.dataset.key); });
  });

  // Physical keyboard support for desktop testing
  document.addEventListener("keydown", function (e) {
    if (!screens.question.classList.contains("active")) return;
    if (/^[0-9]$/.test(e.key)) pressKey(e.key);
    else if (e.key === "Backspace") pressKey("back");
    else if (e.key === "Enter") submitAnswer();
  });

  $("btn-submit").addEventListener("click", submitAnswer);

  /* ---- Submit & result ---- */

  function submitAnswer() {
    if (!state.current || state.input === "") return;

    var q = state.current;
    var isRight = engine.checkAnswer(state.input, q.answer);
    state.answered++;

    var banner = $("result-banner");
    banner.classList.remove("correct", "wrong");
    // force reflow so the animation restarts when class is re-added
    void banner.offsetWidth;

    if (isRight) {
      state.correct++;
      state.streak++;
      if (state.streak > state.bestStreak) state.bestStreak = state.streak;
      banner.classList.add("correct");
      $("result-emoji").textContent = pick(["🎉", "🌟", "🥳", "😃", "🚀"]);
      $("result-title").textContent = "Correct!";
      $("result-answer").textContent = "";
      starBurst();
    } else {
      state.streak = 0;
      banner.classList.add("wrong");
      $("result-emoji").textContent = "🤔";
      $("result-title").textContent = "Not quite, let's see how!";
      $("result-answer").textContent = q.num1 + " " + (q.operator === "+" ? "+" : "−") + " " + q.num2 + " = " + q.answer;
    }

    // Step-by-step explanation (never skip: kids read it on both outcomes)
    var stepsEl = $("explain-steps");
    stepsEl.innerHTML = "";
    engine.getStepByStepExplanation(q.num1, q.num2, q.operator).forEach(function (s) {
      var li = document.createElement("li");
      li.textContent = s;
      stepsEl.appendChild(li);
    });

    // Update saved best streak globally
    var d = loadProgress();
    if (!d.bestStreak || state.bestStreak > d.bestStreak) remember("bestStreak", state.bestStreak);

    updateHUD();
    $("btn-next").textContent = state.answered >= QUESTIONS_PER_SESSION ? "See Results 🏆" : "Next Question ➜";
    show("result");
  }

  $("btn-next").addEventListener("click", nextQuestion);

  /* ================= HUD: progress & streak ================= */

  function updateHUD() {
    var pct = (state.answered / QUESTIONS_PER_SESSION) * 100;
    $("progress-fill").style.width = pct + "%";
    $("streak-count").textContent = state.streak;

    var streakEl = $("streak");
    if (state.streak >= 2) {
      streakEl.classList.add("hot");
      setTimeout(function () { streakEl.classList.remove("hot"); }, 450);
    }
  }

  /* ================= STAR BURST FX ================= */

  function starBurst() {
    var layer = $("fx-layer");
    var emojis = ["⭐", "🌟", "✨", "💫"];
    var cx = window.innerWidth / 2, cy = window.innerHeight / 2.5;

    for (var i = 0; i < 10; i++) {
      var s = document.createElement("span");
      s.className = "star";
      s.textContent = emojis[i % emojis.length];
      var angle = (Math.PI * 2 * i) / 10 + Math.random() * 0.5;
      var dist = 90 + Math.random() * 110;
      s.style.left = cx + "px";
      s.style.top = cy + "px";
      s.style.setProperty("--dx", Math.cos(angle) * dist + "px");
      s.style.setProperty("--dy", Math.sin(angle) * dist + "px");
      layer.appendChild(s);
      setTimeout(function (el) { return function () { el.remove(); }; }(s), 950);
    }
  }

  /* ================= END SCREEN ================= */

  function endSession() {
    var d = loadProgress();
    var key = highScoreKey();
    var previous = d[key] || 0;
    var isBest = state.correct > previous;
    if (isBest) remember(key, state.correct);

    $("end-score").textContent = "You got " + state.correct + " out of " + QUESTIONS_PER_SESSION + "! 🔥 Best streak: " + state.bestStreak;
    $("end-best").textContent = isBest ? "🏆 New high score!" : "High score: " + Math.max(previous, state.correct) + "/20";
    show("end");
  }

  $("btn-again").addEventListener("click", startSession);
  $("btn-home").addEventListener("click", function () {
    renderBestStats();
    show("game");
  });

  $("btn-quit").addEventListener("click", function () {
    renderBestStats();
    show("game");
  });

  /* ================= MISC ================= */

  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  /* ---- Register the service worker for offline use ---- */
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("sw.js").catch(function (err) {
        console.log("Service worker registration failed:", err);
      });
    });
  }

  /* ================= PWA INSTALL ================= */
  // Chrome/Edge/Android fire beforeinstallprompt; we use it for a native install
  // dialog from our own big kid-friendly button. When the browser doesn't
  // support it (iOS Safari, in-app webviews), tapping the button shows
  // step-by-step instructions for that device instead.
  var deferredPrompt = null;

  window.addEventListener("beforeinstallprompt", function (e) {
    e.preventDefault();            // keep the mini-banner hidden
    deferredPrompt = e;            // save for our own button
    hideInstallHint();
  });

  function hideInstallHint() {
    $("install-hint").classList.add("hidden");
  }

  function showInstallHint() {
    var hint = $("install-hint");
    if (isIOS()) {
      hint.innerHTML = "📱 On iPhone/iPad:<br />1. Tap the <b>Share</b> button ⬆️<br />2. Scroll and tap <b>Add to Home Screen</b><br />3. Tap <b>Add</b> — then it works offline! 🚀";
    } else {
      hint.innerHTML = "🤖 On Android/Chrome:<br />1. Tap the <b>⋮ menu</b> (top right)<br />2. Tap <b>Install app</b> or <b>Add to Home screen</b><br />3. Then it works offline! 🚀<br /><br />💻 On computer: click the <b>install icon</b> ⊕ in the address bar.";
    }
    hint.classList.remove("hidden");
  }

  function isIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  }

  $("btn-install").addEventListener("click", function () {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(function () {
        deferredPrompt = null;
      });
    } else {
      showInstallHint();
    }
  });

  window.addEventListener("appinstalled", function () {
    deferredPrompt = null;
    hideInstallHint();
    $("btn-install").classList.add("hidden"); // already installed
  });

  // Hide the button entirely if already running as an installed app
  var isStandalone = window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true;
  if (isStandalone) {
    $("btn-install").classList.add("hidden");
  }


  // ---- Boot ----
  renderBestStats();
  show("game");
})();
