# TUFF LOVE Platform

TUFF LOVE Business Assistant platform monorepo.

## Source of Truth
- Canonical source: `https://github.com/BeTeachableLLC/tufflove-platform` on `main`
- Local clones are development/admin access workspaces only, not runtime source of truth.

## Runbooks
- Local dev + validation: `docs/runbook.md`
- Server-first production operations: `docs/server-first-runbook.md`
- Backup + restore: `docs/backup-restore.md`

## Production stack artifact
- `docker-compose.production.yml` defines server runtime ownership for:
  - web
  - api
  - worker API
  - worker-runner queue processor
  - trigger-scheduler
  - postgres
  - redis

## Quick local startup
```bash
docker compose up -d postgres redis api worker
cd apps/tufflove-web
npm run dev
```
