from __future__ import annotations
import os
from threading import Lock, Thread

from fastapi import Depends, FastAPI, HTTPException, Request

from app.runner import run_forever, run_once

app = FastAPI(title="TUFF LOVE Worker", version="0.1.0")

_runner_thread: Thread | None = None
_runner_lock = Lock()

@app.get("/healthz")
def healthz(): return {"ok": True, "service": "worker"}


def require_worker_token(request: Request) -> None:
    expected = os.getenv("WORKER_ADMIN_TOKEN", "").strip()
    if not expected:
        return
    provided = request.headers.get("x-worker-token", "")
    if provided != expected:
        raise HTTPException(status_code=401, detail="Unauthorized")


@app.post("/v1/worker/run_once", dependencies=[Depends(require_worker_token)])
def worker_run_once():
    return run_once()


@app.post("/v1/worker/run_forever", dependencies=[Depends(require_worker_token)])
def worker_run_forever():
    if os.getenv("ALLOW_RUN_FOREVER", "false").strip().lower() != "true":
        raise HTTPException(status_code=403, detail="run_forever is disabled")

    global _runner_thread

    with _runner_lock:
        if _runner_thread is not None and _runner_thread.is_alive():
            return {"ok": True, "status": "already_running"}

        _runner_thread = Thread(target=run_forever, daemon=True, name="worker-runner")
        _runner_thread.start()
    return {"ok": True, "status": "started"}
