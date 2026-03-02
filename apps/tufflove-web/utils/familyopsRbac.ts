import "server-only";

import type { User } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/server";

type FamilyOpsAdminOk = {
  ok: true;
  user: User;
};

type FamilyOpsAdminErr = {
  ok: false;
  status: 401 | 403;
  reason: "not_signed_in" | "not_authorized";
};

export type FamilyOpsAdminResult = FamilyOpsAdminOk | FamilyOpsAdminErr;

function parseAdminAllowlist(): Set<string> {
  const raw = process.env.FAMILYOPS_ADMIN_EMAILS || "";
  return new Set(
    raw
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

export async function requireFamilyOpsAdmin(): Promise<FamilyOpsAdminResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, status: 401, reason: "not_signed_in" };
  }

  const email = user.email?.trim().toLowerCase();
  const allowlist = parseAdminAllowlist();
  if (!email || !allowlist.has(email)) {
    return { ok: false, status: 403, reason: "not_authorized" };
  }

  return { ok: true, user };
}
