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
    "ready_for_merge",
    "rejected",
    "rerun_requested",
}

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
                    created_by text NOT NULL DEFAULT 'admin',
                    created_at timestamptz NOT NULL DEFAULT now(),
                    updated_at timestamptz NOT NULL DEFAULT now()
                );
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

    _update_build_request(
        build_request_id,
        stage=stage,
        pr_url=str(pr_url or "").strip() or None,
        pr_number=str(pr_number or "").strip() or None,
        proof_summary=str(proof_summary or "").strip(),
        test_summary=str(test_summary or "").strip(),
        files_changed_summary=str(files_changed_summary or "").strip(),
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
