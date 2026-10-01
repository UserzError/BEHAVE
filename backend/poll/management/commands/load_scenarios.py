"""manage.py load_scenarios - copies backend/scenarios.json into the database.

    venv/bin/python manage.py load_scenarios            # only if the database has no scenarios yet
    venv/bin/python manage.py load_scenarios --replace  # delete the database's scenarios and load the file
"""
import json

from django.conf import settings
from django.core.management.base import BaseCommand
from django.db import transaction

from poll.models import Scenario


class Command(BaseCommand):
    help = "Load scenarios from scenarios.json into the database."

    def add_arguments(self, parser):
        parser.add_argument("--replace", action="store_true", help="delete the scenarios in the database first")

    def handle(self, *args, replace=False, **options):
        if Scenario.objects.exists() and not replace:
            self.stdout.write("The database already has scenarios, so nothing was loaded. Use --replace to overwrite them.")
            return
        with open(settings.BASE_DIR / "scenarios.json") as f:
            scenarios = json.load(f)
        with transaction.atomic():  # all or nothing
            if replace:
                Scenario.objects.all().delete()
            for scenario in scenarios:  # one at a time, so they keep the file's order
                Scenario.objects.create(id=scenario["id"], data=scenario)
        self.stdout.write(self.style.SUCCESS(f"Loaded {len(scenarios)} scenarios from scenarios.json"))
