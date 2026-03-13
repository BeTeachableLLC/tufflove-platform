from __future__ import annotations

import unittest
from unittest.mock import patch

from app import main


class BrandAwareApprovalsApiTests(unittest.TestCase):
    def test_list_approvals_returns_items_and_filter_metadata(self):
        with (
            patch("app.main.get_tenant_policy_bundle", return_value={"id": "familyops", "status": "active"}),
            patch(
                "app.main.list_approval_items",
                return_value={"tenant_id": "familyops", "items": [{"id": "content-1"}], "total": 1, "limit": 50, "offset": 0},
            ) as mock_list,
            patch("app.main.list_subaccounts", return_value=[{"id": "sa-1", "name": "Subaccount 1", "status": "active"}]),
            patch("app.main.list_brands_with_subaccounts", return_value=[{"id": "brand-1", "name": "Brand 1", "status": "active"}]),
        ):
            response = main.familyops_list_approvals(
                subaccount_id="sa-1",
                brand_id="brand-1",
                platform="fb",
                status="ready_for_review",
                date_from="2026-03-13T00:00:00Z",
                date_to="2026-03-13T23:59:59Z",
                search="cta",
                limit=25,
                offset=0,
            )

        self.assertEqual(response["total"], 1)
        self.assertEqual(response["items"][0]["id"], "content-1")
        self.assertEqual(response["subaccounts"][0]["id"], "sa-1")
        self.assertEqual(response["brands"][0]["id"], "brand-1")
        mock_list.assert_called_once()

    def test_get_approval_detail(self):
        with (
            patch("app.main.get_tenant_policy_bundle", return_value={"id": "familyops", "status": "active"}),
            patch(
                "app.main.get_content_approval_item",
                return_value={"id": "content-1", "tenant_id": "familyops", "status": "ready_for_review"},
            ),
        ):
            response = main.familyops_get_approval("content-1")

        self.assertEqual(response["id"], "content-1")
        self.assertEqual(response["status"], "ready_for_review")

    def test_approve_and_reject_actions(self):
        with (
            patch("app.main.get_tenant_policy_bundle", return_value={"id": "familyops", "status": "active"}),
            patch("app.main.get_content_approval_item", return_value={"id": "content-1", "tenant_id": "familyops"}),
            patch("app.main.approve_content_item", return_value={"id": "content-1", "status": "approved"}) as mock_approve,
            patch("app.main.reject_content_item", return_value={"id": "content-1", "status": "rejected"}) as mock_reject,
        ):
            approved = main.familyops_approve_content("content-1", main.ContentReviewRequest(reviewer="moe", note="Ship it"))
            rejected = main.familyops_reject_content("content-1", main.ContentReviewRequest(reviewer="moe", note="Needs work"))

        self.assertTrue(approved["ok"])
        self.assertEqual(approved["item"]["status"], "approved")
        self.assertTrue(rejected["ok"])
        self.assertEqual(rejected["item"]["status"], "rejected")
        mock_approve.assert_called_once()
        mock_reject.assert_called_once()

    def test_request_revision_creates_job_and_enqueues_regeneration_task(self):
        with (
            patch("app.main.get_tenant_policy_bundle", return_value={"id": "familyops", "status": "active"}),
            patch("app.main.get_content_approval_item", return_value={"id": "content-1", "tenant_id": "familyops"}),
            patch(
                "app.main.request_content_revision",
                return_value={
                    "item": {"id": "content-1", "tenant_id": "familyops", "status": "revision_requested"},
                    "job": {"id": "job-1", "status": "queued"},
                },
            ) as mock_revision,
            patch(
                "app.main.enqueue_task_internal",
                return_value={"ok": True, "task_id": "regen-task-1", "approval_required": False},
            ) as mock_enqueue,
        ):
            response = main.familyops_request_revision(
                "content-1",
                main.ContentReviewRequest(reviewer="moe", note="Tighten value prop and CTA"),
            )

        self.assertTrue(response["ok"])
        self.assertEqual(response["job"]["id"], "job-1")
        self.assertEqual(response["regeneration_task"]["task_id"], "regen-task-1")
        mock_revision.assert_called_once()
        mock_enqueue.assert_called_once()
        _, kwargs = mock_enqueue.call_args
        self.assertEqual(kwargs["task_type"], "content.ai.regenerate")
        self.assertEqual(kwargs["payload"]["content_item_id"], "content-1")
        self.assertEqual(kwargs["payload"]["regeneration_job_id"], "job-1")

    def test_enqueue_publish_auto_creates_content_item_when_missing(self):
        with (
            patch("app.main._validate_task_enqueue_request"),
            patch("app.main.uuid4", return_value="task-fixed-id"),
            patch("app.main.create_content_item_for_publish_task", return_value={"id": "content-1"}) as mock_create_item,
            patch("app.main.upsert_task_log") as mock_upsert,
            patch("app.main.create_approval") as mock_approval,
            patch("app.main.enqueue") as mock_enqueue,
        ):
            response = main.enqueue_task_internal(
                tenant_id="familyops",
                user_id="moe",
                task_type="ghl.social.publish",
                payload={"brand_id": "beteachable", "location_id": "loc-123", "topic": "hello"},
            )

        self.assertTrue(response["ok"])
        self.assertEqual(response["task_id"], "task-fixed-id")
        self.assertTrue(response["approval_required"])
        mock_create_item.assert_called_once()
        mock_approval.assert_called_once_with("task-fixed-id", "familyops")
        _, kwargs = mock_upsert.call_args
        self.assertEqual(kwargs["payload"]["content_item_id"], "content-1")
        queued = mock_enqueue.call_args.args[0]
        self.assertEqual(queued["payload"]["content_item_id"], "content-1")


if __name__ == "__main__":
    unittest.main(verbosity=2)
