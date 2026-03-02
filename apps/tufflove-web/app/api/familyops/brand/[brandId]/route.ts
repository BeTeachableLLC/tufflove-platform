import { NextResponse } from "next/server";
import { proxyAdminRequest } from "../../_proxy";
import { requireFamilyOpsAdmin } from "@/utils/familyopsRbac";

type RouteParams = {
  params: Promise<{
    brandId: string;
  }>;
};

export async function PUT(request: Request, { params }: RouteParams) {
  const access = await requireFamilyOpsAdmin();
  if (!access.ok) {
    return NextResponse.json({ error: access.reason }, { status: access.status });
  }
  const { brandId: rawBrandId } = await params;
  const brandId = encodeURIComponent(rawBrandId);
  const body = await request.text();
  return proxyAdminRequest(`/v1/admin/brand/familyops/${brandId}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body,
  });
}
