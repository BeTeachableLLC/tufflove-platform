from __future__ import annotations

from datetime import datetime, timezone
import json
import os
import re
from typing import Any
from uuid import uuid4

import httpx
from psycopg.types.json import Jsonb

from app.db import connect
from app.model_router_service import get_model_router_decision, list_model_router_decision_events
from app.mission_history_service import get_familyops_mission

BUILD_STAGES = {
    "intake",
    "routed",
    "branch_created",
    "implementation_started",
    "tests_run",
    "verification_requested",
    "pr_drafted",
    "approval_pending",
    "ready_for_pr_review",
    "ready_for_merge",
    "revise_before_pr",
    "rejected",
    "rerun_requested",
}
EXECUTION_RUN_STATUSES = {"running", "passed", "failed", "error", "cancelled"}
PROOF_STATUSES = {"unknown", "passed", "failed"}
VERIFICATION_STATES = {"not_required", "pending", "passed", "failed"}
RECOMMENDATIONS = {
    "needs_execution",
    "verification_requested",
    "ready_for_pr_review",
    "approval_pending",
    "ready_for_merge",
    "revise_before_pr",
}
GITHUB_CHECK_STATUSES = {"unknown", "pending", "passing", "failing"}
GITHUB_REVIEW_STATUSES = {"unknown", "pending", "approved", "changes_requested"}
GITHUB_PR_STATES = {"open", "closed", "merged", "unknown"}
GITHUB_WRITEBACK_STATUSES = {"never", "success", "failed"}
SENSITIVE_PATTERNS = [
    re.compile(r"(?i)(access[_-]?token\s*[=:]\s*)([^\s,;]+)"),
    re.compile(r"(?i)(refresh[_-]?token\s*[=:]\s*)([^\s,;]+)"),
    re.compile(r"(?i)(api[_-]?key\s*[=:]\s*)([^\s,;]+)"),
    re.compile(r"(?i)(authorization\s*[=:]\s*)([^\s,;]+)"),
    re.compile(r"(?i)(password\s*[=:]\s*)([^\s,;]+)"),
    re.compile(r"(?i)(secret\s*[=:]\s*)([^\s,;]+)"),
]

_SAFE_BRANCH_CHARS = re.compile(r"[^a-z0-9._/-]+")
_MULTI_DASH = re.compile(r"-{2,}")


def _as_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _to_iso(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return _as_utc(value).isoformat()
    return str(value)


def _to_jsonb(value: Any) -> Jsonb | None:
    if value is None:
        return None
    return Jsonb(value)


def _normalize_stage(raw: str, *, default: str = "intake") -> str:
    candidate = str(raw or default).strip().lower()
    if candidate not in BUILD_STAGES:
        return default
    return candidate


def _normalize_execution_status(raw: str, *, default: str = "running") -> str:
    candidate = str(raw or default).strip().lower()
    if candidate not in EXECUTION_RUN_STATUSES:
        return default
    return candidate


def _normalize_proof_status(raw: str, *, default: str = "unknown") -> str:
    candidate = str(raw or default).strip().lower()
    if candidate not in PROOF_STATUSES:
        return default
    return candidate


def _normalize_verification_state(raw: str, *, default: str = "not_required") -> str:
    candidate = str(raw or default).strip().lower()
    if candidate not in VERIFICATION_STATES:
        return default
    return candidate


def _sanitize_output_excerpt(text: str | None, *, max_len: int = 3000) -> str:
    raw = str(text or "")
    if not raw:
        return ""
    redacted = raw
    for pattern in SENSITIVE_PATTERNS:
        redacted = pattern.sub(r"\1[REDACTED]", redacted)
    if len(redacted) > max_len:
        return redacted[:max_len]
    return redacted


def compute_recommendation(
    *,
    proof_status: str,
    verification_state: str,
    verification_required: bool,
    has_pr_draft: bool,
) -> dict[str, str]:
    normalized_proof = _normalize_proof_status(proof_status)
    normalized_verification = _normalize_verification_state(verification_state)

    if normalized_proof == "failed":
        return {"stage": "revise_before_pr", "recommendation": "revise_before_pr"}

    if normalized_proof == "unknown":
        return {"stage": "tests_run", "recommendation": "needs_execution"}

    if verification_required:
        if normalized_verification == "failed":
            return {"stage": "revise_before_pr", "recommendation": "revise_before_pr"}
        if normalized_verification == "pending":
            return {"stage": "verification_requested", "recommendation": "verification_requested"}
        if normalized_verification == "not_required":
            normalized_verification = "pending"
            return {"stage": "verification_requested", "recommendation": "verification_requested"}

    if has_pr_draft:
        return {"stage": "approval_pending", "recommendation": "approval_pending"}
    return {"stage": "ready_for_pr_review", "recommendation": "ready_for_pr_review"}


def _normalize_github_checks_status(raw: str, *, default: str = "unknown") -> str:
    candidate = str(raw or default).strip().lower()
    if candidate not in GITHUB_CHECK_STATUSES:
        return default
    return candidate


def _normalize_github_review_status(raw: str, *, default: str = "unknown") -> str:
    candidate = str(raw or default).strip().lower()
    if candidate not in GITHUB_REVIEW_STATUSES:
        return default
    return candidate


def _normalize_github_pr_state(raw: str, *, default: str = "unknown") -> str:
    candidate = str(raw or default).strip().lower()
    if candidate not in GITHUB_PR_STATES:
        return default
    return candidate


def _normalize_github_writeback_status(raw: str, *, default: str = "never") -> str:
    candidate = str(raw or default).strip().lower()
    if candidate not in GITHUB_WRITEBACK_STATUSES:
        return default
    return candidate


def _github_token() -> str | None:
    for name in ("GITHUB_TOKEN", "GH_TOKEN"):
        token = str(os.getenv(name, "")).strip()
        if token:
            return token
    return None


def _parse_repo_from_pr_url(pr_url: str | None) -> str | None:
    raw = str(pr_url or "").strip()
    if not raw:
        return None
    pattern = re.compile(r"github\.com/([^/]+/[^/]+)/pull/\d+", re.IGNORECASE)
    match = pattern.search(raw)
    if not match:
        return None
    return match.group(1)


def _parse_pr_number(pr_number: str | None, pr_url: str | None) -> str | None:
    direct = str(pr_number or "").strip()
    if direct.isdigit():
        return direct
    raw_url = str(pr_url or "").strip()
    if not raw_url:
        return None
    match = re.search(r"/pull/(\d+)", raw_url)
    if not match:
        return None
    return match.group(1)


def _derive_checks_status(check_runs: list[dict[str, Any]]) -> str:
    if not check_runs:
        return "unknown"
    any_pending = False
    for run in check_runs:
        status = str(run.get("status") or "").strip().lower()
        conclusion = str(run.get("conclusion") or "").strip().lower()
        if status != "completed":
            any_pending = True
            continue
        if conclusion not in {"success", "neutral", "skipped"}:
            return "failing"
    if any_pending:
        return "pending"
    return "passing"


def _derive_review_status(reviews: list[dict[str, Any]]) -> str:
    if not reviews:
        return "pending"
    has_approval = False
    for review in reviews:
        state = str(review.get("state") or "").strip().upper()
        if state == "CHANGES_REQUESTED":
            return "changes_requested"
        if state == "APPROVED":
            has_approval = True
    if has_approval:
        return "approved"
    return "pending"


def evaluate_github_merge_readiness(
    *,
    proof_status: str,
    verification_state: str,
    verification_required: bool,
    github_sync: dict[str, Any] | None,
) -> dict[str, Any]:
    base = compute_recommendation(
        proof_status=proof_status,
        verification_state=verification_state,
        verification_required=verification_required,
        has_pr_draft=True,
    )
    reasons: list[str] = []
    if base["stage"] != "approval_pending":
        reasons.append("proof_or_verification_incomplete")
        return {"ready": False, "reasons": reasons, "stage": base["stage"], "recommendation": base["recommendation"]}

    if not github_sync:
        reasons.append("github_sync_missing")
        return {"ready": False, "reasons": reasons, "stage": "approval_pending", "recommendation": "approval_pending"}

    pr_state = _normalize_github_pr_state(str(github_sync.get("pr_state") or "unknown"))
    mergeability = str(github_sync.get("mergeability_summary") or "").strip().upper()
    checks_status = _normalize_github_checks_status(str(github_sync.get("checks_status") or "unknown"))
    review_status = _normalize_github_review_status(str(github_sync.get("review_status") or "unknown"))

    if pr_state != "open":
        reasons.append("pr_not_open")
    if mergeability not in {"CLEAN", "HAS_HOOKS"}:
        reasons.append("mergeability_blocked")
    if checks_status != "passing":
        reasons.append("checks_not_passing")
    if review_status != "approved":
        reasons.append("review_not_approved")

    if reasons:
        return {"ready": False, "reasons": reasons, "stage": "approval_pending", "recommendation": "approval_pending"}
    return {"ready": True, "reasons": [], "stage": "ready_for_merge", "recommendation": "ready_for_merge"}


def _safe_branch_slug(value: str) -> str:
    normalized = str(value or "").strip().lower()
    if not normalized:
        return "build-request"
    normalized = normalized.replace(" ", "-")
    normalized = _SAFE_BRANCH_CHARS.sub("-", normalized)
    normalized = _MULTI_DASH.sub("-", normalized).strip("-")
    if not normalized:
        return "build-request"
    return normalized[:48]


def generate_safe_branch_name(goal: str, *, build_request_id: str | None = None) -> str:
    slug = _safe_branch_slug(goal)
    suffix = str(build_request_id or uuid4()).replace("-", "")[:8]
    return f"build/{slug}-{suffix}"


def _serialize_build_request(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": row["id"],
        "tenant_id": row["tenant_id"],
        "goal": row["goal"],
        "scope_summary": row["scope_summary"],
        "constraints_json": row["constraints_json"] or {},
        "requested_model_lane": row["requested_model_lane"],
        "sensitive_change": bool(row["sensitive_change"]),
        "desired_proof": row["desired_proof"],
        "stage": row["stage"],
        "router_decision_id": row["router_decision_id"],
        "mission_id": row["mission_id"],
        "branch_name": row["branch_name"],
        "pr_url": row["pr_url"],
        "pr_number": row["pr_number"],
        "proof_summary": row["proof_summary"],
        "test_summary": row["test_summary"],
        "files_changed_summary": row["files_changed_summary"],
        "proof_status": row["proof_status"],
        "verification_state": row["verification_state"],
        "recommendation": row["recommendation"],
        "latest_execution_run_id": row["latest_execution_run_id"],
        "failure_note": row["failure_note"],
        "rollback_note": row["rollback_note"],
        "github_repo": row["github_repo"],
        "github_head_ref": row["github_head_ref"],
        "github_base_ref": row["github_base_ref"],
        "github_writeback_status": row["github_writeback_status"],
        "github_writeback_error": row["github_writeback_error"],
        "github_last_writeback_at": _to_iso(row["github_last_writeback_at"]),
        "created_by": row["created_by"],
        "created_at": _to_iso(row["created_at"]),
        "updated_at": _to_iso(row["updated_at"]),
    }


def _serialize_branch_record(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": row["id"],
        "build_request_id": row["build_request_id"],
        "tenant_id": row["tenant_id"],
        "branch_name": row["branch_name"],
        "source_branch": row["source_branch"],
        "status": row["status"],
        "created_by": row["created_by"],
        "created_at": _to_iso(row["created_at"]),
        "updated_at": _to_iso(row["updated_at"]),
    }


def _serialize_event(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": int(row["id"]),
        "build_request_id": row["build_request_id"],
        "tenant_id": row["tenant_id"],
        "event_type": row["event_type"],
        "detail": row["detail"],
        "metadata": row["metadata"] or {},
        "created_by": row["created_by"],
        "at": _to_iso(row["created_at"]),
    }


def _serialize_execution_run(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": row["id"],
        "build_request_id": row["build_request_id"],
        "tenant_id": row["tenant_id"],
        "router_decision_id": row["router_decision_id"],
        "mission_id": row["mission_id"],
        "command_class": row["command_class"],
        "target_scope": row["target_scope"],
        "status": row["status"],
        "summary": row["summary"],
        "lint_build_summary": row["lint_build_summary"],
        "test_summary": row["test_summary"],
        "changed_files_summary": row["changed_files_summary"],
        "execution_output_excerpt": row["execution_output_excerpt"],
        "proof_status": row["proof_status"],
        "failure_note": row["failure_note"],
        "rollback_note": row["rollback_note"],
        "started_at": _to_iso(row["started_at"]),
        "finished_at": _to_iso(row["finished_at"]),
        "created_by": row["created_by"],
        "created_at": _to_iso(row["created_at"]),
        "updated_at": _to_iso(row["updated_at"]),
    }


def _serialize_github_sync(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": row["id"],
        "build_request_id": row["build_request_id"],
        "tenant_id": row["tenant_id"],
        "repo": row["repo"],
        "branch": row["branch"],
        "pr_number": row["pr_number"],
        "pr_state": row["pr_state"],
        "mergeability_summary": row["mergeability_summary"],
        "checks_status": row["checks_status"],
        "review_status": row["review_status"],
        "head_ref": row["head_ref"],
        "base_ref": row["base_ref"],
        "blocked_reasons": row["blocked_reasons_json"] or [],
        "sync_payload": row["sync_payload_json"] or {},
        "synced_at": _to_iso(row["synced_at"]),
        "created_by": row["created_by"],
        "created_at": _to_iso(row["created_at"]),
        "updated_at": _to_iso(row["updated_at"]),
    }


def init_build_intake_tables() -> None:
    with connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS build_requests(
                    id text PRIMARY KEY,
                    tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
                    goal text NOT NULL DEFAULT '',
                    scope_summary text NOT NULL DEFAULT '',
                    constraints_json jsonb NOT NULL DEFAULT '{}'::jsonb,
                    requested_model_lane text NOT NULL DEFAULT '',
                    sensitive_change boolean NOT NULL DEFAULT false,
                    desired_proof text NOT NULL DEFAULT '',
                    stage text NOT NULL DEFAULT 'intake',
                    router_decision_id text,
                    mission_id text,
                    branch_name text,
                    pr_url text,
                    pr_number text,
                    proof_summary text NOT NULL DEFAULT '',
                    test_summary text NOT NULL DEFAULT '',
                    files_changed_summary text NOT NULL DEFAULT '',
                    proof_status text NOT NULL DEFAULT 'unknown',
                    verification_state text NOT NULL DEFAULT 'not_required',
                    recommendation text NOT NULL DEFAULT 'needs_execution',
                    latest_execution_run_id text,
                    failure_note text NOT NULL DEFAULT '',
                    rollback_note text NOT NULL DEFAULT '',
                    github_repo text NOT NULL DEFAULT '',
                    github_head_ref text NOT NULL DEFAULT '',
                    github_base_ref text NOT NULL DEFAULT 'main',
                    github_writeback_status text NOT NULL DEFAULT 'never',
                    github_writeback_error text NOT NULL DEFAULT '',
                    github_last_writeback_at timestamptz,
                    created_by text NOT NULL DEFAULT 'admin',
                    created_at timestamptz NOT NULL DEFAULT now(),
                    updated_at timestamptz NOT NULL DEFAULT now()
                );
                """
            )
            cur.execute(
                """
                ALTER TABLE build_requests
                ADD COLUMN IF NOT EXISTS proof_status text NOT NULL DEFAULT 'unknown';
                """
            )
            cur.execute(
                """
                ALTER TABLE build_requests
                ADD COLUMN IF NOT EXISTS verification_state text NOT NULL DEFAULT 'not_required';
                """
            )
            cur.execute(
                """
                ALTER TABLE build_requests
                ADD COLUMN IF NOT EXISTS recommendation text NOT NULL DEFAULT 'needs_execution';
                """
            )
            cur.execute(
                """
                ALTER TABLE build_requests
                ADD COLUMN IF NOT EXISTS latest_execution_run_id text;
                """
            )
            cur.execute(
                """
                ALTER TABLE build_requests
                ADD COLUMN IF NOT EXISTS failure_note text NOT NULL DEFAULT '';
                """
            )
            cur.execute(
                """
                ALTER TABLE build_requests
                ADD COLUMN IF NOT EXISTS rollback_note text NOT NULL DEFAULT '';
                """
            )
            cur.execute(
                """
                ALTER TABLE build_requests
                ADD COLUMN IF NOT EXISTS github_repo text NOT NULL DEFAULT '';
                """
            )
            cur.execute(
                """
                ALTER TABLE build_requests
                ADD COLUMN IF NOT EXISTS github_head_ref text NOT NULL DEFAULT '';
                """
            )
            cur.execute(
                """
                ALTER TABLE build_requests
                ADD COLUMN IF NOT EXISTS github_base_ref text NOT NULL DEFAULT 'main';
                """
            )
            cur.execute(
                """
                ALTER TABLE build_requests
                ADD COLUMN IF NOT EXISTS github_writeback_status text NOT NULL DEFAULT 'never';
                """
            )
            cur.execute(
                """
                ALTER TABLE build_requests
                ADD COLUMN IF NOT EXISTS github_writeback_error text NOT NULL DEFAULT '';
                """
            )
            cur.execute(
                """
                ALTER TABLE build_requests
                ADD COLUMN IF NOT EXISTS github_last_writeback_at timestamptz;
                """
            )
            cur.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_build_requests_tenant_created
                ON build_requests (tenant_id, created_at DESC);
                """
            )
            cur.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_build_requests_stage
                ON build_requests (tenant_id, stage, updated_at DESC);
                """
            )
            cur.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_build_requests_recommendation
                ON build_requests (tenant_id, recommendation, updated_at DESC);
                """
            )
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS build_request_branches(
                    id text PRIMARY KEY,
                    build_request_id text NOT NULL REFERENCES build_requests(id) ON DELETE CASCADE,
                    tenant_id text NOT NULL,
                    branch_name text NOT NULL,
                    source_branch text NOT NULL DEFAULT 'main',
                    status text NOT NULL DEFAULT 'created',
                    created_by text NOT NULL DEFAULT 'admin',
                    created_at timestamptz NOT NULL DEFAULT now(),
                    updated_at timestamptz NOT NULL DEFAULT now()
                );
                """
            )
            cur.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_build_branches_request_created
                ON build_request_branches (build_request_id, created_at DESC);
                """
            )
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS build_request_events(
                    id bigserial PRIMARY KEY,
                    build_request_id text NOT NULL REFERENCES build_requests(id) ON DELETE CASCADE,
                    tenant_id text NOT NULL,
                    event_type text NOT NULL,
                    detail text NOT NULL DEFAULT '',
                    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
                    created_by text NOT NULL DEFAULT 'admin',
                    created_at timestamptz NOT NULL DEFAULT now()
                );
                """
            )
            cur.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_build_events_request_created
                ON build_request_events (build_request_id, created_at ASC);
                """
            )
            cur.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_build_events_tenant_created
                ON build_request_events (tenant_id, created_at DESC);
                """
            )
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS build_execution_runs(
                    id text PRIMARY KEY,
                    build_request_id text NOT NULL REFERENCES build_requests(id) ON DELETE CASCADE,
                    tenant_id text NOT NULL,
                    router_decision_id text,
                    mission_id text,
                    command_class text NOT NULL DEFAULT '',
                    target_scope text NOT NULL DEFAULT '',
                    status text NOT NULL DEFAULT 'running',
                    summary text NOT NULL DEFAULT '',
                    lint_build_summary text NOT NULL DEFAULT '',
                    test_summary text NOT NULL DEFAULT '',
                    changed_files_summary text NOT NULL DEFAULT '',
                    execution_output_excerpt text NOT NULL DEFAULT '',
                    proof_status text NOT NULL DEFAULT 'unknown',
                    failure_note text NOT NULL DEFAULT '',
                    rollback_note text NOT NULL DEFAULT '',
                    started_at timestamptz NOT NULL DEFAULT now(),
                    finished_at timestamptz,
                    created_by text NOT NULL DEFAULT 'admin',
                    created_at timestamptz NOT NULL DEFAULT now(),
                    updated_at timestamptz NOT NULL DEFAULT now()
                );
                """
            )
            cur.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_build_execution_runs_request
                ON build_execution_runs (build_request_id, created_at DESC);
                """
            )
            cur.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_build_execution_runs_tenant
                ON build_execution_runs (tenant_id, created_at DESC);
                """
            )
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS build_github_sync_states(
                    id text PRIMARY KEY,
                    build_request_id text NOT NULL REFERENCES build_requests(id) ON DELETE CASCADE,
                    tenant_id text NOT NULL,
                    repo text NOT NULL DEFAULT '',
                    branch text NOT NULL DEFAULT '',
                    pr_number text NOT NULL DEFAULT '',
                    pr_state text NOT NULL DEFAULT 'unknown',
                    mergeability_summary text NOT NULL DEFAULT '',
                    checks_status text NOT NULL DEFAULT 'unknown',
                    review_status text NOT NULL DEFAULT 'unknown',
                    head_ref text NOT NULL DEFAULT '',
                    base_ref text NOT NULL DEFAULT '',
                    blocked_reasons_json jsonb NOT NULL DEFAULT '[]'::jsonb,
                    sync_payload_json jsonb NOT NULL DEFAULT '{}'::jsonb,
                    synced_at timestamptz NOT NULL DEFAULT now(),
                    created_by text NOT NULL DEFAULT 'admin',
                    created_at timestamptz NOT NULL DEFAULT now(),
                    updated_at timestamptz NOT NULL DEFAULT now()
                );
                """
            )
            cur.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_build_github_sync_request
                ON build_github_sync_states (build_request_id, synced_at DESC);
                """
            )
            cur.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_build_github_sync_tenant
                ON build_github_sync_states (tenant_id, synced_at DESC);
                """
            )
        conn.commit()


def _get_build_request_row(build_request_id: str) -> dict[str, Any] | None:
    with connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                    id,
                    tenant_id,
                    goal,
                    scope_summary,
                    constraints_json,
                    requested_model_lane,
                    sensitive_change,
                    desired_proof,
                    stage,
                    router_decision_id,
                    mission_id,
                    branch_name,
                    pr_url,
                    pr_number,
                    proof_summary,
                    test_summary,
                    files_changed_summary,
                    proof_status,
                    verification_state,
                    recommendation,
                    latest_execution_run_id,
                    failure_note,
                    rollback_note,
                    github_repo,
                    github_head_ref,
                    github_base_ref,
                    github_writeback_status,
                    github_writeback_error,
                    github_last_writeback_at,
                    created_by,
                    created_at,
                    updated_at
                FROM build_requests
                WHERE id = %s;
                """,
                (build_request_id,),
            )
            return cur.fetchone()


def record_build_event(
    *,
    build_request_id: str,
    tenant_id: str,
    event_type: str,
    detail: str = "",
    metadata: dict[str, Any] | None = None,
    created_by: str = "admin",
) -> None:
    with connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO build_request_events(
                    build_request_id,
                    tenant_id,
                    event_type,
                    detail,
                    metadata,
                    created_by
                )
                VALUES (%s, %s, %s, %s, %s, %s);
                """,
                (
                    build_request_id,
                    tenant_id,
                    event_type,
                    str(detail or "").strip(),
                    _to_jsonb(metadata or {}),
                    str(created_by or "").strip() or "admin",
                ),
            )
        conn.commit()


def list_build_events(build_request_id: str, *, limit: int = 500) -> list[dict[str, Any]]:
    safe_limit = min(max(int(limit), 1), 2000)
    with connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                    id,
                    build_request_id,
                    tenant_id,
                    event_type,
                    detail,
                    metadata,
                    created_by,
                    created_at
                FROM build_request_events
                WHERE build_request_id = %s
                ORDER BY created_at ASC
                LIMIT %s;
                """,
                (build_request_id, safe_limit),
            )
            rows = cur.fetchall()
    return [_serialize_event(row) for row in rows]


def _get_execution_run_row(run_id: str) -> dict[str, Any] | None:
    with connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                    id,
                    build_request_id,
                    tenant_id,
                    router_decision_id,
                    mission_id,
                    command_class,
                    target_scope,
                    status,
                    summary,
                    lint_build_summary,
                    test_summary,
                    changed_files_summary,
                    execution_output_excerpt,
                    proof_status,
                    failure_note,
                    rollback_note,
                    started_at,
                    finished_at,
                    created_by,
                    created_at,
                    updated_at
                FROM build_execution_runs
                WHERE id = %s;
                """,
                (run_id,),
            )
            return cur.fetchone()


def list_execution_runs(build_request_id: str, *, limit: int = 100) -> list[dict[str, Any]]:
    safe_limit = min(max(int(limit), 1), 500)
    with connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                    id,
                    build_request_id,
                    tenant_id,
                    router_decision_id,
                    mission_id,
                    command_class,
                    target_scope,
                    status,
                    summary,
                    lint_build_summary,
                    test_summary,
                    changed_files_summary,
                    execution_output_excerpt,
                    proof_status,
                    failure_note,
                    rollback_note,
                    started_at,
                    finished_at,
                    created_by,
                    created_at,
                    updated_at
                FROM build_execution_runs
                WHERE build_request_id = %s
                ORDER BY created_at DESC
                LIMIT %s;
                """,
                (build_request_id, safe_limit),
            )
            rows = cur.fetchall()
    return [_serialize_execution_run(row) for row in rows]


def _build_has_pr_link(row: dict[str, Any]) -> bool:
    pr_url = str(row.get("pr_url") or "").strip()
    pr_number = str(row.get("pr_number") or "").strip()
    return bool(pr_url or pr_number)


def _resolve_verification_required(
    row: dict[str, Any],
    *,
    request_verification: bool = False,
    verification_required_override: bool | None = None,
) -> bool:
    if verification_required_override is not None:
        required = bool(verification_required_override)
    else:
        required = bool(row.get("sensitive_change"))
        decision_id = str(row.get("router_decision_id") or "").strip()
        if decision_id:
            decision = get_model_router_decision(decision_id, include_events=False)
            if isinstance(decision, dict) and bool(decision.get("verification_required")):
                required = True
    if request_verification:
        required = True
    return required


def _infer_execution_proof_status(*, execution_status: str, proof_status: str | None) -> str:
    normalized = _normalize_proof_status(proof_status or "unknown")
    normalized_status = _normalize_execution_status(execution_status)
    if normalized != "unknown":
        return normalized
    if normalized_status == "passed":
        return "passed"
    if normalized_status in {"failed", "error", "cancelled"}:
        return "failed"
    return "unknown"


def _get_latest_github_sync_row(build_request_id: str) -> dict[str, Any] | None:
    with connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                    id,
                    build_request_id,
                    tenant_id,
                    repo,
                    branch,
                    pr_number,
                    pr_state,
                    mergeability_summary,
                    checks_status,
                    review_status,
                    head_ref,
                    base_ref,
                    blocked_reasons_json,
                    sync_payload_json,
                    synced_at,
                    created_by,
                    created_at,
                    updated_at
                FROM build_github_sync_states
                WHERE build_request_id = %s
                ORDER BY synced_at DESC
                LIMIT 1;
                """,
                (build_request_id,),
            )
            return cur.fetchone()


def get_latest_github_sync_state(build_request_id: str) -> dict[str, Any] | None:
    row = _get_latest_github_sync_row(build_request_id)
    if row is None:
        return None
    return _serialize_github_sync(row)


def _compute_github_sync_drift(build_row: dict[str, Any], github_sync: dict[str, Any] | None) -> dict[str, Any]:
    if github_sync is None:
        return {"has_drift": False, "items": []}

    items: list[dict[str, str]] = []
    stored_pr = _parse_pr_number(
        str(build_row.get("pr_number") or ""),
        str(build_row.get("pr_url") or ""),
    )
    live_pr = str(github_sync.get("pr_number") or "").strip() or None
    if stored_pr and live_pr and stored_pr != live_pr:
        items.append(
            {
                "field": "pr_number",
                "stored": stored_pr,
                "live": live_pr,
                "reason": "stored_pr_differs_from_github",
            }
        )

    stored_branch = (
        str(build_row.get("github_head_ref") or "").strip()
        or str(build_row.get("branch_name") or "").strip()
        or None
    )
    live_head = str(github_sync.get("head_ref") or "").strip() or None
    if stored_branch and live_head and stored_branch != live_head:
        items.append(
            {
                "field": "branch",
                "stored": stored_branch,
                "live": live_head,
                "reason": "stored_branch_differs_from_github_head",
            }
        )

    stored_repo = str(build_row.get("github_repo") or "").strip() or _parse_repo_from_pr_url(str(build_row.get("pr_url") or ""))
    live_repo = str(github_sync.get("repo") or "").strip() or None
    if stored_repo and live_repo and stored_repo.lower() != live_repo.lower():
        items.append(
            {
                "field": "repo",
                "stored": stored_repo,
                "live": live_repo,
                "reason": "stored_repo_differs_from_github_repo",
            }
        )

    return {"has_drift": bool(items), "items": items}


def _fetch_github_pr_snapshot(*, repo: str, pr_number: str, token: str) -> dict[str, Any]:
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    timeout = httpx.Timeout(15.0, connect=5.0)
    with httpx.Client(base_url="https://api.github.com", headers=headers, timeout=timeout) as client:
        pr_response = client.get(f"/repos/{repo}/pulls/{pr_number}")
        if pr_response.status_code >= 400:
            raise ValueError(f"GitHub PR lookup failed ({pr_response.status_code})")
        pr_data = pr_response.json()
        head_ref = str(((pr_data.get("head") or {}).get("ref")) or "").strip()
        base_ref = str(((pr_data.get("base") or {}).get("ref")) or "").strip()
        head_sha = str(((pr_data.get("head") or {}).get("sha")) or "").strip()

        check_runs: list[dict[str, Any]] = []
        if head_sha:
            checks_response = client.get(f"/repos/{repo}/commits/{head_sha}/check-runs")
            if checks_response.status_code < 400:
                check_runs = list((checks_response.json() or {}).get("check_runs") or [])

        reviews_response = client.get(f"/repos/{repo}/pulls/{pr_number}/reviews")
        reviews: list[dict[str, Any]] = []
        if reviews_response.status_code < 400:
            reviews = list(reviews_response.json() or [])

        merged_at = pr_data.get("merged_at")
        pr_state = "merged" if merged_at else _normalize_github_pr_state(str(pr_data.get("state") or "unknown"))
        checks_status = _derive_checks_status(check_runs)
        review_status = _derive_review_status(reviews)
        mergeability_summary = str(pr_data.get("mergeable_state") or "").strip().upper()

    return {
        "repo": repo,
        "branch": head_ref,
        "pr_number": str(pr_number),
        "pr_state": pr_state,
        "mergeability_summary": mergeability_summary,
        "checks_status": checks_status,
        "review_status": review_status,
        "head_ref": head_ref,
        "base_ref": base_ref,
        "sync_payload": {
            "pr": {
                "state": pr_data.get("state"),
                "merged_at": merged_at,
                "mergeable": pr_data.get("mergeable"),
                "mergeable_state": pr_data.get("mergeable_state"),
                "draft": pr_data.get("draft"),
            },
            "checks": {
                "total": len(check_runs),
                "status": checks_status,
            },
            "reviews": {
                "total": len(reviews),
                "status": review_status,
            },
        },
    }


def _github_api_headers(token: str) -> dict[str, str]:
    return {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }


def _github_error_message(response: httpx.Response) -> str:
    try:
        payload = response.json()
    except ValueError:
        payload = {}
    message = str((payload or {}).get("message") or "").strip()
    if message:
        return f"{message} ({response.status_code})"
    return f"GitHub API request failed ({response.status_code})"


def _owner_from_repo(repo: str) -> str | None:
    raw = str(repo or "").strip()
    if "/" not in raw:
        return None
    owner = raw.split("/", 1)[0].strip()
    return owner or None


def _default_pr_title(goal: str) -> str:
    compact = " ".join(str(goal or "").split()).strip()
    if not compact:
        return "build: update implementation"
    trimmed = compact[:92]
    return f"build: {trimmed}"


def generate_build_request_pr_body(row: dict[str, Any]) -> str:
    constraints = row.get("constraints_json") if isinstance(row.get("constraints_json"), dict) else {}
    constraints_text = "{}"
    if constraints:
        constraints_text = json.dumps(constraints, indent=2, sort_keys=True)

    lines: list[str] = [
        "## Goal",
        str(row.get("goal") or "-"),
        "",
        "## Scope",
        str(row.get("scope_summary") or "-"),
        "",
        "## Constraints",
        f"```json\n{constraints_text}\n```",
        "",
        "## Proof",
        f"- proof summary: {str(row.get('proof_summary') or '-').strip() or '-'}",
        f"- test summary: {str(row.get('test_summary') or '-').strip() or '-'}",
        f"- files changed summary: {str(row.get('files_changed_summary') or '-').strip() or '-'}",
        "",
        "## Recommendation",
        f"- {str(row.get('recommendation') or '-').strip() or '-'}",
    ]

    failure_note = str(row.get("failure_note") or "").strip()
    rollback_note = str(row.get("rollback_note") or "").strip()
    if failure_note or rollback_note:
        lines.extend(["", "## Risk Notes"])
        if failure_note:
            lines.append(f"- failure note: {failure_note}")
        if rollback_note:
            lines.append(f"- rollback note: {rollback_note}")

    return "\n".join(lines).strip()


def create_build_request(
    *,
    tenant_id: str,
    goal: str,
    scope_summary: str,
    constraints_json: dict[str, Any] | None,
    requested_model_lane: str,
    sensitive_change: bool,
    desired_proof: str,
    created_by: str = "admin",
) -> dict[str, Any]:
    build_request_id = str(uuid4())
    with connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO build_requests(
                    id,
                    tenant_id,
                    goal,
                    scope_summary,
                    constraints_json,
                    requested_model_lane,
                    sensitive_change,
                    desired_proof,
                    stage,
                    created_by
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 'intake', %s);
                """,
                (
                    build_request_id,
                    tenant_id,
                    str(goal or "").strip(),
                    str(scope_summary or "").strip(),
                    _to_jsonb(constraints_json or {}),
                    str(requested_model_lane or "").strip(),
                    bool(sensitive_change),
                    str(desired_proof or "").strip(),
                    str(created_by or "").strip() or "admin",
                ),
            )
        conn.commit()

    record_build_event(
        build_request_id=build_request_id,
        tenant_id=tenant_id,
        event_type="intake",
        detail="Build intake created",
        metadata={
            "requested_model_lane": requested_model_lane,
            "sensitive_change": bool(sensitive_change),
        },
        created_by=created_by,
    )

    request = get_build_request(build_request_id)
    if request is None:
        raise RuntimeError("Failed to create build request")
    return request


def list_build_requests(
    *,
    tenant_id: str,
    stage: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> dict[str, Any]:
    safe_limit = min(max(int(limit), 1), 200)
    safe_offset = max(int(offset), 0)
    conditions = ["tenant_id = %s"]
    params: list[Any] = [tenant_id]
    normalized_stage = str(stage or "").strip().lower()
    if normalized_stage:
        conditions.append("stage = %s")
        params.append(_normalize_stage(normalized_stage))
    where_clause = f"WHERE {' AND '.join(conditions)}"

    with connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"""
                SELECT count(*)::int AS total
                FROM build_requests
                {where_clause};
                """,
                tuple(params),
            )
            count_row = cur.fetchone() or {}

            cur.execute(
                f"""
                SELECT
                    id,
                    tenant_id,
                    goal,
                    scope_summary,
                    constraints_json,
                    requested_model_lane,
                    sensitive_change,
                    desired_proof,
                    stage,
                    router_decision_id,
                    mission_id,
                    branch_name,
                    pr_url,
                    pr_number,
                    proof_summary,
                    test_summary,
                    files_changed_summary,
                    proof_status,
                    verification_state,
                    recommendation,
                    latest_execution_run_id,
                    failure_note,
                    rollback_note,
                    github_repo,
                    github_head_ref,
                    github_base_ref,
                    github_writeback_status,
                    github_writeback_error,
                    github_last_writeback_at,
                    created_by,
                    created_at,
                    updated_at
                FROM build_requests
                {where_clause}
                ORDER BY created_at DESC
                LIMIT %s
                OFFSET %s;
                """,
                (*params, safe_limit, safe_offset),
            )
            rows = cur.fetchall()

    return {
        "tenant_id": tenant_id,
        "items": [_serialize_build_request(row) for row in rows],
        "total": int(count_row.get("total") or 0),
        "limit": safe_limit,
        "offset": safe_offset,
    }


def _list_branch_records(build_request_id: str) -> list[dict[str, Any]]:
    with connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                    id,
                    build_request_id,
                    tenant_id,
                    branch_name,
                    source_branch,
                    status,
                    created_by,
                    created_at,
                    updated_at
                FROM build_request_branches
                WHERE build_request_id = %s
                ORDER BY created_at DESC;
                """,
                (build_request_id,),
            )
            rows = cur.fetchall()
    return [_serialize_branch_record(row) for row in rows]


def get_build_request(build_request_id: str, *, include_timeline: bool = True) -> dict[str, Any] | None:
    row = _get_build_request_row(build_request_id)
    if row is None:
        return None

    request = _serialize_build_request(row)
    request["branches"] = _list_branch_records(build_request_id)
    request["execution_runs"] = list_execution_runs(build_request_id, limit=200)
    github_sync = get_latest_github_sync_state(build_request_id)
    request["github_sync"] = github_sync
    request["github_sync_drift"] = _compute_github_sync_drift(row, github_sync)

    if include_timeline:
        timeline: list[dict[str, Any]] = []
        for event in list_build_events(build_request_id):
            timeline.append(
                {
                    "at": event["at"],
                    "event_type": event["event_type"],
                    "status": "ok",
                    "detail": event["detail"],
                    "metadata": {
                        "source": "build_intake",
                        "created_by": event.get("created_by"),
                        **(event.get("metadata") or {}),
                    },
                }
            )

        decision_id = request.get("router_decision_id")
        if isinstance(decision_id, str) and decision_id.strip():
            for event in list_model_router_decision_events(decision_id):
                timeline.append(
                    {
                        "at": event.get("at"),
                        "event_type": f"router_{event.get('event_type')}",
                        "status": str(event.get("status") or "ok"),
                        "detail": event.get("detail") or "",
                        "metadata": {
                            "source": "model_router",
                            "created_by": event.get("created_by"),
                            **(event.get("metadata") or {}),
                        },
                    }
                )

        mission_id = request.get("mission_id")
        if isinstance(mission_id, str) and mission_id.strip():
            mission = get_familyops_mission(mission_id, tenant_id=str(request.get("tenant_id") or "familyops"))
            if mission is not None:
                request["linked_mission"] = mission
                for event in mission.get("timeline") or []:
                    if isinstance(event, dict):
                        timeline.append(
                            {
                                "at": _to_iso(event.get("at")),
                                "event_type": f"mission_{event.get('event_type')}",
                                "status": str(event.get("status") or "ok"),
                                "detail": str(event.get("detail") or ""),
                                "metadata": {
                                    "source": "mission_history",
                                    **(event.get("metadata") or {}),
                                },
                            }
                        )

        timeline.sort(key=lambda item: item.get("at") or "")
        request["timeline"] = timeline

    decision_id = request.get("router_decision_id")
    if isinstance(decision_id, str) and decision_id.strip():
        request["linked_router_decision"] = get_model_router_decision(decision_id, include_events=False)

    return request


def _update_build_request(
    build_request_id: str,
    *,
    stage: str | None = None,
    router_decision_id: str | None = None,
    mission_id: str | None = None,
    branch_name: str | None = None,
    pr_url: str | None = None,
    pr_number: str | None = None,
    proof_summary: str | None = None,
    test_summary: str | None = None,
    files_changed_summary: str | None = None,
    proof_status: str | None = None,
    verification_state: str | None = None,
    recommendation: str | None = None,
    latest_execution_run_id: str | None = None,
    failure_note: str | None = None,
    rollback_note: str | None = None,
    github_repo: str | None = None,
    github_head_ref: str | None = None,
    github_base_ref: str | None = None,
    github_writeback_status: str | None = None,
    github_writeback_error: str | None = None,
    github_last_writeback_at: datetime | None = None,
) -> None:
    fields: list[str] = []
    values: list[Any] = []
    if stage is not None:
        fields.append("stage = %s")
        values.append(_normalize_stage(stage))
    if router_decision_id is not None:
        fields.append("router_decision_id = %s")
        values.append(router_decision_id)
    if mission_id is not None:
        fields.append("mission_id = %s")
        values.append(mission_id)
    if branch_name is not None:
        fields.append("branch_name = %s")
        values.append(branch_name)
    if pr_url is not None:
        fields.append("pr_url = %s")
        values.append(pr_url)
    if pr_number is not None:
        fields.append("pr_number = %s")
        values.append(pr_number)
    if proof_summary is not None:
        fields.append("proof_summary = %s")
        values.append(proof_summary)
    if test_summary is not None:
        fields.append("test_summary = %s")
        values.append(test_summary)
    if files_changed_summary is not None:
        fields.append("files_changed_summary = %s")
        values.append(files_changed_summary)
    if proof_status is not None:
        fields.append("proof_status = %s")
        values.append(_normalize_proof_status(proof_status))
    if verification_state is not None:
        fields.append("verification_state = %s")
        values.append(_normalize_verification_state(verification_state))
    if recommendation is not None:
        candidate_recommendation = str(recommendation or "").strip().lower()
        if candidate_recommendation not in RECOMMENDATIONS:
            candidate_recommendation = "needs_execution"
        fields.append("recommendation = %s")
        values.append(candidate_recommendation)
    if latest_execution_run_id is not None:
        fields.append("latest_execution_run_id = %s")
        values.append(str(latest_execution_run_id or "").strip() or None)
    if failure_note is not None:
        fields.append("failure_note = %s")
        values.append(str(failure_note or "").strip())
    if rollback_note is not None:
        fields.append("rollback_note = %s")
        values.append(str(rollback_note or "").strip())
    if github_repo is not None:
        fields.append("github_repo = %s")
        values.append(str(github_repo or "").strip())
    if github_head_ref is not None:
        fields.append("github_head_ref = %s")
        values.append(str(github_head_ref or "").strip())
    if github_base_ref is not None:
        fields.append("github_base_ref = %s")
        values.append(str(github_base_ref or "").strip() or "main")
    if github_writeback_status is not None:
        fields.append("github_writeback_status = %s")
        values.append(_normalize_github_writeback_status(github_writeback_status))
    if github_writeback_error is not None:
        fields.append("github_writeback_error = %s")
        values.append(str(github_writeback_error or "").strip())
    if github_last_writeback_at is not None:
        fields.append("github_last_writeback_at = %s")
        values.append(github_last_writeback_at)
    if not fields:
        return

    fields.append("updated_at = now()")
    with connect() as conn:
        with conn.cursor() as cur:
            sql = f"UPDATE build_requests SET {', '.join(fields)} WHERE id = %s;"
            values.append(build_request_id)
            cur.execute(sql, tuple(values))
        conn.commit()


def transition_build_stage(
    build_request_id: str,
    *,
    stage: str,
    actor: str,
    detail: str = "",
    metadata: dict[str, Any] | None = None,
) -> dict[str, Any] | None:
    row = _get_build_request_row(build_request_id)
    if row is None:
        return None
    next_stage = _normalize_stage(stage)
    _update_build_request(build_request_id, stage=next_stage)
    record_build_event(
        build_request_id=build_request_id,
        tenant_id=row["tenant_id"],
        event_type=next_stage,
        detail=detail or f"Stage set to {next_stage}",
        metadata=metadata or {},
        created_by=actor,
    )
    return get_build_request(build_request_id)


def create_branch_record(
    build_request_id: str,
    *,
    actor: str,
    source_branch: str = "main",
    branch_name: str | None = None,
) -> dict[str, Any] | None:
    row = _get_build_request_row(build_request_id)
    if row is None:
        return None

    next_branch = str(branch_name or "").strip()
    if not next_branch:
        next_branch = generate_safe_branch_name(row["goal"], build_request_id=build_request_id)
    if next_branch.startswith("build/"):
        suffix = next_branch[len("build/") :]
        next_branch = f"build/{_safe_branch_slug(suffix)}"
    else:
        next_branch = f"build/{_safe_branch_slug(next_branch)}"

    record_id = str(uuid4())
    with connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO build_request_branches(
                    id,
                    build_request_id,
                    tenant_id,
                    branch_name,
                    source_branch,
                    status,
                    created_by
                )
                VALUES (%s, %s, %s, %s, %s, 'created', %s);
                """,
                (
                    record_id,
                    build_request_id,
                    row["tenant_id"],
                    next_branch,
                    str(source_branch or "main").strip() or "main",
                    str(actor or "").strip() or "admin",
                ),
            )
        conn.commit()

    _update_build_request(build_request_id, stage="branch_created", branch_name=next_branch)
    record_build_event(
        build_request_id=build_request_id,
        tenant_id=row["tenant_id"],
        event_type="branch_created",
        detail=f"Branch prepared: {next_branch}",
        metadata={"source_branch": source_branch, "branch_name": next_branch},
        created_by=actor,
    )
    return get_build_request(build_request_id)


def link_router_decision_to_build_request(
    build_request_id: str,
    *,
    decision_id: str,
    actor: str,
) -> dict[str, Any] | None:
    row = _get_build_request_row(build_request_id)
    if row is None:
        return None

    decision = get_model_router_decision(decision_id, include_events=False)
    if decision is None:
        raise KeyError("Model router decision not found")

    mission_id = str(decision.get("mission_id") or "").strip() or None
    _update_build_request(
        build_request_id,
        stage="routed",
        router_decision_id=decision_id,
        mission_id=mission_id,
    )
    record_build_event(
        build_request_id=build_request_id,
        tenant_id=row["tenant_id"],
        event_type="routed",
        detail=f"Linked model-router decision {decision_id}",
        metadata={"router_decision_id": decision_id, "mission_id": mission_id},
        created_by=actor,
    )
    return get_build_request(build_request_id)


def save_pr_draft_metadata(
    build_request_id: str,
    *,
    actor: str,
    pr_url: str,
    pr_number: str | None = None,
    proof_summary: str = "",
    test_summary: str = "",
    files_changed_summary: str = "",
    stage: str = "pr_drafted",
) -> dict[str, Any] | None:
    row = _get_build_request_row(build_request_id)
    if row is None:
        return None

    verification_required = _resolve_verification_required(row)
    recommendation_update = compute_recommendation(
        proof_status=str(row.get("proof_status") or "unknown"),
        verification_state=str(row.get("verification_state") or "not_required"),
        verification_required=verification_required,
        has_pr_draft=True,
    )

    _update_build_request(
        build_request_id,
        stage=recommendation_update["stage"] if row.get("proof_status") not in {None, "", "unknown"} else stage,
        pr_url=str(pr_url or "").strip() or None,
        pr_number=str(pr_number or "").strip() or None,
        proof_summary=str(proof_summary or "").strip(),
        test_summary=str(test_summary or "").strip(),
        files_changed_summary=str(files_changed_summary or "").strip(),
        recommendation=recommendation_update["recommendation"],
    )
    record_build_event(
        build_request_id=build_request_id,
        tenant_id=row["tenant_id"],
        event_type="pr_drafted",
        detail="PR draft metadata saved",
        metadata={
            "pr_url": pr_url,
            "pr_number": pr_number,
            "proof_summary": proof_summary,
            "test_summary": test_summary,
            "files_changed_summary": files_changed_summary,
        },
        created_by=actor,
    )
    return get_build_request(build_request_id)


def start_build_execution_run(
    build_request_id: str,
    *,
    actor: str,
    command_class: str,
    target_scope: str,
    summary: str = "",
    router_decision_id: str | None = None,
    mission_id: str | None = None,
) -> dict[str, Any] | None:
    row = _get_build_request_row(build_request_id)
    if row is None:
        return None

    run_id = str(uuid4())
    effective_router_decision_id = str(router_decision_id or row.get("router_decision_id") or "").strip() or None
    effective_mission_id = str(mission_id or row.get("mission_id") or "").strip() or None
    with connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO build_execution_runs(
                    id,
                    build_request_id,
                    tenant_id,
                    router_decision_id,
                    mission_id,
                    command_class,
                    target_scope,
                    status,
                    summary,
                    proof_status,
                    created_by
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, 'running', %s, 'unknown', %s);
                """,
                (
                    run_id,
                    build_request_id,
                    row["tenant_id"],
                    effective_router_decision_id,
                    effective_mission_id,
                    str(command_class or "").strip(),
                    str(target_scope or "").strip(),
                    str(summary or "").strip(),
                    str(actor or "").strip() or "admin",
                ),
            )
        conn.commit()

    _update_build_request(
        build_request_id,
        stage="implementation_started",
        latest_execution_run_id=run_id,
        recommendation="needs_execution",
    )
    record_build_event(
        build_request_id=build_request_id,
        tenant_id=row["tenant_id"],
        event_type="implementation_started",
        detail="Execution run started",
        metadata={
            "execution_run_id": run_id,
            "command_class": str(command_class or "").strip(),
            "target_scope": str(target_scope or "").strip(),
        },
        created_by=actor,
    )
    return get_build_request(build_request_id)


def complete_build_execution_run(
    build_request_id: str,
    *,
    run_id: str,
    actor: str,
    status: str,
    summary: str = "",
    lint_build_summary: str = "",
    test_summary: str = "",
    changed_files_summary: str = "",
    execution_output_excerpt: str = "",
    proof_status: str = "unknown",
    request_verification: bool = False,
    verification_required: bool | None = None,
    failure_note: str = "",
    rollback_note: str = "",
) -> dict[str, Any] | None:
    row = _get_build_request_row(build_request_id)
    if row is None:
        return None

    run_row = _get_execution_run_row(run_id)
    if run_row is None or run_row["build_request_id"] != build_request_id:
        raise KeyError("Execution run not found")

    normalized_status = _normalize_execution_status(status)
    normalized_proof_status = _infer_execution_proof_status(
        execution_status=normalized_status,
        proof_status=proof_status,
    )
    sanitized_excerpt = _sanitize_output_excerpt(execution_output_excerpt)
    effective_failure_note = str(failure_note or "").strip()
    effective_rollback_note = str(rollback_note or "").strip()
    effective_verification_required = _resolve_verification_required(
        row,
        request_verification=bool(request_verification),
        verification_required_override=verification_required,
    )

    current_verification_state = str(row.get("verification_state") or "not_required")
    if effective_verification_required:
        if bool(request_verification):
            next_verification_state = "pending"
        else:
            next_verification_state = _normalize_verification_state(current_verification_state, default="pending")
            if next_verification_state == "not_required":
                next_verification_state = "pending"
    else:
        next_verification_state = "not_required"

    recommendation_update = compute_recommendation(
        proof_status=normalized_proof_status,
        verification_state=next_verification_state,
        verification_required=effective_verification_required,
        has_pr_draft=_build_has_pr_link(row),
    )

    with connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE build_execution_runs
                SET
                    status = %s,
                    summary = %s,
                    lint_build_summary = %s,
                    test_summary = %s,
                    changed_files_summary = %s,
                    execution_output_excerpt = %s,
                    proof_status = %s,
                    failure_note = %s,
                    rollback_note = %s,
                    finished_at = now(),
                    updated_at = now()
                WHERE id = %s;
                """,
                (
                    normalized_status,
                    str(summary or "").strip(),
                    str(lint_build_summary or "").strip(),
                    str(test_summary or "").strip(),
                    str(changed_files_summary or "").strip(),
                    sanitized_excerpt,
                    normalized_proof_status,
                    effective_failure_note,
                    effective_rollback_note,
                    run_id,
                ),
            )
        conn.commit()

    _update_build_request(
        build_request_id,
        stage=recommendation_update["stage"],
        proof_summary=str(lint_build_summary or summary or "").strip(),
        test_summary=str(test_summary or "").strip(),
        files_changed_summary=str(changed_files_summary or "").strip(),
        proof_status=normalized_proof_status,
        verification_state=next_verification_state,
        recommendation=recommendation_update["recommendation"],
        latest_execution_run_id=run_id,
        failure_note=effective_failure_note,
        rollback_note=effective_rollback_note,
    )
    record_build_event(
        build_request_id=build_request_id,
        tenant_id=row["tenant_id"],
        event_type=recommendation_update["stage"],
        detail="Execution proof ingested",
        metadata={
            "execution_run_id": run_id,
            "status": normalized_status,
            "proof_status": normalized_proof_status,
            "verification_state": next_verification_state,
            "recommendation": recommendation_update["recommendation"],
            "request_verification": bool(request_verification),
            "failure_note": effective_failure_note,
            "rollback_note": effective_rollback_note,
        },
        created_by=actor,
    )
    return get_build_request(build_request_id)


def set_build_verification_state(
    build_request_id: str,
    *,
    actor: str,
    verification_state: str,
    detail: str = "",
    verification_required: bool | None = None,
) -> dict[str, Any] | None:
    row = _get_build_request_row(build_request_id)
    if row is None:
        return None

    normalized_verification_state = _normalize_verification_state(verification_state)
    effective_verification_required = _resolve_verification_required(
        row,
        request_verification=normalized_verification_state == "pending",
        verification_required_override=verification_required,
    )
    if not effective_verification_required:
        normalized_verification_state = "not_required"
    elif normalized_verification_state == "not_required":
        normalized_verification_state = "pending"

    recommendation_update = compute_recommendation(
        proof_status=str(row.get("proof_status") or "unknown"),
        verification_state=normalized_verification_state,
        verification_required=effective_verification_required,
        has_pr_draft=_build_has_pr_link(row),
    )
    _update_build_request(
        build_request_id,
        stage=recommendation_update["stage"],
        verification_state=normalized_verification_state,
        recommendation=recommendation_update["recommendation"],
    )
    record_build_event(
        build_request_id=build_request_id,
        tenant_id=row["tenant_id"],
        event_type=recommendation_update["stage"],
        detail=detail or f"Verification state set to {normalized_verification_state}",
        metadata={
            "verification_state": normalized_verification_state,
            "verification_required": effective_verification_required,
            "recommendation": recommendation_update["recommendation"],
        },
        created_by=actor,
    )
    return get_build_request(build_request_id)


def sync_build_request_github_status(
    build_request_id: str,
    *,
    actor: str,
    repo: str | None = None,
    pr_number: str | None = None,
) -> dict[str, Any] | None:
    row = _get_build_request_row(build_request_id)
    if row is None:
        return None

    effective_repo = str(repo or "").strip()
    if not effective_repo:
        effective_repo = _parse_repo_from_pr_url(row.get("pr_url")) or str(os.getenv("GITHUB_REPO", "")).strip()
    effective_pr_number = _parse_pr_number(pr_number, row.get("pr_url"))
    if not effective_repo:
        raise ValueError("repo is required for GitHub sync")
    if not effective_pr_number:
        raise ValueError("pr_number is required for GitHub sync")

    token = _github_token()
    if not token:
        raise ValueError("GITHUB_TOKEN or GH_TOKEN is required for GitHub sync")

    snapshot = _fetch_github_pr_snapshot(
        repo=effective_repo,
        pr_number=effective_pr_number,
        token=token,
    )
    verification_required = _resolve_verification_required(row)
    merge_readiness = evaluate_github_merge_readiness(
        proof_status=str(row.get("proof_status") or "unknown"),
        verification_state=str(row.get("verification_state") or "not_required"),
        verification_required=verification_required,
        github_sync=snapshot,
    )
    blocked_reasons = list(merge_readiness.get("reasons") or [])

    sync_record_id = str(uuid4())
    with connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO build_github_sync_states(
                    id,
                    build_request_id,
                    tenant_id,
                    repo,
                    branch,
                    pr_number,
                    pr_state,
                    mergeability_summary,
                    checks_status,
                    review_status,
                    head_ref,
                    base_ref,
                    blocked_reasons_json,
                    sync_payload_json,
                    synced_at,
                    created_by
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, now(), %s);
                """,
                (
                    sync_record_id,
                    build_request_id,
                    row["tenant_id"],
                    str(snapshot.get("repo") or ""),
                    str(snapshot.get("branch") or ""),
                    str(snapshot.get("pr_number") or ""),
                    _normalize_github_pr_state(str(snapshot.get("pr_state") or "unknown")),
                    str(snapshot.get("mergeability_summary") or "").strip().upper(),
                    _normalize_github_checks_status(str(snapshot.get("checks_status") or "unknown")),
                    _normalize_github_review_status(str(snapshot.get("review_status") or "unknown")),
                    str(snapshot.get("head_ref") or ""),
                    str(snapshot.get("base_ref") or ""),
                    _to_jsonb(blocked_reasons),
                    _to_jsonb(snapshot.get("sync_payload") or {}),
                    str(actor or "").strip() or "admin",
                ),
            )
        conn.commit()

    _update_build_request(
        build_request_id,
        stage=str(merge_readiness.get("stage") or row.get("stage") or "approval_pending"),
        recommendation=str(merge_readiness.get("recommendation") or row.get("recommendation") or "approval_pending"),
        pr_number=effective_pr_number,
        github_repo=str(snapshot.get("repo") or effective_repo),
        github_head_ref=str(snapshot.get("head_ref") or ""),
        github_base_ref=str(snapshot.get("base_ref") or ""),
    )
    record_build_event(
        build_request_id=build_request_id,
        tenant_id=row["tenant_id"],
        event_type="github_sync",
        detail="GitHub PR status synced",
        metadata={
            "repo": effective_repo,
            "pr_number": effective_pr_number,
            "pr_state": snapshot.get("pr_state"),
            "checks_status": snapshot.get("checks_status"),
            "review_status": snapshot.get("review_status"),
            "mergeability_summary": snapshot.get("mergeability_summary"),
            "merge_ready": bool(merge_readiness.get("ready")),
            "blocked_reasons": blocked_reasons,
        },
        created_by=actor,
    )
    return get_build_request(build_request_id)


def writeback_build_request_github_pr(
    build_request_id: str,
    *,
    actor: str,
    repo: str | None = None,
    head_branch: str | None = None,
    base_branch: str | None = None,
    title: str | None = None,
    body: str | None = None,
    draft: bool = True,
) -> dict[str, Any] | None:
    row = _get_build_request_row(build_request_id)
    if row is None:
        return None

    effective_repo = str(repo or "").strip()
    if not effective_repo:
        effective_repo = (
            str(row.get("github_repo") or "").strip()
            or _parse_repo_from_pr_url(row.get("pr_url"))
            or str(os.getenv("GITHUB_REPO", "")).strip()
        )

    effective_head_branch = str(head_branch or "").strip()
    if not effective_head_branch:
        effective_head_branch = str(row.get("branch_name") or "").strip() or str(row.get("github_head_ref") or "").strip()
    effective_base_branch = str(base_branch or "").strip() or str(row.get("github_base_ref") or "").strip() or "main"
    effective_title = str(title or "").strip() or _default_pr_title(str(row.get("goal") or ""))
    effective_body = str(body or "").strip() or generate_build_request_pr_body(row)

    if not effective_repo:
        raise ValueError("repo is required for GitHub writeback")
    if not effective_head_branch:
        raise ValueError("head_branch is required for GitHub writeback")

    token = _github_token()
    if not token:
        raise ValueError("GITHUB_TOKEN or GH_TOKEN is required for GitHub writeback")

    timeout = httpx.Timeout(20.0, connect=5.0)
    writeback_at = datetime.now(timezone.utc)
    try:
        existing_pr_number = _parse_pr_number(str(row.get("pr_number") or ""), str(row.get("pr_url") or ""))
        with httpx.Client(
            base_url="https://api.github.com",
            headers=_github_api_headers(token),
            timeout=timeout,
        ) as client:
            if not existing_pr_number:
                owner = _owner_from_repo(effective_repo)
                if owner:
                    find_response = client.get(
                        f"/repos/{effective_repo}/pulls",
                        params={"state": "open", "head": f"{owner}:{effective_head_branch}"},
                    )
                    if find_response.status_code >= 400:
                        raise ValueError(_github_error_message(find_response))
                    existing_matches = find_response.json() or []
                    if isinstance(existing_matches, list) and existing_matches:
                        existing_pr_number = str((existing_matches[0] or {}).get("number") or "").strip() or None

            writeback_action = "update"
            if existing_pr_number:
                update_payload = {
                    "title": effective_title,
                    "body": effective_body,
                    "base": effective_base_branch,
                }
                pr_response = client.patch(
                    f"/repos/{effective_repo}/pulls/{existing_pr_number}",
                    json=update_payload,
                )
            else:
                writeback_action = "create"
                create_payload = {
                    "title": effective_title,
                    "body": effective_body,
                    "head": effective_head_branch,
                    "base": effective_base_branch,
                    "draft": bool(draft),
                }
                pr_response = client.post(
                    f"/repos/{effective_repo}/pulls",
                    json=create_payload,
                )

            if pr_response.status_code >= 400:
                raise ValueError(_github_error_message(pr_response))

            pr_data = pr_response.json() or {}
            pr_number = str(pr_data.get("number") or "").strip()
            pr_url = str(pr_data.get("html_url") or "").strip()
            pr_head_ref = str(((pr_data.get("head") or {}).get("ref")) or "").strip() or effective_head_branch
            pr_base_ref = str(((pr_data.get("base") or {}).get("ref")) or "").strip() or effective_base_branch
            pr_draft = bool(pr_data.get("draft"))

        if not pr_number or not pr_url:
            raise ValueError("GitHub writeback returned incomplete PR metadata")

        _update_build_request(
            build_request_id,
            pr_url=pr_url,
            pr_number=pr_number,
            branch_name=pr_head_ref,
            github_repo=effective_repo,
            github_head_ref=pr_head_ref,
            github_base_ref=pr_base_ref,
            github_writeback_status="success",
            github_writeback_error="",
            github_last_writeback_at=writeback_at,
        )
        record_build_event(
            build_request_id=build_request_id,
            tenant_id=row["tenant_id"],
            event_type="github_writeback",
            detail="GitHub draft PR writeback succeeded",
            metadata={
                "status": "success",
                "action": writeback_action,
                "repo": effective_repo,
                "pr_number": pr_number,
                "pr_url": pr_url,
                "head_ref": pr_head_ref,
                "base_ref": pr_base_ref,
                "requested_draft": bool(draft),
                "actual_draft": pr_draft,
            },
            created_by=actor,
        )

        request = get_build_request(build_request_id)
        if request is None:
            return None
        try:
            synced = sync_build_request_github_status(
                build_request_id,
                actor=actor,
                repo=effective_repo,
                pr_number=pr_number,
            )
            if synced is not None:
                request = synced
        except ValueError as sync_error:
            record_build_event(
                build_request_id=build_request_id,
                tenant_id=row["tenant_id"],
                event_type="github_sync",
                detail="GitHub sync after writeback failed",
                metadata={
                    "status": "failed",
                    "error": str(sync_error),
                    "repo": effective_repo,
                    "pr_number": pr_number,
                },
                created_by=actor,
            )
        return request
    except ValueError as error:
        _update_build_request(
            build_request_id,
            github_repo=effective_repo,
            github_head_ref=effective_head_branch,
            github_base_ref=effective_base_branch,
            github_writeback_status="failed",
            github_writeback_error=str(error),
            github_last_writeback_at=writeback_at,
        )
        record_build_event(
            build_request_id=build_request_id,
            tenant_id=row["tenant_id"],
            event_type="github_writeback",
            detail="GitHub draft PR writeback failed",
            metadata={
                "status": "failed",
                "error": str(error),
                "repo": effective_repo,
                "head_ref": effective_head_branch,
                "base_ref": effective_base_branch,
            },
            created_by=actor,
        )
        raise
