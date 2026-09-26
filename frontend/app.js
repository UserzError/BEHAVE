// app.js — participant flow: intro → one screen per scenario → thank-you.
// Uses the tracking functions from telemetry.js (loaded before this file).

// One emoji and a singular/plural name per allowed victim type (see CLAUDE.md).
const VICTIMS = {
  man:       { emoji: "👨", one: "man", many: "men" },
  woman:     { emoji: "👩", one: "woman", many: "women" },
  child:     { emoji: "🧒", one: "child", many: "children" },
  elderly:   { emoji: "🧓", one: "elderly person", many: "elderly people" },
  passenger: { emoji: "🧑", one: "passenger", many: "passengers" },
  dog:       { emoji: "🐕", one: "dog", many: "dogs" },
};

const SIGNALS = {
  green: "🟢 Pedestrians are crossing on a green light (legally)",
  red:   "🔴 Pedestrians are crossing on a red light (illegally)",
  none:  "",
};

const sessionId = crypto.randomUUID(); // random, per participant — no personal info
let scenarios = [];
let current = 0;       // index of the scenario on screen
let selected = null;   // "A", "B", or null
let demoMode = false;  // true when the backend isn't running; responses are logged, not sent

const $ = (id) => document.getElementById(id);

// Small helper: make an element with a class and optional text.
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

// ---------- Loading ----------

async function loadScenarios() {
  try {
    const res = await fetch("/scenarios");
    if (!res.ok) throw new Error(`GET /scenarios returned ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn("Backend not reachable, using sample scenarios:", err);
    demoMode = true;
    const res = await fetch("sample-scenarios.json");
    return res.json();
  }
}

// ---------- Drawing a scenario ----------

// "1 man, 2 children and 1 dog"
function describeVictims(victims) {
  const counts = {};
  for (const v of victims) counts[v] = (counts[v] || 0) + 1;
  const parts = Object.entries(counts).map(([type, n]) =>
    `${n} ${n === 1 ? VICTIMS[type].one : VICTIMS[type].many}`
  );
  if (parts.length <= 1) return parts.join("");
  return parts.slice(0, -1).join(", ") + " and " + parts[parts.length - 1];
}

// Fill one option button: label, a drawn lane, the crossing signal, and a plain-text summary.
function drawOption(button, letter, option) {
  button.replaceChildren();

  button.append(el("span", "option-letter", `Option ${letter}`));
  button.append(el("span", "option-label", option.label));

  // The lane picture is decorative; the summary line below says the same thing in words.
  const lane = el("span", "lane");
  lane.setAttribute("aria-hidden", "true");
  const passengers = option.victims.filter((v) => v === "passenger");
  const pedestrians = option.victims.filter((v) => v !== "passenger");

  const ahead = el("span", "lane-ahead");
  if (passengers.length > 0) ahead.append(el("span", "barrier", "🧱"));
  for (const v of pedestrians) ahead.append(el("span", "victim", VICTIMS[v].emoji));
  lane.append(ahead);

  const car = el("span", "car");
  for (const v of passengers) car.append(el("span", "victim", VICTIMS[v].emoji));
  car.append(el("span", "car-icon", "🚗"));
  lane.append(car);
  button.append(lane);

  if (SIGNALS[option.signal]) button.append(el("span", "signal", SIGNALS[option.signal]));
  button.append(el("span", "summary", `Killed: ${describeVictims(option.victims)}`));
}

function showScenario() {
  const scenario = scenarios[current];
  selected = null;

  $("progress").textContent = `Scenario ${current + 1} of ${scenarios.length}`;
  $("scenario-text").textContent = scenario.text;

  for (const letter of ["A", "B"]) {
    const button = $(`option-${letter}`);
    drawOption(button, letter, scenario.options[letter]);
    button.setAttribute("aria-pressed", "false");
  }
  $("confirm-btn").disabled = true;

  startTracking();
  // If the pointer is already resting on an option, no pointerenter fires — start that hover now.
  for (const letter of ["A", "B"]) {
    if ($(`option-${letter}`).matches(":hover")) hoverStart(letter);
  }
}

// ---------- Answering ----------

function selectOption(letter) {
  selected = letter;
  recordSelection(letter);
  for (const other of ["A", "B"]) {
    $(`option-${other}`).setAttribute("aria-pressed", String(other === letter));
  }
  $("confirm-btn").disabled = false;
}

async function sendResponse(response) {
  if (demoMode) {
    console.log("Demo mode — would POST /response:", response);
    return;
  }
  try {
    const res = await fetch("/response", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(response),
    });
    if (!res.ok) console.error("POST /response failed:", res.status, await res.text());
  } catch (err) {
    // Keep the participant moving even if one save fails.
    console.error("POST /response failed:", err);
  }
}

async function confirmChoice() {
  if (!selected) return;
  const scenario = scenarios[current];
  // Read telemetry immediately, so the network request doesn't add to decision time.
  const response = {
    session_id: sessionId,
    scenario_id: scenario.id,
    choice: selected,
    ...getTelemetry(),
  };

  $("confirm-btn").disabled = true;
  await sendResponse(response);

  current++;
  if (current < scenarios.length) {
    showScenario();
    $("scenario-text").focus();
  } else {
    showScreen("done-screen");
  }
}

// ---------- Screens ----------

function showScreen(id) {
  for (const screen of document.querySelectorAll("main > section")) {
    screen.hidden = screen.id !== id;
  }
  const heading = $(id).querySelector("h1, h2");
  if (heading) heading.focus();
}

async function init() {
  for (const letter of ["A", "B"]) {
    const button = $(`option-${letter}`);
    // Hover only means something with a mouse or pen; touch "hovers" would just be taps.
    button.addEventListener("pointerenter", (e) => { if (e.pointerType !== "touch") hoverStart(letter); });
    button.addEventListener("pointerleave", (e) => { if (e.pointerType !== "touch") hoverEnd(letter); });
    button.addEventListener("click", () => selectOption(letter));
  }
  $("confirm-btn").addEventListener("click", confirmChoice);
  $("start-btn").addEventListener("click", () => {
    showScreen("scenario-screen");
    showScenario();
  });

  try {
    scenarios = await loadScenarios();
  } catch (err) {
    console.error(err);
    $("start-btn").textContent = "Couldn't load scenarios";
    return;
  }
  if (demoMode) $("data-notice").hidden = false;
  $("start-btn").textContent = "Start";
  $("start-btn").disabled = false;
}

init();
