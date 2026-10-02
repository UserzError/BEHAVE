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
    choice = models.CharField(max_length=1)                                  # "A" (stay), "B" (swerve) or "I" (indifferent)
    first_choice = models.CharField(max_length=1, null=True, blank=True)     # the first option they clicked
    decision_ms = models.IntegerField()                                      # time to confirm, in milliseconds
    hover_ms = models.JSONField()                                            # {"A": 3100, "B": 1250, "I": 200}
    changed_answer = models.BooleanField()                                   # did they switch before confirming?

    # Study design (optional; older answers don't have them)
    stay_on_left = models.BooleanField(null=True)           # was "stay" (A) shown on the left? sides are randomized
    position = models.PositiveIntegerField(null=True)       # 1 = the first scenario this person saw

    # Mouse tracking (optional; empty on touch screens). See trajectory.py.
    mouse_path = models.JSONField(null=True)                # [[t_ms, x, y], ...], x/y relative to the options area
    final_select_ms = models.IntegerField(null=True)        # when they clicked their final choice
    path_length = models.FloatField(null=True)
    max_deviation = models.FloatField(null=True)
    x_flips = models.IntegerField(null=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "responses"
        constraints = [
            # One answer per participant per scenario. A repeat (double click, retried request) keeps the first.
            models.UniqueConstraint(fields=["session_id", "scenario_id"], name="one_answer_per_scenario"),
        ]

    def __str__(self):
        return f"{self.session_id} {self.scenario_id} {self.choice}"


class RateLimit(models.Model):
    """How many answers one IP address has sent in one time window. Kept in the database so that every
    worker process (and every server) shares the same count. See views.over_rate_limit."""

    key = models.CharField(primary_key=True, max_length=120)  # "answers:<hashed ip>:<window number>"
    count = models.IntegerField()
    expires_at = models.DateTimeField(db_index=True)  # old windows are cleaned up after this

    class Meta:
        db_table = "rate_limits"
