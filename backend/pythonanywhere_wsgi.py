"""pythonanywhere_wsgi.py - what to paste into PythonAnywhere's WSGI configuration file.

PythonAnywhere doesn't run `python app.py`. Instead its web server imports a variable called
`application` from a WSGI file. Copy the lines below into that file (Web tab -> "WSGI configuration
file") and replace YOURNAME with your PythonAnywhere username. See DEPLOY.md for all the steps.
"""
import sys

# Where the backend code lives on PythonAnywhere (after `git clone` in your home folder).
BACKEND_FOLDER = "/home/YOURNAME/BEHAVE/backend"

if BACKEND_FOLDER not in sys.path:
    sys.path.insert(0, BACKEND_FOLDER)

from app import app as application  # noqa: E402  (the import has to come after the path is set)
