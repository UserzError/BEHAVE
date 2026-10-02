# Hosting the Django + PostgreSQL version

The whole site (React pages + Django API) runs as one Django app, and it needs a **PostgreSQL database** that
the host keeps running. That's the main thing to check when choosing a host:

- **PythonAnywhere:** Postgres is a **paid add-on** (not included in the free plan). The steps below use it.
- **Other hosts** with a free or cheap managed Postgres (Render, Railway, Fly.io, …) work too: the same settings
  apply, but the clicks differ. Avoid hosts whose disk is wiped on restart *unless* the database is a separate
  managed Postgres service.

> These steps haven't been tried on a live host yet. If something doesn't match, the host's error log usually says why.

Replace `YOURNAME` below with your PythonAnywhere username.

## 1. On your computer: get the code ready

Do this whenever you change the site or the scenarios, then update the server (step 4).

1. **Save your scenarios into `scenarios.json`.** The designer saves them in your local database, which isn't in
   git. A new server loads `scenarios.json` instead:
   ```bash
   cd backend
   venv/bin/python manage.py export_scenarios
   ```
2. **Build the React site.** The server can't run `npm`, so the built files (`frontend/dist/`) go into git. They're
   normally ignored, so add them with `-f`:
   ```bash
   cd ../frontend
   npm run build
   cd ..
   git add backend/scenarios.json
   git add -f frontend/dist
   git commit -m "Update build and scenarios"
   git push
   ```

## 2. On PythonAnywhere: database and code (first time)

1. On the **Databases** tab, set up **Postgres** (paid add-on). Note the **address**, **port** and the
   **superuser password** it shows.
2. Open **Consoles → Bash** and create the database (use the address/port from step 1):
   ```bash
   createdb -h YOUR_PG_ADDRESS -p YOUR_PG_PORT -U super behave
   ```
3. Get the code and install it:
   ```bash
   git clone https://github.com/UserzError/BEHAVE.git
   cd BEHAVE/backend
   python3.12 -m venv venv
   venv/bin/pip install -r requirements.txt
   ```
   If the GitHub repo is private, use your GitHub username and a
   [personal access token](https://github.com/settings/tokens) as the password.
4. Create `backend/.env` with the server's settings (new random values; don't reuse your laptop's):
   ```bash
   cat > .env <<EOF
   ADMIN_TOKEN=$(python3 -c 'import secrets; print(secrets.token_urlsafe(24))')
   DJANGO_SECRET_KEY=$(python3 -c 'import secrets; print(secrets.token_urlsafe(50))')
   DJANGO_DEBUG=false
   DJANGO_ALLOWED_HOSTS=YOURNAME.pythonanywhere.com
   POSTGRES_DB=behave
   POSTGRES_USER=super
   POSTGRES_PASSWORD=YOUR_PG_PASSWORD
   POSTGRES_HOST=YOUR_PG_ADDRESS
   POSTGRES_PORT=YOUR_PG_PORT
   TRUST_X_FORWARDED_FOR=true
   DB_CONN_MAX_AGE=60
   EOF
   grep ADMIN_TOKEN .env   # copy this value somewhere safe: it unlocks the scenario designer
   ```
5. Create the tables and load the scenarios:
   ```bash
   venv/bin/python manage.py migrate
   venv/bin/python manage.py load_scenarios
   venv/bin/python manage.py seed_responses   # optional: simulated answers, tagged as simulated
   ```

## 3. On PythonAnywhere: create the web app

1. **Web** tab → **Add a new web app** → **Manual configuration** (not "Django") → **Python 3.12**.
2. On the web app page:
   - **Virtualenv:** `/home/YOURNAME/BEHAVE/backend/venv`
   - **WSGI configuration file:** click the link, delete everything in it, and paste:
     ```python
     import os
     import sys

     sys.path.insert(0, "/home/YOURNAME/BEHAVE/backend")
     os.environ["DJANGO_SETTINGS_MODULE"] = "config.settings"

     from django.core.wsgi import get_wsgi_application
     application = get_wsgi_application()
     ```
3. Click the green **Reload** button.
4. Open `https://YOURNAME.pythonanywhere.com`.
   - Scenario designer: `/#/admin` (the `ADMIN_TOKEN` from step 2.4)
   - Results: `/#/results`

## On other hosts (Render, Railway, Fly.io, a VPS…)

These run your own start command instead of a WSGI file. Use gunicorn (already in `requirements.txt`; its settings
are in `backend/gunicorn.conf.py`), from the `backend` folder:
```bash
HOST=0.0.0.0 venv/bin/gunicorn config.wsgi
```
It reads the port from `PORT` (most hosts set this automatically). Set the same `.env` values as above as the
host's environment variables, and run `manage.py migrate` and `manage.py load_scenarios` once.
Keep `WEB_CONCURRENCY` x `GUNICORN_THREADS` (default 9 x 4) under your Postgres plan's connection limit;
small hosted databases often allow only 20–25 connections, so something like `WEB_CONCURRENCY=3` may be needed.

## 4. Updating the live site later

After pushing new changes (step 1), in a PythonAnywhere Bash console:
```bash
cd ~/BEHAVE && git pull
cd backend && venv/bin/python manage.py migrate   # only does anything if the tables changed
```
then click **Reload** in the Web tab.

Scenarios already in the live database are **not** replaced by a new `scenarios.json`. To edit live scenarios, use
the live designer at `/#/admin`, or replace them all with `venv/bin/python manage.py load_scenarios --replace`.

## Resetting the answers (e.g. before a demo)

```bash
cd ~/BEHAVE/backend
venv/bin/python manage.py shell -c "from poll.models import Response; Response.objects.all().delete()"
venv/bin/python manage.py seed_responses   # optional: add the simulated answers back
```

## Good to know

- **Anyone can see the results page**, and anyone who finds `/#/admin` sees the token prompt. They can't change
  anything without the token, so keep it private.
- **Keep `DJANGO_DEBUG=false` on a public site.** With debug on, error pages show your settings and code.
- **Something broken?** The Web tab has an **Error log** link. Common causes: a typo in the WSGI file path,
  `DJANGO_ALLOWED_HOSTS` not matching the site's address (gives "Bad Request (400)"), or wrong Postgres settings.
- The built React files are served by Django itself, which is fine for a demo-sized site.
