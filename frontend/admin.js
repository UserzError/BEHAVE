// admin.js — scenario designer (admin panel).
// Edits a list of scenarios in the browser and exports it as scenarios.json.
// Nothing is saved to the server: put the exported file in backend/scenarios.json.
// Your work is kept as a draft in this browser (localStorage) until you export it.

const DRAFT_KEY = "scenario-designer-draft";
const MAX_VICTIMS = 5;
const PALETTE = ["man", "woman", "child", "elderly", "dog", "passenger"];

// Starting points for a new scenario, like Moral Machine's "Between whom is the car deciding?"
const TEMPLATES = [
  {
    name: "Pedestrians vs pedestrians",
    A: { action: "stay", label: "Stay in lane", victims: ["man"], signal: "none" },
    B: { action: "swerve", label: "Swerve into the other lane", victims: ["woman"], signal: "none" },
  },
  {
    name: "Pedestrians ahead vs passengers",
    A: { action: "stay", label: "Stay in lane", victims: ["man"], signal: "none" },
    B: { action: "swerve", label: "Swerve into the barrier", victims: ["passenger"], signal: "none" },
  },
  {
    name: "Passengers vs pedestrians in other lane",
    A: { action: "stay", label: "Stay in lane and hit the barrier", victims: ["passenger"], signal: "none" },
    B: { action: "swerve", label: "Swerve into the other lane", victims: ["man"], signal: "none" },
  },
];

let scenarios = [];
let currentIndex = 0;

const $ = (id) => document.getElementById(id);

// ---------- Saving and loading ----------

function saveDraft() {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(scenarios));
  } catch {
    // Storage can be blocked (private windows). The designer still works; the draft just isn't kept.
  }
}

function loadDraft() {
  try {
    const saved = JSON.parse(localStorage.getItem(DRAFT_KEY));
    return Array.isArray(saved) && saved.length > 0 ? saved : null;
  } catch {
    return null;
  }
}

// Start from the backend's scenarios if it's running, otherwise the sample file.
async function loadStartingScenarios() {
  for (const url of ["/scenarios", "sample-scenarios.json"]) {
    try {
      const res = await fetch(url);
      if (res.ok) return await res.json();
    } catch {
      // try the next one
    }
  }
  return [];
}

// Make sure a scenario has every field in the format from CLAUDE.md.
function normalize(s) {
  const option = (o = {}) => ({
    action: o.action === "swerve" ? "swerve" : "stay",
    label: o.label || "",
    victims: Array.isArray(o.victims) ? o.victims.filter((v) => v in VICTIMS) : [],
    signal: ["green", "red", "none"].includes(o.signal) ? o.signal : "none",
  });
  return {
    id: String(s.id || ""),
    text: s.text || "",
    options: { A: option(s.options?.A), B: option(s.options?.B) },
  };
}

// ---------- Checking ----------

function findProblems() {
  const problems = [];
  const seen = new Set();
  scenarios.forEach((s, i) => {
    const name = s.id || `Scenario ${i + 1}`;
    if (!s.id.trim()) problems.push(`${name}: needs an ID.`);
    else if (seen.has(s.id)) problems.push(`${name}: ID is used more than once.`);
    seen.add(s.id);
    if (!s.text.trim()) problems.push(`${name}: needs a question.`);
    for (const letter of ["A", "B"]) {
      const o = s.options[letter];
      if (!o.label.trim()) problems.push(`${name}, option ${letter}: needs a button label.`);
      if (o.victims.length === 0) problems.push(`${name}, option ${letter}: add at least one person or animal.`);
    }
  });
  if (scenarios.length === 0) problems.push("Add at least one scenario.");
  return problems;
}

function showProblems() {
  const problems = findProblems();
  $("problems").hidden = problems.length === 0;
  $("problem-list").replaceChildren(...problems.map((p) => el("li", "", p)));
  return problems;
}

// ---------- Drawing the page ----------

function nextId() {
  const numbers = scenarios.map((s) => parseInt(s.id.replace(/\D/g, ""), 10)).filter((n) => !isNaN(n));
  return `s${Math.max(0, ...numbers) + 1}`;
}

function summary(s) {
  return `${s.options.A.victims.length} vs ${s.options.B.victims.length}`;
}

function renderList() {
  const list = $("scenario-list");
  list.replaceChildren();
  scenarios.forEach((s, i) => {
    const button = el("button", "list-item");
    button.type = "button";
    button.append(el("span", "list-id", s.id || "(no id)"), el("span", "list-summary", summary(s)));
    if (i === currentIndex) button.setAttribute("aria-current", "true");
    button.addEventListener("click", () => select(i));
    const li = el("li");
    li.append(button);
    list.append(li);
  });
}

// Redraw only the parts that change as you edit (so text boxes keep focus while typing).
function refresh() {
  const s = scenarios[currentIndex];
  if (s) {
    for (const letter of ["A", "B"]) {
      const editor = document.querySelector(`.option-editor[data-letter="${letter}"]`);
      const option = s.options[letter];

      // A crossing signal only makes sense if pedestrians are crossing (not just passengers).
      const hasPedestrians = option.victims.some((v) => v !== "passenger");
      if (!hasPedestrians) option.signal = "none";
      for (const radio of editor.querySelectorAll('[data-field="signal"]')) {
        radio.disabled = !hasPedestrians;
        radio.checked = radio.value === option.signal;
      }

      drawOption(editor.querySelector(".preview"), letter, option);

      const chips = editor.querySelector(".victim-chips");
      chips.replaceChildren();
      option.victims.forEach((v, i) => {
        const chip = el("button", "chip", `${VICTIMS[v].emoji} ${VICTIMS[v].one} ✕`);
        chip.type = "button";
        chip.setAttribute("aria-label", `Remove ${VICTIMS[v].one}`);
        chip.addEventListener("click", () => update(() => option.victims.splice(i, 1)));
        chips.append(chip);
      });
      if (option.victims.length === 0) chips.append(el("span", "field-hint", "Nobody yet."));

      for (const b of editor.querySelectorAll(".palette button")) {
        b.disabled = option.victims.length >= MAX_VICTIMS;
      }
    }
  }
  renderList();
  showProblems();
  saveDraft();
}

// Apply a change to the current scenario, then redraw.
function update(change) {
  change();
  refresh();
}

// Fill the editor's inputs from the selected scenario.
function select(index) {
  currentIndex = index;
  const s = scenarios[index];
  $("editor").hidden = !s;
  if (!s) return refresh();

  $("scenario-id").value = s.id;
  $("scenario-text").value = s.text;
  for (const letter of ["A", "B"]) {
    const editor = document.querySelector(`.option-editor[data-letter="${letter}"]`);
    const option = s.options[letter];
    editor.querySelector('[data-field="label"]').value = option.label;
    editor.querySelector('[data-field="action"]').value = option.action;
  }
  refresh();
}

// Build the two option editors (A and B) from the <template> and hook up their inputs.
function buildOptionEditors() {
  const template = $("option-editor-template");
  for (const letter of ["A", "B"]) {
    const editor = template.content.firstElementChild.cloneNode(true);
    editor.dataset.letter = letter;
    editor.querySelector("legend").textContent = `Option ${letter}`;
    const current = () => scenarios[currentIndex].options[letter];

    editor.querySelector('[data-field="label"]').addEventListener("input", (e) =>
      update(() => { current().label = e.target.value; }));
    editor.querySelector('[data-field="action"]').addEventListener("change", (e) =>
      update(() => { current().action = e.target.value; }));
    for (const radio of editor.querySelectorAll('[data-field="signal"]')) {
      radio.name = `signal-${letter}`;
      radio.addEventListener("change", () => update(() => { current().signal = radio.value; }));
    }

    const palette = editor.querySelector(".palette");
    for (const type of PALETTE) {
      const button = el("button", "palette-item");
      button.type = "button";
      button.append(el("span", "palette-emoji", VICTIMS[type].emoji), el("span", "", VICTIMS[type].one));
      button.addEventListener("click", () => update(() => {
        if (current().victims.length < MAX_VICTIMS) current().victims.push(type);
      }));
      palette.append(button);
    }
    $("option-editors").append(editor);
  }
}

function buildTemplateButtons() {
  for (const t of TEMPLATES) {
    const button = el("button", "secondary", `+ ${t.name}`);
    button.type = "button";
    button.addEventListener("click", () => {
      scenarios.push(normalize({
        id: nextId(),
        text: "The car's brakes have failed. What should it do?",
        options: structuredClone({ A: t.A, B: t.B }),
      }));
      select(scenarios.length - 1);
      $("scenario-text").focus();
    });
    $("template-buttons").append(button);
  }
}

// ---------- Toolbar ----------

function flash(message) {
  $("status").textContent = message;
  $("status").hidden = false;
}

function exportJSON() {
  if (showProblems().length > 0) {
    flash("Not exported: fix the problems listed at the bottom first.");
    $("problems").scrollIntoView({ behavior: "smooth" });
    return null;
  }
  return JSON.stringify(scenarios, null, 2) + "\n";
}

function download() {
  const json = exportJSON();
  if (!json) return;
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([json], { type: "application/json" }));
  link.download = "scenarios.json";
  link.click();
  URL.revokeObjectURL(link.href);
  flash(`Exported ${scenarios.length} scenarios. Move scenarios.json into backend/ to use them.`);
}

async function copy() {
  const json = exportJSON();
  if (!json) return;
  try {
    await navigator.clipboard.writeText(json);
    flash("Copied. Paste it into backend/scenarios.json.");
  } catch {
    flash("Couldn't copy to the clipboard. Use Export instead.");
  }
}

async function importFile(file) {
  try {
    const data = JSON.parse(await file.text());
    if (!Array.isArray(data)) throw new Error("The file should contain a list of scenarios.");
    scenarios = data.map(normalize);
    select(0);
    flash(`Imported ${scenarios.length} scenarios from ${file.name}.`);
  } catch (err) {
    flash(`Couldn't import ${file.name}: ${err.message}`);
  }
}

// ---------- Start ----------

async function init() {
  buildOptionEditors();
  buildTemplateButtons();

  $("scenario-id").addEventListener("input", (e) => update(() => { scenarios[currentIndex].id = e.target.value.trim(); }));
  $("scenario-text").addEventListener("input", (e) => update(() => { scenarios[currentIndex].text = e.target.value; }));
  $("duplicate-btn").addEventListener("click", () => {
    const copyOf = structuredClone(scenarios[currentIndex]);
    copyOf.id = nextId();
    scenarios.splice(currentIndex + 1, 0, copyOf);
    select(currentIndex + 1);
  });
  $("delete-btn").addEventListener("click", () => {
    scenarios.splice(currentIndex, 1);
    select(Math.min(currentIndex, scenarios.length - 1));
  });
  $("export-btn").addEventListener("click", download);
  $("copy-btn").addEventListener("click", copy);
  $("import-input").addEventListener("change", (e) => {
    if (e.target.files[0]) importFile(e.target.files[0]);
    e.target.value = "";
  });
  $("reset-btn").addEventListener("click", async () => {
    try { localStorage.removeItem(DRAFT_KEY); } catch {}
    scenarios = (await loadStartingScenarios()).map(normalize);
    select(0);
    flash("Draft discarded. Reloaded the current scenarios.");
  });

  const draft = loadDraft();
  scenarios = (draft || (await loadStartingScenarios())).map(normalize);
  if (draft) flash("Restored your unsaved draft from this browser.");
  select(0);
}

init();
