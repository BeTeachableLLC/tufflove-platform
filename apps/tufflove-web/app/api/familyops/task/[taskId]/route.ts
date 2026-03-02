import { NextResponse } from "next/server";
import { proxyAdminRequest } from "../../_proxy";
import { requireFamilyOpsAdmin } from "@/utils/familyopsRbac";

type RouteParams = {
  params: Promise<{
    taskId: string;
  }>;
};

export async function GET(_: Request, { params }: RouteParams) {
  const access = await requireFamilyOpsAdmin();
  if (!access.ok) {
    return NextResponse.json({ error: access.reason }, { status: access.status });
  }
  const { taskId: rawTaskId } = await params;
  const taskId = encodeURIComponent(rawTaskId);
  return proxyAdminRequest(`/v1/admin/task/${taskId}`);
}
