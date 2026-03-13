# TUFF LOVE Server-First Runbook

## Goal
Keep the TUFF LOVE platform running continuously on server infrastructure without depending on any individual laptop staying online.

## Operational source of truth
- GitHub repository: `https://github.com/BeTeachableLLC/tufflove-platform`
- Deploy branch: `main`
- Server runtime is deployed from this repo clone on the server (for example `/opt/tufflove-platform`).
- Local desktop clones are development/admin access only.

## Production topology (Docker-first)
- `web` (Next.js app, port `3000`)
- `api` (FastAPI, port `8080` localhost-bound)
- `worker` (worker HTTP service, port `8081` localhost-bound)
- `worker-runner` (continuous queue processor, no public port)
- `trigger-scheduler` (continuous due-trigger scheduler, no public port)
- `postgres` (persistent DB volume)
- `redis` (AOF-enabled queue persistence volume)

Recommended edge:
- reverse proxy + TLS at server edge (Nginx/Caddy/ALB) -> `web:3000`
- keep `api` and `worker` host ports bound to `127.0.0.1` unless explicit private-network need

## Files that define production runtime
- `docker-compose.production.yml`
- `.env.production` (not committed)
- `.env.production.example` (template)
- `scripts/prod-stack.sh`
- `infra/systemd/tufflove-platform.service` (optional boot wrapper)

## Deploy / redeploy flow (server)
Run from the server clone of this repo:

```bash
cd /opt/tufflove-platform
git fetch origin
git checkout main
git pull --ff-only
cp -n .env.production.example .env.production
# edit .env.production with real secrets
scripts/prod-stack.sh start
scripts/prod-stack.sh status
scripts/prod-stack.sh check
```

Redeploy current `main` after updates:

```bash
cd /opt/tufflove-platform
git checkout main
git pull --ff-only
scripts/prod-stack.sh restart
scripts/prod-stack.sh check
```

## Daily operations commands

```bash
scripts/prod-stack.sh start
scripts/prod-stack.sh stop
scripts/prod-stack.sh restart
scripts/prod-stack.sh status
scripts/prod-stack.sh logs
scripts/prod-stack.sh logs api
scripts/prod-stack.sh config
scripts/prod-stack.sh check
```

## Boot resilience
- All runtime services in `docker-compose.production.yml` use `restart: unless-stopped`.
- Optional systemd wrapper file: `infra/systemd/tufflove-platform.service`

Install optional systemd wrapper:

```bash
sudo cp infra/systemd/tufflove-platform.service /etc/systemd/system/tufflove-platform.service
sudo systemctl daemon-reload
sudo systemctl enable --now tufflove-platform.service
sudo systemctl status tufflove-platform.service
```

## Runtime persistence boundaries
- Postgres state: `postgres_data` volume
  - tenants, tasks, approvals, triggers, missions, operator versions, content workflow state
- Queue state: Redis AOF in `redis_data` volume
- Runtime files: `runtime_data` volume mounted at `/var/lib/tufflove/runtime` in API/worker services
- Source ingest assets: mounted read-only from repo `assets/`
- Logs: docker-managed service logs on server (`docker compose logs`), with size rotation in compose

## Secrets/config hygiene
- Keep secrets only in `.env.production` on server.
- Do not commit `.env.production`.
- Do not put machine-specific paths in runtime env values.
- Required runtime secrets:
  - `POSTGRES_PASSWORD`
  - `ADMIN_TOKEN`
  - `WORKER_ADMIN_TOKEN`
  - `APP_AUTH_SECRET`
  - `FAMILYOPS_ADMIN_EMAILS`
  - `FAMILYOPS_ADMIN_PASSWORD`
  - `OPENAI_API_KEY`
- Optional fallback auth vars (legacy dashboard paths):
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Operational verification checklist
Run after deploy/restart:

```bash
scripts/prod-stack.sh status
scripts/prod-stack.sh check
```

Confirm manually:
1. API health responds (`/healthz`).
2. Worker health responds (`/healthz`).
3. Trigger scheduler container is running (`scripts/prod-stack.sh status`).
4. FamilyOps admin surface route is reachable (`/familyops/approvals` returns auth response, not 5xx).
5. Publish guardrails unchanged: run worker guardrail tests before release.
6. Approved publish remains dry-run `would_publish` behavior (covered by regression tests).

## Explicit non-goals in this sprint
- No CoRent activation.
- No change to `ghl.social.publish` approval gate behavior.
- No change to `ghl.social.publish` dry-run semantics.
- No broad dashboard auth refactor.
