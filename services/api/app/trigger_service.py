from __future__ import annotations

from datetime import datetime, timedelta, timezone
import re
from typing import Any, Callable
from uuid import uuid4

from psycopg.types.json import Jsonb

from app.db import connect

TRIGGER_TYPES = {"interval", "cron", "daily", "weekly", "webhook"}
SCHEDULED_TRIGGER_TYPES = {"interval", "cron", "daily", "weekly"}

DEFAULT_DEDUPE_WINDOW_SECONDS = 300
DEFAULT_RETRY_BACKOFF_SECONDS = 60
DEFAULT_RETRY_BACKOFF_MAX_SECONDS = 3600
DEFAULT_CAP_BACKOFF_SECONDS = 3600

_CRON_EVERY_MINUTES = re.compile(r"^\*/(\d{1,4}) \* \* \* \*$")
_CRON_DAILY = re.compile(r"^(\d{1,2}) (\d{1,2}) \* \* \*$")
_CRON_WEEKLY = re.compile(r"^(\d{1,2}) (\d{1,2}) \* \* ([0-6])$")


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


def _coerce_int(config: dict[str, Any], key: str, fallback: int, *, minimum: int = 0) -> int:
    raw = config.get(key, fallback)
    try:
        value = int(raw)
    except (TypeError, ValueError):
        value = fallback
    return max(value, minimum)


def _extract_time(config: dict[str, Any], *, default_hour: int = 9, default_minute: int = 0) -> tuple[int, int]:
    if isinstance(config.get("time_utc"), str):
        raw = str(config["time_utc"]).strip()
        match = re.match(r"^(\d{1,2}):(\d{1,2})$", raw)
        if match:
            hour = int(match.group(1))
            minute = int(match.group(2))
            if 0 <= hour <= 23 and 0 <= minute <= 59:
                return hour, minute

    hour = _coerce_int(config, "hour", default_hour, minimum=0)
    minute = _coerce_int(config, "minute", default_minute, minimum=0)
    if hour > 23 or minute > 59:
        raise ValueError("Invalid hour/minute in trigger config")
    return hour, minute


def _next_daily_run(reference: datetime, hour: int, minute: int) -> datetime:
    candidate = reference.replace(hour=hour, minute=minute, second=0, microsecond=0)
    if candidate <= reference:
        candidate += timedelta(days=1)
    return candidate


def _next_weekly_run(reference: datetime, weekday: int, hour: int, minute: int) -> datetime:
    if weekday < 0 or weekday > 6:
        raise ValueError("weekday must be between 0 and 6")
    days_ahead = (weekday - reference.weekday()) % 7
    candidate = (reference + timedelta(days=days_ahead)).replace(hour=hour, minute=minute, second=0, microsecond=0)
    if candidate <= reference:
        candidate += timedelta(days=7)
    return candidate


def _cron_weekday_to_python(value: int) -> int:
    # Cron weekday: 0=Sunday, 1=Monday, ..., 6=Saturday.
    if value == 0:
        return 6
    return value - 1


def _next_cron_run(reference: datetime, expression: str) -> datetime:
    expr = expression.strip()

    every_minutes = _CRON_EVERY_MINUTES.match(expr)
    if every_minutes:
        step = int(every_minutes.group(1))
        if step <= 0:
            raise ValueError("cron minute step must be positive")
        base = reference.replace(second=0, microsecond=0)
        next_minute = ((base.minute // step) + 1) * step
        if next_minute >= 60:
            base = (base + timedelta(hours=1)).replace(minute=0)
            next_minute %= 60
        return base.replace(minute=next_minute)

    cron_daily = _CRON_DAILY.match(expr)
    if cron_daily:
        minute = int(cron_daily.group(1))
        hour = int(cron_daily.group(2))
        if minute > 59 or hour > 23:
            raise ValueError("cron hour/minute out of range")
        return _next_daily_run(reference, hour, minute)

    cron_weekly = _CRON_WEEKLY.match(expr)
    if cron_weekly:
        minute = int(cron_weekly.group(1))
        hour = int(cron_weekly.group(2))
        cron_weekday = int(cron_weekly.group(3))
        if minute > 59 or hour > 23:
            raise ValueError("cron hour/minute out of range")
        return _next_weekly_run(reference, _cron_weekday_to_python(cron_weekday), hour, minute)

    raise ValueError("Unsupported cron expression. Supported: */N * * * *, M H * * *, M H * * D")


def compute_next_run_at(trigger_type: str, config_json: dict[str, Any], *, reference: datetime | None = None) -> datetime | None:
    now = _as_utc(reference or _utc_now())
    config = config_json if isinstance(config_json, dict) else {}

    if trigger_type == "webhook":
        return None
    if trigger_type == "interval":
        interval_seconds = _coerce_int(config, "interval_seconds", 300, minimum=1)
        return now + timedelta(seconds=interval_seconds)
    if trigger_type == "daily":
        hour, minute = _extract_time(config, default_hour=9, default_minute=0)
        return _next_daily_run(now, hour, minute)
    if trigger_type == "weekly":
        hour, minute = _extract_time(config, default_hour=9, default_minute=0)
        weekday = _coerce_int(config, "weekday", 0, minimum=0)
        return _next_weekly_run(now, weekday, hour, minute)
    if trigger_type == "cron":
        expression = str(config.get("cron", "")).strip()
        if not expression:
            raise ValueError("cron trigger requires config_json.cron")
        return _next_cron_run(now, expression)
    raise ValueError(f"Unsupported trigger_type: {trigger_type}")


def compute_next_after_fire(trigger: dict[str, Any], *, fired_at: datetime | None = None) -> datetime | None:
    trigger_type = str(trigger.get("trigger_type", "")).strip()
    if trigger_type not in SCHEDULED_TRIGGER_TYPES:
        return None
    config_json = trigger.get("config_json") if isinstance(trigger.get("config_json"), dict) else {}
    return compute_next_run_at(trigger_type, config_json, reference=fired_at or _utc_now())


def compute_retry_backoff(trigger: dict[str, Any], *, failure_count: int, reference: datetime | None = None) -> datetime:
    config = trigger.get("config_json") if isinstance(trigger.get("config_json"), dict) else {}
    base = _coerce_int(config, "retry_backoff_seconds", DEFAULT_RETRY_BACKOFF_SECONDS, minimum=1)
    max_seconds = _coerce_int(config, "retry_backoff_max_seconds", DEFAULT_RETRY_BACKOFF_MAX_SECONDS, minimum=base)
    exponent = max(failure_count - 1, 0)
    delay = min(max_seconds, base * (2 ** exponent))
    return _as_utc(reference or _utc_now()) + timedelta(seconds=delay)


def compute_cap_backoff(trigger: dict[str, Any], *, reference: datetime | None = None) -> datetime:
    config = trigger.get("config_json") if isinstance(trigger.get("config_json"), dict) else {}
    seconds = _coerce_int(config, "cap_backoff_seconds", DEFAULT_CAP_BACKOFF_SECONDS, minimum=1)
    return _as_utc(reference or _utc_now()) + timedelta(seconds=seconds)


def _serialize_trigger(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": row["id"],
        "tenant_id": row["tenant_id"],
        "operator_id": row["operator_id"],
        "task_type": row["task_type"],
        "task_payload": row["task_payload"] or {},
        "trigger_type": row["trigger_type"],
        "config_json": row["config_json"] or {},
        "enabled": bool(row["enabled"]),
        "dedupe_key": row["dedupe_key"],
        "dedupe_window_seconds": int(row["dedupe_window_seconds"]),
        "last_fired_at": _to_iso(row["last_fired_at"]),
        "next_run_at": _to_iso(row["next_run_at"]),
        "failure_count": int(row["failure_count"] or 0),
        "last_task_id": row["last_task_id"],
        "last_error": row["last_error"],
        "created_at": _to_iso(row["created_at"]),
        "updated_at": _to_iso(row["updated_at"]),
    }


def init_trigger_tables() -> None:
    with connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS triggers(
                    id text PRIMARY KEY,
                    tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
                    operator_id text NOT NULL,
                    task_type text NOT NULL,
                    task_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
                    trigger_type text NOT NULL,
                    config_json jsonb NOT NULL DEFAULT '{}'::jsonb,
                    enabled boolean NOT NULL DEFAULT true,
                    dedupe_key text,
                    dedupe_window_seconds int NOT NULL DEFAULT 300,
                    last_fired_at timestamptz,
                    next_run_at timestamptz,
                    failure_count int NOT NULL DEFAULT 0,
                    last_task_id text,
                    last_error text,
                    created_at timestamptz NOT NULL DEFAULT now(),
                    updated_at timestamptz NOT NULL DEFAULT now()
                );
                """
            )
            cur.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_triggers_due
                ON triggers (enabled, next_run_at)
                WHERE enabled = true;
                """
            )
            cur.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_triggers_tenant
                ON triggers (tenant_id, updated_at DESC);
                """
            )
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS trigger_events(
                    id bigserial PRIMARY KEY,
                    trigger_id text REFERENCES triggers(id) ON DELETE SET NULL,
                    tenant_id text NOT NULL,
                    event_type text NOT NULL,
                    event_status text NOT NULL,
                    dedupe_key text,
                    task_id text,
                    metadata jsonb,
                    created_at timestamptz NOT NULL DEFAULT now()
                );
                """
            )
            cur.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_trigger_events_tenant_created
                ON trigger_events (tenant_id, created_at DESC);
                """
            )
            cur.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_trigger_events_dedupe
                ON trigger_events (dedupe_key, created_at DESC);
                """
            )
            cur.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_trigger_events_trigger_created
                ON trigger_events (trigger_id, created_at DESC);
                """
            )
        conn.commit()


def create_trigger(
    *,
    tenant_id: str,
    operator_id: str,
    task_type: str,
    task_payload: dict[str, Any],
    trigger_type: str,
    config_json: dict[str, Any],
    enabled: bool,
    dedupe_key: str | None,
    dedupe_window_seconds: int = DEFAULT_DEDUPE_WINDOW_SECONDS,
) -> dict[str, Any]:
    if trigger_type not in TRIGGER_TYPES:
        raise ValueError("Unsupported trigger_type")
    now = _utc_now()
    normalized_window = max(int(dedupe_window_seconds), 1)
    normalized_payload = task_payload if isinstance(task_payload, dict) else {}
    normalized_config = config_json if isinstance(config_json, dict) else {}
    next_run_at = (
        compute_next_run_at(trigger_type, normalized_config, reference=now)
        if enabled and trigger_type in SCHEDULED_TRIGGER_TYPES
        else None
    )
    trigger_id = str(uuid4())

    with connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO triggers(
                    id,
                    tenant_id,
                    operator_id,
                    task_type,
                    task_payload,
                    trigger_type,
                    config_json,
                    enabled,
                    dedupe_key,
                    dedupe_window_seconds,
                    next_run_at
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s);
                """,
                (
                    trigger_id,
                    tenant_id,
                    operator_id,
                    task_type,
                    _to_jsonb(normalized_payload),
                    trigger_type,
                    _to_jsonb(normalized_config),
                    enabled,
                    dedupe_key,
                    normalized_window,
                    next_run_at,
                ),
            )
        conn.commit()

    record_trigger_event(
        trigger_id=trigger_id,
        tenant_id=tenant_id,
        event_type="register",
        event_status="ok",
        metadata={
            "trigger_type": trigger_type,
            "task_type": task_type,
            "enabled": enabled,
        },
    )

    trigger = get_trigger(trigger_id)
    if trigger is None:
        raise RuntimeError("Failed to create trigger")
    return trigger


def get_trigger_record(trigger_id: str) -> dict[str, Any] | None:
    with connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                    id,
                    tenant_id,
                    operator_id,
                    task_type,
                    task_payload,
                    trigger_type,
                    config_json,
                    enabled,
                    dedupe_key,
                    dedupe_window_seconds,
                    last_fired_at,
                    next_run_at,
                    failure_count,
                    last_task_id,
                    last_error,
                    created_at,
                    updated_at
                FROM triggers
                WHERE id = %s;
                """,
                (trigger_id,),
            )
            row = cur.fetchone()
    return row


def get_trigger(trigger_id: str) -> dict[str, Any] | None:
    row = get_trigger_record(trigger_id)
    if row is None:
        return None
    return _serialize_trigger(row)


def list_triggers(tenant_id: str) -> list[dict[str, Any]]:
    with connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                    id,
                    tenant_id,
                    operator_id,
                    task_type,
                    task_payload,
                    trigger_type,
                    config_json,
                    enabled,
                    dedupe_key,
                    dedupe_window_seconds,
                    last_fired_at,
                    next_run_at,
                    failure_count,
                    last_task_id,
                    last_error,
                    created_at,
                    updated_at
                FROM triggers
                WHERE tenant_id = %s
                ORDER BY created_at DESC;
                """,
                (tenant_id,),
            )
            rows = cur.fetchall()
    return [_serialize_trigger(row) for row in rows]


def apply_trigger_patch(trigger_id: str, patch: dict[str, Any]) -> dict[str, Any] | None:
    current = get_trigger_record(trigger_id)
    if current is None:
        return None
    now = _utc_now()

    next_record = dict(current)
    allowed = {
        "operator_id",
        "task_type",
        "task_payload",
        "trigger_type",
        "config_json",
        "enabled",
        "dedupe_key",
        "dedupe_window_seconds",
    }
    for key, value in patch.items():
        if key in allowed:
            next_record[key] = value

    trigger_type = str(next_record["trigger_type"]).strip()
    if trigger_type not in TRIGGER_TYPES:
        raise ValueError("Unsupported trigger_type")
    enabled = bool(next_record["enabled"])
    config_json = next_record["config_json"] if isinstance(next_record.get("config_json"), dict) else {}
    task_payload = next_record["task_payload"] if isinstance(next_record.get("task_payload"), dict) else {}
    dedupe_window_seconds = max(int(next_record.get("dedupe_window_seconds") or DEFAULT_DEDUPE_WINDOW_SECONDS), 1)

    should_recompute_schedule = (
        trigger_type in SCHEDULED_TRIGGER_TYPES
        and enabled
        and (
            "trigger_type" in patch
            or "config_json" in patch
            or ("enabled" in patch and bool(patch["enabled"]) and not bool(current["enabled"]))
            or current["next_run_at"] is None
        )
    )
    if should_recompute_schedule:
        next_run_at = compute_next_run_at(trigger_type, config_json, reference=now)
    elif not enabled:
        next_run_at = current["next_run_at"]
    elif trigger_type == "webhook":
        next_run_at = None
    else:
        next_run_at = current["next_run_at"]

    with connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE triggers
                SET
                    operator_id = %s,
                    task_type = %s,
                    task_payload = %s,
                    trigger_type = %s,
                    config_json = %s,
                    enabled = %s,
                    dedupe_key = %s,
                    dedupe_window_seconds = %s,
                    next_run_at = %s,
                    updated_at = now()
                WHERE id = %s;
                """,
                (
                    str(next_record.get("operator_id") or "").strip(),
                    str(next_record.get("task_type") or "").strip(),
                    _to_jsonb(task_payload),
                    trigger_type,
                    _to_jsonb(config_json),
                    enabled,
                    next_record.get("dedupe_key"),
                    dedupe_window_seconds,
                    next_run_at,
                    trigger_id,
                ),
            )
        conn.commit()

    change_event = "updated"
    if "enabled" in patch:
        change_event = "enabled" if enabled else "disabled"
    record_trigger_event(
        trigger_id=trigger_id,
        tenant_id=current["tenant_id"],
        event_type=change_event,
        event_status="ok",
        metadata={"enabled": enabled, "trigger_type": trigger_type},
    )

    updated = get_trigger(trigger_id)
    if updated is None:
        raise RuntimeError("Failed to patch trigger")
    return updated


def list_due_trigger_records(*, now: datetime | None = None, limit: int = 100) -> list[dict[str, Any]]:
    run_at = _as_utc(now or _utc_now())
    safe_limit = min(max(int(limit), 1), 500)
    with connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                    id,
                    tenant_id,
                    operator_id,
                    task_type,
                    task_payload,
                    trigger_type,
                    config_json,
                    enabled,
                    dedupe_key,
                    dedupe_window_seconds,
                    last_fired_at,
                    next_run_at,
                    failure_count,
                    last_task_id,
                    last_error,
                    created_at,
                    updated_at
                FROM triggers
                WHERE enabled = true
                  AND next_run_at IS NOT NULL
                  AND next_run_at <= %s
                ORDER BY next_run_at ASC
                LIMIT %s;
                """,
                (run_at, safe_limit),
            )
            rows = cur.fetchall()
    return rows


def record_trigger_event(
    *,
    trigger_id: str | None,
    tenant_id: str,
    event_type: str,
    event_status: str,
    dedupe_key: str | None = None,
    task_id: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> None:
    with connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO trigger_events(
                    trigger_id,
                    tenant_id,
                    event_type,
                    event_status,
                    dedupe_key,
                    task_id,
                    metadata
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s);
                """,
                (
                    trigger_id,
                    tenant_id,
                    event_type,
                    event_status,
                    dedupe_key,
                    task_id,
                    _to_jsonb(metadata or {}),
                ),
            )
        conn.commit()


def count_recent_enqueued_events(*, dedupe_key: str, since: datetime) -> int:
    with connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT count(*) AS total
                FROM trigger_events
                WHERE dedupe_key = %s
                  AND event_type = 'fire'
                  AND event_status = 'enqueued'
                  AND created_at >= %s;
                """,
                (dedupe_key, _as_utc(since)),
            )
            row = cur.fetchone()
    return int((row or {}).get("total") or 0)


def count_tenant_enqueues_for_day(*, tenant_id: str, day_start: datetime, day_end: datetime) -> int:
    with connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT count(*) AS total
                FROM trigger_events
                WHERE tenant_id = %s
                  AND event_type = 'fire'
                  AND event_status = 'enqueued'
                  AND created_at >= %s
                  AND created_at < %s;
                """,
                (tenant_id, _as_utc(day_start), _as_utc(day_end)),
            )
            row = cur.fetchone()
    return int((row or {}).get("total") or 0)


def update_trigger_runtime_state(
    *,
    trigger_id: str,
    last_fired_at: datetime | None = None,
    next_run_at: datetime | None = None,
    failure_count: int | None = None,
    last_task_id: str | None = None,
    last_error: str | None = None,
) -> None:
    fields: list[str] = []
    values: list[Any] = []
    if last_fired_at is not None:
        fields.append("last_fired_at = %s")
        values.append(_as_utc(last_fired_at))
    if next_run_at is not None:
        fields.append("next_run_at = %s")
        values.append(_as_utc(next_run_at))
    if failure_count is not None:
        fields.append("failure_count = %s")
        values.append(max(int(failure_count), 0))
    if last_task_id is not None:
        fields.append("last_task_id = %s")
        values.append(last_task_id)
    if last_error is not None:
        fields.append("last_error = %s")
        values.append(last_error)
    if not fields:
        return

    fields.append("updated_at = now()")
    with connect() as conn:
        with conn.cursor() as cur:
            sql = f"UPDATE triggers SET {', '.join(fields)} WHERE id = %s;"
            values.append(trigger_id)
            cur.execute(sql, tuple(values))
        conn.commit()


def _dedupe_key_for_fire(trigger: dict[str, Any], *, now: datetime) -> str:
    base = str(trigger.get("dedupe_key") or trigger.get("id") or "").strip()
    if not base:
        base = str(trigger.get("id") or "trigger")

    next_run_at = trigger.get("next_run_at")
    if isinstance(next_run_at, datetime):
        return f"{base}:{_as_utc(next_run_at).isoformat()}"

    window_seconds = max(int(trigger.get("dedupe_window_seconds") or DEFAULT_DEDUPE_WINDOW_SECONDS), 1)
    bucket = int(_as_utc(now).timestamp()) // window_seconds
    return f"{base}:{bucket}"


def fire_trigger_record(
    trigger: dict[str, Any],
    *,
    daily_cap: int,
    enqueue_task_fn: Callable[..., dict[str, Any]],
    source: str,
    now: datetime | None = None,
) -> dict[str, Any]:
    fired_at = _as_utc(now or _utc_now())
    trigger_id = str(trigger.get("id") or "").strip()
    tenant_id = str(trigger.get("tenant_id") or "").strip()
    if not trigger_id or not tenant_id:
        return {"ok": False, "status": "invalid_trigger"}

    if not bool(trigger.get("enabled")):
        record_trigger_event(
            trigger_id=trigger_id,
            tenant_id=tenant_id,
            event_type="fire",
            event_status="disabled",
            metadata={"source": source},
        )
        return {"ok": False, "status": "disabled", "trigger_id": trigger_id}

    dedupe_window_seconds = max(int(trigger.get("dedupe_window_seconds") or DEFAULT_DEDUPE_WINDOW_SECONDS), 1)
    dedupe_key = _dedupe_key_for_fire(trigger, now=fired_at)
    dedupe_since = fired_at - timedelta(seconds=dedupe_window_seconds)
    if count_recent_enqueued_events(dedupe_key=dedupe_key, since=dedupe_since) > 0:
        next_run_at = compute_next_after_fire(trigger, fired_at=fired_at)
        if next_run_at is not None:
            update_trigger_runtime_state(
                trigger_id=trigger_id,
                next_run_at=next_run_at,
                last_error="dedupe_blocked",
            )
        record_trigger_event(
            trigger_id=trigger_id,
            tenant_id=tenant_id,
            event_type="fire",
            event_status="deduped",
            dedupe_key=dedupe_key,
            metadata={"source": source},
        )
        return {"ok": False, "status": "deduped", "trigger_id": trigger_id, "dedupe_key": dedupe_key}

    cap = max(int(daily_cap), 1)
    day_start = fired_at.replace(hour=0, minute=0, second=0, microsecond=0)
    day_end = day_start + timedelta(days=1)
    if count_tenant_enqueues_for_day(tenant_id=tenant_id, day_start=day_start, day_end=day_end) >= cap:
        next_run_at = compute_cap_backoff(trigger, reference=fired_at)
        if str(trigger.get("trigger_type")) not in SCHEDULED_TRIGGER_TYPES:
            next_run_at = None
        update_trigger_runtime_state(
            trigger_id=trigger_id,
            next_run_at=next_run_at,
            last_error="tenant_daily_cap_reached",
        )
        record_trigger_event(
            trigger_id=trigger_id,
            tenant_id=tenant_id,
            event_type="fire",
            event_status="cap_blocked",
            dedupe_key=dedupe_key,
            metadata={"source": source, "daily_cap": cap},
        )
        return {"ok": False, "status": "cap_blocked", "trigger_id": trigger_id, "daily_cap": cap}

    try:
        enqueue_result = enqueue_task_fn(
            tenant_id=tenant_id,
            user_id=str(trigger.get("operator_id") or "trigger-service"),
            task_type=str(trigger.get("task_type") or ""),
            payload=dict(trigger.get("task_payload") or {}),
        )
        task_id = str(enqueue_result.get("task_id") or "").strip()
        next_run_at = compute_next_after_fire(trigger, fired_at=fired_at)
        update_trigger_runtime_state(
            trigger_id=trigger_id,
            last_fired_at=fired_at,
            next_run_at=next_run_at,
            failure_count=0,
            last_task_id=task_id or None,
            last_error="",
        )
        record_trigger_event(
            trigger_id=trigger_id,
            tenant_id=tenant_id,
            event_type="fire",
            event_status="enqueued",
            dedupe_key=dedupe_key,
            task_id=task_id or None,
            metadata={
                "source": source,
                "approval_required": bool(enqueue_result.get("approval_required", False)),
            },
        )
        return {
            "ok": True,
            "status": "enqueued",
            "trigger_id": trigger_id,
            "task_id": task_id,
            "approval_required": bool(enqueue_result.get("approval_required", False)),
        }
    except Exception as exc:  # noqa: BLE001
        next_failure_count = int(trigger.get("failure_count") or 0) + 1
        next_retry_at = compute_retry_backoff(trigger, failure_count=next_failure_count, reference=fired_at)
        next_run_at = next_retry_at if str(trigger.get("trigger_type")) in SCHEDULED_TRIGGER_TYPES else None
        error_text = str(exc)[:300]
        update_trigger_runtime_state(
            trigger_id=trigger_id,
            next_run_at=next_run_at,
            failure_count=next_failure_count,
            last_error=error_text,
        )
        record_trigger_event(
            trigger_id=trigger_id,
            tenant_id=tenant_id,
            event_type="fire",
            event_status="error",
            dedupe_key=dedupe_key,
            metadata={"source": source, "error": error_text},
        )
        return {
            "ok": False,
            "status": "error",
            "trigger_id": trigger_id,
            "error": error_text,
        }


def fire_trigger_by_id(
    trigger_id: str,
    *,
    daily_cap: int,
    enqueue_task_fn: Callable[..., dict[str, Any]],
    source: str,
    now: datetime | None = None,
) -> dict[str, Any]:
    trigger = get_trigger_record(trigger_id)
    if trigger is None:
        return {"ok": False, "status": "not_found", "trigger_id": trigger_id}
    return fire_trigger_record(
        trigger,
        daily_cap=daily_cap,
        enqueue_task_fn=enqueue_task_fn,
        source=source,
        now=now,
    )


def run_due_triggers(
    *,
    limit: int,
    daily_cap: int,
    enqueue_task_fn: Callable[..., dict[str, Any]],
    now: datetime | None = None,
) -> dict[str, Any]:
    run_at = _as_utc(now or _utc_now())
    due = list_due_trigger_records(now=run_at, limit=limit)
    outcomes: list[dict[str, Any]] = []
    enqueued = 0
    for trigger in due:
        outcome = fire_trigger_record(
            trigger,
            daily_cap=daily_cap,
            enqueue_task_fn=enqueue_task_fn,
            source="scheduler",
            now=run_at,
        )
        outcomes.append(outcome)
        if outcome.get("ok"):
            enqueued += 1
    return {
        "ok": True,
        "run_at": _to_iso(run_at),
        "due_count": len(due),
        "enqueued_count": enqueued,
        "results": outcomes,
    }
