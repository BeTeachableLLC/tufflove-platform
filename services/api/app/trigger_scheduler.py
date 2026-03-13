from __future__ import annotations

import os
import time
from datetime import datetime, timezone

from app.main import enqueue_task_internal, trigger_daily_cap
from app.trigger_service import run_due_triggers


def _tick_seconds() -> int:
    return max(int(os.getenv("TRIGGER_SCHEDULER_INTERVAL_SEC", "30")), 5)


def _due_limit() -> int:
    return max(int(os.getenv("TRIGGER_SCHEDULER_DUE_LIMIT", "50")), 1)


def run_loop() -> None:
    interval = _tick_seconds()
    limit = _due_limit()

    while True:
        try:
            result = run_due_triggers(
                limit=limit,
                daily_cap=trigger_daily_cap(),
                enqueue_task_fn=enqueue_task_internal,
            )
            outcomes = result.get("results") if isinstance(result, dict) else []
            fired = 0
            if isinstance(outcomes, list):
                fired = sum(1 for item in outcomes if isinstance(item, dict) and item.get("status") == "fired")

            print(
                f"[trigger-scheduler] at={datetime.now(timezone.utc).isoformat()} due={result.get('due_count', 0)} fired={fired}",
                flush=True,
            )
        except Exception as exc:  # noqa: BLE001
            print(f"[trigger-scheduler-error] error={exc}", flush=True)

        time.sleep(interval)


if __name__ == "__main__":
    run_loop()
