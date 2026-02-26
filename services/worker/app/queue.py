from __future__ import annotations

import json
import os
from typing import Any

import redis

QUEUE_KEY = "queue:tasks"


def _client() -> redis.Redis:
    redis_url = os.getenv("REDIS_URL", "").strip()
    if not redis_url:
        raise RuntimeError("REDIS_URL is not set")
    return redis.Redis.from_url(redis_url, decode_responses=True)


def dequeue(block_seconds: int = 5) -> dict[str, Any] | None:
    result = _client().brpop(QUEUE_KEY, timeout=block_seconds)
    if result is None:
        return None
    _, payload = result
    return json.loads(payload)


def ack(_: dict[str, Any] | None = None) -> None:
    return None


def requeue(task: dict[str, Any]) -> None:
    _client().lpush(QUEUE_KEY, json.dumps(task, separators=(",", ":"), default=str))
