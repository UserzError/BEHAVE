// results.js — fetches /results (and /scenarios for option labels) and draws the charts + table.

let demoMode = false;
let rows = [];      // one entry per scenario, merged from /results and /scenarios
let charts = [];    // Chart.js instances, kept so we can redraw on light/dark change

const $ = (id) => document.getElementById(id);

async function getJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GET ${url} returned ${res.status}`);
  return res.json();
}

async function loadData() {
  try {
    return [await getJSON("/results"), await getJSON("/scenarios")];
  } catch (err) {
    console.warn("Backend not reachable, using sample results:", err);
    demoMode = true;
    return [await getJSON("sample-results.json"), await getJSON("sample-scenarios.json")];
  }
}

// Read a color token from style.css, so the charts follow light/dark mode.
function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function isDark() {
  return cssVar("color-scheme") === "dark";
}

function drawCharts() {
  for (const chart of charts) chart.destroy();

  const dark = isDark();
  const colorA = dark ? "#3987e5" : "#2a78d6"; // blue
  const colorB = dark ? "#d95926" : "#eb6834"; // orange
  const surface = cssVar("--surface");
  const text = cssVar("--text-muted");
  const grid = dark ? "#2c2c2a" : "#e1e0d9";

  Chart.defaults.color = text;
  Chart.defaults.font.family = 'system-ui, -apple-system, "Segoe UI", sans-serif';

  const labels = rows.map((r) => r.name);
  // Horizontal bars: give each scenario a fixed row height.
  const height = `${rows.length * 48 + 70}px`;
  $("votes-box").style.height = height;
  $("time-box").style.height = height;

  const barStyle = { borderRadius: 4, borderSkipped: false, borderColor: surface, borderWidth: 2, barPercentage: 0.7 };
  const axes = (stacked, max) => ({
    x: { stacked, max, beginAtZero: true, grid: { color: grid }, border: { display: false } },
    y: { stacked, grid: { display: false }, border: { color: grid } },
  });

  // Chart 1: share of votes, A vs B, stacked to 100%.
  charts.push(new Chart($("votes-chart"), {
    type: "bar",
    data: {
      labels,
      datasets: ["A", "B"].map((letter) => ({
        label: `Option ${letter}`,
        data: rows.map((r) => r[`pct${letter}`]),
        backgroundColor: letter === "A" ? colorA : colorB,
        ...barStyle,
      })),
    },
    options: {
      indexAxis: "y",
      maintainAspectRatio: false,
      scales: {
        ...axes(true, 100),
        x: { ...axes(true, 100).x, ticks: { callback: (v) => `${v}%` } },
      },
      plugins: {
        legend: { position: "top", align: "start", labels: { boxWidth: 12, boxHeight: 12 } },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const row = rows[ctx.dataIndex];
              const letter = ctx.datasetIndex === 0 ? "A" : "B";
              return ` ${row[`label${letter}`]}: ${ctx.raw}% (${row.votes[letter]} votes)`;
            },
          },
        },
      },
    },
  }));

  // Chart 2: average decision time in seconds. One series, so no legend.
  charts.push(new Chart($("time-chart"), {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "Average decision time",
        data: rows.map((r) => r.avgSeconds),
        backgroundColor: colorA,
        ...barStyle,
      }],
    },
    options: {
      indexAxis: "y",
      maintainAspectRatio: false,
      scales: {
        ...axes(false),
        x: { ...axes(false).x, ticks: { callback: (v) => `${v} s` } },
      },
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (ctx) => ` ${ctx.raw} s on average` } },
      },
    },
  }));
}

function fillTable() {
  const body = $("results-body");
  body.replaceChildren();
  for (const r of rows) {
    const tr = document.createElement("tr");
    const cells = [
      [r.name, ""],
      [`${r.labelA} (${r.killedA} killed)`, ""],
      [`${r.labelB} (${r.killedB} killed)`, ""],
      [`${r.votes.A} (${r.pctA}%)`, "num"],
      [`${r.votes.B} (${r.pctB}%)`, "num"],
      [`${r.avgSeconds} s`, "num"],
      [`${Math.round(r.changed_rate * 100)}%`, "num"],
    ];
    for (const [text, className] of cells) {
      const td = document.createElement("td");
      td.textContent = text;
      if (className) td.className = className;
      tr.append(td);
    }
    body.append(tr);
  }
}

async function init() {
  let results, scenarios;
  try {
    [results, scenarios] = await loadData();
  } catch (err) {
    console.error(err);
    $("status").textContent = "Couldn't load results.";
    return;
  }

  // Look up each scenario's option labels by id, and order scenarios s1, s2, … s10.
  const byId = Object.fromEntries(scenarios.map((s) => [s.id, s]));
  results.sort((a, b) => a.scenario_id.localeCompare(b.scenario_id, undefined, { numeric: true }));

  rows = results.map((r, i) => {
    const s = byId[r.scenario_id];
    const total = r.votes.A + r.votes.B;
    const pctA = total ? Math.round((r.votes.A / total) * 100) : 0;
    return {
      ...r,
      name: `Scenario ${i + 1}`,
      labelA: s ? s.options.A.label : "Option A",
      labelB: s ? s.options.B.label : "Option B",
      killedA: s ? s.options.A.victims.length : "?",
      killedB: s ? s.options.B.victims.length : "?",
      pctA,
      pctB: total ? 100 - pctA : 0,
      avgSeconds: Math.round(r.avg_decision_ms / 100) / 10, // one decimal place
    };
  });

  const totalVotes = rows.reduce((sum, r) => sum + r.votes.A + r.votes.B, 0);
  $("status").textContent = `${totalVotes} answers across ${rows.length} scenarios.`;
  if (demoMode) $("data-notice").hidden = false;

  fillTable();
  drawCharts();
  // Redraw with the other palette if the system switches light/dark mode.
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", drawCharts);
}

init();
