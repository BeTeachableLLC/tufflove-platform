from __future__ import annotations

import os
import time
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeoutError
from typing import Any

from app.db import upsert_task_log
from app.handlers import handler_map
from app.queue import dequeue, requeue
from app.tasks import AsyncTask

TASK_ALLOWLIST_BY_TENANT = {
    "tufflove": ["embed.ingest"],
    "familyops": ["ghl.social.plan", "ghl.social.schedule", "ghl.social.publish", "embed.ingest", "content.ai.regenerate"],
    "corent": [],
}

TOOL_ALLOWLIST_BY_TENANT = {
    "tufflove": {"db.read", "db.write"},
    "familyops": {"db.read", "db.write", "ghl.read", "ghl.write"},
    "corent": set(),
}

MAX_TOOL_CALLS_BY_TENANT = {
    "tufflove": 8,
    "familyops": 10,
    "corent": 0,
}

TASK_REQUIRED_TOOLS = {
    "embed.ingest": ("db.write",),
    "ghl.social.plan": ("ghl.read",),
    "ghl.social.schedule": ("ghl.write",),
    "ghl.social.publish": ("ghl.write",),
    "content.ai.regenerate": ("db.write",),
}


def _requested_tool_calls(payload: dict[str, Any], fallback: int) -> int:
    requested = payload.get("requested_tool_calls")
    if isinstance(requested, int):
        return max(requested, 0)

    tool_calls = payload.get("tool_calls")
    if isinstance(tool_calls, int):
        return max(tool_calls, 0)
    if isinstance(tool_calls, list):
        return len(tool_calls)
    return fallback


def _authorize(task: AsyncTask) -> tuple[bool, str]:
    allowed_task_types = TASK_ALLOWLIST_BY_TENANT.get(task.tenant_id, [])
    if task.task_type not in allowed_task_types:
        return False, "Task type is not allowed for tenant"

    required_tools = TASK_REQUIRED_TOOLS.get(task.task_type, ())
    tenant_tools = TOOL_ALLOWLIST_BY_TENANT.get(task.tenant_id, set())
    missing_tools = [tool for tool in required_tools if tool not in tenant_tools]
    if missing_tools:
        return False, f"Tenant tool allowlist violation: {sorted(missing_tools)}"

    max_tool_calls = MAX_TOOL_CALLS_BY_TENANT.get(task.tenant_id, 0)
    requested_tool_calls = _requested_tool_calls(task.payload, fallback=len(required_tools))
    if requested_tool_calls > max_tool_calls:
        return False, f"Requested tool calls {requested_tool_calls} exceeds max {max_tool_calls}"

    return True, ""


def _safe_upsert_task_log(
    task: AsyncTask,
    *,
    status: str,
    result: dict[str, Any] | None = None,
    error: str | None = None,
) -> None:
    if not task.task_id:
        return
    try:
        upsert_task_log(
            task_id=task.task_id,
            tenant_id=task.tenant_id,
            user_id=task.user_id,
            task_type=task.task_type,
            status=status,
            payload=task.payload,
            result=result,
            error=error,
        )
    except Exception as exc:  # noqa: BLE001
        print(f"[worker-audit-error] task_id={task.task_id} status={status} error={exc}", flush=True)


def run_once(block_seconds: int = 5) -> dict[str, Any]:
    try:
        raw_task = dequeue(block_seconds=block_seconds)
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "status": "queue_error", "error": str(exc)}
    if raw_task is None:
        return {"ok": True, "status": "empty"}

    try:
        task = AsyncTask.model_validate(raw_task)
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "status": "invalid_task", "error": str(exc), "task": raw_task}

    print(
        f"[worker-audit] tenant_id={task.tenant_id} task_id={task.task_id} task_type={task.task_type}",
        flush=True,
    )
    _safe_upsert_task_log(task, status="running")

    authorized, reason = _authorize(task)
    if not authorized:
        _safe_upsert_task_log(task, status="rejected", error=reason)
        return {
            "ok": False,
            "status": "rejected",
            "task_id": task.task_id,
            "tenant_id": task.tenant_id,
            "task_type": task.task_type,
            "reason": reason,
        }

    handler = handler_map.get(task.task_type)
    if handler is None:
        _safe_upsert_task_log(task, status="failed", error="Unsupported task type")
        return {
            "ok": False,
            "status": "unsupported_task_type",
            "task_id": task.task_id,
            "tenant_id": task.tenant_id,
            "task_type": task.task_type,
        }

    max_seconds_per_task = int(os.getenv("MAX_TASK_SECONDS", "20"))
    executor = ThreadPoolExecutor(max_workers=1)
    handler_payload = dict(task.payload)
    if task.task_id:
        handler_payload["task_id"] = task.task_id
    handler_payload["tenant_id"] = task.tenant_id
    handler_payload["user_id"] = task.user_id
    future = executor.submit(handler, handler_payload)
    try:
        handler_result = future.result(timeout=max_seconds_per_task)

        if handler_result.get("status") == "blocked" and handler_result.get("note") == "approval_required":
            try:
                requeue(task.model_dump(mode="json"))
            except Exception as exc:  # noqa: BLE001
                print(f"[worker-requeue-error] task_id={task.task_id} error={exc}", flush=True)
            _safe_upsert_task_log(task, status="blocked", result=handler_result, error=handler_result.get("note"))
            return {
                "ok": False,
                "status": "blocked",
                "task_id": task.task_id,
                "tenant_id": task.tenant_id,
                "task_type": task.task_type,
                "result": handler_result,
            }

        log_status = "completed" if handler_result.get("ok", True) else str(handler_result.get("status", "completed"))
        log_error = None if handler_result.get("ok", True) else str(handler_result.get("note", "task_failed"))
        _safe_upsert_task_log(task, status=log_status, result=handler_result, error=log_error)
        return {
            "ok": handler_result.get("ok", True),
            "status": log_status,
            "task_id": task.task_id,
            "tenant_id": task.tenant_id,
            "task_type": task.task_type,
            "result": handler_result,
        }
    except FuturesTimeoutError:
        future.cancel()
        _safe_upsert_task_log(task, status="failed", error=f"Task timed out after {max_seconds_per_task}s")
        return {
            "ok": False,
            "status": "timeout",
            "task_id": task.task_id,
            "tenant_id": task.tenant_id,
            "task_type": task.task_type,
            "max_seconds_per_task": max_seconds_per_task,
        }
    except Exception as exc:  # noqa: BLE001
        _safe_upsert_task_log(task, status="failed", error=str(exc))
        return {
            "ok": False,
            "status": "failed",
            "task_id": task.task_id,
            "tenant_id": task.tenant_id,
            "task_type": task.task_type,
            "error": str(exc),
        }
    finally:
        executor.shutdown(wait=False, cancel_futures=True)


def run_forever(block_seconds: int = 5) -> None:
    while True:
        outcome = run_once(block_seconds=block_seconds)
        if outcome.get("status") in {"empty", "blocked"}:
            time.sleep(0.25)
