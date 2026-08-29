Build a complete offline-first Kids' Math PWA (addition & subtraction, 1–3 digits) in `/Users/arunika/Documents/Git/game-MathPlusMinusV1` using pure HTML/CSS/Vanilla JS.

**App structure: 2 games.** The very first screen is a **Game Select** page with two big cards: **Addition ➕** and **Subtraction ➖**. After choosing a game, the player picks the level (1-digit / 2-digit / 3-digit) and starts. Questions are always single-operator — never mixed.

## Files to create

### 1. `math-engine.js` — Pure logic module (class `MathEngine`)
- **Question banks**, per game and level (never mixed):
  - Addition: 30 (1-digit), 50 (2-digit), 50 (3-digit) questions.
  - Subtraction: 45 (1-digit), 50 (2-digit), 50 (3-digit) questions; first number always ≥ second (no negative results).
- **Session**: one game = 20 random questions drawn only from the chosen game + level bank.
- `generateQuestion(game, level)` → `{num1, num2, operator, answer}` for the next unused question in the shuffled 20.
- `getStepByStepExplanation(num1, num2, operator)` → array of strings using the Place Value method (Ones → Tens → Hundreds), including carrying for addition ("5+7=12, write 2, carry 1") and borrowing for subtraction ("2−8 not possible, borrow 10 from tens…"), ending with "Final: 100 + 60 + 8 = 168".
- `checkAnswer(userAnswer, correctAnswer)` → true/false.
- Console test block demonstrating a no-carry, a carry, and a borrow explanation.

### 2. `manifest.json`
- "Math Plus Minus", `display: standalone`, portrait, theme #FF9800 / background #FFF8E1, placeholder 192 & 512 icon entries.

### 3. `sw.js`
- Cache-first service worker: versioned cache precaching all app files; `install` → skipWaiting; `activate` → purge old caches; `fetch` → cache-first with network fallback.

### 4. `index.html`
- Responsive viewport, manifest link, theme-color. Single page, JS-toggled screens:
  - **Game Select Screen (first page)**: two large distinct cards — Addition (green/blue theme, ➕) and Subtraction (orange/purple theme, ➖).
  - **Level Select Screen**: 3 big buttons (1-digit, 2-digit, 3-digit) for the chosen game, saved level highlighted, Start button.
  - **Question Screen**: top progress bar, streak flame counter, question `num1 ± num2 = ?`, big answer display, on-screen numeric keypad (0–9, backspace, clear) with ≥60px buttons, big Submit.
  - **Result Screen**: "Correct! 🎉" / "Not quite, let's see how!", full step-by-step explanation, big pulsing "Next Question" button.
  - **End Screen**: session score summary, Play Again / Home.

### 5. `style.css`
- Mobile-first Grid/Flexbox, rounded kid-friendly bright palette, 60px+ touch buttons; each game gets its own accent color.
- Green flash + star burst on correct; gentle orange shake on wrong; flame bounce on streak; animated progress bar; Next-button pulse.

### 6. `app.js`
- Registers service worker; game loop: pick game → pick level → 20-question session → keypad → submit → check → explanation → next → end screen.
- Gamification: streak counter (consecutive correct, resets on wrong), star-burst particles on correct, progress bar = answered/20.
- `localStorage`: last game, last level, per-game/level high scores, best streak.

## Verification
- Serve locally (`python3 -m http.server`), smoke-test the full flow in a browser, and run the engine's console tests to confirm carry/borrow step logic.