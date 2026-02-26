from __future__ import annotations

import os
import time
from typing import Any

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
