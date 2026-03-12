import { NextResponse } from "next/server";
import { proxyAdminRequest } from "../../../../_proxy";
import { requireFamilyOpsAdmin } from "@/utils/familyopsRbac";

type RouteParams = {
  params: Promise<{
    versionId: string;
  }>;
};

export async function POST(request: Request, { params }: RouteParams) {
  const access = await requireFamilyOpsAdmin();
  if (!access.ok) {
    return NextResponse.json({ error: access.reason }, { status: access.status });
  }

  const { versionId: rawVersionId } = await params;
  const versionId = encodeURIComponent(rawVersionId);
  const body = await request.text();
  return proxyAdminRequest(`/v1/operator/version/${versionId}/activate`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
  });
}
