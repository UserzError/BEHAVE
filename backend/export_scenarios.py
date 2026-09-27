"""export_scenarios.py - copies the scenarios from the database into scenarios.json.

Why: the designer saves scenarios into behave.db, which is NOT committed to git. A new server
(like PythonAnywhere) starts with an empty database and loads scenarios.json instead.
So after designing scenarios locally, run this, then commit scenarios.json:

    cd backend
    venv/bin/python export_scenarios.py
    git add scenarios.json && git commit -m "Update scenarios" && git push
"""
import json

import db

scenarios = db.list_scenarios()
with open(db.SEED_FILE, "w") as f:
    json.dump(scenarios, f, indent=2)
    f.write("\n")
print(f"Wrote {len(scenarios)} scenarios to scenarios.json")
