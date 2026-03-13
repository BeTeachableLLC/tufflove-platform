import { NextResponse } from "next/server";
import { proxyAdminRequest } from "../_proxy";
import { requireFamilyOpsAdmin } from "@/utils/familyopsRbac";

export async function GET(request: Request) {
  const access = await requireFamilyOpsAdmin();
  if (!access.ok) {
    return NextResponse.json({ error: access.reason }, { status: access.status });
  }

  const requestUrl = new URL(request.url);
  const query = requestUrl.searchParams.toString();
  const suffix = query ? `?${query}` : "";
  return proxyAdminRequest(`/v1/familyops/approvals${suffix}`);
}
