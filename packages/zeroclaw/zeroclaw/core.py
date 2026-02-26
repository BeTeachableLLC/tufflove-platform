from __future__ import annotations
from dataclasses import dataclass, field
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
    budget: Budget = field(default_factory=Budget)
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
