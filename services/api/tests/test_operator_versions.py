from __future__ import annotations

from datetime import datetime, timezone
import unittest
from unittest.mock import Mock, patch

from app import main, operator_service


class _FakeCursor:
    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False

    def execute(self, _query: str, _params: tuple | None = None) -> None:
        return None

    def fetchone(self) -> dict:
        return {}


class _FakeConn:
    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False

    def cursor(self):
        return _FakeCursor()

    def commit(self) -> None:
        return None


class OperatorVersionEndpointTests(unittest.TestCase):
    def test_create_operator_version_endpoint(self):
        req = main.OperatorVersionCreateRequest(
            tenant_id="familyops",
            operator_id="ops-daily",
            status="draft",
            goal="Daily operator",
            instruction_json={"steps": [{"tool": "db.read", "payload": {"query": "x"}}]},
            tool_manifest=["db.read"],
            validation_status="pending",
            created_by="moe",
        )
        with (
            patch("app.main.get_tenant_policy_bundle", return_value={"id": "familyops", "status": "active"}),
            patch("app.main.create_operator_version", return_value={"id": "ver-1", "operator_id": "ops-daily"}) as mock_create,
        ):
            response = main.create_operator_version_endpoint(req)

        self.assertTrue(response["ok"])
        self.assertEqual(response["version"]["id"], "ver-1")
        mock_create.assert_called_once()

    def test_activate_operator_version_endpoint(self):
        with patch("app.main.activate_operator_version", return_value={"id": "ver-1", "status": "active"}) as mock_activate:
            response = main.activate_operator_version_endpoint(
                "ver-1",
                main.OperatorVersionActivateRequest(activated_by="moe"),
            )

        self.assertTrue(response["ok"])
        self.assertEqual(response["version"]["status"], "active")
        mock_activate.assert_called_once_with("ver-1", activated_by="moe")

    def test_run_endpoint_returns_mission_with_operator_version_id(self):
        req = main.OperatorRunRequest(
            tenant_id="familyops",
            user_id="moe",
            operator_version_id="ver-1",
            input_payload={"message": "run"},
        )
        mission = {"id": "mission-1", "operator_version_id": "ver-1", "status": "completed"}
        with (
            patch(
                "app.main.get_tenant_policy_bundle",
                return_value={"id": "familyops", "status": "active", "tool_allowlist": ["db.read"]},
            ),
            patch("app.main.run_operator_version", return_value=mission) as mock_run,
        ):
            response = main.run_operator_by_version_endpoint(req)

        self.assertTrue(response["ok"])
        self.assertEqual(response["mission"]["operator_version_id"], "ver-1")
        mock_run.assert_called_once()


class OperatorRunnerBehaviorTests(unittest.TestCase):
    def _version_row(self) -> dict:
        return {
            "id": "ver-1",
            "tenant_id": "familyops",
            "operator_id": "ops-daily",
            "version_number": 1,
            "version_label": "v1",
            "status": "active",
            "goal": "goal",
            "instruction_json": {"steps": [{"tool": "db.read", "payload": {"query": "persisted"}}]},
            "tool_manifest": ["db.read"],
            "validation_summary": "",
            "validation_status": "passed",
            "created_by": "moe",
            "created_at": datetime(2026, 3, 12, 12, 0, tzinfo=timezone.utc),
            "updated_at": datetime(2026, 3, 12, 12, 0, tzinfo=timezone.utc),
        }

    def _instruction_row(self) -> dict:
        return {
            "id": "ri-1",
            "tenant_id": "familyops",
            "operator_version_id": "ver-1",
            "instruction_json": {"steps": [{"tool": "db.read", "payload": {"query": "persisted"}}]},
            "tool_manifest": ["db.read"],
            "checksum": "abc",
            "created_at": datetime(2026, 3, 12, 12, 0, tzinfo=timezone.utc),
        }

    def test_runner_refuses_missing_tool_with_partial(self):
        mission_after = {
            "id": "mission-1",
            "tenant_id": "familyops",
            "user_id": "moe",
            "operator_id": "ops-daily",
            "operator_version_id": "ver-1",
            "status": "partial",
        }
        version_row = self._version_row()
        version_row["tool_manifest"] = ["db.read", "ghl.write"]

        with (
            patch("app.operator_service._get_operator_version_row", return_value=version_row),
            patch("app.operator_service._get_latest_runner_instruction_row", return_value=self._instruction_row()),
            patch("app.operator_service._create_mission_record") as mock_create_mission,
            patch("app.operator_service._finalize_mission_record") as mock_finalize,
            patch("app.operator_service.record_operator_event") as mock_event,
            patch("app.operator_service.get_operator_mission", return_value=mission_after),
        ):
            result = operator_service.run_operator_version(
                tenant_id="familyops",
                user_id="moe",
                operator_version_id="ver-1",
                input_payload={"message": "run"},
                tenant_tool_allowlist=["db.read", "ghl.write"],
                tool_impls={"db.read": lambda payload: {"ok": True, "payload": payload}},
            )

        self.assertEqual(result["status"], "partial")
        self.assertEqual(result["operator_version_id"], "ver-1")
        mock_create_mission.assert_called_once()
        _, kwargs = mock_create_mission.call_args
        self.assertEqual(kwargs["operator_version_id"], "ver-1")
        self.assertTrue(mock_finalize.called)
        self.assertTrue(mock_event.called)

    def test_runner_uses_persisted_instructions_only(self):
        mission_after = {
            "id": "mission-2",
            "tenant_id": "familyops",
            "user_id": "moe",
            "operator_id": "ops-daily",
            "operator_version_id": "ver-1",
            "status": "completed",
        }
        tool = Mock(return_value={"ok": True})

        with (
            patch("app.operator_service._get_operator_version_row", return_value=self._version_row()),
            patch("app.operator_service._get_latest_runner_instruction_row", return_value=self._instruction_row()),
            patch("app.operator_service._create_mission_record"),
            patch("app.operator_service._finalize_mission_record"),
            patch("app.operator_service.record_operator_event"),
            patch("app.operator_service.get_operator_mission", return_value=mission_after),
        ):
            operator_service.run_operator_version(
                tenant_id="familyops",
                user_id="moe",
                operator_version_id="ver-1",
                input_payload={
                    "steps": [{"tool": "db.write", "payload": {"query": "should-not-run"}}],
                    "message": "ignored-step-override",
                },
                tenant_tool_allowlist=["db.read", "db.write"],
                tool_impls={"db.read": tool, "db.write": Mock(return_value={"ok": True})},
            )

        tool.assert_called_once_with({"query": "persisted"})


class OperatorAuditLifecycleTests(unittest.TestCase):
    def test_create_version_writes_audit_event(self):
        with (
            patch("app.operator_service._next_version_number", return_value=1),
            patch("app.operator_service.connect", return_value=_FakeConn()),
            patch("app.operator_service._create_forge_build"),
            patch("app.operator_service._create_runner_instruction"),
            patch("app.operator_service.get_operator_version", return_value={"id": "ver-1"}),
            patch("app.operator_service.record_operator_event") as mock_event,
        ):
            operator_service.create_operator_version(
                tenant_id="familyops",
                operator_id="ops-daily",
                version_label="v1",
                status="draft",
                goal="goal",
                instruction_json={"steps": []},
                tool_manifest=["db.read"],
                validation_summary="pending",
                validation_status="pending",
                created_by="moe",
            )

        self.assertTrue(mock_event.called)
        self.assertEqual(mock_event.call_args.kwargs["event_type"], "version_created")

    def test_activate_version_writes_audit_event(self):
        row = {
            "id": "ver-1",
            "tenant_id": "familyops",
            "operator_id": "ops-daily",
            "version_number": 2,
        }
        with (
            patch("app.operator_service._get_operator_version_row", return_value=row),
            patch("app.operator_service.connect", return_value=_FakeConn()),
            patch("app.operator_service.get_operator_version", return_value={"id": "ver-1", "status": "active"}),
            patch("app.operator_service.record_operator_event") as mock_event,
        ):
            operator_service.activate_operator_version("ver-1", activated_by="moe")

        self.assertTrue(mock_event.called)
        self.assertEqual(mock_event.call_args.kwargs["event_type"], "version_activated")


if __name__ == "__main__":
    unittest.main(verbosity=2)
