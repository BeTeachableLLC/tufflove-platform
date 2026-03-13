from __future__ import annotations

import unittest
from unittest.mock import patch

from app import handlers


class ContentRegenerationHandlerTests(unittest.TestCase):
    def test_regeneration_creates_next_version(self):
        with (
            patch(
                "app.handlers.claim_regeneration_job",
                return_value={
                    "id": "job-1",
                    "tenant_id": "familyops",
                    "content_item_id": "content-1",
                    "requested_by": "moe",
                    "revision_note": "Tighten CTA",
                    "attempt_count": 1,
                },
            ),
            patch(
                "app.handlers.get_content_item_for_regeneration",
                return_value={
                    "id": "content-1",
                    "tenant_id": "familyops",
                    "brand_id": "beteachable",
                    "brand_name": "BeTeachable",
                    "status": "revision_requested",
                    "current_version_id": "version-1",
                    "current_version_number": 1,
                    "current_content_text": "Original content",
                },
            ),
            patch(
                "app.handlers.append_regenerated_version",
                return_value={
                    "id": "version-2",
                    "content_item_id": "content-1",
                    "version_number": 2,
                    "content_text": "Original content\n\nRevision focus: Tighten CTA",
                },
            ) as mock_append,
            patch("app.handlers.complete_regeneration_job", return_value={"id": "job-1", "status": "completed"}),
        ):
            result = handlers.handle_content_ai_regenerate(
                {
                    "tenant_id": "familyops",
                    "user_id": "ai-worker",
                    "regeneration_job_id": "job-1",
                    "content_item_id": "content-1",
                }
            )

        self.assertTrue(result["ok"])
        self.assertEqual(result["status"], "completed")
        self.assertEqual(result["content_item_id"], "content-1")
        self.assertEqual(result["version"]["version_number"], 2)
        mock_append.assert_called_once()

    def test_regeneration_failure_marks_job_failed(self):
        with (
            patch(
                "app.handlers.claim_regeneration_job",
                return_value={
                    "id": "job-2",
                    "tenant_id": "familyops",
                    "content_item_id": "missing-content",
                    "requested_by": "moe",
                    "revision_note": "Fix it",
                    "attempt_count": 2,
                },
            ),
            patch("app.handlers.get_content_item_for_regeneration", return_value=None),
            patch("app.handlers.fail_regeneration_job", return_value={"id": "job-2", "status": "failed"}) as mock_fail,
        ):
            result = handlers.handle_content_ai_regenerate({"regeneration_job_id": "job-2"})

        self.assertFalse(result["ok"])
        self.assertEqual(result["status"], "failed")
        self.assertEqual(result["note"], "regeneration_failed")
        mock_fail.assert_called_once()


if __name__ == "__main__":
    unittest.main(verbosity=2)
