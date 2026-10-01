"""manage.py export_scenarios - copies the scenarios from the database into backend/scenarios.json.

Why: the designer saves scenarios into the database, which isn't in git. A new computer or server
starts by loading scenarios.json, so after designing scenarios, run this and commit scenarios.json.
"""
import json

from django.conf import settings
from django.core.management.base import BaseCommand

from poll.models import Scenario


class Command(BaseCommand):
    help = "Write the database's scenarios to scenarios.json."

    def handle(self, *args, **options):
        scenarios = [s.data for s in Scenario.objects.all()]
        with open(settings.BASE_DIR / "scenarios.json", "w") as f:
            json.dump(scenarios, f, indent=2)
            f.write("\n")
        self.stdout.write(self.style.SUCCESS(f"Wrote {len(scenarios)} scenarios to scenarios.json"))
