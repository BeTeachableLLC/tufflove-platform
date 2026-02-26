from __future__ import annotations
import os
from uuid import uuid4

import httpx
from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from dotenv import load_dotenv
from zeroclaw import ZeroClawRuntime, ZeroClawPolicy, ToolRegistry, ToolSpec, AutonomyLevel
from app.db import (
    create_approval,
    get_approval,
    get_task_log,
    get_tenant_policy_bundle,
    init_db,
    list_task_logs,
    list_tenants,
    search_knowledge_chunks,
    set_approval,
    seed_defaults,
    upsert_task_log,
    update_tenant_policy,
)
from app.queue import enqueue
from app.tasks import AsyncTask

load_dotenv()
app = FastAPI(title="TUFF LOVE Agent API", version="0.1.0")
origins = os.getenv(
    "CORS_ALLOW_ORIGINS",
    "http://localhost:3000,http://127.0.0.1:3000",
).split(",")
origins = [o.strip() for o in origins if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ChatRequest(BaseModel):
    tenant_id: str
    user_id: str
    message: str


class TaskEnqueueRequest(BaseModel):
    tenant_id: str
    user_id: str
    task_type: str
    payload: dict = Field(default_factory=dict)


class AdminPolicyUpdate(BaseModel):
    autonomy: AutonomyLevel
    tool_allowlist: list[str] = Field(default_factory=list)
    max_tool_calls_per_run: int = Field(ge=0)
    daily_token_budget: int = Field(ge=0)
    monthly_dollar_budget: float = Field(ge=0)


class AdminApprovalRequest(BaseModel):
    approved_by: str
    note: str = ""


class AdminIngestRequest(BaseModel):
    source_root: str
    extensions: list[str] = Field(default_factory=lambda: [".md", ".txt", ".mp3", ".pdf", ".docx"])
    max_files: int = Field(default=100, ge=1, le=2000)


def tool_db_read(payload): return {"ok": True, "data": "db.read stub", "payload": payload}
def tool_db_write(payload): return {"ok": True, "data": "db.write stub", "payload": payload}
def tool_ghl_read(payload): return {"ok": True, "data": "ghl.read stub", "payload": payload}
def tool_ghl_write(payload): return {"ok": True, "data": "ghl.write stub", "payload": payload}


def build_tool_registry() -> ToolRegistry:
    tools = ToolRegistry()
    tools.register(ToolSpec("db.read", tool_db_read, "Read data"))
    tools.register(ToolSpec("db.write", tool_db_write, "Write data"))
    tools.register(ToolSpec("ghl.read", tool_ghl_read, "Read from GHL"))
    tools.register(ToolSpec("ghl.write", tool_ghl_write, "Write to GHL"))
    return tools


TOOLS = build_tool_registry()


TASK_ALLOWLIST_BY_TENANT = {
    "tufflove": ["embed.ingest"],
    "familyops": ["ghl.social.plan", "ghl.social.schedule", "ghl.social.publish", "embed.ingest"],
    "corent": [],
}

OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses"


def require_admin(request: Request) -> None:
    expected = os.getenv("ADMIN_TOKEN", "change_me").strip() or "change_me"
    provided = request.headers.get("x-admin-token", "")
    if provided != expected:
        raise HTTPException(status_code=401, detail="Unauthorized")


def build_runtime_for_tenant(tenant_bundle: dict) -> ZeroClawRuntime:
    try:
        autonomy = AutonomyLevel(tenant_bundle["autonomy"])
    except ValueError as exc:
        raise HTTPException(status_code=500, detail="Invalid tenant autonomy setting") from exc

    policy = ZeroClawPolicy(autonomy=autonomy)
    policy.tool_allowlist = tuple(tenant_bundle["tool_allowlist"])
    policy.max_tool_calls_per_run = int(tenant_bundle["max_tool_calls_per_run"])
    policy.budget.daily_token_budget = int(tenant_bundle["daily_token_budget"])
    policy.budget.monthly_dollar_budget = float(tenant_bundle["monthly_dollar_budget"])
    return ZeroClawRuntime(policy=policy, tools=TOOLS)


def _render_knowledge_context(hits: list[dict]) -> str:
    if not hits:
        return ""
    lines = []
    for idx, hit in enumerate(hits, start=1):
        source = hit.get("source_path", "unknown")
        chunk = hit.get("chunk_index", 0)
        preview = str(hit.get("content_preview", "")).strip()
        lines.append(f"{idx}. source={source} chunk={chunk}: {preview}")
    return "\n".join(lines)


def _extract_openai_output_text(data: dict) -> str:
    output_text = data.get("output_text")
    if isinstance(output_text, str) and output_text.strip():
        return output_text.strip()

    output = data.get("output", [])
    chunks: list[str] = []
    if isinstance(output, list):
        for item in output:
            if not isinstance(item, dict):
                continue
            content = item.get("content", [])
            if not isinstance(content, list):
                continue
            for block in content:
                if not isinstance(block, dict):
                    continue
                text = block.get("text")
                if isinstance(text, str) and text.strip():
                    chunks.append(text.strip())

    if chunks:
        return "\n".join(chunks)
    raise ValueError("OpenAI response did not include text output")


def generate_ai_answer(
    *,
    message: str,
    model_route: str,
    knowledge_hits: list[dict] | None = None,
) -> tuple[str | None, str | None]:
    api_key = os.getenv("OPENAI_API_KEY", "").strip()
    if not api_key or api_key == "your_key_here":
        return None, "OPENAI_API_KEY is missing or placeholder"

    fast_model = os.getenv("OPENAI_MODEL_FAST", "").strip() or os.getenv("OPENAI_MODEL", "").strip() or "gpt-4o-mini"
    reasoning_model = os.getenv("OPENAI_MODEL_REASONING", "").strip() or fast_model
    model = reasoning_model if model_route == "reasoning" else fast_model
    timeout_sec = float(os.getenv("OPENAI_TIMEOUT_SEC", "30"))

    context_block = _render_knowledge_context(knowledge_hits or [])
    system_prompt = (
        "You are TUFF LOVE's execution-focused strategy assistant. "
        "Give concrete, practical steps with clear priorities."
    )
    if context_block:
        system_prompt = (
            f"{system_prompt}\n\nUse the knowledge snippets below when relevant. "
            "Treat them as user-owned source material.\n"
            f"{context_block}"
        )

    body = {
        "model": model,
        "input": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": message},
        ],
    }
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    try:
        with httpx.Client(timeout=timeout_sec) as client:
            response = client.post(OPENAI_RESPONSES_URL, json=body, headers=headers)
        if response.status_code >= 400:
            return None, f"OpenAI API error {response.status_code}: {response.text[:240]}"
        return _extract_openai_output_text(response.json()), None
    except Exception as exc:  # noqa: BLE001
        return None, f"OpenAI call failed: {exc}"


@app.on_event("startup")
def startup() -> None:
    init_db()
    seed_defaults()


@app.get("/healthz")
def healthz(): return {"ok": True, "service": "api"}

@app.post("/v1/chat")
def chat(req: ChatRequest):
    if not req.tenant_id or not req.user_id or not req.message:
        raise HTTPException(status_code=400, detail="Missing required fields")

    tenant_bundle = get_tenant_policy_bundle(req.tenant_id)
    if tenant_bundle is None:
        raise HTTPException(status_code=404, detail="Tenant not found")
    if tenant_bundle["status"] != "active":
        raise HTTPException(status_code=403, detail="Tenant is not active")

    runtime = build_runtime_for_tenant(tenant_bundle)
    result = runtime.run(tenant_id=req.tenant_id, user_id=req.user_id, message=req.message)

    knowledge_hits = search_knowledge_chunks(req.tenant_id, req.message, limit=5)
    ai_answer, ai_error = generate_ai_answer(
        message=req.message,
        model_route=result["model_route"],
        knowledge_hits=knowledge_hits,
    )
    if ai_answer is not None:
        result["answer"] = ai_answer
        result["ai_mode"] = "live"
    else:
        result["answer"] = f"[AI unavailable] {ai_error}"
        result["ai_mode"] = "stub"
        result["ai_error"] = ai_error
    result["knowledge_hits"] = knowledge_hits

    return result


@app.post("/v1/task/enqueue")
def enqueue_task(req: TaskEnqueueRequest):
    if not req.tenant_id or not req.user_id or not req.task_type:
        raise HTTPException(status_code=400, detail="Missing required fields")

    tenant_bundle = get_tenant_policy_bundle(req.tenant_id)
    if tenant_bundle is None:
        raise HTTPException(status_code=404, detail="Tenant not found")
    if tenant_bundle["status"] != "active":
        raise HTTPException(status_code=403, detail="Tenant is not active")

    allowed_task_types = TASK_ALLOWLIST_BY_TENANT.get(req.tenant_id, [])
    if req.task_type not in allowed_task_types:
        raise HTTPException(status_code=403, detail="Task type is not allowed for tenant")

    task_id = str(uuid4())
    task = AsyncTask(
        tenant_id=req.tenant_id,
        user_id=req.user_id,
        task_type=req.task_type,
        payload=req.payload or {},
        task_id=task_id,
    )
    upsert_task_log(
        task_id=task_id,
        tenant_id=req.tenant_id,
        user_id=req.user_id,
        task_type=req.task_type,
        status="queued",
        payload=req.payload or {},
    )
    approval_required = req.tenant_id == "familyops" and req.task_type == "ghl.social.publish"
    if approval_required:
        create_approval(task_id, req.tenant_id)

    enqueue(task.model_dump(mode="json"))
    return {"ok": True, "task_id": task_id, "approval_required": approval_required}


@app.get("/v1/admin/tenants", dependencies=[Depends(require_admin)])
def admin_list_tenants():
    return {"tenants": list_tenants()}


@app.get("/v1/admin/tenant/{tenant_id}/policy", dependencies=[Depends(require_admin)])
def admin_get_tenant_policy(tenant_id: str):
    tenant_bundle = get_tenant_policy_bundle(tenant_id)
    if tenant_bundle is None:
        raise HTTPException(status_code=404, detail="Tenant not found")
    return tenant_bundle


@app.put("/v1/admin/tenant/{tenant_id}/policy", dependencies=[Depends(require_admin)])
def admin_update_tenant_policy(tenant_id: str, payload: AdminPolicyUpdate):
    try:
        return update_tenant_policy(
            tenant_id=tenant_id,
            autonomy=payload.autonomy.value,
            tool_allowlist=payload.tool_allowlist,
            max_tool_calls_per_run=payload.max_tool_calls_per_run,
            daily_token_budget=payload.daily_token_budget,
            monthly_dollar_budget=payload.monthly_dollar_budget,
        )
    except KeyError:
        raise HTTPException(status_code=404, detail="Tenant not found")


@app.get("/v1/admin/tasks/{tenant_id}", dependencies=[Depends(require_admin)])
def admin_list_tasks(tenant_id: str):
    return {"tasks": list_task_logs(tenant_id)}


@app.get("/v1/admin/task/{task_id}", dependencies=[Depends(require_admin)])
def admin_get_task(task_id: str):
    task = get_task_log(task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    task["approval"] = get_approval(task_id)
    return task


@app.post("/v1/admin/task/{task_id}/approve", dependencies=[Depends(require_admin)])
def admin_approve_task(task_id: str, body: AdminApprovalRequest):
    task = get_task_log(task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    approval = set_approval(
        task_id=task_id,
        tenant_id=task["tenant_id"],
        status="approved",
        approved_by=body.approved_by,
        note=body.note,
    )
    return {"ok": True, "task_id": task_id, "approval": approval}


@app.post("/v1/admin/task/{task_id}/reject", dependencies=[Depends(require_admin)])
def admin_reject_task(task_id: str, body: AdminApprovalRequest):
    task = get_task_log(task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    approval = set_approval(
        task_id=task_id,
        tenant_id=task["tenant_id"],
        status="rejected",
        approved_by=body.approved_by,
        note=body.note,
    )
    upsert_task_log(
        task_id=task_id,
        tenant_id=task["tenant_id"],
        user_id=task["user_id"],
        task_type=task["task_type"],
        status="rejected",
        error=body.note or "rejected",
    )
    return {"ok": True, "task_id": task_id, "approval": approval}


@app.post("/v1/admin/tenant/{tenant_id}/ingest", dependencies=[Depends(require_admin)])
def admin_enqueue_ingest(tenant_id: str, body: AdminIngestRequest):
    tenant_bundle = get_tenant_policy_bundle(tenant_id)
    if tenant_bundle is None:
        raise HTTPException(status_code=404, detail="Tenant not found")
    if tenant_bundle["status"] != "active":
        raise HTTPException(status_code=403, detail="Tenant is not active")

    task_id = str(uuid4())
    task = AsyncTask(
        tenant_id=tenant_id,
        user_id="admin",
        task_type="embed.ingest",
        task_id=task_id,
        payload={
            "mode": "scan",
            "source_root": body.source_root,
            "extensions": body.extensions,
            "max_files": body.max_files,
        },
    )
    upsert_task_log(
        task_id=task_id,
        tenant_id=tenant_id,
        user_id="admin",
        task_type="embed.ingest",
        status="queued",
        payload=task.payload,
    )
    enqueue(task.model_dump(mode="json"))
    return {"ok": True, "task_id": task_id, "queued": True}
