from __future__ import annotations

import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi import HTTPException

from app import main, model_router_service


REPO_ROOT = Path(__file__).resolve().parents[3]


def read_repo_file(relative_path: str) -> str:
    return (REPO_ROOT / relative_path).read_text(encoding="utf-8")


class ModelRouterPolicyTests(unittest.TestCase):
    def test_routing_policy_defaults(self):
        self.assertEqual(
            model_router_service.select_model(
                task_class="implement",
                requested_model=None,
                openclaw_verify_enabled=False,
            ),
            "codex",
        )
        self.assertEqual(
            model_router_service.select_model(
                task_class="debug",
                requested_model=None,
                openclaw_verify_enabled=False,
            ),
            "claude",
        )
        self.assertEqual(
            model_router_service.select_model(
                task_class="review",
                requested_model=None,
                openclaw_verify_enabled=False,
            ),
            "gemini",
        )
        self.assertEqual(
            model_router_service.select_model(
                task_class="verify",
                requested_model=None,
                openclaw_verify_enabled=False,
            ),
            "gemini",
        )
        self.assertEqual(
            model_router_service.select_model(
                task_class="verify",
                requested_model=None,
                openclaw_verify_enabled=True,
            ),
            "openclaw",
        )

    def test_verification_policy_sensitive_or_failing_requires_second_model(self):
        sensitive = model_router_service.evaluate_verification_policy(
            task_class="implement",
            selected_model="codex",
            proof_status="passing",
            sensitive_change=True,
            requested_verification_required=None,
            requested_verification_model=None,
            openclaw_verify_enabled=False,
        )
        self.assertTrue(sensitive["verification_required"])
        self.assertEqual(sensitive["verification_status"], "pending")
        self.assertIn("sensitive_change", sensitive["policy_reasons"])

        failing = model_router_service.evaluate_verification_policy(
            task_class="implement",
            selected_model="codex",
            proof_status="failing",
            sensitive_change=False,
            requested_verification_required=None,
            requested_verification_model=None,
            openclaw_verify_enabled=False,
        )
        self.assertTrue(failing["verification_required"])
        self.assertIn("proof_not_passing", failing["policy_reasons"])

    def test_optional_openclaw_lane_falls_back_when_disabled(self):
        policy = model_router_service.evaluate_verification_policy(
            task_class="implement",
            selected_model="codex",
            proof_status="failing",
            sensitive_change=False,
            requested_verification_required=True,
            requested_verification_model="openclaw",
            openclaw_verify_enabled=False,
        )
        self.assertEqual(policy["verification_model"], "gemini")


class ModelRouterEndpointTests(unittest.TestCase):
    def test_route_endpoint_records_escalation_tracking_fields(self):
        body = main.ModelRouterRouteRequest(
            tenant_id="familyops",
            task_class="implement",
            task_type="platform.change",
            requested_model="codex",
            escalation_reason="failing_ci_checks",
            output_summary="lint fixed; tests pending",
            proof_status="failing",
            linked_branch="feat/multi-model-escalation-router",
            linked_pr="https://github.com/BeTeachableLLC/tufflove-platform/pull/19",
            created_by="moe",
            sensitive_change=True,
        )
        with (
            patch("app.main.get_tenant_policy_bundle", return_value={"id": "familyops", "status": "active"}),
            patch(
                "app.main.create_model_router_decision",
                return_value={"id": "decision-1", "verification_status": "pending", "final_recommendation": "needs_second_model_review"},
            ) as mock_create,
        ):
            response = main.model_router_route_endpoint(body)

        self.assertTrue(response["ok"])
        self.assertEqual(response["decision"]["id"], "decision-1")
        _, kwargs = mock_create.call_args
        self.assertEqual(kwargs["task_class"], "implement")
        self.assertEqual(kwargs["escalation_reason"], "failing_ci_checks")
        self.assertEqual(kwargs["proof_status"], "failing")
        self.assertEqual(kwargs["linked_branch"], "feat/multi-model-escalation-router")
        self.assertEqual(kwargs["linked_pr"], "https://github.com/BeTeachableLLC/tufflove-platform/pull/19")
        self.assertTrue(kwargs["sensitive_change"])

    def test_route_endpoint_rejects_missing_tenant(self):
        body = main.ModelRouterRouteRequest(
            tenant_id="missing",
            task_class="implement",
        )
        with patch("app.main.get_tenant_policy_bundle", return_value=None):
            with self.assertRaises(HTTPException) as context:
                main.model_router_route_endpoint(body)
        self.assertEqual(context.exception.status_code, 404)

    def test_list_endpoint_passes_filters(self):
        with (
            patch("app.main.get_tenant_policy_bundle", return_value={"id": "familyops", "status": "active"}),
            patch(
                "app.main.list_model_router_decisions",
                return_value={"tenant_id": "familyops", "items": [{"id": "decision-1"}], "total": 1, "limit": 20, "offset": 0},
            ) as mock_list,
        ):
            response = main.model_router_list_endpoint(
                tenant_id="familyops",
                task_class="debug",
                verification_status="pending",
                limit=20,
                offset=0,
            )

        self.assertEqual(response["total"], 1)
        _, kwargs = mock_list.call_args
        self.assertEqual(kwargs["tenant_id"], "familyops")
        self.assertEqual(kwargs["task_class"], "debug")
        self.assertEqual(kwargs["verification_status"], "pending")
        self.assertEqual(kwargs["limit"], 20)

    def test_patch_endpoint_returns_updated_decision(self):
        with patch(
            "app.main.update_model_router_decision",
            return_value={"id": "decision-1", "verification_status": "passed"},
        ) as mock_patch:
            response = main.model_router_patch_endpoint(
                "decision-1",
                main.ModelRouterPatchRequest(verification_status="passed"),
            )

        self.assertTrue(response["ok"])
        self.assertEqual(response["decision"]["verification_status"], "passed")
        _, kwargs = mock_patch.call_args
        self.assertEqual(kwargs, {})


class ModelRouterUiSurfaceTests(unittest.TestCase):
    def test_router_page_keeps_familyops_admin_gate(self):
        source = read_repo_file("apps/tufflove-web/app/familyops/router/page.tsx")
        self.assertIn("requireFamilyOpsAdmin", source)
        self.assertIn('redirect("/sign-in")', source)

    def test_router_api_routes_proxy_backend(self):
        list_source = read_repo_file("apps/tufflove-web/app/api/familyops/model-router/route.ts")
        detail_source = read_repo_file("apps/tufflove-web/app/api/familyops/model-router/[id]/route.ts")
        self.assertIn("/v1/model-router/decisions", list_source)
        self.assertIn("/v1/model-router/route", list_source)
        self.assertIn("/v1/model-router/decision/", detail_source)

    def test_router_client_shows_verification_and_recommendation(self):
        source = read_repo_file("apps/tufflove-web/app/familyops/router/ModelRouterClient.tsx")
        self.assertIn("verification_status", source)
        self.assertIn("final_recommendation", source)
        self.assertIn("Update Verification", source)


if __name__ == "__main__":
    unittest.main(verbosity=2)
