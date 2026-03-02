import { NextResponse } from "next/server";
import { requireFamilyOpsAdmin } from "@/utils/familyopsRbac";

const DEFAULT_API_URL = "http://localhost:8080";

function getApiBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_AGENT_API_URL || DEFAULT_API_URL;
  return raw.replace(/\/+$/, "");
}

function buildApprovalsRedirect(
  request: Request,
  ghl: "connected" | "error" | "forbidden",
  message?: string,
): NextResponse {
  const url = new URL("/familyops/approvals", request.url);
  url.searchParams.set("ghl", ghl);
  if (message) {
    url.searchParams.set("message", message);
  }
  return NextResponse.redirect(url);
}

export async function GET(request: Request) {
  const access = await requireFamilyOpsAdmin();
  if (!access.ok && access.status === 401) {
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }
  if (!access.ok && access.status === 403) {
    return buildApprovalsRedirect(request, "forbidden", "Not authorized for FamilyOps OAuth.");
  }

  const url = new URL(request.url);
  const code = url.searchParams.get("code")?.trim() || "";
  const tenantId = url.searchParams.get("state")?.trim() || "familyops";
  const locationId =
    url.searchParams.get("locationId")?.trim() ||
    url.searchParams.get("location_id")?.trim() ||
    "";

  if (!code) {
    return buildApprovalsRedirect(request, "error", "OAuth callback missing code.");
  }

  const response = await fetch(`${getApiBaseUrl()}/v1/ghl/oauth/callback`, {
    method: "POST",
    cache: "no-store",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ code, tenant_id: tenantId, location_id: locationId }),
  });

  if (!response.ok) {
    const text = await response.text();
    const detail = text.slice(0, 180) || `OAuth callback failed (${response.status})`;
    return buildApprovalsRedirect(request, "error", detail);
  }

  return buildApprovalsRedirect(request, "connected", "GoHighLevel connected.");
}
