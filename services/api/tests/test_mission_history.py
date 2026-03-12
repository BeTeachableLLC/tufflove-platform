from __future__ import annotations

from datetime import datetime, timezone
import unittest
from unittest.mock import patch

from app import main, operator_service


class MissionHistoryEndpointTests(unittest.TestCase):
    def test_list_missions_retrieval(self):
        missions = [
            {
                "id": "mission-1",
                "tenant_id": "familyops",
                "operator_id": "ops-daily",
                "operator_version_id": "ver-1",
                "status": "completed",
            }
        ]
        with (
            patch("app.main.get_tenant_policy_bundle", return_value={"id": "familyops", "status": "active"}),
            patch(
                "app.main.list_operator_missions",
                return_value={"missions": missions, "total": 1, "limit": 25, "offset": 0},
            ) as mock_list,
        ):
            response = main.list_operator_missions_endpoint(tenant_id="familyops", limit=25, offset=0)

        self.assertEqual(response["missions"][0]["id"], "mission-1")
        self.assertEqual(response["total"], 1)
        mock_list.assert_called_once()

    def test_list_missions_filtering_by_status_operator_version(self):
        with (
            patch("app.main.get_tenant_policy_bundle", return_value={"id": "familyops", "status": "active"}),
            patch(
                "app.main.list_operator_missions",
                return_value={"missions": [], "total": 0, "limit": 50, "offset": 0},
            ) as mock_list,
        ):
            main.list_operator_missions_endpoint(
                tenant_id="familyops",
                operator_id="ops-daily",
                operator_version_id="ver-2",
                status="partial",
                source="trigger",
                limit=50,
                offset=0,
            )

        called = mock_list.call_args.kwargs
        self.assertEqual(called["tenant_id"], "familyops")
        self.assertEqual(called["operator_id"], "ops-daily")
        self.assertEqual(called["operator_version_id"], "ver-2")
        self.assertEqual(called["status"], "partial")
        self.assertEqual(called["source"], "trigger")

    def test_mission_detail_includes_audit_and_trigger(self):
        mission = {
            "id": "mission-2",
            "tenant_id": "familyops",
            "user_id": "moe",
            "operator_id": "ops-daily",
            "operator_version_id": "ver-1",
            "trigger_id": "trigger-123",
            "source": "trigger",
            "approval_task_id": None,
            "status": "completed",
            "summary": "ok",
            "input_payload": {},
            "output_payload": {},
            "redacted_tool_log": [],
            "tool_calls_redacted": [],
            "artifacts": [],
            "token_estimate": 0,
            "cost_estimate": 0,
            "error": None,
            "started_at": "2026-03-12T12:00:00+00:00",
            "finished_at": "2026-03-12T12:01:00+00:00",
            "created_at": "2026-03-12T12:00:00+00:00",
            "updated_at": "2026-03-12T12:01:00+00:00",
        }
        audit_events = [{"id": 1, "event_type": "runner_execution_start"}]
        trigger = {"id": "trigger-123", "enabled": True}

        with (
            patch("app.main.get_operator_mission", return_value=mission),
            patch("app.main.list_operator_mission_events", return_value=audit_events),
            patch("app.main.get_trigger", return_value=trigger),
        ):
            response = main.get_operator_mission_endpoint("mission-2")

        self.assertEqual(response["id"], "mission-2")
        self.assertEqual(response["trigger"]["id"], "trigger-123")
        self.assertEqual(response["audit_events"][0]["id"], 1)


class MissionHistoryServiceTests(unittest.TestCase):
    def test_redacted_tool_calls_are_exposed_for_display(self):
        row = {
            "id": "mission-1",
            "tenant_id": "familyops",
            "user_id": "moe",
            "operator_id": "ops-daily",
            "operator_version_id": "ver-1",
            "trigger_id": None,
            "source": "manual",
            "approval_task_id": None,
            "status": "completed",
            "summary": "done",
            "input_payload": {},
            "output_payload": {},
            "redacted_tool_log": [{"tool": "db.read", "payload": {"token": "[REDACTED]"}}],
            "artifacts": [{"kind": "step_output"}],
            "token_estimate": 50,
            "cost_estimate": 0,
            "error": None,
            "started_at": datetime(2026, 3, 12, 12, 0, tzinfo=timezone.utc),
            "finished_at": datetime(2026, 3, 12, 12, 1, tzinfo=timezone.utc),
            "created_at": datetime(2026, 3, 12, 12, 0, tzinfo=timezone.utc),
            "updated_at": datetime(2026, 3, 12, 12, 1, tzinfo=timezone.utc),
        }

        serialized = operator_service._serialize_mission(row)
        self.assertEqual(serialized["redacted_tool_log"], serialized["tool_calls_redacted"])
        self.assertEqual(serialized["artifacts"][0]["kind"], "step_output")

    def test_run_operator_links_operator_version_and_trigger(self):
        version_row = {
            "id": "ver-1",
            "tenant_id": "familyops",
            "operator_id": "ops-daily",
            "version_number": 1,
            "version_label": "v1",
            "status": "active",
            "goal": "goal",
            "instruction_json": {"steps": []},
            "tool_manifest": [],
            "validation_summary": "passed",
            "validation_status": "passed",
            "created_by": "moe",
            "created_at": datetime(2026, 3, 12, 12, 0, tzinfo=timezone.utc),
            "updated_at": datetime(2026, 3, 12, 12, 0, tzinfo=timezone.utc),
        }
        instruction_row = {
            "id": "instr-1",
            "tenant_id": "familyops",
            "operator_version_id": "ver-1",
            "instruction_json": {"steps": []},
            "tool_manifest": [],
            "checksum": "abc",
            "created_at": datetime(2026, 3, 12, 12, 0, tzinfo=timezone.utc),
        }
        mission_after = {
            "id": "mission-1",
            "operator_version_id": "ver-1",
            "trigger_id": "trigger-abc",
            "source": "trigger",
            "status": "completed",
        }

        with (
            patch("app.operator_service._get_operator_version_row", return_value=version_row),
            patch("app.operator_service._get_latest_runner_instruction_row", return_value=instruction_row),
            patch("app.operator_service._create_mission_record") as mock_create,
            patch("app.operator_service._finalize_mission_record"),
            patch("app.operator_service.record_operator_event"),
            patch("app.operator_service.get_operator_mission", return_value=mission_after),
        ):
            response = operator_service.run_operator_version(
                tenant_id="familyops",
                user_id="moe",
                operator_version_id="ver-1",
                input_payload={"message": "run"},
                tenant_tool_allowlist=["db.read", "db.write", "ghl.read", "ghl.write"],
                tool_impls={},
                source="trigger",
                trigger_id="trigger-abc",
            )

        self.assertEqual(response["operator_version_id"], "ver-1")
        self.assertEqual(response["trigger_id"], "trigger-abc")
        called = mock_create.call_args.kwargs
        self.assertEqual(called["operator_version_id"], "ver-1")
        self.assertEqual(called["trigger_id"], "trigger-abc")
        self.assertEqual(called["source"], "trigger")


if __name__ == "__main__":
    unittest.main(verbosity=2)
