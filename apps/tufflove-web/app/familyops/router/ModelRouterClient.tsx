"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import styles from "./ModelRouterClient.module.css";

type TaskClass = "implement" | "debug" | "review" | "verify";
type ReviewState =
  | "active"
  | "approved_next_step"
  | "needs_changes"
  | "rerun_requested"
  | "second_review_requested"
  | "ready_for_pr_review"
  | "ready_for_merge"
  | "rejected";
type VerificationStatus = "not_required" | "pending" | "passed" | "failed";
type ProofStatus = "unknown" | "passing" | "failing" | "not_run";
type ActionType =
  | "approve_next_step"
  | "reject_send_back"
  | "request_rerun"
  | "request_second_model_review"
  | "mark_ready_pr_review"
  | "mark_ready_merge";

type TimelineEvent = {
  at: string | null;
  event_type: string;
  status: string;
  detail: string;
  metadata?: Record<string, unknown>;
  created_by?: string | null;
};

type MissionDetail = {
  id: string;
  status: string;
  task_type: string;
  summary?: string | null;
  blocked_reason?: string | null;
  dry_run?: boolean;
  created_at?: string | null;
  completed_at?: string | null;
  timeline?: TimelineEvent[];
};

type RouterDecision = {
  id: string;
  task_class: TaskClass | string;
  task_type: string | null;
  requested_model: string | null;
  selected_model: string;
  escalation_reason: string;
  output_summary: string;
  proof_summary: string;
  proof_status: ProofStatus | string;
  verification_required: boolean;
  verification_model: string | null;
  verification_status: VerificationStatus | string;
  final_recommendation: string;
  review_state: ReviewState | string;
  mission_id: string | null;
  linked_branch: string | null;
  linked_pr: string | null;
  updated_at: string | null;
  created_at: string | null;
  metadata?: Record<string, unknown>;
};

type RouterDecisionDetail = RouterDecision & {
  events?: TimelineEvent[];
  linked_mission?: MissionDetail | null;
};

type ListResponse = {
  items?: RouterDecision[];
  total?: number;
};

type ModelRouterClientProps = {
  createdBy: string;
};

const ACTIVE_STATES = new Set<ReviewState | string>([
  "active",
  "approved_next_step",
  "rerun_requested",
  "second_review_requested",
]);

const TASK_CLASSES: TaskClass[] = ["implement", "debug", "review", "verify"];
const REVIEW_STATE_OPTIONS: (ReviewState | "all")[] = [
  "all",
  "active",
  "approved_next_step",
  "needs_changes",
  "rerun_requested",
  "second_review_requested",
  "ready_for_pr_review",
  "ready_for_merge",
  "rejected",
];
const VERIFICATION_OPTIONS: (VerificationStatus | "all")[] = ["all", "pending", "passed", "failed", "not_required"];

function parseError(payload: unknown, fallback: string): string {
  if (typeof payload === "string" && payload.trim()) return payload;
  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    if (typeof record.error === "string" && record.error.trim()) return record.error;
    if (typeof record.detail === "string" && record.detail.trim()) return record.detail;
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

function badgeClass(status: string): string {
  const normalized = status.toLowerCase();
  if (["passed", "passing", "ready_for_pr_review", "ready_for_merge"].includes(normalized)) return styles.good;
  if (["failed", "failing", "rejected", "needs_changes", "revise_before_pr"].includes(normalized)) return styles.bad;
  if (["pending", "not_run", "needs_second_model_review", "rerun_requested", "second_review_requested"].includes(normalized)) {
    return styles.warn;
  }
  return styles.neutral;
}

function prLink(value: string | null | undefined): string | null {
  if (!value) return null;
  const raw = value.trim();
  if (!raw) return null;
  if (/^https?:\/\//.test(raw)) return raw;
  if (/^\d+$/.test(raw)) return `https://github.com/BeTeachableLLC/tufflove-platform/pull/${raw}`;
  return null;
}

function branchLink(value: string | null | undefined): string | null {
  if (!value) return null;
  const raw = value.trim();
  if (!raw) return null;
  return `https://github.com/BeTeachableLLC/tufflove-platform/tree/${encodeURIComponent(raw)}`;
}

export default function ModelRouterClient({ createdBy }: ModelRouterClientProps) {
  const [items, setItems] = useState<RouterDecision[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<RouterDecisionDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const [taskClassFilter, setTaskClassFilter] = useState<TaskClass | "all">("all");
  const [reviewStateFilter, setReviewStateFilter] = useState<ReviewState | "all">("all");
  const [verificationFilter, setVerificationFilter] = useState<VerificationStatus | "all">("all");

  const [taskClass, setTaskClass] = useState<TaskClass>("implement");
  const [taskType, setTaskType] = useState("build.implementation");
  const [requestedModel, setRequestedModel] = useState("codex");
  const [proofStatus, setProofStatus] = useState<ProofStatus>("unknown");
  const [proofSummary, setProofSummary] = useState("");
  const [escalationReason, setEscalationReason] = useState("");
  const [outputSummary, setOutputSummary] = useState("");
  const [linkedBranch, setLinkedBranch] = useState("");
  const [linkedPr, setLinkedPr] = useState("");
  const [creating, setCreating] = useState(false);

  const [actionNote, setActionNote] = useState("");
  const [secondModel, setSecondModel] = useState("gemini");
  const [actionLoading, setActionLoading] = useState<ActionType | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [lastActionPayload, setLastActionPayload] = useState<unknown>(null);

  const loadList = useCallback(async () => {
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    params.set("limit", "200");
    if (taskClassFilter !== "all") params.set("task_class", taskClassFilter);
    if (reviewStateFilter !== "all") params.set("review_state", reviewStateFilter);
    if (verificationFilter !== "all") params.set("verification_status", verificationFilter);

    try {
      const response = await fetch(`/api/familyops/model-router?${params.toString()}`, { cache: "no-store" });
      const payload = await readResponse(response);
      if (!response.ok) {
        throw new Error(parseError(payload, `Failed to load command queue (${response.status})`));
      }
      const data = (payload && typeof payload === "object" ? payload : {}) as ListResponse;
      setItems(Array.isArray(data.items) ? data.items : []);
      setTotal(typeof data.total === "number" ? data.total : 0);
    } catch (loadError) {
      setItems([]);
      setError(loadError instanceof Error ? loadError.message : String(loadError));
    } finally {
      setLoading(false);
    }
  }, [taskClassFilter, reviewStateFilter, verificationFilter]);

  const loadDetail = useCallback(async (id: string) => {
    setDetailLoading(true);
    setDetailError(null);
    try {
      const response = await fetch(`/api/familyops/model-router/${encodeURIComponent(id)}?include_mission=true`, {
        cache: "no-store",
      });
      const payload = await readResponse(response);
      if (!response.ok) {
        throw new Error(parseError(payload, `Failed to load mission detail (${response.status})`));
      }
      setDetail(payload as RouterDecisionDetail);
      setSelectedId(id);
    } catch (loadError) {
      setDetail(null);
      setSelectedId(id);
      setDetailError(loadError instanceof Error ? loadError.message : String(loadError));
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  useEffect(() => {
    if (!selectedId && items.length > 0) {
      void loadDetail(items[0].id);
    }
  }, [items, selectedId, loadDetail]);

  async function createMissionRecord(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreating(true);
    setActionError(null);
    try {
      const response = await fetch("/api/familyops/model-router", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          task_class: taskClass,
          task_type: taskType.trim() || null,
          requested_model: requestedModel.trim() || null,
          escalation_reason: escalationReason.trim(),
          output_summary: outputSummary.trim(),
          proof_summary: proofSummary.trim(),
          proof_status: proofStatus,
          linked_branch: linkedBranch.trim() || null,
          linked_pr: linkedPr.trim() || null,
          created_by: createdBy,
        }),
      });
      const payload = await readResponse(response);
      if (!response.ok) {
        throw new Error(parseError(payload, `Failed to create mission review record (${response.status})`));
      }
      setLastActionPayload(payload);
      await loadList();
      const decisionId =
        payload && typeof payload === "object" ? ((payload as { decision?: { id?: string } }).decision?.id ?? null) : null;
      if (decisionId) {
        await loadDetail(decisionId);
      }
    } catch (submitError) {
      setActionError(submitError instanceof Error ? submitError.message : String(submitError));
    } finally {
      setCreating(false);
    }
  }

  async function runAction(action: ActionType) {
    if (!detail) return;
    setActionLoading(action);
    setActionError(null);
    try {
      const response = await fetch(`/api/familyops/model-router/${encodeURIComponent(detail.id)}/action`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action,
          actor: createdBy,
          note: actionNote.trim(),
          requested_model: action === "request_second_model_review" ? secondModel : null,
        }),
      });
      const payload = await readResponse(response);
      if (!response.ok) {
        throw new Error(parseError(payload, `Failed to execute action ${action} (${response.status})`));
      }
      setLastActionPayload(payload);
      setActionNote("");
      await loadList();
      await loadDetail(detail.id);
    } catch (submitError) {
      setActionError(submitError instanceof Error ? submitError.message : String(submitError));
    } finally {
      setActionLoading(null);
    }
  }

  const activeQueue = useMemo(
    () => items.filter((item) => ACTIVE_STATES.has(item.review_state)),
    [items],
  );
  const recentQueue = useMemo(() => items.slice(0, 30), [items]);

  const timeline = useMemo(() => {
    const records: Array<TimelineEvent & { source: "router" | "mission" }> = [];
    for (const event of detail?.events || []) {
      records.push({ ...event, source: "router" });
    }
    for (const event of detail?.linked_mission?.timeline || []) {
      records.push({ ...event, source: "mission" });
    }
    records.sort((a, b) => (a.at || "").localeCompare(b.at || ""));
    return records;
  }, [detail]);

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1>Remote Approval Command Surface</h1>
        <p>
          Approve, reroute, and hand off build missions from iPad, iPhone, or MacBook without local-runtime dependency.
        </p>
        <p className={styles.links}>
          <Link href="/familyops/missions">Mission History</Link>
          <span> · </span>
          <Link href="/familyops/operators">Operators</Link>
          <span> · </span>
          <Link href="/familyops/triggers">Trigger Service</Link>
        </p>
      </header>

      {error ? <div className={styles.error}>{error}</div> : null}
      {actionError ? <div className={styles.error}>{actionError}</div> : null}

      <section className={styles.card}>
        <h2>Create Mission Review Record</h2>
        <form className={styles.formGrid} onSubmit={(event) => void createMissionRecord(event)}>
          <label>
            Task Class
            <select value={taskClass} onChange={(event) => setTaskClass(event.target.value as TaskClass)}>
              {TASK_CLASSES.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label>
            Task Type
            <input value={taskType} onChange={(event) => setTaskType(event.target.value)} />
          </label>
          <label>
            Requested Model
            <input value={requestedModel} onChange={(event) => setRequestedModel(event.target.value)} />
          </label>
          <label>
            Proof Status
            <select value={proofStatus} onChange={(event) => setProofStatus(event.target.value as ProofStatus)}>
              <option value="unknown">unknown</option>
              <option value="passing">passing</option>
              <option value="failing">failing</option>
              <option value="not_run">not_run</option>
            </select>
          </label>
          <label className={styles.span2}>
            Escalation Summary
            <input value={escalationReason} onChange={(event) => setEscalationReason(event.target.value)} />
          </label>
          <label className={styles.span2}>
            Proof/Test Summary
            <input value={proofSummary} onChange={(event) => setProofSummary(event.target.value)} />
          </label>
          <label className={styles.span2}>
            Compact Output/Diff Summary
            <input value={outputSummary} onChange={(event) => setOutputSummary(event.target.value)} />
          </label>
          <label>
            Branch
            <input value={linkedBranch} onChange={(event) => setLinkedBranch(event.target.value)} />
          </label>
          <label>
            PR URL or Number
            <input value={linkedPr} onChange={(event) => setLinkedPr(event.target.value)} />
          </label>
          <div className={styles.formActions}>
            <button type="submit" disabled={creating}>
              {creating ? "Saving..." : "Add Review Record"}
            </button>
          </div>
        </form>
      </section>

      <section className={styles.card}>
        <h2>Queue Filters</h2>
        <div className={styles.filterGrid}>
          <label>
            Task Class
            <select value={taskClassFilter} onChange={(event) => setTaskClassFilter(event.target.value as TaskClass | "all")}>
              <option value="all">all</option>
              {TASK_CLASSES.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label>
            Review State
            <select value={reviewStateFilter} onChange={(event) => setReviewStateFilter(event.target.value as ReviewState | "all")}>
              {REVIEW_STATE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label>
            Verification
            <select value={verificationFilter} onChange={(event) => setVerificationFilter(event.target.value as VerificationStatus | "all")}>
              {VERIFICATION_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <button type="button" onClick={() => void loadList()} disabled={loading}>
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
        <p className={styles.muted}>Total records: {total}</p>
      </section>

      <section className={styles.grid2}>
        <div className={styles.card}>
          <h2>Active Review Queue</h2>
          <div className={styles.list}>
            {activeQueue.length === 0 ? <div className={styles.muted}>No active review items.</div> : null}
            {activeQueue.map((item) => (
              <button key={item.id} type="button" className={styles.item} onClick={() => void loadDetail(item.id)}>
                <div className={styles.itemHeader}>
                  <strong>{item.task_type || "build.mission"}</strong>
                  <span className={`${styles.badge} ${badgeClass(item.review_state)}`}>{item.review_state}</span>
                </div>
                <div className={styles.itemMeta}>{item.selected_model} · proof {item.proof_status} · verification {item.verification_status}</div>
                <div className={styles.itemMeta}>branch: {item.linked_branch || "-"} · pr: {item.linked_pr || "-"}</div>
              </button>
            ))}
          </div>
        </div>

        <div className={styles.card}>
          <h2>Recent Build Missions</h2>
          <div className={styles.list}>
            {recentQueue.length === 0 ? <div className={styles.muted}>No recent records.</div> : null}
            {recentQueue.map((item) => (
              <button key={`recent-${item.id}`} type="button" className={styles.item} onClick={() => void loadDetail(item.id)}>
                <div className={styles.itemHeader}>
                  <strong>{formatDateTime(item.updated_at || item.created_at)}</strong>
                  <span className={`${styles.badge} ${badgeClass(item.final_recommendation)}`}>{item.final_recommendation}</span>
                </div>
                <div className={styles.itemMeta}>{item.task_class} · selected {item.selected_model} · {item.task_type || "n/a"}</div>
                <div className={styles.itemMeta}>{item.proof_summary || item.output_summary || item.escalation_reason || "-"}</div>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.card}>
        <h2>Mission Approval Detail</h2>
        {detailLoading ? <div className={styles.muted}>Loading...</div> : null}
        {detailError ? <div className={styles.error}>{detailError}</div> : null}
        {!detailLoading && !detail ? <div className={styles.muted}>Select an item from Active or Recent queue.</div> : null}

        {detail ? (
          <div className={styles.detailWrap}>
            <div className={styles.detailGrid}>
              <div><strong>ID:</strong> {detail.id}</div>
              <div><strong>Task:</strong> {detail.task_type || "-"} ({detail.task_class})</div>
              <div><strong>Route:</strong> {(detail.requested_model || "auto")} → {detail.selected_model}</div>
              <div><strong>State:</strong> <span className={`${styles.badge} ${badgeClass(detail.review_state)}`}>{detail.review_state}</span></div>
              <div><strong>Verification:</strong> <span className={`${styles.badge} ${badgeClass(detail.verification_status)}`}>{detail.verification_status}</span></div>
              <div><strong>Recommendation:</strong> <span className={`${styles.badge} ${badgeClass(detail.final_recommendation)}`}>{detail.final_recommendation}</span></div>
              <div><strong>Escalation:</strong> {detail.escalation_reason || "-"}</div>
              <div><strong>Proof:</strong> {detail.proof_summary || "-"} ({detail.proof_status})</div>
              <div><strong>Output Summary:</strong> {detail.output_summary || "-"}</div>
              <div><strong>Mission:</strong> {detail.mission_id || "-"}</div>
            </div>

            <div className={styles.linkRow}>
              {branchLink(detail.linked_branch) ? (
                <a href={branchLink(detail.linked_branch) || "#"} target="_blank" rel="noreferrer">
                  Open Branch
                </a>
              ) : (
                <span className={styles.muted}>No branch linked</span>
              )}
              {prLink(detail.linked_pr) ? (
                <a href={prLink(detail.linked_pr) || "#"} target="_blank" rel="noreferrer">
                  Open GitHub PR
                </a>
              ) : (
                <span className={styles.muted}>No PR linked</span>
              )}
            </div>

            <div className={styles.actionBlock}>
              <label>
                Action Note
                <textarea value={actionNote} onChange={(event) => setActionNote(event.target.value)} rows={3} />
              </label>
              <label>
                Second-Model Review Target
                <select value={secondModel} onChange={(event) => setSecondModel(event.target.value)}>
                  <option value="gemini">gemini</option>
                  <option value="claude">claude</option>
                  <option value="codex">codex</option>
                  <option value="openclaw">openclaw (optional)</option>
                </select>
              </label>
              <div className={styles.actionGrid}>
                <button type="button" onClick={() => void runAction("approve_next_step")} disabled={Boolean(actionLoading)}>Approve Next Step</button>
                <button type="button" onClick={() => void runAction("reject_send_back")} disabled={Boolean(actionLoading)}>Reject / Send Back</button>
                <button type="button" onClick={() => void runAction("request_rerun")} disabled={Boolean(actionLoading)}>Request Re-Run</button>
                <button type="button" onClick={() => void runAction("request_second_model_review")} disabled={Boolean(actionLoading)}>Request Second-Model Review</button>
                <button type="button" onClick={() => void runAction("mark_ready_pr_review")} disabled={Boolean(actionLoading)}>Mark Ready for PR Review</button>
                <button type="button" onClick={() => void runAction("mark_ready_merge")} disabled={Boolean(actionLoading)}>Mark Ready for Merge</button>
              </div>
              {actionLoading ? <div className={styles.muted}>Running {actionLoading}...</div> : null}
            </div>

            <div className={styles.timelineBlock}>
              <h3>Unified Timeline (Command Surface + Mission History)</h3>
              {timeline.length === 0 ? <div className={styles.muted}>No timeline events yet.</div> : null}
              {timeline.map((event, index) => (
                <div key={`${event.at || "no-time"}-${event.event_type}-${index}`} className={styles.timelineItem}>
                  <div className={styles.timelineMeta}>
                    <span>{formatDateTime(event.at)}</span>
                    <span className={`${styles.badge} ${badgeClass(event.status)}`}>{event.status}</span>
                    <span className={styles.sourceTag}>{event.source}</span>
                  </div>
                  <div><strong>{event.event_type}</strong></div>
                  <div>{event.detail || "-"}</div>
                  {event.metadata ? <pre>{pretty(event.metadata)}</pre> : null}
                </div>
              ))}
            </div>

            {detail.linked_mission ? (
              <div className={styles.timelineBlock}>
                <h3>Linked Mission Snapshot</h3>
                <div><strong>Status:</strong> {detail.linked_mission.status}</div>
                <div><strong>Task Type:</strong> {detail.linked_mission.task_type}</div>
                <div><strong>Summary:</strong> {detail.linked_mission.summary || "-"}</div>
                <div><strong>Blocked Reason:</strong> {detail.linked_mission.blocked_reason || "-"}</div>
                <div><strong>Dry Run:</strong> {detail.linked_mission.dry_run ? "true" : "false"}</div>
              </div>
            ) : null}
          </div>
        ) : null}
      </section>

      {lastActionPayload ? (
        <section className={styles.card}>
          <h2>Last API Response</h2>
          <pre>{pretty(lastActionPayload)}</pre>
        </section>
      ) : null}
    </main>
  );
}
