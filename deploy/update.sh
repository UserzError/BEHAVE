#!/bin/sh
# Update the live site to the latest version on GitHub. Run from anywhere, as your own (sudo) user:
#   /srv/behave/deploy/update.sh
set -eu
cd /srv/behave
git pull --ff-only
backend/venv/bin/pip install --quiet -r backend/requirements.txt
cd backend
sudo -u behave venv/bin/python manage.py migrate --no-input   # database changes, if any
sudo systemctl restart behave
sleep 2
systemctl is-active --quiet behave && echo "Updated and running: $(git log --oneline -1)" \
  || { echo "behave failed to start; see: sudo journalctl -u behave -n 50"; exit 1; }
