/* ============================================================
 * MathEngine — pure logic for the Kids' Math PWA
 * No DOM access, no dependencies. Safe to run in Node for tests.
 * ============================================================ */
class MathEngine {
  constructor() {
    // Question banks, keyed by game ("add" | "sub") and level (1..3).
    // Banks are NEVER mixed: one session = one game + one level.
    this.banks = this.#buildBanks();
    // Active session state
    this.session = null;
  }

  /* -------------------- Question banks -------------------- */

  #randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  #buildBank(game, level) {
    const max = Math.pow(10, level) - 1;      // 9, 99 or 999
    const min = level === 1 ? 1 : Math.pow(10, level - 1); // keep the digit count honest
    const bank = [];
    const seen = new Set();
    let guard = 0;

    // Subtraction: ensure num1 >= num2 so the answer is never negative.
    const size = game === "add" ? (level === 1 ? 30 : 50) : level === 1 ? 45 : 50;

    while (bank.length < size && guard < size * 200) {
      guard++;
      let a = this.#randInt(min, max);
      let b = this.#randInt(min, max);
      if (game === "sub" && a < b) [a, b] = [b, a];
      const key = `${a}|${b}`;
      if (seen.has(key)) continue;
      // Reject pointless zero questions like 5 + 0
      if (game === "add" && b === 0) continue;
      seen.add(key);
      bank.push({
        num1: a,
        num2: b,
        operator: game === "add" ? "+" : "-",
        answer: game === "add" ? a + b : a - b,
      });
    }
    return bank;
  }

  #buildBanks() {
    return {
      add: { 1: this.#buildBank("add", 1), 2: this.#buildBank("add", 2), 3: this.#buildBank("add", 3) },
      sub: { 1: this.#buildBank("sub", 1), 2: this.#buildBank("sub", 2), 3: this.#buildBank("sub", 3) },
    };
  }

  #shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /* -------------------- Session handling -------------------- */

  // Start a 20-question session from one game + one level bank.
  startSession(game, level, questionCount = 20) {
    const bank = this.banks[game][level];
    this.session = {
      game,
      level,
      questions: this.#shuffle(bank).slice(0, Math.min(questionCount, bank.length)),
      index: 0,
      correct: 0,
    };
    return this.session;
  }

  // Returns the next question object or null when the session is done.
  generateQuestion() {
    if (!this.session || this.session.index >= this.session.questions.length) return null;
    return this.session.questions[this.session.index++];
  }

  /* -------------------- Step-by-step explanation -------------------- */

  // Place-value explanation: Ones -> Tens -> Hundreds.
  // Explains carrying (addition) and borrowing (subtraction) when needed.
  getStepByStepExplanation(num1, num2, operator) {
    const names = ["ones", "tens", "hundreds"];
    const places = [1, 10, 100];
    const steps = [];
    const sum = operator === "+" ? num1 + num2 : num1 - num2;
    const maxPlaces = Math.max(String(num1).length, String(num2).length, String(Math.abs(sum)).length);
    let stepNo = 1;

    // Digits, least significant first: digits[0] = ones.
    const digitsOf = (n) => String(Math.abs(n)).split("").reverse().map(Number);
    const d1 = digitsOf(num1);
    const d2 = digitsOf(num2);

    // Column-by-column arithmetic with carry/borrow tracking.
    const colResults = [];
    let carry = 0; // also used as "borrow flag" amount for subtraction

    for (let i = 0; i < maxPlaces; i++) {
      let a = d1[i] || 0;
      let b = d2[i] || 0;
      const placeName = names[i];

      if (operator === "+") {
        let raw = a + b + carry;
        const writeDigit = raw % 10;
        const newCarry = Math.floor(raw / 10);
        if (carry > 0 && i < maxPlaces) {
          const carryNote = newCarry > 0 ? `, carry ${newCarry} to the ${names[i + 1] || "next column"}` : "";
          steps.push(`Step ${stepNo++}: Add the ${placeName}: ${a} + ${b} + ${carry} carried = ${raw}. Write ${writeDigit}${carryNote}.`);
        } else {
          steps.push(`Step ${stepNo++}: Add the ${placeName}: ${a} + ${b} = ${raw}${newCarry > 0 ? `. That's ${writeDigit}, carry 1 to the ${names[i + 1] || "next column"}` : ""}.`);
        }
        colResults.push(writeDigit * places[i]);
        carry = newCarry;
      } else {
        // Subtraction with borrowing
        let borrowNote = "";
        let topDigit = a;
        if (i > 0 && d1[i] === undefined) d1[i] = 9; // already-borrowed column placeholder
        if (a < b) {
          // borrow 1 from the next place
          topDigit = a + 10;
          // Reduce the next digit of the top number (for explanation honesty)
          let k = i + 1;
          while (k < d1.length && d1[k] === 0) { d1[k] = 9; k++; }
          if (k < d1.length) d1[k] -= 1;
          borrowNote = ` We can't take ${b} from ${a}, so borrow 10 from the ${names[i + 1] || "next column"}: ${topDigit} − ${b}`;
        }
        const raw = topDigit - b;
        if (borrowNote) {
          steps.push(`Step ${stepNo++}: Subtract the ${placeName}:${borrowNote} = ${raw}.`);
        } else {
          steps.push(`Step ${stepNo++}: Subtract the ${placeName}: ${a} − ${b} = ${raw}.`);
        }
        colResults.push(raw * places[i]);
      }
    }

    // Leftover carry (e.g. 60 + 70 = 130)
    if (operator === "+" && carry > 0) {
      const extra = carry * places[maxPlaces];
      colResults.push(extra);
      steps.push(`Step ${stepNo++}: Don't forget the carried ${carry}: it becomes ${extra}.`);
    }

    // Build the "Final" line, e.g. "Final: 100 + 60 + 8 = 168"
    const parts = colResults
      .slice()
      .sort((x, y) => y - x)
      .filter((v) => v > 0);
    const finalSum = parts.length ? parts.reduce((x, y) => x + y, 0) : 0;

    if (parts.length > 1) {
      steps.push(`Final: ${parts.join(" + ")} = ${finalSum}.`);
    } else if (parts.length === 1) {
      steps.push(`Final: the answer is ${finalSum}.`);
    } else {
      steps.push(`Final: the answer is 0.`);
    }
    return steps;
  }

  /* -------------------- Validation -------------------- */

  checkAnswer(userAnswer, correctAnswer) {
    const u = Number(userAnswer);
    if (!Number.isFinite(u)) return false;
    return u === Number(correctAnswer);
  }
}

/* -------------------- Console self-tests -------------------- */
if (typeof window === "undefined") {
  const e = new MathEngine();

  console.log("=== No carry: 123 + 45 ===");
  console.log(e.getStepByStepExplanation(123, 45, "+"));

  console.log("\n=== Carry: 15 + 17 ===");
  console.log(e.getStepByStepExplanation(15, 17, "+"));

  console.log("\n=== Borrow: 42 - 18 ===");
  console.log(e.getStepByStepExplanation(42, 18, "-"));

  console.log("\n=== Triple carry: 385 + 479 ===");
  console.log(e.getStepByStepExplanation(385, 479, "+"));

  console.log("\n=== Check answers ===");
  console.log("168 correct? ", e.checkAnswer(168, 123 + 45)); // true
  console.log("99 wrong?    ", e.checkAnswer(99, 123 + 45));  // false

  console.log("\n=== Bank sizes ===");
  console.log("add L1:", e.banks.add[1].length, "add L2:", e.banks.add[2].length, "add L3:", e.banks.add[3].length);
  console.log("sub L1:", e.banks.sub[1].length, "sub L2:", e.banks.sub[2].length, "sub L3:", e.banks.sub[3].length);

  // Sanity: no negative answers ever, no mixed operators per session
  e.startSession("sub", 3);
  let q, ok = true;
  while ((q = e.generateQuestion())) {
    if (q.answer < 0 || q.operator !== "-") ok = false;
  }
  console.log("Subtraction session all valid & single-operator:", ok);
}

// Export for both browser (global) and Node tests
if (typeof module !== "undefined") module.exports = MathEngine;
