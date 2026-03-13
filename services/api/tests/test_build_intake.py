from __future__ import annotations

import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi import HTTPException

from app import build_intake_service, main

REPO_ROOT = Path(__file__).resolve().parents[3]


def read_repo_file(relative_path: str) -> str:
    return (REPO_ROOT / relative_path).read_text(encoding="utf-8")


class BuildIntakeEndpointTests(unittest.TestCase):
    def test_create_build_intake_endpoint(self):
        body = main.BuildIntakeCreateRequest(
            tenant_id="familyops",
            goal="Automate intake to PR draft flow",
            scope_summary="Build-intake + branch + pr metadata",
            constraints_json={"no_publish_changes": True},
            requested_model_lane="codex",
            sensitive_change=True,
            desired_proof="lint, build, api tests",
            created_by="moe",
        )
        with (
            patch("app.main.get_tenant_policy_bundle", return_value={"id": "familyops", "status": "active"}),
            patch(
                "app.main.create_build_request",
                return_value={"id": "build-1", "stage": "intake"},
            ) as mock_create,
        ):
            response = main.create_build_intake_endpoint(body)

        self.assertTrue(response["ok"])
        self.assertEqual(response["request"]["id"], "build-1")
        _, kwargs = mock_create.call_args
        self.assertEqual(kwargs["goal"], "Automate intake to PR draft flow")
        self.assertTrue(kwargs["sensitive_change"])

    def test_create_build_intake_requires_goal(self):
        body = main.BuildIntakeCreateRequest(tenant_id="familyops", goal="   ")
        with patch("app.main.get_tenant_policy_bundle", return_value={"id": "familyops", "status": "active"}):
            with self.assertRaises(HTTPException) as context:
                main.create_build_intake_endpoint(body)
        self.assertEqual(context.exception.status_code, 400)

    def test_list_build_intake_endpoint_filters_stage(self):
        with (
            patch("app.main.get_tenant_policy_bundle", return_value={"id": "familyops", "status": "active"}),
            patch(
                "app.main.list_build_requests",
                return_value={"tenant_id": "familyops", "items": [{"id": "build-1"}], "total": 1, "limit": 20, "offset": 0},
            ) as mock_list,
        ):
            response = main.list_build_intake_endpoint(
                tenant_id="familyops",
                stage="tests_run",
                limit=20,
                offset=0,
            )

        self.assertEqual(response["total"], 1)
        _, kwargs = mock_list.call_args
        self.assertEqual(kwargs["stage"], "tests_run")
        self.assertEqual(kwargs["tenant_id"], "familyops")

    def test_get_build_intake_detail_endpoint(self):
        with patch("app.main.get_build_request", return_value={"id": "build-1", "stage": "branch_created"}) as mock_get:
            response = main.get_build_intake_endpoint("build-1", include_timeline=True)

        self.assertEqual(response["id"], "build-1")
        _, kwargs = mock_get.call_args
        self.assertTrue(kwargs["include_timeline"])

    def test_branch_create_endpoint(self):
        with patch("app.main.create_branch_record", return_value={"id": "build-1", "branch_name": "build/test"}) as mock_branch:
            response = main.build_intake_create_branch_endpoint(
                "build-1",
                main.BuildBranchCreateRequest(actor="moe", source_branch="main", branch_name="build/test"),
            )

        self.assertTrue(response["ok"])
        self.assertEqual(response["request"]["branch_name"], "build/test")
        _, kwargs = mock_branch.call_args
        self.assertEqual(kwargs["actor"], "moe")

    def test_route_link_endpoint(self):
        with patch("app.main.link_router_decision_to_build_request", return_value={"id": "build-1", "router_decision_id": "decision-1"}) as mock_link:
            response = main.build_intake_link_route_endpoint(
                "build-1",
                main.BuildRouteLinkRequest(decision_id="decision-1", actor="moe"),
            )

        self.assertTrue(response["ok"])
        self.assertEqual(response["request"]["router_decision_id"], "decision-1")
        _, kwargs = mock_link.call_args
        self.assertEqual(kwargs["decision_id"], "decision-1")

    def test_stage_transition_endpoint(self):
        with patch("app.main.transition_build_stage", return_value={"id": "build-1", "stage": "tests_run"}) as mock_stage:
            response = main.build_intake_stage_endpoint(
                "build-1",
                main.BuildStageUpdateRequest(stage="tests_run", actor="moe", detail="All tests run"),
            )

        self.assertTrue(response["ok"])
        self.assertEqual(response["request"]["stage"], "tests_run")
        _, kwargs = mock_stage.call_args
        self.assertEqual(kwargs["stage"], "tests_run")

    def test_pr_draft_endpoint_persists_metadata(self):
        with patch(
            "app.main.save_pr_draft_metadata",
            return_value={"id": "build-1", "stage": "pr_drafted", "pr_url": "https://github.com/org/repo/pull/123"},
        ) as mock_save:
            response = main.build_intake_pr_draft_endpoint(
                "build-1",
                main.BuildPrDraftRequest(
                    actor="moe",
                    pr_url="https://github.com/org/repo/pull/123",
                    pr_number="123",
                    proof_summary="lint/build pass",
                    test_summary="worker/api pass",
                    files_changed_summary="8 files changed",
                    stage="pr_drafted",
                ),
            )

        self.assertTrue(response["ok"])
        self.assertEqual(response["request"]["stage"], "pr_drafted")
        _, kwargs = mock_save.call_args
        self.assertEqual(kwargs["pr_number"], "123")
        self.assertEqual(kwargs["files_changed_summary"], "8 files changed")

    def test_execution_start_endpoint(self):
        with patch(
            "app.main.start_build_execution_run",
            return_value={"id": "build-1", "latest_execution_run_id": "run-1", "stage": "implementation_started"},
        ) as mock_start:
            response = main.build_intake_execution_start_endpoint(
                "build-1",
                main.BuildExecutionStartRequest(
                    actor="moe",
                    command_class="codex",
                    target_scope="services/api",
                    summary="start implementation",
                ),
            )

        self.assertTrue(response["ok"])
        self.assertEqual(response["request"]["latest_execution_run_id"], "run-1")
        _, kwargs = mock_start.call_args
        self.assertEqual(kwargs["actor"], "moe")
        self.assertEqual(kwargs["command_class"], "codex")

    def test_execution_complete_endpoint(self):
        with patch(
            "app.main.complete_build_execution_run",
            return_value={"id": "build-1", "stage": "verification_requested", "proof_status": "passed"},
        ) as mock_complete:
            response = main.build_intake_execution_complete_endpoint(
                "build-1",
                "run-1",
                main.BuildExecutionCompleteRequest(
                    actor="moe",
                    status="passed",
                    proof_status="passed",
                    lint_build_summary="lint/build pass",
                    test_summary="api+worker pass",
                    request_verification=True,
                ),
            )

        self.assertTrue(response["ok"])
        self.assertEqual(response["request"]["stage"], "verification_requested")
        _, kwargs = mock_complete.call_args
        self.assertEqual(kwargs["run_id"], "run-1")
        self.assertTrue(kwargs["request_verification"])

    def test_verification_endpoint(self):
        with patch(
            "app.main.set_build_verification_state",
            return_value={"id": "build-1", "stage": "ready_for_pr_review", "verification_state": "passed"},
        ) as mock_verification:
            response = main.build_intake_verification_endpoint(
                "build-1",
                main.BuildVerificationRequest(
                    actor="moe",
                    verification_state="passed",
                    detail="second-model check complete",
                ),
            )

        self.assertTrue(response["ok"])
        self.assertEqual(response["request"]["verification_state"], "passed")
        _, kwargs = mock_verification.call_args
        self.assertEqual(kwargs["verification_state"], "passed")


class BuildIntakeRecommendationTests(unittest.TestCase):
    def test_compute_recommendation_requires_execution_when_proof_unknown(self):
        result = build_intake_service.compute_recommendation(
            proof_status="unknown",
            verification_state="not_required",
            verification_required=False,
            has_pr_draft=False,
        )
        self.assertEqual(result["stage"], "tests_run")
        self.assertEqual(result["recommendation"], "needs_execution")

    def test_compute_recommendation_marks_revision_when_proof_failed(self):
        result = build_intake_service.compute_recommendation(
            proof_status="failed",
            verification_state="pending",
            verification_required=True,
            has_pr_draft=False,
        )
        self.assertEqual(result["stage"], "revise_before_pr")
        self.assertEqual(result["recommendation"], "revise_before_pr")

    def test_compute_recommendation_marks_verification_pending(self):
        result = build_intake_service.compute_recommendation(
            proof_status="passed",
            verification_state="pending",
            verification_required=True,
            has_pr_draft=False,
        )
        self.assertEqual(result["stage"], "verification_requested")
        self.assertEqual(result["recommendation"], "verification_requested")

    def test_compute_recommendation_moves_to_approval_pending_when_pr_exists(self):
        result = build_intake_service.compute_recommendation(
            proof_status="passed",
            verification_state="passed",
            verification_required=True,
            has_pr_draft=True,
        )
        self.assertEqual(result["stage"], "approval_pending")
        self.assertEqual(result["recommendation"], "approval_pending")

    def test_output_excerpt_redacts_sensitive_tokens(self):
        text = "access_token=abc123 password=letmein secret=mysecret"
        sanitized = build_intake_service._sanitize_output_excerpt(text)  # noqa: SLF001
        self.assertNotIn("abc123", sanitized)
        self.assertNotIn("letmein", sanitized)
        self.assertNotIn("mysecret", sanitized)
        self.assertIn("[REDACTED]", sanitized)


class BuildIntakeUiSurfaceTests(unittest.TestCase):
    def test_build_intake_proxy_routes_to_backend(self):
        list_source = read_repo_file("apps/tufflove-web/app/api/familyops/build-intake/route.ts")
        detail_source = read_repo_file("apps/tufflove-web/app/api/familyops/build-intake/[id]/route.ts")
        branch_source = read_repo_file("apps/tufflove-web/app/api/familyops/build-intake/[id]/branch/route.ts")
        route_source = read_repo_file("apps/tufflove-web/app/api/familyops/build-intake/[id]/route-link/route.ts")
        stage_source = read_repo_file("apps/tufflove-web/app/api/familyops/build-intake/[id]/stage/route.ts")
        pr_source = read_repo_file("apps/tufflove-web/app/api/familyops/build-intake/[id]/pr-draft/route.ts")
        execution_start_source = read_repo_file("apps/tufflove-web/app/api/familyops/build-intake/[id]/execution/start/route.ts")
        execution_complete_source = read_repo_file("apps/tufflove-web/app/api/familyops/build-intake/[id]/execution/[runId]/complete/route.ts")
        verification_source = read_repo_file("apps/tufflove-web/app/api/familyops/build-intake/[id]/verification/route.ts")

        self.assertIn("/v1/build/intake", list_source)
        self.assertIn("/v1/build/intake/${id}", detail_source)
        self.assertIn("/v1/build/intake/${id}/branch", branch_source)
        self.assertIn("/v1/build/intake/${id}/route", route_source)
        self.assertIn("/v1/build/intake/${id}/stage", stage_source)
        self.assertIn("/v1/build/intake/${id}/pr-draft", pr_source)
        self.assertIn("/v1/build/intake/${id}/execution/start", execution_start_source)
        self.assertIn("/v1/build/intake/${id}/execution/${runId}/complete", execution_complete_source)
        self.assertIn("/v1/build/intake/${id}/verification", verification_source)

    def test_command_surface_exposes_build_intake_and_stage_controls(self):
        source = read_repo_file("apps/tufflove-web/app/familyops/router/ModelRouterClient.tsx")
        self.assertIn("Build Intake", source)
        self.assertIn("Active Build Intake Queue", source)
        self.assertIn("Create Branch Record", source)
        self.assertIn("Link Router Decision", source)
        self.assertIn("Save PR Draft Metadata", source)
        self.assertIn("Execution Runner + Proof Ingestion", source)
        self.assertIn("Complete Execution + Ingest Proof", source)
        self.assertIn("Verification Hook", source)
        self.assertIn("Build Intake + Router + Mission Timeline", source)


if __name__ == "__main__":
    unittest.main(verbosity=2)
