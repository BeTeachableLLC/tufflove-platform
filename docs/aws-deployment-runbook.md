# AWS Deployment Runbook (Sprint 10.5 Prep)

This runbook is for deployment preparation and rehearsal. It does not perform production cutover by itself.

## Service Map
| Layer | Service | Health endpoint/check | Notes |
|---|---|---|---|
| Edge | `reverse-proxy` (nginx) | `GET /` on port 80 | Host-routes to web/api |
| App UI | `web` (`apps/tufflove-web`) | `GET /` on port 3000 | FamilyOps Command Screen |
| App API | `api` (`services/api`) | `GET /healthz` on port 8080 | Admin/trigger/operator/mission APIs |
| Worker | `worker` (`services/worker`) | `GET /healthz` on port 8081 | Queue execution + guardrails |
| Data | `postgres` | `pg_isready` | Primary relational store |
| Queue | `redis` | `redis-cli ping` | Async task queue |

## Deployment Artifacts (added in Sprint 10.5)
- `docker-compose.production.yml`
- `.env.production.example`
- `deploy/nginx/tufflove.conf.template`
- `apps/tufflove-web/Dockerfile`

## Host Prep Checklist
1. Provision a dedicated TUFF LOVE EC2 host in the existing AWS account.
2. Install Docker Engine + Docker Compose plugin.
3. Clone repo to deployment path (example: `/opt/tufflove-platform`).
4. Copy env template and fill secrets:
```bash
cd /opt/tufflove-platform
cp .env.production.example .env.production
# edit .env.production with real values (do not commit)
```

## Deploy / Update Commands
Run from repo root on the deployment host:
```bash
docker compose --env-file .env.production -f docker-compose.production.yml pull
docker compose --env-file .env.production -f docker-compose.production.yml build --pull
docker compose --env-file .env.production -f docker-compose.production.yml up -d
docker compose --env-file .env.production -f docker-compose.production.yml ps
```

## Healthcheck Strategy
1. Container health summary:
```bash
docker compose --env-file .env.production -f docker-compose.production.yml ps
```
2. API health:
```bash
curl -fsS http://127.0.0.1:8080/healthz
```
3. Worker health:
```bash
curl -fsS http://127.0.0.1:8081/healthz
```
4. Public route checks (after ALB + DNS wiring):
```bash
curl -I https://tufflove.example.com
curl -I https://api.tufflove.example.com/healthz
```

## Backup Checklist (Postgres)
Daily backup script baseline:
```bash
mkdir -p /opt/tufflove-platform/backups
TS=$(date +%Y%m%d-%H%M%S)
docker compose --env-file .env.production -f docker-compose.production.yml exec -T postgres \
  sh -lc 'PGPASSWORD="$POSTGRES_PASSWORD" pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' \
  > "/opt/tufflove-platform/backups/tufflove-${TS}.sql"
```

Backup retention baseline:
```bash
find /opt/tufflove-platform/backups -type f -name 'tufflove-*.sql' -mtime +14 -delete
```

S3 sync baseline:
```bash
aws s3 sync /opt/tufflove-platform/backups s3://<bucket>/tufflove/db-backups/
```

## Restore Checklist (Drill)
1. Restore into a non-production DB first.
2. Verify row counts for core tables (`task_audit_log`, `task_approvals`, `operator_missions`, `triggers`).
3. Run API and worker smoke checks against restored DB.

Example restore command:
```bash
cat /opt/tufflove-platform/backups/tufflove-<timestamp>.sql | \
  docker compose --env-file .env.production -f docker-compose.production.yml exec -T postgres \
  sh -lc 'PGPASSWORD="$POSTGRES_PASSWORD" psql -U "$POSTGRES_USER" "$POSTGRES_DB"'
```

## Rollback Checklist
1. Identify last known good commit/tag.
2. Checkout last known good revision on host.
3. Rebuild and restart stack:
```bash
git checkout <last-good-ref>
docker compose --env-file .env.production -f docker-compose.production.yml build --pull
docker compose --env-file .env.production -f docker-compose.production.yml up -d
```
4. Re-run health checks and mission smoke tests.
5. Record incident notes and root-cause follow-up before next deploy.

## Logs and Monitoring Baseline
- `docker compose --env-file .env.production -f docker-compose.production.yml logs -f api worker web`
- Ship host/container logs to CloudWatch.
- Enable ALB access logs to S3.
- Keep mission and operator audit tables as operational truth for run support.
