import { NextResponse } from "next/server";
import { proxyAdminRequest } from "../../../_proxy";
import { requireFamilyOpsAdmin } from "@/utils/familyopsRbac";

type RouteParams = {
  params: Promise<{
    taskId: string;
  }>;
};

export async function POST(request: Request, { params }: RouteParams) {
  const access = await requireFamilyOpsAdmin();
  if (!access.ok) {
    return NextResponse.json({ error: access.reason }, { status: access.status });
  }
  const { taskId: rawTaskId } = await params;
  const taskId = encodeURIComponent(rawTaskId);
  const body = await request.text();
  return proxyAdminRequest(`/v1/admin/task/${taskId}/approve`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
  });
}
