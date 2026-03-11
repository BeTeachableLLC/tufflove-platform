import { NextResponse } from "next/server";
import { requireFamilyOpsAdmin } from "@/utils/familyopsRbac";

const DEFAULT_WORKER_API_URL = "http://127.0.0.1:8081";

function getWorkerBaseUrl(): string {
  const raw = process.env.WORKER_API_URL || DEFAULT_WORKER_API_URL;
  return raw.replace(/\/+$/, "");
}

export async function POST() {
  const access = await requireFamilyOpsAdmin();
  if (!access.ok) {
    return NextResponse.json({ error: access.reason }, { status: access.status });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  const workerToken = process.env.WORKER_ADMIN_TOKEN?.trim();
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (workerToken) headers["x-worker-token"] = workerToken;

  try {
    const response = await fetch(`${getWorkerBaseUrl()}/v1/worker/run_once`, {
      method: "POST",
      headers,
      body: "{}",
      cache: "no-store",
      signal: controller.signal,
    });

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      const detail =
        data && typeof data === "object" && "detail" in data
          ? String((data as { detail: unknown }).detail)
          : response.statusText;
      return NextResponse.json({ error: `Worker ${response.status}: ${detail}` }, { status: response.status });
    }

    return NextResponse.json(data ?? { ok: true });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return NextResponse.json({ error: "Worker request timed out." }, { status: 504 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Worker request failed." },
      { status: 502 },
    );
  } finally {
    clearTimeout(timeout);
  }
}
