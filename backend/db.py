"""db.py - everything that talks to the SQLite database.

The database is one file, backend/behave.db, created automatically. It has two tables:
  responses  - one row per scenario a participant answered (what they chose + telemetry)
  scenarios  - one row per scenario; the whole scenario is stored as JSON text
"""
import json
import os
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone

HERE = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(HERE, "behave.db")
SEED_FILE = os.path.join(HERE, "scenarios.json")  # starting scenarios, loaded once into an empty table


@contextmanager
def open_db():
    """Open the database, save changes at the end, and always close it.

    Use it like:  with open_db() as conn: conn.execute(...)
    """
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row  # lets us read columns by name: row["choice"]
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def now():
    """The current time as text, e.g. 2026-09-27T14:03:00+00:00."""
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


# ---------- Setup ----------

def init_db():
    """Create the tables if they don't exist yet, then add the starting scenarios if needed."""
    with open_db() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS responses (
              id             INTEGER PRIMARY KEY AUTOINCREMENT,
              session_id     TEXT NOT NULL,
              scenario_id    TEXT NOT NULL,
              choice         TEXT NOT NULL,
              first_choice   TEXT,
              decision_ms    INTEGER,
              hover_ms       TEXT,        -- JSON string, e.g. {"A": 3100, "B": 1250}
              changed_answer INTEGER,     -- 0 or 1
              created_at     TEXT DEFAULT CURRENT_TIMESTAMP
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS scenarios (
              id         TEXT PRIMARY KEY,
              data       TEXT NOT NULL,        -- the full scenario, as JSON text
              created_at TEXT DEFAULT CURRENT_TIMESTAMP,
              updated_at TEXT
            )
        """)
    seed_scenarios_if_empty()


def seed_scenarios_if_empty():
    """The first time the app runs, copy the scenarios from scenarios.json into the table."""
    with open_db() as conn:
        count = conn.execute("SELECT COUNT(*) FROM scenarios").fetchone()[0]
        if count > 0 or not os.path.exists(SEED_FILE):
            return
        with open(SEED_FILE) as f:
            scenarios = json.load(f)
        for scenario in scenarios:
            conn.execute(
                "INSERT INTO scenarios (id, data) VALUES (?, ?)",
                (scenario["id"], json.dumps(scenario)),
            )
        print(f"Loaded {len(scenarios)} scenarios from scenarios.json")


# ---------- Scenarios ----------

def list_scenarios():
    """All scenarios, oldest first."""
    with open_db() as conn:
        rows = conn.execute("SELECT data FROM scenarios ORDER BY rowid").fetchall()
    return [json.loads(row["data"]) for row in rows]


def scenario_exists(scenario_id):
    with open_db() as conn:
        row = conn.execute("SELECT 1 FROM scenarios WHERE id = ?", (scenario_id,)).fetchone()
    return row is not None


def next_scenario_id():
    """The next free id: s1, s2, s3 ... (one more than the highest number used so far).

    Ids of deleted scenarios that still have answers count as used, so a new scenario never
    gets an old id and inherits someone else's answers in the results.
    """
    with open_db() as conn:
        ids = [row["id"] for row in conn.execute("SELECT id FROM scenarios")]
        ids += [row["scenario_id"] for row in conn.execute("SELECT DISTINCT scenario_id FROM responses")]
    numbers = [int(i[1:]) for i in ids if i.startswith("s") and i[1:].isdigit()]
    return f"s{max(numbers, default=0) + 1}"


def create_scenario(scenario):
    """Save a new scenario. It must already have its "id"."""
    with open_db() as conn:
        conn.execute(
            "INSERT INTO scenarios (id, data, updated_at) VALUES (?, ?, ?)",
            (scenario["id"], json.dumps(scenario), now()),
        )


def replace_scenario(scenario_id, scenario):
    """Overwrite an existing scenario. Returns False if there was no scenario with that id."""
    with open_db() as conn:
        cursor = conn.execute(
            "UPDATE scenarios SET data = ?, updated_at = ? WHERE id = ?",
            (json.dumps(scenario), now(), scenario_id),
        )
    return cursor.rowcount > 0


def delete_scenario(scenario_id):
    """Delete a scenario. Returns False if there was no scenario with that id.
    Answers people already gave to it stay in the responses table."""
    with open_db() as conn:
        cursor = conn.execute("DELETE FROM scenarios WHERE id = ?", (scenario_id,))
    return cursor.rowcount > 0


# ---------- Responses ----------

def save_response(data):
    """Save one answer. `data` has already been checked by validate.py."""
    with open_db() as conn:
        conn.execute(
            """INSERT INTO responses
               (session_id, scenario_id, choice, first_choice, decision_ms, hover_ms, changed_answer)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (
                data["session_id"],
                data["scenario_id"],
                data["choice"],
                data.get("first_choice"),
                data["decision_ms"],
                json.dumps(data["hover_ms"]),     # store the {"A": .., "B": ..} object as text
                1 if data["changed_answer"] else 0,  # SQLite has no true/false, so 1 or 0
            ),
        )


SEED_PREFIX = "seed-"  # session ids of simulated answers made by seed_responses.py


def get_results():
    """Per scenario that has answers: votes for A, B and I (indifferent), average decision time, share who changed their mind,
    average hover time on each option, the number of answers, and how many of those are simulated (seeded)."""
    with open_db() as conn:
        rows = conn.execute("""
            SELECT scenario_id,
                   COUNT(*)                                AS answers,
                   SUM(choice = 'A')                       AS votes_a,
                   SUM(choice = 'B')                       AS votes_b,
                   SUM(choice = 'I')                       AS votes_i,
                   AVG(decision_ms)                        AS avg_decision_ms,
                   AVG(changed_answer)                     AS changed_rate,
                   AVG(json_extract(hover_ms, '$.A'))      AS avg_hover_a,
                   AVG(json_extract(hover_ms, '$.B'))      AS avg_hover_b,
                   AVG(COALESCE(json_extract(hover_ms, '$.I'), 0)) AS avg_hover_i,
                   SUM(session_id LIKE ? || '%')           AS seeded
            FROM responses
            GROUP BY scenario_id
            ORDER BY scenario_id
        """, (SEED_PREFIX,)).fetchall()
    return [
        {
            "scenario_id": row["scenario_id"],
            "answers": row["answers"],
            "votes": {"A": row["votes_a"], "B": row["votes_b"], "I": row["votes_i"]},  # I = indifferent
            "avg_decision_ms": round(row["avg_decision_ms"] or 0),
            "changed_rate": round(row["changed_rate"] or 0, 3),
            "avg_hover_ms": {
                "A": round(row["avg_hover_a"] or 0),
                "B": round(row["avg_hover_b"] or 0),
                "I": round(row["avg_hover_i"] or 0),
            },
            "seeded": row["seeded"],
        }
        for row in rows
    ]
