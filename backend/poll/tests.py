"""tests.py - checks every address works. Run with:  venv/bin/python manage.py test

Django runs these against a temporary, empty test database (it doesn't touch your real data).
"""
import json

from django.core.management import call_command
from django.test import TestCase, override_settings

from .models import Response, Scenario

TOKEN = "test-token"

SCENARIO = {
    "title": "Doctors vs. passengers",
    "dilemma": "peds_ahead_vs_car",
    "signals": {"ahead": "green", "other": "none"},
    "outcomes": {
        "stay": {"label": "Stay", "group": [{"type": "doctor_f", "fate": "killed"}]},
        "swerve": {"label": "Swerve", "group": [{"type": "man", "fate": "killed"}, {"type": "cat", "fate": "killed"}]},
    },
}

ANSWER = {
    "session_id": "abc", "scenario_id": "s1", "choice": "B", "first_choice": "A",
    "decision_ms": 8420, "hover_ms": {"A": 3100, "B": 1250}, "changed_answer": True,
}


@override_settings(ADMIN_TOKEN=TOKEN)
class ApiTests(TestCase):
    def setUp(self):
        Scenario.objects.create(id="s1", data={**SCENARIO, "id": "s1"})

    # helpers
    def post(self, path, body, token=None):
        headers = {"HTTP_X_ADMIN_TOKEN": token} if token else {}
        return self.client.post(path, json.dumps(body), content_type="application/json", **headers)

    def put(self, path, body, token=TOKEN):
        return self.client.put(path, json.dumps(body), content_type="application/json", HTTP_X_ADMIN_TOKEN=token)

    # ---------- poll ----------

    def test_scenarios_lists_saved_scenarios(self):
        data = self.client.get("/scenarios").json()
        self.assertEqual([s["id"] for s in data], ["s1"])

    def test_response_is_saved(self):
        self.assertEqual(self.post("/response", ANSWER).json(), {"ok": True})
        saved = Response.objects.get()
        self.assertEqual((saved.choice, saved.first_choice, saved.hover_ms, saved.changed_answer),
                         ("B", "A", {"A": 3100, "B": 1250}, True))

    def test_bad_responses_are_rejected(self):
        bad = {
            "missing field": {k: v for k, v in ANSWER.items() if k != "choice"},
            "choice C": {**ANSWER, "choice": "C"},
            "unknown scenario": {**ANSWER, "scenario_id": "nope"},
            "decision_ms text": {**ANSWER, "decision_ms": "fast"},
            "hover_ms wrong": {**ANSWER, "hover_ms": {"A": 1}},
            "changed_answer text": {**ANSWER, "changed_answer": "yes"},
        }
        for name, body in bad.items():
            with self.subTest(name):
                r = self.post("/response", body)
                self.assertEqual(r.status_code, 400)
                self.assertIn("error", r.json())
        r = self.client.post("/response", "hello", content_type="application/json")
        self.assertEqual(r.status_code, 400)
        self.assertEqual(Response.objects.count(), 0)

    def test_results_totals_and_averages(self):
        self.post("/response", ANSWER)
        self.post("/response", {**ANSWER, "choice": "A", "changed_answer": False, "decision_ms": 4000,
                                "hover_ms": {"A": 900, "B": 50}})
        [row] = self.client.get("/results").json()
        self.assertEqual(row["votes"], {"A": 1, "B": 1})
        self.assertEqual(row["answers"], 2)
        self.assertEqual(row["avg_decision_ms"], 6210)
        self.assertEqual(row["changed_rate"], 0.5)
        self.assertEqual(row["avg_hover_ms"], {"A": 2000, "B": 650})
        self.assertEqual(row["seeded"], 0)

    def test_wrong_method_is_refused(self):
        self.assertEqual(self.client.post("/scenarios").status_code, 405)
        self.assertEqual(self.client.get("/response").status_code, 405)

    # ---------- admin ----------

    def test_admin_needs_the_token(self):
        self.assertEqual(self.post("/admin/scenarios", SCENARIO).status_code, 401)
        self.assertEqual(self.post("/admin/scenarios", SCENARIO, token="wrong").status_code, 401)
        self.assertEqual(self.client.get("/admin/check", HTTP_X_ADMIN_TOKEN=TOKEN).status_code, 200)
        self.assertEqual(self.client.delete("/admin/scenarios/s1").status_code, 401)

    def test_create_replace_delete(self):
        created = self.post("/admin/scenarios", SCENARIO, token=TOKEN)
        self.assertEqual(created.status_code, 201)
        new_id = created.json()["id"]
        self.assertEqual(new_id, "s2")

        replaced = self.put(f"/admin/scenarios/{new_id}", {**SCENARIO, "title": "Renamed"})
        self.assertEqual(replaced.json()["title"], "Renamed")
        self.assertEqual(Scenario.objects.get(pk=new_id).data["title"], "Renamed")
        self.assertEqual(self.put("/admin/scenarios/s99", SCENARIO).status_code, 404)

        r = self.client.delete(f"/admin/scenarios/{new_id}", HTTP_X_ADMIN_TOKEN=TOKEN)
        self.assertEqual(r.json(), {"ok": True})
        self.assertEqual(self.client.delete(f"/admin/scenarios/{new_id}", HTTP_X_ADMIN_TOKEN=TOKEN).status_code, 404)

    def test_bad_scenarios_are_rejected(self):
        outcomes = SCENARIO["outcomes"]
        bad = {
            "light on passenger lane": {**SCENARIO, "signals": {"ahead": "green", "other": "red"}},
            "6 in a group": {**SCENARIO, "outcomes": {**outcomes, "stay": {"label": "S", "group": [{"type": "man", "fate": "killed"}] * 6}}},
            "unknown character": {**SCENARIO, "outcomes": {**outcomes, "stay": {"label": "S", "group": [{"type": "robot", "fate": "killed"}]}}},
            "fate injured": {**SCENARIO, "outcomes": {**outcomes, "stay": {"label": "S", "group": [{"type": "man", "fate": "injured"}]}}},
            "no title": {**SCENARIO, "title": "  "},
            "bad dilemma": {**SCENARIO, "dilemma": "trolley"},
            "empty road": {**SCENARIO, "outcomes": {"stay": {"label": "S", "group": []}, "swerve": {"label": "W", "group": []}}},
        }
        for name, body in bad.items():
            with self.subTest(name):
                self.assertEqual(self.post("/admin/scenarios", body, token=TOKEN).status_code, 400)

    def test_one_empty_side_is_allowed(self):
        body = {**SCENARIO, "signals": {"ahead": "none", "other": "none"},
                "outcomes": {**SCENARIO["outcomes"], "stay": {"label": "Stay", "group": []}}}
        self.assertEqual(self.post("/admin/scenarios", body, token=TOKEN).status_code, 201)

    def test_new_ids_skip_deleted_ids_that_have_answers(self):
        s2 = self.post("/admin/scenarios", SCENARIO, token=TOKEN).json()["id"]
        self.post("/response", {**ANSWER, "scenario_id": s2})
        self.client.delete(f"/admin/scenarios/{s2}", HTTP_X_ADMIN_TOKEN=TOKEN)
        self.assertEqual(self.post("/admin/scenarios", SCENARIO, token=TOKEN).json()["id"], "s3")

    # ---------- commands ----------

    def test_seed_responses_replaces_and_removes(self):
        call_command("seed_responses", 5, stdout=open("/dev/null", "w"))
        call_command("seed_responses", 5, stdout=open("/dev/null", "w"))  # replaces, doesn't add
        self.assertEqual(Response.objects.filter(session_id__startswith="seed-").count(), 5)
        self.assertEqual(self.client.get("/results").json()[0]["seeded"], 5)
        call_command("seed_responses", remove=True, stdout=open("/dev/null", "w"))
        self.assertEqual(Response.objects.count(), 0)
