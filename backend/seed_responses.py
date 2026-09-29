"""seed_responses.py - fills the database with SIMULATED answers, so the results page has something to show.

Run it from the backend folder:
    venv/bin/python seed_responses.py              # 40 simulated people answer every scenario
    venv/bin/python seed_responses.py 100          # 100 simulated people
    venv/bin/python seed_responses.py --remove     # delete all simulated answers

Every simulated answer has a session id starting with "seed-", so it can be told apart from real answers
(the results page shows how many answers are simulated) and removed at any time. Running it again replaces
the previous simulated answers instead of adding more.

How the fake choices are made: each character gets a rough "weight", loosely following the broad trends
reported in Awad et al. (2018), "The Moral Machine Experiment": people tend to spare more lives, children
over the elderly, humans over pets, and people crossing legally. Close calls take longer, make people
change their minds more often, and make "Indifferent" more likely. These are made-up numbers for a demo, NOT real survey data.
"""
import json
import math
import random
import sys

import db

# How much sparing each character "counts" in the simulation (1 = an adult).
WEIGHTS = {
    "baby": 1.5, "boy": 1.4, "girl": 1.4, "pregnant": 1.6,
    "elderly_man": 0.8, "elderly_woman": 0.8,
    "dog": 0.12, "cat": 0.1,  # the strongest trend in the study: humans are spared over pets
    "criminal": 0.7, "homeless": 0.9,
    "doctor_m": 1.1, "doctor_f": 1.1,
}
DILEMMAS = {  # where each outcome's group is (same as validate.py)
    "peds_vs_peds": {"stay": "ahead", "swerve": "other"},
    "peds_ahead_vs_car": {"stay": "ahead", "swerve": "car"},
    "car_vs_peds_other": {"stay": "car", "swerve": "other"},
}


def group_weight(group):
    return sum(WEIGHTS.get(person["type"], 1.0) for person in group)


def chance_of_staying(scenario):
    """Probability that a simulated person picks A (stay), before personal randomness."""
    stay_cost = group_weight(scenario["outcomes"]["stay"]["group"])     # who dies if the car stays
    swerve_cost = group_weight(scenario["outcomes"]["swerve"]["group"])  # who dies if it swerves
    score = 1.1 * (swerve_cost - stay_cost) + 0.15  # fewer/lighter deaths -> preferred; slight bias to not swerving

    # People crossing on a red light get a little less protection, on green a little more.
    places = DILEMMAS[scenario["dilemma"]]
    for outcome, sign in (("stay", 1), ("swerve", -1)):
        place = places[outcome]
        if place != "car":
            light = scenario["signals"].get(place, "none")
            score += sign * {"red": 0.6, "green": -0.4}.get(light, 0)
    return 1 / (1 + math.exp(-score))


def simulate_answer(scenario, person_bias, rng):
    p_stay = min(0.97, max(0.03, chance_of_staying(scenario) + person_bias))
    closeness = 1 - abs(2 * p_stay - 1)  # 1 = a coin flip, 0 = an easy call

    # A few people pick "Indifferent" (I), more often when it's a close call.
    if rng.random() < 0.03 + 0.12 * closeness:
        choice = "I"
    else:
        choice = "A" if rng.random() < p_stay else "B"

    decision_ms = int((2500 + 7000 * closeness) * math.exp(rng.gauss(0, 0.35)))
    changed = rng.random() < 0.06 + 0.3 * closeness
    if choice == "I":
        first_choice = rng.choice("AB") if changed else "I"
    else:
        other = "B" if choice == "A" else "A"
        first_choice = other if changed else choice

    # About 30% are on phones (no hover). Others rest the pointer mostly on the option they end up choosing,
    # and briefly on the Indifferent button.
    if rng.random() < 0.3:
        hover = {"A": 0, "B": 0, "I": 0}
    else:
        total = decision_ms * rng.uniform(0.45, 0.85)
        indifferent_time = total * (rng.uniform(0.2, 0.4) if choice == "I" else rng.uniform(0, 0.08))
        rest = total - indifferent_time
        if choice == "I":
            share = rng.uniform(0.4, 0.6)
            hover = {"A": int(rest * share), "B": int(rest * (1 - share)), "I": int(indifferent_time)}
        else:
            share = rng.uniform(0.55, 0.75)
            other = "B" if choice == "A" else "A"
            hover = {choice: int(rest * share), other: int(rest * (1 - share)), "I": int(indifferent_time)}

    return {"choice": choice, "first_choice": first_choice, "decision_ms": decision_ms,
            "hover_ms": hover, "changed_answer": changed}


def remove_seeded(conn):
    return conn.execute("DELETE FROM responses WHERE session_id LIKE ?", (db.SEED_PREFIX + "%",)).rowcount


def main():
    db.init_db()
    if "--remove" in sys.argv:
        with db.open_db() as conn:
            print(f"Removed {remove_seeded(conn)} simulated answers.")
        return

    people = int(sys.argv[1]) if len(sys.argv) > 1 else 40
    scenarios = db.list_scenarios()
    rng = random.Random(2026)  # fixed seed, so the same scenarios always give the same fake data

    with db.open_db() as conn:
        removed = remove_seeded(conn)
        for n in range(people):
            session_id = f"{db.SEED_PREFIX}{n:04d}"
            person_bias = rng.gauss(0, 0.12)  # some simulated people lean towards staying, some towards swerving
            for scenario in scenarios:
                a = simulate_answer(scenario, person_bias, rng)
                conn.execute(
                    """INSERT INTO responses
                       (session_id, scenario_id, choice, first_choice, decision_ms, hover_ms, changed_answer)
                       VALUES (?, ?, ?, ?, ?, ?, ?)""",
                    (session_id, scenario["id"], a["choice"], a["first_choice"], a["decision_ms"],
                     json.dumps(a["hover_ms"]), 1 if a["changed_answer"] else 0),
                )
    print(f"Added {people * len(scenarios)} simulated answers ({people} people x {len(scenarios)} scenarios)"
          + (f", replacing {removed} old ones." if removed else "."))


if __name__ == "__main__":
    main()
