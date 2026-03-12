# TUFF LOVE ZeroClaw Platform (Starter)

Primary runbook: `docs/runbook.md`
AWS deployment prep (Sprint 10.5):
- `docs/aws-deployment-architecture.md`
- `docs/aws-deployment-runbook.md`
- `docs/sprint11-supabase-exit-prereqs.md`
- `docs/corent-assimilation-plan.md`

One governed agent spine powering:
- tufflove.us
- corent.ai
- family ops (GHL social automation)

Run local:
- docker compose up -d
- cd services/api
- python3 -m venv .venv
- source .venv/bin/activate
- python -m pip install --upgrade pip
- python -m pip install -r requirements.txt
- python -m uvicorn app.main:app --reload --reload-dir app --reload-exclude '.venv/*' --port 8080

Frontend:
- `cd apps/tufflove-web && npm run dev`
- Production flow page: `http://localhost:3000/agent`
- Debug page: `http://localhost:3000/agent-test`

Worker guardrail:
- `services/worker` now requires `x-worker-token` when `WORKER_ADMIN_TOKEN` is set.
- Docker compose sets `WORKER_ADMIN_TOKEN` from `.env` (fallback `change_me_worker`).

Knowledge ingest (admin):
- Queue ingest for tenant:
  - `POST /v1/admin/tenant/{tenant_id}/ingest` with `x-admin-token`
  - body: `{"source_root":"assets/tuff-love-book","extensions":[".md",".txt",".pdf",".docx"],"max_files":200}`
- Process queued jobs:
  - `POST /v1/worker/run_once` with header `x-worker-token`
