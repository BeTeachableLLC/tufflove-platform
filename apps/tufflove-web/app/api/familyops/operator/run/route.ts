import { NextResponse } from "next/server";
import { proxyAdminRequest } from "../../_proxy";
import { requireFamilyOpsAdmin } from "@/utils/familyopsRbac";

export async function POST(request: Request) {
  const access = await requireFamilyOpsAdmin();
  if (!access.ok) {
    return NextResponse.json({ error: access.reason }, { status: access.status });
  }

  const body = await request.text();
  return proxyAdminRequest("/v1/operator/run", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
  });
}
