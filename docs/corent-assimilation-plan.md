# CoRent EC2 Assimilation Plan (Sprint 10.5)

## Current State
- CoRent is already stable on AWS EC2 with Docker.
- Lightsail is retired.
- CoRent is in repo as `apps/corent-web` and in tenant defaults as inactive for automation.

## Sprint 10.5 Objective
Bring CoRent into platform management planning without activating deep GHL/social automation.

## Management Model
- Treat CoRent as a Battalion/tenant (`tenant_id = corent`).
- Keep policy posture restrictive/inactive for automation until explicit enablement sprint.
- Include CoRent in future FamilyOps visibility surfaces (tenant list, trigger inventory, mission history summary).

## Infrastructure Model
- Keep CoRent workload isolated from TUFF LOVE workload at the host level.
- Same AWS account is fine; separate EC2/runtime stacks are recommended.
- Separate:
  - compose project and env file
  - backup schedule
  - logs and alarms
  - release cadence

## Readiness Inputs for Later Sprints
- Inventory CoRent env vars and secrets source.
- Catalog CoRent health endpoints and smoke tests.
- Define minimum observability parity requirements before shared command visibility is enabled.
- Define explicit activation gate for CoRent GHL/social automation (out of scope for Sprint 10.5).
