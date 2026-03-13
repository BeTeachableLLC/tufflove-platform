"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type MissionItem = {
  id: string;
  entry_type: "task" | "operator_mission" | string;
  tenant_id: string;
  user_id?: string | null;
  task_type: string;
  status: string;
  blocked_reason?: string | null;
  approval_status?: string | null;
  dry_run: boolean;
  created_at: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  trigger_id?: string | null;
  trigger_source?: string | null;
  operator_id?: string | null;
  operator_version_id?: string | null;
  subaccount_id?: string | null;
  subaccount_name?: string | null;
  brand_id?: string | null;
  brand_name?: string | null;
  content_item_id?: string | null;
  summary?: string | null;
};

type MissionTimelineEvent = {
  at: string | null;
  event_type: string;
  status: string;
  detail: string;
  metadata?: Record<string, unknown>;
};

type MissionDetail = MissionItem & {
  payload_preview?: unknown;
  result_preview?: unknown;
  tool_log?: unknown;
  token_estimate?: number;
  cost_estimate?: number;
  timeline?: MissionTimelineEvent[];
};

type MissionListResponse = {
  items?: MissionItem[];
  total?: number;
};

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

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

function statusBadgeStyle(status: string): { background: string; color: string; border: string } {
  const normalized = status.toLowerCase();
  if (["completed", "scheduled", "would_publish"].includes(normalized)) {
    return { background: "#052e16", color: "#bbf7d0", border: "1px solid #14532d" };
  }
  if (["blocked", "failed", "rejected", "partial"].includes(normalized)) {
    return { background: "#2b0c0c", color: "#fecaca", border: "1px solid #7f1d1d" };
  }
  if (["running", "queued", "pending"].includes(normalized)) {
    return { background: "#111827", color: "#bfdbfe", border: "1px solid #1d4ed8" };
  }
  return { background: "#111", color: "#e5e7eb", border: "1px solid #374151" };
}

export default function MissionsClient() {
  const [items, setItems] = useState<MissionItem[]>([]);
  const [total, setTotal] = useState(0);

  const [tenantFilter, setTenantFilter] = useState("familyops");
  const [statusFilter, setStatusFilter] = useState("all");
  const [taskTypeFilter, setTaskTypeFilter] = useState("all");
  const [subaccountFilter, setSubaccountFilter] = useState("all");
  const [brandFilter, setBrandFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [search, setSearch] = useState("");

  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<MissionDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const loadMissions = useCallback(async () => {
    setListLoading(true);
    setListError(null);

    const params = new URLSearchParams();
    if (tenantFilter.trim()) params.set("tenant_id", tenantFilter.trim());
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (taskTypeFilter !== "all") params.set("task_type", taskTypeFilter);
    if (subaccountFilter !== "all") params.set("subaccount_id", subaccountFilter);
    if (brandFilter !== "all") params.set("brand_id", brandFilter);
    if (dateFrom.trim()) params.set("date_from", dateFrom.trim());
    if (dateTo.trim()) params.set("date_to", dateTo.trim());
    if (search.trim()) params.set("search", search.trim());
    params.set("limit", "100");

    try {
      const response = await fetch(`/api/familyops/missions?${params.toString()}`, { cache: "no-store" });
      const payload = await parseResponse(response);
      if (!response.ok) {
        throw new Error(normalizeError(payload, `Failed to load missions (${response.status})`));
      }

      const data = (payload && typeof payload === "object" ? payload : {}) as MissionListResponse;
      setItems(Array.isArray(data.items) ? data.items : []);
      setTotal(typeof data.total === "number" ? data.total : 0);
    } catch (error) {
      setItems([]);
      setListError(error instanceof Error ? error.message : String(error));
    } finally {
      setListLoading(false);
    }
  }, [brandFilter, dateFrom, dateTo, search, statusFilter, subaccountFilter, taskTypeFilter, tenantFilter]);

  const loadDetail = useCallback(async (missionId: string) => {
    setDetailLoading(true);
    setDetailError(null);
    try {
      const params = new URLSearchParams();
      if (tenantFilter.trim()) params.set("tenant_id", tenantFilter.trim());
      const suffix = params.toString() ? `?${params.toString()}` : "";
      const response = await fetch(`/api/familyops/missions/${encodeURIComponent(missionId)}${suffix}`, { cache: "no-store" });
      const payload = await parseResponse(response);
      if (!response.ok) {
        throw new Error(normalizeError(payload, `Failed to load mission detail (${response.status})`));
      }
      setDetail(payload as MissionDetail);
      setSelectedId(missionId);
    } catch (error) {
      setDetail(null);
      setDetailError(error instanceof Error ? error.message : String(error));
      setSelectedId(missionId);
    } finally {
      setDetailLoading(false);
    }
  }, [tenantFilter]);

  useEffect(() => {
    void loadMissions();
  }, [loadMissions]);

  useEffect(() => {
    if (selectedId) {
      const stillExists = items.some((item) => item.id === selectedId);
      if (!stillExists) {
        setSelectedId(null);
        setDetail(null);
      }
    }
  }, [items, selectedId]);

  useEffect(() => {
    if (!selectedId && items.length > 0) {
      void loadDetail(items[0].id);
    }
  }, [items, loadDetail, selectedId]);

  const taskTypeOptions = useMemo(() => {
    const values = new Set<string>();
    for (const item of items) {
      if (item.task_type) values.add(item.task_type);
    }
    return Array.from(values).sort();
  }, [items]);

  const subaccountOptions = useMemo(() => {
    const values = new Map<string, string>();
    for (const item of items) {
      if (item.subaccount_id) {
        values.set(item.subaccount_id, item.subaccount_name || item.subaccount_id);
      }
    }
    return Array.from(values.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [items]);

  const brandOptions = useMemo(() => {
    const values = new Map<string, string>();
    for (const item of items) {
      if (item.brand_id) {
        values.set(item.brand_id, item.brand_name || item.brand_id);
      }
    }
    return Array.from(values.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [items]);

  return (
    <main style={{ maxWidth: 1320, margin: "0 auto", padding: 24, fontFamily: "sans-serif" }}>
      <h1 style={{ fontSize: 30, fontWeight: 700, marginBottom: 6 }}>FamilyOps Mission History</h1>
      <p style={{ color: "#9ca3af", marginBottom: 14 }}>
        Inspect what ran, what was blocked, what was approved/scheduled, and full execution timelines.
      </p>
      <p style={{ marginBottom: 16 }}>
        <Link href="/familyops/approvals" style={{ textDecoration: "underline" }}>
          Approval Center
        </Link>
        {" · "}
        <Link href="/familyops/triggers" style={{ textDecoration: "underline" }}>
          Trigger Service
        </Link>
        {" · "}
        <Link href="/familyops/operators" style={{ textDecoration: "underline" }}>
          Operators
        </Link>
      </p>

      <section style={{ border: "1px solid #ddd", borderRadius: 8, padding: 14, marginBottom: 16 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginTop: 0 }}>Filters</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 10 }}>
          <label>
            <div style={{ marginBottom: 4 }}>Tenant</div>
            <input value={tenantFilter} onChange={(event) => setTenantFilter(event.target.value)} style={{ width: "100%", padding: 8 }} />
          </label>
          <label>
            <div style={{ marginBottom: 4 }}>Status</div>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} style={{ width: "100%", padding: 8 }}>
              <option value="all">All statuses</option>
              <option value="queued">queued</option>
              <option value="running">running</option>
              <option value="completed">completed</option>
              <option value="blocked">blocked</option>
              <option value="failed">failed</option>
              <option value="rejected">rejected</option>
              <option value="scheduled">scheduled</option>
              <option value="would_publish">would_publish</option>
            </select>
          </label>
          <label>
            <div style={{ marginBottom: 4 }}>Task Type</div>
            <select value={taskTypeFilter} onChange={(event) => setTaskTypeFilter(event.target.value)} style={{ width: "100%", padding: 8 }}>
              <option value="all">All task types</option>
              {taskTypeOptions.map((taskType) => (
                <option key={taskType} value={taskType}>
                  {taskType}
                </option>
              ))}
            </select>
          </label>
          <label>
            <div style={{ marginBottom: 4 }}>Subaccount</div>
            <select value={subaccountFilter} onChange={(event) => setSubaccountFilter(event.target.value)} style={{ width: "100%", padding: 8 }}>
              <option value="all">All subaccounts</option>
              {subaccountOptions.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <div style={{ marginBottom: 4 }}>Brand</div>
            <select value={brandFilter} onChange={(event) => setBrandFilter(event.target.value)} style={{ width: "100%", padding: 8 }}>
              <option value="all">All brands</option>
              {brandOptions.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 2fr auto", gap: 10, marginTop: 10 }}>
          <label>
            <div style={{ marginBottom: 4 }}>Date From (ISO)</div>
            <input
              value={dateFrom}
              onChange={(event) => setDateFrom(event.target.value)}
              placeholder="2026-03-13T00:00:00Z"
              style={{ width: "100%", padding: 8 }}
            />
          </label>
          <label>
            <div style={{ marginBottom: 4 }}>Date To (ISO)</div>
            <input
              value={dateTo}
              onChange={(event) => setDateTo(event.target.value)}
              placeholder="2026-03-13T23:59:59Z"
              style={{ width: "100%", padding: 8 }}
            />
          </label>
          <label>
            <div style={{ marginBottom: 4 }}>Search</div>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="mission id, task type, brand, error"
              style={{ width: "100%", padding: 8 }}
            />
          </label>
          <div style={{ display: "flex", alignItems: "end" }}>
            <button type="button" onClick={() => void loadMissions()} disabled={listLoading} style={{ padding: "10px 14px" }}>
              {listLoading ? "Refreshing..." : "Apply"}
            </button>
          </div>
        </div>
      </section>

      {listError ? <div style={{ color: "#ef4444", fontWeight: 600, marginBottom: 12 }}>{listError}</div> : null}

      <div style={{ display: "grid", gridTemplateColumns: "1.25fr 1fr", gap: 16 }}>
        <section style={{ border: "1px solid #ddd", borderRadius: 8, padding: 14 }}>
          <h2 style={{ fontSize: 20, fontWeight: 600, marginTop: 0 }}>Missions ({total})</h2>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", borderBottom: "1px solid #333", padding: "8px 6px" }}>ID</th>
                  <th style={{ textAlign: "left", borderBottom: "1px solid #333", padding: "8px 6px" }}>Type</th>
                  <th style={{ textAlign: "left", borderBottom: "1px solid #333", padding: "8px 6px" }}>Task</th>
                  <th style={{ textAlign: "left", borderBottom: "1px solid #333", padding: "8px 6px" }}>Status</th>
                  <th style={{ textAlign: "left", borderBottom: "1px solid #333", padding: "8px 6px" }}>Brand/Subaccount</th>
                  <th style={{ textAlign: "left", borderBottom: "1px solid #333", padding: "8px 6px" }}>Created</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const badge = statusBadgeStyle(item.status);
                  const isSelected = item.id === selectedId;
                  return (
                    <tr
                      key={`${item.entry_type}-${item.id}`}
                      onClick={() => void loadDetail(item.id)}
                      style={{
                        background: isSelected ? "#111827" : "transparent",
                        cursor: "pointer",
                      }}
                    >
                      <td style={{ borderBottom: "1px solid #222", padding: "8px 6px", fontFamily: "monospace" }}>{item.id.slice(0, 8)}…</td>
                      <td style={{ borderBottom: "1px solid #222", padding: "8px 6px" }}>{item.entry_type}</td>
                      <td style={{ borderBottom: "1px solid #222", padding: "8px 6px" }}>{item.task_type}</td>
                      <td style={{ borderBottom: "1px solid #222", padding: "8px 6px" }}>
                        <span style={{ display: "inline-block", borderRadius: 999, padding: "2px 8px", fontWeight: 600, ...badge }}>
                          {item.status}
                        </span>
                        {item.dry_run ? (
                          <div style={{ marginTop: 4, color: "#93c5fd", fontWeight: 600 }}>dry_run</div>
                        ) : null}
                        {item.blocked_reason ? (
                          <div style={{ marginTop: 4, color: "#fca5a5" }}>{item.blocked_reason}</div>
                        ) : null}
                      </td>
                      <td style={{ borderBottom: "1px solid #222", padding: "8px 6px" }}>
                        <div>{item.brand_name || item.brand_id || "-"}</div>
                        <div style={{ color: "#9ca3af" }}>{item.subaccount_name || item.subaccount_id || "-"}</div>
                      </td>
                      <td style={{ borderBottom: "1px solid #222", padding: "8px 6px" }}>{formatDateTime(item.created_at)}</td>
                    </tr>
                  );
                })}
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: 14, color: "#9ca3af" }}>
                      No missions found.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        <section style={{ border: "1px solid #ddd", borderRadius: 8, padding: 14 }}>
          <h2 style={{ fontSize: 20, fontWeight: 600, marginTop: 0 }}>Mission Detail</h2>
          {detailLoading ? <div>Loading...</div> : null}
          {detailError ? <div style={{ color: "#ef4444", fontWeight: 600 }}>{detailError}</div> : null}
          {!detailLoading && !detailError && !detail ? <div>Select a mission to inspect.</div> : null}

          {!detailLoading && detail ? (
            <div style={{ display: "grid", gap: 10 }}>
              <div>
                <strong>ID:</strong> <span style={{ fontFamily: "monospace" }}>{detail.id}</span>
              </div>
              <div>
                <strong>Entry Type:</strong> {detail.entry_type}
              </div>
              <div>
                <strong>Tenant:</strong> {detail.tenant_id}
              </div>
              <div>
                <strong>Task Type:</strong> {detail.task_type}
              </div>
              <div>
                <strong>Status:</strong> {detail.status}
              </div>
              <div>
                <strong>Blocked Reason:</strong> {detail.blocked_reason || "-"}
              </div>
              <div>
                <strong>Approval Status:</strong> {detail.approval_status || "-"}
              </div>
              <div>
                <strong>Dry Run:</strong> {detail.dry_run ? "true" : "false"}
              </div>
              <div>
                <strong>Brand/Subaccount:</strong> {detail.brand_name || detail.brand_id || "-"} / {detail.subaccount_name || detail.subaccount_id || "-"}
              </div>
              <div>
                <strong>Operator/Version:</strong> {detail.operator_id || "-"} / {detail.operator_version_id || "-"}
              </div>
              <div>
                <strong>Trigger:</strong> {detail.trigger_id || "-"} ({detail.trigger_source || "-"})
              </div>
              <div>
                <strong>Content Item:</strong> {detail.content_item_id || "-"}
              </div>
              <div>
                <strong>Created/Started/Completed:</strong> {formatDateTime(detail.created_at)} / {formatDateTime(detail.started_at)} / {formatDateTime(detail.completed_at)}
              </div>

              <details>
                <summary style={{ cursor: "pointer", fontWeight: 600 }}>
                  Event Timeline ({Array.isArray(detail.timeline) ? detail.timeline.length : 0})
                </summary>
                <div style={{ marginTop: 8, maxHeight: 260, overflowY: "auto" }}>
                  {Array.isArray(detail.timeline) && detail.timeline.length > 0 ? (
                    detail.timeline.map((event, index) => (
                      <div key={`${event.event_type}-${index}`} style={{ borderBottom: "1px solid #222", padding: "8px 0" }}>
                        <div>
                          <strong>{event.event_type}</strong> [{event.status}] at {formatDateTime(event.at)}
                        </div>
                        <div>{event.detail || "-"}</div>
                        {event.metadata ? <pre style={{ whiteSpace: "pre-wrap", marginTop: 6 }}>{pretty(event.metadata)}</pre> : null}
                      </div>
                    ))
                  ) : (
                    <div style={{ color: "#9ca3af" }}>No timeline events available.</div>
                  )}
                </div>
              </details>

              <details>
                <summary style={{ cursor: "pointer", fontWeight: 600 }}>Payload Preview</summary>
                <pre style={{ whiteSpace: "pre-wrap" }}>{pretty(detail.payload_preview)}</pre>
              </details>

              <details>
                <summary style={{ cursor: "pointer", fontWeight: 600 }}>Result Preview</summary>
                <pre style={{ whiteSpace: "pre-wrap" }}>{pretty(detail.result_preview)}</pre>
              </details>

              <details>
                <summary style={{ cursor: "pointer", fontWeight: 600 }}>Raw Mission JSON</summary>
                <pre style={{ whiteSpace: "pre-wrap" }}>{pretty(detail)}</pre>
              </details>
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}
