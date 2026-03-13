import { NextResponse } from "next/server";
import { proxyAdminRequest } from "../../_proxy";
import { requireFamilyOpsAdmin } from "@/utils/familyopsRbac";

type Context = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(request: Request, context: Context) {
  const access = await requireFamilyOpsAdmin();
  if (!access.ok) {
    return NextResponse.json({ error: access.reason }, { status: access.status });
  }

  const { id: rawId } = await context.params;
  const id = encodeURIComponent(rawId);
  const url = new URL(request.url);
  const suffix = url.searchParams.toString();
  return proxyAdminRequest(`/v1/model-router/decision/${id}${suffix ? `?${suffix}` : ""}`);
}

export async function PATCH(request: Request, context: Context) {
  const access = await requireFamilyOpsAdmin();
  if (!access.ok) {
    return NextResponse.json({ error: access.reason }, { status: access.status });
  }

  const { id: rawId } = await context.params;
  const id = encodeURIComponent(rawId);
  const body = await request.text();
  return proxyAdminRequest(`/v1/model-router/decision/${id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body,
  });
}
