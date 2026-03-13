from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from psycopg.types.json import Jsonb

from app.db import connect

CONTENT_ITEM_STATUSES = {
    "draft",
    "ready_for_review",
    "approved",
    "rejected",
    "revision_requested",
    "scheduled",
    "regenerating",
}
CONTENT_REVIEW_ACTIONS = {
    "created",
    "approved",
    "rejected",
    "revision_requested",
    "ai_regenerated",
}
REGEN_JOB_STATUSES = {"queued", "processing", "completed", "failed"}

FAMILYOPS_BRAND_PROFILE_SEEDS: list[dict[str, Any]] = [
    {
        "brand_id": "fresh-start-group",
        "brand_name": "Fresh Start Group",
        "subaccount_id": "sa-fresh-start-group",
        "subaccount_name": "Fresh Start Group Subaccount",
        "subaccount_status": "active",
        "voice_summary": "Confident, plainspoken, and action-first. Teach the audience what to do next in clear steps.",
        "target_avatar_summary": "Homeowners and families needing practical options for sale, transition, and fast decisions.",
    },
    {
        "brand_id": "fresh-start-realty",
        "brand_name": "Fresh Start Realty",
        "subaccount_id": "sa-fresh-start-realty",
        "subaccount_name": "Fresh Start Realty Subaccount",
        "subaccount_status": "active",
        "voice_summary": "Trust-building advisor tone. Explain market choices without hype and with direct next-step guidance.",
        "target_avatar_summary": "Buyers and sellers wanting a disciplined real estate guide with local clarity and speed.",
    },
    {
        "brand_id": "fresh-start-renovations",
        "brand_name": "Fresh Start Renovations",
        "subaccount_id": "sa-fresh-start-renovations",
        "subaccount_name": "Fresh Start Renovations Subaccount",
        "subaccount_status": "active",
        "voice_summary": "Hands-on builder voice. Outcome-focused, practical, and specific about timelines, scope, and tradeoffs.",
        "target_avatar_summary": "Property owners and investors who need reliable renovation execution and budget clarity.",
    },
    {
        "brand_id": "fresh-start-team",
        "brand_name": "Fresh Start Team",
        "subaccount_id": "sa-fresh-start-team",
        "subaccount_name": "Fresh Start Team Subaccount",
        "subaccount_status": "active",
        "voice_summary": "Community-centered and accountable. Celebrate wins but stay grounded in execution and service.",
        "target_avatar_summary": "Local clients and partners looking for a coordinated team that communicates clearly and follows through.",
    },
    {
        "brand_id": "beteachable",
        "brand_name": "BeTeachable",
        "subaccount_id": "sa-beteachable",
        "subaccount_name": "BeTeachable Subaccount",
        "subaccount_status": "active",
        "voice_summary": "TUFF LOVE coaching voice: direct, structured, and practical with no fluff.",
        "target_avatar_summary": "Entrepreneurs and operators who want disciplined growth systems and real-world execution support.",
    },
    {
        "brand_id": "training-for-leaders",
        "brand_name": "Training for Leaders",
        "subaccount_id": "sa-training-for-leaders",
        "subaccount_name": "Training for Leaders Subaccount",
        "subaccount_status": "active",
        "voice_summary": "Leadership training tone that is respectful, field-tested, and immediately actionable.",
        "target_avatar_summary": "Managers and team leaders who need practical frameworks for accountability and team performance.",
    },
    {
        "brand_id": "valor-behavioral-health",
        "brand_name": "Valor Behavioral Health",
        "subaccount_id": "sa-valor-behavioral-health",
        "subaccount_name": "Valor Behavioral Health Subaccount",
        "subaccount_status": "active",
        "voice_summary": "Calm, compassionate, and privacy-conscious voice. Emphasize safety, clarity, and trust.",
        "target_avatar_summary": "Individuals and families seeking behavioral health support with dignity, structure, and hope.",
    },
    {
        "brand_id": "corent",
        "brand_name": "CoRent",
        "subaccount_id": "sa-corent",
        "subaccount_name": "CoRent Subaccount",
        "subaccount_status": "inactive",
        "voice_summary": "Reserved profile while inactive. Do not activate automated publishing workflows.",
        "target_avatar_summary": "Inactive profile in this sprint; maintained only for mapping and governance continuity.",
    },
]


def _to_jsonb(value: Any) -> Jsonb | None:
    if value is None:
        return None
    return Jsonb(value)


def _to_iso(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc).isoformat()
        return value.astimezone(timezone.utc).isoformat()
    return str(value)


def _normalize_status(raw: str, allowed: set[str], fallback: str) -> str:
    candidate = str(raw or "").strip().lower()
    if candidate not in allowed:
        return fallback
    return candidate


def init_brand_approval_tables() -> None:
    with connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS subaccounts(
                    id text PRIMARY KEY,
                    tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
                    name text NOT NULL,
                    ghl_location_id text,
                    status text NOT NULL DEFAULT 'active',
                    timezone text NOT NULL DEFAULT 'America/New_York',
                    created_at timestamptz NOT NULL DEFAULT now(),
                    updated_at timestamptz NOT NULL DEFAULT now()
                );
                """
            )
            cur.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_subaccounts_tenant_status
                ON subaccounts (tenant_id, status, updated_at DESC);
                """
            )

            cur.execute("ALTER TABLE brands ADD COLUMN IF NOT EXISTS subaccount_id text;")
            cur.execute("ALTER TABLE brands ADD COLUMN IF NOT EXISTS voice_summary text NOT NULL DEFAULT '';")
            cur.execute("ALTER TABLE brands ADD COLUMN IF NOT EXISTS target_avatar_summary text NOT NULL DEFAULT '';")
            cur.execute(
                """
                ALTER TABLE brands
                ADD COLUMN IF NOT EXISTS allowed_publishers text[] NOT NULL DEFAULT ARRAY['ghl.social.publish'];
                """
            )
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS content_items(
                    id text PRIMARY KEY,
                    tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
                    subaccount_id text NOT NULL REFERENCES subaccounts(id) ON DELETE RESTRICT,
                    brand_id text NOT NULL REFERENCES brands(id) ON DELETE RESTRICT,
                    platform text NOT NULL DEFAULT 'fb',
                    status text NOT NULL DEFAULT 'ready_for_review',
                    title text NOT NULL DEFAULT '',
                    source_task_id text,
                    current_version_id text,
                    created_by text NOT NULL DEFAULT 'ai-system',
                    scheduled_at timestamptz,
                    created_at timestamptz NOT NULL DEFAULT now(),
                    updated_at timestamptz NOT NULL DEFAULT now()
                );
                """
            )
            cur.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_content_items_tenant_review
                ON content_items (tenant_id, subaccount_id, brand_id, status, updated_at DESC);
                """
            )
            cur.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_content_items_source_task
                ON content_items (source_task_id)
                WHERE source_task_id IS NOT NULL;
                """
            )

            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS content_versions(
                    id text PRIMARY KEY,
                    content_item_id text NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
                    version_number int NOT NULL,
                    content_text text NOT NULL DEFAULT '',
                    metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
                    generated_by text NOT NULL DEFAULT 'ai-system',
                    generation_note text NOT NULL DEFAULT '',
                    created_at timestamptz NOT NULL DEFAULT now(),
                    UNIQUE(content_item_id, version_number)
                );
                """
            )
            cur.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_content_versions_item_created
                ON content_versions (content_item_id, created_at DESC);
                """
            )

            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS content_reviews(
                    id text PRIMARY KEY,
                    content_item_id text NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
                    content_version_id text REFERENCES content_versions(id) ON DELETE SET NULL,
                    reviewer text NOT NULL,
                    action text NOT NULL,
                    note text,
                    metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
                    created_at timestamptz NOT NULL DEFAULT now()
                );
                """
            )
            cur.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_content_reviews_item_created
                ON content_reviews (content_item_id, created_at DESC);
                """
            )

            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS ai_regeneration_jobs(
                    id text PRIMARY KEY,
                    tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
                    content_item_id text NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
                    base_version_id text REFERENCES content_versions(id) ON DELETE SET NULL,
                    requested_by text NOT NULL,
                    revision_note text NOT NULL DEFAULT '',
                    status text NOT NULL DEFAULT 'queued',
                    attempt_count int NOT NULL DEFAULT 0,
                    next_retry_at timestamptz,
                    result_json jsonb NOT NULL DEFAULT '{}'::jsonb,
                    error text,
                    processed_at timestamptz,
                    created_at timestamptz NOT NULL DEFAULT now(),
                    updated_at timestamptz NOT NULL DEFAULT now()
                );
                """
            )
            cur.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_ai_regen_status_due
                ON ai_regeneration_jobs (status, next_retry_at, created_at DESC);
                """
            )
            cur.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_ai_regen_item_created
                ON ai_regeneration_jobs (content_item_id, created_at DESC);
                """
            )

        conn.commit()

    seed_brand_approval_defaults("familyops")


def seed_brand_approval_defaults(tenant_id: str) -> None:
    with connect() as conn:
        with conn.cursor() as cur:
            for seed in FAMILYOPS_BRAND_PROFILE_SEEDS:
                cur.execute(
                    """
                    INSERT INTO subaccounts(
                        id,
                        tenant_id,
                        name,
                        status,
                        timezone,
                        updated_at
                    )
                    VALUES (%s, %s, %s, %s, 'America/New_York', now())
                    ON CONFLICT (id) DO UPDATE SET
                        name = EXCLUDED.name,
                        status = EXCLUDED.status,
                        updated_at = now();
                    """,
                    (
                        seed["subaccount_id"],
                        tenant_id,
                        seed["subaccount_name"],
                        seed["subaccount_status"],
                    ),
                )
                cur.execute(
                    """
                    UPDATE brands
                    SET
                        subaccount_id = %s,
                        voice_summary = CASE WHEN btrim(voice_summary) = '' THEN %s ELSE voice_summary END,
                        target_avatar_summary = CASE WHEN btrim(target_avatar_summary) = '' THEN %s ELSE target_avatar_summary END,
                        allowed_publishers = CASE
                            WHEN allowed_publishers IS NULL OR array_length(allowed_publishers, 1) IS NULL
                                THEN ARRAY['ghl.social.publish']
                            ELSE allowed_publishers
                        END,
                        status = CASE WHEN id = 'corent' THEN 'inactive' ELSE status END,
                        updated_at = now()
                    WHERE tenant_id = %s
                      AND id = %s;
                    """,
                    (
                        seed["subaccount_id"],
                        seed["voice_summary"],
                        seed["target_avatar_summary"],
                        tenant_id,
                        seed["brand_id"],
                    ),
                )
        conn.commit()


def list_subaccounts(tenant_id: str) -> list[dict[str, Any]]:
    with connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, tenant_id, name, ghl_location_id, status, timezone, created_at, updated_at
                FROM subaccounts
                WHERE tenant_id = %s
                ORDER BY name;
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
            "status": row["status"],
            "timezone": row["timezone"],
            "created_at": _to_iso(row["created_at"]),
            "updated_at": _to_iso(row["updated_at"]),
        }
        for row in rows
    ]


def list_brands_with_subaccounts(tenant_id: str) -> list[dict[str, Any]]:
    with connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                    b.id,
                    b.tenant_id,
                    b.name,
                    b.subaccount_id,
                    b.ghl_location_id,
                    b.timezone,
                    b.default_platforms,
                    b.status,
                    b.voice_summary,
                    b.target_avatar_summary,
                    b.allowed_publishers,
                    b.created_at,
                    b.updated_at,
                    sa.name AS subaccount_name,
                    sa.status AS subaccount_status
                FROM brands b
                LEFT JOIN subaccounts sa
                  ON sa.id = b.subaccount_id
                 AND sa.tenant_id = b.tenant_id
                WHERE b.tenant_id = %s
                ORDER BY b.name;
                """,
                (tenant_id,),
            )
            rows = cur.fetchall()
    return [
        {
            "id": row["id"],
            "tenant_id": row["tenant_id"],
            "name": row["name"],
            "subaccount_id": row["subaccount_id"],
            "subaccount_name": row["subaccount_name"],
            "subaccount_status": row["subaccount_status"],
            "ghl_location_id": row["ghl_location_id"],
            "timezone": row["timezone"],
            "default_platforms": row["default_platforms"] or [],
            "status": row["status"],
            "voice_summary": row["voice_summary"] or "",
            "target_avatar_summary": row["target_avatar_summary"] or "",
            "allowed_publishers": row["allowed_publishers"] or ["ghl.social.publish"],
            "created_at": _to_iso(row["created_at"]),
            "updated_at": _to_iso(row["updated_at"]),
        }
        for row in rows
    ]


def _serialize_content_item_row(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": row["id"],
        "tenant_id": row["tenant_id"],
        "subaccount_id": row["subaccount_id"],
        "subaccount_name": row["subaccount_name"],
        "subaccount_status": row["subaccount_status"],
        "subaccount_location_id": row["subaccount_location_id"],
        "brand_id": row["brand_id"],
        "brand_name": row["brand_name"],
        "brand_status": row["brand_status"],
        "brand_allowed_publishers": row["brand_allowed_publishers"] or ["ghl.social.publish"],
        "platform": row["platform"],
        "status": row["status"],
        "title": row["title"],
        "source_task_id": row["source_task_id"],
        "current_version_id": row["current_version_id"],
        "current_version_number": int(row["current_version_number"] or 0) if row["current_version_number"] is not None else None,
        "current_content_text": row["current_content_text"] or "",
        "current_content_preview": (row["current_content_text"] or "")[:240],
        "scheduled_at": _to_iso(row["scheduled_at"]),
        "last_review_action": row["last_review_action"],
        "last_reviewer": row["last_reviewer"],
        "last_reviewed_at": _to_iso(row["last_reviewed_at"]),
        "created_at": _to_iso(row["created_at"]),
        "updated_at": _to_iso(row["updated_at"]),
    }


def _normalize_platform(payload: dict[str, Any]) -> str:
    platforms = payload.get("platforms")
    if isinstance(platforms, list):
        for item in platforms:
            if isinstance(item, str) and item.strip():
                return item.strip().lower()
    platform = payload.get("platform")
    if isinstance(platform, str) and platform.strip():
        return platform.strip().lower()
    return "fb"


def _normalize_content_text(payload: dict[str, Any], brand_name: str) -> tuple[str, str]:
    content = str(payload.get("content") or payload.get("message") or payload.get("topic") or "").strip()
    if not content:
        content = f"{brand_name} update: practical next step and clear call to action."
    topic = str(payload.get("topic") or "").strip()
    title = topic if topic else content[:80]
    return content, title


def create_content_item_for_publish_task(
    *,
    tenant_id: str,
    user_id: str,
    source_task_id: str,
    payload: dict[str, Any],
) -> dict[str, Any]:
    brand_id = str(payload.get("brand_id") or "").strip()
    if not brand_id:
        raise ValueError("brand_id is required to create a content item")

    with connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                    id,
                    tenant_id,
                    name,
                    subaccount_id,
                    status
                FROM brands
                WHERE tenant_id = %s
                  AND id = %s;
                """,
                (tenant_id, brand_id),
            )
            brand = cur.fetchone()
            if brand is None:
                raise KeyError(f"Brand not found: {tenant_id}/{brand_id}")

            subaccount_id = str(brand.get("subaccount_id") or "").strip()
            if not subaccount_id:
                raise ValueError(f"Brand is missing subaccount mapping: {brand_id}")

            content_text, title = _normalize_content_text(payload, brand["name"])
            platform = _normalize_platform(payload)
            content_item_id = str(uuid4())
            version_id = str(uuid4())

            cur.execute(
                """
                INSERT INTO content_items(
                    id,
                    tenant_id,
                    subaccount_id,
                    brand_id,
                    platform,
                    status,
                    title,
                    source_task_id,
                    created_by
                )
                VALUES (%s, %s, %s, %s, %s, 'ready_for_review', %s, %s, %s);
                """,
                (
                    content_item_id,
                    tenant_id,
                    subaccount_id,
                    brand_id,
                    platform,
                    title,
                    source_task_id,
                    user_id,
                ),
            )
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
                VALUES (%s, %s, 1, %s, %s, %s, %s);
                """,
                (
                    version_id,
                    content_item_id,
                    content_text,
                    _to_jsonb({"source": "task_enqueue", "source_task_id": source_task_id}),
                    "ai-system",
                    "initial_version_from_enqueue",
                ),
            )
            cur.execute(
                """
                UPDATE content_items
                SET current_version_id = %s,
                    updated_at = now()
                WHERE id = %s;
                """,
                (version_id, content_item_id),
            )
            review_id = str(uuid4())
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
                VALUES (%s, %s, %s, %s, 'created', %s, %s);
                """,
                (
                    review_id,
                    content_item_id,
                    version_id,
                    "ai-system",
                    "Initial AI content generated for review",
                    _to_jsonb({"source_task_id": source_task_id}),
                ),
            )
        conn.commit()

    item = get_approval_item(content_item_id)
    if item is None:
        raise RuntimeError("Failed to create content item for publish task")
    return item


def list_approval_items(
    *,
    tenant_id: str,
    subaccount_id: str | None = None,
    brand_id: str | None = None,
    platform: str | None = None,
    status: str | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    search: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> dict[str, Any]:
    safe_limit = min(max(int(limit), 1), 200)
    safe_offset = max(int(offset), 0)
    conditions = ["ci.tenant_id = %s"]
    params: list[Any] = [tenant_id]

    normalized_subaccount = str(subaccount_id or "").strip()
    if normalized_subaccount:
        conditions.append("ci.subaccount_id = %s")
        params.append(normalized_subaccount)

    normalized_brand = str(brand_id or "").strip()
    if normalized_brand:
        conditions.append("ci.brand_id = %s")
        params.append(normalized_brand)

    normalized_platform = str(platform or "").strip().lower()
    if normalized_platform:
        conditions.append("ci.platform = %s")
        params.append(normalized_platform)

    normalized_status = str(status or "").strip().lower()
    if normalized_status:
        conditions.append("ci.status = %s")
        params.append(_normalize_status(normalized_status, CONTENT_ITEM_STATUSES, "ready_for_review"))

    if date_from is not None:
        conditions.append("ci.created_at >= %s")
        params.append(date_from)
    if date_to is not None:
        conditions.append("ci.created_at <= %s")
        params.append(date_to)

    normalized_search = str(search or "").strip()
    if normalized_search:
        search_like = f"%{normalized_search}%"
        conditions.append("(ci.title ILIKE %s OR cv.content_text ILIKE %s OR b.name ILIKE %s OR sa.name ILIKE %s)")
        params.extend([search_like, search_like, search_like, search_like])

    where_clause = " AND ".join(conditions)

    with connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"""
                SELECT COUNT(*)::int AS total
                FROM content_items ci
                JOIN brands b
                  ON b.id = ci.brand_id
                 AND b.tenant_id = ci.tenant_id
                JOIN subaccounts sa
                  ON sa.id = ci.subaccount_id
                 AND sa.tenant_id = ci.tenant_id
                LEFT JOIN content_versions cv
                  ON cv.id = ci.current_version_id
                WHERE {where_clause};
                """,
                tuple(params),
            )
            total = int((cur.fetchone() or {}).get("total") or 0)

            query_params = [*params, safe_limit, safe_offset]
            cur.execute(
                f"""
                SELECT
                    ci.id,
                    ci.tenant_id,
                    ci.subaccount_id,
                    sa.name AS subaccount_name,
                    sa.status AS subaccount_status,
                    sa.ghl_location_id AS subaccount_location_id,
                    ci.brand_id,
                    b.name AS brand_name,
                    b.status AS brand_status,
                    b.allowed_publishers AS brand_allowed_publishers,
                    ci.platform,
                    ci.status,
                    ci.title,
                    ci.source_task_id,
                    ci.current_version_id,
                    cv.version_number AS current_version_number,
                    cv.content_text AS current_content_text,
                    ci.scheduled_at,
                    ci.created_at,
                    ci.updated_at,
                    lr.action AS last_review_action,
                    lr.reviewer AS last_reviewer,
                    lr.created_at AS last_reviewed_at
                FROM content_items ci
                JOIN brands b
                  ON b.id = ci.brand_id
                 AND b.tenant_id = ci.tenant_id
                JOIN subaccounts sa
                  ON sa.id = ci.subaccount_id
                 AND sa.tenant_id = ci.tenant_id
                LEFT JOIN content_versions cv
                  ON cv.id = ci.current_version_id
                LEFT JOIN LATERAL (
                    SELECT action, reviewer, created_at
                    FROM content_reviews cr
                    WHERE cr.content_item_id = ci.id
                    ORDER BY cr.created_at DESC
                    LIMIT 1
                ) lr ON TRUE
                WHERE {where_clause}
                ORDER BY ci.updated_at DESC
                LIMIT %s
                OFFSET %s;
                """,
                tuple(query_params),
            )
            rows = cur.fetchall()

    return {
        "tenant_id": tenant_id,
        "items": [_serialize_content_item_row(row) for row in rows],
        "total": total,
        "limit": safe_limit,
        "offset": safe_offset,
    }


def _serialize_content_version(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": row["id"],
        "content_item_id": row["content_item_id"],
        "version_number": int(row["version_number"]),
        "content_text": row["content_text"] or "",
        "metadata_json": row["metadata_json"] or {},
        "generated_by": row["generated_by"],
        "generation_note": row["generation_note"] or "",
        "created_at": _to_iso(row["created_at"]),
    }


def _serialize_content_review(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": row["id"],
        "content_item_id": row["content_item_id"],
        "content_version_id": row["content_version_id"],
        "reviewer": row["reviewer"],
        "action": row["action"],
        "note": row["note"],
        "metadata_json": row["metadata_json"] or {},
        "created_at": _to_iso(row["created_at"]),
    }


def _serialize_regen_job(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": row["id"],
        "tenant_id": row["tenant_id"],
        "content_item_id": row["content_item_id"],
        "base_version_id": row["base_version_id"],
        "requested_by": row["requested_by"],
        "revision_note": row["revision_note"],
        "status": row["status"],
        "attempt_count": int(row["attempt_count"] or 0),
        "next_retry_at": _to_iso(row["next_retry_at"]),
        "result_json": row["result_json"] or {},
        "error": row["error"],
        "processed_at": _to_iso(row["processed_at"]),
        "created_at": _to_iso(row["created_at"]),
        "updated_at": _to_iso(row["updated_at"]),
    }


def get_approval_item(content_item_id: str) -> dict[str, Any] | None:
    with connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                    ci.id,
                    ci.tenant_id,
                    ci.subaccount_id,
                    sa.name AS subaccount_name,
                    sa.status AS subaccount_status,
                    sa.ghl_location_id AS subaccount_location_id,
                    ci.brand_id,
                    b.name AS brand_name,
                    b.status AS brand_status,
                    b.allowed_publishers AS brand_allowed_publishers,
                    ci.platform,
                    ci.status,
                    ci.title,
                    ci.source_task_id,
                    ci.current_version_id,
                    cv.version_number AS current_version_number,
                    cv.content_text AS current_content_text,
                    ci.scheduled_at,
                    ci.created_at,
                    ci.updated_at,
                    lr.action AS last_review_action,
                    lr.reviewer AS last_reviewer,
                    lr.created_at AS last_reviewed_at
                FROM content_items ci
                JOIN brands b
                  ON b.id = ci.brand_id
                 AND b.tenant_id = ci.tenant_id
                JOIN subaccounts sa
                  ON sa.id = ci.subaccount_id
                 AND sa.tenant_id = ci.tenant_id
                LEFT JOIN content_versions cv
                  ON cv.id = ci.current_version_id
                LEFT JOIN LATERAL (
                    SELECT action, reviewer, created_at
                    FROM content_reviews cr
                    WHERE cr.content_item_id = ci.id
                    ORDER BY cr.created_at DESC
                    LIMIT 1
                ) lr ON TRUE
                WHERE ci.id = %s;
                """,
                (content_item_id,),
            )
            row = cur.fetchone()
            if row is None:
                return None

            cur.execute(
                """
                SELECT
                    id,
                    content_item_id,
                    version_number,
                    content_text,
                    metadata_json,
                    generated_by,
                    generation_note,
                    created_at
                FROM content_versions
                WHERE content_item_id = %s
                ORDER BY version_number DESC;
                """,
                (content_item_id,),
            )
            versions = cur.fetchall()

            cur.execute(
                """
                SELECT
                    id,
                    content_item_id,
                    content_version_id,
                    reviewer,
                    action,
                    note,
                    metadata_json,
                    created_at
                FROM content_reviews
                WHERE content_item_id = %s
                ORDER BY created_at DESC;
                """,
                (content_item_id,),
            )
            reviews = cur.fetchall()

            cur.execute(
                """
                SELECT
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
                    updated_at
                FROM ai_regeneration_jobs
                WHERE content_item_id = %s
                ORDER BY created_at DESC;
                """,
                (content_item_id,),
            )
            jobs = cur.fetchall()

    item = _serialize_content_item_row(row)
    item["versions"] = [_serialize_content_version(v) for v in versions]
    item["reviews"] = [_serialize_content_review(v) for v in reviews]
    item["regeneration_jobs"] = [_serialize_regen_job(v) for v in jobs]
    return item


def _upsert_task_approval_for_review(
    *,
    task_id: str,
    tenant_id: str,
    status: str,
    reviewer: str,
    note: str,
) -> None:
    with connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO task_approvals(
                    task_id,
                    tenant_id,
                    status,
                    approved_by,
                    approved_at,
                    note,
                    created_at
                )
                VALUES (
                    %s,
                    %s,
                    %s,
                    %s,
                    CASE WHEN %s = 'approved' THEN now() ELSE NULL END,
                    %s,
                    now()
                )
                ON CONFLICT (task_id) DO UPDATE SET
                    status = EXCLUDED.status,
                    approved_by = EXCLUDED.approved_by,
                    approved_at = EXCLUDED.approved_at,
                    note = EXCLUDED.note;
                """,
                (task_id, tenant_id, status, reviewer, status, note),
            )
        conn.commit()


def _insert_content_review(
    *,
    content_item_id: str,
    content_version_id: str | None,
    reviewer: str,
    action: str,
    note: str,
    metadata_json: dict[str, Any] | None = None,
) -> None:
    review_action = _normalize_status(action, CONTENT_REVIEW_ACTIONS, "created")
    review_id = str(uuid4())
    with connect() as conn:
        with conn.cursor() as cur:
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
                VALUES (%s, %s, %s, %s, %s, %s, %s);
                """,
                (
                    review_id,
                    content_item_id,
                    content_version_id,
                    reviewer,
                    review_action,
                    note,
                    _to_jsonb(metadata_json or {}),
                ),
            )
        conn.commit()


def _update_content_item_status(content_item_id: str, status: str) -> dict[str, Any]:
    normalized_status = _normalize_status(status, CONTENT_ITEM_STATUSES, "ready_for_review")
    with connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE content_items
                SET status = %s,
                    updated_at = now()
                WHERE id = %s
                RETURNING id, tenant_id, source_task_id, current_version_id;
                """,
                (normalized_status, content_item_id),
            )
            row = cur.fetchone()
        conn.commit()

    if row is None:
        raise KeyError("Content item not found")
    return row


def approve_content_item(
    *,
    content_item_id: str,
    reviewer: str,
    note: str = "",
) -> dict[str, Any]:
    row = _update_content_item_status(content_item_id, "approved")
    _insert_content_review(
        content_item_id=content_item_id,
        content_version_id=row["current_version_id"],
        reviewer=reviewer,
        action="approved",
        note=note,
        metadata_json={},
    )
    if row.get("source_task_id"):
        _upsert_task_approval_for_review(
            task_id=row["source_task_id"],
            tenant_id=row["tenant_id"],
            status="approved",
            reviewer=reviewer,
            note=note,
        )

    item = get_approval_item(content_item_id)
    if item is None:
        raise RuntimeError("Failed to fetch approved content item")
    return item


def reject_content_item(
    *,
    content_item_id: str,
    reviewer: str,
    note: str = "",
) -> dict[str, Any]:
    row = _update_content_item_status(content_item_id, "rejected")
    _insert_content_review(
        content_item_id=content_item_id,
        content_version_id=row["current_version_id"],
        reviewer=reviewer,
        action="rejected",
        note=note,
        metadata_json={},
    )
    if row.get("source_task_id"):
        _upsert_task_approval_for_review(
            task_id=row["source_task_id"],
            tenant_id=row["tenant_id"],
            status="rejected",
            reviewer=reviewer,
            note=note,
        )

    item = get_approval_item(content_item_id)
    if item is None:
        raise RuntimeError("Failed to fetch rejected content item")
    return item


def request_content_revision(
    *,
    content_item_id: str,
    reviewer: str,
    note: str = "",
) -> dict[str, Any]:
    row = _update_content_item_status(content_item_id, "revision_requested")
    _insert_content_review(
        content_item_id=content_item_id,
        content_version_id=row["current_version_id"],
        reviewer=reviewer,
        action="revision_requested",
        note=note,
        metadata_json={},
    )
    job_id = str(uuid4())
    with connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO ai_regeneration_jobs(
                    id,
                    tenant_id,
                    content_item_id,
                    base_version_id,
                    requested_by,
                    revision_note,
                    status,
                    attempt_count,
                    result_json,
                    updated_at
                )
                VALUES (%s, %s, %s, %s, %s, %s, 'queued', 0, '{}'::jsonb, now())
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
                (
                    job_id,
                    row["tenant_id"],
                    content_item_id,
                    row["current_version_id"],
                    reviewer,
                    note,
                ),
            )
            job_row = cur.fetchone()
        conn.commit()

    if job_row is None:
        raise RuntimeError("Failed to create regeneration job")

    item = get_approval_item(content_item_id)
    if item is None:
        raise RuntimeError("Failed to fetch revised content item")
    return {"item": item, "job": _serialize_regen_job(job_row)}
