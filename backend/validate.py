"""validate.py - checks data sent to the server before we save it.

Each function returns an error message (a string) if something is wrong, or None if it's fine.
The routes in app.py send that message back with a 400 status.
"""

# Must match the ids in frontend/src/characters.jsx
CHARACTER_TYPES = {
    "man", "woman", "boy", "girl", "elderly_man", "elderly_woman",
    "large_man", "large_woman", "executive_m", "executive_f",
    "doctor_m", "doctor_f", "athlete_m", "athlete_f",
    "pregnant", "criminal", "homeless", "baby", "dog", "cat",
}

# For each dilemma type, where each outcome's group is (must match frontend/src/scene.js):
#   "ahead" = pedestrians in the car's lane, "other" = pedestrians in the other lane, "car" = passengers
DILEMMAS = {
    "peds_vs_peds": {"stay": "ahead", "swerve": "other"},
    "peds_ahead_vs_car": {"stay": "ahead", "swerve": "car"},
    "car_vs_peds_other": {"stay": "car", "swerve": "other"},
}

SIGNALS = {"none", "green", "red"}
FATES = {"killed"}  # people are either killed or fine; only the killed ones are listed
MAX_GROUP = 5


def is_whole_number(value):
    # bool is a kind of int in Python, so rule it out explicitly
    return isinstance(value, int) and not isinstance(value, bool)


def validate_response(data, scenario_exists):
    """Check one POST /response body. scenario_exists is a function: id -> True/False."""
    if not isinstance(data, dict):
        return "Send the response as a JSON object."

    required = ["session_id", "scenario_id", "choice", "decision_ms", "hover_ms", "changed_answer"]
    missing = [field for field in required if field not in data]
    if missing:
        return "Missing field(s): " + ", ".join(missing)

    if not isinstance(data["session_id"], str) or not 1 <= len(data["session_id"]) <= 64:
        return "session_id must be text, 1 to 64 characters."
    # "I" = Indifferent: the participant doesn't prefer either outcome.
    if data["choice"] not in ("A", "B", "I"):
        return 'choice must be "A", "B" or "I" (indifferent).'
    if data.get("first_choice") not in ("A", "B", "I", None):
        return 'first_choice must be "A", "B", "I" or null.'
    if not is_whole_number(data["decision_ms"]) or data["decision_ms"] < 0:
        return "decision_ms must be a whole number of milliseconds (0 or more)."

    hover = data["hover_ms"]
    # "I" (time on the Indifferent button) is optional, so older versions of the poll still work.
    if not isinstance(hover, dict) or set(hover) not in ({"A", "B"}, {"A", "B", "I"}):
        return 'hover_ms must look like {"A": 1200, "B": 800, "I": 150}.'
    if not all(is_whole_number(v) and v >= 0 for v in hover.values()):
        return "hover_ms values must be whole numbers of milliseconds (0 or more)."

    if not isinstance(data["changed_answer"], bool):
        return "changed_answer must be true or false."
    if not scenario_exists(data["scenario_id"]):
        return f"There is no scenario with id {data['scenario_id']!r}."
    return None


def validate_scenario(data):
    """Check a scenario sent by the designer (POST or PUT /admin/scenarios)."""
    if not isinstance(data, dict):
        return "Send the scenario as a JSON object."

    title = data.get("title")
    if not isinstance(title, str) or not title.strip():
        return "The scenario needs a title."
    if len(title) > 100:
        return "The title can be at most 100 characters."
    for field, limit in (("description", 300), ("text", 200)):
        if field in data and (not isinstance(data[field], str) or len(data[field]) > limit):
            return f"{field} must be text, at most {limit} characters."

    dilemma = data.get("dilemma")
    if dilemma not in DILEMMAS:
        return "dilemma must be one of: " + ", ".join(DILEMMAS)

    outcomes = data.get("outcomes")
    if not isinstance(outcomes, dict) or set(outcomes) != {"stay", "swerve"}:
        return 'outcomes must have exactly "stay" and "swerve".'
    for name, outcome in outcomes.items():
        if not isinstance(outcome, dict):
            return f"outcomes.{name} must be an object."
        label = outcome.get("label")
        if not isinstance(label, str) or not label.strip() or len(label) > 80:
            return f"outcomes.{name}.label must be text, 1 to 80 characters."
        group = outcome.get("group")
        # A group can be empty (nobody is hurt that way), but see the "empty road" check below.
        if not isinstance(group, list) or len(group) > MAX_GROUP:
            return f"outcomes.{name}.group must be a list of 0 to {MAX_GROUP} characters."
        for person in group:
            if not isinstance(person, dict) or person.get("type") not in CHARACTER_TYPES:
                return f"outcomes.{name}.group has an unknown character type: {person!r}"
            if person.get("fate") not in FATES:
                return f'outcomes.{name}.group: fate must be "killed".'

    # One side may be empty, but not both: the road can't be empty.
    if not outcomes["stay"]["group"] and not outcomes["swerve"]["group"]:
        return "Stay and Swerve can't both be empty: add at least one character."

    signals = data.get("signals")
    if not isinstance(signals, dict) or set(signals) != {"ahead", "other"}:
        return 'signals must have exactly "ahead" and "other".'
    # A lane only has a road light if people are actually crossing in it
    # (not a barrier lane, and not a lane left empty).
    lanes_with_people = {
        place for name, place in DILEMMAS[dilemma].items()
        if place != "car" and outcomes[name]["group"]
    }
    for lane, value in signals.items():
        if value not in SIGNALS:
            return f"signals.{lane} must be none, green or red."
        if lane not in lanes_with_people and value != "none":
            return f"signals.{lane} must be none: nobody is crossing in that lane."
    return None
