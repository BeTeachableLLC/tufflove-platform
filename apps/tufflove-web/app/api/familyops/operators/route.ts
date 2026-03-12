import { NextResponse } from "next/server";
import { proxyAdminRequest } from "../_proxy";
import { requireFamilyOpsAdmin } from "@/utils/familyopsRbac";

const TENANT_ID = "familyops";

export async function GET() {
  const access = await requireFamilyOpsAdmin();
  if (!access.ok) {
    return NextResponse.json({ error: access.reason }, { status: access.status });
  }

  return proxyAdminRequest(`/v1/operator/operators/${encodeURIComponent(TENANT_ID)}`);
}
