from __future__ import annotations

import os
import time
from decimal import Decimal
import re
from typing import Any

import psycopg
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb

FAMILYOPS_BRANDS: list[tuple[str, str, str]] = [
    ("fresh-start-group", "Fresh Start Group", "active"),
    ("fresh-start-realty", "Fresh Start Realty", "active"),
    ("fresh-start-renovations", "Fresh Start Renovations", "active"),
    ("fresh-start-team", "Fresh Start Team", "active"),
    ("beteachable", "BeTeachable", "active"),
    ("training-for-leaders", "Training for Leaders", "active"),
    ("valor-behavioral-health", "Valor Behavioral Health", "active"),
    ("corent", "CoRent", "inactive"),
]


def get_dsn() -> str:
    dsn = os.getenv("DATABASE_URL", "").strip()
    if not dsn:
        raise RuntimeError("DATABASE_URL is not set")
    return dsn.replace("postgresql+psycopg://", "postgresql://", 1)


def connect() -> psycopg.Connection:
    dsn = get_dsn()
    last = None
    retries = int(os.getenv("DB_CONNECT_RETRIES", "30"))
    delay = float(os.getenv("DB_CONNECT_DELAY_SEC", "0.5"))
    for _ in range(retries):
        try:
            return psycopg.connect(dsn, row_factory=dict_row)
        except psycopg.OperationalError as e:
            last = e
            time.sleep(delay)
    raise last


def init_db() -> None:
    with connect() as conn:
        conn.autocommit = True
        with conn.cursor() as cur:
            try:
                cur.execute("CREATE EXTENSION IF NOT EXISTS vector;")
            except psycopg.Error:
                # Keep local boot resilient even when pgvector extension init fails.
                pass

    with connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS tenants(
                    id text PRIMARY KEY,
                    name text NOT NULL,
                    status text NOT NULL DEFAULT 'active',
                    created_at timestamptz NOT NULL DEFAULT now()
                );
                """
            )
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS tenant_policies(
                    tenant_id text PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
                    autonomy text NOT NULL DEFAULT 'supervised',
                    tool_allowlist text[] NOT NULL DEFAULT '{}',
                    max_tool_calls_per_run int NOT NULL DEFAULT 8,
                    updated_at timestamptz NOT NULL DEFAULT now()
                );
                """
            )
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS tenant_budgets(
                    tenant_id text PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
                    daily_token_budget int NOT NULL DEFAULT 50000,
                    monthly_dollar_budget numeric NOT NULL DEFAULT 25,
                    updated_at timestamptz NOT NULL DEFAULT now()
                );
                """
            )
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS task_audit_log(
                    id bigserial PRIMARY KEY,
                    task_id text NOT NULL,
                    tenant_id text NOT NULL,
                    user_id text NOT NULL,
                    task_type text NOT NULL,
                    status text NOT NULL,
                    payload jsonb,
                    result jsonb,
                    error text,
                    created_at timestamptz NOT NULL DEFAULT now(),
                    updated_at timestamptz NOT NULL DEFAULT now()
                );
                """
            )
            cur.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_task_audit_tenant_created
                ON task_audit_log (tenant_id, created_at DESC);
                """
            )
            cur.execute(
                """
                CREATE UNIQUE INDEX IF NOT EXISTS idx_task_audit_task_id
                ON task_audit_log (task_id);
                """
            )
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS task_approvals(
                    task_id text PRIMARY KEY,
                    tenant_id text NOT NULL,
                    status text NOT NULL DEFAULT 'pending',
                    approved_by text,
                    approved_at timestamptz,
                    note text,
                    created_at timestamptz NOT NULL DEFAULT now()
                );
                """
            )
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS knowledge_chunks(
                    id bigserial PRIMARY KEY,
                    tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
                    source_path text NOT NULL,
                    chunk_index int NOT NULL,
                    content text NOT NULL,
                    content_preview text NOT NULL,
                    content_tsv tsvector GENERATED ALWAYS AS (to_tsvector('english', content)) STORED,
                    created_at timestamptz NOT NULL DEFAULT now(),
                    updated_at timestamptz NOT NULL DEFAULT now(),
                    UNIQUE (tenant_id, source_path, chunk_index)
                );
                """
            )
            cur.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_tenant_source
                ON knowledge_chunks (tenant_id, source_path, chunk_index);
                """
            )
            cur.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_tsv
                ON knowledge_chunks USING gin (content_tsv);
                """
            )
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS ghl_connections(
                    tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
                    location_id text NOT NULL,
                    access_token text NOT NULL,
                    refresh_token text NOT NULL,
                    expires_at timestamptz NOT NULL,
                    status text NOT NULL DEFAULT 'active',
                    created_at timestamptz NOT NULL DEFAULT now(),
                    updated_at timestamptz NOT NULL DEFAULT now(),
                    PRIMARY KEY (tenant_id, location_id)
                );
                """
            )
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS brands(
                    id text PRIMARY KEY,
                    tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
                    name text NOT NULL,
                    ghl_location_id text NULL,
                    timezone text NOT NULL DEFAULT 'America/New_York',
                    default_platforms text[] NOT NULL DEFAULT '{}',
                    status text NOT NULL DEFAULT 'active',
                    created_at timestamptz NOT NULL DEFAULT now(),
                    updated_at timestamptz NOT NULL DEFAULT now()
                );
                """
            )
            cur.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_brands_tenant
                ON brands (tenant_id, status, updated_at DESC);
                """
            )
        conn.commit()


def seed_defaults() -> None:
    with connect() as conn:
        with conn.cursor() as cur:
            cur.executemany(
                """
                INSERT INTO tenants (id, name, status)
                VALUES (%s, %s, %s)
                ON CONFLICT (id) DO NOTHING;
                """,
                [
                    ("tufflove", "TUFF LOVE", "active"),
                    ("familyops", "Family Ops", "active"),
                    ("corent", "CoRent.AI", "inactive"),
                ],
            )
            cur.executemany(
                """
                INSERT INTO tenant_policies (tenant_id, autonomy, tool_allowlist, max_tool_calls_per_run)
                VALUES (%s, %s, %s, %s)
                ON CONFLICT (tenant_id) DO NOTHING;
                """,
                [
                    ("tufflove", "supervised", ["db.read", "db.write"], 8),
                    ("familyops", "supervised", ["db.read", "db.write", "ghl.read", "ghl.write"], 10),
                    ("corent", "read_only", [], 0),
                ],
            )
            cur.executemany(
                """
                INSERT INTO tenant_budgets (tenant_id, daily_token_budget, monthly_dollar_budget)
                VALUES (%s, %s, %s)
                ON CONFLICT (tenant_id) DO NOTHING;
                """,
                [
                    ("tufflove", 50000, Decimal("25")),
                    ("familyops", 30000, Decimal("15")),
                    ("corent", 10000, Decimal("5")),
                ],
            )
            cur.executemany(
                """
                INSERT INTO brands (id, tenant_id, name, status)
                VALUES (%s, %s, %s, %s)
                ON CONFLICT (id) DO NOTHING;
                """,
                [(brand_id, "familyops", name, status) for brand_id, name, status in FAMILYOPS_BRANDS],
            )
        conn.commit()


def list_tenants() -> list[dict[str, Any]]:
    with connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, name, status, created_at
                FROM tenants
                ORDER BY id;
                """
            )
            rows = cur.fetchall()

    return [
        {
            "id": row["id"],
            "name": row["name"],
            "status": row["status"],
            "created_at": row["created_at"].isoformat() if row["created_at"] else None,
        }
        for row in rows
    ]


def get_tenant_policy_bundle(tenant_id: str) -> dict[str, Any] | None:
    with connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                    t.id AS tenant_id,
                    t.name,
                    t.status,
                    p.autonomy,
                    p.tool_allowlist,
                    p.max_tool_calls_per_run,
                    p.updated_at AS policy_updated_at,
                    b.daily_token_budget,
                    b.monthly_dollar_budget,
                    b.updated_at AS budget_updated_at
                FROM tenants t
                LEFT JOIN tenant_policies p ON p.tenant_id = t.id
                LEFT JOIN tenant_budgets b ON b.tenant_id = t.id
                WHERE t.id = %s;
                """,
                (tenant_id,),
            )
            row = cur.fetchone()

    if row is None:
        return None

    monthly_budget = row["monthly_dollar_budget"]
    if isinstance(monthly_budget, Decimal):
        monthly_budget = float(monthly_budget)

    return {
        "tenant_id": row["tenant_id"],
        "name": row["name"],
        "status": row["status"],
        "autonomy": row["autonomy"] or "supervised",
        "tool_allowlist": row["tool_allowlist"] or [],
        "max_tool_calls_per_run": int(row["max_tool_calls_per_run"] or 8),
        "daily_token_budget": int(row["daily_token_budget"] or 50000),
        "monthly_dollar_budget": float(monthly_budget if monthly_budget is not None else 25),
        "policy_updated_at": row["policy_updated_at"].isoformat() if row["policy_updated_at"] else None,
        "budget_updated_at": row["budget_updated_at"].isoformat() if row["budget_updated_at"] else None,
    }


def update_tenant_policy(
    *,
    tenant_id: str,
    autonomy: str,
    tool_allowlist: list[str],
    max_tool_calls_per_run: int,
    daily_token_budget: int,
    monthly_dollar_budget: float,
) -> dict[str, Any]:
    with connect() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT 1 FROM tenants WHERE id = %s;", (tenant_id,))
            if cur.fetchone() is None:
                raise KeyError(f"Tenant not found: {tenant_id}")

            cur.execute(
                """
                INSERT INTO tenant_policies (tenant_id, autonomy, tool_allowlist, max_tool_calls_per_run, updated_at)
                VALUES (%s, %s, %s, %s, now())
                ON CONFLICT (tenant_id) DO UPDATE SET
                    autonomy = EXCLUDED.autonomy,
                    tool_allowlist = EXCLUDED.tool_allowlist,
                    max_tool_calls_per_run = EXCLUDED.max_tool_calls_per_run,
                    updated_at = now();
                """,
                (tenant_id, autonomy, tool_allowlist, max_tool_calls_per_run),
            )
            cur.execute(
                """
                INSERT INTO tenant_budgets (tenant_id, daily_token_budget, monthly_dollar_budget, updated_at)
                VALUES (%s, %s, %s, now())
                ON CONFLICT (tenant_id) DO UPDATE SET
                    daily_token_budget = EXCLUDED.daily_token_budget,
                    monthly_dollar_budget = EXCLUDED.monthly_dollar_budget,
                    updated_at = now();
                """,
                (tenant_id, daily_token_budget, monthly_dollar_budget),
            )
        conn.commit()

    updated = get_tenant_policy_bundle(tenant_id)
    if updated is None:
        raise KeyError(f"Tenant not found: {tenant_id}")
    return updated


def _to_jsonb(value: Any) -> Jsonb | None:
    if value is None:
        return None
    return Jsonb(value)


def _to_iso(value: Any) -> str | None:
    return value.isoformat() if value is not None else None


def upsert_task_log(
    task_id: str,
    tenant_id: str,
    user_id: str,
    task_type: str,
    status: str,
    payload: dict[str, Any] | None = None,
    result: dict[str, Any] | None = None,
    error: str | None = None,
) -> dict[str, Any]:
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
                    updated_at = now()
                RETURNING
                    task_id,
                    tenant_id,
                    user_id,
                    task_type,
                    status,
                    payload,
                    result,
                    error,
                    created_at,
                    updated_at;
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
            row = cur.fetchone()
        conn.commit()

    if row is None:
        raise RuntimeError("Failed to upsert task log")
    return {
        "task_id": row["task_id"],
        "tenant_id": row["tenant_id"],
        "user_id": row["user_id"],
        "task_type": row["task_type"],
        "status": row["status"],
        "payload": row["payload"],
        "result": row["result"],
        "error": row["error"],
        "created_at": _to_iso(row["created_at"]),
        "updated_at": _to_iso(row["updated_at"]),
    }


def get_task_log(task_id: str) -> dict[str, Any] | None:
    with connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                    task_id,
                    tenant_id,
                    user_id,
                    task_type,
                    status,
                    payload,
                    result,
                    error,
                    created_at,
                    updated_at
                FROM task_audit_log
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
        "user_id": row["user_id"],
        "task_type": row["task_type"],
        "status": row["status"],
        "payload": row["payload"],
        "result": row["result"],
        "error": row["error"],
        "created_at": _to_iso(row["created_at"]),
        "updated_at": _to_iso(row["updated_at"]),
    }


def list_task_logs(tenant_id: str, limit: int = 50) -> list[dict[str, Any]]:
    safe_limit = min(max(limit, 1), 500)
    with connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                    task_id,
                    tenant_id,
                    user_id,
                    task_type,
                    status,
                    payload,
                    result,
                    error,
                    created_at,
                    updated_at
                FROM task_audit_log
                WHERE tenant_id = %s
                ORDER BY created_at DESC
                LIMIT %s;
                """,
                (tenant_id, safe_limit),
            )
            rows = cur.fetchall()

    return [
        {
            "task_id": row["task_id"],
            "tenant_id": row["tenant_id"],
            "user_id": row["user_id"],
            "task_type": row["task_type"],
            "status": row["status"],
            "payload": row["payload"],
            "result": row["result"],
            "error": row["error"],
            "created_at": _to_iso(row["created_at"]),
            "updated_at": _to_iso(row["updated_at"]),
        }
        for row in rows
    ]


def create_approval(task_id: str, tenant_id: str) -> dict[str, Any]:
    with connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO task_approvals (task_id, tenant_id, status)
                VALUES (%s, %s, 'pending')
                ON CONFLICT (task_id) DO NOTHING;
                """,
                (task_id, tenant_id),
            )
        conn.commit()

    approval = get_approval(task_id)
    if approval is None:
        raise RuntimeError("Failed to create approval")
    return approval


def set_approval(
    task_id: str,
    tenant_id: str,
    status: str,
    approved_by: str,
    note: str | None = None,
) -> dict[str, Any]:
    if status not in {"approved", "rejected"}:
        raise ValueError("status must be approved or rejected")

    with connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO task_approvals (
                    task_id,
                    tenant_id,
                    status,
                    approved_by,
                    approved_at,
                    note
                )
                VALUES (
                    %s,
                    %s,
                    %s,
                    %s,
                    CASE WHEN %s = 'approved' THEN now() ELSE NULL END,
                    %s
                )
                ON CONFLICT (task_id) DO UPDATE SET
                    tenant_id = EXCLUDED.tenant_id,
                    status = EXCLUDED.status,
                    approved_by = EXCLUDED.approved_by,
                    approved_at = EXCLUDED.approved_at,
                    note = EXCLUDED.note;
                """,
                (task_id, tenant_id, status, approved_by, status, note),
            )
        conn.commit()

    approval = get_approval(task_id)
    if approval is None:
        raise RuntimeError("Failed to update approval")
    return approval


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
        "approved_at": _to_iso(row["approved_at"]),
        "note": row["note"],
        "created_at": _to_iso(row["created_at"]),
    }


def search_knowledge_chunks(tenant_id: str, query: str, limit: int = 5) -> list[dict[str, Any]]:
    if not query.strip():
        return []

    safe_limit = min(max(limit, 1), 20)
    with connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                    source_path,
                    chunk_index,
                    content_preview,
                    ts_rank(content_tsv, plainto_tsquery('english', %s)) AS rank
                FROM knowledge_chunks
                WHERE tenant_id = %s
                  AND content_tsv @@ plainto_tsquery('english', %s)
                ORDER BY rank DESC, updated_at DESC
                LIMIT %s;
                """,
                (query, tenant_id, query, safe_limit),
            )
            rows = cur.fetchall()

            if not rows:
                cur.execute(
                    """
                    SELECT
                        source_path,
                        chunk_index,
                        content_preview,
                        updated_at
                    FROM knowledge_chunks
                    WHERE tenant_id = %s
                    ORDER BY updated_at DESC
                    LIMIT 500;
                    """,
                    (tenant_id,),
                )
                candidates = cur.fetchall()
                terms = [
                    term
                    for term in re.findall(r"[a-z0-9]{3,}", query.lower())
                    if term not in {"what", "have", "from", "with", "that", "this", "about"}
                ]

                scored: list[dict[str, Any]] = []
                for candidate in candidates:
                    haystack = f"{candidate['source_path']} {candidate['content_preview']}".lower()
                    score = sum(1 for term in terms if term in haystack)
                    if score > 0:
                        scored.append(
                            {
                                "source_path": candidate["source_path"],
                                "chunk_index": int(candidate["chunk_index"]),
                                "content_preview": candidate["content_preview"],
                                "rank": float(score),
                            }
                        )

                if scored:
                    scored.sort(key=lambda row: row["rank"], reverse=True)
                    return scored[:safe_limit]

                rows = [
                    {
                        "source_path": candidate["source_path"],
                        "chunk_index": int(candidate["chunk_index"]),
                        "content_preview": candidate["content_preview"],
                        "rank": 0.0,
                    }
                    for candidate in candidates[: min(3, safe_limit)]
                ]
                return rows

    return [
        {
            "source_path": row["source_path"] if isinstance(row, dict) else row["source_path"],
            "chunk_index": int(row["chunk_index"] if isinstance(row, dict) else row["chunk_index"]),
            "content_preview": row["content_preview"] if isinstance(row, dict) else row["content_preview"],
            "rank": float((row.get("rank") if isinstance(row, dict) else row["rank"]) or 0),
        }
        for row in rows
    ]


def upsert_ghl_connection(
    *,
    tenant_id: str,
    location_id: str,
    access_token: str,
    refresh_token: str,
    expires_at: Any,
    status: str = "active",
) -> dict[str, Any]:
    with connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO ghl_connections (
                    tenant_id,
                    location_id,
                    access_token,
                    refresh_token,
                    expires_at,
                    status,
                    updated_at
                )
                VALUES (%s, %s, %s, %s, %s, %s, now())
                ON CONFLICT (tenant_id, location_id) DO UPDATE SET
                    access_token = EXCLUDED.access_token,
                    refresh_token = EXCLUDED.refresh_token,
                    expires_at = EXCLUDED.expires_at,
                    status = EXCLUDED.status,
                    updated_at = now()
                RETURNING
                    tenant_id,
                    location_id,
                    status,
                    expires_at,
                    created_at,
                    updated_at;
                """,
                (tenant_id, location_id, access_token, refresh_token, expires_at, status),
            )
            row = cur.fetchone()
        conn.commit()

    if row is None:
        raise RuntimeError("Failed to upsert GHL connection")
    return {
        "tenant_id": row["tenant_id"],
        "location_id": row["location_id"],
        "status": row["status"],
        "expires_at": _to_iso(row["expires_at"]),
        "created_at": _to_iso(row["created_at"]),
        "updated_at": _to_iso(row["updated_at"]),
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
        "expires_at": _to_iso(row["expires_at"]),
        "status": row["status"],
        "created_at": _to_iso(row["created_at"]),
        "updated_at": _to_iso(row["updated_at"]),
    }


def list_ghl_connections(tenant_id: str) -> list[dict[str, Any]]:
    with connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                    tenant_id,
                    location_id,
                    expires_at,
                    status,
                    created_at,
                    updated_at
                FROM ghl_connections
                WHERE tenant_id = %s
                ORDER BY updated_at DESC;
                """,
                (tenant_id,),
            )
            rows = cur.fetchall()

    return [
        {
            "tenant_id": row["tenant_id"],
            "location_id": row["location_id"],
            "expires_at": _to_iso(row["expires_at"]),
            "status": row["status"],
            "created_at": _to_iso(row["created_at"]),
            "updated_at": _to_iso(row["updated_at"]),
        }
        for row in rows
    ]


def list_brands(tenant_id: str) -> list[dict[str, Any]]:
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
                ORDER BY id;
                """,
                (tenant_id,),
            )
            rows = cur.fetchall()

    return [
        {
            "id": row["id"],
            "tenant_id": row["tenant_id"],
            "name": row["name"],
            "ghl_location_id": row["ghl_location_id"],
            "timezone": row["timezone"],
            "default_platforms": row["default_platforms"] or [],
            "status": row["status"],
            "created_at": _to_iso(row["created_at"]),
            "updated_at": _to_iso(row["updated_at"]),
        }
        for row in rows
    ]


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
        "created_at": _to_iso(row["created_at"]),
        "updated_at": _to_iso(row["updated_at"]),
    }


def update_brand_location(
    *,
    tenant_id: str,
    brand_id: str,
    ghl_location_id: str | None,
    timezone: str,
    default_platforms: list[str],
    status: str,
) -> dict[str, Any]:
    with connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE brands
                SET ghl_location_id = %s,
                    timezone = %s,
                    default_platforms = %s,
                    status = %s,
                    updated_at = now()
                WHERE tenant_id = %s
                  AND id = %s
                RETURNING
                    id,
                    tenant_id,
                    name,
                    ghl_location_id,
                    timezone,
                    default_platforms,
                    status,
                    created_at,
                    updated_at;
                """,
                (ghl_location_id, timezone, default_platforms, status, tenant_id, brand_id),
            )
            row = cur.fetchone()
        conn.commit()

    if row is None:
        raise KeyError(f"Brand not found: {tenant_id}/{brand_id}")
    return {
        "id": row["id"],
        "tenant_id": row["tenant_id"],
        "name": row["name"],
        "ghl_location_id": row["ghl_location_id"],
        "timezone": row["timezone"],
        "default_platforms": row["default_platforms"] or [],
        "status": row["status"],
        "created_at": _to_iso(row["created_at"]),
        "updated_at": _to_iso(row["updated_at"]),
    }
