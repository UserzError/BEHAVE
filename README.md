## **B**ehavioral **E**valuation of **H**uman **A**ttitudes towards **V**ehicle **E**thics
*A project from hackUMBC '26, Inspired by* [moralmachine.net](https://www.moralmachine.net). 

This tool is intended to demonstrate the potential methods for polling for public consensus on autonomous vehicle ethics. Our website builds upon previous tools by tracking telemetry such as question dwell time and whether someone switched answers, along with a modern aesthetic.

Demonstration: https://youtu.be/XgMI82CFvCY?is=2KBMzWzaALXyrDO6

For our stack, we are using React.js for the frontend, and we are using Django and PostgreSQL on the backend.

### Disclaimers:

- We used AI (Opus 5.5) in the process of building this website; for the majority of the frontend, and assisting with designing and orchestrating the backend. AI was not used in deciding the designs of the poll scenarios themselves.

- We are not using the data compiled from testing or demonstrations for any research whatsoever.

## Running it locally

### 1. Install the tools

You need these installed once:

- [Python 3.10+](https://www.python.org/downloads/) (3.12 recommended)
- [PostgreSQL 17](https://www.postgresql.org/download/)
- [Node.js 18+](https://nodejs.org/) (includes npm)
- [Git](https://git-scm.com/downloads)

**macOS (Homebrew):**
```bash
brew install python@3.12 postgresql@17 node git
```

**Windows:** install Python 3.12, Node.js and Git in PowerShell, then PostgreSQL 17 with the
[official installer](https://www.postgresql.org/download/windows/). The installer asks you to choose a password for
the `postgres` user; remember it.
```powershell
winget install Python.Python.3.12
winget install OpenJS.NodeJS.LTS
winget install Git.Git
```
Then close and reopen PowerShell.

### 2. Start PostgreSQL and create the database (once)

**macOS:** start Postgres (you'll repeat this line after restarting your computer), then create the `behave` database:
```bash
LC_ALL="en_US.UTF-8" /opt/homebrew/opt/postgresql@17/bin/pg_ctl -D /opt/homebrew/var/postgresql@17 -l /opt/homebrew/var/log/postgresql@17.log start
/opt/homebrew/opt/postgresql@17/bin/createdb behave
```
(To have it start automatically at login instead: `brew services start postgresql@17`.)

**Windows:** the installer already runs Postgres as a service. Create the database (it asks for the password you chose):
```powershell
& "C:\Program Files\PostgreSQL\17\bin\createdb.exe" -U postgres behave
```

### 3. Set up and start the backend (terminal 1)

The backend is a Django server on port 5000, using the PostgreSQL database `behave`.

**macOS / Linux**
```bash
git clone -b django-postgres https://github.com/UserzError/BEHAVE.git
cd BEHAVE/backend
python3.12 -m venv venv
venv/bin/pip install -r requirements.txt
echo "ADMIN_TOKEN=$(venv/bin/python -c 'import secrets; print(secrets.token_urlsafe(24))')" > .env
venv/bin/python manage.py migrate            # create the tables
venv/bin/python manage.py load_scenarios     # load the scenarios from scenarios.json
venv/bin/python manage.py seed_responses     # optional: simulated answers for the results page
venv/bin/python manage.py runserver 5000
```

**Windows (PowerShell)** (replace `YOUR_POSTGRES_PASSWORD` with the password you chose)
```powershell
git clone -b django-postgres https://github.com/UserzError/BEHAVE.git
cd BEHAVE\backend
py -3.12 -m venv venv
venv\Scripts\python -m pip install -r requirements.txt
$token = venv\Scripts\python -c "import secrets; print(secrets.token_urlsafe(24))"
Set-Content -Path .env -Value "ADMIN_TOKEN=$token`nPOSTGRES_USER=postgres`nPOSTGRES_PASSWORD=YOUR_POSTGRES_PASSWORD" -Encoding ascii
venv\Scripts\python manage.py migrate
venv\Scripts\python manage.py load_scenarios
venv\Scripts\python manage.py seed_responses
venv\Scripts\python manage.py runserver 5000
```

Leave it running.

### 4. Start the website (terminal 2)

**macOS / Linux**
```bash
cd BEHAVE/frontend
npm install
npm run dev
```

**Windows (PowerShell)**
```powershell
cd BEHAVE\frontend
npm.cmd install
npm.cmd run dev
```

### 5. Open it

| Page | Address |
|---|---|
| Poll (front page) | http://localhost:5173 |
| Results | http://localhost:5173/#/results |
| Scenario designer | http://localhost:5173/#/admin |

The designer asks for the admin token: the value after `ADMIN_TOKEN=` in `backend/.env` (`cat backend/.env`, or `Get-Content backend\.env` on Windows).

### Next time

Start Postgres (macOS, if it isn't running), then one command per terminal:

```bash
cd BEHAVE/backend && venv/bin/python manage.py runserver 5000   # Windows: cd BEHAVE\backend; venv\Scripts\python manage.py runserver 5000
cd BEHAVE/frontend && npm run dev                               # Windows: cd BEHAVE\frontend; npm.cmd run dev
```

### Good to know

All of these run in `backend/` (on Windows use `venv\Scripts\python` instead of `venv/bin/python`):

| Command | What it does |
|---|---|
| `venv/bin/python manage.py export_scenarios` | Copies the scenarios you designed (they're saved in the database, which isn't in git) into `scenarios.json`, so you can commit them |
| `venv/bin/python manage.py load_scenarios --replace` | Replaces the database's scenarios with the ones in `scenarios.json` |
| `venv/bin/python manage.py seed_responses` | Adds 40 simulated people who answer every scenario, so "How you compare" has something to compare against. They're tagged as simulated, the results page says how many there are, and `--remove` deletes them |
| `venv/bin/python manage.py export_responses` | Saves every real answer to `answers.csv` for analysis (`--include-simulated` adds the simulated ones). The designer has the same download: **Download answers (CSV)** |
| `venv/bin/python manage.py test` | Runs the backend tests (on a temporary test database) |

- **Starting fresh:** `/opt/homebrew/opt/postgresql@17/bin/dropdb behave`, then `createdb behave` and the `migrate` / `load_scenarios` steps again.
- **Frontend tests:** `npm test` in `frontend/`.
- **What's recorded per answer:** the choice (stay, swerve, or **Indifferent**), decision time, hover time on each option (including the Indifferent button), whether they changed their mind, which side "stay" was shown on (sides are randomized per scenario), the scenario's position in the poll, and the mouse path with three summary measures (path length, maximum deviation from a straight line, and left/right direction changes). See `backend/poll/models.py`.
- **Spam protection:** `POST /response` accepts at most 300 answers per IP address per 10 minutes (`RESPONSE_RATE_LIMIT` in `.env`). The count is kept in the database, so it holds across several worker processes or servers.
- **Results cache:** `/results` is cached for 15 seconds (`RESULTS_CACHE_SECONDS`), so new answers appear on the results page within that time.
- **Production server:** `runserver` is for development only. On a Linux or macOS server, run `venv/bin/gunicorn config.wsgi` instead (settings in `backend/gunicorn.conf.py`; port from `PORT`). In a local load test, gunicorn handled about 2,500 requests per second with no errors at 400 simultaneous participants, while `runserver` started failing at 200 (Postgres ran out of connections).
- **Database settings** (user, password, host) go in `backend/.env`; see `backend/.env.example`.
- **Without the backend running**, the website still opens in demo mode with sample scenarios, but answers aren't saved.
- **"Port 5000 is in use" on macOS:** turn off AirPlay Receiver in System Settings → General → AirDrop & Handoff.
- **Hosting it online:** see [DEPLOY.md](DEPLOY.md).
