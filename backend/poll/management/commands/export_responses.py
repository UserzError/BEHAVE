"""manage.py export_responses - saves every answer to a CSV file for analysis (Excel, Python, R...).

    venv/bin/python manage.py export_responses                        # real answers -> answers.csv
    venv/bin/python manage.py export_responses --include-simulated    # also the seed_responses ones
    venv/bin/python manage.py export_responses -o my-file.csv

The same file can be downloaded from the scenario designer ("Download answers (CSV)").
"""
from django.core.management.base import BaseCommand

from poll.queries import write_answers_csv


class Command(BaseCommand):
    help = "Write all answers to a CSV file."

    def add_arguments(self, parser):
        parser.add_argument("-o", "--output", default="answers.csv", help="file name (default answers.csv)")
        parser.add_argument("--include-simulated", action="store_true", help="also include simulated answers")

    def handle(self, *args, output="answers.csv", include_simulated=False, **options):
        with open(output, "w", newline="", encoding="utf-8") as f:
            count = write_answers_csv(f, include_simulated)
        self.stdout.write(self.style.SUCCESS(f"Wrote {count} answers to {output}"))
