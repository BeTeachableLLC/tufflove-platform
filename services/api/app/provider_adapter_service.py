from __future__ import annotations

from importlib import metadata as importlib_metadata
import os
import re
from typing import Any
from urllib.parse import urlparse

import httpx

TASK_CLASSES = {"implement", "debug", "review", "verify"}
LANES = {"codex", "claude", "gemini", "openclaw"}
DEFAULT_LANE_BY_TASK_CLASS = {
    "implement": "codex",
    "debug": "claude",
    "review": "gemini",
    "verify": "openclaw",
}
PROVIDER_BY_LANE = {
    "codex": "openai",
    "claude": "claude",
    "gemini": "gemini",
    "openclaw": "openclaw",
}
EXPECTED_GITHUB_REPO = "BeTeachableLLC/tufflove-platform"
REQUIRED_ACCOUNTS = {"github", "zeroclaw", "openclaw"}

SENSITIVE_PATTERNS = [
    re.compile(r"(?i)(access[_-]?token\s*[=:]\s*)([^\s,;]+)"),
    re.compile(r"(?i)(refresh[_-]?token\s*[=:]\s*)([^\s,;]+)"),
    re.compile(r"(?i)(api[_-]?key\s*[=:]\s*)([^\s,;]+)"),
    re.compile(r"(?i)(authorization\s*[=:]\s*)([^\s,;]+)"),
    re.compile(r"(?i)(password\s*[=:]\s*)([^\s,;]+)"),
    re.compile(r"(?i)(secret\s*[=:]\s*)([^\s,;]+)"),
]


class ProviderExecutionError(ValueError):
    def __init__(self, message: str, *, code: str):
        super().__init__(message)
        self.code = code


def _as_bool_env(name: str, default: bool = True) -> bool:
    raw = str(os.getenv(name, "true" if default else "false")).strip().lower()
    return raw in {"1", "true", "yes", "on"}


def _as_bool_env_alias(names: list[str], default: bool = True) -> bool:
    for name in names:
        raw = os.getenv(name)
        if raw is None:
            continue
        return str(raw).strip().lower() in {"1", "true", "yes", "on"}
    return default


def _sanitize_text(value: str | None, *, max_len: int = 5000) -> str:
    raw = str(value or "")
    if not raw:
        return ""
    redacted = raw
    for pattern in SENSITIVE_PATTERNS:
        redacted = pattern.sub(r"\1[REDACTED]", redacted)
    if len(redacted) > max_len:
        return redacted[:max_len]
    return redacted


def _safe_endpoint_marker(raw: str | None) -> str:
    value = str(raw or "").strip()
    if not value:
        return ""
    try:
        parsed = urlparse(value)
    except ValueError:
        return value
    if parsed.scheme and parsed.netloc:
        return f"{parsed.scheme}://{parsed.netloc}"
    if parsed.netloc:
        return parsed.netloc
    if parsed.path and "/" not in parsed.path:
        return parsed.path
    return value


def _coalesce_marker(*values: str | None) -> str:
    for value in values:
        candidate = str(value or "").strip()
        if candidate:
            return candidate
    return ""


def _normalize_repo(value: str | None) -> str:
    raw = str(value or "").strip()
    if not raw:
        return ""
    return raw.strip("/").replace(".git", "")


def _resolve_zeroclaw_runtime_marker() -> tuple[str, str]:
    enabled = _as_bool_env("PROVIDER_ZEROCLAW_ENABLED", True)
    if not enabled:
        return "disabled", "ZeroClaw runtime disabled by config"
    try:
        version = importlib_metadata.version("zeroclaw")
    except importlib_metadata.PackageNotFoundError:
        return "missing", "zeroclaw package is not installed"
    except Exception as error:  # pragma: no cover - defensive branch
        return "error", f"unable to resolve zeroclaw package metadata: {error}"
    return f"zeroclaw:{version}", ""


def _normalize_task_class(task_class: str) -> str:
    candidate = str(task_class or "implement").strip().lower()
    if candidate not in TASK_CLASSES:
        return "implement"
    return candidate


def _normalize_lane(raw: str | None, *, default: str) -> str:
    candidate = str(raw or "").strip().lower()
    if candidate not in LANES:
        return default
    return candidate


def _provider_status(
    *,
    name: str,
    enabled: bool,
    configured: bool,
    model: str,
) -> dict[str, Any]:
    return {
        "provider": name,
        "enabled": bool(enabled),
        "configured": bool(configured),
        "available": bool(enabled and configured),
        "model": model,
    }


def list_provider_statuses() -> dict[str, dict[str, Any]]:
    openai_key = str(os.getenv("OPENAI_API_KEY", "")).strip()
    claude_key = str(os.getenv("ANTHROPIC_API_KEY", "")).strip()
    gemini_key = str(os.getenv("GEMINI_API_KEY", "")).strip() or str(os.getenv("GOOGLE_API_KEY", "")).strip()
    openclaw_url = str(os.getenv("OPENCLAW_API_URL", "")).strip()

    return {
        "openai": _provider_status(
            name="openai",
            enabled=_as_bool_env("PROVIDER_OPENAI_ENABLED", True),
            configured=bool(openai_key),
            model=str(os.getenv("OPENAI_MODEL", "gpt-5-codex")).strip() or "gpt-5-codex",
        ),
        "claude": _provider_status(
            name="claude",
            enabled=_as_bool_env("PROVIDER_CLAUDE_ENABLED", True),
            configured=bool(claude_key),
            model=str(os.getenv("CLAUDE_MODEL", "claude-3-7-sonnet-latest")).strip() or "claude-3-7-sonnet-latest",
        ),
        "gemini": _provider_status(
            name="gemini",
            enabled=_as_bool_env("PROVIDER_GEMINI_ENABLED", True),
            configured=bool(gemini_key),
            model=str(os.getenv("GEMINI_MODEL", "gemini-1.5-pro")).strip() or "gemini-1.5-pro",
        ),
        "openclaw": _provider_status(
            name="openclaw",
            enabled=_as_bool_env_alias(["PROVIDER_OPENCLAW_ENABLED", "PROVIDER_OPENCLOW_ENABLED"], True),
            configured=bool(openclaw_url),
            model=str(os.getenv("OPENCLAW_MODEL", "openclaw-verify")).strip() or "openclaw-verify",
        ),
    }


def collect_provider_account_verification(
    *,
    task_class: str = "implement",
    requested_lane: str | None = None,
    selected_lane: str | None = None,
    selected_provider: str | None = None,
    require_github_for_execution: bool | None = None,
) -> dict[str, Any]:
    provider_statuses = list_provider_statuses()
    normalized_task_class = _normalize_task_class(task_class)
    lane = _normalize_lane(
        selected_lane or requested_lane,
        default=DEFAULT_LANE_BY_TASK_CLASS[normalized_task_class],
    )
    provider = str(selected_provider or PROVIDER_BY_LANE.get(lane, "openai")).strip().lower() or "openai"
    if provider not in {"openai", "claude", "gemini", "openclaw"}:
        provider = "openai"

    expected_repo = _normalize_repo(os.getenv("GITHUB_EXPECTED_REPO", EXPECTED_GITHUB_REPO)) or EXPECTED_GITHUB_REPO
    configured_repo = _normalize_repo(os.getenv("GITHUB_REPO", "")) or expected_repo
    github_repo_match = configured_repo.lower() == expected_repo.lower()
    github_token = str(os.getenv("GITHUB_TOKEN", "") or os.getenv("GH_TOKEN", "")).strip()
    github_token_present = bool(github_token)
    github_enabled = _as_bool_env("PROVIDER_GITHUB_ENABLED", True)
    github_status = "passing"
    github_reason = ""
    if not github_enabled:
        github_status = "failing"
        github_reason = "github provider disabled"
    elif not github_token_present:
        github_status = "failing"
        github_reason = "github token missing"
    elif not github_repo_match:
        github_status = "failing"
        github_reason = "configured repo does not match expected repo"

    zeroclaw_enabled = _as_bool_env("PROVIDER_ZEROCLAW_ENABLED", True)
    zeroclaw_marker, zeroclaw_reason = _resolve_zeroclaw_runtime_marker()
    zeroclaw_status = "passing"
    if not zeroclaw_enabled or zeroclaw_marker in {"disabled", "missing", "error"}:
        zeroclaw_status = "failing"

    openai_status = provider_statuses.get("openai") or {}
    claude_status = provider_statuses.get("claude") or {}
    gemini_status = provider_statuses.get("gemini") or {}
    openclaw_status = provider_statuses.get("openclaw") or {}

    accounts: dict[str, dict[str, Any]] = {
        "github": {
            "provider": "github",
            "required": True,
            "enabled": github_enabled,
            "credential_present": github_token_present,
            "endpoint": _safe_endpoint_marker(os.getenv("GITHUB_API_URL", "https://api.github.com")),
            "identity_marker": configured_repo,
            "org_project_marker": configured_repo,
            "verification_status": github_status,
            "verification_passed": github_status == "passing",
            "reason": github_reason,
            "mismatch": not github_repo_match,
            "expected_repo": expected_repo,
            "configured_repo": configured_repo,
        },
        "openai": {
            "provider": "openai",
            "required": False,
            "enabled": bool(openai_status.get("enabled")),
            "credential_present": bool(openai_status.get("configured")),
            "endpoint": _safe_endpoint_marker(os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1")),
            "identity_marker": _coalesce_marker(os.getenv("OPENAI_PROJECT_ID"), os.getenv("OPENAI_ORG_ID"), str(openai_status.get("model") or "")),
            "org_project_marker": _coalesce_marker(os.getenv("OPENAI_PROJECT_ID"), os.getenv("OPENAI_ORG_ID")),
            "verification_status": "passing" if bool(openai_status.get("available")) else ("warning" if not bool(openai_status.get("enabled")) else "failing"),
            "verification_passed": bool(openai_status.get("available")) or not bool(openai_status.get("enabled")),
            "reason": "" if bool(openai_status.get("available")) else ("provider disabled" if not bool(openai_status.get("enabled")) else "credential missing"),
            "mismatch": False,
        },
        "claude": {
            "provider": "claude",
            "required": False,
            "enabled": bool(claude_status.get("enabled")),
            "credential_present": bool(claude_status.get("configured")),
            "endpoint": _safe_endpoint_marker(os.getenv("ANTHROPIC_BASE_URL", "https://api.anthropic.com/v1")),
            "identity_marker": _coalesce_marker(os.getenv("ANTHROPIC_WORKSPACE_ID"), os.getenv("ANTHROPIC_ORG_ID"), str(claude_status.get("model") or "")),
            "org_project_marker": _coalesce_marker(os.getenv("ANTHROPIC_WORKSPACE_ID"), os.getenv("ANTHROPIC_ORG_ID")),
            "verification_status": "passing" if bool(claude_status.get("available")) else ("warning" if not bool(claude_status.get("enabled")) else "failing"),
            "verification_passed": bool(claude_status.get("available")) or not bool(claude_status.get("enabled")),
            "reason": "" if bool(claude_status.get("available")) else ("provider disabled" if not bool(claude_status.get("enabled")) else "credential missing"),
            "mismatch": False,
        },
        "gemini": {
            "provider": "gemini",
            "required": False,
            "enabled": bool(gemini_status.get("enabled")),
            "credential_present": bool(gemini_status.get("configured")),
            "endpoint": _safe_endpoint_marker(os.getenv("GEMINI_BASE_URL", "https://generativelanguage.googleapis.com")),
            "identity_marker": _coalesce_marker(os.getenv("GOOGLE_CLOUD_PROJECT"), os.getenv("GEMINI_PROJECT_ID"), str(gemini_status.get("model") or "")),
            "org_project_marker": _coalesce_marker(os.getenv("GOOGLE_CLOUD_PROJECT"), os.getenv("GEMINI_PROJECT_ID")),
            "verification_status": "passing" if bool(gemini_status.get("available")) else ("warning" if not bool(gemini_status.get("enabled")) else "failing"),
            "verification_passed": bool(gemini_status.get("available")) or not bool(gemini_status.get("enabled")),
            "reason": "" if bool(gemini_status.get("available")) else ("provider disabled" if not bool(gemini_status.get("enabled")) else "credential missing"),
            "mismatch": False,
        },
        "zeroclaw": {
            "provider": "zeroclaw",
            "required": True,
            "enabled": zeroclaw_enabled,
            "credential_present": True,
            "endpoint": _safe_endpoint_marker(os.getenv("ZEROCLAW_API_URL", "")),
            "identity_marker": zeroclaw_marker,
            "org_project_marker": _coalesce_marker(os.getenv("ZEROCLAW_WORKSPACE"), os.getenv("ZEROCLAW_PROJECT")),
            "verification_status": zeroclaw_status,
            "verification_passed": zeroclaw_status == "passing",
            "reason": zeroclaw_reason,
            "mismatch": False,
        },
        "openclaw": {
            "provider": "openclaw",
            "required": True,
            "enabled": bool(openclaw_status.get("enabled")),
            "credential_present": bool(openclaw_status.get("configured")),
            "endpoint": _safe_endpoint_marker(os.getenv("OPENCLAW_API_URL", "")),
            "identity_marker": _coalesce_marker(os.getenv("OPENCLAW_WORKSPACE_ID"), os.getenv("OPENCLAW_ACCOUNT_MARKER"), str(openclaw_status.get("model") or "")),
            "org_project_marker": _coalesce_marker(os.getenv("OPENCLAW_WORKSPACE_ID"), os.getenv("OPENCLAW_ACCOUNT_MARKER")),
            "verification_status": "passing" if bool(openclaw_status.get("available")) else "failing",
            "verification_passed": bool(openclaw_status.get("available")),
            "reason": "" if bool(openclaw_status.get("available")) else ("provider disabled" if not bool(openclaw_status.get("enabled")) else "endpoint missing"),
            "mismatch": False,
        },
    }

    required_accounts = sorted(REQUIRED_ACCOUNTS)
    failed_required_accounts = sorted(
        key
        for key in required_accounts
        if not bool((accounts.get(key) or {}).get("verification_passed"))
    )

    require_github = _as_bool_env("PROVIDER_REQUIRE_GITHUB_FOR_EXECUTION", True)
    if require_github_for_execution is not None:
        require_github = bool(require_github_for_execution)
    execution_required_accounts = {"zeroclaw", provider}
    if require_github:
        execution_required_accounts.add("github")
    failed_execution_accounts = sorted(
        key
        for key in execution_required_accounts
        if not bool((accounts.get(key) or {}).get("verification_passed"))
    )
    return {
        "task_class": normalized_task_class,
        "selected_lane": lane,
        "selected_provider": provider,
        "providers": provider_statuses,
        "accounts": accounts,
        "required_accounts": required_accounts,
        "execution_required_accounts": sorted(execution_required_accounts),
        "failed_required_accounts": failed_required_accounts,
        "failed_execution_accounts": failed_execution_accounts,
        "required_verification_passed": not bool(failed_required_accounts),
        "execution_ready": not bool(failed_execution_accounts),
        "github_expected_repo": expected_repo,
        "github_configured_repo": configured_repo,
        "github_repo_match": github_repo_match,
    }


def is_openclaw_available() -> bool:
    status = list_provider_statuses()["openclaw"]
    return bool(status["available"])


def resolve_provider_for_task(
    *,
    task_class: str,
    requested_lane: str | None = None,
) -> dict[str, Any]:
    normalized_task_class = _normalize_task_class(task_class)
    status = list_provider_statuses()

    default_lane = DEFAULT_LANE_BY_TASK_CLASS[normalized_task_class]
    lane = _normalize_lane(requested_lane, default=default_lane)

    if normalized_task_class == "verify":
        lane = "openclaw"
        openclaw = status["openclaw"]
        if not openclaw["available"]:
            raise ProviderExecutionError(
                "OpenClaw verification provider is unavailable",
                code="openclaw_unavailable",
            )
        return {
            "task_class": normalized_task_class,
            "lane": lane,
            "provider": "openclaw",
            "fallback_used": False,
            "fallback_reason": "",
            "required_verification_lane": "openclaw",
        }

    preferred_provider = PROVIDER_BY_LANE.get(lane, PROVIDER_BY_LANE[default_lane])
    preferred = status.get(preferred_provider, {})
    if preferred.get("available"):
        return {
            "task_class": normalized_task_class,
            "lane": lane,
            "provider": preferred_provider,
            "fallback_used": False,
            "fallback_reason": "",
            "required_verification_lane": "openclaw",
        }

    fallback_order = ["openai", "claude", "gemini"]
    for provider in fallback_order:
        if status.get(provider, {}).get("available"):
            fallback_lane = "codex" if provider == "openai" else provider
            return {
                "task_class": normalized_task_class,
                "lane": fallback_lane,
                "provider": provider,
                "fallback_used": True,
                "fallback_reason": f"{preferred_provider}_unavailable",
                "required_verification_lane": "openclaw",
            }

    raise ProviderExecutionError(
        "No enabled provider with valid credentials is available for non-verification lane",
        code="provider_unavailable",
    )


def _extract_openai_text(payload: dict[str, Any]) -> str:
    if isinstance(payload.get("output_text"), str):
        return str(payload.get("output_text") or "")
    output = payload.get("output")
    if isinstance(output, list):
        for item in output:
            if isinstance(item, dict):
                content = item.get("content")
                if isinstance(content, list):
                    for part in content:
                        if isinstance(part, dict) and isinstance(part.get("text"), str):
                            return str(part.get("text") or "")
    return ""


def _extract_claude_text(payload: dict[str, Any]) -> str:
    content = payload.get("content")
    if isinstance(content, list):
        for part in content:
            if isinstance(part, dict) and isinstance(part.get("text"), str):
                return str(part.get("text") or "")
    return ""


def _extract_gemini_text(payload: dict[str, Any]) -> str:
    candidates = payload.get("candidates")
    if isinstance(candidates, list):
        for candidate in candidates:
            if isinstance(candidate, dict):
                content = candidate.get("content")
                if isinstance(content, dict):
                    parts = content.get("parts")
                    if isinstance(parts, list):
                        for part in parts:
                            if isinstance(part, dict) and isinstance(part.get("text"), str):
                                return str(part.get("text") or "")
    return ""


def _extract_openclaw_text(payload: dict[str, Any]) -> str:
    if isinstance(payload.get("text"), str):
        return str(payload.get("text") or "")
    if isinstance(payload.get("output"), str):
        return str(payload.get("output") or "")
    result = payload.get("result")
    if isinstance(result, dict) and isinstance(result.get("text"), str):
        return str(result.get("text") or "")
    return ""


def execute_provider_task(
    *,
    task_class: str,
    prompt: str,
    requested_lane: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> dict[str, Any]:
    resolved = resolve_provider_for_task(task_class=task_class, requested_lane=requested_lane)
    provider = str(resolved["provider"])
    lane = str(resolved["lane"])
    prompt_text = str(prompt or "").strip()
    if not prompt_text:
        raise ProviderExecutionError("prompt is required", code="prompt_required")
    account_verification = collect_provider_account_verification(
        task_class=task_class,
        requested_lane=requested_lane,
        selected_lane=lane,
        selected_provider=provider,
    )
    if not bool(account_verification.get("execution_ready")):
        failed_accounts = ", ".join(account_verification.get("failed_execution_accounts") or [])
        reason = failed_accounts or "required account verification failed"
        raise ProviderExecutionError(
            f"Provider account verification failed: {reason}",
            code="account_verification_failed",
        )
    statuses = list_provider_statuses()
    provider_status = statuses[provider]
    model = str(provider_status.get("model") or "").strip()
    timeout = httpx.Timeout(30.0, connect=5.0)

    response_payload: dict[str, Any]
    try:
        with httpx.Client(timeout=timeout) as client:
            if provider == "openai":
                api_key = str(os.getenv("OPENAI_API_KEY", "")).strip()
                if not api_key:
                    raise ProviderExecutionError("OPENAI_API_KEY is missing", code="provider_unavailable")
                base_url = str(os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1")).strip().rstrip("/")
                response = client.post(
                    f"{base_url}/responses",
                    headers={"Authorization": f"Bearer {api_key}"},
                    json={"model": model, "input": prompt_text},
                )
                if response.status_code >= 400:
                    raise ProviderExecutionError(f"OpenAI request failed ({response.status_code})", code="provider_error")
                response_payload = response.json()
                output_text = _extract_openai_text(response_payload)
            elif provider == "claude":
                api_key = str(os.getenv("ANTHROPIC_API_KEY", "")).strip()
                if not api_key:
                    raise ProviderExecutionError("ANTHROPIC_API_KEY is missing", code="provider_unavailable")
                base_url = str(os.getenv("ANTHROPIC_BASE_URL", "https://api.anthropic.com/v1")).strip().rstrip("/")
                response = client.post(
                    f"{base_url}/messages",
                    headers={
                        "x-api-key": api_key,
                        "anthropic-version": "2023-06-01",
                    },
                    json={
                        "model": model,
                        "max_tokens": 1200,
                        "messages": [{"role": "user", "content": prompt_text}],
                    },
                )
                if response.status_code >= 400:
                    raise ProviderExecutionError(f"Claude request failed ({response.status_code})", code="provider_error")
                response_payload = response.json()
                output_text = _extract_claude_text(response_payload)
            elif provider == "gemini":
                api_key = str(os.getenv("GEMINI_API_KEY", "")).strip() or str(os.getenv("GOOGLE_API_KEY", "")).strip()
                if not api_key:
                    raise ProviderExecutionError("GEMINI_API_KEY/GOOGLE_API_KEY is missing", code="provider_unavailable")
                endpoint = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
                response = client.post(
                    endpoint,
                    params={"key": api_key},
                    json={"contents": [{"parts": [{"text": prompt_text}]}]},
                )
                if response.status_code >= 400:
                    raise ProviderExecutionError(f"Gemini request failed ({response.status_code})", code="provider_error")
                response_payload = response.json()
                output_text = _extract_gemini_text(response_payload)
            else:
                base_url = str(os.getenv("OPENCLAW_API_URL", "")).strip().rstrip("/")
                if not base_url:
                    raise ProviderExecutionError("OPENCLAW_API_URL is missing", code="openclaw_unavailable")
                token = str(os.getenv("OPENCLAW_API_KEY", "")).strip()
                headers: dict[str, str] = {}
                if token:
                    headers["Authorization"] = f"Bearer {token}"
                response = client.post(
                    f"{base_url}/v1/verify",
                    headers=headers,
                    json={
                        "task_class": task_class,
                        "prompt": prompt_text,
                        "metadata": metadata or {},
                    },
                )
                if response.status_code >= 400:
                    raise ProviderExecutionError(f"OpenClaw request failed ({response.status_code})", code="provider_error")
                response_payload = response.json()
                output_text = _extract_openclaw_text(response_payload)
    except ProviderExecutionError:
        raise
    except httpx.HTTPError as error:
        raise ProviderExecutionError(f"Provider call failed: {error}", code="provider_error")

    redacted_output = _sanitize_text(output_text)
    summary = redacted_output[:400]
    return {
        "task_class": str(resolved["task_class"]),
        "lane": lane,
        "provider": provider,
        "model": model,
        "status": "ok",
        "output_text": redacted_output,
        "summary": summary,
        "usage": {
            "input_tokens": None,
            "output_tokens": None,
            "total_tokens": None,
        },
        "fallback_used": bool(resolved.get("fallback_used")),
        "fallback_reason": str(resolved.get("fallback_reason") or ""),
        "required_verification_lane": "openclaw",
        "account_verification": {
            "execution_ready": bool(account_verification.get("execution_ready")),
            "failed_execution_accounts": account_verification.get("failed_execution_accounts") or [],
            "required_verification_passed": bool(account_verification.get("required_verification_passed")),
            "failed_required_accounts": account_verification.get("failed_required_accounts") or [],
        },
    }
