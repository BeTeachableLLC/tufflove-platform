# TUFF LOVE Local Dev Runbook

## Source of Truth
- Canonical repository: `https://github.com/BeTeachableLLC/tufflove-platform`
- Canonical branch for deployment: `main`
- Local clones are for development only.

## Scope of this doc
- Local startup
- Local validation commands
- Branch/PR workflow

For server runtime ownership and deployment/redeploy operations, use:
- `docs/server-first-runbook.md`
- `docs/backup-restore.md`

## Local startup
Run from the repo root.

### 1) Core services
```bash
docker compose up -d postgres redis api worker
docker compose ps
```

### 2) Web app
```bash
cd apps/tufflove-web
npm run dev
```

Useful local routes:
- `http://localhost:3000/agent`
- `http://localhost:3000/agent-test`

### 3) FamilyOps app-session auth env
Set these in `apps/tufflove-web/.env.local`:
```bash
APP_AUTH_SECRET=change_me_app_auth_secret
FAMILYOPS_ADMIN_EMAILS=you@example.com
FAMILYOPS_ADMIN_PASSWORD=change_me_familyops
APP_AUTH_SESSION_TTL_SECONDS=43200
```

## Validation commands

### Web lint + build
```bash
cd apps/tufflove-web
npx eslint app/agent/AgentClient.tsx app/agent-test/AgentTestClient.tsx src/lib/agentClient.ts
npm run build
```

### Worker tests
```bash
cd services/worker
../api/.venv/bin/python -m unittest -v tests.test_publish_guardrails
```

### API auth regression tests
Run from `services/api` so `../../packages/zeroclaw` resolves correctly:
```bash
cd services/api
python -m pip install -r requirements.txt
python -m unittest -v tests.test_sprint4_auth_regression
```

## Branch / PR workflow

### 1) Branch + commit
```bash
git checkout main
git pull --ff-only
git checkout -b feat/<short-name>
git add -A
git commit -m "<clear, scoped message>"
git push -u origin feat/<short-name>
```

### 2) Open PR
```bash
gh pr create --fill
```

### 3) Merge after review
```bash
gh pr merge --squash --delete-branch
```
