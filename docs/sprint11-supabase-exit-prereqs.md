# Sprint 11 Supabase Exit Prerequisites

Sprint 10.5 prepares cutover inputs only. No auth or DB cutover is executed in this sprint.

## 1) DB Cutover Prerequisites
- Confirm portable Postgres schema parity between current runtime and target AWS Postgres.
- Freeze all schema-changing PRs during cutover window.
- Define migration owner + rollback owner.
- Confirm backup integrity and restore drill completion within the last 7 days.
- Validate app startup and worker startup against target DB in rehearsal.

## 2) Auth Cutover Prerequisites
- Choose target auth authority and token/session validation path.
- Map existing FamilyOps admin gating behavior to target auth identities.
- Verify `/agent`, `/agent-test`, `/familyops/*`, and worker trigger routes preserve current admin-only behavior.
- Confirm sign-in, callback, and cookie/session semantics in staging before cutover.

## 3) Session / Cookie / Domain Considerations
- Finalize canonical domains (`tufflove` web + api subdomain).
- Set `Secure`, `HttpOnly`, and `SameSite` appropriately for production cookies.
- Ensure callback URLs and allowed origins match ALB/domain routing.
- Verify cross-origin behavior for same-origin API proxy routes used by FamilyOps pages.

## 4) Data Migration Checklist
- Export current production data snapshot.
- Import snapshot to target Postgres rehearsal environment.
- Validate key entities:
  - tenants + policies
  - task logs + approvals
  - brands + GHL connection mappings
  - triggers + trigger events
  - operator versions + missions + audit events
- Re-run worker/API regression suites against migrated data.

## 5) Validation Checklist (Cutover Readiness)
- Web lint/build passes.
- Worker guardrail tests pass.
- API auth regression tests pass.
- Trigger and mission history reads behave as expected in rehearsal.
- Approval-gated `ghl.social.publish` still blocks/approves exactly as current behavior.

## 6) Rollback Plan (Sprint 11)
- Keep pre-cutover DB snapshot immutable.
- Keep previous auth config and env vars ready for immediate restore.
- Keep previous release artifact/tag available for redeploy.
- Define rollback decision threshold (time + error budget).
- Run post-rollback smoke tests (auth, enqueue, approvals, worker run-once, mission history).

## 7) Freeze-Window Checklist
- Announce freeze window and owner matrix.
- Pause non-essential merges.
- Disable risky background jobs during cutover execution window.
- Confirm on-call coverage for API/web/worker/data.
- Prepare stakeholder status update template (start, checkpoint, complete, rollback if needed).
