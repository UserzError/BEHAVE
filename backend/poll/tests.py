"""tests.py - checks every address works. Run with:  venv/bin/python manage.py test

Django runs these against a temporary, empty test database (it doesn't touch your real data).
"""
import json

from django.core.cache import cache
from django.core.management import call_command
from django.test import TestCase, override_settings

from .models import RateLimit, Response, Scenario

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
        cache.clear()
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
        reply = self.post("/response", ANSWER).json()
        self.assertTrue(reply["ok"])
        self.assertIn("saved_at", reply)
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
        self.post("/response", {**ANSWER, "session_id": "def", "choice": "A", "changed_answer": False,
                                "decision_ms": 4000, "hover_ms": {"A": 900, "B": 50}})
        [row] = self.client.get("/results").json()
        self.assertEqual(row["votes"], {"A": 1, "B": 1, "I": 0})
        self.assertEqual(row["answers"], 2)
        self.assertEqual(row["avg_decision_ms"], 6210)
        self.assertEqual(row["changed_rate"], 0.5)
        self.assertEqual(row["avg_hover_ms"], {"A": 2000, "B": 650, "I": 0})
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
        reply = self.post(body)
        self.assertEqual(reply.status_code, 200)
        self.assertAlmostEqual(reply.json()["path"]["max_deviation"], 0.3, places=4)  # sent back to the page
        a = Response.objects.get()
        self.assertEqual((a.stay_on_left, a.position, a.final_select_ms), (False, 3, 200))
        self.assertEqual(len(a.mouse_path), 4)
        self.assertAlmostEqual(self.client.get("/results").json()[0]["paths"]["avg_max_deviation"], 0.3, places=3)
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
        codes = [self.post({**ANSWER, "session_id": f"person-{i}"}).status_code for i in range(5)]
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


# ---------- Indifferent ----------

@override_settings(ADMIN_TOKEN=TOKEN)
class IndifferentTests(TestCase):
    def setUp(self):
        cache.clear()
        Scenario.objects.create(id="s1", data={**SCENARIO, "id": "s1"})

    def post(self, body):
        return self.client.post("/response", json.dumps(body), content_type="application/json")

    def test_indifferent_answers_are_accepted_and_counted(self):
        self.assertEqual(self.post({**ANSWER, "choice": "I", "first_choice": "A",
                                    "hover_ms": {"A": 100, "B": 200, "I": 900}}).status_code, 200)
        self.assertEqual(self.post({**ANSWER, "session_id": "def", "choice": "A"}).status_code, 200)  # old two-key hover still fine
        [row] = self.client.get("/results").json()
        self.assertEqual(row["votes"], {"A": 1, "B": 0, "I": 1})
        self.assertEqual(row["avg_hover_ms"]["I"], 450)  # the old-style answer counts as 0

    def test_bad_values_are_rejected(self):
        self.assertEqual(self.post({**ANSWER, "choice": "C"}).status_code, 400)
        self.assertEqual(self.post({**ANSWER, "first_choice": "X"}).status_code, 400)
        self.assertEqual(self.post({**ANSWER, "hover_ms": {"A": 1, "B": 2, "X": 3}}).status_code, 400)

    def test_csv_has_indifferent(self):
        self.post({**ANSWER, "choice": "I", "hover_ms": {"A": 1, "B": 2, "I": 3}})
        lines = self.client.get("/admin/export.csv", HTTP_X_ADMIN_TOKEN=TOKEN).content.decode().splitlines()
        self.assertIn("hover_indifferent_ms", lines[0])
        self.assertIn(",I,indifferent,", lines[1])

    def test_simulated_answers_include_some_indifferent(self):
        call_command("seed_responses", 60, stdout=open("/dev/null", "w"))
        self.assertTrue(Response.objects.filter(choice="I").exists())


# ---------- scaling fixes: shared rate limit, cached results ----------

class ScalingTests(TestCase):
    def setUp(self):
        cache.clear()
        Scenario.objects.create(id="s1", data={**SCENARIO, "id": "s1"})

    def post(self, body=None, ip="10.0.0.1"):
        self.people = getattr(self, "people", 0) + 1  # a new participant for every call
        body = body or {**ANSWER, "session_id": f"person-{self.people}"}
        return self.client.post("/response", json.dumps(body), content_type="application/json", REMOTE_ADDR=ip)

    @override_settings(RESPONSE_RATE_LIMIT=2)
    def test_rate_limit_is_counted_in_the_database_per_ip(self):
        self.assertEqual([self.post().status_code for _ in range(3)], [200, 200, 429])
        self.assertEqual(self.post(ip="10.0.0.2").status_code, 200)  # another visitor has their own count
        self.assertFalse(RateLimit.objects.filter(key__contains="10.0.0.1").exists())  # no raw IP stored
        self.assertEqual(sorted(RateLimit.objects.values_list("count", flat=True)), [1, 3])  # one hashed key per IP

    @override_settings(RESULTS_CACHE_SECONDS=60)
    def test_results_are_cached_with_a_timestamp(self):
        saved_at = self.post().json()["saved_at"]
        first = self.client.get("/results").json()
        self.assertEqual(first[0]["answers"], 1)
        self.assertGreaterEqual(first[0]["computed_at"], saved_at)  # the snapshot includes that answer

        later = self.post().json()["saved_at"]
        cached = self.client.get("/results").json()
        self.assertEqual(cached[0]["answers"], 1)  # still the cached snapshot...
        self.assertLess(cached[0]["computed_at"], later)  # ...and its timestamp says the new answer isn't in it

    @override_settings(RESULTS_CACHE_SECONDS=0)
    def test_cache_can_be_turned_off(self):
        self.post()
        self.client.get("/results")
        self.post()
        self.assertEqual(self.client.get("/results").json()[0]["answers"], 2)


# ---------- one answer per participant per scenario ----------

class OneAnswerTests(TestCase):
    def setUp(self):
        cache.clear()
        Scenario.objects.create(id="s1", data={**SCENARIO, "id": "s1"})

    def post(self, body):
        return self.client.post("/response", json.dumps(body), content_type="application/json")

    def test_a_repeat_keeps_the_first_answer_and_still_says_ok(self):
        first = self.post({**ANSWER, "choice": "A"}).json()
        again = self.post({**ANSWER, "choice": "B"})  # double click / retry with a different choice
        self.assertEqual(again.status_code, 200)
        self.assertTrue(again.json()["already_answered"])
        self.assertEqual(Response.objects.count(), 1)
        self.assertEqual(Response.objects.get().choice, "A")
        self.assertLessEqual(again.json()["saved_at"], first["saved_at"])  # points at the original answer

    def test_same_person_can_answer_other_scenarios(self):
        Scenario.objects.create(id="s2", data={**SCENARIO, "id": "s2"})
        self.post(ANSWER)
        self.assertNotIn("already_answered", self.post({**ANSWER, "scenario_id": "s2"}).json())
        self.assertEqual(Response.objects.count(), 2)


# ---------- insights and path averages ----------

class InsightsTests(TestCase):
    def setUp(self):
        cache.clear()
        Scenario.objects.create(id="s1", data={**SCENARIO, "id": "s1"})
        Scenario.objects.create(id="s2", data={**SCENARIO, "id": "s2"})

    def post(self, **fields):
        body = {**ANSWER, **fields}
        return self.client.post("/response", json.dumps(body), content_type="application/json")

    def test_left_side_share_and_positions(self):
        # chose A shown on the left; chose B shown on the left; chose A shown on the right; indifferent
        self.post(session_id="p1", scenario_id="s1", choice="A", stay_on_left=True, position=1, decision_ms=3000)
        self.post(session_id="p2", scenario_id="s1", choice="B", stay_on_left=False, position=1, decision_ms=1000)
        self.post(session_id="p3", scenario_id="s1", choice="A", stay_on_left=False, position=2, decision_ms=5000)
        self.post(session_id="p4", scenario_id="s1", choice="I", stay_on_left=True, position=2, decision_ms=7000)
        data = self.client.get("/insights").json()
        self.assertEqual({k: data["side"][k] for k in ("answers", "chose_left")}, {"answers": 3, "chose_left": 2})
        self.assertAlmostEqual(data["side"]["left_share"], 0.667, places=3)
        self.assertEqual([(p["position"], p["answers"], p["avg_decision_ms"]) for p in data["by_position"]],
                         [(1, 2, 2000), (2, 2, 6000)])
        self.assertEqual(data["by_position"][1]["indifferent_rate"], 0.5)

    def test_results_include_path_averages(self):
        self.post(session_id="p1", mouse_path=[[0, 0.0, 0.5], [100, 0.5, 0.2], [200, 1.0, 0.5]], final_select_ms=200)
        self.post(session_id="p2")  # no path (touch screen)
        [row] = self.client.get("/results").json()
        self.assertEqual(row["paths"]["answers"], 1)
        self.assertAlmostEqual(row["paths"]["avg_max_deviation"], 0.3, places=3)
