// app.js — participant flow: intro → one screen per scenario → thank-you.
// Uses telemetry.js (tracking) and scenario-view.js (drawing), both loaded before this file.

const sessionId = crypto.randomUUID(); // random, per participant — no personal info
let scenarios = [];
let current = 0;       // index of the scenario on screen
let selected = null;   // "A", "B", or null
let demoMode = false;  // true when the backend isn't running; responses are logged, not sent

const $ = (id) => document.getElementById(id);

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
