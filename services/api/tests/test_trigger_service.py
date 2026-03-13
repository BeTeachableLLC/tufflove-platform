from __future__ import annotations

from datetime import datetime, timezone
import unittest
from unittest.mock import Mock, patch

from app import main, trigger_service


def sample_trigger(**overrides):
    base = {
        "id": "trigger-1",
        "tenant_id": "familyops",
        "operator_id": "scheduler",
        "task_type": "ghl.social.plan",
        "task_payload": {"topic": "Scheduled"},
        "trigger_type": "interval",
        "config_json": {"interval_seconds": 300},
        "enabled": True,
        "dedupe_key": None,
        "dedupe_window_seconds": 300,
        "last_fired_at": None,
        "next_run_at": datetime(2026, 3, 10, 12, 0, tzinfo=timezone.utc),
        "failure_count": 0,
        "last_task_id": None,
        "last_error": None,
        "created_at": datetime(2026, 3, 10, 10, 0, tzinfo=timezone.utc),
        "updated_at": datetime(2026, 3, 10, 10, 0, tzinfo=timezone.utc),
    }
    base.update(overrides)
    return base


class TriggerRegistrationTests(unittest.TestCase):
    def test_register_trigger_endpoint(self):
        req = main.TriggerRegisterRequest(
            tenant_id="familyops",
            operator_id="ops-bot",
            task_type="ghl.social.plan",
            task_payload={"topic": "Morning plan"},
            trigger_type="interval",
            config_json={"interval_seconds": 600},
            enabled=True,
        )

        with (
            patch("app.main.get_tenant_policy_bundle", return_value={"id": "familyops", "status": "active"}),
            patch("app.main.create_trigger", return_value={"id": "trigger-abc", "enabled": True}) as mock_create,
        ):
            response = main.register_trigger(req)

        self.assertTrue(response["ok"])
        self.assertEqual(response["trigger"]["id"], "trigger-abc")
        mock_create.assert_called_once()


class TriggerFireBehaviorTests(unittest.TestCase):
    def test_due_trigger_enqueue(self):
        now = datetime(2026, 3, 12, 11, 0, tzinfo=timezone.utc)
        enqueue_task_fn = Mock(return_value={"ok": True, "task_id": "task-1", "approval_required": False})

        with (
            patch("app.trigger_service.list_due_trigger_records", return_value=[sample_trigger()]),
            patch("app.trigger_service.count_recent_enqueued_events", return_value=0),
            patch("app.trigger_service.count_tenant_enqueues_for_day", return_value=0),
            patch("app.trigger_service.update_trigger_runtime_state"),
            patch("app.trigger_service.record_trigger_event"),
        ):
            result = trigger_service.run_due_triggers(
                limit=25,
                daily_cap=10,
                enqueue_task_fn=enqueue_task_fn,
                now=now,
            )

        self.assertTrue(result["ok"])
        self.assertEqual(result["due_count"], 1)
        self.assertEqual(result["enqueued_count"], 1)
        self.assertEqual(result["results"][0]["status"], "enqueued")
        enqueue_task_fn.assert_called_once()

    def test_cap_enforcement_blocks_enqueue(self):
        enqueue_task_fn = Mock()
        with (
            patch("app.trigger_service.count_recent_enqueued_events", return_value=0),
            patch("app.trigger_service.count_tenant_enqueues_for_day", return_value=3),
            patch("app.trigger_service.update_trigger_runtime_state") as mock_update,
            patch("app.trigger_service.record_trigger_event"),
        ):
            result = trigger_service.fire_trigger_record(
                sample_trigger(),
                daily_cap=3,
                enqueue_task_fn=enqueue_task_fn,
                source="scheduler",
                now=datetime(2026, 3, 12, 11, 0, tzinfo=timezone.utc),
            )

        self.assertFalse(result["ok"])
        self.assertEqual(result["status"], "cap_blocked")
        enqueue_task_fn.assert_not_called()
        mock_update.assert_called_once()

    def test_dedupe_blocks_duplicate_enqueue(self):
        enqueue_task_fn = Mock()
        with (
            patch("app.trigger_service.count_recent_enqueued_events", return_value=1),
            patch("app.trigger_service.update_trigger_runtime_state"),
            patch("app.trigger_service.record_trigger_event"),
        ):
            result = trigger_service.fire_trigger_record(
                sample_trigger(),
                daily_cap=10,
                enqueue_task_fn=enqueue_task_fn,
                source="scheduler",
                now=datetime(2026, 3, 12, 11, 0, tzinfo=timezone.utc),
            )

        self.assertFalse(result["ok"])
        self.assertEqual(result["status"], "deduped")
        enqueue_task_fn.assert_not_called()

    def test_disabled_trigger_does_not_fire(self):
        enqueue_task_fn = Mock()
        with patch("app.trigger_service.record_trigger_event"):
            result = trigger_service.fire_trigger_record(
                sample_trigger(enabled=False),
                daily_cap=10,
                enqueue_task_fn=enqueue_task_fn,
                source="scheduler",
                now=datetime(2026, 3, 12, 11, 0, tzinfo=timezone.utc),
            )

        self.assertFalse(result["ok"])
        self.assertEqual(result["status"], "disabled")
        enqueue_task_fn.assert_not_called()


class TriggerPatchEndpointTests(unittest.TestCase):
    def test_patch_endpoint_enable_disable(self):
        existing = {
            "id": "trigger-1",
            "tenant_id": "familyops",
            "task_type": "ghl.social.plan",
            "task_payload": {"topic": "x"},
            "trigger_type": "interval",
            "enabled": True,
        }
        updated = {**existing, "enabled": False}

        with (
            patch("app.main.get_trigger", return_value=existing),
            patch("app.main.get_tenant_policy_bundle", return_value={"id": "familyops", "status": "active"}),
            patch("app.main.apply_trigger_patch", return_value=updated),
        ):
            result = main.patch_trigger_endpoint("trigger-1", main.TriggerPatchRequest(enabled=False))

        self.assertTrue(result["ok"])
        self.assertEqual(result["trigger"]["enabled"], False)


if __name__ == "__main__":
    unittest.main(verbosity=2)
