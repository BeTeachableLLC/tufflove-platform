from __future__ import annotations

import unittest
from unittest.mock import patch

from app import handlers, runner
from app.tasks import AsyncTask


def publish_payload(**overrides):
    payload = {
        "task_id": "task-123",
        "tenant_id": "familyops",
        "user_id": "moe",
        "brand_id": "beteachable",
        "location_id": "loc-123",
        "topic": "Guardrail publish test",
        "platforms": ["fb"],
        "timezone": "America/New_York",
    }
    payload.update(overrides)
    return payload


class PublishGuardrailHandlerTests(unittest.TestCase):
    def test_publish_blocked_when_approval_missing(self):
        with patch("app.handlers.get_approval", return_value=None):
            result = handlers.handle_ghl_social_publish(publish_payload())

        self.assertFalse(result["ok"])
        self.assertEqual(result["status"], "blocked")
        self.assertEqual(result["note"], "approval_required")

    def test_publish_blocked_when_brand_is_inactive(self):
        with (
            patch("app.handlers.get_approval", return_value={"status": "approved"}),
            patch(
                "app.handlers.get_brand",
                return_value={
                    "id": "beteachable",
                    "status": "inactive",
                    "ghl_location_id": "loc-123",
                    "timezone": "America/New_York",
                    "default_platforms": ["fb"],
                },
            ),
            patch("app.handlers.get_ghl_connection") as mock_connection,
        ):
            result = handlers.handle_ghl_social_publish(publish_payload())

        self.assertFalse(result["ok"])
        self.assertEqual(result["status"], "failed")
        self.assertEqual(result["note"], "brand_inactive_or_missing")
        mock_connection.assert_not_called()

    def test_publish_blocked_when_location_mismatches_brand(self):
        with (
            patch("app.handlers.get_approval", return_value={"status": "approved"}),
            patch(
                "app.handlers.get_brand",
                return_value={
                    "id": "beteachable",
                    "status": "active",
                    "ghl_location_id": "loc-configured",
                    "timezone": "America/New_York",
                    "default_platforms": ["fb"],
                },
            ),
            patch("app.handlers.get_ghl_connection") as mock_connection,
        ):
            result = handlers.handle_ghl_social_publish(publish_payload(location_id="loc-payload"))

        self.assertFalse(result["ok"])
        self.assertEqual(result["status"], "failed")
        self.assertEqual(result["note"], "brand_location_mismatch")
        self.assertEqual(result["expected_location_id"], "loc-configured")
        mock_connection.assert_not_called()

    def test_publish_blocked_when_no_connection_exists(self):
        with (
            patch("app.handlers.get_approval", return_value={"status": "approved"}),
            patch(
                "app.handlers.get_brand",
                return_value={
                    "id": "beteachable",
                    "status": "active",
                    "ghl_location_id": "loc-123",
                    "timezone": "America/New_York",
                    "default_platforms": ["fb"],
                },
            ),
            patch("app.handlers.get_ghl_connection", return_value=None),
        ):
            result = handlers.handle_ghl_social_publish(publish_payload())

        self.assertFalse(result["ok"])
        self.assertEqual(result["status"], "failed")
        self.assertEqual(result["note"], "missing_ghl_connection")

    def test_publish_returns_would_publish_when_all_checks_pass(self):
        with (
            patch("app.handlers.get_approval", return_value={"status": "approved"}),
            patch(
                "app.handlers.get_brand",
                return_value={
                    "id": "beteachable",
                    "status": "active",
                    "ghl_location_id": "loc-123",
                    "timezone": "America/New_York",
                    "default_platforms": ["fb", "ig"],
                },
            ),
            patch("app.handlers.get_ghl_connection", return_value={"status": "active"}),
        ):
            result = handlers.handle_ghl_social_publish(publish_payload())

        self.assertTrue(result["ok"])
        self.assertEqual(result["status"], "would_publish")
        self.assertEqual(result["note"], "ghl_dry_run")
        self.assertEqual(result["brand_id"], "beteachable")
        self.assertEqual(result["location_id"], "loc-123")
        self.assertTrue(result["payload_to_send"]["dry_run"])


class PublishGuardrailRunnerTests(unittest.TestCase):
    def test_blocked_publish_is_requeued(self):
        task = AsyncTask(
            tenant_id="familyops",
            user_id="moe",
            task_type="ghl.social.publish",
            payload={"brand_id": "beteachable", "location_id": "loc-123", "topic": "Requeue test"},
            task_id="task-requeue-1",
        )
        raw_task = task.model_dump(mode="json")

        with (
            patch("app.handlers.get_approval", return_value=None),
            patch("app.runner.dequeue", return_value=raw_task),
            patch("app.runner.requeue") as mock_requeue,
            patch("app.runner._safe_upsert_task_log") as mock_upsert,
        ):
            result = runner.run_once(block_seconds=0)

        self.assertFalse(result["ok"])
        self.assertEqual(result["status"], "blocked")
        self.assertEqual(result["task_id"], "task-requeue-1")
        mock_requeue.assert_called_once()
        requeued = mock_requeue.call_args.args[0]
        self.assertEqual(requeued["task_id"], "task-requeue-1")
        self.assertEqual(requeued["task_type"], "ghl.social.publish")

        self.assertEqual(mock_upsert.call_count, 2)
        _, running_kwargs = mock_upsert.call_args_list[0]
        self.assertEqual(running_kwargs["status"], "running")
        _, blocked_kwargs = mock_upsert.call_args_list[1]
        self.assertEqual(blocked_kwargs["status"], "blocked")
        self.assertEqual(blocked_kwargs["error"], "approval_required")


if __name__ == "__main__":
    unittest.main(verbosity=2)
