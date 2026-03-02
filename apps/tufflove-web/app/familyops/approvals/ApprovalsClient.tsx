"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

type TaskListItem = {
  task_id: string;
  task_type: string;
  status: string;
  created_at: string | null;
  payload?: unknown;
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

function pretty(value: unknown): string {
  if (value === null || value === undefined) return "";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

async function parseResponse(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return response.json().catch(() => ({}));
  }
  return response.text();
}

function normalizeError(payload: unknown, fallback: string): string {
  if (typeof payload === "string" && payload.trim()) return payload;
  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    if (typeof record.error === "string" && record.error.trim()) return record.error;
    if (typeof record.detail === "string" && record.detail.trim()) return record.detail;
  }
  return fallback;
}

function payloadRecord(payload: unknown): Record<string, unknown> | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  return payload as Record<string, unknown>;
}

function taskBrandId(task: TaskListItem | TaskDetails | null): string {
  const payload = payloadRecord(task?.payload);
  const value = payload?.brand_id;
  return typeof value === "string" ? value : "";
}

function taskLocationId(task: TaskListItem | TaskDetails | null): string {
  const payload = payloadRecord(task?.payload);
  const value = payload?.location_id;
  return typeof value === "string" ? value : "";
}

export default function FamilyOpsApprovalsPage() {
  const searchParams = useSearchParams();
  const [tasks, setTasks] = useState<TaskListItem[]>([]);
  const [brandFilter, setBrandFilter] = useState<string>("all");
  const [tasksLoading, setTasksLoading] = useState(false);
  const [tasksError, setTasksError] = useState<string | null>(null);

  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [details, setDetails] = useState<TaskDetails | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const loadTasks = useCallback(async () => {
    setTasksLoading(true);
    setTasksError(null);
    try {
      const response = await fetch("/api/familyops/tasks", { cache: "no-store" });
      const payload = await parseResponse(response);
      if (!response.ok) {
        throw new Error(normalizeError(payload, `Failed to load tasks (${response.status})`));
      }

      const records =
        payload && typeof payload === "object" && Array.isArray((payload as { tasks?: unknown[] }).tasks)
          ? ((payload as { tasks: TaskListItem[] }).tasks || [])
          : [];
      setTasks(records.slice(0, 25));
    } catch (error) {
      setTasksError(error instanceof Error ? error.message : String(error));
      setTasks([]);
    } finally {
      setTasksLoading(false);
    }
  }, []);

  const loadTaskDetails = useCallback(async (taskId: string) => {
    setDetailsLoading(true);
    setDetailsError(null);
    setActionError(null);
    try {
      const response = await fetch(`/api/familyops/task/${encodeURIComponent(taskId)}`, {
        cache: "no-store",
      });
      const payload = await parseResponse(response);
      if (!response.ok) {
        throw new Error(normalizeError(payload, `Failed to load task details (${response.status})`));
      }
      setDetails(payload as TaskDetails);
      setSelectedTaskId(taskId);
    } catch (error) {
      setDetailsError(error instanceof Error ? error.message : String(error));
      setDetails(null);
      setSelectedTaskId(taskId);
    } finally {
      setDetailsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const approvalStatus = details?.approval?.status || null;
  const canDecide =
    details?.task_type === "ghl.social.publish" &&
    approvalStatus === "pending" &&
    !detailsLoading &&
    !actionLoading;

  const runDecision = useCallback(
    async (decision: "approve" | "reject") => {
      if (!details?.task_id) return;
      const approvedBy = window.prompt(
        `${decision === "approve" ? "Approve" : "Reject"} by (required):`,
        "moe",
      );
      if (!approvedBy || !approvedBy.trim()) return;
      const note = window.prompt("Note (optional):", "") ?? "";

      setActionLoading(true);
      setActionError(null);
      try {
        const response = await fetch(
          `/api/familyops/task/${encodeURIComponent(details.task_id)}/${decision}`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ approved_by: approvedBy.trim(), note }),
          },
        );
        const payload = await parseResponse(response);
        if (!response.ok) {
          throw new Error(
            normalizeError(payload, `${decision} failed (${response.status})`),
          );
        }
        await Promise.all([loadTasks(), loadTaskDetails(details.task_id)]);
      } catch (error) {
        setActionError(error instanceof Error ? error.message : String(error));
      } finally {
        setActionLoading(false);
      }
    },
    [details?.task_id, loadTaskDetails, loadTasks],
  );

  const selectedHeader = useMemo(() => {
    if (!details) return "Select a task";
    return `${details.task_type} • ${details.task_id}`;
  }, [details]);

  const brandOptions = useMemo(() => {
    const brands = new Set<string>();
    for (const task of tasks) {
      const brandId = taskBrandId(task);
      if (brandId) brands.add(brandId);
    }
    return Array.from(brands).sort();
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    if (brandFilter === "all") return tasks;
    return tasks.filter((task) => taskBrandId(task) === brandFilter);
  }, [brandFilter, tasks]);

  useEffect(() => {
    if (!selectedTaskId && filteredTasks.length > 0) {
      loadTaskDetails(filteredTasks[0].task_id);
    }
  }, [filteredTasks, loadTaskDetails, selectedTaskId]);

  const detailBrandId = taskBrandId(details);
  const detailLocationId = taskLocationId(details);

  const ghlStatus = searchParams.get("ghl");
  const ghlMessage = searchParams.get("message");
  const showSuccess = ghlStatus === "connected";
  const showWarning = ghlStatus === "error" || ghlStatus === "forbidden";

  return (
    <main style={{ maxWidth: 1240, margin: "0 auto", padding: 24, fontFamily: "sans-serif" }}>
      <h1 style={{ fontSize: 30, fontWeight: 700, marginBottom: 6 }}>FamilyOps Approval Center</h1>
      <p style={{ marginBottom: 20, color: "#9ca3af" }}>
        Admin view for FamilyOps task approvals. Browser calls Next.js server proxy routes only.
      </p>
      {showSuccess ? (
        <div
          style={{
            marginBottom: 12,
            border: "1px solid #14532d",
            background: "#0b1f13",
            color: "#bbf7d0",
            borderRadius: 8,
            padding: 12,
            fontWeight: 600,
          }}
        >
          {ghlMessage || "GoHighLevel connected."}
        </div>
      ) : null}
      {showWarning ? (
        <div
          style={{
            marginBottom: 12,
            border: "1px solid #7f1d1d",
            background: "#111",
            color: "#fecaca",
            borderRadius: 8,
            padding: 12,
            fontWeight: 600,
          }}
        >
          {ghlMessage || "GoHighLevel connection failed."}
        </div>
      ) : null}
      <p style={{ marginBottom: 16 }}>
        <Link href="/familyops/ghl" style={{ textDecoration: "underline" }}>
          FamilyOps GHL
        </Link>
        {" · "}
        <Link href="/familyops/brands" style={{ textDecoration: "underline" }}>
          FamilyOps Brands
        </Link>
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 16 }}>
        <section style={{ border: "1px solid #ddd", borderRadius: 8, padding: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>Latest Tasks (25)</h2>
            <div style={{ display: "flex", gap: 8 }}>
              <select
                value={brandFilter}
                onChange={(event) => setBrandFilter(event.target.value)}
                style={{ padding: "8px 10px" }}
              >
                <option value="all">All Brands</option>
                {brandOptions.map((brandId) => (
                  <option key={brandId} value={brandId}>
                    {brandId}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => loadTasks()}
                disabled={tasksLoading}
                style={{ padding: "8px 12px" }}
              >
                {tasksLoading ? "Refreshing..." : "Refresh"}
              </button>
            </div>
          </div>
          {tasksError ? (
            <div style={{ marginTop: 12, color: "#ef4444", fontWeight: 600 }}>{tasksError}</div>
          ) : null}
          <div style={{ marginTop: 12, overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", borderBottom: "1px solid #333", padding: "8px 6px" }}>
                    Task ID
                  </th>
                  <th style={{ textAlign: "left", borderBottom: "1px solid #333", padding: "8px 6px" }}>
                    Type
                  </th>
                  <th style={{ textAlign: "left", borderBottom: "1px solid #333", padding: "8px 6px" }}>
                    Brand
                  </th>
                  <th style={{ textAlign: "left", borderBottom: "1px solid #333", padding: "8px 6px" }}>
                    Location
                  </th>
                  <th style={{ textAlign: "left", borderBottom: "1px solid #333", padding: "8px 6px" }}>
                    Status
                  </th>
                  <th style={{ textAlign: "left", borderBottom: "1px solid #333", padding: "8px 6px" }}>
                    Created
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredTasks.map((task) => {
                  const selected = task.task_id === selectedTaskId;
                  return (
                    <tr
                      key={task.task_id}
                      onClick={() => loadTaskDetails(task.task_id)}
                      style={{
                        cursor: "pointer",
                        background: selected ? "#111827" : "transparent",
                      }}
                    >
                      <td style={{ borderBottom: "1px solid #222", padding: "8px 6px" }}>{task.task_id}</td>
                      <td style={{ borderBottom: "1px solid #222", padding: "8px 6px" }}>{task.task_type}</td>
                      <td style={{ borderBottom: "1px solid #222", padding: "8px 6px" }}>
                        {taskBrandId(task) || "-"}
                      </td>
                      <td style={{ borderBottom: "1px solid #222", padding: "8px 6px" }}>
                        {taskLocationId(task) || "-"}
                      </td>
                      <td style={{ borderBottom: "1px solid #222", padding: "8px 6px" }}>{task.status}</td>
                      <td style={{ borderBottom: "1px solid #222", padding: "8px 6px" }}>
                        {task.created_at || "-"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section style={{ border: "1px solid #ddd", borderRadius: 8, padding: 14 }}>
          <h2 style={{ fontSize: 20, fontWeight: 600, marginTop: 0 }}>{selectedHeader}</h2>
          {detailsLoading ? <div>Loading details...</div> : null}
          {detailsError ? <div style={{ color: "#ef4444", fontWeight: 600 }}>{detailsError}</div> : null}
          {actionError ? <div style={{ color: "#ef4444", fontWeight: 600 }}>{actionError}</div> : null}

          {details ? (
            <>
              <div style={{ marginBottom: 8 }}>
                <strong>Status:</strong> {details.status}
              </div>
              <div style={{ marginBottom: 8 }}>
                <strong>Approval:</strong> {details.approval?.status || "n/a"}
              </div>
              <div style={{ marginBottom: 8 }}>
                <strong>Brand:</strong> {detailBrandId || "-"}
              </div>
              <div style={{ marginBottom: 8 }}>
                <strong>Location:</strong> {detailLocationId || "-"}
              </div>
              {details.approval?.approved_by ? (
                <div style={{ marginBottom: 8 }}>
                  <strong>Approved By:</strong> {details.approval.approved_by}
                </div>
              ) : null}
              {details.approval?.note ? (
                <div style={{ marginBottom: 8 }}>
                  <strong>Note:</strong> {details.approval.note}
                </div>
              ) : null}

              {canDecide ? (
                <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
                  <button type="button" onClick={() => runDecision("approve")} style={{ padding: "8px 12px" }}>
                    Approve
                  </button>
                  <button type="button" onClick={() => runDecision("reject")} style={{ padding: "8px 12px" }}>
                    Reject
                  </button>
                </div>
              ) : null}

              <details open>
                <summary style={{ cursor: "pointer" }}>Payload</summary>
                <pre style={{ background: "#111", padding: 10, borderRadius: 6, overflowX: "auto" }}>
                  {pretty(details.payload)}
                </pre>
              </details>
              <details style={{ marginTop: 10 }} open>
                <summary style={{ cursor: "pointer" }}>Result</summary>
                <pre style={{ background: "#111", padding: 10, borderRadius: 6, overflowX: "auto" }}>
                  {pretty(details.result)}
                </pre>
              </details>
              <details style={{ marginTop: 10 }} open>
                <summary style={{ cursor: "pointer" }}>Error</summary>
                <pre style={{ background: "#111", padding: 10, borderRadius: 6, overflowX: "auto" }}>
                  {pretty(details.error)}
                </pre>
              </details>
            </>
          ) : null}
        </section>
      </div>
    </main>
  );
}
