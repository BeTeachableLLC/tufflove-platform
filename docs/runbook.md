# TUFF LOVE Platform Runbook

## Source of Truth
- Active repo: `/Users/moemathews/Desktop/Social Media Admin/tufflove-platform`
- Git remote: `https://github.com/Beteachable/tufflove-platform.git`
- Use this repo for all current TUFF LOVE platform work. Do not treat `legacy/` as the active build target.

## Local Startup
Run from repo root (`/Users/moemathews/Desktop/Social Media Admin/tufflove-platform`).

### 1) Core services (Docker)
```bash
docker compose up -d postgres redis api worker
docker compose ps
```

### 2) Web app (Next.js)
```bash
cd apps/tufflove-web
npm run dev
```

Useful local routes:
- `http://localhost:3000/agent`
- `http://localhost:3000/agent-test`

### 3) App auth session env (FamilyOps surfaces)
Set these in `apps/tufflove-web/.env.local`:
```bash
APP_AUTH_SECRET=change_me_app_auth_secret
FAMILYOPS_ADMIN_EMAILS=you@example.com
FAMILYOPS_ADMIN_PASSWORD=change_me_familyops
APP_AUTH_SESSION_TTL_SECONDS=43200
```
Notes:
- FamilyOps `/familyops/*`, `/agent`, `/agent-test`, and worker run-once web route now use signed app-session cookies.
- Supabase auth remains optional fallback for legacy dashboard sign-in paths when `NEXT_PUBLIC_SUPABASE_*` vars are configured.

## Validation Commands
Use these before opening/merging a PR.

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

### API tests (Sprint 4 auth regression)
Run from `services/api` so the local editable `../../packages/zeroclaw` path in `requirements.txt` resolves correctly:
```bash
cd services/api
python -m pip install -r requirements.txt
python -m unittest -v tests.test_sprint4_auth_regression
```

## Branch / PR / Merge Cleanup Workflow
This is the workflow used in recent sprint work.

### 1) Branch and commit
```bash
git checkout main
git pull --ff-only
git checkout -b feat/<short-name>
# make changes
git add -A
git commit -m "<clear, scoped message>"
git push -u origin feat/<short-name>
```

### 2) Open and merge PR
```bash
gh pr create --fill
gh pr merge --squash --delete-branch
```

### 3) Sync and clean local branches
```bash
git checkout main
git pull --ff-only
git fetch --prune
git branch --merged | grep -v '^\*' | grep -v ' main$' | xargs -n 1 git branch -d
```
