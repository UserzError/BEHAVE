// telemetry.js — measures HOW a participant decides on one scenario.
// Everything is kept in memory and read once, when they confirm (not sent per mouse event).
// app.js calls: startTracking(), hoverStart(), hoverEnd(), recordSelection(), getTelemetry().

let scenarioStartTime = 0;
let hoverTotals = { A: 0, B: 0 };         // total ms the pointer spent over each option
let hoverStartTimes = { A: null, B: null }; // when the current hover began (null = not hovering)
let firstChoice = null;
let lastChoice = null;
let switched = false;                      // true if they ever picked one option, then the other

// Call when a new scenario appears on screen.
function startTracking() {
  scenarioStartTime = performance.now();
  hoverTotals = { A: 0, B: 0 };
  hoverStartTimes = { A: null, B: null };
  firstChoice = null;
  lastChoice = null;
  switched = false;
}

function hoverStart(option) {
  hoverStartTimes[option] = performance.now();
}

function hoverEnd(option) {
  if (hoverStartTimes[option] === null) return;
  hoverTotals[option] += performance.now() - hoverStartTimes[option];
  hoverStartTimes[option] = null;
}

// Call every time the participant clicks an option (before confirming).
function recordSelection(option) {
  if (firstChoice === null) {
    firstChoice = option;
  } else if (option !== lastChoice) {
    switched = true;
  }
  lastChoice = option;
}

// Call on confirm. Returns the telemetry fields of the POST /response body.
function getTelemetry() {
  // Close out any hover still in progress so it counts.
  hoverEnd("A");
  hoverEnd("B");
  return {
    first_choice: firstChoice,
    decision_ms: Math.round(performance.now() - scenarioStartTime),
    hover_ms: { A: Math.round(hoverTotals.A), B: Math.round(hoverTotals.B) },
    changed_answer: switched,
  };
}
