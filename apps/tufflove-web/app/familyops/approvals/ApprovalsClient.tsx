"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type Subaccount = {
  id: string;
  name: string;
  status: string;
  ghl_location_id?: string | null;
};

type Brand = {
  id: string;
  name: string;
  subaccount_id?: string | null;
  status: string;
};

type ApprovalItem = {
  id: string;
  tenant_id: string;
  subaccount_id: string;
  subaccount_name: string;
  subaccount_status: string;
  subaccount_location_id: string | null;
  brand_id: string;
  brand_name: string;
  brand_status: string;
  brand_allowed_publishers: string[];
  platform: string;
  status: string;
  title: string;
  source_task_id: string | null;
  current_version_id: string | null;
  current_version_number: number | null;
  current_content_text: string;
  current_content_preview: string;
  scheduled_at: string | null;
  last_review_action: string | null;
  last_reviewer: string | null;
  last_reviewed_at: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type ApprovalVersion = {
  id: string;
  content_item_id: string;
  version_number: number;
  content_text: string;
  generation_note: string;
  generated_by: string;
  created_at: string | null;
};

type ApprovalReview = {
  id: string;
  action: string;
  reviewer: string;
  note: string | null;
  created_at: string | null;
  content_version_id: string | null;
};

type RegenerationJob = {
  id: string;
  status: string;
  requested_by: string;
  revision_note: string;
  attempt_count: number;
  error: string | null;
  created_at: string | null;
  processed_at: string | null;
};

type ApprovalDetail = ApprovalItem & {
  versions: ApprovalVersion[];
  reviews: ApprovalReview[];
  regeneration_jobs: RegenerationJob[];
};

type ApprovalsResponse = {
  items?: ApprovalItem[];
  subaccounts?: Subaccount[];
  brands?: Brand[];
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

export default function FamilyOpsApprovalsPage() {
  const [items, setItems] = useState<ApprovalItem[]>([]);
  const [subaccounts, setSubaccounts] = useState<Subaccount[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [total, setTotal] = useState(0);

  const [subaccountFilter, setSubaccountFilter] = useState("all");
  const [brandFilter, setBrandFilter] = useState("all");
  const [platformFilter, setPlatformFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [search, setSearch] = useState("");

  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ApprovalDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const loadApprovals = useCallback(async () => {
    setListLoading(true);
    setListError(null);

    const params = new URLSearchParams();
    if (subaccountFilter !== "all") params.set("subaccount_id", subaccountFilter);
    if (brandFilter !== "all") params.set("brand_id", brandFilter);
    if (platformFilter !== "all") params.set("platform", platformFilter);
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (dateFrom.trim()) params.set("date_from", dateFrom.trim());
    if (dateTo.trim()) params.set("date_to", dateTo.trim());
    if (search.trim()) params.set("search", search.trim());
    params.set("limit", "100");

    try {
      const response = await fetch(`/api/familyops/approvals?${params.toString()}`, { cache: "no-store" });
      const payload = await parseResponse(response);
      if (!response.ok) {
        throw new Error(normalizeError(payload, `Failed to load approvals (${response.status})`));
      }

      const data = (payload && typeof payload === "object" ? payload : {}) as ApprovalsResponse;
      setItems(Array.isArray(data.items) ? data.items : []);
      setSubaccounts(Array.isArray(data.subaccounts) ? data.subaccounts : []);
      setBrands(Array.isArray(data.brands) ? data.brands : []);
      setTotal(typeof data.total === "number" ? data.total : 0);
    } catch (error) {
      setItems([]);
      setListError(error instanceof Error ? error.message : String(error));
    } finally {
      setListLoading(false);
    }
  }, [brandFilter, dateFrom, dateTo, platformFilter, search, statusFilter, subaccountFilter]);

  const loadDetail = useCallback(async (contentItemId: string) => {
    setDetailLoading(true);
    setDetailError(null);
    setActionError(null);
    try {
      const response = await fetch(`/api/familyops/approvals/${encodeURIComponent(contentItemId)}`, {
        cache: "no-store",
      });
      const payload = await parseResponse(response);
      if (!response.ok) {
        throw new Error(normalizeError(payload, `Failed to load item (${response.status})`));
      }
      setDetail(payload as ApprovalDetail);
      setSelectedId(contentItemId);
    } catch (error) {
      setDetail(null);
      setDetailError(error instanceof Error ? error.message : String(error));
      setSelectedId(contentItemId);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadApprovals();
  }, [loadApprovals]);

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

  const filteredBrands = useMemo(() => {
    if (subaccountFilter === "all") return brands;
    return brands.filter((brand) => brand.subaccount_id === subaccountFilter);
  }, [brands, subaccountFilter]);

  const platformOptions = useMemo(() => {
    const values = new Set<string>();
    for (const item of items) {
      if (item.platform) values.add(item.platform);
    }
    return Array.from(values).sort();
  }, [items]);

  const canReview =
    !!detail &&
    !actionLoading &&
    ["ready_for_review", "revision_requested", "approved", "rejected"].includes(detail.status);

  const runReviewAction = useCallback(
    async (action: "approve" | "reject" | "request-revision") => {
      if (!detail?.id) return;
      const reviewer = window.prompt("Reviewer (required):", "moe");
      if (!reviewer || !reviewer.trim()) return;
      const note =
        window.prompt(
          action === "request-revision" ? "Revision note (required):" : "Note (optional):",
          "",
        ) ?? "";
      if (action === "request-revision" && !note.trim()) {
        setActionError("Revision note is required.");
        return;
      }

      setActionLoading(true);
      setActionError(null);
      setActionMessage(null);
      try {
        const response = await fetch(`/api/familyops/approvals/${encodeURIComponent(detail.id)}/${action}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ reviewer: reviewer.trim(), note }),
        });
        const payload = await parseResponse(response);
        if (!response.ok) {
          throw new Error(normalizeError(payload, `${action} failed (${response.status})`));
        }
        if (action === "request-revision") {
          setActionMessage("Revision requested and regeneration queued.");
        } else {
          setActionMessage(`Content ${action}d.`);
        }
        await loadApprovals();
        await loadDetail(detail.id);
      } catch (error) {
        setActionError(error instanceof Error ? error.message : String(error));
      } finally {
        setActionLoading(false);
      }
    },
    [detail?.id, loadApprovals, loadDetail],
  );

  return (
    <main style={{ maxWidth: 1280, margin: "0 auto", padding: 24, fontFamily: "sans-serif" }}>
      <h1 style={{ fontSize: 30, fontWeight: 700, marginBottom: 6 }}>FamilyOps Approval Center</h1>
      <p style={{ color: "#9ca3af", marginBottom: 14 }}>
        Subaccount-first, brand-aware review queue for content approval and AI revision cycles.
      </p>
      <p style={{ marginBottom: 16 }}>
        <Link href="/familyops/brands" style={{ textDecoration: "underline" }}>
          FamilyOps Brands
        </Link>
        {" · "}
        <Link href="/familyops/triggers" style={{ textDecoration: "underline" }}>
          Trigger Service
        </Link>
      </p>

      <section style={{ border: "1px solid #ddd", borderRadius: 8, padding: 14, marginBottom: 16 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginTop: 0 }}>Filters</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 10 }}>
          <label>
            <div style={{ marginBottom: 4 }}>Subaccount</div>
            <select
              value={subaccountFilter}
              onChange={(event) => {
                setSubaccountFilter(event.target.value);
                setBrandFilter("all");
              }}
              style={{ width: "100%", padding: 8 }}
            >
              <option value="all">All Subaccounts</option>
              {subaccounts.map((subaccount) => (
                <option key={subaccount.id} value={subaccount.id}>
                  {subaccount.name} ({subaccount.status})
                </option>
              ))}
            </select>
          </label>

          <label>
            <div style={{ marginBottom: 4 }}>Brand</div>
            <select value={brandFilter} onChange={(event) => setBrandFilter(event.target.value)} style={{ width: "100%", padding: 8 }}>
              <option value="all">All Brands</option>
              {filteredBrands.map((brand) => (
                <option key={brand.id} value={brand.id}>
                  {brand.name} ({brand.status})
                </option>
              ))}
            </select>
          </label>

          <label>
            <div style={{ marginBottom: 4 }}>Platform</div>
            <select
              value={platformFilter}
              onChange={(event) => setPlatformFilter(event.target.value)}
              style={{ width: "100%", padding: 8 }}
            >
              <option value="all">All Platforms</option>
              {platformOptions.map((platform) => (
                <option key={platform} value={platform}>
                  {platform}
                </option>
              ))}
            </select>
          </label>

          <label>
            <div style={{ marginBottom: 4 }}>Status</div>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} style={{ width: "100%", padding: 8 }}>
              <option value="all">All Statuses</option>
              <option value="ready_for_review">ready_for_review</option>
              <option value="approved">approved</option>
              <option value="rejected">rejected</option>
              <option value="revision_requested">revision_requested</option>
              <option value="scheduled">scheduled</option>
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
              placeholder="title, content, brand"
              style={{ width: "100%", padding: 8 }}
            />
          </label>
          <div style={{ display: "flex", alignItems: "end" }}>
            <button type="button" onClick={() => void loadApprovals()} disabled={listLoading} style={{ padding: "10px 14px" }}>
              {listLoading ? "Refreshing..." : "Apply"}
            </button>
          </div>
        </div>
      </section>

      {listError ? <div style={{ color: "#ef4444", fontWeight: 600, marginBottom: 12 }}>{listError}</div> : null}
      {actionError ? <div style={{ color: "#ef4444", fontWeight: 600, marginBottom: 12 }}>{actionError}</div> : null}
      {actionMessage ? <div style={{ color: "#22c55e", fontWeight: 600, marginBottom: 12 }}>{actionMessage}</div> : null}

      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 16 }}>
        <section style={{ border: "1px solid #ddd", borderRadius: 8, padding: 14 }}>
          <h2 style={{ fontSize: 20, fontWeight: 600, marginTop: 0 }}>Approvals ({total})</h2>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", borderBottom: "1px solid #333", padding: "8px 6px" }}>ID</th>
                  <th style={{ textAlign: "left", borderBottom: "1px solid #333", padding: "8px 6px" }}>Subaccount</th>
                  <th style={{ textAlign: "left", borderBottom: "1px solid #333", padding: "8px 6px" }}>Brand</th>
                  <th style={{ textAlign: "left", borderBottom: "1px solid #333", padding: "8px 6px" }}>Platform</th>
                  <th style={{ textAlign: "left", borderBottom: "1px solid #333", padding: "8px 6px" }}>Status</th>
                  <th style={{ textAlign: "left", borderBottom: "1px solid #333", padding: "8px 6px" }}>Updated</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const isSelected = item.id === selectedId;
                  return (
                    <tr
                      key={item.id}
                      onClick={() => void loadDetail(item.id)}
                      style={{
                        background: isSelected ? "#111827" : "transparent",
                        cursor: "pointer",
                      }}
                    >
                      <td style={{ borderBottom: "1px solid #222", padding: "8px 6px", fontFamily: "monospace" }}>
                        {item.id.slice(0, 8)}…
                      </td>
                      <td style={{ borderBottom: "1px solid #222", padding: "8px 6px" }}>{item.subaccount_name}</td>
                      <td style={{ borderBottom: "1px solid #222", padding: "8px 6px" }}>{item.brand_name}</td>
                      <td style={{ borderBottom: "1px solid #222", padding: "8px 6px" }}>{item.platform}</td>
                      <td style={{ borderBottom: "1px solid #222", padding: "8px 6px" }}>{item.status}</td>
                      <td style={{ borderBottom: "1px solid #222", padding: "8px 6px" }}>{formatDateTime(item.updated_at)}</td>
                    </tr>
                  );
                })}
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: 14, color: "#9ca3af" }}>
                      No approval items found.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        <section style={{ border: "1px solid #ddd", borderRadius: 8, padding: 14 }}>
          <h2 style={{ fontSize: 20, fontWeight: 600, marginTop: 0 }}>Detail</h2>
          {detailLoading ? <div>Loading...</div> : null}
          {detailError ? <div style={{ color: "#ef4444", fontWeight: 600 }}>{detailError}</div> : null}
          {!detailLoading && !detailError && !detail ? <div>Select an item to inspect.</div> : null}
          {!detailLoading && detail ? (
            <div style={{ display: "grid", gap: 10 }}>
              <div>
                <strong>ID:</strong> <span style={{ fontFamily: "monospace" }}>{detail.id}</span>
              </div>
              <div>
                <strong>Subaccount:</strong> {detail.subaccount_name} ({detail.subaccount_status})
              </div>
              <div>
                <strong>Brand:</strong> {detail.brand_name} ({detail.brand_status})
              </div>
              <div>
                <strong>Status:</strong> {detail.status}
              </div>
              <div>
                <strong>Current Version:</strong> {detail.current_version_number ?? "-"}
              </div>
              <div>
                <strong>Title:</strong> {detail.title || "-"}
              </div>

              <label>
                <div style={{ marginBottom: 4 }}>
                  <strong>Current Content</strong>
                </div>
                <textarea readOnly rows={8} style={{ width: "100%", padding: 8 }} value={detail.current_content_text || ""} />
              </label>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button type="button" disabled={!canReview} onClick={() => void runReviewAction("approve")} style={{ padding: "8px 12px" }}>
                  {actionLoading ? "Working..." : "Approve"}
                </button>
                <button type="button" disabled={!canReview} onClick={() => void runReviewAction("reject")} style={{ padding: "8px 12px" }}>
                  {actionLoading ? "Working..." : "Reject"}
                </button>
                <button
                  type="button"
                  disabled={!canReview}
                  onClick={() => void runReviewAction("request-revision")}
                  style={{ padding: "8px 12px" }}
                >
                  {actionLoading ? "Working..." : "Request Revision"}
                </button>
              </div>

              <details>
                <summary style={{ cursor: "pointer", fontWeight: 600 }}>Version History ({detail.versions.length})</summary>
                <div style={{ marginTop: 8, maxHeight: 240, overflowY: "auto" }}>
                  {detail.versions.map((version) => (
                    <div key={version.id} style={{ borderBottom: "1px solid #222", padding: "8px 0" }}>
                      <div>
                        <strong>v{version.version_number}</strong> by {version.generated_by} at {formatDateTime(version.created_at)}
                      </div>
                      <div style={{ color: "#9ca3af" }}>{version.generation_note || "-"}</div>
                      <pre style={{ whiteSpace: "pre-wrap", marginTop: 6 }}>{version.content_text}</pre>
                    </div>
                  ))}
                </div>
              </details>

              <details>
                <summary style={{ cursor: "pointer", fontWeight: 600 }}>Review History ({detail.reviews.length})</summary>
                <div style={{ marginTop: 8, maxHeight: 220, overflowY: "auto" }}>
                  {detail.reviews.map((review) => (
                    <div key={review.id} style={{ borderBottom: "1px solid #222", padding: "8px 0" }}>
                      <div>
                        <strong>{review.action}</strong> by {review.reviewer} at {formatDateTime(review.created_at)}
                      </div>
                      <div>{review.note || "-"}</div>
                    </div>
                  ))}
                </div>
              </details>

              <details>
                <summary style={{ cursor: "pointer", fontWeight: 600 }}>
                  Regeneration Jobs ({detail.regeneration_jobs.length})
                </summary>
                <div style={{ marginTop: 8, maxHeight: 180, overflowY: "auto" }}>
                  {detail.regeneration_jobs.map((job) => (
                    <div key={job.id} style={{ borderBottom: "1px solid #222", padding: "8px 0" }}>
                      <div>
                        <strong>{job.status}</strong> by {job.requested_by} at {formatDateTime(job.created_at)}
                      </div>
                      <div>Note: {job.revision_note || "-"}</div>
                      {job.error ? <div style={{ color: "#ef4444" }}>Error: {job.error}</div> : null}
                    </div>
                  ))}
                </div>
              </details>

              <details>
                <summary style={{ cursor: "pointer", fontWeight: 600 }}>Raw JSON</summary>
                <pre style={{ whiteSpace: "pre-wrap" }}>{pretty(detail)}</pre>
              </details>
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}
