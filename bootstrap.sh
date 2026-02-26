set -e

mkdir -p apps/tufflove-web apps/corent-web
mkdir -p services/api/app services/worker/app
mkdir -p packages/zeroclaw/zeroclaw
mkdir -p infra/gcp/terraform
mkdir -p .github/workflows

cat > README.md <<'MD'
# TUFF LOVE ZeroClaw Platform (Starter)

One governed agent spine powering:
- tufflove.us
- corent.ai
- family ops (GHL social automation)

Run local:
- docker compose up -d
- cd services/api
- python3 -m venv .venv
- source .venv/bin/activate
- python -m pip install --upgrade pip
- python -m pip install -r requirements.txt
- python -m uvicorn app.main:app --reload --reload-dir app --reload-exclude '.venv/*' --port 8080
MD

cat > .env.example <<'ENV'
ENV=local
DATABASE_URL=postgresql+psycopg://postgres:postgres@localhost:5432/tufflove
REDIS_URL=redis://localhost:6379/0

OPENAI_API_KEY=your_key_here

AUTONOMY_LEVEL=supervised
TOOL_ALLOWLIST=db.read,db.write,ghl.read,ghl.write
MAX_TOOL_CALLS_PER_RUN=8

DEFAULT_DAILY_TOKEN_BUDGET=50000
DEFAULT_MONTHLY_DOLLAR_BUDGET=25

CLOUD_TASKS_ENABLED=false
CLOUD_TASKS_QUEUE=tufflove-default
CLOUD_TASKS_WORKER_URL=http://localhost:8081/v1/task/run
ENV

cat > docker-compose.yml <<'YML'
services:
  postgres:
    image: pgvector/pgvector:pg16
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: tufflove
    ports: ["5432:5432"]

  redis:
    image: redis:7
    ports: ["6379:6379"]
YML

# -------- ZeroClaw (guardrails library) --------
cat > packages/zeroclaw/pyproject.toml <<'TOML'
[build-system]
requires = ["setuptools>=68", "wheel"]
build-backend = "setuptools.build_meta"

[project]
name = "zeroclaw"
version = "0.1.0"
description = "ZeroClaw agent runtime (guardrails + routing + tool control)"
requires-python = ">=3.9"
dependencies = ["pydantic>=2.7", "python-dotenv>=1.0"]
TOML

cat > packages/zeroclaw/zeroclaw/__init__.py <<'PY'
from .core import (
    AutonomyLevel,
    ToolRegistry,
    ToolSpec,
    ZeroClawPolicy,
    ZeroClawRuntime,
)
PY

cat > packages/zeroclaw/zeroclaw/core.py <<'PY'
from __future__ import annotations
from dataclasses import dataclass
from enum import Enum
from typing import Any, Callable, Dict, Optional, Tuple

class AutonomyLevel(str, Enum):
    READ_ONLY = "read_only"
    SUPERVISED = "supervised"
    FULL = "full"

@dataclass
class Budget:
    daily_token_budget: int = 50_000
    monthly_dollar_budget: float = 25.0

@dataclass
class ZeroClawPolicy:
    autonomy: AutonomyLevel = AutonomyLevel.SUPERVISED
    budget: Budget = Budget()
    tool_allowlist: Tuple[str, ...] = ("db.read", "db.write", "ghl.read", "ghl.write")
    max_tool_calls_per_run: int = 8

@dataclass
class ToolSpec:
    name: str
    handler: Callable[[Dict[str, Any]], Dict[str, Any]]
    description: str = ""
    safe_by_default: bool = True

class ToolRegistry:
    def __init__(self) -> None:
        self._tools: Dict[str, ToolSpec] = {}

    def register(self, tool: ToolSpec) -> None:
        if tool.name in self._tools:
            raise ValueError(f"Tool already registered: {tool.name}")
        self._tools[tool.name] = tool

    def allowed(self, policy: ZeroClawPolicy) -> Dict[str, ToolSpec]:
        return {k: v for k, v in self._tools.items() if k in policy.tool_allowlist}

class ModelRouter:
    def choose(self, message: str) -> str:
        m = message.lower()
        if any(x in m for x in ("plan", "strategy", "multi-step", "research", "analyze", "build", "architecture")):
            return "reasoning"
        return "cheap"

class ZeroClawRuntime:
    def __init__(self, policy: ZeroClawPolicy, tools: ToolRegistry, router: Optional[ModelRouter] = None) -> None:
        self.policy = policy
        self.tools = tools
        self.router = router or ModelRouter()

    def run(self, *, tenant_id: str, user_id: str, message: str) -> Dict[str, Any]:
        model = self.router.choose(message)
        allowed_tools = {} if self.policy.autonomy == AutonomyLevel.READ_ONLY else self.tools.allowed(self.policy)
        return {
            "tenant_id": tenant_id,
            "user_id": user_id,
            "model_route": model,
            "autonomy": self.policy.autonomy.value,
            "allowed_tools": sorted(list(allowed_tools.keys())),
            "answer": f"[ZeroClaw stub] Received: {message}",
        }
PY

# -------- API Service --------
cat > services/api/requirements.txt <<'REQ'
fastapi==0.115.5
uvicorn[standard]==0.30.6
pydantic==2.8.2
python-dotenv==1.0.1
psycopg[binary]==3.2.13
redis==5.0.8
../../packages/zeroclaw
REQ

cat > services/api/app/main.py <<'PY'
from __future__ import annotations
import os
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from dotenv import load_dotenv
from zeroclaw import ZeroClawRuntime, ZeroClawPolicy, ToolRegistry, ToolSpec, AutonomyLevel

load_dotenv()
app = FastAPI(title="TUFF LOVE Agent API", version="0.1.0")

class ChatRequest(BaseModel):
    tenant_id: str
    user_id: str
    message: str

def tool_db_read(payload): return {"ok": True, "data": "db.read stub", "payload": payload}
def tool_db_write(payload): return {"ok": True, "data": "db.write stub", "payload": payload}
def tool_ghl_read(payload): return {"ok": True, "data": "ghl.read stub", "payload": payload}
def tool_ghl_write(payload): return {"ok": True, "data": "ghl.write stub", "payload": payload}

def build_runtime() -> ZeroClawRuntime:
    policy = ZeroClawPolicy(autonomy=AutonomyLevel(os.getenv("AUTONOMY_LEVEL", "supervised")))
    policy.budget.daily_token_budget = int(os.getenv("DEFAULT_DAILY_TOKEN_BUDGET", "50000"))
    policy.budget.monthly_dollar_budget = float(os.getenv("DEFAULT_MONTHLY_DOLLAR_BUDGET", "25"))
    allowlist = os.getenv("TOOL_ALLOWLIST", "db.read,db.write,ghl.read,ghl.write").split(",")
    policy.tool_allowlist = tuple(x.strip() for x in allowlist if x.strip())
    policy.max_tool_calls_per_run = int(os.getenv("MAX_TOOL_CALLS_PER_RUN", "8"))

    tools = ToolRegistry()
    tools.register(ToolSpec("db.read", tool_db_read, "Read data"))
    tools.register(ToolSpec("db.write", tool_db_write, "Write data"))
    tools.register(ToolSpec("ghl.read", tool_ghl_read, "Read from GHL"))
    tools.register(ToolSpec("ghl.write", tool_ghl_write, "Write to GHL"))
    return ZeroClawRuntime(policy=policy, tools=tools)

runtime = build_runtime()

@app.get("/healthz")
def healthz(): return {"ok": True, "service": "api"}

@app.post("/v1/chat")
def chat(req: ChatRequest):
    if not req.tenant_id or not req.user_id or not req.message:
        raise HTTPException(status_code=400, detail="Missing required fields")
    # TODO: verify auth JWT + tenant entitlement
    return runtime.run(tenant_id=req.tenant_id, user_id=req.user_id, message=req.message)
PY

# -------- Worker Service --------
cat > services/worker/requirements.txt <<'REQ'
fastapi==0.115.5
uvicorn[standard]==0.30.6
pydantic==2.8.2
python-dotenv==1.0.1
requests==2.32.3
REQ

cat > services/worker/app/main.py <<'PY'
from __future__ import annotations
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from datetime import datetime

app = FastAPI(title="TUFF LOVE Worker", version="0.1.0")

class TaskRequest(BaseModel):
    tenant_id: str
    user_id: str
    task_type: str
    payload: dict

@app.get("/healthz")
def healthz(): return {"ok": True, "service": "worker"}

@app.post("/v1/task/run")
def run_task(req: TaskRequest):
    if not req.tenant_id or not req.user_id or not req.task_type:
        raise HTTPException(status_code=400, detail="Missing required fields")
    # TODO: verify internal caller token (Cloud Tasks OIDC)
    # TODO: implement actual tasks: GHL actions, embedding ingestion, browsing jobs, etc.
    return {
        "ok": True,
        "received_at": datetime.utcnow().isoformat() + "Z",
        "tenant_id": req.tenant_id,
        "user_id": req.user_id,
        "task_type": req.task_type,
        "status": "stub-complete",
    }
PY

cat > MIGRATION.md <<'MD'
# Migration (Current Projects -> ZeroClaw Spine)

We move everything to one governed backbone:
- API (Cloud Run)
- Worker (Cloud Run)
- Postgres+pgvector (Cloud SQL)
- Cloud Tasks (async jobs)
- Secret Manager (all keys)
- One tenant model: tufflove / corent / familyops

Next steps:
1) Inventory each project: repo, hosting, env vars, integrations, DBs
2) Containerize anything not already containerized
3) Migrate DB -> Cloud SQL (create pgvector extension)
4) Cutover to API endpoints
5) Enforce budgets + tool allowlists per tenant
MD

cat > apps/tufflove-web/README.md <<'MD'
Drop your TUFF LOVE frontend here (Next.js recommended).
MD

cat > apps/corent-web/README.md <<'MD'
Drop your CoRent.AI frontend here (Next.js recommended).
MD

echo "✅ Scaffold created."
