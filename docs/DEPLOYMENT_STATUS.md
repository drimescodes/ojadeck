# OjaDeck Deployment Status

Last updated: 2026-07-02

## Current Public URLs

Application:

```text
https://ojadeck.drimes.dev
```

Health check:

```text
https://ojadeck.drimes.dev/api/health
```

Nomba webhook URL to submit:

```text
https://ojadeck.drimes.dev/api/webhooks/payments
```

The health endpoint was verified from both the server and local machine and returned:

```json
{"status":"ok","sessions":[]}
```

## Server

DigitalOcean droplet:

```text
IP: 46.101.75.58
OS: Ubuntu 24.04 LTS
RAM: 8GB
vCPU: 4
Swap: 4GB
```

DNS:

```text
A record: ojadeck.drimes.dev -> 46.101.75.58
```

HTTPS:

- Caddy is installed.
- Caddy has successfully issued a Let's Encrypt certificate for `ojadeck.drimes.dev`.
- Caddy reverse proxies `ojadeck.drimes.dev` to `127.0.0.1:3000`.

## Installed Runtime

Installed on the server:

- Git
- Caddy
- Build essentials
- Bun
- Node.js
- Google Chrome stable
- 4GB swap file

Chrome path:

```text
/usr/bin/google-chrome-stable
```

Bun path:

```text
/home/nomba/.bun/bin/bun
```

## Users and SSH

The provided SSH key worked for `root`.

A `nomba` deploy user was created and the provided public key was added to:

```text
/home/nomba/.ssh/authorized_keys
```

Important: the private SSH key was pasted into chat. Treat it as exposed. Rotate or replace it before long-term use. Prefer creating a fresh deploy key for GitHub Actions instead of reusing the shared key.

## App Location

The repo was cloned from:

```text
https://github.com/drimescodes/ojadeck.git
```

Server path:

```text
/home/nomba/ojadeck
```

Dashboard production build exists at:

```text
/home/nomba/ojadeck/dashboard/dist
```

## Systemd Service

Service name:

```text
ojadeck.service
```

Service file:

```text
/etc/systemd/system/ojadeck.service
```

Useful commands:

```bash
sudo systemctl status ojadeck
sudo systemctl restart ojadeck
sudo journalctl -u ojadeck -f
```

The service is enabled and running.

## Environment File

Server env file:

```text
/home/nomba/ojadeck/.env
```

This file is mode `600` and owned by `nomba`.

Current configured shape:

```env
NODE_ENV=production
PORT=3000
APP_URL=https://ojadeck.drimes.dev
DB_PATH=/home/nomba/ojadeck/data/app.db
JWT_SECRET=<server-generated>
GEMINI_MODEL=gemini-2.5-flash
PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable
WA_HEADLESS=true
WA_INIT_TIMEOUT_MS=120000
WA_AUTH_TIMEOUT_MS=180000
WA_PROTOCOL_TIMEOUT_MS=300000
NOMBA_MODE=test
NOMBA_TEST_BASE_URL=https://sandbox.nomba.com
NOMBA_TEST_CLIENT_ID=
NOMBA_TEST_PRIVATE_KEY=
NOMBA_TEST_PARENT_ACCOUNT_ID=
NOMBA_TEST_SUB_ACCOUNT_ID=
NOMBA_LIVE_BASE_URL=https://api.nomba.com
NOMBA_LIVE_CLIENT_ID=
NOMBA_LIVE_PRIVATE_KEY=
NOMBA_LIVE_PARENT_ACCOUNT_ID=
NOMBA_LIVE_SUB_ACCOUNT_ID=
NOMBA_WEBHOOK_SECRET=
NOMBA_AMOUNT_UNIT=naira
```

Do not commit real credentials. Add Nomba and Gemini credentials directly on the server or through a deployment secret system.

## Caddy

Caddy config:

```text
/etc/caddy/Caddyfile
```

Current config:

```caddy
ojadeck.drimes.dev {
    encode zstd gzip
    reverse_proxy 127.0.0.1:3000
}
```

Useful commands:

```bash
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
sudo journalctl -u caddy -f
```

## What Was Done

1. Verified GitHub repo is reachable over HTTPS.
2. Created `nomba` server user.
3. Added SSH public key for the `nomba` user.
4. Installed Caddy, Bun, Node.js, Google Chrome, and build tools.
5. Added 4GB swap.
6. Cloned OjaDeck from GitHub.
7. Installed backend and dashboard dependencies.
8. Built the dashboard with Vite.
9. Created production `.env`.
10. Created and started `ojadeck.service`.
11. Configured Caddy reverse proxy.
12. Verified HTTPS health endpoint.

## Next Steps

1. Submit this webhook URL to Nomba:

   ```text
   https://ojadeck.drimes.dev/api/webhooks/payments
   ```

2. Add real environment values on the server:

   ```env
   GEMINI_API_KEY=
   NOMBA_MODE=test
   NOMBA_TEST_CLIENT_ID=
   NOMBA_TEST_PRIVATE_KEY=
   NOMBA_TEST_PARENT_ACCOUNT_ID=
   NOMBA_TEST_SUB_ACCOUNT_ID=
   NOMBA_LIVE_CLIENT_ID=
   NOMBA_LIVE_PRIVATE_KEY=
   NOMBA_LIVE_PARENT_ACCOUNT_ID=
   NOMBA_LIVE_SUB_ACCOUNT_ID=
   NOMBA_WEBHOOK_SECRET=
   NOMBA_AMOUNT_UNIT=naira
   ```

3. Test the Nomba client end-to-end:

   - token issuance/auth
   - checkout order creation
   - transaction verification
   - webhook signature verification
   - amount/currency/reference validation

4. Add a deploy script and GitHub Actions workflow for push-to-deploy.

5. Rotate the exposed SSH key and use a fresh deploy-only key for automation.

## Recommended Push-to-Deploy Plan

Use GitHub Actions over Dokploy for now. This app needs Chrome, persistent WhatsApp auth files, SQLite, and a long-running Bun process. A direct VPS deployment with systemd is simpler and more predictable for the hackathon deadline.

Recommended later setup:

1. Generate a fresh deploy SSH key.
2. Add the public key to `/home/nomba/.ssh/authorized_keys`.
3. Add the private key to GitHub repo secrets as `DROPLET_SSH_KEY`.
4. Add `DROPLET_HOST=46.101.75.58` and `DROPLET_USER=nomba`.
5. Create a GitHub Actions workflow that SSHes into the server, pulls `main`, installs dependencies, builds dashboard, and restarts `ojadeck.service`.
