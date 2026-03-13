import { NextResponse } from "next/server";
import { proxyAdminRequest } from "../../../_proxy";
import { requireFamilyOpsAdmin } from "@/utils/familyopsRbac";

type RouteParams = {
  params: Promise<{
    versionId: string;
  }>;
};

export async function GET(_: Request, { params }: RouteParams) {
  const access = await requireFamilyOpsAdmin();
  if (!access.ok) {
    return NextResponse.json({ error: access.reason }, { status: access.status });
  }

  const { versionId: rawVersionId } = await params;
  const versionId = encodeURIComponent(rawVersionId);
  return proxyAdminRequest(`/v1/operator/version/${versionId}`);
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const access = await requireFamilyOpsAdmin();
  if (!access.ok) {
    return NextResponse.json({ error: access.reason }, { status: access.status });
  }

  const { versionId: rawVersionId } = await params;
  const versionId = encodeURIComponent(rawVersionId);
  const body = await request.text();
  return proxyAdminRequest(`/v1/operator/version/${versionId}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body,
  });
}
