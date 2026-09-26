// scenario-view.js — draws one scenario option (lane picture + text).
// Shared by app.js (the poll) and admin.js (the designer's live preview), so both look identical.

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

// Small helper: make an element with a class and optional text.
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

// "1 man, 2 children and 1 dog"
function describeVictims(victims) {
  const counts = {};
  for (const v of victims) counts[v] = (counts[v] || 0) + 1;
  const parts = Object.entries(counts).map(([type, n]) =>
    `${n} ${n === 1 ? VICTIMS[type].one : VICTIMS[type].many}`
  );
  if (parts.length === 0) return "nobody";
  if (parts.length === 1) return parts[0];
  return parts.slice(0, -1).join(", ") + " and " + parts[parts.length - 1];
}

// Fill one option container: label, a drawn lane, the crossing signal, and a plain-text summary.
function drawOption(container, letter, option) {
  container.replaceChildren();

  container.append(el("span", "option-letter", `Option ${letter}`));
  container.append(el("span", "option-label", option.label));

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
  container.append(lane);

  if (SIGNALS[option.signal]) container.append(el("span", "signal", SIGNALS[option.signal]));
  container.append(el("span", "summary", `Killed: ${describeVictims(option.victims)}`));
}
