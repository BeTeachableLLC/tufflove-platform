import { proxyAdminRequest } from "../../../_proxy";

type RouteParams = {
  params: Promise<{
    taskId: string;
  }>;
};

export async function POST(request: Request, { params }: RouteParams) {
  const { taskId: rawTaskId } = await params;
  const taskId = encodeURIComponent(rawTaskId);
  const body = await request.text();
  return proxyAdminRequest(`/v1/admin/task/${taskId}/reject`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
  });
}
