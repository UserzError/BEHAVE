"""manage.py trim_mouse_paths - deletes full mouse paths older than MOUSE_PATH_DAYS (default 30).

    venv/bin/python manage.py trim_mouse_paths            # older than MOUSE_PATH_DAYS
    venv/bin/python manage.py trim_mouse_paths --days 7   # older than 7 days
    venv/bin/python manage.py trim_mouse_paths --days 0   # all of them

Each answer keeps its path numbers (path_length, max_deviation, x_flips); only the point-by-point path
goes. The site also does this on its own, a few hundred answers at a time, as new answers come in.
PostgreSQL reuses the freed space for new data; the database file itself only shrinks after
VACUUM FULL (which locks the table while it runs).
"""
from django.conf import settings
from django.core.management.base import BaseCommand

from poll.queries import trim_mouse_paths


class Command(BaseCommand):
    help = "Delete full mouse paths older than MOUSE_PATH_DAYS, keeping each answer's path numbers."

    def add_arguments(self, parser):
        parser.add_argument("--days", type=int, help=f"default MOUSE_PATH_DAYS ({settings.MOUSE_PATH_DAYS})")

    def handle(self, *args, days=None, **options):
        days = settings.MOUSE_PATH_DAYS if days is None else days
        count = trim_mouse_paths(days)
        self.stdout.write(self.style.SUCCESS(f"Trimmed the mouse paths of {count} answers older than {days} days."))
