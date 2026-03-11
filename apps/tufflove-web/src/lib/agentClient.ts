const DEFAULT_AGENT_API_URL = "http://localhost:8080";

function getApiBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_AGENT_API_URL || DEFAULT_AGENT_API_URL;
  return raw.replace(/\/+$/, "");
}

async function postJson<TPayload extends object>(
  path: string,
  payload: TPayload,
): Promise<unknown> {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const detail =
      data && typeof data === "object" && "detail" in data
        ? String((data as { detail: unknown }).detail)
        : response.statusText;
    throw new Error(`Agent API ${response.status}: ${detail}`);
  }

  return data;
}

async function postSameOriginJson<TPayload extends object>(
  path: string,
  payload: TPayload,
): Promise<unknown> {
  const response = await fetch(path, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const detail =
      data && typeof data === "object" && "error" in data
        ? String((data as { error: unknown }).error)
        : data && typeof data === "object" && "detail" in data
          ? String((data as { detail: unknown }).detail)
          : response.statusText;
    throw new Error(`Request ${response.status}: ${detail}`);
  }

  return data;
}

export async function chat(message: string, userId: string = "web-demo"): Promise<unknown> {
  return postJson("/v1/chat", {
    tenant_id: "tufflove",
    user_id: userId,
    message,
  });
}

export async function enqueueFamilyTask(
  task_type: string,
  payload: unknown,
  userId: string = "moe",
): Promise<unknown> {
  return postSameOriginJson("/api/familyops/task/enqueue", {
    tenant_id: "familyops",
    user_id: userId,
    task_type,
    payload,
  });
}

export async function runWorkerOnce(): Promise<unknown> {
  return postSameOriginJson("/api/worker/run-once", {});
}
