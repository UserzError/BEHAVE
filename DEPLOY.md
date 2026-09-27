# Hosting on PythonAnywhere

The whole site (React pages + Flask API + SQLite database) runs as one Flask app. PythonAnywhere's free plan
keeps files between restarts, so the database of answers survives. You'll get an address like
`https://YOURNAME.pythonanywhere.com`.

Replace `YOURNAME` below with your PythonAnywhere username.

## 1. On your computer: get the code ready

Do this whenever you change the site or the scenarios, then redo step 4 on PythonAnywhere.

1. **Save your scenarios into `scenarios.json`.** The designer saves into `backend/behave.db`, which isn't in git.
   A new server loads `scenarios.json` instead, so copy them over:
   ```bash
   cd backend
   venv/bin/python export_scenarios.py
   ```
2. **Build the React site.** PythonAnywhere can't run `npm`, so the built files (`frontend/dist/`) go into git.
   They're normally ignored, so add them with `-f`:
   ```bash
   cd ../frontend
   npm run build
   cd ..
   git add backend/scenarios.json
   git add -f frontend/dist
   git commit -m "Update build and scenarios"
   git push
   ```

## 2. On PythonAnywhere: first-time setup

1. Sign up at [pythonanywhere.com](https://www.pythonanywhere.com) (the free "Beginner" plan is enough).
2. Open **Consoles → Bash** and run:
   ```bash
   git clone -b devpost-submission https://github.com/UserzError/BEHAVE.git
   cd BEHAVE/backend
   python3.10 -m venv venv
   venv/bin/pip install -r requirements.txt
   ```
   If the GitHub repo is private, git asks for a username and password: use your GitHub username and a
   [personal access token](https://github.com/settings/tokens) as the password.
3. Create the admin token file (pick your own long random value; don't reuse your laptop's):
   ```bash
   echo "ADMIN_TOKEN=$(python3 -c 'import secrets; print(secrets.token_urlsafe(24))')" > .env
   cat .env   # copy this value somewhere safe: it unlocks the scenario designer
   ```

## 3. On PythonAnywhere: create the web app

1. Go to the **Web** tab → **Add a new web app** → **Next** → **Manual configuration** (not "Flask") → **Python 3.10**.
2. On the web app page:
   - **Virtualenv:** `/home/YOURNAME/BEHAVE/backend/venv`
   - **WSGI configuration file:** click the link, delete everything in it, and paste the contents of
     `backend/pythonanywhere_wsgi.py` (with `YOURNAME` replaced). Save.
3. Click the green **Reload** button at the top of the Web tab.
4. Open `https://YOURNAME.pythonanywhere.com`. The poll should load with your scenarios.
   - Scenario designer: `https://YOURNAME.pythonanywhere.com/#/admin` (enter the token from step 2.3)
   - Results: `https://YOURNAME.pythonanywhere.com/#/results`

## 4. Updating the live site later

After pushing new changes (step 1), in a PythonAnywhere Bash console:
```bash
cd ~/BEHAVE && git pull
```
then click **Reload** in the Web tab.

Scenarios already in the live database are **not** replaced by a new `scenarios.json` (it's only loaded into an
empty database). To edit live scenarios, use the live designer at `/#/admin`, or reset (below).

## Resetting the answers (e.g. before a demo)

This deletes all answers **and** reloads scenarios from `scenarios.json`:
```bash
rm ~/BEHAVE/backend/behave.db
```
then click **Reload**.

## Good to know

- **Anyone can see the results page**, and anyone who finds `/#/admin` sees the token prompt. They can't change
  anything without the token, so keep it private.
- **Free-plan sites expire** unless you log in and click "Run until 3 months from today" on the Web tab.
- **Something broken?** The Web tab has an **Error log** link; the last lines usually say what went wrong
  (a wrong path in the WSGI file is the most common mistake).
- Debug mode is automatically off on PythonAnywhere: it imports `app` instead of running `python app.py`.
