from __future__ import annotations

import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[3]


def read_repo_file(relative_path: str) -> str:
    return (REPO_ROOT / relative_path).read_text(encoding="utf-8")


class SupabaseAuthExitRegressionTests(unittest.TestCase):
    def test_familyops_rbac_uses_app_session_instead_of_supabase(self):
        source = read_repo_file("apps/tufflove-web/utils/familyopsRbac.ts")

        self.assertIn('from "@/utils/appAuth"', source)
        self.assertIn("getFamilyOpsSession", source)
        self.assertIn("isFamilyOpsAdminEmail", source)
        self.assertNotIn("@supabase/supabase-js", source)
        self.assertNotIn("supabase.auth.getUser()", source)
        self.assertIn('status: 401, reason: "not_signed_in"', source)
        self.assertIn('status: 403, reason: "not_authorized"', source)

    def test_sign_in_actions_create_familyops_session_with_supabase_fallback(self):
        source = read_repo_file("apps/tufflove-web/app/sign-in/actions.ts")

        self.assertIn("createFamilyOpsSession", source)
        self.assertIn("isFamilyOpsAdminEmail", source)
        self.assertIn("verifyFamilyOpsAdminPassword", source)
        self.assertIn("isSupabaseAuthConfigured", source)
        self.assertIn("redirect('/familyops/approvals')", source)
        self.assertIn("const supabase = await createClient()", source)

    def test_oauth_callback_and_buttons_guard_supabase_config(self):
        callback_source = read_repo_file("apps/tufflove-web/app/auth/callback/route.ts")
        oauth_source = read_repo_file("apps/tufflove-web/app/sign-in/OAuthButtons.tsx")

        self.assertIn("isSupabaseAuthConfigured", callback_source)
        self.assertIn("Supabase%20OAuth%20is%20disabled", callback_source)
        self.assertIn("isSupabaseOAuthEnabled", oauth_source)
        self.assertIn("OAuth sign-in is disabled in this environment.", oauth_source)

    def test_familyops_admin_surfaces_still_use_rbac_guard(self):
        worker_route_source = read_repo_file("apps/tufflove-web/app/api/worker/run-once/route.ts")
        agent_source = read_repo_file("apps/tufflove-web/app/agent/page.tsx")
        familyops_missions_source = read_repo_file("apps/tufflove-web/app/familyops/missions/page.tsx")

        self.assertIn("const access = await requireFamilyOpsAdmin();", worker_route_source)
        self.assertIn("const access = await requireFamilyOpsAdmin();", agent_source)
        self.assertIn("const access = await requireFamilyOpsAdmin();", familyops_missions_source)

    def test_env_example_documents_app_auth_inputs(self):
        env_source = read_repo_file("apps/tufflove-web/.env.local.example")
        self.assertIn("APP_AUTH_SECRET=", env_source)
        self.assertIn("FAMILYOPS_ADMIN_PASSWORD=", env_source)
        self.assertIn("APP_AUTH_SESSION_TTL_SECONDS=", env_source)


if __name__ == "__main__":
    unittest.main(verbosity=2)
