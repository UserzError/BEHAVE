#!/usr/bin/env python
"""manage.py - Django's command-line tool. Common commands (run from the backend folder):

    venv/bin/python manage.py migrate            create/update the database tables
    venv/bin/python manage.py load_scenarios     load scenarios.json into an empty database
    venv/bin/python manage.py seed_responses     add simulated answers for the results page
    venv/bin/python manage.py runserver 5000     start the backend on http://localhost:5000
    venv/bin/python manage.py test               run the backend tests
"""
import os
import sys

if __name__ == "__main__":
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
    from django.core.management import execute_from_command_line

    execute_from_command_line(sys.argv)
