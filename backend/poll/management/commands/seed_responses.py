"""manage.py seed_responses - fills the database with SIMULATED answers, so the results page has something to show.

    venv/bin/python manage.py seed_responses              # 40 simulated people answer every scenario
    venv/bin/python manage.py seed_responses 100          # 100 simulated people
    venv/bin/python manage.py seed_responses --remove     # delete all simulated answers

Every simulated answer has a session id starting with "seed-", so it can be told apart from real answers
(the results page shows how many answers are simulated) and removed at any time. Running it again replaces
the previous simulated answers instead of adding more.

How the fake choices are made: each character gets a rough "weight", loosely following the broad trends
reported in Awad et al. (2018), "The Moral Machine Experiment": people tend to spare more lives, children
over the elderly, humans over pets, and people crossing legally. Close calls take longer and make people
change their minds more often. These are made-up numbers for a demo, NOT real survey data.
"""
import math
import random

from django.core.management.base import BaseCommand
from django.db import transaction

from poll.models import Response, Scenario
from poll.queries import SEED_PREFIX

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
    choice = "A" if rng.random() < p_stay else "B"
    closeness = 1 - abs(2 * p_stay - 1)  # 1 = a coin flip, 0 = an easy call

    decision_ms = int((2500 + 7000 * closeness) * math.exp(rng.gauss(0, 0.35)))
    changed = rng.random() < 0.06 + 0.3 * closeness
    other = "B" if choice == "A" else "A"
    first_choice = other if changed else choice

    # About 30% are on phones (no hover). Others rest the pointer mostly on the option they end up choosing.
    if rng.random() < 0.3:
        hover = {"A": 0, "B": 0}
    else:
        total = decision_ms * rng.uniform(0.45, 0.85)
        share = rng.uniform(0.55, 0.75)
        hover = {choice: int(total * share), other: int(total * (1 - share))}

    return {"choice": choice, "first_choice": first_choice, "decision_ms": decision_ms,
            "hover_ms": hover, "changed_answer": changed}


class Command(BaseCommand):
    help = "Add simulated answers for every scenario (replacing earlier simulated ones)."

    def add_arguments(self, parser):
        parser.add_argument("people", nargs="?", type=int, default=40, help="how many simulated people (default 40)")
        parser.add_argument("--remove", action="store_true", help="only delete the simulated answers")

    def handle(self, *args, people=40, remove=False, **options):
        seeded = Response.objects.filter(session_id__startswith=SEED_PREFIX)
        if remove:
            removed, _ = seeded.delete()
            self.stdout.write(f"Removed {removed} simulated answers.")
            return

        scenarios = [s.data for s in Scenario.objects.all()]
        rng = random.Random(2026)  # fixed seed, so the same scenarios always give the same fake data
        answers = []
        for n in range(people):
            session_id = f"{SEED_PREFIX}{n:04d}"
            person_bias = rng.gauss(0, 0.12)  # some simulated people lean towards staying, some towards swerving
            order = rng.sample(scenarios, len(scenarios))  # each person sees them in a random order, like the poll
            for position, scenario in enumerate(order, start=1):
                a = simulate_answer(scenario, person_bias, rng)
                answers.append(Response(
                    session_id=session_id, scenario_id=scenario["id"], position=position,
                    stay_on_left=rng.random() < 0.5,  # random sides, like the poll (no side bias is simulated)
                    **a,  # no mouse path: we don't invent the thing we're trying to measure
                ))

        with transaction.atomic():  # replace the old simulated answers in one go
            removed, _ = seeded.delete()
            Response.objects.bulk_create(answers)
        self.stdout.write(self.style.SUCCESS(
            f"Added {len(answers)} simulated answers ({people} people x {len(scenarios)} scenarios)"
            + (f", replacing {removed} old ones." if removed else ".")
        ))
