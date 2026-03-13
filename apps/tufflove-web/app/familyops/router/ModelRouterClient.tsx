"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type TaskClass = "implement" | "debug" | "review" | "verify";
type ProofStatus = "unknown" | "passing" | "failing" | "not_run";
type VerificationStatus = "not_required" | "pending" | "passed" | "failed";

type RouterDecision = {
  id: string;
  tenant_id: string;
  task_class: TaskClass | string;
  task_type: string | null;
  requested_model: string | null;
  selected_model: string;
  escalation_reason: string;
  output_summary: string;
  proof_status: ProofStatus | string;
  verification_required: boolean;
  verification_model: string | null;
  verification_status: VerificationStatus | string;
  final_recommendation: string;
  mission_id: string | null;
  task_id: string | null;
  operator_id: string | null;
  linked_branch: string | null;
  linked_pr: string | null;
  metadata: Record<string, unknown>;
  created_by: string;
  created_at: string | null;
  updated_at: string | null;
};

type RouterListResponse = {
  items?: RouterDecision[];
  total?: number;
};

type RouterDetailResponse = RouterDecision;

type ModelRouterClientProps = {
  createdBy: string;
};

const TASK_CLASS_OPTIONS: TaskClass[] = ["implement", "debug", "review", "verify"];
const MODEL_OPTIONS = ["auto", "codex", "claude", "gemini", "openclaw"] as const;
const PROOF_STATUS_OPTIONS: ProofStatus[] = ["unknown", "passing", "failing", "not_run"];
const VERIFICATION_STATUS_OPTIONS: VerificationStatus[] = ["pending", "passed", "failed", "not_required"];

function parseError(payload: unknown, fallback: string): string {
  if (typeof payload === "string" && payload.trim()) return payload;
  if (payload && typeof payload === "object") {
    const data = payload as Record<string, unknown>;
    if (typeof data.error === "string" && data.error.trim()) return data.error;
    if (typeof data.detail === "string" && data.detail.trim()) return data.detail;
  }
  return fallback;
}

async function readResponse(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return response.json().catch(() => ({}));
  }
  return response.text();
}

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

function badgeStyle(value: string): { background: string; color: string; border: string } {
  const normalized = value.toLowerCase();
  if (["passed", "ready_for_pr_review", "passing"].includes(normalized)) {
    return { background: "#052e16", color: "#bbf7d0", border: "1px solid #14532d" };
  }
  if (["failed", "revise_before_pr", "failing"].includes(normalized)) {
    return { background: "#2b0c0c", color: "#fecaca", border: "1px solid #7f1d1d" };
  }
  if (["pending", "needs_second_model_review", "not_run"].includes(normalized)) {
    return { background: "#1f2937", color: "#bfdbfe", border: "1px solid #1d4ed8" };
  }
  return { background: "#111", color: "#e5e7eb", border: "1px solid #374151" };
}

export default function ModelRouterClient({ createdBy }: ModelRouterClientProps) {
  const [items, setItems] = useState<RouterDecision[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  const [taskClassFilter, setTaskClassFilter] = useState("all");
  const [verificationFilter, setVerificationFilter] = useState("all");

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<RouterDecision | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const [taskClass, setTaskClass] = useState<TaskClass>("implement");
  const [taskType, setTaskType] = useState("platform.change");
  const [requestedModel, setRequestedModel] = useState<(typeof MODEL_OPTIONS)[number]>("auto");
  const [proofStatus, setProofStatus] = useState<ProofStatus>("unknown");
  const [sensitiveChange, setSensitiveChange] = useState(false);
  const [escalationReason, setEscalationReason] = useState("");
  const [outputSummary, setOutputSummary] = useState("");
  const [linkedBranch, setLinkedBranch] = useState("");
  const [linkedPr, setLinkedPr] = useState("");
  const [creating, setCreating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [lastActionResult, setLastActionResult] = useState<unknown>(null);

  const [verificationStatusPatch, setVerificationStatusPatch] = useState<VerificationStatus>("pending");
  const [proofStatusPatch, setProofStatusPatch] = useState<ProofStatus>("unknown");

  const loadDecisions = useCallback(async () => {
    setLoading(true);
    setListError(null);

    const params = new URLSearchParams();
    if (taskClassFilter !== "all") params.set("task_class", taskClassFilter);
    if (verificationFilter !== "all") params.set("verification_status", verificationFilter);
    params.set("limit", "100");

    try {
      const response = await fetch(`/api/familyops/model-router?${params.toString()}`, { cache: "no-store" });
      const payload = await readResponse(response);
      if (!response.ok) {
        throw new Error(parseError(payload, `Failed to load model routing decisions (${response.status})`));
      }
      const data = (payload && typeof payload === "object" ? payload : {}) as RouterListResponse;
      setItems(Array.isArray(data.items) ? data.items : []);
      setTotal(typeof data.total === "number" ? data.total : 0);
    } catch (error) {
      setItems([]);
      setListError(error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  }, [taskClassFilter, verificationFilter]);

  const loadDetail = useCallback(async (id: string) => {
    setDetailLoading(true);
    setDetailError(null);
    try {
      const response = await fetch(`/api/familyops/model-router/${encodeURIComponent(id)}`, { cache: "no-store" });
      const payload = await readResponse(response);
      if (!response.ok) {
        throw new Error(parseError(payload, `Failed to load decision detail (${response.status})`));
      }
      const record = payload as RouterDetailResponse;
      setDetail(record);
      setSelectedId(id);
      setVerificationStatusPatch(
        (record.verification_status as VerificationStatus) || "pending",
      );
      setProofStatusPatch((record.proof_status as ProofStatus) || "unknown");
    } catch (error) {
      setDetail(null);
      setSelectedId(id);
      setDetailError(error instanceof Error ? error.message : String(error));
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDecisions();
  }, [loadDecisions]);

  useEffect(() => {
    if (!selectedId && items.length > 0) {
      void loadDetail(items[0].id);
    }
  }, [items, selectedId, loadDetail]);

  useEffect(() => {
    if (selectedId && !items.some((item) => item.id === selectedId)) {
      setSelectedId(null);
      setDetail(null);
    }
  }, [items, selectedId]);

  const filteredTaskTypes = useMemo(() => {
    const set = new Set<string>();
    for (const item of items) {
      if (item.task_type) set.add(item.task_type);
    }
    return Array.from(set).sort();
  }, [items]);

  async function createDecision(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreating(true);
    setActionError(null);
    try {
      const payload = {
        task_class: taskClass,
        task_type: taskType.trim() || null,
        requested_model: requestedModel === "auto" ? null : requestedModel,
        proof_status: proofStatus,
        sensitive_change: sensitiveChange,
        escalation_reason: escalationReason.trim(),
        output_summary: outputSummary.trim(),
        linked_branch: linkedBranch.trim() || null,
        linked_pr: linkedPr.trim() || null,
        created_by: createdBy,
      };
      const response = await fetch("/api/familyops/model-router", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await readResponse(response);
      if (!response.ok) {
        throw new Error(parseError(data, `Failed to create routing decision (${response.status})`));
      }
      setLastActionResult(data);
      await loadDecisions();
      const decisionId =
        data && typeof data === "object" && data !== null
          ? ((data as { decision?: { id?: string } }).decision?.id ?? null)
          : null;
      if (decisionId) {
        await loadDetail(decisionId);
      }
    } catch (error) {
      setActionError(error instanceof Error ? error.message : String(error));
    } finally {
      setCreating(false);
    }
  }

  async function patchDetail() {
    if (!detail) return;
    setActionError(null);
    try {
      const response = await fetch(`/api/familyops/model-router/${encodeURIComponent(detail.id)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          proof_status: proofStatusPatch,
          verification_status: verificationStatusPatch,
          output_summary: detail.output_summary,
        }),
      });
      const payload = await readResponse(response);
      if (!response.ok) {
        throw new Error(parseError(payload, `Failed to update verification status (${response.status})`));
      }
      setLastActionResult(payload);
      await loadDecisions();
      await loadDetail(detail.id);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : String(error));
    }
  }

  return (
    <main style={{ maxWidth: 1320, margin: "0 auto", padding: 24, fontFamily: "sans-serif" }}>
      <h1 style={{ fontSize: 30, fontWeight: 700, marginBottom: 8 }}>FamilyOps Multi-Model Escalation Router</h1>
      <p style={{ color: "#9ca3af", marginBottom: 14 }}>
        Route implementation, debug, review, and verification tasks with explicit escalation and second-model policy.
      </p>
      <p style={{ marginBottom: 16 }}>
        <Link href="/familyops/operators" style={{ textDecoration: "underline" }}>
          Operators
        </Link>
        {" · "}
        <Link href="/familyops/missions" style={{ textDecoration: "underline" }}>
          Mission History
        </Link>
        {" · "}
        <Link href="/familyops/triggers" style={{ textDecoration: "underline" }}>
          Trigger Service
        </Link>
      </p>

      {listError ? <div style={{ marginBottom: 12, color: "#ef4444", fontWeight: 600 }}>{listError}</div> : null}
      {actionError ? <div style={{ marginBottom: 12, color: "#ef4444", fontWeight: 600 }}>{actionError}</div> : null}

      <section style={{ border: "1px solid #ddd", borderRadius: 8, padding: 14, marginBottom: 16 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginTop: 0 }}>Route New Task</h2>
        <form onSubmit={(event) => void createDecision(event)} style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 10 }}>
          <label>
            <div style={{ marginBottom: 4 }}>Task Class</div>
            <select value={taskClass} onChange={(event) => setTaskClass(event.target.value as TaskClass)} style={{ width: "100%", padding: 8 }}>
              {TASK_CLASS_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label>
            <div style={{ marginBottom: 4 }}>Task Type</div>
            <input value={taskType} onChange={(event) => setTaskType(event.target.value)} style={{ width: "100%", padding: 8 }} />
          </label>
          <label>
            <div style={{ marginBottom: 4 }}>Requested Model</div>
            <select
              value={requestedModel}
              onChange={(event) => setRequestedModel(event.target.value as (typeof MODEL_OPTIONS)[number])}
              style={{ width: "100%", padding: 8 }}
            >
              {MODEL_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label>
            <div style={{ marginBottom: 4 }}>Proof/Test Status</div>
            <select value={proofStatus} onChange={(event) => setProofStatus(event.target.value as ProofStatus)} style={{ width: "100%", padding: 8 }}>
              {PROOF_STATUS_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label style={{ gridColumn: "span 2" }}>
            <div style={{ marginBottom: 4 }}>Escalation Reason</div>
            <input value={escalationReason} onChange={(event) => setEscalationReason(event.target.value)} style={{ width: "100%", padding: 8 }} />
          </label>
          <label style={{ gridColumn: "span 2" }}>
            <div style={{ marginBottom: 4 }}>Output Summary</div>
            <input value={outputSummary} onChange={(event) => setOutputSummary(event.target.value)} style={{ width: "100%", padding: 8 }} />
          </label>
          <label style={{ gridColumn: "span 2" }}>
            <div style={{ marginBottom: 4 }}>Linked Branch</div>
            <input value={linkedBranch} onChange={(event) => setLinkedBranch(event.target.value)} style={{ width: "100%", padding: 8 }} />
          </label>
          <label style={{ gridColumn: "span 2" }}>
            <div style={{ marginBottom: 4 }}>Linked PR</div>
            <input value={linkedPr} onChange={(event) => setLinkedPr(event.target.value)} style={{ width: "100%", padding: 8 }} />
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input type="checkbox" checked={sensitiveChange} onChange={(event) => setSensitiveChange(event.target.checked)} />
            Sensitive change (force second-model review)
          </label>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "flex-end", gridColumn: "span 3" }}>
            <button type="submit" disabled={creating} style={{ padding: "8px 14px" }}>
              {creating ? "Routing..." : "Route Task"}
            </button>
          </div>
        </form>
      </section>

      <section style={{ border: "1px solid #ddd", borderRadius: 8, padding: 14, marginBottom: 16 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginTop: 0 }}>Routing Decisions</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 10, marginBottom: 10 }}>
          <label>
            <div style={{ marginBottom: 4 }}>Task Class</div>
            <select value={taskClassFilter} onChange={(event) => setTaskClassFilter(event.target.value)} style={{ width: "100%", padding: 8 }}>
              <option value="all">All</option>
              {TASK_CLASS_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label>
            <div style={{ marginBottom: 4 }}>Verification</div>
            <select value={verificationFilter} onChange={(event) => setVerificationFilter(event.target.value)} style={{ width: "100%", padding: 8 }}>
              <option value="all">All</option>
              {VERIFICATION_STATUS_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <div style={{ display: "flex", alignItems: "flex-end" }}>
            <button type="button" onClick={() => void loadDecisions()} disabled={loading} style={{ padding: "8px 14px" }}>
              {loading ? "Refreshing..." : "Refresh"}
            </button>
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", color: "#9ca3af" }}>Total: {total}</div>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: "8px 6px" }}>Created</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: "8px 6px" }}>Class</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: "8px 6px" }}>Task Type</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: "8px 6px" }}>Route</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: "8px 6px" }}>Verification</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: "8px 6px" }}>Recommendation</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ borderBottom: "1px solid #eee", padding: "10px 6px", color: "#9ca3af" }}>
                    No routing decisions found.
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr
                    key={item.id}
                    onClick={() => void loadDetail(item.id)}
                    style={{ cursor: "pointer", background: selectedId === item.id ? "#f9fafb" : "transparent" }}
                  >
                    <td style={{ borderBottom: "1px solid #eee", padding: "8px 6px" }}>{formatDateTime(item.created_at)}</td>
                    <td style={{ borderBottom: "1px solid #eee", padding: "8px 6px" }}>{item.task_class}</td>
                    <td style={{ borderBottom: "1px solid #eee", padding: "8px 6px" }}>{item.task_type || "-"}</td>
                    <td style={{ borderBottom: "1px solid #eee", padding: "8px 6px" }}>
                      {(item.requested_model || "auto")} → {item.selected_model}
                    </td>
                    <td style={{ borderBottom: "1px solid #eee", padding: "8px 6px" }}>
                      <span style={{ padding: "2px 8px", borderRadius: 999, fontSize: 12, ...badgeStyle(item.verification_status) }}>
                        {item.verification_status}
                      </span>
                    </td>
                    <td style={{ borderBottom: "1px solid #eee", padding: "8px 6px" }}>
                      <span style={{ padding: "2px 8px", borderRadius: 999, fontSize: 12, ...badgeStyle(item.final_recommendation) }}>
                        {item.final_recommendation}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section style={{ border: "1px solid #ddd", borderRadius: 8, padding: 14 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginTop: 0 }}>Decision Detail</h2>
        {detailError ? <div style={{ marginBottom: 10, color: "#ef4444", fontWeight: 600 }}>{detailError}</div> : null}
        {detailLoading ? <div style={{ color: "#9ca3af" }}>Loading detail...</div> : null}
        {!detailLoading && !detail ? <div style={{ color: "#9ca3af" }}>Select a routing decision to inspect.</div> : null}
        {detail ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
            <div>
              <div>
                <strong>Decision:</strong> {detail.id}
              </div>
              <div>
                <strong>Task:</strong> {detail.task_class} / {detail.task_type || "-"}
              </div>
              <div>
                <strong>Route:</strong> {(detail.requested_model || "auto")} → {detail.selected_model}
              </div>
              <div>
                <strong>Escalation:</strong> {detail.escalation_reason || "-"}
              </div>
              <div>
                <strong>Proof Status:</strong>{" "}
                <span style={{ padding: "2px 8px", borderRadius: 999, fontSize: 12, ...badgeStyle(detail.proof_status) }}>{detail.proof_status}</span>
              </div>
              <div>
                <strong>Verification:</strong>{" "}
                <span style={{ padding: "2px 8px", borderRadius: 999, fontSize: 12, ...badgeStyle(detail.verification_status) }}>
                  {detail.verification_status}
                </span>
                {detail.verification_model ? ` via ${detail.verification_model}` : ""}
              </div>
              <div>
                <strong>Recommendation:</strong>{" "}
                <span style={{ padding: "2px 8px", borderRadius: 999, fontSize: 12, ...badgeStyle(detail.final_recommendation) }}>
                  {detail.final_recommendation}
                </span>
              </div>
              <div>
                <strong>Branch/PR:</strong> {detail.linked_branch || "-"} / {detail.linked_pr || "-"}
              </div>
            </div>
            <div>
              <label style={{ display: "block", marginBottom: 8 }}>
                <div style={{ marginBottom: 4 }}>Proof Status</div>
                <select value={proofStatusPatch} onChange={(event) => setProofStatusPatch(event.target.value as ProofStatus)} style={{ width: "100%", padding: 8 }}>
                  {PROOF_STATUS_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
              <label style={{ display: "block", marginBottom: 8 }}>
                <div style={{ marginBottom: 4 }}>Verification Status</div>
                <select
                  value={verificationStatusPatch}
                  onChange={(event) => setVerificationStatusPatch(event.target.value as VerificationStatus)}
                  style={{ width: "100%", padding: 8 }}
                >
                  {VERIFICATION_STATUS_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
              <button type="button" onClick={() => void patchDetail()} style={{ padding: "8px 14px" }}>
                Update Verification
              </button>
            </div>
            <div style={{ gridColumn: "span 2" }}>
              <strong>Output Summary</strong>
              <pre
                style={{
                  marginTop: 8,
                  whiteSpace: "pre-wrap",
                  overflowX: "auto",
                  background: "#111",
                  color: "#e5e7eb",
                  borderRadius: 8,
                  padding: 12,
                }}
              >
                {detail.output_summary || "-"}
              </pre>
            </div>
            <div style={{ gridColumn: "span 2" }}>
              <strong>Metadata</strong>
              <pre
                style={{
                  marginTop: 8,
                  whiteSpace: "pre-wrap",
                  overflowX: "auto",
                  background: "#111",
                  color: "#e5e7eb",
                  borderRadius: 8,
                  padding: 12,
                }}
              >
                {pretty(detail.metadata)}
              </pre>
            </div>
          </div>
        ) : null}
      </section>

      {lastActionResult ? (
        <section style={{ border: "1px solid #ddd", borderRadius: 8, padding: 14, marginTop: 16 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, marginTop: 0 }}>Last API Result</h2>
          <pre
            style={{
              margin: 0,
              whiteSpace: "pre-wrap",
              overflowX: "auto",
              background: "#111",
              color: "#e5e7eb",
              borderRadius: 8,
              padding: 12,
            }}
          >
            {pretty(lastActionResult)}
          </pre>
          {filteredTaskTypes.length > 0 ? (
            <p style={{ marginTop: 8, marginBottom: 0, color: "#9ca3af" }}>
              Observed task types in history: {filteredTaskTypes.join(", ")}
            </p>
          ) : null}
        </section>
      ) : null}
    </main>
  );
}
