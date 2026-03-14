from __future__ import annotations

from datetime import datetime, timezone
import re
from typing import Any
from uuid import uuid4

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
    "revise_before_pr",
}
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
