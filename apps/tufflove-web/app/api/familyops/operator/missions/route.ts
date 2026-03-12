import { NextResponse } from "next/server";
import { proxyAdminRequest } from "../../_proxy";
import { requireFamilyOpsAdmin } from "@/utils/familyopsRbac";

const TENANT_ID = "familyops";

export async function GET(request: Request) {
  const access = await requireFamilyOpsAdmin();
  if (!access.ok) {
    return NextResponse.json({ error: access.reason }, { status: access.status });
  }

  const { searchParams } = new URL(request.url);
  const params = new URLSearchParams(searchParams);
  params.set("tenant_id", TENANT_ID);
  return proxyAdminRequest(`/v1/operator/missions?${params.toString()}`);
}
