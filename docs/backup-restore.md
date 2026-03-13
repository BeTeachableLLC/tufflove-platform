# TUFF LOVE Backup + Restore

## Scope
Minimal operational backup and restore for server-first continuity.

Primary data sources:
- Postgres (`postgres_data` volume)
- Redis queue/AOF (`redis_data` volume)
- Runtime files (`runtime_data` volume)
- Server `.env.production` secrets/config file

## Backup prerequisites
Run from the server clone directory:

```bash
cd /opt/tufflove-platform
```

Create backup directory:

```bash
mkdir -p /opt/tufflove-platform/backups
```

## Database backup (required)

```bash
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
docker compose --env-file .env.production -f docker-compose.production.yml \
  exec -T postgres \
  pg_dump -U "${POSTGRES_USER:-tufflove}" "${POSTGRES_DB:-tufflove}" \
  > "backups/postgres_${STAMP}.sql"
```

Optional compressed backup:

```bash
gzip "backups/postgres_${STAMP}.sql"
```

## Redis/runtime snapshot backup (recommended)

```bash
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
docker run --rm \
  -v tufflove-platform_redis_data:/from/redis:ro \
  -v tufflove-platform_runtime_data:/from/runtime:ro \
  -v /opt/tufflove-platform/backups:/to \
  alpine sh -c "mkdir -p /bundle && cp -a /from/redis /bundle/redis && cp -a /from/runtime /bundle/runtime && tar -czf /to/redis_runtime_${STAMP}.tar.gz -C /bundle redis runtime"
```

## Config backup (required, secure storage)
- Back up `.env.production` to a secure secret store or encrypted vault.
- Never commit `.env.production` into git.

## Restore checklist
1. Verify target host has Docker + Docker Compose plugin installed.
2. Restore repo to desired release commit on `main`.
3. Restore `.env.production`.
4. Start stack once to initialize volumes:

```bash
scripts/prod-stack.sh start
```

5. Restore Postgres dump:

```bash
gunzip -c backups/postgres_<STAMP>.sql.gz | \
docker compose --env-file .env.production -f docker-compose.production.yml \
  exec -T postgres psql -U "${POSTGRES_USER:-tufflove}" "${POSTGRES_DB:-tufflove}"
```

6. (If used) restore redis/runtime volume tarball.
7. Restart services:

```bash
scripts/prod-stack.sh restart
scripts/prod-stack.sh check
```

## Recovery expectations
- Postgres backup is authoritative for tasks, approvals, missions, operators, trigger configs/events, and content workflow.
- Redis may lose in-flight queue messages between snapshots if not included.
- Runtime files are optional unless ingest/workflows rely on retained local runtime artifacts.
- Publish guardrails and dry-run semantics are code-level behavior and should be validated with regression tests after restore.
