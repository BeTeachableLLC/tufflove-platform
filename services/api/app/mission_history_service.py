from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from app.db import connect

FINAL_TASK_STATUSES = {"completed", "failed", "blocked", "rejected", "partial", "would_publish", "scheduled"}
SENSITIVE_KEYS = {
    "access_token",
    "refresh_token",
    "password",
    "api_key",
    "authorization",
    "secret",
    "token",
}


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


def _redact(value: Any) -> Any:
    if isinstance(value, dict):
        redacted: dict[str, Any] = {}
        for key, item in value.items():
            normalized = str(key).strip().lower()
            if normalized in SENSITIVE_KEYS:
                redacted[key] = "[REDACTED]"
            else:
                redacted[key] = _redact(item)
        return redacted
    if isinstance(value, list):
        return [_redact(item) for item in value]
    return value


def _extract_dry_run(payload: dict[str, Any], result: dict[str, Any]) -> bool:
    if isinstance(payload.get("dry_run"), bool):
        return bool(payload.get("dry_run"))
    if isinstance(result.get("dry_run"), bool):
        return bool(result.get("dry_run"))

    payload_to_send = result.get("payload_to_send")
    if isinstance(payload_to_send, dict) and isinstance(payload_to_send.get("dry_run"), bool):
        return bool(payload_to_send.get("dry_run"))
    return False


def _blocked_reason(status: str, error: str | None, result: dict[str, Any]) -> str | None:
    note = result.get("note") if isinstance(result, dict) else None
    if isinstance(note, str) and note.strip() and status in {"blocked", "failed", "rejected", "partial"}:
        return note.strip()
    if error and status in {"blocked", "failed", "rejected", "partial"}:
        return error
    return None


def _serialize_task_row(row: dict[str, Any]) -> dict[str, Any]:
    payload = row.get("payload") if isinstance(row.get("payload"), dict) else {}
    result = row.get("result") if isinstance(row.get("result"), dict) else {}
    status = str(row.get("status") or "")
    created_at = row.get("created_at")
    updated_at = row.get("updated_at")

    completed_at = updated_at if status in FINAL_TASK_STATUSES else None

    trigger_metadata = row.get("trigger_metadata") if isinstance(row.get("trigger_metadata"), dict) else {}

    return {
        "id": row["task_id"],
        "entry_type": "task",
        "tenant_id": row["tenant_id"],
        "user_id": row["user_id"],
        "task_type": row["task_type"],
        "status": status,
        "blocked_reason": _blocked_reason(status, row.get("error"), result),
        "approval_status": row.get("approval_status"),
        "dry_run": _extract_dry_run(payload, result),
        "created_at": _to_iso(created_at),
        "started_at": _to_iso(created_at),
        "completed_at": _to_iso(completed_at),
        "trigger_id": row.get("trigger_id"),
        "trigger_source": trigger_metadata.get("source") if isinstance(trigger_metadata, dict) else None,
        "operator_id": row.get("trigger_operator_id"),
        "operator_version_id": None,
        "subaccount_id": row.get("subaccount_id"),
        "subaccount_name": row.get("subaccount_name"),
        "brand_id": row.get("brand_id"),
        "brand_name": row.get("brand_name"),
        "content_item_id": row.get("content_item_id"),
        "summary": result.get("note") if isinstance(result.get("note"), str) else None,
    }


def _serialize_operator_row(row: dict[str, Any]) -> dict[str, Any]:
    input_payload = row.get("input_payload") if isinstance(row.get("input_payload"), dict) else {}
    output_payload = row.get("output_payload") if isinstance(row.get("output_payload"), dict) else {}
    status = str(row.get("status") or "")
    metadata = input_payload if isinstance(input_payload, dict) else {}

    return {
        "id": row["id"],
        "entry_type": "operator_mission",
        "tenant_id": row["tenant_id"],
        "user_id": row["user_id"],
        "task_type": "operator.run",
        "status": status,
        "blocked_reason": row.get("error") if status in {"blocked", "failed", "partial"} else None,
        "approval_status": None,
        "dry_run": bool(output_payload.get("dry_run") or input_payload.get("dry_run")),
        "created_at": _to_iso(row.get("created_at")),
        "started_at": _to_iso(row.get("started_at")),
        "completed_at": _to_iso(row.get("finished_at")),
        "trigger_id": metadata.get("trigger_id") if isinstance(metadata.get("trigger_id"), str) else None,
        "trigger_source": metadata.get("source") if isinstance(metadata.get("source"), str) else None,
        "operator_id": row.get("operator_id"),
        "operator_version_id": row.get("operator_version_id"),
        "subaccount_id": metadata.get("subaccount_id") if isinstance(metadata.get("subaccount_id"), str) else None,
        "subaccount_name": None,
        "brand_id": metadata.get("brand_id") if isinstance(metadata.get("brand_id"), str) else None,
        "brand_name": None,
        "content_item_id": metadata.get("content_item_id") if isinstance(metadata.get("content_item_id"), str) else None,
        "summary": row.get("summary"),
    }


def _task_list_query() -> str:
    return """
        SELECT
            t.task_id,
            t.tenant_id,
            t.user_id,
            t.task_type,
            t.status,
            t.payload,
            t.result,
            t.error,
            t.created_at,
            t.updated_at,
            a.status AS approval_status,
            te.trigger_id,
            te.metadata AS trigger_metadata,
            tr.operator_id AS trigger_operator_id,
            ci.id AS content_item_id,
            ci.subaccount_id,
            sa.name AS subaccount_name,
            ci.brand_id,
            b.name AS brand_name
        FROM task_audit_log t
        LEFT JOIN task_approvals a
          ON a.task_id = t.task_id
        LEFT JOIN LATERAL (
            SELECT trigger_id, metadata, created_at
            FROM trigger_events
            WHERE task_id = t.task_id
            ORDER BY created_at DESC
            LIMIT 1
        ) te ON TRUE
        LEFT JOIN triggers tr
          ON tr.id = te.trigger_id
        LEFT JOIN LATERAL (
            SELECT id, subaccount_id, brand_id
            FROM content_items
            WHERE id = NULLIF(t.payload->>'content_item_id', '')
               OR source_task_id = t.task_id
            ORDER BY CASE WHEN id = NULLIF(t.payload->>'content_item_id', '') THEN 0 ELSE 1 END
            LIMIT 1
        ) ci ON TRUE
        LEFT JOIN subaccounts sa
          ON sa.id = ci.subaccount_id
        LEFT JOIN brands b
          ON b.id = ci.brand_id
         AND b.tenant_id = t.tenant_id
    """


def _operator_list_query() -> str:
    return """
        SELECT
            id,
            tenant_id,
            user_id,
            operator_id,
            operator_version_id,
            status,
            summary,
            input_payload,
            output_payload,
            error,
            started_at,
            finished_at,
            created_at,
            updated_at
        FROM operator_missions
    """


def list_familyops_missions(
    *,
    tenant_id: str = "familyops",
    status: str | None = None,
    task_type: str | None = None,
    subaccount_id: str | None = None,
    brand_id: str | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    search: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> dict[str, Any]:
    task_conditions: list[str] = []
    task_params: list[Any] = []

    if tenant_id.strip():
        task_conditions.append("t.tenant_id = %s")
        task_params.append(tenant_id.strip())

    normalized_status = str(status or "").strip()
    if normalized_status:
        task_conditions.append("t.status = %s")
        task_params.append(normalized_status)

    normalized_task_type = str(task_type or "").strip()
    if normalized_task_type:
        task_conditions.append("t.task_type = %s")
        task_params.append(normalized_task_type)

    normalized_subaccount = str(subaccount_id or "").strip()
    if normalized_subaccount:
        task_conditions.append("ci.subaccount_id = %s")
        task_params.append(normalized_subaccount)

    normalized_brand = str(brand_id or "").strip()
    if normalized_brand:
        task_conditions.append("ci.brand_id = %s")
        task_params.append(normalized_brand)

    if date_from is not None:
        task_conditions.append("t.created_at >= %s")
        task_params.append(date_from)
    if date_to is not None:
        task_conditions.append("t.created_at <= %s")
        task_params.append(date_to)

    normalized_search = str(search or "").strip()
    if normalized_search:
        like = f"%{normalized_search}%"
        task_conditions.append(
            "(t.task_id ILIKE %s OR t.task_type ILIKE %s OR COALESCE(t.error, '') ILIKE %s OR COALESCE(ci.brand_id, '') ILIKE %s)"
        )
        task_params.extend([like, like, like, like])

    task_where = f"WHERE {' AND '.join(task_conditions)}" if task_conditions else ""

    operator_conditions: list[str] = []
    operator_params: list[Any] = []

    if tenant_id.strip():
        operator_conditions.append("tenant_id = %s")
        operator_params.append(tenant_id.strip())
    if normalized_status:
        operator_conditions.append("status = %s")
        operator_params.append(normalized_status)
    if date_from is not None:
        operator_conditions.append("created_at >= %s")
        operator_params.append(date_from)
    if date_to is not None:
        operator_conditions.append("created_at <= %s")
        operator_params.append(date_to)
    if normalized_search:
        like = f"%{normalized_search}%"
        operator_conditions.append("(id ILIKE %s OR operator_id ILIKE %s OR summary ILIKE %s)")
        operator_params.extend([like, like, like])

    include_operator = not normalized_task_type or normalized_task_type == "operator.run"
    operator_where = f"WHERE {' AND '.join(operator_conditions)}" if operator_conditions else ""

    with connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"""
                {_task_list_query()}
                {task_where}
                ORDER BY t.created_at DESC
                LIMIT 400;
                """,
                tuple(task_params),
            )
            task_rows = cur.fetchall()

            operator_rows: list[dict[str, Any]] = []
            if include_operator:
                cur.execute(
                    f"""
                    {_operator_list_query()}
                    {operator_where}
                    ORDER BY created_at DESC
                    LIMIT 200;
                    """,
                    tuple(operator_params),
                )
                operator_rows = cur.fetchall()

    task_entries = [_serialize_task_row(row) for row in task_rows]
    operator_entries = [_serialize_operator_row(row) for row in operator_rows]

    merged = [*task_entries, *operator_entries]

    if normalized_subaccount:
        merged = [item for item in merged if item.get("subaccount_id") == normalized_subaccount]
    if normalized_brand:
        merged = [item for item in merged if item.get("brand_id") == normalized_brand]

    merged.sort(key=lambda item: item.get("created_at") or "", reverse=True)

    safe_limit = min(max(int(limit), 1), 200)
    safe_offset = max(int(offset), 0)
    paged = merged[safe_offset : safe_offset + safe_limit]

    return {
        "tenant_id": tenant_id,
        "total": len(merged),
        "limit": safe_limit,
        "offset": safe_offset,
        "items": paged,
    }


def _build_task_timeline(cur, *, task_id: str, content_item_id: str | None, status: str, result: dict[str, Any], created_at: Any, updated_at: Any) -> list[dict[str, Any]]:
    timeline: list[dict[str, Any]] = []

    def add_event(*, at: Any, event_type: str, status_value: str, detail: str = "", metadata: dict[str, Any] | None = None) -> None:
        timeline.append(
            {
                "at": _to_iso(at),
                "event_type": event_type,
                "status": status_value,
                "detail": detail,
                "metadata": _redact(metadata or {}),
            }
        )

    add_event(at=created_at, event_type="enqueued", status_value="ok", detail="Task enqueued")

    cur.execute(
        """
        SELECT event_type, event_status, metadata, created_at, trigger_id
        FROM trigger_events
        WHERE task_id = %s
        ORDER BY created_at ASC;
        """,
        (task_id,),
    )
    for row in cur.fetchall():
        add_event(
            at=row["created_at"],
            event_type=f"trigger_{row['event_type']}",
            status_value=row["event_status"],
            detail=f"Trigger event ({row['event_type']}/{row['event_status']})",
            metadata={"trigger_id": row.get("trigger_id"), **(row.get("metadata") or {})},
        )

    cur.execute(
        """
        SELECT status, approved_by, approved_at, note, created_at
        FROM task_approvals
        WHERE task_id = %s;
        """,
        (task_id,),
    )
    approval_row = cur.fetchone()
    if approval_row is not None:
        approval_at = approval_row.get("approved_at") or approval_row.get("created_at")
        add_event(
            at=approval_at,
            event_type="approval",
            status_value=str(approval_row.get("status") or "pending"),
            detail=approval_row.get("note") or "Task approval updated",
            metadata={"approved_by": approval_row.get("approved_by")},
        )

    if content_item_id:
        cur.execute(
            """
            SELECT action, reviewer, note, metadata_json, created_at
            FROM content_reviews
            WHERE content_item_id = %s
            ORDER BY created_at ASC;
            """,
            (content_item_id,),
        )
        for row in cur.fetchall():
            add_event(
                at=row["created_at"],
                event_type=f"content_{row['action']}",
                status_value="ok",
                detail=row.get("note") or f"Content {row['action']}",
                metadata={"reviewer": row.get("reviewer"), **(row.get("metadata_json") or {})},
            )

        cur.execute(
            """
            SELECT status, revision_note, error, created_at, processed_at
            FROM ai_regeneration_jobs
            WHERE content_item_id = %s
            ORDER BY created_at ASC;
            """,
            (content_item_id,),
        )
        for row in cur.fetchall():
            add_event(
                at=row["created_at"],
                event_type="regeneration_job_created",
                status_value=row["status"],
                detail=row.get("revision_note") or "Regeneration job created",
            )
            if row.get("processed_at"):
                add_event(
                    at=row["processed_at"],
                    event_type="regeneration_job_processed",
                    status_value=row["status"],
                    detail=row.get("error") or "Regeneration job processed",
                )

    if status in FINAL_TASK_STATUSES:
        add_event(
            at=updated_at,
            event_type=status,
            status_value=status,
            detail=result.get("note") if isinstance(result.get("note"), str) else "Task finished",
        )

    if isinstance(result, dict):
        dry_run = _extract_dry_run({}, result)
        if dry_run and str(result.get("status") or "") == "would_publish":
            add_event(
                at=updated_at,
                event_type="dry_run_would_publish",
                status_value="ok",
                detail="Publish task resolved as dry-run would_publish",
                metadata={"dry_run": True},
            )

    timeline.sort(key=lambda item: item.get("at") or "")
    return timeline


def get_familyops_mission(mission_id: str, *, tenant_id: str = "familyops") -> dict[str, Any] | None:
    normalized_id = mission_id.strip()
    if not normalized_id:
        return None

    with connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"""
                {_task_list_query()}
                WHERE t.task_id = %s
                  AND t.tenant_id = %s
                LIMIT 1;
                """,
                (normalized_id, tenant_id),
            )
            task_row = cur.fetchone()
            if task_row is not None:
                task_item = _serialize_task_row(task_row)
                payload = task_row.get("payload") if isinstance(task_row.get("payload"), dict) else {}
                result = task_row.get("result") if isinstance(task_row.get("result"), dict) else {}
                task_item["payload_preview"] = _redact(payload)
                task_item["result_preview"] = _redact(result)
                task_item["timeline"] = _build_task_timeline(
                    cur,
                    task_id=task_row["task_id"],
                    content_item_id=task_row.get("content_item_id"),
                    status=str(task_row.get("status") or ""),
                    result=result,
                    created_at=task_row.get("created_at"),
                    updated_at=task_row.get("updated_at"),
                )
                return task_item

            cur.execute(
                """
                SELECT
                    id,
                    tenant_id,
                    user_id,
                    operator_id,
                    operator_version_id,
                    status,
                    summary,
                    input_payload,
                    output_payload,
                    redacted_tool_log,
                    token_estimate,
                    cost_estimate,
                    error,
                    started_at,
                    finished_at,
                    created_at,
                    updated_at
                FROM operator_missions
                WHERE id = %s
                  AND tenant_id = %s
                LIMIT 1;
                """,
                (normalized_id, tenant_id),
            )
            operator_row = cur.fetchone()
            if operator_row is None:
                return None

            item = _serialize_operator_row(operator_row)
            item["payload_preview"] = _redact(operator_row.get("input_payload") or {})
            item["result_preview"] = _redact(operator_row.get("output_payload") or {})
            item["tool_log"] = _redact(operator_row.get("redacted_tool_log") or [])
            item["token_estimate"] = int(operator_row.get("token_estimate") or 0)
            item["cost_estimate"] = float(operator_row.get("cost_estimate") or 0)

            cur.execute(
                """
                SELECT event_type, event_status, detail, metadata, created_by, created_at
                FROM operator_audit_events
                WHERE mission_id = %s
                ORDER BY created_at ASC;
                """,
                (normalized_id,),
            )
            timeline = [
                {
                    "at": _to_iso(row["created_at"]),
                    "event_type": row["event_type"],
                    "status": row["event_status"],
                    "detail": row.get("detail") or "",
                    "metadata": _redact({"created_by": row.get("created_by"), **(row.get("metadata") or {})}),
                }
                for row in cur.fetchall()
            ]
            item["timeline"] = timeline
            return item
