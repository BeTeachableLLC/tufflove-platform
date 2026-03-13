from __future__ import annotations

import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi import HTTPException

from app import main

REPO_ROOT = Path(__file__).resolve().parents[3]


def read_repo_file(relative_path: str) -> str:
    return (REPO_ROOT / relative_path).read_text(encoding="utf-8")


class MissionHistoryApiTests(unittest.TestCase):
    def test_list_missions_endpoint_supports_filters(self):
        def tenant_lookup(tenant_id: str):
            return {"id": tenant_id, "status": "active"}

        with (
            patch("app.main.get_tenant_policy_bundle", side_effect=tenant_lookup),
            patch(
                "app.main.list_familyops_missions",
                return_value={"tenant_id": "familyops", "items": [{"id": "task-1"}], "total": 1, "limit": 50, "offset": 0},
            ) as mock_list,
        ):
            response = main.familyops_list_missions(
                status="blocked",
                task_type="ghl.social.publish",
                tenant_id="familyops",
                subaccount_id="sa-1",
                brand_id="beteachable",
                date_from="2026-03-13T00:00:00Z",
                date_to="2026-03-13T23:59:59Z",
                search="would_publish",
                limit=25,
                offset=0,
            )

        self.assertEqual(response["total"], 1)
        self.assertEqual(response["items"][0]["id"], "task-1")
        mock_list.assert_called_once()
        _, kwargs = mock_list.call_args
        self.assertEqual(kwargs["status"], "blocked")
        self.assertEqual(kwargs["task_type"], "ghl.social.publish")
        self.assertEqual(kwargs["tenant_id"], "familyops")
        self.assertEqual(kwargs["subaccount_id"], "sa-1")
        self.assertEqual(kwargs["brand_id"], "beteachable")
        self.assertEqual(kwargs["search"], "would_publish")
        self.assertEqual(kwargs["limit"], 25)

    def test_get_mission_detail_endpoint(self):
        with (
            patch("app.main.get_tenant_policy_bundle", return_value={"id": "familyops", "status": "active"}),
            patch(
                "app.main.get_familyops_mission",
                return_value={"id": "task-1", "tenant_id": "familyops", "status": "completed"},
            ),
        ):
            response = main.familyops_get_mission_detail("task-1", tenant_id="familyops")

        self.assertEqual(response["id"], "task-1")
        self.assertEqual(response["status"], "completed")

    def test_get_mission_detail_not_found(self):
        with (
            patch("app.main.get_tenant_policy_bundle", return_value={"id": "familyops", "status": "active"}),
            patch("app.main.get_familyops_mission", return_value=None),
        ):
            with self.assertRaises(HTTPException) as context:
                main.familyops_get_mission_detail("missing-mission", tenant_id="familyops")

        self.assertEqual(context.exception.status_code, 404)
        self.assertEqual(context.exception.detail, "Mission not found")


class MissionHistoryUiSurfaceTests(unittest.TestCase):
    def test_missions_page_keeps_familyops_admin_gate(self):
        source = read_repo_file("apps/tufflove-web/app/familyops/missions/page.tsx")
        self.assertIn("requireFamilyOpsAdmin", source)
        self.assertIn('redirect("/sign-in")', source)

    def test_missions_api_routes_proxy_backend(self):
        list_source = read_repo_file("apps/tufflove-web/app/api/familyops/missions/route.ts")
        detail_source = read_repo_file("apps/tufflove-web/app/api/familyops/missions/[id]/route.ts")

        self.assertIn("/v1/familyops/missions", list_source)
        self.assertIn("/v1/familyops/missions/${encodeURIComponent(id)}", detail_source)

    def test_missions_client_has_timeline_and_dry_run_indicators(self):
        source = read_repo_file("apps/tufflove-web/app/familyops/missions/MissionsClient.tsx")
        self.assertIn("Event Timeline", source)
        self.assertIn("dry_run", source)
        self.assertIn("blocked_reason", source)


if __name__ == "__main__":
    unittest.main(verbosity=2)
