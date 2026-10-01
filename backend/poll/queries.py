"""queries.py - the database work that's more than a one-liner."""
from django.db.models import Avg, Count, IntegerField, Q
from django.db.models.fields.json import KT
from django.db.models.functions import Cast

from .models import Response, Scenario

SEED_PREFIX = "seed-"  # session ids of simulated answers (manage.py seed_responses)


def results():
    """Per scenario that has answers: votes for A and B, average decision time, share who changed their mind,
    average hover time on each option, the number of answers, and how many of those are simulated."""
    rows = (
        Response.objects.values("scenario_id")  # one row per scenario...
        .annotate(                               # ...with these totals and averages
            answers=Count("id"),
            votes_a=Count("id", filter=Q(choice="A")),
            votes_b=Count("id", filter=Q(choice="B")),
            avg_decision_ms=Avg("decision_ms"),
            changed_rate=Avg(Cast("changed_answer", IntegerField())),          # true/false -> 1/0, then average
            avg_hover_a=Avg(Cast(KT("hover_ms__A"), IntegerField())),           # hover_ms["A"] as a number
            avg_hover_b=Avg(Cast(KT("hover_ms__B"), IntegerField())),
            seeded=Count("id", filter=Q(session_id__startswith=SEED_PREFIX)),
        )
        .order_by("scenario_id")
    )
    return [
        {
            "scenario_id": row["scenario_id"],
            "answers": row["answers"],
            "votes": {"A": row["votes_a"], "B": row["votes_b"]},
            "avg_decision_ms": round(row["avg_decision_ms"] or 0),
            "changed_rate": round(float(row["changed_rate"] or 0), 3),
            "avg_hover_ms": {"A": round(row["avg_hover_a"] or 0), "B": round(row["avg_hover_b"] or 0)},
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
