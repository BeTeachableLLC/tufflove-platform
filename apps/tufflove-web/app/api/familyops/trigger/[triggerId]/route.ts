import { NextResponse } from "next/server";
import { proxyAdminRequest } from "../../_proxy";
import { requireFamilyOpsAdmin } from "@/utils/familyopsRbac";

type RouteParams = {
  params: Promise<{
    triggerId: string;
  }>;
};

export async function PATCH(request: Request, { params }: RouteParams) {
  const access = await requireFamilyOpsAdmin();
  if (!access.ok) {
    return NextResponse.json({ error: access.reason }, { status: access.status });
  }

  const { triggerId: rawTriggerId } = await params;
  const triggerId = encodeURIComponent(rawTriggerId);
  const body = await request.text();
  return proxyAdminRequest(`/v1/trigger/${triggerId}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body,
  });
}
