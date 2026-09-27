from flask import Flask, request, jsonify
import sqlite3
import json
import datetime

Backend = Flask(__name__)
DB_File = "data.db"

def get_db():
    conn = sqlite3.connect(DB_File)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    conn.execute("""
        CREATE TABLE IF NOT EXISTS responses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT,
            scenario_id TEXT,
            choice TEXT,
            first_choice TEXT,
            decision_ms INTEGER,
            hover_ms TEXT,
            changed_answer BOOLEAN,
            created_at TEXT
        )
    """)
    conn.commit()
    conn.close()

@Backend.route("/Scenarios", methods = ["GET"])
def get_scenarios():
    with open("Scenarios.json") as f:
        Scenarios = json.load(f)
    return jsonify(Scenarios)

@Backend.route("/Response", methods = ["POST"])
def post_response():
    data = request.get_json()
    conn = get_db()
    conn.execute(
        """ INSERT INTO Responses
            (session_id, scenario_id, choice, first_choice, decision_ms, hover_ms, changed_answer, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            data.get("session_id"),
            data.get("scenario_id"),
            data.get("choice"),
            data.get("first_choice"),
            data.get("decision_ms"),
            json.dumps(data.get("hover_ms", {})),
            data.get("changed_answer", False),
            datetime.datetime.utcnow().isoformat(),
        )
    )
