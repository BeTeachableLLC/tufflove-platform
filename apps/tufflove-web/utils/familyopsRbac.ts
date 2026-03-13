import "server-only";

import type { AppSessionUser } from "@/utils/appAuth";
import { getFamilyOpsSession, isFamilyOpsAdminEmail } from "@/utils/appAuth";

type FamilyOpsAdminOk = {
  ok: true;
  user: AppSessionUser;
};

type FamilyOpsAdminErr = {
  ok: false;
  status: 401 | 403;
  reason: "not_signed_in" | "not_authorized";
};

export type FamilyOpsAdminResult = FamilyOpsAdminOk | FamilyOpsAdminErr;

export async function requireFamilyOpsAdmin(): Promise<FamilyOpsAdminResult> {
  const user = await getFamilyOpsSession();

  if (!user) {
    return { ok: false, status: 401, reason: "not_signed_in" };
  }

  if (!isFamilyOpsAdminEmail(user.email)) {
    return { ok: false, status: 403, reason: "not_authorized" };
  }

  return { ok: true, user };
}
