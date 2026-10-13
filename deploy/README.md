# Hosting on your own server (Ubuntu 24.04 + Cloudflare Tunnel + Tailscale)

```
public visitor ──https──▶ Cloudflare ──tunnel──▶ cloudflared (on the VM)
                                                  └─▶ nginx 127.0.0.1:8080 ─ /admin refused ─┐
you (tailnet) ──────────────────────────────────▶ nginx :80 on tailscale0 ─ everything ──────┴─▶ gunicorn 127.0.0.1:5000 ─▶ PostgreSQL
```

- **The public** reaches the poll and results through a Cloudflare Tunnel: the VM connects *out* to Cloudflare,
  so no router ports are opened and your home IP stays hidden. Cloudflare handles HTTPS.
- **You** reach the full site, including the scenario designer, over Tailscale. The designer's API is refused on
  the public side, and still needs the admin token on yours.
- No inbound ports are open at all: the firewall only accepts traffic arriving over Tailscale.

The files used here are in this folder: `behave.service` (systemd), `nginx-behave.conf`, `backup.sh`, `update.sh`.
Everything runs from **`/srv/behave`** as a dedicated **`behave`** user with no login and no password; PostgreSQL
lets it in because the system user and database user have the same name.

Commands below are run on the VM as your normal (sudo) user. Replace `example.com` with your domain.

---

## 1. Packages

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git python3-venv postgresql nginx ufw
```

Ubuntu 24.04 comes with Python 3.12 and PostgreSQL 16, both fine.

**Tailscale on the VM itself:** if Tailscale only runs on the Proxmox host, install it on this VM too, so you
can reach the designer: `curl -fsSL https://tailscale.com/install.sh | sh && sudo tailscale up`.
Check with `ip addr show tailscale0`.

## 2. The code

```bash
sudo useradd --system --home-dir /srv/behave --shell /usr/sbin/nologin behave
sudo mkdir /srv/behave && sudo chown "$USER": /srv/behave
git clone https://github.com/UserzError/BEHAVE.git /srv/behave
cd /srv/behave/backend
python3 -m venv venv
venv/bin/pip install -r requirements.txt
```

The code belongs to you, so you can `git pull` and edit it (and run Claude Code in `/srv/behave`). The `behave`
user can only read it. The built website (`frontend/dist`) is in the repo, so the VM doesn't need Node.

## 3. The database

```bash
sudo -u postgres createuser behave
sudo -u postgres createdb --owner behave behave
```

## 4. Settings (`backend/.env`)

This makes a **new** secret key and admin token (don't reuse the ones from your computer):

```bash
cd /srv/behave/backend
DOMAIN=example.com
cat > .env <<EOF
DJANGO_DEBUG=false
DJANGO_SECRET_KEY=$(python3 -c 'import secrets; print(secrets.token_urlsafe(50))')
DJANGO_ALLOWED_HOSTS=$DOMAIN,localhost
ADMIN_TOKEN=$(python3 -c 'import secrets; print(secrets.token_urlsafe(24))')
POSTGRES_DB=behave
POSTGRES_USER=behave
POSTGRES_HOST=/var/run/postgresql
TRUST_X_FORWARDED_FOR=true
MOUSE_PATH_DAYS=30
EOF
sudo chgrp behave .env && chmod 640 .env   # readable by you and the app, nobody else
grep ADMIN_TOKEN .env                      # save this in your password manager: it unlocks the designer
```

- `localhost` must stay in `DJANGO_ALLOWED_HOSTS`: requests over Tailscale reach Django as "localhost".
- Add `www.$DOMAIN` too if you'll point `www` at the site.
- `.env` never goes in git (it's in `.gitignore`).

## 5. Create the tables and load the scenarios

```bash
sudo -u behave venv/bin/python manage.py migrate
sudo -u behave venv/bin/python manage.py load_scenarios
```

Run `manage.py` commands as `sudo -u behave ...`, since that's who the database lets in.

## 6. Run it as a service

```bash
sudo cp /srv/behave/deploy/behave.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now behave
curl -s localhost:5000/scenarios | head -c 120; echo   # should print the start of the scenarios
```

It starts at boot and restarts if it crashes. Logs: `sudo journalctl -u behave -f`.
With 4 GB of RAM the default number of workers is fine (gunicorn uses about 60 MB per worker).

## 7. nginx

```bash
sudo cp /srv/behave/deploy/nginx-behave.conf /etc/nginx/sites-available/behave
sudo ln -s /etc/nginx/sites-available/behave /etc/nginx/sites-enabled/behave
sudo rm /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx

curl -s -o /dev/null -w "admin door: %{http_code}\n" localhost/                   # 200
curl -s 127.0.0.1:8080/admin/check; echo                                          # public door: refused (403)
```

## 8. Firewall: only Tailscale gets in

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow in on tailscale0
sudo ufw enable
```

If you also SSH in over your **LAN** (not Tailscale), allow that first or you'll be cut off, e.g.
`sudo ufw allow from 192.168.1.0/24 to any port 22`. The Proxmox console always works regardless.
Cloudflare Tunnel needs no inbound rule: the VM connects out.

## 9. Cloudflare Tunnel (the public door)

1. **Put the domain's DNS on Cloudflare** (free plan). The domain stays registered (and renewed) at Porkbun;
   only the DNS moves. A tunnel on your own domain needs this: the free plan can't take over just a subdomain.
   - **Add the site in Cloudflare.** It scans your current DNS records: compare its list with Porkbun's DNS page
     (Domain Management → **DNS** on the domain) and add anything missing.
   - **If Porkbun's DNSSEC is on, turn it off first** (Domain Management → **Details** → DNSSEC). Leaving it on
     during the switch makes the domain stop resolving for many visitors. You can turn it on again later from
     Cloudflare (DNS → Settings), which gives you a DS record to paste back into Porkbun.
   - **Change the nameservers at Porkbun:** Domain Management → **Details** → **Authoritative Nameservers**:
     replace Porkbun's (`*.ns.porkbun.com`) with the two Cloudflare shows you. Usually active within minutes to a
     few hours; Cloudflare emails you when it is.
   - **What can break:** after the switch, Porkbun's DNS page no longer does anything, so
     - **Porkbun email forwarding** needs its MX records (`fwd1.porkbun.com`, `fwd2.porkbun.com`) and SPF TXT
       record copied into Cloudflare, or mail to the domain stops arriving;
     - **Porkbun URL forwarding** stops (recreate it as a Cloudflare redirect rule);
     - any other subdomains or verification TXT records must exist in Cloudflare.

     If the domain isn't used for anything else yet, none of this applies.
2. In the dashboard go to **Zero Trust → Networks → Tunnels → Create a tunnel → Cloudflared**, and name it `behave`.
3. Choose **Debian, 64-bit**, and run the install commands it shows on the VM. The last one is
   `sudo cloudflared service install <long token>`. Treat that token like a password.
4. Under **Public hostname**, add your domain (leave the subdomain empty, or use `www`):
   **Service type `HTTP`, URL `127.0.0.1:8080`**. Save.
5. In the domain's settings, **SSL/TLS → Edge Certificates**: turn on **Always Use HTTPS**.

Test from your phone **off** your Wi-Fi: `https://example.com` should show the poll.
`https://example.com/#/admin` loads, but logging in says the designer only works over Tailscale. That's intended.

## 10. Using the designer

From any device on your tailnet: `http://<the VM's tailnet name>/#/admin` (for example `http://behave/#/admin`
with MagicDNS), then enter the admin token.

## 11. Backups

```bash
sudo install -d -o behave -g behave -m 700 /var/backups/behave
echo '30 3 * * * behave /srv/behave/deploy/backup.sh' | sudo tee /etc/cron.d/behave-backup
sudo -u behave /srv/behave/deploy/backup.sh && sudo ls -lh /var/backups/behave   # try it once now
```

Every night at 3:30 it saves a dump and keeps 14 days of them. These live on the same VM, so also include the
VM in a **Proxmox backup job** (Datacenter → Backup), ideally to another disk.

## 12. Updating later

After pushing changes to GitHub:

```bash
/srv/behave/deploy/update.sh
```

It pulls, installs any new requirements, applies database changes and restarts the site. Ubuntu installs security
updates on its own (`unattended-upgrades`, on by default); check with `systemctl status unattended-upgrades`.

---

## Troubleshooting

| Symptom | Look at |
|---|---|
| Site shows a Cloudflare error page (502/1033) | `sudo systemctl status cloudflared behave nginx`; is the tunnel's service URL `127.0.0.1:8080`? |
| "Bad Request (400)" | your domain is missing from `DJANGO_ALLOWED_HOSTS` in `.env` (then `sudo systemctl restart behave`) |
| behave won't start | `sudo journalctl -u behave -n 50`: usually a typo in `.env` or the database not created |
| Can't reach the designer over Tailscale | `sudo ufw status` (needs `ALLOW IN on tailscale0`), `tailscale status` on the VM |
| Everyone gets "Too many answers" | is `TRUST_X_FORWARDED_FOR=true` set? Without it, every visitor looks like the same address |
