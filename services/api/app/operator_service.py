from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
import hashlib
import json
from typing import Any, Callable
from uuid import uuid4

from psycopg.types.json import Jsonb

from app.db import connect

OPERATOR_VERSION_STATUSES = {"draft", "validated", "active", "archived"}
VALIDATION_STATUSES = {"pending", "passed", "failed"}
MISSION_STATUSES = {"running", "completed", "partial", "blocked", "failed"}
MISSION_SOURCES = {"manual", "trigger", "webhook", "internal"}

SENSITIVE_KEYS = {
    "access_token",
    "refresh_token",
    "password",
    "api_key",
    "authorization",
    "secret",
    "token",
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


def _normalize_tool_manifest(values: list[str] | None) -> list[str]:
    normalized: list[str] = []
    seen: set[str] = set()
    for raw in values or []:
        name = str(raw).strip()
        if not name:
            continue
        if name in seen:
            continue
        seen.add(name)
        normalized.append(name)
    return normalized


def _instruction_checksum(instruction_json: dict[str, Any], tool_manifest: list[str]) -> str:
    payload = {"instruction_json": instruction_json, "tool_manifest": tool_manifest}
    encoded = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def _normalize_validation_status(raw: str) -> str:
    candidate = str(raw or "pending").strip().lower()
    if candidate not in VALIDATION_STATUSES:
        return "pending"
    return candidate


def _normalize_version_status(raw: str) -> str:
    candidate = str(raw or "draft").strip().lower()
    if candidate not in OPERATOR_VERSION_STATUSES:
        return "draft"
    return candidate


def _normalize_mission_source(raw: str | None) -> str:
    candidate = str(raw or "manual").strip().lower()
    if candidate not in MISSION_SOURCES:
        return "manual"
    return candidate


def _redact_value(value: Any) -> Any:
    if isinstance(value, dict):
        redacted: dict[str, Any] = {}
        for key, item in value.items():
            if str(key).strip().lower() in SENSITIVE_KEYS:
                redacted[key] = "[REDACTED]"
            else:
                redacted[key] = _redact_value(item)
        return redacted
    if isinstance(value, list):
        return [_redact_value(item) for item in value]
    return value


def _serialize_operator_version(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": row["id"],
        "tenant_id": row["tenant_id"],
        "operator_id": row["operator_id"],
        "version_number": int(row["version_number"]),
        "version_label": row["version_label"],
        "status": row["status"],
        "goal": row["goal"],
        "instruction_json": row["instruction_json"] or {},
        "tool_manifest": row["tool_manifest"] or [],
        "validation_summary": row["validation_summary"],
        "validation_status": row["validation_status"],
        "created_by": row["created_by"],
        "created_at": _to_iso(row["created_at"]),
        "updated_at": _to_iso(row["updated_at"]),
    }


def _serialize_mission(row: dict[str, Any]) -> dict[str, Any]:
    redacted_tool_log = row.get("redacted_tool_log") or []
    return {
        "id": row["id"],
        "tenant_id": row["tenant_id"],
        "user_id": row["user_id"],
        "operator_id": row["operator_id"],
        "operator_version_id": row["operator_version_id"],
        "trigger_id": row.get("trigger_id"),
        "source": row.get("source") or "manual",
        "approval_task_id": row.get("approval_task_id"),
        "status": row["status"],
        "summary": row["summary"],
        "input_payload": row["input_payload"] or {},
        "output_payload": row["output_payload"] or {},
        "redacted_tool_log": redacted_tool_log,
        "tool_calls_redacted": redacted_tool_log,
        "artifacts": row.get("artifacts") or [],
        "token_estimate": int(row["token_estimate"] or 0),
        "cost_estimate": float(row["cost_estimate"] or 0),
        "error": row["error"],
        "started_at": _to_iso(row["started_at"]),
        "finished_at": _to_iso(row["finished_at"]),
        "created_at": _to_iso(row["created_at"]),
        "updated_at": _to_iso(row["updated_at"]),
    }


def init_operator_tables() -> None:
    with connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS operator_versions(
                    id text PRIMARY KEY,
                    tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
                    operator_id text NOT NULL,
                    version_number int NOT NULL,
                    version_label text,
                    status text NOT NULL DEFAULT 'draft',
                    goal text NOT NULL DEFAULT '',
                    instruction_json jsonb NOT NULL DEFAULT '{}'::jsonb,
                    tool_manifest text[] NOT NULL DEFAULT '{}',
                    validation_summary text NOT NULL DEFAULT '',
                    validation_status text NOT NULL DEFAULT 'pending',
                    created_by text NOT NULL,
                    created_at timestamptz NOT NULL DEFAULT now(),
                    updated_at timestamptz NOT NULL DEFAULT now(),
                    UNIQUE (tenant_id, operator_id, version_number)
                );
                """
            )
            cur.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_operator_versions_tenant_operator
                ON operator_versions (tenant_id, operator_id, version_number DESC);
                """
            )
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS forge_builds(
                    id text PRIMARY KEY,
                    tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
                    operator_version_id text NOT NULL REFERENCES operator_versions(id) ON DELETE CASCADE,
                    build_artifact jsonb NOT NULL DEFAULT '{}'::jsonb,
                    validation_results jsonb NOT NULL DEFAULT '{}'::jsonb,
                    created_by text NOT NULL,
                    created_at timestamptz NOT NULL DEFAULT now()
                );
                """
            )
            cur.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_forge_builds_version
                ON forge_builds (operator_version_id, created_at DESC);
                """
            )
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS runner_instructions(
                    id text PRIMARY KEY,
                    tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
                    operator_version_id text NOT NULL REFERENCES operator_versions(id) ON DELETE CASCADE,
                    instruction_json jsonb NOT NULL DEFAULT '{}'::jsonb,
                    tool_manifest text[] NOT NULL DEFAULT '{}',
                    checksum text NOT NULL,
                    created_at timestamptz NOT NULL DEFAULT now()
                );
                """
            )
            cur.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_runner_instructions_version
                ON runner_instructions (operator_version_id, created_at DESC);
                """
            )
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS operator_missions(
                    id text PRIMARY KEY,
                    tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
                    user_id text NOT NULL,
                    operator_id text NOT NULL,
                    operator_version_id text NOT NULL REFERENCES operator_versions(id) ON DELETE RESTRICT,
                    trigger_id text,
                    source text NOT NULL DEFAULT 'manual',
                    approval_task_id text,
                    status text NOT NULL DEFAULT 'running',
                    summary text NOT NULL DEFAULT '',
                    input_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
                    output_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
                    redacted_tool_log jsonb NOT NULL DEFAULT '[]'::jsonb,
                    artifacts jsonb NOT NULL DEFAULT '[]'::jsonb,
                    token_estimate int NOT NULL DEFAULT 0,
                    cost_estimate numeric NOT NULL DEFAULT 0,
                    error text,
                    started_at timestamptz NOT NULL DEFAULT now(),
                    finished_at timestamptz,
                    created_at timestamptz NOT NULL DEFAULT now(),
                    updated_at timestamptz NOT NULL DEFAULT now()
                );
                """
            )
            cur.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_operator_missions_tenant_created
                ON operator_missions (tenant_id, created_at DESC);
                """
            )
            cur.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_operator_missions_version
                ON operator_missions (operator_version_id, created_at DESC);
                """
            )
            cur.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_operator_missions_tenant_operator
                ON operator_missions (tenant_id, operator_id, created_at DESC);
                """
            )
            cur.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_operator_missions_tenant_status
                ON operator_missions (tenant_id, status, created_at DESC);
                """
            )
            cur.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_operator_missions_trigger
                ON operator_missions (trigger_id, created_at DESC)
                WHERE trigger_id IS NOT NULL;
                """
            )
            cur.execute("ALTER TABLE operator_missions ADD COLUMN IF NOT EXISTS trigger_id text;")
            cur.execute("ALTER TABLE operator_missions ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual';")
            cur.execute("ALTER TABLE operator_missions ADD COLUMN IF NOT EXISTS approval_task_id text;")
            cur.execute(
                "ALTER TABLE operator_missions ADD COLUMN IF NOT EXISTS artifacts jsonb NOT NULL DEFAULT '[]'::jsonb;"
            )
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS operator_audit_events(
                    id bigserial PRIMARY KEY,
                    tenant_id text NOT NULL,
                    operator_id text,
                    operator_version_id text,
                    mission_id text,
                    event_type text NOT NULL,
                    event_status text NOT NULL,
                    detail text,
                    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
                    created_by text,
                    created_at timestamptz NOT NULL DEFAULT now()
                );
                """
            )
            cur.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_operator_audit_tenant_created
                ON operator_audit_events (tenant_id, created_at DESC);
                """
            )
        conn.commit()


def record_operator_event(
    *,
    tenant_id: str,
    operator_id: str | None,
    operator_version_id: str | None,
    mission_id: str | None,
    event_type: str,
    event_status: str,
    detail: str = "",
    metadata: dict[str, Any] | None = None,
    created_by: str | None = None,
) -> None:
    with connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO operator_audit_events(
                    tenant_id,
                    operator_id,
                    operator_version_id,
                    mission_id,
                    event_type,
                    event_status,
                    detail,
                    metadata,
                    created_by
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s);
                """,
                (
                    tenant_id,
                    operator_id,
                    operator_version_id,
                    mission_id,
                    event_type,
                    event_status,
                    detail,
                    _to_jsonb(metadata or {}),
                    created_by,
                ),
            )
        conn.commit()


def _next_version_number(tenant_id: str, operator_id: str) -> int:
    with connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT COALESCE(MAX(version_number), 0) + 1 AS next_version
                FROM operator_versions
                WHERE tenant_id = %s AND operator_id = %s;
                """,
                (tenant_id, operator_id),
            )
            row = cur.fetchone()
    return int((row or {}).get("next_version") or 1)


def _create_forge_build(
    *,
    tenant_id: str,
    operator_version_id: str,
    created_by: str,
    build_artifact: dict[str, Any],
    validation_results: dict[str, Any],
) -> None:
    build_id = str(uuid4())
    with connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO forge_builds(
                    id,
                    tenant_id,
                    operator_version_id,
                    build_artifact,
                    validation_results,
                    created_by
                )
                VALUES (%s, %s, %s, %s, %s, %s);
                """,
                (
                    build_id,
                    tenant_id,
                    operator_version_id,
                    _to_jsonb(build_artifact),
                    _to_jsonb(validation_results),
                    created_by,
                ),
            )
        conn.commit()


def _create_runner_instruction(
    *,
    tenant_id: str,
    operator_version_id: str,
    instruction_json: dict[str, Any],
    tool_manifest: list[str],
) -> None:
    record_id = str(uuid4())
    checksum = _instruction_checksum(instruction_json, tool_manifest)
    with connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO runner_instructions(
                    id,
                    tenant_id,
                    operator_version_id,
                    instruction_json,
                    tool_manifest,
                    checksum
                )
                VALUES (%s, %s, %s, %s, %s, %s);
                """,
                (
                    record_id,
                    tenant_id,
                    operator_version_id,
                    _to_jsonb(instruction_json),
                    tool_manifest,
                    checksum,
                ),
            )
        conn.commit()


def _get_operator_version_row(version_id: str) -> dict[str, Any] | None:
    with connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                    id,
                    tenant_id,
                    operator_id,
                    version_number,
                    version_label,
                    status,
                    goal,
                    instruction_json,
                    tool_manifest,
                    validation_summary,
                    validation_status,
                    created_by,
                    created_at,
                    updated_at
                FROM operator_versions
                WHERE id = %s;
                """,
                (version_id,),
            )
            row = cur.fetchone()
    return row


def create_operator_version(
    *,
    tenant_id: str,
    operator_id: str,
    version_label: str | None,
    status: str,
    goal: str,
    instruction_json: dict[str, Any],
    tool_manifest: list[str],
    validation_summary: str,
    validation_status: str,
    created_by: str,
) -> dict[str, Any]:
    normalized_status = _normalize_version_status(status)
    normalized_validation_status = _normalize_validation_status(validation_status)
    normalized_manifest = _normalize_tool_manifest(tool_manifest)
    normalized_instruction = instruction_json if isinstance(instruction_json, dict) else {}

    version_id = str(uuid4())
    version_number = _next_version_number(tenant_id, operator_id)
    with connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO operator_versions(
                    id,
                    tenant_id,
                    operator_id,
                    version_number,
                    version_label,
                    status,
                    goal,
                    instruction_json,
                    tool_manifest,
                    validation_summary,
                    validation_status,
                    created_by
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s);
                """,
                (
                    version_id,
                    tenant_id,
                    operator_id,
                    version_number,
                    version_label,
                    normalized_status,
                    goal,
                    _to_jsonb(normalized_instruction),
                    normalized_manifest,
                    validation_summary,
                    normalized_validation_status,
                    created_by,
                ),
            )
        conn.commit()

    _create_forge_build(
        tenant_id=tenant_id,
        operator_version_id=version_id,
        created_by=created_by,
        build_artifact={"goal": goal, "instruction_json": normalized_instruction, "tool_manifest": normalized_manifest},
        validation_results={
            "validation_summary": validation_summary,
            "validation_status": normalized_validation_status,
        },
    )
    _create_runner_instruction(
        tenant_id=tenant_id,
        operator_version_id=version_id,
        instruction_json=normalized_instruction,
        tool_manifest=normalized_manifest,
    )
    record_operator_event(
        tenant_id=tenant_id,
        operator_id=operator_id,
        operator_version_id=version_id,
        mission_id=None,
        event_type="version_created",
        event_status="ok",
        detail=f"Created operator version {version_number}",
        metadata={"status": normalized_status, "validation_status": normalized_validation_status},
        created_by=created_by,
    )

    if normalized_status == "active":
        activate_operator_version(version_id, activated_by=created_by)

    version = get_operator_version(version_id)
    if version is None:
        raise RuntimeError("Failed to create operator version")
    return version


def list_operators(tenant_id: str) -> list[dict[str, Any]]:
    with connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                    operator_id,
                    COUNT(*)::int AS version_count,
                    MAX(CASE WHEN status = 'active' THEN id END) AS active_version_id,
                    MAX(CASE WHEN status = 'active' THEN version_number END) AS active_version_number,
                    MAX(updated_at) AS updated_at
                FROM operator_versions
                WHERE tenant_id = %s
                GROUP BY operator_id
                ORDER BY operator_id;
                """,
                (tenant_id,),
            )
            rows = cur.fetchall()
    return [
        {
            "operator_id": row["operator_id"],
            "version_count": int(row["version_count"] or 0),
            "active_version_id": row["active_version_id"],
            "active_version_number": int(row["active_version_number"] or 0) if row["active_version_number"] is not None else None,
            "updated_at": _to_iso(row["updated_at"]),
        }
        for row in rows
    ]


def list_operator_versions(tenant_id: str, operator_id: str) -> list[dict[str, Any]]:
    with connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                    id,
                    tenant_id,
                    operator_id,
                    version_number,
                    version_label,
                    status,
                    goal,
                    instruction_json,
                    tool_manifest,
                    validation_summary,
                    validation_status,
                    created_by,
                    created_at,
                    updated_at
                FROM operator_versions
                WHERE tenant_id = %s
                  AND operator_id = %s
                ORDER BY version_number DESC;
                """,
                (tenant_id, operator_id),
            )
            rows = cur.fetchall()
    return [_serialize_operator_version(row) for row in rows]


def get_operator_version(version_id: str) -> dict[str, Any] | None:
    row = _get_operator_version_row(version_id)
    if row is None:
        return None

    with connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT instruction_json, tool_manifest, checksum, created_at
                FROM runner_instructions
                WHERE operator_version_id = %s
                ORDER BY created_at DESC
                LIMIT 1;
                """,
                (version_id,),
            )
            instruction_row = cur.fetchone()
            cur.execute(
                """
                SELECT COUNT(*)::int AS total
                FROM forge_builds
                WHERE operator_version_id = %s;
                """,
                (version_id,),
            )
            build_row = cur.fetchone()

    version = _serialize_operator_version(row)
    version["latest_runner_instruction"] = (
        {
            "instruction_json": instruction_row["instruction_json"] or {},
            "tool_manifest": instruction_row["tool_manifest"] or [],
            "checksum": instruction_row["checksum"],
            "created_at": _to_iso(instruction_row["created_at"]),
        }
        if instruction_row
        else None
    )
    version["forge_build_count"] = int((build_row or {}).get("total") or 0)
    return version


def update_operator_version(
    version_id: str,
    patch: dict[str, Any],
    *,
    updated_by: str,
) -> dict[str, Any] | None:
    current = _get_operator_version_row(version_id)
    if current is None:
        return None

    next_goal = str(patch.get("goal", current["goal"]) or "")
    next_instruction_json = (
        patch.get("instruction_json")
        if "instruction_json" in patch
        else (current["instruction_json"] or {})
    )
    if not isinstance(next_instruction_json, dict):
        next_instruction_json = {}
    next_tool_manifest = _normalize_tool_manifest(
        patch.get("tool_manifest") if "tool_manifest" in patch else (current["tool_manifest"] or [])
    )
    next_validation_summary = str(patch.get("validation_summary", current["validation_summary"]) or "")
    next_validation_status = _normalize_validation_status(
        str(patch.get("validation_status", current["validation_status"]) or "pending")
    )
    next_status = _normalize_version_status(str(patch.get("status", current["status"]) or "draft"))
    next_version_label = patch.get("version_label", current["version_label"])

    with connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE operator_versions
                SET
                    version_label = %s,
                    status = %s,
                    goal = %s,
                    instruction_json = %s,
                    tool_manifest = %s,
                    validation_summary = %s,
                    validation_status = %s,
                    updated_at = now()
                WHERE id = %s;
                """,
                (
                    next_version_label,
                    next_status,
                    next_goal,
                    _to_jsonb(next_instruction_json),
                    next_tool_manifest,
                    next_validation_summary,
                    next_validation_status,
                    version_id,
                ),
            )
        conn.commit()

    _create_forge_build(
        tenant_id=current["tenant_id"],
        operator_version_id=version_id,
        created_by=updated_by,
        build_artifact={
            "goal": next_goal,
            "instruction_json": next_instruction_json,
            "tool_manifest": next_tool_manifest,
        },
        validation_results={
            "validation_summary": next_validation_summary,
            "validation_status": next_validation_status,
        },
    )
    _create_runner_instruction(
        tenant_id=current["tenant_id"],
        operator_version_id=version_id,
        instruction_json=next_instruction_json,
        tool_manifest=next_tool_manifest,
    )
    record_operator_event(
        tenant_id=current["tenant_id"],
        operator_id=current["operator_id"],
        operator_version_id=version_id,
        mission_id=None,
        event_type="version_updated",
        event_status="ok",
        detail="Updated operator version",
        metadata={"status": next_status, "validation_status": next_validation_status},
        created_by=updated_by,
    )

    if next_status == "active":
        activate_operator_version(version_id, activated_by=updated_by)

    return get_operator_version(version_id)


def activate_operator_version(version_id: str, *, activated_by: str) -> dict[str, Any]:
    row = _get_operator_version_row(version_id)
    if row is None:
        raise KeyError("Operator version not found")

    with connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE operator_versions
                SET status = 'validated', updated_at = now()
                WHERE tenant_id = %s
                  AND operator_id = %s
                  AND status = 'active'
                  AND id <> %s;
                """,
                (row["tenant_id"], row["operator_id"], version_id),
            )
            cur.execute(
                """
                UPDATE operator_versions
                SET status = 'active', updated_at = now()
                WHERE id = %s;
                """,
                (version_id,),
            )
        conn.commit()

    record_operator_event(
        tenant_id=row["tenant_id"],
        operator_id=row["operator_id"],
        operator_version_id=version_id,
        mission_id=None,
        event_type="version_activated",
        event_status="ok",
        detail="Activated operator version",
        metadata={"version_number": int(row["version_number"])},
        created_by=activated_by,
    )
    version = get_operator_version(version_id)
    if version is None:
        raise RuntimeError("Failed to activate operator version")
    return version


def _get_latest_runner_instruction_row(operator_version_id: str) -> dict[str, Any] | None:
    with connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                    id,
                    tenant_id,
                    operator_version_id,
                    instruction_json,
                    tool_manifest,
                    checksum,
                    created_at
                FROM runner_instructions
                WHERE operator_version_id = %s
                ORDER BY created_at DESC
                LIMIT 1;
                """,
                (operator_version_id,),
            )
            row = cur.fetchone()
    return row


def _create_mission_record(
    *,
    mission_id: str,
    tenant_id: str,
    user_id: str,
    operator_id: str,
    operator_version_id: str,
    trigger_id: str | None,
    source: str,
    approval_task_id: str | None,
    input_payload: dict[str, Any],
) -> None:
    mission_source = _normalize_mission_source(source)
    with connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO operator_missions(
                    id,
                    tenant_id,
                    user_id,
                    operator_id,
                    operator_version_id,
                    trigger_id,
                    source,
                    approval_task_id,
                    status,
                    summary,
                    input_payload,
                    started_at
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 'running', 'runner_execution_started', %s, now());
                """,
                (
                    mission_id,
                    tenant_id,
                    user_id,
                    operator_id,
                    operator_version_id,
                    trigger_id,
                    mission_source,
                    approval_task_id,
                    _to_jsonb(_redact_value(input_payload)),
                ),
            )
        conn.commit()


def _finalize_mission_record(
    *,
    mission_id: str,
    status: str,
    summary: str,
    output_payload: dict[str, Any],
    redacted_tool_log: list[dict[str, Any]],
    artifacts: list[dict[str, Any]] | None = None,
    token_estimate: int,
    cost_estimate: float,
    error: str | None,
) -> None:
    mission_status = status if status in MISSION_STATUSES else "failed"
    with connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE operator_missions
                SET
                    status = %s,
                    summary = %s,
                    output_payload = %s,
                    redacted_tool_log = %s,
                    artifacts = %s,
                    token_estimate = %s,
                    cost_estimate = %s,
                    error = %s,
                    finished_at = now(),
                    updated_at = now()
                WHERE id = %s;
                """,
                (
                    mission_status,
                    summary,
                    _to_jsonb(_redact_value(output_payload)),
                    _to_jsonb(_redact_value(redacted_tool_log)),
                    _to_jsonb(_redact_value(artifacts or [])),
                    max(int(token_estimate), 0),
                    Decimal(str(max(float(cost_estimate), 0))),
                    error,
                    mission_id,
                ),
            )
        conn.commit()


def get_operator_mission(mission_id: str) -> dict[str, Any] | None:
    with connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                    id,
                    tenant_id,
                    user_id,
                    operator_id,
                    operator_version_id,
                    trigger_id,
                    source,
                    approval_task_id,
                    status,
                    summary,
                    input_payload,
                    output_payload,
                    redacted_tool_log,
                    artifacts,
                    token_estimate,
                    cost_estimate,
                    error,
                    started_at,
                    finished_at,
                    created_at,
                    updated_at
                FROM operator_missions
                WHERE id = %s;
                """,
                (mission_id,),
            )
            row = cur.fetchone()
    if row is None:
        return None
    return _serialize_mission(row)


def list_operator_missions(
    *,
    tenant_id: str,
    operator_id: str | None = None,
    operator_version_id: str | None = None,
    status: str | None = None,
    source: str | None = None,
    started_after: datetime | None = None,
    started_before: datetime | None = None,
    limit: int = 50,
    offset: int = 0,
) -> dict[str, Any]:
    safe_limit = min(max(int(limit), 1), 200)
    safe_offset = max(int(offset), 0)

    conditions = ["tenant_id = %s"]
    params: list[Any] = [tenant_id]

    normalized_operator_id = str(operator_id or "").strip()
    if normalized_operator_id:
        conditions.append("operator_id = %s")
        params.append(normalized_operator_id)

    normalized_version_id = str(operator_version_id or "").strip()
    if normalized_version_id:
        conditions.append("operator_version_id = %s")
        params.append(normalized_version_id)

    normalized_status = str(status or "").strip().lower()
    if normalized_status:
        conditions.append("status = %s")
        params.append(normalized_status)

    normalized_source = str(source or "").strip().lower()
    if normalized_source:
        conditions.append("source = %s")
        params.append(normalized_source)

    if started_after is not None:
        conditions.append("started_at >= %s")
        params.append(_as_utc(started_after))

    if started_before is not None:
        conditions.append("started_at <= %s")
        params.append(_as_utc(started_before))

    where_clause = " AND ".join(conditions)

    with connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"""
                SELECT count(*) AS total
                FROM operator_missions
                WHERE {where_clause};
                """,
                tuple(params),
            )
            total_row = cur.fetchone() or {}

            query_params = [*params, safe_limit, safe_offset]
            cur.execute(
                f"""
                SELECT
                    id,
                    tenant_id,
                    user_id,
                    operator_id,
                    operator_version_id,
                    trigger_id,
                    source,
                    approval_task_id,
                    status,
                    summary,
                    input_payload,
                    output_payload,
                    redacted_tool_log,
                    artifacts,
                    token_estimate,
                    cost_estimate,
                    error,
                    started_at,
                    finished_at,
                    created_at,
                    updated_at
                FROM operator_missions
                WHERE {where_clause}
                ORDER BY created_at DESC
                LIMIT %s
                OFFSET %s;
                """,
                tuple(query_params),
            )
            rows = cur.fetchall()

    return {
        "missions": [_serialize_mission(row) for row in rows],
        "total": int(total_row.get("total") or 0),
        "limit": safe_limit,
        "offset": safe_offset,
    }


def list_operator_mission_events(mission_id: str, *, limit: int = 100) -> list[dict[str, Any]]:
    safe_limit = min(max(int(limit), 1), 500)
    with connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                    id,
                    tenant_id,
                    operator_id,
                    operator_version_id,
                    mission_id,
                    event_type,
                    event_status,
                    detail,
                    metadata,
                    created_by,
                    created_at
                FROM operator_audit_events
                WHERE mission_id = %s
                ORDER BY created_at ASC, id ASC
                LIMIT %s;
                """,
                (mission_id, safe_limit),
            )
            rows = cur.fetchall()
    return [
        {
            "id": int(row["id"]),
            "tenant_id": row["tenant_id"],
            "operator_id": row["operator_id"],
            "operator_version_id": row["operator_version_id"],
            "mission_id": row["mission_id"],
            "event_type": row["event_type"],
            "event_status": row["event_status"],
            "detail": row["detail"],
            "metadata": row["metadata"] or {},
            "created_by": row["created_by"],
            "created_at": _to_iso(row["created_at"]),
        }
        for row in rows
    ]


def run_operator_version(
    *,
    tenant_id: str,
    user_id: str,
    operator_version_id: str,
    input_payload: dict[str, Any],
    tenant_tool_allowlist: list[str],
    tool_impls: dict[str, Callable[[dict[str, Any]], Any]],
    source: str = "manual",
    trigger_id: str | None = None,
    approval_task_id: str | None = None,
) -> dict[str, Any]:
    version = _get_operator_version_row(operator_version_id)
    if version is None:
        raise KeyError("Operator version not found")
    if version["tenant_id"] != tenant_id:
        raise ValueError("Operator version does not belong to tenant")

    mission_id = str(uuid4())
    operator_id = str(version["operator_id"])
    _create_mission_record(
        mission_id=mission_id,
        tenant_id=tenant_id,
        user_id=user_id,
        operator_id=operator_id,
        operator_version_id=operator_version_id,
        trigger_id=(str(trigger_id).strip() or None) if trigger_id is not None else None,
        source=source,
        approval_task_id=(str(approval_task_id).strip() or None) if approval_task_id is not None else None,
        input_payload=input_payload if isinstance(input_payload, dict) else {},
    )
    record_operator_event(
        tenant_id=tenant_id,
        operator_id=operator_id,
        operator_version_id=operator_version_id,
        mission_id=mission_id,
        event_type="runner_execution_start",
        event_status="ok",
        detail="Runner execution started",
        metadata={},
        created_by=user_id,
    )

    instruction_row = _get_latest_runner_instruction_row(operator_version_id)
    if instruction_row is None:
        summary = "Persisted runner instruction missing"
        output = {"runner_status": "PARTIAL", "reason": "missing_persisted_instruction"}
        _finalize_mission_record(
            mission_id=mission_id,
            status="partial",
            summary=summary,
            output_payload=output,
            redacted_tool_log=[],
            token_estimate=0,
            cost_estimate=0.0,
            error="missing_persisted_instruction",
        )
        record_operator_event(
            tenant_id=tenant_id,
            operator_id=operator_id,
            operator_version_id=operator_version_id,
            mission_id=mission_id,
            event_type="missing_tool_stop",
            event_status="partial",
            detail=summary,
            metadata=output,
            created_by=user_id,
        )
        record_operator_event(
            tenant_id=tenant_id,
            operator_id=operator_id,
            operator_version_id=operator_version_id,
            mission_id=mission_id,
            event_type="runner_execution_finish",
            event_status="partial",
            detail=summary,
            metadata=output,
            created_by=user_id,
        )
        mission = get_operator_mission(mission_id)
        if mission is None:
            raise RuntimeError("Mission not found after partial finish")
        return mission

    persisted_instruction = instruction_row["instruction_json"] if isinstance(instruction_row["instruction_json"], dict) else {}
    steps = persisted_instruction.get("steps")
    if not isinstance(steps, list):
        steps = []
    manifest = _normalize_tool_manifest(version["tool_manifest"] or instruction_row["tool_manifest"] or [])
    allowlist = set(_normalize_tool_manifest(tenant_tool_allowlist))

    # Required tools are locked to persisted manifest + persisted steps.
    for step in steps:
        if isinstance(step, dict):
            tool_name = str(step.get("tool", "")).strip()
            if tool_name and tool_name not in manifest:
                manifest.append(tool_name)

    missing_tools = [tool for tool in manifest if tool not in tool_impls]
    if missing_tools:
        summary = f"PARTIAL: missing required tool(s): {', '.join(missing_tools)}"
        output = {"runner_status": "PARTIAL", "missing_tools": missing_tools, "instruction_source": "persisted"}
        _finalize_mission_record(
            mission_id=mission_id,
            status="partial",
            summary=summary,
            output_payload=output,
            redacted_tool_log=[],
            token_estimate=0,
            cost_estimate=0.0,
            error="missing_required_tool",
        )
        record_operator_event(
            tenant_id=tenant_id,
            operator_id=operator_id,
            operator_version_id=operator_version_id,
            mission_id=mission_id,
            event_type="missing_tool_stop",
            event_status="partial",
            detail=summary,
            metadata={"missing_tools": missing_tools},
            created_by=user_id,
        )
        record_operator_event(
            tenant_id=tenant_id,
            operator_id=operator_id,
            operator_version_id=operator_version_id,
            mission_id=mission_id,
            event_type="runner_execution_finish",
            event_status="partial",
            detail=summary,
            metadata={"missing_tools": missing_tools},
            created_by=user_id,
        )
        mission = get_operator_mission(mission_id)
        if mission is None:
            raise RuntimeError("Mission not found after partial finish")
        return mission

    denied_tools = [tool for tool in manifest if tool not in allowlist]
    if denied_tools:
        summary = f"Blocked by tenant policy: {', '.join(denied_tools)}"
        output = {"runner_status": "BLOCKED", "denied_tools": denied_tools}
        _finalize_mission_record(
            mission_id=mission_id,
            status="blocked",
            summary=summary,
            output_payload=output,
            redacted_tool_log=[],
            token_estimate=0,
            cost_estimate=0.0,
            error="policy_denied_tool",
        )
        record_operator_event(
            tenant_id=tenant_id,
            operator_id=operator_id,
            operator_version_id=operator_version_id,
            mission_id=mission_id,
            event_type="policy_deny",
            event_status="blocked",
            detail=summary,
            metadata={"denied_tools": denied_tools},
            created_by=user_id,
        )
        record_operator_event(
            tenant_id=tenant_id,
            operator_id=operator_id,
            operator_version_id=operator_version_id,
            mission_id=mission_id,
            event_type="runner_execution_finish",
            event_status="blocked",
            detail=summary,
            metadata={"denied_tools": denied_tools},
            created_by=user_id,
        )
        mission = get_operator_mission(mission_id)
        if mission is None:
            raise RuntimeError("Mission not found after blocked finish")
        return mission

    redacted_logs: list[dict[str, Any]] = []
    outputs: list[dict[str, Any]] = []
    for index, step in enumerate(steps):
        if not isinstance(step, dict):
            redacted_logs.append({"step_index": index, "status": "skipped_invalid_step"})
            continue

        tool_name = str(step.get("tool", "")).strip()
        payload = step.get("payload") if isinstance(step.get("payload"), dict) else {}
        if not tool_name:
            redacted_logs.append({"step_index": index, "status": "skipped_missing_tool"})
            continue
        if tool_name not in tool_impls:
            summary = f"PARTIAL: missing required tool during execution: {tool_name}"
            output = {"runner_status": "PARTIAL", "missing_tools": [tool_name], "instruction_source": "persisted"}
            _finalize_mission_record(
                mission_id=mission_id,
                status="partial",
                summary=summary,
                output_payload=output,
                redacted_tool_log=redacted_logs,
                token_estimate=len(redacted_logs) * 50,
                cost_estimate=0.0,
                error="missing_required_tool",
            )
            record_operator_event(
                tenant_id=tenant_id,
                operator_id=operator_id,
                operator_version_id=operator_version_id,
                mission_id=mission_id,
                event_type="missing_tool_stop",
                event_status="partial",
                detail=summary,
                metadata={"missing_tools": [tool_name]},
                created_by=user_id,
            )
            record_operator_event(
                tenant_id=tenant_id,
                operator_id=operator_id,
                operator_version_id=operator_version_id,
                mission_id=mission_id,
                event_type="runner_execution_finish",
                event_status="partial",
                detail=summary,
                metadata={"missing_tools": [tool_name]},
                created_by=user_id,
            )
            mission = get_operator_mission(mission_id)
            if mission is None:
                raise RuntimeError("Mission not found after partial finish")
            return mission
        if tool_name not in allowlist:
            summary = f"Blocked by tenant policy during execution: {tool_name}"
            output = {"runner_status": "BLOCKED", "denied_tools": [tool_name]}
            _finalize_mission_record(
                mission_id=mission_id,
                status="blocked",
                summary=summary,
                output_payload=output,
                redacted_tool_log=redacted_logs,
                token_estimate=len(redacted_logs) * 50,
                cost_estimate=0.0,
                error="policy_denied_tool",
            )
            record_operator_event(
                tenant_id=tenant_id,
                operator_id=operator_id,
                operator_version_id=operator_version_id,
                mission_id=mission_id,
                event_type="policy_deny",
                event_status="blocked",
                detail=summary,
                metadata={"denied_tools": [tool_name]},
                created_by=user_id,
            )
            record_operator_event(
                tenant_id=tenant_id,
                operator_id=operator_id,
                operator_version_id=operator_version_id,
                mission_id=mission_id,
                event_type="runner_execution_finish",
                event_status="blocked",
                detail=summary,
                metadata={"denied_tools": [tool_name]},
                created_by=user_id,
            )
            mission = get_operator_mission(mission_id)
            if mission is None:
                raise RuntimeError("Mission not found after blocked finish")
            return mission

        try:
            result = tool_impls[tool_name](payload)
            redacted_logs.append(
                {
                    "step_index": index,
                    "tool": tool_name,
                    "payload": _redact_value(payload),
                    "output": _redact_value(result),
                    "status": "ok",
                }
            )
            outputs.append({"step_index": index, "tool": tool_name, "output": _redact_value(result)})
        except Exception as exc:  # noqa: BLE001
            summary = f"Runner failed at step {index}: {exc}"
            redacted_logs.append(
                {
                    "step_index": index,
                    "tool": tool_name,
                    "payload": _redact_value(payload),
                    "status": "error",
                    "error": str(exc),
                }
            )
            _finalize_mission_record(
                mission_id=mission_id,
                status="failed",
                summary=summary,
                output_payload={"runner_status": "FAILED"},
                redacted_tool_log=redacted_logs,
                token_estimate=len(redacted_logs) * 50,
                cost_estimate=0.0,
                error=str(exc),
            )
            record_operator_event(
                tenant_id=tenant_id,
                operator_id=operator_id,
                operator_version_id=operator_version_id,
                mission_id=mission_id,
                event_type="runner_execution_finish",
                event_status="failed",
                detail=summary,
                metadata={"step_index": index},
                created_by=user_id,
            )
            mission = get_operator_mission(mission_id)
            if mission is None:
                raise RuntimeError("Mission not found after failed finish")
            return mission

    summary = f"Completed {len(steps)} step(s) from persisted instruction"
    _finalize_mission_record(
        mission_id=mission_id,
        status="completed",
        summary=summary,
        output_payload={"runner_status": "COMPLETED", "outputs": outputs, "instruction_source": "persisted"},
        redacted_tool_log=redacted_logs,
        artifacts=outputs,
        token_estimate=max(len(redacted_logs), 1) * 50,
        cost_estimate=0.0,
        error=None,
    )
    record_operator_event(
        tenant_id=tenant_id,
        operator_id=operator_id,
        operator_version_id=operator_version_id,
        mission_id=mission_id,
        event_type="runner_execution_finish",
        event_status="completed",
        detail=summary,
        metadata={"steps": len(steps)},
        created_by=user_id,
    )
    mission = get_operator_mission(mission_id)
    if mission is None:
        raise RuntimeError("Mission not found after completed finish")
    return mission
