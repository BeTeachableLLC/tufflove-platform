import { proxyAdminRequest } from "../_proxy";

export async function GET() {
  return proxyAdminRequest("/v1/admin/tasks/familyops");
}
