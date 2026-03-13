import { NextResponse } from "next/server";
import { proxyAdminRequest } from "../_proxy";
import { requireFamilyOpsAdmin } from "@/utils/familyopsRbac";

const TENANT_ID = "familyops";

export async function GET(request: Request) {
  const access = await requireFamilyOpsAdmin();
  if (!access.ok) {
    return NextResponse.json({ error: access.reason }, { status: access.status });
  }

  const url = new URL(request.url);
  const params = new URLSearchParams(url.search);
  params.set("tenant_id", TENANT_ID);
  const suffix = params.toString() ? `?${params.toString()}` : "";
  return proxyAdminRequest(`/v1/build/intake${suffix}`);
}

export async function POST(request: Request) {
  const access = await requireFamilyOpsAdmin();
  if (!access.ok) {
    return NextResponse.json({ error: access.reason }, { status: access.status });
  }

  let payload: Record<string, unknown> = {};
  try {
    const parsed = await request.json();
    if (parsed && typeof parsed === "object") {
      payload = parsed as Record<string, unknown>;
    }
  } catch {
    payload = {};
  }

  return proxyAdminRequest("/v1/build/intake", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...payload, tenant_id: TENANT_ID }),
  });
}
