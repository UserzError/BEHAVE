"""gunicorn.conf.py - settings for running the backend in production with gunicorn (Linux/macOS hosts).

    venv/bin/gunicorn config.wsgi

Django's `runserver` is only for development: it opens one database connection per request it's handling,
so a busy moment can hit PostgreSQL's connection limit (100 by default). gunicorn runs a fixed number of
worker processes, each with a few threads, so the number of connections stays capped.
(gunicorn doesn't run on Windows; use runserver there for development.)
"""
import multiprocessing
import os

# Where to listen. Hosting platforms usually set PORT.
bind = f"{os.environ.get('HOST', '127.0.0.1')}:{os.environ.get('PORT', '5000')}"

# Worker processes x threads = how many requests can be handled at once. Each thread can hold one database
# connection, so keep workers * threads well under PostgreSQL's max_connections (100 by default).
workers = int(os.environ.get("WEB_CONCURRENCY", min(2 * multiprocessing.cpu_count() + 1, 9)))
threads = int(os.environ.get("GUNICORN_THREADS", 4))
worker_class = "gthread"
backlog = 2048          # how many connections may wait for a free worker
timeout = 30            # restart a worker stuck on one request for longer than this
accesslog = "-"         # log requests to the terminal

# Under gunicorn, keep each thread's database connection open between requests instead of reconnecting
# every time (unless .env says otherwise). settings.py reads this.
os.environ.setdefault("DB_CONN_MAX_AGE", "60")
