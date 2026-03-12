# AWS Deployment Architecture (Sprint 10.5)

## Scope and Guardrails
This document is deployment architecture and cutover prep only.
- No production cutover in Sprint 10.5.
- No Supabase exit in Sprint 10.5.
- No publish logic or approval-gate behavior changes.
- No CoRent GHL/social automation activation in Sprint 10.5.

## Current Platform Services (Repo Reality)
| Service | Repo path | Current role |
|---|---|---|
| Next.js Command Screen | `apps/tufflove-web` | FamilyOps surfaces, operator/triggers/missions UIs, guarded API proxies |
| FastAPI API | `services/api` | Task enqueue/admin APIs, trigger APIs, operator version/mission APIs |
| Worker | `services/worker` | Queue processing and publish guardrail enforcement |
| Postgres | Docker/local | Task logs, approvals, brands, trigger/operator/mission persistence |
| Redis | Docker/local | Async queue backbone |
| CoRent app (separate workload) | `apps/corent-web` | Existing product workload already stable on AWS EC2 |

## Target AWS Production Topology (Recommended)

### Recommendation (explicit)
Use a **separate TUFF LOVE EC2 workload** in the same AWS account; do **not** share the existing CoRent EC2 for steady-state production.

- Temporary co-hosting is possible only for short-lived emergency testing.
- Long-term shared host increases blast radius, patch coupling, resource contention, and rollback complexity.

### Production shape
- **ALB + ACM**
  - TLS termination at ALB.
  - Host routing:
    - `tufflove.example.com` -> web
    - `api.tufflove.example.com` -> api
- **TUFF LOVE App Host (EC2, Docker Compose)**
  - reverse proxy (nginx)
  - `web` (Next.js)
  - `api` (FastAPI)
  - `worker`
- **Data layer**
  - Preferred: RDS Postgres + ElastiCache Redis.
  - Low-cost starter: compose-managed Postgres/Redis on TUFF LOVE EC2 with strict backup discipline.
- **Storage / artifacts**
  - Use S3 bucket for DB dumps, logs export, and future mission artifacts.

## Component Decisions
| Component | Sprint 10.5 recommendation |
|---|---|
| Next.js web | Containerized (`apps/tufflove-web/Dockerfile`) behind nginx/ALB |
| API | Existing Dockerfile, private network, exposed through reverse proxy only |
| Worker | Existing Dockerfile, private network only, token-protected endpoints |
| Postgres | Prefer RDS; if local container, run nightly dumps + restore drill |
| Redis | Prefer ElastiCache; if local container, AOF + restart policy |
| Reverse proxy | nginx container for app/api pathing on host |
| SSL/domain | ACM certs on ALB; host-based routing to reverse proxy target group |
| Backups | Nightly pg_dump to local + sync to S3; weekly restore validation |
| Logs/monitoring | CloudWatch agent + docker logs + ALB access logs; mission/audit tables remain source of truth |
| File/artifact storage | S3 path reserved for mission artifacts and snapshots |

## CoRent Assimilation Plan (Management Scope Only)
Treat CoRent as a managed Battalion/tenant in platform planning without activating deep automation yet.

Planned representation:
- `tenant_id = corent` remains visible in policy and admin surfaces.
- CoRent appears in future command surfaces for visibility (status, trigger inventory, mission history summary).
- Keep `corent` automation posture inactive for GHL/social until explicit enablement sprint.

Operational separation:
- CoRent workload remains on existing EC2 stack.
- TUFF LOVE workload deploys to separate EC2 stack.
- Shared AWS account, separate compose projects, separate env files, separate backups.

## Forward Compatibility
This architecture intentionally supports:
- Sprint 11 full Supabase exit + auth cutover
- Sprint 12 Vibe Coding pipeline
- Later browser/webhook/scraper expansion with isolated worker scaling
