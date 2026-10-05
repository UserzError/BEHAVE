"""views.py - what happens at each address (see config/urls.py).

Each view reads the request, checks it with validate.py, uses the database (models.py), and
returns JSON. Errors come back as {"error": "..."} with a 4xx status, same as the Flask version.
"""
import hashlib
import hmac
import json
import random
import time
from datetime import datetime, timezone as dt_timezone

from django.conf import settings

from django.db import IntegrityError, connection, transaction
from django.utils import timezone
from django.http import FileResponse, HttpResponse, JsonResponse
from django.views.decorators.http import require_GET, require_http_methods, require_POST
from django.views.static import serve

from . import queries
from .trajectory import summarize
from .models import Response, Scenario
from .validate import validate_response, validate_scenario


def error(message, status=400):
    """Send back {"error": "..."} with a status code."""
    return JsonResponse({"error": message}, status=status)


def read_json(request):
    """The request body as Python data, or None if it isn't valid JSON."""
    try:
        return json.loads(request.body)
    except ValueError:
        return None


# ---------- The website ----------

def home(request):
    index = settings.FRONTEND_DIST / "index.html"
    if not index.exists():
        return HttpResponse("The site isn't built yet. Run `npm run build` in the frontend folder.", status=503)
    return FileResponse(open(index, "rb"), content_type="text/html")


def frontend_file(request, path):
    """Files from the built site. (Django's simple file server: fine for a demo; a big public site would
    let the web server or WhiteNoise do this.)"""
    return serve(request, path, document_root=settings.FRONTEND_DIST)


# ---------- Poll ----------

@require_GET
def scenarios(request):
    return JsonResponse([s.data for s in Scenario.objects.all()], safe=False)  # safe=False allows a list


def ip_fingerprint(request):
    """A one-way hash of the visitor's IP address, so the rate limit can tell visitors apart without
    storing their actual address. Keyed with SECRET_KEY, so it can't be reversed by guessing IPs."""
    digest = hmac.new(settings.SECRET_KEY.encode(), client_ip(request).encode(), hashlib.sha256)
    return digest.hexdigest()[:32]


def client_ip(request):
    """The visitor's IP address (see TRUST_X_FORWARDED_FOR in settings.py)."""
    if settings.TRUST_X_FORWARDED_FOR:
        forwarded = request.headers.get("X-Forwarded-For", "")
        if forwarded:
            return forwarded.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR", "unknown")


def over_rate_limit(request):
    """Count this answer against the visitor's IP; True if they've sent too many in this time window.

    The count lives in the rate_limits table, so all worker processes and servers share it. One SQL
    statement adds 1 and returns the new total atomically, so two requests at once can't both read the
    same old count.
    """
    window = settings.RESPONSE_RATE_WINDOW_SECONDS
    window_number = int(time.time() // window)
    key = f"answers:{ip_fingerprint(request)}:{window_number}"  # hashed: no raw IP is stored
    expires_at = datetime.fromtimestamp((window_number + 1) * window, tz=dt_timezone.utc)
    with connection.cursor() as cursor:
        cursor.execute(
            """INSERT INTO rate_limits (key, count, expires_at) VALUES (%s, 1, %s)
               ON CONFLICT (key) DO UPDATE SET count = rate_limits.count + 1
               RETURNING count""",
            [key, expires_at],
        )
        count = cursor.fetchone()[0]
        if random.random() < 0.01:  # now and then, throw away finished windows
            cursor.execute("DELETE FROM rate_limits WHERE expires_at < now()")
    return count > settings.RESPONSE_RATE_LIMIT


@require_POST
def response(request):
    if over_rate_limit(request):
        return error("Too many answers from your network. Please wait a few minutes and try again.", 429)
    data = read_json(request)
    problem = validate_response(data, lambda scenario_id: Scenario.objects.filter(pk=scenario_id).exists())
    if problem:
        return error(problem)
    path = data.get("mouse_path") or None
    path_summary = summarize(path, data.get("final_select_ms"))  # path_length, max_deviation, x_flips
    try:
        with transaction.atomic():  # so a refused duplicate doesn't break the rest of the request
            Response.objects.create(
                session_id=data["session_id"],
                scenario_id=data["scenario_id"],
                choice=data["choice"],
                first_choice=data.get("first_choice"),
                decision_ms=data["decision_ms"],
                hover_ms=data["hover_ms"],
                changed_answer=data["changed_answer"],
                stay_on_left=data.get("stay_on_left"),
                position=data.get("position"),
                mouse_path=path,
                final_select_ms=data.get("final_select_ms"),
                **path_summary,
            )
    except IntegrityError:
        # Already answered (a double click or a retried request): keep the first answer and say OK,
        # so the participant can carry on. See the one-answer-per-scenario rule in models.py.
        first = Response.objects.get(session_id=data["session_id"], scenario_id=data["scenario_id"])
        return JsonResponse({"ok": True, "already_answered": True, "saved_at": first.created_at.isoformat(),
                             "path": {"path_length": first.path_length, "max_deviation": first.max_deviation,
                                      "x_flips": first.x_flips}})
    # saved_at lets the results page know whether this answer is in a (cached) results snapshot yet;
    # path lets "How you compare" show your mouse-path measures without recalculating them.
    return JsonResponse({"ok": True, "saved_at": timezone.now().isoformat(), "path": path_summary})


@require_GET
def results(request):
    return JsonResponse(queries.cached_results(), safe=False)  # cached for RESULTS_CACHE_SECONDS


@require_GET
def insights(request):
    """Study-design checks for the results page (left/right choices, effects of position)."""
    return JsonResponse(queries.cached_insights())


# ---------- Admin (scenario designer) ----------

def admin_check_failed(request):
    """Returns an error response if the X-Admin-Token header is missing or wrong, otherwise None."""
    if not settings.ADMIN_TOKEN:
        return error("Admin is turned off: set ADMIN_TOKEN in backend/.env and restart.", 401)
    sent = request.headers.get("X-Admin-Token", "")
    # compare_digest avoids leaking how many characters matched
    if not hmac.compare_digest(sent.encode(), settings.ADMIN_TOKEN.encode()):
        return error("Wrong or missing admin token.", 401)
    return None


def clean_scenario(data, scenario_id):
    """Keep only the fields a scenario is allowed to have, and set its id."""
    return {
        "id": scenario_id,
        "title": data["title"].strip(),
        "description": data.get("description", "").strip(),
        "text": data.get("text") or "The car's brakes have failed. What should it do?",
        "dilemma": data["dilemma"],
        "signals": data["signals"],
        "outcomes": {
            name: {
                "label": outcome["label"].strip(),
                "group": [{"type": p["type"], "fate": p["fate"]} for p in outcome["group"]],
            }
            for name, outcome in data["outcomes"].items()
        },
    }


@require_GET
def admin_export_csv(request):
    """All answers as a CSV download. Simulated answers are left out unless ?simulated=1."""
    failed = admin_check_failed(request)
    if failed:
        return failed
    include_simulated = request.GET.get("simulated") == "1"
    reply = HttpResponse(content_type="text/csv; charset=utf-8")
    reply["Content-Disposition"] = 'attachment; filename="behave-answers.csv"'
    queries.write_answers_csv(reply, include_simulated)
    return reply


@require_GET
def admin_check(request):
    return admin_check_failed(request) or JsonResponse({"ok": True})


@require_POST
def admin_create_scenario(request):
    failed = admin_check_failed(request)
    if failed:
        return failed
    data = read_json(request)
    problem = validate_scenario(data)
    if problem:
        return error(problem)
    scenario = clean_scenario(data, queries.next_scenario_id())
    Scenario.objects.create(id=scenario["id"], data=scenario)
    return JsonResponse(scenario, status=201)


@require_http_methods(["PUT", "DELETE"])
def admin_scenario(request, scenario_id):
    failed = admin_check_failed(request)
    if failed:
        return failed
    existing = Scenario.objects.filter(pk=scenario_id).first()
    if existing is None:
        return error(f"There is no scenario with id {scenario_id!r}.", 404)

    if request.method == "DELETE":
        existing.delete()  # answers already given to it stay in the responses table
        return JsonResponse({"ok": True})

    # PUT: replace it
    data = read_json(request)
    problem = validate_scenario(data)
    if problem:
        return error(problem)
    scenario = clean_scenario(data, scenario_id)
    existing.data = scenario
    existing.save()
    return JsonResponse(scenario)
