from __future__ import annotations

import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi import HTTPException, Request

from app import main


REPO_ROOT = Path(__file__).resolve().parents[3]


def read_repo_file(relative_path: str) -> str:
    return (REPO_ROOT / relative_path).read_text(encoding="utf-8")


def make_request(headers: dict[str, str] | None = None) -> Request:
    raw_headers = []
    for key, value in (headers or {}).items():
        raw_headers.append((key.lower().encode("utf-8"), value.encode("utf-8")))
    scope = {"type": "http", "method": "POST", "path": "/v1/task/enqueue", "headers": raw_headers}
    return Request(scope)


class TaskEnqueueAuthRegressionTests(unittest.TestCase):
    def test_enqueue_route_is_wired_to_admin_dependency(self):
        route = next(route for route in main.app.routes if getattr(route, "path", "") == "/v1/task/enqueue")
        dependency_calls = [dep.call for dep in route.dependant.dependencies]
        self.assertIn(main.require_admin, dependency_calls)

    def test_require_admin_denies_missing_token(self):
        with self.assertRaises(HTTPException) as context:
            main.require_admin(make_request())
        self.assertEqual(context.exception.status_code, 401)
        self.assertEqual(context.exception.detail, "Unauthorized")

    def test_require_admin_allows_valid_token(self):
        # Default token in local/dev is "change_me" when ADMIN_TOKEN is unset.
        main.require_admin(make_request(headers={"x-admin-token": "change_me"}))

    def test_enqueue_allows_authorized_requests(self):
        request = main.TaskEnqueueRequest(
            tenant_id="familyops",
            user_id="moe",
            task_type="ghl.social.plan",
            payload={"topic": "lint safe"},
        )

        with (
            patch("app.main.get_tenant_policy_bundle", return_value={"id": "familyops", "status": "active"}),
            patch("app.main.upsert_task_log") as mock_upsert_log,
            patch("app.main.enqueue") as mock_enqueue,
            patch("app.main.create_approval") as mock_create_approval,
            patch("app.main.uuid4", return_value="task-fixed-id"),
        ):
            response = main.enqueue_task(request)

        self.assertEqual(response["ok"], True)
        self.assertEqual(response["task_id"], "task-fixed-id")
        self.assertEqual(response["approval_required"], False)
        mock_upsert_log.assert_called_once()
        mock_enqueue.assert_called_once()
        mock_create_approval.assert_not_called()


class WebAuthSurfaceRegressionTests(unittest.TestCase):
    def test_worker_route_denies_signed_out_and_non_admin_via_status_passthrough(self):
        route_source = read_repo_file("apps/tufflove-web/app/api/worker/run-once/route.ts")
        rbac_source = read_repo_file("apps/tufflove-web/utils/familyopsRbac.ts")

        self.assertIn("const access = await requireFamilyOpsAdmin();", route_source)
        self.assertIn("if (!access.ok)", route_source)
        self.assertIn("status: access.status", route_source)

        self.assertIn('status: 401, reason: "not_signed_in"', rbac_source)
        self.assertIn('status: 403, reason: "not_authorized"', rbac_source)

    def test_agent_page_denies_signed_out_access(self):
        page_source = read_repo_file("apps/tufflove-web/app/agent/page.tsx")
        self.assertIn("const access = await requireFamilyOpsAdmin();", page_source)
        self.assertIn("if (!access.ok && access.status === 401)", page_source)
        self.assertIn('redirect("/sign-in");', page_source)

    def test_agent_test_page_denies_signed_out_access(self):
        page_source = read_repo_file("apps/tufflove-web/app/agent-test/page.tsx")
        self.assertIn("const access = await requireFamilyOpsAdmin();", page_source)
        self.assertIn("if (!access.ok && access.status === 401)", page_source)
        self.assertIn('redirect("/sign-in");', page_source)

    def test_admin_paths_still_route_for_agent_surfaces(self):
        agent_source = read_repo_file("apps/tufflove-web/app/agent/page.tsx")
        agent_test_source = read_repo_file("apps/tufflove-web/app/agent-test/page.tsx")
        worker_route_source = read_repo_file("apps/tufflove-web/app/api/worker/run-once/route.ts")

        self.assertIn("return <AgentClient />;", agent_source)
        self.assertIn("return <AgentTestClient />;", agent_test_source)
        self.assertIn("/v1/worker/run_once", worker_route_source)


if __name__ == "__main__":
    unittest.main(verbosity=2)
