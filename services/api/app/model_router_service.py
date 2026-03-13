from __future__ import annotations

from datetime import datetime, timezone
import os
from typing import Any
from uuid import uuid4

from psycopg.types.json import Jsonb

from app.db import connect

TASK_CLASSES = {"implement", "debug", "review", "verify"}
SUPPORTED_MODELS = {"codex", "claude", "gemini", "openclaw"}
PROOF_STATUSES = {"unknown", "passing", "failing", "not_run"}
VERIFICATION_STATUSES = {"not_required", "pending", "passed", "failed"}

DEFAULT_MODEL_BY_TASK_CLASS = {
    "implement": "codex",
    "debug": "claude",
    "review": "gemini",
    "verify": "openclaw",
}


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


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


def is_openclaw_verify_enabled() -> bool:
    raw = os.getenv("MODEL_ROUTER_ENABLE_OPENCLOW_VERIFY", "false").strip().lower()
    return raw in {"1", "true", "yes", "on"}


def _normalize_task_class(raw: str) -> str:
    candidate = str(raw or "implement").strip().lower()
    if candidate not in TASK_CLASSES:
        return "implement"
    return candidate


def _normalize_proof_status(raw: str) -> str:
    candidate = str(raw or "unknown").strip().lower()
    if candidate not in PROOF_STATUSES:
        return "unknown"
    return candidate


def _normalize_verification_status(raw: str, *, default: str = "pending") -> str:
    candidate = str(raw or default).strip().lower()
    if candidate not in VERIFICATION_STATUSES:
        return default
    return candidate


def _normalize_model(
    raw: str | None,
    *,
    fallback: str,
    openclaw_verify_enabled: bool,
) -> str:
    candidate = str(raw or "").strip().lower()
    if candidate not in SUPPORTED_MODELS:
        return fallback
    if candidate == "openclaw" and not openclaw_verify_enabled:
        return fallback
    return candidate


def _normalize_optional_model(raw: str | None, *, openclaw_verify_enabled: bool) -> str | None:
    candidate = str(raw or "").strip().lower()
    if not candidate:
        return None
    if candidate not in SUPPORTED_MODELS:
        return None
    if candidate == "openclaw" and not openclaw_verify_enabled:
        return None
    return candidate


def _default_verification_model(*, openclaw_verify_enabled: bool) -> str:
    if openclaw_verify_enabled:
        return "openclaw"
    return "gemini"


def select_model(
    *,
    task_class: str,
    requested_model: str | None,
    openclaw_verify_enabled: bool | None = None,
) -> str:
    openclaw_enabled = is_openclaw_verify_enabled() if openclaw_verify_enabled is None else bool(openclaw_verify_enabled)
    normalized_task_class = _normalize_task_class(task_class)
    default_model = DEFAULT_MODEL_BY_TASK_CLASS.get(normalized_task_class, "codex")
    if default_model == "openclaw" and not openclaw_enabled:
        default_model = "gemini"
    return _normalize_model(
        requested_model,
        fallback=default_model,
        openclaw_verify_enabled=openclaw_enabled,
    )


def compute_final_recommendation(
    *,
    verification_required: bool,
    verification_status: str,
    proof_status: str,
) -> str:
    if verification_required:
        if verification_status == "passed":
            if proof_status in {"failing", "not_run"}:
                return "fix_proof_before_pr"
            return "ready_for_pr_review"
        if verification_status == "failed":
            return "revise_before_pr"
        return "needs_second_model_review"
    if proof_status in {"failing", "not_run"}:
        return "fix_proof_before_pr"
    return "ready_for_pr_review"


def evaluate_verification_policy(
    *,
    task_class: str,
    selected_model: str,
    proof_status: str,
    sensitive_change: bool,
    requested_verification_required: bool | None = None,
    requested_verification_model: str | None = None,
    openclaw_verify_enabled: bool | None = None,
) -> dict[str, Any]:
    openclaw_enabled = is_openclaw_verify_enabled() if openclaw_verify_enabled is None else bool(openclaw_verify_enabled)
    normalized_task_class = _normalize_task_class(task_class)
    normalized_proof_status = _normalize_proof_status(proof_status)
    normalized_selected_model = _normalize_model(
        selected_model,
        fallback=DEFAULT_MODEL_BY_TASK_CLASS["implement"],
        openclaw_verify_enabled=openclaw_enabled,
    )

    reasons: list[str] = []
    verification_required = bool(requested_verification_required)
    if verification_required:
        reasons.append("manual_requirement")
    if bool(sensitive_change):
        verification_required = True
        reasons.append("sensitive_change")
    if normalized_proof_status in {"failing", "not_run"}:
        verification_required = True
        reasons.append("proof_not_passing")

    if verification_required:
        fallback = _default_verification_model(openclaw_verify_enabled=openclaw_enabled)
        verification_model = _normalize_model(
            requested_verification_model,
            fallback=fallback,
            openclaw_verify_enabled=openclaw_enabled,
        )
        if verification_model == normalized_selected_model:
            for candidate in ("gemini", "claude", "codex"):
                if candidate != normalized_selected_model:
                    verification_model = candidate
                    break
        verification_status = "pending"
    else:
        verification_model = None
        verification_status = "not_required"

    return {
        "verification_required": verification_required,
        "verification_model": verification_model,
        "verification_status": verification_status,
        "policy_reasons": reasons,
        "task_class": normalized_task_class,
        "proof_status": normalized_proof_status,
        "selected_model": normalized_selected_model,
        "final_recommendation": compute_final_recommendation(
            verification_required=verification_required,
            verification_status=verification_status,
            proof_status=normalized_proof_status,
        ),
    }


def _serialize_decision(row: dict[str, Any]) -> dict[str, Any]:
    metadata = row.get("metadata") if isinstance(row.get("metadata"), dict) else {}
    return {
        "id": row["id"],
        "tenant_id": row["tenant_id"],
        "task_class": row["task_class"],
        "task_type": row["task_type"],
        "requested_model": row["requested_model"],
        "selected_model": row["selected_model"],
        "escalation_reason": row["escalation_reason"],
        "output_summary": row["output_summary"],
        "proof_status": row["proof_status"],
        "verification_required": bool(row["verification_required"]),
        "verification_model": row["verification_model"],
        "verification_status": row["verification_status"],
        "final_recommendation": row["final_recommendation"],
        "mission_id": row["mission_id"],
        "task_id": row["task_id"],
        "operator_id": row["operator_id"],
        "linked_branch": row["linked_branch"],
        "linked_pr": row["linked_pr"],
        "metadata": metadata,
        "created_by": row["created_by"],
        "created_at": _to_iso(row["created_at"]),
        "updated_at": _to_iso(row["updated_at"]),
    }


def init_model_router_tables() -> None:
    with connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS model_router_decisions(
                    id text PRIMARY KEY,
                    tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
                    task_class text NOT NULL,
                    task_type text,
                    requested_model text,
                    selected_model text NOT NULL,
                    escalation_reason text NOT NULL DEFAULT '',
                    output_summary text NOT NULL DEFAULT '',
                    proof_status text NOT NULL DEFAULT 'unknown',
                    verification_required boolean NOT NULL DEFAULT false,
                    verification_model text,
                    verification_status text NOT NULL DEFAULT 'not_required',
                    final_recommendation text NOT NULL DEFAULT 'ready_for_pr_review',
                    mission_id text,
                    task_id text,
                    operator_id text,
                    linked_branch text,
                    linked_pr text,
                    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
                    created_by text NOT NULL DEFAULT 'admin',
                    created_at timestamptz NOT NULL DEFAULT now(),
                    updated_at timestamptz NOT NULL DEFAULT now()
                );
                """
            )
            cur.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_model_router_tenant_created
                ON model_router_decisions (tenant_id, created_at DESC);
                """
            )
            cur.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_model_router_verification
                ON model_router_decisions (tenant_id, verification_status, created_at DESC);
                """
            )
            cur.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_model_router_mission
                ON model_router_decisions (mission_id, created_at DESC);
                """
            )
            cur.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_model_router_task
                ON model_router_decisions (task_id, created_at DESC);
                """
            )
        conn.commit()


def _get_model_router_decision_row(decision_id: str) -> dict[str, Any] | None:
    with connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                    id,
                    tenant_id,
                    task_class,
                    task_type,
                    requested_model,
                    selected_model,
                    escalation_reason,
                    output_summary,
                    proof_status,
                    verification_required,
                    verification_model,
                    verification_status,
                    final_recommendation,
                    mission_id,
                    task_id,
                    operator_id,
                    linked_branch,
                    linked_pr,
                    metadata,
                    created_by,
                    created_at,
                    updated_at
                FROM model_router_decisions
                WHERE id = %s;
                """,
                (decision_id,),
            )
            row = cur.fetchone()
    return row


def get_model_router_decision(decision_id: str) -> dict[str, Any] | None:
    row = _get_model_router_decision_row(decision_id)
    if row is None:
        return None
    return _serialize_decision(row)


def create_model_router_decision(
    *,
    tenant_id: str,
    task_class: str,
    task_type: str | None = None,
    requested_model: str | None = None,
    escalation_reason: str = "",
    output_summary: str = "",
    proof_status: str = "unknown",
    mission_id: str | None = None,
    task_id: str | None = None,
    operator_id: str | None = None,
    linked_branch: str | None = None,
    linked_pr: str | None = None,
    sensitive_change: bool = False,
    verification_required: bool | None = None,
    verification_model: str | None = None,
    metadata: dict[str, Any] | None = None,
    created_by: str = "admin",
    openclaw_verify_enabled: bool | None = None,
) -> dict[str, Any]:
    openclaw_enabled = is_openclaw_verify_enabled() if openclaw_verify_enabled is None else bool(openclaw_verify_enabled)
    normalized_task_class = _normalize_task_class(task_class)
    normalized_requested_model = _normalize_optional_model(
        requested_model,
        openclaw_verify_enabled=openclaw_enabled,
    )
    selected_model = select_model(
        task_class=normalized_task_class,
        requested_model=normalized_requested_model,
        openclaw_verify_enabled=openclaw_enabled,
    )
    normalized_proof_status = _normalize_proof_status(proof_status)
    policy = evaluate_verification_policy(
        task_class=normalized_task_class,
        selected_model=selected_model,
        proof_status=normalized_proof_status,
        sensitive_change=sensitive_change,
        requested_verification_required=verification_required,
        requested_verification_model=verification_model,
        openclaw_verify_enabled=openclaw_enabled,
    )

    decision_id = str(uuid4())
    metadata_payload = dict(metadata or {})
    metadata_payload["policy_reasons"] = policy["policy_reasons"]
    metadata_payload["sensitive_change"] = bool(sensitive_change)

    with connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO model_router_decisions(
                    id,
                    tenant_id,
                    task_class,
                    task_type,
                    requested_model,
                    selected_model,
                    escalation_reason,
                    output_summary,
                    proof_status,
                    verification_required,
                    verification_model,
                    verification_status,
                    final_recommendation,
                    mission_id,
                    task_id,
                    operator_id,
                    linked_branch,
                    linked_pr,
                    metadata,
                    created_by
                )
                VALUES (
                    %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
                );
                """,
                (
                    decision_id,
                    tenant_id,
                    normalized_task_class,
                    str(task_type or "").strip() or None,
                    normalized_requested_model,
                    selected_model,
                    str(escalation_reason or "").strip(),
                    str(output_summary or "").strip(),
                    normalized_proof_status,
                    bool(policy["verification_required"]),
                    policy["verification_model"],
                    policy["verification_status"],
                    policy["final_recommendation"],
                    str(mission_id or "").strip() or None,
                    str(task_id or "").strip() or None,
                    str(operator_id or "").strip() or None,
                    str(linked_branch or "").strip() or None,
                    str(linked_pr or "").strip() or None,
                    _to_jsonb(metadata_payload),
                    str(created_by or "").strip() or "admin",
                ),
            )
        conn.commit()

    decision = get_model_router_decision(decision_id)
    if decision is None:
        raise RuntimeError("Failed to create model router decision")
    return decision


def update_model_router_decision(
    decision_id: str,
    patch: dict[str, Any],
    *,
    openclaw_verify_enabled: bool | None = None,
) -> dict[str, Any] | None:
    current = _get_model_router_decision_row(decision_id)
    if current is None:
        return None
    if not patch:
        return _serialize_decision(current)

    openclaw_enabled = is_openclaw_verify_enabled() if openclaw_verify_enabled is None else bool(openclaw_verify_enabled)
    current_metadata = current.get("metadata") if isinstance(current.get("metadata"), dict) else {}
    patch_metadata = patch.get("metadata") if isinstance(patch.get("metadata"), dict) else None
    next_metadata = dict(current_metadata)
    if patch_metadata is not None:
        next_metadata.update(patch_metadata)

    next_proof_status = _normalize_proof_status(str(patch.get("proof_status", current["proof_status"]) or "unknown"))
    next_verification_required = bool(patch.get("verification_required", current["verification_required"]))
    sensitive_change = bool(next_metadata.get("sensitive_change", False))

    policy = evaluate_verification_policy(
        task_class=str(current["task_class"]),
        selected_model=str(current["selected_model"]),
        proof_status=next_proof_status,
        sensitive_change=sensitive_change,
        requested_verification_required=next_verification_required,
        requested_verification_model=patch.get("verification_model", current["verification_model"]),
        openclaw_verify_enabled=openclaw_enabled,
    )

    next_verification_status = _normalize_verification_status(
        str(patch.get("verification_status", current["verification_status"]) or policy["verification_status"]),
        default=policy["verification_status"],
    )
    if not next_verification_required:
        next_verification_status = "not_required"
    elif next_verification_status == "not_required":
        next_verification_status = "pending"

    next_final_recommendation = compute_final_recommendation(
        verification_required=next_verification_required,
        verification_status=next_verification_status,
        proof_status=next_proof_status,
    )

    next_metadata["policy_reasons"] = policy["policy_reasons"]

    with connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE model_router_decisions
                SET
                    escalation_reason = %s,
                    output_summary = %s,
                    proof_status = %s,
                    verification_required = %s,
                    verification_model = %s,
                    verification_status = %s,
                    final_recommendation = %s,
                    linked_branch = %s,
                    linked_pr = %s,
                    metadata = %s,
                    updated_at = now()
                WHERE id = %s;
                """,
                (
                    str(patch.get("escalation_reason", current["escalation_reason"]) or "").strip(),
                    str(patch.get("output_summary", current["output_summary"]) or "").strip(),
                    next_proof_status,
                    next_verification_required,
                    policy["verification_model"] if next_verification_required else None,
                    next_verification_status,
                    next_final_recommendation,
                    str(patch.get("linked_branch", current["linked_branch"]) or "").strip() or None,
                    str(patch.get("linked_pr", current["linked_pr"]) or "").strip() or None,
                    _to_jsonb(next_metadata),
                    decision_id,
                ),
            )
        conn.commit()

    return get_model_router_decision(decision_id)


def list_model_router_decisions(
    *,
    tenant_id: str,
    task_class: str | None = None,
    verification_status: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> dict[str, Any]:
    safe_limit = min(max(int(limit), 1), 200)
    safe_offset = max(int(offset), 0)

    conditions = ["tenant_id = %s"]
    params: list[Any] = [tenant_id]

    normalized_task_class = str(task_class or "").strip().lower()
    if normalized_task_class:
        conditions.append("task_class = %s")
        params.append(_normalize_task_class(normalized_task_class))

    normalized_verification_status = str(verification_status or "").strip().lower()
    if normalized_verification_status:
        conditions.append("verification_status = %s")
        params.append(_normalize_verification_status(normalized_verification_status, default="pending"))

    where_clause = f"WHERE {' AND '.join(conditions)}"

    with connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"""
                SELECT count(*)::int AS total
                FROM model_router_decisions
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
                    task_class,
                    task_type,
                    requested_model,
                    selected_model,
                    escalation_reason,
                    output_summary,
                    proof_status,
                    verification_required,
                    verification_model,
                    verification_status,
                    final_recommendation,
                    mission_id,
                    task_id,
                    operator_id,
                    linked_branch,
                    linked_pr,
                    metadata,
                    created_by,
                    created_at,
                    updated_at
                FROM model_router_decisions
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
        "items": [_serialize_decision(row) for row in rows],
        "total": int(count_row.get("total") or 0),
        "limit": safe_limit,
        "offset": safe_offset,
    }
