"""models.py - the two database tables. Django creates them in PostgreSQL with `manage.py migrate`."""
from django.db import models


class Scenario(models.Model):
    """One scenario. The whole scenario (the v2 format the designer makes) is stored as JSON in `data`."""

    id = models.CharField(primary_key=True, max_length=20)  # "s1", "s2", ...
    data = models.JSONField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "scenarios"
        ordering = ["created_at"]  # oldest first

    def __str__(self):
        return f"{self.id}: {self.data.get('title', '')}"


class Response(models.Model):
    """One answer: a participant's choice for one scenario, plus how they decided (telemetry)."""

    session_id = models.CharField(max_length=64, db_index=True)  # random id per participant; no personal info
    # Plain text instead of a link to Scenario, so answers are kept if a scenario is deleted.
    scenario_id = models.CharField(max_length=20, db_index=True)
    choice = models.CharField(max_length=1)                                  # "A" (stay) or "B" (swerve)
    first_choice = models.CharField(max_length=1, null=True, blank=True)     # the first option they clicked
    decision_ms = models.IntegerField()                                      # time to confirm, in milliseconds
    hover_ms = models.JSONField()                                            # {"A": 3100, "B": 1250}
    changed_answer = models.BooleanField()                                   # did they switch before confirming?
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "responses"

    def __str__(self):
        return f"{self.session_id} {self.scenario_id} {self.choice}"
