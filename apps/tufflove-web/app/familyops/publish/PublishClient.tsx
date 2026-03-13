"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type Brand = {
  id: string;
  tenant_id: string;
  name: string;
  ghl_location_id: string | null;
  timezone: string;
  default_platforms: string[];
  status: "active" | "inactive";
  created_at: string | null;
  updated_at: string | null;
};

type Approval = {
  status?: string;
  approved_by?: string | null;
  approved_at?: string | null;
  note?: string | null;
} | null;

type TaskDetails = {
  task_id: string;
  tenant_id: string;
  user_id: string;
  task_type: string;
  status: string;
  payload?: unknown;
  result?: unknown;
  error?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  approval?: Approval;
};

type PublishClientProps = {
  operatorUserId: string;
};

type StatusTone = "neutral" | "warning" | "success" | "error";

type UiStatus = {
  tone: StatusTone;
  title: string;
  detail: string;
};

const COMMON_PLATFORMS = ["fb", "ig", "linkedin", "x"];

function payloadRecord(payload: unknown): Record<string, unknown> | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  return payload as Record<string, unknown>;
}

async function readResponse(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return response.json().catch(() => ({}));
  }
  return response.text();
}

function parseError(payload: unknown, fallback: string): string {
  if (typeof payload === "string" && payload.trim()) return payload;
  if (payload && typeof payload === "object") {
    const data = payload as Record<string, unknown>;
    if (typeof data.error === "string" && data.error.trim()) return data.error;
    if (typeof data.detail === "string" && data.detail.trim()) return data.detail;
  }
  return fallback;
}

function pretty(value: unknown): string {
  if (value === null || value === undefined) return "";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function resolveUiStatus(task: TaskDetails | null): UiStatus | null {
  if (!task) return null;

  const result = payloadRecord(task.result);
  const resultStatus = typeof result?.status === "string" ? result.status : "";
  const resultNote = typeof result?.note === "string" ? result.note : "";
  const approvalStatus = task.approval?.status || "";

  if (resultStatus === "would_publish") {
    const payloadToSend = payloadRecord(result?.payload_to_send);
    const dryRun = payloadToSend?.dry_run === true;
    return {
      tone: dryRun ? "success" : "warning",
      title: dryRun ? "Would Publish (Dry-Run)" : "Would Publish",
      detail: dryRun
        ? "Publish completed the approval gate and ended in dry-run mode."
        : "Publish completed but dry_run flag was not detected.",
    };
  }

  if (approvalStatus === "pending" && task.status === "queued") {
    return {
      tone: "neutral",
      title: "Queued",
      detail: "Task is queued and pending FamilyOps approval.",
    };
  }

  if (
    (task.status === "blocked" || resultStatus === "blocked") &&
    (resultNote === "approval_required" || approvalStatus === "pending")
  ) {
    return {
      tone: "warning",
      title: "Blocked Pending Approval",
      detail: "Worker blocked this publish until approval is recorded.",
    };
  }

  if (task.status === "failed" || resultStatus === "failed" || Boolean(task.error)) {
    return {
      tone: "error",
      title: "Error",
      detail: task.error || resultNote || "Task failed.",
    };
  }

  return {
    tone: "neutral",
    title: `Task Status: ${task.status}`,
    detail: resultNote || "Task is in progress or awaiting additional action.",
  };
}

function statusStyles(tone: StatusTone): { border: string; background: string; color: string } {
  if (tone === "success") {
    return { border: "1px solid #14532d", background: "#0b1f13", color: "#bbf7d0" };
  }
  if (tone === "warning") {
    return { border: "1px solid #92400e", background: "#1f1308", color: "#fcd34d" };
  }
  if (tone === "error") {
    return { border: "1px solid #7f1d1d", background: "#111", color: "#fecaca" };
  }
  return { border: "1px solid #374151", background: "#111827", color: "#d1d5db" };
}

export default function PublishClient({ operatorUserId }: PublishClientProps) {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [brandsLoading, setBrandsLoading] = useState(false);
  const [brandsError, setBrandsError] = useState<string | null>(null);

  const [selectedBrandId, setSelectedBrandId] = useState("");
  const [selectedLocationId, setSelectedLocationId] = useState("");
  const [topic, setTopic] = useState("");
  const [platform, setPlatform] = useState("fb");

  const [currentTaskId, setCurrentTaskId] = useState("");
  const [taskDetails, setTaskDetails] = useState<TaskDetails | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);

  const [enqueueLoading, setEnqueueLoading] = useState(false);
  const [enqueueError, setEnqueueError] = useState<string | null>(null);
  const [enqueueResult, setEnqueueResult] = useState<unknown>(null);

  const [approvalNote, setApprovalNote] = useState("");
  const [approveLoading, setApproveLoading] = useState(false);
  const [approveError, setApproveError] = useState<string | null>(null);
  const [approveResult, setApproveResult] = useState<unknown>(null);

  const [workerLoading, setWorkerLoading] = useState(false);
  const [workerError, setWorkerError] = useState<string | null>(null);
  const [workerResult, setWorkerResult] = useState<unknown>(null);

  const activeBrands = useMemo(
    () => brands.filter((brand) => brand.status === "active" && Boolean(brand.ghl_location_id?.trim())),
    [brands],
  );

  const selectedBrand = useMemo(
    () => activeBrands.find((brand) => brand.id === selectedBrandId) ?? null,
    [activeBrands, selectedBrandId],
  );

  const availablePlatforms = useMemo(() => {
    const values = new Set(COMMON_PLATFORMS);
    for (const brand of activeBrands) {
      for (const candidate of brand.default_platforms || []) {
        const normalized = candidate.trim();
        if (normalized) values.add(normalized);
      }
    }
    return Array.from(values);
  }, [activeBrands]);

  const uiStatus = useMemo(() => resolveUiStatus(taskDetails), [taskDetails]);

  const loadBrands = useCallback(async () => {
    setBrandsLoading(true);
    setBrandsError(null);
    try {
      const response = await fetch("/api/familyops/brands", { cache: "no-store" });
      const payload = await readResponse(response);
      if (!response.ok) {
        throw new Error(parseError(payload, `Failed to load brands (${response.status})`));
      }
      const list =
        payload && typeof payload === "object" && Array.isArray((payload as { brands?: unknown[] }).brands)
          ? ((payload as { brands: Brand[] }).brands || [])
          : [];
      setBrands(list);
    } catch (error) {
      setBrandsError(error instanceof Error ? error.message : String(error));
      setBrands([]);
    } finally {
      setBrandsLoading(false);
    }
  }, []);

  const loadTaskDetails = useCallback(async (taskId: string) => {
    const normalizedTaskId = taskId.trim();
    if (!normalizedTaskId) return;
    setDetailsLoading(true);
    setDetailsError(null);
    try {
      const response = await fetch(`/api/familyops/task/${encodeURIComponent(normalizedTaskId)}`, {
        cache: "no-store",
      });
      const payload = await readResponse(response);
      if (!response.ok) {
        throw new Error(parseError(payload, `Failed to load task (${response.status})`));
      }
      setTaskDetails(payload as TaskDetails);
    } catch (error) {
      setDetailsError(error instanceof Error ? error.message : String(error));
      setTaskDetails(null);
    } finally {
      setDetailsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadBrands();
  }, [loadBrands]);

  useEffect(() => {
    if (!selectedBrandId && activeBrands.length > 0) {
      setSelectedBrandId(activeBrands[0].id);
      setSelectedLocationId(activeBrands[0].ghl_location_id || "");
      return;
    }
    if (!selectedBrand) {
      setSelectedLocationId("");
      return;
    }
    const configuredLocation = selectedBrand.ghl_location_id || "";
    if (configuredLocation !== selectedLocationId) {
      setSelectedLocationId(configuredLocation);
    }
  }, [activeBrands, selectedBrand, selectedBrandId, selectedLocationId]);

  useEffect(() => {
    if (!availablePlatforms.includes(platform)) {
      setPlatform(availablePlatforms[0] || "fb");
    }
  }, [availablePlatforms, platform]);

  const canEnqueue =
    Boolean(selectedBrand) &&
    Boolean(selectedLocationId) &&
    selectedBrand?.ghl_location_id === selectedLocationId &&
    Boolean(topic.trim()) &&
    Boolean(platform.trim()) &&
    !enqueueLoading;

  async function onEnqueue(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setEnqueueError(null);
    setApproveError(null);
    setWorkerError(null);
    setDetailsError(null);

    if (!selectedBrand) {
      setEnqueueError("Select an active brand with a configured location.");
      return;
    }
    const configuredLocation = selectedBrand.ghl_location_id || "";
    if (!configuredLocation || configuredLocation !== selectedLocationId) {
      setEnqueueError("Select the configured location for the chosen brand.");
      return;
    }
    if (!topic.trim()) {
      setEnqueueError("Topic is required.");
      return;
    }
    if (!platform.trim()) {
      setEnqueueError("Platform is required.");
      return;
    }

    setEnqueueLoading(true);
    try {
      const response = await fetch("/api/familyops/task/enqueue", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          tenant_id: "familyops",
          user_id: operatorUserId,
          task_type: "ghl.social.publish",
          payload: {
            brand_id: selectedBrand.id,
            location_id: selectedLocationId,
            topic: topic.trim(),
            platforms: [platform.trim()],
          },
        }),
      });
      const payload = await readResponse(response);
      if (!response.ok) {
        throw new Error(parseError(payload, `Failed to enqueue publish task (${response.status})`));
      }

      const taskId =
        payload && typeof payload === "object" && typeof (payload as { task_id?: unknown }).task_id === "string"
          ? ((payload as { task_id: string }).task_id || "").trim()
          : "";
      if (!taskId) {
        throw new Error("Task enqueue succeeded but no task_id was returned.");
      }
      setCurrentTaskId(taskId);
      setEnqueueResult(payload);
      await loadTaskDetails(taskId);
    } catch (error) {
      setEnqueueError(error instanceof Error ? error.message : String(error));
    } finally {
      setEnqueueLoading(false);
    }
  }

  async function onApprove() {
    const taskId = currentTaskId.trim();
    if (!taskId) {
      setApproveError("Enter or create a task first.");
      return;
    }

    setApproveLoading(true);
    setApproveError(null);
    try {
      const response = await fetch(`/api/familyops/task/${encodeURIComponent(taskId)}/approve`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          approved_by: operatorUserId,
          note: approvalNote.trim(),
        }),
      });
      const payload = await readResponse(response);
      if (!response.ok) {
        throw new Error(parseError(payload, `Failed to approve task (${response.status})`));
      }
      setApproveResult(payload);
      await loadTaskDetails(taskId);
    } catch (error) {
      setApproveError(error instanceof Error ? error.message : String(error));
    } finally {
      setApproveLoading(false);
    }
  }

  async function onRunWorker() {
    const taskId = currentTaskId.trim();
    setWorkerLoading(true);
    setWorkerError(null);
    try {
      const response = await fetch("/api/worker/run-once", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
      const payload = await readResponse(response);
      if (!response.ok) {
        throw new Error(parseError(payload, `Worker run failed (${response.status})`));
      }
      setWorkerResult(payload);
      if (taskId) {
        await loadTaskDetails(taskId);
      }
    } catch (error) {
      setWorkerError(error instanceof Error ? error.message : String(error));
    } finally {
      setWorkerLoading(false);
    }
  }

  return (
    <main style={{ maxWidth: 980, margin: "0 auto", padding: 24, fontFamily: "sans-serif" }}>
      <h1 style={{ fontSize: 30, fontWeight: 700, marginBottom: 8 }}>FamilyOps Publish Console</h1>
      <p style={{ color: "#9ca3af", marginBottom: 14 }}>
        Create and execute approval-gated <code>ghl.social.publish</code> dry-run tasks for FamilyOps brands.
      </p>
      <p style={{ marginBottom: 18 }}>
        <Link href="/familyops/approvals" style={{ textDecoration: "underline" }}>
          FamilyOps Approvals
        </Link>
        {" · "}
        <Link href="/familyops/brands" style={{ textDecoration: "underline" }}>
          FamilyOps Brands
        </Link>
        {" · "}
        <Link href="/familyops/ghl" style={{ textDecoration: "underline" }}>
          FamilyOps GHL
        </Link>
      </p>

      {brandsError ? (
        <div style={{ marginBottom: 12, color: "#ef4444", fontWeight: 600 }}>{brandsError}</div>
      ) : null}
      {enqueueError ? (
        <div style={{ marginBottom: 12, color: "#ef4444", fontWeight: 600 }}>Enqueue error: {enqueueError}</div>
      ) : null}
      {approveError ? (
        <div style={{ marginBottom: 12, color: "#ef4444", fontWeight: 600 }}>Approval error: {approveError}</div>
      ) : null}
      {workerError ? (
        <div style={{ marginBottom: 12, color: "#ef4444", fontWeight: 600 }}>Worker error: {workerError}</div>
      ) : null}
      {detailsError ? (
        <div style={{ marginBottom: 12, color: "#ef4444", fontWeight: 600 }}>Status error: {detailsError}</div>
      ) : null}

      {uiStatus ? (
        <div
          style={{
            ...statusStyles(uiStatus.tone),
            borderRadius: 8,
            padding: 12,
            marginBottom: 16,
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 4 }}>{uiStatus.title}</div>
          <div>{uiStatus.detail}</div>
        </div>
      ) : null}

      <section style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16, marginBottom: 16 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginTop: 0, marginBottom: 10 }}>1) Create Publish Task</h2>
        <form onSubmit={onEnqueue}>
          <label htmlFor="brand" style={{ display: "block", marginBottom: 6 }}>
            Brand
          </label>
          <select
            id="brand"
            value={selectedBrandId}
            onChange={(event) => setSelectedBrandId(event.target.value)}
            disabled={brandsLoading || activeBrands.length === 0}
            style={{ width: "100%", padding: 10, marginBottom: 10 }}
          >
            {activeBrands.length === 0 ? <option value="">No active configured brands</option> : null}
            {activeBrands.map((brand) => (
              <option key={brand.id} value={brand.id}>
                {brand.name} ({brand.id})
              </option>
            ))}
          </select>

          <label htmlFor="location" style={{ display: "block", marginBottom: 6 }}>
            Location
          </label>
          <select
            id="location"
            value={selectedLocationId}
            onChange={(event) => setSelectedLocationId(event.target.value)}
            disabled={!selectedBrand}
            style={{ width: "100%", padding: 10, marginBottom: 10 }}
          >
            {selectedBrand ? (
              <option value={selectedBrand.ghl_location_id || ""}>{selectedBrand.ghl_location_id || "-"}</option>
            ) : (
              <option value="">Select a brand first</option>
            )}
          </select>

          <label htmlFor="platform" style={{ display: "block", marginBottom: 6 }}>
            Platform
          </label>
          <select
            id="platform"
            value={platform}
            onChange={(event) => setPlatform(event.target.value)}
            style={{ width: "100%", padding: 10, marginBottom: 10 }}
          >
            {availablePlatforms.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>

          <label htmlFor="topic" style={{ display: "block", marginBottom: 6 }}>
            Topic
          </label>
          <textarea
            id="topic"
            value={topic}
            onChange={(event) => setTopic(event.target.value)}
            rows={4}
            placeholder="Daily post topic..."
            style={{ width: "100%", padding: 12, marginBottom: 12 }}
          />

          <button type="submit" disabled={!canEnqueue} style={{ padding: "10px 14px" }}>
            {enqueueLoading ? "Queueing..." : "Enqueue ghl.social.publish"}
          </button>
        </form>
      </section>

      <section style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16, marginBottom: 16 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginTop: 0, marginBottom: 10 }}>2) Approve + Run Worker</h2>
        <label htmlFor="taskId" style={{ display: "block", marginBottom: 6 }}>
          Task ID
        </label>
        <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
          <input
            id="taskId"
            value={currentTaskId}
            onChange={(event) => setCurrentTaskId(event.target.value)}
            placeholder="Paste or enqueue task ID"
            style={{ flex: "1 1 420px", minWidth: 280, padding: 10 }}
          />
          <button
            type="button"
            onClick={() => loadTaskDetails(currentTaskId)}
            disabled={!currentTaskId.trim() || detailsLoading}
            style={{ padding: "10px 14px" }}
          >
            {detailsLoading ? "Loading..." : "Refresh Status"}
          </button>
        </div>

        <label htmlFor="approvalNote" style={{ display: "block", marginBottom: 6 }}>
          Approval Note (optional)
        </label>
        <textarea
          id="approvalNote"
          value={approvalNote}
          onChange={(event) => setApprovalNote(event.target.value)}
          rows={2}
          style={{ width: "100%", padding: 10, marginBottom: 12 }}
        />

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={onApprove}
            disabled={!currentTaskId.trim() || approveLoading}
            style={{ padding: "10px 14px" }}
          >
            {approveLoading ? "Approving..." : "Approve Task"}
          </button>
          <button type="button" onClick={onRunWorker} disabled={workerLoading} style={{ padding: "10px 14px" }}>
            {workerLoading ? "Running..." : "Run Worker Once"}
          </button>
        </div>
      </section>

      <section style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginTop: 0, marginBottom: 10 }}>3) Task Result</h2>
        <div style={{ marginBottom: 8, color: "#9ca3af" }}>Operator ID: {operatorUserId}</div>
        <h3 style={{ marginTop: 10, marginBottom: 8, fontSize: 16 }}>Enqueue Response</h3>
        <pre style={{ background: "#111", color: "#f5f5f5", borderRadius: 6, padding: 12, overflowX: "auto" }}>
          {pretty(enqueueResult)}
        </pre>
        <h3 style={{ marginTop: 10, marginBottom: 8, fontSize: 16 }}>Approve Response</h3>
        <pre style={{ background: "#111", color: "#f5f5f5", borderRadius: 6, padding: 12, overflowX: "auto" }}>
          {pretty(approveResult)}
        </pre>
        <h3 style={{ marginTop: 10, marginBottom: 8, fontSize: 16 }}>Worker Response</h3>
        <pre style={{ background: "#111", color: "#f5f5f5", borderRadius: 6, padding: 12, overflowX: "auto" }}>
          {pretty(workerResult)}
        </pre>
        <h3 style={{ marginTop: 10, marginBottom: 8, fontSize: 16 }}>Task Details</h3>
        <pre style={{ background: "#111", color: "#f5f5f5", borderRadius: 6, padding: 12, overflowX: "auto" }}>
          {pretty(taskDetails)}
        </pre>
      </section>
    </main>
  );
}
