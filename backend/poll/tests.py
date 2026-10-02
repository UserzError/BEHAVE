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


# ---------- study design, mouse tracking, rate limit, CSV ----------

from django.core.cache import cache  # noqa: E402

from .trajectory import summarize  # noqa: E402


class TrajectoryTests(TestCase):
    def test_straight_path(self):
        m = summarize([[0, 0.1, 0.5], [100, 0.5, 0.5], [200, 0.9, 0.5]])
        self.assertEqual((m["path_length"], m["max_deviation"], m["x_flips"]), (0.8, 0.0, 0))

    def test_curved_path_deviates(self):
        # starts left, bulges up, ends right
        m = summarize([[0, 0.0, 0.5], [100, 0.5, 0.2], [200, 1.0, 0.5]])
        self.assertAlmostEqual(m["max_deviation"], 0.3, places=4)

    def test_wavering_counts_direction_changes(self):
        path = [[0, 0.5, 0.5], [50, 0.8, 0.5], [100, 0.3, 0.5], [150, 0.9, 0.5]]  # right, left, right
        self.assertEqual(summarize(path)["x_flips"], 2)

    def test_only_up_to_the_final_click(self):
        path = [[0, 0.1, 0.5], [100, 0.9, 0.5], [500, 0.1, 0.5]]  # wandered back after choosing
        self.assertEqual(summarize(path, final_select_ms=100)["path_length"], 0.8)

    def test_too_little_movement(self):
        self.assertIsNone(summarize([])["path_length"])
        self.assertIsNone(summarize([[0, 0.5, 0.5]])["max_deviation"])


@override_settings(ADMIN_TOKEN=TOKEN)
class NewFieldsTests(TestCase):
    def setUp(self):
        cache.clear()
        Scenario.objects.create(id="s1", data={**SCENARIO, "id": "s1"})

    def post(self, body):
        return self.client.post("/response", json.dumps(body), content_type="application/json")

    def test_layout_position_and_path_are_saved(self):
        body = {**ANSWER, "stay_on_left": False, "position": 3, "final_select_ms": 200,
                "mouse_path": [[0, 0.0, 0.5], [100, 0.5, 0.2], [200, 1.0, 0.5], [300, 0.0, 0.0]]}
        self.assertEqual(self.post(body).status_code, 200)
        a = Response.objects.get()
        self.assertEqual((a.stay_on_left, a.position, a.final_select_ms), (False, 3, 200))
        self.assertEqual(len(a.mouse_path), 4)
        self.assertAlmostEqual(a.max_deviation, 0.3, places=4)  # measured only up to the final click
        self.assertEqual(a.x_flips, 0)

    def test_old_clients_without_new_fields_still_work(self):
        self.assertEqual(self.post(ANSWER).status_code, 200)
        a = Response.objects.get()
        self.assertIsNone(a.stay_on_left)
        self.assertIsNone(a.path_length)

    def test_bad_new_fields_are_rejected(self):
        for name, extra in {
            "stay_on_left text": {"stay_on_left": "yes"},
            "position 0": {"position": 0},
            "path not a list": {"mouse_path": "abc"},
            "point too short": {"mouse_path": [[0, 1]]},
            "point out of range": {"mouse_path": [[0, 99, 0.5]]},
            "too many points": {"mouse_path": [[i, 0.5, 0.5] for i in range(601)]},
        }.items():
            with self.subTest(name):
                self.assertEqual(self.post({**ANSWER, **extra}).status_code, 400)

    @override_settings(RESPONSE_RATE_LIMIT=3)
    def test_rate_limit(self):
        codes = [self.post(ANSWER).status_code for _ in range(5)]
        self.assertEqual(codes, [200, 200, 200, 429, 429])
        self.assertEqual(Response.objects.count(), 3)

    def test_csv_export(self):
        self.post({**ANSWER, "stay_on_left": True, "position": 1})
        call_command("seed_responses", 2, stdout=open("/dev/null", "w"))
        self.assertEqual(self.client.get("/admin/export.csv").status_code, 401)

        real = self.client.get("/admin/export.csv", HTTP_X_ADMIN_TOKEN=TOKEN)
        self.assertEqual(real["Content-Type"], "text/csv; charset=utf-8")
        lines = real.content.decode().strip().splitlines()
        self.assertEqual(len(lines), 2)  # header + the one real answer
        self.assertIn("stay_on_left", lines[0])
        self.assertIn("Doctors vs. passengers", lines[1])

        everything = self.client.get("/admin/export.csv?simulated=1", HTTP_X_ADMIN_TOKEN=TOKEN)
        self.assertEqual(len(everything.content.decode().strip().splitlines()), 1 + 1 + 2)

    def test_seeded_answers_get_layout_and_position(self):
        call_command("seed_responses", 3, stdout=open("/dev/null", "w"))
        seeded = Response.objects.filter(session_id__startswith="seed-")
        self.assertFalse(seeded.filter(stay_on_left__isnull=True).exists())
        self.assertEqual(sorted(seeded.filter(session_id="seed-0000").values_list("position", flat=True)), [1])
        self.assertTrue(all(a.mouse_path is None for a in seeded))
