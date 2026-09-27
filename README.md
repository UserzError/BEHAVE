## **B**ehavioral **E**valuation of **H**uman **A**ttitudes towards **V**ehicle **E**thics
*A project from hackUMBC '26* 

Inspired by [moralmachine.net](https://www.moralmachine.net).

This tool is intended to demonstrate the potential methods for polling for public consensus on autonomous vehicle ethics. 
Demonstration: https://youtu.be/XgMI82CFvCY?is=2KBMzWzaALXyrDO6

For our stack, we are using React.js for the frontend, and we are using Flask and SQLite on the backend.

We used AI in the process of building this website; for the majority of the frontend, and assisting with designing and orchestrating the backend. AI was not used in deciding the designs of the poll scenarios themselves.

## Running it locally

### 1. Install the tools

You need these installed once:

- [Python 3.9+](https://www.python.org/downloads/)
- [Node.js 18+](https://nodejs.org/) (includes npm)
- [Git](https://git-scm.com/downloads)

On macOS with Homebrew: `brew install python node git`. On Windows, in PowerShell:

```powershell
winget install Python.Python.3.12
winget install OpenJS.NodeJS.LTS
winget install Git.Git
```

Then close and reopen PowerShell.

### 2. Start the backend (terminal 1)

The backend is a Flask server on port 5000. It creates its SQLite database (`backend/behave.db`) and loads the starting scenarios automatically.

**macOS / Linux**
```bash
git clone -b devpost-submission https://github.com/UserzError/BEHAVE.git
cd BEHAVE/backend
python3 -m venv venv
venv/bin/pip install -r requirements.txt
echo "ADMIN_TOKEN=$(venv/bin/python -c 'import secrets; print(secrets.token_urlsafe(24))')" > .env
venv/bin/python app.py
```

**Windows (PowerShell)**
```powershell
git clone -b devpost-submission https://github.com/UserzError/BEHAVE.git
cd BEHAVE\backend
py -m venv venv
venv\Scripts\python -m pip install -r requirements.txt
$token = venv\Scripts\python -c "import secrets; print(secrets.token_urlsafe(24))"
Set-Content -Path .env -Value "ADMIN_TOKEN=$token" -Encoding ascii
venv\Scripts\python app.py
```

Leave it running. It should print `Admin token loaded`.

### 3. Start the website (terminal 2)

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

### 4. Open it

| Page | Address |
|---|---|
| Poll (front page) | http://localhost:5173 |
| Results | http://localhost:5173/#/results |
| Scenario designer | http://localhost:5173/#/admin |

The designer asks for the admin token: the value after `ADMIN_TOKEN=` in `backend/.env` (`cat backend/.env`, or `Get-Content backend\.env` on Windows).

### Next time

Only the last command in each terminal is needed:

```bash
cd BEHAVE/backend && venv/bin/python app.py        # Windows: cd BEHAVE\backend; venv\Scripts\python app.py
cd BEHAVE/frontend && npm run dev                  # Windows: cd BEHAVE\frontend; npm.cmd run dev
```

### Good to know

- **Scenarios you design** are saved in `backend/behave.db`, which isn't in git. To share them, run `venv/bin/python export_scenarios.py` in `backend/` (Windows: `venv\Scripts\python export_scenarios.py`) and commit `backend/scenarios.json`.
- **Starting fresh:** stop the backend, delete `backend/behave.db`, and start it again. This clears all answers and reloads the scenarios from `scenarios.json`.
- **Simulated answers for the results page:** run `venv/bin/python seed_responses.py` in `backend/` (Windows: `venv\Scripts\python seed_responses.py`) to add 40 simulated people who answer every scenario, so "How you compare" has something to compare against. They're tagged as simulated, the results page says how many there are, and `seed_responses.py --remove` deletes them.
- **Without the backend running**, the website still opens in demo mode with sample scenarios, but answers aren't saved.
- **"Port 5000 is in use" on macOS:** turn off AirPlay Receiver in System Settings → General → AirDrop & Handoff.
- **Hosting it online:** see [DEPLOY.md](DEPLOY.md).
