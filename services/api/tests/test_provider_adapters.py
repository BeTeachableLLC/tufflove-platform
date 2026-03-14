from __future__ import annotations

import unittest
from unittest.mock import Mock, patch

from app import provider_adapter_service


class ProviderAdapterRoutingTests(unittest.TestCase):
    def test_provider_status_supports_primary_openclaw_enabled_flag(self):
        with patch(
            "app.provider_adapter_service.os.getenv",
            side_effect=lambda name, default=None: {
                "OPENAI_API_KEY": "openai-token",
                "ANTHROPIC_API_KEY": "anthropic-token",
                "GEMINI_API_KEY": "gemini-token",
                "OPENCLAW_API_URL": "http://openclaw.local",
                "PROVIDER_OPENCLAW_ENABLED": "false",
            }.get(name, default),
        ):
            statuses = provider_adapter_service.list_provider_statuses()

        self.assertFalse(statuses["openclaw"]["enabled"])
        self.assertTrue(statuses["openclaw"]["configured"])
        self.assertFalse(statuses["openclaw"]["available"])

    def test_resolve_default_lanes(self):
        with patch(
            "app.provider_adapter_service.list_provider_statuses",
            return_value={
                "openai": {"available": True},
                "claude": {"available": True},
                "gemini": {"available": True},
                "openclaw": {"available": True},
            },
        ):
            implement = provider_adapter_service.resolve_provider_for_task(task_class="implement", requested_lane=None)
            debug = provider_adapter_service.resolve_provider_for_task(task_class="debug", requested_lane=None)
            review = provider_adapter_service.resolve_provider_for_task(task_class="review", requested_lane=None)
            verify = provider_adapter_service.resolve_provider_for_task(task_class="verify", requested_lane=None)

        self.assertEqual(implement["provider"], "openai")
        self.assertEqual(implement["lane"], "codex")
        self.assertEqual(debug["provider"], "claude")
        self.assertEqual(review["provider"], "gemini")
        self.assertEqual(verify["provider"], "openclaw")

    def test_non_verification_fallback_allowed(self):
        with patch(
            "app.provider_adapter_service.list_provider_statuses",
            return_value={
                "openai": {"available": False},
                "claude": {"available": True},
                "gemini": {"available": True},
                "openclaw": {"available": True},
            },
        ):
            resolved = provider_adapter_service.resolve_provider_for_task(task_class="implement", requested_lane="codex")

        self.assertEqual(resolved["provider"], "claude")
        self.assertTrue(resolved["fallback_used"])

    def test_verify_lane_fails_safe_when_openclaw_unavailable(self):
        with patch(
            "app.provider_adapter_service.list_provider_statuses",
            return_value={
                "openai": {"available": True},
                "claude": {"available": True},
                "gemini": {"available": True},
                "openclaw": {"available": False},
            },
        ):
            with self.assertRaises(provider_adapter_service.ProviderExecutionError) as context:
                provider_adapter_service.resolve_provider_for_task(task_class="verify", requested_lane=None)
        self.assertEqual(context.exception.code, "openclaw_unavailable")


class ProviderAdapterExecutionTests(unittest.TestCase):
    def test_execute_openai_missing_key_fails_with_provider_unavailable(self):
        with (
            patch(
                "app.provider_adapter_service.resolve_provider_for_task",
                return_value={
                    "task_class": "implement",
                    "lane": "codex",
                    "provider": "openai",
                    "fallback_used": False,
                    "fallback_reason": "",
                    "required_verification_lane": "openclaw",
                },
            ),
            patch("app.provider_adapter_service.list_provider_statuses", return_value={"openai": {"model": "gpt-5-codex"}}),
            patch("app.provider_adapter_service.os.getenv", side_effect=lambda name, default=None: default),
        ):
            with self.assertRaises(provider_adapter_service.ProviderExecutionError) as context:
                provider_adapter_service.execute_provider_task(
                    task_class="implement",
                    prompt="implement this",
                    requested_lane="codex",
                )
        self.assertEqual(context.exception.code, "provider_unavailable")

    def test_execute_provider_task_requires_prompt(self):
        with self.assertRaises(provider_adapter_service.ProviderExecutionError) as context:
            provider_adapter_service.execute_provider_task(task_class="implement", prompt="   ")
        self.assertEqual(context.exception.code, "prompt_required")

    def test_execute_openclaw_returns_normalized_shape(self):
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"text": "verification ok"}

        mock_client = Mock()
        mock_client.post.return_value = mock_response

        with (
            patch("app.provider_adapter_service.resolve_provider_for_task", return_value={"task_class": "verify", "lane": "openclaw", "provider": "openclaw", "fallback_used": False, "fallback_reason": "", "required_verification_lane": "openclaw"}),
            patch("app.provider_adapter_service.list_provider_statuses", return_value={"openclaw": {"model": "openclaw-verify"}}),
            patch("app.provider_adapter_service.httpx.Client") as mock_httpx_client,
            patch("app.provider_adapter_service.os.getenv") as mock_getenv,
        ):
            mock_httpx_client.return_value.__enter__.return_value = mock_client

            def fake_getenv(name: str, default: str | None = None):
                mapping = {
                    "OPENCLAW_API_URL": "http://openclaw.local",
                    "OPENCLAW_API_KEY": "token",
                }
                return mapping.get(name, default)

            mock_getenv.side_effect = fake_getenv
            result = provider_adapter_service.execute_provider_task(
                task_class="verify",
                prompt="verify this",
                requested_lane="openclaw",
            )

        self.assertEqual(result["provider"], "openclaw")
        self.assertEqual(result["lane"], "openclaw")
        self.assertEqual(result["status"], "ok")
        self.assertIn("summary", result)


if __name__ == "__main__":
    unittest.main(verbosity=2)
