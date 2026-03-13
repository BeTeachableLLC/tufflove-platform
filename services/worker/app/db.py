from __future__ import annotations

from datetime import datetime, timedelta, timezone
import os
import time
from typing import Any
from uuid import uuid4

import psycopg
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb


def get_dsn() -> str:
    dsn = os.getenv("DATABASE_URL", "").strip()
    if not dsn:
        raise RuntimeError("DATABASE_URL is not set")
    return dsn.replace("postgresql+psycopg://", "postgresql://", 1)


def connect() -> psycopg.Connection:
    dsn = get_dsn()
    last: Exception | None = None
    retries = int(os.getenv("DB_CONNECT_RETRIES", "30"))
    delay = float(os.getenv("DB_CONNECT_DELAY_SEC", "0.5"))
    for _ in range(retries):
        try:
            return psycopg.connect(dsn, row_factory=dict_row)
        except psycopg.OperationalError as exc:
            last = exc
            time.sleep(delay)
    if last is not None:
        raise last
    raise RuntimeError("Unable to connect to database")


def _to_jsonb(value: Any) -> Jsonb | None:
    if value is None:
        return None
    return Jsonb(value)


def _to_iso(value: datetime | None) -> str | None:
    if value is None:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc).isoformat()


def upsert_task_log(
    task_id: str,
    tenant_id: str,
    user_id: str,
    task_type: str,
    status: str,
    payload: dict[str, Any] | None = None,
    result: dict[str, Any] | None = None,
    error: str | None = None,
) -> None:
    with connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO task_audit_log (
                    task_id,
                    tenant_id,
                    user_id,
                    task_type,
                    status,
                    payload,
                    result,
                    error,
                    updated_at
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, now())
                ON CONFLICT (task_id) DO UPDATE SET
                    tenant_id = EXCLUDED.tenant_id,
                    user_id = EXCLUDED.user_id,
                    task_type = EXCLUDED.task_type,
                    status = EXCLUDED.status,
                    payload = COALESCE(EXCLUDED.payload, task_audit_log.payload),
                    result = COALESCE(EXCLUDED.result, task_audit_log.result),
                    error = EXCLUDED.error,
                    updated_at = now();
                """,
                (
                    task_id,
                    tenant_id,
                    user_id,
                    task_type,
                    status,
                    _to_jsonb(payload),
                    _to_jsonb(result),
                    error,
                ),
            )
        conn.commit()


def get_approval(task_id: str) -> dict[str, Any] | None:
    with connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                    task_id,
                    tenant_id,
                    status,
                    approved_by,
                    approved_at,
                    note,
                    created_at
                FROM task_approvals
                WHERE task_id = %s;
                """,
                (task_id,),
            )
            row = cur.fetchone()

    if row is None:
        return None
    return {
        "task_id": row["task_id"],
        "tenant_id": row["tenant_id"],
        "status": row["status"],
        "approved_by": row["approved_by"],
        "approved_at": row["approved_at"].isoformat() if row["approved_at"] else None,
        "note": row["note"],
        "created_at": row["created_at"].isoformat() if row["created_at"] else None,
    }


def get_ghl_connection(tenant_id: str, location_id: str) -> dict[str, Any] | None:
    with connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                    tenant_id,
                    location_id,
                    access_token,
                    refresh_token,
                    expires_at,
                    status,
                    created_at,
                    updated_at
                FROM ghl_connections
                WHERE tenant_id = %s
                  AND location_id = %s;
                """,
                (tenant_id, location_id),
            )
            row = cur.fetchone()

    if row is None:
        return None
    return {
        "tenant_id": row["tenant_id"],
        "location_id": row["location_id"],
        "access_token": row["access_token"],
        "refresh_token": row["refresh_token"],
        "expires_at": row["expires_at"].isoformat() if row["expires_at"] else None,
        "status": row["status"],
        "created_at": row["created_at"].isoformat() if row["created_at"] else None,
        "updated_at": row["updated_at"].isoformat() if row["updated_at"] else None,
    }


def get_brand(tenant_id: str, brand_id: str) -> dict[str, Any] | None:
    with connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                    id,
                    tenant_id,
                    name,
                    ghl_location_id,
                    timezone,
                    default_platforms,
                    status,
                    created_at,
                    updated_at
                FROM brands
                WHERE tenant_id = %s
                  AND id = %s;
                """,
                (tenant_id, brand_id),
            )
            row = cur.fetchone()

    if row is None:
        return None
    return {
        "id": row["id"],
        "tenant_id": row["tenant_id"],
        "name": row["name"],
        "ghl_location_id": row["ghl_location_id"],
        "timezone": row["timezone"],
        "default_platforms": row["default_platforms"] or [],
        "status": row["status"],
        "created_at": row["created_at"].isoformat() if row["created_at"] else None,
        "updated_at": row["updated_at"].isoformat() if row["updated_at"] else None,
    }


def replace_knowledge_source(
    *,
    tenant_id: str,
    source_path: str,
    chunks: list[str],
) -> int:
    with connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                DELETE FROM knowledge_chunks
                WHERE tenant_id = %s AND source_path = %s;
                """,
                (tenant_id, source_path),
            )

            if chunks:
                cur.executemany(
                    """
                    INSERT INTO knowledge_chunks (
                        tenant_id,
                        source_path,
                        chunk_index,
                        content,
                        content_preview,
                        updated_at
                    )
                    VALUES (%s, %s, %s, %s, %s, now());
                    """,
                    [
                        (
                            tenant_id,
                            source_path,
                            idx,
                            chunk,
                            (chunk[:240] if len(chunk) > 240 else chunk),
                        )
                        for idx, chunk in enumerate(chunks)
                    ],
                )
        conn.commit()

    return len(chunks)


def get_content_item_for_publish(tenant_id: str, content_item_id: str) -> dict[str, Any] | None:
    with connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                    ci.id,
                    ci.tenant_id,
                    ci.subaccount_id,
                    ci.brand_id,
                    ci.status,
                    ci.current_version_id,
                    cv.version_number AS current_version_number,
                    cv.content_text AS current_content_text,
                    b.status AS brand_status,
                    b.ghl_location_id AS brand_location_id,
                    b.allowed_publishers AS allowed_publishers,
                    sa.status AS subaccount_status,
                    sa.ghl_location_id AS subaccount_location_id
                FROM content_items ci
                JOIN brands b
                  ON b.id = ci.brand_id
                 AND b.tenant_id = ci.tenant_id
                JOIN subaccounts sa
                  ON sa.id = ci.subaccount_id
                 AND sa.tenant_id = ci.tenant_id
                LEFT JOIN content_versions cv
                  ON cv.id = ci.current_version_id
                WHERE ci.tenant_id = %s
                  AND ci.id = %s;
                """,
                (tenant_id, content_item_id),
            )
            row = cur.fetchone()

    if row is None:
        return None
    return {
        "id": row["id"],
        "tenant_id": row["tenant_id"],
        "subaccount_id": row["subaccount_id"],
        "brand_id": row["brand_id"],
        "status": row["status"],
        "current_version_id": row["current_version_id"],
        "current_version_number": int(row["current_version_number"]) if row["current_version_number"] is not None else None,
        "current_content_text": row["current_content_text"] or "",
        "brand_status": row["brand_status"],
        "brand_location_id": row["brand_location_id"],
        "allowed_publishers": row["allowed_publishers"] or ["ghl.social.publish"],
        "subaccount_status": row["subaccount_status"],
        "subaccount_location_id": row["subaccount_location_id"],
    }


def _serialize_regeneration_job(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": row["id"],
        "tenant_id": row["tenant_id"],
        "content_item_id": row["content_item_id"],
        "base_version_id": row["base_version_id"],
        "requested_by": row["requested_by"],
        "revision_note": row["revision_note"] or "",
        "status": row["status"],
        "attempt_count": int(row["attempt_count"] or 0),
        "next_retry_at": _to_iso(row["next_retry_at"]),
        "result_json": row["result_json"] or {},
        "error": row["error"],
        "processed_at": _to_iso(row["processed_at"]),
        "created_at": _to_iso(row["created_at"]),
        "updated_at": _to_iso(row["updated_at"]),
    }


def claim_regeneration_job(*, job_id: str | None = None, content_item_id: str | None = None) -> dict[str, Any] | None:
    if not job_id and not content_item_id:
        return None

    conditions = [
        "status IN ('queued', 'failed')",
        "(next_retry_at IS NULL OR next_retry_at <= now())",
    ]
    params: list[Any] = []

    normalized_job_id = str(job_id or "").strip()
    if normalized_job_id:
        conditions.append("id = %s")
        params.append(normalized_job_id)

    normalized_item_id = str(content_item_id or "").strip()
    if normalized_item_id:
        conditions.append("content_item_id = %s")
        params.append(normalized_item_id)

    where_clause = " AND ".join(conditions)
    with connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"""
                SELECT id
                FROM ai_regeneration_jobs
                WHERE {where_clause}
                ORDER BY created_at ASC
                FOR UPDATE SKIP LOCKED
                LIMIT 1;
                """,
                tuple(params),
            )
            selected = cur.fetchone()
            if selected is None:
                conn.commit()
                return None

            cur.execute(
                """
                UPDATE ai_regeneration_jobs
                SET
                    status = 'processing',
                    attempt_count = attempt_count + 1,
                    updated_at = now(),
                    error = NULL
                WHERE id = %s
                RETURNING
                    id,
                    tenant_id,
                    content_item_id,
                    base_version_id,
                    requested_by,
                    revision_note,
                    status,
                    attempt_count,
                    next_retry_at,
                    result_json,
                    error,
                    processed_at,
                    created_at,
                    updated_at;
                """,
                (selected["id"],),
            )
            row = cur.fetchone()
        conn.commit()

    if row is None:
        return None
    return _serialize_regeneration_job(row)


def get_content_item_for_regeneration(content_item_id: str) -> dict[str, Any] | None:
    with connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                    ci.id,
                    ci.tenant_id,
                    ci.brand_id,
                    ci.status,
                    ci.current_version_id,
                    b.name AS brand_name,
                    cv.version_number AS current_version_number,
                    cv.content_text AS current_content_text
                FROM content_items ci
                JOIN brands b
                  ON b.id = ci.brand_id
                 AND b.tenant_id = ci.tenant_id
                LEFT JOIN content_versions cv
                  ON cv.id = ci.current_version_id
                WHERE ci.id = %s;
                """,
                (content_item_id,),
            )
            row = cur.fetchone()

    if row is None:
        return None
    return {
        "id": row["id"],
        "tenant_id": row["tenant_id"],
        "brand_id": row["brand_id"],
        "brand_name": row["brand_name"],
        "status": row["status"],
        "current_version_id": row["current_version_id"],
        "current_version_number": int(row["current_version_number"] or 0),
        "current_content_text": row["current_content_text"] or "",
    }


def append_regenerated_version(
    *,
    content_item_id: str,
    generated_by: str,
    revision_note: str,
    source_job_id: str,
) -> dict[str, Any]:
    with connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                    ci.id,
                    ci.current_version_id,
                    b.name AS brand_name,
                    cv.version_number AS current_version_number,
                    cv.content_text AS current_content_text
                FROM content_items ci
                JOIN brands b
                  ON b.id = ci.brand_id
                 AND b.tenant_id = ci.tenant_id
                LEFT JOIN content_versions cv
                  ON cv.id = ci.current_version_id
                WHERE ci.id = %s
                FOR UPDATE;
                """,
                (content_item_id,),
            )
            row = cur.fetchone()
            if row is None:
                conn.commit()
                raise KeyError("content_item_not_found")

            base_version = int(row["current_version_number"] or 0)
            base_text = str(row["current_content_text"] or "").strip()
            brand_name = str(row["brand_name"] or "Brand").strip()

            if not base_text:
                base_text = f"{brand_name} update: practical guidance and clear next steps."
            revision_focus = revision_note.strip() or "Tighten clarity and call-to-action."
            new_text = f"{base_text}\n\nRevision focus: {revision_focus}"

            version_id = str(uuid4())
            version_number = base_version + 1
            cur.execute(
                """
                INSERT INTO content_versions(
                    id,
                    content_item_id,
                    version_number,
                    content_text,
                    metadata_json,
                    generated_by,
                    generation_note
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s);
                """,
                (
                    version_id,
                    content_item_id,
                    version_number,
                    new_text,
                    _to_jsonb({"source": "ai_regeneration_job", "job_id": source_job_id}),
                    generated_by,
                    "regeneration_from_revision_request",
                ),
            )
            cur.execute(
                """
                UPDATE content_items
                SET
                    current_version_id = %s,
                    status = 'ready_for_review',
                    updated_at = now()
                WHERE id = %s;
                """,
                (version_id, content_item_id),
            )
            cur.execute(
                """
                INSERT INTO content_reviews(
                    id,
                    content_item_id,
                    content_version_id,
                    reviewer,
                    action,
                    note,
                    metadata_json
                )
                VALUES (%s, %s, %s, %s, 'ai_regenerated', %s, %s);
                """,
                (
                    str(uuid4()),
                    content_item_id,
                    version_id,
                    generated_by,
                    revision_focus,
                    _to_jsonb({"job_id": source_job_id}),
                ),
            )
        conn.commit()

    return {
        "id": version_id,
        "content_item_id": content_item_id,
        "version_number": version_number,
        "content_text": new_text,
    }


def complete_regeneration_job(job_id: str, *, result_json: dict[str, Any]) -> dict[str, Any]:
    with connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE ai_regeneration_jobs
                SET
                    status = 'completed',
                    processed_at = now(),
                    result_json = %s,
                    error = NULL,
                    next_retry_at = NULL,
                    updated_at = now()
                WHERE id = %s
                RETURNING
                    id,
                    tenant_id,
                    content_item_id,
                    base_version_id,
                    requested_by,
                    revision_note,
                    status,
                    attempt_count,
                    next_retry_at,
                    result_json,
                    error,
                    processed_at,
                    created_at,
                    updated_at;
                """,
                (_to_jsonb(result_json), job_id),
            )
            row = cur.fetchone()
        conn.commit()

    if row is None:
        raise KeyError("regeneration_job_not_found")
    return _serialize_regeneration_job(row)


def fail_regeneration_job(job_id: str, *, error: str, attempt_count: int) -> dict[str, Any]:
    capped_attempt = max(attempt_count, 1)
    retry_delay_minutes = min(2 ** (capped_attempt - 1), 60)
    next_retry_at = datetime.now(timezone.utc) + timedelta(minutes=retry_delay_minutes)

    with connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE ai_regeneration_jobs
                SET
                    status = 'failed',
                    error = %s,
                    next_retry_at = %s,
                    updated_at = now()
                WHERE id = %s
                RETURNING
                    id,
                    tenant_id,
                    content_item_id,
                    base_version_id,
                    requested_by,
                    revision_note,
                    status,
                    attempt_count,
                    next_retry_at,
                    result_json,
                    error,
                    processed_at,
                    created_at,
                    updated_at;
                """,
                (error, next_retry_at, job_id),
            )
            row = cur.fetchone()
        conn.commit()

    if row is None:
        raise KeyError("regeneration_job_not_found")
    return _serialize_regeneration_job(row)
