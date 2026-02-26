# Migration (Current Projects -> ZeroClaw Spine)

We move everything to one governed backbone:
- API (Cloud Run)
- Worker (Cloud Run)
- Postgres+pgvector (Cloud SQL)
- Cloud Tasks (async jobs)
- Secret Manager (all keys)
- One tenant model: tufflove / corent / familyops

Next steps:
1) Inventory each project: repo, hosting, env vars, integrations, DBs
2) Containerize anything not already containerized
3) Migrate DB -> Cloud SQL (create pgvector extension)
4) Cutover to API endpoints
5) Enforce budgets + tool allowlists per tenant
