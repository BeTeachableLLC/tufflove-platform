import { NextResponse } from "next/server";
import { requireFamilyOpsAdmin } from "@/utils/familyopsRbac";

const DEFAULT_API_URL = "http://localhost:8080";

function getApiBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_AGENT_API_URL || DEFAULT_API_URL;
  return raw.replace(/\/+$/, "");
}

export async function GET() {
  const access = await requireFamilyOpsAdmin();
  if (!access.ok) {
    return NextResponse.json({ error: access.reason }, { status: access.status });
  }

  const response = await fetch(
    `${getApiBaseUrl()}/v1/ghl/oauth/start?tenant_id=${encodeURIComponent("familyops")}`,
    { cache: "no-store" },
  );
  const contentType = response.headers.get("content-type") || "";
  const text = await response.text();

  if (contentType.includes("application/json")) {
    try {
      return NextResponse.json(JSON.parse(text), { status: response.status });
    } catch {
      return NextResponse.json(
        { error: "Backend returned invalid JSON", raw: text },
        { status: response.status },
      );
    }
  }

  return new Response(text, {
    status: response.status,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
