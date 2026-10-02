"""settings.py - Django settings for the BEHAVE backend.

Anything that differs between computers (database login, admin token, secret key) is read from
backend/.env, so it stays out of git. See backend/.env.example for the full list.
"""
import getpass
import os
from pathlib import Path

from django.core.exceptions import ImproperlyConfigured

BASE_DIR = Path(__file__).resolve().parent.parent      # the backend/ folder
FRONTEND_DIST = BASE_DIR.parent / "frontend" / "dist"  # the built React site (npm run build)


def load_env_file(path):
    """Read KEY=value lines from backend/.env into the environment."""
    if not path.exists():
        return
    raw = path.read_bytes()
    # Windows PowerShell often saves text as UTF-16 or as UTF-8 with a hidden marker (BOM) at the start.
    if raw.startswith((b"\xff\xfe", b"\xfe\xff")):
        text = raw.decode("utf-16")
    else:
        text = raw.decode("utf-8-sig")
    for line in text.splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


load_env_file(BASE_DIR / ".env")


def env(name, default=""):
    return os.environ.get(name, default)


# ---------- Basics ----------

DEBUG = env("DJANGO_DEBUG", "true").lower() == "true"  # set DJANGO_DEBUG=false when hosting

SECRET_KEY = env("DJANGO_SECRET_KEY")
if not SECRET_KEY:
    if not DEBUG:
        raise ImproperlyConfigured("Set DJANGO_SECRET_KEY in backend/.env before running with DEBUG off.")
    SECRET_KEY = "dev-only-not-secret"  # fine on your own computer, never for a public site

ALLOWED_HOSTS = [h.strip() for h in env("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1").split(",") if h.strip()]

# Password for the scenario designer's API (sent in the X-Admin-Token header).
ADMIN_TOKEN = env("ADMIN_TOKEN")

# Spam protection for POST /response: at most this many answers per IP address per window.
# A full poll is ~12 answers, and many people can share one IP (school/event wifi), so it's generous.
RESPONSE_RATE_LIMIT = int(env("RESPONSE_RATE_LIMIT", "300"))
RESPONSE_RATE_WINDOW_SECONDS = int(env("RESPONSE_RATE_WINDOW_SECONDS", "600"))
# /results is cached for this many seconds, so a busy results page doesn't recount every answer on each
# view (0 turns the cache off). Each answer and each results snapshot carry a timestamp, so the
# "How you compare" page knows whether your own answer is already in the totals.
RESULTS_CACHE_SECONDS = int(env("RESULTS_CACHE_SECONDS", "15"))
# Behind a hosting proxy every request seems to come from the proxy; set this to true there so the
# visitor's real address is read from the X-Forwarded-For header instead.
TRUST_X_FORWARDED_FOR = env("TRUST_X_FORWARDED_FOR", "false").lower() == "true"

# ---------- What Django loads ----------

# Just our app. We don't use Django's login system or its admin site
# (its usual /admin/ address is taken by the scenario designer's API).
INSTALLED_APPS = ["poll"]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",  # other sites can't show ours inside a frame
    # No CSRF middleware: this is a JSON API with no cookies or logins. Admin requests are
    # protected by the X-Admin-Token header instead.
]
SILENCED_SYSTEM_CHECKS = ["security.W003"]  # the "no CSRF middleware" warning; see the comment above

ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"
APPEND_SLASH = False  # our addresses have no trailing slash (/scenarios, not /scenarios/)

# ---------- Database (PostgreSQL) ----------

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": env("POSTGRES_DB", "behave"),
        "USER": env("POSTGRES_USER", getpass.getuser()),  # Homebrew's Postgres uses your Mac username
        "PASSWORD": env("POSTGRES_PASSWORD"),
        "HOST": env("POSTGRES_HOST", "localhost"),
        "PORT": env("POSTGRES_PORT", "5432"),
        # Keep a connection open between requests for this many seconds (0 = reconnect each time).
        # gunicorn.conf.py sets 60; runserver should stay at 0 (it uses a new thread per request).
        "CONN_MAX_AGE": int(env("DB_CONN_MAX_AGE", "0")),
        "CONN_HEALTH_CHECKS": True,  # check a reused connection still works before using it
    }
}

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

USE_TZ = True
TIME_ZONE = "UTC"
