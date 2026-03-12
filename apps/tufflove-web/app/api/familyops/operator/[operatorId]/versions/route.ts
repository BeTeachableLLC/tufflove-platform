import { NextResponse } from "next/server";
import { proxyAdminRequest } from "../../../_proxy";
import { requireFamilyOpsAdmin } from "@/utils/familyopsRbac";

const TENANT_ID = "familyops";

type RouteParams = {
  params: Promise<{
    operatorId: string;
  }>;
};

export async function GET(_: Request, { params }: RouteParams) {
  const access = await requireFamilyOpsAdmin();
  if (!access.ok) {
    return NextResponse.json({ error: access.reason }, { status: access.status });
  }

  const { operatorId: rawOperatorId } = await params;
  const operatorId = encodeURIComponent(rawOperatorId);
  return proxyAdminRequest(`/v1/operator/versions?tenant_id=${encodeURIComponent(TENANT_ID)}&operator_id=${operatorId}`);
}
