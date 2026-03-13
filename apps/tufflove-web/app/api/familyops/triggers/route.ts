import { NextResponse } from "next/server";
import { proxyAdminRequest } from "../_proxy";
import { requireFamilyOpsAdmin } from "@/utils/familyopsRbac";

const TENANT_ID = "familyops";

export async function GET() {
  const access = await requireFamilyOpsAdmin();
  if (!access.ok) {
    return NextResponse.json({ error: access.reason }, { status: access.status });
  }

  return proxyAdminRequest(`/v1/triggers?tenant_id=${encodeURIComponent(TENANT_ID)}`);
}

export async function POST(request: Request) {
  const access = await requireFamilyOpsAdmin();
  if (!access.ok) {
    return NextResponse.json({ error: access.reason }, { status: access.status });
  }

  const body = await request.text();
  return proxyAdminRequest("/v1/trigger/register", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
  });
}
