import { NextResponse } from "next/server";
import { proxyAdminRequest } from "../../../_proxy";
import { requireFamilyOpsAdmin } from "@/utils/familyopsRbac";

type RouteParams = {
  params: Promise<{
    missionId: string;
  }>;
};

export async function GET(_: Request, { params }: RouteParams) {
  const access = await requireFamilyOpsAdmin();
  if (!access.ok) {
    return NextResponse.json({ error: access.reason }, { status: access.status });
  }

  const { missionId: rawMissionId } = await params;
  const missionId = encodeURIComponent(rawMissionId);
  return proxyAdminRequest(`/v1/operator/mission/${missionId}`);
}
