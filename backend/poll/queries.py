"""queries.py - the database work that's more than a one-liner."""
import csv
from django.db.models import Avg, Count, IntegerField, Q
from django.db.models.fields.json import KT
from django.db.models.functions import Cast, Coalesce

from .models import Response, Scenario

SEED_PREFIX = "seed-"  # session ids of simulated answers (manage.py seed_responses)


def results(answers=None):
    """Per scenario that has answers: votes for A, B and I (indifferent), average decision time, share who changed their mind,
    average hover time on each option, the number of answers, and how many of those are simulated."""
    if answers is None:
        answers = Response.objects.all()  # normally every answer; a smaller set can be passed in
    rows = (
        answers.values("scenario_id")  # one row per scenario...
        .annotate(                               # ...with these totals and averages
            answers=Count("id"),
            votes_a=Count("id", filter=Q(choice="A")),
            votes_b=Count("id", filter=Q(choice="B")),
            votes_i=Count("id", filter=Q(choice="I")),                          # I = indifferent
            avg_decision_ms=Avg("decision_ms"),
            changed_rate=Avg(Cast("changed_answer", IntegerField())),          # true/false -> 1/0, then average
            avg_hover_a=Avg(Cast(KT("hover_ms__A"), IntegerField())),           # hover_ms["A"] as a number
            avg_hover_b=Avg(Cast(KT("hover_ms__B"), IntegerField())),
            avg_hover_i=Avg(Coalesce(Cast(KT("hover_ms__I"), IntegerField()), 0)),  # 0 for older answers
            seeded=Count("id", filter=Q(session_id__startswith=SEED_PREFIX)),
        )
        .order_by("scenario_id")
    )
    return [
        {
            "scenario_id": row["scenario_id"],
            "answers": row["answers"],
            "votes": {"A": row["votes_a"], "B": row["votes_b"], "I": row["votes_i"]},
            "avg_decision_ms": round(row["avg_decision_ms"] or 0),
            "changed_rate": round(float(row["changed_rate"] or 0), 3),
            "avg_hover_ms": {
                "A": round(row["avg_hover_a"] or 0),
                "B": round(row["avg_hover_b"] or 0),
                "I": round(row["avg_hover_i"] or 0),
            },
            "seeded": row["seeded"],
        }
        for row in rows
    ]


def next_scenario_id():
    """The next free id: s1, s2, s3 ... (one more than the highest number used so far).

    Ids of deleted scenarios that still have answers count as used, so a new scenario never
    gets an old id and inherits someone else's answers in the results.
    """
    ids = list(Scenario.objects.values_list("id", flat=True))
    ids += list(Response.objects.values_list("scenario_id", flat=True).distinct())
    numbers = [int(i[1:]) for i in ids if i.startswith("s") and i[1:].isdigit()]
    return f"s{max(numbers, default=0) + 1}"


# Columns of the answers CSV (one row per answer). Hover/choice columns use the poll's letters:
# A = stay in lane, B = swerve (whichever side of the screen they were shown on), I = indifferent.
CSV_COLUMNS = [
    "id", "created_at", "session_id", "simulated", "scenario_id", "scenario_title",
    "stay_label", "swerve_label", "choice", "chose_outcome", "first_choice", "changed_answer",
    "decision_ms", "hover_stay_ms", "hover_swerve_ms", "hover_indifferent_ms", "stay_on_left", "position",
    "final_select_ms", "path_points", "path_length", "max_deviation", "x_flips",
]


def write_answers_csv(file, include_simulated=False):
    """Write every answer as a CSV row to `file` (anything with .write). Returns how many rows."""
    titles = {s.id: s.data for s in Scenario.objects.all()}
    answers = Response.objects.order_by("id")
    if not include_simulated:
        answers = answers.exclude(session_id__startswith=SEED_PREFIX)

    writer = csv.writer(file)
    writer.writerow(CSV_COLUMNS)
    count = 0
    for a in answers.iterator():
        scenario = titles.get(a.scenario_id, {})
        outcomes = scenario.get("outcomes", {})
        hover = a.hover_ms or {}
        writer.writerow([
            a.id, a.created_at.isoformat(timespec="seconds"), a.session_id, a.session_id.startswith(SEED_PREFIX),
            a.scenario_id, scenario.get("title", "(deleted)"),
            outcomes.get("stay", {}).get("label", ""), outcomes.get("swerve", {}).get("label", ""),
            a.choice, {"A": "stay", "B": "swerve", "I": "indifferent"}.get(a.choice, a.choice),
            a.first_choice or "", a.changed_answer,
            a.decision_ms, hover.get("A", ""), hover.get("B", ""), hover.get("I", ""),
            "" if a.stay_on_left is None else a.stay_on_left, a.position or "",
            "" if a.final_select_ms is None else a.final_select_ms,
            len(a.mouse_path) if a.mouse_path else 0,
            "" if a.path_length is None else a.path_length,
            "" if a.max_deviation is None else a.max_deviation,
            "" if a.x_flips is None else a.x_flips,
        ])
        count += 1
    return count
