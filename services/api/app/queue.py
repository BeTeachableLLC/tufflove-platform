from __future__ import annotations

import json
import os
from uuid import uuid4

import redis

QUEUE_KEY = "queue:tasks"


def _client() -> redis.Redis:
    redis_url = os.getenv("REDIS_URL", "").strip()
    if not redis_url:
        raise RuntimeError("REDIS_URL is not set")
    return redis.Redis.from_url(redis_url, decode_responses=True)


def enqueue(task: dict) -> str:
    task_id = str(task.get("task_id") or uuid4())
    envelope = dict(task)
    envelope["task_id"] = task_id
    _client().lpush(QUEUE_KEY, json.dumps(envelope, separators=(",", ":"), default=str))
    return task_id
