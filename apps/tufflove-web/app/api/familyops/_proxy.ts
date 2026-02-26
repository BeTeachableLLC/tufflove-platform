import { NextResponse } from "next/server";

const DEFAULT_API_URL = "http://localhost:8080";

function getApiBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_AGENT_API_URL || DEFAULT_API_URL;
  return raw.replace(/\/+$/, "");
}

function getAdminToken(): string {
  const token = process.env.AGENT_ADMIN_TOKEN?.trim();
  if (!token) {
    throw new Error("AGENT_ADMIN_TOKEN is not set. Add it to apps/tufflove-web/.env.local.");
  }
  return token;
}

export async function proxyAdminRequest(
  targetPath: string,
  init: RequestInit = {},
): Promise<Response> {
  let token: string;
  try {
    token = getAdminToken();
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "AGENT_ADMIN_TOKEN is missing." },
      { status: 500 },
    );
  }

  const response = await fetch(`${getApiBaseUrl()}${targetPath}`, {
    ...init,
    cache: "no-store",
    headers: {
      "x-admin-token": token,
      ...(init.headers || {}),
    },
  });

  const contentType = response.headers.get("content-type") || "";
  const text = await response.text();

  if (contentType.includes("application/json")) {
    try {
      const json = JSON.parse(text);
      return NextResponse.json(json, { status: response.status });
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
