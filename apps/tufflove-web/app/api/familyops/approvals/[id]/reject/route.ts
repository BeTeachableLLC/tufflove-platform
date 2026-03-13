import { NextResponse } from "next/server";
import { proxyAdminRequest } from "../../../_proxy";
import { requireFamilyOpsAdmin } from "@/utils/familyopsRbac";

type RouteParams = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(request: Request, { params }: RouteParams) {
  const access = await requireFamilyOpsAdmin();
  if (!access.ok) {
    return NextResponse.json({ error: access.reason }, { status: access.status });
  }

  const { id } = await params;
  return proxyAdminRequest(`/v1/familyops/approvals/${encodeURIComponent(id)}/reject`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: await request.text(),
  });
}
