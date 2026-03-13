from __future__ import annotations
from datetime import datetime, timedelta, timezone
import os
from typing import Literal
from urllib.parse import urlencode
from uuid import uuid4

import httpx
from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from dotenv import load_dotenv
from zeroclaw import ZeroClawRuntime, ZeroClawPolicy, ToolRegistry, ToolSpec, AutonomyLevel
from app.db import (
    create_approval,
    get_brand,
    get_ghl_connection,
    get_approval,
    get_task_log,
    get_tenant_policy_bundle,
    init_db,
    list_brands,
    list_ghl_connections,
    list_task_logs,
    list_tenants,
    search_knowledge_chunks,
    set_approval,
    seed_defaults,
    upsert_ghl_connection,
    upsert_task_log,
    update_brand_location,
    update_tenant_policy,
)
from app.queue import enqueue
from app.tasks import AsyncTask
from app.operator_service import (
    activate_operator_version,
    create_operator_version,
    get_operator_mission,
    get_operator_version,
    init_operator_tables,
    list_operator_versions,
    list_operators,
    run_operator_version,
    update_operator_version,
)
from app.model_router_service import (
    apply_model_router_decision_action,
    create_model_router_decision,
    get_model_router_decision,
    init_model_router_tables,
    list_model_router_decisions,
    list_model_router_decision_events,
    update_model_router_decision,
)
from app.brand_approval_service import (
    approve_content_item,
    create_content_item_for_publish_task,
    get_approval_item as get_content_approval_item,
    init_brand_approval_tables,
    list_approval_items,
    list_brands_with_subaccounts,
    list_subaccounts,
    reject_content_item,
    request_content_revision,
)
from app.mission_history_service import (
    get_familyops_mission,
    list_familyops_missions,
)
from app.build_intake_service import (
    complete_build_execution_run,
    create_branch_record,
    create_build_request,
    get_build_request,
    init_build_intake_tables,
    link_router_decision_to_build_request,
    list_build_requests,
    save_pr_draft_metadata,
    set_build_verification_state,
    start_build_execution_run,
    transition_build_stage,
)
from app.trigger_service import (
    TRIGGER_TYPES,
    apply_trigger_patch,
    create_trigger,
    fire_trigger_by_id,
    get_trigger,
    init_trigger_tables,
    list_triggers as list_trigger_configs,
    run_due_triggers,
)

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


class ContentReviewRequest(BaseModel):
    reviewer: str
    note: str = ""


class AdminIngestRequest(BaseModel):
    source_root: str
    extensions: list[str] = Field(default_factory=lambda: [".md", ".txt", ".mp3", ".pdf", ".docx"])
    max_files: int = Field(default=100, ge=1, le=2000)


class GhlOAuthCallbackRequest(BaseModel):
    code: str
    tenant_id: str
    location_id: str | None = None


class AdminBrandUpdateRequest(BaseModel):
    ghl_location_id: str | None = None
    timezone: str = "America/New_York"
    default_platforms: list[str] = Field(default_factory=list)
    status: Literal["active", "inactive"] = "active"


TriggerType = Literal["interval", "cron", "daily", "weekly", "webhook"]


class TriggerRegisterRequest(BaseModel):
    tenant_id: str
    operator_id: str
    task_type: str
    task_payload: dict = Field(default_factory=dict)
    trigger_type: TriggerType
    config_json: dict = Field(default_factory=dict)
    enabled: bool = True
    dedupe_key: str | None = None
    dedupe_window_seconds: int = Field(default=300, ge=1, le=86400)


class TriggerFireRequest(BaseModel):
    trigger_id: str | None = None
    run_due: bool = False
    limit: int = Field(default=25, ge=1, le=200)


class TriggerPatchRequest(BaseModel):
    operator_id: str | None = None
    task_type: str | None = None
    task_payload: dict | None = None
    trigger_type: TriggerType | None = None
    config_json: dict | None = None
    enabled: bool | None = None
    dedupe_key: str | None = None
    dedupe_window_seconds: int | None = Field(default=None, ge=1, le=86400)


VersionStatus = Literal["draft", "validated", "active", "archived"]
ValidationStatus = Literal["pending", "passed", "failed"]


class OperatorVersionCreateRequest(BaseModel):
    tenant_id: str
    operator_id: str
    version_label: str | None = None
    status: VersionStatus = "draft"
    goal: str = ""
    instruction_json: dict = Field(default_factory=dict)
    tool_manifest: list[str] = Field(default_factory=list)
    validation_summary: str = ""
    validation_status: ValidationStatus = "pending"
    created_by: str = "admin"


class OperatorVersionPatchRequest(BaseModel):
    version_label: str | None = None
    status: VersionStatus | None = None
    goal: str | None = None
    instruction_json: dict | None = None
    tool_manifest: list[str] | None = None
    validation_summary: str | None = None
    validation_status: ValidationStatus | None = None
    updated_by: str = "admin"


class OperatorVersionActivateRequest(BaseModel):
    activated_by: str = "admin"


class OperatorRunRequest(BaseModel):
    tenant_id: str
    user_id: str
    operator_version_id: str
    input_payload: dict = Field(default_factory=dict)


ModelTaskClass = Literal["implement", "debug", "review", "verify"]
ProofStatus = Literal["unknown", "passing", "failing", "not_run"]
VerificationStatus = Literal["not_required", "pending", "passed", "failed"]
ReviewState = Literal[
    "active",
    "approved_next_step",
    "needs_changes",
    "rerun_requested",
    "second_review_requested",
    "ready_for_pr_review",
    "ready_for_merge",
    "rejected",
]
DecisionActionType = Literal[
    "approve_next_step",
    "reject_send_back",
    "request_rerun",
    "request_second_model_review",
    "mark_ready_pr_review",
    "mark_ready_merge",
]
BuildStage = Literal[
    "intake",
    "routed",
    "branch_created",
    "implementation_started",
    "tests_run",
    "verification_requested",
    "pr_drafted",
    "approval_pending",
    "ready_for_pr_review",
    "ready_for_merge",
    "revise_before_pr",
    "rejected",
    "rerun_requested",
]
ExecutionRunStatus = Literal["running", "passed", "failed", "error", "cancelled"]
BuildProofStatus = Literal["unknown", "passed", "failed"]
BuildVerificationState = Literal["not_required", "pending", "passed", "failed"]


class ModelRouterRouteRequest(BaseModel):
    tenant_id: str
    task_class: ModelTaskClass
    task_type: str | None = None
    requested_model: str | None = None
    escalation_reason: str = ""
    output_summary: str = ""
    proof_summary: str = ""
    proof_status: ProofStatus = "unknown"
    mission_id: str | None = None
    task_id: str | None = None
    operator_id: str | None = None
    linked_branch: str | None = None
    linked_pr: str | None = None
    sensitive_change: bool = False
    verification_required: bool | None = None
    verification_model: str | None = None
    metadata: dict = Field(default_factory=dict)
    created_by: str = "admin"


class ModelRouterPatchRequest(BaseModel):
    escalation_reason: str | None = None
    output_summary: str | None = None
    proof_summary: str | None = None
    proof_status: ProofStatus | None = None
    verification_required: bool | None = None
    verification_model: str | None = None
    verification_status: VerificationStatus | None = None
    review_state: ReviewState | None = None
    linked_branch: str | None = None
    linked_pr: str | None = None
    metadata: dict | None = None
    updated_by: str = "admin"


class ModelRouterActionRequest(BaseModel):
    action: DecisionActionType
    actor: str = "admin"
    note: str = ""
    requested_model: str | None = None


class BuildIntakeCreateRequest(BaseModel):
    tenant_id: str = "familyops"
    goal: str
    scope_summary: str = ""
    constraints_json: dict = Field(default_factory=dict)
    requested_model_lane: str = "codex"
    sensitive_change: bool = False
    desired_proof: str = ""
    created_by: str = "admin"


class BuildBranchCreateRequest(BaseModel):
    actor: str = "admin"
    source_branch: str = "main"
    branch_name: str | None = None


class BuildRouteLinkRequest(BaseModel):
    decision_id: str
    actor: str = "admin"


class BuildStageUpdateRequest(BaseModel):
    stage: BuildStage
    actor: str = "admin"
    detail: str = ""
    metadata: dict = Field(default_factory=dict)


class BuildPrDraftRequest(BaseModel):
    actor: str = "admin"
    pr_url: str
    pr_number: str | None = None
    proof_summary: str = ""
    test_summary: str = ""
    files_changed_summary: str = ""
    stage: BuildStage = "pr_drafted"


class BuildExecutionStartRequest(BaseModel):
    actor: str = "admin"
    command_class: str = "codex"
    target_scope: str = "repo"
    summary: str = ""
    router_decision_id: str | None = None
    mission_id: str | None = None


class BuildExecutionCompleteRequest(BaseModel):
    actor: str = "admin"
    status: ExecutionRunStatus = "passed"
    summary: str = ""
    lint_build_summary: str = ""
    test_summary: str = ""
    changed_files_summary: str = ""
    execution_output_excerpt: str = ""
    proof_status: BuildProofStatus = "unknown"
    request_verification: bool = False
    verification_required: bool | None = None
    failure_note: str = ""
    rollback_note: str = ""


class BuildVerificationRequest(BaseModel):
    actor: str = "admin"
    verification_state: BuildVerificationState = "pending"
    detail: str = ""
    verification_required: bool | None = None


def tool_db_read(payload): return {"ok": True, "data": "db.read stub", "payload": payload}
def tool_db_write(payload): return {"ok": True, "data": "db.write stub", "payload": payload}
def tool_ghl_read(payload): return {"ok": True, "data": "ghl.read stub", "payload": payload}
def tool_ghl_write(payload): return {"ok": True, "data": "ghl.write stub", "payload": payload}


RUNNER_TOOL_IMPLS = {
    "db.read": tool_db_read,
    "db.write": tool_db_write,
    "ghl.read": tool_ghl_read,
    "ghl.write": tool_ghl_write,
}


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
    "familyops": ["ghl.social.plan", "ghl.social.schedule", "ghl.social.publish", "embed.ingest", "content.ai.regenerate"],
    "corent": [],
}

OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses"
DEFAULT_GHL_AUTH_URL = "https://marketplace.gohighlevel.com/oauth/chooselocation"
DEFAULT_GHL_SCOPES = (
    "contacts.readonly contacts.write opportunities.readonly opportunities.write "
    "calendars.readonly calendars.write "
    "socialplanner/post.readonly socialplanner/post.write"
)


def trigger_daily_cap() -> int:
    raw = os.getenv("TRIGGER_DAILY_CAP_PER_TENANT", "50").strip()
    try:
        value = int(raw)
    except ValueError:
        value = 50
    return max(value, 1)


def require_admin(request: Request) -> None:
    expected = os.getenv("ADMIN_TOKEN", "change_me").strip() or "change_me"
    provided = request.headers.get("x-admin-token", "")
    if provided != expected:
        raise HTTPException(status_code=401, detail="Unauthorized")


def required_env(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise HTTPException(status_code=500, detail=f"{name} is not configured")
    return value


def parse_iso_datetime(value: str | None, field_name: str) -> datetime | None:
    if value is None:
        return None
    raw = value.strip()
    if not raw:
        return None
    try:
        parsed = datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=f"Invalid {field_name}; expected ISO-8601 datetime") from exc
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


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
    init_brand_approval_tables()
    init_trigger_tables()
    init_operator_tables()
    init_model_router_tables()
    init_build_intake_tables()


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


@app.post("/v1/task/enqueue", dependencies=[Depends(require_admin)])
def enqueue_task(req: TaskEnqueueRequest):
    return enqueue_task_internal(
        tenant_id=req.tenant_id,
        user_id=req.user_id,
        task_type=req.task_type,
        payload=req.payload or {},
    )


def _validate_task_enqueue_request(*, tenant_id: str, task_type: str, payload: dict) -> None:
    if not tenant_id or not task_type:
        raise HTTPException(status_code=400, detail="Missing required fields")

    tenant_bundle = get_tenant_policy_bundle(tenant_id)
    if tenant_bundle is None:
        raise HTTPException(status_code=404, detail="Tenant not found")
    if tenant_bundle["status"] != "active":
        raise HTTPException(status_code=403, detail="Tenant is not active")

    allowed_task_types = TASK_ALLOWLIST_BY_TENANT.get(tenant_id, [])
    if task_type not in allowed_task_types:
        raise HTTPException(status_code=403, detail="Task type is not allowed for tenant")
    if task_type == "ghl.social.publish":
        brand_id = str((payload or {}).get("brand_id", "")).strip()
        location_id = str((payload or {}).get("location_id", "")).strip()
        if not brand_id or not location_id:
            raise HTTPException(
                status_code=400,
                detail="ghl.social.publish payload must include brand_id and location_id",
            )


def enqueue_task_internal(*, tenant_id: str, user_id: str, task_type: str, payload: dict) -> dict:
    if not tenant_id or not user_id or not task_type:
        raise HTTPException(status_code=400, detail="Missing required fields")
    _validate_task_enqueue_request(tenant_id=tenant_id, task_type=task_type, payload=payload or {})

    task_id = str(uuid4())
    normalized_payload = dict(payload or {})

    if tenant_id == "familyops" and task_type == "ghl.social.publish":
        content_item_id = str(normalized_payload.get("content_item_id") or "").strip()
        if not content_item_id:
            try:
                content_item = create_content_item_for_publish_task(
                    tenant_id=tenant_id,
                    user_id=user_id,
                    source_task_id=task_id,
                    payload=normalized_payload,
                )
            except KeyError as exc:
                raise HTTPException(status_code=404, detail=str(exc)) from exc
            except ValueError as exc:
                raise HTTPException(status_code=400, detail=str(exc)) from exc
            normalized_payload["content_item_id"] = content_item["id"]

    task = AsyncTask(
        tenant_id=tenant_id,
        user_id=user_id,
        task_type=task_type,
        payload=normalized_payload,
        task_id=task_id,
    )
    upsert_task_log(
        task_id=task_id,
        tenant_id=tenant_id,
        user_id=user_id,
        task_type=task_type,
        status="queued",
        payload=normalized_payload,
    )
    approval_required = tenant_id == "familyops" and task_type == "ghl.social.publish"
    if approval_required:
        create_approval(task_id, tenant_id)

    enqueue(task.model_dump(mode="json"))
    return {"ok": True, "task_id": task_id, "approval_required": approval_required}


def _require_active_familyops_tenant() -> None:
    tenant_bundle = get_tenant_policy_bundle("familyops")
    if tenant_bundle is None:
        raise HTTPException(status_code=404, detail="Tenant not found")
    if tenant_bundle["status"] != "active":
        raise HTTPException(status_code=403, detail="Tenant is not active")


def _require_familyops_content_item(content_item_id: str) -> dict:
    item = get_content_approval_item(content_item_id)
    if item is None or item.get("tenant_id") != "familyops":
        raise HTTPException(status_code=404, detail="Approval item not found")
    return item


@app.get("/v1/familyops/approvals", dependencies=[Depends(require_admin)])
def familyops_list_approvals(
    subaccount_id: str | None = None,
    brand_id: str | None = None,
    platform: str | None = None,
    status: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    search: str | None = None,
    limit: int = 50,
    offset: int = 0,
):
    _require_active_familyops_tenant()
    items = list_approval_items(
        tenant_id="familyops",
        subaccount_id=subaccount_id,
        brand_id=brand_id,
        platform=platform,
        status=status,
        date_from=parse_iso_datetime(date_from, "date_from"),
        date_to=parse_iso_datetime(date_to, "date_to"),
        search=search,
        limit=limit,
        offset=offset,
    )
    items["subaccounts"] = list_subaccounts("familyops")
    items["brands"] = list_brands_with_subaccounts("familyops")
    return items


@app.get("/v1/familyops/approvals/{content_item_id}", dependencies=[Depends(require_admin)])
def familyops_get_approval(content_item_id: str):
    _require_active_familyops_tenant()
    return _require_familyops_content_item(content_item_id)


@app.post("/v1/familyops/approvals/{content_item_id}/approve", dependencies=[Depends(require_admin)])
def familyops_approve_content(content_item_id: str, body: ContentReviewRequest):
    _require_active_familyops_tenant()
    _require_familyops_content_item(content_item_id)
    reviewer = body.reviewer.strip()
    if not reviewer:
        raise HTTPException(status_code=400, detail="reviewer is required")
    item = approve_content_item(content_item_id=content_item_id, reviewer=reviewer, note=body.note)
    return {"ok": True, "item": item}


@app.post("/v1/familyops/approvals/{content_item_id}/reject", dependencies=[Depends(require_admin)])
def familyops_reject_content(content_item_id: str, body: ContentReviewRequest):
    _require_active_familyops_tenant()
    _require_familyops_content_item(content_item_id)
    reviewer = body.reviewer.strip()
    if not reviewer:
        raise HTTPException(status_code=400, detail="reviewer is required")
    item = reject_content_item(content_item_id=content_item_id, reviewer=reviewer, note=body.note)
    return {"ok": True, "item": item}


@app.post("/v1/familyops/approvals/{content_item_id}/request-revision", dependencies=[Depends(require_admin)])
def familyops_request_revision(content_item_id: str, body: ContentReviewRequest):
    _require_active_familyops_tenant()
    _require_familyops_content_item(content_item_id)
    reviewer = body.reviewer.strip()
    if not reviewer:
        raise HTTPException(status_code=400, detail="reviewer is required")
    revision = request_content_revision(content_item_id=content_item_id, reviewer=reviewer, note=body.note)
    regen_task = enqueue_task_internal(
        tenant_id="familyops",
        user_id=reviewer,
        task_type="content.ai.regenerate",
        payload={
            "content_item_id": content_item_id,
            "regeneration_job_id": revision["job"]["id"],
            "note": body.note,
        },
    )
    return {"ok": True, "item": revision["item"], "job": revision["job"], "regeneration_task": regen_task}


@app.get("/v1/familyops/missions", dependencies=[Depends(require_admin)])
def familyops_list_missions(
    status: str | None = None,
    task_type: str | None = None,
    tenant_id: str | None = None,
    subaccount_id: str | None = None,
    brand_id: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    search: str | None = None,
    limit: int = 50,
    offset: int = 0,
):
    _require_active_familyops_tenant()
    effective_tenant = str(tenant_id or "familyops").strip() or "familyops"
    tenant_bundle = get_tenant_policy_bundle(effective_tenant)
    if tenant_bundle is None:
        raise HTTPException(status_code=404, detail="Tenant not found")

    return list_familyops_missions(
        tenant_id=effective_tenant,
        status=status,
        task_type=task_type,
        subaccount_id=subaccount_id,
        brand_id=brand_id,
        date_from=parse_iso_datetime(date_from, "date_from"),
        date_to=parse_iso_datetime(date_to, "date_to"),
        search=search,
        limit=limit,
        offset=offset,
    )


@app.get("/v1/familyops/missions/{mission_id}", dependencies=[Depends(require_admin)])
def familyops_get_mission_detail(mission_id: str, tenant_id: str = "familyops"):
    _require_active_familyops_tenant()
    effective_tenant = str(tenant_id or "familyops").strip() or "familyops"
    mission = get_familyops_mission(mission_id, tenant_id=effective_tenant)
    if mission is None:
        raise HTTPException(status_code=404, detail="Mission not found")
    return mission


@app.post("/v1/trigger/register", dependencies=[Depends(require_admin)])
def register_trigger(req: TriggerRegisterRequest):
    _validate_task_enqueue_request(
        tenant_id=req.tenant_id,
        task_type=req.task_type,
        payload=req.task_payload or {},
    )
    if req.trigger_type not in TRIGGER_TYPES:
        raise HTTPException(status_code=400, detail="Unsupported trigger_type")

    trigger = create_trigger(
        tenant_id=req.tenant_id,
        operator_id=req.operator_id.strip() or "trigger-service",
        task_type=req.task_type,
        task_payload=req.task_payload or {},
        trigger_type=req.trigger_type,
        config_json=req.config_json or {},
        enabled=bool(req.enabled),
        dedupe_key=req.dedupe_key,
        dedupe_window_seconds=req.dedupe_window_seconds,
    )
    return {"ok": True, "trigger": trigger}


@app.post("/v1/trigger/fire", dependencies=[Depends(require_admin)])
def fire_trigger(req: TriggerFireRequest):
    if req.run_due:
        return run_due_triggers(
            limit=req.limit,
            daily_cap=trigger_daily_cap(),
            enqueue_task_fn=enqueue_task_internal,
        )

    trigger_id = (req.trigger_id or "").strip()
    if not trigger_id:
        raise HTTPException(status_code=400, detail="trigger_id is required unless run_due is true")
    outcome = fire_trigger_by_id(
        trigger_id,
        daily_cap=trigger_daily_cap(),
        enqueue_task_fn=enqueue_task_internal,
        source="api_fire",
    )
    if outcome.get("status") == "not_found":
        raise HTTPException(status_code=404, detail="Trigger not found")
    return outcome


@app.get("/v1/triggers", dependencies=[Depends(require_admin)])
def list_triggers_endpoint(tenant_id: str):
    if not tenant_id:
        raise HTTPException(status_code=400, detail="tenant_id is required")
    tenant_bundle = get_tenant_policy_bundle(tenant_id)
    if tenant_bundle is None:
        raise HTTPException(status_code=404, detail="Tenant not found")
    return {"tenant_id": tenant_id, "triggers": list_trigger_configs(tenant_id)}


@app.patch("/v1/trigger/{trigger_id}", dependencies=[Depends(require_admin)])
def patch_trigger_endpoint(trigger_id: str, body: TriggerPatchRequest):
    existing = get_trigger(trigger_id)
    if existing is None:
        raise HTTPException(status_code=404, detail="Trigger not found")

    patch = body.model_dump(exclude_unset=True)
    if not patch:
        return {"ok": True, "trigger": existing}

    effective_task_type = str(patch.get("task_type") or existing["task_type"])
    effective_payload = (
        patch.get("task_payload")
        if "task_payload" in patch
        else (existing.get("task_payload") or {})
    )
    _validate_task_enqueue_request(
        tenant_id=str(existing["tenant_id"]),
        task_type=effective_task_type,
        payload=effective_payload or {},
    )

    if "trigger_type" in patch and patch["trigger_type"] not in TRIGGER_TYPES:
        raise HTTPException(status_code=400, detail="Unsupported trigger_type")

    try:
        updated = apply_trigger_patch(trigger_id, patch)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    if updated is None:
        raise HTTPException(status_code=404, detail="Trigger not found")
    return {"ok": True, "trigger": updated}


@app.post("/v1/operator/version", dependencies=[Depends(require_admin)])
def create_operator_version_endpoint(body: OperatorVersionCreateRequest):
    tenant_bundle = get_tenant_policy_bundle(body.tenant_id)
    if tenant_bundle is None:
        raise HTTPException(status_code=404, detail="Tenant not found")
    if tenant_bundle["status"] != "active":
        raise HTTPException(status_code=403, detail="Tenant is not active")

    version = create_operator_version(
        tenant_id=body.tenant_id,
        operator_id=body.operator_id.strip(),
        version_label=body.version_label.strip() if body.version_label else None,
        status=body.status,
        goal=body.goal,
        instruction_json=body.instruction_json or {},
        tool_manifest=body.tool_manifest or [],
        validation_summary=body.validation_summary,
        validation_status=body.validation_status,
        created_by=body.created_by.strip() or "admin",
    )
    return {"ok": True, "version": version}


@app.get("/v1/operator/operators/{tenant_id}", dependencies=[Depends(require_admin)])
def list_operators_endpoint(tenant_id: str):
    tenant_bundle = get_tenant_policy_bundle(tenant_id)
    if tenant_bundle is None:
        raise HTTPException(status_code=404, detail="Tenant not found")
    return {"tenant_id": tenant_id, "operators": list_operators(tenant_id)}


@app.get("/v1/operator/versions", dependencies=[Depends(require_admin)])
def list_operator_versions_endpoint(tenant_id: str, operator_id: str):
    tenant_bundle = get_tenant_policy_bundle(tenant_id)
    if tenant_bundle is None:
        raise HTTPException(status_code=404, detail="Tenant not found")
    if not operator_id.strip():
        raise HTTPException(status_code=400, detail="operator_id is required")
    versions = list_operator_versions(tenant_id, operator_id.strip())
    return {"tenant_id": tenant_id, "operator_id": operator_id.strip(), "versions": versions}


@app.get("/v1/operator/version/{version_id}", dependencies=[Depends(require_admin)])
def get_operator_version_endpoint(version_id: str):
    version = get_operator_version(version_id)
    if version is None:
        raise HTTPException(status_code=404, detail="Operator version not found")
    return version


@app.patch("/v1/operator/version/{version_id}", dependencies=[Depends(require_admin)])
def patch_operator_version_endpoint(version_id: str, body: OperatorVersionPatchRequest):
    patch = body.model_dump(exclude_unset=True)
    updated_by = str(patch.pop("updated_by", body.updated_by)).strip() or "admin"
    if not patch:
        version = get_operator_version(version_id)
        if version is None:
            raise HTTPException(status_code=404, detail="Operator version not found")
        return {"ok": True, "version": version}

    updated = update_operator_version(version_id, patch, updated_by=updated_by)
    if updated is None:
        raise HTTPException(status_code=404, detail="Operator version not found")
    return {"ok": True, "version": updated}


@app.post("/v1/operator/version/{version_id}/activate", dependencies=[Depends(require_admin)])
def activate_operator_version_endpoint(version_id: str, body: OperatorVersionActivateRequest):
    try:
        version = activate_operator_version(version_id, activated_by=body.activated_by.strip() or "admin")
    except KeyError:
        raise HTTPException(status_code=404, detail="Operator version not found")
    return {"ok": True, "version": version}


@app.post("/v1/operator/run", dependencies=[Depends(require_admin)])
def run_operator_by_version_endpoint(body: OperatorRunRequest):
    tenant_bundle = get_tenant_policy_bundle(body.tenant_id)
    if tenant_bundle is None:
        raise HTTPException(status_code=404, detail="Tenant not found")
    if tenant_bundle["status"] != "active":
        raise HTTPException(status_code=403, detail="Tenant is not active")

    try:
        mission = run_operator_version(
            tenant_id=body.tenant_id,
            user_id=body.user_id.strip() or "operator-runner",
            operator_version_id=body.operator_version_id.strip(),
            input_payload=body.input_payload or {},
            tenant_tool_allowlist=tenant_bundle["tool_allowlist"],
            tool_impls=RUNNER_TOOL_IMPLS,
        )
    except KeyError:
        raise HTTPException(status_code=404, detail="Operator version not found")
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return {"ok": True, "mission": mission}


@app.get("/v1/operator/mission/{mission_id}", dependencies=[Depends(require_admin)])
def get_operator_mission_endpoint(mission_id: str):
    mission = get_operator_mission(mission_id)
    if mission is None:
        raise HTTPException(status_code=404, detail="Mission not found")
    return mission


@app.post("/v1/model-router/route", dependencies=[Depends(require_admin)])
def model_router_route_endpoint(body: ModelRouterRouteRequest):
    tenant_bundle = get_tenant_policy_bundle(body.tenant_id)
    if tenant_bundle is None:
        raise HTTPException(status_code=404, detail="Tenant not found")
    if tenant_bundle["status"] != "active":
        raise HTTPException(status_code=403, detail="Tenant is not active")

    decision = create_model_router_decision(
        tenant_id=body.tenant_id,
        task_class=body.task_class,
        task_type=body.task_type,
        requested_model=body.requested_model,
        escalation_reason=body.escalation_reason,
        output_summary=body.output_summary,
        proof_summary=body.proof_summary,
        proof_status=body.proof_status,
        mission_id=body.mission_id,
        task_id=body.task_id,
        operator_id=body.operator_id,
        linked_branch=body.linked_branch,
        linked_pr=body.linked_pr,
        sensitive_change=body.sensitive_change,
        verification_required=body.verification_required,
        verification_model=body.verification_model,
        metadata=body.metadata or {},
        created_by=body.created_by.strip() or "admin",
    )
    return {"ok": True, "decision": decision}


@app.get("/v1/model-router/decisions", dependencies=[Depends(require_admin)])
def model_router_list_endpoint(
    tenant_id: str = "familyops",
    task_class: str | None = None,
    verification_status: str | None = None,
    review_state: str | None = None,
    limit: int = 50,
    offset: int = 0,
):
    tenant_bundle = get_tenant_policy_bundle(tenant_id)
    if tenant_bundle is None:
        raise HTTPException(status_code=404, detail="Tenant not found")
    return list_model_router_decisions(
        tenant_id=tenant_id,
        task_class=task_class,
        verification_status=verification_status,
        review_state=review_state,
        limit=limit,
        offset=offset,
    )


@app.get("/v1/model-router/decision/{decision_id}", dependencies=[Depends(require_admin)])
def model_router_get_endpoint(decision_id: str, include_mission: bool = False):
    decision = get_model_router_decision(decision_id, include_events=True)
    if decision is None:
        raise HTTPException(status_code=404, detail="Model router decision not found")
    if include_mission and decision.get("mission_id"):
        linked_mission = get_familyops_mission(str(decision["mission_id"]), tenant_id=str(decision.get("tenant_id") or "familyops"))
        if linked_mission is not None:
            decision["linked_mission"] = linked_mission
    return decision


@app.patch("/v1/model-router/decision/{decision_id}", dependencies=[Depends(require_admin)])
def model_router_patch_endpoint(decision_id: str, body: ModelRouterPatchRequest):
    patch = body.model_dump(exclude_unset=True)
    updated_by = str(patch.pop("updated_by", body.updated_by)).strip() or "admin"
    updated = update_model_router_decision(decision_id, patch, updated_by=updated_by)
    if updated is None:
        raise HTTPException(status_code=404, detail="Model router decision not found")
    return {"ok": True, "decision": updated}


@app.post("/v1/model-router/decision/{decision_id}/action", dependencies=[Depends(require_admin)])
def model_router_action_endpoint(decision_id: str, body: ModelRouterActionRequest):
    updated = apply_model_router_decision_action(
        decision_id,
        action=body.action,
        actor=body.actor.strip() or "admin",
        note=body.note,
        requested_model=body.requested_model,
    )
    if updated is None:
        raise HTTPException(status_code=404, detail="Model router decision not found")
    return {"ok": True, "decision": updated}


@app.get("/v1/model-router/decision/{decision_id}/events", dependencies=[Depends(require_admin)])
def model_router_decision_events_endpoint(decision_id: str, limit: int = 300):
    decision = get_model_router_decision(decision_id)
    if decision is None:
        raise HTTPException(status_code=404, detail="Model router decision not found")
    return {
        "decision_id": decision_id,
        "events": list_model_router_decision_events(decision_id, limit=limit),
    }


@app.post("/v1/build/intake", dependencies=[Depends(require_admin)])
def create_build_intake_endpoint(body: BuildIntakeCreateRequest):
    tenant_id = str(body.tenant_id or "").strip() or "familyops"
    tenant_bundle = get_tenant_policy_bundle(tenant_id)
    if tenant_bundle is None:
        raise HTTPException(status_code=404, detail="Tenant not found")
    if tenant_bundle["status"] != "active":
        raise HTTPException(status_code=403, detail="Tenant is not active")
    if not body.goal.strip():
        raise HTTPException(status_code=400, detail="goal is required")

    request = create_build_request(
        tenant_id=tenant_id,
        goal=body.goal,
        scope_summary=body.scope_summary,
        constraints_json=body.constraints_json or {},
        requested_model_lane=body.requested_model_lane,
        sensitive_change=body.sensitive_change,
        desired_proof=body.desired_proof,
        created_by=body.created_by.strip() or "admin",
    )
    return {"ok": True, "request": request}


@app.get("/v1/build/intake", dependencies=[Depends(require_admin)])
def list_build_intake_endpoint(
    tenant_id: str = "familyops",
    stage: str | None = None,
    limit: int = 50,
    offset: int = 0,
):
    effective_tenant = str(tenant_id or "").strip() or "familyops"
    tenant_bundle = get_tenant_policy_bundle(effective_tenant)
    if tenant_bundle is None:
        raise HTTPException(status_code=404, detail="Tenant not found")
    return list_build_requests(
        tenant_id=effective_tenant,
        stage=stage,
        limit=limit,
        offset=offset,
    )


@app.get("/v1/build/intake/{build_request_id}", dependencies=[Depends(require_admin)])
def get_build_intake_endpoint(build_request_id: str, include_timeline: bool = True):
    request = get_build_request(build_request_id, include_timeline=include_timeline)
    if request is None:
        raise HTTPException(status_code=404, detail="Build request not found")
    return request


@app.post("/v1/build/intake/{build_request_id}/branch", dependencies=[Depends(require_admin)])
def build_intake_create_branch_endpoint(build_request_id: str, body: BuildBranchCreateRequest):
    request = create_branch_record(
        build_request_id,
        actor=body.actor.strip() or "admin",
        source_branch=body.source_branch,
        branch_name=body.branch_name,
    )
    if request is None:
        raise HTTPException(status_code=404, detail="Build request not found")
    return {"ok": True, "request": request}


@app.post("/v1/build/intake/{build_request_id}/route", dependencies=[Depends(require_admin)])
def build_intake_link_route_endpoint(build_request_id: str, body: BuildRouteLinkRequest):
    try:
        request = link_router_decision_to_build_request(
            build_request_id,
            decision_id=body.decision_id.strip(),
            actor=body.actor.strip() or "admin",
        )
    except KeyError:
        raise HTTPException(status_code=404, detail="Model router decision not found")
    if request is None:
        raise HTTPException(status_code=404, detail="Build request not found")
    return {"ok": True, "request": request}


@app.post("/v1/build/intake/{build_request_id}/stage", dependencies=[Depends(require_admin)])
def build_intake_stage_endpoint(build_request_id: str, body: BuildStageUpdateRequest):
    request = transition_build_stage(
        build_request_id,
        stage=body.stage,
        actor=body.actor.strip() or "admin",
        detail=body.detail,
        metadata=body.metadata or {},
    )
    if request is None:
        raise HTTPException(status_code=404, detail="Build request not found")
    return {"ok": True, "request": request}


@app.post("/v1/build/intake/{build_request_id}/pr-draft", dependencies=[Depends(require_admin)])
def build_intake_pr_draft_endpoint(build_request_id: str, body: BuildPrDraftRequest):
    if not body.pr_url.strip():
        raise HTTPException(status_code=400, detail="pr_url is required")
    request = save_pr_draft_metadata(
        build_request_id,
        actor=body.actor.strip() or "admin",
        pr_url=body.pr_url,
        pr_number=body.pr_number,
        proof_summary=body.proof_summary,
        test_summary=body.test_summary,
        files_changed_summary=body.files_changed_summary,
        stage=body.stage,
    )
    if request is None:
        raise HTTPException(status_code=404, detail="Build request not found")
    return {"ok": True, "request": request}


@app.post("/v1/build/intake/{build_request_id}/execution/start", dependencies=[Depends(require_admin)])
def build_intake_execution_start_endpoint(build_request_id: str, body: BuildExecutionStartRequest):
    request = start_build_execution_run(
        build_request_id,
        actor=body.actor.strip() or "admin",
        command_class=body.command_class,
        target_scope=body.target_scope,
        summary=body.summary,
        router_decision_id=body.router_decision_id,
        mission_id=body.mission_id,
    )
    if request is None:
        raise HTTPException(status_code=404, detail="Build request not found")
    return {"ok": True, "request": request}


@app.post("/v1/build/intake/{build_request_id}/execution/{run_id}/complete", dependencies=[Depends(require_admin)])
def build_intake_execution_complete_endpoint(
    build_request_id: str,
    run_id: str,
    body: BuildExecutionCompleteRequest,
):
    try:
        request = complete_build_execution_run(
            build_request_id,
            run_id=run_id,
            actor=body.actor.strip() or "admin",
            status=body.status,
            summary=body.summary,
            lint_build_summary=body.lint_build_summary,
            test_summary=body.test_summary,
            changed_files_summary=body.changed_files_summary,
            execution_output_excerpt=body.execution_output_excerpt,
            proof_status=body.proof_status,
            request_verification=body.request_verification,
            verification_required=body.verification_required,
            failure_note=body.failure_note,
            rollback_note=body.rollback_note,
        )
    except KeyError:
        raise HTTPException(status_code=404, detail="Execution run not found")
    if request is None:
        raise HTTPException(status_code=404, detail="Build request not found")
    return {"ok": True, "request": request}


@app.post("/v1/build/intake/{build_request_id}/verification", dependencies=[Depends(require_admin)])
def build_intake_verification_endpoint(build_request_id: str, body: BuildVerificationRequest):
    request = set_build_verification_state(
        build_request_id,
        actor=body.actor.strip() or "admin",
        verification_state=body.verification_state,
        detail=body.detail,
        verification_required=body.verification_required,
    )
    if request is None:
        raise HTTPException(status_code=404, detail="Build request not found")
    return {"ok": True, "request": request}


@app.get("/v1/ghl/oauth/start")
def ghl_oauth_start(tenant_id: str):
    tenant_bundle = get_tenant_policy_bundle(tenant_id)
    if tenant_bundle is None:
        raise HTTPException(status_code=404, detail="Tenant not found")
    if tenant_bundle["status"] != "active":
        raise HTTPException(status_code=403, detail="Tenant is not active")

    client_id = required_env("GHL_CLIENT_ID")
    redirect_uri = required_env("GHL_REDIRECT_URI")
    auth_base = os.getenv("GHL_AUTH_URL", DEFAULT_GHL_AUTH_URL).strip() or DEFAULT_GHL_AUTH_URL
    scopes = os.getenv("GHL_SCOPES", DEFAULT_GHL_SCOPES).strip() or DEFAULT_GHL_SCOPES
    query_params = {
        "response_type": "code",
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "scope": scopes,
        "state": tenant_id,
    }
    auth_url = f"{auth_base}?{urlencode(query_params)}"
    return {"auth_url": auth_url}


@app.post("/v1/ghl/oauth/callback")
def ghl_oauth_callback(req: GhlOAuthCallbackRequest):
    if not req.code or not req.tenant_id:
        raise HTTPException(status_code=400, detail="Missing code or tenant_id")

    tenant_bundle = get_tenant_policy_bundle(req.tenant_id)
    if tenant_bundle is None:
        raise HTTPException(status_code=404, detail="Tenant not found")
    if tenant_bundle["status"] != "active":
        raise HTTPException(status_code=403, detail="Tenant is not active")

    client_id = required_env("GHL_CLIENT_ID")
    client_secret = required_env("GHL_CLIENT_SECRET")
    redirect_uri = required_env("GHL_REDIRECT_URI")
    token_url = required_env("GHL_TOKEN_URL")

    try:
        with httpx.Client(timeout=float(os.getenv("GHL_TOKEN_TIMEOUT_SEC", "20"))) as client:
            response = client.post(
                token_url,
                data={
                    "grant_type": "authorization_code",
                    "client_id": client_id,
                    "client_secret": client_secret,
                    "code": req.code,
                    "redirect_uri": redirect_uri,
                },
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"GHL token exchange failed: {exc}") from exc

    if response.status_code >= 400:
        raise HTTPException(
            status_code=502,
            detail=f"GHL token exchange error {response.status_code}: {response.text[:240]}",
        )

    try:
        token_data = response.json()
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail="GHL token response was not valid JSON") from exc

    access_token = str(token_data.get("access_token", "")).strip()
    refresh_token = str(token_data.get("refresh_token", "")).strip()
    if not access_token or not refresh_token:
        raise HTTPException(status_code=502, detail="GHL token response missing access/refresh token")

    expires_in = token_data.get("expires_in", 3600)
    try:
        expires_in_sec = max(int(expires_in), 0)
    except (TypeError, ValueError):
        expires_in_sec = 3600
    expires_at = datetime.now(timezone.utc) + timedelta(seconds=expires_in_sec)
    raw_location_id = req.location_id or token_data.get("locationId") or token_data.get("location_id")
    location_id = str(raw_location_id).strip() if raw_location_id else ""
    if not location_id:
        raise HTTPException(status_code=400, detail="location_id is required for callback")
    upsert_ghl_connection(
        tenant_id=req.tenant_id,
        location_id=location_id,
        access_token=access_token,
        refresh_token=refresh_token,
        expires_at=expires_at,
    )
    return {"ok": True, "tenant_id": req.tenant_id, "location_id": location_id}


@app.get("/v1/ghl/oauth/status")
def ghl_oauth_status(tenant_id: str):
    tenant_bundle = get_tenant_policy_bundle(tenant_id)
    if tenant_bundle is None:
        raise HTTPException(status_code=404, detail="Tenant not found")
    connections = list_ghl_connections(tenant_id)
    if not connections:
        return {"ok": True, "tenant_id": tenant_id, "connected": False}
    return {
        "ok": True,
        "tenant_id": tenant_id,
        "connected": True,
        "connections": [
            {
                "location_id": conn["location_id"],
                "status": conn["status"],
                "expires_at": conn["expires_at"],
            }
            for conn in connections
        ],
    }


@app.get("/v1/ghl/connections", dependencies=[Depends(require_admin)])
def ghl_connections(tenant_id: str):
    tenant_bundle = get_tenant_policy_bundle(tenant_id)
    if tenant_bundle is None:
        raise HTTPException(status_code=404, detail="Tenant not found")
    connections = list_ghl_connections(tenant_id)
    return {
        "tenant_id": tenant_id,
        "connections": [
            {
                "location_id": conn["location_id"],
                "status": conn["status"],
                "expires_at": conn["expires_at"],
                "created_at": conn["created_at"],
                "updated_at": conn["updated_at"],
            }
            for conn in connections
        ],
    }


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


@app.get("/v1/admin/brands/{tenant_id}", dependencies=[Depends(require_admin)])
def admin_list_brands(tenant_id: str):
    tenant_bundle = get_tenant_policy_bundle(tenant_id)
    if tenant_bundle is None:
        raise HTTPException(status_code=404, detail="Tenant not found")
    return {"tenant_id": tenant_id, "brands": list_brands(tenant_id)}


@app.put("/v1/admin/brand/{tenant_id}/{brand_id}", dependencies=[Depends(require_admin)])
def admin_update_brand(tenant_id: str, brand_id: str, payload: AdminBrandUpdateRequest):
    tenant_bundle = get_tenant_policy_bundle(tenant_id)
    if tenant_bundle is None:
        raise HTTPException(status_code=404, detail="Tenant not found")

    existing = get_brand(tenant_id, brand_id)
    if existing is None:
        raise HTTPException(status_code=404, detail="Brand not found")

    normalized_location_id = (payload.ghl_location_id or "").strip() or None
    normalized_platforms = [p.strip() for p in payload.default_platforms if isinstance(p, str) and p.strip()]
    normalized_status = payload.status.strip()

    if brand_id.strip().lower() == "corent":
        if normalized_location_id:
            raise HTTPException(status_code=403, detail="CoRent is inactive and cannot be assigned a location_id")
        if normalized_status == "active":
            raise HTTPException(status_code=403, detail="CoRent is inactive and cannot be activated")

    try:
        updated = update_brand_location(
            tenant_id=tenant_id,
            brand_id=brand_id,
            ghl_location_id=normalized_location_id,
            timezone=payload.timezone.strip() or "America/New_York",
            default_platforms=normalized_platforms,
            status=normalized_status,
        )
    except KeyError:
        raise HTTPException(status_code=404, detail="Brand not found")
    return {"ok": True, "brand": updated}


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
