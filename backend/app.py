"""app.py - the Flask server. Run it with:  python app.py   (then open http://localhost:5000)

Public routes (used by the poll):
  GET  /scenarios   all scenarios
  POST /response    save one answer
  GET  /results     vote counts and timing per scenario

Admin routes (used by the scenario designer; need the X-Admin-Token header):
  GET    /admin/check            is the token right?
  POST   /admin/scenarios        create a scenario (the server picks its id)
  PUT    /admin/scenarios/<id>   replace a scenario
  DELETE /admin/scenarios/<id>   delete a scenario

It also serves the built React site (frontend/dist, made by `npm run build`).
"""
import hmac
import os

from flask import Flask, jsonify, request, send_from_directory

import db
from validate import validate_response, validate_scenario

HERE = os.path.dirname(os.path.abspath(__file__))
FRONTEND_DIST = os.path.join(HERE, "..", "frontend", "dist")


def load_env_file(path):
    """Read KEY=value lines from backend/.env into the environment, so secrets stay out of the code."""
    if not os.path.exists(path):
        return
    with open(path, "rb") as f:
        raw = f.read()
    # Windows PowerShell often saves text as UTF-16 or as UTF-8 with a hidden marker (BOM) at the start,
    # so check for those before reading it as normal text.
    if raw.startswith((b"\xff\xfe", b"\xfe\xff")):
        text = raw.decode("utf-16")
    else:
        text = raw.decode("utf-8-sig")  # utf-8-sig also removes a UTF-8 BOM if there is one
    for line in text.splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


load_env_file(os.path.join(HERE, ".env"))
ADMIN_TOKEN = os.environ.get("ADMIN_TOKEN", "")

app = Flask(__name__, static_folder=FRONTEND_DIST, static_url_path="")
db.init_db()  # create the tables (and load scenarios.json) if needed


def error(message, status=400):
    """Send back {"error": "..."} with a status code."""
    return jsonify({"error": message}), status


# ---------- The website ----------

@app.get("/")
def home():
    if not os.path.exists(os.path.join(FRONTEND_DIST, "index.html")):
        return "The site isn't built yet. Run `npm run build` in the frontend folder.", 503
    return send_from_directory(FRONTEND_DIST, "index.html")


# ---------- Poll ----------

@app.get("/scenarios")
def get_scenarios():
    return jsonify(db.list_scenarios())


@app.post("/response")
def post_response():
    data = request.get_json(silent=True)  # None if the body isn't valid JSON
    problem = validate_response(data, db.scenario_exists)
    if problem:
        return error(problem)
    db.save_response(data)
    return jsonify({"ok": True})


@app.get("/results")
def get_results():
    return jsonify(db.get_results())


# ---------- Admin (scenario designer) ----------

def admin_check_failed():
    """Returns an error response if the X-Admin-Token header is missing or wrong, otherwise None."""
    if not ADMIN_TOKEN:
        return error("Admin is turned off: set ADMIN_TOKEN in backend/.env and restart.", 401)
    sent = request.headers.get("X-Admin-Token", "")
    # compare_digest avoids leaking how many characters matched
    if not hmac.compare_digest(sent.encode(), ADMIN_TOKEN.encode()):
        return error("Wrong or missing admin token.", 401)
    return None


def clean_scenario(data, scenario_id):
    """Keep only the fields a scenario is allowed to have, and set its id."""
    return {
        "id": scenario_id,
        "title": data["title"].strip(),
        "description": data.get("description", "").strip(),
        "text": data.get("text") or "The car's brakes have failed. What should it do?",
        "dilemma": data["dilemma"],
        "signals": data["signals"],
        "outcomes": {
            name: {
                "label": outcome["label"].strip(),
                "group": [{"type": p["type"], "fate": p["fate"]} for p in outcome["group"]],
            }
            for name, outcome in data["outcomes"].items()
        },
    }


@app.get("/admin/check")
def admin_check():
    return admin_check_failed() or jsonify({"ok": True})


@app.post("/admin/scenarios")
def create_scenario():
    failed = admin_check_failed()
    if failed:
        return failed
    data = request.get_json(silent=True)
    problem = validate_scenario(data)
    if problem:
        return error(problem)
    scenario = clean_scenario(data, db.next_scenario_id())
    db.create_scenario(scenario)
    return jsonify(scenario), 201


@app.put("/admin/scenarios/<scenario_id>")
def replace_scenario(scenario_id):
    failed = admin_check_failed()
    if failed:
        return failed
    data = request.get_json(silent=True)
    problem = validate_scenario(data)
    if problem:
        return error(problem)
    scenario = clean_scenario(data, scenario_id)
    if not db.replace_scenario(scenario_id, scenario):
        return error(f"There is no scenario with id {scenario_id!r}.", 404)
    return jsonify(scenario)


@app.delete("/admin/scenarios/<scenario_id>")
def delete_scenario(scenario_id):
    failed = admin_check_failed()
    if failed:
        return failed
    if not db.delete_scenario(scenario_id):
        return error(f"There is no scenario with id {scenario_id!r}.", 404)
    return jsonify({"ok": True})


if __name__ == "__main__":
    if ADMIN_TOKEN:
        print(f"Admin token loaded ({len(ADMIN_TOKEN)} characters). Use it at http://localhost:5173/#/admin")
    else:
        print("Note: ADMIN_TOKEN is not set, so the scenario designer can't save. See backend/.env.example")
    app.run(port=5000, debug=True)
