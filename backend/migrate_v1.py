"""migrate_v1.py - converts old (v1) scenarios in scenarios.json to the new (v2) format.

Run it from the backend folder:   python migrate_v1.py
  - v1 scenarios (options A/B with a "victims" list) are converted; v2 ones are left alone.
  - The old file is kept as scenarios.v1.bak.json, just in case.

How a v1 scenario becomes v2:
  - option A -> "stay", option B -> "swerve"; each victim becomes a character with fate "killed"
  - the dilemma type comes from where "passenger" appears:
      in B -> peds_ahead_vs_car, in A -> car_vs_peds_other, nowhere -> peds_vs_peds
  - option A's signal goes to the "ahead" lane, B's to the "other" lane (none where there are only passengers)
"""
import json
import os
import shutil

HERE = os.path.dirname(os.path.abspath(__file__))
SCENARIOS_FILE = os.path.join(HERE, "scenarios.json")
BACKUP_FILE = os.path.join(HERE, "scenarios.v1.bak.json")

# v1 had 6 victim types; v2 has 20 characters. Some v1 types map to two v2 characters,
# so we alternate between them (child -> boy, girl, boy, ...).
V1_TO_V2 = {
    "man": ["man"],
    "woman": ["woman"],
    "child": ["boy", "girl"],
    "elderly": ["elderly_man", "elderly_woman"],
    "passenger": ["man", "woman"],  # v1 passengers had no age/gender
    "dog": ["dog"],
}


def convert_group(victims):
    seen = {}  # how many of each v1 type we've converted so far, to alternate
    group = []
    for victim in victims:
        choices = V1_TO_V2[victim]
        count = seen.get(victim, 0)
        group.append({"type": choices[count % len(choices)], "fate": "killed"})
        seen[victim] = count + 1
    return group


def convert(v1):
    a, b = v1["options"]["A"], v1["options"]["B"]
    if "passenger" in b["victims"]:
        dilemma = "peds_ahead_vs_car"
    elif "passenger" in a["victims"]:
        dilemma = "car_vs_peds_other"
    else:
        dilemma = "peds_vs_peds"

    # a lane with only passengers (the car hits a barrier) can't have a road light
    ahead_signal = "none" if dilemma == "car_vs_peds_other" else a.get("signal", "none")
    other_signal = "none" if dilemma == "peds_ahead_vs_car" else b.get("signal", "none")

    return {
        "id": v1["id"],
        "title": f"Scenario {v1['id']}",
        "description": "",
        "text": v1.get("text", "The car's brakes have failed. What should it do?"),
        "dilemma": dilemma,
        "signals": {"ahead": ahead_signal, "other": other_signal},
        "outcomes": {
            "stay": {"label": a["label"], "group": convert_group(a["victims"])},
            "swerve": {"label": b["label"], "group": convert_group(b["victims"])},
        },
    }


def main():
    with open(SCENARIOS_FILE) as f:
        scenarios = json.load(f)

    converted = 0
    result = []
    for s in scenarios:
        if "options" in s:  # a v1 scenario
            result.append(convert(s))
            converted += 1
        else:
            result.append(s)

    if converted == 0:
        print("Nothing to convert: every scenario is already v2.")
        return

    shutil.copyfile(SCENARIOS_FILE, BACKUP_FILE)
    with open(SCENARIOS_FILE, "w") as f:
        json.dump(result, f, indent=2)
        f.write("\n")
    print(f"Converted {converted} scenario(s). The old file is saved as {os.path.basename(BACKUP_FILE)}.")


if __name__ == "__main__":
    main()
