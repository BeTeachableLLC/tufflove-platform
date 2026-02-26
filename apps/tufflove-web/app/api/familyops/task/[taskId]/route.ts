import { proxyAdminRequest } from "../../_proxy";

type RouteParams = {
  params: Promise<{
    taskId: string;
  }>;
};

export async function GET(_: Request, { params }: RouteParams) {
  const { taskId: rawTaskId } = await params;
  const taskId = encodeURIComponent(rawTaskId);
  return proxyAdminRequest(`/v1/admin/task/${taskId}`);
}
