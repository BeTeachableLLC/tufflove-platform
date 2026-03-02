# Codex Operating Rules — TUFF LOVE Platform

## Source of Truth
- Only modify this repo: tufflove-platform
- No work outside repo.

## Non-negotiables
- CoRent is INACTIVE: do not connect, do not enable publishing, do not assign a location_id.
- Publish stays approval-gated and DRY-RUN until explicitly changed.
- Store GHL tokens per (tenant_id, location_id).
- Every ghl.social.publish payload must include brand_id + location_id.
- Worker must enforce:
  - brand exists and is active
  - payload.location_id == brand.ghl_location_id (when brand.ghl_location_id is set)
  - ghl connection exists for (tenant_id, location_id)
  - failures return hard error with clear note

## Validation (required)
- docker compose up -d --build
- enqueue -> approve -> worker run_once
- expected: note="ghl_dry_run", status="would_publish", and task status="completed"

## Output
- Plan first
- Then implement
- Provide diff summary + commands run + validation output
